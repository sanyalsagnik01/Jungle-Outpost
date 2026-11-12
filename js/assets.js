/* ============================================================
   JUNGLE OUTPOST — assets.js
   GLB asset layer (Three r128 GLTFLoader, see /models/README.md).

   * Every model is OPTIONAL. If a file is missing, fails to parse or
     takes too long, the game keeps using the primitive version from
     models.js. Nothing here can throw into the game loop.
   * Sources, in order: models/models.bundle.js (base64, works when
     index.html is opened straight from disk) then the .glb over HTTP.
   * JO.Assets.instantiate(name) returns a Model wrapper with:
       play(loop)            cross-fade to a looping clip (idle/walk/run)
       playOnce(clip, opts)  one-shot; upper-body overlay unless full
       flash(hex, secs)      emissive hit flash
       setDissolve(0..1)     death dissolve (dithered discard)
       socket(name)          named bone / node for attachments
   ============================================================ */
(function () {
'use strict';
var JO = window.JO;
var A = JO.Assets = { entries: {}, status: {}, total: 0, done: 0, ready: false, log: [] };

// name -> file, triangle budget, and the exact clip names the game expects
A.manifest = {
  kade:          { file: 'models/kade.glb', kind: 'character', budget: 5000,
                   clips: ['idle', 'walk', 'run', 'shoot', 'reload', 'hit', 'death', 'attack'], loops: ['idle', 'walk', 'run'] },
  ar:            { file: 'models/ar.glb', kind: 'weapon', budget: 1500 },
  shotgun:       { file: 'models/shotgun.glb', kind: 'weapon', budget: 1500 },
  marksman:      { file: 'models/marksman.glb', kind: 'weapon', budget: 1500 },
  crossbow:      { file: 'models/crossbow.glb', kind: 'weapon', budget: 1500 },
  flamethrower:  { file: 'models/flamethrower.glb', kind: 'weapon', budget: 1500 },
  frag_grenade:  { file: 'models/frag_grenade.glb', kind: 'weapon', budget: 1500 },
  smoke_grenade: { file: 'models/smoke_grenade.glb', kind: 'weapon', budget: 1500 }
};
// bones driven by upper-body overlays (three strips the dots: "upper_arm.L" -> "upper_armL")
var UPPER = /^(spine|chest|head|upper_arm|forearm|hand|socket_hand|socket_back)/;

function b64ToBuffer(s) { var bin = atob(s), n = bin.length, u = new Uint8Array(n); for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i); return u.buffer; }
function fetchBuffer(url, cb) {
  if (location.protocol === 'file:') return cb(null, 'not in bundle (file:// cannot fetch)');     // browsers block XHR from disk
  try {
    var x = new XMLHttpRequest(); x.open('GET', url, true); x.responseType = 'arraybuffer'; x.timeout = 8000;
    x.onload = function () { cb(x.status === 200 && x.response && x.response.byteLength > 20 ? x.response : null, 'HTTP ' + x.status); };
    x.onerror = function () { cb(null, 'network error'); }; x.ontimeout = function () { cb(null, 'timeout'); }; x.send();
  } catch (e) { cb(null, String(e)); }
}

/* ---------- loading ---------- */
A.loadAll = function (onProgress, onDone) {
  var names = Object.keys(A.manifest), bundle = window.JO_MODEL_DATA || {}, finished = false;
  A.total = names.length; A.done = 0;
  function settle(name, ok, why) {
    if (A.status[name]) return;                                    // already settled (e.g. late callback after a timeout)
    A.status[name] = ok ? 'glb' : 'fallback'; A.done++;
    if (!ok) { A.log.push(name + ': ' + why); if (window.console) console.info('[assets] ' + name + ' -> primitive fallback (' + why + ')'); }
    if (onProgress) onProgress(A.done, A.total, name, ok);
    if (A.done >= A.total && !finished) { finished = true; A.ready = true; if (onDone) onDone(); }
  }
  if (!window.THREE || !THREE.GLTFLoader) { names.forEach(function (n) { settle(n, false, 'GLTFLoader unavailable'); }); return; }
  var loader = new THREE.GLTFLoader();
  names.forEach(function (name) {
    var def = A.manifest[name], guard = setTimeout(function () { settle(name, false, 'timed out'); }, 10000);
    function parse(buf, why) {
      if (!buf) { clearTimeout(guard); return settle(name, false, why || 'missing'); }
      try {
        loader.parse(buf, '', function (gltf) {
          clearTimeout(guard);
          try { A.entries[name] = prepare(name, def, gltf); settle(name, true); } catch (e) { delete A.entries[name]; settle(name, false, 'prepare failed: ' + e.message); }
        }, function (e) { clearTimeout(guard); settle(name, false, 'parse error: ' + (e && e.message || e)); });
      } catch (e) { clearTimeout(guard); settle(name, false, 'parse threw: ' + e.message); }
    }
    if (bundle[name]) { var buf = null; try { buf = b64ToBuffer(bundle[name]); } catch (e) { /* corrupt base64 */ } parse(buf, 'corrupt bundle entry'); }
    else fetchBuffer(def.file, parse);
  });
};

// Convert the glTF PBR materials to the game's Lambert look, count triangles, split clips into layers.
function prepare(name, def, gltf) {
  var tris = 0, skinned = false, mats = {};
  gltf.scene.traverse(function (o) {
    if (!o.isMesh) return;
    var g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    if (o.isSkinnedMesh) { skinned = true; o.frustumCulled = false; }
    var src = o.material, m = mats[src.uuid];
    if (!m) {
      m = mats[src.uuid] = new THREE.MeshLambertMaterial({ color: src.color ? src.color.getHex() : 0xffffff, map: src.map || null, skinning: !!o.isSkinnedMesh });
      if (m.map) { m.map.encoding = THREE.LinearEncoding; m.map.magFilter = m.map.minFilter = THREE.NearestFilter; m.map.generateMipmaps = false; m.map.needsUpdate = true; }
      m.name = src.name; src.dispose();
    }
    o.material = m; o.castShadow = true;
  });
  if (!tris) throw new Error('no meshes');
  var e = { name: name, def: def, scene: gltf.scene, tris: Math.round(tris), skinned: skinned, clips: {}, missing: [] };
  (gltf.animations || []).forEach(function (c) { e.clips[c.name] = layers(c); });
  (def.clips || []).forEach(function (c) { if (!e.clips[c]) e.missing.push(c); });
  if (e.missing.length && window.console) console.warn('[assets] ' + name + ' is missing clips: ' + e.missing.join(', '));
  if (e.tris > def.budget && window.console) console.warn('[assets] ' + name + ' is over budget: ' + e.tris + ' > ' + def.budget);
  return e;
}
// Keep rotations for every bone and translation for the hips only; split into lower / upper body.
function layers(clip) {
  var up = [], low = [];
  clip.tracks.forEach(function (t) {
    var dot = t.name.lastIndexOf('.'), node = t.name.slice(0, dot), prop = t.name.slice(dot + 1);
    if (prop === 'scale' || (prop === 'position' && node !== 'hips')) return;
    (UPPER.test(node) ? up : low).push(t);
  });
  return { name: clip.name, duration: clip.duration,
    full: new THREE.AnimationClip(clip.name, clip.duration, up.concat(low)),
    upper: new THREE.AnimationClip(clip.name + '@upper', clip.duration, up),
    lower: new THREE.AnimationClip(clip.name + '@lower', clip.duration, low) };
}

A.has = function (name) { return !!A.entries[name]; };
A.instantiate = function (name) {
  var e = A.entries[name]; if (!e) return null;
  try { return new Model(e); } catch (err) { if (window.console) console.warn('[assets] instantiate ' + name + ' failed', err); return null; }
};
A.summary = function () {
  return Object.keys(A.manifest).map(function (n) { var e = A.entries[n]; return n + ': ' + (e ? e.tris + ' tris' + (e.missing.length ? ' (missing ' + e.missing.join(',') + ')' : '') : 'PRIMITIVE FALLBACK'); });
};

/* ============================================================
   MODEL — one live instance
   ============================================================ */
var DISSOLVE_HEAD = 'uniform float uDissolve;\nvoid main() {\n\tif ( uDissolve > 0.0 ) { float jn = fract( sin( dot( floor( gl_FragCoord.xy * 0.5 ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); if ( jn < uDissolve ) discard; }';
function Model(e) {
  var self = this;
  this.entry = e; this.name = e.name; this.tris = e.tris;
  this.root = e.skinned ? THREE.SkeletonUtils.clone(e.scene) : e.scene.clone(true);
  this.mats = []; this.nodes = {}; this.uDissolve = { value: 0 }; this.flashT = 0; this.emis = 0;
  var cloned = {};
  this.root.traverse(function (o) {
    self.nodes[o.name] = o;
    if (!o.isMesh) return;
    var m = cloned[o.material.uuid];
    if (!m) { m = cloned[o.material.uuid] = o.material.clone(); m.skinning = o.material.skinning;
      m.onBeforeCompile = function (sh) { sh.uniforms.uDissolve = self.uDissolve; sh.fragmentShader = sh.fragmentShader.replace('void main() {', DISSOLVE_HEAD); };
      self.mats.push(m); }
    o.material = m;
  });
  // animation layers
  this.loops = {}; this.shots = {}; this.loop = ''; this.shot = null; this.shotT = 0; this.shotW = 0; this.dead = false;
  var names = Object.keys(e.clips);
  if (names.length) {
    this.mixer = new THREE.AnimationMixer(this.root);
    var isLoop = {}; (e.def.loops || []).forEach(function (n) { isLoop[n] = true; });
    names.forEach(function (n) {
      var c = e.clips[n];
      if (isLoop[n]) {
        var L = { lower: self.mixer.clipAction(c.lower), upper: self.mixer.clipAction(c.upper), w: 0, target: 0 };
        L.lower.play(); L.upper.play(); L.lower.setEffectiveWeight(0); L.upper.setEffectiveWeight(0); self.loops[n] = L;
      } else {
        var S = { upper: self.mixer.clipAction(c.upper), full: self.mixer.clipAction(c.full), duration: c.duration };
        [S.upper, S.full].forEach(function (a) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.play(); a.paused = true; a.setEffectiveWeight(0); });
        self.shots[n] = S;
      }
    });
    var first = e.def.loops && e.def.loops[0]; if (first && this.loops[first]) { this.loop = first; this.loops[first].w = this.loops[first].target = 1; }
  }
}
var MP = Model.prototype;
MP.play = function (name, timeScale) {
  if (!this.loops[name]) return;
  if (this.loop !== name) { this.loop = name; for (var k in this.loops) this.loops[k].target = k === name ? 1 : 0; }
  if (timeScale !== undefined) { this.loops[name].lower.timeScale = timeScale; this.loops[name].upper.timeScale = timeScale; }
};
// opts: { full: bool (whole body, e.g. death), timeScale, hold: bool (stay on last frame) }
MP.playOnce = function (name, opts) {
  var S = this.shots[name]; if (!S) return false; opts = opts || {};
  if (this.shot) { this.shot.act.setEffectiveWeight(0); this.shot.act.paused = true; }
  var act = opts.full ? S.full : S.upper;
  act.reset(); act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true; act.timeScale = opts.timeScale || 1; act.paused = false; act.play();
  this.shot = { name: name, act: act, full: !!opts.full, hold: !!opts.hold, len: S.duration / (opts.timeScale || 1) }; this.shotT = 0;
  return true;
};
MP.stopShot = function () { if (this.shot) { this.shot.hold = false; this.shotT = Math.max(this.shotT, this.shot.len - 0.1); } };
MP.reset = function () {
  if (this.shot) { this.shot.act.setEffectiveWeight(0); this.shot.act.paused = true; this.shot = null; }
  this.shotW = 0; this.setDissolve(0); this.flashT = 0;
};
MP.activeClip = function () { return this.loop + (this.shot ? ' + ' + this.shot.name : ''); };
MP.flash = function (hex, secs) { this.flashT = secs || 0.09; this.flashHex = hex || 0x777777; };
MP.setDissolve = function (k) { this.uDissolve.value = k < 0 ? 0 : (k > 1 ? 1 : k); };
MP.socket = function (name) { return this.nodes[name] || this.nodes[name.replace(/\./g, '')] || null; };
MP.update = function (dt) {
  var k, L;
  if (this.mixer) {
    // one-shot weight envelope (fast in, eased out); held shots stay at full weight
    var sw = 0;
    if (this.shot) {
      this.shotT += dt; var left = this.shot.len - this.shotT;
      if (left <= 0 && !this.shot.hold) { this.shot.act.setEffectiveWeight(0); this.shot.act.paused = true; this.shot = null; }
      else sw = Math.min(1, this.shotT / 0.06, this.shot.hold ? 1 : Math.max(0, left) / 0.12);
    }
    this.shotW = sw;
    var full = this.shot && this.shot.full ? sw : 0, up = this.shot && !this.shot.full ? sw : 0, f = Math.min(1, dt * 9);
    for (k in this.loops) { L = this.loops[k]; L.w += (L.target - L.w) * f; if (L.w < 0.002 && L.target === 0) L.w = 0;
      L.lower.setEffectiveWeight(L.w * (1 - full)); L.upper.setEffectiveWeight(L.w * (1 - full) * (1 - up)); }
    if (this.shot) this.shot.act.setEffectiveWeight(sw);
    this.mixer.update(dt);
  }
  var em = 0; if (this.flashT > 0) { this.flashT -= dt; em = this.flashHex; }
  if (em !== this.emis) { this.emis = em; for (k = 0; k < this.mats.length; k++) this.mats[k].emissive.setHex(em); }
};
MP.dispose = function () { if (this.root.parent) this.root.parent.remove(this.root); for (var i = 0; i < this.mats.length; i++) this.mats[i].dispose(); if (this.mixer) this.mixer.stopAllAction(); };
})();
