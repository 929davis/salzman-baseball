// Repeated Hop Test -- same measurement philosophy as the CMJ module (lib/cmj.ts): coach or
// athlete scrubs video and enters timestamps by hand, no pose-tracking/force-plate involved.
// Protocol: standing jump into a series of repeated hops, landing back on the same spot each
// time. The coach enters each hop's landing (ground contact start) and takeoff (ground contact
// end) timestamp, in order.
//
// IMPORTANT: this is a DIFFERENT RSI formula than the CMJ module's "RSI-Modified". Per the spec
// ("do not assume every hop test uses the same RSI definition"):
//   - CMJ's RSI-Modified = jump height / time-to-takeoff (lib/cmj.ts's `rsi`).
//   - This module's RSI (classic "Reactive Strength Index") = flight time / ground contact time.
// They measure different things and are not comparable to each other.

export type HopLimb='left'|'right'|'both'

export type HopEntry={
  landingTime:number   // ground contact start, in seconds
  takeoffTime:number   // ground contact end / start of flight, in seconds
  limb?:HopLimb
}

// Validates that hops are internally consistent (landing before takeoff) and chronologically
// ordered (each hop's landing comes after the previous hop's takeoff). Returns an error message
// naming the problem hop, or null if the sequence is valid.
export function validateHopSequence(hops:HopEntry[]):string|null{
  if (hops.length===0) return 'Enter at least one hop.'
  for (let i=0;i<hops.length;i++){
    const h=hops[i]
    if (isNaN(h.landingTime)||isNaN(h.takeoffTime)) return `Hop ${i+1}: check your inputs.`
    if (h.takeoffTime<=h.landingTime) return `Hop ${i+1}: takeoff must come after landing.`
    if (i>0&&h.landingTime<=hops[i-1].takeoffTime) return `Hop ${i+1}: landing must come after the previous hop's takeoff.`
  }
  return null
}

export type HopMetrics={
  groundContactSec:number
  // Time from this hop's takeoff to the NEXT hop's landing. Undefined for the last hop in the
  // sequence -- there's no following landing to measure it against, so it's left unavailable
  // rather than guessed.
  flightSec?:number
  flightTimeJumpHeightIn?:number
  // Classic RSI = flight time / ground contact time. Undefined wherever flightSec is undefined.
  rsi?:number
  limb?:HopLimb
}

export function calcHopMetrics(hops:HopEntry[]):HopMetrics[]{
  return hops.map((h,i)=>{
    const groundContactSec=h.takeoffTime-h.landingTime
    const next=hops[i+1]
    const flightSec=next?next.landingTime-h.takeoffTime:undefined
    const flightTimeJumpHeightIn=flightSec!=null?(9.81*flightSec*flightSec)/8*39.3701:undefined
    const rsi=flightSec!=null?flightSec/groundContactSec:undefined
    return {groundContactSec,flightSec,flightTimeJumpHeightIn,rsi,limb:h.limb}
  })
}

export type HopTestSummary={
  validHopCount:number
  avgGroundContactSec:number
  bestGroundContactSec:number
  avgRsi?:number
  bestRsi?:number
  // Coefficient of variation across hops with a defined RSI: stdev/mean, as a percentage.
  // Lower = more consistent trial-to-trial. Undefined with fewer than 2 RSI values.
  rsiConsistencyPct?:number
  leftAvgRsi?:number
  rightAvgRsi?:number
}

export function summarizeHopTest(metrics:HopMetrics[]):HopTestSummary{
  const validHopCount=metrics.length
  const contactTimes=metrics.map(m=>m.groundContactSec)
  const avgGroundContactSec=contactTimes.reduce((a,b)=>a+b,0)/contactTimes.length
  const bestGroundContactSec=Math.min(...contactTimes)
  const rsiValues=metrics.map(m=>m.rsi).filter((v):v is number=>v!=null)
  let avgRsi:number|undefined,bestRsi:number|undefined,rsiConsistencyPct:number|undefined
  if (rsiValues.length>0){
    avgRsi=rsiValues.reduce((a,b)=>a+b,0)/rsiValues.length
    bestRsi=Math.max(...rsiValues)
  }
  if (rsiValues.length>1&&avgRsi){
    const mean=avgRsi
    const variance=rsiValues.reduce((sum,v)=>sum+(v-mean)**2,0)/rsiValues.length
    rsiConsistencyPct=(Math.sqrt(variance)/mean)*100
  }
  const leftRsi=metrics.filter(m=>m.limb==='left'&&m.rsi!=null).map(m=>m.rsi as number)
  const rightRsi=metrics.filter(m=>m.limb==='right'&&m.rsi!=null).map(m=>m.rsi as number)
  const leftAvgRsi=leftRsi.length?leftRsi.reduce((a,b)=>a+b,0)/leftRsi.length:undefined
  const rightAvgRsi=rightRsi.length?rightRsi.reduce((a,b)=>a+b,0)/rightRsi.length:undefined
  return {validHopCount,avgGroundContactSec,bestGroundContactSec,avgRsi,bestRsi,rsiConsistencyPct,leftAvgRsi,rightAvgRsi}
}
