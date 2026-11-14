/* ============================================================
   JUNGLE OUTPOST — music.js
   Situation-based soundtrack from recorded tracks in audio/music/
   (all CC0, see audio/music/README.md).
   One main theme (title screen, field bench, endings) plus a
   track for each situation: exploring each level, tension after
   guards start investigating, open combat, each boss, and short
   victory / defeat stings. Tracks crossfade over about two
   seconds. They play through <audio> elements so they also work
   from file://. If no track can be loaded, the synthesized music
   sequencer in audio.js keeps playing as before.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, A = JO.Audio, Ev = JO.Events;
var BASE = 'audio/music/';
var TRACKS = { main: 0.85, explore1: 0.7, explore2: 0.8, explore3: 0.7, stealth: 0.75, combat: 0.7,
  boss_brute: 0.75, boss_phantom: 0.75, boss_commander: 0.7, win: 0.8, lose: 0.8 };
var STINGS = { win: 1, lose: 1 };
var M = JO.Music = { enabled: true, ready: false, current: null, want: null, tenseT: 0, stingT: 0, els: {}, failed: 0, loaded: 0 };
var FADE = 2.0;

function el(name) {
  if (M.els[name]) return M.els[name];
  var a = new Audio(); a.preload = 'auto'; a.loop = !STINGS[name]; a.src = BASE + name + '.mp3'; a.volume = 0; a._v = 0;
  a.addEventListener('canplaythrough', function () { if (!a._ok) { a._ok = true; M.loaded++; M.ready = true; } });
  a.addEventListener('error', function () { a._bad = true; M.failed++; });
  M.els[name] = a; return a;
}

function level() { var G = JO.Game; return G ? (G.levelIdx | 0) + 1 : 1; }

// what should be playing right now
function situation() {
  var G = JO.Game; if (!G) return 'main';
  if (M.stingT > 0) return M.sting;
  var s = G.state;
  if (s === 'title' || s === 'bench' || s === 'win' || s === 'ending' || !s) return 'main';
  if (s === 'dead' || s === 'dying') return 'lose';
  if (G.bossFight && G.boss) { var k = G.boss.kind || (JO.World.level && JO.World.level.boss); return M.els['boss_' + k] && !M.els['boss_' + k]._bad ? 'boss_' + k : 'combat'; }
  if ((A.combat || 0) > 0.35) return 'combat';
  if (M.tenseT > 0) return 'stealth';
  return 'explore' + Math.min(3, level());
}

function target(a, name) {
  var vol = A.muted ? 0 : (A.musicVol === undefined ? 1 : A.musicVol) * (A.volume === undefined ? 1 : A.volume) * (TRACKS[name] || 0.7) * 0.55;
  var G = JO.Game; if (G && G.state === 'paused') vol *= 0.35;
  return vol;
}

M.update = function (dt) {
  if (!M.enabled || !A.ctx) return;
  M.tenseT = Math.max(0, M.tenseT - dt); M.stingT = Math.max(0, M.stingT - dt);
  var want = situation(), w = el(want);
  if (w._bad) want = null;
  // nothing playable: give the synthesized sequencer back
  A.seqOff = !!(want && w._ok);
  if (want !== M.current && want && (w._ok || !w._started)) {
    if (w.paused) { if (!STINGS[want]) { try { w.currentTime = 0; } catch (e) {} } var p = w.play(); w._started = true; if (p && p.catch) p.catch(function () {}); }
    M.current = want;
  }
  Object.keys(M.els).forEach(function (n) {
    var a = M.els[n], goal = n === M.current ? target(a, n) : 0;
    a._v += Math.max(-dt / FADE, Math.min(dt / FADE, goal - a._v)); a._v = Math.max(0, Math.min(1, a._v));
    try { a.volume = a._v; } catch (e) {}
    if (a._v <= 0.001 && n !== M.current && !a.paused) a.pause();
  });
};

function sting(name, sec) { M.sting = name; M.stingT = sec; var a = el(name); try { a.currentTime = 0; } catch (e) {} }

Ev.on('investigate', function () { M.tenseT = Math.max(M.tenseT, 14); });
Ev.on('spotted', function () { M.tenseT = Math.max(M.tenseT, 18); });
Ev.on('level_complete', function () { sting('win', 4); });
Ev.on('ending', function () { sting('win', 4); });
Ev.on('player_dead', function () { sting('lose', 6); });

// warm up the tracks once audio is unlocked (first click)
function prime() { Object.keys(TRACKS).forEach(el); }
if (A.ctx) prime(); else Ev.on('audio_ready', prime);
})();
