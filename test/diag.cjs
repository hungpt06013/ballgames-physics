// v3 detection check: bots play whole matches in several sports; every save decision (taken or not, and why),
// every near-miss candidate and every goal is written out with the ball's path around it (for plots to look at)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = process.argv[2] || path.resolve(__dirname, '../shots_diag/diag.json');
const CASES = JSON.parse(process.argv[3] || 'null') || [
  { mode: 'team4', maps: ['soccer'], fmt: 'p6' },
  { mode: 'team4', maps: ['soccer'], fmt: 'p6' },
  { mode: 'team4', maps: ['moon'], fmt: 'p5' },
  { mode: 'team4', maps: ['ice'], fmt: 'p5' },
  { mode: 'team4', maps: ['giant'], fmt: 'p5' },
  { mode: 'team4', maps: ['basket'], fmt: 'p5' },
  { mode: 'team4', maps: ['football'], fmt: 'p5' },
  { mode: 'ffa', maps: ['soccer'], fmt: 'p4' }
];
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await (await browser.newContext({ viewport: { width: 800, height: 380 } })).newPage();
  page.on('pageerror', e => console.log('PE', e.message));
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.waitForTimeout(500);
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('bgp_prefs')); p.hlAsked = true; p.hlMode = 'none'; localStorage.setItem('bgp_prefs', JSON.stringify(p)); });
  await page.reload(); await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.__dstep = function (n) {
      const G = __game, D = window.__D;
      for (let i = 0; i < n; i++) {
        if (G.state === 'over') return 'over';
        if (G.state === 'vote') { G.golden = true; G.state = 'play'; }
        __api.step(1 / 60);
        const w = G.world; if (!w) continue;
        const A = w.arena;
        D.tr.push({ t: +w.time.toFixed(3), r: G.round, st: G.state, b: w.balls.slice(0, 2).map(b => [Math.round(b.x), Math.round(b.y), Math.round(b.vx), Math.round(b.vy), b.lastPid]),
          p: w.players.map(p => [Math.round(p.x), Math.round(p.y), p.active ? 1 : 0]) });
        if (D.tr.length > 1500) D.tr.shift();
        const geo = { goalD: A.goalD, goalTop: A.goalTop, rimY: A.rimY, boardX: A.boardX, rimFront: A.rimFront, postX: A.postX, barY: A.barY };
        const tag = e => Object.assign(e, { map: A.map.id, type: A.type, R: A.P.ballR, geo, match: D.match });
        while (D.k < G.dbg.length) { const e = tag(G.dbg[D.k++]); D.pend.push({ e, due: w.time + 1.5 }); }
        const sc = G.score.join(',');
        if (D.lastSc !== null && sc !== D.lastSc && G.round === D.lastR) D.pend.push({ e: tag({ r: 'goal', t: w.time, round: G.round, scorer: G.scorer, sc }), due: w.time + 0.6 });
        D.lastSc = sc; D.lastR = G.round;
        D.pend = D.pend.filter(p => {
          if (w.time < p.due && G.round === p.e.round) return true;
          p.e.trace = D.tr.filter(f => f.r === p.e.round && f.t >= p.e.t - 3 && f.t <= p.e.t + 1.5);
          D.out.push(p.e); return false;
        });
      }
      return G.state;
    };
  });
  const all = [];
  for (let ci = 0; ci < CASES.length; ci++) {
    const c = CASES[ci];
    await page.evaluate(([c, ci]) => {
      window.__D = { tr: [], out: [], pend: [], k: 0, lastSc: null, lastR: -1, match: ci };
      __api.startMatch(Object.assign({ slots: ['b', 'b', 'b', 'b'], level: 'hard', mods: false, items: false, weather: false }, c));
      __game.dbg = [];
    }, [c, ci]);
    let st;
    for (let i = 0; i < 300; i++) { st = await page.evaluate(() => __dstep(600)); if (st === 'over') break; }
    const out = await page.evaluate(() => { const D = window.__D; D.pend.forEach(p => { p.e.trace = D.tr.filter(f => f.r === p.e.round && f.t >= p.e.t - 3); D.out.push(p.e); }); return D.out; });
    const count = {}; out.forEach(e => { count[e.r] = (count[e.r] || 0) + 1; });
    console.log(ci, c.mode, c.maps[0], st, JSON.stringify(count));
    all.push(...out);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(all));
  await browser.close();
})();
