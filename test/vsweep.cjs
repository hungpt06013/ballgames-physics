const E = require('../www/engine.js');
const m = E.MAP_BY_ID.volley, base = Object.assign({}, m);
function setp(c) { Object.assign(m, base, c); }
function headTime() {
  const w = E.createWorld('volley', null, 1); E.resetRound(w, 0);
  for (const p of w.players) p.x = p.team === 0 ? 150 : E.W - 150;
  const b = w.ball; w.events = null; let t = 0, v = 0;
  while (b.y < E.GROUND - 205 && t < 10) { E.step(w, false, false); t += E.DT; }
  return [t, b.vy];
}
function play() {
  let off = 0, n = 0, pts = 0, touches = 0;
  for (let k = 0; k < 3; k++) {
    const w = E.createWorld('volley', null, k + 3); w.events = [];
    const b1 = new E.Bot(0, 'normal', k + 1), b2 = new E.Bot(1, 'normal', k + 9);
    for (let i = 0; i < 120 * 60; i++) {
      w.events.length = 0;
      const s = E.step(w, b1.update(w), b2.update(w));
      for (const e of w.events) if (e.t === 'kick' || e.t === 'head') touches++;
      if (s >= 0) { pts++; E.resetRound(w, 1 - s); b1.reset(); b2.reset(); }
      n++; if (w.ball.y < -30) off++;
    }
  }
  return { off: (off / n * 100).toFixed(1) + '%', pointsPerMin: (pts / 3).toFixed(1), hitsPerPoint: (touches / Math.max(1, pts)).toFixed(1) };
}
const sets = {
  'v1.2 now': {},
  A: { gBall: 330 },
  B: { gBall: 300, ballDrag: 0.55 },
  C: { gBall: 300, ballDrag: 0.55, kickE: 0.55, legSpd: 12 },
  D: { gBall: 280, ballDrag: 0.5, kickE: 0.6, legSpd: 13 },
};
for (const k in sets) { setp(sets[k]); const [t, v] = headTime(); console.log(k.padEnd(9), JSON.stringify(sets[k]).padEnd(56), 'serve->head', t.toFixed(2) + 's at', v.toFixed(0) + 'px/s', JSON.stringify(play())); }
