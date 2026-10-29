// v2.5: whole-match history, player stats + MVP, highlights (goals + saves), storage choice, deletion, time-up vote, video export
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const SH = path.resolve(__dirname, '../shots7');
const ONLY = process.env.ONLY || '';
const want = k => !ONLY || ONLY.split(',').includes(k);
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 380 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PE ' + String(e.stack || e)));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.waitForTimeout(700);
  const ev = (f, a) => page.evaluate(f, a);
  const shot = n => page.screenshot({ path: SH + '/' + n + '.png' });
  const flush = tag => { if (errs.length) console.log('ERRORS @' + tag, errs.splice(0)); else console.log('no errors @' + tag); };
  await page.tap('[data-act="skipTutorial"]:visible');
  // play a whole match at full speed (no drawing); stops at the end screen
  async function playOut(maxSec) {
    for (let t = 0; t < maxSec; t += 10) {
      const st = await ev(() => { for (let i = 0; i < 600; i++) { if (__game.state === 'over' || __game.state === 'vote') break; __api.step(1 / 60); } return __game.state; });
      if (st === 'over' || st === 'vote') return st;
    }
    return await ev(() => __game.state);
  }

  if (want('match')) {
    // a whole 2 vs 2 match played by 4 bots, first to 4
    await ev(() => __api.startMatch({ mode: 'team4', slots: ['b', 'b', 'b', 'b'], level: 'hard', fmt: 'p4', maps: ['soccer', 'ice', 'giant', 'basket'], mods: false, items: true, weather: false }));
    const t0 = Date.now();
    const st = await playOut(900);
    console.log('match ended', st, 'in', ((Date.now() - t0) / 1000).toFixed(0), 's real; score', await ev(() => __game.score.join('-')), 'rounds', await ev(() => __game.round));
    await page.waitForTimeout(500);
    const dlg = await ev(() => ({ open: !document.getElementById('dialog').classList.contains('hidden'), title: document.getElementById('dlgTitle').textContent,
      options: Array.from(document.querySelectorAll('#dlgBody label.radio')).map(l => l.textContent.trim()), note: document.querySelector('#dlgBody .hint').textContent }));
    console.log('first-time dialog', JSON.stringify(dlg));
    await shot('01_ask_policy');
    // choose: keep only the last 3
    await page.tap('#dlgBody input[value="last"]');
    await page.fill('#dlgBody input.num', '3'); await page.press('#dlgBody input.num', 'Enter');
    await page.tap('#dlgBtns .btn');
    await page.waitForTimeout(800);
    const prefs = await ev(() => { const p = JSON.parse(localStorage.getItem('bgp_prefs')); return { hlAsked: p.hlAsked, hlMode: p.hlMode, hlKeep: p.hlKeep }; });
    console.log('prefs after choice', JSON.stringify(prefs));
    const rec = await ev(() => { const r = BGHL.history()[0]; return { mode: r.mode, level: r.level, score: r.score, winner: r.winner, maps: r.maps, dur: r.dur, goals: r.goals.length, hl: r.hl, ps: r.ps, mvp: r.mvp }; });
    console.log('history record', JSON.stringify(rec));
    const clips = await ev(() => __game.lastHL.clips.map(c => c.kind + (c.n > 1 ? 'x' + c.n : '') + '@r' + c.round + ' ' + (c.frames.length / 90 / 30).toFixed(1) + 's'));
    console.log('clips', clips.join(', '));
    console.log('over screen stats', await ev(() => document.getElementById('resultStats').innerText.replace(/\n+/g, ' | ')));
    await shot('02_over_stats');
    // watch the highlight
    await page.tap('#overTools [data-act="hlWatch"]');
    await page.waitForTimeout(2200);
    console.log('highlight state', JSON.stringify(await ev(() => ({ st: __game.state, ci: __game.hlp.ci, n: __game.hlp.hl.clips.length, close: !document.getElementById('hlClose').classList.contains('hidden'), pause: !document.getElementById('pauseBtn').classList.contains('hidden') }))));
    await shot('03_highlight_clip1');
    // jump to a save clip if there is one, near its first save
    const saveIdx = await ev(() => __game.hlp.hl.clips.findIndex(c => c.kind === 'save'));
    if (saveIdx >= 0) {
      await ev(i => { __game.fade = 0; __game.fadeDir = 0; }, saveIdx);
      for (let i = 0; i < 30 && (await ev(() => __game.hlp.ci)) < saveIdx; i++) { await page.tap('#touch', { position: { x: 400, y: 200 } }); await page.waitForTimeout(450); }
      await ev(() => { const h = __game.hlp; h.k = Math.max(0, h.c.marks[0].t * 30 - 6); });
      await page.waitForTimeout(900);
      await shot('04_highlight_save');
      console.log('save clip', JSON.stringify(await ev(() => { const c = __game.hlp.c; return { n: c.n, name: c.name, team: c.team, marks: c.marks, slow: c.slow, speed: +__game.hlp.speed.toFixed(2), flash: __game.flash && __game.flash.txt }; })));
    }
    await page.tap('#hlClose');
    await page.waitForTimeout(600);
    console.log('after close', await ev(() => __game.state + ' / ' + __game.screen));
    flush('match');
  }

  if (want('more')) {
    // two more matches (bot mode, quick) so the "last 3" rule and history filters have something to work on
    for (const lvl of ['easy', 'normal', 'hard']) {
      await ev(l => __api.startMatch({ mode: 'bot', level: l, fmt: 'p2', maps: ['soccer'], mods: false, items: false, weather: false }), lvl);
      // the human side does nothing: a bot win
      console.log(lvl, await playOut(600), await ev(() => __game.score.join('-')));
      await page.waitForTimeout(700);
    }
    const h = await ev(() => BGHL.history().map(r => r.mode + (r.level ? ':' + r.level : '') + ' ' + (r.result || '') + ' hl=' + (r.hl ? (r.hl.gone ? 'gone' : r.hl.bytes) : 'none')));
    console.log('history', h);
    console.log('usage', JSON.stringify(await ev(() => BGHL.usage())));
    flush('more');
  }

  if (want('history')) {
    await ev(() => __api.toMenu()); await page.waitForTimeout(300);
    await page.tap('[data-act="history"]'); await page.waitForTimeout(300);
    console.log('history count', await ev(() => document.getElementById('hCount').textContent), 'cards', await ev(() => document.querySelectorAll('.hcard').length));
    await shot('05_history');
    await page.tap('#hfMode button[data-v="bot"]'); await page.waitForTimeout(150);
    await page.tap('#hfLevel button[data-v="hard"]'); await page.waitForTimeout(150);
    console.log('filter bot+hard', await ev(() => document.getElementById('hCount').textContent));
    await page.tap('#hfLevel button[data-v=""]'); await page.tap('#hfResult button[data-v="loss"]'); await page.waitForTimeout(150);
    console.log('filter bot+loss', await ev(() => document.getElementById('hCount').textContent));
    await page.tap('#hfMode button[data-v=""]'); await page.tap('#hfResult button[data-v=""]');
    await page.selectOption('#hfSport', 'ice'); await page.waitForTimeout(150);
    console.log('filter ice', await ev(() => document.getElementById('hCount').textContent));
    await page.selectOption('#hfSport', ''); await page.selectOption('#hfSort', 'margin'); await page.waitForTimeout(150);
    console.log('sorted by margin', await ev(() => Array.from(document.querySelectorAll('.hscore')).map(e => e.innerText.replace(/\s+/g, ' '))));
    await page.selectOption('#hfSort', 'new');
    // open the first card (stats table + goals)
    await page.tap('.hcard .hmain'); await page.waitForTimeout(200);
    await shot('06_history_open');
    console.log('opened card', await ev(() => document.querySelector('.hcard').innerText.replace(/\n+/g, ' | ').slice(0, 400)));
    // delete one match's highlight
    const before = await ev(() => BGHL.usage());
    await page.tap('.hcard .hacts .chip:nth-child(3)'); await page.waitForTimeout(200);
    console.log('delete dialog', await ev(() => document.getElementById('dlgTitle').textContent + ' / ' + document.getElementById('dlgBody').innerText));
    await shot('07_delete_one');
    await page.tap('#dlgBtns .btn.red'); await page.waitForTimeout(500);
    console.log('usage before/after', JSON.stringify(before), JSON.stringify(await ev(() => BGHL.usage())), 'first card:', await ev(() => document.querySelector('.hcard .hmain').innerText.split('\n').slice(-1)[0]));
    // multi-select
    await page.tap('#hSelect'); await page.waitForTimeout(150);
    await page.tap('#hSelAll'); await page.waitForTimeout(150);
    console.log('select all ->', await ev(() => document.getElementById('hDelSel').textContent));
    await shot('08_multiselect');
    await page.tap('#hDelSel'); await page.waitForTimeout(200);
    await page.tap('#dlgBtns .btn:not(.red)'); await page.waitForTimeout(200); // cancel
    console.log('after cancel usage', JSON.stringify(await ev(() => BGHL.usage())));
    await page.tap('#hSelect'); await page.waitForTimeout(150);
    flush('history');
  }

  if (want('settings')) {
    await ev(() => __api.toMenu()); await page.waitForTimeout(200);
    await page.tap('[data-act="settings"]'); await page.waitForTimeout(300);
    console.log('settings usage', await ev(() => document.getElementById('hlUsage').textContent));
    await page.evaluate(() => document.getElementById('hlPolicy').scrollIntoView());
    await shot('09_settings_hl');
    // switching to "don't keep" asks first; cancel keeps everything
    await page.tap('#hlPolicy input[value="none"]'); await page.waitForTimeout(200);
    console.log('none dialog', await ev(() => document.getElementById('dlgBody').innerText));
    await page.tap('#dlgBtns .btn:not(.red)'); await page.waitForTimeout(200);
    console.log('after cancel', JSON.stringify(await ev(() => ({ mode: JSON.parse(localStorage.getItem('bgp_prefs')).hlMode, radio: document.querySelector('#hlPolicy input:checked').value, usage: BGHL.usage() }))));
    // keep 1 → deletes the older ones after confirming
    await page.fill('#hlPolicy input.num', '1'); await page.press('#hlPolicy input.num', 'Enter'); await page.waitForTimeout(200);
    console.log('keep 1 dialog', await ev(() => document.getElementById('dlgBody').innerText));
    await page.tap('#dlgBtns .btn.red'); await page.waitForTimeout(500);
    console.log('after keep 1', JSON.stringify(await ev(() => BGHL.usage())), await ev(() => document.getElementById('hlUsage').textContent));
    // delete all, keeping the history
    await page.tap('#hlClearAll'); await page.waitForTimeout(200);
    console.log('clear all dialog', await ev(() => document.getElementById('dlgBody').innerText));
    await shot('10_clear_all');
    await page.tap('#dlgBtns .btn.red'); await page.waitForTimeout(500);
    console.log('after clear', JSON.stringify(await ev(() => ({ usage: BGHL.usage(), history: BGHL.history().length, gone: BGHL.history().filter(r => r.hl && r.hl.gone).length }))));
    await ev(() => { const p = JSON.parse(localStorage.getItem('bgp_prefs')); return p; });
    // back to "keep all"
    await page.tap('#hlPolicy input[value="all"]'); await page.waitForTimeout(200);
    flush('settings');
  }

  if (want('vote')) {
    // 2 players, time runs out level: P1 golden goal, P2 draw -> 1 >= 1 -> golden goal
    await ev(() => __api.startMatch({ mode: '2p', fmt: 't30', maps: ['soccer'], mods: false, items: false, weather: false }));
    await ev(() => { __api.step(1 / 60, 120); __game.score = [1, 1]; __game.clock = 0.05; __api.step(1 / 60, 5); });
    await page.waitForTimeout(300);
    console.log('vote screen', await ev(() => __game.state + ' | ' + document.getElementById('vote').innerText.replace(/\n+/g, ' | ')));
    await shot('11_vote');
    await page.tap('#voteRows .voteRow:nth-child(1) .voteBtn[data-v="gold"]');
    await page.waitForTimeout(150);
    console.log('tally', await ev(() => document.getElementById('voteTally').textContent), await ev(() => __game.state));
    await page.tap('#voteRows .voteRow:nth-child(2) .voteBtn[data-v="draw"]');
    await page.waitForTimeout(1300);
    console.log('1 gold vs 1 draw ->', await ev(() => __game.state + ' golden=' + __game.golden));
    // 4 players with 3 humans: 1 golden, 2 draw -> draw
    await ev(() => __api.startMatch({ mode: 'ffa', slots: ['h', 'h', 'b', 'h'], fmt: 't30', maps: ['soccer'], mods: false, items: false, weather: false }));
    await ev(() => { __api.step(1 / 60, 120); __game.score = [2, 0, 2, 1]; __game.clock = 0.05; __api.step(1 / 60, 5); });
    await page.waitForTimeout(300);
    console.log('ffa voters', await ev(() => Array.from(document.querySelectorAll('.voteName')).map(e => e.textContent)));
    await page.tap('#voteRows .voteRow:nth-child(1) .voteBtn[data-v="gold"]');
    await page.tap('#voteRows .voteRow:nth-child(2) .voteBtn[data-v="draw"]');
    await page.tap('#voteRows .voteRow:nth-child(3) .voteBtn[data-v="draw"]');
    await page.waitForTimeout(1300);
    console.log('1 gold vs 2 draw ->', await ev(() => __game.state + ' | ' + document.getElementById('resultText').textContent + ' | ' + document.getElementById('resultScore').innerText));
    await shot('12_ffa_draw');
    // bot match: one voter
    await ev(() => __api.startMatch({ mode: 'bot', level: 'normal', fmt: 't30', maps: ['soccer'], mods: false, items: false, weather: false }));
    await ev(() => { __api.step(1 / 60, 120); __game.score = [0, 0]; __game.clock = 0.05; __api.step(1 / 60, 5); });
    await page.waitForTimeout(300);
    console.log('bot vote rows', await ev(() => document.querySelectorAll('.voteRow').length), await ev(() => document.getElementById('voteHint').textContent));
    await page.tap('.voteBtn[data-v="draw"]'); await page.waitForTimeout(600);
    console.log('bot draw ->', await ev(() => __game.state + ' | ' + document.getElementById('resultText').textContent), 'record', await ev(() => { const r = BGHL.history()[0]; return r.result + ' draw=' + r.draw; }), 'stats', await ev(() => JSON.stringify(JSON.parse(localStorage.getItem('bgp_meta')).stats.botDraws)));
    await page.waitForTimeout(500);
    flush('vote');
  }

  if (want('export')) {
    // bots on both sides (an idle human can leave the ball lying where the bot never goes for it)
    await ev(() => __api.startMatch({ mode: 'team4', slots: ['b', 'b', 'b', 'b'], level: 'hard', fmt: 'p2', maps: ['soccer'], mods: false, items: false, weather: false }));
    console.log('export match', await playOut(600), await ev(() => __game.score.join('-')), 'clips', await ev(() => __game.lastHL && __game.lastHL.clips.length));
    await page.waitForTimeout(600);
    const est = await ev(() => { const hl = __game.lastHL; let t = 0; return hl.clips.reduce((a, c) => a + c.frames.length / 90 / 30, 0); });
    console.log('clip seconds', est.toFixed(1));
    if (await ev(() => !document.getElementById('dialog').classList.contains('hidden'))) { await page.tap('#dlgBtns .btn'); await page.waitForTimeout(300); } // first match of a fresh page
    const dlP = page.waitForEvent('download', { timeout: 180000 });
    await page.tap('#overTools [data-act="hlExport"]');
    await page.waitForTimeout(1500);
    console.log('exporting', JSON.stringify(await ev(() => ({ st: __game.state, w: document.getElementById('c').width, h: document.getElementById('c').height, bar: !document.getElementById('exportBar').classList.contains('hidden'), close: !document.getElementById('hlClose').classList.contains('hidden') }))));
    await shot('13_exporting');
    const dl = await dlP;
    const file = SH + '/' + dl.suggestedFilename();
    await dl.saveAs(file);
    const buf = fs.readFileSync(file);
    console.log('downloaded', dl.suggestedFilename(), (buf.length / 1024).toFixed(0) + ' KB', 'EBML header', buf.slice(0, 4).toString('hex'));
    await page.waitForTimeout(800);
    console.log('after export', await ev(() => __game.state + ' canvas ' + document.getElementById('c').width + ' toast: ' + document.getElementById('toast').textContent));
    flush('export');
  }
  await browser.close();
})();
