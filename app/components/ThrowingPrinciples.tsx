'use client'
import { useState } from 'react'

const C = {
  bg:'#0d1117',bg2:'#161b22',bg3:'#1c2333',border:'#30363d',
  gold:'#e8b84b',goldDim:'#a07c28',
  teal:'#39d353',red:'#f85149',blue:'#58a6ff',purple:'#a371f7',
  text:'#e6edf3',textMuted:'#7d8590',textDim:'#484f58',white:'#ffffff',
}

type Idea = {
  icon: string
  title: string
  body: string
  cue: string
}

// Condensed, athlete-voiced version of the coach's full Training Principles doc — same
// ideas, rewritten shorter and (per Wulf et al.'s attentional-focus research, one of the
// most replicated findings in motor learning) pointed at an external effect rather than an
// internal body-part instruction. Full depth still lives in the coach's Principles tab;
// this is the "why" every pitcher should actually see. Collapsed by default (progressive
// disclosure) so the page reads as a handful of ideas, not a wall of text.
const IDEAS: Idea[] = [
  {
    icon: '🧠',
    title: 'Your Nervous System Is the Athlete',
    body: "Every drill, lift, and throw is a conversation with your nervous system, not just your muscles. Velocity doesn't come from your arm — it comes from your brain learning to fire the right muscles, in the right order, at the right speed. That's why two guys can throw the same number of bullpens and walk away with completely different results. The one who improves is the one whose nervous system actually adapted, not just the one who worked hardest.",
    cue: "Judge a session by how your body moved, not just how many throws you made.",
  },
  {
    icon: '🎯',
    title: 'Feel Long Before You Feel Fast',
    body: "Right before release, elite arms aren't tense — they're long. Think of a rubber band: one that's already tight before you pull it back has no snap left. One that's fully extended, then let go, fires on its own. Hip-to-shoulder separation is what creates that stretch through your trunk and arm. You don't force the snap — you create the separation, get long, and let it happen.",
    cue: "Feel for separation and length, not effort. Chase the stretch, not the strain.",
  },
  {
    icon: '🧩',
    title: "Your Drills Are Solving Problems — Not Teaching Poses",
    body: "Coaches aren't trying to freeze you into a position. Every drill removes something (your legs, your rhythm, your target) so your nervous system has to find the answer on its own — and once it finds it, it keeps it, even after the constraint is gone. That's the difference between being told where your elbow goes and your body discovering it for real.",
    cue: 'The 7-step ladder: Constrain → Time → Adapt → Move → Bounce → Transfer → Compete — each phase below is solving one specific problem.',
  },
  {
    icon: '💪',
    title: 'Why We Lift the Way We Lift',
    body: "Your lifting isn't about getting bigger — it's about making your nervous system faster and your body better at producing and absorbing force quickly. The slow-lowering (eccentric) side of a lift builds the ability to absorb force before firing — exactly what your front leg does when it plants. Explosive, moderate-load work trains raw force production speed. Ballistic work (med balls, jumps) trains your nervous system to fire instantly, no hesitation.",
    cue: "If a lift doesn't make you faster, more explosive, or more durable as a thrower, it doesn't belong in your program.",
  },
  {
    icon: '📊',
    title: 'The Real Data Behind "Ground Up, Not Arm Only"',
    body: "This isn't just a saying. In real motion-capture data across 411 pitches, how efficiently energy transfers up the chain — foot plant through release, through the shoulder and elbow — predicted velocity better than almost anything else measured (r=0.69), well ahead of arm-only measures like max external rotation (r=0.33) or raw torso speed alone (r=0.33). The chain matters more than any single link. Worth being straight about the flip side too: that same data shows harder throwers put more stress through the elbow as velocity climbs. That's not a flaw — it's exactly why your arm-care number scales up with your velocity instead of being the same for everyone.",
    cue: "More velocity is a real trade you're making with your arm — which is why the arm-care work isn't optional.",
  },
  {
    icon: '🔁',
    title: 'Recovery Is Part of Training, Not a Break From It',
    body: "You get stronger during recovery, not during the lift itself — the training is what signals the adaptation; the rest is when it actually happens. That's why two hard days never get stacked back to back, and why a throwing day counts as a hard day when planning what else you do that week.",
    cue: "A planned down day isn't lost time — it's the part of the plan where the gains actually get banked.",
  },
  {
    icon: '🎯',
    title: 'A 96 That Misses Is Worse Than a 92 That Doesn\'t',
    body: "Chasing max effort without command builds an arm that throws hard in the bullpen and nowhere else. Command is trainable the exact same way velocity is — through reps your nervous system can actually learn from, not through trying harder on a single pitch.",
    cue: "Every rep is a chance to teach your body precision, not just intensity.",
  },
]

function IdeaCard({ idea, open, onToggle }: { idea: Idea, open: boolean, onToggle: () => void }) {
  return (
    <div style={{ background: C.bg2, border: `1px solid ${open ? C.gold : C.border}`, borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', cursor: 'pointer' }}>
        <span style={{ fontSize: 20 }}>{idea.icon}</span>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: open ? C.gold : C.white }}>{idea.title}</span>
        <span style={{ fontSize: 12, color: C.textMuted }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7, marginBottom: 10 }}>{idea.body}</div>
          <div style={{ fontSize: 12, color: C.gold, fontWeight: 600, lineHeight: 1.6, background: 'rgba(232,184,75,0.08)', border: `1px solid ${C.goldDim}`, borderRadius: 8, padding: '10px 12px' }}>
            {idea.cue}
          </div>
        </div>
      )}
    </div>
  )
}

const PHASES = [
  { name: 'Constrain', does: 'Removes your lower half so your arm can find its natural path with no interference.' },
  { name: 'Time', does: 'Syncs your arm to your body\'s rhythm — the fix if you feel rushed or late.' },
  { name: 'Adapt', does: 'Different implements force new solutions with the same arm — this is what makes your mechanics hold up under pressure.' },
  { name: 'Move', does: 'Builds momentum from the ground up — the fix if you feel all-arm with no body behind it.' },
  { name: 'Bounce', does: 'Trains your front leg to brace and redirect force instead of collapsing through it.' },
  { name: 'Transfer', does: 'Takes what your nervous system learned and applies it to real throwing angles and timing.' },
  { name: 'Compete', does: 'No more constraints — just you, expressing everything the earlier phases built.' },
]

export default function ThrowingPrinciples() {
  const [openIdx, setOpenIdx] = useState<number | null>(0)
  const [showPhases, setShowPhases] = useState(false)

  return (
    <div style={{ color: C.text }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.white, marginBottom: 4 }}>Why This Works</div>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
        Understanding why you're doing what you're doing is what separates guys who grind and plateau from guys who grind and grow. Tap a card to open it.
      </div>

      {IDEAS.map((idea, i) => (
        <IdeaCard key={idea.title} idea={idea} open={openIdx === i} onToggle={() => setOpenIdx(openIdx === i ? null : i)} />
      ))}

      <button onClick={() => setShowPhases(s => !s)} style={{ width: '100%', textAlign: 'left', background: 'rgba(88,166,255,0.05)', border: '1px solid rgba(88,166,255,0.25)', borderRadius: 10, padding: '12px 14px', color: C.blue, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 4, marginBottom: showPhases ? 0 : 16 }}>
        {showPhases ? '▲' : '▼'} The 7-Phase Throwing Ladder — What Each Step Is Actually Training
      </button>
      {showPhases && (
        <div style={{ background: C.bg2, border: '1px solid rgba(88,166,255,0.25)', borderTop: 'none', borderBottomLeftRadius: 10, borderBottomRightRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          {PHASES.map((p, i) => (
            <div key={p.name} style={{ display: 'flex', gap: 10, marginBottom: i < PHASES.length - 1 ? 10 : 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, minWidth: 22 }}>{i + 1}.</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{p.name}</div>
                <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>{p.does}</div>
              </div>
            </div>
          ))}
          <div style={{ fontSize: 11, color: C.textDim, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`, lineHeight: 1.5 }}>
            Your program tells you which drills you're doing — this is what they're actually for.
          </div>
        </div>
      )}

      <div style={{ fontSize: 10, color: C.textDim, lineHeight: 1.6, borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 8 }}>
        Sources: Tom House / NPA throwing progression framework; Wulf et al. on external vs. internal focus of attention in motor learning; internal motion-capture study (411 pitches) on kinetic-chain energy transfer and velocity. The full coach-level detail behind every idea here lives in the staff Principles doc — ask your coach if you want to go deeper on any of these.
      </div>
    </div>
  )
}
