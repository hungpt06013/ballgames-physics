// Bots in 2-player / 4-player / 2 vs 2 matches: any slot can be a bot (all four too: a match to watch), each bot with
// its own level - set by tapping its chip in the match setup (person -> bot Dễ -> Thường -> Khó -> person)
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  const page = await (await browser.newContext({ viewport: { width: 780, height: 360 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.stack || e)));
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.waitForTimeout(400);
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('bgp_prefs') || '{}'); p.hlAsked = true; p.hlMode = 'none'; localStorage.setItem('bgp_prefs', JSON.stringify(p)); });
  await page.reload(); await page.waitForTimeout(400);
  let fails = 0;
  const check = (name, ok, info) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== undefined ? '  ' + info : '')); };
  const ev = f => page.evaluate(f);

  const setup = await ev(() => {
    document.querySelector('[data-act="setup"][data-mode="team4"]').click();
    const chips = () => Array.from(document.querySelectorAll('#slotBtns button')).map(b => b.textContent), b = () => document.querySelectorAll('#slotBtns button');
    const seen = [chips()[0]];
    for (let k = 0; k < 4; k++) { b()[0].click(); seen.push(chips()[0]); }
    for (let i = 0; i < 4; i++) for (let k = 0; k < [1, 2, 3, 3][i]; k++) b()[i].click();
    return { seen, all: chips(), shared: !document.getElementById('rowLevel').classList.contains('hidden') };
  });
  check('a chip goes person -> bot Dễ -> Thường -> Khó -> person', /^🙋/.test(setup.seen[0]) && /Bot Dễ/.test(setup.seen[1]) && /Bot Thường/.test(setup.seen[2]) && /Bot Khó/.test(setup.seen[3]) && /^🙋/.test(setup.seen[4]), JSON.stringify(setup.seen));
  check('all four can be bots, each at its own level; no shared level row', JSON.stringify(setup.all) === JSON.stringify(['🤖 P1 Bot Dễ', '🤖 P2 Bot Thường', '🤖 P3 Bot Khó', '🤖 P4 Bot Khó']) && !setup.shared, JSON.stringify(setup.all));

  // 2 vs 2, four bots (from the setup just made): it plays itself to the end
  const t4 = await ev(() => {
    const G = __game;
    __api.startMatch({ mode: 'team4', fmt: 'p2', maps: ['soccer'], mods: false, items: false, weather: false });
    const lv = G.bots.map(b => b && b.level);
    let n = 0; while (G.state !== 'over' && n < 60 * 400) { __api.step(1 / 60); n++; }
    return { lv, state: G.state, names: G.lastHL ? G.lastHL.match.names : null, reward: document.getElementById('resultReward').textContent };
  });
  check('2 vs 2 with four bots plays itself to the end, each bot at its level', t4.state === 'over' && JSON.stringify(t4.lv) === JSON.stringify(['easy', 'normal', 'hard', 'hard']), JSON.stringify(t4));
  check('...named by their levels, and no coins for a match of bots only', JSON.stringify(t4.names) === JSON.stringify(['🤖 Bot Dễ + 🤖 Bot Thường', '🤖 Bot Khó ×2']) && t4.reward === '', JSON.stringify(t4.names) + ' ' + JSON.stringify(t4.reward));

  // 2 players: the right side a bot (Khó); a tap on the right half moves the person on the left
  await ev(() => { __api.startMatch({ mode: '2p', fmt: 'p9', maps: ['soccer'], mods: false, items: false, weather: false, slots2: ['h', 'b'], levels2: ['easy', 'hard'] }); __api.step(1 / 60, 110); });
  const y0 = await ev(() => __game.world.players[0].y);
  await page.mouse.move(700, 200); await page.mouse.down(); await page.waitForTimeout(120); await page.mouse.up(); await page.waitForTimeout(300);
  const p2 = await ev(() => ({ bots: __game.bots.map(Boolean), lv: __game.botLv, y: __game.world.players[0].y, names: [0, 1].map(i => __game.bots[i] ? 'bot' : 'person') }));
  check('2 players: one side a bot at its level', JSON.stringify(p2.bots) === JSON.stringify([false, true, false, false]) && p2.lv[1] === 'hard', JSON.stringify(p2));
  check('...a tap on the bot\'s half moves the person', p2.y < y0 - 20, 'y ' + y0.toFixed(0) + ' -> ' + p2.y.toFixed(0));

  // 2 players, both bots, time up level: golden goal at once (nobody to vote)
  const gold = await ev(() => {
    const G = __game;
    __api.startMatch({ mode: '2p', fmt: 't30', maps: ['soccer'], mods: false, items: false, weather: false, slots2: ['b', 'b'], levels2: ['normal', 'hard'] });
    __api.step(1 / 60, 110); G.clock = 0.05; G.score = [1, 1];
    let n = 0, vote = false; while (G.state !== 'over' && n < 60 * 300) { __api.step(1 / 60); if (G.state === 'vote') vote = true; n++; }
    return { golden: G.golden, vote, state: G.state };
  });
  check('bots only, time up level: straight to the golden goal, no vote', gold.golden && !gold.vote && gold.state === 'over', JSON.stringify(gold));
  const hist = await ev(() => JSON.parse(localStorage.getItem('bgp_history') || '[]').slice(0, 2).map(x => ({ mode: x.mode, levels: x.levels })));
  check('history keeps each bot\'s level', hist[0] && hist[0].mode === '2p' && hist[0].levels[0] === 'normal' && hist[0].levels[1] === 'hard' && hist[1].levels[0] === 'easy', JSON.stringify(hist));
  check('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(fails ? fails + ' FAILED' : 'all checks passed');
  await browser.close();
})();
