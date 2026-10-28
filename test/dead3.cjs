const E = require('../www/engine.js');
const id = process.argv[2] || 'basket';
let r = 12345; const rnd = () => (r = (r * 1664525 + 1013904223) >>> 0) / 4294967296;
const stats = { grounded: 0, air: 0, lofted: 0, total: 0 }, rows = [];
for (let k = 0; k < 40; k++) {
  const w = E.createWorld(id, null, 100 + k); w.events = [];
  const R = w.arena.P.ballR;
  for (const p of w.players) p.x = p.team === 0 ? 100 : E.W - 100;
  const me = w.players[1]; me.x = 300 + rnd() * 900;
  for (let i = 0; i < 40; i++) E.step(w, false, false);
  const b = w.ball; b.x = 300 + rnd() * 1000; b.y = E.GROUND - R; b.vx = b.vy = 0;
  let until = 0, pend = null;
  for (let i = 0; i < 120 * 8; i++) {
    const dx = (b.x - me.x) * me.f;
    const lean = Math.sin(me.a) * Math.sign(b.x - me.x);
    if (w.time > until + 0.2 && me.cT < 0.05) {
      if (dx > -15 && dx < 85 && b.y > E.GROUND - 200) { until = w.time + 0.12; pend = { t: w.time, dx: dx | 0, a: +me.a.toFixed(2), cT: +me.cT.toFixed(2), h: (E.GROUND - R - b.y) | 0, max: 0 }; rows.push(pend); }
      else if ((dx >= 85 || dx <= -15) && lean > 0.04) until = w.time + 0.12;
    }
    w.ball.idle = 0;
    E.step(w, w.time < until, false);
    if (pend && w.time - pend.t < 0.6) pend.max = Math.max(pend.max, (E.GROUND - R - b.y) | 0);
  }
}
const g = rows.filter(r => r.cT < 0.07), a = rows.filter(r => r.cT >= 0.07);
const TH = +(process.argv[3] || 200); const good = x => x.filter(r => r.max > TH).length;
console.log('near presses', rows.length, '| grounded', g.length, 'lofted>200', good(g), '| airborne', a.length, 'lofted', good(a));
console.log('fail', g.filter(r => r.max <= TH).map(r => `dx${r.dx} a${r.a} h${r.h} max${r.max}`).join(' | '));
