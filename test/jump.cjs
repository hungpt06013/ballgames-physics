const E = require('../www/engine.js');
const w = E.createWorld(process.argv[2]||'ice', null, 42);
const p = w.players[0];
for (let i = 0; i < 240; i++) E.step(w, false, false);
for (let i = 0; i <= 100; i++) {
  const pr = i < 20;
  E.step(w, pr, false);
  if (i % 5 === 0) console.log(i, 'x', p.x.toFixed(1), 'y', p.y.toFixed(1), 'vx', p.vx.toFixed(1), 'vy', p.vy.toFixed(1), 'a', p.a.toFixed(3), 'w', p.w.toFixed(2), 'cT', p.cT.toFixed(2), 'leg', p.leg.toFixed(2));
}
