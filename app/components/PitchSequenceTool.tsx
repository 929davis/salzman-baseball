'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  TARGET_OUTCOMES, TARGET_OUTCOME_LABELS, LOCATION_BUCKET_LABELS, SEQUENCE_MIN_N,
  type TargetOutcome, getTopSequencesByFrequency, getTopSequencesByRate, fetchAllRows,
} from '@/lib/baseScenario'

const C = {
  bg2:'#161b22', bg3:'#1c2333', border:'#30363d',
  gold:'#e8b84b', teal:'#39d353', red:'#f85149', blue:'#58a6ff',
  text:'#e6edf3', textMuted:'#7d8590', textDim:'#484f58', bg:'#0d1117',
}

export default function PitchSequenceTool(){
  const supabase = createClient()
  const [loading,setLoading] = useState(true)
  const [rows,setRows] = useState<any[]>([])

  const [pThrows,setPThrows] = useState<'R'|'L'>('R')
  const [bats,setBats] = useState<'R'|'L'>('R')
  const [target,setTarget] = useState<TargetOutcome>('barrel')
  const [mode,setMode] = useState<'rate'|'frequency'>('rate')

  useEffect(()=>{
    let cancelled = false
    fetchAllRows(supabase, 'bs_sequence').then(data => {
      if (cancelled) return
      setRows(data)
      setLoading(false)
    })
    return ()=>{cancelled=true}
  },[])

  const results = useMemo(() => {
    if (mode==='rate') return getTopSequencesByRate(rows, target, pThrows, bats, 10)
    return getTopSequencesByFrequency(rows, target, pThrows, bats, 10)
  }, [rows, target, pThrows, bats, mode])

  if (loading) return <div style={{textAlign:'center' as const,padding:30,color:C.textMuted,fontSize:13}}>Loading...</div>

  return (
    <div style={{color:C.text,fontSize:13}}>
      <div style={{fontSize:16,fontWeight:700,color:C.gold,marginBottom:4}}>Pitch Sequences</div>
      <div style={{fontSize:11,color:C.textMuted,marginBottom:16,lineHeight:1.6}}>
        The most common last-2-pitch sequences (pitch type + location) leading to a chosen outcome. 2026 season-to-date, league-wide. Sequences with fewer than {SEQUENCE_MIN_N} occurrences are dropped — not enough data to mean anything.
      </div>

      <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8,padding:14,marginBottom:14,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10}}>
        <div>
          <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4}}>Pitcher Throws</div>
          <div style={{display:'flex',gap:4}}>{(['R','L'] as const).map(v=>(
            <button key={v} onClick={()=>setPThrows(v)} style={{flex:1,padding:'6px 0',borderRadius:6,border:`1px solid ${pThrows===v?C.gold:C.border}`,background:pThrows===v?`${C.gold}26`:C.bg3,color:pThrows===v?C.gold:C.textMuted,cursor:'pointer',fontWeight:700,fontSize:12}}>{v}HP</button>
          ))}</div>
        </div>
        <div>
          <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4}}>Batter Hits</div>
          <div style={{display:'flex',gap:4}}>{(['R','L'] as const).map(v=>(
            <button key={v} onClick={()=>setBats(v)} style={{flex:1,padding:'6px 0',borderRadius:6,border:`1px solid ${bats===v?C.gold:C.border}`,background:bats===v?`${C.gold}26`:C.bg3,color:bats===v?C.gold:C.textMuted,cursor:'pointer',fontWeight:700,fontSize:12}}>{v}HH</button>
          ))}</div>
        </div>
        <div style={{gridColumn:'span 2'}}>
          <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4}}>Target Outcome</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))',gap:4}}>
            {TARGET_OUTCOMES.map(t=>(
              <button key={t} onClick={()=>setTarget(t)} style={{padding:'6px 0',borderRadius:6,border:`1px solid ${target===t?C.gold:C.border}`,background:target===t?`${C.gold}26`:C.bg3,color:target===t?C.gold:C.textMuted,cursor:'pointer',fontSize:11,fontWeight:600}}>{TARGET_OUTCOME_LABELS[t]}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{display:'flex',gap:6,marginBottom:6}}>
        {(['rate','frequency'] as const).map(m=>(
          <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:'8px 0',borderRadius:6,border:`1px solid ${mode===m?C.gold:C.border}`,background:mode===m?`${C.gold}26`:C.bg3,color:mode===m?C.gold:C.textMuted,cursor:'pointer',fontSize:12,fontWeight:600}}>
            {m==='rate'?'Highest Rate':'Most Frequent'}
          </button>
        ))}
      </div>
      <div style={{fontSize:10,color:C.textDim,marginBottom:14,lineHeight:1.5}}>
        {mode==='rate'
          ? <>Of sequences thrown often enough to trust a rate, which ones ended in this outcome most often — the "uniquely dangerous" ranking.</>
          : <>Of every plate appearance ending in this outcome, which sequences led there most often — the "most common path" ranking. Will naturally favor whatever pitch is thrown most overall (e.g. four-seam), which is expected, not a flaw.</>}
      </div>

      {results.length===0 ? (
        <div style={{textAlign:'center' as const,padding:30,color:C.textDim,fontSize:12}}>No sequences meet the minimum sample size for this combination yet.</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column' as const,gap:6}}>
          {results.map((r,i)=>(
            <div key={i} style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap' as const}}>
              <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap' as const}}>
                <span style={{fontSize:10,color:C.textDim,width:16}}>{i+1}.</span>
                <div style={{fontSize:12}}>
                  <span style={{fontWeight:700,color:C.text}}>{r.pt1}</span>
                  <span style={{color:C.textMuted}}> ({LOCATION_BUCKET_LABELS[r.loc1]})</span>
                </div>
                <span style={{color:C.textDim}}>→</span>
                <div style={{fontSize:12}}>
                  <span style={{fontWeight:700,color:C.text}}>{r.pt2}</span>
                  <span style={{color:C.textMuted}}> ({LOCATION_BUCKET_LABELS[r.loc2]})</span>
                </div>
              </div>
              <div style={{textAlign:'right' as const}}>
                {r.rate && (
                  <div style={{fontSize:13,fontWeight:700,color:C.gold}}>{(r.rate.p*100).toFixed(1)}% <span style={{fontSize:9,color:C.textDim,fontWeight:400}}>[{(r.rate.lower*100).toFixed(1)}–{(r.rate.upper*100).toFixed(1)}%]</span></div>
                )}
                <div style={{fontSize:10,color:C.textMuted}}>{r.nTarget.toLocaleString()} / {r.nTotal.toLocaleString()} PAs</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
