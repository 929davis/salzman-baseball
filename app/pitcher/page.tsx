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
const CATS = ['Throwing','Lifting','Conditioning','Recovery']

const LIFTS = [
  {key:'squat',label:'Back Squat',example:'Back Squat',color:C.gold},
  {key:'hinge',label:'Deadlift',example:'Any deadlift variation',color:C.teal},
  {key:'push',label:'Bench Press',example:'Barbell Bench Press',color:C.blue},
  {key:'pull',label:'Barbell Row',example:'Barbell Row / Pendlay Row',color:C.purple},
]

const ARM_STANDARDS = [
  {name:'Pull-Ups',reps:'Max Reps',unit:'reps',hs:'8',col:'12',pro:'15+',note:''},
  {name:'1-Arm DB Row',reps:'5 Reps',unit:'lbs',hs:'60–80',col:'80–100',pro:'100–120',note:''},
  {name:'Incline DB Press',reps:'8 Reps',unit:'% BW/hand',hs:'25%',col:'33%',pro:'37.5%',note:'Per hand as % of bodyweight'},
  {name:'DB Shoulder Press',reps:'10 Reps',unit:'% BW/hand',hs:'15%',col:'20–25%',pro:'25%',note:'Per hand as % of bodyweight'},
  {name:'Rear Delt Fly',reps:'10 Reps',unit:'lbs',hs:'10–15',col:'15–20',pro:'20–30',note:''},
  {name:'Hammer Curl',reps:'10 Reps',unit:'lbs',hs:'25',col:'35',pro:'45',note:''},
  {name:'Hex DB Hold',reps:'30 sec',unit:'lbs',hs:'20',col:'30',pro:'40',note:'Static hold'},
  {name:'Pronation',reps:'15 Reps',unit:'lbs',hs:'5',col:'8',pro:'10–12',note:'Offset grip'},
  {name:'Supination',reps:'15 Reps',unit:'lbs',hs:'5',col:'8',pro:'10–12',note:'Offset grip'},
  {name:'Ulnar Deviation',reps:'15 Reps',unit:'lbs',hs:'10',col:'15',pro:'20',note:'Vertical implement'},
  {name:'Radial Deviation',reps:'15 Reps',unit:'lbs',hs:'5',col:'8',pro:'10',note:'Vertical implement'},
  {name:'Wrist Extension',reps:'15 Reps',unit:'lbs',hs:'10',col:'15',pro:'20',note:'Forearm supported'},
]

const FV_ZONES = [
  {label:'Max Strength',pctMin:90,pctMax:100,color:'#f85149'},
  {label:'Strength-Speed',pctMin:75,pctMax:89,color:C.gold},
  {label:'Power Zone',pctMin:55,pctMax:74,color:C.teal},
  {label:'Speed-Strength',pctMin:35,pctMax:54,color:C.blue},
  {label:'Max Speed',pctMin:0,pctMax:34,color:C.purple},
]

const getZone = (pct:number) => FV_ZONES.find(z=>pct>=z.pctMin&&pct<=z.pctMax)||FV_ZONES[4]

const calcCMJ = ({startFrame,takeoffFrame,landingFrame,fps,massKg}:{startFrame:number,takeoffFrame:number,landingFrame:number,fps:number,massKg:number}) => {
  const ft=(landingFrame-takeoffFrame)/fps,ttt=(takeoffFrame-startFrame)/fps
  const jh=(9.81*ft*ft)/8,jhc=jh*100,jhi=jh*39.3701
  const rsi=jh/ttt,pp=(60.7*jhc)+(45.3*massKg)-2055,ppkg=pp/massKg
  const tv=Math.sqrt(2*9.81*jh),ei=rsi*ppkg,ev=47+(0.70*ppkg)+(10*rsi)+(0.02*ei)
  return{flightTime:ft,jumpHeightIn:jhi,rsiMod:rsi,peakPowerPerKg:ppkg,takeoffVelocity:tv,explosiveIndex:ei,estimatedVelocity:ev}
}

const cmjTier = (v:number) => v>=95?{l:'Elite / Pro',c:C.teal}:v>=90?{l:'High D1 / Pro Fringe',c:C.gold}:v>=85?{l:'D1 Range',c:C.blue}:v>=80?{l:'D2/D3 Range',c:C.textMuted}:{l:'Development',c:C.red}

export default function PitcherDashboard() {
  const [profile, setProfile] = useState<any>(null)
  const [tab, setTab] = useState('program')
  const [program, setProgram] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [notes, setNotes] = useState<any[]>([])
  const [cmjResults, setCmjResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [msgText, setMsgText] = useState('')
  const [logSaved, setLogSaved] = useState(false)
  const [oneRMs, setOneRMs] = useState<any>({squat:0,hinge:0,push:0,pull:0})
  const [oneRMsEditing, setOneRMsEditing] = useState(false)
  const [oneRMsSaved, setOneRMsSaved] = useState(false)
  const [armScores, setArmScores] = useState<any>({})
  const [armLevel, setArmLevel] = useState('College')
  const [armSaved, setArmSaved] = useState(false)
  const [logForm, setLogForm] = useState({
    date:new Date().toISOString().split('T')[0],
    velocity:'',weightLifted:'',sprintTime:'',
    pitchCount:'',highEffortThrows:'',
    feeling:7,soreness:[] as string[],notes:''
  })
  const [cmjForm, setCmjForm] = useState({
    date:new Date().toISOString().split('T')[0],
    bodyweight:'',weightUnit:'lbs',fps:'240',
    startFrame:'',takeoffFrame:'',landingFrame:'',notes:''
  })
  const [cmjResult, setCmjResult] = useState<any>(null)
  const [cmjErr, setCmjErr] = useState('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(()=>{
    const init = async () => {
      const {data:{user}} = await supabase.auth.getUser()
      if (!user) {router.push('/auth/login');return}
      const {data:prof} = await supabase.from('profiles').select('*').eq('id',user.id).single()
      if (!prof||prof.role==='coach') {router.push('/coach');return}
      setProfile(prof)
      setOneRMs(prof.one_rms||{squat:0,hinge:0,push:0,pull:0})
      setArmScores(prof.arm_scores||{})
      setArmLevel(prof.arm_level||'College')
      const [progRes,logsRes,msgsRes,notesRes,cmjRes] = await Promise.all([
        supabase.from('programs').select('*').eq('pitcher_id',prof.id).order('week_of',{ascending:false}).limit(1),
        supabase.from('session_logs').select('*').eq('pitcher_id',prof.id).order('log_date',{ascending:false}).limit(20),
        supabase.from('messages').select('*').eq('pitcher_id',prof.id).order('created_at'),
        supabase.from('coach_notes').select('*').eq('pitcher_id',prof.id).order('created_at',{ascending:false}),
        supabase.from('cmj_results').select('*').eq('pitcher_id',prof.id).order('test_date',{ascending:false})
      ])
      setProgram(progRes.data?.[0]||null)
      setLogs(logsRes.data||[])
      setMessages(msgsRes.data||[])
      setNotes(notesRes.data||[])
      setCmjResults(cmjRes.data||[])
      setLoading(false)
    }
    init()
  },[])

  const signOut = async () => {await supabase.auth.signOut();router.push('/auth/login')}

  const submitLog = async () => {
    if (!profile) return
    await supabase.from('session_logs').insert({
      pitcher_id:profile.id,log_date:logForm.date,
      velocity:parseFloat(logForm.velocity)||null,
      weight_lifted:parseFloat(logForm.weightLifted)||null,
      sprint_time:parseFloat(logForm.sprintTime)||null,
      pitch_count:parseInt(logForm.pitchCount)||null,
      high_effort_throws:parseInt(logForm.highEffortThrows)||null,
      feeling:logForm.feeling,soreness:logForm.soreness,
      notes:logForm.notes||null
    })
    const {data} = await supabase.from('session_logs').select('*').eq('pitcher_id',profile.id).order('log_date',{ascending:false}).limit(20)
    setLogs(data||[])
    setLogForm({date:new Date().toISOString().split('T')[0],velocity:'',weightLifted:'',sprintTime:'',pitchCount:'',highEffortThrows:'',feeling:7,soreness:[],notes:''})
    setLogSaved(true)
    setTimeout(()=>setLogSaved(false),2000)
  }

  const sendMessage = async () => {
    if (!msgText.trim()||!profile) return
    const {data} = await supabase.from('messages').insert({pitcher_id:profile.id,sender_id:profile.id,sender_role:'pitcher',content:msgText.trim()}).select().single()
    if (data) {setMessages([...messages,data]);setMsgText('')}
  }

  const saveOneRMs = async () => {
    await supabase.from('profiles').update({one_rms:oneRMs}).eq('id',profile.id)
    setOneRMsEditing(false)
    setOneRMsSaved(true)
    setTimeout(()=>setOneRMsSaved(false),2000)
  }

  const saveArmScores = async () => {
    await supabase.from('profiles').update({arm_scores:armScores,arm_level:armLevel}).eq('id',profile.id)
    setArmSaved(true)
    setTimeout(()=>setArmSaved(false),2000)
  }

  const calcCMJHandler = () => {
    setCmjErr('')
    const bw=parseFloat(cmjForm.bodyweight),fps=parseFloat(cmjForm.fps)
    const sf=parseFloat(cmjForm.startFrame),tf=parseFloat(cmjForm.takeoffFrame),lf=parseFloat(cmjForm.landingFrame)
    if (!bw||isNaN(sf)||isNaN(tf)||isNaN(lf)||tf<=sf||lf<=tf) {setCmjErr('Check your inputs.');return}
    const massKg=cmjForm.weightUnit==='lbs'?bw*0.453592:bw
    setCmjResult(calcCMJ({startFrame:sf,takeoffFrame:tf,landingFrame:lf,fps,massKg}))
  }

  const saveCMJ = async () => {
    if (!cmjResult||!profile) return
    await supabase.from('cmj_results').insert({
      pitcher_id:profile.id,test_date:cmjForm.date,
      bodyweight:parseFloat(cmjForm.bodyweight),weight_unit:cmjForm.weightUnit,fps:parseInt(cmjForm.fps),
      start_frame:parseInt(cmjForm.startFrame),takeoff_frame:parseInt(cmjForm.takeoffFrame),landing_frame:parseInt(cmjForm.landingFrame),
      flight_time:cmjResult.flightTime,jump_height_in:cmjResult.jumpHeightIn,rsi_mod:cmjResult.rsiMod,
      peak_power_per_kg:cmjResult.peakPowerPerKg,takeoff_velocity:cmjResult.takeoffVelocity,
      explosive_index:cmjResult.explosiveIndex,estimated_velocity:cmjResult.estimatedVelocity,notes:cmjForm.notes||null
    })
    const {data} = await supabase.from('cmj_results').select('*').eq('pitcher_id',profile.id).order('test_date',{ascending:false})
    setCmjResults(data||[])
    setCmjResult(null)
    setCmjForm({date:new Date().toISOString().split('T')[0],bodyweight:'',weightUnit:'lbs',fps:'240',startFrame:'',takeoffFrame:'',landingFrame:'',notes:''})
  }

  const toggleSoreness = (a:string) => setLogForm(f=>({...f,soreness:f.soreness.includes(a)?f.soreness.filter(x=>x!==a):[...f.soreness,a]}))

  const getArmTarget = (ex:any) => {
    const t = armLevel==='High School'?ex.hs:armLevel==='Professional'?ex.pro:ex.col
    if (ex.unit==='% BW/hand'&&profile?.bodyweight>0) {
      const pct = parseFloat(t)/100
      return `${t} = ~${Math.round(profile.bodyweight*pct)} lbs`
    }
    return `${t} ${ex.unit}`
  }

  const getArmStatus = (ex:any, score:string) => {
    if (!score) return null
    const val = parseFloat(score)
    const targetStr = armLevel==='High School'?ex.hs:armLevel==='Professional'?ex.pro:ex.col
    const targetLow = parseFloat(targetStr.toString().split('–')[0].replace(/[^0-9.]/g,''))
    if (isNaN(val)||isNaN(targetLow)) return null
    if (val>=targetLow) return 'green'
    if (val>=targetLow*0.85) return 'gold'
    return 'red'
  }

  const getFVHits = () => {
    if (!program||!oneRMs) return []
    const hits:any[] = []
    const keywords:any = {
      squat:['back squat','squat'],hinge:['deadlift','rdl','romanian'],
      push:['bench press','bench'],pull:['barbell row','pendlay row','bb row'],
    }
    DAYS.forEach(day=>CATS.forEach(cat=>{
      const text = (program.days?.[day]?.[cat]||'').toLowerCase()
      if (!text) return
      text.split('\n').forEach((line:string)=>{
        let liftKey:string|null = null
        for (const [k,kws] of Object.entries(keywords) as any) {
          if (kws.some((kw:string)=>line.includes(kw))) {liftKey=k;break}
        }
        const pctMatch = line.match(/@\s*(\d+(?:\.\d+)?)\s*%/)
        if (pctMatch&&liftKey) {
          const pct = parseFloat(pctMatch[1])
          hits.push({day,cat,line:line.trim(),liftKey,pct,zone:getZone(pct)})
        }
        const lbsMatch = line.match(/(\d+(?:\.\d+)?)\s*lbs?/i)
        if (lbsMatch&&liftKey&&oneRMs[liftKey]) {
          const pct = Math.round((parseFloat(lbsMatch[1])/oneRMs[liftKey])*100)
          hits.push({day,cat,line:line.trim(),liftKey,pct,zone:getZone(pct)})
        }
      })
    }))
    return hits
  }

  if (loading) return <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',color:C.textMuted,fontFamily:'system-ui'}}>Loading...</div>

  const inp = {width:'100%',background:C.bg3,border:`1px solid ${C.border}`,borderRadius:8,padding:'12px 14px',fontSize:15,color:C.text,boxSizing:'border-box' as const,outline:'none',marginBottom:4}
  const lbl = {fontSize:11,color:C.textMuted,fontWeight:600 as const,marginBottom:6,display:'block',textTransform:'uppercase' as const,letterSpacing:'0.5px',marginTop:14 as const}
  const card = {background:C.bg2,border:`1px solid ${C.border}`,borderRadius:12,padding:'16px',marginBottom:12}
  const btn = (v='primary') => ({background:v==='gold'?C.gold:C.bg3,color:v==='gold'?C.bg:C.text,border:`1px solid ${v==='gold'?C.gold:C.border}`,borderRadius:8,padding:'12px 20px',fontSize:14,fontWeight:v==='gold'?700:500 as const,cursor:'pointer',width:'100%',marginTop:8})

  const fvHits = getFVHits()
  const armPassed = ARM_STANDARDS.filter(ex=>getArmStatus(ex,armScores[ex.name])==='green').length

  return (
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
      <div style={{display:'flex',background:C.bg2,borderBottom:`1px solid ${C.border}`,overflowX:'auto' as const}}>
        {[
          {id:'program',icon:'📋',label:'Program'},
          {id:'log',icon:'📝',label:'Log'},
          {id:'strength',icon:'🏋️',label:'Strength'},
          {id:'cmj',icon:'🦘',label:'CMJ'},
          {id:'arm',icon:'💪',label:'Arm Care'},
          {id:'messages',icon:'💬',label:'Messages'},
          {id:'notes',icon:'📌',label:'Notes'},
        ].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flexShrink:0,background:'transparent',border:'none',borderBottom:`2px solid ${tab===t.id?C.gold:'transparent'}`,padding:'10px 12px',cursor:'pointer',color:tab===t.id?C.gold:C.textMuted,fontSize:10,fontWeight:tab===t.id?700:400,textTransform:'uppercase' as const,letterSpacing:'0.3px'}}>
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
            {!program&&<div style={{...card,textAlign:'center',color:C.textMuted,padding:'32px 16px'}}>No program yet. Check back after your coach uploads your week.</div>}
            {program&&DAYS.map(day=>{
              const hasContent = CATS.some(c=>program.days?.[day]?.[c])
              if (!hasContent) return <div key={day} style={{...card,opacity:0.4}}><div style={{fontSize:12,fontWeight:700,color:C.textMuted,textTransform:'uppercase' as const}}>{day}</div><div style={{fontSize:13,color:C.textDim,marginTop:4}}>Rest</div></div>
              return (
                <div key={day} style={card}>
                  <div style={{fontSize:13,fontWeight:700,color:C.gold,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:10}}>{day}</div>
                  {CATS.map(cat=>{
                    const content = program.days?.[day]?.[cat]
                    if (!content) return null
                    return (
                      <div key={cat} style={{marginBottom:10}}>
                        <div style={{fontSize:10,color:C.textMuted,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4}}>{cat}</div>
                        <div style={{fontSize:13,color:C.text,lineHeight:1.7,fontFamily:'monospace',whiteSpace:'pre-wrap'}}>{content}</div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}

        {/* STRENGTH TAB */}
        {tab==='strength'&&(
          <div>
            <div style={{fontSize:18,fontWeight:700,color:C.white,marginBottom:4}}>Strength Profile</div>
            <div style={{fontSize:12,color:C.textMuted,marginBottom:16}}>Enter your 1 rep maxes to map training loads onto the force-velocity curve.</div>

            <div style={card}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                <div style={{fontSize:12,fontWeight:700,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'1px'}}>1 Rep Max</div>
                {!oneRMsEditing
                  ?<button onClick={()=>setOneRMsEditing(true)} style={{...btn(),width:'auto',marginTop:0,padding:'6px 14px',fontSize:12}}>Edit</button>
                  :<div style={{display:'flex',gap:8}}><button onClick={saveOneRMs} style={{...btn('gold'),width:'auto',marginTop:0,padding:'6px 14px',fontSize:12}}>Save</button><button onClick={()=>setOneRMsEditing(false)} style={{...btn(),width:'auto',marginTop:0,padding:'6px 14px',fontSize:12}}>Cancel</button></div>
                }
              </div>
              {oneRMsSaved&&<div style={{color:C.teal,fontSize:13,fontWeight:600,marginBottom:8}}>✓ Saved</div>}
              {LIFTS.map(l=>(
                <div key={l.key} style={{borderLeft:`3px solid ${l.color}`,paddingLeft:12,marginBottom:14}}>
                  <div style={{fontSize:11,color:l.color,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4}}>{l.label}</div>
                  <div style={{fontSize:11,color:C.textDim,marginBottom:6}}>{l.example}</div>
                  {oneRMsEditing
                    ?<input type="number" placeholder="lbs" style={{...inp,marginBottom:0,fontSize:14}} value={oneRMs[l.key]||''} onChange={e=>setOneRMs((r:any)=>({...r,[l.key]:parseFloat(e.target.value)||0}))}/>
                    :<div style={{fontSize:24,fontWeight:700,color:l.color}}>{oneRMs[l.key]||'—'}<span style={{fontSize:12,color:C.textMuted,marginLeft:4}}>lbs</span></div>
                  }
                  {!oneRMsEditing&&oneRMs[l.key]>0&&(
                    <div style={{display:'flex',gap:8,flexWrap:'wrap' as const,marginTop:6}}>
                      {[90,80,70,60,50,40].map(pct=>{
                        const zone = getZone(pct)
                        return <span key={pct} style={{fontSize:10,color:zone.color}}>{pct}%={Math.round(oneRMs[l.key]*pct/100)}lb</span>
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* F-V Curve */}
            <div style={card}>
              <div style={{fontSize:12,fontWeight:700,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'1px',marginBottom:12}}>⚡ Force-Velocity Curve — This Week</div>
              {fvHits.length===0&&<div style={{color:C.textDim,fontSize:13,lineHeight:1.6}}>No loads detected in your current program. Your coach needs to include loads like <span style={{color:C.gold,fontFamily:'monospace'}}>"Back Squat 4x4 @ 80%"</span> for this to populate.</div>}
              {fvHits.length>0&&(
                <div>
                  {fvHits.map((h,i)=>(
                    <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',background:C.bg3,borderRadius:6,borderLeft:`3px solid ${h.zone.color}`,marginBottom:6}}>
                      <div style={{flex:1,fontSize:12,color:C.text}}>{h.line}</div>
                      <div style={{fontSize:12,fontWeight:700,color:h.zone.color}}>{h.pct}%</div>
                      <div style={{fontSize:10,background:`${h.zone.color}18`,color:h.zone.color,border:`1px solid ${h.zone.color}40`,borderRadius:4,padding:'2px 6px'}}>{h.zone.label}</div>
                    </div>
                  ))}
                  <div style={{marginTop:14}}>
                    <div style={{fontSize:11,color:C.textMuted,marginBottom:8,fontWeight:600,textTransform:'uppercase' as const,letterSpacing:'0.5px'}}>Zone Guide</div>
                    {FV_ZONES.map(z=>(
                      <div key={z.label} style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                        <div style={{width:8,height:8,borderRadius:'50%',background:z.color,flexShrink:0}}/>
                        <span style={{fontSize:12,color:z.color,fontWeight:600}}>{z.label}</span>
                        <span style={{fontSize:11,color:C.textDim}}>{z.pctMin}–{z.pctMax}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
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

        {/* CMJ TAB */}
        {tab==='cmj'&&(
          <div>
            <div style={{fontSize:18,fontWeight:700,color:C.white,marginBottom:4}}>CMJ Calculator</div>
            <div style={{fontSize:12,color:C.textMuted,marginBottom:16}}>Film at 240 FPS · Open in Photos · Edit · Find times in seconds · Multiply by FPS for frame numbers</div>
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
              <label style={lbl}>Start Frame <span style={{color:C.textDim,fontWeight:400}}>(time × {cmjForm.fps})</span></label>
              <input type="number" style={inp} placeholder="e.g. 3168" value={cmjForm.startFrame} onChange={e=>setCmjForm(f=>({...f,startFrame:e.target.value}))}/>
              <label style={lbl}>Takeoff Frame</label>
              <input type="number" style={inp} placeholder="e.g. 3379" value={cmjForm.takeoffFrame} onChange={e=>setCmjForm(f=>({...f,takeoffFrame:e.target.value}))}/>
              <label style={lbl}>Landing Frame</label>
              <input type="number" style={inp} placeholder="e.g. 3526" value={cmjForm.landingFrame} onChange={e=>setCmjForm(f=>({...f,landingFrame:e.target.value}))}/>
              {cmjErr&&<div style={{color:C.red,fontSize:13,marginTop:8,padding:'10px',background:'rgba(248,81,73,0.1)',borderRadius:8}}>{cmjErr}</div>}
              <button style={btn('gold')} onClick={calcCMJHandler}>Calculate</button>
            </div>
            {cmjResult&&(
              <div style={{...card,border:`1px solid rgba(163,113,247,0.4)`,background:'rgba(163,113,247,0.06)',textAlign:'center'}}>
                <div style={{fontSize:11,color:C.purple,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'1px',marginBottom:8}}>Estimated Velocity Capacity</div>
                <div style={{fontSize:56,fontWeight:700,color:C.white,letterSpacing:'-2px',marginBottom:8}}>{cmjResult.estimatedVelocity.toFixed(1)}<span style={{fontSize:18,color:C.textMuted,fontWeight:400}}> MPH</span></div>
                <div style={{display:'inline-block',background:`${cmjTier(cmjResult.estimatedVelocity).c}20`,color:cmjTier(cmjResult.estimatedVelocity).c,border:`1px solid ${cmjTier(cmjResult.estimatedVelocity).c}40`,borderRadius:20,padding:'4px 16px',fontSize:12,fontWeight:700,marginBottom:16}}>{cmjTier(cmjResult.estimatedVelocity).l}</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                  {[{l:'Jump Height',v:`${cmjResult.jumpHeightIn.toFixed(1)} in`},{l:'RSI-Mod',v:`${cmjResult.rsiMod.toFixed(2)} m/s`},{l:'Peak Power/kg',v:`${cmjResult.peakPowerPerKg.toFixed(1)} W/kg`},{l:'Explosive Index',v:cmjResult.explosiveIndex.toFixed(1)}].map(m=>(
                    <div key={m.l} style={{background:'rgba(163,113,247,0.08)',borderRadius:8,padding:'10px'}}>
                      <div style={{fontSize:10,color:C.purple,marginBottom:3}}>{m.l}</div>
                      <div style={{fontSize:16,fontWeight:700,color:C.white}}>{m.v}</div>
                    </div>
                  ))}
                </div>
                <button style={{...btn('gold'),marginTop:0}} onClick={saveCMJ}>💾 Save to Profile</button>
              </div>
            )}
            {cmjResults.length>0&&(
              <div>
                <div style={{fontSize:14,fontWeight:700,color:C.white,marginBottom:10}}>History</div>
                {cmjResults.map((r:any,i:number)=>{
                  const tier = cmjTier(r.estimated_velocity)
                  return (
                    <div key={i} style={card}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                        <span style={{fontSize:13,color:C.textMuted}}>{r.test_date}</span>
                        <span style={{fontSize:16,fontWeight:700,color:tier.c}}>{r.estimated_velocity?.toFixed(1)} mph</span>
                      </div>
                      <div style={{display:'flex',gap:12,flexWrap:'wrap' as const}}>
                        <span style={{fontSize:12,color:C.gold}}>↑ {r.jump_height_in?.toFixed(1)} in</span>
                        <span style={{fontSize:12,color:C.teal}}>RSI {r.rsi_mod?.toFixed(2)}</span>
                        <span style={{fontSize:12,color:C.blue}}>{r.peak_power_per_kg?.toFixed(1)} W/kg</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ARM CARE TAB */}
        {tab==='arm'&&(
          <div>
            <div style={{fontSize:18,fontWeight:700,color:C.white,marginBottom:4}}>Arm Care Standards</div>
            <div style={{fontSize:12,color:C.textMuted,marginBottom:16}}>Track your performance against Salzman Baseball standards.</div>

            <div style={card}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:700,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'1px'}}>Level</div>
                <div style={{display:'flex',gap:6}}>
                  {['High School','College','Professional'].map(l=>(
                    <button key={l} onClick={()=>setArmLevel(l)} style={{background:armLevel===l?C.goldBg:'transparent',color:armLevel===l?C.gold:C.textMuted,border:`1px solid ${armLevel===l?C.goldDim:C.border}`,borderRadius:6,padding:'4px 10px',fontSize:11,cursor:'pointer'}}>{l==='High School'?'HS':l==='Professional'?'Pro':l}</button>
                  ))}
                </div>
              </div>
              <div style={{background:C.bg3,borderRadius:8,padding:'10px 14px',marginBottom:12}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                  <span style={{fontSize:12,color:C.textMuted}}>Standards Met</span>
                  <span style={{fontSize:12,fontWeight:700,color:armPassed===ARM_STANDARDS.length?C.teal:armPassed>ARM_STANDARDS.length/2?C.gold:C.red}}>{armPassed} / {ARM_STANDARDS.length}</span>
                </div>
                <div style={{height:6,background:C.bg4||'#21262d',borderRadius:3,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${(armPassed/ARM_STANDARDS.length)*100}%`,background:armPassed===ARM_STANDARDS.length?C.teal:armPassed>ARM_STANDARDS.length/2?C.gold:C.red,borderRadius:3}}/>
                </div>
              </div>
            </div>

            {ARM_STANDARDS.map(ex=>{
              const status = getArmStatus(ex,armScores[ex.name])
              return (
                <div key={ex.name} style={{...card,borderLeft:`3px solid ${status==='green'?C.teal:status==='gold'?C.gold:status==='red'?C.red:C.border}`}}>
                  <div style={{fontSize:13,fontWeight:600,color:C.white,marginBottom:2}}>{ex.name}</div>
                  <div style={{fontSize:11,color:C.textMuted,marginBottom:8}}>{ex.reps}{ex.note?` · ${ex.note}`:''} · Target: <span style={{color:C.gold}}>{getArmTarget(ex)}</span></div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <input type="number" style={{...inp,flex:1,marginBottom:0,fontSize:14}} placeholder={`e.g. ${ex.hs}`} value={armScores[ex.name]||''} onChange={e=>setArmScores((s:any)=>({...s,[ex.name]:e.target.value}))}/>
                    {status&&<span style={{fontSize:11,fontWeight:700,color:status==='green'?C.teal:status==='gold'?C.gold:C.red,flexShrink:0}}>{status==='green'?'✓ Met':status==='gold'?'Close':'Below'}</span>}
                  </div>
                </div>
              )
            })}

            <button style={btn('gold')} onClick={saveArmScores}>Save Scores</button>
            {armSaved&&<div style={{textAlign:'center',color:C.teal,fontSize:14,fontWeight:600,marginTop:8}}>✓ Saved!</div>}
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

      </div>
    </div>
  )
}
