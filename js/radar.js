/* ============================================================
   JUNGLE OUTPOST — radar.js
   Minimap (top right) and compass strip (top centre).
   The map turns with the player. Alerted enemies show as red
   pings; unaware ones as dim wedges showing which way they look,
   so stealth can be planned. Checkpoints, the flag, supply
   crates, pickups and puzzle pieces are marked too. Redrawn ten
   times a second on small 2D canvases.
   ============================================================ */
(function () {
'use strict';
var JO = window.JO, W = JO.World, E = JO.Enemies;
var R = JO.Radar = { range: 46, on: true };
var map, mc, cmp, cc, t = 0, S = 150, pingT = 0;
var COL = { hot: '#ff4a3a', cold: 'rgba(233,228,207,.55)', cp: '#ffb62e', flag: '#5cff7a', obj: '#58e0d0', item: 'rgba(255,255,255,.6)' };
R.palette = function (cb) { COL.hot = cb ? '#ff9d00' : '#ff4a3a'; COL.flag = cb ? '#5ab4ff' : '#5cff7a'; };

R.init = function () {
  map = document.getElementById('minimap'); cmp = document.getElementById('compass'); if (!map || !cmp) return;
  mc = map.getContext('2d'); cc = cmp.getContext('2d');
};
function bearing() { var P = JO.Player; return Math.atan2(Math.sin(P.yaw), -Math.cos(P.yaw)); }      // 0 = north (-Z), east = +X
R.update = function (real) {
  if (!mc) return; t -= real; pingT += real; if (t > 0) return; t = 0.1;
  var G = JO.Game, show = R.on && (G.state === 'playing' || G.state === 'dying') && !JO.Story.cine;
  if (map.classList.contains('hidden') === show) { map.classList.toggle('hidden', !show); cmp.classList.toggle('hidden', !show); }
  if (!show) return;
  var P = JO.Player, px = P.pos.x, pz = P.pos.z, h = bearing(), cs = Math.cos(h), sn = Math.sin(h), k = S / 2 / R.range, L = E.list, i, hw;
  // world -> map: player at the centre, his heading at the top
  function mx(x, z) { var dx = x - px, dn = -(z - pz); return S / 2 + (dx * cs - dn * sn) * k; }
  function my(x, z) { var dx = x - px, dn = -(z - pz); return S / 2 - (dx * sn + dn * cs) * k; }
  function dot(x, z, r, col) { var a = mx(x, z), b = my(x, z); if (a < 2 || b < 2 || a > S - 2 || b > S - 2) return false; mc.fillStyle = col; mc.beginPath(); mc.arc(a, b, r, 0, 6.3); mc.fill(); return true; }
  function sq(x, z, r, col) { var a = mx(x, z), b = my(x, z); if (a < 2 || b < 2 || a > S - 2 || b > S - 2) return; mc.fillStyle = col; mc.fillRect(a - r, b - r, r * 2, r * 2); }
  mc.clearRect(0, 0, S, S); mc.save(); mc.beginPath(); mc.arc(S / 2, S / 2, S / 2 - 1, 0, 6.3); mc.clip();
  mc.fillStyle = 'rgba(8,14,8,.72)'; mc.fillRect(0, 0, S, S);
  // the trail corridor (it widens into the arena)
  mc.strokeStyle = 'rgba(255,255,255,.22)'; mc.lineWidth = 1; mc.beginPath();
  for (var side = -1; side <= 1; side += 2) { var first = true; for (var z = pz + R.range * 1.5; z >= pz - R.range * 1.5; z -= 3) { hw = W.halfWidth(z) * side; var a = mx(hw, z), b = my(hw, z); if (first) { mc.moveTo(a, b); first = false; } else mc.lineTo(a, b); } }
  mc.stroke();
  for (i = 0; i < W.checkpoints.length; i++) sq(W.checkpoints[i].flag.x, W.checkpoints[i].z, 3, W.checkpoints[i].reached ? 'rgba(92,255,122,.7)' : COL.cp);
  for (i = 0; i < W.crates.length; i++) if (!W.crates[i].opened) sq(W.crates[i].x, W.crates[i].z, 2, COL.item);
  if (W.flag && W.flag.grp.visible) sq(W.flag.x, W.flag.z, 4, COL.flag);
  var Pr = JO.Props; if (Pr) { if (Pr.gate && !Pr.gate.open) sq(Pr.gate.tx, Pr.gate.tz, 3, COL.obj); if (Pr.door && !Pr.door.open) for (i = 0; i < 3; i++) sq(Pr.door.levers[i].x, Pr.door.levers[i].z, 2.5, COL.obj);
    if (Pr.veh && Pr.veh.alive && !Pr.veh.mounted) sq(Pr.veh.x, Pr.veh.z, 3, COL.obj);
    for (i = 0; i < Pr.list.length; i++) { var p = Pr.list[i]; if (p.alive && p.kind === 'barrel') dot(p.x, p.z, 1.6, 'rgba(255,120,60,.8)'); } }
  // enemies
  var pulse = 0.6 + 0.4 * Math.sin(pingT * 8);
  for (i = 0; i < L.length; i++) { var e = L[i]; if (!e.alive || !e.active) continue;
    if (e.isBoss) { if (G.bossFight) dot(e.pos.x, e.pos.z, 5, COL.hot); continue; }
    if (e.state === 'patrol') { var ex = mx(e.pos.x, e.pos.z), ey = my(e.pos.x, e.pos.z); if (ex < 2 || ey < 2 || ex > S - 2 || ey > S - 2) continue;
      var fa = Math.atan2(Math.sin(e.yaw), -Math.cos(e.yaw)) - h - Math.PI / 2;      // his facing, in map space
      mc.fillStyle = e.aware > 0.35 ? 'rgba(255,182,46,.35)' : 'rgba(233,228,207,.16)'; mc.beginPath(); mc.moveTo(ex, ey); mc.arc(ex, ey, 16, fa - 0.9, fa + 0.9); mc.closePath(); mc.fill();
      mc.fillStyle = COL.cold; mc.beginPath(); mc.arc(ex, ey, 2.4, 0, 6.3); mc.fill(); }
    else { mc.globalAlpha = pulse; dot(e.pos.x, e.pos.z, 3, COL.hot); mc.globalAlpha = 1; } }
  // player arrow
  mc.fillStyle = '#fff'; mc.beginPath(); mc.moveTo(S / 2, S / 2 - 6); mc.lineTo(S / 2 + 4.5, S / 2 + 5); mc.lineTo(S / 2, S / 2 + 2.5); mc.lineTo(S / 2 - 4.5, S / 2 + 5); mc.closePath(); mc.fill();
  mc.restore(); mc.strokeStyle = 'rgba(255,182,46,.8)'; mc.lineWidth = 2; mc.beginPath(); mc.arc(S / 2, S / 2, S / 2 - 1, 0, 6.3); mc.stroke();

  // compass strip: 140 degrees wide
  var CW = cmp.width, CH = cmp.height, span = 2.44;
  function cx(b) { var d = b - h; while (d > Math.PI) d -= 6.2832; while (d < -Math.PI) d += 6.2832; return Math.abs(d) > span / 2 ? -1 : CW / 2 + d / span * CW; }
  cc.clearRect(0, 0, CW, CH); cc.fillStyle = 'rgba(8,14,8,.6)'; cc.fillRect(0, 0, CW, CH);
  cc.font = '11px Consolas,Menlo,monospace'; cc.textAlign = 'center'; cc.textBaseline = 'middle';
  var names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  for (i = 0; i < 24; i++) { var x = cx(i * Math.PI / 12); if (x < 0) continue; if (i % 3 === 0) { cc.fillStyle = i === 0 ? COL.cp : 'rgba(233,228,207,.9)'; cc.fillText(names[i / 3], x, CH / 2 + 1); } else { cc.fillStyle = 'rgba(233,228,207,.4)'; cc.fillRect(x, CH / 2 - 3, 1, 6); } }
  function mark(wx, wz, col, w) { var x = cx(Math.atan2(wx - px, -(wz - pz))); if (x < 0) return; cc.fillStyle = col; cc.fillRect(x - w / 2, CH - 4, w, 4); }
  var ox = 0, oz = pz - 30; if (G.bossDead && W.flag) { ox = W.flag.x; oz = W.flag.z; } else if (G.bossFight && G.boss) { ox = G.boss.pos.x; oz = G.boss.pos.z; }
  mark(ox, oz, COL.obj, 6);
  for (i = 0; i < L.length; i++) { var q = L[i]; if (q.alive && q.active && !q.isBoss && q.state !== 'patrol') mark(q.pos.x, q.pos.z, COL.hot, 3); }
  cc.fillStyle = '#fff'; cc.fillRect(CW / 2 - 0.5, 0, 1, 4);
};
})();
