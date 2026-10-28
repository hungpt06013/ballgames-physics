const E = require('../www/engine.js');
for (const m of E.MAPS) {
  const w = E.createWorld(m.id, null, 42);
  // stand still 2s
  for (let i = 0; i < 240; i++) E.step(w, false, false);
  const p = w.players[0];
  const stand = `stand: x=${p.x.toFixed(1)} y=${p.y.toFixed(1)} a=${p.a.toFixed(2)} cT=${p.cT.toFixed(2)}`;
  // one jump
  let minY = 1e9; E.step(w, true, false);
  for (let i = 0; i < 150; i++) { E.step(w, true, false); minY = Math.min(minY, w.players[0].y); }
  const jump = `jumpH=${(E.GROUND - E.COM_H - minY).toFixed(0)} x after=${w.players[0].x.toFixed(0)} a=${w.players[0].a.toFixed(2)}`;
  // random play, count scores
  let scores = [0, 0], t0 = Date.now(), steps = 0, nan = 0;
  const w2 = E.createWorld(m.id, null, 7);
  let r = 1; const rnd = () => (r = (r * 1103515245 + 12345) % 2147483648) / 2147483648;
  let a = false, b = false;
  for (let i = 0; i < 120 * 300; i++) {
    if (i % 12 === 0) { a = rnd() < 0.35; b = rnd() < 0.35; }
    const s = E.step(w2, a, b); steps++;
    if (s >= 0) { scores[s]++; E.resetRound(w2, 1 - s); }
    if (!isFinite(w2.ball.x)) nan++;
  }
  const dt = Date.now() - t0;
  console.log(m.id.padEnd(9), stand, '|', jump, '| random 300s scores', scores, 'us/step', (dt * 1000 / steps).toFixed(2), 'nan', nan, 'events', w2.events.length);
}
