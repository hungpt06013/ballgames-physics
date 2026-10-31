// v3.1: pausing (the X button, the back button, leaving the app) while the screen fades never leaves it white;
// saves raise the rating a little more, own goals lower it a little less
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await (await browser.newContext({ viewport: { width: 800, height: 380 }, hasTouch: true, isMobile: true })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PE ' + String(e.stack || e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html')); await page.waitForTimeout(400);
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('bgp_prefs')); p.hlAsked = true; localStorage.setItem('bgp_prefs', JSON.stringify(p)); });
  await page.reload(); await page.waitForTimeout(400);
  await page.tap('[data-act="skipTutorial"]:visible');
  const ev = (f, a) => page.evaluate(f, a);
  let fails = 0;
  const check = (name, ok, info) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info ? '  ' + info : '')); };
  const state = () => ev(() => ({ st: __game.state, fade: +__game.fade.toFixed(2), dir: __game.fadeDir, round: __game.round }));

  // a point, then wait until the screen starts fading to white (the replay, if on, is skipped by a tap)
  async function toFade(replay) {
    await ev(r => { __game.cfg = null; const p = JSON.parse(localStorage.getItem('bgp_prefs')); p.replay = r; localStorage.setItem('bgp_prefs', JSON.stringify(p)); }, replay);
    await page.reload(); await page.waitForTimeout(400);
    await ev(() => __api.startMatch({ mode: '2p', fmt: 'p9', maps: ['soccer'], mods: false, items: false, weather: false }));
    await page.waitForTimeout(2200);
    await ev(() => { const b = __game.world.ball; b.touchT[0] = __game.world.time - 1; __api.onScore(0); });
    for (let i = 0; i < 80; i++) {
      await page.waitForTimeout(100);
      const s = await ev(() => ({ st: __game.state, dir: __game.fadeDir }));
      if (s.st === 'replay') { await page.tap('#touch', { position: { x: 400, y: 200 } }); continue; }
      if (s.st === 'scored' && s.dir === 1) return true;
    }
    return false;
  }
  for (const replay of [true, false]) {
    check('fade reached (replay ' + (replay ? 'on' : 'off') + ')', await toFade(replay));
    await page.tap('#pauseBtn');
    await page.waitForTimeout(1000);
    const during = await state();
    await page.tap('[data-act="resume"]:visible');
    await page.waitForTimeout(3000);
    const after = await state();
    check('X during the fade after a point, resume: next round, not white (replay ' + (replay ? 'on' : 'off') + ')', during.st === 'paused' && after.round === 2 && after.fade === 0 && after.st === 'play', JSON.stringify(during) + ' -> ' + JSON.stringify(after));
  }
  // leaving the app during the fade (the game pauses itself), then coming back
  await toFade(false);
  await ev(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(1000);
  await ev(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); });
  const hid = await state();
  await page.tap('[data-act="resume"]:visible'); await page.waitForTimeout(3000);
  let after = await state();
  check('leaving the app during the fade, coming back: next round', hid.st === 'paused' && after.round === 2 && after.fade === 0, JSON.stringify(hid) + ' -> ' + JSON.stringify(after));
  // Android back button during the fade: pauses; back again resumes
  await toFade(false);
  await ev(() => window.__back()); await page.waitForTimeout(800);
  const b1 = await state();
  await ev(() => window.__back()); await page.waitForTimeout(3000);
  after = await state();
  check('back button during the fade, back again: next round', b1.st === 'paused' && after.round === 2 && after.fade === 0, JSON.stringify(b1) + ' -> ' + JSON.stringify(after));
  // X while the next round fades in
  await ev(() => { __game.fade = 1; __game.fadeDir = -1; });
  await page.tap('#pauseBtn'); await page.waitForTimeout(800);
  await page.tap('[data-act="resume"]:visible'); await page.waitForTimeout(1500);
  after = await state();
  check('X while a round fades in, resume: clear screen', after.fade === 0 && (after.st === 'play' || after.st === 'intro'), JSON.stringify(after));
  // X during the fade, then "Chơi lại" or "Menu" from the pause screen
  await toFade(false);
  await page.tap('#pauseBtn'); await page.waitForTimeout(500);
  await page.tap('[data-act="restart"]:visible'); await page.waitForTimeout(2500);
  after = await state();
  check('X during the fade, then restart: a new match, not white', after.fade === 0 && after.round === 1 && (after.st === 'play' || after.st === 'intro'), JSON.stringify(after));
  await toFade(false);
  await page.tap('#pauseBtn'); await page.waitForTimeout(500);
  await page.tap('#pause [data-act="toMenu"]'); await page.waitForTimeout(1200);
  after = await state();
  check('X during the fade, then menu: menu shown, not white', after.st === 'menu' && after.fade === 0, JSON.stringify(after));
  // the highlight's ✖ while one clip fades into the next
  await ev(() => __api.startMatch({ mode: 'team4', slots: ['b', 'b', 'b', 'b'], level: 'hard', fmt: 'p3', maps: ['soccer'], mods: false, items: false, weather: false }));
  await ev(() => { for (let i = 0; i < 60000 && __game.state !== 'over'; i++) { if (__game.state === 'vote') { __game.golden = true; __game.state = 'play'; } __api.step(1 / 60); } });
  await page.waitForTimeout(400);
  await page.tap('#overTools [data-act="hlWatch"]'); await page.waitForTimeout(1500);
  await page.tap('#touch', { position: { x: 400, y: 200 } }); await page.waitForTimeout(120); // next clip: fading to white
  await page.tap('#hlClose'); await page.waitForTimeout(1200);
  after = await state();
  check('✖ in a highlight while it changes clip: back to the end screen, not white', after.st === 'over' && after.fade === 0 && await ev(() => !document.getElementById('over').classList.contains('hidden')), JSON.stringify(after));

  // ratings: a save counts 0.4 (was 0.3), an own goal -0.45 (was -0.6)
  async function rating(mode, score, ps, draw) {
    return ev(async o => {
      __api.startMatch({ mode: o.mode, fmt: 'p99', maps: ['soccer'], mods: false, items: false, weather: false, slots: ['h', 'h', 'h', 'h'] });
      __api.step(1 / 60, 110);
      __game.score = o.score; __game.ps = o.ps.map(a => ({ goals: a[0], saves: a[1], shots: a[2], touches: a[3], own: a[4] }));
      __game.target = 0; __game.clock = 0;
      __api.endMatch(o.draw);
      await new Promise(r => setTimeout(r, 50));
      return BGHL.history()[0].ps.map(p => p.r);
    }, { mode, score, ps, draw: !!draw });
  }
  const keeper = await rating('bot', [2, 1], [[0, 5, 1, 15, 0], [1, 1, 5, 15, 0]]);
  const noSaves = await rating('bot', [2, 1], [[0, 0, 1, 15, 0], [1, 1, 5, 15, 0]]);
  check('5 saves in a 2–1 win lift the rating clearly', keeper[0] - noSaves[0] >= 1.2, keeper[0] + ' with 5 saves vs ' + noSaves[0] + ' without');
  const own = await rating('2p', [3, 3], [[1, 1, 4, 18, 2], [2, 1, 4, 18, 0]], true);
  const clean = await rating('2p', [3, 3], [[1, 1, 4, 18, 0], [2, 1, 4, 18, 0]], true);
  check('2 own goals in a draw cost less than before', clean[0] - own[0] < 1.0 && clean[0] - own[0] > 0.5, own[0] + ' with 2 own goals vs ' + clean[0] + ' without');
  const big = await rating('bot', [1, 6], [[1, 1, 8, 24, 3], [3, 3, 12, 19, 0]]);
  check('a 1–6 loss with 3 own goals is still far under 6', big[0] < 4.5 && big[1] > 9, 'P1 ' + big[0] + ', Bot ' + big[1]);

  console.log(errs.length ? 'ERRORS ' + errs.join('\n') : 'no page errors');
  console.log(fails ? fails + ' FAILED' : 'all checks passed');
  await browser.close();
})();
