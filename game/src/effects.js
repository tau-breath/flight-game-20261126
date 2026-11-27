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

function ringTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 50, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,0)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.12)');
  gradient.addColorStop(0.72, 'rgba(255,255,255,0.95)');
  gradient.addColorStop(0.84, 'rgba(255,255,255,0.42)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Project the ring's world X/Z axes so the sprite reads as a ground-hugging ellipse.
function orientFlatRing(particle, sprite, camera) {
  const matrix = camera.matrixWorldInverse.elements;
  const ax = matrix[0];
  const ay = matrix[1];
  const bx = matrix[8];
  const by = matrix[9];
  const a = ax * ax + bx * bx;
  const b = ay * ay + by * by;
  const c = ax * ay + bx * by;
  const delta = Math.sqrt(Math.max(0, (a - b) * (a - b) + 4 * c * c));
  const major = Math.sqrt(Math.max(0, (a + b + delta) * 0.5));
  const minor = Math.sqrt(Math.max(0, (a + b - delta) * 0.5));
  const size = Math.max(0.02, particle.size + particle.growth * particle.age);
  sprite.scale.set(size * major, size * Math.max(0.025, minor), 1);
  sprite.material.rotation = Math.atan2(2 * c, a - b) * 0.5;
}

function orientMuzzle(particle, sprite, camera) {
  if (particle.dx * particle.dx + particle.dy * particle.dy + particle.dz * particle.dz < 1e-8) return;
  const matrix = camera.matrixWorldInverse.elements;
  const x = matrix[0] * particle.dx + matrix[4] * particle.dy + matrix[8] * particle.dz;
  const y = matrix[1] * particle.dx + matrix[5] * particle.dy + matrix[9] * particle.dz;
  sprite.material.rotation = x * x + y * y < 1e-8 ? 0 : Math.atan2(y, x);
}

function createPool(scene, count, colour, blending, map, orient = null) {
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
    let particle;
    if (orient) {
      sprite.onBeforeRender = function (renderer, renderScene, camera) {
        orient(particle, this, camera);
      };
    }
    particle = {
      sprite, active: false, age: 0, life: 1, size: 1, growth: 0,
      vx: 0, vy: 0, vz: 0, rise: 0, drag: 0, opacity: 0, fadeIn: 0.04,
      stretchX: 1, stretchY: 1, dx: 0, dy: 0, dz: 0,
    };
    pool[index] = particle;
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


function spawnShockwave(effects, x, y, z, scale) {
  const particle = takeParticle(effects.rings);
  particle.age = 0;
  particle.life = 0.55;
  particle.size = 4 * scale;
  particle.growth = (36 * scale) / 0.55;
  particle.sprite.position.set(x, y + 0.12, z);
  particle.vx = 0; particle.vy = 0; particle.vz = 0;
  particle.rise = 0; particle.drag = 0;
  particle.opacity = 0.45;
  particle.fadeIn = 0.008;
  particle.stretchX = 1;
  particle.stretchY = 1;
  particle.sprite.scale.setScalar(particle.size);
  particle.sprite.material.opacity = 0.45;
}

function spawnEmbers(effects, x, y, z, scale) {
  const count = 8 + Math.floor(nextRandom(effects) * 5);
  for (let index = 0; index < count; index += 1) {
    const particle = takeParticle(effects.embers);
    const angle = nextRandom(effects) * Math.PI * 2;
    const speed = (20 + nextRandom(effects) * 22) * scale;
    const lift = -0.65 + nextRandom(effects) * 1.6;
    const spread = Math.sqrt(1 - lift * lift);
    particle.age = 0;
    particle.life = 0.7 + nextRandom(effects) * 0.4;
    particle.size = (0.32 + nextRandom(effects) * 0.38) * scale;
    particle.growth = -0.16 * scale;
    particle.sprite.position.set(
      x + (nextRandom(effects) - 0.5) * 3 * scale,
      y + (nextRandom(effects) - 0.5) * 3 * scale,
      z + (nextRandom(effects) - 0.5) * 3 * scale,
    );
    particle.vx = Math.cos(angle) * speed * spread;
    particle.vy = lift * speed + 4 * scale;
    particle.vz = Math.sin(angle) * speed * spread;
    particle.rise = -20;
    particle.drag = 0.38;
    particle.opacity = 1;
    particle.fadeIn = 0.008;
    particle.stretchX = 0.38;
    particle.stretchY = 2.2;
    particle.sprite.material.rotation = angle;
    particle.sprite.scale.set(particle.size * 0.38, particle.size * 2.2, 1);
    particle.sprite.material.opacity = 1;
  }
}

function spawnCrash(effects, state) {
  effects.fireball.position.copy(state.position);
  effects.fireball.position.y += 1;
  effects.fireball.scale.setScalar(0.2);
  effects.fireball.material.opacity = 1;
  effects.fireball.visible = true;
  effects.fireballAge = 0;
  spawnShockwave(effects, state.position.x, state.position.y, state.position.z, 1);
  spawnEmbers(effects, state.position.x, state.position.y + 1, state.position.z, 1.2);

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

function spawnMuzzle(effects, x, y, z, scale, direction) {
  const particle = takeParticle(effects.muzzle);
  particle.age = 0;
  particle.life = 0.12;
  particle.size = 2.1 * scale;
  particle.growth = 8.5 * scale;
  particle.sprite.position.set(x, y, z);
  particle.vx = 0; particle.vy = 0; particle.vz = 0;
  particle.rise = 0; particle.drag = 0;
  particle.opacity = 1;
  particle.fadeIn = 0.001;
  particle.stretchX = 3.8;
  particle.stretchY = 0.6;
  particle.dx = direction ? direction.x : 0;
  particle.dy = direction ? direction.y : 0;
  particle.dz = direction ? direction.z : 0;
  particle.sprite.material.color.set('#FFF1C2');
  particle.sprite.material.rotation = 0;
  particle.sprite.scale.set(particle.size * 3.8, particle.size * 0.6, 1);
  particle.sprite.material.opacity = 1;
}

function spawnImpact(effects, x, y, z, scale) {
  for (let index = 0; index < 4; index += 1) {
    const particle = takeParticle(effects.sparks);
    const angle = nextRandom(effects) * Math.PI * 2;
    const speed = (5 + nextRandom(effects) * 9) * scale;
    particle.age = 0;
    particle.life = 0.26 + nextRandom(effects) * 0.2;
    particle.size = 0.18 * scale;
    particle.growth = -0.2;
    particle.sprite.position.set(x, y, z);
    particle.vx = Math.cos(angle) * speed;
    particle.vy = Math.sin(angle) * speed;
    particle.vz = (nextRandom(effects) - 0.5) * speed;
    particle.rise = -4;
    particle.drag = 1.4;
    particle.opacity = 1;
    particle.fadeIn = 0.01;
    particle.stretchX = 0.5;
    particle.stretchY = 1.6;
    particle.sprite.material.rotation = angle;
    particle.sprite.scale.set(particle.size * 0.5, particle.size * 1.6, 1);
    particle.sprite.material.opacity = 1;
  }
}

function spawnFlak(effects, x, y, z, scale) {
  const particle = takeParticle(effects.flak);
  const life = 1.15 + nextRandom(effects) * 0.35;
  const targetSize = (18 + nextRandom(effects) * 8) * scale;
  particle.age = 0;
  particle.life = life;
  particle.size = (2.8 + nextRandom(effects) * 1.4) * scale;
  particle.growth = (targetSize - particle.size) / life;
  particle.sprite.position.set(
    x + (nextRandom(effects) - 0.5) * 2 * scale,
    y + (nextRandom(effects) - 0.5) * 2 * scale,
    z + (nextRandom(effects) - 0.5) * 2 * scale,
  );
  particle.vx = (nextRandom(effects) - 0.5) * 1.6;
  particle.vy = 0.8 + nextRandom(effects) * 1.4;
  particle.vz = (nextRandom(effects) - 0.5) * 1.6;
  particle.rise = 0.25;
  particle.drag = 0.8;
  particle.opacity = 0.72;
  particle.fadeIn = 0.035;
  particle.stretchX = 1;
  particle.stretchY = 1;
  particle.sprite.material.rotation = nextRandom(effects) * Math.PI;
  particle.sprite.scale.setScalar(particle.size);
  particle.sprite.material.opacity = 0.72;

  const core = takeParticle(effects.muzzle);
  core.age = 0;
  core.life = 0.14;
  core.size = 4 * scale;
  core.growth = (targetSize - core.size) / core.life;
  core.sprite.position.set(x, y, z);
  core.vx = 0; core.vy = 0; core.vz = 0;
  core.rise = 0; core.drag = 0;
  core.opacity = 1;
  core.fadeIn = 0.001;
  core.stretchX = 1.1;
  core.stretchY = 1.1;
  core.dx = 0; core.dy = 0; core.dz = 0;
  core.sprite.material.color.set('#FF7A1F');
  core.sprite.material.rotation = 0;
  core.sprite.scale.setScalar(core.size);
  core.sprite.material.opacity = 1;
}

function spawnSplash(effects, x, z, scale) {
  const count = 5 + Math.floor(nextRandom(effects) * 4);
  for (let index = 0; index < count; index += 1) {
    const particle = takeParticle(effects.splash);
    particle.age = 0;
    particle.life = 1.1;
    particle.size = (1.5 + nextRandom(effects) * 1.3) * scale;
    particle.growth = 2.6 * scale;
    particle.sprite.position.set(
      x + (nextRandom(effects) - 0.5) * 2.4 * scale,
      0.25 + nextRandom(effects) * 1.1 * scale,
      z + (nextRandom(effects) - 0.5) * 2.4 * scale,
    );
    particle.vx = (nextRandom(effects) - 0.5) * 3.2;
    particle.vy = 6.5 + nextRandom(effects) * 4.5;
    particle.vz = (nextRandom(effects) - 0.5) * 3.2;
    particle.rise = -3.2;
    particle.drag = 0.55;
    particle.opacity = 0.78;
    particle.fadeIn = 0.02;
    particle.stretchX = 0.85;
    particle.stretchY = 1.35;
    particle.sprite.material.rotation = nextRandom(effects) * Math.PI;
    particle.sprite.scale.set(particle.size * 0.85, particle.size * 1.35, 1);
    particle.sprite.material.opacity = 0.78;
  }

  const ring = takeParticle(effects.rings);
  ring.age = 0;
  ring.life = 0.9;
  ring.size = 2.5 * scale;
  ring.growth = (21.5 * scale) / 0.9;
  ring.sprite.position.set(x, 0.12, z);
  ring.vx = 0; ring.vy = 0; ring.vz = 0;
  ring.rise = 0; ring.drag = 0;
  ring.opacity = 0.7;
  ring.fadeIn = 0.015;
  ring.stretchX = 1;
  ring.stretchY = 1;
  ring.sprite.scale.setScalar(ring.size);
  ring.sprite.material.opacity = 0.7;
}

function spawnTrail(effects, x, y, z) {
  const particle = takeParticle(effects.trail);
  particle.age = 0;
  particle.life = 0.9 + nextRandom(effects) * 0.5;
  particle.size = 1.1;
  particle.growth = 3.2;
  particle.sprite.position.set(x, y, z);
  particle.vx = (nextRandom(effects) - 0.5) * 1.6;
  particle.vy = (nextRandom(effects) - 0.5) * 1.6;
  particle.vz = (nextRandom(effects) - 0.5) * 1.6;
  particle.rise = 0.6;
  particle.drag = 1.5;
  particle.opacity = 0.5;
  particle.fadeIn = 0.02;
  particle.stretchX = 1;
  particle.stretchY = 1;
  particle.sprite.material.rotation = nextRandom(effects) * Math.PI;
  particle.sprite.scale.setScalar(particle.size);
  particle.sprite.material.opacity = 0.5;
}

function spawnBlast(effects, x, y, z, scale) {
  spawnShockwave(effects, x, y, z, scale);

  let blast = null;
  for (const slot of effects.blasts) {
    if (!slot.active) { blast = slot; break; }
  }
  if (blast) {
    blast.active = true;
    blast.age = 0;
    blast.life = 0.95;
    blast.size = 13.5 * scale;
    blast.mesh.position.set(x, y, z);
    blast.mesh.scale.setScalar(blast.size * 0.25);
    blast.mesh.material.opacity = 1;
    blast.mesh.visible = true;
  }
  for (let index = 0; index < 5; index += 1) {
    const particle = takeParticle(effects.crashSmoke);
    particle.age = 0;
    particle.life = 2.4 + nextRandom(effects) * 2.2;
    particle.size = (2.2 + nextRandom(effects) * 2.4) * scale;
    particle.growth = 1.5;
    particle.sprite.position.set(
      x + (nextRandom(effects) - 0.5) * 7 * scale,
      y + (nextRandom(effects) - 0.5) * 7 * scale,
      z + (nextRandom(effects) - 0.5) * 7 * scale,
    );
    particle.vx = (nextRandom(effects) - 0.5) * 9 * scale;
    particle.vy = 3 + nextRandom(effects) * 7 * scale;
    particle.vz = (nextRandom(effects) - 0.5) * 9 * scale;
    particle.rise = 0.9;
    particle.drag = 0.5;
    particle.opacity = 0.55;
    particle.fadeIn = 0.04;
    particle.stretchX = 1;
    particle.stretchY = 1;
    particle.sprite.material.rotation = nextRandom(effects) * Math.PI;
    particle.sprite.scale.setScalar(particle.size);
    particle.sprite.material.opacity = 0.55;
  }
  spawnEmbers(effects, x, y, z, scale);
  spawnImpact(effects, x, y, z, 1.6 * scale);
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
  const ringMap = ringTexture();
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
  const muzzle = createPool(group, 12, '#FFE8A8', THREE.AdditiveBlending, map, orientMuzzle);
  const flak = createPool(group, 26, '#4B4B46', THREE.NormalBlending, map);
  const splash = createPool(group, 20, '#FFFFFF', THREE.NormalBlending, map);
  const trail = createPool(group, 26, '#9AA0A0', THREE.NormalBlending, map);
  const embers = createPool(group, 12, '#FFC46A', THREE.AdditiveBlending, map);
  const rings = createPool(group, 12, '#FFE4B5', THREE.AdditiveBlending, ringMap, orientFlatRing);
  const blasts = [];
  for (let index = 0; index < 7; index += 1) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 8),
      new THREE.MeshBasicMaterial({
        color: '#FF9A3C', transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    mesh.visible = false;
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    group.add(mesh);
    blasts.push({ mesh, active: false, age: 0, life: 1, size: 6 });
  }
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
    muzzle, flak, splash, trail, embers, rings, blasts,
    map, ringMap, live: 0, initialized: false, randomState: 0x6d2b79f5,
    forward: new THREE.Vector3(0, 0, -1), playerPosition: new THREE.Vector3(),
    lastRings: 0, dustActive: false, lastCrashed: false,
    damageSmokeTimer: 0, fireballAge: 0,
  };
}

export function updateEffects(effects, world, dt) {
  const state = world.state;
  const mission = world.mission;
  effects.forward.set(0, 0, -1).applyQuaternion(state.quaternion);
  effects.playerPosition.copy(state.position);
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
  live += updatePool(effects.muzzle, dt);
  live += updatePool(effects.flak, dt);
  live += updatePool(effects.splash, dt);
  live += updatePool(effects.trail, dt);
  live += updatePool(effects.embers, dt);
  live += updatePool(effects.rings, dt);

  for (const blast of effects.blasts) {
    if (!blast.active) continue;
    blast.age += dt;
    const progress = blast.age / blast.life;
    if (progress >= 1) {
      blast.active = false;
      blast.mesh.visible = false;
      blast.mesh.material.opacity = 0;
      continue;
    }
    blast.mesh.scale.setScalar(blast.size * (0.3 + progress * 1.3));
    blast.mesh.material.opacity = (1 - progress) * 0.92;
    blast.mesh.position.y += dt * 3.2;
    live += 1;
  }

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
    effects.crashSmoke, effects.damageSmoke, effects.muzzle, effects.flak, effects.splash,
    effects.trail, effects.embers, effects.rings];
  for (let poolIndex = 0; poolIndex < pools.length; poolIndex += 1) {
    const pool = pools[poolIndex];
    pool.cursor = 0;
    for (let index = 0; index < pool.length; index += 1) deactivateParticle(pool[index]);
  }
  effects.fireball.visible = false;
  effects.fireball.material.opacity = 0;
  for (const blast of effects.blasts) {
    blast.active = false;
    blast.mesh.visible = false;
    blast.mesh.material.opacity = 0;
  }
  effects.live = 0;
  effects.initialized = false;
  effects.lastRings = 0;
  effects.dustActive = false;
  effects.lastCrashed = false;
  effects.damageSmokeTimer = 0;
  effects.fireballAge = 0;
  effects.randomState = 0x6d2b79f5;
}

function directionToPlayer(effects, x, y, z) {
  scratchOffset.set(effects.playerPosition.x - x, effects.playerPosition.y - y, effects.playerPosition.z - z);
  return scratchOffset.lengthSq() < 1e-6 ? effects.forward : scratchOffset.normalize();
}

/** One dispatcher for the events the weapons and the AI raise, so the renderer stays short. */
export function emitEffect(effects, event) {
  const scale = event.scale || 1;
  switch (event.type) {
    case 'gun': spawnMuzzle(effects, event.x, event.y, event.z, scale * 1.2, effects.forward); break;
    case 'enemy-gun': spawnMuzzle(effects, event.x, event.y, event.z, scale,
      directionToPlayer(effects, event.x, event.y, event.z)); break;
    case 'impact': spawnImpact(effects, event.x, event.y, event.z, scale); break;
    case 'explosion': spawnBlast(effects, event.x, event.y, event.z, scale); break;
    case 'flak': spawnFlak(effects, event.x, event.y, event.z, scale); break;
    case 'flak-gun': spawnMuzzle(effects, event.x, event.y, event.z, scale * 1.4,
      directionToPlayer(effects, event.x, event.y, event.z)); break;
    case 'flak-hit': spawnImpact(effects, event.x, event.y, event.z, scale * 2); break;
    case 'splash': spawnSplash(effects, event.x, event.z, scale); break;
    case 'trail': spawnTrail(effects, event.x, event.y, event.z); break;
    case 'launch': spawnMuzzle(effects, event.x, event.y, event.z, 2.2, effects.forward); break;
    case 'flare': spawnFlak(effects, event.x, event.y - 3, event.z, 0.7); break;
    case 'player-hit': spawnImpact(effects, event.x, event.y, event.z, 1.4); break;
    default: break;
  }
}
