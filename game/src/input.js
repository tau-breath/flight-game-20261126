// Keyboard, wheel, drag pointer and on-screen touch controls collapse into one small input state.
// One-shot presses are queued as flags so a quick tap cannot disappear between two fixed steps.
import { damp } from './mathutil.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_GEAR = 4;
export const ACTION_CAMERA = 8;
export const ACTION_RESTART = 16;
export const ACTION_MUTE = 32;
export const ACTION_ROCKET = 64;
export const ACTION_FLARE = 128;
export const ACTION_EVADE = 256;
export const ACTION_TARGET = 512;

const GAME_KEYS = new Set([
  'KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'KeyG', 'KeyC', 'KeyR', 'KeyM',
  'KeyF', 'KeyX', 'KeyZ', 'KeyP', 'Escape', 'Space', 'Enter', 'Tab', 'ShiftLeft', 'ShiftRight',
  'ControlLeft', 'ControlRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);

const ACTION_KEYS = new Map([
  ['Space', ACTION_CONFIRM], ['Enter', ACTION_CONFIRM], ['KeyP', ACTION_PAUSE],
  ['Escape', ACTION_PAUSE], ['KeyG', ACTION_GEAR], ['KeyC', ACTION_CAMERA],
  ['KeyR', ACTION_RESTART], ['KeyM', ACTION_MUTE], ['KeyF', ACTION_ROCKET],
  ['KeyX', ACTION_FLARE], ['KeyZ', ACTION_EVADE], ['Tab', ACTION_TARGET],
]);

/** Screen-space rectangles for the touch cockpit; the HUD draws exactly these. */
export function layoutTouchControls(width, height) {
  const base = Math.max(30, Math.min(width, height) * 0.085);
  return {
    stick: { x: base * 1.7, y: height - base * 1.7, r: base * 1.25 },
    fire: { x: width - base * 1.9, y: height - base * 1.9, r: base * 1.2 },
    rocket: { x: width - base * 4.2, y: height - base * 1.5, r: base * 0.74 },
    flare: { x: width - base * 1.6, y: height - base * 4.3, r: base * 0.7 },
    evade: { x: width - base * 4.1, y: height - base * 3.9, r: base * 0.7 },
    throttleUp: { x: width - base * 6.5, y: height - base * 1.4, r: base * 0.62 },
    throttleDown: { x: width - base * 6.5, y: height - base * 3.2, r: base * 0.62 },
  };
}

function inside(zone, x, y) {
  return Math.hypot(x - zone.x, y - zone.y) <= zone.r * 1.18;
}

export function createInput(target = window) {
  const keys = new Set();
  let actions = 0;
  let dragging = false;
  let pointerId = -1;
  let originX = 0;
  let originY = 0;
  let pointerX = 0;
  let pointerY = 0;
  const touchButtons = { fire: false, throttleUp: false, throttleDown: false };
  const touchPointers = new Map();

  const state = {
    pitch: 0, roll: 0, yaw: 0, throttleDelta: 0, keys,
    fire: false, touch: false, layout: null,
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeThrottleDelta() {
      const delta = state.throttleDelta;
      state.throttleDelta = 0;
      return delta;
    },
  };

  function clearHeld() {
    keys.clear();
    dragging = false;
    pointerId = -1;
    pointerX = 0;
    pointerY = 0;
    touchButtons.fire = false;
    touchButtons.throttleUp = false;
    touchButtons.throttleDown = false;
    touchPointers.clear();
  }

  window.addEventListener('keydown', (event) => {
    if (!GAME_KEYS.has(event.code)) return;
    keys.add(event.code);
    const flag = ACTION_KEYS.get(event.code);
    if (flag && !event.repeat) actions |= flag;
    event.preventDefault();
  }, { passive: false });

  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
    if (GAME_KEYS.has(event.code)) event.preventDefault();
  }, { passive: false });

  window.addEventListener('blur', clearHeld);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearHeld();
  });

  target.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      state.touch = true;
      state.layout = layoutTouchControls(window.innerWidth, window.innerHeight);
      const zone = state.layout;
      if (inside(zone.fire, event.clientX, event.clientY)) {
        touchButtons.fire = true;
        touchPointers.set(event.pointerId, 'fire');
        event.preventDefault();
        return;
      }
      if (inside(zone.rocket, event.clientX, event.clientY)) {
        actions |= ACTION_ROCKET;
        event.preventDefault();
        return;
      }
      if (inside(zone.flare, event.clientX, event.clientY)) {
        actions |= ACTION_FLARE;
        event.preventDefault();
        return;
      }
      if (inside(zone.evade, event.clientX, event.clientY)) {
        actions |= ACTION_EVADE;
        event.preventDefault();
        return;
      }
      if (inside(zone.throttleUp, event.clientX, event.clientY)) {
        touchButtons.throttleUp = true;
        touchPointers.set(event.pointerId, 'throttleUp');
        event.preventDefault();
        return;
      }
      if (inside(zone.throttleDown, event.clientX, event.clientY)) {
        touchButtons.throttleDown = true;
        touchPointers.set(event.pointerId, 'throttleDown');
        event.preventDefault();
        return;
      }
    }
    dragging = true;
    pointerId = event.pointerId;
    originX = event.clientX;
    originY = event.clientY;
    pointerX = 0;
    pointerY = 0;
    actions |= ACTION_CONFIRM;
    try { target.setPointerCapture?.(event.pointerId); } catch { /* capture is optional */ }
    event.preventDefault();
  }, { passive: false });

  target.addEventListener('pointermove', (event) => {
    if (!dragging || event.pointerId !== pointerId) return;
    pointerX = Math.max(-1, Math.min(1, (event.clientX - originX) / 120));
    pointerY = Math.max(-1, Math.min(1, (event.clientY - originY) / 120));
    event.preventDefault();
  }, { passive: false });

  function releasePointer(event) {
    const held = touchPointers.get(event.pointerId);
    if (held === 'fire') touchButtons.fire = false;
    if (held === 'throttleUp') touchButtons.throttleUp = false;
    if (held === 'throttleDown') touchButtons.throttleDown = false;
    touchPointers.delete(event.pointerId);
    if (event.pointerId !== pointerId) return;
    dragging = false;
    pointerId = -1;
  }
  target.addEventListener('pointerup', releasePointer);
  target.addEventListener('pointercancel', releasePointer);
  target.addEventListener('lostpointercapture', releasePointer);

  target.addEventListener('wheel', (event) => {
    state.throttleDelta += Math.max(-0.18, Math.min(0.18, -event.deltaY * 0.0012));
    event.preventDefault();
  }, { passive: false });

  /** Recompute held axes and ease a released stick back to centre. */
  state.update = function updateInput(dt) {
    const keyPitch = (keys.has('KeyS') ? 1 : 0) - (keys.has('KeyW') ? 1 : 0);
    const keyRoll = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    const keyYaw = (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0);
    if (!dragging) {
      pointerX = damp(pointerX, 0, 10, dt);
      pointerY = damp(pointerY, 0, 10, dt);
    }
    state.pitch = Math.max(-1, Math.min(1, keyPitch - pointerY));
    state.roll = Math.max(-1, Math.min(1, keyRoll + pointerX));
    state.yaw = Math.max(-1, Math.min(1, keyYaw));
    if (touchButtons.throttleUp) state.throttleDelta += 0.55 * dt;
    if (touchButtons.throttleDown) state.throttleDelta -= 0.55 * dt;
    state.fire = keys.has('Space') || touchButtons.fire;
  };

  return state;
}
