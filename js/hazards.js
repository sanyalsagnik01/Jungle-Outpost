/* ============================================================
   JUNGLE OUTPOST — hazards.js
   Pooled area hazards shared by enemies and bosses:
   grenades, mortar shells, shockwave rings, poison gas clouds
   and homing missiles. Each one shows a warning before it hurts.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, W = JO.World, FX = JO.FX, A = JO.Audio, G = W.G;
var H = JO.Haz = { missiles: [] };
var GRAV = 18, grenades = [], waves = [], clouds = [], scene;

H.init = function (sc) {
  scene = sc; var i, m;
  var gm = new THREE.MeshLambertMaterial({ color: 0x2c3a22 }), bl = new THREE.MeshBasicMaterial({ color: 0xff2a10 });
  for (i = 0; i < 14; i++) { m = new THREE.Group(); var b = new THREE.Mesh(G.ico0, gm); b.scale.setScalar(0.34); m.add(b);
    var l = new THREE.Mesh(G.box, bl); l.scale.set(0.12, 0.12, 0.12); l.position.y = 0.2; m.add(l); m.visible = false; scene.add(m);
    grenades.push({ active: false, mesh: m, light: l }); }
  for (i = 0; i < 5; i++) waves.push({ active: false, ring: null });
  for (i = 0; i < 6; i++) { var cm = new THREE.MeshBasicMaterial({ color: 0x7fe04a, transparent: true, opacity: 0.3, depthWrite: false });
    m = new THREE.Group(); for (var k = 0; k < 6; k++) { var p = new THREE.Mesh(G.ico0, cm); var a = k / 6 * 6.283;
      p.position.set(Math.cos(a) * 0.55, 0.5 + (k % 2) * 0.35, Math.sin(a) * 0.55); p.scale.set(0.95, 0.7, 0.95); m.add(p); }
    m.visible = false; scene.add(m); clouds.push({ active: false, mesh: m, mat: cm }); }
  var mm = new THREE.MeshLambertMaterial({ color: 0xd8d8d0 }), mr = new THREE.MeshLambertMaterial({ color: 0xc02a1a }), mf = new THREE.MeshBasicMaterial({ color: 0xffb040 });
  for (i = 0; i < 8; i++) { m = new THREE.Group();
    var body = new THREE.Mesh(G.cyl, mm); body.scale.set(0.3, 1.1, 0.3); body.rotation.x = Math.PI / 2; m.add(body);
    var nose = new THREE.Mesh(G.cone, mr); nose.scale.set(0.3, 0.45, 0.3); nose.rotation.x = Math.PI / 2; nose.position.z = 0.75; m.add(nose);
    var fl = new THREE.Mesh(G.cone, mf); fl.scale.set(0.26, 0.7, 0.26); fl.rotation.x = -Math.PI / 2; fl.position.z = -0.85; m.add(fl);
    m.visible = false; scene.add(m); H.missiles.push({ active: false, mesh: m, x: 0, y: 0, z: 0, dx: 0, dy: 1, dz: 0 }); }
};

H.reset = function () {
  var i; for (i = 0; i < grenades.length; i++) { grenades[i].active = false; grenades[i].mesh.visible = false; }
  for (i = 0; i < waves.length; i++) { if (waves[i].ring) FX.ringFree(waves[i].ring); waves[i].active = false; waves[i].ring = null; }
  for (i = 0; i < clouds.length; i++) { clouds[i].active = false; clouds[i].mesh.visible = false; }
  for (i = 0; i < H.missiles.length; i++) { H.missiles[i].active = false; H.missiles[i].mesh.visible = false; }
};

// radial blast against the player; solid cover between blast and player soaks most of it
H.explode = function (x, y, z, radius, dmg) {
  FX.explosion(x, y, z, radius); JO.Events.emit('blast', x, z, radius, dmg, 'enemy');
  var P = JO.Player, px = P.pos.x - x, py = P.pos.y + 0.9 - y, pz = P.pos.z - z, d = Math.sqrt(px * px + py * py + pz * pz);
  if (d >= radius || dmg <= 0) return;
  var amt = dmg * (1 - 0.6 * d / radius);
  if (d > 0.5) { var oy = Math.max(y, 0.2) + 0.4, qy = P.pos.y + 1.0 - oy, l = Math.sqrt(px * px + qy * qy + pz * pz);
    if (W.raycast(x, oy, z, px / l, qy / l, pz / l, l) < l - 0.05) amt *= 0.3; }
  P.damage(amt, x, z, 'blast');
};

function freeG() { for (var i = 0; i < grenades.length; i++) if (!grenades[i].active) return grenades[i]; return null; }
H.grenade = function (x, y, z, tx, tz, flight, fuse, radius, dmg) {
  var g = freeG(); if (!g) return; g.active = true; g.kind = 0; g.x = x; g.y = y; g.z = z; g.t = 0; g.fuse = fuse; g.r = radius; g.dmg = dmg; g.landed = false;
  g.vx = (tx - x) / flight; g.vz = (tz - z) / flight; g.vy = (0.15 - y + 0.5 * GRAV * flight * flight) / flight;
  g.mesh.visible = true; g.mesh.position.set(x, y, z); FX.marker(tx, tz, radius, fuse, 0xff3020);
};
H.mortar = function (tx, tz, delay, radius, dmg) {
  var g = freeG(); if (!g) return; g.active = true; g.kind = 1; g.x = tx; g.y = 34; g.z = tz; g.t = 0; g.fuse = delay; g.r = radius; g.dmg = dmg;
  g.mesh.visible = false; FX.marker(tx, tz, radius, delay, 0xff7a10);
};
H.shockwave = function (x, z, speed, maxR, dmg, hex) {
  for (var i = 0; i < waves.length; i++) { var w = waves[i]; if (w.active) continue;
    w.ring = FX.waveAlloc(hex); if (!w.ring) return; w.active = true; w.x = x; w.z = z; w.r = 1.5; w.speed = speed; w.maxR = maxR; w.dmg = dmg; w.hit = false; return; }
};
// used by the playtest bot and nothing else
H.waveNear = function () {
  var P = JO.Player;
  for (var i = 0; i < waves.length; i++) { var w = waves[i]; if (!w.active || w.hit) continue;
    var d = Math.hypot(P.pos.x - w.x, P.pos.z - w.z) - w.r; if (d > -0.5 && d < w.speed * 0.2) return true; }
  return false;
};
H.gas = function (x, z, radius, dur, dps) {
  var c = null, old = null; for (var i = 0; i < clouds.length; i++) { if (!clouds[i].active) { c = clouds[i]; break; } if (!old || clouds[i].t > old.t) old = clouds[i]; }
  c = c || old; c.active = true; c.x = x; c.z = z; c.r = radius; c.t = 0; c.dur = dur; c.dps = dps; c.tick = 0.6;
  c.mesh.position.set(x, 0, z); c.mesh.visible = true; A.playAt('gas', x, z);
};
H.missile = function (x, y, z, dx, dy, dz, speed, turn, dmg) {
  for (var i = 0; i < H.missiles.length; i++) { var m = H.missiles[i]; if (m.active) continue;
    m.active = true; m.x = x; m.y = y; m.z = z; m.dx = dx; m.dy = dy; m.dz = dz; m.speed = speed; m.turn = turn; m.dmg = dmg; m.t = 0; m.life = 7; m.smoke = 0;
    m.mesh.visible = true; m.mesh.position.set(x, y, z); A.playAt('missile', x, z); return m; }
  return null;
};
H.shootMissile = function (m) {
  if (!m.active) return; m.active = false; m.mesh.visible = false; FX.explosion(m.x, m.y, m.z, 1.6);
  JO.UI.dmgNum(m.x, m.y + 0.4, m.z, 'INTERCEPT', 'head');
};

H.update = function (dt) {
  var P = JO.Player, i, d;
  for (i = 0; i < grenades.length; i++) { var g = grenades[i]; if (!g.active) continue;
    g.t += dt;
    if (g.kind === 0) {
      if (!g.landed) { g.vy -= GRAV * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt; g.mesh.rotation.x += dt * 9;
        if (g.y <= 0.17 && g.vy < 0) { g.y = 0.17; g.landed = true; A.playAt('step', g.x, g.z, 2); } }
      g.mesh.position.set(g.x, g.y, g.z); g.light.visible = Math.sin(g.t * (8 + g.t * 14)) > 0;
    } else { var left = g.fuse - g.t; if (left < 0.5) { g.mesh.visible = true; g.mesh.position.set(g.x, Math.max(0.2, 34 * left / 0.5), g.z); } }
    if (g.t >= g.fuse) { g.active = false; g.mesh.visible = false; H.explode(g.x, 0.3, g.z, g.r, g.dmg); }
  }
  for (i = 0; i < waves.length; i++) { var w = waves[i]; if (!w.active) continue;
    w.r += w.speed * dt; if (w.r >= w.maxR) { w.active = false; FX.ringFree(w.ring); w.ring = null; continue; }
    FX.waveSet(w.ring, w.x, w.z, w.r, 1 - w.r / w.maxR * 0.7);
    if (!w.hit) { d = Math.hypot(P.pos.x - w.x, P.pos.z - w.z);
      if (Math.abs(d - w.r) < 0.7) { if (P.pos.y >= 0.5 || P.invuln > 0) { if (d < w.r) w.hit = true; } else { P.damage(w.dmg, w.x, w.z, 'shockwave'); w.hit = true; } } }
  }
  for (i = 0; i < clouds.length; i++) { var c = clouds[i]; if (!c.active) continue;
    c.t += dt; if (c.t >= c.dur) { c.active = false; c.mesh.visible = false; continue; }
    var grow = Math.min(1, c.t * 2.5), fade = Math.min(1, (c.dur - c.t) * 1.5), s = c.r * grow;
    c.mesh.scale.set(s, 1.2 + Math.sin(c.t * 2) * 0.15, s); c.mesh.rotation.y += dt * 0.5; c.mat.opacity = 0.34 * fade;
    if (grow >= 1 && Math.hypot(P.pos.x - c.x, P.pos.z - c.z) < c.r * 0.95 && P.pos.y < 2.2) { c.tick -= dt; if (c.tick <= 0) { c.tick = 0.5; P.damage(c.dps * 0.5, c.x, c.z, 'gas'); } }
  }
  for (i = 0; i < H.missiles.length; i++) { var m = H.missiles[i]; if (!m.active) continue;
    m.t += dt; m.life -= dt;
    if (m.t > 0.5) { var tx = P.pos.x - m.x, ty = P.pos.y + 1.0 - m.y, tz = P.pos.z - m.z, l = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1, k = Math.min(1, m.turn * dt);
      m.dx += (tx / l - m.dx) * k; m.dy += (ty / l - m.dy) * k; m.dz += (tz / l - m.dz) * k;
      l = Math.sqrt(m.dx * m.dx + m.dy * m.dy + m.dz * m.dz) || 1; m.dx /= l; m.dy /= l; m.dz /= l; }
    var step = m.speed * dt, t = W.raycast(m.x, m.y, m.z, m.dx, m.dy, m.dz, step);
    m.x += m.dx * step; m.y += m.dy * step; m.z += m.dz * step;
    m.mesh.position.set(m.x, m.y, m.z); m.mesh.lookAt(m.x + m.dx, m.y + m.dy, m.z + m.dz);
    m.smoke -= dt; if (m.smoke <= 0) { m.smoke = 0.05; FX.puff(m.x - m.dx * 0.8, m.y - m.dy * 0.8, m.z - m.dz * 0.8, 0xbbbbbb, 0.3); }
    d = Math.hypot(P.pos.x - m.x, P.pos.y + 1.0 - m.y, P.pos.z - m.z);
    if (t < step || d < 1.25 || m.life <= 0) { m.active = false; m.mesh.visible = false; H.explode(m.x, Math.max(0.3, m.y), m.z, 3.2, m.dmg); }
  }
};
})();
