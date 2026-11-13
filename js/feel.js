/* ============================================================
   JUNGLE OUTPOST — feel.js
   How moving and looking feels.
     - trauma shake: hits and blasts add "trauma"; the camera
       shakes with its square, smoothly (rotation, not jitter)
     - head bob, a dip and squash on landing, wider view and a
       streaked edge while sprinting or rolling
     - vault and climb: jump at waist-high cover to go over it
       (up to 1.55 m), or at a taller block to pull up (2.75 m)
     - lean left / right around cover (Z / V); shots follow
     - footfalls: dust, splashes and a body roll when strafing
     - depth of field while aiming (High only), rain on the lens
       with a wipe (T)
     - gamepad: sticks, triggers, buttons and rumble
   Everything visual can be switched off in Settings.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, W = JO.World, FX = JO.FX, A = JO.Audio, Q = JO.Q, Ev = JO.Events;
var Fe = JO.Feel = { on: true, t: 0, shake: 0, lean: 0, leanIn: 0, dip: 0, dipV: 0, sq: 0, fov: 0, bobX: 0, bobY: 0, trav: null, vaults: 0, climbs: 0, steps: 0, focus: 20, pad: null, padOn: false, drops: 0, wipes: 0, rumbles: 0 };
var time = 0, CAM = null;

/* ---------- trauma ---------- */
Fe.trauma = function (a) { a *= FX.shakeK === undefined ? 1 : FX.shakeK; Fe.t = Math.min(1, Fe.t + a); if (a > 0.25) rumble(a); };
function n1(t, s) { return Math.sin(t * 1.0 + s) * 0.5 + Math.sin(t * 2.3 + s * 1.7) * 0.3 + Math.sin(t * 4.1 + s * 0.6) * 0.2; }

/* ---------- landing ---------- */
Fe.land = function (vy) { var k = Math.min(1, Math.max(0, (-vy - 2) / 10)); if (k <= 0) return; Fe.dipV -= 1.6 + 3.2 * k; Fe.sq = Math.max(Fe.sq, 0.08 + 0.14 * k); Fe.lands = (Fe.lands | 0) + 1; if (k > 0.45) Fe.trauma(0.18 * k); };

/* ---------- vault and climb ---------- */
function boxAt(x, y, z) { var cs = W.colliders, e = 0.12; for (var i = 0; i < cs.length; i++) { var c = cs[i]; if (c.on && x > c.minx - e && x < c.maxx + e && z > c.minz - e && z < c.maxz + e && y > c.y0 - e && y < c.h + e) return c; } return null; }
function clearAt(x, z, y) { var cs = W.colliders, r = 0.42; for (var i = 0; i < cs.length; i++) { var c = cs[i]; if (!c.on || y >= c.h - 0.06 || y + 1.7 < c.y0) continue; if (x > c.minx - r && x < c.maxx + r && z > c.minz - r && z < c.maxz + r) return false; }
  return Math.abs(x) < W.halfWidth(z) - 0.5 && z < W.zMax - 0.5 && z > W.zMin + 0.5; }
// jump was pressed on the ground: is there something to go over or onto? Starts the move and returns true.
Fe.tryTraverse = function () {
  var P = JO.Player, I = JO.Input; if (Fe.trav || P.driving || P.rolling > 0 || I.moveY < 0.3) return false;
  var sy = Math.sin(P.yaw), cy = Math.cos(P.yaw), px = P.pos.x, py = P.pos.y, pz = P.pos.z;
  var t = W.raycast(px, py + 0.45, pz, sy, 0, cy, 1.15); if (t >= 1.15) return false;
  var c = boxAt(px + sy * (t + 0.06), py + 0.45, pz + cy * (t + 0.06)); if (!c || c.y0 > 0.2) return false;
  var rise = c.h - py; if (rise < 0.55 || rise > 2.75) return false;
  // how far to the other side along our heading?
  var far = 0; for (var s = t + 0.1; s < t + 4; s += 0.15) { if (!boxAt(px + sy * s, py + 0.45, pz + cy * s)) { far = s; break; } }
  var over = rise <= 1.55 && far > 0 && far - t <= 1.9 && clearAt(px + sy * (far + 0.55), pz + cy * (far + 0.55), py);
  var tx, ty, tz, kind;
  if (over) { tx = px + sy * (far + 0.55); tz = pz + cy * (far + 0.55); ty = py; kind = 'vault'; }
  else { tx = px + sy * (t + 0.6); tz = pz + cy * (t + 0.6); ty = c.h; kind = rise <= 1.55 ? 'mount' : 'climb'; if (tx < c.minx || tx > c.maxx || tz < c.minz || tz > c.maxz) { tx = Math.max(c.minx + 0.1, Math.min(c.maxx - 0.1, tx)); tz = Math.max(c.minz + 0.1, Math.min(c.maxz - 0.1, tz)); }
    if (boxAt(tx, c.h + 0.9, tz)) return false; }                                              // something sits on top of it
  Fe.trav = { kind: kind, t: 0, dur: kind === 'climb' ? 0.8 : (kind === 'vault' ? 0.42 : 0.5), x0: px, y0: py, z0: pz, x1: tx, y1: ty, z1: tz, top: c.h };
  if (kind === 'vault') Fe.vaults++; else Fe.climbs++;
  P.crouch = false; P.vx = P.vy = P.vz = 0; A.play('jump', 1.2); if (kind === 'climb' && P.gfx) P.gfx.playOnce('attack'); Ev.emit('traverse', kind);
  Ev.emit('noise', px, pz, kind === 'climb' ? 6 : 5, 'step'); return true;
};
// while a vault or climb runs it owns the player. Returns true if it moved him this step.
Fe.traversing = function (dt) {
  var v = Fe.trav, P = JO.Player; if (!v) return false; if (P.dead) { Fe.trav = null; return false; }
  v.t += dt; var k = Math.min(1, v.t / v.dur), e = k * k * (3 - 2 * k), hk;
  if (v.kind === 'vault') hk = Math.sin(k * Math.PI) * (v.top - v.y0 + 0.25);                 // up and over
  else hk = Math.min(1, k * 1.5) * (v.y1 - v.y0) + Math.sin(Math.min(1, k * 1.5) * Math.PI) * 0.15;
  var mk = v.kind === 'vault' ? e : Math.max(0, (k - 0.35) / 0.65);                          // climbing: up first, then forward
  P.pos.set(v.x0 + (v.x1 - v.x0) * mk, v.y0 + hk, v.z0 + (v.z1 - v.z0) * mk); P.vx = P.vy = P.vz = 0; P.onGround = false;
  P.model.g.position.copy(P.pos); P.model.g.rotation.y = P.yaw;
  if (k >= 1) { P.pos.set(v.x1, v.y1, v.z1); P.onGround = true; Fe.trav = null; Fe.land(-4.5); A.play('step', 1.3); }
  return true;
};

/* ---------- camera ---------- */
// part of Cam.compute: leaning moves the real camera, so shots come from where you look
Fe.offset = function (Cam) {
  if (Math.abs(Fe.lean) < 0.01) { Fe.leanIn = 0; return; }
  var want = Fe.lean * 0.62, dir = want > 0 ? 1 : -1, t = W.raycast(Cam.x, Cam.y, Cam.z, Cam.rx * dir, 0, Cam.rz * dir, Math.abs(want) + 0.3);
  var d = Math.min(Math.abs(want), Math.max(0, t - 0.3)) * dir; Fe.leanIn = d; Cam.x += Cam.rx * d; Cam.z += Cam.rz * d;
};
Fe.applyCam = function (camera, Cam) {
  var s = Fe.shake, on = Q.on('camFeel'), bx = on ? Fe.bobX : 0, by = on ? Fe.bobY - Fe.dip : 0;
  camera.position.set(Cam.x + Cam.rx * bx + n1(time * 31, 1) * s * 0.07, Math.max(0.2, Cam.y + by + n1(time * 27, 5) * s * 0.07), Cam.z + Cam.rz * bx + n1(time * 29, 9) * s * 0.07);
  camera.lookAt(camera.position.x + Cam.fx * 20, camera.position.y + Cam.fy * 20, camera.position.z + Cam.fz * 20);
  var roll = (on ? -Fe.lean * 0.075 - Fe.strafe * 0.012 : 0) + n1(time * 23, 3) * s * 0.045;
  if (roll) camera.rotateZ(roll); if (s > 0.001) { camera.rotateX(n1(time * 33, 7) * s * 0.03); camera.rotateY(n1(time * 37, 11) * s * 0.03); }
  var fov = Cam.fov + (on ? Fe.fov : 0); if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
};

/* ---------- lens rain ---------- */
var vis = null, vg = null, drops = [], visT = 0, wipeT = 0, VN = 46;
function visorInit() { vis = document.getElementById('visor'); if (!vis) return; vg = vis.getContext('2d'); for (var i = 0; i < VN; i++) drops.push({ a: 0, x: 0, y: 0, r: 0, v: 0 }); }
Fe.wipe = function () { if (wipeT > 0) return; wipeT = 0.35; Fe.wipes++; A.play('roll', 0.5); };
function visorFrame(real) {
  if (!vg) return; var Wx = JO.Weather, P = JO.Player, G = JO.Game, on = Q.n('visor') > 0 && (G.state === 'playing' || G.state === 'dying');
  var rain = on && Wx ? Wx.rain : 0, covered = P.pos.z < W.A0 ? false : false, live = 0, i, o;
  if (rain > 0.15 && !covered) { visT -= real * rain * (1 + Math.hypot(P.vx, P.vz) * 0.08); while (visT <= 0) { visT += 0.16; for (i = 0; i < VN; i++) if (drops[i].a <= 0) { o = drops[i]; o.a = 0.55 + Math.random() * 0.4; o.x = Math.random(); o.y = Math.random() * 0.9; o.r = 3 + Math.random() * 9; o.v = 0.01 + Math.random() * 0.05; break; } } }
  for (i = 0; i < VN; i++) { o = drops[i]; if (o.a <= 0) continue; o.a -= real * (wipeT > 0 ? 4 : 0.11); o.y += o.v * real * (o.r / 6); if (o.y > 1.02) o.a = 0; if (o.a > 0) live++; }
  if (wipeT > 0) wipeT -= real;
  Fe.drops = live; var show = live > 0 || wipeT > 0; if (vis.classList.contains('hidden') === show) vis.classList.toggle('hidden', !show); if (!show) return;
  Fe.visN = (Fe.visN | 0) + 1; if (Fe.visN % 2) return;                                         // redraw every other frame
  var w = vis.width, h = vis.height; vg.clearRect(0, 0, w, h);
  for (i = 0; i < VN; i++) { o = drops[i]; if (o.a <= 0) continue; var x = o.x * w, y = o.y * h, r = o.r * (w / 640);
    var gr = vg.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); gr.addColorStop(0, 'rgba(235,245,255,' + (0.5 * o.a).toFixed(3) + ')'); gr.addColorStop(0.7, 'rgba(150,180,200,' + (0.16 * o.a).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(20,30,40,' + (0.22 * o.a).toFixed(3) + ')');
    vg.fillStyle = gr; vg.beginPath(); vg.ellipse(x, y, r * 0.8, r * 1.15, 0, 0, 6.3); vg.fill();
    vg.fillStyle = 'rgba(200,220,235,' + (0.07 * o.a).toFixed(3) + ')'; vg.fillRect(x - r * 0.25, y - r * 5, r * 0.5, r * 5); }
  if (wipeT > 0) { var k = 1 - wipeT / 0.35; vg.fillStyle = 'rgba(210,225,235,0.13)'; vg.fillRect(w * k - w * 0.2, 0, w * 0.2, h); }
}

/* ---------- gamepad ---------- */
var prevB = [], padFire = false, padAds = false, padLean = 0;
function rumble(a) { var p = Fe.pad; if (!p || !Q.on('vibration') || !p.vibrationActuator || !p.vibrationActuator.playEffect) return; Fe.rumbles++;
  try { p.vibrationActuator.playEffect('dual-rumble', { duration: 90 + a * 260, strongMagnitude: Math.min(1, a * 1.2), weakMagnitude: Math.min(1, 0.3 + a) }); } catch (e) { /* not supported */ } }
function dz(v) { return Math.abs(v) < 0.16 ? 0 : (v - (v > 0 ? 0.16 : -0.16)) / 0.84; }
Fe.pollPad = function (real) {
  var I = JO.Input, G = JO.Game, pads = navigator.getGamepads ? navigator.getGamepads() : [], p = null, i;
  for (i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected && pads[i].axes.length >= 4) { p = pads[i]; break; }
  Fe.pad = p; if (!p) { if (Fe.padOn) { Fe.padOn = false; I.joy.x = I.joy.y = 0; padLean = 0; } return; }
  var b = function (n) { var o = p.buttons[n]; return !!(o && (o.pressed || o.value > 0.4)); }, hit = function (n) { return b(n) && !prevB[n]; };
  var lx = dz(p.axes[0]), ly = dz(p.axes[1]), rx = dz(p.axes[2]), ry = dz(p.axes[3]), any = lx || ly || rx || ry;
  for (i = 0; i < p.buttons.length && !any; i++) if (b(i)) any = true;
  if (any && !Fe.padOn) { Fe.padOn = true; if (JO.UI) JO.UI.toast('GAMEPAD', 'Controller connected', '#58e0d0'); }
  if (!Fe.padOn) return;
  if (hit(9)) { if (I.onPause) I.onPause(); }
  if (G.state === 'playing' && !I.external) {
    I.joy.x = lx; I.joy.y = -ly; if ((rx || ry) && I.onLook) I.onLook(rx * 900 * real * (1 + Math.abs(rx)), ry * 620 * real);
    var f = b(7); if (f) { I.fire = true; padFire = true; } else if (padFire) { I.fire = false; padFire = false; }
    var a = b(6); if (a) { I.ads = true; padAds = true; } else if (padAds) { I.ads = false; padAds = false; }
    if (hit(0)) I.jumpPressed = true; if (hit(1)) I.rollPressed = true; if (hit(2)) { I.reloadPressed = true; I.interactPressed = true; } if (hit(3)) I.weapon = -1;
    if (hit(4)) I.smokePressed = true; if (hit(5)) I.nadePressed = true; if (hit(11)) I.meleePressed = true; if (hit(12)) I.lightPressed = true; if (hit(13)) I.crouchPressed = true; if (hit(8)) I.benchPressed = true;
    I.padSprint = b(10); padLean = b(14) ? -1 : (b(15) ? 1 : 0);
  } else if (hit(0)) { var el = document.activeElement; if (el && el.click && el.tagName === 'BUTTON') el.click(); if (JO.Story && JO.Story.skip) JO.Story.skip(); }
  for (i = 0; i < p.buttons.length; i++) prevB[i] = b(i);
};

/* ---------- system ---------- */
var sprintK = 0, rollK = 0, stepPuff = 0;
JO.Sys.add('feel', {
  init: function () {
    visorInit(); CAM = JO.Cam;
    var add = FX.addShake; FX.addShake = function (m) { add(m); Fe.trauma(m * 0.75); };      // everything that used to jitter the camera now feeds trauma
    Ev.on('level_load', function () { Fe.t = 0; Fe.trav = null; Fe.lean = 0; Fe.dip = Fe.dipV = 0; for (var i = 0; i < drops.length; i++) drops[i].a = 0; });
    Ev.on('retry', function () { Fe.trav = null; Fe.t = 0; });
    Ev.on('player_hurt', function (amt) { rumble(Math.min(1, 0.3 + amt * 0.03)); });
    Ev.on('noise', function (x, z, r, kind) { if (kind !== 'step') return; var P = JO.Player; if (Math.abs(x - P.pos.x) > 0.5 || Math.abs(z - P.pos.z) > 0.5) return; Fe.steps++;
      if (P.inWater) { if (JO.Wildlife) JO.Wildlife.ripple(x, z, 0.7); } else if (!P.crouch && Q.on('camFeel')) { var s = JO.Phys ? JO.Phys.surface(x, 0.01, z).kind : 'dirt'; if (s === 'dirt' || s === 'sand') FX.burst(x, 0.08, z, 2, 0x9a8460, 0.8, 0.35, 1, 0.12, 0.4); } });
  },
  step: function (dt) {
    var I = JO.Input, K = I.keys, P = JO.Player, G = JO.Game;
    if (I.wipePressed) Fe.wipe();
    var want = (K.KeyV ? 1 : 0) - (K.KeyZ ? 1 : 0) + padLean; if (I.sprint || P.rolling > 0 || P.driving || P.dead || Fe.trav) want = 0;
    Fe.lean += (Math.max(-1, Math.min(1, want)) - Fe.lean) * Math.min(1, dt * 11); if (Math.abs(Fe.lean) < 0.003) Fe.lean = 0;
    if (I.padSprint && !I.external) I.sprint = true;
  },
  frame: function (dt, real) {
    var P = JO.Player, I = JO.Input, G = JO.Game, playing = G.state === 'playing' || G.state === 'dying', Po = JO.Post;
    Fe.pollPad(real); time += real;
    // trauma falls off; shake is its square
    if (Fe.t > 0) Fe.t = Math.max(0, Fe.t - real * 1.35); Fe.shake = Fe.t * Fe.t;
    // landing spring
    for (var left = Math.min(0.1, real); left > 0; left -= 1 / 120) { var h = Math.min(1 / 120, left); Fe.dipV += (-Fe.dip * 150 - Fe.dipV * 17) * h; Fe.dip += Fe.dipV * h; }      // negative = camera down
    if (Fe.dip > 0.03) { Fe.dip = 0.03; Fe.dipV = 0; } if (Fe.dip < -0.5) Fe.dip = -0.5;
    if (Fe.sq > 0) Fe.sq = Math.max(0, Fe.sq - real * 0.9);
    if (!playing) { visorFrame(real); return; }
    var sp = Math.hypot(P.vx, P.vz), sprinting = sp > 7.5 && P.onGround && P.rolling <= 0, moving = sp > 0.5 && P.onGround && P.rolling <= 0, ads = CAM.adsK;
    sprintK += ((sprinting ? 1 : 0) - sprintK) * Math.min(1, real * 6); rollK += ((P.rolling > 0 ? 1 : 0) - rollK) * Math.min(1, real * 12);
    var amp = moving ? (sprinting ? 1.5 : 1) * (P.crouch ? 0.5 : 1) * (1 - ads * 0.75) : 0;
    Fe.bobY += (Math.abs(Math.sin(P.walkPhase * 0.5)) * 0.055 * amp - 0.02 * amp - Fe.bobY) * Math.min(1, real * 14); Fe.bobX += (Math.sin(P.walkPhase * 0.5) * 0.03 * amp - Fe.bobX) * Math.min(1, real * 14);
    Fe.fov = sprintK * 5.5 + rollK * 3.5; Fe.strafe = (Fe.strafe || 0) + ((P.onGround ? I.moveX : 0) - (Fe.strafe || 0)) * Math.min(1, real * 6);
    // the model: squash on landing, a little roll into strafes
    var g = P.model.g; if (Q.on('camFeel') && P.rolling <= 0 && !P.dead) { if (Fe.sq > 0) g.scale.y *= 1 - Fe.sq; g.rotation.z = -Fe.strafe * 0.06; } else g.rotation.z = 0;
    // what the final pass needs
    if (Po) { Po.blurMove = Q.n('blur') > 0 ? Math.min(1, sprintK * 0.35 + rollK * 0.8 + Fe.shake * 0.5) : 0; Po.vigAdd = Math.min(0.25, Math.abs(Fe.dip) * 0.5 + Fe.shake * 0.12);
      var wantDof = Q.n('dof') > 0 && ads > 0.25 ? ads : 0; Po.dofK = wantDof;
      if (wantDof > 0) { var t = W.raycast(CAM.x, CAM.y, CAM.z, CAM.fx, CAM.fy, CAM.fz, 120), H = Fe.hit || (Fe.hit = { t: 0 }); JO.Enemies.hitscan(CAM.x + CAM.fx * (CAM.dist + 0.2), CAM.y + CAM.fy * (CAM.dist + 0.2), CAM.z + CAM.fz * (CAM.dist + 0.2), CAM.fx, CAM.fy, CAM.fz, 120, H);
        var f = Math.min(t, H.t + CAM.dist + 0.2); Fe.focus += (Math.max(4, f) - Fe.focus) * Math.min(1, real * 7); Po.focus = Fe.focus; } }
    visorFrame(real);
  }
});
})();
