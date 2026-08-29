'use client'
import { useState } from 'react'
import BaseScenarioTool from '@/app/components/BaseScenarioTool'
import CountLeverageTable from '@/app/components/CountLeverageTable'
import { EXACT_CELL_THRESHOLD } from '@/lib/baseScenario'

const C = {
  bg2:'#161b22', bg3:'#1c2333', border:'#30363d', gold:'#e8b84b', textMuted:'#7d8590', textDim:'#484f58', text:'#e6edf3', bg:'#0d1117',
}

const LIMITATIONS = [
  <>No park or defensive-positioning adjustment. Every park is aggregated together, which washes out real park effects — especially for fly balls (a ball that's a homer in one park can be a routine out in another).</>,
  <>No score, inning, or win-expectancy context. Everything here is <b>run expectancy</b> — expected runs for the rest of the situation — not win probability. Late in a close game, the right call is often a win-expectancy decision, and this tool doesn't capture that.</>,
  <>Numbers can jump when a filter change crosses the sample-size threshold ({EXACT_CELL_THRESHOLD} pitches). Below that threshold, the tool switches from the exact matchup to a broader estimate — a hard switch, not a smooth blend. A jump right at that line is the model changing which data it trusts, not a real baseball effect.</>,
  <>"This situation" means what real pitches thrown at that <i>exact</i> count actually did — it doesn't track what eventually happened to at-bats that passed through a count and then moved on to a different one.</>,
  <>Pitch selection isn't random. A rare pitch at a given count was thrown by a pitcher who chose it, to a hitter they weren't worried about. The data shows what happened when that pitch was chosen — not what would happen if you called for it yourself. Usage % next to each pitch type is there to flag this.</>,
]

// Single entry point for the whole Base Scenario Tool, mounted identically in the coach
// pitcher-detail tab bar and the athlete dashboard — no forked copies of this logic.
// At-Bat Simulator and Count Leverage are one continuous view, not separate sub-tabs.
export default function SituationsView(){
  const [showLimitations,setShowLimitations] = useState(false)
  return (
    <div>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}>
        <button onClick={()=>setShowLimitations(s=>!s)} style={{background:'transparent',color:C.textMuted,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 14px',fontSize:11,cursor:'pointer'}}>
          {showLimitations?'Hide':'ⓘ'} Limitations
        </button>
      </div>

      {showLimitations && (
        <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8,padding:14,marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:C.gold,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:8}}>What This Tool Doesn't Account For</div>
          <ul style={{margin:0,paddingLeft:18,display:'flex',flexDirection:'column' as const,gap:8}}>
            {LIMITATIONS.map((l,i)=><li key={i} style={{fontSize:11,color:C.textMuted,lineHeight:1.6}}>{l}</li>)}
          </ul>
        </div>
      )}

      <BaseScenarioTool/>
      <div style={{marginTop:20,paddingTop:20,borderTop:`1px solid ${C.border}`}}>
        <CountLeverageTable/>
      </div>
    </div>
  )
}
