// 2D brass-and-cream flight HUD, drawn in a fixed 1280x800 design space and scaled to the canvas:
// instruments, the stage board, the lock ring, the threat and radar picture, the weapons strip.
import { COMBAT, DESIGN, FONT, HUD, PALETTE } from './config.js';
import * as THREE from 'three';
import { clamp, wrapDegrees } from './mathutil.js';
import { layoutTouchControls } from './input.js';

function gauge(ctx, x, y, radius, label, value, state, kind) {
  ctx.fillStyle = '#0B2026';
  ctx.strokeStyle = HUD.brass;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (kind === 'attitude') {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius - 4, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(x, y);
    ctx.rotate(-state.bank);
    const pitchOffset = clamp(state.pitch, -0.6, 0.6) * radius * 0.7;
    ctx.fillStyle = '#70A9C7';
    ctx.fillRect(-radius, -radius * 2 + pitchOffset, radius * 2, radius * 2);
    ctx.fillStyle = '#7B6245';
    ctx.fillRect(-radius, pitchOffset, radius * 2, radius * 2);
    ctx.strokeStyle = HUD.cream;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-radius, pitchOffset);
    ctx.lineTo(radius, pitchOffset);
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.strokeStyle = 'rgba(243,231,206,0.72)';
    ctx.lineWidth = 2;
    for (let tick = 0; tick < 12; tick += 1) {
      const angle = tick * Math.PI / 6;
      ctx.beginPath();
      ctx.moveTo(x + Math.sin(angle) * (radius - 9), y - Math.cos(angle) * (radius - 9));
      ctx.lineTo(x + Math.sin(angle) * (radius - 3), y - Math.cos(angle) * (radius - 3));
      ctx.stroke();
    }
  }

  const amount = kind === 'speed' ? clamp(state.speed / 110, 0, 1)
    : kind === 'altitude' ? clamp((state.position.y % 1000) / 1000, 0, 1) : 0;
  const needleAngle = kind === 'attitude' ? 0 : -Math.PI * 0.75 + amount * Math.PI * 1.5;
  ctx.strokeStyle = HUD.amber;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.sin(needleAngle) * (radius - 10), y - Math.cos(needleAngle) * (radius - 10));
  ctx.stroke();
  ctx.fillStyle = HUD.brass;
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, label, x, y + radius + 13, 9, HUD.cream, 'center');
  text(ctx, value, x, y + radius + 27, 11, HUD.amber, 'center');
}

export function drawRoundInstruments(ctx, state) {
  const layout = HUD.instruments;
  gauge(ctx, layout.centres[0], layout.y, layout.radius, 'AIRSPEED', `${Math.round(state.speed * 1.94384)} KT`, state, 'speed');
  gauge(ctx, layout.centres[1], layout.y, layout.radius, 'ATTITUDE', `${Math.round(state.bank * 180 / Math.PI)}°`, state, 'attitude');
  gauge(ctx, layout.centres[2], layout.y, layout.radius, 'ALTITUDE', `${Math.round(state.position.y)} M`, state, 'altitude');
}

/** The canopy frame and the ring sight, drawn over the world in the cockpit view. */
function drawCanopyFrame(ctx) {
  const width = DESIGN.width;
  const height = DESIGN.height;
  ctx.save();
  const sill = 546;
  const glass = ctx.createLinearGradient(0, sill - 26, 0, sill + 16);
  glass.addColorStop(0, 'rgba(20,48,54,0)');
  glass.addColorStop(1, 'rgba(16,40,46,0.9)');
  ctx.fillStyle = glass;
  ctx.fillRect(0, sill - 26, width, 42);
  ctx.fillStyle = 'rgba(14,38,44,0.97)';
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(0, sill);
  ctx.lineTo(196, sill);
  ctx.quadraticCurveTo(250, 660, 262, height);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(width, height);
  ctx.lineTo(width, sill);
  ctx.lineTo(width - 196, sill);
  ctx.quadraticCurveTo(width - 250, 660, width - 262, height);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(198,154,82,0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(196, sill);
  ctx.quadraticCurveTo(250, 660, 262, height);
  ctx.moveTo(width - 196, sill);
  ctx.quadraticCurveTo(width - 250, 660, width - 262, height);
  ctx.moveTo(0, sill);
  ctx.lineTo(196, sill);
  ctx.moveTo(width, sill);
  ctx.lineTo(width - 196, sill);
  ctx.stroke();

  // Ring and bead sight on the nose centreline.
  ctx.strokeStyle = 'rgba(243,231,206,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(DESIGN.width / 2, 400, 62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(198,154,82,0.7)';
  ctx.beginPath();
  ctx.arc(DESIGN.width / 2, 400, 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawCockpitPanel(ctx, state) {
  ctx.fillStyle = 'rgba(8,25,30,0.94)';
  ctx.strokeStyle = HUD.brass;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(360, 610, 560, 190, 18);
  ctx.fill();
  ctx.stroke();
  gauge(ctx, 470, 690, 47, 'AIRSPEED', `${Math.round(state.speed * 1.94384)} KT`, state, 'speed');
  gauge(ctx, 640, 690, 47, 'ATTITUDE', `${Math.round(state.bank * 180 / Math.PI)}°`, state, 'attitude');
  gauge(ctx, 810, 690, 47, 'ALTITUDE', `${Math.round(state.position.y)} M`, state, 'altitude');
  text(ctx, `HDG ${String(Math.round(wrapDegrees(state.heading))).padStart(3, '0')}`, 885, 656, 13, HUD.amber, 'center');
  text(ctx, `THR ${Math.round(state.throttle * 100)}%`, 885, 682, 13, HUD.cream, 'center');
  text(ctx, `FUEL ${Math.round(state.fuel)}%`, 885, 708, 13, HUD.cream, 'center');
  text(ctx, `GEAR ${state.gearDown ? 'DOWN' : 'UP'}`, 885, 734, 13, HUD.cream, 'center');
}

function projectToDesign(target, camera) {
  const position = new THREE.Vector3(target.x, target.y, target.z);
  position.project(camera);
  return {
    x: (position.x * 0.5 + 0.5) * DESIGN.width,
    y: (-position.y * 0.5 + 0.5) * DESIGN.height,
    depth: position.z,
  };
}

/** The four-corner bracket that names, ranges and holds a bandit once the ring is full. */
export function drawLockBox(ctx, state, target, combat, camera = null) {
  if (!target || !camera) return;
  const point = projectToDesign(target, camera);
  const distance = Math.round(Math.hypot(
    target.x - state.position.x, target.y - state.position.y, target.z - state.position.z));
  const onScreen = point.depth >= -1 && point.depth <= 1
    && point.x > 70 && point.x < DESIGN.width - 70 && point.y > 80 && point.y < DESIGN.height - 100;
  const locked = combat.locked;
  const colour = locked ? HUD.red : HUD.amber;

  if (!onScreen) {
    const bearing = Math.atan2(target.x - state.position.x, -(target.z - state.position.z)) * 180 / Math.PI;
    const relative = ((bearing - state.heading + 540) % 360) - 180;
    const edgeX = Math.max(70, Math.min(DESIGN.width - 70, DESIGN.width / 2 + relative * 3.1));
    const above = target.y > state.position.y;
    const edgeY = above ? 128 : DESIGN.height - 168;
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (above) {
      ctx.moveTo(edgeX - 11, edgeY + 12); ctx.lineTo(edgeX, edgeY - 4); ctx.lineTo(edgeX + 11, edgeY + 12);
    } else {
      ctx.moveTo(edgeX - 11, edgeY - 12); ctx.lineTo(edgeX, edgeY + 4); ctx.lineTo(edgeX + 11, edgeY - 12);
    }
    ctx.stroke();
    text(ctx, `${Math.round(Math.abs(relative))}° ${(distance / 1000).toFixed(1)}KM`, edgeX, edgeY + (above ? 26 : -24), 10, colour, 'center');
    return;
  }

  const size = clamp(2600 / Math.max(60, distance), 16, 54);
  ctx.strokeStyle = colour;
  ctx.lineWidth = locked ? 3 : 2;
  const corner = size * 0.42;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(point.x + sx * size - sx * corner, point.y + sy * size);
      ctx.lineTo(point.x + sx * size, point.y + sy * size);
      ctx.lineTo(point.x + sx * size, point.y + sy * size - sy * corner);
      ctx.stroke();
    }
  }
  if (!locked) {
    ctx.strokeStyle = 'rgba(255,196,107,0.4)';
    ctx.beginPath();
    ctx.arc(point.x, point.y, size * (1.5 - combat.lockProgress * 0.5), 0, Math.PI * 2);
    ctx.stroke();
  }
  const label = target.kind === 'fighter' ? (target.ace ? 'RAIDER LEAD' : 'RAIDER') : target.kind === 'gunboat' ? 'GUNBOAT' : 'FLAK BATTERY';
  const plateX = point.x - 66;
  ctx.fillStyle = 'rgba(10,30,36,0.72)';
  ctx.fillRect(plateX, point.y - size - 34, 132, 18);
  text(ctx, label, point.x, point.y - size - 25, 11, colour, 'center');
  ctx.fillStyle = 'rgba(10,30,36,0.72)';
  ctx.fillRect(plateX, point.y + size + 8, 132, 34);
  text(ctx, `${distance} M`, point.x, point.y + size + 19, 12, HUD.cream, 'center');
  if (locked) {
    const closing = Math.round(((state.velocity.x - 0) * (target.x - state.position.x)
      + (state.velocity.y - 0) * (target.y - state.position.y)
      + (state.velocity.z - 0) * (target.z - state.position.z)) / Math.max(1, distance));
    trackedText(ctx, `LOCK · CLOSING ${Math.max(0, closing)} M/S`, point.x, point.y + size + 34, 8, HUD.red, 1.0, 'center');
  }
}

function drawThreatMarks(ctx, state, forces, camera, lockTarget) {
  if (!camera || !forces) return;
  for (const unit of forces.units) {
    if (!unit.alive || unit === lockTarget) continue;
    const point = projectToDesign(unit, camera);
    if (point.depth < -1 || point.depth > 1) continue;
    if (point.x < 60 || point.x > DESIGN.width - 60 || point.y < 70 || point.y > DESIGN.height - 90) continue;
    ctx.strokeStyle = 'rgba(226,86,74,0.85)';
    ctx.lineWidth = 2;
    const s = 7;
    ctx.beginPath();
    ctx.moveTo(point.x - s, point.y - s); ctx.lineTo(point.x + s, point.y + s);
    ctx.moveTo(point.x + s, point.y - s); ctx.lineTo(point.x - s, point.y + s);
    ctx.stroke();
  }
}

/** A 1.6 km scope that turns with the nose: bandits amber, hulls red, the airfield a diamond. */
export function drawRadar(ctx, state, forces, airfield) {
  const box = HUD.radar;
  const { x, y, radius } = box;
  ctx.fillStyle = 'rgba(10,32,38,0.82)';
  ctx.strokeStyle = HUD.panelEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(198,154,82,0.32)';
  ctx.lineWidth = 1;
  for (const ring of [0.34, 0.67]) {
    ctx.beginPath();
    ctx.arc(x, y, radius * ring, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(x - radius + 4, y); ctx.lineTo(x + radius - 4, y);
  ctx.moveTo(x, y - radius + 4); ctx.lineTo(x, y + radius - 4);
  ctx.stroke();
  trackedText(ctx, 'SCOPE · 1.6KM', x, y - radius - 9, 8, HUD.brass, 1.4, 'center');

  const heading = state.heading * Math.PI / 180;
  const sin = Math.sin(heading);
  const cos = Math.cos(heading);
  const range = 1600;
  const plot = (wx, wz) => {
    const dx = wx - state.position.x;
    const dz = wz - state.position.z;
    const along = dx * sin - dz * cos;
    const right = dx * cos + dz * sin;
    const scale = radius / range;
    const magnitude = Math.hypot(right, along);
    const clampScale = magnitude > range ? range / magnitude : 1;
    return {
      x: x + right * scale * clampScale,
      y: y - along * scale * clampScale,
      edge: magnitude > range,
    };
  };

  if (airfield) {
    const point = plot(airfield.x, airfield.z);
    ctx.strokeStyle = HUD.cream;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y - 4); ctx.lineTo(point.x + 4, point.y);
    ctx.lineTo(point.x, point.y + 4); ctx.lineTo(point.x - 4, point.y);
    ctx.closePath();
    ctx.stroke();
  }

  if (forces) {
    for (const unit of forces.units) {
      if (!unit.alive) continue;
      const point = plot(unit.x, unit.z);
      ctx.fillStyle = unit.kind === 'fighter' ? HUD.amber : HUD.red;
      ctx.globalAlpha = point.edge ? 0.55 : 1;
      ctx.beginPath();
      if (unit.kind === 'fighter') {
        ctx.arc(point.x, point.y, 3.2, 0, Math.PI * 2);
      } else {
        ctx.rect(point.x - 3.4, point.y - 3.4, 6.8, 6.8);
      }
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  ctx.fillStyle = HUD.cream;
  ctx.beginPath();
  ctx.moveTo(x, y - 5); ctx.lineTo(x + 3.6, y + 4); ctx.lineTo(x - 3.6, y + 4);
  ctx.closePath();
  ctx.fill();
}

function hullColour(fraction) {
  if (fraction < 0.34) return HUD.red;
  if (fraction < 0.66) return HUD.amber;
  return '#7FC8A5';
}

/** Hull segments, gun rounds, rockets, flares, throttle and fuel in one strip. */
export function drawWeapons(ctx, state, world, x, y, width, height) {
  const combat = world.combat;
  if (!combat) return;
  panel(ctx, x, y, width, height);
  ctx.fillStyle = HUD.brass;
  ctx.fillRect(x, y, 4, height);
  const hull = clamp(1 - state.damage / 100, 0, 1);
  trackedText(ctx, 'HULL', x + 16, y + 16, 9, HUD.cream, 1.6);
  const barX = x + 58;
  const barW = width - 76;
  ctx.fillStyle = 'rgba(243,231,206,0.16)';
  ctx.fillRect(barX, y + 9, barW, 13);
  const segments = 10;
  for (let index = 0; index < segments; index += 1) {
    const lit = hull * segments > index;
    ctx.fillStyle = lit ? hullColour(hull) : 'rgba(243,231,206,0.12)';
    ctx.fillRect(barX + index * (barW / segments) + 1, y + 10, barW / segments - 2, 11);
  }
  text(ctx, `${Math.round(hull * 100)}`, x + width - 12, y + 16, 11, hullColour(hull), 'right');

  trackedText(ctx, 'GUN', x + 16, y + 38, 9, HUD.cream, 1.6);
  const ammoFraction = clamp(combat.ammo / COMBAT.gunAmmo, 0, 1);
  ctx.fillStyle = 'rgba(243,231,206,0.16)';
  ctx.fillRect(barX, y + 31, barW * 0.55, 9);
  ctx.fillStyle = ammoFraction < 0.15 ? HUD.red : HUD.amber;
  ctx.fillRect(barX, y + 31, barW * 0.55 * ammoFraction, 9);
  text(ctx, String(combat.ammo).padStart(4, '0'), x + width - 12, y + 36, 10, HUD.cream, 'right');

  trackedText(ctx, 'RKT', x + 16, y + 58, 9, HUD.cream, 1.6);
  for (let index = 0; index < COMBAT.missileCount; index += 1) {
    ctx.fillStyle = index < combat.missilesLeft ? HUD.amber : 'rgba(243,231,206,0.18)';
    ctx.beginPath();
    ctx.moveTo(x + 54 + index * 14, y + 53);
    ctx.lineTo(x + 60 + index * 14, y + 63);
    ctx.lineTo(x + 54 + index * 14, y + 63);
    ctx.closePath();
    ctx.fill();
  }
  trackedText(ctx, 'FLR', x + 122, y + 58, 9, HUD.cream, 1.6);
  for (let index = 0; index < COMBAT.flareCount; index += 1) {
    ctx.fillStyle = index < combat.flares ? '#FFD08A' : 'rgba(243,231,206,0.18)';
    ctx.beginPath();
    ctx.arc(x + 162 + index * 11, y + 58, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  text(ctx, `THR ${Math.round(state.throttle * 100)} · FUEL ${Math.round(state.fuel)}`,
    x + width - 12, y + 58, 9.5, 'rgba(243,231,206,0.78)', 'right', 500);

  const statusY = y + 78;
  trackedText(ctx, state.evadeTimer > 0 ? 'BARREL ROLL' : state.flareTimer > 0 ? 'FLARES OUT' : combat.fireHeld ? 'GUNS FIRING' : 'GUNS SAFE',
    x + 16, statusY, 10, state.evadeTimer > 0 || state.flareTimer > 0 ? HUD.amber : 'rgba(243,231,206,0.6)', 1.4);
  const accuracy = combat.shots > 0 ? Math.round(combat.hits / combat.shots * 100) : 0;
  text(ctx, `${state.gearDown ? 'GEAR DOWN' : 'GEAR UP'} · ACC ${accuracy}% · KILLS ${combat.kills}`,
    x + width - 12, statusY, 9, 'rgba(243,231,206,0.66)', 'right', 500);
}

/** The stage board: one row per task, struck through as it is finished. */
function drawStageBoard(ctx, world) {
  const box = HUD.stages;
  const stages = world.mission.stages;
  if (!stages.length) return;
  const height = 26 + stages.length * 19;
  panel(ctx, box.x, box.y, box.width, height);
  ctx.fillStyle = HUD.brass;
  ctx.fillRect(box.x, box.y, 4, height);
  trackedText(ctx, 'SORTIE BOARD', box.x + 16, box.y + 14, 9, HUD.brass, 2);
  for (let index = 0; index < stages.length; index += 1) {
    const stage = stages[index];
    const y = box.y + 32 + index * 19;
    const active = index === world.mission.stageIndex;
    const colour = stage.done ? 'rgba(243,231,206,0.42)' : active ? HUD.amber : 'rgba(243,231,206,0.72)';
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(box.x + 22, y, 5.4, 0, Math.PI * 2);
    ctx.stroke();
    if (stage.done) {
      ctx.beginPath();
      ctx.moveTo(box.x + 19, y); ctx.lineTo(box.x + 21.5, y + 3); ctx.lineTo(box.x + 26, y - 3.5);
      ctx.stroke();
    } else if (active) {
      ctx.fillStyle = HUD.amber;
      ctx.beginPath();
      ctx.arc(box.x + 22, y, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
    trackedText(ctx, `${index + 1} ${stage.title}`, box.x + 36, y, 10, colour, 1.3);
    text(ctx, stage.done ? 'DONE' : active ? stage.goal : '', box.x + box.width - 14, y, 9.5,
      active ? 'rgba(243,231,206,0.7)' : 'rgba(243,231,206,0.3)', 'right', 500);
  }
}

function panel(ctx, x, y, width, height) {
  ctx.fillStyle = HUD.panel;
  ctx.strokeStyle = HUD.panelEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 5);
  ctx.fill();
  ctx.stroke();
}

function text(ctx, value, x, y, size, colour = HUD.cream, align = 'left', weight = 700) {
  const family = weight <= 500 ? FONT.body : FONT.ui;
  ctx.font = `${weight <= 600 ? 600 : 700} ${size}px ${family}`;
  ctx.fillStyle = colour;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(String(value), x, y);
}

function trackedText(ctx, value, x, y, size, colour, spacing = 2, align = 'left') {
  ctx.font = `700 ${size}px ${FONT.ui}`;
  ctx.fillStyle = colour;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  const wholeString = String(value);
  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = `${spacing}px`;
    ctx.fillText(wholeString, x, y);
    ctx.letterSpacing = '0px';
  } else {
    ctx.fillText(wholeString, x - spacing * 0.35, y);
    ctx.fillText(wholeString, x, y);
    ctx.fillText(wholeString, x + spacing * 0.35, y);
  }
}

function signedDegrees(value) {
  return ((value + 540) % 360) - 180;
}

function cardinal(degrees) {
  const wrapped = wrapDegrees(degrees);
  if (wrapped < 12 || wrapped >= 348) return 'N';
  if (wrapped >= 78 && wrapped < 102) return 'E';
  if (wrapped >= 168 && wrapped < 192) return 'S';
  if (wrapped >= 258 && wrapped < 282) return 'W';
  return String(Math.round(wrapped / 30) * 30 % 360).padStart(3, '0');
}

function drawHeading(ctx, heading) {
  const box = HUD.heading;
  panel(ctx, box.x, box.y, box.width, box.height);
  const centre = box.x + box.width / 2;
  const pixelsPerDegree = 2.05;
  const start = Math.floor((heading - box.width / pixelsPerDegree / 2) / 5) * 5;
  const end = heading + box.width / pixelsPerDegree / 2;
  ctx.lineWidth = 2;
  for (let tick = start; tick <= end; tick += 5) {
    const offset = signedDegrees(tick - heading) * pixelsPerDegree;
    const x = centre + offset;
    if (x < box.x + 5 || x > box.x + box.width - 5) continue;
    const major = wrapDegrees(tick) % 30 === 0;
    ctx.strokeStyle = major ? HUD.cream : 'rgba(243,231,206,0.55)';
    ctx.beginPath();
    ctx.moveTo(x, box.y + box.height - (major ? 12 : 7));
    ctx.lineTo(x, box.y + box.height - 2);
    ctx.stroke();
    if (major) text(ctx, cardinal(tick), x, box.y + 12, 11, HUD.cream, 'center');
  }
  ctx.fillStyle = HUD.brass;
  ctx.fillRect(centre - 31, box.y + 12, 62, 27);
  ctx.strokeStyle = HUD.cream;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(centre - 31, box.y + 12, 62, 27);
  text(ctx, String(Math.round(wrapDegrees(heading))).padStart(3, '0'), centre, box.y + 26, 17, HUD.ink, 'center', 800);
  trackedText(ctx, 'HDG', centre, box.y - 7, 10, HUD.amber, 2, 'center');
}

function drawSpeedTape(ctx, speedKt) {
  const tape = HUD.speedTape;
  panel(ctx, tape.x, tape.y, tape.width, tape.height);
  const centreY = tape.y + tape.height / 2;
  const pixelsPerKnot = 1.9;
  const start = Math.floor((speedKt - 64) / 10) * 10;
  for (let tick = start; tick <= speedKt + 64; tick += 10) {
    const y = centreY - (tick - speedKt) * pixelsPerKnot;
    if (y < tape.y + 5 || y > tape.y + tape.height - 5 || tick < 0) continue;
    const major = tick % 20 === 0;
    ctx.strokeStyle = major ? HUD.cream : 'rgba(243,231,206,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tape.x + tape.width - (major ? 18 : 10), y);
    ctx.lineTo(tape.x + tape.width - 3, y);
    ctx.stroke();
    if (major) text(ctx, tick, tape.x + tape.width - 23, y, 10, HUD.cream, 'right');
  }
  ctx.fillStyle = HUD.brass;
  ctx.fillRect(tape.x - 5, centreY - 24, tape.width + 10, 48);
  ctx.strokeStyle = HUD.cream;
  ctx.lineWidth = 2;
  ctx.strokeRect(tape.x - 5, centreY - 24, tape.width + 10, 48);
  text(ctx, 'SPD', tape.x + tape.width / 2, centreY - 14, 10, HUD.ink, 'center');
  text(ctx, String(Math.round(speedKt)).padStart(3, '0'), tape.x + tape.width / 2 - 5, centreY + 7, 23, HUD.ink, 'center', 800);
  text(ctx, 'KT', tape.x + tape.width - 2, centreY + 17, 9, HUD.ink, 'right');
}

function drawAltitudeTape(ctx, altitude, verticalSpeed) {
  const tape = HUD.altitudeTape;
  panel(ctx, tape.x, tape.y, tape.width, tape.height);
  const centreY = tape.y + tape.height / 2;
  const pixelsPerMetre = 0.36;
  const start = Math.floor((altitude - 330) / 50) * 50;
  for (let tick = start; tick <= altitude + 330; tick += 50) {
    const y = centreY - (tick - altitude) * pixelsPerMetre;
    if (y < tape.y + 5 || y > tape.y + tape.height - 5 || tick < 0) continue;
    ctx.strokeStyle = HUD.cream;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tape.x + 3, y);
    ctx.lineTo(tape.x + (tick % 100 === 0 ? 18 : 10), y);
    ctx.stroke();
    if (tick % 100 === 0) text(ctx, tick, tape.x + 22, y, 10, HUD.cream, 'left');
  }
  ctx.fillStyle = HUD.brass;
  ctx.fillRect(tape.x - 5, centreY - 24, tape.width + 10, 48);
  ctx.strokeStyle = HUD.cream;
  ctx.lineWidth = 2;
  ctx.strokeRect(tape.x - 5, centreY - 24, tape.width + 10, 48);
  text(ctx, 'ALT', tape.x + tape.width / 2, centreY - 14, 10, HUD.ink, 'center');
  text(ctx, String(Math.max(0, Math.round(altitude))).padStart(3, '0'), tape.x + tape.width / 2 - 4, centreY + 7, 22, HUD.ink, 'center', 800);
  text(ctx, 'M', tape.x + tape.width - 2, centreY + 17, 9, HUD.ink, 'right');

  const needleX = tape.x + tape.width + 9;
  ctx.strokeStyle = 'rgba(243,231,206,0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(needleX, tape.y + 12);
  ctx.lineTo(needleX, tape.y + tape.height - 12);
  ctx.stroke();
  const needleY = centreY - clamp(verticalSpeed / 12, -1, 1) * (tape.height / 2 - 15);
  ctx.fillStyle = verticalSpeed < -5 ? HUD.red : HUD.amber;
  ctx.beginPath();
  ctx.moveTo(needleX - 6, needleY);
  ctx.lineTo(needleX + 5, needleY - 5);
  ctx.lineTo(needleX + 5, needleY + 5);
  ctx.closePath();
  ctx.fill();
}

function formatClock(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}

function drawMissionStrip(ctx, world) {
  const box = HUD.mission;
  panel(ctx, box.x, box.y, box.width, box.height);
  ctx.fillStyle = HUD.brass;
  ctx.fillRect(box.x, box.y, 5, box.height);
  trackedText(ctx, world.mission.name, box.x + 18, box.y + 18, 17, HUD.amber, 1.5);
  trackedText(ctx, world.mission.goal, box.x + 18, box.y + 39, 10, HUD.cream, 1.2);
  const stage = world.mission.stages[world.mission.stageIndex];
  if (stage) {
    text(ctx, `STAGE ${world.mission.stageIndex + 1}/${world.mission.stages.length}`, box.x + 18, box.y + 61, 10, HUD.brass, 'left', 600);
  }
  text(ctx, formatClock(world.mission.timeLeft), box.x + 112, box.y + 61, 17, HUD.cream, 'left', 800);
  text(ctx, `SCORE ${String(world.score).padStart(6, '0')}`, box.x + box.width - 16, box.y + 61, 13, HUD.brass, 'right');
}

function drawReticle(ctx, state, world) {
  const x = DESIGN.width / 2;
  const y = DESIGN.height / 2;
  ctx.strokeStyle = 'rgba(243,231,206,0.86)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 18, y); ctx.lineTo(x - 7, y);
  ctx.moveTo(x + 7, y); ctx.lineTo(x + 18, y);
  ctx.moveTo(x, y - 18); ctx.lineTo(x, y - 7);
  ctx.moveTo(x, y + 7); ctx.lineTo(x, y + 18);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,196,107,0.5)';
  ctx.beginPath();
  ctx.arc(x, y, 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = HUD.amber;
  ctx.fillRect(x - 1.5, y - 1.5, 3, 3);

  const combat = world.combat;
  if (combat?.markFlash > 0) {
    ctx.strokeStyle = HUD.cream;
    ctx.lineWidth = 3;
    const s = 13;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + sx * s, y + sy * s * 0.35);
      ctx.lineTo(x + sx * s * 0.35, y + sy * s * 0.35);
      ctx.lineTo(x + sx * s * 0.35, y + sy * s);
      ctx.stroke();
    }
  }

  if (state.stall && Math.floor(world.clock * 5) % 2 === 0) {
    ctx.fillStyle = 'rgba(80,18,18,0.72)';
    ctx.fillRect(x - 58, y - 62, 116, 31);
    ctx.strokeStyle = HUD.red;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 58, y - 62, 116, 31);
    trackedText(ctx, 'STALL', x, y - 46, 19, HUD.red, 3, 'center');
  }
}

function drawToasts(ctx, world) {
  const mission = world.mission;
  const age = mission.elapsed - mission.toastTime;
  if (mission.toast && age < 2.1) {
    const alpha = clamp(1 - (age - 1.4) / 0.7, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    const width = 470;
    ctx.fillStyle = 'rgba(12,35,41,0.9)';
    ctx.strokeStyle = HUD.amber;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(DESIGN.width / 2 - width / 2, 320, width, 46, 4);
    ctx.fill();
    ctx.stroke();
    trackedText(ctx, mission.toast, DESIGN.width / 2, 343, 19, HUD.amber, 3.4, 'center');
    ctx.restore();
  }
  if (world.lastKill && world.clock - world.lastKill.time < 2.4) {
    const alpha = clamp(1 - (world.clock - world.lastKill.time - 1.6) / 0.8, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    const width = 360;
    ctx.fillStyle = 'rgba(12,35,41,0.86)';
    ctx.strokeStyle = HUD.cream;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(DESIGN.width / 2 - width / 2, 378, width, 32, 3);
    ctx.fill();
    ctx.stroke();
    trackedText(ctx, world.lastKill.labels[world.lastKill.kind], DESIGN.width / 2, 394, 14, HUD.cream, 2.8, 'center');
    ctx.restore();
  }
}

function drawDamageVignette(ctx, state, combat) {
  const damage = state.damage / 100;
  const flash = combat ? clamp(combat.hitFlash / COMBAT.hitFlash, 0, 1) : 0;
  const strength = clamp(Math.max(flash, (damage - 0.55) * 1.4), 0, 1);
  if (strength <= 0.01) return;
  const gradient = ctx.createRadialGradient(DESIGN.width / 2, DESIGN.height / 2, 260,
    DESIGN.width / 2, DESIGN.height / 2, 760);
  gradient.addColorStop(0, 'rgba(150,26,20,0)');
  gradient.addColorStop(1, `rgba(150,26,20,${0.62 * strength})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, DESIGN.width, DESIGN.height);
}

function drawTouchControls(ctx, input, dpr) {
  if (!input || !input.touch) return;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const zones = layoutTouchControls(window.innerWidth, window.innerHeight);
  const drawZone = (zone, label, active, colour) => {
    ctx.globalAlpha = active ? 0.86 : 0.5;
    ctx.fillStyle = active ? colour : 'rgba(12,35,41,0.72)';
    ctx.strokeStyle = 'rgba(243,231,206,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, zone.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = active ? '#102F38' : 'rgba(243,231,206,0.86)';
    ctx.font = `700 ${Math.round(zone.r * 0.42)}px "Barlow Condensed", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, zone.x, zone.y);
  };
  drawZone(zones.fire, 'FIRE', Boolean(input.fire), '#FFC46B');
  drawZone(zones.rocket, 'RKT', false, '#FFC46B');
  drawZone(zones.flare, 'FLR', false, '#FFC46B');
  drawZone(zones.evade, 'ROLL', false, '#FFC46B');
  drawZone(zones.throttleUp, '+', false, '#FFC46B');
  drawZone(zones.throttleDown, '−', false, '#FFC46B');
  ctx.globalAlpha = 0.42;
  ctx.strokeStyle = 'rgba(243,231,206,0.8)';
  ctx.beginPath();
  ctx.arc(zones.stick.x, zones.stick.y, zones.stick.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawHud(ctx, state, world, w, h, cameraMode = 'chase', rings = [], camera = null, input = null) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const scale = Math.min(w / DESIGN.width, h / DESIGN.height);
  const x = (w - DESIGN.width * scale) / 2;
  const y = (h - DESIGN.height * scale) / 2;
  ctx.setTransform(scale, 0, 0, scale, x, y);
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';

  drawHeading(ctx, state.heading);
  drawMissionStrip(ctx, world);
  drawStageBoard(ctx, world);
  drawReticle(ctx, state, world);
  if (cameraMode === 'cockpit') {
    drawCanopyFrame(ctx);
    drawCockpitPanel(ctx, state);
    drawWeapons(ctx, state, world, 24, 686, 300, 96);
  } else {
    drawSpeedTape(ctx, state.speed * 1.94386);
    drawAltitudeTape(ctx, state.position.y, state.verticalSpeed);
    drawRoundInstruments(ctx, state);
    drawWeapons(ctx, state, world, 306, 686, 300, 96);
  }
  drawRadar(ctx, state, world.forces, { x: 6200, z: -1200 });
  drawTargetDiamond(ctx, state, rings[world.mission.activeRing] ?? null, camera);
  if (world.combat) {
    drawThreatMarks(ctx, state, world.forces, camera, world.combat.lockTarget);
    drawLockBox(ctx, state, world.combat.lockTarget, world.combat, camera);
    drawDamageVignette(ctx, state, world.combat);
  }
  drawToasts(ctx, world);
  if (world.mission.warning && Math.floor(world.clock * 4) % 2 === 0) {
    trackedText(ctx, world.mission.warning, DESIGN.width / 2, DESIGN.height / 2 - 82, 19, HUD.red, 3, 'center');
  }
  drawTouchControls(ctx, input, h > 0 ? w / Math.max(1, window.innerWidth) : 1);
}

/** Project the active target and draw a diamond, distance and off-screen bearing. */
export function drawTargetDiamond(ctx, state, target, camera = null) {
  if (!target || !camera) return;
  const position = new THREE.Vector3(target.position.x, target.position.y, target.position.z);
  position.project(camera);
  const onScreen = position.z >= -1 && position.z <= 1;
  let x = (position.x * 0.5 + 0.5) * DESIGN.width;
  let y = (-position.y * 0.5 + 0.5) * DESIGN.height;
  const distance = Math.round(Math.hypot(
    target.position.x - state.position.x,
    target.position.y - state.position.y,
    target.position.z - state.position.z,
  ));
  if (!onScreen || x < 90 || x > DESIGN.width - 90 || y < 90 || y > DESIGN.height - 110) {
    const bearing = Math.atan2(target.position.x - state.position.x, -(target.position.z - state.position.z)) * 180 / Math.PI;
    const relative = ((bearing - state.heading + 540) % 360) - 180;
    x = DESIGN.width / 2 + relative * 2.6;
    x = Math.max(96, Math.min(DESIGN.width - 96, x));
    y = 250;
    ctx.strokeStyle = HUD.amber;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 9, y + 11); ctx.lineTo(x, y - 5); ctx.lineTo(x + 9, y + 11);
    ctx.stroke();
    text(ctx, `${Math.round(Math.abs(relative))}°`, x, y + 24, 12, HUD.amber, 'center');
    text(ctx, `GATE ${distance} M`, x, y + 40, 10, HUD.cream, 'center');
    return;
  }

  ctx.strokeStyle = HUD.amber;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, y - 22); ctx.lineTo(x + 22, y); ctx.lineTo(x, y + 22); ctx.lineTo(x - 22, y);
  ctx.closePath();
  ctx.stroke();
  text(ctx, `${distance} M`, x, y + 37, 12, HUD.cream, 'center');
}
