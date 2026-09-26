'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { gateLabel, stageLabel, tierLabel } from '@/lib/plainLanguage'

const C = {
  bg:'#0d1117',bg2:'#161b22',bg3:'#1c2333',border:'#30363d',
  gold:'#e8b84b',goldDim:'#a07c28',goldBg:'rgba(232,184,75,0.08)',
  teal:'#39d353',red:'#f85149',blue:'#58a6ff',
  text:'#e6edf3',textMuted:'#7d8590',textDim:'#484f58',white:'#ffffff',
}

const card:React.CSSProperties = {background:C.bg2,border:`1px solid ${C.border}`,borderRadius:10,padding:'14px 16px',marginBottom:12}
const inp:React.CSSProperties = {width:'100%',background:C.bg3,border:`1px solid ${C.border}`,borderRadius:6,padding:'7px 10px',fontSize:13,color:C.text,outline:'none',boxSizing:'border-box' as const}
const lbl:React.CSSProperties = {fontSize:10,color:C.textMuted,fontWeight:600,marginBottom:4,textTransform:'uppercase' as const,letterSpacing:'0.5px',display:'block'}

const TRAINING_STATUS_OPTIONS = ['beginner','intermediate','advanced']
const EQUIPMENT_TIER_OPTIONS = ['E1','E2','E3']
const THROWING_STATUS_OPTIONS = ['building','developing','competing','restricted']
const SEASON_PHASE_OPTIONS = ['transition','general_prep','specific_prep','first_transition','competitive']
const SEASON_ROLE_OPTIONS = ['starter','reliever']
const GATE_OPTIONS = ['G1','G2','G3','G4','T1','T2','T3','T4']
const ACTIVE_CHANGE_STAGES = [1,2,3,4]

type AthleteState = {
  pitcher_id: string
  training_status: string | null
  equipment_tier: string | null
  throwing_status: string | null
  season_phase: string | null
  season_role: string | null
  gates_passed: string[]
  active_change: string | null
  active_change_stage: number | null
  updated_at: string | null
}

const blank = (pitcherId:string):AthleteState => ({
  pitcher_id:pitcherId, training_status:null, equipment_tier:null, throwing_status:null,
  season_phase:null, season_role:null,
  gates_passed:[], active_change:null, active_change_stage:null, updated_at:null,
})

function Field({label,children}:{label:string,children:React.ReactNode}){
  return <div><label style={lbl}>{label}</label>{children}</div>
}

function Select({value,onChange,options,placeholder,labelFor}:{value:string|null,onChange:(v:string|null)=>void,options:string[],placeholder:string,labelFor?:(v:string)=>string}){
  return (
    <select style={inp} value={value||''} onChange={e=>onChange(e.target.value||null)}>
      <option value="">{placeholder}</option>
      {options.map(o=><option key={o} value={o}>{labelFor?labelFor(o):o}</option>)}
    </select>
  )
}

export default function AthleteStatePanel({pitcherId}:{pitcherId:string}){
  const supabase = createClient()
  const [state,setState] = useState<AthleteState|null>(null)
  const [loading,setLoading] = useState(true)
  const [saving,setSaving] = useState(false)
  const [saved,setSaved] = useState(false)
  const [expanded,setExpanded] = useState(false)

  useEffect(()=>{
    let cancelled=false
    setLoading(true)
    setExpanded(false)
    supabase.from('athlete_state').select('*').eq('pitcher_id',pitcherId).maybeSingle().then(({data,error})=>{
      if (cancelled) return
      if (error) console.error('AthleteStatePanel: failed to load',error)
      setState(data ? {...data, gates_passed:data.gates_passed||[]} as AthleteState : blank(pitcherId))
      setLoading(false)
    })
    return ()=>{cancelled=true}
  },[pitcherId])

  const update = (patch:Partial<AthleteState>) => setState(prev=>prev?{...prev,...patch}:prev)

  const toggleGate = (gate:string) => {
    if (!state) return
    const has = state.gates_passed.includes(gate)
    update({gates_passed: has ? state.gates_passed.filter(g=>g!==gate) : [...state.gates_passed,gate]})
  }

  const save = async () => {
    if (!state) return
    setSaving(true)
    const {error} = await supabase.from('athlete_state').upsert({...state,updated_at:new Date().toISOString()},{onConflict:'pitcher_id'})
    setSaving(false)
    if (error) { alert('Save failed: '+error.message); return }
    setState(prev=>prev?{...prev,updated_at:new Date().toISOString()}:prev)
    setSaved(true); setTimeout(()=>setSaved(false),2000)
  }

  if (loading || !state) return <div style={{...card,fontSize:12,color:C.textMuted}}>Loading athlete state...</div>

  const summaryBadges = [state.training_status,state.season_phase,state.throwing_status,state.season_role].filter(Boolean)

  return (
    <div style={card}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}} onClick={()=>setExpanded(s=>!s)}>
        <div style={{fontSize:12,fontWeight:700,color:C.white,textTransform:'uppercase' as const,letterSpacing:'0.5px'}}>{expanded?'▾':'▸'} Athlete State</div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap' as const}}>
          {summaryBadges.length===0&&<span style={{fontSize:11,color:C.textDim}}>Not set</span>}
          {summaryBadges.map(b=>(
            <span key={b} style={{fontSize:10,color:C.textMuted,background:C.bg3,border:`1px solid ${C.border}`,borderRadius:10,padding:'2px 8px'}}>{b}</span>
          ))}
          {state.gates_passed.length>0&&<span style={{fontSize:10,color:C.teal,background:'rgba(57,211,83,0.08)',border:'1px solid rgba(57,211,83,0.3)',borderRadius:10,padding:'2px 8px'}}>{state.gates_passed.length} gate{state.gates_passed.length!==1?'s':''}</span>}
          {state.active_change&&<span style={{fontSize:10,color:C.gold,background:C.goldBg,border:`1px solid ${C.goldDim}`,borderRadius:10,padding:'2px 8px'}}>Active change: {state.active_change_stage!=null?stageLabel(state.active_change_stage).plain:'stage ?'} {state.active_change_stage!=null&&<span style={{opacity:0.6}}>({state.active_change_stage})</span>}</span>}
        </div>
      </div>

      {expanded && (
        <div style={{marginTop:14,display:'flex',flexDirection:'column',gap:12}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:10}}>
            <Field label="Training Status"><Select value={state.training_status} onChange={v=>update({training_status:v})} options={TRAINING_STATUS_OPTIONS} placeholder="—"/></Field>
            <Field label="Equipment Tier"><Select value={state.equipment_tier} onChange={v=>update({equipment_tier:v})} options={EQUIPMENT_TIER_OPTIONS} placeholder="—" labelFor={v=>`${tierLabel(v).plain} (${v})`}/></Field>
            <Field label="Throwing Status"><Select value={state.throwing_status} onChange={v=>update({throwing_status:v})} options={THROWING_STATUS_OPTIONS} placeholder="—"/></Field>
            <Field label="Season Phase"><Select value={state.season_phase} onChange={v=>update({season_phase:v})} options={SEASON_PHASE_OPTIONS} placeholder="—"/></Field>
            <Field label="Season Role"><Select value={state.season_role} onChange={v=>update({season_role:v})} options={SEASON_ROLE_OPTIONS} placeholder="—"/></Field>
          </div>

          <div>
            <label style={lbl}>Gates Passed</label>
            <div style={{display:'flex',gap:6,flexWrap:'wrap' as const}}>
              {GATE_OPTIONS.map(g=>{
                const active = state.gates_passed.includes(g)
                const {plain} = gateLabel(g)
                return (
                  <button key={g} onClick={()=>toggleGate(g)} title={g} style={{
                    fontSize:11,fontWeight:700,padding:'5px 10px',borderRadius:6,cursor:'pointer',
                    background:active?C.goldBg:C.bg3,color:active?C.gold:C.textMuted,
                    border:`1px solid ${active?C.goldDim:C.border}`,
                    display:'flex',flexDirection:'column',alignItems:'center',gap:1,
                  }}>
                    <span>{plain}</span>
                    <span style={{fontSize:9,fontWeight:400,opacity:0.6}}>{g}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 140px',gap:10}}>
            <Field label="Active Mechanical Change">
              <input type="text" style={inp} placeholder="e.g. Shortening arm path" value={state.active_change||''} onChange={e=>update({active_change:e.target.value||null})}/>
            </Field>
            <Field label="Stage">
              <select style={inp} value={state.active_change_stage??''} onChange={e=>update({active_change_stage:e.target.value?parseInt(e.target.value,10):null})}>
                <option value="">—</option>
                {ACTIVE_CHANGE_STAGES.map(s=><option key={s} value={s}>{stageLabel(s).plain} ({s})</option>)}
              </select>
            </Field>
          </div>

          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <button onClick={save} disabled={saving} style={{background:C.gold,color:C.bg,border:`1px solid ${C.gold}`,borderRadius:6,padding:'7px 16px',fontSize:12,fontWeight:700,cursor:saving?'not-allowed':'pointer'}}>{saving?'Saving...':'Save'}</button>
            {saved && <span style={{color:C.teal,fontSize:12,fontWeight:600}}>Saved</span>}
            {state.updated_at && <span style={{fontSize:11,color:C.textDim,marginLeft:'auto'}}>Updated {new Date(state.updated_at).toLocaleDateString()}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
