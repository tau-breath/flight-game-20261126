// World orchestration: one flight state, one selected mission, the weapons and the opposition that
// answer it, exact previous-position ring tests and the finished/crashed/grade state consumed by
// the HUD and debrief. Events raised during a step are drained by the renderer, which owns sound.
import { STEP } from './config.js';
import { createFlightModel, createFlightState, resetFlight, stepFlight } from './flight.js';
import { createMission, missionStartPosition, stepMission } from './missions.js';
import { resetCombat, stepCombat } from './combat.js';
import { loadMissionForces, spawnWaveById, stepForces } from './enemies.js';

export function createWorld(seed = 1, missionIndex = 0) {
  const model = createFlightModel(seed);
  const state = createFlightState();
  let selectedMission = missionIndex;
  let mission = createMission(selectedMission);
  const previousPosition = state.position.clone();
  const world = {
    seed: seed >>> 0,
    model,
    state,
    mission,
    menuIndex: selectedMission,
    previousPosition,
    score: 0,
    clock: 0,
    groundCollision: null,
    crashed: false,
    finished: false,
    grade: '',
    events: [],
    forces: null,
    combat: null,
    lastKill: null,
    onStageEnter: null,
    attachSystems({ forces, combat }) {
      world.forces = forces;
      world.combat = combat;
      forces.world = world;
      world.onStageEnter = (index) => {
        if (!forces) return;
        for (const wave of mission.waves) {
          if (wave.at === index) spawnWaveById(forces, mission, wave.id);
        }
      };
    },
    reset(position, headingDeg = 87, speed = 78) {
      resetFlight(state, position, headingDeg, speed);
      mission = createMission(selectedMission);
      previousPosition.copy(state.position);
      world.mission = mission;
      world.score = 0;
      world.clock = 0;
      world.groundCollision = null;
      world.crashed = false;
      world.finished = false;
      world.grade = '';
      world.events.length = 0;
      world.lastKill = null;
      if (world.combat) resetCombat(world.combat);
      if (world.forces) loadMissionForces(world.forces, mission);
    },
    startMission(index = selectedMission) {
      selectedMission = Math.max(0, Math.min(3, index));
      world.menuIndex = selectedMission;
      mission = createMission(selectedMission);
      const point = mission.kind === 'home' ? mission.waypoints[0] : mission.rings[0];
      const heading = mission.start ? mission.start.heading : mission.kind === 'home' ? 90 : point.heading;
      world.reset(missionStartPosition(mission), heading, mission.kind === 'fjord' ? 62 : 74);
      world.state.throttle = mission.kind === 'fjord' ? 0.48 : 0.7;
      world.state.gearDown = mission.kind === 'home';
      world.mission = mission;
      world.onStageEnter?.(0);
    },
    step(dt = STEP, input = { keys: new Set(), throttleDelta: 0, pitch: 0, roll: 0, yaw: 0 }) {
      previousPosition.copy(state.position);
      mission.previousPosition = previousPosition;
      const contact = stepFlight(model, state, input, dt);
      input.throttleDelta = 0;
      world.groundCollision = contact;
      world.crashed = state.crashed;
      world.clock = state.flightTime;
      if (world.combat && world.forces && !world.finished) {
        stepCombat(world.combat, world, world.forces, input, dt);
      }
      if (world.forces) stepForces(world.forces, world, world.combat, dt);
      stepMission(mission, world, dt);
      if (world.crashed) {
        world.finished = true;
        world.grade = 'WRECKED';
      }
      return contact;
    },
  };
  return world;
}
