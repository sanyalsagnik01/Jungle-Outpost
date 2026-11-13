/* ============================================================
   JUNGLE OUTPOST — sound.js
   Where a sound is, and what the place does to it.
     - positional voices: every world sound gets a stereo
       position, a distance, and a muffled tone when cover
       stands between you and it (occlusion)
     - spaces: open jungle, stone ruins and the walled arena
       each have their own reverb; the mix crossfades as you
       move between them
     - dynamic mix: music and ambience duck under heavy gunfire
       and under Juno's voice
     - a blast close by leaves your ears ringing and the world
       muffled for a few seconds
     - low health: your own heartbeat, faster as it gets worse
   All of it is built from WebAudio nodes on top of audio.js.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, A = JO.Audio, W = JO.World, Q = JO.Q, Ev = JO.Events;
var So = JO.Sound = { ready: false, voices: [], played: 0, occluded: 0, space: 'jungle', heat: 0, ring: 0, muffle: 0, beats: 0, duck: 1, lastPan: 0, lastCut: 0 };
var ctx, lp, send, musicDuck, ambDuck, ringGain, ringOsc, next = 0, spaces = {}, beatT = 0, SPACE = { jungle: [0.7, 0.13], stone: [1.7, 0.3], arena: [2.3, 0.36], yard: [1.2, 0.22] };

function impulse(sec) { var n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate); for (var c = 0; c < 2; c++) { var d = b.getChannelData(c); for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6) * (i < 400 ? i / 400 : 1); } return b; }
function wire() {
  if (So.ready || !A.ctx || !A.buses) return; ctx = A.ctx; var B = A.buses, i, k;
  try {
    // sfx -> lowpass (muffle) -> master, with a send to the reverbs
    lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000; B.sfx.disconnect(); B.sfx.connect(lp); lp.connect(B.master);
    send = ctx.createGain(); send.gain.value = 1; lp.connect(send);
    for (k in SPACE) { var cv = ctx.createConvolver(); cv.buffer = impulse(SPACE[k][0]); var g = ctx.createGain(); g.gain.value = 0; send.connect(cv); cv.connect(g); g.connect(B.master); spaces[k] = { g: g, wet: SPACE[k][1] }; }
    // music and ambience pass through gains this module can duck
    musicDuck = ctx.createGain(); B.music.disconnect(); B.music.connect(musicDuck); musicDuck.connect(B.master);
    ambDuck = ctx.createGain(); B.amb.disconnect(); B.amb.connect(ambDuck); ambDuck.connect(B.master);
    // positional voices: pan -> tone -> level
    for (i = 0; i < 20; i++) { var pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null, f = ctx.createBiquadFilter(), vg = ctx.createGain(); f.type = 'lowpass'; f.frequency.value = 20000;
      if (pan) { pan.connect(f); } f.connect(vg); vg.connect(B.sfx); So.voices.push({ input: pan || f, pan: pan, f: f, g: vg }); }
    // tinnitus
    ringOsc = ctx.createOscillator(); ringOsc.type = 'sine'; ringOsc.frequency.value = 3900; ringGain = ctx.createGain(); ringGain.gain.value = 0; ringOsc.connect(ringGain); ringGain.connect(B.master); ringOsc.start();
    A.sfxLP = lp; So.ready = true;
  } catch (e) { So.ready = false; if (window.console) console.warn('[sound] advanced audio unavailable', e); }
}
// audio.js hands every positional sound here. Returns true when it was handled.
So.playAt = function (name, x, z, vol) {
  var P = JO.Player, Cam = JO.Cam; if (!P || !Cam) return false;
  var dx = x - P.pos.x, dz = z - P.pos.z, d = Math.hypot(dx, dz), v = 1 - d / 70; if (v <= 0.02) return true;
  v = v * v * (vol === undefined ? 1 : vol); So.played++;
  // occlusion: something solid between the listener's head and the source
  var cut = 20000, occ = false;
  if (d > 3) { var hy = P.pos.y + 1.5, l = Math.sqrt(dx * dx + dz * dz + 0.09); if (W.raycast(P.pos.x, hy, P.pos.z, dx / l, -0.3 / l, dz / l, l) < l - 1.2) { occ = true; cut = 950; v *= 0.62; So.occluded++; } }
  var pan = d > 0.5 ? Math.max(-1, Math.min(1, (dx * Cam.rx + dz * Cam.rz) / d)) * Math.min(1, d / 6) : 0, back = d > 0.5 ? (dx * Cam.fx + dz * Cam.fz) / d : 1;
  if (back < 0 && !occ) cut = 20000 - 13000 * -back;                                   // behind you: a little duller
  So.lastPan = pan; So.lastCut = cut; So.lastOcc = occ; So.lastVol = v;
  if (!So.ready || A.muted) { A.play(name, v); return true; }
  var n = Math.max(4, Math.min(So.voices.length, Q.n('voices'))), vc = So.voices[next % n], t = ctx.currentTime; next++;
  if (vc.pan) vc.pan.pan.setValueAtTime(pan, t); vc.f.frequency.setValueAtTime(cut, t); vc.g.gain.setValueAtTime(v, t);
  A.dest = vc.input; A.play(name, 1); A.dest = null; return true;
};
// A.muffle(k): k 0..1 closes the world's high end (blasts, low health)
A.muffle = function (k) { So.muffle = Math.max(So.muffle, k); };
function spaceNow() { var P = JO.Player, G = JO.Game, L = W.level; if (!P || !L) return 'jungle'; if (P.pos.z < W.A0 + 2) return 'arena'; if (L.boss === 'commander') return 'yard'; if (L.river) return 'stone'; return 'jungle'; }

JO.Sys.add('sound', {
  init: function () {
    Ev.on('audio_ready', wire); wire(); A.heartOwned = true;
    A.sounds.heart = function (v) { A.tone({ f: 62, f2: 40, dur: 0.11, vol: 0.75 * v, type: 'sine', dest: A.buses && A.buses.master }); A.tone({ f: 54, f2: 36, dur: 0.13, vol: 0.55 * v, type: 'sine', delay: 0.19, dest: A.buses && A.buses.master }); };
    Ev.on('noise', function (x, z, r, kind) { if (kind !== 'step' && (r || 0) > 12) So.heat = Math.min(1, So.heat + 0.09); });
    Ev.on('blast', function (x, z, r) { var P = JO.Player, d = Math.hypot(x - P.pos.x, z - P.pos.z), reach = (r || 4) * 1.9; So.heat = Math.min(1, So.heat + 0.5); if (d < reach) { var k = 1 - d / reach; So.muffle = Math.max(So.muffle, 0.35 + 0.65 * k); if (Q.on('tinnitus') && k > 0.25) { So.ring = Math.max(So.ring, k); So.rings = (So.rings | 0) + 1; } } });
    Ev.on('level_load', function () { So.heat = 0; So.ring = 0; So.muffle = 0; });
  },
  frame: function (dt, real) {
    var G = JO.Game, P = JO.Player, St = JO.Story, playing = G.state === 'playing', k = Math.min(1, real * 3);
    if (So.heat > 0) So.heat = Math.max(0, So.heat - real * 0.22); if (So.ring > 0) So.ring = Math.max(0, So.ring - real * 0.3); if (So.muffle > 0) So.muffle = Math.max(0, So.muffle - real * 0.28);
    var low = playing && !P.dead && P.hp < P.maxHp * 0.3 ? 1 - P.hp / (P.maxHp * 0.3) : 0;
    // heartbeat: 70 to 130 a minute
    if (low > 0 && dt > 0) { beatT -= real; if (beatT <= 0) { beatT = 60 / (70 + 60 * low); So.beats++; A.play('heart', 0.6 + 0.4 * low); } } else beatT = 0.2;
    So.space = Q.n('reverb') > 0 ? spaceNow() : 'none';
    var talk = St && St.cur ? 1 : 0, duck = 1 - 0.45 * So.heat - 0.3 * talk; So.duck += (duck - So.duck) * k;
    if (!So.ready) return; var t = ctx.currentTime;
    for (var n in spaces) spaces[n].g.gain.setTargetAtTime(n === So.space && playing ? spaces[n].wet : 0, t, 0.35);
    musicDuck.gain.setTargetAtTime(Math.max(0.3, So.duck), t, 0.12); ambDuck.gain.setTargetAtTime(Math.max(0.2, 1 - 0.7 * So.heat - 0.2 * talk), t, 0.15);
    var m = Math.max(So.muffle, low * 0.45); lp.frequency.setTargetAtTime(20000 * Math.pow(0.035, m), t, 0.08);
    ringGain.gain.setTargetAtTime(A.muted ? 0 : So.ring * So.ring * 0.05 * A.volume, t, 0.1);
  }
});
})();
