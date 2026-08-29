'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  OUTCOME_KEYS, OUTCOME_LABELS, PITCH_TYPE_GROUPS, BASE_STATES, BASE_STATE_LABELS,
  type OutcomeKey, type BaseState,
  jointKey, pitchMarginalKey, zoneSampleKey,
  resolveOutcomes, computeUsageShares, sampleZone, MIN_RENDER_N, fetchAllRows,
} from '@/lib/baseScenario'
import { buildSavantLink, EXACT_BASE_STATES } from '@/lib/savantLink'

const C = {
  bg:'#0d1117',bg2:'#161b22',bg3:'#1c2333',border:'#30363d',
  gold:'#e8b84b',teal:'#39d353',red:'#f85149',blue:'#58a6ff',purple:'#a371f7',
  text:'#e6edf3',textMuted:'#7d8590',textDim:'#484f58',white:'#ffffff',
}

// Same 5x5 "catcher's view" numbered-zone layout as PitchingIQ's heatmap — reused
// deliberately so this looks/behaves like the same visual language, not a new invention.
const ZONE_GRID = [
  [null,11,12,13,null],
  [14,1,2,3,14],
  [14,4,5,6,14],
  [14,7,8,9,14],
  [null,14,14,14,null],
]

type Action = 'ball' | 'called_strike' | 'swinging_strike' | 'foul' | 'put_in_play'
const ACTIONS: { key: Action, label: string, outcomeKey: OutcomeKey | null }[] = [
  { key:'ball', label:'Ball', outcomeKey:'ball' },
  { key:'called_strike', label:'Called Strike', outcomeKey:'called_strike' },
  { key:'swinging_strike', label:'Swinging Strike', outcomeKey:'swinging_strike' },
  { key:'foul', label:'Foul', outcomeKey:'foul' },
  { key:'put_in_play', label:'Put In Play', outcomeKey:null },
]

type PitchLogEntry = { pitchTypeGroup: string, action: Action, zone: number | null }

const OUTCOME_DOT_COLOR: Record<string,string> = {
  ball:C.blue, called_strike:C.red, swinging_strike:C.red, foul:C.gold,
  out_in_play:C.textMuted, single:C.teal, double:C.teal, triple:C.teal, home_run:C.purple,
  walk:C.blue, strikeout:C.red, hbp:C.blue,
}

const FOUL_COLLAPSE_THRESHOLD = 4 // after this many consecutive 2-strike fouls, collapse the display into a counter

function today() { return new Date().toISOString().split('T')[0] }
function daysAgo(n:number) { const d = new Date(); d.setDate(d.getDate()-n); return d.toISOString().split('T')[0] }

export default function BaseScenarioTool(){
  const supabase = createClient()
  const [loading,setLoading] = useState(true)
  const [jointRows,setJointRows] = useState<any[]>([])
  const [pitchMarginalRows,setPitchMarginalRows] = useState<any[]>([])
  const [zoneSampleRows,setZoneSampleRows] = useState<any[]>([])

  // Starting filters — fixed for the whole at-bat, per spec §4.
  const [pThrows,setPThrows] = useState<'R'|'L'>('R')
  const [bats,setBats] = useState<'R'|'L'>('R')
  const [startOuts,setStartOuts] = useState(0)
  const [startBaseState,setStartBaseState] = useState<BaseState>('empty')

  // Sequence state
  const [balls,setBalls] = useState(0)
  const [strikes,setStrikes] = useState(0)
  const [pitchTypeGroup,setPitchTypeGroup] = useState<string>('Four-Seam')
  const [history,setHistory] = useState<PitchLogEntry[]>([])
  const [ended,setEnded] = useState(false)
  const [endReason,setEndReason] = useState('')

  useEffect(()=>{
    let cancelled = false
    Promise.all([
      fetchAllRows(supabase, 'bs_joint'),
      fetchAllRows(supabase, 'bs_pitch_marginal'),
      fetchAllRows(supabase, 'bs_zone_sample'),
    ]).then(([j,pm,zs])=>{
      if (cancelled) return
      setJointRows(j)
      setPitchMarginalRows(pm)
      setZoneSampleRows(zs)
      setLoading(false)
    })
    return ()=>{cancelled=true}
  },[])

  const jointMap = useMemo(()=>new Map(jointRows.map(r=>[jointKey({pThrows:r.p_throws,bats:r.bats,pitchTypeGroup:r.pitch_type_group,countBucket:r.count_bucket,outs:r.outs_when_up,baseState:r.base_state}),r])),[jointRows])
  const pitchMarginalMap = useMemo(()=>new Map(pitchMarginalRows.map(r=>[pitchMarginalKey({pThrows:r.p_throws,bats:r.bats,pitchTypeGroup:r.pitch_type_group,countBucket:r.count_bucket}),r])),[pitchMarginalRows])
  const zoneSampleMap = useMemo(()=>new Map(zoneSampleRows.map(r=>[zoneSampleKey({pThrows:r.p_throws,bats:r.bats,pitchTypeGroup:r.pitch_type_group,countBucket:r.count_bucket,outcome:r.outcome}),r])),[zoneSampleRows])

  const countBucket = `${balls}-${strikes}`
  const dims = { pThrows, bats, pitchTypeGroup, countBucket, outs: startOuts, baseState: startBaseState }
  const resolved = resolveOutcomes(jointMap.get(jointKey(dims)), pitchMarginalMap.get(pitchMarginalKey(dims)))
  const usage = useMemo(()=>computeUsageShares(pitchMarginalRows, pThrows, bats, countBucket), [pitchMarginalRows, pThrows, bats, countBucket])

  // Collapse long strings of 2-strike fouls into a single counter entry for display —
  // spec §4 edge case: two-strike fouls can loop indefinitely.
  const displayHistory = useMemo(()=>{
    const out: (PitchLogEntry & {collapsedCount?:number})[] = []
    for (const entry of history){
      const last = out[out.length-1]
      if (entry.action==='foul' && last?.action==='foul' && last.pitchTypeGroup===entry.pitchTypeGroup){
        last.collapsedCount = (last.collapsedCount||1)+1
      } else {
        out.push({...entry})
      }
    }
    return out
  },[history])
  const recentFoulStreak = (()=>{
    let streak = 0
    for (let i=history.length-1;i>=0;i--){ if (history[i].action==='foul') streak++; else break }
    return streak
  })()

  const startNewAtBat = () => {
    setBalls(0); setStrikes(0); setHistory([]); setEnded(false); setEndReason('')
  }

  const takeAction = (action: Action) => {
    if (ended) return
    const zone = sampleZone(zoneSampleMap.get(zoneSampleKey({...dims, outcome: action==='put_in_play' ? 'out_in_play' : (ACTIONS.find(a=>a.key===action)?.outcomeKey || 'ball')})))
    setHistory(h => [...h, { pitchTypeGroup, action, zone }])

    if (action==='ball'){
      if (balls+1>=4){ setEnded(true); setEndReason('Walk'); }
      else setBalls(b=>b+1)
    } else if (action==='called_strike' || action==='swinging_strike'){
      if (strikes+1>=3){ setEnded(true); setEndReason('Strikeout'); }
      else setStrikes(s=>s+1)
    } else if (action==='foul'){
      if (strikes<2) setStrikes(s=>s+1)
      // foul at 2 strikes: count doesn't change, PA continues
    } else if (action==='put_in_play'){
      setEnded(true); setEndReason('Ball In Play')
    }
  }

  if (loading) return <div style={{textAlign:'center' as const,padding:30,color:C.textMuted,fontSize:13}}>Loading...</div>

  const savantLink = buildSavantLink({
    dateGt: daysAgo(30), dateLt: today(),
    pitcherThrows: pThrows, batterStands: bats,
    countBucket, outs: startOuts, baseState: startBaseState,
    pitchType: undefined,
  })
  const baseStateExact = EXACT_BASE_STATES.has(startBaseState)

  return (
    <div style={{color:C.text,fontSize:13}}>
      <div style={{fontSize:16,fontWeight:700,color:C.gold,marginBottom:4}}>At-Bat Simulator</div>
      <div style={{fontSize:11,color:C.textMuted,marginBottom:16,lineHeight:1.6}}>
        Set a starting situation, then step through the count pitch by pitch — pick a pitch type at each step and see what actually happens historically in this exact matchup. 2026 season-to-date, league-wide.
      </div>

      {/* Starting filters */}
      <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8,padding:14,marginBottom:12,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10}}>
        <div>
          <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4}}>Pitcher Throws</div>
          <div style={{display:'flex',gap:4}}>{(['R','L'] as const).map(v=>(
            <button key={v} onClick={()=>{setPThrows(v);startNewAtBat()}} style={{flex:1,padding:'6px 0',borderRadius:6,border:`1px solid ${pThrows===v?C.gold:C.border}`,background:pThrows===v?`${C.gold}26`:C.bg3,color:pThrows===v?C.gold:C.textMuted,cursor:'pointer',fontWeight:700,fontSize:12}}>{v}HP</button>
          ))}</div>
        </div>
        <div>
          <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4}}>Batter Hits</div>
          <div style={{display:'flex',gap:4}}>{(['R','L'] as const).map(v=>(
            <button key={v} onClick={()=>{setBats(v);startNewAtBat()}} style={{flex:1,padding:'6px 0',borderRadius:6,border:`1px solid ${bats===v?C.gold:C.border}`,background:bats===v?`${C.gold}26`:C.bg3,color:bats===v?C.gold:C.textMuted,cursor:'pointer',fontWeight:700,fontSize:12}}>{v}HH</button>
          ))}</div>
        </div>
        <div>
          <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4}}>Outs</div>
          <div style={{display:'flex',gap:4}}>{[0,1,2].map(v=>(
            <button key={v} onClick={()=>{setStartOuts(v);startNewAtBat()}} style={{flex:1,padding:'6px 0',borderRadius:6,border:`1px solid ${startOuts===v?C.gold:C.border}`,background:startOuts===v?`${C.gold}26`:C.bg3,color:startOuts===v?C.gold:C.textMuted,cursor:'pointer',fontWeight:700,fontSize:12}}>{v}</button>
          ))}</div>
        </div>
        <div style={{gridColumn:'span 2'}}>
          <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4}}>Base State</div>
          <select value={startBaseState} onChange={e=>{setStartBaseState(e.target.value as BaseState);startNewAtBat()}} style={{width:'100%',background:C.bg3,border:`1px solid ${C.border}`,borderRadius:6,padding:'7px 10px',fontSize:12,color:C.text}}>
            {BASE_STATES.map(b=><option key={b} value={b}>{BASE_STATE_LABELS[b]}</option>)}
          </select>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'minmax(260px,1fr) minmax(280px,1.2fr)',gap:12}}>
        {/* Zone panel */}
        <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8,padding:14}}>
          <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:10}}>Zone — accumulated this at-bat</div>
          <div style={{display:'flex',flexDirection:'column' as const,alignItems:'center',gap:3}}>
            {ZONE_GRID.map((row,ri)=>(
              <div key={ri} style={{display:'flex',gap:3}}>
                {row.map((zone,ci)=>{
                  if (zone===null) return <div key={ci} style={{width:48,height:48}}/>
                  const isInZone = zone<=9
                  const marks = history.filter(h=>h.zone===zone)
                  return (
                    <div key={`${ri}-${ci}`} style={{width:48,height:48,borderRadius:4,background:C.bg3,border:`${isInZone?'1.5px':'1px'} solid ${isInZone?'rgba(255,255,255,0.2)':C.border}`,opacity:isInZone?1:0.75,position:'relative' as const,display:'flex',flexWrap:'wrap' as const,alignItems:'center',justifyContent:'center',gap:2,padding:3}}>
                      <div style={{fontSize:7,position:'absolute' as const,top:2,left:3,color:C.textDim}}>{zone}</div>
                      {marks.map((m,i)=>(
                        <div key={i} title={ACTIONS.find(a=>a.key===m.action)?.label} style={{width:7,height:7,borderRadius:'50%',background:OUTCOME_DOT_COLOR[m.action==='foul'?'foul':(ACTIONS.find(a=>a.key===m.action)?.outcomeKey||'out_in_play')]}}/>
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          <div style={{textAlign:'center' as const,fontSize:9,color:C.textDim,marginTop:8}}>catcher's view · zones 1–9 in-zone · 11–14 shadow/chase · dot color = pitch result</div>
          <div style={{fontSize:9,color:C.textDim,marginTop:4,lineHeight:1.5}}>Location shown is a real pitch sampled from this matchup+count+outcome — not a prediction. Zone box drawn using a fixed representative batter height (not the actual batter's height, which isn't tracked in this data).</div>
        </div>

        {/* Count/base/out strip + action selector + info panel */}
        <div>
          <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8,padding:14,marginBottom:12,display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,flexWrap:'wrap' as const}}>
            <div>
              <div style={{fontSize:9,color:C.textMuted,textTransform:'uppercase' as const,marginBottom:4}}>Count</div>
              <div style={{display:'flex',gap:8}}>
                <div style={{display:'flex',gap:3}}>{[0,1,2,3].map(i=><div key={i} style={{width:9,height:9,borderRadius:'50%',background:i<balls?C.blue:C.bg3,border:`1px solid ${C.border}`}}/>)}</div>
                <span style={{fontSize:11,color:C.textDim}}>/</span>
                <div style={{display:'flex',gap:3}}>{[0,1,2].map(i=><div key={i} style={{width:9,height:9,borderRadius:'50%',background:i<strikes?C.red:C.bg3,border:`1px solid ${C.border}`}}/>)}</div>
              </div>
            </div>
            <div>
              <div style={{fontSize:9,color:C.textMuted,textTransform:'uppercase' as const,marginBottom:4}}>Bases</div>
              <svg width={40} height={40} viewBox="0 0 40 40">
                <rect x="16" y="4" width="8" height="8" transform="rotate(45 20 8)" fill={startBaseState==='2nd'||startBaseState==='1st_2nd'||startBaseState==='2nd_3rd'||startBaseState==='loaded'?C.gold:C.bg3} stroke={C.border}/>
                <rect x="28" y="16" width="8" height="8" transform="rotate(45 32 20)" fill={startBaseState==='1st'||startBaseState==='1st_2nd'||startBaseState==='1st_3rd'||startBaseState==='loaded'?C.gold:C.bg3} stroke={C.border}/>
                <rect x="4" y="16" width="8" height="8" transform="rotate(45 8 20)" fill={startBaseState==='3rd'||startBaseState==='1st_3rd'||startBaseState==='2nd_3rd'||startBaseState==='loaded'?C.gold:C.bg3} stroke={C.border}/>
              </svg>
            </div>
            <div>
              <div style={{fontSize:9,color:C.textMuted,textTransform:'uppercase' as const,marginBottom:4}}>Outs</div>
              <div style={{display:'flex',gap:3}}>{[0,1,2].map(i=><div key={i} style={{width:9,height:9,borderRadius:'50%',background:i<startOuts?C.white:C.bg3,border:`1px solid ${C.border}`}}/>)}</div>
            </div>
          </div>

          {ended ? (
            <div style={{background:`${C.gold}14`,border:`1px solid ${C.gold}`,borderRadius:8,padding:14,marginBottom:12,textAlign:'center' as const}}>
              <div style={{fontSize:14,fontWeight:700,color:C.gold,marginBottom:8}}>At-bat ended: {endReason}</div>
              <button onClick={startNewAtBat} style={{background:C.gold,color:C.bg,border:'none',borderRadius:6,padding:'8px 16px',fontSize:13,fontWeight:700,cursor:'pointer'}}>New At-Bat</button>
            </div>
          ) : (
            <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8,padding:14,marginBottom:12}}>
              <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:6}}>Pitch Type — usage % shows how often this pitch is actually thrown here</div>
              <select value={pitchTypeGroup} onChange={e=>setPitchTypeGroup(e.target.value)} style={{width:'100%',background:C.bg3,border:`1px solid ${C.border}`,borderRadius:6,padding:'8px 10px',fontSize:13,color:C.text,marginBottom:10}}>
                {PITCH_TYPE_GROUPS.map(g=>{
                  const u = usage.find(x=>x.pitchTypeGroup===g)
                  return <option key={g} value={g}>{g}{u?` — ${u.pct.toFixed(1)}% usage (n=${u.n})`:' — no usage data'}</option>
                })}
              </select>
              {(() => {
                const u = usage.find(x=>x.pitchTypeGroup===pitchTypeGroup)
                if (u && u.pct < 5) return <div style={{fontSize:10,color:C.red,marginBottom:10}}>⚠ Rare choice at this count/matchup ({u.pct.toFixed(1)}% usage) — pitchers who throw this here are self-selected, not random. Treat this outcome distribution with extra skepticism.</div>
                return null
              })()}
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))',gap:6}}>
                {ACTIONS.map(a=>(
                  <button key={a.key} onClick={()=>takeAction(a.key)} style={{padding:'10px 6px',borderRadius:6,border:`1px solid ${C.border}`,background:C.bg3,color:C.text,cursor:'pointer',fontSize:12,fontWeight:600}}>{a.label}</button>
                ))}
              </div>
              {recentFoulStreak>=FOUL_COLLAPSE_THRESHOLD && <div style={{fontSize:10,color:C.textDim,marginTop:8}}>🔁 {recentFoulStreak} consecutive fouls — collapsing repeated entries in the log below.</div>}
            </div>
          )}

          {/* Info panel */}
          <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8,padding:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px'}}>This Situation</div>
              <span style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:10,textTransform:'uppercase' as const,background:resolved.source==='exact'?`${C.teal}26`:resolved.source==='estimated'?`${C.gold}26`:`${C.textDim}26`,color:resolved.source==='exact'?C.teal:resolved.source==='estimated'?C.gold:C.textDim,border:`1px solid ${resolved.source==='exact'?C.teal:resolved.source==='estimated'?C.gold:C.textDim}66`}}>
                {resolved.source==='exact'?'Exact cell':resolved.source==='estimated'?'Estimated (broader sample)':'No data'}
              </span>
            </div>
            <div style={{fontSize:10,color:C.textDim,marginBottom:10}}>{pThrows}HP vs {bats}HH · {countBucket} · {startOuts} out{startOuts!==1?'s':''} · {BASE_STATE_LABELS[startBaseState]} · {pitchTypeGroup} · n={resolved.n.toLocaleString()}</div>

            {resolved.source==='no_data' ? (
              <div style={{fontSize:12,color:C.textDim,textAlign:'center' as const,padding:12}}>No pitches on record for this exact combination yet.</div>
            ) : (
              <>
                {resolved.avgRunValue && (
                  <div style={{marginBottom:10,padding:'8px 10px',background:C.bg3,borderRadius:6}}>
                    <div style={{fontSize:9,color:C.textMuted,textTransform:'uppercase' as const,marginBottom:2}}>Avg. Run Value (positive = favors batter)</div>
                    <div style={{fontSize:16,fontWeight:700,color:resolved.avgRunValue.mean>=0?C.teal:C.red}}>{resolved.avgRunValue.mean>=0?'+':''}{resolved.avgRunValue.mean.toFixed(3)}</div>
                    <div style={{fontSize:9,color:C.textDim}}>95% CI [{resolved.avgRunValue.lower.toFixed(3)}, {resolved.avgRunValue.upper.toFixed(3)}]</div>
                  </div>
                )}
                <div style={{fontSize:9,color:C.textMuted,textTransform:'uppercase' as const,marginBottom:6}}>Outcome Breakdown</div>
                <div style={{display:'flex',flexDirection:'column' as const,gap:4,marginBottom:10}}>
                  {OUTCOME_KEYS.filter(k=>(resolved.outcomes[k]?.n||0)>0).sort((a,b)=>(resolved.outcomes[b]?.n||0)-(resolved.outcomes[a]?.n||0)).map(k=>{
                    const o = resolved.outcomes[k]!
                    const showRate = o.n>=MIN_RENDER_N || resolved.n>=MIN_RENDER_N
                    return (
                      <div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:11}}>
                        <span style={{color:C.text}}>{OUTCOME_LABELS[k]}</span>
                        {o.ci && showRate ? (
                          <span style={{color:C.textMuted}}>{(o.ci.p*100).toFixed(1)}% <span style={{color:C.textDim,fontSize:9}}>[{(o.ci.lower*100).toFixed(1)}–{(o.ci.upper*100).toFixed(1)}%]</span></span>
                        ) : <span style={{color:C.textDim,fontSize:10}}>n={o.n} — too few to rate</span>}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
            <a href={savantLink} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:C.blue,display:'block',marginBottom:2}}>View on Baseball Savant ↗</a>
            {!baseStateExact && <div style={{fontSize:9,color:C.textDim}}>Savant link shows "{BASE_STATE_LABELS[startBaseState]}" inclusively (may include other runners too) — Savant has no way to filter to this exact base state alone.</div>}
          </div>
        </div>
      </div>

      {/* Pitch log */}
      {history.length>0 && (
        <div style={{marginTop:12,background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8,padding:14}}>
          <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:8}}>Pitch Log</div>
          <div style={{display:'flex',flexWrap:'wrap' as const,gap:6}}>
            {displayHistory.map((h,i)=>(
              <div key={i} style={{fontSize:10,padding:'4px 8px',borderRadius:12,background:C.bg3,border:`1px solid ${C.border}`,color:C.textMuted}}>
                {h.pitchTypeGroup} — {ACTIONS.find(a=>a.key===h.action)?.label}{h.collapsedCount?` ×${h.collapsedCount}`:''}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
