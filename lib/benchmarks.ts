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
// not part of the source benchmark data itself, just a sane bar range per metric.
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
  1:{label:'Tier 1 — Highest Predictive Power',desc:'Broad jump and lateral broad jump carry the strongest predictive signal of the metrics tracked here.'},
  2:{label:'Tier 2 — High Predictive Power',desc:'Sprint speed, strength, grip, and jump metrics.'},
  3:{label:'Tier 3 — Mobility Metrics',desc:'Lower predictive power on their own, but flag restriction that can cap the metrics above.'},
}

export function benchmarkStatus(def: BenchmarkDef, value: number | null | undefined): {label:string,color:string} | null {
  if (value==null || isNaN(value)) return null
  const dir = def.lowerIsBetter ? -1 : 1
  const v = value*dir
  const eliteThreshold = def.elite!=null ? def.elite*dir : (def.p75!=null ? def.p75*dir : null)
  const p50 = def.p50*dir
  if (eliteThreshold!=null && v>=eliteThreshold) return {label: def.elite!=null?'Elite':'Strong', color:'#39d353'}
  if (v>=p50) return {label:'Average or better', color:'#58a6ff'}
  return {label:'Below average', color:'#f85149'}
}

export function scalePct(def: BenchmarkDef, value: number): number {
  const clamped = Math.max(def.scaleMin, Math.min(def.scaleMax, value))
  return ((clamped - def.scaleMin) / (def.scaleMax - def.scaleMin)) * 100
}

// ---------------------------------------------------------------------------
// Power Tests — additive, separate tier model (Tour/Good/Marginal/Deficit),
// not part of the TopVelocity Tier 1/2/3 percentile system above.
//
// Sourcing: only a single top-tier "excellent"/"standard" anchor value was
// findable per test (TPI-adjacent, via web search — no full norms table with
// Good/Marginal/Deficit breakpoints is publicly available). Tour = that
// anchor; Good/Marginal are constructed as 90%/75% bands below it, confirmed
// with the coach rather than sourced. Not a claim these are official numbers.
// ---------------------------------------------------------------------------

export type PowerTestTier = 'Tour' | 'Good' | 'Marginal' | 'Deficit'

export type PowerTestDef = {
  key: string
  label: string
  unit: string
  description: string
  tourMin: number
  goodMin: number
  marginalMin: number
  // Vertical Jump reuses the existing Tier 2 benchmark's stored value instead of
  // asking a coach to log the same physical test twice under two grading systems.
  reuseKey?: BenchmarkKey
}

export const POWER_TESTS: PowerTestDef[] = [
  {key:'vertical_jump_power_in',label:'Vertical Jump',unit:'in',description:'Standing vertical jump, no step-in — measures lower body power. Same test and value as the Vertical Jump benchmark above; no separate test needed, just log it once.',tourMin:22,goodMin:19.8,marginalMin:16.5,reuseKey:'vertical_jump_in'},
  {key:'mb_seated_chest_pass_ft',label:'MB Seated Chest Pass',unit:'ft',description:'Sit on the ground with legs straight out and back against a wall. Chest-pass a medicine ball forward as far as possible. Measures upper body pushing power.',tourMin:17,goodMin:15.3,marginalMin:12.75},
  {key:'mb_situp_throw_ft',label:'MB Sit-Up & Throw',unit:'ft',description:'Lie on your back with knees bent, medicine ball held at the chest. Perform a sit-up and release the ball at the top of the motion for distance. Measures core-to-upper-body power transfer.',tourMin:22,goodMin:19.8,marginalMin:16.5},
  {key:'mb_rotational_pass_ft',label:'MB Rotational Pass',unit:'ft',description:'Stand sideways to the target, load into the back hip, then rotate through the core and release a medicine ball for distance. Measures rotational power similar to the pitching/throwing motion.',tourMin:33,goodMin:29.7,marginalMin:24.75},
]

export function powerTestTier(def: PowerTestDef, value: number | null | undefined): PowerTestTier | null {
  if (value==null || isNaN(value)) return null
  if (value>=def.tourMin) return 'Tour'
  if (value>=def.goodMin) return 'Good'
  if (value>=def.marginalMin) return 'Marginal'
  return 'Deficit'
}

export const POWER_TIER_COLORS: Record<PowerTestTier,string> = {
  Tour:'#39d353', Good:'#58a6ff', Marginal:'#e8b84b', Deficit:'#f85149',
}

// ---------------------------------------------------------------------------
// Mobility/Stability Screens — pass/fail-style qualitative screens (the TPI
// screening battery), modeled as a status per screen rather than forced into
// the numeric benchmark bar above. `key` matches the column name on the
// mobility_screens table.
// ---------------------------------------------------------------------------

export type ScreenStatus = 'Pass' | 'Limited' | 'Fail'

export type MobilityScreenDef = { key: string, label: string, description: string }

// Descriptions are generic framing for these standard, widely-used screen names —
// not transcribed from a specific proprietary manual. Adjust wording to match your
// own coaching cues if you'd prefer different phrasing.
export const MOBILITY_SCREENS: MobilityScreenDef[] = [
  {key:'pelvic_tilt',label:'Pelvic Tilt',description:'Standing, actively tilt the pelvis forward and back through its full range. Checks lumbo-pelvic control.'},
  {key:'pelvic_rotation',label:'Pelvic Rotation',description:'Standing, rotate the pelvis side to side while keeping the shoulders still. Checks hip/trunk dissociation.'},
  {key:'lower_quarter_rotation',label:'Lower Quarter Rotation',description:'Seated with knees together, rotate the lower leg and foot inward and outward. Checks hip internal/external rotation.'},
  {key:'toe_touch',label:'Toe Touch',description:'Standing with knees straight, bend forward and reach toward the toes. Checks posterior chain (hamstring/low back) flexibility.'},
  {key:'seated_trunk_rotation',label:'Seated Trunk Rotation',description:'Seated with a bar or club across the shoulders, rotate the trunk each direction. Checks thoracic rotation with the hips locked out.'},
  {key:'torso_rotation',label:'Torso Rotation',description:'Standing, rotate the upper body each direction while keeping the hips stable. Checks standing thoracic rotation.'},
  {key:'lat_length',label:'Lat Length',description:'Lying on the back, raise both arms straight overhead. Checks lat and shoulder flexion range.'},
  {key:'shoulder_90_90',label:'90/90 Shoulder',description:'Arm out at 90° with the elbow bent 90°, rotate the shoulder internally and externally. Checks shoulder rotational range.'},
  {key:'single_leg_balance',label:'Single Leg Balance',description:'Stand on one leg, eyes open then eyes closed. Checks single-leg stability and proprioception.'},
  {key:'overhead_deep_squat',label:'Overhead Deep Squat',description:'Arms overhead, squat as deep as possible while keeping heels down and arms up. Checks the full-body mobility pattern.'},
  {key:'bridge_leg_extension',label:'Bridge + Leg Extension',description:'From a glute bridge position, extend one leg straight out while holding hip height. Checks glute and core stability.'},
  {key:'cervical_rotation',label:'Cervical Rotation',description:'Rotate the head and neck as far as possible each direction. Checks cervical spine mobility.'},
  {key:'forearm_rotation',label:'Forearm Rotation',description:'Elbow tucked at the side, rotate the forearm from palm-up to palm-down. Checks pronation/supination range.'},
  {key:'wrist_hinge',label:'Wrist Hinge',description:'Forearm supported on a table, deviate the wrist side to side (toward the thumb, then toward the pinky). Checks radial/ulnar deviation.'},
  {key:'wrist_flex_ext',label:'Wrist Flex/Ext',description:'Forearm supported on a table, bend the wrist up and down through its full range. Checks flexion/extension range.'},
]

export const SCREEN_STATUS_COLORS: Record<ScreenStatus,string> = {
  Pass:'#39d353', Limited:'#e8b84b', Fail:'#f85149',
}
