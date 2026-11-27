// The Cradle Coast: deterministic cliff relief, an animated two-frequency sea and a 30 m foam edge.
import * as THREE from 'three';
import { AIRFIELD, PALETTE, SEA, SKY, TERRAIN } from './config.js';
import { clamp, fbm, lerp, smoothstep } from './mathutil.js';

export const AIRFIELD_POSITION = Object.freeze({ x: AIRFIELD.x, y: AIRFIELD.elevation, z: AIRFIELD.z });
export const RUNWAY_HEADING = AIRFIELD.heading;
export const RUNWAY_LENGTH = AIRFIELD.length;

const STACKS = Object.freeze([
  { x: 4700, z: 2250, height: 68, radius: 210 },
  { x: 5150, z: 2450, height: 52, radius: 190 },
  { x: 5600, z: 2550, height: 74, radius: 230 },
  { x: 6050, z: 2500, height: 44, radius: 180 },
]);

function gaussian(x, z, cx, cz, radius) {
  const dx = (x - cx) / radius;
  const dz = (z - cz) / radius;
  return Math.exp(-(dx * dx + dz * dz) * 2);
}

function ellipseGaussian(x, z, cx, cz, radiusX, radiusZ) {
  const dx = (x - cx) / radiusX;
  const dz = (z - cz) / radiusZ;
  return Math.exp(-(dx * dx + dz * dz) * 2);
}

/** Height in metres: a cliffed headland, west bay, south fjord, sea stacks and Skyhaven plateau. */
export function sampleTerrainHeight(x, z, seed = TERRAIN.seed) {
  const f = TERRAIN.frequency;
  const macro = fbm(x * f + 31.7, z * f - 12.4, TERRAIN.octaves, seed);
  const detail = fbm(x * f * 3.1 - 80, z * f * 3.1 + 45, TERRAIN.octaves, seed + 91);
  const coast = 1 - Math.hypot((x - 320) / 4650, (z + 650) / 3560) + (macro - 0.5) * 0.24;
  const land = smoothstep(-0.025, 0.12, coast);

  let height = lerp(-115, 95, land) + Math.max(0, coast) * 390;
  height += (detail - 0.48) * 155 * land;

  const ridgeLine = z - (-1080 + x * 0.115);
  const ridge = Math.exp(-(ridgeLine * ridgeLine) / 330000);
  height += ridge * (155 + macro * 230) * land;
  height += gaussian(x, z, -750, -2180, 1150) * 420 * land;
  height += gaussian(x, z, 2280, -2540, 1000) * 355 * land;
  height += gaussian(x, z, 3140, -1120, 760) * 245 * land;

  const westBay = (1 - smoothstep(-2900, -1050, x)) * smoothstep(-250, 1500, z);
  height = lerp(height, -105, westBay * 0.96);

  const fjordCentre = 540 + z * 0.085;
  const fjordWidth = 1 - smoothstep(150, 500, Math.abs(x - fjordCentre));
  const fjord = smoothstep(330, 1050, z) * fjordWidth;
  height = lerp(height, -125, fjord * 0.985);

  // A 300–400 m crest with two shoulders and a notch. Its seaward face falls 60–120 m
  // across less than 120 m, producing the near-vertical ochre cliffs in the mesh.
  const headlandMask = ellipseGaussian(x, z, 4600, 1000, 1800, 1500);
  if (headlandMask > 0.002) {
    const along = (x - 4400) * 0.78 + (z - 900) * 0.62;
    const shoulderA = gaussian(x, z, 3900, 800, 620) * 62;
    const shoulderB = gaussian(x, z, 5350, 1250, 580) * 58;
    const notch = gaussian(x, z, 5050, 720, 330) * 88;
    const crest = 342 + Math.sin(along * 0.0042) * 34 + (macro - 0.5) * 54 + shoulderA + shoulderB - notch;
    const shore = 1500 + (x - 4200) * 0.33;
    const seawardDistance = z - shore;
    const cliff = smoothstep(25, 105, seawardDistance);
    const coastalHeight = lerp(crest, -42, cliff);
    height = lerp(height, coastalHeight, headlandMask);
  }

  const islandDistance = Math.hypot((x - 2700) / 1.05, z - 3300);
  if (islandDistance < 370) height = Math.max(height, 168 - islandDistance * 0.58);

  for (let index = 0; index < STACKS.length; index += 1) {
    const stack = STACKS[index];
    const distance = Math.hypot(x - stack.x, z - stack.z);
    if (distance < stack.radius) height = Math.max(height, stack.height - distance * (stack.height / stack.radius));
  }

  // A separate peninsula gives Skyhaven a level 210 m plateau above the sea.
  height += gaussian(x, z, AIRFIELD.x, AIRFIELD.z, 1050) * 120;
  height = clamp(Math.round(height / TERRAIN.heightStep) * TERRAIN.heightStep, -180, TERRAIN.maxHeight);
  const plateauDistance = Math.hypot(
    (x - AIRFIELD.x) / TERRAIN.plateauRadiusX,
    (z - AIRFIELD.z) / TERRAIN.plateauRadiusZ,
  );
  const plateau = 1 - smoothstep(0.62, 1.05, plateauDistance);
  return lerp(height, AIRFIELD.elevation, plateau);
}

const SAND = new THREE.Color(PALETTE.sand);
const WET_SAND = new THREE.Color('#8C826B');
const GRASS = new THREE.Color(PALETTE.grass);
const MEADOW = new THREE.Color('#96A365');
const SCRUB = new THREE.Color('#667A45');
const DRY_GRASS = new THREE.Color(PALETTE.dryGrass);
const OCHRE = new THREE.Color('#A0875E');
const ROCK = new THREE.Color(PALETTE.rock);
const DARK_ROCK = new THREE.Color(PALETTE.darkRock);
const SNOW = new THREE.Color(PALETTE.snow);
const SUN_TINT = new THREE.Color('#FFE0A3');
const VALLEY_TINT = new THREE.Color('#53634A');

function terrainColour(x, z, height, slope, variation) {
  const meadow = fbm(x * 0.00075 + 17, z * 0.00075 - 29, 4, 9137);
  const scrub = fbm(x * 0.0021 - 41, z * 0.0021 + 63, 3, 4109);
  const patches = smoothstep(0.38, 0.68, meadow) * (1 - smoothstep(0.54, 0.78, scrub));
  const colour = GRASS.clone().lerp(SCRUB, patches * 0.6).lerp(MEADOW, smoothstep(0.56, 0.78, meadow) * 0.7);

  if (height < 2) colour.copy(WET_SAND).lerp(SAND, smoothstep(0, 2, height));
  else if (height < 7) colour.copy(SAND).lerp(GRASS, smoothstep(2, 7, height) * 0.55);
  else if (slope >= 0.18 && height < 590) {
    const dry = smoothstep(0.18, 0.48, slope);
    colour.copy(GRASS).lerp(DRY_GRASS, dry);
    const rockAmount = smoothstep(0.32, 0.7, slope);
    colour.lerp(OCHRE, rockAmount).lerp(ROCK, smoothstep(0.62, 0.82, slope));
    colour.lerp(DARK_ROCK, smoothstep(0.55, 1.08, slope));
    const strata = Math.floor(height / 18) % 2 === 0 ? 0.92 : 1.08;
    colour.multiplyScalar(strata);
  }

  const snowLine = smoothstep(640, 710, height + (variation - 0.5) * 36);
  colour.lerp(SNOW, snowLine);
  const valley = smoothstep(0.44, 0.78, fbm(x * 0.00135 - 73, z * 0.00135 + 19, 4, 6203));
  colour.lerp(VALLEY_TINT, valley * 0.12 * (1 - snowLine));
  const sunSide = clamp(0.5 + (variation - 0.5) * 0.7 + (meadow - 0.5) * 0.3, 0, 1);
  colour.lerp(SUN_TINT, sunSide * 0.07);
  colour.multiplyScalar(0.93 + (variation - 0.5) * 0.1);
  const groundTexture = fbm(x * 0.004, z * 0.004, 4, 4411);
  const fineTexture = fbm(x * 0.02, z * 0.02, 3, 9029);
  const textureTint = 1 + (groundTexture - 0.5) * 0.18;
  const scrubDarkening = 1 - (1 - smoothstep(0.2, 0.5, fineTexture)) * 0.06;
  colour.multiplyScalar(textureTint * scrubDarkening);
  return colour;
}

function createFoamRibbon(scene) {
  const samples = TERRAIN.coastFoamSamples;
  const stride = TERRAIN.size / samples;
  const heights = new Float32Array((samples + 1) * (samples + 1));
  for (let row = 0; row <= samples; row += 1) {
    const z = -TERRAIN.size / 2 + row * stride;
    for (let column = 0; column <= samples; column += 1) {
      heights[row * (samples + 1) + column] = sampleTerrainHeight(-TERRAIN.size / 2 + column * stride, z);
    }
  }
  const segments = [];
  function crossing(ax, az, ah, bx, bz, bh) {
    if ((ah < 0) === (bh < 0)) return null;
    const amount = ah / (ah - bh);
    return [lerp(ax, bx, amount), lerp(az, bz, amount)];
  }
  for (let row = 0; row < samples; row += 1) {
    for (let column = 0; column < samples; column += 1) {
      const x = -TERRAIN.size / 2 + column * stride;
      const z = -TERRAIN.size / 2 + row * stride;
      const i = row * (samples + 1) + column;
      const h00 = heights[i];
      const h10 = heights[i + 1];
      const h01 = heights[i + samples + 1];
      const h11 = heights[i + samples + 2];
      const points = [];
      const a = crossing(x, z, h00, x + stride, z, h10);
      const b = crossing(x + stride, z, h10, x + stride, z + stride, h11);
      const c = crossing(x + stride, z + stride, h11, x, z + stride, h01);
      const d = crossing(x, z + stride, h01, x, z, h00);
      if (a) points.push(a);
      if (b) points.push(b);
      if (c) points.push(c);
      if (d) points.push(d);
      if (points.length >= 2) segments.push([points[0], points[1]]);
      if (points.length === 4) segments.push([points[2], points[3]]);
    }
  }

  function ribbon(width, opacity, y) {
    const positions = new Float32Array(segments.length * 12);
    const indices = new Uint32Array(segments.length * 6);
    let vertex = 0;
    for (let index = 0; index < segments.length; index += 1) {
      const [p0, p1] = segments[index];
      const dx = p1[0] - p0[0];
      const dz = p1[1] - p0[1];
      const length = Math.hypot(dx, dz) || 1;
      const nx = -dz / length * width;
      const nz = dx / length * width;
      const base = vertex;
      positions.set([
        p0[0] + nx, y, p0[1] + nz, p0[0] - nx, y, p0[1] - nz,
        p1[0] + nx, y, p1[1] + nz, p1[0] - nx, y, p1[1] - nz,
      ], base * 3);
      indices.set([base, base + 1, base + 2, base + 2, base + 1, base + 3], index * 6);
      vertex += 4;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    const foam = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      color: PALETTE.foam, transparent: true, opacity, depthWrite: false,
      side: THREE.DoubleSide, fog: true,
    }));
    foam.name = width > 5 ? 'Thirty metre surf' : 'Breaking foam';
    foam.renderOrder = 2;
    scene.add(foam);
    return foam;
  }
  return [ribbon(15, 0.32, 0.65), ribbon(2.2, 0.78, 0.82)];
}

function createSea(scene) {
  const geometry = new THREE.PlaneGeometry(SEA.size, SEA.size, 1, 1);
  geometry.rotateX(-Math.PI / 2);
  const azimuth = SKY.sunAzimuth;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color('#12505F') },
      uShallow: { value: new THREE.Color('#2E8A93') },
      uFoam: { value: new THREE.Color(PALETTE.foam) },
      uFog: { value: new THREE.Color(PALETTE.fog) },
      uFogNear: { value: SKY.fogNear },
      uFogFar: { value: SKY.fogFar },
      uSun: { value: new THREE.Vector2(Math.sin(azimuth), -Math.cos(azimuth)) },
      uSky: { value: new THREE.Color('#A8C6D8') },
      uSunElevation: { value: SKY.sunElevation },
      uSunWarm: { value: new THREE.Color('#FFF1D6') },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uFoam;
      uniform vec3 uFog;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform vec2 uSun;
      uniform vec3 uSky;
      uniform float uSunElevation;
      uniform vec3 uSunWarm;
      varying vec3 vWorld;
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      void addWave(
        vec2 point, vec2 direction, float frequency, float amplitude, float phase,
        inout float height, inout vec2 gradient
      ) {
        float angle = dot(point, direction) * frequency + phase;
        height += sin(angle) * amplitude;
        gradient += direction * (cos(angle) * frequency * amplitude);
      }
      void main() {
        float distance = length(cameraPosition - vWorld);
        float detailFade = exp(-distance / 2500.0);
        float waveHeight = 0.0;
        vec2 slope = vec2(0.0);
        addWave(vWorld.xz, normalize(vec2(1.0, 0.31)), 0.113, 0.46, uTime * 1.10, waveHeight, slope);
        addWave(vWorld.xz, normalize(vec2(-0.37, 1.0)), 0.173, 0.24, uTime * 1.45, waveHeight, slope);
        addWave(vWorld.xz, normalize(vec2(0.67, -0.79)), 0.287, 0.105, uTime * 1.90, waveHeight, slope);
        addWave(vWorld.xz, normalize(vec2(-0.93, -0.27)), 0.461, 0.014 * detailFade, uTime * 2.45, waveHeight, slope);
        addWave(vWorld.xz, normalize(vec2(1.0, 0.18)), 0.012, 0.40, uTime * 0.24, waveHeight, slope);
        addWave(vWorld.xz, normalize(vec2(0.42, 1.0)), 0.009, 0.28, uTime * 0.19, waveHeight, slope);
        addWave(vWorld.xz, normalize(vec2(-0.26, 1.0)), 0.024, 0.20, uTime * 0.31, waveHeight, slope);
        float steepness = length(slope);
        vec3 normal = normalize(vec3(-slope.x * 1.55, 1.0, -slope.y * 1.55));
        vec3 viewRay = normalize(cameraPosition - vWorld);
        float facing = max(dot(normal, viewRay), 0.0);
        float fresnel = 0.02 + 0.98 * pow(1.0 - facing, 5.0);
        float crest = smoothstep(0.5, 1.25, waveHeight);
        float capCrest = smoothstep(0.78, 1.02, waveHeight);
        vec3 colour = mix(uDeep, uShallow, 0.07 + crest * 0.08);
        colour = mix(colour, uSky, fresnel * 0.585);

        float capNoise = hash(floor(vWorld.xz * 1.1));
        float whitecaps = capCrest
          * smoothstep(0.085, 0.18, steepness)
          * smoothstep(0.76, 0.97, capNoise);
        colour = mix(colour, uFoam, whitecaps * 0.30);

        vec3 sunDir = normalize(vec3(
          uSun.x * cos(uSunElevation),
          sin(uSunElevation),
          uSun.y * cos(uSunElevation)
        ));
        float sunAlignment = max(dot(reflect(-viewRay, normal), sunDir), 0.0);
        float sunGlitter = pow(sunAlignment, 32.0);
        float sunSheen = pow(sunAlignment, 7.0);
        colour += uSunWarm * (sunGlitter * 0.9 + sunSheen * 0.12);

        float distanceFog = smoothstep(uFogNear, uFogFar, length(cameraPosition - vWorld));
        float horizonBand = 1.0 - smoothstep(0.001, 0.006, abs(viewRay.y));
        colour = mix(colour, uFog, max(distanceFog, horizonBand * 0.92));
        gl_FragColor = vec4(colour, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        gl_FragColor.rgb += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
      }
    `,
  });
  const sea = new THREE.Mesh(geometry, material);
  sea.name = 'Cradle Sea';
  sea.position.y = SEA.level;
  scene.add(sea);
  return sea;
}

/** Build the static coast, sea and surf once. The airfield lives in landmarks.js. */
export function createTerrain(scene) {
  const geometry = new THREE.PlaneGeometry(TERRAIN.size, TERRAIN.size, TERRAIN.segments, TERRAIN.segments);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  for (let index = 0; index < positions.count; index += 1) {
    positions.setY(index, sampleTerrainHeight(positions.getX(index), positions.getZ(index)));
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  const normals = geometry.attributes.normal;
  const colours = new Float32Array(positions.count * 3);
  for (let index = 0; index < positions.count; index += 1) {
    const height = positions.getY(index);
    const slope = 1 - normals.getY(index);
    const variation = fbm(positions.getX(index) * 0.002, positions.getZ(index) * 0.002, 2, 733);
    const colour = terrainColour(positions.getX(index), positions.getZ(index), height, slope, variation);
    colours[index * 3] = colour.r;
    colours[index * 3 + 1] = colour.g;
    colours[index * 3 + 2] = colour.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  const terrain = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  terrain.name = 'The Cradle Coast';
  scene.add(terrain);

  const sea = createSea(scene);
  const foam = createFoamRibbon(scene);
  return {
    terrain,
    sea,
    foam,
    update(time) { sea.material.uniforms.uTime.value = time; },
  };
}
