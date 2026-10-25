'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseTime } from '@/lib/cmj'
import { validateHopSequence, calcHopMetrics, summarizeHopTest, type HopEntry, type HopLimb } from '@/lib/hopTest'

const C = {
  bg:'#0d1117',bg2:'#161b22',bg3:'#1c2333',border:'#30363d',
  gold:'#e8b84b',teal:'#39d353',red:'#f85149',blue:'#58a6ff',purple:'#a371f7',
  text:'#e6edf3',textMuted:'#7d8590',textDim:'#484f58',white:'#ffffff',
}

const inp:React.CSSProperties={width:'100%',background:C.bg3,border:`1px solid ${C.border}`,borderRadius:6,padding:'8px 10px',fontSize:13,color:C.text,outline:'none',marginBottom:10}
const lbl:React.CSSProperties={fontSize:10,color:C.textMuted,fontWeight:600,marginBottom:4,textTransform:'uppercase' as const,letterSpacing:'0.5px',display:'block'}
const card:React.CSSProperties={background:C.bg2,border:`1px solid ${C.border}`,borderRadius:10,padding:14,marginBottom:12}

type HopRow={landingTime:string,takeoffTime:string}
const BLANK_ROWS:HopRow[]=[{landingTime:'',takeoffTime:''},{landingTime:'',takeoffTime:''},{landingTime:'',takeoffTime:''}]

export default function HopTestPanel({pitcherId}:{pitcherId:string}){
  const supabase=createClient()
  const [history,setHistory]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [date,setDate]=useState(new Date().toISOString().split('T')[0])
  const [fps,setFps]=useState('240')
  const [protocolLimb,setProtocolLimb]=useState<HopLimb>('both')
  const [rows,setRows]=useState<HopRow[]>(BLANK_ROWS)
  const [err,setErr]=useState('')
  const [result,setResult]=useState<{metrics:ReturnType<typeof calcHopMetrics>,summary:ReturnType<typeof summarizeHopTest>}|null>(null)
  const [saving,setSaving]=useState(false)
  const [saveErr,setSaveErr]=useState('')
  const [saved,setSaved]=useState(false)

  const fetchHistory=useCallback(async()=>{
    setLoading(true)
    const {data}=await supabase.from('hop_test_results').select('*').eq('pitcher_id',pitcherId).order('test_date',{ascending:false})
    setHistory(data||[])
    setLoading(false)
  },[pitcherId])

  useEffect(()=>{fetchHistory()},[fetchHistory])

  const addRow=()=>setRows(r=>[...r,{landingTime:'',takeoffTime:''}])
  const removeRow=(i:number)=>setRows(r=>r.filter((_,idx)=>idx!==i))
  const updateRow=(i:number,field:keyof HopRow,val:string)=>setRows(r=>r.map((row,idx)=>idx===i?{...row,[field]:val}:row))

  const calculate=()=>{
    setErr('');setResult(null)
    const hops:HopEntry[]=rows.map(r=>({landingTime:parseTime(r.landingTime),takeoffTime:parseTime(r.takeoffTime),limb:protocolLimb}))
    const ordErr=validateHopSequence(hops)
    if (ordErr){setErr(ordErr);return}
    const metrics=calcHopMetrics(hops)
    const summary=summarizeHopTest(metrics)
    setResult({metrics,summary})
  }

  const save=async()=>{
    if (!result)return
    setSaving(true);setSaveErr('')
    const fpsNum=parseFloat(fps)
    const hopsJson=rows.map(r=>({landing_frame:Math.round(parseTime(r.landingTime)*fpsNum),takeoff_frame:Math.round(parseTime(r.takeoffTime)*fpsNum),limb:protocolLimb}))
    const {error}=await supabase.from('hop_test_results').insert({
      pitcher_id:pitcherId,test_date:date,fps:parseInt(fps),protocol:'repeated_hop_rsi_v1',
      limb:protocolLimb,hops:hopsJson,
      valid_hop_count:result.summary.validHopCount,
      avg_ground_contact_sec:result.summary.avgGroundContactSec,
      best_ground_contact_sec:result.summary.bestGroundContactSec,
      avg_rsi:result.summary.avgRsi??null,best_rsi:result.summary.bestRsi??null,
      rsi_consistency_pct:result.summary.rsiConsistencyPct??null,
      left_avg_rsi:result.summary.leftAvgRsi??null,right_avg_rsi:result.summary.rightAvgRsi??null,
      avg_jump_height_in:result.summary.avgJumpHeightIn??null,best_jump_height_in:result.summary.bestJumpHeightIn??null,
    })
    if (error){
      console.error('HopTestPanel: failed to save hop test result',error)
      setSaveErr('Could not save -- check your connection and try again. Your result is still shown above.')
      setSaving(false)
      return
    }
    await fetchHistory()
    setSaving(false);setResult(null);setRows(BLANK_ROWS);setDate(new Date().toISOString().split('T')[0])
    setSaved(true);setTimeout(()=>setSaved(false),2000)
  }

  const deleteResult=async(row:any)=>{
    if (!window.confirm(`Delete the hop test from ${row.test_date}? This cannot be undone.`))return
    await supabase.from('hop_test_results').delete().eq('id',row.id)
    await fetchHistory()
  }

  return (
    <div>
      <div style={{...card,background:'rgba(88,166,255,0.05)',border:'1px solid rgba(88,166,255,0.2)'}}>
        <div style={{fontSize:12,fontWeight:700,color:C.blue,marginBottom:4}}>Repeated Hop Test</div>
        <div style={{fontSize:12,color:C.textMuted,lineHeight:1.6}}>
          Hop repeatedly in place, landing on the same spot each time. Film at 240fps and enter each hop&apos;s landing and takeoff timestamp below, in order. Uses classic RSI (flight time ÷ ground contact time) -- a different formula than the CMJ module&apos;s RSI-Modified.
        </div>
      </div>

      <div style={card}>
        <label style={lbl}>Date</label>
        <input type="date" style={inp} value={date} onChange={e=>setDate(e.target.value)}/>
        <label style={lbl}>FPS</label>
        <select style={inp} value={fps} onChange={e=>setFps(e.target.value)}>
          <option value="240">240 FPS (iPhone)</option><option value="120">120 FPS</option><option value="480">480 FPS</option><option value="30">30 FPS (Real Time)</option>
        </select>
        <label style={lbl}>Protocol</label>
        <select style={inp} value={protocolLimb} onChange={e=>setProtocolLimb(e.target.value as HopLimb)}>
          <option value="both">Bilateral (both legs)</option><option value="left">Single-Leg (Left)</option><option value="right">Single-Leg (Right)</option>
        </select>

        <label style={lbl}>Hops</label>
        {rows.map((row,i)=>(
          <div key={i} style={{display:'flex',gap:8,alignItems:'flex-end',marginBottom:8}}>
            <div style={{flex:1}}>
              <div style={{fontSize:9,color:C.textDim,marginBottom:3}}>Hop {i+1} Landing</div>
              <input type="text" style={{...inp,marginBottom:0}} placeholder="e.g. 0:03.20" value={row.landingTime} onChange={e=>updateRow(i,'landingTime',e.target.value)}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:9,color:C.textDim,marginBottom:3}}>Hop {i+1} Takeoff</div>
              <input type="text" style={{...inp,marginBottom:0}} placeholder="e.g. 0:03.20" value={row.takeoffTime} onChange={e=>updateRow(i,'takeoffTime',e.target.value)}/>
            </div>
            {rows.length>1&&<button onClick={()=>removeRow(i)} style={{background:'none',border:'none',color:C.red,fontSize:18,cursor:'pointer',paddingBottom:8}}>×</button>}
          </div>
        ))}
        <button onClick={addRow} style={{background:'none',border:`1px dashed ${C.border}`,borderRadius:6,color:C.textMuted,fontSize:12,padding:'8px',width:'100%',cursor:'pointer',marginBottom:12}}>+ Add Hop</button>

        {err&&<div style={{color:C.red,fontSize:13,marginBottom:12,padding:'10px',background:'rgba(248,81,73,0.1)',borderRadius:8}}>{err}</div>}
        <button onClick={calculate} style={{background:C.gold,color:C.bg,border:'none',borderRadius:8,padding:'10px',fontSize:13,fontWeight:700,width:'100%',cursor:'pointer'}}>Calculate</button>
      </div>

      {result&&(
        <div style={{...card,border:'1px solid rgba(163,113,247,0.4)',background:'rgba(163,113,247,0.06)'}}>
          <div style={{fontSize:10,color:C.purple,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:8}}>Video-Derived Results (timing only -- not a force measurement)</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
            <div style={{background:'rgba(163,113,247,0.08)',borderRadius:8,padding:10}}>
              <div style={{fontSize:10,color:C.purple,marginBottom:3}}>Valid Hops</div>
              <div style={{fontSize:16,fontWeight:700,color:C.white}}>{result.summary.validHopCount}</div>
            </div>
            <div style={{background:'rgba(163,113,247,0.08)',borderRadius:8,padding:10}}>
              <div style={{fontSize:10,color:C.purple,marginBottom:3}}>Avg Ground Contact</div>
              <div style={{fontSize:16,fontWeight:700,color:C.white}}>{result.summary.avgGroundContactSec.toFixed(3)}s</div>
            </div>
            {result.summary.avgJumpHeightIn!=null&&(
              <div style={{background:'rgba(163,113,247,0.08)',borderRadius:8,padding:10}}>
                <div style={{fontSize:10,color:C.purple,marginBottom:3}}>Avg Jump Height</div>
                <div style={{fontSize:16,fontWeight:700,color:C.white}}>{result.summary.avgJumpHeightIn.toFixed(1)} in</div>
              </div>
            )}
            {result.summary.bestJumpHeightIn!=null&&(
              <div style={{background:'rgba(163,113,247,0.08)',borderRadius:8,padding:10}}>
                <div style={{fontSize:10,color:C.purple,marginBottom:3}}>Best Jump Height</div>
                <div style={{fontSize:16,fontWeight:700,color:C.white}}>{result.summary.bestJumpHeightIn.toFixed(1)} in</div>
              </div>
            )}
            {result.summary.avgRsi!=null&&(
              <div style={{background:'rgba(163,113,247,0.08)',borderRadius:8,padding:10}}>
                <div style={{fontSize:10,color:C.purple,marginBottom:3}}>Avg RSI</div>
                <div style={{fontSize:16,fontWeight:700,color:C.white}}>{result.summary.avgRsi.toFixed(2)}</div>
              </div>
            )}
            {result.summary.bestRsi!=null&&(
              <div style={{background:'rgba(163,113,247,0.08)',borderRadius:8,padding:10}}>
                <div style={{fontSize:10,color:C.purple,marginBottom:3}}>Best RSI</div>
                <div style={{fontSize:16,fontWeight:700,color:C.white}}>{result.summary.bestRsi.toFixed(2)}</div>
              </div>
            )}
            {result.summary.rsiConsistencyPct!=null&&(
              <div style={{background:'rgba(163,113,247,0.08)',borderRadius:8,padding:10}}>
                <div style={{fontSize:10,color:C.purple,marginBottom:3}}>Consistency (CV)</div>
                <div style={{fontSize:16,fontWeight:700,color:C.white}}>{result.summary.rsiConsistencyPct.toFixed(1)}%</div>
              </div>
            )}
            {result.summary.leftAvgRsi!=null&&(
              <div style={{background:'rgba(163,113,247,0.08)',borderRadius:8,padding:10}}>
                <div style={{fontSize:10,color:C.purple,marginBottom:3}}>Left Avg RSI</div>
                <div style={{fontSize:16,fontWeight:700,color:C.white}}>{result.summary.leftAvgRsi.toFixed(2)}</div>
              </div>
            )}
            {result.summary.rightAvgRsi!=null&&(
              <div style={{background:'rgba(163,113,247,0.08)',borderRadius:8,padding:10}}>
                <div style={{fontSize:10,color:C.purple,marginBottom:3}}>Right Avg RSI</div>
                <div style={{fontSize:16,fontWeight:700,color:C.white}}>{result.summary.rightAvgRsi.toFixed(2)}</div>
              </div>
            )}
          </div>
          <button onClick={save} disabled={saving} style={{background:C.gold,color:C.bg,border:'none',borderRadius:8,padding:'10px',fontSize:13,fontWeight:700,width:'100%',cursor:'pointer'}}>{saving?'Saving...':'Save to Profile'}</button>
          {saved&&<div style={{textAlign:'center',color:C.teal,fontSize:13,fontWeight:600,marginTop:8}}>✓ Saved!</div>}
          {saveErr&&<div style={{textAlign:'center',color:C.red,fontSize:13,fontWeight:600,marginTop:8,padding:'10px',background:'rgba(248,81,73,0.1)',borderRadius:8}}>{saveErr}</div>}
        </div>
      )}

      {!loading&&history.length>0&&(
        <div>
          <div style={{fontSize:14,fontWeight:700,color:C.white,marginBottom:10}}>Hop Test History</div>
          {history.map((row:any)=>(
            <div key={row.id} style={card}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                <span style={{fontSize:13,color:C.textMuted}}>{row.test_date} · {row.limb==='both'?'Bilateral':row.limb==='left'?'Left':'Right'}</span>
                <button onClick={()=>deleteResult(row)} style={{background:'none',border:'none',color:C.red,fontSize:12,cursor:'pointer'}}>Delete</button>
              </div>
              <div style={{display:'flex',gap:12,flexWrap:'wrap' as const,fontSize:12}}>
                <span style={{color:C.textMuted}}>{row.valid_hop_count} hops</span>
                {row.avg_jump_height_in!=null&&<span style={{color:C.gold}}>↑ {row.avg_jump_height_in.toFixed(1)} in</span>}
                {row.avg_rsi!=null&&<span style={{color:C.purple}}>Avg RSI {row.avg_rsi.toFixed(2)}</span>}
                {row.best_rsi!=null&&<span style={{color:C.gold}}>Best RSI {row.best_rsi.toFixed(2)}</span>}
                {row.rsi_consistency_pct!=null&&<span style={{color:C.teal}}>CV {row.rsi_consistency_pct.toFixed(1)}%</span>}
                <span style={{color:C.blue}}>Contact {row.avg_ground_contact_sec.toFixed(3)}s</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
