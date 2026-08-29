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
// balls and offspeed grouped by family, everything rare folded into Other.
const PITCH_TYPE_GROUP_SQL = `
  CASE
    WHEN pitch_type IN ('FF','FA') THEN 'Four-Seam'
    WHEN pitch_type = 'SI' THEN 'Sinker'
    WHEN pitch_type = 'FC' THEN 'Cutter'
    WHEN pitch_type IN ('SL','ST','SV') THEN 'Slider'
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

async function upsert(supabase, table, rows, conflictCols) {
  if (DRY_RUN) { console.log(`[dry-run] would upsert ${rows.length} rows into ${table}`); return }
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
  console.log('Done.')
}

main().catch(err => { console.error('Aggregation failed:', err); process.exit(1) })
