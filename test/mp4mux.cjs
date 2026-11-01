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
fs.rmSync(dir, { recursive: true, force: true });
console.log(fails ? fails + ' FAILED' : 'all checks passed');
