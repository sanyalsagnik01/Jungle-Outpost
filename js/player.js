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
  crouch: false, driving: false,
  up: { hp: 0, fire: 0, reload: 0, plate: 0, mag: 0, stam: 0 }, stepDist: 0, walkPhase: 0, inWater: false, nearCrate: null, model: null
};

P.init = function (scene) { P.model = M.player(); scene.add(P.model.g); };

/* ---------- GLB presentation (optional; the primitive model above stays as the fallback) ---------- */
P.gfx = null; P.wpn = []; P.wpnCur = -1; P.deadT = 0;
var WPN_MODELS = ['ar', 'shotgun', 'marksman', 'crossbow', 'flamethrower'], tmpV = new THREE.Vector3();
P.attachModels = function () {
  var As = JO.Assets, g = P.model.g, k = As.instantiate('kade'), i;
  if (!k) return false;
  for (i = 0; i < g.children.length; i++) g.children[i].visible = false;          // hide the box commando, keep its group as the anchor
  g.add(k.root); P.gfx = k; P.chest = k.socket('chest'); P.handR = k.socket('socket_hand.R');
  for (i = 0; i < WPN_MODELS.length; i++) {
    var w = As.instantiate(WPN_MODELS[i]);
    if (!w) {                                                                      // that weapon's GLB is missing: hand him a plain box gun
      var gun = new THREE.Mesh(JO.World.G.box, P.model.mats.dark); gun.scale.set(0.07, 0.11, 0.8); gun.position.set(0, 0.03, 0.22); gun.castShadow = true;
      w = { name: WPN_MODELS[i] + ' (primitive)', tris: 12, root: new THREE.Group(), socket: function () { return null; } }; w.root.add(gun);
    }
    w.root.visible = false; g.add(w.root); w.muzzle = w.socket('muzzle'); P.wpn[i] = w;
  }
  P.wpnCur = -1; return true;
};
// per rendered frame: pick the locomotion clip, advance the mixer, aim the torso and seat the weapon in the hand
P.animate = function (dt) {
  var k = P.gfx, i; if (!k) return;
  var aim = P.pitch + P.kick;
  if (P.dead) { P.deadT += dt; k.setDissolve((P.deadT - 0.95) / 0.5); }
  else {
    var sp = Math.hypot(P.vx, P.vz), moving = sp > 0.4 && P.onGround && P.rolling <= 0;
    if (!moving) k.play('idle', 1);
    else if (I.ads || sp < 4.2) k.play('walk', Math.min(1.7, Math.max(0.7, sp / 1.9)));
    else k.play('run', Math.min(1.6, sp / 4.2));
  }
  k.update(dt);
  if (P.chest && !P.dead) P.chest.rotateX(-aim * 0.55);
  var cur = P.dead ? -1 : JO.Weapons.cur, w = P.wpn[cur];
  if (cur !== P.wpnCur) { for (i = 0; i < P.wpn.length; i++) if (P.wpn[i]) P.wpn[i].root.visible = i === cur; P.wpnCur = cur; }
  if (w && P.handR) { P.model.g.updateMatrixWorld(true); P.handR.getWorldPosition(tmpV); P.model.g.worldToLocal(tmpV); w.root.position.copy(tmpV); w.root.rotation.set(-aim, 0, 0); }
};
P.muzzle = function (out) {
  var w = P.wpn[P.wpnCur]; if (!w || !w.muzzle || P.rolling > 0) return false;
  w.muzzle.getWorldPosition(out); return true;
};
P.resetRun = function () {
  P.up = { hp: 0, fire: 0, reload: 0, plate: 0, mag: 0, stam: 0 }; P.maxHp = PC.hp; P.maxPlates = 1; P.hp = P.maxHp; P.armor = 0;
};
P.place = function (x, z) {
  P.pos.set(x, 0, z); P.prev.copy(P.pos); P.vx = P.vy = P.vz = P.kx = P.kz = 0; P.yaw = Math.PI; P.pitch = -0.05; P.kick = 0;
  P.rolling = 0; P.rollCd = 0; P.invuln = 0; P.dead = false; P.onGround = true; P.crouch = false; P.driving = false; P.stamina = PC.stamina; P.sinceDmg = 99;
  P.model.g.visible = true; P.model.g.rotation.set(0, P.yaw, 0); P.model.g.position.copy(P.pos);
  P.deadT = 0; if (P.gfx) { P.gfx.reset(); P.gfx.play('idle', 1); P.wpnCur = -2; }
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
  var st = JO.Meta.set, s = 0.0023 * (I.ads ? 0.55 : 1) * st.sens;
  P.yaw -= dx * s; P.pitch -= dy * s * (st.invertY ? -1 : 1);
  if (P.pitch > 1.2) P.pitch = 1.2; else if (P.pitch < -1.2) P.pitch = -1.2;
};

// returns true when damage was actually applied (false = dodged)
P.damage = function (amt, sx, sz, tag) {
  var Gm = JO.Game;
  if (P.invuln > 0 && P.rolling > 0 && !P.dead) JO.Events.emit('dodge');
  if (P.dead || P.invuln > 0 || Gm.state !== 'playing' || Gm.bossDying) return false;
  amt *= Gm.diffCfg.dmg * JO.Perks.taken(); Gm.stats.dmgTaken += amt;
  if (Gm.debug.dmgBy) Gm.debug.dmgBy[tag || 'other'] = (Gm.debug.dmgBy[tag || 'other'] || 0) + Math.round(amt);
  if (Gm.debug.god) return true;
  if (P.driving) amt = JO.Props.absorb(amt);
  if (P.armor > 0) { var a = Math.min(P.armor, amt); P.armor -= a; amt -= a; A.play('armor'); }
  if (amt > 0) { P.hp -= amt; A.play('hurt'); }
  if (P.hp <= 0 && JO.Perks.has('v4') && !JO.Perks.lastStand) { JO.Perks.lastStand = true; P.hp = 1; P.invuln = 2; JO.UI.banner('LAST STAND', 1.6, true); }
  P.sinceDmg = 0; JO.UI.hurt(sx, sz); FX.addShake(Math.min(0.5, 0.12 + amt * 0.015));
  if (P.gfx) { P.gfx.flash(0x992a1a, 0.1); if (JO.Weapons.reloading <= 0) P.gfx.playOnce('hit'); }
  JO.Events.emit('player_hurt', amt, tag);
  if (P.hp <= 0) { P.hp = 0; P.dead = true; P.rolling = 0; P.deadT = 0; A.play('die'); if (P.gfx) P.gfx.playOnce('death', { full: true, hold: true }); Gm.onPlayerDead(); }
  return true;
};
P.knock = function (x, z) { P.kx += x; P.kz += z; };

P.update = function (dt) {
  P.prev.copy(P.pos);
  if (P.dead) { if (!P.gfx) P.model.g.rotation.x = Math.max(-1.5, P.model.g.rotation.x - dt * 4); else { P.model.g.rotation.x = 0; P.model.g.scale.setScalar(1); } return; }
  if (P.driving) {                                              // the jeep moves us; props.js owns the wheel
    JO.Props.drive(dt); if (P.invuln > 0) P.invuln -= dt; P.sinceDmg += dt;
    if (P.sinceDmg > PC.regenDelay && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + PC.regenRate * dt);
    if (P.stamina < PC.stamina) P.stamina = Math.min(PC.stamina, P.stamina + PC.staminaRegen * dt);
    P.nearCrate = null; P.model.g.position.copy(P.pos); P.model.g.rotation.y = P.yaw; return; }
  if (I.crouchPressed) { P.crouch = !P.crouch; A.play('swap', 0.6); }
  var mx = I.moveX, my = I.moveY, len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; len = 1; }
  var sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
  var wx = sy * my - cy * mx, wz = cy * my + sy * mx;           // forward (sy,cy), right (-cy,sy)
  if (P.rollCd > 0) P.rollCd -= dt;
  if (P.invuln > 0) P.invuln -= dt;
  P.inWater = W.inWater(P.pos.x, P.pos.z) && P.pos.y < 0.3;

  var sprinting = false, speed;
  if (I.rollPressed && P.rollCd <= 0 && P.rolling <= 0 && P.onGround && P.stamina >= PC.rollCost) {
    P.rolling = PC.rollTime; P.crouch = false; P.invuln = PC.rollInvuln; P.rollCd = PC.rollCd; P.stamina -= PC.rollCost; P.stamDelay = PC.staminaDelay;
    if (len > 0.15) { var l = Math.hypot(wx, wz); P.rollX = wx / l; P.rollZ = wz / l; } else { P.rollX = sy; P.rollZ = cy; }
    A.play('roll');
  }
  if (P.rolling > 0) {
    P.rolling -= dt; speed = PC.rollSpeed * (P.rolling > 0.12 ? 1 : 0.55); P.vx = P.rollX * speed; P.vz = P.rollZ * speed;
  } else {
    sprinting = I.sprint && my > 0.2 && P.stamina > 1 && !I.ads; if (sprinting || !P.onGround) P.crouch = false;
    speed = P.crouch ? PC.crouch : (I.ads ? PC.adsMove : (sprinting ? PC.sprint : PC.walk));
    if (P.inWater) speed *= 0.6;
    P.vx = wx * speed; P.vz = wz * speed;
    if (I.jumpPressed && P.onGround) { P.vy = PC.jump; P.onGround = false; P.crouch = false; A.play('jump'); }
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
    if (P.stepDist > (sprinting ? 2.6 : 2.1)) { P.stepDist = 0; JO.Audio.footstep(P, sprinting);
      JO.Events.emit('noise', P.pos.x, P.pos.z, (P.crouch ? 2 : (sprinting ? 14 : 7.5)) * (P.inWater ? 1.4 : 1) * (JO.Perks.has('s1') ? 0.65 : 1), 'step');
      if (P.inWater) FX.burst(P.pos.x, 0.15, P.pos.z, 4, 0xcfeeee, 2, 0.35, 8, 0.1, 1.5); } }

  P.sinceDmg += dt;
  var fd = JO.Perks.has('v2');
  if (P.sinceDmg > PC.regenDelay - (fd ? 2 : 0) && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + PC.regenRate * (fd ? 1.5 : 1) * dt);

  // supply crates
  P.nearCrate = null;
  for (var i = 0; i < W.crates.length; i++) { var c = W.crates[i]; if (c.opened) continue;
    var dx = c.x - P.pos.x, dz = c.z - P.pos.z; if (dx * dx + dz * dz < 6.2) { P.nearCrate = c; break; } }
  if (P.nearCrate && (I.interactPressed || (I.isTouch && false))) { JO.Game.openCrate(P.nearCrate); P.nearCrate = null; }

  // model pose
  var m = P.model, g = m.g;
  g.position.copy(P.pos); g.rotation.y = P.yaw;
  if (P.rolling > 0) { var rp = 1 - P.rolling / PC.rollTime; g.rotation.x = rp * Math.PI * 2; g.position.y += 0.55 * Math.sin(rp * Math.PI); g.scale.setScalar(0.82); }
  else { g.rotation.x = 0; g.scale.setScalar(1); if (P.crouch) g.scale.y = 0.72; M.walk(m, P.walkPhase, moved > 0.01 && P.onGround ? 1 : 0, false); }
};

/* ============================================================
   CAMERA (over the shoulder, collision aware)
   ============================================================ */
var Cam = JO.Cam = { x: 0, y: 2, z: 5, fx: 0, fy: 0, fz: -1, rx: 1, rz: 0, ux: 0, uy: 1, uz: 0, dist: 3.8, fov: 65, adsK: 0, eye: 1.58 };
Cam.compute = function (alpha, frameDt) {
  var px = P.prev.x + (P.pos.x - P.prev.x) * alpha, py = P.prev.y + (P.pos.y - P.prev.y) * alpha, pz = P.prev.z + (P.pos.z - P.prev.z) * alpha;
  if (frameDt) { var tk = (I.ads && !P.dead) ? 1 : 0; Cam.adsK += (tk - Cam.adsK) * Math.min(1, frameDt * 12); }
  var k = Cam.adsK, Ph = JO.Phys, pitch = P.pitch + P.kick + (Ph ? Ph.swayY * k : 0), yw = P.yaw + (Ph ? Ph.swayX * k : 0), cp = Math.cos(pitch), sp = Math.sin(pitch), sy = Math.sin(yw), cy = Math.cos(yw);
  var fx = sy * cp, fy = sp, fz = cy * cp, rx = -cy, rz = sy;
  var want = (P.driving ? 7.8 : 4.7) - 2.2 * k, sh = 0.95 + 0.05 * k;
  Cam.eye += ((P.driving ? 2.5 : (P.crouch ? 1.2 : 1.58)) - Cam.eye) * (frameDt ? Math.min(1, frameDt * 10) : 0);
  var vx = px + rx * sh, vy = py + Cam.eye, vz = pz + rz * sh;                    // pivot
  var ox = -fx * want, oy = -fy * want + 0.28, oz = -fz * want, len = Math.sqrt(ox * ox + oy * oy + oz * oz);
  ox /= len; oy /= len; oz /= len;
  var t = W.raycast(vx, vy, vz, ox, oy, oz, len + 0.35); if (t < len + 0.35) len = Math.max(0.45, t - 0.35);
  Cam.x = vx + ox * len; Cam.y = Math.max(0.25, vy + oy * len); Cam.z = vz + oz * len;
  Cam.fx = fx; Cam.fy = fy; Cam.fz = fz; Cam.rx = rx; Cam.rz = rz;
  Cam.ux = -rz * fy; Cam.uy = rz * fx - rx * fz; Cam.uz = rx * fy;
  Cam.dist = len; Cam.fov = 65 - (JO.Weapons.cur === 2 && JO.Perks.mod('mr_scope') ? 40 : 25) * k;
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

Wp.magSize = function (i) { var c = CFG.WEAPONS[i]; return Math.round((c.mag + JO.Perks.magBonus(c.id)) * (c.mag > 1 ? 1 + 0.3 * P.up.mag : 1)); };
Wp.maxReserve = function (s) { return Math.round(s.cfg.maxReserve * JO.Perks.reserve()); };
Wp.resetRun = function () {
  Wp.slots = CFG.WEAPONS.map(function (c, i) { return { cfg: c, mag: c.mag, reserve: c.reserve, unlocked: false, idx: i }; });
  Wp.cur = 0; Wp.cd = 0; Wp.reloading = 0; Wp.bloom = 0;
  if (JO.Arsenal) JO.Arsenal.resetRun();
};
Wp.unlockFor = function (levelIdx) {
  var newly = [];
  Wp.slots.forEach(function (s) { if (!s.unlocked && (s.cfg.unlockLevel <= levelIdx || JO.Game.run.ng || JO.Game.mode)) { s.unlocked = true; s.mag = Wp.magSize(s.idx); s.reserve = s.cfg.reserve; if (s.cfg.unlockLevel === levelIdx && levelIdx > 0) newly.push(s); } });
  return newly.length ? newly : null;
};
Wp.refill = function (reserveToo) { Wp.slots.forEach(function (s) { s.mag = Wp.magSize(s.idx); if (reserveToo) s.reserve = Math.max(s.reserve, s.cfg.reserve); }); };
Wp.snapshot = function () { return { cur: Wp.cur, s: Wp.slots.map(function (s) { return [s.mag, s.reserve]; }) }; };
Wp.restore = function (snap) {
  Wp.cur = snap.cur; Wp.cd = 0; Wp.reloading = 0; Wp.bloom = 0;
  Wp.slots.forEach(function (s, i) { s.mag = Wp.magSize(i); s.reserve = Math.max(snap.s[i] ? snap.s[i][1] : 0, Math.round(s.cfg.reserve * 0.6)); });
};
// exact restore (saved games): keeps the magazines and reserves as they were
Wp.load = function (snap) {
  if (!snap || !snap.s) return; Wp.cd = 0; Wp.reloading = 0; Wp.bloom = 0;
  Wp.slots.forEach(function (s, i) { var v = snap.s[i]; if (!v) return; s.mag = Math.min(Wp.magSize(i), v[0] | 0); s.reserve = Math.min(Wp.maxReserve(s), v[1] | 0); });
  Wp.cur = Wp.slots[snap.cur] && Wp.slots[snap.cur].unlocked ? snap.cur : 0;
};
Wp.addAmmo = function () {
  var got = false;
  Wp.slots.forEach(function (s) { var mx = Wp.maxReserve(s); if (!s.unlocked || s.reserve >= mx) return; s.reserve = Math.min(mx, s.reserve + s.cfg.pickup); got = true; });
  if (JO.Arsenal.give('frag', 1)) got = true;
  return got;
};
Wp.current = function () { return Wp.slots[Wp.cur]; };
function startReload() {
  var s = Wp.slots[Wp.cur]; if (Wp.reloading > 0 || s.mag >= Wp.magSize(Wp.cur) || s.reserve <= 0) return;
  Wp.reloadTotal = Wp.reloading = s.cfg.reload * (1 - Math.min(0.6, 0.25 * P.up.reload)) * JO.Perks.reload(s.cfg.id); A.play('reload');
  if (P.gfx && P.gfx.shots.reload) P.gfx.playOnce('reload', { timeScale: P.gfx.shots.reload.duration / Wp.reloading });
}
Wp.reloadTotal = 1;
function trySwitch(n) {
  var N = Wp.slots.length;
  if (n === -1) { for (var k = 1; k <= N; k++) { var j = (Wp.cur + k) % N; if (Wp.slots[j].unlocked) { n = j + 1; break; } } }
  var i = n - 1; if (i < 0 || i >= N || i === Wp.cur || !Wp.slots[i].unlocked) return;
  if (Wp.reloading > 0 && P.gfx) P.gfx.stopShot();
  Wp.cur = i; Wp.reloading = 0; Wp.cd = Math.max(Wp.cd, 0.28); Wp.bloom = 0; A.play('swap');
}
Wp.switchTo = trySwitch;

Wp.update = function (dt) {
  if (P.dead) return;
  if (I.weapon) trySwitch(I.weapon);
  var s = Wp.slots[Wp.cur];
  if (Wp.cd > 0) Wp.cd -= dt;
  JO.Perks.update(dt);
  if (Wp.bloom > 0) Wp.bloom = Math.max(0, Wp.bloom - dt * 5);
  if (P.kick > 0) P.kick = Math.max(0, P.kick - dt * (0.12 + P.kick * 7));
  if (Wp.reloading > 0) { Wp.reloading -= dt;
    if (Wp.reloading <= 0) { var need = Wp.magSize(Wp.cur) - s.mag, take = Math.min(need, s.reserve); s.mag += take; s.reserve -= take; A.play('reloadEnd'); } }
  if (I.reloadPressed) startReload();
  if (I.fire && Wp.cd <= 0 && Wp.reloading <= 0 && P.rolling <= 0 && !(s.cfg.kind === 'flame' && JO.Phys && JO.Phys.overheated)) {
    if (s.mag > 0) shoot(s);
    else { if (s.reserve > 0) startReload(); else { A.play('empty'); Wp.cd = 0.3;
      if (Wp.cur !== 0 && (Wp.slots[0].mag > 0 || Wp.slots[0].reserve > 0)) trySwitch(1); } }
  }
};

function shoot(s) {
  var c = s.cfg, Gm = JO.Game, E = JO.Enemies;
  var Pk = JO.Perks, flame = c.kind === 'flame', bolt = c.kind === 'bolt';
  s.mag--; Wp.cd = c.interval / ((flame ? 1 : 1 + 0.2 * P.up.fire) * Pk.fire()); if (!flame || s.mag % 5 === 0) Gm.stats.shots++;
  A.play(c.id); JO.Events.emit('noise', P.pos.x, P.pos.z, Pk.noise(c), 'shot');
  var sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
  var mx = P.pos.x - cy * 0.28 + sy * 0.95, my = P.pos.y + 1.33 + Cam.fy * 0.6, mz = P.pos.z + sy * 0.28 + cy * 0.95;
  if (P.muzzle(tmpV)) { mx = tmpV.x; my = tmpV.y; mz = tmpV.z; }
  if (flame) {                                                   // a cone, not a ray: arsenal.js burns whatever stands in it
    if (JO.Arsenal.flame(c, mx, my, mz) && s.mag % 5 === 0) { Gm.stats.hits++; JO.UI.hitmarker(''); }
    if (s.mag === 0 && s.reserve > 0) startReload(); return; }
  if (P.gfx) P.gfx.playOnce('shoot', { timeScale: 1.5 });
  if (!bolt) FX.muzzleFlash(mx, my, mz, c.id === 'sg' ? 0.85 : (c.id === 'mr' ? 0.7 : 0.5));
  var spread = ((I.ads ? c.adsSpread : c.spread) + Wp.bloom + (P.onGround ? 0 : 1.5)) * Pk.spread(c.id);
  var anyHit = false, head = false, killed = false, crit = false, n = 0, start = Cam.dist + 0.2;
  // aim assist (optional): bend the shot toward the nearest target within a few degrees of the crosshair
  var afx = Cam.fx, afy = Cam.fy, afz = Cam.fz;
  if (JO.Meta.set.aimAssist) { var bestDot = Math.cos(I.ads ? 0.05 : 0.075), L = E.list, tgt = null, AX = 0, AY = 0, AZ = 0;
    for (var ai = 0; ai < L.length; ai++) { var ae = L[ai]; if (!ae.alive || !ae.active || (ae.invulnerable && ae.invulnerable())) continue;
      var ax = ae.pos.x - Cam.x, ay = ae.pos.y + (ae.isBoss ? ae.boundY : (ae.type === 'drone' ? 0 : 1.15)) - Cam.y, az = ae.pos.z - Cam.z, al = Math.sqrt(ax * ax + ay * ay + az * az) || 1, ad = (ax * Cam.fx + ay * Cam.fy + az * Cam.fz) / al;
      if (ad > bestDot && al < c.range && W.raycast(Cam.x, Cam.y, Cam.z, ax / al, ay / al, az / al, al) >= al - 0.8) { bestDot = ad; tgt = ae; AX = ax / al; AY = ay / al; AZ = az / al; } }
    if (tgt) { afx = Cam.fx + (AX - Cam.fx) * 0.75; afy = Cam.fy + (AY - Cam.fy) * 0.75; afz = Cam.fz + (AZ - Cam.fz) * 0.75; } }
  for (var p = 0; p < c.pellets; p++) {
    var a = Math.tan(spread * DEG * Math.sqrt(Math.random())), ph = Math.random() * 6.283, tx = a * Math.cos(ph), ty = a * Math.sin(ph);
    var dx = afx + Cam.rx * tx + Cam.ux * ty, dy = afy + Cam.uy * ty, dz = afz + Cam.rz * tx + Cam.uz * ty;
    var l = Math.sqrt(dx * dx + dy * dy + dz * dz); dx /= l; dy /= l; dz /= l;
    var ox = Cam.x + dx * start, oy = Cam.y + dy * start, oz = Cam.z + dz * start;
    E.hitscan(ox, oy, oz, dx, dy, dz, c.range, HIT);
    var ex = ox + dx * HIT.t, ey = oy + dy * HIT.t, ez = oz + dz * HIT.t;
    FX.tracer(mx, my, mz, ex, ey, ez, bolt ? 0x9adfff : (c.id === 'mr' ? 0xffffff : 0xffe9a0), c.id === 'mr' || bolt ? 0.06 : 0.035, bolt ? 0.3 : (c.id === 'mr' ? 0.16 : 0.08));
    JO.Props.shot(ox, oy, oz, dx, dy, dz, HIT.t, c); if (JO.Squad) JO.Squad.shotRay(ox, oy, oz, dx, dy, dz, HIT.t);
    if (bolt && Pk.mod('xb_boom') && HIT.t < c.range) JO.Arsenal.blast(ex, Math.max(0.3, ey), ez, 3, 60, 0.3);
    if (HIT.enemy) {
      var dmg = c.dmg * Pk.damage(c, HIT.enemy);
      if (c.falloff) { var d = HIT.t; if (d > c.falloff[0]) dmg *= Math.max(c.falloff[2], 1 - (d - c.falloff[0]) / (c.falloff[1] - c.falloff[0]) * (1 - c.falloff[2])); }
      var r = HIT.enemy.takeHit(dmg, HIT.part, dx, dz, ey, Pk.headMult(c));
      if (r.blocked) { FX.burst(ex, ey, ez, 4, 0xfff0a0, 5, 0.18, 6, 0.09); if (!r.silent) { A.playAt('clang', ex, ez); add(HIT.enemy, 0, ex, ey, ez, 3); } }
      else if (r.dealt > 0) { anyHit = true; if (r.head) head = true; if (r.crit) crit = true; if (r.killed) killed = true;
        FX.burst(ex, ey, ez, 5, HIT.enemy.spark || 0xff5030, 3.5, 0.3, 9, 0.11); add(HIT.enemy, r.dealt, ex, ey, ez, r.head ? 1 : (r.crit ? 2 : 0)); }
    } else if (HIT.missile) { anyHit = true; JO.Haz.shootMissile(HIT.missile); }
    else if (HIT.t < c.range) { if (JO.Phys) JO.Phys.impact(ex, ey, ez, dx, dy, dz, c); else FX.burst(ex, ey, ez, 3, 0xc8b890, 2.5, 0.28, 8, 0.1); }
  }
  if (JO.Phys) JO.Phys.shot(c, mx, my, mz);
  function add(e, d, x, y, z, f) { for (var q = 0; q < n; q++) if (accE[q] === e && (accF[q] === 3) === (f === 3)) { accD[q] += d; if (f && f !== 3) accF[q] = f; return; }
    accE[n] = e; accD[n] = d; accX[n] = x; accY[n] = y; accZ[n] = z; accF[n] = f; n++; }
  for (var q = 0; q < n; q++) { var f = accF[q];
    if (f === 3) JO.UI.dmgNum(accX[q], accY[q] + 0.3, accZ[q], 'BLOCKED', 'blk');
    else JO.UI.dmgNum(accX[q], accY[q] + 0.3, accZ[q], '' + Math.max(1, Math.round(accD[q])), f === 1 ? 'head' : (f === 2 ? 'crit' : '')); accE[q] = null; }
  if (anyHit) { Gm.stats.hits++; JO.UI.hitmarker(killed ? 'kill' : (head ? 'head' : '')); A.play(head ? 'head' : 'hit'); if (killed) { A.play('kill'); JO.Events.emit('player_kill', head); } }
  P.kick = Math.min(0.09, P.kick + c.recoil * Pk.recoil(c.id)); Wp.bloom = Math.min(2.4, Wp.bloom + c.bloom * Pk.recoil(c.id));
  if (s.mag === 0 && s.reserve > 0) startReload();
}
})();
