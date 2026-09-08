'use client'
import { useState } from 'react'

const C = {
  bg2:'#161b22', border:'#30363d', gold:'#e8b84b', text:'#e6edf3', textMuted:'#7d8590',
}

// Shared collapsible "how to read this tool" box — same visual treatment (gold border,
// hide/show toggle, open by default) used across Pitching IQ's tools so a coach learns the
// pattern once instead of each tool inventing its own explanation UI.
export default function HowToReadPanel({ title, children }: { title: string, children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ background: C.bg2, border: `1px solid ${C.gold}`, borderRadius: 10, padding: 16, marginBottom: 20 }}>
      <div onClick={() => setOpen(!open)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.gold }}>{title}</div>
        <div style={{ fontSize: 11, color: C.textMuted }}>{open ? 'Hide ▲' : 'Show ▼'}</div>
      </div>
      {open && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column' as const, gap: 10, fontSize: 12, color: C.text, lineHeight: 1.6 }}>
          {children}
        </div>
      )}
    </div>
  )
}
