/* ============================================================
   JUNGLE OUTPOST — models.js
   Characters built from primitives. Every model owns its
   materials (so it can flash / fade individually) and shares
   geometry.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, G = JO.World.G;
var M = JO.Models = {};

function lam(c) { return new THREE.MeshLambertMaterial({ color: c }); }
M.lam = lam;
M.part = function (geo, mat, w, h, d, x, y, z, parent) {
  var m = new THREE.Mesh(geo, mat); m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
};
var part = M.part;

/* c: { body, skin, dark, accent, bulk } */
M.humanoid = function (c) {
  var g = new THREE.Group(); g.rotation.order = 'YXZ';
  var mats = { body: lam(c.body), skin: lam(c.skin), dark: lam(c.dark), accent: lam(c.accent) };
  var b = c.bulk || 1, o = { g: g, mats: mats, matList: [mats.body, mats.skin, mats.dark, mats.accent] };
  o.legL = new THREE.Group(); o.legL.position.set(-0.16 * b, 0.84, 0); g.add(o.legL); part(G.box, mats.dark, 0.23 * b, 0.84, 0.27, 0, -0.42, 0, o.legL);
  o.legR = new THREE.Group(); o.legR.position.set(0.16 * b, 0.84, 0); g.add(o.legR); part(G.box, mats.dark, 0.23 * b, 0.84, 0.27, 0, -0.42, 0, o.legR);
  o.torso = part(G.box, mats.body, 0.62 * b, 0.66, 0.36 * b, 0, 1.17, 0, g);
  part(G.box, mats.dark, 0.64 * b, 0.1, 0.38 * b, 0, 0.88, 0, g);                       // belt
  o.head = part(G.box, mats.skin, 0.34, 0.34, 0.34, 0, 1.69, 0, g);
  o.armL = new THREE.Group(); o.armL.position.set(-0.41 * b, 1.45, 0); g.add(o.armL); part(G.box, mats.body, 0.17, 0.62, 0.2, 0, -0.3, 0, o.armL);
  o.armR = new THREE.Group(); o.armR.position.set(0.41 * b, 1.45, 0); g.add(o.armR); part(G.box, mats.body, 0.17, 0.62, 0.2, 0, -0.3, 0, o.armR);
  o.gun = part(G.box, mats.dark, 0.09, 0.13, 0.95, 0.24, 1.3, 0.5, g);
  o.armR.rotation.x = -1.25; o.armL.rotation.x = -1.05; o.armL.rotation.z = -0.5;
  return o;
};
M.walk = function (o, phase, amt, freeArms) {
  var s = Math.sin(phase) * 0.75 * amt; o.legL.rotation.x = s; o.legR.rotation.x = -s;
  if (freeArms) { o.armL.rotation.x = -s * 0.9; o.armR.rotation.x = s * 0.9; }
};

M.player = function () {
  var o = M.humanoid({ body: 0x3d5a2a, skin: 0xd9a676, dark: 0x23281c, accent: 0xb3261a });
  part(G.box, o.mats.accent, 0.38, 0.12, 0.38, 0, 1.9, 0, o.g);            // red beret
  part(G.box, o.mats.accent, 0.2, 0.08, 0.2, 0.1, 1.97, 0, o.g);
  part(G.box, o.mats.dark, 0.5, 0.5, 0.2, 0, 1.2, -0.27, o.g);             // pack
  return o;
};
M.rifleman = function () {
  var o = M.humanoid({ body: 0x6b7a3a, skin: 0xc49062, dark: 0x2e3320, accent: 0x4a5528 });
  part(G.box, o.mats.accent, 0.42, 0.2, 0.42, 0, 1.9, 0, o.g);             // helmet
  return o;
};
M.runner = function () {
  var o = M.humanoid({ body: 0xb5722a, skin: 0xa9744a, dark: 0x3a2a1a, accent: 0xe02a1a, bulk: 0.88 });
  part(G.box, o.mats.accent, 0.37, 0.1, 0.37, 0, 1.8, 0, o.g);             // bandana
  o.gun.visible = false; o.armL.rotation.set(0, 0, 0);
  o.blade = part(G.box, lam(0xd8dde2), 0.05, 0.1, 0.95, 0, -0.6, 0.45, o.armR); o.matList.push(o.blade.material);
  return o;
};
M.sniper = function () {
  var o = M.humanoid({ body: 0x2f4a2a, skin: 0xb98a60, dark: 0x1c2416, accent: 0x3f5a30 });
  var hood = part(G.cone, o.mats.accent, 0.62, 0.55, 0.62, 0, 1.95, -0.03, o.g); hood.rotation.y = 0.4;
  part(G.box, o.mats.accent, 0.75, 0.4, 0.2, 0, 1.3, -0.24, o.g);          // ghillie cape
  o.gun.scale.set(0.08, 0.12, 1.55); o.gun.position.z = 0.75;
  part(G.box, o.mats.dark, 0.07, 0.09, 0.3, 0.24, 1.42, 0.6, o.g);         // scope
  return o;
};
M.grenadier = function () {
  var o = M.humanoid({ body: 0x9a8454, skin: 0xc49062, dark: 0x3e3626, accent: 0x55602c, bulk: 1.28 });
  part(G.box, o.mats.accent, 0.46, 0.22, 0.46, 0, 1.9, 0, o.g);
  part(G.box, o.mats.accent, 0.7, 0.62, 0.34, 0, 1.2, -0.34, o.g);         // grenade pack
  part(G.box, o.mats.dark, 0.82, 0.12, 0.5, 0, 1.3, 0, o.g).rotation.z = 0.6;   // bandolier
  o.gun.visible = false; o.armL.rotation.set(0, 0, 0); o.armR.rotation.set(0, 0, 0);
  o.nade = part(G.ico0, o.mats.dark, 0.26, 0.26, 0.26, 0, -0.66, 0, o.armR);
  return o;
};
M.shield = function () {
  var o = M.humanoid({ body: 0x3c4658, skin: 0xb98a60, dark: 0x1e232c, accent: 0x7f8ea8, bulk: 1.15 });
  part(G.box, o.mats.dark, 0.44, 0.4, 0.44, 0, 1.72, 0, o.g);              // full helmet
  part(G.box, o.mats.accent, 0.36, 0.1, 0.06, 0, 1.74, 0.23, o.g);         // visor
  o.gun.visible = false;
  o.shieldPivot = new THREE.Group(); o.shieldPivot.position.set(-0.1, 1.08, 0.5); o.g.add(o.shieldPivot);
  o.shieldMesh = part(G.box, o.mats.accent, 1.0, 1.42, 0.09, 0, 0, 0, o.shieldPivot);
  part(G.box, o.mats.dark, 0.5, 0.12, 0.1, 0, 0.42, 0.01, o.shieldPivot);  // view slit
  part(G.box, o.mats.dark, 1.02, 0.08, 0.1, 0, -0.5, 0.01, o.shieldPivot);
  o.armL.rotation.set(-1.2, 0, 0.3); o.armR.rotation.set(-0.4, 0, 0);
  o.baton = part(G.box, o.mats.dark, 0.07, 0.07, 0.8, 0, -0.62, 0.35, o.armR);
  return o;
};
M.drone = function () {
  var g = new THREE.Group(); g.rotation.order = 'YXZ';
  var mats = { body: lam(0x4a4f57), dark: lam(0x22252a), accent: lam(0xff3020) }; mats.accent.emissive.setHex(0x991000);
  var o = { g: g, mats: mats, matList: [mats.body, mats.dark], rotors: [] };
  part(G.ico0, mats.body, 0.85, 0.42, 0.85, 0, 0, 0, g);
  part(G.box, mats.accent, 0.2, 0.14, 0.12, 0, -0.04, 0.4, g);             // eye
  part(G.box, mats.dark, 0.1, 0.1, 0.5, 0, -0.2, 0.25, g);                 // gun
  for (var i = 0; i < 4; i++) { var a = i * Math.PI / 2 + Math.PI / 4, x = Math.cos(a) * 0.62, z = Math.sin(a) * 0.62;
    part(G.box, mats.dark, 0.08, 0.06, 0.7, x * 0.5, 0.05, z * 0.5, g).rotation.y = -a + Math.PI / 2;
    var r = part(G.cyl, mats.dark, 0.62, 0.03, 0.62, x, 0.16, z, g); o.rotors.push(r); }
  return o;
};
})();
