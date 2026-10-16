export const parseTime=(s:string):number=>{
  const t=s.trim()
  if (t.includes(':')){
    const [m,sec]=t.split(':')
    const mins=parseFloat(m)
    const secs=parseFloat(sec)
    if (isNaN(mins)||isNaN(secs))return NaN
    return mins*60+secs
  }
  return parseFloat(t)
}

export const calcJumpHeight=(takeoff:number,landing:number)=>{
  const ft=landing-takeoff
  return (9.81*ft*ft)/8*39.3701
}

// --- Base model: Driveline's OpenBiomechanics "high_performance" dataset, College-level
// pitchers only (n=272, athlete-grouped train/test split, 30 resamples): jump height, peak
// power/kg (Sayers equation, since we have no force plate), and body weight. Cross-validated
// MAE≈3.9 mph, R²≈0.20 against that dataset. RSI-Mod was tested and dropped there: no
// predictive value. A 2024 peer-reviewed study (Sakurai, Qiao, Szymanski & Crotin, JSCR 38(7))
// found concentric impulse in the first 100ms (CI-100) correlates with fastball velocity at
// r≈0.71 in D1 pitchers -- stronger than anything fit here. CI-100 needs a force plate and
// isn't available from video, so it stays excluded.
//
// --- Local correction, layered on top of the base model ---
// 8 real local athletes (real recorded velocity + a real CMJ test) showed the base model
// consistently underestimates lower-power athletes and is roughly accurate for higher-power
// ones: the base model's own error correlated with PP/BM at r=-0.79 across this sample.
// Fitting that error directly (error ≈ 31.5 - 0.419*ppbm) and adding it straight to the base
// model flips the net PP/BM coefficient negative (0.291 - 0.419 = -0.128) -- i.e. it would
// tell a coach that a MORE powerful jumper throws SLOWER, holding jump height/weight constant.
// That contradicts the base model, the Salzman CSV's own fit, and basic physiology; it's an
// artifact of 2 athletes at opposite extremes of an 8-person sample driving most of the slope,
// not a real finding. So the correction is anchored at this sample's own mean PP/BM (70.0,
// where a regression line is actually trustworthy) rather than at PP/BM=0 (wild extrapolation),
// and the net PP/BM sensitivity is floored at +0.05 so the formula can never say "more power,
// less velocity" regardless of what a future small sample suggests.
// Net result for this hypothetical (200lb, 20in jump, PP/BM≈56.6): base model alone said 84.4
// mph; this athlete's real bullpen/max velocity was 91-95 mph; the corrected formula gives 89.9.
// This correction is NOT independently cross-validated (n=8, in-sample fit) the way the base
// model is -- treat it as a working, evidence-based adjustment, not a validated replacement.
// Revisit once more real local athletes have both a CMJ test and a real recorded velocity.
export const CMJ_VELOCITY_MODEL_MAE_MPH=3.9

// The 6 CMJ phase events (per the iPhone assessment spec). Only the first/takeoff/landing
// are required -- they're what the velocity model above and the existing jump-height/RSI/
// power calculations need. The other 3 are optional, video-derived timing-only inputs: they
// support coaching review of jump quality (how long a pitcher takes to load, decelerate, and
// recover) but are NOT inputs to the velocity model and never will be from timestamps alone --
// true force/impulse/power metrics (CI-100, Braking RFD) require a force plate, not a stopwatch.
export type CMJPhaseTimestamps={
  startTime:number        // 1. first downward movement
  bottomTime?:number      // 2. bottom of the loading phase
  takeoffTime:number      // 3. takeoff
  landingTime:number      // 4. landing
  stabilizationTime?:number // 5. landing stabilization
  uprightTime?:number     // 6. return to upright standing
}

// Checks the 6 phase timestamps occur in order (whichever optional ones are present).
// Returns an error message naming the pair that's out of order, or null if valid.
export function validateCMJTimestamps(t:CMJPhaseTimestamps):string|null{
  const seq:[string,number|undefined][]=[
    ['first downward movement',t.startTime],
    ['bottom of the loading phase',t.bottomTime],
    ['takeoff',t.takeoffTime],
    ['landing',t.landingTime],
    ['landing stabilization',t.stabilizationTime],
    ['return to upright',t.uprightTime],
  ]
  const present=seq.filter(([,v])=>v!=null&&!isNaN(v))
  for (let i=1;i<present.length;i++){
    const [prevLabel,prevVal]=present[i-1]
    const [label,val]=present[i]
    if ((val as number)<=(prevVal as number)) return `"${label}" must come after "${prevLabel}"`
  }
  return null
}

export const calcCMJFn=({startTime,bottomTime,takeoffTime,landingTime,stabilizationTime,uprightTime,massKg}:CMJPhaseTimestamps&{massKg:number})=>{
  const ft=landingTime-takeoffTime
  const ttt=takeoffTime-startTime
  const jh=(9.81*ft*ft)/8
  const jhc=jh*100
  const jhi=jh*39.3701
  const rsi=jh/ttt
  const pp=(60.7*jhc)+(45.3*massKg)-2055
  const ppkg=pp/massKg
  const tv=Math.sqrt(2*9.81*jh)
  const ei=rsi*ppkg
  const massLbs=massKg*2.20462
  const ev=68.2803+(0.123*jhc)+(0.05*ppkg)+(0.0626*massLbs)
  // Timing-only metrics from the optional phase events. undefined when the coach hasn't
  // entered that timestamp -- never inferred or defaulted, per "display as unavailable rather
  // than inventing a value."
  const eccentricDurationSec=bottomTime!=null?bottomTime-startTime:undefined
  const concentricDurationSec=bottomTime!=null?takeoffTime-bottomTime:undefined
  const landingStabilizationSec=stabilizationTime!=null?stabilizationTime-landingTime:undefined
  const returnToUprightSec=uprightTime!=null?uprightTime-landingTime:undefined
  return{flightTime:ft,propulsionDurationSec:ttt,jumpHeightIn:jhi,rsiMod:rsi,peakPowerPerKg:ppkg,takeoffVelocity:tv,explosiveIndex:ei,estimatedVelocity:ev,estimatedVelocityMarginMph:CMJ_VELOCITY_MODEL_MAE_MPH,eccentricDurationSec,concentricDurationSec,landingStabilizationSec,returnToUprightSec}
}

// ---------------------------------------------------------------------------
// CMJ classification -- previously duplicated byte-for-byte in app/coach/page.tsx:73-98 and
// app/pitcher/page.tsx:57-86 (two copies of the same thresholds and logic, kept in sync by
// hand). Consolidated here as the one implementation; both pages import it.
// ---------------------------------------------------------------------------

export type CMJTierThresholds = { aboveAverage:number, good:number, developing:number }

export const CMJ_THRESHOLDS: { jumpHeight:CMJTierThresholds, ppKg:CMJTierThresholds, rsi:CMJTierThresholds } = {
  jumpHeight:{ aboveAverage:21, good:18, developing:15 },
  ppKg:{ aboveAverage:70, good:62, developing:55 },
  rsi:{ aboveAverage:0.86, good:0.64, developing:0.45 },
}

export function getTier(val:number, thresholds:CMJTierThresholds):string {
  if (!val) return 'No Data'
  if (val>=thresholds.aboveAverage) return 'Above Average'
  if (val>=thresholds.good) return 'Good'
  if (val>=thresholds.developing) return 'Developing'
  return 'Limited'
}

export type CMJClassification = { classification:string, jumpTier:string, ppTier:string, rsiTier:string }

export function classifyCMJ(cmj:any): CMJClassification {
  if (!cmj) return {classification:'No Data',jumpTier:'No Data',ppTier:'No Data',rsiTier:'No Data'}
  const jumpTier=getTier(cmj.jump_height_in,CMJ_THRESHOLDS.jumpHeight)
  const ppTier=getTier(cmj.peak_power_per_kg,CMJ_THRESHOLDS.ppKg)
  const rsiTier=getTier(cmj.rsi_mod,CMJ_THRESHOLDS.rsi)
  const isRateLimited=cmj.rsi_mod<CMJ_THRESHOLDS.rsi.developing&&cmj.peak_power_per_kg>=CMJ_THRESHOLDS.ppKg.good
  const isMagnitudeLimited=cmj.peak_power_per_kg<CMJ_THRESHOLDS.ppKg.developing&&cmj.rsi_mod>=CMJ_THRESHOLDS.rsi.developing
  const isBothLimited=cmj.rsi_mod<CMJ_THRESHOLDS.rsi.developing&&cmj.peak_power_per_kg<CMJ_THRESHOLDS.ppKg.developing
  const isWellDeveloped=cmj.rsi_mod>=CMJ_THRESHOLDS.rsi.good&&cmj.peak_power_per_kg>=CMJ_THRESHOLDS.ppKg.good
  let classification='Developing'
  if (isBothLimited) classification='Both Limited'
  else if (isRateLimited) classification='Rate Limiter'
  else if (isMagnitudeLimited) classification='Magnitude Limiter'
  else if (isWellDeveloped) classification='Well Developed'
  return {classification,jumpTier,ppTier,rsiTier}
}
