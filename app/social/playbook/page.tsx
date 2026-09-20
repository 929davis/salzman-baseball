// Private reference page -- content/funnel playbook, edited via git push, no admin UI. Not
// linked from any nav; reached by direct URL only.
//
// Server-rendered and static: no cookies/headers/searchParams/dynamic APIs are read, so Next
// prerenders this at build time like /articles does. `dynamic = 'force-static'` makes that
// explicit rather than relying on the default inference -- this page has no reason to ever be
// per-request, and a future edit that accidentally introduces a dynamic API should fail loudly
// (Next throws at build time when force-static can't be honored) rather than silently start
// rendering on every request.
export const dynamic = 'force-static'

import { getPlaybookSections, getDmMessages, DM_SEQUENCE_ID } from '@/lib/playbook'
import PlaybookNav from './PlaybookNav'
import CollapsibleSection from './CollapsibleSection'
import CopyButton from './CopyButton'

const C = {
  bg: '#0d1117', bg2: '#161b22', border: '#30363d', gold: '#e8b84b', text: '#e6edf3', textMuted: '#7d8590',
}

export default async function PlaybookPage() {
  const sections = await getPlaybookSections()
  const dmMessages = getDmMessages()

  const [checklist, ...rest] = sections
  const navItems = sections.map(s => ({ id: s.id, title: s.title }))

  return (
    <main style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: 'system-ui, sans-serif' }}>
      <PlaybookNav items={navItems} />

      <div className="playbook-content" style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px 40px' }}>
        {/* Scoped (not global) so a raw <table> from rendered Markdown -- e.g. the reel-structure
            timing table -- is actually readable on a phone: bordered cells, no zoom needed. */}
        <style>{`
          .playbook-content table { border-collapse: collapse; width: 100%; font-size: 13px; }
          .playbook-content th, .playbook-content td { border: 1px solid ${C.border}; padding: 8px 10px; text-align: left; vertical-align: top; }
          .playbook-content th { color: ${C.gold}; font-weight: 700; }
        `}</style>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: C.gold, margin: '4px 0 16px' }}>
          Content / Funnel Playbook
        </h1>

        {/* Checklist: always visible, top of page, its own anchor target */}
        <section
          id={checklist.id}
          style={{
            background: C.bg2,
            border: `1px solid ${C.gold}`,
            borderRadius: 10,
            padding: '16px 18px',
            marginBottom: 16,
            scrollMarginTop: 72,
          }}
        >
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px' }}>{checklist.title}</h2>
          <div
            style={{ color: C.textMuted, fontSize: 14, lineHeight: 1.6 }}
            dangerouslySetInnerHTML={{ __html: checklist.html }}
          />
        </section>

        {rest.map(section => (
          <CollapsibleSection key={section.id} id={section.id} title={section.title}>
            {section.id === DM_SEQUENCE_ID ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {dmMessages.map(msg => (
                  <div
                    key={msg.index}
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                      background: C.bg,
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      padding: 12,
                    }}
                  >
                    <p style={{ flex: 1, margin: 0, whiteSpace: 'pre-wrap' }}>
                      <strong style={{ color: C.gold }}>#{msg.index}</strong> {msg.text}
                    </p>
                    <CopyButton text={msg.text} />
                  </div>
                ))}
              </div>
            ) : (
              // overflowX:auto -- a wide table (e.g. the reel-structure timing table) scrolls
              // horizontally within its own box on a phone instead of breaking page layout.
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <div dangerouslySetInnerHTML={{ __html: section.html }} />
              </div>
            )}
          </CollapsibleSection>
        ))}
      </div>
    </main>
  )
}
