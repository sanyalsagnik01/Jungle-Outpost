/* ============================================================
   JUNGLE OUTPOST — wildlife.js
   Small lives around the fight. None of it touches combat:
     - bird flocks roost in the canopy and burst out when a shot
       or blast lands nearby, then settle somewhere quieter
     - monkeys sit in the trees of the first two levels and leap
       away when you come close
     - fish jump in the river and leave rings on the water
     - drifting motes: pollen by day, fireflies at night, embers
       in the Outpost; they flare for a moment when something
       important happens (Wl.pulse)
   Everything is instanced and pooled; counts come from JO.Q.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, W = JO.World, Q = JO.Q, Ev = JO.Events, A = JO.Audio;
var Wl = JO.Wildlife = { birds: [], flocks: [], monkeys: [], fish: [], pulse: 0, scatters: 0, hops: 0, jumps: 0 };
var scene, d = new THREE.Object3D(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0), col = new THREE.Color();
var MAXB = 36, MAXM = 6, MAXF = 6, MAXR = 24, MAXMOTE = 360;
var birdMesh, monkeyMesh, fishMesh, ripMesh, motes, moteU, rip = [], ripNext = 0;
function rand(a, b) { return a + Math.random() * (b - a); }

/* ---------- build once ---------- */
function build() {
  // bird: a shallow V. Flapping is done by scaling the instance's Y through zero.
  var bp = new Float32Array([0, 0, 0.16, -0.34, 0.12, -0.06, 0, 0, -0.14, 0, 0, 0.16, 0, 0, -0.14, 0.34, 0.12, -0.06]);
  var bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(bp, 3)); bg.computeVertexNormals();
  birdMesh = new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), MAXB);
  // monkey: body, head, arms and tail merged into one small shape
  var mg = Q.merge([Q.box(0.34, 0.44, 0.3, 0, 0.3, 0), Q.box(0.26, 0.24, 0.26, 0, 0.66, 0.04), Q.box(0.1, 0.4, 0.1, -0.24, 0.3, 0.06), Q.box(0.1, 0.4, 0.1, 0.24, 0.3, 0.06), Q.box(0.07, 0.07, 0.6, 0, 0.14, -0.4)]);
  monkeyMesh = new THREE.InstancedMesh(mg, new THREE.MeshLambertMaterial({ color: 0xffffff }), MAXM);
  var fg = Q.merge([Q.box(0.1, 0.16, 0.5, 0, 0, 0), Q.box(0.03, 0.22, 0.16, 0, 0, -0.32)]);
  fishMesh = new THREE.InstancedMesh(fg, new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x18282a }), MAXF);
  var rg = new THREE.RingGeometry(0.82, 1, 24); rg.rotateX(-Math.PI / 2);
  ripMesh = new THREE.InstancedMesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), MAXR);
  [birdMesh, monkeyMesh, fishMesh, ripMesh].forEach(function (m) { m.frustumCulled = false; for (var i = 0; i < m.count; i++) { m.setMatrixAt(i, ZERO); m.setColorAt(i, col.setHex(0x000000)); } m.instanceMatrix.needsUpdate = true; scene.add(m); });
  ripMesh.renderOrder = 4;
  for (var i = 0; i < MAXR; i++) rip.push({ t: 0, dur: 0, x: 0, z: 0, r: 1, y: 0.13 });

  // motes: positions are wrapped around the camera in the vertex shader, so they are everywhere and cost nothing to move
  var seed = new Float32Array(MAXMOTE * 3), ph = new Float32Array(MAXMOTE);
  for (i = 0; i < MAXMOTE; i++) { seed[i * 3] = Math.random(); seed[i * 3 + 1] = Math.random(); seed[i * 3 + 2] = Math.random(); ph[i] = Math.random(); }
  var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(seed, 3)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
  moteU = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uColor: { value: new THREE.Color(0xfff2c0) }, uAlpha: { value: 0.4 }, uBlink: { value: 0 }, uRise: { value: 0.05 }, uSize: { value: 0.09 }, uScale: { value: 600 }, uPulse: { value: 0 } };
  motes = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: moteU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float aPh; uniform float uTime; uniform vec3 uCam; uniform float uRise; uniform float uSize; uniform float uScale; uniform float uBlink; uniform float uPulse; varying float vA;\n' +
      'void main(){ vec3 box = vec3(36.0, 8.0, 36.0); vec3 p = position * box; float t = uTime;\n' +
      ' p.x += sin(t * 0.21 + aPh * 40.0) * 1.3 + t * 0.12; p.z += cos(t * 0.17 + aPh * 31.0) * 1.3; p.y += t * uRise + sin(t * 0.5 + aPh * 20.0) * 0.4;\n' +
      ' p.xz = mod(p.xz - uCam.xz + box.xz * 0.5, box.xz) - box.xz * 0.5 + uCam.xz; p.y = mod(p.y, box.y) + 0.25;\n' +
      ' float bl = uBlink > 0.0 ? smoothstep(0.55, 1.0, sin(t * (0.7 + aPh * 1.3) + aPh * 60.0)) : 1.0; vA = mix(1.0, bl, min(1.0, uBlink)) + uPulse * 0.8;\n' +
      ' vec4 mv = modelViewMatrix * vec4(p, 1.0); float fade = 1.0 - smoothstep(12.0, 17.5, length(p.xz - uCam.xz)); vA *= fade;\n' +
      ' gl_PointSize = uSize * (1.0 + uPulse) * uScale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uColor; uniform float uAlpha; uniform float uPulse; varying float vA;\n' +
      'void main(){ vec2 c = gl_PointCoord - 0.5; float r = 1.0 - smoothstep(0.1, 0.5, length(c)); vec3 col = mix(uColor, vec3(0.35, 0.95, 0.85), min(1.0, uPulse)); gl_FragColor = vec4(col, r * uAlpha * vA); }' }));
  motes.frustumCulled = false; motes.renderOrder = 5; scene.add(motes);
}

/* ---------- ripples ---------- */
Wl.ripple = function (x, z, r, y) {
  if (!ripMesh || Q.n('ripples') <= 0) return; var o = rip[ripNext]; ripNext = (ripNext + 1) % Math.min(MAXR, Math.max(1, Q.n('ripples')));
  o.x = x; o.z = z; o.r = r || 1; o.t = o.dur = 0.9 + (r || 1) * 0.35; o.y = y === undefined ? 0.13 : y;
};

/* ---------- birds ---------- */
function perch(tree, k) { var a = k * 2.4, r = 0.3 + (k % 3) * 0.35; return { x: tree.x + Math.cos(a) * r, y: tree.h + (tree.big ? 2.4 : 1.6) + (k % 2) * 0.2, z: tree.z + Math.sin(a) * r }; }
function setupBirds(L) {
  Wl.birds.length = 0; Wl.flocks.length = 0; var n = Math.min(MAXB, Q.n('birds')), trees = W.trees, i;
  for (i = 0; i < MAXB; i++) birdMesh.setMatrixAt(i, ZERO);
  if (!n || trees.length < 4) { birdMesh.instanceMatrix.needsUpdate = true; return; }
  var dark = L.torches ? 0x0d0d10 : (L.river ? 0x1c2a2c : 0x20261c), bright = L.torches ? 0x35302c : (L.river ? 0xd8e8e4 : 0xe8e0c8), made = 0, f = 0;
  while (made < n) { var size = Math.min(n - made, 4 + ((f * 7) % 3)), tree = trees[(Math.random() * trees.length) | 0], fl = { tree: tree, state: 0, t: 0, dur: 1, from: null, to: null, calm: rand(6, 14) };
    for (i = 0; i < size; i++) { var p = perch(tree, i); Wl.birds.push({ fl: fl, k: i, x: p.x, y: p.y, z: p.z, ph: Math.random() * 6, yaw: Math.random() * 6, off: rand(-1, 1), lift: rand(0.7, 1.3) });
      birdMesh.setColorAt(made + i, col.setHex((f + i) % 3 === 0 ? bright : dark)); }
    Wl.flocks.push(fl); made += size; f++; }
  birdMesh.instanceColor.needsUpdate = true;
}
function launch(fl, fromX, fromZ) {
  var trees = W.trees, best = null, bs = -1;
  for (var q = 0; q < 8; q++) { var t = trees[(Math.random() * trees.length) | 0], dd = Math.hypot(t.x - fromX, t.z - fromZ) - Math.abs(Math.hypot(t.x - fl.tree.x, t.z - fl.tree.z) - 45) * 0.5; if (dd > bs) { bs = dd; best = t; } }
  fl.from = fl.tree; fl.to = best || fl.tree; fl.state = 1; fl.t = 0; fl.dur = Math.min(10, Math.max(4.5, Math.hypot(fl.to.x - fl.from.x, fl.to.z - fl.from.z) / 9)) + rand(0, 1.5); fl.tree = fl.to; Wl.scatters++;
  Ev.emit('wildlife', 'birds', fl.from.x, fl.from.z);
}
// anything loud at (x, z): flocks within r take off
Wl.scatterNear = function (x, z, r) {
  var n = 0; for (var i = 0; i < Wl.flocks.length; i++) { var fl = Wl.flocks[i]; if (fl.state !== 0) continue; if (Math.hypot(fl.tree.x - x, fl.tree.z - z) < r) { launch(fl, x, z); n++; } }
  for (i = 0; i < Wl.monkeys.length; i++) { var m = Wl.monkeys[i]; if (m.state === 0 && Math.hypot(m.x - x, m.z - z) < r * 0.6) hop(m, x, z); }
  return n;
};
function updateBirds(dt, t) {
  var P = JO.Player, i;
  for (i = 0; i < Wl.flocks.length; i++) { var fl = Wl.flocks[i];
    if (fl.state === 1) { fl.t += dt; if (fl.t >= fl.dur) { fl.state = 0; fl.calm = rand(20, 50); } }
    else { fl.calm -= dt; if (P && Math.hypot(fl.tree.x - P.pos.x, fl.tree.z - P.pos.z) < 5 && !P.crouch && JO.Game.state === 'playing') launch(fl, P.pos.x, P.pos.z); else if (fl.calm <= 0 && Math.random() < dt * 0.05) launch(fl, fl.tree.x, fl.tree.z); } }
  for (i = 0; i < Wl.birds.length; i++) { var b = Wl.birds[i]; fl = b.fl;
    if (fl.state === 0) { var p = perch(fl.tree, b.k); b.x = p.x; b.y = p.y; b.z = p.z; d.position.set(b.x, b.y, b.z); d.rotation.set(0, b.yaw + Math.sin(t * 0.7 + b.ph) * 0.4, 0); d.scale.set(0.5, 0.35, 1); }
    else { var k = Math.min(1, fl.t / fl.dur), e = k * k * (3 - 2 * k), a = perch(fl.from, b.k), c = perch(fl.to, b.k), wob = Math.sin(k * Math.PI);
      var nx = a.x + (c.x - a.x) * e + Math.sin(t * 1.1 + b.ph) * 3.2 * wob * b.off, nz = a.z + (c.z - a.z) * e + Math.cos(t * 0.9 + b.ph) * 3.2 * wob, ny = a.y + (c.y - a.y) * e + wob * 7 * b.lift + Math.sin(t * 2 + b.ph) * 0.5 * wob;
      var yaw = Math.atan2(nx - b.x, nz - b.z); b.x = nx; b.y = ny; b.z = nz; d.position.set(nx, ny, nz); d.rotation.set(0, yaw, Math.sin(t * 1.3 + b.ph) * 0.3);
      d.scale.set(1.25, Math.sin(t * 17 + b.ph * 3) * 1.5, 1.25); }
    d.updateMatrix(); birdMesh.setMatrixAt(i, d.matrix); }
  if (Wl.birds.length) birdMesh.instanceMatrix.needsUpdate = true;
}

/* ---------- monkeys ---------- */
function seat(tree) { return { x: tree.x + 0.5, y: tree.h * 0.82 + (tree.big ? 1 : 0.4), z: tree.z + 0.3 }; }
function setupMonkeys(L) {
  Wl.monkeys.length = 0; var n = L.torches ? 0 : Math.min(MAXM, Q.n('monkeys')), trees = W.trees.filter(function (t) { return !t.big && t.z < -20 && t.z > W.A0 + 12; }), i;
  for (i = 0; i < MAXM; i++) monkeyMesh.setMatrixAt(i, ZERO);
  for (i = 0; i < n && trees.length > 3; i++) { var t = trees[((i + 0.5) / n * trees.length) | 0], s = seat(t);
    Wl.monkeys.push({ tree: t, x: s.x, y: s.y, z: s.z, state: 0, t: 0, dur: 1, fx: 0, fy: 0, fz: 0, tx: 0, ty: 0, tz: 0, yaw: Math.random() * 6, ph: Math.random() * 6, cd: 0 });
    monkeyMesh.setColorAt(i, col.setHex(L.river ? 0x5a5048 : 0x6a4a30)); }
  monkeyMesh.instanceColor.needsUpdate = true; monkeyMesh.instanceMatrix.needsUpdate = true;
}
function hop(m, awayX, awayZ) {
  var trees = W.trees, best = null, bs = -1e9;
  for (var i = 0; i < trees.length; i++) { var t = trees[i]; if (t === m.tree) continue; var dd = Math.hypot(t.x - m.x, t.z - m.z); if (dd > 15 || dd < 2) continue;
    var sc = Math.hypot(t.x - awayX, t.z - awayZ) + Math.random() * 4; if (sc > bs) { bs = sc; best = t; } }
  if (!best) return; var s = seat(best); m.fx = m.x; m.fy = m.y; m.fz = m.z; m.tx = s.x; m.ty = s.y; m.tz = s.z; m.tree = best; m.state = 1; m.t = 0; m.dur = 0.55 + Math.hypot(s.x - m.x, s.z - m.z) * 0.05; m.yaw = Math.atan2(s.x - m.x, s.z - m.z); Wl.hops++;
  Ev.emit('wildlife', 'monkey', m.x, m.z);
}
function updateMonkeys(dt, t) {
  var P = JO.Player; for (var i = 0; i < Wl.monkeys.length; i++) { var m = Wl.monkeys[i];
    if (m.cd > 0) m.cd -= dt;
    if (m.state === 1) { m.t += dt; var k = Math.min(1, m.t / m.dur); m.x = m.fx + (m.tx - m.fx) * k; m.z = m.fz + (m.tz - m.fz) * k; m.y = m.fy + (m.ty - m.fy) * k + Math.sin(k * Math.PI) * 2.2; if (k >= 1) { m.state = 0; m.cd = 1.2; } }
    else if (P && m.cd <= 0 && JO.Game.state === 'playing' && Math.hypot(m.x - P.pos.x, m.z - P.pos.z) < 9) hop(m, P.pos.x, P.pos.z);
    d.position.set(m.x, m.y + (m.state ? 0 : Math.abs(Math.sin(t * 1.7 + m.ph)) * 0.05), m.z); d.rotation.set(m.state ? -0.6 : 0, m.yaw + (m.state ? 0 : Math.sin(t * 0.5 + m.ph) * 0.5), 0); d.scale.setScalar(1.25); d.updateMatrix(); monkeyMesh.setMatrixAt(i, d.matrix); }
  if (Wl.monkeys.length) monkeyMesh.instanceMatrix.needsUpdate = true;
}

/* ---------- fish ---------- */
function setupFish() {
  Wl.fish.length = 0; var n = W.waters.length ? Math.min(MAXF, Q.n('fish')) : 0, i;
  for (i = 0; i < MAXF; i++) { fishMesh.setMatrixAt(i, ZERO); fishMesh.setColorAt(i, col.setHex(i % 2 ? 0xc8d8d0 : 0x8fb0b8)); }
  for (i = 0; i < n; i++) Wl.fish.push({ wait: rand(1, 9), t: 0, x: 0, z: 0, dir: 1, w: null });
  fishMesh.instanceColor.needsUpdate = true; fishMesh.instanceMatrix.needsUpdate = true;
}
function updateFish(dt) {
  var cam = W.camera.position;
  for (var i = 0; i < Wl.fish.length; i++) { var f = Wl.fish[i];
    if (f.t <= 0) { f.wait -= dt; if (f.wait > 0) continue;
      var w = W.waters[(Math.random() * W.waters.length) | 0]; f.w = w; f.z = rand(w.z1 + 1.2, w.z0 - 1.2);
      // jump where the player can see it; never on the bridge deck
      f.x = Math.max(w.x0 + 1, Math.min(w.x1 - 1, cam.x + rand(-16, 16))); if (w.bridge && Math.abs(f.x) < 4) f.x += f.x < 0 ? -5 : 5; if (f.x < w.x0 + 1 || f.x > w.x1 - 1) { f.wait = 1; continue; }
      f.dir = Math.random() < 0.5 ? -1 : 1; f.t = 0.0001; Wl.ripple(f.x, f.z, 0.9); Wl.jumps++; Ev.emit('wildlife', 'fish', f.x, f.z); }
    f.t += dt; var k = f.t / 0.85;
    if (k >= 1) { f.t = 0; f.wait = rand(4, 14); Wl.ripple(f.x + f.dir * 1.5, f.z, 1.2); fishMesh.setMatrixAt(i, ZERO); continue; }
    d.position.set(f.x + f.dir * 1.5 * k, 0.1 + Math.sin(k * Math.PI) * 0.85, f.z); d.rotation.set(-(1 - 2 * k) * 1.1, f.dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0); d.scale.setScalar(1.1); d.updateMatrix(); fishMesh.setMatrixAt(i, d.matrix); }
  if (Wl.fish.length) fishMesh.instanceMatrix.needsUpdate = true;
}
function updateRipples(dt) {
  var any = false; for (var i = 0; i < MAXR; i++) { var o = rip[i]; if (o.t <= 0) continue; o.t -= dt; any = true;
    if (o.t <= 0) { ripMesh.setMatrixAt(i, ZERO); continue; }
    var k = 1 - o.t / o.dur, s = o.r * (0.25 + k * 1.6), b = (1 - k) * 0.5; d.position.set(o.x, o.y, o.z); d.rotation.set(0, 0, 0); d.scale.set(s, 1, s); d.updateMatrix(); ripMesh.setMatrixAt(i, d.matrix); ripMesh.setColorAt(i, col.setRGB(b, b, b)); }
  if (any) { ripMesh.instanceMatrix.needsUpdate = true; ripMesh.instanceColor.needsUpdate = true; }
}

/* ---------- system ---------- */
var MOTE = [ // per level: day colour, night colour, rise speed
  { day: 0xfff2c0, night: 0xd8ff7a, rise: 0.04 }, { day: 0xcfe8e0, night: 0x9affd0, rise: 0.02 }, { day: 0xffa040, night: 0xff8a30, rise: 0.5 }];
var lvl = 0, playerWet = 0;
JO.Sys.add('wildlife', {
  init: function () {
    scene = W.scene; build();
    Ev.on('noise', function (x, z, r, kind) { if (kind === 'shot' || kind === undefined) Wl.scatterNear(x, z, Math.min(48, (r || 30) * 1.1)); });
    Ev.on('blast', function (x, z) { Wl.scatterNear(x, z, 70); });
    ['boss_start', 'boss_dead', 'collect', 'ending', 'lightning'].forEach(function (n) { Ev.on(n, function () { Wl.pulse = 1; }); });
    Ev.on('level_load', function (i) { lvl = i; });
    window.addEventListener('resize', function () { moteU.uScale.value = window.innerHeight; }); moteU.uScale.value = window.innerHeight;
  },
  level: function (L) { setupBirds(L); setupMonkeys(L); setupFish(); for (var i = 0; i < MAXR; i++) { rip[i].t = 0; ripMesh.setMatrixAt(i, ZERO); } ripMesh.instanceMatrix.needsUpdate = true; },
  quality: function () { if (W.level) this.level(W.level); },
  frame: function (dt, real) {
    var t = W.time, Wx = JO.Weather, P = JO.Player, G = JO.Game;
    if (dt > 0) { updateBirds(dt, t); updateMonkeys(dt, t); updateFish(dt); updateRipples(dt);
      if (P && P.inWater && G.state === 'playing') { playerWet -= dt; if (playerWet <= 0 && Math.hypot(P.vx, P.vz) > 0.5) { playerWet = 0.3; Wl.ripple(P.pos.x, P.pos.z, 0.9); } } }
    // motes follow the hour: pollen by day, fireflies after dark
    var n = Math.min(MAXMOTE, Q.n('motes')); motes.visible = n > 0; if (!n) return;
    motes.geometry.setDrawRange(0, n);
    var h = Wx ? Wx.hour : 12, night = h < 5.5 || h > 19 ? 1 : (h < 7 ? (7 - h) / 1.5 : (h > 17.5 ? (h - 17.5) / 1.5 : 0)), m = MOTE[lvl] || MOTE[0], wet = Wx ? Wx.rain : 0;
    if (Wl.pulse > 0) Wl.pulse = Math.max(0, Wl.pulse - real * 0.45);
    moteU.uTime.value += dt > 0 ? dt : real * 0.2; moteU.uCam.value.copy(W.camera.position);
    moteU.uColor.value.setHex(m.day).lerp(col.setHex(m.night), night); moteU.uBlink.value = lvl === 2 ? 0 : night; moteU.uRise.value = m.rise;
    moteU.uAlpha.value = (lvl === 2 ? 0.7 : 0.28 + night * 0.6) * (1 - wet * 0.8); moteU.uSize.value = lvl === 2 ? 0.07 : 0.06 + night * 0.07; moteU.uPulse.value = Wl.pulse;
  }
});
})();
