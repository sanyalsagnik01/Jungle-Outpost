/* ============================================================
   JUNGLE OUTPOST — stealth.js
   How enemies notice the player before a fight starts:
   vision cones that fill an awareness meter, noise (footsteps,
   gunfire, blasts) that draws attention, a short delay before an
   alerted enemy raises everyone nearby, and silent takedowns
   from behind. Once an enemy is alerted the normal combat AI in
   enemies.js takes over.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, E = JO.Enemies, Ev = JO.Events, A = JO.Audio, FX = JO.FX;
var S = JO.Stealth = { vis: 1, hear: 1, meter: 0, target: null, spottedT: 0 };
var el = null, fill = null, label = null, lastTxt = '';

// multiplier on every enemy's sight range (weather and time of day write S.vis)
S.sightK = function () { return S.vis; };

// called for each patrolling enemy every logic step; true means "I have seen him"
S.detect = function (e, dt) {
  var P = JO.Player; if (P.dead) return false;
  var Sq = JO.Squad, ex = Sq ? Sq.exposure() : 1, K = E.sightK, range = e.cfg.sight * K * (P.crouch ? 0.6 : 1) * Math.max(0.85, Math.min(1.3, ex)), rate = 0;
  if (e.see && e.dist < range) {
    var dot = Math.sin(e.yaw) * e.ndx + Math.cos(e.yaw) * e.ndz, half = e.type === 'drone' ? -2 : (e.type === 'sniper' ? 0.64 : 0.45);
    if (dot > half) rate = (2.6 - 2.1 * e.dist / range) * (P.crouch ? 0.6 : 1) * (P.driving ? 3 : 1) * ex * (e.actK || 1);      // lit or lamp in hand: easier to see; a man off duty notices less
  }
  if (e.dist < (P.crouch ? 1.0 : 2.8) * K && Math.abs(P.pos.y - e.pos.y) < 2.5) rate = Math.max(rate, 6);      // walked into him
  var was = e.aware || 0; e.aware = Math.max(0, Math.min(1, was + (rate > 0 ? rate : -0.3) * dt));
  if (was < 0.35 && e.aware >= 0.35) { JO.UI.dmgNum(e.pos.x, e.pos.y + 2.3, e.pos.z, '?', 'blk'); A.playAt('beep', e.pos.x, e.pos.z, 0.5); }
  if (rate > 0) e.yaw = E.turnToward(e.yaw, Math.atan2(e.ndx, e.ndz), dt * 1.5 * e.aware);                       // turns to look as suspicion grows
  return e.aware >= 1;
};
// an enemy has just gone to alert: he needs a moment to raise the others (kill him first and nobody hears)
S.onAlert = function (e) {
  e.aware = 1; e.shoutT = 1.0; JO.Game.run.alerts = (JO.Game.run.alerts || 0) + 1; S.spottedT = 4;
  JO.UI.dmgNum(e.pos.x, e.pos.y + 2.3, e.pos.z, '!', 'crit'); Ev.emit('spotted', e);
};
function onNoise(x, z, r, kind) {
  var L = E.list, P = JO.Player; r *= S.hear;
  for (var i = 0; i < L.length; i++) { var e = L[i]; if (e.isBoss || !e.alive || e.state !== 'patrol') continue;
    var d = Math.hypot(e.pos.x - x, e.pos.z - z); if (d > r) continue;
    if (kind === 'step') { e.aware = Math.min(0.95, (e.aware || 0) + 0.3 * (1 - d / r)); e.yaw = E.turnToward(e.yaw, Math.atan2(x - e.pos.x, z - e.pos.z), 0.5); }
    else e.alerted = true; }
  if (kind !== 'step' && P) S.loudT = 1.5;
}
// the enemy a takedown would hit right now, or null
function candidate() {
  var P = JO.Player, L = E.list, best = null, bd = 2.5;
  if (P.dead || P.driving) return null;
  for (var i = 0; i < L.length; i++) { var e = L[i]; if (e.isBoss || !e.alive || !e.active || e.state !== 'patrol' || e.type === 'drone' || Math.abs(e.pos.y - P.pos.y) > 1) continue;
    if (e.dist > bd) continue;
    if (Math.sin(e.yaw) * e.ndx + Math.cos(e.yaw) * e.ndz > 0.25) continue;                                      // he is facing you
    bd = e.dist; best = e; }
  return best;
}
S.takedown = function (e) {
  var P = JO.Player, G = JO.Game;
  G.run.takedowns = (G.run.takedowns || 0) + 1; G.run.knockouts = (G.run.knockouts || 0) + 1;
  FX.burst(e.pos.x, e.pos.y + 1.3, e.pos.z, 6, 0xffffff, 2.5, 0.25, 0, 0.1); JO.UI.dmgNum(e.pos.x, e.pos.y + 2.1, e.pos.z, 'TAKEDOWN', 'head'); A.play('slash', 0.5);
  if (P.gfx) P.gfx.playOnce('attack'); e.shoutT = 0; e.hp = 0; e.die(); JO.UI.hitmarker('kill'); Ev.emit('takedown', e); Ev.emit('player_kill', false);
};

S.update = function (dt) {
  var L = E.list, I = JO.Input, G = JO.Game, m = 0, near = false, i;
  for (i = 0; i < L.length; i++) { var e = L[i]; if (e.isBoss || !e.alive) continue;
    if (e.shoutT > 0) { e.shoutT -= dt; if (e.shoutT <= 0) { E.alertNear(e.pos.x, e.pos.z, 24); A.playAt('alert', e.pos.x, e.pos.z, 1.4); } }
    if (e.state === 'patrol') { if (e.dist < 50) near = true; if ((e.aware || 0) > m) m = e.aware; } }
  if (S.spottedT > 0) S.spottedT -= dt;
  S.meter = m; S.near = near; S.target = G.bossFight ? null : candidate();
  if (S.target && !G.hint) G.hint = I.isTouch ? 'TAP <kbd>USE</kbd> — SILENT TAKEDOWN' : 'PRESS <kbd>F</kbd> — SILENT TAKEDOWN';
  if (S.target && (I.meleePressed || (I.isTouch && I.interactPressed))) S.takedown(S.target);
};
// per rendered frame: the awareness meter under the boss bar
S.hud = function () {
  if (!el) return; var G = JO.Game, show = S.near && !G.bossFight && G.state === 'playing';
  var txt = !show ? '' : (S.spottedT > 0 ? 'SPOTTED' : (S.meter > 0.35 ? 'SUSPICIOUS' : (JO.Player.crouch ? 'HIDDEN — CROUCHED' : 'UNSEEN')));
  if (txt !== lastTxt) { lastTxt = txt; el.classList.toggle('hidden', !txt); label.textContent = txt; el.className = (txt ? '' : 'hidden ') + (S.spottedT > 0 ? 'hot' : (S.meter > 0.35 ? 'warm' : '')); }
  if (txt) fill.style.transform = 'scaleX(' + (S.spottedT > 0 ? 1 : S.meter).toFixed(2) + ')';
};
S.init = function () {
  el = document.getElementById('stealth'); fill = document.getElementById('stealthFill'); label = document.getElementById('stealthTxt');
  Ev.on('noise', onNoise);
  Ev.on('level_load', function () { S.meter = 0; S.spottedT = 0; S.target = null; });
};
})();
