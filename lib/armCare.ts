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
