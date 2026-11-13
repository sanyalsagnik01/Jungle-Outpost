const h = require('./h');
(async () => {
  const { browser, page, errors } = await h.launch();
  const C = [];
  C.push(['systems registered', await page.evaluate(() => JO.Sys.list.map(s => s.name).join(',')).then(s => /foliage,wildlife,ambience/.test(s))]);
  await h.start(page, 0, { quality: 'med', noSpawn: true });
  await page.evaluate(() => { JO.Enemies.reset(); });
  await h.adv(page, 1);
  let r = await page.evaluate(() => ({ patched: JO.Foliage.patched, grass: JO.Foliage.count, want: JO.Q.n('grass'), trees: JO.World.trees.length, bushes: JO.World.bushes.length, birds: JO.Wildlife.birds.length, wantB: JO.Q.n('birds'), monkeys: JO.Wildlife.monkeys.length, t: JO.Foliage.uniforms.uTime.value, push: JO.Foliage.uniforms.uPush.value.toArray(), px: JO.Player.pos.x, pz: JO.Player.pos.z }));
  C.push(['foliage materials patched', r.patched > 10, r.patched]);
  C.push(['grass planted to budget (med)', r.grass > r.want * 0.9 && r.grass <= r.want, [r.grass, r.want]]);
  C.push(['scenery recorded', r.trees > 100 && r.bushes > 100, [r.trees, r.bushes]]);
  C.push(['wind clock runs + push follows player', r.t > 0.5 && Math.abs(r.push[0] - r.px) < 0.01 && Math.abs(r.push[1] - r.pz) < 0.01, r.t]);
  C.push(['birds and monkeys to budget', r.birds === r.wantB && r.monkeys === 3, [r.birds, r.monkeys]]);
  // tiers
  const tiers = {}; for (const t of ['low', 'high', 'med']) { await page.evaluate(t => JO.Post.set(t, true), t); tiers[t] = await page.evaluate(() => [JO.Post.tier, JO.Foliage.count, JO.Wildlife.birds.length, JO.Q.n('motes')]); }
  C.push(['tiers change budgets', tiers.low[1] < tiers.med[1] && tiers.med[1] < tiers.high[1] && tiers.low[2] < tiers.high[2], tiers]);
  // setting toggle
  r = await page.evaluate(() => { JO.Meta.set.foliage = false; JO.Sys.get('foliage').quality(); const a = JO.Foliage.count; JO.Meta.set.foliage = true; JO.Sys.get('foliage').quality(); return [a, JO.Foliage.count]; });
  C.push(['foliage setting switches grass off', r[0] === 0 && r[1] > 0, r]);
  // birds scatter on a shot
  r = await page.evaluate(() => { const Wl = JO.Wildlife, fl = Wl.flocks[0], b = Wl.birds[0], y0 = b.y; JO.Events.emit('noise', fl.tree.x, fl.tree.z, 38, 'shot'); return { state: fl.state, y0, sc: Wl.scatters }; });
  await h.adv(page, 1.5);
  let r2 = await page.evaluate(() => ({ y: JO.Wildlife.birds[0].y, st: JO.Wildlife.flocks[0].state, hush: JO.Ambience.hush, lvl: JO.Ambience.level }));
  C.push(['flock takes off on gunfire', r.state === 1 && r2.y > r.y0 + 0.5, [r.y0, r2.y]]);
  C.push(['ambience falls silent', r2.hush > 10 && r2.lvl < 0.05, r2]);
  await h.adv(page, 16, 3);
  r = await page.evaluate(() => ({ st: JO.Wildlife.flocks[0].state, lvl: JO.Ambience.level }));
  C.push(['flock lands again', r.st === 0, r]);
  await h.adv(page, 30, 6);
  r = await page.evaluate(() => ({ lvl: JO.Ambience.level, calls: JO.Ambience.calls, last: JO.Ambience.last, bucket: JO.Ambience.bucket, ctx: !!JO.Audio.ctx }));
  C.push(['ambience recovers within 20-40 s and calls', r.lvl > 0.9 && r.calls > 2, r]);
  // monkey leaps away
  r = await page.evaluate(() => { const m = JO.Wildlife.monkeys[0]; JO.Player.pos.set(m.x + 2, 0, m.z + 2); return { x: m.x, z: m.z, hops: JO.Wildlife.hops }; });
  await h.adv(page, 2);
  r2 = await page.evaluate(() => { const m = JO.Wildlife.monkeys[0]; return { x: m.x, z: m.z, hops: JO.Wildlife.hops }; });
  C.push(['monkey leaps away from the player', r2.hops > r.hops && Math.hypot(r2.x - r.x, r2.z - r.z) > 2, [r, r2]]);
  // blast rolls through the foliage
  r = await page.evaluate(() => { JO.Arsenal.blast(5, 0.4, JO.Player.pos.z - 30, 5, 10, 0); return JO.Foliage.uniforms.uBlast.value.toArray(); });
  C.push(['blast drives the foliage wave', r[3] > 0.5 && r[2] < 0.1, r]);
  // overlay
  r = await page.evaluate(() => { const before = document.getElementById('fps').classList.contains('hidden'); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F2' })); const mid = document.getElementById('fps').classList.contains('hidden'); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F2' })); return [before, mid]; });
  C.push(['F2 toggles the FPS / draw-call overlay', r[0] !== r[1], r]);
  // level 2: fish
  await h.start(page, 1, { quality: 'med', noSpawn: true });
  await page.evaluate(() => { JO.Enemies.reset(); JO.Player.pos.set(6, 0, -100); });
  await h.adv(page, 45, 3);
  r = await page.evaluate(() => ({ fish: JO.Wildlife.fish.length, jumps: JO.Wildlife.jumps, monkeys: JO.Wildlife.monkeys.length }));
  C.push(['fish jump in the river', r.fish === 4 && r.jumps > 1, r]);
  await h.start(page, 2, { quality: 'med' });
  r = await page.evaluate(() => ({ monkeys: JO.Wildlife.monkeys.length, torches: JO.World.torches.length }));
  C.push(['no monkeys at the Outpost, torches recorded', r.monkeys === 0 && r.torches > 10, r]);
  // real rendering: shaders must compile and draw
  await h.start(page, 0, { quality: 'med', noRender: false });
  await page.evaluate(() => { JO.Enemies.reset(); JO.Meta.set.fps = true; JO.Meta.apply(); JO.Player.pos.set(6, 0, -20); JO.Player.yaw = Math.PI * 0.9; });
  await h.sleep(5000);
  await page.screenshot({ path: 'lw1_l1.png' });
  r = await page.evaluate(() => ({ calls: JO.Post.calls, tris: JO.Post.tris, fps: JO.Meta.fpsNow, errs: JO.Game.debug.errors, dead: JO.Sys.list.filter(s => s.dead).map(s => s.name), txt: document.getElementById('fps').textContent }));
  C.push(['renders with patched shaders, draw calls counted', r.calls > 20 && r.tris > 10000 && !r.errs.length && !r.dead.length, r]);
  await page.evaluate(() => { const fl = JO.Wildlife.flocks; for (const f of fl) JO.Events.emit('noise', f.tree.x, f.tree.z, 40, 'shot'); });
  await h.sleep(2500); await page.screenshot({ path: 'lw1_scatter.png' });
  const bad = h.report('LW1', C, errors); await browser.close(); process.exit(bad ? 1 : 0);
})();
