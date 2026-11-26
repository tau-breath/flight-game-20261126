// Fixed-pool flight effects. Every quad, smoke puff and fireball is allocated once; updateEffects
// only recycles active slots and writes numeric transforms, so the render loop stays allocation-free.
import * as THREE from 'three';
import { AIRCRAFT, AIRFIELD } from './config.js';

const scratchOffset = new THREE.Vector3();
const scratchRight = new THREE.Vector3();
const scratchBack = new THREE.Vector3();

function particleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 2, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(255,255,255,0.96)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.7)');
  gradient.addColorStop(0.72, 'rgba(255,255,255,0.2)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createPool(scene, count, colour, blending, map) {
  const pool = new Array(count);
  for (let index = 0; index < count; index += 1) {
    const material = new THREE.SpriteMaterial({
      map, color: colour, transparent: true, opacity: 0, depthWrite: false,
      blending, sizeAttenuation: true,
    });
    const sprite = new THREE.Sprite(material);
    sprite.visible = false;
    sprite.frustumCulled = false;
    sprite.renderOrder = blending === THREE.AdditiveBlending ? 4 : 3;
    scene.add(sprite);
    pool[index] = {
      sprite, active: false, age: 0, life: 1, size: 1, growth: 0,
      vx: 0, vy: 0, vz: 0, rise: 0, drag: 0, opacity: 0, fadeIn: 0.04,
      stretchX: 1, stretchY: 1,
    };
  }
  pool.cursor = 0;
  return pool;
}

function nextRandom(effects) {
  effects.randomState = (Math.imul(effects.randomState, 1664525) + 1013904223) >>> 0;
  return effects.randomState / 4294967296;
}

function takeParticle(pool) {
  const particle = pool[pool.cursor];
  pool.cursor = (pool.cursor + 1) % pool.length;
  particle.active = true;
  particle.sprite.visible = true;
  return particle;
}

function deactivateParticle(particle) {
  particle.active = false;
  particle.sprite.visible = false;
  particle.sprite.material.opacity = 0;
}

function emitWingVapour(effects, state, side) {
  const particle = takeParticle(side < 0 ? effects.leftVapour : effects.rightVapour);
  scratchOffset.set(side * 5.45, 0.69, -0.35).applyQuaternion(state.quaternion).add(state.position);
  scratchRight.set(1, 0, 0).applyQuaternion(state.quaternion);
  particle.age = 0;
  particle.life = 0.64 + nextRandom(effects) * 0.12;
  particle.size = 0.52 + nextRandom(effects) * 0.38;
  particle.growth = 0.72;
  particle.vx = -state.velocity.x * 0.035 + scratchRight.x * side * 1.1;
  particle.vy = -state.velocity.y * 0.035 + 0.18;
  particle.vz = -state.velocity.z * 0.035 + scratchRight.z * side * 1.1;
  particle.rise = 0.08;
  particle.drag = 0.7;
  particle.opacity = 0.34;
  particle.fadeIn = 0.035;
  particle.stretchX = 1.65;
  particle.stretchY = 0.42;
  particle.sprite.position.copy(scratchOffset);
  particle.sprite.material.rotation = 0;
  particle.sprite.scale.set(particle.size * particle.stretchX, particle.size * particle.stretchY, 1);
  particle.sprite.material.opacity = 0;
}

function spawnRingSparks(effects, x, y, z) {
  for (let index = 0; index < effects.sparks.length; index += 1) {
    const particle = takeParticle(effects.sparks);
    const angle = nextRandom(effects) * Math.PI * 2;
    const radius = 3 + nextRandom(effects) * 19;
    const speed = 7 + nextRandom(effects) * 12;
    particle.age = 0;
    particle.life = 0.7;
    particle.size = 0.22 + nextRandom(effects) * 0.24;
    particle.growth = -0.08;
    particle.sprite.position.set(
      x + Math.cos(angle) * radius,
      y + Math.sin(angle) * radius,
      z + (nextRandom(effects) - 0.5) * 7,
    );
    particle.vx = Math.cos(angle) * speed;
    particle.vy = Math.sin(angle) * speed + 1.8;
    particle.vz = (nextRandom(effects) - 0.5) * speed;
    particle.rise = -7.5;
    particle.drag = 0.45;
    particle.opacity = 1;
    particle.fadeIn = 0.015;
    particle.stretchX = 0.42;
    particle.stretchY = 1.8;
    particle.sprite.material.rotation = angle;
    particle.sprite.scale.set(particle.size * particle.stretchX, particle.size * particle.stretchY, 1);
    particle.sprite.material.opacity = 1;
  }
}

function spawnTouchdownDust(effects, state) {
  scratchBack.set(0, 0, 1).applyQuaternion(state.quaternion);
  for (let index = 0; index < effects.dust.length; index += 1) {
    const particle = takeParticle(effects.dust);
    const side = index % 2 === 0 ? -1 : 1;
    scratchOffset.set(side * 0.96, -1.08, -1.55).applyQuaternion(state.quaternion).add(state.position);
    scratchOffset.x += (nextRandom(effects) - 0.5) * 1.2;
    scratchOffset.z += (nextRandom(effects) - 0.5) * 1.2;
    particle.age = 0;
    particle.life = 1.45 + nextRandom(effects) * 0.85;
    particle.size = 0.85 + nextRandom(effects) * 0.8;
    particle.growth = 2.2 + nextRandom(effects) * 1.4;
    particle.sprite.position.copy(scratchOffset);
    particle.vx = -state.velocity.x * 0.16 + scratchBack.x * (2.4 + nextRandom(effects) * 2.8)
      + (nextRandom(effects) - 0.5) * 2.2;
    particle.vy = 0.7 + nextRandom(effects) * 1.7;
    particle.vz = -state.velocity.z * 0.16 + scratchBack.z * (2.4 + nextRandom(effects) * 2.8)
      + (nextRandom(effects) - 0.5) * 2.2;
    particle.rise = 0.28;
    particle.drag = 1.15;
    particle.opacity = 0.42;
    particle.fadeIn = 0.025;
    particle.stretchX = 1.15;
    particle.stretchY = 0.8;
    particle.sprite.material.rotation = nextRandom(effects) * Math.PI;
    particle.sprite.scale.set(particle.size, particle.size * 0.8, 1);
    particle.sprite.material.opacity = 0;
  }
}

function spawnCrash(effects, state) {
  effects.fireball.position.copy(state.position);
  effects.fireball.position.y += 1;
  effects.fireball.scale.setScalar(0.2);
  effects.fireball.material.opacity = 1;
  effects.fireball.visible = true;
  effects.fireballAge = 0;

  for (let index = 0; index < effects.crashSmoke.length; index += 1) {
    const particle = takeParticle(effects.crashSmoke);
    particle.age = 0;
    particle.life = 6;
    particle.size = 2.8 + nextRandom(effects) * 2.8;
    particle.growth = 0.72 + nextRandom(effects) * 0.5;
    particle.sprite.position.set(
      state.position.x + (nextRandom(effects) - 0.5) * 5,
      state.position.y + (nextRandom(effects) - 0.5) * 3,
      state.position.z + (nextRandom(effects) - 0.5) * 5,
    );
    particle.vx = (nextRandom(effects) - 0.5) * 2.8;
    particle.vy = 4.5 + nextRandom(effects) * 4.5;
    particle.vz = (nextRandom(effects) - 0.5) * 2.8;
    particle.rise = 1.1;
    particle.drag = 0.18;
    particle.opacity = 0.5;
    particle.fadeIn = 0.15;
    particle.stretchX = 1;
    particle.stretchY = 1;
    particle.sprite.material.rotation = nextRandom(effects) * Math.PI;
    particle.sprite.scale.set(particle.size, particle.size, 1);
    particle.sprite.material.opacity = 0;
  }
}

function emitDamageSmoke(effects, state) {
  const particle = takeParticle(effects.damageSmoke);
  scratchOffset.set(0, 0.12, -2.35).applyQuaternion(state.quaternion).add(state.position);
  scratchBack.set(0, 0, 1).applyQuaternion(state.quaternion);
  particle.age = 0;
  particle.life = 1.8 + nextRandom(effects) * 0.7;
  particle.size = 0.38 + nextRandom(effects) * 0.3;
  particle.growth = 0.95;
  particle.sprite.position.copy(scratchOffset);
  particle.vx = state.velocity.x * 0.05 + scratchBack.x * 2.1;
  particle.vy = state.velocity.y * 0.05 + 0.9;
  particle.vz = state.velocity.z * 0.05 + scratchBack.z * 2.1;
  particle.rise = 0.65;
  particle.drag = 0.22;
  particle.opacity = 0.34;
  particle.fadeIn = 0.05;
  particle.stretchX = 0.65;
  particle.stretchY = 1.4;
  particle.sprite.material.rotation = 0;
  particle.sprite.scale.set(particle.size * particle.stretchX, particle.size * particle.stretchY, 1);
  particle.sprite.material.opacity = 0;
}

function updatePool(pool, dt) {
  let live = 0;
  for (let index = 0; index < pool.length; index += 1) {
    const particle = pool[index];
    if (!particle.active) continue;
    particle.age += dt;
    if (particle.age >= particle.life) {
      deactivateParticle(particle);
      continue;
    }
    const drag = Math.max(0, 1 - particle.drag * dt);
    particle.vx *= drag;
    particle.vz *= drag;
    particle.vy = particle.vy * drag + particle.rise * dt;
    particle.sprite.position.x += particle.vx * dt;
    particle.sprite.position.y += particle.vy * dt;
    particle.sprite.position.z += particle.vz * dt;
    const progress = particle.age / particle.life;
    const fadeIn = Math.min(1, particle.age / particle.fadeIn);
    particle.sprite.material.opacity = particle.opacity * (1 - progress) * fadeIn;
    const size = Math.max(0.02, particle.size + particle.growth * particle.age);
    particle.sprite.scale.set(size * particle.stretchX, size * particle.stretchY, 1);
    live += 1;
  }
  return live;
}

export function createEffects(scene) {
  const map = particleTexture();
  const group = new THREE.Group();
  group.name = 'Kestrel flight effects';
  scene.add(group);
  // The pools are attached to one group for tidy scene inspection; sprites remain independently
  // visible so only live slots are submitted to the renderer.
  const leftVapour = createPool(group, 40, '#EAF3F2', THREE.AdditiveBlending, map);
  const rightVapour = createPool(group, 40, '#EAF3F2', THREE.AdditiveBlending, map);
  const sparks = createPool(group, 14, '#FFD27D', THREE.AdditiveBlending, map);
  const dust = createPool(group, 10, '#B9B4A6', THREE.NormalBlending, map);
  const crashSmoke = createPool(group, 12, '#303B3D', THREE.NormalBlending, map);
  const damageSmoke = createPool(group, 14, '#566061', THREE.NormalBlending, map);
  const fireball = new THREE.Mesh(
    new THREE.SphereGeometry(1, 12, 8),
    new THREE.MeshBasicMaterial({
      color: '#FF9B3D', transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  fireball.visible = false;
  fireball.frustumCulled = false;
  fireball.renderOrder = 5;
  group.add(fireball);

  return {
    group, leftVapour, rightVapour, sparks, dust, crashSmoke, damageSmoke, fireball,
    map, live: 0, initialized: false, randomState: 0x6d2b79f5,
    lastRings: 0, dustActive: false, lastCrashed: false,
    damageSmokeTimer: 0, fireballAge: 0,
  };
}

export function updateEffects(effects, world, dt) {
  const state = world.state;
  const mission = world.mission;
  if (!effects.initialized) {
    effects.lastRings = mission.ringsPassed;
    effects.initialized = true;
  }

  if (mission.ringsPassed > effects.lastRings && mission.rings.length > 0) {
    const ringIndex = Math.min(mission.ringsPassed - 1, mission.rings.length - 1);
    const ring = mission.rings[ringIndex];
    spawnRingSparks(effects, ring.x, ring.y, ring.z);
  }
  effects.lastRings = mission.ringsPassed;

  const wheelHeight = AIRFIELD.elevation + 1.2 + AIRCRAFT.gearHeight;
  const overRunway = state.position.x >= AIRFIELD.thresholdX && state.position.x <= AIRFIELD.endX
    && Math.abs(state.position.z - AIRFIELD.z) <= AIRFIELD.width / 2;
  const wheelsAtRunway = overRunway && state.gearDown && state.verticalSpeed <= 0.2
    && Math.abs(state.position.y - wheelHeight) < 0.8;
  const dustEvent = Boolean(state.touchdown) || wheelsAtRunway;
  if (dustEvent && !effects.dustActive) {
    spawnTouchdownDust(effects, state);
    effects.dustActive = true;
  } else if (!dustEvent) {
    effects.dustActive = false;
  }

  if (world.crashed && !effects.lastCrashed) spawnCrash(effects, state);
  effects.lastCrashed = world.crashed;

  if (!state.crashed && state.speed > 35 && state.gForce > 3) {
    emitWingVapour(effects, state, -1);
    emitWingVapour(effects, state, 1);
  }

  if (!state.crashed && state.damage > 35) {
    effects.damageSmokeTimer += dt;
    if (effects.damageSmokeTimer >= 0.065) {
      effects.damageSmokeTimer = 0;
      emitDamageSmoke(effects, state);
    }
  } else {
    effects.damageSmokeTimer = 0;
  }

  let live = updatePool(effects.leftVapour, dt);
  live += updatePool(effects.rightVapour, dt);
  live += updatePool(effects.sparks, dt);
  live += updatePool(effects.dust, dt);
  live += updatePool(effects.crashSmoke, dt);
  live += updatePool(effects.damageSmoke, dt);

  if (effects.fireball.visible) {
    effects.fireballAge += dt;
    const progress = effects.fireballAge / 0.8;
    if (progress >= 1) {
      effects.fireball.visible = false;
      effects.fireball.material.opacity = 0;
    } else {
      effects.fireball.scale.setScalar(0.2 + progress * 18);
      effects.fireball.material.opacity = (1 - progress) * 0.9;
      effects.fireball.position.y += dt * 1.8;
      live += 1;
    }
  }
  effects.live = live;
}

export function resetEffects(effects) {
  const pools = [effects.leftVapour, effects.rightVapour, effects.sparks, effects.dust,
    effects.crashSmoke, effects.damageSmoke];
  for (let poolIndex = 0; poolIndex < pools.length; poolIndex += 1) {
    const pool = pools[poolIndex];
    pool.cursor = 0;
    for (let index = 0; index < pool.length; index += 1) deactivateParticle(pool[index]);
  }
  effects.fireball.visible = false;
  effects.fireball.material.opacity = 0;
  effects.live = 0;
  effects.initialized = false;
  effects.lastRings = 0;
  effects.dustActive = false;
  effects.lastCrashed = false;
  effects.damageSmokeTimer = 0;
  effects.fireballAge = 0;
  effects.randomState = 0x6d2b79f5;
}
