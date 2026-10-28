const E = require('../www/engine.js');
const id = process.argv[2] || 'basket';
let r = 12345; const rnd = () => (r = (r * 1664525 + 1013904223) >>> 0) / 4294967296;
for (let k = 0; k < 8; k++) {
  const w = E.createWorld(id, null, 100 + k); w.events = [];
  const R = w.arena.P.ballR;
  for (const p of w.players) p.x = p.team === 0 ? 100 : E.W - 100;
  const me = w.players[1]; me.x = 300 + rnd() * 900;
  for (let i = 0; i < 40; i++) E.step(w, false, false);
  const b = w.ball; b.x = 300 + rnd() * 1000; b.y = E.GROUND - R; b.vx = b.vy = 0;
  let until = 0, presses = 0, nearPress = 0, kicks = 0, body = 0, maxH = 0, minDx = 1e9, fallen = 0;
  for (let i = 0; i < 120 * 8; i++) {
    const dx = (b.x - me.x) * me.f;
    const lean = Math.sin(me.a) * Math.sign(b.x - me.x);
    if (w.time > until + 0.25) {
      if (dx > -10 && dx < 110 && b.y > E.GROUND - 200) { until = w.time + 0.12; presses++; nearPress++; }
      else if (Math.abs(b.x - me.x) > 110 && lean > 0.05) { until = w.time + 0.12; presses++; }
    }
    w.ball.idle = 0; w.events.length = 0;
    E.step(w, w.time < until, false);
    for (const e of w.events) { if (e.t === 'kick' && e.team === 0) kicks++; if ((e.t === 'body' || e.t === 'head') && e.team === 0) body++; }
    maxH = Math.max(maxH, E.GROUND - R - b.y); minDx = Math.min(minDx, Math.abs(b.x - me.x));
    if (Math.abs(me.a) > 1.2) fallen++;
  }
  console.log(k, 'presses', presses, 'nearPresses', nearPress, 'kicks', kicks, 'bodyHits', body, 'maxH', maxH.toFixed(0), 'minDx', minDx.toFixed(0), 'fallen%', (fallen / 9.6).toFixed(0), 'ballX', b.x.toFixed(0), 'meX', me.x.toFixed(0), 'f', me.f);
}
