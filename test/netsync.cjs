// Online play over a simulated network (latency, jitter, lost and reordered messages, devices running at different
// frame rates): a host and 1-3 guests play several rounds with random presses, bots and lightning.
// Measured many times over:
//  - replays: a guest, playing again from a real state with the official presses, gets exactly (bit for bit) the
//    host's next real state - never different;
//  - what each device shows (its prediction) against the real match at the same step: how often exactly right, how far
//    off otherwise;
//  - presses: how many of a guest's presses count at exactly the step he pressed (not moved because they came late).
// node test/netsync.cjs [quick]
const E = require('../www/engine.js');
const N = require('../www/net.js');
const DT = E.DT;
let fails = 0;
const check = (name, ok, info) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== undefined ? '  ' + info : '')); };
const quick = process.argv[2] === 'quick';

function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

// ---- the network: per direction a latency (ms), jitter (ms, random extra), loss (unreliable messages dropped;
// a reliable one "lost" comes a round trip later). Reliable messages keep their order.
class Net {
  constructor(seed) { this.r = rng(seed); this.q = []; this.links = {}; this.lastRel = {}; this.sent = 0; this.bytes = 0; }
  link(a, b, o) { this.links[a + '>' + b] = o; this.links[b + '>' + a] = o; }
  send(now, from, to, msg, reliable) {
    const L = this.links[from + '>' + to], s = JSON.stringify(msg);
    this.sent++; this.bytes += s.length;
    let t = now + L.lat + this.r() * L.jit;
    if (L.spike && now % L.spike.every < L.spike.dur) t += L.spike.dur - now % L.spike.every; // (the network stands still for a moment)
    if (reliable) {
      if (this.r() < L.loss) t += 2 * L.lat + 40;
      const k = from + '>' + to; t = Math.max(t, this.lastRel[k] || 0); this.lastRel[k] = t;
    } else if (this.r() < L.loss) return;
    this.q.push({ t, to, from, s });
  }
  due(now) { const d = this.q.filter(m => m.t <= now).sort((a, b) => a.t - b.t); this.q = this.q.filter(m => m.t > now); return d; }
}

// a person pressing now and then: short taps, longer holds, quick double taps
function person(seed) {
  const r = rng(seed); let next = 200 + r() * 800, until = 0;
  return t => {
    if (t >= next) { const d = r() < 0.15 ? 40 + r() * 40 : 60 + r() * 550; until = t + d; next = until + (r() < 0.2 ? 60 + r() * 120 : 250 + r() * 1800); }
    return t < until;
  };
}
// a simple bot: presses when the ball is near (and now and then for no reason)
function pseudoBot(slot, seed) {
  const r = rng(seed);
  return w => { const p = w.players[slot], b = w.ball; return Math.abs(b.x - p.x) < 170 && b.y > p.y - 260 ? r() < 0.6 : r() < 0.01; };
}
function positions(w) {
  const o = [];
  for (const p of w.players) o.push(p.x, p.y, p.a);
  for (const b of w.balls) o.push(b.x, b.y);
  return o;
}
function errOf(a, b) {
  let m = 0;
  for (let i = 0; i < 4; i++) m = Math.max(m, Math.hypot(a[i * 3] - b[i * 3], a[i * 3 + 1] - b[i * 3 + 1]));
  for (let i = 12; i + 1 < Math.min(a.length, b.length); i += 2) m = Math.max(m, Math.hypot(a[i] - b[i], a[i + 1] - b[i + 1]));
  return m;
}

const MAPS = E.MAPS.map(m => m.id);
// cfg: { slots: 2|4, guests: [{lat, jit, loss, fps}], bots: [slots], host: {fps}, secs, seed, realBots }
function run(cfg) {
  const R = rng(cfg.seed), net = new Net(cfg.seed * 7 + 1), ns = cfg.slots, settings = Object.assign({}, E.DEFAULT_SETTINGS);
  const devs = [];
  // slots: the host plays slot 0; guests the next ones; bots the rest
  const hostSlot = 0;
  const guestSlots = cfg.guests.map((g, i) => i + 1);
  const botSlots = []; for (let s = 1 + cfg.guests.length; s < ns; s++) botSlots.push(s);
  const truth = new Map(); // `${r}:${n}` -> positions of the real match
  const moved = { total: 0, moved: 0 };
  // host
  const hsend = (id, msg, rel) => net.send(now, 'H', id, msg, rel);
  const HS = new N.HostSession(ns, hostSlot, hsend);
  // count presses of guests moved to a later step
  const add0 = HS.h.add.bind(HS.h);
  HS.h.add = function (slot, q, n, v) { const m = add0(slot, q, n, v); if (this.remote[slot]) { moved.total++; if (m !== n) moved.moved++; } return m; };
  guestSlots.forEach((s, i) => { net.link('H', 'G' + i, cfg.guests[i]); HS.addPeer('G' + i, s); });
  const bots = {};
  botSlots.forEach(s => { bots[s] = cfg.realBots ? new E.Bot(s < 2 ? 0 : 1, 'easy', cfg.seed + s, ns === 2 ? -1 : s) : pseudoBot(ns === 2 ? s * 2 : s, cfg.seed + s); });
  let world = null, round = 0, nextRoundAt = 0, goAt = -1, hostPred = [], edits = 0;
  function newRound() {
    round++;
    const map = MAPS[(round + cfg.seed) % MAPS.length], mods = R() < 0.5 ? {} : { [E.modsFor(map)[Math.floor(R() * E.modsFor(map).length)]]: true };
    world = E.createWorld(map, settings, (R() * 4294967295) >>> 0, mods); world.events = null;
    HS.round(round, world, { map, mods, settings, rate: 1 });
    goAt = now + 300 + R() * 400; // (the intro)
    Object.values(bots).forEach(b => b.reset && b.reset());
  }
  const hostPerson = person(cfg.seed * 13 + 5);
  function hostStep(n) {
    for (const s of botSlots) {
      const b = bots[s], v = cfg.realBots ? b.update(world) : b(world);
      HS.botPress(s, v, n);
    }
    const pr = HS.inputs(n);
    const sc = E.stepPlayers(world, pr);
    truth.set(round + ':' + n, positions(world));
    if (R() < 0.0015) { E.strike(world, 100 + R() * (E.W - 200)); HS.edited(); edits++; } // lightning (outside the physics)
    if (sc >= 0 || n > 120 * 25) { nextRoundAt = now + 400; return true; }
    return false;
  }
  const hostView = E.emptyWorld();
  // guests
  const guests = cfg.guests.map((g, i) => {
    const id = 'G' + i;
    const GS = new N.GuestSession(ns, guestSlots[i], (msg, rel) => net.send(now, id, 'H', msg, rel),
      info => { const w = E.createWorld(info.map, info.settings, 1, info.mods); w.events = null; return w; });
    return { id, GS, person: person(cfg.seed * 31 + i * 7 + 3), fps: g.fps || 60, next: R() * 16, last: 0, view: E.emptyWorld(), preds: [], horizon: [] };
  });
  let now = 0, hostNext = 0, hostLast = 0;
  const hostFps = cfg.host && cfg.host.fps || 60;
  newRound();
  const endT = cfg.secs * 1000;
  while (now < endT) {
    now += 1;
    for (const m of net.due(now)) {
      const msg = JSON.parse(m.s);
      if (m.to === 'H') HS.onMessage(m.from, msg); else guests[+m.to.slice(1)].GS.onMessage(msg, now);
    }
    if (goAt >= 0 && now >= goAt) { HS.go(1); goAt = -1; }
    if (!HS.playing && goAt < 0 && nextRoundAt && now >= nextRoundAt) { nextRoundAt = 0; newRound(); }
    if (now >= hostNext) {
      const dt = (now - hostLast) / 1000; hostLast = now; hostNext = now + 1000 / hostFps * (0.85 + 0.3 * R());
      HS.frame(Math.min(dt, 0.05), hostPerson(now), hostStep);
      if (HS.playing) { HS.view(dt, hostView); hostPred.push([round, HS.pred.n, positions(HS.pred.w)]); }
    }
    for (const g of guests) {
      if (now < g.next) continue;
      const dt = (now - g.last) / 1000; g.last = now; g.next = now + 1000 / g.fps * (0.85 + 0.3 * R());
      g.GS.frame(Math.min(dt, 0.05), now, g.person(now));
      if (g.GS.playing && g.GS.base && g.GS.r === round) {
        g.GS.view(dt, g.view);
        g.preds.push([g.GS.r, g.GS.pred.n, positions(g.GS.pred.w)]);
        g.horizon.push(g.GS.pred.n - g.GS.g.baseN);
      }
    }
  }
  // compare the predictions with the real match
  function stats(list) {
    const errs = [];
    for (const [r, n, pos] of list) { const t = truth.get(r + ':' + n); if (t) errs.push(errOf(pos, t)); }
    errs.sort((a, b) => a - b);
    const q = f => errs.length ? errs[Math.floor(f * (errs.length - 1))] : 0;
    return { n: errs.length, exact: errs.filter(e => e === 0).length / Math.max(1, errs.length), p90: q(0.9), p99: q(0.99), max: q(1) };
  }
  return {
    rounds: round, edits, moved,
    checks: guests.map(g => g.GS.check),
    host: stats(hostPred),
    guests: guests.map(g => Object.assign(stats(g.preds), { fixes: g.GS.pred.stats.fixes, maxFix: g.GS.pred.stats.maxFix,
      horizon: g.horizon.length ? g.horizon.reduce((a, b) => a + b, 0) / g.horizon.length : 0, rtt: g.GS.clock.rtt })),
    kbps: net.bytes / cfg.secs / 1024
  };
}

const fmt = s => (100 * s.exact).toFixed(1) + '% exact, off p90 ' + s.p90.toFixed(1) + ' p99 ' + s.p99.toFixed(1) + ' max ' + s.max.toFixed(0) + ' px';
const scenarios = [];
const seeds = quick ? [1] : [1, 2, 3];
for (const seed of seeds) {
  for (const lat of [15, 50, 100, 160]) for (const [jit, loss] of [[5, 0], [30, 0.1]])
    scenarios.push({ name: '2 players, ' + lat + ' ms' + (jit > 5 ? ' ±' + jit + ' ms, 10% lost' : ''), slots: 2, guests: [{ lat, jit, loss, fps: 60 }], secs: quick ? 20 : 45, seed: seed * 100 + lat });
  scenarios.push({ name: '4 players (3 guests: 20 / 60 / 120 ms, one at 30 fps)', slots: 4,
    guests: [{ lat: 20, jit: 10, loss: 0.03 }, { lat: 60, jit: 20, loss: 0.05, fps: 30 }, { lat: 120, jit: 30, loss: 0.08 }], secs: quick ? 20 : 45, seed: seed * 100 + 7 });
  scenarios.push({ name: '2 players, 60 ms, the network stops for 0.5 s every 6 s', slots: 2, guests: [{ lat: 60, jit: 15, loss: 0.05, spike: { every: 6000, dur: 500 } }], secs: quick ? 20 : 40, seed: seed * 100 + 11, spikes: true });
  scenarios.push({ name: '2 players, 200 ms ±80 ms, 25% lost', slots: 2, guests: [{ lat: 200, jit: 80, loss: 0.25 }], secs: quick ? 20 : 40, seed: seed * 100 + 13, spikes: true });
  scenarios.push({ name: '2 vs 2 (1 guest 70 ms + 2 real bots)', slots: 4, guests: [{ lat: 70, jit: 20, loss: 0.05 }], secs: quick ? 15 : 30, seed: seed * 100 + 9, realBots: true });
}
let allChecks = 0, badChecks = 0, totMoved = 0, totPress = 0, spikeMoved = 0, spikePress = 0;
const worst = { guestExactMin: 1 };
for (const sc of scenarios) {
  const t0 = Date.now(), r = run(sc);
  const ch = r.checks.reduce((a, c) => ({ done: a.done + c.done, bad: a.bad + c.bad, skipped: a.skipped + c.skipped }), { done: 0, bad: 0, skipped: 0 });
  allChecks += ch.done; badChecks += ch.bad;
  if (sc.spikes) { spikeMoved += r.moved.moved; spikePress += r.moved.total; } else { totMoved += r.moved.moved; totPress += r.moved.total; }
  console.log('— ' + sc.name + ' (seed ' + sc.seed + ', ' + r.rounds + ' rounds, ' + r.edits + ' lightning, ' + r.kbps.toFixed(0) + ' KB/s, ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
  console.log('    replays checked ' + ch.done + ', different ' + ch.bad + ' (skipped after lightning / gaps: ' + ch.skipped + ')');
  console.log('    host shows:    ' + fmt(r.host));
  r.guests.forEach((g, i) => console.log('    guest ' + (i + 1) + ' shows: ' + fmt(g) + ' · looks ahead ' + (g.horizon * DT * 1000).toFixed(0) + ' ms, ping ' + g.rtt.toFixed(0) + ' ms'));
  console.log('    guest presses counted at their own step: ' + (r.moved.total - r.moved.moved) + '/' + r.moved.total);
}
console.log('');
check('replaying from a real state with the official presses gives exactly the host\'s state, every time', allChecks > 1000 && badChecks === 0, allChecks + ' replays, ' + badChecks + ' different');
check('nearly every guest press counts at the step it was made (latency under ' + (N.MAX_WAIT * DT * 1000).toFixed(0) + ' ms)', totPress > 0 && totMoved / totPress < 0.02, totMoved + ' of ' + totPress + ' moved');
console.log('     (on networks that stop or lose a lot: ' + spikeMoved + ' of ' + spikePress + ' presses came too late and counted a moment later)');
console.log(fails ? fails + ' FAILED' : 'all checks passed');
process.exit(fails ? 1 : 0);
