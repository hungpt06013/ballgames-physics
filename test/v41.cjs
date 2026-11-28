// v4.1: everybody in his own shirt colour (vs bot, 2 players, 4 players, 2 vs 2), more colours with no two alike, the
// bot's outfit, small names over the players, how high a ball / player above the screen is.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PE ' + String(e.stack || e)));
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.waitForTimeout(400);
  // an old save: the four profiles still in the colours of before (P1 red, P2 orange, P3 blue, P4 green)
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('bgp_meta', JSON.stringify({ coins: 0, profiles: [0, 1, 2, 3].map(i => ({ name: 'P' + (i + 1), color: i, hat: 'none', hair: 'default', shirt: 'plain' })) }));
  });
  await page.reload(); await page.waitForTimeout(400);
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('bgp_prefs')); p.hlAsked = true; p.hlMode = 'none'; p.askDress = false; localStorage.setItem('bgp_prefs', JSON.stringify(p)); });
  let fails = 0, n = 0;
  const check = (name, ok, info) => { n++; if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info ? '  ' + info : '')); };
  const ev = (f, a) => page.evaluate(f, a);

  console.log('--- colours ---');
  let r = await ev(() => BGMeta.D.profiles.map(p => p.color));
  check('old profiles never recoloured get the new defaults (P2 keeps the blue of 2-player games)', JSON.stringify(r) === '[0,2,3,1]', JSON.stringify(r));
  // no two colours alike: CIEDE2000 between every pair
  r = await ev(() => {
    function lab(h) {
      const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92);
      const x = (c[0] * 0.4124 + c[1] * 0.3576 + c[2] * 0.1805) / 0.95047, y = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722, z = (c[0] * 0.0193 + c[1] * 0.1192 + c[2] * 0.9505) / 1.08883;
      const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
      return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
    }
    function de(p, q) {
      const rad = Math.PI / 180, [L1, a1, b1] = p, [L2, a2, b2] = q, C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
      const G = 0.5 * (1 - Math.sqrt(Math.pow(Cb, 7) / (Math.pow(Cb, 7) + Math.pow(25, 7)))), a1p = (1 + G) * a1, a2p = (1 + G) * a2;
      const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2), h1 = (Math.atan2(b1, a1p) / rad + 360) % 360, h2 = (Math.atan2(b2, a2p) / rad + 360) % 360;
      let dh = h2 - h1; if (C1p * C2p === 0) dh = 0; else if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
      const dL = L2 - L1, dC = C2p - C1p, dH = 2 * Math.sqrt(C1p * C2p) * Math.sin(dh * rad / 2), Lb = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
      let hb = C1p * C2p === 0 ? h1 + h2 : (Math.abs(h1 - h2) <= 180 ? (h1 + h2) / 2 : (h1 + h2 < 360 ? (h1 + h2 + 360) / 2 : (h1 + h2 - 360) / 2));
      const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.2 * Math.cos((4 * hb - 63) * rad);
      const dt = 30 * Math.exp(-Math.pow((hb - 275) / 25, 2)), Rc = 2 * Math.sqrt(Math.pow(Cbp, 7) / (Math.pow(Cbp, 7) + Math.pow(25, 7)));
      const Sl = 1 + 0.015 * Math.pow(Lb - 50, 2) / Math.sqrt(20 + Math.pow(Lb - 50, 2)), Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T, Rt = -Math.sin(2 * dt * rad) * Rc;
      return Math.sqrt(Math.pow(dL / Sl, 2) + Math.pow(dC / Sc, 2) + Math.pow(dH / Sh, 2) + Rt * (dC / Sc) * (dH / Sh));
    }
    const C = BGMeta.COLORS, L = C.map(c => lab(c.main)); let min = 1e9, pair = '';
    for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) { const d = de(L[i], L[j]); if (d < min) { min = d; pair = C[i].name + '/' + C[j].name; } }
    return { n: C.length, min: +min.toFixed(1), pair, names: new Set(C.map(c => c.name)).size };
  });
  check('16 shirt colours, each with its own name, no two alike (CIEDE2000 ≥ 25 between every pair)', r.n === 16 && r.names === 16 && r.min >= 25, JSON.stringify(r));

  // every mode: nobody in the same colour as anyone else, whatever the profiles say
  const looks = (mode, setup) => ev(([mode, setup]) => {
    const D = BGMeta.D;
    setup.cols.forEach((c, i) => { D.profiles[i].color = c; });
    if (setup.bot !== undefined) D.bot.color = setup.bot;
    __api.startMatch({ mode, fmt: 'p9', maps: ['soccer'], mods: false, items: false, weather: false, slots: setup.slots, levels: ['easy', 'normal', 'hard', 'hard'], slots2: setup.slots2, levels2: ['easy', 'hard'] });
    __api.step(1 / 60, 20);
    const G = __game, L = G.looks;
    return { cols: L.p.map(x => x.col.main), side: L.side.map(x => x.main), shorts: L.p.map(x => x.shorts || null), names: L.p.map(x => x.name),
      hats: L.p.map(x => x.hat), shirts: L.p.map(x => x.shirt), team: [0, 1].map(t => G.world.players[t * 2].team) };
  }, [mode, setup]);
  const people = (q, four) => four ? q.cols : [q.cols[0], q.cols[2]];
  const allDiff = a => new Set(a).size === a.length;
  r = await looks('2p', { cols: [5, 5, 3, 1], slots2: ['h', 'h'] });
  check('2 players picking the same colour: P2 gets another one; both bodies of a side in it', allDiff(people(r)) && r.cols[0] === r.cols[1] && r.cols[2] === r.cols[3] && r.cols[0] === BGMetaColor(5), JSON.stringify(r));
  function BGMetaColor(i) { return ['#ef5b5b', '#f29a3f', '#3fb4ea', '#6ade5f', '#8b70f4', '#ffa9e7', '#fee526', '#009f8b', '#2b2b2b', '#ffffff', '#3222a1', '#8a5123', '#910042', '#8d8a15', '#8a888c', '#13631f'][i]; }
  check('...the sides (score, buttons) are in the colours of their people', r.side[0] === r.cols[0] && r.side[1] === r.cols[2], JSON.stringify(r.side));
  r = await looks('bot', { cols: [2, 0, 3, 1], bot: 2 });
  check('vs bot: the bot gives way when the player wears its colour', allDiff(people(r)) && r.cols[0] === BGMetaColor(2), JSON.stringify(r));
  r = await looks('ffa', { cols: [4, 4, 4, 4], slots: ['h', 'h', 'h', 'h'] });
  check('4 players all picking purple: four different colours, P1 keeps purple', allDiff(r.cols) && r.cols[0] === BGMetaColor(4), JSON.stringify(r.cols));
  r = await looks('ffa', { cols: [0, 2, 3, 1], slots: ['h', 'b', 'b', 'b'], bot: 0 });
  check('4 players, three bots: every bot in a colour of its own, none in the player\'s', allDiff(r.cols) && r.cols[0] === BGMetaColor(0), JSON.stringify(r.cols));
  r = await looks('team4', { cols: [0, 2, 3, 1], slots: ['h', 'h', 'h', 'h'] });
  check('2 vs 2: four different shirts, the team\'s colour on the shorts', allDiff(r.cols) && r.shorts[0] === r.shorts[1] && r.shorts[2] === r.shorts[3] && r.shorts[0] !== r.shorts[2], JSON.stringify(r));
  r = await looks('team4', { cols: [6, 6, 6, 6], slots: ['h', 'b', 'h', 'b'] });
  check('2 vs 2 with bots, everybody wanting yellow: still four different shirts', allDiff(r.cols), JSON.stringify(r.cols));
  // the bot's outfit
  r = await ev(() => { const B = BGMeta.D.bot; BGMeta.D.owned.hat.crown = 1; BGMeta.D.owned.shirt.stars = 1; BGMeta.equip('hat', 'crown', 'bot'); BGMeta.equip('shirt', 'stars', 'bot'); B.color = 7; return B; });
  let q = await looks('bot', { cols: [0, 2, 3, 1] });
  check('the bot wears the outfit chosen for it (hat, shirt, colour)', q.hats[2] === 'crown' && q.shirts[2] === 'stars' && q.cols[2] === BGMetaColor(7), JSON.stringify(q));
  check('small names: the player\'s name over his bodies, the bot by its level', q.names[0] === 'P1' && /Bot/.test(q.names[2]), JSON.stringify(q.names));

  console.log('--- the players screen ---');
  await ev(() => { __api.toMenu(); });
  await page.waitForTimeout(200);
  await ev(() => document.querySelector('[data-act="profiles"]').click()); await page.waitForTimeout(150);
  await ev(() => document.querySelector('#profMode [data-v="2"]').click()); await page.waitForTimeout(100);
  await ev(() => document.querySelector('#profTabs [data-tab="shirt"]').click()); await page.waitForTimeout(100);
  r = await ev(() => ({ shown: !document.getElementById('profColorBox').classList.contains('hidden'), n: document.querySelectorAll('#profColors button').length,
    taken: Array.from(document.querySelectorAll('#profColors button.taken')).map(b => b.dataset.who) }));
  check('2 players: the colours are there (16), the one P2 wears is marked', r.shown && r.n === 16 && r.taken.join() === 'P2', JSON.stringify(r));
  await ev(() => { BGMeta.D.profiles[0].color = 0; BGMeta.D.profiles[1].color = 2; document.querySelector('#profMode [data-v="2"]').click(); });
  await page.waitForTimeout(100);
  await ev(() => document.querySelector('#profColors button:nth-child(3)').click()); await page.waitForTimeout(100); // P1 takes P2's blue
  r = await ev(() => BGMeta.D.profiles.slice(0, 2).map(p => p.color));
  check('P1 choosing the blue P2 wears: the two swap (P1 blue, P2 red)', r[0] === 2 && r[1] === 0, JSON.stringify(r));
  await ev(() => document.querySelector('#profMode [data-v="bot"]').click()); await page.waitForTimeout(100);
  r = await ev(() => ({ cards: document.querySelectorAll('#profCards .pcard').length, botName: document.querySelectorAll('#profCards input.name')[1].value,
    ro: document.querySelectorAll('#profCards input.name')[1].readOnly }));
  check('🤖 Bot: the player and the bot side by side, the bot\'s name not editable', r.cards === 2 && /Bot/.test(r.botName) && r.ro, JSON.stringify(r));
  await ev(() => { document.querySelectorAll('#profCards .pcard')[1].click(); }); await page.waitForTimeout(100);
  await ev(() => { document.querySelector('#profTabs [data-tab="hat"]').click(); }); await page.waitForTimeout(100);
  await ev(() => { const c = Array.from(document.querySelectorAll('#profGrid .card')).find(x => x.dataset.id === 'none'); c.click(); }); await page.waitForTimeout(100);
  r = await ev(() => ({ title: document.getElementById('profFor').textContent, hat: BGMeta.D.bot.hat }));
  check('dressing the bot from its card (its hat taken off)', /Bot/.test(r.title) && r.hat === 'none', JSON.stringify(r));

  console.log('--- in the match ---');
  // a spy on the text drawn on the match canvas
  const drawn = (mode, fn) => ev(([mode, fn]) => {
    if (mode === 'tutorial') __api.startTutorial(); else __api.startMatch({ mode, fmt: 'p9', maps: ['soccer'], mods: false, items: false, weather: false, slots: ['h', 'h', 'h', 'b'] });
    __api.step(1 / 60, 140);
    (new Function('w', 'E', fn))(__game.world, BGP);
    const out = [], P = CanvasRenderingContext2D.prototype, of = P.fillText;
    P.fillText = function (t, x, y) { out.push({ t: String(t), fs: parseFloat(/(\d+(\.\d+)?)px/.exec(this.font)[1]) }); return of.apply(this, arguments); };
    __api.step(1 / 60, 1);
    return new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => { P.fillText = of; res(out); })));
  }, [mode, fn]);
  await ev(() => { BGMeta.D.profiles[0].name = 'Dihfish'; BGMeta.D.profiles[1].name = 'Lan'; });
  r = await drawn('2p', '');
  let names = r.filter(x => x.t === 'Dihfish' || x.t === 'Lan');
  check('2 players: a small name over every body (two each), 14 - 20 px', names.filter(x => x.t === 'Dihfish').length >= 2 && names.filter(x => x.t === 'Lan').length >= 2 &&
    names.every(x => x.fs >= 14 && x.fs <= 20), JSON.stringify(names.slice(0, 6)));
  r = await drawn('team4', '');
  check('2 vs 2: small names, the bot by its level', ['Dihfish', 'Lan'].every(nm => r.some(x => x.t === nm)) && r.some(x => /Bot/.test(x.t) && x.fs <= 20), JSON.stringify(r.filter(x => /Bot|Dihfish|Lan|P3/.test(x.t)).slice(0, 6)));
  // how high: a ball and a player above the top of the screen
  r = await drawn('2p', 'w.ball.x = 600; w.ball.y = -480; w.ball.vy = 0; const p = w.players[2]; p.y = -260; E.shapes(p);');
  const hs = r.filter(x => /^\d+(,\d)?m$/.test(x.t));
  check('ball and player above the screen: their height under the arrow ("12m", "9,0m"), small', hs.length >= 2 && hs.every(x => x.fs >= 14 && x.fs <= 21) && hs.some(x => x.t === '12m'), JSON.stringify(hs));
  r = await drawn('2p', 'w.ball.x = 600; w.ball.y = 100; w.ball.vy = 0;');
  check('a ball still on the screen: no height shown', !r.some(x => /^\d+(,\d)?m$/.test(x.t)), JSON.stringify(r.filter(x => /m$/.test(x.t))));
  r = await drawn('tutorial', '');
  check('the tutorial: no names over the players', !r.some(x => x.t === 'Dihfish'), '');

  console.log('--- history ---');
  r = await ev(() => {
    __api.startMatch({ mode: '2p', fmt: 'p1', maps: ['soccer'], mods: false, items: false, weather: false, slots2: ['h', 'h'] });
    __api.step(1 / 60, 30);
    const G = __game; G.score = [1, 0]; __api.endMatch();
    const side = G.looks.side.map(c => c.main);
    // (the match goes into the history a moment later)
    return new Promise(res => setTimeout(() => { const rec = BGHL.history()[0] || null; res({ side, rec: rec && rec.side ? rec.side.map(c => c.main) : null }); }, 100));
  });
  check('a finished match keeps its colours for the history', r.rec && r.rec.join() === r.side.join(), JSON.stringify(r));

  check('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(fails ? fails + ' of ' + n + ' FAILED' : 'all ' + n + ' passed');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
