// Visual design for the Instagram card, isolated from the route logic in
// app/api/social/card/[id]/route.tsx so this can be iterated on independently.
//
// Design intent: a card that looks like it came from a coach who knows what he's talking
// about, not from a content tool. Reuses this app's own established dark/gold identity
// (same palette as the rest of the coaching site) rather than inventing a new one, so the
// Instagram content and the coaching brand read as the same thing.
//
// Revision: the header (avatar + name + @handle) is a deliberate, later addition -- the
// original version of this card had no @handle at all, specifically to avoid reading as a
// screenshot of another platform's post. The handle was added back in because the actual
// goal turned out to be cross-promotion (driving IG followers to the coach's real X account),
// not aesthetic mimicry -- so it's real and functional, not decorative platform chrome. It
// still deliberately excludes a verified-checkmark badge, timestamp, or reply/chevron UI --
// those would only fake platform authenticity rather than serve the cross-promo goal.
//
// Font note: this renders using next/og's built-in default font rather than an embedded
// custom font file, since no font asset was in this build's file scope (see the build
// report). Weight differentiation may read as subtle without a real embedded font -- if
// tighter typographic fidelity matters, bundling an actual Inter/similar .ttf and passing it
// via ImageResponse's `fonts` option is the next step.

export const CARD_SIZE = 1080

// The account name/handle shown in the card header. Real values, not placeholders -- this is
// a functional cross-promotion element (drives IG viewers to the real X account), not
// decorative platform chrome.
export const ACCOUNT_NAME = 'Davis Salzman'
export const ACCOUNT_HANDLE = '@Salzmanbaseball'

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

// avatarDataUri: a "data:image/...;base64,..." URI, read from disk and encoded by the route
// handler (see app/api/social/card/[id]/route.tsx) -- this component stays a pure function of
// its props, no filesystem access here. There is deliberately only one photo on the card (the
// header avatar) -- an earlier revision also placed the full uncropped source photo as a
// larger block next to the text; that was removed per feedback.
export function CardTemplate({ text, avatarDataUri }: { text: string; avatarDataUri: string }) {
  const { fontSize, lineHeight } = sizeForLength(text.length)
  const margin = 96
  const avatarSize = 88

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: C.bg,
        padding: `${margin}px`,
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <img
          src={avatarDataUri}
          width={avatarSize}
          height={avatarSize}
          style={{
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
            objectFit: 'cover',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: C.text }}>
            {ACCOUNT_NAME}
          </div>
          <div style={{ display: 'flex', fontSize: 24, fontWeight: 500, color: C.textMuted }}>
            {ACCOUNT_HANDLE}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flex: 1,
          alignItems: 'flex-start',
          marginTop: 56,
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
    </div>
  )
}
