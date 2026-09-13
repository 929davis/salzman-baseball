// Thrower's Ten -- Wilk et al.'s EMG-researched rotator cuff/scapular stabilization program
// for overhead throwing athletes. Replaces the old "hit this foot-pounds target with whatever
// exercises" model with an actual validated program: real exercises, real dosing, published
// outcomes (reduced medial elbow injury incidence, improved ROM and rotator cuff strength in
// systematic-review data), rather than a made-up load number with no exercise attached to it.
//
// Standard dosing per published sources: 2 sets of 10 reps per exercise (band or light
// dumbbell resistance), minimal rest between movements. This is the in-season maintenance
// dose -- an "Advanced Thrower's Ten" exists for off-season strength-building phases with
// heavier loading, not modeled here yet.
export type ThrowersTenExercise = {
  key: string
  order: number
  name: string
  targets: string
  description: string
}

export const THROWERS_TEN_SETS = 2
export const THROWERS_TEN_REPS = 10

export const THROWERS_TEN: ThrowersTenExercise[] = [
  {
    key: 'tt_d2_extension',
    order: 1,
    name: 'Diagonal Pattern D2 Extension',
    targets: 'Rotator cuff, scapular stabilizers (deceleration pattern)',
    description: 'With a band anchored high, start with the arm up and across the body (like reaching over the opposite shoulder), then pull down and out across the body to the opposite hip, rotating the arm as you go. Mimics the deceleration path of the throwing arm.',
  },
  {
    key: 'tt_d2_flexion',
    order: 2,
    name: 'Diagonal Pattern D2 Flexion',
    targets: 'Rotator cuff, scapular stabilizers (acceleration pattern)',
    description: 'Reverse of D2 Extension: band anchored low, start with the arm down and across the body at the opposite hip, then pull up and out across the body to overhead, rotating the arm as you go.',
  },
  {
    key: 'tt_er_0deg',
    order: 3,
    name: 'External Rotation at 0° Abduction',
    targets: 'Infraspinatus, teres minor (posterior rotator cuff)',
    description: 'Elbow tucked at the side and bent 90°, band or light dumbbell in hand, rotate the forearm outward away from the body without letting the elbow drift from your side.',
  },
  {
    key: 'tt_ir_0deg',
    order: 4,
    name: 'Internal Rotation at 0° Abduction',
    targets: 'Subscapularis (anterior rotator cuff)',
    description: 'Same start position as ER at 0°, rotate the forearm inward across the body, keeping the elbow pinned to your side throughout.',
  },
  {
    key: 'tt_er_90deg',
    order: 5,
    name: 'External Rotation at 90° Abduction',
    targets: 'Infraspinatus, teres minor -- loaded closer to the actual throwing position',
    description: 'Arm out to the side at shoulder height, elbow bent 90° ("goal post" position), rotate the forearm upward/backward without dropping the elbow height. Closer to the lay-back position in the throwing motion than the 0° version above.',
  },
  {
    key: 'tt_ir_90deg',
    order: 6,
    name: 'Internal Rotation at 90° Abduction',
    targets: 'Subscapularis -- loaded closer to the actual throwing position',
    description: 'Same "goal post" start as ER at 90°, rotate the forearm forward/downward, keeping the elbow at shoulder height throughout.',
  },
  {
    key: 'tt_shoulder_abduction',
    order: 7,
    name: 'Shoulder Abduction to 90°',
    targets: 'Deltoid, supraspinatus',
    description: 'Arm at the side, thumb rotated slightly down, raise the arm out to the side up to shoulder height (not higher) with control, then lower with control.',
  },
  {
    key: 'tt_prone_horizontal_abduction',
    order: 8,
    name: 'Prone Horizontal Abduction',
    targets: 'Posterior deltoid, rotator cuff, scapular retractors',
    description: 'Lying face-down on a bench with the arm hanging straight down, raise the arm out to the side to shoulder height, thumb rotated slightly up, squeezing the shoulder blade at the top.',
  },
  {
    key: 'tt_prone_rowing',
    order: 9,
    name: 'Prone Rowing',
    targets: 'Rhomboids, mid-trapezius, lats (scapular retraction)',
    description: 'Lying face-down on a bench with the arm hanging straight down and holding a dumbbell or band, row the elbow up and back, driving the shoulder blade toward the spine.',
  },
  {
    key: 'tt_press_ups_plus',
    order: 10,
    name: 'Press-Ups or Push-Ups with a Plus',
    targets: 'Serratus anterior (scapular protraction/upward rotation)',
    description: 'From a push-up position (or seated press-up on chair arms), after full elbow extension, push the shoulder blades further apart/forward ("the plus") before returning -- the extra protraction at the top is the point of the exercise, not just the push-up itself.',
  },
]
