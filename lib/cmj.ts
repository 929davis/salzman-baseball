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

// Refit against Driveline's OpenBiomechanics "high_performance" dataset, College-level
// pitchers only (n=272, athlete-grouped train/test split, 30 resamples): jump height, peak
// power/kg (Sayers equation, since we have no force plate), and body weight. Cross-validated
// MAE≈3.9 mph, R²≈0.20 -- a real but modest improvement over predicting the population mean
// (MAE≈4.8 mph). RSI-Mod was tested and dropped: it added no predictive value in this dataset.
// Known gap: a 2024 peer-reviewed study (Sakurai, Qiao, Szymanski & Crotin, JSCR 38(7)) found
// concentric impulse in the first 100ms (CI-100) correlates with fastball velocity at r≈0.71
// in D1 pitchers specifically -- stronger than anything fit here. CI-100 requires a force
// plate and isn't in this dataset, so it's excluded. This output is a video-estimated model
// prediction, not a measurement -- treat it as provisional, not authoritative.
export const CMJ_VELOCITY_MODEL_MAE_MPH=3.9
export const calcCMJFn=({startTime,takeoffTime,landingTime,massKg}:{startTime:number,takeoffTime:number,landingTime:number,massKg:number})=>{
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
  const ev=49.17+(0.123*jhc)+(0.291*ppkg)+(0.0626*massLbs)
  return{flightTime:ft,jumpHeightIn:jhi,rsiMod:rsi,peakPowerPerKg:ppkg,takeoffVelocity:tv,explosiveIndex:ei,estimatedVelocity:ev,estimatedVelocityMarginMph:CMJ_VELOCITY_MODEL_MAE_MPH}
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
