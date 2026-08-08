export type BenchmarkKey =
  | 'broad_jump_in' | 'lateral_broad_jump_lr_in'
  | 'sprint_10yd_sec' | 'total_body_strength_lbs' | 'shoulder_er_ir_lbs'
  | 'vertical_jump_in' | 'vertical_jump_225_in'
  | 'grip_strength_right_lbs' | 'grip_strength_left_lbs' | 'wingspan_in'
  | 'hip_rotation_trail_deg' | 'hip_rotation_lead_deg' | 'shoulder_rotation_deg'

export type BenchmarkDef = {
  key: BenchmarkKey
  label: string
  unit: string
  tier: 1 | 2 | 3
  p50: number
  p75?: number
  elite?: number
  mlbAvg?: number
  normalRange?: [number, number]
  lowerIsBetter?: boolean
  scaleMin: number
  scaleMax: number
}

// scaleMin/scaleMax are a display convenience (roughly 1.3x the highest reference point) —
// not part of the TopVelocity data itself, just a sane bar range per metric.
export const BENCHMARKS: BenchmarkDef[] = [
  {key:'broad_jump_in',label:'Broad Jump',unit:'in',tier:1,p50:96,scaleMin:0,scaleMax:130},
  {key:'lateral_broad_jump_lr_in',label:'Lateral Broad Jump (L+R)',unit:'in',tier:1,p50:156,scaleMin:0,scaleMax:210},
  {key:'sprint_10yd_sec',label:'10-Yard Sprint',unit:'sec',tier:2,p50:1.70,elite:1.60,lowerIsBetter:true,scaleMin:1.3,scaleMax:2.1},
  {key:'total_body_strength_lbs',label:'Total Body Strength (Squat + Bench + Deadlift)',unit:'lbs',tier:2,p50:400,scaleMin:0,scaleMax:650},
  {key:'shoulder_er_ir_lbs',label:'Shoulder ER/IR Strength',unit:'lbs',tier:2,p50:63,scaleMin:0,scaleMax:100},
  {key:'vertical_jump_in',label:'Vertical Jump',unit:'in',tier:2,p50:26,mlbAvg:24.4,scaleMin:0,scaleMax:36},
  {key:'vertical_jump_225_in',label:'Vertical Jump @225 lbs',unit:'in',tier:2,p50:20,p75:22,scaleMin:0,scaleMax:30},
  {key:'grip_strength_right_lbs',label:'Grip Strength (Right)',unit:'lbs',tier:2,p50:105,p75:120,scaleMin:0,scaleMax:160},
  {key:'grip_strength_left_lbs',label:'Grip Strength (Left)',unit:'lbs',tier:2,p50:105,p75:115,scaleMin:0,scaleMax:160},
  {key:'wingspan_in',label:'Wingspan',unit:'in',tier:2,p50:72,scaleMin:60,scaleMax:84},
  {key:'hip_rotation_trail_deg',label:'Hip Total Rotation (Trail Leg)',unit:'°',tier:3,p50:67,scaleMin:0,scaleMax:100},
  {key:'hip_rotation_lead_deg',label:'Hip Total Rotation (Lead Leg)',unit:'°',tier:3,p50:65,scaleMin:0,scaleMax:100},
  {key:'shoulder_rotation_deg',label:'Shoulder Total Rotation',unit:'°',tier:3,p50:150,normalRange:[160,180],scaleMin:0,scaleMax:200},
]

export const TIER_INFO: Record<1|2|3,{label:string,desc:string}> = {
  1:{label:'Tier 1 — Highest Predictive Power',desc:'Broad jump and lateral broad jump carry the strongest signal in the TopVelocity model.'},
  2:{label:'Tier 2 — High Predictive Power',desc:'Sprint speed, strength, grip, and jump metrics.'},
  3:{label:'Tier 3 — Mobility Metrics',desc:'Lower predictive power on their own, but flag restriction that can cap the metrics above.'},
}

export function benchmarkStatus(def: BenchmarkDef, value: number | null | undefined): {label:string,color:string} | null {
  if (value==null || isNaN(value)) return null
  const dir = def.lowerIsBetter ? -1 : 1
  const v = value*dir
  const eliteThreshold = def.elite!=null ? def.elite*dir : (def.p75!=null ? def.p75*dir : null)
  const p50 = def.p50*dir
  if (eliteThreshold!=null && v>=eliteThreshold) return {label: def.elite!=null?'Elite':'At/above p75', color:'#39d353'}
  if (v>=p50) return {label:'At/above p50', color:'#58a6ff'}
  return {label:'Below p50', color:'#f85149'}
}

export function scalePct(def: BenchmarkDef, value: number): number {
  const clamped = Math.max(def.scaleMin, Math.min(def.scaleMax, value))
  return ((clamped - def.scaleMin) / (def.scaleMax - def.scaleMin)) * 100
}
