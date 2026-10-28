const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 380 }, deviceScaleFactor: 2.5, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.waitForTimeout(500);
  for (const sport of (process.env.SPORTS || 'soccer,basket,bomb,volley,moon').split(',')) {
    await page.evaluate(s => __api.startMatch({ mode: 'bot', maps: [s], mods: false, items: true, level: 'easy' }), sport);
    await page.waitForTimeout(1700);
    const r = await page.evaluate(async () => {
      const D = BGDraw, T = {};
      const wrap = k => { const f = D[k]; D[k] = function () { const t0 = performance.now(); const r = f.apply(this, arguments); T[k] = (T[k] || 0) + performance.now() - t0; return r; }; return () => { D[k] = f; }; };
      const un = ['background', 'structures', 'player', 'ball', 'trail', 'item', 'wind', 'shields', 'textOutlined', 'emoji'].map(wrap);
      const n0 = performance.now(); let frames = 0;
      await new Promise(res => { const f = () => { frames++; if (performance.now() - n0 < 3000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
      un.forEach(u => u());
      const o = {}; for (const k in T) o[k] = (T[k] / frames).toFixed(2); o.ren = __game.perfRen.toFixed(2); o.upd = __game.perfUpd.toFixed(2); o.frames = frames; return o;
    });
    console.log(sport, JSON.stringify(r));
  }
  await browser.close();
})();
