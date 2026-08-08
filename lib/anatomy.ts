export type BodyArea = 'upper_body' | 'core' | 'lower_body'
export type BodyView = 'front' | 'back'

export type Hotspot = {
  view: BodyView
  cx: number
  cy: number
  rx: number
  ry: number
}

export type AnatomyRegion = {
  id: string
  name: string
  area: BodyArea
  deliveryRole: string
  strengthening: string[]
  mobilityStability: string[]
  sorenessRelief: string[]
  hotspots: Hotspot[]
}

// Content below is placeholder/example text for confirming the interaction pattern —
// not final. Real region content gets added here incrementally, one AnatomyRegion entry
// (plus its hotspot coordinates) at a time. No component changes are needed to add a region.
export const ANATOMY_REGIONS: AnatomyRegion[] = [
  {
    id: 'front_shoulder_pec_minor',
    name: 'Front of Shoulder / Pec Minor',
    area: 'upper_body',
    deliveryRole: 'Pec minor runs from the ribs to the coracoid process and pulls the scapula forward and down. It\'s active through arm deceleration and follow-through, but a chronically tight or short pec minor pulls the shoulder into a rounded, protracted position — closing down the space the rotator cuff needs to work in, and a common contributor to shoulder impingement in throwers.',
    strengthening: ['Scapular protraction/retraction with band', 'Serratus punch (wall or supine)', 'Prone Y-T-W raises'],
    mobilityStability: ['Doorway pec stretch at low, mid, and high arm angles', 'Foam roller thoracic extension', 'Sleeper stretch (pairs with posterior capsule work)'],
    sorenessRelief: ['Lacrosse ball release under the pec, below the collarbone', 'Cross-body pec minor stretch against a wall corner', 'Heat before mobility work, ice after high-volume throwing days'],
    hotspots: [
      {view:'front',cx:95,cy:120,rx:18,ry:14},
      {view:'front',cx:145,cy:120,rx:18,ry:14},
    ],
  },
  {
    id: 'obliques',
    name: 'Obliques',
    area: 'core',
    deliveryRole: 'The obliques decelerate trunk rotation on the front side and transfer force from the lower half through the trunk to the arm. They\'re loaded heavily eccentrically at ball release and follow-through — a common site of in-season soreness, and when overloaded without enough recovery, of oblique strains.',
    strengthening: ['Pallof press (anti-rotation)', 'Landmine rotations', 'Med ball rotational throws'],
    mobilityStability: ['Open books (thoracic rotation)', 'Side-lying trunk rotation stretch', 'Standing trunk rotation with a dowel'],
    sorenessRelief: ['Side-lying foam roll along the rib cage', 'Child\'s pose with a lateral reach', 'Reduce rotational med ball volume for 48–72 hours if soreness is sharp and localized, not just general'],
    hotspots: [
      {view:'front',cx:85,cy:220,rx:14,ry:22},
      {view:'front',cx:155,cy:220,rx:14,ry:22},
      {view:'back',cx:85,cy:225,rx:14,ry:22},
      {view:'back',cx:155,cy:225,rx:14,ry:22},
    ],
  },
  {
    id: 'glutes',
    name: 'Glutes',
    area: 'lower_body',
    deliveryRole: 'The glutes (max and medius) stabilize the pelvis during single-leg stance at foot strike and drive hip extension into the front-leg block. Weak or under-recruited glutes shift more of that stabilization job onto the lower back and front-side knee — a common source of both lower back tightness and front knee soreness in pitchers.',
    strengthening: ['Single-leg RDL', 'Barbell hip thrust', 'Lateral band walks / monster walks'],
    mobilityStability: ['90/90 hip switches', 'Single-leg glute bridge hold', 'Half-kneeling hip flexor stretch (frees up glute-side hip extension)'],
    sorenessRelief: ['Lacrosse ball or foam roll on the glute med / piriformis area', 'Pigeon pose', 'Contrast heat/cold for chronic tightness vs. ice for acute soreness'],
    hotspots: [
      {view:'back',cx:100,cy:310,rx:20,ry:16},
      {view:'back',cx:140,cy:310,rx:20,ry:16},
    ],
  },
  {
    id: 'hamstrings',
    name: 'Hamstrings',
    area: 'lower_body',
    deliveryRole: '',
    strengthening: [],
    mobilityStability: [],
    sorenessRelief: [],
    hotspots: [
      {view:'back',cx:95,cy:420,rx:16,ry:30},
      {view:'back',cx:145,cy:420,rx:16,ry:30},
    ],
  },
]
