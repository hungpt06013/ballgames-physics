const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  for (const [mode, dpr, thr] of [['bot', 2.5, 4], ['2p', 2.5, 4], ['bot', 1, 4], ['bot', 2.5, 1]]) {
    const ctx = await browser.newContext({ viewport: { width: 800, height: 380 }, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: thr });
    await page.waitForTimeout(500);
    await page.evaluate((m) => document.querySelector('[data-act="' + m + '"]').click(), mode);
    await page.waitForTimeout(6000);
    const r = await page.evaluate(() => ({ upd: __game.perfUpd.toFixed(2), ren: __game.perfRen.toFixed(2), lvl: __game.bot && __game.bot.level, map: __game.world.arena.map.id }));
    console.log(mode, 'dpr', dpr, 'cpu x' + thr, r);
    await ctx.close();
  }
  await browser.close();
})();
