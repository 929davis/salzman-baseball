'use client'
import { useState } from 'react'

const C = {
  bg2:'#161b22', bg3:'#1c2333', border:'#30363d',
  gold:'#e8b84b', teal:'#39d353', red:'#f85149', blue:'#58a6ff', purple:'#a371f7',
  text:'#e6edf3', textMuted:'#7d8590', textDim:'#484f58',
}

type Somatotype = { name: string, color: string, tendency: string, note: string }
const SOMATOTYPES: Somatotype[] = [
  {
    name: 'Ectomorph', color: C.blue,
    tendency: 'Long limbs, lower natural muscle mass, fast metabolism. Often more mobile/flexible by default, sometimes a longer, whippier-looking arm action.',
    note: 'Usually needs more time and volume to build strength — under fatigue, mechanics can get inconsistent before the frame has the mass to buffer a mistake.',
  },
  {
    name: 'Mesomorph', color: C.gold,
    tendency: 'Naturally muscular, athletic build. Responds quickly to strength training and often produces raw force/power without much extra work.',
    note: "Easy to lean on natural strength over refined sequencing — mobility work still matters, or athleticism plateaus early.",
  },
  {
    name: 'Endomorph', color: C.red,
    tendency: 'Thicker frame, higher natural body fat, gains muscle and strength easily. Often strong lower-half force production.',
    note: 'Power-to-weight ratio — conditioning and jump/plyo work — is usually the highest-leverage focus, not raw strength.',
  },
]

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
              A rough framework from 1940s constitutional psychology — the personality-prediction side of it has been thoroughly debunked, and even the body-type side is a loose heuristic, not a validated predictive model. Useful for setting realistic expectations on timeline and training focus, not for boxing anyone into a label.
            </div>
            {SOMATOTYPES.map(s => (
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
              The angle where your lower ribs meet at the center of your chest, at the sternum. Under about 90° is a <b>narrow</b> ISA; over 90° is a <b>wide</b> ISA. This comes from postural-assessment work (the Postural Restoration Institute) used seriously in physical therapy and performance circles — but it describes a structural <i>tendency</i>, not a rigid rule. It takes a coach or PT feeling along the lower rib margins, or a relaxed side-on photo, to get a reasonable read — not something to self-diagnose precisely.
            </div>
            <div style={{ marginBottom: 10, paddingLeft: 10, borderLeft: `3px solid ${C.purple}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.purple, marginBottom: 3 }}>Narrow ISA (&lt;90°) — biased toward external rotation</div>
              <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>Tends to show up as more naturally mobile into layback/external rotation — often a longer, looser-looking arm action. The tradeoff: often needs <i>more</i> deliberate internal-rotation strength and deceleration work, since the mobility side is already close to free.</div>
            </div>
            <div style={{ paddingLeft: 10, borderLeft: `3px solid ${C.teal}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.teal, marginBottom: 3 }}>Wide ISA (&gt;90°) — biased toward internal rotation</div>
              <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>Tends to show up as a more naturally stable, "closed-off" presentation, often with better natural deceleration. The tradeoff: often needs more deliberate mobility work to access a full, safe layback position, since the structure already biases toward internal rotation.</div>
            </div>
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}`, lineHeight: 1.5 }}>
              Never a reason to skip mobility or stability work just because it "should" come easy for your structure — it's a starting lean to plan around, not a substitute for the work.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
