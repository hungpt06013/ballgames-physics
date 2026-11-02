// Every kind of moment the highlight has to get right - saves, near misses, goals - each built with the game's real
// physics (real players pressing the real button; the test searches the spot / the moment of the press until the
// situation really happens as described) and checked against what the game says: counted or not, in the highlight
// or not, and the word shown when the highlight is played ("CỨU THUA!", "SUÝT VÀO!", "VÀO!").
// 2 players: red (team 0, P1 = bodies 0 and 1, button slot 0) defends the LEFT goal; blue (team 1, bodies 2, 3,
// button slot 1) shoots at it.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await (await browser.newContext({ viewport: { width: 800, height: 380 } })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PE ' + String(e.stack || e)));
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.waitForTimeout(500);
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('bgp_prefs')); p.hlAsked = true; p.hlMode = 'none'; p.replay = true; localStorage.setItem('bgp_prefs', JSON.stringify(p)); });
  await page.reload(); await page.waitForTimeout(500);
  await page.evaluate(() => {
    // one situation: o = { map, pl: x of bodies 0-3 (null = parked far right), knock: [body, vy], ball: 'g => ({x, y, vx, vy})',
    //   touch: { team, pid, ago }, press: [[slot, at, dur]], hold: slot pressed all along, rebound: { after, team, pid, vx, vy },
    //   shield: team, scramble: true, secs }
    window.__sc = function (o) {
      const E = BGP, G = __game;
      // o.mirror: the same situation on the other side (blue keeper, right goal); results come back from red's view
      const M = !!o.mirror, mb = i => M ? (i + 2) % 4 : i, mt = t => M ? 1 - t : t, WW = E.W;
      const mods = o.twoBalls ? { twoBalls: true } : false;
      for (let k = 0; k < 40; k++) { // (two balls: the modifier comes in about every other round)
        __api.startMatch({ mode: o.mode || '2p', slots: o.slots, level: 'hard', side: o.side, fmt: o.fmt || 'p9', maps: [o.map || 'soccer'],
          mods: !!mods, modList: o.twoBalls ? ['twoBalls'] : [], items: false, weather: false });
        __api.step(1 / 60, 110);
        if (!o.twoBalls || G.world.balls.length > 1) break;
      }
      G.dbg = [];
      const w = G.world, A = w.arena, P = w.players;
      const g = { goalD: A.goalD, goalTop: A.goalTop, rimY: A.rimY, boardX: A.boardX, rimFront: A.rimFront, postX: A.postX, barY: A.barY,
        R: A.P.ballR, grav: A.P.gBall, GROUND: E.GROUND };
      const park = [1500, 1530, 1440, 1570]; // (out of the way)
      for (let i = 0; i < 4; i++) {
        const p = P[mb(i)], x = o.pl && o.pl[i] !== undefined && o.pl[i] !== null ? o.pl[i] : park[i];
        p.x = M ? WW - x : x; p.y = E.GROUND - E.COM_H * p.sc; p.vx = p.vy = p.a = p.w = 0; E.shapes(p);
      }
      if (o.knock) { const p = P[mb(o.knock[0])]; p.y -= 30; p.vy = o.knock[1]; E.shapes(p); }
      const bs = (new Function('return ' + o.ball))()(g);
      if (M) { bs.x = WW - bs.x; bs.vx = -bs.vx; }
      const b2 = w.balls[o.ballIndex || 0];
      if (o.twoBalls) w.balls.forEach((x, i) => { if (i !== (o.ballIndex || 0)) { x.x = x.prevX = 800; x.y = x.prevY = E.GROUND - g.R; x.vx = x.vy = 0; } });
      const ball = b2;
      ball.x = ball.prevX = bs.x; ball.y = ball.prevY = bs.y; ball.vx = bs.vx; ball.vy = bs.vy; ball.spin = 0;
      const t0 = w.time, tc = o.touch || { team: 1, pid: 2, ago: 0 };
      ball.touchT[0] = ball.touchT[1] = -1;
      const tt = mt(tc.team), tp = mb(tc.pid);
      ball.lastTeam = tt; ball.lastBy[tt] = tp; ball.lastPid = tp; ball.touchT[tt] = t0 - (tc.ago || 0); ball.lastX = ball.x; ball.lastKind = 'kick'; ball.lastAir = false;
      if (o.shield !== undefined) w.fx.shield[mt(o.shield)] = 10;
      let rebounded = false, touch0 = -1;
      const b = ball, D0 = mt(0), slot = k => o.mode && o.mode !== '2p' ? k : mt(k);
      const secs = o.secs || 3.5;
      for (let i = 0; i < secs * 60 && G.state === 'play'; i++) {
        const now = w.time - t0;
        (o.press || []).forEach(q => { if (Math.abs(now - q[1]) < 0.009) G.hold[slot(q[0])] = w.time + q[2]; });
        if (o.hold !== undefined) G.hold[slot(o.hold)] = w.time + 0.05;
        if (o.scramble && b.touchT[D0] < t0) b.touchT[1 - D0] = w.time;
        if (touch0 < 0 && b.touchT[D0] >= t0) touch0 = w.time;
        if (o.rebound && !rebounded && touch0 >= 0 && w.time - touch0 >= o.rebound.after) {
          rebounded = w.time - t0; const r = o.rebound;
          if (r.x !== undefined) { b.x = b.prevX = M ? WW - r.x : r.x; b.y = b.prevY = r.y; }
          const rt = mt(r.team), rp = mb(r.pid);
          b.vx = M ? -r.vx : r.vx; b.vy = r.vy; b.lastTeam = rt; b.lastBy[rt] = rp; b.lastPid = rp; b.touchT[rt] = w.time; b.lastKind = 'head'; b.lastX = b.x;
        }
        __api.step(1 / 60);
      }
      // (results from red's point of view: mirrored ones swapped back)
      const sw = a => M && a.length === 2 ? [a[1], a[0]] : (M && a.length === 4 ? [a[2], a[3], a[0], a[1]] : a);
      const res = { score: sw(G.score.slice()).join('-'), touched0: touch0 >= 0, firstTouch0: touch0 >= 0 ? touch0 - t0 : -1, lastTouch0: b.touchT[D0] - t0, saves: sw(G.ps.map(p => p.saves)), goals: sw(G.ps.map(p => p.goals)),
        own: sw(G.ps.map(p => p.own)), word: (G.word || '') + ' | ' + (G.sub || ''), rebounded,
        dbg: G.dbg.map(d => d.r + (d.gap !== undefined ? '(' + d.gap + ')' : '') + '@' + (d.t - t0).toFixed(2)).join(' ') };
      // the match ends: its highlight is made (a point scored goes on through the replay first)
      if (G.state !== 'play') { for (let i = 0; i < 1200 && G.state !== 'over'; i++) __api.step(1 / 60); }
      if (G.state !== 'over') { G.score = G.score.length === 4 ? [9, 9, 0, 0] : [9, 0]; __api.endMatch(); }
      const hl = G.lastHL;
      res.clips = hl ? hl.clips.map(c => c.kind + (c.n > 1 ? '×' + c.n : '') + '[' + c.marks.map(m => m.kind).join('+') + ']').join(' ') : '';
      G.dbg = null;
      return res;
    };
    // play the last highlight through and list the words it flashes
    window.__flashes = function () {
      const G = __game;
      if (!G.lastHL) return [];
      document.querySelector('[data-act="hlWatch"]').click();
      const out = []; let last = null;
      for (let i = 0; i < 60 * 90 && G.state === 'highlight'; i++) {
        __api.step(1 / 60);
        if (G.flash && G.flash !== last) { last = G.flash; out.push(G.hlp ? (G.hlp.ci + 1) + ':' + G.flash.txt : G.flash.txt); }
      }
      return out;
    };
  });
  const sc = o => page.evaluate(o => window.__sc(o), o);
  const flashes = () => page.evaluate(() => window.__flashes());
  let fails = 0, n = 0;
  const check = (name, ok, info) => { n++; if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info ? '  ' + info : '')); };
  // tries every option until the situation happens (pre); returns the first result that matches, with its option
  async function find(base, opts, pre) {
    let last = null;
    for (const v of opts) {
      const r = await sc(Object.assign({}, base, v));
      last = Object.assign({ opt: v }, r);
      if (pre(r, v)) return Object.assign({ found: true }, last);
    }
    return Object.assign({ found: false }, last);
  }
  const grid = (xs, ats, extra) => { const out = []; xs.forEach(x => ats.forEach(at => out.push(extra(x, at)))); return out; };
  const short = r => JSON.stringify({ found: r.found, opt: r.opt, score: r.score, saves: r.saves, own: r.own, clips: r.clips, dbg: r.dbg && r.dbg.slice(0, 120), word: r.word });

  console.log('--- SAVES that must count ---');
  // 1. a hard low shot kicked away by the keeper
  let r = await find({ ball: 'g => ({ x: 720, y: g.GROUND - g.R, vx: -1300, vy: 0 })' },
    grid([230, 260, 290, 320], [0.12, 0.18, 0.24, 0.3], (x, at) => ({ pl: [x], press: [[0, at, 0.25]] })),
    (x, v) => x.touched0 && x.score === '0-0' && x.firstTouch0 > v.press[0][1]);
  check('hard low shot kicked away by the keeper', r.found && r.saves[0] === 1 && /save\[save\]/.test(r.clips), short(r));
  let fl = await flashes();
  check('...the highlight shows it with "🧤 CỨU THUA!"', fl.some(f => f.indexOf('CỨU THUA') >= 0), JSON.stringify(fl));
  // 2. a shot at head height headed / punched away by a jumping keeper
  r = await find({ ball: 'g => ({ x: 720, y: 600, vx: -1200, vy: -0.5 * g.grav * (470 / 1200) })' },
    grid([230, 260, 290], [0.05, 0.1, 0.15, 0.2, 0.25], (x, at) => ({ pl: [x], press: [[0, at, 0.3]] })),
    x => x.touched0 && x.score === '0-0');
  check('shot at head height cleared by a jumping keeper', r.found && r.saves[0] === 1, short(r));
  // 3. the lob of video 2: would bounce once and roll in 1.2 s later; cleared by a jumping header
  r = await find({ ball: 'g => ({ x: 478, y: 365, vx: -255, vy: 930 })', touch: { team: 1, pid: 2, ago: 1.3 } },
    grid([440, 420, 400, 460], [0.05, 0.1, 0.15, 0.2, 0], (x, at) => ({ pl: [x], press: [[0, at, 0.25]] })),
    x => x.touched0 && x.score === '0-0');
  check('video 2: dropping lob cleared by a jumping player', r.found && r.saves[0] === 1, short(r));
  // 4. video 3: the keeper stops the opponent's lob, a team-mate heads it straight back, the keeper stops it again
  r = await find({ ball: 'g => ({ x: 1215, y: 638, vx: -701, vy: -1099 })', touch: { team: 1, pid: 2, ago: 0 }, hold: 0, secs: 4.5 },
    grid([230, 250, 270, 290, 310], [0.3, 0.4, 0.5], (x, after) => ({ pl: [x], rebound: { after, team: 0, pid: 1, x: 540, y: 520, vx: -800, vy: 100 } })),
    x => x.touched0 && x.rebounded && x.score === '0-0' && x.lastTouch0 > 0.3);
  check('video 3: save, team-mate heads it back, save again = 2 saves, one clip "×2"', r.found && r.saves[0] === 2 && /save×2\[save\+save\]/.test(r.clips), short(r));
  fl = await flashes();
  check('...the highlight flashes "CỨU THUA!" twice', fl.filter(f => f.indexOf('CỨU THUA') >= 0).length === 2, JSON.stringify(fl));
  // 5. save, the opponent shoots again, save again
  r = await find({ ball: 'g => ({ x: 1215, y: 638, vx: -701, vy: -1099 })', touch: { team: 1, pid: 2, ago: 0 }, hold: 0, secs: 4.5 },
    grid([230, 250, 270, 290, 310], [0.3, 0.4, 0.5], (x, after) => ({ pl: [x], rebound: { after, team: 1, pid: 2, x: 820, y: 690, vx: -1100, vy: -200 } })),
    x => x.touched0 && x.rebounded && x.score === '0-0' && x.lastTouch0 > x.rebounded + 0.2);
  check('save, opponent shoots again, save again = 2 saves', r.found && r.saves[0] === 2, short(r));
  // 6. a shot blocked near the halfway line, in his own half
  r = await find({ ball: 'g => ({ x: 1150, y: g.GROUND - g.R, vx: -1500, vy: 0 })' },
    grid([640, 680, 720], [0.12, 0.18, 0.24, 0.3], (x, at) => ({ pl: [x], press: [[0, at, 0.25]] })),
    x => x.touched0 && x.score === '0-0');
  check('hard shot blocked in his own half near the middle', r.found && r.saves[0] === 1, short(r));
  // 7. a ball his own team-mate sent toward his own goal, stopped by the keeper
  r = await find({ ball: 'g => ({ x: 720, y: g.GROUND - g.R, vx: -1300, vy: 0 })', touch: { team: 0, pid: 1, ago: 0.3 } },
    grid([230, 260, 290, 320], [0.12, 0.18, 0.24, 0.3], (x, at) => ({ pl: [x, 900], press: [[0, at, 0.25]] })),
    x => x.touched0 && x.score === '0-0' && x.lastTouch0 > 0);
  check('own team-mate\'s miskick toward his goal, stopped by the keeper', r.found && r.saves[0] === 1, short(r));
  // 8. basketball: a ball dropping into the ring blocked by a jumping player
  r = await find({ map: 'basket', ball: 'g => ({ x: g.boardX + 90, y: g.rimY - 330, vx: -40, vy: 150 })', touch: { team: 1, pid: 2, ago: 0.8 } },
    grid([200, 230, 260, 290], [0, 0.05, 0.1, 0.15, 0.2, 0.25], (x, at) => ({ pl: [x], press: [[0, at, 0.3]] })),
    x => x.touched0 && x.score === '0-0');
  check('basketball: shot dropping into the ring blocked by a jump', r.found && r.saves[0] === 1, short(r));

  console.log('--- touches that must NOT count as saves ---');
  // 9. keeper standing still (never pressed), the shot hits him
  r = await find({ ball: 'g => ({ x: 720, y: g.GROUND - g.R - 60, vx: -1300, vy: -200 })' },
    [230, 260, 290, 320].map(x => ({ pl: [x] })), x => x.touched0);
  check('keeper standing still, the ball hits him: no save', r.found && r.saves[0] === 0 && !/save/.test(r.clips), short(r));
  // 10. knocked into the air without pressing
  r = await find({ ball: 'g => ({ x: 720, y: g.GROUND - g.R - 60, vx: -1300, vy: -200 })' },
    grid([230, 260, 290, 320], [-250, -350, -450, -550], (x, vy) => ({ pl: [x], knock: [0, vy] })), x => x.touched0 && x.score === '0-0');
  check('keeper thrown up (no press), the ball hits him: no save', r.found && r.saves[0] === 0, short(r));
  // 11. blocked in the opponent's half
  r = await find({ ball: 'g => ({ x: 1250, y: g.GROUND - g.R, vx: -1700, vy: 0 })' },
    grid([880, 930, 980], [0.08, 0.12, 0.16, 0.2, 0.24], (x, at) => ({ pl: [x], press: [[0, at, 0.25]] })),
    x => x.touched0 && x.score === '0-0');
  check('blocked in the opponent\'s half: no save', r.found && r.saves[0] === 0, short(r));
  // 12. a slow rolling ball
  r = await find({ ball: 'g => ({ x: 520, y: g.GROUND - g.R, vx: -330, vy: 0 })' },
    grid([240, 270, 300], [0.3, 0.5, 0.7, 0.9], (x, at) => ({ pl: [x], press: [[0, at, 0.25]] })),
    x => x.touched0 && x.score === '0-0');
  check('slow rolling ball kicked away: no save', r.found && r.saves[0] === 0, short(r));
  // 13. scramble: the shooter still on the ball when the keeper touches it
  r = await find({ ball: 'g => ({ x: 720, y: g.GROUND - g.R, vx: -1300, vy: 0 })', scramble: true },
    grid([230, 260, 290], [0.12, 0.18, 0.24, 0.3], (x, at) => ({ pl: [x], press: [[0, at, 0.25]] })),
    x => x.touched0 && x.score === '0-0');
  check('scramble (attacker touching it the moment before): no save', r.found && r.saves[0] === 0, short(r));
  // 14. the goal's shield power-up stops it
  r = await sc({ ball: 'g => ({ x: 720, y: g.GROUND - g.R - 40, vx: -1300, vy: -150 })', shield: 0 });
  check('shield power-up stops the shot: no save, no goal', r.score === '0-0' && r.saves[0] === 0, JSON.stringify(r));
  // 15. a ball going away from the goal kicked by the keeper
  r = await find({ ball: 'g => ({ x: 330, y: g.GROUND - g.R, vx: 700, vy: 0 })' },
    grid([360, 400, 440], [0, 0.05, 0.1], (x, at) => ({ pl: [x], press: [[0, at, 0.25]] })), x => x.touched0);
  check('ball moving away from the goal kicked by the keeper: no save', r.found && r.saves[0] === 0, short(r));
  // 16. touched by the keeper but it still goes in, nobody else touching it
  r = await find({ ball: 'g => ({ x: 720, y: g.GROUND - g.R - 50, vx: -1400, vy: -150 })' },
    grid([200, 215, 230, 245], [0.1, 0.15, 0.2, 0.25, 0.3, 0.35], (x, at) => ({ pl: [x], press: [[0, at, 0.2]] })),
    x => x.touched0 && x.score === '0-1');
  check('keeper touches it but it still goes in: no save (and the goal counts)', r.found && r.saves[0] === 0 && !/save/.test(r.clips), short(r));

  console.log('--- NEAR MISSES that must count ---');
  // 17. shot just over the bar (the ball's bottom 15 px over it at the goal line)
  r = await sc({ ball: 'g => { const t = (700 - g.goalD) / 1500; return { x: 700, y: g.goalTop - g.R - 15, vx: -1500, vy: -0.5 * g.grav * t }; }' });
  check('shot just over the bar: near miss', r.score === '0-0' && /miss\[miss\]/.test(r.clips), JSON.stringify(r));
  fl = await flashes();
  check('...the highlight shows it with "😱 SUÝT VÀO!"', fl.some(f => f.indexOf('SUÝT VÀO') >= 0), JSON.stringify(fl));
  // 18. shot off the end of the crossbar
  const dys = []; for (let dy = -60; dy >= -140; dy -= 2) dys.push(dy);
  r = await find({}, dys.map(dy => ({ ball: 'g => ({ x: g.goalD + 320, y: g.goalTop + (' + dy + '), vx: -1000, vy: 0 })' })),
    x => x.score === '0-0' && /miss\?\(1\)/.test(x.dbg));
  check('shot off the crossbar: near miss', r.found && /miss\[miss\]/.test(r.clips), short(r));
  // 19. basketball: off the front of the rim
  const lobs = []; for (let vx = -500; vx >= -720; vx -= 20) for (const vy of [-900, -1000]) lobs.push({ vx, vy });
  r = await find({ map: 'basket', touch: { team: 1, pid: 2, ago: 0 }, secs: 2.5 }, lobs.map(v => ({ ball: 'g => ({ x: g.rimFront + 480, y: g.rimY + 60, vx: ' + v.vx + ', vy: ' + v.vy + ' })' })),
    x => x.score === '0-0' && /miss\?/.test(x.dbg));
  check('basketball: off the rim: near miss', r.found && /miss\[miss\]/.test(r.clips), short(r));
  // 20. football: just under the bar
  r = await sc({ map: 'football', ball: 'g => { const t = 400 / 1400; return { x: g.postX + 400, y: g.barY + 12, vx: -1400, vy: -0.5 * g.grav * t }; }' });
  check('football: just under the bar: near miss', r.score === '0-0' && /miss\[miss\]/.test(r.clips), JSON.stringify(r));
  // 21. giant ball just over the bar
  r = await sc({ map: 'giant', secs: 1.8, ball: 'g => { const t = (900 - g.goalD) / 1500; return { x: 900, y: g.goalTop - g.R - 25, vx: -1500, vy: -0.5 * g.grav * t }; }' });
  check('giant ball just over the bar: near miss', r.score === '0-0' && /miss\[miss\]/.test(r.clips), JSON.stringify(r));

  console.log('--- shots that must NOT be near misses ---');
  // 22. well over the bar
  r = await sc({ ball: 'g => { const t = (700 - g.goalD) / 1500; return { x: 700, y: g.goalTop - g.R - 90, vx: -1500, vy: -0.5 * g.grav * t }; }' });
  check('well over the bar: no near miss', r.score === '0-0' && !/miss/.test(r.clips), JSON.stringify(r));
  // 23. dropping onto the roof of the goal
  r = await sc({ ball: 'g => ({ x: g.goalD + 60, y: g.goalTop - 400, vx: -200, vy: 500 })' });
  check('ball dropping on the roof of the goal: no near miss', r.score === '0-0' && !/miss/.test(r.clips), JSON.stringify(r));
  // 24. video 1: the kick's first contact aims it over the bar, the rest of the kick sends it straight up
  r = await page.evaluate(() => {
    const E = BGP, G = __game;
    __api.startMatch({ mode: '2p', fmt: 'p9', maps: ['soccer'], mods: false, items: false, weather: false });
    __api.step(1 / 60, 110); G.dbg = [];
    const w = G.world, A = w.arena, R = A.P.ballR, b = w.ball;
    w.players.forEach((p, i) => { p.x = [1250, 1320, 1400, 1480][i]; p.y = E.GROUND - E.COM_H * p.sc; p.vx = p.vy = 0; E.shapes(p); });
    const t = (860 - A.goalD) / 1500;
    b.x = b.prevX = 860; b.y = b.prevY = A.goalTop - R - 18; b.vx = -1500; b.vy = -0.5 * A.P.gBall * t; b.spin = 0;
    b.lastTeam = 1; b.lastBy[1] = 2; b.lastPid = 2; b.touchT[1] = w.time;
    for (let i = 0; i < 8; i++) { __api.step(1 / 120); if (i >= 2 && i < 5) { b.vx = -30; b.vy = -900; b.touchT[1] = w.time; } }
    for (let i = 0; i < 240; i++) __api.step(1 / 60);
    G.score = [9, 0]; __api.endMatch();
    const out = { clips: G.lastHL ? G.lastHL.clips.map(c => c.kind).join(' ') : '', dbg: G.dbg ? '' : '' };
    G.dbg = null; return out;
  });
  check('video 1: kick that ends going straight up: no near miss', !/miss/.test(r.clips), JSON.stringify(r));
  // 25. blocked on the goal line by the keeper (that is a save or nothing, never a near miss)
  r = await find({ ball: 'g => ({ x: 720, y: g.GROUND - g.R, vx: -1300, vy: 0 })' },
    grid([160, 180, 200, 220, 240], [0.15, 0.2, 0.25, 0.3, 0.35], (x, at) => ({ pl: [x], press: [[0, at, 0.25]] })),
    x => x.touched0 && x.score === '0-0');
  check('blocked on the line by the keeper: no near miss', r.found && !/miss/.test(r.clips), short(r));
  // 26. off the bar and in: a goal, not a near miss
  const ins = []; for (let dy = 6; dy <= 22; dy += 2) ins.push(dy);
  r = await find({ fmt: 'p1' }, ins.map(dy => ({ ball: 'g => { const t = 300 / 1200; return { x: g.goalD + 300, y: g.goalTop + (' + dy + '), vx: -1200, vy: -0.5 * g.grav * t }; }' })),
    x => x.score === '0-1');
  check('off the bar and in: a goal, no near miss', r.found && !/miss/.test(r.clips) && /goal/.test(r.clips), short(r));
  // 27. basketball: coming up under the ring
  r = await sc({ map: 'basket', ball: 'g => ({ x: g.boardX + 70, y: g.rimY + 80, vx: 0, vy: -Math.sqrt(2 * g.grav * (80 - 0.6 * g.R)) })', touch: { team: 1, pid: 2, ago: 0 } });
  check('basketball: ball coming up under the ring: no near miss', r.score === '0-0' && !/miss/.test(r.clips), JSON.stringify(r));
  // 28. a shot that goes in
  r = await sc({ fmt: 'p1', ball: 'g => ({ x: 720, y: g.GROUND - g.R - 40, vx: -1300, vy: -150 })' });
  check('a shot that goes in: no near miss', r.score === '0-1' && !/miss/.test(r.clips), JSON.stringify(r));

  console.log('--- GOALS ---');
  // 29. low shot into the empty goal
  r = await sc({ fmt: 'p1', ball: 'g => ({ x: 720, y: g.GROUND - g.R, vx: -1300, vy: 0 })' });
  check('low shot into the empty goal: a point for blue, his goal, a goal clip', r.score === '0-1' && r.goals[1] === 1 && /goal\[.*goal/.test(r.clips), JSON.stringify(r));
  fl = await flashes();
  check('...the highlight shows "VÀO!"', fl.some(f => f.indexOf('VÀO') >= 0 && f.indexOf('SUÝT') < 0), JSON.stringify(fl));
  // 30. own goal
  r = await sc({ fmt: 'p1', ball: 'g => ({ x: 520, y: g.GROUND - g.R, vx: -1100, vy: 0 })', touch: { team: 0, pid: 1, ago: 0 } });
  check('own goal: the point goes to blue, an own goal for red, own-goal words', r.score === '0-1' && r.own[0] === 1 && r.goals[1] === 0 && /lưới nhà|phản lưới/i.test(r.word), JSON.stringify(r));
  // 31. a lob dropping in
  r = await sc({ fmt: 'p1', ball: 'g => ({ x: 900, y: g.GROUND - 120, vx: -760, vy: -900 })' });
  check('lob dropping in: a goal', r.score === '0-1', JSON.stringify(r));
  // 32. lying on the line, not all of it over: no goal
  r = await sc({ ball: 'g => ({ x: g.goalD - g.R + 6, y: g.GROUND - g.R, vx: 0, vy: 0 })', secs: 2 });
  check('ball lying on the line (not all over it): no goal', r.score === '0-0', JSON.stringify(r));
  // 33. basketball through the ring from above / football over the bar
  r = await sc({ map: 'basket', fmt: 'p1', ball: 'g => ({ x: (g.boardX + g.rimFront) / 2, y: g.rimY - 250, vx: 0, vy: 100 })' });
  check('basketball: through the ring from above: a point', r.score === '0-1', JSON.stringify(r));
  r = await sc({ map: 'football', fmt: 'p1', ball: 'g => { const t = 400 / 1400; return { x: g.postX + 400, y: g.barY - 80, vx: -1400, vy: -0.5 * g.grav * t }; }' });
  check('football: over the bar between the posts: a point', r.score === '0-1', JSON.stringify(r));

  // --- the same checks on the other side of the pitch (blue keeper, right goal), on other pitches, in other modes ---
  const LOW = 'g => ({ x: g.goalD + 555, y: g.GROUND - g.R, vx: -1300, vy: 0 })';
  const keeperGrid = (offs, extra) => grid(offs, [0.12, 0.18, 0.24, 0.3], (dx, at) => Object.assign({ plFn: dx, press: [[0, at, 0.25]] }, extra || {}));
  async function keyCases(label, base) {
    // geometry of this pitch
    const geo = await page.evaluate(m => { const A = BGP.createWorld(m || 'soccer', null, 1).arena; return { goalD: A.goalD, R: A.P.ballR }; }, base.map);
    const kx = d => geo.goalD + d;
    let q = await find(Object.assign({ ball: LOW }, base), grid([65, 95, 125, 155, 185], [0.12, 0.18, 0.24, 0.3, 0.36], (dx, at) => ({ pl: [kx(dx)], press: [[0, at, 0.25]] })),
      (x, v) => x.touched0 && x.score === '0-0' && x.firstTouch0 > v.press[0][1]);
    check(label + ': low shot kicked away by the keeper = save', q.found && q.saves[0] === 1 && /save\[save\]/.test(q.clips), short(q));
    q = await find(Object.assign({ ball: 'g => ({ x: g.goalD + 555, y: g.GROUND - g.R - 60, vx: -1300, vy: -200 })' }, base), [65, 95, 125, 155].map(dx => ({ pl: [kx(dx)] })), x => x.touched0);
    check(label + ': keeper standing still, the ball hits him = no save', q.found && q.saves[0] === 0, short(q));
    q = await sc(Object.assign({ fmt: 'p1', ball: 'g => ({ x: g.goalD + 555, y: g.GROUND - g.R - 30, vx: -1300, vy: -100 })' }, base));
    check(label + ': shot into the empty goal = a point for blue', q.score === '0-1' && q.goals[1] === 1 && /goal/.test(q.clips), JSON.stringify(q));
    q = await sc(Object.assign({ fmt: 'p1', ball: 'g => ({ x: g.goalD + 355, y: g.GROUND - g.R, vx: -1100, vy: 0 })', touch: { team: 0, pid: 1, ago: 0 } }, base));
    check(label + ': own goal = a point for blue, an own goal for red', q.score === '0-1' && q.own[0] === 1, JSON.stringify(q));
    q = await sc(Object.assign({ secs: 1.2, ball: 'g => { const t = 535 / 1500; return { x: g.goalD + 535, y: g.goalTop - g.R - Math.round(0.5 * g.R), vx: -1500, vy: -0.5 * g.grav * t }; }' }, base));
    check(label + ': shot just over the bar = near miss', q.score === '0-0' && /miss/.test(q.clips), JSON.stringify(q));
    q = await sc(Object.assign({ secs: 1.2, ball: 'g => { const t = 535 / 1500; return { x: g.goalD + 535, y: g.goalTop - g.R * 5, vx: -1500, vy: -0.5 * g.grav * t }; }' }, base));
    check(label + ': shot well over the bar = no near miss', q.score === '0-0' && !/miss/.test(q.clips), JSON.stringify(q));
  }
  console.log('--- the other side of the pitch (blue keeper at the right goal) ---');
  await keyCases('right side', { mirror: true });
  r = await find({ mirror: true, ball: 'g => ({ x: 1215, y: 638, vx: -701, vy: -1099 })', touch: { team: 1, pid: 2, ago: 0 }, hold: 0, secs: 4.5 },
    grid([210, 230, 250, 270, 290, 310, 330], [0.3, 0.4, 0.5, 0.6], (x, after) => ({ pl: [x], rebound: { after, team: 0, pid: 1, x: 540, y: 520, vx: -800, vy: 100 } })),
    x => x.touched0 && x.rebounded && x.score === '0-0' && x.lastTouch0 > x.rebounded + 0.1);
  check('right side: save, team-mate heads it back, save again = ×2', r.found && r.saves[0] === 2 && /save×2/.test(r.clips), short(r));
  r = await find({ mirror: true, ball: 'g => ({ x: 1250, y: g.GROUND - g.R, vx: -1700, vy: 0 })' },
    grid([880, 930, 980], [0.08, 0.12, 0.16, 0.2, 0.24], (x, at) => ({ pl: [x], press: [[0, at, 0.25]] })), x => x.touched0 && x.score === '0-0');
  check('right side: blocked in the opponent\'s half = no save', r.found && r.saves[0] === 0, short(r));
  for (const m of ['moon', 'ice', 'giant']) { console.log('--- ' + m + ' ---'); await keyCases(m, { map: m }); }

  console.log('--- other modes ---');
  // 2 vs 2: each body is a person with its own button (slot = body)
  r = await find({ mode: 'team4', slots: ['h', 'h', 'h', 'h'], ball: LOW.replace('g.goalD + 555', '720') },
    grid([230, 260, 290, 320], [0.12, 0.18, 0.24, 0.3], (x, at) => ({ pl: [x], press: [[0, at, 0.25]] })), x => x.touched0 && x.score.split('-')[2] === '0');
  check('2 vs 2: P1 keeper saves = his save', r.found && r.saves[0] === 1 && r.saves[1] === 0, short(r));
  r = await find({ mode: 'team4', slots: ['h', 'h', 'h', 'h'], ball: LOW.replace('g.goalD + 555', '720') },
    grid([230, 260, 290, 320], [0.12, 0.18, 0.24, 0.3], (x, at) => ({ pl: [1500, x], press: [[1, at, 0.25]] })), x => x.touched0 && x.score.split('-')[2] === '0');
  check('2 vs 2: P2 (red\'s second player) saves = P2\'s save', r.found && r.saves[1] === 1 && r.saves[0] === 0, short(r));
  r = await find({ mode: 'ffa', slots: ['h', 'h', 'h', 'h'], ball: LOW.replace('g.goalD + 555', '720') },
    grid([230, 260, 290, 320], [0.12, 0.18, 0.24, 0.3], (x, at) => ({ pl: [1500, x], press: [[1, at, 0.25]] })), x => x.touched0 && x.score === '0-0-0-0');
  check('4 players: P2 saves = P2\'s save', r.found && r.saves[1] === 1, short(r));
  // against the bot, playing the right side: the player's keeper (blue) saves a shot at the right goal
  r = await find({ mode: 'bot', side: 'R', mirror: true, ball: LOW.replace('g.goalD + 555', '720') },
    grid([230, 260, 290, 320], [0.12, 0.18, 0.24, 0.3], (x, at) => ({ pl: [x, null, 1500, 1540], press: [[0, at, 0.25]] })), x => x.touched0 && x.score === '0-0');
  check('vs bot on the right side: the player\'s save is his', r.found && r.saves[0] === 1 && /save/.test(r.clips), short(r));
  // two balls: a save with the second ball
  r = await find({ twoBalls: true, ballIndex: 1, ball: LOW.replace('g.goalD + 555', '720') },
    grid([230, 260, 290, 320], [0.12, 0.18, 0.24, 0.3], (x, at) => ({ pl: [x], press: [[0, at, 0.25]] })), x => x.touched0 && x.score === '0-0');
  check('two balls: a save with the second ball', r.found && r.saves[0] === 1, short(r));

  check('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(fails ? fails + ' of ' + n + ' FAILED' : 'all ' + n + ' passed');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
