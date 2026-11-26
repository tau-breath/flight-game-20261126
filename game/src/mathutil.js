// Small deterministic maths shared by the terrain, clouds and effects.
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, amount) {
  return a + (b - a) * amount;
}

export function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Frame-rate independent exponential smoothing. */
export function damp(current, target, stiffness, dt) {
  return lerp(current, target, 1 - Math.exp(-stiffness * dt));
}

/** Mulberry32: one compact seeded stream, returned as a 0..1 function. */
export function createRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One mulberry step is used as the lattice hash, so value noise is seeded without allocating a
// random generator for every corner of every octave.
function latticeHash(x, z, seed) {
  let a = (Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ seed) | 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Smooth value noise in the 0..1 range. Integer lattice cells keep it stable at large metres. */
export function valueNoise2(x, z, seed = 0) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = x - x0;
  const tz = z - z0;
  const ux = tx * tx * (3 - 2 * tx);
  const uz = tz * tz * (3 - 2 * tz);
  const a = latticeHash(x0, z0, seed);
  const b = latticeHash(x0 + 1, z0, seed);
  const c = latticeHash(x0, z0 + 1, seed);
  const d = latticeHash(x0 + 1, z0 + 1, seed);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uz);
}

/** Normalised fractal Brownian motion. More octaves add detail without changing the range. */
export function fbm(x, z, octaves = 4, seed = 0, lacunarity = 2, gain = 0.5) {
  let amplitude = 1;
  let total = 0;
  let norm = 0;
  let px = x;
  let pz = z;
  for (let octave = 0; octave < octaves; octave += 1) {
    total += valueNoise2(px, pz, seed + octave * 1013) * amplitude;
    norm += amplitude;
    amplitude *= gain;
    px *= lacunarity;
    pz *= lacunarity;
  }
  return total / norm;
}

export function wrapDegrees(degrees) {
  return ((degrees % 360) + 360) % 360;
}
