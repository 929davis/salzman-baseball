// Computes the "facts about this athlete" block buildPrompt injects above the principles
// sections. Unlike every other file in lib/engine/, this one DOES talk to Supabase directly --
// it's a data-gathering + computation aggregator, not a pure validation rule, so it doesn't fit
// the (athleteState, slot) -> RuleResult shape the rest of this module uses. Kept here anyway
// because it's still "engine" logic: the same athlete_state/gate/equipment-tier concepts the
// validator uses, just assembled into a report instead of a pass/fail check.
//
// Deliberately does NOT read or restate any principles content -- only computed values from
// athlete_state, throw_log, cmj_results, and the exercise library.
import type { SupabaseClient } from '@supabase/supabase-js'
import { EngineAthleteState, EngineExercise, Gate, EquipmentTier } from './types'
import { resolveRequiredGate } from './gateRequirement'
import { meetsEquipmentTier } from './equipmentGate'
import { classifyCMJ } from '../cmj'
import { computeThrowLoadRatio, type ThrowLoadResult } from '../throwLog'

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

// Stage -> intent cap for the one in-flight mechanical change athlete_state tracks. Each
// stage's cap comes with the one-line reason it's capped there, rendered together so the
// number never appears without the "why."
const STAGE_INTENT_CAP: Record<number, { cap: string, reason: string }> = {
  1: { cap: 'I2', reason: 'intent capped at I2 while the athlete is still acquiring the new movement shape' },
  2: { cap: 'I3', reason: 'intent capped at I3 until the pattern is repeatable' },
  3: { cap: 'I4', reason: 'intent capped at I4 during mixed-practice integration' },
  4: { cap: 'I5', reason: 'intent capped at I5, full competitive intent with no cueing' },
}

export type GateBlock = { gate: Gate, blocks: string[] }
export type ExcludedCategory = { category: string, reason: string }

export type AthleteConstraints = {
  pitcherId: string
  athleteStateFound: boolean
  training_status: string | null
  equipment_tier: EquipmentTier | null
  throwing_status: string | null
  season_phase: string | null
  season_role: string | null
  gates_passed: string[]
  gates_not_passed: GateBlock[]
  allowed_movement_categories: string[]
  excluded_movement_categories: ExcludedCategory[]
  weekly_high_cns_committed: number
  // Derived from season_phase (see deriveWeeklyHighCNSCeiling). null only when season_phase
  // itself is null/unrecognized -- not a missing definition anymore.
  weekly_high_cns_ceiling: number | null
  has_team_lift: boolean
  team_lift_heavy_day: string | null
  throwLoad: ThrowLoadResult
  active_change: string | null
  active_change_stage: number | null
  // Derived from active_change_stage (see STAGE_INTENT_CAP). null only when there's no active
  // change, or the stage value is missing/outside 1-4.
  active_change_intent_cap: string | null
  active_change_intent_cap_reason: string | null
  days_since_high_intent_throwing: number | null
  // cmj_results was named as a read source with no specific output field attached to it. This
  // is the most directly relevant computed value available from it (see the report for why).
  cmj_classification: string | null
  // Every field name here is one this function could NOT determine -- either athlete_state is
  // missing entirely, or a specific column on it is null, or no CMJ/throw data exists. Named
  // explicitly rather than just rendering as a blank/default, per instruction.
  unknownFields: string[]
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

  // Weekly high-CNS days already committed in this pitcher's current program.
  const structuredDays: Record<string, any[]> = (programRow?.structured_days as any) ?? {}
  let weekly_high_cns_committed = 0
  for (const day of DAY_ORDER) {
    const dayHasHighCNS = Object.keys(structuredDays).some(key => {
      if (!key.startsWith(day + '___')) return false
      const items = structuredDays[key]
      return Array.isArray(items) && items.some(it => it?.cns === 'High')
    })
    if (dayHasHighCNS) weekly_high_cns_committed++
  }

  // Throw load (acute/chronic/ratio/band) -- see lib/throwLog.ts for the weighting and the
  // 28-day-minimum-history rule.
  const throwEntries = (throwLogRows ?? []).map((r: any) => ({ throw_date: r.throw_date, count: r.count, implement: r.implement, throw_type: r.throw_type }))
  const throwLoad = computeThrowLoadRatio(throwEntries)

  // Days since the most recent I4/I5 throwing exposure on record (any distance back, not just
  // within the 28-day window above).
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

  let cmj_classification: string | null = null
  if (cmjRows && cmjRows.length > 0) {
    cmj_classification = classifyCMJ(cmjRows[0]).classification
  } else {
    unknownFields.push('cmj_classification')
  }

  const activeChangeStage: number | null = athleteStateRow?.active_change_stage ?? null
  const stageCap = activeChangeStage != null ? STAGE_INTENT_CAP[activeChangeStage] : undefined

  return {
    pitcherId,
    athleteStateFound,
    training_status: athleteStateRow?.training_status ?? null,
    equipment_tier: athleteTier,
    throwing_status: athleteStateRow?.throwing_status ?? null,
    season_phase: athleteStateRow?.season_phase ?? null,
    season_role: athleteStateRow?.season_role ?? null,
    gates_passed,
    gates_not_passed,
    allowed_movement_categories,
    excluded_movement_categories,
    weekly_high_cns_committed,
    weekly_high_cns_ceiling: deriveWeeklyHighCNSCeiling(athleteStateRow?.season_phase ?? null),
    has_team_lift: !!athleteStateRow?.has_team_lift,
    team_lift_heavy_day: athleteStateRow?.has_team_lift ? (athleteStateRow?.team_lift_heavy_day ?? null) : null,
    throwLoad,
    active_change: athleteStateRow?.active_change ?? null,
    active_change_stage: activeChangeStage,
    active_change_intent_cap: stageCap?.cap ?? null,
    active_change_intent_cap_reason: stageCap?.reason ?? null,
    days_since_high_intent_throwing,
    cmj_classification,
    unknownFields: Array.from(new Set(unknownFields)),
  }
}

// Pure formatting -- kept separate from computeAthleteConstraints so it's testable/reusable
// (and so a future non-prompt consumer of this data, e.g. a UI panel, isn't forced through
// this exact text shape).
export function renderAthleteConstraintsBlock(c: AthleteConstraints): string {
  const lines: string[] = []
  lines.push('COMPUTED CONSTRAINTS — these are facts about this athlete, not guidance. Do not contradict them.')
  lines.push('')
  if (!c.athleteStateFound) {
    lines.push('⚠ No athlete_state row exists for this pitcher yet -- every field below is UNKNOWN, not "not applicable."')
  }
  lines.push(`- Training Status: ${c.training_status ?? 'UNKNOWN'}`)
  lines.push(`- Equipment Tier: ${c.equipment_tier ?? 'UNKNOWN'}`)
  lines.push(`- Throwing Status: ${c.throwing_status ?? 'UNKNOWN'}`)
  lines.push(`- Season Phase: ${c.season_phase ?? 'UNKNOWN'}`)
  lines.push(`- Season Role: ${c.season_role ?? 'UNKNOWN'}`)
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
  lines.push(`- Weekly High-CNS Days Committed: ${c.weekly_high_cns_committed}${c.weekly_high_cns_ceiling != null ? ` of ${c.weekly_high_cns_ceiling} max (ceiling derived from season_phase; throwing days and team lifts count against it, so a competitive-phase starter's ceiling is usually already mostly consumed)` : ' (season_phase unknown, so no ceiling could be derived)'}`)
  if (c.has_team_lift) lines.push(`- Team Lift Heavy Day: ${c.team_lift_heavy_day ?? 'set, but no day specified'}`)
  const tl = c.throwLoad
  if (tl.hasEnoughHistory) {
    lines.push(`- Throw Load: acute (7d) ${tl.acute7d}, chronic weekly avg (28d) ${tl.chronicWeeklyAvg28d}, ratio ${tl.ratio} (band ${tl.band})`)
  } else {
    lines.push(`- Throw Load: building baseline -- ${tl.daysOfHistory} of 28 days logged, ratio not meaningful yet`)
  }
  if (c.active_change) {
    const stageLabel = c.active_change_stage ?? 'UNKNOWN'
    const capLine = c.active_change_intent_cap_reason
      ? `Stage ${stageLabel} — ${c.active_change_intent_cap_reason}.`
      : `Stage ${stageLabel} — no intent cap could be derived (stage missing or outside 1-4).`
    lines.push(`- Active Change: "${c.active_change}". ${capLine}`)
  } else {
    lines.push('- Active Change: none on record')
  }
  lines.push(`- Days Since Last I4/I5 Throwing: ${c.days_since_high_intent_throwing ?? 'none on record'}`)
  if (c.cmj_classification) lines.push(`- Latest CMJ Classification: ${c.cmj_classification}`)
  if (c.unknownFields.length > 0) lines.push(`- Unknown/Unavailable Fields: ${c.unknownFields.join(', ')}`)
  return lines.join('\n')
}
