// One-time backfill of the live `statcast_pitches` Supabase table (the one PitchingIQ.tsx
// queries directly) covering the full first half of the 2026 season, Opening Day through the
// All-Star break cutoff — replacing the daily cron (app/api/cron/fetch-statcast/route.ts,
// now removed) with a single frozen dataset.
//
// Mirrors the cron's exact per-day fetch/parse/row-shape logic (same Savant URL, same
// swing/contact-only hfDes filter, same column derivation) looped over a date range instead
// of "yesterday" — so PitchingIQ's zone heatmap, arm-angle bucket, and swing-path filters all
// keep working exactly as before, just against a fixed range instead of a rolling one.
//
// Resumable: tracks completed dates in a local JSON file, so a re-run after an interruption
// skips days already inserted instead of re-fetching and duplicating rows.
//
// Usage: node scripts/backfill-statcast-pitches.mjs --start 2026-03-26 --end 2026-07-13
//
// IMPORTANT: run `node scripts/clear-statcast-pitches.mjs` (or equivalent) BEFORE the first
// run of this script — it does not clear the table itself, since it's designed to be safely
// resumable/re-run without wiping progress.

import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROGRESS_PATH = path.join(__dirname, '..', 'data', 'statcast-pitches-backfill-progress.json')
const DELAY_MS = 1200 // politeness delay between requests to Savant

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const text = fs.readFileSync(envPath, 'utf8')
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) process.env[m[1]] = process.env[m[1]] || m[2]
  }
}

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, arg, i, arr) => {
    if (arg.startsWith('--')) acc.push([arg.slice(2), arr[i + 1]])
    return acc
  }, [])
)
const START = args.start || '2026-03-26'
const END = args.end || '2026-07-13'

function classifyArmAngle(angle) {
  if (angle === null || isNaN(angle)) return 'unknown'
  if (angle < 0)  return 'submarine'
  if (angle < 16) return 'sidearm'
  if (angle < 31) return 'low_three_quarter'
  if (angle < 50) return 'three_quarter'
  if (angle < 63) return 'high_three_quarter'
  return 'overhand'
}

function classifyCount(balls, strikes) {
  return `${balls}-${strikes}`
}

function parseCSVLine(line) {
  const row = []
  let inQuote = false, current = ''
  for (const ch of line) {
    if (ch === '"') inQuote = !inQuote
    else if (ch === ',' && !inQuote) { row.push(current); current = '' }
    else current += ch
  }
  row.push(current)
  return row
}

// Identical to the cron's savantUrl — same hfDes swing/contact-only filter, same 2026 season.
function savantUrl(date) {
  return [
    'https://baseballsavant.mlb.com/statcast_search/csv',
    '?all=true',
    '&hfSea=2026%7C',
    `&game_date_gt=${date}`,
    `&game_date_lt=${date}`,
    '&player_type=pitcher',
    '&hfDes=swinging_strike%7Cswinging_strike_blocked%7Cfoul%7Cfoul_tip%7Chit_into_play%7Chit_into_play_no_out%7Chit_into_play_score%7C',
    '&type=details',
    '&min_pitches=0',
    '&min_results=0',
    '&group_by=name',
    '&sort_col=pitches',
    '&player_event_sort=api_p_release_speed',
    '&sort_order=desc',
    '&min_pas=0',
  ].join('')
}

function dateRange(start, end) {
  const dates = []
  let d = new Date(start + 'T00:00:00Z')
  const endD = new Date(end + 'T00:00:00Z')
  while (d <= endD) {
    dates.push(d.toISOString().split('T')[0])
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return dates
}

function loadProgress() {
  try { return new Set(JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8'))) }
  catch { return new Set() }
}
function saveProgress(done) {
  fs.mkdirSync(path.dirname(PROGRESS_PATH), { recursive: true })
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify([...done]))
}

async function fetchDay(date, attempt = 1) {
  try {
    const res = await fetch(savantUrl(date), {
      headers: { 'User-Agent': 'salzman-baseball-app/1.0' },
      signal: AbortSignal.timeout(55000),
    })
    if (!res.ok) throw new Error(`Savant returned ${res.status}`)
    return await res.text()
  } catch (err) {
    if (attempt < 3) {
      console.log(`  retry ${date} (attempt ${attempt + 1}): ${err.message}`)
      await new Promise(r => setTimeout(r, DELAY_MS * 2))
      return fetchDay(date, attempt + 1)
    }
    throw err
  }
}

function parseRows(csvText) {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  function col(row, name) {
    const i = headers.indexOf(name)
    return i >= 0 ? (row[i] || '').replace(/"/g, '').trim() : ''
  }
  function num(val) { const n = parseFloat(val); return isNaN(n) ? null : n }
  function int(val) { const n = parseInt(val); return isNaN(n) ? null : n }

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    const row = parseCSVLine(line)
    const balls = int(col(row, 'balls')) ?? 0
    const strikes = int(col(row, 'strikes')) ?? 0
    const armAngle = num(col(row, 'arm_angle'))
    rows.push({
      game_date: col(row, 'game_date'),
      player_name: col(row, 'player_name'),
      pitcher_id: int(col(row, 'pitcher')),
      p_throws: col(row, 'p_throws'),
      bats: col(row, 'stand'),
      pitch_type: col(row, 'pitch_type'),
      release_speed: num(col(row, 'release_speed')),
      release_spin_rate: num(col(row, 'release_spin_rate')),
      pfx_x: num(col(row, 'pfx_x')),
      pfx_z: num(col(row, 'pfx_z')),
      plate_x: num(col(row, 'plate_x')),
      plate_z: num(col(row, 'plate_z')),
      zone: int(col(row, 'zone')),
      description: col(row, 'description'),
      events: col(row, 'events'),
      launch_speed: num(col(row, 'launch_speed')),
      launch_angle: num(col(row, 'launch_angle')),
      estimated_woba: num(col(row, 'estimated_woba_using_speedangle')),
      barrel: col(row, 'barrel') === '1',
      arm_angle: armAngle,
      arm_angle_bucket: classifyArmAngle(armAngle),
      balls, strikes,
      count_bucket: classifyCount(balls, strikes),
      inning: int(col(row, 'inning')),
      attack_angle: num(col(row, 'attack_angle')),
      attack_direction: num(col(row, 'attack_direction')),
    })
  }
  return rows
}

async function main() {
  loadEnv()
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  const dates = dateRange(START, END)
  const done = loadProgress()

  console.log(`Backfilling statcast_pitches: ${START} -> ${END} (${dates.length} days, ${done.size} already done)`)

  let totalInserted = 0
  for (const date of dates) {
    if (done.has(date)) continue
    process.stdout.write(`${date}... `)
    let csvText
    try {
      csvText = await fetchDay(date)
    } catch (err) {
      console.log(`FAILED (${err.message}) — will retry on next run`)
      await new Promise(r => setTimeout(r, DELAY_MS))
      continue
    }
    const rows = parseRows(csvText)
    if (rows.length > 0) {
      const BATCH = 500
      for (let i = 0; i < rows.length; i += BATCH) {
        const { error } = await supabase.from('statcast_pitches').insert(rows.slice(i, i + BATCH))
        if (error) throw new Error(`Insert failed for ${date}: ${error.message}`)
      }
      totalInserted += rows.length
    }
    console.log(`${rows.length} pitches`)
    done.add(date)
    saveProgress(done)
    await new Promise(r => setTimeout(r, DELAY_MS))
  }

  console.log(`Done. Inserted ${totalInserted} pitches across ${dates.length} days.`)
}

main().catch(err => { console.error('Backfill failed:', err); process.exit(1) })
