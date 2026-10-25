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
