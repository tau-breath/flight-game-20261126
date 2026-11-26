// Boot, rendering and screen flow. One requestAnimationFrame loop drives a fixed 1/60 s simulation;
// the two canvases share a resize but only the WebGL canvas owns the 3D scene.
import * as THREE from 'three';
import { MAX_FRAME, STEP } from './config.js';
import { createInput, ACTION_CAMERA, ACTION_CONFIRM, ACTION_GEAR, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART } from './input.js';
import { createWorld } from './world.js';
import { createTerrain, sampleTerrainHeight } from './terrain.js';
import { createSky } from './sky.js';
import { createAirfield, createLighthouse } from './landmarks.js';
import { createRings, pickActiveRing, updateRings } from './rings.js';
import { createAircraft, updateAircraft } from './aircraft.js';
import { createCameraRig, updateCamera } from './camera.js';
import { drawHud } from './hud.js';
import { drawScreen } from './screens.js';
import { stageShot } from './shots.js';
import { createEffects, resetEffects, updateEffects } from './effects.js';
import { createAudio } from './audio.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const parsedSeed = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(parsedSeed) ? parsedSeed : 1;
const sceneCanvas = document.getElementById('scene');
const hudCanvas = document.getElementById('hud');
const status = document.getElementById('status');
const hudContext = hudCanvas.getContext('2d');

let firstError = null;
window.addEventListener('error', (event) => {
  if (!firstError) firstError = event.message || String(event.error || 'Unknown error');
});
window.addEventListener('unhandledrejection', (event) => {
  if (!firstError) firstError = String(event.reason?.message || event.reason || 'Unhandled rejection');
});

const renderer = new THREE.WebGLRenderer({
  canvas: sceneCanvas, antialias: true, alpha: false, powerPreference: 'high-performance',
});
renderer.shadowMap.enabled = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.setClearColor('#7FB2D8', 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.15, 22000);
const cameraRig = createCameraRig(camera);
const world = createWorld(seed);
const terrain = createTerrain(scene);
const sky = createSky(scene, seed);
const sunGlow = scene.getObjectByName('Sun glow');
const aircraft = createAircraft(scene);
const effects = createEffects(scene);
const audio = createAudio();
const audioEvents = { initialized: false, rings: 0, touchdownTime: -1, crashed: false };
const airfield = createAirfield(scene);
const lighthouse = createLighthouse(scene);
let rings = createRings(scene, world.mission);

const hemisphere = new THREE.HemisphereLight('#D8ECF2', '#6D6247', 1.75);
scene.add(hemisphere);
const sunlight = new THREE.DirectionalLight('#FFF0CF', 2.35);
scene.add(sunlight);

function rebuildRings() {
  if (rings?.group) {
    scene.remove(rings.group);
    const materials = new Set();
    rings.group.traverse((object) => {
      if (object.material) materials.add(object.material);
    });
    for (const material of materials) material.dispose();
    if (rings[0]?.torus.geometry) rings[0].torus.geometry.dispose();
    rings.haloMap?.dispose();
  }
  rings = createRings(scene, world.mission);
  scene.add(rings.group);
  pickActiveRing(rings, world.mission.activeRing);
}

function scenicReset() {
  const x = -1750;
  const z = -1450;
  world.reset([x, sampleTerrainHeight(x, z) + 340, z], 87, 78);
  world.state.throttle = 0.67;
}
scenicReset();

let screen = 'TITLE';
let cameraMode = 'chase';
let fps = 60;
let lastFrameTime = performance.now();
let accumulator = 0;
let announcedScreen = '';

function announce(message) {
  if (status) status.textContent = message;
}

function setScreen(next) {
  screen = next;
  if (screen !== announcedScreen) {
    announcedScreen = screen;
    if (screen === 'TITLE') announce('WINDWARD Coast Patrol. Press Space to begin.');
    else if (screen === 'MENU') announce('Mission select. Use arrow keys and press Space.');
    else if (screen === 'FLYING') announce('Flying. W and S pitch, A and D roll, Q and E rudder.');
    else if (screen === 'PAUSED') announce('Paused. Press P or Escape to resume.');
    else if (screen === 'DEBRIEF') announce(world.state.crashed ? 'Wrecked. Press R to fly again.' : 'Sortie ended.');
  }
}

function unlockAudio() {
  audio.start();
}
window.addEventListener('keydown', unlockAudio, { passive: true });
window.addEventListener('pointerdown', unlockAudio, { passive: true });
window.addEventListener('click', unlockAudio);

function syncAudioEvents() {
  if (!audioEvents.initialized) {
    audioEvents.rings = world.mission.ringsPassed;
    audioEvents.initialized = true;
  }
  const passed = world.mission.ringsPassed;
  if (passed > audioEvents.rings) {
    const count = Math.min(passed - audioEvents.rings, world.mission.rings.length);
    for (let index = 0; index < count; index += 1) audio.ring();
  }
  audioEvents.rings = passed;

  const touchdown = world.state.touchdown;
  if (touchdown) {
    if (touchdown.time !== audioEvents.touchdownTime) {
      audio.touchdown(touchdown.grade);
      audioEvents.touchdownTime = touchdown.time;
    }
  } else {
    audioEvents.touchdownTime = -1;
  }

  if (world.crashed && !audioEvents.crashed) audio.crash();
  audioEvents.crashed = world.crashed;
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  // The WebGL buffer is capped at native resolution; the HUD may use a sharper DPR.
  renderer.setPixelRatio(Math.min(dpr, 1));
  renderer.setSize(width, height, false);
  hudCanvas.width = Math.round(width * dpr);
  hudCanvas.height = Math.round(height * dpr);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

function renderFrame(dt) {
  updateAircraft(aircraft, world.state, dt);
  updateEffects(effects, world, dt);
  syncAudioEvents();
  audio.updateFlight(world.state);
  airfield.update(world.clock);
  lighthouse.update(world.clock);
  updateRings(rings, world.mission.activeRing, world.clock);
  sky.update(dt);
  terrain.update(world.clock);
  updateCamera(cameraRig, world.state, dt, cameraMode);
  aircraft.canopy.visible = cameraMode !== 'cockpit';
  aircraft.canopyFrame.visible = cameraMode !== 'cockpit';
  sky.dome.position.copy(camera.position);
  sky.sun.position.copy(camera.position).addScaledVector(sky.sunDirection, 8200);
  if (sunGlow) sunGlow.position.copy(camera.position).addScaledVector(sky.sunDirection, 8100);
  sunlight.position.copy(camera.position).addScaledVector(sky.sunDirection, 1800);
  sunlight.target.position.copy(world.state.position);
  sunlight.target.updateMatrixWorld();
  renderer.render(scene, camera);

  if (screen === 'FLYING' || screen === 'PAUSED') {
    drawHud(hudContext, world.state, world, hudCanvas.width, hudCanvas.height, cameraMode, rings, camera);
    if (screen === 'PAUSED') drawScreen(hudContext, 'PAUSED', world, hudCanvas.width, hudCanvas.height);
  } else {
    drawScreen(hudContext, screen, world, hudCanvas.width, hudCanvas.height);
  }
}

function startMission(index = world.menuIndex) {
  world.startMission(index);
  resetEffects(effects);
  audioEvents.initialized = false;
  audioEvents.rings = 0;
  audioEvents.touchdownTime = -1;
  audioEvents.crashed = false;
  rebuildRings();
  cameraMode = 'chase';
  cameraRig.initialized = false;
  accumulator = 0;
  setScreen('FLYING');
}

function startFreeFlight() {
  startMission(world.menuIndex);
}

function runShot(name) {
  const staged = stageShot(name, world);
  resetEffects(effects);
  audioEvents.initialized = false;
  audioEvents.rings = 0;
  audioEvents.touchdownTime = -1;
  audioEvents.crashed = false;
  rebuildRings();
  if (staged.ringIndex >= 0) pickActiveRing(rings, staged.ringIndex);
  screen = staged.screen;
  cameraMode = staged.cameraMode;
  cameraRig.initialized = false;
  // Compile shaders before the two measured paints so startup is not mistaken for frame rate.
  renderFrame(STEP);
  let previous = performance.now();
  let painted = 0;
  function paint() {
    const now = performance.now();
    const dt = Math.max(STEP, Math.min(MAX_FRAME, (now - previous) / 1000));
    previous = now;
    const renderStart = performance.now();
    renderFrame(STEP);
    const renderMilliseconds = Math.max(0.1, performance.now() - renderStart);
    // Headless browsers can throttle rAF; this records the render work itself.
    fps = Math.min(144, 1000 / renderMilliseconds);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(sceneCanvas);
  world.menuIndex = 0;
  let previousLeft = false;
  let previousRight = false;
  let previousUp = false;
  let previousDown = false;

  function menuSelection() {
    const left = input.keys.has('ArrowLeft');
    const right = input.keys.has('ArrowRight');
    const up = input.keys.has('ArrowUp');
    const down = input.keys.has('ArrowDown');
    const direction = (right && !previousRight ? 1 : 0) - (left && !previousLeft ? 1 : 0)
      + (down && !previousDown ? 1 : 0) - (up && !previousUp ? 1 : 0);
    if (direction !== 0) world.menuIndex = (world.menuIndex + direction + 3) % 3;
    previousLeft = left;
    previousRight = right;
    previousUp = up;
    previousDown = down;
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) audio.muted = !audio.muted;
    if (screen === 'TITLE') {
      if (actions & ACTION_CONFIRM) setScreen('MENU');
    } else if (screen === 'MENU') {
      if (actions & ACTION_CONFIRM) startFreeFlight();
      else if (actions & ACTION_PAUSE) setScreen('TITLE');
    } else if (screen === 'FLYING') {
      if (actions & ACTION_PAUSE) setScreen('PAUSED');
      if (actions & ACTION_GEAR) world.state.gearDown = !world.state.gearDown;
      if (actions & ACTION_CAMERA) {
        cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';
        cameraRig.initialized = false;
      }
      if (actions & ACTION_RESTART) startFreeFlight();
    } else if (screen === 'PAUSED') {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) setScreen('FLYING');
      else if (actions & ACTION_RESTART) startFreeFlight();
    } else if (screen === 'DEBRIEF') {
      if (actions & ACTION_RESTART || actions & ACTION_CONFIRM) startFreeFlight();
      else if (actions & ACTION_PAUSE) setScreen('MENU');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.max(0.0001, Math.min(MAX_FRAME, (now - lastFrameTime) / 1000));
    lastFrameTime = now;
    fps = fps * 0.92 + Math.min(144, 1 / dt) * 0.08;
    input.update(dt);
    handleActions();
    if (screen === 'MENU') menuSelection();

    if (screen === 'FLYING') {
      accumulator += dt;
      while (accumulator >= STEP && screen === 'FLYING') {
        world.step(STEP, input);
        accumulator -= STEP;
        if (world.finished) setScreen('DEBRIEF');
      }
    } else {
      accumulator = 0;
    }
    const renderStart = performance.now();
    renderFrame(dt);
    const renderMilliseconds = Math.max(0.1, performance.now() - renderStart);
    fps = fps * 0.7 + Math.min(144, 1000 / renderMilliseconds) * 0.3;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'FLYING') setScreen('PAUSED');
    lastFrameTime = performance.now();
    accumulator = 0;
  });

  window.advanceTime = (milliseconds) => {
    const steps = Math.max(1, Math.round(milliseconds / (STEP * 1000)));
    for (let index = 0; index < steps && screen === 'FLYING'; index += 1) {
      world.step(STEP, input);
      if (world.finished) setScreen('DEBRIEF');
    }
    renderFrame(STEP);
  };
  window.render_game_to_text = () => JSON.stringify({
    mode: screen, mission: world.mission.name, speed: Number(world.state.speed.toFixed(2)),
    altitude: Number(world.state.position.y.toFixed(2)), heading: Number(world.state.heading.toFixed(2)),
    fuel: Number(world.state.fuel.toFixed(2)), damage: Number(world.state.damage.toFixed(2)),
    gearDown: world.state.gearDown, score: world.score, rings: world.mission.ringsPassed,
    activeRing: world.mission.activeRing + 1, timeLeft: Number(world.mission.timeLeft.toFixed(1)),
    warning: world.mission.warning, finished: world.finished, grade: world.grade,
  });

  setScreen('TITLE');
  requestAnimationFrame(frame);
}

const diagScreen = new THREE.Vector3();
window.__diag = () => {
  const active = rings[world.mission.activeRing];
  let ringScreen = null;
  if (active) {
    diagScreen.set(active.position.x, active.position.y, active.position.z);
    const toRing = diagScreen.clone().sub(world.state.position);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(world.state.quaternion);
    const inFront = toRing.dot(forward) > 0;
    diagScreen.project(camera);
    const projectedInFront = diagScreen.z >= -1 && diagScreen.z <= 1;
    const distance = toRing.length();
    const radiusPx = distance > 0 ? (active.radius / distance) * (camera.fov / 2)
      / Math.tan((camera.fov * Math.PI / 180) / 2) * (window.innerHeight / 2) : 0;
    ringScreen = {
      x: (diagScreen.x * 0.5 + 0.5) * window.innerWidth,
      y: (-diagScreen.y * 0.5 + 0.5) * window.innerHeight,
      inFront: inFront && projectedInFront,
      radiusPx: Math.round(radiusPx),
    };
  }
  return {
    fps: Number(fps.toFixed(1)),
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    mode: screen,
    speed: Number(world.state.speed.toFixed(2)),
    altitude: Number(world.state.position.y.toFixed(2)),
    heading: Number(world.state.heading.toFixed(2)),
    score: world.score,
    effects: effects.live,
    ringScreen,
    error: firstError,
  };
};
window.__shotReady = false;

async function waitForFonts() {
  try {
    if (document.fonts) {
      await Promise.all([
        document.fonts.load('600 32px "Barlow Condensed"'),
        document.fonts.load('700 32px "Barlow Condensed"'),
        document.fonts.load('400 16px Inter'),
        document.fonts.load('500 16px Inter'),
      ]);
      await document.fonts.ready;
    }
  } catch {
    // System fallbacks still produce readable text if a local font cannot be decoded.
  }
}

await waitForFonts();

if (shotName) runShot(shotName);
else runGame();
