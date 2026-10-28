const { chromium } = require('playwright');
const path = require('path');
const SH = path.resolve(__dirname, '../shots3');
const ONLY = process.env.ONLY || '';
const want = k => !ONLY || ONLY.split(',').includes(k);
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 380 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PE ' + String(e.stack || e)));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.waitForTimeout(700);
  const ev = (f, a) => page.evaluate(f, a);
  const shot = n => page.screenshot({ path: SH + '/' + n + '.png' });
  const flush = tag => { if (errs.length) console.log('ERRORS @' + tag, errs.splice(0)); };
  await page.tap('[data-act="skipTutorial"]:visible');

  if (want('menu')) {
    await shot('01_menu');
    await page.tap('[data-act="setup"][data-mode="bot"]'); await page.waitForTimeout(250);
    await shot('02_setup');
    // tick only basketball
    await page.tap('#sportAll'); await page.waitForTimeout(100); // all -> soccer only (or all)
    let maps = await ev(() => JSON.parse(localStorage.getItem('bgp_prefs')).maps);
    if (maps.length > 1) { await page.tap('#sportAll'); maps = await ev(() => JSON.parse(localStorage.getItem('bgp_prefs')).maps); }
    console.log('after "all" toggle', maps);
    await page.tap('#sportChecks label:nth-child(2)'); await page.waitForTimeout(100); // + basket
    await page.tap('#sportChecks label:nth-child(1)'); await page.waitForTimeout(100); // - soccer
    await page.tap('#sportChecks label:nth-child(2)'); await page.waitForTimeout(100); // try removing the last one
    maps = await ev(() => JSON.parse(localStorage.getItem('bgp_prefs')).maps);
    console.log('ticked', maps);
    await shot('03_setup_basket');
    await page.tap('[data-act="start"]:visible'); await page.waitForTimeout(2000);
    console.log('match map', await ev(() => __game.world.arena.map.id), 'queue', await ev(() => __game.queue));
    await ev(() => __api.onScore(1)); await page.waitForTimeout(400); await page.touchscreen.tap(400, 200);
    await page.waitForTimeout(2500);
    console.log('next round map', await ev(() => ({ st: __game.state, map: __game.world.arena.map.id, round: __game.round })));
    await ev(() => __api.toMenu());
    await page.tap('[data-act="settings"]:visible'); await page.waitForTimeout(200); await shot('04_settings');
    await page.tap('[data-act="back"]:visible');
    await page.tap('[data-act="stats"]:visible'); await page.waitForTimeout(200); await shot('05_stats');
    await page.tap('[data-act="back"]:visible');
    await page.tap('[data-act="help"]:visible'); await page.waitForTimeout(200); await shot('06_help');
    await page.tap('[data-act="back"]:visible');
    console.log('menu screens', await ev(() => ['challenges', 'tourney'].map(id => !!document.getElementById(id))), 'mode buttons', await ev(() => document.querySelectorAll('.modes .btn').length));
    flush('menu');
  }

  if (want('hold')) {
    // regression: after a goal (and its replay) the human players must not stay "pressed"
    await ev(() => __api.startMatch({ mode: 'bot', maps: ['soccer'], mods: false, items: false, fmt: 'p10', level: 'easy' }));
    await page.waitForTimeout(1800);
    await ev(() => { __game.world.time = 40; }); // a long round
    for (let i = 0; i < 3; i++) { await page.touchscreen.tap(300, 200); await page.waitForTimeout(300); }
    await ev(() => { const b = __game.world.ball; b.x = b.prevX = BGP.W - 230; b.y = b.prevY = BGP.GROUND - 80; b.vx = 1300; b.vy = 0; b.touchT[0] = __game.world.time - 0.3; });
    let st;
    for (let i = 0; i < 60; i++) { await page.waitForTimeout(250); st = await ev(() => __game.state); if (st === 'intro' || st === 'play' && i > 4) break; }
    await page.waitForTimeout(2200);
    const r = await ev(() => ({ st: __game.state, round: __game.round, time: __game.world.time.toFixed(2), hold: __game.hold.map(h => h.toFixed(2)), pressed: __game.pressed.slice(), p0press: __game.world.players[0].press, p1press: __game.world.players[1].press }));
    console.log('new round without tapping', JSON.stringify(r));
    await page.touchscreen.tap(300, 200); await page.waitForTimeout(150);
    console.log('after one tap vy', await ev(() => __game.world.players.slice(0, 2).map(p => p.vy | 0)));
    flush('hold');
  }

  if (want('replay')) {
    // natural goals from bot vs "random" human taps: check the replay window
    await ev(() => __api.startMatch({ mode: 'bot', maps: ['soccer'], mods: false, items: false, fmt: 'p10', level: 'hard' }));
    await ev(() => { window.__rp = []; const G = __game; let last = null; setInterval(() => { if (G.state === 'replay' && G.replay && G.replay !== last) { last = G.replay; const rec = G.rec; window.__rp.push({ fromT: rec.timeAt(G.replay.from), shotT: rec.shotT, goalT: rec.timeAt(rec.goal - 1), toT: rec.timeAt(G.replay.to), slowFrom: rec.timeAt(G.replay.slowFrom), slowTo: rec.timeAt(G.replay.slowTo), scorer: G.scorer, touch: (G.world.balls[G.world.scoreBall] || G.world.ball).touchT.slice(), word: G.word }); } }, 20); });
    let shots = 0;
    for (let i = 0; i < 160; i++) {
      const st = await ev(() => __game.state);
      if (st === 'play' && i % 3 === 0) await page.touchscreen.tap(300, 200);
      if (st === 'replay' && shots < 2) { await page.waitForTimeout(1500); await shot('10_replay_' + shots); shots++; }
      if (st === 'over') break;
      await page.waitForTimeout(250);
      if ((await ev(() => window.__rp.length)) >= 3) break;
    }
    const rp = await ev(() => window.__rp);
    rp.forEach(x => console.log('replay', JSON.stringify({ scorer: x.scorer, word: x.word, from: x.fromT.toFixed(2), shot: x.shotT.toFixed(2), goal: x.goalT.toFixed(2), to: x.toT.toFixed(2), lead: (x.shotT - x.fromT).toFixed(2), slow: [x.slowFrom.toFixed(2), x.slowTo.toFixed(2)], touch: x.touch.map(t => t.toFixed(2)) })));
    flush('replay');
  }

  if (want('owngoal')) {
    // own goal: red shoots (touch at t), blue touches last, ball goes into blue's goal -> replay from red's shot - 5 s
    await ev(() => __api.startMatch({ mode: '2p', maps: ['soccer'], mods: false, items: false, fmt: 'p10' }));
    await page.waitForTimeout(1800);
    await page.waitForTimeout(7000);
    await ev(() => { const w = __game.world, b = w.ball; b.x = b.prevX = BGP.W - 200; b.y = b.prevY = BGP.GROUND - 80; b.vx = 1200; b.vy = 0; b.touchT[0] = w.time - 0.6; b.touchT[1] = w.time - 0.2; b.lastBy = [1, 2]; b.lastTeam = 1; });
    for (let i = 0; i < 30; i++) { await page.waitForTimeout(200); if (await ev(() => __game.state === 'replay')) break; }
    console.log('own goal replay', JSON.stringify(await ev(() => { const G = __game, rec = G.rec; return { word: G.word, scorer: G.scorer, from: rec.timeAt(G.replay.from).toFixed(2), shot: rec.shotT.toFixed(2), goal: rec.timeAt(rec.goal - 1).toFixed(2) }; })));
    flush('owngoal');
  }

  if (want('out')) {
    await ev(() => __api.startMatch({ mode: '2p', maps: ['basket'], mods: false, items: false, fmt: 'p10' }));
    await page.waitForTimeout(1800);
    await ev(() => { const b = __game.world.ball; b.x = b.prevX = 60; b.y = b.prevY = BGP.GROUND - 40; b.vx = b.vy = 0; window.__resp = []; const G = __game; const t0 = performance.now(); const id = setInterval(() => { if (G.note === 'TUNG BÓNG!' && G.noteT > 0 && !window.__resp.length) window.__resp.push(((performance.now() - t0) / 1000).toFixed(2)); }, 30); });
    await page.waitForTimeout(1500); await shot('20_basket_behind_pole');
    await page.waitForTimeout(2500);
    console.log('behind pole respawn after (s)', await ev(() => window.__resp), 'ball', await ev(() => [__game.world.ball.x | 0, __game.world.ball.y | 0]));
    await ev(() => __api.startMatch({ mode: '2p', maps: ['soccer'], mods: false, items: false, fmt: 'p10' }));
    await page.waitForTimeout(1800);
    await ev(() => { const b = __game.world.ball; b.x = b.prevX = 450; b.y = b.prevY = BGP.GROUND - 24; b.vx = b.vy = 0; __game.note = ''; });
    await page.waitForTimeout(6000);
    console.log('still ball in field after 6 s', await ev(() => [__game.world.ball.x | 0, __game.world.ball.y | 0, __game.note]));
    flush('out');
  }

  if (want('goals')) {
    for (const [id, beg] of [['soccer', false], ['moon', false], ['giant', false], ['soccer', true]]) {
      await ev(a => __api.startMatch({ mode: '2p', maps: [a[0]], mods: false, items: false, beginner: a[1] }), [id, beg]);
      await page.waitForTimeout(1900);
      await shot('30_goal_' + id + (beg ? '_beginner' : ''));
      console.log(id, beg ? 'beginner' : '', await ev(() => ({ goalH: __game.world.arena.goalH, goalD: __game.world.arena.goalD })));
    }
    flush('goals');
  }

  if (want('all')) {
    // every remaining sport and modifier in a bot match, plus 4-player modes
    for (const id of await ev(() => BGP.MAPS.map(m => m.id))) {
      await ev(id => __api.startMatch({ mode: 'bot', maps: [id], mods: true, items: true }), id);
      await page.waitForTimeout(1900);
      for (let i = 0; i < 8; i++) { await page.touchscreen.tap(300, 200); await page.waitForTimeout(200); }
      await shot('40_' + id);
      console.log(id, JSON.stringify(await ev(() => ({ st: __game.state, mod: __game.modName, nan: __game.world.players.some(p => !isFinite(p.x)) || __game.world.balls.some(b => !isFinite(b.x)) }))));
    }
    await ev(() => __api.startMatch({ mode: 'ffa', maps: ['soccer', 'basket'], mods: false, slots: ['h', 'b', 'b', 'b'] }));
    await page.waitForTimeout(4000); await shot('41_ffa');
    await ev(() => __api.startMatch({ mode: 'team4', maps: ['volley'], mods: false, slots: ['h', 'h', 'b', 'b'] }));
    await page.waitForTimeout(4000); await shot('42_team4');
    await ev(() => __api.toMenu());
    await page.tap('[data-act="tutorial"]:visible'); await page.waitForTimeout(1500); await shot('43_tutorial');
    flush('all');
  }
  console.log('remaining errors', errs);
  await browser.close();
})();
