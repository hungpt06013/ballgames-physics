// how often a side scores in the first seconds of a round (attacker: hard bot; defender: hard bot, or nobody pressing)
const E = require('../www/engine.js');
const ROUNDS = +(process.env.ROUNDS || 60);
const res = {};
for (const map of (process.env.MAPS || 'soccer,moon,ice,giant,basket,football').split(',')) {
  const r = {};
  for (const def of ['bot', 'idle']) {
    let in2 = 0, in3 = 0, tSum = 0, n = 0;
    for (let k = 0; k < ROUNDS; k++) {
      const w = E.createWorld(map, null, 3000 + k, {});
      E.resetRound(w, -1); w.events.length = 0;
      const att = new E.Bot(0, 'hard', 11 + k, -1), dfn = def === 'bot' ? new E.Bot(1, 'hard', 23 + k, -1) : null;
      for (let i = 0; i < 3 * 120; i++) {
        const a = att.update(w), d = dfn ? dfn.update(w) : false;
        const sc = E.stepPlayers(w, [a, a, d, d]); w.events.length = 0;
        if (sc === 0) { if (w.time <= 2) in2++; in3++; tSum += w.time; n++; break; }
        if (sc === 1) break;
      }
    }
    r[def + ' keeper: goal ≤2s'] = Math.round(100 * in2 / ROUNDS) + '%';
    r[def + ' ≤3s'] = Math.round(100 * in3 / ROUNDS) + '%';
  }
  res[map] = r;
}
console.table(res);
