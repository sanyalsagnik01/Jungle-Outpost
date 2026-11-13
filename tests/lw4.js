const h = require('./h');
(async () => {
  const { browser, page, errors } = await h.launch();
  const C = []; let r;
  await h.start(page, 0, { quality: 'med', noSpawn: true });
  await page.evaluate(() => { JO.Enemies.reset(); JO.Player.pos.set(0, 0, -6); });
  await h.adv(page, 0.3);
  // trauma shake
  r = await page.evaluate(() => { const Fe = JO.Feel, cam = JO.World.camera; JO.FX.addShake(0.8); JO.Game.debug.run(0.05); const s0 = Fe.shake, t0 = Fe.t; const a = cam.rotation.z; JO.Game.debug.run(0.05); const b = cam.rotation.z; JO.Game.debug.run(2); return { s0, t0, moved: Math.abs(a - b), after: Fe.shake }; });
  C.push(['trauma shake: squared, smooth, decays', r.t0 > 0.4 && Math.abs(r.s0 - r.t0 * r.t0) < 0.05 && r.moved > 0 && r.after === 0, r]);
  // bob / fov / blur while sprinting
  r = await page.evaluate(() => { const Fe = JO.Feel, I = JO.Input, G = JO.Game; I.external = true; let bob = 0; I.moveY = 1; I.sprint = true; for (let i = 0; i < 90; i++) { I.moveY = 1; I.sprint = true; G.debug.run(1 / 60); bob = Math.max(bob, Math.abs(Fe.bobY) + Math.abs(Fe.bobX)); }
    const fov = Fe.fov, blur = JO.Post.blurMove, camFov = JO.World.camera.fov; I.moveY = 0; I.sprint = false; G.debug.run(1.5); return { bob, fov, blur, camFov, fovAfter: Fe.fov }; });
  C.push(['head bob, sprint FOV and edge blur', r.bob > 0.02 && r.fov > 3 && r.blur > 0.2 && r.camFov > 68 && r.fovAfter < 0.5, r]);
  // landing dip
  r = await page.evaluate(() => { const Fe = JO.Feel, P = JO.Player, G = JO.Game; P.pos.set(0, 5, -6); P.vy = 0; P.onGround = false; let dip = 0, sq = 0, cy = 9; const l0 = Fe.lands | 0; for (let i = 0; i < 120; i++) { G.debug.run(1 / 60); dip = Math.min(dip, Fe.dip); sq = Math.max(sq, Fe.sq); } return { dip, sq, lands: (Fe.lands | 0) - l0, y: P.pos.y, end: Fe.dip }; });
  C.push(['landing dip and squash', r.dip < -0.03 && r.sq > 0.05 && r.lands === 1 && Math.abs(r.end) < 0.01 && r.y === 0, r]);
  // vault over low cover, climb a tall block
  r = await page.evaluate(() => { const Fe = JO.Feel, P = JO.Player, G = JO.Game, I = JO.Input, W = JO.World;
    const low = W.addBox(0, -30, 2, 0.5, 1.2, { mat: 'wood' }), tall = W.addBox(8, -30, 2, 2, 2.4, { mat: 'stone' }), wall = W.addBox(-8, -30, 2, 2, 4, { mat: 'stone' });
    function go(x) { P.place(x, -28.6); P.yaw = Math.PI; I.moveY = 1; I.jumpPressed = true; G.debug.run(1 / 60); const kind = Fe.trav && Fe.trav.kind; let top = 0; for (let i = 0; i < 80; i++) { I.moveY = 0; G.debug.run(1 / 60); top = Math.max(top, P.pos.y); } return { kind, z: P.pos.z, y: P.pos.y, top }; }
    const a = go(0), b = go(8), c = go(-8); low.on = tall.on = wall.on = false; return { a, b, c, vaults: Fe.vaults, climbs: Fe.climbs }; });
  C.push(['vault over 1.2 m cover', r.a.kind === 'vault' && r.a.z < -30.6 && r.a.y === 0 && r.a.top > 1, r.a]);
  C.push(['climb onto a 2.4 m block', r.b.kind === 'climb' && Math.abs(r.b.y - 2.4) < 0.01, r.b]);
  C.push(['4 m wall is too high: normal jump', !r.c.kind && r.c.y === 0 && r.c.top > 0.5, r.c]);
  // lean
  r = await page.evaluate(() => { const Fe = JO.Feel, P = JO.Player, G = JO.Game, I = JO.Input, Cam = JO.Cam; P.place(0, -6); P.yaw = Math.PI; G.debug.run(0.2); const x0 = Cam.x; I.keys.KeyV = true; G.debug.run(0.6); const x1 = Cam.x, lean = Fe.lean, roll = JO.World.camera.rotation.z; I.keys.KeyV = false; I.keys.KeyZ = true; G.debug.run(0.8); const x2 = Cam.x; I.keys.KeyZ = false; G.debug.run(0.6); return { right: x1 - x0, left: x2 - x0, lean, roll, back: Cam.x - x0 }; });
  C.push(['lean moves the camera both ways and rolls it', Math.abs(r.right) > 0.4 && Math.abs(r.left) > 0.4 && r.right * r.left < 0 && Math.abs(r.roll) > 0.03 && Math.abs(r.back) < 0.02, r]);
  // footfalls
  r = await page.evaluate(() => { const Fe = JO.Feel, I = JO.Input, G = JO.Game; const s0 = Fe.steps; for (let i = 0; i < 120; i++) { I.moveY = 1; G.debug.run(1 / 60); } I.moveY = 0; return Fe.steps - s0; });
  C.push(['footfalls register', r >= 3, r]);
  // gamepad
  r = await page.evaluate(() => { const Fe = JO.Feel, I = JO.Input, G = JO.Game, P = JO.Player; let rum = 0; const btn = (v) => ({ pressed: v, value: v ? 1 : 0 }); const pad = { connected: true, axes: [0, -1, 0.5, 0], buttons: Array.from({ length: 17 }, () => btn(false)), vibrationActuator: { playEffect() { rum++; } } };
    navigator.getGamepads = () => [pad]; I.external = false; P.place(0, -6); P.yaw = Math.PI; const yaw0 = P.yaw; Fe.pollPad(0.016); const joy = I.joy.y, on = Fe.padOn; pad.buttons[7] = btn(true); pad.buttons[0] = btn(true); Fe.pollPad(0.016); const fire = I.fire, jump = I.jumpPressed; pad.buttons[7] = btn(false); Fe.pollPad(0.016); const fireOff = I.fire;
    Fe.trauma(0.6); pad.axes = [0, 0, 0, 0]; pad.buttons[0] = btn(false); Fe.pollPad(0.016); navigator.getGamepads = () => []; Fe.pollPad(0.016); I.external = true; I.fire = false; I.clear(); return { joy, on, fire, jump, fireOff, look: P.yaw !== yaw0, rum, padOff: !Fe.padOn }; });
  C.push(['gamepad: sticks, trigger, buttons, rumble', r.on && r.joy === 1 && r.fire && r.jump && !r.fireOff && r.look && r.rum > 0 && r.padOff, r]);
  // visor rain + wipe
  r = await page.evaluate(() => { const Fe = JO.Feel, Wx = JO.Weather, G = JO.Game; Wx.setState('rain', true); G.debug.run(6); const drops = Fe.drops, shown = !document.getElementById('visor').classList.contains('hidden'); JO.Input.wipePressed = true; G.debug.run(1.2); const after = Fe.drops; Wx.setState('clear', true); return { drops, shown, after, wipes: Fe.wipes }; });
  C.push(['rain gathers on the lens; T wipes it', r.drops > 8 && r.shown && r.after < r.drops * 0.5 && r.wipes === 1, r]);
  // low tier switches the lens and blur off
  r = await page.evaluate(() => { JO.Post.set('low', true); const a = [JO.Q.n('visor'), JO.Q.n('blur'), JO.Q.n('dof')]; JO.Post.set('high', true); const b = [JO.Q.n('visor'), JO.Q.n('blur'), JO.Q.n('dof')]; JO.Meta.set.dofFx = false; const c = JO.Q.n('dof'); JO.Meta.set.dofFx = true; JO.Post.set('med', true); return { a, b, c, dead: JO.Sys.list.filter(s => s.dead).map(s => s.name), errs: JO.Game.debug.errors }; });
  C.push(['effects follow tier and settings', r.a.join() === '0,0,0' && r.b.join() === '1,1,1' && r.c === 0, r]);
  C.push(['no runtime errors', !r.dead.length && !r.errs.length, r.errs]);
  // DOF renders (HIGH, aiming)
  await h.start(page, 0, { quality: 'high', noRender: false, noSpawn: true });
  await page.evaluate(() => { const P = JO.Player; JO.Enemies.reset(); P.place(1, -10); P.yaw = Math.PI; P.pitch = -0.02; JO.Input.external = true; JO.Input.ads = true; JO.Enemies.spawn('rifleman', 0.6, -22, {}).act = 'post'; });
  await h.sleep(7000); await page.screenshot({ path: 'lw4_dof.png' });
  r = await page.evaluate(() => ({ dof: JO.Post.dofPasses | 0, k: JO.Post.dofK, focus: JO.Post.focus, tier: JO.Post.tier, errs: JO.Game.debug.errors }));
  C.push(['depth of field pass runs while aiming on HIGH', r.dof > 0 && r.k > 0.5 && r.tier === 'high' && !r.errs.length, r]);
  await page.evaluate(() => { JO.Input.ads = false; JO.Input.keys.KeyV = true; JO.Weather.setState('rain', true); });
  await h.sleep(6000); await page.screenshot({ path: 'lw4_lean.png' });
  const bad = h.report('LW4', C, errors); await browser.close(); process.exit(bad ? 1 : 0);
})();
