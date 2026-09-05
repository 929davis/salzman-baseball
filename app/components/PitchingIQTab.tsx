'use client'
import { useState } from 'react'
import PitchingIQ from '@/app/components/PitchingIQ'
import SituationsView from '@/app/components/SituationsView'
import EffectiveVelocityTool from '@/app/components/EffectiveVelocityTool'

const C = {
  bg3:'#1c2333', border:'#30363d', gold:'#e8b84b', textMuted:'#7d8590', bg:'#0d1117',
}

const MODE_LABELS = { pitchtype:'Pitch Type', basescenario:'Base Scenario', effectivevelocity:'Effective Velocity' } as const

// Pitching IQ umbrella: per-pitcher arsenal/zone scouting (PitchingIQ), the league-wide
// situational tool (SituationsView), and the Effective Velocity theory tester all live under
// the same tab, switched internally — conceptually related but answering different
// questions, so they stay visually distinct rather than merged.
export default function PitchingIQTab(){
  const [mode,setMode] = useState<'pitchtype'|'basescenario'|'effectivevelocity'>('pitchtype')
  return (
    <div>
      <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap' as const}}>
        {(Object.keys(MODE_LABELS) as (keyof typeof MODE_LABELS)[]).map(m=>(
          <button key={m} onClick={()=>setMode(m)} style={{background:mode===m?C.gold:C.bg3,color:mode===m?C.bg:C.textMuted,border:`1px solid ${mode===m?C.gold:C.border}`,borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:mode===m?700:400,cursor:'pointer'}}>
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>
      {mode==='pitchtype' ? <PitchingIQ/> : mode==='basescenario' ? <SituationsView/> : <EffectiveVelocityTool/>}
    </div>
  )
}
