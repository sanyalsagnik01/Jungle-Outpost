/* ============================================================
   JUNGLE OUTPOST — enemies.js
   Six enemy types, each a small state machine
   (patrol -> alert -> attack <-> retreat -> dead) with its own
   movement and attack pattern. Enemies are pooled per type.
   Also owns the shared ray-vs-hitbox test used by weapons.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, CFG = JO.CFG, W = JO.World, FX = JO.FX, A = JO.Audio, M = JO.Models, H = JO.Haz, G = W.G;
var E = JO.Enemies = { list: [], pools: {}, scene: null, baseEmis: 0, sightK: 1 };   // baseEmis: faint self-light so enemies read at night
var DEG = Math.PI / 180, R = { dealt: 0, blocked: false, head: false, crit: false, killed: false, silent: false };
E.R = R;

// hitboxes: 'c' = vertical cylinder, 's' = sphere (local offsets rotate with yaw)
var HUMAN = [{ k: 'c', y0: 0, y1: 1.5, r: 0.44, tag: 'body' }, { k: 's', oy: 1.7, r: 0.29, tag: 'head' }];
var DRONE = [{ k: 's', oy: 0, r: 0.7, tag: 'body' }];

/* ---------- helpers ---------- */
function wrap(a) { while (a > Math.PI) a -= 6.283185307; while (a < -Math.PI) a += 6.283185307; return a; }
function turnToward(a, b, max) { var d = wrap(b - a); if (d > max) d = max; else if (d < -max) d = -max; return a + d; }
E.turnToward = turnToward; E.wrap = wrap;
function facePlayer(e, dt, rate) { e.yaw = turnToward(e.yaw, Math.atan2(e.ndx, e.ndz), rate * dt); }
function los(e) {
  var P = JO.Player, ox = e.pos.x, oy = e.pos.y + e.eye, oz = e.pos.z, dx = P.pos.x - ox, dy = P.pos.y + 1.1 - oy, dz = P.pos.z - oz;
  var d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1; if (JO.Arsenal.blocked(ox, oz, P.pos.x, P.pos.z)) return false;
  return W.raycast(ox, oy, oz, dx / d, dy / d, dz / d, d) >= d - 0.02;
}
E.los = los;
// steering move with stuck detection (side-steps around whatever blocks the way)
function moveToward(e, tx, tz, speed, dt) {
  var dx = tx - e.pos.x, dz = tz - e.pos.z, d = Math.hypot(dx, dz); if (d < 0.05) return d;
  dx /= d; dz /= d;
  if (e.avoidT > 0) { var s = e.avoidSide * 1.15, c = Math.cos(s), sn = Math.sin(s), nx = dx * c - dz * sn; dz = dx * sn + dz * c; dx = nx; e.avoidT -= dt; }
  var px = e.pos.x, pz = e.pos.z, st = Math.min(d, speed * dt);
  e.pos.x += dx * st; e.pos.z += dz * st;
  W.moveCircle(e.pos, e.radius, e.pos.y, false); W.clamp(e.pos, e.radius);
  var moved = Math.hypot(e.pos.x - px, e.pos.z - pz);
  if (moved < st * 0.4) { e.stuckT += dt; if (e.stuckT > 0.22) { e.avoidT = 0.55; e.avoidSide = Math.random() < 0.5 ? -1 : 1; e.stuckT = 0; } } else e.stuckT = 0;
  e.walk += moved * 2.4; e.moving = true; return d;
}
E.moveToward = moveToward;
// visible, dodgeable projectile with deliberate inaccuracy that grows with range
function fireBullet(e, spreadDeg, speed, dmg, hex, height) {
  var P = JO.Player, mx = e.pos.x + e.ndx * 0.7, my = e.pos.y + (height === undefined ? 1.35 : height), mz = e.pos.z + e.ndz * 0.7;
  var T = e.dist / speed * 0.65, tx = P.pos.x + P.vx * T - mx, ty = P.pos.y + 1.0 - my, tz = P.pos.z + P.vz * T - mz;
  var l = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1; tx /= l; ty /= l; tz /= l;
  var sp = spreadDeg * DEG * (1 + e.dist / 40) / JO.Game.diffCfg.acc, ya = (Math.random() - Math.random()) * sp, c = Math.cos(ya), s = Math.sin(ya);
  var nx = tx * c - tz * s, nz = tx * s + tz * c; ty += (Math.random() - Math.random()) * sp * 0.6;
  l = Math.sqrt(nx * nx + ty * ty + nz * nz); FX.bullet(mx, my, mz, nx / l, ty / l, nz / l, speed, dmg, hex);
  FX.burst(mx, my, mz, 2, 0xffd060, 2.5, 0.08, 0, 0.12);
  if (e.gfx && !e.isBoss) e.gfx.playOnce('shoot');
}
E.fireBullet = fireBullet;
function clampTarget(e) { var hw = W.halfWidth(e.tz) - 1; if (e.tx > hw) e.tx = hw; else if (e.tx < -hw) e.tx = -hw; }
function pickCover(e, retreat, advance) {
  var P = JO.Player, best = null, bs = 1e9, cv = W.cover, inArena = e.pos.z < W.A0;
  for (var i = 0; i < cv.length; i++) { var c = cv[i]; if ((c.z < W.A0) !== inArena) continue;
    var de = Math.hypot(c.x - e.pos.x, c.z - e.pos.z); if (de > 20) continue;
    var dp = Math.hypot(c.x - P.pos.x, c.z - P.pos.z); if (dp < 8 || dp > 34) continue;
    if (retreat && dp < e.dist + 4) continue; if (advance && dp > e.dist) continue;
    var s = de + Math.random() * 8; if (s < bs) { bs = s; best = c; } }
  if (best) { var ax = best.x - P.pos.x, az = best.z - P.pos.z, l = Math.hypot(ax, az) || 1; e.tx = best.x + ax / l * (best.r + 0.9); e.tz = best.z + az / l * (best.r + 0.9); }
  else { var D = retreat ? e.dist + 9 : Math.max(11, Math.min(22, e.dist - 3)), lat = (Math.random() - 0.5) * 10;
    e.tx = P.pos.x - e.ndx * D - e.ndz * lat; e.tz = P.pos.z - e.ndz * D + e.ndx * lat;
    if (inArena) e.tz = Math.max(W.A1 + 2, Math.min(W.A0 - 2, e.tz)); else e.tz = Math.max(W.A0 + 2, Math.min(W.zMax - 2, e.tz)); }
  clampTarget(e);
}

/* ============================================================
   ENEMY
   ============================================================ */
function Enemy(type) {
  this.type = type; this.cfg = CFG.ENEMY[type]; this.pos = new THREE.Vector3(); this.isBoss = false;
  this.model = M[type](); this.mesh = this.model.g; this.mats = this.model.matList;
  this.parts = type === 'drone' ? DRONE : HUMAN; this.eye = type === 'drone' ? 0 : 1.55; this.radius = 0.45; this.bound = 2.4; this.boundY = type === 'drone' ? 0 : 1;
  this.active = false; this.alive = false; this.emis = 0;
  E.scene.add(this.mesh); this.mesh.visible = false;
  if (type === 'sniper') {
    this.laserMat = new THREE.MeshBasicMaterial({ color: E.laserHex || 0xff1808, transparent: true, opacity: 0.8, fog: false, depthWrite: false, blending: THREE.AdditiveBlending });
    this.laser = new THREE.Mesh(G.box, this.laserMat); this.dot = new THREE.Mesh(G.ico0, new THREE.MeshBasicMaterial({ color: E.laserHex || 0xff2a10, fog: false }));
    this.laser.visible = this.dot.visible = false; this.laser.frustumCulled = false; E.scene.add(this.laser); E.scene.add(this.dot);
  }
  // GLB presentation (optional): the primitive group stays as the anchor and as the fallback
  this.gfx = JO.Assets.instantiate(type); this.gun = null; this.hand = null;
  if (this.gfx) {
    for (var i = 0; i < this.mesh.children.length; i++) this.mesh.children[i].visible = false;
    this.mesh.add(this.gfx.root); this.hand = this.gfx.socket('socket_hand.R');
    if (GUNS[type]) { this.gun = JO.Assets.instantiate(GUNS[type]); if (this.gun) this.mesh.add(this.gun.root); }
  }
}
var GUNS = { rifleman: 'ar', sniper: 'marksman' }, TV = new THREE.Vector3();
// state machine -> animation clips (see models/README.md)
function animate(e, dt) {
  var k = e.gfx, t = e.type, sp = Math.hypot(e.pos.x - e._ax, e.pos.z - e._az) / dt; e._ax = e.pos.x; e._az = e.pos.z; e.spd += (sp - e.spd) * Math.min(1, dt * 10);
  if (t === 'drone') k.play(e.sub === 'dive' || e.sub === 'diveTel' ? 'dive' : 'hover', 1);
  else if (e.spd < 0.35) k.play('idle', 1);
  else if (e.spd < 3 || t === 'shield' || t === 'grenadier') k.play('walk', Math.max(0.6, Math.min(1.7, e.spd / 1.9)));
  else k.play('run', Math.max(0.7, Math.min(1.6, e.spd / 4.6)));
  if (e.sub !== e._sub) { if (e.sub === 'windup' || e.sub === 'throw') k.playOnce('attack'); e._sub = e.sub; }
  k.tint = e.tint || E.baseEmis; k.update(dt);
  if (e.gun && e.hand) { e.mesh.updateMatrixWorld(true); e.hand.getWorldPosition(TV); e.mesh.worldToLocal(TV); e.gun.root.position.copy(TV);
    e.gun.root.rotation.x = e.state === 'patrol' ? 0 : -Math.atan2(JO.Player.pos.y - e.pos.y - 0.3, Math.max(2, e.dist)); }
}
var EP = Enemy.prototype;
EP.spawn = function (x, z, o) {
  o = o || {}; var d = JO.Game.diffCfg;
  this.pos.set(x, o.y || 0, z); this.homeX = x; this.homeZ = z; this.hp = this.maxHp = this.cfg.hp * d.hp;
  this.alive = true; this.active = true; this.state = 'patrol'; this.sub = ''; this.t = Math.random() * 10; this.stateT = 0; this.yaw = (Math.random() - 0.5) * 1.2;
  this.cd = 0.6 + Math.random() * 1.2; this.burst = 0; this.shotT = 0; this.alerted = !!o.alert; this.see = false; this.losT = Math.random() * 0.3; this.seenT = 9;
  this.dist = 99; this.ndx = 0; this.ndz = 1; this.walk = 0; this.moving = false; this.avoidT = 0; this.avoidSide = 1; this.stuckT = 0; this.flash = 0; this.tint = 0;
  this.retreated = false; this.noSeeT = 0; this.deadT = 0; this.vy = 0; this.patDir = Math.random() < 0.5 ? -1 : 1; this.shieldOpen = false;
  this.ang = Math.random() * 6.28; this.ph = Math.random() * 6.28; this.orbitDir = Math.random() < 0.5 ? -1 : 1; this.atk = 0; this.hitDone = false; this.blindT = 0;
  this.alt = o.alt || null; this.perchY = o.y || 0; this.tx = x; this.tz = z; this.summoned = !!o.summoned; this.burnT = 0; this.burnTick = 0; this.aware = 0; this.shoutT = 0; this.ramT = 0; this.spikeT = 0;
  if (this.type === 'drone') this.pos.y = 4;
  for (var i = 0; i < this.mats.length; i++) { var m = this.mats[i]; m.transparent = false; m.opacity = 1; m.emissive.setHex(0); m.needsUpdate = true; }
  this.emis = 0; this.mesh.visible = true; this.mesh.rotation.set(0, this.yaw, 0); this.mesh.position.copy(this.pos); this.mesh.scale.setScalar(1);
  this._sub = ''; this._deathAnim = false; this.spd = 0; this._ax = x; this._az = z;
  if (this.gfx) { this.gfx.reset(); this.gfx.play(this.type === 'drone' ? 'hover' : 'idle', 1); if (this.gun) this.gun.root.visible = true; }
  return this;
};
EP.setAlert = function () {
  if (this.state !== 'patrol') return;
  this.state = 'alert'; this.stateT = 0.35 + Math.random() * 0.3; this.alerted = true;
  A.playAt('alert', this.pos.x, this.pos.z); JO.Stealth.onAlert(this); JO.Events.emit('enemy_alert', this);
};
EP.takeHit = function (dmg, part, dx, dz, hy, headMult) {
  R.dealt = 0; R.blocked = false; R.head = false; R.crit = false; R.killed = false; R.silent = false;
  if (!this.alive) return R;
  if (this.type === 'shield' && !this.shieldOpen && hy > this.pos.y + 0.6) {
    if (dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw) < -0.3) { R.blocked = true; this.alerted = true; return R; } }
  if (part.tag === 'head') { dmg *= headMult; R.head = true; }
  this.hp -= dmg; R.dealt = dmg; this.flash = 0.09; this.alerted = true;
  if (this.gfx) { this.gfx.flash(0x8a8a8a, 0.09); if (this.hp > 0 && this.sub !== 'windup' && this.sub !== 'throw') this.gfx.playOnce('hit'); }
  if (this.hp <= 0) { this.die(); R.killed = true; }
  else {
    JO.Events.emit('enemy_hurt', this);
    if (this.state === 'patrol') this.setAlert();
    if (this.type === 'sniper' && this.alt && this.state !== 'retreat') {            // relocate along the zip-line
      this.state = 'retreat'; this.stateT = 0; this.fromX = this.pos.x; this.fromZ = this.pos.z; this.toX = this.alt[0]; this.toZ = this.alt[1];
      this.alt = [this.fromX, this.fromZ]; this.hideLaser(); }
  }
  return R;
};
EP.hideLaser = function () { if (this.laser) this.laser.visible = this.dot.visible = false; };
EP.die = function () {
  this.alive = false; this.state = 'dead'; this.deadT = 0; this.vy = 2; this.hideLaser();
  for (var i = 0; i < this.mats.length; i++) { this.mats[i].transparent = true; this.mats[i].needsUpdate = true; }
  JO.Game.onKill(this); JO.Events.emit('enemy_die', this);
};
EP.deadUpdate = function (dt) {
  this.deadT += dt;
  if (this.type === 'drone') {                                  // falls, then explodes
    this.vy -= 20 * dt; this.pos.y += this.vy * dt; this.mesh.rotation.x += dt * 7; this.mesh.rotation.z += dt * 5;
    if (Math.random() < 0.5) FX.puff(this.pos.x, this.pos.y, this.pos.z, 0x444444, 0.28);
    this.mesh.position.copy(this.pos); if (this.gfx) this.gfx.update(dt);
    if (this.pos.y <= 0.3) { H.explode(this.pos.x, 0.4, this.pos.z, 2.6, 8); E.release(this); }
    return;
  }
  if (this.pos.y > 0) this.pos.y = Math.max(0, this.pos.y - dt * 10);
  if (this.gfx) {                                                  // death clip, then dissolve
    if (!this._deathAnim) { this._deathAnim = true; this.gfx.playOnce('death', { full: true, hold: true }); if (this.gun) this.gun.root.visible = false; }
    this.mesh.position.copy(this.pos); this.gfx.setDissolve((this.deadT - 0.65) / 0.55); this.gfx.update(dt);
    if (this.deadT > 1.22) E.release(this);
    return;
  }
  this.mesh.rotation.x = Math.max(-1.5, -this.deadT * 5); this.mesh.position.copy(this.pos); this.mesh.position.y += 0.12;
  if (this.deadT > 0.5) { var op = 1 - (this.deadT - 0.5) / 0.7;
    if (op <= 0) { E.release(this); return; } for (var i = 0; i < this.mats.length; i++) this.mats[i].opacity = op; }
};
EP.update = function (dt) {
  if (!this.alive) { this.deadUpdate(dt); return; }
  var P = JO.Player; this.t += dt;
  var dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z; this.dist = Math.hypot(dx, dz) || 0.001; this.ndx = dx / this.dist; this.ndz = dz / this.dist;
  this.losT -= dt; if (this.losT <= 0) { this.losT = 0.2 + Math.random() * 0.1; this.see = !P.dead && this.dist < this.cfg.sight * 1.25 * E.sightK && los(this); }
  if (this.see) this.seenT = 0; else this.seenT += dt;
  this.moving = false; this.tint = this.burnT > 0 ? 0x802000 : 0;
  if (P.dead) { this.hideLaser(); }
  else if (this.state === 'patrol') { patrol(this, dt); if (this.alerted || JO.Stealth.detect(this, dt)) this.setAlert(); }
  else if (this.state === 'alert') { facePlayer(this, dt, 7); this.stateT -= dt;
    if (this.stateT <= 0) { this.state = 'attack'; this.sub = ''; if (this.type === 'rifleman') { pickCover(this, false, false); this.sub = 'move'; this.stateT = 4; }
      if (this.type === 'sniper') { this.sub = 'cool'; this.cd = 0.5 + Math.random(); } } }
  else AI[this.type](this, dt);
  // pose
  var m = this.model, g = this.mesh; g.position.copy(this.pos); g.rotation.y = this.yaw;
  if (this.type === 'drone') { for (var i = 0; i < 4; i++) m.rotors[i].rotation.y += dt * 40; g.rotation.x = Math.sin(this.t * 3) * 0.08; }
  else M.walk(m, this.walk, this.moving ? 1 : 0, this.type === 'runner' && this.sub !== 'windup');
  var em = this.flash > 0 ? 0x777777 : (this.tint || E.baseEmis); if (this.flash > 0) this.flash -= dt;
  if (em !== this.emis) { this.emis = em; for (var k = 0; k < this.mats.length; k++) this.mats[k].emissive.setHex(em); }
  // far-off enemies animate at a third of the rate
  if (this.gfx) { if (this.dist > 65) { this._adt = (this._adt || 0) + dt; this._an = (this._an | 0) + 1; if (this._an % 3 === 0) { animate(this, this._adt); this._adt = 0; } } else { animate(this, dt + (this._adt || 0)); this._adt = 0; } }
};

function patrol(e, dt) {
  if (e.type === 'sniper') { e.yaw += Math.sin(e.t * 0.5) * dt * 0.6; return; }
  if (e.type === 'drone') { e.ang += dt * 0.6; e.pos.x = e.homeX + Math.cos(e.ang) * 2.5; e.pos.z = e.homeZ + Math.sin(e.ang) * 2.5; e.pos.y = 4 + Math.sin(e.t) * 0.5; e.yaw = -e.ang; return; }
  var tx = e.homeX + e.patDir * 3.2; if (Math.abs(tx) > 15) tx = e.homeX - e.patDir * 3.2;
  if (moveToward(e, tx, e.homeZ, 1.1, dt) < 0.3 || e.avoidT > 0) { e.patDir = -e.patDir; e.avoidT = 0; }
  e.yaw = turnToward(e.yaw, Math.atan2(tx - e.pos.x, e.homeZ - e.pos.z), dt * 4);
}

/* ============================================================
   AI per type
   ============================================================ */
var AI = {};

/* 1. RIFLEMAN — cover to cover, strafes while firing short inaccurate bursts, falls back when hurt */
AI.rifleman = function (e, dt) {
  var c = e.cfg;
  if (e.state === 'retreat') {
    e.stateT -= dt; var dr = moveToward(e, e.tx, e.tz, c.speed * 1.4, dt); e.yaw = turnToward(e.yaw, Math.atan2(e.tx - e.pos.x, e.tz - e.pos.z), dt * 8);
    if (dr < 0.8 || e.stateT <= 0) { e.state = 'attack'; e.sub = 'fight'; e.fightT = 4.5; e.ax = e.pos.x; e.az = e.pos.z; e.strafe = 1; e.strafeT = 0.6; e.cd = 0.8; }
    return;
  }
  if (e.hp < e.maxHp * c.retreatHp && !e.retreated) { e.retreated = true; pickCover(e, true, false); e.state = 'retreat'; e.stateT = 3.2; e.burst = 0; JO.Events.emit('enemy_retreat', e); return; }
  if (e.sub === 'move') {
    e.stateT -= dt; var d = moveToward(e, e.tx, e.tz, c.speed, dt);
    if (e.see) facePlayer(e, dt, 6); else e.yaw = turnToward(e.yaw, Math.atan2(e.tx - e.pos.x, e.tz - e.pos.z), dt * 6);
    if (d < 0.7 || e.stateT <= 0) { e.sub = 'fight'; e.fightT = 3 + Math.random() * 2.5; e.ax = e.pos.x; e.az = e.pos.z; e.strafe = Math.random() < 0.5 ? -1 : 1; e.strafeT = 0.8; }
  } else {
    facePlayer(e, dt, 6);
    e.strafeT -= dt; if (e.strafeT <= 0 || Math.hypot(e.pos.x - e.ax, e.pos.z - e.az) > 2.6) { e.strafe = -e.strafe; e.strafeT = 0.7 + Math.random() * 0.8; }
    moveToward(e, e.pos.x - e.ndz * e.strafe * 2, e.pos.z + e.ndx * e.strafe * 2, c.speed * 0.55, dt);
    e.fightT -= dt; if (e.see) e.noSeeT = 0; else e.noSeeT += dt;
    if (e.fightT <= 0 || e.noSeeT > 2.2) { pickCover(e, false, e.noSeeT > 2.2); e.sub = 'move'; e.stateT = 4; e.noSeeT = 0; }
  }
  e.cd -= dt;
  if (e.burst > 0) { e.shotT -= dt; if (e.shotT <= 0) { fireBullet(e, c.spread, c.bulletSpeed, c.dmg, 0xffd060); A.playAt('enemyShot', e.pos.x, e.pos.z);
    e.burst--; e.shotT = c.burstGap; if (e.burst === 0) e.cd = c.cooldown[0] + Math.random() * (c.cooldown[1] - c.cooldown[0]); } }
  else if (e.cd <= 0 && e.see && e.dist < c.sight) { e.burst = c.burst; e.shotT = 0; }
};

/* 2. MACHETE RUNNER — zig-zag sprint, telegraphed slash, hops back */
AI.runner = function (e, dt) {
  var c = e.cfg, P = JO.Player;
  if (e.sub === 'windup') {
    facePlayer(e, dt, 9); e.stateT -= dt; e.tint = 0xaa1010; e.model.armR.rotation.x = -2.7;
    if (e.stateT <= 0) { A.playAt('slash', e.pos.x, e.pos.z); e.model.armR.rotation.x = -0.4;
      if (e.dist < c.reach && Math.abs(P.pos.y - e.pos.y) < 1.4) P.damage(c.dmg, e.pos.x, e.pos.z, 'machete');
      FX.burst(e.pos.x + e.ndx, e.pos.y + 1.2, e.pos.z + e.ndz, 4, 0xffffff, 3, 0.15, 0, 0.08);
      e.sub = 'recover'; e.state = 'retreat'; e.stateT = 0.55; }
  } else if (e.sub === 'recover') {
    e.stateT -= dt; facePlayer(e, dt, 6); moveToward(e, e.pos.x - e.ndx * 3, e.pos.z - e.ndz * 3, 2.6, dt);
    if (e.stateT <= 0) { e.sub = ''; e.state = 'attack'; }
  } else {
    var zig = e.dist > 4.5 ? Math.sin(e.t * 5.5 + e.ph) * 0.75 : 0, cs = Math.cos(zig), sn = Math.sin(zig);
    var dx = e.ndx * cs - e.ndz * sn, dz = e.ndx * sn + e.ndz * cs;
    moveToward(e, e.pos.x + dx * 4, e.pos.z + dz * 4, c.speed, dt); e.yaw = turnToward(e.yaw, Math.atan2(dx, dz), dt * 10);
    if (e.dist < 1.95) { e.sub = 'windup'; e.stateT = c.windup; A.playAt('windup', e.pos.x, e.pos.z, 0.8); }
    else if (e.dist < 14 && e.dist > 10) JO.Events.emit('enemy_charge', e);
  }
};

/* 3. SNIPER — perched; 1.5 s laser + dot before every shot; relocates when hit */
AI.sniper = function (e, dt) {
  var c = e.cfg, P = JO.Player;
  if (e.state === 'retreat') {
    e.stateT += dt; var k = Math.min(1, e.stateT / 1.5);
    e.pos.x = e.fromX + (e.toX - e.fromX) * k; e.pos.z = e.fromZ + (e.toZ - e.fromZ) * k; e.pos.y = e.perchY + Math.sin(k * Math.PI) * 0.45;
    e.yaw = Math.atan2(e.toX - e.fromX, e.toZ - e.fromZ); e.moving = true; e.walk += dt * 10;
    if (k >= 1) { e.state = 'attack'; e.sub = 'cool'; e.cd = 1.1; e.pos.y = e.perchY; }
    return;
  }
  facePlayer(e, dt, 5);
  if (e.sub !== 'aim') {
    e.hideLaser(); e.cd -= dt;
    if (e.cd <= 0 && e.see && e.dist < c.sight) { e.sub = 'aim'; e.stateT = c.aim; e.ax = P.pos.x; e.ay = P.pos.y + 1; e.az = P.pos.z; e.blindT = 0; e.locked = false; A.playAt('beep', e.pos.x, e.pos.z, 1.5); JO.Events.emit('enemy_aim', e); }
    return;
  }
  e.stateT -= dt;
  var tracking = e.stateT > c.lock;
  if (tracking) { var kk = Math.min(1, dt * 10); e.ax += (P.pos.x - e.ax) * kk; e.ay += (P.pos.y + 1 - e.ay) * kk; e.az += (P.pos.z - e.az) * kk; }
  else if (!e.locked) { e.locked = true; A.playAt('laser', e.pos.x, e.pos.z, 1.6); }
  var mx = e.pos.x + e.ndx * 0.9, my = e.pos.y + 1.42, mz = e.pos.z + e.ndz * 0.9;
  var dx = e.ax - mx, dy = e.ay - my, dz = e.az - mz, len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1; dx /= len; dy /= len; dz /= len;
  var t = W.raycast(mx, my, mz, dx, dy, dz, 170), end = tracking ? Math.min(t, len) : t;
  var w = tracking ? 0.035 : 0.09;
  e.laser.position.set(mx + dx * end / 2, my + dy * end / 2, mz + dz * end / 2); e.laser.lookAt(mx + dx * end, my + dy * end, mz + dz * end); e.laser.scale.set(w, w, end);
  e.laserMat.opacity = tracking ? 0.55 + 0.3 * Math.sin(e.t * 30) : 1; e.laser.visible = true;
  e.dot.position.set(mx + dx * end, my + dy * end, mz + dz * end); e.dot.scale.setScalar(tracking ? 0.22 + 0.08 * Math.sin(e.t * 20) : 0.42); e.dot.visible = true;
  if (!e.see && tracking) { e.blindT += dt; if (e.blindT > 1) { e.sub = 'cool'; e.cd = 0.8; e.hideLaser(); return; } } else e.blindT = 0;
  if (e.stateT <= 0) {
    FX.tracer(mx, my, mz, mx + dx * t, my + dy * t, mz + dz * t, 0xff6040, 0.11, 0.22); A.playAt('sniperShot', e.pos.x, e.pos.z, 1.4);
    FX.burst(mx + dx * t, my + dy * t, mz + dz * t, 8, 0xffc890, 4, 0.3);
    var px = P.pos.x - mx, py = P.pos.y + 0.95 - my, pz = P.pos.z - mz, s = px * dx + py * dy + pz * dz;
    if (s > 0 && s < t + 0.3) { var qx = px - dx * s, qy = py - dy * s, qz = pz - dz * s; if (qx * qx + qz * qz < 0.42 && Math.abs(qy) < 1.05) P.damage(c.dmg, e.pos.x, e.pos.z, 'sniper'); }
    e.sub = 'cool'; e.cd = c.cooldown * (0.9 + Math.random() * 0.25); e.hideLaser();
  }
};

/* 4. GRENADIER — holds range, lobs arcing grenades with a landing marker and 2 s fuse */
AI.grenadier = function (e, dt) {
  var c = e.cfg, P = JO.Player;
  facePlayer(e, dt, 4);
  if (e.sub === 'throw') {
    e.stateT -= dt; e.tint = 0x664400; e.model.armR.rotation.x = -2.9;
    if (e.stateT <= 0) { var acc = JO.Game.diffCfg.acc, tx = P.pos.x + P.vx * 0.45 + (Math.random() - 0.5) * 3 / acc, tz = P.pos.z + P.vz * 0.45 + (Math.random() - 0.5) * 3 / acc;
      H.grenade(e.pos.x + e.ndx * 0.4, e.pos.y + 1.9, e.pos.z + e.ndz * 0.4, tx, tz, 1.05, c.fuse, c.radius, c.dmg);
      A.playAt('throw', e.pos.x, e.pos.z); e.model.armR.rotation.x = -0.6; e.sub = ''; e.cd = c.cooldown * (0.85 + Math.random() * 0.3); }
    return;
  }
  e.model.armR.rotation.x += (0 - e.model.armR.rotation.x) * Math.min(1, dt * 5);
  if (e.dist < c.range[0]) { e.state = e.dist < 9 ? 'retreat' : 'attack'; moveToward(e, e.pos.x - e.ndx * 4, e.pos.z - e.ndz * 4, c.speed * (e.dist < 9 ? 1.5 : 1), dt); }
  else if (e.dist > c.range[1]) { e.state = 'attack'; moveToward(e, P.pos.x, P.pos.z, c.speed, dt); }
  else { e.state = 'attack'; moveToward(e, e.pos.x - e.ndz * e.patDir * 3, e.pos.z + e.ndx * e.patDir * 3, c.speed * 0.5, dt); if (Math.random() < dt * 0.4) e.patDir = -e.patDir; }
  e.cd -= dt;
  if (e.cd <= 0 && e.dist < 32 && e.seenT < 3) { e.sub = 'throw'; e.stateT = 0.55; A.playAt('windup', e.pos.x, e.pos.z, 0.7); JO.Events.emit('enemy_throw', e); }
};

/* 5. SHIELD TROOPER — steady advance behind a frontal shield (flank / back / legs), baton up close */
AI.shield = function (e, dt) {
  var c = e.cfg, P = JO.Player;
  e.yaw = turnToward(e.yaw, Math.atan2(e.ndx, e.ndz), c.turn * dt);
  var fx = Math.sin(e.yaw), fz = Math.cos(e.yaw), facing = fx * e.ndx + fz * e.ndz, sp = e.model.shieldPivot;
  if (e.sub === 'windup') {
    e.stateT -= dt; e.shieldOpen = true; e.tint = 0x884400; e.model.armR.rotation.x = -2.6;
    if (e.stateT <= 0) { A.playAt('slash', e.pos.x, e.pos.z); e.model.armR.rotation.x = -0.4;
      if (e.dist < c.reach + 0.3 && facing > 0.45 && Math.abs(P.pos.y - e.pos.y) < 1.4) { if (P.damage(c.dmg, e.pos.x, e.pos.z, 'baton')) P.knock(e.ndx * 7, e.ndz * 7); }
      e.sub = 'recover'; e.stateT = 0.75; }
  } else if (e.sub === 'recover') { e.stateT -= dt; e.shieldOpen = e.stateT > 0.2; if (e.stateT <= 0) e.sub = ''; }
  else {
    e.shieldOpen = false;
    if (e.state === 'retreat') { e.stateT -= dt; moveToward(e, e.pos.x - fx * 3, e.pos.z - fz * 3, c.speed * 0.8, dt); if (e.stateT <= 0) e.state = 'attack'; }
    else {
      if (e.hp < e.maxHp * 0.25 && !e.retreated) { e.retreated = true; e.state = 'retreat'; e.stateT = 2.4; }
      if (e.dist > 1.9) moveToward(e, e.pos.x + fx * 3, e.pos.z + fz * 3, c.speed, dt);
      if (e.dist < 2.3 && facing > 0.7) { e.sub = 'windup'; e.stateT = c.windup; A.playAt('windup', e.pos.x, e.pos.z, 0.8); }
    }
    e.cd -= dt;
    if (e.cd <= 0 && e.see && e.dist > 4.5 && facing > 0.93) { fireBullet(e, 3.2, 40, c.pistolDmg, 0xffd060); A.playAt('enemyShot', e.pos.x, e.pos.z, 0.8); e.cd = c.pistolCd * (0.8 + Math.random() * 0.4); }
  }
  var want = e.shieldOpen ? 1.35 : 0; sp.rotation.y += (want - sp.rotation.y) * Math.min(1, dt * 14); sp.position.x = -0.1 - sp.rotation.y * 0.3;
};

/* 6. SCOUT DRONE — orbits at changing heights; laser bursts and telegraphed dive-bombs */
AI.drone = function (e, dt) {
  var c = e.cfg, P = JO.Player, dx, dy, dz, l;
  if (e.sub === 'diveTel') {
    e.stateT -= dt; e.tint = 0xcc1000; facePlayer(e, dt, 8); e.pos.y += dt * 1.2;
    if (e.stateT <= 0) { dx = P.pos.x - e.pos.x; dy = P.pos.y + 1.0 - e.pos.y; dz = P.pos.z - e.pos.z; l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      e.dvx = dx / l; e.dvy = dy / l; e.dvz = dz / l; e.sub = 'dive'; e.stateT = Math.min(1.5, l / 17 + 0.25); e.hitDone = false; }
  } else if (e.sub === 'dive') {
    e.tint = 0xcc1000; e.pos.x += e.dvx * 17 * dt; e.pos.y += e.dvy * 17 * dt; e.pos.z += e.dvz * 17 * dt; e.stateT -= dt;
    if (!e.hitDone && Math.hypot(P.pos.x - e.pos.x, P.pos.y + 1 - e.pos.y, P.pos.z - e.pos.z) < 1.35) { e.hitDone = true; P.damage(c.diveDmg, e.pos.x, e.pos.z, 'dive'); }
    if (e.pos.y <= 0.9 || e.stateT <= 0) { if (e.pos.y < 0.9) e.pos.y = 0.9; e.sub = 'climb'; e.state = 'retreat'; e.stateT = 1.1; }
  } else {
    e.ang += e.orbitDir * 0.85 * dt; var Rr = 9.5 + Math.sin(e.t * 0.6 + e.ph) * 2.5;
    dx = P.pos.x + Math.cos(e.ang) * Rr - e.pos.x; dz = P.pos.z + Math.sin(e.ang) * Rr - e.pos.z; dy = P.pos.y + 3.7 + Math.sin(e.t * 0.9 + e.ph) * 1.7 - e.pos.y;
    l = Math.hypot(dx, dz); var sp = Math.min(c.speed, l * 2.5); if (l > 0.01) { e.pos.x += dx / l * sp * dt; e.pos.z += dz / l * sp * dt; }
    e.pos.y += Math.max(-4, Math.min(4, dy * 2)) * dt; facePlayer(e, dt, 6);
    if (e.sub === 'climb') { e.stateT -= dt; if (e.stateT <= 0) { e.sub = ''; e.state = 'attack'; } }
    e.cd -= dt;
    if (e.burst > 0) { e.shotT -= dt; if (e.shotT <= 0) { fireBullet(e, 2.4, 36, c.dmg, 0xff5078, -0.2); A.playAt('laser', e.pos.x, e.pos.z); e.burst--; e.shotT = 0.13; } }
    else if (e.cd <= 0 && e.see && e.sub === '') { e.atk++; e.cd = c.cooldown * (0.8 + Math.random() * 0.4);
      if (e.atk % 3 === 0) { e.sub = 'diveTel'; e.stateT = 0.65; A.playAt('windup', e.pos.x, e.pos.z, 1.2); } else { e.burst = 3; e.shotT = 0; } }
  }
  W.clamp(e.pos, 0.6);
};
E.AI = AI;

/* ============================================================
   MANAGER
   ============================================================ */
E.init = function (scene) { E.scene = scene; };
// sniper laser colour (colourblind setting)
E.setLaser = function (hex) { E.laserHex = hex; var all = E.list.concat(E.pools.sniper || []); for (var i = 0; i < all.length; i++) if (all[i].laserMat) { all[i].laserMat.color.setHex(hex); all[i].dot.material.color.setHex(hex); } };
E.spawn = function (type, x, z, o) {
  var pool = E.pools[type] || (E.pools[type] = []), e = pool.length ? pool.pop() : new Enemy(type);
  e.spawn(x, z, o); E.list.push(e); return e;
};
E.release = function (e) {
  e.active = false; e.mesh.visible = false; if (e.hideLaser) e.hideLaser();
  var i = E.list.indexOf(e); if (i >= 0) { E.list[i] = E.list[E.list.length - 1]; E.list.pop(); }
  if (!e.isBoss) E.pools[e.type].push(e);
};
E.reset = function () { for (var i = E.list.length - 1; i >= 0; i--) { var e = E.list[i]; if (e.isBoss) { if (e.dispose) e.dispose(); E.list.splice(i, 1); } else E.release(e); } };
E.clearRegulars = function (kill) {
  for (var i = E.list.length - 1; i >= 0; i--) { var e = E.list[i]; if (e.isBoss) continue;
    if (kill && e.alive) { e.alive = false; e.state = 'dead'; e.deadT = 0.3; e.vy = 0; e.hideLaser(); for (var k = 0; k < e.mats.length; k++) { e.mats[k].transparent = true; e.mats[k].needsUpdate = true; } }
    else if (!kill) E.release(e); }
};
E.count = function () { var n = 0; for (var i = 0; i < E.list.length; i++) if (!E.list[i].isBoss && E.list[i].alive) n++; return n; };
E.countType = function (t) { var n = 0; for (var i = 0; i < E.list.length; i++) if (E.list[i].type === t && E.list[i].alive) n++; return n; };
E.alertNear = function (x, z, r) {
  for (var i = 0; i < E.list.length; i++) { var e = E.list[i]; if (e.isBoss || !e.alive || e.state !== 'patrol') continue;
    if (Math.hypot(e.pos.x - x, e.pos.z - z) < r) e.alerted = true; }
};

E.update = function (dt) {
  var L = E.list, i, j, a, b, P = JO.Player, near = 0;
  E.sightK = JO.Perks.sight() * (JO.Stealth ? JO.Stealth.sightK() : 1);
  for (i = L.length - 1; i >= 0; i--) L[i].update(dt);
  for (i = 0; i < L.length; i++) { a = L[i]; if (!a.alive || a.isBoss) continue;
    if (a.type === 'drone') { var dd = Math.hypot(a.pos.x - P.pos.x, a.pos.y - P.pos.y, a.pos.z - P.pos.z), v = 1 - dd / 30; if (v > near) near = v; continue; }
    if (a.pos.y > 1) continue;
    for (j = i + 1; j < L.length; j++) { b = L[j]; if (!b.alive || b.isBoss || b.type === 'drone' || b.pos.y > 1) continue;
      var dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d2 = dx * dx + dz * dz;
      if (d2 < 0.81 && d2 > 1e-6) { var d = Math.sqrt(d2), p = (0.9 - d) * 0.5; dx /= d; dz /= d; a.pos.x -= dx * p; a.pos.z -= dz * p; b.pos.x += dx * p; b.pos.z += dz * p; } }
    if (a.dist < 0.85) { a.pos.x -= a.ndx * (0.85 - a.dist); a.pos.z -= a.ndz * (0.85 - a.dist); }
  }
  A.setDrone(near * near * 0.16);
};

// Ray vs world, then every hitbox. Fills res = { t, enemy, part, missile }.
E.hitscan = function (ox, oy, oz, dx, dy, dz, max, res) {
  var best = W.raycast(ox, oy, oz, dx, dy, dz, max), bestCmp = best, L = E.list, i, k;
  res.enemy = null; res.part = null; res.missile = null;
  for (i = 0; i < L.length; i++) {
    var e = L[i]; if (!e.alive || !e.active) continue;
    var px = e.pos.x - ox, py = e.pos.y + e.boundY - oy, pz = e.pos.z - oz, s = px * dx + py * dy + pz * dz;
    if (s < -e.bound || s > best + e.bound) continue;
    var qx = px - dx * s, qy = py - dy * s, qz = pz - dz * s; if (qx * qx + qy * qy + qz * qz > e.bound * e.bound) continue;
    var sn = Math.sin(e.yaw), cs = Math.cos(e.yaw), parts = e.parts;
    for (k = 0; k < parts.length; k++) {
      var p = parts[k]; if (p.off) continue;
      var lx = p.ox || 0, lz = p.oz || 0, cx = e.pos.x + lx * cs + lz * sn, cz = e.pos.z - lx * sn + lz * cs, t, b, c2, disc, mx = ox - cx, mz = oz - cz;
      if (p.k === 's') {
        var my = oy - (e.pos.y + p.oy); b = mx * dx + my * dy + mz * dz; c2 = mx * mx + my * my + mz * mz - p.r * p.r;
        if (c2 > 0 && b > 0) continue; disc = b * b - c2; if (disc < 0) continue; t = -b - Math.sqrt(disc); if (t < 0) t = 0;
      } else {
        var a = dx * dx + dz * dz; if (a < 1e-9) continue; b = mx * dx + mz * dz; c2 = mx * mx + mz * mz - p.r * p.r; disc = b * b - a * c2; if (disc < 0) continue;
        t = (-b - Math.sqrt(disc)) / a; if (t < 0) { if (c2 < 0) t = 0; else continue; }
        var y = oy + dy * t; if (y < e.pos.y + p.y0 || y > e.pos.y + p.y1) continue;
      }
      var cmp = t - (p.bias || (p.tag === 'head' ? 0.35 : 0));
      if (cmp < bestCmp && t < max) { bestCmp = cmp; best = t; res.enemy = e; res.part = p; }
    }
  }
  var ms = H.missiles;
  for (i = 0; i < ms.length; i++) { var m = ms[i]; if (!m.active) continue;
    var ax = ox - m.x, ay = oy - m.y, az = oz - m.z, bb = ax * dx + ay * dy + az * dz, cc = ax * ax + ay * ay + az * az - 0.72;
    if (cc > 0 && bb > 0) continue; var di = bb * bb - cc; if (di < 0) continue; var tm = Math.max(0, -bb - Math.sqrt(di));
    if (tm < best) { best = tm; bestCmp = tm; res.enemy = null; res.part = null; res.missile = m; } }
  res.t = best; return res;
};
})();
