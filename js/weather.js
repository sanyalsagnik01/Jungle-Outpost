/* ============================================================
   JUNGLE OUTPOST — weather.js
   Time of day and weather. Each level starts at its own hour
   and the clock keeps moving; rain, fog banks and thunderstorms
   come and go on top of it. Both change what the fight is like:
     - visibility: fog, rain and darkness shorten enemy sight
       (JO.Stealth.vis) and pull the fog in for the player too
     - sound: rain soaks up footsteps and gunfire
       (JO.Stealth.hear); a thunderclap covers anything
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, W = JO.World, A = JO.Audio, Ev = JO.Events;
var Wx = JO.Weather = { hour: 12, rain: 0, fog: 0, storm: 0, flash: 0, thunder: 0, state: 'clear', label: '', quality: 1, enabled: true };
// per level: starting hour, how fast the clock runs (game hours per minute) and the weather it cycles through
var PLAN = [
  { hour: 6.2, rate: 0.9, seq: ['clear', 'clear', 'rain', 'clear', 'fog'] },
  { hour: 17.2, rate: 0.5, seq: ['fog', 'rain', 'fog', 'storm', 'fog'] },
  { hour: 21.5, rate: 0.35, seq: ['clear', 'storm', 'rain', 'storm', 'clear'] }];
var TARGET = { clear: [0, 0, 0], rain: [0.8, 0.25, 0], fog: [0, 1, 0], storm: [1, 0.45, 1] };
var base = null, plan = PLAN[0], seqI = 0, stateT = 0, boltT = 6, rainMesh = null, rainPos = null, RN = 1100, rainGain = null, rainSrc = null,
  c1 = new THREE.Color(), c2 = new THREE.Color(), NIGHT = new THREE.Color(0x0a1022), lastLabel = '', labelEl = null;

// 0 at deep night, 1 at midday
function daylight(h) { var x = Math.cos((h - 13) / 24 * Math.PI * 2); return Math.max(0, Math.min(1, 0.5 + x * 0.75)); }
function hourName(h) { return h < 5 ? 'NIGHT' : (h < 7.5 ? 'DAWN' : (h < 16.5 ? 'DAY' : (h < 19.5 ? 'DUSK' : 'NIGHT'))); }

function capture() {
  var f = W.scene.fog, L = W.lights; if (!f || !L) return;
  base = { fog: f.color.getHex(), near: f.near, far: f.far, sun: L.sun.intensity, hemi: L.hemi.intensity, light: daylight(plan.hour) };
}
Wx.setState = function (s, instant) { Wx.state = s; stateT = 35 + Math.random() * 30; if (instant) { var t = TARGET[s]; Wx.rain = t[0]; Wx.fog = t[1]; Wx.storm = t[2]; } Ev.emit('weather', s); };
function onLevel(idx) {
  plan = PLAN[idx] || PLAN[0]; Wx.hour = plan.hour; seqI = 0; Wx.flash = 0; Wx.thunder = 0; boltT = 5 + Math.random() * 6; capture();
  Wx.setState(JO.Game.mode === 'bossrush' ? 'clear' : plan.seq[0], true);
}

function buildRain() {
  var g = new THREE.BufferGeometry(); rainPos = new Float32Array(RN * 6);
  for (var i = 0; i < RN; i++) seed(i, true);
  g.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  rainMesh = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xbfd6e6, transparent: true, opacity: 0.0, depthWrite: false, fog: false }));
  rainMesh.frustumCulled = false; rainMesh.renderOrder = 6; rainMesh.visible = false; W.scene.add(rainMesh);
}
function seed(i, any) {
  var cam = W.camera.position, o = i * 6, x = cam.x + (Math.random() - 0.5) * 44, z = cam.z + (Math.random() - 0.5) * 44, y = any ? Math.random() * 20 : 16 + Math.random() * 6;
  rainPos[o] = x; rainPos[o + 1] = y; rainPos[o + 2] = z; rainPos[o + 3] = x + 0.12; rainPos[o + 4] = y + 0.75; rainPos[o + 5] = z;
}
// steady rain bed: looped noise through a band-pass, volume follows the weather
function rainAudio(v) {
  var ctx = A.ctx; if (!ctx) return;
  if (!rainGain) { try { var n = ctx.sampleRate * 2, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      rainSrc = ctx.createBufferSource(); rainSrc.buffer = buf; rainSrc.loop = true; var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 0.4;
      rainGain = ctx.createGain(); rainGain.gain.value = 0; rainSrc.connect(f); f.connect(rainGain); rainGain.connect(A.master || ctx.destination); rainSrc.start(); } catch (e) { rainGain = null; return; } }
  rainGain.gain.setTargetAtTime(A.muted ? 0 : v, ctx.currentTime, 0.3);
}

/* per rendered frame. dt is game time (0 while paused), real is wall time. */
Wx.update = function (dt, real) {
  if (!base || !W.scene.fog) return;
  var G = JO.Game, playing = G.state === 'playing' || G.state === 'dying', k = Math.min(1, dt * 0.35), t = TARGET[Wx.state], L = W.lights, f = W.scene.fog, i;
  if (!Wx.enabled) t = TARGET.clear;
  if (playing) { Wx.hour = (Wx.hour + dt * plan.rate / 60) % 24; stateT -= dt;
    if (stateT <= 0 && !G.bossFight && G.mode !== 'bossrush') { seqI = (seqI + 1) % plan.seq.length; Wx.setState(plan.seq[seqI]); } }
  Wx.rain += (t[0] - Wx.rain) * k; Wx.fog += (t[1] - Wx.fog) * k; Wx.storm += (t[2] - Wx.storm) * k;

  // lightning: a flash now, thunder a moment later
  if (Wx.flash > 0) Wx.flash = Math.max(0, Wx.flash - real * 3.2);
  if (Wx.thunder > 0) Wx.thunder -= dt;
  if (playing && Wx.storm > 0.5) { boltT -= dt;
    if (boltT <= 0) { boltT = 7 + Math.random() * 11; Wx.flash = JO.Game.reduceFlash ? 0.35 : 1; Wx.thunder = 1.6; Ev.emit('lightning');
      if (A.ctx && !A.muted) { A.noise({ dur: 1.9, vol: 0.9, f: 420, f2: 60, delay: 0.25 + Math.random() * 0.5, a: 0.03 }); A.tone({ f: 70, f2: 30, dur: 1.4, vol: 0.5, type: 'sine', delay: 0.3 }); } } }

  // light and fog
  var day = daylight(Wx.hour), rel = base.light > 0.05 ? Math.max(0.35, Math.min(1.5, (0.25 + day) / (0.25 + base.light))) : 1, wet = 1 - 0.3 * Wx.rain - 0.15 * Wx.fog;
  L.sun.intensity = base.sun * rel * wet + Wx.flash * 1.4; L.hemi.intensity = base.hemi * (0.6 + 0.4 * rel) * (1 - 0.15 * Wx.rain) + Wx.flash * 1.1;
  c1.setHex(base.fog); if (rel < 1) c1.lerp(NIGHT, (1 - rel) * 0.8); c2.setHex(0x8f9aa2); c1.lerp(c2, 0.35 * Wx.rain + 0.3 * Wx.fog); if (Wx.flash > 0) c1.lerp(c2.setHex(0xdfe8ff), Wx.flash * 0.7);
  f.color.copy(c1); if (W.scene.background && W.scene.background.isColor) W.scene.background.copy(c1);
  var pull = 1 - 0.5 * Wx.fog - 0.2 * Wx.rain; f.near = base.near * (1 - 0.6 * Wx.fog); f.far = Math.max(34, base.far * pull);
  if (W.domeMat) { var dk = Math.max(0.3, Math.min(1.15, rel)) * (1 - 0.3 * Wx.rain - 0.25 * Wx.fog) + Wx.flash; W.domeMat.color.setRGB(dk, dk, Math.min(1.3, dk * 1.04)); }

  // what the weather does to the fight
  var dark = 1 - Math.max(0, Math.min(1, (0.25 + day) / 0.75));
  JO.Stealth.vis = Math.max(0.5, 1 - 0.3 * Wx.fog - 0.15 * Wx.rain - 0.18 * dark) + (Wx.flash > 0.4 ? 0.3 : 0);
  JO.Stealth.hear = Wx.thunder > 0 ? 0.3 : 1 - 0.4 * Wx.rain;

  // rain streaks follow the camera
  var on = Wx.rain > 0.03 && Wx.quality > 0; rainMesh.visible = on;
  if (on) { var n = Math.floor(RN * Math.min(1, Wx.rain * 1.2) * (Wx.quality > 1 ? 1 : 0.5)), fall = 26 * (dt > 0 ? dt : real * 0.4), cam = W.camera.position;
    for (i = 0; i < n; i++) { var o = i * 6; rainPos[o + 1] -= fall; rainPos[o + 4] -= fall; rainPos[o] -= fall * 0.16; rainPos[o + 3] -= fall * 0.16;
      if (rainPos[o + 1] < 0 || Math.abs(rainPos[o] - cam.x) > 23 || Math.abs(rainPos[o + 2] - cam.z) > 23) seed(i, false); }
    rainMesh.geometry.setDrawRange(0, n * 2); rainMesh.geometry.attributes.position.needsUpdate = true; rainMesh.material.opacity = 0.2 + 0.28 * Wx.rain; }
  rainAudio(playing ? Wx.rain * 0.16 : 0);

  var label = hourName(Wx.hour) + (Wx.storm > 0.5 ? ' · STORM' : (Wx.rain > 0.4 ? ' · RAIN' : (Wx.fog > 0.5 ? ' · FOG' : '')));
  Wx.label = label; if (labelEl && label !== lastLabel) { lastLabel = label; labelEl.textContent = label; }
};
Wx.init = function () { labelEl = document.getElementById('hudWx'); buildRain(); Ev.on('level_load', onLevel); };
})();
