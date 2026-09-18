// Computes the "facts about this athlete" block buildPrompt injects above the principles
// sections. Unlike every other file in lib/engine/, this one DOES talk to Supabase directly --
// it's a data-gathering + computation aggregator, not a pure validation rule, so it doesn't fit
// the (athleteState, slot) -> RuleResult shape the rest of this module uses. Kept here anyway
// because it's still "engine" logic: the same athlete_state/gate/equipment-tier concepts the
// validator uses, just assembled into a report instead of a pass/fail check.
//
// Governing principle (see principles doc section 0.x): the written program is the load of
// record. Logs confirm or revise prescribed load; they never create it. Every LOAD/EXPOSURE
// field below is resolved by MAX across prescribed+logged sources so a non-logger's real
// throwing never silently reads as rest. Every CAPABILITY field is resolved by precedence so a
// stale/lower-trust source can never override a higher-trust one. See lib/engine/provenance.ts.
//
// Scope note (Step B): full ledger-backed MAX resolution (Step A/C) doesn't exist yet -- there
// is no dated history of past program weeks (programs.week_of never advances; saveProgram()
// always overwrites the same row -- confirmed by reading every call site). So MAX resolution
// here only covers what's honestly derivable today: the CURRENT program's Throwing slots
// (this week's written plan) vs. logged throw_log data in the trailing 7 days -- both
// genuinely describe "this week," so comparing them is valid. The 28-day CHRONIC figure stays
// logged-only and is labeled as such until Step C's ledger gives it dated prescribed history
// too. Prescribed throwing slots also don't carry an implement tag today (structured_days has
// no implement field) -- prescribed weighted totals below assume the default 1.0 weight until
// Step A adds real implement tracking to the program schema.
//
// Deliberately does NOT read or restate any principles content -- only computed values from
// athlete_state, throw_log, cmj_results, and the exercise library.
import type { SupabaseClient } from '@supabase/supabase-js'
import { EngineAthleteState, EngineExercise, Gate, EquipmentTier } from './types'
import { resolveRequiredGate } from './gateRequirement'
import { meetsEquipmentTier } from './equipmentGate'
import { classifyCMJ } from '../cmj'
import { computeThrowLoadRatio, type ThrowLoadResult } from '../throwLog'
import { type Source, type Sourced, sourced, resolveLoad, resolveCapability, tag } from './provenance'

const ALL_GATES: Gate[] = ['G1', 'G2', 'G3', 'G4', 'T1', 'T2', 'T3', 'T4']
const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Weekly high-CNS ceiling -- derived from season_phase, not a stored column. Every prep phase
// (more room to build) gets 3; competitive (in-season, throwing/game load already consuming
// recovery capacity) gets 2. Unrecognized/null phase stays null -- no silent default.
function deriveWeeklyHighCNSCeiling(seasonPhase: string | null): number | null {
  if (seasonPhase == null) return null
  if (['transition', 'general_prep', 'specific_prep', 'first_transition'].includes(seasonPhase)) return 3
  if (seasonPhase === 'competitive') return 2
  return null
}

// Stage -> intent cap for the one in-flight mechanical change athlete_state tracks. The WHY
// (rationale sentence) used to be concatenated into the rendered line -- moved to a lookup the
// principles doc explains once, not restated per-prompt (see item 10: facts only, no prose that
// can drift from context).
const STAGE_INTENT_CAP: Record<number, string> = { 1: 'I2', 2: 'I3', 3: 'I4', 4: 'I5' }

export type GateBlock = { gate: Gate, blocks: string[] }
export type ExcludedCategory = { category: string, reason: string }

// One High-CNS commitment in the current program -- day + which specific exercise is tagged
// CNS:'High'. Surfaced so a ceiling violation names removable candidates instead of just a
// bare "over ceiling" count (item 10, bug 1: never report a violation with no resolution path).
export type HighCNSExposure = { day: string, exerciseName: string, category: string }

export type WeeklyHighCNSViolation = {
  excess: number // how many exposures need to come out to be back at/under ceiling
  removeCandidates: HighCNSExposure[] // every current exposure, most-recently-added last
}

export type AthleteConstraints = {
  pitcherId: string
  athleteStateFound: boolean
  training_status: Sourced<string | null>
  equipment_tier: Sourced<EquipmentTier | null>
  throwing_status: Sourced<string | null>
  season_phase: Sourced<string | null>
  season_role: Sourced<string | null>
  gates_passed: string[]
  gates_not_passed: GateBlock[]
  allowed_movement_categories: string[]
  excluded_movement_categories: ExcludedCategory[]
  weekly_high_cns_committed: Sourced<number>
  // Derived from season_phase (see deriveWeeklyHighCNSCeiling). null only when season_phase
  // itself is null/unrecognized -- not a missing definition anymore.
  weekly_high_cns_ceiling: number | null
  weekly_high_cns_violation: WeeklyHighCNSViolation | null
  has_team_lift: boolean
  team_lift_heavy_day: string | null
  // throwLoad is the PURE logged computation, untouched -- acute7d/chronicWeeklyAvg28d/ratio/
  // band/hasEnoughHistory exactly as lib/throwLog.ts computes them from throw_log alone.
  // resolvedAcute7d is the MAX-resolved figure (logged vs. this week's prescribed Throwing
  // slots) -- the one to actually reason about "how much has this pitcher thrown this week."
  // ratioWithheldReason is non-null whenever resolvedAcute7d didn't come from 'logged' -- an
  // acute figure boosted by prescribed data over a chronic denominator that's still
  // logged-only would inflate the ratio in the conservative direction, which still trains a
  // coach to ignore real warnings. See item 2 of the review that added this field.
  throwLoad: ThrowLoadResult
  resolvedAcute7d: Sourced<number>
  ratioWithheldReason: string | null
  weekly_i4_i5_count: Sourced<number>
  active_change: Sourced<string | null>
  active_change_stage: Sourced<number | null>
  // Derived from active_change_stage (see STAGE_INTENT_CAP). null only when there's no active
  // change, or the stage value is missing/outside 1-4.
  active_change_intent_cap: string | null
  days_since_high_intent_throwing: number | null
  cmj_classification: Sourced<string | null>
  // Every field name here is one this function could NOT determine -- either athlete_state is
  // missing entirely, or a specific column on it is null, or no CMJ/throw data exists. Named
  // explicitly rather than just rendering as a blank/default, per instruction.
  unknownFields: string[]
}

// Sum of a Throwing-category slot's implied throw count -- bare `count` (bullpen/outing form)
// or sets*reps (the SxR form a Throwing line can also be written in). Returns 0 for a slot with
// neither shape filled in rather than throwing, since a malformed slot shouldn't crash the
// whole constraints computation.
function slotThrowCount(slot: { count?: number | null, sets?: number | null, reps?: number | null }): number {
  if (typeof slot.count === 'number' && slot.count > 0) return slot.count
  if (typeof slot.sets === 'number' && typeof slot.reps === 'number') return slot.sets * slot.reps
  return 0
}

export async function computeAthleteConstraints(
  supabase: SupabaseClient,
  pitcherId: string,
  exercisePool: EngineExercise[],
): Promise<AthleteConstraints> {
  const unknownFields: string[] = []

  const [{ data: athleteStateRow }, { data: throwLogRows }, { data: cmjRows }, { data: programRow }] = await Promise.all([
    supabase.from('athlete_state').select('*').eq('pitcher_id', pitcherId).maybeSingle(),
    supabase.from('throw_log').select('throw_date,count,implement,intent_level,throw_type').eq('pitcher_id', pitcherId).order('throw_date', { ascending: false }),
    supabase.from('cmj_results').select('*').eq('pitcher_id', pitcherId).order('test_date', { ascending: false }).limit(1),
    supabase.from('programs').select('structured_days').eq('pitcher_id', pitcherId).order('week_of', { ascending: false }).limit(1).maybeSingle(),
  ])

  const athleteStateFound = !!athleteStateRow
  if (!athleteStateFound) {
    unknownFields.push('training_status', 'equipment_tier', 'throwing_status', 'season_phase', 'season_role', 'gates_passed', 'has_team_lift', 'team_lift_heavy_day', 'active_change', 'active_change_stage')
  } else {
    if (athleteStateRow.training_status == null) unknownFields.push('training_status')
    if (athleteStateRow.equipment_tier == null) unknownFields.push('equipment_tier')
    if (athleteStateRow.throwing_status == null) unknownFields.push('throwing_status')
    if (athleteStateRow.season_phase == null) unknownFields.push('season_phase')
    if (athleteStateRow.season_role == null) unknownFields.push('season_role')
    if (athleteStateRow.active_change == null) unknownFields.push('active_change')
  }

  // athlete_state is direct coach input today (AthleteStatePanel writes it via a single
  // upsert) -- every capability field sourced from it is genuinely coach_asserted, not
  // inferred. resolveCapability is still used (rather than reading the value bare) so this
  // slots into real precedence once Step G adds a second, competing source (coach_assertions /
  // logged reassessments) without this call site needing to change.
  const capField = <T,>(value: T | null): Sourced<T | null> =>
    resolveCapability<T>(value != null ? [sourced(value, 'coach_asserted')] : [])

  const gates_passed: string[] = athleteStateRow?.gates_passed ?? []
  const athleteTier: EquipmentTier | null = athleteStateRow?.equipment_tier ?? null

  // Gates not passed, and what each currently blocks -- scanned against the real exercise
  // pool, not a hardcoded description. A gate with nothing wired to it (G4, T1-T4 today) says
  // so plainly instead of silently listing nothing with no explanation.
  const gates_not_passed: GateBlock[] = ALL_GATES
    .filter(g => !gates_passed.includes(g))
    .map(gate => ({
      gate,
      blocks: exercisePool.filter(e => !e.deprecated && resolveRequiredGate(e) === gate).map(e => e.name),
    }))

  // allowed_movement_categories: every distinct category with at least one non-deprecated
  // exercise this athlete's equipment_tier covers AND whose gate (if any) is already passed.
  // Excluded categories are reported with why, not dropped silently.
  const categories = Array.from(new Set(exercisePool.map(e => e.movement_category).filter((c): c is string => c != null)))
  const allowed_movement_categories: string[] = []
  const excluded_movement_categories: ExcludedCategory[] = []
  for (const cat of categories) {
    const exercisesInCat = exercisePool.filter(e => e.movement_category === cat && !e.deprecated)
    const reachable = exercisesInCat.some(e => {
      const tierOk = e.equipment_tier == null || athleteTier == null || meetsEquipmentTier(athleteTier, e.equipment_tier)
      const gate = resolveRequiredGate(e)
      const gateOk = !gate || gates_passed.includes(gate)
      return tierOk && gateOk
    })
    if (reachable) {
      allowed_movement_categories.push(cat)
    } else {
      const blockingGate = exercisesInCat.map(e => resolveRequiredGate(e)).find(g => g)
      excluded_movement_categories.push({
        category: cat,
        reason: blockingGate
          ? `every exercise requires gate ${blockingGate}, not yet passed`
          : `no exercise in this category is within this athlete's ${athleteTier ?? 'unknown'} equipment tier`,
      })
    }
  }

  // Weekly high-CNS days + throwing load, both read from the CURRENT program's structured_days
  // -- this is "prescribed", the load of record, whether or not anything was logged.
  const structuredDays: Record<string, any[]> = (programRow?.structured_days as any) ?? {}
  let weekly_high_cns_committed_count = 0
  const highCNSExposures: HighCNSExposure[] = []
  let prescribedThrowTotal = 0
  let prescribedI4I5Count = 0
  for (const day of DAY_ORDER) {
    let dayHasHighCNS = false
    for (const key of Object.keys(structuredDays)) {
      if (!key.startsWith(day + '___')) continue
      const category = key.slice((day + '___').length)
      const items = structuredDays[key]
      if (!Array.isArray(items)) continue
      for (const it of items) {
        if (it?.cns === 'High') {
          dayHasHighCNS = true
          highCNSExposures.push({ day, exerciseName: it?.name ?? '(unnamed)', category })
        }
        if (category === 'Throwing') {
          prescribedThrowTotal += slotThrowCount(it)
          if (it?.intent_level === 'I4' || it?.intent_level === 'I5') prescribedI4I5Count++
        }
      }
    }
    if (dayHasHighCNS) weekly_high_cns_committed_count++
  }
  const weekly_high_cns_committed = sourced(weekly_high_cns_committed_count, 'prescribed' as Source)
  const weekly_high_cns_ceiling = deriveWeeklyHighCNSCeiling(athleteStateRow?.season_phase ?? null)
  const weekly_high_cns_violation: WeeklyHighCNSViolation | null =
    weekly_high_cns_ceiling != null && weekly_high_cns_committed_count > weekly_high_cns_ceiling
      ? { excess: weekly_high_cns_committed_count - weekly_high_cns_ceiling, removeCandidates: highCNSExposures }
      : null

  // Throw load: MAX-resolve the ACUTE (7d) figure between logged throw_log entries and this
  // week's prescribed Throwing slots -- both describe "this week," so comparing them is valid.
  // Chronic (28d) has no dated prescribed history yet (see file header) and stays logged-only.
  const throwEntries = (throwLogRows ?? []).map((r: any) => ({ throw_date: r.throw_date, count: r.count, implement: r.implement, throw_type: r.throw_type }))
  const loggedThrowLoad = computeThrowLoadRatio(throwEntries)
  const resolvedAcute = resolveLoad([
    sourced(loggedThrowLoad.acute7d, 'logged' as Source),
    sourced(prescribedThrowTotal, 'prescribed' as Source),
  ])
  // throwLoad stays exactly what lib/throwLog.ts computed -- untouched, logged-only, ratio and
  // all. resolvedAcute is the separate MAX-resolved figure. The two are DELIBERATELY not
  // merged into one number: acute and chronic must use the same resolution rule for a ratio
  // between them to mean anything, and chronic has no prescribed side yet (Step C).
  const throwLoad: ThrowLoadResult = loggedThrowLoad
  const ratioWithheldReason: string | null =
    resolvedAcute.source !== 'logged'
      ? `acute resolved from ${resolvedAcute.source} data (${resolvedAcute.value}, vs. ${loggedThrowLoad.acute7d} logged) while chronic remains logged-only -- a ratio combining the two would be comparing mismatched inputs. Re-enabled once the ledger (Step C) gives chronic a prescribed side too.`
      : null

  const weekly_i4_i5_count = resolveLoad([
    sourced(loggedThrowLoad.hasEnoughHistory || throwEntries.length > 0 ? countLoggedI4I5LastWeek(throwEntries) : 0, 'logged' as Source),
    sourced(prescribedI4I5Count, 'prescribed' as Source),
  ])

  // Days since the most recent I4/I5 throwing exposure on record (any distance back, not just
  // within the 28-day window above). This is a recency fact derived from logs; if the current
  // program prescribes I4/I5 this week and nothing's logged yet, weekly_i4_i5_count above
  // already surfaces that -- this field stays log-derived on purpose, it answers "how long
  // since one was CONFIRMED," not "how long since one was written."
  const highIntentDates = (throwLogRows ?? [])
    .filter((r: any) => r.intent_level === 'I4' || r.intent_level === 'I5')
    .map((r: any) => r.throw_date as string)
    .sort((a, b) => b.localeCompare(a))
  let days_since_high_intent_throwing: number | null = null
  if (highIntentDates.length > 0) {
    const last = new Date(highIntentDates[0] + 'T00:00:00')
    const today = new Date(); today.setHours(0, 0, 0, 0)
    days_since_high_intent_throwing = Math.floor((today.getTime() - last.getTime()) / (24 * 60 * 60 * 1000))
  }

  let cmj_classification: Sourced<string | null> = sourced(null, 'unknown')
  if (cmjRows && cmjRows.length > 0) {
    cmj_classification = sourced(classifyCMJ(cmjRows[0]).classification, 'inferred')
  } else {
    unknownFields.push('cmj_classification')
  }

  const activeChangeStage = capField<number>(athleteStateRow?.active_change_stage ?? null)
  const active_change_intent_cap = activeChangeStage.value != null ? STAGE_INTENT_CAP[activeChangeStage.value] ?? null : null

  return {
    pitcherId,
    athleteStateFound,
    training_status: capField(athleteStateRow?.training_status ?? null),
    equipment_tier: capField<EquipmentTier>(athleteTier),
    throwing_status: capField(athleteStateRow?.throwing_status ?? null),
    season_phase: capField(athleteStateRow?.season_phase ?? null),
    season_role: capField(athleteStateRow?.season_role ?? null),
    gates_passed,
    gates_not_passed,
    allowed_movement_categories,
    excluded_movement_categories,
    weekly_high_cns_committed,
    weekly_high_cns_ceiling,
    weekly_high_cns_violation,
    has_team_lift: !!athleteStateRow?.has_team_lift,
    team_lift_heavy_day: athleteStateRow?.has_team_lift ? (athleteStateRow?.team_lift_heavy_day ?? null) : null,
    throwLoad,
    resolvedAcute7d: resolvedAcute,
    ratioWithheldReason,
    weekly_i4_i5_count,
    active_change: capField(athleteStateRow?.active_change ?? null),
    active_change_stage: activeChangeStage,
    active_change_intent_cap,
    days_since_high_intent_throwing,
    cmj_classification,
    unknownFields: Array.from(new Set(unknownFields)),
  }
}

// Logged I4/I5 sessions in the trailing 7 days -- the logged-side candidate for
// weekly_i4_i5_count's MAX resolution. Separate from days_since_high_intent_throwing (which
// looks arbitrarily far back for the single most recent one).
function countLoggedI4I5LastWeek(entries: { throw_date: string, intent_level?: string | null }[]): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const dayMs = 24 * 60 * 60 * 1000
  return entries.filter((e: any) => {
    if (e.intent_level !== 'I4' && e.intent_level !== 'I5') return false
    const d = new Date(e.throw_date + 'T00:00:00')
    const diff = Math.floor((today.getTime() - d.getTime()) / dayMs)
    return diff >= 0 && diff < 7
  }).length
}

// Pure formatting -- kept separate from computeAthleteConstraints so it's testable/reusable
// (and so a future non-prompt consumer of this data, e.g. a UI panel, isn't forced through
// this exact text shape). Facts only, no explanatory prose (item 10, bug 2) -- narration about
// an assumed context (e.g. "a competitive-phase starter") can contradict this athlete's real
// state and has been removed; the WHY for any derived number belongs in the principles doc,
// stated once, not re-narrated per prompt.
export function renderAthleteConstraintsBlock(c: AthleteConstraints): string {
  const lines: string[] = []
  lines.push('COMPUTED CONSTRAINTS — these are facts about this athlete, not guidance. Do not contradict them. Every value is tagged with its source: [coach_asserted] > [logged] > [inferred] for capability facts; [prescribed] and [logged] both count toward load/exposure facts, higher one wins.')
  lines.push('')
  if (!c.athleteStateFound) {
    lines.push('⚠ No athlete_state row exists for this pitcher yet -- every capability field below is UNKNOWN, not "not applicable."')
  }
  lines.push(`- Training Status: ${c.training_status.value ?? 'UNKNOWN'} ${tag(c.training_status.source)}`)
  lines.push(`- Equipment Tier: ${c.equipment_tier.value ?? 'UNKNOWN'} ${tag(c.equipment_tier.source)}`)
  lines.push(`- Throwing Status: ${c.throwing_status.value ?? 'UNKNOWN'} ${tag(c.throwing_status.source)}`)
  lines.push(`- Season Phase: ${c.season_phase.value ?? 'UNKNOWN'} ${tag(c.season_phase.source)}`)
  lines.push(`- Season Role: ${c.season_role.value ?? 'UNKNOWN'} ${tag(c.season_role.source)}`)
  lines.push(`- Gates Passed: ${c.gates_passed.length > 0 ? c.gates_passed.join(', ') : 'none'}`)
  if (c.gates_not_passed.length > 0) {
    lines.push('- Gates NOT Passed:')
    for (const g of c.gates_not_passed) {
      lines.push(`  - ${g.gate}: blocks ${g.blocks.length > 0 ? g.blocks.join(', ') : '(nothing currently wired to this gate)'}`)
    }
  }
  lines.push(`- Allowed Movement Categories: ${c.allowed_movement_categories.length > 0 ? c.allowed_movement_categories.join(', ') : 'none'}`)
  if (c.excluded_movement_categories.length > 0) {
    lines.push('- Excluded Movement Categories:')
    for (const ex of c.excluded_movement_categories) lines.push(`  - ${ex.category}: ${ex.reason}`)
  }
  const ceilingPart = c.weekly_high_cns_ceiling != null ? `of ${c.weekly_high_cns_ceiling} max` : '(season_phase unknown, no ceiling derived)'
  lines.push(`- Weekly High-CNS Days Committed: ${c.weekly_high_cns_committed.value} ${ceilingPart} ${tag(c.weekly_high_cns_committed.source)}`)
  if (c.weekly_high_cns_violation) {
    const v = c.weekly_high_cns_violation
    lines.push(`  - RULE FAILED: exceeds weekly high-CNS ceiling by ${v.excess}. Do not add another high-CNS exposure this week.`)
    lines.push(`  - Nearest legal alternative: remove ${v.excess} of the following ${v.removeCandidates.length} committed high-CNS exposure(s) to be back within ceiling:`)
    for (const exp of v.removeCandidates) lines.push(`    - ${exp.day} / ${exp.category}: ${exp.exerciseName}`)
  }
  if (c.has_team_lift) lines.push(`- Team Lift Heavy Day: ${c.team_lift_heavy_day ?? 'set, but no day specified'}`)
  const tl = c.throwLoad
  lines.push(`- Throw Load, Acute (7d): ${c.resolvedAcute7d.value} ${tag(c.resolvedAcute7d.source)}`)
  lines.push(`- Throw Load, Chronic Weekly Avg (28d): ${tl.chronicWeeklyAvg28d} [logged]`)
  if (c.ratioWithheldReason) {
    lines.push(`- Acute:Chronic Ratio: WITHHELD -- ${c.ratioWithheldReason}`)
  } else if (tl.hasEnoughHistory) {
    lines.push(`- Acute:Chronic Ratio: ${tl.ratio} (band ${tl.band})`)
  } else {
    lines.push(`- Acute:Chronic Ratio: not meaningful yet -- chronic baseline building, ${tl.daysOfHistory} of 28 days logged [logged]`)
  }
  lines.push(`- Weekly I4/I5 Count: ${c.weekly_i4_i5_count.value} ${tag(c.weekly_i4_i5_count.source)}`)
  if (c.active_change.value) {
    const stageLabel = c.active_change_stage.value ?? 'UNKNOWN'
    const capLine = c.active_change_intent_cap ? `Intent Cap: ${c.active_change_intent_cap}` : 'Intent Cap: none derived (stage missing or outside 1-4)'
    lines.push(`- Active Change: "${c.active_change.value}" ${tag(c.active_change.source)}. Stage ${stageLabel} ${tag(c.active_change_stage.source)}. ${capLine}.`)
  } else {
    lines.push('- Active Change: none on record')
  }
  lines.push(`- Days Since Last I4/I5 Throwing: ${c.days_since_high_intent_throwing ?? 'none on record'} [logged]`)
  if (c.cmj_classification.value) lines.push(`- Latest CMJ Classification: ${c.cmj_classification.value} ${tag(c.cmj_classification.source)}`)
  if (c.unknownFields.length > 0) lines.push(`- Unknown/Unavailable Fields: ${c.unknownFields.join(', ')}`)
  return lines.join('\n')
}
