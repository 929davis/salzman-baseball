// Reads the local DuckDB pitch-level store (built by backfill-statcast.mjs) and computes
// the 5 Base Scenario Tool aggregate tables, then upserts them into Supabase.
//
// Usage: node scripts/aggregate-base-scenario.mjs [--dry-run]

import duckdb from 'duckdb'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', 'data', 'statcast_2026.duckdb')
const DRY_RUN = process.argv.includes('--dry-run')

// Frozen to the 2026 first half (Opening Day through the All-Star break cutoff) — matches
// the statcast_pitches table backfilled by scripts/backfill-statcast-pitches.mjs, replacing
// the daily Savant cron. The local DuckDB store has data past this date (it was backfilled
// further for other purposes); this cap keeps both halves of the app in sync on the same
// frozen range instead of silently drifting apart. NOTE: 2026-07-13 is an unverified
// placeholder for "day before the All-Star break" — update if the real date differs.
const FIRST_HALF_END = '2026-07-13'

// Minimal .env.local loader — avoids adding a dotenv dependency for one script.
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const text = fs.readFileSync(envPath, 'utf8')
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) process.env[m[1]] = process.env[m[1]] || m[2]
  }
}

const all = (con, sql) => new Promise((res, rej) => con.all(sql, (err, rows) => err ? rej(err) : res(rows)))

// Pitch-type grouping — chosen to land near the spec's ~6-group estimate (see conversation):
// fastball families kept separate (four-seam/sinker/cutter behave differently), breaking
// balls and offspeed grouped by family, everything rare folded into Other. Slider and Sweeper
// are kept as separate groups (not merged) per explicit request — they're mechanically
// distinct pitches despite both being "sliders" colloquially. Slurve (SV) stays with Slider
// as the closer traditional-breaking-ball match; it's rare enough (~0.4% of pitches) that
// either placement barely moves the numbers.
const PITCH_TYPE_GROUP_SQL = `
  CASE
    WHEN pitch_type IN ('FF','FA') THEN 'Four-Seam'
    WHEN pitch_type = 'SI' THEN 'Sinker'
    WHEN pitch_type = 'FC' THEN 'Cutter'
    WHEN pitch_type IN ('SL','SV') THEN 'Slider'
    WHEN pitch_type = 'ST' THEN 'Sweeper'
    WHEN pitch_type IN ('CU','KC','CS') THEN 'Curveball'
    WHEN pitch_type IN ('CH','FS','FO') THEN 'Changeup'
    ELSE 'Other'
  END
`

const BASE_STATE_SQL = `
  CASE
    WHEN on_1b AND on_2b AND on_3b THEN 'loaded'
    WHEN on_1b AND on_2b THEN '1st_2nd'
    WHEN on_1b AND on_3b THEN '1st_3rd'
    WHEN on_2b AND on_3b THEN '2nd_3rd'
    WHEN on_1b THEN '1st'
    WHEN on_2b THEN '2nd'
    WHEN on_3b THEN '3rd'
    ELSE 'empty'
  END
`

// Outcome classification — events checked first (only populated on the PA-ending pitch),
// falling back to description for non-terminal pitches. Reached-on-error and rare events
// (catcher's interference etc.) fold into out_in_play/other rather than getting their own
// bucket — not in the spec's §6 taxonomy and too rare to matter (~1-2% of balls in play).
const OUTCOME_SQL = `
  CASE
    WHEN events IN ('walk','intent_walk') THEN 'walk'
    WHEN events IN ('strikeout','strikeout_double_play') THEN 'strikeout'
    WHEN events = 'single' THEN 'single'
    WHEN events = 'double' THEN 'double'
    WHEN events = 'triple' THEN 'triple'
    WHEN events = 'home_run' THEN 'home_run'
    WHEN events = 'hit_by_pitch' THEN 'hbp'
    WHEN events IS NOT NULL AND events != '' AND description LIKE 'hit_into_play%' THEN 'out_in_play'
    WHEN events IS NOT NULL AND events != '' THEN 'out_in_play'
    WHEN description = 'ball' THEN 'ball'
    WHEN description = 'blocked_ball' THEN 'ball'
    WHEN description = 'called_strike' THEN 'called_strike'
    WHEN description IN ('swinging_strike','swinging_strike_blocked') THEN 'swinging_strike'
    WHEN description IN ('foul','foul_tip','foul_bunt') THEN 'foul'
    ELSE 'other'
  END
`

const OUTCOME_COUNT_COLUMNS = `
  COUNT(*)::INTEGER AS n,
  SUM(CASE WHEN outcome='ball' THEN 1 ELSE 0 END)::INTEGER AS n_ball,
  SUM(CASE WHEN outcome='called_strike' THEN 1 ELSE 0 END)::INTEGER AS n_called_strike,
  SUM(CASE WHEN outcome='swinging_strike' THEN 1 ELSE 0 END)::INTEGER AS n_swinging_strike,
  SUM(CASE WHEN outcome='foul' THEN 1 ELSE 0 END)::INTEGER AS n_foul,
  SUM(CASE WHEN outcome='walk' THEN 1 ELSE 0 END)::INTEGER AS n_walk,
  SUM(CASE WHEN outcome='strikeout' THEN 1 ELSE 0 END)::INTEGER AS n_strikeout,
  SUM(CASE WHEN outcome='out_in_play' THEN 1 ELSE 0 END)::INTEGER AS n_out_in_play,
  SUM(CASE WHEN outcome='single' THEN 1 ELSE 0 END)::INTEGER AS n_single,
  SUM(CASE WHEN outcome='double' THEN 1 ELSE 0 END)::INTEGER AS n_double,
  SUM(CASE WHEN outcome='triple' THEN 1 ELSE 0 END)::INTEGER AS n_triple,
  SUM(CASE WHEN outcome='home_run' THEN 1 ELSE 0 END)::INTEGER AS n_home_run,
  SUM(CASE WHEN outcome='hbp' THEN 1 ELSE 0 END)::INTEGER AS n_hbp,
  COALESCE(SUM(delta_run_exp), 0) AS sum_delta_run_exp,
  COALESCE(SUM(delta_run_exp*delta_run_exp), 0) AS sum_delta_run_exp_sq
`

async function buildClassifiedView(con) {
  await new Promise((res, rej) => con.run(`
    CREATE OR REPLACE VIEW classified AS
    SELECT *,
      ${PITCH_TYPE_GROUP_SQL} AS pitch_type_group,
      ${BASE_STATE_SQL} AS base_state,
      (balls::VARCHAR || '-' || strikes::VARCHAR) AS count_bucket,
      ${OUTCOME_SQL} AS outcome
    FROM pitches
    WHERE game_date <= '${FIRST_HALF_END}'
  `, err => err ? rej(err) : res()))
}

async function computeJoint(con) {
  return all(con, `
    SELECT p_throws, bats, pitch_type_group, count_bucket, outs_when_up, base_state, ${OUTCOME_COUNT_COLUMNS}
    FROM classified
    GROUP BY 1,2,3,4,5,6
  `)
}

async function computePitchMarginal(con) {
  return all(con, `
    SELECT p_throws, bats, pitch_type_group, count_bucket, ${OUTCOME_COUNT_COLUMNS}
    FROM classified
    GROUP BY 1,2,3,4
  `)
}

const ZONES = [1,2,3,4,5,6,7,8,9,11,12,13,14]

// Real zone-location distribution per (matchup, pitch type, count, outcome) — used by the
// zone panel to show a realistic pitch location for each simulated action, since the
// production statcast_pitches table has no location data at all for ball/called-strike
// outcomes (see conversation: that table only ever ingested swings). Deliberately a single
// granularity level (no hybrid backoff like the run-value tables) — this is a visual aid,
// not a statistical claim, so when a combo has no data the UI just won't have a sample for it.
async function computeZoneSample(con) {
  const zoneCols = ZONES.map(z => `SUM(CASE WHEN zone=${z} THEN 1 ELSE 0 END)::INTEGER AS zone_${z}`).join(',')
  return all(con, `
    SELECT p_throws, bats, pitch_type_group, count_bucket, outcome, COUNT(*)::INTEGER AS n, ${zoneCols}
    FROM classified
    WHERE zone IS NOT NULL AND outcome IN ('ball','called_strike','swinging_strike','foul','walk','strikeout','out_in_play','single','double','triple','home_run','hbp')
    GROUP BY 1,2,3,4,5
  `)
}

// ---------------------------------------------------------------------------
// Batted-ball model (spec §7) — Put In Play branch.
//
// Spray direction: uses hc_x/hc_y (real hit coordinates — where the ball was fielded),
// NOT attack_direction (that's bat-sensor swing-path data, a different thing entirely —
// verified empirically before using it: attack_direction correlates with intent, not
// necessarily where the ball actually went). Formula and home-plate origin constants
// (125.42, 198.27) are the standard public spray-angle calculation, cross-checked against
// real 2026 data — confirmed RHH pull tendency sits on the negative-angle side and flips
// for LHH, matching physical expectation. +/-15 degrees approximates Savant's own
// pull/center/opposite field-thirds convention.
const SPRAY_ANGLE_SQL = `DEGREES(ATAN2(hc_x - 125.42, 198.27 - hc_y))`
const DIRECTION_SQL = `
  CASE
    WHEN (bats='R' AND ${SPRAY_ANGLE_SQL} < -15) OR (bats='L' AND ${SPRAY_ANGLE_SQL} > 15) THEN 'pull'
    WHEN (bats='R' AND ${SPRAY_ANGLE_SQL} > 15) OR (bats='L' AND ${SPRAY_ANGLE_SQL} < -15) THEN 'opposite'
    ELSE 'center'
  END
`
// bb_type is Statcast's own official ground_ball/line_drive/fly_ball/popup classification —
// reused directly rather than re-deriving approximate launch-angle thresholds ourselves.
const BATTED_BALL_FILTER = `outcome IN ('out_in_play','single','double','triple','home_run') AND launch_speed IS NOT NULL AND bb_type IS NOT NULL AND hc_x IS NOT NULL AND hc_y IS NOT NULL`

const BATTED_OUTCOME_COLUMNS = `
  COUNT(*)::INTEGER AS n,
  SUM(CASE WHEN outcome='out_in_play' THEN 1 ELSE 0 END)::INTEGER AS n_out,
  SUM(CASE WHEN outcome='single' THEN 1 ELSE 0 END)::INTEGER AS n_single,
  SUM(CASE WHEN outcome='double' THEN 1 ELSE 0 END)::INTEGER AS n_double,
  SUM(CASE WHEN outcome='triple' THEN 1 ELSE 0 END)::INTEGER AS n_triple,
  SUM(CASE WHEN outcome='home_run' THEN 1 ELSE 0 END)::INTEGER AS n_home_run
`

// 7 evenly-populated EV bands via NTILE — guarantees even population by construction,
// rather than picking fixed mph cutoffs (spec explicitly warns against mean+-SD bands
// since EV is left-skewed with a hard ceiling near 120mph).
async function computeEvBuckets(con) {
  return all(con, `
    WITH bucketed AS (
      SELECT launch_speed, (NTILE(7) OVER (ORDER BY launch_speed))::INTEGER AS ev_bucket
      FROM classified WHERE ${BATTED_BALL_FILTER}
    )
    SELECT ev_bucket, COUNT(*)::INTEGER AS n, MIN(launch_speed) AS mph_min, MAX(launch_speed) AS mph_max
    FROM bucketed GROUP BY 1 ORDER BY 1
  `)
}

async function computeBattedBallOutcome(con) {
  return all(con, `
    WITH bucketed AS (
      SELECT *, (NTILE(7) OVER (ORDER BY launch_speed))::INTEGER AS ev_bucket,
        ${DIRECTION_SQL} AS direction
      FROM classified WHERE ${BATTED_BALL_FILTER}
    )
    SELECT ev_bucket, bb_type AS launch_angle_category, direction, ${BATTED_OUTCOME_COLUMNS}
    FROM bucketed
    GROUP BY 1,2,3
  `)
}

// Run-value at the exact 8-state base/outs granularity — the resolver (lib/baseScenario.ts)
// rolls this up client-side through the backoff ladder (spec §3: exact 8-state -> 4 grouped
// states -> outs-only) by summing matching rows, since it's already fully loaded and raw
// counts are additive. No separate marginal tables needed for this one.
async function computeBattedBallRE(con) {
  return all(con, `
    WITH bucketed AS (
      SELECT *, (NTILE(7) OVER (ORDER BY launch_speed))::INTEGER AS ev_bucket,
        ${DIRECTION_SQL} AS direction
      FROM classified WHERE ${BATTED_BALL_FILTER}
    )
    SELECT ev_bucket, bb_type AS launch_angle_category, direction, outs_when_up, base_state,
      COUNT(*)::INTEGER AS n,
      COALESCE(SUM(delta_run_exp), 0) AS sum_delta_run_exp,
      COALESCE(SUM(delta_run_exp*delta_run_exp), 0) AS sum_delta_run_exp_sq
    FROM bucketed
    GROUP BY 1,2,3,4,5
  `)
}

// ---------------------------------------------------------------------------
// Pitch Sequence tool — most common (pitch type, location) sequences leading to a
// target outcome (strikeout looking, weak contact, barrel, etc).
//
// Barrel: Statcast doesn't expose a precomputed `barrel` column in the public CSV export
// (verified empirically — checked both player_type=batter and player_type=pitcher, neither
// includes it; the existing production cron's `barrel` field has silently always been false
// because of this, a pre-existing bug unrelated to this tool). Computed here instead from
// the two verified anchor points in MLB's official glossary: 98mph -> 26-30 degree window,
// 116mph -> 8-50 degree window. Linearly interpolated between them (center ~28 degrees,
// half-width growing ~1.06 degrees/mph) — Statcast's real internal table is not perfectly
// linear mph-to-mph, so treat this as a close approximation, not an exact replication.
// "Blast" (squared-up + fast swing) is skipped entirely — squared-up needs a max-possible-
// exit-velocity formula (from bat speed + pitch speed) that isn't published anywhere found.
const BARREL_SQL = `
  CASE
    WHEN launch_speed IS NULL OR launch_angle IS NULL THEN FALSE
    WHEN launch_speed < 98 THEN FALSE
    WHEN launch_speed >= 116 THEN launch_angle BETWEEN 8 AND 50
    ELSE launch_angle BETWEEN (28 - (2 + (launch_speed-98)*(19.0/18))) AND (28 + (2 + (launch_speed-98)*(19.0/18)))
  END
`

// 3-way location bucket (coarser than the 13-zone grid used elsewhere) — keeps the sequence
// combinatorial space small enough for real patterns to surface rather than one-off noise.
const LOCATION_BUCKET_SQL = `
  CASE
    WHEN zone = 5 THEN 'heart'
    WHEN zone IN (1,2,3,4,6,7,8,9) THEN 'edge'
    WHEN zone IN (11,12,13,14) THEN 'chase'
    ELSE NULL
  END
`

async function computeSequences(con) {
  return all(con, `
    WITH located AS (
      SELECT *, ROW_NUMBER() OVER () AS rid, ${LOCATION_BUCKET_SQL} AS location_bucket
      FROM classified
    ),
    -- EV bucket computed ONLY over real batted balls (matching bs_ev_buckets' own scoping
    -- exactly) — computing it over every pitch would shift the bucket boundaries wrong.
    ev_ranked AS (
      SELECT rid, (NTILE(7) OVER (ORDER BY launch_speed))::INTEGER AS ev_bucket
      FROM located WHERE ${BATTED_BALL_FILTER}
    ),
    target_tagged AS (
      SELECT located.*,
        CASE
          WHEN located.outcome='strikeout' AND located.description='called_strike' THEN 'strikeout_looking'
          WHEN located.outcome='strikeout' AND located.description IN ('swinging_strike','swinging_strike_blocked') THEN 'strikeout_swinging'
          WHEN located.outcome IN ('out_in_play','single','double','triple','home_run') AND located.launch_speed IS NOT NULL AND ${BARREL_SQL} THEN 'barrel'
          WHEN ev_ranked.ev_bucket IS NOT NULL AND ev_ranked.ev_bucket <= 2 THEN 'weak_contact'
          ELSE 'other'
        END AS target
      FROM located LEFT JOIN ev_ranked USING (rid)
    ),
    pa_ending AS (
      -- the last pitch of each PA, with the previous pitch's type/location via LAG
      SELECT
        p_throws, bats,
        LAG(pitch_type_group) OVER w AS pt1, LAG(location_bucket) OVER w AS loc1,
        pitch_type_group AS pt2, location_bucket AS loc2,
        target,
        pitch_number, game_pk, at_bat_number
      FROM target_tagged
      WINDOW w AS (PARTITION BY game_pk, at_bat_number ORDER BY pitch_number)
      QUALIFY pitch_number = MAX(pitch_number) OVER (PARTITION BY game_pk, at_bat_number)
    )
    SELECT p_throws, bats, pt1, loc1, pt2, loc2,
      COUNT(*)::INTEGER AS n_total,
      SUM(CASE WHEN target='strikeout_looking' THEN 1 ELSE 0 END)::INTEGER AS n_strikeout_looking,
      SUM(CASE WHEN target='strikeout_swinging' THEN 1 ELSE 0 END)::INTEGER AS n_strikeout_swinging,
      SUM(CASE WHEN target='weak_contact' THEN 1 ELSE 0 END)::INTEGER AS n_weak_contact,
      SUM(CASE WHEN target='barrel' THEN 1 ELSE 0 END)::INTEGER AS n_barrel,
      SUM(CASE WHEN target='other' THEN 1 ELSE 0 END)::INTEGER AS n_other
    FROM pa_ending
    WHERE pt1 IS NOT NULL AND loc1 IS NOT NULL AND loc2 IS NOT NULL
    GROUP BY 1,2,3,4,5,6
  `)
}

async function computeReMarginal(con) {
  return all(con, `
    SELECT outs_when_up, base_state, count_bucket, COUNT(*)::INTEGER AS n,
      COALESCE(SUM(delta_run_exp), 0) AS sum_delta_run_exp,
      COALESCE(SUM(delta_run_exp*delta_run_exp), 0) AS sum_delta_run_exp_sq
    FROM classified
    GROUP BY 1,2,3
  `)
}

// Rest-of-inning runs: for each PA's first pitch, the game state at that moment
// (outs, base state, score) — compared against the batting team's final score for
// that half-inning (MAX(post_bat_score) is safe since it only ever increases).
async function computeRE24(con) {
  const paStarts = await all(con, `
    WITH half_inning_final AS (
      SELECT game_pk, inning, inning_topbot, MAX(post_bat_score) AS final_score
      FROM classified
      GROUP BY 1,2,3
    )
    SELECT s.p_throws, s.bats, s.outs_when_up, s.base_state,
           (f.final_score - s.bat_score) AS runs_rest_of_inning
    FROM classified s
    JOIN half_inning_final f USING (game_pk, inning, inning_topbot)
    WHERE s.pitch_number = 1
  `)

  const splitMap = new Map(), baseMap = new Map()
  for (const row of paStarts) {
    const rr = Number(row.runs_rest_of_inning)
    if (rr == null || Number.isNaN(rr) || rr < 0) continue // guard against bad/incomplete half-inning data
    const splitKey = `${row.p_throws}|${row.bats}|${row.outs_when_up}|${row.base_state}`
    const baseKey = `${row.outs_when_up}|${row.base_state}`
    const s = splitMap.get(splitKey) || { p_throws: row.p_throws, bats: row.bats, outs_when_up: row.outs_when_up, base_state: row.base_state, n: 0, sum: 0 }
    s.n++; s.sum += rr; splitMap.set(splitKey, s)
    const b = baseMap.get(baseKey) || { outs_when_up: row.outs_when_up, base_state: row.base_state, n: 0, sum: 0 }
    b.n++; b.sum += rr; baseMap.set(baseKey, b)
  }
  return {
    split: [...splitMap.values()].map(r => ({ p_throws: r.p_throws, bats: r.bats, outs_when_up: r.outs_when_up, base_state: r.base_state, n: r.n, sum_runs_rest_of_inning: r.sum })),
    base: [...baseMap.values()].map(r => ({ outs_when_up: r.outs_when_up, base_state: r.base_state, n: r.n, sum_runs_rest_of_inning: r.sum })),
  }
}

const LEVERAGE_OUTCOMES = ['ball','called_strike','swinging_strike','foul','walk','strikeout','out_in_play','single','double','triple','home_run','hbp']

// One row per count (12 total), with sum AND sum-of-squares of delta_run_exp per outcome
// type — sum-of-squares is what lets the UI compute a real confidence interval on a mean
// (via standard error), not just point estimates. Wilson intervals (used elsewhere in this
// tool) only work for proportions; a run-value average needs variance.
async function computeCountLeverage(con) {
  const cols = LEVERAGE_OUTCOMES.map(o => `
    SUM(CASE WHEN outcome='${o}' THEN 1 ELSE 0 END)::INTEGER AS n_${o},
    COALESCE(SUM(CASE WHEN outcome='${o}' THEN delta_run_exp ELSE 0 END), 0) AS sum_delta_run_exp_${o},
    COALESCE(SUM(CASE WHEN outcome='${o}' THEN delta_run_exp*delta_run_exp ELSE 0 END), 0) AS sum_delta_run_exp_${o}_sq
  `).join(',')
  return all(con, `SELECT count_bucket, COUNT(*)::INTEGER AS n, ${cols} FROM classified GROUP BY 1`)
}

// Every table here is a full recompute from the local backfill each run, never an
// incremental update — so upsert-only leaves stale rows behind whenever a bucketing scheme
// changes (e.g. splitting a pitch-type group no longer regenerates the old combined row's
// exact key). Clearing first guarantees the table always matches exactly what was just
// computed, not a superset of it.
async function upsert(supabase, table, rows, conflictCols) {
  if (DRY_RUN) { console.log(`[dry-run] would replace ${table} with ${rows.length} rows`); return }
  const clearCol = table === 'bs_ev_buckets' ? 'ev_bucket' : 'id'
  const { error: delError } = await supabase.from(table).delete().gte(clearCol, 0)
  if (delError) throw new Error(`${table} (clear): ${delError.message}`)
  const BATCH = 1000
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + BATCH), { onConflict: conflictCols })
    if (error) throw new Error(`${table}: ${error.message}`)
  }
  console.log(`  uploaded ${rows.length} rows to ${table}`)
}

async function main() {
  const db = new duckdb.Database(DB_PATH)
  const con = db.connect()
  await buildClassifiedView(con)

  console.log('Computing bs_joint...')
  const joint = await computeJoint(con)
  console.log(`  ${joint.length} cells`)

  console.log('Computing bs_pitch_marginal...')
  const pitchMarginal = await computePitchMarginal(con)
  console.log(`  ${pitchMarginal.length} cells`)

  console.log('Computing bs_re_marginal...')
  const reMarginal = await computeReMarginal(con)
  console.log(`  ${reMarginal.length} cells`)

  console.log('Computing RE24 (rest-of-inning)...')
  const re24 = await computeRE24(con)
  console.log(`  ${re24.split.length} split cells, ${re24.base.length} base cells`)

  console.log('Computing bs_count_leverage...')
  const countLeverage = await computeCountLeverage(con)
  console.log(`  ${countLeverage.length} cells`)

  console.log('Computing bs_zone_sample...')
  const zoneSample = await computeZoneSample(con)
  console.log(`  ${zoneSample.length} cells`)

  console.log('Computing bs_ev_buckets...')
  const evBuckets = await computeEvBuckets(con)
  console.log(`  ${evBuckets.length} buckets:`, evBuckets.map(b=>`${b.mph_min}-${b.mph_max}`).join(', '))

  console.log('Computing bs_batted_ball_outcome...')
  const battedOutcome = await computeBattedBallOutcome(con)
  console.log(`  ${battedOutcome.length} cells`)

  console.log('Computing bs_batted_ball_re...')
  const battedRE = await computeBattedBallRE(con)
  console.log(`  ${battedRE.length} cells`)

  console.log('Computing bs_sequence...')
  const sequences = await computeSequences(con)
  console.log(`  ${sequences.length} cells`)

  con.close()

  if (DRY_RUN) {
    console.log('\n--dry-run: skipping Supabase upload. Sample rows:')
    console.log('joint[0]:', joint[0])
    console.log('pitchMarginal[0]:', pitchMarginal[0])
    console.log('reMarginal[0]:', reMarginal[0])
    console.log('re24.split[0]:', re24.split[0])
    console.log('re24.base[0]:', re24.base[0])
    console.log('countLeverage[0]:', countLeverage[0])
    console.log('zoneSample[0]:', zoneSample[0])
    console.log('evBuckets:', evBuckets)
    console.log('battedOutcome[0]:', battedOutcome[0])
    console.log('battedRE[0]:', battedRE[0])
    console.log('sequences[0]:', sequences[0])
    const topByN = [...sequences].sort((a,b)=>b.n_total-a.n_total).slice(0,3)
    console.log('top 3 by n_total:', topByN)
    return
  }

  loadEnv()
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

  console.log('\nUploading to Supabase...')
  await upsert(supabase, 'bs_joint', joint, 'p_throws,bats,pitch_type_group,count_bucket,outs_when_up,base_state')
  await upsert(supabase, 'bs_pitch_marginal', pitchMarginal, 'p_throws,bats,pitch_type_group,count_bucket')
  await upsert(supabase, 'bs_re_marginal', reMarginal, 'outs_when_up,base_state,count_bucket')
  await upsert(supabase, 'bs_re24_split', re24.split, 'p_throws,bats,outs_when_up,base_state')
  await upsert(supabase, 'bs_re24_base', re24.base, 'outs_when_up,base_state')
  await upsert(supabase, 'bs_count_leverage', countLeverage, 'count_bucket')
  await upsert(supabase, 'bs_zone_sample', zoneSample, 'p_throws,bats,pitch_type_group,count_bucket,outcome')
  await upsert(supabase, 'bs_ev_buckets', evBuckets, 'ev_bucket')
  await upsert(supabase, 'bs_batted_ball_outcome', battedOutcome, 'ev_bucket,launch_angle_category,direction')
  await upsert(supabase, 'bs_batted_ball_re', battedRE, 'ev_bucket,launch_angle_category,direction,outs_when_up,base_state')
  await upsert(supabase, 'bs_sequence', sequences, 'p_throws,bats,pt1,loc1,pt2,loc2')
  console.log('Done.')
}

main().catch(err => { console.error('Aggregation failed:', err); process.exit(1) })
