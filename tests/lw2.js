const h = require('./h');
(async () => {
  const { browser, page, errors } = await h.launch();
  const C = [];
  await h.start(page, 0, { quality: 'med' });
  await page.evaluate(() => { JO.Enemies.reset(); window.T = { fire(n) { for (let i = 0; i < n; i++) { JO.Weapons.cd = 0; JO.Input.fire = true; JO.Game.debug.run(1 / 60); } JO.Input.fire = false; } }; });
  // 1. shots into the ground and into cover leave decals and debris
  let r = await page.evaluate(() => { const P = JO.Player, Ph = JO.Phys; P.pos.set(0, 0, -6); P.yaw = Math.PI; P.pitch = -0.5; JO.Game.debug.run(0.1); const d0 = Ph.decalCount(), b0 = Ph.bitN; T.fire(6);
    const ground = { dec: Ph.decalCount() - d0, bits: Ph.bitN - b0, kind: Ph.lastKind };
    const c = JO.World.colliders.find(c => c.on && !c.mat && c.h > 1 && c.h < 3 && c.minz > -80 && c.minz < -20); const d1 = Ph.decalCount();
    const wk = Ph.impact((c.minx + c.maxx) / 2, 0.6, c.maxz, 0, 0, -1, JO.CFG.WEAPONS[0]); const wood = { dec: Ph.decalCount() - d1, kind: wk, n: [Ph.S.nx, Ph.S.ny, Ph.S.nz] };
    const s = JO.World.colliders.find(c => c.on && c.mat === 'stone' && c.minz > -200); Ph.impact(s.minx, 0.4, (s.minz + s.maxz) / 2, 1, 0, 0, JO.CFG.WEAPONS[0]);
    return { ground, wood, stone: Ph.lastKind, shells: JO.Q.n('shells') }; });
  C.push(['ground shots: hole decals + debris', r.ground.dec >= 4 && r.ground.bits > 8 && /dirt|grass/.test(r.ground.kind), r.ground]);
  C.push(['wood splinters, stone chips', r.wood.kind === 'wood' && r.wood.dec > 0 && r.wood.n[2] === 1 && r.stone === 'stone', r]);
  // 2. decal budget is capped per tier
  r = await page.evaluate(() => { const Ph = JO.Phys; for (let i = 0; i < 400; i++) Ph.decal('hole', i * 0.1, 0.02, -10, 0, 1, 0, 0.2); const med = Ph.decalCount(); JO.Post.set('low', true); for (let i = 0; i < 100; i++) Ph.decal('hole', i * 0.1, 0.02, -10, 0, 1, 0, 0.2); const low = JO.Q.n('decals'); JO.Post.set('med', true); return { med, cap: JO.Q.n('decals'), low }; });
  C.push(['decals stay inside the budget', r.med <= r.cap && r.med > 20, r]);
  // 3. a shot enemy leaves a body, pushed along the shot
  r = await page.evaluate(() => { const P = JO.Player, E = JO.Enemies; P.pos.set(0, 0, -6); const e = E.spawn('rifleman', 0, -14, {}); JO.Game.debug.run(0.05); const z0 = e.pos.z; e.takeHit(999, e.parts[0], 0, -1, 1.2, 1); JO.Game.debug.run(2.5);
    return { rag: e.rag, inList: E.list.indexOf(e) >= 0, moved: z0 - e.pos.z, limp: e.gfx ? e.gfx.limp : 'prim', alive: e.alive, count: E.count(), lying: JO.Phys.lying }; });
  C.push(['enemy leaves a body, pushed along the shot', r.rag && r.inList && r.moved > 0.3 && !r.alive, r]);
  await page.screenshot({ path: 'x.png' }).catch(() => {});
  // 4. a blast throws bodies and scorches the ground
  r = await page.evaluate(() => { const E = JO.Enemies, Ph = JO.Phys, e = E.spawn('rifleman', 1, -9, {}); JO.Game.debug.run(0.05); const sc0 = Ph.decalN; JO.Arsenal.blast(-0.5, 0.3, -9, 5, 400, 0); JO.Game.debug.run(0.25); const up = e.pos.y; JO.Game.debug.run(2);
    return { alive: e.alive, rag: e.rag, thrown: e.thrown, up, x: e.pos.x, y: e.pos.y, scorch: Ph.decalN - sc0 }; });
  C.push(['blast throws the body and leaves a scorch', !r.alive && r.thrown && r.up > 0.3 && r.x > 3 && r.y === 0 && r.scorch >= 1, r]);
  // 5. only a few bodies are kept
  r = await page.evaluate(() => { const E = JO.Enemies; for (let i = 0; i < 12; i++) { const e = E.spawn('runner', -8 + i * 1.4, -20, {}); e.takeHit(999, e.parts[0], 0, -1, 1.2, 1); } JO.Game.debug.run(6); return { lying: JO.Phys.lying, cap: JO.Q.n('bodies'), list: E.list.length }; });
  C.push(['old bodies dissolve past the cap', r.lying <= r.cap && r.lying > 2, r]);
  // 6. leg hit -> limp
  r = await page.evaluate(() => { const E = JO.Enemies, e = E.spawn('rifleman', 0, -60, { alert: true }); JO.Game.debug.run(0.1); e.takeHit(5, e.parts[0], 0, -1, e.pos.y + 0.3, 1); const a = e.slowT; e.takeHit(5, e.parts[0], 0, -1, e.pos.y + 1.2, 1); E.reset(); return { slow: a }; });
  C.push(['leg hit makes an enemy limp', r.slow > 1, r]);
  // 7. flamethrower overheats and recovers
  r = await page.evaluate(() => { const Wp = JO.Weapons, Ph = JO.Phys, P = JO.Player; Wp.slots[4].unlocked = true; Wp.slots[4].mag = 100; Wp.slots[4].reserve = 200; Wp.cur = 4; P.pos.set(0, 0, -6); P.pitch = -0.4; let n = 0;
    JO.Input.fire = true; for (let i = 0; i < 600 && !Ph.overheated; i++) { JO.Game.debug.run(1 / 60); n++; if (Wp.slots[4].mag < 5) Wp.slots[4].mag = 100; } const heat = Ph.heat, over = Ph.overheated, mag0 = Wp.slots[4].mag; JO.Game.debug.run(0.5); const blockedFire = Wp.slots[4].mag === mag0; JO.Input.fire = false; JO.Game.debug.run(4);
    const hud = !document.getElementById('heat').classList.contains('hidden'); Wp.cur = 0; return { n, heat, over, blockedFire, after: Ph.overheated, heatAfter: Ph.heat, scorch: Ph.flameN, hud }; });
  C.push(['flamethrower overheats, locks, then cools', r.over && r.blockedFire && !r.after && r.n > 60 && r.hud, r]);
  // 8. near miss
  r = await page.evaluate(() => { const P = JO.Player, Ph = JO.Phys; P.pos.set(0, 0, -6); const w0 = Ph.whiz | 0; JO.FX.bullet(0.9, 1.5, -30, 0, 0, 1, 40, 5, 0xffd060); JO.Game.debug.run(1); return { whiz: (Ph.whiz | 0) - w0, hp: P.hp }; });
  C.push(['a round passing close cracks past', r.whiz === 1, r]);
  // 9. recoil pattern + sway
  r = await page.evaluate(() => { const P = JO.Player, I = JO.Input, Ph = JO.Phys; I.external = false; const y0 = P.yaw; Ph.burst = 0; Ph.burstT = 0; for (let i = 0; i < 5; i++) Ph.shot(JO.CFG.WEAPONS[0], 0, 1, 0); const walk = Math.abs(P.yaw - y0); P.yaw = y0;
    JO.Weapons.slots[2].unlocked = true; JO.Weapons.cur = 2; I.ads = true; let mx = 0; for (let i = 0; i < 120; i++) { JO.Sys.step(1 / 60); JO.World.time += 1 / 60; mx = Math.max(mx, Math.abs(Ph.swayX)); } I.ads = false; JO.Weapons.cur = 0; I.external = true; return { walk, sway: mx }; });
  C.push(['recoil walks sideways; marksman sways', r.walk > 0.001 && r.sway > 0.002, r]);
  // 10. water impact
  await h.start(page, 1, { quality: 'med' });
  r = await page.evaluate(() => { JO.Enemies.reset(); const k = JO.Phys.impact(10, 0.01, -115, 0, -1, 0, JO.CFG.WEAPONS[0]); return { k, sys: JO.Sys.list.filter(s => s.dead).map(s => s.name), errs: JO.Game.debug.errors }; });
  C.push(['bullets splash in water; no system errors', r.k === 'water' && !r.sys.length && !r.errs.length, r]);
  // visual
  await h.start(page, 0, { quality: 'med', noRender: false });
  await page.evaluate(() => { const E = JO.Enemies, P = JO.Player; E.reset(); P.pos.set(0, 0, -6); P.yaw = Math.PI; P.pitch = -0.28; for (let i = 0; i < 3; i++) { const e = E.spawn('rifleman', -2 + i * 2, -11 - i, {}); e.takeHit(999, e.parts[0], 0.3 * (i - 1), -1, 1.2, 1); }
    for (let i = 0; i < 14; i++) JO.Phys.impact(-2 + i * 0.3, 0.01, -8 - (i % 3) * 0.6, 0, -1, 0, JO.CFG.WEAPONS[0]); JO.Phys.decal('scorch', 2.5, 0.02, -9, 0, 1, 0, 3); });
  await h.sleep(6000); await page.screenshot({ path: 'lw2_body.png' });
  const bad = h.report('LW2', C, errors); await browser.close(); process.exit(bad ? 1 : 0);
})();
