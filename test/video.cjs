// v2.9.2: highlight video as MP4, made frame by frame in the background while the game goes on; saved highlights keep
// their number of saves (the "×18540" bug)
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), cp = require('child_process');
const SH = path.resolve(__dirname, '../shots11');
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
  const playOut = () => ev(() => { for (let i = 0; i < 60000 && __game.state !== 'over'; i++) { if (__game.state === 'vote') { __game.golden = true; __game.state = 'play'; } __api.step(1 / 60); } return __game.state; });

  // a whole match, then its video
  await ev(() => __api.startMatch({ mode: 'team4', slots: ['b', 'b', 'b', 'b'], level: 'hard', fmt: 'p3', maps: ['soccer', 'basket'], mods: false, items: true, weather: false }));
  await playOut();
  await page.waitForTimeout(500);
  const hlInfo = await ev(() => { const hl = __game.lastHL; let t = 0; return { clips: hl.clips.length, secs: hl.clips.reduce((a, c) => a + c.frames.length / 90 / 30, 0), kinds: hl.clips.map(c => c.kind[0] + (c.n > 1 ? c.n : '')).join('') }; });
  console.log('    highlight', JSON.stringify(hlInfo));
  const canvasBefore = await ev(() => document.getElementById('c').width);
  const dlP = page.waitForEvent('download', { timeout: 300000 });
  const t0 = Date.now();
  await page.tap('#overTools [data-act="hlExport"]');
  await page.waitForTimeout(400);
  check('export starts in the background (end screen stays, toast says play on)', await ev(() => __game.state === 'over' && !document.getElementById('exportBar').classList.contains('hidden')),
    await ev(() => document.getElementById('toast').textContent));
  // a second one is refused while the first runs
  await page.tap('#overTools [data-act="hlExport"]'); await page.waitForTimeout(200);
  check('a second video while one is being made: politely refused', (await ev(() => document.getElementById('toast').textContent)).indexOf('video khác') >= 0);
  // play a new match meanwhile, in real time
  await page.tap('[data-act="restart"]:visible');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: SH + '/01_playing_while_exporting.png' });
  const live = await ev(() => ({ state: __game.state, t: +__game.world.time.toFixed(1), canvas: document.getElementById('c').width, pct: document.getElementById('exportPct').textContent }));
  check('the new match runs while the video is made', live.state === 'play' && live.t > 0.5 && live.canvas === canvasBefore, JSON.stringify(live));
  // the frame rate of the game while the video is made
  const fps = await ev(() => new Promise(res => { let n = 0; const t0 = performance.now(); (function f() { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(f); else res(Math.round(n / 1.5)); })(); }));
  console.log('    game frames per second while the video is made:', fps);
  const dl = await dlP;
  const secsTaken = (Date.now() - t0) / 1000;
  const file = SH + '/' + dl.suggestedFilename();
  await dl.saveAs(file);
  check('file is .mp4', /\.mp4$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  const pr = JSON.parse(cp.execSync(`ffprobe -v error -count_frames -show_entries stream=codec_name,width,height,avg_frame_rate,r_frame_rate,nb_read_frames:format=duration -of json "${file}"`, { encoding: 'utf8' }));
  const st = pr.streams[0], dur = +pr.format.duration;
  check('MP4 Full HD (or 720p), 30 frames per second, every frame there', ((st.width === 1920 && st.height === 1080) || (st.width === 1280 && st.height === 720)) && st.avg_frame_rate === '30/1' && Math.abs(+st.nb_read_frames - dur * 30) < 2,
    JSON.stringify(st) + ' duration ' + dur.toFixed(1) + ' s, made in ' + secsTaken.toFixed(0) + ' s, ' + (fs.statSync(file).size / 1048576).toFixed(1) + ' MB');
  const decErr = cp.execSync(`ffmpeg -v error -i "${file}" -f null - 2>&1 || true`, { encoding: 'utf8' });
  check('every frame decodes', decErr.trim() === '', decErr.slice(0, 200));
  check('video as long as the highlight (+ transitions)', dur > hlInfo.secs * 0.9 && dur < hlInfo.secs * 2.6 + hlInfo.clips * 1.2, dur.toFixed(1) + ' s for ' + hlInfo.secs.toFixed(1) + ' s of clips');
  cp.execSync(`ffmpeg -v error -y -ss ${(dur * 0.4).toFixed(2)} -i "${file}" -frames:v 1 "${SH}/02_video_frame.png"`);
  const frameStats = cp.execSync(`ffmpeg -v info -i "${SH}/02_video_frame.png" -vf signalstats,metadata=print:key=lavfi.signalstats.YAVG -f null - 2>&1 | grep YAVG || true`, { encoding: 'utf8' });
  check('a frame in the middle shows the game (not black / white)', /YAVG=(\d+)/.test(frameStats) && +RegExp.$1 > 40 && +RegExp.$1 < 240, frameStats.trim());
  await page.waitForTimeout(500);
  check('done: pill gone, toast says saved', await ev(() => document.getElementById('exportBar').classList.contains('hidden') && document.getElementById('toast').textContent.indexOf('Đã lưu video') >= 0),
    await ev(() => document.getElementById('toast').textContent));

  // cancelling
  await ev(() => __api.toMenu());
  await page.tap('[data-act="history"]'); await page.waitForTimeout(300);
  await page.tap('.hcard .hacts .chip:nth-child(2)'); await page.waitForTimeout(1500);
  await page.tap('#exportCancel'); await page.waitForTimeout(800);
  check('cancel from the pill', await ev(() => document.getElementById('exportBar').classList.contains('hidden') && document.getElementById('toast').textContent.indexOf('huỷ') >= 0 && __game.state === 'menu'),
    await ev(() => document.getElementById('toast').textContent + ' / ' + __game.state));

  // saved highlights keep their number of saves (v2.5–v2.9.1 wrote the data length over it: "×18540")
  const nums = await ev(async () => {
    const mk = (n, kind) => ({ kind, n, by: [0], name: 'P1', team: 0, frames: new Int16Array(90 * 40), map: 'soccer', mods: {}, swap: false, round: 1, t: 0,
      marks: Array.from({ length: n }, (_, i) => ({ t: 0.2 + i * 0.1, kind, bi: 0, by: 0, team: 0 })), slow: [] });
    const hl = { match: { id: 'x', mode: '2p' }, clips: [mk(1, 'save'), mk(3, 'save'), mk(1, 'miss')] };
    const back = await BGHL.unpack(await BGHL.pack(hl));
    // the old (v2) format, as v2.5–v2.9.1 saved it
    const head = { v: 2, fs: 90, match: hl.match, clips: hl.clips.map(c => { const m = Object.assign({}, c); delete m.frames; m.n = c.frames.length; return m; }) };
    const json = new TextEncoder().encode(JSON.stringify(head)), pad = json.length % 2, raw = new Uint8Array(4 + json.length + pad + hl.clips.length * 90 * 40 * 2);
    new DataView(raw.buffer).setUint32(0, json.length, true); raw.set(json, 4);
    const old = new Uint8Array(5 + raw.length); old.set([66, 71, 72, 49, 0]); old.set(raw, 5);
    const back2 = await BGHL.unpack(old);
    return { now: back.clips.map(c => c.n + ':' + c.frames.length), old: back2.clips.map(c => c.n + ':' + c.frames.length) };
  });
  check('a saved highlight keeps 1 / 3 saves (not ×3600)', nums.now.join() === '1:3600,3:3600,1:3600', nums.now.join(' '));
  check('highlights saved by older versions count their saves again', nums.old.join() === '1:3600,3:3600,1:3600', nums.old.join(' '));

  // a phone without WebCodecs: the highlight is filmed off the screen while it plays (MP4 when the recorder can)
  const old = await browser.newContext({ viewport: { width: 800, height: 380 }, hasTouch: true, isMobile: true, acceptDownloads: true });
  await old.addInitScript(() => { delete window.VideoEncoder; delete window.VideoFrame; });
  const p2 = await old.newPage();
  p2.on('pageerror', e => errs.push('PE(old) ' + String(e.stack || e)));
  await p2.goto('file://' + path.resolve(__dirname, '../www/index.html')); await p2.waitForTimeout(400);
  await p2.evaluate(() => { const p = JSON.parse(localStorage.getItem('bgp_prefs')); p.hlAsked = true; localStorage.setItem('bgp_prefs', JSON.stringify(p)); });
  await p2.reload(); await p2.waitForTimeout(400);
  await p2.tap('[data-act="skipTutorial"]:visible');
  await p2.evaluate(() => { __api.startMatch({ mode: 'team4', slots: ['b', 'b', 'b', 'b'], level: 'hard', fmt: 'p1', maps: ['soccer'], mods: false, items: false, weather: false });
    for (let i = 0; i < 60000 && __game.state !== 'over'; i++) __api.step(1 / 60); });
  await p2.waitForTimeout(400);
  const dl2P = p2.waitForEvent('download', { timeout: 120000 });
  await p2.tap('#overTools [data-act="hlExport"]');
  await p2.waitForTimeout(800);
  const filming = await p2.evaluate(() => __game.state);
  const dl2 = await dl2P, f2 = SH + '/' + dl2.suggestedFilename();
  await dl2.saveAs(f2);
  const pr2 = cp.execSync(`ffprobe -v error -show_entries stream=codec_name:format=duration -of csv=p=0 "${f2}"`, { encoding: 'utf8' }).trim().split('\n').join(' ');
  check('no WebCodecs: filmed off the screen, still a file that plays', filming === 'highlight' && /\.(mp4|webm)$/.test(dl2.suggestedFilename()) && pr2.length > 0, dl2.suggestedFilename() + ' ' + pr2);
  await old.close();

  console.log(errs.length ? 'ERRORS ' + errs.join('\n') : 'no page errors');
  console.log(fails ? fails + ' FAILED' : 'all checks passed');
  await browser.close();
})();
