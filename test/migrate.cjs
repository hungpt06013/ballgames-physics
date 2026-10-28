const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await (await browser.newContext({ viewport: { width: 800, height: 380 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.stack || e)));
  await page.goto('file://' + path.resolve(__dirname, process.env.PAGE || '../www/index.html'));
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('bgp_prefs', JSON.stringify({ level: 'hard', fmt: 'p5', sport: 'hockey', mods: true, items: true, beginner: false, slots: ['h', 'h', 'h', 'h'], replay: true, music: true, sound: true, maps: ['sumo', 'dodge', 'hockey', 'shuttle'], knownMaps: ['soccer'] }));
    localStorage.setItem('bgp_meta', JSON.stringify({ coins: 120, stars: { empty: 3 }, best: { empty: 2 }, tourney: { size: 4 }, stats: { cups: 2, played: 5 }, tutorialSkipped: true }));
  });
  await page.reload(); await page.waitForTimeout(700);
  console.log(await page.evaluate(() => ({ prefs: JSON.parse(localStorage.getItem('bgp_prefs')), coins: BGMeta.coins(), meta: Object.keys(BGMeta.D), played: BGMeta.stats().played, cups: BGMeta.stats().cups })));
  await page.click('[data-act="setup"][data-mode="2p"]'); await page.click('[data-act="start"]:visible'); await page.waitForTimeout(2000);
  console.log('map', await page.evaluate(() => __game.world.arena.map.id), 'errors', errs);
  await browser.close();
})();
