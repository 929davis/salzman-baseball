// Plain <details>/<summary> -- native expand/collapse needs no client JS. The id lives on the
// <details> element itself (not the <summary>) so PlaybookNav's hash handler can find this
// exact element via getElementById and set .open directly, per anchor-nav requirement.
const C = {
  bg2: '#161b22', border: '#30363d', text: '#e6edf3', textMuted: '#7d8590',
}

export default function CollapsibleSection({
  id, title, defaultOpen, children,
}: {
  id: string
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  return (
    <details
      id={id}
      open={defaultOpen || undefined}
      style={{
        background: C.bg2,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        marginBottom: 16,
        scrollMarginTop: 72, // keeps the section clear of the sticky nav when scrolled into view
      }}
    >
      <summary
        style={{
          padding: '16px 18px',
          fontSize: 15,
          fontWeight: 700,
          color: C.text,
          cursor: 'pointer',
          userSelect: 'none',
          // 44px+ tap target per mobile guidance -- padding above already gets us there, this
          // just guarantees it regardless of content.
          minHeight: 24,
          listStyle: 'none',
        }}
      >
        {title}
      </summary>
      <div style={{ padding: '0 18px 18px', color: C.textMuted, fontSize: 14, lineHeight: 1.6 }}>
        {children}
      </div>
    </details>
  )
}
