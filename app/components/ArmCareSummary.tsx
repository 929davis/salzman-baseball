'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getRecoveryModifier,
  calcStrengthVelocityRatio, calcBodyweightPct, bodyweightPctStatus,
  calcRomAsymmetry, computeArmCareTrends, THREE_TIER_COLORS,
} from '@/lib/armCare'
import { restDaysRequired, daysUntilClearToThrow, DAILY_MAX_PITCHES, PITCH_SMART_NOTES } from '@/lib/pitchSmart'
import { THROWERS_TEN, THROWERS_TEN_SETS, THROWERS_TEN_REPS } from '@/lib/throwersTen'
import { useTestVideos } from '@/lib/testVideos'
import TestVideoLink from '@/app/components/TestVideoLink'
import MiniSparkline from '@/app/components/MiniSparkline'

const C = {
  bg2:'#161b22',bg3:'#1c2333',border:'#30363d',
  gold:'#e8b84b',goldDim:'#a07c28',goldBg:'rgba(232,184,75,0.08)',
  text:'#e6edf3',textMuted:'#7d8590',textDim:'#484f58',white:'#ffffff',
}

export default function ArmCareSummary({pitcherId}:{pitcherId:string}){
  const supabase = createClient()
  const {videos, saveVideo} = useTestVideos()
  const [loading,setLoading] = useState(true)
  const [profile,setProfile] = useState<any>(null)
  const [armCareTests,setArmCareTests] = useState<any[]>([])
  const [cmjResults,setCmjResults] = useState<any[]>([])
  const [lastSession,setLastSession] = useState<any>(null)

  useEffect(()=>{
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const [{data:prof},{data:armCare},{data:cmj},{data:sessions}] = await Promise.all([
        supabase.from('profiles').select('weekly_pitches,weekly_high_effort,effort_tier,throw_surface,avg_velocity').eq('id',pitcherId).single(),
        supabase.from('arm_care_tests').select('*').eq('pitcher_id',pitcherId).order('created_at',{ascending:false}),
        supabase.from('cmj_results').select('estimated_velocity').eq('pitcher_id',pitcherId).order('test_date',{ascending:false}).limit(1),
        supabase.from('session_logs').select('log_date,pitch_count').eq('pitcher_id',pitcherId).not('pitch_count','is',null).order('log_date',{ascending:false}).limit(1),
      ])
      if (cancelled) return
      setProfile(prof||null)
      setArmCareTests(armCare||[])
      setCmjResults(cmj||[])
      setLastSession(sessions?.[0]||null)
      setLoading(false)
    }
    load()
    return ()=>{cancelled=true}
  },[pitcherId])

  if (loading) return <div style={{textAlign:'center' as const,padding:24,color:C.textMuted,fontSize:13}}>Loading arm care...</div>

  const effectiveVelocity = cmjResults[0]?.estimated_velocity || profile?.avg_velocity || null
  const recoveryModifier = getRecoveryModifier(armCareTests)
  const latestTest = armCareTests[0]||null
  const daysOwed = lastSession ? daysUntilClearToThrow(lastSession.pitch_count, lastSession.log_date) : 0
  const requiredRest = lastSession ? restDaysRequired(lastSession.pitch_count) : 0
  const svr = latestTest ? calcStrengthVelocityRatio(latestTest.er_load_lbs, latestTest.ir_load_lbs, effectiveVelocity) : null
  const erPct = latestTest ? calcBodyweightPct(latestTest.er_load_lbs, latestTest.bodyweight_lbs) : null
  const irPct = latestTest ? calcBodyweightPct(latestTest.ir_load_lbs, latestTest.bodyweight_lbs) : null
  const romAsym = latestTest ? calcRomAsymmetry(latestTest.er_rom_deg, latestTest.ir_rom_deg) : null
  const trends = computeArmCareTrends(armCareTests, effectiveVelocity)

  return (
    <div style={{color:C.text,fontSize:13}}>
      <div style={{fontSize:16,fontWeight:700,color:C.gold,marginBottom:4}}>Arm Care</div>
      <div style={{fontSize:11,color:C.textMuted,marginBottom:16}}>Rest guidance from your last logged outing, plus your latest arm-care test results.</div>

      <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8,padding:16,marginBottom:12}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
          <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 14px'}}>
            <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4}}>Last Outing</div>
            <div style={{fontSize:18,fontWeight:700,color:C.white}}>{lastSession?`${lastSession.pitch_count} pitches`:'—'}<span style={{fontSize:10,color:C.textDim,fontWeight:400}}> / {DAILY_MAX_PITCHES} max</span></div>
            {lastSession&&<div style={{fontSize:10,color:C.textDim,marginTop:2}}>{new Date(lastSession.log_date+'T00:00:00').toLocaleDateString()}</div>}
          </div>
          <div style={{background:daysOwed>0?C.goldBg:C.bg3,border:`1px solid ${daysOwed>0?C.goldDim:C.border}`,borderRadius:8,padding:'10px 14px'}}>
            <div style={{fontSize:10,color:daysOwed>0?C.gold:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4}}>Rest Status</div>
            <div style={{fontSize:18,fontWeight:700,color:daysOwed>0?C.gold:C.white}}>{!lastSession?'—':daysOwed>0?`${daysOwed} day${daysOwed===1?'':'s'} left`:'Clear to throw'}</div>
          </div>
        </div>

        <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 12px',marginBottom:latestTest?12:0}}>
          <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:6}}>What does this mean?</div>
          <div style={{fontSize:11,color:C.textMuted,lineHeight:1.6}}>
            Based on Pitch Smart (MLB/USA Baseball, developed with ASMI research): {lastSession?`your last outing was ${lastSession.pitch_count} pitches, which calls for ${requiredRest} day${requiredRest===1?'':'s'} of rest before pitching again.`:'log a session with a pitch count to see your rest guidance.'} Pitch Smart also recommends never pitching in a game on 3 consecutive days regardless of count, and at least 3 months off from competitive pitching per year (including 4 continuous weeks of no throwing at all). This is workload guidance, not a medical diagnosis — always combine it with how your arm actually feels.
          </div>
        </div>

        {latestTest && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:8,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
            <div>
              <div style={{fontSize:9,color:C.textMuted,textTransform:'uppercase' as const,marginBottom:3}}>Strength-Velocity Ratio</div>
              <div style={{fontSize:13,fontWeight:700,color:svr?(svr.flagged?THREE_TIER_COLORS.Flag:THREE_TIER_COLORS.OK):C.textDim}}>{svr?`${svr.ratio.toFixed(2)} ${svr.flagged?'(Flag <0.35)':''}`:'—'}</div>
              <TestVideoLink testKey="arm_care_svr" videos={videos} onSave={saveVideo}/>
            </div>
            <div>
              <div style={{fontSize:9,color:C.textMuted,textTransform:'uppercase' as const,marginBottom:3}}>Outward (ER) Strength</div>
              <div style={{fontSize:13,fontWeight:700,color:erPct!=null?THREE_TIER_COLORS[bodyweightPctStatus(erPct,'ER')||'OK']:C.textDim}}>{erPct!=null?`${erPct.toFixed(0)}% bodyweight`:'—'}</div>
              <TestVideoLink testKey="arm_care_er_load" videos={videos} onSave={saveVideo}/>
            </div>
            <div>
              <div style={{fontSize:9,color:C.textMuted,textTransform:'uppercase' as const,marginBottom:3}}>Inward (IR) Strength</div>
              <div style={{fontSize:13,fontWeight:700,color:irPct!=null?THREE_TIER_COLORS[bodyweightPctStatus(irPct,'IR')||'OK']:C.textDim}}>{irPct!=null?`${irPct.toFixed(0)}% bodyweight`:'—'}</div>
              <TestVideoLink testKey="arm_care_ir_load" videos={videos} onSave={saveVideo}/>
            </div>
            <div>
              <div style={{fontSize:9,color:C.textMuted,textTransform:'uppercase' as const,marginBottom:3}}>Range-of-Motion Balance</div>
              <div style={{fontSize:13,fontWeight:700,color:romAsym?THREE_TIER_COLORS[romAsym.status]:C.textDim}}>{romAsym?`${romAsym.pctDiff.toFixed(0)}% (${romAsym.status})`:'—'}</div>
              <TestVideoLink testKey="arm_care_rom" videos={videos} onSave={saveVideo}/>
            </div>
          </div>
        )}
        {!latestTest && (
          <div style={{fontSize:11,color:C.textDim,paddingTop:latestTest?0:0}}>No arm care test on file yet — your coach administers this with dumbbells and a stopwatch.</div>
        )}
      </div>

      {armCareTests.length>1 && (
        <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8,padding:16}}>
          <div style={{fontSize:11,color:C.textMuted,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'1px',marginBottom:12}}>Arm Care Trends</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10}}>
            {[
              {label:'Strength-Velocity Ratio', hist:trends.svr, color:C.gold, unit:''},
              {label:'Outward (ER) Strength', hist:trends.erPct, color:'#58a6ff', unit:'%'},
              {label:'Inward (IR) Strength', hist:trends.irPct, color:'#a371f7', unit:'%'},
              {label:'ROM Balance', hist:trends.romAsym, color:'#f85149', unit:'%'},
            ].map(m=>(
              <div key={m.label}>
                <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4}}>{m.label}</div>
                {m.hist.length>1?<MiniSparkline data={m.hist} color={m.color} unit={m.unit} height={70}/>:<div style={{fontSize:11,color:C.textDim,padding:'20px 0',textAlign:'center' as const}}>Not enough data</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8,padding:16,marginTop:12}}>
        <div style={{fontSize:11,color:C.textMuted,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'1px',marginBottom:4}}>Thrower's Ten</div>
        <div style={{fontSize:11,color:C.textDim,marginBottom:12,lineHeight:1.6}}>A rotator cuff/scapular strengthening program (Wilk et al.) built specifically for throwing athletes, backed by EMG research on which exercises actually load these muscles through the throwing-relevant range. Standard dose: {THROWERS_TEN_SETS} sets of {THROWERS_TEN_REPS} reps each, band or light dumbbell, minimal rest between exercises.</div>
        <div style={{display:'flex',flexDirection:'column' as const,gap:8}}>
          {THROWERS_TEN.map(ex=>(
            <div key={ex.key} style={{background:C.bg3,borderRadius:6,padding:'8px 12px'}}>
              <div style={{display:'flex',gap:8,alignItems:'baseline',marginBottom:2}}>
                <span style={{fontSize:10,color:C.gold,fontWeight:700}}>{ex.order}.</span>
                <span style={{fontSize:12,fontWeight:600,color:C.white}}>{ex.name}</span>
              </div>
              <div style={{fontSize:11,color:C.textMuted,lineHeight:1.5}}>{ex.description}</div>
              <div style={{fontSize:10,color:C.textDim,marginTop:2}}>Targets: {ex.targets}</div>
            </div>
          ))}
        </div>
        <div style={{fontSize:10,color:C.textDim,marginTop:10,lineHeight:1.5}}>
          {PITCH_SMART_NOTES.map((n,i)=><div key={i}>• {n}</div>)}
        </div>
      </div>
    </div>
  )
}
