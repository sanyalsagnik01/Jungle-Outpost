/* ============================================================
   JUNGLE OUTPOST — events.js
   Tiny publish/subscribe bus. Gameplay code announces what
   happened (a kill, a checkpoint, a boss phase); story, codex,
   achievements and saves listen without touching the combat code.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO = window.JO || {}, map = {};
JO.Events = {
  on: function (name, fn) { (map[name] || (map[name] = [])).push(fn); },
  emit: function (name, a, b, c, d, e) { var l = map[name]; if (!l) return;
    for (var i = 0; i < l.length; i++) { try { l[i](a, b, c, d, e); } catch (e) { if (window.console) console.error(e); } } }
};
})();
