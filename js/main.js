/* ============================================================
   JUNGLE OUTPOST — main.js
   Game state machine, fixed-timestep loop, level flow
   (spawning, checkpoints, boss gate, destination flag),
   pickups, upgrades and screen wiring.
   States: title | intro | playing | paused | dying | dead | done | win | finale | bench
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, CFG = JO.CFG, W = JO.World, FX = JO.FX, A = JO.Audio, I = JO.Input, P = JO.Player, Wp = JO.Weapons, Cam = JO.Cam,
  E = JO.Enemies, H = JO.Haz, B = JO.Bosses, UI = JO.UI, G = W.G, Ev = JO.Events, St = JO.Story, S = JO.Save, Ar = JO.Arsenal, Pk = JO.Perks, Sl = JO.Stealth, Pr = JO.Props;
var STEP = CFG.STEP;
function newStats() { return { time: 0, kills: 0, shots: 0, hits: 0, dmgTaken: 0 }; }

var Game = JO.Game = {
  state: 'title', levelIdx: 0, diff: 'normal', diffCfg: CFG.DIFF.normal, stats: newStats(), total: newStats(),
  boss: null, bossFight: false, bossDying: false, bossDead: false, objective: '', timescale: 1, hint: '', mode: '', ending: '',
  run: { intel: {}, idols: {}, mercy: 0, spared: false, knockouts: 0 },
  debug: { god: false, bot: false, speed: 1, errors: [] }
};
var bossSeen = false, pending = [], pickups = [], snap = null, levelSnap = null, acc = 0, last = 0, spawnT = 0, deadT = 0, slowT = 0, supplyT = 0, titleT = 0, muted = false;

/* ---------- pickups (pooled) ---------- */
function initPickups(scene) {
  var mA = new THREE.MeshLambertMaterial({ color: 0xd8b030, emissive: 0x403000 }), mD = new THREE.MeshLambertMaterial({ color: 0x3a3a2a }),
    mH = new THREE.MeshLambertMaterial({ color: 0xf2f2f2, emissive: 0x303030 }), mR = new THREE.MeshLambertMaterial({ color: 0xe02a1a, emissive: 0x500000 }),
    mP = new THREE.MeshLambertMaterial({ color: 0x4a9cff, emissive: 0x0a2a60 }), part = JO.Models.part;
  for (var i = 0; i < 26; i++) {
    var g = new THREE.Group(), a = new THREE.Group(), h = new THREE.Group(), p = new THREE.Group();
    part(G.box, mA, 0.55, 0.36, 0.34, 0, 0, 0, a); part(G.box, mD, 0.57, 0.1, 0.36, 0, 0.05, 0, a);
    part(G.box, mH, 0.5, 0.42, 0.34, 0, 0, 0, h); part(G.box, mR, 0.3, 0.1, 0.36, 0, 0, 0, h); part(G.box, mR, 0.1, 0.3, 0.36, 0, 0, 0, h);
    part(G.box, mP, 0.46, 0.58, 0.12, 0, 0, 0, p); part(G.box, mD, 0.3, 0.1, 0.14, 0, 0.12, 0, p);
    g.add(a); g.add(h); g.add(p); g.visible = false; scene.add(g);
    pickups.push({ active: false, g: g, kinds: { ammo: a, health: h, armor: p }, type: '', x: 0, z: 0, t: 0 });
  }
}
// swap the box pickups for their GLB versions once models are in
function upgradePickups() {
  for (var i = 0; i < pickups.length; i++) for (var k in pickups[i].kinds) { var m = JO.Assets.instantiate('pk_' + k); if (!m) continue;
    var grp = pickups[i].kinds[k], c; for (c = 0; c < grp.children.length; c++) grp.children[c].visible = false; m.root.scale.setScalar(1.25); m.root.position.y = -0.25; grp.add(m.root); }
}
Game.spawnPickup = function (type, x, z) {
  for (var i = 0; i < pickups.length; i++) { var p = pickups[i]; if (p.active) continue;
    p.active = true; p.type = type; p.x = Math.max(-W.halfWidth(z) + 1, Math.min(W.halfWidth(z) - 1, x)); p.z = z; p.t = Math.random() * 6;
    p.kinds.ammo.visible = type === 'ammo'; p.kinds.health.visible = type === 'health'; p.kinds.armor.visible = type === 'armor';
    p.g.visible = true; p.g.position.set(p.x, 0.6, z); return; }
};
function clearPickups() { for (var i = 0; i < pickups.length; i++) { pickups[i].active = false; pickups[i].g.visible = false; } }
function updatePickups(dt) {
  for (var i = 0; i < pickups.length; i++) { var p = pickups[i]; if (!p.active) continue;
    p.t += dt; p.g.position.y = 0.62 + Math.sin(p.t * 3) * 0.12; p.g.rotation.y = p.t * 2;
    var dx = p.x - P.pos.x, dz = p.z - P.pos.z; if (dx * dx + dz * dz > 2.4 || P.pos.y > 2 || P.dead) continue;
    var got = false, msg = '';
    if (p.type === 'ammo') { got = Wp.addAmmo(); msg = '+AMMO'; }
    else if (p.type === 'health') { if (P.hp < P.maxHp) { P.hp = Math.min(P.maxHp, P.hp + 35); got = true; msg = '+35 HP'; } }
    else if (P.armor < P.armorCap()) { P.armor = Math.min(P.armorCap(), P.armor + CFG.PLAYER.plateValue); got = true; msg = '+ARMOR PLATE'; }
    if (got) { p.active = false; p.g.visible = false; A.play('pickup'); UI.dmgNum(p.x, 1.6, p.z, msg, 'head'); FX.burst(p.x, 0.8, p.z, 8, 0xfff0a0, 3, 0.4, 0, 0.12, 2); }
  }
}
Game.openCrate = function (c) {
  c.opened = true; A.play('checkpoint', 0.6); FX.burst(c.x, 1, c.z, 12, 0xffd060, 4, 0.5, 6, 0.14, 2);
  Game.spawnPickup('ammo', c.x - 1.1, c.z + 1.3); Game.spawnPickup(P.hp < P.maxHp * 0.7 ? 'health' : (P.armor < P.armorCap() ? 'armor' : 'health'), c.x + 1.1, c.z + 1.3);
  if (Math.random() < 0.5) Game.spawnPickup('armor', c.x, c.z + 2.1);
  Ar.give('smoke', 1); Pk.addSalvage(CFG.SALVAGE.crate, c.x, 1.9, c.z);
};
Game.onKill = function (e) {
  Game.stats.kills++; Ev.emit('kill', e);
  if (e.summoned || Math.random() > e.cfg.drop) return;
  var ar = Wp.slots[0], r = Math.random(), type;
  if (P.hp < P.maxHp * 0.5 && r < 0.55) type = 'health'; else if (ar.reserve < 100) type = 'ammo';
  else type = r < 0.55 ? 'ammo' : (r < 0.85 ? 'health' : 'armor');
  var x = e.pos.x, z = e.pos.z; if (e.type === 'sniper') x += x > 0 ? -2.8 : 2.8;
  Game.spawnPickup(type, x, z);
};

/* ---------- level flow ---------- */
function buildPending(fromZ) {
  pending.length = 0; var L = CFG.LEVELS[Game.levelIdx];
  L.zones.forEach(function (zn) { zn.spawns.forEach(function (s) {
    if (s[2] >= fromZ - 4) return; var o = s[3] || {};
    pending.push({ type: s[0], x: s[1], z: s[2], trig: o.trig !== undefined ? o.trig : s[2] + (s[0] === 'sniper' ? 62 : 46), alt: o.alt }); }); });
}
function takeSnap(x, z, cpZ) { return { w: Wp.snapshot(), armor: P.armor, x: x, z: z, cpZ: cpZ }; }
function setObjective() {
  Game.objective = Game.bossDead ? 'Objective: <b>Reach the flag</b>' : (Game.bossFight ? 'Objective: <b>Defeat ' + Game.boss.name + '</b>' : 'Objective: <b>Reach the flag</b> — push north');
}
Game.setDifficulty = function (d) { Game.diff = d; Game.refreshDiff(); };
// the numbers enemies actually use: chosen difficulty x New Game+ level x survival wave, eased by adaptive difficulty
Game.refreshDiff = function () {
  var b = CFG.DIFF[Game.diff], ng = (Game.run && Game.run.ng) || 0, ad = JO.Meta ? JO.Meta.adaptK() : 0, wv = Game.mode === 'survival' && JO.Meta ? JO.Meta.wave : 0;
  Game.diffCfg = { label: b.label, dmg: b.dmg * (1 + 0.25 * ng) * (1 - 0.12 * ad), acc: b.acc * (1 + 0.1 * ng) * (1 - 0.1 * ad), hp: b.hp * (1 + 0.35 * ng) * (1 + 0.06 * wv) };
};
var stopT = 0; Game.hitStop = function (t) { if (t > stopT) stopT = t; };
function newRun() { return { intel: {}, idols: {}, mercy: 0, spared: false, knockouts: 0, salvage: 0, deaths: 0, alerts: 0, takedowns: 0, ng: 0 }; }
Game.startRun = function (idx, ng) { Game.resume = null; P.resetRun(); Wp.resetRun(); Game.total = newStats(); Game.ending = ''; Game.run = newRun(); Game.run.ng = ng | 0; Game.refreshDiff(); if (Game.mode) Game.noCut = true; Game.loadLevel(idx || 0); };

/* ---------- saved run: written at every checkpoint, read by CONTINUE ---------- */
Game.saveRun = function (cpIdx) {
  if (Game.mode || Game.debug.noSave) return;
  S.profile.run = { v: 1, level: Game.levelIdx, cp: cpIdx, diff: Game.diff, up: P.up, maxPlates: P.maxPlates, armor: P.armor,
    w: Wp.snapshot(), nades: Ar.snapshot(), run: Game.run, total: Game.total, stats: Game.stats };
  S.save();
};
Game.hasSave = function () { var r = S.profile.run; return !!(r && r.v === 1 && CFG.LEVELS[r.level]); };
Game.continueRun = function () {
  if (!Game.hasSave()) return Game.startRun(0);
  var r = JSON.parse(JSON.stringify(S.profile.run)), k, base = newRun(), ns = newStats();
  Game.setDifficulty(CFG.DIFF[r.diff] ? r.diff : 'normal'); P.resetRun(); Wp.resetRun();
  for (k in P.up) P.up[k] = (r.up && r.up[k]) | 0;
  P.maxHp = Math.round(CFG.PLAYER.hp * (1 + 0.25 * P.up.hp)); P.maxPlates = Math.max(1, r.maxPlates | 0);
  for (k in base) if (r.run && r.run[k] !== undefined) base[k] = r.run[k]; Game.run = base;
  for (k in ns) if (r.total && r.total[k] !== undefined) ns[k] = +r.total[k] || 0; Game.total = ns;
  Game.ending = ''; Game.noCut = true; Game.resume = r; Game.refreshDiff(); Game.loadLevel(r.level);
};
function applyResume(r) {
  var k, ns = newStats(); for (k in ns) if (r.stats && r.stats[k] !== undefined) ns[k] = +r.stats[k] || 0; Game.stats = ns;
  Wp.load(r.w); Ar.restore(r.nades); P.armor = Math.min(P.armorCap(), +r.armor || 0);
  var cp = r.cp >= 0 ? W.checkpoints[r.cp] : null; if (!cp) return;
  for (k = 0; k <= r.cp; k++) W.setCheckpointReached(W.checkpoints[k]);
  P.place(0, cp.z + 1.5); snap = takeSnap(0, cp.z + 1.5, cp.z); buildPending(cp.z);
}
Game.loadLevel = function (idx) {
  Game.levelIdx = idx; var L = CFG.LEVELS[idx];
  E.reset(); H.reset(); FX.reset(); clearPickups(); UI.clearFloat(); I.clear();
  W.build(L); E.baseEmis = L.pal.enemyGlow || 0;
  var unlock = Wp.unlockFor(idx); Wp.refill(true);
  P.hp = P.maxHp; P.place(0, 3);
  Game.stats = newStats(); Game.bossFight = Game.bossDying = Game.bossDead = false; Game.timescale = 1; slowT = 0; acc = 0; supplyT = 12;
  buildPending(1e9); (L.pickups || []).forEach(function (p) { Game.spawnPickup(p[0], p[1], p[2]); });
  Game.boss = B.create(L.boss);
  levelSnap = snap = takeSnap(0, 3, 1e9);
  if (Game.resume) { applyResume(Game.resume); Game.resume = null; }
  if (Game.mode === 'bossrush' || Game.mode === 'survival') {       // straight to the arena
    var az = Game.mode === 'survival' ? W.AC + 6 : W.A0 + 7; P.place(0, az); pending.length = 0; snap = levelSnap = takeSnap(0, az, -1e9);
    for (var q = 0; q < W.checkpoints.length; q++) W.setCheckpointReached(W.checkpoints[q]);
    if (Game.mode === 'survival') { W.setBarrier('entry', false); E.release(Game.boss); P.armor = P.armorCap(); }
  }
  setObjective(); UI.setLevelHeader(L); UI.bossBar(null); UI.hud(false);
  Game.state = 'intro'; I.exitLock(); A.setIntensity(-1); UI.refreshTouch(); bossSeen = false; Ev.emit('level_load', idx); Game.saveRun(snap.cpZ > 1e8 ? -1 : cpIndex(snap.cpZ));
  var brief = function () { UI.showIntro(L, unlock); };
  if (Game.noCut) { Game.noCut = false; brief(); } else { UI.show(null); St.cutscene('l' + (idx + 1) + '_open', brief); }
  Cam.compute(1, 0);
};
function cpIndex(z) { for (var i = 0; i < W.checkpoints.length; i++) if (W.checkpoints[i].z === z) return i; return -1; }
// the field bench: open at any checkpoint flag you have reached
Game.nearBench = function () { for (var i = 0; i < W.checkpoints.length; i++) { var cp = W.checkpoints[i]; if (cp.reached && Math.abs(P.pos.z - cp.z) < 7 && Math.abs(P.pos.x - (cp.x || 0)) < 9) return true; } return false; };
Game.openBench = function () {
  if (Game.state !== 'playing') return; Game.state = 'bench'; Game.benchUsed = true; St.pause(true); I.exitLock(); I.clear(); A.setIntensity(-1); UI.refreshTouch();
  Pk.open(function () { St.pause(false); Game.saveRun(cpIndex(snap.cpZ)); Game.beginPlay(); });
};
Game.beginPlay = function () {
  A.init(); A.setAmbient(true); A.setIntensity(Game.bossFight ? 1 : 0);
  Game.state = 'playing'; UI.show(null); UI.hud(true); I.clear(); I.requestLock(); last = performance.now();
};
Game.pause = function () {
  if (Game.state === 'playing') { Game.state = 'paused'; St.pause(true); UI.show('scrPause'); I.exitLock(); I.clear(); A.setIntensity(-1); UI.refreshTouch(); }
  else if (Game.state === 'paused') { St.pause(false); Game.beginPlay(); }
};
Game.toTitle = function () {
  St.reset(); St.pause(false); Game.state = 'title'; Game.mode = ''; UI.hud(false); UI.refreshTitle(); UI.show('scrTitle'); I.exitLock(); A.setIntensity(-1); A.setAmbient(false); A.setDrone(0); P.model.g.visible = false; UI.refreshTouch();
};
Game.onPlayerDead = function () { Game.run.deaths = (Game.run.deaths || 0) + 1; Ev.emit('player_dead'); Game.state = 'dying'; deadT = 1.5; Game.timescale = 1; slowT = 0; };
Game.retryCheckpoint = function () {
  if (Game.mode === 'survival') { JO.Meta.startMode('survival'); return; }
  St.clear(); St.endCine(); Ev.emit('retry'); E.reset(); H.reset(); FX.reset(); UI.clearFloat(); I.clear();
  Wp.restore(snap.w); P.armor = snap.armor; P.hp = P.maxHp; P.place(snap.x, snap.z); P.invuln = 2;      // brief spawn protection
  buildPending(snap.cpZ); Game.bossFight = Game.bossDying = false; Game.timescale = 1; slowT = 0; supplyT = 12;
  if (!Game.bossDead) { Game.boss = B.create(CFG.LEVELS[Game.levelIdx].boss); W.resetBarriers(); }
  UI.bossBar(null); setObjective(); Game.beginPlay();
};
Game.restartLevel = function () { if (Game.mode === 'survival') { St.pause(false); JO.Meta.startMode('survival'); return; } St.pause(false); Game.noCut = true; Wp.restore(levelSnap.w); P.armor = levelSnap.armor; Game.loadLevel(Game.levelIdx); };

function startBoss() {
  Game.bossFight = true; W.setBarrier('entry', false); A.play('gate'); Game.boss.start(); UI.bossBar(Game.boss); setObjective();
  A.setIntensity(1); pending.length = 0; E.clearRegulars(true); supplyT = 18; Ev.emit('boss_start', Game.boss, !bossSeen); if (bossSeen) UI.banner(Game.boss.name, 2.6, true); bossSeen = true;
}
Game.onBossDying = function (b) {
  Game.bossDying = true; Ev.emit('boss_dying', b); H.reset(); FX.clearBullets(); E.clearRegulars(true);
  Game.timescale = b.kind === 'commander' ? 0.2 : 0.45; slowT = b.kind === 'commander' ? 2.0 : 0.7;     // slow-motion final hit
};
Game.onBossDead = function (b) {
  if (b.spared) { Game.run.spared = true; Game.run.mercy += 2; } else Game.stats.kills++;
  Ev.emit('boss_dead', b); Game.bossDying = false; Game.bossDead = true; Game.bossFight = false; Game.timescale = 1; slowT = 0;
  W.setBarrier('entry', true); W.setBarrier('exit', true); W.flag.grp.visible = true; UI.bossBar(null); setObjective();
  A.setIntensity(0); A.play('gate'); A.play('checkpoint'); UI.banner(b.spared ? b.name + ' STANDS DOWN — REACH THE FLAG' : b.name + ' DEFEATED — REACH THE FLAG', 3.5, false);
  Game.spawnPickup('health', b.pos.x + 1.5, b.pos.z); Game.spawnPickup('ammo', b.pos.x - 1.5, b.pos.z);
};
function completeLevel() {
  var t = Game.total, s = Game.stats; t.time += s.time; t.kills += s.kills; t.shots += s.shots; t.hits += s.hits; t.dmgTaken += s.dmgTaken;
  I.exitLock(); I.clear(); UI.hud(false); A.play('win'); A.setIntensity(-1); A.setDrone(0);
  var L = CFG.LEVELS[Game.levelIdx];
  St.clear(); Ev.emit('level_complete', Game.levelIdx);
  if (Game.levelIdx >= CFG.LEVELS.length - 1) { if (!Game.mode) { S.profile.run = null; S.save(); } Game.state = 'win'; UI.showWin(t, Game.ending, Game.run); UI.refreshTouch(); return; }
  Game.state = 'done'; UI.refreshTouch();
  var pool = CFG.UPGRADES.slice(), choices = [];
  while (choices.length < 3) choices.push(pool.splice((Math.random() * pool.length) | 0, 1)[0]);
  St.cutscene('l' + (Game.levelIdx + 1) + '_close', function () { UI.showDone(L, s, choices, function (id) { A.play('ui'); P.applyUpgrade(id); Game.loadLevel(Game.levelIdx + 1); }); });
}
Game.completeLevel = completeLevel;

/* ---------- one fixed logic step ---------- */
function step(dt) {
  if (Game.state === 'dying') { deadT -= dt; if (deadT <= 0) { Game.state = 'dead'; I.exitLock(); A.setIntensity(-1); UI.hud(false); UI.refreshTouch();
    UI.showDead(Game.mode === 'survival' ? 'You held the arena until wave ' + JO.Meta.wave + '. Best: wave ' + (S.profile.best.survival | 0) + '.' : (Game.bossFight ? Game.boss.name + ' still stands. You will restart at the arena gate.' : 'The jungle keeps what it takes. Your last checkpoint is waiting.')); return; } }
  Game.hint = '';
  if (Game.debug.bot) bot(dt);
  if (Pr.hack) { I.moveX = I.moveY = 0; I.fire = false; I.sprint = false; I.jumpPressed = I.rollPressed = false; }      // hands are on the terminal
  if (St.cine) { I.moveX = I.moveY = 0; I.fire = I.ads = I.sprint = false; I.jumpPressed = I.rollPressed = false; P.invuln = Math.max(P.invuln, 0.3); if (Game.boss && Game.boss.state === 'intro') Game.boss.stateT = Math.max(Game.boss.stateT, St.cine.t); }
  Cam.compute(1, 0);
  P.update(dt); Wp.update(dt);
  Game.stats.time += dt;

  spawnT -= dt;
  if (spawnT <= 0 && !Game.bossFight && !Game.bossDead && !Game.debug.noSpawn) { spawnT = 0.15; var n = E.count();
    for (var i = 0; i < pending.length && n < CFG.MAX_ACTIVE; i++) { var s = pending[i]; if (P.pos.z > s.trig) continue;
      E.spawn(s.type, s.x, s.z, s.type === 'sniper' ? { y: 4.88, alt: s.alt } : null); pending.splice(i, 1); i--; n++; } }
  E.update(dt); H.update(dt); Ar.update(dt); Sl.update(dt); Pr.update(dt); FX.updateBullets(dt); updatePickups(dt); JO.Codex.update(dt); JO.Sys.step(dt);
  if (P.dead) { I.endStep(); return; }

  for (var c = 0; c < W.checkpoints.length; c++) { var cp = W.checkpoints[c]; if (cp.reached || P.pos.z > cp.z) continue;
    W.setCheckpointReached(cp); P.hp = Math.min(P.maxHp, P.hp + CFG.PLAYER.checkpointHeal);
    if (Wp.slots[0].reserve < CFG.PLAYER.checkpointAmmo) Wp.slots[0].reserve = CFG.PLAYER.checkpointAmmo;      // flags double as a rifle resupply
    snap = takeSnap(0, cp.z + 1.5, cp.z);
    A.play('checkpoint'); UI.banner('CHECKPOINT — HEALED AND RESUPPLIED', 2.2, false); Ev.emit('checkpoint', Game.levelIdx, c); Game.saveRun(c); }
  var atBench = !Game.bossFight && !Game.mode && E.count() === 0 && Game.nearBench(); if (!atBench) Game.benchUsed = false;      // the prompt returns only after walking away and back
  if (atBench && !Game.hint) { if (!Game.benchUsed) Game.hint = I.isTouch ? 'TAP <kbd>BENCH</kbd> — SKILLS AND WEAPON MODS' : 'PRESS <kbd>B</kbd> — FIELD BENCH: SKILLS AND WEAPON MODS'; Game.benchHere = true; if (I.benchPressed) { I.endStep(); Game.openBench(); return; } } else Game.benchHere = false;
  if (Game.mode === 'survival') JO.Meta.survivalStep(dt);
  else if (!Game.bossFight && !Game.bossDead && P.pos.z < W.A0 - 5) startBoss();
  if (Game.bossDead && Math.hypot(P.pos.x - W.flag.x, P.pos.z - W.flag.z) < (JO.Finale.mira ? 4.2 : 2.8)) { if (JO.Finale.mira) JO.Finale.begin(); else completeLevel(); I.endStep(); return; }

  // boss-arena safety net so nobody is soft-locked without ammo or health
  if (Game.bossFight && !Game.bossDying) { supplyT -= dt;
    var ammo = 0; for (var k = 0; k < Wp.slots.length; k++) if (Wp.slots[k].unlocked) ammo += Wp.slots[k].mag + Wp.slots[k].reserve;
    if (ammo < 20 && supplyT > 3) supplyT = 3;
    if (supplyT <= 0) { supplyT = 15; var need = Wp.slots[0].reserve < 80 ? 'ammo' : (P.hp < P.maxHp * 0.5 ? 'health' : null);
      if (need) { var a = Math.random() * 6.28, x = Math.max(-22, Math.min(22, P.pos.x + Math.cos(a) * 7)), z = Math.max(W.A1 + 4, Math.min(W.A0 - 4, P.pos.z + Math.sin(a) * 7));
        Game.spawnPickup(need, x, z); if (need === 'ammo' && P.hp < P.maxHp * 0.5) Game.spawnPickup('health', x + 1.2, z);
        FX.burst(x, 1, z, 14, 0x58e0d0, 4, 0.6, 0, 0.16, 3); A.play('pickup'); UI.banner('SUPPLY DROP', 1.4, false); } } }
  I.endStep();
}

/* ---------- frame ---------- */
function frame(now) {
  requestAnimationFrame(frame);
  var real = Math.min(0.1, (now - last) / 1000); last = now; if (!(real > 0)) real = 0.016;
  try { tick(real); } catch (err) { if (Game.debug.errors.length < 20) Game.debug.errors.push(String(err && err.stack || err)); console.error(err); }
}
function tick(real) {
  var fdt = 0, alpha = 1, st = Game.state, cam = W.camera;
  if (st === 'playing' || st === 'dying') {
    I.poll();
    if (slowT > 0) { slowT -= real; if (slowT <= 0) Game.timescale = 1; }
    if (Game.debug.speed > 1) { for (var k = 0; k < Game.debug.speed && (Game.state === 'playing' || Game.state === 'dying'); k++) step(STEP); fdt = STEP * Game.debug.speed; }
    else if (stopT > 0) { stopT -= real; alpha = acc / STEP; }       // hit-stop: the world holds for a few frames
    else { acc += real * Game.timescale; var n = 0; while (acc >= STEP && n < 5 && (Game.state === 'playing' || Game.state === 'dying')) { step(STEP); acc -= STEP; n++; }
      if (n === 5) acc = 0; alpha = acc / STEP; fdt = real * Game.timescale; }
  }
  if (Game.state === 'finale') { JO.Finale.camera(cam, real); P.animate(real); P.model.g.visible = true; W.update(real); FX.update(real, W.time); W.updateSun(P.pos.x, P.pos.z); }
  else if (Game.state === 'title') {
    titleT += real; var z = -((titleT * 2.2) % 200) - 6;
    cam.position.set(Math.sin(titleT * 0.23) * 5, 3.6 + Math.sin(titleT * 0.4) * 0.6, z); cam.lookAt(Math.sin(titleT * 0.17) * 3, 2.6, z - 20);
    if (cam.fov !== 65) { cam.fov = 65; cam.updateProjectionMatrix(); }
    W.update(real); W.updateSun(0, z - 10);
  } else {
    Cam.compute(alpha, real); if (!St.cineCamera(cam, real * Math.max(1, Game.debug.speed || 1))) Cam.apply(cam); P.animate(fdt); P.model.g.visible = Cam.dist > 1.25 && !P.driving; Sl.hud(); W.update(fdt); FX.update(fdt, W.time); W.updateSun(P.pos.x, P.pos.z);
    UI.update(real, cam);
  }
  if (Game.state !== 'paused') St.update(real); St.cutUpdate(real);
  A.update(real); if (JO.Music) JO.Music.update(real);
  if (dbgOn) { dbgT -= real; if (dbgT <= 0) { dbgT = 0.2; debugOverlay(real); } }
  JO.Weather.update(fdt, real); JO.Radar.update(real); JO.Meta.frame(real); JO.Sys.frame(fdt, real);
  if (!Game.debug.noRender) JO.Post.render(W.scene, cam, real);
}

// tests: advance game time synchronously. sec of logic steps, with one visual frame every `every` steps.
Game.debug.run = function (sec, every) {
  var n = Math.round(sec / STEP), i; every = every || 1; I.external = true;
  for (i = 0; i < n && (Game.state === 'playing' || Game.state === 'dying'); i++) { step(STEP);
    if (i % every === 0) { var fd = STEP * every; Cam.compute(1, fd); Cam.apply(W.camera); P.animate(fd); W.update(fd); FX.update(fd, W.time); JO.Weather.update(fd, fd); JO.Meta.frame(fd); JO.Sys.frame(fd, fd); } }
  return i;
};

/* ---------- debug overlay (F3): what is under the crosshair, and what the asset layer loaded ---------- */
var dbgOn = false, dbgT = 0, dbgEl = null, DH = { t: 0, enemy: null, part: null, missile: null }, fpsAvg = 60;
function countTris(obj) {
  if (obj.userData.joTris === undefined) { var n = 0; obj.traverse(function (o) { if (o.isMesh && o.geometry) { var g = o.geometry; n += (g.index ? g.index.count : g.attributes.position.count) / 3; } }); obj.userData.joTris = Math.round(n); }
  return obj.userData.joTris;
}
function describe(label, gfx, mesh, state) {
  return label + '\n  model: ' + (gfx ? gfx.name + '.glb' : 'primitive (built-in)') + '\n  triangles: ' + (gfx ? gfx.tris : countTris(mesh)) + '\n  animation: ' + (gfx ? gfx.activeClip() : state);
}
function debugOverlay(real) {
  fpsAvg += (1 / Math.max(0.001, real) - fpsAvg) * 0.2;
  var txt;
  if (Game.state === 'playing' || Game.state === 'dying') {
    var s = Cam.dist + 0.2; E.hitscan(Cam.x + Cam.fx * s, Cam.y + Cam.fy * s, Cam.z + Cam.fz * s, Cam.fx, Cam.fy, Cam.fz, 250, DH);
    var e = DH.enemy;
    txt = e ? describe('CROSSHAIR: ' + (e.isBoss ? e.name : e.type) + '  (' + DH.t.toFixed(1) + ' m, part ' + DH.part.tag + ')', e.gfx, e.mesh, 'state ' + e.state + (e.sub ? ' / ' + e.sub : ''))
            : describe('CROSSHAIR: nothing — showing PLAYER', P.gfx, P.model.g, 'procedural walk');
    var w = P.wpn[P.wpnCur]; if (w) txt += '\nweapon: ' + w.name + (w.entry ? '.glb' : '') + ', ' + w.tris + ' tris';
  } else txt = 'start a level to inspect models';
  var info = W.renderer.info.render;
  dbgEl.textContent = txt + '\n\nASSETS\n  ' + JO.Assets.summary().join('\n  ') + '\n\n' + Math.round(fpsAvg) + ' fps (sampled) · ' + info.calls + ' draw calls · ' + info.triangles + ' tris on screen\nF3 hides this panel';
}
Game.toggleDebug = function (on) {
  dbgOn = on === undefined ? !dbgOn : on; dbgEl = dbgEl || document.getElementById('dbg'); dbgEl.classList.toggle('hidden', !dbgOn); dbgT = 0;
};

/* ---------- boot ---------- */
function bind(id, fn) { document.getElementById(id).addEventListener('click', function (e) { A.init(); A.play('ui'); fn(e); }); }
Game.init = function () {
  var canvas = document.getElementById('game');
  W.init(canvas); FX.init(W.scene); H.init(W.scene); E.init(W.scene); P.init(W.scene); initPickups(W.scene); UI.init(); I.init(canvas); St.init(); Pk.init(); Ar.init(W.scene); Sl.init(); Pr.init(); JO.Weather.init(); JO.Radar.init(); JO.Post.init(); JO.Meta.init(); JO.Codex.init(W.scene); JO.Finale.init(W.scene); JO.Sys.init();
  FX.pMat.uniforms.uScale.value = window.innerHeight;
  W.build(CFG.LEVELS[0]); P.model.g.visible = false;                       // title backdrop
  // models load behind the title screen; whatever fails simply stays primitive
  var bar = document.getElementById('loadFill'), ltx = document.getElementById('loadTxt'), startBtn = document.getElementById('btnStart');
  startBtn.disabled = true;
  JO.Assets.loadAll(function (done, total, name) { bar.style.transform = 'scaleX(' + (done / total) + ')'; ltx.textContent = 'LOADING MODELS  ' + done + ' / ' + total; },
    function () { var bad = JO.Assets.total - Object.keys(JO.Assets.entries).length; P.attachModels(); upgradePickups(); startBtn.disabled = false;
      if (Game.state === 'title') W.build(CFG.LEVELS[0]);                    // rebuild the backdrop with GLB scenery
      P.model.g.visible = false;
      ltx.textContent = bad ? (JO.Assets.total - bad) + ' / ' + JO.Assets.total + ' MODELS LOADED — ' + bad + ' USING BUILT-IN SHAPES' : 'ALL ' + JO.Assets.total + ' MODELS LOADED';
      document.getElementById('loadWrap').classList.add('done'); });
  window.addEventListener('keydown', function (e) { if (e.code === 'F3') { e.preventDefault(); Game.toggleDebug(); } });
  I.onLook = P.look; var pauseAt = 0;
  function togglePause() { var n = performance.now(); if (n - pauseAt < 350) return; pauseAt = n; if (Game.state === 'playing' || Game.state === 'paused') Game.pause(); }
  I.onPause = togglePause;
  I.onLockLost = function () { if (Game.state === 'playing') togglePause(); };
  I.onCanvasClick = function () { if (Game.state === 'playing') I.requestLock(); };
  I.onMute = function () { muted = !muted; A.setMute(muted); UI.setMute(muted); };
  window.addEventListener('resize', function () { W.resize(); FX.pMat.uniforms.uScale.value = window.innerHeight; });
  document.addEventListener('visibilitychange', function () { if (document.hidden && Game.state === 'playing') Game.pause(); });

  bind('btnStart', function () { Game.mode = ''; Game.startRun(0); });
  bind('btnContinue', function () { Game.mode = ''; Game.continueRun(); });
  bind('btnBench', function () { Pk.open(function () { UI.refreshTitle(); UI.show('scrTitle'); }); });
  bind('btnDoneBench', function () { Pk.open(function () { UI.show('scrDone'); }); });
  UI.refreshTitle();
  var ctlFrom = 'scrTitle';
  function ctlTab(t) { var bs = document.getElementById('ctlTabs').querySelectorAll('button'); for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('on', bs[i].getAttribute('data-tab') === t);
    ['ctlKb', 'ctlKbNote'].forEach(function (id) { document.getElementById(id).classList.toggle('hidden', t !== 'kb'); }); ['ctlPad', 'ctlPadNote'].forEach(function (id) { document.getElementById(id).classList.toggle('hidden', t !== 'pad'); }); }
  function openControls(from) { ctlFrom = from; ctlTab(JO.Feel && JO.Feel.padOn ? 'pad' : 'kb'); UI.show('scrControls'); }
  document.getElementById('ctlTabs').addEventListener('click', function (e) { var t = e.target.getAttribute && e.target.getAttribute('data-tab'); if (!t) return; A.play('ui'); ctlTab(t); });
  bind('btnControls', function () { openControls('scrTitle'); }); bind('btnPauseControls', function () { openControls('scrPause'); });
  bind('btnCodex', function () { JO.Codex.open('scrTitle'); }); bind('btnPauseCodex', function () { JO.Codex.open('scrPause'); });
  I.onCodex = function () { if (Game.state === 'playing') { togglePause(); if (Game.state === 'paused') JO.Codex.open('scrPause'); } };
  bind('btnControlsBack', function () { UI.show(ctlFrom); });
  bind('btnDeploy', function () { Game.beginPlay(); UI.banner(CFG.LEVELS[Game.levelIdx].name, 2.2, false); Ev.emit('level_start', Game.levelIdx); });
  bind('btnResume', function () { pauseAt = performance.now(); Game.pause(); });
  bind('btnPauseRestart', Game.restartLevel); bind('btnPauseQuit', Game.toTitle);
  bind('btnRetry', Game.retryCheckpoint); bind('btnRestart', Game.restartLevel); bind('btnQuit', Game.toTitle);
  bind('btnAgain', function () { Game.toTitle(); });
  document.getElementById('btnMute').addEventListener('click', function () { A.init(); I.onMute(); });
  document.getElementById('btnPause').addEventListener('click', function () { I.onPause(); });
  var drow = document.getElementById('diffRow');
  drow.addEventListener('click', function (e) { var d = e.target.getAttribute && e.target.getAttribute('data-d'); if (!d) return;
    A.init(); A.play('ui'); Game.setDifficulty(d); var bs = drow.querySelectorAll('button'); for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('on', bs[i] === e.target); });
  last = performance.now(); requestAnimationFrame(frame);
};

/* ============================================================
   PLAYTEST BOT (debug only: JO.Game.debug.bot = true)
   Drives the normal input state so every level can be smoke-
   tested end to end. Never active in normal play.
   ============================================================ */
var AP = { x: 0, y: 0, z: 0 }, TP = { x: 0, y: 0, z: 0 }, botT = 0, botNade = 3, rollT = 2, stuckT = 0, lastX = 0, lastZ = 0, sideT = 0, sideDir = 1;
function bot(dt) {
  I.external = true; botT += dt; rollT -= dt;
  var best = null, bd = 1e9, L = E.list, i, hx = P.pos.x, hy = P.pos.y + 1.5, hz = P.pos.z, d, dx, dy, dz;
  for (i = 0; i < L.length; i++) { var e = L[i]; if (!e.alive || !e.active) continue; if (e.isBoss && (!Game.bossFight || e.invulnerable())) continue;
    if (e.aimPoint) e.aimPoint(AP); else { AP.x = e.pos.x; AP.y = e.pos.y + (e.type === 'drone' ? 0 : (e.type === 'shield' && !e.shieldOpen ? 0.3 : 1.2)); AP.z = e.pos.z; }
    dx = AP.x - hx; dy = AP.y - hy; dz = AP.z - hz; d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d > 75) continue;
    if (W.raycast(hx, hy, hz, dx / d, dy / d, dz / d, d) < d - 0.6) continue;
    var sc = d + (e.isBoss ? 12 : 0); if (sc < bd) { bd = sc; best = e; TP.x = AP.x; TP.y = AP.y; TP.z = AP.z; } }
  for (i = 0; i < H.missiles.length; i++) { var ms = H.missiles[i]; if (!ms.active || ms.t < 0.6) continue; d = Math.hypot(ms.x - hx, ms.y - hy, ms.z - hz);
    if (d < 18 && d < bd + 30) { bd = -1; best = ms; best.pos = ms; TP.x = ms.x; TP.y = ms.y; TP.z = ms.z; break; } }
  I.moveX = 0; I.moveY = 0; I.fire = false; I.ads = false; I.sprint = false;
  var gx, gz;
  if (best) {
    dx = TP.x - Cam.x; dy = TP.y - Cam.y; dz = TP.z - Cam.z; d = Math.hypot(P.pos.x - best.pos.x, P.pos.z - best.pos.z);
    var sk = Game.debug.skill === undefined ? 1 : Game.debug.skill, jit = (1 - sk) * 0.035;
    P.yaw = Math.atan2(dx, dz) + Math.sin(botT * 7.3) * jit; P.pitch = Math.atan2(dy, Math.hypot(dx, dz)) - P.kick + Math.sin(botT * 5.1) * jit * 0.6; I.fire = true; I.ads = d > 24;
    var has = function (k) { return Wp.slots[k].unlocked && Wp.slots[k].mag + Wp.slots[k].reserve > 0; };
    var want = (d < 9 && has(1)) ? 2 : ((d > 30 && has(2)) ? 3 : (has(0) ? 1 : (has(2) ? 3 : (has(1) ? 2 : 1))));
    if (Wp.cur !== want - 1 && Wp.reloading <= 0) I.weapon = want;
    I.moveX = (sk < 0.7 && Math.sin(botT * 0.45) > 0) ? 0 : (Math.sin(botT * 1.4) > 0 ? 1 : -1);
    if (best.isBoss && best.kind === 'brute' && best.state === 'stun') { gx = best.pos.x - Math.sin(best.yaw) * 6; gz = best.pos.z - Math.cos(best.yaw) * 6; steer(gx, gz, 1); }
    else if (d < (best.isBoss ? 13 : 7)) I.moveY = -1; else if (d > 26 && best.type !== 'sniper') I.moveY = 0.7;
    if (rollT <= 0 && P.stamina > 45) { rollT = (sk < 0.7 ? 5 : 2.4) + Math.random(); I.rollPressed = true; }
    botNade -= dt; if (botNade <= 0 && d > 9 && d < 24 && !best.isBoss && best.type !== 'drone' && best.type !== 'sniper' && E.count() >= 2) { botNade = 7; if (Ar.count.frag > 0) I.nadePressed = true; else if (Ar.count.smoke > 0) I.smokePressed = true; }
  } else {
    if (Game.bossDead) { gx = W.flag.x; gz = W.flag.z; } else if (Game.bossFight && Game.boss.state === 'beaten') { gx = Game.boss.pos.x; gz = Game.boss.pos.z; if (Game.debug.finish) I.meleePressed = true; else if (Game.boss.dist < 6) I.interactPressed = true; } else if (Game.bossFight) { gx = Math.sin(botT) * 12; gz = W.AC + Math.cos(botT) * 12; }
    else { var pg = Pr.botGoal(), hold = false; if (pg) { gx = pg.x; gz = pg.z; if (pg.use) I.interactPressed = true; hold = !!pg.stop || (pg.use && Math.hypot(gx - P.pos.x, gz - P.pos.z) < 0.5); } else { gx = 0; gz = P.pos.z - 12; } }
    P.pitch = -0.05; P.yaw = Math.atan2(gx - P.pos.x, gz - P.pos.z); I.moveY = 1; I.sprint = true;
    if (hold) { I.moveY = 0; I.sprint = false; stuckT = 0; }
    if (sideT > 0) { sideT -= dt; I.moveX = sideDir; }
  }
  stuckT += dt;
  if (stuckT > 0.6) { if (Math.hypot(P.pos.x - lastX, P.pos.z - lastZ) < 0.8 && !best) { sideT = 0.8; sideDir = Math.random() < 0.5 ? -1 : 1; I.jumpPressed = true; } stuckT = 0; lastX = P.pos.x; lastZ = P.pos.z; }
  if (H.waveNear()) I.jumpPressed = true;
  if (P.nearCrate) I.interactPressed = true;
  function steer(x, z, k) { var vx = x - P.pos.x, vz = z - P.pos.z, l = Math.hypot(vx, vz) || 1, sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
    vx /= l; vz /= l; I.moveY = (vx * sy + vz * cy) * k; I.moveX = (-vx * cy + vz * sy) * k; }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', Game.init); else Game.init();
})();
