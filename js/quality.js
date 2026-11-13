/* ============================================================
   JUNGLE OUTPOST — quality.js
   The living-world pass hangs off two small things defined here:

   JO.Q    per-effect budgets for the three graphics tiers
           (JO.Post.tier: low / med / high) and the settings that
           switch single effects off. Q.n('grass') is "how many
           of these may exist right now"; 0 means the effect is off.
   JO.Sys  a registry for the living-world systems. Each system
           is an object with any of: init(), level(L), step(dt),
           frame(dt, real), quality(tier). A system that throws is
           switched off instead of taking the game loop with it.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, Ev = JO.Events;
var TIER = { low: 0, med: 1, high: 2 };

var Q = JO.Q = {
  //              low   med  high
  TABLE: {
    grass:      [ 500, 2200, 4400],   // instanced grass tufts per level
    wind:       [   1,    1,    1],   // vertex sway on trees, bushes and grass
    birds:      [   8,   20,   32],
    monkeys:    [   0,    3,    5],
    fish:       [   2,    4,    6],
    motes:      [  60,  180,  340],   // fireflies / pollen / spores
    ripples:    [   6,   14,   24],
    bits:       [  40,  110,  200],   // debris chunks
    decals:     [  24,   70,  140],   // bullet holes, scorch marks
    bodies:     [   3,    6,   10],   // enemies left lying on the ground
    shells:     [   0,   12,   24],
    lanterns:   [   2,    4,    6],   // real point lights for carried lanterns
    lights:     [   1,    3,    6],   // real point lights for torches (nearest N)
    shafts:     [   0,    8,   16],   // light shafts through the canopy
    dust:       [   0,   60,  140],
    fogLayers:  [   0,    2,    4],   // low ground-fog sheets
    puddles:    [   0,   10,   22],
    blur:       [   0,    1,    1],   // sprint / roll blur in the final pass
    dof:        [   0,    0,    1],   // depth of field while aiming
    visor:      [   0,    1,    1],   // rain on the lens
    reverb:     [   0,    1,    1],
    voices:     [   8,   14,   20]    // positional sounds at once
  },
  // settings that belong to this pass (merged into the profile by meta.js). The second entry names the budgets a toggle gates.
  DEF: { foliage: true, wildlife: true, ambience: true, decals: true, ragdoll: true, camFeel: true, motionBlur: true, dofFx: true, visorFx: true,
    shafts: true, groundFog: true, wetWorld: true, reverbFx: true, diegetic: false, vibration: true, tinnitus: true },
  GATE: { grass: 'foliage', wind: 'foliage', birds: 'wildlife', monkeys: 'wildlife', fish: 'wildlife', motes: 'wildlife', bits: 'decals', decals: 'decals', shells: 'decals', bodies: 'ragdoll',
    shafts: 'shafts', dust: 'shafts', fogLayers: 'groundFog', puddles: 'wetWorld', blur: 'motionBlur', dof: 'dofFx', visor: 'visorFx', reverb: 'reverbFx' },
  // [key, label, hint] rows for the settings screen
  ROWS: [['foliage', 'Wind and grass', 'Swaying trees and bushes, grass that parts around you'], ['wildlife', 'Wildlife', 'Birds, monkeys, fish, fireflies'], ['ambience', 'Living soundscape', 'Animal calls that fall silent after gunfire'],
    ['decals', 'Bullet holes and debris', ''], ['ragdoll', 'Bodies stay where they fall', ''], ['camFeel', 'Camera motion', 'Head bob, landing dip, sprint zoom, lean roll'], ['motionBlur', 'Sprint and roll blur', ''],
    ['dofFx', 'Depth of field while aiming', 'High quality only'], ['visorFx', 'Rain on the lens', ''], ['shafts', 'Light shafts and dust', ''], ['groundFog', 'Ground fog', ''], ['wetWorld', 'Wet ground and puddles', ''],
    ['reverbFx', 'Reverb and echo', ''], ['tinnitus', 'Ringing ears after blasts', ''], ['vibration', 'Gamepad vibration', ''], ['diegetic', 'Minimal HUD', 'Hides the panels until you need them']]
};
Q.tier = function () { return (JO.Post && JO.Post.tier) || 'low'; };
Q.idx = function () { return TIER[Q.tier()] || 0; };
Q.on = function (setting) { var s = JO.Meta && JO.Meta.set; return !s || s[setting] !== false; };
Q.n = function (key) { var row = Q.TABLE[key]; if (!row) return 0; var g = Q.GATE[key]; if (g && !Q.on(g)) return 0; return row[Q.idx()]; };

// merge several geometries (already transformed) into one; position + normal only
Q.merge = function (list) {
  var n = 0, i, k; for (i = 0; i < list.length; i++) { list[i] = list[i].index ? list[i].toNonIndexed() : list[i]; n += list[i].attributes.position.count; }
  var pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), o = 0;
  for (i = 0; i < list.length; i++) { var p = list[i].attributes.position.array, q = list[i].attributes.normal.array; for (k = 0; k < p.length; k++) { pos[o + k] = p[k]; nor[o + k] = q[k]; } o += p.length; }
  var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); return g;
};
Q.box = function (sx, sy, sz, x, y, z, ry) { var g = new THREE.BoxGeometry(sx, sy, sz); if (ry) g.rotateY(ry); g.translate(x || 0, y || 0, z || 0); return g; };

/* ---------- system registry ---------- */
var Sys = JO.Sys = { list: [], ms: {}, ready: false };
Sys.add = function (name, obj) { obj.name = name; obj.dead = false; obj.errs = 0; Sys.list.push(obj); return obj; };
function call(s, fn, a, b) {
  if (s.dead || !s[fn]) return;
  try { s[fn](a, b); }
  catch (e) { s.errs++; var G = JO.Game; if (G && G.debug.errors.length < 20) G.debug.errors.push('[' + s.name + '.' + fn + '] ' + String(e && e.stack || e)); if (window.console) console.error('[' + s.name + '.' + fn + ']', e);
    if (s.errs >= 3) { s.dead = true; if (window.console) console.warn('[sys] ' + s.name + ' switched off after repeated errors'); } }
}
function each(fn, a, b) { for (var i = 0; i < Sys.list.length; i++) call(Sys.list[i], fn, a, b); }
Sys.init = function () {
  each('init'); Sys.ready = true;
  Ev.on('world_built', function (L) { each('level', L); });
  Ev.on('quality', function (t) { each('quality', t); });
  if (JO.World.level) each('level', JO.World.level);
};
Sys.step = function (dt) { each('step', dt); };
Sys.frame = function (dt, real) {
  if (!Sys.prof) return each('frame', dt, real);
  for (var i = 0; i < Sys.list.length; i++) { var t0 = performance.now(); call(Sys.list[i], 'frame', dt, real); var n = Sys.list[i].name; Sys.ms[n] = (Sys.ms[n] || 0) * 0.9 + (performance.now() - t0) * 0.1; }
};
Sys.get = function (name) { for (var i = 0; i < Sys.list.length; i++) if (Sys.list[i].name === name) return Sys.list[i]; return null; };
})();

/* ============================================================
   JO.Lights — the light budget. Real point lights are costly,
   so there is one small pool (size = JO.Q 'lights'). Every
   frame the systems that want light (lamps, lanterns, torches,
   fires) ask for it with Lights.add(); the nearest requests to
   the camera get the pool, the rest stay as glowing meshes only.
   Lights fade in and out when the pool changes hands.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, Q = JO.Q;
var Li = JO.Lights = { pool: [], req: [], used: 0, n: 0, asked: 0 };
var MAX = 6, rn = 0;
Li.add = function (id, x, y, z, hex, intensity, range, prio) {
  var r = Li.req[rn] || (Li.req[rn] = {}); rn++; r.id = id; r.x = x; r.y = y; r.z = z; r.hex = hex; r.i = intensity; r.range = range || 10; r.prio = prio || 1; r.score = 0;
};
function resize() { Li.n = Math.min(MAX, Q.n('lights')); for (var i = 0; i < MAX; i++) { Li.pool[i].light.visible = i < Li.n; if (i >= Li.n) { Li.pool[i].id = null; Li.pool[i].light.intensity = 0; } } }
JO.Sys.add('lights', {
  init: function () { for (var i = 0; i < MAX; i++) { var l = new THREE.PointLight(0xffffff, 0, 10, 1.4); JO.World.scene.add(l); Li.pool.push({ light: l, id: null, cur: 0 }); } resize(); },
  quality: resize,
  frame: function (dt, real) {
    var cam = JO.World.camera.position, i, j, r, p, k = Math.min(1, real * 7); Li.asked = rn;
    for (i = 0; i < rn; i++) { r = Li.req[i]; r.score = (Math.hypot(r.x - cam.x, r.z - cam.z) + 2) / r.prio; r.taken = false; }
    // lights that still have their request keep it if it is among the nearest n
    var order = Li.req.slice(0, rn).sort(function (a, b) { return a.score - b.score; }).slice(0, Li.n);
    for (j = 0; j < Li.n; j++) { p = Li.pool[j]; p.want = null; for (i = 0; i < order.length; i++) if (order[i].id === p.id && !order[i].taken) { p.want = order[i]; order[i].taken = true; break; } }
    for (j = 0; j < Li.n; j++) { p = Li.pool[j]; if (p.want) continue; if (p.cur > 0.03) continue;                       // still fading out from its old job
      for (i = 0; i < order.length; i++) if (!order[i].taken) { p.want = order[i]; p.id = order[i].id; order[i].taken = true; break; } if (!p.want) p.id = null; }
    Li.used = 0;
    for (j = 0; j < Li.n; j++) { p = Li.pool[j]; r = p.want;
      if (r) { p.light.position.set(r.x, r.y, r.z); p.light.color.setHex(r.hex); p.light.distance = r.range; p.cur += (r.i - p.cur) * k; Li.used++; } else p.cur += (0 - p.cur) * k;
      p.light.intensity = p.cur; }
    rn = 0;
  }
});
})();
