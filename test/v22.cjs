const { chromium } = require('playwright');
const path = require('path');
const SH = path.resolve(__dirname, '../shots4');
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
  await page.tap('[data-act="skipTutorial"]:visible');

  // goal line: a ball resting half over the line is not a goal and stays in play
  await ev(() => __api.startMatch({ mode: '2p', maps: ['soccer'], mods: false, items: false, fmt: 'p10' }));
  await page.waitForTimeout(1900);
  await ev(() => { const w = __game.world, A = w.arena, b = w.ball, R = A.P.ballR; for (const p of w.players) { p.x = p.team ? 1000 : 600; } b.x = b.prevX = BGP.W - A.goalD + R * 0.5; b.y = b.prevY = BGP.GROUND - R; b.vx = b.vy = 0; });
  await page.waitForTimeout(3600);
  await shot('01_ball_on_line');
  console.log('ball half over the line after 3.6 s', await ev(() => ({ st: __game.state, score: __game.score, x: __game.world.ball.x | 0, note: __game.noteT > 0 ? __game.note : '' })));

  // replay: flash when the ball goes in
  await ev(() => { const w = __game.world, b = w.ball; b.x = b.prevX = BGP.W - 320; b.y = b.prevY = BGP.GROUND - 120; b.vx = 1100; b.vy = -100; b.touchT[0] = w.time - 0.2; b.lastBy = [1, -1]; b.lastTeam = 0; });
  let got = false;
  for (let i = 0; i < 200; i++) {
    await page.waitForTimeout(40);
    if (await ev(() => !!(__game.flash && __game.state === 'replay'))) { got = true; break; }
  }
  await page.waitForTimeout(120); await shot('02_replay_flash');
  await page.waitForTimeout(450); await shot('03_replay_flash_later');
  console.log('flash seen', got, await ev(() => __game.flash && { txt: __game.flash.txt, x: __game.flash.x | 0, y: __game.flash.y | 0 }));

  // basketball: players pushed at the pole can't get behind it
  await ev(() => __api.startMatch({ mode: '2p', maps: ['basket'], mods: false, items: false, fmt: 'p10' }));
  await page.waitForTimeout(1900);
  await ev(() => { window.__pushT = setInterval(() => { for (const p of __game.world.players) p.vx += p.team ? 60 : -60; }, 16); });
  for (let i = 0; i < 10; i++) { await page.touchscreen.tap(200, 200); await page.touchscreen.tap(600, 200); await page.waitForTimeout(250); }
  await shot('04_basket_wall');
  console.log('basket player x', await ev(() => { clearInterval(window.__pushT); return __game.world.players.map(p => p.x | 0); }));
  await ev(() => __api.startMatch({ mode: '2p', maps: ['football'], mods: false, items: false, fmt: 'p10' }));
  await page.waitForTimeout(1900);
  await ev(() => { window.__pushT = setInterval(() => { for (const p of __game.world.players) p.vx += p.team ? 60 : -60; }, 16); });
  for (let i = 0; i < 10; i++) { await page.touchscreen.tap(200, 200); await page.touchscreen.tap(600, 200); await page.waitForTimeout(250); }
  await shot('05_football_wall');
  console.log('football player x', await ev(() => { clearInterval(window.__pushT); return __game.world.players.map(p => p.x | 0); }));

  // get up from upside down
  await ev(() => __api.startMatch({ mode: '2p', maps: ['soccer'], mods: false, items: false, fmt: 'p10' }));
  await page.waitForTimeout(1900);
  await ev(() => { const p = __game.world.players[1]; p.a = 3.0; p.y = BGP.GROUND - 40; p.w = 0; window.__up = null; const t0 = performance.now(); const id = setInterval(() => { if (Math.abs(p.a) < 0.4 && p.gT < 0.07) { window.__up = ((performance.now() - t0) / 1000).toFixed(2); clearInterval(id); } }, 16); });
  await page.waitForTimeout(300); await shot('06_upside_down');
  await page.waitForTimeout(2200);
  console.log('upside-down player standing after (s)', await ev(() => window.__up));
  console.log('errors', errs);
  await browser.close();
})();
