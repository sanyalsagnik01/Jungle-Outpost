/* ============================================================
   JUNGLE OUTPOST — arsenal.js
   The player's thrown and area weapons: frag grenades, smoke
   grenades (which block enemy line of sight), the flamethrower
   cone and the burning it leaves behind, plus the shared
   "hurt everything in this radius" used by explosive bolts and
   exploding barrels. Everything is pooled.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, CFG = JO.CFG, W = JO.World, FX = JO.FX, A = JO.Audio, E = JO.Enemies, Ev = JO.Events, Pk = JO.Perks, G = W.G;
var NC = CFG.GRENADE, GRAV = 18;
var Ar = JO.Arsenal = { nades: [], clouds: [], count: { frag: 0, smoke: 0 }, cd: 0, flameN: 0 };
var scene = null;

Ar.cap = function (k) { return NC[k].max + (k === 'frag' ? (Pk.has('a3') ? 1 : 0) : (Pk.has('s3') ? 1 : 0)); };
Ar.blastK = function () { return Pk.has('a3') ? 1.25 : 1; };

Ar.init = function (sc) {
  scene = sc; var i, k;
  var mf = new THREE.MeshLambertMaterial({ color: 0x3d4a26 }), ms = new THREE.MeshLambertMaterial({ color: 0x8a8f90 }), ml = new THREE.MeshBasicMaterial({ color: 0xffb62e });
  for (i = 0; i < 6; i++) { var g = new THREE.Group(), body = new THREE.Mesh(G.ico0, mf); body.scale.setScalar(0.2); g.add(body);
    var pin = new THREE.Mesh(G.box, ml); pin.scale.set(0.07, 0.07, 0.07); pin.position.y = 0.2; g.add(pin); g.visible = false; scene.add(g);
    Ar.nades.push({ active: false, g: g, body: body, mf: mf, ms: ms, glb: {}, kind: 'frag', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0, rest: false }); }
  for (i = 0; i < 4; i++) { var cm = new THREE.MeshBasicMaterial({ color: 0xb9bdb6, transparent: true, opacity: 0.5, depthWrite: false }), cg = new THREE.Group();
    for (k = 0; k < 9; k++) { var p = new THREE.Mesh(G.ico0, cm), a = k / 8 * 6.283, r = k === 8 ? 0 : 0.55;
      p.position.set(Math.cos(a) * r, 0.34 + (k % 3) * 0.2, Math.sin(a) * r); p.scale.set(0.62, 0.5, 0.62); cg.add(p); }
    cg.visible = false; scene.add(cg); Ar.clouds.push({ active: false, g: cg, mat: cm, x: 0, z: 0, r: 1, t: 0, dur: 1 }); }
  Ev.on('level_load', Ar.reset); Ev.on('retry', Ar.reset);
  Ev.on('checkpoint', function () { Ar.give('frag', 1); Ar.give('smoke', 1); });
};
Ar.resetRun = function () { Ar.count.frag = NC.frag.start; Ar.count.smoke = NC.smoke.start; };
Ar.reset = function () {
  var i; for (i = 0; i < Ar.nades.length; i++) { Ar.nades[i].active = false; Ar.nades[i].g.visible = false; }
  for (i = 0; i < Ar.clouds.length; i++) { Ar.clouds[i].active = false; Ar.clouds[i].g.visible = false; }
  Ar.cd = 0;
};
Ar.snapshot = function () { return { frag: Ar.count.frag, smoke: Ar.count.smoke }; };
Ar.restore = function (s) { if (!s) return; Ar.count.frag = Math.min(Ar.cap('frag'), s.frag | 0); Ar.count.smoke = Math.min(Ar.cap('smoke'), s.smoke | 0); };
Ar.give = function (kind, n) { var c = Ar.cap(kind); if (Ar.count[kind] >= c) return false; Ar.count[kind] = Math.min(c, Ar.count[kind] + (n || 1)); return true; };

/* ---------- throwing ---------- */
// swap the placeholder for the GLB the first time each kind is thrown (models load after init)
function dress(n, kind) {
  var name = kind === 'frag' ? 'frag_grenade' : 'smoke_grenade', m = n.glb[name];
  if (m === undefined) { m = n.glb[name] = JO.Assets.instantiate(name) || null; if (m) { m.root.scale.setScalar(1.6); n.g.add(m.root); } }
  for (var k in n.glb) if (n.glb[k]) n.glb[k].root.visible = k === name;
  n.body.visible = !m; n.g.children[1].visible = !m; n.body.material = kind === 'frag' ? n.mf : n.ms;
}
Ar.throwNade = function (kind) {
  var P = JO.Player, Cam = JO.Cam, n = null, i;
  if (P.dead || Ar.cd > 0) return false;
  if (Ar.count[kind] <= 0) { A.play('empty'); return false; }
  for (i = 0; i < Ar.nades.length; i++) if (!Ar.nades[i].active) { n = Ar.nades[i]; break; }
  if (!n) return false;
  Ar.count[kind]--; Ar.cd = 0.6;
  var sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
  n.active = true; n.kind = kind; n.t = 0; n.rest = false; n.x = P.pos.x - cy * 0.3 + sy * 0.5; n.y = P.pos.y + 1.5; n.z = P.pos.z + sy * 0.3 + cy * 0.5;
  n.vx = Cam.fx * NC.throwSpeed + P.vx * 0.5; n.vy = Cam.fy * NC.throwSpeed + NC.throwUp; n.vz = Cam.fz * NC.throwSpeed + P.vz * 0.5;
  dress(n, kind); n.g.visible = true; n.g.position.set(n.x, n.y, n.z);
  A.play('throw'); if (P.gfx) P.gfx.playOnce('attack'); Ev.emit('throw', kind);
  return true;
};

/* ---------- damage helpers ---------- */
// one hit on one enemy from an area source (ignores riot shields; bosses take it on their plating)
Ar.hurt = function (e, dmg) {
  if (!e.alive || !e.active) return 0;
  var part = e.parts[0], r = e.takeHit(dmg, part, 0, 0, e.pos.y, 1), dealt = r.dealt;
  if (r.killed) { JO.UI.hitmarker('kill'); A.play('kill'); Ev.emit('player_kill', false); }
  return dealt;
};
// radial blast against enemies (and optionally the thrower). Cover between blast and target soaks most of it.
Ar.blast = function (x, y, z, radius, dmg, selfK) {
  var L = E.list, i, P = JO.Player; radius *= Ar.blastK();
  FX.explosion(x, y, z, radius); Ev.emit('blast', x, z, radius, dmg); Ev.emit('noise', x, z, 46);
  for (i = L.length - 1; i >= 0; i--) { var e = L[i]; if (!e || !e.alive || !e.active) continue;
    var ex = e.pos.x - x, ey = e.pos.y + (e.boundY || 1) - y, ez = e.pos.z - z, d = Math.sqrt(ex * ex + ey * ey + ez * ez), reach = radius + (e.isBoss ? (e.radius || 1.2) : 0);
    if (d >= reach) continue;
    var amt = dmg * (1 - 0.65 * d / reach);
    if (d > 0.8) { var oy = Math.max(y, 0.2) + 0.4, qy = e.pos.y + (e.boundY || 1) - oy, l = Math.sqrt(ex * ex + qy * qy + ez * ez) || 1;
      if (W.raycast(x, oy, z, ex / l, qy / l, ez / l, l) < l - (e.isBoss ? 3 : 0.6)) amt *= 0.3; }
    var dealt = Ar.hurt(e, amt); if (dealt > 0) JO.UI.dmgNum(e.pos.x, e.pos.y + 2, e.pos.z, '' + Math.round(dealt), 'crit');
  }
  if (selfK) { var px = P.pos.x - x, py = P.pos.y + 0.9 - y, pz = P.pos.z - z, pd = Math.sqrt(px * px + py * py + pz * pz);
    if (pd < radius) P.damage(dmg * selfK * (1 - 0.6 * pd / radius), x, z, 'own blast'); }
};
Ar.smoke = function (x, z) {
  var c = null, old = null, i; for (i = 0; i < Ar.clouds.length; i++) { if (!Ar.clouds[i].active) { c = Ar.clouds[i]; break; } if (!old || Ar.clouds[i].t > old.t) old = Ar.clouds[i]; }
  c = c || old; c.active = true; c.x = x; c.z = z; c.r = NC.smoke.radius; c.t = 0; c.dur = NC.smoke.dur * (Pk.has('s3') ? 1.5 : 1);
  c.g.position.set(x, 0, z); c.g.scale.set(0.1, 0.1, 0.1); c.g.visible = true; A.playAt('gas', x, z); Ev.emit('smoke', x, z, c.r);
  return c;
};
// does a smoke cloud sit on the segment between two ground points? (enemy line of sight)
Ar.blocked = function (x0, z0, x1, z1) {
  for (var i = 0; i < Ar.clouds.length; i++) { var c = Ar.clouds[i]; if (!c.active || c.t < 0.5 || c.t > c.dur - 0.8) continue;
    var dx = x1 - x0, dz = z1 - z0, l2 = dx * dx + dz * dz, t = l2 > 1e-6 ? ((c.x - x0) * dx + (c.z - z0) * dz) / l2 : 0;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    var qx = x0 + dx * t - c.x, qz = z0 + dz * t - c.z, rr = c.r * 0.9; if (qx * qx + qz * qz < rr * rr) return true; }
  return false;
};
Ar.inSmoke = function (x, z) { return Ar.blocked(x, z, x, z); };

/* ---------- flamethrower: called once per fuel tick by the weapon code ---------- */
Ar.flame = function (c, mx, my, mz) {
  var Cam = JO.Cam, P = JO.Player, L = E.list, i, hit = false, show = (++Ar.flameN % 4) === 0;
  var ox = P.pos.x, oy = P.pos.y + 1.35, oz = P.pos.z, wall = W.raycast(mx, my, mz, Cam.fx, Cam.fy, Cam.fz, c.range);
  for (i = 0; i < 3; i++) { var d = Math.min(wall, 1 + Math.random() * (c.range - 1));
    FX.burst(mx + Cam.fx * d, my + Cam.fy * d, mz + Cam.fz * d, 1, i ? 0xff7a18 : 0xffd24a, 1.6 + d * 0.25, 0.32, -3, 0.3 + d * 0.06, 0.4); }
  for (i = L.length - 1; i >= 0; i--) { var e = L[i]; if (!e || !e.alive || !e.active) continue;
    var ex = e.pos.x - ox, ey = e.pos.y + (e.boundY || 1) - oy, ez = e.pos.z - oz, dd = Math.sqrt(ex * ex + ey * ey + ez * ez) || 0.01, rad = e.isBoss ? (e.radius || 1.2) : 0.5;
    if (dd > c.range + rad) continue;
    var dot = (ex * Cam.fx + ey * Cam.fy + ez * Cam.fz) / dd, lim = Math.cos(c.cone + Math.atan2(rad, dd));
    if (dot < lim) continue;
    if (W.raycast(ox, oy, oz, ex / dd, ey / dd, ez / dd, dd) < dd - rad - 0.3) continue;
    e.burnT = NC.burn; e.burnTick = e.burnTick > 0 ? e.burnTick : 0.4;
    var dealt = Ar.hurt(e, c.dmg * Pk.damage(c, e)); hit = hit || dealt > 0;
    if (dealt > 0 && show) JO.UI.dmgNum(e.pos.x, e.pos.y + 1.9, e.pos.z, '' + Math.round(dealt * 4), '');
  }
  return hit;
};

/* ---------- per logic step ---------- */
Ar.update = function (dt) {
  var I = JO.Input, i, L = E.list;
  if (Ar.cd > 0) Ar.cd -= dt;
  if (I.nadePressed) Ar.throwNade('frag'); else if (I.smokePressed) Ar.throwNade('smoke');
  for (i = 0; i < Ar.nades.length; i++) { var n = Ar.nades[i]; if (!n.active) continue;
    n.t += dt;
    if (!n.rest) {
      n.vy -= GRAV * dt;
      var sp = Math.sqrt(n.vx * n.vx + n.vy * n.vy + n.vz * n.vz) || 1, dist = sp * dt, t = W.raycast(n.x, n.y, n.z, n.vx / sp, n.vy / sp, n.vz / sp, dist + 0.15);
      if (t < dist + 0.15 && n.y > 0.3) { n.vx *= -0.3; n.vz *= -0.3; n.vy *= 0.4; A.playAt('step', n.x, n.z, 1.5); }       // wall or cover: drop back
      else { n.x += n.vx * dt; n.y += n.vy * dt; n.z += n.vz * dt; }
      if (n.y <= 0.16) { n.y = 0.16; if (Math.abs(n.vy) > 2.5) { n.vy = -n.vy * 0.32; n.vx *= 0.55; n.vz *= 0.55; A.playAt('step', n.x, n.z, 1.6); } else { n.vy = 0; n.vx = n.vz = 0; n.rest = true; } }
      n.g.rotation.x += dt * 9; n.g.rotation.z += dt * 5;
    }
    n.g.position.set(n.x, n.y, n.z);
    if (n.kind === 'frag' ? n.t >= NC.frag.fuse : (n.rest || n.t > 1.4)) { n.active = false; n.g.visible = false;
      if (n.kind === 'frag') Ar.blast(n.x, Math.max(0.3, n.y), n.z, NC.frag.radius, NC.frag.dmg, NC.frag.self); else Ar.smoke(n.x, n.z); }
  }
  for (i = 0; i < Ar.clouds.length; i++) { var c = Ar.clouds[i]; if (!c.active) continue;
    c.t += dt; if (c.t >= c.dur) { c.active = false; c.g.visible = false; continue; }
    var grow = Math.min(1, c.t * 1.8), fade = Math.min(1, (c.dur - c.t) * 0.9), s = c.r * grow * 1.15;
    c.g.scale.set(s, s * 0.8, s); c.g.rotation.y += dt * 0.25; c.mat.opacity = 0.55 * fade; }
  // burning enemies keep taking damage for a few seconds
  for (i = L.length - 1; i >= 0; i--) { var e = L[i]; if (!e || !(e.burnT > 0)) continue;
    if (!e.alive) { e.burnT = 0; continue; }
    e.burnT -= dt; e.burnTick -= dt; e.tint = 0x802000;
    if (e.burnTick <= 0) { e.burnTick = 0.4; FX.burst(e.pos.x, e.pos.y + 1.1, e.pos.z, 2, 0xff7a18, 1.2, 0.4, -3, 0.26, 0.6); Ar.hurt(e, NC.burnDps * 0.4); } }
};
})();
