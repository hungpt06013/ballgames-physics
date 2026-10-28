const E = require('../www/engine.js');
if (process.env.LV) Object.assign(E.LEVELS, JSON.parse(process.env.LV));
const [,, A = 'hard', B = 'greedy', ROUNDS = '14', SEED = '1', MAPS = 'all'] = process.argv;
const TH = {}, TS = {}, TM = {};
function mkCtrl(kind, team, seed) {
  if (E.LEVELS[kind]) { const b = new E.Bot(team, kind, seed);
    return { reset: () => b.reset(), get: (w) => { const t = process.hrtime.bigint(); const r = b.update(w); const dt = Number(process.hrtime.bigint() - t) / 1e6; TH[kind] = (TH[kind] || 0) + dt; TS[kind] = (TS[kind] || 0) + 1; if (dt > (TM[kind] || 0)) TM[kind] = dt; return r; }, stats: () => `${kind} ${(TH[kind] / TS[kind] * 120).toFixed(1)}ms per game-sec, max step ${TM[kind].toFixed(2)}ms` }; }
  let r = seed >>> 0; const rnd = () => (r = (r * 1664525 + 1013904223) >>> 0) / 4294967296;
  if (kind === 'random') { let cur = false, until = 0; return { reset() {}, get(w) { if (w.time >= until) { cur = rnd() < 0.3; until = w.time + 0.05 + rnd() * 0.3; } return cur; }, stats: () => 'random' }; }
  if (kind === 'spam') { return { reset() {}, get(w) { return (w.time % 0.35) < 0.1; }, stats: () => 'spam' }; }
  if (kind === 'greedy') { // human-like: press shortly after the ball comes close in front of a player
    let pressUntil = 0, seenAt = -1;
    return { reset() { pressUntil = 0; seenAt = -1; }, get(w) {
      const b = w.ball; let close = false;
      for (const p of w.players) if (p.team === team) { const dx = (b.x - p.x) * p.f; if (dx > -20 && dx < 150 && b.y > E.GROUND - 330) close = true; }
      if (close && seenAt < 0) seenAt = w.time;
      if (!close) seenAt = -1;
      if (seenAt >= 0 && w.time - seenAt > 0.15 + rnd() * 0.05 && w.time > pressUntil + 0.25) pressUntil = w.time + 0.18;
      return w.time < pressUntil; }, stats: () => 'greedy' }; }
  throw new Error('bad ctrl ' + kind);
}
const maps = MAPS === 'all' ? E.MAPS.map(m => m.id) : MAPS.split(',');
let ca, cb;
const res = {}; let tot = [0, 0, 0]; const t0 = Date.now();
for (const id of maps) {
  res[id] = [0, 0, 0];
  for (let r = 0; r < +ROUNDS; r++) {
    // alternate sides to cancel side bias: swap controllers every other round
    const swap = r % 2 === 1;
    const w = E.createWorld(id, null, +SEED * 1000 + r);
    w.events = null;
    const c0 = mkCtrl(swap ? B : A, 0, +SEED * 7 + r * 31), c1 = mkCtrl(swap ? A : B, 1, +SEED * 13 + r * 17);
    ca = swap ? c1 : c0; cb = swap ? c0 : c1;
    let out = 2;
    for (let i = 0; i < 120 * 45; i++) {
      const s = E.step(w, c0.get(w), c1.get(w));
      if (s >= 0) { out = s; break; }
    }
    let k = out === 2 ? 2 : ((out === 0) !== swap ? 0 : 1); // 0 => A won point
    res[id][k]++; tot[k]++;
  }
}
function mkCtrlSide(c) { return c; }
console.log(`${A} vs ${B}`, JSON.stringify(res), 'TOTAL A/B/draw', tot, `${((Date.now() - t0) / 1000).toFixed(0)}s`, ca.stats(), cb.stats());
