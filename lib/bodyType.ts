// Somatotype and ISA copy -- shared by app/components/BodyTypeGuide.tsx (the general
// reference guide) and the pitcher Overview's classification card (which shows only the
// athlete's own coach-assessed type). Kept in one place so the two never drift apart.

export type Somatotype = 'ectomorph' | 'mesomorph' | 'endomorph'

export const SOMATOTYPE_INFO: Record<Somatotype, { name: string, color: string, tendency: string, note: string }> = {
  ectomorph: {
    name: 'Ectomorph', color: '#58a6ff',
    tendency: 'Long limbs, lower natural muscle mass, fast metabolism. Often more mobile/flexible by default, sometimes a longer, whippier-looking arm action.',
    note: 'Usually needs more time and volume to build strength — under fatigue, mechanics can get inconsistent before the frame has the mass to buffer a mistake.',
  },
  mesomorph: {
    name: 'Mesomorph', color: '#e8b84b',
    tendency: 'Naturally muscular, athletic build. Responds quickly to strength training and often produces raw force/power without much extra work.',
    note: "Easy to lean on natural strength over refined sequencing — mobility work still matters, or athleticism plateaus early.",
  },
  endomorph: {
    name: 'Endomorph', color: '#f85149',
    tendency: 'Thicker frame, higher natural body fat, gains muscle and strength easily. Often strong lower-half force production.',
    note: 'Power-to-weight ratio — conditioning and jump/plyo work — is usually the highest-leverage focus, not raw strength.',
  },
}

export const SOMATOTYPE_DISCLAIMER = 'A rough framework from 1940s constitutional psychology — the personality-prediction side of it has been thoroughly debunked, and even the body-type side is a loose heuristic, not a validated predictive model. Useful for setting realistic expectations on timeline and training focus, not for boxing anyone into a label.'

// Bodyweight target = height(in) * this multiplier, by somatotype. NOT a published or
// validated norm -- there is no official "somatotype" tag on any MLB roster, so this was built
// by hand: looked up real listed height/weight for 24 current and recent MLB pitchers (e.g.
// Chris Sale 78in/180lb, Paul Skenes 78in/260lb, same height, very different builds), sorted
// them into ecto/meso/endo by eye, and averaged weight/height(in) within each group.
//   Ectomorph cluster (9 pitchers, incl. Sale, Strider, Misiorowski, Fried): avg 2.57
//   Mesomorph cluster (9 pitchers, incl. Cole, Verlander, Skenes, King): avg 2.96
//   Endomorph cluster (6 pitchers, incl. Sabathia, Colon, Bednar, Rasmussen): avg 3.44, but
//     Sabathia/Colon are outlier-heavy historical cases (both famously heavier in person than
//     their listed weight) -- the other 4 modern relievers cluster tightly at 3.13-3.29.
// Final numbers below were picked from that evidence, not the raw cluster averages verbatim.
export const SOMATOTYPE_WEIGHT_MULTIPLIER: Record<Somatotype, number> = {
  ectomorph: 2.5,
  mesomorph: 2.9,
  endomorph: 3.2,
}

export type IsaClassification = 'narrow' | 'wide'

export const ISA_INFO: Record<IsaClassification, { name: string, color: string, tendency: string }> = {
  narrow: {
    name: 'Narrow ISA (<90°) — biased toward external rotation', color: '#a371f7',
    tendency: 'Tends to show up as more naturally mobile into layback/external rotation — often a longer, looser-looking arm action. The tradeoff: often needs more deliberate internal-rotation strength and deceleration work, since the mobility side is already close to free.',
  },
  wide: {
    name: 'Wide ISA (>90°) — biased toward internal rotation', color: '#39d353',
    tendency: 'Tends to show up as a more naturally stable, "closed-off" presentation, often with better natural deceleration. The tradeoff: often needs more deliberate mobility work to access a full, safe layback position, since the structure already biases toward internal rotation.',
  },
}

export const ISA_EXPLAINER = 'The angle where your lower ribs meet at the center of your chest, at the sternum. Under about 90° is a narrow ISA; over 90° is a wide ISA. This comes from postural-assessment work (the Postural Restoration Institute) used seriously in physical therapy and performance circles — but it describes a structural tendency, not a rigid rule. It takes a coach or PT feeling along the lower rib margins, or a relaxed side-on photo, to get a reasonable read — not something to self-diagnose precisely.'

export const ISA_DISCLAIMER = 'Never a reason to skip mobility or stability work just because it "should" come easy for your structure — it\'s a starting lean to plan around, not a substitute for the work.'

// ---------------------------------------------------------------------------
// Structural Profile -- four more coach-assessed, fixed-by-bone-growth classifications,
// same family as ISA above (not trainable, just describes a starting lean). Humeral and
// femoral torsion are tracked per-side since both are well documented to develop
// asymmetrically in throwers (e.g. a pitcher's throwing-arm humeral retroversion is commonly
// greater than their glove arm's -- an adaptation from years of throwing, not a red flag on
// its own). Trail leg = the drive/back leg during the delivery; lead leg = the front/landing
// leg -- same trail/lead convention already used by the hip_rotation_trail_deg/
// hip_rotation_lead_deg benchmarks in lib/benchmarks.ts.
// ---------------------------------------------------------------------------

export type HumeralTorsion = 'retroverted' | 'anteverted' | 'neutral'

export const HUMERAL_TORSION_INFO: Record<HumeralTorsion, { name: string, color: string, tendency: string }> = {
  retroverted: {
    name: 'Retroverted — biased toward external rotation (layback)', color: '#a371f7',
    tendency: 'The humeral head twists backward relative to the elbow\'s axis. This expands the "acceleration runway": during late cocking, retroversion lets the arm lay back into deep external rotation passively, gaining roughly 10-19° of extra range before hitting a bony block — so the internal rotators (pecs, lats, subscap) have more distance to accelerate the ball before release. Because the bone provides this position naturally, the front of the shoulder capsule is spared from extreme stretch to get there. The catch: it comes with a natural loss of internal rotation. If the total rotational arc (ER+IR) stays roughly equal to the other arm, this is a safe, bony adaptation, not something to "fix" — throwing-arm retroversion commonly running higher than the glove arm\'s is exactly this adaptation at work.',
  },
  anteverted: {
    name: 'Anteverted — biased toward internal rotation', color: '#39d353',
    tendency: 'The humeral head twists forward instead of back, reducing or eliminating the usual backward twist. This creates an "early wall" for throwers: reaching for a late-cocking layback position runs into an abrupt bone-on-bone block well before a retroverted shoulder would. Because that acceleration pathway is shortened, forcing elite velocity out of this structure usually means compensating somewhere mechanical instead — over-stretching the front of the shoulder capsule or opening the torso early — which raises stress on the labrum and the elbow\'s UCL. The tradeoff: more internal rotation range is available instead, so external-rotation/layback mobility work usually deserves more deliberate, ongoing attention.',
  },
  neutral: {
    name: 'Neutral — balanced ER/IR, no meaningful bias', color: '#e8b84b',
    tendency: 'Total external and internal rotation split close to evenly — no strong structural lean either way. The arm\'s rotational mobility isn\'t capped by bone on either side specifically, so layback range and deceleration capacity come down more to soft-tissue mobility and strength training than to a fixed structural lean. Neither extra external-rotation mobility work nor extra internal-rotation strength work is specifically indicated by structure alone.',
  },
}

export type FemoralTorsion = 'retroverted' | 'anteverted' | 'neutral'

export const FEMORAL_TORSION_INFO: Record<FemoralTorsion, { name: string, color: string, tendency: string }> = {
  retroverted: {
    name: 'Retroverted — biased toward external rotation', color: '#a371f7',
    tendency: 'The femoral neck twists backward relative to the knee, rotating the thigh outward. This maximizes external rotation (ER) range: the hip can sit into a wide, turned-out, deep squat-style position without bone-on-bone pinching. On the trail leg, that same ER capacity makes it easier to sit deep into the loaded/closed position during leg lift. The tradeoff is less internal rotation (IR) available — forcing a narrow stance or trying to fire the hip internally (e.g. rotating the trail hip open explosively, or a lead leg blocking through internal tracking) runs out of clearance quickly, which can show up down the chain as knee pain, foot over-pronation, or low-back flexion compensations rather than at the hip itself. Structurally, this layout often shows as a slightly out-toed ("duck-footed") stance.',
  },
  anteverted: {
    name: 'Anteverted — biased toward internal rotation', color: '#39d353',
    tendency: 'The femoral neck twists forward relative to the knee, rotating the thigh inward. This maximizes internal rotation (IR) range — a real advantage for transferring force through internally rotated positions, like firing the trail hip open explosively or a lead leg blocking through internal tracking. The tradeoff is limited external rotation (ER): forcing a wide, toes-out stance (e.g. sitting deep into an externally-rotated trail-leg load) runs into an early bone-on-bone block, which can show up as the knee collapsing inward (valgus stress) or hip pinch rather than at the hip itself. Structurally, this layout often shows as a slightly in-toed ("pigeon-toed") stance, and as kids, a natural preference for sitting in a "W" position.',
  },
  neutral: {
    name: 'Neutral — balanced ER/IR, no meaningful bias', color: '#e8b84b',
    tendency: 'Total external and internal rotation split close to evenly at the hip — no strong structural lean either way. Squat stance width and rotational demands during the delivery come down more to mobility and strength training than to a fixed structural lean; neither a wide, externally-rotated stance nor a narrow, internally-rotated one is specifically favored by structure alone.',
  },
}

export type FootArchType = 'high_arch' | 'flat'

export const FOOT_ARCH_INFO: Record<FootArchType, { name: string, color: string, tendency: string }> = {
  high_arch: {
    name: 'High Arch (Pes Cavus) — rigid, direct force transmission', color: '#e8b84b',
    tendency: 'A stiffer, more rigid foot that transmits ground-reaction force more directly through push-off, with less energy lost to the arch flattening. Tends to show up as a "quicker off the ground" feel. The tradeoff: less natural shock absorption, so ankle/calf mobility and landing mechanics usually deserve more deliberate attention to manage the extra impact.',
  },
  flat: {
    name: 'Flat / Flexible Arch (Pes Planus) — more shock absorption', color: '#58a6ff',
    tendency: 'A more mobile, flexible foot that absorbs and dissipates more force through the arch itself. Tends to be a more forgiving, lower-impact structure with less overuse risk, at some cost to how directly force transmits off the rubber/mound during push-off. Unlike the bone-fixed traits above, foot/ankle strength work can meaningfully firm this up over time.',
  },
}

export type ElbowCarryingAngle = 'varus' | 'valgus'

export const ELBOW_CARRYING_ANGLE_INFO: Record<ElbowCarryingAngle, { name: string, color: string, tendency: string }> = {
  varus: {
    name: 'Varus — elbow angles inward at full extension', color: '#58a6ff',
    tendency: 'The forearm sits closer to in-line with the upper arm at full extension, rather than angling outward. Less common in throwers than valgus (see below), and less studied in the injury-risk literature specifically because it carries less of the valgus torque that drives most UCL-stress discussion.',
  },
  valgus: {
    name: 'Valgus — elbow angles outward at full extension', color: '#f85149',
    tendency: 'The forearm angles outward relative to the upper arm at full extension — the more common presentation in throwers, and often itself partly an adaptation to repetitive throwing load rather than purely congenital. This is the angle most directly discussed in UCL-stress literature, since more valgus generally means more leverage for valgus torque during late cocking/arm acceleration — worth knowing, not a diagnosis on its own.',
  },
}

export type ElbowLaxity = 'hypermobile' | 'normal'

export const ELBOW_LAXITY_INFO: Record<ElbowLaxity, { name: string, color: string, tendency: string }> = {
  hypermobile: {
    name: 'Hypermobile — elbow hyperextends past neutral', color: '#a371f7',
    tendency: 'The elbow extends past straight/neutral under passive stress. Tends to show up as a whippier-looking arm action, and the extra passive range can contribute to arm speed. The tradeoff: the joint\'s passive restraint is looser, so deceleration and eccentric strength work usually deserve more deliberate, consistent attention.',
  },
  normal: {
    name: 'Normal — extends to neutral, no hyperextension', color: '#39d353',
    tendency: 'The elbow extends to roughly straight and no further under passive stress — the baseline presentation, with no specific extra deceleration demand tied to laxity itself.',
  },
}

// Rotational laxity (shoulder, hip) -- a different axis than torsion above. Torsion describes
// WHERE a joint's total rotational arc is centered (shifted toward ER or IR); laxity describes
// HOW BIG that total arc is. A loose capsule can enlarge the arc on top of whatever torsion
// already set, so a retroverted shoulder with a hypermobile capsule shows even more ER AND
// more IR than torsion alone would predict -- these two traits stack, they don't substitute for
// each other. One value per joint (not per-side like torsion) since laxity is usually a more
// systemic/whole-body trait, same reasoning as Elbow Laxity above.
export type ShoulderLaxity = 'hypermobile' | 'normal'

export const SHOULDER_LAXITY_INFO: Record<ShoulderLaxity, { name: string, color: string, tendency: string }> = {
  hypermobile: {
    name: 'Hypermobile — more total rotation than torsion alone explains', color: '#a371f7',
    tendency: 'The shoulder capsule allows more total rotational range (ER and IR added together) than humeral torsion alone would predict -- a soft-tissue trait stacked on top of the bony structure, not a substitute for it. Tends to show up as extra layback or reach beyond what the torsion classification above explains, which can help arm speed, but the joint\'s passive restraint is looser across the board. Scapular control and deceleration strength work usually deserve extra, consistent attention.',
  },
  normal: {
    name: 'Normal — total rotation matches torsion alone', color: '#39d353',
    tendency: 'The shoulder capsule\'s total rotational range matches what humeral torsion alone would predict -- no extra soft-tissue laxity stacked on top of the bony structure.',
  },
}

export type HipLaxity = 'hypermobile' | 'normal'

export const HIP_LAXITY_INFO: Record<HipLaxity, { name: string, color: string, tendency: string }> = {
  hypermobile: {
    name: 'Hypermobile — more total rotation than torsion alone explains', color: '#a371f7',
    tendency: 'The hip capsule/ligaments allow more total rotational range (ER and IR added together) than femoral torsion alone would predict. Tends to show up as extra range in both a wide, externally-rotated squat stance AND a narrow, internally-rotated one, beyond what the torsion classification above explains -- useful range, but with less passive joint stability to rely on. Hip and core control work usually deserves extra, consistent attention.',
  },
  normal: {
    name: 'Normal — total rotation matches torsion alone', color: '#39d353',
    tendency: 'The hip capsule/ligaments\' total rotational range matches what femoral torsion alone would predict -- no extra soft-tissue laxity stacked on top of the bony structure.',
  },
}

// Coach-facing testing protocols for the Structural Profile -- how to actually get each
// classification, not just what the values mean. Plain-language, phone-and-hands only (same
// "no special equipment" philosophy as the CMJ/Hop Test/Plyo Push-Up protocols elsewhere in
// this app) since these are visual/manual passive-ROM checks, not something to self-diagnose.
export const HUMERAL_TORSION_HOW_TO_TEST = 'Supine Wall Rotation Test — isolates the shoulder blade so the bony range shows, not a compensated one. Athlete lies flat on their back (or stands with spine/hips flat against a wall). Arm out to the side at 90°, elbow bent 90°, fingers pointing at the ceiling. Put a hand on their lower ribs/shoulder blade to feel for cheating — it and the lower back must stay pinned the whole time. External rotation: lower the back of the hand toward the floor/wall behind them; stop the instant the shoulder blade lifts or the low back arches. Reaching flat is a baseline 90° of ER. Internal rotation: back to center, then rotate the forearm forward/down toward the feet; stop the instant the front of the shoulder blade rolls forward or hitches. Normal isolated IR is roughly 45-60°. Compare throwing arm to glove arm: clearly more ER (flat or past it) with IR stopping early (~20-30°) = Retroverted. ER clearly short of flat paired with deep IR instead = Anteverted. Roughly even on both sides, close to the 90°/45-60° baseline = Neutral.'

export const FEMORAL_TORSION_HOW_TO_TEST = 'Craig\'s Test — the clinical standard for femoral version without imaging. Athlete lies face-down (prone), knee bent to a sharp 90°, foot pointing at the ceiling. Press firmly on the outside of their hip to find the greater trochanter (the hard bony point). Slowly rotate the lower leg side to side, like a windshield wiper, while feeling that spot — stop the instant the trochanter feels like it\'s pointing most directly out to the side (its most prominent point). Now look at where the shin/foot is pointing relative to vertical: a normal profile sits roughly 8-15° short of vertical. If the shin had to tilt in further than that (more than ~15° from vertical) to find the peak, call it Anteverted. If the shin was vertical, or had to tilt only slightly or even toward the other leg (less than ~8° from vertical) to find the peak, call it Retroverted. Right in the 8-15° band = Neutral. Test the trail leg and lead leg separately, same protocol.'

export const SHOULDER_LAXITY_HOW_TO_TEST = 'Using the same Supine Wall Rotation Test setup as Humeral Torsion (90/90 position, scapula pinned), measure ER and IR end-range in degrees and add them together for a total arc. Do this on both arms. If one arm\'s total is clearly bigger than the other\'s (not just shifted toward ER or IR, but genuinely larger overall), call that arm Hypermobile. If the totals are about equal side to side, call it Normal.'

export const HIP_LAXITY_HOW_TO_TEST = 'Using the same prone setup as Craig\'s Test (knee bent 90°), passively rotate the lower leg outward (hip IR) and inward (hip ER), measuring each end-range in degrees, and add them together for a total arc. Do this on both legs. If one leg\'s total is clearly bigger than the other\'s, call that leg Hypermobile. If the totals are about equal side to side, call it Normal.'

export const FOOT_ARCH_HOW_TO_TEST = 'Wet the sole of the foot and have the athlete step once with full weight onto a dry surface (cardboard works), then step off. A thin or broken connection between the heel and ball of the print means a High Arch. A wide print with the midfoot filled in means Flat. (Or just look at a relaxed standing foot from the side: a clear gap of daylight under the arch is High Arch; the arch touching or nearly touching the ground is Flat.)'

export const ELBOW_CARRYING_ANGLE_HOW_TO_TEST = 'Elbow fully straight, palm facing forward. Sight down the arm from the front and look at the angle between the upper arm and forearm. A slight outward angle (roughly 5-15°) is typical. Clearly more open/outward than that — or visibly more than the other arm — call it Valgus. Straighter/in-line, or angled slightly inward instead, call it Varus.'

export const ELBOW_LAXITY_HOW_TO_TEST = 'Elbow fully straight and relaxed. Gently press into further extension. If the joint visibly bends backward past straight, call it Hypermobile. If it stops firmly right at straight with no give, call it Normal.'
