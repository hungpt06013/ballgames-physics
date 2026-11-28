// v4.2: the sides' stats of a match (possession, territory, shots, woodwork, near misses, clearances) and the players'
// blocks - on the end screen and in the history; bots going for a bicycle kick now and then; the giant ball's smaller
// goal, and a ball never taller than half the goal whatever the settings say.
// (Every stat checked against an independent referee on thousands of situations: test/stats.cjs.)
const { chromium } = require('playwright');
const path = require('path');
const E = require('../www/engine.js');
(async () => {
  let fails = 0, n = 0;
  const check = (name, ok, info) => { n++; if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info ? '  ' + info : '')); };

  console.log('--- the goal of the giant ball, the ball size ---');
  const arena = (m, size, beg) => E.buildArena(m, Object.assign({}, E.DEFAULT_SETTINGS, { ballSize: size, beginner: !!beg }), {});
  let A = arena('giant', 1);
  check('the giant ball\'s goal is smaller (300 high, 210 deep; it was 400 x 300)', A.goalH === 300 && A.goalD === 210, A.goalD + 'x' + A.goalH);
  const sizes = [0.7, 1, 1.2, 1.4, 1.6].map(s => ({ s, R: arena('giant', s).P.ballR, Rb: arena('giant', s, true).P.ballR, H: arena('giant', s).goalH, Hb: arena('giant', s, true).goalH }));
  check('giant ball x1.4 / x1.6: quietly brought down to half the goal\'s height (beginner mode too)', sizes.every(x => 2 * x.R <= x.H / 2 + 1e-9 && 2 * x.Rb <= x.Hb / 2 + 1e-9) && sizes[3].R === 75 && sizes[0].R < 62,
    JSON.stringify(sizes.map(x => [x.s, x.R, x.Rb])));
  check('...the sizes that fit are left alone (giant x1, every size on the ordinary pitch)', arena('giant', 1).P.ballR === 62 && [0.7, 1, 1.6].every(s => Math.abs(arena('soccer', s).P.ballR - 24 * s) < 1e-9),
    [0.7, 1, 1.6].map(s => arena('soccer', s).P.ballR).join());

  console.log('--- bots going for a bicycle kick ---');
  // a ball dropping near a bot's player in the half he attacks: with the chance forced, does the bot see a bicycle kick
  // somewhere, go for it, and really do it (the real physics, not its look ahead)?
  let tried = 0, done = 0, forward = 0, spots = 0;
  for (const bx of [-120, -60, 0, 60, 120]) for (const h of [240, 320, 400, 480, 560]) for (const vx of [-250, 0, 250]) {
    const w = E.createWorld('soccer', null, 3);
    w.players.forEach((q, i) => { q.x = [1000, 400, 1450, 1560][i]; q.y = E.GROUND - E.COM_H * q.sc; q.vx = q.vy = q.a = q.w = 0; E.shapes(q); });
    const b = w.ball; b.x = 1000 + bx; b.y = E.GROUND - h; b.vx = vx; b.vy = 0; b.touchT[0] = b.touchT[1] = -1; b.lastTeam = -1;
    const bot = new E.Bot(0, 'hard', 5);
    bot.rand = () => 0; // (always looks for one)
    let went = false, bike = false;
    spots++;
    for (let k = 0; k < 220; k++) {
      const p = bot.update(w);
      if (!went && bot.bikeUntil > w.time) went = true;
      E.stepPlayers(w, [p, p, false, false]);
      if (!bike && b.lastTeam === 0 && E.isBicycle(b, 0)) { bike = true; if (b.vx > 0) forward++; }
    }
    if (went) tried++;
    if (went && bike) done++;
  }
  check('a hard bot sees bicycle kicks in some of these balls, goes for them and really does them', tried >= 1 && done >= 1, spots + ' balls: went for it ' + tried + ', did it ' + done + ' (toward the goal: ' + forward + ')');
  // and never when there is no chance for one: the ball on the ground
  {
    const w = E.createWorld('soccer', null, 3), bot = new E.Bot(0, 'hard', 5);
    bot.rand = () => 0;
    w.ball.x = 1000; w.ball.y = E.GROUND - w.arena.P.ballR; w.ball.vx = w.ball.vy = 0;
    let went = false;
    for (let k = 0; k < 240; k++) { const p = bot.update(w); if (bot.bikeUntil > w.time) went = true; E.stepPlayers(w, [p, p, false, false]); }
    check('...never with the ball on the ground', !went, '');
  }

  console.log('--- the match stats in the game ---');
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PE ' + String(e.stack || e)));
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.waitForTimeout(400);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('bgp_prefs', JSON.stringify({ hlAsked: true, hlMode: 'none', askDress: false, replay: false })); });
  await page.reload(); await page.waitForTimeout(400);
  // one situation: red keeper (body 0) at kx, blue shoots / red kicks; the stats of the match afterwards
  const sit = o => page.evaluate(o => {
    const G = __game, E = BGP;
    __api.startMatch({ mode: '2p', fmt: 'p9', maps: [o.map || 'soccer'], mods: false, items: false, weather: false, slots2: ['h', 'h'] });
    __api.step(1 / 60, 110);
    const w = G.world, P = w.players;
    [o.kx || 1500, o.k2 || 1530, 1440, 1570].forEach((x, i) => { const p = P[i]; p.x = x; p.y = E.GROUND - E.COM_H * p.sc; p.vx = p.vy = p.a = p.w = 0; E.shapes(p); });
    const b = w.ball, s = o.ball;
    const kick = (k, team, pid) => { b.x = b.prevX = k.x; b.y = b.prevY = k.y; b.vx = k.vx; b.vy = k.vy; b.spin = 0; b.lastTeam = team; b.lastBy[team] = pid; b.lastPid = pid; b.touchT[team] = w.time; b.lastX = b.x; b.lastKind = 'kick'; b.lastAir = false; };
    b.touchT[0] = b.touchT[1] = -1;
    kick(s, o.by === 'red' ? 0 : 1, o.by === 'red' ? 1 : 2);
    if (G.cf) G.cf = new G.cf.constructor();
    const S = G.hlw; Object.assign(S, { threat: [null, null], cand: [], flight: [null, null], miss: [], lastT: [-1, -1], act: [null, null], sf: [null, null], futNow: [-1, -1], futPrev: [-1, -1], blocks: [] });
    Object.keys(G.ts).forEach(k => { if (Array.isArray(G.ts[k])) G.ts[k] = G.ts[k].map(() => 0); });
    G.ps.forEach(p => Object.keys(p).forEach(k => { p[k] = 0; }));
    G.dbg = [];
    const t0 = w.time;
    for (let i = 0; i < 3 * 120 && G.state === 'play'; i++) {
      if (o.press && Math.abs(w.time - t0 - o.press[0]) < 0.0045) G.hold[0] = w.time + o.press[1];
      if (o.kick && Math.abs(w.time - t0 - o.kick.at) < 0.0045) kick(o.kick, 0, 0);
      __api.step(1 / 120);
    }
    if (G.state === 'play') __api.endMatch(true);
    const T = G.ts, dbg = G.dbg.map(d => d.r).join(' ');
    G.dbg = null;
    return { on: T.on.slice(), off: T.off.slice(), wood: T.wood.slice(), clear: T.clear.slice(), saves: G.ps.map(p => p.saves), blocks: G.ps.map(p => p.blocks), score: G.score.join('-'), dbg };
  }, o);
  const GR = 780 - 24;
  let r = await sit({ kx: 260, ball: { x: 720, y: GR - 60, vx: -1300, vy: -200 } });
  check('a shot hitting the keeper standing there: no save, a block for him (and a shot on target)', r.blocks[0] === 1 && r.saves[0] === 0 && r.on[2] === 1, JSON.stringify(r));
  r = await sit({ kx: 230, ball: { x: 480, y: GR, vx: -320, vy: 0 } });
  check('a slow ball rolling into the keeper: a block, not a save', r.blocks[0] === 1 && r.saves[0] === 0, JSON.stringify(r));
  r = await sit({ kx: 230, ball: { x: 720, y: 600, vx: -1200, vy: -0.5 * 1700 * (470 / 1200) }, press: [0.2, 0.3] });
  check('a shot over his head cleared by his jump: a save, not a block', r.saves[0] === 1 && r.blocks[0] === 0, JSON.stringify(r));
  r = await sit({ kx: 300, ball: { x: 360, y: GR, vx: -1300, vy: 0 } });
  check('the keeper right next to the shooter (a scramble): neither save nor block', r.blocks[0] === 0 && r.saves[0] === 0, JSON.stringify(r));
  r = await sit({ ball: { x: 800, y: 330, vx: -1300, vy: -200 } });
  check('a hard shot sailing over the bar: a shot off target', r.off[2] === 1 && r.on[2] === 0, JSON.stringify(r));
  const dys = []; for (let dy = -60; dy >= -140; dy -= 4) dys.push(dy);
  let wood = null;
  for (const dy of dys) { const q = await sit({ ball: { x: 165 + 320, y: 450 + dy, vx: -1000, vy: 0 } }); if (q.wood[2] === 1 && q.score === '0-0') { wood = q; break; } }
  check('a shot off the crossbar: a shot off target, off the woodwork', !!wood && wood.off[2] === 1, JSON.stringify(wood));
  r = await sit({ by: 'red', ball: { x: 300, y: GR, vx: 0, vy: 0 }, kick: { at: 0.05, x: 300, y: GR - 60, vx: 1400, vy: -500 } });
  check('a defender booting the ball away from his own third: a clearance (no shot, even toward the other goal)', r.clear[0] === 1 && r.on[0] === 0 && r.off[0] === 0, JSON.stringify(r));
  r = await sit({ by: 'red', ball: { x: 900, y: GR, vx: 0, vy: 0 }, kick: { at: 0.05, x: 900, y: GR - 60, vx: 1400, vy: -500 } });
  check('the same kick from the middle: no clearance', r.clear[0] === 0, JSON.stringify(r));

  console.log('--- on the screen ---');
  // a real match between bots, then its end screen and its history entry
  r = await page.evaluate(() => {
    const G = __game;
    localStorage.setItem('bgp_meta', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('bgp_meta') || '{}'), {})));
    __api.startMatch({ mode: '2p', fmt: 'p2', maps: ['soccer'], mods: false, items: false, weather: false, slots2: ['b', 'b'], levels2: ['hard', 'hard'] });
    for (let i = 0; i < 60 * 300 && G.state !== 'over'; i++) __api.step(1 / 60);
    if (G.state !== 'over') __api.endMatch(true);
    const box = document.querySelector('#resultStats .tstats');
    const segs = box ? Array.from(box.querySelectorAll('.tseg')).map(e => e.textContent) : [];
    const rows = box ? Array.from(box.querySelectorAll('.trow')).map(e => e.textContent) : [];
    const head = Array.from(document.querySelectorAll('#resultStats .pstats .ph')).map(e => e.textContent);
    return new Promise(res => setTimeout(() => {
      const rec = BGHL.history()[0];
      res({ st: G.state, segs, rows, head, ts: rec && rec.ts, side: rec && rec.side });
    }, 100));
  });
  const pct = r.segs.map(x => parseInt(x));
  check('end screen: possession and territory as two bars of shares (each adding up to 100 %)', r.segs.length === 4 && pct[0] + pct[1] === 100 && pct[2] + pct[3] === 100, JSON.stringify(r.segs));
  check('...shots (on target), woodwork, near misses, clearances', ['Sút (trúng đích)', 'Trúng cột / xà', 'Suýt vào', 'Phá bóng'].every(t => r.rows.some(x => x.indexOf(t) >= 0)), JSON.stringify(r.rows));
  check('...the players\' table has the blocks (🛑)', r.head.indexOf('🛑') >= 0, JSON.stringify(r.head));
  check('the match keeps its stats in the history', r.ts && r.ts.list.length === 2 && typeof r.ts.list[0].poss === 'number', JSON.stringify(r.ts));
  await page.evaluate(() => { __api.toMenu(); document.querySelector('[data-act="history"]').click(); });
  await page.waitForTimeout(200);
  r = await page.evaluate(() => { const h = document.querySelector('#histList .hmain, #histList .hitem, .hitem'); if (h) h.click(); return null; });
  await page.waitForTimeout(200);
  r = await page.evaluate(() => ({ panels: document.querySelectorAll('.tstats').length, segs: Array.from(document.querySelectorAll('.tstats .tseg')).map(e => e.style.background) }));
  check('...and shows them there, in the colours that match was played in', r.panels >= 1 && r.segs.length === 4, JSON.stringify(r));
  // 4 players: a column each, bots by their place
  r = await page.evaluate(() => {
    const G = __game;
    __api.startMatch({ mode: 'ffa', fmt: 'p2', maps: ['soccer'], mods: false, items: false, weather: false, slots: ['b', 'b', 'b', 'b'], levels: ['hard', 'hard', 'hard', 'hard'] });
    for (let i = 0; i < 60 * 300 && G.state !== 'over'; i++) __api.step(1 / 60);
    if (G.state !== 'over') __api.endMatch(true);
    const g = document.querySelector('#resultStats .tgrid');
    return { names: g ? Array.from(g.querySelectorAll('.tn')).map(e => e.textContent) : [], cells: g ? g.children.length : 0, bars: document.querySelectorAll('#resultStats .tbar').length };
  });
  check('4 players: one grid, a column per player, bots named by their place, possession in %, no territory', r.names.join() === '🤖 P1,🤖 P2,🤖 P3,🤖 P4' && r.bars === 0 && r.cells === 5 * 6, JSON.stringify(r));

  check('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(fails ? fails + ' of ' + n + ' FAILED' : 'all ' + n + ' passed');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
