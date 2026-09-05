'use client'
import { useEffect, useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows, MIN_RENDER_N } from '@/lib/baseScenario'
import {
  evAttentionZoneSplit, evDirectionSplit, evDiffCurve, actualDiffCurve, fitCurve,
  ATTENTION_ZONE_MPH, type EvPairRow, type EvPrincipleStat, type WeightedFit,
} from '@/lib/effectiveVelocity'

const C = {
  bg:'#0d1117',bg2:'#161b22',bg3:'#1c2333',border:'#30363d',
  gold:'#e8b84b',teal:'#39d353',red:'#f85149',blue:'#58a6ff',purple:'#a371f7',
  text:'#e6edf3',textMuted:'#7d8590',textDim:'#484f58',white:'#ffffff',
}

function pct(p: number) { return `${(p*100).toFixed(1)}%` }

// A stat card for one side of a 2-way split (Attention Zone in/out, Direction same/reversal).
function StatCard({ stat, highlight }: { stat: EvPrincipleStat, highlight?: boolean }) {
  return (
    <div style={{background:C.bg2,border:`1px solid ${highlight?C.gold:C.border}`,borderRadius:10,padding:14,flex:1,minWidth:200}}>
      <div style={{fontSize:12,fontWeight:700,color:highlight?C.gold:C.text,marginBottom:10}}>{stat.label}</div>
      <div style={{display:'flex',flexDirection:'column' as const,gap:8}}>
        {[
          {l:'Whiff Rate', v:stat.whiffRate, fmt:pct, c:C.blue},
          {l:'Hard-Hit Rate (of BIP)', v:stat.hardHitRate, fmt:pct, c:C.red},
          {l:'Barrel Rate (of BIP)', v:stat.barrelRate, fmt:pct, c:C.purple},
          {l:'Mean Run Value', v:stat.runValue, fmt:(x:number)=>`${x>=0?'+':''}${x.toFixed(4)}`, c:C.teal},
        ].map(row=>(
          <div key={row.l} style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
            <span style={{fontSize:11,color:C.textMuted}}>{row.l}</span>
            {row.v ? (
              <span style={{textAlign:'right' as const}}>
                <span style={{fontWeight:700,color:row.c,fontSize:13}}>{row.fmt(('p' in row.v ? row.v.p : row.v.mean) as number)}</span>
                <div style={{fontSize:9,color:C.textDim}}>n={row.v.n.toLocaleString()}</div>
              </span>
            ) : <span style={{fontSize:11,color:C.textDim}}>insufficient sample</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function FitRow({ label, fit }: { label: string, fit: WeightedFit | null }) {
  if (!fit) return null
  const strength = Math.abs(fit.r) >= 0.6 ? 'strong' : Math.abs(fit.r) >= 0.3 ? 'moderate' : 'weak'
  const strengthColor = Math.abs(fit.r) >= 0.6 ? C.gold : Math.abs(fit.r) >= 0.3 ? C.blue : C.textDim
  return (
    <tr style={{borderBottom:`1px solid ${C.border}`}}>
      <td style={{padding:'8px 10px',fontSize:12,color:C.text}}>{label}</td>
      <td style={{padding:'8px 10px',textAlign:'right' as const,fontFamily:'monospace',fontSize:12,color:C.text}}>{fit.r>=0?'+':''}{fit.r.toFixed(2)}</td>
      <td style={{padding:'8px 10px',textAlign:'right' as const}}>
        <span style={{fontSize:11,fontWeight:700,color:strengthColor,textTransform:'uppercase' as const,letterSpacing:'0.5px'}}>{strength}</span>
      </td>
    </tr>
  )
}

export default function EffectiveVelocityTool(){
  const supabase = createClient()
  const [rows,setRows] = useState<EvPairRow[]>([])
  const [loading,setLoading] = useState(true)

  useEffect(()=>{
    let cancelled = false
    fetchAllRows(supabase, 'bs_ev_pairs').then(data => {
      if (cancelled) return
      setRows(data)
      setLoading(false)
    })
    return ()=>{cancelled=true}
  },[])

  const { zoneSplit, dirSplit, evCurve, actCurve, fits, chartData } = useMemo(() => {
    const zoneSplit = evAttentionZoneSplit(rows)
    const dirSplit = evDirectionSplit(rows)
    const evCurve = evDiffCurve(rows)
    const actCurve = actualDiffCurve(rows)
    const fits = {
      hardHitEv: fitCurve(evCurve, s => s.hardHitRate?.p ?? null),
      hardHitAct: fitCurve(actCurve, s => s.hardHitRate?.p ?? null),
      whiffEv: fitCurve(evCurve, s => s.whiffRate?.p ?? null),
      whiffAct: fitCurve(actCurve, s => s.whiffRate?.p ?? null),
      runValueEv: fitCurve(evCurve, s => s.runValue?.mean ?? null),
      runValueAct: fitCurve(actCurve, s => s.runValue?.mean ?? null),
    }
    // Merge both curves into one recharts dataset keyed by bucket value (they're on
    // different underlying scales — perceived vs. raw mph — but both plotted as "mph
    // differential" on a shared x-axis for direct visual comparison).
    const byBucket = new Map<number, any>()
    for (const p of evCurve) {
      if (p.stat.n < MIN_RENDER_N) continue
      byBucket.set(p.bucket, { bucket: p.bucket, evHardHit: p.stat.hardHitRate?.p, evWhiff: p.stat.whiffRate?.p })
    }
    for (const p of actCurve) {
      if (p.stat.n < MIN_RENDER_N) continue
      const existing = byBucket.get(p.bucket) || { bucket: p.bucket }
      byBucket.set(p.bucket, { ...existing, actHardHit: p.stat.hardHitRate?.p, actWhiff: p.stat.whiffRate?.p })
    }
    const chartData = [...byBucket.values()].sort((a,b)=>a.bucket-b.bucket)
    return { zoneSplit, dirSplit, evCurve, actCurve, fits, chartData }
  }, [rows])

  if (loading) return <div style={{textAlign:'center' as const,padding:30,color:C.textMuted,fontSize:13}}>Loading...</div>

  return (
    <div style={{color:C.text,fontSize:13}}>
      <div style={{fontSize:16,fontWeight:700,color:C.gold,marginBottom:4}}>Effective Velocity</div>
      <div style={{fontSize:11,color:C.textMuted,marginBottom:6,lineHeight:1.6}}>
        Testing Perry Husband's Effective Velocity theory — that a pitch's <i>location</i> shifts its perceived speed (up-and-in plays faster, down-and-away plays slower), and that sequencing pitches by perceived-speed change, not just radar speed, is what actually suppresses hard contact.
      </div>
      <div style={{fontSize:10,color:C.textDim,marginBottom:16,lineHeight:1.6}}>
        This computes Husband's own formula faithfully (his published 2.75 mph/6in coefficient, verified plate_x sign convention) but doesn't assume his conclusions — every number below is measured fresh against our real 2026 first-half data, the same way an independent large-sample re-test (Driveline Baseball, 2.8M+ MLB pitches) did at the full-league level. Bivariate view only (no count/matchup control, unlike that re-test) — a documented scope limit, not a final word.
      </div>

      <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:8,marginTop:20}}>Sequencing Threshold — Husband's ±{ATTENTION_ZONE_MPH} EV mph "Danger Zone"</div>
      <div style={{display:'flex',gap:10,flexWrap:'wrap' as const,marginBottom:20}}>
        <StatCard stat={zoneSplit.within} highlight/>
        <StatCard stat={zoneSplit.outside}/>
      </div>

      <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:8}}>Direction of Change — Reversal vs. Same-Direction Step</div>
      <div style={{display:'flex',gap:10,flexWrap:'wrap' as const,marginBottom:20}}>
        <StatCard stat={dirSplit.same}/>
        <StatCard stat={dirSplit.reversal}/>
      </div>

      <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:4}}>Hard-Hit Rate by Differential</div>
      <div style={{fontSize:10,color:C.textDim,marginBottom:8,lineHeight:1.5}}>Perceived (EV) speed change vs. raw radar speed change from the previous pitch — which one actually tracks hard contact?</div>
      <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:10,padding:'14px 8px',marginBottom:16}}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{top:4,right:12,left:0,bottom:4}}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
            <XAxis dataKey="bucket" tick={{fill:C.textMuted,fontSize:10}} label={{value:'mph differential',position:'insideBottom',offset:-4,fill:C.textDim,fontSize:10}}/>
            <YAxis tickFormatter={(v)=>`${Math.round(v*100)}%`} tick={{fill:C.textMuted,fontSize:10}} domain={[0,'auto']}/>
            <Tooltip contentStyle={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:6,fontSize:11}} formatter={(v:any)=>v!=null?`${(v*100).toFixed(1)}%`:'—'}/>
            <Legend wrapperStyle={{fontSize:11}}/>
            <Line type="monotone" dataKey="evHardHit" name="EV (perceived) diff" stroke={C.gold} dot={false} strokeWidth={2} connectNulls/>
            <Line type="monotone" dataKey="actHardHit" name="Raw velo diff" stroke={C.blue} dot={false} strokeWidth={2} connectNulls/>
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:4}}>Whiff Rate by Differential</div>
      <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:10,padding:'14px 8px',marginBottom:20}}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{top:4,right:12,left:0,bottom:4}}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
            <XAxis dataKey="bucket" tick={{fill:C.textMuted,fontSize:10}} label={{value:'mph differential',position:'insideBottom',offset:-4,fill:C.textDim,fontSize:10}}/>
            <YAxis tickFormatter={(v)=>`${Math.round(v*100)}%`} tick={{fill:C.textMuted,fontSize:10}} domain={[0,'auto']}/>
            <Tooltip contentStyle={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:6,fontSize:11}} formatter={(v:any)=>v!=null?`${(v*100).toFixed(1)}%`:'—'}/>
            <Legend wrapperStyle={{fontSize:11}}/>
            <Line type="monotone" dataKey="evWhiff" name="EV (perceived) diff" stroke={C.gold} dot={false} strokeWidth={2} connectNulls/>
            <Line type="monotone" dataKey="actWhiff" name="Raw velo diff" stroke={C.blue} dot={false} strokeWidth={2} connectNulls/>
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:8}}>The Weights — Sample-Weighted Correlation, Our Data</div>
      <div style={{fontSize:10,color:C.textDim,marginBottom:8,lineHeight:1.5}}>
        How strongly each differential actually tracks each outcome (r, weighted by bucket sample size) — this is what "effectiveness" means here: a measured relationship, not an assumed one.
      </div>
      <div style={{overflowX:'auto' as const,marginBottom:16}}>
        <table style={{width:'100%',borderCollapse:'collapse' as const,minWidth:420}}>
          <thead>
            <tr style={{borderBottom:`1px solid ${C.border}`}}>
              <th style={{textAlign:'left' as const,padding:'8px 10px',fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px'}}>Relationship</th>
              <th style={{textAlign:'right' as const,padding:'8px 10px',fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px'}}>r</th>
              <th style={{textAlign:'right' as const,padding:'8px 10px',fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px'}}>Strength</th>
            </tr>
          </thead>
          <tbody>
            <FitRow label="Hard-hit rate ~ EV diff" fit={fits.hardHitEv}/>
            <FitRow label="Hard-hit rate ~ raw velo diff" fit={fits.hardHitAct}/>
            <FitRow label="Whiff rate ~ EV diff" fit={fits.whiffEv}/>
            <FitRow label="Whiff rate ~ raw velo diff" fit={fits.whiffAct}/>
            <FitRow label="Run value ~ EV diff" fit={fits.runValueEv}/>
            <FitRow label="Run value ~ raw velo diff" fit={fits.runValueAct}/>
          </tbody>
        </table>
      </div>

      <div style={{fontSize:10,color:C.textDim,lineHeight:1.6,borderTop:`1px solid ${C.border}`,paddingTop:12}}>
        Sources: Perry Husband's Effective Velocity theory as described by <a href="https://fantasy.fangraphs.com/the-interplay-of-velocity-and-effective-velocity/" target="_blank" rel="noopener noreferrer" style={{color:C.blue}}>FanGraphs</a> and <a href="https://pitcherlist.com/going-deep-a-example-in-the-practice-of-effective-velocity/" target="_blank" rel="noopener noreferrer" style={{color:C.blue}}>Pitcher List</a>; independent statistical re-test by <a href="https://www.drivelinebaseball.com/2019/05/calling-right-pitch-investigating-effective-velocity-mlb-level/" target="_blank" rel="noopener noreferrer" style={{color:C.blue}}>Driveline Baseball</a> (2.8M+ MLB pitches, 2015-2018). This tool reproduces that re-test's method against our own 2026 first-half data rather than citing either source's numbers directly.
      </div>
    </div>
  )
}
