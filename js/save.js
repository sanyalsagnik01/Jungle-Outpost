/* ============================================================
   JUNGLE OUTPOST — save.js
   One profile in localStorage: codex, collectibles, endings,
   salvage, skills, weapon mods, achievements, settings and the
   autosaved run. Storage errors are swallowed: with storage
   blocked the game simply does not remember between sessions.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, KEY = 'jungle-outpost-profile-v2';
function defaults() { return { v: 2, intel: {}, idols: {}, seen: {}, maxLevel: 0, endings: {}, salvage: 0, skills: {}, mods: {}, ach: {}, count: {}, settings: {}, run: null, ngPlus: 0, best: {} }; }
var S = JO.Save = { profile: defaults(), ok: true };
S.load = function () {
  try { var raw = window.localStorage.getItem(KEY); if (raw) { var p = JSON.parse(raw), d = defaults(); for (var k in d) if (p[k] === undefined || p[k] === null && k !== 'run') p[k] = d[k]; S.profile = p; } }
  catch (e) { S.ok = false; S.profile = defaults(); }
  return S.profile;
};
S.save = function () { try { window.localStorage.setItem(KEY, JSON.stringify(S.profile)); } catch (e) { S.ok = false; } };
S.wipe = function () { var keep = S.profile.settings; S.profile = defaults(); S.profile.settings = keep; S.save(); };
S.load();
})();
