// How high can a player kick a ball that is lying still on the ground?
const E = require('../www/engine.js');
const maps = process.argv[2] ? process.argv[2].split(',') : E.MAPS.map(m => m.id);
for (const id of maps) {
  const res = [];
  for (const d of [20, 40, 55, 70, 85, 100, 120]) {
    for (const hold of [0.1, 0.3]) {
      const w = E.createWorld(id, null, 3); w.events = null;
      const A = w.arena, R = A.P.ballR;
      // move everybody else far away
      for (const p of w.players) { p.x = p.team === 0 ? 120 : E.W - 120; }
      const p = w.players[1]; p.x = 700; // red forward, facing right
      for (let i = 0; i < 60; i++) E.step(w, false, false);
      const b = w.ball; b.x = p.x + d + R; b.y = E.GROUND - R; b.vx = b.vy = 0; b.idle = 0;
      for (let i = 0; i < 30; i++) E.step(w, false, false);
      let maxH = 0, sc = -1;
      for (let i = 0; i < 240; i++) {
        const s = E.step(w, i < hold * 120, false);
        if (s >= 0 && sc < 0) sc = s;
        maxH = Math.max(maxH, E.GROUND - R - w.ball.y);
      }
      res.push(`d${d}/${hold}:${maxH.toFixed(0)}`);
    }
  }
  const A = E.buildArena(id);
  const need = A.type === 'hoop' ? `rim ${E.GROUND - A.rimY}` : A.type === 'posts' ? `bar ${E.GROUND - A.barY}` : A.type === 'volley' ? `net ${E.GROUND - A.netTop}` : `goal ${A.goalH}`;
  console.log(id.padEnd(9), need.padEnd(9), res.join(' '));
}
