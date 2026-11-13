const h = require('./h');
(async () => { const { browser, page } = await h.launch({ w: 1280, h: 720 });
  for (const lv of [0, 1, 2]) for (const q of ['low', 'med', 'high']) { await h.start(page, lv, { quality: q, noRender: true });
    const r = await page.evaluate(() => { const W = JO.World, Po = JO.Post; JO.Game.debug.run(3, 6); let c = 0, t = 0, ms = 0; for (let i = 0; i < 6; i++) { const t0 = performance.now(); Po.render(W.scene, W.camera, 0.016); W.renderer.getContext().finish(); ms += performance.now() - t0; Po.render(W.scene, W.camera, 0.016); c = Math.max(c, Po.calls); t = Math.max(t, Po.tris); } const t1 = performance.now(); JO.Game.debug.noRender = true; JO.Game.debug.run(5, 1e9); const sim = (performance.now() - t1) / 300; return { calls: c, tris: t, ms: Math.round(ms / 6), sim: +sim.toFixed(2) }; });
    console.log('L' + (lv + 1), q, JSON.stringify(r)); }
  await browser.close(); })();
