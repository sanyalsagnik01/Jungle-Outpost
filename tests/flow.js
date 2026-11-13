// full run, title to ending, with the bot. usage: node flow.js <ending> [god=1] [speed]
const h = require('./h');
(async () => {
  const want = process.argv[2] || 'destroy', god = process.argv[3] !== '0', speed = +(process.argv[4] || 8);
  const { browser, page, errors } = await h.launch();
  await page.evaluate(([god, speed]) => { const G = JO.Game; JO.Story.noCut = true; G.debug.god = god; G.debug.noRender = true; G.debug.noSave = true; G.debug.speed = speed; G.debug.finish = false;
    document.getElementById('btnStart').click(); }, [god, speed]);
  const t0 = Date.now(); let last = '', lvl = -1, deaths = 0;
  for (;;) {
    if (Date.now() - t0 > 900000) { console.log('TIMEOUT'); break; }
    const s = await page.evaluate((want) => { const G = JO.Game, vis = id => !document.getElementById(id).classList.contains('hidden');
      G.debug.finish = want !== 'third';
      if (G.state === 'intro' && vis('scrIntro')) { document.getElementById('btnDeploy').click(); G.debug.bot = true; }
      else if (G.state === 'done' && vis('scrDone')) { const c = document.querySelector('#upCards .card'); if (c) c.click(); }
      else if (G.state === 'dead') { document.getElementById('btnRetry').click(); G.debug.bot = true; return 'retry'; }
      else if (vis('scrChoice')) { const b = document.querySelector('#choiceCards [data-end="' + want + '"]'); if (b && !b.disabled) b.click(); else return 'LOCKED'; }
      if (JO.Story.cur) JO.Story.skip();
      return G.state + ' L' + G.levelIdx + ' z' + Math.round(JO.Player.pos.z) + ' hp' + Math.round(JO.Player.hp) + ' boss' + (G.bossFight ? Math.round(G.boss.hp) : '-') + ' end:' + G.ending + ' err' + G.debug.errors.length; }, want);
    if (s === 'retry') deaths++;
    if (s !== last && (s.split(' ')[0] !== last.split(' ')[0] || s.split(' ')[1] !== last.split(' ')[1])) console.log(((Date.now() - t0) / 1000).toFixed(0) + 's', s);
    last = s; if (s.indexOf('win') === 0 || s === 'LOCKED') break; await h.sleep(500);
  }
  const fin = await page.evaluate(() => ({ state: JO.Game.state, ending: JO.Game.ending, errs: JO.Game.debug.errors, run: JO.Game.run }));
  console.log(JSON.stringify(fin), 'deaths', deaths);
  const ok = fin.state === 'win' && fin.ending === want && !fin.errs.length && !errors.length;
  console.log(errors.slice(0, 6).join('\n')); console.log('FLOW ' + want + (ok ? ' PASS' : ' FAIL')); await browser.close(); process.exit(ok ? 0 : 1);
})();
