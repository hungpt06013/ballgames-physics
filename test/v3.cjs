// v3: near misses only when the ball really came close (not dropping on the roof of the goal, not still on its
// way when the look ends, not coming up under the ring); a bar hit and a ball just over the bar are near misses;
// names of the players (a bot by its level) over the highlight score and beside the match score;
// the new player screen (2 or 4 players, a tall card per player showing the match look)
const { chromium } = require('playwright');
const path = require('path');
const SH = path.resolve(__dirname, '../shots_v3');
(async () => {
  require('fs').mkdirSync(SH, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 380 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PE ' + String(e.stack || e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.waitForTimeout(500);
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('bgp_prefs')); p.hlAsked = true; p.hlMode = 'all'; localStorage.setItem('bgp_prefs', JSON.stringify(p)); });
  await page.reload(); await page.waitForTimeout(500);
  if (await page.$('[data-act="skipTutorial"]:visible')) await page.tap('[data-act="skipTutorial"]:visible');
  const ev = (f, a) => page.evaluate(f, a);
  let fails = 0;
  const check = (name, ok, info) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info ? '  ' + info : '')); };

  // --- near misses, on the ball's own flight (team 1 shoots at the left goal / ring / posts) ---
  const near = await ev(() => {
    const E = BGP, out = {};
    const arena = id => E.createWorld(id, null, 1).arena;
    const ball = (x, y, vx, vy) => ({ x, y, vx, vy, prevX: x, prevY: y, ang: 0, spin: 0 });
    const R = A => A.P.ballR;
    // soccer
    let A = arena('soccer');
    out.soccer = { R: R(A), goalD: A.goalD, goalTop: A.goalTop };
    // 1) a high ball dropping slowly onto the roof just behind the goal line (crosses the line far above the bar)
    let nr = E.ballNear(A, ball(A.goalD + 40, A.goalTop - 250, -150, 0), 2, 1);
    out.roof = { gap: nr.gap / R(A), score: nr.score };
    // 2) a ball rolling in so slowly that it is still on its way when the 2 s look ends
    let slow = null;
    for (let vx = -250; vx > -900; vx -= 5) {
      const b = ball(A.goalD + 700, E.GROUND - R(A), vx, 0);
      if (!E.ballFuture(A, b, 2) && E.ballFuture(A, b, 6)) { slow = vx; break; }
    }
    nr = slow === null ? null : E.ballNear(A, ball(A.goalD + 700, E.GROUND - R(A), slow, 0), 2, 1);
    out.rolling = nr && { vx: slow, gap: nr.gap / R(A), score: nr.score };
    // 3) a shot that hits the end of the crossbar
    out.bar = null;
    for (let dy = -160; dy < 60 && !out.bar; dy += 2) {
      nr = E.ballNear(A, ball(A.goalD + 320, A.goalTop + dy, -1000, 0), 2, 1);
      if (nr.score < 0 && Math.abs(nr.gap - R(A)) < 1e-6) out.bar = { dy, gap: nr.gap / R(A), y: Math.round(nr.y), x: Math.round(nr.x) };
    }
    // 4) shots from 700 px out aimed to pass h px (the ball's bottom) over the bar at the goal line
    const aim = (A, x0, xLine, yAt, vx) => { const t = Math.abs(x0 - xLine) / Math.abs(vx); return ball(x0, yAt, vx, -0.5 * A.P.gBall * t); };
    out.over = [15, 20, 45, 60, 120].map(h => { const n = E.ballNear(A, aim(A, 700, A.goalD, A.goalTop - R(A) - h, -1500), 2, 1); return [h, n.score === 1 ? 'in' : '', +(n.gap / R(A)).toFixed(2)]; });
    // basket: 5) coming up under the ring and falling back; 6) dropping onto the front of the rim from above
    A = arena('basket');
    const g = A.P.gBall, rise = 80 - 0.6 * R(A);
    nr = E.ballNear(A, ball(A.boardX + 70, A.rimY + 80, 0, -Math.sqrt(2 * g * rise)), 2, 1);
    out.under = { gap: nr.gap / R(A), score: nr.score };
    nr = E.ballNear(A, ball(A.rimFront + 8, A.rimY - 200, 0, 0), 2, 1);
    out.rim = { gap: nr.gap / R(A), score: nr.score };
    // football: 7) under the bar of the posts by a little, and by a lot
    A = arena('football');
    out.posts = [];
    for (const dy of [12, 20, 120]) { nr = E.ballNear(A, aim(A, A.postX + 400, A.postX, A.barY + dy, -1400), 2, 1); out.posts.push([dy, nr.score, +(nr.gap / R(A)).toFixed(2)]); }
    return out;
  });
  const NEAR = { goal: 1.9, hoop: 1.5, posts: 1.5 };
  check('high ball dropping onto the roof of the goal: no near miss', !(near.roof.gap <= NEAR.goal) && near.roof.score < 0, JSON.stringify(near.roof));
  check('ball still rolling in when the look ends: not taken as a near miss', near.rolling && !(near.rolling.gap <= NEAR.goal), JSON.stringify(near.rolling));
  check('shot off the end of the crossbar: near miss (one ball radius)', !!near.bar, JSON.stringify(near.bar));
  const ov = near.over, isNear = o => !o[1] && o[2] <= NEAR.goal;
  check('shots 15-20 px over the bar are near misses, 45 px or more over it are not', isNear(ov[0]) && isNear(ov[1]) && !isNear(ov[2]) && !isNear(ov[3]) && !isNear(ov[4]), JSON.stringify(ov));
  check('basket: ball coming up under the ring: no near miss', !(near.under.gap <= NEAR.hoop), JSON.stringify(near.under));
  check('basket: ball dropping onto the front of the rim: near miss', near.rim.score < 0 && near.rim.gap <= NEAR.hoop, JSON.stringify(near.rim));
  check('posts: just under the bar is a near miss, far under is not', near.posts[0][2] <= NEAR.posts && !(near.posts[2][2] <= NEAR.posts), JSON.stringify(near.posts));

  // in a real round: a ball dropping from high onto the roof gives no "SUÝT VÀO"
  const roofGame = await ev(() => {
    const E = BGP;
    __api.startMatch({ mode: '2p', fmt: 'p9', maps: ['soccer'], mods: false, items: false, weather: false });
    __api.step(1 / 60, 110);
    const w = __game.world, A = w.arena;
    w.players.forEach((p, i) => { p.x = [700, 760, 1460, 1540][i]; p.y = E.GROUND - E.COM_H * p.sc; p.vx = p.vy = 0; E.shapes(p); });
    const b = w.ball;
    b.x = b.prevX = A.goalD + 60; b.y = b.prevY = A.goalTop - 400; b.vx = -200; b.vy = 500; b.spin = 0;
    b.lastTeam = 1; b.lastBy[1] = 2; b.lastPid = 2; b.touchT[1] = w.time; b.lastAir = false;
    let minY = 1e9, roofX = null;
    for (let i = 0; i < 300 && __game.state === 'play'; i++) { __api.step(1 / 60); if (b.vy < 0 && roofX === null && b.y < A.goalTop) roofX = Math.round(b.x); }
    return { landedAt: roofX, misses: __game.hlm.misses.length, score: __game.score.join('-') };
  });
  check('a ball dropping onto the roof of the goal in a real round: no near-miss clip', roofGame.landedAt !== null && roofGame.landedAt < 165 && roofGame.misses === 0 && roofGame.score === '0-0', JSON.stringify(roofGame));

  // --- names ---
  await ev(() => { BGMeta.profile(0).name = 'Hùng'; BGMeta.profile(1).name = 'Lan'; BGMeta.profile(2).name = 'Minh'; BGMeta.profile(3).name = 'P4'; BGMeta.save(); });
  const names = await ev(() => {
    const out = {};
    // (a match with nothing worth showing keeps no highlight: give each one a made-up moment)
    const moment = () => __game.hlm.misses.push({ kind: 'miss', n: 1, by: [0], name: 'x', team: 0, beauty: 1, frames: new Int16Array(90 * 70),
      map: 'soccer', mods: {}, swap: false, round: 1, t: 1, marks: [{ t: 1, kind: 'miss', bi: 0, by: 0, team: 0, beauty: 1 }], slow: [] });
    __api.startMatch({ mode: 'bot', level: 'normal', fmt: 'p3', maps: ['soccer'], mods: false, items: false, weather: false });
    __api.step(1 / 60, 200);
    moment(); __game.score = [2, 3]; __api.endMatch();
    out.bot = __game.lastHL && __game.lastHL.match.names;
    out.botStats = Array.from(document.querySelectorAll('#resultStats .pn')).map(r => r.textContent).join(' | ');
    __api.startMatch({ mode: 'team4', slots: ['h', 'h', 'b', 'b'], level: 'hard', fmt: 'p3', maps: ['soccer'], mods: false, items: false, weather: false });
    __api.step(1 / 60, 200);
    out.labels = __game.looks.p.map(p => p.label);
    moment(); __game.score = [1, 1, 3, 3]; __api.endMatch();
    out.team4 = __game.lastHL && __game.lastHL.match.names;
    out.mvp = __game.lastHL && __game.lastHL.match.mvp && __game.lastHL.match.mvp.n;
    __api.startMatch({ mode: 'ffa', slots: ['h', 'b', 'h', 'b'], level: 'easy', fmt: 'p2', maps: ['soccer'], mods: false, items: false, weather: false });
    __api.step(1 / 60, 200);
    moment(); __game.score = [1, 0, 2, 0]; __api.endMatch();
    out.ffa = __game.lastHL && __game.lastHL.match.names;
    return out;
  });
  check('bot match: names Hùng / 🤖 Bot Thường kept with the highlight', JSON.stringify(names.bot) === JSON.stringify(['Hùng', '🤖 Bot Thường']), JSON.stringify(names.bot));
  check('bot match stats name the bot by level', names.botStats.indexOf('🤖 Bot Thường') >= 0, names.botStats);
  check('2 vs 2 with two bots: "Hùng + Lan" / "🤖 Bot Khó ×2"', JSON.stringify(names.team4) === JSON.stringify(['Hùng + Lan', '🤖 Bot Khó ×2']), JSON.stringify(names.team4));
  check('2 vs 2: tags over the heads name the bots by level', JSON.stringify(names.labels) === JSON.stringify(['Hùng', 'Lan', '🤖 Bot Khó', '🤖 Bot Khó']), JSON.stringify(names.labels));
  check('a bot MVP is named by level and slot', !names.mvp || /^🤖 Bot Khó · P[34]$/.test(names.mvp) || names.mvp === 'Hùng' || names.mvp === 'Lan', names.mvp);
  check('4 players each on his own: one name per player', JSON.stringify(names.ffa) === JSON.stringify(['Hùng', '🤖 Bot Dễ', 'Minh', '🤖 Bot Dễ']), JSON.stringify(names.ffa));

  // the highlight shows them over the score; the match shows them beside it
  await ev(() => __api.startMatch({ mode: 'bot', level: 'hard', fmt: 'p1', maps: ['soccer'], mods: false, items: false, weather: false }));
  await ev(() => __api.step(1 / 60, 200));
  await page.waitForTimeout(200);
  await page.screenshot({ path: SH + '/01_match_names_bot.png' });
  await ev(() => __api.startMatch({ mode: 'team4', slots: ['h', 'h', 'b', 'b'], level: 'hard', fmt: 'p1', maps: ['soccer'], mods: false, items: false, weather: false }));
  for (let i = 0; i < 200; i++) { const st = await ev(() => { for (let i = 0; i < 600; i++) { if (__game.state === 'over') break; if (__game.state === 'vote') { __game.golden = true; __game.state = 'play'; } __api.step(1 / 60); } return __game.state; }); if (st === 'over') break; }
  await page.waitForTimeout(600);
  await page.tap('[data-act="hlWatch"]:visible');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: SH + '/02_highlight_names.png' });
  await page.tap('#hlClose'); await page.waitForTimeout(400);

  // --- the player screen ---
  await ev(() => __api.toMenu()); await page.waitForTimeout(300);
  await page.tap('[data-act="profiles"]:visible'); await page.waitForTimeout(300);
  let ui = await ev(() => ({ cards: document.querySelectorAll('#profCards .pcard').length, mode: document.querySelector('#profMode .on').dataset.v,
    colors: !document.getElementById('profColorBox').classList.contains('hidden'), four: !document.getElementById('profFour').classList.contains('hidden'),
    names: Array.from(document.querySelectorAll('#profCards input')).map(i => i.value) }));
  check('player screen opens on 2 players: two tall cards, no colour choice', ui.cards === 2 && ui.mode === '2' && !ui.colors && !ui.four && ui.names.join() === 'Hùng,Lan', JSON.stringify(ui));
  await page.screenshot({ path: SH + '/03_players_2.png' });
  await page.fill('#profCards .pcard:nth-child(2) input', 'Lan Anh');
  ui = await ev(() => ({ name: BGMeta.profile(1).name, title: document.getElementById('profFor').textContent }));
  check('typing a name on a card renames that player and picks him', ui.name === 'Lan Anh' && ui.title.indexOf('Lan Anh') >= 0, JSON.stringify(ui));
  await page.tap('#profMode button[data-v="4"]'); await page.waitForTimeout(200);
  ui = await ev(() => ({ cards: document.querySelectorAll('#profCards .pcard').length, colors: !document.getElementById('profColorBox').classList.contains('hidden'),
    four: !document.getElementById('profFour').classList.contains('hidden') }));
  check('4 players: four cards, 2 vs 2 / each-alone choice and the colours', ui.cards === 4 && ui.colors && ui.four, JSON.stringify(ui));
  await page.screenshot({ path: SH + '/04_players_4.png' });
  await page.tap('#profCards .pcard:nth-child(4) canvas'); await page.waitForTimeout(150);
  const hatBefore = await ev(() => BGMeta.profile(3).hat);
  await page.tap('#profColors button:nth-child(5)'); await page.waitForTimeout(200);
  ui = await ev(() => ({ title: document.getElementById('profFor').textContent, color: BGMeta.profile(3).color, ffa: document.querySelector('#profFour .on').dataset.v,
    picked: document.querySelectorAll('#profCards .pcard.on').length, on: Array.from(document.querySelectorAll('#profCards .pcard')).findIndex(c => c.classList.contains('on')) }));
  check('tapping card 4 dresses P4; a colour shows the each-alone look', ui.title.indexOf('P4') >= 0 && ui.color === 4 && ui.ffa === 'ffa' && ui.picked === 1 && ui.on === 3, JSON.stringify(ui));
  await page.screenshot({ path: SH + '/05_players_4_ffa.png' });
  check('hat unchanged by picking a colour', (await ev(() => BGMeta.profile(3).hat)) === hatBefore);

  // --- against the bot: play the left or the right side ---
  await page.tap('[data-act="back"]:visible'); await page.waitForTimeout(200);
  await ev(() => __api.toMenu()); await page.waitForTimeout(200);
  await page.tap('[data-act="setup"][data-mode="bot"]'); await page.waitForTimeout(300);
  let sideUi = await ev(() => ({ shown: !document.getElementById('rowSide').classList.contains('hidden'), on: document.querySelector('#sideSeg .on') && document.querySelector('#sideSeg .on').dataset.v }));
  check('bot setup offers the side, left by default', sideUi.shown && sideUi.on === 'L', JSON.stringify(sideUi));
  await page.tap('#sideSeg button[data-v="R"]'); await page.waitForTimeout(150);
  await page.screenshot({ path: SH + '/06_setup_side.png' });
  sideUi = await ev(() => ({ saved: JSON.parse(localStorage.getItem('bgp_prefs')).side, on: document.querySelector('#sideSeg .on').dataset.v }));
  check('choosing the right side is remembered', sideUi.saved === 'R' && sideUi.on === 'R', JSON.stringify(sideUi));
  await ev(() => __api.startMatch({ mode: 'bot', level: 'hard', fmt: 'p2', maps: ['soccer'], mods: false, items: false, weather: false }));
  await ev(() => __api.step(1 / 60, 130));
  await page.keyboard.down('Space');
  const sideRun = await ev(() => {
    const presses = [];
    for (let i = 0; i < 20; i++) { __api.step(1 / 60); presses.push(__game.world.players.map(p => p.press ? 1 : 0).join('')); }
    return { me: __game.me, botTeam: __game.bot.team, presses, names: (function () { return __game.looks.p.map(p => p.hat + '/' + p.shirt); })() };
  });
  await page.keyboard.up('Space');
  check('right side: the player\'s button moves the right side (players 3, 4), the bot plays the left', sideRun.me === 1 && sideRun.botTeam === 0 && sideRun.presses.every(p => p[2] === '1' && p[3] === '1'), JSON.stringify(sideRun));
  await page.waitForTimeout(200);
  await page.screenshot({ path: SH + '/07_match_right_side.png' });
  const sideEnd = await ev(() => {
    __game.hlm.misses.push({ kind: 'miss', n: 1, by: [2], name: 'x', team: 1, beauty: 1, frames: new Int16Array(90 * 70), map: 'soccer', mods: {}, swap: false, round: 1, t: 1, marks: [{ t: 1, kind: 'miss', bi: 0, by: 2, team: 1, beauty: 1 }], slow: [] });
    __game.score = [0, 2]; __api.endMatch();
    return { text: document.getElementById('resultText').textContent, names: __game.lastHL.match.names, stats: Array.from(document.querySelectorAll('#resultStats .pn')).map(e => e.textContent) };
  });
  check('right side: winning 2–0 on the right is "BẠN THẮNG", names Bot left / player right', sideEnd.text.indexOf('BẠN THẮNG') === 0 && JSON.stringify(sideEnd.names) === JSON.stringify(['🤖 Bot Khó', 'Hùng']) && sideEnd.stats[1].indexOf('Hùng') >= 0, JSON.stringify(sideEnd));
  await page.waitForTimeout(600);
  const hist = await ev(() => { const r = BGHL.history()[0]; return r && { result: r.result, me: r.me, line: document.querySelector('#over') ? 1 : 0 }; });
  check('history: a win, played on the right', hist && hist.result === 'win' && hist.me === 1, JSON.stringify(hist));
  await ev(() => { const p = JSON.parse(localStorage.getItem('bgp_prefs')); p.side = 'L'; localStorage.setItem('bgp_prefs', JSON.stringify(p)); });

  // --- history: the "Xong" button stays at the bottom of the panel, small, while the list scrolls ---
  await ev(() => __api.toMenu()); await page.waitForTimeout(300);
  await page.tap('[data-act="history"]'); await page.waitForTimeout(400);
  const xong = async () => ev(() => {
    const p = document.querySelector('#history .panel'), b = document.querySelector('#history .stickyBar .btn'), pr = p.getBoundingClientRect(), br = b.getBoundingClientRect();
    return { text: b.textContent, scrolls: p.scrollHeight > p.clientHeight + 10, gapToBottom: Math.round(pr.bottom - br.bottom), h: Math.round(br.height), w: Math.round(br.width), panelW: Math.round(pr.width) };
  });
  const xTop = await xong();
  await ev(() => { const p = document.querySelector('#history .panel'); p.scrollTop = p.scrollHeight / 3; }); await page.waitForTimeout(150);
  const xMid = await xong();
  check('history: "✔ Xong" pinned at the bottom (top and middle of the list), smaller than full width', xTop.text === '✔ Xong' && xTop.scrolls && xTop.gapToBottom >= 0 && xTop.gapToBottom < 40 && xMid.gapToBottom === xTop.gapToBottom && xTop.w < xTop.panelW / 2,
    JSON.stringify([xTop, xMid]));
  await page.screenshot({ path: SH + '/08_history_xong.png' });
  await page.tap('#history .stickyBar .btn'); await page.waitForTimeout(250);
  check('…and it goes back to the menu', (await ev(() => __game.screen)) === 'menu');
  // history cards name bots by level too
  await page.tap('[data-act="history"]'); await page.waitForTimeout(400);
  const cards = await ev(() => Array.from(document.querySelectorAll('#hList .hcard')).map(c => c.textContent));
  const t4 = cards.find(c => c.indexOf('2 vs 2') >= 0) || '', ffa = cards.find(c => c.indexOf('4 người') >= 0) || '';
  check('history: 2 vs 2 card shows "🤖 Bot Khó ×2", 4-player card names bots by level', t4.indexOf('🤖 Bot Khó ×2') >= 0 && t4.indexOf('Minh+P4') < 0 && ffa.indexOf('🤖 Bot Dễ') >= 0, (t4.slice(0, 90) + ' | ' + ffa.slice(0, 90)));
  await page.tap('#history .stickyBar .btn'); await page.waitForTimeout(250);

  check('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(fails ? fails + ' FAILED' : 'all passed');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
