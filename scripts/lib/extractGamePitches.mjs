// Shared extraction logic for the Pitch Sequencing & Timing-Adjustment Model (Parts B1-B3,
// B5). Pulls one game's live feed from the MLB Stats API and returns one flat row per pitch
// with the physics features (B2), sequence-within-PA features (B3), and Part A batter
// profile join (B5) already computed. Used by both build-game-pitch-features.mjs (single
// game, verbose console output) and pull-recent-games.mjs (many games, quiet).

import fs from 'fs'

// Fraction of total flight time (release -> plate) treated as the swing-decision point.
// Sports-vision research (Adair; Sherwin/deCervo; the PLOS One occlusion study) puts the
// actual commit point at roughly 45-55% of ball flight -- 0.5 is the midpoint of that
// range, not a precisely validated figure for any one hitter. Change this one constant to
// re-run at a different assumption; nothing else below depends on the exact value.
export const DECISION_POINT_FRACTION = 0.5

// Half-width of the strike zone (17in plate / 2), in feet -- used for in/out-of-zone checks.
const ZONE_HALF_WIDTH_FT = (17 / 2) / 12

export function loadBatterProfiles(batterProfilePath) {
  const map = new Map()
  if (!fs.existsSync(batterProfilePath)) {
    console.warn(`WARNING: ${batterProfilePath} not found -- run scripts/build-batter-swing-profiles.mjs first. Continuing with no batter-profile join.`)
    return map
  }
  const lines = fs.readFileSync(batterProfilePath, 'utf8').split('\n').filter(Boolean)
  const header = parseCsvLine(lines[0])
  for (const line of lines.slice(1)) {
    const vals = parseCsvLine(line)
    const row = {}
    header.forEach((h, i) => { row[h] = vals[i] })
    map.set(row.batter_id, row)
  }
  return map
}

// Minimal quoted-CSV line parser (handles the "Last, First" name fields Part A's output has).
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

export async function extractGamePitches(gamePk, batterProfiles) {
  const res = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`)
  if (!res.ok) throw new Error(`MLB API returned ${res.status} for game ${gamePk}`)
  const data = await res.json()
  const plays = data.liveData?.plays?.allPlays || []
  const gameDate = data.gameData?.datetime?.officialDate ?? null
  const awayTeam = data.gameData?.teams?.away?.name ?? null
  const homeTeam = data.gameData?.teams?.home?.name ?? null

  const rows = []
  for (const play of plays) {
    const pitchEvents = (play.playEvents || []).filter(e => e.isPitch)
    let priorBalls = 0, priorStrikes = 0
    // Running within-PA state used by Task B3 -- reset for every plate appearance.
    const typesSeenSoFar = new Set()
    const lastPitchByType = new Map() // pitch_type -> pitch_num_in_pa it was last thrown
    let priorPitch = null // the immediately preceding pitch's own row, for tunnel distance
    let locSumX = 0, locSumZ = 0, locCount = 0 // running avg location seen so far this PA

    pitchEvents.forEach((ev, i) => {
      const c = ev.pitchData?.coordinates
      if (!c) return // a handful of early-season/tracking-gap events have no coordinates; skip

      const pitchNumInPa = i + 1
      const seq = computeSequenceFeatures(ev, c, pitchNumInPa, typesSeenSoFar, lastPitchByType, priorPitch, locSumX, locSumZ, locCount)
      const row = computePitchRow(gamePk, gameDate, awayTeam, homeTeam, play, ev, c, pitchNumInPa, priorBalls, priorStrikes, seq, priorPitch, batterProfiles)
      rows.push(row)

      // Update running PA state AFTER computing this pitch's features (so a pitch's own
      // type/location doesn't count as something the batter had "already seen").
      const pitchType = ev.details.type?.code ?? null
      if (pitchType) {
        typesSeenSoFar.add(pitchType)
        lastPitchByType.set(pitchType, pitchNumInPa)
      }
      locSumX += c.pX; locSumZ += c.pZ; locCount++
      priorPitch = { releaseAngleVerticalDeg: row.release_angle_vertical_deg, releaseAngleHorizontalDeg: row.release_angle_horizontal_deg, x0: c.x0, z0: c.z0 }

      // MLB's `count` on each event is the count AFTER this pitch resolved, not before --
      // confirmed by inspecting a real 4-pitch PA (0-1 -> 0-2 -> 1-2 -> 1-2 in play). Shift
      // it forward one pitch to get the pre-pitch count the batter was actually facing.
      priorBalls = ev.count?.balls ?? priorBalls
      priorStrikes = ev.count?.strikes ?? priorStrikes
    })
  }
  return { rows, playCount: plays.length }
}

// Task B3: sequence-within-PA features, computed from ONLY what happened earlier in this
// same at-bat (nothing from future pitches, nothing from other PAs).
function computeSequenceFeatures(ev, c, pitchNumInPa, typesSeenSoFar, lastPitchByType, priorPitch, locSumX, locSumZ, locCount) {
  const pitchType = ev.details.type?.code ?? null

  const pitchTypesSeenThisPa = typesSeenSoFar.size // count BEFORE this pitch is added
  const pitchTypeIsNew = pitchType != null && !typesSeenSoFar.has(pitchType)
  const lastSameTypeAt = pitchType != null ? lastPitchByType.get(pitchType) : undefined
  const recencySameShape = lastSameTypeAt != null ? pitchNumInPa - lastSameTypeAt : null // null = never thrown before this PA

  // Release-point distance (feet) vs. the immediately preceding pitch in this PA -- the
  // release-angle component of this (deg) is added in computePitchRow, once this pitch's
  // own release angles are computed.
  const tunnelDistanceFromPriorPitch = priorPitch ? Math.hypot(c.x0 - priorPitch.x0, c.z0 - priorPitch.z0) : null

  let withinPaExpectationDeviation = null
  if (locCount > 0) {
    const avgX = locSumX / locCount, avgZ = locSumZ / locCount
    withinPaExpectationDeviation = Math.hypot(c.pX - avgX, c.pZ - avgZ)
  }

  return {
    pitchTypesSeenThisPa,
    pitchTypeIsNew,
    recencySameShape,
    tunnelDistanceFromPriorPitch,
    withinPaExpectationDeviation,
  }
}

function computePitchRow(gamePk, gameDate, awayTeam, homeTeam, play, ev, c, pitchNumInPa, priorBalls, priorStrikes, seq, priorPitch, batterProfiles) {
  const { x0, y0, z0, vX0, vY0, vZ0, aX, aY, aZ, pX, pZ } = c
  const T = ev.pitchData.plateTime // MLB-computed total release-to-plate flight time (sec)
  const tD = DECISION_POINT_FRACTION * T
  const dt = T - tD

  // Actual position/velocity at the decision point, using the real (accelerating) trajectory.
  const xD = x0 + vX0 * tD + 0.5 * aX * tD * tD
  const zD = z0 + vZ0 * tD + 0.5 * aZ * tD * tD
  const vXD = vX0 + aX * tD
  const vZD = vZ0 + aZ * tD

  // Where the pitch would have crossed the plate if it stopped breaking at the decision
  // point (straight-line projection at the decision-point velocity for the remaining time).
  const projX = xD + vXD * dt
  const projZ = zD + vZD * dt
  const postDecisionBreak = Math.hypot(projX - pX, projZ - pZ)

  const top = ev.pitchData.strikeZoneTop
  const bottom = ev.pitchData.strikeZoneBottom
  const actualInZone = Math.abs(pX) <= ZONE_HALF_WIDTH_FT && pZ >= bottom && pZ <= top
  const projectedInZone = Math.abs(projX) <= ZONE_HALF_WIDTH_FT && projZ >= bottom && projZ <= top

  // vY0 is negative (ball travels from y0~50ft toward the plate at y=0), so raw atan2(v, vY0)
  // would sit in the second/third quadrant for every pitch and wouldn't read as a small
  // deviation from a straight line. Using -vY0 (forward speed) as the reference axis instead,
  // so these read as "degrees off a straight line to the plate" -- deviating from the literal
  // atan2(vZ0, vY0)/atan2(vX0, vY0) spec wording for that reason.
  const releaseAngleVerticalDeg = Math.atan2(vZ0, -vY0) * 180 / Math.PI
  const releaseAngleHorizontalDeg = Math.atan2(vX0, -vY0) * 180 / Math.PI

  const releaseAngleTunnelDistanceDeg = priorPitch
    ? Math.hypot(releaseAngleVerticalDeg - priorPitch.releaseAngleVerticalDeg, releaseAngleHorizontalDeg - priorPitch.releaseAngleHorizontalDeg)
    : null

  const batterProfile = batterProfiles.get(String(play.matchup.batter.id))

  return {
    game_pk: gamePk,
    game_date: gameDate,
    away_team: awayTeam,
    home_team: homeTeam,
    inning: play.about.inning,
    half_inning: play.about.halfInning, // 'top' | 'bottom'
    at_bat_index: play.about.atBatIndex,
    pitch_num_in_pa: pitchNumInPa,
    pitcher_id: play.matchup.pitcher.id,
    pitcher_name: play.matchup.pitcher.fullName,
    batter_id: play.matchup.batter.id,
    batter_name: play.matchup.batter.fullName,
    batter_side: play.matchup.batSide?.code,
    pitch_type: ev.details.type?.code ?? null,
    pitch_type_desc: ev.details.type?.description ?? null,
    start_speed: ev.pitchData.startSpeed,
    x0, y0, z0, vX0, vY0, vZ0, aX, aY, aZ, pX, pZ,
    strike_zone_top: top,
    strike_zone_bottom: bottom,
    plate_time: T,
    balls_before: priorBalls,
    strikes_before: priorStrikes,
    balls_after: ev.count?.balls,
    strikes_after: ev.count?.strikes,
    outs: ev.count?.outs,
    call_code: ev.details.call?.code,
    call_description: ev.details.call?.description,
    is_strike: ev.details.isStrike,
    is_ball: ev.details.isBall,
    is_in_play: ev.details.isInPlay,
    launch_speed: ev.hitData?.launchSpeed ?? null,
    launch_angle: ev.hitData?.launchAngle ?? null,
    // Task B2 physics features
    release_angle_vertical_deg: releaseAngleVerticalDeg,
    release_angle_horizontal_deg: releaseAngleHorizontalDeg,
    decision_point_fraction: DECISION_POINT_FRACTION,
    post_decision_break: postDecisionBreak,
    decision_point_zone_mismatch: actualInZone !== projectedInZone,
    // Task B3 -- sequence-within-PA features (computed from prior pitches in this same PA only)
    pitch_types_seen_this_pa: seq.pitchTypesSeenThisPa,
    pitch_type_is_new_this_pa: seq.pitchTypeIsNew,
    recency_same_shape: seq.recencySameShape,
    tunnel_distance_from_prior_pitch: seq.tunnelDistanceFromPriorPitch,
    release_angle_tunnel_distance_deg: releaseAngleTunnelDistanceDeg,
    within_pa_expectation_deviation: seq.withinPaExpectationDeviation,
    // Task B5 -- Part A batter timing-adjustment profile, joined by batter_id
    batter_bat_side: batterProfile?.bat_side ?? null,
    batter_intercept_fastball: batterProfile?.intercept_fastball ?? null,
    batter_intercept_breaking: batterProfile?.intercept_breaking ?? null,
    batter_intercept_offspeed: batterProfile?.intercept_offspeed ?? null,
    batter_intercept_point_range: batterProfile?.intercept_point_range ?? null,
    batter_intercept_delta_fb_vs_breaking: batterProfile?.intercept_point_delta_fb_vs_breaking ?? null,
    batter_adjustability_percentile: batterProfile?.adjustability_percentile ?? null,
  }
}

export function toCsv(rows) {
  if (rows.length === 0) return ''
  const cols = Object.keys(rows[0])
  const esc = v => {
    if (v == null) return ''
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n') + '\n'
}
