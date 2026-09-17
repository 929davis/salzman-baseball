'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { THROW_TYPES, IMPLEMENTS, INTENT_LEVELS, computeThrowLoadRatio, computeWeeklyBuckets, type ThrowLogEntry } from '@/lib/throwLog'

const C = {
  bg:'#0d1117',bg2:'#161b22',bg3:'#1c2333',border:'#30363d',
  gold:'#e8b84b',goldDim:'#a07c28',goldBg:'rgba(232,184,75,0.08)',
  teal:'#39d353',red:'#f85149',blue:'#58a6ff',
  text:'#e6edf3',textMuted:'#7d8590',textDim:'#484f58',white:'#ffffff',
}

const card:React.CSSProperties = {background:C.bg2,border:`1px solid ${C.border}`,borderRadius:10,padding:'14px 16px',marginBottom:12}
const inp:React.CSSProperties = {width:'100%',background:C.bg3,border:`1px solid ${C.border}`,borderRadius:6,padding:'7px 10px',fontSize:13,color:C.text,outline:'none',boxSizing:'border-box' as const}
const lbl:React.CSSProperties = {fontSize:10,color:C.textMuted,fontWeight:600,marginBottom:4,textTransform:'uppercase' as const,letterSpacing:'0.5px',display:'block'}

const BAND_COLORS:Record<string,string> = {
  '<0.8':C.blue, '0.8-1.3':C.teal, '1.3-1.5':C.gold, '>1.5':C.red,
}

type NewEntryForm = {
  throw_date:string, throw_type:string, count:string, implement:string, intent_level:string, notes:string,
}
const blankForm = ():NewEntryForm => ({
  throw_date:new Date().toISOString().split('T')[0], throw_type:'bullpen', count:'', implement:'5oz', intent_level:'', notes:'',
})

export default function ThrowLogPanel({pitcherId}:{pitcherId:string}){
  const supabase = createClient()
  const [entries,setEntries] = useState<ThrowLogEntry[]>([])
  const [loading,setLoading] = useState(true)
  const [expanded,setExpanded] = useState(false)
  const [form,setForm] = useState<NewEntryForm>(blankForm())
  const [saving,setSaving] = useState(false)
  const [error,setError] = useState('')

  const load = async () => {
    setLoading(true)
    // 90 days covers the 28-day ratio/bucket window with room to spare, plus enough history
    // for "days since last I4/I5" to find something further back than 28 days if that's all
    // that's on file.
    const since = new Date(); since.setDate(since.getDate()-90)
    const {data,error} = await supabase.from('throw_log').select('*')
      .eq('pitcher_id',pitcherId).gte('throw_date',since.toISOString().split('T')[0])
      .order('throw_date',{ascending:false})
    if (error) console.error('ThrowLogPanel: failed to load',error)
    setEntries((data||[]) as ThrowLogEntry[])
    setLoading(false)
  }

  useEffect(()=>{ setExpanded(false); load() },[pitcherId])

  const addEntry = async () => {
    setError('')
    const count = parseInt(form.count,10)
    if (!form.throw_date || !form.throw_type || !form.implement || !count || count<=0) {
      setError('Date, type, implement, and a count greater than 0 are required.')
      return
    }
    setSaving(true)
    const {error:insertError} = await supabase.from('throw_log').insert({
      pitcher_id:pitcherId, throw_date:form.throw_date, throw_type:form.throw_type,
      count, implement:form.implement, intent_level:form.intent_level||null, notes:form.notes.trim()||null,
    })
    setSaving(false)
    if (insertError) { setError('Save failed: '+insertError.message); return }
    setForm(blankForm())
    await load()
  }

  const deleteEntry = async (entry:ThrowLogEntry) => {
    if (!window.confirm(`Delete this ${entry.throw_type} entry from ${entry.throw_date} (${entry.count} throws)? This cannot be undone.`)) return
    const {error} = await supabase.from('throw_log').delete().eq('id',entry.id)
    if (error) { alert('Delete failed: '+error.message); return }
    setEntries(prev=>prev.filter(e=>e.id!==entry.id))
  }

  if (loading) return <div style={{...card,fontSize:12,color:C.textMuted}}>Loading throw log...</div>

  const throwLoad = computeThrowLoadRatio(entries)
  const buckets = computeWeeklyBuckets(entries)
  const maxBucket = Math.max(1,...buckets.map(b=>b.weightedTotal))

  return (
    <div style={card}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer'}} onClick={()=>setExpanded(s=>!s)}>
        <div style={{fontSize:12,fontWeight:700,color:C.white,textTransform:'uppercase' as const,letterSpacing:'0.5px'}}>{expanded?'▾':'▸'} Throw Log</div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {throwLoad.hasEnoughHistory ? (
            <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:10,background:`${BAND_COLORS[throwLoad.band!]}26`,color:BAND_COLORS[throwLoad.band!],border:`1px solid ${BAND_COLORS[throwLoad.band!]}66`}}>ratio {throwLoad.ratio} ({throwLoad.band})</span>
          ) : (
            <span style={{fontSize:10,color:C.textDim,background:C.bg3,border:`1px solid ${C.border}`,borderRadius:10,padding:'2px 8px'}}>building baseline — {throwLoad.daysOfHistory} of 28 days</span>
          )}
        </div>
      </div>

      {expanded && (
        <div style={{marginTop:14,display:'flex',flexDirection:'column',gap:14}}>
          {/* Rolling 28-day view */}
          <div>
            <label style={lbl}>Rolling 28 Days (weighted throws/week)</label>
            {buckets.length===0 ? (
              <div style={{fontSize:12,color:C.textDim}}>No throws logged in the last 28 days.</div>
            ) : (
              <div style={{display:'flex',gap:8,alignItems:'flex-end',height:80}}>
                {buckets.map(b=>(
                  <div key={b.weekStart} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                    <div style={{fontSize:10,color:C.textMuted}}>{b.weightedTotal}</div>
                    <div style={{width:'100%',height:Math.max(4,(b.weightedTotal/maxBucket)*50),background:C.gold,borderRadius:3}}/>
                    <div style={{fontSize:9,color:C.textDim}}>wk of {b.weekStart.slice(5)}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{fontSize:11,color:C.textMuted,marginTop:8}}>
              Acute (7d): {throwLoad.acute7d} · Chronic weekly avg (28d): {throwLoad.chronicWeeklyAvg28d}
              {throwLoad.hasEnoughHistory
                ? <> · Ratio: <span style={{color:BAND_COLORS[throwLoad.band!],fontWeight:700}}>{throwLoad.ratio} ({throwLoad.band})</span></>
                : <> · Ratio: building baseline — {throwLoad.daysOfHistory} of 28 days logged</>}
            </div>
          </div>

          {/* Add entry form */}
          <div>
            <label style={lbl}>Log a Throwing Event</label>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',gap:8,marginBottom:8}}>
              <div>
                <label style={lbl}>Date</label>
                <input type="date" style={inp} value={form.throw_date} onChange={e=>setForm(f=>({...f,throw_date:e.target.value}))}/>
              </div>
              <div>
                <label style={lbl}>Type</label>
                <select style={inp} value={form.throw_type} onChange={e=>setForm(f=>({...f,throw_type:e.target.value}))}>
                  {THROW_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Count</label>
                <input type="text" inputMode="numeric" style={inp} placeholder="e.g. 35" value={form.count} onChange={e=>setForm(f=>({...f,count:e.target.value.replace(/[^0-9]/g,'')}))}/>
              </div>
              <div>
                <label style={lbl}>Implement</label>
                <select style={inp} value={form.implement} onChange={e=>setForm(f=>({...f,implement:e.target.value}))}>
                  {IMPLEMENTS.map(i=><option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Intent</label>
                <select style={inp} value={form.intent_level} onChange={e=>setForm(f=>({...f,intent_level:e.target.value}))}>
                  <option value="">—</option>
                  {INTENT_LEVELS.map(i=><option key={i} value={i}>{i}</option>)}
                </select>
              </div>
            </div>
            <input type="text" style={{...inp,marginBottom:8}} placeholder="Notes (optional)" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
            {error && <div style={{fontSize:11,color:C.red,marginBottom:8}}>{error}</div>}
            <button onClick={addEntry} disabled={saving} style={{background:C.gold,color:C.bg,border:`1px solid ${C.gold}`,borderRadius:6,padding:'7px 16px',fontSize:12,fontWeight:700,cursor:saving?'not-allowed':'pointer'}}>{saving?'Saving...':'Add Entry'}</button>
          </div>

          {/* Recent entries */}
          <div>
            <label style={lbl}>Recent Entries (last 90 days)</label>
            {entries.length===0 ? (
              <div style={{fontSize:12,color:C.textDim}}>Nothing logged yet.</div>
            ) : (
              <div style={{maxHeight:220,overflowY:'auto' as const}}>
                {entries.map(e=>(
                  <div key={e.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:`1px solid ${C.border}`,fontSize:12}}>
                    <span style={{color:C.textMuted,minWidth:80}}>{e.throw_date}</span>
                    <span style={{color:C.white,minWidth:80}}>{e.throw_type}</span>
                    <span style={{color:C.gold,minWidth:60}}>{e.count} throws</span>
                    <span style={{color:C.textMuted,minWidth:70}}>{e.implement}</span>
                    <span style={{color:C.textMuted,minWidth:40}}>{e.intent_level||'—'}</span>
                    <span style={{color:C.textDim,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.notes}</span>
                    <button onClick={()=>deleteEntry(e)} style={{background:'transparent',border:'none',color:C.red,cursor:'pointer',fontSize:11}}>Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
