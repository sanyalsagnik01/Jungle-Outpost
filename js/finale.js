/* ============================================================
   JUNGLE OUTPOST — finale.js
   The end of Level 3: Mira and the Lumen Bloom wait at the flag.
   She speaks, the player chooses, and one of three endings plays
   (Destroy, Preserve, or the hidden third that needs mercy:
   sparing the Phantom). Each ending has epilogue cards and a
   last word from Juno.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, W = JO.World, A = JO.Audio, Ev = JO.Events, S = JO.Save, D = window.JO_STORY || { endings: {} };
var F = JO.Finale = { active: false, asked: false, mira: null, bloom: null, halo: null, t: 0 };
var $ = function (id) { return document.getElementById(id); }, scene = null;
function remove() { [F.mira, F.bloom].forEach(function (m) { if (m) { scene.remove(m.root); if (m.dispose) m.dispose(); } }); if (F.halo) scene.remove(F.halo); F.mira = F.bloom = F.halo = null; F.active = false; F.asked = false; }
function prim(color, em, sx, sy, sz) { var g = new THREE.Group(), b = new THREE.Mesh(W.G.box, new THREE.MeshLambertMaterial({ color: color, emissive: em })); b.scale.set(sx, sy, sz); b.position.y = sy / 2; g.add(b); return { root: g, update: function () {}, play: function () {} }; }
// Mira and the Bloom appear beside the flag once the Commander is down
F.place = function () {
  remove(); var fx = W.flag.x, fz = W.flag.z;
  F.mira = JO.Assets.instantiate('mira') || prim(0xd8d2c0, 0x101010, 0.5, 1.7, 0.35); F.mira.root.position.set(fx + 1.7, 0, fz - 1.2); F.mira.root.rotation.y = -0.35; if (F.mira.play) F.mira.play('idle', 1); scene.add(F.mira.root);
  F.bloom = JO.Assets.instantiate('bloom') || prim(0x58e0d0, 0x2a9088, 0.8, 1.6, 0.8); F.bloom.root.position.set(fx - 1.9, 0, fz - 2.6); F.bloom.root.scale.setScalar(1.9); scene.add(F.bloom.root);
  F.halo = new THREE.Mesh(W.G.ico0 || W.G.box, new THREE.MeshBasicMaterial({ color: 0x58e0d0, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  F.halo.position.set(fx - 1.9, 2.2, fz - 2.6); F.halo.scale.setScalar(2.4); scene.add(F.halo);
};
F.begin = function () {
  var G = JO.Game, P = JO.Player, St = JO.Story; F.active = true; F.asked = false; F.t = 0; G.state = 'finale'; JO.Input.exitLock(); JO.Input.clear(); JO.UI.hud(false); JO.UI.refreshTouch(); A.setIntensity(0);
  P.place(W.flag.x - 0.2, W.flag.z + 2.2); St.reset(); St.trigger('mira_meet'); if (G.run.spared) St.trigger('mira_third');
};
F.camera = function (cam, real) {
  F.t += real; var fx = W.flag.x, fz = W.flag.z, k = Math.min(1, F.t / 14);
  cam.position.set(fx + 0.6 - k * 0.8, 2.1, fz + 7.2 - k * 1.6); cam.lookAt(fx, 1.5, fz - 1.6); if (cam.fov !== 55) { cam.fov = 55; cam.updateProjectionMatrix(); }
  if (F.mira && F.mira.update) F.mira.update(real); if (F.halo) F.halo.scale.setScalar(2.4 + Math.sin(F.t * 2) * 0.3); if (F.bloom) F.bloom.root.rotation.y += real * 0.25;
  if (!F.asked && !JO.Story.busy() && F.t > 1) { F.asked = true; ask(); }
};
function ask() {
  var G = JO.Game, wrap = $('choiceCards'); wrap.innerHTML = '';
  ['destroy', 'preserve', 'third'].forEach(function (id) { var e = D.endings[id]; if (!e) return; var ok = !e.requires || G.run.spared, b = document.createElement('button'); b.className = 'card' + (ok ? '' : ' locked'); b.disabled = !ok; b.setAttribute('data-end', id);
    b.innerHTML = ok ? '<b>' + e.choice + '</b><small>' + e.hint + '</small>' : '<b>? ? ?</b><small>Someone who remembered the river might have known a third way. He is not here.</small>';
    if (ok) b.addEventListener('click', function () { A.play('ui'); F.choose(id); }); wrap.appendChild(b); });
  JO.UI.show('scrChoice');
}
F.choose = function (id) {
  var G = JO.Game, e = D.endings[id]; G.ending = id; JO.UI.show(null); S.profile.endings[id] = 1; S.save(); Ev.emit('ending', id);
  JO.Story.cutscene(e.cutscene, function () { F.active = false; G.completeLevel(); JO.Story.say(e.signoff); });
};
F.init = function (sc) { scene = sc; Ev.on('level_load', remove); Ev.on('boss_dead', function () { if (JO.Game.levelIdx === JO.CFG.LEVELS.length - 1 && !JO.Game.mode) F.place(); }); };
})();
