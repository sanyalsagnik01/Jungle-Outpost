// New Game resets salvage, skills, mods and the saved run after a confirmation; Cancel keeps everything
const h = require('./h');
(async () => { const { browser, page, errors } = await h.launch({ w: 960, h: 540 }); const checks = [];
  await h.ev(page, () => { const p = JO.Save.profile; p.salvage = 500; p.skills = { a1: 1 }; p.mods = { ar_mag: 1 }; p.run = { v: 1, level: 1, cp: 0 }; p.ach = { x: 1 }; JO.Save.save(); JO.UI.refreshTitle(); JO.UI.show('scrTitle'); });
  await page.waitForFunction(() => !document.getElementById('btnStart').disabled, null, { timeout: 60000 }).catch(() => {});
  const a = await h.ev(page, () => { const vis = id => !document.getElementById(id).classList.contains('hidden');
    document.getElementById('btnStart').click(); const shown = vis('scrNewGame'), focus = document.activeElement && document.activeElement.id;
    document.getElementById('btnNgNo').click(); const p = JO.Save.profile; return { shown, focus, back: vis('scrTitle'), kept: p.salvage === 500 && !!p.skills.a1 && !!p.mods.ar_mag && !!p.run }; });
  checks.push(['confirm shown, cancel keeps progress', a.shown && a.back && a.kept, a]);
  const b = await h.ev(page, () => { document.getElementById('btnStart').click(); document.getElementById('btnNgYes').click(); const p = JO.Save.profile;
    return { salvage: p.salvage, skills: Object.keys(p.skills).length, mods: Object.keys(p.mods).length, ach: !!p.ach.x, level: JO.Game.levelIdx }; });
  checks.push(['new game resets bench, keeps achievements', b.salvage === 0 && !b.skills && !b.mods && b.ach && b.level === 0, b]);
  const n = h.report('newgame', checks, errors); await browser.close(); process.exit(n ? 1 : 0); })();
