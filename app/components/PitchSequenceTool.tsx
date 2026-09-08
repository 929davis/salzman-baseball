'use client'
import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows, MIN_RENDER_N } from '@/lib/baseScenario'
import {
  LOCATION_BUCKET_LABELS, SEQUENCE_MIN_N,
  PA_TARGET_OUTCOMES, PA_TARGET_OUTCOME_LABELS, type PaTargetOutcome,
  ANY_TARGET_OUTCOMES, ANY_TARGET_OUTCOME_LABELS, type AnyTargetOutcome,
  getTopPaSequences, getTopAnySequences, type SequenceRankResult,
} from '@/lib/pitchSequences'

const C = {
  bg2:'#161b22', bg3:'#1c2333', border:'#30363d',
  gold:'#e8b84b', teal:'#39d353', red:'#f85149', blue:'#58a6ff',
  text:'#e6edf3', textMuted:'#7d8590', textDim:'#484f58', bg:'#0d1117',
}

const SCOPE_LABELS = { pa:'At-Bat Outcomes', any:'Any Pitch Reaction' } as const

export default function PitchSequenceTool(){
  const supabase = createClient()
  const [loading,setLoading] = useState(true)
  const [paRows,setPaRows] = useState<any[]>([])
  const [anyRows,setAnyRows] = useState<any[]>([])

  const [scope,setScope] = useState<'pa'|'any'>('pa')
  const [pThrows,setPThrows] = useState<'R'|'L'>('R')
  const [bats,setBats] = useState<'R'|'L'>('R')
  const [paTarget,setPaTarget] = useState<PaTargetOutcome>('home_run')
  const [anyTarget,setAnyTarget] = useState<AnyTargetOutcome>('swinging_strike')
  const [mode,setMode] = useState<'rate'|'frequency'>('rate')

  useEffect(()=>{
    let cancelled = false
    Promise.all([
      fetchAllRows(supabase, 'bs_sequence_pa'),
      fetchAllRows(supabase, 'bs_sequence_any'),
    ]).then(([pa, any])=>{
      if (cancelled) return
      setPaRows(pa)
      setAnyRows(any)
      setLoading(false)
    })
    return ()=>{cancelled=true}
  },[])

  const results = useMemo(() => {
    if (scope==='pa') return getTopPaSequences(paRows, paTarget, pThrows, bats, mode, 10)
    return getTopAnySequences(anyRows, anyTarget, pThrows, bats, mode, 10)
  }, [paRows, anyRows, scope, paTarget, anyTarget, pThrows, bats, mode])

  if (loading) return <div style={{textAlign:'center' as const,padding:30,color:C.textMuted,fontSize:13}}>Loading...</div>

  const targetList = scope==='pa' ? PA_TARGET_OUTCOMES : ANY_TARGET_OUTCOMES
  const targetLabels: Record<string,string> = scope==='pa' ? PA_TARGET_OUTCOME_LABELS : ANY_TARGET_OUTCOME_LABELS

  return (
    <div style={{color:C.text,fontSize:13}}>
      <div style={{fontSize:16,fontWeight:700,color:C.gold,marginBottom:4}}>Pitch Sequences</div>
      <div style={{fontSize:11,color:C.textMuted,marginBottom:6,lineHeight:1.6}}>
        The most common last-2-pitch combinations (pitch type + location) leading to a chosen result — with Effective Velocity built in, so you can see whether a sequence's effect is an EV story or just a velocity one. 2026 season-to-date, league-wide.
      </div>
      <div style={{fontSize:10,color:C.textDim,marginBottom:16,lineHeight:1.6,background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8,padding:'8px 10px'}}>
        Quick definitions for the 4 numbers on each row below (full explanation on the <b>Effective Velocity</b> tab): <b>EV Diff</b> = how much the pitch's <i>perceived</i> speed changed from the one before it, once location is factored in. <b>Raw Velo Diff</b> = the same change using plain radar-gun speed, no location adjustment. <b>In Attention Zone</b> = how often that change was small (±6mph or less) — Husband's claim is hitters do the most damage here. <b>Run Value</b> = expected runs for the batter on this sequence (negative is good for the pitcher).
      </div>

      <div style={{display:'flex',gap:6,marginBottom:14}}>
        {(['pa','any'] as const).map(s=>(
          <button key={s} onClick={()=>setScope(s)} style={{flex:1,padding:'8px 0',borderRadius:6,border:`1px solid ${scope===s?C.gold:C.border}`,background:scope===s?`${C.gold}26`:C.bg3,color:scope===s?C.gold:C.textMuted,cursor:'pointer',fontWeight:700,fontSize:12}}>{SCOPE_LABELS[s]}</button>
        ))}
      </div>
      <div style={{fontSize:10,color:C.textDim,marginBottom:14,lineHeight:1.5}}>
        {scope==='pa'
          ? <>Only the pitch that actually ends the at-bat — a single, home run, or strikeout can only happen once per at-bat, so this is a true final result.</>
          : <>Every consecutive pitch pair in every at-bat — a swinging strike or a taken ball can happen on any pitch, not just the one that ends the at-bat, so this view catches those too.</>}
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
            {scope==='pa'
              ? PA_TARGET_OUTCOMES.map(t=>(
                  <button key={t} onClick={()=>setPaTarget(t)} style={{padding:'6px 0',borderRadius:6,border:`1px solid ${paTarget===t?C.gold:C.border}`,background:paTarget===t?`${C.gold}26`:C.bg3,color:paTarget===t?C.gold:C.textMuted,cursor:'pointer',fontSize:11,fontWeight:600}}>{PA_TARGET_OUTCOME_LABELS[t]}</button>
                ))
              : ANY_TARGET_OUTCOMES.map(t=>(
                  <button key={t} onClick={()=>setAnyTarget(t)} style={{padding:'6px 0',borderRadius:6,border:`1px solid ${anyTarget===t?C.gold:C.border}`,background:anyTarget===t?`${C.gold}26`:C.bg3,color:anyTarget===t?C.gold:C.textMuted,cursor:'pointer',fontSize:11,fontWeight:600}}>{ANY_TARGET_OUTCOME_LABELS[t]}</button>
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
          : <>Of every instance ending in this outcome, which sequences led there most often — the "most common path" ranking. Will naturally favor whatever pitch is thrown most overall (e.g. four-seam), which is expected, not a flaw.</>}
      </div>

      {results.length===0 ? (
        <div style={{textAlign:'center' as const,padding:30,color:C.textDim,fontSize:12}}>No sequences meet the minimum sample size for this combination yet.</div>
      ) : (
        <div style={{display:'flex',flexDirection:'column' as const,gap:8}}>
          {results.map((r,i)=>(
            <SequenceRow key={i} rank={i+1} r={r}/>
          ))}
        </div>
      )}
    </div>
  )
}

function SequenceRow({ rank, r }: { rank: number, r: SequenceRankResult }){
  const ev = r.ev
  return (
    <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8,padding:'12px 14px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap' as const,marginBottom:8}}>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap' as const}}>
          <span style={{fontSize:10,color:C.textDim,width:16}}>{rank}.</span>
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
          <div style={{fontSize:10,color:C.textMuted}}>{r.nTarget.toLocaleString()} / {r.nTotal.toLocaleString()}</div>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))',gap:8,borderTop:`1px solid ${C.border}`,paddingTop:8}}>
        <EvStat label="EV Diff" v={ev.evDiff} unit=" mph" color={C.gold}/>
        <EvStat label="Raw Velo Diff" v={ev.actualDiff} unit=" mph" color={C.blue}/>
        <EvStat label="In Attention Zone" v={ev.attentionZoneRate} isRate color={C.teal}/>
        <EvStat label="Run Value" v={ev.runValue} unit="" decimals={4} color={C.red}/>
      </div>
    </div>
  )
}

function EvStat({ label, v, unit='', isRate=false, decimals=1, color }: { label:string, v:{p?:number,mean?:number,n:number}|null, unit?:string, isRate?:boolean, decimals?:number, color:string }){
  if (!v || v.n < MIN_RENDER_N) return (
    <div>
      <div style={{fontSize:9,color:C.textDim,marginBottom:2}}>{label}</div>
      <div style={{fontSize:11,color:C.textDim}}>insufficient sample</div>
    </div>
  )
  const val = isRate ? (v.p as number)*100 : (v.mean as number)
  return (
    <div>
      <div style={{fontSize:9,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:2}}>{label}</div>
      <div style={{fontSize:13,fontWeight:700,color}}>{val>=0&&!isRate?'+':''}{val.toFixed(isRate?1:decimals)}{isRate?'%':unit}</div>
    </div>
  )
}
