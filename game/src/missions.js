// The sorties: a staged strike (gates, raiders, flotilla, egress), the two timed runs and the
// landing approach. Every stage is a goal the HUD can name, and the strike's stages open fires
// through world.onStageEnter so the mission data never has to know how a raider is built.
import { AIRFIELD, COMBAT, MISSIONS } from './config.js';
import { sampleTerrainHeight } from './terrain.js';

function stageState(definition) {
  return {
    id: definition.id,
    kind: definition.kind,
    title: definition.title,
    goal: definition.goal,
    rings: definition.rings ?? 0,
    targets: definition.targets ? [...definition.targets] : [],
    done: false,
  };
}

export function createMission(index = 0) {
  const definition = MISSIONS[Math.max(0, Math.min(MISSIONS.length - 1, index))];
  return {
    index: Math.max(0, Math.min(MISSIONS.length - 1, index)),
    id: definition.id,
    kind: definition.kind,
    name: definition.name,
    goal: definition.goal,
    timeLimit: definition.timeLimit,
    rings: definition.route.map((point) => ({ ...point })),
    waypoints: definition.waypoints.map((point) => ({ ...point })),
    waves: definition.waves || [],
    start: definition.start || null,
    stages: (definition.stages || []).map(stageState),
    stageIndex: 0,
    elapsed: 0,
    timeLeft: definition.timeLimit,
    ringsPassed: 0,
    activeRing: 0,
    waypointIndex: 0,
    score: 0,
    kills: 0,
    warning: '',
    toast: '',
    toastTime: -9,
    finished: false,
    grade: '',
    previousPosition: null,
  };
}

export function gradeTouchdown(sinkRate, speedKt) {
  if (sinkRate < 1.2 && speedKt >= 50 && speedKt <= 58) return 'PERFECT';
  if (sinkRate < 2.0 && speedKt >= 48 && speedKt <= 62) return 'GOOD';
  if (sinkRate < 2.6) return 'HARD';
  return 'WRECKED';
}

export function missionStartPosition(mission) {
  if (mission.start) return [mission.start.x, mission.start.y, mission.start.z];
  if (mission.kind === 'home') {
    const point = mission.waypoints[0];
    const heading = AIRFIELD.heading * Math.PI / 180;
    return [point.x - Math.sin(heading) * 700, 265, point.z + Math.cos(heading) * 700];
  }
  const point = mission.rings[0];
  const heading = (point.heading || 0) * Math.PI / 180;
  return [point.x - Math.sin(heading) * 380, point.y, point.z + Math.cos(heading) * 380];
}

function announceStage(mission, world) {
  const stage = mission.stages[mission.stageIndex];
  if (stage) {
    mission.goal = stage.goal;
    mission.toast = stage.title;
    mission.toastTime = mission.elapsed;
  }
  world.onStageEnter?.(mission.stageIndex);
}

function completeStage(mission, world) {
  const stage = mission.stages[mission.stageIndex];
  if (!stage) return;
  stage.done = true;
  mission.score += 150;
  mission.stageIndex += 1;
  world.score = Math.round(mission.score);
  if (mission.stageIndex >= mission.stages.length) {
    mission.finished = true;
    mission.grade = 'SORTIE COMPLETE';
    mission.score += Math.round(mission.timeLeft * 3);
    return;
  }
  announceStage(mission, world);
}

function countKills(mission, world) {
  const forces = world.forces;
  if (!forces) return;
  let kills = 0;
  for (const unit of forces.units) if (!unit.alive) kills += 1;
  mission.kills = kills;
}

function stepStage(mission, world) {
  const stage = mission.stages[mission.stageIndex];
  if (!stage || mission.finished) return;
  if (stage.kind === 'rings') {
    if (mission.ringsPassed >= stage.rings) completeStage(mission, world);
    return;
  }
  if (stage.kind === 'destroy') {
    const forces = world.forces;
    if (!forces) return;
    const remaining = stage.targets.some((id) => {
      const unit = forces.byId.get(id);
      return unit ? unit.alive : false;
    });
    if (!remaining) completeStage(mission, world);
  }
}

export function stepMission(mission, world, dt) {
  if (mission.finished) return mission;
  mission.elapsed += dt;
  mission.timeLeft = Math.max(0, mission.timeLimit - mission.elapsed);
  mission.warning = '';
  countKills(mission, world);

  if (mission.kind === 'fjord') {
    const ground = sampleTerrainHeight(world.state.position.x, world.state.position.z);
    const aboveWater = world.state.position.y - Math.max(0, ground);
    if (ground < 0 && aboveWater > 90) {
      mission.warning = 'TOO HIGH';
      mission.score = Math.max(0, mission.score - dt * 3);
    }
  }

  if (mission.kind === 'rings' || mission.kind === 'fjord' || mission.kind === 'strike') {
    const ring = mission.rings[mission.activeRing];
    if (ring && mission.previousPosition) {
      const axisHeading = (ring.heading || 0) * Math.PI / 180;
      const axis = { x: Math.sin(axisHeading), y: 0, z: -Math.cos(axisHeading) };
      const centre = { x: ring.x, y: ring.y, z: ring.z };
      const previousOffset = {
        x: mission.previousPosition.x - centre.x,
        y: mission.previousPosition.y - centre.y,
        z: mission.previousPosition.z - centre.z,
      };
      const currentOffset = {
        x: world.state.position.x - centre.x,
        y: world.state.position.y - centre.y,
        z: world.state.position.z - centre.z,
      };
      const before = previousOffset.x * axis.x + previousOffset.y * axis.y + previousOffset.z * axis.z;
      const after = currentOffset.x * axis.x + currentOffset.y * axis.y + currentOffset.z * axis.z;
      const radialSq = currentOffset.x * currentOffset.x + currentOffset.y * currentOffset.y
        + currentOffset.z * currentOffset.z - after * after;
      if (before * after <= 0 && radialSq <= 26 * 26) {
        const offCentre = Math.sqrt(Math.max(0, radialSq)) / 26;
        mission.ringsPassed += 1;
        mission.activeRing += 1;
        const accuracy = 1 - offCentre;
        const bonus = Math.round(COMBAT.scoreGate * (0.7 + accuracy * 0.5)) + Math.round(mission.timeLeft);
        mission.score += bonus;
        mission.toast = offCentre < 0.45 ? 'GATE · CENTRE PASS' : 'GATE';
        mission.toastTime = mission.elapsed;
        world.score = Math.round(mission.score);
        if (mission.kind !== 'strike' && mission.ringsPassed >= mission.rings.length) {
          mission.finished = true;
          mission.grade = 'COMPLETE';
        }
      }
    }
  } else if (mission.kind === 'home') {
    const waypoint = mission.waypoints[mission.waypointIndex];
    if (waypoint) {
      const dx = world.state.position.x - waypoint.x;
      const dy = world.state.position.y - waypoint.y;
      const dz = world.state.position.z - waypoint.z;
      if (dx * dx + dy * dy + dz * dz < 220 * 220) {
        mission.waypointIndex += 1;
        mission.score += 75;
        world.score = mission.score;
        mission.goal = mission.waypointIndex >= mission.waypoints.length ? 'Land runway 09 at Skyhaven' : 'Fly the final fix';
      }
    }
  }

  if (mission.kind === 'strike') stepStage(mission, world);

  if (world.state.touchdown && mission.kind === 'home') {
    mission.finished = true;
    mission.grade = world.state.touchdown.grade;
    mission.score += mission.grade === 'PERFECT' ? 500 : mission.grade === 'GOOD' ? 300 : 100;
    world.score = mission.score;
  }
  if (mission.timeLeft <= 0 && !mission.finished) {
    mission.finished = true;
    mission.grade = 'TIME';
  }
  world.finished = mission.finished;
  world.grade = mission.grade;
  world.score = Math.round(mission.score);
  return mission;
}
