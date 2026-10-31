// pausing (X button, Android back) while the screen fades between rounds must not leave a white screen
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await (await browser.newContext({ viewport: { width: 800, height: 380 }, hasTouch: true, isMobile: true })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PE ' + String(e.stack || e)));
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.waitForTimeout(400);
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('bgp_prefs')); p.hlAsked = true; localStorage.setItem('bgp_prefs', JSON.stringify(p)); });
  await page.reload(); await page.waitForTimeout(400);
  await page.tap('[data-act="skipTutorial"]:visible');
  const ev = (f, a) => page.evaluate(f, a);
  let fails = 0;
  const check = (name, ok, info) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info ? '  ' + info : '')); };
  const st = () => ev(() => ({ state: __game.state, fade: +__game.fade.toFixed(2), dir: __game.fadeDir, round: __game.round }));
  // step until a condition holds (frames of 1/60 s)
  const until = (cond, max) => ev(o => { const f = new Function('G', 'return ' + o.cond); for (let i = 0; i < o.max; i++) { if (f(__game)) return true; __api.step(1 / 60); } return f(__game); }, { cond, max: max || 3000 });
  async function scoreAndPauseInFade(how, replay) {
    await ev(() => __api.startMatch({ mode: '2p', fmt: 'p9', maps: ['soccer'], mods: false, items: false, weather: false }));
    await until("G.state === 'play'");
    await ev(() => { const w = __game.world; w.ball.touchT[0] = w.time - 1; __api.onScore(0); });
    // the fade to the next round: after the replay (it fades out when it ends), or straight after the celebration
    const ok = await until(replay ? "G.state === 'scored' && G.fadeDir === 1 && !G.replay && G.fade > 0.05" : "G.state === 'scored' && G.fadeDir === 1 && G.fade > 0.05");
    const round = (await st()).round;
    if (how === 'X') await page.tap('#pauseBtn'); else await ev(() => window.__back());
    const paused = await st();
    await ev(() => __api.step(1 / 60, 90)); // 1.5 s in the pause menu
    await page.tap('[data-act="resume"]:visible');
    await ev(() => __api.step(1 / 60, 150));
    const after = await st();
    await page.screenshot({ path: path.resolve(__dirname, '../shots10/' + how + (replay ? '_replay' : '') + '.png') });
    return { ok, paused, after, round };
  }
  let r = await scoreAndPauseInFade('X', true);
  check('a. X during the fade after the replay: the next round goes on', r.ok && r.paused.state === 'paused' && r.after.round === r.round + 1 && r.after.fade < 0.05 && r.after.state !== 'scored',
    JSON.stringify({ paused: r.paused, after: r.after }));
  // the same without replays (settings)
  await ev(() => __api.toMenu());
  await page.tap('[data-act="settings"]'); await page.tap('#tgReplay'); await page.tap('[data-act="back"]:visible');
  r = await scoreAndPauseInFade('X', false);
  check('b. X during the fade straight after a point (replays off)', r.ok && r.after.round === r.round + 1 && r.after.fade < 0.05, JSON.stringify({ paused: r.paused, after: r.after }));
  r = await scoreAndPauseInFade('back', false);
  check('c. Android back during that fade', r.ok && r.after.round === r.round + 1 && r.after.fade < 0.05, JSON.stringify({ paused: r.paused, after: r.after }));
  await ev(() => __api.toMenu());
  await page.tap('[data-act="settings"]'); await page.tap('#tgReplay'); await page.tap('[data-act="back"]:visible');
  // pausing while the new round fades in
  await ev(() => __api.startMatch({ mode: '2p', fmt: 'p9', maps: ['soccer'], mods: false, items: false, weather: false }));
  await ev(() => __api.step(1 / 60, 3));
  await page.tap('#pauseBtn');
  await ev(() => __api.step(1 / 60, 60));
  await page.tap('[data-act="resume"]:visible');
  await ev(() => __api.step(1 / 60, 150));
  const s2 = await st();
  check('d. X while a round fades in', s2.state === 'play' && s2.fade === 0, JSON.stringify(s2));
  // ✖ in a highlight, right while it fades from one clip to the next
  await ev(() => __api.startMatch({ mode: 'team4', slots: ['b', 'b', 'b', 'b'], level: 'hard', fmt: 'p2', maps: ['soccer'], mods: false, items: false, weather: false }));
  await until("G.state === 'over'", 60000);
  await page.waitForTimeout(300);
  await page.tap('#overTools [data-act="hlWatch"]');
  await ev(() => { __api.step(1 / 60, 30); __game.fadeDir = 1; __api.step(1 / 60, 8); }); // half way to white
  await page.tap('#hlClose');
  await ev(() => __api.step(1 / 60, 60));
  const s3 = await st();
  check('e. ✖ in a highlight during a fade between clips', s3.state === 'over' && s3.fade === 0, JSON.stringify(s3));
  console.log(errs.length ? 'ERRORS ' + errs.join('\n') : 'no page errors');
  console.log(fails ? fails + ' FAILED' : 'all checks passed');
  await browser.close();
})();
