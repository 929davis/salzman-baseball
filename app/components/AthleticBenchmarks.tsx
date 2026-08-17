'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BENCHMARKS, TIER_INFO, benchmarkStatus, scalePct, type BenchmarkDef,
  POWER_TESTS, powerTestTier, POWER_TIER_COLORS,
  MOBILITY_SCREENS, SCREEN_STATUS_COLORS, type ScreenStatus } from '@/lib/benchmarks'

const C = {
  bg:'#0d1117',bg2:'#161b22',bg3:'#1c2333',border:'#30363d',
  gold:'#e8b84b',goldDim:'#a07c28',goldBg:'rgba(232,184,75,0.08)',
  teal:'#39d353',red:'#f85149',blue:'#58a6ff',purple:'#a371f7',
  text:'#e6edf3',textMuted:'#7d8590',textDim:'#484f58',white:'#ffffff',
}

const inp:React.CSSProperties = {width:'100%',background:C.bg3,border:`1px solid ${C.border}`,borderRadius:6,padding:'8px 10px',fontSize:13,color:C.text,outline:'none',marginBottom:10}
const lbl:React.CSSProperties = {fontSize:10,color:C.textMuted,fontWeight:600,marginBottom:4,textTransform:'uppercase' as const,letterSpacing:'0.5px',display:'block'}

type FormState = {
  date:string,broad_jump_in:string,lateral_broad_jump_lr_in:string,sprint_10yd_sec:string,
  squat_lbs:string,bench_lbs:string,deadlift_lbs:string,shoulder_er_ir_lbs:string,
  vertical_jump_in:string,vertical_jump_225_in:string,grip_strength_right_lbs:string,grip_strength_left_lbs:string,
  wingspan_in:string,hip_rotation_trail_deg:string,hip_rotation_lead_deg:string,shoulder_rotation_deg:string,
  mb_seated_chest_pass_ft:string,mb_situp_throw_ft:string,mb_rotational_pass_ft:string,
}
const BLANK_FORM:FormState = {
  date:new Date().toISOString().split('T')[0],broad_jump_in:'',lateral_broad_jump_lr_in:'',sprint_10yd_sec:'',
  squat_lbs:'',bench_lbs:'',deadlift_lbs:'',shoulder_er_ir_lbs:'',
  vertical_jump_in:'',vertical_jump_225_in:'',grip_strength_right_lbs:'',grip_strength_left_lbs:'',
  wingspan_in:'',hip_rotation_trail_deg:'',hip_rotation_lead_deg:'',shoulder_rotation_deg:'',
  mb_seated_chest_pass_ft:'',mb_situp_throw_ft:'',mb_rotational_pass_ft:'',
}

type ScreenFormState = Record<string,ScreenStatus|''>
const BLANK_SCREEN_FORM:ScreenFormState = Object.fromEntries(MOBILITY_SCREENS.map(s=>[s.key,'']))

function PowerTestCard({label,unit,value,tier}:{label:string,unit:string,value:number|null|undefined,tier:string|null}){
  const color=tier?POWER_TIER_COLORS[tier as keyof typeof POWER_TIER_COLORS]:C.textDim
  return (
    <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:8,padding:'12px 14px'}}>
      <div style={{fontSize:11,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.4px',marginBottom:6}}>{label}</div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{fontFamily:'monospace',fontSize:20,fontWeight:700,color:C.white}}>{value!=null?`${value}${unit}`:'—'}</div>
        <div style={{fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:12,textTransform:'uppercase' as const,letterSpacing:'0.4px',background:`${color}26`,color,border:`1px solid ${color}66`}}>{tier||'No data'}</div>
      </div>
    </div>
  )
}

function ScreenBadge({label,status}:{label:string,status:ScreenStatus|null}){
  const color=status?SCREEN_STATUS_COLORS[status]:C.textDim
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 10px',background:C.bg3,borderRadius:6}}>
      <span style={{fontSize:12,color:C.text}}>{label}</span>
      <span style={{fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:12,textTransform:'uppercase' as const,letterSpacing:'0.4px',background:`${color}26`,color,border:`1px solid ${color}66`}}>{status||'No data'}</span>
    </div>
  )
}

function BenchmarkBar({def,value}:{def:BenchmarkDef,value:number|null|undefined}){
  const status=benchmarkStatus(def,value)
  const fillPct=value!=null&&!isNaN(value)?scalePct(def,value):0
  const p50Pct=scalePct(def,def.p50)
  return (
    <div style={{marginBottom:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:4}}>
        <span style={{fontSize:12,color:C.text,fontWeight:600}}>{def.label}</span>
        <span style={{fontSize:12,fontWeight:700,color:status?status.color:C.textDim}}>
          {value!=null&&!isNaN(value)?`${value}${def.unit}`:'No data'}
          {status&&<span style={{fontWeight:400,fontSize:11,marginLeft:6}}>· {status.label}</span>}
        </span>
      </div>
      <div style={{position:'relative' as const,height:16,background:C.bg3,borderRadius:4,overflow:'visible' as const}}>
        {def.normalRange&&(
          <div style={{position:'absolute' as const,left:`${scalePct(def,def.normalRange[0])}%`,width:`${scalePct(def,def.normalRange[1])-scalePct(def,def.normalRange[0])}%`,top:0,bottom:0,background:'rgba(57,211,83,0.12)',borderLeft:'1px dashed rgba(57,211,83,0.5)',borderRight:'1px dashed rgba(57,211,83,0.5)'}}/>
        )}
        <div style={{position:'absolute' as const,left:0,top:0,bottom:0,width:`${fillPct}%`,background:status?status.color:C.border,borderRadius:4,transition:'width 0.2s'}}/>
        <div style={{position:'absolute' as const,left:`${p50Pct}%`,top:-2,bottom:-2,width:1,background:C.white,opacity:0.6}} title={`Average: ${def.p50}${def.unit}`}/>
        {def.p75!=null&&(
          <div style={{position:'absolute' as const,left:`${scalePct(def,def.p75)}%`,top:-2,bottom:-2,width:1,background:C.teal}} title={`Strong: ${def.p75}${def.unit}`}/>
        )}
        {def.elite!=null&&(
          <div style={{position:'absolute' as const,left:`${scalePct(def,def.elite)}%`,top:-2,bottom:-2,width:1,background:C.teal}} title={`Elite: ${def.elite}${def.unit}`}/>
        )}
        {def.mlbAvg!=null&&(
          <div style={{position:'absolute' as const,left:`${scalePct(def,def.mlbAvg)}%`,top:-2,bottom:-2,width:1,background:C.purple}} title={`MLB average: ${def.mlbAvg}${def.unit}`}/>
        )}
      </div>
      <div style={{display:'flex',gap:10,fontSize:9,color:C.textDim,marginTop:3,flexWrap:'wrap' as const}}>
        <span>Average: {def.p50}{def.unit}</span>
        {def.p75!=null&&<span style={{color:C.teal}}>Strong: {def.p75}{def.unit}</span>}
        {def.elite!=null&&<span style={{color:C.teal}}>Elite: {def.elite}{def.unit}</span>}
        {def.mlbAvg!=null&&<span style={{color:C.purple}}>MLB average: {def.mlbAvg}{def.unit}</span>}
        {def.normalRange&&<span style={{color:C.teal}}>Healthy range: {def.normalRange[0]}–{def.normalRange[1]}{def.unit}</span>}
      </div>
    </div>
  )
}

export default function AthleticBenchmarks({pitcherId}:{pitcherId:string}){
  const supabase=createClient()
  const [latest,setLatest]=useState<any>(null)
  const [screenLatest,setScreenLatest]=useState<any>(null)
  const [loading,setLoading]=useState(true)
  const [showForm,setShowForm]=useState(false)
  const [form,setForm]=useState<FormState>(BLANK_FORM)
  const [screenForm,setScreenForm]=useState<ScreenFormState>(BLANK_SCREEN_FORM)
  const [saving,setSaving]=useState(false)

  const fetchLatest=useCallback(async()=>{
    setLoading(true)
    const [{data:bench},{data:screens}]=await Promise.all([
      supabase.from('athletic_benchmarks').select('*').eq('pitcher_id',pitcherId).order('test_date',{ascending:false}).limit(1),
      supabase.from('mobility_screens').select('*').eq('pitcher_id',pitcherId).order('test_date',{ascending:false}).limit(1),
    ])
    setLatest(bench?.[0]||null)
    setScreenLatest(screens?.[0]||null)
    setLoading(false)
  },[pitcherId])

  useEffect(()=>{fetchLatest()},[fetchLatest])

  const submit=async()=>{
    setSaving(true)
    const num=(s:string)=>s.trim()===''?null:parseFloat(s)
    const squat=num(form.squat_lbs),bench=num(form.bench_lbs),deadlift=num(form.deadlift_lbs)
    const total=(squat!=null&&bench!=null&&deadlift!=null)?squat+bench+deadlift:null
    await supabase.from('athletic_benchmarks').insert({
      pitcher_id:pitcherId,test_date:form.date,
      broad_jump_in:num(form.broad_jump_in),lateral_broad_jump_lr_in:num(form.lateral_broad_jump_lr_in),
      sprint_10yd_sec:num(form.sprint_10yd_sec),
      squat_lbs:squat,bench_lbs:bench,deadlift_lbs:deadlift,total_body_strength_lbs:total,
      shoulder_er_ir_lbs:num(form.shoulder_er_ir_lbs),
      vertical_jump_in:num(form.vertical_jump_in),vertical_jump_225_in:num(form.vertical_jump_225_in),
      grip_strength_right_lbs:num(form.grip_strength_right_lbs),grip_strength_left_lbs:num(form.grip_strength_left_lbs),
      wingspan_in:num(form.wingspan_in),
      hip_rotation_trail_deg:num(form.hip_rotation_trail_deg),hip_rotation_lead_deg:num(form.hip_rotation_lead_deg),
      shoulder_rotation_deg:num(form.shoulder_rotation_deg),
      mb_seated_chest_pass_ft:num(form.mb_seated_chest_pass_ft),mb_situp_throw_ft:num(form.mb_situp_throw_ft),
      mb_rotational_pass_ft:num(form.mb_rotational_pass_ft),
    })
    const anyScreenFilled=MOBILITY_SCREENS.some(s=>screenForm[s.key])
    if (anyScreenFilled){
      const screenRow:any={pitcher_id:pitcherId,test_date:form.date}
      MOBILITY_SCREENS.forEach(s=>{screenRow[s.key]=screenForm[s.key]||null})
      await supabase.from('mobility_screens').insert(screenRow)
    }
    await fetchLatest()
    setSaving(false);setShowForm(false)
    setForm({...BLANK_FORM,date:new Date().toISOString().split('T')[0]})
    setScreenForm(BLANK_SCREEN_FORM)
  }

  const numField=(key:keyof FormState,label:string,placeholder:string)=>(
    <div key={key}>
      <label style={lbl}>{label}</label>
      <input type="text" inputMode="decimal" style={inp} placeholder={placeholder} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}/>
    </div>
  )

  const screenField=(s:{key:string,label:string})=>(
    <div key={s.key}>
      <label style={lbl}>{s.label}</label>
      <select style={inp} value={screenForm[s.key]} onChange={e=>setScreenForm(f=>({...f,[s.key]:e.target.value as ScreenStatus|''}))}>
        <option value="">— Not screened —</option>
        <option value="Pass">Pass</option>
        <option value="Limited">Limited</option>
        <option value="Fail">Fail</option>
      </select>
    </div>
  )

  if (loading) return <div style={{textAlign:'center' as const,padding:30,color:C.textMuted,fontSize:13}}>Loading benchmarks...</div>

  return (
    <div style={{color:C.text,fontSize:13}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
        <div style={{fontSize:16,fontWeight:700,color:C.gold}}>Athletic Benchmarks</div>
        <button onClick={()=>setShowForm(s=>!s)} style={{background:showForm?C.bg3:C.gold,color:showForm?C.textMuted:C.bg,border:`1px solid ${showForm?C.border:C.gold}`,borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:700,cursor:'pointer'}}>{showForm?'Cancel':'+ Log Assessment'}</button>
      </div>
      <div style={{fontSize:11,color:C.textMuted,marginBottom:16}}>Reference ranges from athletic testing data — white line = average, teal line = strong/elite level, purple line = MLB average.{latest&&<span> Showing most recent test: {latest.test_date}.</span>}</div>

      {showForm&&(
        <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8,padding:16,marginBottom:16}}>
          <label style={lbl}>Test Date</label>
          <input type="date" style={inp} value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/>
          {([1,2,3] as const).map(tier=>(
            <div key={tier} style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:C.gold,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:8}}>{TIER_INFO[tier].label}</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:10}}>
                {tier===1&&<>
                  {numField('broad_jump_in','Broad Jump (in)','e.g. 92')}
                  {numField('lateral_broad_jump_lr_in','Lateral Broad Jump L+R (in)','e.g. 150')}
                </>}
                {tier===2&&<>
                  {numField('sprint_10yd_sec','10-Yard Sprint (sec)','e.g. 1.72')}
                  {numField('squat_lbs','Squat (lbs)','e.g. 315')}
                  {numField('bench_lbs','Bench (lbs)','e.g. 225')}
                  {numField('deadlift_lbs','Deadlift (lbs)','e.g. 405')}
                  {numField('shoulder_er_ir_lbs','Shoulder ER/IR Strength (lbs)','e.g. 60')}
                  {numField('vertical_jump_in','Vertical Jump (in)','e.g. 25')}
                  {numField('vertical_jump_225_in','Vertical Jump @225 lbs (in)','e.g. 19')}
                  {numField('grip_strength_right_lbs','Grip Strength Right (lbs)','e.g. 100')}
                  {numField('grip_strength_left_lbs','Grip Strength Left (lbs)','e.g. 98')}
                  {numField('wingspan_in','Wingspan (in)','e.g. 71')}
                </>}
                {tier===3&&<>
                  {numField('hip_rotation_trail_deg','Hip Rotation — Trail Leg (°)','e.g. 65')}
                  {numField('hip_rotation_lead_deg','Hip Rotation — Lead Leg (°)','e.g. 63')}
                  {numField('shoulder_rotation_deg','Shoulder Total Rotation (°)','e.g. 145')}
                </>}
              </div>
            </div>
          ))}

          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:700,color:C.gold,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:8}}>Power Tests</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:10}}>
              {numField('mb_seated_chest_pass_ft','MB Seated Chest Pass (ft)','e.g. 16')}
              {numField('mb_situp_throw_ft','MB Sit-Up & Throw (ft)','e.g. 20')}
              {numField('mb_rotational_pass_ft','MB Rotational Pass (ft)','e.g. 30')}
            </div>
            <div style={{fontSize:10,color:C.textDim,marginTop:6}}>Vertical Jump for this section reuses the Vertical Jump value entered above under Tier 2 — no separate field.</div>
          </div>

          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:700,color:C.gold,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:8}}>Mobility / Stability Screens</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:10}}>
              {MOBILITY_SCREENS.map(s=>screenField(s))}
            </div>
          </div>

          <div style={{fontSize:10,color:C.textDim,marginBottom:10}}>Leave any field blank if not tested this session — Total Body Strength only calculates when Squat, Bench, and Deadlift are all filled in.</div>
          <button onClick={submit} disabled={saving} style={{background:C.gold,color:C.bg,border:'none',borderRadius:8,padding:'10px 16px',fontSize:13,fontWeight:700,cursor:'pointer'}}>{saving?'Saving...':'Save Assessment'}</button>
        </div>
      )}

      {([1,2,3] as const).map(tier=>(
        <div key={tier} style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8,padding:16,marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:C.gold,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:2}}>{TIER_INFO[tier].label}</div>
          <div style={{fontSize:11,color:C.textDim,marginBottom:14}}>{TIER_INFO[tier].desc}</div>
          {BENCHMARKS.filter(b=>b.tier===tier).map(def=>(
            <BenchmarkBar key={def.key} def={def} value={latest?.[def.key]}/>
          ))}
        </div>
      ))}

      <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8,padding:16,marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:700,color:C.gold,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:2}}>Power Tests</div>
        <div style={{fontSize:11,color:C.textDim,marginBottom:14}}>Tour / Good / Marginal / Deficit tiers — separate grading model from the percentile bars above, not part of the TopVelocity predictive-tier system.</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:10}}>
          {POWER_TESTS.map(def=>{
            const value=def.reuseKey?latest?.[def.reuseKey]:latest?.[def.key]
            return <PowerTestCard key={def.key} label={def.label} unit={def.unit} value={value} tier={powerTestTier(def,value)}/>
          })}
        </div>
      </div>

      <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8,padding:16,marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:700,color:C.gold,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:2}}>Mobility / Stability Screens</div>
        <div style={{fontSize:11,color:C.textDim,marginBottom:14}}>Pass/fail movement screens — qualitative, not scored against the numeric benchmarks above.{screenLatest&&<span> Showing most recent screen: {screenLatest.test_date}.</span>}</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:8}}>
          {MOBILITY_SCREENS.map(s=>(
            <ScreenBadge key={s.key} label={s.label} status={screenLatest?.[s.key]||null}/>
          ))}
        </div>
      </div>
    </div>
  )
}
