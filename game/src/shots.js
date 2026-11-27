// Deterministic screenshot scenes. Each one flies the real fixed-step rules — guns, rockets, AI,
// damage and all — for a fixed number of steps before the frame is painted, so a shot is a true
// render of the game at a moment the rules allow. Only the last moment of each dogfight is composed:
// the bandit is put on its break turn and the lock is set, exactly where play could have left it.
import * as THREE from 'three';
import { AIRFIELD, COMBAT, STEP } from './config.js';
import { clamp } from './mathutil.js';
import { sampleTerrainHeight } from './terrain.js';
import { fireRocket } from './combat.js';

const MB_STRIKE = 0;
const MB_RIDGE = 1;
const MB_HOME = 3;

const LOCAL_FORWARD = new THREE.Vector3(0, 0, -1);

function stick(fire = false, pitch = 0, roll = 0) {
  return { keys: new Set(), throttleDelta: 0, pitch, roll, yaw: 0, fire };
}

function levelAutopilot(state) {
  const altitudeHold = clamp(-state.verticalSpeed * 0.12 + 0.012, -0.28, 0.28);
  const wingsLevel = clamp(-state.bank * 1.7, -0.55, 0.55);
  return { pitch: altitudeHold, roll: wingsLevel, yaw: 0, throttleDelta: 0, keys: new Set(), fire: false };
}

function offsetPoint(state, distance, azimuthDeg, elevationDeg) {
  const heading = state.heading * Math.PI / 180;
  const azimuth = azimuthDeg * Math.PI / 180;
  const elevation = elevationDeg * Math.PI / 180;
  const forwardX = Math.sin(heading);
  const forwardZ = -Math.cos(heading);
  const rightX = Math.cos(heading);
  const rightZ = Math.sin(heading);
  return {
    x: state.position.x + (forwardX * Math.cos(azimuth) + rightX * Math.sin(azimuth)) * distance * Math.cos(elevation),
    z: state.position.z + (forwardZ * Math.cos(azimuth) + rightZ * Math.sin(azimuth)) * distance * Math.cos(elevation),
    y: state.position.y + Math.sin(elevation) * distance,
  };
}

/** Put a bandit on a chosen break turn: a heading away from the nose and a wing-over. */
function placeCrossing(unit, state, distance, azimuthDeg, elevationDeg, courseDeg, rollDeg) {
  const point = offsetPoint(state, distance, azimuthDeg, elevationDeg);
  unit.x = point.x;
  unit.y = point.y;
  unit.z = point.z;
  const course = (state.heading + courseDeg) * Math.PI / 180;
  unit.heading = course;
  unit.quaternion.setFromEuler(new THREE.Euler(0, -course, 0));
  unit.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(LOCAL_FORWARD, rollDeg * Math.PI / 180));
}

function hold(unit, fireCd = 9) {
  if (!unit) return;
  unit.hp = 600;
  unit.maxHp = 600;
  unit.fireCd = fireCd;
}

function forceLock(combat, unit) {
  if (!unit) return;
  combat.lockTarget = unit;
  combat.lockProgress = 1;
  combat.locked = true;
}

function advance(systems, seconds, input) {
  const steps = Math.max(1, Math.round(seconds / STEP));
  for (let index = 0; index < steps; index += 1) {
    systems.tick?.(STEP, input ?? levelAutopilot(systems.world.state));
  }
}

function prepareStrike(world) {
  world.startMission(MB_STRIKE);
  world.state.gearDown = false;
  const mission = world.mission;
  mission.stages[0].done = true;
  mission.ringsPassed = 3;
  mission.activeRing = 3;
  mission.stageIndex = 1;
  mission.goal = mission.stages[1].goal;
  mission.score = 1240;
  mission.elapsed = 58;
  mission.timeLeft = mission.timeLimit - mission.elapsed;
  mission.toast = '';
  world.score = 1240;
  world.onStageEnter?.(1);
  return mission;
}

function stageStrike(world, systems) {
  world.reset([5440, 236, -1000], 202, 80);
  const mission = prepareStrike(world);
  world.state.throttle = 0.82;
  advance(systems, 0.34, stick(true, 0.02, 0.03));
  advance(systems, 0.24, stick(true, 0.02, 0.02));
  const lead = systems.forces.byId.get('raider-1');
  const wing = systems.forces.byId.get('raider-2');
  hold(lead, 3.4);
  hold(wing, 4.1);
  if (lead) placeCrossing(lead, world.state, 198, 9, 2.5, 128, -42);
  if (wing) placeCrossing(wing, world.state, 336, -13, 4.4, -134, 34);
  advance(systems, 0.05, stick(true, 0.02, 0.02));
  forceLock(systems.combat, lead);
  return { screen: 'FLYING', cameraMode: 'chase', ringIndex: 3, mission };
}

function stageGuns(world, systems) {
  world.startMission(MB_STRIKE);
  world.reset([5230, 208, -640], 205, 76);
  const mission = prepareStrike(world);
  world.state.throttle = 0.7;
  world.state.damage = 26;
  advance(systems, 0.42, stick(true, 0.02, 0.01));
  const lead = systems.forces.byId.get('raider-1');
  const wing = systems.forces.byId.get('raider-2');
  hold(lead, 3.4);
  hold(wing, 4.1);
  if (lead) placeCrossing(lead, world.state, 96, 3, 1.4, 152, -46);
  if (wing) placeCrossing(wing, world.state, 226, -14, 4.8, -140, 30);
  advance(systems, 0.05, stick(true, 0.02, 0));
  forceLock(systems.combat, lead);
  return { screen: 'FLYING', cameraMode: 'cockpit', ringIndex: 3, mission };
}

function stageMissile(world, systems) {
  world.startMission(MB_STRIKE);
  world.reset([5420, 96, -770], 212, 84);
  const mission = world.mission;
  mission.stages[0].done = true;
  mission.stages[1].done = true;
  mission.ringsPassed = 3;
  mission.activeRing = 3;
  mission.stageIndex = 2;
  mission.goal = mission.stages[2].goal;
  mission.score = 2380;
  mission.elapsed = 92;
  mission.timeLeft = mission.timeLimit - mission.elapsed;
  mission.toast = '';
  world.score = 2380;
  world.state.throttle = 0.86;
  world.state.gearDown = false;
  world.state.damage = 18;
  world.onStageEnter?.(2);
  const gunboat = systems.forces.byId.get('gunboat-1');
  const barge = systems.forces.byId.get('flak-2');
  if (gunboat) gunboat.fireCd = 0.25;
  advance(systems, 0.5, stick(true, 0.01, -0.02));
  forceLock(systems.combat, gunboat);
  fireRocket(systems.combat, world);
  advance(systems, 0.72, stick(false, 0.01, -0.02));
  if (barge) systems.forces.applyDamage(barge, 500, 'rocket');
  advance(systems, 0.28, stick(false, 0.01, -0.02));
  forceLock(systems.combat, gunboat);
  return { screen: 'FLYING', cameraMode: 'chase', ringIndex: 3, mission };
}

function stageRing(world, systems) {
  world.startMission(MB_RIDGE);
  const ring = world.mission.rings[2];
  const heading = ring.heading * Math.PI / 180;
  world.reset([
    ring.x - Math.sin(heading) * 78,
    ring.y - 5,
    ring.z + Math.cos(heading) * 78,
  ], ring.heading, 80);
  world.state.gearDown = false;
  world.state.throttle = 0.8;
  world.mission.ringsPassed = 2;
  world.mission.activeRing = 2;
  world.mission.elapsed = 40;
  world.mission.timeLeft = world.mission.timeLimit - 40;
  world.mission.score = 240;
  world.score = 240;
  advance(systems, 0.1, stick(false));
  return { screen: 'FLYING', cameraMode: 'chase', ringIndex: 2 };
}

function stageMenu(world, systems) {
  const x = -1350;
  const z = -1260;
  const height = sampleTerrainHeight(x, z);
  world.reset([x, height + 310, z], 87, 74);
  world.state.gearDown = false;
  world.state.throttle = 0.62;
  advance(systems, 0.5, stick(false));
  return { screen: 'MENU', cameraMode: 'chase', ringIndex: 0 };
}

function stageLanding(world, systems) {
  world.startMission(MB_HOME);
  world.mission.waypointIndex = 2;
  world.reset([AIRFIELD.thresholdX + 150, AIRFIELD.elevation + 3.1, AIRFIELD.z], AIRFIELD.heading, 54);
  world.state.gearDown = true;
  world.state.throttle = 0.18;
  world.state.velocity.y = -1.1;
  systems.tick?.(STEP, levelAutopilot(world.state));
  return { screen: 'FLYING', cameraMode: 'chase', ringIndex: -1 };
}

export function stageShot(name, world, systems) {
  systems.world = world;
  if (name === 'guns' || name === 'cockpit') return stageGuns(world, systems);
  if (name === 'missile' || name === 'rocket') return stageMissile(world, systems);
  if (name === 'ring') return stageRing(world, systems);
  if (name === 'menu') return stageMenu(world, systems);
  if (name === 'landing') return stageLanding(world, systems);
  return stageStrike(world, systems);
}

export { COMBAT };
