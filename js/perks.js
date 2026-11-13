/* ============================================================
   JUNGLE OUTPOST — perks.js
   Salvage, the skill tree, weapon mods and the field bench.
   Skills and mods live in the save profile, so they carry over
   between runs. Combat code asks small questions here
   (Pk.has('a1'), Pk.mod('ar_ap'), Pk.spread(...)) instead of
   knowing how the bench works.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, CFG = JO.CFG, A = JO.Audio, Ev = JO.Events, S = JO.Save;
var Pk = JO.Perks = { tab: 'skills', back: null, adren: 0, lastStand: false };
var $ = function (id) { return document.getElementById(id); };

Pk.has = function (id) { return !!S.profile.skills[id]; };
Pk.mod = function (id) { return !!S.profile.mods[id]; };

/* ---------- the questions combat code asks ---------- */
Pk.magBonus = function (id) { return id === 'ar' && Pk.mod('ar_mag') ? 10 : (id === 'sg' && Pk.mod('sg_drum') ? 3 : (id === 'ft' && Pk.mod('ft_tank') ? 50 : 0)); };
Pk.spread = function (id) { return (Pk.has('a1') ? 0.75 : 1) * (id === 'sg' && Pk.mod('sg_choke') ? 0.7 : 1); };
Pk.recoil = function (id) { return id === 'ar' && Pk.mod('ar_comp') ? 0.6 : 1; };
Pk.reload = function (id) { return id === 'xb' && Pk.mod('xb_quick') ? 0.65 : 1; };
Pk.reserve = function () { return Pk.has('a2') ? 1.3 : 1; };
Pk.fire = function () { return Pk.adren > 0 ? 1.15 : 1; };
Pk.headMult = function (c) { return c.headMult + (c.id === 'mr' && Pk.mod('mr_scope') ? 0.5 : 0); };
// damage multiplier against one enemy (unaware targets take more with Executioner)
Pk.damage = function (c, e) {
  var m = c.id === 'ar' && Pk.mod('ar_ap') ? 1.15 : 1;
  if (e && !e.isBoss && e.state === 'patrol' && Pk.has('s4')) m *= 1.6;
  return m;
};
Pk.noise = function (c) { return (c.noise || 30) * (Pk.has('s1') ? 0.65 : 1) * (c.id === 'mr' && Pk.mod('mr_supp') ? 0.2 : 1) * (c.id === 'xb' && Pk.mod('xb_boom') ? 9 : 1); };
Pk.sight = function () { return Pk.has('s2') ? 0.8 : 1; };
Pk.taken = function () { return Pk.has('v1') ? 0.88 : 1; };
Pk.update = function (dt) { if (Pk.adren > 0) Pk.adren -= dt; };

/* ---------- salvage ---------- */
Pk.addSalvage = function (n, x, y, z) {
  n = Math.round(n * (Pk.has('v3') ? 1.5 : 1) * (1 + 0.5 * (JO.Game.run.ng || 0))); if (n <= 0) return;
  S.profile.salvage += n; JO.Game.run.salvage = (JO.Game.run.salvage || 0) + n;
  if (x !== undefined) JO.UI.dmgNum(x, y, z, '+' + n + ' SALVAGE', 'blk');
  Ev.emit('salvage', n);
};
function owned(kind) { return kind === 'skill' ? S.profile.skills : S.profile.mods; }
function def(kind, id) { var l = kind === 'skill' ? CFG.SKILLS : CFG.MODS; for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
// why can't this be bought? '' means it can
Pk.blocked = function (kind, id) {
  var d = def(kind, id); if (!d) return 'UNKNOWN';
  if (owned(kind)[id]) return 'OWNED';
  if (kind === 'skill' && d.tier > 1 && !Pk.has(d.id.charAt(0) + (d.tier - 1))) return 'NEEDS THE SKILL ABOVE';
  if (S.profile.salvage < d.cost) return 'NOT ENOUGH SALVAGE';
  return '';
};
Pk.buy = function (kind, id) {
  if (Pk.blocked(kind, id)) { A.play('empty'); return false; }
  var d = def(kind, id); S.profile.salvage -= d.cost; owned(kind)[id] = 1; S.save(); A.play('checkpoint', 0.7);
  if (JO.Weapons.slots.length) JO.Weapons.slots.forEach(function (s) { if (kind === 'mod' && s.cfg.id === d.wpn && JO.Weapons.reloading <= 0) s.mag = Math.min(JO.Weapons.magSize(s.idx), Math.max(s.mag, s.mag + Pk.magBonus(s.cfg.id))); });
  Ev.emit('perk', kind, id); return true;
};

/* ---------- bench screen ---------- */
function card(kind, d) {
  var why = Pk.blocked(kind, d.id), b = document.createElement('button');
  b.className = 'bcard' + (why === 'OWNED' ? ' own' : (why ? ' no' : '')); b.setAttribute('data-id', d.id);
  b.innerHTML = '<b></b><small></small><i></i>'; b.children[0].textContent = d.name; b.children[1].textContent = d.desc;
  b.children[2].textContent = why === 'OWNED' ? 'FITTED' : d.cost + ' SALVAGE' + (why && why !== 'NOT ENOUGH SALVAGE' ? ' · ' + why : '');
  b.addEventListener('click', function () { if (Pk.buy(kind, d.id)) render(); });
  return b;
}
function render() {
  $('benchSalvage').textContent = S.profile.salvage + ' SALVAGE';
  var tabs = $('benchTabs').querySelectorAll('button'), i; for (i = 0; i < tabs.length; i++) tabs[i].classList.toggle('on', tabs[i].getAttribute('data-tab') === Pk.tab);
  var body = $('benchBody'); body.innerHTML = '';
  var groups = {}, order = [], list = Pk.tab === 'skills' ? CFG.SKILLS : CFG.MODS, kind = Pk.tab === 'skills' ? 'skill' : 'mod';
  list.forEach(function (d) { var key = kind === 'skill' ? d.tree : weaponName(d.wpn); if (!groups[key]) { groups[key] = []; order.push(key); } groups[key].push(d); });
  order.forEach(function (key) { var col = document.createElement('div'); col.className = 'bcol'; var h = document.createElement('h3'); h.textContent = key; col.appendChild(h);
    groups[key].forEach(function (d) { col.appendChild(card(kind, d)); }); body.appendChild(col); });
}
function weaponName(id) { for (var i = 0; i < CFG.WEAPONS.length; i++) if (CFG.WEAPONS[i].id === id) return CFG.WEAPONS[i].name; return id; }
// back: function called when the bench closes
Pk.open = function (back) { Pk.back = back || null; render(); JO.UI.show('scrBench'); };
Pk.close = function () { var b = Pk.back; Pk.back = null; if (b) b(); else JO.UI.show('scrTitle'); };

Pk.init = function () {
  $('benchTabs').addEventListener('click', function (e) { var t = e.target.getAttribute && e.target.getAttribute('data-tab'); if (!t) return; A.play('ui'); Pk.tab = t; render(); });
  $('btnBenchClose').addEventListener('click', function () { A.play('ui'); Pk.close(); });
  var V = CFG.SALVAGE;
  Ev.on('kill', function (e) { if (!e.summoned) Pk.addSalvage(V[e.type] || 5, e.pos.x, e.pos.y + 2.2, e.pos.z); });
  Ev.on('boss_dead', function (b) { Pk.addSalvage(V.boss, b.pos.x, 3, b.pos.z); });
  Ev.on('collect', function (kind) { Pk.addSalvage(V[kind] || 0); });
  Ev.on('player_kill', function () { if (Pk.has('a4')) Pk.adren = 4; });
  Ev.on('level_load', function () { Pk.lastStand = false; Pk.adren = 0; });
};
})();
