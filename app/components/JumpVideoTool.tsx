'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { calcJumpHeight } from '@/lib/cmj'

// Frame-stepped jump-height tool. Load a video, scrub to the last frame with both feet on the
// floor (Set takeoff) and the first frame feet touch down (Set landing), log the jump, repeat.
// Height comes from flight time: h = g * t^2 / 8 (same formula as lib/cmj.ts calcJumpHeight).
//
// Slow-motion note: an iPhone 240 fps clip plays back at ~30 fps, so each video second is
// 1/8 of a real second. Marker times are VIDEO time; real flight time = video time / slowMo.
// If the clip you load is a native-timeline file (plays in real time), pick "30 fps (real time)".

const C = {
  bg:'#0d1117',bg2:'#161b22',bg3:'#1c2333',panel:'#101826',border:'#30363d',
  gold:'#e8b84b',teal:'#39d353',red:'#f85149',blue:'#58a6ff',cyan:'#3dd9f0',
  text:'#e6edf3',textMuted:'#7d8590',textDim:'#484f58',white:'#ffffff',
  takeoff:'#ff6b57',landing:'#2fd89b',
}

const PLAYBACK_FPS = 30
const CAPTURE_OPTIONS = [
  { fps: 240, label: '240 fps (8× slow-mo)' },
  { fps: 120, label: '120 fps (4× slow-mo)' },
  { fps: 60, label: '60 fps (2× slow-mo)' },
  { fps: 30, label: '30 fps (real time)' },
]
const RATES = [1, 0.5, 0.25]
const TICK_STEPS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]
const G = 9.81

type Jump = { id: number; takeoff: number; landing: number; flightSec: number; heightIn: number }

const inToCm = (i: number) => i * 2.54
const fmtClock = (s: number, decimals = 0) => {
  const m = Math.floor(s / 60)
  const sec = s - m * 60
  return `${m}:${sec.toFixed(decimals).padStart(decimals ? decimals + 3 : 2, '0')}`
}

export default function JumpVideoTool() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const urlRef = useRef<string | null>(null)
  const rafRef = useRef<number | null>(null)
  const draggingRef = useRef(false)

  const [src, setSrc] = useState<string | null>(null)
  const [loadError, setLoadError] = useState('')
  const [duration, setDuration] = useState(0)
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [rate, setRate] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [viewW, setViewW] = useState(0)
  const [captureFps, setCaptureFps] = useState(240)
  const [takeoff, setTakeoff] = useState<number | null>(null)
  const [landing, setLanding] = useState<number | null>(null)
  const [jumps, setJumps] = useState<Jump[]>([])
  const nextId = useRef(1)

  const slowMo = captureFps / PLAYBACK_FPS

  // ---- derived jump numbers -------------------------------------------------------------
  const pair = useMemo(() => {
    if (takeoff == null || landing == null || landing <= takeoff) return null
    const flightSec = (landing - takeoff) / slowMo
    return { flightSec, heightIn: calcJumpHeight(0, flightSec) }
  }, [takeoff, landing, slowMo])

  // Height at the playhead along the flight parabola: h(τ) = ½·g·τ·(T − τ), real-time τ.
  const currentHeightIn = useMemo(() => {
    if (!pair || takeoff == null || landing == null || t < takeoff || t > landing) return 0
    const tau = (t - takeoff) / slowMo
    return 0.5 * G * tau * (pair.flightSec - tau) * 39.3701
  }, [pair, takeoff, landing, t, slowMo])

  const implausible = pair != null && (pair.heightIn < 3 || pair.heightIn > 40)

  // ---- video plumbing -------------------------------------------------------------------
  const sync = useCallback(() => {
    const v = videoRef.current
    if (v) setT(v.currentTime)
  }, [])

  const seek = useCallback((time: number) => {
    const v = videoRef.current
    if (!v) return
    const clamped = Math.max(0, Math.min(v.duration || 0, time))
    v.currentTime = clamped
    setT(clamped)
  }, [])

  // Land mid-frame so the browser doesn't round to the neighbouring frame.
  const stepFrames = useCallback((n: number) => {
    const v = videoRef.current
    if (!v) return
    v.pause()
    const frame = Math.floor(v.currentTime * PLAYBACK_FPS + 1e-6) + n
    seek((frame + 0.5) / PLAYBACK_FPS)
  }, [seek])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play().catch(() => {})
    else v.pause()
  }, [])

  const loadFile = useCallback((file: File) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    const url = URL.createObjectURL(file)
    urlRef.current = url
    setLoadError('')
    setTakeoff(null); setLanding(null); setJumps([]); setT(0); setDuration(0); setPlaying(false)
    setSrc(url)
  }, [])

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
  }, [])

  useEffect(() => {
    const v = videoRef.current
    if (v) v.playbackRate = rate
  }, [rate, src])

  // rAF loop only while playing, so the playhead is smooth without re-rendering at idle.
  useEffect(() => {
    if (!playing) return
    const loop = () => { sync(); rafRef.current = requestAnimationFrame(loop) }
    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current) }
  }, [playing, sync])

  // Arrow keys step frames (unless the user is typing / using a select).
  useEffect(() => {
    if (!src) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); stepFrames(e.shiftKey ? -10 : -1) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); stepFrames(e.shiftKey ? 10 : 1) }
      else if (e.key === ' ') { e.preventDefault(); togglePlay() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [src, stepFrames, togglePlay])

  // ---- timeline geometry ----------------------------------------------------------------
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setViewW(el.clientWidth))
    ro.observe(el)
    setViewW(el.clientWidth)
    return () => ro.disconnect()
  }, [src])

  const innerW = Math.max(viewW, viewW * zoom)
  const pxPerSec = duration > 0 ? innerW / duration : 0
  const xOf = (time: number) => time * pxPerSec

  const ticks = useMemo(() => {
    if (!pxPerSec) return []
    const step = TICK_STEPS.find(s => s * pxPerSec >= 80) ?? TICK_STEPS[TICK_STEPS.length - 1]
    const out: { time: number; label: string }[] = []
    for (let time = 0; time <= duration; time += step) out.push({ time, label: fmtClock(time, step < 1 ? 1 : 0) })
    return out
  }, [pxPerSec, duration])

  // Keep the playhead visible when zoomed.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || zoom <= 1 || !pxPerSec) return
    const x = t * pxPerSec
    if (x < el.scrollLeft + 24 || x > el.scrollLeft + el.clientWidth - 24) {
      el.scrollLeft = x - el.clientWidth / 2
    }
  }, [t, zoom, pxPerSec])

  const timeFromPointer = (clientX: number) => {
    const el = scrollRef.current
    if (!el || !pxPerSec) return 0
    const rect = el.getBoundingClientRect()
    return (clientX - rect.left + el.scrollLeft) / pxPerSec
  }
  const onTimelineDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!src) return
    draggingRef.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    videoRef.current?.pause()
    seek(timeFromPointer(e.clientX))
  }
  const onTimelineMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current) seek(timeFromPointer(e.clientX))
  }
  const onTimelineUp = () => { draggingRef.current = false }

  // ---- jump log -------------------------------------------------------------------------
  const logJump = () => {
    if (!pair || takeoff == null || landing == null) return
    const existing = jumps.find(j => Math.abs(j.takeoff - takeoff) < 1e-3)
    const entry: Jump = { id: existing?.id ?? nextId.current++, takeoff, landing, flightSec: pair.flightSec, heightIn: pair.heightIn }
    setJumps(prev => existing ? prev.map(j => j.id === existing.id ? entry : j) : [...prev, entry])
  }
  const viewJump = (j: Jump) => { setTakeoff(j.takeoff); setLanding(j.landing); videoRef.current?.pause(); seek(j.takeoff) }
  const removeJump = (id: number) => setJumps(prev => prev.filter(j => j.id !== id))

  const stats = useMemo(() => {
    if (!jumps.length) return null
    const hs = jumps.map(j => j.heightIn)
    const avg = hs.reduce((a, b) => a + b, 0) / hs.length
    const best = Math.max(...hs)
    return { avg, best, spread: best - Math.min(...hs), bestId: jumps.find(j => j.heightIn === best)!.id }
  }, [jumps])

  const viewingId = jumps.find(j => takeoff != null && landing != null && Math.abs(j.takeoff - takeoff) < 1e-3 && Math.abs(j.landing - landing) < 1e-3)?.id

  // ---- styles ---------------------------------------------------------------------------
  const ctl: React.CSSProperties = { background: C.bg3, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, minWidth: 40, height: 40, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 10px' }
  const chip = (color: string): React.CSSProperties => ({ border: `1px solid ${color}55`, color, borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' })
  const bigBtn = (bg: string, fg = '#0d1117'): React.CSSProperties => ({ background: bg, color: fg, border: 'none', borderRadius: 10, padding: '12px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' })
  const hasVideo = !!src && duration > 0
  const frameNo = Math.floor(t * PLAYBACK_FPS + 1e-6)

  return (
    <div>
      <input ref={fileRef} type="file" accept="video/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = '' }} />

      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
        {/* Video + live readouts */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px 10px', minHeight: 220 }}>
          <div style={{ width: 92, flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: C.textMuted }}>Current Height</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: currentHeightIn > 0 ? C.cyan : C.white, marginBottom: 14 }}>
              {currentHeightIn.toFixed(1)} in <span style={{ color: C.textMuted, fontWeight: 400, fontSize: 11 }}>({inToCm(currentHeightIn).toFixed(1)} cm)</span>
            </div>
            <div style={{ fontSize: 10, color: C.textMuted }}>Peak Jump</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.white }}>
              {pair ? <>{pair.heightIn.toFixed(1)} in <span style={{ color: C.textMuted, fontWeight: 400, fontSize: 11 }}>({inToCm(pair.heightIn).toFixed(1)} cm)</span></> : '—'}
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }}>
            {src ? (
              <div style={{ position: 'relative', lineHeight: 0 }}>
                <video
                  ref={videoRef} src={src} playsInline muted preload="auto"
                  style={{ maxHeight: '52vh', maxWidth: '100%', background: '#000', borderRadius: 4 }}
                  onLoadedMetadata={e => { setDuration(e.currentTarget.duration); e.currentTarget.playbackRate = rate }}
                  onTimeUpdate={sync} onSeeked={sync}
                  onPlay={() => setPlaying(true)} onPause={() => { setPlaying(false); sync() }}
                  onEnded={() => setPlaying(false)}
                  onError={e => {
                    const code = e.currentTarget.error?.code
                    setLoadError(`Couldn't load this video (error ${code ?? '?'}). This browser may not decode the format — iPhone HEVC clips often fail on desktop Chrome/Firefox; try Safari or export as H.264.`)
                    setSrc(null)
                  }}
                />
                {hasVideo && (
                  <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 6, lineHeight: 1 }}>
                    <span style={{ background: 'rgba(13,17,23,0.82)', color: C.white, borderRadius: 14, padding: '5px 9px', fontSize: 11, fontWeight: 600 }}>{t.toFixed(3)} s</span>
                    <span style={{ background: 'rgba(13,17,23,0.82)', color: C.white, borderRadius: 14, padding: '5px 9px', fontSize: 11, fontWeight: 600 }}>Frame {frameNo}</span>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) loadFile(f) }}
                style={{ width: '100%', maxWidth: 320, border: `2px dashed ${C.border}`, background: 'transparent', color: C.textMuted, borderRadius: 14, padding: '40px 16px', cursor: 'pointer', fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🎥</div>
                <div style={{ color: C.white, fontWeight: 700, marginBottom: 4 }}>Choose a jump video</div>
                <div style={{ fontSize: 11, lineHeight: 1.5 }}>Film from the side at 240 fps, hands on hips, full body in frame.</div>
              </button>
            )}
          </div>
        </div>

        {loadError && <div style={{ margin: '0 14px 10px', color: C.red, fontSize: 12, padding: '8px 10px', background: 'rgba(248,81,73,0.1)', borderRadius: 8 }}>{loadError}</div>}

        {/* Timeline */}
        <div style={{ borderTop: `1px solid ${C.border}`, background: '#0b1220', opacity: hasVideo ? 1 : 0.45 }}>
          <div ref={scrollRef} style={{ overflowX: zoom > 1 ? 'auto' : 'hidden', overflowY: 'hidden', scrollbarWidth: 'thin' }}>
            <div
              onPointerDown={onTimelineDown} onPointerMove={onTimelineMove} onPointerUp={onTimelineUp} onPointerCancel={onTimelineUp}
              style={{ position: 'relative', width: innerW || '100%', height: 120, cursor: hasVideo ? 'ew-resize' : 'default', touchAction: 'pan-y', userSelect: 'none' }}>
              {/* baseline */}
              <div style={{ position: 'absolute', left: 0, right: 0, top: 96, height: 1, background: C.border }} />
              {ticks.map(k => (
                <div key={k.time} style={{ position: 'absolute', left: xOf(k.time), top: 96, pointerEvents: 'none' }}>
                  <div style={{ width: 1, height: 5, background: C.border }} />
                  <div style={{ fontSize: 10, color: C.textDim, transform: 'translateX(-50%)', marginTop: 6, whiteSpace: 'nowrap' }}>{k.label}</div>
                </div>
              ))}

              {/* flight window + parabola */}
              {pair && takeoff != null && landing != null && (
                <>
                  <div style={{ position: 'absolute', left: xOf(takeoff), width: xOf(landing) - xOf(takeoff), top: 26, height: 70, background: 'rgba(61,217,240,0.10)', pointerEvents: 'none' }} />
                  <svg style={{ position: 'absolute', left: xOf(takeoff), top: 26, pointerEvents: 'none' }} width={Math.max(1, xOf(landing) - xOf(takeoff))} height={70} viewBox="0 0 100 70" preserveAspectRatio="none">
                    <path d="M0 70 Q50 -30 100 70" fill="none" stroke={C.cyan} strokeWidth={2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
                  </svg>
                </>
              )}

              {/* markers */}
              {takeoff != null && (
                <Marker x={xOf(takeoff)} color={C.takeoff} label="Takeoff" align="right" />
              )}
              {landing != null && (
                <Marker x={xOf(landing)} color={C.landing} label="Landing" align="left" />
              )}

              {/* playhead */}
              {hasVideo && (
                <div style={{ position: 'absolute', left: xOf(t), top: 10, height: 86, pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', left: -5, top: 0, width: 10, height: 10, borderRadius: '50%', background: C.white }} />
                  <div style={{ position: 'absolute', left: -1, top: 8, width: 2, height: 78, background: C.white }} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Transport controls */}
        <div style={{ borderTop: `1px solid ${C.border}`, padding: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', opacity: hasVideo ? 1 : 0.45, pointerEvents: hasVideo ? 'auto' : 'none' }}>
          <button style={{ ...ctl, background: C.text, color: C.bg }} onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>{playing ? '❚❚' : '▶'}</button>
          <button style={ctl} onClick={() => stepFrames(-10)} aria-label="Back 10 frames">«</button>
          <button style={ctl} onClick={() => stepFrames(-1)} aria-label="Back 1 frame">‹</button>
          <button style={ctl} onClick={() => stepFrames(1)} aria-label="Forward 1 frame">›</button>
          <button style={ctl} onClick={() => stepFrames(10)} aria-label="Forward 10 frames">»</button>
          <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
            {RATES.map(r => (
              <button key={r} onClick={() => setRate(r)} style={{ ...ctl, border: 'none', borderRadius: 0, height: 40, fontSize: 12, background: rate === r ? C.cyan : C.bg3, color: rate === r ? C.bg : C.textMuted, fontWeight: rate === r ? 700 : 400 }}>{r}×</button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 160px', minWidth: 160 }}>
            <button style={ctl} onClick={() => setZoom(z => Math.max(1, +(z - 1).toFixed(1)))} aria-label="Zoom out">−</button>
            <input type="range" min={1} max={30} step={0.1} value={zoom} onChange={e => setZoom(parseFloat(e.target.value))} style={{ flex: 1, accentColor: C.cyan }} aria-label="Timeline zoom" />
            <button style={ctl} onClick={() => setZoom(z => Math.min(30, +(z + 1).toFixed(1)))} aria-label="Zoom in">+</button>
            <span style={{ fontSize: 11, color: C.textMuted, width: 34 }}>{zoom.toFixed(1)}×</span>
          </div>
        </div>

        {/* Marker actions */}
        <div style={{ borderTop: `1px solid ${C.border}`, padding: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', opacity: hasVideo ? 1 : 0.45, pointerEvents: hasVideo ? 'auto' : 'none' }}>
          <button style={bigBtn(C.takeoff)} onClick={() => setTakeoff(videoRef.current?.currentTime ?? t)}>Set takeoff</button>
          <button style={bigBtn(C.landing)} onClick={() => setLanding(videoRef.current?.currentTime ?? t)}>Set landing</button>
          <button style={{ ...bigBtn(C.cyan), opacity: pair ? 1 : 0.4 }} disabled={!pair} onClick={logJump}>+ Log Jump</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={chip(C.takeoff)}>Takeoff: {takeoff != null ? `${takeoff.toFixed(3)} s` : '—'}</span>
            <span style={chip(C.landing)}>Landing: {landing != null ? `${landing.toFixed(3)} s` : '—'}</span>
          </div>
        </div>

        {/* Capture speed */}
        <div style={{ borderTop: `1px solid ${C.border}`, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label htmlFor="jv-fps" style={{ fontSize: 12, fontWeight: 700, color: C.white }}>Capture speed</label>
            <select id="jv-fps" value={captureFps} onChange={e => setCaptureFps(parseInt(e.target.value))}
              style={{ background: C.bg3, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 10px', fontSize: 12 }}>
              {CAPTURE_OPTIONS.map(o => <option key={o.fps} value={o.fps}>{o.label}</option>)}
            </select>
            <button onClick={() => fileRef.current?.click()} style={{ marginLeft: 'auto', background: 'transparent', color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 12, cursor: 'pointer' }}>
              {src ? 'Choose another video' : 'Choose video'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.5, marginTop: 8 }}>
            Video plays back at about {PLAYBACK_FPS} frames per second. Step ← → (Shift for 10 frames) to land on the last frame with both feet on the floor, then the first frame feet touch down.
          </div>
          {implausible && pair && (
            <div style={{ fontSize: 12, color: C.gold, marginTop: 8, padding: '8px 10px', background: 'rgba(232,184,75,0.1)', borderRadius: 8 }}>
              {pair.heightIn.toFixed(1)} in looks off for a vertical jump. Check the capture speed matches how the clip was filmed, and that both markers sit on the right frames.
            </div>
          )}
        </div>
      </div>

      {/* Session summary */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.white }}>Session summary</div>
          <button onClick={() => { setJumps([]); setTakeoff(null); setLanding(null) }} disabled={!jumps.length && takeoff == null && landing == null}
            style={{ background: 'transparent', color: C.textMuted, border: `1px solid ${C.border}`, borderRadius: 8, padding: '7px 12px', fontSize: 12, cursor: 'pointer' }}>Reset all</button>
        </div>

        {stats ? (
          <>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>Avg jump height</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 22, flexWrap: 'wrap', paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 52, fontWeight: 800, color: C.white, letterSpacing: '-2px', lineHeight: 1 }}>{stats.avg.toFixed(1)}<span style={{ fontSize: 16, color: C.textMuted, fontWeight: 500, letterSpacing: 0 }}> in</span></div>
              <div>
                <div style={{ fontSize: 10, color: C.textMuted }}>Metric</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: C.white, letterSpacing: '-1px', lineHeight: 1.1 }}>{inToCm(stats.avg).toFixed(1)}<span style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}> cm</span></div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, padding: '14px 0' }}>
              <Stat label="Jumps logged" value={String(jumps.length)} />
              <Stat label="Best jump" value={`${stats.best.toFixed(1)}`} unit="in" sub={`${inToCm(stats.best).toFixed(1)} cm`} />
              <Stat label="Spread, best to lowest" value={stats.spread.toFixed(1)} unit="in" sub={`${inToCm(stats.spread).toFixed(1)} cm`} />
            </div>

            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
              {jumps.map((j, i) => {
                const isBest = j.id === stats.bestId
                const viewing = j.id === viewingId
                return (
                  <div key={j.id} role="button" tabIndex={0} onClick={() => viewJump(j)} onKeyDown={e => { if (e.key === 'Enter') viewJump(j) }}
                    style={{ flex: '1 0 150px', minWidth: 150, background: '#0b1220', border: `${viewing ? 2 : 1}px solid ${viewing ? C.cyan : C.border}`, borderRadius: 10, padding: 10, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, minHeight: 18 }}>
                      <span style={{ fontSize: 11, color: C.textMuted }}>Jump {i + 1}</span>
                      {isBest && <Badge text="Best" />}
                      {viewing && <Badge text="Viewing" />}
                      <button onClick={e => { e.stopPropagation(); removeJump(j.id) }} aria-label={`Remove jump ${i + 1}`}
                        style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
                    </div>
                    <div style={{ height: 34, background: C.bg3, borderRadius: 4, marginBottom: 8, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.max(8, (j.heightIn / stats.best) * 100)}%`, background: C.cyan }} />
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: C.white }}>{j.heightIn.toFixed(1)}<span style={{ fontSize: 10, color: C.textMuted, fontWeight: 500 }}> in</span></div>
                    <div style={{ fontSize: 11, color: C.textMuted }}>{inToCm(j.heightIn).toFixed(1)} cm</div>
                    <div style={{ fontSize: 10, color: C.textDim }}>{j.flightSec.toFixed(3)} s flight</div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: C.textDim, padding: '14px 0' }}>No jumps logged yet. Set takeoff and landing, then tap Log Jump. Log 3 or more for a reliable average.</div>
        )}

        <div style={{ fontSize: 11, color: C.textDim, marginTop: 10, padding: '8px 10px', background: '#0b1220', borderRadius: 8 }}>
          Each jump: Height = (9.81 × Real Flight Time²) ÷ 8. Real Flight Time = video time ÷ {slowMo}. Average = mean of all logged heights. Hands on hips for every jump so arm swing doesn&apos;t inflate the number.
        </div>
      </div>
    </div>
  )
}

function Marker({ x, color, label, align }: { x: number; color: string; label: string; align: 'left' | 'right' }) {
  return (
    <div style={{ position: 'absolute', left: x, top: 0, height: 100, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: 4, [align === 'right' ? 'right' : 'left']: 4, background: color, color: '#0d1117', fontSize: 10, fontWeight: 800, borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ position: 'absolute', left: -1, top: 22, width: 2, height: 74, background: color }} />
      <div style={{ position: 'absolute', left: -6, top: 90, width: 12, height: 12, borderRadius: '50%', background: color, border: '2px solid #0b1220', boxSizing: 'border-box' }} />
    </div>
  )
}

function Stat({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.white }}>{value}{unit && <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 500 }}> {unit}</span>}</div>
      {sub && <div style={{ fontSize: 10, color: C.textDim }}>{sub}</div>}
    </div>
  )
}

function Badge({ text }: { text: string }) {
  return <span style={{ background: 'rgba(61,217,240,0.18)', color: C.cyan, border: `1px solid ${C.cyan}66`, borderRadius: 10, padding: '1px 7px', fontSize: 9, fontWeight: 700 }}>{text}</span>
}
