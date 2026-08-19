'use client'
import { useState } from 'react'
import MiniSparkline from '@/app/components/MiniSparkline'
import TestVideoLink from '@/app/components/TestVideoLink'
import type { ScreenStatus } from '@/lib/benchmarks'

const C = {
  bg:'#0d1117',bg2:'#161b22',bg3:'#1c2333',border:'#30363d',
  gold:'#e8b84b',text:'#e6edf3',textMuted:'#7d8590',textDim:'#484f58',white:'#ffffff',
}

// Best-effort conversion of a YouTube watch/share URL into an embeddable URL.
// Falls back to a plain link if the URL doesn't match a recognizable YouTube pattern.
function toEmbedUrl(url:string):string|null{
  try{
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return `https://www.youtube.com/embed/${u.pathname.slice(1)}`
    if (u.hostname.includes('youtube.com')){
      const id = u.searchParams.get('v')
      if (id) return `https://www.youtube.com/embed/${id}`
      if (u.pathname.startsWith('/embed/')) return url
    }
    return null
  } catch { return null }
}

type Variant =
  | {kind:'power', unit:string, currentValue:number|null, tier:string|null, tierColor:string, onSaveValue:(value:number)=>void|Promise<void>}
  | {kind:'screen', currentStatus:ScreenStatus|null, statusColors:Record<ScreenStatus,string>, onSetStatus:(status:ScreenStatus)=>void|Promise<void>}

export default function TestDetailModal({label, description, testKey, history, color, videos, onSaveVideo, onClose, variant}:{
  label:string, description:string, testKey:string, history:{date:string,value:number}[], color:string,
  videos:Record<string,string>, onSaveVideo:(key:string,url:string)=>void, onClose:()=>void, variant:Variant,
}){
  const [valueInput,setValueInput] = useState(variant.kind==='power'&&variant.currentValue!=null?String(variant.currentValue):'')
  const [saving,setSaving] = useState(false)
  const embedUrl = videos[testKey] ? toEmbedUrl(videos[testKey]) : null

  const saveValue = async () => {
    if (variant.kind!=='power') return
    const v = parseFloat(valueInput)
    if (isNaN(v)) return
    setSaving(true)
    await variant.onSaveValue(v)
    setSaving(false)
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',overflowY:'auto' as const,padding:'20px 0'}} onClick={onClose}>
      <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:12,padding:24,width:440,maxWidth:'90vw',maxHeight:'85vh',overflowY:'auto' as const}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
          <div style={{fontSize:16,fontWeight:700,color:C.white}}>{label}</div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:C.textMuted,cursor:'pointer',fontSize:16}}>✕</button>
        </div>
        <div style={{fontSize:12,color:C.textMuted,lineHeight:1.6,marginBottom:16}}>{description}</div>

        <div style={{marginBottom:16}}>
          {embedUrl ? (
            <div style={{position:'relative' as const,paddingBottom:'56.25%',height:0,borderRadius:8,overflow:'hidden',marginBottom:6}}>
              <iframe src={embedUrl} title={`${label} demo video`} allowFullScreen style={{position:'absolute' as const,top:0,left:0,width:'100%',height:'100%',border:'none'}}/>
            </div>
          ) : videos[testKey] ? (
            <a href={videos[testKey]} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:'#58a6ff',display:'block',marginBottom:6}}>▶ Watch demo video</a>
          ) : (
            <div style={{fontSize:11,color:C.textDim,marginBottom:6}}>No demo video attached yet.</div>
          )}
          <TestVideoLink testKey={testKey} videos={videos} onSave={onSaveVideo}/>
        </div>

        {history.length>1 && (
          <div style={{marginBottom:16}}>
            <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4}}>Trend</div>
            <MiniSparkline data={history} color={color} height={50}/>
          </div>
        )}

        <div style={{borderTop:`1px solid ${C.border}`,paddingTop:16}}>
          {variant.kind==='power' ? (
            <>
              <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:8}}>Log a Result</div>
              <div style={{display:'flex',gap:8}}>
                <input
                  type="text" inputMode="decimal" autoFocus
                  style={{flex:1,background:C.bg3,border:`1px solid ${C.border}`,borderRadius:6,padding:'8px 10px',fontSize:14,color:C.text,outline:'none'}}
                  placeholder={`Value in ${variant.unit}`}
                  value={valueInput} onChange={e=>setValueInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter')saveValue()}}
                />
                <button onClick={saveValue} disabled={saving||!valueInput.trim()} style={{background:C.gold,color:C.bg,border:'none',borderRadius:6,padding:'0 16px',fontSize:13,fontWeight:700,cursor:'pointer'}}>{saving?'Saving...':'Save'}</button>
              </div>
              {variant.currentValue!=null && (
                <div style={{fontSize:11,color:C.textDim,marginTop:8}}>Current: {variant.currentValue}{variant.unit} — <span style={{color:variant.tierColor,fontWeight:600}}>{variant.tier||'No tier'}</span></div>
              )}
            </>
          ) : (
            <>
              <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:8}}>Set Result</div>
              <div style={{display:'flex',gap:8}}>
                {(['Pass','Limited','Fail'] as ScreenStatus[]).map(s=>(
                  <button key={s} onClick={()=>variant.onSetStatus(s)}
                    style={{flex:1,background:variant.currentStatus===s?`${variant.statusColors[s]}26`:C.bg3,color:variant.currentStatus===s?variant.statusColors[s]:C.textMuted,border:`1px solid ${variant.currentStatus===s?variant.statusColors[s]:C.border}`,borderRadius:6,padding:'10px 0',fontSize:13,fontWeight:700,cursor:'pointer'}}
                  >{s}</button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
