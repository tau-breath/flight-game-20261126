// Keyboard, wheel and drag pointer collapse into one small input state. One-shot presses are queued
// as flags so a quick tap cannot disappear between two fixed simulation steps.
import { damp } from './mathutil.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_GEAR = 4;
export const ACTION_CAMERA = 8;
export const ACTION_RESTART = 16;
export const ACTION_MUTE = 32;

const GAME_KEYS = new Set([
  'KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'KeyG', 'KeyC', 'KeyR', 'KeyM',
  'KeyP', 'Escape', 'Space', 'Enter', 'ShiftLeft', 'ShiftRight', 'ControlLeft',
  'ControlRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);

const ACTION_KEYS = new Map([
  ['Space', ACTION_CONFIRM], ['Enter', ACTION_CONFIRM], ['KeyP', ACTION_PAUSE],
  ['Escape', ACTION_PAUSE], ['KeyG', ACTION_GEAR], ['KeyC', ACTION_CAMERA],
  ['KeyR', ACTION_RESTART], ['KeyM', ACTION_MUTE],
]);

export function createInput(target = window) {
  const keys = new Set();
  let actions = 0;
  let dragging = false;
  let pointerId = -1;
  let originX = 0;
  let originY = 0;
  let pointerX = 0;
  let pointerY = 0;

  const state = {
    pitch: 0, roll: 0, yaw: 0, throttleDelta: 0, keys,
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
  };

  return state;
}
