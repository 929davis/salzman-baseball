'use client'
import { useEffect, useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { fetchAllRows, MIN_RENDER_N } from '@/lib/baseScenario'
import {
  evAttentionZoneSplit, evDirectionSplit, evDiffCurve, actualDiffCurve, fitCurve,
  ATTENTION_ZONE_MPH, type EvPairRow, type EvPrincipleStat, type WeightedFit,
} from '@/lib/effectiveVelocity'
import {
  anchorDiffCurve, anchorZoneSplit, ANCHOR_ZONE_MPH,
  type AnchorPairRow, type AnchorStat, type AnchorType,
} from '@/lib/anchorModel'
import HowToReadPanel from '@/app/components/HowToReadPanel'

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

// A stat card for the At-Bat Anchor Model's near/far split — more rows than StatCard since
// this model tracks chase/K-looking/K-swinging on top of the previous-pitch model's set.
function AnchorStatCard({ stat, highlight }: { stat: AnchorStat, highlight?: boolean }) {
  return (
    <div style={{background:C.bg2,border:`1px solid ${highlight?C.gold:C.border}`,borderRadius:10,padding:14,flex:1,minWidth:200}}>
      <div style={{fontSize:12,fontWeight:700,color:highlight?C.gold:C.text,marginBottom:10}}>{stat.label}</div>
      <div style={{display:'flex',flexDirection:'column' as const,gap:8}}>
        {[
          {l:'Whiff Rate', v:stat.whiffRate, fmt:pct, c:C.blue},
          {l:'Chase Rate (of out-of-zone)', v:stat.chaseRate, fmt:pct, c:C.purple},
          {l:'Hard-Hit Rate (of BIP)', v:stat.hardHitRate, fmt:pct, c:C.red},
          {l:'Barrel Rate (of BIP)', v:stat.barrelRate, fmt:pct, c:C.purple},
          {l:'Strikeout Looking', v:stat.kLookingRate, fmt:pct, c:C.textMuted},
          {l:'Strikeout Swinging', v:stat.kSwingingRate, fmt:pct, c:C.textMuted},
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

function TimingReadRow({ label, stat, color }: { label: string, stat: AnchorStat['pullRate'], color: string }) {
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',padding:'5px 0',borderBottom:`1px solid ${C.border}`}}>
      <span style={{fontSize:11,color:C.textMuted}}>{label}</span>
      {stat ? <span style={{fontSize:12,fontWeight:700,color}}>{pct(stat.p)} <span style={{fontSize:9,color:C.textDim,fontWeight:400}}>n={stat.n.toLocaleString()}</span></span> : <span style={{fontSize:11,color:C.textDim}}>insufficient sample</span>}
    </div>
  )
}

function HowToReadAnchor() {
  return (
    <HowToReadPanel title="How to Read the At-Bat Anchor Model">
      <div>
        The Sequencing Threshold above tests Husband's claim using only the ONE pitch right before this one. This section asks a related but different question: what if a hitter is sitting on a speed built from EVERYTHING he's swung at so far this at-bat, not just the last pitch?
      </div>
      <div>
        <b>Running Average</b> anchor = the average perceived speed (EV) of every pitch he's swung at earlier in this at-bat. <b>Mode</b> anchor = the specific speed tier (nearest 3mph) he's swung at MOST OFTEN so far — closer to "he's seen this exact speed twice, he's keying on it" than a blended average.
      </div>
      <div>
        Takes don't move either anchor — if he didn't swing, we don't know where his timing actually was, so that pitch is skipped when building the anchor (it still gets evaluated AGAINST the anchor, just doesn't update it). A pitch with no prior swing this at-bat (e.g. the very first pitch) has no anchor at all and is excluded rather than defaulted to zero.
      </div>
      <div>
        <b>Timing Read (Pull/Center/Opposite)</b> only applies to balls hit into play — pulled = read as early, opposite field = read as late, center = on-time. This needs real hit-coordinate data that only exists for balls actually in play, so fouls and whiffs don't get a timing tag.
      </div>
      <div>
        <b>Miss Location (whiffs only)</b> reports where in the zone (high/middle/low) a swing-and-miss happened instead — a different, answerable question for the one case (no contact) where a timing read isn't possible.
      </div>
      <div>
        <b>Pull-Side Rollover Ground Balls</b> are pulled grounders — the classic "rolled over and missed it" weak-contact pattern. Rather than asserting they're "low value" from an invented cutoff, its <b>Mean Run Value</b> is computed from that subset's own real outcomes — the number itself shows whether it's actually bad for the hitter.
      </div>
      <div style={{ color:C.textDim, fontSize:11 }}>
        <b>What this isn't:</b> validated against any published model — this is our own operationalization of the "Attention Instinct" idea discussed for this app, tested against our real 2026 data the same way the previous-pitch model above is, not a reproduction of anyone else's published anchor-speed formula.
      </div>
    </HowToReadPanel>
  )
}

function HowToRead() {
  return (
    <HowToReadPanel title="How to Read Effective Velocity">
      <div>
        <b style={{ color: C.gold }}>Effective Velocity (EV)</b> is a pitch's radar-gun speed adjusted for where it crossed the zone. Up-and-in pitches play <i>faster</i> than the gun says, down-and-away pitches play <i>slower</i> — same raw mph, different amount of time the hitter actually gets to react given the angle the ball comes in on. A 92mph pitch up-and-in and a 92mph pitch down-and-away are NOT the same pitch to a hitter's timing, even though the gun reads identically. Everything below is that adjusted number, not the raw radar speed.
      </div>
      <div>
        <b>Sequencing Threshold</b> tests Husband's headline claim: hitters do the most damage when a pitch's EV is close (within {ATTENTION_ZONE_MPH} mph) to the <i>previous</i> pitch's EV — i.e., no real timing adjustment was required. The two cards split every pitch pair into "didn't need to adjust" vs. "did," so you can see whether that actually shows up in whiff/hard-hit/barrel/run-value rates in our own data, not just take the claim on faith.
      </div>
      <div>
        <b>Direction of Change</b> asks a related but different question: does <i>reversing</i> direction (a pitch that played faster, then one that plays slower, or vice versa) suppress contact more than moving the same direction by a similar amount? Same-size change, different pattern.
      </div>
      <div>
        On each card: <b>Whiff Rate</b> is share of all pitches in that group that got swung through. <b>Hard-Hit Rate</b> and <b>Barrel Rate</b> are of balls actually put in play only (BIP) — taken/foul pitches aren't in that denominator. <b>Mean Run Value</b> uses the same sign convention as the rest of this app: positive is good <i>for the hitter</i>, so a pitcher wants to see this number low or negative, not high. A card reading "insufficient sample" just means too few real pitches landed in that bucket to show a rate without it being misleadingly precise — not zero data, just not enough yet.
      </div>
      <div>
        <b>The two charts</b> plot the same two outcomes (hard-hit rate, whiff rate) against two different x-axes side by side: the gold line is EV (perceived) speed change from the prior pitch, the blue line is plain raw radar speed change. If EV really is the better predictor, its line should show a cleaner/stronger relationship than raw velocity's — that's a visual version of the same test the table below does with numbers.
      </div>
      <div>
        <b>The Weights table</b> — r is a correlation from -1 to +1; the sign says which direction, the size says how strong. Near 0 means the relationship isn't really there in our data regardless of what the line looked like. Strong/moderate/weak are just r ≥0.6 / ≥0.3 / below that, and each r is weighted so bigger, more reliable buckets count more than thin ones.
      </div>
      <div style={{ color: C.textDim, fontSize: 11 }}>
        <b>What this isn't:</b> Husband's own patented zone chart or published numbers — this is an independent re-test of his underlying claim against our own real pitches, the same kind of check Driveline Baseball's league-wide re-analysis did (cited below). It's also a bivariate view only — no count or matchup control — so treat a real relationship here as a lead worth digging into, not a finished causal claim.
      </div>
    </HowToReadPanel>
  )
}

function FitRow({ label, fit }: { label: string, fit: WeightedFit | null }) {
  if (!fit) return null
  const strength = Math.abs(fit.r) >= 0.6 ? 'Strong' : Math.abs(fit.r) >= 0.3 ? 'Moderate' : 'Weak'
  const strengthColor = Math.abs(fit.r) >= 0.6 ? C.gold : Math.abs(fit.r) >= 0.3 ? C.blue : C.textDim
  return (
    <tr style={{borderBottom:`1px solid ${C.border}`}}>
      <td style={{padding:'8px 10px',fontSize:12,color:C.text}}>{label}</td>
      <td style={{padding:'8px 10px',textAlign:'right' as const}}>
        <span style={{fontSize:12,fontWeight:700,color:strengthColor}}>{strength}</span>
      </td>
      <td style={{padding:'8px 10px',textAlign:'right' as const,fontFamily:'monospace',fontSize:11,color:C.textDim}}>{fit.r>=0?'+':''}{fit.r.toFixed(2)}</td>
    </tr>
  )
}

export default function EffectiveVelocityTool(){
  const supabase = createClient()
  const [rows,setRows] = useState<EvPairRow[]>([])
  const [anchorRows,setAnchorRows] = useState<AnchorPairRow[]>([])
  const [anchorType,setAnchorType] = useState<AnchorType>('running_avg')
  const [loading,setLoading] = useState(true)

  useEffect(()=>{
    let cancelled = false
    Promise.all([
      fetchAllRows(supabase, 'bs_ev_pairs'),
      fetchAllRows(supabase, 'bs_anchor_pairs'),
    ]).then(([evData,anchorData]) => {
      if (cancelled) return
      setRows(evData)
      setAnchorRows(anchorData)
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

  const { anchorSplit, anchorCurve, anchorChartData } = useMemo(() => {
    const anchorSplit = anchorZoneSplit(anchorRows, anchorType)
    const anchorCurve = anchorDiffCurve(anchorRows, anchorType)
    const anchorChartData = anchorCurve
      .filter(p => p.stat.n >= MIN_RENDER_N)
      .map(p => ({ bucket: p.bucket, whiff: p.stat.whiffRate?.p, hardHit: p.stat.hardHitRate?.p }))
    return { anchorSplit, anchorCurve, anchorChartData }
  }, [anchorRows, anchorType])

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

      <HowToRead/>

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

      <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:8}}>The Weights — How Strongly Each One Actually Shows Up</div>
      <div style={{fontSize:10,color:C.textDim,marginBottom:8,lineHeight:1.5}}>
        How strongly each differential actually tracks each outcome in our data (weighted so bigger, more reliable buckets count more than thin ones) — this is what "effectiveness" means here: a measured relationship, not an assumed one. <b>Strong/Moderate/Weak</b> is the number that matters; the small "r" value next to it is the underlying correlation stat (-1 to +1) for anyone who wants it.
      </div>
      <div style={{overflowX:'auto' as const,marginBottom:16}}>
        <table style={{width:'100%',borderCollapse:'collapse' as const,minWidth:420}}>
          <thead>
            <tr style={{borderBottom:`1px solid ${C.border}`}}>
              <th style={{textAlign:'left' as const,padding:'8px 10px',fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px'}}>Relationship</th>
              <th style={{textAlign:'right' as const,padding:'8px 10px',fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px'}}>Strength</th>
              <th style={{textAlign:'right' as const,padding:'8px 10px',fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px'}}>r</th>
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

      <div style={{height:1,background:C.border,margin:'28px 0 20px'}}/>

      <div style={{fontSize:16,fontWeight:700,color:C.gold,marginBottom:4}}>At-Bat Anchor Model</div>
      <div style={{fontSize:11,color:C.textMuted,marginBottom:16,lineHeight:1.6}}>
        Everything above tests the pitch right before this one. This section asks a broader version of the same question: a hitter may be sitting on a speed built from everything he's swung at so far THIS at-bat, not just the last pitch — closer to Husband's own "Attention Instinct" idea than a strict previous-pitch comparison.
      </div>

      <HowToReadAnchor/>

      <div style={{display:'flex',gap:6,marginBottom:16,marginTop:16}}>
        {(['running_avg','mode'] as const).map(t=>(
          <button key={t} onClick={()=>setAnchorType(t)} style={{background:anchorType===t?C.gold:C.bg3,color:anchorType===t?C.bg:C.textMuted,border:`1px solid ${anchorType===t?C.gold:C.border}`,borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:anchorType===t?700:400,cursor:'pointer'}}>
            {t==='running_avg'?'Running Average Anchor':'Most-Repeated-Speed (Mode) Anchor'}
          </button>
        ))}
      </div>

      <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:8}}>Distance From Anchor — Full Outcome Set</div>
      <div style={{display:'flex',gap:10,flexWrap:'wrap' as const,marginBottom:20}}>
        <AnchorStatCard stat={anchorSplit.within} highlight/>
        <AnchorStatCard stat={anchorSplit.outside}/>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:12,marginBottom:20}}>
        <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:10,padding:14}}>
          <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:2}}>Timing Read — Contact Only</div>
          <div style={{fontSize:9,color:C.textDim,marginBottom:10}}>Pull = Early · Center = On-Time · Opposite = Late (balls in play only — no contact, no read)</div>
          <div style={{fontSize:10,color:C.gold,marginBottom:4,fontWeight:700}}>{anchorSplit.within.label}</div>
          <TimingReadRow label="Pull (Early)" stat={anchorSplit.within.pullRate} color={C.blue}/>
          <TimingReadRow label="Center (On-Time)" stat={anchorSplit.within.centerRate} color={C.teal}/>
          <TimingReadRow label="Opposite (Late)" stat={anchorSplit.within.oppoRate} color={C.purple}/>
          <div style={{fontSize:10,color:C.gold,marginTop:10,marginBottom:4,fontWeight:700}}>{anchorSplit.outside.label}</div>
          <TimingReadRow label="Pull (Early)" stat={anchorSplit.outside.pullRate} color={C.blue}/>
          <TimingReadRow label="Center (On-Time)" stat={anchorSplit.outside.centerRate} color={C.teal}/>
          <TimingReadRow label="Opposite (Late)" stat={anchorSplit.outside.oppoRate} color={C.purple}/>
        </div>
        <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:10,padding:14}}>
          <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:2}}>Miss Location — Whiffs Only</div>
          <div style={{fontSize:9,color:C.textDim,marginBottom:10}}>Vertical zone location of the pitch he swung through (no contact = no pull/center/opposite read)</div>
          <div style={{fontSize:10,color:C.gold,marginBottom:4,fontWeight:700}}>{anchorSplit.within.label}</div>
          <TimingReadRow label="High" stat={anchorSplit.within.whiffHighRate} color={C.blue}/>
          <TimingReadRow label="Middle" stat={anchorSplit.within.whiffMiddleRate} color={C.teal}/>
          <TimingReadRow label="Low" stat={anchorSplit.within.whiffLowRate} color={C.purple}/>
          <div style={{fontSize:10,color:C.gold,marginTop:10,marginBottom:4,fontWeight:700}}>{anchorSplit.outside.label}</div>
          <TimingReadRow label="High" stat={anchorSplit.outside.whiffHighRate} color={C.blue}/>
          <TimingReadRow label="Middle" stat={anchorSplit.outside.whiffMiddleRate} color={C.teal}/>
          <TimingReadRow label="Low" stat={anchorSplit.outside.whiffLowRate} color={C.purple}/>
        </div>
      </div>

      <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:10,padding:14,marginBottom:20}}>
        <div style={{fontSize:11,fontWeight:700,color:C.text,marginBottom:2}}>Pull-Side Rollover Ground Balls</div>
        <div style={{fontSize:9,color:C.textDim,marginBottom:10}}>The classic "rolled over and missed it" weak-contact pattern — rate of balls in play, and that subset's own real run value (not an invented low-xBA cutoff)</div>
        <div style={{display:'flex',gap:16,flexWrap:'wrap' as const}}>
          {[anchorSplit.within, anchorSplit.outside].map(s=>(
            <div key={s.label} style={{flex:1,minWidth:180}}>
              <div style={{fontSize:10,color:C.gold,marginBottom:6,fontWeight:700}}>{s.label}</div>
              <div style={{display:'flex',justifyContent:'space-between',padding:'4px 0'}}>
                <span style={{fontSize:11,color:C.textMuted}}>Rate (of BIP)</span>
                {s.pullGroundBallRate ? <span style={{fontSize:12,fontWeight:700,color:C.text}}>{pct(s.pullGroundBallRate.p)}</span> : <span style={{fontSize:11,color:C.textDim}}>insufficient sample</span>}
              </div>
              <div style={{display:'flex',justifyContent:'space-between',padding:'4px 0'}}>
                <span style={{fontSize:11,color:C.textMuted}}>Mean Run Value</span>
                {s.pullGroundBallRunValue ? <span style={{fontSize:12,fontWeight:700,color:C.teal}}>{s.pullGroundBallRunValue.mean>=0?'+':''}{s.pullGroundBallRunValue.mean.toFixed(4)}</span> : <span style={{fontSize:11,color:C.textDim}}>insufficient sample</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{fontSize:12,fontWeight:700,color:C.text,marginBottom:4}}>Whiff & Hard-Hit Rate by Distance From Anchor</div>
      <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:10,padding:'14px 8px',marginBottom:20}}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={anchorChartData} margin={{top:4,right:12,left:0,bottom:4}}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
            <XAxis dataKey="bucket" tick={{fill:C.textMuted,fontSize:10}} label={{value:'mph from anchor',position:'insideBottom',offset:-4,fill:C.textDim,fontSize:10}}/>
            <YAxis tickFormatter={(v)=>`${Math.round(v*100)}%`} tick={{fill:C.textMuted,fontSize:10}} domain={[0,'auto']}/>
            <Tooltip contentStyle={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:6,fontSize:11}} formatter={(v:any)=>v!=null?`${(v*100).toFixed(1)}%`:'—'}/>
            <Legend wrapperStyle={{fontSize:11}}/>
            <Line type="monotone" dataKey="hardHit" name="Hard-hit rate" stroke={C.red} dot={false} strokeWidth={2} connectNulls/>
            <Line type="monotone" dataKey="whiff" name="Whiff rate" stroke={C.blue} dot={false} strokeWidth={2} connectNulls/>
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{fontSize:10,color:C.textDim,lineHeight:1.6,borderTop:`1px solid ${C.border}`,paddingTop:12}}>
        Sources: Perry Husband's Effective Velocity theory as described by <a href="https://fantasy.fangraphs.com/the-interplay-of-velocity-and-effective-velocity/" target="_blank" rel="noopener noreferrer" style={{color:C.blue}}>FanGraphs</a> and <a href="https://pitcherlist.com/going-deep-a-example-in-the-practice-of-effective-velocity/" target="_blank" rel="noopener noreferrer" style={{color:C.blue}}>Pitcher List</a>; independent statistical re-test by <a href="https://www.drivelinebaseball.com/2019/05/calling-right-pitch-investigating-effective-velocity-mlb-level/" target="_blank" rel="noopener noreferrer" style={{color:C.blue}}>Driveline Baseball</a> (2.8M+ MLB pitches, 2015-2018). This tool reproduces that re-test's method against our own 2026 first-half data rather than citing either source's numbers directly. The At-Bat Anchor Model above is our own extension, not a published source's model.
      </div>
    </div>
  )
}
