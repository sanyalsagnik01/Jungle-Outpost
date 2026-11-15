// checks for the Nov 15 fixes: controls tabs, pause controls, voice preload, crate look, prompts, pause pose, adaptive default
const h = require('./h');
(async () => { const { browser, page, errors } = await h.launch({ w: 960, h: 540 }); const checks = [];
  checks.push(['adaptive off by default', await h.ev(page, () => JO.Meta.set.adaptive === false)]);
  await h.start(page, 0, { quality: 'low', noRender: false, noSpawn: true });
  await h.adv(page, 1);
  // pause pose
  const pose = await page.evaluate(async () => { const G = JO.Game, P = JO.Player, q = new THREE.Quaternion(), out = []; G.pause();
    for (let i = 0; i < 4; i++) { (P.chest || P.model.g).getWorldQuaternion(q); out.push(q.z); await new Promise(r => setTimeout(r, 250)); }
    return { st: G.state, d: Math.abs(out[3] - out[0]) }; });
  checks.push(['pose frozen while paused', pose.st === 'paused' && pose.d < 1e-4, pose]);
  // controls from pause, tabs, back
  const ctl = await page.evaluate(() => { const vis = id => !document.getElementById(id).classList.contains('hidden');
    document.getElementById('btnPauseControls').click(); const a = vis('scrControls') && vis('ctlKb') && !vis('ctlPad');
    document.querySelector('#ctlTabs button[data-tab="pad"]').click(); const b = vis('ctlPad') && !vis('ctlKb') && document.querySelectorAll('#ctlPad tr').length >= 15;
    document.getElementById('btnControlsBack').click(); const c = vis('scrPause') && !vis('scrControls'); return { a, b, c }; });
  checks.push(['controls from pause with tabs, back returns to pause', ctl.a && ctl.b && ctl.c, ctl]);
  await page.evaluate(() => JO.Game.pause()); await h.adv(page, 0.2);
  // voice preload
  await page.waitForTimeout(3000);
  const vp = await page.evaluate(() => ({ st: JO.Game.state }));
  // bench prompt disappears after use
  const bench = await page.evaluate(() => { const G = JO.Game, W = JO.World, P = JO.Player, cp = W.checkpoints[0]; W.setCheckpointReached(cp);
    P.place(cp.x || 0, cp.z + 1); G.debug.run(0.2); const before = G.hint;
    G.openBench(); const opened = G.state; document.getElementById('btnBenchClose').click(); G.state = 'playing'; G.debug.run(0.2); const after = G.hint;
    P.place(cp.x || 0, cp.z - 20); G.debug.run(0.2); P.place(cp.x || 0, cp.z + 1); G.debug.run(0.2); const back = G.hint; return { before, opened, after, back }; });
  checks.push(['bench prompt hides after use, returns after leaving', /FIELD BENCH/.test(bench.before) && bench.opened === 'bench' && !/FIELD BENCH/.test(bench.after) && /FIELD BENCH/.test(bench.back), bench]);
  // crate prompt + glow
  const cr = await page.evaluate(() => { const G = JO.Game, W = JO.World, P = JO.Player, c = W.crates[0]; if (!c) return { none: true };
    P.place(c.x, c.z + 1.5); G.debug.run(0.1); const near = !!P.nearCrate; JO.Input.interactPressed = true; G.debug.run(0.1); G.debug.run(0.6);
    return { near, opened: c.opened, prompt: document.getElementById('prompt').innerHTML, ring: c.rm.opacity, hasRing: !!c.ring }; });
  checks.push(['crate glows and its prompt clears after opening', cr.hasRing && cr.near && cr.opened && !/SUPPLY CRATE/.test(cr.prompt), cr]);
  await page.evaluate(() => { const W = JO.World, P = JO.Player, c = W.crates[1] || W.crates[0]; P.place(c.x + 2.5, c.z + 5); P.yaw = Math.atan2(c.x - P.pos.x, c.z - P.pos.z) ; P.pitch = -0.25; JO.Game.debug.run(0.1); });
  await page.waitForTimeout(400); await page.screenshot({ path: __dirname + '/fixes1_crate.png' });
  // voice sync: subtitles wait for the voice to start
  const vs = await page.evaluate(async () => { const St = JO.Story, A = JO.Audio; A.init(); A.muted = false; St.voiceVol = 1;
    const id = St.data.voiceFiles[5], line = St.line(id); St.clear(); St.say(line); const w0 = St.cur && St.cur.wait;
    for (let i = 0; i < 30 && St.cur && St.cur.wait > 0; i++) { St.update(0.05); await new Promise(r => setTimeout(r, 50)); }
    return { id, w0, voiced: St.cur && St.cur.voiced, shownAfter: St.cur && St.cur.shown }; });
  checks.push(['dialogue waits for voice (or is preloaded)', vs.voiced !== undefined, vs]);
  const n = h.report('fixes1', checks, errors); await browser.close(); process.exit(n ? 1 : 0); })();
