/* ============================================================
   JUNGLE OUTPOST — input.js
   Keyboard + mouse (pointer lock) and touch (virtual joystick,
   look area, action buttons). Exposes a polled state plus
   one-step "pressed" edges that the game clears after each step.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO;
var I = JO.Input = {
  moveX: 0, moveY: 0, fire: false, ads: false, sprint: false,
  jumpPressed: false, rollPressed: false, reloadPressed: false, interactPressed: false, meleePressed: false, nadePressed: false, smokePressed: false, benchPressed: false, weapon: 0,
  locked: false, isTouch: false, keys: {}, joy: { x: 0, y: 0 }, external: false,
  onLook: null, onPause: null, onLockLost: null, onMute: null, onCanvasClick: null
};
var K = I.keys, canvas, intentional = false, fireEnd = false;   // fireEnd: release is applied after a logic step, so a quick tap still fires

I.init = function (cv) {
  canvas = cv;
  window.addEventListener('keydown', function (e) {
    var c = e.code;
    if (c === 'Space' || c === 'Tab' || c.indexOf('Arrow') === 0 || (e.ctrlKey && JO.Game && JO.Game.state === 'playing')) e.preventDefault();
    if (e.repeat) return;
    K[c] = true;
    if (c === 'Space') I.jumpPressed = true;
    else if (c === 'KeyC' || c === 'ControlLeft' || c === 'ControlRight') I.rollPressed = true;
    else if (c === 'KeyR') I.reloadPressed = true;
    else if (c === 'KeyE') I.interactPressed = true;
    else if (c === 'KeyF') I.meleePressed = true;
    else if (c === 'KeyJ') { if (I.onCodex) I.onCodex(); }
    else if (c === 'Digit1' || c === 'Numpad1') I.weapon = 1;
    else if (c === 'Digit2' || c === 'Numpad2') I.weapon = 2;
    else if (c === 'Digit3' || c === 'Numpad3') I.weapon = 3;
    else if (c === 'Digit4' || c === 'Numpad4') I.weapon = 4;
    else if (c === 'Digit5' || c === 'Numpad5') I.weapon = 5;
    else if (c === 'KeyG') I.nadePressed = true;
    else if (c === 'KeyQ') I.smokePressed = true;
    else if (c === 'KeyB') I.benchPressed = true;
    else if (c === 'Escape' || c === 'KeyP') { if (I.onPause) I.onPause(); }
    else if (c === 'KeyM') { if (I.onMute) I.onMute(); }
  });
  window.addEventListener('keyup', function (e) { K[e.code] = false; });
  window.addEventListener('blur', function () { for (var k in K) K[k] = false; I.fire = false; I.ads = false; });

  canvas.addEventListener('mousedown', function (e) {
    if (I.isTouch) return;
    if (!I.locked) { if (I.onCanvasClick) I.onCanvasClick(); return; }
    if (e.button === 0) { I.fire = true; fireEnd = false; } else if (e.button === 2) I.ads = true;
  });
  window.addEventListener('mouseup', function (e) { if (e.button === 0) fireEnd = true; else if (e.button === 2) I.ads = false; });
  window.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('mousemove', function (e) {
    if (I.locked && I.onLook) I.onLook(e.movementX || 0, e.movementY || 0);
  });
  document.addEventListener('pointerlockchange', function () {
    var was = I.locked; I.locked = document.pointerLockElement === canvas;
    if (was && !I.locked) { I.fire = false; I.ads = false; if (!intentional && I.onLockLost) I.onLockLost(); }
    if (!I.locked) intentional = false;
  });
  document.addEventListener('pointerlockerror', function () { I.locked = false; });
  setupTouch();
};

I.requestLock = function () {
  if (I.isTouch || !canvas.requestPointerLock) return;
  try { var p = canvas.requestPointerLock(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* ignored */ }
};
I.exitLock = function () { if (document.pointerLockElement && document.exitPointerLock) { intentional = true; document.exitPointerLock(); } };

I.poll = function () {
  if (I.external) return;                       // a test bot is driving
  var x = 0, y = 0;
  if (K.KeyW || K.ArrowUp) y += 1; if (K.KeyS || K.ArrowDown) y -= 1;
  if (K.KeyD || K.ArrowRight) x += 1; if (K.KeyA || K.ArrowLeft) x -= 1;
  x += I.joy.x; y += I.joy.y;
  I.moveX = x; I.moveY = y;
  I.sprint = !!(K.ShiftLeft || K.ShiftRight) || Math.hypot(I.joy.x, I.joy.y) > 0.93;
};
I.endStep = function () {
  I.jumpPressed = I.rollPressed = I.reloadPressed = I.interactPressed = I.meleePressed = I.nadePressed = I.smokePressed = I.benchPressed = false; I.weapon = 0;
  if (fireEnd) { I.fire = false; fireEnd = false; }
};
I.clear = function () { fireEnd = false; I.fire = false; I.ads = false; I.joy.x = I.joy.y = 0; I.endStep(); for (var k in K) K[k] = false; };

/* ---------- touch ---------- */
function setupTouch() {
  var touchRoot = document.getElementById('touch'), joyZone = document.getElementById('joyZone'), lookZone = document.getElementById('lookZone');
  var base = document.getElementById('joyBase'), knob = document.getElementById('joyKnob');
  var joyId = null, jx = 0, jy = 0, looks = {};
  window.addEventListener('touchstart', function () {
    if (!I.isTouch) { I.isTouch = true; document.body.classList.add('touch'); if (JO.UI) JO.UI.refreshTouch(); }
  }, { passive: true });

  joyZone.addEventListener('touchstart', function (e) {
    e.preventDefault(); if (joyId !== null) return;
    var t = e.changedTouches[0]; joyId = t.identifier; jx = t.clientX; jy = t.clientY;
    base.style.left = (jx - 60) + 'px'; base.style.bottom = (window.innerHeight - jy - 60) + 'px';
  }, { passive: false });
  joyZone.addEventListener('touchmove', function (e) {
    e.preventDefault();
    for (var i = 0; i < e.changedTouches.length; i++) { var t = e.changedTouches[i]; if (t.identifier !== joyId) continue;
      var dx = t.clientX - jx, dy = t.clientY - jy, d = Math.hypot(dx, dy), m = 52;
      if (d > m) { dx *= m / d; dy *= m / d; }
      I.joy.x = dx / m; I.joy.y = -dy / m; knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; }
  }, { passive: false });
  function joyEnd(e) { for (var i = 0; i < e.changedTouches.length; i++) if (e.changedTouches[i].identifier === joyId) {
    joyId = null; I.joy.x = I.joy.y = 0; knob.style.transform = ''; } }
  joyZone.addEventListener('touchend', joyEnd); joyZone.addEventListener('touchcancel', joyEnd);

  function lookStart(e) { e.preventDefault(); for (var i = 0; i < e.changedTouches.length; i++) { var t = e.changedTouches[i]; looks[t.identifier] = [t.clientX, t.clientY]; } }
  function lookMove(e) { e.preventDefault(); for (var i = 0; i < e.changedTouches.length; i++) { var t = e.changedTouches[i], p = looks[t.identifier]; if (!p) continue;
    if (I.onLook) I.onLook((t.clientX - p[0]) * 2.4, (t.clientY - p[1]) * 2.4); p[0] = t.clientX; p[1] = t.clientY; } }
  function lookEnd(e) { for (var i = 0; i < e.changedTouches.length; i++) delete looks[e.changedTouches[i].identifier]; }
  lookZone.addEventListener('touchstart', lookStart, { passive: false }); lookZone.addEventListener('touchmove', lookMove, { passive: false });
  lookZone.addEventListener('touchend', lookEnd); lookZone.addEventListener('touchcancel', lookEnd);

  var btns = touchRoot.querySelectorAll('.tbtn');
  for (var b = 0; b < btns.length; b++) (function (el) {
    var act = el.getAttribute('data-act');
    el.addEventListener('touchstart', function (e) {
      e.preventDefault(); e.stopPropagation(); el.classList.add('act');
      if (act === 'fire') { I.fire = true; fireEnd = false; lookStart(e); }
      else if (act === 'jump') I.jumpPressed = true; else if (act === 'roll') I.rollPressed = true;
      else if (act === 'reload') I.reloadPressed = true; else if (act === 'use') I.interactPressed = true;
      else if (act === 'swap') I.weapon = -1;
      else if (act === 'nade') I.nadePressed = true; else if (act === 'smoke') I.smokePressed = true; else if (act === 'bench') I.benchPressed = true;
      else if (act === 'ads') { I.ads = !I.ads; }
    }, { passive: false });
    el.addEventListener('touchmove', function (e) { if (act === 'fire') lookMove(e); }, { passive: false });
    function end(e) { if (act !== 'ads') el.classList.remove('act'); else el.classList.toggle('act', I.ads);
      if (act === 'fire') { fireEnd = true; lookEnd(e); } }
    el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
  })(btns[b]);
}
})();
