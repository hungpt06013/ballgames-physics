const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await (await browser.newContext({ viewport: { width: 800, height: 380 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.evaluate(() => { localStorage.setItem('bgp_settings', JSON.stringify(Object.assign({}, BGP.DEFAULT_SETTINGS, { ballSize: 1.6 }))); BGMeta.D.tutorialSkipped = true; BGMeta.save(); });
  await page.reload(); await page.waitForTimeout(600);
  await page.evaluate(() => __api.startMatch({ mode: '2p', maps: ['giant'], mods: false, items: false, weather: false, beginner: true, fmt: 'p10' }));
  await page.waitForTimeout(1900);
  // roll the giant ball into the right-hand goal
  await page.evaluate(() => { const w = __game.world, b = w.ball, A = w.arena; w.players[2].x = 760; w.players[3].x = 880; b.x = b.prevX = BGP.W - A.goalD - A.P.ballR - 140; b.y = b.prevY = BGP.GROUND - A.P.ballR; b.vx = 900; b.vy = 0; b.touchT[0] = w.time - 0.4; });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.resolve(__dirname, '../shots6/giant_rolling.png') });
  for (let i = 0; i < 40; i++) { await page.waitForTimeout(100); if (await page.evaluate(() => __game.state === 'scored')) break; }
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.resolve(__dirname, '../shots6/giant_goal.png') });
  console.log(await page.evaluate(() => ({ st: __game.state, score: __game.score, R: __game.world.arena.P.ballR | 0, goal: __game.world.arena.goalD + 'x' + (__game.world.arena.goalH | 0) })), 'errors', errs);
  await page.evaluate(() => localStorage.removeItem('bgp_settings'));
  await browser.close();
})();
