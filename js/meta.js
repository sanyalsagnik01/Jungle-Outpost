/* ============================================================
   JUNGLE OUTPOST — meta.js
   Everything around the campaign:
     - settings (look, sound, subtitles, key rebinding,
       accessibility) kept in the save profile
     - achievements with toasts
     - extra modes: New Game+, Boss Rush, Endless Survival
     - feel: adaptive difficulty after repeated deaths, hit-stop,
       combat-aware music level, FPS overlay
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, CFG = JO.CFG, Ev = JO.Events, S = JO.Save, A = JO.Audio, E = JO.Enemies;
var M = JO.Meta = { streak: 0, wave: 0, waveLeft: 0, waveT: 0, queue: [], count: {}, back: 'scrTitle', bossHurt0: 0, levelAlerts0: 0 };
var $ = function (id) { return document.getElementById(id); };

/* ============================================================
   SETTINGS
   ============================================================ */
var DEF = { sens: 1, invertY: false, volume: 1, music: 1, subSize: 1, colorblind: false, reduceShake: false, reduceFlash: false, aimAssist: false, adaptive: true, hitStop: true, minimap: true, weather: true, fps: false, keys: {} };
var ACTIONS = [['forward', 'Move forward', 'KeyW'], ['back', 'Move back', 'KeyS'], ['left', 'Move left', 'KeyA'], ['right', 'Move right', 'KeyD'], ['sprint', 'Sprint', 'ShiftLeft'], ['jump', 'Jump', 'Space'],
  ['roll', 'Roll / dodge', 'KeyC'], ['crouch', 'Crouch', 'KeyX'], ['reload', 'Reload', 'KeyR'], ['interact', 'Interact', 'KeyE'], ['melee', 'Takedown / finish', 'KeyF'], ['frag', 'Frag grenade', 'KeyG'],
  ['smoke', 'Smoke grenade', 'KeyQ'], ['bench', 'Field bench', 'KeyB'], ['codex', 'Codex', 'KeyJ'], ['mute', 'Mute', 'KeyM']];
M.ACTIONS = ACTIONS;
var set = null, listening = null;
function keyName(c) { return (c || '—').replace(/^Key/, '').replace(/^Digit/, '').replace('ShiftLeft', 'L-SHIFT').replace('ShiftRight', 'R-SHIFT').replace('ControlLeft', 'L-CTRL').replace('Space', 'SPACE').replace(/^Arrow/, 'ARROW ').toUpperCase(); }
M.keyFor = function (action) { for (var i = 0; i < ACTIONS.length; i++) if (ACTIONS[i][0] === action) return set.keys[action] || ACTIONS[i][2]; return ''; };
M.keyLabel = function (action) { return keyName(M.keyFor(action)); };
// input.js asks this for every key event: which built-in key does this physical key stand for?
function rebuildKeys() {
  var rev = {}, taken = {}, i;
  for (i = 0; i < ACTIONS.length; i++) { var a = ACTIONS[i], c = set.keys[a[0]]; if (c && c !== a[2]) { rev[c] = a[2]; taken[a[2]] = true; } }
  JO.Input.translate = function (code) { return rev[code] !== undefined ? rev[code] : (taken[code] ? '' : code); };
}
M.get = function (k) { return set[k]; };
M.apply = function () {
  var P = S.profile.settings, k; for (k in DEF) if (P[k] === undefined) P[k] = typeof DEF[k] === 'object' ? {} : DEF[k]; set = M.set = P;
  document.documentElement.style.setProperty('--sub', set.subSize); document.body.classList.toggle('cb', !!set.colorblind);
  A.volume = set.volume; A.musicVol = set.music; if (A.applyVolume) A.applyVolume();
  JO.FX.shakeK = set.reduceShake ? 0.25 : 1; JO.Game.reduceFlash = !!set.reduceFlash; JO.Radar.on = !!set.minimap; JO.Radar.palette(set.colorblind); JO.Weather.enabled = !!set.weather;
  JO.FX.warnHex = set.colorblind ? 0xffe600 : 0; if (E.setLaser) E.setLaser(set.colorblind ? 0x2a9bff : 0xff1808);
  $('fps').classList.toggle('hidden', !set.fps); rebuildKeys(); if (JO.Game.refreshDiff) JO.Game.refreshDiff();
};
function save() { S.save(); M.apply(); }
function row(label, control, hint) { var r = document.createElement('div'); r.className = 'srow'; var l = document.createElement('label'); l.textContent = label; if (hint) { var h = document.createElement('small'); h.textContent = hint; l.appendChild(h); } r.appendChild(l); r.appendChild(control); return r; }
function slider(key, min, max, step, fmt) {
  var w = document.createElement('span'), i = document.createElement('input'), o = document.createElement('b'); i.type = 'range'; i.min = min; i.max = max; i.step = step; i.value = set[key]; i.setAttribute('data-key', key);
  o.textContent = fmt(set[key]); i.addEventListener('input', function () { set[key] = +i.value; o.textContent = fmt(set[key]); save(); }); w.appendChild(i); w.appendChild(o); return w;
}
function toggle(key) { var b = document.createElement('button'); b.className = 'tog' + (set[key] ? ' on' : ''); b.textContent = set[key] ? 'ON' : 'OFF'; b.setAttribute('data-key', key);
  b.addEventListener('click', function () { set[key] = !set[key]; b.classList.toggle('on', set[key]); b.textContent = set[key] ? 'ON' : 'OFF'; A.play('ui'); save(); }); return b; }
var pct = function (v) { return Math.round(v * 100) + '%'; };
function renderSettings() {
  var body = $('setBody'); body.innerHTML = '';
  function head(t) { var h = document.createElement('h3'); h.textContent = t; body.appendChild(h); }
  head('CONTROLS'); body.appendChild(row('Look sensitivity', slider('sens', 0.3, 2.5, 0.05, pct))); body.appendChild(row('Invert Y', toggle('invertY')));
  body.appendChild(row('Aim assist', toggle('aimAssist'), 'Bullets bend slightly toward the nearest target'));
  head('SOUND AND TEXT'); body.appendChild(row('Master volume', slider('volume', 0, 1, 0.05, pct))); body.appendChild(row('Music volume', slider('music', 0, 1, 0.05, pct)));
  body.appendChild(row('Subtitle size', slider('subSize', 0.8, 1.8, 0.1, pct)));
  head('ACCESSIBILITY'); body.appendChild(row('Colourblind-safe warnings', toggle('colorblind'), 'Danger markers turn yellow and blue instead of red'));
  body.appendChild(row('Reduce screen shake', toggle('reduceShake'))); body.appendChild(row('Reduce flashes', toggle('reduceFlash'), 'Softer lightning'));
  body.appendChild(row('Hit-stop on kills', toggle('hitStop'))); body.appendChild(row('Adaptive difficulty', toggle('adaptive'), 'Enemies ease off after repeated deaths at one checkpoint'));
  head('DISPLAY'); var q = document.createElement('button'); q.className = 'tog on'; q.id = 'setQuality'; q.textContent = JO.Post.setting.toUpperCase(); q.addEventListener('click', function () { JO.Post.cycle(); q.textContent = JO.Post.setting.toUpperCase(); });
  body.appendChild(row('Graphics quality', q, 'Auto steps down by itself when the frame rate drops')); body.appendChild(row('Minimap and compass', toggle('minimap'))); body.appendChild(row('Weather effects', toggle('weather'))); body.appendChild(row('FPS counter', toggle('fps')));
  head('KEYS — click one, then press the new key');
  ACTIONS.forEach(function (a) { var b = document.createElement('button'); b.className = 'tog key'; b.setAttribute('data-act', a[0]); b.textContent = M.keyLabel(a[0]);
    b.addEventListener('click', function () { if (listening) listening.btn.textContent = M.keyLabel(listening.act); listening = { act: a[0], btn: b }; b.textContent = 'PRESS A KEY'; b.classList.add('on'); }); body.appendChild(row(a[1], b)); });
  var rs = document.createElement('button'); rs.className = 'tog'; rs.textContent = 'RESET KEYS'; rs.id = 'setKeysReset'; rs.addEventListener('click', function () { set.keys = {}; save(); renderSettings(); }); body.appendChild(row('Default keys', rs));
}
M.bind = function (act, code) {
  var i, def = ''; for (i = 0; i < ACTIONS.length; i++) if (ACTIONS[i][0] === act) def = ACTIONS[i][2];
  for (i = 0; i < ACTIONS.length; i++) { var o = ACTIONS[i][0]; if (o !== act && M.keyFor(o) === code) set.keys[o] = M.keyFor(act); }      // already used: the two swap
  set.keys[act] = code; for (i = 0; i < ACTIONS.length; i++) if (set.keys[ACTIONS[i][0]] === ACTIONS[i][2]) delete set.keys[ACTIONS[i][0]];
  save();
};
M.openSettings = function (back) { M.back = back || 'scrTitle'; listening = null; renderSettings(); JO.UI.show('scrSettings'); };

/* ============================================================
   ACHIEVEMENTS
   ============================================================ */
var ACH = [
  ['first', 'FIRST BLOOD', 'Take down your first enemy'], ['heads', 'HEADHUNTER', 'Land 25 headshot kills'], ['ghost', 'GHOST', 'Perform 10 silent takedowns'],
  ['unseen', 'NEVER HERE', 'Finish a level without being spotted'], ['pyro', 'PYRO', 'Kill 15 burning enemies'], ['crush', 'GRAVITY ASSIST', 'Crush an enemy with logs or the gantry'],
  ['boom', 'CHAIN REACTION', 'Destroy 10 explosive barrels'], ['hacker', 'CLEAN HANDS', 'Hack the gate on the first try'], ['levers', 'LIGHTS ON', 'Solve the lever door'],
  ['road', 'ROAD RAGE', 'Ram 5 enemies with the jeep'], ['flawless', 'UNTOUCHABLE', 'Beat a boss without taking damage'], ['mercy', 'MERCY', 'Spare the Phantom'],
  ['end1', 'ASHES', 'Reach the Destroy ending'], ['end2', 'KEEPER', 'Reach the Preserve ending'], ['end3', 'THE THIRD WAY', 'Find the hidden ending'], ['endall', 'ALL ROADS', 'See all three endings'],
  ['collector', 'ARCHIVIST', 'Find every intel log and idol'], ['tinker', 'TINKERER', 'Fit 5 weapon mods'], ['tree', 'SPECIALIST', 'Complete one skill branch'],
  ['ng', 'ONCE MORE', 'Finish New Game+'], ['rush', 'BOSS RUSH', 'Clear Boss Rush'], ['wave10', 'LAST ONE STANDING', 'Reach wave 10 in Endless Survival'], ['deathless', 'IRON MAN', 'Finish the campaign without dying']];
M.ACH = ACH;
M.unlock = function (id) {
  var p = S.profile; if (p.ach[id]) return false; var d = null; for (var i = 0; i < ACH.length; i++) if (ACH[i][0] === id) d = ACH[i]; if (!d) return false;
  p.ach[id] = Date.now(); S.save(); JO.UI.toast('ACHIEVEMENT UNLOCKED', d[1] + ' — ' + d[2], '#ffd060'); A.play('win', 0.5); Ev.emit('achievement', id); return true;
};
function bump(k, n, id, need) { var c = S.profile.count; c[k] = (c[k] || 0) + (n || 1); if (id && c[k] >= need) M.unlock(id); }
function renderAch() {
  var g = $('achGrid'), n = 0; g.innerHTML = '';
  ACH.forEach(function (a) { var got = !!S.profile.ach[a[0]]; if (got) n++; var d = document.createElement('div'); d.className = 'ach' + (got ? ' got' : ''); d.innerHTML = '<b></b><small></small>'; d.firstChild.textContent = a[1]; d.lastChild.textContent = a[2]; g.appendChild(d); });
  $('achCount').textContent = n + ' / ' + ACH.length + ' UNLOCKED';
}
function wireAchievements() {
  Ev.on('kill', function (e) { M.unlock('first'); if (e.burnT > 0) bump('burn', 1, 'pyro', 15); });
  Ev.on('player_kill', function (head) { if (head) bump('heads', 1, 'heads', 25); });
  Ev.on('takedown', function () { bump('takedowns', 1, 'ghost', 10); });
  Ev.on('crush', function () { M.unlock('crush'); });
  Ev.on('prop_destroyed', function (kind) { if (kind === 'barrel') bump('barrels', 1, 'boom', 10); });
  Ev.on('hack', function (ok) { if (ok && JO.Props.gate && JO.Props.gate.tries === 1) M.unlock('hacker'); });
  Ev.on('door_open', function () { M.unlock('levers'); });
  Ev.on('ram', function () { bump('rams', 1, 'road', 5); });
  Ev.on('boss_start', function () { M.bossHurt0 = JO.Game.stats.dmgTaken; });
  Ev.on('boss_dead', function (b) { if (JO.Game.stats.dmgTaken - M.bossHurt0 < 0.5 && !JO.Game.debug.god) M.unlock('flawless'); if (b.spared) M.unlock('mercy'); });
  Ev.on('ending', function (id) { M.unlock(id === 'destroy' ? 'end1' : (id === 'preserve' ? 'end2' : 'end3')); if (Object.keys(S.profile.endings).length >= 3) M.unlock('endall'); });
  Ev.on('collect', function () { var D = window.JO_STORY || { intel: [], idols: [] }, p = S.profile, all = D.intel.length + D.idols.length > 0; D.intel.forEach(function (d) { if (!p.intel[d.id]) all = false; }); D.idols.forEach(function (d) { if (!p.idols[d.id]) all = false; }); if (all) M.unlock('collector'); });
  Ev.on('perk', function () { var p = S.profile; if (Object.keys(p.mods).length >= 5) M.unlock('tinker'); ['a', 's', 'v'].forEach(function (t) { if (p.skills[t + '1'] && p.skills[t + '2'] && p.skills[t + '3'] && p.skills[t + '4']) M.unlock('tree'); }); });
  Ev.on('level_load', function () { M.levelAlerts0 = JO.Game.run.alerts || 0; });
  Ev.on('level_complete', function (idx) { var G = JO.Game;
    if (!G.mode && (G.run.alerts || 0) === M.levelAlerts0 && !G.debug.bot) M.unlock('unseen');
    if (idx < CFG.LEVELS.length - 1) return;
    if (G.mode === 'bossrush') { M.unlock('rush'); var t = G.total.time; if (!S.profile.best.bossrush || t < S.profile.best.bossrush) S.profile.best.bossrush = Math.round(t); S.save(); return; }
    if (G.run.ng > 0) { M.unlock('ng'); S.profile.ngPlus = Math.max(S.profile.ngPlus | 0, G.run.ng); S.save(); }
    if (!G.run.deaths && !G.debug.god) M.unlock('deathless'); });
}

/* ============================================================
   MODES
   ============================================================ */
function renderModes() {
  var p = S.profile, done = Object.keys(p.endings).length > 0, w = $('modeCards'); w.innerHTML = '';
  function card(id, title, text, ok, why) { var b = document.createElement('button'); b.className = 'card' + (ok ? '' : ' locked'); b.disabled = !ok; b.setAttribute('data-mode', id); b.innerHTML = '<b></b><small></small>'; b.firstChild.textContent = title; b.lastChild.textContent = ok ? text : why;
    if (ok) b.addEventListener('click', function () { A.init(); A.play('ui'); M.startMode(id); }); w.appendChild(b); }
  var ng = (p.ngPlus | 0) + 1;
  card('ngplus', 'NEW GAME+ ' + ng, 'The full campaign again with every weapon from the start. Enemies hit harder and last longer; salvage is worth more.', done, 'Finish the campaign once to unlock.');
  card('bossrush', 'BOSS RUSH', 'The Brute, the Phantom and the Commander back to back.' + (p.best.bossrush ? '  Best: ' + JO.UI.fmtTime(p.best.bossrush) : ''), p.maxLevel >= 1 || done, 'Reach Level 2 to unlock.');
  card('survival', 'ENDLESS SURVIVAL', 'Hold the arena against waves that keep growing.' + (p.best.survival ? '  Best: wave ' + p.best.survival : ''), true, '');
}
M.startMode = function (id) {
  var G = JO.Game;
  if (id === 'ngplus') { G.mode = ''; G.startRun(0, (S.profile.ngPlus | 0) + 1); return; }
  G.mode = id; M.wave = 0; M.waveT = 3; M.waveLeft = 0; M.queue.length = 0; G.startRun(0);
};
// one wave of Endless Survival: a mix that gets heavier, fed into the arena a few at a time
function buildWave(n) {
  var q = [], total = Math.min(26, 4 + n * 2), pool = ['rifleman', 'runner', 'runner'];
  if (n >= 2) pool.push('grenadier'); if (n >= 3) pool.push('drone', 'rifleman'); if (n >= 4) pool.push('shield'); if (n >= 6) pool.push('shield', 'drone', 'grenadier');
  for (var i = 0; i < total; i++) q.push(pool[(Math.random() * pool.length) | 0]);
  return q;
}
M.survivalStep = function (dt) {
  var G = JO.Game, W = JO.World, P = JO.Player, alive = E.count();
  if (!M.queue.length && alive === 0) {
    if (M.waveT <= 0) M.waveT = M.wave ? 6 : 2;
    M.waveT -= dt;
    if (M.waveT <= 0) { M.wave++; M.queue = buildWave(M.wave); G.refreshDiff(); JO.UI.banner('WAVE ' + M.wave, 2, true); A.play('warn'); Ev.emit('wave', M.wave);
      if (M.wave > (S.profile.best.survival | 0)) { S.profile.best.survival = M.wave; S.save(); } if (M.wave >= 10) M.unlock('wave10');
      if (M.wave > 1) { G.spawnPickup('ammo', P.pos.x + 2, P.pos.z); G.spawnPickup(P.hp < P.maxHp * 0.6 ? 'health' : 'armor', P.pos.x - 2, P.pos.z); JO.Arsenal.give('frag', 1); } }
  }
  M.spawnT = (M.spawnT || 0) - dt;
  if (M.queue.length && M.spawnT <= 0 && alive < CFG.MAX_ACTIVE) { M.spawnT = 0.7;
    for (var tries = 0; tries < 8; tries++) { var a = Math.random() * 6.283, r = 16 + Math.random() * 8, x = Math.cos(a) * r, z = W.AC + Math.sin(a) * r;
      if (Math.hypot(x - P.pos.x, z - P.pos.z) < 12 || Math.abs(x) > W.arenaHW - 2 || z > W.A0 - 3 || z < W.A1 + 3) continue;
      E.spawn(M.queue.pop(), x, z, { alert: true }); JO.FX.burst(x, 1, z, 8, 0xff5030, 3, 0.4, 0, 0.14); break; } }
  G.objective = 'Wave <b>' + M.wave + '</b> — ' + (M.queue.length + alive) + ' hostiles left';
};

/* ============================================================
   FEEL
   ============================================================ */
M.adaptK = function () { return set && set.adaptive ? Math.min(3, Math.max(0, M.streak - 1)) : 0; };
var fpsEl = null, fpsT = 0, fpsN = 0, fpsAcc = 0, worst = 0, combat = 0;
// per rendered frame
M.frame = function (real) {
  var G = JO.Game, L = E.list, hot = 0, i;
  if (G.state === 'playing') { for (i = 0; i < L.length; i++) if (L[i].alive && !L[i].isBoss && L[i].state !== 'patrol') hot++; }
  combat += ((hot > 0 ? Math.min(1, 0.45 + hot * 0.12) : 0) - combat) * Math.min(1, real * (hot ? 2.5 : 0.5)); A.combat = combat;
  A.tense = G.state === 'playing' && JO.Player.hp < JO.Player.maxHp * 0.3;
  if (set && set.fps) { fpsN++; fpsAcc += real; if (real > worst) worst = real; fpsT -= real;
    if (fpsT <= 0) { fpsT = 0.5; var info = JO.World.renderer.info.render; fpsEl.textContent = Math.round(fpsN / Math.max(0.001, fpsAcc)) + ' FPS · ' + (worst * 1000).toFixed(0) + ' ms worst · ' + info.calls + ' draws · ' + Math.round(info.triangles / 1000) + 'k tris · ' + JO.Post.tier.toUpperCase(); fpsN = 0; fpsAcc = 0; worst = 0; } }
};

M.init = function () {
  fpsEl = $('fps'); M.apply();
  $('btnSetBack').addEventListener('click', function () { A.play('ui'); listening = null; JO.UI.show(M.back); });
  $('btnAchBack').addEventListener('click', function () { A.play('ui'); JO.UI.show('scrTitle'); });
  $('btnModesBack').addEventListener('click', function () { A.play('ui'); JO.UI.show('scrTitle'); });
  $('btnSettings').addEventListener('click', function () { A.init(); A.play('ui'); M.openSettings('scrTitle'); });
  $('btnPauseSettings').addEventListener('click', function () { A.play('ui'); M.openSettings('scrPause'); });
  $('btnAch').addEventListener('click', function () { A.init(); A.play('ui'); renderAch(); JO.UI.show('scrAch'); });
  $('btnModes').addEventListener('click', function () { A.init(); A.play('ui'); renderModes(); JO.UI.show('scrModes'); });
  window.addEventListener('keydown', function (e) {
    if (!listening) return; e.preventDefault(); e.stopImmediatePropagation();
    if (e.code !== 'Escape') M.bind(listening.act, e.code); listening = null; renderSettings(); }, true);
  wireAchievements();
  Ev.on('player_dead', function () { M.streak++; var G = JO.Game; G.refreshDiff(); if (M.streak === 2 && set.adaptive) JO.UI.toast('ADAPTIVE DIFFICULTY', 'The jungle eases off a little. (Settings can turn this off.)', '#58e0d0');
    if (G.mode === 'survival') Ev.emit('survival_over', M.wave); });
  Ev.on('checkpoint', function () { M.streak = 0; JO.Game.refreshDiff(); });
  Ev.on('level_complete', function () { M.streak = 0; JO.Game.refreshDiff(); });
  Ev.on('player_kill', function (head) { if (set.hitStop && !set.reduceShake) JO.Game.hitStop(head ? 0.07 : 0.04); });
  Ev.on('boss_phase', function () { if (set.hitStop && !set.reduceShake) JO.Game.hitStop(0.12); });
};
})();
