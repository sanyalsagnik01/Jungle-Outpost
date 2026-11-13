/* ============================================================
   JUNGLE OUTPOST — ambience.js
   The jungle's voice. Each level has a cast of synthesized
   animal calls that changes with the hour (birdsong at dawn,
   cicadas at midday, frogs at dusk, crickets and owls at night).
   Gunfire and explosions shut the whole cast up: Am.level drops
   to zero and only creeps back 20-40 seconds after the last
   shot, so a quiet jungle means somebody has been shooting.
   Wildlife events (a flock taking off, a monkey leaping, a fish
   jumping) get their own small sounds.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, A = JO.Audio, Ev = JO.Events, Q = JO.Q;
var Am = JO.Ambience = { level: 1, hush: 0, calls: 0, last: '', bucket: 'day' };
var life = null, nextT = 1.5, lvl = 0, cicadaT = 0;

// per level, per time of day: [call, weight] pairs and the mean gap between calls in seconds
var PROFILE = [
  { dawn: { gap: 1.3, cast: [['song', 5], ['trill', 3], ['parrot', 1], ['howler', 0.6]] }, day: { gap: 2.2, cast: [['song', 3], ['parrot', 2], ['cicada', 2], ['trill', 1]] },
    dusk: { gap: 2.4, cast: [['trill', 2], ['frog', 2], ['cricket', 3], ['howler', 0.5]] }, night: { gap: 2.8, cast: [['cricket', 5], ['owl', 1], ['frog', 2]] } },
  { dawn: { gap: 2.0, cast: [['trill', 3], ['frog', 3], ['song', 1]] }, day: { gap: 2.6, cast: [['frog', 2], ['trill', 2], ['cicada', 1], ['parrot', 1]] },
    dusk: { gap: 1.7, cast: [['frog', 6], ['cricket', 3], ['owl', 0.6], ['heron', 0.7]] }, night: { gap: 2.0, cast: [['frog', 4], ['cricket', 4], ['owl', 1]] } },
  { dawn: { gap: 3.5, cast: [['cricket', 3], ['song', 1]] }, day: { gap: 4, cast: [['cicada', 2], ['parrot', 1]] },
    dusk: { gap: 3.2, cast: [['cricket', 4], ['owl', 1]] }, night: { gap: 3.6, cast: [['cricket', 5], ['owl', 1.2], ['dog', 0.5]] } }];

function bus() {
  if (life || !A.ctx || !A.buses) return life;
  life = A.ctx.createGain(); life.gain.value = 1; life.connect(A.buses.amb); A.buses.life = life; return life;
}
function T(o) { o.dest = life; A.tone(o); }
function N(o) { o.dest = life; A.noise(o); }
var r = Math.random;
// every call takes a loudness 0..1 (how far away it sounds)
var CALL = {
  song: function (v) { var f = 2400 + r() * 1800, n = 3 + (r() * 3 | 0); for (var i = 0; i < n; i++) T({ f: f * (1 + 0.12 * Math.sin(i * 2.1)), f2: f * (1.15 + 0.2 * r()), dur: 0.06 + r() * 0.05, vol: 0.05 * v, type: 'sine', delay: i * 0.11 }); },
  trill: function (v) { var f = 3200 + r() * 1400, n = 7 + (r() * 6 | 0); for (var i = 0; i < n; i++) T({ f: f, f2: f * 0.9, dur: 0.03, vol: 0.035 * v, type: 'sine', delay: i * 0.045 }); },
  parrot: function (v) { for (var i = 0; i < 2; i++) T({ f: 950 + r() * 200, f2: 620, dur: 0.16, vol: 0.03 * v, type: 'sawtooth', delay: i * 0.24, a: 0.02 }); },
  howler: function (v) { for (var i = 0; i < 4; i++) T({ f: 210 + i * 14, f2: 150, dur: 0.36, vol: 0.05 * v, type: 'sawtooth', delay: i * 0.42, a: 0.08 }); },
  cicada: function (v) { N({ dur: 1.6 + r() * 1.6, vol: 0.05 * v, f: 4600 + r() * 900, type: 'bandpass', q: 14, a: 0.5 }); },
  frog: function (v) { var f = 260 + r() * 160, n = 2 + (r() * 3 | 0); for (var i = 0; i < n; i++) T({ f: f, f2: f * 0.8, dur: 0.08, vol: 0.06 * v, type: 'square', delay: i * 0.17 }); },
  cricket: function (v) { var f = 4100 + r() * 500; for (var i = 0; i < 3; i++) T({ f: f, dur: 0.028, vol: 0.03 * v, type: 'sine', delay: i * 0.06 }); },
  owl: function (v) { T({ f: 390, f2: 350, dur: 0.3, vol: 0.06 * v, type: 'sine', a: 0.05 }); T({ f: 370, f2: 320, dur: 0.5, vol: 0.06 * v, type: 'sine', delay: 0.45, a: 0.06 }); },
  heron: function (v) { T({ f: 520, f2: 300, dur: 0.3, vol: 0.04 * v, type: 'sawtooth', a: 0.03 }); },
  dog: function (v) { for (var i = 0; i < 2; i++) { T({ f: 330, f2: 210, dur: 0.11, vol: 0.035 * v, type: 'sawtooth', delay: i * 0.3 }); N({ dur: 0.1, vol: 0.02 * v, f: 900, type: 'bandpass', delay: i * 0.3 }); } },
  // reactions
  wings: function (v) { for (var i = 0; i < 7; i++) N({ dur: 0.05, vol: 0.07 * v, f: 1400 + r() * 900, type: 'bandpass', q: 1.2, delay: i * 0.07 + r() * 0.03 }); CALL.parrot(v * 0.9); },
  screech: function (v) { for (var i = 0; i < 3; i++) T({ f: 900 + r() * 300, f2: 1500, dur: 0.1, vol: 0.05 * v, type: 'sawtooth', delay: i * 0.13 }); }
};
Am.CALL = CALL;
function bucketOf(h) { return h < 5 ? 'night' : (h < 8 ? 'dawn' : (h < 16.5 ? 'day' : (h < 19.5 ? 'dusk' : 'night'))); }
function pick(cast) { var tot = 0, i; for (i = 0; i < cast.length; i++) tot += cast[i][1]; var x = r() * tot; for (i = 0; i < cast.length; i++) { x -= cast[i][1]; if (x <= 0) return cast[i][0]; } return cast[0][0]; }
Am.play = function (name, v) { Am.calls++; Am.last = name; if (!A.ctx || A.muted || !bus()) return; try { CALL[name](v === undefined ? 1 : v); } catch (e) { /* audio is never fatal */ } };
// a loud noise: silence now, and for a while
Am.silence = function () { var t = 14 + r() * 18; if (t > Am.hush) Am.hush = t; };
function dist(x, z) { var P = JO.Player; return P ? Math.hypot(x - P.pos.x, z - P.pos.z) : 0; }

JO.Sys.add('ambience', {
  init: function () {
    A.lifeOwned = true;                                              // the old random chirp in audio.js stands down
    Ev.on('noise', function (x, z, rad, kind) { if (kind !== 'step' && (rad || 0) > 10) Am.silence(); });
    Ev.on('blast', function () { Am.silence(); Am.hush += 6; });
    Ev.on('level_load', function (i) { lvl = i; Am.level = 1; Am.hush = 0; nextT = 2; });
    Ev.on('wildlife', function (kind, x, z) { if (!Q.on('ambience')) return; var v = Math.max(0, 1 - dist(x, z) / 60);
      if (kind === 'birds') Am.play('wings', v); else if (kind === 'monkey') Am.play('screech', v * 0.9); else if (kind === 'fish' && v > 0.3) A.playAt('splash', x, z, 0.7); });
  },
  frame: function (dt, real) {
    var G = JO.Game, Wx = JO.Weather, on = Q.on('ambience'), playing = G.state === 'playing';
    if (A.combat > 0.3 && Am.hush < 8) Am.hush = 8;                   // a firefight counts as noise even when the player is not the one shooting
    if (Am.hush > 0 && dt > 0) Am.hush -= dt;
    var want = !on || Am.hush > 0 || G.bossFight ? 0 : 1; Am.level += (want - Am.level) * Math.min(1, dt * (want ? 0.125 : 4)); if (want && Am.level > 0.995) Am.level = 1;
    var h = Wx ? Wx.hour : 12, b = Am.bucket = bucketOf(h), night = b === 'night' ? 1 : (b === 'dusk' ? 0.6 : 0.15), rain = Wx ? Wx.rain : 0;
    // the steady insect bed in audio.js rises at night and dips with the life level
    if (A.ctx && A.insect) A.insect.gain.setTargetAtTime(0.012 + 0.05 * night * (0.25 + 0.75 * Am.level) * (1 - rain * 0.6), A.ctx.currentTime, 0.5);
    if (A.ctx && A.wind && JO.Foliage) A.wind.gain.setTargetAtTime(0.16 + 0.14 * Math.min(2, JO.Foliage.wind), A.ctx.currentTime, 0.8);
    if (!playing || dt <= 0) return;
    nextT -= dt; if (nextT > 0) return;
    var prof = (PROFILE[lvl] || PROFILE[0])[b]; nextT = prof.gap * (0.5 + r()) * (1 + rain * 1.5);
    if (Am.level < 0.08 || r() > Am.level) return;                    // a half-recovered jungle calls half as often
    Am.play(pick(prof.cast), (0.35 + r() * 0.65) * Am.level * (1 - rain * 0.5));
  }
});
})();
