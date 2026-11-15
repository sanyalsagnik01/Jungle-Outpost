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
  colliders: [], cover: [], anim: [], checkpoints: [], crates: [], towers: [], waters: [], owned: [], trees: [], bushes: [], torches: [], lamps: [],
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
  W.lights = { hemi: hemi, sun: sun }; W.domeMat = domeMat;
  dome = new THREE.Mesh(dg, domeMat); dome.frustumCulled = false; dome.renderOrder = -10; scene.add(dome);
  W.resize();
};
W.resize = function () {
  var w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
  if (JO.Post && JO.Post.resize) JO.Post.resize();
};
W.updateSun = function (px, pz) {
  sun.position.set(px + sunOff.x, sunOff.y, pz + sunOff.z); sun.target.position.set(px, 0, pz); sun.target.updateMatrixWorld();
  dome.position.copy(camera.position);
};

/* ---------- colliders ---------- */
W.addBox = function (x, z, hx, hz, h, o) {
  var c = { minx: x - hx, maxx: x + hx, minz: z - hz, maxz: z + hz, y0: (o && o.y0) || 0, h: h, on: true, mat: (o && o.mat) || '' };
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
// instanced GLB prop: tint_* parts take `tint`, the rest take a neutral brightness `f`
Batch.prototype.addModel = function (name, x, y, z, sx, sy, sz, tint, ry, f) {
  var parts = JO.Assets.parts(name); if (!parts) return false;
  f = f === undefined ? 1 : Math.min(1, f);
  for (var i = 0; i < parts.length; i++) this.add('m~' + name + '~' + i, x, y, z, sx, sy, sz, parts[i].tint ? tint : (Math.round(f * 255) * 65793), ry);
  return true;
};
Batch.prototype.build = function (group) {
  for (var k in this.m) {
    var a = this.m[k], n = a.length / 10, parts = k.split('|'), chunk = +parts[1];
    var mp = parts[0].indexOf('m~') === 0 ? JO.Assets.parts(parts[0].split('~')[1])[+parts[0].split('~')[2]] : null;
    var geo = (mp ? mp.geometry : G[parts[0]]).clone();
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 6, -(chunk + 0.5) * 70), 85);
    var mat = this.kind === 'b' ? new THREE.MeshBasicMaterial(this.matOpts || {}) : new THREE.MeshLambertMaterial(mp && mp.map ? { map: mp.map } : undefined);
    if (JO.Foliage && this.kind === 'l') { var fk = parts[0], fn = fk.indexOf('m~') === 0 ? fk.split('~')[1] : fk;      // leaves and bushes sway
      var kind = /^env_tree/.test(fn) || fn === 'ico' || fn === 'cone' ? 'tree' : (fn === 'env_bush' || fn === 'env_vine' || fn === 'ico0' ? 'bush' : ''); if (kind) JO.Foliage.patch(mat, kind); }
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
// equirect sky: gradient, sun or moon, clouds / mist / stars
function makeSky(pal, mood, sunDir) {
  var w = 1024, h = 512, c = document.createElement('canvas'); c.width = w; c.height = h; var g = c.getContext('2d');
  var top = '#' + ('00000' + pal.skyTop.toString(16)).slice(-6), fog = '#' + ('00000' + pal.fog.toString(16)).slice(-6);
  var gr = g.createLinearGradient(0, 0, 0, h / 2); gr.addColorStop(0, top); gr.addColorStop(0.45, top); gr.addColorStop(1, fog); g.fillStyle = gr; g.fillRect(0, 0, w, h / 2);
  g.fillStyle = fog; g.fillRect(0, h / 2 - 1, w, h / 2 + 1);
  var r = mulberry(mood.length * 97 + 5), i, x, y;
  if (mood === 'night') { for (i = 0; i < 420; i++) { x = r() * w; y = r() * h * 0.42; g.fillStyle = 'rgba(255,' + (220 + r() * 35 | 0) + ',' + (190 + r() * 60 | 0) + ',' + (0.3 + r() * 0.7) + ')'; g.fillRect(x, y, r() < 0.1 ? 2 : 1, r() < 0.1 ? 2 : 1); } }
  // sun / moon at the light's direction (three SphereGeometry: u = atan2(z, -x) / 2pi)
  var d = sunDir.clone().normalize(), u = Math.atan2(d.z, -d.x) / (Math.PI * 2); if (u < 0) u += 1;
  var sx = u * w, sy = (1 - (Math.asin(d.y) / Math.PI + 0.5)) * h, rad = mood === 'day' ? 150 : (mood === 'dusk' ? 190 : 90);
  var cols = mood === 'day' ? ['rgba(255,252,230,1)', 'rgba(255,240,180,0.45)'] : (mood === 'dusk' ? ['rgba(255,214,150,1)', 'rgba(255,150,80,0.4)'] : ['rgba(255,236,214,1)', 'rgba(255,150,90,0.28)']);
  [-w, 0, w].forEach(function (o) { var rg = g.createRadialGradient(sx + o, sy, 0, sx + o, sy, rad); rg.addColorStop(0, cols[0]); rg.addColorStop(mood === 'night' ? 0.2 : 0.12, cols[0]); rg.addColorStop(mood === 'night' ? 0.24 : 0.2, cols[1]); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.fillRect(sx + o - rad, sy - rad, rad * 2, rad * 2); });
  // cloud bands (drawn three times so they wrap)
  var n = mood === 'day' ? 26 : (mood === 'dusk' ? 34 : 18), cc = mood === 'day' ? '255,255,255' : (mood === 'dusk' ? '214,232,226' : '70,30,24');
  for (i = 0; i < n; i++) { x = r() * w; y = h * (0.2 + r() * 0.27); var cw = 60 + r() * 150, ch = 8 + r() * (mood === 'dusk' ? 10 : 20), a = (mood === 'day' ? 0.5 : 0.35) * (0.4 + r() * 0.6);
    for (var k = 0; k < 4; k++) { var ox = (r() - 0.5) * cw * 0.6, oy = (r() - 0.5) * ch * 0.6; [-w, 0, w].forEach(function (o) { g.fillStyle = 'rgba(' + cc + ',' + (a * 0.6) + ')'; g.beginPath(); g.ellipse(x + ox + o, y + oy, cw * (0.3 + r() * 0.3), ch * (0.5 + r() * 0.5), 0, 0, 6.3); g.fill(); }); } }
  if (mood === 'night') { var hg = g.createLinearGradient(0, h * 0.36, 0, h / 2); hg.addColorStop(0, 'rgba(255,90,30,0)'); hg.addColorStop(1, 'rgba(255,90,30,0.28)'); g.fillStyle = hg; g.fillRect(0, h * 0.36, w, h * 0.14); }
  var t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t;
}
function makeGroundTex(mood, seed) {
  var s = 128, c = document.createElement('canvas'); c.width = c.height = s; var g = c.getContext('2d'), r = mulberry(seed * 13 + 1), i;
  g.fillStyle = '#dcdcdc'; g.fillRect(0, 0, s, s);
  for (i = 0; i < 520; i++) { var v = 170 + (r() * 85 | 0), x = r() * (s - 5) | 0, y = r() * (s - 7) | 0; g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
    if (mood === 'day') g.fillRect(x, y, 1 + (r() * 2 | 0), 3 + (r() * 4 | 0)); else g.fillRect(x, y, 2 + (r() * 4 | 0), 1 + (r() * 3 | 0)); }
  for (i = 0; i < 26; i++) { g.fillStyle = 'rgba(120,120,120,0.35)'; g.beginPath(); g.arc(6 + r() * (s - 12), 6 + r() * (s - 12), 1 + r() * 2.5, 0, 6.3); g.fill(); }
  var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function shade(hex, f) { col2.setHex(hex).multiplyScalar(f); return col2.getHex(); }
function lam(c, o) { var m = new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {})); W.owned.push(m); return m; }
function bas(c, o) { var m = new THREE.MeshBasicMaterial(Object.assign({ color: c }, o || {})); W.owned.push(m); return m; }

W.unload = function () {
  if (W.group) scene.remove(W.group);
  for (var i = 0; i < W.owned.length; i++) W.owned[i].dispose();
  W.owned.length = 0; W.colliders.length = 0; W.cover.length = 0; W.anim.length = 0; W.checkpoints.length = 0;
  W.crates.length = 0; W.towers.length = 0; W.waters.length = 0; W.trees.length = 0; W.bushes.length = 0; W.torches.length = 0; W.lamps.length = 0; W.group = null; W.flag = null; W.barriers = null;
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
  // procedural sky panorama (stands in for a painted skybox) and a tileable ground detail texture
  var mood = L.torches ? 'night' : (L.river ? 'dusk' : 'day');
  if (W.skyTex) W.skyTex.dispose(); W.skyTex = makeSky(pal, mood, sunOff); domeMat.map = W.skyTex; domeMat.vertexColors = false; domeMat.needsUpdate = true;
  if (W.groundTex) W.groundTex.dispose(); W.groundTex = makeGroundTex(mood, L.seed);

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
    col.multiplyScalar((0.9 + rng() * 0.2) * 1.14); gc[i * 3] = col.r; gc[i * 3 + 1] = col.g; gc[i * 3 + 2] = col.b;
  }
  gg.setAttribute('color', new THREE.BufferAttribute(gc, 3));
  W.groundTex.repeat.set(150 / 7, totalLen / 7);
  var gm = new THREE.MeshLambertMaterial({ vertexColors: true, map: W.groundTex }); W.owned.push(gg, gm);
  var ground = new THREE.Mesh(gg, gm); ground.position.z = cz; ground.receiveShadow = true; g.add(ground);

  /* ----- scenery helpers -----
     Layout decisions (anything that changes colliders) use `rng`; purely visual variation uses `vr`,
     so a level is laid out identically whether a prop is drawn as a GLB or as its primitive fallback. */
  var vr = mulberry(L.seed * 31 + 7), AS = JO.Assets, GL = function (n) { return AS && AS.parts && AS.parts(n); };
  function tree(x, z, big) {
    var h = (big ? 7 : 5.2) + vr() * 3, leaf = pal.leaf[(vr() * pal.leaf.length) | 0], k = vr(), tr = 0.55 + vr() * 0.35, cr = (big ? 6 : 4.2) + vr() * 2.2;
    var name = k < 0.5 ? 'env_tree_a' : (k < 0.86 ? 'env_tree_b' : 'env_tree_c');
    W.trees.push({ x: x, z: z, h: h, r: cr, big: !!big });
    if (GL(name)) {
      var s = h / 6.3 * (name === 'env_tree_c' ? 1.15 : 1), wd = s * (big ? 1.2 : 1);
      b.addModel(name, x, 0, z, wd, s, wd, leaf, vr() * 6, 0.85 + vr() * 0.3);
      if (name !== 'env_tree_c' && vr() < 0.55 && GL('env_vine')) b.addModel('env_vine', x + (vr() - 0.5) * 2.6 * s, 5.5 * s, z + (vr() - 0.5) * 2.6 * s, 1.2, 0.8 + vr() * 0.7, 1.2, shade(leaf, 0.7), vr() * 6, 1);
      return;
    }
    b.add('trunk', x, h / 2, z, tr * 1.3, h, tr * 1.3, shade(pal.trunk, 0.85 + vr() * 0.3), vr() * 6);
    if (k < 0.62) {
      b.add('ico', x, h + cr * 0.22, z, cr, cr * 0.72, cr, leaf, vr() * 6);
      b.add('ico', x + (vr() - 0.5) * 2.4, h + cr * 0.6, z + (vr() - 0.5) * 2.4, cr * 0.66, cr * 0.55, cr * 0.66, shade(leaf, 1.12), vr() * 6);
    } else {
      b.add('cone', x, h + cr * 0.3, z, cr, cr * 0.95, cr, leaf, vr() * 6);
      b.add('cone', x, h + cr * 0.85, z, cr * 0.7, cr * 0.8, cr * 0.7, shade(leaf, 1.1), vr() * 6);
    }
    var nv = (vr() * 3) | 0;                                   // hanging vines
    for (var v = 0; v < nv; v++) { var vl = 1.4 + vr() * 2.2, va = vr() * 6.28, vd = cr * 0.3 * vr() + 0.6;
      b.add('box', x + Math.cos(va) * vd, h - vl / 2 + 0.3, z + Math.sin(va) * vd, 0.07, vl, 0.07, shade(leaf, 0.7)); }
  }
  function bush(x, z, s) {
    var leaf = shade(pal.leaf[(vr() * pal.leaf.length) | 0], 0.9 + vr() * 0.25); W.bushes.push({ x: x, z: z, s: s });
    if (GL('env_bush')) b.addModel('env_bush', x, 0, z, s * 0.8, s * 0.86, s * 0.8, leaf, vr() * 6, 1);
    else b.add('ico0', x, s * 0.32, z, s * 1.5, s * 0.8, s * 1.5, leaf, vr() * 6);
  }
  function rock(x, z, s) {
    if (GL('env_rock')) b.addModel('env_rock', x, 0, z, s * 0.94, s * 1.05, s * 0.94, 0, vr() * 6, 0.8 + vr() * 0.3);
    else b.add('rock', x, s * 0.42, z, s * 1.7, s * 1.15, s * 1.7, shade(STONE, 0.85 + vr() * 0.3), vr() * 6, vr() * 0.4);
    W.addBox(x, z, s * 0.62, s * 0.62, s * 0.9, { cover: s > 1.15, mat: 'stone' });
  }
  function sandbag(x, z, rot) {
    if (GL('env_sandbag')) b.addModel('env_sandbag', x, 0, z, 1, 1.02, 1, 0, rot ? Math.PI / 2 : 0, 0.9 + vr() * 0.2);
    else { var lx = rot ? 0 : 1, lz = rot ? 1 : 0;
      for (var row = 0; row < 3; row++) for (var k = -1; k <= 1; k++) { var off = k * 0.98 + (row % 2 ? 0.45 : 0);
        if (row === 2 && k === 1) continue;
        b.add('box', x + lx * off, 0.21 + row * 0.42, z + lz * off, rot ? 0.72 : 0.94, 0.4, rot ? 0.94 : 0.72, shade(SAND, 0.85 + vr() * 0.25), (vr() - 0.5) * 0.1); } }
    W.addBox(x, z, rot ? 0.42 : 1.55, rot ? 1.55 : 0.42, 1.27, { cover: true, mat: 'sand' });
  }
  function crateStack(x, z, tall) {
    var s = 1.3, glb = GL('env_crate'), two = tall || rng() < 0.4, side = !tall && rng() < 0.6, x2 = x + (rng() < 0.5 ? -1.36 : 1.36);
    function one(cx, cy, cz, sc, ry, f) { if (glb) b.addModel('env_crate', cx, cy, cz, sc, sc, sc, 0, ry, f);
      else { b.add('box', cx, cy + s * sc / 2, cz, s * sc, s * sc, s * sc, shade(WOOD, f), ry); b.add('box', cx, cy + s * sc / 2, cz, s * sc + 0.06, 0.12, s * sc + 0.06, WOODD, ry); } }
    one(x, 0, z, 1, vr() * 0.2, 0.9 + vr() * 0.2);
    if (two) one(x, s, z, 0.95, 0.3, 1.05);
    W.addBox(x, z, s / 2, s / 2, two ? s * 2 : s, { cover: true });
    if (side) { one(x2, 0, z + 0.1, 0.85, 0.1, 0.8); W.addBox(x2, z + 0.1, 0.55, 0.55, 1.1); }
  }
  function ruin(x, z, rot) {
    var segs = 2 + ((rng() * 2) | 0), glb = GL('env_wall');
    for (var k = 0; k < segs; k++) { var h = 1.5 + rng() * 2.2, o = (k - (segs - 1) / 2) * 1.7, px = x + (rot ? 0 : o), pz = z + (rot ? o : 0);
      if (glb) b.addModel('env_wall', px, 0, pz, 1, h / 2.5, 1, 0, rot ? Math.PI / 2 : 0, 0.8 + vr() * 0.3);
      else { b.add('box', px, h / 2, pz, rot ? 0.8 : 1.7, h, rot ? 1.7 : 0.8, shade(STONE, 0.8 + vr() * 0.3)); if (vr() < 0.5) b.add('box', px, h + 0.2, pz, 0.7, 0.4, 0.7, shade(STONE, 0.7), vr()); }
      W.addBox(px, pz, rot ? 0.4 : 0.85, rot ? 0.85 : 0.4, h, { mat: 'stone' }); }
    W.cover.push({ x: x, z: z, r: 1.2 });
  }
  function pillar(x, z, h, wd) {
    wd = wd || 2.2;
    if (GL('env_pillar')) b.addModel('env_pillar', x, 0, z, wd / 2.2, h / 6.2, wd / 2.2, 0, ((vr() * 4) | 0) * Math.PI / 2, 0.85 + vr() * 0.2);
    else { b.add('box', x, h / 2, z, wd, h, wd, shade(STONE, 0.85 + vr() * 0.2)); b.add('box', x, 0.25, z, wd + 0.5, 0.5, wd + 0.5, shade(STONE, 0.7)); b.add('box', x, h + 0.2, z, wd + 0.4, 0.4, wd + 0.4, shade(STONE, 0.95), vr() * 0.3); }
    W.addBox(x, z, wd / 2, wd / 2, h, { cover: true, mat: 'stone' }); W.arena.pillars.push({ x: x, z: z });
  }
  function tower(x, z) {
    if (GL('env_tower')) b.addModel('env_tower', x, 0, z, 1, 1, 1, 0, 0, 1);
    else {
      for (var sx = -1; sx <= 1; sx += 2) for (var sz = -1; sz <= 1; sz += 2) {
        b.add('box', x + sx * 1.35, 2.4, z + sz * 1.35, 0.26, 4.8, 0.26, WOODD);
        b.add('box', x + sx * 1.45, 5.9, z + sz * 1.45, 0.14, 2.1, 0.14, WOODD); }
      b.add('box', x, 4.76, z, 3.4, 0.24, 3.4, WOOD);
      b.add('box', x, 5.35, z - 1.6, 3.3, 0.12, 0.1, WOODD); b.add('box', x, 5.35, z + 1.6, 3.3, 0.12, 0.1, WOODD);
      b.add('box', x - 1.6, 5.35, z, 0.1, 0.12, 3.3, WOODD); b.add('box', x + 1.6, 5.35, z, 0.1, 0.12, 3.3, WOODD);
      b.add('cone', x, 7.6, z, 5.6, 1.5, 5.6, 0x8a7a3c, Math.PI / 4);
      for (var r = 0; r < 7; r++) b.add('box', x + 1.75, 0.5 + r * 0.65, z, 0.08, 0.08, 0.7, WOOD);
    }
    W.addBox(x, z, 1.7, 1.7, 4.88, { y0: 4.6 });
    W.towers.push({ x: x, z: z, y: 4.88 }); reserve(x, z, 3);
  }
  // one-off set dressing; returns false when the model is missing (callers may skip the collider too)
  function decor(name, x, z, ry, hx, hz, h, sc) {
    if (!GL(name)) return false;
    b.addModel(name, x, 0, z, sc || 1, sc || 1, sc || 1, 0, ry || 0, 1); if (hx) W.addBox(x, z, hx, hz, h, { cover: true }); reserve(x, z, Math.max(hx || 1, hz || 1) + 1); return true;
  }
  function torch(x, z) {
    W.torches.push({ x: x, y: 2.9, z: z });
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
  // supply crates read as loot, not scenery: olive case, glowing amber bands, a ground ring and a faint beam that fade once opened
  var crateMat = lam(0x5a6a3a), crateGlow = bas(0xffc23a), crateTrim = lam(0x22261a);
  var ringGeo = new THREE.RingGeometry(0.95, 1.25, 40), beamGeo = new THREE.CylinderGeometry(0.16, 0.42, 7, 12, 1, true); W.owned.push(ringGeo, beamGeo);
  (L.crates || []).forEach(function (c, ci) {
    var grp = new THREE.Group(); grp.position.set(c[0], 0, c[1]);
    var base = new THREE.Mesh(G.box, crateMat); base.scale.set(1.3, 0.8, 0.9); base.position.y = 0.4; grp.add(base);
    var band = new THREE.Mesh(G.box, crateGlow); band.scale.set(1.34, 0.1, 0.94); band.position.y = 0.42; grp.add(band);
    [-0.5, 0.5].forEach(function (bx) { var v = new THREE.Mesh(G.box, crateGlow); v.scale.set(0.08, 0.82, 0.94); v.position.set(bx, 0.4, 0); grp.add(v); });
    var foot = new THREE.Mesh(G.box, crateTrim); foot.scale.set(1.38, 0.08, 0.98); foot.position.y = 0.04; grp.add(foot);
    var lid = new THREE.Group(); lid.position.set(0, 0.8, -0.45); grp.add(lid);
    var lm = new THREE.Mesh(G.box, crateMat); lm.scale.set(1.3, 0.14, 0.9); lm.position.set(0, 0.07, 0.45); lid.add(lm);
    var lband = new THREE.Mesh(G.box, crateGlow); lband.scale.set(0.3, 0.16, 0.92); lband.position.set(0, 0.07, 0.45); lid.add(lband);
    var rm = bas(0xffc23a, { transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    var ring = new THREE.Mesh(ringGeo, rm); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; grp.add(ring);
    var bm = bas(0xffd56a, { transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    var beam = new THREE.Mesh(beamGeo, bm); beam.position.y = 3.6; grp.add(beam);
    g.add(grp); W.addBox(c[0], c[1], 0.65, 0.45, 0.94); reserve(c[0], c[1], 2.2);
    W.crates.push({ x: c[0], z: c[1], opened: false, lid: lid, openT: 0, ring: ring, beam: beam, rm: rm, bm: bm, ph: ci * 1.7 });
  });
  (L.pickups || []).forEach(function (p) { reserve(p[1], p[2], 1.6); });
  if (JO.Props) JO.Props.reserve(L, reserve);                  // gates, doors, barrels... keep random cover off them

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

  /* ----- set dressing (GLB only; skipped silently when a model is missing) ----- */
  if (L.boss === 'brute') decor('env_jeep', -9, 4.5, 0.5, 1.3, 2.2, 1.7);
  if (L.river) decor('env_boat', -10.5, L.river.z0 + 3.4, 1.2);
  if (L.boss === 'commander') {
    decor('env_jeep', 9, 4.5, -0.4, 1.3, 2.2, 1.7); decor('env_building', -12.6, A0 + 14, Math.PI / 2, 2.8, 3.3, 3.3); decor('env_building', 12.6, A0 + 15.5, -Math.PI / 2, 2.8, 3.3, 3.3);
    [[-23, AC - 26, 0.8], [23, AC - 26, -0.8], [-23, AC + 26, 2.4], [23, AC + 26, -2.4]].forEach(function (p) { decor('env_searchlight', p[0], p[1], p[2], 0, 0, 0, 1.3); });
  }

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
    var bl = R.z0 - R.z1 + 2, bm2 = (R.z0 + R.z1) / 2;
    if (!b.addModel('env_bridge', 0, 0, bm2, 1, 1, bl / 16, 0, 0, 1)) {
    for (var bz = R.z0 + 1; bz > R.z1 - 1.01; bz -= 0.8) b.add('box', 0, 0.2, bz, 5, 0.12, 0.7, shade(WOOD, 0.85 + vr() * 0.25), (vr() - 0.5) * 0.04);
    for (var pz = R.z0 + 1; pz > R.z1 - 1.01; pz -= 3.2) { b.add('box', -2.45, 0.7, pz, 0.16, 1.4, 0.16, WOODD); b.add('box', 2.45, 0.7, pz, 0.16, 1.4, 0.16, WOODD); }
    b.add('box', -2.45, 1.3, bm2, 0.1, 0.1, bl, WOOD); b.add('box', 2.45, 1.3, bm2, 0.1, 0.1, bl, WOOD);
    }
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
  W.ground = ground; W.groundMat = gm; W.pal = pal;
  JO.Events.emit('world_built', L);
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
  for (i = 0; i < W.crates.length; i++) { var c = W.crates[i]; if (c.opened && c.openT < 1) { c.openT = Math.min(1, c.openT + dt * 3); c.lid.rotation.x = -1.9 * c.openT; }
    if (c.ring) { var pu = 0.5 + 0.5 * Math.sin(t * 3 + c.ph), fade = c.opened ? 1 - c.openT : 1; c.rm.opacity = (0.25 + pu * 0.35) * fade; c.bm.opacity = (0.07 + pu * 0.07) * fade;
      var sc = 1 + pu * 0.12; c.ring.scale.set(sc, sc, 1); c.ring.visible = c.beam.visible = fade > 0.01; } }
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
