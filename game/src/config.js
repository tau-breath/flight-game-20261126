// All WINDWARD tuning, dimensions, routes and colours live here. Distances are metres, time is seconds,
// angles in the simulation are radians unless a property explicitly says degrees.
export const DESIGN = Object.freeze({ width: 1280, height: 800 });
export const STEP = 1 / 60;
export const MAX_FRAME = 0.25;
export const FONT = Object.freeze({
  ui: '"Barlow Condensed", "DejaVu Sans", sans-serif',
  body: 'Inter, "DejaVu Sans", sans-serif',
  sizes: Object.freeze({ small: 10, label: 12, readout: 18, mission: 20 }),
});
export const BEST_KEY = 'windward.coast-patrol.best';

export const PALETTE = Object.freeze({
  ink: '#102F38', panel: '#10282E', panelSoft: '#173B42', cream: '#F3E7CE',
  brass: '#C69A52', amber: '#FFC46B', red: '#E2564A', teal: '#2E7E78',
  sea: '#1F6C7C', seaLight: '#76B4B2', foam: '#EAF3F2', sand: '#D9C79A',
  grass: '#7C9A4F', dryGrass: '#A9B071', rock: '#8A7A63', darkRock: '#6B5E4B',
  snow: '#F2F0EA', skyZenith: '#1F5FA8', skyMid: '#6FA8D6', skyHorizon: '#F8D2A0',
  sun: '#FFF3D0', fog: '#EADCC4', runway: '#3A3F42', creamLine: '#EFE6D2',
  roof: '#A85F43', glass: '#80B8BD', wood: '#66503B', leather: '#594333',
});

export const FLIGHT = Object.freeze({
  gravity: 9.81, thrust: 5200, mass: 1180, dragArea: 0.5 * 1.225 * 0.92,
  velocityTurnRate: 6, stallSpeed: 33, stallLift: 0.4, stallDrop: 0.5,
  maxTurnRate: 1.2, rollRate: 2.6, pitchRate: 0.9, rudderRate: 0.5,
  pitchAuthoritySpeed: 45, fuelIdleBurn: 0.0025, fuelThrottleBurn: 0.010,
  damageThrustScale: 200, collisionSpeed: 6, crashDamage: 100,
  groundClearance: 1.25, waterClearance: 1.35, maxBank: 1.35,
  landingSink: 2.6, landingBank: THREE_DEG(12), landingMinKt: 48,
  landingMaxKt: 62, landingHeading: 2, touchdownDrag: 1.8, rollFriction: 0.55,
});
function THREE_DEG(value) { return value * Math.PI / 180; }

export const AIRCRAFT = Object.freeze({
  name: 'Kestrel Mk.I', fuselageLength: 8.4, noseRadius: 0.55, tailRadius: 0.18,
  wingSpan: 11, wingChord: 1.75, wingDihedral: THREE_DEG(1.5), propRadius: 1.25,
  gearHeight: 1.25, eyeHeight: 2.5, eyeForward: 1.2,
});

export const AIRFIELD = Object.freeze({
  name: 'SKYHAVEN', x: 6200, z: -1200, elevation: 210, heading: 90,
  length: 900, width: 40, runwayHeading: 90, runwayLength: 900, runwayWidth: 40,
  position: Object.freeze({ x: 6200, y: 210, z: -1200 }),
  thresholdX: 5750, endX: 6650,
});

export const TERRAIN = Object.freeze({
  size: 12000, segments: 200, seed: 1729, octaves: 4, frequency: 0.00031,
  maxHeight: 780, airfieldHeight: AIRFIELD.elevation, plateauRadiusX: 980, plateauRadiusZ: 540,
  heightStep: 8, coastFoamSamples: 144,
});

export const SEA = Object.freeze({
  size: 20000, level: 0, rippleSpeed: 0.55, rippleScale: 0.075,
});

export const SKY = Object.freeze({
  radius: 9000, sunElevation: THREE_DEG(20), sunAzimuth: THREE_DEG(112),
  sunDiscSize: 470, glowSize: 1900, cloudCount: 22, cloudMinHeight: 700,
  cloudMaxHeight: 1300, cloudMinScale: 420, cloudMaxScale: 900,
  cloudDrift: 2.2, fogNear: 2800, fogFar: 13000,
});

export const CAMERA = Object.freeze({
  chaseBack: 15, chaseUp: 4.2, lookAhead: 18.2, lookUp: 2.4,
  chaseFov: 60, speedFov: 72, cockpitFov: 64, cockpitLookAhead: 60, cockpitLookDown: 9.0, cockpitEyeSide: -0.12, stiffness: 8, bankRoll: 0.35,
  stallShake: 0.11, near: 0.15, far: 9200,
});

export const RINGS = Object.freeze({
  radius: 26, tube: 3.0, color: '#F0A03C', passedColor: '#6E5A3C',
});

// Combat tuning. The Kestrel carries two cowl guns, four rockets and three flare pods; the
// raiders, the flak barge and the gunboat answer with their own fire.
export const COMBAT = Object.freeze({
  gunRate: 9.5, gunSpeed: 780, gunSpread: 0.0055, gunDamage: 7, gunLife: 1.5, gunAmmo: 1150,
  gunConverge: 420, muzzleLeft: -1.15, muzzleRight: 1.15, muzzleUp: 0.18, muzzleForward: -3.2,
  lockCone: 0.30, lockTime: 1.1, lockRange: 1700, lockMinRange: 90,
  missileSpeed: 320, missileAccel: 240, missileTurn: 3.2, missileLife: 7.5,
  missileDamage: 78, missileCount: 4, missileFuse: 12,
  flareCount: 3, flareTime: 3.4, evadeTime: 1.05, evadeTurn: 7.4, evadeGuard: 0.25,
  enemyRate: 5.2, enemySpeed: 620, enemyDamage: 4.2, enemySpread: 0.019, enemyRange: 820,
  flakDamage: 8, flakRadius: 24, flakRate: 1.15, flakRange: 980,
  hull: 100, hitFlash: 0.24,
  scoreKillFighter: 320, scoreKillGunboat: 520, scoreKillFlak: 380,
  scoreHit: 12, scoreGate: 120, scoreSoftLanding: 300,
});

export const FORCES = Object.freeze({
  fighterRadius: 6.4, fighterHealth: 34, fighterSpeed: 96, fighterTurn: 1.5,
  gunboatRadius: 26, gunboatHealth: 150, flakHealth: 90,
  raiderColour: '#B0603C', raiderTrim: '#39464B', raiderGlass: '#CFE6E8',
});

export const MISSIONS = Object.freeze([
  // The strike sortie: gates in, raiders to splash, a flotilla to silence, one gate out.
  Object.freeze({
    id: 'strike', kind: 'strike', name: 'STRIKE RUN', goal: 'Intercept, then silence the flotilla',
    timeLimit: 250, time: 250,
    route: Object.freeze([
      Object.freeze({ x: 5300, y: 215, z: -1120, heading: 202 }),
      Object.freeze({ x: 5080, y: 195, z: -520, heading: 206 }),
      Object.freeze({ x: 4900, y: 245, z: 160, heading: 210 }),
      Object.freeze({ x: 4740, y: 430, z: 980, heading: 216 }),
    ]),
    waypoints: Object.freeze([]),
    start: Object.freeze({ x: 5560, y: 300, z: -1820, heading: 200 }),
    stages: Object.freeze([
      Object.freeze({ id: 'run-in', kind: 'rings', title: 'RUN-IN', goal: 'Thread three coastal gates', rings: 3 }),
      Object.freeze({ id: 'intercept', kind: 'destroy', title: 'INTERCEPT', goal: 'Splash the raider pair', targets: Object.freeze(['raider-1', 'raider-2']) }),
      Object.freeze({ id: 'strike', kind: 'destroy', title: 'STRIKE', goal: 'Silence the flotilla', targets: Object.freeze(['gunboat-1', 'flak-1', 'flak-2']) }),
      Object.freeze({ id: 'egress', kind: 'rings', title: 'EGRESS', goal: 'Exit through the last gate', rings: 4 }),
    ]),
    waves: Object.freeze([
      Object.freeze({ id: 'raiders', at: 0, units: Object.freeze([
        Object.freeze({ id: 'raider-1', kind: 'fighter', x: 5120, y: 226, z: -830, heading: 22, speed: 100, ace: true }),
        Object.freeze({ id: 'raider-2', kind: 'fighter', x: 5330, y: 196, z: -650, heading: 30, speed: 92, ace: false }),
      ]) }),
      Object.freeze({ id: 'flotilla', at: 2, units: Object.freeze([
        Object.freeze({ id: 'gunboat-1', kind: 'gunboat', x: 5150, y: 0, z: -230, heading: 118, speed: 4.5 }),
        Object.freeze({ id: 'flak-1', kind: 'flak', x: 5000, y: 0, z: -560, heading: 90, speed: 0 }),
        Object.freeze({ id: 'flak-2', kind: 'flak', x: 5360, y: 0, z: -150, heading: 90, speed: 0 }),
      ]) }),
    ]),
  }),
  Object.freeze({
    id: 'ridge', kind: 'rings', name: 'RIDGE RINGS', goal: 'Thread eight headland rings',
    timeLimit: 150, time: 150,
    route: Object.freeze([
      Object.freeze({ x: 3500, y: 310, z: 600, heading: 105 }),
      Object.freeze({ x: 3950, y: 284, z: 1300, heading: 100 }),
      Object.freeze({ x: 4420, y: 340, z: 2528, heading: 87 }),
      Object.freeze({ x: 4850, y: 320, z: 1550, heading: 320 }),
      Object.freeze({ x: 5300, y: 300, z: 1250, heading: 20 }),
      Object.freeze({ x: 5550, y: 176, z: 700, heading: 15 }),
      Object.freeze({ x: 5100, y: 280, z: 250, heading: 30 }),
      Object.freeze({ x: 4550, y: 284, z: 0, heading: 45 }),
    ]),
    waypoints: Object.freeze([]),
  }),
  Object.freeze({
    id: 'fjord', kind: 'fjord', name: 'FJORD RUN', goal: 'Run six low fjord gates',
    timeLimit: 180, time: 180,
    route: Object.freeze([
      Object.freeze({ x: 625, y: 58, z: 1000, heading: 175 }),
      Object.freeze({ x: 659, y: 55, z: 1400, heading: 175 }),
      Object.freeze({ x: 693, y: 68, z: 1800, heading: 175 }),
      Object.freeze({ x: 727, y: 60, z: 2200, heading: 175 }),
      Object.freeze({ x: 761, y: 66, z: 2600, heading: 175 }),
      Object.freeze({ x: 795, y: 62, z: 3000, heading: 175 }),
    ]),
    waypoints: Object.freeze([]),
  }),
  Object.freeze({
    id: 'home', kind: 'home', name: 'HOME APPROACH', goal: 'Two waypoints, then land east',
    timeLimit: 210, time: 210, route: Object.freeze([]),
    waypoints: Object.freeze([
      Object.freeze({ x: 4300, y: 340, z: AIRFIELD.z }),
      Object.freeze({ x: 5100, y: 225, z: AIRFIELD.z }),
    ]),
  }),
]);

export const HUD = Object.freeze({
  cream: PALETTE.cream, amber: PALETTE.amber, red: PALETTE.red, brass: PALETTE.brass,
  panel: 'rgba(12, 35, 41, 0.76)', panelEdge: 'rgba(198, 154, 82, 0.75)',
  heading: Object.freeze({ x: 470, y: 18, width: 340, height: 34 }),
  speedTape: Object.freeze({ x: 44, y: 280, width: 60, height: 240 }),
  altitudeTape: Object.freeze({ x: 1176, y: 280, width: 60, height: 240 }),
  instruments: Object.freeze({ y: 726, radius: 34, centres: [70, 164, 258] }),
  engine: Object.freeze({ x: 1030, y: 690, width: 210, height: 92 }),
  mission: Object.freeze({ x: 24, y: 20, width: 406, height: 76 }),
  stages: Object.freeze({ x: 24, y: 104, width: 406, height: 96 }),
  weapons: Object.freeze({ x: 306, y: 686, width: 300, height: 96 }),
  radar: Object.freeze({ x: 1148, y: 584, radius: 60 }),
});
