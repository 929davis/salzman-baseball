'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

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
  { key:'Pre-Throwing',    color:'#38bdf8', bg:'rgba(56,189,248,0.10)',  border:'rgba(56,189,248,0.35)'  },
  { key:'Throwing',        color:'#39d353', bg:'rgba(57,211,83,0.10)',   border:'rgba(57,211,83,0.35)'   },
  { key:'Post-Throwing',   color:'#34d399', bg:'rgba(52,211,153,0.10)',  border:'rgba(52,211,153,0.35)'  },
  { key:'Main Exercises',  color:'#e8b84b', bg:'rgba(232,184,75,0.10)', border:'rgba(232,184,75,0.35)'  },
  { key:'Accessory',       color:'#a371f7', bg:'rgba(163,113,247,0.10)',border:'rgba(163,113,247,0.35)' },
  { key:'Conditioning',    color:'#58a6ff', bg:'rgba(88,166,255,0.10)', border:'rgba(88,166,255,0.35)'  },
  { key:'Recovery',        color:'#f97316', bg:'rgba(249,115,22,0.10)', border:'rgba(249,115,22,0.35)'  },
]
const CAT_MAP:Record<string,typeof CATEGORIES[0]> = Object.fromEntries(CATEGORIES.map(c=>[c.key,c]))

const CNS_COLORS:Record<string,{bg:string,border:string,text:string,dot:string}> = {
  'High':     { bg:'rgba(248,81,73,0.12)',   border:'rgba(248,81,73,0.5)',   text:'#f85149', dot:'#f85149' },
  'Moderate': { bg:'rgba(232,184,75,0.12)',  border:'rgba(232,184,75,0.5)',  text:'#e8b84b', dot:'#e8b84b' },
  'Low':      { bg:'rgba(57,211,83,0.12)',   border:'rgba(57,211,83,0.5)',   text:'#39d353', dot:'#39d353' },
}

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

const EXERCISE_DB = [
  {id:'ex_001',name:'Barbell Back Squat',pattern:'Squat',category:'Main Exercises',cns:'High',equipment:['Barbell'],description:'Stand with bar on upper traps, feet shoulder-width. Brace core, push knees out, descend until thighs parallel or below.',cues:['Chest up, eyes forward','Push knees out over toes','Big breath into belly before descent','Drive the floor away on the way up']},
  {id:'ex_002',name:'Goblet Squat',pattern:'Squat',category:'Accessory',cns:'Moderate',equipment:['Kettlebell'],description:'Hold KB at chest, feet slightly wider than shoulder-width. Squat deep, elbows track inside knees.',cues:['Tall chest, elbows inside knees','Sit between your heels','Push the floor apart']},
  {id:'ex_003',name:'Rear Foot Elevated Split Squat',pattern:'Lunge',category:'Main Exercises',cns:'Moderate',equipment:['Barbell','Dumbbell'],description:'Rear foot elevated on bench, front foot far enough forward so shin stays vertical.',cues:['Front shin vertical at bottom','Hips square','Strong glute squeeze at the top']},
  {id:'ex_004',name:'Lateral Lunge',pattern:'Lunge',category:'Accessory',cns:'Moderate',equipment:['Bodyweight','Dumbbell'],description:'Step wide to one side, push hips back and sit into the stepping leg.',cues:['Push hips back, not knees forward','Chest stays tall','Control the return']},
  {id:'ex_005',name:'Barbell Conventional Deadlift',pattern:'Hinge',category:'Main Exercises',cns:'High',equipment:['Barbell'],description:'Bar over mid-foot, hip-width stance. Hinge to grip, set back flat, drive floor away.',cues:['Bar over mid-foot at setup','Lats locked','Push the floor not pull the bar','Squeeze glutes hard at lockout']},
  {id:'ex_006',name:'Romanian Deadlift',pattern:'Hinge',category:'Main Exercises',cns:'Moderate',equipment:['Barbell','Dumbbell'],description:'Soft knee bend, push hips straight back maintaining flat back. Bar stays close.',cues:['Soft knees this is a hip hinge','Push hips back not down','Bar drags down your legs','Feel the hamstring stretch']},
  {id:'ex_007',name:'Single Leg RDL',pattern:'Hinge',category:'Accessory',cns:'Moderate',equipment:['Dumbbell','Kettlebell'],description:'Hinge on one leg, rear leg floats back as counterbalance.',cues:['Hip shoulder and rear heel stay in one line','Square your hips','Squeeze glute to stand']},
  {id:'ex_008',name:'Sumo Deadlift',pattern:'Hinge',category:'Main Exercises',cns:'High',equipment:['Barbell'],description:'Wide stance deadlift emphasizing inner thigh and hip strength.',cues:['Push knees out hard at the start','Chest up back flat','Drive the floor apart as you pull']},
  {id:'ex_009',name:'Trap Bar Deadlift',pattern:'Hinge',category:'Main Exercises',cns:'High',equipment:['Barbell'],description:'Stand in center of trap bar. More upright than conventional, easier to learn.',cues:['Stand in the center of the bar','Sit back into the start position','Drive knees out','Tall finish full hip extension']},
  {id:'ex_010',name:'Kettlebell Swing',pattern:'Hinge',category:'Conditioning',cns:'High',equipment:['Kettlebell'],description:'Ballistic hip hinge. Bell driven by hips not arms.',cues:['Hips generate the power arms just guide','Snap hips through at the top','Catch the bell on the way back']},
  {id:'ex_011',name:'Barbell Bench Press',pattern:'Horizontal Push',category:'Main Exercises',cns:'High',equipment:['Barbell'],description:'Lie flat, grip slightly wider than shoulder-width. Lower bar to lower chest.',cues:['Retract and depress shoulder blades','Drive feet into floor','Bar to lower chest','Squeeze the bar hard throughout']},
  {id:'ex_012',name:'1-Arm DB Bench Press',pattern:'Horizontal Push',category:'Accessory',cns:'Moderate',equipment:['Dumbbell'],description:'Unilateral pressing that challenges rotational stability.',cues:['Do not let your torso rotate','Press straight up','Squeeze glutes for stability']},
  {id:'ex_013',name:'Landmine Press',pattern:'Horizontal Push',category:'Accessory',cns:'Moderate',equipment:['Landmine'],description:'Shoulder-friendly pressing variation with a natural arc.',cues:['Lead with your elbow at the bottom','Press through and slightly out at the top','Keep ribs down']},
  {id:'ex_014',name:'Incline Dumbbell Press',pattern:'Horizontal Push',category:'Accessory',cns:'Moderate',equipment:['Dumbbell'],description:'Set bench to 30-45 degrees. Elbows at 45 degrees.',cues:['Retract shoulder blades before pressing','Elbows at 45 degrees','3-second controlled lowering']},
  {id:'ex_015',name:'Push-Up',pattern:'Horizontal Push',category:'Accessory',cns:'Low',equipment:['Bodyweight'],description:'Hands slightly wider than shoulders, body in one rigid plank.',cues:['Rigid plank from head to heels','Scapulae should move','Elbows at 45 degrees']},
  {id:'ex_016',name:'Barbell Row',pattern:'Horizontal Pull',category:'Main Exercises',cns:'High',equipment:['Barbell'],description:'Hinge to roughly 45 degrees. Pull bar to lower sternum, lead with elbows.',cues:['Hinge position','Lead with elbows not hands','Retract scapulae at the top','Bar to lower sternum']},
  {id:'ex_017',name:'Pendlay Row',pattern:'Horizontal Pull',category:'Main Exercises',cns:'High',equipment:['Barbell'],description:'Strict horizontal row from the floor each rep.',cues:['Torso stays parallel to floor','Explosive pull from a dead stop','Elbows drive back hard','Reset position each rep']},
  {id:'ex_018',name:'Single Arm DB Row',pattern:'Horizontal Pull',category:'Accessory',cns:'Moderate',equipment:['Dumbbell'],description:'Supported unilateral row. Pull DB to hip, lead with elbow.',cues:['Do not rotate your torso','Elbow drives back past your hip','Full stretch at the bottom','Controlled lowering']},
  {id:'ex_019',name:'Pull-Up',pattern:'Vertical Pull',category:'Main Exercises',cns:'Moderate',equipment:['Bodyweight'],description:'Dead hang start. Pull until chin clears bar.',cues:['Start from a full dead hang','Pull elbows to your pockets','Chest to the bar','Full lockout at the bottom each rep']},
  {id:'ex_020',name:'Lat Pulldown',pattern:'Vertical Pull',category:'Accessory',cns:'Low',equipment:['Cable'],description:'Slight lean back, pull bar to upper chest.',cues:['Pull to upper chest','Elbows drive down and back','Controlled return']},
  {id:'ex_021',name:'DB Shoulder Press',pattern:'Vertical Push',category:'Main Exercises',cns:'Moderate',equipment:['Dumbbell'],description:'Press dumbbells from shoulder height to full lockout overhead.',cues:['Brace core before pressing','Keep ribs down','Full lockout at the top']},
  {id:'ex_022',name:'Power Clean',pattern:'Hinge',category:'Main Exercises',cns:'High',equipment:['Barbell'],description:'Pull bar from floor, triple extend, catch in front rack.',cues:['Bar stays close to body','Triple extension hips knees ankles','Elbows shoot through fast on the catch']},
  {id:'ex_023',name:'Hang Clean',pattern:'Hinge',category:'Main Exercises',cns:'High',equipment:['Barbell'],description:'Power clean starting from hang position at mid-thigh.',cues:['Load the hamstrings in hang','Explosively drive hips through','Elbows fast on the catch']},
  {id:'ex_024',name:'Med Ball Scoop Toss',pattern:'Rotation',category:'Conditioning',cns:'High',equipment:['Medicine Ball'],description:'Load into back hip, drive hips through, scoop ball upward and forward.',cues:['Hips lead arms follow','Load into the trail leg first','Drive off the back foot','Let hips clear before arms move']},
  {id:'ex_025',name:'Med Ball Rotational Chest Pass',pattern:'Rotation',category:'Conditioning',cns:'High',equipment:['Medicine Ball'],description:'Explosive rotational throw from parallel stance into wall.',cues:['Load the back hip','Explode through the hips','Front foot stays planted']},
  {id:'ex_026',name:'Med Ball Overhead Slam',pattern:'Rotation',category:'Conditioning',cns:'High',equipment:['Medicine Ball'],description:'Reach overhead then slam into ground using entire body.',cues:['Reach tall full extension','Slam through the floor','Use your lats to accelerate']},
  {id:'ex_027',name:'Med Ball Side Slam',pattern:'Rotation',category:'Conditioning',cns:'High',equipment:['Medicine Ball'],description:'Lateral rotational slam training same pattern as pitching.',cues:['Load into the back hip','Hips clear before arms swing','Follow through to the other side']},
  {id:'ex_028',name:'Landmine Rotational Press',pattern:'Rotation',category:'Conditioning',cns:'Moderate',equipment:['Landmine'],description:'Rotational pressing from parallel stance.',cues:['Load the hip','Hips drive the rotation','Full hip extension at the top']},
  {id:'ex_029',name:'Broad Jump',pattern:'Locomotion',category:'Conditioning',cns:'High',equipment:['Bodyweight'],description:'Horizontal plyometric training explosive hip extension.',cues:['Arm swing adds distance','Load hips not just knees','Stick and hold before resetting']},
  {id:'ex_030',name:'Triple Broad Jump',pattern:'Locomotion',category:'Conditioning',cns:'High',equipment:['Bodyweight'],description:'Three consecutive broad jumps for maximum distance.',cues:['Land soft jump immediately','Same arm swing each jump','Last jump stick hard']},
  {id:'ex_031',name:'Depth Jump',pattern:'Locomotion',category:'Conditioning',cns:'High',equipment:['Bodyweight'],description:'Step off box, land and immediately jump as high as possible.',cues:['Step off do not jump off the box','Ground contact must be explosive','Jump immediately upon landing']},
  {id:'ex_032',name:'Lateral Bound',pattern:'Locomotion',category:'Conditioning',cns:'High',equipment:['Bodyweight'],description:'Jump from one foot to the other laterally.',cues:['Push hard off inside edge of foot','Land on single leg absorb','Stick each landing before next bound']},
  {id:'ex_033',name:'Skater Jump',pattern:'Locomotion',category:'Conditioning',cns:'High',equipment:['Bodyweight'],description:'Continuous lateral bounds with brief hold on each landing.',cues:['Lean into the bound','Land on ball of foot','Absorb with hip knee and ankle']},
  {id:'ex_034',name:'Pogo Hops',pattern:'Locomotion',category:'Conditioning',cns:'High',equipment:['Bodyweight'],description:'Rapid low-amplitude bilateral hops. Minimal knee bend.',cues:['Stiff ankles like springs','Get off ground as fast as possible','Stay on balls of feet entire time']},
  {id:'ex_035',name:'30-Yard Sprint',pattern:'Locomotion',category:'Conditioning',cns:'High',equipment:['Bodyweight'],description:'Short acceleration sprint. Drive phase first 10 yards.',cues:['Drive at 45 degree angle first 10 yards','Arms drive hard','Rest 2-3 min between reps']},
  {id:'ex_036',name:'Dead Bug',pattern:'Core',category:'Accessory',cns:'Low',equipment:['Bodyweight'],description:'Lie on back, arms up, knees at 90 degrees. Extend opposite arm and leg.',cues:['Lower back stays on floor entire time','Move slowly','Exhale as you extend']},
  {id:'ex_037',name:'Plank',pattern:'Core',category:'Accessory',cns:'Low',equipment:['Bodyweight'],description:'Static anti-extension hold. Body in one rigid line.',cues:['Squeeze glutes hard','Brace abs','Push floor away with forearms']},
  {id:'ex_038',name:'Side Plank',pattern:'Core',category:'Accessory',cns:'Low',equipment:['Bodyweight'],description:'Lateral anti-flexion hold.',cues:['Drive hips up','Stacked feet or staggered','Breathe steadily']},
  {id:'ex_039',name:'Ab Wheel Rollout',pattern:'Core',category:'Accessory',cns:'Low',equipment:['Bodyweight'],description:'Dynamic anti-extension. Roll forward until fully extended, pull back using lats and abs.',cues:['Brace before you move','Lats pull you back','Hips stay in line']},
  {id:'ex_040',name:'Half-Kneeling Pallof Press',pattern:'Anti-Rotation',category:'Accessory',cns:'Low',equipment:['Cable','Band'],description:'Anti-rotation press from split stance.',cues:['Down knee drives into floor','Press out slowly','Keep hips and shoulders square']},
  {id:'ex_041',name:'Copenhagen Plank',pattern:'Anti-Rotation',category:'Accessory',cns:'Low',equipment:['Bodyweight'],description:'Side plank with top leg elevated on bench.',cues:['Top ankle or knee on bench','Drive top leg into bench','Keep hips stacked']},
  {id:'ex_042',name:'Bear Crawl',pattern:'Locomotion',category:'Pre-Throwing',cns:'Low',equipment:['Bodyweight'],description:'Contralateral crawling. Knees hover 1 inch off floor.',cues:['Knees hover','Opposite arm and leg move together','Slow and controlled']},
  {id:'ex_043',name:'Lateral Ape Crawl',pattern:'Locomotion',category:'Pre-Throwing',cns:'Low',equipment:['Bodyweight'],description:'Lateral crawling developing frontal plane stability.',cues:['Stay low','Lead with hand then foot on same side','Move smoothly']},
  {id:'ex_044',name:'Spiderman Crawl',pattern:'Locomotion',category:'Pre-Throwing',cns:'Low',equipment:['Bodyweight'],description:'Forward crawl where knee drives to outside elbow with each step.',cues:['Bring knee to outside of same-side elbow','Rotate torso with each step','Move slowly to get the stretch']},
  {id:'ex_045',name:'Crab Walk',pattern:'Locomotion',category:'Pre-Throwing',cns:'Low',equipment:['Bodyweight'],description:'Posterior movement with hands and feet on floor, hips lifted.',cues:['Hips stay high','Fingers point away from body','Alternate hand and foot']},
  {id:'ex_046',name:'Band Pull-Apart',pattern:'Arm Care',category:'Pre-Throwing',cns:'Low',equipment:['Band'],description:'Hold band at shoulder width, pull apart to chest while squeezing shoulder blades.',cues:['Arms stay straight','Squeeze shoulder blades at end','Control the return']},
  {id:'ex_047',name:'Face Pull',pattern:'Arm Care',category:'Pre-Throwing',cns:'Low',equipment:['Cable','Band'],description:'Pull rope to face while rotating elbows up and out.',cues:['Pull to your nose','Elbows end up high and wide','Externally rotate at finish','Slow and controlled']},
  {id:'ex_048',name:'External Rotation at 90',pattern:'Arm Care',category:'Post-Throwing',cns:'Low',equipment:['Band','Cable','Dumbbell'],description:'Isolated rotator cuff with arm abducted to 90 degrees.',cues:['Upper arm stays parallel to floor','Move only at the shoulder','Slow and controlled both directions']},
  {id:'ex_049',name:'Dumbbell Hammer Curl',pattern:'Arm Care',category:'Post-Throwing',cns:'Low',equipment:['Dumbbell'],description:'Neutral grip curl targeting brachialis.',cues:['Neutral grip thumbs up','Elbow pinned at side','3-second lowering']},
  {id:'ex_050',name:'Dumbbell Pronation',pattern:'Arm Care',category:'Post-Throwing',cns:'Low',equipment:['Dumbbell'],description:'Offset grip. Forearm supported. Rotate from supinated to fully pronated.',cues:['Grip near the plate end','Forearm fully supported','Full range supinated to fully pronated']},
  {id:'ex_051',name:'Dumbbell Supination',pattern:'Arm Care',category:'Post-Throwing',cns:'Low',equipment:['Dumbbell'],description:'Offset grip. Rotate from pronated to fully supinated.',cues:['Full range of motion','Control the return','Pair with pronation']},
  {id:'ex_052',name:'Dumbbell Wrist Extension',pattern:'Arm Care',category:'Post-Throwing',cns:'Low',equipment:['Dumbbell'],description:'Forearm supported, palm down. Raise wrist into extension.',cues:['Palm faces down','Full range','Slow controlled return']},
  {id:'ex_053',name:'2-to-1 Eccentric Hammer Curl',pattern:'Arm Care',category:'Post-Throwing',cns:'Low',equipment:['Dumbbell'],description:'Both hands up, one hand down over 4-5 seconds.',cues:['Two hands up one hand down','5 seconds minimum lowering','Full extension at the bottom']},
  {id:'ex_054',name:'2-to-1 Eccentric Rear Delt Fly',pattern:'Arm Care',category:'Post-Throwing',cns:'Low',equipment:['Dumbbell'],description:'Both arms raise, one arm lowers over 4-5 seconds.',cues:['Both arms raise together one arm lowers','5-second lowering','Lead with pinky on way up']},
  {id:'ex_055',name:'Rear Delt Fly',pattern:'Arm Care',category:'Post-Throwing',cns:'Low',equipment:['Dumbbell'],description:'Hinge forward, raise arms to sides leading with pinkies.',cues:['Lead with pinkies','Pause at top','Control the lowering in 3 seconds']},
  {id:'ex_056',name:'Prone Y-T-W',pattern:'Arm Care',category:'Post-Throwing',cns:'Low',equipment:['Bodyweight','Dumbbell'],description:'Lying face down, arms form Y T and W positions lifting against gravity.',cues:['Thumbs up in all positions','Squeeze shoulder blades before lifting','No shrugging']},
  {id:'ex_057',name:'Scapular Wall Slide',pattern:'Arm Care',category:'Pre-Throwing',cns:'Low',equipment:['Bodyweight'],description:'Back against wall, slide arms overhead maintaining contact.',cues:['Whole back stays on wall','Elbows and wrists maintain contact','Move slowly']},
  {id:'ex_058',name:'Sleeper Stretch',pattern:'Mobility',category:'Recovery',cns:'Low',equipment:['Bodyweight'],description:'Lie on throwing-arm side, use free hand to gently push forearm toward floor.',cues:['Gentle pressure only','Keep shoulder blade on floor','Hold 30-60 seconds']},
  {id:'ex_059',name:'Hip 90/90 Stretch',pattern:'Mobility',category:'Recovery',cns:'Low',equipment:['Bodyweight'],description:'Sit with both legs at 90 degree angles. Transition between sides.',cues:['Both knees stay at 90 degrees','Sit tall','Breathe into tight spots']},
  {id:'ex_060',name:'Thoracic Spine Rotation',pattern:'Mobility',category:'Recovery',cns:'Low',equipment:['Bodyweight'],description:'Improve thoracic rotation in quadruped seated or lying positions.',cues:['Rotation from mid-back','Take breath in and rotate further on exhale','Hold briefly at end range']},
  {id:'ex_061',name:'Worlds Greatest Stretch',pattern:'Mobility',category:'Pre-Throwing',cns:'Low',equipment:['Bodyweight'],description:'Multi-joint stretch combining hip flexor thoracic rotation and ankle mobility.',cues:['Long lunge to start','Elbow drives toward floor first','Then rotate and reach overhead','3-5 reps per side']},
  {id:'td_001',name:'Two Knee Throw',pattern:'Throwing',category:'Throwing',cns:'Low',equipment:['Bodyweight'],description:'Kneel on both knees. Throw using only trunk rotation and arm action.',cues:['Sit tall on both knees','Rotation from trunk only','Full arm layback before rotating','Release point directly in front of throwing ear']},
  {id:'td_002',name:'One Knee Throw',pattern:'Throwing',category:'Throwing',cns:'Low',equipment:['Bodyweight'],description:'Throwing-side knee down, glove-side foot forward.',cues:['Back knee down front foot forward','Tall posture','Rotate through the front side']},
  {id:'td_003',name:'Rocker Drill',pattern:'Throwing',category:'Throwing',cns:'Moderate',equipment:['Bodyweight'],description:'Split stance. Rock weight back to front rhythmically, throw at top of forward weight shift.',cues:['Rock back gently then forward with intent','Arm begins moving as weight shifts forward','Find your rhythm']},
  {id:'td_004',name:'Hover Throw',pattern:'Throwing',category:'Throwing',cns:'Moderate',equipment:['Bodyweight'],description:'Balance on pivot foot with lead leg lifted. Hold 1-2 seconds then throw.',cues:['Balance on pivot foot no swaying','Hold for a full count','Lead leg drops and plants no stride']},
  {id:'td_005',name:'Split Stance Throw',pattern:'Throwing',category:'Throwing',cns:'Moderate',equipment:['Bodyweight'],description:'Lead foot already planted at stride width. Throw from fixed position.',cues:['Start with feet at stride width','Drive front hip closed as long as possible','Aggressive hip-to-shoulder separation']},
  {id:'td_006',name:'Walk Away Throw',pattern:'Throwing',category:'Throwing',cns:'Moderate',equipment:['Bodyweight'],description:'Walk away from target, pivot and throw in one fluid motion.',cues:['Walk with purpose','Pivot foot plants parallel to target line','Direct energy toward target']},
  {id:'td_007',name:'Toss Up Throw',pattern:'Throwing',category:'Throwing',cns:'Moderate',equipment:['Bodyweight'],description:'Toss ball slightly upward and catch in throwing hand as arm begins action.',cues:['Toss 6-12 inches above throwing hand','Catch and throw in one motion','Arm must be in right position to catch']},
  {id:'td_008',name:'Forward Hop Throw',pattern:'Throwing',category:'Throwing',cns:'High',equipment:['Bodyweight'],description:'Hop forward on pivot foot, land, immediately throw upon landing.',cues:['Hop with intent','Land and throw immediately no pause','Do not land stiff-legged absorb and redirect']},
  {id:'td_009',name:'Double Hop Throw',pattern:'Throwing',category:'Throwing',cns:'High',equipment:['Bodyweight'],description:'Two consecutive hops pivot foot then lead foot throw immediately.',cues:['Hop 1 pivot foot builds momentum','Hop 2 lead foot accepts and redirects','Throw immediately off Hop 2']},
  {id:'apr_001',name:'POW Walks',pattern:'Locomotion',category:'Pre-Throwing',cns:'Low',equipment:['Bodyweight'],description:'Contralateral walking with exaggerated arm swing.',cues:['Tall posture','Opposite arm and leg move together','Exaggerated arm swing to shoulder height','Breathe rhythmically']},
  {id:'apr_002',name:'Band Pull Apart Arm Prep',pattern:'Arm Care',category:'Pre-Throwing',cns:'Low',equipment:['Band'],description:'Pre-throwing band pull apart for scapular activation.',cues:['Arms stay straight','Lead with pinkies','Squeeze shoulder blades at end','Light band activation only']},
  {id:'apr_003',name:'Band Face Pull Arm Prep',pattern:'Arm Care',category:'Pre-Throwing',cns:'Low',equipment:['Band'],description:'Pre-throwing face pull activating external rotators.',cues:['Pull to your nose','Elbows high and wide','Externally rotate at finish']},
  {id:'apr_004',name:'Arm Swings',pattern:'Mobility',category:'Pre-Throwing',cns:'Low',equipment:['Bodyweight'],description:'Swing both arms forward and back in controlled pendulum.',cues:['Relax everything','Gradually increase range','Do not force end range use momentum']},
  {id:'apr_005',name:'Reverse Throws',pattern:'Throwing',category:'Post-Throwing',cns:'Moderate',equipment:['Bodyweight'],description:'Simulate deceleration phase of throwing in reverse.',cues:['Start in follow-through position','Reverse the motion back through your arc','Controlled speed not explosive']},
  {id:'apr_006',name:'Roll-In Throws',pattern:'Throwing',category:'Pre-Throwing',cns:'Moderate',equipment:['Medicine Ball'],description:'Underhand rolling motion from throwing position.',cues:['Light ball','Let the ball roll off fingertips','Follow through completely','Feel the rotation leading the arm']},
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
  const [showPicker,setShowPicker]=useState(false)
  const [pickerCell,setPickerCell]=useState<{day:string,cat:string}|null>(null)
  const [pickerSearch,setPickerSearch]=useState('')
  const [pickerCNS,setPickerCNS]=useState('All')
  const [pickerCat,setPickerCat]=useState('All')
  const [addForm,setAddForm]=useState<any>(null)

  const router=useRouter()
  const supabase=createClient()
  const parsedPrinciples = useMemo(()=>parsePrinciples(principles),[principles])

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
      setLoading(false)
    }
    init()
  },[])

  const selectPitcher=async(p:any)=>{
    setSelected(p);setTab('overview');setView('roster')
    const [logsRes,notesRes,msgsRes,cmjRes,progRes]=await Promise.all([
      supabase.from('session_logs').select('*').eq('pitcher_id',p.id).order('log_date',{ascending:false}),
      supabase.from('coach_notes').select('*').eq('pitcher_id',p.id).order('created_at',{ascending:false}),
      supabase.from('messages').select('*').eq('pitcher_id',p.id).order('created_at'),
      supabase.from('cmj_results').select('*').eq('pitcher_id',p.id).order('test_date',{ascending:false}),
      supabase.from('programs').select('*').eq('pitcher_id',p.id).order('week_of',{ascending:false}).limit(1)
    ])
    setLogs(logsRes.data||[])
    setNotes(notesRes.data||[])
    setMessages(msgsRes.data||[])
    setCmjResults(cmjRes.data||[])
    const prog=progRes.data?.[0]||null
    setProgram(prog)
    setStructuredDays(prog?.structured_days||{})
    setCellNotes(prog?.days||{})
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

  const openPicker=(day:string,cat:string)=>{
    setPickerCell({day,cat})
    setPickerSearch('')
    setPickerCNS('All')
    setPickerCat(cat)
    setAddForm(null)
    setShowPicker(true)
  }

  const confirmAddExercise=async()=>{
    if (!addForm||!pickerCell)return
    const {exercise,sets,reps,load,notes:exNotes}=addForm
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

  const removeExercise=async(key:string,idx:number)=>{
    const updated={...structuredDays,[key]:(structuredDays[key]||[]).filter((_:any,i:number)=>i!==idx)}
    setStructuredDays(updated)
    await saveProgram(updated,cellNotes)
  }

  const updateCellNote=async(day:string,cat:string,val:string)=>{
    const key=`${day}___${cat}`
    const updated={...cellNotes,[key]:val}
    setCellNotes(updated)
    await saveProgram(structuredDays,updated)
  }

  const buildPrompt=()=>{
    const jiP=armCare(selected?.weekly_pitches||0,selected?.avg_velocity||0)
    const lastCMJ=cmjResults[0]
    const recentLogs=logs.slice(0,7)
    const prompt=`You are helping Coach Salzman write a weekly training program for pitcher ${selected?.full_name}.

PITCHER DATA:
- Avg Velocity: ${selected?.avg_velocity||'—'} mph
- Weekly Pitches: ${selected?.weekly_pitches||'—'} | HE Throws: ${selected?.weekly_high_effort||'—'}
- Arm Care Min: ${jiP.toLocaleString()} ft·lb
${lastCMJ?`- CMJ Velo Capacity: ${lastCMJ.estimated_velocity?.toFixed(1)} mph | Jump: ${lastCMJ.jump_height_in?.toFixed(1)}in | RSI: ${lastCMJ.rsi_mod?.toFixed(2)}`:'- No CMJ data'}

RECENT LOGS:
${recentLogs.map((l:any)=>`  ${l.log_date}: vel=${l.velocity||'—'}mph, feeling=${l.feeling||'—'}/10, soreness=[${(l.soreness||[]).join(',')||'none'}]`).join('\n')||'  None.'}

TRAINING PRINCIPLES:
${principles||'No principles yet.'}

Write next week's program by day and category (Pre-Throwing, Throwing, Post-Throwing, Main Exercises, Accessory, Conditioning, Recovery). Use format: "Exercise Name SxR @ X%"`
    navigator.clipboard.writeText(prompt).catch(()=>{})
    window.open('https://claude.ai','_blank')
    alert('Prompt copied! Paste into Claude.')
  }

  const filteredExercises=useMemo(()=>EXERCISE_DB.filter(ex=>{
    const q=pickerSearch.toLowerCase()
    if (q&&!ex.name.toLowerCase().includes(q)&&!ex.pattern.toLowerCase().includes(q))return false
    if (pickerCNS!=='All'&&ex.cns!==pickerCNS)return false
    if (pickerCat!=='All'&&ex.category!==pickerCat)return false
    return true
  }),[pickerSearch,pickerCNS,pickerCat])

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
          {['roster','principles'].map(v=>(
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

          {view==='roster'&&selected&&(
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
                {['overview','logs','program','notes','messages'].map(t=>(
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
                  {cmjResults[0]&&(
                    <div style={{...S.card,border:'1px solid rgba(163,113,247,0.3)',background:'rgba(163,113,247,0.05)'}}>
                      <div style={{fontSize:11,color:C.purple,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'1px',marginBottom:10}}>Latest CMJ</div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                        {[{l:'Velo Capacity',v:`${cmjResults[0].estimated_velocity?.toFixed(1)} mph`},{l:'Jump Height',v:`${cmjResults[0].jump_height_in?.toFixed(1)} in`},{l:'RSI',v:cmjResults[0].rsi_mod?.toFixed(2)},{l:'PP/kg',v:`${cmjResults[0].peak_power_per_kg?.toFixed(1)} W/kg`}].map(m=>(
                          <div key={m.l} style={{textAlign:'center'}}>
                            <div style={{fontSize:10,color:C.purple,marginBottom:3}}>{m.l}</div>
                            <div style={{fontSize:15,fontWeight:700,color:C.white}}>{m.v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                      <span style={{fontSize:10,color:C.textDim,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'1px'}}>CNS:</span>
                      {['High','Moderate','Low'].map(c=>(
                        <div key={c} style={{display:'flex',alignItems:'center',gap:4}}>
                          <div style={{width:7,height:7,borderRadius:'50%',background:CNS_COLORS[c].dot}}/>
                          <span style={{fontSize:10,color:C.textMuted}}>{c}</span>
                        </div>
                      ))}
                    </div>
                    <button style={S.btn('gold')} onClick={buildPrompt}>✨ Claude ↗</button>
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
                                    </div>
                                    <button onClick={()=>removeExercise(key,i)} style={{background:'transparent',border:'none',color:C.textDim,cursor:'pointer',fontSize:11,padding:'0 2px',lineHeight:1,flexShrink:0}}>x</button>
                                  </div>
                                ))}
                                {note&&!isExpanded&&(
                                  <div style={{fontSize:9,color:C.textDim,fontStyle:'italic',marginTop:exercises.length>0?3:0,cursor:'pointer'}} onClick={()=>setExpandedCell(key)}>
                                    note: {note.length>40?note.slice(0,40)+'...':note}
                                  </div>
                                )}
                                {isExpanded&&(
                                  <textarea
                                    autoFocus
                                    style={{width:'100%',background:C.bg3,border:`1px solid ${cat.border}`,borderRadius:4,padding:'4px 6px',fontSize:10,color:C.text,resize:'none' as const,outline:'none',minHeight:52,boxSizing:'border-box' as const,marginTop:3,fontFamily:'system-ui'}}
                                    value={note}
                                    onChange={e=>updateCellNote(day,cat.key,e.target.value)}
                                    onBlur={()=>setExpandedCell(null)}
                                    placeholder="Coaching note..."
                                  />
                                )}
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
                    <div style={{fontSize:11,color:C.textMuted,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'1px',marginBottom:10}}>New Note</div>
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
              <button onClick={()=>{setShowPicker(false);setAddForm(null)}} style={{background:'transparent',border:'none',color:C.textMuted,fontSize:18,cursor:'pointer',lineHeight:1}}>x</button>
            </div>
            {!addForm?(
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
                  {filteredExercises.length===0&&<div style={{padding:20,textAlign:'center',color:C.textDim,fontSize:13}}>No exercises match your filters.</div>}
                  {filteredExercises.map(ex=>{
                    const catColor=CAT_MAP[ex.category]?.color||C.textMuted
                    const cnsCol=CNS_COLORS[ex.cns]||CNS_COLORS['Low']
                    const prescription=lookupPrescription(ex.name,parsedPrinciples)
                    return(
                      <div key={ex.id} onClick={()=>{const p=lookupPrescription(ex.name,parsedPrinciples);setAddForm({exercise:ex,sets:p?.sets||'3',reps:p?.reps||'4',load:p?.load||'',notes:''})}} style={{padding:'10px 14px',cursor:'pointer',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:10}}>
                        <div style={{width:3,height:32,borderRadius:2,background:catColor,flexShrink:0}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                            <span style={{fontSize:13,fontWeight:600,color:C.white}}>{ex.name}</span>
                            {prescription&&<span style={{fontSize:9,background:'rgba(57,211,83,0.15)',color:C.teal,border:'1px solid rgba(57,211,83,0.3)',borderRadius:4,padding:'1px 5px',fontWeight:700}}>prescribed</span>}
                          </div>
                          <div style={{display:'flex',gap:6,alignItems:'center'}}>
                            <span style={{display:'inline-flex',alignItems:'center',gap:3,fontSize:10,color:cnsCol.text}}>
                              <span style={{width:6,height:6,borderRadius:'50%',background:cnsCol.dot,display:'inline-block'}}/>
                              {ex.cns} CNS
                            </span>
                            <span style={{fontSize:10,color:catColor}}>{ex.category}</span>
                            <span style={{fontSize:10,color:C.textDim}}>{ex.pattern}</span>
                            {prescription&&<span style={{fontSize:10,color:C.gold,fontWeight:600}}>{prescription.sets}x{prescription.reps}{prescription.load?` @ ${prescription.load}%`:''}</span>}
                          </div>
                        </div>
                        <span style={{fontSize:11,color:C.textDim,flexShrink:0}}>Add</span>
                      </div>
                    )
                  })}
                </div>
              </>
            ):(
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
                {addForm.exercise.cues?.length>0&&(
                  <div style={{marginBottom:14}}>
                    <div style={{fontSize:10,color:C.gold,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:6}}>Coaching Cues</div>
                    {addForm.exercise.cues.map((cue:string,i:number)=>(
                      <div key={i} style={{fontSize:11,color:C.textMuted,marginBottom:3,paddingLeft:10,borderLeft:`2px solid ${C.goldDim}`}}>{cue}</div>
                    ))}
                  </div>
                )}
                {lookupPrescription(addForm.exercise.name,parsedPrinciples)&&(
                  <div style={{marginBottom:12,padding:'7px 10px',background:'rgba(57,211,83,0.08)',border:'1px solid rgba(57,211,83,0.25)',borderRadius:6,fontSize:11,color:C.teal}}>
                    Auto-filled from your Training Principles
                  </div>
                )}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:12}}>
                  {[{label:'Sets',key:'sets',placeholder:'3'},{label:'Reps',key:'reps',placeholder:'4'},{label:'Load %',key:'load',placeholder:'80'}].map(f=>(
                    <div key={f.key}>
                      <label style={{fontSize:10,color:C.textMuted,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4,display:'block'}}>{f.label}</label>
                      <input type="number" style={{width:'100%',background:C.bg3,border:`1px solid ${C.border}`,borderRadius:6,padding:'8px 10px',fontSize:15,fontWeight:600,color:C.white,boxSizing:'border-box' as const,outline:'none'}} placeholder={f.placeholder} value={(addForm as any)[f.key]} onChange={e=>setAddForm((prev:any)=>({...prev,[f.key]:e.target.value}))}/>
                    </div>
                  ))}
                </div>
                <div style={{marginBottom:16}}>
                  <label style={{fontSize:10,color:C.textMuted,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4,display:'block'}}>Coaching Note (optional)</label>
                  <input style={{width:'100%',background:C.bg3,border:`1px solid ${C.border}`,borderRadius:6,padding:'8px 10px',fontSize:13,color:C.text,boxSizing:'border-box' as const,outline:'none'}} placeholder="e.g. slow eccentric, 3 sec down..." value={addForm.notes} onChange={e=>setAddForm((prev:any)=>({...prev,notes:e.target.value}))}/>
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
    </div>
  )
}
