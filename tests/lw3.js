const h = require('./h');
(async () => {
  const { browser, page, errors } = await h.launch();
  const C = []; let r;
  // ---- night level: lamps, exposure, lanterns
  await h.start(page, 2, { quality: 'med', noSpawn: true });
  await h.adv(page, 0.5);
  r = await page.evaluate(() => { const Sq = JO.Squad, P = JO.Player, l = Sq.lamps[0]; P.pos.set(l.x + 1, 0, l.z + 1); JO.Game.debug.run(0.2); const lit = Sq.exposure(), isLit = Sq.lit; P.pos.set(0, 0, l.z + 14); JO.Game.debug.run(0.2); const dark = Sq.exposure();
    JO.Input.lightPressed = true; JO.Game.debug.run(0.3); const torch = Sq.exposure(), on = Sq.light; JO.Input.lightPressed = true; JO.Game.debug.run(0.1);
    return { lamps: Sq.lamps.length, dark: Sq.dark(), lit, isLit, darkExpo: dark, torch, on, off: Sq.light, used: JO.Lights.used, n: JO.Lights.n, asked: JO.Lights.asked }; });
  C.push(['lamps placed and lit at night', r.lamps >= 5 && r.dark > 0.9, [r.lamps, r.dark]]);
  C.push(['standing in lamplight exposes you; darkness hides', r.lit > 1.3 && r.isLit && r.darkExpo < 0.9, [r.lit, r.darkExpo]]);
  C.push(['flashlight toggles and gives you away', r.on && !r.off && r.torch > r.darkExpo * 1.5, [r.torch, r.darkExpo]]);
  C.push(['light pool within budget', r.used <= r.n && r.used > 0 && r.asked >= r.lamps, [r.used, r.n, r.asked]]);
  // shoot a lamp out
  r = await page.evaluate(() => { const Sq = JO.Squad, E = JO.Enemies, l = Sq.lamps[1]; const a = E.spawn('rifleman', l.px + 4, l.z - 6, {}), b = E.spawn('rifleman', l.px - 3, l.z - 9, {}); JO.Player.pos.set(0, 0, l.z + 30); JO.Game.debug.run(0.3);
    const hit = Sq.shotRay(l.x, l.y, l.z + 20, 0, 0, -1, 40); JO.Game.debug.run(0.1); return { hit, lit: l.lit, a: a.inv && a.inv.why, b: b.inv && b.inv.why, broken: Sq.broken }; });
  C.push(['a shot lamp goes dark and draws the nearest patrols', r.hit && !r.lit && (r.a === 'lamp' || r.b === 'lamp'), r]);
  // lantern carriers
  r = await page.evaluate(() => { const E = JO.Enemies, Sq = JO.Squad; E.reset(); JO.Player.pos.set(0, 0, 3); for (let i = 0; i < 12; i++) E.spawn('rifleman', -10 + i * 1.8, -40 - (i % 3) * 3, {}); JO.Game.debug.run(0.5);
    const car = E.list.filter(e => e.lantern); let broke = null; if (car.length) { const e = car[0]; Sq.shotRay(e.lx, e.ly, e.lz + 10, 0, 0, -1, 20); broke = { lantern: e.lantern, alerted: e.alerted }; }
    return { carriers: car.length, cap: JO.Q.n('lanterns'), broke, acts: E.list.map(e => e.act) }; });
  C.push(['some patrols carry lanterns at night, capped', r.carriers > 0 && r.carriers <= r.cap, [r.carriers, r.cap]]);
  C.push(['shooting a carried lantern breaks it and alerts him', r.broke && !r.broke.lantern && r.broke.alerted, r.broke]);
  C.push(['off-duty acts assigned', new Set(r.acts).size >= 3 && r.acts.includes('chat'), r.acts]);
  // ---- day level: investigate, bodies, morale
  await h.start(page, 0, { quality: 'med', noSpawn: true });
  r = await page.evaluate(() => { const E = JO.Enemies, Sq = JO.Squad, P = JO.Player; P.pos.set(0, 0, 3); P.crouch = true; const e = E.spawn('rifleman', 6, -40, {}); JO.Game.debug.run(0.2); e.act = 'post'; e.mate = null;
    const hx = e.homeX, hz = e.homeZ, ph = []; Sq.investigate(e, -4, -34, 'noise'); let far = 0, at = 99;
    for (let i = 0; i < 400 && e.inv; i++) { JO.Game.debug.run(0.1); if (e.inv && ph[ph.length - 1] !== e.inv.phase) ph.push(e.inv.phase); far = Math.max(far, Math.hypot(e.pos.x - hx, e.pos.z - hz)); at = Math.min(at, Math.hypot(e.pos.x + 4, e.pos.z + 34)); }
    return { ph, far, at, home: Math.hypot(e.pos.x - hx, e.pos.z - hz), state: e.state, done: !e.inv }; });
  C.push(['investigation: look, go, search, back', r.ph.join('>') === 'look>go>search>back' && r.at < 2 && r.home < 1.2 && r.done && r.state === 'patrol', r]);
  r = await page.evaluate(() => { const E = JO.Enemies, Sq = JO.Squad, P = JO.Player; E.reset(); P.pos.set(14, 0, 3); const a = E.spawn('rifleman', 0, -40, {}), b = E.spawn('rifleman', 0, -50, {}); JO.Game.debug.run(0.2);
    b.act = 'post'; b.mate = null; a.act = 'post'; a.mate = null; a.pos.set(0, 0, -40); a.homeX = 0; a.homeZ = -40; b.pos.set(0, 0, -50); b.homeX = 0; b.homeZ = -50; b.yaw = 0; const f0 = Sq.found; a.takeHit(999, a.parts[0], 0, -1, 1.2, 1); let why = null;
    for (let i = 0; i < 150 && b.state === 'patrol'; i++) { b.yaw = b.inv ? b.yaw : 0; JO.Game.debug.run(0.1); if (b.inv) why = b.inv.why; }
    return { why, state: b.state, found: Sq.found - f0 }; });
  C.push(['a patrol that sees a body walks over and raises the alarm', r.why === 'body' && r.state !== 'patrol' && r.found === 1, r]);
  r = await page.evaluate(() => { const E = JO.Enemies, Sq = JO.Squad, P = JO.Player, G = JO.Game; E.reset(); P.pos.set(0, 0, -10); const es = []; for (let i = 0; i < 5; i++) es.push(E.spawn('rifleman', -6 + i * 3, -30, { alert: true })); G.debug.run(1.5);
    const st0 = es.map(e => e.state); for (let i = 0; i < 3; i++) { es[i].takeHit(999, es[i].parts[0], 0, -1, 1.2, 1); } G.debug.run(0.2); const m3 = es[4].morale, fl = es[4].fleeT > 0 || es[3].fleeT > 0, ret = Sq.retreats;
    es[3].takeHit(999, es[3].parts[0], 0, -1, 1.2, 1); G.debug.run(0.3); const last = es[4], sur = last.state, m4 = last.morale, k0 = G.run.knockouts | 0;
    P.pos.set(0, 0, 20); G.debug.run(11); return { st0, m3, fl, ret, m4, sur, spared: Sq.spared, knock: (G.run.knockouts | 0) - k0, inList: E.list.indexOf(last) >= 0 }; });
  C.push(['a squad that loses men falls back', r.m3 < 0.36 && r.fl && r.ret > 0, r]);
  C.push(['the last man surrenders; left alone he runs (mercy)', r.sur === 'surrender' && r.spared === 1 && r.knock === 1 && !r.inList, r]);
  r = await page.evaluate(() => { const E = JO.Enemies, Sq = JO.Squad, P = JO.Player, G = JO.Game; E.reset(); P.pos.set(0, 0, -10); const es = []; for (let i = 0; i < 5; i++) es.push(E.spawn('rifleman', -6 + i * 3, -30, { alert: true })); G.debug.run(1.5);
    for (let i = 0; i < 4; i++) es[i].takeHit(999, es[i].parts[0], 0, -1, 1.2, 1); G.debug.run(0.3); const e = es[4], s = e.state; e.takeHit(999, e.parts[0], 0, -1, 1.2, 1); return { s, executed: Sq.executed, run: G.run.executed }; });
  C.push(['killing a surrendered man is recorded', r.s === 'surrender' && r.executed === 1 && r.run === 1, r]);
  // relaxed men notice less
  r = await page.evaluate(() => { const E = JO.Enemies, P = JO.Player, G = JO.Game; E.reset(); P.pos.set(0, 0, -10); P.crouch = false; const a = E.spawn('rifleman', -4, -32, {}), b = E.spawn('rifleman', 4, -32, {}); G.debug.run(0.05);
    a.act = 'post'; a.actK = 1.15; b.act = 'sit'; b.actK = 0.6; a.mate = b.mate = null; a.inv = b.inv = null; a.yaw = b.yaw = 0; a.aware = b.aware = 0; for (let i = 0; i < 20; i++) { a.yaw = b.yaw = 0; a.see = b.see = true; a.losT = b.losT = 1; G.debug.run(1 / 60); } return { post: a.aware, sit: b.aware, dead: JO.Sys.list.filter(s => s.dead).map(s => s.name), errs: G.debug.errors }; });
  C.push(['a seated man notices less than a sentry', r.post > r.sit * 1.3 && r.sit > 0, r]);
  C.push(['no system errors', !r.dead.length && !r.errs.length, r.errs]);
  // visual
  await h.start(page, 2, { quality: 'high', noRender: false, noSpawn: true });
  await page.evaluate(() => { const E = JO.Enemies, P = JO.Player, Sq = JO.Squad, l = Sq.lamps[0]; P.pos.set(0, 0, l.z + 9); P.yaw = Math.PI; P.pitch = -0.08; const a = E.spawn('rifleman', l.px + 1.5, l.z - 2, {}), b = E.spawn('rifleman', -3, l.z - 4, {}); a.lantern = false; });
  await h.sleep(7000); await page.evaluate(() => { JO.Enemies.list.forEach(e => { if (e.act !== 'chat') e.lantern = true; }); }); await h.sleep(3000); await page.screenshot({ path: 'lw3_offduty.png' });
  const bad = h.report('LW3', C, errors); await browser.close(); process.exit(bad ? 1 : 0);
})();
