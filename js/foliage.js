/* ============================================================
   JUNGLE OUTPOST — foliage.js
   Makes the scenery move. world.js hands every instanced leaf,
   bush and vine material to Foliage.patch(), which adds a small
   vertex-shader step: wind sway that grows with height, bushes
   and grass bending away from the player, and a ring of motion
   rolling outward from every explosion.
   Also plants instanced grass (count set by the quality tier).
   All patched materials share one set of uniforms, so the whole
   jungle is driven by a handful of numbers per frame.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, W = JO.World, Q = JO.Q, Ev = JO.Events;
var F = JO.Foliage = { grass: [], count: 0, wind: 1 };
var U = F.uniforms = { uTime: { value: 0 }, uWind: { value: new THREE.Vector4(0.8, 0.6, 1, 0) }, uPush: { value: new THREE.Vector3(0, 0, 1.6) }, uBlast: { value: new THREE.Vector4(0, 0, 99, 0) } };

var HEAD = 'uniform float uTime; uniform vec4 uWind; uniform vec3 uPush; uniform vec4 uBlast;\n';
// per kind: how height turns into "how much this vertex may move", and the amplitudes
var KIND = {
  tree:  { k: 'smoothstep(1.2, 7.5, fh)', amp: '0.34', flut: '0.07', push: '0.0', blast: '0.5' },
  bush:  { k: 'clamp(fh / 1.3, 0.0, 1.0)', amp: '0.10', flut: '0.045', push: '0.42', blast: '0.7' },
  grass: { k: 'clamp(fh / 0.55, 0.0, 1.0)', amp: '0.13', flut: '0.05', push: '0.5', blast: '0.6' }
};
function body(kind) {
  var c = KIND[kind];
  return 'vec4 mvPosition = vec4( transformed, 1.0 );\n#ifdef USE_INSTANCING\n' +
    ' mvPosition = instanceMatrix * mvPosition;\n vec3 fo = instanceMatrix[3].xyz; float fh = max(0.0, mvPosition.y - fo.y); float fk = ' + c.k + ';\n' +
    ' float ph = uTime * 1.3 + fo.x * 0.35 + fo.z * 0.27; float gust = sin(uTime * 0.31 + fo.z * 0.05 + fo.x * 0.03) * 0.5 + 0.5;\n' +
    ' vec2 sway = uWind.xy * (sin(ph) * 0.6 + sin(ph * 2.3 + 1.7) * 0.25 + gust * 0.55) * uWind.z * ' + c.amp + ' * fk;\n' +
    ' sway += vec2(sin(ph * 3.1 + mvPosition.y * 2.0), cos(ph * 2.7 + mvPosition.x * 2.0)) * ' + c.flut + ' * fk * uWind.z;\n' +
    ' vec2 pd = fo.xz - uPush.xy; float pl = length(pd); sway += (pl > 0.001 ? pd / pl : vec2(0.0)) * (1.0 - smoothstep(0.0, uPush.z, pl)) * ' + c.push + ' * fk;\n' +
    ' vec2 bd = fo.xz - uBlast.xy; float bl = length(bd); float bw = exp(-pow((bl - uBlast.z * 24.0) * 0.3, 2.0)) * uBlast.w * exp(-uBlast.z * 1.6);\n' +
    ' sway += (bl > 0.001 ? bd / bl : vec2(0.0)) * bw * ' + c.blast + ' * fk;\n' +
    ' mvPosition.xz += sway; mvPosition.y -= dot(sway, sway) * 0.35;\n#endif\n' +
    'mvPosition = modelViewMatrix * mvPosition;\ngl_Position = projectionMatrix * mvPosition;';
}
// three separately written hooks: r128 keys its shader cache on the hook's source text
var HOOK = {
  tree: function (sh) { sh.uniforms.uTime = U.uTime; sh.uniforms.uWind = U.uWind; sh.uniforms.uPush = U.uPush; sh.uniforms.uBlast = U.uBlast; sh.vertexShader = HEAD + sh.vertexShader.replace('#include <project_vertex>', body('tree')); },
  bush: function (sh) { sh.uniforms.uTime = U.uTime; sh.uniforms.uWind = U.uWind; sh.uniforms.uPush = U.uPush; sh.uniforms.uBlast = U.uBlast; sh.vertexShader = HEAD + sh.vertexShader.replace('#include <project_vertex>', body('bush')); /* bush */ },
  grass: function (sh) { sh.uniforms.uTime = U.uTime; sh.uniforms.uWind = U.uWind; sh.uniforms.uPush = U.uPush; sh.uniforms.uBlast = U.uBlast; sh.vertexShader = HEAD + sh.vertexShader.replace('#include <project_vertex>', body('grass')); /* grass */ }
};
F.patched = 0;
F.patch = function (mat, kind) {
  if (!HOOK[kind]) return mat;
  mat.onBeforeCompile = HOOK[kind]; mat.customProgramCacheKey = function () { return 'jo-foliage-' + kind; }; mat.userData.foliage = kind; F.patched++; return mat;
};

/* ---------- grass ---------- */
function bladeGeo() {
  // three crossed blades, each a tapered triangle pair; y runs 0..1
  var pos = [], nor = [], i;
  for (i = 0; i < 3; i++) { var a = i * 1.05 + 0.3, c = Math.cos(a), s = Math.sin(a), w = 0.1, lean = 0.12 * (i - 1);
    var x0 = -w * c, z0 = -w * s, x1 = w * c, z1 = w * s, tx = lean * s, tz = -lean * c;
    pos.push(x0, 0, z0, x1, 0, z1, tx, 1, tz, x1, 0, z1, x0, 0, z0, tx, 1, tz); for (var q = 0; q < 6; q++) nor.push(0, 1, 0); }       // both windings, normals up: lit like the ground
  var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nor), 3)); return g;
}
var rngState = 1; function rnd() { rngState = (rngState * 16807) % 2147483647; return (rngState - 1) / 2147483646; }
function clear() { for (var i = 0; i < F.grass.length; i++) { var m = F.grass[i]; if (m.parent) m.parent.remove(m); m.geometry.dispose(); m.material.dispose(); } F.grass.length = 0; F.count = 0; }
function blocked(x, z) { var cs = W.colliders; for (var i = 0; i < cs.length; i++) { var c = cs[i]; if (c.y0 < 0.5 && x > c.minx - 0.2 && x < c.maxx + 0.2 && z > c.minz - 0.2 && z < c.maxz + 0.2) return true; } return false; }
function plant(L) {
  clear(); var n = Q.n('grass'); if (!n || !W.group || !L) return;
  rngState = L.seed * 7919 + 101; var pal = L.pal, chunks = {}, made = 0, tries = 0, col = new THREE.Color(), d = new THREE.Object3D(), geo = bladeGeo();
  var z0 = W.zMax - 2, z1 = W.A0 + 3, len = z0 - z1;
  while (made < n && tries < n * 4) { tries++;
    var z = z0 - rnd() * len, hw = W.pathHW + 3.5, x = (rnd() * 2 - 1) * hw, cl = rnd();
    if (Math.abs(x - Math.sin(z * 0.07) * 1.2) < 2.4) continue;                                   // keep the trail clear
    if (L.river && z < L.river.z0 + 1.5 && z > L.river.z1 - 1.5) continue;
    if (blocked(x, z)) continue;
    // clumps: reuse the previous spot now and then so the grass grows in patches
    var key = Math.max(0, Math.floor(-z / 70)), a = chunks[key] || (chunks[key] = []);
    var s = 0.3 + rnd() * 0.5 + (cl > 0.92 ? 0.35 : 0); a.push(x, z, s, rnd() * 6.28, rnd()); made++;
  }
  for (var k in chunks) { var arr = chunks[k], cnt = arr.length / 5, g = geo.clone(); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.5, -(+k + 0.5) * 70), 60);
    var mat = new THREE.MeshLambertMaterial(); F.patch(mat, 'grass');
    var mesh = new THREE.InstancedMesh(g, mat, cnt);
    for (var i = 0; i < cnt; i++) { var o = i * 5; d.position.set(arr[o], 0, arr[o + 1]); d.rotation.set(0, arr[o + 3], 0); d.scale.set(1.9, arr[o + 2], 1.9); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
      col.setHex(pal.leaf[(arr[o + 4] * pal.leaf.length) | 0]).lerp(new THREE.Color(pal.ground[(arr[o + 4] * 7 | 0) % pal.ground.length]), 0.6).multiplyScalar(1.0 + arr[o + 4] * 0.3); mesh.setColorAt(i, col); }
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.matrixAutoUpdate = false; mesh.receiveShadow = false;
    W.group.add(mesh); F.grass.push(mesh); F.count += cnt; }
  geo.dispose();
}

/* ---------- per frame ---------- */
var blastAge = 99, gustT = 0;
JO.Sys.add('foliage', {
  init: function () {
    Ev.on('blast', function (x, z, r) { U.uBlast.value.set(x, z, 0, Math.min(1.6, 0.5 + (r || 4) * 0.15)); blastAge = 0; });
    Ev.on('level_load', function () { blastAge = 99; U.uBlast.value.z = 99; });
  },
  level: function (L) { plant(L); },
  quality: function () { if (W.level) plant(W.level); },
  frame: function (dt, real) {
    var Wx = JO.Weather, P = JO.Player, on = Q.n('wind') > 0;
    U.uTime.value += (dt > 0 ? dt : real * 0.25);
    // wind strength follows the weather: breeze, stronger in rain, wild in a storm
    var want = on ? 0.55 + (Wx ? Wx.rain * 0.7 + Wx.storm * 1.1 : 0) : 0; F.wind += (want - F.wind) * Math.min(1, real * 0.8); U.uWind.value.z = F.wind;
    gustT += real * 0.05; U.uWind.value.x = Math.cos(0.65 + Math.sin(gustT) * 0.5); U.uWind.value.y = Math.sin(0.65 + Math.sin(gustT) * 0.5);
    if (P) U.uPush.value.set(P.pos.x, P.pos.z, P.pos.y < 0.6 ? (P.crouch ? 1.2 : 1.7) : 0.01);
    if (blastAge < 6) { blastAge += dt; U.uBlast.value.z = blastAge; }
  }
});
})();
