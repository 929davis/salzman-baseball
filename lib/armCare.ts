export type ThreeTierStatus = 'OK' | 'Caution' | 'Flag'

// ---------------------------------------------------------------------------
// Strength-Velocity Ratio = (ER strength + IR strength) in lbs ÷ velocity in mph.
// Flag threshold of 0.35 is a placeholder derived from plausible ranges (15-40 lbs
// combined ER+IR dumbbell load against 75-95 mph velocity puts most real results
// around 0.2-0.5) — not a validated clinical number. Re-tune once real roster data
// exists, ideally replacing this fixed cutoff with a team-relative one (e.g. bottom
// 15% or >1 SD below the roster average) instead of a hardcoded absolute value.
// ---------------------------------------------------------------------------
export function calcStrengthVelocityRatio(erLoadLbs:number|null, irLoadLbs:number|null, velocityMph:number|null){
  if (erLoadLbs==null||irLoadLbs==null||velocityMph==null||velocityMph===0) return null
  const ratio = (erLoadLbs+irLoadLbs)/velocityMph
  return { ratio, flagged: ratio<0.35, velocityMph }
}

// ---------------------------------------------------------------------------
// Load as % of bodyweight — separate OK/Caution/Flag bands for IR vs ER,
// mirroring the app's existing 3-tier asymmetry pattern rather than a bare
// pass/fail. IR caution band 25-30%, ER caution band 15-20% (below the low
// end of each range is Flag, at/above the high end is OK).
// ---------------------------------------------------------------------------
export function calcBodyweightPct(loadLbs:number|null, bodyweightLbs:number|null):number|null{
  if (loadLbs==null||bodyweightLbs==null||bodyweightLbs===0) return null
  return (loadLbs/bodyweightLbs)*100
}

export function bodyweightPctStatus(pct:number|null, type:'ER'|'IR'):ThreeTierStatus|null{
  if (pct==null) return null
  const [flagBelow,okAtOrAbove] = type==='IR' ? [25,30] : [15,20]
  if (pct>=okAtOrAbove) return 'OK'
  if (pct>=flagBelow) return 'Caution'
  return 'Flag'
}

// ---------------------------------------------------------------------------
// Fatigue score — % drop in hold time from baseline to a post-outing test.
// ---------------------------------------------------------------------------
export function calcFatigueScore(baselineSec:number|null, postOutingSec:number|null):number|null{
  if (baselineSec==null||postOutingSec==null||baselineSec===0) return null
  return ((baselineSec-postOutingSec)/baselineSec)*100
}

// ---------------------------------------------------------------------------
// Recovery score — % of baseline hold time returned, plus a starting
// recoveryModifier tier mapping for the arm-care load formula. These specific
// cutoffs (95/85/70%) and modifier values (1.0/0.9/0.75/0.6) are a first pass,
// not sourced from a validated study — tune over time like the 500 coefficient
// in the main formula. No recovery test on file defaults to 1.0 (no penalty
// without data to justify one).
// ---------------------------------------------------------------------------
export function calcRecoveryScore(baselineSec:number|null, recoverySec:number|null):number|null{
  if (baselineSec==null||recoverySec==null||baselineSec===0) return null
  return (recoverySec/baselineSec)*100
}

export function recoveryModifierFromScore(pctReturned:number|null):number{
  if (pctReturned==null) return 1.0
  if (pctReturned>=95) return 1.0
  if (pctReturned>=85) return 0.9
  if (pctReturned>=70) return 0.75
  return 0.6
}

// ---------------------------------------------------------------------------
// ROM asymmetry — reuses the exact 0-5/6-10/>10 OK/Caution/Flag thresholds
// already written into the principles doc's Asymmetry Thresholds entry.
// Note: that entry was framed around bilateral (left/right) comparisons;
// arm_care_tests only stores one ER and one IR value per test (same arm), so
// this applies the same tiering to ER-vs-IR range-of-motion instead — a
// different comparison than the original bilateral framing, worth knowing.
// ---------------------------------------------------------------------------
export function calcRomAsymmetry(erDeg:number|null, irDeg:number|null):{pctDiff:number,status:ThreeTierStatus}|null{
  if (erDeg==null||irDeg==null) return null
  const maxVal=Math.max(erDeg,irDeg)
  if (maxVal===0) return null
  const pctDiff=(Math.abs(erDeg-irDeg)/maxVal)*100
  const status:ThreeTierStatus = pctDiff<=5 ? 'OK' : pctDiff<=10 ? 'Caution' : 'Flag'
  return {pctDiff,status}
}

export const THREE_TIER_COLORS:Record<ThreeTierStatus,string> = {
  OK:'#39d353', Caution:'#e8b84b', Flag:'#f85149',
}

// ---------------------------------------------------------------------------
// Strength-depletion-based arm care model.
// strengthDepletionLbs: throw volume converted to an estimated strength-depletion figure.
// footPoundsTarget: 500 is a starting coefficient, not a validated constant — tune over time
// as real adjustedFootPoundsTarget outcomes get compared against actual soreness/injury data.
// adjustedFootPoundsTarget: scaled down by recoveryModifier when a pitcher's most recent
// recovery-check test shows they haven't fully recovered from a prior outing.
// ---------------------------------------------------------------------------
export const calcArmCare = (n:number, recoveryModifier:number) => {
  if (!n) return {strengthDepletionLbs:0, footPoundsTarget:0, adjustedFootPoundsTarget:0}
  const strengthDepletionLbs = (n/10)*0.1
  const footPoundsTarget = strengthDepletionLbs*500
  const adjustedFootPoundsTarget = footPoundsTarget*recoveryModifier
  return {strengthDepletionLbs, footPoundsTarget, adjustedFootPoundsTarget}
}

// Effort-to-torque multipliers, derived from motion-capture research (Fleisig, Melugin,
// Slenker) showing elbow/shoulder torque drops much less than perceived effort suggests —
// e.g. 80% perceived effort still produces ~90% of max torque. Not linear with effort %.
export const EFFORT_MULTIPLIERS: Record<string, number> = {
  '80-90': 0.92,
  '90-95': 0.97,
  '95+': 1.0,
}

// Mound vs. flat-ground multiplier. Best-supported figure (~6%) comes from an adolescent
// population (Nissen et al.) — collegiate-level studies found smaller/no significant
// difference, and long-toss at distance can match or exceed mound loads. Treated here as
// an upper-bound estimate, not a precisely validated figure for this roster's age group.
export const SURFACE_MULTIPLIERS: Record<string, number> = {
  mound: 1.06,
  flat: 1.0,
}

export const getEffectiveThrowCount = (selected: any, throwEntries: any[]) => {
  if (throwEntries && throwEntries.length > 0) {
    return throwEntries.reduce((sum, entry) => {
      const effortMult = EFFORT_MULTIPLIERS[entry.effort_tier] ?? 1
      const surfaceMult = SURFACE_MULTIPLIERS[entry.surface] ?? 1
      return sum + (entry.weekly_count * effortMult * surfaceMult)
    }, 0)
  }
  // Fallback for pitchers without any entries yet
  const raw = selected?.weekly_pitches || selected?.weekly_high_effort || 0
  const effortMult = EFFORT_MULTIPLIERS[selected?.effort_tier] ?? 1
  const surfaceMult = SURFACE_MULTIPLIERS[selected?.throw_surface] ?? 1
  return raw * effortMult * surfaceMult
}

// Most recent recovery_check compared against most recent baseline_max — defaults to
// no penalty (1.0) if either is missing, per recoveryModifierFromScore's own fallback.
export const getRecoveryModifier = (tests:any[]) => {
  const baseline = tests.find(t=>t.test_type==='baseline_max')
  const recoveryCheck = tests.find(t=>t.test_type==='recovery_check')
  if (!baseline||!recoveryCheck) return 1.0
  const erScore = calcRecoveryScore(baseline.er_hold_seconds, recoveryCheck.er_hold_seconds)
  const irScore = calcRecoveryScore(baseline.ir_hold_seconds, recoveryCheck.ir_hold_seconds)
  // Use the worse side — arm care load should stay conservative if either rotational
  // direction hasn't recovered, even if the other has.
  const scores = [erScore,irScore].filter((s):s is number=>s!=null)
  if (scores.length===0) return 1.0
  return recoveryModifierFromScore(Math.min(...scores))
}
