// 2D brass-and-cream flight HUD, drawn in a fixed 1280x800 design space and scaled to the canvas.
import { DESIGN, FONT, HUD, PALETTE } from './config.js';
import * as THREE from 'three';
import { clamp, wrapDegrees } from './mathutil.js';

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
  text(ctx, `THR ${Math.round(state.throttle * 100)}%`, 885, 660, 13, HUD.amber, 'center');
  text(ctx, `FUEL ${Math.round(state.fuel)}%`, 885, 690, 13, HUD.cream, 'center');
  text(ctx, `GEAR ${state.gearDown ? 'DOWN' : 'UP'}`, 885, 720, 13, HUD.cream, 'center');
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
    let relative = ((bearing - state.heading + 540) % 360) - 180;
    x = DESIGN.width / 2 + relative * 2.6;
    y = DESIGN.height / 2;
    x = Math.max(96, Math.min(DESIGN.width - 96, x));
    y = 250;
    ctx.strokeStyle = HUD.amber;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 9, y + 11); ctx.lineTo(x, y - 5); ctx.lineTo(x + 9, y + 11);
    ctx.stroke();
    text(ctx, `${Math.round(Math.abs(relative))}°`, x, y + 24, 12, HUD.amber, 'center');
    return;
  }

  ctx.strokeStyle = HUD.amber;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, y - 22); ctx.lineTo(x + 22, y); ctx.lineTo(x, y + 22); ctx.lineTo(x - 22, y);
  ctx.closePath();
  ctx.stroke();
  text(ctx, `${Math.round(distance)} M`, x, y + 37, 12, HUD.cream, 'center');
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
  text(ctx, formatClock(world.mission.timeLeft), box.x + 18, box.y + 61, 17, HUD.cream, 'left', 800);
  text(ctx, `RING ${Math.min(world.mission.ringsPassed + 1, world.mission.rings.length)}/${world.mission.rings.length}  SCORE ${String(world.score).padStart(6, '0')}`,
    box.x + box.width - 16, box.y + 61, 12, HUD.brass, 'right');
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
  ctx.fillStyle = HUD.amber;
  ctx.fillRect(x - 1.5, y - 1.5, 3, 3);

  if (state.stall && Math.floor(world.clock * 5) % 2 === 0) {
    ctx.fillStyle = 'rgba(80,18,18,0.72)';
    ctx.fillRect(x - 58, y - 62, 116, 31);
    ctx.strokeStyle = HUD.red;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 58, y - 62, 116, 31);
    trackedText(ctx, 'STALL', x, y - 46, 19, HUD.red, 3, 'center');
  }
}

function drawFlightStatus(ctx, state) {
  const x = DESIGN.width / 2;
  const y = DESIGN.height - 24;
  const label = `THR ${Math.round(state.throttle * 100)}%  ·  GEAR ${state.gearDown ? 'DOWN' : 'UP'}  ·  FUEL ${Math.round(state.fuel)}%`;
  ctx.font = `700 11px ${FONT.ui}`;
  const width = ctx.measureText(label).width + 28;
  panel(ctx, x - width / 2, y - 15, width, 28);
  trackedText(ctx, label, x, y - 1, 10, HUD.cream, 1.1, 'center');
}

export function drawHud(ctx, state, world, w, h, cameraMode = 'chase', rings = [], camera = null) {
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
  drawReticle(ctx, state, world);
  if (cameraMode === 'cockpit') {
    drawCockpitPanel(ctx, state);
  } else {
    drawSpeedTape(ctx, state.speed * 1.94384);
    drawAltitudeTape(ctx, state.position.y, state.verticalSpeed);
    drawFlightStatus(ctx, state);
    drawRoundInstruments(ctx, state);
  }
  drawTargetDiamond(ctx, state, rings[world.mission.activeRing] ?? null, camera);
  if (world.mission.warning && Math.floor(world.clock * 4) % 2 === 0) {
    trackedText(ctx, world.mission.warning, DESIGN.width / 2, DESIGN.height / 2 - 82, 19, HUD.red, 3, 'center');
  }
}
