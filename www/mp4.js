/* Ballgames Physics – a small MP4 writer for the highlight videos.
 * A video track, H.264 ('avc1', samples as the encoder gives them in 'avc' format, with its avcC record)
 * or VP9 ('vp09'), constant frame rate; optionally a sound track, AAC ('mp4a', with the encoder's
 * AudioSpecificConfig) or Opus ('Opus'). Each track's samples in one chunk, the index (moov) before the data so
 * the file plays as soon as it starts downloading. */
(function (root) {
  'use strict';

  function u8(v) { return [v & 255]; }
  function u16(v) { return [(v >>> 8) & 255, v & 255]; }
  function u32(v) { return [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]; }
  function str(s) { var a = []; for (var i = 0; i < s.length; i++) a.push(s.charCodeAt(i) & 255); return a; }
  function zeros(n) { var a = []; for (var i = 0; i < n; i++) a.push(0); return a; }
  // flattens nested arrays / byte arrays into one Uint8Array
  function bytes(parts) {
    var n = 0, i;
    var flat = [];
    (function walk(p) {
      if (p instanceof Uint8Array) { flat.push(p); n += p.length; }
      else if (Array.isArray(p) && p.length && (typeof p[0] !== 'number')) p.forEach(walk);
      else if (Array.isArray(p)) { var b = new Uint8Array(p); flat.push(b); n += b.length; }
    })(parts);
    var out = new Uint8Array(n), o = 0;
    for (i = 0; i < flat.length; i++) { out.set(flat[i], o); o += flat[i].length; }
    return out;
  }
  function box(type) {
    var body = bytes(Array.prototype.slice.call(arguments, 1));
    return bytes([u32(8 + body.length), str(type), body]);
  }
  function fullBox(type, version, flags) {
    return box.apply(null, [type, [version & 255].concat(u32(flags).slice(1))].concat(Array.prototype.slice.call(arguments, 3)));
  }
  // an MPEG-4 descriptor (tag, length in 4 bytes, payload) for the esds box
  function descr(tag, payload) { var b = bytes(payload); return bytes([[tag, 0x80, 0x80, 0x80, b.length & 127], b]); }
  var MATRIX = [].concat(u32(0x00010000), u32(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000));

  // codec: 'avc' (description = the encoder's avcC record) or 'vp9' (profile, level, bit depth from vp9 below)
  function Muxer(o) {
    this.w = o.width; this.h = o.height; this.fps = o.fps; this.codec = o.codec; this.desc = o.description || null;
    this.vp9 = o.vp9 || { profile: 0, level: 31, bitDepth: 8 };
    this.samples = []; this.keys = []; this.size = 0; this.audio = null;
  }
  // a sound track: codec 'aac' (description = AudioSpecificConfig) or 'opus' (description = OpusHead, if any)
  Muxer.prototype.setAudio = function (o) {
    var d = o.description || null, pre = 312;
    if (o.codec === 'opus' && d && d.length >= 12 && String.fromCharCode.apply(null, d.subarray(0, 8)) === 'OpusHead') pre = d[10] | (d[11] << 8);
    this.audio = { codec: o.codec, rate: o.sampleRate, ch: o.channels, desc: d, bitrate: o.bitrate || 128000, preSkip: pre, samples: [], durs: [], size: 0 };
  };
  // one encoded audio frame lasting `frames` samples
  Muxer.prototype.addAudio = function (data, frames) {
    var a = this.audio; a.samples.push(data); a.durs.push(frames); a.size += data.length;
  };
  Muxer.prototype.add = function (data, key) {
    this.samples.push(data); this.size += data.length;
    if (key) this.keys.push(this.samples.length);
  };
  Muxer.prototype.sampleEntry = function () {
    var visual = [zeros(6), u16(1), u16(0), u16(0), zeros(12), u16(this.w), u16(this.h), u32(0x00480000), u32(0x00480000), u32(0), u16(1),
      zeros(32), u16(0x0018), u16(0xffff)];
    if (this.codec === 'avc') return box('avc1', visual, box('avcC', this.desc));
    var v = this.vp9;
    // vpcC: profile, level, bit depth / 4:2:0 / limited range, BT.709 colours, no codec init data
    return box('vp09', visual, fullBox('vpcC', 1, 0, u8(v.profile), u8(v.level), u8((v.bitDepth << 4) | (1 << 1) | 0), u8(1), u8(1), u8(1), u16(0)));
  };
  Muxer.prototype.audioTrak = function (dataOffset, scale) {
    var a = this.audio, n = a.samples.length, total = 0, sizes = [], runs = [], i;
    for (i = 0; i < n; i++) {
      total += a.durs[i]; sizes.push(u32(a.samples[i].length));
      if (runs.length && runs[runs.length - 1][1] === a.durs[i]) runs[runs.length - 1][0]++; else runs.push([1, a.durs[i]]);
    }
    var fields = [zeros(6), u16(1), zeros(8), u16(a.ch), u16(16), u16(0), u16(0), u16(a.rate), u16(0)], entry;
    if (a.codec === 'aac') {
      entry = box('mp4a', fields, fullBox('esds', 0, 0, descr(3, [u16(1), u8(0),
        descr(4, [u8(0x40), u8(0x15), [0, 0, 0], u32(a.bitrate), u32(a.bitrate), descr(5, a.desc)]), descr(6, [u8(2)])])));
    } else {
      entry = box('Opus', fields, box('dOps', u8(0), u8(a.ch), u16(a.preSkip), u32(a.rate), u16(0), u8(0)));
    }
    var stbl = box('stbl',
      fullBox('stsd', 0, 0, u32(1), entry),
      fullBox('stts', 0, 0, u32(runs.length), runs.map(function (r) { return u32(r[0]).concat(u32(r[1])); })),
      fullBox('stsc', 0, 0, u32(1), u32(1), u32(n), u32(1)),
      fullBox('stsz', 0, 0, u32(0), u32(n), sizes),
      fullBox('stco', 0, 0, u32(1), u32(dataOffset)));
    var minf = box('minf', fullBox('smhd', 0, 0, u16(0), u16(0)), box('dinf', fullBox('dref', 0, 0, u32(1), fullBox('url ', 0, 1))), stbl);
    var mdia = box('mdia',
      fullBox('mdhd', 0, 0, u32(0), u32(0), u32(a.rate), u32(total), u16(0x55c4), u16(0)),
      fullBox('hdlr', 0, 0, u32(0), str('soun'), zeros(12), str('SoundHandler'), [0]),
      minf);
    var dur = Math.round(total / a.rate * scale);
    return { dur: dur, box: box('trak',
      fullBox('tkhd', 0, 3, u32(0), u32(0), u32(2), u32(0), u32(dur), zeros(8), u16(0), u16(1), u16(0x0100), u16(0), MATRIX, u32(0), u32(0)),
      mdia) };
  };
  Muxer.prototype.moov = function (dataOffset) {
    var n = this.samples.length, scale = this.fps * 1000, dur = n * 1000, i;
    var sizes = [], keys = [];
    for (i = 0; i < n; i++) sizes.push(u32(this.samples[i].length));
    for (i = 0; i < this.keys.length; i++) keys.push(u32(this.keys[i]));
    var stbl = box('stbl',
      fullBox('stsd', 0, 0, u32(1), this.sampleEntry()),
      fullBox('stts', 0, 0, u32(1), u32(n), u32(1000)),
      fullBox('stss', 0, 0, u32(keys.length), keys),
      fullBox('stsc', 0, 0, u32(1), u32(1), u32(n), u32(1)),
      fullBox('stsz', 0, 0, u32(0), u32(n), sizes),
      fullBox('stco', 0, 0, u32(1), u32(dataOffset)));
    var minf = box('minf', fullBox('vmhd', 0, 1, zeros(8)), box('dinf', fullBox('dref', 0, 0, u32(1), fullBox('url ', 0, 1))), stbl);
    var mdia = box('mdia',
      fullBox('mdhd', 0, 0, u32(0), u32(0), u32(scale), u32(dur), u16(0x55c4), u16(0)),
      fullBox('hdlr', 0, 0, u32(0), str('vide'), zeros(12), str('VideoHandler'), [0]),
      minf);
    var trak = box('trak',
      fullBox('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(dur), zeros(8), u16(0), u16(0), u16(0), u16(0), MATRIX, u32(this.w << 16), u32(this.h << 16)),
      mdia);
    var au = this.audio && this.audio.samples.length ? this.audioTrak(dataOffset + this.size, scale) : null;
    return box('moov',
      fullBox('mvhd', 0, 0, u32(0), u32(0), u32(scale), u32(Math.max(dur, au ? au.dur : 0)), u32(0x00010000), u16(0x0100), zeros(10), MATRIX, zeros(24), u32(au ? 3 : 2)),
      trak, au ? au.box : []);
  };
  // the file as a list of pieces (for a Blob: a long video is never copied into one big block of memory)
  Muxer.prototype.parts = function () {
    var ftyp = box('ftyp', str('isom'), u32(512), str('isom'), str('iso2'), str(this.codec === 'avc' ? 'avc1' : 'vp09'), str('mp41'));
    var moovLen = this.moov(0).length, offset = ftyp.length + moovLen + 8, a = this.audio && this.audio.samples.length ? this.audio : null;
    var data = 8 + this.size + (a ? a.size : 0);
    return [ftyp, this.moov(offset), new Uint8Array(u32(data).concat(str('mdat')))].concat(this.samples, a ? a.samples : []);
  };
  // the whole file in one block
  Muxer.prototype.finish = function () {
    var parts = this.parts(), n = 0, o = 0, i;
    for (i = 0; i < parts.length; i++) n += parts[i].length;
    var out = new Uint8Array(n);
    for (i = 0; i < parts.length; i++) { out.set(parts[i], o); o += parts[i].length; }
    return out;
  };

  var api = { Muxer: Muxer };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BGMP4 = api;
})(this);
