'use client'
import { useState } from 'react'

export default function TestVideoLink({testKey, videos, onSave}:{testKey:string, videos:Record<string,string>, onSave:(key:string,url:string)=>void}){
  const [editing,setEditing] = useState(false)
  const [val,setVal] = useState('')
  const url = videos[testKey]

  if (editing) return (
    <span style={{display:'inline-flex',gap:4,alignItems:'center'}} onClick={e=>e.stopPropagation()}>
      <input
        autoFocus
        style={{fontSize:10,width:130,background:'#1c2333',border:'1px solid #30363d',borderRadius:4,padding:'2px 5px',color:'#e6edf3',outline:'none'}}
        placeholder="YouTube URL"
        value={val}
        onChange={e=>setVal(e.target.value)}
        onKeyDown={e=>{
          if (e.key==='Enter' && val.trim()){onSave(testKey,val.trim());setEditing(false)}
          if (e.key==='Escape') setEditing(false)
        }}
      />
      <button onClick={()=>{if(val.trim()){onSave(testKey,val.trim());setEditing(false)}}} style={{fontSize:10,color:'#58a6ff',background:'none',border:'none',cursor:'pointer',padding:0}}>✓</button>
    </span>
  )

  return (
    <span style={{display:'inline-flex',gap:6,alignItems:'center'}} onClick={e=>e.stopPropagation()}>
      {url && <a href={url} target="_blank" rel="noopener noreferrer" style={{fontSize:10,color:'#58a6ff',textDecoration:'none'}}>▶ Video</a>}
      <button onClick={()=>{setVal(url||'');setEditing(true)}} style={{fontSize:9,color:'#7d8590',background:'none',border:'none',cursor:'pointer',padding:0}} title={url?'Edit video':'Add video'}>{url?'✎':'+ video'}</button>
    </span>
  )
}
