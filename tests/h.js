// Playwright harness for Jungle Outpost tests
const { chromium } = require('playwright');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '../index.html');
exports.launch = async function (opts) {
  opts = opts || {};
  const browser = await chromium.launch({ executablePath: process.env.JO_CHROME || undefined, headless: true,
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: opts.w || 1280, height: opts.h || 720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
  if (opts.block) await page.route('**/*', r => (opts.block.test(r.request().url()) ? r.abort() : r.continue()));
  if (opts.init) await page.addInitScript(opts.init);
  await page.goto(URL);
  await page.waitForFunction(() => window.JO && JO.Assets && JO.Assets.ready, null, { timeout: 60000 });
  await page.waitForTimeout(300);
  return { browser, page, errors };
};
// start a level directly, in a test-friendly state
exports.start = async function (page, level, o) {
  o = Object.assign({ god: true, noRender: true, bot: false }, o || {});
  await page.evaluate(([level, o]) => {
    const G = JO.Game; JO.Story.noCut = true; G.debug.god = o.god; G.debug.noRender = o.noRender; G.debug.noSave = true; G.debug.noSpawn = !!o.noSpawn; G.mode = o.mode || '';
    G.startRun(level); document.getElementById('btnDeploy').click(); G.debug.bot = o.bot; if (o.quality) JO.Post.set(o.quality, true);
  }, [level, o]);
};
// advance game time synchronously (no waiting on real time)
exports.adv = (page, sec, frameEvery) => page.evaluate(([sec, fe]) => JO.Game.debug.run(sec, fe), [sec, frameEvery || 1]);
exports.ev = (page, fn, arg) => page.evaluate(fn, arg);
exports.sleep = ms => new Promise(r => setTimeout(r, ms));
exports.report = function (name, checks, errors) {
  let bad = 0; for (const [k, ok, info] of checks) { if (!ok) bad++; console.log((ok ? 'PASS ' : 'FAIL ') + k + (info !== undefined ? '  ' + JSON.stringify(info) : '')); }
  if (errors.length) { bad++; console.log('ERRORS:\n' + errors.slice(0, 8).join('\n')); }
  console.log(name + (bad ? ': ' + bad + ' FAILURE(S)' : ': ALL PASS')); return bad;
};
