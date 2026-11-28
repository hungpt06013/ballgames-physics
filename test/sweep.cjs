// Save sweep: thousands of shots at a goal - every height (on the ground up to over the bar), speed, distance, flat /
// rising / dipping / lobbed - against a keeper standing at every spot in front of the goal, pressing at every moment
// (or not at all), on both sides of the pitch, on every goal pitch and in every mode; and what happens after the save
// (the rebound knocked in by the attackers at any delay, the ball going in off his own team-mate, a second shot saved
// again). Each one is played by the real game and judged again, step by step, by an independent referee written from
// the rules in CHI_TIET.md, with the exact what-if (the same moment played on with full physics, nobody on the
// defending side pressing from the press that made the touch). The referee first checks it reproduces the real game
// exactly from the same start with the same presses. Every disagreement is listed.
//   node test/sweep.cjs          - everything (a few minutes)
//   node test/sweep.cjs quick    - every 4th situation
const { chromium } = require('playwright');
const path = require('path');
const QUICK = process.argv.indexOf('quick') >= 0, ONLY = ['after', 'shots'].filter(x => process.argv.indexOf(x) >= 0)[0];
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
    // the rules (CHI_TIET.md): look-ahead, real shot pace, gap after the shot, press before the touch, own jump,
    // the wait to be sure, how long the what-if plays on, and how long after a save conceding takes it back
    const LOOK = 1.6, PACE = 400, GAP = 0.15, ACTIVE = 0.35, JUMP = 1.5, CONFIRM = 0.25, MORE = 1.2, CHAIN = 3;
    // one situation, from red's point of view (red keeper = body 0, defends the left goal; blue shot it; o.mirror: the
    // same on the right side with the blue keeper). o = { map, mode, mirror, kx: keeper x, mate: x of his team-mate,
    // shot: { x, y, vx, vy }, press: [at, dur] (s after the shot) or null,
    // after: { at, kind: 'attIn' | 'mateIn', x, y, vx, vy, press2 } (at s after the ball was turned away) }
    window.__sw = function (o) {
      const E = BGP, G = __game, M = !!o.mirror, WW = E.W, four = o.mode === 'team4' || o.mode === 'ffa';
      const mb = i => M ? (i + 2) % 4 : i, mt = t => M ? 1 - t : t, mx = x => M ? WW - x : x;
      // the same situation always starts the same way (the game's random bits - sway phases... - from a seed)
      let seed = 0; const js = JSON.stringify(Object.assign({}, o, { debug: undefined })); for (let i = 0; i < js.length; i++) seed = (seed * 31 + js.charCodeAt(i)) | 0;
      Math.random = function () { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      __api.startMatch({ mode: o.mode || '2p', slots: four ? ['h', 'h', 'h', 'h'] : undefined, level: 'hard',
        fmt: 'p9', maps: [o.map || 'soccer'], mods: false, modList: [], items: false, weather: false });
      __api.step(1 / 60, 110);
      G.dbg = [];
      const w = G.world, A = w.arena, P = w.players, DEF = mt(0), ATT = 1 - DEF, KP = mb(0);
      const park = [1500, 1530, 1440, 1570];
      for (let i = 0; i < 4; i++) {
        const p = P[mb(i)];
        let x = park[i];
        if (i === 0) x = o.kx; else if (i === 1 && o.mate !== undefined) x = o.mate;
        p.x = mx(x); p.y = E.GROUND - E.COM_H * p.sc; p.vx = p.vy = p.a = p.w = 0; E.shapes(p);
      }
      w.balls.length = 1; w.ball = w.balls[0];
      const b = w.ball, s = o.shot;
      b.x = b.prevX = mx(s.x); b.y = b.prevY = s.y; b.vx = M ? -s.vx : s.vx; b.vy = s.vy; b.spin = 0; b.ang = 0; b.stillT = 0;
      b.touchT[0] = b.touchT[1] = -1;
      const t0 = w.time, shooter = mb(2);
      b.lastTeam = ATT; b.lastBy[ATT] = shooter; b.lastPid = shooter; b.touchT[ATT] = t0; b.lastX = b.x; b.lastKind = 'kick'; b.lastAir = false;
      if (G.cf) G.cf = new G.cf.constructor();
      // every physics step of the game: its presses, and the ball after it
      const start = E.copyWorld(E.emptyWorld(), w), rec = [], orig = E.stepPlayers, inj = [];
      E.stepPlayers = function (ww, pr, it) {
        if (ww !== G.world) return orig.apply(this, arguments);
        const pend = o.debug && G.hlw ? G.hlw.cand.map(c => (c.t - t0).toFixed(3)).join(',') + '|' + (G.hlw.threat[0] ? 'T' : '') : ''; // (the game's waiting saves, after the step before)
        const sc = orig.apply(this, arguments), f = E.ballFuture(A, b, LOOK);
        rec.push({ t: ww.time, pr: pr.slice(), tD: b.touchT[DEF], tA: b.touchT[ATT], pid: b.lastPid, team: b.lastTeam, x: mx(b.lastX), air: b.lastAir,
          fut: !!f && f.team === ATT, ft: f ? f.team : -1, sp: Math.hypot(b.vx, b.vy), sc, pend });
        return sc;
      };
      const slot = four ? KP : DEF; // (the keeper's button)
      const secs = o.secs || 3.2, f = o.after;
      let injected = false, turned = -1, rbT = -1;
      try {
        for (let i = 0; i < secs * 120 && G.state === 'play'; i++) {
          const now = w.time - t0;
          if (o.press && Math.abs(now - o.press[0]) < 0.0045) G.hold[slot] = w.time + o.press[1];
          // the moment a defender's touch has turned the ball away (no longer going in), the clock for o.after starts
          const last = rec[rec.length - 1];
          if (f && turned < 0 && last && last.tD > t0 && !last.fut) turned = w.time;
          if (f && !injected && turned >= 0 && w.time - turned >= f.at) {
            injected = true; rbT = w.time;
            const team = f.kind === 'mateIn' ? DEF : ATT, pid = f.kind === 'mateIn' ? mb(1) : mb(3);
            const st = { x: mx(f.x), y: f.y, vx: M ? -f.vx : f.vx, vy: f.vy, team, pid };
            inj.push({ k: rec.length, st });
            b.x = b.prevX = st.x; b.y = b.prevY = st.y; b.vx = st.vx; b.vy = st.vy;
            b.lastTeam = team; b.lastBy[team] = pid; b.lastPid = pid; b.touchT[team] = w.time; b.lastKind = 'head'; b.lastX = b.x; b.lastAir = false;
          }
          if (rbT >= 0 && f.press2 && Math.abs(w.time - rbT - f.press2[0]) < 0.0045) G.hold[slot] = w.time + f.press2[1];
          __api.step(1 / 120);
        }
      } finally { E.stepPlayers = orig; }
      const goalK = rec.findIndex(r => r.sc >= 0);
      const res = { saves: G.ps.map(p => p.saves)[four ? KP : DEF], score: G.score.join('-'),
        dbg: G.dbg.map(d => d.r + '@' + (d.t - t0).toFixed(2)).join(' '), injected };
      // in the highlight? (a save waiting in the open group, or filed as a clip, or inside the goal's clip)
      let hl = 0;
      if (G.hlw && G.hlw.group) hl += G.hlw.group.saves.length;
      if (G.state === 'scored') { for (let i = 0; i < 400 && G.state === 'scored' && !G.clipDone; i++) __api.step(1 / 60); }
      if (G.hlm) [G.hlm.clips, G.hlm.singles].forEach(l => l.forEach(c => c.marks.forEach(m => { if (m.kind === 'save') hl++; })));
      res.hl = hl;

      // ---------------- the referee ----------------
      // plays the start on with full physics: the logged presses (with `off` bodies not pressing from step k0 on,
      // and nobody pressing after step kEnd), the hand-made moves of the ball at their steps; until `until` (world
      // time) or a point: returns the team that scored (or -1), and checks the ball
      function replay(off, k0, kEnd, until) {
        const sim = E.copyWorld(E.emptyWorld(), start);
        sim.events = null;
        for (let i = 0; i < 4; i++) if (sim.players[i].active) E.shapes(sim.players[i]);
        const pr = [false, false, false, false];
        for (let k = 0; until === undefined ? k < rec.length : sim.time < until - 1e-9; k++) {
          const q = inj.find(j => j.k === k), bb = sim.balls[0];
          if (q && k < k0 && k <= kEnd) { bb.x = bb.prevX = q.st.x; bb.y = bb.prevY = q.st.y; bb.vx = q.st.vx; bb.vy = q.st.vy; bb.lastTeam = q.st.team; bb.lastBy[q.st.team] = q.st.pid; bb.lastPid = q.st.pid; bb.touchT[q.st.team] = sim.time; bb.lastKind = 'head'; bb.lastX = bb.x; bb.lastAir = false; }
          for (let i = 0; i < 4; i++) pr[i] = k < rec.length && k <= kEnd && rec[k].pr[i] && !(off.indexOf(i) >= 0 && k >= k0);
          const sc = orig(sim, pr);
          if (sc >= 0) return { sc, sim };
        }
        return { sc: -1, sim };
      }
      // 1. the referee reproduces the game: same start, same presses
      const rp = replay([], 1e9, 1e9);
      res.repro = goalK >= 0 ? (rp.sc === rec[goalK].sc) : (Math.abs(rp.sim.balls[0].x - b.x) < 0.5 && Math.abs(rp.sim.balls[0].y - b.y) < 0.5);
      // 2. the shots: the first one, and every later touch by the attackers
      const pressT = (pid, k) => { for (let j = k; j >= 0; j--) if (rec[j].pr[pid]) return rec[j].t; return -1e9; };
      const pressStart = (pid, k) => { let j = k; while (j >= 0 && !rec[j].pr[pid]) j--; if (j < 0) return -1; while (j - 1 >= 0 && rec[j - 1].pr[pid]) j--; return j; };
      const n = goalK >= 0 ? goalK + 1 : rec.length;
      const shotK = [-1];
      for (let k = 0; k < n; k++) if (k > 0 ? rec[k].tA > rec[k - 1].tA : rec[k].tA > t0) shotK.push(k);
      // the defenders' contacts (one contact = touching steps in a row), each with what it looked like at its end
      const contacts = [];
      for (let k = 0; k < n; k++) {
        if (!(k > 0 ? rec[k].tD > rec[k - 1].tD : rec[k].tD > t0)) continue;
        const c = contacts[contacts.length - 1], pid = rec[k].team === DEF ? rec[k].pid : -1;
        if (c && k - c.last <= 2 && c.pid === pid) c.last = k; else contacts.push({ first: k, last: k, pid });
      }
      contacts.forEach(c => { const r = rec[c.last]; c.t = r.t; c.x = r.x; c.air = r.air; c.pressT = c.pid >= 0 ? pressT(c.pid, c.last) : -1e9;
        c.active = c.pid >= 0 && (c.pressT >= c.t - ACTIVE - 1e-9 || (c.air && c.pressT >= c.t - JUMP - 1e-9)); });
      const saves = [], why = [];
      for (let si = 0; si < shotK.length; si++) {
        const ks = shotK[si], ke = si + 1 < shotK.length ? shotK[si + 1] : n, tShot = ks < 0 ? t0 : rec[ks].tA; // (the moment of the attackers' touch)
        // a danger of this shot: the ball (on its own) going in. It ends at the first step it no longer is; ended by a
        // defender if one touched it then (or at most 0.1 s before); if it is going in again within the wait to be
        // sure, nobody else having touched it, that touch saved nothing and the same danger goes on
        let danger = null, prevFut = false;
        for (let k = Math.max(0, ks); k < ke; k++) {
          const ce = contacts.find(c => c.last === k);
          if (danger && ce && ce.active && ce.last > danger.from) danger.acts.push(ce); // (a touch that started the danger is no effort against it)
          if (rec[k].fut) { if (!danger) danger = { from: k, pace: 0, acts: [] }; danger.pace = Math.max(danger.pace, rec[k].sp); prevFut = true; continue; }
          if (!prevFut) continue;
          prevFut = false;
          let c = null;
          for (const q of contacts) if (q.first <= k && q.last >= danger.from - 1 && (q.last >= k || rec[k].t - q.t <= 0.1 + 1e-9)) c = q;
          if (!c || c.pid < 0) { danger = null; continue; } // not turned away by a defender
          // the touch as it was when the danger ended (a contact still going on then counts from that moment)
          const at = (q, kk) => { const r = rec[kk], pt = q.pid >= 0 ? pressT(q.pid, kk) : -1e9;
            return { pid: q.pid, k: kk, t: r.t, x: r.x, air: r.air, active: q.pid >= 0 && (pt >= r.t - ACTIVE - 1e-9 || (r.air && pt >= r.t - JUMP - 1e-9)) }; };
          const ct = at(c, Math.min(c.last, k));
          const la = danger.acts[danger.acts.length - 1];
          const cr = ct.active ? ct : (la ? at(la, la.last) : null);
          const d = danger; danger = null;
          // not a save: that danger is over (the ball going in again later is a new one)
          if (!cr) { why.push('did nothing'); continue; }
          if (d.pace < PACE && A.type !== 'hoop') { why.push('slow'); continue; }
          if (ct.t - tShot < GAP) { why.push('scramble'); continue; }
          if (cr.x > WW / 2) { why.push('their half'); continue; }
          // the what-if: from the press that made the credited touch, the defending side (one button per side) or
          // that player (his own button) not pressing, everybody else as before until the touch, nothing after
          const k0 = pressStart(cr.pid, cr.k);
          const off = four ? [cr.pid] : [0, 1, 2, 3].filter(i => P[i].team === DEF);
          const wi = k0 < 0 ? { sc: ATT } : replay(off, k0, cr.k, cr.t + MORE);
          if (wi.sc !== ATT) { why.push('anyway'); continue; }
          // a save - if the ball is not going in again within the wait to be sure (nobody else touching it): then it
          // saved nothing, and the same danger goes on
          let back = false;
          for (let j = k + 1; j < ke && rec[j].t - ct.t < CONFIRM - 1e-9; j++) {
            if (contacts.some(o => o.first === j && o.pid !== c.pid)) break;
            if (rec[j].fut) { back = true; break; }
          }
          if (back) { danger = d; continue; }
          // (the recording ends before the wait is over, nothing scored: not sure yet - the game has not counted it either)
          if (goalK < 0 && ke === n && rec[n - 1].t - ct.t < CONFIRM - 1e-9) { why.push('not sure yet'); continue; }
          saves.push({ t: ct.t, by: cr.pid });
          why.push('save');
        }
      }
      // conceded afterwards: a save after which the attackers never touched the ball again saved nothing (within the
      // chain of the side's saves)
      if (goalK >= 0 && rec[goalK].sc === ATT && saves.length && rec[goalK].t - saves[saves.length - 1].t < CHAIN) {
        const lastA = rec[goalK].tA;
        let gi = saves.length - 1;
        while (gi > 0 && saves[gi].t - saves[gi - 1].t <= CHAIN) gi--;
        for (let i = saves.length - 1; i >= gi; i--) if (!(lastA > saves[i].t + 1e-9)) { saves.splice(i, 1); why.push('went in after'); }
      }
      res.ref = saves.length; res.why = why.join(',');
      res.touches = contacts.map(c => [+(rec[c.first].t - t0).toFixed(3), +(c.t - t0).toFixed(3), c.pid, Math.round(c.x), c.air ? 'air' : 'gnd', +(c.pressT - t0).toFixed(2)].join(' '));
      res.goal = goalK >= 0 ? +(rec[goalK].t - t0).toFixed(3) : null;
      if (o.debug) res.rec = rec.slice(0, n).map((r, k) => [k, +(r.t - t0).toFixed(3), r.fut ? 'IN' : '--', r.tD > t0 ? +(r.tD - t0).toFixed(3) : '', r.tA > t0 ? +(r.tA - t0).toFixed(3) : '', r.pid, Math.round(r.sp), r.pr.map(x => x ? 1 : 0).join(''), 'fut:' + r.ft, 'pend:' + r.pend].join(' '));
      return res;
    };
  });
  const run = o => page.evaluate(o => window.__sw(o), o);
  if (process.env.SWEEP_ONE) { const o = JSON.parse(process.env.SWEEP_ONE); const r = await run(o); console.log(JSON.stringify(Object.assign({}, r, { rec: undefined }))); (r.rec || []).forEach(l => console.log(l)); await browser.close(); return; }

  // ---- the situations ----
  const G0 = await page.evaluate(() => { const out = {}; ['soccer', 'moon', 'ice', 'giant', 'basket', 'football', 'volley'].forEach(m => { const A = BGP.createWorld(m, null, 1).arena;
    out[m] = { type: A.type, goalD: A.goalD, goalTop: A.goalTop, rimY: A.rimY, boardX: A.boardX, rimFront: A.rimFront, barY: A.barY, postX: A.postX, netTop: A.netTop,
      R: A.P.ballR, g: A.P.gBall, GROUND: BGP.GROUND }; }); return out; });
  // a shot from `dist` px in front of the goal line arriving there `h` px up (bottom of the ball), at `vx`:
  // flat (starts at that height), rising (starts on the ground: low ones roll, slow ones are lobs), dipping (starts
  // 150 px higher)
  function shot(g, dist, h, vx, kind) {
    const x = g.goalD + dist, T = dist / vx, yArr = g.GROUND - g.R - h;
    const y0 = kind === 'flat' ? yArr : (kind === 'rise' ? g.GROUND - g.R : Math.max(g.GROUND - g.R - h - 150, -600));
    const vy = (yArr - y0 - 0.5 * g.g * T * T) / T;
    return { x, y: y0, vx: -vx, vy };
  }
  // from (x0, y0) to (x1, y1) in T seconds (no drag)
  const arc = (g, x0, y0, x1, y1, T) => ({ x: x0, y: y0, vx: (x1 - x0) / T, vy: (y1 - y0 - 0.5 * g.g * T * T) / T });
  function shots(g, sub) {
    const out = [];
    if (g.type === 'goal') {
      const top = g.GROUND - g.goalTop; // (the bar's height)
      const hs = [0, 0.12, 0.3, 0.48, 0.66, 0.8].map(f => Math.round(f * (top - 2 * g.R))).concat([top - 2 * g.R + 30, top + 40]);
      for (const dist of [250, 450, 700]) for (const h of hs) for (const vx of [600, 900, 1300, 1800]) for (const kind of ['flat', 'rise', 'dip'])
        out.push({ dist, h, vx, kind, T: dist / vx, shot: shot(g, dist, h, vx, kind) });
    } else if (g.type === 'hoop') {
      // arcs dropping onto the ring (its middle, its front, its back) from 250 - 900 px out, jump-shot height or
      // from the floor; and soft balls dropping from just over the ring
      const xm = (g.boardX + g.rimFront) / 2;
      for (const dist of [250, 500, 900]) for (const T of [0.7, 1, 1.4]) for (const dx of [-35, 0, 40]) for (const y0 of [g.GROUND - g.R - 120, g.GROUND - g.R])
        out.push({ dist, h: dx, vx: T, kind: y0 < g.GROUND - g.R ? 'jump' : 'floor', T, shot: arc(g, xm + dist, y0, xm + dx, g.rimY - g.R - 4, T) });
      for (const dx of [-30, 0, 30, 70]) for (const up of [60, 140, 260]) out.push({ dist: 0, h: dx, vx: up, kind: 'drop', T: 0.4, shot: { x: xm + dx, y: g.rimY - up, vx: -30, vy: 0 } });
    } else if (g.type === 'posts') {
      // kicks crossing the post line 10 - 300 px over the bar (and 30 under it: no point) from 250 - 800 px out
      for (const dist of [250, 500, 800]) for (const h of [-30, 10, 60, 150, 300]) for (const vx of [700, 1100, 1600]) for (const kind of ['flat', 'rise']) {
        const x0 = g.postX + dist, T = dist / vx, y1 = g.barY - g.R - h, y0 = kind === 'flat' ? y1 : g.GROUND - g.R;
        out.push({ dist, h, vx, kind, T, shot: arc(g, x0, y0, g.postX - 30, y1, T * (dist + 30) / dist) });
      }
    } else if (g.type === 'volley') {
      // balls coming over the net into the left half, landing 120 - 700 px from the side line
      for (const x1 of [150, 350, 550, 700]) for (const T of [0.8, 1.2, 1.8]) for (const x0 of [950, 1250]) for (const y0 of [g.netTop - 150, g.netTop - 350])
        out.push({ dist: x0 - x1, h: x1, vx: T, kind: 'over', T, shot: arc(g, x0, y0, x1, g.GROUND - g.R, T) });
    }
    return sub ? out.filter((_, i) => i % sub === 0) : out;
  }
  // where the defender stands (x from his own end): in front of the goal / under and around the ring / in front of
  // the posts / around his half
  const spots = g => g.type === 'goal' ? [15, 50, 90, 140, 200].map(d => g.goalD + d) : g.type === 'hoop' ? [175, 210, 250, 300, 380] :
    g.type === 'posts' ? [150, 200, 270, 360, 480] : [180, 330, 480, 630];
  const stats = {}, bad = [];
  let total = 0, reproBad = 0;
  async function sweep(label, base, opts) {
    const g = G0[base.map || 'soccer'], list = shots(g, (opts && opts.sub || 1) * (QUICK ? 4 : 1));
    const kxs = spots(g);
    const st = stats[label] = { n: 0, saves: 0, same: 0, missed: 0, extra: 0, hlMissing: 0 };
    for (const s of list) {
      const T = s.T;
      const presses = [null].concat([0, 0.2, 0.4, 0.55, 0.7, 0.85].map(f => [Math.max(0, +(f * T).toFixed(3)), 0.3]));
      for (const kx of kxs) for (const press of presses) {
        const o = Object.assign({}, base, { kx, shot: s.shot, press }, opts && opts.extra ? opts.extra(s, g) : {});
        const r = await run(o);
        total++; st.n++;
        if (!r.repro) { reproBad++; bad.push({ label, kind: 'referee could not reproduce', s: { dist: s.dist, h: s.h, vx: s.vx, kind: s.kind }, kx, press }); continue; }
        st.saves += r.saves;
        if (r.ref === r.saves) st.same++;
        else {
          if (r.ref > r.saves) st.missed++; else st.extra++;
          bad.push({ label, map: base.map, mirror: base.mirror, mode: base.mode, s: { dist: s.dist, h: s.h, vx: s.vx, kind: s.kind }, shot: s.shot, kx, press, after: o.after, mate: o.mate, ref: r.ref, game: r.saves, why: r.why, dbg: r.dbg, touches: r.touches.slice(0, 4), score: r.score, goal: r.goal });
        }
        // a save that counts is in the highlight too
        if (r.hl < r.saves) { st.hlMissing++; bad.push({ label, kind: 'save not in the highlight', s: { dist: s.dist, h: s.h, vx: s.vx, kind: s.kind }, kx, press, dbg: r.dbg, hl: r.hl, saves: r.saves }); }
      }
    }
    console.log(label.padEnd(46) + String(st.n).padStart(5) + ' situations, ' + String(st.saves).padStart(4) + ' saves | referee agrees: ' + st.same +
      (st.missed ? ' | game MISSED ' + st.missed : '') + (st.extra ? ' | game EXTRA ' + st.extra : '') + (st.hlMissing ? ' | NOT IN HIGHLIGHT ' + st.hlMissing : ''));
  }
  const t1 = Date.now();
  if (ONLY !== 'after') {
  console.log('--- shots and keepers ---');
  await sweep('soccer, left goal, 2 players', { map: 'soccer' });
  await sweep('soccer, right goal, 2 players', { map: 'soccer', mirror: true }, { sub: 2 });
  for (const m of ['moon', 'ice', 'giant']) await sweep(m + ', left goal', { map: m }, { sub: 3 });
  await sweep('basketball, left hoop', { map: 'basket' });
  await sweep('basketball, right hoop', { map: 'basket', mirror: true }, { sub: 2 });
  await sweep('american football, left posts', { map: 'football' });
  await sweep('american football, right posts', { map: 'football', mirror: true }, { sub: 2 });
  await sweep('beach volleyball, left half', { map: 'volley', secs: 4 });
  await sweep('beach volleyball, right half', { map: 'volley', mirror: true, secs: 4 }, { sub: 2 });
  await sweep('soccer, 2 vs 2', { map: 'soccer', mode: 'team4' }, { sub: 3 });
  await sweep('soccer, 2 vs 2, right goal', { map: 'soccer', mode: 'team4', mirror: true }, { sub: 5 });
  await sweep('soccer, 4 players', { map: 'soccer', mode: 'ffa' }, { sub: 3 });
  await sweep('soccer, keeper with a team-mate in front', { map: 'soccer' }, { sub: 3, extra: (s, g) => ({ mate: g.goalD + 320 }) });
  }
  if (ONLY !== 'shots') {
  console.log('--- after the ball was turned away ---');
  // the attackers knock the rebound in 0.05 - 3.5 s later: the save stays a save (video 4)
  for (const at of [0.05, 0.3, 0.9, 1.7, 2.6, 3.5]) await sweep('rebound knocked in ' + at + ' s later', { map: 'soccer', secs: 3.2 + at },
    { sub: 5, extra: () => ({ after: { at, kind: 'attIn', x: 430, y: 640, vx: -1500, vy: -120 } }) });
  await sweep('rebound knocked in 0.9 s later, right goal', { map: 'soccer', mirror: true, secs: 4.1 },
    { sub: 9, extra: () => ({ after: { at: 0.9, kind: 'attIn', x: 430, y: 640, vx: -1500, vy: -120 } }) });
  // his own team-mate puts it in (the attackers never touch it again): the save saved nothing
  for (const at of [0.3, 1.5]) await sweep('team-mate puts it in ' + at + ' s later', { map: 'soccer', secs: 3.2 + at },
    { sub: 5, extra: () => ({ after: { at, kind: 'mateIn', x: 430, y: 640, vx: -1500, vy: -120 } }) });
  // shot again over his head, he jumps again
  await sweep('shot again, saved again', { map: 'soccer', secs: 4.5 },
    { sub: 5, extra: () => ({ after: { at: 0.6, kind: 'attIn', x: 720, y: 600, vx: -1200, vy: -0.5 * 1700 * (470 / 1200), press2: [0.12, 0.3] } }) });

  }
  console.log('\n' + total + ' situations in ' + ((Date.now() - t1) / 1000).toFixed(0) + ' s; the referee reproduced the real game exactly in ' + (total - reproBad));
  const byWhy = {};
  bad.forEach(x => { const k = x.kind || ((x.ref > x.game ? 'game missed a save' : 'game counted an extra save') + ' | referee: ' + x.why + ' | game: ' + x.dbg.replace(/@[\d.-]+/g, '').replace(/miss[?x]? ?/g, '').trim()); (byWhy[k] = byWhy[k] || []).push(x); });
  Object.keys(byWhy).sort((a, b) => byWhy[b].length - byWhy[a].length).forEach(k => { console.log('\n' + byWhy[k].length + ' x ' + k); byWhy[k].slice(0, 3).forEach(x => console.log('   ' + JSON.stringify(x))); });
  console.log(errs.length ? errs.slice(0, 3).join('\n') : 'no page errors');
  console.log(bad.length ? bad.length + ' disagreements' : 'no disagreements');
  await browser.close();
  process.exit(bad.length || errs.length ? 1 : 0);
})();
