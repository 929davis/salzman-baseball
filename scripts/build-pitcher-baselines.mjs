// PART B4 (Pitch Sequencing & Timing-Adjustment Model): pitcher baseline batch job.
// Reads every data/pitch-sequencing/game_*.csv already pulled by
// build-game-pitch-features.mjs and aggregates, per pitcher:
//   - release-point centroid + spread per pitch type, split by batter handedness
//   - pairwise release-angle tunnel distance between all pitch-type pairs
//   - pitch-selection tendency by count state
//
// NOTE ON SAMPLE SIZE: this scales automatically as more games are pulled into
// data/pitch-sequencing/ (via build-game-pitch-features.mjs for one game, or
// pull-recent-games.mjs for a date range, then re-run this). A reliever who's appeared in
// several of the pulled games will have a real multi-outing baseline; a starter who's only
// thrown once in the pulled range will still just reflect that one start until more of
// their outings are in the date range too.
//
// Usage: node scripts/build-pitcher-baselines.mjs

import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', 'data', 'pitch-sequencing')
const OUT_PATH = path.join(DATA_DIR, 'pitcher_baselines.csv')

function parseCsvLine(line) {
  const out = []
  let cur = '', inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else cur += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { out.push(cur); cur = '' }
      else cur += ch
    }
  }
  out.push(cur)
  return out
}

function loadAllPitches() {
  const files = fs.readdirSync(DATA_DIR).filter(f => /^game_\d+_pitches\.csv$/.test(f))
  if (files.length === 0) throw new Error(`No game_*_pitches.csv files in ${DATA_DIR} -- run build-game-pitch-features.mjs first`)
  const rows = []
  for (const file of files) {
    const lines = fs.readFileSync(path.join(DATA_DIR, file), 'utf8').split('\n').filter(Boolean)
    const header = parseCsvLine(lines[0])
    for (const line of lines.slice(1)) {
      const vals = parseCsvLine(line)
      const row = {}
      header.forEach((h, i) => { row[h] = vals[i] })
      rows.push(row)
    }
  }
  return { rows, gameCount: files.length }
}

const num = v => (v == null || v === '' || v === 'null') ? null : Number(v)
const bool = v => v === 'true'

function mean(arr) { return arr.reduce((s, v) => s + v, 0) / arr.length }
function stdev(arr) {
  if (arr.length < 2) return 0
  const m = mean(arr)
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1))
}

function main() {
  const { rows, gameCount } = loadAllPitches()

  const byPitcher = new Map()
  for (const r of rows) {
    const key = r.pitcher_id
    if (!byPitcher.has(key)) byPitcher.set(key, { pitcher_id: key, pitcher_name: r.pitcher_name, pitches: [] })
    byPitcher.get(key).pitches.push(r)
  }

  const releaseBaselines = [] // one row per pitcher x pitch_type x batter_side
  const tunnelPairs = []      // one row per pitcher x pitch_type_A x pitch_type_B
  const countTendencies = []  // one row per pitcher x count_state x pitch_type

  for (const { pitcher_id, pitcher_name, pitches } of byPitcher.values()) {
    // -- release-point centroid + spread, split by batter handedness --
    const groups = new Map() // "pitchType|side" -> rows
    for (const p of pitches) {
      const k = `${p.pitch_type}|${p.batter_side}`
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k).push(p)
    }
    for (const [k, grp] of groups) {
      const [pitchType, side] = k.split('|')
      const x0s = grp.map(p => num(p.x0)), z0s = grp.map(p => num(p.z0))
      releaseBaselines.push({
        pitcher_id, pitcher_name, pitch_type: pitchType, vs_batter_side: side,
        n: grp.length,
        release_x0_mean: mean(x0s).toFixed(3), release_x0_stdev: stdev(x0s).toFixed(3),
        release_z0_mean: mean(z0s).toFixed(3), release_z0_stdev: stdev(z0s).toFixed(3),
        avg_start_speed: mean(grp.map(p => num(p.start_speed))).toFixed(1),
      })
    }

    // -- pairwise release-angle tunnel distance between all pitch-type pairs --
    const byType = new Map()
    for (const p of pitches) {
      if (!p.pitch_type) continue
      if (!byType.has(p.pitch_type)) byType.set(p.pitch_type, [])
      byType.get(p.pitch_type).push({ v: num(p.release_angle_vertical_deg), h: num(p.release_angle_horizontal_deg) })
    }
    const types = [...byType.keys()]
    for (let i = 0; i < types.length; i++) {
      for (let j = i + 1; j < types.length; j++) {
        const a = byType.get(types[i]), b = byType.get(types[j])
        const avgA = { v: mean(a.map(x => x.v)), h: mean(a.map(x => x.h)) }
        const avgB = { v: mean(b.map(x => x.v)), h: mean(b.map(x => x.h)) }
        tunnelPairs.push({
          pitcher_id, pitcher_name,
          pitch_type_a: types[i], pitch_type_b: types[j],
          n_a: a.length, n_b: b.length,
          release_angle_tunnel_distance_deg: Math.hypot(avgA.v - avgB.v, avgA.h - avgB.h).toFixed(2),
        })
      }
    }

    // -- pitch-selection tendency by count state --
    const byCount = new Map() // "b-s" -> Map(pitchType -> count)
    for (const p of pitches) {
      const countKey = `${p.balls_before}-${p.strikes_before}`
      if (!byCount.has(countKey)) byCount.set(countKey, new Map())
      const m = byCount.get(countKey)
      m.set(p.pitch_type, (m.get(p.pitch_type) || 0) + 1)
    }
    for (const [countKey, typeCounts] of byCount) {
      const total = [...typeCounts.values()].reduce((s, v) => s + v, 0)
      for (const [pitchType, n] of typeCounts) {
        countTendencies.push({
          pitcher_id, pitcher_name, count_state: countKey, pitch_type: pitchType,
          n, total_pitches_this_count: total, usage_pct: ((n / total) * 100).toFixed(1),
        })
      }
    }
  }

  fs.writeFileSync(path.join(DATA_DIR, 'pitcher_release_baselines.csv'), toCsv(releaseBaselines))
  fs.writeFileSync(path.join(DATA_DIR, 'pitcher_tunnel_pairs.csv'), toCsv(tunnelPairs))
  fs.writeFileSync(path.join(DATA_DIR, 'pitcher_count_tendencies.csv'), toCsv(countTendencies))

  console.log(`\nAggregated ${rows.length} pitches from ${gameCount} game(s), ${byPitcher.size} pitchers`)
  console.log(`Wrote pitcher_release_baselines.csv (${releaseBaselines.length} rows), pitcher_tunnel_pairs.csv (${tunnelPairs.length} rows), pitcher_count_tendencies.csv (${countTendencies.length} rows)`)

  // Show the one pitcher with the most pitches this session as a concrete example.
  const [{ pitcher_id: topId, pitcher_name: topName }] = [...byPitcher.values()].sort((a, b) => b.pitches.length - a.pitches.length)
  console.log(`\nExample -- ${topName} (pitcher_id ${topId}), release-point baseline by pitch type x batter side:`)
  for (const r of releaseBaselines.filter(r => r.pitcher_id === topId)) {
    console.log(`  ${r.pitch_type} vs ${r.vs_batter_side}HH (n=${r.n}): release x0=${r.release_x0_mean}±${r.release_x0_stdev}ft, z0=${r.release_z0_mean}±${r.release_z0_stdev}ft, avg ${r.avg_start_speed}mph`)
  }
  console.log(`\n${topName} release-angle tunnel distances between pitch-type pairs:`)
  for (const r of tunnelPairs.filter(r => r.pitcher_id === topId)) {
    console.log(`  ${r.pitch_type_a} vs ${r.pitch_type_b}: ${r.release_angle_tunnel_distance_deg}° apart at release (n=${r.n_a}/${r.n_b})`)
  }
  console.log(`\n${topName} pitch selection by count state (across all pulled games):`)
  for (const r of countTendencies.filter(r => r.pitcher_id === topId).sort((a, b) => a.count_state.localeCompare(b.count_state))) {
    console.log(`  ${r.count_state}: ${r.pitch_type} ${r.usage_pct}% (${r.n}/${r.total_pitches_this_count})`)
  }
}

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

main()
