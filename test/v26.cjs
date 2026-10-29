// v2.6: real saves only (pressed just before, own half, no shields), no moment twice in a highlight, rating follows the result
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await (await browser.newContext({ viewport: { width: 800, height: 380 } })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PE ' + String(e.stack || e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.waitForTimeout(500);
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('bgp_prefs')); p.hlAsked = true; p.hlMode = 'all'; localStorage.setItem('bgp_prefs', JSON.stringify(p)); });
  await page.reload(); await page.waitForTimeout(500);
  const ev = (f, a) => page.evaluate(f, a);
  let fails = 0;
  const check = (name, ok, info) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info ? '  ' + info : '')); };

  // a shot from the right at the left goal (team 1 attacks, team 0 defends); one team-0 player stands in the way
  // the defender's random sway can let the ball fly past him: only a run where he touched it says anything
  async function shot(o) {
    let r;
    for (let i = 0; i < 6; i++) { r = await shot1(o); if (r.touched) break; }
    return r;
  }
  async function shot1(o) {
    return ev(o => {
      const E = BGP;
      __api.startMatch({ mode: '2p', fmt: 'p9', maps: ['soccer'], mods: false, items: false, weather: false });
      __api.step(1 / 60, 110);
      const w = __game.world, P = w.players, park = [o.defX, 1560, 1480, 1560];
      P.forEach((p, i) => { p.x = park[i]; p.y = E.GROUND - E.COM_H * p.sc; p.vx = p.vy = p.a = p.w = 0; E.shapes(p); });
      const b = w.ball;
      b.x = b.prevX = o.ballX; b.y = b.prevY = E.GROUND - 95; b.vx = o.vx; b.vy = -150; b.spin = 0;
      b.lastTeam = 1; b.lastBy[1] = 2; b.lastPid = 2; b.touchT[1] = w.time; b.lastX = b.x;
      const t0 = w.time; b.touchT[0] = -1;
      for (let i = 0; i < 260 && __game.state === 'play'; i++) { // 4 s: a save's clip is made 3 s after it
        if (o.pressed) __game.pressT[0] = __game.world.time; // the defender is doing something
        __api.step(1 / 60);
      }
      return { saves: __game.ps[0].saves, touched: b.touchT[0] >= t0, score: __game.score.join('-'), clips: __game.hlm.singles.length + __game.hlm.clips.length };
    }, o);
  }
  let r = await shot({ defX: 240, ballX: 700, vx: -1500, pressed: false });
  check('idle defender, ball hits him in his own half: no save', r.touched && r.saves === 0 && r.clips === 0, JSON.stringify(r));
  r = await shot({ defX: 240, ballX: 700, vx: -1500, pressed: true });
  check('defender who pressed, own half: save', r.touched && r.saves === 1 && r.clips === 1, JSON.stringify(r));
  r = await shot({ defX: 600, ballX: 900, vx: -1700, pressed: true });
  check('defender who pressed, own half near the middle: save', r.saves === 1, JSON.stringify(r));
  r = await shot({ defX: 1000, ballX: 1300, vx: -2300, pressed: true });
  check('defender who pressed, but in the attacker\'s half: no save', r.touched && r.saves === 0 && r.clips === 0, JSON.stringify(r));

  // whole matches by bots: no two clips of a round overlap, saves that led to a goal sit inside the goal's clip
  let merged = 0, total = 0, overlaps = 0, saveStats = 0, saveMarks = 0;
  for (const cfg of [
    { mode: 'team4', slots: ['b', 'b', 'b', 'b'], level: 'hard', fmt: 'p6', maps: ['soccer', 'giant', 'ice', 'moon'], mods: true, items: true, weather: false },
    { mode: 'team4', slots: ['b', 'b', 'b', 'b'], level: 'hard', fmt: 'p6', maps: ['basket', 'football', 'volley'], mods: true, items: true, weather: true },
    { mode: 'ffa', slots: ['b', 'b', 'b', 'b'], level: 'normal', fmt: 'p4', maps: ['soccer', 'moon'], mods: false, items: true, weather: true }]) {
    await ev(c => __api.startMatch(c), cfg);
    for (let i = 0; i < 300; i++) {
      const st = await ev(() => { for (let i = 0; i < 600 && __game.state !== 'over'; i++) { if (__game.state === 'vote') { __game.golden = true; __game.state = 'play'; } __api.step(1 / 60); } return __game.state; });
      if (st === 'over') break;
    }
    await page.waitForTimeout(300);
    const res = await ev(() => {
      const cl = __game.lastHL ? __game.lastHL.clips : [], len = c => c.frames.length / 90 / 30;
      let ov = 0, mg = 0;
      for (let i = 1; i < cl.length; i++) if (cl[i].round === cl[i - 1].round && cl[i - 1].t + len(cl[i - 1]) > cl[i].t + 0.05) ov++;
      cl.forEach(c => { if (c.kind === 'goal' && c.marks.some(m => m.kind === 'save')) mg++; });
      const rec = BGHL.history()[0];
      return { n: cl.length, ov, mg, kinds: cl.map(c => c.kind[0] + (c.marks.length > 1 ? c.marks.length : '')).join(''), saves: rec.ps.reduce((a, p) => a + p.s, 0),
        marks: cl.reduce((a, c) => a + c.marks.filter(m => m.kind === 'save').length, 0), ratings: rec.ps.map(p => p.n + ' ' + p.r + (p.win ? 'W' : '')).join(', '), score: rec.score.join('-') };
    });
    console.log('   ', cfg.mode, res.score, 'clips', res.kinds, '| saves', res.saves, '| ratings', res.ratings);
    total += res.n; overlaps += res.ov; merged += res.mg; saveStats += res.saves; saveMarks += res.marks;
  }
  check('no overlapping clips in the highlights', overlaps === 0, 'clips ' + total + ', goal clips holding the save before them: ' + merged);
  check('highlights only hold counted saves', saveMarks <= saveStats, saveMarks + ' save moments in clips, ' + saveStats + ' saves counted');

  // ratings
  async function rating(mode, score, ps, draw) {
    return ev(async o => {
      __api.startMatch({ mode: o.mode, fmt: 'p99', maps: ['soccer'], mods: false, items: false, weather: false, slots: ['h', 'h', 'h', 'h'] });
      __api.step(1 / 60, 110);
      __game.score = o.score; __game.ps = o.ps.map(a => ({ goals: a[0], saves: a[1], shots: a[2], touches: a[3], own: a[4] }));
      __game.target = 0; __game.clock = 0;
      __api.endMatch(o.draw);
      await new Promise(r => setTimeout(r, 50)); // the history record is written right after
      const rec = BGHL.history()[0];
      return rec.ps.map(p => p.r).concat([rec.ps[rec.mvp].n]);
    }, { mode, score, ps, draw: !!draw });
  }
  r = await rating('bot', [1, 6], [[1, 8, 8, 24, 3], [3, 3, 12, 19, 0]]);
  check('the screenshot (lost 1–6, 3 own goals, 8 "saves"): far under 6', r[0] < 5.6 && r[1] > 9, 'P1 ' + r[0] + ', Bot ' + r[1] + ', MVP ' + r[2]);
  r = await rating('bot', [1, 6], [[1, 1, 8, 24, 3], [3, 3, 12, 19, 0]]);
  check('same match with the real saves only', r[0] < 4.5, 'P1 ' + r[0] + ', Bot ' + r[1]);
  r = await rating('bot', [0, 5], [[0, 0, 1, 10, 0], [5, 0, 9, 20, 0]]);
  check('lost 0–5 doing little', r[0] < 4.2 && r[1] > 9, 'P1 ' + r[0] + ', Bot ' + r[1]);
  r = await rating('team4', [5, 5, 4, 4], [[2, 1, 3, 15, 0], [0, 0, 1, 10, 0], [2, 0, 3, 15, 0], [1, 2, 2, 12, 0]]);
  check('close 5–4 in 2 vs 2: winners above losers, all near 6–8', r[0] > r[2] && r[1] > 6 && r[2] > 5 && r[0] < 9, r.slice(0, 4).join(' / ') + ', MVP ' + r[4]);
  r = await rating('2p', [3, 3], [[3, 2, 6, 20, 0], [3, 1, 5, 18, 1]], true);
  check('3–3 draw with a hat-trick: good but not 10, own goal costs', r[0] > 7 && r[0] < 9.2 && r[1] < r[0], r.slice(0, 2).join(' / '));

  // a bot match where the human never touches the button: no saves for him, whatever hits his players
  await ev(() => __api.startMatch({ mode: 'bot', level: 'normal', fmt: 't60', maps: ['soccer'], mods: false, items: false, weather: false }));
  await ev(() => { for (let i = 0; i < 3800 && __game.state !== 'over' && __game.state !== 'vote'; i++) __api.step(1 / 60); });
  r = await ev(() => ({ st: __game.state, ps: JSON.stringify(__game.ps), score: __game.score.join('-') }));
  check('idle human vs bot for a minute: 0 saves', JSON.parse(r.ps)[0].saves === 0, r.score + ' ' + r.ps);

  console.log(errs.length ? 'ERRORS ' + errs.join('\n') : 'no page errors');
  console.log(fails ? fails + ' FAILED' : 'all checks passed');
  await browser.close();
})();
