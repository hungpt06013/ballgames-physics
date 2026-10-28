// how long a fallen player needs to stand up again, from various angles (no presses / tapping)
const E = require(process.env.ENGINE || '../www/engine.js');
function trial(map, a0, tapEvery, team) {
  const w = E.createWorld(map, null, 3, {}); w.events = null;
  for (const p of w.players) p.active = false;
  const id = team === 0 ? 1 : 3;
  const p = w.players[id]; p.active = true;
  E.resetRound(w, 0);
  w.balls[0].x = -9999; w.balls[0].y = 0; // keep the ball out of the way
  p.x = 800; p.a = a0; p.w = 0; p.vx = p.vy = 0; p.y = E.GROUND - 40; E.shapes(p);
  let low = -1e9; for (let j = 0; j < E.NS; j++) low = Math.max(low, p.sy[j] + p.rad[j]);
  p.y += E.GROUND - low - 1; E.shapes(p);
  const pr = [false, false, false, false];
  let ok = 0;
  for (let i = 0; i < 120 * 12; i++) {
    const t = i * E.DT;
    pr[id] = tapEvery > 0 && (t % tapEvery) < 0.1;
    E.stepPlayers(w, pr);
    w.balls[0].x = -9999; w.balls[0].y = 0; w.balls[0].vx = w.balls[0].vy = 0;
    // back on the feet: without tapping it has to stay standing for a moment; with tapping, landing upright counts
    if (Math.abs(p.a) < (tapEvery ? 0.5 : 0.35) && p.gT < 0.07) { ok += E.DT; if (ok > (tapEvery ? 0 : 0.25)) return (t - (tapEvery ? 0 : 0.25)).toFixed(2); } else ok = 0;
  }
  return '>12';
}
const angles = [1.3, 1.57, 2.0, 2.5, 2.9, 3.1, -1.3, -1.57, -2.0, -2.5, -2.9, -3.1];
for (const map of (process.env.MAPS || 'soccer,ice,moon').split(',')) {
  for (const tap of [0, 0.6]) {
    const row = angles.map(a => [0, 1].map(team => trial(map, a, tap, team)).join('/'));
    console.log(map.padEnd(7), tap ? 'tap0.6' : 'notap ', angles.map((a, i) => a + ':' + row[i]).join('  '));
  }
}
