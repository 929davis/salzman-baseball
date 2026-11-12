#!/usr/bin/env node
// Scores a weekly program template written in the coach-page import format against the
// coach's standing rulings and System Architecture 3.2's nervous-system rules. Dependency-free.
//
//   node scripts/score-template.mjs templates/weekly/gpp.txt
//   node scripts/score-template.mjs templates/weekly/in-season.txt --phase in-season
//   node scripts/score-template.mjs templates/weekly/*.txt --library exports/exercise-library-2026-11-11.json
//
// What it does, in order:
//   1. DRY-RUNS THE IMPORT PARSER. Re-implements, line for line, the acceptance logic of
//      parseAndImportProgram in app/coach/page.tsx (day headers, "Category | Exercise |
//      Prescription" rows, inline-day rows, the two prescription shapes, exact library name
//      match, deprecated exercises rejected). Nothing is written anywhere. Any skipped line is
//      a hard failure, because the real import would silently drop it.
//   2. SCORES THE WEEK against the rulings: session length (~1 hour), 3-4 lifts per week, at
//      least one heavy lift, at most one weekend session, high-CNS count and spacing, tempo
//      and isometric rules, removed items, and the order of work inside each session.
//   3. Prints a 0-100 score and every violation, with the day and line it came from.
//
// Terms (plain English): "CNS" = central nervous system; a "high-CNS" day is one with maximal,
// high-stress work -- max sprints, depth jumps and landings, loaded or ballistic jumps, lifts at
// RPE 9 or above (RPE = rating of perceived exertion, 10 = nothing left), or throwing at intent
// I4/I5 ("let it go" / max). "RIR" = reps in reserve. "KEAT" = kinetic energy accumulation
// training, i.e. depth jumps and drop landings.

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

// ---------------------------------------------------------------------------------------------
// Constants mirrored from the app (kept here so the script stays dependency-free).
// ---------------------------------------------------------------------------------------------
const CATEGORY_ORDER = ['Pre-Throwing', 'Throwing', 'Post-Throwing', 'Speed/Power', 'Main Exercises', 'Accessory', 'Recovery']
const VALID_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Order of work inside a session, from Training Principles 3.1 section 4.5: corrective and
// nervous-system preparation first, then power, then core strength, then assistance, then
// recovery. Throwing sits after power work (3.1: "corrective, CNS, power, and agility work is
// performed before weight training and throwing"). NOTE: the app DISPLAYS a day in
// CATEGORY_ORDER above (throwing before speed/power); see decisions-and-conflicts.md.
const SESSION_RANK = { 'Pre-Throwing': 0, 'Speed/Power': 1, 'Throwing': 2, 'Post-Throwing': 3, 'Main Exercises': 4, 'Accessory': 5, 'Recovery': 6 }

const PHASES = {
  gpp: { label: 'GPP (early off-season)', highCnsCeiling: 3, inSeason: false },
  spp: { label: 'SPP (late off-season)', highCnsCeiling: 3, inSeason: false },
  'first-transition': { label: 'First Transition (power block)', highCnsCeiling: 3, inSeason: false },
  'pre-season': { label: 'Pre-season', highCnsCeiling: 3, inSeason: false },
  'in-season': { label: 'In-season', highCnsCeiling: 2, inSeason: true },
}

// Rulings, as numbers.
const SESSION_TARGET_MIN = 60        // "about one hour"
const SESSION_HARD_MAX_MIN = 72      // 20% over the target is a violation; between target and this is a warning
const LIFTS_MIN = 3, LIFTS_MAX = 4   // lifts per week in every phase
const HEAVY_RPE = 8, HEAVY_PCT = 80, HEAVY_MAX_REPS = 6 // "heavy lift": RPE >= 8 (or >= 80%) and <= 6 reps on a Main Exercises row
const HYPERTROPHY_MIN_REPS = 6, HYPERTROPHY_MIN_RPE = 8  // hypertrophy work (6+ reps, RPE-prescribed) must be RPE 8-9
const MAX_WEEKEND_SESSIONS = 1
const CONDITIONING_INTERVAL_MAX_S = 10

// Removed from the system by ruling. Matched against exercise names, case-insensitive.
const REMOVED_PATTERNS = [
  { re: /javelin/i, why: 'javelin throwing was removed' },
  { re: /\b(hang clean|power clean|clean|snatch|jerk)\b/i, why: 'Olympic lifts were removed (jump variants replace them)', allow: /landmine push jerk/i },
]
// Long-duration isometric holds (minutes of accumulated time) are not allowed on the same day
// BEFORE a bullpen or competitive throwing session.
const LONG_ISO_RE = /split squat 90\/90 iso hold|wall sit hold|lengthened hamstring hold|weighted iso lunge/i
const BULLPEN_RE = /bullpen|competition|live ab/i
// Interval conditioning rows the ruling caps at 10 s of work. Zone 2 (continuous) is not an interval.
const INTERVAL_RE = /rower intervals|kettlebell swing|20 minute run/i
const SPRINT_RE = /sprint/i
// Jumps and landings that count as high-CNS under 3.2 ("max sprints, depth jumps/KEAT, ballistic vertical jumps").
const HIGH_CNS_JUMP_RE = /depth jump|altitude landing|overspeed eccentric|squat jump|trap bar jump|jump shrug|broad jump|lateral bound|skater jump|vertical jump|single leg cmj|death drop|rebound box|depth drop|lunge switches/i
const ISOMETRIC_RE = /\biso\b|isometric|hold\b|plank|pallof|bird dog|dead bug|suitcase/i
const ECCENTRIC_RE = /tempo|eccentric|slow lowering|nordic|2-to-1/i
const GATE_CODE_RE = /\b(G[1-4]|T[1-4])\b/

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------
const args = process.argv.slice(2)
const files = []
let libraryPath = null, phaseArg = null
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--library') libraryPath = args[++i]
  else if (args[i] === '--phase') phaseArg = args[++i]
  else files.push(args[i])
}
if (files.length === 0) {
  console.error('usage: node scripts/score-template.mjs <template.txt> [more.txt...] [--phase gpp|spp|first-transition|pre-season|in-season] [--library exports/exercise-library-YYYY-MM-DD.json]')
  process.exit(2)
}
if (!libraryPath) {
  const dir = path.join(process.cwd(), 'exports')
  const candidates = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => /^exercise-library-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort() : []
  if (candidates.length === 0) { console.error('no exports/exercise-library-*.json found; pass --library'); process.exit(2) }
  libraryPath = path.join(dir, candidates[candidates.length - 1])
}

// ---------------------------------------------------------------------------------------------
// Library: the parser matches `allExercises.find(e => e.name.toLowerCase() === name)` over
// [...BUILT_IN_EXERCISES, ...customExercises], so built-ins win on duplicate names.
// ---------------------------------------------------------------------------------------------
const libraryRaw = JSON.parse(fs.readFileSync(libraryPath, 'utf8'))
const library = [...libraryRaw.filter(e => e.source === 'built-in'), ...libraryRaw.filter(e => e.source !== 'built-in')]
const findExercise = name => library.find(e => String(e.name).toLowerCase() === name.toLowerCase())

// ---------------------------------------------------------------------------------------------
// 1. Parser dry-run (mirror of parseAndImportProgram's acceptance logic)
// ---------------------------------------------------------------------------------------------
function parseTemplate(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('#'))
  let currentDay = ''
  const rows = [], skipped = []
  for (const [i, line] of lines.entries()) {
    if (VALID_DAYS.includes(line.toUpperCase())) {
      currentDay = line.charAt(0).toUpperCase() + line.slice(1).toLowerCase()
      continue
    }
    let parts = line.split('|').map(p => p.trim())
    if (parts.length >= 4 && VALID_DAYS.includes(parts[0].toUpperCase())) {
      currentDay = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase()
      parts = parts.slice(1)
    }
    if (!currentDay) { skipped.push({ line, reason: `No day set yet, ignored: "${line.slice(0, 60)}"` }); continue }
    if (parts.length < 3) { skipped.push({ line, reason: `Couldn't split into fields (found ${parts.length} using "|")` }); continue }
    const [catRaw, exName, prescription] = parts
    const cat = catRaw === 'Conditioning' ? 'Speed/Power' : catRaw
    if (!CATEGORY_ORDER.includes(cat)) { skipped.push({ line, reason: 'Bad category: ' + catRaw }); continue }
    const setsRepsMatch = prescription.match(/(\d+)\s*x\s*(\d+)(?:\s*@\s*(RPE\s*\d+|\d+%?|I[1-5]))?/i)
    const bareCountMatch = (!setsRepsMatch && cat === 'Throwing') ? prescription.match(/(\d+)\s*@\s*(I[1-5])/i) : null
    if (!setsRepsMatch && !bareCountMatch) { skipped.push({ line, reason: 'Bad prescription: ' + prescription }); continue }
    let sets = null, reps = null, count = null, load = '', intent = null
    if (setsRepsMatch) {
      sets = parseInt(setsRepsMatch[1]); reps = parseInt(setsRepsMatch[2])
      const token = setsRepsMatch[3] || ''
      const isIntent = /^I[1-5]$/i.test(token)
      load = isIntent ? '' : token
      intent = isIntent ? token.toUpperCase() : null
    } else {
      count = parseInt(bareCountMatch[1]); intent = bareCountMatch[2].toUpperCase()
    }
    const match = findExercise(exName)
    if (!match) { skipped.push({ line, reason: 'Not in library: ' + exName }); continue }
    if (match.deprecated === true || match.deprecated === 'true') { skipped.push({ line, reason: `"${exName}" is deprecated and can no longer be added to new programs.` }); continue }
    // Equipment-tier and gate checks: the athlete tier is unknown for a template (passes), and
    // all gates are disabled (lib/engine/gateRequirement.ts GATES_DISABLED), so neither can
    // reject a row here. Throwing-intent check only fires for a "restricted" athlete -- not a template.
    const rpe = /^RPE\s*(\d+)$/i.test(load) ? parseInt(load.replace(/\D/g, '')) : null
    const pct = /^\d+%?$/.test(load) ? parseInt(load) : null
    rows.push({ lineNo: i + 1, line, day: currentDay, category: cat, name: match.name, exercise: match, prescription, sets, reps, count, load, rpe, pct, intent })
  }
  return { rows, skipped }
}

// ---------------------------------------------------------------------------------------------
// 2. Scoring
// ---------------------------------------------------------------------------------------------
function isHeavy(r) {
  if (r.category !== 'Main Exercises' || r.reps == null || r.reps > HEAVY_MAX_REPS) return false
  return (r.rpe != null && r.rpe >= HEAVY_RPE) || (r.pct != null && r.pct >= HEAVY_PCT)
}
function isIsometric(r) { return ISOMETRIC_RE.test(r.name) || /isometric/i.test(r.exercise.pattern || '') }
function isHighCnsRow(r) {
  if (isIsometric(r)) return false // ruling: all isometrics are low-demand
  if (r.intent && /^I[45]$/.test(r.intent)) return true
  if (r.rpe != null && r.rpe >= 9 && r.category === 'Main Exercises') return true
  if (r.pct != null && r.pct >= 90 && r.category === 'Main Exercises') return true
  if (SPRINT_RE.test(r.name)) return true
  if (HIGH_CNS_JUMP_RE.test(r.name)) return true
  return false
}
function isLiftRow(r) { return r.category === 'Main Exercises' && !/med ball|mb |jump|sprint|bound|hop/i.test(r.name) }

// Minutes per set, a rough model so a template can be checked against "about one hour".
function minutesFor(r) {
  if (r.category === 'Throwing') {
    if (BULLPEN_RE.test(r.name) && /competition|live ab/i.test(r.name)) return 0 // a game is not a training session
    const throws = r.count ?? (r.sets * r.reps)
    return 5 + throws * 0.4
  }
  if (r.category === 'Recovery') {
    if (/zone 2|20 minute run/i.test(r.name)) return 25
    return (r.sets ?? 1) * 1.0
  }
  const sets = r.sets ?? 1
  if (r.category === 'Pre-Throwing') return sets * 0.9
  if (r.category === 'Post-Throwing') return sets * 1.0
  if (r.category === 'Speed/Power') return sets * (SPRINT_RE.test(r.name) ? 2.5 : 1.75)
  if (r.category === 'Main Exercises') return sets * (isHeavy(r) ? 3.5 : /med ball|mb |jump/i.test(r.name) ? 1.75 : 2.5)
  if (r.category === 'Accessory') return sets * 1.2
  return sets * 1.0
}

function scoreWeek(rows, phaseKey) {
  const phase = PHASES[phaseKey]
  const violations = [], warnings = [], notes = []
  const byDay = new Map()
  for (const r of rows) { if (!byDay.has(r.day)) byDay.set(r.day, []); byDay.get(r.day).push(r) }
  const days = DAY_ORDER.filter(d => byDay.has(d))

  // --- session length
  const dayMinutes = {}
  for (const d of days) {
    const m = byDay.get(d).reduce((s, r) => s + minutesFor(r), 0)
    dayMinutes[d] = Math.round(m)
    if (m > SESSION_HARD_MAX_MIN) violations.push(`${d}: estimated ${Math.round(m)} min, more than ${SESSION_HARD_MAX_MIN} (target about ${SESSION_TARGET_MIN})`)
    else if (m > SESSION_TARGET_MIN) warnings.push(`${d}: estimated ${Math.round(m)} min, a little over the ${SESSION_TARGET_MIN}-minute target`)
  }

  // --- lifts per week, heavy lift
  const liftDays = days.filter(d => byDay.get(d).some(isLiftRow))
  if (liftDays.length < LIFTS_MIN || liftDays.length > LIFTS_MAX) violations.push(`${liftDays.length} lift day(s) (${liftDays.join(', ') || 'none'}); the ruling is ${LIFTS_MIN}-${LIFTS_MAX} per week`)
  const heavyRows = rows.filter(isHeavy)
  if (heavyRows.length === 0) violations.push('no heavy lift (a Main Exercises row at RPE 8+ or 80%+ with 6 reps or fewer)')
  else notes.push(`heavy lift(s): ${heavyRows.map(r => `${r.day} ${r.name} ${r.prescription}`).join('; ')}`)
  // "One heavy lift in every phase" is read as ONE designated heavy lift per week; other main
  // lifts sit at RPE 7 or are hypertrophy work (6+ reps at RPE 8-9). More than one is a warning.
  if (heavyRows.length > 1) warnings.push(`${heavyRows.length} rows qualify as heavy; the ruling is one heavy lift per week (keep the others at RPE 7 or at 6+ reps)`)

  // --- weekend
  const weekend = days.filter(d => d === 'Saturday' || d === 'Sunday')
  if (weekend.length > MAX_WEEKEND_SESSIONS) violations.push(`${weekend.length} weekend sessions (${weekend.join(', ')}); at most ${MAX_WEEKEND_SESSIONS}`)

  // --- high-CNS count and spacing (3.2 definition), plus the app's own tag-based warning
  const highDays = days.filter(d => byDay.get(d).some(isHighCnsRow))
  const highWhy = Object.fromEntries(highDays.map(d => [d, byDay.get(d).filter(isHighCnsRow).map(r => r.name + (r.intent ? ` @ ${r.intent}` : '')).join(', ')]))
  if (highDays.length > phase.highCnsCeiling) violations.push(`${highDays.length} high-CNS days (${highDays.join(', ')}) exceeds the ${phase.label} ceiling of ${phase.highCnsCeiling}`)
  for (let i = 0; i < DAY_ORDER.length - 1; i++) {
    const a = DAY_ORDER[i], b = DAY_ORDER[i + 1]
    if (highDays.includes(a) && highDays.includes(b)) violations.push(`high-CNS days back to back: ${a} (${highWhy[a]}) and ${b} (${highWhy[b]})`)
  }
  // Sunday->Monday wrap: a template repeats weekly.
  if (highDays.includes('Sunday') && highDays.includes('Monday')) violations.push('high-CNS days back to back across the week boundary: Sunday and Monday')
  notes.push(`high-CNS days (3.2 definition): ${highDays.length ? highDays.map(d => `${d} [${highWhy[d]}]`).join('; ') : 'none'}`)
  // The app's import warning uses the library's cns tag ("High" on any exercise). Report it so
  // the coach is not surprised by the ⚠ on import; it is not a ruling violation by itself.
  const tagHigh = days.filter(d => byDay.get(d).some(r => r.exercise.cns === 'High' && !isIsometric(r)))
  for (let i = 0; i < DAY_ORDER.length - 1; i++) {
    const a = DAY_ORDER[i], b = DAY_ORDER[i + 1]
    if (tagHigh.includes(a) && tagHigh.includes(b)) warnings.push(`the app will show its "High-CNS days back to back" notice for ${a}/${b} (it keys off the library's cns tag, which marks heavy lifts and most throwing drills High)`)
  }

  // --- hypertrophy RPE, tempo/eccentric, isometrics, conditioning intervals, removed items, gate codes
  for (const r of rows) {
    if (r.reps != null && r.reps >= HYPERTROPHY_MIN_REPS && r.rpe != null && r.rpe < HYPERTROPHY_MIN_RPE && (r.category === 'Main Exercises' || r.category === 'Accessory') && !isIsometric(r))
      violations.push(`${r.day} line ${r.lineNo}: hypertrophy work below RPE ${HYPERTROPHY_MIN_RPE} ("${r.name} ${r.prescription}"); the ruling is RPE 8-9`)
    if (INTERVAL_RE.test(r.name)) violations.push(`${r.day} line ${r.lineNo}: "${r.name}" is interval conditioning longer than ${CONDITIONING_INTERVAL_MAX_S} s of work (its library description prescribes 15-30 s or longer)`)
    for (const p of REMOVED_PATTERNS) if (p.re.test(r.name) && !(p.allow && p.allow.test(r.name))) violations.push(`${r.day} line ${r.lineNo}: "${r.name}" -- ${p.why}`)
    if (GATE_CODE_RE.test(r.line)) violations.push(`${r.day} line ${r.lineNo}: gate code in template text ("${r.line}"); gates are removed and the templates use plain English`)
  }
  // Long isometrics before a bullpen on the same day
  for (const d of days) {
    const list = byDay.get(d)
    const firstPen = list.findIndex(r => r.category === 'Throwing' && BULLPEN_RE.test(r.name))
    if (firstPen >= 0) {
      const before = list.slice(0, firstPen).filter(r => LONG_ISO_RE.test(r.name))
      for (const r of before) violations.push(`${d} line ${r.lineNo}: long isometric "${r.name}" before a bullpen/competitive throwing session on the same day`)
    }
  }
  const eccentricRows = rows.filter(r => ECCENTRIC_RE.test(r.name))
  if (!phase.inSeason && eccentricRows.length === 0) warnings.push('no tempo/eccentric row this week (ruling: lowering tempo 3-8 s; put at least one slow-lowering exercise in off-season weeks)')
  const isoRows = rows.filter(isIsometric)
  notes.push(`isometric rows (counted low-demand): ${isoRows.length}; tempo/eccentric rows: ${eccentricRows.length}`)

  // --- order within a session
  for (const d of days) {
    const list = byDay.get(d)
    let maxRank = -1, maxName = ''
    for (const r of list) {
      const rank = SESSION_RANK[r.category]
      if (rank < maxRank) violations.push(`${d} line ${r.lineNo}: "${r.name}" (${r.category}) comes after ${maxName}; session order is preparation -> power -> throwing -> main strength -> assistance -> recovery`)
      if (rank > maxRank) { maxRank = rank; maxName = `${r.category}` }
    }
  }

  // --- coverage (informational): strength, power, sprint/jump, conditioning, throwing, arm care, activation, mobility
  const cover = {
    strength: rows.some(isLiftRow),
    power: rows.some(r => /med ball|mb |rotational|jump|bound|push press|push jerk|landmine/i.test(r.name) && r.category !== 'Recovery'),
    sprint_or_jump: rows.some(r => SPRINT_RE.test(r.name) || HIGH_CNS_JUMP_RE.test(r.name) || /pogo/i.test(r.name)),
    conditioning: rows.some(r => /zone 2|sled|run|bike|row\b/i.test(r.name) && r.category === 'Recovery' || SPRINT_RE.test(r.name)),
    throwing: rows.some(r => r.category === 'Throwing'),
    arm_care: rows.some(r => /external rotation|internal rotation|prone y|prone t|rear delt|pronation|supination|wrist|finger|pinch|90\/90|ramp up|rapid reversal er|face pull|pull-apart|pull apart|scap/i.test(r.name)),
    activation_neural: rows.some(r => /^bc /i.test(r.name)),
    mobility: rows.some(r => /stretch|rotation|cat camel|hang|crawl|90\/90 stretch|wall slide|arm swings/i.test(r.name) && (r.category === 'Recovery' || r.category === 'Pre-Throwing')),
  }
  for (const [k, v] of Object.entries(cover)) {
    if (v) continue
    // In-season the two high-CNS slots are taken by throwing, so sprints and ballistic jumps are
    // optional there (3.2 ceiling of 2); a low-amplitude dose such as pogo hops still counts.
    if (phase.inSeason && k === 'sprint_or_jump') { notes.push('in-season: no sprint/ballistic jump work (expected; the two high-CNS slots go to throwing)'); continue }
    warnings.push(`coverage: no ${k.replace(/_/g, ' ')} work found this week`)
  }

  let score = 100 - violations.length * 10 - warnings.length * 2
  score = Math.max(0, Math.min(100, score))
  return { score, violations, warnings, notes, dayMinutes, liftDays, highDays, days }
}

// ---------------------------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------------------------
let exitCode = 0
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8')
  const base = path.basename(file).replace(/\.txt$/, '')
  const phaseKey = phaseArg || (Object.keys(PHASES).find(k => base.startsWith(k)) ?? null)
  console.log(`\n=== ${file} ${phaseKey ? `(${PHASES[phaseKey].label})` : '(phase unknown: pass --phase)'}`)
  const { rows, skipped } = parseTemplate(text)
  console.log(`parser dry-run: ${rows.length} row(s) would be added, ${skipped.length} skipped`)
  for (const s of skipped) console.log(`  SKIPPED: ${s.reason}  <- ${s.line}`)
  if (!phaseKey) { exitCode = 2; continue }
  const res = scoreWeek(rows, phaseKey)
  for (const d of res.days) {
    const n = rows.filter(r => r.day === d).length
    console.log(`  ${d.padEnd(10)} ${String(n).padStart(2)} rows  ~${String(res.dayMinutes[d]).padStart(3)} min${res.liftDays.includes(d) ? '  lift' : ''}${res.highDays.includes(d) ? '  HIGH-CNS' : ''}`)
  }
  for (const n of res.notes) console.log(`  note: ${n}`)
  for (const w of res.warnings) console.log(`  warning: ${w}`)
  for (const v of res.violations) console.log(`  VIOLATION: ${v}`)
  const clean = skipped.length === 0 && res.violations.length === 0
  console.log(`SCORE: ${skipped.length ? 0 : res.score}/100  ${clean ? '(clean)' : ''}${skipped.length ? '(import would skip lines -> 0)' : ''}`)
  if (!clean) exitCode = 1
}
process.exit(exitCode)
