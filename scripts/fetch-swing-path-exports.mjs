// Downloads the Baseball Savant Swing Path / Attack Angle leaderboard exports that
// build-batter-swing-profiles.mjs merges into the batter timing profile -- with an EXPLICIT,
// RECORDED date window, so the profile can be rebuilt leakage-free (only games before the first
// game Timing IQ is trained on) and so nobody has to guess later which filters were used.
//
// Why this exists: the original six CSVs in data/swing-path/ were exported by hand on
// 2026-09-07 with filter settings that were never written down. The audit could not reproduce
// them from any single pitch type or group (see audit/timing-iq-audit.md §9), and because they
// were exported after the games in the dataset, they contained swings from the holdout games.
//
// Pitch-type groups are Savant's own (read from the leaderboard page's group checkboxes):
//   Fastball = FF SI FC;  Breaking = CU SL ST SV KN;  Offspeed = CH FS FO SC
// The two batting-stance files (LHH_STANCE / RHH_STANCE) are NOT fetched here: they come from a
// different leaderboard, are not model features, and the old files are kept as-is.
//
// Usage: node scripts/fetch-swing-path-exports.mjs --end 2026-08-30 [--start 2026-03-01]
// Writes data/swing-path/{LHH,RHH}_{FASTBALLS,BREAKING,OFFSPEED}.csv and export_manifest.json.
// Back up data/swing-path/ first if you want the previous files.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.join(__dirname, '..', 'data', 'swing-path')

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true'])
  return acc
}, []))
const START = args.start || '2026-03-01' // before any 2026 regular-season game; gameType=R excludes spring training
const END = args.end
if (!END || !/^\d{4}-\d{2}-\d{2}$/.test(END)) {
  console.error('Usage: node scripts/fetch-swing-path-exports.mjs --end YYYY-MM-DD [--start YYYY-MM-DD]')
  process.exit(1)
}

const GROUPS = {
  FASTBALLS: ['FF', 'SI', 'FC'],
  BREAKING: ['CU', 'SL', 'ST', 'SV', 'KN'],
  OFFSPEED: ['CH', 'FS', 'FO', 'SC'],
}
const SIDES = { LHH: 'L', RHH: 'R' }
const DELAY_MS = 1500

function url(side, types) {
  const p = new URLSearchParams({
    attackZone: '', contactType: '', count: '', gameType: 'R', isHardHit: '',
    minSwings: 'q', minGroupSwings: '1', pitchHand: '',
    seasonStart: END.slice(0, 4), seasonEnd: END.slice(0, 4), team: '', type: 'batter', csv: 'true',
    batSide: side, dateStart: START, dateEnd: END,
  })
  // Savant expects the pitch types pipe-joined and URL-encoded
  return `https://baseballsavant.mlb.com/leaderboard/bat-tracking/swing-path-attack-angle?${p.toString()}&pitchType=${types.join('%7C')}`
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const manifest = { fetched_at: new Date().toISOString(), date_start: START, date_end: END, game_type: 'R', min_swings: 'q', groups: GROUPS, files: {} }
  for (const [sideName, side] of Object.entries(SIDES)) {
    for (const [groupName, types] of Object.entries(GROUPS)) {
      const u = url(side, types)
      const res = await fetch(u)
      if (!res.ok) throw new Error(`${sideName} ${groupName}: HTTP ${res.status}`)
      const text = await res.text()
      const lines = text.split('\n').filter(Boolean)
      if (!lines[0] || !lines[0].includes('avg_intercept_y_vs_plate')) throw new Error(`${sideName} ${groupName}: unexpected response (not the swing-path CSV): ${lines[0]?.slice(0, 120)}`)
      const file = `${sideName}_${groupName}.csv`
      fs.writeFileSync(path.join(OUT_DIR, file), text)
      manifest.files[file] = { rows: lines.length - 1, url: u }
      console.log(`${file}: ${lines.length - 1} hitters`)
      await sleep(DELAY_MS)
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, 'export_manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`Wrote ${path.join(OUT_DIR, 'export_manifest.json')} (window ${START} .. ${END}, regular season, qualified hitters)`)
}

main().catch(err => { console.error(err); process.exit(1) })
