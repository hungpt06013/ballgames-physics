// Match stats sweep: possession, territory, shots (on / off target, off the woodwork), near misses, clearances,
// blocks - and saves again, in continuous play. Real matches between bots (2 players, 2 vs 2, 4 players; every sport)
// and built situations (shots of every height / speed with and without a keeper, keepers standing / pressing,
// defenders kicking the ball away from every spot, in every direction, at every pace) are played by the game; an
// independent referee written from the rules in CHI_TIET.md (not from the game's counting code) works every stat out
// again from the log of every physics step - first checking it can replay each round exactly - and the two are
// compared, per player.
//   node test/stats.cjs          - everything (several minutes)
//   node test/stats.cjs quick    - a quarter of it
const { chromium } = require('playwright');
const path = require('path');
const QUICK = process.argv.indexOf('quick') >= 0, ONLY = ['bots', 'built'].filter(x => process.argv.indexOf(x) >= 0)[0];
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  const page = await (await browser.newContext({ viewport: { width: 800, height: 380 } })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PE ' + String(e.stack || e)));
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.waitForTimeout(500);
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('bgp_prefs')); p.hlAsked = true; p.hlMode = 'none'; p.replay = false; p.askDress = false; localStorage.setItem('bgp_prefs', JSON.stringify(p)); });
  await page.reload(); await page.waitForTimeout(500);
  await page.evaluate(() => {
    const E = BGP, W = E.W, DT = E.DT;
    // ---------------- the rules (CHI_TIET.md) ----------------
    const LOOK = 1.6, PACE = 400, GAP = 0.15, ACTIVE = 0.35, JUMP = 1.5, CONFIRM = 0.25, MORE = 1.2, CHAIN = 3, CF_KEEP = 2.6, CF_EVERY = 4;
    const BLOCK_PACE = 150, SHOT_SPEED = 450, SHOT_GAP = 0.5, SHOT_LOOK = 2.5, CLEAR_SPEED = 500, CLEAR_DIST = 400, CLEAR_ZONE = W / 3;
    const MISS_LOOK = 2, MISS_SPEED = 450, MISS_NEAR = { goal: 1.9, hoop: 1.5, posts: 1.5 }, MISS_FROM = 0.1, MISS_CUT = 0.15, MISS_FILE = 1.5;
    const SHOT_TYPES = { goal: 1, hoop: 1, posts: 1 };
    const CF_N = Math.round(CF_KEEP / DT);

    // one match (o.bots) or one built situation; the game's numbers and the log of every physics step of play
    window.__st = function (o) {
      const G = __game, M = !!o.mirror, mb = i => M ? (i + 2) % 4 : i, mt = t => M ? 1 - t : t, mx = x => M ? W - x : x;
      let seed = 0; const js = JSON.stringify(o); for (let i = 0; i < js.length; i++) seed = (seed * 31 + js.charCodeAt(i)) | 0;
      Math.random = function () { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      // (the game makes hard bots lighter on a slow device, timed with the real clock: not here - every run the same)
      performance.now = () => 0;
      const four = o.mode === 'team4' || o.mode === 'ffa';
      const cfg = { mode: o.mode || '2p', fmt: o.fmt || 'p9', maps: o.maps || ['soccer'], mods: false, modList: [], items: false, weather: false };
      if (o.bots) { if (four) { cfg.slots = ['b', 'b', 'b', 'b']; cfg.levels = o.levels || ['hard', 'normal', 'hard', 'easy']; } else { cfg.slots2 = ['b', 'b']; cfg.levels2 = o.levels || ['hard', 'normal']; } }
      else if (four) cfg.slots = ['h', 'h', 'h', 'h'];
      __api.startMatch(cfg);
      G.dbg = [];
      const orig = E.stepPlayers, log = { steps: [], rounds: {}, mode: G.mode };
      let curRound = -1;
      const ballState = b => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, ang: b.ang, spin: b.spin, over: b.over, prevX: b.prevX, prevY: b.prevY, touchGround: b.touchGround,
        lt: b.lastTeam, lp: b.lastPid, lx: b.lastX, la: b.lastAir, t0: b.touchT[0], t1: b.touchT[1] });
      const logStep = function (ww, pr) {
        if (ww !== G.world) return orig.apply(this, arguments);
        const play = G.state === 'play';
        if (play && G.round !== curRound) { curRound = G.round; log.rounds[curRound] = { start: E.copyWorld(E.emptyWorld(), ww), k0: log.steps.length, arena: ww.arena, balls0: ww.balls.map(ballState) }; }
        const sc = orig.apply(this, arguments);
        if (play) log.steps.push({ r: curRound, t: ww.time, pr: pr.slice(), act: ww.players.map(p => !!p.press), balls: ww.balls.slice(0, 2).map(ballState),
          ev: (ww.events || []).filter(e => e.t === 'post').map(e => ({ x: e.x, y: e.y })), sc, sb: ww.scoreBall, inj: null });
        return sc;
      };
      E.stepPlayers = logStep;
      if (!o.bots) { E.stepPlayers = orig; __api.step(1 / 60, 110); }
      try {
        if (o.bots) {
          for (let i = 0; i < o.secs * 60 && G.state !== 'over'; i++) __api.step(1 / 60);
        } else {
          // a built situation: the players where asked, the ball shot (or kicked by a defender), presses, more kicks
          const w = G.world, P = w.players, park = [1500, 1530, 1440, 1570];
          for (let i = 0; i < 4; i++) {
            const p = P[mb(i)], x = o.pl && o.pl[i] !== undefined && o.pl[i] !== null ? o.pl[i] : park[i];
            p.x = mx(x); p.y = E.GROUND - E.COM_H * p.sc; p.vx = p.vy = p.a = p.w = 0; E.shapes(p);
          }
          w.balls.length = 1; w.ball = w.balls[0];
          const kick = (k, now) => {
            const b = w.ball, team = mt(k.team), pid = mb(k.pid);
            b.x = b.prevX = mx(k.x); b.y = b.prevY = k.y; b.vx = M ? -k.vx : k.vx; b.vy = k.vy; b.spin = 0; b.stillT = 0;
            b.lastTeam = team; b.lastBy[team] = pid; b.lastPid = pid; b.touchT[team] = now; b.lastX = b.x; b.lastKind = 'kick'; b.lastAir = false;
          };
          w.ball.touchT[0] = w.ball.touchT[1] = -1;
          const t0 = w.time;
          kick(o.shot, t0);
          if (G.cf) G.cf = new G.cf.constructor();
          // (nothing of the moments before the set-up counts: the watch of the round and the stats start again)
          const S = G.hlw; Object.assign(S, { threat: [null, null], cand: [], group: null, flight: [null, null], miss: [], lastT: [-1, -1], act: [null, null], sf: [null, null], futNow: [-1, -1], futPrev: [-1, -1], blocks: [] });
          Object.keys(G.ts).forEach(k => { if (Array.isArray(G.ts[k])) G.ts[k] = G.ts[k].map(() => 0); });
          G.ps.forEach(p => Object.keys(p).forEach(k => { p[k] = 0; })); G.pressT = [-9, -9, -9, -9];
          E.stepPlayers = logStep;
          // (the round's start is the moment after this set-up)
          curRound = G.round; log.rounds[curRound] = { start: E.copyWorld(E.emptyWorld(), w), k0: 0, arena: w.arena, balls0: w.balls.map(ballState) };
          const slot = four ? mb(0) : mt(0), kicks = (o.kicks || []).slice();
          for (let i = 0; i < (o.secs || 3.5) * 120 && G.state === 'play'; i++) {
            const now = w.time - t0;
            (o.press || []).forEach(q => { if (Math.abs(now - q[0]) < 0.0045) G.hold[slot] = w.time + q[1]; });
            const k = kicks.length && now >= kicks[0].at - 1e-9 ? kicks.shift() : null;
            if (k) { kick(k, w.time); log.injAt = log.injAt || []; log.injAt.push({ k: log.steps.length, st: ballState(w.ball) }); }
            __api.step(1 / 120);
          }
        }
        // the match ends here (a point being celebrated goes on to its end, not into the next round): the stats are settled
        const r0 = G.round;
        for (let i = 0; i < 2000 && G.state !== 'play' && G.state !== 'over' && G.state !== 'vote' && G.round === r0; i++) __api.step(1 / 60);
        // (stopped before anybody reached the points: ended as a draw)
        if (G.state !== 'over') __api.endMatch(true);
      } finally { E.stepPlayers = orig; }
      const T = G.ts, ps = G.ps;
      const game = { poss: T.poss.slice(), terr: T.terr.slice(), on: T.on.slice(), off: T.off.slice(), wood: T.wood.slice(), miss: T.miss.slice(), clear: T.clear.slice(),
        saves: ps.map(p => p.saves), blocks: ps.map(p => p.blocks), shots: ps.map(p => p.shots) };
      const ref = __ref(log, four);
      const dbg = G.dbg.map(d => d.r + '@' + d.t.toFixed(3) + '#' + d.by + (d.round ? 'r' + d.round : '')).join(' ');
      G.dbg = null;
      return { game, ref: ref.stats, repro: ref.repro, rounds: Object.keys(log.rounds).length, steps: log.steps.length, why: ref.why, dbg, refEv: ref.ev };
    };

    // ---------------- the referee ----------------
    window.__ref = function (log, four) {
      const z = () => [0, 0, 0, 0];
      const st = { poss: z(), terr: [0, 0], on: z(), off: z(), wood: z(), miss: z(), clear: z(), saves: four ? z() : [0, 0], blocks: four ? z() : [0, 0] };
      const person = id => four ? id : (id < 2 ? 0 : 1), why = [], ev = [];
      let repro = true;
      const rounds = Object.keys(log.rounds).map(Number).sort((a, b) => a - b);
      rounds.forEach((r, ri) => {
        const R0 = log.rounds[r], steps = log.steps.filter(s => s.r === r), A = R0.arena, Rb = A.P.ballR, type = A.type, n = steps.length;
        if (!n) return;
        const last = ri === rounds.length - 1;
        const goalK = steps.findIndex(s => s.sc >= 0), endK = goalK >= 0 ? goalK : n - 1, goal = goalK >= 0 ? steps[goalK].sc : -1, sb = goalK >= 0 ? steps[goalK].sb : -1;
        const nb = steps[0].balls.length;
        // 0. the referee replays the round from its start with the same presses (and the hand-made kicks): the same?
        const inj = (log.injAt || []);
        const replay = (until, mask) => {
          const sim = E.copyWorld(E.emptyWorld(), R0.start); sim.events = null;
          for (let i = 0; i < 4; i++) if (sim.players[i].active) E.shapes(sim.players[i]);
          const pr = [false, false, false, false];
          for (let k = 0; k < (until === undefined ? n : 1e9); k++) {
            if (until !== undefined && !(sim.time < until)) break;
            const q = inj.find(j => j.k === R0.k0 + k);
            if (q && (!mask || k < mask.snap)) { const bb = sim.balls[0], s = q.st; Object.assign(bb, { x: s.x, y: s.y, vx: s.vx, vy: s.vy, prevX: s.x, prevY: s.y, ang: s.ang, spin: s.spin, stillT: 0, lastTeam: s.lt, lastPid: s.lp, lastX: s.lx, lastAir: s.la, lastKind: 'kick' }); bb.lastBy[s.lt] = s.lp; bb.touchT[s.lt] = sim.time; }
            for (let i = 0; i < 4; i++) pr[i] = k < n && (!mask || sim.time < mask.at - 1e-6) && steps[k].pr[i] && !(mask && mask.off.indexOf(i) >= 0 && k >= mask.k0);
            const sc = E.stepPlayers(sim, pr);
            if (sc >= 0) return { sc, sb: sim.scoreBall, sim };
          }
          return { sc: -1, sim };
        };
        const rp = replay();
        const lastB = steps[n - 1].balls[0];
        const ok = goalK >= 0 ? (rp.sc === goal) : (Math.abs(rp.sim.balls[0].x - lastB.x) < 0.5 && Math.abs(rp.sim.balls[0].y - lastB.y) < 0.5);
        if (!ok) repro = false;
        const tOf = k => k < 0 ? (steps[0].t - DT) : steps[k].t;
        const touchOf = (bs, d) => d === 0 ? bs.t0 : bs.t1;
        const B = (k, bi) => k < 0 ? R0.balls0[bi] : steps[k].balls[bi];
        // the ball (on its own) going in: for which side, on each step
        const fut = [];
        for (let k = 0; k <= endK; k++) fut.push(steps[k].balls.map(bs => { if (type === 'bomb') return -1; const f = E.ballFuture(A, bs, LOOK); return f ? f.team : -1; }));
        // 1. possession and territory
        for (let k = 0; k <= endK; k++) steps[k].balls.forEach(bs => {
          if (bs.lp >= 0 && bs.lp < 4) st.poss[bs.lp] += DT;
          if (bs.x > W / 2) st.terr[0] += DT; else if (bs.x < W / 2) st.terr[1] += DT;
        });
        // the frame of the goal team D attacks, hit by this ball on step k (the bar over the goal mouth, ring / board, post)
        const frame = (k, bs, D) => steps[k].ev.some(e => {
          if ((D === 0 ? e.x < W / 2 : e.x > W / 2) || Math.hypot(e.x - bs.x, e.y - bs.y) > Rb + 14) return false;
          const x = D === 0 ? W - e.x : e.x;
          return type === 'goal' ? Math.abs(x - A.goalD) <= 24 : type === 'hoop' ? x >= A.boardX - 3 && e.y <= A.rimY + 50 : type === 'posts';
        });
        const scoreGap = (bs, D) => E.scoreGap(A, bs, D);
        for (let bi = 0; bi < nb; bi++) {
          // 2. shots and clearances
          if (SHOT_TYPES[type]) {
            let f = null;
            const end = (g) => {
              const D = f.team;
              if (g === 1 - D) return;
              const near = type === 'goal' ? 0.75 * (E.GROUND - A.goalTop) : type === 'hoop' ? A.rimFront - A.boardX : 0.75 * (E.GROUND - A.barY);
              const x0 = D === 0 ? f.x0 : W - f.x0, deep = x0 <= CLEAR_ZONE; // (from his own third: no shot unless it went in)
              const on = g === D || (f.on && !deep), off = !on && !deep && f.sp >= SHOT_SPEED && f.gap <= near;
              if (on) st.on[f.by]++; else if (off) st.off[f.by]++;
              if ((on || off) && f.post && g !== D) st.wood[f.by]++;
              ev.push((on ? 'on' : off ? 'off' : 'fl') + '@' + f.last.toFixed(3) + '#' + f.by + 'r' + r);
              if (g !== D && deep && !f.danger && f.sp >= CLEAR_SPEED && f.far >= CLEAR_DIST) { st.clear[f.by]++; ev.push('clear@' + f.last.toFixed(3) + '#' + f.by + 'r' + r); }
            };
            for (let k = 0; k <= endK; k++) {
              const bs = steps[k].balls[bi], t = steps[k].t, lt = Math.max(bs.t0, bs.t1);
              if (f && lt > f.last + 1e-9) {
                if (bs.lp === f.by && touchOf(bs, 1 - f.team) <= f.last + 1e-9 && lt - f.last < SHOT_GAP) f.last = lt; else { end(-1); f = null; }
              }
              if (!f && bs.lt >= 0 && bs.lp >= 0 && lt >= 0 && t - lt <= 0.03) f = { team: bs.lt, by: bs.lp, last: lt, x0: bs.x, danger: (k > 0 ? fut[k - 1][bi] : -1) === 1 - bs.lt, sp: 0, on: false, gap: Infinity, post: false, far: 0 };
              if (f) {
                const D = f.team, age = t - f.last, sp = Math.hypot(bs.vx, bs.vy);
                if (age <= 0.15) f.sp = Math.max(f.sp, sp);
                if (fut[k][bi] === D) f.on = true;
                if (frame(k, bs, D)) f.post = true;
                if (age >= MISS_FROM && (type === 'hoop' || (D === 1 ? -bs.vx : bs.vx) > 100)) f.gap = Math.min(f.gap, scoreGap(bs, D));
                f.far = Math.max(f.far, D === 0 ? bs.x - f.x0 : f.x0 - bs.x);
                if (age > SHOT_LOOK || (bs.touchGround && sp < 20)) { end(-1); f = null; }
              }
            }
            if (f) end(goalK >= 0 && bi === sb ? goal : -1);
          }
          // 3. near misses
          if (MISS_NEAR[type]) {
            let mf = null;
            const pend = [];
            const close = (touch) => {
              if (mf.sp >= MISS_SPEED && mf.gap <= MISS_NEAR[type] * Rb && !(touch !== undefined && touch - mf.at < MISS_CUT)) pend.push(mf);
              mf = null;
            };
            const fileUpTo = t => { for (let i = pend.length - 1; i >= 0; i--) if (t >= pend[i].at + MISS_FILE) { st.miss[pend[i].by]++; ev.push('miss@' + pend[i].at.toFixed(3) + '#' + pend[i].by + 'r' + r); pend.splice(i, 1); } };
            for (let k = 0; k <= endK; k++) {
              const bs = steps[k].balls[bi], t = steps[k].t, lt = Math.max(bs.t0, bs.t1);
              if (mf && lt > mf.shot) close(lt);
              if (!mf && bs.lt >= 0 && lt >= 0 && t - lt <= 0.03) mf = { team: bs.lt, by: bs.lp, shot: lt, sp: 0, gap: Infinity, at: 0 };
              if (mf) {
                const age = t - mf.shot;
                if (age <= 0.15) mf.sp = Math.max(mf.sp, Math.hypot(bs.vx, bs.vy));
                if (age > MISS_LOOK) close(undefined);
                else {
                  const g = age >= MISS_FROM && (type === 'hoop' || (mf.team === 1 ? -bs.vx : bs.vx) > 100) ? scoreGap(bs, mf.team) : Infinity;
                  if (g < mf.gap) { mf.gap = g; mf.at = t; }
                }
              }
              fileUpTo(t);
            }
            // (a point: the near misses of the side that scored were the start of it; a flight still going went in.
            // The end of the match: the flight in the air is judged, everything waiting is counted)
            if (goalK >= 0) { pend.forEach(m => { if (m.team !== goal && m.by >= 0) { st.miss[m.by]++; ev.push('miss@' + m.at.toFixed(3) + '#' + m.by + 'r' + r); } }); }
            else if (last) { if (mf) close(undefined); pend.forEach(m => { if (m.by >= 0) { st.miss[m.by]++; ev.push('miss@' + m.at.toFixed(3) + '#' + m.by + 'r' + r); } }); }
          }
        }
        // 4. saves and blocks
        if (type === 'bomb') return;
        const actAt = (pid, k) => { for (let j = k; j >= 0; j--) if (steps[j].act[pid]) return steps[j].t; return -1e9; };
        const saves = [], blocks = [];
        for (let bi = 0; bi < nb; bi++) {
          // the step a side's touch time got to t (its touches: the steps its touch time moved on)
          const stepOf = (d, t) => { for (let k = endK; k >= 0; k--) if (touchOf(steps[k].balls[bi], d) === t && touchOf(B(k - 1, bi), d) !== t) return k; return -1; };
          const activeTouch = (pid, k, t) => { const pt = actAt(pid, k), bs = steps[k].balls[bi]; return pt >= t - ACTIVE - 1e-9 || (bs.la && pt >= t - JUMP - 1e-9); };
          let danger = null, maxLT = Math.max(...[R0.balls0[bi]].map(b => b.lt >= 0 ? touchOf(b, b.lt) : -1));
          for (let k = 0; k <= endK; k++) {
            const bs = steps[k].balls[bi], a = fut[k][bi], pa = k > 0 ? fut[k - 1][bi] : -1;
            // a defender doing something while the ball is going in (the threat already there) is remembered; the
            // attackers touching it again make a new shot
            const ltT = bs.lt >= 0 ? touchOf(bs, bs.lt) : -1;
            if (bs.lt >= 0 && ltT > maxLT) {
              maxLT = ltT;
              if (danger && pa === danger.att) {
                if (bs.lt === 1 - danger.att && activeTouch(bs.lp, k, ltT)) danger.act = { pid: bs.lp, x: bs.x, t: ltT };
                if (bs.lt === danger.att) danger.act = null;
              }
            }
            if (danger && pa === danger.att && a !== danger.att) {
              // the danger is over: judged
              const d = danger, att = d.att, def = 1 - att, tdef = touchOf(bs, def), by0 = bs.lt === def ? bs.lp : -1;
              danger = null;
              if (by0 < 0 || tdef < Math.max(tOf(d.from), tOf(k - 1) - 0.1)) { /* not turned away by a defender */ }
              else {
                let shot = touchOf(B(k - 1, bi), att); if (shot < tOf(d.from) - 3) shot = tOf(d.from);
                let verdict = null, by = by0, x = bs.lx, at = tdef;
                const kc = stepOf(def, tdef);
                const block = r2 => { verdict = (def === 0 ? bs.lx <= W / 2 : bs.lx >= W / 2) && d.pace >= BLOCK_PACE ? 'block' : null; why.push(r2); };
                if (tdef - shot < GAP) why.push('scramble');
                else if (d.pace < PACE && type !== 'hoop') block('slow');
                else {
                  let act = kc >= 0 ? activeTouch(by0, kc, tdef) : false;
                  if (!act && d.act && d.act.t > touchOf(bs, att)) { by = d.act.pid; x = d.act.x; at = d.act.t; act = true; }
                  if (!act) block('standing');
                  else if (def === 0 ? x > W / 2 : x < W / 2) block('their half');
                  else {
                    // the what-if (as long ago as the game keeps: CF_KEEP s): from his press, without it
                    const kAt = (() => { let kk = -1; for (let j = 0; j <= k; j++) if (steps[j].t <= at + 1e-6) kk = j; return kk; })();
                    let k1 = kAt; while (k1 >= 0 && !steps[k1].pr[by]) k1--;
                    let k0 = k1; while (k0 - 1 >= 0 && steps[k0 - 1].pr[by]) k0--;
                    const oldest = Math.max(0, k + 1 - CF_N + 1);
                    let wentIn;
                    if (kAt < oldest || k1 < oldest) wentIn = true; // (the last seconds are not all there: taken as a save)
                    else {
                      k0 = Math.max(k0, oldest);
                      // (the copy of the world it starts from: every CF_EVERY steps, as far back as CF_KEEP s)
                      const iLast = k - (k % CF_EVERY), sBest = k0 - (k0 % CF_EVERY);
                      if (sBest < 0 || sBest < iLast - CF_N + CF_EVERY) wentIn = true;
                      else { const off = four ? [by] : [0, 1, 2, 3].filter(i => (i < 2 ? 0 : 1) === def); const q = replay(at + MORE, { k0, at, off, snap: sBest }); wentIn = q.sc === att && q.sb === bi; }
                    }
                    if (!wentIn) block('anyway'); else { verdict = 'save'; why.push('save?'); }
                  }
                }
                if (verdict) {
                  const who = verdict === 'save' ? by : by0;
                  // the wait to be sure: someone else touching it - it stands; going in again first - it stopped
                  // nothing and the same danger goes on; a point first - see below; the match ending first - not sure
                  let back = false, fate = 'ok';
                  for (let j = k + 1; ; j++) {
                    if (j > endK) { fate = 'end'; break; }
                    const p0 = B(j - 1, bi), q0 = steps[j].balls[bi];
                    if ((q0.t0 > p0.t0 || q0.t1 > p0.t1) && (q0.lp !== who || touchOf(q0, att) > touchOf(p0, att))) break; // someone else: it stands
                    if (fut[j][bi] === att) { back = true; break; }
                    if (steps[j].t - tdef >= CONFIRM - 1e-9) break; // sure
                    if (j === goalK) { fate = goal !== att || sb !== bi || touchOf(q0, att) > tdef ? 'ok' : 'none'; break; }
                  }
                  if (back) { danger = d; why.push('back'); }
                  else if (fate === 'ok') (verdict === 'save' ? saves : blocks).push({ t: tdef, by: who, def, bi });
                  else why.push(verdict + '-' + fate);
                }
              }
            }
            if (a >= 0 && (!danger || danger.att !== a)) danger = { att: a, from: k, pace: 0, act: null };
            if (danger && a === danger.att) danger.pace = Math.max(danger.pace, Math.hypot(bs.vx, bs.vy));
          }
        }
        // a point: saves / blocks of the side that conceded, after which the scorers never touched that ball again
        // (within the chain of that side's saves, 3 s for a block), stopped nothing
        if (goalK >= 0) {
          const tg = steps[goalK].t, gb = steps[goalK].balls[sb];
          saves.sort((p, q) => p.t - q.t);
          let gi = saves.length - 1;
          while (gi >= 0 && saves[gi].def !== 1 - goal) gi = -1;
          if (gi >= 0 && tg - saves[gi].t < CHAIN) {
            let g0 = gi; while (g0 > 0 && saves[g0 - 1].def === saves[gi].def && saves[g0].t - saves[g0 - 1].t <= CHAIN) g0--;
            for (let i = gi; i >= g0; i--) if (saves[i].bi === sb && !(touchOf(gb, goal) > saves[i].t + 1e-9)) { why.push('save-x'); saves.splice(i, 1); }
          }
          for (let i = blocks.length - 1; i >= 0; i--) { const s = blocks[i]; if (s.def === 1 - goal && s.bi === sb && tg - s.t < CHAIN && !(touchOf(gb, goal) > s.t + 1e-9)) { why.push('block-x'); blocks.splice(i, 1); } }
        }
        saves.forEach(s => { st.saves[person(s.by)]++; ev.push('save@' + s.t.toFixed(3) + '#' + s.by + 'r' + r); });
        blocks.forEach(s => { st.blocks[person(s.by)]++; ev.push('block@' + s.t.toFixed(3) + '#' + s.by + 'r' + r); });
      });
      return { stats: st, repro, why: why.join(','), ev: ev.join(' ') };
    };
  });
  const run = o => page.evaluate(o => window.__st(o), o);
  if (process.env.STATS_ONE) { const r = await run(JSON.parse(process.env.STATS_ONE)); console.log(JSON.stringify(r, null, 1)); await browser.close(); return; }

  // ---- compare ----
  const KEYS = ['on', 'off', 'wood', 'miss', 'clear', 'saves', 'blocks'];
  const bad = [], stats = {};
  let total = 0, reproBad = 0;
  function compare(label, o, r) {
    const s = stats[label] = stats[label] || { n: 0, same: 0, sums: {} };
    s.n++; total++;
    if (!r.repro) { reproBad++; bad.push({ label, o, kind: 'referee could not replay it' }); return; }
    const diff = [];
    KEYS.forEach(k => { const g = r.game[k], f = r.ref[k]; s.sums[k] = (s.sums[k] || 0) + g.reduce((a, x) => a + x, 0); if (g.join() !== f.join()) diff.push(k + ' game ' + g.join('/') + ' ref ' + f.join('/')); });
    ['poss', 'terr'].forEach(k => { const g = r.game[k], f = r.ref[k]; if (g.some((x, i) => Math.abs(x - f[i]) > 1e-6)) diff.push(k + ' game ' + g.map(x => x.toFixed(3)).join('/') + ' ref ' + f.map(x => x.toFixed(3)).join('/')); });
    const sh = r.game.shots.join() === (o.mode === 'team4' || o.mode === 'ffa' ? r.game.on : [r.game.on[0] + r.game.on[1], r.game.on[2] + r.game.on[3]]).join();
    if (!sh) diff.push('players\' shots ' + r.game.shots.join('/') + ' vs on target ' + r.game.on.join('/'));
    // the moments the two disagree on (saves, blocks, shots, clearances, near misses)
    const evs = (str, re) => str.split(' ').filter(x => re.test(x)).map(x => x.replace(/^(shot-)?/, '').replace(/^(on|off)@/, '$1@'));
    const g = evs(r.dbg, /^(save|block|shot-on|shot-off|clear|miss)@/), f = evs(r.refEv, /^(save|block|on|off|clear|miss)@/);
    const only = (a, b) => a.filter(x => b.indexOf(x) < 0);
    if (diff.length) bad.push({ label, o, diff, gameOnly: only(g, f).slice(0, 12), refOnly: only(f, g).slice(0, 12) });
    else s.same++;
  }
  const t1 = Date.now();
  const say = label => { const s = stats[label]; console.log(label.padEnd(44) + String(s.n).padStart(4) + ' | referee agrees ' + s.same + ' | ' + KEYS.map(k => k + ' ' + (s.sums[k] || 0)).join(', ')); };

  // 1. matches between bots: every mode, every sport
  if (ONLY !== 'built') {
    console.log('--- matches between bots ---');
    const sports = ['soccer', 'moon', 'ice', 'giant', 'basket', 'football', 'volley', 'bomb'];
    const modes = ['2p', 'team4', 'ffa'];
    const secs = QUICK ? 40 : 90;
    for (const mode of modes) for (const m of sports) {
      const label = 'bots, ' + mode + ', ' + m;
      for (const seedN of (process.env.STATS_SEEDS ? JSON.parse(process.env.STATS_SEEDS) : (QUICK ? [1] : [1, 2]))) {
        const o = { bots: true, mode, maps: [m], fmt: 'p9', secs, seedN };
        compare(label, o, await run(o));
      }
      say(label);
    }
    const mixed = { bots: true, mode: '2p', maps: ['soccer', 'basket', 'football', 'giant'], fmt: 'p9', secs: QUICK ? 60 : 150, seedN: 7 };
    compare('bots, 2p, four sports in turn', mixed, await run(mixed)); say('bots, 2p, four sports in turn');
  }

  // 2. built situations
  if (ONLY !== 'bots') {
    console.log('--- built situations ---');
    const geo = await page.evaluate(() => { const out = {}; ['soccer', 'moon', 'giant', 'basket', 'football'].forEach(m => { const A = BGP.createWorld(m, null, 1).arena; out[m] = { type: A.type, goalD: A.goalD, goalTop: A.goalTop, rimY: A.rimY, boardX: A.boardX, rimFront: A.rimFront, barY: A.barY, postX: A.postX, R: A.P.ballR, g: A.P.gBall, GROUND: BGP.GROUND }; }); return out; });
    const sub = QUICK ? 3 : 1;
    // shots at the left goal, every height (on the ground up to well over the bar) and speed, nobody / a keeper there
    const shotsAt = (g) => {
      const out = [];
      if (g.type === 'goal') {
        const top = g.GROUND - g.goalTop;
        for (const dist of [300, 600]) for (const h of [0, 0.3, 0.6, 0.85].map(f => Math.round(f * (top - 2 * g.R))).concat([top - 2 * g.R + 20, top + 40, top + 0.6 * top, top + 1.2 * top])) for (const vx of [380, 700, 1300]) {
          const T = dist / vx, y = g.GROUND - g.R - h; out.push({ x: g.goalD + dist, y, vx: -vx, vy: -0.5 * g.g * T, T });
        }
      } else if (g.type === 'hoop') {
        const xm = (g.boardX + g.rimFront) / 2;
        for (const dist of [300, 700]) for (const T of [0.7, 1.1]) for (const dx of [-60, 0, 50, 120, 220]) { const x0 = xm + dist, y0 = g.GROUND - g.R - 120, x1 = xm + dx, y1 = g.rimY - g.R - 4; out.push({ x: x0, y: y0, vx: (x1 - x0) / T, vy: (y1 - y0 - 0.5 * g.g * T * T) / T, T }); }
      } else {
        for (const dist of [300, 700]) for (const h of [-60, 10, 80, 200]) for (const vx of [600, 1200]) { const T = dist / vx, y = g.barY - g.R - h; out.push({ x: g.postX + dist, y, vx: -vx, vy: -0.5 * g.g * T, T }); }
      }
      return out;
    };
    for (const m of ['soccer', 'moon', 'giant', 'basket', 'football']) for (const mirror of [false, true]) {
      if (mirror && m !== 'soccer' && m !== 'basket') continue;
      const g = geo[m], label = 'shots, ' + m + (mirror ? ', right goal' : '');
      const kxs = g.type === 'goal' ? [null, g.goalD + 30, g.goalD + 120] : g.type === 'hoop' ? [null, 210, 300] : [null, 170, 300];
      let i = 0;
      for (const s of shotsAt(g)) for (const kx of kxs) for (const press of [null, [0.6 * s.T, 0.3], [0.85 * s.T, 0.3]]) {
        if (kx === null && press) continue;
        if (i++ % sub) continue;
        const o = { maps: [m], mirror, shot: { team: 1, pid: 2, x: s.x, y: s.y, vx: s.vx, vy: s.vy }, pl: [kx], press: press ? [press] : [], secs: 3 };
        compare(label, o, await run(o));
      }
      say(label);
    }
    // a defender kicks the ball (red, body 0 or 1), from every distance from his own end, in both directions, at
    // every pace, with the ball just before going into his own goal or not; and rebounds of a shot
    for (const m of ['soccer', 'basket', 'football']) for (const mirror of [false, true]) {
      if (mirror && m !== 'soccer') continue;
      const g = geo[m], label = 'clearances, ' + m + (mirror ? ', right side' : '');
      let i = 0;
      for (const x of [g.type === 'goal' ? g.goalD + 40 : 230, 380, 520, 545, 700]) for (const vx of [300, 480, 520, 900, 1500, -700]) for (const vy of [-900, -300, 0]) for (const danger of [false, true]) {
        if (i++ % sub) continue;
        const y = g.GROUND - g.R - (vy < 0 ? 60 : 0);
        const first = danger ? { team: 1, pid: 2, x: x + 260, y: y - 40, vx: -1300, vy: -150 } : { team: 0, pid: 1, x, y, vx: 0, vy: 0 };
        const o = { maps: [m], mirror, shot: first, pl: [null, null], kicks: [{ at: danger ? 0.12 : 0.05, team: 0, pid: 0, x, y, vx, vy }], secs: 3 };
        compare(label, o, await run(o));
      }
      say(label);
    }
  }

  console.log('\n' + total + ' matches / situations in ' + ((Date.now() - t1) / 1000).toFixed(0) + ' s; the referee replayed every round exactly in ' + (total - reproBad));
  const byKey = {};
  bad.forEach(x => { const k = x.kind || x.label.split(',')[0] + ': ' + x.diff.map(d => d.split(' ')[0]).join('+'); (byKey[k] = byKey[k] || []).push(x); });
  Object.keys(byKey).forEach(k => { console.log('\n' + byKey[k].length + ' x ' + k); byKey[k].slice(0, 2).forEach(x => console.log('   ' + JSON.stringify(x).slice(0, 2500))); });
  console.log(errs.length ? errs.slice(0, 3).join('\n') : 'no page errors');
  console.log(bad.length ? bad.length + ' disagreements' : 'no disagreements');
  await browser.close();
  process.exit(bad.length || errs.length ? 1 : 0);
})();
