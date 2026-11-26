// World orchestration: one flight state, one selected mission, exact previous-position ring tests
// and the finished/crashed/grade state consumed by the HUD and debrief.
import { STEP } from './config.js';
import { createFlightModel, createFlightState, resetFlight, stepFlight } from './flight.js';
import { createMission, missionStartPosition, stepMission } from './missions.js';

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
    },
    startMission(index = selectedMission) {
      selectedMission = Math.max(0, Math.min(2, index));
      world.menuIndex = selectedMission;
      mission = createMission(selectedMission);
      const point = mission.kind === 'home' ? mission.waypoints[0] : mission.rings[0];
      const heading = mission.kind === 'home' ? 90 : point.heading;
      world.reset(missionStartPosition(mission), heading, mission.kind === 'fjord' ? 62 : 74);
      world.state.throttle = mission.kind === 'fjord' ? 0.48 : 0.7;
      world.state.gearDown = mission.kind === 'home';
      world.mission = mission;
    },
    step(dt = STEP, input = { keys: new Set(), throttleDelta: 0, pitch: 0, roll: 0, yaw: 0 }) {
      previousPosition.copy(state.position);
      mission.previousPosition = previousPosition;
      const contact = stepFlight(model, state, input, dt);
      input.throttleDelta = 0;
      world.groundCollision = contact;
      world.crashed = state.crashed;
      world.clock = state.flightTime;
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
