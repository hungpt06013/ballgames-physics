const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 380 }, deviceScaleFactor: 2.5, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: +(process.env.THROTTLE || 4) });
  await page.waitForTimeout(800);
  for (const cfg of [{ mode: 'bot', maps: ['soccer'] }, { mode: 'ffa', maps: ['soccer'], slots: ['h', 'b', 'b', 'b'] }, { mode: 'team4', maps: ['basket'], slots: ['h', 'b', 'b', 'b'] }, { mode: 'team4', maps: ['bomb'], slots: ['h', 'b', 'b', 'b'] }]) {
    await page.evaluate(c => __api.startMatch(Object.assign({ level: 'hard', mods: false, items: true, fmt: 'p10' }, c)), cfg);
    await page.waitForTimeout(1800);
    await page.evaluate(() => { window.__ft = []; let last = performance.now(); const f = t => { __ft.push(t - last); last = t; if (__ft.length < 100000) requestAnimationFrame(f); }; requestAnimationFrame(f); });
    await page.waitForTimeout(8000);
    const r = await page.evaluate(() => { const ft = __ft.slice(5).sort((a, b) => a - b); const q = p => ft[Math.floor(p * (ft.length - 1))].toFixed(1); return { n: ft.length, p50: q(0.5), p90: q(0.9), p99: q(0.99), upd: __game.perfUpd.toFixed(1), ren: __game.perfRen.toFixed(1), levels: [__game.bot].concat(__game.bots).map(b => b ? b.level : '-').join(','), sc: __game.score.join('-') }; });
    console.log(cfg.mode, cfg.maps.join(','), JSON.stringify(r));
  }
  console.log('errors', errs);
  await browser.close();
})();
