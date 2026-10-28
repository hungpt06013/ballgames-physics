const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const out = path.resolve(__dirname, '../shots');
  const errs = [];
  for (const [vw, vh, dpr, tagName] of [[800, 380, 2, 'phone'], [640, 300, 3, 'small']]) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(String(e)));
    await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
    await page.evaluate(() => localStorage.setItem('bgp_prefs', JSON.stringify({ maps: ['soccer'], target: 5, level: 'hard', sound: true })));
    await page.reload(); await page.waitForTimeout(600);
    for (const mode of ['ffa', '2p']) {
      await page.tap('[data-act="' + mode + '"]');
      await page.waitForTimeout(2200);
      await page.keyboard.down('KeyG'); await page.waitForTimeout(200); await page.keyboard.up('KeyG');
      await page.waitForTimeout(250);
      // freeze the action, then throw two players far above the screen
      await page.evaluate(() => { const G = __game; G.state = 'paused';
        const pl = G.world.players; pl[1].y = -260; pl[3].y = -420; pl[3].x = 1250; G.world.ball.y = -300; G.world.ball.x = 900;
        for (const p of pl) BGP.shapes(p); });
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${out}/marks_${mode}_${tagName}.png` });
      await page.evaluate(() => { __game.state = 'play'; });
      await page.tap('#pauseBtn'); await page.waitForTimeout(200);
      await page.tap('#pause [data-act="toMenu"]'); await page.waitForTimeout(400);
    }
    await ctx.close();
  }
  console.log('errors', errs);
  await browser.close();
})();
