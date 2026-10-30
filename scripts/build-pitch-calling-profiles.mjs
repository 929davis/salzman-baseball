// Builds pc_hitter_profiles and pc_pitcher_arsenal (sql/pitch_calling_profiles.sql) for the
// Pitch Calling tool. Three real sources, merged:
//   1. Baseball Savant's Bat Tracking / Swing Path leaderboard (hitter swing profiles) --
//      fetched fresh, CSV export, no auth needed.
//   2. Baseball Savant's Pitch Arsenal leaderboard (per-pitch-type usage%/whiff%/K%/
//      run-value/hard-hit%) -- same, fetched fresh.
//   3. OUR OWN live `statcast_pitches` Supabase table for avg_speed/avg_pfx_x/avg_pfx_z --
//      already real, already-ingested movement data covering the full league (verified: its
//      row count for the 2026 first half matches the local DuckDB pull 1:1), so no new
//      backfill is needed for pitch movement.
//
// Pulls broadly (not just the approved 30 hitters / 30 pitchers) so "any player" search
// works from day one off the same table -- though #1's leaderboard only returns hitters with
// enough competitive swings to qualify (~200 players), which is this version's real,
// documented scope limit for "any" hitter, not literal league-wide coverage.
//
// Usage: node scripts/build-pitch-calling-profiles.mjs [--dry-run]

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DRY_RUN = process.argv.includes('--dry-run')
const YEAR = 2026

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  const text = fs.readFileSync(envPath, 'utf8')
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) process.env[m[1]] = process.env[m[1]] || m[2]
  }
}

// Quote-aware CSV line splitter -- used for BOTH the header and data rows. The header row
// itself has a quoted field containing a comma ("last_name, first_name"), so a naive
// `.split(',')` on just the header silently misaligns every column after it.
function splitCsvLine(line) {
  const cells = []
  let cur = '', inQuotes = false
  for (const ch of line) {
    if (inQuotes) {
      if (ch === '"') inQuotes = false
      else cur += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { cells.push(cur); cur = '' }
      else cur += ch
    }
  }
  cells.push(cur)
  return cells
}

function parseCsv(text) {
  const lines = text.trim().split('\n')
  const headers = splitCsvLine(lines[0]).map(h => h.trim().replace(/^﻿/, ''))
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const cells = splitCsvLine(lines[i])
    const row = {}
    headers.forEach((h, idx) => { row[h] = cells[idx] ?? '' })
    rows.push(row)
  }
  return rows
}

async function fetchCsv(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'salzman-baseball-app/1.0' }, signal: AbortSignal.timeout(55000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return parseCsv(await res.text())
}

const num = v => { const n = parseFloat(v); return Number.isNaN(n) ? null : n }
const int = v => { const n = parseInt(v, 10); return Number.isNaN(n) ? null : n }

async function fetchHitterSwingProfiles() {
  const url = `https://baseballsavant.mlb.com/leaderboard/bat-tracking/swing-path-attack-angle?year=${YEAR}&csv=true`
  const rows = await fetchCsv(url)
  return rows.map(r => ({
    savant_id: int(r.id),
    name: r.name,
    side: r.side || null,
    avg_bat_speed: num(r.avg_bat_speed),
    swing_tilt: num(r.swing_tilt),
    attack_angle: num(r.attack_angle),
    attack_direction: num(r.attack_direction),
    ideal_attack_angle_rate: num(r.ideal_attack_angle_rate),
    competitive_swings: int(r.competitive_swings),
  })).filter(r => r.savant_id != null)
}

async function fetchPitcherArsenalOutcomes() {
  const url = `https://baseballsavant.mlb.com/leaderboard/pitch-arsenal-stats?type=pitcher&pitchType=&year=${YEAR}&min=1&csv=true`
  const rows = await fetchCsv(url)
  return rows.map(r => ({
    savant_id: int(r.player_id),
    name: r['last_name, first_name'],
    pitch_type: r.pitch_type,
    pitch_name: r.pitch_name || null,
    usage_pct: num(r.pitch_usage),
    whiff_percent: num(r.whiff_percent),
    k_percent: num(r.k_percent),
    put_away: num(r.put_away),
    run_value_per_100: num(r.run_value_per_100),
    hard_hit_percent: num(r.hard_hit_percent),
    est_woba: num(r.est_woba),
  })).filter(r => r.savant_id != null && r.pitch_type)
}

// Paginates through the full live statcast_pitches table (already covers the full 2026 first
// half league-wide -- verified row count matches the local DuckDB pull exactly) and averages
// release_speed/pfx_x/pfx_z per (pitcher_id, pitch_type). Real movement data, no new backfill.
async function fetchMovementFromStatcastPitches(supabase) {
  const PAGE = 1000
  const agg = new Map() // key `${pitcher_id}|${pitch_type}` -> {n, speedSum, nx, pfxXSum, nz, pfxZSum}
  let from = 0
  while (true) {
    const { data, error } = await supabase.from('statcast_pitches')
      .select('pitcher_id,pitch_type,release_speed,pfx_x,pfx_z')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`statcast_pitches page @${from}: ${error.message}`)
    for (const r of data) {
      if (!r.pitch_type || r.pitcher_id == null) continue
      const key = `${r.pitcher_id}|${r.pitch_type}`
      let a = agg.get(key)
      if (!a) { a = { n: 0, speedSum: 0, nSpeed: 0, nx: 0, pfxXSum: 0, nz: 0, pfxZSum: 0 }; agg.set(key, a) }
      a.n++
      if (r.release_speed != null) { a.speedSum += r.release_speed; a.nSpeed++ }
      if (r.pfx_x != null) { a.pfxXSum += r.pfx_x; a.nx++ }
      if (r.pfx_z != null) { a.pfxZSum += r.pfx_z; a.nz++ }
    }
    if (data.length < PAGE) break
    from += PAGE
    if (from % 50000 === 0) console.log(`  ...${from} rows scanned`)
  }
  const out = new Map()
  for (const [key, a] of agg) {
    const [pitcherId, pitchType] = key.split('|')
    out.set(key, {
      pitcher_id: Number(pitcherId), pitch_type: pitchType, pitch_count: a.n,
      avg_speed: a.nSpeed > 0 ? a.speedSum / a.nSpeed : null,
      avg_pfx_x: a.nx > 0 ? a.pfxXSum / a.nx : null,
      avg_pfx_z: a.nz > 0 ? a.pfxZSum / a.nz : null,
    })
  }
  return out
}

async function upsert(supabase, table, rows, conflictCols) {
  if (DRY_RUN) { console.log(`[dry-run] would replace ${table} with ${rows.length} rows`); return }
  const { error: delError } = await supabase.from(table).delete().neq('savant_id', -1)
  if (delError && table === 'pc_hitter_profiles') throw new Error(`${table} (clear): ${delError.message}`)
  if (table === 'pc_pitcher_arsenal') {
    const { error } = await supabase.from(table).delete().eq('source', 'savant')
    if (error) throw new Error(`${table} (clear savant rows): ${error.message}`)
  }
  const BATCH = 500
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + BATCH), { onConflict: conflictCols })
    if (error) throw new Error(`${table}: ${error.message}`)
  }
  console.log(`  uploaded ${rows.length} rows to ${table}`)
}

async function main() {
  console.log('Fetching hitter swing profiles from Savant...')
  const hitters = await fetchHitterSwingProfiles()
  console.log(`  ${hitters.length} hitters`)

  console.log('Fetching pitcher arsenal outcomes from Savant...')
  const arsenalOutcomes = await fetchPitcherArsenalOutcomes()
  console.log(`  ${arsenalOutcomes.length} pitcher/pitch-type rows`)

  loadEnv()
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

  console.log('Aggregating real movement/velocity from statcast_pitches (full league)...')
  const movement = await fetchMovementFromStatcastPitches(supabase)
  console.log(`  ${movement.size} pitcher/pitch-type movement cells`)

  const pitcherArsenal = arsenalOutcomes.map(r => {
    const m = movement.get(`${r.savant_id}|${r.pitch_type}`)
    return {
      ...r,
      avg_speed: m?.avg_speed ?? null,
      avg_pfx_x: m?.avg_pfx_x ?? null,
      avg_pfx_z: m?.avg_pfx_z ?? null,
      pitch_count: m?.pitch_count ?? null,
      source: 'savant',
    }
  })
  const missingMovement = pitcherArsenal.filter(r => r.avg_speed == null).length
  console.log(`  ${missingMovement} of ${pitcherArsenal.length} arsenal rows have no matching movement data (pitcher/pitch-type not in statcast_pitches)`)

  if (DRY_RUN) {
    console.log('\n--dry-run: sample rows')
    console.log('hitter sample:', hitters[0])
    console.log('arsenal sample:', pitcherArsenal.find(r => r.avg_speed != null))
    return
  }

  console.log('\nUploading to Supabase...')
  await upsert(supabase, 'pc_hitter_profiles', hitters, 'savant_id')
  await upsert(supabase, 'pc_pitcher_arsenal', pitcherArsenal, 'savant_id,pitch_type,source')
  console.log('Done.')
}

main().catch(err => { console.error('Build failed:', err); process.exit(1) })
