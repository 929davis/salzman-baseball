// PART B1-B3, B5 (Pitch Sequencing & Timing-Adjustment Model): pulls every pitch from one
// game via the public MLB Stats API live feed, flattens it into one row per pitch, computes
// the pre-decision-point physics features (B2), the sequence-within-PA features (B3), and
// joins Part A's batter timing-adjustment profile onto each pitch by batter_id (B5).
// Extraction logic lives in scripts/lib/extractGamePitches.mjs, shared with
// pull-recent-games.mjs (bulk puller across many games).
//
// Usage: node scripts/build-game-pitch-features.mjs [gamePk]
// Defaults to 823253 (Yankees @ Padres, 2026-09-06 -- confirmed real earlier this session).

import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { extractGamePitches, loadBatterProfiles, toCsv } from './lib/extractGamePitches.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '..', 'data', 'pitch-sequencing')
const BATTER_PROFILE_PATH = path.join(__dirname, '..', 'data', 'swing-path', 'batter_profiles.csv')
const GAME_PK = process.argv[2] || '823253'

async function main() {
  const batterProfiles = loadBatterProfiles(BATTER_PROFILE_PATH)
  const { rows, playCount } = await extractGamePitches(GAME_PK, batterProfiles)
  if (playCount === 0) throw new Error('No plays found -- check gamePk / that the game has completed')

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const outPath = path.join(OUT_DIR, `game_${GAME_PK}_pitches.csv`)
  fs.writeFileSync(outPath, toCsv(rows))

  console.log(`\nGame ${GAME_PK}: ${playCount} plate appearances, ${rows.length} pitches with usable coordinate data`)
  console.log(`Wrote ${outPath}`)

  const mismatches = rows.filter(r => r.decision_point_zone_mismatch)
  console.log(`\ndecision_point_zone_mismatch = true on ${mismatches.length}/${rows.length} pitches (${(100 * mismatches.length / rows.length).toFixed(1)}%)`)
  console.log(`avg post_decision_break: ${(rows.reduce((s, r) => s + r.post_decision_break, 0) / rows.length).toFixed(3)} ft`)

  const withProfile = rows.filter(r => r.batter_intercept_point_range != null)
  console.log(`\nB5 join: ${withProfile.length}/${rows.length} pitches matched to a Part A batter profile`)

  console.log(`\nSample rows (first PA):`)
  for (const r of rows.filter(r => r.at_bat_index === rows[0].at_bat_index)) {
    console.log(`  pitch ${r.pitch_num_in_pa} (${r.pitch_type}, ${r.start_speed}mph): post_decision_break=${r.post_decision_break.toFixed(2)}ft  tunnel_dist=${fmt(r.tunnel_distance_from_prior_pitch)}ft  types_seen=${r.pitch_types_seen_this_pa}  new_type=${r.pitch_type_is_new_this_pa}  loc_deviation=${fmt(r.within_pa_expectation_deviation)}ft  call=${r.call_description}`)
  }

  // A concrete, checkable claim the whole sequencing premise rests on: does an at-bat's
  // LAST pitch (the one that produced the outcome) show a bigger location jump from what
  // the hitter had already seen this PA than a random mid-PA pitch does? If sequencing
  // matters at all, PA-ending pitches should deviate more on average, not the same or less.
  const paGroups = new Map()
  for (const r of rows) {
    if (!paGroups.has(r.at_bat_index)) paGroups.set(r.at_bat_index, [])
    paGroups.get(r.at_bat_index).push(r)
  }
  const lastPitchDeviations = [], midPitchDeviations = []
  for (const paRows of paGroups.values()) {
    paRows.forEach((r, i) => {
      if (r.within_pa_expectation_deviation == null) return
      if (i === paRows.length - 1) lastPitchDeviations.push(r.within_pa_expectation_deviation)
      else if (i > 0) midPitchDeviations.push(r.within_pa_expectation_deviation)
    })
  }
  const avg = arr => arr.reduce((s, v) => s + v, 0) / arr.length
  console.log(`\nPA-ending pitch avg location deviation from what the hitter had already seen: ${avg(lastPitchDeviations).toFixed(3)}ft (n=${lastPitchDeviations.length})`)
  console.log(`Mid-PA pitch avg location deviation (same basis, excludes each PA's 1st pitch): ${avg(midPitchDeviations).toFixed(3)}ft (n=${midPitchDeviations.length})`)
}

function fmt(v) { return v == null ? 'n/a' : Number(v).toFixed(2) }

main().catch(err => { console.error(err); process.exit(1) })
