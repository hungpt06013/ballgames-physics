// Players touching each other: no visible jumps (a step's correction stays small), no overlapping or sticking
// together (team-mates or opponents), and a team-mate jumping right behind doesn't launch the one in front.
// node test/contacts.cjs [engine path]
const E = require(process.argv[2] || '../www/engine.js');
const NS = E.NS;
let fails = 0;
const check = (name, ok, info) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== undefined ? '  ' + info : '')); };

// 1. real bot games: per-step extra displacement and deep overlaps
const jumps = [], deep = { mate: [0, 0], opp: [0, 0] };
function overlap(A, B) { let w = -Infinity; for (let i = 0; i < NS; i++) for (let j = 0; j < NS; j++) { const dx = A.sx[i] - B.sx[j], dy = A.sy[i] - B.sy[j], p = A.rad[i] + B.rad[j] - Math.hypot(dx, dy); if (p > w) w = p; } return w; }
for (const id of ['soccer', 'ice', 'basket', 'moon']) for (let g = 0; g < 2; g++) {
  const w = E.createWorld(id, null, 40 + g, {}); w.events = null;
  const a = new E.Bot(0, 'hard', g + 1), c = new E.Bot(1, g ? 'easy' : 'normal', g + 9);
  for (let s = 0; s < 40 * 120; s++) {
    const before = w.players.map(p => [p.x, p.y]);
    const sc = E.step(w, a.update(w), c.update(w));
    if (sc >= 0) { E.resetRound(w, 1 - sc); continue; }
    w.players.forEach((p, i) => jumps.push(Math.hypot(p.x - before[i][0] - p.vx * E.DT, p.y - before[i][1] - p.vy * E.DT)));
    if (s % 4) continue;
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) { const k = w.players[i].team === w.players[j].team ? 'mate' : 'opp'; deep[k][1]++; if (overlap(w.players[i], w.players[j]) > 10) deep[k][0]++; }
  }
}
jumps.sort((x, y) => x - y);
const q = f => jumps[Math.floor(f * (jumps.length - 1))];
check('no visible jumps: a step moves a player at most a few px beyond his own speed', q(0.999) < 7 && jumps[jumps.length - 1] < 20,
  'p99 ' + q(0.99).toFixed(1) + ' p99.9 ' + q(0.999).toFixed(1) + ' max ' + jumps[jumps.length - 1].toFixed(1) + ' px');
for (const k of ['mate', 'opp']) check(k + 's hardly ever overlap deeply', deep[k][0] / deep[k][1] < 0.002, (100 * deep[k][0] / deep[k][1]).toFixed(2) + '% of the time');

// 2. two players close together pressing now and then: how long do they stay in touch?
function stuck(pair, gap0, gap1) {
  let longest = 0;
  for (const id of ['soccer', 'ice', 'moon', 'basket']) for (let seed = 1; seed <= 12; seed++) {
    const w = E.createWorld(id, null, seed, {}); w.events = null;
    let r = seed * 7919 >>> 0; const rnd = () => (r = (r * 1664525 + 1013904223) >>> 0) / 4294967296;
    const ia = pair === 'opp' ? 0 : 1, ib = pair === 'opp' ? 3 : 0, A = w.players[ia], B = w.players[ib];
    w.players.forEach((p, i) => { if (i !== ia && i !== ib) p.x = i < 2 ? -900 - i * 200 : E.W + 900 + i * 200; });
    if (pair === 'opp') { A.x = 740; B.x = 860; } else { A.x = 600; B.x = 680; }
    A.y = B.y = E.GROUND - E.COM_H; E.shapes(A); E.shapes(B);
    const until = [0, 0], next = [rnd(), rnd()]; let run = 0;
    for (let s = 0; s < 120 * 20; s++) {
      const t = s / 120;
      for (let k = 0; k < 2; k++) if (t >= next[k]) { until[k] = t + 0.06 + rnd() * 0.4; next[k] = until[k] + gap0 + rnd() * gap1; }
      const pr = [false, false, false, false]; pr[ia] = t < until[0]; pr[ib] = t < until[1];
      E.stepPlayers(w, pr);
      w.balls.forEach(b => { b.x = b.prevX = 800; b.y = b.prevY = -400; b.vx = b.vy = 0; });
      run = overlap(A, B) > -1 ? run + 1 / 120 : 0; longest = Math.max(longest, run);
    }
  }
  return longest;
}
for (const pair of ['opp', 'mate']) for (const g of [[1, 4], [2, 8]]) {
  const l = stuck(pair, g[0], g[1]);
  check((pair === 'opp' ? 'opponents' : 'team-mates') + ' don\'t stay stuck together (presses every ' + g[0] + '-' + (g[0] + g[1]) + ' s)', l < 2, 'longest touch ' + l.toFixed(1) + ' s');
}

// 3. a team-mate jumping right behind: no launch
function jumpFront(id, gap, delay, alone, holdT) {
  const w = E.createWorld(id, null, 3, {}); w.events = null;
  const F = w.players[0], B = w.players[1]; w.players[2].x = 2600; w.players[3].x = 2900;
  F.x = 600; B.x = alone ? -1200 : 600 - gap;
  for (const p of [F, B]) { p.y = E.GROUND - E.COM_H * p.sc; p.vx = p.vy = p.w = p.a = 0; E.shapes(p); }
  let top = 0, dx = 0;
  for (let s = 0; s < 120 * 2.5; s++) { const t = s / 120; E.stepPlayers(w, [t >= 0.3 && t < 0.3 + holdT, t >= 0.3 + delay && t < 0.3 + delay + holdT, false, false]);
    w.balls.forEach(b => { b.x = b.prevX = 1500; b.y = b.prevY = -400; b.vx = b.vy = 0; }); top = Math.max(top, E.GROUND - E.COM_H - F.y); dx = Math.max(dx, F.x - 600); }
  return { top, dx };
}
for (const id of ['soccer', 'moon']) for (const holdT of [0.1, 0.6]) {
  const a = jumpFront(id, 0, 0, true, holdT); let worst = { top: 0, dx: 0 };
  for (let gap = 50; gap <= 130; gap += 20) for (const delay of [0, 0.05, 0.1]) { const r = jumpFront(id, gap, delay, false, holdT); worst.top = Math.max(worst.top, r.top); worst.dx = Math.max(worst.dx, r.dx); }
  check(id + ', hold ' + holdT + ' s: a team-mate behind doesn\'t launch the one in front', worst.top <= a.top * 1.05 + 2 && worst.dx <= a.dx * 1.35 + 5,
    'alone top ' + a.top.toFixed(0) + ' dx ' + a.dx.toFixed(0) + ' / with mate top ' + worst.top.toFixed(0) + ' dx ' + worst.dx.toFixed(0));
}
console.log(fails ? fails + ' FAILED' : 'all checks passed');
