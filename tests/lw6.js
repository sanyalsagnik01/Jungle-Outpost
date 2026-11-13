const h = require('./h');
(async () => {
  const { browser, page, errors } = await h.launch();
  const C = []; let r;
  await h.start(page, 0, { quality: 'med', noSpawn: true });
  await h.adv(page, 0.5);
  r = await page.evaluate(() => { const So = JO.Sound, P = JO.Player, W = JO.World, A = JO.Audio; JO.Enemies.reset(); P.place(0, -6); P.yaw = Math.PI; JO.Game.debug.run(0.2);
    const out = { ready: So.ready, ctx: !!A.ctx, voices: So.voices.length };
    A.playAt('enemyShot', 12, -6); out.left = So.lastPan; A.playAt('enemyShot', -12, -6); out.right = So.lastPan; A.playAt('enemyShot', 0, -30); out.front = [So.lastPan, So.lastCut, So.lastVol]; A.playAt('enemyShot', 0, 20); out.behindCut = So.lastCut;
    A.playAt('enemyShot', 0, -60); out.farVol = So.lastVol; A.playAt('enemyShot', 0, -200); out.played = So.played;
    const box = W.addBox(0, -16, 4, 1, 4, { mat: 'stone' }); A.playAt('enemyShot', 0, -26); out.occ = [So.lastOcc, So.lastCut, So.lastVol]; box.on = false; A.playAt('enemyShot', 0, -26); out.clear = [So.lastOcc, So.lastCut, So.lastVol]; return out; });
  C.push(['advanced audio graph wired', r.ready && r.ctx && r.voices === 20, r]);
  C.push(['sounds are panned to their side', r.left * r.right < 0 && Math.abs(r.left) > 0.8 && Math.abs(r.front[0]) < 0.05, [r.left, r.right, r.front[0]]]);
  C.push(['distance and facing shape the sound', r.farVol < r.front[2] * 0.5 && r.behindCut < 10000 && r.front[1] === 20000 && r.played === 5, r]);
  C.push(['cover between you and a sound muffles it', r.occ[0] && r.occ[1] < 1500 && r.occ[2] < r.clear[2] * 0.7 && !r.clear[0], [r.occ, r.clear]]);
  // spaces
  r = await page.evaluate(() => { const So = JO.Sound, P = JO.Player, G = JO.Game, W = JO.World; G.debug.run(0.2); const a = So.space; P.pos.set(0, 0, W.AC); G.debug.noSpawn = true; G.debug.run(0.1); const b = So.space; JO.Meta.set.reverbFx = false; G.debug.run(0.1); const c = So.space; JO.Meta.set.reverbFx = true; return [a, b, c]; });
  C.push(['reverb space follows where you stand; can be switched off', r[0] === 'jungle' && r[1] === 'arena' && r[2] === 'none', r]);
  await h.start(page, 1, { quality: 'med', noSpawn: true }); await h.adv(page, 0.3);
  r = await page.evaluate(() => JO.Sound.space); C.push(['the ruins have their own space', r === 'stone', r]);
  // dynamic mix + ringing + heartbeat
  await h.start(page, 0, { quality: 'med', noSpawn: true, god: false }); await h.adv(page, 0.3);
  r = await page.evaluate(() => { const So = JO.Sound, G = JO.Game, P = JO.Player; JO.Enemies.reset(); P.place(0, -6); const d0 = So.duck; for (let i = 0; i < 12; i++) JO.Events.emit('noise', 0, -6, 38, 'shot'); G.debug.run(0.6); const d1 = So.duck, heat = So.heat; G.debug.run(6); const d2 = So.duck;
    JO.Arsenal.blast(2, 0.3, -6, 5, 0, 0); G.debug.run(0.1); const ring = So.ring, muf = So.muffle; G.debug.run(5); const ring2 = So.ring;
    JO.Meta.set.tinnitus = false; JO.Arsenal.blast(2, 0.3, -6, 5, 0, 0); G.debug.run(0.1); const ringOff = So.ring, mufOff = So.muffle; JO.Meta.set.tinnitus = true; G.debug.run(4);
    const b0 = So.beats; P.hp = 20; P.sinceDmg = 0; G.debug.run(4.8); const slow = So.beats - b0; P.hp = 4; P.sinceDmg = 0; const b1 = So.beats; G.debug.run(4.8); const fast = So.beats - b1; P.hp = 100; const b2 = So.beats; G.debug.run(2);
    return { d0, d1, d2, heat, ring, muf, ring2, ringOff, mufOff, slow, fast, none: So.beats - b2, dead: JO.Sys.list.filter(s => s.dead).map(s => s.name), errs: G.debug.errors }; });
  C.push(['music ducks under gunfire and comes back', r.d1 < r.d0 - 0.15 && r.d2 > r.d1 + 0.1, [r.d0, r.d1, r.d2]]);
  C.push(['a close blast rings and muffles, then clears', r.ring > 0.4 && r.muf > 0.5 && r.ring2 === 0, [r.ring, r.muf, r.ring2]]);
  C.push(['ringing can be switched off (muffle stays)', r.ringOff === 0 && r.mufOff > 0.5, [r.ringOff, r.mufOff]]);
  C.push(['heartbeat at low health, faster when worse, gone when healed', r.slow >= 3 && r.fast > r.slow && r.none === 0, [r.slow, r.fast, r.none]]);
  C.push(['no runtime errors', !r.dead.length && !r.errs.length, r.errs]);
  const bad = h.report('LW6', C, errors); await browser.close(); process.exit(bad ? 1 : 0);
})();
