'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseTime } from '@/lib/cmj'
import { validatePlyoPushupSequence, calcPlyoPushupMetrics, summarizePlyoPushupTest, type PlyoPushupInput } from '@/lib/plyoPushup'

const C = {
  bg:'#0d1117',bg2:'#161b22',bg3:'#1c2333',border:'#30363d',
  gold:'#e8b84b',teal:'#39d353',red:'#f85149',blue:'#58a6ff',purple:'#a371f7',
  text:'#e6edf3',textMuted:'#7d8590',textDim:'#484f58',white:'#ffffff',
}

const inp:React.CSSProperties={width:'100%',background:C.bg3,border:`1px solid ${C.border}`,borderRadius:6,padding:'8px 10px',fontSize:13,color:C.text,outline:'none',marginBottom:10}
const lbl:React.CSSProperties={fontSize:10,color:C.textMuted,fontWeight:600,marginBottom:4,textTransform:'uppercase' as const,letterSpacing:'0.5px',display:'block'}
const card:React.CSSProperties={background:C.bg2,border:`1px solid ${C.border}`,borderRadius:10,padding:14,marginBottom:12}

type RepRow={contactTime:string,bottomTime:string,leaveTime:string}
const BLANK_ROWS:RepRow[]=[{contactTime:'',bottomTime:'',leaveTime:''},{contactTime:'',bottomTime:'',leaveTime:''}]

export default function PlyoPushupPanel({pitcherId}:{pitcherId:string}){
  const supabase=createClient()
  const [history,setHistory]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [date,setDate]=useState(new Date().toISOString().split('T')[0])
  const [fps,setFps]=useState('240')
  const [rows,setRows]=useState<RepRow[]>(BLANK_ROWS)
  const [finalContactTime,setFinalContactTime]=useState('')
  const [stabilizationTime,setStabilizationTime]=useState('')
  const [err,setErr]=useState('')
  const [result,setResult]=useState<{metrics:ReturnType<typeof calcPlyoPushupMetrics>,summary:ReturnType<typeof summarizePlyoPushupTest>}|null>(null)
  const [saving,setSaving]=useState(false)
  const [saveErr,setSaveErr]=useState('')
  const [saved,setSaved]=useState(false)

  const fetchHistory=useCallback(async()=>{
    setLoading(true)
    const {data}=await supabase.from('plyo_pushup_assessments').select('*').eq('pitcher_id',pitcherId).order('test_date',{ascending:false})
    setHistory(data||[])
    setLoading(false)
  },[pitcherId])

  useEffect(()=>{fetchHistory()},[fetchHistory])

  const addRow=()=>setRows(r=>[...r,{contactTime:'',bottomTime:'',leaveTime:''}])
  const removeRow=(i:number)=>setRows(r=>r.filter((_,idx)=>idx!==i))
  const updateRow=(i:number,field:keyof RepRow,val:string)=>setRows(r=>r.map((row,idx)=>idx===i?{...row,[field]:val}:row))

  const calculate=()=>{
    setErr('');setResult(null)
    const input:PlyoPushupInput={
      reps:rows.map(r=>({contactTime:parseTime(r.contactTime),bottomTime:r.bottomTime.trim()?parseTime(r.bottomTime):undefined,leaveTime:parseTime(r.leaveTime)})),
      finalContactTime:parseTime(finalContactTime),
      stabilizationTime:stabilizationTime.trim()?parseTime(stabilizationTime):undefined,
    }
    const ordErr=validatePlyoPushupSequence(input)
    if (ordErr){setErr(ordErr);return}
    const metrics=calcPlyoPushupMetrics(input)
    const summary=summarizePlyoPushupTest(metrics,input.stabilizationTime,input.finalContactTime)
    setResult({metrics,summary})
  }

  const save=async()=>{
    if (!result)return
    setSaving(true);setSaveErr('')
    const fpsNum=parseFloat(fps)
    const repsJson=rows.map(r=>({contact_frame:Math.round(parseTime(r.contactTime)*fpsNum),bottom_frame:r.bottomTime.trim()?Math.round(parseTime(r.bottomTime)*fpsNum):null,leave_frame:Math.round(parseTime(r.leaveTime)*fpsNum)}))
    const {error}=await supabase.from('plyo_pushup_assessments').insert({
      pitcher_id:pitcherId,test_date:date,fps:parseInt(fps),
      reps:repsJson,
      final_contact_frame:Math.round(parseTime(finalContactTime)*fpsNum),
      stabilization_frame:stabilizationTime.trim()?Math.round(parseTime(stabilizationTime)*fpsNum):null,
      rep_count:result.summary.repCount,
      avg_ground_contact_sec:result.summary.avgGroundContactSec,
      best_ground_contact_sec:result.summary.bestGroundContactSec,
      avg_flight_sec:result.summary.avgFlightSec,
      best_flight_sec:result.summary.bestFlightSec,
      flight_consistency_pct:result.summary.flightConsistencyPct??null,
      stabilization_sec:result.summary.stabilizationSec??null,
    })
    if (error){
      console.error('PlyoPushupPanel: failed to save plyo push-up result',error)
      setSaveErr('Could not save -- check your connection and try again. Your result is still shown above.')
      setSaving(false)
      return
    }
    await fetchHistory()
    setSaving(false);setResult(null);setRows(BLANK_ROWS);setFinalContactTime('');setStabilizationTime('');setDate(new Date().toISOString().split('T')[0])
    setSaved(true);setTimeout(()=>setSaved(false),2000)
  }

  const deleteResult=async(row:any)=>{
    if (!window.confirm(`Delete the plyo push-up test from ${row.test_date}? This cannot be undone.`))return
    await supabase.from('plyo_pushup_assessments').delete().eq('id',row.id)
    await fetchHistory()
  }

  return (
    <div>
      <div style={{...card,background:'rgba(88,166,255,0.05)',border:'1px solid rgba(88,166,255,0.2)'}}>
        <div style={{fontSize:12,fontWeight:700,color:C.blue,marginBottom:4}}>Plyometric Push-Up</div>
        <div style={{fontSize:12,color:C.textMuted,lineHeight:1.6}}>
          Repeated plyo push-ups, hands leaving the ground each rep. Film at 240fps. For each rep, enter when hands contact the ground and when they leave it; optionally enter the bottom of the lowering phase to split lowering vs. propulsion. Enter the final landing and, if you want it, a stabilization timestamp at the end.
        </div>
      </div>

      <div style={card}>
        <label style={lbl}>Date</label>
        <input type="date" style={inp} value={date} onChange={e=>setDate(e.target.value)}/>
        <label style={lbl}>FPS</label>
        <select style={inp} value={fps} onChange={e=>setFps(e.target.value)}>
          <option value="240">240 FPS (iPhone)</option><option value="120">120 FPS</option><option value="480">480 FPS</option><option value="30">30 FPS (Real Time)</option>
        </select>

        <label style={lbl}>Reps</label>
        {rows.map((row,i)=>(
          <div key={i} style={{display:'flex',gap:8,alignItems:'flex-end',marginBottom:8}}>
            <div style={{flex:1}}>
              <div style={{fontSize:9,color:C.textDim,marginBottom:3}}>Rep {i+1} Hands Contact</div>
              <input type="text" style={{...inp,marginBottom:0}} placeholder="e.g. 0:03.20" value={row.contactTime} onChange={e=>updateRow(i,'contactTime',e.target.value)}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:9,color:C.textDim,marginBottom:3}}>Rep {i+1} Bottom (optional)</div>
              <input type="text" style={{...inp,marginBottom:0}} placeholder="e.g. 0:03.20" value={row.bottomTime} onChange={e=>updateRow(i,'bottomTime',e.target.value)}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:9,color:C.textDim,marginBottom:3}}>Rep {i+1} Hands Leave</div>
              <input type="text" style={{...inp,marginBottom:0}} placeholder="e.g. 0:03.20" value={row.leaveTime} onChange={e=>updateRow(i,'leaveTime',e.target.value)}/>
            </div>
            {rows.length>1&&<button onClick={()=>removeRow(i)} style={{background:'none',border:'none',color:C.red,fontSize:18,cursor:'pointer',paddingBottom:8}}>×</button>}
          </div>
        ))}
        <button onClick={addRow} style={{background:'none',border:`1px dashed ${C.border}`,borderRadius:6,color:C.textMuted,fontSize:12,padding:'8px',width:'100%',cursor:'pointer',marginBottom:12}}>+ Add Rep</button>

        <label style={lbl}>Final Landing</label>
        <input type="text" style={inp} placeholder="e.g. 0:03.20" value={finalContactTime} onChange={e=>setFinalContactTime(e.target.value)}/>
        <label style={lbl}>Stabilization (optional)</label>
        <input type="text" style={inp} placeholder="e.g. 0:03.20" value={stabilizationTime} onChange={e=>setStabilizationTime(e.target.value)}/>

        {err&&<div style={{color:C.red,fontSize:13,marginBottom:12,padding:'10px',background:'rgba(248,81,73,0.1)',borderRadius:8}}>{err}</div>}
        <button onClick={calculate} style={{background:C.gold,color:C.bg,border:'none',borderRadius:8,padding:'10px',fontSize:13,fontWeight:700,width:'100%',cursor:'pointer'}}>Calculate</button>
      </div>

      {result&&(
        <div style={{...card,border:'1px solid rgba(163,113,247,0.4)',background:'rgba(163,113,247,0.06)'}}>
          <div style={{fontSize:10,color:C.purple,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:8}}>Video-Derived Results (timing only -- not a force measurement)</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
            <div style={{background:'rgba(163,113,247,0.08)',borderRadius:8,padding:10}}>
              <div style={{fontSize:10,color:C.purple,marginBottom:3}}>Reps</div>
              <div style={{fontSize:16,fontWeight:700,color:C.white}}>{result.summary.repCount}</div>
            </div>
            <div style={{background:'rgba(163,113,247,0.08)',borderRadius:8,padding:10}}>
              <div style={{fontSize:10,color:C.purple,marginBottom:3}}>Avg Ground Contact</div>
              <div style={{fontSize:16,fontWeight:700,color:C.white}}>{result.summary.avgGroundContactSec.toFixed(3)}s</div>
            </div>
            <div style={{background:'rgba(163,113,247,0.08)',borderRadius:8,padding:10}}>
              <div style={{fontSize:10,color:C.purple,marginBottom:3}}>Avg Flight Time</div>
              <div style={{fontSize:16,fontWeight:700,color:C.white}}>{result.summary.avgFlightSec.toFixed(3)}s</div>
            </div>
            <div style={{background:'rgba(163,113,247,0.08)',borderRadius:8,padding:10}}>
              <div style={{fontSize:10,color:C.purple,marginBottom:3}}>Best Flight Time</div>
              <div style={{fontSize:16,fontWeight:700,color:C.white}}>{result.summary.bestFlightSec.toFixed(3)}s</div>
            </div>
            {result.summary.flightConsistencyPct!=null&&(
              <div style={{background:'rgba(163,113,247,0.08)',borderRadius:8,padding:10}}>
                <div style={{fontSize:10,color:C.purple,marginBottom:3}}>Consistency (CV)</div>
                <div style={{fontSize:16,fontWeight:700,color:C.white}}>{result.summary.flightConsistencyPct.toFixed(1)}%</div>
              </div>
            )}
            {result.summary.stabilizationSec!=null&&(
              <div style={{background:'rgba(163,113,247,0.08)',borderRadius:8,padding:10}}>
                <div style={{fontSize:10,color:C.purple,marginBottom:3}}>Stabilization Time</div>
                <div style={{fontSize:16,fontWeight:700,color:C.white}}>{result.summary.stabilizationSec.toFixed(2)}s</div>
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
          <div style={{fontSize:14,fontWeight:700,color:C.white,marginBottom:10}}>Plyo Push-Up History</div>
          {history.map((row:any)=>(
            <div key={row.id} style={card}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                <span style={{fontSize:13,color:C.textMuted}}>{row.test_date}</span>
                <button onClick={()=>deleteResult(row)} style={{background:'none',border:'none',color:C.red,fontSize:12,cursor:'pointer'}}>Delete</button>
              </div>
              <div style={{display:'flex',gap:12,flexWrap:'wrap' as const,fontSize:12}}>
                <span style={{color:C.textMuted}}>{row.rep_count} reps</span>
                <span style={{color:C.purple}}>Avg flight {row.avg_flight_sec.toFixed(3)}s</span>
                <span style={{color:C.gold}}>Best flight {row.best_flight_sec.toFixed(3)}s</span>
                {row.flight_consistency_pct!=null&&<span style={{color:C.teal}}>CV {row.flight_consistency_pct.toFixed(1)}%</span>}
                <span style={{color:C.blue}}>Contact {row.avg_ground_contact_sec.toFixed(3)}s</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
