'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { angleAt } from '@/lib/angles'

const C = {
  bg:'#0d1117',bg2:'#161b22',bg3:'#1c2333',border:'#30363d',
  gold:'#e8b84b',goldDim:'#a07c28',goldBg:'rgba(232,184,75,0.08)',
  teal:'#39d353',red:'#f85149',blue:'#58a6ff',purple:'#a371f7',
  text:'#e6edf3',textMuted:'#7d8590',textDim:'#484f58',white:'#ffffff',
}

// Reused from the live principles doc rather than invented — see
// "Stride length: 90-100% of body height" and "Hip/shoulder separation: 40-60 degrees".
const STRIDE_TARGET_PCT_HT:[number,number] = [90,100]
const HIP_SHOULDER_SEP_TARGET_DEG:[number,number] = [40,60]

const KEY_EVENTS = [
  'Front Foot Off Ground',
  'Peak Leg Lift',
  'Hand Break',
  'Foot Plant (Weight-Bearing)',
  'Hip Rotation Stop',
  'Max External Rotation (MER)',
  'Release',
]

type CameraView = 'side' | 'front' | 'back'
type Handedness = 'R' | 'L'

type Metrics = {
  frontKnee:number, backKnee:number, elbow:number, trunkTilt:number, hipShoulderSep:number,
  stridePctHt:number|null, strideInches:number|null, hipPx:{x:number,y:number}, time:number,
}

type LogEntry = {
  id:string
  time:number|null
  frontKnee:number|null
  backKnee:number|null
  trunkTilt:number|null
  elbow:number|null
  stridePctHt:number|null
  strideInches:number|null
  hipShoulderSep:number|null
  notes:string|null
  cameraView:string|null
  keyEvent:string|null
  hipPx:{x:number,y:number}|null // only populated for entries logged this session — not persisted in the DB schema
  savedAt?:string
}

const LM = {
  nose:0, lShoulder:11, rShoulder:12, lElbow:13, rElbow:14, lWrist:15, rWrist:16,
  lHip:23, rHip:24, lKnee:25, rKnee:26, lAnkle:27, rAnkle:28,
}
const BONES:[number,number][] = [
  [LM.lShoulder,LM.rShoulder],[LM.lShoulder,LM.lHip],[LM.rShoulder,LM.rHip],[LM.lHip,LM.rHip],
  [LM.lShoulder,LM.lElbow],[LM.lElbow,LM.lWrist],[LM.rShoulder,LM.rElbow],[LM.rElbow,LM.rWrist],
  [LM.lHip,LM.lKnee],[LM.lKnee,LM.lAnkle],[LM.rHip,LM.rKnee],[LM.rKnee,LM.rAnkle],
]

function toPx(lm:{x:number,y:number}, w:number, h:number){ return {x:lm.x*w, y:lm.y*h} }

// Resolves every tracked landmark to pixel space, substituting a manually-dragged
// correction where one exists for this frame instead of MediaPipe's raw position.
function resolvePoints(lms:any[], overrides:Record<number,{x:number,y:number}>, w:number, h:number):Record<number,{x:number,y:number}>{
  const pts:Record<number,{x:number,y:number}> = {}
  for (const idx of Object.values(LM)) pts[idx] = overrides[idx] ?? toPx(lms[idx],w,h)
  return pts
}

function getCanvasPoint(e:{clientX:number,clientY:number}, canvas:HTMLCanvasElement):{x:number,y:number}{
  const rect=canvas.getBoundingClientRect()
  return {x:(e.clientX-rect.left)*(canvas.width/rect.width), y:(e.clientY-rect.top)*(canvas.height/rect.height)}
}

function lineAngleFromVertical(P1:{x:number,y:number},P2:{x:number,y:number}){
  const dx=P2.x-P1.x, dy=P2.y-P1.y
  return Math.atan2(Math.abs(dx),Math.abs(dy))*180/Math.PI
}
function lineAngleFromHorizontal(P1:{x:number,y:number},P2:{x:number,y:number}){
  const dx=P2.x-P1.x, dy=P2.y-P1.y
  return Math.atan2(Math.abs(dy),Math.abs(dx))*180/Math.PI
}

function computeMetricsFor(pts:Record<number,{x:number,y:number}>, cfg:{handedness:Handedness,pxPerInch:number|null,heightIn:string}, currentTime:number):Metrics{
  const throwsR = cfg.handedness==='R'
  const frontKneeIdx = throwsR ? [LM.lHip,LM.lKnee,LM.lAnkle] : [LM.rHip,LM.rKnee,LM.rAnkle]
  const backKneeIdx  = throwsR ? [LM.rHip,LM.rKnee,LM.rAnkle] : [LM.lHip,LM.lKnee,LM.lAnkle]
  const elbowIdx     = throwsR ? [LM.rShoulder,LM.rElbow,LM.rWrist] : [LM.lShoulder,LM.lElbow,LM.lWrist]
  const P=(i:number)=>pts[i]
  const frontKnee = angleAt(P(frontKneeIdx[0]),P(frontKneeIdx[1]),P(frontKneeIdx[2]))
  const backKnee  = angleAt(P(backKneeIdx[0]),P(backKneeIdx[1]),P(backKneeIdx[2]))
  const elbow     = angleAt(P(elbowIdx[0]),P(elbowIdx[1]),P(elbowIdx[2]))
  const midShoulder = {x:(P(LM.lShoulder).x+P(LM.rShoulder).x)/2, y:(P(LM.lShoulder).y+P(LM.rShoulder).y)/2}
  const midHip = {x:(P(LM.lHip).x+P(LM.rHip).x)/2, y:(P(LM.lHip).y+P(LM.rHip).y)/2}
  const trunkTilt = lineAngleFromVertical(midHip,midShoulder)
  const shoulderLineAngle = lineAngleFromHorizontal(P(LM.lShoulder),P(LM.rShoulder))
  const hipLineAngle = lineAngleFromHorizontal(P(LM.lHip),P(LM.rHip))
  const hipShoulderSep = Math.abs(shoulderLineAngle-hipLineAngle)
  const anklePx = Math.abs(P(LM.lAnkle).x-P(LM.rAnkle).x)
  const strideInches = cfg.pxPerInch ? anklePx/cfg.pxPerInch : null
  const heightNum = parseFloat(cfg.heightIn)
  const stridePctHt = (strideInches && heightNum) ? (strideInches/heightNum*100) : null
  return {frontKnee,backKnee,elbow,trunkTilt,hipShoulderSep,stridePctHt,strideInches,hipPx:midHip,time:currentTime}
}

function drawSkeleton(ctx:CanvasRenderingContext2D, pts:Record<number,{x:number,y:number}>, overrides:Record<number,{x:number,y:number}>){
  ctx.lineWidth=3
  ctx.strokeStyle=C.gold
  BONES.forEach(([a,b])=>{
    const A=pts[a], B=pts[b]
    ctx.beginPath(); ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y); ctx.stroke()
  })
  Object.values(LM).forEach(i=>{
    const P=pts[i]
    const overridden=!!overrides[i]
    ctx.fillStyle=overridden?C.red:C.text
    ctx.beginPath(); ctx.arc(P.x,P.y,overridden?6:4,0,Math.PI*2); ctx.fill()
    if (overridden){
      ctx.strokeStyle=C.red; ctx.lineWidth=2
      ctx.beginPath(); ctx.arc(P.x,P.y,10,0,Math.PI*2); ctx.stroke()
    }
  })
}

function confidenceBadge(metric:string, view:CameraView):'reliable'|'estimate'{
  const reliableFromSide = ['frontKnee','backKnee','trunkTilt','elbow','stridePctHt']
  const reliableFromFrontBack = ['hipShoulderSep','elbow']
  if (view==='side') return reliableFromSide.includes(metric) ? 'reliable' : 'estimate'
  return reliableFromFrontBack.includes(metric) ? 'reliable' : 'estimate'
}

function loadScript(src:string):Promise<void>{
  return new Promise((resolve,reject)=>{
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s=document.createElement('script')
    s.src=src; s.crossOrigin='anonymous'
    s.onload=()=>resolve()
    s.onerror=()=>reject(new Error(`failed to load ${src}`))
    document.head.appendChild(s)
  })
}

// pose.js's own onload fires before window.Pose exists — the file itself dynamically
// loads further sub-scripts (the wasm/asset bundles) and only defines window.Pose once
// those finish. Poll instead of assuming it's ready the instant the outer script loads.
function waitForGlobal(name:string, timeoutMs=15000):Promise<any>{
  return new Promise((resolve,reject)=>{
    const start=Date.now()
    const check=()=>{
      const val=(window as any)[name]
      if (typeof val==='function'){ resolve(val); return }
      if (Date.now()-start>timeoutMs){ reject(new Error(`window.${name} did not become available within ${timeoutMs}ms`)); return }
      setTimeout(check,100)
    }
    check()
  })
}

function computeSpeedLabel(a:LogEntry|undefined, b:LogEntry|undefined, pxPerInch:number|null):string{
  if (!a||!b||a.id===b.id) return '—'
  if (!a.hipPx||!b.hipPx) return 'Pixel position only available for entries logged this session'
  const dt=Math.abs((b.time??0)-(a.time??0))
  if (dt===0) return '—'
  const dPx=Math.hypot(b.hipPx.x-a.hipPx.x, b.hipPx.y-a.hipPx.y)
  if (pxPerInch){
    const mph=(dPx/pxPerInch/dt)*0.0568182
    return `${mph.toFixed(1)} mph`
  }
  return `${(dPx/dt).toFixed(0)} px/s (uncalibrated)`
}

const inp:React.CSSProperties = {width:'100%',background:C.bg3,border:`1px solid ${C.border}`,borderRadius:6,padding:'8px 10px',fontSize:13,color:C.text,outline:'none'}
const lbl:React.CSSProperties = {fontSize:10,color:C.textMuted,fontWeight:600,marginBottom:4,textTransform:'uppercase' as const,letterSpacing:'0.5px',display:'block'}

export default function PitchMechanics2D({pitcherId}:{pitcherId:string}){
  const supabase=createClient()

  const [scriptsReady,setScriptsReady]=useState(false)
  const [scriptError,setScriptError]=useState('')
  const [videoLoaded,setVideoLoaded]=useState(false)
  const [statusLine,setStatusLine]=useState({text:'Loading pose-tracking library…',kind:'loading' as 'idle'|'loading'|'ready'})
  const [isPlaying,setIsPlaying]=useState(false)
  const [dragOver,setDragOver]=useState(false)
  const [view,setView]=useState<CameraView>('side')
  const [handedness,setHandedness]=useState<Handedness>('R')
  const [fps,setFps]=useState('30')
  const [heightIn,setHeightIn]=useState('')
  const [pxPerInch,setPxPerInch]=useState<number|null>(null)
  const [calibStatus,setCalibStatus]=useState({text:'Not calibrated — stride length and hip speed will show in pixels, not inches. Enter the athlete\'s height above, pause on a frame where they\'re standing fully upright, then hit "Calibrate."',calibrated:false})
  const [latestMetrics,setLatestMetrics]=useState<Metrics|null>(null)
  const [logEntries,setLogEntries]=useState<LogEntry[]>([])
  const [logsLoading,setLogsLoading]=useState(true)
  const [rowA,setRowA]=useState('')
  const [rowB,setRowB]=useState('')
  const [prepOpen,setPrepOpen]=useState(true)
  const [convertVisible,setConvertVisible]=useState(false)
  const [convertBusy,setConvertBusy]=useState(false)
  const [convertLabel,setConvertLabel]=useState('Convert video in-browser & retry')
  const [sessionLabel,setSessionLabel]=useState('')
  const [frameNotes,setFrameNotes]=useState('')
  const [keyEvent,setKeyEvent]=useState('')
  const [saving,setSaving]=useState(false)

  const videoRef=useRef<HTMLVideoElement>(null)
  const canvasRef=useRef<HTMLCanvasElement>(null)
  const scrubRef=useRef<HTMLInputElement>(null)
  const timecodeRef=useRef<HTMLSpanElement>(null)
  const fileInputRef=useRef<HTMLInputElement>(null)
  const poseRef=useRef<any>(null)
  const ffmpegRef=useRef<any>(null)
  const latestLandmarksRef=useRef<any>(null)
  const latestMetricsRef=useRef<Metrics|null>(null)
  const lastFailedFileRef=useRef<File|null>(null)
  const objectUrlRef=useRef<string|null>(null)
  const isPlayingRef=useRef(false)
  // Manual per-frame marker corrections — pixel-space, reset whenever new MediaPipe
  // landmarks arrive (i.e. whenever the video moves to a different frame).
  const markerOverridesRef=useRef<Record<number,{x:number,y:number}>>({})
  const draggingIndexRef=useRef<number|null>(null)
  const configRef=useRef({handedness,pxPerInch,heightIn,fps,view})
  useEffect(()=>{ configRef.current={handedness,pxPerInch,heightIn,fps,view} })

  const drawFrame=useCallback(()=>{
    const video=videoRef.current, canvas=canvasRef.current
    if (!video||!canvas) return
    const ctx=canvas.getContext('2d'); if (!ctx) return
    ctx.clearRect(0,0,canvas.width,canvas.height)
    ctx.drawImage(video,0,0,canvas.width,canvas.height)
    const lms=latestLandmarksRef.current
    if (lms){
      const pts=resolvePoints(lms,markerOverridesRef.current,canvas.width,canvas.height)
      drawSkeleton(ctx,pts,markerOverridesRef.current)
      const m=computeMetricsFor(pts,configRef.current,video.currentTime)
      latestMetricsRef.current=m
      setLatestMetrics(m)
    }
  },[])

  const onResults=useCallback((results:any)=>{
    latestLandmarksRef.current=results.poseLandmarks||null
    markerOverridesRef.current={} // new frame's tracking — clear any prior frame's manual corrections
    drawFrame()
  },[drawFrame])

  const onCanvasPointerDown=(e:React.MouseEvent<HTMLCanvasElement>)=>{
    const canvas=canvasRef.current, lms=latestLandmarksRef.current
    if (!canvas||!lms) return
    const pt=getCanvasPoint(e,canvas)
    const pts=resolvePoints(lms,markerOverridesRef.current,canvas.width,canvas.height)
    let nearest:number|null=null, nearestDist=Infinity
    for (const idx of Object.values(LM)){
      const d=Math.hypot(pts[idx].x-pt.x,pts[idx].y-pt.y)
      if (d<nearestDist){ nearestDist=d; nearest=idx }
    }
    const hitRadius=Math.max(canvas.width,canvas.height)*0.035
    if (nearest!=null && nearestDist<=hitRadius) draggingIndexRef.current=nearest
  }
  const onCanvasPointerMove=(e:React.MouseEvent<HTMLCanvasElement>)=>{
    const canvas=canvasRef.current
    if (draggingIndexRef.current==null||!canvas) return
    const pt=getCanvasPoint(e,canvas)
    markerOverridesRef.current={...markerOverridesRef.current,[draggingIndexRef.current]:pt}
    drawFrame()
  }
  const onCanvasPointerUp=()=>{ draggingIndexRef.current=null }
  const resetCorrections=()=>{ markerOverridesRef.current={}; drawFrame() }

  useEffect(()=>{
    let cancelled=false
    // Pinned to a known-good version — the unversioned "@mediapipe/pose/pose.js" CDN URL
    // resolves to whatever the latest npm release is at request time, which can silently
    // change the exposed API shape. Pin both the script and locateFile to the same version.
    const POSE_VERSION='0.5.1675469404'
    Promise.all([
      loadScript(`https://cdn.jsdelivr.net/npm/@mediapipe/pose@${POSE_VERSION}/pose.js`).then(()=>waitForGlobal('Pose')),
      loadScript('https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js'),
    ]).then(([PoseCtor])=>{
      if (cancelled) return
      const pose=new PoseCtor({locateFile:(f:string)=>`https://cdn.jsdelivr.net/npm/@mediapipe/pose@${POSE_VERSION}/${f}`})
      pose.setOptions({modelComplexity:1,smoothLandmarks:true,minDetectionConfidence:0.5,minTrackingConfidence:0.5})
      pose.onResults(onResults)
      poseRef.current=pose
      setScriptsReady(true)
      setStatusLine({text:'Waiting for video…',kind:'idle'})
    }).catch((err:any)=>{
      if (cancelled) return
      setScriptError(`Couldn't load the pose-tracking library (${err.message}). Check your connection and reload this tab.`)
      setStatusLine({text:'Pose-tracking library failed to load.',kind:'loading'})
    })
    return ()=>{cancelled=true}
  },[onResults])

  const fetchLogs=useCallback(async()=>{
    setLogsLoading(true)
    const {data}=await supabase.from('mechanics_frame_logs').select('*').eq('pitcher_id',pitcherId).order('created_at',{ascending:false}).limit(100)
    const rows:LogEntry[]=(data||[]).map((r:any)=>({
      id:r.id, time:r.video_timestamp_sec, frontKnee:r.front_knee_deg, backKnee:r.back_knee_deg,
      trunkTilt:r.trunk_tilt_deg, elbow:r.elbow_deg, stridePctHt:r.stride_pct_ht, strideInches:r.stride_inches,
      hipShoulderSep:r.hip_shoulder_sep_deg, notes:r.notes, cameraView:r.camera_view, keyEvent:r.key_event, hipPx:null, savedAt:r.created_at,
    }))
    setLogEntries(rows)
    setLogsLoading(false)
  },[pitcherId,supabase])

  const clearLog=()=>{
    if (!window.confirm('Clear the on-screen log? This only clears this view — nothing is deleted from Supabase, and Refresh will bring it back.')) return
    setLogEntries([])
  }

  useEffect(()=>{ fetchLogs() },[fetchLogs])

  const analyzeCurrentFrame=useCallback(async()=>{
    const pose=poseRef.current, video=videoRef.current
    if (!pose||!video) return
    await pose.send({image:video})
  },[])

  const seekAndAnalyze=useCallback(()=>{
    const video=videoRef.current; if (!video) return
    if (timecodeRef.current) timecodeRef.current.textContent=video.currentTime.toFixed(2)+'s'
    const handler=()=>{ video.removeEventListener('seeked',handler); analyzeCurrentFrame() }
    video.addEventListener('seeked',handler)
  },[analyzeCurrentFrame])

  const loadVideoFile=useCallback((file:File)=>{
    lastFailedFileRef.current=file
    setConvertVisible(false)
    const video=videoRef.current; if (!video) return
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const url=URL.createObjectURL(file)
    objectUrlRef.current=url
    video.src=url
    setVideoLoaded(true)
    setStatusLine({text:`Loading "${file.name}" (${(file.size/1024/1024).toFixed(0)}MB)…`,kind:'loading'})

    const loadTimeout=setTimeout(()=>{
      setStatusLine({text:`Still not loading after 15s — this file's format/codec probably isn't supported by this browser.`,kind:'loading'})
      setConvertVisible(true)
    },15000)

    video.onerror=()=>{
      clearTimeout(loadTimeout)
      const err=video.error
      setStatusLine({text:`Couldn't load this video (error code ${err?err.code:'?'}) — this browser can't decode its format/codec (common with iPhone HEVC clips in Chrome on Windows). Click below to convert it automatically.`,kind:'loading'})
      setConvertVisible(true)
    }

    video.onloadedmetadata=()=>{
      clearTimeout(loadTimeout)
      setConvertVisible(false)
      const canvas=canvasRef.current
      if (canvas){ canvas.width=video.videoWidth; canvas.height=video.videoHeight }
      if (scrubRef.current){ scrubRef.current.max=String(video.duration); scrubRef.current.step=String(1/parseFloat(fps||'30')) }
      setStatusLine({text:'Ready. Tracking runs as you play or step through frames.',kind:'ready'})
      seekAndAnalyze()
    }
  },[fps,seekAndAnalyze])

  const onFileChange=(e:React.ChangeEvent<HTMLInputElement>)=>{ if (e.target.files?.[0]) loadVideoFile(e.target.files[0]) }
  const onDrop=(e:React.DragEvent)=>{ e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.[0]) loadVideoFile(e.dataTransfer.files[0]) }
  const onDragOver=(e:React.DragEvent)=>{ e.preventDefault(); setDragOver(true) }
  const onDragLeave=()=>setDragOver(false)

  const playLoop=useCallback(()=>{
    const video=videoRef.current
    if (!isPlayingRef.current||!video) return
    if (video.paused||video.ended){ isPlayingRef.current=false; setIsPlaying(false); return }
    analyzeCurrentFrame().then(()=>{
      if (scrubRef.current) scrubRef.current.value=String(video.currentTime)
      if (timecodeRef.current) timecodeRef.current.textContent=video.currentTime.toFixed(2)+'s'
      requestAnimationFrame(playLoop)
    })
  },[analyzeCurrentFrame])

  const togglePlay=()=>{
    const video=videoRef.current; if (!video) return
    if (isPlayingRef.current){ video.pause(); isPlayingRef.current=false; setIsPlaying(false) }
    else { video.play(); isPlayingRef.current=true; setIsPlaying(true); playLoop() }
  }

  const stepFrame=(dir:number)=>{
    const video=videoRef.current; if (!video) return
    const f=parseFloat(fps||'30')
    video.currentTime=Math.max(0,Math.min(video.duration,video.currentTime+dir*(1/f)))
    seekAndAnalyze()
  }

  const onScrub=(e:React.ChangeEvent<HTMLInputElement>)=>{
    const video=videoRef.current; if (!video) return
    video.currentTime=parseFloat(e.target.value)
    seekAndAnalyze()
  }

  const calibrate=()=>{
    const lms=latestLandmarksRef.current, canvas=canvasRef.current, video=videoRef.current
    if (!lms||!canvas) return
    const h=parseFloat(heightIn)
    if (!h){ setCalibStatus({text:'Enter athlete height first.',calibrated:false}); return }
    const pts=resolvePoints(lms,markerOverridesRef.current,canvas.width,canvas.height)
    const anklePx=(pts[LM.lAnkle].y+pts[LM.rAnkle].y)/2
    const nosePx=pts[LM.nose].y
    const pixelSpan=Math.abs(anklePx-nosePx)*1.06
    const ratio=pixelSpan/h
    setPxPerInch(ratio)
    setCalibStatus({text:`Calibrated at t=${video?video.currentTime.toFixed(2):'0'}s — ${ratio.toFixed(2)} px/in. Re-calibrate if the pitcher moves toward/away from the camera.`,calibrated:true})
  }

  const convertVideo=async()=>{
    const file=lastFailedFileRef.current
    if (!file) return
    const FFmpegGlobal=(window as any).FFmpeg
    if (!FFmpegGlobal){
      setStatusLine({text:`The in-browser converter couldn't load. This usually happens when the page is opened directly as a local file (file://) instead of through a web address — the converter needs a real page address to work. Easiest fix for now: convert the clip manually to .mp4 (H.264) using QuickTime or a free online converter, then re-upload. This should work fine once used on the deployed site (http/https).`,kind:'loading'})
      return
    }
    setConvertBusy(true)
    setConvertLabel('Loading converter (first time only, ~25MB)…')
    setStatusLine({text:'Setting up in-browser converter…',kind:'loading'})
    try{
      if (!ffmpegRef.current){
        const {createFFmpeg}=FFmpegGlobal
        const ffmpeg=createFFmpeg({log:false})
        ffmpeg.setProgress(({ratio}:{ratio:number})=>{
          if (ratio>=0) setStatusLine({text:`Converting… ${Math.min(100,Math.round(ratio*100))}%`,kind:'loading'})
        })
        await ffmpeg.load()
        ffmpegRef.current=ffmpeg
      }
      const ffmpeg=ffmpegRef.current
      setConvertLabel('Converting…')
      const inName='in_'+file.name.replace(/[^a-zA-Z0-9.]/g,'_')
      ffmpeg.FS('writeFile', inName, await FFmpegGlobal.fetchFile(file))
      await ffmpeg.run('-i',inName,'-c:v','libx264','-preset','ultrafast','-crf','23','-c:a','aac','out.mp4')
      const data=ffmpeg.FS('readFile','out.mp4')
      ffmpeg.FS('unlink',inName); ffmpeg.FS('unlink','out.mp4')
      const blob=new Blob([data.buffer],{type:'video/mp4'})
      const convertedFile=new File([blob], file.name.replace(/\.\w+$/,'_converted.mp4'), {type:'video/mp4'})
      setConvertVisible(false); setConvertBusy(false); setConvertLabel('Convert video in-browser & retry')
      loadVideoFile(convertedFile)
    }catch(err:any){
      setStatusLine({text:`Conversion failed: ${err.message||err}. Try re-exporting the clip manually as .mp4 (H.264) instead.`,kind:'loading'})
      setConvertBusy(false); setConvertLabel('Convert video in-browser & retry')
    }
  }

  const logFrame=async()=>{
    const m=latestMetricsRef.current
    if (!m) return
    setSaving(true)
    const {data,error}=await supabase.from('mechanics_frame_logs').insert({
      pitcher_id:pitcherId,
      session_label:sessionLabel||null,
      camera_view:view,
      video_timestamp_sec:m.time,
      front_knee_deg:m.frontKnee,
      back_knee_deg:m.backKnee,
      trunk_tilt_deg:m.trunkTilt,
      elbow_deg:m.elbow,
      stride_pct_ht:m.stridePctHt,
      stride_inches:m.strideInches,
      hip_shoulder_sep_deg:m.hipShoulderSep,
      key_event:keyEvent||null,
      notes:frameNotes||null,
    }).select().single()
    setSaving(false)
    if (!error && data){
      setLogEntries(prev=>[{
        id:data.id, time:m.time, frontKnee:m.frontKnee, backKnee:m.backKnee, trunkTilt:m.trunkTilt, elbow:m.elbow,
        stridePctHt:m.stridePctHt, strideInches:m.strideInches, hipShoulderSep:m.hipShoulderSep,
        notes:frameNotes||null, cameraView:view, keyEvent:keyEvent||null, hipPx:m.hipPx, savedAt:data.created_at,
      }, ...prev])
      setFrameNotes('')
      setKeyEvent('')
    }
  }

  const exportCsv=()=>{
    if (!logEntries.length) return
    const header='Time(s),FrontKnee,BackKnee,TrunkTilt,Elbow,Stride%Ht,StrideInches,HipShoulderSep(est),CameraView,KeyEvent,Notes\n'
    const rows=logEntries.map(e=>[
      e.time?.toFixed(3)??'', e.frontKnee?.toFixed(1)??'', e.backKnee?.toFixed(1)??'', e.trunkTilt?.toFixed(1)??'',
      e.elbow?.toFixed(1)??'', e.stridePctHt?e.stridePctHt.toFixed(1):'', e.strideInches?e.strideInches.toFixed(1):'',
      e.hipShoulderSep?.toFixed(1)??'', e.cameraView??'', e.keyEvent??'', `"${(e.notes??'').replace(/"/g,'""')}"`,
    ].join(','))
    const csv=header+rows.join('\n')
    const blob=new Blob([csv],{type:'text/csv'})
    const a=document.createElement('a')
    a.href=URL.createObjectURL(blob)
    a.download='mechanics_frame_log.csv'
    a.click()
  }

  const entryA=logEntries.find(e=>e.id===rowA)
  const entryB=logEntries.find(e=>e.id===rowB)
  const speedLabel=computeSpeedLabel(entryA,entryB,pxPerInch)

  const statCard=(label:string,value:string,unit:string,metricKey:string,target?:string)=>{
    const badge=confidenceBadge(metricKey,view)
    return (
      <div key={`${label}-${unit}`} style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:8,padding:'12px 14px',position:'relative' as const}}>
        <span style={{position:'absolute' as const,top:10,right:10,fontSize:9,padding:'2px 6px',borderRadius:3,textTransform:'uppercase' as const,letterSpacing:'0.4px',fontWeight:600,background:badge==='reliable'?'rgba(57,211,83,0.15)':'rgba(224,164,56,0.15)',color:badge==='reliable'?C.teal:C.gold,border:`1px solid ${badge==='reliable'?'rgba(57,211,83,0.3)':'rgba(224,164,56,0.3)'}`}}>{badge==='reliable'?'Reliable':'Est.'}</span>
        <div style={{fontSize:11,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.4px',marginBottom:6}}>{label}</div>
        <div style={{fontFamily:'monospace',fontSize:24,fontWeight:700,color:C.white,lineHeight:1}}>{value}<span style={{fontSize:12,color:C.textMuted,fontWeight:400,marginLeft:2}}>{unit}</span></div>
        {target&&<div style={{fontSize:10,color:C.textDim,marginTop:6}}>Target: {target}</div>}
      </div>
    )
  }

  return (
    <div style={{color:C.text,fontSize:13}}>
      <div style={{fontSize:16,fontWeight:700,color:C.gold,marginBottom:2}}>2D Delivery Analysis</div>
      <div style={{fontSize:11,color:C.textMuted,marginBottom:16}}>Pose-tracking runs entirely in the browser — nothing is uploaded anywhere except the frames you choose to log.</div>

      {scriptError&&<div style={{color:C.red,fontSize:13,marginBottom:12,padding:10,background:'rgba(248,81,73,0.1)',borderRadius:8}}>{scriptError}</div>}

      <div style={{display:'grid',gridTemplateColumns:'1.4fr 1fr',gap:16}}>
        <div>
          {/* Tips panel */}
          <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8,marginBottom:14,overflow:'hidden'}}>
            <div onClick={()=>setPrepOpen(o=>!o)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',cursor:'pointer'}}>
              <div style={{fontSize:12,fontWeight:700,color:C.text,display:'flex',alignItems:'center',gap:8}}>
                <span style={{width:7,height:7,borderRadius:4,background:C.gold,display:'inline-block'}}/>
                Before you upload — read this first
              </div>
              <span style={{color:C.textMuted,fontSize:11,transform:prepOpen?'rotate(180deg)':'none'}}>▾</span>
            </div>
            {prepOpen&&(
              <ol style={{margin:0,padding:'0 14px 14px 30px',fontSize:12,color:C.textMuted,lineHeight:1.7}}>
                <li><b style={{color:C.text}}>Film in landscape</b>, not portrait — the tool needs the full body wide in frame.</li>
                <li><b style={{color:C.text}}>Get the whole body in shot</b> from at least a step before leg lift through follow-through. If feet or hands leave the frame, tracking breaks.</li>
                <li><b style={{color:C.text}}>Use a tripod or steady surface.</b> A shaky, handheld clip makes the joint tracking jump around and throws off angles.</li>
                <li><b style={{color:C.text}}>Stand back far enough</b> that the pitcher's whole body stays in frame during the stride — don't zoom in tight.</li>
                <li><b style={{color:C.text}}>Plain background helps.</b> Avoid other people or moving objects behind the pitcher if possible.</li>
                <li><b style={{color:C.text}}>Good, even lighting</b> — outdoor daylight or well-lit indoor turf works best. Avoid backlighting.</li>
                <li><b style={{color:C.text}}>Pick the right angle</b> for what you're measuring: face-on to the mound for side view, or straight down the base line for front/back — and set the matching Camera View option below.</li>
                <li><b style={{color:C.text}}>Include a moment standing tall</b> (leg lift or standstill) — you'll use this frame to calibrate real-world measurements.</li>
              </ol>
            )}
          </div>

          <div
            onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
            style={{position:'relative' as const,aspectRatio:'16/9',background:'#000',border:`1px solid ${dragOver?C.gold:C.border}`,borderRadius:8,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}
          >
            {!videoLoaded&&(
              <div style={{color:C.textMuted,textAlign:'center' as const,fontSize:13,padding:20,zIndex:2}}>
                <b style={{color:C.text}}>Drop a pitching video</b> or click below to upload<br/>
                Analysis happens on this device — nothing is uploaded anywhere.
                <div>
                  <input ref={fileInputRef} type="file" accept="video/*" style={{display:'none'}} onChange={onFileChange}/>
                  <button onClick={()=>fileInputRef.current?.click()} style={{marginTop:10,padding:'9px 18px',background:C.gold,color:C.bg,border:'none',borderRadius:6,fontSize:13,fontWeight:700,cursor:'pointer'}}>Choose Video</button>
                </div>
              </div>
            )}
            <video ref={videoRef} playsInline muted style={{display:videoLoaded?'block':'none',position:'absolute' as const,top:0,left:0,width:'100%',height:'100%',objectFit:'contain' as const}}/>
            <canvas
              ref={canvasRef}
              onMouseDown={onCanvasPointerDown} onMouseMove={onCanvasPointerMove} onMouseUp={onCanvasPointerUp} onMouseLeave={onCanvasPointerUp}
              style={{display:videoLoaded?'block':'none',position:'absolute' as const,top:0,left:0,width:'100%',height:'100%',objectFit:'contain' as const,cursor:videoLoaded?'crosshair':'default'}}
            />
          </div>

          {videoLoaded&&(
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginTop:8,flexWrap:'wrap' as const}}>
              <span style={{fontSize:10,color:C.textDim}}>Drag any joint marker to correct MediaPipe's tracking for this frame — corrections reset when you move to a new frame.</span>
              <button onClick={resetCorrections} style={{...btnStyle(),fontSize:10,padding:'4px 8px',flexShrink:0}}>Reset corrections</button>
            </div>
          )}

          <div style={{display:'flex',alignItems:'center',gap:8,marginTop:12,flexWrap:'wrap' as const}}>
            <button onClick={togglePlay} disabled={!videoLoaded} style={{...btnStyle(),opacity:videoLoaded?1:0.35}}>{isPlaying?'⏸ Pause':'▶ Play'}</button>
            <button onClick={()=>stepFrame(-1)} disabled={!videoLoaded} style={{...btnStyle(),opacity:videoLoaded?1:0.35}}>⏮ −1 frame</button>
            <button onClick={()=>stepFrame(1)} disabled={!videoLoaded} style={{...btnStyle(),opacity:videoLoaded?1:0.35}}>+1 frame ⏭</button>
            <input ref={scrubRef} type="range" min={0} max={100} defaultValue={0} onChange={onScrub} disabled={!videoLoaded} style={{flex:1,minWidth:140,accentColor:C.gold}}/>
            <span ref={timecodeRef} style={{fontFamily:'monospace',fontSize:12,color:C.textMuted,minWidth:70}}>0.00s</span>
            <button onClick={logFrame} disabled={!videoLoaded||!latestMetrics||saving} style={{...btnStyle(true),opacity:(videoLoaded&&latestMetrics&&!saving)?1:0.35}}>{saving?'Saving...':'Log Frame'}</button>
          </div>

          <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8,padding:14,marginTop:14,display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <label style={lbl}>Camera View</label>
              <select value={view} onChange={e=>setView(e.target.value as CameraView)} style={inp}>
                <option value="side">Side view</option>
                <option value="front">Front view</option>
                <option value="back">Back view</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Pitcher Throws</label>
              <select value={handedness} onChange={e=>setHandedness(e.target.value as Handedness)} style={inp}>
                <option value="R">Right-Handed</option>
                <option value="L">Left-Handed</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Athlete Height (inches)</label>
              <input type="text" inputMode="decimal" placeholder="e.g. 72" value={heightIn} onChange={e=>setHeightIn(e.target.value)} style={inp}/>
            </div>
            <div>
              <label style={lbl}>Frame Rate (fps)</label>
              <input type="text" inputMode="decimal" value={fps} onChange={e=>setFps(e.target.value)} style={inp}/>
            </div>
            <div>
              <label style={lbl}>Calibration</label>
              <button onClick={calibrate} disabled={!videoLoaded} style={{...btnStyle(),width:'100%',opacity:videoLoaded?1:0.35}}>Calibrate on this frame</button>
            </div>
            <div>
              <label style={lbl}>Session Label</label>
              <input type="text" placeholder="e.g. Bullpen 8/16" value={sessionLabel} onChange={e=>setSessionLabel(e.target.value)} style={inp}/>
            </div>
            <div style={{gridColumn:'1/-1'}}>
              <div style={{fontSize:12,color:calibStatus.calibrated?C.teal:C.textMuted}}>{calibStatus.text}</div>
            </div>
            <div style={{gridColumn:'1/-1'}}>
              <label style={lbl}>Key Event <span style={{color:C.textDim,fontWeight:400}}>(optional)</span></label>
              <select value={keyEvent} onChange={e=>setKeyEvent(e.target.value)} style={inp}>
                <option value="">— None / Other —</option>
                {KEY_EVENTS.map(k=><option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div style={{gridColumn:'1/-1'}}>
              <label style={lbl}>Notes for next logged frame <span style={{color:C.textDim,fontWeight:400}}>(optional)</span></label>
              <input type="text" placeholder="e.g. front foot open at strike" value={frameNotes} onChange={e=>setFrameNotes(e.target.value)} style={inp}/>
            </div>
          </div>

          <div style={{fontSize:12,fontFamily:'monospace',color:statusLine.kind==='loading'?C.gold:statusLine.kind==='ready'?C.teal:C.textMuted,marginTop:10}}>{statusLine.text}</div>
          {convertVisible&&(
            <button onClick={convertVideo} disabled={convertBusy} style={{marginTop:8,padding:'9px 16px',background:C.goldDim,color:C.bg,border:'none',borderRadius:6,fontWeight:700,fontSize:12,cursor:'pointer',opacity:convertBusy?0.6:1}}>{convertLabel}</button>
          )}
        </div>

        <div style={{display:'flex',flexDirection:'column' as const,gap:16}}>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:10,paddingBottom:8,borderBottom:`1px solid ${C.border}`}}>Live Readout</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {latestMetrics?[
                statCard('Front Knee', latestMetrics.frontKnee.toFixed(0), '°', 'frontKnee'),
                statCard('Back Knee', latestMetrics.backKnee.toFixed(0), '°', 'backKnee'),
                statCard('Trunk Tilt', latestMetrics.trunkTilt.toFixed(0), '° fwd', 'trunkTilt'),
                statCard('Elbow', latestMetrics.elbow.toFixed(0), '°', 'elbow'),
                statCard('Stride Length', latestMetrics.stridePctHt?latestMetrics.stridePctHt.toFixed(0):'—', '%ht', 'stridePctHt', `${STRIDE_TARGET_PCT_HT[0]}–${STRIDE_TARGET_PCT_HT[1]}% ht`),
                statCard('Stride Length', latestMetrics.strideInches?latestMetrics.strideInches.toFixed(1):'—', 'in', 'stridePctHt'),
                statCard('Hip-Shoulder Sep', latestMetrics.hipShoulderSep.toFixed(0), '° (est)', 'hipShoulderSep', `${HIP_SHOULDER_SEP_TARGET_DEG[0]}–${HIP_SHOULDER_SEP_TARGET_DEG[1]}°`),
              ]:(
                <div style={{gridColumn:'1/-1',color:C.textDim,fontSize:12,padding:20,textAlign:'center' as const}}>Play or step through a frame to see live joint angles.</div>
              )}
            </div>
          </div>

          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10,paddingBottom:8,borderBottom:`1px solid ${C.border}`}}>
              <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px'}}>Frame Log</div>
              <span style={{fontSize:11,color:C.textMuted}}>{logsLoading?'Loading…':`${logEntries.length} frame${logEntries.length!==1?'s':''}`}</span>
            </div>
            <div style={{display:'flex',gap:8,marginBottom:10,flexWrap:'wrap' as const}}>
              <button onClick={fetchLogs} style={{...btnStyle(),flex:1}}>Refresh</button>
              <button onClick={clearLog} style={{...btnStyle(),flex:1}}>Clear Log</button>
              <button onClick={exportCsv} style={{...btnStyle(),flex:1}}>Export CSV</button>
            </div>
            <div style={{maxHeight:240,overflowY:'auto' as const,overflowX:'auto' as const,border:`1px solid ${C.border}`,borderRadius:8,background:C.bg2}}>
              {logEntries.length===0?(
                <div style={{padding:20,textAlign:'center' as const,color:C.textDim,fontSize:12}}>No frames logged yet. Play or step to a key position (foot strike, release) and hit "Log Frame."</div>
              ):(
                <table style={{width:'100%',minWidth:640,borderCollapse:'collapse' as const,fontSize:11,fontFamily:'monospace'}}>
                  <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
                    {['t(s)','Fr Knee','Bk Knee','Trunk','Elbow','Stride%','Hip-Shd','Event'].map(h=><th key={h} style={{padding:'6px 8px',textAlign:'left' as const,color:C.textMuted,fontSize:9,textTransform:'uppercase' as const,whiteSpace:'nowrap' as const}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {logEntries.map(e=>(
                      <tr key={e.id} onClick={()=>{setRowA(rowA===e.id?'':rowA||e.id); if(rowA&&rowA!==e.id) setRowB(e.id)}} style={{borderBottom:'1px solid #1a1f28',cursor:'pointer',background:(rowA===e.id||rowB===e.id)?C.bg3:'transparent'}}>
                        <td style={{padding:'6px 8px',color:C.text}}>{e.time?.toFixed(2)??'—'}</td>
                        <td style={{padding:'6px 8px',color:C.text}}>{e.frontKnee?.toFixed(0)??'—'}</td>
                        <td style={{padding:'6px 8px',color:C.text}}>{e.backKnee?.toFixed(0)??'—'}</td>
                        <td style={{padding:'6px 8px',color:C.text}}>{e.trunkTilt?.toFixed(0)??'—'}</td>
                        <td style={{padding:'6px 8px',color:C.text}}>{e.elbow?.toFixed(0)??'—'}</td>
                        <td style={{padding:'6px 8px',color:C.text}}>{e.stridePctHt?e.stridePctHt.toFixed(0):'—'}</td>
                        <td style={{padding:'6px 8px',color:C.text}}>{e.hipShoulderSep?.toFixed(0)??'—'}</td>
                        <td style={{padding:'6px 8px',color:C.gold,whiteSpace:'nowrap' as const}}>{e.keyEvent||'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div style={{fontSize:10,color:C.textDim,marginTop:6}}>Click two rows to select them for the speed comparison below.</div>
          </div>

          <div>
            <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:10,paddingBottom:8,borderBottom:`1px solid ${C.border}`}}>Speed Between Logged Frames</div>
            <div style={{display:'flex',gap:8,marginBottom:10}}>
              <select value={rowA} onChange={e=>setRowA(e.target.value)} style={{...inp,flex:1}}>
                <option value="">—</option>
                {logEntries.map(e=><option key={e.id} value={e.id}>{e.time?.toFixed(2)}s</option>)}
              </select>
              <select value={rowB} onChange={e=>setRowB(e.target.value)} style={{...inp,flex:1}}>
                <option value="">—</option>
                {logEntries.map(e=><option key={e.id} value={e.id}>{e.time?.toFixed(2)}s</option>)}
              </select>
            </div>
            <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:8,padding:'12px 14px'}}>
              <div style={{fontSize:11,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.4px',marginBottom:6}}>Hip Travel Speed</div>
              <div style={{fontFamily:'monospace',fontSize:20,fontWeight:700,color:C.white}}>{speedLabel}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{fontSize:10,color:C.textDim,textAlign:'center' as const,marginTop:16,paddingTop:12,borderTop:`1px solid ${C.border}`}}>Estimates only — not a substitute for calibrated multi-camera capture. Hip-shoulder separation from a single 2D view is a rough approximation; see badges above for confidence.</div>
    </div>
  )
}

function btnStyle(primary?:boolean):React.CSSProperties{
  return primary
    ? {background:C.gold,border:`1px solid ${C.gold}`,color:C.bg,padding:'8px 14px',borderRadius:6,fontSize:12,fontWeight:700,cursor:'pointer'}
    : {background:C.bg3,border:`1px solid ${C.border}`,color:C.text,padding:'8px 12px',borderRadius:6,fontSize:12,cursor:'pointer'}
}
