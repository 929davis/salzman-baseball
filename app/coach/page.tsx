'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import PitchingIQ from '@/app/components/PitchingIQ'

const C = {
  bg:'#0d1117',bg2:'#161b22',bg3:'#1c2333',border:'#30363d',
  gold:'#e8b84b',goldDim:'#a07c28',goldBg:'rgba(232,184,75,0.08)',
  teal:'#39d353',tealDim:'#1a6b29',
  red:'#f85149',redBg:'rgba(248,81,73,0.1)',
  blue:'#58a6ff',blueBg:'rgba(88,166,255,0.08)',
  purple:'#a371f7',purpleBg:'rgba(163,113,247,0.08)',
  text:'#e6edf3',textMuted:'#7d8590',textDim:'#484f58',white:'#ffffff',
}

const armCare = (n:number,v:number) => (!n||!v)?0:Math.round(n*Math.pow(v,2)*0.01*1.25*1.25)

const CATEGORIES = [
  { key:'Pre-Throwing',   color:'#38bdf8', bg:'rgba(56,189,248,0.10)',  border:'rgba(56,189,248,0.35)'  },
  { key:'Throwing',       color:'#39d353', bg:'rgba(57,211,83,0.10)',   border:'rgba(57,211,83,0.35)'   },
  { key:'Post-Throwing',  color:'#34d399', bg:'rgba(52,211,153,0.10)',  border:'rgba(52,211,153,0.35)'  },
  { key:'Main Exercises', color:'#e8b84b', bg:'rgba(232,184,75,0.10)', border:'rgba(232,184,75,0.35)'  },
  { key:'Accessory',      color:'#a371f7', bg:'rgba(163,113,247,0.10)',border:'rgba(163,113,247,0.35)' },
  { key:'Conditioning',   color:'#58a6ff', bg:'rgba(88,166,255,0.10)', border:'rgba(88,166,255,0.35)'  },
  { key:'Recovery',       color:'#f97316', bg:'rgba(249,115,22,0.10)', border:'rgba(249,115,22,0.35)'  },
]
const CAT_MAP:Record<string,typeof CATEGORIES[0]> = Object.fromEntries(CATEGORIES.map(c=>[c.key,c]))

const CNS_COLORS:Record<string,{bg:string,border:string,text:string,dot:string}> = {
  'High':     { bg:'rgba(248,81,73,0.12)',  border:'rgba(248,81,73,0.5)',  text:'#f85149', dot:'#f85149' },
  'Moderate': { bg:'rgba(232,184,75,0.12)', border:'rgba(232,184,75,0.5)', text:'#e8b84b', dot:'#e8b84b' },
  'Low':      { bg:'rgba(57,211,83,0.12)',  border:'rgba(57,211,83,0.5)',  text:'#39d353', dot:'#39d353' },
}

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

const CMJ_THRESHOLDS = {
  jumpHeight:{ aboveAverage:21, good:18, developing:15 },
  ppKg:{ aboveAverage:70, good:62, developing:55 },
  rsi:{ aboveAverage:0.86, good:0.64, developing:0.45 },
}

function classifyCMJ(cmj:any):{classification:string,jumpTier:string,ppTier:string,rsiTier:string}{
  if (!cmj) return {classification:'No Data',jumpTier:'No Data',ppTier:'No Data',rsiTier:'No Data'}
  const getTier=(val:number,thresholds:{aboveAverage:number,good:number,developing:number})=>{
    if (!val) return 'No Data'
    if (val>=thresholds.aboveAverage) return 'Above Average'
    if (val>=thresholds.good) return 'Good'
    if (val>=thresholds.developing) return 'Developing'
    return 'Limited'
  }
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

const TIER_COLORS:Record<string,{bg:string,border:string,text:string}> = {
  'Above Average':{bg:'rgba(57,211,83,0.12)',border:'rgba(57,211,83,0.4)',text:'#39d353'},
  'Good':{bg:'rgba(88,166,255,0.12)',border:'rgba(88,166,255,0.4)',text:'#58a6ff'},
  'Developing':{bg:'rgba(232,184,75,0.12)',border:'rgba(232,184,75,0.4)',text:'#e8b84b'},
  'Limited':{bg:'rgba(248,81,73,0.12)',border:'rgba(248,81,73,0.4)',text:'#f85149'},
  'No Data':{bg:'rgba(72,79,88,0.12)',border:'rgba(72,79,88,0.4)',text:'#484f58'},
}

const CLASS_COLORS:Record<string,{bg:string,border:string,text:string}> = {
  'Well Developed':{bg:'rgba(57,211,83,0.1)',border:'rgba(57,211,83,0.35)',text:'#39d353'},
  'Rate Limiter':{bg:'rgba(88,166,255,0.1)',border:'rgba(88,166,255,0.35)',text:'#58a6ff'},
  'Magnitude Limiter':{bg:'rgba(232,184,75,0.1)',border:'rgba(232,184,75,0.35)',text:'#e8b84b'},
  'Both Limited':{bg:'rgba(248,81,73,0.1)',border:'rgba(248,81,73,0.35)',text:'#f85149'},
  'Developing':{bg:'rgba(163,113,247,0.1)',border:'rgba(163,113,247,0.35)',text:'#a371f7'},
  'No Data':{bg:'rgba(72,79,88,0.1)',border:'rgba(72,79,88,0.35)',text:'#7d8590'},
}

const MEAL_TYPE_COLORS:Record<string,string> = {
  'Pre-Training':'#58a6ff','Post-Training':'#39d353','Recovery Meal':'#a371f7','Regular Meal':'#e8b84b'
}

function scoreColor(score:number){
  if (score>=80) return '#39d353'
  if (score>=60) return '#e8b84b'
  if (score>=40) return '#f97316'
  return '#f85149'
}

const BUILT_IN_EXERCISES = [
  {id:'ex_001',name:'Barbell Back Squat',pattern:'Squat',category:'Main Exercises',cns:'High',description:'Stand with bar on upper traps, feet shoulder-width. Brace core, push knees out, descend until thighs parallel or below.'},
  {id:'ex_002',name:'Goblet Squat',pattern:'Squat',category:'Accessory',cns:'Moderate',description:'Hold KB at chest, feet slightly wider than shoulder-width. Squat deep, elbows track inside knees.'},
  {id:'ex_003',name:'Rear Foot Elevated Split Squat',pattern:'Lunge',category:'Main Exercises',cns:'Moderate',description:'Rear foot elevated on bench, front foot far enough forward so shin stays vertical.'},
  {id:'ex_004',name:'Lateral Lunge',pattern:'Lunge',category:'Accessory',cns:'Moderate',description:'Step wide to one side, push hips back and sit into the stepping leg.'},
  {id:'ex_005',name:'Barbell Conventional Deadlift',pattern:'Hinge',category:'Main Exercises',cns:'High',description:'Bar over mid-foot, hip-width stance. Hinge to grip, set back flat, drive floor away.'},
  {id:'ex_006',name:'Romanian Deadlift',pattern:'Hinge',category:'Main Exercises',cns:'Moderate',description:'Soft knee bend, push hips straight back maintaining flat back. Bar stays close.'},
  {id:'ex_007',name:'Single Leg RDL',pattern:'Hinge',category:'Accessory',cns:'Moderate',description:'Hinge on one leg, rear leg floats back as counterbalance.'},
  {id:'ex_008',name:'Sumo Deadlift',pattern:'Hinge',category:'Main Exercises',cns:'High',description:'Wide stance deadlift emphasizing inner thigh and hip strength.'},
  {id:'ex_009',name:'Trap Bar Deadlift',pattern:'Hinge',category:'Main Exercises',cns:'High',description:'Stand in center of trap bar. More upright than conventional, easier to learn.'},
  {id:'ex_010',name:'Kettlebell Swing',pattern:'Hinge',category:'Conditioning',cns:'High',description:'Ballistic hip hinge. Bell driven by hips not arms.'},
  {id:'ex_011',name:'Barbell Bench Press',pattern:'Horizontal Push',category:'Main Exercises',cns:'High',description:'Lie flat, grip slightly wider than shoulder-width. Lower bar to lower chest.'},
  {id:'ex_012',name:'1-Arm DB Bench Press',pattern:'Horizontal Push',category:'Accessory',cns:'Moderate',description:'Unilateral pressing that challenges rotational stability.'},
  {id:'ex_013',name:'Landmine Press',pattern:'Horizontal Push',category:'Accessory',cns:'Moderate',description:'Shoulder-friendly pressing variation with a natural arc.'},
  {id:'ex_014',name:'Incline Dumbbell Press',pattern:'Horizontal Push',category:'Accessory',cns:'Moderate',description:'Set bench to 30-45 degrees. Elbows at 45 degrees.'},
  {id:'ex_015',name:'Push-Up',pattern:'Horizontal Push',category:'Accessory',cns:'Low',description:'Hands slightly wider than shoulders, body in one rigid plank.'},
  {id:'ex_016',name:'Barbell Row',pattern:'Horizontal Pull',category:'Main Exercises',cns:'High',description:'Hinge to roughly 45 degrees. Pull bar to lower sternum, lead with elbows.'},
  {id:'ex_017',name:'Pendlay Row',pattern:'Horizontal Pull',category:'Main Exercises',cns:'High',description:'Strict horizontal row from the floor each rep.'},
  {id:'ex_018',name:'Single Arm DB Row',pattern:'Horizontal Pull',category:'Accessory',cns:'Moderate',description:'Supported unilateral row. Pull DB to hip, lead with elbow.'},
  {id:'ex_019',name:'Pull-Up',pattern:'Vertical Pull',category:'Main Exercises',cns:'Moderate',description:'Dead hang start. Pull until chin clears bar.'},
  {id:'ex_020',name:'Lat Pulldown',pattern:'Vertical Pull',category:'Accessory',cns:'Low',description:'Slight lean back, pull bar to upper chest.'},
  {id:'ex_021',name:'DB Shoulder Press',pattern:'Vertical Push',category:'Main Exercises',cns:'Moderate',description:'Press dumbbells from shoulder height to full lockout overhead.'},
  {id:'ex_022',name:'Power Clean',pattern:'Hinge',category:'Main Exercises',cns:'High',description:'Pull bar from floor, triple extend, catch in front rack.'},
  {id:'ex_023',name:'Hang Clean',pattern:'Hinge',category:'Main Exercises',cns:'High',description:'Power clean starting from hang position at mid-thigh.'},
  {id:'ex_024',name:'Med Ball Scoop Toss',pattern:'Rotation',category:'Conditioning',cns:'High',description:'Load into back hip, drive hips through, scoop ball upward and forward.'},
  {id:'ex_025',name:'Med Ball Rotational Chest Pass',pattern:'Rotation',category:'Conditioning',cns:'High',description:'Explosive rotational throw from parallel stance into wall.'},
  {id:'ex_026',name:'Med Ball Overhead Slam',pattern:'Rotation',category:'Conditioning',cns:'High',description:'Reach overhead then slam into ground using entire body.'},
  {id:'ex_027',name:'Med Ball Side Slam',pattern:'Rotation',category:'Conditioning',cns:'High',description:'Lateral rotational slam training same pattern as pitching.'},
  {id:'ex_028',name:'Landmine Rotational Press',pattern:'Rotation',category:'Conditioning',cns:'Moderate',description:'Rotational pressing from parallel stance.'},
  {id:'ex_029',name:'Broad Jump',pattern:'Locomotion',category:'Conditioning',cns:'High',description:'Horizontal plyometric training explosive hip extension.'},
  {id:'ex_030',name:'Triple Broad Jump',pattern:'Locomotion',category:'Conditioning',cns:'High',description:'Three consecutive broad jumps for maximum distance.'},
  {id:'ex_031',name:'Depth Jump',pattern:'Locomotion',category:'Conditioning',cns:'High',description:'Step off box, land and immediately jump as high as possible.'},
  {id:'ex_032',name:'Lateral Bound',pattern:'Locomotion',category:'Conditioning',cns:'High',description:'Jump from one foot to the other laterally.'},
  {id:'ex_033',name:'Skater Jump',pattern:'Locomotion',category:'Conditioning',cns:'High',description:'Continuous lateral bounds with brief hold on each landing.'},
  {id:'ex_034',name:'Pogo Hops',pattern:'Locomotion',category:'Conditioning',cns:'High',description:'Rapid low-amplitude bilateral hops. Minimal knee bend.'},
  {id:'ex_035',name:'30-Yard Sprint',pattern:'Locomotion',category:'Conditioning',cns:'High',description:'Short acceleration sprint. Drive phase first 10 yards.'},
  {id:'ex_036',name:'Dead Bug',pattern:'Core',category:'Accessory',cns:'Low',description:'Lie on back, arms up, knees at 90 degrees. Extend opposite arm and leg.'},
  {id:'ex_037',name:'Plank',pattern:'Core',category:'Accessory',cns:'Low',description:'Static anti-extension hold. Body in one rigid line.'},
  {id:'ex_038',name:'Side Plank',pattern:'Core',category:'Accessory',cns:'Low',description:'Lateral anti-flexion hold.'},
  {id:'ex_039',name:'Ab Wheel Rollout',pattern:'Core',category:'Accessory',cns:'Low',description:'Dynamic anti-extension. Roll forward until fully extended, pull back using lats and abs.'},
  {id:'ex_040',name:'Half-Kneeling Pallof Press',pattern:'Anti-Rotation',category:'Accessory',cns:'Low',description:'Anti-rotation press from split stance.'},
  {id:'ex_041',name:'Copenhagen Plank',pattern:'Anti-Rotation',category:'Accessory',cns:'Low',description:'Side plank with top leg elevated on bench.'},
  {id:'ex_042',name:'Bear Crawl',pattern:'Locomotion',category:'Pre-Throwing',cns:'Low',description:'Contralateral crawling. Knees hover 1 inch off floor.'},
  {id:'ex_043',name:'Lateral Ape Crawl',pattern:'Locomotion',category:'Pre-Throwing',cns:'Low',description:'Lateral crawling developing frontal plane stability.'},
  {id:'ex_044',name:'Spiderman Crawl',pattern:'Locomotion',category:'Pre-Throwing',cns:'Low',description:'Forward crawl where knee drives to outside elbow with each step.'},
  {id:'ex_045',name:'Crab Walk',pattern:'Locomotion',category:'Pre-Throwing',cns:'Low',description:'Posterior movement with hands and feet on floor, hips lifted.'},
  {id:'ex_046',name:'Band Pull-Apart',pattern:'Arm Care',category:'Pre-Throwing',cns:'Low',description:'Hold band at shoulder width, pull apart to chest while squeezing shoulder blades.'},
  {id:'ex_047',name:'Face Pull',pattern:'Arm Care',category:'Pre-Throwing',cns:'Low',description:'Pull rope to face while rotating elbows up and out.'},
  {id:'ex_048',name:'External Rotation at 90',pattern:'Arm Care',category:'Post-Throwing',cns:'Low',description:'Isolated rotator cuff with arm abducted to 90 degrees.'},
  {id:'ex_049',name:'Dumbbell Hammer Curl',pattern:'Arm Care',category:'Post-Throwing',cns:'Low',description:'Neutral grip curl targeting brachialis.'},
  {id:'ex_050',name:'Dumbbell Pronation',pattern:'Arm Care',category:'Post-Throwing',cns:'Low',description:'Offset grip. Forearm supported. Rotate from supinated to fully pronated.'},
  {id:'ex_051',name:'Dumbbell Supination',pattern:'Arm Care',category:'Post-Throwing',cns:'Low',description:'Offset grip. Rotate from pronated to fully supinated.'},
  {id:'ex_052',name:'Dumbbell Wrist Extension',pattern:'Arm Care',category:'Post-Throwing',cns:'Low',description:'Forearm supported, palm down. Raise wrist into extension.'},
  {id:'ex_053',name:'2-to-1 Eccentric Hammer Curl',pattern:'Arm Care',category:'Post-Throwing',cns:'Low',description:'Both hands up, one hand down over 4-5 seconds.'},
  {id:'ex_054',name:'2-to-1 Eccentric Rear Delt Fly',pattern:'Arm Care',category:'Post-Throwing',cns:'Low',description:'Both arms raise, one arm lowers over 4-5 seconds.'},
  {id:'ex_055',name:'Rear Delt Fly',pattern:'Arm Care',category:'Post-Throwing',cns:'Low',description:'Hinge forward, raise arms to sides leading with pinkies.'},
  {id:'ex_056',name:'Prone Y-T-W',pattern:'Arm Care',category:'Post-Throwing',cns:'Low',description:'Lying face down, arms form Y T and W positions lifting against gravity.'},
  {id:'ex_057',name:'Scapular Wall Slide',pattern:'Arm Care',category:'Pre-Throwing',cns:'Low',description:'Back against wall, slide arms overhead maintaining contact.'},
  {id:'ex_058',name:'Sleeper Stretch',pattern:'Mobility',category:'Recovery',cns:'Low',description:'Lie on throwing-arm side, use free hand to gently push forearm toward floor.'},
  {id:'ex_059',name:'Hip 90/90 Stretch',pattern:'Mobility',category:'Recovery',cns:'Low',description:'Sit with both legs at 90 degree angles. Transition between sides.'},
  {id:'ex_060',name:'Thoracic Spine Rotation',pattern:'Mobility',category:'Recovery',cns:'Low',description:'Improve thoracic rotation in quadruped seated or lying positions.'},
  {id:'ex_061',name:'Worlds Greatest Stretch',pattern:'Mobility',category:'Pre-Throwing',cns:'Low',description:'Multi-joint stretch combining hip flexor thoracic rotation and ankle mobility.'},
  {id:'td_001',name:'Two Knee Throw',pattern:'Throwing',category:'Throwing',cns:'Low',description:'Kneel on both knees. Throw using only trunk rotation and arm action.'},
  {id:'td_002',name:'One Knee Throw',pattern:'Throwing',category:'Throwing',cns:'Low',description:'Throwing-side knee down, glove-side foot forward.'},
  {id:'td_003',name:'Rocker Drill',pattern:'Throwing',category:'Throwing',cns:'Moderate',description:'Split stance. Rock weight back to front rhythmically.'},
  {id:'td_004',name:'Hover Throw',pattern:'Throwing',category:'Throwing',cns:'Moderate',description:'Balance on pivot foot with lead leg lifted. Hold 1-2 seconds then throw.'},
  {id:'td_005',name:'Split Stance Throw',pattern:'Throwing',category:'Throwing',cns:'Moderate',description:'Lead foot already planted at stride width. Throw from fixed position.'},
  {id:'td_006',name:'Walk Away Throw',pattern:'Throwing',category:'Throwing',cns:'Moderate',description:'Walk away from target, pivot and throw in one fluid motion.'},
  {id:'td_007',name:'Toss Up Throw',pattern:'Throwing',category:'Throwing',cns:'Moderate',description:'Toss ball slightly upward and catch in throwing hand as arm begins action.'},
  {id:'td_008',name:'Forward Hop Throw',pattern:'Throwing',category:'Throwing',cns:'High',description:'Hop forward on pivot foot, land, immediately throw upon landing.'},
  {id:'td_009',name:'Double Hop Throw',pattern:'Throwing',category:'Throwing',cns:'High',description:'Two consecutive hops pivot foot then lead foot throw immediately.'},
  {id:'apr_001',name:'POW Walks',pattern:'Locomotion',category:'Pre-Throwing',cns:'Low',description:'Contralateral walking with exaggerated arm swing.'},
  {id:'apr_002',name:'Band Pull Apart Arm Prep',pattern:'Arm Care',category:'Pre-Throwing',cns:'Low',description:'Pre-throwing band pull apart for scapular activation.'},
  {id:'apr_003',name:'Band Face Pull Arm Prep',pattern:'Arm Care',category:'Pre-Throwing',cns:'Low',description:'Pre-throwing face pull activating external rotators.'},
  {id:'apr_004',name:'Arm Swings',pattern:'Mobility',category:'Pre-Throwing',cns:'Low',description:'Swing both arms forward and back in controlled pendulum.'},
  {id:'apr_005',name:'Reverse Throws',pattern:'Throwing',category:'Post-Throwing',cns:'Moderate',description:'Simulate deceleration phase of throwing in reverse.'},
  {id:'apr_006',name:'Roll-In Throws',pattern:'Throwing',category:'Pre-Throwing',cns:'Low',description:'Underhand rolling motion from throwing position.'},
]

function parsePrinciples(text:string): Record<string,{sets:string,reps:string,load:string}> {
  const result:Record<string,{sets:string,reps:string,load:string}> = {}
  if (!text) return result
  const lines = text.split('\n')
  for (const line of lines) {
    const match = line.match(/^([^:0-9]+?)[\s:]+(\d+)\s*[x×]\s*(\d+)(?:\s*@\s*(\d+)%?)?/i)
    if (match) {
      const name = match[1].trim().toLowerCase()
      result[name] = { sets: match[2], reps: match[3], load: match[4]||'' }
    }
  }
  return result
}

function lookupPrescription(exerciseName:string, parsed:Record<string,{sets:string,reps:string,load:string}>) {
  const key = exerciseName.toLowerCase()
  if (parsed[key]) return parsed[key]
  for (const [k,v] of Object.entries(parsed)) {
    if (key.includes(k) || k.includes(key)) return v
  }
  return null
}

function Avatar({name,size=36}:{name:string,size?:number}){
  const ini=name.split(' ').map((w:string)=>w[0]).join('').toUpperCase().slice(0,2)
  const bgs=[C.goldDim,'#1a4a6b','#2d6a4f','#5a2080','#6b1a1a']
  return <div style={{width:size,height:size,borderRadius:'50%',background:bgs[name.charCodeAt(0)%bgs.length],color:C.white,display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.35,fontWeight:700,flexShrink:0,border:`1px solid ${C.border}`}}>{ini}</div>
}

function CNSDot({cns}:{cns:string}){
  const col = CNS_COLORS[cns]||CNS_COLORS['Low']
  return <span title={`CNS: ${cns}`} style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:col.dot,flexShrink:0,marginTop:1}}/>
}

function TierBadge({tier}:{tier:string}){
  const col = TIER_COLORS[tier]||TIER_COLORS['No Data']
  return <span style={{background:col.bg,border:`1px solid ${col.border}`,color:col.text,fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:4,textTransform:'uppercase' as const,letterSpacing:'0.5px'}}>{tier}</span>
}

const BLANK_CUSTOM = {name:'',pattern:'',category:'Main Exercises',cns:'Moderate',description:''}

export default function CoachDashboard(){
  const [user,setUser]=useState<any>(null)
  const [pitchers,setPitchers]=useState<any[]>([])
  const [selected,setSelected]=useState<any>(null)
  const [tab,setTab]=useState('overview')
  const [view,setView]=useState('roster')
  const [loading,setLoading]=useState(true)
  const [program,setProgram]=useState<any>(null)
  const [structuredDays,setStructuredDays]=useState<any>({})
  const [noteText,setNoteText]=useState('')
  const [notes,setNotes]=useState<any[]>([])
  const [messages,setMessages]=useState<any[]>([])
  const [msgText,setMsgText]=useState('')
  const [logs,setLogs]=useState<any[]>([])
  const [cmjResults,setCmjResults]=useState<any[]>([])
  const [principles,setPrinciples]=useState('')
  const [princText,setPrincText]=useState('')
  const [princSaved,setPrincSaved]=useState(false)
  const [cellNotes,setCellNotes]=useState<Record<string,string>>({})
  const [expandedCell,setExpandedCell]=useState<string|null>(null)
  const [copyModal,setCopyModal]=useState<{ex:any,fromKey:string}|null>(null)
  const [copyToPitcher,setCopyToPitcher]=useState<any>(null)
  const [copyToDay,setCopyToDay]=useState<string>('')
  const [copyToCat,setCopyToCat]=useState<string>('')
  const [copySaving,setCopySaving]=useState(false)
  const [showPicker,setShowPicker]=useState(false)
  const [pickerCell,setPickerCell]=useState<{day:string,cat:string}|null>(null)
  const [pickerSearch,setPickerSearch]=useState('')
  const [pickerCNS,setPickerCNS]=useState('All')
  const [pickerCat,setPickerCat]=useState('All')
  const [addForm,setAddForm]=useState<any>(null)
  const [exerciseVideos,setExerciseVideos]=useState<Record<string,string>>({})
  const [videoInput,setVideoInput]=useState('')
  const [videoSaved,setVideoSaved]=useState(false)
  const [customExercises,setCustomExercises]=useState<any[]>([])
  const [showCustomForm,setShowCustomForm]=useState(false)
  const [customForm,setCustomForm]=useState<any>(BLANK_CUSTOM)
  const [customSaving,setCustomSaving]=useState(false)
  const [overrides,setOverrides]=useState<Record<string,any>>({})
  const [editingExercise,setEditingExercise]=useState<any>(null)
  const [editForm,setEditForm]=useState<any>(null)
  const [editSaving,setEditSaving]=useState(false)
  const [libSearch,setLibSearch]=useState('')
  const [libCat,setLibCat]=useState('All')
  const [recommendationRules,setRecommendationRules]=useState<any[]>([])
  // Food log state
  const [todayFoodLogs,setTodayFoodLogs]=useState<any[]>([])
  const [todayFuelScore,setTodayFuelScore]=useState<any>(null)
  const [weekFuelScores,setWeekFuelScores]=useState<any[]>([])

  const router=useRouter()
  const supabase=createClient()
  const parsedPrinciples = useMemo(()=>parsePrinciples(principles),[principles])
  const today=new Date().toISOString().split('T')[0]

  const EXERCISE_DB = useMemo(()=>{
    return [...BUILT_IN_EXERCISES,...customExercises].map(ex=>{
      const ov=overrides[ex.id]
      if (!ov) return ex
      return {...ex,...ov}
    })
  },[customExercises,overrides])

  useEffect(()=>{
    const init=async()=>{
      const {data:{user}}=await supabase.auth.getUser()
      if (!user){router.push('/auth/login');return}
      setUser(user)
      const {data:profile}=await supabase.from('profiles').select('role').eq('id',user.id).single()
      if (profile?.role!=='coach'){router.push('/pitcher');return}
      const {data:ps}=await supabase.from('profiles').select('*').eq('role','pitcher').order('full_name')
      setPitchers(ps||[])
      const {data:pr}=await supabase.from('principles').select('*').single()
      if (pr){setPrinciples(pr.content);setPrincText(pr.content)}
      const {data:vids}=await supabase.from('exercise_videos').select('*')
      if (vids){const vm:Record<string,string>={};vids.forEach((v:any)=>{vm[v.exercise_id]=v.video_url});setExerciseVideos(vm)}
      const {data:custom}=await supabase.from('custom_exercises').select('*').order('created_at')
      if (custom){setCustomExercises(custom.map((c:any)=>({...c,id:c.exercise_id})))}
      const {data:ovs}=await supabase.from('exercise_overrides').select('*')
      if (ovs){const om:Record<string,any>={};ovs.forEach((o:any)=>{om[o.exercise_id]={name:o.name,category:o.category,cns:o.cns,pattern:o.pattern,description:o.description}});setOverrides(om)}
      const {data:rules}=await supabase.from('recommendation_rules').select('*')
      if (rules){setRecommendationRules(rules)}
      setLoading(false)
    }
    init()
  },[])

  const selectPitcher=async(p:any)=>{
    setSelected(p);setTab('overview');setView('roster')
    const sevenDaysAgo=new Date(Date.now()-7*24*60*60*1000).toISOString().split('T')[0]
    const [logsRes,notesRes,msgsRes,cmjRes,progRes,foodRes,fuelRes,weekFuelRes]=await Promise.all([
      supabase.from('session_logs').select('*').eq('pitcher_id',p.id).order('log_date',{ascending:false}),
      supabase.from('coach_notes').select('*').eq('pitcher_id',p.id).order('created_at',{ascending:false}),
      supabase.from('messages').select('*').eq('pitcher_id',p.id).order('created_at'),
      supabase.from('cmj_results').select('*').eq('pitcher_id',p.id).order('test_date',{ascending:false}),
      supabase.from('programs').select('*').eq('pitcher_id',p.id).order('week_of',{ascending:false}).limit(1),
      supabase.from('food_logs').select('*').eq('pitcher_id',p.id).eq('log_date',today).order('created_at'),
      supabase.from('daily_fuel_scores').select('*').eq('pitcher_id',p.id).eq('log_date',today).maybeSingle(),
      supabase.from('daily_fuel_scores').select('*').eq('pitcher_id',p.id).gte('log_date',sevenDaysAgo).order('log_date'),
    ])
    setLogs(logsRes.data||[])
    setNotes(notesRes.data||[])
    setMessages(msgsRes.data||[])
    setCmjResults(cmjRes.data||[])
    const prog=progRes.data?.[0]||null
    setProgram(prog);setStructuredDays(prog?.structured_days||{});setCellNotes(prog?.days||{})
    setTodayFoodLogs(foodRes.data||[])
    setTodayFuelScore(fuelRes.data||null)
    setWeekFuelScores(weekFuelRes.data||[])
  }

  const signOut=async()=>{await supabase.auth.signOut();router.push('/auth/login')}

  const addNote=async()=>{
    if (!noteText.trim()||!selected)return
    const {data}=await supabase.from('coach_notes').insert({pitcher_id:selected.id,content:noteText.trim()}).select().single()
    if (data){setNotes([data,...notes]);setNoteText('')}
  }

  const sendMessage=async()=>{
    if (!msgText.trim()||!selected)return
    const {data}=await supabase.from('messages').insert({pitcher_id:selected.id,sender_id:user.id,sender_role:'coach',content:msgText.trim()}).select().single()
    if (data){setMessages([...messages,data]);setMsgText('')}
  }

  const savePrinciples=async()=>{
    const {data:pr}=await supabase.from('principles').select('id').single()
    if (pr)await supabase.from('principles').update({content:princText}).eq('id',pr.id)
    setPrinciples(princText);setPrincSaved(true);setTimeout(()=>setPrincSaved(false),2000)
  }

  const saveProgram=async(structured:any,notes:any)=>{
    if (!selected)return
    const weekOf=new Date().toISOString().split('T')[0]
    if (program){
      await supabase.from('programs').update({structured_days:structured,days:notes}).eq('id',program.id)
      setProgram((p:any)=>({...p,structured_days:structured,days:notes}))
    } else {
      const {data}=await supabase.from('programs').insert({pitcher_id:selected.id,week_of:weekOf,structured_days:structured,days:notes}).select().single()
      if (data){setProgram(data)}
    }
  }

  const saveVideo=async(exerciseId:string,url:string)=>{
    if (!url.trim())return
    await supabase.from('exercise_videos').upsert({exercise_id:exerciseId,video_url:url.trim()},{onConflict:'exercise_id'})
    setExerciseVideos(prev=>({...prev,[exerciseId]:url.trim()}))
    setVideoSaved(true);setTimeout(()=>setVideoSaved(false),2000)
  }

  const saveCustomExercise=async()=>{
    if (!customForm.name.trim()||!customForm.pattern.trim())return
    setCustomSaving(true)
    const exercise_id=`custom_${Date.now()}`
    const {data}=await supabase.from('custom_exercises').insert({
      exercise_id,name:customForm.name.trim(),pattern:customForm.pattern.trim(),
      category:customForm.category,cns:customForm.cns,description:customForm.description.trim()
    }).select().single()
    if (data){setCustomExercises(prev=>[...prev,{...data,id:data.exercise_id}]);setCustomForm(BLANK_CUSTOM);setShowCustomForm(false)}
    setCustomSaving(false)
  }

  const deleteCustomExercise=async(exercise_id:string)=>{
    await supabase.from('custom_exercises').delete().eq('exercise_id',exercise_id)
    setCustomExercises(prev=>prev.filter((e:any)=>e.exercise_id!==exercise_id))
  }

  const startEdit=(ex:any)=>{
    setEditingExercise(ex)
    setEditForm({name:ex.name,category:ex.category,cns:ex.cns,pattern:ex.pattern,description:ex.description||''})
  }

  const saveEdit=async()=>{
    if (!editingExercise||!editForm)return
    setEditSaving(true)
    const isCustom=editingExercise.id.startsWith('custom_')
    if (isCustom){
      await supabase.from('custom_exercises').update({
        name:editForm.name,category:editForm.category,cns:editForm.cns,
        pattern:editForm.pattern,description:editForm.description
      }).eq('exercise_id',editingExercise.id)
      setCustomExercises(prev=>prev.map((e:any)=>e.id===editingExercise.id?{...e,...editForm}:e))
    } else {
      await supabase.from('exercise_overrides').upsert({
        exercise_id:editingExercise.id,name:editForm.name,category:editForm.category,
        cns:editForm.cns,pattern:editForm.pattern,description:editForm.description
      },{onConflict:'exercise_id'})
      setOverrides(prev=>({...prev,[editingExercise.id]:editForm}))
    }
    setEditingExercise(null);setEditForm(null);setEditSaving(false)
  }

  const openPicker=(day:string,cat:string)=>{
    setPickerCell({day,cat});setPickerSearch('');setPickerCNS('All');setPickerCat(cat)
    setAddForm(null);setVideoInput('');setVideoSaved(false);setShowCustomForm(false)
    setShowPicker(true)
  }

  const confirmAddExercise=async()=>{
    if (!addForm||!pickerCell)return
    const {exercise,sets,reps,load,notes:exNotes}=addForm
    if (videoInput.trim()&&!exerciseVideos[exercise.id])await saveVideo(exercise.id,videoInput)
    const key=`${pickerCell.day}___${pickerCell.cat}`
    const current=structuredDays[key]||[]
    const newStructured={...structuredDays,[key]:[...current,{
      id:exercise.id,name:exercise.name,sets:parseInt(sets)||0,reps:parseInt(reps)||0,
      load:load||'',notes:exNotes||'',cns:exercise.cns,category:exercise.category,pattern:exercise.pattern
    }]}
    setStructuredDays(newStructured)
    await saveProgram(newStructured,cellNotes)
    setAddForm(null);setShowPicker(false)
  }

  const copyExerciseToPitcher=async(ex:any,targetPitcher:any,day:string,cat:string)=>{
    if(!targetPitcher||!day||!cat) return
    setCopySaving(true)
    const {data:prog}=await supabase.from('programs').select('*').eq('pitcher_id',targetPitcher.id).order('week_of',{ascending:false}).limit(1).maybeSingle()
    if(!prog){setCopySaving(false);alert('No program found for that pitcher');return}
    const key=`${day}___${cat}`
    const current=prog.structured_days?.[key]||[]
    const updated={...prog.structured_days,[key]:[...current,{id:ex.id,name:ex.name,sets:ex.sets,reps:ex.reps,load:ex.load||'',notes:ex.notes||'',cns:ex.cns||''}]}
    await supabase.from('programs').update({structured_days:updated}).eq('id',prog.id)
    setCopySaving(false)
    setCopyModal(null)
    setCopyToPitcher(null)
    setCopyToDay('')
    setCopyToCat('')
    alert(`✅ Copied to ${targetPitcher.name}`)
  }

  const removeExercise=async(key:string,idx:number)=>{
    const updated={...structuredDays,[key]:(structuredDays[key]||[]).filter((_:any,i:number)=>i!==idx)}
    setStructuredDays(updated);await saveProgram(updated,cellNotes)
  }

  const updateCellNote=async(day:string,cat:string,val:string)=>{
    const key=`${day}___${cat}`;const updated={...cellNotes,[key]:val}
    setCellNotes(updated);await saveProgram(structuredDays,updated)
  }

  const buildPrompt=()=>{
    const jiP=armCare(selected?.weekly_pitches||0,selected?.avg_velocity||0)
    const lastCMJ=cmjResults[0]
    const {classification}=classifyCMJ(lastCMJ)
    const rule=recommendationRules.find(r=>r.classification===classification)
    const recentLogs=logs.slice(0,7)
    const prompt=`You are helping Coach Salzman write a weekly training program for pitcher ${selected?.full_name}.

PITCHER DATA:
- Avg Velocity: ${selected?.avg_velocity||'—'} mph
- Weekly Pitches: ${selected?.weekly_pitches||'—'} | HE Throws: ${selected?.weekly_high_effort||'—'}
- Arm Care Min: ${jiP.toLocaleString()} ft·lb
${lastCMJ?`- CMJ: Jump ${lastCMJ.jump_height_in?.toFixed(1)}in | RSI ${lastCMJ.rsi_mod?.toFixed(2)} | PP/kg ${lastCMJ.peak_power_per_kg?.toFixed(1)} W/kg`:'- No CMJ data'}
- Neuro Classification: ${classification}
${rule?`- Training Emphasis: ${rule.emphasis} | Load Range: ${rule.load_range}`:''}

RECENT LOGS:
${recentLogs.map((l:any)=>`  ${l.log_date}: vel=${l.velocity||'—'}mph, feeling=${l.feeling||'—'}/10, soreness=[${(l.soreness||[]).join(',')||'none'}]`).join('\n')||'  None.'}

TRAINING PRINCIPLES:
${principles||'No principles yet.'}

Write next week's program by day and category (Pre-Throwing, Throwing, Post-Throwing, Main Exercises, Accessory, Conditioning, Recovery). Use format: "Exercise Name SxR @ X%"`
    navigator.clipboard.writeText(prompt).catch(()=>{})
    window.open('https://claude.ai','_blank')
    alert('Prompt copied! Paste into Claude.')
  }

  const getRecommendedExercises=(classification:string)=>{
    const rule=recommendationRules.find(r=>r.classification===classification)
    if (!rule) return []
    const preferredCats:string[]=rule.preferred_categories||[]
    const preferredPatterns:string[]=rule.preferred_patterns||[]
    return EXERCISE_DB.filter(ex=>preferredCats.includes(ex.category)||preferredPatterns.includes(ex.pattern)).slice(0,6)
  }

  const filteredExercises=useMemo(()=>EXERCISE_DB.filter(ex=>{
    const q=pickerSearch.toLowerCase()
    if (q&&!ex.name.toLowerCase().includes(q)&&!ex.pattern.toLowerCase().includes(q))return false
    if (pickerCNS!=='All'&&ex.cns!==pickerCNS)return false
    if (pickerCat!=='All'&&ex.category!==pickerCat)return false
    return true
  }),[EXERCISE_DB,pickerSearch,pickerCNS,pickerCat])

  const filteredLibrary=useMemo(()=>EXERCISE_DB.filter(ex=>{
    const q=libSearch.toLowerCase()
    if (q&&!ex.name.toLowerCase().includes(q)&&!ex.pattern.toLowerCase().includes(q))return false
    if (libCat!=='All'&&ex.category!==libCat)return false
    return true
  }),[EXERCISE_DB,libSearch,libCat])

  if (loading)return <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',color:C.textMuted,fontFamily:'system-ui'}}>Loading...</div>

  const S={
    header:{background:C.bg2,borderBottom:`1px solid ${C.border}`,padding:'0 20px',display:'flex',alignItems:'center',justifyContent:'space-between',height:56,fontFamily:'system-ui'},
    sidebar:{width:220,background:C.bg2,borderRight:`1px solid ${C.border}`,overflowY:'auto' as const,flexShrink:0},
    main:{flex:1,overflowY:'auto' as const,background:C.bg,padding:20,fontFamily:'system-ui'},
    card:{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:10,padding:'16px 18px',marginBottom:12},
    input:{width:'100%',background:C.bg3,border:`1px solid ${C.border}`,borderRadius:6,padding:'8px 12px',fontSize:13,color:C.text,boxSizing:'border-box' as const,outline:'none'},
    btn:(v='primary')=>({background:v==='gold'?C.gold:C.bg3,color:v==='gold'?C.bg:C.text,border:`1px solid ${v==='gold'?C.gold:C.border}`,borderRadius:6,padding:'7px 14px',fontSize:12,fontWeight:v==='gold'?700:500 as const,cursor:'pointer'}),
    tab:(a:boolean)=>({padding:'6px 12px',fontSize:11,fontWeight:a?700:400 as const,background:a?C.gold:C.bg3,color:a?C.bg:C.textMuted,border:`1px solid ${a?C.gold:C.border}`,borderRadius:6,cursor:'pointer',textTransform:'uppercase' as const,letterSpacing:'0.5px'}),
  }

  return(
    <div style={{fontFamily:'system-ui,-apple-system,sans-serif',background:C.bg,minHeight:'100vh',color:C.text}}>
      <header style={S.header}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:32,height:32,background:`linear-gradient(135deg,${C.gold},${C.goldDim})`,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>⚾</div>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:C.white,letterSpacing:'-0.3px'}}>SALZMAN BASEBALL</div>
            <div style={{fontSize:10,color:C.gold,textTransform:'uppercase' as const,letterSpacing:'0.5px'}}>Coach Dashboard</div>
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {['roster','library','principles'].map(v=>(
            <button key={v} onClick={()=>{setView(v);setSelected(null)}} style={{...S.btn(),background:view===v?C.goldBg:'transparent',color:view===v?C.gold:C.textMuted,border:`1px solid ${view===v?C.goldDim:'transparent'}`,fontSize:11,padding:'5px 12px'}}>{v.toUpperCase()}</button>
          ))}
          <button onClick={signOut} style={{...S.btn(),fontSize:11,padding:'5px 12px',color:C.textMuted}}>Sign Out</button>
        </div>
      </header>

      <div style={{display:'flex',height:'calc(100vh - 56px)'}}>
        <aside style={S.sidebar}>
          <div style={{padding:'10px 14px 6px',fontSize:10,color:C.textDim,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'1px'}}>Roster · {pitchers.length}</div>
          {pitchers.map(p=>(
            <div key={p.id} onClick={()=>selectPitcher(p)} style={{padding:'9px 14px',cursor:'pointer',background:selected?.id===p.id?C.bg3:'transparent',borderLeft:`2px solid ${selected?.id===p.id?C.gold:'transparent'}`,display:'flex',alignItems:'center',gap:10}}>
              <Avatar name={p.full_name||'?'} size={26}/>
              <div style={{minWidth:0}}>
                <div style={{fontSize:13,fontWeight:500,color:selected?.id===p.id?C.white:C.textMuted,whiteSpace:'nowrap' as const,overflow:'hidden',textOverflow:'ellipsis'}}>{p.full_name}</div>
                <div style={{fontSize:10,color:C.textDim}}>{p.avg_velocity?`${p.avg_velocity} mph`:'no data'}</div>
              </div>
            </div>
          ))}
          {pitchers.length===0&&<div style={{padding:'12px 14px',fontSize:12,color:C.textDim}}>No pitchers yet.</div>}
        </aside>

        <main style={S.main}>
          {view==='roster'&&!selected&&(
            <div style={{textAlign:'center',marginTop:80}}>
              <div style={{fontSize:48,marginBottom:16}}>⚾</div>
              <div style={{fontSize:20,fontWeight:700,color:C.white,marginBottom:8}}>SELECT A PITCHER</div>
              <div style={{fontSize:13,color:C.textMuted}}>Choose from the roster on the left.</div>
            </div>
          )}

          {view==='roster'&&selected&&(()=>{
            const latestCMJ=cmjResults[0]||null
            const {classification,jumpTier,ppTier,rsiTier}=classifyCMJ(latestCMJ)
            const classCol=CLASS_COLORS[classification]||CLASS_COLORS['No Data']
            const rule=recommendationRules.find(r=>r.classification===classification)
            const recommendedExercises=getRecommendedExercises(classification)
            const todayScore=todayFuelScore?.total_score||0

            return(
            <div>
              <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:20,paddingBottom:16,borderBottom:`1px solid ${C.border}`}}>
                <Avatar name={selected.full_name||'?'} size={48}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:20,fontWeight:700,color:C.white}}>{selected.full_name?.toUpperCase()}</div>
                  <div style={{fontSize:11,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'1px'}}>Pitcher · Salzman Baseball</div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 14px',textAlign:'center'}}>
                    <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4}}>Avg Vel</div>
                    <div style={{fontSize:20,fontWeight:700,color:C.white}}>{selected.avg_velocity||'—'}<span style={{fontSize:11,color:C.textMuted}}> mph</span></div>
                  </div>
                  <div style={{background:C.goldBg,border:`1px solid ${C.goldDim}`,borderRadius:8,padding:'10px 14px',textAlign:'center'}}>
                    <div style={{fontSize:10,color:C.gold,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4}}>Arm Care Min</div>
                    <div style={{fontSize:18,fontWeight:700,color:C.gold}}>{armCare(selected.weekly_pitches,selected.avg_velocity)?armCare(selected.weekly_pitches,selected.avg_velocity).toLocaleString():'—'}<span style={{fontSize:10,color:C.goldDim}}> ft·lb</span></div>
                  </div>
                </div>
              </div>

              <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap' as const}}>
                {['overview','logs','program','notes','messages','iq'].map(t=>(
                  <button key={t} style={S.tab(tab===t)} onClick={()=>setTab(t)}>{t}</button>
                ))}
              </div>

              {tab==='overview'&&(
                <div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:12}}>
                    {[{label:'Pitches/Wk',val:selected.weekly_pitches||'—'},{label:'HE Throws/Wk',val:selected.weekly_high_effort||'—'},{label:'CMJ Tests',val:cmjResults.length}].map(m=>(
                      <div key={m.label} style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:8,padding:'12px 14px'}}>
                        <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4}}>{m.label}</div>
                        <div style={{fontSize:22,fontWeight:700,color:C.white}}>{m.val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Neuro Classification */}
                  {latestCMJ?(
                    <div style={{...S.card,border:`1px solid ${classCol.border}`,background:classCol.bg,marginBottom:12}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                        <div>
                          <div style={{fontSize:10,color:classCol.text,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'1px',marginBottom:4}}>Neuro Classification</div>
                          <div style={{fontSize:20,fontWeight:700,color:classCol.text}}>{classification}</div>
                          {rule&&<div style={{fontSize:12,color:C.textMuted,marginTop:4}}>{rule.emphasis}</div>}
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>Load Range</div>
                          <div style={{fontSize:16,fontWeight:700,color:C.white}}>{rule?.load_range||'—'}</div>
                        </div>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:12}}>
                        {[
                          {label:'Jump Height',val:`${latestCMJ.jump_height_in?.toFixed(1)} in`,tier:jumpTier},
                          {label:'PP/kg (Magnitude)',val:`${latestCMJ.peak_power_per_kg?.toFixed(1)} W/kg`,tier:ppTier},
                          {label:'RSI (Rate)',val:latestCMJ.rsi_mod?.toFixed(2),tier:rsiTier},
                        ].map(m=>(
                          <div key={m.label} style={{background:'rgba(0,0,0,0.2)',borderRadius:8,padding:'10px 12px'}}>
                            <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>{m.label}</div>
                            <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:4}}>{m.val}</div>
                            <TierBadge tier={m.tier}/>
                          </div>
                        ))}
                      </div>
                      {rule?.notes&&<div style={{fontSize:11,color:C.textMuted,padding:'8px 10px',background:'rgba(0,0,0,0.2)',borderRadius:6,marginBottom:12}}>{rule.notes}</div>}
                      {recommendedExercises.length>0&&(
                        <div>
                          <div style={{fontSize:10,color:classCol.text,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'1px',marginBottom:8}}>Recommended Exercises</div>
                          <div style={{display:'flex',flexDirection:'column' as const,gap:6}}>
                            {recommendedExercises.map((ex:any)=>{
                              const catCol=CAT_MAP[ex.category]
                              const cnsCol=CNS_COLORS[ex.cns]||CNS_COLORS['Low']
                              const prescription=lookupPrescription(ex.name,parsedPrinciples)
                              return(
                                <div key={ex.id} style={{background:'rgba(0,0,0,0.2)',borderRadius:6,padding:'8px 12px',display:'flex',alignItems:'center',gap:10}}>
                                  <div style={{width:3,height:24,borderRadius:2,background:catCol?.color||C.textMuted,flexShrink:0}}/>
                                  <div style={{flex:1}}>
                                    <div style={{fontSize:12,fontWeight:600,color:C.white}}>{ex.name}</div>
                                    <div style={{display:'flex',gap:6,marginTop:2,alignItems:'center'}}>
                                      <span style={{fontSize:10,color:cnsCol.text}}>{ex.cns} CNS</span>
                                      <span style={{fontSize:10,color:catCol?.color||C.textMuted}}>{ex.category}</span>
                                      {prescription&&<span style={{fontSize:10,color:C.gold,fontWeight:600}}>{prescription.sets}x{prescription.reps}{prescription.load?` @ ${prescription.load}%`:''}</span>}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ):(
                    <div style={{...S.card,border:'1px solid rgba(163,113,247,0.2)',background:'rgba(163,113,247,0.04)',marginBottom:12}}>
                      <div style={{fontSize:11,color:C.purple,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'1px',marginBottom:6}}>Neuro Classification</div>
                      <div style={{fontSize:13,color:C.textDim}}>No CMJ data yet.</div>
                    </div>
                  )}

                  {/* Fuel Score */}
                  <div style={{...S.card,marginBottom:12}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                      <div style={{fontSize:11,color:C.textMuted,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'1px'}}>Today's Fuel Score</div>
                      {todayFuelScore?.water_oz>0&&<div style={{fontSize:11,color:C.blue}}>💧 {todayFuelScore.water_oz} oz water</div>}
                    </div>

                    {todayScore>0?(
                      <div>
                        <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:12}}>
                          <div style={{fontSize:48,fontWeight:700,color:scoreColor(todayScore),letterSpacing:'-2px'}}>{todayScore}<span style={{fontSize:16,color:C.textMuted,fontWeight:400}}>/100</span></div>
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,flex:1}}>
                            {[{l:'Macros',v:todayFuelScore?.macro_score||0,max:30},{l:'Quality',v:todayFuelScore?.quality_score||0,max:30},{l:'Glycemic',v:todayFuelScore?.glycemic_score||0,max:20},{l:'Timing',v:todayFuelScore?.timing_score||0,max:20}].map(s=>(
                              <div key={s.l} style={{background:C.bg3,borderRadius:6,padding:'5px 8px'}}>
                                <div style={{fontSize:9,color:C.textMuted}}>{s.l}</div>
                                <div style={{fontSize:12,fontWeight:700,color:C.white}}>{s.v}<span style={{fontSize:9,color:C.textDim}}>/{s.max}</span></div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Today's meals */}
                        {todayFoodLogs.length>0&&(
                          <div>
                            <div style={{fontSize:10,color:C.textMuted,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:8}}>Meals Today</div>
                            {todayFoodLogs.map((meal:any,i:number)=>{
                              const mealCol=MEAL_TYPE_COLORS[meal.meal_type]||C.textMuted
                              return(
                                <div key={i} style={{padding:'8px 10px',background:C.bg3,borderRadius:6,marginBottom:6,borderLeft:`3px solid ${mealCol}`}}>
                                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                                    <span style={{fontSize:10,color:mealCol,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'0.3px'}}>{meal.meal_type}</span>
                                    <span style={{fontSize:11,color:C.gold,fontWeight:600}}>{Math.round(meal.estimated_calories)} cal</span>
                                  </div>
                                  <div style={{fontSize:12,color:C.white,marginBottom:4}}>{meal.meal_description}</div>
                                  <div style={{display:'flex',gap:10}}>
                                    <span style={{fontSize:10,color:C.teal}}>P: {meal.estimated_protein}g</span>
                                    <span style={{fontSize:10,color:C.blue}}>C: {meal.estimated_carbs}g</span>
                                    <span style={{fontSize:10,color:C.gold}}>F: {meal.estimated_fat}g</span>
                                    <span style={{fontSize:10,color:C.textMuted}}>GL: {meal.gl_score}</span>
                                  </div>
                                  {meal.pro_metabolic_foods?.length>0&&<div style={{fontSize:10,color:C.teal,marginTop:3}}>✓ {meal.pro_metabolic_foods.join(', ')}</div>}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* 7-day trend */}
                        {weekFuelScores.length>1&&(
                          <div style={{marginTop:12}}>
                            <div style={{fontSize:10,color:C.textMuted,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:8}}>7-Day Fuel Trend</div>
                            <div style={{display:'flex',gap:4,alignItems:'flex-end',height:48}}>
                              {weekFuelScores.map((s:any,i:number)=>{
                                const score=s.total_score||0
                                const height=Math.max(4,Math.round((score/100)*44))
                                return(
                                  <div key={i} style={{flex:1,display:'flex',flexDirection:'column' as const,alignItems:'center',gap:2}}>
                                    <div style={{width:'100%',height,background:scoreColor(score),borderRadius:2,minHeight:4}}/>
                                    <div style={{fontSize:8,color:C.textDim}}>{score}</div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ):(
                      <div style={{fontSize:13,color:C.textDim}}>No food logged today.</div>
                    )}
                  </div>

                  {/* Recent sessions */}
                  {logs.length>0&&(
                    <div style={S.card}>
                      <div style={{fontSize:11,color:C.textMuted,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'1px',marginBottom:12}}>Recent Sessions</div>
                      {logs.slice(0,5).map((log:any,i:number)=>(
                        <div key={i} style={{borderBottom:`1px solid ${C.border}`,padding:'10px 0',display:'flex',gap:16}}>
                          <div style={{minWidth:80,fontSize:11,color:C.textMuted}}>{log.log_date}</div>
                          <div style={{display:'flex',gap:16,flexWrap:'wrap' as const}}>
                            {log.velocity&&<span style={{fontSize:12,color:C.gold}}>{log.velocity} mph</span>}
                            {log.weight_lifted&&<span style={{fontSize:12,color:C.teal}}>{log.weight_lifted} lbs</span>}
                            {log.feeling&&<span style={{fontSize:12,color:log.feeling>=7?C.teal:log.feeling>=4?C.gold:C.red}}>{log.feeling}/10</span>}
                            {log.soreness?.length>0&&<span style={{fontSize:12,color:C.red}}>{log.soreness.join(', ')}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab==='logs'&&(
                <div style={S.card}>
                  <div style={{fontSize:11,color:C.textMuted,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'1px',marginBottom:12}}>All Logs ({logs.length})</div>
                  {logs.length===0&&<div style={{color:C.textDim,fontSize:13}}>No logs yet.</div>}
                  <div style={{overflowX:'auto' as const}}>
                    <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:12}}>
                      <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
                        {['Date','Vel','Sprint','Pitches','HE','Feeling','Soreness'].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left' as const,color:C.textMuted,fontSize:10,textTransform:'uppercase' as const}}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {logs.map((log:any,i:number)=>(
                          <tr key={i} style={{borderBottom:`1px solid ${C.border}`}}>
                            <td style={{padding:'8px 10px',color:C.textMuted}}>{log.log_date}</td>
                            <td style={{padding:'8px 10px',color:C.gold,fontWeight:600}}>{log.velocity?`${log.velocity} mph`:'—'}</td>
                            <td style={{padding:'8px 10px'}}>{log.sprint_time?`${log.sprint_time}s`:'—'}</td>
                            <td style={{padding:'8px 10px'}}>{log.pitch_count||'—'}</td>
                            <td style={{padding:'8px 10px'}}>{log.high_effort_throws||'—'}</td>
                            <td style={{padding:'8px 10px'}}><span style={{color:log.feeling>=7?C.teal:log.feeling>=4?C.gold:C.red,fontWeight:600}}>{log.feeling?`${log.feeling}/10`:'—'}</span></td>
                            <td style={{padding:'8px 10px',color:C.red}}>{log.soreness?.join(', ')||'—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab==='program'&&(
                <div>
                  <div style={{display:'flex',gap:12,flexWrap:'wrap' as const,marginBottom:16,padding:'10px 14px',background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8,alignItems:'center'}}>
                    <span style={{fontSize:10,color:C.textDim,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'1px',marginRight:4}}>Categories:</span>
                    {CATEGORIES.map(cat=>(
                      <div key={cat.key} style={{display:'flex',alignItems:'center',gap:5}}>
                        <div style={{width:10,height:10,borderRadius:2,background:cat.color,opacity:0.85}}/>
                        <span style={{fontSize:10,color:C.textMuted}}>{cat.key}</span>
                      </div>
                    ))}
                    <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:10}}>
                      {['High','Moderate','Low'].map(c=>(
                        <div key={c} style={{display:'flex',alignItems:'center',gap:4}}>
                          <div style={{width:7,height:7,borderRadius:'50%',background:CNS_COLORS[c].dot}}/>
                          <span style={{fontSize:10,color:C.textMuted}}>{c}</span>
                        </div>
                      ))}
                    </div>
                    <button style={S.btn('gold')} onClick={buildPrompt}>Claude</button>
                  </div>
                  <div style={{overflowX:'auto' as const}}>
                    <div style={{minWidth:900}}>
                      <div style={{display:'grid',gridTemplateColumns:'130px repeat(7,1fr)',gap:4,marginBottom:4}}>
                        <div/>
                        {DAYS.map(d=>(
                          <div key={d} style={{textAlign:'center',padding:'6px 4px',fontSize:11,fontWeight:700,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',background:C.bg2,borderRadius:6,border:`1px solid ${C.border}`}}>{d.slice(0,3)}</div>
                        ))}
                      </div>
                      {CATEGORIES.map(cat=>(
                        <div key={cat.key} style={{display:'grid',gridTemplateColumns:'130px repeat(7,1fr)',gap:4,marginBottom:4}}>
                          <div style={{display:'flex',alignItems:'center',gap:8,padding:'0 10px',background:cat.bg,border:`1px solid ${cat.border}`,borderRadius:6}}>
                            <div style={{width:3,height:28,borderRadius:2,background:cat.color,flexShrink:0}}/>
                            <span style={{fontSize:10,fontWeight:700,color:cat.color,textTransform:'uppercase' as const,letterSpacing:'0.5px',lineHeight:1.2}}>{cat.key}</span>
                          </div>
                          {DAYS.map(day=>{
                            const key=`${day}___${cat.key}`
                            const exercises=structuredDays[key]||[]
                            const note=cellNotes[key]||''
                            const isExpanded=expandedCell===key
                            return(
                              <div key={day} style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:6,padding:6,minHeight:60}}>
                                {exercises.map((ex:any,i:number)=>(
                                  <div key={i} style={{background:cat.bg,borderLeft:`3px solid ${cat.color}`,borderRadius:4,padding:'4px 6px',marginBottom:3,display:'flex',alignItems:'flex-start',gap:5}}>
                                    <div style={{flex:1,minWidth:0}}>
                                      <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:1}}>
                                        <CNSDot cns={ex.cns}/>
                                        <span style={{fontSize:10,fontWeight:700,color:C.white,whiteSpace:'nowrap' as const,overflow:'hidden',textOverflow:'ellipsis',maxWidth:90}}>{ex.name}</span>
                                      </div>
                                      <div style={{fontSize:9,color:cat.color,fontWeight:600}}>{ex.sets}x{ex.reps}{ex.load?` @ ${ex.load}%`:''}</div>
                                      {ex.notes&&<div style={{fontSize:9,color:C.textDim,fontStyle:'italic',marginTop:1}}>{ex.notes}</div>}
                                      {exerciseVideos[ex.id]&&<a href={exerciseVideos[ex.id]} target="_blank" rel="noopener noreferrer" style={{fontSize:9,color:C.blue,display:'block',marginTop:2}}>Video</a>}
                                    </div>
                                    <button onClick={()=>setCopyModal({ex,fromKey:key})} style={{background:'transparent',border:'none',color:C.blue,cursor:'pointer',fontSize:9,padding:'0 2px',lineHeight:1,flexShrink:0}}>copy</button>
                                    <button onClick={()=>removeExercise(key,i)} style={{background:'transparent',border:'none',color:C.textDim,cursor:'pointer',fontSize:11,padding:'0 2px',lineHeight:1,flexShrink:0}}>x</button>
                                  </div>
                                ))}
                                {note&&!isExpanded&&<div style={{fontSize:9,color:C.textDim,fontStyle:'italic',marginTop:exercises.length>0?3:0,cursor:'pointer'}} onClick={()=>setExpandedCell(key)}>{note.length>40?note.slice(0,40)+'...':note}</div>}
                                {isExpanded&&<textarea autoFocus style={{width:'100%',background:C.bg3,border:`1px solid ${cat.border}`,borderRadius:4,padding:'4px 6px',fontSize:10,color:C.text,resize:'none' as const,outline:'none',minHeight:52,boxSizing:'border-box' as const,marginTop:3,fontFamily:'system-ui'}} value={note} onChange={e=>updateCellNote(day,cat.key,e.target.value)} onBlur={()=>setExpandedCell(null)} placeholder="Coaching note..."/>}
                                <div style={{display:'flex',gap:3,marginTop:4}}>
                                  <button onClick={()=>openPicker(day,cat.key)} style={{flex:1,background:'transparent',border:`1px dashed ${C.border}`,borderRadius:4,color:C.textDim,fontSize:9,padding:'3px 0',cursor:'pointer',textAlign:'center' as const}}>+ exercise</button>
                                  <button onClick={()=>setExpandedCell(isExpanded?null:key)} style={{background:'transparent',border:`1px dashed ${C.border}`,borderRadius:4,color:C.textDim,fontSize:9,padding:'3px 5px',cursor:'pointer'}}>note</button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {tab==='notes'&&(
                <div>
                  <div style={S.card}>
                    <textarea style={{...S.input,minHeight:80,resize:'vertical' as const}} placeholder="Write a note..." value={noteText} onChange={e=>setNoteText(e.target.value)}/>
                    <button style={{...S.btn('gold'),marginTop:10}} onClick={addNote}>Save Note</button>
                  </div>
                  {notes.map((n:any)=>(
                    <div key={n.id} style={S.card}>
                      <div style={{fontSize:10,color:C.textMuted,marginBottom:6,textTransform:'uppercase' as const}}>{new Date(n.created_at).toLocaleDateString()}</div>
                      <div style={{fontSize:14,lineHeight:1.7,color:C.text}}>{n.content}</div>
                    </div>
                  ))}
                </div>
              )}

              {tab==='messages'&&(
                <div style={S.card}>
                  <div style={{fontSize:11,color:C.textMuted,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'1px',marginBottom:14}}>Messages · {selected.full_name}</div>
                  <div style={{display:'flex',flexDirection:'column' as const,gap:10,minHeight:200,marginBottom:16}}>
                    {messages.length===0&&<div style={{color:C.textDim,fontSize:13}}>No messages yet.</div>}
                    {messages.map((m:any)=>(
                      <div key={m.id} style={{display:'flex',flexDirection:'column' as const,alignItems:m.sender_role==='coach'?'flex-end':'flex-start'}}>
                        <div style={{fontSize:10,color:C.textDim,marginBottom:3}}>{m.sender_role==='coach'?'Coach Salzman':selected.full_name} · {new Date(m.created_at).toLocaleString()}</div>
                        <div style={{background:m.sender_role==='coach'?C.goldBg:C.bg3,color:m.sender_role==='coach'?C.gold:C.text,border:`1px solid ${m.sender_role==='coach'?C.goldDim:C.border}`,borderRadius:10,padding:'8px 12px',fontSize:13,maxWidth:'80%'}}>{m.content}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <input style={{...S.input,flex:1}} placeholder="Message..." value={msgText} onChange={e=>setMsgText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMessage()}/>
                    <button style={S.btn('gold')} onClick={sendMessage}>Send</button>
                  </div>
                </div>
              )}
              {tab==='iq'&&(
                <div style={{padding:4}}><PitchingIQ/></div>
              )}
            </div>
            )
          })()}

          {view==='library'&&(
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <div>
                  <div style={{fontSize:20,fontWeight:700,color:C.white,marginBottom:4}}>EXERCISE LIBRARY</div>
                  <div style={{fontSize:13,color:C.textMuted}}>{EXERCISE_DB.length} exercises · {customExercises.length} custom · {Object.keys(overrides).length} overrides</div>
                </div>
                <button onClick={()=>{setShowCustomForm(true);setCustomForm(BLANK_CUSTOM)}} style={{...S.btn('gold'),padding:'9px 16px'}}>+ New Exercise</button>
              </div>

              {showCustomForm&&(
                <div style={{...S.card,border:'1px solid rgba(232,184,75,0.3)',marginBottom:16}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.white,marginBottom:12}}>New Exercise</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                    <div>
                      <label style={{fontSize:10,color:C.textMuted,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4,display:'block'}}>Name *</label>
                      <input style={S.input} placeholder="e.g. Banded Hip Hinge" value={customForm.name} onChange={e=>setCustomForm((f:any)=>({...f,name:e.target.value}))}/>
                    </div>
                    <div>
                      <label style={{fontSize:10,color:C.textMuted,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4,display:'block'}}>Pattern *</label>
                      <input style={S.input} placeholder="e.g. Hinge, Rotation..." value={customForm.pattern} onChange={e=>setCustomForm((f:any)=>({...f,pattern:e.target.value}))}/>
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                    <div>
                      <label style={{fontSize:10,color:C.textMuted,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4,display:'block'}}>Category</label>
                      <select style={{...S.input}} value={customForm.category} onChange={e=>setCustomForm((f:any)=>({...f,category:e.target.value}))}>
                        {CATEGORIES.map(c=><option key={c.key} value={c.key}>{c.key}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{fontSize:10,color:C.textMuted,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4,display:'block'}}>CNS Load</label>
                      <select style={{...S.input}} value={customForm.cns} onChange={e=>setCustomForm((f:any)=>({...f,cns:e.target.value}))}>
                        <option value="High">High</option>
                        <option value="Moderate">Moderate</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                  </div>
                  <div style={{marginBottom:12}}>
                    <label style={{fontSize:10,color:C.textMuted,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4,display:'block'}}>Description</label>
                    <textarea style={{...S.input,minHeight:60,resize:'vertical' as const}} placeholder="Brief description..." value={customForm.description} onChange={e=>setCustomForm((f:any)=>({...f,description:e.target.value}))}/>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button style={S.btn('gold')} onClick={saveCustomExercise} disabled={!customForm.name.trim()||!customForm.pattern.trim()||customSaving}>{customSaving?'Saving...':'Save Exercise'}</button>
                    <button style={S.btn()} onClick={()=>setShowCustomForm(false)}>Cancel</button>
                  </div>
                </div>
              )}

              {editingExercise&&editForm&&(
                <div style={{...S.card,border:`1px solid ${CAT_MAP[editingExercise.category]?.border||C.border}`,marginBottom:16}}>
                  <div style={{fontSize:13,fontWeight:700,color:C.white,marginBottom:12}}>Editing: {editingExercise.name}</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                    <div>
                      <label style={{fontSize:10,color:C.textMuted,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4,display:'block'}}>Name</label>
                      <input style={S.input} value={editForm.name} onChange={e=>setEditForm((f:any)=>({...f,name:e.target.value}))}/>
                    </div>
                    <div>
                      <label style={{fontSize:10,color:C.textMuted,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4,display:'block'}}>Pattern</label>
                      <input style={S.input} value={editForm.pattern} onChange={e=>setEditForm((f:any)=>({...f,pattern:e.target.value}))}/>
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                    <div>
                      <label style={{fontSize:10,color:C.textMuted,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4,display:'block'}}>Category</label>
                      <select style={{...S.input}} value={editForm.category} onChange={e=>setEditForm((f:any)=>({...f,category:e.target.value}))}>
                        {CATEGORIES.map(c=><option key={c.key} value={c.key}>{c.key}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{fontSize:10,color:C.textMuted,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4,display:'block'}}>CNS Load</label>
                      <select style={{...S.input}} value={editForm.cns} onChange={e=>setEditForm((f:any)=>({...f,cns:e.target.value}))}>
                        <option value="High">High</option>
                        <option value="Moderate">Moderate</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                  </div>
                  <div style={{marginBottom:12}}>
                    <label style={{fontSize:10,color:C.textMuted,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4,display:'block'}}>Description</label>
                    <textarea style={{...S.input,minHeight:60,resize:'vertical' as const}} value={editForm.description} onChange={e=>setEditForm((f:any)=>({...f,description:e.target.value}))}/>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button style={S.btn('gold')} onClick={saveEdit} disabled={editSaving}>{editSaving?'Saving...':'Save Changes'}</button>
                    <button style={S.btn()} onClick={()=>{setEditingExercise(null);setEditForm(null)}}>Cancel</button>
                  </div>
                </div>
              )}

              <div style={{display:'flex',gap:8,marginBottom:12}}>
                <input style={{...S.input,flex:1}} placeholder="Search exercises..." value={libSearch} onChange={e=>setLibSearch(e.target.value)}/>
                <select style={{...S.input,width:'auto'}} value={libCat} onChange={e=>setLibCat(e.target.value)}>
                  <option value="All">All Categories</option>
                  {CATEGORIES.map(c=><option key={c.key} value={c.key}>{c.key}</option>)}
                </select>
              </div>

              <div style={{...S.card,padding:0,overflow:'hidden'}}>
                <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:12}}>
                  <thead>
                    <tr style={{borderBottom:`1px solid ${C.border}`,background:C.bg3}}>
                      {['Exercise','Category','CNS','Pattern','Video',''].map(h=>(
                        <th key={h} style={{padding:'10px 12px',textAlign:'left' as const,color:C.textMuted,fontSize:10,textTransform:'uppercase' as const,letterSpacing:'0.5px',fontWeight:700}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLibrary.map((ex:any)=>{
                      const catDef=CAT_MAP[ex.category]
                      const cnsDef=CNS_COLORS[ex.cns]||CNS_COLORS['Low']
                      const isCustom=ex.id.startsWith('custom_')
                      const hasOverride=!!overrides[ex.id]
                      const hasVideo=!!exerciseVideos[ex.id]
                      return(
                        <tr key={ex.id} style={{borderBottom:`1px solid ${C.border}`}}>
                          <td style={{padding:'10px 12px'}}>
                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                              <div style={{width:3,height:20,borderRadius:2,background:catDef?.color||C.textMuted,flexShrink:0}}/>
                              <div>
                                <span style={{color:C.white,fontWeight:600}}>{ex.name}</span>
                                <div style={{display:'flex',gap:4,marginTop:2}}>
                                  {isCustom&&<span style={{fontSize:9,background:'rgba(232,184,75,0.15)',color:C.gold,border:'1px solid rgba(232,184,75,0.3)',borderRadius:3,padding:'1px 4px',fontWeight:700}}>custom</span>}
                                  {hasOverride&&<span style={{fontSize:9,background:'rgba(88,166,255,0.15)',color:C.blue,border:'1px solid rgba(88,166,255,0.3)',borderRadius:3,padding:'1px 4px',fontWeight:700}}>edited</span>}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{padding:'10px 12px'}}><span style={{color:catDef?.color||C.textMuted,fontSize:11}}>{ex.category}</span></td>
                          <td style={{padding:'10px 12px'}}>
                            <span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,color:cnsDef.text}}>
                              <span style={{width:6,height:6,borderRadius:'50%',background:cnsDef.dot,display:'inline-block'}}/>
                              {ex.cns}
                            </span>
                          </td>
                          <td style={{padding:'10px 12px',color:C.textMuted,fontSize:11}}>{ex.pattern}</td>
                          <td style={{padding:'10px 12px'}}>
                            {hasVideo?<a href={exerciseVideos[ex.id]} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:C.blue}}>View</a>:<span style={{fontSize:11,color:C.textDim}}>—</span>}
                          </td>
                          <td style={{padding:'10px 12px'}}>
                            <div style={{display:'flex',gap:6}}>
                              <button onClick={()=>startEdit(ex)} style={{...S.btn(),fontSize:10,padding:'4px 8px'}}>Edit</button>
                              {isCustom&&<button onClick={()=>deleteCustomExercise(ex.id)} style={{...S.btn(),fontSize:10,padding:'4px 8px',background:'rgba(248,81,73,0.1)',color:C.red,border:'1px solid rgba(248,81,73,0.3)'}}>Delete</button>}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view==='principles'&&(
            <div>
              <div style={{fontSize:20,fontWeight:700,color:C.white,marginBottom:4}}>TRAINING PRINCIPLES</div>
              <div style={{fontSize:13,color:C.textMuted,marginBottom:4}}>Claude reads this when generating programs.</div>
              <div style={{fontSize:12,color:C.teal,marginBottom:16,padding:'8px 12px',background:'rgba(57,211,83,0.06)',border:'1px solid rgba(57,211,83,0.2)',borderRadius:6}}>
                Tip: Write prescriptions as Exercise Name: SxR @ % and the program builder will auto-suggest them.
                {Object.keys(parsedPrinciples).length>0&&<span style={{color:C.textMuted}}> · {Object.keys(parsedPrinciples).length} prescriptions detected.</span>}
              </div>
              <div style={S.card}>
                <textarea style={{...S.input,minHeight:400,lineHeight:1.8,resize:'vertical' as const}} value={princText} onChange={e=>setPrincText(e.target.value)} placeholder="Paste your training principles here..."/>
                <div style={{marginTop:12,display:'flex',alignItems:'center',gap:12}}>
                  <button style={S.btn('gold')} onClick={savePrinciples}>Save</button>
                  {princSaved&&<span style={{color:C.teal,fontSize:13,fontWeight:600}}>Saved</span>}
                </div>
              </div>
              {Object.keys(parsedPrinciples).length>0&&(
                <div style={S.card}>
                  <div style={{fontSize:11,color:C.textMuted,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'1px',marginBottom:10}}>Detected Prescriptions</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:8}}>
                    {Object.entries(parsedPrinciples).map(([name,p])=>(
                      <div key={name} style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:6,padding:'8px 10px'}}>
                        <div style={{fontSize:12,fontWeight:600,color:C.white,marginBottom:2,textTransform:'capitalize'}}>{name}</div>
                        <div style={{fontSize:11,color:C.gold}}>{p.sets}x{p.reps}{p.load?` @ ${p.load}%`:''}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {showPicker&&(
        <div style={{position:'fixed' as const,inset:0,background:'rgba(0,0,0,0.85)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:12,width:'100%',maxWidth:580,maxHeight:'82vh',display:'flex',flexDirection:'column' as const}}>
            <div style={{padding:'14px 18px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:C.white}}>Add Exercise</div>
                {pickerCell&&<div style={{fontSize:11,color:C.textMuted,marginTop:2}}>{pickerCell.day} · <span style={{color:CAT_MAP[pickerCell.cat]?.color||C.textMuted}}>{pickerCell.cat}</span></div>}
              </div>
              <button onClick={()=>{setShowPicker(false);setAddForm(null);setShowCustomForm(false)}} style={{background:'transparent',border:'none',color:C.textMuted,fontSize:18,cursor:'pointer',lineHeight:1}}>x</button>
            </div>
            {!addForm&&(
              <>
                <div style={{padding:'10px 14px',borderBottom:`1px solid ${C.border}`,display:'flex',gap:8,flexWrap:'wrap' as const,flexShrink:0}}>
                  <input style={{flex:1,background:C.bg3,border:`1px solid ${C.border}`,borderRadius:6,padding:'7px 10px',fontSize:13,color:C.text,outline:'none',minWidth:120}} placeholder="Search exercises..." value={pickerSearch} onChange={e=>setPickerSearch(e.target.value)} autoFocus/>
                  <select style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:6,padding:'7px 10px',fontSize:12,color:C.text,outline:'none'}} value={pickerCNS} onChange={e=>setPickerCNS(e.target.value)}>
                    <option value="All">All CNS</option>
                    <option value="High">High</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Low">Low</option>
                  </select>
                  <select style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:6,padding:'7px 10px',fontSize:12,color:C.text,outline:'none'}} value={pickerCat} onChange={e=>setPickerCat(e.target.value)}>
                    <option value="All">All Categories</option>
                    {CATEGORIES.map(c=><option key={c.key} value={c.key}>{c.key}</option>)}
                  </select>
                </div>
                <div style={{padding:'6px 14px',fontSize:10,color:C.textDim,borderBottom:`1px solid ${C.border}`,flexShrink:0}}>{filteredExercises.length} exercises</div>
                <div style={{overflowY:'auto' as const,flex:1}}>
                  {filteredExercises.map(ex=>{
                    const catColor=CAT_MAP[ex.category]?.color||C.textMuted
                    const cnsCol=CNS_COLORS[ex.cns]||CNS_COLORS['Low']
                    const prescription=lookupPrescription(ex.name,parsedPrinciples)
                    const hasVideo=!!exerciseVideos[ex.id]
                    const isCustom=ex.id.startsWith('custom_')
                    return(
                      <div key={ex.id} onClick={()=>{const p=lookupPrescription(ex.name,parsedPrinciples);setVideoInput(exerciseVideos[ex.id]||'');setAddForm({exercise:ex,sets:p?.sets||'3',reps:p?.reps||'4',load:p?.load||'',notes:''})}} style={{padding:'10px 14px',cursor:'pointer',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:10}}>
                        <div style={{width:3,height:32,borderRadius:2,background:catColor,flexShrink:0}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                            <span style={{fontSize:13,fontWeight:600,color:C.white}}>{ex.name}</span>
                            {isCustom&&<span style={{fontSize:9,background:'rgba(232,184,75,0.15)',color:C.gold,border:'1px solid rgba(232,184,75,0.3)',borderRadius:4,padding:'1px 5px',fontWeight:700}}>custom</span>}
                            {prescription&&<span style={{fontSize:9,background:'rgba(57,211,83,0.15)',color:C.teal,border:'1px solid rgba(57,211,83,0.3)',borderRadius:4,padding:'1px 5px',fontWeight:700}}>prescribed</span>}
                            {hasVideo&&<span style={{fontSize:9,background:'rgba(88,166,255,0.15)',color:C.blue,border:'1px solid rgba(88,166,255,0.3)',borderRadius:4,padding:'1px 5px',fontWeight:700}}>video</span>}
                          </div>
                          <div style={{display:'flex',gap:6,alignItems:'center'}}>
                            <span style={{fontSize:10,color:cnsCol.text}}>{ex.cns} CNS</span>
                            <span style={{fontSize:10,color:catColor}}>{ex.category}</span>
                            {prescription&&<span style={{fontSize:10,color:C.gold,fontWeight:600}}>{prescription.sets}x{prescription.reps}{prescription.load?` @ ${prescription.load}%`:''}</span>}
                          </div>
                        </div>
                        <span style={{fontSize:11,color:C.textDim,flexShrink:0}}>Add</span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
            {addForm&&(
              <div style={{padding:18,overflowY:'auto' as const,flex:1}}>
                <button onClick={()=>setAddForm(null)} style={{background:'transparent',border:'none',color:C.textMuted,cursor:'pointer',fontSize:12,marginBottom:14}}>Back to library</button>
                <div style={{marginBottom:14,padding:'12px 14px',background:CAT_MAP[addForm.exercise.category]?.bg||C.bg3,border:`1px solid ${CAT_MAP[addForm.exercise.category]?.border||C.border}`,borderRadius:8,borderLeft:`4px solid ${CAT_MAP[addForm.exercise.category]?.color||C.textMuted}`}}>
                  <div style={{fontSize:15,fontWeight:700,color:C.white,marginBottom:4}}>{addForm.exercise.name}</div>
                  <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:6}}>
                    <span style={{fontSize:10,color:CNS_COLORS[addForm.exercise.cns]?.text}}>{addForm.exercise.cns} CNS</span>
                    <span style={{fontSize:10,color:CAT_MAP[addForm.exercise.category]?.color||C.textMuted}}>{addForm.exercise.category}</span>
                  </div>
                  {addForm.exercise.description&&<div style={{fontSize:11,color:C.textMuted,lineHeight:1.6}}>{addForm.exercise.description}</div>}
                </div>
                {lookupPrescription(addForm.exercise.name,parsedPrinciples)&&(
                  <div style={{marginBottom:12,padding:'7px 10px',background:'rgba(57,211,83,0.08)',border:'1px solid rgba(57,211,83,0.25)',borderRadius:6,fontSize:11,color:C.teal}}>Auto-filled from your Training Principles</div>
                )}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:12}}>
                  {[{label:'Sets',key:'sets',placeholder:'3'},{label:'Reps',key:'reps',placeholder:'4'},{label:'Load %',key:'load',placeholder:'80'}].map(f=>(
                    <div key={f.key}>
                      <label style={{fontSize:10,color:C.textMuted,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4,display:'block'}}>{f.label}</label>
                      <input type="number" style={{width:'100%',background:C.bg3,border:`1px solid ${C.border}`,borderRadius:6,padding:'8px 10px',fontSize:15,fontWeight:600,color:C.white,boxSizing:'border-box' as const,outline:'none'}} placeholder={f.placeholder} value={(addForm as any)[f.key]} onChange={e=>setAddForm((prev:any)=>({...prev,[f.key]:e.target.value}))}/>
                    </div>
                  ))}
                </div>
                <div style={{marginBottom:12}}>
                  <label style={{fontSize:10,color:C.textMuted,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4,display:'block'}}>Coaching Note (optional)</label>
                  <input style={{width:'100%',background:C.bg3,border:`1px solid ${C.border}`,borderRadius:6,padding:'8px 10px',fontSize:13,color:C.text,boxSizing:'border-box' as const,outline:'none'}} placeholder="e.g. slow eccentric, 3 sec down..." value={addForm.notes} onChange={e=>setAddForm((prev:any)=>({...prev,notes:e.target.value}))}/>
                </div>
                <div style={{marginBottom:16}}>
                  <label style={{fontSize:10,color:C.textMuted,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4,display:'block'}}>
                    Video URL {exerciseVideos[addForm.exercise.id]&&<span style={{color:C.teal,fontWeight:400}}>· already saved</span>}
                  </label>
                  <div style={{display:'flex',gap:8}}>
                    <input style={{flex:1,background:C.bg3,border:`1px solid ${exerciseVideos[addForm.exercise.id]?'rgba(57,211,83,0.4)':C.border}`,borderRadius:6,padding:'8px 10px',fontSize:13,color:C.text,boxSizing:'border-box' as const,outline:'none'}} placeholder="https://youtube.com/watch?v=..." value={videoInput} onChange={e=>setVideoInput(e.target.value)}/>
                    {videoInput.trim()&&<button onClick={()=>saveVideo(addForm.exercise.id,videoInput)} style={{...S.btn(),background:'rgba(88,166,255,0.1)',color:C.blue,border:'1px solid rgba(88,166,255,0.3)'}}>{videoSaved?'Saved!':'Save'}</button>}
                  </div>
                  {exerciseVideos[addForm.exercise.id]&&<a href={exerciseVideos[addForm.exercise.id]} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:C.blue,display:'block',marginTop:4}}>View saved video</a>}
                </div>
                <div style={{background:C.bg3,borderRadius:8,padding:'10px 14px',marginBottom:16,fontSize:12,color:C.textMuted}}>
                  Will add: <span style={{color:C.gold,fontWeight:600}}>{addForm.exercise.name} {addForm.sets}x{addForm.reps}{addForm.load?` @ ${addForm.load}%`:''}{addForm.notes?` - ${addForm.notes}`:''}</span>
                </div>
                <button style={{...S.btn('gold'),width:'100%',padding:'12px',fontSize:14,textAlign:'center' as const}} onClick={confirmAddExercise}>
                  Add to {pickerCell?.day} - {pickerCell?.cat}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    {copyModal&&(
      <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setCopyModal(null)}>
        <div style={{background:'#1a1a2e',border:'1px solid rgba(255,255,255,0.1)',borderRadius:12,padding:24,minWidth:320,maxWidth:400}} onClick={e=>e.stopPropagation()}>
          <div style={{fontSize:15,fontWeight:700,color:'#fff',marginBottom:4}}>Copy Exercise</div>
          <div style={{fontSize:12,color:'#888',marginBottom:16}}>{copyModal.ex.name} · {copyModal.ex.sets}x{copyModal.ex.reps}{copyModal.ex.load?` @ ${copyModal.ex.load}%`:''}</div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,color:'#888',marginBottom:4}}>Copy to Pitcher</div>
            <select value={copyToPitcher?.id||''} onChange={e=>setCopyToPitcher(pitchers.find((p:any)=>p.id===e.target.value)||null)} style={{width:'100%',background:'#0d0d1a',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,padding:'8px 10px',fontSize:13,color:'#fff',outline:'none'}}>
              <option value=''>Select pitcher...</option>
              {pitchers.filter((p:any)=>p.id!==selected?.id).map((p:any)=>(
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:11,color:'#888',marginBottom:4}}>Day</div>
            <select value={copyToDay} onChange={e=>setCopyToDay(e.target.value)} style={{width:'100%',background:'#0d0d1a',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,padding:'8px 10px',fontSize:13,color:'#fff',outline:'none'}}>
              <option value=''>Select day...</option>
              {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d=>(
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div style={{marginBottom:20}}>
            <div style={{fontSize:11,color:'#888',marginBottom:4}}>Category</div>
            <select value={copyToCat} onChange={e=>setCopyToCat(e.target.value)} style={{width:'100%',background:'#0d0d1a',border:'1px solid rgba(255,255,255,0.1)',borderRadius:6,padding:'8px 10px',fontSize:13,color:'#fff',outline:'none'}}>
              <option value=''>Select category...</option>
              {['Pre-Throwing','Throwing','Post-Throwing','Main Exercises','Accessory','Conditioning','Recovery'].map(c=>(
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setCopyModal(null)} style={{flex:1,background:'transparent',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,padding:'10px',fontSize:13,color:'#888',cursor:'pointer'}}>Cancel</button>
            <button onClick={()=>copyExerciseToPitcher(copyModal.ex,copyToPitcher,copyToDay,copyToCat)} disabled={!copyToPitcher||!copyToDay||!copyToCat||copySaving} style={{flex:2,background:copyToPitcher&&copyToDay&&copyToCat?'rgba(57,211,83,0.15)':'rgba(255,255,255,0.05)',border:`1px solid ${copyToPitcher&&copyToDay&&copyToCat?'rgba(57,211,83,0.4)':'rgba(255,255,255,0.1)'}`,borderRadius:8,padding:'10px',fontSize:13,color:copyToPitcher&&copyToDay&&copyToCat?'#39d353':'#555',cursor:copyToPitcher&&copyToDay&&copyToCat?'pointer':'not-allowed'}}>
              {copySaving?'Copying...':'Copy Exercise'}
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  )
}
