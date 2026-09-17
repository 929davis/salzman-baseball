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

// Coefficients recalibrated against Driveline's OpenBiomechanics dataset (444 college
// pitchers, "high_performance" subset). We have no force plate, so peak power/kg (ppkg) and
// RSI-mod (rsi) were derived from a simulated flight-time pipeline rather than measured
// directly, then regressed against that dataset's velocity using the Sayers equation for
// power estimation. Cross-validated R²≈0.19, typical error ±5.3 mph — a rough estimate, not
// a validated model. (The public no-login CMJ demo that used to feed a re-fitting dataset
// was removed -- re-fitting would need a new real data source if pursued later.)
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
  const ev=18.684+(0.9543*ppkg)+(93.1773*rsi)+(-1.3367*ei)
  return{flightTime:ft,jumpHeightIn:jhi,rsiMod:rsi,peakPowerPerKg:ppkg,takeoffVelocity:tv,explosiveIndex:ei,estimatedVelocity:ev}
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
