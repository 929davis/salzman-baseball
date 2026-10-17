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

// --- This is a CEILING estimate, not an average prediction ---
// Earlier versions of this formula were a mean regression (ordinary least squares): by
// construction, about half of real athletes throw harder than a mean fit and half throw
// softer. That's the wrong shape for "this is roughly the hardest you'd expect this athlete to
// throw, given mechanical efficiency is never 100%" -- for that, the real athlete should
// RARELY exceed the number, not do so about half the time. That requires a different
// statistical fit entirely: quantile regression at a high percentile (here, the 95th), not a
// mean fit.
//
// Refit on Driveline's OpenBiomechanics "high_performance" dataset, College-level pitchers only
// (n=272/445 rows), as a 95th-percentile quantile regression of velocity on peak power/kg
// (Sayers equation, since we have no force plate) and body weight. Validated via 30
// athlete-grouped resamples: held-out real athletes exceeded the predicted ceiling only ~5% of
// the time (median), matching the intended 95th-percentile design. In-sample exceedance on the
// full dataset: 5.4%.
//
// Jump height was tested as a 3rd predictor and dropped: at this quantile, its coefficient was
// unstable across resamples (median slightly negative, range -0.098 to +0.21 -- i.e. it
// sometimes said taller jumps meant a LOWER ceiling, which is nonsensical and just reflects
// that 272 athletes isn't enough data to pin down 3 variables at an extreme quantile). PP/BM
// alone already captures most of what jump height would add (it's computed partly FROM jump
// height via the Sayers equation), so dropping it fixed the instability without losing real
// signal: PP/BM's own coefficient stayed reliably positive (0.074 to 0.268) across every resample.
//
// A 2024 peer-reviewed study (Sakurai, Qiao, Szymanski & Crotin, JSCR 38(7)) found concentric
// impulse in the first 100ms (CI-100) correlates with fastball velocity at r≈0.71 in D1
// pitchers. CI-100 needs a force plate and isn't available from video, so it stays excluded.
//
// This ceiling is expected to be exceeded occasionally -- that's the design, not a bug. One
// real local athlete (Blake Armstrong, PP/BM≈55) exceeded his predicted ceiling by ~5 mph; a
// handful of real athletes are legitimately that efficient, and a model built to be "almost
// never wrong" would be useless (it would have to predict absurdly high for everyone). ~1 in 20
// real athletes exceeding it is the model working as intended, not a sign it needs raising again.
export const CMJ_VELOCITY_CEILING_EXCEEDANCE_PCT=5

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
  const ev=68.2015+(0.1727*ppkg)+(0.0604*massLbs)
  // Timing-only metrics from the optional phase events. undefined when the coach hasn't
  // entered that timestamp -- never inferred or defaulted, per "display as unavailable rather
  // than inventing a value."
  const eccentricDurationSec=bottomTime!=null?bottomTime-startTime:undefined
  const concentricDurationSec=bottomTime!=null?takeoffTime-bottomTime:undefined
  const landingStabilizationSec=stabilizationTime!=null?stabilizationTime-landingTime:undefined
  const returnToUprightSec=uprightTime!=null?uprightTime-landingTime:undefined
  // Concentric impulse, FULL PHASE -- not CI-100. CI-100 specifically measures force in the
  // first 100ms of the concentric phase; that requires a continuous force or position curve
  // (force plate or frame-by-frame pose tracking), which two timestamps can't give us. This is
  // a different, legitimate physics estimate of the TOTAL impulse across the whole concentric
  // phase, derived from the impulse-momentum theorem: net impulse = mass*takeoff_velocity (since
  // vertical velocity is ~0 at the bottom of the squat), and ground-reaction impulse also has to
  // overcome gravity for the full duration of the push, so + mass*g*concentric_duration.
  // Do not compare this to the Sakurai et al. CI-100 finding (r≈0.71) -- that study measured a
  // different, narrower window of the same phase.
  const concentricImpulseNs=concentricDurationSec!=null?(massKg*tv)+(massKg*9.81*concentricDurationSec):undefined
  return{flightTime:ft,propulsionDurationSec:ttt,jumpHeightIn:jhi,rsiMod:rsi,peakPowerPerKg:ppkg,takeoffVelocity:tv,explosiveIndex:ei,estimatedVelocity:ev,estimatedVelocityExceedancePct:CMJ_VELOCITY_CEILING_EXCEEDANCE_PCT,eccentricDurationSec,concentricDurationSec,landingStabilizationSec,returnToUprightSec,concentricImpulseNs}
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
