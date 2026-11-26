// Skyhaven's clifftop runway, approach lights, tower, hangars and the Cradle Coast beacons.
import * as THREE from 'three';
import { AIRFIELD, PALETTE } from './config.js';
import { sampleTerrainHeight } from './terrain.js';

function standard(colour, extra = {}) {
  return new THREE.MeshStandardMaterial({ color: colour, roughness: 0.82, flatShading: true, ...extra });
}

function mesh(parent, geometry, material, x, y, z) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(255,239,186,1)');
  gradient.addColorStop(0.18, 'rgba(255,194,92,0.82)');
  gradient.addColorStop(1, 'rgba(255,164,54,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createRunway(group) {
  const asphalt = standard(PALETTE.runway, { roughness: 0.96 });
  const apronMaterial = standard('#4A5052', { roughness: 0.96 });
  const marking = new THREE.MeshBasicMaterial({ color: PALETTE.creamLine });
  const runwaySurface = AIRFIELD.elevation + 1.2;

  mesh(group, new THREE.BoxGeometry(AIRFIELD.length, 0.2, AIRFIELD.width), asphalt,
    AIRFIELD.x, runwaySurface - 0.1, AIRFIELD.z);

  const dashGeometry = new THREE.BoxGeometry(12, 0.035, 0.9);
  const dashCount = Math.floor((AIRFIELD.length - 40) / 30) + 1;
  const dashes = new THREE.InstancedMesh(dashGeometry, marking, dashCount);
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < dashCount; index += 1) {
    matrix.makeTranslation(AIRFIELD.thresholdX + 20 + index * 30, runwaySurface + 0.025, AIRFIELD.z);
    dashes.setMatrixAt(index, matrix);
  }
  dashes.instanceMatrix.needsUpdate = true;
  group.add(dashes);

  const thresholdBars = new THREE.InstancedMesh(new THREE.BoxGeometry(22, 0.04, 1.8), marking, 12);
  for (let end = 0; end < 2; end += 1) {
    for (let stripe = 0; stripe < 6; stripe += 1) {
      const x = end === 0 ? AIRFIELD.thresholdX + 20 : AIRFIELD.endX - 20;
      matrix.makeTranslation(x, runwaySurface + 0.03, AIRFIELD.z - 15 + stripe * 6);
      thresholdBars.setMatrixAt(end * 6 + stripe, matrix);
    }
  }
  thresholdBars.instanceMatrix.needsUpdate = true;
  group.add(thresholdBars);

  const edgeLines = new THREE.InstancedMesh(new THREE.BoxGeometry(AIRFIELD.length, 0.03, 3), marking, 2);
  for (let side = 0; side < 2; side += 1) {
    matrix.makeTranslation(AIRFIELD.x, runwaySurface + 0.02, AIRFIELD.z + (side === 0 ? -18.5 : 18.5));
    edgeLines.setMatrixAt(side, matrix);
  }
  edgeLines.instanceMatrix.needsUpdate = true;
  group.add(edgeLines);

  mesh(group, new THREE.BoxGeometry(60, 0.18, 40), apronMaterial,
    AIRFIELD.x, AIRFIELD.elevation + 0.12, AIRFIELD.z - 215);
  return runwaySurface;
}

function createApproachLights(group, glowMap) {
  const lightMaterial = new THREE.MeshStandardMaterial({
    color: '#FFD58A', emissive: '#FF9E32', emissiveIntensity: 2.2, roughness: 0.4,
  });
  const glowMaterial = new THREE.SpriteMaterial({
    map: glowMap, color: '#FFC46B', transparent: true, opacity: 0.72,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const lights = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 8, 6), lightMaterial, 14);
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < 14; index += 1) {
    const x = AIRFIELD.thresholdX - 20 - index * 20;
    const y = AIRFIELD.elevation + 1.55;
    matrix.makeTranslation(x, y, AIRFIELD.z);
    lights.setMatrixAt(index, matrix);
    const glow = new THREE.Sprite(glowMaterial);
    glow.position.set(x, y, AIRFIELD.z);
    glow.scale.set(5.5, 5.5, 1);
    group.add(glow);
  }
  lights.instanceMatrix.needsUpdate = true;
  group.add(lights);
}

function createTowerAndHangars(group) {
  const cream = standard('#E8DEC8');
  const teal = standard(PALETTE.teal);
  const roof = standard(PALETTE.roof);
  const dark = standard('#26383C');
  const glass = standard(PALETTE.glass, { roughness: 0.2, metalness: 0.2 });

  const towerX = AIRFIELD.x;
  const towerZ = AIRFIELD.z - 60;
  mesh(group, new THREE.BoxGeometry(8, 18, 8), cream, towerX, AIRFIELD.elevation + 9, towerZ);
  mesh(group, new THREE.BoxGeometry(10, 3.2, 10), glass, towerX, AIRFIELD.elevation + 16.4, towerZ);
  mesh(group, new THREE.BoxGeometry(11, 0.7, 11), dark, towerX, AIRFIELD.elevation + 18.35, towerZ);
  mesh(group, new THREE.CylinderGeometry(0.18, 0.18, 3, 6), dark, towerX, AIRFIELD.elevation + 20.2, towerZ);
  mesh(group, new THREE.SphereGeometry(0.55, 8, 6),
    standard('#FF6A4F', { emissive: '#E2564A', emissiveIntensity: 1.5 }),
    towerX, AIRFIELD.elevation + 21.8, towerZ);

  for (let index = 0; index < 2; index += 1) {
    const x = AIRFIELD.x - 36 + index * 72;
    const z = AIRFIELD.z - 135;
    mesh(group, new THREE.BoxGeometry(24, 6, 14), cream, x, AIRFIELD.elevation + 3, z);
    const dome = mesh(group, new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      roof, x, AIRFIELD.elevation + 6, z);
    dome.scale.set(12, 3.2, 7);
    mesh(group, new THREE.BoxGeometry(11, 4.8, 0.25), teal, x, AIRFIELD.elevation + 2.4, z + 7.1);
  }

  const poleX = AIRFIELD.thresholdX - 22;
  const poleZ = AIRFIELD.z - 30;
  mesh(group, new THREE.CylinderGeometry(0.1, 0.14, 4, 6), dark, poleX, AIRFIELD.elevation + 2, poleZ);
  const sock = mesh(group, new THREE.ConeGeometry(0.65, 3.2, 10, 1, true),
    standard('#E58A4B', { side: THREE.DoubleSide }), poleX + 1.5, AIRFIELD.elevation + 4, poleZ);
  sock.rotation.z = -Math.PI / 2;
}

function beacon(group, glowMap, x, z, scale = 1) {
  const base = Math.max(0, sampleTerrainHeight(x, z));
  const lighthouse = new THREE.Group();
  lighthouse.position.set(x, base, z);
  lighthouse.scale.setScalar(scale);
  group.add(lighthouse);
  const white = standard('#F2EEE1');
  const red = standard('#C65042');
  const dark = standard('#26383C');
  mesh(lighthouse, new THREE.CylinderGeometry(1.8, 2.5, 12, 12), white, 0, 6, 0);
  for (let band = 0; band < 3; band += 1) {
    mesh(lighthouse, new THREE.CylinderGeometry(1.92, 1.98, 1.15, 12), red, 0, 3.2 + band * 3.1, 0);
  }
  mesh(lighthouse, new THREE.CylinderGeometry(2.8, 2.8, 0.55, 12), dark, 0, 12.2, 0);
  mesh(lighthouse, new THREE.CylinderGeometry(1.35, 1.35, 2.2, 10), glassMaterial(), 0, 13.4, 0);
  mesh(lighthouse, new THREE.ConeGeometry(2.1, 1.8, 12), dark, 0, 15.4, 0);
  const lamp = mesh(lighthouse, new THREE.SphereGeometry(0.65, 8, 6),
    standard('#FFF0B8', { emissive: '#FFC46B', emissiveIntensity: 3 }), 0, 13.4, 0);
  lamp.name = 'Lighthouse lamp';

  const beamPivot = new THREE.Group();
  beamPivot.position.y = 13.4;
  lighthouse.add(beamPivot);
  const beamGeometry = new THREE.ConeGeometry(13, 180, 16, 1, true);
  beamGeometry.translate(0, -90, 0);
  beamGeometry.rotateZ(Math.PI / 2);
  const beam = new THREE.Mesh(beamGeometry, new THREE.MeshBasicMaterial({
    color: '#FFE6A8', transparent: true, opacity: 0.18, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  beamPivot.add(beam);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowMap, color: '#FFD486', transparent: true, opacity: 0.88,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  glow.position.y = 13.4;
  glow.scale.set(10, 10, 1);
  lighthouse.add(glow);
  return beamPivot;
}

function glassMaterial() {
  return standard('#9ED5D7', { emissive: '#FFD07A', emissiveIntensity: 0.35, roughness: 0.16 });
}

function buildLighthouseAt(scene, glowMap, x, z, scale = 1) {
  return beacon(scene, glowMap, x, z, scale);
}

export function createLighthouse(scene) {
  const glowMap = glowTexture();
  const beamPivot = buildLighthouseAt(scene, glowMap, 3350, 950, 1.15);
  return {
    update(time) { beamPivot.rotation.y = time * Math.PI * 2 / 6; },
  };
}

function createBoats(scene) {
  const hull = standard('#E9DDC2');
  const teal = standard(PALETTE.teal);
  const positions = [[2450, 3550], [2850, 3850]];
  for (const [x, z] of positions) {
    const boat = new THREE.Group();
    boat.position.set(x, 0.7, z);
    const body = mesh(boat, new THREE.BoxGeometry(13, 1.7, 4.2), hull, 0, 0, 0);
    body.rotation.z = 0.03;
    mesh(boat, new THREE.BoxGeometry(4.5, 2.1, 3), teal, -1.5, 1.5, 0);
    scene.add(boat);
  }
}

export function createAirfield(scene) {
  const group = new THREE.Group();
  group.name = 'Skyhaven';
  scene.add(group);
  const glowMap = glowTexture();
  createRunway(group);
  createApproachLights(group, glowMap);
  createTowerAndHangars(group);
  buildLighthouseAt(scene, glowMap, 3350, 950, 1.15);
  buildLighthouseAt(scene, glowMap, 2700, 3300, 0.9);
  createBoats(scene);
  return { update(time) {} };
}
