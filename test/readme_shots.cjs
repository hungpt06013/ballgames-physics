// screenshots for the README (docs/screens)
const { chromium } = require('playwright');
const path = require('path');
const OUT = path.resolve(__dirname, '../docs/screens');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await (await browser.newContext({ viewport: { width: 880, height: 410 }, deviceScaleFactor: 1.5, hasTouch: true, isMobile: true })).newPage();
  page.on('pageerror', e => console.log('PE', e.message));
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.waitForTimeout(700);
  const ev = (f, a) => page.evaluate(f, a);
  const shot = n => page.screenshot({ path: OUT + '/' + n + '.png' });
  await ev(() => { const p = JSON.parse(localStorage.getItem('bgp_prefs')); p.hlAsked = true; localStorage.setItem('bgp_prefs', JSON.stringify(p)); });
  await page.reload(); await page.waitForTimeout(700);
  await page.tap('[data-act="skipTutorial"]:visible');
  await page.waitForTimeout(1500);
  await shot('menu');
  await page.tap('[data-act="setup"][data-mode="bot"]'); await page.waitForTimeout(300);
  await page.tap('#tgWeather'); await page.waitForTimeout(200);
  await shot('setup');
  // matches played by bots, caught mid-action
  async function play(cfg, secs, name, before) {
    await ev(c => __api.startMatch(c), cfg);
    await ev(n => __api.step(1 / 60, n), Math.round(secs * 60));
    if (before) await ev(before);
    await page.waitForTimeout(250);
    await shot(name);
  }
  await play({ mode: 'team4', slots: ['b', 'b', 'b', 'b'], level: 'hard', fmt: 'p9', maps: ['soccer'], mods: false, items: true, weather: false }, 7, 'soccer_2v2');
  await play({ mode: 'bot', level: 'hard', fmt: 'p9', maps: ['basket'], mods: false, items: false, weather: false }, 6, 'basket');
  await play({ mode: 'team4', slots: ['b', 'b', 'b', 'b'], level: 'hard', fmt: 'p9', maps: ['giant'], mods: false, items: false, weather: true, wxList: ['tornado'] }, 4, 'giant_tornado',
    () => { __api.weather.start(__game.world, 'tornado'); __api.step(1 / 60, 120); });
  await play({ mode: 'ffa', slots: ['b', 'b', 'b', 'b'], level: 'hard', fmt: 'p9', maps: ['moon'], mods: false, items: false, weather: true, wxList: ['lightning'] }, 4, 'moon_lightning',
    () => { __api.weather.strike(__game.world, __game.world.players[2].x); __api.step(1 / 60, 30); });
  // a goal and its replay
  await ev(() => __api.startMatch({ mode: 'team4', slots: ['b', 'b', 'b', 'b'], level: 'hard', fmt: 'p9', maps: ['soccer'], mods: false, items: false, weather: false }));
  for (let i = 0; i < 60; i++) { const st = await ev(() => { for (let i = 0; i < 120 && __game.state !== 'replay'; i++) __api.step(1 / 60); return __game.state; }); if (st === 'replay') break; }
  await ev(() => { const r = __game.replay; r.k = Math.max(r.from, r.goal - 70); r.speed = 0.4; });
  await page.waitForTimeout(1200);
  await shot('replay');
  // whole match -> stats + highlight + history
  await ev(() => __api.startMatch({ mode: 'team4', slots: ['b', 'b', 'b', 'b'], level: 'hard', fmt: 'p5', maps: ['soccer', 'ice', 'basket', 'volley'], mods: true, items: true, weather: false }));
  for (let i = 0; i < 200; i++) { const st = await ev(() => { for (let i = 0; i < 600 && __game.state !== 'over'; i++) { if (__game.state === 'vote') { __game.golden = true; __game.state = 'play'; } __api.step(1 / 60); } return __game.state; }); if (st === 'over') break; }
  await page.waitForTimeout(1200);
  await shot('match_stats');
  await page.tap('#overTools [data-act="hlWatch"]');
  const si = await ev(() => __game.hlp.hl.clips.findIndex(c => c.kind === 'save'));
  if (si >= 0) {
    await ev(i => { __game.fade = 0; __game.fadeDir = 0; }, si);
    for (let i = 0; i < 40 && (await ev(() => __game.hlp.ci)) < si; i++) { await page.tap('#touch', { position: { x: 440, y: 200 } }); await page.waitForTimeout(450); }
    await ev(() => { const h = __game.hlp; h.k = Math.max(0, h.c.marks[0].t * 30 - 5); });
    await page.waitForTimeout(800);
    await shot('highlight_save');
  }
  await page.tap('#hlClose'); await page.waitForTimeout(400);
  await ev(() => __api.toMenu()); await page.waitForTimeout(300);
  await page.tap('[data-act="history"]'); await page.waitForTimeout(300);
  await page.tap('.hcard .hmain'); await page.waitForTimeout(300);
  await shot('history');
  await browser.close();
})();
