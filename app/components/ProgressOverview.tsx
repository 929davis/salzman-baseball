'use client'
import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { BENCHMARKS, POWER_TESTS, benchmarkStatus, powerTestTier } from '@/lib/benchmarks'
import { calcStrengthVelocityRatio, calcBodyweightPct, bodyweightPctStatus, calcRomAsymmetry, THREE_TIER_COLORS } from '@/lib/armCare'

const C = {
  bg:'#0d1117',bg2:'#161b22',bg3:'#1c2333',border:'#30363d',
  gold:'#e8b84b',goldDim:'#a07c28',
  teal:'#39d353',red:'#f85149',blue:'#58a6ff',purple:'#a371f7',
  text:'#e6edf3',textMuted:'#7d8590',textDim:'#484f58',white:'#ffffff',
}

type Severity = 'Caution' | 'Flag'
const SEVERITY_COLORS: Record<Severity,string> = {Caution:THREE_TIER_COLORS.Caution, Flag:THREE_TIER_COLORS.Flag}

type FlaggedMetric = {
  key: string, label: string, unit: string, severity: Severity,
  history: {date:string, value:number}[],
}

// Athlete-facing relabeling for the handful of coach/scout-jargon metric names —
// everything else (e.g. "Broad Jump", "Vertical Jump") is already plain enough as-is.
const ATHLETE_LABELS: Record<string,string> = {
  shoulder_er_ir_lbs: 'Shoulder Rotation Strength',
  hip_rotation_trail_deg: 'Hip Rotation (Back Leg)',
  hip_rotation_lead_deg: 'Hip Rotation (Front Leg)',
  shoulder_rotation_deg: 'Shoulder Rotation',
  svr: 'Arm Strength Balance',
  er_pct: 'Shoulder Strength — Outward',
  ir_pct: 'Shoulder Strength — Inward',
  rom_asym: 'Shoulder Range-of-Motion Balance',
}

export default function ProgressOverview({pitcherId, mode}:{pitcherId:string, mode:'coach'|'athlete'}){
  const supabase = createClient()
  const [loading,setLoading] = useState(true)
  const [cmjHistory,setCmjHistory] = useState<any[]>([])
  const [sessionHistory,setSessionHistory] = useState<any[]>([])
  const [benchHistory,setBenchHistory] = useState<any[]>([])
  const [armCareHistory,setArmCareHistory] = useState<any[]>([])
  const [avgVelocity,setAvgVelocity] = useState<number|null>(null)

  useEffect(()=>{
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const [{data:cmj},{data:sessions},{data:bench},{data:armCare},{data:prof}] = await Promise.all([
        supabase.from('cmj_results').select('test_date,estimated_velocity').eq('pitcher_id',pitcherId).order('test_date',{ascending:true}),
        supabase.from('session_logs').select('log_date,velocity').eq('pitcher_id',pitcherId).order('log_date',{ascending:true}),
        supabase.from('athletic_benchmarks').select('*').eq('pitcher_id',pitcherId).order('test_date',{ascending:true}),
        supabase.from('arm_care_tests').select('*').eq('pitcher_id',pitcherId).order('created_at',{ascending:true}),
        supabase.from('profiles').select('avg_velocity').eq('id',pitcherId).single(),
      ])
      if (cancelled) return
      setCmjHistory(cmj||[])
      setSessionHistory(sessions||[])
      setBenchHistory(bench||[])
      setArmCareHistory(armCare||[])
      setAvgVelocity(prof?.avg_velocity??null)
      setLoading(false)
    }
    load()
    return ()=>{cancelled=true}
  },[pitcherId])

  if (loading) return <div style={{textAlign:'center' as const,padding:24,color:C.textMuted,fontSize:13}}>Loading progress...</div>

  // Merge CMJ-predicted ceiling and actual session velocity onto a shared date axis.
  type VelocityRow = {date:string,actualVelocity?:number,predictedVelocity?:number}
  const velocityMap = new Map<string,VelocityRow>()
  sessionHistory.forEach(s=>{
    if (s.velocity==null) return
    const row: VelocityRow = velocityMap.get(s.log_date)||{date:s.log_date}
    row.actualVelocity = s.velocity
    velocityMap.set(s.log_date,row)
  })
  cmjHistory.forEach(c=>{
    if (c.estimated_velocity==null) return
    const row: VelocityRow = velocityMap.get(c.test_date)||{date:c.test_date}
    row.predictedVelocity = Math.round(c.estimated_velocity*10)/10
    velocityMap.set(c.test_date,row)
  })
  const velocityData = Array.from(velocityMap.values()).sort((a,b)=>a.date.localeCompare(b.date))
  const hasVelocityData = velocityData.length>0

  // Matches getEffectiveVelocity's definition elsewhere: latest CMJ prediction, else the
  // coach-entered profile average — kept consistent so SVR reads the same in both places.
  const effectiveVelocity = cmjHistory[cmjHistory.length-1]?.estimated_velocity || avgVelocity || null

  const latestBench = benchHistory[benchHistory.length-1]||null
  const latestArmCare = armCareHistory[armCareHistory.length-1]||null

  const flagged: FlaggedMetric[] = []

  BENCHMARKS.forEach(def=>{
    const status = benchmarkStatus(def, latestBench?.[def.key])
    if (status?.label!=='Below average') return
    const history = benchHistory.map(r=>({date:r.test_date,value:r[def.key]})).filter(h=>h.value!=null)
    if (!history.length) return
    flagged.push({key:def.key, label: mode==='athlete'?(ATHLETE_LABELS[def.key]||def.label):def.label, unit:def.unit, severity:'Flag', history})
  })

  POWER_TESTS.forEach(def=>{
    const value = def.reuseKey ? latestBench?.[def.reuseKey] : latestBench?.[def.key]
    const tier = powerTestTier(def,value)
    if (tier!=='Marginal' && tier!=='Deficit') return
    const history = benchHistory.map(r=>({date:r.test_date, value: def.reuseKey?r[def.reuseKey]:r[def.key]})).filter(h=>h.value!=null)
    if (!history.length) return
    flagged.push({key:def.key, label:def.label, unit:def.unit, severity: tier==='Deficit'?'Flag':'Caution', history})
  })

  if (latestArmCare){
    const svr = calcStrengthVelocityRatio(latestArmCare.er_load_lbs, latestArmCare.ir_load_lbs, effectiveVelocity)
    if (svr?.flagged){
      const history = armCareHistory.map(r=>{
        const s = calcStrengthVelocityRatio(r.er_load_lbs, r.ir_load_lbs, effectiveVelocity)
        return s ? {date:r.created_at, value:Math.round(s.ratio*100)/100} : null
      }).filter((h):h is {date:string,value:number}=>h!=null)
      if (history.length) flagged.push({key:'svr', label: mode==='athlete'?ATHLETE_LABELS.svr:'Strength-Velocity Ratio', unit:'', severity:'Flag', history})
    }

    const erPct = calcBodyweightPct(latestArmCare.er_load_lbs, latestArmCare.bodyweight_lbs)
    const erStatus = bodyweightPctStatus(erPct,'ER')
    if (erStatus==='Caution' || erStatus==='Flag'){
      const history = armCareHistory.map(r=>{
        const v = calcBodyweightPct(r.er_load_lbs, r.bodyweight_lbs)
        return v!=null ? {date:r.created_at, value:Math.round(v)} : null
      }).filter((h):h is {date:string,value:number}=>h!=null)
      if (history.length) flagged.push({key:'er_pct', label: mode==='athlete'?ATHLETE_LABELS.er_pct:'ER % Bodyweight', unit:'%', severity:erStatus, history})
    }

    const irPct = calcBodyweightPct(latestArmCare.ir_load_lbs, latestArmCare.bodyweight_lbs)
    const irStatus = bodyweightPctStatus(irPct,'IR')
    if (irStatus==='Caution' || irStatus==='Flag'){
      const history = armCareHistory.map(r=>{
        const v = calcBodyweightPct(r.ir_load_lbs, r.bodyweight_lbs)
        return v!=null ? {date:r.created_at, value:Math.round(v)} : null
      }).filter((h):h is {date:string,value:number}=>h!=null)
      if (history.length) flagged.push({key:'ir_pct', label: mode==='athlete'?ATHLETE_LABELS.ir_pct:'IR % Bodyweight', unit:'%', severity:irStatus, history})
    }

    const romAsym = calcRomAsymmetry(latestArmCare.er_rom_deg, latestArmCare.ir_rom_deg)
    if (romAsym && (romAsym.status==='Caution' || romAsym.status==='Flag')){
      const history = armCareHistory.map(r=>{
        const a = calcRomAsymmetry(r.er_rom_deg, r.ir_rom_deg)
        return a ? {date:r.created_at, value:Math.round(a.pctDiff)} : null
      }).filter((h):h is {date:string,value:number}=>h!=null)
      if (history.length) flagged.push({key:'rom_asym', label: mode==='athlete'?ATHLETE_LABELS.rom_asym:'ROM Asymmetry (ER vs IR)', unit:'%', severity:romAsym.status, history})
    }
  }

  const topFlagged = flagged.sort((a,b)=>(a.severity==='Flag'?0:1)-(b.severity==='Flag'?0:1)).slice(0,3)

  return (
    <div style={{marginBottom:20}}>
      <div style={{fontSize:16,fontWeight:700,color:C.gold,marginBottom:4}}>{mode==='athlete'?'Your Progress':'Progress Overview'}</div>
      <div style={{fontSize:11,color:C.textMuted,marginBottom:14}}>
        {mode==='athlete'?'How your velocity compares to your jump-test ceiling over time.':'Actual velocity vs. CMJ-predicted velocity ceiling over time.'}
      </div>
      <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8,padding:16,marginBottom:topFlagged.length?12:0}}>
        {hasVelocityData?(
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={velocityData} margin={{top:5,right:20,left:0,bottom:5}}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="date" tick={{fill:C.textMuted,fontSize:10}}/>
              <YAxis tick={{fill:C.textMuted,fontSize:10}} unit=" mph" domain={['auto','auto']}/>
              <Tooltip contentStyle={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:6,fontSize:12}} labelStyle={{color:C.text}}/>
              <Legend wrapperStyle={{fontSize:11}}/>
              <Line type="monotone" dataKey="actualVelocity" name={mode==='athlete'?'Your Velocity':'Actual Velocity'} stroke={C.blue} connectNulls dot={{r:3}}/>
              <Line type="monotone" dataKey="predictedVelocity" name={mode==='athlete'?'Velocity Ceiling (Jump Test)':'CMJ-Predicted Ceiling'} stroke={C.gold} strokeDasharray="4 3" connectNulls dot={{r:3}}/>
            </LineChart>
          </ResponsiveContainer>
        ):(
          <div style={{textAlign:'center' as const,padding:30,color:C.textDim,fontSize:12}}>No velocity or CMJ data logged yet.</div>
        )}
      </div>

      {topFlagged.length>0 && (
        <div>
          <div style={{fontSize:11,color:C.textMuted,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:8}}>
            {mode==='athlete'?'Worth Keeping An Eye On':'Areas to Watch'}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:10}}>
            {topFlagged.map(m=>(
              <div key={m.key} style={{background:C.bg2,border:`1px solid ${SEVERITY_COLORS[m.severity]}66`,borderRadius:8,padding:12}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                  <span style={{fontSize:11,fontWeight:600,color:C.text}}>{m.label}</span>
                  <span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:10,textTransform:'uppercase' as const,letterSpacing:'0.4px',background:`${SEVERITY_COLORS[m.severity]}26`,color:SEVERITY_COLORS[m.severity],border:`1px solid ${SEVERITY_COLORS[m.severity]}66`}}>{m.severity}</span>
                </div>
                <ResponsiveContainer width="100%" height={80}>
                  <LineChart data={m.history} margin={{top:2,right:4,left:0,bottom:0}}>
                    <XAxis dataKey="date" hide/>
                    <YAxis hide domain={['auto','auto']}/>
                    <Tooltip contentStyle={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:6,fontSize:11}} formatter={(v:any)=>[`${v}${m.unit}`,'']}/>
                    <Line type="monotone" dataKey="value" stroke={SEVERITY_COLORS[m.severity]} dot={{r:2}} strokeWidth={2}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
