// Stress test: can a player ever get to the other side of the volleyball net?
const E = require('../www/engine.js');
let r = 99; const rnd = () => (r = (r * 1664525 + 1013904223) >>> 0) / 4294967296;
let worst = [-1e9, -1e9], crossed = 0, frames = 0;
for (let k = 0; k < 6; k++) {
  const w = E.createWorld('volley', null, k + 1); w.events = null;
  const pr = [false, false, false, false];
  for (let i = 0; i < 120 * 120; i++) {
    if (i % 10 === 0) for (let q = 0; q < 4; q++) pr[q] = rnd() < (k % 2 ? 0.6 : 0.3);
    const s = E.stepPlayers(w, pr);
    if (s >= 0) E.resetRound(w, 1 - s);
    frames++;
    for (const p of w.players) {
      let over = -1e9;
      for (let j = 0; j < E.NS; j++) {
        const edge = p.team === 0 ? (p.sx[j] + E.RAD[j]) - E.W / 2 : E.W / 2 - (p.sx[j] - E.RAD[j]);
        if (edge > over) over = edge;
      }
      if (over > worst[p.team]) worst[p.team] = over;
      if ((p.team === 0 && p.x > E.W / 2) || (p.team === 1 && p.x < E.W / 2)) crossed++;
    }
  }
}
console.log('frames', frames, 'max body overlap past the net (px) red/blue', worst.map(v => v.toFixed(1)), 'frames with a player centre on the wrong side', crossed);
