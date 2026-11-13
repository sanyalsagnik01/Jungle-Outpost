/* ============================================================
   JUNGLE OUTPOST — post.js
   Post-processing with three quality tiers, built on the r128
   EffectComposer bundled in lib/postprocessing.js:
     HIGH  bloom + colour grade + vignette
     MED   colour grade + vignette
     LOW   straight to the screen, lower resolution
   AUTO starts at HIGH and steps down whenever the frame rate
   stays low. If the composer cannot be built (old GPU, missing
   library) the game silently stays on LOW.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, W = JO.World;
var Po = JO.Post = { tier: 'low', setting: 'auto', ok: false, fps: 60, grade: null };
var depthRT = null, depthMat = null, composer = null, bloom = null, final = null, slowT = 0, fastT = 0, warm = 0, TIERS = ['low', 'med', 'high'];
// per-level look: tint, saturation, contrast
var LOOK = [{ tint: [1.04, 1.02, 0.94], sat: 1.12, con: 1.05 }, { tint: [0.92, 1.02, 1.06], sat: 0.9, con: 1.08 }, { tint: [1.08, 0.98, 0.9], sat: 1.05, con: 1.12 }];
var FinalShader = {
  uniforms: { tDiffuse: { value: null }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uSat: { value: 1 }, uCon: { value: 1 }, uVig: { value: 0.55 }, uFlash: { value: 0 }, uHurt: { value: 0 },
    uBlur: { value: 0 }, uDof: { value: 0 }, tDepth: { value: null }, uFocus: { value: 20 }, uNF: { value: new THREE.Vector2(0.1, 700) }, uPx: { value: new THREE.Vector2(0.001, 0.001) }, uLook: { value: new THREE.Vector3(1, 1, 1) }, uLift: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform vec3 uTint; uniform vec3 uLook; uniform float uLift; uniform float uSat; uniform float uCon; uniform float uVig; uniform float uFlash; uniform float uHurt; uniform float uBlur; uniform float uDof; uniform float uFocus; uniform vec2 uNF; uniform vec2 uPx; varying vec2 vUv;' +
    'void main(){ vec4 c=texture2D(tDiffuse,vUv); vec2 d=vUv-0.5;' +
    // movement blur: streaks toward the edges of the view
    ' if(uBlur>0.002){ vec2 st=d*uBlur*0.085*length(d)*2.0; vec3 a=c.rgb; for(int i=1;i<6;i++){ a+=texture2D(tDiffuse,vUv-st*float(i)*0.2).rgb; } c.rgb=a/6.0; }' +
    // depth of field: blur grows with distance from the focus plane
    ' if(uDof>0.002){ float z=texture2D(tDepth,vUv).x; float lin=(2.0*uNF.x*uNF.y)/(uNF.y+uNF.x-(z*2.0-1.0)*(uNF.y-uNF.x)); float coc=clamp(abs(lin-uFocus)/max(uFocus*0.8,5.0)-0.12,0.0,1.0)*uDof*(lin<uFocus?0.4:1.0);' +
    '  if(coc>0.01){ vec3 a=c.rgb; vec2 r=uPx*coc*3.2; a+=texture2D(tDiffuse,vUv+r*vec2(1.0,0.0)).rgb; a+=texture2D(tDiffuse,vUv+r*vec2(-1.0,0.0)).rgb; a+=texture2D(tDiffuse,vUv+r*vec2(0.0,1.0)).rgb; a+=texture2D(tDiffuse,vUv+r*vec2(0.0,-1.0)).rgb;' +
    '   a+=texture2D(tDiffuse,vUv+r*vec2(0.7,0.7)).rgb; a+=texture2D(tDiffuse,vUv+r*vec2(-0.7,0.7)).rgb; a+=texture2D(tDiffuse,vUv+r*vec2(0.7,-0.7)).rgb; a+=texture2D(tDiffuse,vUv+r*vec2(-0.7,-0.7)).rgb; c.rgb=a/9.0; } }' +
    ' float l=dot(c.rgb,vec3(0.299,0.587,0.114)); vec3 col=mix(vec3(l),c.rgb,uSat)*uTint*uLook+uLift; col=(col-0.5)*uCon+0.5;' +
    ' float v=1.0-smoothstep(0.25,0.85,length(d)*1.25); col*=mix(1.0-uVig,1.0,v); col+=uFlash*0.25; col=mix(col,vec3(l*1.2,l*0.25,l*0.2),uHurt*(1.0-v)); gl_FragColor=vec4(clamp(col,0.0,1.0),c.a); }'
};
function build() {
  if (composer || !window.THREE || !THREE.EffectComposer || !THREE.UnrealBloomPass) return !!composer;
  try {
    var r = W.renderer, sz = r.getDrawingBufferSize(new THREE.Vector2()), rt = null;
    if (r.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget) { rt = new THREE.WebGLMultisampleRenderTarget(sz.x, sz.y, { format: THREE.RGBAFormat }); rt.samples = 4; }
    composer = rt ? new THREE.EffectComposer(r, rt) : new THREE.EffectComposer(r);
    composer.addPass(new THREE.RenderPass(W.scene, W.camera));
    bloom = new THREE.UnrealBloomPass(new THREE.Vector2(sz.x / 2, sz.y / 2), 0.3, 0.4, 0.93); composer.addPass(bloom);
    final = new THREE.ShaderPass(FinalShader); composer.addPass(final);
    Po.ok = true; Po.resize(); return true;
  } catch (e) { composer = null; Po.ok = false; if (window.console) console.warn('[post] composer unavailable, staying on LOW', e); return false; }
}
Po.resize = function () {
  var r = W.renderer; r.setPixelRatio(Math.min(window.devicePixelRatio || 1, Po.tier === 'low' ? 1 : 1.5)); r.setSize(window.innerWidth, window.innerHeight, false);
  if (composer) { composer.setPixelRatio(r.getPixelRatio()); composer.setSize(window.innerWidth, window.innerHeight); }
  if (depthRT) { depthRT.dispose(); depthRT = null; }
};
Po.apply = function (tier) {
  if (tier !== 'low' && !build()) tier = 'low';
  var was = Po.tier; Po.tier = tier; if (bloom) bloom.enabled = tier === 'high'; Po.resize();
  if (JO.Weather) JO.Weather.quality = tier === 'low' ? 1 : 2;
  if (was !== tier) JO.Events.emit('quality', tier);
};
// 'auto' | 'low' | 'med' | 'high'
Po.set = function (s, quiet) {
  var before = Po.tier; Po.setting = s; JO.Save.profile.settings.quality = s; JO.Save.save(); slowT = fastT = 0; warm = 0;
  Po.apply(s === 'auto' ? 'high' : s); if (!quiet && JO.UI && before !== Po.tier && TIERS.indexOf(Po.tier) < TIERS.indexOf(before)) JO.UI.toast('QUALITY ' + Po.tier.toUpperCase(), JO.Q.lost(before, Po.tier), '#58e0d0');
  if (!quiet && JO.UI) JO.UI.toast('GRAPHICS', (s === 'auto' ? 'AUTO (' + Po.tier.toUpperCase() + ')' : Po.tier.toUpperCase()) + (Po.ok || Po.tier === 'low' ? '' : ' — effects unavailable'), '#58e0d0');
};
Po.cycle = function () { var o = ['auto', 'high', 'med', 'low']; Po.set(o[(o.indexOf(Po.setting) + 1) % o.length]); };
Po.init = function () {
  var s = JO.Save.profile.settings.quality; Po.setting = s === 'low' || s === 'med' || s === 'high' ? s : 'auto'; Po.apply(Po.setting === 'auto' ? 'high' : Po.setting);
  JO.Events.on('level_load', function (i) { Po.grade = LOOK[i] || LOOK[0]; });
  window.addEventListener('keydown', function (e) { if (e.code === 'F4') { e.preventDefault(); Po.cycle(); } });
};
Po.render = function (scene, cam, real) {
  // frame-rate watch: only while actually playing, and only in AUTO
  Po.fps += (1 / Math.max(0.001, real) - Po.fps) * 0.05;
  if (Po.setting === 'auto' && JO.Game.state === 'playing' && !JO.Game.debug.bot) { warm += real;
    if (warm > 4) { var i = TIERS.indexOf(Po.tier); if (Po.fps < 27 && i > 0) { slowT += real; if (slowT > 3) { slowT = 0; warm = 0; var from = Po.tier; Po.apply(TIERS[i - 1]); Po.fellBack = (Po.fellBack | 0) + 1; JO.UI.toast('GRAPHICS', 'Frame rate low — switched to ' + Po.tier.toUpperCase() + ' (F4 changes it)', '#58e0d0'); JO.UI.toast('QUALITY ' + Po.tier.toUpperCase(), JO.Q.lost(from, Po.tier), '#58e0d0'); } } else slowT = 0; } }
  // LOW also refreshes shadows only every other frame
  var info = W.renderer.info; info.autoReset = false; Po.calls = info.render.calls; Po.tris = info.render.triangles; info.reset();      // totals of the frame just drawn (all passes)
  var sm = W.renderer.shadowMap; if (Po.tier === 'low') { sm.autoUpdate = false; sm.needsUpdate = ((Po.n = (Po.n | 0) + 1) & 1) === 0; } else sm.autoUpdate = true;
  if (Po.tier === 'low' || !composer) { W.renderer.render(scene, cam); return; }
  var u = final.uniforms, g = Po.grade || LOOK[0], Wx = JO.Weather, P = JO.Player, wet = Wx ? Wx.rain * 0.12 + Wx.fog * 0.1 : 0;
  u.uTint.value.set(g.tint[0], g.tint[1], g.tint[2]); u.uSat.value = (g.sat - wet) * (Po.satK || 1); u.uCon.value = g.con * (Po.conK || 1); if (Po.look) u.uLook.value.copy(Po.look); u.uLift.value = Po.lift || 0; u.uFlash.value = Wx ? Wx.flash : 0;
  u.uVig.value = 0.5 + (JO.Input.ads ? 0.15 : 0) + (P.crouch ? 0.12 : 0) + (Po.vigAdd || 0);
  u.uBlur.value = Po.blurMove || 0;
  // depth of field needs the scene's depth: one extra half-size pass, only while aiming on HIGH
  var dof = Po.tier === 'high' && Po.dofK > 0.02 && JO.Game.state === 'playing' ? Po.dofK : 0;
  if (dof > 0) { try {
    if (!depthRT) { var ds = W.renderer.getDrawingBufferSize(new THREE.Vector2()); depthRT = new THREE.WebGLRenderTarget(Math.max(2, ds.x >> 1), Math.max(2, ds.y >> 1), { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
      depthRT.depthTexture = new THREE.DepthTexture(depthRT.width, depthRT.height); depthRT.depthTexture.type = THREE.UnsignedIntType; depthMat = new THREE.MeshBasicMaterial({ colorWrite: false }); }
    // r128 picks one program per override material and does not re-check instance colours, so every instanced mesh must carry them
    if (Po.depthFor !== W.group) { Po.depthFor = W.group; scene.traverse(function (o) { if (o.isInstancedMesh && !o.instanceColor) { var c = new Float32Array(o.instanceMatrix.count * 3); c.fill(1); o.instanceColor = new THREE.InstancedBufferAttribute(c, 3); } }); depthMat.needsUpdate = true; }
    var old = scene.overrideMaterial, bg = scene.background; scene.overrideMaterial = depthMat; scene.background = null; W.renderer.setRenderTarget(depthRT); W.renderer.clear(); W.renderer.render(scene, cam); W.renderer.setRenderTarget(null); scene.overrideMaterial = old; scene.background = bg;
    u.tDepth.value = depthRT.depthTexture; u.uFocus.value = Po.focus || 20; u.uNF.value.set(cam.near, cam.far); u.uPx.value.set(1 / depthRT.width, 1 / depthRT.height); Po.dofPasses = (Po.dofPasses | 0) + 1;
  } catch (e) { dof = 0; Po.dofK = 0; JO.Q.TABLE.dof = [0, 0, 0]; if (window.console) console.warn('[post] depth of field unavailable', e); } }
  u.uDof.value = dof;
  u.uHurt.value = JO.Game.state === 'playing' && P.hp < P.maxHp * 0.3 ? 0.45 : 0;
  composer.passes[0].scene = scene; composer.passes[0].camera = cam;
  try { composer.render(real); } catch (e) { composer = null; Po.ok = false; Po.apply('low'); W.renderer.render(scene, cam); }
};
})();
