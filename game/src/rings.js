// Mission gates: upright torus meshes with one active halo and exact signed-plane pass detection.
import * as THREE from 'three';
import { RINGS } from './config.js';

const LOCAL_NORMAL = new THREE.Vector3(0, 0, 1);
const scratchOffset = new THREE.Vector3();
const scratchPrevious = new THREE.Vector3();

function haloTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 20, 64, 64, 63);
  gradient.addColorStop(0, 'rgba(255,180,74,0.08)');
  gradient.addColorStop(0.58, 'rgba(255,180,74,0.32)');
  gradient.addColorStop(0.76, 'rgba(255,238,174,0.9)');
  gradient.addColorStop(0.84, 'rgba(255,180,74,0.28)');
  gradient.addColorStop(1, 'rgba(255,180,74,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createRings(scene, mission) {
  const route = mission.route || [];
  const group = new THREE.Group();
  group.name = `${mission.name} gates`;
  scene.add(group);
  const geometry = new THREE.TorusGeometry(RINGS.radius, RINGS.tube, 10, 40);
  const haloMap = haloTexture();
  const rings = route.map((point, index) => {
    const material = new THREE.MeshStandardMaterial({
      color: '#A66F37', emissive: '#000000', emissiveIntensity: 0,
      roughness: 0.58, metalness: 0.08, flatShading: true,
    });
    const torus = new THREE.Mesh(geometry, material);
    torus.position.set(point.x, point.y, point.z);
    const heading = (point.heading || 0) * Math.PI / 180;
    const axis = new THREE.Vector3(Math.sin(heading), 0, -Math.cos(heading)).normalize();
    torus.quaternion.setFromUnitVectors(LOCAL_NORMAL, axis);
    torus.name = `${mission.name} ring ${index + 1}`;
    group.add(torus);

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: haloMap, color: '#FFC46B', transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    halo.position.copy(torus.position);
    halo.scale.set(90, 90, 1);
    halo.visible = index === 0;
    group.add(halo);
    return {
      index, torus, material, halo, axis, position: torus.position,
      radius: RINGS.radius, passed: false,
    };
  });
  rings.group = group;
  rings.haloMap = haloMap;
  pickActiveRing(rings, 0);
  return rings;
}

export function pickActiveRing(rings, index) {
  for (let ringIndex = 0; ringIndex < rings.length; ringIndex += 1) {
    const ring = rings[ringIndex];
    const active = ringIndex === index;
    const passed = ringIndex < index;
    ring.passed = passed;
    ring.material.color.set(passed ? RINGS.passedColor : active ? RINGS.color : '#A66F37');
    ring.material.emissive.set(active ? '#FF8A1E' : '#000000');
    ring.material.emissiveIntensity = active ? 1.6 : 0;
    ring.halo.visible = active;
  }
}

export function updateRings(rings, index, time) {
  const ring = rings[index];
  if (!ring) return;
  const pulse = 0.5 + 0.5 * Math.sin(time * Math.PI * 2 * 1.5);
  ring.halo.scale.setScalar(90 * (0.96 + pulse * 0.08));
  ring.halo.material.opacity = 0.68 + pulse * 0.3;
  ring.material.emissiveIntensity = 1.35 + pulse * 0.5;
}

export function testRingPass(ring, previousPosition, position) {
  scratchOffset.copy(position).sub(ring.position);
  const currentDistance = scratchOffset.dot(ring.axis);
  scratchPrevious.copy(previousPosition).sub(ring.position);
  const previousDistance = scratchPrevious.dot(ring.axis);
  if (previousDistance * currentDistance > 0) return false;
  scratchOffset.addScaledVector(ring.axis, -currentDistance);
  return scratchOffset.lengthSq() <= ring.radius * ring.radius;
}
