// team-level hard bot vs greedy on given maps, plus a per-player-bot team test
const E = require('../www/engine.js');
const maps = (process.argv[2] || 'soccer,basket,football,volley,moon,ice,giant,bomb').split(','), ROUNDS = +(process.argv[3] || 8), MODE = process.argv[4] || 'team';
function greedy(team, seed) {
  let r = seed >>> 0; const rnd = () => (r = (r * 1664525 + 1013904223) >>> 0) / 4294967296;
  let until = 0, seen = -1;
  return w => { const b = w.ball; let close = false;
    for (const p of w.players) if (p.team === team) { const dx = (b.x - p.x) * p.f; if (dx > -20 && dx < 150 && b.y > E.GROUND - 330) close = true; }
    if (close && seen < 0) seen = w.time; if (!close) seen = -1;
    if (seen >= 0 && w.time - seen > 0.15 + rnd() * 0.05 && w.time > until + 0.25) until = w.time + 0.18;
    return w.time < until; };
}
const tot = [0, 0, 0], per = {}; const t0 = Date.now();
for (const id of maps) {
  per[id] = [0, 0, 0];
  for (let r = 0; r < ROUNDS; r++) {
    const botTeam = r % 2; // alternate sides
    const w = E.createWorld(id, null, 100 + r); w.events = null;
    let bots;
    if (MODE === 'slots') bots = [0, 1, 2, 3].filter(i => (i < 2 ? 0 : 1) === botTeam).map(i => new E.Bot(botTeam, 'hard', 9 + i + r, i));
    else bots = [new E.Bot(botTeam, 'hard', 9 + r)];
    const g = greedy(1 - botTeam, 3 + r); const pr = [false, false, false, false];
    let out = 2;
    for (let i = 0; i < 120 * 45; i++) {
      const gp = g(w);
      for (let k = 0; k < 4; k++) pr[k] = (k < 2 ? 0 : 1) !== botTeam ? gp : false;
      if (MODE === 'slots') bots.forEach(b => { pr[b.slot] = b.update(w); });
      else { const bp = bots[0].update(w); for (let k = 0; k < 4; k++) if ((k < 2 ? 0 : 1) === botTeam) pr[k] = bp; }
      const s = E.stepPlayers(w, pr);
      if (s >= 0) { out = s === botTeam ? 0 : 1; if (process.env.DIAG) console.log(id, "r" + r, "bot", botTeam, "out", w.out, "hitBy", w.players[w.out] ? w.players[w.out].lastHitBy : "-", "t", w.time.toFixed(1)); break; }
    }
    per[id][out]++; tot[out]++;
  }
}
console.log(MODE, 'hard-bot vs greedy', JSON.stringify(per), 'TOTAL bot/greedy/draw', tot, ((Date.now() - t0) / 1000).toFixed(0) + 's');
