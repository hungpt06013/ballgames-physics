const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 380 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const out = path.resolve(__dirname, '../shots');
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.evaluate(() => localStorage.setItem('bgp_prefs', JSON.stringify({ maps: ['soccer', 'basket', 'football'], target: 9, level: 'hard', sound: true })));
  await page.reload(); await page.waitForTimeout(600);
  const pos = () => page.evaluate(() => ({ round: __game.round, map: __game.world.arena.map.id, x: __game.world.players.map(p => Math.round(p.x)), role: __game.world.players.map(p => p.role) }));
  const goal = () => page.evaluate(() => { const w = __game.world, b = w.ball, A = w.arena;
    if (A.type === 'goal') { b.x = BGP.W - 70; b.y = BGP.GROUND - 40; b.vx = 300; b.vy = 0; }
    else if (A.type === 'hoop') { b.x = BGP.W - (A.boardX + A.rimFront) / 2; b.y = A.rimY - 35; b.vx = 0; b.vy = 300; }
    else { b.x = BGP.W - A.postX - 8; b.y = A.barY - 150; b.vx = 900; b.vy = 0; }
    b.lastBy[0] = 0; });
  for (const mode of ['ffa', 'team4', '2p']) {
    await page.tap('[data-act="' + mode + '"]');
    await page.waitForTimeout(400);
    const seen = [];
    for (let r = 0; r < 3; r++) {
      seen.push(await pos());
      await page.waitForTimeout(1300);
      await goal();
      await page.waitForTimeout(2600);
    }
    console.log(mode, JSON.stringify(seen));
    if (mode === 'ffa') {
      // colours of the scoring structures: grey -> last toucher of each side
      await page.evaluate(() => { __game.state = 'paused'; __game.world.ball.lastBy[0] = -1; __game.world.ball.lastBy[1] = -1; });
      await page.waitForTimeout(150); await page.screenshot({ path: out + '/goals_grey.png' });
      await page.evaluate(() => { __game.world.ball.lastBy[0] = 1; __game.world.ball.lastBy[1] = 3; });
      await page.waitForTimeout(150); await page.screenshot({ path: out + '/goals_p2p4.png' });
      await page.evaluate(() => { __game.world.ball.lastBy[0] = 0; __game.world.ball.lastBy[1] = 2; });
      await page.waitForTimeout(150); await page.screenshot({ path: out + '/goals_p1p3.png' });
      await page.evaluate(() => { __game.state = 'play'; });
    }
    await page.tap('#pauseBtn'); await page.waitForTimeout(200);
    await page.tap('#pause [data-act="toMenu"]'); await page.waitForTimeout(400);
  }
  console.log('errors', errs);
  await browser.close();
})();
