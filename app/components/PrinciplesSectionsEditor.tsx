'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { PrinciplesSection } from '@/lib/principlesSections'

const C = {
  bg:'#0d1117',bg2:'#161b22',bg3:'#1c2333',border:'#30363d',
  gold:'#e8b84b',goldDim:'#a07c28',goldBg:'rgba(232,184,75,0.08)',
  teal:'#39d353',red:'#f85149',blue:'#58a6ff',
  text:'#e6edf3',textMuted:'#7d8590',textDim:'#484f58',white:'#ffffff',
}

const inp:React.CSSProperties = {width:'100%',background:C.bg3,border:`1px solid ${C.border}`,borderRadius:6,padding:'8px 10px',fontSize:13,color:C.text,outline:'none',boxSizing:'border-box' as const}
const lbl:React.CSSProperties = {fontSize:10,color:C.textMuted,fontWeight:600,marginBottom:4,textTransform:'uppercase' as const,letterSpacing:'0.5px',display:'block'}
const btn = (v:'primary'|'gold'|'danger'='primary'):React.CSSProperties => ({
  background:v==='gold'?C.gold:v==='danger'?'transparent':C.bg3,
  color:v==='gold'?C.bg:v==='danger'?C.red:C.text,
  border:`1px solid ${v==='gold'?C.gold:v==='danger'?C.red:C.border}`,
  borderRadius:6,padding:'6px 12px',fontSize:12,fontWeight:v==='gold'?700:500,cursor:'pointer',
})

const KNOWN_DOCS = ['strength','throwing'] as const

type EditBuffer = { title:string, section_number:string, body:string, tags:string, is_engine_rule:boolean }
const toBuffer = (s:PrinciplesSection):EditBuffer => ({
  title:s.title, section_number:s.section_number, body:s.body,
  tags:(s.tags||[]).join(', '), is_engine_rule:s.is_engine_rule,
})

type NewSectionForm = { section_number:string, title:string, tags:string, is_engine_rule:boolean }
const BLANK_NEW:NewSectionForm = { section_number:'', title:'', tags:'', is_engine_rule:false }

export default function PrinciplesSectionsEditor(){
  const supabase = createClient()
  const [sections,setSections] = useState<PrinciplesSection[]>([])
  const [loading,setLoading] = useState(true)
  const [expanded,setExpanded] = useState<Record<string,boolean>>({})
  const [drafts,setDrafts] = useState<Record<string,EditBuffer>>({})
  const [savingId,setSavingId] = useState<string|null>(null)
  const [savedId,setSavedId] = useState<string|null>(null)
  const [newForms,setNewForms] = useState<Record<string,NewSectionForm>>({})
  const [addingDoc,setAddingDoc] = useState<string|null>(null)

  const load = async () => {
    setLoading(true)
    const {data} = await supabase.from('principles_sections').select('*').order('doc',{ascending:true}).order('sort_order',{ascending:true})
    const rows = (data||[]) as PrinciplesSection[]
    setSections(rows)
    setDrafts(Object.fromEntries(rows.map(s=>[s.id,toBuffer(s)])))
    setLoading(false)
  }

  useEffect(()=>{ load() },[])

  const docs = Array.from(new Set([...KNOWN_DOCS, ...sections.map(s=>s.doc)]))

  const toggleExpanded = (id:string) => setExpanded(prev=>({...prev,[id]:!prev[id]}))

  const updateDraft = (id:string, patch:Partial<EditBuffer>) => {
    setDrafts(prev=>({...prev,[id]:{...prev[id],...patch}}))
  }

  const saveSection = async (section:PrinciplesSection) => {
    const draft = drafts[section.id]
    if (!draft) return
    setSavingId(section.id)
    const tags = draft.tags.split(',').map(t=>t.trim()).filter(t=>t.length>0)
    const updates = {
      title: draft.title.trim(), section_number: draft.section_number.trim(),
      body: draft.body, tags, is_engine_rule: draft.is_engine_rule,
      updated_at: new Date().toISOString(), // the old savePrinciples() never set this -- fixed here
    }
    const {error} = await supabase.from('principles_sections').update(updates).eq('id',section.id)
    setSavingId(null)
    if (error) { alert('Save failed: '+error.message); return }
    setSections(prev=>prev.map(s=>s.id===section.id?{...s,...updates}:s))
    setSavedId(section.id)
    setTimeout(()=>setSavedId(null),2000)
  }

  const deleteSection = async (section:PrinciplesSection) => {
    if (!window.confirm(`Delete section ${section.section_number} — "${section.title}"? This cannot be undone.`)) return
    const {error} = await supabase.from('principles_sections').delete().eq('id',section.id)
    if (error) { alert('Delete failed: '+error.message); return }
    setSections(prev=>prev.filter(s=>s.id!==section.id))
  }

  const moveSection = async (section:PrinciplesSection, direction:'up'|'down') => {
    const group = sections.filter(s=>s.doc===section.doc).sort((a,b)=>a.sort_order-b.sort_order)
    const idx = group.findIndex(s=>s.id===section.id)
    const swapIdx = direction==='up' ? idx-1 : idx+1
    if (swapIdx<0 || swapIdx>=group.length) return
    const other = group[swapIdx]
    const now = new Date().toISOString()
    const [aOrder,bOrder] = [other.sort_order, section.sort_order]
    const r1 = await supabase.from('principles_sections').update({sort_order:aOrder,updated_at:now}).eq('id',section.id)
    const r2 = await supabase.from('principles_sections').update({sort_order:bOrder,updated_at:now}).eq('id',other.id)
    const error = r1.error || r2.error
    if (error) { alert('Reorder failed: '+error.message); return }
    setSections(prev=>prev.map(s=>{
      if (s.id===section.id) return {...s,sort_order:aOrder,updated_at:now}
      if (s.id===other.id) return {...s,sort_order:bOrder,updated_at:now}
      return s
    }))
  }

  const addSection = async (doc:string) => {
    const form = newForms[doc] || BLANK_NEW
    if (!form.title.trim() || !form.section_number.trim()) return
    const group = sections.filter(s=>s.doc===doc)
    const nextOrder = group.length>0 ? Math.max(...group.map(s=>s.sort_order))+10 : 10
    const tags = form.tags.split(',').map(t=>t.trim()).filter(t=>t.length>0)
    const {data,error} = await supabase.from('principles_sections').insert({
      doc, section_number:form.section_number.trim(), title:form.title.trim(),
      body:'', tags, is_engine_rule:form.is_engine_rule, sort_order:nextOrder,
      updated_at:new Date().toISOString(),
    }).select().maybeSingle()
    if (error) { alert('Add failed: '+error.message); return }
    if (data) {
      setSections(prev=>[...prev, data as PrinciplesSection])
      setDrafts(prev=>({...prev,[data.id]:toBuffer(data as PrinciplesSection)}))
      setExpanded(prev=>({...prev,[data.id]:true}))
    }
    setNewForms(prev=>({...prev,[doc]:BLANK_NEW}))
    setAddingDoc(null)
  }

  if (loading) return <div style={{fontSize:13,color:C.textMuted,padding:'12px 0'}}>Loading principles sections...</div>

  return (
    <div>
      {docs.map(doc=>{
        const group = sections.filter(s=>s.doc===doc).sort((a,b)=>a.sort_order-b.sort_order)
        const form = newForms[doc] || BLANK_NEW
        return (
          <div key={doc} style={{marginBottom:20}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <div style={{fontSize:13,fontWeight:700,color:C.white,textTransform:'uppercase' as const,letterSpacing:'0.5px'}}>{doc} <span style={{color:C.textMuted,fontWeight:400,textTransform:'none' as const}}>({group.length} section{group.length!==1?'s':''})</span></div>
              <button style={btn()} onClick={()=>setAddingDoc(addingDoc===doc?null:doc)}>{addingDoc===doc?'Cancel':'+ Add Section'}</button>
            </div>

            {addingDoc===doc && (
              <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8,padding:'12px 14px',marginBottom:8,display:'flex',flexDirection:'column',gap:8}}>
                <div style={{display:'flex',gap:8}}>
                  <div style={{width:100}}>
                    <label style={lbl}>Section #</label>
                    <input type="text" style={inp} placeholder="4.2" value={form.section_number} onChange={e=>setNewForms(prev=>({...prev,[doc]:{...form,section_number:e.target.value}}))}/>
                  </div>
                  <div style={{flex:1}}>
                    <label style={lbl}>Title</label>
                    <input type="text" style={inp} placeholder="Section title" value={form.title} onChange={e=>setNewForms(prev=>({...prev,[doc]:{...form,title:e.target.value}}))}/>
                  </div>
                </div>
                <div>
                  <label style={lbl}>Tags (comma-separated)</label>
                  <input type="text" style={inp} placeholder="rate_limiter, off_season" value={form.tags} onChange={e=>setNewForms(prev=>({...prev,[doc]:{...form,tags:e.target.value}}))}/>
                </div>
                <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:C.textMuted}}>
                  <input type="checkbox" checked={form.is_engine_rule} onChange={e=>setNewForms(prev=>({...prev,[doc]:{...form,is_engine_rule:e.target.checked}}))}/>
                  Engine rule (always included in the program-writing prompt)
                </label>
                <button style={btn('gold')} onClick={()=>addSection(doc)}>Add</button>
              </div>
            )}

            {group.length===0 && addingDoc!==doc && <div style={{fontSize:12,color:C.textDim,padding:'8px 0'}}>No sections yet.</div>}

            {group.map((s,i)=>{
              const draft = drafts[s.id] || toBuffer(s)
              const isOpen = !!expanded[s.id]
              return (
                <div key={s.id} style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8,marginBottom:6,overflow:'hidden'}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',cursor:'pointer'}} onClick={()=>toggleExpanded(s.id)}>
                    <span style={{fontSize:11,color:C.textDim,width:16}}>{isOpen?'▾':'▸'}</span>
                    <span style={{fontSize:12,color:C.gold,fontWeight:700,minWidth:44}}>{s.section_number}</span>
                    <span style={{fontSize:13,color:C.white,fontWeight:600,flex:1}}>{s.title}</span>
                    {s.is_engine_rule && <span title="Always included in the program-writing prompt" style={{fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:10,background:C.goldBg,color:C.gold,border:`1px solid ${C.goldDim}`,textTransform:'uppercase' as const,letterSpacing:'0.4px'}}>Engine Rule</span>}
                    {(s.tags||[]).slice(0,3).map(t=>(
                      <span key={t} style={{fontSize:9,color:C.textMuted,background:C.bg3,border:`1px solid ${C.border}`,borderRadius:10,padding:'2px 7px'}}>{t}</span>
                    ))}
                    <div style={{display:'flex',gap:4}} onClick={e=>e.stopPropagation()}>
                      <button style={{...btn(),padding:'3px 8px'}} disabled={i===0} onClick={()=>moveSection(s,'up')}>↑</button>
                      <button style={{...btn(),padding:'3px 8px'}} disabled={i===group.length-1} onClick={()=>moveSection(s,'down')}>↓</button>
                    </div>
                  </div>

                  {isOpen && (
                    <div style={{padding:'0 12px 12px 12px',display:'flex',flexDirection:'column',gap:8}}>
                      <div style={{display:'flex',gap:8}}>
                        <div style={{width:100}}>
                          <label style={lbl}>Section #</label>
                          <input type="text" style={inp} value={draft.section_number} onChange={e=>updateDraft(s.id,{section_number:e.target.value})}/>
                        </div>
                        <div style={{flex:1}}>
                          <label style={lbl}>Title</label>
                          <input type="text" style={inp} value={draft.title} onChange={e=>updateDraft(s.id,{title:e.target.value})}/>
                        </div>
                      </div>
                      <div>
                        <label style={lbl}>Tags (comma-separated)</label>
                        <input type="text" style={inp} placeholder="rate_limiter, off_season, high_school" value={draft.tags} onChange={e=>updateDraft(s.id,{tags:e.target.value})}/>
                      </div>
                      <div>
                        <label style={lbl}>Body (markdown)</label>
                        <textarea style={{...inp,minHeight:180,lineHeight:1.6,resize:'vertical' as const,fontFamily:'monospace'}} value={draft.body} onChange={e=>updateDraft(s.id,{body:e.target.value})}/>
                      </div>
                      <label style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:C.textMuted}} title="Engine rule sections are always included in the program-writing prompt, regardless of any athlete's context tags. Use this for rules that apply to every pitcher every time — not situational guidance.">
                        <input type="checkbox" checked={draft.is_engine_rule} onChange={e=>updateDraft(s.id,{is_engine_rule:e.target.checked})}/>
                        Engine rule <span style={{color:C.textDim}}>(always included in the program-writing prompt — hover for details)</span>
                      </label>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <button style={btn('gold')} disabled={savingId===s.id} onClick={()=>saveSection(s)}>{savingId===s.id?'Saving...':'Save'}</button>
                        <button style={btn('danger')} onClick={()=>deleteSection(s)}>Delete</button>
                        {savedId===s.id && <span style={{color:C.teal,fontSize:12,fontWeight:600}}>Saved</span>}
                        {s.updated_at && <span style={{fontSize:11,color:C.textDim,marginLeft:'auto'}}>Updated {new Date(s.updated_at).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
