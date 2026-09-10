// Visual design for the Instagram card, isolated from the route logic in
// app/api/social/card/[id]/route.tsx so this can be iterated on independently.
//
// Design intent: a card that looks like it came from a coach who knows what he's talking
// about, not from a content tool. Reuses this app's own established dark/gold identity
// (same palette as the rest of the coaching site) rather than inventing a new one, so the
// Instagram content and the coaching brand read as the same thing. Deliberately NOT a tweet
// screenshot -- no X chrome, no @handle, no "reposted from" framing (Instagram reduces
// recommendation reach for content carrying visible third-party platform branding).
//
// Font note: this renders using next/og's built-in default font rather than an embedded
// custom font file, since no font asset was in this build's file scope (see the build
// report). Weight differentiation (600 body / 700 wordmark) may read as subtle without a
// real embedded font -- if tighter typographic fidelity matters, bundling an actual
// Inter/similar .ttf and passing it via ImageResponse's `fonts` option is the next step.

export const CARD_SIZE = 1080

// Past this, even the smallest step on the size ramp below renders too small to read
// cleanly on a 1080px square viewed at Instagram feed size. Return an error instead of
// unreadable output.
export const CARD_TEXT_MAX_LENGTH = 480

const C = {
  bg: '#0d1117',
  text: '#e6edf3',
  textMuted: '#7d8590',
  gold: '#e8b84b',
}

// Longer source text steps down through this ramp. Chosen so a short, punchy post reads as
// a bold statement and a long one still fits without crowding the margins.
function sizeForLength(len: number): { fontSize: number; lineHeight: number } {
  if (len <= 80) return { fontSize: 72, lineHeight: 1.22 }
  if (len <= 160) return { fontSize: 56, lineHeight: 1.28 }
  if (len <= 280) return { fontSize: 44, lineHeight: 1.32 }
  if (len <= 380) return { fontSize: 36, lineHeight: 1.36 }
  return { fontSize: 30, lineHeight: 1.4 }
}

export function CardTemplate({ text }: { text: string }) {
  const { fontSize, lineHeight } = sizeForLength(text.length)
  const margin = 96

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: C.bg,
        padding: `${margin}px`,
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          flex: 1,
          alignItems: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            color: C.text,
            fontSize,
            fontWeight: 600,
            lineHeight,
            letterSpacing: '-0.5px',
            whiteSpace: 'pre-wrap',
          }}
        >
          {text}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            display: 'flex',
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: C.gold,
          }}
        />
        <div
          style={{
            display: 'flex',
            fontSize: 22,
            fontWeight: 700,
            color: C.textMuted,
          }}
        >
          Salzman Baseball
        </div>
      </div>
    </div>
  )
}
