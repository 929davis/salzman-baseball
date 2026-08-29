// One-time/resumable local backfill of full-season Statcast pitch data into a local
// DuckDB file (Parquet-backed on export) — per Base Scenario Tool spec §2.
//
// This deliberately does NOT touch the Supabase `statcast_pitches` table or the daily
// cron's data. It pulls ALL pitch events (balls, called strikes, everything — not just
// the swing/contact subset the existing cron filters to) into a separate local store,
// which a later script aggregates into the joint/marginal tables for Supabase.
//
// Usage:
//   node scripts/backfill-statcast.mjs --start 2026-03-26 --end 2026-08-27
//
// Resumable: tracks which dates have already been fetched in a `fetched_dates` table,
// so re-running after an interruption skips completed days instead of re-fetching.

import duckdb from 'duckdb'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', 'data', 'statcast_2026.duckdb')
const DELAY_MS = 1200 // politeness delay between requests to Savant

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, arg, i, arr) => {
    if (arg.startsWith('--')) acc.push([arg.slice(2), arr[i + 1]])
    return acc
  }, [])
)
// NOTE: 2026 Opening Day is not independently verified here — pass --start explicitly
// if this default is wrong for the actual 2026 schedule.
const START = args.start || '2026-03-26'
const END = args.end || new Date().toISOString().split('T')[0]

const COLUMNS = [
  ['game_date', 'DATE'], ['game_pk', 'BIGINT'], ['at_bat_number', 'INTEGER'], ['pitch_number', 'INTEGER'],
  ['player_name', 'VARCHAR'], ['pitcher_id', 'BIGINT'],
  ['p_throws', 'VARCHAR'], ['bats', 'VARCHAR'],
  ['pitch_type', 'VARCHAR'], ['release_speed', 'DOUBLE'], ['release_spin_rate', 'DOUBLE'],
  ['plate_x', 'DOUBLE'], ['plate_z', 'DOUBLE'], ['sz_top', 'DOUBLE'], ['sz_bot', 'DOUBLE'],
  ['zone', 'INTEGER'],
  ['description', 'VARCHAR'], ['events', 'VARCHAR'],
  ['balls', 'INTEGER'], ['strikes', 'INTEGER'], ['outs_when_up', 'INTEGER'],
  ['inning', 'INTEGER'], ['inning_topbot', 'VARCHAR'],
  ['bat_score', 'INTEGER'], ['post_bat_score', 'INTEGER'],
  ['on_1b', 'BOOLEAN'], ['on_2b', 'BOOLEAN'], ['on_3b', 'BOOLEAN'],
  ['delta_run_exp', 'DOUBLE'], ['woba_value', 'DOUBLE'], ['woba_denom', 'DOUBLE'],
  ['launch_speed', 'DOUBLE'], ['launch_angle', 'DOUBLE'], ['bb_type', 'VARCHAR'], ['hc_x', 'DOUBLE'], ['hc_y', 'DOUBLE'],
  ['attack_direction', 'DOUBLE'],
]

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

function savantUrl(date) {
  return [
    'https://baseballsavant.mlb.com/statcast_search/csv',
    '?all=true',
    '&hfSea=2026%7C',
    `&game_date_gt=${date}`,
    `&game_date_lt=${date}`,
    '&player_type=pitcher',
    '&type=details',
    '&min_pitches=0', '&min_results=0', '&group_by=name', '&sort_col=pitches',
    '&player_event_sort=api_p_release_speed', '&sort_order=desc', '&min_pas=0',
  ].join('')
}

async function fetchDay(date, attempt = 1) {
  try {
    const res = await fetch(savantUrl(date), {
      headers: { 'User-Agent': 'salzman-baseball-app/1.0' },
      signal: AbortSignal.timeout(55000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    const idx = Object.fromEntries(headers.map((h, i) => [h, i]))
    const col = (row, name) => (idx[name] != null ? (row[idx[name]] || '').replace(/"/g, '').trim() : '')
    const num = v => { const n = parseFloat(v); return Number.isNaN(n) ? null : n }
    const int = v => { const n = parseInt(v, 10); return Number.isNaN(n) ? null : n }
    const bool = v => v.trim() !== ''

    if (lines.length - 1 >= 24000) {
      console.warn(`  WARNING: ${date} returned ${lines.length - 1} rows — close to Savant's 25,000-row truncation cap. Data may be incomplete.`)
    }

    const rows = []
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue
      const row = parseCSVLine(lines[i])
      rows.push([
        col(row, 'game_date'), int(col(row, 'game_pk')), int(col(row, 'at_bat_number')), int(col(row, 'pitch_number')),
        col(row, 'player_name'), int(col(row, 'pitcher')),
        col(row, 'p_throws'), col(row, 'stand'),
        col(row, 'pitch_type'), num(col(row, 'release_speed')), num(col(row, 'release_spin_rate')),
        num(col(row, 'plate_x')), num(col(row, 'plate_z')), num(col(row, 'sz_top')), num(col(row, 'sz_bot')),
        int(col(row, 'zone')),
        col(row, 'description'), col(row, 'events'),
        int(col(row, 'balls')) ?? 0, int(col(row, 'strikes')) ?? 0, int(col(row, 'outs_when_up')),
        int(col(row, 'inning')), col(row, 'inning_topbot'),
        int(col(row, 'bat_score')), int(col(row, 'post_bat_score')),
        bool(col(row, 'on_1b')), bool(col(row, 'on_2b')), bool(col(row, 'on_3b')),
        num(col(row, 'delta_run_exp')), num(col(row, 'woba_value')), num(col(row, 'woba_denom')),
        num(col(row, 'launch_speed')), num(col(row, 'launch_angle')), col(row, 'bb_type'), num(col(row, 'hc_x')), num(col(row, 'hc_y')),
        num(col(row, 'attack_direction')),
      ])
    }
    return rows
  } catch (err) {
    if (attempt < 3) {
      console.warn(`  ${date} failed (${err.message}), retrying (${attempt + 1}/3)...`)
      await sleep(3000)
      return fetchDay(date, attempt + 1)
    }
    throw err
  }
}

function sqlLiteral(v, type) {
  if (v === null || v === undefined || v === '') return 'NULL'
  if (type === 'BOOLEAN') return v ? 'TRUE' : 'FALSE'
  if (type === 'DATE' || type === 'VARCHAR') return `'${String(v).replace(/'/g, "''")}'`
  return String(v) // numeric types
}

function buildInsertSQL(rows) {
  const values = rows.map(r => `(${r.map((v, i) => sqlLiteral(v, COLUMNS[i][1])).join(',')})`).join(',\n')
  return `INSERT INTO pitches (${COLUMNS.map(([n]) => n).join(',')}) VALUES\n${values}`
}

function dateRange(start, end) {
  const dates = []
  const d = new Date(start + 'T00:00:00Z')
  const endD = new Date(end + 'T00:00:00Z')
  while (d <= endD) {
    dates.push(d.toISOString().split('T')[0])
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return dates
}

const sleep = ms => new Promise(r => setTimeout(r, ms))
const run = (con, sql) => new Promise((res, rej) => con.run(sql, err => err ? rej(err) : res()))
const all = (con, sql) => new Promise((res, rej) => con.all(sql, (err, rows) => err ? rej(err) : res(rows)))

async function main() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
  const db = new duckdb.Database(DB_PATH)
  const con = db.connect()

  await run(con, `CREATE TABLE IF NOT EXISTS pitches (${COLUMNS.map(([n, t]) => `${n} ${t}`).join(', ')})`)
  await run(con, `CREATE TABLE IF NOT EXISTS fetched_dates (game_date DATE PRIMARY KEY, pitch_count INTEGER)`)

  const dates = dateRange(START, END)
  console.log(`Backfilling ${dates.length} dates (${START} to ${END})...`)

  let totalFetched = 0, totalSkipped = 0
  for (const date of dates) {
    const already = await all(con, `SELECT 1 FROM fetched_dates WHERE game_date = '${date}'`)
    if (already.length) { totalSkipped++; continue }

    const rows = await fetchDay(date)
    if (rows.length) {
      await run(con, buildInsertSQL(rows))
    }
    await run(con, `INSERT INTO fetched_dates VALUES ('${date}', ${rows.length})`)
    console.log(`${date}: ${rows.length} pitches`)
    totalFetched += rows.length
    await sleep(DELAY_MS)
  }

  const [{ n }] = await all(con, `SELECT COUNT(*)::INTEGER as n FROM pitches`)
  console.log(`\nDone. ${totalSkipped} dates already done, ${totalFetched} new pitches fetched, ${n} total pitches in ${DB_PATH}.`)
  con.close()
}

main().catch(err => { console.error('Backfill failed:', err); process.exit(1) })
