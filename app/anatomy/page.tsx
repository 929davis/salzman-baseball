'use client'
import { useState } from 'react'
import { ANATOMY_REGIONS, type AnatomyRegion, type BodyView } from '@/lib/anatomy'

const C = {
  bg:'#0d1117',bg2:'#161b22',bg3:'#1c2333',border:'#30363d',
  gold:'#e8b84b',goldDim:'#a07c28',goldBg:'rgba(232,184,75,0.08)',
  teal:'#39d353',red:'#f85149',blue:'#58a6ff',purple:'#a371f7',
  text:'#e6edf3',textMuted:'#7d8590',textDim:'#484f58',white:'#ffffff',
}

const AREA_LABELS:Record<string,string> = {upper_body:'Upper Body',core:'Core',lower_body:'Lower Body'}

function hasContent(r:AnatomyRegion){
  return !!r.deliveryRole || r.strengthening.length>0 || r.mobilityStability.length>0 || r.sorenessRelief.length>0
}

function BodySilhouette(){
  // Simplified stylized outline, shared shape for both front and back views —
  // not anatomically precise, just enough visual context for hotspot placement.
  return (
    <g stroke={C.border} strokeWidth={2} fill="none" opacity={0.7}>
      <circle cx={120} cy={45} r={28}/>
      <line x1={120} y1={73} x2={120} y2={300} strokeWidth={46} strokeLinecap="round"/>
      <path d="M95,95 L50,180 L35,290" strokeWidth={20} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M145,95 L190,180 L205,290" strokeWidth={20} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M100,295 L90,430 L85,560" strokeWidth={28} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M140,295 L150,430 L155,560" strokeWidth={28} strokeLinecap="round" strokeLinejoin="round"/>
    </g>
  )
}

export default function AnatomyPage(){
  const [view,setView]=useState<BodyView>('front')
  const [selectedId,setSelectedId]=useState<string|null>(null)

  const selected = ANATOMY_REGIONS.find(r=>r.id===selectedId)||null
  const regionsForView = ANATOMY_REGIONS.filter(r=>r.hotspots.some(h=>h.view===view))

  const detailSection=(title:string,items:string[])=>(
    <div style={{marginBottom:16}}>
      <div style={{fontSize:11,color:C.gold,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:6}}>{title}</div>
      {items.length===0?(
        <div style={{fontSize:12,color:C.textDim}}>No content yet.</div>
      ):(
        <ul style={{margin:0,paddingLeft:18,color:C.text,fontSize:13,lineHeight:1.7}}>
          {items.map((it,i)=><li key={i}>{it}</li>)}
        </ul>
      )}
    </div>
  )

  return (
    <div style={{minHeight:'100vh',background:C.bg,color:C.text,fontFamily:'system-ui,-apple-system,sans-serif',padding:'24px 20px'}}>
      <div style={{maxWidth:960,margin:'0 auto'}}>
        <div style={{fontSize:22,fontWeight:700,color:C.gold,marginBottom:4}}>Delivery Anatomy Chart</div>
        <div style={{fontSize:13,color:C.textMuted,marginBottom:20}}>Click a highlighted region to see its role in the delivery, strengthening work, mobility/stability work, and soreness relief.</div>

        <div style={{display:'flex',gap:24,flexWrap:'wrap' as const}}>
          <div style={{flexShrink:0}}>
            <div style={{display:'flex',gap:6,marginBottom:12}}>
              {(['front','back'] as BodyView[]).map(v=>(
                <button key={v} onClick={()=>setView(v)} style={{background:view===v?C.gold:C.bg3,color:view===v?C.bg:C.textMuted,border:`1px solid ${view===v?C.gold:C.border}`,borderRadius:8,padding:'6px 14px',fontSize:12,fontWeight:view===v?700:400,cursor:'pointer',textTransform:'capitalize' as const}}>{v}</button>
              ))}
            </div>
            <svg viewBox="0 0 240 600" width={280} height={700} style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:12}}>
              <BodySilhouette/>
              {regionsForView.map(region=>{
                const filled=hasContent(region)
                const isSelected=selectedId===region.id
                return region.hotspots.filter(h=>h.view===view).map((h,i)=>(
                  <ellipse
                    key={`${region.id}-${i}`}
                    cx={h.cx} cy={h.cy} rx={h.rx} ry={h.ry}
                    fill={filled?'rgba(232,184,75,0.55)':'rgba(125,133,144,0.35)'}
                    stroke={isSelected?C.white:(filled?C.gold:C.textMuted)}
                    strokeWidth={isSelected?2:1}
                    style={{cursor:'pointer'}}
                    onClick={()=>setSelectedId(region.id)}
                  >
                    <title>{region.name}</title>
                  </ellipse>
                ))
              })}
            </svg>
            <div style={{display:'flex',gap:14,marginTop:10,fontSize:10,color:C.textMuted}}>
              <div style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:10,height:10,borderRadius:5,background:'rgba(232,184,75,0.55)',border:`1px solid ${C.gold}`,display:'inline-block'}}/> Content added</div>
              <div style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:10,height:10,borderRadius:5,background:'rgba(125,133,144,0.35)',border:`1px solid ${C.textMuted}`,display:'inline-block'}}/> Not filled in yet</div>
            </div>
          </div>

          <div style={{flex:1,minWidth:300,background:C.bg2,border:`1px solid ${C.border}`,borderRadius:12,padding:20}}>
            {!selected?(
              <div style={{color:C.textDim,fontSize:13,textAlign:'center' as const,padding:'40px 0'}}>Click a region on the diagram to see its detail.</div>
            ):(
              <div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
                  <div style={{fontSize:17,fontWeight:700,color:C.white}}>{selected.name}</div>
                  <div style={{fontSize:10,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',background:C.bg3,border:`1px solid ${C.border}`,borderRadius:6,padding:'3px 8px'}}>{AREA_LABELS[selected.area]}</div>
                </div>
                <div style={{height:1,background:C.border,margin:'12px 0 16px'}}/>
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:11,color:C.gold,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:6}}>Role in the Delivery</div>
                  <div style={{fontSize:13,color:C.text,lineHeight:1.7}}>{selected.deliveryRole||<span style={{color:C.textDim}}>No content yet.</span>}</div>
                </div>
                {detailSection('Strengthening Exercises',selected.strengthening)}
                {detailSection('Mobility / Stability Exercises',selected.mobilityStability)}
                {detailSection('Soreness / Tightness Relief',selected.sorenessRelief)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
