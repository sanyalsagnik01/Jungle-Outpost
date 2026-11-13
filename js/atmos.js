/* ============================================================
   JUNGLE OUTPOST — atmos.js
   Light and air.
     - shafts of light slanting through gaps in the canopy, with
       dust drifting in them; strongest at dawn and dusk, gone
       in rain and at night
     - low ground fog that thickens with the weather and at the
       river
     - a wet world: rain darkens the ground and fills puddles
       that ring with drops and flash with lightning, then dry
     - torches and fires ask the light pool (JO.Lights) for real
       light; the nearest few get it
     - the colour grade follows the hour and the storm
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, W = JO.World, Q = JO.Q, Ev = JO.Events;
var At = JO.Atmos = { shafts: 0, sheets: 0, puddles: [], wet: 0, shaftK: 0, fogK: 0, dustN: 0 };
var scene, d = new THREE.Object3D(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0), col = new THREE.Color(), c2 = new THREE.Color(), v = new THREE.Vector3(), q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
var MAXS = 16, MAXP = 22, MAXD = 140, shaftMesh, dust, dustU, fog = [], fogTex, pudMesh, shaftList = [], lvl = 0, baseGround = new THREE.Color(1, 1, 1), flashes = [];
function rnd(s) { return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

function build() {
  // shaft: two crossed planes, bright in the middle, soft at every edge
  var c = document.createElement('canvas'); c.width = 32; c.height = 128; var g = c.getContext('2d'), im = g.createImageData(32, 128), i, x, y;
  for (y = 0; y < 128; y++) for (x = 0; x < 32; x++) { var ex = 1 - Math.abs(x - 15.5) / 15.5, ey = Math.sin(y / 127 * Math.PI), a = Math.pow(ex, 1.6) * Math.pow(ey, 0.7) * (0.8 + 0.2 * Math.sin(x * 1.9)); i = (y * 32 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255 * a; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0); var st = new THREE.CanvasTexture(c);
  var p1 = new THREE.PlaneGeometry(1, 1), p2 = new THREE.PlaneGeometry(1, 1); p2.rotateY(Math.PI / 2);
  var sg = Q.merge([p1, p2]), uv = new Float32Array(24), u1 = p1.toNonIndexed().attributes.uv.array; for (i = 0; i < 12; i++) { uv[i] = u1[i]; uv[i + 12] = u1[i]; } sg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  shaftMesh = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ map: st, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }), MAXS);
  shaftMesh.frustumCulled = false; shaftMesh.renderOrder = 4; for (i = 0; i < MAXS; i++) { shaftMesh.setMatrixAt(i, ZERO); shaftMesh.setColorAt(i, col.setHex(0)); } scene.add(shaftMesh);
  // dust: points parked inside the shafts, drifting
  var dp = new Float32Array(MAXD * 3), ph = new Float32Array(MAXD); for (i = 0; i < MAXD; i++) ph[i] = Math.random();
  var dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3)); dg.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  dustU = { uTime: { value: 0 }, uColor: { value: new THREE.Color(1, 1, 1) }, uAlpha: { value: 0 }, uScale: { value: window.innerHeight } };
  dust = new THREE.Points(dg, new THREE.ShaderMaterial({ uniforms: dustU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float aPh; uniform float uTime; uniform float uScale; varying float vA; void main(){ vec3 p = position; float t = uTime * 0.35 + aPh * 40.0; p.x += sin(t) * 0.25; p.z += cos(t * 0.8) * 0.25; p.y += sin(t * 0.6) * 0.3; vA = 0.6 + 0.4 * sin(t * 2.0); vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = 0.05 * uScale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uColor; uniform float uAlpha; varying float vA; void main(){ float r = 1.0 - smoothstep(0.1, 0.5, length(gl_PointCoord - 0.5)); gl_FragColor = vec4(uColor, r * uAlpha * vA); }' }));
  dust.frustumCulled = false; dust.renderOrder = 5; dust.visible = false; scene.add(dust);
  // ground fog: big soft sheets that follow the camera
  var fc = document.createElement('canvas'); fc.width = fc.height = 128; var fg = fc.getContext('2d'), r = rnd(77); fg.fillStyle = '#000'; fg.fillRect(0, 0, 128, 128);
  for (i = 0; i < 46; i++) { var bx = r() * 128, by = r() * 128, br = 14 + r() * 30; [-128, 0, 128].forEach(function (ox) { [-128, 0, 128].forEach(function (oy) { var gr = fg.createRadialGradient(bx + ox, by + oy, 0, bx + ox, by + oy, br); gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); fg.fillStyle = gr; fg.fillRect(bx + ox - br, by + oy - br, br * 2, br * 2); }); }); }
  fogTex = new THREE.CanvasTexture(fc); fogTex.wrapS = fogTex.wrapT = THREE.RepeatWrapping;
  var pg = new THREE.PlaneGeometry(150, 150); pg.rotateX(-Math.PI / 2);
  for (i = 0; i < 4; i++) { var t = fogTex.clone(); t.needsUpdate = true; t.repeat.set(3 + i, 3 + i); var m = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ alphaMap: t, transparent: true, opacity: 0, depthWrite: false, fog: false })); m.renderOrder = 3; m.visible = false; m.frustumCulled = false; scene.add(m); fog.push(m); }
  // puddles
  var cg = new THREE.CircleGeometry(1, 14); cg.rotateX(-Math.PI / 2);
  pudMesh = new THREE.InstancedMesh(cg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), MAXP);
  pudMesh.frustumCulled = false; pudMesh.renderOrder = 1; for (i = 0; i < MAXP; i++) { pudMesh.setMatrixAt(i, ZERO); pudMesh.setColorAt(i, col.setHex(0x223038)); } scene.add(pudMesh);
}

function sunDir() { var s = W.lights.sun; return v.copy(s.position).sub(s.target.position).normalize(); }
function place(L) {
  var i, r = rnd(L.seed * 131 + 9), n = Math.min(MAXS, Q.n('shafts')), dir = sunDir().clone(); shaftList.length = 0;
  for (i = 0; i < MAXS; i++) shaftMesh.setMatrixAt(i, ZERO);
  var dp = dust.geometry.attributes.position, dn = Math.min(MAXD, Q.n('dust')), di = 0;
  for (i = 0; i < n; i++) { var z = -12 - (i + r()) / n * (L.len - 20), x = (r() < 0.5 ? -1 : 1) * (2.5 + r() * 10), len = 15 + r() * 7, wd = 1.5 + r() * 2.2;
    d.position.set(x + dir.x * len * 0.5, dir.y * len * 0.5 - 0.3, z + dir.z * len * 0.5); q.setFromUnitVectors(UP, dir); d.quaternion.copy(q); d.rotateY(r() * 3); d.scale.set(wd, len, wd); d.updateMatrix(); shaftMesh.setMatrixAt(i, d.matrix);
    shaftList.push({ x: x, z: z, k: 0.6 + r() * 0.4, ph: r() * 6 });
    for (var k = 0; k < Math.floor(dn / Math.max(1, n)) && di < MAXD; k++, di++) { var s = 0.5 + r() * (len * 0.55); dp.setXYZ(di, x + dir.x * s + (r() - 0.5) * wd * 0.6, dir.y * s, z + dir.z * s + (r() - 0.5) * wd * 0.6); } }
  d.quaternion.set(0, 0, 0, 1); d.rotation.set(0, 0, 0);
  shaftMesh.instanceMatrix.needsUpdate = true; dp.needsUpdate = true; dust.geometry.setDrawRange(0, di); At.shafts = n; At.dustN = di;
  // puddles on the open ground beside and on the trail
  At.puddles.length = 0; var pn = Math.min(MAXP, Q.n('puddles')); for (i = 0; i < MAXP; i++) pudMesh.setMatrixAt(i, ZERO);
  for (i = 0; i < pn; i++) { var pz = -8 - (i + r()) / pn * (L.len - 10), px = Math.sin(pz * 0.07) * 1.2 + (r() - 0.5) * 9, tries = 0; while (W.inWater(px, pz) && tries++ < 4) pz -= 3;
    var pr = 0.6 + r() * 1.3; At.puddles.push({ x: px, z: pz, r: pr, sx: pr * (0.8 + r() * 0.6), sz: pr * (0.8 + r() * 0.6), ry: r() * 3, dropT: r() * 2 }); }
  pudMesh.instanceMatrix.needsUpdate = true; At.wetShown = -1;
  if (W.groundMat) baseGround.copy(W.groundMat.color);
}
// is this spot standing water right now? (wet enough and inside a puddle)
At.inPuddle = function (x, z) { if (At.wet < 0.35) return false; for (var i = 0; i < At.puddles.length; i++) { var p = At.puddles[i]; if (Math.abs(x - p.x) < p.r && Math.abs(z - p.z) < p.r) return true; } return false; };

/* ---------- colour grade by hour and weather ---------- */
// [hour, r, g, b, lift, saturation, contrast]
var GRADE = [[0, 0.78, 0.88, 1.12, 0.0, 0.82, 1.06], [5, 0.8, 0.9, 1.1, 0.0, 0.85, 1.05], [6.3, 1.1, 0.96, 0.92, 0.012, 1.02, 1.0], [8, 1.05, 1.02, 0.95, 0.006, 1.04, 1.0], [12, 1, 1, 1, 0, 1, 1],
  [16.5, 1.04, 1, 0.94, 0, 1.02, 1.02], [18.3, 1.14, 0.95, 0.84, 0.01, 1.06, 1.04], [19.8, 0.9, 0.9, 1.06, 0, 0.9, 1.05], [24, 0.78, 0.88, 1.12, 0.0, 0.82, 1.06]];
var G0 = [1, 1, 1, 0, 1, 1];
function gradeAt(h) { for (var i = 1; i < GRADE.length; i++) if (h <= GRADE[i][0]) { var a = GRADE[i - 1], b = GRADE[i], k = (h - a[0]) / Math.max(0.001, b[0] - a[0]); for (var j = 0; j < 6; j++) G0[j] = a[j + 1] + (b[j + 1] - a[j + 1]) * k; return G0; } return G0; }

JO.Sys.add('atmos', {
  init: function () {
    scene = W.scene; build();
    Ev.on('level_load', function (i) { lvl = i; At.wet = 0; });
    Ev.on('blast', function (x, z, r) { flashes.push({ x: x, z: z, t: 0.45, r: r || 4 }); if (flashes.length > 4) flashes.shift(); });
    window.addEventListener('resize', function () { dustU.uScale.value = window.innerHeight; });
  },
  level: function (L) { place(L); },
  quality: function () { if (W.level) place(W.level); },
  frame: function (dt, real) {
    var Wx = JO.Weather, Po = JO.Post, cam = W.camera.position, t = W.time, h = Wx ? Wx.hour : 12, rain = Wx ? Wx.rain : 0, fg = Wx ? Wx.fog : 0, storm = Wx ? Wx.storm : 0, flash = Wx ? Wx.flash : 0, i;
    // ---- shafts: low sun, dry air. A little moonlight at night.
    var sunUp = h > 5.6 && h < 19.2, low = sunUp ? Math.max(0.35, 1 - Math.abs(h - 12.4) / 6.5 * 0.2) + (h < 9 ? (9 - h) / 3.4 * 0.5 : 0) + (h > 16 ? (h - 16) / 3.2 * 0.5 : 0) : 0.16;
    var want = Q.n('shafts') > 0 ? Math.min(1.25, low) * Math.max(0, 1 - rain * 1.15) * (1 + fg * 0.35) * (lvl === 2 && !sunUp ? 0.6 : 1) : 0; At.shaftK += (want - At.shaftK) * Math.min(1, real * 0.8);
    if (At.shafts) { var sc = W.lights.sun.color, k0 = At.shaftK * 0.2;
      for (i = 0; i < shaftList.length; i++) { var s = shaftList[i], near = Math.hypot(s.x - cam.x, s.z - cam.z), fade = Math.min(1, Math.max(0, (near - 1.5) / 5)) * Math.min(1, Math.max(0, (95 - near) / 30)), k = k0 * s.k * fade * (0.85 + 0.15 * Math.sin(t * 0.4 + s.ph));
        shaftMesh.setColorAt(i, col.setRGB(sc.r * k, sc.g * k, sc.b * k * (sunUp ? 0.85 : 1.3))); }
      shaftMesh.instanceColor.needsUpdate = true; shaftMesh.visible = At.shaftK > 0.01;
      dust.visible = At.dustN > 0 && At.shaftK > 0.05; if (dust.visible) { dustU.uTime.value = t; dustU.uColor.value.copy(sc); dustU.uAlpha.value = Math.min(0.9, At.shaftK * 0.75); } }
    else { shaftMesh.visible = false; dust.visible = false; }
    // ---- ground fog
    var n = Math.min(4, Q.n('fogLayers')), dawn = h > 4.5 && h < 8.5 ? 1 - Math.abs(h - 6.5) / 2 : 0, base = (lvl === 1 ? 0.3 : 0.08) + dawn * 0.3 + fg * 0.5 + rain * 0.12;
    At.fogK += ((n ? Math.min(1, base) : 0) - At.fogK) * Math.min(1, real * 0.6); At.sheets = n;
    var fcol = scene.fog ? scene.fog.color : col.setHex(0xffffff), wx = JO.Foliage ? JO.Foliage.uniforms.uWind.value : null;
    for (i = 0; i < fog.length; i++) { var m = fog[i], on = i < n && At.fogK > 0.02; m.visible = on; if (!on) continue;
      m.position.set(Math.round(cam.x / 10) * 10, 0.35 + i * 0.5, Math.round(cam.z / 10) * 10); m.material.color.copy(fcol).lerp(c2.setHex(0xffffff), 0.25); m.material.opacity = At.fogK * (0.62 - i * 0.1);
      var tx = m.material.alphaMap; tx.offset.x += real * 0.006 * (1 + i * 0.5) * (wx ? wx.x : 1); tx.offset.y += real * 0.004 * (1 + i * 0.3) * (wx ? wx.y : 1); }
    // ---- wet world
    if (dt > 0) At.wet = Math.max(0, Math.min(1, At.wet + (rain > 0.25 ? rain * 0.07 : -0.012) * dt));
    var wet = Q.n('puddles') > 0 || Q.on('wetWorld') ? At.wet : 0, shown = Math.round(wet * 40);
    if (W.groundMat) { var gk = 1 - 0.3 * (Q.on('wetWorld') ? At.wet : 0); W.groundMat.color.setRGB(baseGround.r * gk, baseGround.g * gk, baseGround.b * (gk + (1 - gk) * 0.25)); }
    if (shown !== At.wetShown && At.puddles.length) { At.wetShown = shown;
      for (i = 0; i < At.puddles.length; i++) { var p = At.puddles[i], g = Math.max(0, wet - 0.25) / 0.75; if (g <= 0) { pudMesh.setMatrixAt(i, ZERO); continue; }
        d.position.set(p.x, 0.035, p.z); d.rotation.set(0, p.ry, 0); d.scale.set(p.sx * (0.3 + 0.7 * g), 1, p.sz * (0.3 + 0.7 * g)); d.updateMatrix(); pudMesh.setMatrixAt(i, d.matrix); }
      d.rotation.set(0, 0, 0); pudMesh.instanceMatrix.needsUpdate = true; }
    if (At.puddles.length && wet > 0.25) { var sky = scene.fog ? scene.fog.color : col; col.copy(sky).multiplyScalar(0.55 + flash * 0.9); for (i = 0; i < At.puddles.length; i++) pudMesh.setColorAt(i, col); pudMesh.instanceColor.needsUpdate = true; pudMesh.material.opacity = 0.3 + 0.35 * wet;
      if (rain > 0.2 && dt > 0 && JO.Wildlife) for (i = 0; i < At.puddles.length; i++) { p = At.puddles[i]; p.dropT -= dt * rain; if (p.dropT <= 0) { p.dropT = 0.5 + Math.random() * 1.6; if (Math.abs(p.z - cam.z) < 40) JO.Wildlife.ripple(p.x + (Math.random() - 0.5) * p.r, p.z + (Math.random() - 0.5) * p.r, 0.35, 0.05); } } }
    // ---- real light for torches and blasts (the pool decides who gets it)
    var T = W.torches, dk = JO.Squad ? JO.Squad.dark() : 0;
    for (i = 0; i < T.length; i++) { var tr = T[i]; if (Math.abs(tr.z - cam.z) > 60) continue; var fl = 0.85 + Math.sin(t * 17 + i * 3.1) * 0.08 + Math.sin(t * 7.3 + i) * 0.07; JO.Lights.add('t' + i, tr.x, tr.y, tr.z, 0xff8a30, 1.5 * fl * (0.4 + 0.6 * dk), 13, 0.9); }
    for (i = flashes.length - 1; i >= 0; i--) { var f = flashes[i]; f.t -= real; if (f.t <= 0) { flashes.splice(i, 1); continue; } JO.Lights.add('x' + i, f.x, 1.6, f.z, 0xffa040, 4 * (f.t / 0.45), 10 + f.r * 2.5, 3); }
    // ---- grade
    if (Po) { var gr = gradeAt(h), look = Po.look || (Po.look = new THREE.Vector3(1, 1, 1)), sk = storm * 0.5 + rain * 0.2;
      look.set(gr[0] * (1 - sk * 0.1), gr[1] * (1 - sk * 0.04), gr[2] * (1 + sk * 0.08)); Po.lift = gr[3]; Po.satK = gr[4] * (1 - sk * 0.22); Po.conK = gr[5] * (1 + storm * 0.08); }
  }
});
})();
