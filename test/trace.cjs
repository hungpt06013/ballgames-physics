const E = require('../www/engine.js');
const id = process.argv[2] || 'soccer', d = +(process.argv[3] || 40);
const w = E.createWorld(id, null, 3); w.events = [];
const R = w.arena.P.ballR;
for (const p of w.players) p.x = p.team === 0 ? 120 : E.W - 120;
const p = w.players[1]; p.x = 700;
for (let i = 0; i < 60; i++) E.step(w, false, false);
const b = w.ball; b.x = p.x + d + R; b.y = E.GROUND - R; b.vx = b.vy = 0;
for (let i = 0; i < 30; i++) E.step(w, false, false);
console.log('start a', p.a.toFixed(2), 'x', p.x.toFixed(0), 'ball x', b.x.toFixed(0));
for (let i = 0; i < 24; i++) {
  w.events.length = 0;
  E.step(w, i < 36, false);
  const fx = p.sx[7] - b.x, fy = p.sy[7] - b.y, kx = p.sx[6] - b.x, ky = p.sy[6] - b.y;
  console.log(i, 'leg', p.leg.toFixed(2), 'legW', p.legW.toFixed(1), 'vy', p.vy.toFixed(0), '| foot-ball', fx.toFixed(0), fy.toFixed(0), 'dist', Math.hypot(fx, fy).toFixed(0), '| knee', Math.hypot(kx, ky).toFixed(0), '| ball', b.vx.toFixed(0), b.vy.toFixed(0), w.events.map(e => e.t).join(','));
}
