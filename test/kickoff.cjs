// kickoff: the front players stand close enough to the ball dropped in the middle to fight for it
// prints, per sport: where the front players start, how long until the first touch, who gets there first
const E = require('../www/engine.js');
const ROUNDS = +(process.env.ROUNDS || 40);
const out = {};
for (const map of ['soccer', 'basket', 'football', 'moon', 'ice', 'giant', 'bomb']) {
  let first = [0, 0], none = 0, t = 0, fronts = 0, contested = 0;
  for (let r = 0; r < ROUNDS; r++) {
    const w = E.createWorld(map, null, 1000 + r, {});
    E.resetRound(w, -1); w.events.length = 0;
    const bots = [new E.Bot(0, 'hard', 77 + r, -1), new E.Bot(1, 'hard', 99 + r, -1)];
    const front = w.players.filter(p => p.role === 1).map(p => Math.round(p.x));
    fronts = front;
    let touched = -1, both = { 0: false, 1: false };
    for (let i = 0; i < 4 * 120; i++) {
      const a = bots[0].update(w), b = bots[1].update(w);
      E.stepPlayers(w, [a, a, b, b]);
      w.events.length = 0;
      const ball = w.balls[0];
      for (const team of [0, 1]) if (ball.touchT[team] >= 0) both[team] = true;
      if (touched < 0 && ball.lastTeam >= 0) { touched = ball.lastTeam; t += w.time; first[touched]++; }
      if (w.time > 2.5) break;
    }
    if (touched < 0) none++;
    if (both[0] && both[1]) contested++;
  }
  const n = ROUNDS - none;
  out[map] = { fronts: fronts.join('/'), firstTouch: n ? (t / n).toFixed(2) + ' s' : '-', first: first.join(':'), bothTouchIn2_5s: contested + '/' + ROUNDS };
}
console.table(out);
// fairness: the same round with the ball pushed right or left at the start must end mirrored (both sides pressing alike)
let worst = 0;
for (const map of ['soccer', 'basket', 'football', 'moon', 'ice', 'giant', 'bomb']) {
  for (let r = 0; r < 20; r++) {
    const xs = [];
    for (const sgn of [1, -1]) {
      const w = E.createWorld(map, null, 500 + r, {}); E.resetRound(w, -1); w.events.length = 0;
      w.ball.vx = Math.abs(w.ball.vx) * sgn;
      for (let i = 0; i < 180; i++) { const p = w.time >= 0.1 && w.time < 0.35; E.stepPlayers(w, [p, p, p, p]); w.events.length = 0; }
      xs.push(w.ball.x);
    }
    worst = Math.max(worst, Math.abs(xs[0] - 800 + xs[1] - 800));
  }
}
console.log((worst < 0.5 ? 'ok   ' : 'FAIL ') + 'kickoff mirrored for both sides (largest difference ' + worst.toFixed(2) + ' px)');
module.exports = out;
