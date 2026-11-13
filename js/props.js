/* ============================================================
   JUNGLE OUTPOST — props.js
   Things in the level the player can break, solve or drive:
     - explosive barrels and breakable crates
     - hanging log bundles and a gantry bridge (shoot the rope)
     - a hackable gate (terminal mini-game, or blow it open)
     - a lever door (light all three glyphs)
     - a timed spike corridor
     - a jeep
   Placement comes from CFG.LEVELS[i].props. Everything is built
   on level_load into the world group, so it is disposed with
   the level. The playtest bot solves each one (Pr.botGoal).
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, CFG = JO.CFG, W = JO.World, FX = JO.FX, A = JO.Audio, E = JO.Enemies, Ev = JO.Events, G = W.G;
var Pr = JO.Props = { list: [], gate: null, door: null, spikes: null, veh: null, hack: null, gantry: null };
var M = null, tv = new THREE.Vector3(), hackEl = null, botT = 0;
function own(m) { W.owned.push(m); return m; }      // per-level materials are disposed with the level
var DIRS = ['up', 'left', 'down', 'right'], ARROW = { up: '↑', left: '←', down: '↓', right: '→' },
  KEYDIR = { KeyW: 'up', ArrowUp: 'up', KeyA: 'left', ArrowLeft: 'left', KeyS: 'down', ArrowDown: 'down', KeyD: 'right', ArrowRight: 'right' };

function mats() {
  if (M) return M;
  var L = function (c, e) { return new THREE.MeshLambertMaterial({ color: c, emissive: e || 0 }); };
  M = { red: L(0xb3261a, 0x2a0500), band: L(0x2a2a2a), haz: L(0xf2c21a, 0x302400), wood: L(0xb88a52), woodD: L(0x6a4a2a), rope: L(0xd9c9a0), log: L(0x70502e),
    steel: L(0x596068), stone: L(0x6f7f7c), dark: L(0x26303a), spike: L(0xc9ccd0, 0x200000), warn: new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.0, depthWrite: false }),
    screen: new THREE.MeshBasicMaterial({ color: 0x58e0d0 }), jeep: L(0x55633a), tire: L(0x1c1c1c), glass: L(0x9fd0e0, 0x10262c) };
  return M;
}
function mesh(geo, mat, sx, sy, sz, x, y, z, parent) { var m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
function group(x, z) { var g = new THREE.Group(); g.position.set(x, 0, z); W.group.add(g); return g; }
function near(x, z, r) { var P = JO.Player, dx = P.pos.x - x, dz = P.pos.z - z; return dx * dx + dz * dz < r * r; }

/* ---------- scenery keeps clear of everything placed here (called from world.js) ---------- */
Pr.reserve = function (L, reserve) {
  var p = L.props; if (!p) return; var x;
  (p.barrels || []).forEach(function (b) { reserve(b[0], b[1], 2.2); }); (p.crates || []).forEach(function (b) { reserve(b[0], b[1], 2.2); });
  (p.logs || []).forEach(function (b) { reserve(b[0], b[1], 3.6); });
  function strip(z, r) { for (x = -18; x <= 18; x += 3) reserve(x, z, r); }
  if (p.gate) { strip(p.gate.z, 3); reserve(p.gate.term[0], p.gate.term[1], 2.5); }
  if (p.door) { strip(p.door.z, 3.2); p.door.levers.forEach(function (l) { reserve(l[0], l[1], 2.2); }); }
  if (p.spikes) for (var z = p.spikes.z0 + 3; z >= p.spikes.z1 - 3; z -= 3) strip(z, 2.6);
  if (p.gantry) strip(p.gantry.z, 3.2);
  if (p.jeep) reserve(p.jeep[0], p.jeep[1], 4);
};

/* ============================================================
   BUILD
   ============================================================ */
function addBarrel(x, z) {
  var m = mats(), g = group(x, z); mesh(G.cyl, m.red, 0.9, 1.25, 0.9, 0, 0.63, 0, g); mesh(G.cyl, m.band, 0.94, 0.1, 0.94, 0, 0.3, 0, g); mesh(G.cyl, m.band, 0.94, 0.1, 0.94, 0, 0.95, 0, g);
  mesh(G.box, m.haz, 0.5, 0.3, 0.05, 0, 0.63, 0.44, g); mesh(G.box, m.haz, 0.5, 0.3, 0.05, 0, 0.63, -0.44, g);
  Pr.list.push({ kind: 'barrel', x: x, z: z, hp: 18, alive: true, g: g, col: W.addBox(x, z, 0.45, 0.45, 1.25), fuse: -1, hy: 1.25 });
}
function addCrate(x, z) {
  var m = mats(), g = group(x, z); mesh(G.box, m.wood, 1.2, 1.2, 1.2, 0, 0.6, 0, g);
  var a = mesh(G.box, m.woodD, 1.5, 0.12, 1.24, 0, 0.6, 0, g); a.rotation.z = 0.78; var b = mesh(G.box, m.woodD, 1.5, 0.12, 1.24, 0, 0.6, 0, g); b.rotation.z = -0.78;
  g.rotation.y = (x * 7.3 + z) % 0.5;
  Pr.list.push({ kind: 'crate', x: x, z: z, hp: 32, alive: true, g: g, col: W.addBox(x, z, 0.62, 0.62, 1.2, { cover: true }), fuse: -1, hy: 1.2 });
}
// a bundle of logs on a rope: shoot the rope (or set off a blast nearby) and it drops on whoever is underneath
function addLogs(x, z) {
  var m = mats(), g = group(x, z), H = 7.2;
  mesh(G.cyl, m.woodD, 0.3, H, 0.3, -2.6, H / 2, 0, g); mesh(G.cyl, m.woodD, 0.3, H, 0.3, 2.6, H / 2, 0, g); mesh(G.box, m.woodD, 5.6, 0.28, 0.28, 0, H, 0, g);
  var rope = mesh(G.box, m.rope, 0.09, 1.9, 0.09, 0, H - 0.95, 0, g), load = new THREE.Group(); load.position.y = 4.6; g.add(load);
  for (var i = 0; i < 3; i++) { var l = mesh(G.cyl, m.log, 0.7, 3.6, 0.7, 0, i === 2 ? 0.55 : 0, i === 2 ? 0 : (i ? 0.38 : -0.38), load); l.rotation.z = Math.PI / 2; }
  W.addBox(x - 2.6, z, 0.2, 0.2, H); W.addBox(x + 2.6, z, 0.2, 0.2, H);
  Pr.list.push({ kind: 'logs', x: x, z: z, alive: true, g: g, rope: rope, load: load, y: 4.6, vy: 0, state: 'hang', seg: [x, 5.3, z, x, H, z], fuse: -1 });
}
// a plank gantry over the trail held up by two ropes: cut one and the deck comes down
function addGantry(z) {
  var m = mats(), g = group(0, z), i;
  for (i = -1; i <= 1; i += 2) { mesh(G.box, m.woodD, 0.5, 8.4, 0.5, i * 8.6, 4.2, 0, g); W.addBox(i * 8.6, z, 0.3, 0.3, 8.4);
    var r = mesh(G.box, m.rope, 0.09, 5.6, 0.09, i * 6.3, 6.3, 0, g); r.rotation.z = i * 0.92; }
  var deck = new THREE.Group(); deck.position.y = 4.3; g.add(deck);
  mesh(G.box, m.wood, 14.6, 0.24, 2.6, 0, 0, 0, deck); mesh(G.box, m.woodD, 14.6, 0.1, 0.12, 0, 0.75, 1.25, deck); mesh(G.box, m.woodD, 14.6, 0.1, 0.12, 0, 0.75, -1.25, deck);
  for (i = -3; i <= 3; i++) { mesh(G.box, m.woodD, 0.12, 0.75, 0.12, i * 2.3, 0.37, 1.25, deck); mesh(G.box, m.woodD, 0.12, 0.75, 0.12, i * 2.3, 0.37, -1.25, deck); }
  Pr.gantry = { kind: 'gantry', x: 0, z: z, alive: true, g: g, deck: deck, y: 4.3, vy: 0, state: 'hang', ropes: g.children.filter(function (c) { return c.material === m.rope; }),
    segs: [[-8.6, 8.2, z, -4.2, 4.5, z], [8.6, 8.2, z, 4.2, 4.5, z]], fuse: -1 };
  Pr.list.push(Pr.gantry);
}
function wall(z, gap, h, mat, g) {
  var hw = 18.4, w = hw - gap; mesh(G.box, mat, w, h, 0.7, -(gap + w / 2), h / 2, 0, g); mesh(G.box, mat, w, h, 0.7, gap + w / 2, h / 2, 0, g);
  mesh(G.box, mats().dark, w, 0.3, 0.9, -(gap + w / 2), h, 0, g); mesh(G.box, mats().dark, w, 0.3, 0.9, gap + w / 2, h, 0, g);
  W.addBox(-(gap + w / 2), z, w / 2, 0.35, h + 4); W.addBox(gap + w / 2, z, w / 2, 0.35, h + 4);
}
function addGate(c) {
  var m = mats(), g = group(0, c.z); wall(c.z, 3.2, 4.4, m.steel, g);
  var leaf = new THREE.Group(); g.add(leaf); mesh(G.box, m.dark, 6.4, 4.2, 0.4, 0, 2.1, 0, leaf);
  for (var i = -2; i <= 2; i++) mesh(G.box, m.haz, 0.18, 4.2, 0.46, i * 1.25, 2.1, 0, leaf);
  var t = group(c.term[0], c.term[1]); mesh(G.box, m.dark, 0.7, 1.3, 0.5, 0, 0.65, 0, t); var scr = mesh(G.box, own(m.screen.clone()), 0.56, 0.4, 0.06, 0, 1.2, 0.27, t); scr.castShadow = false; t.rotation.y = 0;
  W.addBox(c.term[0], c.term[1], 0.4, 0.3, 1.3);
  Pr.gate = { kind: 'gate', z: c.z, x: 0, open: false, k: 0, leaf: leaf, col: W.addBox(0, c.z, 3.2, 0.3, 8), tx: c.term[0], tz: c.term[1], scr: scr, hp: 260, alive: true, tries: 0 };
}
function addDoor(c) {
  var m = mats(), g = group(0, c.z), i; wall(c.z, 2.6, 5, m.stone, g);
  var leaf = new THREE.Group(); g.add(leaf); mesh(G.box, m.stone, 5.2, 4.8, 0.6, 0, 2.4, 0, leaf);
  var d = { kind: 'door', z: c.z, x: 0, open: false, k: 0, leaf: leaf, col: W.addBox(0, c.z, 2.6, 0.35, 9), lit: [false, false, false], glyphs: [], levers: [], alive: true };
  for (i = 0; i < 3; i++) { var gm = own(new THREE.MeshBasicMaterial({ color: 0x1a2c2a })); var gl = mesh(G.ico0, gm, 0.7, 0.7, 0.2, (i - 1) * 1.5, 3.2, 0.36, leaf); gl.castShadow = false; d.glyphs.push(gm); }
  // each lever flips a fixed set of glyphs; the answer is the first and third lever
  var FLIP = [[0], [0, 1], [1, 2]];
  c.levers.forEach(function (l, k) { var lg = group(l[0], l[1]); mesh(G.box, m.stone, 0.7, 0.5, 0.7, 0, 0.25, 0, lg); var piv = new THREE.Group(); piv.position.y = 0.5; lg.add(piv);
    mesh(G.cyl, m.woodD, 0.12, 1.1, 0.12, 0, 0.55, 0, piv); mesh(G.ico0, m.red, 0.3, 0.3, 0.3, 0, 1.1, 0, piv); piv.rotation.x = -0.6;
    for (var q = 0; q < FLIP[k].length; q++) { var dot = mesh(G.box, own(new THREE.MeshBasicMaterial({ color: 0x58e0d0 })), 0.12, 0.12, 0.05, (FLIP[k][q] - 1) * 0.2, 0.42, 0.36, lg); dot.castShadow = false; }
    W.addBox(l[0], l[1], 0.35, 0.35, 0.5); d.levers.push({ x: l[0], z: l[1], piv: piv, on: false, flips: FLIP[k] }); });
  Pr.door = d;
}
function addSpikes(c) {
  var m = mats(), g = group(0, 0), gap = 3.2, len = c.z0 - c.z1, zc = (c.z0 + c.z1) / 2, i;
  [c.z0, c.z1].forEach(function (z) { var wg = new THREE.Group(); wg.position.z = z; g.add(wg); wall(z, gap, 4.6, m.stone, wg); });
  for (i = -1; i <= 1; i += 2) { mesh(G.box, m.stone, 0.7, 4.6, len, i * (gap + 0.35), 2.3, zc, g); W.addBox(i * (gap + 0.35), zc, 0.35, len / 2, 8.6); }
  var s = { kind: 'spikes', z0: c.z0, z1: c.z1, gap: gap, rows: [], t: 0, period: 3.0, up: 1.0, warn: 0.6 };
  var n = 4, stepZ = (len - 3) / (n - 1);
  for (i = 0; i < n; i++) { var z = c.z0 - 1.5 - i * stepZ, rg = new THREE.Group(); rg.position.set(0, 0, z); g.add(rg);
    var wm = own(m.warn.clone()), plate = mesh(G.box, wm, gap * 2 - 0.2, 0.04, 1.3, 0, 0.05, 0, rg); plate.castShadow = false;
    var sp = new THREE.Group(); rg.add(sp); for (var q = 0; q < 9; q++) mesh(G.cone, m.spike, 0.3, 0.9, 0.3, -2.6 + q * 0.65, 0.45, (q % 2) * 0.4 - 0.2, sp);
    s.rows.push({ z: z, phase: i * 0.75, sp: sp, wm: wm, active: false, cd: 0 }); }
  Pr.spikes = s;
}
function addJeep(c) {
  var m = mats(), g = group(c[0], c[1]), body = new THREE.Group(); g.add(body);
  var glb = JO.Assets.instantiate('env_jeep');
  if (glb) body.add(glb.root);
  else { mesh(G.box, m.jeep, 1.9, 0.7, 3.8, 0, 0.85, 0, body); mesh(G.box, m.jeep, 1.8, 0.6, 1.5, 0, 1.45, -0.5, body); mesh(G.box, m.glass, 1.6, 0.5, 0.06, 0, 1.5, 0.28, body);
    for (var i = 0; i < 4; i++) { var t = mesh(G.cyl, m.tire, 0.8, 0.4, 0.8, (i % 2 ? 1 : -1) * 1.0, 0.4, (i < 2 ? 1 : -1) * 1.25, body); t.rotation.z = Math.PI / 2; } }
  Pr.veh = { kind: 'jeep', x: c[0], z: c[1], yaw: Math.PI, sp: 0, hp: 260, max: 260, alive: true, mounted: false, g: g, col: W.addBox(c[0], c[1], 1.3, 2.1, 1.7), t: 0, used: false, botSkip: false, stuckT: 0, sx: c[0], sz: c[1], rev: 0, n: 0 };
  g.rotation.y = Pr.veh.yaw;
}
Pr.build = function (idx) {
  Pr.list.length = 0; Pr.gate = Pr.door = Pr.spikes = Pr.veh = Pr.gantry = null; endHack(false);
  var L = CFG.LEVELS[idx], p = L && L.props; if (!p || JO.Game.mode === 'bossrush') return;
  (p.barrels || []).forEach(function (b) { addBarrel(b[0], b[1]); }); (p.crates || []).forEach(function (b) { addCrate(b[0], b[1]); });
  (p.logs || []).forEach(function (b) { addLogs(b[0], b[1]); });
  if (p.gantry) addGantry(p.gantry.z); if (p.gate) addGate(p.gate); if (p.door) addDoor(p.door); if (p.spikes) addSpikes(p.spikes); if (p.jeep) addJeep(p.jeep);
};

/* ============================================================
   DAMAGE: bullets, blasts
   ============================================================ */
function segDist(ox, oy, oz, dx, dy, dz, t, s) {                 // closest approach of a ray (length t) to a segment
  var best = 1e9; for (var k = 0; k <= 6; k++) { var f = k / 6, px = s[0] + (s[3] - s[0]) * f - ox, py = s[1] + (s[4] - s[1]) * f - oy, pz = s[2] + (s[5] - s[2]) * f - oz;
    var a = px * dx + py * dy + pz * dz; if (a < 0 || a > t + 0.3) continue; var qx = px - dx * a, qy = py - dy * a, qz = pz - dz * a, d = Math.sqrt(qx * qx + qy * qy + qz * qz); if (d < best) best = d; }
  return best;
}
function destroy(p, by) {
  if (!p.alive) return; p.alive = false; if (p.col) p.col.on = false; p.g.visible = false;
  if (p.kind === 'barrel') JO.Arsenal.blast(p.x, 0.8, p.z, 5, 130, 0.45);
  else { FX.burst(p.x, 0.7, p.z, 16, 0xb88a52, 5, 0.7, 9, 0.2, 3); A.playAt('clang', p.x, p.z, 0.8);
    JO.Perks.addSalvage(6, p.x, 1.6, p.z); if (((p.x * 13 + p.z * 7) | 0) % 3 === 0) JO.Game.spawnPickup('ammo', p.x, p.z); }
  Ev.emit('prop_destroyed', p.kind, by);
}
function drop(p, by) { if (p.state !== 'hang') return; p.state = 'fall'; p.vy = 0; if (p.rope) p.rope.visible = false; if (p.ropes) p.ropes.forEach(function (r) { r.visible = false; });
  A.playAt('slash', p.x, p.z, 1.2); Ev.emit('noise', p.x, p.z, 12); Ev.emit('prop_destroyed', p.kind, by); }
function land(p) {
  p.state = 'down'; var gant = p.kind === 'gantry', rx = gant ? 7.5 : 2.4, rz = gant ? 1.9 : 1.6, L = E.list, P = JO.Player, i, hit = 0;
  FX.burst(p.x, 0.5, p.z, 26, 0xc8b890, 6, 0.8, 8, 0.24, 3); FX.addShake(0.5); A.playAt('stomp', p.x, p.z, 1); Ev.emit('noise', p.x, p.z, 30);
  for (i = L.length - 1; i >= 0; i--) { var e = L[i]; if (!e || !e.alive || e.type === 'drone' || e.pos.y > 2) continue;
    if (Math.abs(e.pos.x - p.x) < rx + (e.radius || 0.5) && Math.abs(e.pos.z - p.z) < rz + (e.radius || 0.5)) { var d = JO.Arsenal.hurt(e, e.isBoss ? 180 : 260); if (d > 0) { hit++; JO.UI.dmgNum(e.pos.x, e.pos.y + 2, e.pos.z, 'CRUSHED', 'crit'); } } }
  if (Math.abs(P.pos.x - p.x) < rx && Math.abs(P.pos.z - p.z) < rz && P.pos.y < 2) P.damage(40, p.x, p.z, 'crush');
  if (gant) { W.addBox(-4.6, p.z, 2.8, 1.2, 0.9, { cover: true }); W.addBox(4.6, p.z, 2.8, 1.2, 0.9, { cover: true }); p.deck.rotation.z = 0.05; }
  else W.addBox(p.x, p.z, 1.8, 0.8, 0.85, { cover: true });
  if (hit) Ev.emit('crush', hit, p.kind);
}
// a player bullet has ended at distance t along this ray
Pr.shot = function (ox, oy, oz, dx, dy, dz, t, c) {
  var ex = ox + dx * t, ey = oy + dy * t, ez = oz + dz * t, i, p;
  for (i = 0; i < Pr.list.length; i++) { p = Pr.list[i]; if (!p.alive) continue;
    if (p.kind === 'barrel' || p.kind === 'crate') { if (Math.abs(ex - p.x) < 0.8 && Math.abs(ez - p.z) < 0.8 && ey < p.hy + 0.15) { p.hp -= c.dmg; FX.burst(ex, ey, ez, 3, p.kind === 'barrel' ? 0xff6030 : 0xb88a52, 3, 0.25); if (p.hp <= 0) destroy(p, 'shot'); } }
    else if (p.state === 'hang') { var segs = p.segs || [p.seg]; for (var k = 0; k < segs.length; k++) if (segDist(ox, oy, oz, dx, dy, dz, t, segs[k]) < 0.42) { drop(p, 'shot'); break; } } }
};
function onBlast(x, z, r, dmg) {
  for (var i = 0; i < Pr.list.length; i++) { var p = Pr.list[i]; if (!p.alive) continue; var d = Math.hypot(p.x - x, p.z - z);
    if (p.kind === 'barrel' || p.kind === 'crate') { if (d < r + 0.6 && d > 0.05 && p.fuse < 0) p.fuse = 0.12 + Math.random() * 0.15; }
    else if (p.state === 'hang' && (p.kind === 'gantry' ? Math.abs(z - p.z) < r + 1 && Math.abs(x) < 10 + r : d < r + 2)) drop(p, 'blast'); }
  var g = Pr.gate; if (g && !g.open && Math.abs(z - g.z) < r + 0.5 && Math.abs(x) < 4 + r && dmg >= 100) { g.hp -= dmg; if (g.hp <= 0) openGate('blast'); else JO.UI.dmgNum(0, 3, g.z, 'GATE ' + Math.max(0, Math.round(g.hp / 2.6)) + '%', 'blk'); }
  var v = Pr.veh; if (v && v.alive && Math.hypot(v.x - x, v.z - z) < r + 1) vehDamage(dmg * 0.6);
}

/* ============================================================
   GATE + HACK MINI-GAME
   ============================================================ */
function openGate(how) {
  var g = Pr.gate; if (!g || g.open) return; g.open = true; A.play('gate'); endHack(false); g.scr.material.color.setHex(how === 'hack' ? 0x5cff7a : 0xff5a3c);
  JO.UI.banner(how === 'hack' ? 'GATE UNLOCKED' : 'GATE BREACHED', 2, how !== 'hack'); if (how !== 'hack') Ev.emit('noise', 0, g.z, 60);
  if (how === 'hack') JO.Perks.addSalvage(15, g.tx, 2, g.tz); Ev.emit('hack', how === 'hack', how);
}
function renderHack() { var h = Pr.hack; if (!h) return; var s = ''; for (var i = 0; i < h.seq.length; i++) s += '<span class="' + (i < h.i ? 'ok' : (i === h.i ? 'cur' : '')) + '">' + ARROW[h.seq[i]] + '</span>';
  hackEl.seq.innerHTML = s; }
function startHack() {
  var g = Pr.gate, seq = []; for (var i = 0; i < 5; i++) seq.push(DIRS[(Math.random() * 4) | 0]);
  Pr.hack = { seq: seq, i: 0, t: 9, max: 9 }; g.tries++; hackEl.root.classList.remove('hidden'); renderHack(); A.play('beep'); JO.Input.fire = false;
}
function endHack(alarm) {
  if (!Pr.hack) return; Pr.hack = null; if (hackEl) hackEl.root.classList.add('hidden');
  if (alarm) { var g = Pr.gate; JO.UI.banner('ALARM TRIPPED', 2, true); A.play('warn'); Ev.emit('noise', 0, g.z, 70); Ev.emit('hack', false, 'alarm'); }
}
Pr.hackKey = function (dir) {
  var h = Pr.hack; if (!h) return;
  if (h.seq[h.i] === dir) { h.i++; A.play('ui'); if (h.i >= h.seq.length) { openGate('hack'); return; } }
  else { h.i = 0; h.t -= 1.5; A.play('empty'); }
  renderHack();
};

/* ============================================================
   VEHICLE
   ============================================================ */
function vehDamage(d) { var v = Pr.veh; if (!v || !v.alive) return; v.hp -= d; if (v.hp <= 0) wreck(); }
function wreck() {
  var v = Pr.veh; v.alive = false; if (v.mounted) dismount(true);
  JO.Arsenal.blast(v.x, 1, v.z, 4.5, 120, 0.2); v.g.rotation.z = 0.25; v.g.traverse(function (o) { if (o.isMesh) o.material = mats().band; });
  Ev.emit('vehicle', 'wrecked');
}
function mount() { var v = Pr.veh, P = JO.Player; v.mounted = true; v.used = true; v.col.on = false; v.t = 0; v.sp = 0; P.driving = true; P.crouch = false; P.rolling = 0; A.play('gate', 0.4); Ev.emit('vehicle', 'enter'); }
function dismount(forced) {
  var v = Pr.veh, P = JO.Player; v.mounted = false; P.driving = false; v.sp = 0; v.cool = 0.7;
  var rx = -Math.cos(v.yaw), rz = Math.sin(v.yaw); P.pos.set(v.x + rx * 2.2, 0, v.z + rz * 2.2); W.moveCircle(P.pos, 0.45, 0, false); W.clamp(P.pos, 0.45); P.prev.copy(P.pos); P.vx = P.vz = 0;
  var c = v.col; c.minx = v.x - 1.5; c.maxx = v.x + 1.5; c.minz = v.z - 1.5; c.maxz = v.z + 1.5; c.on = true;
  W.moveCircle(P.pos, 0.45, 0, false); P.prev.copy(P.pos); if (!forced) Ev.emit('vehicle', 'exit');
}
Pr.driving = function () { return !!(Pr.veh && Pr.veh.mounted); };
// 70% of what would hit the driver is taken by the jeep
Pr.absorb = function (amt) { vehDamage(amt * 0.7); return amt * 0.3; };
// replaces the on-foot movement while mounted (called from Player.update)
Pr.drive = function (dt) {
  var v = Pr.veh, P = JO.Player, I = JO.Input, G = JO.Game, L = E.list, i;
  v.t += dt;
  if (G.debug.bot) botDrive(v, dt);
  var th = Math.max(-1, Math.min(1, I.moveY)), st = Math.max(-1, Math.min(1, I.moveX)), target = th > 0 ? 15 * th : (th < 0 ? 6 * th : 0);
  v.sp += (target - v.sp) * Math.min(1, dt * (th ? 1.6 : 2.4));
  v.yaw -= st * dt * 1.9 * Math.max(-1, Math.min(1, v.sp / 5));
  var fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), ox = v.x, oz = v.z;
  tv.set(v.x + fx * v.sp * dt, 0, v.z + fz * v.sp * dt); W.moveCircle(tv, 1.35, 0, false); W.clamp(tv, 1.35);
  if (tv.z < W.A0 + 12) { tv.z = W.A0 + 12; v.sp = 0; if (!v.end) { v.end = true; JO.UI.banner('THE ROAD ENDS HERE — ON FOOT', 2.4, false); } }
  var want = Math.abs(v.sp * dt), got = Math.hypot(tv.x - ox, tv.z - oz); if (want > 0.02 && got < want * 0.3) v.sp *= 0.9;
  v.x = tv.x; v.z = tv.z; v.g.position.set(v.x, 0, v.z); v.g.rotation.y = v.yaw;
  P.vx = (v.x - ox) / dt; P.vz = (v.z - oz) / dt; P.pos.set(v.x, 0, v.z); P.vy = 0; P.onGround = true; P.rolling = 0; P.inWater = false;
  if (Math.abs(v.sp) > 3 && Math.random() < 0.4) FX.puff(v.x - fx * 2, 0.3, v.z - fz * 2, 0x8a7a5a, 0.4);
  if (Math.abs(v.sp) > 5) {
    for (i = L.length - 1; i >= 0; i--) { var e = L[i]; if (!e || !e.alive || e.isBoss || e.type === 'drone' || e.pos.y > 1.5 || (e.ramT > v.t)) continue;
      if (Math.hypot(e.pos.x - v.x, e.pos.z - v.z) < 2.0) { e.ramT = v.t + 0.6; JO.Arsenal.hurt(e, 95); JO.UI.dmgNum(e.pos.x, e.pos.y + 2, e.pos.z, 'RAMMED', 'crit'); Ev.emit('ram', e); A.playAt('stomp', v.x, v.z, 0.7); v.sp *= 0.8; vehDamage(6); } }
    for (i = 0; i < Pr.list.length; i++) { var p = Pr.list[i]; if (p.alive && (p.kind === 'barrel' || p.kind === 'crate') && Math.hypot(p.x - v.x, p.z - v.z) < 2.1) destroy(p, 'ram'); }
  }
  if (Math.abs(v.sp) > 1 && Math.floor(v.t * 3) !== Math.floor((v.t - dt) * 3)) Ev.emit('noise', v.x, v.z, 26, 'engine');
  if (v.alive && v.t > 0.5 && I.interactPressed) dismount(false);
};
function botDrive(v, dt) {
  var I = JO.Input, gx = 0, gz = v.z - 16, want = Math.atan2(gx - v.x, gz - v.z), diff = E.wrap(want - v.yaw);
  I.moveY = 1; I.moveX = diff > 0.08 ? -1 : (diff < -0.08 ? 1 : 0);
  if (v.rev > 0) { v.rev -= dt; I.moveY = -1; I.moveX = -I.moveX; }
  v.stuckT += dt;
  if (v.stuckT > 1.4) { if (Math.hypot(v.x - v.sx, v.z - v.sz) < 1.2 && !v.end) { v.rev = 0.9; v.n++; } v.stuckT = 0; v.sx = v.x; v.sz = v.z; }
  if (v.n > 3 || v.end) { v.botSkip = true; I.interactPressed = true; }
}

/* ============================================================
   PER STEP
   ============================================================ */
function nearestLever(d) { var P = JO.Player, b = null, bd = 1e9; for (var i = 0; i < d.levers.length; i++) { var l = d.levers[i], q = Math.hypot(P.pos.x - l.x, P.pos.z - l.z); if (q < bd) { bd = q; b = l; } } return b; }
Pr.update = function (dt) {
  var P = JO.Player, I = JO.Input, Gm = JO.Game, i, p, use = I.interactPressed && !P.dead, hint = '';
  for (i = 0; i < Pr.list.length; i++) { p = Pr.list[i];
    if (p.alive && p.fuse >= 0) { p.fuse -= dt; if (p.fuse < 0) destroy(p, 'blast'); }
    if (p.state === 'fall') { p.vy -= 22 * dt; p.y += p.vy * dt; var floor = p.kind === 'gantry' ? 0.5 : 0.4; if (p.y <= floor) { p.y = floor; land(p); } (p.load || p.deck).position.y = p.y; } }
  // gate + terminal
  var g = Pr.gate;
  if (g) { if (g.open && g.k < 1) { g.k = Math.min(1, g.k + dt * 0.9); g.leaf.position.y = -4.4 * g.k; if (g.k > 0.55) g.col.on = false; }
    if (!g.open && !Pr.hack && near(g.tx, g.tz, 2.4) && !P.driving) { hint = I.isTouch ? 'TAP <kbd>USE</kbd> — HACK THE GATE' : 'PRESS <kbd>E</kbd> — HACK THE GATE  (or blow it open)'; if (use) { startHack(); use = false; } }
    if (Pr.hack) { var h = Pr.hack; h.t -= dt; hackEl.fill.style.transform = 'scaleX(' + Math.max(0, h.t / h.max).toFixed(3) + ')';
      if (Gm.debug.bot) { botT -= dt; if (botT <= 0) { botT = 0.22; Pr.hackKey(h.seq[h.i]); } }
      if (Pr.hack && (h.t <= 0 || !near(g.tx, g.tz, 4))) endHack(h.t <= 0); } }
  // lever door
  var d = Pr.door;
  if (d) { if (d.open && d.k < 1) { d.k = Math.min(1, d.k + dt * 0.7); d.leaf.position.y = -5 * d.k; if (d.k > 0.55) d.col.on = false; }
    for (i = 0; i < d.levers.length; i++) { var l = d.levers[i]; l.piv.rotation.x += ((l.on ? 0.6 : -0.6) - l.piv.rotation.x) * Math.min(1, dt * 10);
      if (!d.open && near(l.x, l.z, 2.1) && nearestLever(d) === l) { hint = I.isTouch ? 'TAP <kbd>USE</kbd> — PULL LEVER  (light all three glyphs)' : 'PRESS <kbd>E</kbd> — PULL LEVER  (light all three glyphs)';
        if (use) { use = false; l.on = !l.on; A.play('clang', 0.7); l.flips.forEach(function (q) { d.lit[q] = !d.lit[q]; d.glyphs[q].color.setHex(d.lit[q] ? 0x58e0d0 : 0x1a2c2a); }); Ev.emit('lever', i);
          if (d.lit[0] && d.lit[1] && d.lit[2]) { d.open = true; A.play('gate'); JO.UI.banner('THE DOOR GRINDS OPEN', 2.2, false); JO.Perks.addSalvage(15, 0, 3, d.z); Ev.emit('door_open'); } } } } }
  // spike corridor: every row runs the same cycle, offset so there is always a way through
  var s = Pr.spikes;
  if (s) { s.t += dt;
    for (i = 0; i < s.rows.length; i++) { var r = s.rows[i], ph = (s.t + r.phase) % s.period, warn = ph > s.period - s.up - s.warn && ph <= s.period - s.up; r.active = ph > s.period - s.up;
      var tgt = r.active ? 1 : 0.02; r.sp.scale.y += (tgt - r.sp.scale.y) * Math.min(1, dt * 26); r.sp.visible = r.sp.scale.y > 0.05; r.wm.opacity = warn ? 0.35 + 0.3 * Math.sin(s.t * 30) : (r.active ? 0.5 : 0.08);
      if (r.active && !r.was) A.playAt('slash', 0, r.z, 0.6); r.was = r.active; if (r.cd > 0) r.cd -= dt;
      if (r.active && r.cd <= 0 && !P.driving && Math.abs(P.pos.z - r.z) < 0.85 && Math.abs(P.pos.x) < s.gap && P.pos.y < 0.7) { r.cd = 0.7; P.damage(22, P.pos.x, r.z, 'spikes'); }
      if (r.active) for (var k = E.list.length - 1; k >= 0; k--) { var e = E.list[k]; if (e && e.alive && !e.isBoss && e.type !== 'drone' && Math.abs(e.pos.z - r.z) < 0.7 && Math.abs(e.pos.x) < s.gap && !(e.spikeT > s.t)) { e.spikeT = s.t + 0.8; JO.Arsenal.hurt(e, 30); } } } }
  // jeep
  var v = Pr.veh;
  if (v && v.cool > 0) v.cool -= dt;
  if (v && v.alive && !v.mounted && !(v.cool > 0) && !P.dead && near(v.x, v.z, 3.4) && !Gm.bossFight) { hint = I.isTouch ? 'TAP <kbd>USE</kbd> — DRIVE' : 'PRESS <kbd>E</kbd> — DRIVE THE JEEP'; if (use) { use = false; I.interactPressed = false; mount(); } }
  else if (v && v.mounted) hint = (I.isTouch ? 'STICK DRIVES · <kbd>USE</kbd> GETS OUT' : '<kbd>W</kbd><kbd>S</kbd> THROTTLE · <kbd>A</kbd><kbd>D</kbd> STEER · <kbd>E</kbd> GET OUT') + '   JEEP ' + Math.max(0, Math.round(v.hp / v.max * 100)) + '%';
  if (hint && !Gm.hint) Gm.hint = hint;
};

/* ---------- where the playtest bot should go next (null = carry on north) ---------- */
Pr.botGoal = function () {
  var P = JO.Player, g = Pr.gate, d = Pr.door, s = Pr.spikes, v = Pr.veh, i;
  if (g && !g.open && P.pos.z > g.z && P.pos.z < g.z + 26) return { x: g.tx - 0.2, z: g.tz + 1.3, use: near(g.tx, g.tz, 2.2) && !Pr.hack, stop: !!Pr.hack };
  if (d && !d.open && P.pos.z > d.z && P.pos.z < d.z + 26) { for (i = 0; i < 3; i++) { var l = d.levers[i]; if (l.on !== (i !== 1)) return { x: l.x + 0.4, z: l.z + 1.1, use: near(l.x, l.z, 1.5) }; } }      // levers 1 and 3 on, 2 off
  if (s && P.pos.z < s.z0 + 8 && P.pos.z > s.z1 - 1) { var hold = false;
    for (i = 0; i < s.rows.length; i++) { var r = s.rows[i], ahead = P.pos.z - r.z; if (ahead > 0.95 && ahead < 2.6) { var ph = (s.t + r.phase) % s.period; if (ph > s.period - s.up - s.warn - 0.75) hold = true; } }
    return { x: 0, z: P.pos.z - 10, stop: hold && Math.abs(P.pos.x) < 2.6 }; }
  if (v && v.alive && !v.mounted && !v.botSkip && !v.used && P.pos.z > v.z - 3 && P.pos.z < v.z + 22 && (!d || d.open)) return { x: v.x - 1.9, z: v.z + 0.5, use: near(v.x, v.z, 3.2) };
  return null;
};

Pr.init = function () {
  hackEl = { root: document.getElementById('hack'), seq: document.getElementById('hackSeq'), fill: document.getElementById('hackFill') };
  Ev.on('level_load', Pr.build); Ev.on('blast', onBlast);
  Ev.on('retry', function () { endHack(false); var v = Pr.veh; if (v && v.mounted) { v.mounted = false; JO.Player.driving = false; v.col.on = true; var c = v.col; c.minx = v.x - 1.5; c.maxx = v.x + 1.5; c.minz = v.z - 1.5; c.maxz = v.z + 1.5; } });
  window.addEventListener('keydown', function (e) { if (!Pr.hack || e.repeat) return; var dir = KEYDIR[e.code]; if (dir) { e.preventDefault(); Pr.hackKey(dir); } }, true);
  var pads = hackEl.root.querySelectorAll('[data-dir]'); for (var i = 0; i < pads.length; i++) (function (b) { var go = function (e) { e.preventDefault(); Pr.hackKey(b.getAttribute('data-dir')); }; b.addEventListener('touchstart', go, { passive: false }); b.addEventListener('mousedown', go); })(pads[i]);
};
})();
