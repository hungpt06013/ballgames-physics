// replay speed: normal until the slow motion starts, then slow all the way through the goal to the end
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await (await browser.newContext({ viewport: { width: 800, height: 380 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.waitForTimeout(600);
  for (const flight of [0.3, 3.5]) {
    await page.evaluate(() => { BGMeta.D.tutorialSkipped = true; __api.startMatch({ mode: '2p', maps: ['soccer'], mods: false, items: false, weather: false, fmt: 'p10' }); });
    await page.waitForTimeout(1800 + 6000);
    // the scoring side's last touch was `flight` seconds before the goal
    await page.evaluate(f => { const w = __game.world, b = w.ball; b.touchT[0] = w.time - f; __api.onScore(0); }, flight);
    const log = [];
    for (let i = 0; i < 400; i++) {
      await page.waitForTimeout(40);
      const r = await page.evaluate(() => __game.state === 'replay' && __game.replay ? { k: __game.replay.k, sp: __game.replay.speed, goal: __game.replay.goal, from: __game.replay.from, to: __game.replay.to, sf: __game.replay.slowFrom } : null);
      if (r) log.push(r); else if (log.length) break;
    }
    // after the first moment the replay is slow, is it ever back at normal speed?
    let slowed = -1, fastAgain = false;
    log.forEach((r, i) => { if (slowed < 0 && r.sp < 0.5) slowed = i; else if (slowed >= 0 && r.sp > 0.6) fastAgain = true; });
    const last = log[log.length - 1], first = log[0];
    console.log(`shot ${flight}s before goal: replay frames ${first.from}-${first.to}, goal ${first.goal}, slow from ${first.sf} (${((first.goal - first.sf) / 120).toFixed(2)} s before goal) | slow reached at k=${slowed >= 0 ? log[slowed].k : '-'} | speeds up again: ${fastAgain} | speed at end ${last.sp.toFixed(2)}`);
  }
  console.log('errors', errs);
  await browser.close();
})();
