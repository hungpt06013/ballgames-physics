const E = require('../www/engine.js');
for (const id of ['soccer', 'basket']) {
  const w = E.createWorld(id, null, 5); w.events = null;
  const b = new E.Bot(1, 'hard', 9), a = new E.Bot(0, 'normal', 3);
  const ts = [];
  for (let i = 0; i < 120 * 60; i++) {
    const pa = a.update(w);
    const t = process.hrtime.bigint(); const pb = b.update(w); ts.push(Number(process.hrtime.bigint() - t) / 1e6);
    if (E.step(w, pa, pb) >= 0) { E.resetRound(w, -1); a.reset(); b.reset(); }
  }
  const s = ts.slice(600).sort((x, y) => x - y), q = p => s[Math.floor(p * (s.length - 1))].toFixed(2);
  const frames = []; for (let i = 600; i + 1 < ts.length; i += 2) frames.push(ts[i] + ts[i + 1]); frames.sort((x, y) => x - y);
  console.log(id, 'per-step ms p50', q(0.5), 'p90', q(0.9), 'p99', q(0.99), 'max', q(1), '| per 60fps frame p99', frames[Math.floor(0.99 * frames.length)].toFixed(2), 'max', frames[frames.length - 1].toFixed(2), 'first', ts.slice(0, 5).map(x => x.toFixed(1)).join(','));
}
