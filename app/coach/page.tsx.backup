'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const C = {
  bg:'#0d1117',bg2:'#161b22',bg3:'#1c2333',border:'#30363d',
  gold:'#e8b84b',goldDim:'#a07c28',goldBg:'rgba(232,184,75,0.08)',
  teal:'#39d353',red:'#f85149',blue:'#58a6ff',purple:'#a371f7',
  text:'#e6edf3',textMuted:'#7d8590',textDim:'#484f58',white:'#ffffff',
}

const armCare = (n:number,v:number) => (!n||!v)?0:Math.round(n*Math.pow(v,2)*0.01*1.25*1.25)

function Avatar({name,size=36}:{name:string,size?:number}) {
  const ini = name.split(' ').map((w:string)=>w[0]).join('').toUpperCase().slice(0,2)
  const bgs = [C.goldDim,'#1a4a6b','#2d6a4f','#5a2080','#6b1a1a']
  return <div style={{width:size,height:size,borderRadius:'50%',background:bgs[name.charCodeAt(0)%bgs.length],color:C.white,display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.35,fontWeight:700,flexShrink:0,border:`1px solid ${C.border}`}}>{ini}</div>
}

export default function CoachDashboard() {
  const [user, setUser] = useState<any>(null)
  const [pitchers, setPitchers] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [tab, setTab] = useState('overview')
  const [view, setView] = useState('roster')
  const [loading, setLoading] = useState(true)
  const [program, setProgram] = useState<any>(null)
  const [activeDay, setActiveDay] = useState('Monday')
  const [activeCat, setActiveCat] = useState('Throwing')
  const [noteText, setNoteText] = useState('')
  const [notes, setNotes] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [msgText, setMsgText] = useState('')
  const [logs, setLogs] = useState<any[]>([])
  const [cmjResults, setCmjResults] = useState<any[]>([])
  const [principles, setPrinciples] = useState('')
  const [princText, setPrincText] = useState('')
  const [princSaved, setPrincSaved] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
  const CATS = ['Throwing','Lifting','Conditioning','Recovery']

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setUser(user)
      const { data: profile } = await supabase.from('profiles').select('role').eq('id',user.id).single()
      if (profile?.role !== 'coach') { router.push('/pitcher'); return }
      const { data: ps } = await supabase.from('profiles').select('*').eq('role','pitcher').order('full_name')
      setPitchers(ps||[])
      const { data: pr } = await supabase.from('principles').select('*').single()
      if (pr) { setPrinciples(pr.content); setPrincText(pr.content) }
      setLoading(false)
    }
    init()
  }, [])

  const selectPitcher = async (p:any) => {
    setSelected(p)
    setTab('overview')
    setView('roster')
    const [logsRes, notesRes, msgsRes, cmjRes, progRes] = await Promise.all([
      supabase.from('session_logs').select('*').eq('pitcher_id',p.id).order('log_date',{ascending:false}),
      supabase.from('coach_notes').select('*').eq('pitcher_id',p.id).order('created_at',{ascending:false}),
      supabase.from('messages').select('*').eq('pitcher_id',p.id).order('created_at'),
      supabase.from('cmj_results').select('*').eq('pitcher_id',p.id).order('test_date',{ascending:false}),
      supabase.from('programs').select('*').eq('pitcher_id',p.id).order('week_of',{ascending:false}).limit(1)
    ])
    setLogs(logsRes.data||[])
    setNotes(notesRes.data||[])
    setMessages(msgsRes.data||[])
    setCmjResults(cmjRes.data||[])
    setProgram(progRes.data?.[0]||null)
  }

  const signOut = async () => { await supabase.auth.signOut(); router.push('/auth/login') }

  const addNote = async () => {
    if (!noteText.trim()||!selected) return
    const { data } = await supabase.from('coach_notes').insert({pitcher_id:selected.id,content:noteText.trim()}).select().single()
    if (data) { setNotes([data,...notes]); setNoteText('') }
  }

  const sendMessage = async () => {
    if (!msgText.trim()||!selected) return
    const { data } = await supabase.from('messages').insert({pitcher_id:selected.id,sender_id:user.id,sender_role:'coach',content:msgText.trim()}).select().single()
    if (data) { setMessages([...messages,data]); setMsgText('') }
  }

  const saveProgram = async (days:any) => {
    if (!selected) return
    const weekOf = new Date().toISOString().split('T')[0]
    if (program) {
      await supabase.from('programs').update({days}).eq('id',program.id)
      setProgram({...program,days})
    } else {
      const { data } = await supabase.from('programs').insert({pitcher_id:selected.id,week_of:weekOf,days}).select().single()
      if (data) setProgram(data)
    }
  }

  const updateCell = async (val:string) => {
    const days = program?.days||{}
    const updated = {...days,[activeDay]:{...days[activeDay],[activeCat]:val}}
    setProgram((p:any)=>({...p,days:updated}))
    await saveProgram(updated)
  }

  const savePrinciples = async () => {
    const { data: pr } = await supabase.from('principles').select('id').single()
    if (pr) await supabase.from('principles').update({content:princText}).eq('id',pr.id)
    setPrinciples(princText)
    setPrincSaved(true)
    setTimeout(()=>setPrincSaved(false),2000)
  }

  const buildPrompt = () => {
    const jiP = armCare(selected?.weekly_pitches||0, selected?.avg_velocity||0)
    const lastCMJ = cmjResults[0]
    const recentLogs = logs.slice(0,7)
    const prompt = `You are helping Coach Salzman write a weekly training program for pitcher ${selected?.full_name}.

PITCHER DATA:
- Avg Velocity: ${selected?.avg_velocity||'—'} mph
- Weekly Pitches: ${selected?.weekly_pitches||'—'} | HE Throws: ${selected?.weekly_high_effort||'—'}
- Arm Care Min: ${jiP.toLocaleString()} ft·lb
${lastCMJ?`- CMJ Velo Capacity: ${lastCMJ.estimated_velocity?.toFixed(1)} mph | Jump: ${lastCMJ.jump_height_in?.toFixed(1)}in | RSI: ${lastCMJ.rsi_mod?.toFixed(2)}`:'- No CMJ data'}

RECENT LOGS:
${recentLogs.map((l:any)=>`  ${l.log_date}: vel=${l.velocity||'—'}mph, weight=${l.weight_lifted||'—'}lbs, feeling=${l.feeling||'—'}/10, soreness=[${(l.soreness||[]).join(',')||'none'}]`).join('\n')||'  None.'}

LAST WEEK PROGRAM:
${program?DAYS.map(d=>`  ${d}:\n${CATS.map(c=>`    ${c}: ${program.days?.[d]?.[c]||'Rest'}`).join('\n')}`).join('\n'):'  None.'}

TRAINING PRINCIPLES:
${principles||'No principles uploaded yet.'}

Write next week's program by day and category (Throwing, Lifting, Conditioning, Recovery). Include loads like "Back Squat 4x4 @ 80%".`
    navigator.clipboard.writeText(prompt).catch(()=>{})
    window.open('https://claude.ai','_blank')
    alert('Prompt copied! Paste into Claude.')
  }

  if (loading) return <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',color:C.textMuted,fontFamily:'system-ui'}}>Loading...</div>

  const S = {
    header:{background:C.bg2,borderBottom:`1px solid ${C.border}`,padding:'0 20px',display:'flex',alignItems:'center',justifyContent:'space-between',height:56,fontFamily:'system-ui'},
    sidebar:{width:220,background:C.bg2,borderRight:`1px solid ${C.border}`,overflowY:'auto' as const,flexShrink:0},
    main:{flex:1,overflowY:'auto' as const,background:C.bg,padding:20,fontFamily:'system-ui'},
    card:{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:10,padding:'16px 18px',marginBottom:12},
    input:{width:'100%',background:C.bg3,border:`1px solid ${C.border}`,borderRadius:6,padding:'8px 12px',fontSize:13,color:C.text,boxSizing:'border-box' as const,outline:'none'},
    btn:(v='primary')=>({background:v==='gold'?C.gold:v==='danger'?'rgba(248,81,73,0.1)':C.bg3,color:v==='gold'?C.bg:v==='danger'?C.red:C.text,border:`1px solid ${v==='gold'?C.gold:v==='danger'?C.red:C.border}`,borderRadius:6,padding:'7px 14px',fontSize:12,fontWeight:v==='gold'?700:500 as const,cursor:'pointer'}),
    label:{fontSize:11,color:C.textMuted,fontWeight:600 as const,marginBottom:5,display:'block',textTransform:'uppercase' as const,letterSpacing:'0.5px'},
    tab:(a:boolean)=>({padding:'6px 12px',fontSize:11,fontWeight:a?700:400 as const,background:a?C.gold:C.bg3,color:a?C.bg:C.textMuted,border:`1px solid ${a?C.gold:C.border}`,borderRadius:6,cursor:'pointer',textTransform:'uppercase' as const,letterSpacing:'0.5px'}),
  }

  return (
    <div style={{fontFamily:'system-ui,-apple-system,sans-serif',background:C.bg,minHeight:'100vh',color:C.text}}>
      <header style={S.header}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:32,height:32,background:`linear-gradient(135deg,${C.gold},${C.goldDim})`,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>⚾</div>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:C.white,letterSpacing:'-0.3px'}}>SALZMAN BASEBALL</div>
            <div style={{fontSize:10,color:C.gold,textTransform:'uppercase',letterSpacing:'0.5px'}}>Coach Dashboard</div>
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {['roster','principles'].map(v=>(
            <button key={v} onClick={()=>{setView(v);setSelected(null)}} style={{...S.btn(),background:view===v?C.goldBg:'transparent',color:view===v?C.gold:C.textMuted,border:`1px solid ${view===v?C.goldDim:'transparent'}`,fontSize:11,padding:'5px 12px'}}>
              {v.toUpperCase()}
            </button>
          ))}
          <button onClick={signOut} style={{...S.btn(),fontSize:11,padding:'5px 12px',color:C.textMuted}}>Sign Out</button>
        </div>
      </header>

      <div style={{display:'flex',height:'calc(100vh - 56px)'}}>
        <aside style={S.sidebar}>
          <div style={{padding:'10px 14px 6px',fontSize:10,color:C.textDim,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px'}}>Roster · {pitchers.length}</div>
          {pitchers.map(p=>(
            <div key={p.id} onClick={()=>selectPitcher(p)} style={{padding:'9px 14px',cursor:'pointer',background:selected?.id===p.id?C.bg3:'transparent',borderLeft:`2px solid ${selected?.id===p.id?C.gold:'transparent'}`,display:'flex',alignItems:'center',gap:10}}>
              <Avatar name={p.full_name||'?'} size={26}/>
              <div style={{minWidth:0}}>
                <div style={{fontSize:13,fontWeight:500,color:selected?.id===p.id?C.white:C.textMuted,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.full_name}</div>
                <div style={{fontSize:10,color:C.textDim}}>{p.avg_velocity?`${p.avg_velocity} mph`:'no data'}</div>
              </div>
            </div>
          ))}
          {pitchers.length===0&&<div style={{padding:'12px 14px',fontSize:12,color:C.textDim}}>No pitchers yet.</div>}
        </aside>

        <main style={S.main}>
          {view==='roster'&&!selected&&(
            <div style={{textAlign:'center',marginTop:80}}>
              <div style={{fontSize:48,marginBottom:16}}>⚾</div>
              <div style={{fontSize:20,fontWeight:700,color:C.white,marginBottom:8}}>SELECT A PITCHER</div>
              <div style={{fontSize:13,color:C.textMuted}}>Choose from the roster on the left.</div>
              {pitchers.length===0&&<div style={{marginTop:20,fontSize:13,color:C.textMuted,maxWidth:400,margin:'20px auto 0'}}>Pitchers will appear here once they sign up. Share your app URL with them to get started.</div>}
            </div>
          )}

          {view==='roster'&&selected&&(
            <div>
              <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:20,paddingBottom:16,borderBottom:`1px solid ${C.border}`}}>
                <Avatar name={selected.full_name||'?'} size={48}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:20,fontWeight:700,color:C.white}}>{selected.full_name?.toUpperCase()}</div>
                  <div style={{fontSize:11,color:C.textMuted,textTransform:'uppercase',letterSpacing:'1px'}}>Pitcher · Salzman Baseball</div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:8,padding:'10px 14px',textAlign:'center'}}>
                    <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4}}>Avg Vel</div>
                    <div style={{fontSize:20,fontWeight:700,color:C.white}}>{selected.avg_velocity||'—'}<span style={{fontSize:11,color:C.textMuted}}> mph</span></div>
                  </div>
                  <div style={{background:C.goldBg,border:`1px solid ${C.goldDim}`,borderRadius:8,padding:'10px 14px',textAlign:'center'}}>
                    <div style={{fontSize:10,color:C.gold,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4}}>Arm Care Min</div>
                    <div style={{fontSize:18,fontWeight:700,color:C.gold}}>{armCare(selected.weekly_pitches,selected.avg_velocity)?armCare(selected.weekly_pitches,selected.avg_velocity).toLocaleString():'—'}<span style={{fontSize:10,color:C.goldDim}}> ft·lb</span></div>
                  </div>
                </div>
              </div>

              <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap'}}>
                {['overview','logs','program','notes','messages'].map(t=>(
                  <button key={t} style={S.tab(tab===t)} onClick={()=>setTab(t)}>{t}</button>
                ))}
              </div>

              {tab==='overview'&&(
                <div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:12}}>
                    {[
                      {label:'Pitches/Wk',val:selected.weekly_pitches||'—'},
                      {label:'HE Throws/Wk',val:selected.weekly_high_effort||'—'},
                      {label:'CMJ Tests',val:cmjResults.length},
                    ].map(m=>(
                      <div key={m.label} style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:8,padding:'12px 14px'}}>
                        <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4}}>{m.label}</div>
                        <div style={{fontSize:22,fontWeight:700,color:C.white}}>{m.val}</div>
                      </div>
                    ))}
                  </div>
                  {cmjResults[0]&&(
                    <div style={{...S.card,border:`1px solid rgba(163,113,247,0.3)`,background:'rgba(163,113,247,0.05)'}}>
                      <div style={{fontSize:11,color:'#a371f7',fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',marginBottom:10}}>Latest CMJ</div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                        {[
                          {l:'Velo Capacity',v:`${cmjResults[0].estimated_velocity?.toFixed(1)} mph`},
                          {l:'Jump Height',v:`${cmjResults[0].jump_height_in?.toFixed(1)} in`},
                          {l:'RSI',v:cmjResults[0].rsi_mod?.toFixed(2)},
                          {l:'PP/kg',v:`${cmjResults[0].peak_power_per_kg?.toFixed(1)} W/kg`},
                        ].map(m=>(
                          <div key={m.l} style={{textAlign:'center'}}>
                            <div style={{fontSize:10,color:'#a371f7',marginBottom:3}}>{m.l}</div>
                            <div style={{fontSize:15,fontWeight:700,color:C.white}}>{m.v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {logs.length>0&&(
                    <div style={S.card}>
                      <div style={{fontSize:11,color:C.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',marginBottom:12}}>Recent Sessions</div>
                      {logs.slice(0,5).map((log:any,i:number)=>(
                        <div key={i} style={{borderBottom:`1px solid ${C.border}`,padding:'10px 0',display:'flex',gap:16}}>
                          <div style={{minWidth:80,fontSize:11,color:C.textMuted}}>{log.log_date}</div>
                          <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
                            {log.velocity&&<span style={{fontSize:12,color:C.gold}}>{log.velocity} mph</span>}
                            {log.weight_lifted&&<span style={{fontSize:12,color:C.teal}}>{log.weight_lifted} lbs</span>}
                            {log.feeling&&<span style={{fontSize:12,color:log.feeling>=7?C.teal:log.feeling>=4?C.gold:C.red}}>{log.feeling}/10</span>}
                            {log.soreness?.length>0&&<span style={{fontSize:12,color:C.red}}>{log.soreness.join(', ')}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab==='logs'&&(
                <div style={S.card}>
                  <div style={{fontSize:11,color:C.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',marginBottom:12}}>All Logs ({logs.length})</div>
                  {logs.length===0&&<div style={{color:C.textDim,fontSize:13}}>No logs yet.</div>}
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                      <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
                        {['Date','Vel','Weight','Sprint','Pitches','HE','Feeling','Soreness'].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',color:C.textMuted,fontSize:10,textTransform:'uppercase'}}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {logs.map((log:any,i:number)=>(
                          <tr key={i} style={{borderBottom:`1px solid ${C.border}`}}>
                            <td style={{padding:'8px 10px',color:C.textMuted}}>{log.log_date}</td>
                            <td style={{padding:'8px 10px',color:C.gold,fontWeight:600}}>{log.velocity?`${log.velocity} mph`:'—'}</td>
                            <td style={{padding:'8px 10px',color:C.teal}}>{log.weight_lifted?`${log.weight_lifted} lbs`:'—'}</td>
                            <td style={{padding:'8px 10px'}}>{log.sprint_time?`${log.sprint_time}s`:'—'}</td>
                            <td style={{padding:'8px 10px'}}>{log.pitch_count||'—'}</td>
                            <td style={{padding:'8px 10px'}}>{log.high_effort_throws||'—'}</td>
                            <td style={{padding:'8px 10px'}}><span style={{color:log.feeling>=7?C.teal:log.feeling>=4?C.gold:C.red,fontWeight:600}}>{log.feeling?`${log.feeling}/10`:'—'}</span></td>
                            <td style={{padding:'8px 10px',color:C.red}}>{log.soreness?.join(', ')||'—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab==='program'&&(
                <div style={S.card}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                    <div style={{fontSize:11,color:C.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px'}}>Weekly Program</div>
                    <button style={S.btn('gold')} onClick={buildPrompt}>✨ Generate with Claude ↗</button>
                  </div>
                  <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap'}}>
                    {DAYS.map(d=><button key={d} style={S.tab(activeDay===d)} onClick={()=>setActiveDay(d)}>{d.slice(0,3)}</button>)}
                  </div>
                  <div style={{display:'flex',gap:6,marginBottom:12}}>
                    {CATS.map(c=><button key={c} style={{...S.tab(activeCat===c),background:activeCat===c?C.goldBg:'transparent',color:activeCat===c?C.gold:C.textMuted,border:`1px solid ${activeCat===c?C.goldDim:C.border}`}} onClick={()=>setActiveCat(c)}>{c}</button>)}
                  </div>
                  <textarea style={{...S.input,minHeight:140,fontFamily:'monospace',fontSize:13,lineHeight:1.8,resize:'both',whiteSpace:'pre',overflowWrap:'normal',overflowX:'auto'}} value={program?.days?.[activeDay]?.[activeCat]||''} onChange={e=>updateCell(e.target.value)} placeholder={`${activeCat} for ${activeDay}...`}/>
                  <div style={{marginTop:14,borderTop:`1px solid ${C.border}`,paddingTop:14}}>
                    <div style={{fontSize:11,color:C.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',marginBottom:10}}>Full Week</div>
                    <div style={{overflowX:'auto'}}>
                      <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                        <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
                          <th style={{padding:'6px 8px',textAlign:'left',color:C.textMuted}}>Day</th>
                          {CATS.map(c=><th key={c} style={{padding:'6px 8px',textAlign:'left',color:C.textMuted}}>{c}</th>)}
                        </tr></thead>
                        <tbody>
                          {DAYS.map(d=>(
                            <tr key={d} style={{borderBottom:`1px solid ${C.border}`}}>
                              <td style={{padding:'6px 8px',fontWeight:600,color:C.text}}>{d}</td>
                              {CATS.map(c=><td key={c} style={{padding:'6px 8px',color:program?.days?.[d]?.[c]?C.text:C.textDim,maxWidth:140,verticalAlign:'top'}}>{program?.days?.[d]?.[c]||'Rest'}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {tab==='notes'&&(
                <div>
                  <div style={S.card}>
                    <div style={{fontSize:11,color:C.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',marginBottom:10}}>New Note</div>
                    <textarea style={{...S.input,minHeight:80,resize:'vertical'}} placeholder="Write a note..." value={noteText} onChange={e=>setNoteText(e.target.value)}/>
                    <button style={{...S.btn('gold'),marginTop:10}} onClick={addNote}>Save Note</button>
                  </div>
                  {notes.map((n:any)=>(
                    <div key={n.id} style={S.card}>
                      <div style={{fontSize:10,color:C.textMuted,marginBottom:6,textTransform:'uppercase'}}>{new Date(n.created_at).toLocaleDateString()}</div>
                      <div style={{fontSize:14,lineHeight:1.7,color:C.text}}>{n.content}</div>
                    </div>
                  ))}
                </div>
              )}

              {tab==='messages'&&(
                <div style={S.card}>
                  <div style={{fontSize:11,color:C.textMuted,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',marginBottom:14}}>Messages · {selected.full_name}</div>
                  <div style={{display:'flex',flexDirection:'column',gap:10,minHeight:200,marginBottom:16}}>
                    {messages.length===0&&<div style={{color:C.textDim,fontSize:13}}>No messages yet.</div>}
                    {messages.map((m:any)=>(
                      <div key={m.id} style={{display:'flex',flexDirection:'column',alignItems:m.sender_role==='coach'?'flex-end':'flex-start'}}>
                        <div style={{fontSize:10,color:C.textDim,marginBottom:3}}>{m.sender_role==='coach'?'Coach Salzman':selected.full_name} · {new Date(m.created_at).toLocaleString()}</div>
                        <div style={{background:m.sender_role==='coach'?C.goldBg:C.bg3,color:m.sender_role==='coach'?C.gold:C.text,border:`1px solid ${m.sender_role==='coach'?C.goldDim:C.border}`,borderRadius:10,padding:'8px 12px',fontSize:13,maxWidth:'80%'}}>{m.content}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <input style={{...S.input,flex:1}} placeholder="Message..." value={msgText} onChange={e=>setMsgText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMessage()}/>
                    <button style={S.btn('gold')} onClick={sendMessage}>Send</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {view==='principles'&&(
            <div>
              <div style={{fontSize:20,fontWeight:700,color:C.white,marginBottom:4}}>TRAINING PRINCIPLES</div>
              <div style={{fontSize:13,color:C.textMuted,marginBottom:16}}>Claude reads this when generating programs.</div>
              <div style={S.card}>
                <textarea style={{...S.input,minHeight:400,lineHeight:1.8,resize:'vertical'}} value={princText} onChange={e=>setPrincText(e.target.value)} placeholder="Paste your training principles here..."/>
                <div style={{marginTop:12,display:'flex',alignItems:'center',gap:12}}>
                  <button style={S.btn('gold')} onClick={savePrinciples}>Save</button>
                  {princSaved&&<span style={{color:C.teal,fontSize:13,fontWeight:600}}>✓ Saved</span>}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
