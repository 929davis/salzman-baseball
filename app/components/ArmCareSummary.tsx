'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  calcArmCare, getEffectiveThrowCount, getRecoveryModifier,
  calcStrengthVelocityRatio, calcBodyweightPct, bodyweightPctStatus,
  calcRomAsymmetry, THREE_TIER_COLORS,
} from '@/lib/armCare'
import { useTestVideos } from '@/lib/testVideos'
import TestVideoLink from '@/app/components/TestVideoLink'

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
  const [throwEntries,setThrowEntries] = useState<any[]>([])
  const [armCareTests,setArmCareTests] = useState<any[]>([])
  const [cmjResults,setCmjResults] = useState<any[]>([])

  useEffect(()=>{
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const [{data:prof},{data:throws},{data:armCare},{data:cmj}] = await Promise.all([
        supabase.from('profiles').select('weekly_pitches,weekly_high_effort,effort_tier,throw_surface,avg_velocity').eq('id',pitcherId).single(),
        supabase.from('throw_volume_entries').select('*').eq('pitcher_id',pitcherId).order('created_at'),
        supabase.from('arm_care_tests').select('*').eq('pitcher_id',pitcherId).order('created_at',{ascending:false}),
        supabase.from('cmj_results').select('estimated_velocity').eq('pitcher_id',pitcherId).order('test_date',{ascending:false}).limit(1),
      ])
      if (cancelled) return
      setProfile(prof||null)
      setThrowEntries(throws||[])
      setArmCareTests(armCare||[])
      setCmjResults(cmj||[])
      setLoading(false)
    }
    load()
    return ()=>{cancelled=true}
  },[pitcherId])

  if (loading) return <div style={{textAlign:'center' as const,padding:24,color:C.textMuted,fontSize:13}}>Loading arm care...</div>

  const effectiveVelocity = cmjResults[0]?.estimated_velocity || profile?.avg_velocity || null
  const recoveryModifier = getRecoveryModifier(armCareTests)
  const {strengthDepletionLbs, footPoundsTarget, adjustedFootPoundsTarget} = calcArmCare(getEffectiveThrowCount(profile,throwEntries), recoveryModifier)
  const latestTest = armCareTests[0]||null
  const svr = latestTest ? calcStrengthVelocityRatio(latestTest.er_load_lbs, latestTest.ir_load_lbs, effectiveVelocity) : null
  const erPct = latestTest ? calcBodyweightPct(latestTest.er_load_lbs, latestTest.bodyweight_lbs) : null
  const irPct = latestTest ? calcBodyweightPct(latestTest.ir_load_lbs, latestTest.bodyweight_lbs) : null
  const romAsym = latestTest ? calcRomAsymmetry(latestTest.er_rom_deg, latestTest.ir_rom_deg) : null

  return (
    <div style={{color:C.text,fontSize:13}}>
      <div style={{fontSize:16,fontWeight:700,color:C.gold,marginBottom:4}}>Arm Care Score</div>
      <div style={{fontSize:11,color:C.textMuted,marginBottom:16}}>How much throwing load your arm is estimated to need to recover from, based on your recent throwing volume.</div>

      <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8,padding:16,marginBottom:12}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:12}}>
          <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 14px'}}>
            <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4}}>Strength Depletion</div>
            <div style={{fontSize:18,fontWeight:700,color:C.white}}>{strengthDepletionLbs?strengthDepletionLbs.toFixed(2):'—'}<span style={{fontSize:11,color:C.textMuted}}> lbs</span></div>
          </div>
          <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 14px'}}>
            <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4}}>Recovery Target</div>
            <div style={{fontSize:18,fontWeight:700,color:C.white}}>{footPoundsTarget?footPoundsTarget.toLocaleString():'—'}<span style={{fontSize:11,color:C.textMuted}}> ft·lb</span></div>
          </div>
          <div style={{background:C.goldBg,border:`1px solid ${C.goldDim}`,borderRadius:8,padding:'10px 14px'}}>
            <div style={{fontSize:10,color:C.gold,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4}}>Your Target Today</div>
            <div style={{fontSize:18,fontWeight:700,color:C.gold}}>{adjustedFootPoundsTarget?adjustedFootPoundsTarget.toLocaleString():'—'}<span style={{fontSize:11,color:C.goldDim}}> ft·lb</span></div>
          </div>
        </div>

        <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 12px',marginBottom:latestTest?12:0}}>
          <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:6}}>What does this mean?</div>
          <div style={{fontSize:11,color:C.textMuted,lineHeight:1.6}}>
            The more you've been throwing, the more your arm's strength has been "spent" — that's <b>Strength Depletion</b>. <b>Recovery Target</b> turns that into an estimate of how much recovery work (band work, mobility, light strength) your arm needs to bounce back. <b>Your Target Today</b> is that same number, adjusted down if your last recovery-check test showed you hadn't fully bounced back from a prior outing yet{recoveryModifier<1?` (currently ×${recoveryModifier.toFixed(2)}, since your last recovery check wasn't back to full)`:' (currently no adjustment — your last recovery check was back to full, or you haven\'t logged one yet)'}. These numbers are a starting model, not a medical diagnosis — always combine them with how your arm actually feels.
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
    </div>
  )
}
