'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { angleAt } from '@/lib/angles'
import { CAPTURE_FPS_OPTIONS, FRAME_STEP_VIDEO_SEC, realToVideoSec, videoToRealSec } from '@/lib/slowMotion'
import DeliveryTimeline, { type DeliveryEventDef } from '@/app/components/DeliveryTimeline'

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
  'Bottom of Back Leg Loading',
  'Foot Plant (Weight-Bearing)',
  'Hip Rotation Stop',
  'Max External Rotation (MER)',
  'Release',
]

// Events that can happen in either order depending on the pitcher (some break their hands before peak
// leg lift; the bottom of the back-leg load can come before or after the hand break). Within this group
// the order is whatever the marked times say; it is never treated as a mistake.
const LEG_LOAD_EVENT = 'Bottom of Back Leg Loading'
const INTERCHANGEABLE_EVENTS:string[][] = [['Peak Leg Lift','Hand Break',LEG_LOAD_EVENT]]

// Timeline presentation for each key event: short pin label + colour. Order must match KEY_EVENTS.
const EVENT_DEFS:DeliveryEventDef[] = [
  {name:'Front Foot Off Ground',short:'Foot off',color:'#58a6ff'},
  {name:'Peak Leg Lift',short:'Peak lift',color:'#39d3c3'},
  {name:'Hand Break',short:'Hand break',color:'#39d353'},
  {name:LEG_LOAD_EVENT,short:'Leg load',color:'#f778ba'},
  {name:'Foot Plant (Weight-Bearing)',short:'Foot plant',color:'#e8b84b'},
  {name:'Hip Rotation Stop',short:'Hips stop',color:'#f0883e'},
  {name:'Max External Rotation (MER)',short:'MER',color:'#f85149'},
  {name:'Release',short:'Release',color:'#a371f7'},
]

// Published research associations — NOT verified ceilings, and NOT verified at 95+ mph
// specifically. Shown next to the athlete's own measured duration as context, never as a
// pass/fail target.
const FOOT_PLANT_TO_RELEASE_ASSOC_SEC:[number,number] = [0.14,0.15]
const MER_TO_RELEASE_ASSOC_SEC:[number,number] = [0,0.05]

type PhaseDuration = { fromEvent:string, toEvent:string, durationSec:number }
type PhaseDurationResult = { consecutive:PhaseDuration[], footPlantToRelease:number|null, merToRelease:number|null }

// Finds each canonical KEY_EVENT's timestamp within ONE session (matched by session_label,
// since mechanics_frame_logs has no session_id/foreign key -- free-text label matching is a
// real limitation, documented rather than hidden). If an event was logged more than once in
// the same session, the most recently saved tag wins (entries arrive already sorted
// newest-first). Returns both the full consecutive-phase chain AND the two specific
// non-adjacent comparisons (foot plant->release, MER->release) that have a published
// research association to show alongside them.
function latestEventEntries(entries:LogEntry[], sessionLabel:string):Map<string,LogEntry>{
  const scoped = sessionLabel ? entries.filter(e=>e.sessionLabel===sessionLabel) : []
  const byEvent = new Map<string,LogEntry>()
  for (const e of scoped){ if (e.keyEvent && KEY_EVENTS.includes(e.keyEvent) && !byEvent.has(e.keyEvent)) byEvent.set(e.keyEvent,e) }
  return byEvent
}

// Durations are REAL seconds. Marks are stored as raw video time (so every saved record stays valid
// and the timeline can still seek the video), and are converted here with the same slow-motion rule
// the jump tools use. Without this, a 240 fps clip's delivery read 8x too long.
function computePhaseDurations(entries:LogEntry[], sessionLabel:string, captureFps:number):PhaseDurationResult{
  const byEvent = latestEventEntries(entries,sessionLabel)
  const gap = (from:string,to:string):number|null=>{
    const a=byEvent.get(from), b=byEvent.get(to)
    if (!a||!b||a.time==null||b.time==null) return null
    return videoToRealSec(b.time-a.time,captureFps)
  }
  // The chain runs over the events that were actually marked, in the order they happened: fixed list order
  // for most events, marked-time order inside an interchangeable group (leg lift / hand break / leg load).
  // Skipping unmarked events also means the new optional "bottom of back leg loading" mark does not break
  // the durations for pitchers who don't use it (it used to require every neighbouring event to be marked).
  const marked = KEY_EVENTS.map(k=>byEvent.get(k)).filter((e):e is LogEntry=>!!e&&e.time!=null)
  marked.sort((a,b)=>{
    const sameGroup=INTERCHANGEABLE_EVENTS.some(g=>g.includes(a.keyEvent as string)&&g.includes(b.keyEvent as string))
    return sameGroup ? (a.time as number)-(b.time as number) : KEY_EVENTS.indexOf(a.keyEvent as string)-KEY_EVENTS.indexOf(b.keyEvent as string)
  })
  const consecutive:PhaseDuration[] = []
  for (let i=0;i<marked.length-1;i++){
    const from=marked[i].keyEvent as string, to=marked[i+1].keyEvent as string
    const d=gap(from,to)
    if (d!=null) consecutive.push({fromEvent:from,toEvent:to,durationSec:d})
  }
  return {
    consecutive,
    footPlantToRelease:gap('Foot Plant (Weight-Bearing)','Release'),
    merToRelease:gap('Max External Rotation (MER)','Release'),
  }
}

type CameraView = 'side' | 'front' | 'back' | 'aerial'
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
  sessionLabel:string|null
  hipPx:{x:number,y:number}|null // only populated for entries logged this session — not persisted in the DB schema
  savedAt?:string
  // The capture frame rate selected when this mark was saved (needs the optional `capture_fps`
  // column; see docs/mechanics-save-sql.md). null for records saved before it existed.
  captureFps?:number|null
}

// The exact row sent to Supabase for one logged frame. Kept as a type so a failed save can be held
// and re-sent unchanged.
type FramePayload = {
  pitcher_id:string, session_label:string|null, camera_view:string, video_timestamp_sec:number|null,
  front_knee_deg:number|null, back_knee_deg:number|null, trunk_tilt_deg:number|null, elbow_deg:number|null,
  stride_pct_ht:number|null, stride_inches:number|null, hip_shoulder_sep_deg:number|null,
  key_event:string|null, notes:string|null, capture_fps:number,
}

// A mechanics_frame_logs row as returned by Supabase (only the columns this tool reads).
type FrameRow = {
  id:string, video_timestamp_sec:number|null, front_knee_deg:number|null, back_knee_deg:number|null,
  trunk_tilt_deg:number|null, elbow_deg:number|null, stride_pct_ht:number|null, stride_inches:number|null,
  hip_shoulder_sep_deg:number|null, notes:string|null, camera_view:string|null, key_event:string|null,
  session_label:string|null, created_at?:string, capture_fps?:number|null,
}

function rowToEntry(r:FrameRow):LogEntry{
  return {
    id:r.id, time:r.video_timestamp_sec, frontKnee:r.front_knee_deg, backKnee:r.back_knee_deg,
    trunkTilt:r.trunk_tilt_deg, elbow:r.elbow_deg, stridePctHt:r.stride_pct_ht, strideInches:r.stride_inches,
    hipShoulderSep:r.hip_shoulder_sep_deg, notes:r.notes, cameraView:r.camera_view, keyEvent:r.key_event,
    sessionLabel:r.session_label, hipPx:null, savedAt:r.created_at, captureFps:r.capture_fps??null,
  }
}

// Postgres / PostgREST codes for "that column does not exist": the optional capture_fps column has
// not been added yet, so the row is saved without it instead of failing.
const MISSING_COLUMN_CODES = ['PGRST204','42703']
const finiteOrNull = (v:number|null|undefined):number|null => (typeof v==='number'&&Number.isFinite(v)) ? v : null

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

// Where the video bitmap actually sits inside the canvas element. The canvas is styled
// `object-fit: contain`, so if the element's shape differs from the video's (a portrait iPhone
// clip, a 4:3 clip, or a height-capped box) the bitmap is letterboxed and a plain
// rect-to-bitmap ratio lands every touch in the wrong place. `scale` is CSS pixels per bitmap
// pixel; its inverse converts "a finger-sized target in CSS pixels" into bitmap pixels.
function canvasGeometry(canvas:HTMLCanvasElement):{left:number,top:number,scale:number}|null{
  const rect=canvas.getBoundingClientRect()
  if (!rect.width||!rect.height||!canvas.width||!canvas.height) return null
  const scale=Math.min(rect.width/canvas.width, rect.height/canvas.height)
  return {left:rect.left+(rect.width-canvas.width*scale)/2, top:rect.top+(rect.height-canvas.height*scale)/2, scale}
}

function getCanvasPoint(e:{clientX:number,clientY:number}, canvas:HTMLCanvasElement):{x:number,y:number}{
  const g=canvasGeometry(canvas)
  if (!g) return {x:0,y:0}
  return {x:(e.clientX-g.left)/g.scale, y:(e.clientY-g.top)/g.scale}
}

// A fingertip covers roughly 40-50 CSS pixels; this is the radius (CSS px) within which a touch
// grabs the nearest joint marker. Deliberately generous so a marker is easy to pick up.
const MARKER_GRAB_RADIUS_CSS_PX = 30

const LM_LABEL:Record<number,string> = {
  [LM.nose]:'Head', [LM.lShoulder]:'L shoulder', [LM.rShoulder]:'R shoulder', [LM.lElbow]:'L elbow', [LM.rElbow]:'R elbow',
  [LM.lWrist]:'L wrist', [LM.rWrist]:'R wrist', [LM.lHip]:'L hip', [LM.rHip]:'R hip', [LM.lKnee]:'L knee', [LM.rKnee]:'R knee',
  [LM.lAnkle]:'L ankle', [LM.rAnkle]:'R ankle',
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

// `px` = bitmap pixels per CSS pixel. The canvas bitmap is the video's native size (e.g. 1920 wide)
// but is shown ~400 CSS px wide on a phone, so a fixed "4" would draw a 1.5 px dot. Everything is
// sized in CSS pixels and multiplied by `px`, so markers look the same size on every screen.
function drawSkeleton(ctx:CanvasRenderingContext2D, pts:Record<number,{x:number,y:number}>, overrides:Record<number,{x:number,y:number}>, px=1, activeIdx:number|null=null){
  ctx.lineWidth=2.5*px
  ctx.strokeStyle=C.gold
  BONES.forEach(([a,b])=>{
    const A=pts[a], B=pts[b]
    ctx.beginPath(); ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y); ctx.stroke()
  })
  Object.values(LM).forEach(i=>{
    const P=pts[i]
    const overridden=!!overrides[i]
    ctx.fillStyle=overridden?C.red:C.text
    ctx.beginPath(); ctx.arc(P.x,P.y,(overridden?7:5.5)*px,0,Math.PI*2); ctx.fill()
    ctx.strokeStyle='rgba(13,17,23,0.85)'; ctx.lineWidth=1.5*px
    ctx.beginPath(); ctx.arc(P.x,P.y,(overridden?7:5.5)*px,0,Math.PI*2); ctx.stroke()
    if (overridden){
      ctx.strokeStyle=C.red; ctx.lineWidth=2*px
      ctx.beginPath(); ctx.arc(P.x,P.y,12*px,0,Math.PI*2); ctx.stroke()
    }
  })
  // The marker being dragged: a big ring so it is visible around the fingertip, plus a name tag
  // drawn well above it so the finger does not hide what is being moved.
  if (activeIdx!=null && pts[activeIdx]){
    const P=pts[activeIdx]
    ctx.strokeStyle=C.gold; ctx.lineWidth=2.5*px
    ctx.beginPath(); ctx.arc(P.x,P.y,22*px,0,Math.PI*2); ctx.stroke()
    const label=LM_LABEL[activeIdx]??''
    if (label){
      ctx.font=`bold ${13*px}px system-ui,-apple-system,sans-serif`
      const w=ctx.measureText(label).width+14*px, h=22*px
      let tx=P.x-w/2; const ty=Math.max(2*px,P.y-58*px)
      tx=Math.max(2*px,Math.min(ctx.canvas.width-w-2*px,tx))
      ctx.fillStyle='rgba(13,17,23,0.92)'; ctx.fillRect(tx,ty,w,h)
      ctx.strokeStyle=C.gold; ctx.lineWidth=1*px; ctx.strokeRect(tx,ty,w,h)
      ctx.fillStyle=C.gold; ctx.textBaseline='middle'; ctx.fillText(label,tx+7*px,ty+h/2)
    }
  }
}

function confidenceBadge(metric:string, view:CameraView):'reliable'|'estimate'{
  const reliableFromSide = ['frontKnee','backKnee','trunkTilt','elbow','stridePctHt']
  const reliableFromFrontBack = ['hipShoulderSep','elbow']
  // Aerial (directly overhead) sees rotation in the horizontal plane cleanly but foreshortens
  // the vertical bend angles (knee/elbow flexion, trunk tilt) that side view reads reliably --
  // a judgment call documented here, not a validated accuracy claim like the badge implies
  // for side/front/back below.
  const reliableFromAerial = ['hipShoulderSep']
  if (view==='side') return reliableFromSide.includes(metric) ? 'reliable' : 'estimate'
  if (view==='aerial') return reliableFromAerial.includes(metric) ? 'reliable' : 'estimate'
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

function computeSpeedLabel(a:LogEntry|undefined, b:LogEntry|undefined, pxPerInch:number|null, captureFps:number):string{
  if (!a||!b||a.id===b.id) return '—'
  if (!a.hipPx||!b.hipPx) return 'Pixel position only available for entries logged this session'
  const dt=videoToRealSec(Math.abs((b.time??0)-(a.time??0)),captureFps) // real seconds, not slowed-video seconds
  if (dt===0) return '—'
  const dPx=Math.hypot(b.hipPx.x-a.hipPx.x, b.hipPx.y-a.hipPx.y)
  if (pxPerInch){
    const mph=(dPx/pxPerInch/dt)*0.0568182
    return `${mph.toFixed(1)} mph`
  }
  return `${(dPx/dt).toFixed(0)} px/s (uncalibrated)`
}

// Timecode shown under the video: real seconds (video time / slow-motion factor).
const fmtRealTime = (videoSec:number, captureFps:number)=>videoToRealSec(videoSec,captureFps).toFixed(3)+'s'

const inpBase:React.CSSProperties = {width:'100%',background:C.bg3,border:`1px solid ${C.border}`,borderRadius:6,padding:'8px 10px',fontSize:13,color:C.text,outline:'none'}
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
  // Visible result of the last save attempt (a green confirmation or the real error), and any marks
  // that failed to save and are waiting to be retried. Previously a failed save did nothing at all.
  const [saveNotice,setSaveNotice]=useState<{kind:'ok'|'error',text:string}|null>(null)
  const [pending,setPending]=useState<FramePayload[]>([])
  const [poseError,setPoseError]=useState('')
  const [currentTime,setCurrentTime]=useState(0)
  const [videoDuration,setVideoDuration]=useState(0)

  // Layout: two columns only when the component itself is wide (the athlete dashboard is a ~480px
  // phone-width shell even on a desktop screen, so this measures the component, not the window).
  const rootRef=useRef<HTMLDivElement>(null)
  const [wide,setWide]=useState(false)
  // Video shape, so the box can match the clip (portrait or landscape) instead of a fixed 16:9.
  const [videoAspect,setVideoAspect]=useState(16/9)
  useEffect(()=>{
    const el=rootRef.current; if (!el||typeof ResizeObserver==='undefined') return
    const ro=new ResizeObserver(entries=>{ setWide(entries[0].contentRect.width>=720) })
    ro.observe(el)
    return ()=>ro.disconnect()
  },[])
  // iOS Safari zooms the whole page when a text field under 16px is focused; keep fields at 16px on narrow screens.
  const inp:React.CSSProperties={...inpBase,fontSize:wide?13:16}
  // Slow-motion rate the clip was filmed at (see lib/slowMotion.ts). 30 = real time, no conversion.
  const captureFps=parseFloat(fps)||30

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
  const captureFpsColumnMissingRef=useRef(false)
  // Manual per-frame marker corrections — pixel-space, reset whenever new MediaPipe
  // landmarks arrive (i.e. whenever the video moves to a different frame).
  const markerOverridesRef=useRef<Record<number,{x:number,y:number}>>({})
  // One active drag at a time: which joint, which pointer (finger), and the offset between where
  // the finger first touched and the joint's centre, so the marker does not snap under the finger.
  const dragRef=useRef<{idx:number,pointerId:number,dx:number,dy:number}|null>(null)
  const dragFrameRef=useRef<number|null>(null)
  const configRef=useRef({handedness,pxPerInch,heightIn,fps,view})
  useEffect(()=>{ configRef.current={handedness,pxPerInch,heightIn,fps,view} })
  // Changing the capture rate re-labels the timecode right away (it is otherwise only refreshed on a seek).
  useEffect(()=>{
    const v=videoRef.current
    if (v&&timecodeRef.current) timecodeRef.current.textContent=fmtRealTime(v.currentTime||0,parseFloat(fps)||30)
  },[fps])

  const drawFrame=useCallback(()=>{
    const video=videoRef.current, canvas=canvasRef.current
    if (!video||!canvas) return
    const ctx=canvas.getContext('2d'); if (!ctx) return
    ctx.clearRect(0,0,canvas.width,canvas.height)
    ctx.drawImage(video,0,0,canvas.width,canvas.height)
    const lms=latestLandmarksRef.current
    if (lms){
      const pts=resolvePoints(lms,markerOverridesRef.current,canvas.width,canvas.height)
      const g=canvasGeometry(canvas)
      drawSkeleton(ctx,pts,markerOverridesRef.current,g?1/g.scale:1,dragRef.current?.idx??null)
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

  // Pointer events cover mouse, pen, and finger with one code path. (The old mouse-only handlers never
  // fired for a finger drag on iOS: Safari only synthesises mouse events for a tap.) Combined with
  // `touch-action: none` on the canvas, a drag moves the marker instead of scrolling the page.
  const redrawSoon=()=>{
    if (dragFrameRef.current!=null) return
    dragFrameRef.current=requestAnimationFrame(()=>{ dragFrameRef.current=null; drawFrame() })
  }
  const onCanvasPointerDown=(e:React.PointerEvent<HTMLCanvasElement>)=>{
    const canvas=canvasRef.current, lms=latestLandmarksRef.current
    if (!canvas||!lms||dragRef.current) return
    const g=canvasGeometry(canvas); if (!g) return
    const pt=getCanvasPoint(e,canvas)
    const pts=resolvePoints(lms,markerOverridesRef.current,canvas.width,canvas.height)
    let nearest:number|null=null, nearestDist=Infinity
    for (const idx of Object.values(LM)){
      const d=Math.hypot(pts[idx].x-pt.x,pts[idx].y-pt.y)
      if (d<nearestDist){ nearestDist=d; nearest=idx }
    }
    const grabRadius=MARKER_GRAB_RADIUS_CSS_PX/g.scale // finger-sized, in bitmap pixels
    if (nearest==null||nearestDist>grabRadius) return
    e.preventDefault()
    try{ canvas.setPointerCapture(e.pointerId) }catch{ /* capture is best-effort */ }
    dragRef.current={idx:nearest,pointerId:e.pointerId,dx:pts[nearest].x-pt.x,dy:pts[nearest].y-pt.y}
    drawFrame()
  }
  const onCanvasPointerMove=(e:React.PointerEvent<HTMLCanvasElement>)=>{
    const canvas=canvasRef.current, drag=dragRef.current
    if (!drag||!canvas||e.pointerId!==drag.pointerId) return
    const pt=getCanvasPoint(e,canvas)
    // Keep the marker on the picture even if the finger slides off the edge.
    const x=Math.max(0,Math.min(canvas.width,pt.x+drag.dx)), y=Math.max(0,Math.min(canvas.height,pt.y+drag.dy))
    markerOverridesRef.current={...markerOverridesRef.current,[drag.idx]:{x,y}}
    redrawSoon()
  }
  const endDrag=(e:React.PointerEvent<HTMLCanvasElement>)=>{
    const canvas=canvasRef.current, drag=dragRef.current
    if (!drag||e.pointerId!==drag.pointerId) return
    dragRef.current=null
    try{ canvas?.releasePointerCapture(e.pointerId) }catch{ /* already released */ }
    drawFrame()
  }
  const resetCorrections=()=>{ markerOverridesRef.current={}; drawFrame() }
  useEffect(()=>()=>{ if (dragFrameRef.current!=null) cancelAnimationFrame(dragFrameRef.current) },[])

  useEffect(()=>{
    let cancelled=false
    // Pinned to a known-good version — the unversioned "@mediapipe/pose/pose.js" CDN URL
    // resolves to whatever the latest npm release is at request time, which can silently
    // change the exposed API shape. Pin both the script and locateFile to the same version.
    const POSE_VERSION='0.5.1675469404'
    // The in-browser video converter is optional (only used for unplayable files). It used to be part of
    // the same Promise.all, so if its CDN was blocked or slow the pose library was reported as failed
    // and nothing could be analysed or saved. Load it on its own and ignore a failure.
    loadScript('https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js').catch(err=>console.warn('converter script failed to load (optional):',err))
    loadScript(`https://cdn.jsdelivr.net/npm/@mediapipe/pose@${POSE_VERSION}/pose.js`).then(()=>waitForGlobal('Pose')).then((PoseCtor)=>{
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
    const rows:LogEntry[]=(data||[]).map(rowToEntry)
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
    // A thrown error here used to vanish (an unhandled rejection), leaving the skeleton blank and
    // Log Frame silently disabled. Surface it so it is clear why nothing can be saved.
    try{
      await pose.send({image:video})
      setPoseError('')
    }catch(err:unknown){
      console.error('pose.send failed',err)
      setPoseError(`Pose tracking couldn't read this frame on this device (${err instanceof Error?err.message:String(err)}).`)
    }
  },[])

  // If the pose library finishes loading after the clip, read the first frame then. Otherwise the
  // skeleton never appears until the user happens to step or play, and nothing can be logged.
  useEffect(()=>{
    const video=videoRef.current
    if (scriptsReady&&videoLoaded&&video&&video.readyState>=2&&!latestLandmarksRef.current) analyzeCurrentFrame()
  },[scriptsReady,videoLoaded,analyzeCurrentFrame])

  const seekAndAnalyze=useCallback(()=>{
    const video=videoRef.current; if (!video) return
    if (timecodeRef.current) timecodeRef.current.textContent=fmtRealTime(video.currentTime,parseFloat(configRef.current.fps)||30)
    setCurrentTime(video.currentTime)
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
    setCurrentTime(0); setVideoDuration(0)
    // Phase durations are matched by session label, so give a new clip one automatically (still editable).
    setSessionLabel(prev=>prev||`${new Date().toISOString().slice(0,10)} · ${file.name}`)
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
      setVideoDuration(video.duration)
      const canvas=canvasRef.current
      if (canvas){ canvas.width=video.videoWidth; canvas.height=video.videoHeight }
      if (video.videoWidth&&video.videoHeight) setVideoAspect(video.videoWidth/video.videoHeight)
      if (scrubRef.current){ scrubRef.current.max=String(video.duration); scrubRef.current.step=String(FRAME_STEP_VIDEO_SEC) }
      setStatusLine({text:'Ready. Tracking runs as you play or step through frames.',kind:'ready'})
      seekAndAnalyze()
      // iOS Safari does not decode a frame until the video is played or seeked, and seekAndAnalyze only
      // reads a frame after a seek happens, so nothing was analysed on load. A tiny seek forces the first
      // frame to decode and fires the 'seeked' event; the timer is a fallback if iOS never fires it.
      if (video.duration>0.01) video.currentTime=0.001
      setTimeout(()=>{ if (!latestLandmarksRef.current) analyzeCurrentFrame() },2500)
    }
  },[seekAndAnalyze,analyzeCurrentFrame])

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
      if (timecodeRef.current) timecodeRef.current.textContent=fmtRealTime(video.currentTime,parseFloat(configRef.current.fps)||30)
      setCurrentTime(video.currentTime)
      requestAnimationFrame(playLoop)
    })
  },[analyzeCurrentFrame])

  const togglePlay=()=>{
    const video=videoRef.current; if (!video) return
    if (isPlayingRef.current){ video.pause(); isPlayingRef.current=false; setIsPlaying(false) }
    else {
      // play() returns a promise that iOS can reject; only mark the video as playing once it really is.
      video.play().then(()=>{ isPlayingRef.current=true; setIsPlaying(true); playLoop() })
        .catch((err:unknown)=>{ console.error('video.play failed',err); isPlayingRef.current=false; setIsPlaying(false) })
    }
  }

  // One displayed frame, in video time. The slow-motion rate does NOT change how far one frame is on the
  // video's clock (a 240 fps clip plays at ~30 fps, so a frame is 1/30 of a video second); it only changes
  // how much REAL time that is. Same convention as the jump tools. (This used to step by 1/fps of the selected
  // capture rate, which at "240" moved 1/8 of a displayed frame per tap.)
  const stepFrame=(dir:number)=>{
    const video=videoRef.current; if (!video) return
    video.currentTime=Math.max(0,Math.min(video.duration,video.currentTime+dir*FRAME_STEP_VIDEO_SEC))
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

  // One place that talks to Supabase for a frame log. The optional capture_fps column (so a reopened
  // session knows its slow-motion rate; see docs/mechanics-save-sql.md) may not exist yet: if the
  // database says the column is missing, the same row is re-sent without it so saving still works
  // before and after that column is added.
  const insertFrame=async(payload:FramePayload)=>{
    const send=(p:Record<string,unknown>)=>supabase.from('mechanics_frame_logs').insert(p).select().single()
    const withoutFps:Record<string,unknown>={...payload}; delete withoutFps.capture_fps
    if (captureFpsColumnMissingRef.current) return send(withoutFps)
    const first=await send({...payload})
    if (first.error&&(MISSING_COLUMN_CODES.includes(first.error.code)||/capture_fps/i.test(first.error.message||''))){
      const second=await send(withoutFps)
      if (!second.error) captureFpsColumnMissingRef.current=true
      return second
    }
    return first
  }
  const describeSaveError=(error:{message?:string,code?:string}|null|undefined)=>
    `${error?.message||'no response from the server'}${error?.code?` (code ${error.code})`:''}`
  const commitSaved=(row:FrameRow, payload:FramePayload, hipPx:{x:number,y:number}|null)=>{
    setLogEntries(prev=>[{...rowToEntry(row),hipPx,captureFps:payload.capture_fps},...prev])
  }

  const logFrame=async(eventOverride?:string)=>{
    const m=latestMetricsRef.current
    if (!m){
      setSaveNotice({kind:'error',text:'Nothing to save yet: pose tracking has no reading for this frame. Step or scrub the video until the skeleton appears on the athlete.'})
      return
    }
    const eventToLog=eventOverride??keyEvent
    const capture=parseFloat(fps)||30
    // NaN/Infinity from a degenerate joint reading would be sent as null and could break a NOT NULL column; send null on purpose.
    const payload:FramePayload={
      pitcher_id:pitcherId,
      session_label:sessionLabel||null,
      camera_view:view,
      video_timestamp_sec:finiteOrNull(m.time),
      front_knee_deg:finiteOrNull(m.frontKnee),
      back_knee_deg:finiteOrNull(m.backKnee),
      trunk_tilt_deg:finiteOrNull(m.trunkTilt),
      elbow_deg:finiteOrNull(m.elbow),
      stride_pct_ht:finiteOrNull(m.stridePctHt),
      stride_inches:finiteOrNull(m.strideInches),
      hip_shoulder_sep_deg:finiteOrNull(m.hipShoulderSep),
      key_event:eventToLog||null,
      notes:frameNotes||null,
      capture_fps:capture,
    }
    setSaving(true); setSaveNotice(null)
    const {data,error}=await insertFrame(payload)
    setSaving(false)
    if (error||!data){
      console.error('mechanics: failed to save frame log',error)
      setPending(p=>[...p,payload])
      setSaveNotice({kind:'error',text:`Couldn't save: ${describeSaveError(error)}. Your mark is held on this screen. Tap Retry save, and keep this page open until it saves.`})
      return
    }
    commitSaved(data,payload,m.hipPx)
    setFrameNotes('')
    if (!eventOverride) setKeyEvent('')
    setSaveNotice({kind:'ok',text:`Saved ${eventToLog||'frame'} at ${videoToRealSec(m.time,capture).toFixed(3)} s (real time).`})
  }

  const retryPending=async()=>{
    if (!pending.length||saving) return
    setSaving(true); setSaveNotice(null)
    const stillFailing:FramePayload[]=[]
    let lastError=''
    for (const p of pending){
      const {data,error}=await insertFrame(p)
      if (error||!data){ stillFailing.push(p); lastError=describeSaveError(error) }
      else commitSaved(data,p,null)
    }
    setPending(stillFailing); setSaving(false)
    setSaveNotice(stillFailing.length
      ? {kind:'error',text:`Still couldn't save ${stillFailing.length} mark${stillFailing.length!==1?'s':''}: ${lastError}`}
      : {kind:'ok',text:'All held marks are saved.'})
  }

  const exportCsv=()=>{
    if (!logEntries.length) return
    // Time(s) stays the raw video-clock time it always was (existing spreadsheets keep working); the
    // two new columns on the right give real seconds and the capture rate used to get there.
    const header='Time(s),FrontKnee,BackKnee,TrunkTilt,Elbow,Stride%Ht,StrideInches,HipShoulderSep(est),CameraView,KeyEvent,Notes,RealTime(s),CaptureFps\n'
    const rows=logEntries.map(e=>{
      const fpsUsed=e.captureFps||captureFps
      return [
        e.time?.toFixed(3)??'', e.frontKnee?.toFixed(1)??'', e.backKnee?.toFixed(1)??'', e.trunkTilt?.toFixed(1)??'',
        e.elbow?.toFixed(1)??'', e.stridePctHt?e.stridePctHt.toFixed(1):'', e.strideInches?e.strideInches.toFixed(1):'',
        e.hipShoulderSep?.toFixed(1)??'', e.cameraView??'', e.keyEvent??'', `"${(e.notes??'').replace(/"/g,'""')}"`,
        e.time!=null?videoToRealSec(e.time,fpsUsed).toFixed(4):'', String(fpsUsed),
      ].join(',')
    })
    const csv=header+rows.join('\n')
    const blob=new Blob([csv],{type:'text/csv'})
    const a=document.createElement('a')
    a.href=URL.createObjectURL(blob)
    a.download='mechanics_frame_log.csv'
    a.click()
  }

  // Why Log Frame / Mark cannot be used right now, in plain words (empty when saving is available).
  const blockedReason=!videoLoaded?'Load a video first.'
    :scriptError?'The pose-tracking library did not load, so nothing can be measured. Check your connection and reload this tab.'
    :!scriptsReady?'Pose tracking is still loading. This can take a few seconds the first time.'
    :poseError?poseError
    :!latestMetrics?'Waiting for a pose reading. Step or scrub to a frame until the gold skeleton appears on the athlete; then you can log it.'
    :''
  const entryA=logEntries.find(e=>e.id===rowA)
  const entryB=logEntries.find(e=>e.id===rowB)
  const speedLabel=computeSpeedLabel(entryA,entryB,pxPerInch,captureFps)
  const phaseDurations=computePhaseDurations(logEntries,sessionLabel,captureFps)
  const legLoad=latestEventEntries(logEntries,sessionLabel).get(LEG_LOAD_EVENT)
  // The delivery timeline works entirely in REAL seconds (axis, marks, playhead, durations), so what it
  // shows is how long the delivery actually took. Stored marks are video time; they are converted here
  // and converted back when the timeline asks to seek the video.
  const toReal=(videoSec:number)=>videoToRealSec(videoSec,captureFps)
  const markedEvents=Array.from(latestEventEntries(logEntries,sessionLabel).values())
    .filter(e=>e.time!=null).map(e=>({name:e.keyEvent as string,time:toReal(e.time as number)}))
  const seekToReal=(realSec:number)=>{
    const video=videoRef.current; if (!video) return
    video.currentTime=Math.max(0,Math.min(video.duration||0,realToVideoSec(realSec,captureFps)))
    seekAndAnalyze()
  }
  const changeSessionLabel=(label:string)=>{
    setSessionLabel(label)
    // Reopening a saved session: restore the slow-motion rate its marks were saved with, so durations
    // come out right without having to re-pick it. (Only rows saved after capture_fps existed carry it.)
    const saved=logEntries.find(e=>e.sessionLabel===label.trim()&&e.captureFps)
    if (saved?.captureFps) setFps(String(saved.captureFps))
  }

  const statCard=(label:string,value:string,unit:string,metricKey:string,target?:string)=>{
    const badge=confidenceBadge(metricKey,view)
    return (
      <div key={`${label}-${unit}`} style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:8,padding:'12px 14px',position:'relative' as const}}>
        <span style={{position:'absolute' as const,top:10,right:10,fontSize:9,padding:'2px 6px',borderRadius:3,textTransform:'uppercase' as const,letterSpacing:'0.4px',fontWeight:600,background:badge==='reliable'?'rgba(57,211,83,0.15)':'rgba(224,164,56,0.15)',color:badge==='reliable'?C.teal:C.gold,border:`1px solid ${badge==='reliable'?'rgba(57,211,83,0.3)':'rgba(224,164,56,0.3)'}`}}>{badge==='reliable'?'Reliable':'Est.'}</span>
        <div style={{fontSize:11,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.4px',marginBottom:6,paddingRight:52}}>{label}</div>
        <div style={{fontFamily:'monospace',fontSize:24,fontWeight:700,color:C.white,lineHeight:1}}>{value}<span style={{fontSize:12,color:C.textMuted,fontWeight:400,marginLeft:2}}>{unit}</span></div>
        {target&&<div style={{fontSize:10,color:C.textDim,marginTop:6}}>Target: {target}</div>}
      </div>
    )
  }

  return (
    <div ref={rootRef} style={{color:C.text,fontSize:13,minWidth:0,paddingLeft:'env(safe-area-inset-left)',paddingRight:'env(safe-area-inset-right)',paddingBottom:'env(safe-area-inset-bottom)'}}>
      <div style={{fontSize:16,fontWeight:700,color:C.gold,marginBottom:2}}>2D Delivery Analysis</div>
      <div style={{fontSize:11,color:C.textMuted,marginBottom:16}}>Pose-tracking runs entirely in the browser — nothing is uploaded anywhere except the frames you choose to log.</div>

      {scriptError&&<div style={{color:C.red,fontSize:13,marginBottom:12,padding:10,background:'rgba(248,81,73,0.1)',borderRadius:8}}>{scriptError}</div>}

      <div style={{display:'grid',gridTemplateColumns:wide?'1.4fr 1fr':'minmax(0,1fr)',gap:16}}>
        <div style={{minWidth:0}}>
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

          {/* Video box. Before a clip is loaded it is a plain upload card (min-height, so the Choose Video
              button can never be clipped by a fixed 16:9 shape on a narrow phone). Once a clip is loaded
              the box takes the clip's own shape, fills the available width, and is capped to the visible
              screen height with dvh (the iPhone's *dynamic* viewport, which shrinks and grows with
              Safari's toolbar, unlike vh) so a tall portrait clip never pushes the controls off-screen. */}
          <div
            onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
            style={{position:'relative' as const,...(videoLoaded?{width:`min(100%, calc((100dvh - 96px) * ${videoAspect}))`,aspectRatio:`${videoAspect}`,margin:'0 auto'}:{width:'100%',minHeight:200}),background:'#000',border:`1px solid ${dragOver?C.gold:C.border}`,borderRadius:8,overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}
          >
            {!videoLoaded&&(
              <div style={{color:C.textMuted,textAlign:'center' as const,fontSize:13,padding:20,zIndex:2}}>
                <b style={{color:C.text}}>Drop a pitching video</b> or tap below to choose one<br/>
                Analysis happens on this device — the video itself is never uploaded; only the measurements you log are saved.
                <div>
                  <input ref={fileInputRef} type="file" accept="video/*" style={{display:'none'}} onChange={onFileChange}/>
                  <button onClick={()=>fileInputRef.current?.click()} style={{marginTop:10,padding:'12px 22px',minHeight:44,background:C.gold,color:C.bg,border:'none',borderRadius:8,fontSize:15,fontWeight:700,cursor:'pointer'}}>Choose Video</button>
                </div>
              </div>
            )}
            <video ref={videoRef} playsInline muted preload="auto" style={{display:videoLoaded?'block':'none',position:'absolute' as const,top:0,left:0,width:'100%',height:'100%',objectFit:'contain' as const}}/>
            <canvas
              ref={canvasRef}
              onPointerDown={onCanvasPointerDown} onPointerMove={onCanvasPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
              style={{display:videoLoaded?'block':'none',position:'absolute' as const,top:0,left:0,width:'100%',height:'100%',objectFit:'contain' as const,cursor:videoLoaded?'crosshair':'default',touchAction:'none',WebkitTouchCallout:'none',WebkitUserSelect:'none',userSelect:'none'}}
            />
          </div>

          {videoLoaded&&(
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginTop:8,flexWrap:'wrap' as const}}>
              <span style={{fontSize:10,color:C.textDim}}>Press and drag any joint marker to correct MediaPipe&apos;s tracking for this frame — a tag above the marker names it while you drag. Corrections reset when you move to a new frame.</span>
              <button onClick={resetCorrections} style={{...btnStyle(),fontSize:11,padding:'8px 12px',minHeight:40,flexShrink:0}}>Reset corrections</button>
            </div>
          )}

          <div style={{display:'flex',alignItems:'center',gap:8,marginTop:12,flexWrap:'wrap' as const}}>
            <button onClick={togglePlay} disabled={!videoLoaded} style={{...btnStyle(),opacity:videoLoaded?1:0.35}}>{isPlaying?'⏸ Pause':'▶ Play'}</button>
            <button onClick={()=>stepFrame(-1)} disabled={!videoLoaded} style={{...btnStyle(),opacity:videoLoaded?1:0.35}}>⏮ −1 frame</button>
            <button onClick={()=>stepFrame(1)} disabled={!videoLoaded} style={{...btnStyle(),opacity:videoLoaded?1:0.35}}>+1 frame ⏭</button>
            <input ref={scrubRef} type="range" min={0} max={100} defaultValue={0} onChange={onScrub} disabled={!videoLoaded} style={{flex:1,minWidth:140,accentColor:C.gold}}/>
            <span ref={timecodeRef} style={{fontFamily:'monospace',fontSize:12,color:C.textMuted,minWidth:70}}>0.000s</span>
            <button onClick={()=>logFrame()} disabled={!videoLoaded||!latestMetrics||saving} style={{...btnStyle(true),opacity:(videoLoaded&&latestMetrics&&!saving)?1:0.35}}>{saving?'Saving...':'Log Frame'}</button>
          </div>

          {/* Save feedback. Saving used to give no sign of success or failure; the real error text and code now show here. */}
          {saveNotice&&(
            <div role="status" style={{marginTop:8,padding:'9px 11px',borderRadius:8,fontSize:12,lineHeight:1.5,background:saveNotice.kind==='ok'?'rgba(57,211,83,0.10)':'rgba(248,81,73,0.10)',border:`1px solid ${saveNotice.kind==='ok'?'rgba(57,211,83,0.35)':'rgba(248,81,73,0.4)'}`,color:saveNotice.kind==='ok'?C.teal:C.red}}>{saveNotice.text}</div>
          )}
          {pending.length>0&&(
            <button onClick={retryPending} disabled={saving} style={{...btnStyle(true),marginTop:8,width:'100%',opacity:saving?0.5:1}}>{saving?'Saving…':`Retry save (${pending.length} held mark${pending.length!==1?'s':''})`}</button>
          )}
          {blockedReason&&!saveNotice&&(
            <div style={{marginTop:8,fontSize:11,color:C.textMuted,lineHeight:1.5}}>{blockedReason}</div>
          )}

          <DeliveryTimeline
            events={EVENT_DEFS} marked={markedEvents} duration={toReal(videoDuration)} currentTime={toReal(currentTime)}
            onSeek={seekToReal} onMark={name=>logFrame(name)} interchangeable={INTERCHANGEABLE_EVENTS}
            canMark={videoLoaded&&!!latestMetrics&&!!sessionLabel.trim()}
            markHint={blockedReason||(!sessionLabel.trim()?'Enter a Session Label below so the marks group into one pitch.':'Step or play a frame so pose tracking has a reading, then mark.')}
            busy={saving}
            references={[
              {from:'Foot Plant (Weight-Bearing)',to:'Release',low:FOOT_PLANT_TO_RELEASE_ASSOC_SEC[0],high:FOOT_PLANT_TO_RELEASE_ASSOC_SEC[1],note:`Published association for this phase: ${FOOT_PLANT_TO_RELEASE_ASSOC_SEC[0]}–${FOOT_PLANT_TO_RELEASE_ASSOC_SEC[1]}s. Context from other research, not a verified ceiling or target.`},
              {from:'Max External Rotation (MER)',to:'Release',low:MER_TO_RELEASE_ASSOC_SEC[0],high:MER_TO_RELEASE_ASSOC_SEC[1],note:`Published association for arm acceleration: ~${MER_TO_RELEASE_ASSOC_SEC[1]}s. Not verified at 95+ mph specifically.`},
            ]}
          />

          <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8,padding:14,marginTop:14,display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <label style={lbl}>Camera View</label>
              <select value={view} onChange={e=>setView(e.target.value as CameraView)} style={inp}>
                <option value="side">Side view</option>
                <option value="front">Front view</option>
                <option value="back">Back view</option>
                <option value="aerial">Aerial (overhead) view</option>
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
              <label style={lbl}>Capture Frame Rate</label>
              <select value={fps} onChange={e=>setFps(e.target.value)} style={inp}>
                {CAPTURE_FPS_OPTIONS.map(o=><option key={o.fps} value={String(o.fps)}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Calibration</label>
              <button onClick={calibrate} disabled={!videoLoaded} style={{...btnStyle(),width:'100%',opacity:videoLoaded?1:0.35}}>Calibrate on this frame</button>
            </div>
            <div>
              <label style={lbl}>Session Label</label>
              <input type="text" placeholder="e.g. Bullpen 8/16" value={sessionLabel} onChange={e=>changeSessionLabel(e.target.value)} style={inp}/>
            </div>
            <div style={{gridColumn:'1/-1',fontSize:11,color:C.textMuted,lineHeight:1.5}}>
              Pick the rate the phone <b style={{color:C.text}}>filmed</b> at, not how it plays back. An iPhone slow-motion clip is filmed at 240 (or 120) and plays at about 30, so its video clock runs {captureFps>30?`${captureFps/30}×`:'at the same speed as'} real time. Every time and duration below is converted to <b style={{color:C.text}}>real seconds</b> using this. A normal-speed clip should be set to 30.
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
                    {['t (real s)','Fr Knee','Bk Knee','Trunk','Elbow','Stride%','Hip-Shd','Event'].map(h=><th key={h} style={{padding:'6px 8px',textAlign:'left' as const,color:C.textMuted,fontSize:9,textTransform:'uppercase' as const,whiteSpace:'nowrap' as const}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {logEntries.map(e=>(
                      <tr key={e.id} onClick={()=>{setRowA(rowA===e.id?'':rowA||e.id); if(rowA&&rowA!==e.id) setRowB(e.id)}} style={{borderBottom:'1px solid #1a1f28',cursor:'pointer',background:(rowA===e.id||rowB===e.id)?C.bg3:'transparent'}}>
                        <td style={{padding:'6px 8px',color:C.text}}>{e.time!=null?videoToRealSec(e.time,captureFps).toFixed(3):'—'}</td>
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
                {logEntries.map(e=><option key={e.id} value={e.id}>{e.time!=null?videoToRealSec(e.time,captureFps).toFixed(3):'—'}s</option>)}
              </select>
              <select value={rowB} onChange={e=>setRowB(e.target.value)} style={{...inp,flex:1}}>
                <option value="">—</option>
                {logEntries.map(e=><option key={e.id} value={e.id}>{e.time!=null?videoToRealSec(e.time,captureFps).toFixed(3):'—'}s</option>)}
              </select>
            </div>
            <div style={{background:C.bg3,border:`1px solid ${C.border}`,borderRadius:8,padding:'12px 14px'}}>
              <div style={{fontSize:11,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.4px',marginBottom:6}}>Hip Travel Speed</div>
              <div style={{fontFamily:'monospace',fontSize:20,fontWeight:700,color:C.white}}>{speedLabel}</div>
            </div>
          </div>

          <div>
            <div style={{fontSize:11,fontWeight:700,color:C.textMuted,textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:4,paddingBottom:8,borderBottom:`1px solid ${C.border}`}}>Phase Durations — This Session</div>
            <div style={{fontSize:10,color:C.textDim,marginBottom:10}}>Shows the time between each pair of events you tagged via Key Event (or the timeline) under the SAME Session Label above, in the order they happened. Leg lift, hand break and bottom of back leg loading can be marked in any order. Skip any event that doesn&apos;t apply. Matched by that label as plain text — relabeling or reusing a label will mix sessions. Durations are in <b style={{color:C.textMuted}}>real seconds</b> (video time ÷ {captureFps/30}, from the Capture Frame Rate above).</div>
            {sessionLabel==='' ? (
              <div style={{padding:16,textAlign:'center' as const,color:C.textDim,fontSize:12,background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8}}>Enter a Session Label above to compute phase durations for this pitch.</div>
            ) : phaseDurations.consecutive.length===0 ? (
              <div style={{padding:16,textAlign:'center' as const,color:C.textDim,fontSize:12,background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8}}>No two consecutive Key Events are tagged yet for session "{sessionLabel}".</div>
            ) : (
              <div style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:8,overflow:'hidden'}}>
                {phaseDurations.consecutive.map((d,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 10px',borderBottom:i<phaseDurations.consecutive.length-1?`1px solid ${C.border}`:'none'}}>
                    <span style={{fontSize:11,color:C.textMuted}}>{d.fromEvent} → {d.toEvent}</span>
                    <span style={{fontFamily:'monospace',fontSize:13,fontWeight:700,color:C.white}}>{d.durationSec.toFixed(3)}s</span>
                  </div>
                ))}
              </div>
            )}
            {legLoad&&legLoad.backKnee!=null&&(
              <div style={{marginTop:10,background:'rgba(247,120,186,0.08)',border:'1px solid rgba(247,120,186,0.4)',borderRadius:8,padding:'8px 10px'}}>
                <div style={{display:'flex',justifyContent:'space-between'}}>
                  <span style={{fontSize:11,color:'#f778ba'}}>Bottom of Back Leg Loading</span>
                  <span style={{fontFamily:'monospace',fontSize:13,fontWeight:700,color:C.white}}>{legLoad.backKnee.toFixed(0)}° back knee</span>
                </div>
                <div style={{fontSize:9,color:C.textDim,marginTop:3}}>Back-knee angle on the frame you marked as the bottom of the load. 180° is a straight leg; a smaller number is a deeper sink into the back leg. Estimated from one camera angle, so compare it between pitches from the same view.</div>
              </div>
            )}
            {(phaseDurations.footPlantToRelease!=null||phaseDurations.merToRelease!=null) && (
              <div style={{marginTop:10,display:'flex',flexDirection:'column' as const,gap:8}}>
                {phaseDurations.footPlantToRelease!=null && (
                  <div style={{background:C.goldBg,border:`1px solid ${C.goldDim}`,borderRadius:8,padding:'8px 10px'}}>
                    <div style={{display:'flex',justifyContent:'space-between'}}>
                      <span style={{fontSize:11,color:C.gold}}>Foot Plant → Release</span>
                      <span style={{fontFamily:'monospace',fontSize:13,fontWeight:700,color:C.white}}>{phaseDurations.footPlantToRelease.toFixed(3)}s</span>
                    </div>
                    <div style={{fontSize:9,color:C.textDim,marginTop:3}}>Published association for this phase: {FOOT_PLANT_TO_RELEASE_ASSOC_SEC[0]}–{FOOT_PLANT_TO_RELEASE_ASSOC_SEC[1]}s. An association seen in other research, not a verified ceiling and not specific to this athlete.</div>
                  </div>
                )}
                {phaseDurations.merToRelease!=null && (
                  <div style={{background:C.goldBg,border:`1px solid ${C.goldDim}`,borderRadius:8,padding:'8px 10px'}}>
                    <div style={{display:'flex',justifyContent:'space-between'}}>
                      <span style={{fontSize:11,color:C.gold}}>Max External Rotation → Release</span>
                      <span style={{fontFamily:'monospace',fontSize:13,fontWeight:700,color:C.white}}>{phaseDurations.merToRelease.toFixed(3)}s</span>
                    </div>
                    <div style={{fontSize:9,color:C.textDim,marginTop:3}}>Published association for arm acceleration: ~{MER_TO_RELEASE_ASSOC_SEC[1]}s. Not verified at 95+ mph specifically — context, not a target.</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{fontSize:10,color:C.textDim,textAlign:'center' as const,marginTop:16,paddingTop:12,borderTop:`1px solid ${C.border}`}}>Estimates only — not a substitute for calibrated multi-camera capture. Hip-shoulder separation from a single 2D view is a rough approximation; see badges above for confidence.</div>
    </div>
  )
}

// minHeight 40: Apple's guidance is ~44pt for a touch target; 12px text with 8px padding was ~32px tall.
function btnStyle(primary?:boolean):React.CSSProperties{
  return primary
    ? {background:C.gold,border:`1px solid ${C.gold}`,color:C.bg,padding:'8px 14px',minHeight:40,borderRadius:6,fontSize:13,fontWeight:700,cursor:'pointer',touchAction:'manipulation'}
    : {background:C.bg3,border:`1px solid ${C.border}`,color:C.text,padding:'8px 12px',minHeight:40,borderRadius:6,fontSize:13,cursor:'pointer',touchAction:'manipulation'}
}
