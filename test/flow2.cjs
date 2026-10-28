const { chromium } = require('playwright');
const path = require('path');
const SH = path.resolve(__dirname, '../shots2');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 380 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.stack || e)));
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.waitForTimeout(600);
  const ev = (f, a) => page.evaluate(f, a);
  const st = () => ev(() => ({ st: __game.state, screen: __game.screen, txt: document.getElementById('resultText').textContent, score: document.getElementById('resultScore').textContent }));
  // time mode: leader when the clock ends
  await ev(() => __api.startMatch({ mode: '2p', fmt: 't120', maps: ['soccer'], mods: false }));
  await page.waitForTimeout(1800);
  await ev(() => { __game.score = [2, 1]; __game.clock = 1; });
  await page.waitForTimeout(1500);
  console.log('time end', JSON.stringify(await st()));
  await page.screenshot({ path: SH + '/41_time_over.png' });
  // golden goal decides
  await ev(() => __api.startMatch({ mode: 'ffa', fmt: 't120', maps: ['soccer'], mods: false, slots: ['h', 'h', 'h', 'h'] }));
  await page.waitForTimeout(1800);
  await ev(() => { __game.score = [1, 1, 0, 0]; __game.clock = 0.5; });
  await page.waitForTimeout(1200);
  // v2.5: time up level -> everybody votes; all four want the golden goal
  for (let i = 1; i <= 4; i++) await page.tap('#voteRows .voteRow:nth-child(' + i + ') .voteBtn[data-v="gold"]');
  await page.waitForTimeout(1200);
  console.log('golden?', JSON.stringify(await ev(() => ({ st: __game.state, golden: __game.golden }))));
  await ev(() => { __game.world.credit = 1; __game.world.ball.lastBy = [1, -1]; __api.onScore(0); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: SH + '/42_ffa_scored.png' });
  await page.waitForTimeout(2200);
  await page.touchscreen.tap(400, 100);
  await page.waitForTimeout(1500);
  console.log('golden end', JSON.stringify(await st()));
  // v2.5: the first finished match asks once how to keep highlights
  if (await ev(() => !document.getElementById('dialog').classList.contains('hidden'))) { await page.tap('#dlgBtns .btn'); await page.waitForTimeout(300); }
  await page.screenshot({ path: SH + '/43_ffa_over.png' });
  // pause / resume / back
  await ev(() => __api.startMatch({ mode: 'bot', fmt: 'p5', maps: ['basket'], mods: false }));
  await page.waitForTimeout(1800);
  await page.tap('#pauseBtn'); await page.waitForTimeout(200);
  console.log('paused', JSON.stringify(await st()));
  await page.screenshot({ path: SH + '/44_pause.png' });
  console.log('back->', await ev(() => window.__back()), JSON.stringify(await st()));
  console.log('back->', await ev(() => window.__back()), JSON.stringify(await st()));
  await page.tap('[data-act="toMenu"]:visible'); await page.waitForTimeout(300);
  console.log('menu', JSON.stringify(await st()));
  await page.tap('[data-act="shop"]:visible'); await page.waitForTimeout(200);
  console.log('back from shop', await ev(() => window.__back()), JSON.stringify(await st()));
  console.log('back from menu', await ev(() => window.__back()));
  // keyboard 2p
  await ev(() => __api.startMatch({ mode: '2p', fmt: 'p5', maps: ['soccer'], mods: false }));
  await page.waitForTimeout(1800);
  await page.keyboard.down('KeyA'); await page.waitForTimeout(100);
  const k1 = await ev(() => [__game.world.players[0].press, __game.world.players[2].press]);
  await page.keyboard.up('KeyA'); await page.keyboard.down('KeyL'); await page.waitForTimeout(100);
  const k2 = await ev(() => [__game.world.players[0].press, __game.world.players[2].press]);
  await page.keyboard.up('KeyL');
  console.log('keys A ->', k1, 'L ->', k2);
  console.log('errors', errs);
  await browser.close();
})();
