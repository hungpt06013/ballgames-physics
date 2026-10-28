// Dead ball on the ground: how long until a simple human-like player lofts it above a target height?
const E = require('../www/engine.js');
const maps = (process.argv[2] || 'basket,football,soccer,volley,moon,ice,giant').split(',');
let r = 12345; const rnd = () => (r = (r * 1664525 + 1013904223) >>> 0) / 4294967296;
for (const id of maps) {
  const A0 = E.buildArena(id);
  const target = A0.type === 'hoop' ? E.GROUND - A0.rimY : A0.type === 'posts' ? E.GROUND - A0.barY : 200;
  let ok = 0, times = [], N = 40;
  for (let k = 0; k < N; k++) {
    const w = E.createWorld(id, null, 100 + k); w.events = null;
    const R = w.arena.P.ballR;
    for (const p of w.players) p.x = p.team === 0 ? 100 : E.W - 100;
    const me = w.players[1]; me.x = 300 + rnd() * 900;
    for (let i = 0; i < 40; i++) E.step(w, false, false);
    const b = w.ball; b.x = 300 + rnd() * 1000; b.y = E.GROUND - R; b.vx = b.vy = 0;
    let until = 0, t = 0, done = false;
    for (let i = 0; i < 120 * 8; i++) {
      // human-ish: tap when the ball is close in front; otherwise hop towards it when leaning that way
      const dx = (b.x - me.x) * me.f;
      const lean = Math.sin(me.a) * Math.sign(b.x - me.x);
      const grounded = me.cT < 0.05;
      if (w.time > until + 0.2 && grounded) {
        if (dx > -15 && dx < 85 && b.y > E.GROUND - 200) until = w.time + 0.12;
        else if ((dx >= 85 || dx <= -15) && lean > 0.04) until = w.time + 0.12;
      }
      w.ball.idle = 0; // keep the dead ball where it is
      E.step(w, w.time < until, false);
      if (E.GROUND - R - b.y > target) { done = true; t = i / 120; break; }
    }
    if (done) { ok++; times.push(t); }
  }
  times.sort((a, b) => a - b);
  console.log(id.padEnd(9), 'target', target, 'lofted in', ok + '/' + N, 'median time', times.length ? times[times.length >> 1].toFixed(2) + 's' : '-');
}
