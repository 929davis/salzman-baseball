'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { validateHopSequence, calcHopMetrics, summarizeHopTest, type HopEntry } from '@/lib/hopTest'
import { validatePlyoPushupSequence, calcPlyoPushupMetrics, summarizePlyoPushupTest, type PlyoPushupInput } from '@/lib/plyoPushup'

// Frame-stepped video tool for the two repeated-rep tests (Hop Test, Plyo Push-Up). The athlete
// steps through the clip and taps "Mark" for each moment in order; the tool draws contact bands
// and flight arcs on a timeline, computes the same metrics the panels do (lib/hopTest.ts,
// lib/plyoPushup.ts), and fills the panel's form with real-time seconds.
//
// Marker order
//   hop:    landing, takeoff, landing, takeoff, ...           (landing = ground contact start)
//   pushup: contact, [bottom], leave, contact, [bottom], leave, ..., contact   (the last contact
//           is the landing that ends the final rep's flight)
// Slow-mo: marker times are VIDEO time; real time = video time / slowMo (same as JumpVideoTool).

const C = {
  bg:'#0d1117',bg2:'#161b22',bg3:'#1c2333',panel:'#101826',deep:'#0b1220',border:'#30363d',
  gold:'#e8b84b',teal:'#39d353',red:'#f85149',blue:'#58a6ff',cyan:'#3dd9f0',orange:'#ff9f43',
  text:'#e6edf3',textMuted:'#7d8590',textDim:'#484f58',white:'#ffffff',
}

const PLAYBACK_FPS = 30
const CAPTURE_OPTIONS = [
  { fps: 480, label: '480 fps (16× slow-mo)' },
  { fps: 240, label: '240 fps (8× slow-mo)' },
  { fps: 120, label: '120 fps (4× slow-mo)' },
  { fps: 60, label: '60 fps (2× slow-mo)' },
  { fps: 30, label: '30 fps (real time)' },
]
const RATES = [1, 0.5, 0.25]
const TICK_STEPS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]
const APEX_MAX = 52

export type HopFormFill = { fps: string; rows: { landingTime: string; takeoffTime: string }[] }
export type PushupFormFill = {
  fps: string
  rows: { contactTime: string; bottomTime: string; leaveTime: string }[]
  finalContactTime: string
  stabilizationTime: string
}
// Past saved results for the comparison strip: avg RSI (hop) or avg flight time in seconds (push-up).
export type RepHistoryEntry = { date: string; value: number }

type Props =
  | { kind: 'hop'; history?: RepHistoryEntry[]; onApply: (f: HopFormFill) => void }
  | { kind: 'pushup'; history?: RepHistoryEntry[]; onApply: (f: PushupFormFill) => void }

type Seg = { from: number; to: number; role: 'contact' | 'lower' | 'push' | 'flight'; sec: number; heightIn?: number }

const ms = (s: number) => `${Math.round(s * 1000)} ms`
const real = (v: number, slowMo: number) => v / slowMo
const fmtSec = (v: number, slowMo: number) => (v / slowMo).toFixed(4)
const clock = (s: number, d: number) => `${s.toFixed(d)}s`

export default function RepVideoTool(props: Props) {
  const { kind } = props
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
  const [marks, setMarks] = useState<number[]>([])
  const [stabT, setStabT] = useState<number | null>(null)
  const [includeBottom, setIncludeBottom] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const slowMo = captureFps / PLAYBACK_FPS
  const step = kind === 'pushup' ? (includeBottom ? 3 : 2) : 2

  // ---- labels / roles for each marker index ---------------------------------------------
  const labelOf = useCallback((i: number) => {
    if (kind === 'hop') return `Hop ${Math.floor(i / 2) + 1} ${i % 2 === 0 ? 'landing' : 'takeoff'}`
    const r = Math.floor(i / step) + 1, p = i % step
    if (p === 0) return i === 0 ? 'Rep 1 hands touch ground' : `Rep ${r} contact (landing from rep ${r - 1})`
    if (includeBottom && p === 1) return `Rep ${r} bottom of dip`
    return `Rep ${r} hands leave ground`
  }, [kind, step, includeBottom])

  const roleColor = useCallback((i: number) => {
    if (kind === 'hop') return i % 2 === 0 ? C.orange : C.teal
    const p = i % step
    if (p === 0) return C.orange
    if (includeBottom && p === 1) return C.blue
    return C.teal
  }, [kind, step, includeBottom])

  // ---- segments (video time) for the timeline -------------------------------------------
  const segs = useMemo<Seg[]>(() => {
    const out: Seg[] = []
    const n = marks.length
    if (kind === 'hop') {
      for (let i = 0; 2 * i + 1 < n; i++) {
        const L = marks[2 * i], T = marks[2 * i + 1], nextL = marks[2 * i + 2]
        out.push({ from: L, to: T, role: 'contact', sec: real(T - L, slowMo) })
        if (nextL != null) {
          const f = real(nextL - T, slowMo)
          out.push({ from: T, to: nextL, role: 'flight', sec: f, heightIn: (9.81 * f * f) / 8 * 39.3701 })
        }
      }
    } else {
      const k = Math.floor(n / step)
      for (let r = 0; r < k; r++) {
        const base = r * step
        const Ct = marks[base], Lv = marks[base + step - 1], Nx = marks[(r + 1) * step]
        if (includeBottom) {
          const B = marks[base + 1]
          out.push({ from: Ct, to: B, role: 'lower', sec: real(B - Ct, slowMo) })
          out.push({ from: B, to: Lv, role: 'push', sec: real(Lv - B, slowMo) })
        } else {
          out.push({ from: Ct, to: Lv, role: 'contact', sec: real(Lv - Ct, slowMo) })
        }
        if (Nx != null) {
          const f = real(Nx - Lv, slowMo)
          out.push({ from: Lv, to: Nx, role: 'flight', sec: f, heightIn: (9.81 * f * f) / 8 * 39.3701 })
        }
      }
    }
    return out
  }, [marks, kind, step, includeBottom, slowMo])

  // ---- metrics from the existing libs (real seconds) ------------------------------------
  const hopData = useMemo(() => {
    if (kind !== 'hop') return null
    const hops: HopEntry[] = []
    for (let i = 0; 2 * i + 1 < marks.length; i++) {
      hops.push({ landingTime: real(marks[2 * i], slowMo), takeoffTime: real(marks[2 * i + 1], slowMo) })
    }
    if (!hops.length) return null
    const err = validateHopSequence(hops)
    if (err) return { hops, err, metrics: null, summary: null }
    const metrics = calcHopMetrics(hops)
    return { hops, err: null, metrics, summary: summarizeHopTest(metrics) }
  }, [kind, marks, slowMo])

  const pushData = useMemo(() => {
    if (kind !== 'pushup') return null
    const k = Math.floor(marks.length / step)
    const finalRaw = marks[k * step]
    if (k < 1 || finalRaw == null) return null
    const reps = Array.from({ length: k }, (_, r) => {
      const base = r * step
      return {
        contactTime: real(marks[base], slowMo),
        bottomTime: includeBottom ? real(marks[base + 1], slowMo) : undefined,
        leaveTime: real(marks[base + step - 1], slowMo),
      }
    })
    const input: PlyoPushupInput = {
      reps, finalContactTime: real(finalRaw, slowMo),
      stabilizationTime: stabT != null ? real(stabT, slowMo) : undefined,
    }
    const err = validatePlyoPushupSequence(input)
    if (err) return { input, err, metrics: null, summary: null }
    const metrics = calcPlyoPushupMetrics(input)
    return { input, err: null, metrics, summary: summarizePlyoPushupTest(metrics, input.stabilizationTime, input.finalContactTime) }
  }, [kind, marks, step, includeBottom, stabT, slowMo])

  const primary = kind === 'hop' ? hopData?.summary?.avgRsi : pushData?.summary?.avgFlightSec
  const compare = useMemo(() => {
    const valid = (props.history ?? []).filter(h => Number.isFinite(h.value) && h.value > 0)
    if (!valid.length) return null
    const byDateDesc = [...valid].sort((a, b) => b.date.localeCompare(a.date))
    return { best: valid.reduce((a, b) => (b.value > a.value ? b : a)), last: byDateDesc[0] }
  }, [props.history])
  const fmtPrimary = (v: number) => (kind === 'hop' ? v.toFixed(2) : `${Math.round(v * 1000)} ms`)
  const fmtDelta = (d: number) => `${d >= 0 ? '+' : '−'}${kind === 'hop' ? Math.abs(d).toFixed(2) : `${Math.round(Math.abs(d) * 1000)} ms`}`

  const sanity =
    kind === 'hop' && hopData?.summary && hopData.summary.avgGroundContactSec > 0.8
      ? 'Average ground contact over 0.8 s is unusually long for hops. Check the capture speed matches how the clip was filmed.'
      : kind === 'pushup' && pushData?.summary && pushData.summary.avgFlightSec > 1.0
        ? 'Average flight over 1 s is unusually long for a push-up. Check the capture speed matches how the clip was filmed.'
        : ''

  // ---- video plumbing (same behaviour as JumpVideoTool) ---------------------------------
  const sync = useCallback(() => { const v = videoRef.current; if (v) setT(v.currentTime) }, [])
  const seek = useCallback((time: number) => {
    const v = videoRef.current
    if (!v) return
    const c = Math.max(0, Math.min(v.duration || 0, time))
    v.currentTime = c
    setT(c)
  }, [])
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
    setLoadError(''); setMarks([]); setStabT(null); setMsg(null); setT(0); setDuration(0); setPlaying(false)
    setSrc(url)
  }, [])

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
  }, [])
  useEffect(() => { const v = videoRef.current; if (v) v.playbackRate = rate }, [rate, src])
  useEffect(() => {
    if (!playing) return
    const loop = () => { sync(); rafRef.current = requestAnimationFrame(loop) }
    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current) }
  }, [playing, sync])
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
    const s = TICK_STEPS.find(v => v * pxPerSec >= 80) ?? TICK_STEPS[TICK_STEPS.length - 1]
    const out: { time: number; label: string }[] = []
    for (let time = 0; time <= duration + 1e-9; time += s) out.push({ time, label: clock(time, s < 1 ? 1 : 0) })
    return out
  }, [pxPerSec, duration])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || zoom <= 1 || !pxPerSec) return
    const x = t * pxPerSec
    if (x < el.scrollLeft + 24 || x > el.scrollLeft + el.clientWidth - 24) el.scrollLeft = x - el.clientWidth / 2
  }, [t, zoom, pxPerSec])

  const timeFromPointer = (clientX: number) => {
    const el = scrollRef.current
    if (!el || !pxPerSec) return 0
    const r = el.getBoundingClientRect()
    return (clientX - r.left + el.scrollLeft) / pxPerSec
  }
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!src) return
    draggingRef.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    videoRef.current?.pause()
    seek(timeFromPointer(e.clientX))
  }
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => { if (draggingRef.current) seek(timeFromPointer(e.clientX)) }
  const onUp = () => { draggingRef.current = false }

  // ---- marking --------------------------------------------------------------------------
  const nowT = () => videoRef.current?.currentTime ?? t
  const markNext = () => {
    const cur = nowT()
    const last = marks[marks.length - 1]
    if (last != null && cur <= last + 1e-6) {
      setMsg({ ok: false, text: 'Each marker has to come after the one before it. Step forward and mark again.' })
      return
    }
    setMarks(m => [...m, cur]); setMsg(null)
  }
  const undo = () => { setMarks(m => m.slice(0, -1)); setMsg(null) }
  const resetRow = (i: number) => {
    const cur = nowT()
    const prev = marks[i - 1], next = marks[i + 1]
    if ((prev != null && cur <= prev) || (next != null && cur >= next)) {
      setMsg({ ok: false, text: `${labelOf(i)} has to sit between the markers on either side of it.` })
      return
    }
    setMarks(m => m.map((v, j) => (j === i ? cur : v))); setMsg(null)
  }
  const toggleBottom = () => {
    if (marks.length > 0 && !window.confirm('Changing this clears the markers you have set. Continue?')) return
    setMarks([]); setStabT(null); setIncludeBottom(b => !b); setMsg(null)
  }

  const apply = () => {
    if (kind === 'hop' && props.kind === 'hop') {
      if (!hopData || hopData.hops.length < 2) { setMsg({ ok: false, text: 'Mark at least 2 hops (landing and takeoff for each). RSI needs a following landing.' }); return }
      if (hopData.err) { setMsg({ ok: false, text: hopData.err }); return }
      props.onApply({
        fps: String(captureFps),
        rows: hopData.hops.map((h, i) => ({ landingTime: fmtSec(marks[2 * i], slowMo), takeoffTime: fmtSec(marks[2 * i + 1], slowMo) })),
      })
    } else if (props.kind === 'pushup') {
      if (!pushData) { setMsg({ ok: false, text: 'Mark at least one full rep, then one more contact for the final landing.' }); return }
      if (pushData.err) { setMsg({ ok: false, text: pushData.err }); return }
      const k = pushData.input.reps.length
      props.onApply({
        fps: String(captureFps),
        rows: Array.from({ length: k }, (_, r) => {
          const base = r * step
          return {
            contactTime: fmtSec(marks[base], slowMo),
            bottomTime: includeBottom ? fmtSec(marks[base + 1], slowMo) : '',
            leaveTime: fmtSec(marks[base + step - 1], slowMo),
          }
        }),
        finalContactTime: fmtSec(marks[k * step], slowMo),
        stabilizationTime: stabT != null ? fmtSec(stabT, slowMo) : '',
      })
    }
    setMsg({ ok: true, text: `Times sent to the form below. Review them and tap Calculate.` })
  }

  // ---- styles ---------------------------------------------------------------------------
  const hasVideo = !!src && duration > 0
  const ctl: React.CSSProperties = { background: C.bg3, border: `1px solid ${C.border}`, color: C.text, borderRadius: 8, minWidth: 40, height: 40, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 10px' }
  const bigBtn = (bg: string, fg = '#0d1117'): React.CSSProperties => ({ background: bg, color: fg, border: 'none', borderRadius: 10, padding: '12px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' })
  const roleFill: Record<Seg['role'], string> = { contact: C.orange, lower: C.blue, push: C.teal, flight: C.cyan }
  const flights = segs.filter(s => s.role === 'flight')
  const maxFlight = Math.max(...flights.map(f => f.sec), 1e-9)
  const nextLabel = labelOf(marks.length)
  const frameNo = Math.floor(t * PLAYBACK_FPS + 1e-6)
  const title = kind === 'hop' ? 'Hop test' : 'Plyo push-up'

  return (
    <div style={{ marginBottom: 12 }}>
      <input ref={fileRef} type="file" accept="video/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = '' }} />

      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
        {/* Video */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 14px 10px', minHeight: 200 }}>
          {src ? (
            <div style={{ position: 'relative', lineHeight: 0 }}>
              <video ref={videoRef} src={src} playsInline muted preload="auto"
                style={{ maxHeight: '48vh', maxWidth: '100%', background: '#000', borderRadius: 4 }}
                onLoadedMetadata={e => { setDuration(e.currentTarget.duration); e.currentTarget.playbackRate = rate }}
                onTimeUpdate={sync} onSeeked={sync}
                onPlay={() => setPlaying(true)} onPause={() => { setPlaying(false); sync() }} onEnded={() => setPlaying(false)}
                onError={e => {
                  setLoadError(`Couldn't load this video (error ${e.currentTarget.error?.code ?? '?'}). This browser may not decode the format. iPhone HEVC clips often fail on desktop Chrome/Firefox; try Safari or export as H.264.`)
                  setSrc(null)
                }} />
              {hasVideo && (
                <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 6, lineHeight: 1 }}>
                  <span style={{ background: 'rgba(13,17,23,0.82)', color: C.white, borderRadius: 14, padding: '5px 9px', fontSize: 11, fontWeight: 600 }}>{t.toFixed(3)} s</span>
                  <span style={{ background: 'rgba(13,17,23,0.82)', color: C.white, borderRadius: 14, padding: '5px 9px', fontSize: 11, fontWeight: 600 }}>Frame {frameNo}</span>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) loadFile(f) }}
              style={{ width: '100%', maxWidth: 320, border: `2px dashed ${C.border}`, background: 'transparent', color: C.textMuted, borderRadius: 14, padding: '36px 16px', cursor: 'pointer', fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🎥</div>
              <div style={{ color: C.white, fontWeight: 700, marginBottom: 4 }}>Choose a {title.toLowerCase()} video</div>
              <div style={{ fontSize: 11, lineHeight: 1.5 }}>Film at 240 fps with the whole body in frame. Mark each moment in order.</div>
            </button>
          )}
        </div>
        {loadError && <div style={{ margin: '0 14px 10px', color: C.red, fontSize: 12, padding: '8px 10px', background: 'rgba(248,81,73,0.1)', borderRadius: 8 }}>{loadError}</div>}

        {/* Comparison with saved tests */}
        {compare && (
          <div style={{ borderTop: `1px solid ${C.border}`, padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            <Cell label={kind === 'hop' ? 'This test · avg RSI' : 'This test · avg flight'} value={primary != null ? fmtPrimary(primary) : '—'} sub={primary != null ? 'from your markers' : 'mark a few reps'} color={C.cyan} />
            <Cell label="Your best" value={fmtPrimary(compare.best.value)} sub={compare.best.date} delta={primary != null ? fmtDelta(primary - compare.best.value) : null} up={primary != null && primary - compare.best.value >= 0} color={C.gold} />
            <Cell label="Last test" value={fmtPrimary(compare.last.value)} sub={compare.last.date} delta={primary != null ? fmtDelta(primary - compare.last.value) : null} up={primary != null && primary - compare.last.value >= 0} color={C.textMuted} />
          </div>
        )}

        {/* Timeline */}
        <div style={{ borderTop: `1px solid ${C.border}`, background: C.deep, opacity: hasVideo ? 1 : 0.45 }}>
          <div ref={scrollRef} style={{ overflowX: zoom > 1 ? 'auto' : 'hidden', overflowY: 'hidden', scrollbarWidth: 'thin' }}>
            <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
              style={{ position: 'relative', width: innerW || '100%', height: 130, cursor: hasVideo ? 'ew-resize' : 'default', touchAction: 'pan-y', userSelect: 'none' }}>
              <div style={{ position: 'absolute', left: 0, right: 0, top: 104, height: 1, background: C.border }} />
              {ticks.map(k => (
                <div key={k.time} style={{ position: 'absolute', left: xOf(k.time), top: 104, pointerEvents: 'none' }}>
                  <div style={{ width: 1, height: 5, background: C.border }} />
                  <div style={{ fontSize: 10, color: C.textDim, transform: 'translateX(-50%)', marginTop: 5, whiteSpace: 'nowrap' }}>{k.label}</div>
                </div>
              ))}

              {segs.map((s, i) => {
                const w = Math.max(1, xOf(s.to) - xOf(s.from))
                if (s.role === 'flight') {
                  const apex = APEX_MAX * (s.sec / maxFlight)
                  const label = kind === 'hop' && s.heightIn != null ? `${s.heightIn.toFixed(1)} in` : ms(s.sec)
                  return (
                    <div key={i} style={{ position: 'absolute', left: xOf(s.from), width: w, top: 30, height: 74, pointerEvents: 'none' }}>
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(61,217,240,0.07)' }} />
                      <svg style={{ position: 'absolute', left: 0, top: 4 }} width={w} height={70} viewBox="0 0 100 70" preserveAspectRatio="none">
                        <path d={`M0 70 Q50 ${70 - 2 * apex} 100 70`} fill="none" stroke={C.cyan} strokeWidth={2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
                      </svg>
                      {w >= 34 && <span style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', top: Math.max(0, 74 - apex - 22), fontSize: 9, fontWeight: 700, color: C.cyan }}>{label}</span>}
                    </div>
                  )
                }
                return (
                  <div key={i} title={`${s.role}: ${ms(s.sec)}`} style={{ position: 'absolute', left: xOf(s.from), width: w, top: 76, height: 28, background: `${roleFill[s.role]}33`, borderTop: `2px solid ${roleFill[s.role]}`, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {w >= 40 && <span style={{ fontSize: 9, fontWeight: 700, color: roleFill[s.role] }}>{ms(s.sec)}</span>}
                  </div>
                )
              })}

              {marks.map((m, i) => (
                <div key={i} style={{ position: 'absolute', left: xOf(m), top: 20, height: 90, pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', left: -1, top: 0, width: 2, height: 84, background: roleColor(i), opacity: 0.9 }} />
                  <div style={{ position: 'absolute', left: -5, top: 78, width: 11, height: 11, borderRadius: '50%', background: roleColor(i), border: `2px solid ${C.deep}`, boxSizing: 'border-box' }} />
                </div>
              ))}
              {kind === 'pushup' && stabT != null && (
                <div style={{ position: 'absolute', left: xOf(stabT), top: 20, height: 90, pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', left: -1, top: 0, width: 2, height: 84, background: C.gold }} />
                  <div style={{ position: 'absolute', left: 3, top: 0, background: C.gold, color: '#0d1117', fontSize: 9, fontWeight: 800, borderRadius: 3, padding: '1px 5px' }}>Stable</div>
                </div>
              )}

              {hasVideo && (
                <div style={{ position: 'absolute', left: xOf(t), top: 6, height: 98, pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', left: -5, top: 0, width: 10, height: 10, borderRadius: '50%', background: C.white }} />
                  <div style={{ position: 'absolute', left: -1, top: 8, width: 2, height: 90, background: C.white }} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Transport */}
        <div style={{ borderTop: `1px solid ${C.border}`, padding: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', opacity: hasVideo ? 1 : 0.45, pointerEvents: hasVideo ? 'auto' : 'none' }}>
          <button style={{ ...ctl, background: C.text, color: C.bg }} onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>{playing ? '❚❚' : '▶'}</button>
          <button style={ctl} onClick={() => stepFrames(-10)} aria-label="Back 10 frames">«</button>
          <button style={ctl} onClick={() => stepFrames(-1)} aria-label="Back 1 frame">‹</button>
          <button style={ctl} onClick={() => stepFrames(1)} aria-label="Forward 1 frame">›</button>
          <button style={ctl} onClick={() => stepFrames(10)} aria-label="Forward 10 frames">»</button>
          <div style={{ display: 'flex', border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
            {RATES.map(r => (
              <button key={r} onClick={() => setRate(r)} style={{ ...ctl, border: 'none', borderRadius: 0, fontSize: 12, background: rate === r ? C.cyan : C.bg3, color: rate === r ? C.bg : C.textMuted, fontWeight: rate === r ? 700 : 400 }}>{r}×</button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 160px', minWidth: 160 }}>
            <button style={ctl} onClick={() => setZoom(z => Math.max(1, +(z - 1).toFixed(1)))} aria-label="Zoom out">−</button>
            <input type="range" min={1} max={30} step={0.1} value={zoom} onChange={e => setZoom(parseFloat(e.target.value))} style={{ flex: 1, accentColor: C.cyan }} aria-label="Timeline zoom" />
            <button style={ctl} onClick={() => setZoom(z => Math.min(30, +(z + 1).toFixed(1)))} aria-label="Zoom in">+</button>
            <span style={{ fontSize: 11, color: C.textMuted, width: 34 }}>{zoom.toFixed(1)}×</span>
          </div>
        </div>

        {/* Marking */}
        <div style={{ borderTop: `1px solid ${C.border}`, padding: 12, opacity: hasVideo ? 1 : 0.45, pointerEvents: hasVideo ? 'auto' : 'none' }}>
          {kind === 'pushup' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.textMuted, marginBottom: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={includeBottom} onChange={toggleBottom} style={{ accentColor: C.cyan }} />
              Also mark the bottom of the dip for each rep (splits lowering from push)
            </label>
          )}
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>Next marker</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <button style={{ ...bigBtn(roleColor(marks.length)), flex: '1 1 220px' }} onClick={markNext}>Mark: {nextLabel}</button>
            <button style={{ ...bigBtn('transparent', C.text), border: `1px solid ${C.border}`, opacity: marks.length ? 1 : 0.4 }} disabled={!marks.length} onClick={undo}>Undo</button>
            <button style={{ ...bigBtn('transparent', C.textMuted), border: `1px solid ${C.border}`, opacity: marks.length ? 1 : 0.4 }} disabled={!marks.length && stabT == null}
              onClick={() => { setMarks([]); setStabT(null); setMsg(null) }}>Reset all</button>
          </div>
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 8, lineHeight: 1.5 }}>
            {kind === 'hop'
              ? 'Step to the first frame feet touch down (landing), then the last frame they are on the floor (takeoff). Repeat for each hop. Mark at least 2 hops.'
              : 'Step to the first frame hands touch the ground, then the last frame they are on it (leave). After your last rep, mark one more contact: the landing that ends its flight.'}
          </div>
          {kind === 'pushup' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <button style={{ ...bigBtn('transparent', C.gold), border: `1px solid ${C.gold}`, padding: '9px 12px' }} onClick={() => setStabT(nowT())}>Set landing stabilization (optional)</button>
              {stabT != null && (
                <>
                  <span style={{ fontSize: 11, color: C.gold }}>{stabT.toFixed(3)} s</span>
                  <button aria-label="Clear stabilization" onClick={() => setStabT(null)} style={{ background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 14 }}>×</button>
                </>
              )}
            </div>
          )}

          {marks.length > 0 && (
            <div style={{ marginTop: 12, maxHeight: 190, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 8 }}>
              {marks.map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: roleColor(i), flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12, color: C.text, minWidth: 0 }}>{labelOf(i)}</span>
                  <button onClick={() => seek(m)} style={{ background: 'transparent', border: 'none', color: C.textMuted, fontSize: 11, cursor: 'pointer', fontFamily: 'monospace' }}>{m.toFixed(3)} s</button>
                  <button onClick={() => resetRow(i)} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.text, borderRadius: 6, fontSize: 10, padding: '3px 8px', cursor: 'pointer' }}>Re-set</button>
                </div>
              ))}
            </div>
          )}

          <button style={{ ...bigBtn(C.gold), width: '100%', marginTop: 12 }} onClick={apply}>Use in {title} form ↓</button>
          {msg && <div style={{ fontSize: 12, marginTop: 8, padding: '8px 10px', borderRadius: 8, color: msg.ok ? C.teal : C.red, background: msg.ok ? 'rgba(57,211,83,0.1)' : 'rgba(248,81,73,0.1)' }}>{msg.text}</div>}
          {sanity && <div style={{ fontSize: 12, marginTop: 8, padding: '8px 10px', borderRadius: 8, color: C.gold, background: 'rgba(232,184,75,0.1)' }}>{sanity}</div>}
        </div>

        {/* Capture speed */}
        <div style={{ borderTop: `1px solid ${C.border}`, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label htmlFor={`rv-fps-${kind}`} style={{ fontSize: 12, fontWeight: 700, color: C.white }}>Capture speed</label>
            <select id={`rv-fps-${kind}`} value={captureFps} onChange={e => setCaptureFps(parseInt(e.target.value))}
              style={{ background: C.bg3, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 10px', fontSize: 12 }}>
              {CAPTURE_OPTIONS.map(o => <option key={o.fps} value={o.fps}>{o.label}</option>)}
            </select>
            <button onClick={() => fileRef.current?.click()} style={{ marginLeft: 'auto', background: 'transparent', color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 12, cursor: 'pointer' }}>
              {src ? 'Choose another video' : 'Choose video'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.5, marginTop: 8 }}>
            Video plays back at about {PLAYBACK_FPS} frames per second. Step ← → (Shift for 10 frames). Real time = video time ÷ {slowMo}.
          </div>
        </div>
      </div>

      {/* Summary */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 12 }}>Test summary</div>
        {kind === 'hop' && hopData?.summary && hopData.metrics ? (
          <>
            <StatGrid items={[
              ['Valid hops', String(hopData.summary.validHopCount)],
              ['Avg ground contact', ms(hopData.summary.avgGroundContactSec)],
              ['Avg RSI', hopData.summary.avgRsi != null ? hopData.summary.avgRsi.toFixed(2) : '—'],
              ['Best RSI', hopData.summary.bestRsi != null ? hopData.summary.bestRsi.toFixed(2) : '—'],
              ['Avg jump height', hopData.summary.avgJumpHeightIn != null ? `${hopData.summary.avgJumpHeightIn.toFixed(1)} in` : '—'],
              ['Consistency (CV)', hopData.summary.rsiConsistencyPct != null ? `${hopData.summary.rsiConsistencyPct.toFixed(1)}%` : '—'],
            ]} />
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
              {hopData.metrics.map((m, i) => (
                <RepCard key={i} title={`Hop ${i + 1}`} lines={[
                  [`Contact`, ms(m.groundContactSec), C.orange],
                  [`Flight`, m.flightSec != null ? ms(m.flightSec) : '—', C.cyan],
                  [`Height`, m.flightTimeJumpHeightIn != null ? `${m.flightTimeJumpHeightIn.toFixed(1)} in` : '—', C.white],
                  [`RSI`, m.rsi != null ? m.rsi.toFixed(2) : '—', C.gold],
                ]} />
              ))}
            </div>
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 10, padding: '8px 10px', background: C.deep, borderRadius: 8 }}>
              Classic RSI = flight time ÷ ground contact time (not the CMJ RSI-Modified). The last hop has no flight because there is no following landing.
            </div>
          </>
        ) : kind === 'pushup' && pushData?.summary && pushData.metrics ? (
          <>
            <StatGrid items={[
              ['Reps', String(pushData.summary.repCount)],
              ['Avg contact', ms(pushData.summary.avgGroundContactSec)],
              ['Avg flight', ms(pushData.summary.avgFlightSec)],
              ['Best flight', ms(pushData.summary.bestFlightSec)],
              ['Consistency (CV)', pushData.summary.flightConsistencyPct != null ? `${pushData.summary.flightConsistencyPct.toFixed(1)}%` : '—'],
              ['Stabilization', pushData.summary.stabilizationSec != null ? `${pushData.summary.stabilizationSec.toFixed(2)} s` : '—'],
            ]} />
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
              {pushData.metrics.map((m, i) => (
                <RepCard key={i} title={`Rep ${i + 1}`} lines={[
                  [`Contact`, ms(m.groundContactSec), C.orange],
                  ...(m.loweringDurationSec != null ? [[`Lowering`, ms(m.loweringDurationSec), C.blue] as [string, string, string]] : []),
                  ...(m.propulsionDurationSec != null ? [[`Push`, ms(m.propulsionDurationSec), C.teal] as [string, string, string]] : []),
                  [`Flight`, ms(m.flightSec), C.cyan],
                ]} />
              ))}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: C.textDim, padding: '4px 0' }}>
            {(kind === 'hop' && hopData?.err) || (kind === 'pushup' && pushData?.err) || (kind === 'hop'
              ? 'No hops yet. Mark a landing and a takeoff for at least 2 hops.'
              : 'No reps yet. Mark a full rep, then one more contact for the final landing.')}
          </div>
        )}
      </div>
    </div>
  )
}

function Cell({ label, value, sub, delta, up, color }: { label: string; value: string; sub: string; delta?: string | null; up?: boolean; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 10, color: C.textDim }}>{sub}</div>
      {delta != null && <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2, color: up ? C.teal : C.gold }}>{delta}</div>}
    </div>
  )
}

function StatGrid({ items }: { items: [string, string][] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, paddingBottom: 14 }}>
      {items.map(([l, v]) => (
        <div key={l}>
          <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 2 }}>{l}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.white }}>{v}</div>
        </div>
      ))}
    </div>
  )
}

function RepCard({ title, lines }: { title: string; lines: [string, string, string][] }) {
  return (
    <div style={{ flex: '1 0 130px', minWidth: 130, background: C.deep, border: `1px solid ${C.border}`, borderRadius: 10, padding: 10 }}>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>{title}</div>
      {lines.map(([l, v, color]) => (
        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, padding: '2px 0' }}>
          <span style={{ color: C.textMuted }}>{l}</span>
          <span style={{ color, fontWeight: 700, fontFamily: 'monospace' }}>{v}</span>
        </div>
      ))}
    </div>
  )
}
