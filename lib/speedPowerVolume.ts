import type { ThreeTierStatus } from './armCare'

// Speed/Power (jump/plyo) volume guardrail — a per-day ground-contact ceiling, since the
// published guidance this is grounded in (foot contacts per plyometric session) is a
// per-session figure, not a weekly total we'd have to invent a multiplier for.
//
// ~80 contacts marks the low end of a general "intermediate athlete" range; ~120 the high
// end, beyond which published guidance shifts into "advanced" territory. This is a single
// flat, generic-athlete starting point — not tailored to any one roster's training age, and
// not a validated number for a specific pitcher. Tune over time, same as the arm-care
// foot-lb coefficient elsewhere in this app.
export const SPEED_POWER_CAUTION_CONTACTS = 80
export const SPEED_POWER_FLAG_CONTACTS = 120

// Which built-in exercises count as ground-contact plyometric work, and how many contacts
// one rep represents. Sprints (ex_035) share the same "Locomotion" pattern tag as jumps but
// aren't a landing-force event the same way, so pattern alone can't distinguish them — this
// map is the actual source of truth. Exercises absent here (sprints, med ball throws,
// kettlebell swing) don't count toward the ceiling: real Speed/Power volume, but a different
// physiological demand (no landing-force component) — out of scope for a ground-contact-
// specific guardrail. Custom exercises use their own ground_contacts_per_rep column instead.
export const GROUND_CONTACTS_PER_REP: Record<string, number> = {
  ex_029: 1, // Broad Jump
  ex_030: 3, // Triple Broad Jump (3 jumps per rep)
  ex_031: 1, // Depth Jump
  ex_032: 1, // Lateral Bound
  ex_033: 1, // Skater Jump
  ex_034: 1, // Pogo Hops
}

export type ContactExercise = { id: string, sets: number, reps: number, ground_contacts_per_rep?: number | null }

export function exerciseGroundContacts(ex: ContactExercise): number {
  const perRep = GROUND_CONTACTS_PER_REP[ex.id] ?? ex.ground_contacts_per_rep ?? 0
  return perRep * (ex.sets || 0) * (ex.reps || 0)
}

export type ContactStatus = ThreeTierStatus

export function contactStatus(totalContacts: number, cautionCeiling: number, flagCeiling: number): ContactStatus {
  if (totalContacts >= flagCeiling) return 'Flag'
  if (totalContacts >= cautionCeiling) return 'Caution'
  return 'OK'
}

// Severe-arm-care-flags reduction: only kicks in for 2+ simultaneous Caution-or-worse
// statuses, or any single Flag-severity metric. The physiological link between rotator cuff
// strength and landing/jump tolerance is real but looser than the direct throw-volume-to-
// arm-care link the recovery modifier already models, so this deliberately doesn't reduce
// the ceiling over one borderline Caution alone.
export function speedPowerArmCareModifier(statuses: ThreeTierStatus[]): number {
  const notOK = statuses.filter(s => s !== 'OK')
  const hasFlag = notOK.some(s => s === 'Flag')
  if (hasFlag || notOK.length >= 2) return 0.7
  return 1.0
}

export type SpeedPowerGuardrail = {
  totalContacts: number        // this day alone
  rolling48hContacts: number   // this day + the immediately preceding calendar day
  cautionCeiling: number
  flagCeiling: number
  status: ContactStatus        // the worse of the single-day and 48h-rolling checks
  is48hDriven: boolean         // true when the day alone is fine but the 48h window isn't
  modifierApplied: boolean
  reasons: string[]
}

// recoveryModifier: the SAME modifier already computed for the arm-care foot-lb target
// (from a recovery-check test vs baseline) — reused here rather than re-derived, so a
// pitcher who hasn't bounced back from a prior outing gets a lower jump ceiling too, not
// just a lower arm-care recovery target. armCareStatuses: computeArmCareFlagStatuses' output.
//
// priorDayExercises: the immediately preceding calendar day's Speed/Power exercises (empty
// if none) — checked against the SAME ceiling as a rolling 48h sum, not a separately-invented
// higher number. A day can look fine in isolation (e.g. 60 contacts) while still representing
// too much impact volume back-to-back with yesterday (e.g. 60+60=120) — plyometric recovery
// guidance generally wants at least 48h between high-impact sessions, and checking each day
// alone can't see that. Reusing the same thresholds is deliberate: they were already framed
// as "per session, not to be stacked without recovery," so applying them to the rolling
// window is the more correct reading, not a new invented figure.
export function computeSpeedPowerGuardrail(
  exercises: ContactExercise[],
  recoveryModifier: number,
  armCareStatuses: ThreeTierStatus[],
  priorDayExercises: ContactExercise[] = [],
): SpeedPowerGuardrail {
  const totalContacts = exercises.reduce((s, ex) => s + exerciseGroundContacts(ex), 0)
  const priorDayContacts = priorDayExercises.reduce((s, ex) => s + exerciseGroundContacts(ex), 0)
  const rolling48hContacts = totalContacts + priorDayContacts
  const armMod = speedPowerArmCareModifier(armCareStatuses)
  const combinedMod = recoveryModifier * armMod
  const flagCeiling = Math.round(SPEED_POWER_FLAG_CONTACTS * combinedMod)
  const cautionCeiling = Math.round(SPEED_POWER_CAUTION_CONTACTS * combinedMod)
  const todayStatus = contactStatus(totalContacts, cautionCeiling, flagCeiling)
  const rollingStatus = contactStatus(rolling48hContacts, cautionCeiling, flagCeiling)
  const statusRank: Record<ContactStatus, number> = { OK: 0, Caution: 1, Flag: 2 }
  const status = statusRank[rollingStatus] > statusRank[todayStatus] ? rollingStatus : todayStatus
  const reasons: string[] = []
  if (recoveryModifier < 1) reasons.push('incomplete recovery from a prior outing')
  if (armMod < 1) reasons.push('multiple arm-care flags')
  if (statusRank[rollingStatus] > statusRank[todayStatus]) reasons.push('combined with the prior day, within a 48h window')
  return {
    totalContacts, rolling48hContacts, cautionCeiling, flagCeiling, status,
    is48hDriven: statusRank[rollingStatus] > statusRank[todayStatus],
    modifierApplied: combinedMod < 1,
    reasons,
  }
}
