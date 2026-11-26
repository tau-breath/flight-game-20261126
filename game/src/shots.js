// Deterministic screenshot scenes. Flight shots advance the real fixed-step rules before painting.
import { AIRFIELD, STEP } from './config.js';
import { clamp } from './mathutil.js';
import { sampleTerrainHeight } from './terrain.js';

const SHOT_STEPS = 40;

function levelAutopilot(state) {
  const altitudeHold = clamp(-state.verticalSpeed * 0.12 + 0.012, -0.28, 0.28);
  const wingsLevel = clamp(-state.bank * 1.7, -0.55, 0.55);
  return { pitch: altitudeHold, roll: wingsLevel, yaw: 0, throttleDelta: 0, keys: new Set() };
}

function advanceRealRules(world, steps = SHOT_STEPS) {
  for (let step = 0; step < steps; step += 1) world.step(STEP, levelAutopilot(world.state));
}

function stageCover(world) {
  world.startMission(0);
  const ring = world.mission.rings[2];
  const heading = ring.heading * Math.PI / 180;
  const startDistance = 272;
  world.reset([
    ring.x - Math.sin(heading) * startDistance,
    340,
    ring.z + Math.cos(heading) * startDistance,
  ], ring.heading, 78);
  world.state.throttle = 0.7;
  world.mission.ringsPassed = 2;
  world.mission.activeRing = 2;
  world.mission.elapsed = 40;
  world.mission.timeLeft = world.mission.timeLimit - 40;
  world.mission.score = 240;
  world.score = 240;
  advanceRealRules(world);
  return { screen: 'FLYING', cameraMode: 'chase', ringIndex: 2 };
}

function stageCockpit(world) {
  world.startMission(2);
  const startDistance = 1237;
  world.reset([AIRFIELD.thresholdX - startDistance, 250, AIRFIELD.z], AIRFIELD.heading, 55);
  world.state.throttle = 0.34;
  world.state.gearDown = true;
  advanceRealRules(world);
  return { screen: 'FLYING', cameraMode: 'cockpit', ringIndex: -1 };
}

function stageMenu(world) {
  const x = -1350;
  const z = -1260;
  const height = sampleTerrainHeight(x, z);
  world.reset([x, height + 310, z], 87, 74);
  world.state.throttle = 0.62;
  advanceRealRules(world);
  return { screen: 'MENU', cameraMode: 'chase', ringIndex: 0 };
}

function stageLanding(world) {
  world.startMission(2);
  world.mission.waypointIndex = 2;
  world.reset([AIRFIELD.thresholdX + 150, AIRFIELD.elevation + 3.1, AIRFIELD.z], AIRFIELD.heading, 54);
  world.state.gearDown = true;
  world.state.throttle = 0.18;
  world.state.velocity.y = -1.1;
  world.step(STEP, levelAutopilot(world.state));
  return { screen: 'FLYING', cameraMode: 'chase', ringIndex: -1 };
}

export function stageShot(name, world) {
  if (name === 'cockpit') return stageCockpit(world);
  if (name === 'menu') return stageMenu(world);
  if (name === 'landing') return stageLanding(world);
  return stageCover(world);
}
