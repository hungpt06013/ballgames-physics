// v3.1: the two moments from the player's videos, rebuilt from the ball positions measured frame by frame
//  1) "SUÝT VÀO" while the ball flew straight up at midfield: the kick's first contact pointed the ball just over the
//     bar, the next contact steps of the same kick sent it straight up - only the real flight may count
//  2) no "CỨU THUA" for a header clearing a lob that would have bounced once and rolled in 1.2 s later
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await (await browser.newContext({ viewport: { width: 800, height: 380 } })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PE ' + String(e.stack || e)));
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.waitForTimeout(500);
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('bgp_prefs')); p.hlAsked = true; p.hlMode = 'all'; localStorage.setItem('bgp_prefs', JSON.stringify(p)); });
  await page.reload(); await page.waitForTimeout(500);
  const ev = (f, a) => page.evaluate(f, a);
  let fails = 0;
  const check = (name, ok, info) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info ? '  ' + info : '')); };

  // --- 1) a kick at midfield: the first contact aims it just over the left bar, the rest of the kick sends it up ---
  async function kick(pushUp) {
    return ev(pushUp => {
      const E = BGP;
      __api.startMatch({ mode: '2p', fmt: 'p9', maps: ['soccer'], mods: false, items: false, weather: false });
      __api.step(1 / 60, 110);
      const w = __game.world, A = w.arena, R = A.P.ballR, g = A.P.gBall;
      w.players.forEach((p, i) => { p.x = [1250, 1320, 1400, 1480][i]; p.y = E.GROUND - E.COM_H * p.sc; p.vx = p.vy = 0; E.shapes(p); });
      const b = w.ball, x0 = 860, t = (x0 - A.goalD) / 1500;
      b.x = b.prevX = x0; b.y = b.prevY = A.goalTop - R - 18; b.vx = -1500; b.vy = -0.5 * g * t; b.spin = 0;
      b.lastTeam = 1; b.lastBy[1] = 2; b.lastPid = 2; b.touchT[1] = w.time; b.lastKind = 'kick'; b.lastAir = false;
      __game.dbg = [];
      const ys = [];
      // (the game looks at the ball every step: the first contact is seen before the rest of the kick)
      for (let i = 0; i < 8; i++) {
        __api.step(1 / 120);
        if (pushUp && i >= 2 && i < 5) { b.vx = -30; b.vy = -900; b.touchT[1] = w.time; b.lastTeam = 1; } // the same kick, still on the ball
      }
      for (let i = 0; i < 360 && __game.state === 'play'; i++) { __api.step(1 / 120); if (i % 30 === 0) ys.push(Math.round(b.x) + ',' + Math.round(b.y)); }
      const out = { misses: __game.hlm.misses.length, score: __game.score.join('-'), dbg: __game.dbg.filter(d => d.r.indexOf('miss') === 0).map(d => d.r + (d.gap !== undefined ? ' ' + d.gap : '')), path: ys.slice(0, 6).join(' ') };
      __game.dbg = null;
      return out;
    }, pushUp);
  }
  let r = await kick(false);
  check('control: the shot itself just over the bar is a near miss', r.misses === 1 && r.score === '0-0', JSON.stringify(r));
  r = await kick(true);
  check('video 1: the same kick ending straight up at midfield: no "SUÝT VÀO"', r.misses === 0 && r.score === '0-0', JSON.stringify(r));

  // --- 2) the lob of video 2: at x 478, y 365 falling (vx -255, vy 930) toward the left goal, shot 1.3 s before ---
  // the defender (P1's front player) stands at defX and jumps pressAt seconds in (pressAt < 0: never presses)
  function lob1(o) {
    return ev(o => {
      const E = BGP;
      __api.startMatch({ mode: '2p', fmt: 'p9', maps: ['soccer'], mods: false, items: false, weather: false });
      __api.step(1 / 60, 110);
      const w = __game.world, P = w.players, park = [o.defX, 1500, 1400, 1550];
      P.forEach((p, i) => { p.x = park[i]; p.y = E.GROUND - E.COM_H * p.sc; p.vx = p.vy = p.a = p.w = 0; E.shapes(p); });
      const b = w.ball;
      b.x = b.prevX = 478; b.y = b.prevY = 365; b.vx = -255; b.vy = 930; b.spin = 0;
      b.lastTeam = 1; b.lastBy[1] = 2; b.lastPid = 2; b.touchT[1] = w.time - 1.3; b.lastX = 820; b.touchT[0] = -1;
      const t0 = w.time;
      for (let i = 0; i < 300 && __game.state === 'play'; i++) {
        if (o.pressAt >= 0 && Math.abs(w.time - t0 - o.pressAt) < 0.01) __game.hold[0] = w.time + 0.25;
        __api.step(1 / 60);
      }
      return { saves: __game.ps[0].saves, touched: b.touchT[0] >= t0, kind: b.lastTeam === 0 ? b.lastKind : '', score: __game.score.join('-'), clips: __game.hlm.singles.length + __game.hlm.clips.length };
    }, o);
  }
  let r2 = await lob1({ defX: 1200, pressAt: -1 });
  check('video 2, nobody there: the lob bounces once and rolls in', r2.score === '0-1', JSON.stringify(r2));
  // a real jump and header that clears it (search the defender's spot and the moment he jumps, as the bot or player would)
  let found = null, tried = 0;
  for (const defX of [440, 420, 400, 460, 380, 480]) {
    for (const pressAt of [0.05, 0.1, 0.15, 0.2, 0.25, 0, 0.3]) {
      tried++;
      const x = await lob1({ defX, pressAt });
      if (x.touched && x.score === '0-0') { found = Object.assign({ defX, pressAt }, x); break; }
    }
    if (found) break;
  }
  check('video 2: a jump that clears the dropping lob is a save (with its clip)', found && found.saves === 1 && found.clips >= 1, JSON.stringify(found) + ' after ' + tried + ' tries');
  // the same ball bouncing off a defender who never pressed
  let idle = null;
  for (const defX of [440, 420, 400, 460]) { const x = await lob1({ defX, pressAt: -1 }); if (x.touched) { idle = Object.assign({ defX }, x); break; } }
  check('...the same ball hitting a defender who did nothing: no save', idle && idle.saves === 0, JSON.stringify(idle));

  check('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(fails ? fails + ' FAILED' : 'all passed');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
