/* ============================================================
   JUNGLE OUTPOST — fx.js
   Pooled effects: particles, tracers, enemy projectiles,
   ground markers / shockwave rings / warning lines, explosion
   flashes, muzzle flash and screen shake. Nothing here
   allocates during play.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, W = JO.World;
var FX = JO.FX = { shake: 0 };
var scene, dummy = new THREE.Object3D(), col = new THREE.Color(), v1 = new THREE.Vector3();
var ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/* ---------- particles ---------- */
var PN = 800, pPos, pCol, pSize, pVel, pLife, pMax, pGrav, pBase, pPts, pNext = 0;
/* ---------- tracers ---------- */
var TN = 48, tMesh, tSeg = new Float32Array(TN * 6), tLife = new Float32Array(TN), tMax = new Float32Array(TN), tW = new Float32Array(TN), tNext = 0;
/* ---------- enemy projectiles ---------- */
var BN = 220, bMesh, bAct = new Uint8Array(BN), bP = new Float32Array(BN * 3), bV = new Float32Array(BN * 3), bQ = new Float32Array(BN * 4),
  bLife = new Float32Array(BN), bDmg = new Float32Array(BN), bGrav = new Float32Array(BN), bSize = new Float32Array(BN), bO = new Float32Array(BN * 2), bNext = 0;
var rings = [], lines = [], flashes = [], muzzle, muzzleLight, muzzleT = 0;

FX.init = function (sc) {
  scene = sc;
  // particles: tiny custom shader -> per-particle colour, alpha and size
  var g = new THREE.BufferGeometry();
  pPos = new Float32Array(PN * 3); pCol = new Float32Array(PN * 4); pSize = new Float32Array(PN);
  pVel = new Float32Array(PN * 3); pLife = new Float32Array(PN); pMax = new Float32Array(PN); pGrav = new Float32Array(PN); pBase = new Float32Array(PN);
  for (var i = 0; i < PN; i++) pPos[i * 3 + 1] = -999;
  g.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); g.setAttribute('aCol', new THREE.BufferAttribute(pCol, 4)); g.setAttribute('aSize', new THREE.BufferAttribute(pSize, 1));
  var pm = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 600 } }, transparent: true, depthWrite: false,
    vertexShader: 'attribute vec4 aCol; attribute float aSize; varying vec4 vCol; uniform float uScale;' +
      'void main(){ vCol=aCol; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*uScale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'varying vec4 vCol; void main(){ gl_FragColor=vCol; }'
  });
  pPts = new THREE.Points(g, pm); pPts.frustumCulled = false; pPts.renderOrder = 5; scene.add(pPts); FX.pMat = pm;

  var tg = new THREE.BoxGeometry(1, 1, 1);
  tMesh = new THREE.InstancedMesh(tg, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }), TN);
  tMesh.frustumCulled = false; for (i = 0; i < TN; i++) { tMesh.setMatrixAt(i, ZERO); tMesh.setColorAt(i, col.setHex(0xffffff)); } scene.add(tMesh);

  var bg = new THREE.BoxGeometry(0.11, 0.11, 0.95);
  bMesh = new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ fog: false }), BN);
  bMesh.frustumCulled = false; for (i = 0; i < BN; i++) { bMesh.setMatrixAt(i, ZERO); bMesh.setColorAt(i, col.setHex(0xffffff)); } scene.add(bMesh);

  var rg = new THREE.RingGeometry(0.9, 1, 44); rg.rotateX(-Math.PI / 2);
  var dg = new THREE.CircleGeometry(1, 30); dg.rotateX(-Math.PI / 2);
  var wg = new THREE.CylinderGeometry(1, 1, 1, 44, 1, true);
  for (i = 0; i < 18; i++) {
    var mat = new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, fog: false });
    var dm = new THREE.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.25, depthWrite: false, fog: false });
    var r = { ring: new THREE.Mesh(rg, mat), disc: new THREE.Mesh(dg, dm), wall: new THREE.Mesh(wg, mat), mat: mat, dm: dm, used: false, auto: false, life: 0, dur: 1, r: 1 };
    r.ring.visible = r.disc.visible = r.wall.visible = false; r.ring.renderOrder = r.disc.renderOrder = 3;
    scene.add(r.ring); scene.add(r.disc); scene.add(r.wall); rings.push(r);
  }
  var lg = new THREE.PlaneGeometry(1, 1); lg.rotateX(-Math.PI / 2);
  for (i = 0; i < 6; i++) { var lm = new THREE.MeshBasicMaterial({ color: 0xff2010, transparent: true, opacity: 0.5, depthWrite: false, fog: false });
    var l = { mesh: new THREE.Mesh(lg, lm), mat: lm, life: 0, dur: 1 }; l.mesh.visible = false; l.mesh.renderOrder = 3; scene.add(l.mesh); lines.push(l); }
  var fg = new THREE.IcosahedronGeometry(1, 1);
  for (i = 0; i < 8; i++) { var fm = new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.9, depthWrite: false, fog: false });
    var f = { mesh: new THREE.Mesh(fg, fm), mat: fm, life: 0, r: 1 }; f.mesh.visible = false; scene.add(f.mesh); flashes.push(f); }
  muzzle = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  muzzle.visible = false; scene.add(muzzle);
  muzzleLight = new THREE.PointLight(0xffc060, 0, 14); scene.add(muzzleLight);
};

FX.reset = function () {
  var i; for (i = 0; i < PN; i++) { pLife[i] = 0; pPos[i * 3 + 1] = -999; pCol[i * 4 + 3] = 0; }
  for (i = 0; i < TN; i++) { tLife[i] = 0; tMesh.setMatrixAt(i, ZERO); } tMesh.instanceMatrix.needsUpdate = true;
  for (i = 0; i < BN; i++) { bAct[i] = 0; bMesh.setMatrixAt(i, ZERO); } bMesh.instanceMatrix.needsUpdate = true;
  for (i = 0; i < rings.length; i++) FX.ringFree(rings[i]);
  for (i = 0; i < lines.length; i++) { lines[i].life = 0; lines[i].mesh.visible = false; }
  for (i = 0; i < flashes.length; i++) { flashes[i].life = 0; flashes[i].mesh.visible = false; }
  FX.shake = 0; muzzle.visible = false; muzzleLight.intensity = 0;
};

FX.addShake = function (m) { if (m > FX.shake) FX.shake = Math.min(1.4, m); };

/* particles */
FX.burst = function (x, y, z, n, hex, speed, life, grav, size, up) {
  col.setHex(hex);
  for (var k = 0; k < n; k++) {
    var i = pNext; pNext = (pNext + 1) % PN;
    var a = Math.random() * 6.283, e = Math.random() * 2 - 1, s = speed * (0.35 + Math.random() * 0.65), h = Math.sqrt(1 - e * e);
    pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z;
    pVel[i * 3] = Math.cos(a) * h * s; pVel[i * 3 + 1] = e * s + (up || 0); pVel[i * 3 + 2] = Math.sin(a) * h * s;
    var sh = 0.75 + Math.random() * 0.5;
    pCol[i * 4] = Math.min(1, col.r * sh); pCol[i * 4 + 1] = Math.min(1, col.g * sh); pCol[i * 4 + 2] = Math.min(1, col.b * sh); pCol[i * 4 + 3] = 1;
    pLife[i] = pMax[i] = life * (0.6 + Math.random() * 0.6); pGrav[i] = grav === undefined ? 9 : grav; pBase[i] = pSize[i] = (size || 0.14) * (0.7 + Math.random() * 0.6);
  }
};
FX.puff = function (x, y, z, hex, size) { FX.burst(x, y, z, 1, hex, 0.5, 0.5, -1.2, size || 0.3, 0.3); };

FX.tracer = function (x0, y0, z0, x1, y1, z1, hex, width, life) {
  var i = tNext; tNext = (tNext + 1) % TN; var o = i * 6;
  tSeg[o] = x0; tSeg[o + 1] = y0; tSeg[o + 2] = z0; tSeg[o + 3] = x1; tSeg[o + 4] = y1; tSeg[o + 5] = z1;
  tLife[i] = tMax[i] = life || 0.09; tW[i] = width || 0.035; tMesh.setColorAt(i, col.setHex(hex || 0xffe9a0)); tMesh.instanceColor.needsUpdate = true;
};

FX.muzzleFlash = function (x, y, z, size) {
  muzzle.position.set(x, y, z); muzzle.scale.setScalar(size || 0.5); muzzle.rotation.set(Math.random() * 3, Math.random() * 3, 0); muzzle.visible = true; muzzleT = 0.05;
  muzzleLight.position.set(x, y, z); muzzleLight.intensity = 2.2;
};

/* enemy projectiles (visible + dodgeable). grav > 0 makes an arcing projectile (knives) */
FX.bullet = function (x, y, z, dx, dy, dz, speed, dmg, hex, grav, size, life) {
  var i = -1, k;
  for (k = 0; k < BN; k++) { var j = (bNext + k) % BN; if (!bAct[j]) { i = j; break; } }
  if (i < 0) return; bNext = (i + 1) % BN;
  bAct[i] = 1; bP[i * 3] = x; bP[i * 3 + 1] = y; bP[i * 3 + 2] = z; bV[i * 3] = dx * speed; bV[i * 3 + 1] = dy * speed; bV[i * 3 + 2] = dz * speed;
  bLife[i] = life || 3.2; bDmg[i] = dmg; bGrav[i] = grav || 0; bSize[i] = size || 1; bO[i * 2] = x; bO[i * 2 + 1] = z;
  dummy.position.set(0, 0, 0); dummy.lookAt(dx, dy, dz); bQ[i * 4] = dummy.quaternion.x; bQ[i * 4 + 1] = dummy.quaternion.y; bQ[i * 4 + 2] = dummy.quaternion.z; bQ[i * 4 + 3] = dummy.quaternion.w;
  bMesh.setColorAt(i, col.setHex(hex || 0xffd060)); bMesh.instanceColor.needsUpdate = true;
};
FX.updateBullets = function (dt) {
  var P = JO.Player, any = false;
  for (var i = 0; i < BN; i++) {
    if (!bAct[i]) continue; any = true;
    var o = i * 3; bLife[i] -= dt;
    if (bGrav[i]) bV[o + 1] -= bGrav[i] * dt;
    var vx = bV[o], vy = bV[o + 1], vz = bV[o + 2], sp = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1, dist = sp * dt;
    var dx = vx / sp, dy = vy / sp, dz = vz / sp, x = bP[o], y = bP[o + 1], z = bP[o + 2];
    var t = W.raycast(x, y, z, dx, dy, dz, dist), dead = bLife[i] <= 0;
    if (!P.dead) {
      var ox = P.pos.x - x, oy = P.pos.y + 0.95 - y, oz = P.pos.z - z, s = ox * dx + oy * dy + oz * dz;
      if (s < 0) s = 0; else if (s > t) s = t;
      var cx = x + dx * s - P.pos.x, cy = y + dy * s - P.pos.y, cz = z + dz * s - P.pos.z;
      if (cx * cx + cz * cz < 0.27 && cy > -0.1 && cy < 1.9) { if (P.damage(bDmg[i], bO[i * 2], bO[i * 2 + 1], 'bullet')) { dead = true; FX.burst(x + dx * s, y + dy * s, z + dz * s, 4, 0xff4030, 3, 0.25); } }
    }
    if (!dead && t < dist) { dead = true; FX.burst(x + dx * t, y + dy * t, z + dz * t, 3, 0xd8c8a0, 2.5, 0.25); }
    if (dead) { bAct[i] = 0; bMesh.setMatrixAt(i, ZERO); continue; }
    bP[o] = x + vx * dt; bP[o + 1] = y + vy * dt; bP[o + 2] = z + vz * dt;
  }
  FX.bulletsLive = any;
};

FX.clearBullets = function () { for (var i = 0; i < BN; i++) if (bAct[i]) { bAct[i] = 0; bMesh.setMatrixAt(i, ZERO); } bMesh.instanceMatrix.needsUpdate = true; };

/* markers: an outline ring with a disc that fills as the fuse runs down */
function ringGet() { for (var i = 0; i < rings.length; i++) if (!rings[i].used) { rings[i].used = true; return rings[i]; } return null; }
FX.ringFree = function (r) { if (!r) return; r.used = false; r.auto = false; r.ring.visible = r.disc.visible = r.wall.visible = false; };
FX.marker = function (x, z, radius, dur, hex) {
  var r = ringGet(); if (!r) return null; r.auto = true; r.life = r.dur = dur; r.r = radius;
  r.mat.color.setHex(hex || 0xff3020); r.dm.color.setHex(hex || 0xff3020); r.mat.opacity = 0.95;
  r.ring.position.set(x, 0.09, z); r.ring.scale.set(radius, 1, radius); r.disc.position.set(x, 0.07, z); r.disc.scale.set(0.01, 1, 0.01);
  r.ring.visible = r.disc.visible = true; return r;
};
// shockwave ring: caller drives radius every step
FX.waveAlloc = function (hex) { var r = ringGet(); if (!r) return null; r.auto = false; r.mat.color.setHex(hex || 0xffb030); r.mat.opacity = 0.9; r.ring.visible = r.wall.visible = true; return r; };
FX.waveSet = function (r, x, z, radius, fade) { r.ring.position.set(x, 0.1, z); r.ring.scale.set(radius, 1, radius); r.wall.position.set(x, 0.3, z); r.wall.scale.set(radius, 0.6, radius); r.mat.opacity = 0.85 * fade; };
FX.groundLine = function (x0, z0, x1, z1, width, dur, hex) {
  var l = null; for (var i = 0; i < lines.length; i++) if (lines[i].life <= 0) { l = lines[i]; break; } if (!l) return null;
  var dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
  l.mesh.position.set((x0 + x1) / 2, 0.08, (z0 + z1) / 2); l.mesh.scale.set(width, 1, len); l.mesh.rotation.y = Math.atan2(dx, dz);
  l.mat.color.setHex(hex || 0xff2010); l.life = l.dur = dur; l.mesh.visible = true; return l;
};
FX.explosion = function (x, y, z, radius) {
  var f = null; for (var i = 0; i < flashes.length; i++) if (flashes[i].life <= 0) { f = flashes[i]; break; }
  if (f) { f.life = 0.32; f.r = radius; f.mesh.position.set(x, y, z); f.mesh.visible = true; }
  FX.burst(x, y + 0.3, z, Math.min(40, 14 + radius * 5), 0xffa030, 5 + radius * 1.6, 0.6, 7, 0.22, 3);
  FX.burst(x, y + 0.3, z, 12, 0x3a3a3a, 3 + radius, 0.9, -1, 0.34, 2);
  var P = JO.Player, d = Math.hypot(x - P.pos.x, z - P.pos.z); FX.addShake(Math.max(0, (radius * 0.16) * (1 - d / 40)));
  JO.Audio.playAt('explode', x, z, Math.min(1, 0.4 + radius * 0.12));
};

/* per-frame visual update (dt already scaled by slow-motion) */
FX.update = function (dt, time) {
  var i, o;
  for (i = 0; i < PN; i++) {
    if (pLife[i] <= 0) continue; pLife[i] -= dt; o = i * 3;
    if (pLife[i] <= 0) { pPos[o + 1] = -999; pCol[i * 4 + 3] = 0; continue; }
    pVel[o + 1] -= pGrav[i] * dt; pPos[o] += pVel[o] * dt; pPos[o + 1] += pVel[o + 1] * dt; pPos[o + 2] += pVel[o + 2] * dt;
    if (pPos[o + 1] < 0.03 && pGrav[i] > 0) { pPos[o + 1] = 0.03; pVel[o + 1] *= -0.3; pVel[o] *= 0.6; pVel[o + 2] *= 0.6; }
    var k = pLife[i] / pMax[i]; pCol[i * 4 + 3] = Math.min(1, k * 2); pSize[i] = pBase[i] * (0.5 + 0.5 * k);
  }
  var ga = pPts.geometry.attributes; ga.position.needsUpdate = true; ga.aCol.needsUpdate = true; ga.aSize.needsUpdate = true;

  var tAny = false;
  for (i = 0; i < TN; i++) {
    if (tLife[i] <= 0) continue; tLife[i] -= dt; tAny = true;
    if (tLife[i] <= 0) { tMesh.setMatrixAt(i, ZERO); continue; }
    o = i * 6; var kx = tSeg[o + 3] - tSeg[o], ky = tSeg[o + 4] - tSeg[o + 1], kz = tSeg[o + 5] - tSeg[o + 2], len = Math.sqrt(kx * kx + ky * ky + kz * kz);
    dummy.position.set(tSeg[o] + kx / 2, tSeg[o + 1] + ky / 2, tSeg[o + 2] + kz / 2); dummy.lookAt(tSeg[o + 3], tSeg[o + 4], tSeg[o + 5]);
    var w = tW[i] * (tLife[i] / tMax[i]); dummy.scale.set(w, w, len); dummy.updateMatrix(); tMesh.setMatrixAt(i, dummy.matrix);
  }
  if (tAny) tMesh.instanceMatrix.needsUpdate = true;

  if (FX.bulletsLive || FX._bDirty) {
    for (i = 0; i < BN; i++) { if (!bAct[i]) continue; o = i * 3;
      dummy.position.set(bP[o], bP[o + 1], bP[o + 2]); dummy.quaternion.set(bQ[i * 4], bQ[i * 4 + 1], bQ[i * 4 + 2], bQ[i * 4 + 3]);
      if (bGrav[i]) dummy.rotateX(time * 14);
      dummy.scale.setScalar(bSize[i]); dummy.updateMatrix(); bMesh.setMatrixAt(i, dummy.matrix); }
    bMesh.instanceMatrix.needsUpdate = true; FX._bDirty = FX.bulletsLive;
  }

  for (i = 0; i < rings.length; i++) { var r = rings[i]; if (!r.used || !r.auto) continue;
    r.life -= dt; if (r.life <= 0) { FX.ringFree(r); continue; }
    var p = 1 - r.life / r.dur, s = Math.max(0.01, r.r * p); r.disc.scale.set(s, 1, s);
    r.dm.opacity = 0.2 + 0.2 * Math.abs(Math.sin(time * (6 + p * 16))); r.mat.opacity = 0.6 + 0.4 * Math.abs(Math.sin(time * (6 + p * 16))); }
  for (i = 0; i < lines.length; i++) { var l = lines[i]; if (l.life <= 0) continue; l.life -= dt;
    if (l.life <= 0) { l.mesh.visible = false; continue; } l.mat.opacity = 0.3 + 0.3 * Math.abs(Math.sin(time * 18)); }
  for (i = 0; i < flashes.length; i++) { var f = flashes[i]; if (f.life <= 0) continue; f.life -= dt;
    if (f.life <= 0) { f.mesh.visible = false; continue; } var q = 1 - f.life / 0.32; f.mesh.scale.setScalar(f.r * (0.3 + q * 0.8)); f.mat.opacity = 0.9 * (1 - q); }
  if (muzzleT > 0) { muzzleT -= dt; if (muzzleT <= 0) muzzle.visible = false; }
  if (muzzleLight.intensity > 0) muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 40);
  if (FX.shake > 0) FX.shake = Math.max(0, FX.shake - dt * 2.4);
};
})();
