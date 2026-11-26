// Canvas poster and mission cards. The 3D world stays visible behind these screens; the selected
// card is held on world.menuIndex so keyboard selection and drawing never disagree.
import { DESIGN, FONT, HUD, MISSIONS, PALETTE } from './config.js';

function tracked(ctx, value, x, y, size, colour, spacing = 2, align = 'left') {
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

function label(ctx, value, x, y, size, colour = HUD.cream, align = 'left', weight = 700) {
  const family = weight <= 500 ? FONT.body : FONT.ui;
  ctx.font = `${weight <= 600 ? 600 : 700} ${size}px ${family}`;
  ctx.fillStyle = colour;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(String(value), x, y);
}

function drawKestrelSilhouette(ctx, x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(243,231,206,0.9)';
  ctx.beginPath();
  ctx.moveTo(-230, -3);
  ctx.quadraticCurveTo(-115, -36, 90, -21);
  ctx.lineTo(225, -6);
  ctx.lineTo(238, 4);
  ctx.lineTo(83, 18);
  ctx.quadraticCurveTo(-100, 36, -230, 8);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-28, -15);
  ctx.lineTo(120, -105);
  ctx.lineTo(153, -101);
  ctx.lineTo(66, -8);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-20, 12);
  ctx.lineTo(105, 92);
  ctx.lineTo(136, 89);
  ctx.lineTo(52, 4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-190, -4);
  ctx.lineTo(-246, -66);
  ctx.lineTo(-217, -65);
  ctx.lineTo(-157, -4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.teal;
  ctx.fillRect(-72, -14, 206, 7);
  ctx.strokeStyle = 'rgba(243,231,206,0.75)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(248, 0, 48, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawTitle(ctx) {
  const wash = ctx.createLinearGradient(0, 0, DESIGN.width, 0);
  wash.addColorStop(0, 'rgba(9,31,37,0.92)');
  wash.addColorStop(0.58, 'rgba(9,31,37,0.58)');
  wash.addColorStop(1, 'rgba(9,31,37,0.12)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, DESIGN.width, DESIGN.height);
  ctx.fillStyle = 'rgba(198,154,82,0.92)';
  ctx.fillRect(70, 102, 86, 5);
  tracked(ctx, 'WINDWARD', 66, 190, 100, HUD.cream, 5);
  tracked(ctx, 'COAST PATROL', 72, 260, 26, HUD.amber, 8);
  label(ctx, 'THE CRADLE COAST · 1936', 74, 309, 14, 'rgba(243,231,206,0.72)', 'left', 600);
  drawKestrelSilhouette(ctx, 875, 390, 1.05);

  ctx.strokeStyle = 'rgba(198,154,82,0.65)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(74, 470); ctx.lineTo(595, 470);
  ctx.stroke();
  tracked(ctx, 'W/S PITCH   A/D ROLL   Q/E RUDDER', 74, 505, 13, HUD.cream, 1.4);
  tracked(ctx, 'SHIFT/CTRL THROTTLE   G GEAR   C CAMERA', 74, 535, 13, HUD.cream, 1.4);
  tracked(ctx, 'P PAUSE   R RESTART   M MUTE', 74, 565, 13, HUD.cream, 1.4);

  const pulse = 0.78 + Math.sin(performance.now() * 0.004) * 0.22;
  ctx.fillStyle = `rgba(198,154,82,${pulse})`;
  ctx.fillRect(74, 625, 286, 52);
  tracked(ctx, 'PRESS SPACE', 217, 651, 20, HUD.ink, 4, 'center');
  label(ctx, 'An original high-wing adventure over sea, cliff and fjord.', 74, 718, 14, 'rgba(243,231,206,0.68)', 'left', 400);
}

function drawMissionCard(ctx, mission, index, selected, x, y, width, height) {
  ctx.fillStyle = selected ? 'rgba(28,65,69,0.96)' : 'rgba(13,39,45,0.91)';
  ctx.strokeStyle = selected ? HUD.amber : 'rgba(198,154,82,0.55)';
  ctx.lineWidth = selected ? 4 : 2;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = selected ? HUD.amber : 'rgba(198,154,82,0.38)';
  ctx.fillRect(x, y, width, selected ? 8 : 4);

  tracked(ctx, `0${index + 1}`, x + 24, y + 42, 18, selected ? HUD.amber : HUD.brass, 2);
  ctx.fillStyle = selected ? HUD.brass : 'rgba(198,154,82,0.24)';
  ctx.beginPath();
  ctx.roundRect(x + width - 94, y + 24, 70, 34, 4);
  ctx.fill();
  label(ctx, `${mission.time} S`, x + width - 59, y + 42, 14, selected ? HUD.ink : HUD.cream, 'center', 800);

  const words = mission.name.split(' ');
  tracked(ctx, words[0], x + 24, y + 112, 32, HUD.cream, 1.5);
  tracked(ctx, words.slice(1).join(' '), x + 24, y + 151, 32, HUD.cream, 1.5);
  label(ctx, mission.goal, x + 24, y + 211, 15, 'rgba(243,231,206,0.76)', 'left', 500);

  ctx.strokeStyle = 'rgba(243,231,206,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 24, y + 249); ctx.lineTo(x + width - 24, y + 249);
  ctx.stroke();
  const detail = index === 0 ? '8 RINGS · RIDGE LINE' : index === 1 ? '6 GATES · LOW PASS' : 'WAYPOINTS · RUNWAY 09';
  tracked(ctx, detail, x + 24, y + 276, 11, selected ? HUD.amber : HUD.brass, 1.2);
  if (selected) {
    ctx.fillStyle = HUD.amber;
    ctx.beginPath();
    ctx.moveTo(x + width - 43, y + height - 35);
    ctx.lineTo(x + width - 27, y + height - 27);
    ctx.lineTo(x + width - 43, y + height - 19);
    ctx.closePath();
    ctx.fill();
  }
}

function drawMissionSelect(ctx, world) {
  ctx.fillStyle = 'rgba(8,29,35,0.84)';
  ctx.fillRect(0, 0, DESIGN.width, DESIGN.height);
  const topWash = ctx.createLinearGradient(0, 0, 0, 260);
  topWash.addColorStop(0, 'rgba(19,53,59,0.95)');
  topWash.addColorStop(1, 'rgba(19,53,59,0)');
  ctx.fillStyle = topWash;
  ctx.fillRect(0, 0, DESIGN.width, 260);
  tracked(ctx, 'CHOOSE YOUR SORTIE', 70, 79, 15, HUD.amber, 4);
  label(ctx, 'THE CRADLE COAST', 70, 128, 44, HUD.cream, 'left', 800);
  label(ctx, 'Three routes. One stout little monoplane.', 72, 174, 16, 'rgba(243,231,206,0.72)', 'left', 400);

  const selected = Math.max(0, Math.min(MISSIONS.length - 1, world.menuIndex || 0));
  const width = 360;
  const gap = 30;
  const startX = (DESIGN.width - (width * 3 + gap * 2)) / 2;
  for (let index = 0; index < MISSIONS.length; index += 1) {
    drawMissionCard(ctx, MISSIONS[index], index, index === selected, startX + index * (width + gap), 235, width, 330);
  }
  tracked(ctx, 'ARROW KEYS SELECT', DESIGN.width / 2, 636, 12, HUD.cream, 2, 'center');
  tracked(ctx, 'SPACE CONFIRM   ·   ESC BACK', DESIGN.width / 2, 670, 14, HUD.amber, 2, 'center');
  label(ctx, 'Tip: hold your speed through the rings. Climb before you turn.', DESIGN.width / 2, 742, 13, 'rgba(243,231,206,0.62)', 'center', 400);
}

function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(7,25,30,0.62)';
  ctx.fillRect(0, 0, DESIGN.width, DESIGN.height);
  ctx.fillStyle = 'rgba(12,40,46,0.96)';
  ctx.strokeStyle = HUD.brass;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(390, 270, 500, 250, 8);
  ctx.fill();
  ctx.stroke();
  tracked(ctx, 'PAUSED', DESIGN.width / 2, 330, 40, HUD.cream, 6, 'center');
  tracked(ctx, 'P OR ESC TO RESUME', DESIGN.width / 2, 403, 15, HUD.amber, 2, 'center');
  tracked(ctx, 'R TO RESTART', DESIGN.width / 2, 449, 13, HUD.cream, 2, 'center');
}

export function drawScreen(ctx, name, world, w, h) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const scale = Math.min(w / DESIGN.width, h / DESIGN.height);
  const x = (w - DESIGN.width * scale) / 2;
  const y = (h - DESIGN.height * scale) / 2;
  ctx.setTransform(scale, 0, 0, scale, x, y);
  if (name === 'TITLE') drawTitle(ctx);
  else if (name === 'MENU' || name === 'MISSION SELECT') drawMissionSelect(ctx, world);
  else if (name === 'PAUSED') drawPaused(ctx);
  else if (name === 'DEBRIEF') {
    ctx.fillStyle = 'rgba(7,25,30,0.72)';
    ctx.fillRect(0, 0, DESIGN.width, DESIGN.height);
    tracked(ctx, world.state.crashed ? 'WRECKED' : 'SORTIE ENDED', DESIGN.width / 2, 360, 46, world.state.crashed ? HUD.red : HUD.cream, 5, 'center');
    tracked(ctx, 'R TO FLY AGAIN  ·  ESC FOR MISSIONS', DESIGN.width / 2, 435, 14, HUD.amber, 2, 'center');
  }
}
