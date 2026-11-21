// The background music of each style rendered offline (no speakers needed): it must make sound, not clip, and keep
// its tempo; writes test/out/music_sample.wav (a few bars of every style) to listen to.
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  const page = await (await browser.newContext()).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto('file://' + path.resolve(__dirname, '../www/index.html'));
  await page.waitForTimeout(400);
  const res = await page.evaluate(async () => {
    const S = BGAudio, RATE = 24000, out = {}, parts = [];
    for (const [map, bars, hype] of [['soccer', 4, false], ['soccer', 2, true], ['volley', 2, false], ['moon', 2, false], ['bomb', 2, false], ['menu', 2, false]]) {
      S.setStyle(map); S.setHype(hype);
      const style = S.style, st = S.styles[style], spb = 60 / st.bpm / 4, secs = bars * 16 * spb;
      const oac = new OfflineAudioContext(1, Math.ceil((secs + 0.5) * RATE), RATE);
      const keep = { ac: S.ac, mus: S.mus, nbuf: S.nbuf, step: S.step, bar: S.bar, mel: S.mel };
      const g = oac.createGain(); g.gain.value = 0.16; g.connect(oac.destination);
      S.ac = oac; S.mus = g; S.nbuf = null; S.mel = S.melody(st);
      for (let k = 0; k < bars * 16; k++) { S.bar = Math.floor(k / 16) % st.prog.length; S.playStep(st, k % 16, k * spb, spb); } // (ac.currentTime is 0: t is the step's time)
      const buf = await oac.startRendering();
      Object.assign(S, keep);
      const d = buf.getChannelData(0);
      let peak = 0, sum = 0;
      for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += d[i] * d[i]; }
      out[style + (hype ? '+hype' : '')] = { secs: +secs.toFixed(2), peak: +peak.toFixed(3), rms: +Math.sqrt(sum / d.length).toFixed(4) };
      parts.push(Array.from(d));
    }
    return { out, wav: parts.flat(), rate: RATE };
  });
  await browser.close();
  console.log(JSON.stringify(res.out, null, 1));
  let ok = errs.length === 0;
  for (const k in res.out) { const r = res.out[k]; if (!(r.rms > 0.005 && r.peak < 1)) { ok = false; console.log('FAIL', k, r); } }
  // 16-bit mono WAV
  const n = res.wav.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(res.rate, 24); b.writeUInt32LE(res.rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(res.wav[i] * 32767))), 44 + i * 2);
  fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'out', 'music_sample.wav'), b);
  console.log(ok ? 'music ok' : 'music FAILED', errs.join(' | '));
})();
