// PART A (Pitch Sequencing & Timing-Adjustment Model): merges the 8 Baseball Savant
// Swing Path/Attack Angle leaderboard exports in data/swing-path/ into one long-format
// table, then computes a batter-level timing-adjustment profile.
//
// NOTE ON DATA GRANULARITY: the original design called for a zone split (Heart/Shadow/
// Chase) on top of pitch category, giving intercept_point_range a category x zone basis.
// Only category-level exports (Fastball/Breaking/Offspeed, no zone split) were available
// when this was built, so intercept_point_range here is computed across the 3 pitch
// categories only. Re-export zone-split CSVs from Savant's leaderboard and re-run this
// script to upgrade the granularity later — the merge/profile logic below doesn't change,
// only which files get loaded.
//
// Usage: node scripts/build-batter-swing-profiles.mjs

import duckdb from 'duckdb'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', 'data', 'swing-path')
const OUT_PATH = path.join(DATA_DIR, 'batter_profiles.csv')

const CATEGORY_FILES = {
  Fastball: { LHH: 'LHH_FASTBALLS.csv', RHH: 'RHH_FASTBALLS.csv' },
  Breaking: { LHH: 'LHH_BREAKING.csv', RHH: 'RHH_BREAKING.csv' },
  Offspeed: { LHH: 'LHH_OFFSPEED.csv', RHH: 'RHH_OFFSPEED.csv' },
}
const STANCE_FILES = { LHH: 'LHH_STANCE.csv', RHH: 'RHH_STANCE.csv' }

const db = new duckdb.Database(':memory:')
const con = db.connect()

function all(sql) {
  return new Promise((resolve, reject) => {
    con.all(sql, (err, rows) => err ? reject(err) : resolve(rows))
  })
}

function esc(p) { return p.replace(/'/g, "''") }
const num = v => (v == null || v === '' || isNaN(Number(v))) ? null : Number(v)

async function loadCsv(file) {
  const fp = path.join(DATA_DIR, file)
  return all(`select * from read_csv_auto('${esc(fp)}', header=true)`)
}

async function main() {
  // ---- Task A1: long-format merge ----
  const longRows = []
  for (const [category, sides] of Object.entries(CATEGORY_FILES)) {
    for (const side of Object.keys(sides)) {
      const raw = await loadCsv(sides[side])
      for (const row of raw) {
        longRows.push({
          batter_id: row.id,
          name: row.name,
          bat_side: row.side,
          pitch_category: category,
          avg_bat_speed: num(row.avg_bat_speed),
          swing_tilt: num(row.swing_tilt),
          attack_angle: num(row.attack_angle),
          attack_direction: num(row.attack_direction),
          ideal_attack_angle_rate: num(row.ideal_attack_angle_rate),
          avg_intercept_y_vs_plate: num(row.avg_intercept_y_vs_plate),
          avg_intercept_y_vs_batter: num(row.avg_intercept_y_vs_batter),
          avg_batter_y_position: num(row.avg_batter_y_position),
          avg_batter_x_position: num(row.avg_batter_x_position),
          competitive_swings: num(row.competitive_swings),
        })
      }
    }
  }

  // stance data joined in as batter-level constants
  const stanceByBatter = new Map()
  for (const side of Object.keys(STANCE_FILES)) {
    const raw = await loadCsv(STANCE_FILES[side])
    for (const row of raw) {
      stanceByBatter.set(String(row.id), {
        avg_foot_sep: num(row.avg_foot_sep),
        avg_stance_angle: num(row.avg_stance_angle),
      })
    }
  }
  for (const row of longRows) {
    const s = stanceByBatter.get(String(row.batter_id))
    row.avg_foot_sep = s?.avg_foot_sep ?? null
    row.avg_stance_angle = s?.avg_stance_angle ?? null
  }

  fs.writeFileSync(
    path.join(DATA_DIR, 'long_format.csv'),
    toCsv(longRows),
  )

  // ---- Task A2: batter-level profile ----
  const byBatter = new Map()
  for (const row of longRows) {
    const key = String(row.batter_id)
    if (!byBatter.has(key)) {
      byBatter.set(key, {
        batter_id: row.batter_id,
        name: row.name,
        bat_side: row.bat_side,
        avg_foot_sep: row.avg_foot_sep,
        avg_stance_angle: row.avg_stance_angle,
        byCategory: {},
        swingsByCategory: {},
      })
    }
    const b = byBatter.get(key)
    b.byCategory[row.pitch_category] = row.avg_intercept_y_vs_plate
    b.swingsByCategory[row.pitch_category] = row.competitive_swings
  }

  const profiles = []
  for (const b of byBatter.values()) {
    const vals = Object.values(b.byCategory).filter(v => v != null)
    const range = vals.length >= 2 ? Math.max(...vals) - Math.min(...vals) : null
    const fbVsBreaking = (b.byCategory.Fastball != null && b.byCategory.Breaking != null)
      ? b.byCategory.Fastball - b.byCategory.Breaking
      : null
    profiles.push({
      batter_id: b.batter_id,
      name: b.name,
      bat_side: b.bat_side,
      avg_foot_sep: b.avg_foot_sep,
      avg_stance_angle: b.avg_stance_angle,
      intercept_fastball: b.byCategory.Fastball ?? null,
      intercept_breaking: b.byCategory.Breaking ?? null,
      intercept_offspeed: b.byCategory.Offspeed ?? null,
      intercept_point_range: range,
      intercept_point_delta_fb_vs_breaking: fbVsBreaking,
      total_competitive_swings: Object.values(b.swingsByCategory).filter(v => v != null).reduce((s, v) => s + v, 0),
    })
  }

  const withRange = profiles
    .filter(p => p.intercept_point_range != null)
    .sort((a, b) => a.intercept_point_range - b.intercept_point_range)
  withRange.forEach((p, i) => {
    p.adjustability_percentile = withRange.length > 1
      ? Math.round((i / (withRange.length - 1)) * 100)
      : 50
  })
  profiles.forEach(p => { if (p.adjustability_percentile == null) p.adjustability_percentile = null })

  profiles.sort((a, b) => (b.intercept_point_range ?? -Infinity) - (a.intercept_point_range ?? -Infinity))
  fs.writeFileSync(OUT_PATH, toCsv(profiles))

  // ---- console summary ----
  const n = profiles.length
  const rangeVals = profiles.map(p => p.intercept_point_range).filter(v => v != null)
  const avgRange = rangeVals.reduce((s, v) => s + v, 0) / rangeVals.length
  const deltaVals = profiles.map(p => p.intercept_point_delta_fb_vs_breaking).filter(v => v != null)
  const avgDelta = deltaVals.reduce((s, v) => s + v, 0) / deltaVals.length

  console.log(`\nLoaded ${longRows.length} category-level rows -> ${n} unique batters (long_format.csv, ${longRows.length} rows)`)
  console.log(`Batters with all 3 categories present: ${rangeVals.length}/${n}`)
  console.log(`\nLeague avg fastball-vs-breaking intercept delta: ${avgDelta.toFixed(2)}" (sanity check vs. the ~3.9" figure from earlier this session)`)
  console.log(`League avg intercept_point_range (max-min across FB/Breaking/Offspeed): ${avgRange.toFixed(2)}"`)

  console.log(`\nTop 10 largest range ("adjusts across a wide window / most exploitable by sequencing"):`)
  for (const p of profiles.slice(0, 10)) {
    console.log(`  ${p.name.padEnd(22)} range=${p.intercept_point_range.toFixed(2)}"  FB=${fmt(p.intercept_fastball)} BRK=${fmt(p.intercept_breaking)} OFF=${fmt(p.intercept_offspeed)}  pct=${p.adjustability_percentile}`)
  }

  console.log(`\nBottom 10 smallest range ("one-speed hitter" -- flat timing regardless of pitch type):`)
  for (const p of profiles.slice(-10).reverse()) {
    console.log(`  ${p.name.padEnd(22)} range=${p.intercept_point_range.toFixed(2)}"  FB=${fmt(p.intercept_fastball)} BRK=${fmt(p.intercept_breaking)} OFF=${fmt(p.intercept_offspeed)}  pct=${p.adjustability_percentile}`)
  }

  console.log(`\nWrote:\n  ${path.join(DATA_DIR, 'long_format.csv')}\n  ${OUT_PATH}`)
}

function fmt(v) { return v == null ? 'n/a' : v.toFixed(2) }

function toCsv(rows) {
  if (rows.length === 0) return ''
  const cols = Object.keys(rows[0])
  const esc = v => {
    if (v == null) return ''
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n') + '\n'
}

main().catch(err => { console.error(err); process.exit(1) })
