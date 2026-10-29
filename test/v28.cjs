// v2.8: 3 s warning before a re-drop (also with two humans), near misses in the highlight (best 20%), light / dark mode
const { chromium } = require('playwright');
const path = require('path');
const SH = path.resolve(__dirname, '../shots8');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 380 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PE ' + String(e.stack || e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.waitForTimeout(500);
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('bgp_prefs')); p.hlAsked = true; p.hlMode = 'all'; delete p.theme; localStorage.setItem('bgp_prefs', JSON.stringify(p)); });
  await page.reload(); await page.waitForTimeout(500);
  await page.tap('[data-act="skipTutorial"]:visible');
  const ev = (f, a) => page.evaluate(f, a);
  let fails = 0;
  const check = (name, ok, info) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info ? '  ' + info : '')); };

  // --- re-drop warning, two humans who do nothing ---
  await ev(() => __api.startMatch({ mode: '2p', fmt: 'p9', maps: ['soccer'], mods: false, items: false, weather: false }));
  await ev(() => {
    __api.step(1 / 60, 110);
    const w = __game.world, E = BGP;
    w.players.forEach((p, i) => { p.x = [150, 420, 1180, 1450][i]; p.y = E.GROUND - E.COM_H * p.sc; p.vx = p.vy = 0; E.shapes(p); });
    const b = w.ball; b.x = b.prevX = 800; b.y = b.prevY = E.GROUND - w.arena.P.ballR; b.vx = b.vy = 0; b.spin = 0; b.stillT = 0;
    window.__beeps = 0; const beep = BGAudio.beep; BGAudio.beep = function () { window.__beeps++; return beep.apply(this, arguments); };
  });
  const seen = [];
  for (let i = 0; i < 17 * 4; i++) {
    const r = await ev(() => { __api.step(1 / 60, 15); return { t: +__game.world.time.toFixed(2), sec: __game.redropSec || 0, still: +__game.world.ball.stillT.toFixed(2), x: Math.round(__game.world.ball.x), note: __game.noteT > 0 ? __game.note : '' }; });
    seen.push(r);
    if (r.sec === 2 && !seen.shot) { seen.shot = true; await page.waitForTimeout(80); await page.screenshot({ path: SH + '/01_redrop_warning.png' }); }
  }
  const first = seen.find(r => r.sec > 0), drop = seen.find(r => r.note.indexOf('TUNG BÓNG') >= 0);
  check('2 humans, ball lying still: countdown starts 3 s before', first && first.still >= 11.9 && first.still <= 12.4, first && 'at stillT ' + first.still + ' showing ' + first.sec);
  check('...counts 3, 2, 1 with a beep each', [3, 2, 1].every(n => seen.some(r => r.sec === n)) && (await ev(() => window.__beeps)) >= 3, 'beeps ' + (await ev(() => window.__beeps)));
  check('...and the ball is dropped in the middle at 15 s', drop && drop.x > 760 && drop.x < 840, drop && JSON.stringify(drop));
  // out of play: ball on the roof of a goal
  const out = await ev(() => {
    const w = __game.world, b = w.ball, A = w.arena, res = [];
    b.x = b.prevX = A.goalD / 2; b.y = b.prevY = A.goalTop - 60; b.vx = b.vy = 0; b.outT = 0;
    for (let i = 0; i < 16; i++) { __api.step(1 / 60, 15); res.push({ t: +b.outT.toFixed(2), sec: __game.redropSec || 0, x: Math.round(b.x) }); }
    return res;
  });
  // (a ball only flying over the goal for a moment gets no warning: it shows after 0.25 s, still counting from 3)
  check('ball on top of a goal: warning almost at once, dropped after 3 s', out.slice(0, 2).some(r => r.sec === 3) && out.some(r => r.x > 700), JSON.stringify(out.slice(0, 3)) + ' ... ' + JSON.stringify(out.slice(-1)));

  // --- near misses ---
  // find a shot from the right that just goes over the left crossbar, and one that is far over it
  async function shotTest(label, wantMiss, pick) {
    const r = await ev(pick => {
      const E = BGP;
      __api.startMatch({ mode: '2p', fmt: 'p9', maps: ['soccer'], mods: false, items: false, weather: false });
      __api.step(1 / 60, 110);
      const w = __game.world, A = w.arena, P = w.players;
      P.forEach((p, i) => { p.x = [1300, 1380, 1460, 1540][i]; p.y = E.GROUND - E.COM_H * p.sc; p.vx = p.vy = 0; E.shapes(p); });
      const b = w.ball, x0 = 700, y0 = E.GROUND - 120;
      // the real shot must miss on its own; a near miss would go in with a small change
      // the steepest angle that still scores, then just above it (near) or far above it (far)
      const goes = a => !!E.ballFuture(A, { x: x0, y: y0, vx: -1700 * Math.cos(a), vy: 1700 * Math.sin(a), ang: 0, spin: 0 }, 1.5);
      let edge = null;
      for (let a = -0.05; a > -0.8; a -= 0.002) if (goes(a) && !goes(a - 0.002)) { edge = a; break; }
      let vy = edge === null ? null : (pick === 'near' ? edge - 0.008 : edge - 0.3);
      if (vy !== null && goes(vy)) vy = null;
      if (vy === null) return { err: 'no shot found' };
      b.x = b.prevX = x0; b.y = b.prevY = y0; b.vx = -1700 * Math.cos(vy); b.vy = 1700 * Math.sin(vy); b.spin = 0;
      b.lastTeam = 1; b.lastBy[1] = 2; b.lastPid = 2; b.touchT[1] = w.time; b.lastAir = false;
      for (let i = 0; i < 240 && __game.state === 'play'; i++) __api.step(1 / 60);
      const H = __game.hlm;
      return { angle: +vy.toFixed(3), misses: H.misses.length, beauty: H.misses[0] && +H.misses[0].beauty.toFixed(2), mark: H.misses[0] && H.misses[0].marks.map(m => m.kind + '@' + m.t).join(','), score: __game.score.join('-') };
    }, pick);
    check(label, !r.err && (wantMiss ? r.misses === 1 : r.misses === 0) && r.score === '0-0', JSON.stringify(r));
  }
  await shotTest('shot just over the bar: a near miss', true, 'near');
  await shotTest('shot far over the bar: no near miss', false, 'far');

  // whole bot matches: share of misses in the highlight
  let all = 0, kept = 0, best = true;
  for (let k = 0; k < 3; k++) {
    await ev(() => __api.startMatch({ mode: 'team4', slots: ['b', 'b', 'b', 'b'], level: 'hard', fmt: 'p5', maps: ['soccer', 'basket', 'football', 'giant'], mods: false, items: true, weather: false }));
    // count the misses found before the selection
    const r = await ev(() => {
      let found = [];
      const orig = __game.hlm;
      for (let i = 0; i < 60000 && __game.state !== 'over'; i++) { if (__game.state === 'vote') { __game.golden = true; __game.state = 'play'; } if (__game.hlm) found = __game.hlm.misses.slice(); __api.step(1 / 60); }
      const inHl = __game.lastHL.clips.filter(c => c.kind === 'miss');
      const bs = found.map(c => c.beauty).sort((a, b) => b - a);
      return { found: found.length, kept: inHl.length, keptBeauty: inHl.map(c => +c.beauty.toFixed(2)), all: bs.map(x => +x.toFixed(2)), kinds: __game.lastHL.clips.map(c => c.kind[0]).join('') };
    });
    console.log('    match', k + 1, 'misses found', r.found, r.all.join(' '), '-> kept', r.kept, r.keptBeauty.join(' '), '| clips', r.kinds);
    all += r.found; kept += r.kept;
    if (r.found && r.kept !== Math.ceil(r.found * 0.2)) best = false;
    if (r.kept && Math.min.apply(null, r.keptBeauty) < (r.all[r.kept - 1] || 0) - 1e-9) best = false;
  }
  check('bot matches: the misses kept are the best 20% (rounded up)', best, kept + ' kept of ' + all + ' found (bots crowd the goal, so few)');
  // the same rule with a known set of misses: 7 misses of different quality -> the best 2 are kept
  for (const n of [7, 3]) {
    const r = await ev(n => {
      __api.startMatch({ mode: '2p', fmt: 'p9', maps: ['soccer'], mods: false, items: false, weather: false });
      __api.step(1 / 60, 120);
      const beauties = [0.9, 1.4, 0.6, 1.1, 0.75, 1.3, 0.5].slice(0, n);
      beauties.forEach((b, i) => __game.hlm.misses.push({ kind: 'miss', n: 1, by: [2], name: 'P2', team: 1, beauty: b, frames: new Int16Array(90 * 70),
        map: 'soccer', mods: {}, swap: false, round: 1, t: i * 3, marks: [{ t: 1, kind: 'miss', bi: 0, by: 2, team: 1, beauty: b }], slow: [] }));
      __game.score = [0, 9]; __api.endMatch();
      return __game.lastHL.clips.filter(c => c.kind === 'miss').map(c => c.beauty);
    }, n);
    const want = n === 7 ? [1.4, 1.3] : [1.4]; // the first 3 are 0.9, 1.4, 0.6
    check(n + ' misses -> the best ' + want.length + ' (' + want.join(', ') + ')', r.slice().sort((a, b) => b - a).join() === want.join(), JSON.stringify(r));
  }

  // --- light / dark ---
  await ev(() => __api.toMenu()); await page.waitForTimeout(300);
  const before = await ev(() => document.documentElement.dataset.theme);
  await page.tap('#themeBtn'); await page.waitForTimeout(300);
  const dark = await ev(() => ({ theme: document.documentElement.dataset.theme, panel: getComputedStyle(document.querySelector('#menu .panel')).backgroundColor, text: getComputedStyle(document.body).color, saved: JSON.parse(localStorage.getItem('bgp_prefs')).theme, btn: document.getElementById('themeBtn').textContent }));
  check('menu button switches to dark', before === 'light' && dark.theme === 'dark' && dark.panel === 'rgb(35, 39, 46)' && dark.saved === 'dark', JSON.stringify(dark));
  await page.screenshot({ path: SH + '/02_menu_dark.png' });
  await page.reload(); await page.waitForTimeout(500);
  check('dark is remembered after reopening', (await ev(() => document.documentElement.dataset.theme)) === 'dark');
  await page.tap('[data-act="settings"]'); await page.waitForTimeout(300);
  check('settings show the dark toggle on', await ev(() => document.getElementById('tgDark').classList.contains('on')));
  await page.screenshot({ path: SH + '/03_settings_dark.png' });
  await page.tap('[data-act="back"]:visible'); await page.waitForTimeout(200);
  await page.tap('[data-act="setup"][data-mode="bot"]'); await page.waitForTimeout(300);
  await page.screenshot({ path: SH + '/04_setup_dark.png' });
  await ev(() => __api.startMatch({ mode: 'bot', level: 'hard', fmt: 'p1', maps: ['soccer'], mods: false, items: false, weather: false }));
  await ev(() => __api.step(1 / 60, 200));
  await page.waitForTimeout(300);
  await page.screenshot({ path: SH + '/05_game_dark.png' });
  await ev(() => { __game.score = [0, 1]; __api.endMatch(); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: SH + '/06_over_dark.png' });
  const res = await ev(() => getComputedStyle(document.getElementById('resultText')).color);
  check('result text readable on the dark card', res !== 'rgb(29, 29, 31)', res);
  await ev(() => __api.toMenu()); await page.tap('[data-act="history"]'); await page.waitForTimeout(300);
  await page.tap('.hcard .hmain'); await page.waitForTimeout(200);
  await page.screenshot({ path: SH + '/07_history_dark.png' });
  await page.tap('[data-act="back"]:visible'); await page.waitForTimeout(200);
  await page.tap('#themeBtn'); await page.waitForTimeout(200);
  check('and back to light', (await ev(() => document.documentElement.dataset.theme)) === 'light' && (await ev(() => JSON.parse(localStorage.getItem('bgp_prefs')).theme)) === 'light');

  console.log(errs.length ? 'ERRORS ' + errs.join('\n') : 'no page errors');
  console.log(fails ? fails + ' FAILED' : 'all checks passed');
  await browser.close();
})();
