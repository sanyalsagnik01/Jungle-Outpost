const h = require('./h');
(async () => {
  const { browser, page, errors } = await h.launch();
  const C = []; let r;
  const counts = [];
  for (let lv = 0; lv < 3; lv++) { await h.start(page, lv, { quality: 'med', noSpawn: true }); counts.push(await page.evaluate(() => JO.Scenes.list.map(s => [s.def.id, Math.round(s.x), Math.round(s.z)]))); }
  C.push(['three scenes placed in every level', counts.every(c => c.length === 3), counts]);
  await h.start(page, 0, { quality: 'med', noSpawn: true });
  r = await page.evaluate(() => { const Sc = JO.Scenes, P = JO.Player, G = JO.Game, I = JO.Input; JO.Enemies.reset(); JO.Story.clear(); const s = Sc.list[0]; s.seen = false; delete JO.Save.profile.seen['scene_' + s.def.id]; const sal0 = JO.Save.profile.salvage;
    P.place(s.x + (s.x > 0 ? -1.8 : 1.8), s.z + 0.5); G.debug.run(0.2); JO.Story.clear(); const hint = G.hint, near = Sc.near === s; I.interactPressed = true; G.debug.run(0.1);
    const card = document.getElementById('sceneCard'), shown = !card.classList.contains('hidden'), title = card.querySelector('b').textContent, sub = card.querySelector('small').textContent, line = JO.Story.cur && JO.Story.cur.line.id;
    const out = { hint, near, shown, title, sub, line, seen: s.seen, saved: JO.Save.profile.seen['scene_' + s.def.id], sal: JO.Save.profile.salvage - sal0, ring: null }; G.debug.run(0.2); out.ring = s.ring.visible; P.place(0, 3); G.debug.run(12, 3); out.hidden = card.classList.contains('hidden'); return out; });
  C.push(['walk up, press E: card, line, saved, reward', /LOOK CLOSER/.test(r.hint) && r.near && r.shown && r.title === 'A cold camp' && /1 OF 3/.test(r.sub) && r.line === 's1_camp_1' && r.seen && r.saved === 1 && r.sal > 0 && !r.ring && r.hidden, r]);
  // Juno reacts
  r = await page.evaluate(() => { const Sc = JO.Scenes, G = JO.Game, Ev = JO.Events, St = JO.Story; const out = {};
    for (const [ev, args, want] of [['lamp_out', [], 'lamp_out'], ['surrender', [{}], 'surrender'], ['surrender_spared', [{}], 'spared'], ['surrender_killed', [{}], 'executed'], ['body_found', [{}], 'body_found'], ['weather', ['storm'], 'storm'], ['overheat', [], 'overheat'], ['traverse', ['vault'], 'vault']]) {
      St.clear(); Sc.last = ''; Ev.emit(ev, args[0]); out[want] = Sc.last === want && !!St.cur && St.cur.line.speaker === 'juno'; }
    St.clear(); const n0 = Sc.reacts; Ev.emit('lamp_out'); out.cooldown = Sc.reacts === n0; St.clear();
    for (let i = 0; i < 3; i++) Ev.emit('takedown', {}); out.ghost = Sc.last === 'ghost'; St.clear(); return out; });
  C.push(['Juno reacts to lamps, surrender, bodies, weather, heat, vaults, takedowns', Object.keys(r).every(k => r[k]), r]);
  // barks exist for the new squad behaviour
  r = await page.evaluate(() => ['investigate', 'body', 'surrender'].map(k => JO.Story.data.lines.filter(l => l.trigger === 'bark:' + k).length));
  C.push(['new barks in story data', r.every(n => n >= 3), r]);
  // minimal HUD
  r = await page.evaluate(() => { const G = JO.Game, P = JO.Player; const tl = document.getElementById('hudTL'), bl = document.getElementById('hudBL'); JO.Meta.set.diegetic = true; G.debug.run(0.1); const on = document.body.classList.contains('dieg'); G.debug.run(12, 3); const idle = [tl.classList.contains('need'), bl.classList.contains('need')];
    P.hp = 60; P.sinceDmg = 0; G.debug.run(0.3); const hurt = bl.classList.contains('need'); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyH' })); G.debug.run(0.1); const off = !document.body.classList.contains('dieg') && JO.Meta.set.diegetic === false; P.hp = 100;
    return { on, idle, hurt, off, dead: JO.Sys.list.filter(s => s.dead).map(s => s.name), errs: G.debug.errors }; });
  C.push(['minimal HUD hides idle panels, shows them when needed, H toggles', r.on && !r.idle[0] && !r.idle[1] && r.hurt && r.off, r]);
  C.push(['no runtime errors', !r.dead.length && !r.errs.length, r.errs]);
  await h.start(page, 2, { quality: 'high', noRender: false, noSpawn: true });
  await page.evaluate(() => { const s = JO.Scenes.list[0], P = JO.Player; JO.Story.clear(); P.place(s.x + 3.4, s.z + 4.5); P.yaw = Math.atan2(s.x - P.pos.x, s.z - P.pos.z) + 0.25; P.pitch = -0.12; });
  await h.sleep(5000); await page.evaluate(() => { JO.Player.pos.set(JO.Scenes.list[0].x + 1.6, 0, JO.Scenes.list[0].z + 1.2); JO.Input.external = true; JO.Input.interactPressed = true; }); await h.sleep(4000); await page.screenshot({ path: 'lw7_scene.png' });
  const bad = h.report('LW7', C, errors); await browser.close(); process.exit(bad ? 1 : 0);
})();
