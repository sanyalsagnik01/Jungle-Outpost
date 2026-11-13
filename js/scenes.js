/* ============================================================
   JUNGLE OUTPOST — scenes.js
   The story you find instead of the story you are told.
     - scenes: three small set pieces per level (a cold camp,
       fresh graves, Mira's bench...) built from story.json.
       Walk up and press E to look closer: a card describes
       what is there and Kade or Juno says what it means.
       Found scenes are kept in the profile.
     - Juno reacts to how you play: lamps shot out, men spared
       or not, bodies found, weather turning, the birds going
       quiet (all "react:*" lines in story.json)
     - minimal HUD (Settings, or H): panels stay hidden until
       there is something to tell you
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, W = JO.World, Q = JO.Q, Ev = JO.Events, A = JO.Audio;
var Sc = JO.Scenes = { list: [], near: null, found: 0, reacts: 0, last: '' };
var D = window.JO_STORY || {}, card = null, cardT = 0, lvl = 0, glowMat = null;
function lam(c, e) { var m = new THREE.MeshLambertMaterial({ color: c, emissive: e || 0 }); W.owned.push(m); return m; }
function mesh(parts, mat, grp) { var g = Q.merge(parts); W.owned.push(g); var m = new THREE.Mesh(g, mat); m.castShadow = true; grp.add(m); return m; }
var B = Q.box;
function cyl(r, h, x, y, z, seg) { var g = new THREE.CylinderGeometry(r, r, h, seg || 7); g.translate(x, y, z); return g; }
function cone(r, h, x, y, z, seg) { var g = new THREE.ConeGeometry(r, h, seg || 4); g.rotateY(Math.PI / 4); g.translate(x, y, z); return g; }

// each kind returns nothing; it adds meshes to grp. Colours lean on the level palette.
var BUILD = {
  camp: function (g) { mesh([cone(1.5, 1.7, -0.6, 0.85, -0.6)], lam(0x6a6a48), g); mesh([B(0.6, 0.12, 1.7, 1.1, 0.07, 0.2, 0.2), B(0.55, 0.22, 0.4, 0.2, 0.12, 1.3)], lam(0x4a5a6a), g);
    mesh([cyl(0.5, 0.1, 1, 0.05, -1.1), B(0.5, 0.1, 0.1, 1, 0.14, -1.1, 0.5), B(0.5, 0.1, 0.1, 1, 0.14, -1.1, -0.6)], lam(0x2a2622), g); },
  graves: function (g) { var st = [], hm = [], mo = []; for (var i = -1; i <= 1; i++) { st.push(B(0.08, 1.1, 0.08, i * 1.1, 0.55, 0)); hm.push(cyl(0.2, 0.16, i * 1.1, 1.14, 0, 8)); mo.push(B(0.8, 0.18, 1.6, i * 1.1, 0.09, 0.9)); }
    mesh(st, lam(0x5a4026), g); mesh(hm, lam(0x3d4a26), g); mesh(mo, lam(0x4a3a28), g); },
  flags: function (g) { var po = [], fl = []; for (var i = 0; i < 5; i++) { po.push(B(0.04, 0.9, 0.04, -1.6 + i * 0.8, 0.45, 0)); fl.push(B(0.3, 0.2, 0.02, -1.45 + i * 0.8, 0.78, 0)); }
    mesh(po, lam(0xd8d8d0), g); mesh(fl, lam(0x58e0d0, 0x144a44), g); mesh([B(0.3, 0.05, 0.4, 1.9, 0.03, 0.4, 0.4)], lam(0xe9e4cf), g); },
  shrine: function (g) { mesh([B(1.6, 0.3, 1.1, 0, 0.15, 0), B(0.5, 1.2, 0.5, 0, 0.9, -0.2), B(0.8, 0.2, 0.7, 0, 1.6, -0.2)], lam(0x7c8a8a), g); mesh([cyl(0.22, 0.1, 0, 0.36, 0.3, 8)], lam(0x8a6a3a), g);
    mesh([B(0.12, 0.12, 0.12, -0.06, 0.46, 0.3), B(0.12, 0.12, 0.12, 0.08, 0.46, 0.34)], lam(0xd86a2a, 0x401800), g); },
  cots: function (g) { var c = [], l = []; for (var i = 0; i < 3; i++) { c.push(B(0.8, 0.1, 1.9, -1.7 + i * 1.7, 0.4, 0)); l.push(B(0.06, 0.4, 0.06, -2 + i * 1.7, 0.2, -0.8), B(0.06, 0.4, 0.06, -1.4 + i * 1.7, 0.2, 0.8)); }
    mesh(c, lam(0x9a9a88), g); mesh(l, lam(0x3a3a34), g); mesh([B(5.4, 0.06, 2.6, 0, 2.1, 0), B(0.08, 2.1, 0.08, -2.6, 1.05, -1.2), B(0.08, 2.1, 0.08, 2.6, 1.05, -1.2), B(0.08, 2.1, 0.08, -2.6, 1.05, 1.2), B(0.08, 2.1, 0.08, 2.6, 1.05, 1.2)], lam(0x4a5a48), g);
    mesh([cyl(0.09, 0.2, -1.2, 0.56, -0.7, 6), cyl(0.09, 0.2, 0.5, 0.56, -0.7, 6)], lam(0x58e0d0, 0x2a9088), g); },
  drop: function (g) { mesh([B(1.1, 1.1, 1.1, 0, 0.35, 0, 0.3), B(0.9, 0.9, 0.9, 1.3, 0.2, 0.5, -0.4), B(0.8, 0.8, 0.8, -1.1, 0.15, 0.7, 0.9)], lam(0x7a5a36), g); mesh([B(1.6, 0.03, 1.2, 0.3, 0.04, 0.4)], lam(0x3a342a), g);
    mesh([B(0.7, 0.3, 0.02, 0.17, 0.5, 0.57, 0.3)], lam(0x1a1a1a), g); },
  bench: function (g) { mesh([B(2.2, 0.1, 0.9, 0, 0.9, 0), B(0.1, 0.9, 0.1, -1, 0.45, -0.35), B(0.1, 0.9, 0.1, 1, 0.45, -0.35), B(0.1, 0.9, 0.1, -1, 0.45, 0.35), B(0.1, 0.9, 0.1, 1, 0.45, 0.35)], lam(0x5a4a3a), g);
    var j = []; for (var i = 0; i < 4; i++) j.push(cyl(0.09, 0.24, -0.7 + i * 0.45, 1.07, 0, 6)); mesh(j, lam(0x58e0d0, 0x2aa094), g); mesh([B(0.4, 0.04, 0.3, 0.85, 0.97, 0.2, 0.2)], lam(0xe9e4cf), g); },
  wall: function (g) { mesh([B(3.2, 2.2, 0.4, 0, 1.1, 0)], lam(0x6b6660), g); var t = []; for (var i = 0; i < 18; i++) t.push(B(0.03, 0.16, 0.02, -1.3 + (i % 9) * 0.3, 1.5 - Math.floor(i / 9) * 0.3, 0.21)); mesh(t, lam(0xe9e4cf, 0x303028), g); mesh([B(1.2, 0.03, 0.02, -0.2, 0.75, 0.21)], lam(0xe9e4cf, 0x303028), g); },
  radio: function (g) { mesh([B(1.1, 0.7, 0.5, 0, 1.0, 0), B(1.5, 0.08, 0.8, 0, 0.62, 0), B(0.08, 0.6, 0.08, -0.65, 0.3, 0), B(0.08, 0.6, 0.08, 0.65, 0.3, 0)], lam(0x3a4034), g); mesh([B(0.5, 0.5, 0.06, 0.1, 1.0, 0.26, 0.5)], lam(0x101010), g);
    mesh([cyl(0.22, 0.08, 0.9, 0.05, 0.5, 10)], lam(0x1a1a1a), g); mesh([B(0.06, 0.06, 0.7, -0.4, 1.4, 0.2, 0.9), B(0.08, 0.5, 0.08, -0.5, 0.25, 0.6, 0)], lam(0x6a5a40), g); }
};
function clearSpot(x, z) { var cs = W.colliders; for (var i = 0; i < cs.length; i++) { var c = cs[i]; if (x > c.minx - 2.2 && x < c.maxx + 2.2 && z > c.minz - 2.2 && z < c.maxz + 2.2) return false; } return !W.inWater(x, z); }
function place(L) {
  Sc.list.length = 0; Sc.near = null; var idx = JO.CFG.LEVELS.indexOf(L), all = (D.scenes || []).filter(function (s) { return s.level === idx; }), seen = JO.Save.profile.seen;
  if (!W.group || idx < 0) return;
  glowMat = new THREE.MeshBasicMaterial({ color: 0x58e0d0, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }); W.owned.push(glowMat);
  all.forEach(function (s) { var x = s.x, z = s.z, tries = 0; while (!clearSpot(x, z) && tries++ < 10) z -= 2.4; if (!clearSpot(x, z) || !BUILD[s.kind]) return;
    var g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = x > 0 ? -0.5 : 0.5; BUILD[s.kind](g);
    var ring = new THREE.Mesh(W.G.disc, glowMat); ring.scale.set(2.6, 1, 2.6); ring.position.y = 0.05; g.add(ring); W.group.add(g);
    Sc.list.push({ def: s, x: x, z: z, g: g, ring: ring, seen: !!seen['scene_' + s.id] }); });
}
function showCard(def, n, total) {
  if (!card) return; card.querySelector('b').textContent = def.title; card.querySelector('p').textContent = def.text; card.querySelector('small').textContent = 'SCENE ' + n + ' OF ' + total + ' IN THIS LEVEL';
  card.classList.remove('hidden'); cardT = 6 + def.text.length * 0.05;
}
Sc.inspect = function (s) {
  var P = JO.Save.profile, first = !s.seen; s.seen = true; P.seen['scene_' + s.def.id] = 1; JO.Save.save(); Sc.found++;
  var n = Sc.list.filter(function (o) { return o.seen; }).length; showCard(s.def, n, Sc.list.length); A.play('pickup', 0.7);
  if (first && JO.Perks && JO.Perks.addSalvage) JO.Perks.addSalvage(6, s.x, 1.8, s.z);
  if (JO.Story) JO.Story.trigger('scene:' + s.def.id); Ev.emit('scene', s.def.id, first);
};

/* ---------- Juno reacts ---------- */
function react(name) { if (!JO.Story || JO.Game.state !== 'playing' || JO.Game.bossFight) return false; var ok = JO.Story.trigger('react:' + name); if (ok) { Sc.reacts++; Sc.last = name; } return ok; }
Sc.react = react;
var silentKills = 0, firstShot = false;
function wireReacts() {
  Ev.on('lamp_out', function () { react('lamp_out'); });
  Ev.on('surrender', function () { react('surrender'); });
  Ev.on('surrender_spared', function () { react('spared'); });
  Ev.on('surrender_killed', function () { react('executed'); });
  Ev.on('body_found', function () { react('body_found'); });
  Ev.on('weather', function (s) { if (s === 'storm') react('storm'); else if (s === 'rain') react('rain'); });
  Ev.on('flashlight', function (on) { if (on && JO.Squad && JO.Squad.dark() > 0.6 && JO.Stealth.near) react('torch'); });
  Ev.on('overheat', function () { react('overheat'); });
  Ev.on('traverse', function () { react('vault'); });
  Ev.on('near_whiz', function () { if (Math.random() < 0.3) react('whiz'); });
  Ev.on('wildlife', function (kind, x, z) { var P = JO.Player; if (kind === 'birds' && JO.Stealth.near && JO.Stealth.spottedT <= 0 && !firstShot && Math.hypot(x - P.pos.x, z - P.pos.z) < 9) react('birds'); });
  Ev.on('noise', function (x, z, r, kind) { if (kind === 'shot' && !firstShot && (r || 0) > 20) { firstShot = true; setTimeout(function () { react('quiet'); }, 2500); } });
  Ev.on('takedown', function () { silentKills++; if (silentKills === 3) react('ghost'); });
  Ev.on('spotted', function () { silentKills = 0; });
  Ev.on('level_load', function (i) { lvl = i; silentKills = 0; firstShot = false; });
}

/* ---------- minimal HUD ---------- */
var hudT = 0, need = { hudTL: 0, hudBL: 0, hudBR: 0 }, els = null, lastObj = '', lastAmmo = '', lastHp = 0;
function show(id, sec) { if (need[id] < sec) need[id] = sec; }
function hudFrame(real) {
  var on = Q.on('diegetic') && JO.Meta.set.diegetic === true, body = document.body; if (body.classList.contains('dieg') !== on) body.classList.toggle('dieg', on);
  if (!on) return; var G = JO.Game, P = JO.Player, Wp = JO.Weapons, s = Wp.current && Wp.current(); if (!els) els = { hudTL: document.getElementById('hudTL'), hudBL: document.getElementById('hudBL'), hudBR: document.getElementById('hudBR'), map: document.getElementById('minimap'), cmp: document.getElementById('compass') };
  if (G.objective !== lastObj) { lastObj = G.objective; show('hudTL', 6); }
  if (P.hp < P.maxHp - 0.5 || P.hp !== lastHp || P.stamina < 60) show('hudBL', 3); lastHp = P.hp;
  if (s) { var a = Wp.cur + ':' + s.mag; if (a !== lastAmmo || Wp.reloading > 0 || s.mag <= Wp.magSize(Wp.cur) * 0.25 || JO.Input.ads) show('hudBR', 3.5); lastAmmo = a; }
  var hot = JO.Stealth.spottedT > 0 || G.bossFight || (JO.Audio.combat || 0) > 0.2;
  for (var k in need) { if (need[k] > 0) need[k] -= real; els[k].classList.toggle('need', need[k] > 0); }
  els.map.classList.toggle('need', hot || JO.Stealth.meter > 0.3); els.cmp.classList.toggle('need', hot || need.hudTL > 0);
}

JO.Sys.add('scenes', {
  init: function () {
    card = document.getElementById('sceneCard'); wireReacts();
    window.addEventListener('keydown', function (e) { if (e.code === 'KeyH' && !e.repeat && JO.Game.state === 'playing') { var s = JO.Meta.set; s.diegetic = !s.diegetic; JO.Save.save(); JO.UI.toast('HUD', s.diegetic ? 'Minimal: panels appear when needed (H)' : 'Full (H)', '#58e0d0'); } });
    Ev.on('checkpoint', function () { show('hudTL', 6); show('hudBL', 4); }); Ev.on('level_start', function () { show('hudTL', 8); show('hudBL', 5); show('hudBR', 5); });
    Ev.on('level_load', function () { if (card) card.classList.add('hidden'); cardT = 0; });
  },
  level: function (L) { place(L); },
  step: function (dt) {
    var P = JO.Player, G = JO.Game, I = JO.Input, best = null, bd = 3.1;
    if (G.state !== 'playing' || P.dead || P.driving) { Sc.near = null; return; }
    for (var i = 0; i < Sc.list.length; i++) { var s = Sc.list[i], dd = Math.hypot(s.x - P.pos.x, s.z - P.pos.z); if (dd < bd) { bd = dd; best = s; } }
    Sc.near = best; if (!best || G.bossFight || (A.combat || 0) > 0.3) return;
    if (!G.hint && !P.nearCrate) G.hint = I.isTouch ? 'TAP <kbd>USE</kbd> — LOOK CLOSER' : 'PRESS <kbd>E</kbd> — LOOK CLOSER';
    if (I.interactPressed && !P.nearCrate) Sc.inspect(best);
  },
  frame: function (dt, real) {
    var t = W.time; for (var i = 0; i < Sc.list.length; i++) { var s = Sc.list[i]; s.ring.visible = !s.seen; if (!s.seen) { var k = 2.4 + Math.sin(t * 2 + i) * 0.25; s.ring.scale.set(k, 1, k); } }
    if (cardT > 0) { cardT -= real; if (cardT <= 0 || (Sc.near === null && cardT < 4)) { card.classList.add('hidden'); cardT = 0; } }
    hudFrame(real);
  }
});
})();
