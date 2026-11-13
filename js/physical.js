/* ============================================================
   JUNGLE OUTPOST — physical.js
   The world answers back when it is hit.
     - Phys.impact: what a bullet does to what it struck: a
       decal (hole, splinter, chip or scorch), debris in the
       surface's colour, a matching sound; rings on water
     - Phys.bits: pooled debris chunks and spent shell casings
     - bodies: enemies fall where they were hit (pushed along
       the shot, thrown by blasts) and stay on the ground; only
       a few are kept (JO.Q 'bodies'), the oldest dissolve
     - leg hits make an enemy limp for a moment
     - flamethrower heat: sustained fire overheats it
     - recoil that walks sideways in a pattern, aim sway on the
       marksman rifle, bullets that crack past your head
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, W = JO.World, FX = JO.FX, A = JO.Audio, Q = JO.Q, Ev = JO.Events;
var Ph = JO.Phys = { heat: 0, overheated: false, decalN: 0, bitN: 0, misses: 0, bodies: 0, swayX: 0, swayY: 0, burst: 0, burstT: 0, flameN: 0 };
var scene, d = new THREE.Object3D(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0), col = new THREE.Color(), v1 = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

/* ---------- debris ---------- */
var BN = 200, bMesh, bP = new Float32Array(BN * 3), bV = new Float32Array(BN * 3), bR = new Float32Array(BN * 3), bS = new Float32Array(BN * 3), bLife = new Float32Array(BN), bMax = new Float32Array(BN), bG = new Float32Array(BN), bNext = 0, bLive = 0;
Ph.bits = function (x, y, z, n, hex, speed, o) {
  var cap = Math.min(BN, Q.n('bits')); if (!cap || !bMesh) return; o = o || {};
  for (var k = 0; k < n; k++) { var i = bNext; bNext = (bNext + 1) % cap; var a = Math.random() * 6.283, e = Math.random(), s = speed * (0.4 + Math.random() * 0.6), j = i * 3;
    bP[j] = x; bP[j + 1] = y; bP[j + 2] = z;
    bV[j] = Math.cos(a) * s * (1 - e * 0.5) + (o.dx || 0) * s; bV[j + 1] = e * s + (o.up === undefined ? 1.5 : o.up); bV[j + 2] = Math.sin(a) * s * (1 - e * 0.5) + (o.dz || 0) * s;
    bR[j] = Math.random() * 6; bR[j + 1] = Math.random() * 6; bR[j + 2] = (Math.random() - 0.5) * 16;
    var sz = (o.size || 0.07) * (0.6 + Math.random() * 0.8); bS[j] = sz * (o.sx || 1); bS[j + 1] = sz * (o.sy || 1); bS[j + 2] = sz * (o.sz || 1);
    bLife[i] = bMax[i] = (o.life || 2.6) * (0.7 + Math.random() * 0.6); bG[i] = o.grav === undefined ? 16 : o.grav;
    col.setHex(hex).multiplyScalar(0.75 + Math.random() * 0.5); bMesh.setColorAt(i, col); Ph.bitN++; }
  bMesh.instanceColor.needsUpdate = true; bLive = 1;
};
function updateBits(dt) {
  if (!bLive) return; var any = false;
  for (var i = 0; i < BN; i++) { if (bLife[i] <= 0) continue; bLife[i] -= dt; var j = i * 3;
    if (bLife[i] <= 0) { bMesh.setMatrixAt(i, ZERO); any = true; continue; }
    any = true; bV[j + 1] -= bG[i] * dt; bP[j] += bV[j] * dt; bP[j + 1] += bV[j + 1] * dt; bP[j + 2] += bV[j + 2] * dt;
    var rest = false; if (bP[j + 1] < 0.03) { bP[j + 1] = 0.03; if (Math.abs(bV[j + 1]) > 1.2) { bV[j + 1] *= -0.35; bV[j] *= 0.55; bV[j + 2] *= 0.55; } else { bV[j] = bV[j + 1] = bV[j + 2] = 0; rest = true; } }
    if (!rest) bR[j] += bR[j + 2] * dt;
    var k = Math.min(1, bLife[i] / 0.4); d.position.set(bP[j], bP[j + 1], bP[j + 2]); d.rotation.set(bR[j], bR[j + 1], bR[j] * 0.7); d.scale.set(bS[j] * k, bS[j + 1] * k, bS[j + 2] * k); d.updateMatrix(); bMesh.setMatrixAt(i, d.matrix); }
  bMesh.instanceMatrix.needsUpdate = true; bLive = any ? 1 : 0;
}

/* ---------- decals ---------- */
var DK = { hole: { n: 64, share: 0.46 }, scorch: { n: 28, share: 0.2 }, splinter: { n: 24, share: 0.17 }, chip: { n: 24, share: 0.17 } };
function tex(draw) { var c = document.createElement('canvas'); c.width = c.height = 64; var g = c.getContext('2d'); draw(g); var t = new THREE.CanvasTexture(c); return t; }
function blob(g, x, y, r, a, rgb) { var gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); gr.addColorStop(1, 'rgba(' + rgb + ',0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
var DRAW = {
  hole: function (g) { blob(g, 32, 32, 22, 0.55, '20,16,12'); blob(g, 32, 32, 11, 1, '6,5,4'); g.fillStyle = 'rgba(6,5,4,1)'; g.beginPath(); g.arc(32, 32, 6, 0, 6.3); g.fill(); },
  scorch: function (g) { blob(g, 32, 32, 31, 0.9, '10,8,6'); for (var i = 0; i < 9; i++) { var a = i * 0.7; blob(g, 32 + Math.cos(a) * 14, 32 + Math.sin(a) * 14, 11, 0.5, '8,6,5'); } },
  splinter: function (g) { blob(g, 32, 32, 18, 0.5, '40,26,14'); g.strokeStyle = 'rgba(236,208,160,.95)'; g.lineWidth = 3; for (var i = 0; i < 7; i++) { var a = i * 0.9 + 0.3, r = 10 + (i * 7 % 14); g.beginPath(); g.moveTo(32 + Math.cos(a) * 4, 32 + Math.sin(a) * 4); g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r * 1.4); g.stroke(); }
    g.fillStyle = 'rgba(14,9,5,1)'; g.beginPath(); g.arc(32, 32, 5, 0, 6.3); g.fill(); },
  chip: function (g) { g.fillStyle = 'rgba(206,204,196,.92)'; g.beginPath(); for (var i = 0; i < 9; i++) { var a = i / 9 * 6.283, r = 13 + (i * 5 % 9); g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } g.fill(); blob(g, 32, 32, 9, 1, '30,30,30'); }
};
var dec = {};
function buildDecals() {
  var pg = new THREE.PlaneGeometry(1, 1);
  for (var k in DK) { var mat = new THREE.MeshLambertMaterial({ map: tex(DRAW[k]), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    var m = new THREE.InstancedMesh(pg, mat, DK[k].n); m.frustumCulled = false; m.renderOrder = 2; for (var i = 0; i < DK[k].n; i++) m.setMatrixAt(i, ZERO); m.instanceMatrix.needsUpdate = true; scene.add(m);
    dec[k] = { mesh: m, next: 0, live: 0 }; }
}
function clearDecals() { for (var k in dec) { var m = dec[k].mesh; for (var i = 0; i < m.count; i++) m.setMatrixAt(i, ZERO); m.instanceMatrix.needsUpdate = true; dec[k].next = 0; dec[k].live = 0; } Ph.decalN = 0; }
Ph.decal = function (kind, x, y, z, nx, ny, nz, size) {
  var D = dec[kind], total = Q.n('decals'); if (!D || !total) return false;
  var cap = Math.max(2, Math.min(DK[kind].n, Math.round(total * DK[kind].share))), i = D.next % cap; D.next = (i + 1) % cap; D.live = Math.min(cap, D.live + 1);
  d.position.set(x + nx * 0.025, y + ny * 0.025, z + nz * 0.025); v1.set(x + nx, y + ny, z + nz); d.up.set(0, Math.abs(ny) > 0.9 ? 0 : 1, Math.abs(ny) > 0.9 ? 1 : 0); d.lookAt(v1); d.rotateZ(Math.random() * 6.283);
  d.scale.set(size, size, size); d.updateMatrix(); D.mesh.setMatrixAt(i, d.matrix); D.mesh.instanceMatrix.needsUpdate = true; d.up.copy(UP); Ph.decalN++; return true;
};
Ph.decalCount = function () { var n = 0; for (var k in dec) n += dec[k].live; return n; };

/* ---------- what is this surface? ---------- */
var S = Ph.S = { nx: 0, ny: 1, nz: 0, kind: 'dirt', box: null };
Ph.surface = function (x, y, z) {
  S.nx = 0; S.ny = 1; S.nz = 0; S.box = null;
  var cs = W.colliders, best = null, bd = 0.14, i, c, e = 0.1;
  for (i = 0; i < cs.length; i++) { c = cs[i]; if (!c.on || x < c.minx - e || x > c.maxx + e || z < c.minz - e || z > c.maxz + e || y < c.y0 - e || y > c.h + e) continue;
    var f = [Math.abs(x - c.minx), Math.abs(x - c.maxx), Math.abs(z - c.minz), Math.abs(z - c.maxz), Math.abs(y - c.h), c.y0 > 0.2 ? Math.abs(y - c.y0) : 9];
    for (var k = 0; k < 6; k++) if (f[k] < bd) { bd = f[k]; best = c; S.nx = k === 0 ? -1 : (k === 1 ? 1 : 0); S.nz = k === 2 ? -1 : (k === 3 ? 1 : 0); S.ny = k === 4 ? 1 : (k === 5 ? -1 : 0); } }
  if (best) { S.box = best; S.kind = best.mat || (z < W.A0 + 1 ? 'stone' : 'wood'); return S; }
  var L = W.level;
  if (W.inWater(x, z)) S.kind = 'water';
  else if (L && L.river && z < L.river.z0 + 1 && z > L.river.z1 - 1 && Math.abs(x) < 2.6) S.kind = 'wood';
  else if (z < W.A0 + 1) S.kind = 'stone';
  else S.kind = Math.abs(x - Math.sin(z * 0.07) * 1.2) < 2.8 ? 'dirt' : 'grass';
  return S;
};
var LOOK = { dirt: [0x8a7048, 'hitDirt'], grass: [0x4f7a3a, 'hitDirt'], sand: [0xb9a474, 'hitDirt'], wood: [0x9a7446, 'hitWood'], stone: [0x9a9c96, 'hitStone'], metal: [0x8a8f90, 'ricochet'] };
// a bullet (or anything fast) struck the world here. c is the weapon config, or null for enemy fire.
Ph.impact = function (x, y, z, dx, dy, dz, c) {
  var s = Ph.surface(x, y, z), heavy = c && (c.id === 'mr' || c.id === 'sg' || c.kind === 'bolt'), k = s.kind; Ph.misses++; Ph.lastKind = k;
  if (k === 'water') { FX.burst(x, 0.15, z, 5, 0xcfeeee, 2.6, 0.4, 9, 0.1, 2.5); if (JO.Wildlife) JO.Wildlife.ripple(x, z, 0.8); A.playAt('splash', x, z, 0.7); return k; }
  var L = LOOK[k] || LOOK.dirt, ground = !s.box && s.ny > 0.5;
  FX.burst(x, y, z, ground ? 3 : 2, L[0], 2.2, 0.3, 7, 0.1, 1);
  Ph.bits(x + s.nx * 0.05, y + s.ny * 0.05, z + s.nz * 0.05, heavy ? 4 : 2, L[0], heavy ? 3.4 : 2.4, { dx: s.nx * 0.7, dz: s.nz * 0.7, up: 1 + s.ny * 1.5, size: k === 'wood' ? 0.06 : 0.05, sy: k === 'wood' ? 2.6 : 1 });
  if (k === 'stone' || k === 'metal') FX.burst(x, y, z, 2, 0xfff0a0, 4, 0.12, 5, 0.07);
  Ph.decal(k === 'wood' ? 'splinter' : (k === 'stone' ? 'chip' : 'hole'), x, y, z, s.nx, s.ny, s.nz, (heavy ? 0.34 : 0.22) * (k === 'wood' || k === 'stone' ? 1.2 : 1) * (0.8 + Math.random() * 0.4));
  A.playAt(L[1], x, z, c ? 0.9 : 0.5);
  return k;
};
// does a shot pass through a tree crown? leaves come down and whatever roosts there leaves
var lastBranch = 0;
Ph.branch = function (ox, oy, oz, dx, dy, dz, max) {
  if (W.time - lastBranch < 0.12) return null; var T = W.trees, best = null, bt = max;
  for (var i = 0; i < T.length; i++) { var t = T[i], cy = t.h + t.r * 0.25, px = t.x - ox, py = cy - oy, pz = t.z - oz, s = px * dx + py * dy + pz * dz; if (s < 1 || s > bt) continue;
    var qx = px - dx * s, qy = py - dy * s, qz = pz - dz * s, rr = t.r * 0.42; if (qx * qx + qy * qy + qz * qz < rr * rr) { bt = s; best = t; } }
  if (!best) return null; lastBranch = W.time;
  var x = ox + dx * bt, y = oy + dy * bt, z = oz + dz * bt, pal = W.pal || { leaf: [0x3fa544] };
  Ph.bits(x, y, z, 5, pal.leaf[0], 1.6, { grav: 2.2, up: 0.2, size: 0.09, sy: 0.25, life: 3.4 }); if (JO.Wildlife) JO.Wildlife.scatterNear(best.x, best.z, 4);
  return best;
};

/* ---------- bodies ---------- */
// called from Enemy.die: decide how this one falls
Ph.onDie = function (e) {
  if (e.type === 'drone' || e.isBoss || Q.n('bodies') <= 0) { e.rag = false; return; }
  var f = 0, x = 0, z = 0;
  if (e.pushF > 0) { x = e.pushX; z = e.pushZ; f = Math.min(11, 4 + e.pushF * 0.06); e.rvy = 3.5 + Math.min(4, e.pushF * 0.04); }
  else { x = e.hdx || 0; z = e.hdz || 0; f = 2.6; e.rvy = e.pos.y > 0.5 ? 0 : 1.2; }
  e.rag = true; e.cull = 0; e.rvx = x * f; e.rvz = z * f; e.thrown = e.pushF > 0; e.landed = false; e.pushF = 0; e.spin = (Math.random() - 0.5) * 6;
  if (x || z) e.yaw = Math.atan2(-x, -z);                              // falls facing the shot, away from it
  e.charred = e.burnT > 0; Ph.bodies++;
};
// replaces the dissolve for an enemy that left a body
Ph.ragUpdate = function (e, dt) {
  e.deadT += dt; var g = e.mesh;
  if (e.pos.y > 0 || e.rvy > 0) { e.rvy -= 20 * dt; e.pos.y += e.rvy * dt; if (e.thrown) g.rotation.x += e.spin * dt;
    if (e.pos.y <= 0) { e.pos.y = 0; e.rvy = 0; if (!e.landed) { e.landed = true; FX.burst(e.pos.x, 0.1, e.pos.z, 4, 0x8a7a5a, 1.6, 0.4, 2, 0.16, 0.6); A.playAt('thud', e.pos.x, e.pos.z, e.thrown ? 1 : 0.6); if (W.inWater(e.pos.x, e.pos.z) && JO.Wildlife) JO.Wildlife.ripple(e.pos.x, e.pos.z, 1.6); } } }
  else if (!e.landed) { e.landed = true; A.playAt('thud', e.pos.x, e.pos.z, 0.5); }
  if (e.rvx || e.rvz) { e.pos.x += e.rvx * dt; e.pos.z += e.rvz * dt; var k = Math.max(0, 1 - dt * (e.pos.y > 0 ? 0.6 : 5)); e.rvx *= k; e.rvz *= k; if (Math.abs(e.rvx) + Math.abs(e.rvz) < 0.05) e.rvx = e.rvz = 0;
    W.moveCircle(e.pos, e.radius, e.pos.y, false); W.clamp(e.pos, e.radius); }
  g.position.copy(e.pos); g.rotation.y = e.yaw;
  if (e.gfx) {
    if (!e._deathAnim) { e._deathAnim = true; e.gfx.playOnce('death', { full: true, hold: true }); if (e.gun) e.gun.root.visible = false; }
    if (e.pos.y <= 0) g.rotation.x = 0;
    if (!e.gfx.limp) { e.gfx.tint = e.charred ? 0x000000 : 0; e.gfx.update(dt); if (e.deadT > 1.5 && e.landed) e.gfx.limp = true; }      // pose is final: stop paying for the mixer
  } else { if (e.pos.y <= 0) g.rotation.x = Math.max(-1.5, -e.deadT * 5); g.position.y += 0.12; }
  if (!e.cull && e.deadT > 45) e.cull = 0.001;
  if (e.cull > 0) { e.cull += dt; var q = e.cull / 0.7;
    if (e.gfx) e.gfx.setDissolve(q); else for (var i = 0; i < e.mats.length; i++) e.mats[i].opacity = Math.max(0, 1 - q);
    if (q >= 1) { e.rag = false; if (e.gfx) e.gfx.limp = false; JO.Enemies.release(e); } }
};
// keep only the newest few bodies, and none that are far behind
var cullT = 0;
Ph.cullBodies = function (dt) {
  cullT -= dt; if (cullT > 0) return; cullT = 0.5;
  var L = JO.Enemies.list, P = JO.Player, cap = Q.n('bodies'), n = 0, old = null, i;
  for (i = 0; i < L.length; i++) { var e = L[i]; if (!e.rag || e.cull > 0) continue;
    if (Math.abs(e.pos.z - P.pos.z) > 75) { e.cull = 0.001; continue; }
    n++; if (!old || e.deadT > old.deadT) old = e; }
  if (n > cap && old) old.cull = 0.001;
  Ph.lying = n;
};

/* ---------- weapon feel ---------- */
// sideways walk of the recoil for each shot of a burst
var PATTERN = { ar: [0, 0.3, -0.2, 0.5, 0.7, 0.2, -0.5, -0.8, -0.3, 0.4], sg: [0.6, -0.6], mr: [0.3, -0.3], xb: [0], ft: [0] };
Ph.shot = function (c, mx, my, mz) {
  var P = JO.Player, Cam = JO.Cam, I = JO.Input;
  if (Ph.burstT <= 0) Ph.burst = 0; Ph.burstT = 0.32;
  var pat = PATTERN[c.id] || PATTERN.ar, k = pat[Ph.burst % pat.length]; Ph.burst++;
  if (!I.external) P.yaw += k * c.recoil * 0.55 * (I.ads ? 0.6 : 1) * (JO.Perks.recoil ? JO.Perks.recoil(c.id) : 1);
  if (c.kind !== 'bolt' && Q.n('shells') > 0) Ph.bits(mx - Cam.fx * 0.35, my, mz - Cam.fz * 0.35, 1, c.id === 'sg' ? 0xb03020 : 0xd8b040, 2.2, { dx: Cam.rx * 1.2, dz: Cam.rz * 1.2, up: 2.4, size: 0.035, sz: 2.4, life: 3.5 });
  Ph.branch(Cam.x, Cam.y, Cam.z, Cam.fx, Cam.fy, Cam.fz, 60);
};
// one fuel tick of the flamethrower
Ph.flameTick = function (c, mx, my, mz) {
  var Cam = JO.Cam; Ph.heat = Math.min(1, Ph.heat + 0.0125); Ph.coolT = 0.5;
  if (Ph.heat >= 1 && !Ph.overheated) { Ph.overheated = true; A.play('gas', 0.8); if (JO.UI) JO.UI.banner('FLAMETHROWER OVERHEATED', 1.4, true); Ev.emit('overheat'); }
  if (++Ph.flameN % 9 === 0) { var t = W.raycast(mx, my, mz, Cam.fx, Cam.fy, Cam.fz, c.range); if (t < c.range) { var x = mx + Cam.fx * t, y = my + Cam.fy * t, z = mz + Cam.fz * t, s = Ph.surface(x, y, z); if (s.kind !== 'water') Ph.decal('scorch', x, y, z, s.nx, s.ny, s.nz, 0.9 + Math.random() * 0.5); } }
};
// an enemy round went past the player's head
var whizT = 0;
Ph.nearMiss = function (x, z) { if (whizT > 0) return; whizT = 0.12; Ph.whiz = (Ph.whiz | 0) + 1; A.play('whiz', 0.8 + Math.random() * 0.4); if (JO.Feel) JO.Feel.trauma(0.12); else FX.addShake(0.08); Ev.emit('near_whiz', x, z); };

/* ---------- system ---------- */
var heatEl = null, heatFill = null, heatShown = null, heatK = -1;
JO.Sys.add('physical', {
  init: function () {
    scene = W.scene;
    bMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), BN); bMesh.frustumCulled = false;
    for (var i = 0; i < BN; i++) { bMesh.setMatrixAt(i, ZERO); bMesh.setColorAt(i, col.setHex(0xffffff)); } bMesh.instanceMatrix.needsUpdate = true; scene.add(bMesh);
    buildDecals(); heatEl = document.getElementById('heat'); heatFill = document.getElementById('heatFill');
    var S2 = A.sounds, tone = A.tone, noise = A.noise;
    S2.whiz = function (v) { noise({ dur: 0.14, vol: 0.3 * v, f: 5200, f2: 1400, type: 'bandpass', q: 3 }); tone({ f: 2400, f2: 900, dur: 0.12, vol: 0.06 * v, type: 'sine' }); };
    S2.hitWood = function (v) { tone({ f: 260, f2: 150, dur: 0.05, vol: 0.2 * v, type: 'triangle' }); noise({ dur: 0.05, vol: 0.16 * v, f: 1800, type: 'bandpass' }); };
    S2.hitStone = function (v) { noise({ dur: 0.05, vol: 0.2 * v, f: 4200, type: 'highpass' }); tone({ f: 1800, f2: 2600, dur: 0.06, vol: 0.05 * v, type: 'sine' }); };
    S2.hitDirt = function (v) { noise({ dur: 0.07, vol: 0.2 * v, f: 700, f2: 300 }); };
    S2.ricochet = function (v) { tone({ f: 2600, f2: 900, dur: 0.22, vol: 0.12 * v, type: 'sine' }); noise({ dur: 0.04, vol: 0.2 * v, f: 5000, type: 'highpass' }); };
    S2.thud = function (v) { tone({ f: 80, f2: 45, dur: 0.14, vol: 0.4 * v, type: 'sine' }); noise({ dur: 0.1, vol: 0.14 * v, f: 380 }); };
    Ev.on('blast', function (x, z, r) { var s = Ph.surface(x, 0.02, z); if (s.kind !== 'water') Ph.decal('scorch', x, 0.02, z, 0, 1, 0, Math.max(1.6, (r || 3) * 0.75));
      Ph.bits(x, 0.3, z, 8, s.kind === 'stone' ? 0x7a7a74 : 0x5a4a34, 6, { up: 4, size: 0.1 }); });
    Ev.on('level_load', function () { clearDecals(); for (var i = 0; i < BN; i++) { bLife[i] = 0; bMesh.setMatrixAt(i, ZERO); } bMesh.instanceMatrix.needsUpdate = true; Ph.heat = 0; Ph.overheated = false; Ph.burst = 0; });
    Ev.on('retry', function () { Ph.heat = 0; Ph.overheated = false; });
    Ev.on('prop_destroyed', function (kind, by, x, z) { if (x !== undefined) Ph.bits(x, 0.7, z, 10, kind === 'barrel' ? 0x8a2a1a : 0x9a7446, 5, { up: 3.5, size: 0.12, sy: kind === 'barrel' ? 1 : 2.2 }); });
  },
  step: function (dt) {
    if (Ph.burstT > 0) Ph.burstT -= dt; if (whizT > 0) whizT -= dt;
    if (Ph.coolT > 0) Ph.coolT -= dt; else if (Ph.heat > 0) Ph.heat = Math.max(0, Ph.heat - dt * 0.22);
    if (Ph.overheated && Ph.heat < 0.35) Ph.overheated = false;
    Ph.cullBodies(dt);
    // marksman sway: slow figure of eight while aiming, calmer when crouched
    var I = JO.Input, P = JO.Player, Wp = JO.Weapons, t = W.time;
    var amp = I.ads && Wp.cur === 2 && !I.external ? (P.crouch ? 0.0016 : 0.0042) : 0; Ph.swayX = Math.sin(t * 0.9) * amp; Ph.swayY = Math.sin(t * 1.8 + 0.6) * amp * 0.7;
  },
  frame: function (dt) {
    if (dt > 0) updateBits(dt);
    if (!heatEl) return; var show = JO.Weapons.cur === 4 && JO.Game.state === 'playing';
    if (show !== heatShown) { heatShown = show; heatEl.classList.toggle('hidden', !show); }
    if (show) { var k = Math.round(Ph.heat * 50); if (k !== heatK) { heatK = k; heatFill.style.transform = 'scaleX(' + (k / 50) + ')'; heatFill.style.background = Ph.overheated ? '#ff4a3a' : ''; } }
  }
});
})();
