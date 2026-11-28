// v4.2.1: every press jumps. Built situations (lying, leaning a lot, pressing a moment before landing, just after a
// little bounce, just after a jump, frozen, high in the air) and a sweep of every press in real play (a hard bot
// against a player pressing at random, every sport, the three jump delays the settings allow).
//   node test/jumpalways.cjs            (ENGINE=path to try another engine, e.g. the old one: it fails)
const E = require(process.env.ENGINE || '../www/engine.js');
let fails = 0, n = 0;
const check = (name, ok, info) => { n++; if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info ? '  ' + info : '')); };
const low = p => { let m = -1e9; for (let j = 0; j < E.NS; j++) m = Math.max(m, p.sy[j] + p.rad[j]); return m; };

// one player alone on the pitch, standing (or as `set` puts him), the ball out of the way
function alone(map, set, settings) {
  const w = E.createWorld(map || 'soccer', settings ? Object.assign({}, E.DEFAULT_SETTINGS, settings) : null, 3, {});
  for (const q of w.players) q.active = false;
  const p = w.players[1]; p.active = true;
  E.resetRound(w, 0);
  w.events = [];
  const pr = [false, false, false, false];
  const keepBall = () => { w.balls[0].x = -9999; w.balls[0].y = 0; w.balls[0].vx = w.balls[0].vy = 0; };
  for (let i = 0; i < 120; i++) { E.stepPlayers(w, pr); keepBall(); }
  if (set) { set(p); E.shapes(p); p.y += E.GROUND - low(p) - 0.5; E.shapes(p); }
  // step with the button as press(t) says (t from now); the jumps (time from now) and the highest rise of the body
  const run = (secs, press, until) => {
    const y0 = p.y, out = { jumps: [], rise: 0 }, t0 = w.time;
    for (let i = 0; i < Math.round(secs * 120); i++) {
      const t = w.time - t0; pr[1] = !!press(t, p);
      w.events = []; E.stepPlayers(w, pr); keepBall();
      if (w.events.some(e => e.t === 'jump' && e.id === 1)) out.jumps.push(+(w.time - t0).toFixed(3));
      out.rise = Math.max(out.rise, y0 - p.y);
      if (until && until(p)) break;
    }
    return out;
  };
  return { w, p, run };
}

console.log('--- built situations ---');
{
  // lying on the ground: the press comes just before the player gets up by himself (that hop used to cancel the jump)
  let ok = 0, tot = 0, info = [];
  for (const a of [1.2, 1.4, 1.57, -1.2, -1.4, -1.57]) for (const wait of [0.05, 0.2, 0.27, 0.29]) {
    const s = alone('soccer', p => { p.a = a; p.w = 0; p.vx = p.vy = 0; });
    let dT = 0; s.run(2, () => false, p => (dT = p.downT) >= wait);
    if (Math.abs(s.p.a) < 0.75) continue; // (rolled up by himself already)
    tot++;
    const r = s.run(0.3, t => t < 0.1);
    if (r.jumps.length && r.jumps[0] <= 0.075 + 1e-9 && r.rise > 60) ok++; else info.push(a + '/' + wait + ':' + JSON.stringify(r));
  }
  check('lying (on his back or front), pressing at any moment - even right before he would get up by himself: he jumps up', tot >= 18 && ok === tot, ok + '/' + tot + ' ' + info.slice(0, 3).join(' '));
}
{
  // leaning a lot, standing: a real jump (it used to be a dive along the ground)
  const rows = [];
  for (const a of [0.6, 0.75, 0.9, 0.97, -0.6, -0.75, -0.9, -0.97]) {
    const s = alone('soccer', p => { p.a = a * p.f; p.w = 0; p.vx = p.vy = 0; });
    const r = s.run(1.2, t => t < 0.1);
    rows.push([a, r.jumps.length ? r.jumps[0] : -1, Math.round(r.rise)]);
  }
  const up = alone('soccer'); const r0 = up.run(1.2, t => t < 0.1);
  check('leaning a lot (up to 56° forward or back), standing: he jumps, and gets at least 55% as high as standing upright',
    rows.every(x => x[1] > 0 && x[2] >= 0.55 * r0.rise), 'upright ' + Math.round(r0.rise) + 'px; ' + rows.map(x => x[0] + ':' + x[2]).join(' '));
}
{
  // a press a moment before landing (a jump, released, then pressed when his feet are a little above the ground,
  // falling): the jump comes as he lands
  let ok = 0, tot = 0, info = [];
  for (const h of [3, 10, 25, 45, 70]) for (const delay of [0, 0.06, 0.15]) {
    const s = alone('soccer', null, { jumpDelay: delay });
    let pressedAt = -1, tLand = -1;
    const r = s.run(2.5, (t, p) => {
      if (t < 0.05) return true; // the first jump
      const lift = E.GROUND - low(p);
      if (pressedAt < 0 && t > 0.3 && p.vy > 0 && lift <= h && p.cT > 0.2) pressedAt = t;
      if (pressedAt >= 0 && tLand < 0 && p.cT < 0.01) tLand = t;
      return pressedAt >= 0 && t - pressedAt < 0.05;
    });
    if (pressedAt < 0) continue;
    tot++;
    const second = r.jumps.filter(j => j > pressedAt);
    // he lands within the 0.2 s a press is kept: it jumps (once he is down, after the jump delay)
    if (second.length >= 1 && second[0] - pressedAt <= 0.2 + delay + 0.02) ok++; else info.push(h + '/' + delay + ' ' + JSON.stringify({ pressedAt, tLand, jumps: r.jumps }));
  }
  check('pressed a moment before landing (feet 3-70 px above the ground, falling): he jumps as he lands, every jump delay', tot >= 12 && ok === tot, ok + '/' + tot + ' ' + info.slice(0, 2).join(' '));
}
{
  // just off the ground (a little bounce): still jumps
  let ok = 0, tot = 0;
  for (const off of [0.02, 0.06, 0.1]) {
    const s = alone('soccer');
    s.p.y -= 3; E.shapes(s.p); s.p.cT = s.p.gT = off; s.p.vy = -60;
    tot++;
    const r = s.run(0.4, t => t < 0.05);
    if (r.jumps.length && r.rise > 100) ok++;
  }
  check('just off the ground after a little bounce (left it up to 0.1 s ago): he jumps', ok === tot, ok + '/' + tot);
}
{
  // high in the air (more than 0.2 s from landing): no jump in the air, and none when he lands later
  const s = alone('soccer');
  let pressedAt = -1;
  const r = s.run(2.5, (t, p) => {
    if (t < 0.05) return true;
    if (pressedAt < 0 && t > 0.25 && Math.abs(p.vy) < 150) pressedAt = t; // at the top of the jump
    return pressedAt >= 0 && t - pressedAt < 0.08;
  });
  check('pressed high in the air: no jump in the air, nor a late one on landing (no double jumps)', r.jumps.length === 1 && pressedAt > 0, JSON.stringify(r.jumps));
}
{
  // frozen (❄️ / struck by lightning): no jump, not even from a press just before
  const s = alone('soccer');
  const r = s.run(0.5, (t) => { if (t > 0.02 && t < 0.03) s.w.fx.freeze[s.p.team] = 2; return t < 0.02; });
  check('frozen right after pressing: no jump', r.jumps.length === 0, JSON.stringify(r.jumps));
}
{
  // a copy of the world taken while a press is waiting (in the air, a moment before landing) goes on exactly like the
  // original - copied (bots' look-ahead, saves) or sent online (encode / decode) - and without it he would not jump
  const N = require(process.env.NET || '../www/net.js');
  const a = alone('soccer');
  let copy = null;
  a.run(1.5, (t, p) => t < 0.05 || (t > 0.3 && p.vy > 0 && E.GROUND - low(p) < 60),
    p => { if (p.jumpKeep > 0 && p.cT > 0.12 && p.vy > 0) { copy = E.copyWorld(E.emptyWorld(), a.w); return true; } return false; });
  const go = w => { const out = []; for (let i = 0; i < 60; i++) { w.events = []; E.stepPlayers(w, [false, false, false, false]); if (w.events.some(e => e.t === 'jump' && e.id === 1)) out.push(i); } return out.join() + ' y' + w.players[1].y; };
  let res = null;
  if (copy) {
    const sent = E.copyWorld(E.emptyWorld(), copy); sent.players[1].jumpKeep = 0; N.decode(sent, N.encode(copy));
    const forgot = E.copyWorld(E.emptyWorld(), copy); forgot.players[1].jumpKeep = 0;
    res = { a: go(E.copyWorld(E.emptyWorld(), copy)), b: go(E.copyWorld(E.emptyWorld(), copy)), sent: go(sent), forgot: go(forgot) };
  }
  check('a press waiting to jump is kept by a copy of the world and online (the same jump, the same step)', !!res && res.a === res.b && res.a === res.sent && /^\d/.test(res.a) && !/^\d/.test(res.forgot),
    res ? 'copy ' + res.a.split(' ')[0] + ', sent ' + res.sent.split(' ')[0] + ', without it: ' + (res.forgot.split(' ')[0] || 'no jump') : 'no snapshot');
}

console.log('--- every press in real play ---');
// a hard bot against a player pressing at random: every press is followed by a jump unless he could not jump at all
// in the 0.2 s after it (in the air, frozen); and every press on the ground - upright, leaning, lying - jumps
const maps = ['soccer', 'basket', 'football', 'volley', 'moon', 'ice', 'giant', 'bomb'], SECS = +(process.env.SECS || 25);
for (const delay of [0, 0.06, 0.15]) {
  let r = 777 + delay * 1000; const rnd = () => (r = (r * 1664525 + 1013904223) >>> 0) / 4294967296;
  const res = { presses: 0, ground: 0, groundJumped: 0, missed: 0, lean: {} }, eg = [];
  for (const id of maps) for (let seed = 0; seed < 2; seed++) {
    const S = Object.assign({}, E.DEFAULT_SETTINGS, { jumpDelay: delay });
    let w = E.createWorld(id, S, 20 + seed);
    const bot = new E.Bot(0, 'hard', 5 + seed);
    let rp = false, rUntil = 0; const prev = [false, false, false, false], pend = [];
    for (let i = 0; i < 120 * SECS; i++) {
      if (w.time >= rUntil) { rp = !rp; rUntil = w.time + (rp ? 0.04 + rnd() * (rnd() < 0.2 ? 1.5 : 0.25) : 0.04 + rnd() * 0.9); }
      const bp = bot.update(w), pr = [bp, bp, rp, rp];
      w.events = [];
      for (let k = 0; k < 4; k++) { const p = w.players[k];
        if (pr[k] && !prev[k]) {
          const frz = w.fx.freeze[p.team] > 0 || w.hz.stun[k] > 0, ground = p.cT < 0.07 && p.jumpCd <= 0 && p.jumpT <= 0 && !frz;
          const lean = Math.abs(p.a) < 0.3 ? 'upright' : Math.abs(p.a) < 1.0 ? 'leaning' : 'lying';
          pend.push({ k, t: w.time, ground, lean, could: false, frz, map: id }); }
        prev[k] = pr[k]; }
      const s = E.stepPlayers(w, pr);
      for (let j = pend.length - 1; j >= 0; j--) { const q = pend[j], p = w.players[q.k];
        const frz = w.fx.freeze[p.team] > 0 || w.hz.stun[q.k] > 0;
        const done = (ok) => { res.presses++; if (q.ground) { res.ground++; res.lean[q.lean] = res.lean[q.lean] || [0, 0]; res.lean[q.lean][0]++; if (ok) { res.groundJumped++; res.lean[q.lean][1]++; } }
          if (!ok && q.could && !q.frz) { res.missed++; if (eg.length < 3) eg.push(q.map + '@' + q.t.toFixed(2)); } pend.splice(j, 1); };
        if (w.events.some(e => e.t === 'jump' && e.id === q.k)) { done(true); continue; }
        if (frz) q.frz = true;
        if (w.time - q.t <= 0.2 && p.cT < 0.12 && p.jumpCd <= 0 && !frz) q.could = true;
        if (w.time - q.t > 0.2 + delay + 0.02) done(false); }
      if (s >= 0) { w = E.createWorld(id, S, 20 + seed + i); bot.reset(); pend.length = 0; } // (a point: those presses are cut short)
    }
  }
  check('jump delay ' + delay + ' s: every press that could jump within 0.2 s jumped; every press on the ground jumped',
    res.missed === 0 && res.ground === res.groundJumped && res.ground > 300,
    res.presses + ' presses, missed ' + res.missed + (eg.length ? ' (' + eg.join(' ') + ')' : '') + '; on the ground ' + res.groundJumped + '/' + res.ground + ' ' + JSON.stringify(res.lean));
}
console.log(fails ? fails + ' FAILED' : 'all ' + n + ' passed');
process.exit(fails ? 1 : 0);
