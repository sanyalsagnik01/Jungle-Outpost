/* ============================================================
   JUNGLE OUTPOST — world.js
   Renderer, lights, the procedural level builder (instanced
   low-poly scenery), colliders, ray casting and movement
   collision. Levels are built from JO.CFG.LEVELS data.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO;
var W = JO.World = {
  colliders: [], cover: [], anim: [], checkpoints: [], crates: [], towers: [], waters: [], owned: [],
  scene: null, camera: null, renderer: null, group: null, arena: null, barriers: null, flag: null,
  A0: 0, A1: 0, AC: 0, zMax: 8, zMin: -300, pathHW: 17, arenaHW: 26, exitHW: 9, time: 0
};
var renderer, scene, camera, hemi, sun, dome, domeMat;
var dummy = new THREE.Object3D(), col = new THREE.Color(), col2 = new THREE.Color();
var sunOff = new THREE.Vector3(20, 40, 15);

function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function flat(g) { var n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals(); return n; }

// shared low-poly primitives (never disposed)
var G = W.G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: flat(new THREE.CylinderGeometry(0.5, 0.5, 1, 7)),
  trunk: flat(new THREE.CylinderGeometry(0.34, 0.5, 1, 6)),
  cone: flat(new THREE.ConeGeometry(0.5, 1, 7)),
  ico: flat(new THREE.IcosahedronGeometry(0.5, 1)),
  ico0: flat(new THREE.IcosahedronGeometry(0.5, 0)),
  rock: flat(new THREE.DodecahedronGeometry(0.5, 0)),
  disc: new THREE.CylinderGeometry(1, 1, 0.02, 14)
};

/* ---------- init / resize ---------- */
W.init = function (canvas) {
  renderer = W.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = W.scene = new THREE.Scene();
  camera = W.camera = new THREE.PerspectiveCamera(65, 1, 0.1, 700);
  hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xffffff, 1); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  var sc = sun.shadow.camera; sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 130;
  sun.shadow.bias = -0.0015;
  scene.add(sun); scene.add(sun.target);
  var dg = new THREE.SphereGeometry(320, 16, 10);
  dg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(dg.attributes.position.count * 3), 3));
  domeMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  dome = new THREE.Mesh(dg, domeMat); dome.frustumCulled = false; dome.renderOrder = -10; scene.add(dome);
  W.resize();
};
W.resize = function () {
  var w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
};
W.updateSun = function (px, pz) {
  sun.position.set(px + sunOff.x, sunOff.y, pz + sunOff.z); sun.target.position.set(px, 0, pz); sun.target.updateMatrixWorld();
  dome.position.copy(camera.position);
};

/* ---------- colliders ---------- */
W.addBox = function (x, z, hx, hz, h, o) {
  var c = { minx: x - hx, maxx: x + hx, minz: z - hz, maxz: z + hz, y0: (o && o.y0) || 0, h: h, on: true };
  W.colliders.push(c);
  if (o && o.cover) W.cover.push({ x: x, z: z, r: Math.max(hx, hz) });
  return c;
};
W.halfWidth = function (z) { return z > W.A0 ? W.pathHW : (z > W.A1 ? W.arenaHW : W.exitHW); };
W.clamp = function (p, r) {
  var hw = W.halfWidth(p.z) - r;
  if (p.x > hw) p.x = hw; else if (p.x < -hw) p.x = -hw;
  if (p.z > W.zMax - r) p.z = W.zMax - r; else if (p.z < W.zMin + r) p.z = W.zMin + r;
};
// Ray vs world (ground + boxes). Direction must be normalized. Returns hit distance or max.
W.raycast = function (ox, oy, oz, dx, dy, dz, max) {
  var best = max, cs = W.colliders, i, c, t0, t1, a, b, inv, s;
  if (dy < -1e-6) { a = -oy / dy; if (a >= 0 && a < best) best = a; }
  for (i = 0; i < cs.length; i++) {
    c = cs[i]; if (!c.on) continue; t0 = 0; t1 = best;
    if (dx > -1e-8 && dx < 1e-8) { if (ox < c.minx || ox > c.maxx) continue; }
    else { inv = 1 / dx; a = (c.minx - ox) * inv; b = (c.maxx - ox) * inv; if (a > b) { s = a; a = b; b = s; } if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) continue; }
    if (dz > -1e-8 && dz < 1e-8) { if (oz < c.minz || oz > c.maxz) continue; }
    else { inv = 1 / dz; a = (c.minz - oz) * inv; b = (c.maxz - oz) * inv; if (a > b) { s = a; a = b; b = s; } if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) continue; }
    if (dy > -1e-8 && dy < 1e-8) { if (oy < c.y0 || oy > c.h) continue; }
    else { inv = 1 / dy; a = (c.y0 - oy) * inv; b = (c.h - oy) * inv; if (a > b) { s = a; a = b; b = s; } if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) continue; }
    best = t0;
  }
  return best;
};
// Push a circle out of boxes; returns the floor height under it (tops it may stand on).
W.moveCircle = function (p, r, feetY, canClimb) {
  var cs = W.colliders, floor = 0, i, c, cx, cz, dx, dz, d2, d, px, pz;
  for (i = 0; i < cs.length; i++) {
    c = cs[i]; if (!c.on) continue;
    if (p.x < c.minx - r || p.x > c.maxx + r || p.z < c.minz - r || p.z > c.maxz + r) continue;
    if (feetY + 1.7 < c.y0) continue;                       // passes underneath (tower platforms)
    cx = p.x < c.minx ? c.minx : (p.x > c.maxx ? c.maxx : p.x);
    cz = p.z < c.minz ? c.minz : (p.z > c.maxz ? c.maxz : p.z);
    dx = p.x - cx; dz = p.z - cz; d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (canClimb && feetY >= c.h - 0.06) { if (d2 < r * r * 0.5 && c.h > floor) floor = c.h; continue; }
    if (d2 > 1e-8) { d = Math.sqrt(d2); p.x = cx + dx / d * r; p.z = cz + dz / d * r; }
    else { px = Math.min(p.x - c.minx, c.maxx - p.x); pz = Math.min(p.z - c.minz, c.maxz - p.z);
      if (px < pz) p.x = (p.x - c.minx < c.maxx - p.x) ? c.minx - r : c.maxx + r;
      else p.z = (p.z - c.minz < c.maxz - p.z) ? c.minz - r : c.maxz + r; }
  }
  return floor;
};
W.inWater = function (x, z) {
  for (var i = 0; i < W.waters.length; i++) { var w = W.waters[i];
    if (x > w.x0 && x < w.x1 && z > w.z1 && z < w.z0 && !(w.bridge && x > -2.5 && x < 2.5)) return true; }
  return false;
};

/* ---------- instanced batch (chunked along Z so frustum culling works) ---------- */
function Batch(kind, matOpts) { this.m = {}; this.kind = kind || 'l'; this.matOpts = matOpts; this.mats = []; }
Batch.prototype.add = function (key, x, y, z, sx, sy, sz, color, ry, rx, rz) {
  var k = key + '|' + Math.max(0, Math.floor(-z / 70));
  (this.m[k] || (this.m[k] = [])).push(x, y, z, sx, sy, sz, color, ry || 0, rx || 0, rz || 0);
};
Batch.prototype.build = function (group) {
  for (var k in this.m) {
    var a = this.m[k], n = a.length / 10, parts = k.split('|'), chunk = +parts[1];
    var geo = G[parts[0]].clone();
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 6, -(chunk + 0.5) * 70), 85);
    var mat = this.kind === 'b' ? new THREE.MeshBasicMaterial(this.matOpts || {}) : new THREE.MeshLambertMaterial();
    var mesh = new THREE.InstancedMesh(geo, mat, n);
    for (var i = 0; i < n; i++) { var o = i * 10;
      dummy.position.set(a[o], a[o + 1], a[o + 2]); dummy.scale.set(a[o + 3], a[o + 4], a[o + 5]);
      dummy.rotation.set(a[o + 8], a[o + 7], a[o + 9]); dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix); col.setHex(a[o + 6]); mesh.setColorAt(i, col); }
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.matrixAutoUpdate = false;
    group.add(mesh); W.owned.push(geo, mat); this.mats.push(mat);
  }
};
function shade(hex, f) { col2.setHex(hex).multiplyScalar(f); return col2.getHex(); }
function lam(c, o) { var m = new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {})); W.owned.push(m); return m; }
function bas(c, o) { var m = new THREE.MeshBasicMaterial(Object.assign({ color: c }, o || {})); W.owned.push(m); return m; }

W.unload = function () {
  if (W.group) scene.remove(W.group);
  for (var i = 0; i < W.owned.length; i++) W.owned[i].dispose();
  W.owned.length = 0; W.colliders.length = 0; W.cover.length = 0; W.anim.length = 0; W.checkpoints.length = 0;
  W.crates.length = 0; W.towers.length = 0; W.waters.length = 0; W.group = null; W.flag = null; W.barriers = null;
};

/* ============================================================
   LEVEL BUILDER
   ============================================================ */
W.build = function (L) {
  W.unload();
  var g = W.group = new THREE.Group(); scene.add(g);
  var pal = L.pal, rng = mulberry(L.seed * 7919 + 13);
  var b = new Batch('l'), bf = new Batch('b'), bg = new Batch('b', { transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending });
  var A0 = W.A0 = -(L.len + 10), A1 = W.A1 = A0 - 62, AC = W.AC = (A0 + A1) / 2;
  W.zMax = 8; W.zMin = A1 - 24; W.level = L; W.time = 0;
  var WOOD = 0x7a5a36, WOODD = 0x5a4026, STONE = pal.rock, SAND = 0xb9a474;

  // lights / sky / fog
  scene.fog = new THREE.Fog(pal.fog, pal.fogNear, pal.fogFar); scene.background = new THREE.Color(pal.fog);
  hemi.color.setHex(pal.hemiSky); hemi.groundColor.setHex(pal.hemiGround); hemi.intensity = pal.hemiI;
  sun.color.setHex(pal.sun); sun.intensity = pal.sunI;
  sunOff.set(pal.sunDir[0], pal.sunDir[1], pal.sunDir[2]).normalize().multiplyScalar(55);
  var dp = dome.geometry.attributes.position, dc = dome.geometry.attributes.color, i;
  for (i = 0; i < dp.count; i++) { var ty = Math.max(0, Math.min(1, dp.getY(i) / 200));
    col.setHex(pal.fog).lerp(col2.setHex(pal.skyTop), Math.pow(ty, 0.6)); dc.setXYZ(i, col.r, col.g, col.b); }
  dc.needsUpdate = true;

  // reserved circles keep scenery off spawns / props
  var res = [];
  function reserve(x, z, r) { res.push(x, z, r); }
  function free(x, z, r) { for (var k = 0; k < res.length; k += 3) { var dx = x - res[k], dz = z - res[k + 1], rr = r + res[k + 2];
    if (dx * dx + dz * dz < rr * rr) return false; } return true; }
  function inRiver(z) { return L.river && z < L.river.z0 + 2 && z > L.river.z1 - 2; }

  /* ----- ground (vertex colored) ----- */
  var zTop = W.zMax + 34, zBot = W.zMin - 34, totalLen = zTop - zBot, cz = (zTop + zBot) / 2;
  var gg = new THREE.PlaneGeometry(150, totalLen, 60, Math.round(totalLen / 2.5)); gg.rotateX(-Math.PI / 2);
  var gp = gg.attributes.position, gc = new Float32Array(gp.count * 3);
  for (i = 0; i < gp.count; i++) {
    var gx = gp.getX(i), gz = gp.getZ(i) + cz;
    col.setHex(pal.ground[(rng() * pal.ground.length) | 0]);
    if (gz > A0 && Math.abs(gx - Math.sin(gz * 0.07) * 1.2) < 2.7) col.lerp(col2.setHex(pal.path), 0.85);
    if (gz <= A0 + 1 && gz >= A1 - 1 && Math.abs(gx) < 27.5) col.setHex(pal.arena);
    if (gz < A1 - 1 && Math.abs(gx) < 9.5) col.lerp(col2.setHex(pal.path), 0.85);
    if (L.river && gz < L.river.z0 + 1 && gz > L.river.z1 - 1) col.multiplyScalar(0.55);
    col.multiplyScalar(0.9 + rng() * 0.2); gc[i * 3] = col.r; gc[i * 3 + 1] = col.g; gc[i * 3 + 2] = col.b;
  }
  gg.setAttribute('color', new THREE.BufferAttribute(gc, 3));
  var gm = new THREE.MeshLambertMaterial({ vertexColors: true }); W.owned.push(gg, gm);
  var ground = new THREE.Mesh(gg, gm); ground.position.z = cz; ground.receiveShadow = true; g.add(ground);

  /* ----- scenery helpers ----- */
  function tree(x, z, big) {
    var h = (big ? 7 : 5.2) + rng() * 3, tr = 0.55 + rng() * 0.35;
    b.add('trunk', x, h / 2, z, tr * 1.3, h, tr * 1.3, shade(pal.trunk, 0.85 + rng() * 0.3), rng() * 6);
    var leaf = pal.leaf[(rng() * pal.leaf.length) | 0], cr = (big ? 6 : 4.2) + rng() * 2.2;
    if (rng() < 0.62) {
      b.add('ico', x, h + cr * 0.22, z, cr, cr * 0.72, cr, leaf, rng() * 6);
      b.add('ico', x + (rng() - 0.5) * 2.4, h + cr * 0.6, z + (rng() - 0.5) * 2.4, cr * 0.66, cr * 0.55, cr * 0.66, shade(leaf, 1.12), rng() * 6);
    } else {
      b.add('cone', x, h + cr * 0.3, z, cr, cr * 0.95, cr, leaf, rng() * 6);
      b.add('cone', x, h + cr * 0.85, z, cr * 0.7, cr * 0.8, cr * 0.7, shade(leaf, 1.1), rng() * 6);
    }
    var nv = (rng() * 3) | 0;                                   // hanging vines
    for (var v = 0; v < nv; v++) { var vl = 1.4 + rng() * 2.2, va = rng() * 6.28, vr = cr * 0.3 * rng() + 0.6;
      b.add('box', x + Math.cos(va) * vr, h - vl / 2 + 0.3, z + Math.sin(va) * vr, 0.07, vl, 0.07, shade(leaf, 0.7)); }
  }
  function bush(x, z, s) { b.add('ico0', x, s * 0.32, z, s * 1.5, s * 0.8, s * 1.5, shade(pal.leaf[(rng() * pal.leaf.length) | 0], 0.9 + rng() * 0.25), rng() * 6); }
  function rock(x, z, s) { b.add('rock', x, s * 0.42, z, s * 1.7, s * 1.15, s * 1.7, shade(STONE, 0.85 + rng() * 0.3), rng() * 6, rng() * 0.4);
    W.addBox(x, z, s * 0.62, s * 0.62, s * 0.9, { cover: s > 1.15 }); }
  function sandbag(x, z, rot) {
    var lx = rot ? 0 : 1, lz = rot ? 1 : 0;
    for (var row = 0; row < 3; row++) for (var k = -1; k <= 1; k++) { var off = k * 0.98 + (row % 2 ? 0.45 : 0);
      if (row === 2 && k === 1) continue;
      b.add('box', x + lx * off, 0.21 + row * 0.42, z + lz * off, rot ? 0.72 : 0.94, 0.4, rot ? 0.94 : 0.72, shade(SAND, 0.85 + rng() * 0.25), (rng() - 0.5) * 0.1); }
    W.addBox(x, z, rot ? 0.42 : 1.55, rot ? 1.55 : 0.42, 1.27, { cover: true });
  }
  function crateStack(x, z, tall) {
    var s = 1.3; b.add('box', x, s / 2, z, s, s, s, shade(WOOD, 0.9 + rng() * 0.2), rng() * 0.2);
    b.add('box', x, s / 2, z, s + 0.06, 0.12, s + 0.06, WOODD);
    var top = s;
    if (tall || rng() < 0.4) { b.add('box', x, s * 1.5, z, s * 0.95, s, s * 0.95, shade(WOOD, 1.05), 0.3); top = s * 2; }
    W.addBox(x, z, s / 2, s / 2, top, { cover: true });
    if (!tall && rng() < 0.6) { var x2 = x + (rng() < 0.5 ? -1.36 : 1.36); b.add('box', x2, 0.55, z + 0.1, 1.1, 1.1, 1.1, shade(WOOD, 0.8), 0.1); W.addBox(x2, z + 0.1, 0.55, 0.55, 1.1); }
  }
  function ruin(x, z, rot) {
    var segs = 2 + ((rng() * 2) | 0);
    for (var k = 0; k < segs; k++) { var h = 1.5 + rng() * 2.2, o = (k - (segs - 1) / 2) * 1.7, px = x + (rot ? 0 : o), pz = z + (rot ? o : 0);
      b.add('box', px, h / 2, pz, rot ? 0.8 : 1.7, h, rot ? 1.7 : 0.8, shade(STONE, 0.8 + rng() * 0.3));
      if (rng() < 0.5) b.add('box', px, h + 0.2, pz, 0.7, 0.4, 0.7, shade(STONE, 0.7), rng());
      W.addBox(px, pz, rot ? 0.4 : 0.85, rot ? 0.85 : 0.4, h); }
    W.cover.push({ x: x, z: z, r: 1.2 });
  }
  function pillar(x, z, h, wd) {
    wd = wd || 2.2; b.add('box', x, h / 2, z, wd, h, wd, shade(STONE, 0.85 + rng() * 0.2));
    b.add('box', x, 0.25, z, wd + 0.5, 0.5, wd + 0.5, shade(STONE, 0.7));
    b.add('box', x, h + 0.2, z, wd + 0.4, 0.4, wd + 0.4, shade(STONE, 0.95), rng() * 0.3);
    W.addBox(x, z, wd / 2, wd / 2, h, { cover: true }); W.arena.pillars.push({ x: x, z: z });
  }
  function tower(x, z) {
    for (var sx = -1; sx <= 1; sx += 2) for (var sz = -1; sz <= 1; sz += 2) {
      b.add('box', x + sx * 1.35, 2.4, z + sz * 1.35, 0.26, 4.8, 0.26, WOODD);
      b.add('box', x + sx * 1.45, 5.9, z + sz * 1.45, 0.14, 2.1, 0.14, WOODD); }
    b.add('box', x, 4.76, z, 3.4, 0.24, 3.4, WOOD);
    b.add('box', x, 5.35, z - 1.6, 3.3, 0.12, 0.1, WOODD); b.add('box', x, 5.35, z + 1.6, 3.3, 0.12, 0.1, WOODD);
    b.add('box', x - 1.6, 5.35, z, 0.1, 0.12, 3.3, WOODD); b.add('box', x + 1.6, 5.35, z, 0.1, 0.12, 3.3, WOODD);
    b.add('cone', x, 7.6, z, 5.6, 1.5, 5.6, 0x8a7a3c, Math.PI / 4);
    for (var r = 0; r < 7; r++) b.add('box', x + 1.75, 0.5 + r * 0.65, z, 0.08, 0.08, 0.7, WOOD);
    W.addBox(x, z, 1.7, 1.7, 4.88, { y0: 4.6 });
    W.towers.push({ x: x, z: z, y: 4.88 }); reserve(x, z, 3);
  }
  function torch(x, z) {
    b.add('cyl', x, 1.15, z, 0.14, 2.3, 0.14, WOODD); b.add('cone', x, 2.3, z, 0.5, 0.4, 0.5, 0x333333, 0, Math.PI);
    bf.add('cone', x, 2.85, z, 0.42, 0.95, 0.42, 0xff8a20); bf.add('cone', x, 2.75, z, 0.24, 0.6, 0.24, 0xffe070);
    bg.add('disc', x, 0.06, z, 3.6, 1, 3.6, 0xb85a18);
  }

  /* ----- sniper towers, supply crates, checkpoints ----- */
  L.zones.forEach(function (zn) { zn.spawns.forEach(function (s) {
    reserve(s[1], s[2], 2.4);
    if (s[0] === 'sniper') { tower(s[1], s[2]); if (s[3] && s[3].alt) { tower(s[3].alt[0], s[3].alt[1]);
      var ax = s[3].alt[0] - s[1], az = s[3].alt[1] - s[2];        // zip-line between the two perches
      b.add('box', s[1] + ax / 2, 6.55, s[2] + az / 2, 0.05, 0.05, Math.hypot(ax, az), 0x222222, Math.atan2(ax, az)); } }
  }); });
  var crateMat = lam(0xc9952a), crateDark = lam(0x3a3a2a);
  (L.crates || []).forEach(function (c) {
    var grp = new THREE.Group(); grp.position.set(c[0], 0, c[1]);
    var base = new THREE.Mesh(G.box, crateMat); base.scale.set(1.3, 0.8, 0.9); base.position.y = 0.4; grp.add(base);
    var band = new THREE.Mesh(G.box, crateDark); band.scale.set(1.34, 0.14, 0.94); band.position.y = 0.4; grp.add(band);
    var lid = new THREE.Group(); lid.position.set(0, 0.8, -0.45); grp.add(lid);
    var lm = new THREE.Mesh(G.box, crateMat); lm.scale.set(1.3, 0.14, 0.9); lm.position.set(0, 0.07, 0.45); lid.add(lm);
    g.add(grp); W.addBox(c[0], c[1], 0.65, 0.45, 0.94); reserve(c[0], c[1], 2.2);
    W.crates.push({ x: c[0], z: c[1], opened: false, lid: lid, openT: 0 });
  });
  (L.pickups || []).forEach(function (p) { reserve(p[1], p[2], 1.6); });

  function makeFlag(x, z, color, big) {
    var grp = new THREE.Group(); grp.position.set(x, 0, z); var h = big ? 6 : 4.2;
    var pole = new THREE.Mesh(G.cyl, lam(0xdddddd)); pole.scale.set(0.12, h, 0.12); pole.position.y = h / 2; grp.add(pole);
    var cm = bas(color, { side: THREE.DoubleSide }); var cloth = new THREE.Mesh(G.box, cm);
    cloth.scale.set(big ? 2 : 1.4, big ? 1.2 : 0.85, 0.05); cloth.position.set((big ? 1 : 0.7), h - (big ? 0.7 : 0.5), 0);
    var pivot = new THREE.Group(); pivot.add(cloth); grp.add(pivot);
    var bm = bas(color, { transparent: true, opacity: 0.16, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
    var beam = new THREE.Mesh(G.cyl, bm); beam.scale.set(big ? 2.6 : 1.5, 40, big ? 2.6 : 1.5); beam.position.y = 20; grp.add(beam);
    var rm = bas(color, { transparent: true, opacity: 0.35, depthWrite: false });
    var ring = new THREE.Mesh(G.disc, rm); ring.scale.set(big ? 3 : 2, 1, big ? 3 : 2); ring.position.y = 0.05; grp.add(ring);
    g.add(grp); return { grp: grp, pivot: pivot, cm: cm, bm: bm, rm: rm, x: x, z: z };
  }
  [L.zones[0].z1 - 8, L.zones[1].z1 - 8, A0 + 10].forEach(function (z, k) {
    var f = makeFlag(3.4, z, 0xffb62e, false); reserve(3.4, z, 2.5);
    W.checkpoints.push({ z: z, reached: false, flag: f, idx: k });
  });

  /* ----- zone cover ----- */
  L.zones.forEach(function (zn) {
    for (var n = 0; n < zn.cover; n++) for (var tries = 0; tries < 14; tries++) {
      var x = (rng() < 0.5 ? -1 : 1) * (1.6 + rng() * 11.5), z = zn.z1 + 4 + rng() * (zn.z0 - zn.z1 - 8);
      if (!free(x, z, 3.2) || inRiver(z)) continue;
      var r = rng();
      if (r < 0.4) sandbag(x, z, rng() < 0.25); else if (r < 0.68) crateStack(x, z); else if (r < 0.84) rock(x, z, 1.3 + rng() * 0.5); else ruin(x, z, rng() < 0.3);
      reserve(x, z, 3); break;
    }
  });

  /* ----- river + bridge ----- */
  function addWater(x0, x1, z0, z1, bridge) {
    var wg = new THREE.PlaneGeometry(x1 - x0, z0 - z1, 26, 6); wg.rotateX(-Math.PI / 2);
    var wm = new THREE.MeshLambertMaterial({ color: 0x3f8f95, transparent: true, opacity: 0.68, emissive: 0x0d2c30 }); W.owned.push(wg, wm);
    var mesh = new THREE.Mesh(wg, wm); mesh.position.set((x0 + x1) / 2, 0.09, (z0 + z1) / 2); g.add(mesh);
    W.waters.push({ x0: x0, x1: x1, z0: z0, z1: z1, bridge: bridge });
    var wp = wg.attributes.position, streaks = [], sm = bas(0xdff6f2, { transparent: true, opacity: 0.5, depthWrite: false });
    for (var k = 0; k < 9; k++) { var s = new THREE.Mesh(G.box, sm); s.scale.set(1.5 + rng() * 2.5, 0.02, 0.09);
      s.position.set(x0 + rng() * (x1 - x0), 0.16, z1 + 0.8 + rng() * (z0 - z1 - 1.6)); s.userData.v = 1.2 + rng() * 1.6; g.add(s); streaks.push(s); }
    W.anim.push(function (dt, t) {
      for (var v = 0; v < wp.count; v++) wp.setY(v, Math.sin(wp.getX(v) * 0.55 + t * 1.7) * 0.05 + Math.sin(wp.getZ(v) * 1.1 + t * 1.2) * 0.04);
      wp.needsUpdate = true;
      for (var q = 0; q < streaks.length; q++) { var st = streaks[q]; st.position.x += st.userData.v * dt; if (st.position.x > x1) st.position.x = x0; }
    });
  }
  if (L.river) {
    var R = L.river; addWater(-40, 40, R.z0, R.z1, true);
    for (var bz = R.z0 + 1; bz > R.z1 - 1.01; bz -= 0.8) b.add('box', 0, 0.2, bz, 5, 0.12, 0.7, shade(WOOD, 0.85 + rng() * 0.25), (rng() - 0.5) * 0.04);
    for (var pz = R.z0 + 1; pz > R.z1 - 1.01; pz -= 3.2) { b.add('box', -2.45, 0.7, pz, 0.16, 1.4, 0.16, WOODD); b.add('box', 2.45, 0.7, pz, 0.16, 1.4, 0.16, WOODD); }
    var bl = R.z0 - R.z1 + 2, bm2 = (R.z0 + R.z1) / 2;
    b.add('box', -2.45, 1.3, bm2, 0.1, 0.1, bl, WOOD); b.add('box', 2.45, 1.3, bm2, 0.1, 0.1, bl, WOOD);
    for (i = 0; i < 10; i++) { var rx = (rng() < 0.5 ? -1 : 1) * (4 + rng() * 12); b.add('rock', rx, 0.2, R.z1 + rng() * (R.z0 - R.z1), 1.2, 0.7, 1.2, shade(STONE, 0.8), rng() * 6); }
  }

  /* ----- interior scatter ----- */
  for (var z = -5; z > A0 + 7; z -= 3.1) {
    if (inRiver(z)) continue;
    var x;
    if (rng() < 0.62) { x = (rng() < 0.5 ? -1 : 1) * (4.2 + rng() * 12); var zz = z + rng() * 2;
      if (free(x, zz, 2.6)) { tree(x, zz, false); reserve(x, zz, 1.8); W.addBox(x, zz, 0.42, 0.42, 5); W.cover.push({ x: x, z: zz, r: 0.5 }); } }
    for (var k2 = 0; k2 < 2; k2++) { x = (rng() < 0.5 ? -1 : 1) * (3.4 + rng() * 13); if (free(x, z, 1.2)) bush(x, z + rng() * 3, 0.7 + rng() * 0.9); }
    if (rng() < 0.14) { x = (rng() < 0.5 ? -1 : 1) * (4 + rng() * 12); if (free(x, z, 2.4)) { rock(x, z, 0.7 + rng() * 0.8); reserve(x, z, 1.6); } }
    if (L.torches && Math.round(-z / 3.1) % 5 === 0) { torch(-4.6, z); torch(4.6, z - 7); }
  }

  /* ----- boundary jungle ----- */
  for (z = W.zMax + 10; z > W.zMin - 12; z -= 2.5) {
    var inner = z > A0 - 1 ? 18.8 : (z > A1 + 1 ? 29.5 : 11.2);
    for (var side = -1; side <= 1; side += 2) {
      tree(side * (inner + rng() * 5.5), z + rng() * 2, true);
      if (rng() < 0.75) bush(side * (inner - 1.2 + rng() * 2.2), z + rng() * 2, 1.5 + rng() * 1.2);
      if (rng() < 0.3) tree(side * (inner + 7 + rng() * 6), z, true);
    }
  }
  for (x = -34; x <= 34; x += 3) { tree(x, W.zMax + 5 + rng() * 5, true); tree(x, W.zMin - 5 - rng() * 5, true); bush(x, W.zMax + 2.5, 2); }
  for (z = W.zMax + 10; z > W.zMin - 12; z -= 20) { var hw = z > A0 ? 25.5 : (z > A1 ? 37 : 18);
    b.add('box', -hw, 4, z - 10, 3, 8, 20.2, pal.hedge); b.add('box', hw, 4, z - 10, 3, 8, 20.2, pal.hedge); }
  b.add('box', 0, 4, W.zMax + 12, 80, 8, 3, pal.hedge); b.add('box', 0, 4, W.zMin - 12, 80, 8, 3, pal.hedge);

  /* ----- boss arena ----- */
  W.arena = { cx: 0, cz: AC, hw: W.arenaHW, z0: A0, z1: A1, pillars: [], spots: [] };
  var wallC = pal.wall;
  for (z = A0; z > A1 - 0.1; z -= 2) for (side = -1; side <= 1; side += 2) { var wh = 5 + rng() * 1.4;
    b.add('box', side * 27.4, wh / 2, z - 1, 1.4, wh, 2.05, shade(wallC, 0.82 + rng() * 0.3)); }
  [A0, A1].forEach(function (wz) {
    for (var wx = 4.6; wx < 28; wx += 2) for (var sd = -1; sd <= 1; sd += 2) { var h2 = 5 + rng() * 1.4;
      b.add('box', sd * wx, h2 / 2, wz, 2.05, h2, 1.4, shade(wallC, 0.82 + rng() * 0.3)); }
    b.add('box', -3.85, 3.6, wz, 0.7, 7.2, 1.6, shade(wallC, 0.65)); b.add('box', 3.85, 3.6, wz, 0.7, 7.2, 1.6, shade(wallC, 0.65));
    b.add('box', 0, 6.9, wz, 8.4, 0.8, 1.6, shade(wallC, 0.7));
    W.addBox(-15.6, wz, 12, 0.7, 8); W.addBox(15.6, wz, 12, 0.7, 8);
  });
  for (z = A1; z > W.zMin - 0.1; z -= 2) for (side = -1; side <= 1; side += 2) { var eh = 3 + rng() * 1.2;
    b.add('box', side * 10.2, eh / 2, z - 1, 1.2, eh, 2.05, shade(wallC, 0.8 + rng() * 0.3)); }

  if (L.boss === 'brute') {
    for (i = 0; i < 6; i++) { var a = i / 6 * Math.PI * 2 + Math.PI / 6; pillar(Math.cos(a) * 14, AC + Math.sin(a) * 17, 6.2 + rng()); }
    for (i = 0; i < 8; i++) { var ba = rng() * 6.28, br = 21 + rng() * 3; bush(Math.cos(ba) * br, AC + Math.sin(ba) * (br + 4), 1.2); }
  } else if (L.boss === 'phantom') {
    [[-13, -19], [13, -19], [-6, -8], [8, -6], [-15, 3], [16, 5], [-5, 15], [7, 17]].forEach(function (p) {
      pillar(p[0], AC + p[1], 3 + rng() * 4, 2);
      var d = Math.hypot(p[0], p[1]) || 1; W.arena.spots.push({ x: p[0] - p[0] / d * 2.6, z: AC + p[1] - p[1] / d * 2.6 }); });
    [[0, -22, 0], [1, 4, 0], [-11, -3, 1], [12, -12, 1]].forEach(function (w) {
      b.add('box', w[0], 0.7, AC + w[1], w[2] ? 0.8 : 4, 1.4, w[2] ? 4 : 0.8, shade(STONE, 0.8));
      W.addBox(w[0], AC + w[1], w[2] ? 0.4 : 2, w[2] ? 2 : 0.4, 1.4, { cover: true }); });
    if (L.arenaWater) addWater(-27, -19.5, A0 - 0.8, A1 + 0.8, false);
  } else {
    [[-14, -17], [14, -17], [-18, 2], [18, 2], [-12, 19], [12, 19]].forEach(function (p, k) {
      var rot = k === 2 || k === 3;
      b.add('box', p[0], 0.75, AC + p[1], rot ? 1.1 : 4, 1.5, rot ? 4 : 1.1, shade(0x8a8a86, 0.85 + rng() * 0.2));
      b.add('box', p[0], 1.52, AC + p[1], rot ? 1.2 : 4.1, 0.08, rot ? 4.1 : 1.2, 0xd0b020);
      W.addBox(p[0], AC + p[1], rot ? 0.55 : 2, rot ? 2 : 0.55, 1.5, { cover: true }); });
    [[-8, -25], [8, -25], [-21, -9], [21, -9], [-21, 13], [21, 13], [0, 26]].forEach(function (p) { crateStack(p[0], AC + p[1], true); });
    [[-24, -28], [24, -28], [-24, 28], [24, 28], [-24, 0], [24, 0]].forEach(function (p) { torch(p[0], AC + p[1]); });
  }

  /* ----- barriers ----- */
  function makeBarrier(z, style) {
    var grp = new THREE.Group(); grp.position.set(0, 0, z); g.add(grp); var mat, m, k;
    if (style === 'vines') { mat = lam(0x2c6a2a); var leafM = lam(0x3f8f3a);
      for (k = 0; k < 17; k++) { m = new THREE.Mesh(G.box, mat); var w = 0.22 + rng() * 0.3; m.scale.set(w, 6.4, w);
        m.position.set(-3.4 + k * 0.425, 3.2, (rng() - 0.5) * 0.6); m.rotation.z = (rng() - 0.5) * 0.14; grp.add(m);
        if (k % 2 === 0) { m = new THREE.Mesh(G.ico0, leafM); m.scale.set(0.9, 0.6, 0.9); m.position.set(-3.4 + k * 0.425, 1 + rng() * 4.6, (rng() - 0.5) * 0.5); grp.add(m); } }
    } else if (style === 'gate') { mat = lam(0x565c62);
      for (k = 0; k < 10; k++) { m = new THREE.Mesh(G.box, mat); m.scale.set(0.2, 6.4, 0.2); m.position.set(-3.3 + k * 0.73, 3.2, 0); grp.add(m); }
      for (k = 0; k < 3; k++) { m = new THREE.Mesh(G.box, mat); m.scale.set(7, 0.28, 0.28); m.position.set(0, 1 + k * 2.2, 0); grp.add(m); }
    } else { mat = bas(0xd4f2ec, { transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide });
      for (k = 0; k < 3; k++) { m = new THREE.Mesh(G.box, mat); m.scale.set(7, 6.4, 0.04); m.position.set(0, 3.2, (k - 1) * 0.35); grp.add(m); } }
    var c = W.addBox(0, z, 3.7, 0.55, 8);
    return { grp: grp, mat: mat, col: c, open: 1, target: 1, style: style };
  }
  W.barriers = { entry: makeBarrier(A0, L.barrier), exit: makeBarrier(A1, L.barrier) };
  W.barriers.entry.col.on = false; W.barriers.exit.open = 0; W.barriers.exit.target = 0;

  /* ----- destination flag ----- */
  W.flag = makeFlag(0, A1 - 14, 0x58e0d0, true); W.flag.grp.visible = false;

  /* ----- night dressing ----- */
  if (L.searchlights) {
    var sg = new THREE.ConeGeometry(2.8, 17, 10, 1, true); sg.translate(0, -8.5, 0); W.owned.push(sg);
    var sm2 = bas(0xfff2c0, { transparent: true, opacity: 0.09, depthWrite: false, fog: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    [[-15, -50], [15, -110], [-15, -170], [15, -215], [-25, AC - 28], [25, AC + 28]].forEach(function (p, k) {
      b.add('box', p[0], 4.5, p[1], 0.3, 9, 0.3, 0x333333); b.add('box', p[0], 9.2, p[1], 0.8, 0.6, 0.8, 0x555555);
      var piv = new THREE.Group(); piv.position.set(p[0], 9.2, p[1]); var cone = new THREE.Mesh(sg, sm2); piv.add(cone); g.add(piv);
      W.anim.push(function (dt, t) { piv.rotation.set(0.55 + Math.sin(t * 0.4 + k) * 0.18, 0, 0); piv.rotation.y = 0; piv.rotateOnWorldAxis(THREE.Object3D.DefaultUp, Math.sin(t * 0.3 + k * 1.7) * 1.2 + (p[0] > 0 ? -1.57 : 1.57)); });
    });
  }

  b.build(g); bf.build(g); bg.build(g);
  if (bf.mats.length) W.anim.push(function (dt, t) { var f = 0.85 + Math.sin(t * 17) * 0.08 + Math.sin(t * 7.3) * 0.07;
    for (var q = 0; q < bf.mats.length; q++) bf.mats[q].color.setRGB(f, f, f); });
};

W.setBarrier = function (which, open) {
  var B = W.barriers[which]; B.target = open ? 1 : 0; if (!open) B.col.on = true;
};
W.resetBarriers = function () {
  var e = W.barriers.entry, x = W.barriers.exit;
  e.open = e.target = 1; e.col.on = false; x.open = x.target = 0; x.col.on = true; W.flag.grp.visible = false;
};
W.setCheckpointReached = function (cp) { cp.reached = true; cp.flag.cm.color.setHex(0x5cff7a); cp.flag.bm.color.setHex(0x5cff7a); cp.flag.rm.color.setHex(0x5cff7a); };

W.update = function (dt) {
  var t = W.time += dt, i;
  for (i = 0; i < W.anim.length; i++) W.anim[i](dt, t);
  for (i = 0; i < W.checkpoints.length; i++) { var f = W.checkpoints[i].flag; f.pivot.rotation.y = Math.sin(t * 3 + i) * 0.3; f.bm.opacity = 0.12 + Math.sin(t * 2 + i) * 0.05; }
  if (W.flag && W.flag.grp.visible) { W.flag.pivot.rotation.y = Math.sin(t * 3) * 0.3; W.flag.bm.opacity = 0.2 + Math.sin(t * 4) * 0.08; }
  for (i = 0; i < W.crates.length; i++) { var c = W.crates[i]; if (c.opened && c.openT < 1) { c.openT = Math.min(1, c.openT + dt * 3); c.lid.rotation.x = -1.9 * c.openT; } }
  if (W.barriers) for (var k in W.barriers) { var B = W.barriers[k];
    if (B.open !== B.target) { B.open += (B.target > B.open ? 1 : -1) * dt * 1.1; B.open = Math.max(0, Math.min(1, B.open));
      if (Math.abs(B.open - B.target) < 0.02) B.open = B.target; if (B.target === 1 && B.open > 0.6) B.col.on = false; }
    B.grp.visible = B.open < 0.995;
    if (B.style === 'vines') { B.grp.scale.y = Math.max(0.001, 1 - B.open); B.grp.position.y = 6.4 * B.open; }
    else if (B.style === 'gate') B.grp.position.y = 6.6 * B.open;
    else B.mat.opacity = (0.62 + Math.sin(t * 5) * 0.08) * (1 - B.open);
  }
};
})();
