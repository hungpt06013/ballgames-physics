// highlight size per whole match for typical settings (bots play every side)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await (await browser.newContext({ viewport: { width: 800, height: 380 } })).newPage();
  page.on('pageerror', e => console.log('PE', e.message));
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.waitForTimeout(500);
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('bgp_prefs')); p.hlAsked = true; p.hlMode = 'all'; localStorage.setItem('bgp_prefs', JSON.stringify(p)); });
  await page.reload(); await page.waitForTimeout(500);
  const cases = [
    { mode: 'team4', slots: ['b', 'b', 'b', 'b'], level: 'hard', fmt: 'p5', maps: ['soccer'], mods: true, items: true, weather: false },
    { mode: 'team4', slots: ['b', 'b', 'b', 'b'], level: 'hard', fmt: 'p10', mods: true, items: true, weather: true },
    { mode: 'ffa', slots: ['b', 'b', 'b', 'b'], level: 'normal', fmt: 'p5', mods: true, items: true, weather: true },
    { mode: 'team4', slots: ['b', 'b', 'b', 'b'], level: 'hard', fmt: 't180', mods: true, items: true, weather: true }
  ];
  for (const c of cases) {
    await page.evaluate(c => __api.startMatch(Object.assign({ maps: ['soccer', 'basket', 'football', 'volley', 'moon', 'ice', 'giant', 'bomb'] }, c)), c);
    let st;
    for (let i = 0; i < 400; i++) {
      st = await page.evaluate(() => { for (let i = 0; i < 600; i++) { if (__game.state === 'over') break; if (__game.state === 'vote') { __game.golden = true; __game.state = 'play'; } __api.step(1 / 60); } return __game.state; });
      if (st === 'over') break;
    }
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => { const r = BGHL.history()[0], hl = __game.lastHL; return { score: r.score.join('-'), dur: r.dur, goals: r.goals.length, bytes: r.hl && r.hl.bytes, clips: hl.clips.map(c => c.kind[0] + (c.n > 1 ? c.n : '')).join(''), secs: hl.clips.reduce((a, c) => a + c.frames.length / 90 / 30, 0).toFixed(0), raw: hl.clips.reduce((a, c) => a + c.frames.byteLength, 0) }; });
    console.log(c.mode, c.fmt, c.weather ? 'weather' : '', JSON.stringify(r), 'KB=' + (r.bytes / 1024).toFixed(0), 'raw KB=' + (r.raw / 1024).toFixed(0));
  }
  await browser.close();
})();
