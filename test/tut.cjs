const { chromium } = require('playwright');
const path = require('path');
const SH = path.resolve(__dirname, '../shots2');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 380 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PE ' + String(e.stack || e)));
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.waitForTimeout(600);
  await page.tap('[data-act="tutorial"]:visible'); await page.waitForTimeout(700);
  // step 0: tap
  await page.touchscreen.tap(400, 200); await page.waitForTimeout(2200);
  const s1 = await page.evaluate(() => ({ tut: __game.tut, ball: [__game.world.ball.x | 0, __game.world.ball.y | 0], p: [__game.world.players[1].x | 0, __game.world.players[1].f] }));
  console.log('after step0', JSON.stringify(s1));
  await page.screenshot({ path: SH + '/92_tut_step1.png' });
  // step 1: tap -> kick
  await page.touchscreen.tap(400, 200); await page.waitForTimeout(400);
  console.log('after kick', JSON.stringify(await page.evaluate(() => __game.tut)));
  await page.waitForTimeout(1200);
  // step 2: hold for a long time while in the air
  for (let k = 0; k < 3; k++) {
    if (await page.evaluate(() => __game.state !== 'play')) break;
    await page.evaluate(() => { const t = document.getElementById('touch'); const o = { pointerId: 9, clientX: 400, clientY: 200, bubbles: true }; t.dispatchEvent(new PointerEvent('pointerdown', o)); });
    await page.waitForTimeout(1600);
    await page.evaluate(() => { const t = document.getElementById('touch'); t.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, bubbles: true })); });
    await page.waitForTimeout(1500);
  }
  console.log('after hold', JSON.stringify(await page.evaluate(() => ({ tut: __game.tut, st: __game.state, txt: document.getElementById('resultText').textContent, coins: BGMeta.coins() }))));
  await page.screenshot({ path: SH + '/93_tut_done.png' });
  console.log('errors', errs);
  await browser.close();
})();
