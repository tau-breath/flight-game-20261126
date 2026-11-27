// Deterministic screenshot scenes. Each one flies the real fixed-step rules — guns, rockets, AI,
// damage and all — for a fixed number of steps before the frame is painted, so a shot is a true
// render of the game at a reachable moment rather than a posed tableau.
import * as THREE from 'three';
import { AIRFIELD, COMBAT, STEP } from './config.js';
import { clamp } from './mathutil.js';
import { sampleTerrainHeight } from './terrain.js';
import { fireRocket } from './combat.js';
import { spawnWaveById } from './enemies.js';

const MB_STRIKE = 0;
const MB_RIDGE = 1;
const MB_HOME = 3;

function stick(fire = false, pitch = 0, roll = 0) {
  return { keys: new Set(), throttleDelta: 0, pitch, roll, yaw: 0, fire };
}

function levelAutopilot(state) {
  const altitudeHold = clamp(-state.verticalSpeed * 0.12 + 0.012, -0.28, 0.28);
  const wingsLevel = clamp(-state.bank * 1.7, -0.55, 0.55);
  return { pitch: altitudeHold, roll: wingsLevel, yaw: 0, throttleDelta: 0, keys: new Set(), fire: false };
}

function placeAhead(unit, state, distance, azimuthDeg, elevationDeg) {
  const heading = state.heading * Math.PI / 180;
  const azimuth = azimuthDeg * Math.PI / 180;
  const elevation = elevationDeg * Math.PI / 180;
  const forwardX = Math.sin(heading);
  const forwardZ = -Math.cos(heading);
  const rightX = Math.cos(heading);
  const rightZ = Math.sin(heading);
  unit.x = state.position.x + (forwardX * Math.cos(azimuth) + rightX * Math.sin(azimuth)) * distance * Math.cos(elevation);
  unit.z = state.position.z + (forwardZ * Math.cos(azimuth) + rightZ * Math.sin(azimuth)) * distance * Math.cos(elevation);
  unit.y = state.position.y + Math.sin(elevation) * distance;
  const toPlayer = Math.atan2(state.position.x - unit.x, -(state.position.z - unit.z));
  unit.heading = toPlayer;
  unit.quaternion.setFromEuler(new THREE.Euler(0, -toPlayer, 0));
}

/** A staging helper that flies the game forward exactly as the loop does. */
function advance(systems, seconds, input) {
  const steps = Math.max(1, Math.round(seconds / STEP));
  for (let index = 0; index < steps; index += 1) systems.tick?.(STEP, input ?? levelAutopilot(systems.world.state));
}

function stageStrike(world, systems) {
  world.startMission(MB_STRIKE);
  world.reset([5180, 214, -1090], 140, 78);
  world.state.throttle = 0.8;
  const mission = world.mission;
  mission.stageIndex = 1;
  mission.stages[0].done = true;
  mission.ringsPassed = 3;
  mission.activeRing = 3;
  mission.elapsed = 64;
  mission.timeLeft = mission.timeLimit - mission.elapsed;
  mission.score = 1180;
  mission.goal = mission.stages[1].goal;
  mission.toast = 'INTERCEPT';
  mission.toastTime = mission.elapsed - 0.6;
  world.score = 1180;
  world.onStageEnter?.(1);
  const lead = systems.forces.byId.get('raider-1');
  const wing = systems.forces.byId.get('raider-2');
  if (lead) {
    placeAhead(lead, world.state, 126, 11, 2.4);
    lead.hp = 260;
    lead.maxHp = 260;
    lead.fireCd = 0.55;
    lead.ace = true;
  }
  if (wing) {
    placeAhead(wing, world.state, 246, -13, 4.6);
    wing.hp = 260;
    wing.maxHp = 260;
    wing.fireCd = 0.95;
  }
  advance(systems, 1.25, stick(true, 0.03, 0.02));
  return { screen: 'FLYING', cameraMode: 'chase', ringIndex: 3 };
}

function stageGuns(world, systems) {
  world.startMission(MB_STRIKE);
  world.reset([5420, 196, -700], 138, 74);
  world.state.throttle = 0.72;
  const mission = world.mission;
  mission.stageIndex = 1;
  mission.stages[0].done = true;
  mission.ringsPassed = 3;
  mission.activeRing = 3;
  mission.elapsed = 71;
  mission.timeLeft = mission.timeLimit - mission.elapsed;
  mission.score = 1420;
  mission.goal = mission.stages[1].goal;
  world.score = 1420;
  world.onStageEnter?.(1);
  const lead = systems.forces.byId.get('raider-1');
  const wing = systems.forces.byId.get('raider-2');
  if (lead) {
    placeAhead(lead, world.state, 92, 4, 1.6);
    lead.hp = 300;
    lead.maxHp = 300;
    lead.fireCd = 0.4;
    lead.ace = true;
  }
  if (wing) {
    placeAhead(wing, world.state, 210, -16, 6);
    wing.hp = 300;
    wing.maxHp = 300;
    wing.fireCd = 1.4;
  }
  world.state.damage = 34;
  advance(systems, 1.3, stick(true, 0.02, 0.01));
  return { screen: 'FLYING', cameraMode: 'cockpit', ringIndex: 3 };
}

function stageMissile(world, systems) {
  world.startMission(MB_STRIKE);
  world.reset([6020, 188, -540], 168, 82);
  world.state.throttle = 0.86;
  const mission = world.mission;
  mission.stageIndex = 2;
  mission.stages[0].done = true;
  mission.stages[1].done = true;
  mission.ringsPassed = 3;
  mission.activeRing = 3;
  mission.elapsed = 96;
  mission.timeLeft = mission.timeLimit - mission.elapsed;
  mission.score = 2330;
  mission.goal = mission.stages[2].goal;
  world.score = 2330;
  world.state.damage = 22;
  world.onStageEnter?.(2);
  const gunboat = systems.forces.byId.get('gunboat-1');
  const barge = systems.forces.byId.get('flak-2');
  if (gunboat) gunboat.fireCd = 0.2;
  if (barge) barge.fireCd = 9;
  advance(systems, 0.5, stick(true, 0.02, 0));
  if (gunboat) {
    systems.combat.lockTarget = gunboat;
    systems.combat.lockProgress = 1;
    systems.combat.locked = true;
    fireRocket(systems.combat, world);
  }
  if (barge) systems.forces.applyDamage(barge, 500, 'rocket');
  advance(systems, 0.9, stick(false, 0.02, 0));
  return { screen: 'FLYING', cameraMode: 'chase', ringIndex: 3 };
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
