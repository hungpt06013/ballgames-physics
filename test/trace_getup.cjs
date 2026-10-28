const E = require('../www/engine.js');
const [map, a0, team, secs] = [process.argv[2], +process.argv[3], +process.argv[4], +(process.argv[5] || 4)];
const w = E.createWorld(map, null, 3, {}); w.events = null;
for (const p of w.players) p.active = false;
const id = team === 0 ? 1 : 3, p = w.players[id]; p.active = true; E.resetRound(w, 0);
p.x = 800; p.a = a0; p.w = 0; p.y = E.GROUND - 40; E.shapes(p);
let low = -1e9; for (let j = 0; j < E.NS; j++) low = Math.max(low, p.sy[j] + p.rad[j]); p.y += E.GROUND - low - 1; E.shapes(p);
for (let i = 0; i < 120 * secs; i++) {
  E.stepPlayers(w, [0, 0, 0, 0]); w.balls[0].x = -9999; w.balls[0].y = 0;
  if (i % 6 === 0) console.log((i / 120).toFixed(2), 'a', p.a.toFixed(2), 'w', p.w.toFixed(2), 'x', p.x | 0, 'y', p.y | 0, 'vx', p.vx | 0, 'vy', p.vy | 0, 'cT', p.cT.toFixed(2), 'gT', p.gT.toFixed(2), 'down', p.downT.toFixed(2), 'rise', p.riseT.toFixed(2));
}
