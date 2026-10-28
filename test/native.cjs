// the app's code path (window.BGNative from MainActivity.java), with a fake bridge that behaves like the Java one
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 380 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => {
    const files = {}, log = [];
    let video = null, perm = false;
    window.__native = { files, log, video: () => video, setPerm: v => { perm = v; } };
    window.BGNative = {
      hlPut(id, b64) { log.push('put ' + id + ' ' + b64.length); if (window.__full) return false; files[id] = b64; return true; },
      hlGet(id) { log.push('get ' + id); return files[id] || null; },
      hlDel(id) { log.push('del ' + id); delete files[id]; },
      needsStoragePermission() { return !perm; },
      requestStoragePermission() { log.push('ask permission'); setTimeout(() => window.__perm && window.__perm(window.__grant), 50); },
      videoBegin(name, pub) { log.push('videoBegin ' + name + ' public=' + pub); video = { name, bytes: 0, chunks: 0 }; return (pub ? 'Movies/Ballgames/' : 'Android/data/com.ballgames.physics/files/Movies/') + name; },
      videoChunk(b64) { video.chunks++; video.bytes += atob(b64).length; return true; },
      videoEnd() { log.push('videoEnd ' + video.bytes + ' bytes in ' + video.chunks + ' chunks'); return true; },
      videoAbort() { log.push('videoAbort'); video = null; }
    };
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PE ' + String(e.stack || e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.waitForTimeout(600);
  const ev = (f, a) => page.evaluate(f, a);
  await page.tap('[data-act="skipTutorial"]:visible');
  console.log('isApp', await ev(() => BGHL.isApp));
  async function match() {
    await ev(() => __api.startMatch({ mode: 'team4', slots: ['b', 'b', 'b', 'b'], level: 'hard', fmt: 'p2', maps: ['soccer'], mods: false, items: false, weather: false }));
    for (let i = 0; i < 100; i++) { const st = await ev(() => { for (let i = 0; i < 600 && __game.state !== 'over'; i++) __api.step(1 / 60); return __game.state; }); if (st === 'over') break; }
    await page.waitForTimeout(400);
  }
  await match();
  console.log('state', await ev(() => __game.state + ' score ' + __game.score + ' dialog ' + !document.getElementById('dialog').classList.contains('hidden') + ' asked ' + JSON.parse(localStorage.getItem('bgp_prefs')).hlAsked + ' hl ' + !!__game.lastHL));
  console.log('dialog note (app):', await ev(() => document.querySelector('#dlgBody .hint').textContent));
  await page.tap('#dlgBtns .btn'); await page.waitForTimeout(600);
  const id = await ev(() => BGHL.history()[0].id);
  console.log('stored as file', JSON.stringify(await ev(() => ({ files: Object.keys(__native.files), rec: BGHL.history()[0].hl }))));
  // back to the menu and replay it from the history (read back from the "file")
  await ev(() => __api.toMenu()); await page.tap('[data-act="history"]'); await page.waitForTimeout(300);
  await page.tap('.hcard .hacts .chip:nth-child(1)'); await page.waitForTimeout(1200);
  console.log('playing from file', await ev(() => __game.state + ' clips=' + __game.hlp.hl.clips.length + ' frames ok=' + (__game.hlp.c.frames.length % 90 === 0)));
  await page.tap('#hlClose'); await page.waitForTimeout(500);
  console.log('back to', await ev(() => __game.state + ' / ' + __game.screen));
  // Android 9: permission refused -> app folder; granted -> Movies/Ballgames
  await ev(() => { window.__grant = false; });
  await page.tap('.hcard .hacts .chip:nth-child(2)');
  await page.waitForTimeout(2500);
  console.log('exporting (no permission)', await ev(() => __game.state + ' ' + __native.log.slice(-2).join(' | ')));
  await page.tap('#exportCancel'); await page.waitForTimeout(800);
  console.log('cancelled ->', await ev(() => __native.log.slice(-1)[0] + ' | ' + __game.state + ' / ' + __game.screen + ' | toast ' + document.getElementById('toast').textContent));
  await ev(() => { window.__grant = true; });
  await page.tap('.hcard .hacts .chip:nth-child(2)');
  for (let i = 0; i < 120; i++) { await page.waitForTimeout(1000); if (await ev(() => __game.state !== 'highlight')) break; }
  await page.waitForTimeout(1500);
  console.log('export done ->', await ev(() => __native.log.slice(-3).join(' | ') + ' | toast: ' + document.getElementById('toast').textContent));
  // delete from history removes the file
  await page.tap('.hcard .hacts .chip:nth-child(3)'); await page.waitForTimeout(200); await page.tap('#dlgBtns .btn.red'); await page.waitForTimeout(400);
  console.log('after delete files', JSON.stringify(await ev(() => Object.keys(__native.files))), await ev(() => __native.log.slice(-1)[0]));
  // phone full: storing fails -> record kept without highlight
  await ev(() => { window.__full = true; });
  await match();
  await page.waitForTimeout(800);
  console.log('phone full ->', JSON.stringify(await ev(() => BGHL.history()[0].hl)));
  console.log(errs.length ? 'ERRORS ' + errs.join('\n') : 'no errors');
  await browser.close();
})();
