import * as THREE from 'three';
import { AIRFIELD, TERRAIN } from './config.js';
import { createRandom, fbm } from './mathutil.js';
import { sampleTerrainHeight } from './terrain.js';

const CONIFER_COUNT = 2100;
const BUSH_COUNT = 1300;
const BOULDER_COUNT = 450;
const SLOPE_SAMPLE = 18;

/** Keep the runway and the exposed sea stacks clear of vegetation. */
function cleared(x, z) {
  if (Math.abs(x - AIRFIELD.x) < 760 && Math.abs(z - AIRFIELD.z) < 300) return true;
  return x > 4400 && x < 6300 && z > 2000 && z < 2900;
}

/** Two wide bands of conifers with broken margins and a central meadow; no trees in the sea-stack shallows. */
function forestMask(x, z) {
  if (x >= -400 && x <= 900 && z >= -300 && z <= 900) return 0;
  const ridge = Math.exp(-Math.pow((z - (-1080 + x * 0.115)) / 520, 2));
  const xWindow = THREE.MathUtils.smoothstep(x, -2300, -1300) * (1 - THREE.MathUtils.smoothstep(x, 3600, 4500));
  const headland = THREE.MathUtils.smoothstep(x, 2000, 2900)
    * (1 - THREE.MathUtils.smoothstep(x, 7000, 7900))
    * THREE.MathUtils.smoothstep(z, -2800, -1800)
    * (1 - THREE.MathUtils.smoothstep(z, 800, 1800));
  return Math.max(ridge * xWindow, headland * 0.82) * 0.88;
}

function mergeGeometry(parts) {
  const attributes = ['position', 'normal'].map((name) => {
    const length = parts.reduce((sum, part) => {
      const geometry = part.index ? part.toNonIndexed() : part;
      const size = geometry.getAttribute(name).array.length;
      if (geometry !== part) geometry.dispose();
      return sum + size;
    }, 0);
    return new Float32Array(length);
  });
  let offset = 0;
  for (const part of parts) {
    const geometry = part.index ? part.toNonIndexed() : part;
    const position = geometry.getAttribute('position').array;
    const normal = geometry.getAttribute('normal').array;
    attributes[0].set(position, offset);
    attributes[1].set(normal, offset);
    offset += position.length;
    if (geometry !== part) geometry.dispose();
    part.dispose();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(attributes[0], 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(attributes[1], 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function createConiferGeometry() {
  const parts = [
    new THREE.CylinderGeometry(1.8, 2.5, 12, 5).translate(0, 6, 0),
    new THREE.ConeGeometry(8, 17, 7).translate(0, 15, 0),
    new THREE.ConeGeometry(6.1, 14, 7).translate(0, 25, 0),
  ];
  return mergeGeometry(parts);
}

function candidate(random) {
  const half = TERRAIN.size / 2;
  const x = (random() * 2 - 1) * half;
  const z = (random() * 2 - 1) * half;
  const height = sampleTerrainHeight(x, z);
  const dx = sampleTerrainHeight(x + SLOPE_SAMPLE, z) - sampleTerrainHeight(x - SLOPE_SAMPLE, z);
  const dz = sampleTerrainHeight(x, z + SLOPE_SAMPLE) - sampleTerrainHeight(x, z - SLOPE_SAMPLE);
  return { x, z, height, slope: Math.hypot(dx, dz) / (2 * SLOPE_SAMPLE) };
}

function populate(mesh, random, total, chooseScale, flatten, choose, accept) {
  const object = new THREE.Object3D();
  const colour = new THREE.Color();
  let count = 0;
  let attempts = 0;
  const maxAttempts = total * 140;
  while (count < total && attempts < maxAttempts) {
    attempts += 1;
    const sample = candidate(random);
    if (!accept(sample)) continue;
    const scale = chooseScale(random);
    const stretch = THREE.MathUtils.lerp(0.78, 1.24, random());
    const density = fbm(sample.x * 0.0011, sample.z * 0.0011, 3, 9137);
    const growth = THREE.MathUtils.smoothstep(density, 0.3, 0.72);
    if (random() > growth) continue;
    object.position.set(sample.x, sample.height - 0.6, sample.z);
    if (flatten) {
      object.scale.set(scale * stretch, scale * THREE.MathUtils.lerp(0.35, 0.65, random()), scale / stretch);
    } else {
      object.scale.set(scale * stretch, scale, scale / stretch);
    }
    object.rotation.set((random() - 0.5) * 0.08, random() * Math.PI * 2, (random() - 0.5) * 0.08);
    object.updateMatrix();
    mesh.setMatrixAt(count, object.matrix);
    choose(colour, random, scale);
    mesh.setColorAt(count, colour);
    count += 1;
  }
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return count;
}

/** Static poster-scale woodland, scrub and scree. Three instanced draw calls; no shadows or update. */
export function createVegetation(scene) {
  const random = createRandom(9137);
  const group = new THREE.Group();
  group.name = 'Cradle Coast vegetation';

  const conifers = new THREE.InstancedMesh(
    createConiferGeometry(),
    new THREE.MeshLambertMaterial({ color: '#FFFFFF', emissive: '#3C4C26', emissiveIntensity: 0.9, flatShading: true }),
    CONIFER_COUNT,
  );
  conifers.name = 'Conifers';
  conifers.frustumCulled = false;
  const coniferLight = new THREE.Color('#B9C47C');
  const coniferCount = populate(conifers, random, CONIFER_COUNT, (value) => {
    if (value() < 0.2) return THREE.MathUtils.lerp(0.35, 0.5, value());
    return THREE.MathUtils.lerp(0.55, 1.45, value());
  }, false, (colour, value) => {
    colour.set('#7E9652').lerp(coniferLight, value);
  }, (sample) => {
    const mask = forestMask(sample.x, sample.z);
    if (sample.height < 25 || sample.height > 430
      || sample.slope >= 0.34 || cleared(sample.x, sample.z) || mask <= 0.28) return false;
    const clump = fbm(sample.x / 600, sample.z / 600, 3, 9137);
    const clumpMask = THREE.MathUtils.smoothstep(clump, 0.42, 0.58);
    return random() < mask * clumpMask;
  });

  const bushes = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(7, 0),
    new THREE.MeshLambertMaterial({ color: '#FFFFFF', emissive: '#4A4425', emissiveIntensity: 0.55, flatShading: true }),
    BUSH_COUNT,
  );
  bushes.name = 'Gorse and bushes';
  bushes.frustumCulled = false;
  const bushColour = new THREE.Color('#C7BE7A');
  const bushCount = populate(bushes, random, BUSH_COUNT, (value) => THREE.MathUtils.lerp(0.6, 1.4, value), true, (colour, value) => {
    colour.set('#9AA663').lerp(bushColour, value);
  }, (sample) => sample.height >= 5 && sample.height <= 220
    && sample.slope < 0.3 && !cleared(sample.x, sample.z));

  const boulders = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(5, 0),
    new THREE.MeshLambertMaterial({ color: '#FFFFFF', emissive: '#3A352C', emissiveIntensity: 0.35, flatShading: true }),
    BOULDER_COUNT,
  );
  boulders.name = 'Scree boulders';
  boulders.frustumCulled = false;
  const lightRock = new THREE.Color('#C0B6A3');
  const boulderCount = populate(boulders, random, BOULDER_COUNT, (value) => THREE.MathUtils.lerp(0.7, 2.1, value), false, (colour, value) => {
    colour.set('#9C9486').lerp(lightRock, value);
  }, (sample) => sample.height > 60 && sample.slope >= 0.25 && sample.slope <= 0.6);

  group.add(conifers, bushes, boulders);
  scene.add(group);
  return { group };
}

