// The Kestrel's weapons and the damage that comes back: two cowl guns, four rockets, a lock ring
// that fills as the nose is held on a bandit, flare pods and the barrel-roll escape. Bullets are
// simulation numbers first; their tracers are one line buffer each, rewritten every step.
import * as THREE from 'three';
import { COMBAT, FORCES } from './config.js';
import { clamp } from './mathutil.js';

const LOCAL_FORWARD = new THREE.Vector3(0, 0, -1);
const LOCAL_RIGHT = new THREE.Vector3(1, 0, 0);
const LOCAL_UP = new THREE.Vector3(0, 1, 0);
const scratchPosition = new THREE.Vector3();
const scratchDirection = new THREE.Vector3();
const scratchTarget = new THREE.Vector3();
const scratchAim = new THREE.Vector3();

const PLAYER_BULLETS = 150;
const ENEMY_BULLETS = 190;
const MISSILES = COMBAT.missileCount;

function segmentHitsSphere(px, py, pz, x, y, z, cx, cy, cz, radius) {
  const dx = x - px;
  const dy = y - py;
  const dz = z - pz;
  const lengthSq = dx * dx + dy * dy + dz * dz;
  let t = 0;
  if (lengthSq > 1e-6) t = ((cx - px) * dx + (cy - py) * dy + (cz - pz) * dz) / lengthSq;
  t = clamp(t, 0, 1);
  const qx = px + dx * t - cx;
  const qy = py + dy * t - cy;
  const qz = pz + dz * t - cz;
  return qx * qx + qy * qy + qz * qz <= radius * radius;
}

function createTracerField(scene, count, colour) {
  // One instanced quad per round: a short streak stretched along its own flight path and turned to
  // face the eye, so a tracer reads at any angle instead of collapsing to a dot when it flies away.
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = new THREE.MeshBasicMaterial({
    color: colour, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.renderOrder = 6;
  scene.add(mesh);
  const matrix = new THREE.Matrix4();
  const basis = new THREE.Matrix4();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const toEye = new THREE.Vector3();
  const scale = new THREE.Vector3();
  return { mesh, matrix, basis, right, up, direction, toEye, scale, count };
}

function writeTracers(field, bullets, length, eye, width) {
  let used = 0;
  for (let index = 0; index < bullets.length; index += 1) {
    const bullet = bullets[index];
    if (!bullet.active) continue;
    field.direction.set(bullet.vx, bullet.vy, bullet.vz);
    const speed = field.direction.length() || 1;
    field.direction.divideScalar(speed);
    field.toEye.set(eye.x - bullet.x, eye.y - bullet.y, eye.z - bullet.z);
    if (field.toEye.lengthSq() < 1e-6) field.toEye.set(0, 1, 0);
    field.toEye.normalize();
    // The quad always faces the eye; its long axis follows the part of the flight path the eye can
    // actually see. A round fired straight away therefore reads as a dash, not as a disappearing dot.
    field.up.copy(field.direction).addScaledVector(field.toEye, -field.direction.dot(field.toEye));
    if (field.up.lengthSq() < 0.02) {
      field.up.set(0, 1, 0).addScaledVector(field.toEye, -field.toEye.y);
      if (field.up.lengthSq() < 0.02) field.up.set(1, 0, 0).addScaledVector(field.toEye, -field.toEye.x);
    }
    field.up.normalize();
    field.right.crossVectors(field.up, field.toEye).normalize();
    field.basis.makeBasis(field.right, field.up, field.toEye);
    field.matrix.copy(field.basis);
    field.scale.set(width, length, 1);
    field.matrix.scale(field.scale);
    field.matrix.setPosition(bullet.x, bullet.y, bullet.z);
    field.mesh.setMatrixAt(used, field.matrix);
    used += 1;
    if (used >= field.count) break;
  }
  field.mesh.count = used;
  field.mesh.instanceMatrix.needsUpdate = true;
}

function createMissileMesh(scene, index) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.19, 2.4, 8),
    new THREE.MeshStandardMaterial({ color: '#DCD3BE', roughness: 0.6, flatShading: true }),
  );
  body.rotation.x = Math.PI / 2;
  group.add(body);
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.19, 0.62, 8),
    new THREE.MeshStandardMaterial({ color: '#B8452F', roughness: 0.55, flatShading: true }),
  );
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -1.5;
  group.add(nose);
  for (let fin = 0; fin < 4; fin += 1) {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.46, 0.5),
      new THREE.MeshStandardMaterial({ color: '#3E4A4C', roughness: 0.7, flatShading: true }),
    );
    blade.position.z = 1.02;
    blade.rotation.z = fin * Math.PI / 2;
    blade.position.x = Math.cos(fin * Math.PI / 2) * 0.2;
    blade.position.y = Math.sin(fin * Math.PI / 2) * 0.2;
    group.add(blade);
  }
  const flame = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: '#FFC46B', transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  flame.position.z = 1.6;
  flame.scale.set(2.4, 2.4, 1);
  group.add(flame);
  group.visible = false;
  group.name = `Rocket ${index + 1}`;
  scene.add(group);
  return group;
}

let glowCache = null;
export function glowTexture() {
  if (glowCache) return glowCache;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 1, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,214,140,0.6)');
  gradient.addColorStop(1, 'rgba(255,150,60,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  glowCache = new THREE.CanvasTexture(canvas);
  glowCache.colorSpace = THREE.SRGBColorSpace;
  return glowCache;
}

export function createCombat(scene) {
  const playerTracers = createTracerField(scene, PLAYER_BULLETS, '#FF9E1F');
  const enemyTracers = createTracerField(scene, ENEMY_BULLETS, '#FF3B2E');
  const playerBullets = [];
  const enemyBullets = [];
  for (let index = 0; index < PLAYER_BULLETS; index += 1) {
    playerBullets.push({ active: false, x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, vx: 0, vy: 0, vz: 0, life: 0, damage: 0 });
  }
  for (let index = 0; index < ENEMY_BULLETS; index += 1) {
    enemyBullets.push({ active: false, x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, vx: 0, vy: 0, vz: 0, life: 0, damage: 0 });
  }
  const missiles = [];
  for (let index = 0; index < MISSILES; index += 1) {
    missiles.push({
      active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, speed: 0, life: 0,
      target: null, mesh: createMissileMesh(scene, index), trail: 0,
    });
  }
  return {
    playerTracers, enemyTracers, playerBullets, enemyBullets, missiles,
    playerCursor: 0, enemyCursor: 0,
    cooldown: 0, missileCooldown: 0, ammo: COMBAT.gunAmmo, missilesLeft: COMBAT.missileCount,
    flares: COMBAT.flareCount, lockTarget: null, lockProgress: 0, locked: false,
    fireHeld: false, hitFlash: 0, markFlash: 0, killFlash: 0, lockTone: 0,
    shots: 0, hits: 0, kills: 0, rocketHits: 0, rocketsFired: 0, damageTaken: 0, streaks: 0,
    combo: 1, comboTimer: 0, randomState: 0x2f6b1d3d,
    random() {
      this.randomState = (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0;
      return this.randomState / 4294967296;
    },
  };
}

/** Pick the bandit nearest the nose inside the lock cone; the player may cycle with Tab. */
export function updateLock(combat, world, forces, dt) {
  const state = world.state;
  scratchDirection.copy(LOCAL_FORWARD).applyQuaternion(state.quaternion).normalize();
  let best = null;
  let bestScore = -Infinity;
  for (const unit of forces.units) {
    if (!unit.alive) continue;
    scratchTarget.set(unit.x, unit.y, unit.z).sub(state.position);
    const distance = scratchTarget.length();
    if (distance > COMBAT.lockRange || distance < COMBAT.lockMinRange) continue;
    scratchTarget.divideScalar(distance);
    const cosine = scratchTarget.dot(scratchDirection);
    if (cosine < Math.cos(COMBAT.lockCone)) continue;
    const score = cosine * 2 - distance / COMBAT.lockRange;
    if (score > bestScore) { bestScore = score; best = unit; }
  }
  if (best !== combat.lockTarget) {
    combat.lockTarget = best;
    combat.lockProgress = 0;
    combat.locked = false;
  }
  if (best) {
    combat.lockProgress = Math.min(1, combat.lockProgress + dt / COMBAT.lockTime);
    const wasLocked = combat.locked;
    combat.locked = combat.lockProgress >= 1;
    if (combat.locked && !wasLocked) combat.lockTone = 0.35;
  } else {
    combat.lockProgress = Math.max(0, combat.lockProgress - 0.04);
    combat.locked = false;
  }
}

export function cycleLock(combat, forces) {
  const candidates = forces.units.filter((unit) => unit.alive);
  if (!candidates.length) return;
  const index = combat.lockTarget ? candidates.indexOf(combat.lockTarget) : -1;
  combat.lockTarget = candidates[(index + 1) % candidates.length];
  combat.lockProgress = 0;
  combat.locked = false;
}

function spawnPlayerBullet(combat, state, side) {
  const bullet = combat.playerBullets[combat.playerCursor];
  combat.playerCursor = (combat.playerCursor + 1) % combat.playerBullets.length;
  scratchPosition.set(COMBAT.muzzleLeft * side, COMBAT.muzzleUp, COMBAT.muzzleForward)
    .applyQuaternion(state.quaternion).add(state.position);
  scratchDirection.copy(LOCAL_FORWARD).applyQuaternion(state.quaternion).normalize();
  scratchDirection.x += (combat.random() - 0.5) * COMBAT.gunSpread * 2;
  scratchDirection.y += (combat.random() - 0.5) * COMBAT.gunSpread * 2;
  scratchDirection.z += (combat.random() - 0.5) * COMBAT.gunSpread * 2;
  scratchDirection.normalize();
  const muzzleSpeed = COMBAT.gunSpeed + Math.max(0, state.speed);
  bullet.active = true;
  bullet.x = bullet.px = scratchPosition.x;
  bullet.y = bullet.py = scratchPosition.y;
  bullet.z = bullet.pz = scratchPosition.z;
  bullet.vx = scratchDirection.x * muzzleSpeed + state.velocity.x * 0.35;
  bullet.vy = scratchDirection.y * muzzleSpeed + state.velocity.y * 0.35;
  bullet.vz = scratchDirection.z * muzzleSpeed + state.velocity.z * 0.35;
  bullet.life = COMBAT.gunLife;
  bullet.damage = COMBAT.gunDamage;
}

export function spawnEnemyBullet(combat, from, direction, speed, damage) {
  const bullet = combat.enemyBullets[combat.enemyCursor];
  combat.enemyCursor = (combat.enemyCursor + 1) % combat.enemyBullets.length;
  bullet.active = true;
  bullet.x = bullet.px = from.x;
  bullet.y = bullet.py = from.y;
  bullet.z = bullet.pz = from.z;
  bullet.vx = direction.x * speed;
  bullet.vy = direction.y * speed;
  bullet.vz = direction.z * speed;
  bullet.life = 2.4;
  bullet.damage = damage;
}

export function hurtPlayer(world, combat, amount) {
  const state = world.state;
  if (state.crashed) return;
  let dealt = amount;
  if (state.evadeTimer > 0) dealt *= COMBAT.evadeGuard;
  if (state.flareTimer > 0) dealt *= 0.6;
  state.damage = clamp(state.damage + dealt, 0, 100);
  combat.damageTaken += dealt;
  combat.hitFlash = COMBAT.hitFlash;
  combat.combo = 1;
  combat.comboTimer = 0;
  world.events.push({ type: 'player-hit', x: state.position.x, y: state.position.y, z: state.position.z, scale: 1 });
}

function launchMissile(combat, world) {
  const missile = combat.missiles.find((slot) => !slot.active);
  if (!missile || combat.missilesLeft <= 0) return false;
  const state = world.state;
  scratchPosition.set(0, -0.42, -1.6).applyQuaternion(state.quaternion).add(state.position);
  scratchDirection.copy(LOCAL_FORWARD).applyQuaternion(state.quaternion).normalize();
  missile.active = true;
  missile.x = scratchPosition.x;
  missile.y = scratchPosition.y;
  missile.z = scratchPosition.z;
  missile.vx = scratchDirection.x * 44 + state.velocity.x;
  missile.vy = scratchDirection.y * 44 + state.velocity.y;
  missile.vz = scratchDirection.z * 44 + state.velocity.z;
  missile.speed = 44 + state.speed * 0.4;
  missile.life = COMBAT.missileLife;
  missile.target = combat.lockTarget;
  missile.trail = 0;
  missile.mesh.visible = true;
  missile.mesh.position.copy(scratchPosition);
  combat.missilesLeft -= 1;
  combat.rocketsFired += 1;
  world.events.push({ type: 'launch', x: scratchPosition.x, y: scratchPosition.y, z: scratchPosition.z, scale: 1 });
  return true;
}

export function deployFlare(combat, world) {
  if (combat.flares <= 0 || world.state.flareTimer > 0) return false;
  combat.flares -= 1;
  world.state.flareTimer = COMBAT.flareTime;
  const state = world.state;
  world.events.push({ type: 'flare', x: state.position.x, y: state.position.y, z: state.position.z, scale: 1 });
  return true;
}

export function startEvade(world) {
  const state = world.state;
  if (state.evadeTimer > 0 || state.crashed) return false;
  state.evadeTimer = COMBAT.evadeTime;
  world.events.push({ type: 'evade', x: state.position.x, y: state.position.y, z: state.position.z, scale: 1 });
  return true;
}

function stepBullets(combat, world, forces, dt) {
  const state = world.state;
  for (let index = 0; index < combat.playerBullets.length; index += 1) {
    const bullet = combat.playerBullets[index];
    if (!bullet.active) continue;
    bullet.px = bullet.x; bullet.py = bullet.y; bullet.pz = bullet.z;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.z += bullet.vz * dt;
    bullet.life -= dt;
    if (bullet.life <= 0) { bullet.active = false; continue; }
    let spent = false;
    for (const unit of forces.units) {
      if (!unit.alive) continue;
      if (segmentHitsSphere(bullet.px, bullet.py, bullet.pz, bullet.x, bullet.y, bullet.z,
        unit.x, unit.y, unit.z, unit.radius)) {
        unit.hit = 0.18;
        forces.applyDamage(unit, bullet.damage, 'gun');
        combat.hits += 1;
        combat.markFlash = 0.12;
        combat.comboTimer = 3.2;
        combat.combo = Math.min(4, combat.combo + 0.34);
        world.score += Math.round(COMBAT.scoreHit * combat.combo);
        world.events.push({ type: 'impact', x: bullet.x, y: bullet.y, z: bullet.z, scale: 1 });
        spent = true;
        break;
      }
    }
    if (!spent && bullet.y < 0) {
      bullet.active = false;
      world.events.push({ type: 'splash', x: bullet.x, y: 0.5, z: bullet.z, scale: 0.7 });
    }
    if (spent) bullet.active = false;
  }

  for (let index = 0; index < combat.enemyBullets.length; index += 1) {
    const bullet = combat.enemyBullets[index];
    if (!bullet.active) continue;
    bullet.px = bullet.x; bullet.py = bullet.y; bullet.pz = bullet.z;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.z += bullet.vz * dt;
    bullet.life -= dt;
    if (bullet.life <= 0) { bullet.active = false; continue; }
    if (segmentHitsSphere(bullet.px, bullet.py, bullet.pz, bullet.x, bullet.y, bullet.z,
      state.position.x, state.position.y, state.position.z, 4.6)) {
      bullet.active = false;
      hurtPlayer(world, combat, bullet.damage);
      world.events.push({ type: 'impact', x: bullet.x, y: bullet.y, z: bullet.z, scale: 1.1 });
      continue;
    }
    if (bullet.y < 0) {
      bullet.active = false;
      world.events.push({ type: 'splash', x: bullet.x, y: 0.5, z: bullet.z, scale: 0.6 });
    }
  }
}

function stepMissiles(combat, world, dt) {
  for (const missile of combat.missiles) {
    if (!missile.active) continue;
    missile.life -= dt;
    const target = missile.target;
    if (target && target.alive) {
      scratchTarget.set(target.x, target.y, target.z).sub(scratchPosition.set(missile.x, missile.y, missile.z));
      const distance = scratchTarget.length();
      scratchTarget.divideScalar(Math.max(0.001, distance));
      scratchDirection.set(missile.vx, missile.vy, missile.vz).normalize();
      scratchDirection.lerp(scratchTarget, clamp(COMBAT.missileTurn * dt, 0, 1)).normalize();
      missile.vx = scratchDirection.x * missile.speed;
      missile.vy = scratchDirection.y * missile.speed;
      missile.vz = scratchDirection.z * missile.speed;
      if (distance < COMBAT.missileFuse) {
        combat.rocketHits += 1;
        world.events.push({ type: 'explosion', x: missile.x, y: missile.y, z: missile.z, scale: 1.5 });
        for (const unit of [target]) {
          if (unit.alive) {
            unit.hit = 0.3;
            unit.hitBy = 'rocket';
            world.forces.applyDamage(unit, COMBAT.missileDamage, 'rocket');
          }
        }
        missile.active = false;
        missile.mesh.visible = false;
        continue;
      }
    }
    missile.speed += COMBAT.missileAccel * dt;
    missile.x += missile.vx * dt;
    missile.y += missile.vy * dt;
    missile.z += missile.vz * dt;
    missile.mesh.position.set(missile.x, missile.y, missile.z);
    scratchDirection.set(missile.vx, missile.vy, missile.vz).normalize();
    missile.mesh.quaternion.setFromUnitVectors(LOCAL_FORWARD, scratchDirection);
    missile.trail += dt;
    if (missile.trail > 0.05) {
      missile.trail = 0;
      world.events.push({ type: 'trail', x: missile.x, y: missile.y, z: missile.z, scale: 1 });
    }
    if (missile.life <= 0 || missile.y < 0) {
      missile.active = false;
      missile.mesh.visible = false;
    }
  }
}

/** Advance every weapon, hit test and countermeasure by one fixed step. */
export function stepCombat(combat, world, forces, input, dt) {
  const state = world.state;
  combat.cooldown -= dt;
  combat.missileCooldown -= dt;
  combat.hitFlash = Math.max(0, combat.hitFlash - dt);
  combat.markFlash = Math.max(0, combat.markFlash - dt);
  combat.killFlash = Math.max(0, combat.killFlash - dt);
  combat.lockTone = Math.max(0, combat.lockTone - dt);
  if (combat.comboTimer > 0) {
    combat.comboTimer -= dt;
    if (combat.comboTimer <= 0) combat.combo = 1;
  }

  updateLock(combat, world, forces, dt);
  combat.fireHeld = Boolean(input.fire);

  if (combat.fireHeld && combat.ammo > 0 && combat.cooldown <= 0 && !state.crashed) {
    combat.cooldown = 1 / COMBAT.gunRate;
    combat.ammo = Math.max(0, combat.ammo - 2);
    combat.shots += 2;
    spawnPlayerBullet(combat, state, -1);
    spawnPlayerBullet(combat, state, 1);
    world.events.push({ type: 'gun', x: state.position.x, y: state.position.y, z: state.position.z, scale: 1 });
  }

  stepBullets(combat, world, forces, dt);
  stepMissiles(combat, world, dt);

  writeTracers(combat.playerTracers, combat.playerBullets, 7.5, state.position, 0.9);
  writeTracers(combat.enemyTracers, combat.enemyBullets, 6, state.position, 0.8);
}

/** Fired from the flow when the player presses the rocket key. */
export function fireRocket(combat, world) {
  if (combat.missileCooldown > 0) return false;
  if (!launchMissile(combat, world)) return false;
  combat.missileCooldown = 0.55;
  return true;
}

export function resetCombat(combat) {
  for (const bullet of combat.playerBullets) bullet.active = false;
  for (const bullet of combat.enemyBullets) bullet.active = false;
  for (const missile of combat.missiles) { missile.active = false; missile.mesh.visible = false; }
  combat.ammo = COMBAT.gunAmmo;
  combat.missilesLeft = COMBAT.missileCount;
  combat.flares = COMBAT.flareCount;
  combat.cooldown = 0;
  combat.missileCooldown = 0;
  combat.lockTarget = null;
  combat.lockProgress = 0;
  combat.locked = false;
  combat.fireHeld = false;
  combat.hitFlash = 0;
  combat.markFlash = 0;
  combat.killFlash = 0;
  combat.lockTone = 0;
  combat.shots = 0;
  combat.hits = 0;
  combat.kills = 0;
  combat.rocketHits = 0;
  combat.rocketsFired = 0;
  combat.damageTaken = 0;
  combat.combo = 1;
  combat.comboTimer = 0;
  writeTracers(combat.playerTracers, combat.playerBullets, 0, { x: 0, y: 0, z: 0 }, 0);
  writeTracers(combat.enemyTracers, combat.enemyBullets, 0, { x: 0, y: 0, z: 0 }, 0);
}
