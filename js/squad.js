/* ============================================================
   JUNGLE OUTPOST — squad.js
   Enemies as people on a shift, not targets on a rail.
     - off duty: patrols stand post, chat in pairs, sit, smoke
       or check their weapons; the relaxed ones notice less
     - investigate: a sound, a broken lamp or a body sends the
       nearest patrol to look, walk over, search and walk back
       (look -> go -> search -> back); finding a body raises
       the alarm
     - lamps and lanterns: lit lamps along the trail and
       lanterns carried at night make whoever stands in the
       light easy to see. Shoot them out (Sq.shotRay)
     - morale: watching friends die wears a squad down. Shaken
       men fall back; the last ones may throw their weapons
       down and surrender. Walk away and they run; that counts
       as mercy
     - flashlight (L): lights your way and gives you away
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, W = JO.World, E = JO.Enemies, FX = JO.FX, A = JO.Audio, Q = JO.Q, Ev = JO.Events;
var Sq = JO.Squad = { lamps: [], lanterns: 0, light: false, broken: 0, surrenders: 0, spared: 0, executed: 0, retreats: 0, invs: 0, found: 0 };
var scene, d = new THREE.Object3D(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0), col = new THREE.Color();
var MAXL = 10, MAXC = 6, postMesh, bulbMesh, glowMesh, carryMesh, spot, lvl = 0, tick = 0;
function rand(a, b) { return a + Math.random() * (b - a); }
function dark() { var Wx = JO.Weather, h = Wx ? Wx.hour : 12; return h < 6.4 || h > 17.8 ? 1 : (h < 7.6 ? (7.6 - h) / 1.2 : (h > 16.6 ? (h - 16.6) / 1.2 : 0)); }
Sq.dark = dark;

/* ---------- lamps ---------- */
function buildMeshes() {
  postMesh = new THREE.InstancedMesh(Q.merge([Q.box(0.1, 3, 0.1, 0, 1.5, 0), Q.box(0.7, 0.08, 0.08, 0.3, 2.95, 0), Q.box(0.04, 0.3, 0.04, 0.6, 2.78, 0)]), new THREE.MeshLambertMaterial({ color: 0x3a342c }), MAXL);
  bulbMesh = new THREE.InstancedMesh(Q.box(0.24, 0.3, 0.24, 0.6, 2.5, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }), MAXL);
  var gg = new THREE.CircleGeometry(1, 20); gg.rotateX(-Math.PI / 2);
  glowMesh = new THREE.InstancedMesh(gg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }), MAXL);
  carryMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.22, 0.16), new THREE.MeshBasicMaterial({ color: 0xffc060, fog: false }), MAXC);
  [postMesh, bulbMesh, glowMesh, carryMesh].forEach(function (m) { m.frustumCulled = false; for (var i = 0; i < m.count; i++) { m.setMatrixAt(i, ZERO); m.setColorAt(i, col.setHex(0x000000)); } m.instanceMatrix.needsUpdate = true; scene.add(m); });
  glowMesh.renderOrder = 3;
  spot = new THREE.SpotLight(0xfff0d0, 0, 26, 0.5, 0.5, 1.2); scene.add(spot); scene.add(spot.target);
}
function free(x, z) { var cs = W.colliders; for (var i = 0; i < cs.length; i++) { var c = cs[i]; if (x > c.minx - 0.6 && x < c.maxx + 0.6 && z > c.minz - 0.6 && z < c.maxz + 0.6) return false; } return true; }
function placeLamps(L) {
  Sq.lamps.length = 0; W.lamps.length = 0; var i, n = 0;
  for (i = 0; i < MAXL; i++) { postMesh.setMatrixAt(i, ZERO); bulbMesh.setMatrixAt(i, ZERO); glowMesh.setMatrixAt(i, ZERO); }
  // one at the start and middle of every combat zone, alternating sides of the trail
  L.zones.forEach(function (zn, k) { [zn.z0 - 5, (zn.z0 + zn.z1) / 2].forEach(function (z, j) {
    if (n >= MAXL) return; var side = (k + j) % 2 ? 1 : -1, x = side * 5.2, tries = 0; while (!free(x, z) && tries++ < 6) z -= 1.7; if (!free(x, z)) return;
    var lamp = { i: n, x: x + (side > 0 ? -0.6 : 0.6), y: 2.5, z: z, px: x, lit: true, on: 0, hp: 1, r: 8.5 }; Sq.lamps.push(lamp); W.lamps.push(lamp);
    d.position.set(x, 0, z); d.rotation.set(0, side > 0 ? Math.PI : 0, 0); d.scale.set(1, 1, 1); d.updateMatrix(); postMesh.setMatrixAt(n, d.matrix); bulbMesh.setMatrixAt(n, d.matrix);
    d.position.set(lamp.x, 0.07, z); d.rotation.set(0, 0, 0); d.scale.set(4.2, 1, 4.2); d.updateMatrix(); glowMesh.setMatrixAt(n, d.matrix);
    postMesh.setColorAt(n, col.setHex(0xffffff)); W.addBox(x, z, 0.12, 0.12, 3, { mat: 'metal' }); n++; }); });
  postMesh.instanceMatrix.needsUpdate = bulbMesh.instanceMatrix.needsUpdate = glowMesh.instanceMatrix.needsUpdate = true; postMesh.instanceColor.needsUpdate = true;
}
Sq.breakLantern = function (lamp, quiet) {
  if (!lamp.lit) return false; lamp.lit = false; Sq.broken++;
  FX.burst(lamp.x, lamp.y, lamp.z, 10, 0xffd080, 4, 0.35, 9, 0.09); if (JO.Phys) JO.Phys.bits(lamp.x, lamp.y, lamp.z, 6, 0xc8d8d0, 3, { size: 0.04 }); A.playAt('clang', lamp.x, lamp.z, 1.2);
  if (!quiet) { var near = nearestPatrols(lamp.x, lamp.z, 22, 2); for (var i = 0; i < near.length; i++) Sq.investigate(near[i], lamp.px, lamp.z, 'lamp'); Ev.emit('lamp_out', lamp); }
  return true;
};
// a player shot along this ray: did it take out a lamp or a carried lantern?
Sq.shotRay = function (ox, oy, oz, dx, dy, dz, max) {
  var i, hit = false;
  for (i = 0; i < Sq.lamps.length; i++) { var l = Sq.lamps[i]; if (!l.lit) continue; var px = l.x - ox, py = l.y - oy, pz = l.z - oz, s = px * dx + py * dy + pz * dz; if (s < 0 || s > max + 0.3) continue;
    var qx = px - dx * s, qy = py - dy * s, qz = pz - dz * s; if (qx * qx + qy * qy + qz * qz < 0.2) { Sq.breakLantern(l); hit = true; } }
  var L = E.list; for (i = 0; i < L.length; i++) { var e = L[i]; if (!e.lantern || !e.alive) continue; px = e.lx - ox; py = e.ly - oy; pz = e.lz - oz; s = px * dx + py * dy + pz * dz; if (s < 0 || s > max + 0.3) continue;
    qx = px - dx * s; qy = py - dy * s; qz = pz - dz * s; if (qx * qx + qy * qy + qz * qz < 0.12) { e.lantern = false; Sq.broken++; FX.burst(e.lx, e.ly, e.lz, 8, 0xffd080, 4, 0.3, 9, 0.08); A.playAt('clang', e.lx, e.lz, 1); e.alerted = true; hit = true; } }
  return hit;
};
// how exposed is the player right now? >1 easier to see, <1 harder. Used by stealth.js for every watcher.
Sq.exposure = function () { return Sq.expo; };
function computeExposure() {
  var P = JO.Player, dk = dark(), k = 1, lit = false, i;
  if (dk > 0.3) { for (i = 0; i < Sq.lamps.length; i++) { var l = Sq.lamps[i]; if (l.lit && Math.hypot(l.x - P.pos.x, l.z - P.pos.z) < l.r * 0.8) { lit = true; break; } }
    if (!lit) { var L = E.list; for (i = 0; i < L.length; i++) if (L[i].lantern && L[i].alive && L[i].dist < 6.5) { lit = true; break; } }
    k = lit ? 1 + 0.5 * dk : 1 - 0.22 * dk; }
  if (Sq.light) k *= 1.3 + 0.6 * dk;
  Sq.lit = lit; Sq.expo = k;
}

/* ---------- investigate ---------- */
function nearestPatrols(x, z, r, n) {
  var out = [], L = E.list; for (var i = 0; i < L.length; i++) { var e = L[i]; if (e.isBoss || !e.alive || e.state !== 'patrol' || e.type === 'sniper' || e.type === 'drone') continue; var dd = Math.hypot(e.pos.x - x, e.pos.z - z); if (dd < r) out.push([dd, e]); }
  out.sort(function (a, b) { return a[0] - b[0]; }); return out.slice(0, n).map(function (o) { return o[1]; });
}
Sq.investigate = function (e, x, z, why) {
  if (!e.alive || e.state !== 'patrol' || e.type === 'sniper' || e.type === 'drone') return false;
  if (e.inv && e.inv.why === 'body' && why !== 'body') return false;                    // a body outranks a noise
  if (e.inv && e.inv.phase !== 'back' && why === e.inv.why && Math.hypot(e.inv.x - x, e.inv.z - z) < 4) { e.inv.x = x; e.inv.z = z; return false; }
  var hw = W.halfWidth(z) - 1; e.inv = { phase: 'look', t: why === 'body' ? 0.5 : 1.1, x: Math.max(-hw, Math.min(hw, x)), z: z, why: why, total: 0 }; Sq.invs++;
  JO.UI.dmgNum(e.pos.x, e.pos.y + 2.3, e.pos.z, '?', 'blk'); if (JO.Story && JO.Story.bark) JO.Story.bark(why === 'body' ? 'body' : 'investigate', e); Ev.emit('investigate', e, why);
  return true;
};
function runInvestigation(e, dt) {
  var v = e.inv, dx = v.x - e.pos.x, dz = v.z - e.pos.z, dd = Math.hypot(dx, dz); v.total += dt;
  if (v.phase === 'look') { e.yaw = E.turnToward(e.yaw, Math.atan2(dx, dz), dt * 4); v.t -= dt; if (v.t <= 0) { v.phase = 'go'; v.t = 9; } }
  else if (v.phase === 'go') { v.t -= dt; E.moveToward(e, v.x, v.z, v.why === 'body' ? 2.6 : 1.7, dt); e.yaw = E.turnToward(e.yaw, Math.atan2(dx, dz), dt * 5);
    if (dd < 1.6 || v.t <= 0) { v.phase = 'search'; v.t = v.why === 'body' ? 1.2 : 3.2; v.y0 = e.yaw;
      if (v.why === 'body') { Sq.found++; e.alerted = true; E.alertNear(e.pos.x, e.pos.z, 18); A.playAt('alert', e.pos.x, e.pos.z, 1.5); Ev.emit('body_found', e); } } }
  else if (v.phase === 'search') { v.t -= dt; e.yaw = v.y0 + Math.sin((3.2 - v.t) * 2.1) * 1.3; if (v.t <= 0) { v.phase = 'back'; v.t = 10; } }
  else { v.t -= dt; var hd = E.moveToward(e, e.homeX, e.homeZ, 1.3, dt); e.yaw = E.turnToward(e.yaw, Math.atan2(e.homeX - e.pos.x, e.homeZ - e.pos.z), dt * 4); if (hd < 0.6 || v.t <= 0) e.inv = null; }
}

/* ---------- off duty ---------- */
// what a relaxed man does, and how much of the world he notices while doing it
var ACTS = Sq.ACTS = { watch: 1, post: 1.15, chat: 0.72, sit: 0.6, smoke: 0.82, check: 0.9 };
function assign(e) {
  e.actInit = true; e.act = 'watch'; e.actK = 1; e.actT = rand(1, 5); e.mate = null; e.morale = 1; e.surrendered = false; e.fleeT = 0; e.inv = null; e.lantern = false; e.seenBody = null;
  if (e.type === 'sniper' || e.type === 'drone' || e.summoned || e.alerted) return;
  if (e.type !== 'runner') {
    var r = Math.random(), L = E.list, i;
    if (r < 0.2) { for (i = 0; i < L.length; i++) { var o = L[i]; if (o !== e && o.alive && !o.isBoss && o.actInit && !o.mate && o.state === 'patrol' && o.act !== 'chat' && o.type !== 'sniper' && o.type !== 'drone' && Math.hypot(o.homeX - e.homeX, o.homeZ - e.homeZ) < 20) { e.act = o.act = 'chat'; e.mate = o; o.mate = e; o.actK = ACTS.chat;
        e.homeX = o.homeX + (o.homeX > 0 ? -1.7 : 1.7); e.homeZ = o.homeZ + 0.6; e.pos.x = e.homeX; e.pos.z = e.homeZ; break; } } }
    if (e.act === 'watch') e.act = r < 0.45 ? 'post' : (r < 0.6 ? 'sit' : (r < 0.75 ? 'smoke' : (r < 0.86 ? 'check' : 'watch')));
    e.actK = ACTS[e.act];
  }
  // after dark some of them carry a lantern
  if (dark() > 0.5 && Sq.lanterns < Q.n('lanterns') && e.type !== 'runner' && e.act !== 'sit' && Math.random() < 0.5) { e.lantern = true; Sq.lanterns++; }
}
// called from the patrol state. Returns true when this module moved him.
Sq.idle = function (e, dt) {
  if (!e.actInit) assign(e);
  if (e.inv) { runInvestigation(e, dt); return true; }
  var a = e.act; if (a === 'watch') return false;
  if (Math.hypot(e.pos.x - e.homeX, e.pos.z - e.homeZ) > 0.8) { E.moveToward(e, e.homeX, e.homeZ, 1.2, dt); e.yaw = E.turnToward(e.yaw, Math.atan2(e.homeX - e.pos.x, e.homeZ - e.pos.z), dt * 4); return true; }
  e.actT -= dt;
  if (a === 'post') e.yaw = E.turnToward(e.yaw, Math.sin(e.t * 0.35 + e.ph) * 0.9, dt * 1.2);                      // faces up the trail, scanning
  else if (a === 'chat') { var m = e.mate; if (!m || !m.alive || m.state !== 'patrol') { e.act = 'post'; e.actK = ACTS.post; e.mate = null; return true; }
    e.yaw = E.turnToward(e.yaw, Math.atan2(m.pos.x - e.pos.x, m.pos.z - e.pos.z), dt * 3);
    if (e.actT <= 0) { e.actT = rand(4, 9); if (e.dist < 30) JO.UI.dmgNum(e.pos.x, e.pos.y + 2.2, e.pos.z, CHAT[(Math.random() * CHAT.length) | 0], 'bark'); if (e.gfx) e.gfx.playOnce('hit', { timeScale: 0.6 }); } }
  else if (a === 'smoke') { e.yaw += Math.sin(e.t * 0.3 + e.ph) * dt * 0.2; if (e.actT <= 0) { e.actT = rand(3, 6); FX.burst(e.pos.x + Math.sin(e.yaw) * 0.3, e.pos.y + 1.75, e.pos.z + Math.cos(e.yaw) * 0.3, 2, 0xb8b8b0, 0.3, 1.4, -0.6, 0.16, 0.2); } }
  else if (a === 'check') { if (e.actT <= 0) { e.actT = rand(5, 9); if (e.gfx) e.gfx.playOnce('reload'); A.playAt('reload', e.pos.x, e.pos.z, 0.5); } }
  return true;
};
var CHAT = ['...', 'heh.', 'quiet tonight.', 'you hear that?', 'two more days.', 'pass it over.', 'she is still up there.', 'not our problem.'];

/* ---------- morale ---------- */
function allies(e, r) { var n = 0, L = E.list; for (var i = 0; i < L.length; i++) { var o = L[i]; if (o !== e && o.alive && !o.isBoss && !o.surrendered && Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < r) n++; } return n; }
function startSurrender(e) {
  e.state = 'surrender'; e.sub = ''; e.surrendered = true; e.surT = 0; e.burst = 0; e.fleeT = 0; e.lantern = false; Sq.surrenders++; if (e.hideLaser) e.hideLaser(); if (e.gun) e.gun.root.visible = false;
  JO.UI.dmgNum(e.pos.x, e.pos.y + 2.3, e.pos.z, 'SURRENDERS', 'head'); if (JO.Story && JO.Story.bark) JO.Story.bark('surrender', e); A.playAt('swap', e.pos.x, e.pos.z, 1.2);
  if (JO.Phys) JO.Phys.bits(e.pos.x + e.ndx * 0.5, 1, e.pos.z + e.ndz * 0.5, 1, 0x2a2a2a, 1.5, { size: 0.09, sz: 6, life: 6 }); Ev.emit('surrender', e);
}
// a surrendered man: hands up, then runs if you leave him be
Sq.surrender = function (e, dt) {
  e.surT += dt; var m = e.model, away = Math.atan2(-e.ndx, -e.ndz);
  if (e.surT < 4.5 && e.dist < 26) { e.yaw = E.turnToward(e.yaw, Math.atan2(e.ndx, e.ndz), dt * 5); e.mesh.scale.y = 0.78; if (m.armR) { m.armR.rotation.x = -3; if (m.armL) m.armL.rotation.x = -3; } }
  else { e.mesh.scale.y = 1; var side = e.pos.x >= 0 ? 1 : -1; E.moveToward(e, side * (W.halfWidth(e.pos.z) - 0.6), e.pos.z + 6, 5.2, dt); e.yaw = E.turnToward(e.yaw, away, dt * 6);
    if (e.surT > 9 || e.dist > 34 || Math.abs(e.pos.x) > W.halfWidth(e.pos.z) - 1.6) { var G = JO.Game; G.run.knockouts = (G.run.knockouts || 0) + 1; G.run.mercy = (G.run.mercy || 0) + 0.25; Sq.spared++;
      FX.burst(e.pos.x, 1, e.pos.z, 6, 0x3f8f3a, 2, 0.4, 2, 0.14); Ev.emit('surrender_spared', e); e.alive = false; e.mesh.scale.y = 1; E.release(e); } }
};
// a shaken man backing off: he runs from you for a few seconds and then the normal AI has him again
Sq.flee = function (e, dt) {
  e.fleeT -= dt; if (e.hideLaser) e.hideLaser(); e.burst = 0;
  E.moveToward(e, e.pos.x - e.ndx * 6 + e.ndz * e.patDir * 2, e.pos.z - e.ndz * 6, e.cfg.speed ? e.cfg.speed * 1.35 : 4, dt); e.yaw = E.turnToward(e.yaw, Math.atan2(-e.ndx, -e.ndz), dt * 8);
};
function moraleStep(dt) {
  var L = E.list, G = JO.Game, i;
  for (i = L.length - 1; i >= 0; i--) { var e = L[i]; if (e.isBoss || !e.alive || !e.actInit) continue;
    if (e.morale < 1) e.morale = Math.min(1, e.morale + dt * 0.03);
    if (e.state !== 'attack' || e.summoned || G.bossFight || G.mode === 'survival' || e.type === 'runner' || e.type === 'drone' || e.type === 'sniper') continue;
    if (e.morale < 0.22 && allies(e, 24) <= 2 && e.pos.y < 0.5) { startSurrender(e); continue; }                     // surrender is checked before retreat
    if (e.morale < 0.36 && !e.broke && !(e.fleeT > 0)) { e.broke = true; e.fleeT = 3.2; e.sub = ''; Sq.retreats++; Ev.emit('enemy_retreat', e); } }
}

/* ---------- carried lanterns, body sightings ---------- */
function bodyWatch() {
  var L = E.list, i, j;
  for (i = 0; i < L.length; i++) { var b = L[i]; if (!b.rag || b.cull > 0 || !b.landed || b.found) continue;
    for (j = 0; j < L.length; j++) { var e = L[j]; if (e.isBoss || !e.alive || e.state !== 'patrol' || e.type === 'drone' || (e.inv && e.inv.why === 'body')) continue;
      var dx = b.pos.x - e.pos.x, dz = b.pos.z - e.pos.z, dd = Math.hypot(dx, dz); if (dd > 13 || dd < 0.01) continue;
      if ((Math.sin(e.yaw) * dx + Math.cos(e.yaw) * dz) / dd < 0.25) continue;                                           // not looking that way
      if (W.raycast(e.pos.x, e.pos.y + 1.5, e.pos.z, dx / dd, -1.2 / Math.max(1.5, dd), dz / dd, dd) < dd - 0.8) continue;
      if (e.type === 'sniper') { b.found = true; e.alerted = true; E.alertNear(e.pos.x, e.pos.z, 20); Sq.found++; }
      else if (Sq.investigate(e, b.pos.x, b.pos.z, 'body')) b.found = true; } }
}
var HAND = new THREE.Vector3();
function lanternFrame(t) {
  var L = E.list, n = 0, i, dk = dark();
  for (i = 0; i < L.length && n < MAXC; i++) { var e = L[i]; if (!e.lantern) continue; if (!e.alive) { e.lantern = false; continue; }
    var sy = Math.sin(e.yaw), cy = Math.cos(e.yaw); e.lx = e.pos.x - cy * 0.42 + sy * 0.25; e.ly = e.pos.y + 0.95 + Math.sin(e.walk * 2) * 0.03; e.lz = e.pos.z + sy * 0.42 + cy * 0.25;
    d.position.set(e.lx, e.ly, e.lz); d.rotation.set(0, e.yaw, Math.sin(e.walk) * 0.2); d.scale.set(1, 1, 1); d.updateMatrix(); carryMesh.setMatrixAt(n, d.matrix);
    var fl = 0.85 + Math.sin(t * 13 + i) * 0.08; carryMesh.setColorAt(n, col.setRGB(fl, fl * 0.72, fl * 0.3)); JO.Lights.add('c' + i, e.lx, e.ly + 0.2, e.lz, 0xffb050, 1.5 * (0.35 + 0.65 * dk) * fl, 9, 1.2); n++; }
  Sq.lanterns = n; for (i = n; i < MAXC; i++) carryMesh.setMatrixAt(i, ZERO);
  carryMesh.instanceMatrix.needsUpdate = true; if (carryMesh.instanceColor) carryMesh.instanceColor.needsUpdate = true;
}

/* ---------- system ---------- */
JO.Sys.add('squad', {
  init: function () {
    scene = W.scene; buildMeshes(); Sq.expo = 1;
    Ev.on('level_load', function (i) { lvl = i; Sq.lanterns = 0; Sq.light = false; });
    Ev.on('retry', function () { Sq.lanterns = 0; for (var i = 0; i < Sq.lamps.length; i++) Sq.lamps[i].lit = true; });
    // loud things heard from far off: not an alarm, but worth a look
    Ev.on('noise', function (x, z, r, kind) { if (kind === 'step') return; var hear = (JO.Stealth ? JO.Stealth.hear : 1) * (r || 30), L = E.list;
      for (var i = 0; i < L.length; i++) { var e = L[i]; if (e.isBoss || !e.alive || e.state !== 'patrol') continue; var dd = Math.hypot(e.pos.x - x, e.pos.z - z); if (dd > hear && dd < hear * 1.7 && dd < 70) Sq.investigate(e, x, z, 'noise'); } });
    Ev.on('enemy_die', function (e) { if (e.lantern) { e.lantern = false; } if (e.surrendered) { Sq.executed++; JO.Game.run.executed = (JO.Game.run.executed || 0) + 1; Ev.emit('surrender_killed', e); }
      var L = E.list, hard = e.thrown ? 0.34 : 0.24; for (var i = 0; i < L.length; i++) { var o = L[i]; if (o === e || !o.alive || o.isBoss || !o.actInit) continue; if (Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 24) o.morale = Math.max(0, o.morale - hard); } });
    Ev.on('player_hurt', function () { var L = E.list; for (var i = 0; i < L.length; i++) if (L[i].alive && L[i].actInit && L[i].dist < 25) L[i].morale = Math.min(1, L[i].morale + 0.04); });
    var S2 = A.sounds; S2.click = function (v) { A.tone({ f: 1900, dur: 0.02, vol: 0.2 * v }); A.tone({ f: 900, dur: 0.03, vol: 0.14 * v, delay: 0.03 }); };
  },
  level: function (L) { placeLamps(L); },
  step: function (dt) {
    var I = JO.Input, L = E.list, i;
    if (I.lightPressed) { Sq.light = !Sq.light; A.play('click'); Ev.emit('flashlight', Sq.light); }
    for (i = 0; i < L.length; i++) { var e = L[i]; if (!e.isBoss && e.alive && !e.actInit) assign(e); }
    moraleStep(dt); computeExposure();
    tick -= dt; if (tick <= 0) { tick = 0.4; bodyWatch(); }
    // stepping on a patrol's suspicion: once he is fairly sure, he walks over instead of just staring
    for (i = 0; i < L.length; i++) { e = L[i]; if (e.alive && e.state === 'patrol' && !e.inv && e.aware > 0.55 && e.aware < 0.95 && !e.see && e.type !== 'sniper' && e.type !== 'drone') Sq.investigate(e, JO.Player.pos.x, JO.Player.pos.z, 'noise'); }
  },
  frame: function (dt, real) {
    var t = W.time, dk = dark(), i, P = JO.Player, Cam = JO.Cam;
    for (i = 0; i < Sq.lamps.length; i++) { var l = Sq.lamps[i], want = l.lit ? 0.3 + 0.7 * dk : 0; l.on += (want - l.on) * Math.min(1, real * 5);
      var fl = l.on * (0.9 + Math.sin(t * 11 + i * 2.3) * 0.05 + Math.sin(t * 23 + i) * 0.03); bulbMesh.setColorAt(i, col.setRGB(0.12 + fl, 0.1 + fl * 0.74, 0.08 + fl * 0.36)); glowMesh.setColorAt(i, col.setRGB(fl * 0.9 * dk, fl * 0.55 * dk, fl * 0.2 * dk));
      if (l.on > 0.05) JO.Lights.add('l' + i, l.x, l.y - 0.2, l.z, 0xffb060, 1.7 * fl * (0.3 + 0.7 * dk), 13, 1); }
    if (Sq.lamps.length) { bulbMesh.instanceColor.needsUpdate = true; glowMesh.instanceColor.needsUpdate = true; }
    lanternFrame(t);
    // flashlight: a spot from the shoulder along the aim
    var on = Sq.light && !P.dead && JO.Game.state === 'playing' ? 1 : 0; spot.intensity += ((on ? 1.5 + 1.3 * dk : 0) - spot.intensity) * Math.min(1, real * 14);
    if (spot.intensity > 0.01) { spot.position.set(P.pos.x + Cam.rx * 0.3, P.pos.y + 1.45, P.pos.z + Cam.rz * 0.3); spot.target.position.set(spot.position.x + Cam.fx * 10, spot.position.y + Cam.fy * 10, spot.position.z + Cam.fz * 10); spot.target.updateMatrixWorld(); }
  }
});
})();
