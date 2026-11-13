/* ============================================================
   JUNGLE OUTPOST — codex.js
   Collectibles (4 intel logs and 1 hidden idol per level) and
   the codex menu: logs, character bios, enemy and boss entries
   that unlock the first time you meet them.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, CFG = JO.CFG, W = JO.World, FX = JO.FX, A = JO.Audio, Ev = JO.Events, S = JO.Save, D = window.JO_STORY || { intel: [], idols: [], codex: { bios: [], enemies: [], bosses: [] } };
var Cx = JO.Codex = { items: [], tab: 'intel', back: 'scrTitle' };
var $ = function (id) { return document.getElementById(id); };
// where the collectibles sit in each level: 4 intel logs on or near the trail, 1 idol tucked against the tree line
var SPOTS = [
  { intel: [[-3, -22], [5, -92], [-7, -150], [4, -205]], idol: [13.5, -118] },
  { intel: [[3, -34], [0, -99], [6, -145], [-4, -212]], idol: [-13.5, -182] },
  { intel: [[-4, -30], [6, -98], [-7, -162], [5, -218]], idol: [13.5, -140] }];
var beamMat = null, scene = null;

function makeItem(kind, def, x, z) {
  var g = new THREE.Group(), m = JO.Assets.instantiate(kind === 'idol' ? 'pk_idol' : 'pk_intel');
  if (m) { m.root.scale.setScalar(kind === 'idol' ? 1.5 : 1.4); g.add(m.root); }
  else { var b = new THREE.Mesh(W.G.box, new THREE.MeshLambertMaterial({ color: kind === 'idol' ? 0xd8b030 : 0x58e0d0, emissive: kind === 'idol' ? 0x403000 : 0x104038 })); b.scale.set(0.4, kind === 'idol' ? 0.6 : 0.3, 0.3); g.add(b); }
  if (kind === 'intel') { var beam = new THREE.Mesh(W.G.box, beamMat); beam.scale.set(0.12, 9, 0.12); beam.position.y = 4.5; g.add(beam); }
  var hw = W.halfWidth(z) - 1; x = Math.max(-hw, Math.min(hw, x)); g.position.set(x, 0.7, z); scene.add(g);
  return { kind: kind, def: def, x: x, z: z, g: g, got: false, t: Math.random() * 6 };
}
function clear() { for (var i = 0; i < Cx.items.length; i++) scene.remove(Cx.items[i].g); Cx.items.length = 0; }
Cx.build = function (idx) {
  clear(); var sp = SPOTS[idx]; if (!sp) return;
  var logs = D.intel.filter(function (d) { return d.level === idx; }), idol = D.idols.filter(function (d) { return d.level === idx; })[0], run = JO.Game.run;
  logs.forEach(function (d, i) { if (sp.intel[i] && !run.intel[d.id]) Cx.items.push(makeItem('intel', d, sp.intel[i][0], sp.intel[i][1])); });
  if (idol && !run.idols[idol.id]) Cx.items.push(makeItem('idol', idol, sp.idol[0], sp.idol[1]));
};
Cx.levelCount = function (idx) { var run = JO.Game.run, n = 0, k = 0;
  D.intel.forEach(function (d) { if (d.level === idx && run.intel[d.id]) n++; }); D.idols.forEach(function (d) { if (d.level === idx && run.idols[d.id]) k++; }); return { intel: n, idol: k }; };
Cx.update = function (dt) {
  var P = JO.Player;
  for (var i = 0; i < Cx.items.length; i++) { var it = Cx.items[i]; if (it.got) continue;
    it.t += dt; it.g.position.y = 0.75 + Math.sin(it.t * 2.4) * 0.1; it.g.rotation.y = it.t * 1.4;
    var dx = it.x - P.pos.x, dz = it.z - P.pos.z; if (dx * dx + dz * dz > 4.4 || P.dead) continue;
    it.got = true; it.g.visible = false; var run = JO.Game.run, isNew;
    if (it.kind === 'idol') { run.idols[it.def.id] = 1; isNew = !S.profile.idols[it.def.id]; S.profile.idols[it.def.id] = 1; } else { run.intel[it.def.id] = 1; isNew = !S.profile.intel[it.def.id]; S.profile.intel[it.def.id] = 1; }
    S.save(); A.play('checkpoint', 0.7); FX.burst(it.x, 1, it.z, 16, it.kind === 'idol' ? 0xffd060 : 0x58e0d0, 4, 0.6, 0, 0.16, 3);
    JO.UI.toast(it.kind === 'idol' ? 'HIDDEN IDOL FOUND' : 'INTEL RECOVERED', it.def.title + (isNew ? ' — added to the codex (J)' : ''), it.kind === 'idol' ? '#ffd060' : '#58e0d0');
    Ev.emit('collect', it.kind, it.def); }
};
function see(kind, id, title) { var k = kind + ':' + id; if (S.profile.seen[k]) return; S.profile.seen[k] = 1; S.save(); JO.UI.toast('CODEX UPDATED', title, '#e9e4cf'); }

/* ---------- menu ---------- */
function entries(tab) {
  var p = S.profile, out = [];
  if (tab === 'intel') { D.intel.forEach(function (d) { out.push({ title: d.title, text: d.text, open: !!p.intel[d.id], tag: 'LEVEL ' + (d.level + 1) }); });
    D.idols.forEach(function (d) { out.push({ title: d.title, text: d.text, open: !!p.idols[d.id], tag: 'IDOL · LEVEL ' + (d.level + 1) }); }); }
  else if (tab === 'bios') D.codex.bios.forEach(function (d) { var need = d.unlock ? +d.unlock.split(':')[1] : 0; out.push({ title: d.title, text: d.text, open: p.maxLevel >= need, tag: 'PEOPLE' }); });
  else D.codex[tab].forEach(function (d) { out.push({ title: d.title, text: d.text, open: !!p.seen[(tab === 'bosses' ? 'boss:' : 'enemy:') + d.id], tag: tab === 'bosses' ? 'BOSS' : 'ENEMY' }); });
  return out;
}
function render(sel) {
  var list = entries(Cx.tab), ul = $('cxList'), n = 0; ul.innerHTML = '';
  list.forEach(function (e, i) { if (e.open) n++; var b = document.createElement('button'); b.className = 'cxi' + (e.open ? '' : ' lock') + (i === sel ? ' on' : ''); b.textContent = e.open ? e.title : '? ? ?';
    b.addEventListener('click', function () { A.play('ui'); render(i); }); ul.appendChild(b); });
  var e = list[sel === undefined ? -1 : sel];
  $('cxBody').innerHTML = e ? '<h3>' + e.tag + '</h3><b>' + (e.open ? e.title : 'LOCKED') + '</b><p>' + (e.open ? e.text : (Cx.tab === 'intel' ? 'Not found yet. Intel logs glow cyan on the trail; idols are hidden off it.' : 'You have not met this one yet.')) + '</p>' : '<p class="dim">Select an entry.</p>';
  $('cxCount').textContent = n + ' / ' + list.length + ' UNLOCKED';
  var tabs = $('cxTabs').querySelectorAll('button'); for (var t = 0; t < tabs.length; t++) tabs[t].classList.toggle('on', tabs[t].getAttribute('data-tab') === Cx.tab);
}
Cx.open = function (back) { Cx.back = back || 'scrTitle'; JO.UI.show('scrCodex'); var l = entries(Cx.tab), first = -1; for (var i = 0; i < l.length; i++) if (l[i].open) { first = i; break; } render(first < 0 ? undefined : first); };
Cx.total = function () { var p = S.profile, n = 0, t = 0; ['intel', 'bios', 'enemies', 'bosses'].forEach(function (tab) { entries(tab).forEach(function (e) { t++; if (e.open) n++; }); }); return [n, t]; };

Cx.init = function (sc) {
  scene = sc; beamMat = new THREE.MeshBasicMaterial({ color: 0x58e0d0, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  $('cxTabs').addEventListener('click', function (e) { var t = e.target.getAttribute && e.target.getAttribute('data-tab'); if (!t) return; A.play('ui'); Cx.tab = t; Cx.open(Cx.back); });
  $('btnCodexBack').addEventListener('click', function () { A.play('ui'); JO.UI.show(Cx.back); });
  Ev.on('level_load', function (i) { if (i > S.profile.maxLevel) { S.profile.maxLevel = i; S.save(); } Cx.build(i); });
  Ev.on('enemy_alert', function (e) { var d = D.codex.enemies.filter(function (x) { return x.id === e.type; })[0]; if (d) see('enemy', d.id, d.title); });
  Ev.on('boss_start', function (b) { var d = D.codex.bosses.filter(function (x) { return x.id === b.kind; })[0]; if (d) see('boss', d.id, d.title); });
  Ev.on('collect', function (kind) { JO.Story.trigger(kind === 'idol' ? 'idol' : 'intel'); });
};
})();
