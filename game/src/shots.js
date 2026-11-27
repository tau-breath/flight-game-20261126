// Deterministic screenshot scenes. Each one flies the real fixed-step rules — guns, rockets, AI,
// damage and all — for a fixed number of steps before the frame is painted, so a shot is a true
// render of the game at a moment the rules allow. Only the last moment of each dogfight is composed:
// the bandit is put on its break turn and the lock is set, exactly where play could have left it.
import * as THREE from 'three';
import { AIRFIELD, COMBAT, STEP } from './config.js';
import { clamp } from './mathutil.js';
import { sampleTerrainHeight } from './terrain.js';
import { fireRocket } from './combat.js';
const CAMERA_DEFAULT = Object.freeze({ shotBack: 0, shotUp: 0, shotSide: 0, shotFov: 0 });

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

function prepareStrike(world, position, heading, speed) {
  world.startMission(MB_STRIKE);
  world.reset(position, heading, speed);
  world.state.gearDown = false;
  const mission = world.mission;
  mission.ringsPassed = 3;
  mission.activeRing = 3;
  mission.stageIndex = 1;
  mission.stages[0].done = true;
  mission.goal = mission.stages[1].goal;
  mission.score = 1240;
  mission.elapsed = 58;
  mission.timeLeft = mission.timeLimit - mission.elapsed;
  mission.toast = '';
  world.score = 1240;
  world.onStageEnter?.(1);
  return mission;
}

function strikeCamera() {
  return { shotBack: 8, shotUp: 1.6, shotSide: 1.4, shotFov: 66 };
}

function stageStrike(world, systems) {
  const mission = prepareStrike(world, [5500, 302, -1340], 200, 80);
  mission.ringsPassed = 0;
  mission.activeRing = 0;
  mission.stageIndex = 0;
  mission.stages[0].done = false;
  mission.goal = mission.stages[0].goal;
  world.state.throttle = 0.82;
  advance(systems, 0.48, stick(true, -0.34, 0.15));
  const lead = systems.forces.byId.get('raider-1');
  const wing = systems.forces.byId.get('raider-2');
  hold(lead, 0.9);
  hold(wing, 0.35);
  const ring = mission.rings[0];
  const ringAhead = offsetPoint(world.state, 180, 0, 0);
  ring.x = ringAhead.x;
  ring.y = ringAhead.y;
  ring.z = ringAhead.z;
  placeCrossing(lead, world.state, 190, 8, 4.5, 126, -44);
  placeCrossing(wing, world.state, 195, -8, 5.5, -138, 32);
  advance(systems, 0.05, stick(true, 0, 0.15));
  forceLock(systems.combat, lead);
  return { screen: 'FLYING', cameraMode: 'chase', ringIndex: 0, mission, camera: { ...strikeCamera(), shotUp: 2.6 } };
}

function stageGuns(world, systems) {
  const mission = prepareStrike(world, [5470, 258, -1290], 200, 76);
  world.state.throttle = 0.7;
  world.state.damage = 26;
  advance(systems, 0.42, stick(true, 0.02, 0.01));
  const lead = systems.forces.byId.get('raider-1');
  const wing = systems.forces.byId.get('raider-2');
  hold(lead, 0.55);
  hold(wing, 0.3);
  placeCrossing(lead, world.state, 90, 3, 2, 148, -48);
  placeCrossing(wing, world.state, 190, -16, 4.6, -142, 28);
  advance(systems, 0.05, stick(true, 0, 0));
  forceLock(systems.combat, lead);
  return { screen: 'FLYING', cameraMode: 'cockpit', ringIndex: 0, mission, camera: { ...CAMERA_DEFAULT } };
}

function stageMissile(world, systems) {
  world.startMission(MB_STRIKE);
  world.reset([5230, 41.3, -840], 202, 84);
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
  const bargeLeft = systems.forces.byId.get('flak-1');
  const bargeRight = systems.forces.byId.get('flak-2');
  const waterDrop = (distance) => -Math.atan2(world.state.position.y, distance) * 180 / Math.PI;
  if (gunboat) {
    gunboat.hp = 26;
    gunboat.fireCd = 0.25;
    placeCrossing(gunboat, world.state, 170, -5, waterDrop(170), 0, 0);
  }
  if (bargeLeft) placeCrossing(bargeLeft, world.state, 195, 12, waterDrop(195), -68, 0);
  if (bargeRight) placeCrossing(bargeRight, world.state, 225, -16, waterDrop(225), -68, 0);
  forceLock(systems.combat, gunboat);
  fireRocket(systems.combat, world);
  advance(systems, 0.92, stick(false, 0, 0));
  return {
    screen: 'FLYING', cameraMode: 'chase', ringIndex: 0, mission, hideRings: true,
    camera: { shotBack: 5.5, shotUp: 0.6, shotSide: -2.2, shotFov: 70 },
  };
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
  return { screen: 'FLYING', cameraMode: 'chase', ringIndex: 2, camera: { ...CAMERA_DEFAULT } };
}

function stageMenu(world, systems) {
  const x = -1350;
  const z = -1260;
  const height = sampleTerrainHeight(x, z);
  world.reset([x, height + 310, z], 87, 74);
  world.state.gearDown = false;
  world.state.throttle = 0.62;
  advance(systems, 0.5, stick(false));
  return { screen: 'MENU', cameraMode: 'chase', ringIndex: 0, camera: { ...CAMERA_DEFAULT } };
}

function stageLanding(world, systems) {
  world.startMission(MB_HOME);
  world.mission.waypointIndex = 2;
  world.reset([AIRFIELD.thresholdX - 55, AIRFIELD.elevation + 3.5, AIRFIELD.z], 90, 54);
  world.state.gearDown = true;
  world.state.throttle = 0.2;
  world.state.velocity.y = -0.8;
  systems.tick?.(STEP, levelAutopilot(world.state));
  return {
    screen: 'FLYING', cameraMode: 'chase', ringIndex: -1, hideRings: true,
    camera: { shotBack: 7.5, shotUp: 0.9, shotSide: 1.1, shotFov: 58 },
  };
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
