// The opposition: rust-liveried raider monoplanes that hunt in pairs, and the flotilla they screen —
// a gunboat and two flak barges that throw predicted bursts into the sky. Each hull is built from
// primitives in the same low-poly language as the Kestrel; the flight AI is a small turn-to-heading
// model with a lead pursuit, a break turn and a falling wreck state.
import * as THREE from 'three';
import { COMBAT, FORCES } from './config.js';
import { clamp } from './mathutil.js';
import { glowTexture, hurtPlayer, spawnEnemyBullet } from './combat.js';
import { sampleTerrainHeight } from './terrain.js';

const LOCAL_FORWARD = new THREE.Vector3(0, 0, -1);
const scratchA = new THREE.Vector3();
const scratchB = new THREE.Vector3();
const scratchC = new THREE.Vector3();
const scratchQuaternion = new THREE.Quaternion();
const scratchRight = new THREE.Vector3();
const scratchUp = new THREE.Vector3();
const scratchBasis = new THREE.Matrix4();
const WORLD_UP = new THREE.Vector3(0, 1, 0);

function standard(colour, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color: colour, roughness: 0.74, metalness: 0.06, flatShading: true, ...extra,
  });
}

function box(parent, w, h, d, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function buildFighter(ace) {
  const group = new THREE.Group();
  const hide = standard(FORCES.raiderColour);
  const trim = standard(FORCES.raiderTrim);
  const accent = standard(ace ? '#E85E38' : '#D08A5A');
  const glass = standard(FORCES.raiderGlass, {
    transparent: true, opacity: 0.42, roughness: 0.2, depthWrite: false,
  });
  const dark = standard('#22282A');
  const creamBand = standard('#E8DCC0');

  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.15, 7.2, 12), hide);
  fuselage.rotation.x = -Math.PI / 2;
  group.add(fuselage);

  const cowl = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.5, 0.9, 12), trim);
  cowl.rotation.x = -Math.PI / 2;
  cowl.position.z = -3.2;
  group.add(cowl);

  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 10), accent);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -3.9;
  group.add(spinner);

  const propeller = new THREE.Group();
  propeller.position.z = -3.75;
  for (let blade = 0; blade < 3; blade += 1) {
    const mesh = box(propeller, 0.1, 1.5, 0.06, dark);
    mesh.rotation.z = blade * Math.PI * 2 / 3;
  }
  group.add(propeller);

  // Low wing with a hard-edged diamond insignia, deliberately unlike the Kestrel's gull roundel.
  box(group, 9.2, 0.16, 1.5, hide, 0, -0.16, -0.1);
  for (const side of [-1, 1]) {
    box(group, 1.1, 0.18, 1.52, accent, side * 4.35, -0.16, -0.1);
    const diamond = box(group, 0.9, 0.03, 0.9, creamBand, side * 2.4, -0.05, -0.1);
    diamond.rotation.y = Math.PI / 4;
  }

  box(group, 0.09, 1.1, 0.9, hide, 0, 0.62, 3.1);
  box(group, 2.9, 0.11, 0.7, hide, 0, 0.28, 3.3);
  box(group, 0.1, 0.22, 0.94, creamBand, 0, 0.06, 3.1);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 7), glass);
  canopy.scale.set(1, 0.7, 1.7);
  canopy.position.set(0, 0.34, 0.55);
  group.add(canopy);

  for (const side of [-1, 1]) {
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6), dark);
    gun.rotation.x = Math.PI / 2;
    gun.position.set(side * 2.9, -0.24, -0.9);
    group.add(gun);
  }

  const flame = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: '#FFB25C', transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  flame.scale.set(2.2, 2.2, 1);
  flame.position.z = 3.7;
  group.add(flame);

  return { group, propeller, flame };
}

function buildGunboat() {
  const group = new THREE.Group();
  const hull = standard('#3F4A4B');
  const deck = standard('#6C6152');
  const upper = standard('#4E5A59');
  const rust = standard('#8A5340');
  const dark = standard('#252B2C');

  box(group, 40, 3.4, 8.4, hull, 0, 0.6, 0);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(4.2, 9, 4), hull);
  bow.rotation.z = -Math.PI / 2;
  bow.rotation.x = Math.PI / 4;
  bow.position.x = 24;
  group.add(bow);
  box(group, 34, 0.5, 7.6, deck, 0, 2.4, 0);
  box(group, 12, 3.2, 5.6, upper, -2, 4.2, 0);
  box(group, 5, 1.1, 5.0, dark, 1.4, 3.4, 0);
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 3.4, 8), rust);
  funnel.position.set(-9, 5.4, 0);
  group.add(funnel);
  box(group, 3.6, 0.3, 3.6, dark, -9, 7.1, 0);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 7, 6), dark);
  mast.position.set(-14, 7.4, 0);
  group.add(mast);
  box(group, 4.2, 0.14, 0.14, dark, -14, 9.6, 0);

  const turret = new THREE.Group();
  turret.position.set(9, 3.6, 0);
  group.add(turret);
  const cupola = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 1.5, 10), upper);
  turret.add(cupola);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 6.4, 8), dark);
  barrel.position.set(0, 0.5, -3.4);
  barrel.rotation.x = Math.PI / 2;
  const elevation = new THREE.Group();
  elevation.position.y = 0.4;
  elevation.add(barrel);
  turret.add(elevation);
  turret.userData.elevation = elevation;

  const wake = new THREE.Mesh(new THREE.PlaneGeometry(34, 12), new THREE.MeshBasicMaterial({
    color: '#EAF3F2', transparent: true, opacity: 0.34, depthWrite: false,
  }));
  wake.rotation.x = -Math.PI / 2;
  wake.position.set(-34, 0.35, 0);
  group.add(wake);
  return { group, turret, elevation, wake };
}

function buildFlakBarge() {
  const group = new THREE.Group();
  const pontoon = standard('#4A5250');
  const deck = standard('#736555');
  const rust = standard('#8A5340');
  const dark = standard('#252B2C');

  for (const side of [-1, 1]) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 17, 8), pontoon);
    tube.rotation.z = Math.PI / 2;
    tube.position.set(0, 0.7, side * 2.9);
    group.add(tube);
  }
  box(group, 15, 0.6, 8.4, deck, 0, 2.0, 0);
  box(group, 5.6, 1.5, 5.4, rust, -5.4, 3.0, 0);
  box(group, 4.4, 0.8, 4.2, dark, -5.4, 3.9, 0);

  const turret = new THREE.Group();
  turret.position.set(3.2, 2.6, 0);
  group.add(turret);
  const mount = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 1.1, 10), dark);
  turret.add(mount);
  const elevation = new THREE.Group();
  elevation.position.y = 0.8;
  turret.add(elevation);
  for (const side of [-1, 1]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 5.2, 7), dark);
    barrel.position.set(side * 0.45, 0, -2.4);
    barrel.rotation.x = Math.PI / 2;
    elevation.add(barrel);
  }
  const shield = box(elevation, 2.6, 1.4, 0.16, rust, 0, 0.1, -0.6);
  shield.rotation.x = 0.12;

  return { group, turret, elevation };
}

export function createForces(scene) {
  const group = new THREE.Group();
  group.name = 'Cradle Coast opposition';
  scene.add(group);
  return {
    group, units: [], byId: new Map(), world: null, spawned: new Set(),
    time: 0, nextId: 0,
    applyDamage(unit, amount, source) { applyDamage(unit, amount, source); },
  };
}

function addUnit(forces, definition) {
  const existing = forces.byId.get(definition.id);
  if (existing) return existing;
  const unit = {
    id: definition.id, kind: definition.kind, ace: Boolean(definition.ace),
    x: definition.x, y: definition.y, z: definition.z,
    heading: (definition.heading || 0) * Math.PI / 180,
    speed: definition.speed || 0, baseSpeed: definition.speed || 0,
    hp: definition.kind === 'fighter' ? FORCES.fighterHealth
      : definition.kind === 'gunboat' ? FORCES.gunboatHealth : FORCES.flakHealth,
    maxHp: 0, alive: true, radius: definition.kind === 'fighter' ? FORCES.fighterRadius
      : definition.kind === 'gunboat' ? FORCES.gunboatRadius : 15,
    quaternion: new THREE.Quaternion(), bank: 0, pitch: 0, fireCd: 1.2 + Math.random() * 1.4,
    mode: 'patrol', hit: 0, falling: 0, sinking: 0, throttle: 0.7,
    anchor: { x: definition.x, y: definition.y, z: definition.z },
    wander: Math.random() * Math.PI * 2, home: { x: definition.x, z: definition.z },
  };
  unit.maxHp = unit.hp;
  const built = definition.kind === 'fighter' ? buildFighter(unit.ace)
    : definition.kind === 'gunboat' ? buildGunboat() : buildFlakBarge();
  unit.group = built.group;
  unit.propeller = built.propeller || null;
  unit.flame = built.flame || null;
  unit.turret = built.turret || null;
  unit.elevation = built.elevation || null;
  unit.wake = built.wake || null;
  unit.group.position.set(unit.x, unit.y, unit.z);
  unit.group.name = `${unit.kind} ${unit.id}`;
  forces.group.add(unit.group);
  unit.forces = forces;
  forces.units.push(unit);
  forces.byId.set(unit.id, unit);
  return unit;
}

/** Build one scripted wave of the mission; already-built ids are left alone. */
export function spawnWave(forces, wave) {
  if (!wave || forces.spawned.has(wave.id)) return;
  forces.spawned.add(wave.id);
  for (const unit of wave.units) addUnit(forces, unit);
}

export function spawnWaveById(forces, mission, waveId) {
  const wave = (mission.waves || []).find((entry) => entry.id === waveId);
  if (wave) spawnWave(forces, wave);
}

export function resetForces(forces) {
  for (const unit of forces.units) {
    forces.group.remove(unit.group);
    unit.group.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material && object.material.dispose && !object.material.userData?.shared) object.material.dispose();
    });
  }
  forces.units.length = 0;
  forces.byId.clear();
  forces.spawned.clear();
  forces.time = 0;
}

/** Everything the mission data says should be in the air at this stage, and nothing else. */
export function loadMissionForces(forces, mission) {
  resetForces(forces);
  for (const wave of mission.waves || []) {
    if (wave.at <= 0) spawnWave(forces, wave);
  }
}

export function aliveTargets(forces, ids) {
  return ids.filter((id) => {
    const unit = forces.byId.get(id);
    return unit && unit.alive;
  });
}

function killUnit(forces, unit) {
  unit.alive = false;
  unit.hp = 0;
  const world = forces.world;
  if (world) {
    world.events.push({ type: 'explosion', x: unit.x, y: unit.y, z: unit.z, scale: unit.kind === 'fighter' ? 1.7 : 3.4 });
    world.lastKill = {
      kind: unit.kind,
      labels: { fighter: 'RAIDER SPLASHED', gunboat: 'GUNBOAT SILENCED', flak: 'FLAK BATTERY SILENCED' },
      time: world.clock,
    };
    const score = unit.kind === 'fighter' ? COMBAT.scoreKillFighter
      : unit.kind === 'gunboat' ? COMBAT.scoreKillGunboat : COMBAT.scoreKillFlak;
    world.score += score + Math.round(unit.maxHp);
    if (world.combat) {
      world.combat.kills += 1;
      world.combat.killFlash = 0.9;
    }
  }
  if (unit.kind === 'fighter') {
    unit.falling = 0.001;
    unit.mode = 'wreck';
  } else {
    unit.sinking = 0.001;
    if (unit.turret) unit.turret.visible = false;
  }
}

function applyDamage(unit, amount, source) {
  if (!unit.alive) return;
  const forces = unit.forces;
  unit.hp -= amount;
  unit.hit = 0.2;
  if (unit.hp <= 0) killUnit(forces, unit);
}

export function bindForces(forces) {
  for (const unit of forces.units) unit.forces = forces;
}

function aimDirection(forces, unit, target, leadSpeed) {
  scratchA.set(target.position.x - unit.x, target.position.y - unit.y, target.position.z - unit.z);
  const distance = scratchA.length();
  if (leadSpeed > 0 && target.velocity) {
    const flightTime = distance / leadSpeed;
    scratchB.copy(target.velocity).multiplyScalar(flightTime);
    scratchA.add(scratchB);
  }
  return scratchA.normalize();
}

function stepFighter(forces, unit, world, combat, dt) {
  const player = world.state;
  const dx = player.position.x - unit.x;
  const dy = player.position.y - unit.y;
  const dz = player.position.z - unit.z;
  const distance = Math.hypot(dx, dy, dz);
  const damaged = unit.hp / unit.maxHp < 0.4;
  if (damaged && unit.mode !== 'wreck') unit.mode = 'evade';
  else if (unit.mode !== 'wreck' && unit.mode !== 'evade') unit.mode = distance < 1500 ? 'engage' : 'patrol';

  scratchC.set(0, 0, 0);
  if (unit.mode === 'evade') {
    scratchC.set(-dx, 40, -dz).normalize();
    unit.speed = unit.baseSpeed * 1.08;
  } else if (unit.mode === 'engage') {
    if (distance > 260) {
      scratchC.set(dx, dy, dz).normalize();
      unit.speed = unit.baseSpeed * (1 + (1 - clamp(distance / 1200, 0, 1)) * 0.08);
    } else {
      scratchC.set(-dz, 18, dx).normalize();
      unit.speed = unit.baseSpeed * 0.92;
    }
  } else {
    unit.wander += dt * 0.35;
    scratchC.set(Math.cos(unit.wander) * 120, 0, Math.sin(unit.wander) * 120);
    scratchC.x += unit.anchor.x - unit.x;
    scratchC.z += unit.anchor.z - unit.z;
    scratchC.y = unit.anchor.y - unit.y;
    scratchC.normalize();
    unit.speed = unit.baseSpeed * 0.82;
  }

  const ground = sampleTerrainHeight(unit.x, unit.z);
  if (unit.y < Math.max(45, ground + 50)) scratchC.y = Math.max(scratchC.y, 0.55);
  scratchC.y = clamp(scratchC.y, -0.5, 0.75);
  scratchC.normalize();

  scratchA.copy(LOCAL_FORWARD).applyQuaternion(unit.quaternion).normalize();
  const turnRate = FORCES.fighterTurn * (unit.ace ? 1.12 : 1) * dt;
  scratchA.lerp(scratchC, clamp(turnRate * 1.15, 0, 1)).normalize();
  scratchUp.copy(WORLD_UP).addScaledVector(scratchA, -WORLD_UP.dot(scratchA));
  if (scratchUp.lengthSq() < 1e-4) scratchUp.set(0, 0, 1);
  scratchUp.normalize();
  scratchRight.crossVectors(scratchA, scratchUp).normalize();
  scratchUp.crossVectors(scratchRight, scratchA).normalize();
  scratchBasis.makeBasis(scratchRight, scratchUp, scratchC.copy(scratchA).negate());
  scratchQuaternion.setFromRotationMatrix(scratchBasis);
  unit.quaternion.slerp(scratchQuaternion, clamp(turnRate * 2.4, 0, 1));
  unit.bank = -scratchRight.y * 1.2;

  unit.x += scratchA.x * unit.speed * dt;
  unit.y += scratchA.y * unit.speed * dt;
  unit.z += scratchA.z * unit.speed * dt;

  unit.fireCd -= dt;
  if (unit.mode === 'engage' && unit.fireCd <= 0 && distance < COMBAT.enemyRange) {
    const lead = aimDirection(forces, unit, player, COMBAT.enemySpeed);
    scratchB.copy(LOCAL_FORWARD).applyQuaternion(unit.quaternion);
    if (scratchB.dot(lead) > 0.985) {
      unit.fireCd = 1 / COMBAT.enemyRate + Math.random() * 0.35;
      scratchB.set(unit.x, unit.y, unit.z).addScaledVector(lead, 4);
      scratchC.copy(lead);
      scratchC.x += (Math.random() - 0.5) * COMBAT.enemySpread;
      scratchC.y += (Math.random() - 0.5) * COMBAT.enemySpread;
      scratchC.z += (Math.random() - 0.5) * COMBAT.enemySpread;
      spawnEnemyBullet(combat, scratchB, scratchC.normalize(), COMBAT.enemySpeed, COMBAT.enemyDamage);
      world.events.push({ type: 'enemy-gun', x: unit.x, y: unit.y, z: unit.z, scale: 0.7 });
    }
  }
}

function stepWreck(forces, unit, world, dt) {
  unit.falling += dt;
  unit.speed = Math.max(0, unit.speed - 26 * dt);
  scratchA.copy(LOCAL_FORWARD).applyQuaternion(unit.quaternion);
  unit.x += scratchA.x * unit.speed * dt;
  unit.y += scratchA.y * unit.speed * dt - unit.falling * unit.falling * 9.2 * dt;
  unit.z += scratchA.z * unit.speed * dt;
  unit.bank += dt * 2.6;
  unit.group.rotation.z = unit.bank;
  if (unit.y <= 1 || unit.falling > 7) {
    world.events.push({ type: 'explosion', x: unit.x, y: Math.max(1, unit.y), z: unit.z, scale: 1.2 });
    unit.group.visible = false;
    unit.remove = true;
  }
}

function stepShip(forces, unit, world, combat, dt) {
  const player = world.state;
  if (unit.speed > 0) {
    unit.x += Math.sin(unit.heading) * unit.speed * dt;
    unit.z -= Math.cos(unit.heading) * unit.speed * dt;
  }
  const dx = player.position.x - unit.x;
  const dy = player.position.y - unit.y;
  const dz = player.position.z - unit.z;
  const distance = Math.hypot(dx, dy, dz);
  if (unit.turret) {
    unit.turret.rotation.y = Math.atan2(dx, dz) - unit.heading + Math.PI;
    if (unit.elevation) {
      const elevation = Math.atan2(dy, Math.hypot(dx, dz));
      unit.elevation.rotation.x = clamp(-elevation - 0.1, -0.2, 1.25);
    }
  }
  unit.fireCd -= dt;
  const jamming = player.flareTimer > 0;
  if (unit.fireCd <= 0 && distance < COMBAT.flakRange && !player.crashed) {
    unit.fireCd = COMBAT.flakRate + Math.random() * 0.6;
    const spread = jamming ? 130 : 40;
    const flightTime = distance / 340;
    const aimX = player.position.x + player.velocity.x * flightTime + (Math.random() - 0.5) * spread;
    const aimY = player.position.y + (Math.random() - 0.5) * spread * 0.7;
    const aimZ = player.position.z + player.velocity.z * flightTime + (Math.random() - 0.5) * spread;
    world.events.push({ type: 'flak', x: aimX, y: aimY, z: aimZ, scale: 1 });
    world.events.push({ type: 'flak-gun', x: unit.x, y: unit.y + 4, z: unit.z, scale: 1 });
    const miss = Math.hypot(aimX - player.position.x, aimY - player.position.y, aimZ - player.position.z);
    if (!jamming && miss < COMBAT.flakRadius) {
      hurtPlayer(world, combat, COMBAT.flakDamage * (1 - miss / (COMBAT.flakRadius * 1.6)));
      world.events.push({ type: 'flak-hit', x: aimX, y: aimY, z: aimZ, scale: 1.1 });
    }
  }
}

/** AI, damage states and sinking hulls. Called once per fixed simulation step. */
export function stepForces(forces, world, combat, dt) {
  forces.world = world;
  forces.time += dt;
  for (const unit of forces.units) {
    unit.forces = forces;
    unit.hit = Math.max(0, unit.hit - dt * 4);
    if (unit.remove) continue;
    if (unit.kind === 'fighter') {
      if (unit.alive) stepFighter(forces, unit, world, combat, dt);
      else stepWreck(forces, unit, world, dt);
    } else if (unit.alive) {
      stepShip(forces, unit, world, combat, dt);
    } else if (unit.sinking > 0) {
      unit.sinking += dt;
      unit.y = Math.max(-9, unit.y - dt * 0.9);
      if (unit.sinking > 26) unit.group.visible = false;
    }
  }
}

/** Write the simulation's transforms onto the meshes; safe to call outside a simulation step. */
export function syncForces(forces) {
  for (const unit of forces.units) {
    if (unit.remove) continue;
    unit.group.position.set(unit.x, unit.y, unit.z);
    if (unit.kind === 'fighter') unit.group.quaternion.copy(unit.quaternion);
    else {
      unit.group.rotation.y = -unit.heading + Math.PI / 2;
      unit.group.position.y = unit.y + Math.sin(forces.time * 1.4 + unit.x * 0.01) * 0.22;
      unit.group.rotation.z = Math.sin(forces.time * 1.1 + unit.z * 0.01) * 0.02;
    }
    if (unit.propeller) unit.propeller.rotation.z += 0.55;
    if (unit.flame) {
      const hurt = !unit.alive ? 1 : unit.hp < unit.maxHp * 0.45 ? 0.85 : 0;
      unit.flame.material.opacity = hurt * (0.6 + Math.random() * 0.25);
      unit.flame.scale.setScalar(1.6 + Math.random() * 0.7);
    }
  }
}

export { applyDamage, COMBAT as COMBAT_TUNING };
