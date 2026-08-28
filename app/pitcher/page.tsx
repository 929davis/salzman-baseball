'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import PitchingIQ from '@/app/components/PitchingIQ'
import CountLeverageTable from '@/app/components/CountLeverageTable'
import AthleticBenchmarks from '@/app/components/AthleticBenchmarks'
import ProgressOverview from '@/app/components/ProgressOverview'
import MiniSparkline from '@/app/components/MiniSparkline'
import ArmCareSummary from '@/app/components/ArmCareSummary'
import TestVideoLink from '@/app/components/TestVideoLink'
import { useTestVideos } from '@/lib/testVideos'
import { parseTime, calcCMJFn } from '@/lib/cmj'

const C = {
  bg:'#0d1117',bg2:'#161b22',bg3:'#1c2333',border:'#30363d',
  gold:'#e8b84b',goldDim:'#a07c28',goldBg:'rgba(232,184,75,0.08)',
  teal:'#39d353',red:'#f85149',blue:'#58a6ff',purple:'#a371f7',
  text:'#e6edf3',textMuted:'#7d8590',textDim:'#484f58',white:'#ffffff',
}

const SORENESS = ['Shoulder','Elbow','Forearm','Wrist','Back','Hip','Knee','Hamstring','Quad','Other']
const READINESS_OPTIONS = [
  {value:'trusts_it',label:'Trusts It'},
  {value:'hesitant',label:'Hesitant'},
  {value:'guarding',label:'Guarding'},
]
const READINESS_COLORS:Record<string,string> = {trusts_it:'#39d353',hesitant:'#e8b84b',guarding:'#f85149'}
const RTT_PHASE_LABELS:Record<string,string> = {protective:'Protective',retraining:'Retraining',integration:'Integration',performance:'Performance'}
const RTT_PHASE_COLORS:Record<string,string> = {protective:'#f85149',retraining:'#e8b84b',integration:'#58a6ff',performance:'#39d353'}
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const NEW_CATS = ['Pre-Throwing','Throwing','Post-Throwing','Main Exercises','Accessory','Conditioning','Recovery']
const CAT_COLORS:Record<string,string> = {
  'Pre-Throwing':'#38bdf8','Throwing':'#39d353','Post-Throwing':'#34d399',
  'Main Exercises':'#e8b84b','Accessory':'#a371f7','Conditioning':'#58a6ff','Recovery':'#f97316',
}

const MEAL_TYPES = ['Pre-Training','Post-Training','Recovery Meal','Regular Meal']
const MEAL_TYPE_COLORS:Record<string,string> = {
  'Pre-Training':'#58a6ff','Post-Training':'#39d353','Recovery Meal':'#a371f7','Regular Meal':'#e8b84b'
}
const MEAL_TYPE_GUIDELINES:Record<string,string> = {
  'Pre-Training':'1 hour before training. Easily digestible carbs + moderate protein. Think white rice, fruit, OJ, eggs. Avoid high fat and high fiber.',
  'Post-Training':'Within 30 minutes after training. Protein priority — milk, eggs, shellfish, white fish. Pair with fruit for glycogen replenishment.',
  'Recovery Meal':'2-3 hours after training. Balanced full meal — protein + carbs + saturated fat. Your biggest meal of the day.',
  'Regular Meal':'Hit your macro targets (40% protein / 30% carbs / 30% fat) with pro-metabolic whole foods.',
}

const PRO_METABOLIC_FOODS = ['Eggs','Milk','Fruit','Orange Juice','Shellfish','White Fish','Liver','Coconut Oil','Butter','Bone Broth']

const GI_OPTIONS = [
  {label:'Low (under 55) — most fruits, eggs, milk, fish',value:'low',gi:40,glMult:0.5},
  {label:'Medium (55-70) — white rice, oats, banana',value:'medium',gi:62,glMult:1.0},
  {label:'High (over 70) — white bread, sugary drinks',value:'high',gi:80,glMult:1.5},
]

const CMJ_THRESHOLDS = {
  jumpHeight:{aboveAverage:21,good:18,developing:15},
  ppKg:{aboveAverage:70,good:62,developing:55},
  rsi:{aboveAverage:0.86,good:0.64,developing:0.45},
}

function getTier(val:number,thresholds:{aboveAverage:number,good:number,developing:number}){
  if (!val) return 'No Data'
  if (val>=thresholds.aboveAverage) return 'Above Average'
  if (val>=thresholds.good) return 'Good'
  if (val>=thresholds.developing) return 'Developing'
  return 'Limited'
}

function classifyCMJ(cmj:any){
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

const TIER_COLORS:Record<string,{bg:string,border:string,text:string}> = {
  'Above Average':{bg:'rgba(57,211,83,0.12)',border:'rgba(57,211,83,0.4)',text:'#39d353'},
  'Good':{bg:'rgba(88,166,255,0.12)',border:'rgba(88,166,255,0.4)',text:'#58a6ff'},
  'Developing':{bg:'rgba(232,184,75,0.12)',border:'rgba(232,184,75,0.4)',text:'#e8b84b'},
  'Limited':{bg:'rgba(248,81,73,0.12)',border:'rgba(248,81,73,0.4)',text:'#f85149'},
  'No Data':{bg:'rgba(72,79,88,0.12)',border:'rgba(72,79,88,0.4)',text:'#484f58'},
}

const CLASS_COLORS:Record<string,{bg:string,border:string,text:string,desc:string}> = {
  'Well Developed':{bg:'rgba(57,211,83,0.1)',border:'rgba(57,211,83,0.35)',text:'#39d353',desc:'Your neuromuscular base is solid. Focus is on throwing volume, arm health, and skill development.'},
  'Rate Limiter':{bg:'rgba(88,166,255,0.1)',border:'rgba(88,166,255,0.35)',text:'#58a6ff',desc:'You have strength but your nervous system needs to learn to express it faster. Training focuses on speed-strength work, plyometrics, and lighter loads moved explosively.'},
  'Magnitude Limiter':{bg:'rgba(232,184,75,0.1)',border:'rgba(232,184,75,0.35)',text:'#e8b84b',desc:'Your nervous system fires fast but needs more raw force to work with. Training focuses on building a stronger foundation with heavier compound movements.'},
  'Both Limited':{bg:'rgba(248,81,73,0.1)',border:'rgba(248,81,73,0.35)',text:'#f85149',desc:'Both strength and rate of force development need work. Training starts with building a strength base before adding speed work.'},
  'Developing':{bg:'rgba(163,113,247,0.1)',border:'rgba(163,113,247,0.35)',text:'#a371f7',desc:'Your training profile is still developing. Complete more CMJ tests to get a clearer picture.'},
  'No Data':{bg:'rgba(72,79,88,0.1)',border:'rgba(72,79,88,0.35)',text:'#7d8590',desc:'No CMJ data yet. Complete a CMJ test to see your neuromuscular profile.'},
}

function scoreMeal(protein:number,carbs:number,fat:number,giOption:string,proMetabolicFoods:string[],mealType:string,foodQualityOverride?:number){
  const cal=(protein*4)+(carbs*4)+(fat*9)
  const giOpt=GI_OPTIONS.find(g=>g.value===giOption)||GI_OPTIONS[0]
  const gl=Math.round((giOpt.gi*carbs*giOpt.glMult)/100)
  const glScore=gl<=10?20:gl<=20?12:5
  const proMetabolicBonus=Math.min(10,proMetabolicFoods.length*2)
  const foodQualityScore=Math.min(30,15+proMetabolicBonus+(giOption==='low'?5:0))
  const timingScore=mealType==='Post-Training'?10:mealType==='Pre-Training'?8:mealType==='Recovery Meal'?7:3
  return{cal,gl,gi:giOpt.gi,glScore,foodQualityScore,timingScore}
}

function scoreFuelDay(meals:any[]){
  if (!meals.length) return {total:0,macro:0,quality:0,glycemic:0,timing:0}
  const totP=meals.reduce((s:number,m:any)=>s+(m.estimated_protein||0),0)
  const totC=meals.reduce((s:number,m:any)=>s+(m.estimated_carbs||0),0)
  const totF=meals.reduce((s:number,m:any)=>s+(m.estimated_fat||0),0)
  const totCal=(totP*4)+(totC*4)+(totF*9)
  let macroScore=0
  if (totCal>0){
    const actP=(totP*4/totCal)*100
    const actC=(totC*4/totCal)*100
    const actF=(totF*9/totCal)*100
    const avgDiff=(Math.abs(actP-40)+Math.abs(actC-30)+Math.abs(actF-30))/3
    macroScore=avgDiff<=5?30:avgDiff<=10?20:avgDiff<=15?10:Math.max(0,5-avgDiff)
  }
  const qualityScore=Math.min(30,meals.reduce((s:number,m:any)=>s+(m.food_quality_score||0),0)/meals.length)
  const glycemicScore=Math.min(20,meals.reduce((s:number,m:any)=>s+(m.gl_score||0),0)/meals.length)
  const timingScore=Math.min(20,meals.reduce((s:number,m:any)=>s+(m.timing_score||0),0))
  const total=Math.min(100,Math.round(macroScore+qualityScore+glycemicScore+timingScore))
  return{total,macro:Math.round(macroScore),quality:Math.round(qualityScore),glycemic:Math.round(glycemicScore),timing:Math.round(timingScore)}
}

function scoreColor(score:number){
  if (score>=80) return C.teal
  if (score>=60) return C.gold
  if (score>=40) return '#f97316'
  return C.red
}

const BLANK_MEAL={description:'',protein:'',carbs:'',fat:'',giOption:'low',proMetabolicFoods:[] as string[]}

const FrameInputs=({form,setForm,fields,inp,lbl}:{form:any,setForm:any,fields:{key:string,label:string,placeholder:string}[],inp:any,lbl:any})=>(
  <div>
    {fields.map(f=>(
      <div key={f.key}>
        <label style={lbl}>{f.label}</label>
        <input type="text" style={inp} placeholder={f.placeholder} value={form[f.key]} onChange={e=>setForm((prev:any)=>({...prev,[f.key]:e.target.value}))}/>
      </div>
    ))}
  </div>
)

export default function PitcherDashboard(){
  const [profile,setProfile]=useState<any>(null)
  const [exerciseVideos,setExerciseVideos]=useState<Record<string,string>>({})
  const [tab,setTab]=useState('overview')
  const [program,setProgram]=useState<any>(null)
  const [logs,setLogs]=useState<any[]>([])
  const [messages,setMessages]=useState<any[]>([])
  const [notes,setNotes]=useState<any[]>([])
  const [cmjResults,setCmjResults]=useState<any[]>([])
  const [foodLogs,setFoodLogs]=useState<any[]>([])
  const [dailyFuelScore,setDailyFuelScore]=useState<any>(null)
  const [loading,setLoading]=useState(true)
  const [msgText,setMsgText]=useState('')
  const [logForm,setLogForm]=useState({date:new Date().toISOString().split('T')[0],velocity:'',weightLifted:'',sprintTime:'',pitchCount:'',highEffortThrows:'',feeling:7,soreness:[] as string[],readiness:'',notes:''})
  const [logSaved,setLogSaved]=useState(false)

  // Food log state
  const [mealType,setMealType]=useState('Regular Meal')
  const [mealForm,setMealForm]=useState<any>(BLANK_MEAL)
  const [mealSaved,setMealSaved]=useState(false)
  const [waterOz,setWaterOz]=useState('')
  const [waterSaved,setWaterSaved]=useState(false)
  const [showGuidelines,setShowGuidelines]=useState(false)

  // Assessment forms
  const [cmjForm,setCmjForm]=useState({date:new Date().toISOString().split('T')[0],bodyweight:'',weightUnit:'lbs',fps:'240',startTime:'',takeoffTime:'',landingTime:'',notes:''})
  const [cmjResult,setCmjResult]=useState<any>(null)
  const [cmjErr,setCmjErr]=useState('')
  const [assessTab,setAssessTab]=useState('cmj')

  const today=new Date().toISOString().split('T')[0]
  const router=useRouter()
  const supabase=createClient()
  const {videos:testVideos, saveVideo:saveTestVideo} = useTestVideos()

  useEffect(()=>{
    const init=async()=>{
      const {data:{user}}=await supabase.auth.getUser()
      if (!user){router.push('/auth/login');return}
      const {data:prof}=await supabase.from('profiles').select('*').eq('id',user.id).single()
      if (!prof||prof.role==='coach'){router.push('/coach');return}
      setProfile(prof)
      const [progRes,logsRes,msgsRes,notesRes,cmjRes,foodRes,fuelRes,videosRes]=await Promise.all([
        supabase.from('programs').select('*').eq('pitcher_id',prof.id).order('week_of',{ascending:false}).limit(1),
        supabase.from('session_logs').select('*').eq('pitcher_id',prof.id).order('log_date',{ascending:false}).limit(20),
        supabase.from('messages').select('*').eq('pitcher_id',prof.id).order('created_at'),
        supabase.from('coach_notes').select('*').eq('pitcher_id',prof.id).order('created_at',{ascending:false}),
        supabase.from('cmj_results').select('*').eq('pitcher_id',prof.id).order('test_date',{ascending:false}),
        supabase.from('food_logs').select('*').eq('pitcher_id',prof.id).eq('log_date',today).order('created_at'),
        supabase.from('daily_fuel_scores').select('*').eq('pitcher_id',prof.id).eq('log_date',today).single(),
        supabase.from('exercise_videos').select('*'),
      ])
      setProgram(progRes.data?.[0]||null)
      setLogs(logsRes.data||[])
      setMessages(msgsRes.data||[])
      setNotes(notesRes.data||[])
      setCmjResults(cmjRes.data||[])
      setFoodLogs(foodRes.data||[])
      setDailyFuelScore(fuelRes.data||null)
      const videoMap: Record<string, string> = {}
      ;(videosRes.data || []).forEach((v: any) => { videoMap[v.exercise_id] = v.video_url })
      setExerciseVideos(videoMap)
      setLoading(false)
    }
    init()
  },[])

  const signOut=async()=>{await supabase.auth.signOut();router.push('/auth/login')}

  const submitLog=async()=>{
    if (!profile)return
    await supabase.from('session_logs').insert({
      pitcher_id:profile.id,log_date:logForm.date,
      velocity:parseFloat(logForm.velocity)||null,weight_lifted:parseFloat(logForm.weightLifted)||null,
      sprint_time:parseFloat(logForm.sprintTime)||null,pitch_count:parseInt(logForm.pitchCount)||null,
      high_effort_throws:parseInt(logForm.highEffortThrows)||null,feeling:logForm.feeling,
      soreness:logForm.soreness,readiness:logForm.readiness||null,notes:logForm.notes||null
    })
    const {data}=await supabase.from('session_logs').select('*').eq('pitcher_id',profile.id).order('log_date',{ascending:false}).limit(20)
    setLogs(data||[])
    setLogForm({date:new Date().toISOString().split('T')[0],velocity:'',weightLifted:'',sprintTime:'',pitchCount:'',highEffortThrows:'',feeling:7,soreness:[],readiness:'',notes:''})
    setLogSaved(true);setTimeout(()=>setLogSaved(false),2000)
  }

  const sendMessage=async()=>{
    if (!msgText.trim()||!profile)return
    const {data}=await supabase.from('messages').insert({pitcher_id:profile.id,sender_id:profile.id,sender_role:'pitcher',content:msgText.trim()}).select().single()
    if (data){setMessages([...messages,data]);setMsgText('')}
  }

  const toggleSoreness=(a:string)=>setLogForm(f=>({...f,soreness:f.soreness.includes(a)?f.soreness.filter(x=>x!==a):[...f.soreness,a]}))
  const setReadiness=(v:string)=>setLogForm(f=>({...f,readiness:f.readiness===v?'':v}))

  const toggleProMetabolic=(food:string)=>setMealForm((f:any)=>({...f,proMetabolicFoods:f.proMetabolicFoods.includes(food)?f.proMetabolicFoods.filter((x:string)=>x!==food):[...f.proMetabolicFoods,food]}))

  const saveMeal=async()=>{
    if (!mealForm.description.trim()||!profile)return
    const p=parseFloat(mealForm.protein)||0
    const c=parseFloat(mealForm.carbs)||0
    const f=parseFloat(mealForm.fat)||0
    const scores=scoreMeal(p,c,f,mealForm.giOption,mealForm.proMetabolicFoods,mealType)
    const {data:meal}=await supabase.from('food_logs').insert({
      pitcher_id:profile.id,log_date:today,meal_type:mealType,
      meal_description:mealForm.description,
      estimated_protein:p,estimated_carbs:c,estimated_fat:f,
      estimated_calories:scores.cal,gi_score:scores.gi,gl_score:scores.gl,
      food_quality_score:scores.foodQualityScore,timing_score:scores.timingScore,
      pro_metabolic_foods:mealForm.proMetabolicFoods,
    }).select().single()
    if (meal){
      const newFoodLogs=[...foodLogs,meal]
      setFoodLogs(newFoodLogs)
      const dayScores=scoreFuelDay(newFoodLogs)
      await supabase.from('daily_fuel_scores').upsert({
        pitcher_id:profile.id,log_date:today,
        macro_score:dayScores.macro,quality_score:dayScores.quality,
        glycemic_score:dayScores.glycemic,timing_score:dayScores.timing,
        total_score:dayScores.total,water_oz:dailyFuelScore?.water_oz||0
      },{onConflict:'pitcher_id,log_date'})
      setDailyFuelScore((prev:any)=>({...prev,...dayScores,total_score:dayScores.total}))
    }
    setMealForm(BLANK_MEAL)
    setMealSaved(true);setTimeout(()=>setMealSaved(false),2000)
  }

  const saveWater=async()=>{
    if (!waterOz||!profile)return
    const scores=scoreFuelDay(foodLogs)
    await supabase.from('daily_fuel_scores').upsert({
      pitcher_id:profile.id,log_date:today,
      macro_score:scores.macro,quality_score:scores.quality,
      glycemic_score:scores.glycemic,timing_score:scores.timing,
      total_score:scores.total,water_oz:parseFloat(waterOz)
    },{onConflict:'pitcher_id,log_date'})
    setDailyFuelScore((prev:any)=>({...prev,water_oz:parseFloat(waterOz)}))
    setWaterSaved(true);setTimeout(()=>setWaterSaved(false),2000)
  }

  // Assessment calcs
  const calcCMJHandler=()=>{
    setCmjErr('')
    const bw=parseFloat(cmjForm.bodyweight)
    const st=parseTime(cmjForm.startTime),tt=parseTime(cmjForm.takeoffTime),lt=parseTime(cmjForm.landingTime)
    if (!bw||isNaN(st)||isNaN(tt)||isNaN(lt)||tt<=st||lt<=tt){setCmjErr('Check your inputs.');return}
    const massKg=cmjForm.weightUnit==='lbs'?bw*0.453592:bw
    setCmjResult(calcCMJFn({startTime:st,takeoffTime:tt,landingTime:lt,massKg}))
  }
  const saveCMJ=async()=>{
    if (!cmjResult||!profile)return
    const bw=parseFloat(cmjForm.bodyweight)
    const massKg=cmjForm.weightUnit==='lbs'?bw*0.453592:bw
    const fps=parseFloat(cmjForm.fps)
    await supabase.from('cmj_results').insert({
      pitcher_id:profile.id,test_date:cmjForm.date,bodyweight:bw,weight_unit:cmjForm.weightUnit,
      fps:parseInt(cmjForm.fps),start_frame:Math.round(parseTime(cmjForm.startTime)*fps),
      takeoff_frame:Math.round(parseTime(cmjForm.takeoffTime)*fps),landing_frame:Math.round(parseTime(cmjForm.landingTime)*fps),
      flight_time:cmjResult.flightTime,jump_height_in:cmjResult.jumpHeightIn,rsi_mod:cmjResult.rsiMod,
      peak_power_per_kg:cmjResult.peakPowerPerKg,takeoff_velocity:cmjResult.takeoffVelocity,
      explosive_index:cmjResult.explosiveIndex,estimated_velocity:cmjResult.estimatedVelocity,notes:cmjForm.notes||null
    })
    const {data}=await supabase.from('cmj_results').select('*').eq('pitcher_id',profile.id).order('test_date',{ascending:false})
    setCmjResults(data||[]);setCmjResult(null)
    setCmjForm({date:new Date().toISOString().split('T')[0],bodyweight:'',weightUnit:'lbs',fps:'240',startTime:'',takeoffTime:'',landingTime:'',notes:''})
  }

  const latestCMJ=cmjResults[0]
  const {classification}=classifyCMJ(latestCMJ)
  const classCol=CLASS_COLORS[classification]||CLASS_COLORS['No Data']
  const unread=messages.filter((m:any)=>m.sender_role==='coach'&&!m.read).length
  const todayScores=scoreFuelDay(foodLogs)

  // Live calorie preview
  const p=parseFloat(mealForm.protein)||0
  const c=parseFloat(mealForm.carbs)||0
  const f=parseFloat(mealForm.fat)||0
  const previewCal=Math.round((p*4)+(c*4)+(f*9))

  if (loading)return <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',color:C.textMuted,fontFamily:'system-ui'}}>Loading...</div>

  const inp={width:'100%',background:C.bg3,border:`1px solid ${C.border}`,borderRadius:8,padding:'12px 14px',fontSize:15,color:C.text,boxSizing:'border-box' as const,outline:'none',marginBottom:4}
  const lbl={fontSize:11,color:C.textMuted,fontWeight:600 as const,marginBottom:6,display:'block',textTransform:'uppercase' as const,letterSpacing:'0.5px',marginTop:14 as const}
  const card={background:C.bg2,border:`1px solid ${C.border}`,borderRadius:12,padding:'16px',marginBottom:12}
  const btn=(v='primary')=>({background:v==='gold'?C.gold:C.bg3,color:v==='gold'?C.bg:C.text,border:`1px solid ${v==='gold'?C.gold:C.border}`,borderRadius:8,padding:'12px 20px',fontSize:14,fontWeight:v==='gold'?700:500 as const,cursor:'pointer',width:'100%',marginTop:8})

  return(
    <div style={{fontFamily:'system-ui,-apple-system,sans-serif',background:C.bg,minHeight:'100vh',color:C.text,maxWidth:480,margin:'0 auto'}}>
      {/* Header */}
      <div style={{background:C.bg2,borderBottom:`1px solid ${C.border}`,padding:'14px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:10}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:32,height:32,background:`linear-gradient(135deg,${C.gold},${C.goldDim})`,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>⚾</div>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:C.white}}>Salzman Baseball</div>
            <div style={{fontSize:11,color:C.textMuted}}>{profile?.full_name}</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          {todayScores.total>0&&(
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:9,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px'}}>Fuel</div>
              <div style={{fontSize:16,fontWeight:700,color:scoreColor(todayScores.total)}}>{todayScores.total}<span style={{fontSize:10,color:C.textDim}}>/100</span></div>
            </div>
          )}
          <button onClick={signOut} style={{background:'transparent',border:'none',color:C.textMuted,fontSize:12,cursor:'pointer'}}>Sign Out</button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{display:'flex',background:C.bg2,borderBottom:`1px solid ${C.border}`,padding:'0 2px',overflowX:'auto' as const}}>
        {[
          {id:'overview',icon:'📈',label:'Overview'},
          {id:'program',icon:'📋',label:'Program'},
          {id:'food',icon:'🥗',label:'Food'},
          {id:'assess',icon:'🧪',label:'Assess'},
          {id:'log',icon:'📝',label:'Log'},
          {id:'messages',icon:'💬',label:unread>0?`(${unread})`:'Chat'},
          {id:'notes',icon:'📌',label:'Notes'},
          {id:'iq',icon:'🎯',label:'Pitching IQ'},
          {id:'situations',icon:'📊',label:'Situations'},
          {id:'anatomy',icon:'🦴',label:'Anatomy',external:true},
        ].map(t=>(
          <button key={t.id} onClick={()=>t.external?router.push('/anatomy'):setTab(t.id)} style={{flex:1,background:'transparent',border:'none',borderBottom:`2px solid ${tab===t.id?C.gold:'transparent'}`,padding:'8px 2px',cursor:'pointer',color:tab===t.id?C.gold:C.textMuted,fontSize:9,fontWeight:tab===t.id?700:400,textTransform:'uppercase' as const,letterSpacing:'0.3px',whiteSpace:'nowrap' as const}}>
            <div style={{fontSize:15,marginBottom:2}}>{t.icon}</div>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{padding:'16px'}}>

        {/* OVERVIEW TAB */}
        {tab==='overview'&&profile&&(
          <ProgressOverview pitcherId={profile.id} mode="athlete"/>
        )}

        {/* PROGRAM TAB */}
        {tab==='program'&&(
          <div>
            <div style={{fontSize:18,fontWeight:700,color:C.white,marginBottom:4}}>My Program</div>
            <div style={{fontSize:12,color:C.textMuted,marginBottom:16}}>Week of {program?.week_of||'—'}</div>
            {latestCMJ&&(
              <div style={{...card,background:classCol.bg,border:`1px solid ${classCol.border}`,marginBottom:16}}>
                <div style={{fontSize:10,color:classCol.text,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'1px',marginBottom:4}}>Your Training Profile</div>
                <div style={{fontSize:16,fontWeight:700,color:classCol.text,marginBottom:6}}>{classification}</div>
                <div style={{fontSize:12,color:C.textMuted,lineHeight:1.6}}>{classCol.desc}</div>
              </div>
            )}
            {!program&&<div style={{...card,textAlign:'center',color:C.textMuted,padding:'32px 16px'}}>No program yet.</div>}
            {program&&(()=>{
              const structured=program.structured_days||{}
              return DAYS.map(day=>{
                const dayCats=NEW_CATS.filter(cat=>{
                  const key=`${day}___${cat}`
                  return (structured[key]||[]).length>0||(program.days?.[key])
                })
                if (!dayCats.length) return(
                  <div key={day} style={{...card,opacity:0.5}}>
                    <div style={{fontSize:12,fontWeight:700,color:C.textMuted,textTransform:'uppercase' as const}}>{day}</div>
                    <div style={{fontSize:13,color:C.textDim,marginTop:4}}>Rest</div>
                  </div>
                )
                return(
                  <div key={day} style={card}>
                    <div style={{fontSize:13,fontWeight:700,color:C.gold,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:10}}>{day}</div>
                    {NEW_CATS.map(cat=>{
                      const key=`${day}___${cat}`
                      const exercises=structured[key]||[]
                      const note=program.days?.[key]||''
                      if (!exercises.length&&!note)return null
                      const catCol=CAT_COLORS[cat]||C.textMuted
                      return(
                        <div key={cat} style={{marginBottom:10}}>
                          <div style={{fontSize:10,color:catCol,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:6}}>{cat}</div>
                          {exercises.map((ex:any,i:number)=>(
                            <div key={i} style={{padding:'8px 10px',background:C.bg3,borderRadius:8,marginBottom:6,borderLeft:`3px solid ${catCol}`}}>
                              <div style={{fontSize:13,fontWeight:600,color:C.white,marginBottom:2}}>{ex.name}</div>
                              <div style={{fontSize:12,color:catCol,fontWeight:600}}>{ex.sets}×{ex.reps}{ex.load?` @ ${ex.load}%`:''}</div>
                              {ex.notes&&<div style={{fontSize:11,color:C.textMuted,marginTop:2,fontStyle:'italic'}}>{ex.notes}</div>}
                              {exerciseVideos[ex.id]&&<a href={exerciseVideos[ex.id]} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:C.blue,marginTop:4,display:'inline-block',textDecoration:'none'}}>▶ Watch Video</a>}
                            </div>
                          ))}
                          {note&&<div style={{fontSize:12,color:C.textMuted,fontStyle:'italic',padding:'6px 10px',background:C.bg3,borderRadius:6}}>{note}</div>}
                        </div>
                      )
                    })}
                  </div>
                )
              })
            })()}
          </div>
        )}

        {/* FOOD TAB */}
        {tab==='food'&&(
          <div>
            <div style={{fontSize:18,fontWeight:700,color:C.white,marginBottom:4}}>Food Log</div>
            <div style={{fontSize:12,color:C.textMuted,marginBottom:16}}>{new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</div>

            {/* Daily Fuel Score */}
            <div style={{...card,textAlign:'center',background:todayScores.total>0?`rgba(${todayScores.total>=80?'57,211,83':todayScores.total>=60?'232,184,75':todayScores.total>=40?'249,115,22':'248,81,73'},0.08)`:'rgba(72,79,88,0.06)',border:`1px solid ${todayScores.total>0?scoreColor(todayScores.total)+'40':C.border}`,marginBottom:16}}>
              <div style={{fontSize:10,color:C.textMuted,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'1px',marginBottom:8}}>Today's Fuel Score</div>
              <div style={{fontSize:56,fontWeight:700,color:todayScores.total>0?scoreColor(todayScores.total):C.textDim,letterSpacing:'-2px',marginBottom:8}}>
                {todayScores.total>0?todayScores.total:'—'}<span style={{fontSize:16,color:C.textMuted,fontWeight:400}}>/100</span>
              </div>
              {todayScores.total>0&&(
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,marginTop:8}}>
                  {[{l:'Macros',v:todayScores.macro,max:30},{l:'Quality',v:todayScores.quality,max:30},{l:'Glycemic',v:todayScores.glycemic,max:20},{l:'Timing',v:todayScores.timing,max:20}].map(s=>(
                    <div key={s.l} style={{background:'rgba(0,0,0,0.2)',borderRadius:6,padding:'6px 4px'}}>
                      <div style={{fontSize:9,color:C.textMuted,marginBottom:2}}>{s.l}</div>
                      <div style={{fontSize:13,fontWeight:700,color:C.white}}>{s.v}<span style={{fontSize:9,color:C.textDim}}>/{s.max}</span></div>
                    </div>
                  ))}
                </div>
              )}
              {todayScores.total===0&&<div style={{fontSize:12,color:C.textDim}}>Log your first meal to see your score</div>}
            </div>

            {/* Water */}
            <div style={{...card,marginBottom:16}}>
              <div style={{fontSize:11,color:C.blue,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'1px',marginBottom:10}}>💧 Water Intake</div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <input type="text" inputMode="numeric" pattern="[0-9]*" style={{...inp,flex:1,marginBottom:0}} placeholder="oz today (target: 80-100)" value={waterOz} onChange={e=>setWaterOz(e.target.value)}/>
                <button onClick={saveWater} style={{background:C.blue,color:C.bg,border:'none',borderRadius:8,padding:'12px 16px',fontSize:13,fontWeight:700,cursor:'pointer',flexShrink:0}}>Save</button>
              </div>
              {waterSaved&&<div style={{fontSize:12,color:C.teal,marginTop:6}}>✓ Water logged</div>}
              {dailyFuelScore?.water_oz>0&&<div style={{fontSize:12,color:C.textMuted,marginTop:6}}>Today: {dailyFuelScore.water_oz} oz</div>}
            </div>

            {/* Meal timing guidelines toggle */}
            <button onClick={()=>setShowGuidelines(!showGuidelines)} style={{...card,width:'100%',textAlign:'left',cursor:'pointer',background:'rgba(232,184,75,0.04)',border:'1px solid rgba(232,184,75,0.2)',marginBottom:16,display:'flex',justifyContent:'space-between',alignItems:'center'} as any}>
              <span style={{fontSize:11,color:C.gold,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'1px'}}>Meal Timing Guidelines</span>
              <span style={{color:C.gold,fontSize:14}}>{showGuidelines?'▲':'▼'}</span>
            </button>
            {showGuidelines&&(
              <div style={{...card,marginTop:-8,marginBottom:16,background:'rgba(232,184,75,0.04)',border:'1px solid rgba(232,184,75,0.2)'}}>
                {Object.entries(MEAL_TYPE_GUIDELINES).map(([type,guide])=>(
                  <div key={type} style={{marginBottom:10,paddingBottom:10,borderBottom:`1px solid ${C.border}`}}>
                    <div style={{fontSize:11,fontWeight:700,color:MEAL_TYPE_COLORS[type],marginBottom:2}}>{type}</div>
                    <div style={{fontSize:11,color:C.textMuted,lineHeight:1.5}}>{guide}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Log a meal */}
            <div style={card}>
              <div style={{fontSize:13,fontWeight:700,color:C.white,marginBottom:12}}>Log a Meal</div>

              {/* Meal type */}
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,color:C.textMuted,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:8}}>Meal Type</div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap' as const}}>
                  {MEAL_TYPES.map(t=>(
                    <button key={t} onClick={()=>setMealType(t)} style={{background:mealType===t?`${MEAL_TYPE_COLORS[t]}20`:'transparent',color:mealType===t?MEAL_TYPE_COLORS[t]:C.textMuted,border:`1px solid ${mealType===t?MEAL_TYPE_COLORS[t]:C.border}`,borderRadius:8,padding:'6px 10px',fontSize:11,fontWeight:mealType===t?700:400,cursor:'pointer'}}>{t}</button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <label style={lbl}>What did you eat?</label>
              <textarea style={{...inp,minHeight:60,resize:'vertical' as const}} placeholder="e.g. 3 scrambled eggs, white rice, orange juice" value={mealForm.description} onChange={e=>setMealForm((f:any)=>({...f,description:e.target.value}))}/>

              {/* Macros */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginTop:8}}>
                {[{key:'protein',label:'Protein (g)',color:C.teal},{key:'carbs',label:'Carbs (g)',color:C.blue},{key:'fat',label:'Fat (g)',color:C.gold}].map(f=>(
                  <div key={f.key}>
                    <label style={{...lbl,color:f.color,marginTop:8}}>{f.label}</label>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" style={{...inp,marginBottom:0}} placeholder="0" value={mealForm[f.key]} onChange={e=>setMealForm((prev:any)=>({...prev,[f.key]:e.target.value}))}/>
                  </div>
                ))}
              </div>

              {/* Calorie preview */}
              {previewCal>0&&(
                <div style={{textAlign:'center',padding:'8px',marginTop:8,background:'rgba(0,0,0,0.2)',borderRadius:6,fontSize:13,color:C.gold,fontWeight:700}}>
                  {previewCal} calories
                </div>
              )}

              {/* GI */}
              <label style={lbl}>Glycemic Index of this meal</label>
              <select style={inp} value={mealForm.giOption} onChange={e=>setMealForm((f:any)=>({...f,giOption:e.target.value}))}>
                {GI_OPTIONS.map(g=><option key={g.value} value={g.value}>{g.label}</option>)}
              </select>

              {/* Pro-metabolic foods */}
              <div style={{marginTop:12,marginBottom:8}}>
                <div style={{fontSize:11,color:C.textMuted,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:8}}>Pro-Metabolic Foods in this meal</div>
                <div style={{display:'flex',flexWrap:'wrap' as const,gap:6}}>
                  {PRO_METABOLIC_FOODS.map(food=>(
                    <button key={food} onClick={()=>toggleProMetabolic(food)} style={{background:mealForm.proMetabolicFoods.includes(food)?'rgba(57,211,83,0.15)':'transparent',color:mealForm.proMetabolicFoods.includes(food)?C.teal:C.textMuted,border:`1px solid ${mealForm.proMetabolicFoods.includes(food)?C.teal:C.border}`,borderRadius:20,padding:'5px 10px',fontSize:11,cursor:'pointer'}}>{food}</button>
                  ))}
                </div>
              </div>

              <button style={btn('gold')} onClick={saveMeal} disabled={!mealForm.description.trim()}>Save Meal</button>
              {mealSaved&&<div style={{textAlign:'center',color:C.teal,fontSize:13,fontWeight:600,marginTop:8}}>✓ Meal saved!</div>}
            </div>

            {/* Today's meals */}
            {foodLogs.length>0&&(
              <div>
                <div style={{fontSize:14,fontWeight:700,color:C.white,marginBottom:10}}>Today's Meals</div>
                {foodLogs.map((meal:any,i:number)=>{
                  const mealCol=MEAL_TYPE_COLORS[meal.meal_type]||C.textMuted
                  return(
                    <div key={i} style={{...card,borderLeft:`3px solid ${mealCol}`}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:6}}>
                        <div style={{flex:1,minWidth:0}}>
                          <span style={{fontSize:10,color:mealCol,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'0.5px'}}>{meal.meal_type}</span>
                          <div style={{fontSize:13,color:C.white,fontWeight:600,marginTop:2,lineHeight:1.4}}>{meal.meal_description}</div>
                        </div>
                        <div style={{textAlign:'right',flexShrink:0,marginLeft:8}}>
                          <div style={{fontSize:14,fontWeight:700,color:C.gold}}>{Math.round(meal.estimated_calories)} cal</div>
                        </div>
                      </div>
                      <div style={{display:'flex',gap:10,flexWrap:'wrap' as const,marginBottom:4}}>
                        <span style={{fontSize:11,color:C.teal}}>P: {meal.estimated_protein}g</span>
                        <span style={{fontSize:11,color:C.blue}}>C: {meal.estimated_carbs}g</span>
                        <span style={{fontSize:11,color:C.gold}}>F: {meal.estimated_fat}g</span>
                        <span style={{fontSize:11,color:C.textMuted}}>GI: {meal.gi_score} · GL: {meal.gl_score}</span>
                      </div>
                      {meal.pro_metabolic_foods?.length>0&&(
                        <div style={{fontSize:10,color:C.teal}}>✓ {meal.pro_metabolic_foods.join(', ')}</div>
                      )}
                    </div>
                  )
                })}

                {/* Daily totals */}
                <div style={{...card,background:'rgba(232,184,75,0.06)',border:'1px solid rgba(232,184,75,0.2)'}}>
                  <div style={{fontSize:11,color:C.gold,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'1px',marginBottom:8}}>Daily Totals</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                    {[
                      {l:'Calories',v:Math.round(foodLogs.reduce((s:number,m:any)=>s+m.estimated_calories,0))},
                      {l:'Protein',v:`${Math.round(foodLogs.reduce((s:number,m:any)=>s+m.estimated_protein,0))}g`},
                      {l:'Carbs',v:`${Math.round(foodLogs.reduce((s:number,m:any)=>s+m.estimated_carbs,0))}g`},
                      {l:'Fat',v:`${Math.round(foodLogs.reduce((s:number,m:any)=>s+m.estimated_fat,0))}g`},
                    ].map(s=>(
                      <div key={s.l} style={{textAlign:'center',padding:'8px',background:'rgba(0,0,0,0.2)',borderRadius:6}}>
                        <div style={{fontSize:9,color:C.textMuted,marginBottom:2}}>{s.l}</div>
                        <div style={{fontSize:14,fontWeight:700,color:C.white}}>{s.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ASSESS TAB */}
        {tab==='assess'&&(
          <div>
            <div style={{fontSize:18,fontWeight:700,color:C.white,marginBottom:4}}>Assessments</div>
            <div style={{fontSize:12,color:C.textMuted,marginBottom:16}}>Film at 240 FPS · Open in Photos · Edit · Scrub to find timestamps</div>
            <div style={{display:'flex',gap:6,marginBottom:16,overflowX:'auto' as const,paddingBottom:4}}>
              {[{id:'cmj',label:'CMJ'},{id:'arm_care',label:'Arm Care'},{id:'benchmarks',label:'Benchmarks'}].map(t=>(
                <button key={t.id} onClick={()=>setAssessTab(t.id)} style={{background:assessTab===t.id?C.gold:C.bg3,color:assessTab===t.id?C.bg:C.textMuted,border:`1px solid ${assessTab===t.id?C.gold:C.border}`,borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:assessTab===t.id?700:400,cursor:'pointer',whiteSpace:'nowrap' as const,flexShrink:0}}>{t.label}</button>
              ))}
            </div>

            {assessTab==='cmj'&&(
              <div>
                <div style={{...card,background:'rgba(88,166,255,0.05)',border:'1px solid rgba(88,166,255,0.2)',marginBottom:12}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.blue,marginBottom:4}}>Countermovement Jump (CMJ)</div>
                  <div style={{fontSize:12,color:C.textMuted,lineHeight:1.6,marginBottom:6}}>Squat down then jump as high as possible. Film at 240fps and record the timestamps below.</div>
                  <TestVideoLink testKey="cmj" videos={testVideos} onSave={saveTestVideo}/>
                </div>
                <div style={card}>
                  <label style={lbl}>Date</label>
                  <input type="date" style={inp} value={cmjForm.date} onChange={e=>setCmjForm(f=>({...f,date:e.target.value}))}/>
                  <label style={lbl}>Body Weight</label>
                  <div style={{display:'flex',gap:8}}>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" style={{...inp,flex:1}} placeholder="e.g. 195" value={cmjForm.bodyweight} onChange={e=>setCmjForm(f=>({...f,bodyweight:e.target.value}))}/>
                    <select style={{...inp,width:80}} value={cmjForm.weightUnit} onChange={e=>setCmjForm(f=>({...f,weightUnit:e.target.value}))}><option value="lbs">lbs</option><option value="kg">kg</option></select>
                  </div>
                  <label style={lbl}>FPS</label>
                  <select style={inp} value={cmjForm.fps} onChange={e=>setCmjForm(f=>({...f,fps:e.target.value}))}><option value="240">240 FPS (iPhone)</option><option value="120">120 FPS</option><option value="480">480 FPS</option><option value="30">30 FPS (Real Time)</option></select>
                  <FrameInputs form={cmjForm} setForm={setCmjForm} inp={inp} lbl={lbl} fields={[{key:'startTime',label:'Start Time',placeholder:'e.g. 0:03.20'},{key:'takeoffTime',label:'Takeoff Time',placeholder:'e.g. 0:03.20'},{key:'landingTime',label:'Landing Time',placeholder:'e.g. 0:03.20'}]}/>
                  {cmjErr&&<div style={{color:C.red,fontSize:13,marginTop:8,padding:'10px',background:'rgba(248,81,73,0.1)',borderRadius:8}}>{cmjErr}</div>}
                  <button style={btn('gold')} onClick={calcCMJHandler}>Calculate</button>
                </div>
                {cmjResult&&(
                  <div style={{...card,border:'1px solid rgba(163,113,247,0.4)',background:'rgba(163,113,247,0.06)',textAlign:'center'}}>
                    <div style={{fontSize:11,color:C.purple,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'1px',marginBottom:8}}>Estimated Velocity Capacity</div>
                    <div style={{fontSize:56,fontWeight:700,color:C.white,letterSpacing:'-2px',marginBottom:8}}>{cmjResult.estimatedVelocity.toFixed(1)}<span style={{fontSize:18,color:C.textMuted,fontWeight:400}}> MPH</span></div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                      {[{l:'Jump Height',v:`${cmjResult.jumpHeightIn.toFixed(1)} in`},{l:'RSI-Mod',v:cmjResult.rsiMod.toFixed(2)},{l:'Peak Power/kg',v:`${cmjResult.peakPowerPerKg.toFixed(1)} W/kg`},{l:'Flight Time',v:`${cmjResult.flightTime.toFixed(3)}s`}].map(m=>(
                        <div key={m.l} style={{background:'rgba(163,113,247,0.08)',borderRadius:8,padding:'10px'}}>
                          <div style={{fontSize:10,color:C.purple,marginBottom:3}}>{m.l}</div>
                          <div style={{fontSize:16,fontWeight:700,color:C.white}}>{m.v}</div>
                        </div>
                      ))}
                    </div>
                    <button style={{...btn('gold'),marginTop:0}} onClick={saveCMJ}>Save to Profile</button>
                  </div>
                )}
                {cmjResults.length>1&&(()=>{
                  const asc=[...cmjResults].reverse()
                  const heightHist=asc.map(r=>({date:r.test_date,value:r.jump_height_in})).filter(h=>h.value!=null)
                  const rsiHist=asc.map(r=>({date:r.test_date,value:r.rsi_mod})).filter(h=>h.value!=null)
                  const powerHist=asc.map(r=>({date:r.test_date,value:r.peak_power_per_kg})).filter(h=>h.value!=null)
                  return (
                    <div style={card}>
                      <div style={{fontSize:14,fontWeight:700,color:C.white,marginBottom:10}}>CMJ Trends</div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10}}>
                        {[{label:'Jump Height',hist:heightHist,color:C.gold,unit:' in'},{label:'RSI-Mod',hist:rsiHist,color:C.teal,unit:''},{label:'Peak Power',hist:powerHist,color:C.blue,unit:' W/kg'}].map(m=>(
                          <div key={m.label}>
                            <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4}}>{m.label}</div>
                            {m.hist.length>1?<MiniSparkline data={m.hist} color={m.color} unit={m.unit} height={70}/>:<div style={{fontSize:11,color:C.textDim,padding:'20px 0',textAlign:'center' as const}}>Not enough data</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
                {cmjResults.length>0&&(
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:C.white,marginBottom:10}}>CMJ History</div>
                    {cmjResults.map((r:any,i:number)=>(
                      <div key={i} style={card}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                          <span style={{fontSize:13,color:C.textMuted}}>{r.test_date}</span>
                          <span style={{fontSize:16,fontWeight:700,color:C.purple}}>{r.estimated_velocity?.toFixed(1)} mph</span>
                        </div>
                        <div style={{display:'flex',gap:12,flexWrap:'wrap' as const}}>
                          <span style={{fontSize:12,color:C.gold}}>↑ {r.jump_height_in?.toFixed(1)} in</span>
                          <span style={{fontSize:12,color:C.teal}}>RSI {r.rsi_mod?.toFixed(2)}</span>
                          <span style={{fontSize:12,color:C.blue}}>{r.peak_power_per_kg?.toFixed(1)} W/kg</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {assessTab==='arm_care'&&profile&&(
              <ArmCareSummary pitcherId={profile.id}/>
            )}

            {assessTab==='benchmarks'&&profile&&(
              <AthleticBenchmarks pitcherId={profile.id}/>
            )}
          </div>
        )}

        {/* LOG TAB */}
        {tab==='log'&&(
          <div>
            <div style={{fontSize:18,fontWeight:700,color:C.white,marginBottom:16}}>Log Session</div>
            {profile?.rtt_phase&&(
              <div style={{background:`${RTT_PHASE_COLORS[profile.rtt_phase]}1A`,border:`1px solid ${RTT_PHASE_COLORS[profile.rtt_phase]}66`,borderRadius:8,padding:'10px 14px',marginBottom:14}}>
                <div style={{fontSize:10,color:RTT_PHASE_COLORS[profile.rtt_phase],fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:2}}>Return-to-Throw</div>
                <div style={{fontSize:14,fontWeight:600,color:C.white}}>{RTT_PHASE_LABELS[profile.rtt_phase]} Phase</div>
              </div>
            )}
            <div style={card}>
              <label style={lbl}>Date</label>
              <input type="date" style={inp} value={logForm.date} onChange={e=>setLogForm(f=>({...f,date:e.target.value}))}/>
              <label style={lbl}>Velocity (mph)</label>
              <input type="text" inputMode="numeric" pattern="[0-9]*" style={inp} placeholder="e.g. 91" value={logForm.velocity} onChange={e=>setLogForm(f=>({...f,velocity:e.target.value}))}/>
              <label style={lbl}>Weight Lifted (lbs)</label>
              <input type="text" inputMode="numeric" pattern="[0-9]*" style={inp} placeholder="e.g. 225" value={logForm.weightLifted} onChange={e=>setLogForm(f=>({...f,weightLifted:e.target.value}))}/>
              <label style={lbl}>Sprint Time (sec)</label>
              <input type="text" inputMode="numeric" pattern="[0-9]*" step="0.1" style={inp} placeholder="e.g. 6.8" value={logForm.sprintTime} onChange={e=>setLogForm(f=>({...f,sprintTime:e.target.value}))}/>
              <label style={lbl}>Pitch Count</label>
              <input type="text" inputMode="numeric" pattern="[0-9]*" style={inp} placeholder="e.g. 45" value={logForm.pitchCount} onChange={e=>setLogForm(f=>({...f,pitchCount:e.target.value}))}/>
              <label style={lbl}>High Effort Throws</label>
              <input type="text" inputMode="numeric" pattern="[0-9]*" style={inp} placeholder="e.g. 20" value={logForm.highEffortThrows} onChange={e=>setLogForm(f=>({...f,highEffortThrows:e.target.value}))}/>
              <label style={lbl}>Overall Feeling — <span style={{color:C.gold,fontSize:16,fontWeight:700}}>{logForm.feeling}/10</span></label>
              <input type="range" min="1" max="10" style={{width:'100%',accentColor:C.gold,marginBottom:4}} value={logForm.feeling} onChange={e=>setLogForm(f=>({...f,feeling:parseInt(e.target.value)}))}/>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:C.textDim,marginBottom:14}}><span>Poor</span><span>Great</span></div>
              <label style={lbl}>Arm Readiness <span style={{color:C.textDim,fontWeight:400}}>(optional)</span></label>
              <div style={{display:'flex',flexWrap:'wrap' as const,gap:8,marginBottom:14}}>
                {READINESS_OPTIONS.map(o=>(
                  <button key={o.value} onClick={()=>setReadiness(o.value)} style={{background:logForm.readiness===o.value?`${READINESS_COLORS[o.value]}26`:'transparent',color:logForm.readiness===o.value?READINESS_COLORS[o.value]:C.textMuted,border:`1px solid ${logForm.readiness===o.value?READINESS_COLORS[o.value]:C.border}`,borderRadius:20,padding:'6px 12px',fontSize:12,cursor:'pointer'}}>{o.label}</button>
                ))}
              </div>
              <label style={lbl}>Soreness</label>
              <div style={{display:'flex',flexWrap:'wrap' as const,gap:8,marginBottom:14}}>
                {SORENESS.map(a=>(
                  <button key={a} onClick={()=>toggleSoreness(a)} style={{background:logForm.soreness.includes(a)?'rgba(248,81,73,0.15)':'transparent',color:logForm.soreness.includes(a)?C.red:C.textMuted,border:`1px solid ${logForm.soreness.includes(a)?C.red:C.border}`,borderRadius:20,padding:'6px 12px',fontSize:12,cursor:'pointer'}}>{a}</button>
                ))}
              </div>
              <label style={lbl}>Notes</label>
              <textarea style={{...inp,minHeight:80,resize:'vertical' as const}} placeholder="How did the session feel?" value={logForm.notes} onChange={e=>setLogForm(f=>({...f,notes:e.target.value}))}/>
              <button style={btn('gold')} onClick={submitLog}>Save Entry</button>
              {logSaved&&<div style={{textAlign:'center',color:C.teal,fontSize:14,fontWeight:600,marginTop:8}}>✓ Saved!</div>}
            </div>
            {logs.length>0&&(
              <div>
                <div style={{fontSize:14,fontWeight:700,color:C.white,marginBottom:10}}>Recent Sessions</div>
                {logs.slice(0,10).map((log:any,i:number)=>(
                  <div key={i} style={card}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                      <span style={{fontSize:13,fontWeight:600,color:C.white}}>{log.log_date}</span>
                      <span style={{fontSize:12,fontWeight:700,color:log.feeling>=7?C.teal:log.feeling>=4?C.gold:C.red}}>{log.feeling}/10</span>
                    </div>
                    <div style={{display:'flex',gap:12,flexWrap:'wrap' as const}}>
                      {log.velocity&&<span style={{fontSize:12,color:C.gold}}>⚡ {log.velocity} mph</span>}
                      {log.weight_lifted&&<span style={{fontSize:12,color:C.teal}}>🏋 {log.weight_lifted} lbs</span>}
                      {log.sprint_time&&<span style={{fontSize:12,color:C.blue}}>🏃 {log.sprint_time}s</span>}
                      {log.readiness&&<span style={{fontSize:12,color:READINESS_COLORS[log.readiness]||C.textMuted}}>● {READINESS_OPTIONS.find(o=>o.value===log.readiness)?.label||log.readiness}</span>}
                      {log.soreness?.length>0&&<span style={{fontSize:12,color:C.red}}>🩺 {log.soreness.join(', ')}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MESSAGES TAB */}
        {tab==='messages'&&(
          <div>
            <div style={{fontSize:18,fontWeight:700,color:C.white,marginBottom:16}}>Messages</div>
            <div style={card}>
              <div style={{display:'flex',flexDirection:'column' as const,gap:10,minHeight:200,marginBottom:16}}>
                {messages.length===0&&<div style={{color:C.textDim,fontSize:13}}>No messages yet.</div>}
                {messages.map((m:any)=>(
                  <div key={m.id} style={{display:'flex',flexDirection:'column' as const,alignItems:m.sender_role==='pitcher'?'flex-end':'flex-start'}}>
                    <div style={{fontSize:10,color:C.textDim,marginBottom:3}}>{m.sender_role==='coach'?'Coach Salzman':'You'} · {new Date(m.created_at).toLocaleString()}</div>
                    <div style={{background:m.sender_role==='pitcher'?C.goldBg:C.bg3,color:m.sender_role==='pitcher'?C.gold:C.text,border:`1px solid ${m.sender_role==='pitcher'?C.goldDim:C.border}`,borderRadius:10,padding:'10px 14px',fontSize:14,maxWidth:'85%'}}>{m.content}</div>
                  </div>
                ))}
              </div>
              <div style={{display:'flex',gap:8}}>
                <input style={{...inp,flex:1,marginBottom:0}} placeholder="Message Coach Salzman..." value={msgText} onChange={e=>setMsgText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMessage()}/>
                <button onClick={sendMessage} style={{background:C.gold,color:C.bg,border:'none',borderRadius:8,padding:'0 16px',fontSize:14,fontWeight:700,cursor:'pointer',flexShrink:0}}>Send</button>
              </div>
            </div>
          </div>
        )}

        {/* NOTES TAB */}
        {tab==='notes'&&(
          <div>
            <div style={{fontSize:18,fontWeight:700,color:C.white,marginBottom:16}}>Coach Notes</div>
            {notes.length===0&&<div style={{...card,color:C.textMuted,textAlign:'center',padding:'32px 16px'}}>No notes yet.</div>}
            {notes.map((n:any)=>(
              <div key={n.id} style={card}>
                <div style={{fontSize:10,color:C.textMuted,marginBottom:8,textTransform:'uppercase' as const,letterSpacing:'0.5px',fontWeight:600}}>Coach Salzman · {new Date(n.created_at).toLocaleDateString()}</div>
                <div style={{fontSize:14,lineHeight:1.7,color:C.text}}>{n.content}</div>
              </div>
            ))}
          </div>
        )}
        {tab==='iq'&&<PitchingIQ/>}
        {tab==='situations'&&<CountLeverageTable/>}

      </div>
    </div>
  )
}
