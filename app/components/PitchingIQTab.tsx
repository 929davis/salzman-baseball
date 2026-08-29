'use client'
import { useState } from 'react'
import PitchingIQ from '@/app/components/PitchingIQ'
import SituationsView from '@/app/components/SituationsView'

const C = {
  bg3:'#1c2333', border:'#30363d', gold:'#e8b84b', textMuted:'#7d8590', bg:'#0d1117',
}

// Pitching IQ umbrella: per-pitcher arsenal/zone scouting (PitchingIQ) and the league-wide
// situational tool (SituationsView) live under the same tab, switched internally — they're
// conceptually related but answer different questions ("what does this pitcher throw" vs.
// "what happens in this game state"), so they stay visually distinct rather than merged.
export default function PitchingIQTab(){
  const [mode,setMode] = useState<'pitchtype'|'basescenario'>('pitchtype')
  return (
    <div>
      <div style={{display:'flex',gap:6,marginBottom:14}}>
        {(['pitchtype','basescenario'] as const).map(m=>(
          <button key={m} onClick={()=>setMode(m)} style={{background:mode===m?C.gold:C.bg3,color:mode===m?C.bg:C.textMuted,border:`1px solid ${mode===m?C.gold:C.border}`,borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:mode===m?700:400,cursor:'pointer'}}>
            {m==='pitchtype'?'Pitch Type':'Base Scenario'}
          </button>
        ))}
      </div>
      {mode==='pitchtype' ? <PitchingIQ/> : <SituationsView/>}
    </div>
  )
}
