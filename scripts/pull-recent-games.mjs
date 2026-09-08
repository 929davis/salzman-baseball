// Bulk data pull for Part C model training: loops the public MLB schedule endpoint over a
// range of recent completed dates, pulls every finished game each day, and writes each
// game's pitch-level CSV the same way build-game-pitch-features.mjs does (so
// build-pitcher-baselines.mjs and the Part C training script both pick them all up
// automatically -- no separate wiring needed).
//
// Skips any gamePk that already has a CSV in data/pitch-sequencing/, so it's safe to re-run
// to extend the date range without re-pulling games you already have.
//
// Usage: node scripts/pull-recent-games.mjs <start-date> <end-date>   (YYYY-MM-DD, inclusive)
// Example: node scripts/pull-recent-games.mjs 2026-08-31 2026-09-06

import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { extractGamePitches, loadBatterProfiles, toCsv } from './lib/extractGamePitches.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '..', 'data', 'pitch-sequencing')
const BATTER_PROFILE_PATH = path.join(__dirname, '..', 'data', 'swing-path', 'batter_profiles.csv')

const [, , startArg, endArg] = process.argv
if (!startArg || !endArg) {
  console.error('Usage: node scripts/pull-recent-games.mjs <start-date> <end-date>  (YYYY-MM-DD)')
  process.exit(1)
}

function dateRange(start, end) {
  const dates = []
  let d = new Date(start + 'T00:00:00Z')
  const last = new Date(end + 'T00:00:00Z')
  while (d <= last) {
    dates.push(d.toISOString().slice(0, 10))
    d = new Date(d.getTime() + 86400000)
  }
  return dates
}

async function getCompletedGamePks(date) {
  const res = await fetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${date}`)
  if (!res.ok) throw new Error(`Schedule fetch failed for ${date}: ${res.status}`)
  const data = await res.json()
  const games = (data.dates || []).flatMap(d => d.games || [])
  return games
    .filter(g => g.status?.abstractGameState === 'Final')
    .map(g => ({ gamePk: g.gamePk, teams: `${g.teams?.away?.team?.name} @ ${g.teams?.home?.team?.name}`, date }))
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const batterProfiles = loadBatterProfiles(BATTER_PROFILE_PATH)
  const dates = dateRange(startArg, endArg)

  console.log(`Checking schedule for ${dates.length} date(s): ${startArg} .. ${endArg}`)
  const allGames = []
  for (const date of dates) {
    const games = await getCompletedGamePks(date)
    allGames.push(...games)
    console.log(`  ${date}: ${games.length} completed games`)
  }
  console.log(`\nTotal completed games in range: ${allGames.length}`)

  let pulled = 0, skipped = 0, failed = 0, totalPitches = 0
  for (const { gamePk, teams, date } of allGames) {
    const outPath = path.join(OUT_DIR, `game_${gamePk}_pitches.csv`)
    if (fs.existsSync(outPath)) { skipped++; continue }
    try {
      const { rows, playCount } = await extractGamePitches(gamePk, batterProfiles)
      if (playCount === 0) { console.log(`  [${date}] ${teams} (gamePk ${gamePk}): 0 plays, skipping`); continue }
      fs.writeFileSync(outPath, toCsv(rows))
      pulled++
      totalPitches += rows.length
      console.log(`  [${date}] ${teams} (gamePk ${gamePk}): ${rows.length} pitches`)
    } catch (err) {
      failed++
      console.log(`  [${date}] ${teams} (gamePk ${gamePk}): FAILED -- ${err.message}`)
    }
  }

  console.log(`\nPulled ${pulled} new games (${totalPitches} pitches), skipped ${skipped} already on disk, ${failed} failed`)
  console.log(`Run scripts/build-pitcher-baselines.mjs next to re-aggregate baselines across everything now in data/pitch-sequencing/`)
}

main().catch(err => { console.error(err); process.exit(1) })
