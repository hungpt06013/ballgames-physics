// 4 players (each on his own) and 2 vs 2, played from the real menu: each corner of the screen (and each player's
// keys) moves the right player; who scores a goal (4 alone: the last player of the side whose goal it is to touch the
// ball, nobody when none of them did; 2 vs 2: both players of the side); a match to the end and back to the menu.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  const page = await (await browser.newContext({ viewport: { width: 800, height: 380 }, hasTouch: true, isMobile: true })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.stack || e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  let fails = 0;
  const check = (name, ok, info) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== undefined ? '  ' + info : '')); };
  const ev = (f, a) => page.evaluate(f, a);
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.waitForTimeout(400);
  await ev(() => localStorage.setItem('bgp_prefs', JSON.stringify({ maps: ['soccer'], fmtType: 'p', fmtPoints: 2, mods: false, items: false, weather: false,
    slots: ['h', 'h', 'h', 'h'], replay: false, hlAsked: true, hlMode: 'none', askDress: false })));
  await page.reload(); await page.waitForTimeout(500);
  // every jump of every player, as the game's own physics step makes it
  await ev(() => {
    window.__jumps = [];
    const orig = BGP.stepPlayers;
    BGP.stepPlayers = function (w, pr) { const s = orig.apply(this, arguments); if (w === __game.world && w.events) for (const e of w.events) if (e.t === 'jump') __jumps.push(e.id); return s; };
  });
  const playing = async () => { for (let i = 0; i < 60; i++) { if (await ev(() => __game.state === 'play')) return true; await page.waitForTimeout(100); } return false; };
  // everybody standing still on his feet (so a jump is plainly the one we caused)
  const settle = async () => {
    for (let i = 0; i < 40; i++) {
      const ok = await ev(() => __game.state === 'play' && __game.world.players.every(p => p.cT < 0.07 && Math.abs(p.vy) < 60 && p.jumpT <= 0 && p.jumpKeep <= 0));
      if (ok) return true;
      await page.waitForTimeout(100);
    }
    return false;
  };
  // the players who jump after an action
  const who = async act => { await settle(); await ev(() => { window.__jumps = []; }); await act(); await page.waitForTimeout(350); return ev(() => Array.from(new Set(__jumps)).map(i => i + 1)); };

  for (const mode of ['ffa', 'team4']) {
    console.log('--- ' + (mode === 'ffa' ? '4 players' : '2 vs 2') + ', from the menu ---');
    await ev(m => document.querySelector('[data-act="setup"][data-mode="' + m + '"]').click(), mode);
    await page.waitForTimeout(200);
    await ev(() => document.querySelector('#setup [data-act="start"]').click());
    const started = await playing();
    const st = await ev(() => ({ mode: __game.mode, bots: __game.bots.map(Boolean), active: __game.world.players.map(p => p.active) }));
    check('the match starts in its mode, four people, four players on the pitch', started && st.mode === mode && st.bots.every(b => !b) && st.active.every(Boolean), JSON.stringify(st));
    // P1 bottom left, P2 top left, P3 bottom right, P4 top right
    const quads = [[100, 300], [100, 80], [700, 300], [700, 80]], byTap = [];
    for (const [x, y] of quads) byTap.push(await who(() => page.touchscreen.tap(x, y)));
    check('a tap in each corner moves that corner\'s player only (P1 ↙ P2 ↖ P3 ↘ P4 ↗)', JSON.stringify(byTap) === '[[1],[2],[3],[4]]', JSON.stringify(byTap));
    const byKey = [];
    for (const k of ['KeyA', 'KeyG', 'KeyK', 'ArrowUp']) byKey.push(await who(async () => { await page.keyboard.down(k); await page.waitForTimeout(120); await page.keyboard.up(k); }));
    check('the keys A, G, K, ↑ move P1, P2, P3, P4', JSON.stringify(byKey) === '[[1],[2],[3],[4]]', JSON.stringify(byKey));

    // goals: put the ball into the right goal (the red side attacks it) as if `by` touched it last
    const goal = async (byRed, byBlue) => {
      await playing();
      const before = await ev(() => __game.score.slice());
      await ev(o => { const b = __game.world.ball; b.lastBy[0] = o.r; b.lastBy[1] = o.b; b.lastTeam = o.r >= 0 ? 0 : 1; b.lastPid = o.r >= 0 ? o.r : o.b;
        b.x = b.prevX = BGP.W - 60; b.y = b.prevY = BGP.GROUND - 40; b.vx = 400; b.vy = 0; }, { r: byRed, b: byBlue });
      for (let i = 0; i < 40; i++) { if (await ev(() => __game.state !== 'play')) break; await page.waitForTimeout(50); }
      const after = await ev(() => ({ score: __game.score.slice(), state: __game.state, credit: __game.credit }));
      return { before, after };
    };
    // (the red side is players 1 and 2, the blue side 3 and 4)
    let g = await goal(1, 2);
    if (mode === 'ffa') {
      check('4 alone: P2 (red) touched it last on the red side, into the goal red attacks: P2 +1, nobody else', g.after.score.join() === '0,1,0,0' && g.after.credit === 1, JSON.stringify(g));
      g = await goal(-1, 2);
      check('...into the same goal with no red player touching it (P3 put it in): nobody scores', g.after.score.join() === '0,1,0,0' && g.after.credit === -1, JSON.stringify(g));
    } else {
      check('2 vs 2: a goal for the red side counts for both its players', g.after.score.join() === '1,1,0,0', JSON.stringify(g));
    }
    g = await goal(1, -1);
    for (let i = 0; i < 80; i++) { if (await ev(() => __game.state === 'over')) break; await page.waitForTimeout(100); }
    const over = await ev(() => ({ state: __game.state, score: __game.score.slice(), txt: document.getElementById('resultText').textContent, sc: document.getElementById('resultScore').textContent }));
    check('the second point wins the match (first to 2): the end screen names the winner', over.state === 'over' && /P2|ĐỎ|Đỏ|thắng/i.test(over.txt + over.sc), JSON.stringify(over));
    await ev(() => { const b = document.querySelector('#over [data-act="toMenu"]'); if (b) b.click(); else __api.toMenu(); });
    await page.waitForTimeout(400);
    check('...and back to the menu', await ev(() => !document.getElementById('menu').classList.contains('hidden')), '');
  }
  check('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(fails ? fails + ' FAILED' : 'all checks passed');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
