const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 380 }, deviceScaleFactor: 2.5, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../BallgamesPhysics.html'));
  await page.evaluate(() => localStorage.setItem('bgp_prefs', JSON.stringify({ maps: ['soccer', 'giant'], target: 5, level: 'hard', sound: true })));
  await page.reload();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: +(process.env.THROTTLE || 4) });
  await page.waitForTimeout(800);
  await page.tap('[data-act="bot"]');
  await page.waitForTimeout(1800);
  // frame timing probe
  await page.evaluate(() => { window.__ft = []; let last = performance.now(); const f = (t) => { window.__ft.push(t - last); last = t; if (window.__ft.length < 2000) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  const st0 = await page.evaluate(() => ({ state: __game.state, p0y: __game.world.players[0].y }));
  // tap the screen a few times like a player
  let jumps = 0;
  for (let i = 0; i < 25; i++) {
    const before = await page.evaluate(() => __game.world.players[1].cT);
    await page.touchscreen.tap(200 + (i % 3) * 150, 200);
    await page.waitForTimeout(60);
    const after = await page.evaluate(() => ({ vy: __game.world.players[1].vy, cT: __game.world.players[1].cT }));
    if (before < 0.07 && after.cT > 0.03) jumps++;
    await page.waitForTimeout(260);
  }
  const res = await page.evaluate(() => {
    const ft = window.__ft.slice(5).sort((a, b) => a - b);
    const q = p => ft[Math.floor(p * (ft.length - 1))].toFixed(1);
    return { frames: ft.length, p50: q(0.5), p90: q(0.9), p99: q(0.99), max: q(1), level: __game.bot.level, state: __game.state, score: __game.score, round: __game.round, map: __game.world.arena.map.id };
  });
  console.log('start', st0, 'red jumps seen', jumps, res);
  await page.screenshot({ path: path.resolve(__dirname, '../shots/play_bot.png') });
  // force the end of a match
  await page.evaluate(() => { __game.score = [4, 3]; __game.target = 5; });
  await page.evaluate(() => { const b = __game.world.ball; b.x = BGP.W - 70; b.y = BGP.GROUND - 40; b.vx = 300; b.vy = 0; });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.resolve(__dirname, '../shots/scored.png') });
  await page.waitForTimeout(3500);
  const over = await page.evaluate(() => ({ state: __game.state, score: __game.score, txt: document.getElementById('resultText').textContent, overVisible: !document.getElementById('over').classList.contains('hidden') }));
  console.log('after forced goal', over);
  await page.screenshot({ path: path.resolve(__dirname, '../shots/over.png') });
  // back handler from the over screen -> menu, from menu -> false (exit)
  console.log('back from over ->', await page.evaluate(() => window.__back()), await page.evaluate(() => __game.state));
  console.log('back from menu ->', await page.evaluate(() => window.__back()));
  // 2 player: left half and right half touches
  await page.tap('[data-act="2p"]');
  await page.waitForTimeout(1900);
  await page.touchscreen.tap(100, 200); await page.waitForTimeout(30);
  const p2a = await page.evaluate(() => [__game.world.players[0].vy.toFixed(0), __game.world.players[2].vy.toFixed(0)]);
  await page.waitForTimeout(900);
  await page.touchscreen.tap(700, 200); await page.waitForTimeout(30);
  const p2b = await page.evaluate(() => [__game.world.players[0].vy.toFixed(0), __game.world.players[2].vy.toFixed(0)]);
  console.log('2p left tap vy(red,blue)', p2a, 'right tap', p2b);
  // pause via button and back
  await page.tap('#pauseBtn'); await page.waitForTimeout(200);
  console.log('paused', await page.evaluate(() => __game.state), 'back->', await page.evaluate(() => window.__back()), await page.evaluate(() => __game.state));
  console.log('errors', errs);
  await browser.close();
})();
