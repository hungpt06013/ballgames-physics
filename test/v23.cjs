const { chromium } = require('playwright');
const path = require('path');
const SH = path.resolve(__dirname, '../shots5');
const ONLY = process.env.ONLY || '';
const want = k => !ONLY || ONLY.split(',').includes(k);
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 380 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PE ' + String(e.stack || e)));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.waitForTimeout(700);
  const ev = (f, a) => page.evaluate(f, a);
  const shot = n => page.screenshot({ path: SH + '/' + n + '.png' });
  const flush = tag => { if (errs.length) console.log('ERRORS @' + tag, errs.splice(0)); };
  await page.tap('[data-act="skipTutorial"]:visible');

  if (want('setup')) {
    await page.tap('[data-act="setup"][data-mode="bot"]'); await page.waitForTimeout(200);
    await page.tap('#tgWeather'); await page.waitForTimeout(150);
    await shot('01_setup_weather');
    // untick lightning, try to untick everything (one must stay)
    const labels = await ev(() => Array.from(document.querySelectorAll('#wxChecks label')).map(l => l.textContent));
    console.log('weather options', labels);
    await page.tap('#wxChecks label:nth-child(3)'); await page.waitForTimeout(100);
    console.log('wxList after unticking lightning', await ev(() => JSON.parse(localStorage.getItem('bgp_prefs')).wxList));
    await page.tap('#wxChecks label:nth-child(3)'); await page.waitForTimeout(100);
    // items: untick shield + magnet
    await page.tap('#itemChecks label:nth-child(2)'); await page.tap('#itemChecks label:nth-child(3)'); await page.waitForTimeout(100);
    console.log('itemList', await ev(() => JSON.parse(localStorage.getItem('bgp_prefs')).itemList));
    // format: time 1.5 minutes
    await page.tap('#fmtType button[data-v="t"]'); await page.waitForTimeout(100);
    await page.fill('#fmtValue', '1.5'); await page.press('#fmtValue', 'Enter');
    // bomb seconds row shows when bomb is ticked
    console.log('bomb row visible', await ev(() => !document.getElementById('rowBomb').classList.contains('hidden')));
    await page.fill('#bombTime', '7'); await page.press('#bombTime', 'Enter');
    await shot('02_setup_filled');
    console.log('prefs', JSON.stringify(await ev(() => { const p = JSON.parse(localStorage.getItem('bgp_prefs')); return { fmtType: p.fmtType, fmtMinutes: p.fmtMinutes, bombTime: p.bombTime, weather: p.weather }; })));
    await page.tap('[data-act="start"]:visible'); await page.waitForTimeout(1900);
    console.log('match', JSON.stringify(await ev(() => ({ clock: __game.clock.toFixed(1), target: __game.target, wx: !!__game.wx, items: __game.world.arena.itemList, bombTime: __game.world.arena.bombTime }))));
    await shot('03_time_match');
    // points: type 12
    await ev(() => __api.toMenu());
    await page.tap('[data-act="setup"][data-mode="2p"]'); await page.waitForTimeout(150);
    await page.tap('#fmtType button[data-v="p"]'); await page.fill('#fmtValue', '12');
    await page.tap('[data-act="start"]:visible'); await page.waitForTimeout(500);
    console.log('points match target', await ev(() => __game.target));
    flush('setup');
  }

  if (want('pause')) {
    await ev(() => __api.startMatch({ mode: 'bot', maps: ['soccer'], mods: false, items: false, weather: false, fmt: 'p5', level: 'easy' }));
    await page.waitForTimeout(1900);
    await page.waitForTimeout(2500);
    await ev(() => { const b = __game.world.ball; b.touchT[0] = __game.world.time - 1; __api.onScore(0); });
    let sawReplay = false;
    for (let i = 0; i < 200; i++) { await page.waitForTimeout(150); const st = await ev(() => __game.state); if (st === 'replay') sawReplay = true; if (sawReplay && st === 'intro') break; }
    await page.waitForTimeout(400);
    console.log('after replay -> state', await ev(() => __game.state), 'X button visible', await ev(() => !document.getElementById('pauseBtn').classList.contains('hidden')), 'replay seen', sawReplay);
    await shot('10_after_replay_x');
    flush('pause');
  }

  if (want('wxdist')) {
    // 90 / 9 / 0.9 / 0.1 rule
    const d = await ev(() => {
      __api.startMatch({ mode: '2p', maps: ['soccer'], mods: false, items: false, weather: true, wxList: ['fog', 'quake', 'lightning', 'tornado'], fmt: 'p5' });
      const G = __game, cnt = [0, 0, 0, 0, 0];
      for (let i = 0; i < 20000; i++) {
        G.wx.active = {}; G.wx.warn = null;
        __api.weather.trigger(G.world, 'fog');
        let n = Object.keys(G.wx.active).length; cnt[n]++;
      }
      return cnt;
    });
    console.log('phenomena at once over 20000 triggers [0,1,2,3,4]:', d, '->', d.map(x => (x / 200).toFixed(2) + '%').join(' '));
    flush('wxdist');
  }

  if (want('wx')) {
    for (const id of ['fog', 'quake', 'tornado', 'lightning']) {
      await ev(id => { __api.startMatch({ mode: 'bot', maps: ['soccer'], mods: false, items: false, weather: true, wxList: [id], fmt: 'p10', level: 'easy' }); }, id);
      await page.waitForTimeout(1800);
      await ev(id => { __game.wx.timer[id] = 0.01; }, id);
      await page.waitForTimeout(id === 'lightning' ? 500 : 2200);
      await shot('20_wx_' + id);
      if (id === 'lightning') { await page.waitForTimeout(450); await shot('21_wx_lightning_hit'); }
      console.log(id, JSON.stringify(await ev(() => ({ st: __game.state, active: Object.keys(__game.wx.active), fog: __game.wx.fog.toFixed(2), quake: BGP.quakeLevel(__game.world.hz).toFixed(2), torT: __game.world.hz.torT.toFixed(1), craters: __game.world.hz.craters.length, stun: __game.world.hz.stun.map(x => x.toFixed(1)), note: __game.note }))));
    }
    // tornado lifting players: snapshot
    await ev(() => { __api.startMatch({ mode: '2p', maps: ['basket'], mods: false, items: false, weather: true, wxList: ['tornado'], fmt: 'p10' }); });
    await page.waitForTimeout(1800);
    await ev(() => { BGP.startTornado(__game.world, 400, 6); __game.wx.active.tornado = 6; });
    await page.waitForTimeout(2600); await shot('22_tornado_lift');
    console.log('tornado lift ys', await ev(() => __game.world.players.map(p => p.y | 0)), 'ball y', await ev(() => __game.world.ball.y | 0));
    flush('wx');
  }

  if (want('strike')) {
    // lightning on the ground -> crater, on a player -> burnt, on the ball -> 5 s then no-point round + replay, on the bomb -> boom
    await ev(() => { __api.startMatch({ mode: '2p', maps: ['soccer'], mods: false, items: false, weather: true, wxList: ['lightning'], fmt: 'p10' }); });
    await page.waitForTimeout(1800);
    await ev(() => { __game.wx.timer.lightning = 99; __api.weather.strike(__game.world, 700); });
    await page.waitForTimeout(300); await shot('30_crater');
    await ev(() => { const p = __game.world.players[2]; __api.weather.strike(__game.world, p.x); });
    await page.waitForTimeout(600); await shot('31_burnt_player');
    console.log('ground+player', JSON.stringify(await ev(() => ({ craters: __game.world.hz.craters.length, stun: __game.world.hz.stun.map(x => x.toFixed(1)) }))));
    await ev(() => { const w = __game.world, b = w.ball; b.x = b.prevX = 900; b.y = b.prevY = 400; b.vx = b.vy = 0; __api.weather.strike(w, 900); });
    await page.waitForTimeout(1000); await shot('32_zapped_ball');
    const z0 = await ev(() => ({ zap: __game.wx.zap && __game.wx.zap.t.toFixed(1), score: __game.score.slice(), round: __game.round, map: __game.world.arena.map.id }));
    let seenReplay = false, rpInfo = null;
    for (let i = 0; i < 60; i++) { await page.waitForTimeout(200); const st = await ev(() => __game.state); if (st === 'replay' && !seenReplay) { seenReplay = true; await page.waitForTimeout(1200); await shot('33_zap_replay'); rpInfo = await ev(() => { const G = __game, r = G.rec; return { from: r.timeAt(G.replay.from).toFixed(2), strike: r.shotT.toFixed(2), to: r.timeAt(G.replay.to).toFixed(2), word: G.word }; }); } if (seenReplay && st === 'intro') break; }
    console.log('zapped ball', JSON.stringify(z0), 'replay', seenReplay, JSON.stringify(rpInfo), 'after:', JSON.stringify(await ev(() => ({ st: __game.state, score: __game.score, round: __game.round, map: __game.world.arena.map.id }))));
    await ev(() => { __api.startMatch({ mode: '2p', maps: ['bomb'], mods: false, items: false, weather: true, wxList: ['lightning'], fmt: 'p10' }); });
    await page.waitForTimeout(1800);
    await ev(() => { const w = __game.world, b = w.ball; __game.wx.timer.lightning = 99; b.x = b.prevX = 600; b.y = b.prevY = 500; b.vx = b.vy = 0; __api.weather.strike(w, 600); });
    await page.waitForTimeout(300); await shot('34_bomb_struck');
    console.log('bomb struck', JSON.stringify(await ev(() => ({ st: __game.state, noPoint: __game.noPoint, score: __game.score, word: __game.word }))));
    flush('strike');
  }

  if (want('replayfx')) {
    // power-ups in the replay follow the recording: big before the goal shows, big after the goal does not show early
    await ev(() => __api.startMatch({ mode: '2p', maps: ['soccer'], mods: false, items: true, weather: false, fmt: 'p10' }));
    await page.waitForTimeout(1800);
    await page.waitForTimeout(2500);
    await ev(() => { __game.world.fx.big[1] = 7; __game.world.fx.kick[0] = 7; window.__tBig = __game.world.time; });
    await page.waitForTimeout(1500);
    await ev(() => { const b = __game.world.ball; b.x = b.prevX = BGP.W - 230; b.y = b.prevY = BGP.GROUND - 80; b.vx = 1300; b.vy = 0; b.touchT[0] = __game.world.time - 0.1; });
    for (let i = 0; i < 20; i++) { await page.waitForTimeout(50); if (await ev(() => __game.state === 'scored')) break; }
    await ev(() => { __game.world.fx.big[2] = 7; __game.world.fx.shield[1] = 7; });
    const samples = [];
    for (let i = 0; i < 120; i++) {
      await page.waitForTimeout(80);
      const s = await ev(() => __game.state === 'replay' ? { t: __game.rec.timeAt(__game.replay.k), big1: __game.world.fx.big[1] > 0, big2: __game.world.fx.big[2] > 0, kick0: __game.world.fx.kick[0] > 0, shield1: __game.world.fx.shield[1] > 0, tBig: window.__tBig, goalT: __game.rec.timeAt(__game.rec.goal - 1) } : null);
      if (s) samples.push(s); else if (samples.length) break;
    }
    const before = samples.filter(s => s.t < s.tBig - 0.05), during = samples.filter(s => s.t > s.tBig + 0.05 && s.t <= s.goalT);
    console.log('replay samples', samples.length, 'before pickup: big1/kick0 shown', before.some(s => s.big1 || s.kick0), '| after pickup, before goal: big1 shown', during.every(s => s.big1), 'kick0', during.every(s => s.kick0), '| post-goal power-ups shown before the goal', samples.filter(s => s.t <= s.goalT).some(s => s.big2 || s.shield1));
    flush('replayfx');
  }

  if (want('arrows')) {
    await ev(() => __api.startMatch({ mode: '2p', maps: ['soccer'], mods: false, items: false, weather: false, fmt: 'p10' }));
    await page.waitForTimeout(1800);
    await page.waitForTimeout(3000);
    // ball and a player far above the screen just before the goal
    await ev(() => { const w = __game.world, b = w.ball; b.x = b.prevX = 900; b.y = b.prevY = -400; b.vx = 0; b.vy = 0; const p = w.players[1]; p.y = -300; p.vy = 0; });
    await page.waitForTimeout(1200);
    await ev(() => { const b = __game.world.ball; b.x = b.prevX = BGP.W - 230; b.y = b.prevY = BGP.GROUND - 80; b.vx = 1300; b.vy = 0; b.touchT[0] = __game.world.time - 1.6; });
    for (let i = 0; i < 60; i++) { await page.waitForTimeout(100); if (await ev(() => __game.state === 'replay' && __game.world.ball.y < -100)) break; }
    await shot('40_replay_arrows');
    console.log('replay with ball above', await ev(() => ({ st: __game.state, by: __game.world.ball.y | 0, py: __game.world.players[1].y | 0 })));
    flush('arrows');
  }
  console.log('remaining errors', errs);
  await browser.close();
})();
