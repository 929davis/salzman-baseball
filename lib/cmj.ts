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
// a validated model, pending re-fitting against our own public_cmj_submissions data.
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
