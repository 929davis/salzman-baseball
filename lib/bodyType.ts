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

export type HumeralTorsion = 'retroverted' | 'anteverted'

export const HUMERAL_TORSION_INFO: Record<HumeralTorsion, { name: string, color: string, tendency: string }> = {
  retroverted: {
    name: 'Retroverted — biased toward external rotation (layback)', color: '#a371f7',
    tendency: 'The humeral head twists backward relative to the elbow\'s axis. This expands the "acceleration runway": during late cocking, retroversion lets the arm lay back into deep external rotation passively, gaining roughly 10-19° of extra range before hitting a bony block — so the internal rotators (pecs, lats, subscap) have more distance to accelerate the ball before release. Because the bone provides this position naturally, the front of the shoulder capsule is spared from extreme stretch to get there. The catch: it comes with a natural loss of internal rotation. If the total rotational arc (ER+IR) stays roughly equal to the other arm, this is a safe, bony adaptation, not something to "fix" — throwing-arm retroversion commonly running higher than the glove arm\'s is exactly this adaptation at work.',
  },
  anteverted: {
    name: 'Anteverted — biased toward internal rotation', color: '#39d353',
    tendency: 'The humeral head twists forward instead of back, reducing or eliminating the usual backward twist. This creates an "early wall" for throwers: reaching for a late-cocking layback position runs into an abrupt bone-on-bone block well before a retroverted shoulder would. Because that acceleration pathway is shortened, forcing elite velocity out of this structure usually means compensating somewhere mechanical instead — over-stretching the front of the shoulder capsule or opening the torso early — which raises stress on the labrum and the elbow\'s UCL. The tradeoff: more internal rotation range is available instead, so external-rotation/layback mobility work usually deserves more deliberate, ongoing attention.',
  },
}

export type FemoralTorsion = 'retroverted' | 'anteverted'

export const FEMORAL_TORSION_INFO: Record<FemoralTorsion, { name: string, color: string, tendency: string }> = {
  retroverted: {
    name: 'Retroverted — biased toward external rotation', color: '#a371f7',
    tendency: 'The hip socket sits oriented to allow more external rotation, less internal. On the trail leg, tends to make it easier to sit deep into the loaded/closed position during leg lift; the tradeoff is less internal rotation range to fire the hip open explosively. On the lead leg, it can make a firm, rotated-open front-side block harder to access without deliberate internal-rotation work.',
  },
  anteverted: {
    name: 'Anteverted — biased toward internal rotation', color: '#39d353',
    tendency: 'The hip socket sits oriented to allow more internal rotation, less external. On the trail leg, tends to make firing/rotating the hip open easier and more natural; the tradeoff is less range to sit deep into an externally-rotated load without deliberate mobility work. On the lead leg, it often makes a stable, blocking front side easier to access naturally.',
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

// Coach-facing testing protocols for the Structural Profile -- how to actually get each
// classification, not just what the values mean. Plain-language, phone-and-hands only (same
// "no special equipment" philosophy as the CMJ/Hop Test/Plyo Push-Up protocols elsewhere in
// this app) since these are visual/manual passive-ROM checks, not something to self-diagnose.
export const HUMERAL_TORSION_HOW_TO_TEST = 'Supine Wall Rotation Test — isolates the shoulder blade so the bony range shows, not a compensated one. Athlete lies flat on their back (or stands with spine/hips flat against a wall). Arm out to the side at 90°, elbow bent 90°, fingers pointing at the ceiling. Put a hand on their lower ribs/shoulder blade to feel for cheating — it and the lower back must stay pinned the whole time. External rotation: lower the back of the hand toward the floor/wall behind them; stop the instant the shoulder blade lifts or the low back arches. Reaching flat is a baseline 90° of ER. Internal rotation: back to center, then rotate the forearm forward/down toward the feet; stop the instant the front of the shoulder blade rolls forward or hitches. Normal isolated IR is roughly 45-60°. Compare throwing arm to glove arm: clearly more ER (flat or past it) with IR stopping early (~20-30°) = Retroverted. ER clearly short of flat paired with deep IR instead = Anteverted.'

export const FEMORAL_TORSION_HOW_TO_TEST = 'Athlete lies face-down, knee bent to 90°. Swing the lower leg outward, away from the body — that range is hip internal rotation. Swing it inward, crossing toward the other leg — that range is hip external rotation. If IR is clearly bigger than ER, call it Anteverted. If ER is clearly bigger than IR, call it Retroverted. Test the trail leg and lead leg separately, same protocol.'

export const FOOT_ARCH_HOW_TO_TEST = 'Wet the sole of the foot and have the athlete step once with full weight onto a dry surface (cardboard works), then step off. A thin or broken connection between the heel and ball of the print means a High Arch. A wide print with the midfoot filled in means Flat. (Or just look at a relaxed standing foot from the side: a clear gap of daylight under the arch is High Arch; the arch touching or nearly touching the ground is Flat.)'

export const ELBOW_CARRYING_ANGLE_HOW_TO_TEST = 'Elbow fully straight, palm facing forward. Sight down the arm from the front and look at the angle between the upper arm and forearm. A slight outward angle (roughly 5-15°) is typical. Clearly more open/outward than that — or visibly more than the other arm — call it Valgus. Straighter/in-line, or angled slightly inward instead, call it Varus.'

export const ELBOW_LAXITY_HOW_TO_TEST = 'Elbow fully straight and relaxed. Gently press into further extension. If the joint visibly bends backward past straight, call it Hypermobile. If it stops firmly right at straight with no give, call it Normal.'
