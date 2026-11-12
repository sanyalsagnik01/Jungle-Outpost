/* ============================================================
   JUNGLE OUTPOST — bosses.js
   THE BRUTE, THE PHANTOM and THE COMMANDER. Each is a state
   machine with multiple phases; every attack has a sound cue
   and a visual warning before it can hurt.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, CFG = JO.CFG, W = JO.World, FX = JO.FX, A = JO.Audio, M = JO.Models, H = JO.Haz, E = JO.Enemies, G = W.G;
var B = JO.Bosses = {}, R = E.R, part = M.part, DEG = Math.PI / 180;

function mat(c, em) { var m = new THREE.MeshLambertMaterial({ color: c }); if (em) m.emissive.setHex(em); m.userData.base = em || 0; return m; }
function basic(c, o) { return new THREE.MeshBasicMaterial(Object.assign({ color: c }, o || {})); }

/* ---------- shared base ---------- */
function base(self, kind, x, z) {
  self.kind = kind; self.cfg = CFG.BOSS[kind]; self.type = 'boss'; self.isBoss = true; self.name = self.cfg.name;
  self.pos = new THREE.Vector3(x, 0, z); self.yaw = 0; self.alive = true; self.active = true; self.done = false;
  self.maxHp = self.hp = self.cfg.hp * JO.Game.diffCfg.hp; self.state = 'wait'; self.stateT = 0; self.t = 0; self.phase = 1; self.phases = 2;
  self.flash = 0; self.emis = -1; self.dying = 0; self.atkT = 2; self.atkI = 0; self.dist = 99; self.ndx = 0; self.ndz = 1;
  self.radius = 1.3; self.avoidT = 0; self.avoidSide = 1; self.stuckT = 0; self.walk = 0; self.moving = false; self.extra = []; self.mats = []; self.tint = 0;
  self.mesh = new THREE.Group(); self.mesh.rotation.order = 'YXZ'; E.scene.add(self.mesh);
}
var proto = {
  common: function (dt) {
    var P = JO.Player; this.t += dt; var dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z;
    this.dist = Math.hypot(dx, dz) || 0.001; this.ndx = dx / this.dist; this.ndz = dz / this.dist; this.moving = false;
    var em = this.flash > 0 ? 0x555555 : this.tint; if (this.flash > 0) this.flash -= dt;
    if (em !== this.emis) { this.emis = em; for (var i = 0; i < this.mats.length; i++) this.mats[i].emissive.setHex(em || this.mats[i].userData.base); }
    this._tint = this.tint; this.tint = 0;
  },
  start: function () { if (this.state !== 'wait') return; this.state = 'intro'; this.stateT = 1.8; A.play('roar'); FX.addShake(0.5); },
  invulnerable: function () { return this.state === 'wait' || this.state === 'intro' || !this.alive; },
  hurt: function (d) {
    this.hp -= d; this.flash = 0.07; R.dealt = d; if (this.gfx) this.gfx.flash(0x666666, 0.07);
    if (this.hp <= 0) { this.hp = 0; R.killed = true; this.alive = false; this.dying = this.kind === 'commander' ? 2.6 : 1.5; this.dieStart(); JO.Game.onBossDying(this); }
  },
  dieStart: function () {},
  animate: function (dt) {
    var k = this.gfx, T = ANIM[this.kind], st = this.alive ? this.state : 'dead';
    if (st !== this._ast) {
      var en = T.enter[st]; if (typeof en === 'function') en = en(this);
      if (st === 'dead') k.playOnce('death', HOLD);
      else if (en && en !== 'keep') k.playOnce(en[0], en[1]);
      else if (!en && k.shot && k.shot.name !== 'phase_change') k.stopShot();
      this._ast = st;
    } else if (T.repeat[st] && !k.shot) k.playOnce(T.repeat[st]);
    var lp = T.loop(this); k.play(lp[0], lp[1]);
    k.tint = this.alive ? this._tint : 0; k.update(dt);
    if (!this.alive) k.setDissolve(1 - this.dying / 0.45);
    T.post(this, k, dt);
  },
  dyingUpdate: function (dt) {
    this.dying -= dt; this.mesh.position.x = this.pos.x + (Math.random() - 0.5) * 0.25; this.mesh.position.z = this.pos.z + (Math.random() - 0.5) * 0.25;
    this.boomT = (this.boomT || 0) - dt;
    if (this.boomT <= 0) { this.boomT = 0.22; var s = this.kind === 'commander' ? 3 : 1.4;
      FX.explosion(this.pos.x + (Math.random() - 0.5) * s * 1.6, 1 + Math.random() * s * 1.4, this.pos.z + (Math.random() - 0.5) * s * 1.6, this.kind === 'commander' ? 2.4 : 1.2); }
    if (this.dying <= 0) { this.done = true; this.mesh.visible = false; this.hideExtras();
      FX.explosion(this.pos.x, 2, this.pos.z, this.kind === 'commander' ? 9 : 4); FX.addShake(1.2);
      FX.burst(this.pos.x, 2.5, this.pos.z, 60, 0xffd070, 14, 1.2, 9, 0.3, 5); JO.Game.onBossDead(this); }
  },
  hideExtras: function () { for (var i = 0; i < this.extra.length; i++) this.extra[i].visible = false; },
  dispose: function () {
    E.scene.remove(this.mesh); for (var i = 0; i < this.extra.length; i++) { E.scene.remove(this.extra[i]); if (this.extra[i].material) this.extra[i].material.dispose(); }
    for (var k = 0; k < this.mats.length; k++) this.mats[k].dispose(); if (this.line) this.line.life = 0; if (this.gfx) this.gfx.dispose();
  },
  setPhase: function (n, msg) { this.phase = n; this.atkI = 0; JO.Events.emit('boss_phase', this, n); if (this.gfx) this.gfx.playOnce('phase_change', FULL); A.play('roar'); FX.addShake(0.7); JO.UI.banner(msg, 2.6, true); FX.burst(this.pos.x, 2.5, this.pos.z, 30, 0xff5030, 9, 0.8, 6, 0.24, 3); }
};
function extend(C) {
  for (var k in proto) if (!C.prototype[k]) C.prototype[k] = proto[k];
  C.prototype._update = C.prototype.update;
  C.prototype.update = function (dt) { this._update(dt); if (this.gfx && !this.done) this.animate(dt); };
}
// swap the primitive body for the GLB (if it loaded); the primitive group stays as anchor + fallback
function attach(self, name, scale) {
  var k = JO.Assets.instantiate(name); if (!k) return null;
  for (var i = 0; i < self.mesh.children.length; i++) self.mesh.children[i].visible = false;
  if (scale) k.root.scale.setScalar(scale);
  self.mesh.add(k.root); self.gfx = k; self._ast = ''; return k;
}
/* boss state -> clip tables.  enter: one-shot when a state begins ('keep' = leave the current one running);
   repeat: one-shot that re-triggers while the state lasts;  loop: [clip, timeScale] for the base layer */
var HOLD = { full: true, hold: true }, FULL = { full: true };
var ANIM = {
  brute: {
    enter: { intro: ['phase_change', FULL], sweepTel: ['reload', HOLD], chargeTel: ['special', HOLD], stun: ['hit', HOLD], slamTel: ['attack', FULL] },
    repeat: { sweep: 'shoot' },
    loop: function (b) { return b.state === 'charge' ? ['run', 1.5] : (b.state === 'walk' && b.moving ? ['walk', b.phase === 2 ? 1.0 : 0.67] : ['idle', 1]); },
    post: function (b, k) { b.mesh.position.y = 0; b.mesh.rotation.x = 0;
      var w = k.fx.fx_weak; if (w) w.emissive.setHex(b.state === 'stun' ? (Math.sin(b.t * 14) > 0 ? 0xffb040 : 0x8a3000) : 0x401800); }
  },
  phantom: {
    enter: { intro: ['phase_change', FULL], tel: function (b) { return b.next === 'burst' ? ['reload', FULL] : ['attack', FULL]; }, attack: ['shoot', { hold: true }], dashTel: ['special', HOLD] },
    repeat: {},
    loop: function (b) { return b.state === 'dash' ? ['run', 2] : (b.moving ? ['walk', 1] : ['idle', 1]); },
    post: function (b, k) { k.setOpacity(b.opacity); }
  },
  commander: {
    enter: { intro: ['phase_change', FULL], missTel: ['reload', { hold: true }], miss: 'keep', stompTel: ['attack', FULL], laserTel: ['special', HOLD], laser: 'keep' },
    repeat: { mg: 'shoot' },
    loop: function (b) { return b.moving ? [b.phase === 3 ? 'run' : 'walk', 1] : ['idle', 1]; },
    post: function (b, k) {
      var n = k.nodes, open = b.phase === 3;
      if (n.turret) n.turret.rotation.y = b.tyaw - b.yaw;                                    // the game aims the turret; clips only add recoil
      if (n.panel_front) n.panel_front.visible = n.panel_L.visible = n.panel_R.visible = !open;
      if (n.fx_core) { n.fx_core.visible = open; if (open && k.fx.fx_core) { var pu = 0.5 + Math.sin(b.t * 9) * 0.5; k.fx.fx_core.emissive.setRGB(0.9 * pu, 0.35 * pu, 0.05); } }
    }
  }
};
function shoot(x, y, z, yaw, dist, spreadDeg, speed, dmg, hex) {
  var a = yaw + (Math.random() - Math.random()) * spreadDeg * DEG, dx = Math.sin(a), dz = Math.cos(a), d = Math.max(5, dist), dy = (1.0 - y) / d + (Math.random() - 0.5) * spreadDeg * DEG;
  var l = Math.sqrt(dx * dx + dy * dy + dz * dz); FX.bullet(x, y, z, dx / l, dy / l, dz / l, speed, dmg, hex, 0, 1.25);
}

/* ============================================================
   LEVEL 1 — THE BRUTE
   ============================================================ */
function Brute(x, z) {
  base(this, 'brute', x, z); var g = this.mesh, c = this.cfg;
  var steel = mat(0x6a7078), dark = mat(0x2a2c30), red = mat(0x7a1c14), skin = mat(0xb07a50), weak = mat(0xff8a20, 0x8a3000);
  this.mats = [steel, dark, red, skin, weak]; this.weakMat = weak;
  part(G.box, dark, 0.75, 1.6, 0.85, -0.6, 0.8, 0, g); part(G.box, dark, 0.75, 1.6, 0.85, 0.6, 0.8, 0, g);
  part(G.box, steel, 2.4, 1.95, 1.45, 0, 2.6, 0, g); part(G.box, red, 1.9, 1.2, 0.2, 0, 2.75, 0.78, g);
  part(G.box, steel, 3.2, 0.5, 1.1, 0, 3.55, 0, g);                                   // shoulders
  part(G.box, skin, 0.7, 0.7, 0.7, 0, 3.98, 0.05, g); part(G.box, steel, 0.82, 0.36, 0.82, 0, 4.36, 0.05, g);
  part(G.cone, steel, 0.25, 0.7, 0.25, -0.5, 4.7, 0.05, g).rotation.z = 0.5; part(G.cone, steel, 0.25, 0.7, 0.25, 0.5, 4.7, 0.05, g).rotation.z = -0.5;
  this.armL = new THREE.Group(); this.armL.position.set(-1.55, 3.4, 0); g.add(this.armL); part(G.box, steel, 0.62, 1.7, 0.62, 0, -0.85, 0, this.armL); part(G.box, dark, 0.8, 0.6, 0.8, 0, -1.85, 0, this.armL);
  this.armR = new THREE.Group(); this.armR.position.set(1.55, 3.4, 0); g.add(this.armR); part(G.box, steel, 0.62, 0.9, 0.62, 0, -0.45, 0, this.armR);
  this.gun = part(G.cyl, dark, 0.75, 2.4, 0.75, 0, -0.9, 1.0, this.armR); this.gun.rotation.x = Math.PI / 2;
  part(G.box, dark, 0.9, 0.9, 0.9, 0, -0.9, 0, this.armR);
  part(G.box, weak, 1.0, 1.0, 0.55, 0, 2.55, -0.98, g); part(G.box, dark, 1.2, 0.2, 0.6, 0, 3.1, -0.98, g);   // glowing back tank
  this.parts = [
    { k: 'c', y0: 0, y1: 3.65, r: 1.25, tag: 'armor', mult: c.armorMult },
    { k: 's', oy: 3.98, r: 0.55, tag: 'bhead', mult: c.headMult, bias: 0.1 },
    { k: 's', oz: -1.2, oy: 2.55, r: 0.8, tag: 'weak', mult: c.weakMult, bias: 0.25 }
  ];
  this.bound = 5; this.boundY = 2.3; this.spark = 0xffc060; this.summonT = 4; this.yaw = 0; this.cdx = 0; this.cdz = 1; this.hitDone = false;
  attach(this, 'brute');
}
Brute.prototype.aimPoint = function (o) {
  var back = this.state === 'stun' || (Math.sin(this.yaw) * this.ndx + Math.cos(this.yaw) * this.ndz) < -0.2;
  if (back) { o.x = this.pos.x - Math.sin(this.yaw) * 1.2; o.y = 2.55; o.z = this.pos.z - Math.cos(this.yaw) * 1.2; } else { o.x = this.pos.x; o.y = 2.4; o.z = this.pos.z; }
};
Brute.prototype.takeHit = function (dmg, p) {
  R.dealt = 0; R.blocked = false; R.head = false; R.crit = false; R.killed = false; R.silent = false;
  if (this.invulnerable()) { R.blocked = true; R.silent = true; return R; }
  if (p.tag === 'weak') R.crit = true;
  this.hurt(dmg * p.mult);
  if (this.alive && this.phase === 1 && this.hp < this.maxHp * 0.5) { this.setPhase(2, 'THE BRUTE IS ENRAGED'); this.summonT = 3; }
  return R;
};
Brute.prototype.update = function (dt) {
  if (this.done) return; this.common(dt);
  var P = JO.Player, c = this.cfg, g = this.mesh, p2 = this.phase === 2, sp = c.walk * (p2 ? 1.5 : 1), lift = 0, lean = 0;
  if (!this.alive) { this.dyingUpdate(dt); return; }
  if (this.state === 'wait') { this.yaw = E.turnToward(this.yaw, Math.atan2(this.ndx, this.ndz), dt); }
  else if (P.dead) { /* stand down */ }
  else if (this.state === 'intro') { this.stateT -= dt; this.yaw = E.turnToward(this.yaw, Math.atan2(this.ndx, this.ndz), dt * 3); this.armL.rotation.x = -2.6; lift = 0.2; if (this.stateT <= 0) { this.state = 'walk'; this.atkT = 1.2; this.armL.rotation.x = 0; } }
  else if (this.state === 'walk') {
    this.yaw = E.turnToward(this.yaw, Math.atan2(this.ndx, this.ndz), c.turn * (p2 ? 1.4 : 1) * dt);
    if (this.dist > 6) E.moveToward(this, P.pos.x, P.pos.z, sp, dt);
    this.atkT -= dt;
    if (this.atkT <= 0) {
      var cyc = p2 ? ['slam', 'charge', 'sweep', 'slam'] : ['sweep', 'charge'], a = cyc[this.atkI++ % cyc.length];
      if (a === 'charge' && this.dist < 5) a = p2 ? 'slam' : 'sweep';
      if (a === 'sweep') { this.state = 'sweepTel'; this.stateT = 0.85; A.play('spinup'); A.play('beep'); }
      else if (a === 'charge') { this.state = 'chargeTel'; this.stateT = 1.15; this.locked = false; A.play('roar', 0.8); A.play('charge'); }
      else { this.state = 'slamTel'; this.stateT = 0.9; A.play('windup', 1.6); A.play('warn'); }
    }
    if (p2) { this.summonT -= dt;
      if (this.summonT <= 0 && E.count() <= CFG.MAX_ACTIVE - 2) { this.summonT = c.summonEvery; A.play('warn'); JO.UI.banner('RUNNERS INCOMING', 1.6, true);
        for (var s = -1; s <= 1; s += 2) { var e = E.spawn('runner', s * 23, W.AC + (Math.random() - 0.5) * 30, { alert: true, summoned: true }); FX.burst(e.pos.x, 1, e.pos.z, 12, 0x55aa44, 4, 0.5); } } }
  }
  else if (this.state === 'sweepTel') { this.stateT -= dt; this.tint = 0x553300; this.yaw = E.turnToward(this.yaw, Math.atan2(this.ndx, this.ndz), dt * 4); this.gun.rotation.y += dt * 20;
    if (this.stateT <= 0) { this.state = 'sweep'; this.stateT = c.sweepTime; this.sdir = Math.random() < 0.5 ? -1 : 1; this.byaw = Math.atan2(this.ndx, this.ndz); this.shotT = 0; } }
  else if (this.state === 'sweep') {
    this.stateT -= dt; var k = 1 - this.stateT / c.sweepTime; this.byaw = E.turnToward(this.byaw, Math.atan2(this.ndx, this.ndz), dt * 0.5);
    this.yaw = this.byaw + this.sdir * (k * 2 - 1) * c.sweepArc; this.gun.rotation.y += dt * 40; this.shotT -= dt;
    while (this.shotT <= 0) { this.shotT += c.sweepRate; var sy = Math.sin(this.yaw), cy = Math.cos(this.yaw), mx = this.pos.x + cy * 1.55 + sy * 2.3, mz = this.pos.z - sy * 1.55 + cy * 2.3;
      shoot(mx, 2.5, mz, Math.atan2(this.pos.x + sy * this.dist - mx, this.pos.z + cy * this.dist - mz), this.dist, 1.4, 40, c.sweepDmg, 0xffb040);
      FX.burst(mx, 2.5, mz, 1, 0xffd060, 2, 0.07, 0, 0.2); A.play('minigun'); }
    if (this.stateT <= 0) { this.state = 'walk'; this.atkT = p2 ? 1.1 : 1.8; }
  }
  else if (this.state === 'chargeTel') {
    this.stateT -= dt; this.tint = 0x661000; lean = 0.25;
    if (this.stateT > 0.45) this.yaw = E.turnToward(this.yaw, Math.atan2(this.ndx, this.ndz), dt * 5);
    else if (!this.locked) { this.locked = true; this.cdx = Math.sin(this.yaw); this.cdz = Math.cos(this.yaw);
      this.line = FX.groundLine(this.pos.x, this.pos.z, this.pos.x + this.cdx * 34, this.pos.z + this.cdz * 34, 3, 0.75, 0xff2010); A.play('warn'); }
    if (this.stateT <= 0) { this.state = 'charge'; this.stateT = 2.8; this.hitDone = false; }
  }
  else if (this.state === 'charge') {
    lean = 0.35; var px = this.pos.x, pz = this.pos.z, st = c.chargeSpeed * (p2 ? 1.12 : 1) * dt;
    this.pos.x += this.cdx * st; this.pos.z += this.cdz * st; W.moveCircle(this.pos, 1.3, 0, false); W.clamp(this.pos, 1.3);
    this.walk += st * 1.2; this.moving = true; if (Math.random() < 0.6) FX.burst(this.pos.x, 0.2, this.pos.z, 1, 0x9a8a66, 2, 0.4, 2, 0.3, 1);
    if (!this.hitDone && this.dist < 2.3 && P.pos.y < 2.5) { this.hitDone = true; if (P.damage(c.chargeDmg, this.pos.x, this.pos.z, 'charge')) P.knock(this.cdx * 12, this.cdz * 12); }
    if (Math.hypot(this.pos.x - px, this.pos.z - pz) < st * 0.5) {          // crashed into a pillar / the wall -> stunned
      this.state = 'stun'; this.stateT = c.stun; JO.Events.emit('boss_stun', this); FX.addShake(0.9); A.play('stomp'); A.play('clang', 1.5);
      FX.burst(this.pos.x + this.cdx * 1.5, 2, this.pos.z + this.cdz * 1.5, 26, 0xb0a890, 8, 0.8, 9, 0.26, 3); JO.UI.banner('STUNNED — HIT THE TANK ON HIS BACK', 2.2, false);
    } else { this.stateT -= dt; if (this.stateT <= 0) { this.state = 'recover'; this.stateT = 0.7; } }
  }
  else if (this.state === 'stun') { this.stateT -= dt; lift = -0.55; lean = 0.5; this.weakMat.emissive.setHex(Math.sin(this.t * 14) > 0 ? 0xffa030 : 0x8a3000); this.emis = -1;
    if (Math.random() < 0.3) FX.burst(this.pos.x, 4.2, this.pos.z, 1, 0xffff80, 2, 0.4, 0, 0.14, 1);
    if (this.stateT <= 0) { this.state = 'walk'; this.atkT = 1; } }
  else if (this.state === 'slamTel') { this.stateT -= dt; this.tint = 0x664400; lift = (0.9 - this.stateT) * 1.6; this.armL.rotation.x = -2.8;
    if (this.stateT <= 0) { H.shockwave(this.pos.x, this.pos.z, c.slamSpeed, 36, c.slamDmg, 0xffb030); A.play('stomp'); FX.addShake(0.8);
      FX.burst(this.pos.x, 0.3, this.pos.z, 24, 0xa89878, 7, 0.6, 9, 0.24, 2); this.armL.rotation.x = 0; this.state = 'recover'; this.stateT = 0.9; } }
  else if (this.state === 'recover') { this.stateT -= dt; if (this.stateT <= 0) { this.state = 'walk'; this.atkT = p2 ? 0.9 : 1.6; } }
  g.position.set(this.pos.x, lift, this.pos.z); g.rotation.y = this.yaw; g.rotation.x = lean;
};
extend(Brute);

/* ============================================================
   LEVEL 2 — THE PHANTOM
   ============================================================ */
function Phantom(x, z) {
  base(this, 'phantom', x, z); this.phases = 3;
  var o = M.humanoid({ body: 0x3a2a55, skin: 0x9a8aa8, dark: 0x16121f, accent: 0x58e0d0 });
  this.model = o; this.mesh.add(o.g); this.mesh.scale.setScalar(1.18); this.mats = o.matList;
  for (var i = 0; i < this.mats.length; i++) { this.mats[i].userData.base = 0; this.mats[i].transparent = true; }
  part(G.cone, o.mats.body, 1.25, 1.7, 1.25, 0, 0.95, -0.08, o.g); part(G.cone, o.mats.dark, 0.6, 0.6, 0.6, 0, 1.92, -0.02, o.g);
  part(G.box, o.mats.accent, 0.24, 0.06, 0.04, 0, 1.72, 0.18, o.g); o.mats.accent.emissive.setHex(0x2a9088); o.mats.accent.userData.base = 0x2a9088;
  this.wire = basic(0x8ff0e0, { wireframe: true, transparent: true, opacity: 0.4, fog: false });
  var w1 = new THREE.Mesh(G.cone, this.wire); w1.scale.set(1.4, 1.9, 1.4); w1.position.set(0, 1.0, -0.08); o.g.add(w1);
  var w2 = new THREE.Mesh(G.ico0, this.wire); w2.scale.setScalar(0.75); w2.position.set(0, 1.75, 0); o.g.add(w2);
  this.parts = [{ k: 'c', y0: 0, y1: 1.78, r: 0.52, tag: 'body', mult: 1 }, { k: 's', oy: 2.0, r: 0.33, tag: 'head', mult: 1.6 }];
  this.bound = 3; this.boundY = 1.1; this.radius = 0.5; this.opacity = 1; this.spark = 0xa070ff; this.next = 'burst'; this.droneT = 0; this.burst = 0; this.shotT = 0; this.alt = 0;
  var k = attach(this, 'phantom', 1 / 1.18); if (k) k.addWire(this.wire);                       // model is authored at full size; the anchor is scaled
}
Phantom.prototype.aimPoint = function (o) { o.x = this.pos.x; o.y = 1.3; o.z = this.pos.z; };
Phantom.prototype.takeHit = function (dmg, p) {
  R.dealt = 0; R.blocked = false; R.head = false; R.crit = false; R.killed = false; R.silent = false;
  if (this.invulnerable()) { R.blocked = true; R.silent = true; return R; }
  if (p.tag === 'head') R.head = true;
  this.hurt(dmg * p.mult * (this.state === 'cloaked' ? 0.5 : 1)); if (!this.alive) return R;
  if (this.phase === 1 && this.hp < this.maxHp * 0.5) { this.setPhase(2, 'THE PHANTOM UNLEASHES POISON'); this.droneT = 0.5; }
  else if (this.phase === 2 && this.hp < this.maxHp * this.cfg.finalAt) this.setPhase(3, 'FINAL STAGE — WATCH THE RED LINE');
  return R;
};
Phantom.prototype.teleport = function () {
  var P = JO.Player, sp = W.arena.spots, best = null, bs = -1e9, c = this.cfg;
  for (var i = 0; i < sp.length; i++) { var s = sp[i], dp = Math.hypot(s.x - P.pos.x, s.z - P.pos.z), ds = Math.hypot(s.x - this.pos.x, s.z - this.pos.z);
    if (ds < 4) continue; var sc = Math.random() * 10 - Math.abs(dp - 16) * 0.5; if (dp < 6) sc -= 20; if (sc > bs) { bs = sc; best = s; } }
  if (!best) return;
  FX.burst(this.pos.x, 1.2, this.pos.z, 22, 0x9a6cff, 5, 0.5, 0, 0.2); A.playAt('teleport', this.pos.x, this.pos.z, 1.3);
  if (this.phase >= 2) H.gas(this.pos.x, this.pos.z, 3.6, 7.5, c.gasDps);
  this.pos.x = best.x; this.pos.z = best.z; FX.burst(this.pos.x, 1.2, this.pos.z, 22, 0x58e0d0, 5, 0.5, 0, 0.2);
  var dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z; this.yaw = Math.atan2(dx, dz); this.dist = Math.hypot(dx, dz) || 1; this.ndx = dx / this.dist; this.ndz = dz / this.dist;
  this.alt++;
  var atk = this.phase === 1 ? 'burst' : (this.phase === 2 ? (this.alt % 2 ? 'knife' : 'burst') : (this.alt % 2 ? 'dash' : 'knife'));
  if (atk === 'dash') {
    var len = Math.min(26, W.raycast(this.pos.x, 1, this.pos.z, this.ndx, 0, this.ndz, 26) - 1.2); if (len < 5) atk = 'knife';
    else { this.state = 'dashTel'; this.stateT = 0.85; this.cdx = this.ndx; this.cdz = this.ndz; this.dashLen = len;
      this.line = FX.groundLine(this.pos.x, this.pos.z, this.pos.x + this.cdx * len, this.pos.z + this.cdz * len, 2.6, 0.85 + len / 42, 0xff1808); A.play('charge', 0.9); A.play('warn'); return; }
  }
  this.next = atk; this.state = 'tel'; this.stateT = this.phase === 1 ? 0.7 : 0.6; A.playAt('beep', this.pos.x, this.pos.z, 1.5);
};
Phantom.prototype.update = function (dt) {
  if (this.done) return; this.common(dt);
  var P = JO.Player, c = this.cfg, target = 1, i;
  if (!this.alive) { this.dyingUpdate(dt); this.setOpacity(1, dt); return; }
  if (this.state === 'wait') { this.yaw = E.turnToward(this.yaw, Math.atan2(this.ndx, this.ndz), dt * 2); target = 0.5 + Math.sin(this.t * 3) * 0.3; }
  else if (P.dead) { target = 0.3; }
  else if (this.state === 'intro') { this.stateT -= dt; target = 1; if (this.stateT <= 0) { this.state = 'cloaked'; this.stateT = 0.8; } }
  else if (this.state === 'cloaked') {
    target = 0.07; this.stateT -= dt; E.moveToward(this, this.pos.x - this.ndz * 3, this.pos.z + this.ndx * 3, 2.2, dt);
    if (this.stateT <= 0) this.teleport();
  }
  else if (this.state === 'tel') { target = 0.5; this.tint = 0x226060; this.yaw = Math.atan2(this.ndx, this.ndz); this.stateT -= dt;
    if (this.stateT <= 0) {
      if (this.next === 'burst') { this.state = 'attack'; this.burst = 3; this.shotT = 0; }
      else { var d = Math.max(6, this.dist), T = d / 22, base0 = Math.atan2(this.ndx, this.ndz);     // fan of arcing knives
        for (i = -2; i <= 2; i++) { var a = base0 + i * 0.24, vx = Math.sin(a) * 22, vz = Math.cos(a) * 22, vy = (1.0 - 1.6 + 0.5 * 9 * T * T) / T, l = Math.sqrt(vx * vx + vy * vy + vz * vz);
          FX.bullet(this.pos.x + Math.sin(a) * 0.6, 1.6, this.pos.z + Math.cos(a) * 0.6, vx / l, vy / l, vz / l, l, c.knifeDmg, 0xd8ecff, 9, 1.5); }
        A.playAt('slash', this.pos.x, this.pos.z, 1.5); this.state = 'visible'; this.stateT = c.visibleTime; }
    } }
  else if (this.state === 'attack') { target = 0.8; this.yaw = Math.atan2(this.ndx, this.ndz); this.shotT -= dt;
    if (this.shotT <= 0) { E.fireBullet(this, 2.3, 48, c.burstDmg, 0x9af0ff, 1.5); A.playAt('enemyShot', this.pos.x, this.pos.z, 1.3); this.shotT = 0.14; this.burst--;
      if (this.burst <= 0) { this.state = 'visible'; this.stateT = c.visibleTime; } } }
  else if (this.state === 'visible') { target = 1; this.stateT -= dt; this.yaw = E.turnToward(this.yaw, Math.atan2(this.ndx, this.ndz), dt * 4);
    E.moveToward(this, this.pos.x - this.ndz * 3, this.pos.z + this.ndx * 3, 1.4, dt);
    if (this.stateT <= 0) { this.state = 'cloaked'; this.stateT = c.cloakTime * (this.phase === 1 ? 1 : 0.75); A.playAt('teleport', this.pos.x, this.pos.z, 0.5); } }
  else if (this.state === 'dashTel') { target = 0.75; this.tint = 0x881010; this.stateT -= dt; if (this.stateT <= 0) { this.state = 'dash'; this.stateT = this.dashLen / 42; this.hitDone = false; A.playAt('slash', this.pos.x, this.pos.z, 1.6); } }
  else if (this.state === 'dash') { target = 1; this.tint = 0x881010; this.pos.x += this.cdx * 42 * dt; this.pos.z += this.cdz * 42 * dt; W.clamp(this.pos, 0.6);
    FX.burst(this.pos.x, 1.1, this.pos.z, 2, 0xff5050, 2, 0.3, 0, 0.2);
    if (!this.hitDone && this.dist < 1.6 && P.pos.y < 2) { this.hitDone = true; P.damage(c.dashDmg, this.pos.x - this.cdx, this.pos.z - this.cdz, 'dash'); }
    this.stateT -= dt; if (this.stateT <= 0) { this.state = 'visible'; this.stateT = c.visibleTime + 0.4; } }
  if (this.phase >= 2 && this.alive && this.state !== 'wait') { this.droneT -= dt;                // drone escorts
    if (this.droneT <= 0) { this.droneT = 5; if (E.countType('drone') === 0 && E.count() <= CFG.MAX_ACTIVE - 2) { this.droneT = 28; A.play('warn'); JO.UI.banner('SCOUT DRONES DEPLOYED', 1.6, true);
      E.spawn('drone', -18, W.AC - 10, { alert: true, summoned: true }); E.spawn('drone', 18, W.AC + 10, { alert: true, summoned: true }); } } }
  this.setOpacity(target, dt);
  this.mesh.position.copy(this.pos); this.mesh.rotation.y = this.yaw; M.walk(this.model, this.walk, this.moving ? 1 : 0, false);
};
Phantom.prototype.setOpacity = function (target, dt) {
  this.opacity += (target - this.opacity) * Math.min(1, dt * 12);
  for (var i = 0; i < this.mats.length; i++) this.mats[i].opacity = this.opacity;
  this.wire.opacity = this.opacity > 0.9 ? 0 : (0.16 + 0.22 * Math.abs(Math.sin(this.t * 9)) + (Math.random() < 0.08 ? 0.3 : 0)) * (1 - this.opacity * 0.6);
};
Phantom.prototype.dispose = function () { proto.dispose.call(this); this.wire.dispose(); };
extend(Phantom);

/* ============================================================
   LEVEL 3 — THE COMMANDER (four-legged walker)
   ============================================================ */
function Commander(x, z) {
  base(this, 'commander', x, z); this.phases = 3; var g = this.mesh, c = this.cfg, i;
  var hull = mat(0x5a6052), dark = mat(0x24282a), trim = mat(0xc9a020), glass = mat(0x2a8090, 0x0a4048), red = mat(0xb02418);
  this.mats = [hull, dark, trim, glass, red];
  this.body = new THREE.Group(); g.add(this.body);
  part(G.box, hull, 3.4, 1.7, 4.4, 0, 3.3, 0, this.body); part(G.box, dark, 3.6, 0.3, 4.6, 0, 2.5, 0, this.body); part(G.box, trim, 3.45, 0.12, 4.45, 0, 4.1, 0, this.body);
  part(G.box, hull, 1.7, 0.9, 1.3, 0, 4.45, 1.0, this.body); part(G.box, glass, 1.4, 0.5, 0.1, 0, 4.5, 1.66, this.body);
  this.plates = [part(G.box, dark, 3.0, 1.5, 0.3, 0, 3.3, 2.3, this.body), part(G.box, dark, 0.3, 1.4, 3.6, -1.85, 3.3, 0, this.body), part(G.box, dark, 0.3, 1.4, 3.6, 1.85, 3.3, 0, this.body)];
  this.coreMat = basic(0xffb040, { fog: false }); this.core = new THREE.Mesh(G.ico, this.coreMat); this.core.scale.setScalar(1.7); this.core.position.set(0, 3.2, 2.2); this.core.visible = false; this.body.add(this.core);
  part(G.box, red, 0.9, 0.9, 1.5, -2.2, 4.3, -0.8, this.body); part(G.box, red, 0.9, 0.9, 1.5, 2.2, 4.3, -0.8, this.body);
  part(G.box, trim, 0.4, 0.3, 0.3, 0, 2.45, 2.35, this.body);
  this.turret = new THREE.Group(); this.turret.position.set(0, 4.95, -0.5); this.body.add(this.turret);
  part(G.box, dark, 1.3, 0.6, 1.5, 0, 0.15, 0, this.turret);
  part(G.cyl, dark, 0.2, 2.1, 0.2, -0.3, 0.15, 1.5, this.turret).rotation.x = Math.PI / 2; part(G.cyl, dark, 0.2, 2.1, 0.2, 0.3, 0.15, 1.5, this.turret).rotation.x = Math.PI / 2;
  this.legs = [];
  for (i = 0; i < 4; i++) { var sx = i % 2 ? 1 : -1, sz = i < 2 ? 1 : -1, leg = new THREE.Group(); leg.position.set(sx * 1.6, 2.7, sz * 1.6); g.add(leg);
    part(G.box, hull, 0.5, 1.5, 0.5, sx * 0.55, -0.35, 0, leg).rotation.z = sx * 0.95; part(G.box, dark, 0.44, 2.3, 0.44, sx * 1.15, -1.5, 0, leg);
    part(G.box, dark, 0.95, 0.25, 0.95, sx * 1.15, -2.58, 0, leg); this.legs.push(leg); }
  // world-space extras
  this.bubbleMat = basic(0x58e0ff, { transparent: true, opacity: 0.16, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  this.bubble = new THREE.Mesh(G.ico, this.bubbleMat); this.bubble.scale.set(11.5, 10, 11.5); E.scene.add(this.bubble);
  this.beamMat = basic(0xff2a10, { transparent: true, opacity: 0.9, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  this.beam = new THREE.Mesh(G.box, this.beamMat); this.beam.visible = false; this.beam.frustumCulled = false; E.scene.add(this.beam);
  this.spotMat = basic(0xfff0a0, { transparent: true, opacity: 0.35, depthWrite: false, fog: false });
  this.spot = new THREE.Mesh(G.disc, this.spotMat); this.spot.visible = false; E.scene.add(this.spot);
  this.coneMat = basic(0xfff0a0, { transparent: true, opacity: 0.12, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  this.cone = new THREE.Mesh(G.box, this.coneMat); this.cone.visible = false; this.cone.frustumCulled = false; E.scene.add(this.cone);
  this.extra = [this.bubble, this.beam, this.spot, this.cone];
  this.corePart = { k: 's', oz: 2.55, oy: 3.2, r: 1.0, tag: 'core', mult: c.coreMult, bias: 0.8, off: true };
  this.parts = [{ k: 'c', y0: 0, y1: 2.4, r: 2.2, tag: 'armor', mult: c.armorMult * 0.75 }, { k: 'c', y0: 2.4, y1: 4.5, r: 2.55, tag: 'armor', mult: c.armorMult },
    { k: 's', oy: 5.1, r: 1.0, tag: 'armor', mult: c.armorMult }, this.corePart];
  this.bound = 7; this.boundY = 3; this.radius = 2.6; this.spark = 0xffd070; this.tyaw = 0; this.shieldDownT = 0; this.beamCd = 0; this.sx = 0; this.sz = 0; this.markT = 0; this.second = 0; this.launched = 0; this.yaw = 0; this.immuneT = 0;
  attach(this, 'commander');
}
Commander.prototype.aimPoint = function (o) {
  if (this.phase === 3) { o.x = this.pos.x + Math.sin(this.yaw) * 2.6; o.y = 3.2; o.z = this.pos.z + Math.cos(this.yaw) * 2.6; } else { o.x = this.pos.x; o.y = 3.4; o.z = this.pos.z; }
};
Commander.prototype.shieldUp = function () { return this.phase === 1 && this.shieldDownT <= 0 && this.alive && this.state !== 'wait'; };
Commander.prototype.takeHit = function (dmg, p) {
  R.dealt = 0; R.blocked = false; R.head = false; R.crit = false; R.killed = false; R.silent = false;
  if (this.invulnerable()) { R.blocked = true; R.silent = true; return R; }
  if (this.immuneT > 0) { R.blocked = true; R.silent = true; return R; }
  var m = p.mult; if (this.shieldUp()) { m = this.cfg.shieldMult; this.bubbleMat.opacity = 0.5; } else if (p.tag === 'core') R.crit = true;
  this.hurt(dmg * m); if (!this.alive) return R;
  if (this.phase === 1 && this.hp < this.maxHp * 0.66) { this.setPhase(2, 'SHIELD GENERATOR DESTROYED'); this.bubble.visible = false; this.interrupt(); }
  else if (this.phase === 2 && this.hp < this.maxHp * 0.33) { this.setPhase(3, 'ARMOR BREACHED — SHOOT THE CORE');
    for (var i = 0; i < this.plates.length; i++) this.plates[i].visible = false; this.core.visible = true; this.corePart.off = false; this.interrupt();
    FX.explosion(this.pos.x + Math.sin(this.yaw) * 2.5, 3.2, this.pos.z + Math.cos(this.yaw) * 2.5, 3); FX.burst(this.pos.x, 3.3, this.pos.z, 30, 0x30342e, 10, 1.2, 12, 0.4, 4); }
  return R;
};
Commander.prototype.interrupt = function () { this.state = 'idle'; this.atkT = 1.0; this.immuneT = 1.0; this.beam.visible = this.spot.visible = this.cone.visible = false; if (this.line) this.line.life = 0.01; };
Commander.prototype.dieStart = function () { this.beam.visible = this.spot.visible = this.cone.visible = this.bubble.visible = false; };
Commander.prototype.update = function (dt) {
  if (this.done) return; this.common(dt);
  var P = JO.Player, c = this.cfg, g = this.mesh, ph = this.phase, lift = 0, bearing = Math.atan2(this.ndx, this.ndz), i, rooted = false;
  if (!this.alive) { this.dyingUpdate(dt); return; }
  if (this.beamCd > 0) this.beamCd -= dt;
  if (this.immuneT > 0) this.immuneT -= dt;
  if (this.shieldDownT > 0) this.shieldDownT -= dt;
  var st = this.state;
  if (st === 'wait') { this.tyaw = this.yaw + Math.sin(this.t * 0.6) * 0.8; }
  else if (P.dead) { this.beam.visible = this.spot.visible = this.cone.visible = false; }
  else if (st === 'intro') { this.stateT -= dt; lift = Math.sin(this.t * 10) * 0.08; this.tyaw = E.turnToward(this.tyaw, bearing, dt * 2); if (this.stateT <= 0) { this.state = 'idle'; this.atkT = 1.2; } }
  else if (st === 'idle') {
    this.tyaw = E.turnToward(this.tyaw, bearing, dt * 2.5); this.atkT -= dt;
    if (this.atkT <= 0) {
      var cyc = ph === 1 ? ['mg', 'miss'] : (ph === 2 ? ['stomp', 'search', 'mg', 'miss'] : ['laser', 'miss', 'stomp', 'mg']), a = cyc[this.atkI++ % cyc.length];
      this.sdir = Math.random() < 0.5 ? -1 : 1;
      if (a === 'mg') { this.state = 'mgTel'; this.stateT = 0.75; A.play('spinup'); A.play('beep');
        var ya = bearing - this.sdir * 0.55; this.line = FX.groundLine(this.pos.x, this.pos.z, this.pos.x + Math.sin(ya) * (this.dist + 6), this.pos.z + Math.cos(ya) * (this.dist + 6), 0.6, 0.75, 0xff5020); }
      else if (a === 'miss') { this.state = 'missTel'; this.stateT = 0.85; A.play('warn'); }
      else if (a === 'stomp') { this.state = 'stompTel'; this.stateT = 0.85; this.second = ph === 3 ? 1 : 0; A.play('windup', 1.6); A.play('beep'); }
      else if (a === 'search') { this.state = 'search'; this.stateT = 5.5; this.markT = 0; this.sx = this.pos.x + Math.sin(this.yaw) * 9; this.sz = this.pos.z + Math.cos(this.yaw) * 9; A.play('beep'); JO.UI.banner('SEARCHLIGHT — STAY OUT OF THE BEAM', 1.8, true); }
      else { this.state = 'laserTel'; this.stateT = 1.15; this.lang = bearing - this.sdir * 1.05; A.play('charge'); A.play('warn'); }
    }
  }
  else if (st === 'mgTel') { rooted = true; this.stateT -= dt; this.tyaw = E.turnToward(this.tyaw, bearing - this.sdir * 0.55, dt * 6); if (this.stateT <= 0) { this.state = 'mg'; this.stateT = c.mgTime; this.byaw = bearing; this.shotT = 0; } }
  else if (st === 'mg') {
    this.stateT -= dt; var k = 1 - this.stateT / c.mgTime; this.byaw = E.turnToward(this.byaw, bearing, dt * 0.6); this.tyaw = this.byaw + this.sdir * (k * 2 - 1) * 0.55; this.shotT -= dt;
    while (this.shotT <= 0) { this.shotT += c.mgRate; var sx = Math.sin(this.tyaw), cz = Math.cos(this.tyaw);
      shoot(this.pos.x + sx * 2.2, 5.0, this.pos.z + cz * 2.2, this.tyaw, this.dist - 2, 1.2, 42, c.mgDmg, 0xffb040); FX.burst(this.pos.x + sx * 2.4, 5.0, this.pos.z + cz * 2.4, 1, 0xffd060, 2, 0.07, 0, 0.22); A.play('minigun'); }
    if (this.stateT <= 0) { this.state = 'idle'; this.atkT = ph === 3 ? 0.7 : 1.1; }
  }
  else if (st === 'missTel') { rooted = true; this.stateT -= dt; this.tint = 0x551000; if (this.stateT <= 0) { this.state = 'miss'; this.launched = 0; this.shotT = 0; } }
  else if (st === 'miss') { rooted = true; this.shotT -= dt;
    if (this.shotT <= 0) { this.shotT = 0.3; var side = this.launched % 2 ? 1 : -1, sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
      H.missile(this.pos.x + cy * side * 2.2 - sy * 0.8, 4.9, this.pos.z - sy * side * 2.2 - cy * 0.8, sy * 0.25 + cy * side * 0.25, 0.93, cy * 0.25 - sy * side * 0.25, c.missileSpeed * (ph === 3 ? 1.12 : 1), c.missileTurn, c.missileDmg);
      this.launched++;
      if (this.launched >= (ph === 3 ? 4 : 3)) { this.state = 'idle'; this.atkT = ph === 1 ? 2.2 : 1.2;
        if (ph === 1) { this.shieldDownT = c.shieldDown; JO.UI.banner('SHIELD DOWN — OPEN FIRE', 1.8, false); A.play('gate', 0.7); } } } }
  else if (st === 'stompTel') { rooted = true; this.stateT -= dt; this.tint = 0x554400; lift = (0.85 - this.stateT) * 1.3;
    if (this.stateT <= 0) { H.shockwave(this.pos.x, this.pos.z, 15, 38, c.stompDmg, 0xffb030); A.play('stomp'); FX.addShake(0.8); FX.burst(this.pos.x, 0.3, this.pos.z, 30, 0x8a7a66, 9, 0.7, 9, 0.28, 2);
      if (this.second > 0) { this.second--; this.stateT = 0.7; A.play('beep'); } else { this.state = 'idle'; this.atkT = ph === 3 ? 0.7 : 1.2; } } }
  else if (st === 'search') {
    this.stateT -= dt; var dx = P.pos.x - this.sx, dz = P.pos.z - this.sz, d = Math.hypot(dx, dz), spd = 6.8 * dt;
    if (d > 0.05) { this.sx += dx / d * Math.min(d, spd); this.sz += dz / d * Math.min(d, spd); }
    this.tyaw = E.turnToward(this.tyaw, Math.atan2(this.sx - this.pos.x, this.sz - this.pos.z), dt * 4);
    if (d < 3.2) { this.markT += dt; this.tickT = (this.tickT || 0) - dt; if (this.tickT <= 0) { this.tickT = 0.16; A.play('beep', 0.8); } } else this.markT = Math.max(0, this.markT - dt * 0.6);
    var lit = this.markT / 0.9; this.spotMat.color.setRGB(1, 0.94 - lit * 0.7, 0.63 - lit * 0.55); this.coneMat.color.copy(this.spotMat.color);
    this.spot.visible = this.cone.visible = true; this.spot.position.set(this.sx, 0.08, this.sz); this.spot.scale.set(3.2, 1, 3.2);
    var lx = this.pos.x + Math.sin(this.yaw) * 2.3, lz = this.pos.z + Math.cos(this.yaw) * 2.3, cl = Math.hypot(this.sx - lx, 2.4, this.sz - lz);
    this.cone.position.set((lx + this.sx) / 2, 1.2, (lz + this.sz) / 2); this.cone.lookAt(this.sx, 0, this.sz); this.cone.scale.set(1.6, 1.6, cl);
    if (this.markT >= 0.9 || this.stateT <= 0) {
      if (this.markT >= 0.9) { JO.UI.banner('MARKED — MORTARS INBOUND', 2, true); A.play('warn');
        for (i = 0; i < 6; i++) { var ra = Math.random() * 6.28, rr = i === 0 ? 0 : 2 + Math.random() * 4.5; H.mortar(this.sx + Math.cos(ra) * rr, this.sz + Math.sin(ra) * rr, 1.5 + i * 0.24, c.mortarRadius, c.mortarDmg); } }
      this.spot.visible = this.cone.visible = false; this.state = 'idle'; this.atkT = 1.3; }
  }
  else if (st === 'laserTel' || st === 'laser') {
    rooted = true; this.stateT -= dt; var firing = st === 'laser';
    if (firing) this.lang += this.sdir * 1.15 * dt;
    this.tyaw = this.lang; var ldx = Math.sin(this.lang), ldz = Math.cos(this.lang), ox = this.pos.x + ldx * 2.7, oz = this.pos.z + ldz * 2.7;
    var len = W.raycast(ox, 0.65, oz, ldx, 0, ldz, 46), w = firing ? 0.32 + Math.sin(this.t * 40) * 0.06 : 0.06;
    this.beam.visible = true; this.beam.position.set(ox + ldx * len / 2, 0.65, oz + ldz * len / 2); this.beam.rotation.y = this.lang; this.beam.scale.set(w, w, len); this.beamMat.opacity = firing ? 0.95 : 0.5;
    if (firing) { FX.burst(ox + ldx * len, 0.65, oz + ldz * len, 2, 0xff6030, 4, 0.25, 6, 0.14);
      var px = P.pos.x - ox, pz = P.pos.z - oz, s = px * ldx + pz * ldz;
      if (s > -0.3 && s < len + 0.3 && Math.abs(px * ldz - pz * ldx) < 0.75 && P.pos.y < 0.85 && this.beamCd <= 0) { if (P.damage(c.laserDmg, this.pos.x, this.pos.z, 'laser')) this.beamCd = 0.7; } }
    if (this.stateT <= 0) { if (!firing) { this.state = 'laser'; this.stateT = 2.1 / 1.15; A.play('sniperShot', 0.8); } else { this.beam.visible = false; this.state = 'idle'; this.atkT = 0.9; } }
  }
  // locomotion: keep mid range, stay near the courtyard centre
  if (this.state !== 'wait' && !P.dead) {
    this.yaw = E.turnToward(this.yaw, bearing, c.turn * (ph === 3 ? 1.6 : 1) * dt);
    if (!rooted) { var sp = c.walk * (ph === 3 ? 2 : 1), mv = this.dist > 18 ? 1 : (this.dist < 11 ? -1 : 0);
      if (mv) { this.pos.x += this.ndx * mv * sp * dt; this.pos.z += this.ndz * mv * sp * dt; this.walk += sp * dt * 1.4; this.moving = true;
        var cx = this.pos.x, cz2 = this.pos.z - W.AC, cd = Math.hypot(cx, cz2); if (cd > 9) { this.pos.x = cx / cd * 9; this.pos.z = W.AC + cz2 / cd * 9; } } }
  }
  // pose
  g.position.set(this.pos.x, 0, this.pos.z); g.rotation.y = this.yaw; this.body.position.y = lift + Math.sin(this.walk * 2) * 0.06; this.turret.rotation.y = this.tyaw - this.yaw;
  for (i = 0; i < 4; i++) { var lp = Math.sin(this.walk + (i === 0 || i === 3 ? 0 : Math.PI)); this.legs[i].rotation.x = this.moving ? lp * 0.22 : 0; this.legs[i].position.y = 2.7 + (this.moving && lp > 0 ? lp * 0.25 : 0) + (lift > 0 && i < 2 ? lift * 0.5 : 0); }
  var up = this.shieldUp(); this.bubble.visible = up && this.phase === 1;
  if (up) { this.bubble.position.set(this.pos.x, 3, this.pos.z); this.bubble.rotation.y += dt * 0.4; this.bubbleMat.opacity += (0.15 + Math.sin(this.t * 3) * 0.04 - this.bubbleMat.opacity) * Math.min(1, dt * 6); }
  if (this.core.visible) { var pu = 0.8 + Math.sin(this.t * 9) * 0.2; this.coreMat.color.setRGB(1, 0.55 * pu + 0.2, 0.15 * pu); this.core.scale.setScalar(1.6 + pu * 0.2); }
};
extend(Commander);

B.create = function (kind) {
  var b = kind === 'brute' ? new Brute(0, W.AC - 8) : (kind === 'phantom' ? new Phantom(0, W.AC - 6) : new Commander(0, W.AC - 4));
  b.mesh.position.copy(b.pos); E.list.push(b); return b;
};
})();
