'use client'
import { useState } from 'react'
import BaseScenarioTool from '@/app/components/BaseScenarioTool'
import CountLeverageTable from '@/app/components/CountLeverageTable'

const C = {
  bg3:'#1c2333', border:'#30363d', gold:'#e8b84b', textMuted:'#7d8590', bg:'#0d1117',
}

// Single entry point for the whole Base Scenario Tool, mounted identically in the coach
// pitcher-detail tab bar and the athlete dashboard — no forked copies of this logic.
export default function SituationsView(){
  const [sub,setSub] = useState<'simulator'|'leverage'>('simulator')
  return (
    <div>
      <div style={{display:'flex',gap:6,marginBottom:14}}>
        {(['simulator','leverage'] as const).map(s=>(
          <button key={s} onClick={()=>setSub(s)} style={{background:sub===s?C.gold:C.bg3,color:sub===s?C.bg:C.textMuted,border:`1px solid ${sub===s?C.gold:C.border}`,borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:sub===s?700:400,cursor:'pointer'}}>
            {s==='simulator'?'At-Bat Simulator':'Count Leverage'}
          </button>
        ))}
      </div>
      {sub==='simulator' ? <BaseScenarioTool/> : <CountLeverageTable/>}
    </div>
  )
}
