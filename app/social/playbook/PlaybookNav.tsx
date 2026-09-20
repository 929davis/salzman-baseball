'use client'
import { useEffect } from 'react'

const C = {
  bg: '#0d1117', bg3: '#1c2333', border: '#30363d', gold: '#e8b84b', text: '#e6edf3',
}

// Shared by both the hashchange listener and the click handler below, so a direct link
// (#dm-sequence pasted into a new tab), a browser back/forward, and a tap on the nav all go
// through the same path: open the target <details> first, then scroll to it. Native anchor
// scrolling alone won't open a closed <details> -- the browser scrolls to its (collapsed)
// position and stops, which is the exact bug this function exists to avoid.
function openAndScroll(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  if (el instanceof HTMLDetailsElement && !el.open) el.open = true
  // rAF gives the browser one paint to apply the newly-opened <details> layout before we
  // measure/scroll to it -- without this, scrollIntoView can target the pre-expand position.
  requestAnimationFrame(() => {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

export default function PlaybookNav({ items }: { items: { id: string, title: string }[] }) {
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace(/^#/, '')
      if (hash) openAndScroll(hash)
    }
    handleHash() // direct link / reload landing on a hash
    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [])

  const onClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    if (window.location.hash === `#${id}`) {
      // Some engines (iOS Safari included) don't fire 'hashchange' when the hash isn't
      // actually changing -- handle the re-tap case directly instead of relying on the event.
      openAndScroll(id)
    } else {
      window.location.hash = id
    }
  }

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        background: C.bg,
        borderBottom: `1px solid ${C.border}`,
        padding: '10px 12px',
        marginBottom: 16,
      }}
    >
      {items.map(item => (
        <a
          key={item.id}
          href={`#${item.id}`}
          onClick={(e) => onClick(e, item.id)}
          style={{
            flex: '0 0 auto',
            background: C.bg3,
            border: `1px solid ${C.border}`,
            borderRadius: 20,
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 600,
            color: C.gold,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {item.title}
        </a>
      ))}
    </nav>
  )
}
