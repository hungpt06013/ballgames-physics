// Online play for real (two or more browser pages joined over the PeerJS server): make a room, join it with the code,
// play a timed match with presses on every device, and check that
//  - every guest's replays from the host's real states are exact (bit for bit), many times over,
//  - a guest's press moves his own player on the host's real match,
//  - everybody ends with the same score and sees the result; nobody has a page error.
// node test/online.cjs [guests=1] [mode=2p|ffa|team4] [seconds=40] [latency ms=0] [jitter ms=0] [loss=0]
// (latency / jitter / loss: a slower network on every device, each way)
const { chromium } = require('playwright');
const path = require('path');
const GUESTS = +(process.argv[2] || 1), MODE = process.argv[3] || '2p', SECS = +(process.argv[4] || 40);
const NET = { lat: +(process.argv[5] || 0), jit: +(process.argv[6] || 0), loss: +(process.argv[7] || 0) };
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  let fails = 0;
  const check = (name, ok, info) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== undefined ? '  ' + info : '')); };
  async function device(name, prefsPatch) {
    const ctx = await browser.newContext({ viewport: { width: 800, height: 380 } });
    const page = await ctx.newPage();
    page.errs = [];
    page.on('pageerror', e => page.errs.push(name + ': ' + String(e.stack || e)));
    page.on('console', m => { if (m.type() === 'error' && !/WebSocket|ERR_|net::|favicon/i.test(m.text())) page.errs.push(name + ' console: ' + m.text()); });
    await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
    await page.waitForTimeout(300);
    await page.evaluate(([nm, pp]) => {
      const p = JSON.parse(localStorage.getItem('bgp_prefs') || '{}'); p.hlAsked = true; p.hlMode = 'none'; Object.assign(p, pp || {}); localStorage.setItem('bgp_prefs', JSON.stringify(p));
      const m = JSON.parse(localStorage.getItem('bgp_meta') || '{}'); m.tutorialDone = true; m.profiles = [{ name: nm }]; localStorage.setItem('bgp_meta', JSON.stringify(m));
    }, [name, prefsPatch]);
    if (NET.lat || NET.jit || NET.loss) await page.addInitScript(n => { window.BGP_TEST_NET = n; }, NET);
    await page.reload(); await page.waitForTimeout(400);
    return page;
  }
  const host = await device('Chủ', { fmtType: 't', fmtMinutes: SECS / 60, maps: ['soccer', 'giant', 'moon'], mods: true, items: true, weather: true, onlineMode: MODE });
  const guests = [];
  for (let i = 0; i < GUESTS; i++) guests.push(await device('Khách' + (i + 1)));
  const all = [host, ...guests];

  // host: make a room
  await host.evaluate(() => document.querySelector('[data-act="online"]').click());
  await host.waitForTimeout(200);
  await host.evaluate(() => document.getElementById('onCreate').click());
  let code = '';
  for (let i = 0; i < 60 && !code; i++) { await host.waitForTimeout(250); code = await host.evaluate(() => window.__game.net && window.__game.net.code); }
  check('the host gets a room code', /^[A-Z2-9]{5}$/.test(code || ''), code);
  if (MODE !== '2p') { await host.evaluate(m => document.querySelector('#onMode button[data-v="' + m + '"]').click(), MODE); await host.waitForTimeout(100); }
  // guests: join with the code
  for (const g of guests) {
    await g.evaluate(() => document.querySelector('[data-act="online"]').click());
    await g.waitForTimeout(150);
    await g.fill('#onCode', code.toLowerCase());
    await g.evaluate(() => document.getElementById('onJoin').click());
  }
  let seated = [];
  for (let i = 0; i < 80; i++) {
    await host.waitForTimeout(250);
    seated = await host.evaluate(() => (window.__game.net.slots || []).map(s => s.who ? (s.who === 'host' ? 'H' : 'G') : '-').join(''));
    if (seated.split('G').length - 1 >= GUESTS) break;
  }
  check('everybody is in the room', seated.split('G').length - 1 === GUESTS, seated);
  let roomOnGuest = [];
  for (let i = 0; i < 30; i++) {
    roomOnGuest = await guests[0].evaluate(() => Array.from(document.querySelectorAll('#onSlots .onSlot .who')).map(e => e.textContent));
    if (roomOnGuest.some(t => /Chủ/.test(t))) break;
    await guests[0].waitForTimeout(100);
  }
  check('a guest sees the room (the host and himself)', roomOnGuest.some(t => /Chủ/.test(t)) && roomOnGuest.some(t => /Khách1 \(bạn\)/.test(t)), JSON.stringify(roomOnGuest));
  await host.screenshot({ path: path.resolve(__dirname, '../shots_online/01_room_host.png') }).catch(() => {});
  await guests[0].screenshot({ path: path.resolve(__dirname, '../shots_online/02_room_guest.png') }).catch(() => {});

  // the match
  await host.evaluate(() => document.getElementById('onGo').click());
  let states = [];
  for (let i = 0; i < 40; i++) {
    await host.waitForTimeout(200);
    states = await Promise.all(all.map(p => p.evaluate(() => window.__game.state)));
    if (states.every(s => s === 'play')) break;
  }
  check('the match starts on every device', states.every(s => s === 'play'), states.join(','));
  // (v4.1) everybody in his own colour, the same on every device, and the small names over the players
  const lk = await Promise.all(all.map(p => p.evaluate(() => { const L = window.__game.looks; return { cols: L.p.map(x => x.col.main).join(), side: L.side.map(x => x.main).join(), names: L.p.map(x => x.name).join() }; })));
  const ppl = MODE === '2p' ? lk[0].cols.split(',').filter((_, i) => i % 2 === 0) : lk[0].cols.split(',');
  check('every device shows the same shirts, side colours and names; nobody in the same colour', lk.every(x => x.cols === lk[0].cols && x.side === lk[0].side && x.names === lk[0].names) &&
    new Set(ppl).size === ppl.length && /Chủ/.test(lk[0].names), JSON.stringify(lk[0]));
  // a guest's press moves his own player in the host's real match
  const g0slot = await guests[0].evaluate(() => window.__game.net.slot);
  const pid = MODE === '2p' ? g0slot * 2 : g0slot;
  const before = await host.evaluate(i => ({ y: window.__game.world.players[i].y, vy: window.__game.world.players[i].vy }), pid);
  await guests[0].evaluate(() => { const t = document.getElementById('touch'), o = { pointerId: 7, clientX: 400, clientY: 200, bubbles: true }; t.dispatchEvent(new PointerEvent('pointerdown', o)); setTimeout(() => t.dispatchEvent(new PointerEvent('pointerup', o)), 120); });
  let minY = before.y;
  for (let i = 0; i < 25 + NET.lat / 20; i++) { await host.waitForTimeout(40); minY = Math.min(minY, await host.evaluate(i => window.__game.world.players[i].y, pid)); }
  check('a guest\'s press makes his player jump in the host\'s match', minY < before.y - 40, 'y ' + before.y.toFixed(0) + ' -> lowest ' + minY.toFixed(0));
  await host.screenshot({ path: path.resolve(__dirname, '../shots_online/03_match_host.png') }).catch(() => {});
  await guests[0].screenshot({ path: path.resolve(__dirname, '../shots_online/04_match_guest.png') }).catch(() => {});

  // presses on every device until the time is up
  for (const p of all) await p.evaluate(() => {
    let id = 100;
    window.__presser = setInterval(() => {
      if (Math.random() < 0.5) return;
      const t = document.getElementById('touch'), o = { pointerId: ++id, clientX: 300 + Math.random() * 200, clientY: 200, bubbles: true };
      t.dispatchEvent(new PointerEvent('pointerdown', o));
      setTimeout(() => t.dispatchEvent(new PointerEvent('pointerup', o)), 40 + Math.random() * 500);
    }, 450);
  });
  let rounds = new Set(), sawScored = false, guestStates = new Set();
  for (let i = 0; i < (SECS + 40) * 4; i++) {
    await host.waitForTimeout(250);
    const hs = await host.evaluate(() => ({ s: window.__game.state, r: window.__game.round }));
    rounds.add(hs.r); if (hs.s === 'scored') sawScored = true;
    const gs = await guests[0].evaluate(() => window.__game.state); guestStates.add(gs);
    if (hs.s === 'over') break;
  }
  for (const p of all) await p.evaluate(() => clearInterval(window.__presser));
  await host.waitForTimeout(1500);
  const end = await Promise.all(all.map(p => p.evaluate(() => ({ state: window.__game.state, score: (window.__game.score || []).join('-'), screen: window.__game.screen,
    check: window.__game.net && window.__game.net.sess ? window.__game.net.sess.check : null, pred: window.__game.net && window.__game.net.sess ? window.__game.net.sess.pred.stats : null }))));
  console.log('host', JSON.stringify(end[0].pred), 'rounds', [...rounds].join(','), 'guest states seen', [...guestStates].join(','));
  end.slice(1).forEach((e, i) => console.log('guest ' + (i + 1), JSON.stringify(e.check), JSON.stringify(e.pred)));
  check('the match ends on every device with the result', end.every(e => e.state === 'over' && e.screen === 'over'), end.map(e => e.state + '/' + e.screen).join(','));
  check('every device has the same score', end.every(e => e.score === end[0].score), end.map(e => e.score).join(' | '));
  const checks = end.slice(1).reduce((a, e) => ({ done: a.done + (e.check ? e.check.done : 0), bad: a.bad + (e.check ? e.check.bad : 0) }), { done: 0, bad: 0 });
  check('guests\' replays from the host\'s real states are exact, every time', checks.done > 50 * GUESTS && checks.bad === 0, checks.done + ' replays, ' + checks.bad + ' different');
  await host.screenshot({ path: path.resolve(__dirname, '../shots_online/05_over_host.png') }).catch(() => {});
  await guests[0].screenshot({ path: path.resolve(__dirname, '../shots_online/06_over_guest.png') }).catch(() => {});
  // back to the room, then a guest leaves
  await host.evaluate(() => { const b = Array.from(document.querySelectorAll('#overTools button')).find(x => /Về phòng/.test(x.textContent)); b && b.click(); });
  await host.waitForTimeout(1200);
  const back = await Promise.all(all.map(p => p.evaluate(() => window.__game.screen)));
  check('"Về phòng" takes everybody back to the room', back.every(s => s === 'online'), back.join(','));
  await guests[0].evaluate(() => { window.__game.net && document.getElementById('onLeave').click(); });
  await guests[0].waitForTimeout(200);
  await guests[0].evaluate(() => { const b = Array.from(document.querySelectorAll('#dlgBtns button')).find(x => /Rời/.test(x.textContent)); b && b.click(); });
  let left = '';
  for (let i = 0; i < 20; i++) { await host.waitForTimeout(250); left = await host.evaluate(() => window.__game.net.slots.map(s => s.who ? 'x' : '-').join('')); if ((left.match(/x/g) || []).length === GUESTS) break; }
  check('a guest leaving frees his place', (left.match(/x/g) || []).length === GUESTS, left);
  const errs = all.flatMap(p => p.errs);
  check('no page errors', errs.length === 0, errs.slice(0, 5).join('\n'));
  console.log(fails ? fails + ' FAILED' : 'all checks passed');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
