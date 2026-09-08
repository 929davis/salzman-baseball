// PART D upload step: reads data/pitch-sequencing/scored_pitches.csv (written by
// score_all_pitches.py) and upserts it into Supabase's pitch_sequence_scores table.
// Full recompute each run, same as aggregate-base-scenario.mjs's tables: clears the table
// first so it always matches exactly what score_all_pitches.py just computed, rather than
// accumulating a superset across re-runs.
//
// Requires SUPABASE_URL / SUPABASE_SERVICE_KEY env vars (same as aggregate-base-scenario.mjs).
// Usage: node scripts/upload_pitch_scores.mjs [--dry-run]

import duckdb from 'duckdb'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CSV_PATH = path.join(__dirname, '..', 'data', 'pitch-sequencing', 'scored_pitches.csv')
const DRY_RUN = process.argv.includes('--dry-run')

function all(con, sql) {
  return new Promise((resolve, reject) => con.all(sql, (err, rows) => err ? reject(err) : resolve(rows)))
}

async function upsert(supabase, table, rows, conflictCols) {
  if (DRY_RUN) { console.log(`[dry-run] would replace ${table} with ${rows.length} rows`); return }
  const { error: delError } = await supabase.from(table).delete().gte('id', 0)
  if (delError) throw new Error(`${table} (clear): ${delError.message}`)
  const BATCH = 1000
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + BATCH), { onConflict: conflictCols })
    if (error) throw new Error(`${table}: ${error.message}`)
  }
  console.log(`  uploaded ${rows.length} rows to ${table}`)
}

async function main() {
  const db = new duckdb.Database(':memory:')
  const con = db.connect()
  const rows = await all(con, `select * from read_csv_auto('${CSV_PATH.replace(/'/g, "''")}', header=true)`)
  console.log(`Read ${rows.length} rows from ${CSV_PATH}`)

  const cleaned = rows.map(r => ({
    game_pk: r.game_pk, game_date: r.game_date, at_bat_index: r.at_bat_index, pitch_num_in_pa: r.pitch_num_in_pa,
    pitcher_id: r.pitcher_id, pitcher_name: r.pitcher_name, batter_id: r.batter_id, batter_name: r.batter_name,
    batter_side: r.batter_side, pitch_type: r.pitch_type, pitch_type_desc: r.pitch_type_desc,
    start_speed: r.start_speed, balls_before: r.balls_before, strikes_before: r.strikes_before,
    call_description: r.call_description, is_swing: !!r.is_swing, is_whiff: !!r.is_whiff,
    stage1_swing_prob: r.stage1_swing_prob, stage1_whiff_prob: r.stage1_whiff_prob,
    stage2_swing_prob: r.stage2_swing_prob ?? null, stage2_whiff_prob: r.stage2_whiff_prob ?? null,
    swing_lift: r.swing_lift ?? null, whiff_lift: r.whiff_lift ?? null,
    top_shap_feature: r.top_shap_feature, insight_text: r.insight_text,
    post_decision_break: r.post_decision_break,
    decision_point_zone_mismatch: !!r.decision_point_zone_mismatch,
    within_pa_expectation_deviation: r.within_pa_expectation_deviation ?? null,
    release_deviation_from_own_baseline_ft: r.release_deviation_from_own_baseline_ft ?? null,
    batter_intercept_point_range: r.batter_intercept_point_range ?? null,
  }))

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  await upsert(supabase, 'pitch_sequence_scores', cleaned, 'game_pk,at_bat_index,pitch_num_in_pa')
  console.log('Done.')
}

main().catch(err => { console.error(err); process.exit(1) })
