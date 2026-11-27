// Arcade-sim flight in metres and seconds. Velocity chases the nose while gravity trades speed
// for height; bank produces a coordinated turn, and only a disciplined runway arrival is survivable.
import * as THREE from 'three';
import { AIRCRAFT, AIRFIELD, COMBAT, FLIGHT, STEP } from './config.js';
import { clamp, createRandom, damp, wrapDegrees } from './mathutil.js';
import { sampleTerrainHeight } from './terrain.js';
import { gradeTouchdown } from './missions.js';

const LOCAL_FORWARD = new THREE.Vector3(0, 0, -1);
const LOCAL_RIGHT = new THREE.Vector3(1, 0, 0);
const LOCAL_UP = new THREE.Vector3(0, 1, 0);
const LOCAL_AXIS_X = new THREE.Vector3(1, 0, 0);
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const scratchForward = new THREE.Vector3();
const scratchRight = new THREE.Vector3();
const scratchDirection = new THREE.Vector3();
const scratchAcceleration = new THREE.Vector3();
const scratchQuaternion = new THREE.Quaternion();
const scratchLevel = new THREE.Quaternion();
const scratchEuler = new THREE.Euler(0, 0, 0, 'YXZ');

export function createFlightModel(seed = 1) {
  return { seed: seed >>> 0, random: createRandom(seed) };
}

export function resetFlight(state, position = [0, 850, 0], headingDeg = 0, speed = 72) {
  if (Array.isArray(position)) state.position.set(position[0], position[1], position[2]);
  else state.position.copy(position);
  const heading = headingDeg * Math.PI / 180;
  state.quaternion.setFromEuler(scratchEuler.set(0, -heading, 0));
  scratchForward.copy(LOCAL_FORWARD).applyQuaternion(state.quaternion);
  state.velocity.copy(scratchForward).multiplyScalar(speed);
  state.throttle = 0.72;
  state.fuel = 100;
  state.damage = 0;
  state.gearDown = true;
  state.gearTarget = 1;
  state.gearFraction = 1;
  state.speed = speed;
  state.verticalSpeed = 0;
  state.heading = wrapDegrees(headingDeg);
  state.pitch = 0;
  state.bank = 0;
  state.gForce = 1;
  state.stall = false;
  state.crashed = false;
  state.onGround = false;
  state.onWater = false;
  state.rolling = false;
  state.touchdown = null;
  state.contact = null;
  state.flightTime = 0;
  state.flareTimer = 0;
  state.evadeTimer = 0;
  state.rollVisual = 0;
}

export function createFlightState() {
  const state = {
    position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), velocity: new THREE.Vector3(),
    throttle: 0.72, fuel: 100, damage: 0, gearDown: true, gearTarget: 1, gearFraction: 1,
    speed: 0, verticalSpeed: 0, heading: 0, pitch: 0, bank: 0, gForce: 1, stall: false,
    crashed: false, onGround: false, onWater: false, rolling: false, touchdown: null, contact: null,
    flightTime: 0, flareTimer: 0, evadeTimer: 0, rollVisual: 0,
  };
  resetFlight(state);
  return state;
}

function runwaySurfaceHeight() {
  return AIRFIELD.elevation + 1.2;
}

function isOverRunway(position) {
  return position.x >= AIRFIELD.thresholdX && position.x <= AIRFIELD.endX
    && Math.abs(position.z - AIRFIELD.z) <= AIRFIELD.width / 2;
}

function headingError() {
  return Math.abs(((wrapDegrees(stateHeading) - AIRFIELD.heading + 540) % 360) - 180);
}

let stateHeading = 0;
function runwayHeadingError(state) {
  stateHeading = state.heading;
  return headingError();
}

function crash(state, contact) {
  state.crashed = true;
  state.damage = 100;
  state.velocity.set(0, 0, 0);
  state.throttle = 0;
  state.contact = contact;
  state.onGround = false;
  state.rolling = false;
}

function applyRunwayContact(state, groundHeight, dt) {
  const surface = runwaySurfaceHeight();
  const sink = Math.max(0, -state.velocity.y);
  const speedKt = state.velocity.length() * 1.94384;
  const contact = {
    surface, overRunway: true, sink, speedKt, gearDown: state.gearDown,
    closure: sink, water: false, runway: true,
  };
  const aligned = Math.abs(state.bank) <= FLIGHT.landingBank && runwayHeadingError(state) <= FLIGHT.landingHeading;
  const speedSafe = speedKt >= FLIGHT.landingMinKt && speedKt <= FLIGHT.landingMaxKt;
  if (!state.gearDown || !aligned || sink >= FLIGHT.landingSink || !speedSafe) {
    crash(state, contact);
    return;
  }

  const grade = gradeTouchdown(sink, speedKt);
  state.touchdown = {
    grade, sink, speedKt, heading: wrapDegrees(state.heading),
    position: state.position.clone(), time: state.flightTime,
  };
  state.onGround = true;
  state.rolling = true;
  state.velocity.y = 0;
  state.position.y = surface + AIRCRAFT.gearHeight;
  state.position.z = AIRFIELD.z;
  state.contact = contact;
  if (grade === 'HARD') state.damage = clamp(state.damage + 28, 0, 100);
}

function applyGroundContact(state, groundHeight, dt) {
  const gearClearance = state.gearDown ? AIRCRAFT.gearHeight : 0.68;
  const surface = isOverRunway(state.position) ? runwaySurfaceHeight() : Math.max(0, groundHeight);
  const sink = Math.max(0, -state.velocity.y);
  const speed = state.velocity.length();
  const contact = {
    surface, overRunway: isOverRunway(state.position), sink, speedKt: speed * 1.94384,
    gearDown: state.gearDown, closure: sink, water: groundHeight < 0,
  };
  if (contact.overRunway) applyRunwayContact(state, groundHeight, dt);
  else crash(state, contact);
}

function stepGroundRoll(state, dt) {
  const surface = runwaySurfaceHeight();
  state.position.y = surface + AIRCRAFT.gearHeight;
  state.position.z = damp(state.position.z, AIRFIELD.z, 12, dt);
  state.velocity.y = 0;
  state.onWater = false;
  scratchForward.copy(LOCAL_FORWARD).applyQuaternion(state.quaternion);
  scratchForward.y = 0;
  if (scratchForward.lengthSq() < 0.001) scratchForward.set(1, 0, 0);
  scratchForward.normalize();
  const speed = Math.max(0, state.velocity.length() * Math.exp(-FLIGHT.rollFriction * dt));
  state.velocity.copy(scratchForward).multiplyScalar(speed);
  const heading = AIRFIELD.heading * Math.PI / 180;
  scratchLevel.setFromEuler(scratchEuler.set(0, -heading, 0));
  state.quaternion.slerp(scratchLevel, 1 - Math.exp(-7 * dt));
  state.position.addScaledVector(state.velocity, dt);
  if (state.position.x > AIRFIELD.endX + 40) {
    state.position.x = AIRFIELD.endX + 40;
    state.velocity.set(0, 0, 0);
  }
  state.contact = {
    surface, overRunway: isOverRunway(state.position), sink: 0,
    speedKt: state.speed * 1.94384, gearDown: true, water: false, runway: true,
  };
}

/** Advance one fixed step and return the contact record (also retained on state). */
export function stepFlight(model, state, input, dt = STEP) {
  if (state.crashed) return state.contact;
  state.flightTime += dt;

  const throttleInput = (input.keys.has('ShiftLeft') || input.keys.has('ShiftRight') ? 1 : 0)
    - (input.keys.has('ControlLeft') || input.keys.has('ControlRight') ? 1 : 0);
  state.throttle = clamp(state.throttle + throttleInput * 0.34 * dt + input.throttleDelta, 0, 1);
  state.fuel = clamp(state.fuel - (FLIGHT.fuelIdleBurn + FLIGHT.fuelThrottleBurn * state.throttle) * dt, 0, 100);
  if (state.fuel <= 0) state.throttle = 0;
  state.gearTarget = state.gearDown ? 1 : 0;
  state.gearFraction = damp(state.gearFraction, state.gearTarget, 3.2, dt);
  state.flareTimer = Math.max(0, state.flareTimer - dt);
  state.evadeTimer = Math.max(0, state.evadeTimer - dt);

  scratchForward.copy(LOCAL_FORWARD).applyQuaternion(state.quaternion).normalize();
  scratchRight.copy(LOCAL_RIGHT).applyQuaternion(state.quaternion).normalize();
  let speed = state.velocity.length();
  state.stall = speed < FLIGHT.stallSpeed;
  const authority = state.stall ? FLIGHT.stallLift : clamp(speed / FLIGHT.stallSpeed, 0.55, 1);
  const pitchRate = FLIGHT.pitchRate * Math.min(1, speed / FLIGHT.pitchAuthoritySpeed) * authority;

  scratchEuler.set(input.pitch * pitchRate * dt, 0, -input.roll * FLIGHT.rollRate * authority * dt, 'XYZ');
  scratchQuaternion.setFromEuler(scratchEuler);
  state.quaternion.multiply(scratchQuaternion).normalize();
  scratchEuler.set(0, -input.yaw * FLIGHT.rudderRate * clamp(speed / 30, 0.25, 1) * dt, 0, 'YXZ');
  state.quaternion.multiply(scratchQuaternion.setFromEuler(scratchEuler)).normalize();
  // The barrel roll is flown on the roll axis, not the stick: it turns the world over for a second
  // and cuts incoming fire, at the cost of losing sight of the target.
  if (state.evadeTimer > 0) {
    scratchQuaternion.setFromAxisAngle(LOCAL_FORWARD, COMBAT.evadeTurn * dt);
    state.quaternion.multiply(scratchQuaternion).normalize();
    state.rollVisual += COMBAT.evadeTurn * dt;
  }

  scratchForward.copy(LOCAL_FORWARD).applyQuaternion(state.quaternion).normalize();
  scratchRight.copy(LOCAL_RIGHT).applyQuaternion(state.quaternion).normalize();
  const bank = -Math.asin(clamp(scratchRight.y, -1, 1));
  const turnRate = speed > 4 ? clamp(FLIGHT.gravity * Math.tan(clamp(bank, -FLIGHT.maxBank, FLIGHT.maxBank)) / speed,
    -FLIGHT.maxTurnRate, FLIGHT.maxTurnRate) : 0;
  scratchQuaternion.setFromAxisAngle(WORLD_UP, -turnRate * dt);
  state.quaternion.premultiply(scratchQuaternion).normalize();

  if (state.stall) {
    const drop = FLIGHT.stallDrop * (1 - clamp(speed / FLIGHT.stallSpeed, 0, 1)) * dt;
    scratchQuaternion.setFromAxisAngle(LOCAL_AXIS_X, -drop);
    state.quaternion.multiply(scratchQuaternion).normalize();
  }

  if (speed > 0.05) {
    scratchDirection.copy(state.velocity).normalize();
    const turnBlend = 1 - Math.exp(-FLIGHT.velocityTurnRate * authority * dt);
    scratchDirection.lerp(scratchForward, turnBlend).normalize();
    state.velocity.copy(scratchDirection).multiplyScalar(speed);
  }

  const thrust = state.fuel > 0 ? FLIGHT.thrust * state.throttle * (1 - state.damage / FLIGHT.damageThrustScale) : 0;
  const drag = FLIGHT.dragArea * speed * speed;
  scratchAcceleration.copy(scratchForward).multiplyScalar(thrust / FLIGHT.mass);
  if (speed > 0.001) scratchAcceleration.addScaledVector(state.velocity, -drag / (FLIGHT.mass * speed));
  scratchAcceleration.y -= FLIGHT.gravity;
  state.velocity.addScaledVector(scratchAcceleration, dt);
  state.position.addScaledVector(state.velocity, dt);

  const groundHeight = sampleTerrainHeight(state.position.x, state.position.z);
  if (state.rolling) {
    stepGroundRoll(state, dt);
  } else {
    const clearance = state.gearDown ? AIRCRAFT.gearHeight : 0.68;
    const surface = isOverRunway(state.position) ? runwaySurfaceHeight() : Math.max(0, groundHeight);
    if (state.position.y <= surface + clearance) {
      applyGroundContact(state, groundHeight, dt);
      if (state.rolling) stepGroundRoll(state, dt);
    } else {
      state.contact = null;
      state.onWater = false;
    }
  }

  if (state.damage >= FLIGHT.crashDamage && !state.crashed) crash(state, state.contact);

  scratchForward.copy(LOCAL_FORWARD).applyQuaternion(state.quaternion);
  scratchRight.copy(LOCAL_RIGHT).applyQuaternion(state.quaternion);
  scratchDirection.copy(LOCAL_UP).applyQuaternion(state.quaternion);
  state.speed = state.velocity.length();
  state.verticalSpeed = state.velocity.y;
  state.heading = wrapDegrees(Math.atan2(scratchForward.x, -scratchForward.z) * 180 / Math.PI);
  state.pitch = Math.asin(clamp(scratchForward.y, -1, 1));
  state.bank = -Math.asin(clamp(scratchRight.y, -1, 1));
  state.gForce = clamp(1 / Math.max(0.22, scratchDirection.y) + Math.abs(turnRate) * speed / FLIGHT.gravity, 0.2, 7);
  state.stall = state.speed < FLIGHT.stallSpeed;
  state.contact = state.contact || null;
  return state.contact;
}
