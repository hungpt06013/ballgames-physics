// v3.9: the player screen shows one kind of thing at a time (🎩 hats · 💇 hair · 👕 shirts · ⚽ ball); hats, hair and
// shirts are the chosen player's, the ball is everybody's; only what was bought is there, with a way to the shop
// (which opens on that kind, for that player); the new shop items are there and get drawn without errors.
// node test/v39.cjs
const { chromium } = require('playwright');
const path = require('path');
const SH = path.resolve(__dirname, '../shots_v39');
(async () => {
  require('fs').mkdirSync(SH, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  const page = await (await browser.newContext({ viewport: { width: 780, height: 360 }, deviceScaleFactor: 2 })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e.stack || e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('bgp_prefs') || '{}'); p.hlAsked = true; p.hlMode = 'none'; localStorage.setItem('bgp_prefs', JSON.stringify(p));
    const m = JSON.parse(localStorage.getItem('bgp_meta') || '{}'); m.tutorialDone = true; m.coins = 300; localStorage.setItem('bgp_meta', JSON.stringify(m));
  });
  await page.reload(); await page.waitForTimeout(400);
  let fails = 0;
  const check = (name, ok, info) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== undefined ? '  ' + info : '')); };
  const ev = (f, a) => page.evaluate(f, a);
  const grid = () => ev(() => Array.from(document.querySelectorAll('#profGrid .card')).map(c => (c.classList.contains('eq') ? '*' : '') + (c.dataset.id || 'MORE')));

  // the shop has the new things, cheapest first
  const shop = await ev(() => { const S = BGMeta.SHOP, out = {}; for (const k in S) out[k] = { n: S[k].length, sorted: S[k].slice(1).every((it, i, a) => !i || a[i - 1].price <= it.price), free: S[k][0].price === 0 }; return out; });
  check('shop: 18 hats, 12 hair styles, 12 shirts, 14 balls, cheapest first', shop.hat.n === 18 && shop.hair.n === 12 && shop.shirt.n === 12 && shop.ball.n === 14 && Object.values(shop).every(s => s.sorted && s.free), JSON.stringify(shop));
  // every item drawn (on a player / as the ball) without an error
  const drawn = await ev(() => {
    const cv = document.createElement('canvas'); cv.width = 200; cv.height = 300; const c = cv.getContext('2d'), p = BGP.createWorld('soccer', null, 1).players[0], bad = [];
    p.x = 100; p.y = 200;
    for (const cat of ['hat', 'hair', 'shirt']) for (const it of BGMeta.SHOP[cat]) for (const f of [1, -1]) {
      p.f = f; try { BGDraw.player(c, p, { col: { main: '#ef5b5b', dark: '#c63e44' }, hat: cat === 'hat' ? it.id : 'none', hair: cat === 'hair' ? it.id : 'default', shirt: cat === 'shirt' ? it.id : 'plain', num: 1, face: 'happy', hairCol: '#000', mapId: 'soccer' }); } catch (e) { bad.push(cat + ':' + it.id + ' ' + e); }
    }
    for (const it of BGMeta.SHOP.ball) try { BGDraw.ball(c, { x: 100, y: 100, ang: 1 }, 'soccer', 24, { skin: it.id, t: 0 }); } catch (e) { bad.push('ball:' + it.id + ' ' + e); }
    return bad;
  });
  check('every hat, hair style, shirt and ball is drawn', drawn.length === 0, drawn.join(' | '));

  await ev(() => document.querySelector('[data-act="profiles"]').click()); await page.waitForTimeout(250);
  let ui = await ev(() => ({ tabs: Array.from(document.querySelectorAll('#profTabs button')).map(b => b.dataset.tab + (b.classList.contains('on') ? '*' : '')), title: document.getElementById('profFor').textContent }));
  check('the player screen opens on the hats of P1, with tabs hats / hair / shirts / ball', ui.tabs.join() === 'hat*,hair,shirt,ball' && /^Mũ của P1/.test(ui.title), JSON.stringify(ui));
  let g = await grid();
  check('only the hats he has (none bought yet: "no hat") and a way to the shop', g.join() === '*none,MORE', g.join());
  await page.screenshot({ path: SH + '/01_hats.png' });

  // buy a cap and a smiley ball with the shop's own rules, then come back
  await ev(() => { BGMeta.buy('hat', 'cap'); BGMeta.buy('hair', 'curly'); BGMeta.buy('ball', 'tennis'); });
  await ev(() => Array.from(document.querySelectorAll('#profGrid .card.more'))[0].click()); await page.waitForTimeout(200);
  const sh = await ev(() => ({ screen: __game.screen, tab: document.querySelector('#shopTabs .on').textContent, slot: document.querySelector('#shopSlot .on').textContent }));
  check('"Mua thêm" opens the shop on hats, for P1', sh.screen === 'shop' && sh.tab === 'Mũ' && sh.slot === 'P1', JSON.stringify(sh));
  await ev(() => document.querySelector('#shop [data-act="back"]').click()); await page.waitForTimeout(200);
  g = await grid();
  check('...and back on the player screen the cap is there to wear', (await ev(() => __game.screen)) === 'profiles' && g.join() === '*none,cap,MORE', g.join());
  await ev(() => document.querySelector('#profGrid .card[data-id="cap"]').click()); await page.waitForTimeout(150);
  ui = await ev(() => ({ p1: BGMeta.profile(0).hat, p2: BGMeta.profile(1).hat, g: Array.from(document.querySelectorAll('#profGrid .card.eq')).map(c => c.dataset.id) }));
  check('tapping the cap puts it on P1 (not P2)', ui.p1 === 'cap' && ui.p2 === 'none' && ui.g.join() === 'cap', JSON.stringify(ui));

  // hair tab, for P2
  await ev(() => document.querySelectorAll('#profCards .pcard canvas')[1].click()); await page.waitForTimeout(150);
  await ev(() => document.querySelector('#profTabs button[data-tab="hair"]').click()); await page.waitForTimeout(150);
  ui = await ev(() => ({ title: document.getElementById('profFor').textContent, colors: !document.getElementById('profColorBox').classList.contains('hidden') }));
  g = await grid();
  check('hair tab of P2: his hair styles only', /^Tóc của P2/.test(ui.title) && g.join() === '*default,curly,MORE' && !ui.colors, JSON.stringify(ui) + ' ' + g.join());
  await ev(() => document.querySelector('#profGrid .card[data-id="curly"]').click()); await page.waitForTimeout(150);
  check('...curly hair on P2 only', (await ev(() => [BGMeta.profile(0).hair, BGMeta.profile(1).hair].join())) === 'default,curly');
  await page.screenshot({ path: SH + '/02_hair_p2.png' });

  // ball tab: everybody's, nobody picked, the ball at everybody's feet
  await ev(() => document.querySelector('#profTabs button[data-tab="ball"]').click()); await page.waitForTimeout(150);
  ui = await ev(() => ({ title: document.getElementById('profFor').textContent, shared: document.getElementById('profCards').classList.contains('shared'),
    marked: getComputedStyle(document.querySelector('#profCards .pcard.on')).borderTopColor }));
  g = await grid();
  check('ball tab: "the same for all players", no player marked', /chung cho mọi người chơi/.test(ui.title) && ui.shared && /rgba\(0, 0, 0, 0\)|transparent/.test(ui.marked) && g.join() === '*classic,tennis,MORE', JSON.stringify(ui) + ' ' + g.join());
  await ev(() => document.querySelector('#profGrid .card[data-id="tennis"]').click()); await page.waitForTimeout(150);
  check('...the tennis ball is everybody\'s ball', (await ev(() => BGMeta.D.ball)) === 'tennis');
  await page.screenshot({ path: SH + '/03_ball.png' });
  await ev(() => document.querySelector('#profiles [data-act="shop"]').click()); await page.waitForTimeout(150);
  ui = await ev(() => ({ tab: document.querySelector('#shopTabs .on').textContent, forHidden: document.getElementById('shopFor').classList.contains('hidden') }));
  check('the 🛒 button from the ball tab opens the shop on balls', ui.tab === 'Bóng' && ui.forHidden, JSON.stringify(ui));
  await ev(() => document.querySelector('#shop [data-act="back"]').click()); await page.waitForTimeout(150);

  // 4 players: the jersey colours are with the shirts
  await ev(() => document.querySelector('#profMode button[data-v="4"]').click()); await page.waitForTimeout(150);
  await ev(() => document.querySelector('#profTabs button[data-tab="shirt"]').click()); await page.waitForTimeout(150);
  ui = await ev(() => ({ colors: !document.getElementById('profColorBox').classList.contains('hidden'), cards: document.querySelectorAll('#profCards .pcard').length }));
  await ev(() => document.querySelector('#profTabs button[data-tab="hat"]').click()); await page.waitForTimeout(150);
  const hatColors = await ev(() => !document.getElementById('profColorBox').classList.contains('hidden'));
  check('4 players: jersey colours on the shirt tab, not on the hat tab', ui.colors && ui.cards === 4 && !hatColors, JSON.stringify(ui) + ' hat tab colours ' + hatColors);
  const fit = await ev(() => { const p = document.querySelector('#profiles .panel'); return { sh: p.scrollHeight, ch: p.clientHeight, w: document.documentElement.scrollWidth }; });
  check('fits a phone held sideways (no scrolling)', fit.sh <= fit.ch + 1 && fit.w <= 780, JSON.stringify(fit));
  await page.screenshot({ path: SH + '/04_four.png' });

  // the match draws the new things
  await ev(() => { BGMeta.D.owned.hat.tophat = 1; BGMeta.equip('hat', 'tophat', 0); BGMeta.D.owned.ball.disco = 1; BGMeta.equip('ball', 'disco'); });
  await ev(() => __api.startMatch({ mode: '2p', fmt: 'p1', maps: ['soccer'], mods: false, items: false, weather: false }));
  await ev(() => __api.step(1 / 60, 120)); await page.waitForTimeout(200);
  await page.screenshot({ path: SH + '/05_match.png' });
  check('no errors', errs.length === 0, errs.join('\n'));
  console.log(fails ? fails + ' FAILED' : 'all checks passed');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
