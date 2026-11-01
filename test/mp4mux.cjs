// the MP4 writer (www/mp4.js) with real H.264 and VP9 streams made by ffmpeg; ffprobe / ffmpeg must read the result
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { Muxer } = require('../www/mp4.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mp4mux-'));
let fails = 0;
const check = (name, ok, info) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info ? '  ' + info : '')); };
const sh = c => cp.execSync(c, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const W = 320, H = 180, FPS = 30, SECS = 3;

// H.264: Annex B with access unit delimiters -> avcC + length-prefixed samples (what VideoEncoder gives in 'avc' format)
sh(`ffmpeg -v error -y -f lavfi -i testsrc=size=${W}x${H}:rate=${FPS} -t ${SECS} -pix_fmt yuv420p -c:v libx264 -profile:v baseline -g 30 -bsf:v h264_metadata=aud=insert -f h264 ${dir}/a.h264`);
const raw = fs.readFileSync(`${dir}/a.h264`), nals = [];
for (let i = 0, start = -1; i <= raw.length; i++) {
  const sc = i + 3 <= raw.length && raw[i] === 0 && raw[i + 1] === 0 && (raw[i + 2] === 1 || (raw[i + 2] === 0 && raw[i + 3] === 1));
  if (sc || i === raw.length) {
    if (start >= 0) { let e = i; while (e > start && raw[e - 1] === 0) e--; nals.push(raw.subarray(start, e)); }
    if (i < raw.length) { i += raw[i + 2] === 1 ? 2 : 3; start = i + 1; }
  }
}
const sps = nals.find(n => (n[0] & 31) === 7), pps = nals.find(n => (n[0] & 31) === 8);
const avcC = Buffer.concat([Buffer.from([1, sps[1], sps[2], sps[3], 0xff, 0xe1, sps.length >> 8, sps.length & 255]), sps, Buffer.from([1, pps.length >> 8, pps.length & 255]), pps]);
const aus = [];
nals.forEach(n => { const t = n[0] & 31; if (t === 9) aus.push([]); else if (t !== 7 && t !== 8 && aus.length) aus[aus.length - 1].push(n); });
let m = new Muxer({ width: W, height: H, fps: FPS, codec: 'avc', description: new Uint8Array(avcC) });
aus.forEach(au => {
  const parts = []; au.forEach(n => { const l = Buffer.alloc(4); l.writeUInt32BE(n.length); parts.push(l, n); });
  m.add(new Uint8Array(Buffer.concat(parts)), au.some(n => (n[0] & 31) === 5));
});
fs.writeFileSync(`${dir}/a.mp4`, m.finish());
let p = JSON.parse(sh(`ffprobe -v error -count_frames -show_entries stream=codec_name,width,height,avg_frame_rate,nb_read_frames:format=duration -of json ${dir}/a.mp4`));
let s = p.streams[0];
check('H.264 in MP4: ffprobe reads it', s.codec_name === 'h264' && s.width === W && s.height === H && s.avg_frame_rate === '30/1' && +s.nb_read_frames === FPS * SECS && Math.abs(+p.format.duration - SECS) < 0.05, JSON.stringify(s) + ' ' + p.format.duration);
let err = sh(`ffmpeg -v error -i ${dir}/a.mp4 -f null - 2>&1 || true`);
check('H.264 in MP4: every frame decodes without errors', err.trim() === '', err.slice(0, 200));
// same picture as the source at frame 45
sh(`ffmpeg -v error -y -i ${dir}/a.mp4 -vf "select=eq(n\\,45)" -frames:v 1 -f rawvideo -pix_fmt gray ${dir}/m.raw`);
sh(`ffmpeg -v error -y -i ${dir}/a.h264 -vf "select=eq(n\\,45)" -frames:v 1 -f rawvideo -pix_fmt gray ${dir}/r.raw`);
check('H.264 in MP4: frame 45 identical to the source stream', fs.readFileSync(`${dir}/m.raw`).equals(fs.readFileSync(`${dir}/r.raw`)));
const head = fs.readFileSync(`${dir}/a.mp4`).subarray(0, 64).toString('latin1');
check('index (moov) before the data, so it plays while downloading', head.indexOf('ftyp') === 4 && head.indexOf('moov') > 0);

// VP9 frames from an IVF file
sh(`ffmpeg -v error -y -f lavfi -i testsrc=size=${W}x${H}:rate=${FPS} -t ${SECS} -pix_fmt yuv420p -c:v libvpx-vp9 -b:v 500k -g 30 -f ivf ${dir}/b.ivf`);
const ivf = fs.readFileSync(`${dir}/b.ivf`);
m = new Muxer({ width: W, height: H, fps: FPS, codec: 'vp9' });
for (let o = ivf.readUInt16LE(6); o < ivf.length;) {
  const n = ivf.readUInt32LE(o), f = ivf.subarray(o + 12, o + 12 + n);
  m.add(new Uint8Array(f), ((f[0] >> 2) & 1) === 0 && ((f[0] >> 3) & 1) === 0);
  o += 12 + n;
}
fs.writeFileSync(`${dir}/b.mp4`, m.finish());
p = JSON.parse(sh(`ffprobe -v error -count_frames -show_entries stream=codec_name,width,height,avg_frame_rate,nb_read_frames:format=duration -of json ${dir}/b.mp4`));
s = p.streams[0];
check('VP9 in MP4: ffprobe reads it', s.codec_name === 'vp9' && s.width === W && +s.nb_read_frames === FPS * SECS, JSON.stringify(s));
err = sh(`ffmpeg -v error -i ${dir}/b.mp4 -f null - 2>&1 || true`);
check('VP9 in MP4: decodes without errors', err.trim() === '', err.slice(0, 200));
// sound: video + AAC (ADTS frames from ffmpeg -> raw frames + AudioSpecificConfig, what AudioEncoder gives)
function videoMuxer() {
  const m = new Muxer({ width: W, height: H, fps: FPS, codec: 'avc', description: new Uint8Array(avcC) });
  aus.forEach(au => { const parts = []; au.forEach(n => { const l = Buffer.alloc(4); l.writeUInt32BE(n.length); parts.push(l, n); }); m.add(new Uint8Array(Buffer.concat(parts)), au.some(n => (n[0] & 31) === 5)); });
  return m;
}
sh(`ffmpeg -v error -y -f lavfi -i "sine=frequency=440:duration=${SECS}:sample_rate=48000" -ac 2 -c:a aac -b:a 128k -f adts ${dir}/s.aac`);
const adts = fs.readFileSync(`${dir}/s.aac`);
m = videoMuxer();
let asc = null;
for (let o = 0; o + 7 <= adts.length;) {
  const prof = (adts[o + 2] >> 6) + 1, fi = (adts[o + 2] >> 2) & 15, ch = ((adts[o + 2] & 1) << 2) | (adts[o + 3] >> 6);
  const len = ((adts[o + 3] & 3) << 11) | (adts[o + 4] << 3) | (adts[o + 5] >> 5), hl = (adts[o + 1] & 1) ? 7 : 9;
  if (!asc) { asc = new Uint8Array([(prof << 3) | (fi >> 1), ((fi & 1) << 7) | (ch << 3)]); m.setAudio({ codec: 'aac', sampleRate: 48000, channels: ch, description: asc }); }
  m.addAudio(new Uint8Array(adts.subarray(o + hl, o + len)), 1024);
  o += len;
}
fs.writeFileSync(`${dir}/c.mp4`, m.finish());
p = JSON.parse(sh(`ffprobe -v error -show_entries stream=codec_type,codec_name,sample_rate,channels:format=duration -of json ${dir}/c.mp4`));
check('video + AAC sound: both tracks there', p.streams.length === 2 && p.streams[0].codec_name === 'h264' && p.streams[1].codec_name === 'aac' && p.streams[1].sample_rate === '48000' && p.streams[1].channels === 2,
  p.streams.map(x => x.codec_name + '/' + (x.sample_rate || '')).join(' ') + ' ' + p.format.duration);
err = sh(`ffmpeg -v error -i ${dir}/c.mp4 -f null - 2>&1 || true`);
check('video + AAC: everything decodes', err.trim() === '', err.slice(0, 200));
let vol = sh(`ffmpeg -v info -i ${dir}/c.mp4 -map 0:a -af volumedetect -f null - 2>&1 | grep mean_volume || true`);
check('AAC sound is the 440 Hz tone (not silence)', /mean_volume: (-?[\d.]+)/.test(vol) && +RegExp.$1 > -30, vol.trim());

// video + Opus (packets taken out of an Ogg file made by libopus)
sh(`ffmpeg -v error -y -f lavfi -i "sine=frequency=660:duration=${SECS}:sample_rate=48000" -ac 2 -c:a libopus -b:a 96k -f ogg ${dir}/s.ogg`);
const ogg = fs.readFileSync(`${dir}/s.ogg`), packets = [];
for (let o = 0, cur = []; o + 27 <= ogg.length;) {
  const segs = ogg[o + 26], table = ogg.subarray(o + 27, o + 27 + segs);
  let d = o + 27 + segs;
  for (let i = 0; i < segs; i++) { cur.push(ogg.subarray(d, d + table[i])); d += table[i]; if (table[i] < 255) { packets.push(Buffer.concat(cur)); cur = []; } }
  o = d;
}
const opusHead = packets[0]; // OpusHead, then OpusTags, then audio
m = videoMuxer();
m.setAudio({ codec: 'opus', sampleRate: 48000, channels: opusHead[9], description: new Uint8Array(opusHead) });
packets.slice(2).forEach(pk => m.addAudio(new Uint8Array(pk), 960));
fs.writeFileSync(`${dir}/d.mp4`, m.finish());
p = JSON.parse(sh(`ffprobe -v error -show_entries stream=codec_type,codec_name,sample_rate,channels:format=duration -of json ${dir}/d.mp4`));
check('video + Opus sound: both tracks there', p.streams.length === 2 && p.streams[1].codec_name === 'opus', p.streams.map(x => x.codec_name).join(' ') + ' ' + p.format.duration);
err = sh(`ffmpeg -v error -i ${dir}/d.mp4 -f null - 2>&1 || true`);
check('video + Opus: everything decodes', err.trim() === '', err.slice(0, 200));
vol = sh(`ffmpeg -v info -i ${dir}/d.mp4 -map 0:a -af volumedetect -f null - 2>&1 | grep mean_volume || true`);
check('Opus sound is the 660 Hz tone', /mean_volume: (-?[\d.]+)/.test(vol) && +RegExp.$1 > -30, vol.trim());
fs.rmSync(dir, { recursive: true, force: true });
console.log(fails ? fails + ' FAILED' : 'all checks passed');
