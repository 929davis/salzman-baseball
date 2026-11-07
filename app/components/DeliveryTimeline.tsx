'use client'
import { useEffect, useMemo, useRef, useState } from 'react'

// Delivery timeline for the mechanics tool: the key delivery events as pins on a scrubbable
// timeline, coloured phase bands between them with durations, and a stacked summary bar.
// Presentational only -- the parent owns the video, the pose tracking, and saving. Times are
// VIDEO seconds, exactly as the parent's Phase Durations list computes them.

const C = {
  bg2:'#161b22',bg3:'#1c2333',panel:'#0b1220',border:'#30363d',
  gold:'#e8b84b',teal:'#39d353',red:'#f85149',
  text:'#e6edf3',textMuted:'#7d8590',textDim:'#484f58',white:'#ffffff',
}

const TICK_STEPS = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60]

export type DeliveryEventDef = { name: string; short: string; color: string }
export type MarkedEvent = { name: string; time: number }
export type PhaseReference = { from: string; to: string; low: number; high: number; note: string }

type Props = {
  events: DeliveryEventDef[]          // canonical order, first to last
  marked: MarkedEvent[]               // events already logged for this session
  duration: number
  currentTime: number
  onSeek: (t: number) => void
  onMark: (name: string) => void
  canMark: boolean
  markHint: string
  busy: boolean
  references?: PhaseReference[]
}

const ms = (s: number) => `${Math.round(s * 1000)} ms`

export default function DeliveryTimeline({ events, marked, duration, currentTime, onSeek, onMark, canMark, markHint, busy, references }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const [zoom, setZoom] = useState(1)
  const [viewW, setViewW] = useState(0)
  const hasVideo = duration > 0

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setViewW(el.clientWidth))
    ro.observe(el)
    setViewW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const innerW = Math.max(viewW, viewW * zoom)
  const pxPerSec = hasVideo ? innerW / duration : 0
  const xOf = (t: number) => t * pxPerSec

  const defByName = useMemo(() => new Map(events.map((e, i) => [e.name, { ...e, index: i }])), [events])

  // Marked events in canonical order, dropping any that fall outside this video.
  const ordered = useMemo(
    () => marked
      .filter(m => defByName.has(m.name) && m.time >= 0 && m.time <= duration)
      .sort((a, b) => defByName.get(a.name)!.index - defByName.get(b.name)!.index),
    [marked, defByName, duration],
  )

  const phases = useMemo(() => {
    const out: { from: MarkedEvent; to: MarkedEvent; sec: number; color: string; valid: boolean }[] = []
    for (let i = 0; i < ordered.length - 1; i++) {
      const from = ordered[i], to = ordered[i + 1]
      out.push({ from, to, sec: to.time - from.time, color: defByName.get(from.name)!.color, valid: to.time > from.time })
    }
    return out
  }, [ordered, defByName])

  const validPhases = phases.filter(p => p.valid)
  const outOfOrder = phases.some(p => !p.valid)
  const totalSec = validPhases.reduce((a, p) => a + p.sec, 0)

  const ticks = useMemo(() => {
    if (!pxPerSec) return []
    const step = TICK_STEPS.find(s => s * pxPerSec >= 80) ?? TICK_STEPS[TICK_STEPS.length - 1]
    const out: { t: number; label: string }[] = []
    for (let t = 0; t <= duration + 1e-9; t += step) out.push({ t, label: `${t.toFixed(step < 1 ? 2 : 0)}s` })
    return out
  }, [pxPerSec, duration])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || zoom <= 1 || !pxPerSec) return
    const x = currentTime * pxPerSec
    if (x < el.scrollLeft + 24 || x > el.scrollLeft + el.clientWidth - 24) el.scrollLeft = x - el.clientWidth / 2
  }, [currentTime, zoom, pxPerSec])

  const timeFromPointer = (clientX: number) => {
    const el = scrollRef.current
    if (!el || !pxPerSec) return 0
    const r = el.getBoundingClientRect()
    return Math.max(0, Math.min(duration, (clientX - r.left + el.scrollLeft) / pxPerSec))
  }
  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!hasVideo) return
    draggingRef.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    onSeek(timeFromPointer(e.clientX))
  }
  const move = (e: React.PointerEvent<HTMLDivElement>) => { if (draggingRef.current) onSeek(timeFromPointer(e.clientX)) }
  const up = () => { draggingRef.current = false }

  const markedByName = new Map(ordered.map(m => [m.name, m]))
  const BASE = 112

  return (
    <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', marginTop: 14 }}>
      <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Delivery Timeline</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, color: C.textMuted }}>Zoom</span>
          <input type="range" min={1} max={30} step={0.1} value={zoom} onChange={e => setZoom(parseFloat(e.target.value))} style={{ width: 110, accentColor: C.gold }} aria-label="Timeline zoom" />
          <span style={{ fontSize: 10, color: C.textMuted, width: 30 }}>{zoom.toFixed(1)}×</span>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ background: C.panel, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, opacity: hasVideo ? 1 : 0.5 }}>
        <div ref={scrollRef} style={{ overflowX: zoom > 1 ? 'auto' : 'hidden', overflowY: 'hidden', scrollbarWidth: 'thin' }}>
          <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
            style={{ position: 'relative', width: innerW || '100%', height: 150, cursor: hasVideo ? 'ew-resize' : 'default', touchAction: 'pan-y', userSelect: 'none' }}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: BASE, height: 1, background: C.border }} />
            {ticks.map(k => (
              <div key={k.t} style={{ position: 'absolute', left: xOf(k.t), top: BASE, pointerEvents: 'none' }}>
                <div style={{ width: 1, height: 5, background: C.border }} />
                <div style={{ fontSize: 9, color: C.textDim, transform: 'translateX(-50%)', marginTop: 5, whiteSpace: 'nowrap' }}>{k.label}</div>
              </div>
            ))}

            {/* phase bands */}
            {validPhases.map((p, i) => {
              const w = xOf(p.to.time) - xOf(p.from.time)
              return (
                <div key={i} title={`${p.from.name} → ${p.to.name}: ${ms(p.sec)}`}
                  style={{ position: 'absolute', left: xOf(p.from.time), width: w, top: 60, height: BASE - 60, background: `${p.color}26`, borderTop: `2px solid ${p.color}`, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {w >= 44 && <span style={{ fontSize: 10, fontWeight: 700, color: p.color }}>{ms(p.sec)}</span>}
                </div>
              )
            })}

            {/* event pins (labels alternate rows so neighbours don't collide) */}
            {ordered.map((m, i) => {
              const def = defByName.get(m.name)!
              const row = i % 2
              return (
                <div key={m.name} onPointerDown={e => e.stopPropagation()} onClick={() => onSeek(m.time)}
                  style={{ position: 'absolute', left: xOf(m.time), top: 0, height: BASE + 6, cursor: 'pointer' }}>
                  <div style={{ position: 'absolute', left: 3, top: 3 + row * 20, background: def.color, color: '#0d1117', fontSize: 10, fontWeight: 800, borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap' }}>{def.short}</div>
                  <div style={{ position: 'absolute', left: -1, top: 24 + row * 20, width: 2, height: BASE - 24 - row * 20, background: def.color }} />
                  <div style={{ position: 'absolute', left: -5, top: BASE - 5, width: 11, height: 11, borderRadius: '50%', background: def.color, border: `2px solid ${C.panel}`, boxSizing: 'border-box' }} />
                </div>
              )
            })}

            {/* playhead */}
            {hasVideo && (
              <div style={{ position: 'absolute', left: xOf(currentTime), top: 6, height: BASE - 6, pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', left: -5, top: 0, width: 10, height: 10, borderRadius: '50%', background: C.white }} />
                <div style={{ position: 'absolute', left: -1, top: 8, width: 2, height: BASE - 14, background: C.white }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mark buttons */}
      <div style={{ padding: 12 }}>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8, lineHeight: 1.5 }}>
          Step to each moment, then tap its button. Each mark logs that frame&apos;s joint angles with the event tagged.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 8 }}>
          {events.map(ev => {
            const m = markedByName.get(ev.name)
            return (
              <button key={ev.name} disabled={!canMark || busy} onClick={() => onMark(ev.name)}
                style={{ textAlign: 'left', background: m ? `${ev.color}1f` : 'transparent', border: `1px solid ${ev.color}`, color: ev.color, borderRadius: 8, padding: '8px 10px', cursor: canMark && !busy ? 'pointer' : 'not-allowed', opacity: canMark ? 1 : 0.4 }}>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{m ? 'Re-mark' : 'Mark'} {ev.short}</div>
                <div style={{ fontSize: 10, color: m ? C.text : C.textDim }}>{m ? `${m.time.toFixed(3)} s` : ev.name}</div>
              </button>
            )
          })}
        </div>
        {!canMark && <div style={{ fontSize: 11, color: C.gold, marginTop: 8 }}>{markHint}</div>}
        {outOfOrder && <div style={{ fontSize: 11, color: C.red, marginTop: 8, padding: '8px 10px', background: 'rgba(248,81,73,0.1)', borderRadius: 8 }}>Two events are out of order on the timeline. Re-mark the later one so each event comes after the one before it.</div>}
      </div>

      {/* Summary */}
      {validPhases.length > 0 && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phase summary</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{ordered[0] && ordered[ordered.length - 1] ? `${defByName.get(ordered[0].name)!.short} → ${defByName.get(ordered[ordered.length - 1].name)!.short}: ` : ''}<b style={{ color: C.white }}>{ms(totalSec)}</b></div>
          </div>
          <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', border: `1px solid ${C.border}` }}>
            {validPhases.map((p, i) => (
              <div key={i} title={`${p.from.name} → ${p.to.name}`} style={{ width: `${(p.sec / totalSec) * 100}%`, background: p.color, opacity: 0.85, borderRight: i < validPhases.length - 1 ? `1px solid ${C.panel}` : 'none' }} />
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            {validPhases.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
                <span style={{ fontSize: 11, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
                  {defByName.get(p.from.name)!.short} → {defByName.get(p.to.name)!.short}
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: C.white }}>
                  {ms(p.sec)} <span style={{ color: C.textDim, fontWeight: 400 }}>· {((p.sec / totalSec) * 100).toFixed(0)}%</span>
                </span>
              </div>
            ))}
          </div>
          {(references ?? []).map(r => {
            const a = markedByName.get(r.from), b = markedByName.get(r.to)
            if (!a || !b || b.time <= a.time) return null
            return (
              <div key={r.from + r.to} style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(232,184,75,0.08)', border: `1px solid #a07c28`, borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: C.gold }}>{defByName.get(r.from)!.short} → {defByName.get(r.to)!.short}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: C.white }}>{(b.time - a.time).toFixed(3)} s</span>
                </div>
                <div style={{ fontSize: 9, color: C.textDim, marginTop: 3 }}>{r.note}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
