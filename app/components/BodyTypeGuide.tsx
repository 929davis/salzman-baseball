'use client'
import { useState } from 'react'
import { SOMATOTYPE_INFO, SOMATOTYPE_DISCLAIMER, ISA_INFO, ISA_EXPLAINER, ISA_DISCLAIMER } from '@/lib/bodyType'

const C = {
  bg2:'#161b22', bg3:'#1c2333', border:'#30363d',
  gold:'#e8b84b', teal:'#39d353', red:'#f85149', blue:'#58a6ff', purple:'#a371f7',
  text:'#e6edf3', textMuted:'#7d8590', textDim:'#484f58',
}

export default function BodyTypeGuide() {
  const [open, setOpen] = useState<'soma' | 'isa' | null>(null)

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>Body Type & Structure Tendencies</div>
      <div style={{ fontSize: 11, color: C.textDim, marginBottom: 12, lineHeight: 1.5 }}>
        General tendencies, not destiny — every athlete is a blend, and structure sets a starting lean, not a ceiling.
      </div>

      {/* Somatotype */}
      <div style={{ background: C.bg2, border: `1px solid ${open === 'soma' ? C.gold : C.border}`, borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
        <div onClick={() => setOpen(open === 'soma' ? null : 'soma')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', cursor: 'pointer' }}>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: open === 'soma' ? C.gold : C.text }}>Somatotype (Ecto / Meso / Endomorph)</span>
          <span style={{ fontSize: 11, color: C.textMuted }}>{open === 'soma' ? '▲' : '▼'}</span>
        </div>
        {open === 'soma' && (
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.6, marginBottom: 12 }}>
              {SOMATOTYPE_DISCLAIMER}
            </div>
            {Object.values(SOMATOTYPE_INFO).map(s => (
              <div key={s.name} style={{ marginBottom: 10, paddingLeft: 10, borderLeft: `3px solid ${s.color}` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: s.color, marginBottom: 2 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6, marginBottom: 3 }}>{s.tendency}</div>
                <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.5, fontStyle: 'italic' }}>{s.note}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ISA */}
      <div style={{ background: C.bg2, border: `1px solid ${open === 'isa' ? C.gold : C.border}`, borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
        <div onClick={() => setOpen(open === 'isa' ? null : 'isa')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', cursor: 'pointer' }}>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: open === 'isa' ? C.gold : C.text }}>Infrasternal Angle (Narrow vs. Wide)</span>
          <span style={{ fontSize: 11, color: C.textMuted }}>{open === 'isa' ? '▲' : '▼'}</span>
        </div>
        {open === 'isa' && (
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ fontSize: 12, color: C.text, lineHeight: 1.7, marginBottom: 12 }}>
              {ISA_EXPLAINER}
            </div>
            <div style={{ marginBottom: 10, paddingLeft: 10, borderLeft: `3px solid ${ISA_INFO.narrow.color}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: ISA_INFO.narrow.color, marginBottom: 3 }}>{ISA_INFO.narrow.name}</div>
              <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{ISA_INFO.narrow.tendency}</div>
            </div>
            <div style={{ paddingLeft: 10, borderLeft: `3px solid ${ISA_INFO.wide.color}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: ISA_INFO.wide.color, marginBottom: 3 }}>{ISA_INFO.wide.name}</div>
              <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{ISA_INFO.wide.tendency}</div>
            </div>
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}`, lineHeight: 1.5 }}>
              {ISA_DISCLAIMER}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
