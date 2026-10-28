const E = require('../www/engine.js');
const w = E.createWorld(process.argv[2]||'ice', null, 42);
const p = w.players[0];
for (let i = 0; i <= 600; i++) {
  if (i % 30 === 0) console.log((i/120).toFixed(2), 'x', p.x.toFixed(1), 'y', p.y.toFixed(1), 'vx', p.vx.toFixed(1), 'a', p.a.toFixed(3), 'w', p.w.toFixed(2), 'gT', p.gT.toFixed(2), 'leg', p.leg.toFixed(2), 'footY', (p.sy[0]+10).toFixed(1), 'kfootY', (p.sy[7]+11).toFixed(1));
  E.step(w, false, false);
}
