// Start in the match setup asks first whether to change the players' names / outfits: "Đổi" opens the player cards
// (the right ones for the mode) and their button goes on into the match; "Đá luôn" starts it; "don't ask again"
// stops the question, and Settings switches it back on. A match of bots only doesn't ask.
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
  const ev = (f, a) => page.evaluate(f, a);
  const dlgOpen = () => ev(() => !document.getElementById('dialog').classList.contains('hidden'));
  const dlgBtn = t => ev(t => Array.from(document.querySelectorAll('#dlgBtns button')).find(b => b.textContent.indexOf(t) >= 0).click(), t);
  const start = async mode => { await ev(m => document.querySelector('[data-act="setup"][data-mode="' + m + '"]').click(), mode); await page.waitForTimeout(150); await ev(() => document.querySelector('#setup [data-act="start"]').click()); await page.waitForTimeout(200); };
  const toMenu = () => ev(() => { __api.toMenu ? __api.toMenu() : null; });

  // 2 vs 2 with people: asked; "Đổi" opens the 4-player cards in 2 vs 2 view; its button goes into the match
  await start('team4');
  const q = await ev(() => ({ title: document.getElementById('dlgTitle').textContent, body: document.getElementById('dlgBody').textContent, btns: Array.from(document.querySelectorAll('#dlgBtns button')).map(b => b.textContent) }));
  check('Start asks about names / outfits, with "don\'t ask again"', (await dlgOpen()) && /trang phục/.test(q.body) && /Không hỏi lại/.test(q.body) && q.btns.join('|') === '👤 Đổi|▶ Đá luôn', JSON.stringify(q));
  await dlgBtn('Đổi'); await page.waitForTimeout(200);
  const prof = await ev(() => ({ screen: __game.screen, cards: document.querySelectorAll('#profCards .pcard').length, four: document.querySelector('#profFour button.on') && document.querySelector('#profFour button.on').dataset.v, done: document.getElementById('profDone').textContent }));
  check('"Đổi": the player cards of this mode, the button says "Vào trận"', prof.screen === 'profiles' && prof.cards === 4 && prof.four === 'team4' && prof.done === '▶ Vào trận', JSON.stringify(prof));
  await ev(() => document.getElementById('profDone').click()); await page.waitForTimeout(200);
  const inMatch = await ev(() => ({ state: __game.state, mode: __game.mode }));
  check('...and it goes on into the match', (inMatch.state === 'intro' || inMatch.state === 'play') && inMatch.mode === 'team4', JSON.stringify(inMatch));
  await ev(() => { __game.state = 'paused'; document.querySelector('[data-act="toMenu"]').click(); }); await page.waitForTimeout(200);
  const plain = await ev(() => { document.querySelector('[data-act="profiles"]').click(); return document.getElementById('profDone').textContent; });
  check('from the menu the player cards still just say "Xong"', plain === '✔ Xong', plain);
  await ev(() => document.getElementById('profDone').click()); await page.waitForTimeout(150);

  // 2 players: "Đá luôn" starts it; ticking "don't ask again" stops the question
  await start('2p');
  await ev(() => { document.getElementById('dlgNoAsk').checked = true; });
  await dlgBtn('Đá luôn'); await page.waitForTimeout(200);
  const s2 = await ev(() => ({ state: __game.state, mode: __game.mode, ask: JSON.parse(localStorage.getItem('bgp_prefs')).askDress }));
  check('"Đá luôn" starts the match; "don\'t ask again" is remembered', (s2.state === 'intro' || s2.state === 'play') && s2.mode === '2p' && s2.ask === false, JSON.stringify(s2));
  await ev(() => { __game.state = 'paused'; document.querySelector('[data-act="toMenu"]').click(); }); await page.waitForTimeout(200);
  await start('bot');
  const noAsk = { dialog: await dlgOpen(), state: await ev(() => __game.state) };
  check('...then Start goes straight into the match', !noAsk.dialog && (noAsk.state === 'intro' || noAsk.state === 'play'), JSON.stringify(noAsk));
  await ev(() => { __game.state = 'paused'; document.querySelector('[data-act="toMenu"]').click(); }); await page.waitForTimeout(200);

  // Settings switches it back on
  const st = await ev(() => { document.querySelector('[data-act="settings"]').click(); const b = document.getElementById('tgAskDress'); const before = b.classList.contains('on'); b.click(); return { before, after: document.getElementById('tgAskDress').classList.contains('on') }; });
  check('Settings: "Hỏi đổi tên / trang phục trước trận" switches it back on', st.before === false && st.after === true, JSON.stringify(st));
  await ev(() => document.querySelector('#settings [data-act="back"]').click()); await page.waitForTimeout(150);
  await start('bot');
  check('...and Start asks again', await dlgOpen());
  await dlgBtn('Đá luôn'); await page.waitForTimeout(200);
  await ev(() => { __game.state = 'paused'; document.querySelector('[data-act="toMenu"]').click(); }); await page.waitForTimeout(200);

  // a match of bots only: nobody to dress, no question
  await ev(() => document.querySelector('[data-act="setup"][data-mode="team4"]').click()); await page.waitForTimeout(150);
  await ev(() => { const b = () => document.querySelectorAll('#slotBtns button'); for (let i = 0; i < 4; i++) { let n = 0; while (!/Bot/.test(b()[i].textContent) && n++ < 5) b()[i].click(); } document.querySelector('#setup [data-act="start"]').click(); });
  await page.waitForTimeout(200);
  check('bots only: no question', !(await dlgOpen()) && /intro|play/.test(await ev(() => __game.state)));
  check('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(fails ? fails + ' FAILED' : 'all checks passed');
  await browser.close();
})();
