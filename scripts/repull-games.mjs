// Re-extracts every game already present in data/pitch-sequencing/ from the MLB Stats API,
// using the CURRENT extractor (scripts/lib/extractGamePitches.mjs) and the CURRENT batter
// profile file. Use this after the extractor gains columns (release_extension, spin_axis_deg,
// game_type) or after the batter profiles are rebuilt, so every game CSV has the same shape.
//
// Unlike pull-recent-games.mjs, this does NOT skip games that already have a CSV -- it
// overwrites them, and reports the old vs. new pitch count for each so a changed row count
// is visible instead of silent. Back up data/pitch-sequencing/ first if you want the old files.
//
// Usage: node scripts/repull-games.mjs

import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { extractGamePitches, loadBatterProfiles, toCsv } from './lib/extractGamePitches.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '..', 'data', 'pitch-sequencing')
const BATTER_PROFILE_PATH = path.join(__dirname, '..', 'data', 'swing-path', 'batter_profiles.csv')
const DELAY_MS = 400

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  const files = fs.readdirSync(OUT_DIR).filter(f => /^game_\d+_pitches\.csv$/.test(f)).sort()
  if (files.length === 0) throw new Error(`No game_*_pitches.csv files in ${OUT_DIR}`)
  const batterProfiles = loadBatterProfiles(BATTER_PROFILE_PATH)
  console.log(`Re-pulling ${files.length} games with ${batterProfiles.size} batter profiles from ${path.relative(process.cwd(), BATTER_PROFILE_PATH)}`)

  let changed = 0, totalOld = 0, totalNew = 0
  const gameTypes = new Map()
  for (const [i, file] of files.entries()) {
    const gamePk = file.match(/^game_(\d+)_/)[1]
    const outPath = path.join(OUT_DIR, file)
    const oldCount = fs.readFileSync(outPath, 'utf8').split('\n').filter(Boolean).length - 1
    const { rows, playCount } = await extractGamePitches(gamePk, batterProfiles)
    if (playCount === 0 || rows.length === 0) throw new Error(`game ${gamePk}: no plays/pitches returned -- aborting rather than overwrite a good file with an empty one`)
    fs.writeFileSync(outPath, toCsv(rows))
    const gt = rows[0].game_type
    gameTypes.set(gt, (gameTypes.get(gt) || 0) + 1)
    totalOld += oldCount; totalNew += rows.length
    const mark = rows.length === oldCount ? '' : '   <-- row count changed'
    if (rows.length !== oldCount) changed++
    console.log(`[${i + 1}/${files.length}] game ${gamePk} (${rows[0].game_date}, type ${gt}): ${oldCount} -> ${rows.length} pitches${mark}`)
    await sleep(DELAY_MS)
  }
  console.log(`\nDone. ${files.length} games, ${totalOld} -> ${totalNew} pitches, ${changed} game(s) changed row count.`)
  console.log('Game types:', Object.fromEntries(gameTypes))
  const nonRegular = [...gameTypes.keys()].filter(t => t !== 'R')
  if (nonRegular.length) console.warn(`WARNING: non-regular-season game types present: ${nonRegular.join(', ')}. The Python loader will refuse these.`)
}

main().catch(err => { console.error(err); process.exit(1) })
