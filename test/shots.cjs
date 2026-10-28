const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  const ctx = await browser.newContext({ viewport: { width: 860, height: 400 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const url = 'file://' + path.resolve(__dirname, '../www/index.html');
  await page.goto(url);
  await page.waitForTimeout(1500);
  const out = path.resolve(__dirname, '../shots');
  await page.screenshot({ path: out + '/menu.png' });
  await page.click('[data-act="settings"]'); await page.waitForTimeout(300);
  await page.screenshot({ path: out + '/settings.png' });
  await page.click('[data-act="closeSettings"]');
  await page.click('[data-act="help"]'); await page.waitForTimeout(300);
  await page.screenshot({ path: out + '/help.png' });
  await page.click('[data-act="closeHelp"]');
  await page.click('[data-act="2p"]'); await page.waitForTimeout(600);
  await page.screenshot({ path: out + '/intro.png' });
  // play each map: force map by editing queue
  const maps = await page.evaluate(() => window.BGP.MAPS.map(m => m.id));
  for (const id of maps) {
    await page.evaluate((id) => { const G = window.__game; G.queue = [id]; G.qi = 0; G.round = 0; G.score=[0,0]; }, id);
    await page.evaluate(() => { const G = window.__game; G.state = 'scored'; G.scorer = 0; G.timer = 0; G.fade = 0; G.fadeDir = 1; });
    await page.waitForTimeout(2300);
    // hold red, then blue alternately for a bit
    await page.keyboard.down('KeyA'); await page.waitForTimeout(250); await page.keyboard.up('KeyA');
    await page.keyboard.down('KeyL'); await page.waitForTimeout(150);
    await page.screenshot({ path: out + '/map_' + id + '.png' });
    await page.keyboard.up('KeyL');
  }
  console.log('errors:', errs);
  await browser.close();
})();
