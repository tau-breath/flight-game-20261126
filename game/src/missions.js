// The three playable sorties: route progress, clocks, ring scoring, low-gate warnings and grades.
import { AIRFIELD, MISSIONS } from './config.js';
import { sampleTerrainHeight } from './terrain.js';

export function createMission(index = 0) {
  const definition = MISSIONS[Math.max(0, Math.min(MISSIONS.length - 1, index))];
  return {
    id: definition.id,
    kind: definition.kind,
    name: definition.name,
    goal: definition.goal,
    timeLimit: definition.timeLimit,
    rings: definition.route.map((point) => ({ ...point })),
    waypoints: definition.waypoints.map((point) => ({ ...point })),
    elapsed: 0,
    timeLeft: definition.timeLimit,
    ringsPassed: 0,
    activeRing: 0,
    waypointIndex: 0,
    score: 0,
    warning: '',
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
  if (mission.kind === 'home') {
    const point = mission.waypoints[0];
    const heading = AIRFIELD.heading * Math.PI / 180;
    return [point.x - Math.sin(heading) * 700, 265, point.z + Math.cos(heading) * 700];
  }
  const point = mission.rings[0];
  const heading = (point.heading || 0) * Math.PI / 180;
  return [point.x - Math.sin(heading) * 380, point.y, point.z + Math.cos(heading) * 380];
}

export function stepMission(mission, world, dt) {
  if (mission.finished) return mission;
  mission.elapsed += dt;
  mission.timeLeft = Math.max(0, mission.timeLimit - mission.elapsed);
  mission.warning = '';

  if (mission.kind === 'fjord') {
    const ground = sampleTerrainHeight(world.state.position.x, world.state.position.z);
    const aboveWater = world.state.position.y - Math.max(0, ground);
    if (ground < 0 && aboveWater > 90) {
      mission.warning = 'TOO HIGH';
      mission.score = Math.max(0, mission.score - dt * 3);
    }
  }

  if (mission.kind === 'rings' || mission.kind === 'fjord') {
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
        mission.ringsPassed += 1;
        mission.activeRing += 1;
        const bonus = 100 + Math.round(mission.timeLeft);
        mission.score += bonus;
        world.score = mission.score;
        if (mission.ringsPassed >= mission.rings.length) {
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
