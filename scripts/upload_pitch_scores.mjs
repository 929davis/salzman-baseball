// PART D upload step: reads data/pitch-sequencing/scored_pitches.csv (written by
// score_all_pitches.py), runs sanity checks, and loads it into Supabase's pitch_sequence_scores
// table -- the table Timing IQ reads.
//
// Safe to re-run: rows are UPSERTED on the table's unique key (game_pk, at_bat_index,
// pitch_num_in_pa), so a re-run overwrites in place instead of duplicating, and any live row
// whose key is no longer in the CSV is deleted afterwards. The table is never emptied first, so
// a failure mid-upload leaves it fully populated (a mix of old and new rows) rather than empty.
//
// Refuses to upload (and leaves the live table untouched) if any check fails:
//   - zero rows, or a row count that moved more than 20% from the live table (pass
//     --allow-count-change if the dataset legitimately grew or shrank)
//   - any null Stage 1 probability; any probability outside [0, 1]
//   - a Stage 2 probability missing on a pitch >= 2, or present on a first pitch
//   - a duplicate pitch key
//
// Requires SUPABASE_URL / SUPABASE_SERVICE_KEY (and NEXT_PUBLIC_SUPABASE_URL/ANON_KEY for the
// read-back check). Usage:
//   node --env-file=.env.local scripts/upload_pitch_scores.mjs [--dry-run] [--allow-count-change]

import duckdb from 'duckdb'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CSV_PATH = path.join(__dirname, '..', 'data', 'pitch-sequencing', 'scored_pitches.csv')
const DRY_RUN = process.argv.includes('--dry-run')
const ALLOW_COUNT_CHANGE = process.argv.includes('--allow-count-change')
const TABLE = 'pitch_sequence_scores'
const KEY = ['game_pk', 'at_bat_index', 'pitch_num_in_pa']
const BATCH = 1000

function all(con, sql) {
  return new Promise((resolve, reject) => con.all(sql, (err, rows) => err ? reject(err) : resolve(rows)))
}
const keyOf = r => `${r.game_pk}|${r.at_bat_index}|${r.pitch_num_in_pa}`
const num = v => (v == null || v === '' ? null : Number(v))

function sanityCheck(rows, liveCount) {
  const problems = []
  if (rows.length === 0) problems.push('CSV has zero rows')
  if (liveCount > 0 && !ALLOW_COUNT_CHANGE) {
    const ratio = rows.length / liveCount
    if (ratio < 0.8 || ratio > 1.2) problems.push(`row count ${rows.length} is more than 20% away from the live table's ${liveCount} (pass --allow-count-change if this is intended)`)
  }
  const probCols = ['stage1_swing_prob', 'stage1_whiff_prob', 'stage2_swing_prob', 'stage2_whiff_prob']
  const seen = new Set()
  let nullStage1 = 0, outOfRange = 0, stage2Missing = 0, stage2OnFirst = 0, dupes = 0
  for (const r of rows) {
    if (r.stage1_swing_prob == null || r.stage1_whiff_prob == null || Number.isNaN(r.stage1_swing_prob) || Number.isNaN(r.stage1_whiff_prob)) nullStage1++
    for (const c of probCols) { const v = r[c]; if (v != null && (v < 0 || v > 1)) outOfRange++ }
    if (r.pitch_num_in_pa >= 2 && (r.stage2_swing_prob == null || r.stage2_whiff_prob == null)) stage2Missing++
    if (r.pitch_num_in_pa === 1 && (r.stage2_swing_prob != null || r.stage2_whiff_prob != null)) stage2OnFirst++
    const k = keyOf(r); if (seen.has(k)) dupes++; seen.add(k)
  }
  if (nullStage1) problems.push(`${nullStage1} rows with a null Stage 1 probability`)
  if (outOfRange) problems.push(`${outOfRange} probability values outside [0, 1]`)
  if (stage2Missing) problems.push(`${stage2Missing} pitches >= 2 missing a Stage 2 probability`)
  if (stage2OnFirst) problems.push(`${stage2OnFirst} first pitches carry a Stage 2 probability`)
  if (dupes) problems.push(`${dupes} duplicate pitch keys`)
  return problems
}

async function fetchLiveKeys(supabase) {
  const keys = new Map() // key -> id
  for (let from = 0; ; from += BATCH) {
    const { data, error } = await supabase.from(TABLE).select('id,game_pk,at_bat_index,pitch_num_in_pa').order('id', { ascending: true }).range(from, from + BATCH - 1)
    if (error) throw new Error(`${TABLE} (read keys): ${error.message}`)
    for (const r of data) keys.set(keyOf(r), r.id)
    if (data.length < BATCH) break
  }
  return keys
}

async function main() {
  const db = new duckdb.Database(':memory:')
  const con = db.connect()
  const raw = await all(con, `select * from read_csv_auto('${CSV_PATH.replace(/'/g, "''")}', header=true)`)
  console.log(`Read ${raw.length} rows from ${CSV_PATH}`)

  const rows = raw.map(r => ({
    game_pk: Number(r.game_pk), game_date: r.game_date, away_team: r.away_team, home_team: r.home_team,
    inning: num(r.inning), half_inning: r.half_inning,
    at_bat_index: Number(r.at_bat_index), pitch_num_in_pa: Number(r.pitch_num_in_pa),
    pitcher_id: num(r.pitcher_id), pitcher_name: r.pitcher_name, batter_id: num(r.batter_id), batter_name: r.batter_name,
    batter_side: r.batter_side, pitch_type: r.pitch_type, pitch_type_desc: r.pitch_type_desc,
    start_speed: num(r.start_speed), balls_before: num(r.balls_before), strikes_before: num(r.strikes_before),
    call_description: r.call_description, is_swing: !!r.is_swing, is_whiff: !!r.is_whiff,
    stage1_swing_prob: num(r.stage1_swing_prob), stage1_whiff_prob: num(r.stage1_whiff_prob),
    stage2_swing_prob: num(r.stage2_swing_prob), stage2_whiff_prob: num(r.stage2_whiff_prob),
    swing_lift: num(r.swing_lift), whiff_lift: num(r.whiff_lift), primary_metric: r.primary_metric,
    top_shap_feature: r.top_shap_feature, insight_text: r.insight_text,
    post_decision_break: num(r.post_decision_break),
    decision_point_zone_mismatch: !!r.decision_point_zone_mismatch,
    within_pa_expectation_deviation: num(r.within_pa_expectation_deviation),
    release_deviation_from_own_baseline_ft: num(r.release_deviation_from_own_baseline_ft),
    batter_intercept_point_range: num(r.batter_intercept_point_range),
  }))

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY not set (run with node --env-file=.env.local)')
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  const { count: liveCount, error: countErr } = await supabase.from(TABLE).select('*', { count: 'exact', head: true })
  if (countErr) throw new Error(`${TABLE} (count): ${countErr.message}`)
  console.log(`Live table currently has ${liveCount} rows`)

  const problems = sanityCheck(rows, liveCount ?? 0)
  if (problems.length) {
    console.error('SANITY CHECKS FAILED -- live table left untouched:')
    for (const p of problems) console.error(`  - ${p}`)
    process.exit(1)
  }
  console.log('Sanity checks passed: row count, no null Stage 1, probabilities in [0,1], Stage 2 coverage, unique keys')

  if (DRY_RUN) { console.log(`[dry-run] would upsert ${rows.length} rows into ${TABLE} and delete any live rows not in the CSV`); return }

  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase.from(TABLE).upsert(rows.slice(i, i + BATCH), { onConflict: KEY.join(',') })
    if (error) throw new Error(`${TABLE} (upsert batch ${i / BATCH}): ${error.message}`)
  }
  console.log(`  upserted ${rows.length} rows`)

  const newKeys = new Set(rows.map(keyOf))
  const liveKeys = await fetchLiveKeys(supabase)
  const staleIds = [...liveKeys].filter(([k]) => !newKeys.has(k)).map(([, id]) => id)
  for (let i = 0; i < staleIds.length; i += BATCH) {
    const { error } = await supabase.from(TABLE).delete().in('id', staleIds.slice(i, i + BATCH))
    if (error) throw new Error(`${TABLE} (delete stale): ${error.message}`)
  }
  console.log(`  deleted ${staleIds.length} stale rows (keys no longer in the CSV)`)

  const { count: finalCount, error: finalErr } = await supabase.from(TABLE).select('*', { count: 'exact', head: true })
  if (finalErr) throw new Error(`${TABLE} (final count): ${finalErr.message}`)
  if (finalCount !== rows.length) throw new Error(`POST-UPLOAD CHECK FAILED: live table has ${finalCount} rows, CSV has ${rows.length}`)
  console.log(`  verified: live table has ${finalCount} rows (matches CSV)`)

  await checkAnonReadable(rows.length)
  console.log('Done.')
}

// Guards against the exact bug this table hit once already: a table created via the SQL
// editor with RLS on and no read policy uploads fine (the service key bypasses RLS) but the
// deployed app -- which reads with the anon key, same as createClient() in lib/supabase/client.ts
// -- silently sees zero rows, with no error anywhere. Catch that HERE, at upload time.
async function checkAnonReadable(expectedCount) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn('  [skip] NEXT_PUBLIC_SUPABASE_URL/ANON_KEY not set -- cannot verify anon-key readability (RLS) from this shell')
    return
  }
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const { count, error } = await anon.from(TABLE).select('*', { count: 'exact', head: true })
  if (error) throw new Error(`Anon-key readability check failed: ${error.message}`)
  if (count !== expectedCount) {
    throw new Error(
      `RLS CHECK FAILED: anon key sees ${count} rows but ${expectedCount} were just uploaded. ` +
      `The app reads this table with the anon key -- it will show empty/stale data even though the upload "succeeded". ` +
      `Add a read policy, e.g.: alter table ${TABLE} enable row level security; ` +
      `create policy "public read" on ${TABLE} for select using (true);`
    )
  }
  console.log(`  verified: anon key sees all ${count} rows (RLS OK)`)
}

main().catch(err => { console.error(err); process.exit(1) })
