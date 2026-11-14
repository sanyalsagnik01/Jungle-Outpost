/* ============================================================
   JUNGLE OUTPOST — sfx.js
   Recorded sound effects (generated with ElevenLabs, see
   audio/sfx/README.md). js/sfx.data.js holds them as base64 MP3,
   so they load from file:// as well as from a web server.
   Each effect has up to four takes; every play picks a different
   take with a slight pitch change. Any effect without a recording
   keeps its synthesized version from audio.js, and a decode
   failure never stops the game.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, A = JO.Audio, Ev = JO.Events;
var DATA = window.JO_SFX || {};
var F = JO.SFX = { buffers: {}, synth: {}, ready: false, loaded: 0, failed: 0, enabled: true, last: {} };

// loudness trim per effect (recordings are normalized to the same level when built)
var TRIM = { ar: 0.55, sg: 0.8, mr: 0.8, enemyShot: 0.5, sniperShot: 0.85, minigun: 0.5, spinup: 0.5, explode: 1.0, reload: 0.6, empty: 0.5, swap: 0.5,
  step: 0.35, stepGrass: 0.3, stepStone: 0.35, stepWood: 0.4, splash: 0.4, hit: 0.6, armor: 0.55, clang: 0.55, hurt: 0.7, die: 0.8, roar: 1.0, stomp: 1.0,
  slash: 0.6, windup: 0.5, throw: 0.5, missile: 0.7, gas: 0.5, gate: 0.8, jump: 0.4, roll: 0.45, charge: 0.6, teleport: 0.6, laser: 0.5, xb: 0.6, ft: 0.45 };
// rapid-fire sounds are cut short so overlapping shots stay clean (seconds)
var CAP = { ar: 0.45, minigun: 0.25, ft: 0.3, enemyShot: 0.6, step: 0.35, stepGrass: 0.35, stepStone: 0.3, stepWood: 0.35, splash: 0.4 };

function b64(s) { var bin = atob(s), n = bin.length, u = new Uint8Array(n); for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i); return u.buffer; }

function play(name, v) {
  var ctx = A.ctx, list = F.buffers[name]; if (!ctx || !list || !list.length) return false;
  var k = list.length > 1 ? (Math.random() * list.length) | 0 : 0; if (list.length > 1 && k === F.last[name]) k = (k + 1) % list.length; F.last[name] = k;
  var src = ctx.createBufferSource(), g = ctx.createGain(), t = ctx.currentTime, vol = (v === undefined ? 1 : v) * (TRIM[name] || 0.6);
  src.buffer = list[k]; src.playbackRate.value = 0.95 + Math.random() * 0.1;
  g.gain.setValueAtTime(vol, t); src.connect(g); g.connect(A.dest || A.buses.sfx);
  var cap = CAP[name]; if (cap && cap < src.buffer.duration) { g.gain.setValueAtTime(vol, t + cap * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + cap); src.stop(t + cap + 0.02); }
  src.start(t); return true;
}

function hook(name) {
  if (F.synth[name] || !A.sounds) return;
  var old = A.sounds[name]; F.synth[name] = old || function () {};
  A.sounds[name] = function (v) { if (!(F.enabled && play(name, v))) F.synth[name](v); };
}

var amb = null;
function startAmbience() {
  var ctx = A.ctx, list = F.buffers.amb_jungle; if (!ctx || !list || amb) return;
  var src = ctx.createBufferSource(), g = ctx.createGain(); src.buffer = list[0]; src.loop = true; g.gain.value = 0.32;
  src.connect(g); g.connect((A.buses && (A.buses.life || A.buses.amb)) || A.buses.master); src.start(); amb = { src: src, g: g };
}

F.load = function () {
  var ctx = A.ctx; if (!ctx || F.started) return; F.started = true;
  var names = Object.keys(DATA), pending = 0;
  names.forEach(function (name) {
    F.buffers[name] = [];
    DATA[name].forEach(function (s) {
      pending++;
      var done = function () { if (--pending === 0) { F.ready = true; startAmbience(); Ev.emit('sfx_ready', F.loaded); } };
      try {
        ctx.decodeAudioData(b64(s), function (buf) { F.buffers[name].push(buf); F.loaded++; if (name.indexOf('amb_') !== 0) hook(name); done(); },
          function () { F.failed++; done(); });
      } catch (e) { F.failed++; done(); }
    });
  });
};

if (A.ctx) F.load(); else Ev.on('audio_ready', F.load);
})();
