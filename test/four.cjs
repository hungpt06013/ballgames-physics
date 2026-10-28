const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 380 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const url = 'file://' + path.resolve(__dirname, '../www/index.html');
  await page.goto(url);
  await page.evaluate(() => localStorage.setItem('bgp_prefs', JSON.stringify({ maps: ['soccer'], target: 2, level: 'hard', sound: true })));
  await page.reload();
  await page.waitForTimeout(700);
  const out = path.resolve(__dirname, '../shots');
  await page.screenshot({ path: out + '/menu4.png' });
  for (const mode of (process.env.MODES || 'ffa,team4').split(',')) {
    await page.tap('[data-act="' + mode + '"]');
    await page.waitForTimeout(1800);
    // tap each quadrant and check which player jumps
    const quads = [[100, 300], [100, 80], [700, 300], [700, 80]];
    const who = [];
    for (const [x, y] of quads) {
      await page.waitForTimeout(1100);
      const before = await page.evaluate(() => __game.world.players.map(p => p.jumpT > 0 || p.cT > 0.05));
      await page.touchscreen.tap(x, y);
      await page.waitForTimeout(40);
      const after = await page.evaluate(() => __game.world.players.map(p => p.jumpT > 0 || p.vy < -300));
      who.push(after.map((a, i) => a && !before[i] ? i + 1 : 0).filter(Boolean));
    }
    console.log(mode, 'quadrant taps -> players', JSON.stringify(who));
    await page.keyboard.down('KeyG'); await page.waitForTimeout(120); await page.keyboard.up('KeyG');
    await page.waitForTimeout(150);
    await page.screenshot({ path: out + '/game_' + mode + '.png' });
    // P2 (players[1]) touches the ball last, then it goes in the right goal -> red side scores
    const r1 = await page.evaluate(() => { const w = __game.world, b = w.ball; b.lastBy[0] = 1; b.lastBy[1] = -1; b.x = BGP.W - 70; b.y = BGP.GROUND - 40; b.vx = 300; b.vy = 0; return 0; });
    await page.waitForTimeout(500);
    await page.screenshot({ path: out + '/scored_' + mode + '.png' });
    const s1 = await page.evaluate(() => __game.score.slice());
    await page.waitForTimeout(3200);
    // own goal by blue with no red touch -> ffa: nobody scores
    await page.evaluate(() => { const w = __game.world, b = w.ball; b.lastBy[0] = -1; b.lastBy[1] = 2; b.x = BGP.W - 70; b.y = BGP.GROUND - 40; b.vx = 300; b.vy = 0; });
    await page.waitForTimeout(600);
    const s2 = await page.evaluate(() => __game.score.slice());
    await page.waitForTimeout(3200);
    await page.evaluate(() => { const w = __game.world, b = w.ball; b.lastBy[0] = 1; b.x = BGP.W - 70; b.y = BGP.GROUND - 40; b.vx = 300; b.vy = 0; });
    await page.waitForTimeout(3500);
    const st = await page.evaluate(() => ({ state: __game.state, score: __game.score, txt: document.getElementById('resultText').textContent, sc: document.getElementById('resultScore').textContent }));
    console.log(mode, 'after P2 goal', s1, 'after own goal', s2, 'final', JSON.stringify(st));
    await page.screenshot({ path: out + '/over_' + mode + '.png' });
    await page.tap('#over [data-act="toMenu"]');
    await page.waitForTimeout(500);
  }
  console.log('errors', errs);
  await browser.close();
})();
