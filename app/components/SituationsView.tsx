'use client'
import { useState } from 'react'
import BaseScenarioTool from '@/app/components/BaseScenarioTool'
import CountLeverageTable from '@/app/components/CountLeverageTable'
import PitchSequenceTool from '@/app/components/PitchSequenceTool'
import { EXACT_CELL_THRESHOLD, MIN_RENDER_N } from '@/lib/baseScenario'
import { SEQUENCE_MIN_N } from '@/lib/pitchSequences'
import HowToReadPanel from '@/app/components/HowToReadPanel'

const C = {
  bg2:'#161b22', bg3:'#1c2333', border:'#30363d', gold:'#e8b84b', textMuted:'#7d8590', textDim:'#484f58', text:'#e6edf3', bg:'#0d1117',
}

const LIMITATIONS = [
  <>No park or defensive-positioning adjustment. Every park is aggregated together, which washes out real park effects — especially for fly balls (a ball that's a homer in one park can be a routine out in another).</>,
  <>No score, inning, or win-expectancy context. Everything here is <b>run expectancy</b> — expected runs for the rest of the situation — not win probability. Late in a close game, the right call is often a win-expectancy decision, and this tool doesn't capture that.</>,
  <>Numbers can jump when a filter change crosses the sample-size threshold ({EXACT_CELL_THRESHOLD} pitches). Below that threshold, the tool switches from the exact matchup to a broader estimate — a hard switch, not a smooth blend. A jump right at that line is the model changing which data it trusts, not a real baseball effect.</>,
  <>"This situation" means what real pitches thrown at that <i>exact</i> count actually did — it doesn't track what eventually happened to at-bats that passed through a count and then moved on to a different one.</>,
  <>Pitch selection isn't random. A rare pitch at a given count was thrown by a pitcher who chose it, to a hitter they weren't worried about. The data shows what happened when that pitch was chosen — not what would happen if you called for it yourself. Usage % next to each pitch type is there to flag this.</>,
  <>Pitch Sequences uses a coarser 3-way location bucket (heart/edge/chase, not the full 13-zone grid). "At-Bat Outcomes" only looks at the pitch that ends the at-bat (a single/HR/strikeout can only happen once); "Any Pitch Reaction" looks at every consecutive pitch pair, but neither catches a setup pitch further back in a longer at-bat than the immediately preceding one. "Barrel" is computed from the two verified anchor points in MLB's official glossary (98mph→26-30°, 116mph→8-50°) with a straight line drawn between them — real barrel classification isn't perfectly linear mph-to-mph, so treat it as a close approximation. Sequences with fewer than {SEQUENCE_MIN_N} occurrences are dropped entirely rather than shown as noise. Effective Velocity stats per sequence use Husband's classic 2.75mph/6in coefficient — see the Effective Velocity tab for how that number tested against our own data.</>,
]

function HowToRead(){
  return (
    <HowToReadPanel title="How to Read Base Scenario">
      <div>
        Everything on this whole tab — At-Bat Simulator, Count Leverage, and Pitch Sequences — is built from real 2026 pitches, grouped by situation. A few things show up in all three that are worth knowing up front:
      </div>
      <div>
        <b>n</b> is just the number of real pitches a stat is based on — bigger n means more trustworthy. Anything under {MIN_RENDER_N} real pitches shows as <b>"insufficient sample"</b> instead of a rate, on purpose — a rate built from a handful of pitches isn't reliable enough to act on, so it's hidden rather than shown looking precise.
      </div>
      <div>
        A <b>95% CI</b> (confidence interval), shown as <span style={{fontFamily:'monospace'}}>[low–high]</span>, is the range the real number probably falls in — not the number itself. A tight range means we're confident; a wide range means treat the headline number as a rough idea, not gospel.
      </div>
      <div>
        <b>Run Value</b> is the expected number of runs that situation is worth for the <i>batting</i> team — positive favors the hitter, negative favors the pitcher. Most single-pitch/single-situation run values fall somewhere around -0.05 to +0.05 — if you see a much bigger number than that, it's a rare or extreme situation, not a typo.
      </div>
      <div>
        <b>"Exact cell" / "Estimated" / "No data"</b> badges tell you how directly a number answers your exact filters. <b>Exact cell</b> = enough real pitches at this precise combination. <b>Estimated</b> = not enough at the exact combination, so it fell back to a broader group (e.g. any runner on, not this exact base) to get a trustworthy sample — still real data, just a wider question answered. <b>No data</b> = nothing on record yet for this combination.
      </div>
      <div style={{ color:'#484f58', fontSize:11 }}>
        <b>What this isn't:</b> a park-adjusted or win-probability model — see the "Limitations" panel below for the full list of what these tools don't account for. Pitch Sequences' EV Diff / Attention Zone / Run Value columns come from the Effective Velocity tab's model — visit that tab for the full explanation of what those specifically mean.
      </div>
    </HowToReadPanel>
  )
}

// Single entry point for the whole Base Scenario Tool, mounted identically in the coach
// pitcher-detail tab bar and the athlete dashboard — no forked copies of this logic.
// At-Bat Simulator and Count Leverage are one continuous view, not separate sub-tabs.
export default function SituationsView(){
  const [showLimitations,setShowLimitations] = useState(false)
  return (
    <div>
      <HowToRead/>

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
      <div style={{marginTop:20,paddingTop:20,borderTop:`1px solid ${C.border}`}}>
        <PitchSequenceTool/>
      </div>
    </div>
  )
}
