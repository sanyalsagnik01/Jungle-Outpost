/* ============================================================
   JUNGLE OUTPOST — audio.js
   Everything is synthesized with WebAudio: SFX, ambient bed
   (wind + insects from filtered noise) and a step-sequenced
   music loop that intensifies during boss fights.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO;
var A = JO.Audio = { ctx: null, muted: false, intensity: -1, volume: 1, musicVol: 1, combat: 0, tense: false };
var ctx, master, sfx, music, amb, vox, noiseBuf, droneGain, last = {};
var VOWELS = [730, 530, 390, 570, 440, 300, 640];

A.init = function () {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try { var C = window.AudioContext || window.webkitAudioContext; ctx = A.ctx = new C(); } catch (e) { return; }
  master = ctx.createGain(); master.gain.value = A.muted ? 0 : 0.8 * A.volume; master.connect(ctx.destination); A.master = master;
  sfx = ctx.createGain(); sfx.gain.value = 0.9; sfx.connect(master);
  music = ctx.createGain(); music.gain.value = 0.42 * A.musicVol; music.connect(master);
  amb = ctx.createGain(); amb.gain.value = 0.0; amb.connect(master);
  vox = ctx.createGain(); vox.gain.value = 1; vox.connect(master);
  var n = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
  var d = noiseBuf.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  A.buses = { master: master, sfx: sfx, music: music, amb: amb, vox: vox }; A.noiseBuf = noiseBuf;
  startAmbient(); startDrone(); JO.Events.emit('audio_ready');
  nextNote = ctx.currentTime + 0.1;
};

A.setMute = function (m) { A.muted = m; A.applyVolume(); };
A.applyVolume = function () { if (!master) return; master.gain.setTargetAtTime(A.muted ? 0 : 0.8 * A.volume, ctx.currentTime, 0.02); music.gain.setTargetAtTime(0.42 * A.musicVol, ctx.currentTime, 0.05); };

function tone(o) {
  var t = ctx.currentTime + (o.delay || 0), osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = o.type || 'square'; osc.frequency.setValueAtTime(o.f, t);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol), t + (o.a || 0.006));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(g); g.connect(o.dest || sfx); osc.start(t); osc.stop(t + o.dur + 0.05);
}
function noise(o) {
  var t = ctx.currentTime + (o.delay || 0), src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = noiseBuf; src.loop = true; f.type = o.type || 'lowpass'; f.Q.value = o.q || 0.8;
  f.frequency.setValueAtTime(o.f, t); if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol), t + (o.a || 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(f); f.connect(g); g.connect(o.dest || sfx); src.start(t, Math.random() * 1.5); src.stop(t + o.dur + 0.05);
}

var S = {
  ar: function (v) { noise({ dur: 0.1, vol: 0.5 * v, f: 3800, f2: 800 }); tone({ f: 190, f2: 60, dur: 0.08, vol: 0.28 * v }); },
  sg: function (v) { noise({ dur: 0.32, vol: 0.95 * v, f: 2400, f2: 250 }); tone({ f: 110, f2: 38, dur: 0.24, vol: 0.55 * v, type: 'sawtooth' }); },
  mr: function (v) { noise({ dur: 0.26, vol: 0.75 * v, f: 2600, f2: 600, type: 'bandpass', q: 0.6 }); tone({ f: 330, f2: 55, dur: 0.18, vol: 0.45 * v });
    noise({ dur: 0.5, vol: 0.2 * v, f: 500, f2: 120, delay: 0.05 }); },
  empty: function (v) { tone({ f: 950, dur: 0.03, vol: 0.2 * v }); },
  reload: function (v) { tone({ f: 1400, dur: 0.025, vol: 0.22 * v }); tone({ f: 850, dur: 0.035, vol: 0.22 * v, delay: 0.14 }); noise({ dur: 0.06, vol: 0.15 * v, f: 2500, delay: 0.14 }); },
  reloadEnd: function (v) { tone({ f: 700, f2: 1250, dur: 0.06, vol: 0.25 * v }); noise({ dur: 0.05, vol: 0.2 * v, f: 3000 }); },
  swap: function (v) { tone({ f: 500, f2: 800, dur: 0.05, vol: 0.18 * v, type: 'triangle' }); },
  step: function (v) { noise({ dur: 0.06, vol: 0.1 * v, f: 520 }); },
  splash: function (v) { noise({ dur: 0.14, vol: 0.14 * v, f: 1800, type: 'bandpass' }); },
  hit: function (v) { tone({ f: 1250, dur: 0.045, vol: 0.22 * v }); },
  head: function (v) { tone({ f: 1900, f2: 2700, dur: 0.07, vol: 0.34 * v, type: 'triangle' }); tone({ f: 2700, dur: 0.07, vol: 0.26 * v, type: 'triangle', delay: 0.06 }); },
  kill: function (v) { tone({ f: 620, f2: 240, dur: 0.14, vol: 0.25 * v, type: 'triangle' }); },
  hurt: function (v) { tone({ f: 170, f2: 75, dur: 0.2, vol: 0.5 * v, type: 'sawtooth' }); noise({ dur: 0.12, vol: 0.3 * v, f: 900 }); },
  armor: function (v) { tone({ f: 900, f2: 500, dur: 0.08, vol: 0.3 * v, type: 'triangle' }); noise({ dur: 0.06, vol: 0.25 * v, f: 4000, type: 'highpass' }); },
  explode: function (v) { noise({ dur: 0.8, vol: 1.0 * v, f: 1000, f2: 50 }); tone({ f: 95, f2: 28, dur: 0.55, vol: 0.9 * v, type: 'sine' }); },
  enemyShot: function (v) { noise({ dur: 0.08, vol: 0.32 * v, f: 2600, f2: 600 }); },
  sniperShot: function (v) { noise({ dur: 0.34, vol: 0.85 * v, f: 1800, f2: 350, type: 'bandpass', q: 0.5 }); tone({ f: 520, f2: 70, dur: 0.22, vol: 0.5 * v }); },
  laser: function (v) { tone({ f: 1300, f2: 480, dur: 0.1, vol: 0.2 * v, type: 'sawtooth' }); },
  beep: function (v) { tone({ f: 1050, dur: 0.08, vol: 0.28 * v }); },
  warn: function (v) { tone({ f: 880, dur: 0.1, vol: 0.32 * v }); tone({ f: 880, dur: 0.1, vol: 0.32 * v, delay: 0.16 }); tone({ f: 1175, dur: 0.14, vol: 0.32 * v, delay: 0.32 }); },
  roar: function (v) { tone({ f: 95, f2: 42, dur: 1.0, vol: 0.75 * v, type: 'sawtooth', a: 0.08 }); noise({ dur: 1.0, vol: 0.5 * v, f: 520, f2: 140, a: 0.08 }); },
  alert: function (v) { tone({ f: 420, f2: 640, dur: 0.12, vol: 0.16 * v, type: 'triangle' }); },
  slash: function (v) { noise({ dur: 0.13, vol: 0.4 * v, f: 2600, type: 'highpass' }); },
  windup: function (v) { tone({ f: 300, f2: 760, dur: 0.32, vol: 0.2 * v, type: 'triangle' }); },
  clang: function (v) { tone({ f: 2200, dur: 0.08, vol: 0.22 * v }); tone({ f: 3150, dur: 0.14, vol: 0.18 * v, type: 'triangle' }); },
  pickup: function (v) { tone({ f: 700, dur: 0.06, vol: 0.25 * v }); tone({ f: 1050, dur: 0.09, vol: 0.25 * v, delay: 0.07 }); },
  checkpoint: function (v) { tone({ f: 523, dur: 0.12, vol: 0.3 * v, type: 'triangle' }); tone({ f: 659, dur: 0.12, vol: 0.3 * v, type: 'triangle', delay: 0.12 });
    tone({ f: 784, dur: 0.25, vol: 0.3 * v, type: 'triangle', delay: 0.24 }); },
  teleport: function (v) { tone({ f: 1800, f2: 180, dur: 0.28, vol: 0.35 * v, type: 'sine' }); noise({ dur: 0.2, vol: 0.2 * v, f: 3500, type: 'highpass' }); },
  throw: function (v) { noise({ dur: 0.16, vol: 0.22 * v, f: 900, type: 'bandpass' }); },
  stomp: function (v) { tone({ f: 72, f2: 28, dur: 0.45, vol: 1.0 * v, type: 'sine' }); noise({ dur: 0.35, vol: 0.6 * v, f: 320 }); },
  charge: function (v) { tone({ f: 180, f2: 900, dur: 1.0, vol: 0.28 * v, type: 'sawtooth', a: 0.2 }); },
  missile: function (v) { noise({ dur: 0.55, vol: 0.4 * v, f: 1100, f2: 3200, type: 'bandpass' }); },
  minigun: function (v) { noise({ dur: 0.06, vol: 0.34 * v, f: 2000, f2: 500 }); tone({ f: 140, f2: 70, dur: 0.05, vol: 0.2 * v }); },
  spinup: function (v) { tone({ f: 120, f2: 620, dur: 0.75, vol: 0.25 * v, type: 'sawtooth', a: 0.1 }); },
  gas: function (v) { noise({ dur: 0.7, vol: 0.25 * v, f: 2400, f2: 700, type: 'bandpass', a: 0.1 }); },
  radio: function (v) { noise({ dur: 0.05, vol: 0.12 * v, f: 3200, type: 'bandpass', q: 2 }); tone({ f: 1500, dur: 0.03, vol: 0.08 * v, delay: 0.04 }); },
  ui: function (v) { tone({ f: 660, dur: 0.05, vol: 0.2 * v }); },
  jump: function (v) { noise({ dur: 0.1, vol: 0.12 * v, f: 700 }); },
  roll: function (v) { noise({ dur: 0.25, vol: 0.2 * v, f: 500, f2: 1400, type: 'bandpass' }); },
  gate: function (v) { tone({ f: 120, f2: 55, dur: 0.7, vol: 0.5 * v, type: 'sawtooth' }); noise({ dur: 0.6, vol: 0.3 * v, f: 400 }); },
  die: function (v) { tone({ f: 300, f2: 50, dur: 1.0, vol: 0.5 * v, type: 'sawtooth' }); },
  win: function (v) { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone({ f: f, dur: 0.3, vol: 0.3 * v, type: 'triangle', delay: i * 0.14 }); }); }
};

// later modules add their own sounds here
A.sounds = S; A.tone = function (o) { if (ctx) tone(o); }; A.noise = function (o) { if (ctx) noise(o); };
S.stepGrass = function (v) { noise({ dur: 0.09, vol: 0.08 * v, f: 900, f2: 400 }); };
S.stepStone = function (v) { noise({ dur: 0.04, vol: 0.12 * v, f: 2400, type: 'highpass' }); tone({ f: 160, dur: 0.03, vol: 0.05 * v, type: 'triangle' }); };
S.stepWood = function (v) { tone({ f: 190, f2: 120, dur: 0.06, vol: 0.14 * v, type: 'triangle' }); noise({ dur: 0.04, vol: 0.06 * v, f: 1200 }); };
// what is underfoot: arena stone, bridge planks, the dirt trail, or grass either side of it
A.surface = function (P) { var W = JO.World, x = P.pos.x, z = P.pos.z, L = W.level;
  if (L && L.river && z < L.river.z0 + 1 && z > L.river.z1 - 1 && Math.abs(x) < 2.6) return 'stepWood';
  if (z < W.A0 + 1) return 'stepStone';
  return Math.abs(x - Math.sin(z * 0.07) * 1.2) < 2.8 ? 'step' : 'stepGrass'; };
// footsteps: one place decides what a step sounds like (surface variants are added to A.surface later)
A.footstep = function (P, sprinting) { var s = P.inWater ? 'splash' : ((A.surface && A.surface(P)) || 'step'); A.play(s, (sprinting ? 1.3 : 1) * (P.crouch ? 0.4 : 1)); };
S.xb = function (v) { noise({ dur: 0.07, vol: 0.2 * v, f: 1400, type: 'bandpass' }); tone({ f: 240, f2: 120, dur: 0.09, vol: 0.2 * v, type: 'triangle' }); };
S.ft = function (v) { noise({ dur: 0.16, vol: 0.3 * v, f: 700, f2: 1600, type: 'bandpass', q: 0.5 }); };
A.play = function (name, vol) {
  if (!ctx || A.muted) return;
  var now = ctx.currentTime; if (last[name] && now - last[name] < 0.035) return; last[name] = now;
  try { S[name](vol === undefined ? 1 : vol); } catch (e) { /* audio is never fatal */ }
};
// short pitched blip: the stand-in for a voice line that has no audio file
A.blip = function (f, dur, vol, delay) { if (!ctx || A.muted) return; try { tone({ f: f, f2: f * 0.92, dur: dur || 0.05, vol: 0.09 * (vol === undefined ? 1 : vol), type: 'square', delay: delay || 0 }); } catch (e) { /* never fatal */ } };
// one synthesized syllable: a buzzy source through a vowel formant (or a headset band for radio speakers)
A.syllable = function (pitch, vol, radio) {
  if (!ctx || A.muted) return;
  try { var t = ctx.currentTime, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), d = 0.075 + Math.random() * 0.04;
    o.type = 'sawtooth'; o.frequency.setValueAtTime(pitch * (0.94 + Math.random() * 0.16), t); o.frequency.linearRampToValueAtTime(pitch * (0.86 + Math.random() * 0.2), t + d);
    f.type = 'bandpass'; f.frequency.value = radio ? 1500 + Math.random() * 500 : VOWELS[(Math.random() * VOWELS.length) | 0] * (pitch > 180 ? 1.25 : 1); f.Q.value = radio ? 1.6 : 3.5;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3 * (vol === undefined ? 1 : vol), t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(f); f.connect(g); g.connect(vox); o.start(t); o.stop(t + d + 0.03); } catch (e) { /* never fatal */ }
};
// positional falloff relative to the player
A.playAt = function (name, x, z, vol) {
  var P = JO.Player; if (!P) return A.play(name, vol);
  var d = Math.hypot(x - P.pos.x, z - P.pos.z), v = 1 - d / 70; if (v <= 0.02) return;
  A.play(name, (vol === undefined ? 1 : vol) * v * v);
};

/* ---------- ambient jungle bed ---------- */
function startAmbient() {
  var w = ctx.createBufferSource(); w.buffer = noiseBuf; w.loop = true;
  var wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 420;
  var wg = ctx.createGain(); wg.gain.value = 0.22;
  var lfo = ctx.createOscillator(); lfo.frequency.value = 0.13; var lg = ctx.createGain(); lg.gain.value = 0.12;
  lfo.connect(lg); lg.connect(wg.gain); w.connect(wf); wf.connect(wg); wg.connect(amb); w.start(); lfo.start();
  var ins = ctx.createBufferSource(); ins.buffer = noiseBuf; ins.loop = true;
  var bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 5400; bf.Q.value = 9;
  var ig = ctx.createGain(); ig.gain.value = 0.035;
  var tr = ctx.createOscillator(); tr.type = 'square'; tr.frequency.value = 17; var tg = ctx.createGain(); tg.gain.value = 0.03;
  tr.connect(tg); tg.connect(ig.gain); ins.connect(bf); bf.connect(ig); ig.connect(amb); ins.start(0, 0.7); tr.start(); A.insect = ig; A.wind = wg;
}
A.setAmbient = function (on) { if (ctx) amb.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.4); };

/* ---------- drone buzz (one shared voice, volume by nearest drone) ---------- */
function startDrone() {
  var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 118;
  var l = ctx.createOscillator(); l.frequency.value = 31; var lg = ctx.createGain(); lg.gain.value = 22; l.connect(lg); lg.connect(o.frequency);
  var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 1.5;
  droneGain = ctx.createGain(); droneGain.gain.value = 0; o.connect(f); f.connect(droneGain); droneGain.connect(sfx); o.start(); l.start();
}
A.setDrone = function (v) { if (ctx) droneGain.gain.setTargetAtTime(Math.min(0.16, v), ctx.currentTime, 0.1); };

/* ---------- music sequencer ---------- */
var nextNote = 0, stepN = 0, chirpT = 3;
var BASS = [55, 0, 55, 0, 65.4, 0, 55, 55, 49, 0, 49, 0, 41.2, 0, 49, 61.7];
var ARP = [220, 261.6, 329.6, 440, 329.6, 261.6, 392, 329.6, 196, 246.9, 293.7, 392, 164.8, 196, 246.9, 311.1];
A.setIntensity = function (i) { A.intensity = i; };
A.update = function (dt) {
  if (!ctx || A.muted) return;
  if (A.intensity < 0) { nextNote = ctx.currentTime + 0.1; return; }
  var boss = A.intensity >= 1, cb = A.combat || 0, sl = boss ? 0.17 : 0.27 - 0.07 * cb;
  if (nextNote < ctx.currentTime - 0.5) nextNote = ctx.currentTime + 0.05;
  while (nextNote < ctx.currentTime + 0.12) {
    var d = nextNote - ctx.currentTime, s = stepN % 16, b = BASS[s];
    if (boss) {
      tone({ f: b || BASS[(s + 15) % 16] || 55, dur: sl * 0.9, vol: 0.2, type: 'sawtooth', delay: d, dest: music });
      if (s % 4 === 0) tone({ f: 130, f2: 40, dur: 0.16, vol: 0.55, type: 'sine', delay: d, dest: music });
      if (s % 8 === 4) noise({ dur: 0.12, vol: 0.22, f: 1800, type: 'bandpass', delay: d, dest: music });
      noise({ dur: 0.03, vol: 0.06, f: 7000, type: 'highpass', delay: d, dest: music });
      tone({ f: ARP[s], dur: sl * 0.8, vol: 0.05, type: 'square', delay: d, dest: music });
    } else {
      // exploring: sparse. As enemies wake up (A.combat 0..1) a kick, snare and lead come in.
      if (cb > 0.3) { if (s % 4 === 0) tone({ f: 110, f2: 45, dur: 0.14, vol: 0.4 * cb, type: 'sine', delay: d, dest: music });
        if (s % 8 === 4) noise({ dur: 0.1, vol: 0.16 * cb, f: 1700, type: 'bandpass', delay: d, dest: music });
        if (cb > 0.6) tone({ f: ARP[(s * 3) % 16] * 0.5, dur: sl * 0.7, vol: 0.035 * cb, type: 'square', delay: d, dest: music }); }
      if (A.tense && s % 8 < 2) tone({ f: 58, f2: 40, dur: 0.12, vol: 0.5, type: 'sine', delay: d, dest: music });      // low health: a heartbeat under everything
      if (b) tone({ f: b, dur: sl * 1.6, vol: 0.2, type: 'triangle', delay: d, dest: music });
      if (s % 2 === 0) noise({ dur: 0.03, vol: 0.035, f: 6500, type: 'highpass', delay: d, dest: music });
      if (s === 12) tone({ f: 82, f2: 60, dur: 0.3, vol: 0.2, type: 'sine', delay: d, dest: music });
      if (s === 6 && (stepN >> 4) % 2 === 1) tone({ f: 329.6, dur: 0.5, vol: 0.035, type: 'sine', delay: d, dest: music });
    }
    stepN++; nextNote += sl;
  }
  // occasional bird / cricket chirp
  chirpT -= dt;
  if (chirpT <= 0 && !boss && !A.lifeOwned) { chirpT = 2.5 + Math.random() * 5; var f = 2200 + Math.random() * 1500;
    tone({ f: f, f2: f * 1.3, dur: 0.07, vol: 0.03, type: 'sine', dest: amb }); tone({ f: f * 1.1, f2: f * 1.4, dur: 0.07, vol: 0.03, type: 'sine', delay: 0.11, dest: amb }); }
};
})();
