const h = require('./h');
(async () => {
  const { browser, page, errors } = await h.launch();
  const C = []; let r;
  await h.start(page, 0, { quality: 'high', noSpawn: true });
  await h.adv(page, 4, 2);
  r = await page.evaluate(() => { const At = JO.Atmos; return { shafts: At.shafts, k: At.shaftK, dust: At.dustN, sheets: At.sheets, fog: At.fogK, pud: At.puddles.length, hour: JO.Weather.hour, look: JO.Post.look.toArray(), sat: JO.Post.satK }; });
  C.push(['dawn: shafts and dust placed and lit', r.shafts === 16 && r.k > 0.5 && r.dust > 100, r]);
  C.push(['dawn: ground fog up, warm grade', r.sheets === 4 && r.fog > 0.2 && r.look[0] > r.look[2], r]);
  // rain: shafts fade, world gets wet, puddles appear, steps splash
  r = await page.evaluate(() => { const At = JO.Atmos, G = JO.Game, Wx = JO.Weather; Wx.setState('rain', true); const g0 = JO.World.groundMat.color.r; G.debug.run(30, 6); const p = At.puddles[3]; JO.Player.pos.set(p.x, 0, p.z);
    return { k: At.shaftK, wet: At.wet, darker: JO.World.groundMat.color.r < g0 * 0.9, inPud: At.inPuddle(p.x, p.z), sat: JO.Post.satK }; });
  C.push(['rain: shafts fade, ground darkens, puddles fill', r.k < 0.25 && r.wet > 0.6 && r.darker && r.inPud, r]);
  r = await page.evaluate(() => { const At = JO.Atmos, G = JO.Game, Wx = JO.Weather; Wx.setState('clear', true); const w = At.wet; G.debug.run(40, 8); return { before: w, after: At.wet }; });
  C.push(['the world dries when the rain stops', r.after < r.before - 0.3, r]);
  // storm grade
  r = await page.evaluate(() => { const G = JO.Game, Wx = JO.Weather; const a = JO.Post.satK, c0 = JO.Post.conK; Wx.setState('storm', true); G.debug.run(1, 2); return { clear: a, storm: JO.Post.satK, con: JO.Post.conK > c0, look: JO.Post.look.toArray() }; });
  C.push(['storm: colder, flatter colour, more contrast', r.storm < r.clear * 0.9 && r.con, r]);
  // night level: torches go through the light budget; blasts flash
  await h.start(page, 2, { quality: 'med', noSpawn: true });
  await h.adv(page, 1, 2);
  r = await page.evaluate(() => { const Li = JO.Lights, G = JO.Game; const a = { used: Li.used, n: Li.n, asked: Li.asked }; JO.Arsenal.blast(3, 0.3, -12, 4, 0, 0); G.debug.run(0.1, 1); const mx = Math.max.apply(null, Li.pool.map(p => p.light.intensity)); const ids = Li.pool.map(p => p.id);
    JO.Post.set('low', true); G.debug.run(1.2, 1); const low = { used: Li.used, n: Li.n, shafts: JO.Atmos.shafts, sheets: JO.Atmos.sheets }; JO.Post.set('high', true); G.debug.run(1.2, 1); const high = { used: Li.used, n: Li.n };
    return { a, mx, ids, low, high, k: JO.Atmos.shaftK, hour: JO.Weather.hour, look: JO.Post.look.toArray(), dead: JO.Sys.list.filter(s => s.dead).map(s => s.name), errs: G.debug.errors }; });
  C.push(['torches and lamps share the light pool', r.a.used === r.a.n && r.a.asked > r.a.n, r.a]);
  C.push(['a blast takes a light for its flash', r.ids.some(i => i && i[0] === 'x') && r.mx > 1.5, [r.ids, r.mx]]);
  C.push(['budget follows the tier', r.low.n === 1 && r.low.used === 1 && r.low.shafts === 0 && r.low.sheets === 0 && r.high.n === 6 && r.high.used === 6, [r.low, r.high]]);
  C.push(['night: blue grade', r.look[2] > r.look[0], r.look]);
  C.push(['no runtime errors', !r.dead.length && !r.errs.length, r.errs]);
  for (const [lv, name, setup] of [[0, 'lw5_dawn', () => { JO.Player.place(0, -30); JO.Player.yaw = Math.PI * 0.85; }], [1, 'lw5_rain', () => { JO.Player.place(0, -60); JO.Weather.setState('rain', true); JO.Atmos.wet = 1; }], [2, 'lw5_night', () => { JO.Player.place(0, -30); }]]) {
    await h.start(page, lv, { quality: 'high', noRender: false, noSpawn: true }); await page.evaluate(setup); await page.evaluate(() => JO.Story.clear()); await h.sleep(7000); await page.screenshot({ path: name + '.png' }); }
  r = await page.evaluate(() => ({ errs: JO.Game.debug.errors, calls: JO.Post.calls }));
  C.push(['renders on all three levels', !r.errs.length && r.calls > 20, r]);
  const bad = h.report('LW5', C, errors); await browser.close(); process.exit(bad ? 1 : 0);
})();
