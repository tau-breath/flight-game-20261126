// Chase and pilot-eye cameras. The chase rig is spring damped; cockpit mode is rigid to the eye.
import * as THREE from 'three';
import { AIRCRAFT, CAMERA } from './config.js';
import { clamp, damp } from './mathutil.js';

const LOCAL_FORWARD = new THREE.Vector3(0, 0, -1);
const LOCAL_UP = new THREE.Vector3(0, 1, 0);
const desiredPosition = new THREE.Vector3();
const desiredLook = new THREE.Vector3();
const cameraUp = new THREE.Vector3();
const lookPoint = new THREE.Vector3();

export function createCameraRig(camera) {
  camera.near = CAMERA.near;
  camera.far = CAMERA.far;
  return {
    camera, mode: 'chase', initialized: false, time: 0,
    position: new THREE.Vector3(), look: new THREE.Vector3(), shake: 0,
  };
}

export function updateCamera(rig, state, dt, mode = 'chase') {
  const camera = rig.camera;
  rig.time += dt;
  if (rig.mode !== mode) {
    rig.mode = mode;
    rig.initialized = false;
  }
  const forward = LOCAL_FORWARD.clone().applyQuaternion(state.quaternion);
  const up = LOCAL_UP.clone().applyQuaternion(state.quaternion);

  if (mode === 'cockpit') {
    desiredPosition.set(CAMERA.cockpitEyeSide, AIRCRAFT.eyeHeight, -AIRCRAFT.eyeForward)
      .applyQuaternion(state.quaternion).add(state.position);
    camera.position.copy(desiredPosition);
    camera.up.copy(up).normalize();
    desiredLook.copy(forward).multiplyScalar(CAMERA.cockpitLookAhead)
      .addScaledVector(up, -CAMERA.cockpitLookDown).add(camera.position);
    camera.lookAt(desiredLook);
    camera.fov = CAMERA.cockpitFov;
    camera.updateProjectionMatrix();
    return;
  }

  desiredPosition.set(0, CAMERA.chaseUp, CAMERA.chaseBack)
    .applyQuaternion(state.quaternion).add(state.position);
  desiredLook.copy(forward).multiplyScalar(CAMERA.lookAhead)
    .addScaledVector(up, CAMERA.lookUp).add(state.position);
  cameraUp.copy(LOCAL_UP).applyAxisAngle(forward, -state.bank * CAMERA.bankRoll);
  const speedAmount = clamp(state.speed / 96, 0, 1);
  camera.fov = CAMERA.chaseFov + (CAMERA.speedFov - CAMERA.chaseFov) * speedAmount;

  const buffet = state.stall ? CAMERA.stallShake : clamp((state.gForce - 3) * 0.012, 0, 0.045);
  rig.shake = damp(rig.shake, buffet, 7, dt);
  if (rig.shake > 0.001) {
    desiredPosition.x += Math.sin(rig.time * 43.1) * rig.shake;
    desiredPosition.y += Math.sin(rig.time * 57.7) * rig.shake * 0.7;
    desiredPosition.z += Math.cos(rig.time * 39.3) * rig.shake * 0.45;
  }

  if (!rig.initialized) {
    rig.position.copy(desiredPosition);
    rig.look.copy(desiredLook);
    rig.initialized = true;
  } else {
    rig.position.x = damp(rig.position.x, desiredPosition.x, CAMERA.stiffness, dt);
    rig.position.y = damp(rig.position.y, desiredPosition.y, CAMERA.stiffness, dt);
    rig.position.z = damp(rig.position.z, desiredPosition.z, CAMERA.stiffness, dt);
    rig.look.x = damp(rig.look.x, desiredLook.x, CAMERA.stiffness * 1.15, dt);
    rig.look.y = damp(rig.look.y, desiredLook.y, CAMERA.stiffness * 1.15, dt);
    rig.look.z = damp(rig.look.z, desiredLook.z, CAMERA.stiffness * 1.15, dt);
  }

  lookPoint.copy(rig.look);
  camera.position.copy(rig.position);
  camera.up.copy(cameraUp).normalize();
  camera.lookAt(lookPoint);
  camera.updateProjectionMatrix();
}
