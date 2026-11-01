// v2.9.4: highlights with sound (playing them and in the downloaded MP4) and with the score and time left / target
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), cp = require('child_process');
const SH = path.resolve(__dirname, '../shots12');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await browser.newContext({ viewport: { width: 800, height: 380 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PE ' + String(e.stack || e)));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.waitForTimeout(400);
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('bgp_prefs')); p.hlAsked = true; p.hlMode = 'all'; localStorage.setItem('bgp_prefs', JSON.stringify(p)); });
  await page.reload(); await page.waitForTimeout(400);
  await page.tap('[data-act="skipTutorial"]:visible');
  const ev = (f, a) => page.evaluate(f, a);
  let fails = 0;
  const check = (name, ok, info) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info ? '  ' + info : '')); };
  // count the sounds the game asks for
  await ev(() => {
    window.__snd = {};
    ['kick', 'bounce', 'post', 'jump', 'whistle', 'cheer', 'star', 'setCrowd'].forEach(fn => {
      const f = BGAudio[fn];
      BGAudio[fn] = function () { if (!BGAudio.quiet || fn === 'setCrowd') { const k = fn === 'setCrowd' ? 'crowd_' + !!arguments[0] : fn; __snd[k] = (__snd[k] || 0) + 1; } return f.apply(this, arguments); };
    });
  });
  const playOut = () => ev(() => { for (let i = 0; i < 60000 && __game.state !== 'over'; i++) { if (__game.state === 'vote') { __game.golden = true; __game.state = 'play'; } __api.step(1 / 60); } return __game.state; });

  // a timed match (1 minute) played by bots
  await ev(() => __api.startMatch({ mode: 'team4', slots: ['b', 'b', 'b', 'b'], level: 'hard', fmt: 't60', maps: ['soccer'], mods: false, items: false, weather: false }));
  await playOut();
  await page.waitForTimeout(400);
  const hl = await ev(() => { const h = __game.lastHL; return { n: h.clips.length, fmt: h.match.fmt, sounds: h.clips.map(c => (c.sounds || []).length), clk: h.clips.map(c => c.clk ? c.clk[0] + '→' + c.clk[c.clk.length - 1] : null), sc: h.clips.map(c => c.kind + ' ' + (c.sc0 || []).join('-') + ' / ' + (c.sc || []).join('-')) }; });
  console.log('    clips', JSON.stringify(hl));
  check('clips carry their sounds and the clock', hl.fmt === 't60' && hl.sounds.every(n => n > 0) && hl.clk.every(c => c && /→/.test(c)), JSON.stringify(hl.sounds));
  // watch it from the end screen
  await ev(() => { __snd = {}; });
  await page.tap('#overTools [data-act="hlWatch"]');
  const goalIdx = await ev(() => __game.hlp.hl.clips.findIndex(c => c.kind === 'goal'));
  const seen = [];
  // through the first goal clip (and a little of the next)
  for (let i = 0; i < 400 && (await ev(() => __game.state)) === 'highlight' && !(seen.length && seen[seen.length - 1] && seen[seen.length - 1].ci > goalIdx); i++) {
    seen.push(await ev(() => { __api.step(1 / 60, 6); return __api.hlInfo() ? Object.assign({ ci: __game.hlp.ci, goalT: (__game.hlp.c.marks.find(m => m.kind === 'goal') || {}).t }, __api.hlInfo()) : null; }));
    if (seen.length === 30) await page.screenshot({ path: SH + '/01_highlight_clock.png' });
  }
  const snd = await ev(() => __snd);
  check('watching: the match sounds play (kicks, bounces…), whistle and cheer at the goal, crowd on', snd.kick > 0 && snd.bounce > 0 && snd.whistle > 0 && snd.cheer > 0 && snd.crowd_true > 0, JSON.stringify(snd));
  const g = seen.filter(x => x && x.ci === goalIdx && x.goalT !== undefined);
  const before = g.filter(x => x.t < x.goalT - 0.1), after = g.filter(x => x.t > x.goalT + 0.1);
  const sum = s => s.reduce((a, b) => a + b, 0);
  check('score: before the ball goes in the old score, after it one point more', before.length && after.length && sum(after[0].score) === sum(before[0].score) + 2,
    'before ' + before[0].score.join('-') + ', after ' + after[0].score.join('-') + ' (2 vs 2: both players of the side get the point)');
  const clocks = g.map(x => x.info);
  check('time left shown and counting down', clocks.every(c => /^⏱ \d+:\d\d$/.test(c) || c === '⭐ BÀN VÀNG') && clocks[0] !== clocks[clocks.length - 1] || clocks.every(c => c === '⭐ BÀN VÀNG'), clocks[0] + ' … ' + clocks[clocks.length - 1]);
  await page.tap('#hlClose');
  await page.waitForTimeout(400);
  check('closing it: back on the end screen, crowd off', await ev(() => __game.state === 'over') && (await ev(() => __snd.crowd_false || 0)) > 0);

  // the downloaded video has the sound
  const dlP = page.waitForEvent('download', { timeout: 300000 });
  await page.tap('#overTools [data-act="hlExport"]');
  const dl = await dlP, file = SH + '/' + dl.suggestedFilename();
  await dl.saveAs(file);
  const pr = JSON.parse(cp.execSync(`ffprobe -v error -show_entries stream=codec_type,codec_name,sample_rate,channels,duration:format=duration -of json "${file}"`, { encoding: 'utf8' }));
  const v = pr.streams.find(x => x.codec_type === 'video'), a = pr.streams.find(x => x.codec_type === 'audio');
  check('the MP4 has a sound track', !!a && a.sample_rate === '48000' && a.channels === 2, pr.streams.map(x => x.codec_type + ':' + x.codec_name).join(' '));
  check('sound as long as the picture', a && Math.abs(+a.duration - +v.duration) < 0.5, a && (a.duration + ' s sound, ' + v.duration + ' s picture'));
  const vol = cp.execSync(`ffmpeg -v info -i "${file}" -map 0:a -af volumedetect -f null - 2>&1 | grep -E "mean_volume|max_volume" || true`, { encoding: 'utf8' });
  check('and it is not silent', /max_volume: (-?[\d.]+)/.test(vol) && +RegExp.$1 > -20, vol.trim().replace(/\n/g, ' | '));
  const err = cp.execSync(`ffmpeg -v error -i "${file}" -f null - 2>&1 || true`, { encoding: 'utf8' });
  check('picture and sound decode without errors', err.trim() === '', err.slice(0, 200));
  cp.execSync(`ffmpeg -v error -y -ss 3 -i "${file}" -frames:v 1 "${SH}/02_video_frame.png"`);

  // a match to 3 points: the target instead of a clock; watched from the history (sound on there too)
  await ev(() => __api.startMatch({ mode: 'bot', level: 'hard', fmt: 'p3', maps: ['basket'], mods: false, items: false, weather: false }));
  await ev(() => { __game.bots = [new BGP.Bot(0, 'hard', 3, 0), null, null, null]; });
  await ev(() => { for (let i = 0; i < 60000 && __game.state !== 'over'; i++) { if (__game.state === 'play' && Math.random() < 0.02) __game.hold[0] = __game.world.time + 0.2; __api.step(1 / 60); } });
  await page.waitForTimeout(500);
  await ev(() => __api.toMenu()); await page.waitForTimeout(200);
  await page.tap('[data-act="history"]'); await page.waitForTimeout(300);
  await ev(() => { __snd = {}; });
  await page.tap('.hcard .hacts .chip:nth-child(1)'); await page.waitForTimeout(800);
  await ev(() => __api.step(1 / 60, 240));
  const p3 = await ev(() => __api.hlInfo());
  await page.screenshot({ path: SH + '/03_highlight_target.png' });
  check('match to 3: "Chạm 3" shown', p3 && p3.info === 'Chạm 3', JSON.stringify(p3));
  check('watched from the history: heard (the menu is quiet otherwise)', (await ev(() => (__snd.kick || 0) + (__snd.bounce || 0))) > 0 && (await ev(() => BGAudio.quiet)) === false);
  await page.tap('#hlClose'); await page.waitForTimeout(400);
  check('closing it: the menu is quiet again', await ev(() => BGAudio.quiet === true && __game.state === 'menu'));

  console.log(errs.length ? 'ERRORS ' + errs.join('\n') : 'no page errors');
  console.log(fails ? fails + ' FAILED' : 'all checks passed');
  await browser.close();
})();
