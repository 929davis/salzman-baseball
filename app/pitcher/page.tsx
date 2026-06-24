'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const C = {
  bg:'#0d1117',bg2:'#161b22',bg3:'#1c2333',border:'#30363d',
  gold:'#e8b84b',goldDim:'#a07c28',goldBg:'rgba(232,184,75,0.08)',
  teal:'#39d353',red:'#f85149',blue:'#58a6ff',purple:'#a371f7',
  text:'#e6edf3',textMuted:'#7d8590',textDim:'#484f58',white:'#ffffff',
}

const SORENESS = ['Shoulder','Elbow','Forearm','Wrist','Back','Hip','Knee','Hamstring','Quad','Other']
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const NEW_CATS = ['Pre-Throwing','Throwing','Post-Throwing','Main Exercises','Accessory','Conditioning','Recovery']
const CAT_COLORS:Record<string,string> = {
  'Pre-Throwing':'#38bdf8','Throwing':'#39d353','Post-Throwing':'#34d399',
  'Main Exercises':'#e8b84b','Accessory':'#a371f7','Conditioning':'#58a6ff','Recovery':'#f97316',
}

// CMJ thresholds
const CMJ_THRESHOLDS = {
  jumpHeight:{ aboveAverage:21, good:18, developing:15 },
  ppKg:{ aboveAverage:70, good:62, developing:55 },
  rsi:{ aboveAverage:0.86, good:0.64, developing:0.45 },
}

function getTier(val:number, thresholds:{aboveAverage:number,good:number,developing:number}){
  if (!val) return 'No Data'
  if (val >= thresholds.aboveAverage) return 'Above Average'
  if (val >= thresholds.good) return 'Good'
  if (val >= thresholds.developing) return 'Developing'
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

const calcJumpHeight=(takeoff:number,landing:number,fps:number)=>{
  const ft=(landing-takeoff)/fps
  return (9.81*ft*ft)/8*39.3701
}

const calcCMJ=({startFrame,takeoffFrame,landingFrame,fps,massKg}:{startFrame:number,takeoffFrame:number,landingFrame:number,fps:number,massKg:number})=>{
  const ft=(landingFrame-takeoffFrame)/fps
  const ttt=(takeoffFrame-startFrame)/fps
  const jh=(9.81*ft*ft)/8
  const jhc=jh*100
  const jhi=jh*39.3701
  const rsi=jh/ttt
  const pp=(60.7*jhc)+(45.3*massKg)-2055
  const ppkg=pp/massKg
  const tv=Math.sqrt(2*9.81*jh)
  const ei=rsi*ppkg
  const ev=47+(0.70*ppkg)+(10*rsi)+(0.02*ei)
  return{flightTime:ft,jumpHeightIn:jhi,rsiMod:rsi,peakPowerPerKg:ppkg,takeoffVelocity:tv,explosiveIndex:ei,estimatedVelocity:ev}
}

const TEST_VIDEOS:Record<string,string> = {
  cmj:'https://www.youtube.com/watch?v=example_cmj',
  squat_jump:'https://www.youtube.com/watch?v=example_sj',
  single_leg_cmj:'https://www.youtube.com/watch?v=example_slcmj',
  triple_hop:'https://www.youtube.com/watch?v=example_hop',
  plyo_pushup:'https://www.youtube.com/watch?v=example_plyo',
}

export default function PitcherDashboard(){
  const [profile,setProfile]=useState<any>(null)
  const [tab,setTab]=useState('program')
  const [program,setProgram]=useState<any>(null)
  const [logs,setLogs]=useState<any[]>([])
  const [messages,setMessages]=useState<any[]>([])
  const [notes,setNotes]=useState<any[]>([])
  const [cmjResults,setCmjResults]=useState<any[]>([])
  const [sqJumpResults,setSqJumpResults]=useState<any[]>([])
  const [slCmjResults,setSlCmjResults]=useState<any[]>([])
  const [tripleHopResults,setTripleHopResults]=useState<any[]>([])
  const [plyoPushupResults,setPlyoPushupResults]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [msgText,setMsgText]=useState('')
  const [logForm,setLogForm]=useState({date:new Date().toISOString().split('T')[0],velocity:'',weightLifted:'',sprintTime:'',pitchCount:'',highEffortThrows:'',feeling:7,soreness:[] as string[],notes:''})
  const [logSaved,setLogSaved]=useState(false)

  // CMJ form
  const [cmjForm,setCmjForm]=useState({date:new Date().toISOString().split('T')[0],bodyweight:'',weightUnit:'lbs',fps:'240',startFrame:'',takeoffFrame:'',landingFrame:'',notes:''})
  const [cmjResult,setCmjResult]=useState<any>(null)
  const [cmjErr,setCmjErr]=useState('')

  // Squat Jump form
  const [sjForm,setSjForm]=useState({date:new Date().toISOString().split('T')[0],bodyweight:'',weightUnit:'lbs',fps:'240',startFrame:'',takeoffFrame:'',landingFrame:'',notes:''})
  const [sjResult,setSjResult]=useState<any>(null)
  const [sjErr,setSjErr]=useState('')

  // Single Leg CMJ form
  const [slForm,setSlForm]=useState({date:new Date().toISOString().split('T')[0],bodyweight:'',weightUnit:'lbs',fps:'240',leftTakeoff:'',leftLanding:'',rightTakeoff:'',rightLanding:'',notes:''})
  const [slResult,setSlResult]=useState<any>(null)
  const [slErr,setSlErr]=useState('')

  // Triple Hop form
  const [hopForm,setHopForm]=useState({date:new Date().toISOString().split('T')[0],leftDistance:'',rightDistance:'',notes:''})
  const [hopResult,setHopResult]=useState<any>(null)

  // Plyo Pushup form
  const [plyoForm,setPlyoForm]=useState({date:new Date().toISOString().split('T')[0],fps:'240',takeoffFrame:'',landingFrame:'',notes:''})
  const [plyoResult,setPlyoResult]=useState<any>(null)
  const [plyoErr,setPlyoErr]=useState('')

  // Active assessment sub-tab
  const [assessTab,setAssessTab]=useState('cmj')

  const router=useRouter()
  const supabase=createClient()

  useEffect(()=>{
    const init=async()=>{
      const {data:{user}}=await supabase.auth.getUser()
      if (!user){router.push('/auth/login');return}
      const {data:prof}=await supabase.from('profiles').select('*').eq('id',user.id).single()
      if (!prof||prof.role==='coach'){router.push('/coach');return}
      setProfile(prof)
      const [progRes,logsRes,msgsRes,notesRes,cmjRes,sjRes,slRes,hopRes,plyoRes]=await Promise.all([
        supabase.from('programs').select('*').eq('pitcher_id',prof.id).order('week_of',{ascending:false}).limit(1),
        supabase.from('session_logs').select('*').eq('pitcher_id',prof.id).order('log_date',{ascending:false}).limit(20),
        supabase.from('messages').select('*').eq('pitcher_id',prof.id).order('created_at'),
        supabase.from('coach_notes').select('*').eq('pitcher_id',prof.id).order('created_at',{ascending:false}),
        supabase.from('cmj_results').select('*').eq('pitcher_id',prof.id).order('test_date',{ascending:false}),
        supabase.from('squat_jump_results').select('*').eq('pitcher_id',prof.id).order('test_date',{ascending:false}),
        supabase.from('single_leg_cmj_results').select('*').eq('pitcher_id',prof.id).order('test_date',{ascending:false}),
        supabase.from('triple_hop_results').select('*').eq('pitcher_id',prof.id).order('test_date',{ascending:false}),
        supabase.from('plyo_pushup_results').select('*').eq('pitcher_id',prof.id).order('test_date',{ascending:false}),
      ])
      setProgram(progRes.data?.[0]||null)
      setLogs(logsRes.data||[])
      setMessages(msgsRes.data||[])
      setNotes(notesRes.data||[])
      setCmjResults(cmjRes.data||[])
      setSqJumpResults(sjRes.data||[])
      setSlCmjResults(slRes.data||[])
      setTripleHopResults(hopRes.data||[])
      setPlyoPushupResults(plyoRes.data||[])
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
      soreness:logForm.soreness,notes:logForm.notes||null
    })
    const {data}=await supabase.from('session_logs').select('*').eq('pitcher_id',profile.id).order('log_date',{ascending:false}).limit(20)
    setLogs(data||[])
    setLogForm({date:new Date().toISOString().split('T')[0],velocity:'',weightLifted:'',sprintTime:'',pitchCount:'',highEffortThrows:'',feeling:7,soreness:[],notes:''})
    setLogSaved(true);setTimeout(()=>setLogSaved(false),2000)
  }

  const sendMessage=async()=>{
    if (!msgText.trim()||!profile)return
    const {data}=await supabase.from('messages').insert({pitcher_id:profile.id,sender_id:profile.id,sender_role:'pitcher',content:msgText.trim()}).select().single()
    if (data){setMessages([...messages,data]);setMsgText('')}
  }

  const toggleSoreness=(a:string)=>setLogForm(f=>({...f,soreness:f.soreness.includes(a)?f.soreness.filter(x=>x!==a):[...f.soreness,a]}))

  // CMJ calc
  const calcCMJHandler=()=>{
    setCmjErr('')
    const bw=parseFloat(cmjForm.bodyweight),fps=parseFloat(cmjForm.fps)
    const sf=parseFloat(cmjForm.startFrame),tf=parseFloat(cmjForm.takeoffFrame),lf=parseFloat(cmjForm.landingFrame)
    if (!bw||isNaN(sf)||isNaN(tf)||isNaN(lf)||tf<=sf||lf<=tf){setCmjErr('Check your inputs.');return}
    const massKg=cmjForm.weightUnit==='lbs'?bw*0.453592:bw
    setCmjResult(calcCMJ({startFrame:sf,takeoffFrame:tf,landingFrame:lf,fps,massKg}))
  }

  const saveCMJ=async()=>{
    if (!cmjResult||!profile)return
    const bw=parseFloat(cmjForm.bodyweight)
    const massKg=cmjForm.weightUnit==='lbs'?bw*0.453592:bw
    await supabase.from('cmj_results').insert({
      pitcher_id:profile.id,test_date:cmjForm.date,bodyweight:bw,weight_unit:cmjForm.weightUnit,
      fps:parseInt(cmjForm.fps),start_frame:parseInt(cmjForm.startFrame),
      takeoff_frame:parseInt(cmjForm.takeoffFrame),landing_frame:parseInt(cmjForm.landingFrame),
      flight_time:cmjResult.flightTime,jump_height_in:cmjResult.jumpHeightIn,rsi_mod:cmjResult.rsiMod,
      peak_power_per_kg:cmjResult.peakPowerPerKg,takeoff_velocity:cmjResult.takeoffVelocity,
      explosive_index:cmjResult.explosiveIndex,estimated_velocity:cmjResult.estimatedVelocity,
      notes:cmjForm.notes||null
    })
    const {data}=await supabase.from('cmj_results').select('*').eq('pitcher_id',profile.id).order('test_date',{ascending:false})
    setCmjResults(data||[])
    setCmjResult(null)
    setCmjForm({date:new Date().toISOString().split('T')[0],bodyweight:'',weightUnit:'lbs',fps:'240',startFrame:'',takeoffFrame:'',landingFrame:'',notes:''})
  }

  // Squat Jump calc
  const calcSJHandler=()=>{
    setSjErr('')
    const bw=parseFloat(sjForm.bodyweight),fps=parseFloat(sjForm.fps)
    const sf=parseFloat(sjForm.startFrame),tf=parseFloat(sjForm.takeoffFrame),lf=parseFloat(sjForm.landingFrame)
    if (!bw||isNaN(sf)||isNaN(tf)||isNaN(lf)||tf<=sf||lf<=tf){setSjErr('Check your inputs.');return}
    const massKg=sjForm.weightUnit==='lbs'?bw*0.453592:bw
    setSjResult(calcCMJ({startFrame:sf,takeoffFrame:tf,landingFrame:lf,fps,massKg}))
  }

  const saveSJ=async()=>{
    if (!sjResult||!profile)return
    const bw=parseFloat(sjForm.bodyweight)
    const massKg=sjForm.weightUnit==='lbs'?bw*0.453592:bw
    await supabase.from('squat_jump_results').insert({
      pitcher_id:profile.id,test_date:sjForm.date,bodyweight:bw,weight_unit:sjForm.weightUnit,
      fps:parseInt(sjForm.fps),start_frame:parseInt(sjForm.startFrame),
      takeoff_frame:parseInt(sjForm.takeoffFrame),landing_frame:parseInt(sjForm.landingFrame),
      flight_time:sjResult.flightTime,jump_height_in:sjResult.jumpHeightIn,
      peak_power_per_kg:sjResult.peakPowerPerKg,notes:sjForm.notes||null
    })
    const {data}=await supabase.from('squat_jump_results').select('*').eq('pitcher_id',profile.id).order('test_date',{ascending:false})
    setSqJumpResults(data||[])
    setSjResult(null)
    setSjForm({date:new Date().toISOString().split('T')[0],bodyweight:'',weightUnit:'lbs',fps:'240',startFrame:'',takeoffFrame:'',landingFrame:'',notes:''})
  }

  // Single Leg CMJ calc
  const calcSLHandler=()=>{
    setSlErr('')
    const fps=parseFloat(slForm.fps)
    const lt=parseFloat(slForm.leftTakeoff),ll=parseFloat(slForm.leftLanding)
    const rt=parseFloat(slForm.rightTakeoff),rl=parseFloat(slForm.rightLanding)
    if (isNaN(lt)||isNaN(ll)||isNaN(rt)||isNaN(rl)||ll<=lt||rl<=rt){setSlErr('Check your inputs.');return}
    const leftJH=calcJumpHeight(lt,ll,fps)
    const rightJH=calcJumpHeight(rt,rl,fps)
    const lsi=(Math.min(leftJH,rightJH)/Math.max(leftJH,rightJH))*100
    setSlResult({leftJH,rightJH,lsi,leftFT:(ll-lt)/fps,rightFT:(rl-rt)/fps})
  }

  const saveSL=async()=>{
    if (!slResult||!profile)return
    const fps=parseFloat(slForm.fps)
    await supabase.from('single_leg_cmj_results').insert({
      pitcher_id:profile.id,test_date:slForm.date,
      bodyweight:parseFloat(slForm.bodyweight)||null,weight_unit:slForm.weightUnit,fps:parseInt(slForm.fps),
      left_takeoff_frame:parseInt(slForm.leftTakeoff),left_landing_frame:parseInt(slForm.leftLanding),
      left_flight_time:slResult.leftFT,left_jump_height_in:slResult.leftJH,
      right_takeoff_frame:parseInt(slForm.rightTakeoff),right_landing_frame:parseInt(slForm.rightLanding),
      right_flight_time:slResult.rightFT,right_jump_height_in:slResult.rightJH,
      lsi:slResult.lsi,notes:slForm.notes||null
    })
    const {data}=await supabase.from('single_leg_cmj_results').select('*').eq('pitcher_id',profile.id).order('test_date',{ascending:false})
    setSlCmjResults(data||[])
    setSlResult(null)
    setSlForm({date:new Date().toISOString().split('T')[0],bodyweight:'',weightUnit:'lbs',fps:'240',leftTakeoff:'',leftLanding:'',rightTakeoff:'',rightLanding:'',notes:''})
  }

  // Triple Hop calc
  const calcHopHandler=()=>{
    const l=parseFloat(hopForm.leftDistance),r=parseFloat(hopForm.rightDistance)
    if (!l||!r)return
    const lsi=(Math.min(l,r)/Math.max(l,r))*100
    setHopResult({leftDistance:l,rightDistance:r,lsi})
  }

  const saveHop=async()=>{
    if (!hopResult||!profile)return
    await supabase.from('triple_hop_results').insert({
      pitcher_id:profile.id,test_date:hopForm.date,
      left_distance_in:hopResult.leftDistance,right_distance_in:hopResult.rightDistance,
      lsi:hopResult.lsi,notes:hopForm.notes||null
    })
    const {data}=await supabase.from('triple_hop_results').select('*').eq('pitcher_id',profile.id).order('test_date',{ascending:false})
    setTripleHopResults(data||[])
    setHopResult(null)
    setHopForm({date:new Date().toISOString().split('T')[0],leftDistance:'',rightDistance:'',notes:''})
  }

  // Plyo Pushup calc
  const calcPlyoHandler=()=>{
    setPlyoErr('')
    const fps=parseFloat(plyoForm.fps)
    const tf=parseFloat(plyoForm.takeoffFrame),lf=parseFloat(plyoForm.landingFrame)
    if (isNaN(tf)||isNaN(lf)||lf<=tf){setPlyoErr('Check your inputs.');return}
    const ft=(lf-tf)/fps
    const jh=(9.81*ft*ft)/8*39.3701
    setPlyoResult({flightTime:ft,jumpHeightIn:jh})
  }

  const savePlyo=async()=>{
    if (!plyoResult||!profile)return
    await supabase.from('plyo_pushup_results').insert({
      pitcher_id:profile.id,test_date:plyoForm.date,fps:parseInt(plyoForm.fps),
      takeoff_frame:parseInt(plyoForm.takeoffFrame),landing_frame:parseInt(plyoForm.landingFrame),
      flight_time:plyoResult.flightTime,jump_height_in:plyoResult.jumpHeightIn,
      notes:plyoForm.notes||null
    })
    const {data}=await supabase.from('plyo_pushup_results').select('*').eq('pitcher_id',profile.id).order('test_date',{ascending:false})
    setPlyoPushupResults(data||[])
    setPlyoResult(null)
    setPlyoForm({date:new Date().toISOString().split('T')[0],fps:'240',takeoffFrame:'',landingFrame:'',notes:''})
  }

  // EUR calculation
  const latestCMJ=cmjResults[0]
  const latestSJ=sqJumpResults[0]
  const eur=latestCMJ&&latestSJ?latestCMJ.jump_height_in/latestSJ.jump_height_in:null
  const {classification,jumpTier,ppTier,rsiTier}=classifyCMJ(latestCMJ)
  const classCol=CLASS_COLORS[classification]||CLASS_COLORS['No Data']

  const cmjTier=(v:number)=>v>=95?{l:'Elite / Pro',c:C.teal}:v>=90?{l:'High D1 / Pro Fringe',c:C.gold}:v>=85?{l:'D1 Range',c:C.blue}:v>=80?{l:'D2/D3 Range',c:C.textMuted}:{l:'Development',c:C.red}

  const unread=messages.filter((m:any)=>m.sender_role==='coach'&&!m.read).length

  if (loading)return <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',color:C.textMuted,fontFamily:'system-ui'}}>Loading...</div>

  const inp={width:'100%',background:C.bg3,border:`1px solid ${C.border}`,borderRadius:8,padding:'12px 14px',fontSize:15,color:C.text,boxSizing:'border-box' as const,outline:'none',marginBottom:4}
  const lbl={fontSize:11,color:C.textMuted,fontWeight:600 as const,marginBottom:6,display:'block',textTransform:'uppercase' as const,letterSpacing:'0.5px',marginTop:14 as const}
  const card={background:C.bg2,border:`1px solid ${C.border}`,borderRadius:12,padding:'16px',marginBottom:12}
  const btn=(v='primary')=>({background:v==='gold'?C.gold:C.bg3,color:v==='gold'?C.bg:C.text,border:`1px solid ${v==='gold'?C.gold:C.border}`,borderRadius:8,padding:'12px 20px',fontSize:14,fontWeight:v==='gold'?700:500 as const,cursor:'pointer',width:'100%',marginTop:8})

  const TierBadge=({tier}:{tier:string})=>{
    const col=TIER_COLORS[tier]||TIER_COLORS['No Data']
    return <span style={{background:col.bg,border:`1px solid ${col.border}`,color:col.text,fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:4,textTransform:'uppercase' as const,letterSpacing:'0.5px'}}>{tier}</span>
  }

  const LSIBadge=({lsi}:{lsi:number})=>{
    const ok=lsi>=90
    return <span style={{background:ok?'rgba(57,211,83,0.12)':'rgba(248,81,73,0.12)',border:`1px solid ${ok?'rgba(57,211,83,0.4)':'rgba(248,81,73,0.4)'}`,color:ok?C.teal:C.red,fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:4}}>{lsi.toFixed(1)}% LSI {ok?'✓':'⚠'}</span>
  }

  const FrameInputs=({form,setForm,fields}:{form:any,setForm:any,fields:{key:string,label:string,placeholder:string}[]})=>(
    <div>
      {fields.map(f=>(
        <div key={f.key}>
          <label style={lbl}>{f.label}</label>
          <input type="number" style={inp} placeholder={f.placeholder} value={form[f.key]} onChange={e=>setForm((prev:any)=>({...prev,[f.key]:e.target.value}))}/>
        </div>
      ))}
    </div>
  )

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
        <button onClick={signOut} style={{background:'transparent',border:'none',color:C.textMuted,fontSize:12,cursor:'pointer'}}>Sign Out</button>
      </div>

      {/* Tab Bar */}
      <div style={{display:'flex',background:C.bg2,borderBottom:`1px solid ${C.border}`,padding:'0 4px',overflowX:'auto' as const}}>
        {[
          {id:'program',icon:'📋',label:'Program'},
          {id:'assess',icon:'🧪',label:'Assess'},
          {id:'log',icon:'📝',label:'Log'},
          {id:'messages',icon:'💬',label:unread>0?`Chat (${unread})`:'Chat'},
          {id:'notes',icon:'📌',label:'Notes'},
        ].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,background:'transparent',border:'none',borderBottom:`2px solid ${tab===t.id?C.gold:'transparent'}`,padding:'10px 4px',cursor:'pointer',color:tab===t.id?C.gold:C.textMuted,fontSize:10,fontWeight:tab===t.id?700:400,textTransform:'uppercase' as const,letterSpacing:'0.3px',whiteSpace:'nowrap' as const}}>
            <div style={{fontSize:16,marginBottom:2}}>{t.icon}</div>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{padding:'16px'}}>

        {/* PROGRAM TAB */}
        {tab==='program'&&(
          <div>
            <div style={{fontSize:18,fontWeight:700,color:C.white,marginBottom:4}}>My Program</div>
            <div style={{fontSize:12,color:C.textMuted,marginBottom:16}}>Week of {program?.week_of||'—'}</div>

            {/* Neuro classification for pitcher */}
            {latestCMJ&&(
              <div style={{...card,background:classCol.bg,border:`1px solid ${classCol.border}`,marginBottom:16}}>
                <div style={{fontSize:10,color:classCol.text,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'1px',marginBottom:4}}>Your Training Profile</div>
                <div style={{fontSize:16,fontWeight:700,color:classCol.text,marginBottom:6}}>{classification}</div>
                <div style={{fontSize:12,color:C.textMuted,lineHeight:1.6}}>{classCol.desc}</div>
                {eur&&(
                  <div style={{marginTop:10,padding:'8px 10px',background:'rgba(0,0,0,0.2)',borderRadius:6}}>
                    <span style={{fontSize:11,color:C.textMuted}}>Eccentric Utilization Ratio: </span>
                    <span style={{fontSize:13,fontWeight:700,color:eur>=1.15?C.teal:eur>=1.05?C.gold:C.red}}>{eur.toFixed(2)}</span>
                    <span style={{fontSize:10,color:C.textDim,marginLeft:6}}>{eur>=1.15?'Good stretch-shortening cycle use':eur>=1.05?'Moderate':'Low — focus on reactive work'}</span>
                  </div>
                )}
              </div>
            )}

            {!program&&<div style={{...card,textAlign:'center',color:C.textMuted,padding:'32px 16px'}}>No program yet. Check back after your coach uploads your week.</div>}
            {program&&(()=>{
              const structured=program.structured_days||{}
              const hasStructured=Object.keys(structured).length>0

              if (hasStructured){
                return DAYS.map(day=>{
                  const dayCats=NEW_CATS.filter(cat=>{
                    const key=`${day}___${cat}`
                    return (structured[key]||[]).length>0||(program.days?.[`${day}___${cat}`])
                  })
                  if (dayCats.length===0) return(
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
                              </div>
                            ))}
                            {note&&<div style={{fontSize:12,color:C.textMuted,fontStyle:'italic',padding:'6px 10px',background:C.bg3,borderRadius:6}}>{note}</div>}
                          </div>
                        )
                      })}
                    </div>
                  )
                })
              }
              return null
            })()}
          </div>
        )}

        {/* ASSESS TAB */}
        {tab==='assess'&&(
          <div>
            <div style={{fontSize:18,fontWeight:700,color:C.white,marginBottom:4}}>Assessments</div>
            <div style={{fontSize:12,color:C.textMuted,marginBottom:16}}>Film at 240 FPS · Open in Photos · Edit · Scrub to find frames</div>

            {/* Assessment sub-tabs */}
            <div style={{display:'flex',gap:6,marginBottom:16,overflowX:'auto' as const,paddingBottom:4}}>
              {[
                {id:'cmj',label:'CMJ'},
                {id:'squat_jump',label:'Squat Jump'},
                {id:'single_leg',label:'Single Leg'},
                {id:'triple_hop',label:'Triple Hop'},
                {id:'plyo_pushup',label:'Plyo Push Up'},
              ].map(t=>(
                <button key={t.id} onClick={()=>setAssessTab(t.id)} style={{background:assessTab===t.id?C.gold:C.bg3,color:assessTab===t.id?C.bg:C.textMuted,border:`1px solid ${assessTab===t.id?C.gold:C.border}`,borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:assessTab===t.id?700:400,cursor:'pointer',whiteSpace:'nowrap' as const,flexShrink:0}}>{t.label}</button>
              ))}
            </div>

            {/* CMJ */}
            {assessTab==='cmj'&&(
              <div>
                <div style={{...card,background:'rgba(88,166,255,0.05)',border:'1px solid rgba(88,166,255,0.2)',marginBottom:12}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.blue,marginBottom:4}}>What is a CMJ?</div>
                  <div style={{fontSize:12,color:C.textMuted,lineHeight:1.6}}>A Countermovement Jump measures your explosive power and neuromuscular capacity. You squat down then jump as high as possible. Film at 240fps and record the frame numbers below.</div>
                </div>
                <div style={card}>
                  <label style={lbl}>Date</label>
                  <input type="date" style={inp} value={cmjForm.date} onChange={e=>setCmjForm(f=>({...f,date:e.target.value}))}/>
                  <label style={lbl}>Body Weight</label>
                  <div style={{display:'flex',gap:8}}>
                    <input type="number" style={{...inp,flex:1}} placeholder="e.g. 195" value={cmjForm.bodyweight} onChange={e=>setCmjForm(f=>({...f,bodyweight:e.target.value}))}/>
                    <select style={{...inp,width:80}} value={cmjForm.weightUnit} onChange={e=>setCmjForm(f=>({...f,weightUnit:e.target.value}))}><option value="lbs">lbs</option><option value="kg">kg</option></select>
                  </div>
                  <label style={lbl}>FPS</label>
                  <select style={inp} value={cmjForm.fps} onChange={e=>setCmjForm(f=>({...f,fps:e.target.value}))}><option value="240">240 FPS (iPhone)</option><option value="120">120 FPS</option><option value="480">480 FPS</option></select>
                  <FrameInputs form={cmjForm} setForm={setCmjForm} fields={[{key:'startFrame',label:'Start Frame',placeholder:'Frame when you start descending'},{key:'takeoffFrame',label:'Takeoff Frame',placeholder:'Frame when feet leave ground'},{key:'landingFrame',label:'Landing Frame',placeholder:'Frame when feet hit ground'}]}/>
                  {cmjErr&&<div style={{color:C.red,fontSize:13,marginTop:8,padding:'10px',background:'rgba(248,81,73,0.1)',borderRadius:8}}>{cmjErr}</div>}
                  <button style={btn('gold')} onClick={calcCMJHandler}>Calculate</button>
                </div>

                {cmjResult&&(
                  <div style={{...card,border:'1px solid rgba(163,113,247,0.4)',background:'rgba(163,113,247,0.06)',textAlign:'center'}}>
                    <div style={{fontSize:11,color:C.purple,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'1px',marginBottom:8}}>Estimated Velocity Capacity</div>
                    <div style={{fontSize:56,fontWeight:700,color:C.white,letterSpacing:'-2px',marginBottom:8}}>{cmjResult.estimatedVelocity.toFixed(1)}<span style={{fontSize:18,color:C.textMuted,fontWeight:400}}> MPH</span></div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                      {[{l:'Jump Height',v:`${cmjResult.jumpHeightIn.toFixed(1)} in`},{l:'RSI-Mod',v:`${cmjResult.rsiMod.toFixed(2)}`},{l:'Peak Power/kg',v:`${cmjResult.peakPowerPerKg.toFixed(1)} W/kg`},{l:'Flight Time',v:`${cmjResult.flightTime.toFixed(3)}s`}].map(m=>(
                        <div key={m.l} style={{background:'rgba(163,113,247,0.08)',borderRadius:8,padding:'10px'}}>
                          <div style={{fontSize:10,color:C.purple,marginBottom:3}}>{m.l}</div>
                          <div style={{fontSize:16,fontWeight:700,color:C.white}}>{m.v}</div>
                        </div>
                      ))}
                    </div>
                    <button style={{...btn('gold'),marginTop:0}} onClick={saveCMJ}>Save to Profile</button>
                  </div>
                )}

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

            {/* Squat Jump */}
            {assessTab==='squat_jump'&&(
              <div>
                <div style={{...card,background:'rgba(88,166,255,0.05)',border:'1px solid rgba(88,166,255,0.2)',marginBottom:12}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.blue,marginBottom:4}}>What is a Squat Jump?</div>
                  <div style={{fontSize:12,color:C.textMuted,lineHeight:1.6}}>Start from a squat position with no countermovement. Hold the bottom position for 2 seconds then jump. Combined with your CMJ this calculates your Eccentric Utilization Ratio (EUR) — how well you use the stretch-shortening cycle.</div>
                </div>
                <div style={card}>
                  <label style={lbl}>Date</label>
                  <input type="date" style={inp} value={sjForm.date} onChange={e=>setSjForm(f=>({...f,date:e.target.value}))}/>
                  <label style={lbl}>Body Weight</label>
                  <div style={{display:'flex',gap:8}}>
                    <input type="number" style={{...inp,flex:1}} placeholder="e.g. 195" value={sjForm.bodyweight} onChange={e=>setSjForm(f=>({...f,bodyweight:e.target.value}))}/>
                    <select style={{...inp,width:80}} value={sjForm.weightUnit} onChange={e=>setSjForm(f=>({...f,weightUnit:e.target.value}))}><option value="lbs">lbs</option><option value="kg">kg</option></select>
                  </div>
                  <label style={lbl}>FPS</label>
                  <select style={inp} value={sjForm.fps} onChange={e=>setSjForm(f=>({...f,fps:e.target.value}))}><option value="240">240 FPS</option><option value="120">120 FPS</option></select>
                  <FrameInputs form={sjForm} setForm={setSjForm} fields={[{key:'startFrame',label:'Start Frame',placeholder:'Frame at bottom of squat hold'},{key:'takeoffFrame',label:'Takeoff Frame',placeholder:'Frame when feet leave ground'},{key:'landingFrame',label:'Landing Frame',placeholder:'Frame when feet hit ground'}]}/>
                  {sjErr&&<div style={{color:C.red,fontSize:13,marginTop:8,padding:'10px',background:'rgba(248,81,73,0.1)',borderRadius:8}}>{sjErr}</div>}
                  <button style={btn('gold')} onClick={calcSJHandler}>Calculate</button>
                </div>

                {sjResult&&(
                  <div style={{...card,border:'1px solid rgba(232,184,75,0.4)',background:'rgba(232,184,75,0.06)',textAlign:'center'}}>
                    <div style={{fontSize:11,color:C.gold,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'1px',marginBottom:8}}>Squat Jump Result</div>
                    <div style={{fontSize:48,fontWeight:700,color:C.white,marginBottom:8}}>{sjResult.jumpHeightIn.toFixed(1)}<span style={{fontSize:18,color:C.textMuted}}> in</span></div>
                    {latestCMJ&&(
                      <div style={{marginBottom:12,padding:'10px',background:'rgba(0,0,0,0.2)',borderRadius:8}}>
                        <div style={{fontSize:11,color:C.textMuted,marginBottom:4}}>Eccentric Utilization Ratio</div>
                        <div style={{fontSize:24,fontWeight:700,color:latestCMJ.jump_height_in/sjResult.jumpHeightIn>=1.15?C.teal:latestCMJ.jump_height_in/sjResult.jumpHeightIn>=1.05?C.gold:C.red}}>
                          {(latestCMJ.jump_height_in/sjResult.jumpHeightIn).toFixed(2)}
                        </div>
                        <div style={{fontSize:11,color:C.textMuted,marginTop:4}}>CMJ {latestCMJ.jump_height_in?.toFixed(1)}in ÷ SJ {sjResult.jumpHeightIn.toFixed(1)}in</div>
                      </div>
                    )}
                    <button style={{...btn('gold'),marginTop:0}} onClick={saveSJ}>Save to Profile</button>
                  </div>
                )}

                {sqJumpResults.length>0&&(
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:C.white,marginBottom:10}}>Squat Jump History</div>
                    {sqJumpResults.map((r:any,i:number)=>(
                      <div key={i} style={card}>
                        <div style={{display:'flex',justifyContent:'space-between'}}>
                          <span style={{fontSize:13,color:C.textMuted}}>{r.test_date}</span>
                          <span style={{fontSize:16,fontWeight:700,color:C.gold}}>{r.jump_height_in?.toFixed(1)} in</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Single Leg CMJ */}
            {assessTab==='single_leg'&&(
              <div>
                <div style={{...card,background:'rgba(88,166,255,0.05)',border:'1px solid rgba(88,166,255,0.2)',marginBottom:12}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.blue,marginBottom:4}}>Single Leg CMJ</div>
                  <div style={{fontSize:12,color:C.textMuted,lineHeight:1.6}}>Jump on each leg separately. Film each leg at 240fps. This calculates your Limb Symmetry Index (LSI) — ideally 90% or above between legs. Below 90% indicates an asymmetry to address.</div>
                </div>
                <div style={card}>
                  <label style={lbl}>Date</label>
                  <input type="date" style={inp} value={slForm.date} onChange={e=>setSlForm(f=>({...f,date:e.target.value}))}/>
                  <label style={lbl}>FPS</label>
                  <select style={inp} value={slForm.fps} onChange={e=>setSlForm(f=>({...f,fps:e.target.value}))}><option value="240">240 FPS</option><option value="120">120 FPS</option></select>
                  <div style={{fontSize:11,color:C.teal,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginTop:14,marginBottom:8}}>Left Leg</div>
                  <FrameInputs form={slForm} setForm={setSlForm} fields={[{key:'leftTakeoff',label:'Left Takeoff Frame',placeholder:'Frame when left foot leaves ground'},{key:'leftLanding',label:'Left Landing Frame',placeholder:'Frame when left foot hits ground'}]}/>
                  <div style={{fontSize:11,color:C.red,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginTop:14,marginBottom:8}}>Right Leg</div>
                  <FrameInputs form={slForm} setForm={setSlForm} fields={[{key:'rightTakeoff',label:'Right Takeoff Frame',placeholder:'Frame when right foot leaves ground'},{key:'rightLanding',label:'Right Landing Frame',placeholder:'Frame when right foot hits ground'}]}/>
                  {slErr&&<div style={{color:C.red,fontSize:13,marginTop:8,padding:'10px',background:'rgba(248,81,73,0.1)',borderRadius:8}}>{slErr}</div>}
                  <button style={btn('gold')} onClick={calcSLHandler}>Calculate</button>
                </div>

                {slResult&&(
                  <div style={{...card,border:'1px solid rgba(57,211,83,0.4)',background:'rgba(57,211,83,0.06)'}}>
                    <div style={{fontSize:11,color:C.teal,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'1px',marginBottom:12}}>Single Leg CMJ Result</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                      <div style={{textAlign:'center',padding:'12px',background:'rgba(0,0,0,0.2)',borderRadius:8}}>
                        <div style={{fontSize:10,color:C.teal,marginBottom:4}}>Left Leg</div>
                        <div style={{fontSize:24,fontWeight:700,color:C.white}}>{slResult.leftJH.toFixed(1)}<span style={{fontSize:12,color:C.textMuted}}> in</span></div>
                      </div>
                      <div style={{textAlign:'center',padding:'12px',background:'rgba(0,0,0,0.2)',borderRadius:8}}>
                        <div style={{fontSize:10,color:C.red,marginBottom:4}}>Right Leg</div>
                        <div style={{fontSize:24,fontWeight:700,color:C.white}}>{slResult.rightJH.toFixed(1)}<span style={{fontSize:12,color:C.textMuted}}> in</span></div>
                      </div>
                    </div>
                    <div style={{textAlign:'center',marginBottom:12}}><LSIBadge lsi={slResult.lsi}/></div>
                    {slResult.lsi<90&&<div style={{fontSize:12,color:C.red,textAlign:'center',marginBottom:12}}>Asymmetry detected — discuss with Coach Salzman</div>}
                    <button style={{...btn('gold'),marginTop:0}} onClick={saveSL}>Save to Profile</button>
                  </div>
                )}

                {slCmjResults.length>0&&(
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:C.white,marginBottom:10}}>Single Leg History</div>
                    {slCmjResults.map((r:any,i:number)=>(
                      <div key={i} style={card}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                          <span style={{fontSize:13,color:C.textMuted}}>{r.test_date}</span>
                          <LSIBadge lsi={r.lsi}/>
                        </div>
                        <div style={{display:'flex',gap:12}}>
                          <span style={{fontSize:12,color:C.teal}}>L: {r.left_jump_height_in?.toFixed(1)} in</span>
                          <span style={{fontSize:12,color:C.red}}>R: {r.right_jump_height_in?.toFixed(1)} in</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Triple Hop */}
            {assessTab==='triple_hop'&&(
              <div>
                <div style={{...card,background:'rgba(88,166,255,0.05)',border:'1px solid rgba(88,166,255,0.2)',marginBottom:12}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.blue,marginBottom:4}}>Triple Hop for Distance</div>
                  <div style={{fontSize:12,color:C.textMuted,lineHeight:1.6}}>Hop 3 times on one leg as far as possible. Measure total distance with a tape measure. Do both legs and compare. LSI of 90% or above is the target.</div>
                </div>
                <div style={card}>
                  <label style={lbl}>Date</label>
                  <input type="date" style={inp} value={hopForm.date} onChange={e=>setHopForm(f=>({...f,date:e.target.value}))}/>
                  <label style={lbl}>Left Leg Distance (inches)</label>
                  <input type="number" step="0.1" style={inp} placeholder="e.g. 156.5" value={hopForm.leftDistance} onChange={e=>setHopForm(f=>({...f,leftDistance:e.target.value}))}/>
                  <label style={lbl}>Right Leg Distance (inches)</label>
                  <input type="number" step="0.1" style={inp} placeholder="e.g. 162.0" value={hopForm.rightDistance} onChange={e=>setHopForm(f=>({...f,rightDistance:e.target.value}))}/>
                  <label style={lbl}>Notes (optional)</label>
                  <input style={inp} placeholder="Any notes..." value={hopForm.notes} onChange={e=>setHopForm(f=>({...f,notes:e.target.value}))}/>
                  <button style={btn('gold')} onClick={calcHopHandler}>Calculate</button>
                </div>

                {hopResult&&(
                  <div style={{...card,border:'1px solid rgba(57,211,83,0.4)',background:'rgba(57,211,83,0.06)'}}>
                    <div style={{fontSize:11,color:C.teal,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'1px',marginBottom:12}}>Triple Hop Result</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                      <div style={{textAlign:'center',padding:'12px',background:'rgba(0,0,0,0.2)',borderRadius:8}}>
                        <div style={{fontSize:10,color:C.teal,marginBottom:4}}>Left Leg</div>
                        <div style={{fontSize:22,fontWeight:700,color:C.white}}>{hopResult.leftDistance}<span style={{fontSize:12,color:C.textMuted}}> in</span></div>
                      </div>
                      <div style={{textAlign:'center',padding:'12px',background:'rgba(0,0,0,0.2)',borderRadius:8}}>
                        <div style={{fontSize:10,color:C.red,marginBottom:4}}>Right Leg</div>
                        <div style={{fontSize:22,fontWeight:700,color:C.white}}>{hopResult.rightDistance}<span style={{fontSize:12,color:C.textMuted}}> in</span></div>
                      </div>
                    </div>
                    <div style={{textAlign:'center',marginBottom:12}}><LSIBadge lsi={hopResult.lsi}/></div>
                    {hopResult.lsi<90&&<div style={{fontSize:12,color:C.red,textAlign:'center',marginBottom:12}}>Asymmetry detected — discuss with Coach Salzman</div>}
                    <button style={{...btn('gold'),marginTop:0}} onClick={saveHop}>Save to Profile</button>
                  </div>
                )}

                {tripleHopResults.length>0&&(
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:C.white,marginBottom:10}}>Triple Hop History</div>
                    {tripleHopResults.map((r:any,i:number)=>(
                      <div key={i} style={card}>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                          <span style={{fontSize:13,color:C.textMuted}}>{r.test_date}</span>
                          <LSIBadge lsi={r.lsi}/>
                        </div>
                        <div style={{display:'flex',gap:12}}>
                          <span style={{fontSize:12,color:C.teal}}>L: {r.left_distance_in} in</span>
                          <span style={{fontSize:12,color:C.red}}>R: {r.right_distance_in} in</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Plyo Push Up */}
            {assessTab==='plyo_pushup'&&(
              <div>
                <div style={{...card,background:'rgba(88,166,255,0.05)',border:'1px solid rgba(88,166,255,0.2)',marginBottom:12}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.blue,marginBottom:4}}>Plyo Push Up</div>
                  <div style={{fontSize:12,color:C.textMuted,lineHeight:1.6}}>From a push up position, push explosively so your hands leave the ground. Film at 240fps. Record the frame when your hands leave the ground and when they land. Measures upper body explosive power.</div>
                </div>
                <div style={card}>
                  <label style={lbl}>Date</label>
                  <input type="date" style={inp} value={plyoForm.date} onChange={e=>setPlyoForm(f=>({...f,date:e.target.value}))}/>
                  <label style={lbl}>FPS</label>
                  <select style={inp} value={plyoForm.fps} onChange={e=>setPlyoForm(f=>({...f,fps:e.target.value}))}><option value="240">240 FPS</option><option value="120">120 FPS</option></select>
                  <FrameInputs form={plyoForm} setForm={setPlyoForm} fields={[{key:'takeoffFrame',label:'Takeoff Frame',placeholder:'Frame when hands leave ground'},{key:'landingFrame',label:'Landing Frame',placeholder:'Frame when hands hit ground'}]}/>
                  {plyoErr&&<div style={{color:C.red,fontSize:13,marginTop:8,padding:'10px',background:'rgba(248,81,73,0.1)',borderRadius:8}}>{plyoErr}</div>}
                  <button style={btn('gold')} onClick={calcPlyoHandler}>Calculate</button>
                </div>

                {plyoResult&&(
                  <div style={{...card,border:'1px solid rgba(232,184,75,0.4)',background:'rgba(232,184,75,0.06)',textAlign:'center'}}>
                    <div style={{fontSize:11,color:C.gold,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'1px',marginBottom:8}}>Plyo Push Up Result</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                      <div style={{padding:'12px',background:'rgba(0,0,0,0.2)',borderRadius:8}}>
                        <div style={{fontSize:10,color:C.gold,marginBottom:4}}>Flight Time</div>
                        <div style={{fontSize:20,fontWeight:700,color:C.white}}>{plyoResult.flightTime.toFixed(3)}<span style={{fontSize:12,color:C.textMuted}}> s</span></div>
                      </div>
                      <div style={{padding:'12px',background:'rgba(0,0,0,0.2)',borderRadius:8}}>
                        <div style={{fontSize:10,color:C.gold,marginBottom:4}}>Height</div>
                        <div style={{fontSize:20,fontWeight:700,color:C.white}}>{plyoResult.jumpHeightIn.toFixed(1)}<span style={{fontSize:12,color:C.textMuted}}> in</span></div>
                      </div>
                    </div>
                    <button style={{...btn('gold'),marginTop:0}} onClick={savePlyo}>Save to Profile</button>
                  </div>
                )}

                {plyoPushupResults.length>0&&(
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:C.white,marginBottom:10}}>Plyo Push Up History</div>
                    {plyoPushupResults.map((r:any,i:number)=>(
                      <div key={i} style={card}>
                        <div style={{display:'flex',justifyContent:'space-between'}}>
                          <span style={{fontSize:13,color:C.textMuted}}>{r.test_date}</span>
                          <div>
                            <span style={{fontSize:14,fontWeight:700,color:C.gold}}>{r.jump_height_in?.toFixed(1)} in</span>
                            <span style={{fontSize:11,color:C.textMuted,marginLeft:8}}>{r.flight_time?.toFixed(3)}s</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* LOG TAB */}
        {tab==='log'&&(
          <div>
            <div style={{fontSize:18,fontWeight:700,color:C.white,marginBottom:16}}>Log Session</div>
            <div style={card}>
              <label style={lbl}>Date</label>
              <input type="date" style={inp} value={logForm.date} onChange={e=>setLogForm(f=>({...f,date:e.target.value}))}/>
              <label style={lbl}>Velocity (mph)</label>
              <input type="number" style={inp} placeholder="e.g. 91" value={logForm.velocity} onChange={e=>setLogForm(f=>({...f,velocity:e.target.value}))}/>
              <label style={lbl}>Weight Lifted (lbs)</label>
              <input type="number" style={inp} placeholder="e.g. 225" value={logForm.weightLifted} onChange={e=>setLogForm(f=>({...f,weightLifted:e.target.value}))}/>
              <label style={lbl}>Sprint Time (sec)</label>
              <input type="number" step="0.1" style={inp} placeholder="e.g. 6.8" value={logForm.sprintTime} onChange={e=>setLogForm(f=>({...f,sprintTime:e.target.value}))}/>
              <label style={lbl}>Pitch Count</label>
              <input type="number" style={inp} placeholder="e.g. 45" value={logForm.pitchCount} onChange={e=>setLogForm(f=>({...f,pitchCount:e.target.value}))}/>
              <label style={lbl}>High Effort Throws</label>
              <input type="number" style={inp} placeholder="e.g. 20" value={logForm.highEffortThrows} onChange={e=>setLogForm(f=>({...f,highEffortThrows:e.target.value}))}/>
              <label style={lbl}>Overall Feeling — <span style={{color:C.gold,fontSize:16,fontWeight:700}}>{logForm.feeling}/10</span></label>
              <input type="range" min="1" max="10" style={{width:'100%',accentColor:C.gold,marginBottom:4}} value={logForm.feeling} onChange={e=>setLogForm(f=>({...f,feeling:parseInt(e.target.value)}))}/>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:C.textDim,marginBottom:14}}><span>Poor</span><span>Great</span></div>
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
                      {log.soreness?.length>0&&<span style={{fontSize:12,color:C.red}}>🩺 {log.soreness.join(', ')}</span>}
                    </div>
                    {log.notes&&<div style={{fontSize:12,color:C.textMuted,marginTop:6,fontStyle:'italic'}}>{log.notes}</div>}
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
                {messages.length===0&&<div style={{color:C.textDim,fontSize:13}}>No messages yet. Your coach will message you here.</div>}
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
            {notes.length===0&&<div style={{...card,color:C.textMuted,textAlign:'center',padding:'32px 16px'}}>No notes yet. Your coach will leave notes for you here.</div>}
            {notes.map((n:any)=>(
              <div key={n.id} style={card}>
                <div style={{fontSize:10,color:C.textMuted,marginBottom:8,textTransform:'uppercase' as const,letterSpacing:'0.5px',fontWeight:600}}>Coach Salzman · {new Date(n.created_at).toLocaleDateString()}</div>
                <div style={{fontSize:14,lineHeight:1.7,color:C.text}}>{n.content}</div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
