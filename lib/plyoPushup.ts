// Plyometric Push-Up -- same measurement philosophy as CMJ and Hop Test (lib/cmj.ts,
// lib/hopTest.ts): coach or athlete scrubs video and enters timestamps by hand, no
// pose-tracking/force-plate involved.
//
// Protocol: a series of repeated plyo push-ups. Each rep starts with hands already on the
// ground (contact), lowers to the bottom of the chest dip, explodes so the hands leave the
// ground, flies, and lands again -- which is the next rep's contact (or, for the final rep,
// `finalContactTime` below). An optional stabilization timestamp can be entered for the moment
// the athlete settles after the very last landing.

export type PushupRep={
  contactTime:number   // hands touch the ground -- start of this rep
  bottomTime?:number   // optional: bottom of the lowering phase (needed to split lowering vs. propulsion)
  leaveTime:number     // hands leave the ground -- takeoff into flight
}

export type PlyoPushupInput={
  reps:PushupRep[]
  finalContactTime:number     // the landing that ends the LAST rep's flight
  stabilizationTime?:number   // optional: when the athlete fully stabilizes after finalContactTime
}

// Validates internal rep ordering (contact < bottom < leave), chronological ordering between
// reps, and that finalContactTime/stabilizationTime come after everything else. Returns an
// error message naming the problem, or null if valid.
export function validatePlyoPushupSequence(input:PlyoPushupInput):string|null{
  const {reps,finalContactTime,stabilizationTime}=input
  if (reps.length===0) return 'Enter at least one rep.'
  for (let i=0;i<reps.length;i++){
    const r=reps[i]
    if (isNaN(r.contactTime)||isNaN(r.leaveTime)) return `Rep ${i+1}: check your inputs.`
    if (r.bottomTime!=null){
      if (isNaN(r.bottomTime)) return `Rep ${i+1}: check your inputs.`
      if (r.bottomTime<=r.contactTime) return `Rep ${i+1}: bottom of the lowering phase must come after hands contact the ground.`
      if (r.leaveTime<=r.bottomTime) return `Rep ${i+1}: hands leaving the ground must come after the bottom of the lowering phase.`
    } else if (r.leaveTime<=r.contactTime){
      return `Rep ${i+1}: hands leaving the ground must come after hands contact the ground.`
    }
    const nextContact=i+1<reps.length?reps[i+1].contactTime:finalContactTime
    if (isNaN(nextContact)) return `Rep ${i+1}: check your inputs.`
    if (nextContact<=r.leaveTime) return `Rep ${i+1}: the next landing must come after this rep's hands leave the ground.`
  }
  if (stabilizationTime!=null&&!isNaN(stabilizationTime)&&stabilizationTime<=finalContactTime){
    return 'Stabilization time must come after the final landing.'
  }
  return null
}

export type PushupRepMetrics={
  groundContactSec:number       // leaveTime - contactTime: how long hands were on the ground this rep
  loweringDurationSec?:number   // bottomTime - contactTime, only when bottomTime is entered
  propulsionDurationSec?:number // leaveTime - bottomTime, only when bottomTime is entered
  flightSec:number              // next rep's contactTime (or finalContactTime for the last rep) - this rep's leaveTime
}

export function calcPlyoPushupMetrics(input:PlyoPushupInput):PushupRepMetrics[]{
  const {reps,finalContactTime}=input
  return reps.map((r,i)=>{
    const groundContactSec=r.leaveTime-r.contactTime
    const loweringDurationSec=r.bottomTime!=null?r.bottomTime-r.contactTime:undefined
    const propulsionDurationSec=r.bottomTime!=null?r.leaveTime-r.bottomTime:undefined
    const nextContact=i+1<reps.length?reps[i+1].contactTime:finalContactTime
    const flightSec=nextContact-r.leaveTime
    return {groundContactSec,loweringDurationSec,propulsionDurationSec,flightSec}
  })
}

export type PlyoPushupSummary={
  repCount:number
  avgGroundContactSec:number
  bestGroundContactSec:number
  avgFlightSec:number
  bestFlightSec:number
  // Coefficient of variation of flight time across reps: stdev/mean as a percentage. Lower =
  // more consistent trial-to-trial. Undefined with fewer than 2 reps.
  flightConsistencyPct?:number
  stabilizationSec?:number
}

export function summarizePlyoPushupTest(metrics:PushupRepMetrics[],stabilizationTime:number|undefined,finalContactTime:number):PlyoPushupSummary{
  const repCount=metrics.length
  const contactTimes=metrics.map(m=>m.groundContactSec)
  const flightTimes=metrics.map(m=>m.flightSec)
  const avgGroundContactSec=contactTimes.reduce((a,b)=>a+b,0)/contactTimes.length
  const bestGroundContactSec=Math.min(...contactTimes)
  const avgFlightSec=flightTimes.reduce((a,b)=>a+b,0)/flightTimes.length
  const bestFlightSec=Math.max(...flightTimes)
  let flightConsistencyPct:number|undefined
  if (flightTimes.length>1){
    const mean=avgFlightSec
    const variance=flightTimes.reduce((sum,v)=>sum+(v-mean)**2,0)/flightTimes.length
    flightConsistencyPct=(Math.sqrt(variance)/mean)*100
  }
  const stabilizationSec=stabilizationTime!=null?stabilizationTime-finalContactTime:undefined
  return {repCount,avgGroundContactSec,bestGroundContactSec,avgFlightSec,bestFlightSec,flightConsistencyPct,stabilizationSec}
}
