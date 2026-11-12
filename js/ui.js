/* ============================================================
   JUNGLE OUTPOST — ui.js
   HUD, floating damage numbers, hit marker, damage-direction
   indicators and all menu screens. DOM writes are cached so
   the HUD only touches the page when a value changes.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, CFG = JO.CFG;
var UI = JO.UI = {};
var $ = function (id) { return document.getElementById(id); };
var el = {}, cache = {}, dn = [], inds = [], dnNext = 0, v = new THREE.Vector3();
var hitT = 0, vigT = 0, bannerT = 0, crossGap = 6;
var SCREENS = [];

function set(id, val) { if (cache[id] !== val) { cache[id] = val; el[id].textContent = val; } }
function scale(id, k) { k = Math.max(0, Math.min(1, k)); var key = id + 's', r = Math.round(k * 200); if (cache[key] !== r) { cache[key] = r; el[id].style.transform = 'scaleX(' + (r / 200) + ')'; } }
function cls(node, name, on) { var key = node.id + '.' + name; if (cache[key] !== on) { cache[key] = on; node.classList.toggle(name, on); } }

UI.init = function () {
  ['hud', 'hudLevel', 'hudObj', 'hudKills', 'hpFill', 'hpTxt', 'arFill', 'arTxt', 'stFill', 'wName', 'wAmmo', 's1', 's2', 's3', 'bossWrap', 'bossName', 'bossFill', 'bossPhase', 'bossBar',
    'banner', 'prompt', 'reloadTxt', 'cross', 'hitm', 'vignette', 'lowhp', 'inds', 'dnums', 'touch', 'btnPause', 'btnMute', 'tUse'].forEach(function (id) { el[id] = $(id); });
  var i, d, scr = document.querySelectorAll('.screen[id^=scr]'); for (i = 0; i < scr.length; i++) SCREENS.push(scr[i].id);
  el.toasts = $('toasts');
  for (i = 0; i < 22; i++) { d = document.createElement('div'); d.className = 'dnum'; el.dnums.appendChild(d); dn.push({ el: d, life: 0, x: 0, y: 0, z: 0, max: 1 }); }
  for (i = 0; i < 5; i++) { d = document.createElement('i'); el.inds.appendChild(d); inds.push({ el: d, life: 0, sx: 0, sz: 0 }); }
  el.cl = el.cross.querySelector('.l'); el.cr = el.cross.querySelector('.r'); el.cu = el.cross.querySelector('.u'); el.cd = el.cross.querySelector('.d');
};

UI.show = function (id) {
  SCREENS.forEach(function (s) { $(s).classList.toggle('hidden', s !== id); });
  var first = id && $(id).querySelector('.btn, .card'); if (first && !JO.Input.isTouch) try { first.focus({ preventScroll: true }); } catch (e) { /* older browsers */ }
};
// corner notification (collectibles, codex, achievements)
UI.toast = function (kicker, text, color) {
  var t = document.createElement('div'); t.className = 'toast'; t.style.borderColor = color || '#ffb62e'; t.innerHTML = '<b style="color:' + (color || '#ffb62e') + '"></b><span></span>';
  t.firstChild.textContent = kicker; t.lastChild.textContent = text; el.toasts.appendChild(t); while (el.toasts.children.length > 4) el.toasts.removeChild(el.toasts.firstChild);
  setTimeout(function () { t.classList.add('out'); }, 4200); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 4800);
};
UI.hud = function (on) { el.hud.classList.toggle('hidden', !on); UI.refreshTouch(); };
UI.refreshTouch = function () {
  var playing = JO.Game && JO.Game.state === 'playing';
  el.touch.classList.toggle('hidden', !(JO.Input.isTouch && playing)); el.btnPause.classList.toggle('hidden', !(JO.Input.isTouch && playing));
};
UI.setMute = function (m) { el.btnMute.style.opacity = m ? 0.4 : 1; el.btnMute.innerHTML = m ? '&#215;' : '&#9835;'; };

UI.banner = function (msg, dur, red) { el.banner.textContent = msg; el.banner.classList.toggle('red', !!red); el.banner.style.opacity = 1; bannerT = dur || 2; };
UI.hitmarker = function (kind) { el.hitm.className = kind || ''; hitT = kind === 'kill' ? 0.3 : 0.16; el.hitm.style.opacity = 1; };
UI.hurt = function (sx, sz) {
  vigT = 0.6; var best = inds[0];
  for (var i = 0; i < inds.length; i++) { if (inds[i].life <= 0) { best = inds[i]; break; } if (inds[i].life < best.life) best = inds[i]; }
  best.life = 1.3; best.sx = sx; best.sz = sz;
};
UI.dmgNum = function (x, y, z, text, c) {
  var d = dn[dnNext]; dnNext = (dnNext + 1) % dn.length;
  d.x = x + (Math.random() - 0.5) * 0.3; d.y = y; d.z = z + (Math.random() - 0.5) * 0.3; d.life = d.max = c === 'blk' ? 0.5 : 0.75; d.el.textContent = text; d.el.className = 'dnum ' + (c || '');
};
UI.clearFloat = function () {
  for (var i = 0; i < dn.length; i++) { dn[i].life = 0; dn[i].el.style.opacity = 0; } for (i = 0; i < inds.length; i++) { inds[i].life = 0; inds[i].el.style.opacity = 0; }
  el.vignette.style.opacity = 0; el.lowhp.style.opacity = 0; el.banner.style.opacity = 0; vigT = 0; bannerT = 0; el.hitm.style.opacity = 0;
};

UI.bossBar = function (boss) {
  el.bossWrap.classList.toggle('hidden', !boss); if (!boss) return;
  el.bossName.textContent = boss.name;
  var old = el.bossBar.querySelectorAll('.tick'); for (var i = 0; i < old.length; i++) old[i].remove();
  var marks = boss.kind === 'commander' ? [0.66, 0.33] : (boss.kind === 'phantom' ? [0.5, CFG.BOSS.phantom.finalAt] : [0.5]);
  marks.forEach(function (m) { var t = document.createElement('div'); t.className = 'tick'; t.style.left = (m * 100) + '%'; el.bossBar.appendChild(t); });
};

/* per-frame HUD refresh */
UI.update = function (dt, camera) {
  var Gm = JO.Game, P = JO.Player, Wp = JO.Weapons, I = JO.Input, i;
  if (Gm.state !== 'playing' && Gm.state !== 'dying') return;
  set('hudKills', 'KILLS ' + Gm.stats.kills + '   TIME ' + fmtTime(Gm.stats.time));
  scale('hpFill', P.hp / P.maxHp); set('hpTxt', Math.ceil(P.hp) + ' / ' + P.maxHp);
  scale('arFill', P.armor / P.armorCap()); set('arTxt', Math.ceil(P.armor) + ' / ' + P.armorCap());
  scale('stFill', P.stamina / CFG.PLAYER.stamina);
  var s = Wp.current(); set('wName', s.cfg.name);
  var ammo = s.mag + ' / ' + s.reserve; if (cache.ammo !== ammo) { cache.ammo = ammo; el.wAmmo.innerHTML = s.mag + ' <small>/ ' + s.reserve + '</small>'; el.wAmmo.style.color = s.mag <= Math.ceil(Wp.magSize(Wp.cur) * 0.2) ? '#ff5a3c' : ''; }
  for (i = 0; i < 3; i++) { var n = el['s' + (i + 1)]; cls(n, 'on', Wp.cur === i); cls(n, 'lock', !Wp.slots[i].unlocked); }
  cls(el.reloadTxt, 'hidden', !(Wp.reloading > 0));
  var obj = Gm.objective; if (cache.obj !== obj) { cache.obj = obj; el.hudObj.innerHTML = obj; }
  if (Gm.boss && Gm.bossFight) { scale('bossFill', Gm.boss.hp / Gm.boss.maxHp);
    set('bossPhase', Gm.boss.kind === 'commander' && Gm.boss.shieldUp() ? 'SHIELD ACTIVE — WAIT FOR THE MISSILE VOLLEY' : (Gm.boss.phase >= Gm.boss.phases && Gm.boss.phases === 3 && Gm.boss.kind === 'phantom' ? 'FINAL STAGE' : 'PHASE ' + Gm.boss.phase)); }
  var pr = Gm.hint || (P.nearCrate ? (I.isTouch ? 'TAP <kbd>USE</kbd> TO OPEN SUPPLY CRATE' : 'PRESS <kbd>E</kbd> TO OPEN SUPPLY CRATE') : '');
  if (cache.prompt !== pr) { cache.prompt = pr; el.prompt.innerHTML = pr; el.prompt.classList.toggle('hidden', !pr); el.tUse.classList.toggle('hidden', !pr); }

  // crosshair spread
  var sp = (I.ads ? s.cfg.adsSpread : s.cfg.spread) + Wp.bloom, gap = 4 + sp * (I.ads ? 6 : 3.4); crossGap += (gap - crossGap) * Math.min(1, dt * 18);
  var gpx = Math.round(crossGap); if (cache.gap !== gpx) { cache.gap = gpx; el.cl.style.left = (-gpx - 9) + 'px'; el.cr.style.left = gpx + 'px'; el.cu.style.top = (-gpx - 9) + 'px'; el.cd.style.top = gpx + 'px'; }
  if (hitT > 0) { hitT -= dt; if (hitT <= 0) el.hitm.style.opacity = 0; }
  if (vigT > 0) { vigT -= dt; el.vignette.style.opacity = Math.max(0, vigT / 0.6) * 0.9; }
  var low = P.hp < P.maxHp * 0.3 ? 0.5 + 0.3 * Math.sin(performance.now() * 0.008) : 0; if ((low > 0) !== cache.low || low > 0) { cache.low = low > 0; el.lowhp.style.opacity = low; }
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) el.banner.style.opacity = 0; }

  // damage direction indicators (rotate around the crosshair)
  for (i = 0; i < inds.length; i++) { var d = inds[i]; if (d.life <= 0) continue; d.life -= dt;
    if (d.life <= 0) { d.el.style.opacity = 0; continue; }
    var a = Math.atan2(d.sx - P.pos.x, d.sz - P.pos.z) - P.yaw; d.el.style.opacity = Math.min(1, d.life * 1.5); d.el.style.transform = 'rotate(' + (-a).toFixed(3) + 'rad)'; }
  // floating damage numbers
  var w = window.innerWidth * 0.5, h = window.innerHeight * 0.5;
  for (i = 0; i < dn.length; i++) { var f = dn[i]; if (f.life <= 0) continue; f.life -= dt;
    if (f.life <= 0) { f.el.style.opacity = 0; continue; }
    f.y += dt * 1.3; v.set(f.x, f.y, f.z).project(camera);
    if (v.z > 1 || v.z < -1) { f.el.style.opacity = 0; continue; }
    f.el.style.opacity = Math.min(1, f.life / f.max * 2); f.el.style.transform = 'translate(' + ((v.x * w + w) | 0) + 'px,' + ((-v.y * h + h) | 0) + 'px) translate(-50%,-50%)'; }
};

function fmtTime(t) { var m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + (s < 10 ? '0' : '') + s; }
UI.fmtTime = fmtTime;
function statBlock(node, st) {
  var acc = st.shots ? Math.round(st.hits / st.shots * 100) : 0;
  node.innerHTML = '<div><b>' + fmtTime(st.time) + '</b><span>TIME</span></div><div><b>' + st.kills + '</b><span>KILLS</span></div><div><b>' + acc + '%</b><span>ACCURACY</span></div><div><b>' + Math.round(st.dmgTaken) + '</b><span>DAMAGE TAKEN</span></div>';
}
UI.setLevelHeader = function (L) { cache.hudLevel = null; set('hudLevel', L.sub + ' — ' + L.name); };
UI.showIntro = function (L, unlock) {
  $('introSub').textContent = L.sub; $('introName').textContent = L.name; $('introStory').textContent = L.story;
  $('introUnlock').textContent = unlock ? 'NEW WEAPON UNLOCKED: ' + unlock.cfg.name + '  [' + (unlock.idx + 1) + ']' : '';
  UI.show('scrIntro');
};
UI.showDone = function (L, st, choices, onPick) {
  $('doneSub').textContent = L.sub + ' — ' + L.name; statBlock($('doneStats'), st);
  var cc = JO.Codex.levelCount(JO.Game.levelIdx); $('doneFound').textContent = 'INTEL ' + cc.intel + ' / 4   ·   IDOL ' + cc.idol + ' / 1';
  var wrap = $('upCards'); wrap.innerHTML = '';
  choices.forEach(function (u) { var b = document.createElement('button'); b.className = 'card'; b.innerHTML = '<b>' + u.name + '</b><small>' + u.desc + '</small>';
    b.addEventListener('click', function () { onPick(u.id); }); wrap.appendChild(b); });
  UI.show('scrDone');
};
UI.showWin = function (total, ending, run) {
  var D = window.JO_STORY || {}, e = ending && D.endings && D.endings[ending], n = Object.keys(JO.Save.profile.endings).length;
  $('winSub').textContent = e ? 'ENDING ' + n + ' OF 3 FOUND' : 'THE OUTPOST HAS FALLEN'; $('winTitle').textContent = e ? e.title : 'MISSION ACCOMPLISHED';
  $('winStory').textContent = e ? e.hint + (run ? '  Mercy: ' + run.mercy + '.' : '') : "The Commander's walker burns in the courtyard. Extraction is inbound.";
  statBlock($('winStats'), total); UI.show('scrWin'); };
UI.showDead = function (msg) { $('deadMsg').textContent = msg; UI.show('scrDead'); };
})();
