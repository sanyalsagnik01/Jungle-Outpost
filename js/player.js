/* ============================================================
   JUNGLE OUTPOST — player.js
   Player controller, third-person camera and the three weapons.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, CFG = JO.CFG, W = JO.World, FX = JO.FX, I = JO.Input, A = JO.Audio, M = JO.Models;
var PC = CFG.PLAYER, DEG = Math.PI / 180;

/* ============================================================
   PLAYER
   ============================================================ */
var P = JO.Player = {
  pos: new THREE.Vector3(), prev: new THREE.Vector3(), yaw: Math.PI, pitch: 0, kick: 0,
  vx: 0, vy: 0, vz: 0, kx: 0, kz: 0, hp: 100, maxHp: 100, armor: 0, maxPlates: 1, stamina: 100,
  onGround: true, rolling: 0, rollCd: 0, rollX: 0, rollZ: 1, invuln: 0, sinceDmg: 99, stamDelay: 0, dead: false,
  up: { hp: 0, fire: 0, reload: 0, plate: 0, mag: 0, stam: 0 }, stepDist: 0, walkPhase: 0, inWater: false, nearCrate: null, model: null
};

P.init = function (scene) { P.model = M.player(); scene.add(P.model.g); };
P.resetRun = function () {
  P.up = { hp: 0, fire: 0, reload: 0, plate: 0, mag: 0, stam: 0 }; P.maxHp = PC.hp; P.maxPlates = 1; P.hp = P.maxHp; P.armor = 0;
};
P.place = function (x, z) {
  P.pos.set(x, 0, z); P.prev.copy(P.pos); P.vx = P.vy = P.vz = P.kx = P.kz = 0; P.yaw = Math.PI; P.pitch = -0.05; P.kick = 0;
  P.rolling = 0; P.rollCd = 0; P.invuln = 0; P.dead = false; P.onGround = true; P.stamina = PC.stamina; P.sinceDmg = 99;
  P.model.g.visible = true; P.model.g.rotation.set(0, P.yaw, 0); P.model.g.position.copy(P.pos);
};
P.armorCap = function () { return P.maxPlates * PC.plateValue; };
P.applyUpgrade = function (id) {
  P.up[id]++;
  if (id === 'hp') { var old = P.maxHp; P.maxHp = Math.round(PC.hp * (1 + 0.25 * P.up.hp)); P.hp += P.maxHp - old; }
  else if (id === 'plate') { P.maxPlates++; P.armor = Math.min(P.armorCap(), P.armor + PC.plateValue); }
  else if (id === 'mag') { JO.Weapons.refill(false); }
};

P.look = function (dx, dy) {
  if (JO.Game.state !== 'playing' || P.dead) return;
  var s = 0.0023 * (I.ads ? 0.55 : 1);
  P.yaw -= dx * s; P.pitch -= dy * s;
  if (P.pitch > 1.2) P.pitch = 1.2; else if (P.pitch < -1.2) P.pitch = -1.2;
};

// returns true when damage was actually applied (false = dodged)
P.damage = function (amt, sx, sz, tag) {
  var Gm = JO.Game;
  if (P.dead || P.invuln > 0 || Gm.state !== 'playing' || Gm.bossDying) return false;
  amt *= Gm.diffCfg.dmg; Gm.stats.dmgTaken += amt;
  if (Gm.debug.dmgBy) Gm.debug.dmgBy[tag || 'other'] = (Gm.debug.dmgBy[tag || 'other'] || 0) + Math.round(amt);
  if (Gm.debug.god) return true;
  if (P.armor > 0) { var a = Math.min(P.armor, amt); P.armor -= a; amt -= a; A.play('armor'); }
  if (amt > 0) { P.hp -= amt; A.play('hurt'); }
  P.sinceDmg = 0; JO.UI.hurt(sx, sz); FX.addShake(Math.min(0.5, 0.12 + amt * 0.015));
  if (P.hp <= 0) { P.hp = 0; P.dead = true; P.rolling = 0; A.play('die'); Gm.onPlayerDead(); }
  return true;
};
P.knock = function (x, z) { P.kx += x; P.kz += z; };

P.update = function (dt) {
  P.prev.copy(P.pos);
  if (P.dead) { P.model.g.rotation.x = Math.max(-1.5, P.model.g.rotation.x - dt * 4); return; }
  var mx = I.moveX, my = I.moveY, len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; len = 1; }
  var sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
  var wx = sy * my - cy * mx, wz = cy * my + sy * mx;           // forward (sy,cy), right (-cy,sy)
  if (P.rollCd > 0) P.rollCd -= dt;
  if (P.invuln > 0) P.invuln -= dt;
  P.inWater = W.inWater(P.pos.x, P.pos.z) && P.pos.y < 0.3;

  var sprinting = false, speed;
  if (I.rollPressed && P.rollCd <= 0 && P.rolling <= 0 && P.onGround && P.stamina >= PC.rollCost) {
    P.rolling = PC.rollTime; P.invuln = PC.rollInvuln; P.rollCd = PC.rollCd; P.stamina -= PC.rollCost; P.stamDelay = PC.staminaDelay;
    if (len > 0.15) { var l = Math.hypot(wx, wz); P.rollX = wx / l; P.rollZ = wz / l; } else { P.rollX = sy; P.rollZ = cy; }
    A.play('roll');
  }
  if (P.rolling > 0) {
    P.rolling -= dt; speed = PC.rollSpeed * (P.rolling > 0.12 ? 1 : 0.55); P.vx = P.rollX * speed; P.vz = P.rollZ * speed;
  } else {
    sprinting = I.sprint && my > 0.2 && P.stamina > 1 && !I.ads;
    speed = I.ads ? PC.adsMove : (sprinting ? PC.sprint : PC.walk);
    if (P.inWater) speed *= 0.6;
    P.vx = wx * speed; P.vz = wz * speed;
    if (I.jumpPressed && P.onGround) { P.vy = PC.jump; P.onGround = false; A.play('jump'); }
  }
  if (sprinting) { P.stamina = Math.max(0, P.stamina - PC.sprintDrain * dt); P.stamDelay = PC.staminaDelay; }
  else if (P.stamDelay > 0) P.stamDelay -= dt;
  else if (P.stamina < PC.stamina) P.stamina = Math.min(PC.stamina, P.stamina + PC.staminaRegen * (1 + 0.5 * P.up.stam) * dt);

  P.vy -= PC.gravity * dt;
  P.pos.x += (P.vx + P.kx) * dt; P.pos.z += (P.vz + P.kz) * dt; P.pos.y += P.vy * dt;
  var kd = Math.max(0, 1 - dt * 6); P.kx *= kd; P.kz *= kd;
  var floor = W.moveCircle(P.pos, PC.radius, P.pos.y, true); W.clamp(P.pos, PC.radius);
  if (P.pos.y <= floor) { P.pos.y = floor; if (P.vy < -6) A.play('step', 1.6); P.vy = 0; P.onGround = true; } else P.onGround = false;

  var moved = Math.hypot(P.pos.x - P.prev.x, P.pos.z - P.prev.z);
  if (P.onGround && P.rolling <= 0) { P.stepDist += moved; P.walkPhase += moved * 2.3;
    if (P.stepDist > (sprinting ? 2.6 : 2.1)) { P.stepDist = 0; A.play(P.inWater ? 'splash' : 'step', sprinting ? 1.3 : 1);
      if (P.inWater) FX.burst(P.pos.x, 0.15, P.pos.z, 4, 0xcfeeee, 2, 0.35, 8, 0.1, 1.5); } }

  P.sinceDmg += dt;
  if (P.sinceDmg > PC.regenDelay && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + PC.regenRate * dt);

  // supply crates
  P.nearCrate = null;
  for (var i = 0; i < W.crates.length; i++) { var c = W.crates[i]; if (c.opened) continue;
    var dx = c.x - P.pos.x, dz = c.z - P.pos.z; if (dx * dx + dz * dz < 6.2) { P.nearCrate = c; break; } }
  if (P.nearCrate && (I.interactPressed || (I.isTouch && false))) { JO.Game.openCrate(P.nearCrate); P.nearCrate = null; }

  // model pose
  var m = P.model, g = m.g;
  g.position.copy(P.pos); g.rotation.y = P.yaw;
  if (P.rolling > 0) { var rp = 1 - P.rolling / PC.rollTime; g.rotation.x = rp * Math.PI * 2; g.position.y += 0.55 * Math.sin(rp * Math.PI); g.scale.setScalar(0.82); }
  else { g.rotation.x = 0; g.scale.setScalar(1); M.walk(m, P.walkPhase, moved > 0.01 && P.onGround ? 1 : 0, false); }
};

/* ============================================================
   CAMERA (over the shoulder, collision aware)
   ============================================================ */
var Cam = JO.Cam = { x: 0, y: 2, z: 5, fx: 0, fy: 0, fz: -1, rx: 1, rz: 0, ux: 0, uy: 1, uz: 0, dist: 3.8, fov: 65, adsK: 0 };
Cam.compute = function (alpha, frameDt) {
  var px = P.prev.x + (P.pos.x - P.prev.x) * alpha, py = P.prev.y + (P.pos.y - P.prev.y) * alpha, pz = P.prev.z + (P.pos.z - P.prev.z) * alpha;
  if (frameDt) { var tk = (I.ads && !P.dead) ? 1 : 0; Cam.adsK += (tk - Cam.adsK) * Math.min(1, frameDt * 12); }
  var k = Cam.adsK, pitch = P.pitch + P.kick, cp = Math.cos(pitch), sp = Math.sin(pitch), sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
  var fx = sy * cp, fy = sp, fz = cy * cp, rx = -cy, rz = sy;
  var want = 4.7 - 2.5 * k, sh = 0.95 - 0.3 * k;
  var vx = px + rx * sh, vy = py + 1.58, vz = pz + rz * sh;                    // pivot
  var ox = -fx * want, oy = -fy * want + 0.28, oz = -fz * want, len = Math.sqrt(ox * ox + oy * oy + oz * oz);
  ox /= len; oy /= len; oz /= len;
  var t = W.raycast(vx, vy, vz, ox, oy, oz, len + 0.35); if (t < len + 0.35) len = Math.max(0.45, t - 0.35);
  Cam.x = vx + ox * len; Cam.y = Math.max(0.25, vy + oy * len); Cam.z = vz + oz * len;
  Cam.fx = fx; Cam.fy = fy; Cam.fz = fz; Cam.rx = rx; Cam.rz = rz;
  Cam.ux = -rz * fy; Cam.uy = rz * fx - rx * fz; Cam.uz = rx * fy;
  Cam.dist = len; Cam.fov = 65 - 25 * k;
};
Cam.apply = function (camera) {
  var s = FX.shake * 0.35;
  camera.position.set(Cam.x + (Math.random() - 0.5) * s, Cam.y + (Math.random() - 0.5) * s, Cam.z + (Math.random() - 0.5) * s);
  camera.lookAt(Cam.x + Cam.fx * 20, Cam.y + Cam.fy * 20, Cam.z + Cam.fz * 20);
  if (Math.abs(camera.fov - Cam.fov) > 0.05) { camera.fov = Cam.fov; camera.updateProjectionMatrix(); }
};

/* ============================================================
   WEAPONS
   ============================================================ */
var Wp = JO.Weapons = { slots: [], cur: 0, cd: 0, reloading: 0, bloom: 0, swapT: 0 };
var HIT = { t: 0, enemy: null, part: null, missile: null };
var accE = [], accD = [], accX = [], accY = [], accZ = [], accF = [];

Wp.magSize = function (i) { return Math.round(CFG.WEAPONS[i].mag * (1 + 0.3 * P.up.mag)); };
Wp.resetRun = function () {
  Wp.slots = CFG.WEAPONS.map(function (c, i) { return { cfg: c, mag: c.mag, reserve: c.reserve, unlocked: false, idx: i }; });
  Wp.cur = 0; Wp.cd = 0; Wp.reloading = 0; Wp.bloom = 0;
};
Wp.unlockFor = function (levelIdx) {
  var newly = null;
  Wp.slots.forEach(function (s) { if (!s.unlocked && s.cfg.unlockLevel <= levelIdx) { s.unlocked = true; s.mag = Wp.magSize(s.idx); s.reserve = s.cfg.reserve; if (s.cfg.unlockLevel === levelIdx && levelIdx > 0) newly = s; } });
  return newly;
};
Wp.refill = function (reserveToo) { Wp.slots.forEach(function (s) { s.mag = Wp.magSize(s.idx); if (reserveToo) s.reserve = Math.max(s.reserve, s.cfg.reserve); }); };
Wp.snapshot = function () { return { cur: Wp.cur, s: Wp.slots.map(function (s) { return [s.mag, s.reserve]; }) }; };
Wp.restore = function (snap) {
  Wp.cur = snap.cur; Wp.cd = 0; Wp.reloading = 0; Wp.bloom = 0;
  Wp.slots.forEach(function (s, i) { s.mag = Wp.magSize(i); s.reserve = Math.max(snap.s[i][1], Math.round(s.cfg.reserve * 0.6)); });
};
Wp.addAmmo = function () {
  var got = false;
  Wp.slots.forEach(function (s) { if (!s.unlocked || s.reserve >= s.cfg.maxReserve) return; s.reserve = Math.min(s.cfg.maxReserve, s.reserve + s.cfg.pickup); got = true; });
  return got;
};
Wp.current = function () { return Wp.slots[Wp.cur]; };
function startReload() {
  var s = Wp.slots[Wp.cur]; if (Wp.reloading > 0 || s.mag >= Wp.magSize(Wp.cur) || s.reserve <= 0) return;
  Wp.reloadTotal = Wp.reloading = s.cfg.reload * (1 - Math.min(0.6, 0.25 * P.up.reload)); A.play('reload');
}
Wp.reloadTotal = 1;
function trySwitch(n) {
  if (n === -1) { for (var k = 1; k <= 3; k++) { var j = (Wp.cur + k) % 3; if (Wp.slots[j].unlocked) { n = j + 1; break; } } }
  var i = n - 1; if (i < 0 || i > 2 || i === Wp.cur || !Wp.slots[i].unlocked) return;
  Wp.cur = i; Wp.reloading = 0; Wp.cd = Math.max(Wp.cd, 0.28); Wp.bloom = 0; A.play('swap');
}
Wp.switchTo = trySwitch;

Wp.update = function (dt) {
  if (P.dead) return;
  if (I.weapon) trySwitch(I.weapon);
  var s = Wp.slots[Wp.cur];
  if (Wp.cd > 0) Wp.cd -= dt;
  if (Wp.bloom > 0) Wp.bloom = Math.max(0, Wp.bloom - dt * 5);
  if (P.kick > 0) P.kick = Math.max(0, P.kick - dt * (0.12 + P.kick * 7));
  if (Wp.reloading > 0) { Wp.reloading -= dt;
    if (Wp.reloading <= 0) { var need = Wp.magSize(Wp.cur) - s.mag, take = Math.min(need, s.reserve); s.mag += take; s.reserve -= take; A.play('reloadEnd'); } }
  if (I.reloadPressed) startReload();
  if (I.fire && Wp.cd <= 0 && Wp.reloading <= 0 && P.rolling <= 0) {
    if (s.mag > 0) shoot(s);
    else { if (s.reserve > 0) startReload(); else { A.play('empty'); Wp.cd = 0.3;
      if (Wp.cur !== 0 && (Wp.slots[0].mag > 0 || Wp.slots[0].reserve > 0)) trySwitch(1); } }
  }
};

function shoot(s) {
  var c = s.cfg, Gm = JO.Game, E = JO.Enemies;
  s.mag--; Wp.cd = c.interval / (1 + 0.2 * P.up.fire); Gm.stats.shots++;
  A.play(c.id);
  var sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
  var mx = P.pos.x - cy * 0.28 + sy * 0.95, my = P.pos.y + 1.33 + Cam.fy * 0.6, mz = P.pos.z + sy * 0.28 + cy * 0.95;
  FX.muzzleFlash(mx, my, mz, c.id === 'sg' ? 0.85 : (c.id === 'mr' ? 0.7 : 0.5));
  var spread = (I.ads ? c.adsSpread : c.spread) + Wp.bloom + (P.onGround ? 0 : 1.5);
  var anyHit = false, head = false, killed = false, crit = false, n = 0, start = Cam.dist + 0.2;
  for (var p = 0; p < c.pellets; p++) {
    var a = Math.tan(spread * DEG * Math.sqrt(Math.random())), ph = Math.random() * 6.283, tx = a * Math.cos(ph), ty = a * Math.sin(ph);
    var dx = Cam.fx + Cam.rx * tx + Cam.ux * ty, dy = Cam.fy + Cam.uy * ty, dz = Cam.fz + Cam.rz * tx + Cam.uz * ty;
    var l = Math.sqrt(dx * dx + dy * dy + dz * dz); dx /= l; dy /= l; dz /= l;
    var ox = Cam.x + dx * start, oy = Cam.y + dy * start, oz = Cam.z + dz * start;
    E.hitscan(ox, oy, oz, dx, dy, dz, c.range, HIT);
    var ex = ox + dx * HIT.t, ey = oy + dy * HIT.t, ez = oz + dz * HIT.t;
    FX.tracer(mx, my, mz, ex, ey, ez, c.id === 'mr' ? 0xffffff : 0xffe9a0, c.id === 'mr' ? 0.06 : 0.035, c.id === 'mr' ? 0.16 : 0.08);
    if (HIT.enemy) {
      var dmg = c.dmg;
      if (c.falloff) { var d = HIT.t; if (d > c.falloff[0]) dmg *= Math.max(c.falloff[2], 1 - (d - c.falloff[0]) / (c.falloff[1] - c.falloff[0]) * (1 - c.falloff[2])); }
      var r = HIT.enemy.takeHit(dmg, HIT.part, dx, dz, ey, c.headMult);
      if (r.blocked) { FX.burst(ex, ey, ez, 4, 0xfff0a0, 5, 0.18, 6, 0.09); if (!r.silent) { A.playAt('clang', ex, ez); add(HIT.enemy, 0, ex, ey, ez, 3); } }
      else if (r.dealt > 0) { anyHit = true; if (r.head) head = true; if (r.crit) crit = true; if (r.killed) killed = true;
        FX.burst(ex, ey, ez, 5, HIT.enemy.spark || 0xff5030, 3.5, 0.3, 9, 0.11); add(HIT.enemy, r.dealt, ex, ey, ez, r.head ? 1 : (r.crit ? 2 : 0)); }
    } else if (HIT.missile) { anyHit = true; JO.Haz.shootMissile(HIT.missile); }
    else if (HIT.t < c.range) FX.burst(ex, ey, ez, 3, 0xc8b890, 2.5, 0.28, 8, 0.1);
  }
  function add(e, d, x, y, z, f) { for (var q = 0; q < n; q++) if (accE[q] === e && (accF[q] === 3) === (f === 3)) { accD[q] += d; if (f && f !== 3) accF[q] = f; return; }
    accE[n] = e; accD[n] = d; accX[n] = x; accY[n] = y; accZ[n] = z; accF[n] = f; n++; }
  for (var q = 0; q < n; q++) { var f = accF[q];
    if (f === 3) JO.UI.dmgNum(accX[q], accY[q] + 0.3, accZ[q], 'BLOCKED', 'blk');
    else JO.UI.dmgNum(accX[q], accY[q] + 0.3, accZ[q], '' + Math.max(1, Math.round(accD[q])), f === 1 ? 'head' : (f === 2 ? 'crit' : '')); accE[q] = null; }
  if (anyHit) { Gm.stats.hits++; JO.UI.hitmarker(killed ? 'kill' : (head ? 'head' : '')); A.play(head ? 'head' : 'hit'); if (killed) A.play('kill'); }
  P.kick = Math.min(0.09, P.kick + c.recoil); Wp.bloom = Math.min(2.4, Wp.bloom + c.bloom);
  if (s.mag === 0 && s.reserve > 0) startReload();
}
})();
