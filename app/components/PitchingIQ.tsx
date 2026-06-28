'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const C = {
  bg:'#0d1117',bg2:'#161b22',bg3:'#1c2333',border:'#30363d',
  gold:'#e8b84b',goldDim:'#a07c28',goldBg:'rgba(232,184,75,0.08)',
  teal:'#39d353',red:'#f85149',blue:'#58a6ff',purple:'#a371f7',
  text:'#e6edf3',textMuted:'#7d8590',textDim:'#484f58',white:'#ffffff',
}
const ARM_BUCKETS = ['all','submarine','sidearm','low_three_quarter','three_quarter','high_three_quarter','overhand']
const ARM_LABELS:Record<string,string> = {
  all:'All',submarine:'Submarine',sidearm:'Sidearm',
  low_three_quarter:'Low 3/4',three_quarter:'3/4',
  high_three_quarter:'High 3/4',overhand:'Overhand',
}
const COUNT_BUCKETS = ['all','0-2','1-2','2-2','3-2','even','ahead','behind']
const METRICS = ['whiff','chase','hard_hit','xwoba']
const METRIC_LABELS:Record<string,string> = {
  whiff:'Whiff %',chase:'Chase %',hard_hit:'Hard-hit %',xwoba:'xwOBA',
}
const ZONE_GRID = [
  [null,11,12,13,null],
  [14,1,2,3,14],
  [14,4,5,6,14],
  [14,7,8,9,14],
  [null,14,14,14,null],
]
const ZONE_LABELS:Record<number,string> = {
  1:'Up-in',2:'Up-middle',3:'Up-away',
  4:'Mid-in',5:'Heart',6:'Mid-away',
  7:'Low-in',8:'Low-middle',9:'Low-away',
  11:'High (above zone)',12:'High-middle (above zone)',
  13:'High-away (above zone)',14:'Shadow/chase zone (off plate — all sides including low)',
}
type ZoneData = Record<number,{whiff:number,chase:number,hard_hit:number,xwoba:number,count:number}>
type ChaseRow = {pitch_type:string,chase_pct:number,whiff_pct:number,hard_hit_pct:number,xwoba:number,count:number}
type PitchRank = {pitch_type:string,value:number,count:number}

function heatColor(val:number,min:number,max:number):string {
  if (max===min) return '#1c2333'
  const t=(val-min)/(max-min)
  const r=Math.round(59+t*(248-59))
  const g=Math.round(130-t*(130-81))
  const b=Math.round(246-t*(246-73))
  return `rgb(${r},${g},${b})`
}
function textForBg(val:number,min:number,max:number):string {
  if (max===min) return '#7d8590'
  const t=(val-min)/(max-min)
  return t>0.45?'#ffffff':'#e6edf3'
}

export default function PitchingIQ() {
  const supabase=createClient()
  const [loading,setLoading]=useState(true)
  const [bats,setBats]=useState<'R'|'L'>('R')
  const [armBucket,setArmBucket]=useState('all')
  const [countBucket,setCountBucket]=useState('all')
  const [metric,setMetric]=useState('whiff')
  const [pitchFilter,setPitchFilter]=useState('all')
  const [pThrows,setPThrows]=useState('all')
  const [swingPath,setSwingPath]=useState('all')
  const [zoneData,setZoneData]=useState<ZoneData>({})
  const [chaseRows,setChaseRows]=useState<ChaseRow[]>([])
  const [pitchRanks,setPitchRanks]=useState<PitchRank[]>([])
  const [pitchTypes,setPitchTypes]=useState<string[]>([])
  const [lastUpdated,setLastUpdated]=useState('')
  const [selectedChase,setSelectedChase]=useState<ChaseRow|null>(null)
  const [insight,setInsight]=useState('')

  const fetchData=useCallback(async()=>{
    setLoading(true)
    try {
      const filters:{[key:string]:string}={bats}
      if (armBucket!=='all') filters.arm_angle_bucket=armBucket
      if (countBucket!=='all') filters.count_bucket=countBucket
      if (pitchFilter!=='all') filters.pitch_type=pitchFilter

      let q=supabase.from('statcast_pitches').select('zone,description,launch_speed,estimated_woba,arm_angle_bucket,count_bucket,pitch_type,game_date,attack_angle,p_throws').eq('bats',bats)
      if (armBucket!=='all') q=q.eq('arm_angle_bucket',armBucket)
      if (countBucket!=='all') q=q.eq('count_bucket',countBucket)
      if (pitchFilter!=='all') q=q.eq('pitch_type',pitchFilter)
      if (pThrows!=='all') q=q.eq('p_throws',pThrows)
      if (swingPath==='flat') q=q.lt('attack_angle',10)
      else if (swingPath==='slight') q=q.gte('attack_angle',10).lt('attack_angle',25)
      else if (swingPath==='uppercut') q=q.gte('attack_angle',25)
      const {data,error}=await q.limit(50000)
      if (error||!data){setLoading(false);return}

      const dates=data.map((r:any)=>r.game_date).filter(Boolean).sort()
      if (dates.length>0){
        const d=new Date(dates[dates.length-1])
        setLastUpdated(d.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}))
      }

      const types=[...new Set(data.map((r:any)=>r.pitch_type).filter(Boolean))].sort()
      setPitchTypes(types as string[])

      const zd:ZoneData={}
      const pitchMap:Record<string,{whiffs:number,swings:number,chases:number,outOfZone:number,hardHits:number,contact:number,xwobaSum:number,xwobaCount:number}>={}

      for (const row of data as any[]) {
        const zone=row.zone
        const desc=row.description||''
        const ev=row.launch_speed
        const xwoba=row.estimated_woba
        const isSwing=['swinging_strike','swinging_strike_blocked','foul','foul_tip','hit_into_play','hit_into_play_no_out','hit_into_play_score'].includes(desc)
        const isWhiff=['swinging_strike','swinging_strike_blocked'].includes(desc)
        const isContact=['hit_into_play','hit_into_play_no_out','hit_into_play_score'].includes(desc)
        const isHardHit=isContact&&ev!==null&&ev>=95
        const isOutOfZone=zone>=10
        const isChase=isSwing&&isOutOfZone
        if (!zone) continue
        if (!zd[zone]) zd[zone]={whiff:0,chase:0,hard_hit:0,xwoba:0,count:0}
        zd[zone].count++
        if (isWhiff) zd[zone].whiff++
        if (isChase) zd[zone].chase++
        if (isHardHit) zd[zone].hard_hit++
        if (xwoba!==null) zd[zone].xwoba+=xwoba
        const pt=row.pitch_type
        if (!pt) continue
        if (!pitchMap[pt]) pitchMap[pt]={whiffs:0,swings:0,chases:0,outOfZone:0,hardHits:0,contact:0,xwobaSum:0,xwobaCount:0}
        if (isSwing) pitchMap[pt].swings++
        if (isWhiff) pitchMap[pt].whiffs++
        if (isOutOfZone) pitchMap[pt].outOfZone++
        if (isChase) pitchMap[pt].chases++
        if (isContact) pitchMap[pt].contact++
        if (isHardHit) pitchMap[pt].hardHits++
        if (xwoba!==null){pitchMap[pt].xwobaSum+=xwoba;pitchMap[pt].xwobaCount++}
      }

      const zdFinal:ZoneData={}
      for (const [z,d] of Object.entries(zd)) {
        const zone=Number(z)
        const isOut=zone>=10
        zdFinal[zone]={
          whiff:d.count>0?(d.whiff/d.count)*100:0,
          chase:isOut&&d.count>0?(d.chase/d.count)*100:0,
          hard_hit:d.count>0?(d.hard_hit/d.count)*100:0,
          xwoba:d.count>0?d.xwoba/d.count:0,
          count:d.count,
        }
      }
      setZoneData(zdFinal)

      const chaseList:ChaseRow[]=[]
      for (const [pt,d] of Object.entries(pitchMap)) {
        if (d.outOfZone<20) continue
        chaseList.push({
          pitch_type:pt,
          chase_pct:d.outOfZone>0?(d.chases/d.outOfZone)*100:0,
          whiff_pct:d.swings>0?(d.whiffs/d.swings)*100:0,
          hard_hit_pct:d.contact>0?(d.hardHits/d.contact)*100:0,
          xwoba:d.xwobaCount>0?d.xwobaSum/d.xwobaCount:0,
          count:d.outOfZone,
        })
      }
      chaseList.sort((a,b)=>b.chase_pct-a.chase_pct)
      setChaseRows(chaseList)
      if (chaseList.length>0) setSelectedChase(chaseList[0])

      const ranks:PitchRank[]=[]
      for (const [pt,d] of Object.entries(pitchMap)) {
        if (d.swings<20) continue
        let value=0
        if (metric==='whiff') value=d.swings>0?(d.whiffs/d.swings)*100:0
        else if (metric==='chase') value=d.outOfZone>0?(d.chases/d.outOfZone)*100:0
        else if (metric==='hard_hit') value=d.contact>0?(d.hardHits/d.contact)*100:0
        else if (metric==='xwoba') value=d.xwobaCount>0?d.xwobaSum/d.xwobaCount:0
        ranks.push({pitch_type:pt,value,count:d.swings})
      }
      ranks.sort((a,b)=>metric==='xwoba'?a.value-b.value:b.value-a.value)
      setPitchRanks(ranks)

      if (chaseList.length>0&&ranks.length>0) {
        const best=chaseList[0]
        let msg=`vs ${bats}HH${armBucket!=='all'?' · '+ARM_LABELS[armBucket]:''}: `
        msg+=`${best.pitch_type} generates the highest chase rate out of zone (${best.chase_pct.toFixed(0)}%).`
        if (ranks[0]) msg+=` Best ${METRIC_LABELS[metric].toLowerCase()}: ${ranks[0].pitch_type} (${metric==='xwoba'?ranks[0].value.toFixed(3):ranks[0].value.toFixed(0)+'%'}).`
        setInsight(msg)
      }
    } catch(e){console.error(e)}
    setLoading(false)
  },[bats,armBucket,countBucket,metric,pitchFilter,pThrows,swingPath])

  useEffect(()=>{fetchData()},[fetchData])

  const metricVals=Object.values(zoneData).map(d=>d[metric as keyof typeof d] as number).filter(v=>v>0)
  const minVal=metricVals.length>0?Math.min(...metricVals):0
  const maxVal=metricVals.length>0?Math.max(...metricVals):1
  const bestWhiff=Object.entries(zoneData).filter(([z])=>Number(z)<=9).sort((a,b)=>b[1].whiff-a[1].whiff)[0]
  const worstContact=Object.entries(zoneData).filter(([z])=>Number(z)<=9).sort((a,b)=>b[1].hard_hit-a[1].hard_hit)[0]
  const bestChase=Object.entries(zoneData).filter(([z])=>Number(z)>=10).sort((a,b)=>b[1].chase-a[1].chase)[0]

  const pill=(label:string,active:boolean,onClick:()=>void)=>(
    <button key={label} onClick={onClick} style={{padding:'4px 10px',borderRadius:20,border:`1px solid ${active?C.gold:C.border}`,fontSize:11,cursor:'pointer',color:active?C.bg:C.textMuted,background:active?C.gold:'transparent',fontWeight:active?700:400,whiteSpace:'nowrap' as const}}>{label}</button>
  )

  return (
    <div style={{color:C.text,fontSize:13}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap' as const,gap:8}}>
        <div style={{fontSize:16,fontWeight:700,color:C.gold}}>Pitching IQ</div>
        {lastUpdated&&<div style={{fontSize:11,color:C.textMuted}}>Updated {lastUpdated} · yesterday's games</div>}
      </div>
      <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 12px',marginBottom:12}}>
        <div style={{display:'flex',flexWrap:'wrap' as const,gap:12}}>
          <div>
            <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4}}>Pitcher hand</div>
            <div style={{display:'flex',gap:4}}>{pill('All',pThrows==='all',()=>setPThrows('all'))}{pill('RHP',pThrows==='R',()=>setPThrows('R'))}{pill('LHP',pThrows==='L',()=>setPThrows('L'))}</div>
          </div>
          <div>
            <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4}}>Batter hand</div>
            <div style={{display:'flex',gap:4}}>{pill('vs RHH',bats==='R',()=>setBats('R'))}{pill('vs LHH',bats==='L',()=>setBats('L'))}</div>
          </div>
          <div>
            <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4}}>Arm angle</div>
            <div style={{display:'flex',gap:4,flexWrap:'wrap' as const}}>{ARM_BUCKETS.map(b=>pill(ARM_LABELS[b],armBucket===b,()=>setArmBucket(b)))}</div>
          </div>
          <div>
            <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4}}>Count</div>
            <div style={{display:'flex',gap:4,flexWrap:'wrap' as const}}>{COUNT_BUCKETS.map(b=>pill(b==='all'?'All':b,countBucket===b,()=>setCountBucket(b)))}</div>
          </div>
          <div style={{display:'flex',gap:12,flexWrap:'wrap' as const}}>
            <div>
              <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4}}>Pitch</div>
              <select value={pitchFilter} onChange={e=>setPitchFilter(e.target.value)} style={{background:C.bg2,color:C.text,border:`1px solid ${C.border}`,borderRadius:6,padding:'4px 8px',fontSize:12}}>
                <option value="all">All pitches</option>
                {pitchTypes.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4}}>Metric</div>
              <select value={metric} onChange={e=>setMetric(e.target.value)} style={{background:C.bg2,color:C.text,border:`1px solid ${C.border}`,borderRadius:6,padding:'4px 8px',fontSize:12}}>
                {METRICS.map(m=><option key={m} value={m}>{METRIC_LABELS[m]}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>
      {insight&&<div style={{background:C.goldBg,border:`1px solid ${C.goldDim}`,borderRadius:8,padding:'10px 14px',marginBottom:12,fontSize:12,color:C.gold,lineHeight:1.5}}><span style={{fontWeight:700}}>Insight: </span>{insight}</div>}
      {loading?(
        <div style={{textAlign:'center' as const,padding:40,color:C.textMuted}}>Loading pitch data...</div>
      ):(
        <>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:12,marginBottom:12}}>
            <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8,padding:14}}>
              <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:10}}>Zone heatmap — {METRIC_LABELS[metric]}</div>
              <div style={{display:'flex',flexDirection:'column' as const,alignItems:'center',gap:3,paddingBottom:8}}>
                {ZONE_GRID.map((row,ri)=>(
                  <div key={ri} style={{display:'flex',gap:3}}>
                    {row.map((zone,ci)=>{
                      if (zone===null) return <div key={ci} style={{width:52,height:52}}/>
                      const d=zoneData[zone]
                      const val=d?d[metric as keyof typeof d] as number:0
                      const isInZone=zone<=9
                      const bg=d&&val>0?heatColor(val,minVal,maxVal):C.bg3
                      const fg=d&&val>0?textForBg(val,minVal,maxVal):C.textDim
                      const displayVal=metric==='xwoba'?val.toFixed(3):val.toFixed(0)+'%'
                      return (
                        <div key={`${ri}-${ci}`} style={{width:52,height:52,borderRadius:4,background:bg,border:`${isInZone?'1.5px':'1px'} solid ${isInZone?'rgba(255,255,255,0.2)':C.border}`,display:'flex',flexDirection:'column' as const,alignItems:'center',justifyContent:'center',opacity:isInZone?1:0.75,position:'relative' as const}}>
                          <div style={{fontSize:8,position:'absolute' as const,top:2,left:3,color:fg,opacity:0.6}}>{zone}</div>
                          <div style={{fontSize:11,fontWeight:700,color:fg}}>{d&&d.count>0?displayVal:'—'}</div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
              <div style={{textAlign:'center' as const,fontSize:10,color:C.textDim,marginTop:8}}>catcher's view · plate_x = left/right · plate_z = height · zones 1–9 in-zone · 11–14 shadow/chase</div>
              <div style={{display:'flex',alignItems:'center',gap:6,justifyContent:'center',marginTop:6}}>
                <span style={{fontSize:10,color:C.textMuted}}>low</span>
                <div style={{width:80,height:7,borderRadius:4,background:'linear-gradient(to right,#3b82f6,#f85149)'}}/>
                <span style={{fontSize:10,color:C.textMuted}}>high</span>
              </div>
              <div style={{height:1,background:C.border,margin:'12px 0'}}/>
              <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:8}}>Pitch ranking — {METRIC_LABELS[metric]}</div>
              {pitchRanks.slice(0,7).map((r,i)=>{
                const maxRank=pitchRanks[0]?.value||1
                const pct=maxRank>0?(r.value/maxRank)*100:0
                const color=i===0?C.red:i===1?C.gold:C.blue
                const display=metric==='xwoba'?r.value.toFixed(3):r.value.toFixed(0)+'%'
                return (
                  <div key={r.pitch_type} style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                    <div style={{width:24,fontSize:11,color:C.textMuted}}>{r.pitch_type}</div>
                    <div style={{flex:1,height:8,borderRadius:4,background:C.bg3}}>
                      <div style={{width:`${pct}%`,height:8,borderRadius:4,background:color}}/>
                    </div>
                    <div style={{width:36,fontSize:11,fontWeight:600,color:C.text,textAlign:'right' as const}}>{display}</div>
                  </div>
                )
              })}
            </div>
            <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8,padding:14}}>
              <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:10}}>Chase pitch finder</div>
              {chaseRows.length===0?(
                <div style={{color:C.textMuted,fontSize:12,padding:20,textAlign:'center' as const}}>Not enough data</div>
              ):(
                chaseRows.slice(0,8).map((row,i)=>{
                  const isSel=selectedChase?.pitch_type===row.pitch_type
                  const maxChase=chaseRows[0]?.chase_pct||1
                  const barW=(row.chase_pct/maxChase)*100
                  return (
                    <div key={row.pitch_type} onClick={()=>setSelectedChase(row)} style={{display:'flex',alignItems:'center',gap:7,padding:'6px 6px',borderBottom:`1px solid ${C.border}`,cursor:'pointer',background:isSel?'rgba(232,184,75,0.06)':'transparent',borderRadius:isSel?6:0}}>
                      <span style={{fontSize:11,color:C.textDim,width:14}}>{i+1}</span>
                      <span style={{fontSize:12,color:C.text,flex:1}}>{row.pitch_type} · out of zone</span>
                      <div style={{width:48,height:5,borderRadius:3,background:C.bg3}}>
                        <div style={{width:`${barW}%`,height:5,borderRadius:3,background:C.red}}/>
                      </div>
                      <span style={{fontSize:12,fontWeight:600,color:C.red,width:32,textAlign:'right' as const}}>{row.chase_pct.toFixed(0)}%</span>
                    </div>
                  )
                })
              )}
              {selectedChase&&(
                <>
                  <div style={{height:1,background:C.border,margin:'12px 0'}}/>
                  <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:8}}>{selectedChase.pitch_type} · out of zone · breakdown</div>
                  {[
                    {label:'Chase %',val:selectedChase.chase_pct.toFixed(0)+'%',good:selectedChase.chase_pct>30},
                    {label:'Whiff % (on swings)',val:selectedChase.whiff_pct.toFixed(0)+'%',good:selectedChase.whiff_pct>25},
                    {label:'Hard-hit % on contact',val:selectedChase.hard_hit_pct.toFixed(0)+'%',good:selectedChase.hard_hit_pct<20},
                    {label:'xwOBA on contact',val:selectedChase.xwoba.toFixed(3),good:selectedChase.xwoba<0.300},
                    {label:'Pitches tracked',val:selectedChase.count.toLocaleString(),good:true},
                  ].map(item=>(
                    <div key={item.label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:`1px solid ${C.border}`}}>
                      <span style={{fontSize:12,color:C.textMuted}}>{item.label}</span>
                      <span style={{fontSize:12,fontWeight:600,color:item.good?C.teal:C.red}}>{item.val}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10}}>
            {[
              {label:'Best whiff zone',val:bestWhiff?`Zone ${bestWhiff[0]} · ${bestWhiff[1].whiff.toFixed(0)}%`:'—',sub:bestWhiff?ZONE_LABELS[Number(bestWhiff[0])]:''},
              {label:'Most dangerous zone',val:worstContact?`Zone ${worstContact[0]} · ${worstContact[1].hard_hit.toFixed(0)}%`:'—',sub:worstContact?ZONE_LABELS[Number(worstContact[0])]:''},
              {label:'Best chase location',val:bestChase?`Zone ${bestChase[0]} · ${bestChase[1].chase.toFixed(0)}%`:'—',sub:bestChase?ZONE_LABELS[Number(bestChase[0])]:''},
              {label:'Top chase pitch',val:chaseRows[0]?`${chaseRows[0].pitch_type} · ${chaseRows[0].chase_pct.toFixed(0)}%`:'—',sub:'out of zone'},
            ].map(card=>(
              <div key={card.label} style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:8,padding:'12px 14px'}}>
                <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4}}>{card.label}</div>
                <div style={{fontSize:14,fontWeight:700,color:C.white,marginBottom:2}}>{card.val}</div>
                <div style={{fontSize:11,color:C.textDim}}>{card.sub}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:8,padding:'12px 14px',marginTop:10}}>
        <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:8}}>Pitch type guide</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:6}}>
          {[
            {code:'FF',name:'4-Seam Fastball',desc:'Straight, high spin, plays up in the zone'},
            {code:'SI',name:'Sinker',desc:'Arm-side run and sink, generates ground balls'},
            {code:'FC',name:'Cutter',desc:'Late glove-side cut off fastball shape'},
            {code:'SL',name:'Slider',desc:'Traditional breaking ball, horizontal break'},
            {code:'ST',name:'Sweeper',desc:'Wide horizontal break, looks like a fastball early'},
            {code:'SV',name:'Slurve',desc:'Hybrid slider/curve with diagonal break'},
            {code:'CU',name:'Curveball',desc:'12-to-6 or 11-to-5 downward break'},
            {code:'CH',name:'Changeup',desc:'Fastball look with arm-side fade and drop'},
            {code:'FS',name:'Splitter',desc:'Fastball shape with late downward drop'},
            {code:'FO',name:'Forkball',desc:'Deep grip split, extreme drop'},
            {code:'SC',name:'Screwball',desc:'Reverse changeup, rare arm-side break'},
            {code:'KN',name:'Knuckleball',desc:'Minimal spin, unpredictable movement'},
          ].map(p=>(
            <div key={p.code} style={{background:C.bg2,borderRadius:6,padding:'8px 10px'}}>
              <div style={{fontSize:12,fontWeight:700,color:C.gold,marginBottom:2}}>{p.code} <span style={{fontSize:11,color:C.text,fontWeight:400}}>{p.name}</span></div>
              <div style={{fontSize:10,color:C.textMuted,lineHeight:1.4}}>{p.desc}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:8,padding:'12px 14px',marginTop:10}}>
        <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:8}}>Swing path guide</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:6}}>
          {[
            {label:'Flat',range:'Below 10°',desc:'Level or downward swing path. Pitches up in the zone are nearly untouchable. Low pitches get topped for weak grounders. Go up early in counts.'},
            {label:'Slight Uppercut',range:'10° – 25°',desc:'Slight lift through the zone. Most dangerous swing type — stays on the ball a long time. Change speeds and work both edges. Do not leave pitches middle-middle.'},
            {label:'Uppercut',range:'25°+',desc:'Steep lift swing — either a barrel or a miss. Low breaking balls are a trap, they match the swing plane. Elevate hard stuff and bury breaking balls below the zone for chases.'},
          ].map(a=>(
            <div key={a.label} style={{background:C.bg2,borderRadius:6,padding:'8px 10px'}}>
              <div style={{fontSize:12,fontWeight:600,color:C.gold,marginBottom:2}}>{a.label} <span style={{fontSize:10,color:C.textMuted,fontWeight:400}}>({a.range})</span></div>
              <div style={{fontSize:11,color:C.textMuted,lineHeight:1.5}}>{a.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
