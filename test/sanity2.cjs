const E = require('../www/engine.js');
const S = Object.assign({}, E.DEFAULT_SETTINGS);
function run(id, mods, secs, seed) {
  const w = E.createWorld(id, S, seed, mods);
  let r = seed; const rnd = () => (r = (r * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pr = [false, false, false, false]; const scores = [0, 0]; let nan = 0, pickups = 0, roundT = 0, longest = 0, credits = 0;
  const t0 = Date.now(); let steps = 0;
  for (let i = 0; i < 120 * secs; i++) {
    if (i % 12 === 0) for (let k = 0; k < 4; k++) pr[k] = rnd() < 0.35;
    const s = E.stepPlayers(w, pr); steps++; roundT += E.DT;
    for (const e of w.events) if (e.t === 'pickup') pickups++;
    w.events.length = 0;
    if (s >= 0) { scores[s]++; if (w.credit >= 0) credits++; longest = Math.max(longest, roundT); roundT = 0; E.resetRound(w, 1 - s); }
    for (const b of w.balls) if (!isFinite(b.x) || !isFinite(b.y)) nan++;
    for (const p of w.players) if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.a)) nan++;
  }
  return { scores, nan, pickups, credits, longest: longest.toFixed(1), us: ((Date.now() - t0) * 1000 / steps).toFixed(1) };
}
for (const m of E.MAPS) console.log(m.id.padEnd(8), JSON.stringify(run(m.id, {}, 240, 7)));
console.log('--- modifiers (soccer / bomb / volley / basket)');
for (const mod of Object.keys(E.MODS)) {
  const out = [];
  for (const id of ['soccer', 'bomb', 'volley', 'basket']) {
    if (!E.modsFor(id).includes(mod)) { out.push(id + ':n/a'); continue; }
    const res = run(id, { [mod]: mod === 'wind' ? 1 : true }, 120, 3);
    out.push(id + ':' + res.scores.join('-') + (res.nan ? ' NAN' + res.nan : '') + ' p' + res.pickups);
  }
  console.log(mod.padEnd(11), out.join(' | '));
}
