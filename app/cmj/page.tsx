'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const C = {
  bg:'#0d1117',bg2:'#161b22',bg3:'#1c2333',border:'#30363d',
  gold:'#e8b84b',goldDim:'#a07c28',goldBg:'rgba(232,184,75,0.08)',
  teal:'#39d353',red:'#f85149',blue:'#58a6ff',purple:'#a371f7',
  text:'#e6edf3',textMuted:'#7d8590',textDim:'#484f58',white:'#ffffff',
}

const LEVELS = ['High School','College — JUCO','College — D3','College — D2','College — D1','Independent Pro','Minor League','Major League']

const calcCMJ=({startFrame,takeoffFrame,landingFrame,fps,massKg}:{startFrame:number,takeoffFrame:number,landingFrame:number,fps:number,massKg:number})=>{
  const ft=(landingFrame-takeoffFrame)/fps
  const ttt=(takeoffFrame-startFrame)/fps
  const jh=(9.81*ft*ft)/8
  const jhc=jh*100
  const jhi=jh*39.3701
  const rsi=jh/ttt
  const pp=(60.7*jhc)+(45.3*massKg)-2055
  const ppkg=pp/massKg
  const tv=Math.sqrt(2*9.81*jh)
  const ei=rsi*ppkg
  const ev=47+(0.70*ppkg)+(10*rsi)+(0.02*ei)
  return{flightTime:ft,jumpHeightIn:jhi,rsiMod:rsi,peakPowerPerKg:ppkg,takeoffVelocity:tv,explosiveIndex:ei,estimatedVelocity:ev}
}

const velTier=(v:number)=>v>=95?{l:'Elite / Pro',c:C.teal}:v>=90?{l:'High D1 / Pro Fringe',c:C.gold}:v>=85?{l:'D1 Range',c:C.blue}:v>=80?{l:'D2/D3 Range',c:C.textMuted}:{l:'Development',c:C.red}

export default function PublicCMJ(){
  const [form,setForm]=useState({bodyweight:'',weightUnit:'lbs',fps:'240',startFrame:'',takeoffFrame:'',landingFrame:''})
  const [result,setResult]=useState<any>(null)
  const [err,setErr]=useState('')
  const [saveForm,setSaveForm]=useState({name:'',age:'',level:'',actualVelocity:''})
  const [saving,setSaving]=useState(false)
  const [saved,setSaved]=useState(false)
  const supabase=createClient()

  const calculate=()=>{
    setErr('');setResult(null);setSaved(false)
    const bw=parseFloat(form.bodyweight)
    const fps=parseFloat(form.fps)
    const sf=parseFloat(form.startFrame)
    const tf=parseFloat(form.takeoffFrame)
    const lf=parseFloat(form.landingFrame)
    if (!bw||isNaN(sf)||isNaN(tf)||isNaN(lf)){setErr('Please fill in all fields.');return}
    if (tf<=sf){setErr('Takeoff frame must be after start frame.');return}
    if (lf<=tf){setErr('Landing frame must be after takeoff frame.');return}
    const ft=(lf-tf)/fps
    if (ft>1.0){setErr('Flight time over 1 second — please check your frame numbers. Common mistake: using timestamps instead of frame numbers.');return}
    if (ft<0.2){setErr('Flight time under 0.2 seconds — please check your frame numbers.');return}
    const massKg=form.weightUnit==='lbs'?bw*0.453592:bw
    setResult(calcCMJ({startFrame:sf,takeoffFrame:tf,landingFrame:lf,fps,massKg}))
  }

  const save=async()=>{
    if (!saveForm.name.trim()||!result)return
    setSaving(true)
    const bw=parseFloat(form.bodyweight)
    const massKg=form.weightUnit==='lbs'?bw*0.453592:bw
    await supabase.from('public_cmj_submissions').insert({
      name:saveForm.name.trim(),
      age:parseInt(saveForm.age)||null,
      level:saveForm.level||null,
      actual_velocity:parseFloat(saveForm.actualVelocity)||null,
      bodyweight:bw,weight_unit:form.weightUnit,fps:parseInt(form.fps),
      start_frame:parseInt(form.startFrame),
      takeoff_frame:parseInt(form.takeoffFrame),
      landing_frame:parseInt(form.landingFrame),
      flight_time:result.flightTime,
      jump_height_in:result.jumpHeightIn,
      rsi_mod:result.rsiMod,
      peak_power_per_kg:result.peakPowerPerKg,
      takeoff_velocity:result.takeoffVelocity,
      explosive_index:result.explosiveIndex,
      estimated_velocity:result.estimatedVelocity,
    })
    setSaving(false);setSaved(true)
  }

  const reset=()=>{
    setForm({bodyweight:'',weightUnit:'lbs',fps:'240',startFrame:'',takeoffFrame:'',landingFrame:''})
    setResult(null);setErr('');setSaved(false)
    setSaveForm({name:'',age:'',level:'',actualVelocity:''})
  }

  const inp={width:'100%',background:C.bg3,border:`1px solid ${C.border}`,borderRadius:8,padding:'14px 16px',fontSize:16,color:C.text,boxSizing:'border-box' as const,outline:'none',marginBottom:4}
  const lbl={fontSize:11,color:C.textMuted,fontWeight:600 as const,marginBottom:6,display:'block',textTransform:'uppercase' as const,letterSpacing:'0.5px',marginTop:16 as const}

  const tier=result?velTier(result.estimatedVelocity):null

  return(
    <div style={{fontFamily:'system-ui,-apple-system,sans-serif',background:C.bg,minHeight:'100vh',color:C.text}}>
      {/* Header */}
      <div style={{background:C.bg2,borderBottom:`1px solid ${C.border}`,padding:'16px 20px',display:'flex',alignItems:'center',gap:12}}>
        <div style={{width:36,height:36,background:`linear-gradient(135deg,${C.gold},${C.goldDim})`,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>⚾</div>
        <div>
          <div style={{fontSize:16,fontWeight:700,color:C.white,letterSpacing:'-0.3px'}}>SALZMAN BASEBALL</div>
          <div style={{fontSize:10,color:C.gold,textTransform:'uppercase' as const,letterSpacing:'1px'}}>CMJ Velocity Predictor</div>
        </div>
      </div>

      <div style={{maxWidth:480,margin:'0 auto',padding:'20px 16px'}}>

        {/* Hero */}
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{fontSize:24,fontWeight:700,color:C.white,marginBottom:8}}>What's Your Velocity Capacity?</div>
          <div style={{fontSize:14,color:C.textMuted,lineHeight:1.6}}>Film a Countermovement Jump at 240fps on your iPhone, enter the frame numbers below, and find out your estimated throwing velocity capacity.</div>
        </div>

        {/* How to film */}
        <div style={{background:'rgba(88,166,255,0.06)',border:'1px solid rgba(88,166,255,0.2)',borderRadius:12,padding:'14px 16px',marginBottom:20}}>
          <div style={{fontSize:12,fontWeight:700,color:C.blue,marginBottom:10,textTransform:'uppercase' as const,letterSpacing:'0.5px'}}>How to Film</div>
          {[
            'Open iPhone Camera → swipe to SLO-MO → set to 240fps',
            'Stand sideways to camera, feet shoulder-width',
            'Hands on your hips, squat down then jump as high as possible (DO NOT SWING YOUR ARMS IN THE JUMP)',
            'Open the video in Photos → Edit → Frame Number = Time (in seconds) × FPS (EX: If the timestamp shows 0:03.2 → that is 3.2 seconds → 3.2 × 240 = 768) do that for first downward movement, the frame you feet leave the ground, and when your feet land after the jump
            'Record: frame you start down, frame feet leave ground, frame feet land',
          ].map((s,i)=>(
            <div key={i} style={{display:'flex',gap:10,marginBottom:6,alignItems:'flex-start'}}>
              <div style={{width:20,height:20,borderRadius:'50%',background:'rgba(88,166,255,0.15)',border:'1px solid rgba(88,166,255,0.3)',color:C.blue,fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>{i+1}</div>
              <div style={{fontSize:12,color:C.textMuted,lineHeight:1.5}}>{s}</div>
            </div>
          ))}
        </div>

        {/* Calculator form */}
        {!result&&(
          <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:12,padding:'20px 16px',marginBottom:16}}>
            <div style={{fontSize:14,fontWeight:700,color:C.white,marginBottom:16}}>Enter Your Data</div>

            <label style={lbl}>Body Weight</label>
            <div style={{display:'flex',gap:8}}>
              <input type="text" inputMode="numeric" pattern="[0-9]*" style={{...inp,flex:1,marginBottom:0}} placeholder="e.g. 195" value={form.bodyweight} onChange={e=>setForm(f=>({...f,bodyweight:e.target.value}))}/>
              <select style={{...inp,width:80,marginBottom:0}} value={form.weightUnit} onChange={e=>setForm(f=>({...f,weightUnit:e.target.value}))}>
                <option value="lbs">lbs</option>
                <option value="kg">kg</option>
              </select>
            </div>

            <label style={lbl}>Camera Speed</label>
            <select style={inp} value={form.fps} onChange={e=>setForm(f=>({...f,fps:e.target.value}))}>
              <option value="240">240 FPS (iPhone Slo-Mo)</option>
              <option value="120">120 FPS</option>
              <option value="480">480 FPS</option>
            </select>

            <label style={lbl}>Start Frame</label>
            <input type="text" inputMode="numeric" pattern="[0-9]*" style={inp} placeholder="Frame when you start going down" value={form.startFrame} onChange={e=>setForm(f=>({...f,startFrame:e.target.value}))}/>

            <label style={lbl}>Takeoff Frame</label>
            <input type="text" inputMode="numeric" pattern="[0-9]*" style={inp} placeholder="Frame when feet leave the ground" value={form.takeoffFrame} onChange={e=>setForm(f=>({...f,takeoffFrame:e.target.value}))}/>

            <label style={lbl}>Landing Frame</label>
            <input type="text" inputMode="numeric" pattern="[0-9]*" style={inp} placeholder="Frame when feet hit the ground" value={form.landingFrame} onChange={e=>setForm(f=>({...f,landingFrame:e.target.value}))}/>

            {err&&(
              <div style={{color:C.red,fontSize:13,marginTop:12,padding:'12px 14px',background:'rgba(248,81,73,0.08)',border:'1px solid rgba(248,81,73,0.2)',borderRadius:8,lineHeight:1.5}}>{err}</div>
            )}

            <button onClick={calculate} style={{width:'100%',background:C.gold,color:C.bg,border:'none',borderRadius:10,padding:'16px',fontSize:16,fontWeight:700,cursor:'pointer',marginTop:20}}>
              Calculate My Velocity Capacity
            </button>
          </div>
        )}

        {/* Result */}
        {result&&(
          <div>
            <div style={{background:'rgba(163,113,247,0.08)',border:'1px solid rgba(163,113,247,0.3)',borderRadius:12,padding:'24px 16px',marginBottom:16,textAlign:'center'}}>
              <div style={{fontSize:11,color:C.purple,fontWeight:700,textTransform:'uppercase' as const,letterSpacing:'1px',marginBottom:8}}>Estimated Velocity Capacity</div>
              <div style={{fontSize:72,fontWeight:700,color:C.white,letterSpacing:'-3px',lineHeight:1,marginBottom:8}}>
                {result.estimatedVelocity.toFixed(1)}
                <span style={{fontSize:22,color:C.textMuted,fontWeight:400,letterSpacing:0}}> mph</span>
              </div>
              {tier&&(
                <div style={{display:'inline-block',background:`${tier.c}20`,color:tier.c,border:`1px solid ${tier.c}40`,borderRadius:20,padding:'5px 18px',fontSize:13,fontWeight:700,marginBottom:20}}>{tier.l}</div>
              )}

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:8}}>
                {[
                  {l:'Jump Height',v:`${result.jumpHeightIn.toFixed(1)} in`,c:C.gold},
                  {l:'RSI-Mod',v:result.rsiMod.toFixed(2),c:C.teal},
                  {l:'Peak Power/kg',v:`${result.peakPowerPerKg.toFixed(1)} W/kg`,c:C.blue},
                  {l:'Flight Time',v:`${result.flightTime.toFixed(3)}s`,c:C.purple},
                ].map(m=>(
                  <div key={m.l} style={{background:'rgba(0,0,0,0.3)',borderRadius:8,padding:'12px 10px'}}>
                    <div style={{fontSize:10,color:C.textMuted,marginBottom:4}}>{m.l}</div>
                    <div style={{fontSize:18,fontWeight:700,color:m.c}}>{m.v}</div>
                  </div>
                ))}
              </div>

              <div style={{fontSize:11,color:C.textDim,marginTop:8,lineHeight:1.5}}>
                This is your neuromuscular velocity capacity — your ceiling based on power output. Actual velocity depends on mechanics, arm health, and training.
              </div>
            </div>

            {/* Save form */}
            {!saved?(
              <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:12,padding:'20px 16px',marginBottom:16}}>
                <div style={{fontSize:14,fontWeight:700,color:C.white,marginBottom:4}}>Save Your Result</div>
                <div style={{fontSize:12,color:C.textMuted,marginBottom:16}}>Submit your result to the Salzman Baseball database. Optional but helps improve the velocity model.</div>

                <label style={{...lbl,marginTop:0}}>Your Name *</label>
                <input type="text" style={inp} placeholder="First and last name" value={saveForm.name} onChange={e=>setSaveForm(f=>({...f,name:e.target.value}))}/>

                <label style={lbl}>Age</label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" style={inp} placeholder="e.g. 19" value={saveForm.age} onChange={e=>setSaveForm(f=>({...f,age:e.target.value}))}/>

                <label style={lbl}>Level</label>
                <select style={inp} value={saveForm.level} onChange={e=>setSaveForm(f=>({...f,level:e.target.value}))}>
                  <option value="">Select level...</option>
                  {LEVELS.map(l=><option key={l} value={l}>{l}</option>)}
                </select>

                <label style={lbl}>Actual Velocity (if known)</label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" style={inp} placeholder="e.g. 88" value={saveForm.actualVelocity} onChange={e=>setSaveForm(f=>({...f,actualVelocity:e.target.value}))}/>

                <button onClick={save} disabled={!saveForm.name.trim()||saving} style={{width:'100%',background:C.gold,color:C.bg,border:'none',borderRadius:10,padding:'16px',fontSize:16,fontWeight:700,cursor:'pointer',marginTop:8,opacity:!saveForm.name.trim()||saving?0.6:1}}>
                  {saving?'Saving...':'Submit Result'}
                </button>
              </div>
            ):(
              <div style={{background:'rgba(57,211,83,0.08)',border:'1px solid rgba(57,211,83,0.25)',borderRadius:12,padding:'20px 16px',marginBottom:16,textAlign:'center'}}>
                <div style={{fontSize:24,marginBottom:8}}>✓</div>
                <div style={{fontSize:15,fontWeight:700,color:C.teal,marginBottom:4}}>Result Saved!</div>
                <div style={{fontSize:13,color:C.textMuted}}>Thanks {saveForm.name.split(' ')[0]}. Your result has been added to the Salzman Baseball database.</div>
              </div>
            )}

            <button onClick={reset} style={{width:'100%',background:'transparent',color:C.textMuted,border:`1px solid ${C.border}`,borderRadius:10,padding:'14px',fontSize:14,cursor:'pointer'}}>
              Calculate Again
            </button>
          </div>
        )}

        {/* Footer */}
        <div style={{textAlign:'center',marginTop:32,paddingTop:20,borderTop:`1px solid ${C.border}`}}>
          <div style={{fontSize:12,color:C.textDim}}>Salzman Baseball · CMJ Velocity Predictor</div>
          <div style={{fontSize:11,color:C.textDim,marginTop:4}}>Model based on countermovement jump biomechanics and pitcher performance data</div>
        </div>
      </div>
    </div>
  )
}
