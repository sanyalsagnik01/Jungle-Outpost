/* ============================================================
   JUNGLE OUTPOST — story.js
   Story delivery, all driven by story.json (js/story.data.js):
   - dialogue box: portrait, speaker, typed subtitle, queue, skip
   - Juno comms + boss lines fired from gameplay events
   - enemy barks with cooldowns
   - comic-panel cutscenes (canvas art) between levels
   - boss intro camera moment and name card
   Voice files are optional: a line plays audio/voice/<id>.mp3
   when the build listed it, otherwise it types with radio blips.
   Nothing here ever blocks movement or calls a network API.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, CFG = JO.CFG, Ev = JO.Events, A = JO.Audio;
var D = window.JO_STORY || { speakers: {}, lines: [], cutscenes: {}, levels: [], barkVoices: {}, voiceFiles: [] };
var St = JO.Story = { data: D, queue: [], cur: null, voiceVol: 1, subSize: 1, enabled: true, cine: null, cutOpen: false };
var $ = function (id) { return document.getElementById(id); };
var byTrig = {}, byId = {}, fired = {}, coolAt = {}, voices = {}, el = {}, clock = 0, barkT = 0, barkCur = null, curAudio = null, portraits = {};
(D.voiceFiles || []).forEach(function (v) { voices[v] = true; });
D.lines.forEach(function (l) { (byTrig[l.trigger] || (byTrig[l.trigger] = [])).push(l); byId[l.id] = l; });
for (var k in byTrig) byTrig[k].sort(function (a, b) { return (a.seq || 0) - (b.seq || 0); });
(D.levels || []).forEach(function (l, i) { if (CFG.LEVELS[i]) { CFG.LEVELS[i].name = l.name; CFG.LEVELS[i].story = l.story; } });
St.hasVoice = function (id) { return !!voices[id]; };
St.line = function (id) { return byId[id]; };

/* ---------- portraits (drawn once per speaker) ---------- */
function portrait(key) {
  if (portraits[key]) return portraits[key];
  var sp = D.speakers[key] || {}, p = sp.portrait || {}, c = document.createElement('canvas'), g = c.getContext('2d'); c.width = c.height = 72;
  g.fillStyle = p.bg || '#223'; g.fillRect(0, 0, 72, 72);
  g.fillStyle = 'rgba(255,255,255,.06)'; for (var y = 0; y < 72; y += 4) g.fillRect(0, y, 72, 1);
  g.fillStyle = p.hatColor || '#333'; g.beginPath(); g.ellipse(36, 78, 30, 24, 0, 0, 6.3); g.fill();                 // shoulders
  if (p.hat === 'hood') { g.fillStyle = p.hatColor; g.beginPath(); g.ellipse(36, 36, 24, 28, 0, 0, 6.3); g.fill(); }
  if (p.hat === 'ponytail') { g.fillStyle = p.hair; g.beginPath(); g.ellipse(56, 40, 8, 20, 0.3, 0, 6.3); g.fill(); }
  g.fillStyle = p.skin || '#c96'; g.beginPath(); g.ellipse(36, 38, 16, 20, 0, 0, 6.3); g.fill();                      // head
  g.fillStyle = p.hair || '#222'; g.beginPath(); g.ellipse(36, 24, 17, 10, 0, Math.PI, 6.3); g.fill();
  g.fillStyle = p.hat === 'hood' ? '#58e0d0' : '#101010'; g.fillRect(27, 37, 5, 3); g.fillRect(40, 37, 5, 3);         // eyes
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(31, 49, 10, 2);
  g.fillStyle = p.hatColor || '#333';
  if (p.hat === 'beret') { g.beginPath(); g.ellipse(33, 20, 21, 9, -0.25, 0, 6.3); g.fill(); }
  else if (p.hat === 'helmet') { g.beginPath(); g.ellipse(36, 26, 19, 15, 0, Math.PI, 6.3); g.fill(); g.fillRect(17, 25, 38, 4); }
  else if (p.hat === 'cap') { g.fillRect(19, 14, 34, 11); g.fillRect(15, 24, 42, 4); g.fillStyle = '#d8b030'; g.fillRect(33, 16, 6, 5); }
  else if (p.hat === 'horns') { g.beginPath(); g.ellipse(36, 26, 19, 14, 0, Math.PI, 6.3); g.fill(); g.fillStyle = '#d8d0b8'; g.beginPath(); g.moveTo(18, 22); g.lineTo(8, 6); g.lineTo(24, 16); g.fill(); g.beginPath(); g.moveTo(54, 22); g.lineTo(64, 6); g.lineTo(48, 16); g.fill(); }
  else if (p.hat === 'headset') { g.strokeStyle = p.hatColor; g.lineWidth = 4; g.beginPath(); g.arc(36, 34, 19, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); g.fillRect(14, 32, 7, 13); g.fillRect(51, 32, 7, 13); g.lineWidth = 2; g.beginPath(); g.moveTo(18, 44); g.lineTo(30, 52); g.stroke(); }
  return (portraits[key] = c.toDataURL());
}

/* ---------- dialogue ---------- */
function stopAudio() { if (curAudio) { try { curAudio.pause(); } catch (e) { /* ignore */ } curAudio = null; } }
// voices are fetched ahead of time so a line's audio starts with its subtitle (a cold fetch could lag it by a second on the web)
var pre = {}, preQ = [], preBusy = false;
function preload(line, front) { if (!line || !voices[line.id] || pre[line.id]) return; if (front) preQ.unshift(line); else preQ.push(line); pumpPre(); }
function pumpPre() {
  if (preBusy || !preQ.length) return; var line = preQ.shift(); if (pre[line.id]) { pumpPre(); return; }
  preBusy = true; var au, done = false, fin = function () { if (done) return; done = true; preBusy = false; setTimeout(pumpPre, 30); };
  try { au = new Audio(); au.preload = 'auto'; au.addEventListener('canplaythrough', fin); au.addEventListener('error', fin); au.src = line.voice; au.load(); pre[line.id] = au; } catch (e) { fin(); return; }
  setTimeout(fin, 5000);
}
St.preloadLevel = function (i) {
  var first = [], rest = [], k, ls;
  for (k in byTrig) { ls = byTrig[k];
    if (k === 'level_start:' + i || k.indexOf('checkpoint:' + i + ':') === 0) first = first.concat(ls);
    else if (k.indexOf('bark:') !== 0) rest = rest.concat(ls); }
  for (k in byTrig) if (k.indexOf('bark:') === 0) rest = rest.concat(byTrig[k]);
  for (k = first.length - 1; k >= 0; k--) preload(first[k], true);
  rest.forEach(function (l) { preload(l); });
};
function playVoice(line, vol, onEnd, onErr, onStart) {
  if (!voices[line.id] || A.muted || St.voiceVol <= 0) return null;
  try { var au = pre[line.id];
    if (au && (au.paused || au.ended) && au.readyState > 0) { try { au.currentTime = 0; } catch (e) { /* not seekable yet */ } }
    else { au = new Audio(line.voice); if (!pre[line.id]) pre[line.id] = au; }
    au.volume = Math.max(0, Math.min(1, vol * St.voiceVol)); au.onended = onEnd || null; au.onerror = onErr || null; au.onplaying = onStart || null;
    var p = au.play(); if (p && p.catch) p.catch(function () { if (onErr) onErr(); }); return au; } catch (e) { return null; }
}
function show(line) {
  var sp = D.speakers[line.speaker] || { name: line.speaker.toUpperCase(), color: '#fff' };
  St.cur = { line: line, t: 0, shown: 0, len: line.text.length, hold: 1.5 + line.text.length * 0.028, voiced: false, ended: false, blipT: 0, blip: sp.blip || { pitch: 160, radio: 0 }, sylT: 0 };
  el.dlgName.textContent = sp.name; el.dlgName.style.color = sp.color; el.dlgPic.style.backgroundImage = 'url(' + portrait(line.speaker) + ')'; el.dlgPic.style.borderColor = sp.color;
  el.dlgText.textContent = ''; el.dlg.classList.remove('hidden');
  stopAudio(); var c = St.cur; curAudio = playVoice(line, 1, function () { c.ended = true; }, function () { c.voiced = false; c.wait = 0; }, function () { c.wait = 0; }); c.voiced = !!curAudio;
  c.wait = c.voiced && curAudio.readyState < 3 ? 0.9 : 0;          // hold the typing until the voice actually starts (at most 0.9 s)
  if (St.queue.length) preload(St.queue[0], true);
  if (A.play) A.play('radio', 0.5);
}
function next() { stopAudio(); St.cur = null; if (St.queue.length) show(St.queue.shift()); else el.dlg.classList.add('hidden'); }
St.say = function (lines, front) { if (!St.enabled || !lines) return; lines = lines.length === undefined ? [lines] : lines; for (var j = lines.length - 1; j >= 0; j--) preload(lines[j], true);
  if (front) St.queue = lines.concat(St.queue); else for (var i = 0; i < lines.length; i++) St.queue.push(lines[i]); if (!St.cur) next(); };
// fire a trigger: a sequence plays once per level load, variants pick one at random and obey their cooldown
St.trigger = function (trig, force) {
  var ls = byTrig[trig]; if (!ls || !St.enabled) return false;
  if (ls[0].seq) { if (fired[trig]) return false; fired[trig] = true; St.say(ls); return true; }
  if (!force && (St.cur || St.queue.length)) return false;
  if (coolAt[trig] && clock < coolAt[trig]) return false;
  if (!force && !ls[0].cooldown && fired[trig]) return false;
  fired[trig] = true; coolAt[trig] = clock + (ls[0].cooldown || 0); St.say(ls[(Math.random() * ls.length) | 0]); return true;
};
St.skip = function () { if (St.cine) { St.cine.t = 0; return true; } if (!St.cur) return false; if (St.cur.shown < St.cur.len) { St.cur.shown = St.cur.len; el.dlgText.textContent = St.cur.line.text; St.cur.t = Math.max(St.cur.t, St.cur.len / 45); } else next(); return true; };
St.clear = function () { St.queue.length = 0; stopAudio(); St.cur = null; if (el.dlg) el.dlg.classList.add('hidden'); if (el.bark) el.bark.style.opacity = 0; barkCur = null; };
St.reset = function () { St.clear(); fired = {}; St.endCine(); };
St.busy = function () { return !!(St.cur || St.queue.length); };
St.pause = function (on) { document.body.classList.toggle('paused', !!on); if (curAudio) { try { if (on) curAudio.pause(); else if (!curAudio.ended) curAudio.play().catch(function () {}); } catch (e) { /* ignore */ } } };

St.update = function (dt) {
  clock += dt; var c = St.cur;
  if (c && c.wait > 0) { c.wait -= dt; if (c.wait > 0) c = null; }
  if (c) { c.t += dt; var n = Math.min(c.len, (c.t * 45) | 0);
    if (n !== c.shown) { c.shown = n; el.dlgText.textContent = c.line.text.substr(0, n);
      if (!c.voiced && c.t > c.sylT && /[aeiouy]/i.test(c.line.text.charAt(n - 1))) { c.sylT = c.t + 0.07; A.syllable(c.blip.pitch, St.voiceVol, c.blip.radio); } }
    var done = c.voiced ? (c.ended ? (c.endT = (c.endT || 0) + dt) > 0.35 : c.t > c.len / 45 + c.hold + 9) : c.t > c.len / 45 + c.hold;
    if (done) next(); }
  if (barkCur) { barkCur.t -= dt; if (barkCur.t <= 0) { el.bark.style.opacity = 0; barkCur = null; } }
  if (barkT > 0) barkT -= dt;
};

/* ---------- enemy barks ---------- */
St.bark = function (event, e) {
  if (!St.enabled || barkT > 0 || !e || e.isBoss) return; var sp = D.barkVoices[e.type]; if (!sp) return;
  var key = 'bark:' + event, ls = byTrig[key]; if (!ls) return; if (coolAt[key] && clock < coolAt[key]) return;
  var mine = ls.filter(function (l) { return l.speaker === sp; }); if (!mine.length) mine = ls;
  var P = JO.Player, d = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z); if (d > 45) return;
  var line = mine[(Math.random() * mine.length) | 0]; coolAt[key] = clock + (line.cooldown || 8); barkT = 2.2;
  var vol = Math.max(0.15, 1 - d / 50); if (!playVoice(line, vol * 0.8)) { var bp = (D.speakers[sp] || {}).blip || { pitch: 130 }, ns = Math.min(5, 1 + (line.text.length / 6 | 0)); for (var q = 0; q < ns; q++) setTimeout(function () { A.syllable(bp.pitch, vol * 0.7 * St.voiceVol, 0); }, q * 95); }
  el.bark.textContent = 'SOLDIER: ' + line.text; el.bark.style.opacity = 1; barkCur = { t: 1.9 };
  UI().dmgNum(e.pos.x, e.pos.y + 2.3, e.pos.z, line.text, 'bark');
};
function UI() { return JO.UI; }

/* ---------- comic-panel cutscenes ---------- */
function rnd(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function sky(g, a, b, c) { var gr = g.createLinearGradient(0, 0, 0, 540); gr.addColorStop(0, a); gr.addColorStop(0.6, b); gr.addColorStop(1, c || b); g.fillStyle = gr; g.fillRect(0, 0, 960, 540); }
function disc(g, x, y, r, col, glow) { if (glow) { var gr = g.createRadialGradient(x, y, r * 0.3, x, y, r * 4); gr.addColorStop(0, glow); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r * 4, y - r * 4, r * 8, r * 8); } g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); }
function hills(g, col, y, amp, seed) { var r = rnd(seed), x; g.fillStyle = col; g.beginPath(); g.moveTo(0, 540); for (x = 0; x <= 960; x += 40) g.lineTo(x, y - amp * (0.3 + 0.7 * r()) * (0.6 + 0.4 * Math.sin(x * 0.01 + seed))); g.lineTo(960, 540); g.fill(); }
function trees(g, col, y, n, seed, h) { var r = rnd(seed); g.fillStyle = col; for (var i = 0; i < n; i++) { var x = r() * 960, hh = h * (0.6 + r() * 0.8), w = hh * 0.34; g.fillRect(x - 3, y - hh * 0.3, 6, hh * 0.3 + 40);
  for (var k = 0; k < 3; k++) { g.beginPath(); g.ellipse(x + (r() - 0.5) * w, y - hh * (0.45 + k * 0.22), w * (1 - k * 0.2), hh * 0.24, 0, 0, 6.3); g.fill(); } } }
function man(g, x, y, s, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y - 52 * s, 8 * s, 0, 6.3); g.fill(); g.fillRect(x - 8 * s, y - 44 * s, 16 * s, 26 * s); g.fillRect(x - 8 * s, y - 18 * s, 6 * s, 18 * s); g.fillRect(x + 2 * s, y - 18 * s, 6 * s, 18 * s); }
function rain(g, n, seed) { var r = rnd(seed); g.strokeStyle = 'rgba(200,220,255,.35)'; g.lineWidth = 1.5; g.beginPath(); for (var i = 0; i < n; i++) { var x = r() * 1000, y = r() * 540; g.moveTo(x, y); g.lineTo(x - 8, y + 26); } g.stroke(); }
var ART = {
  chopper: function (g) { sky(g, '#f2a65a', '#f7d9a0', '#cfe6b8'); disc(g, 700, 300, 46, '#fff3c8', 'rgba(255,220,150,.6)'); hills(g, '#6f9a66', 400, 90, 3); hills(g, '#3f6f3e', 450, 70, 7); trees(g, '#234a26', 520, 22, 5, 120);
    g.fillStyle = '#16201a'; g.beginPath(); g.ellipse(330, 190, 70, 26, -0.08, 0, 6.3); g.fill(); g.fillRect(380, 180, 110, 9); g.fillRect(482, 160, 8, 30); g.fillRect(300, 212, 70, 5); g.fillRect(310, 205, 4, 10); g.fillRect(356, 205, 4, 10);
    g.fillRect(200, 158, 260, 4); g.fillStyle = '#9fd0e8'; g.beginPath(); g.ellipse(292, 186, 22, 14, 0, 0, 6.3); g.fill(); },
  jungle: function (g) { sky(g, '#bfe6c8', '#8fcf96', '#3f8a4a'); trees(g, '#5aa860', 330, 16, 2, 200); trees(g, '#3b8246', 420, 18, 9, 240); trees(g, '#1f5a2c', 540, 14, 4, 320);
    g.fillStyle = '#a08656'; g.beginPath(); g.moveTo(400, 540); g.lineTo(470, 330); g.lineTo(500, 330); g.lineTo(600, 540); g.fill(); man(g, 486, 420, 1.1, '#17251a'); g.fillStyle = '#b3261a'; g.fillRect(476, 352, 20, 6); },
  radio: function (g) { sky(g, '#1b1410', '#3a2414', '#5a3a10'); g.fillStyle = '#0d0a08'; g.fillRect(0, 380, 960, 160); g.strokeStyle = '#ffb62e'; g.lineWidth = 3; for (var i = 1; i < 6; i++) { g.globalAlpha = 0.7 - i * 0.1; g.beginPath(); g.arc(640, 250, i * 44, -0.9, 0.9); g.stroke(); } g.globalAlpha = 1;
    g.fillStyle = '#0d0a08'; g.beginPath(); g.arc(360, 240, 78, 0, 6.3); g.fill(); g.fillRect(250, 310, 220, 240); g.strokeStyle = '#23281c'; g.lineWidth = 14; g.beginPath(); g.arc(360, 236, 88, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    g.fillStyle = '#23281c'; g.fillRect(262, 220, 26, 60); g.fillRect(432, 220, 26, 60); g.fillStyle = '#ffb62e'; for (i = 0; i < 9; i++) g.fillRect(60 + i * 22, 420 + (i % 3) * 14, 12, 8); },
  camera: function (g) { sky(g, '#3d2f22', '#5a4630', '#2e2418'); hills(g, '#241b12', 420, 30, 4); g.save(); g.translate(480, 330); g.rotate(-0.22); g.fillStyle = '#1c1c1c'; g.fillRect(-150, -80, 300, 170); g.fillStyle = '#2a2a2a'; g.fillRect(-150, -100, 90, 24);
    disc(g, 30, 5, 66, '#0e0e0e'); disc(g, 30, 5, 46, '#23405a'); disc(g, 30, 5, 22, '#0a1016'); g.strokeStyle = '#cfe6ff'; g.lineWidth = 2; g.beginPath(); g.moveTo(10, -30); g.lineTo(36, 4); g.lineTo(20, 14); g.lineTo(52, 44); g.moveTo(36, 4); g.lineTo(66, -10); g.stroke();
    g.fillStyle = '#ff3a2a'; g.fillRect(-130, -66, 14, 14); g.restore(); g.fillStyle = 'rgba(120,200,255,.12)'; g.fillRect(0, 0, 960, 540); },
  ruins: function (g) { sky(g, '#24465c', '#c98a5a', '#7ea8a2'); disc(g, 220, 250, 40, '#ffd0a0', 'rgba(255,170,110,.5)'); hills(g, '#345a52', 380, 80, 8); g.fillStyle = '#22383a'; for (var i = 0; i < 6; i++) { var x = 180 + i * 120, h = 150 + (i * 53 % 90); g.fillRect(x, 440 - h, 42, h); g.fillRect(x - 8, 440 - h, 58, 14); }
    g.fillRect(120, 430, 720, 30); g.fillRect(90, 458, 780, 30); g.fillRect(60, 486, 840, 54); g.fillStyle = 'rgba(190,220,215,.28)'; g.fillRect(0, 360, 960, 70); g.fillRect(0, 440, 960, 30); },
  bloom: function (g) { sky(g, '#06100e', '#0c2220', '#06100e'); disc(g, 480, 250, 60, '#c8fff0', 'rgba(88,224,208,.75)'); g.fillStyle = '#58e0d0'; for (var i = 0; i < 9; i++) { g.save(); g.translate(480, 250); g.rotate(i * 0.698); g.beginPath(); g.ellipse(0, -92, 26, 64, 0, 0, 6.3); g.fill(); g.restore(); }
    disc(g, 480, 250, 34, '#fff8d0'); g.strokeStyle = '#1f6b55'; g.lineWidth = 12; g.beginPath(); g.moveTo(480, 330); g.quadraticCurveTo(450, 430, 490, 540); g.stroke(); var r = rnd(6); g.fillStyle = 'rgba(160,255,230,.7)'; for (i = 0; i < 70; i++) g.fillRect(r() * 960, r() * 540, 3, 3); },
  river: function (g) { sky(g, '#7ea8a2', '#b8d8c8', '#4a7a6a'); hills(g, '#3a6a58', 300, 70, 5); trees(g, '#24503f', 330, 16, 3, 150); var gr = g.createLinearGradient(0, 330, 0, 470); gr.addColorStop(0, '#5fb0c0'); gr.addColorStop(1, '#2a6a80'); g.fillStyle = gr; g.fillRect(0, 330, 960, 140);
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; var r = rnd(8); for (var i = 0; i < 26; i++) { var x = r() * 900, y = 340 + r() * 120; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 40 + r() * 40, y); g.stroke(); }
    g.fillStyle = '#2a2018'; g.fillRect(0, 470, 960, 70); g.fillStyle = '#4a3a2c'; g.fillRect(380, 300, 200, 16); for (i = 0; i < 5; i++) g.fillRect(388 + i * 46, 316, 10, 60); },
  outpost: function (g) { sky(g, '#0b0812', '#2a1420', '#40190e'); disc(g, 760, 110, 30, '#e8e0d0', 'rgba(230,220,255,.25)'); g.fillStyle = 'rgba(255,240,180,.16)'; g.beginPath(); g.moveTo(250, 250); g.lineTo(700, 0); g.lineTo(860, 0); g.fill(); g.beginPath(); g.moveTo(700, 250); g.lineTo(60, 0); g.lineTo(240, 0); g.fill();
    g.fillStyle = '#17120f'; g.fillRect(0, 330, 960, 210); g.fillRect(210, 230, 70, 110); g.fillRect(670, 230, 70, 110); g.fillRect(195, 216, 100, 22); g.fillRect(655, 216, 100, 22); g.fillRect(400, 270, 160, 70); g.fillStyle = '#ff9a60'; g.fillRect(232, 250, 14, 14); g.fillRect(694, 250, 14, 14); g.fillRect(430, 290, 20, 26); g.fillRect(510, 290, 20, 26);
    g.fillStyle = '#0d0a08'; for (var i = 0; i < 24; i++) g.fillRect(i * 40, 318, 20, 16); },
  storm: function (g) { sky(g, '#05060c', '#141a2a', '#0a0c12'); g.strokeStyle = '#eaf2ff'; g.lineWidth = 5; g.beginPath(); g.moveTo(600, 0); g.lineTo(560, 120); g.lineTo(610, 150); g.lineTo(540, 300); g.stroke(); g.fillStyle = 'rgba(200,220,255,.12)'; g.fillRect(0, 0, 960, 540);
    g.fillStyle = '#0c0d10'; g.fillRect(0, 380, 960, 160); g.fillRect(330, 200, 300, 190); g.fillStyle = '#05060a'; g.fillRect(410, 260, 140, 130); g.fillStyle = '#ff4a3a'; g.fillRect(356, 226, 12, 12); g.fillRect(592, 226, 12, 12); man(g, 480, 500, 1.4, '#000'); rain(g, 260, 3); },
  fire: function (g) { sky(g, '#2a0a04', '#c2410c', '#ffb62e'); var r = rnd(4); for (var i = 0; i < 40; i++) { var x = r() * 960, h = 120 + r() * 300; g.fillStyle = 'rgba(255,' + ((120 + r() * 120) | 0) + ',40,.5)'; g.beginPath(); g.moveTo(x - 40, 540); g.quadraticCurveTo(x - 10, 540 - h * 0.6, x, 540 - h); g.quadraticCurveTo(x + 14, 540 - h * 0.5, x + 40, 540); g.fill(); }
    disc(g, 480, 300, 50, '#fff', 'rgba(255,255,255,.7)'); g.fillStyle = '#120604'; g.fillRect(0, 490, 960, 50); man(g, 300, 500, 1.3, '#120604'); man(g, 350, 500, 1.15, '#120604'); },
  dawn: function (g) { sky(g, '#5aa8ff', '#ffd9a0', '#ffe9c0'); disc(g, 480, 360, 70, '#fff6d8', 'rgba(255,230,170,.8)'); hills(g, '#7fb07a', 420, 60, 2); hills(g, '#3f7a44', 470, 50, 6); g.fillStyle = '#5fb0c0'; g.fillRect(0, 430, 960, 16);
    man(g, 400, 520, 1.2, '#16241a'); man(g, 470, 520, 1.05, '#16241a'); man(g, 540, 520, 1.25, '#16241a'); disc(g, 548, 470, 7, '#58e0d0', 'rgba(88,224,208,.8)'); }
};
function drawArt(key) { var g = el.cutArt.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; (ART[key] || ART.jungle)(g);
  var v = g.createRadialGradient(480, 270, 200, 480, 270, 620); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)'); g.fillStyle = v; g.fillRect(0, 0, 960, 540); }
var cut = null;
function cutShow() { var p = cut.panels[cut.i]; drawArt(p.art); el.cutArt.className = ''; void el.cutArt.offsetWidth; el.cutArt.className = 'pan' + (cut.i % 3); el.cutCap.textContent = ''; cut.t = 0; cut.text = p.caption;
  el.cutN.textContent = (cut.i + 1) + ' / ' + cut.panels.length; el.cutPanel.style.transform = 'rotate(' + (cut.i % 2 ? 0.6 : -0.6) + 'deg)'; }
function cutEnd() { if (!cut) return; var cb = cut.done; cut = null; St.cutOpen = false; el.cut.classList.add('hidden'); if (cb) cb(); }
St.cutscene = function (id, done) {
  var panels = D.cutscenes[id]; if (!panels || !St.enabled || St.noCut) { if (done) done(); return; }
  cut = { panels: panels, i: 0, t: 0, text: '', done: done }; St.cutOpen = true; St.clear(); el.cut.classList.remove('hidden'); cutShow();
  try { el.cutNext.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
};
St.cutNext = function () { if (!cut) return; if (cut.t * 40 < cut.text.length) { cut.t = 999; return; } cut.i++; if (cut.i >= cut.panels.length) cutEnd(); else { cutShow(); A.play('ui'); } };
St.cutSkip = function () { cutEnd(); };
St.cutUpdate = function (dt) { if (!cut) return; cut.t += dt; var n = Math.min(cut.text.length, (cut.t * 40) | 0); if (el.cutCap.textContent.length !== n) el.cutCap.textContent = cut.text.substr(0, n);
  if (cut.t > cut.text.length / 40 + 6.5) St.cutNext(); };

/* ---------- boss intro: camera moment + name card ---------- */
var TAGS = { brute: 'WARLORD OF THE FIRST RIDGE', phantom: 'SGT. E. REYES — UNDER THE BLOOM', commander: 'KEEPER OF THE LUMEN BLOOM' };
St.startCine = function (boss) { var P = JO.Player, dx = P.pos.x - boss.pos.x, dz = P.pos.z - boss.pos.z, d = Math.hypot(dx, dz) || 1;
  St.cine = { t: 3.2, max: 3.2, boss: boss, dx: dx / d, dz: dz / d, h: boss.kind === 'commander' ? 4.2 : 1.9, r: boss.kind === 'commander' ? 15 : 7.5 };
  el.cardName.textContent = boss.name; el.cardTag.textContent = TAGS[boss.kind] || ''; document.body.classList.add('cine'); el.card.classList.remove('hidden'); el.card.classList.remove('in'); void el.card.offsetWidth; el.card.classList.add('in'); };
St.endCine = function () { St.cine = null; document.body.classList.remove('cine'); if (el.card) el.card.classList.add('hidden'); };
// called from the frame loop while a cine is active; returns false when it is over
St.cineCamera = function (cam, real) { var c = St.cine; if (!c) return false; c.t -= real; if (c.t <= 0) { St.endCine(); return false; }
  var k = 1 - c.t / c.max, r = c.r * (1 - 0.22 * k), a = (k - 0.5) * 0.5, cs = Math.cos(a), sn = Math.sin(a), x = c.dx * cs - c.dz * sn, z = c.dx * sn + c.dz * cs;
  cam.position.set(c.boss.pos.x + x * r, c.h * 0.75 + k * 0.4, c.boss.pos.z + z * r); cam.lookAt(c.boss.pos.x, c.h, c.boss.pos.z); if (cam.fov !== 50) { cam.fov = 50; cam.updateProjectionMatrix(); } return true; };

/* ---------- wiring ---------- */
var seenType = {}, headT = [], killT = [], lowT = 0;
St.init = function () {
  ['dlg', 'dlgName', 'dlgPic', 'dlgText', 'bark', 'cut', 'cutArt', 'cutCap', 'cutN', 'cutNext', 'cutSkip', 'cutPanel', 'card', 'cardName', 'cardTag'].forEach(function (id) { el[id] = $(id); });
  el.cutNext.addEventListener('click', function () { A.init(); St.cutNext(); }); el.cutSkip.addEventListener('click', function () { A.init(); A.play('ui'); St.cutSkip(); });
  el.dlg.addEventListener('click', St.skip);
  window.addEventListener('keydown', function (e) { if (e.repeat) return;
    if (cut) { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); St.cutNext(); } else if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); St.cutSkip(); } }
    else if (e.code === 'Enter' && (JO.Game.state === 'playing' || JO.Game.state === 'finale' || JO.Game.state === 'win')) St.skip(); }, true);
  Ev.on('level_load', function (i) { St.reset(); St.preloadLevel(i | 0); seenType = {}; headT.length = killT.length = 0; });
  Ev.on('level_start', function (i) { St.trigger('level_start:' + i); });
  Ev.on('checkpoint', function (l, i) { St.trigger('checkpoint:' + l + ':' + i); });
  Ev.on('boss_start', function (b, first) { if (first) { St.clear(); St.startCine(b); } St.trigger('boss_intro:' + b.kind); });
  Ev.on('boss_phase', function (b, n) { St.clear(); St.trigger('boss_phase:' + b.kind + ':' + n); });
  Ev.on('boss_stun', function (b) { St.trigger('boss_stun:' + b.kind); });
  Ev.on('boss_beaten', function (b) { St.clear(); St.trigger('boss_beaten:' + b.kind); }); Ev.on('boss_spared', function (b) { St.clear(); St.trigger('boss_spared:' + b.kind); });
  Ev.on('boss_dying', function (b) { St.clear(); fired['boss_death:' + b.kind] = false; St.trigger('boss_death:' + b.kind); });
  Ev.on('enemy_alert', function (e) { if (!seenType[e.type]) { seenType[e.type] = true; if (St.trigger('first:' + e.type)) return; } St.bark('alert', e); });
  Ev.on('enemy_hurt', function (e) { if (Math.random() < 0.25) St.bark('hurt', e); });
  Ev.on('enemy_die', function (e) { var L = JO.Enemies.list; for (var i = 0; i < L.length; i++) { var o = L[i]; if (o !== e && o.alive && !o.isBoss && o.state !== 'patrol' && Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 14) { St.bark(killT.length >= 3 ? 'panic' : 'ally_down', o); break; } } });
  Ev.on('enemy_throw', function (e) { St.bark('throw', e); }); Ev.on('enemy_retreat', function (e) { St.bark('retreat', e); });
  Ev.on('enemy_charge', function (e) { St.bark('charge', e); }); Ev.on('enemy_aim', function (e) { St.bark('aim', e); });
  Ev.on('player_kill', function (head) { var now = clock; killT.push(now); while (killT.length && now - killT[0] > 7) killT.shift();
    if (head) { headT.push(now); while (headT.length && now - headT[0] > 12) headT.shift(); if (headT.length >= 3) { headT.length = 0; St.trigger('headshot_streak'); return; } }
    if (killT.length >= 5) { killT.length = 0; St.trigger('kill_streak'); } });
  Ev.on('player_hurt', function () { var P = JO.Player; if (P.hp > 0 && P.hp < P.maxHp * 0.3 && clock > lowT) { lowT = clock + 5; St.trigger('low_health'); } });
  Ev.on('dodge', function () { St.trigger('near_miss'); });
  Ev.on('player_dead', function () { St.clear(); St.trigger('player_dead', true); });
};
})();
