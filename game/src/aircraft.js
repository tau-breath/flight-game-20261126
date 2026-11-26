// The Kestrel Mk.I is built from readable primitives in its own coordinate system: nose -Z, up +Y.
// Every animated part remains in this one group so the flight model owns its world transform.
import * as THREE from 'three';
import { AIRCRAFT, PALETTE } from './config.js';
import { damp } from './mathutil.js';

function standard(colour, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color: colour, roughness: 0.72, metalness: 0.05, flatShading: true, ...extra,
  });
}

function addMesh(parent, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function addStrut(parent, from, to, radius, material) {
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const direction = end.clone().sub(start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 6), material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  parent.add(mesh);
  return mesh;
}

function makeGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 1, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.18, 'rgba(255,255,255,0.75)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addNavLight(parent, glowMap, colour, emissive, position) {
  const material = standard(colour, { emissive, emissiveIntensity: 2.2, roughness: 0.35 });
  const bulb = addMesh(parent, new THREE.SphereGeometry(0.085, 8, 6), material, ...position);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowMap, color: colour, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  glow.position.copy(bulb.position);
  glow.scale.set(0.72, 0.72, 1);
  parent.add(glow);
  return { material, glow };
}

export function createAircraft(scene) {
  const root = new THREE.Group();
  root.name = AIRCRAFT.name;
  scene.add(root);

  const cream = standard(PALETTE.cream);
  const teal = standard(PALETTE.teal);
  const brass = standard(PALETTE.brass, { roughness: 0.46, metalness: 0.42 });
  const dark = standard('#2A2F33');
  const tyre = standard('#1B1F22');
  const skin = standard('#C98F6A');
  const leather = standard('#5B4331');
  const glass = standard('#9FD8E8', {
    transparent: true, opacity: 0.34, roughness: 0.18, metalness: 0.08,
    side: THREE.DoubleSide, depthWrite: false,
  });

  const fuselage = addMesh(root, new THREE.CylinderGeometry(0.55, 0.18, 8.4, 14), cream);
  fuselage.rotation.x = -Math.PI / 2;

  const cheatLine = addMesh(root, new THREE.CylinderGeometry(0.55, 0.18, 6.6, 14), teal, 0, 0, -0.2);
  cheatLine.rotation.x = -Math.PI / 2;
  cheatLine.scale.set(1.02, 1, 1.02);

  const cowling = addMesh(root, new THREE.CylinderGeometry(0.62, 0.62, 0.7, 16), dark, 0, 0, -3.95);
  cowling.rotation.x = -Math.PI / 2;
  const spinner = addMesh(root, new THREE.ConeGeometry(0.24, 0.55, 12), brass, 0, 0, -4.45);
  spinner.rotation.x = -Math.PI / 2;

  const propeller = new THREE.Group();
  propeller.position.set(0, 0, -4.3);
  root.add(propeller);
  for (let blade = 0; blade < 3; blade += 1) {
    const mesh = addMesh(propeller, new THREE.BoxGeometry(0.13, 1.85, 0.07), dark);
    mesh.rotation.z = blade * Math.PI * 2 / 3;
  }
  addMesh(propeller, new THREE.SphereGeometry(0.18, 10, 6), brass);
  const propDisc = addMesh(root, new THREE.CircleGeometry(0.95, 24), standard(PALETTE.cream, {
    transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide,
  }), 0, 0, -4.28);

  for (const side of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(0, 0.62, -0.35);
    wing.rotation.z = side * AIRCRAFT.wingDihedral;
    root.add(wing);
    addMesh(wing, new THREE.BoxGeometry(5.5, 0.22, 1.7), cream, side * 2.75, 0, 0);
    addMesh(wing, new THREE.BoxGeometry(0.75, 0.24, 1.72), teal, side * 5.15, 0, 0);
    const outerRoundel = addMesh(wing, new THREE.CircleGeometry(0.46, 20), cream, side * 2.9, 0.12, 0);
    outerRoundel.rotation.x = -Math.PI / 2;
    const innerRoundel = addMesh(wing, new THREE.CircleGeometry(0.3, 20), teal, side * 2.9, 0.125, 0);
    innerRoundel.rotation.x = -Math.PI / 2;
  }

  for (const side of [-1, 1]) {
    addStrut(root, [side * 0.75, 0.18, -0.95], [side * 1.55, 0.51, -0.8], 0.045, dark);
    addStrut(root, [side * 0.75, 0.18, 0.35], [side * 1.55, 0.51, 0.5], 0.045, dark);
  }

  addMesh(root, new THREE.BoxGeometry(0.12, 1.35, 1.15), cream, 0, 0.85, 3.55);
  for (let stripe = 0; stripe < 3; stripe += 1) {
    const material = stripe === 0 ? teal : stripe === 1 ? cream : brass;
    addMesh(root, new THREE.BoxGeometry(0.14, 1.3, 0.24), material, (stripe - 1) * 0.14, 0.85, 4.1);
  }
  addMesh(root, new THREE.BoxGeometry(3.5, 0.13, 0.95), cream, 0, 0.3, 3.95);

  const canopy = addMesh(root, new THREE.SphereGeometry(0.55, 12, 8), glass, 0, 0.42, -0.95);
  canopy.scale.set(1, 0.62, 1.5);
  addMesh(root, new THREE.TorusGeometry(0.5, 0.035, 6, 12), brass, 0, 0.42, -0.35);
  addMesh(root, new THREE.SphereGeometry(0.17, 10, 7), skin, 0, 0.45, -1.0);
  const cap = addMesh(root, new THREE.SphereGeometry(0.19, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), leather, 0, 0.49, -1.0);
  cap.scale.z = 1.08;

  const gearPivots = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.65, -0.35, -1.55);
    root.add(pivot);
    gearPivots.push(pivot);
    addStrut(pivot, [0, 0, 0], [side * 0.3, -0.6, 0], 0.05, dark);
    const wheel = addMesh(pivot, new THREE.CylinderGeometry(0.42, 0.42, 0.2, 14), tyre, side * 0.3, -0.6, 0);
    wheel.rotation.z = Math.PI / 2;
    const hub = addMesh(pivot, new THREE.CylinderGeometry(0.15, 0.15, 0.22, 12), cream, side * 0.3, -0.6, 0);
    hub.rotation.z = Math.PI / 2;
  }

  const glowMap = makeGlowTexture();
  const navLights = [
    addNavLight(root, glowMap, '#FF594D', '#E2564A', [-5.4, 0.77, -0.35]),
    addNavLight(root, glowMap, '#70E2A4', '#43C982', [5.4, 0.77, -0.35]),
    addNavLight(root, glowMap, '#FFF4D6', '#FFF0C2', [0, 0.18, 4.4]),
  ];

  addMesh(root, new THREE.BoxGeometry(0.16, 0.1, 0.4), dark, -0.42, -0.18, -3.4);
  addMesh(root, new THREE.BoxGeometry(0.16, 0.1, 0.4), dark, 0.42, -0.18, -3.4);

  return {
    root, propeller, propDisc, gearPivots, navLights, glowMap,
    canopy, canopyFrame: canopy.parent.children.find((child) => child.geometry?.type === 'TorusGeometry')
      ?? canopy, gearFraction: 1, propAngle: 0, pulseTime: 0,
  };
}

/** 1 = wheels down, 0 = fully retracted. */
export function setGearDown(model, fraction) {
  model.gearFraction = Math.max(0, Math.min(1, fraction));
  for (let index = 0; index < model.gearPivots.length; index += 1) {
    const side = index === 0 ? -1 : 1;
    model.gearPivots[index].rotation.z = side * (1 - model.gearFraction) * 1.48;
    model.gearPivots[index].visible = model.gearFraction > 0.025;
  }
}

export function updateAircraft(model, state, dt) {
  model.root.position.copy(state.position);
  model.root.quaternion.copy(state.quaternion);
  model.gearFraction = damp(model.gearFraction, state.gearDown ? 1 : 0, 5.5, dt);
  setGearDown(model, model.gearFraction);
  model.propAngle += dt * (13 + state.throttle * 78);
  model.propeller.rotation.z = model.propAngle;
  model.propDisc.material.opacity = 0.04 + state.throttle * 0.12;
  model.propDisc.visible = state.throttle > 0.08;
  model.pulseTime += dt;
  const pulse = 0.72 + Math.max(0, Math.sin(model.pulseTime * 4.2)) * 1.4;
  for (let index = 0; index < model.navLights.length; index += 1) {
    const light = model.navLights[index];
    light.material.emissiveIntensity = index === 1 ? pulse : pulse * 0.82;
    light.glow.material.opacity = 0.35 + pulse * 0.28;
  }
}
