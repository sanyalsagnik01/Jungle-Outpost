const h = require('./h');
(async () => {
  const { browser, page, errors } = await h.launch({ w: 640, h: 360 });
  const C = []; let r;
  // settings rows
  r = await page.evaluate(() => { JO.Meta.openSettings('scrTitle'); const body = document.getElementById('setBody'), rows = JO.Q.ROWS.map(r => !!body.querySelector('[data-key="' + r[0] + '"]')); const b = body.querySelector('[data-key="foliage"]'); const g0 = JO.Foliage.count; b.click(); const g1 = JO.Foliage.count, v = JO.Meta.set.foliage; body.querySelector('[data-key="foliage"]').click();
    const keys = ['light', 'leanL', 'leanR', 'wipe'].map(k => !!body.querySelector('[data-act="' + k + '"]')); JO.UI.show('scrTitle'); return { rows, g0, g1, v, back: JO.Foliage.count, keys, saved: JO.Save.profile.settings.foliage }; });
  C.push(['every effect has a settings toggle', r.rows.every(Boolean) && r.rows.length === 16, r.rows.length]);
  C.push(['toggling applies at once and is saved', r.g0 > 0 && r.g1 === 0 && r.v === false && r.back > 0 && r.saved === true, r]);
  C.push(['new keys can be rebound', r.keys.every(Boolean), r.keys]);
  // fallback notice
  await h.start(page, 0, { quality: 'auto', noSpawn: true, noRender: false });
  r = await page.evaluate(() => { const Po = JO.Post, W = JO.World; JO.Game.debug.noRender = true; document.getElementById('toasts').innerHTML = ''; const t0 = Po.tier; for (let i = 0; i < 90 && Po.tier === t0; i++) Po.render(W.scene, W.camera, 0.1);
    const txt = Array.from(document.querySelectorAll('#toasts .toast')).map(t => t.textContent); return { t0, t1: Po.tier, fell: Po.fellBack, txt, lost: JO.Q.lost('high', 'low') }; });
  C.push(['auto quality steps down and says what was reduced', r.t0 === 'high' && r.t1 === 'med' && r.fell === 1 && r.txt.some(t => /Off: depth of field/.test(t)) && /light shafts/.test(r.lost), r]);
  // 15 minutes of survival: pools must not grow
  await h.start(page, 0, { quality: 'med', mode: 'survival', bot: true, noRender: true });
  const snap = () => page.evaluate(() => { const W = JO.World, E = JO.Enemies, m = W.renderer.info.memory; JO.Post.render(W.scene, W.camera, 0.016); let pool = 0; for (const k in E.pools) pool += E.pools[k].length; let nodes = 0; W.scene.traverse(() => nodes++); const bones = new Set(); const all = E.list.slice(); for (const k in E.pools) all.push(...E.pools[k]); all.forEach(e => { [e.gfx, e.gun].forEach(g => g && g.root.traverse(o => { if (o.isSkinnedMesh && o.skeleton && o.skeleton.boneTexture) bones.add(o.skeleton.boneTexture.uuid); })); });
    return { t: Math.round(JO.Game.stats.time), geo: m.geometries, tex: m.textures, bones: bones.size, kids: W.scene.children.length, nodes, list: E.list.length, pool, total: E.list.length + pool, lying: JO.Phys.lying | 0, decals: JO.Phys.decalCount(), heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0, wave: JO.Meta.wave, state: JO.Game.state, errs: JO.Game.debug.errors.length, dead: JO.Sys.list.filter(s => s.dead).map(s => s.name) }; });
  const S = [];
  for (let min = 0; min <= 15; min++) { if (min) for (let k = 0; k < 6; k++) await page.evaluate(() => { const G = JO.Game; if (G.state !== 'playing') { document.getElementById('btnRetry').click(); G.debug.bot = true; G.debug.god = true; } G.debug.run(10, 4); });
    const s = await snap(); S.push(s); if (min % 3 === 0) console.log('  min ' + min, JSON.stringify(s)); }
  const a = S[3], b = S[15];
  C.push(['15 min: ran the whole time without errors', b.t >= 880 && b.errs === 0 && !b.dead.length, [b.t, b.errs, b.wave]]);
  const grew = Math.max(0, b.total - a.total), c = S[12];
  C.push(['15 min: textures flat apart from pooled enemies\' bone textures', (b.tex - b.bones) <= (a.tex - a.bones) + 2 && b.bones <= 2 * b.total, [a.tex, a.bones, b.tex, b.bones, 'pool', a.total, b.total]]);
  C.push(['15 min: geometries flat over the last 3 min', b.geo <= c.geo + 2, [a.geo, c.geo, b.geo]]);
  C.push(['15 min: scene graph grows only with the enemy pool', b.kids - a.kids <= grew + 3, [a.kids, b.kids, 'pool +' + grew]]);
  C.push(['15 min: enemy objects bounded', b.total <= Math.max(a.total + 12, 45), [a.total, b.total]]);
  C.push(['15 min: bodies and decals inside budget', b.lying <= 6 && b.decals <= 70, [b.lying, b.decals]]);
  // level reloads do not pile up GPU objects
  r = await page.evaluate(() => { const G = JO.Game, W = JO.World, m = W.renderer.info.memory; G.mode = ''; const out = []; for (let i = 0; i < 6; i++) { G.startRun(i % 2 ? 2 : 1); document.getElementById('btnDeploy').click(); G.debug.run(1, 6); JO.Post.render(W.scene, W.camera, 0.016); out.push([m.geometries, m.textures, W.scene.children.length]); } return out; });
  C.push(['reloading levels does not leak (revisits match exactly)', [0, 1, 2].every(k => r[4][k] === r[2][k] && r[5][k] === r[3][k]), r]);
  const bad = h.report('LW8', C, errors); await browser.close(); process.exit(bad ? 1 : 0);
})();
