/* Ballgames Physics – match history and highlight storage.
 * A highlight clip is a run of recorded physics frames (the same 88-value frames the replay uses),
 * kept at 30 per second and squeezed into 16-bit integers; playback interpolates between them.
 * History lives in localStorage; highlight data in IndexedDB (browser) or in app files (Android). */
(function () {
  'use strict';

  // ---- frame layout (must match the replay recorder in game.js) ----
  var FS = 90, STEP = 4, RATE = 120 / STEP; // keep every 4th physics step: 30 frames per second
  var POS = 2, ANG = 5000, MS = 1000, ONE = 1, JUMP = 250;
  var SCALE = [], ANGLE = {}, DISCRETE = {}, PLACE = {};
  // kind: 'a' angle, 'd' discrete (nearest frame), 'p' position (nearest frame when it jumps, e.g. a re-drop)
  function add(scale, kind) {
    var j = SCALE.length;
    if (kind === 'a') ANGLE[j] = 1; else if (kind === 'd') DISCRETE[j] = 1; else if (kind === 'p') PLACE[j] = 1;
    SCALE.push(scale);
  }
  add(MS); // time since the clip start
  for (var i = 0; i < 4; i++) { add(POS, 'p'); add(POS, 'p'); add(ANG, 'a'); add(ANG); add(ONE, 'd'); add(MS); add(MS); add(MS); } // x y a leg press sc cT stun
  for (i = 0; i < 2; i++) { add(POS, 'p'); add(POS, 'p'); add(ANG, 'a'); add(4); add(4); add(ONE, 'd'); } // x y ang vx vy lastTeam
  add(ONE, 'd'); add(POS, 'p'); add(POS, 'p'); add(ONE, 'd'); // item: on, x, y, type
  add(POS); // goal top
  for (i = 0; i < 10; i++) add(MS); // fire, shield, freeze (2 each), big (4)
  add(MS); add(ONE, 'd'); // magnet time, holder
  add(100); // bomb fuse (up to a minute)
  add(MS); add(MS); add(MS); add(MS); add(POS, 'p'); // quake t/dur, tornado t/dur, tornado x
  for (i = 0; i < 3; i++) { add(POS, 'd'); add(POS, 'd'); add(POS, 'd'); add(MS); } // craters x r d t
  add(10000); add(POS, 'd'); add(POS, 'd'); add(MS); add(POS, 'd'); add(MS); add(ONE, 'd'); add(ONE, 'd'); // fog, bolt x y age, warn x, zap, zap ball, bomb gone
  add(ONE, 'd'); add(ONE, 'd'); // last player of each side to touch the first ball
  if (SCALE.length !== FS) throw new Error('highlight frame layout mismatch');
  var TAU = Math.PI * 2;
  function wrapA(a) { a = a % TAU; if (a > Math.PI) a -= TAU; else if (a <= -Math.PI) a += TAU; return a; }
  function q16(v, s) { v = Math.round(v * s); return v > 32767 ? 32767 : (v < -32767 ? -32767 : (v === v ? v : 0)); }

  // recorder ring buffer (buf, ring size, frame size) frames [from, to] -> compact clip frames
  function encode(buf, ring, from, to) {
    var n = Math.floor((to - from) / STEP) + 1, out = new Int16Array(n * FS), t0 = buf[(from % ring) * FS];
    for (var f = 0; f < n; f++) {
      var o = ((from + f * STEP) % ring) * FS, d = f * FS;
      out[d] = q16(buf[o] - t0, MS);
      for (var j = 1; j < FS; j++) out[d + j] = q16(ANGLE[j] ? wrapA(buf[o + j]) : buf[o + j], SCALE[j]);
    }
    return out;
  }
  // frame at (fractional) position k of a clip, written into `dst` (a Float32Array of FS values)
  function frameAt(frames, k, dst) {
    var n = frames.length / FS, a = Math.max(0, Math.min(n - 1, Math.floor(k))), b = Math.min(n - 1, a + 1), u = Math.max(0, Math.min(1, k - a));
    var oa = a * FS, ob = b * FS;
    for (var j = 0; j < FS; j++) {
      var va = frames[oa + j] / SCALE[j], vb = frames[ob + j] / SCALE[j];
      if (DISCRETE[j] || (PLACE[j] && Math.abs(vb - va) > JUMP)) dst[j] = u < 0.5 ? va : vb;
      else if (ANGLE[j]) dst[j] = va + wrapA(vb - va) * u;
      else dst[j] = va + (vb - va) * u;
    }
    return dst;
  }

  // frames are stored as the change from the previous frame (mostly tiny numbers, which compress far better)
  function delta(fr) {
    var out = new Int16Array(fr.length);
    for (var j = 0; j < FS && j < fr.length; j++) out[j] = fr[j];
    for (var o = FS; o < fr.length; o++) out[o] = fr[o] - fr[o - FS]; // wraps around like 16-bit integers
    return out;
  }
  function undelta(fr) { for (var o = FS; o < fr.length; o++) fr[o] = fr[o] + fr[o - FS]; return fr; }

  // ---- packing a match's highlight: header JSON + all clip frames, gzip when the platform has it ----
  function pack(hl) {
    var head = { v: 2, fs: FS, match: hl.match, clips: hl.clips.map(function (c) { var m = Object.assign({}, c); delete m.frames; m.n = c.frames.length; return m; }) };
    var json = new TextEncoder().encode(JSON.stringify(head)), pad = json.length % 2;
    var total = 4 + json.length + pad, i;
    for (i = 0; i < hl.clips.length; i++) total += hl.clips[i].frames.byteLength;
    var out = new Uint8Array(total), dv = new DataView(out.buffer);
    dv.setUint32(0, json.length, true); out.set(json, 4);
    var o = 4 + json.length + pad;
    for (i = 0; i < hl.clips.length; i++) { var fr = delta(hl.clips[i].frames); out.set(new Uint8Array(fr.buffer), o); o += fr.byteLength; }
    return gzip(out).then(function (z) {
      var res = new Uint8Array(5 + z.data.length);
      res.set([66, 71, 72, 49, z.gz ? 1 : 0]); res.set(z.data, 5); // "BGH1" + flag
      return res;
    });
  }
  function unpack(bytes) {
    if (!(bytes && bytes.length > 5 && bytes[0] === 66 && bytes[1] === 71 && bytes[2] === 72)) return Promise.reject(new Error('not a highlight'));
    var body = bytes.subarray(5);
    return (bytes[4] ? gunzip(body) : Promise.resolve(body)).then(function (raw) {
      var copy = new Uint8Array(raw.length); copy.set(raw);
      var dv = new DataView(copy.buffer), len = dv.getUint32(0, true);
      var head = JSON.parse(new TextDecoder().decode(copy.subarray(4, 4 + len)));
      if (head.fs !== FS) throw new Error('old highlight format');
      var o = 4 + len + (len % 2);
      head.clips.forEach(function (c) { c.frames = undelta(new Int16Array(copy.buffer, o, c.n)); o += c.n * 2; });
      return { match: head.match, clips: head.clips };
    });
  }
  function streamBytes(bytes, ts) {
    var s = new Blob([bytes]).stream().pipeThrough(ts);
    return new Response(s).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  function gzip(bytes) {
    if (typeof CompressionStream === 'undefined') return Promise.resolve({ gz: false, data: bytes });
    return streamBytes(bytes, new CompressionStream('gzip')).then(function (d) { return { gz: true, data: d }; }, function () { return { gz: false, data: bytes }; });
  }
  function gunzip(bytes) { return streamBytes(bytes, new DecompressionStream('gzip')); }

  // ---- storage of the packed highlights ----
  var native = window.BGNative && typeof window.BGNative.hlPut === 'function' ? window.BGNative : null;
  function toB64(u8) { var s = '', CH = 0x8000; for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH)); return btoa(s); }
  function fromB64(b64) { var s = atob(b64), u8 = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i); return u8; }
  var dbP = null, memory = {};
  function db() {
    if (!dbP) dbP = new Promise(function (res, rej) {
      if (!window.indexedDB) { rej(new Error('no indexedDB')); return; }
      var q = indexedDB.open('bgp_highlights', 1);
      q.onupgradeneeded = function () { q.result.createObjectStore('hl'); };
      q.onsuccess = function () { res(q.result); };
      q.onerror = function () { rej(q.error); };
    });
    return dbP;
  }
  function idb(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var tx = d.transaction('hl', mode), r = fn(tx.objectStore('hl'));
        tx.oncomplete = function () { res(r && r.result); };
        tx.onerror = tx.onabort = function () { rej(tx.error || new Error('storage failed')); };
      });
    });
  }
  var store = {
    put: function (id, bytes) {
      if (native) return Promise.resolve(native.hlPut(id, toB64(bytes))).then(function (ok) { if (!ok) throw new Error('storage full'); });
      return idb('readwrite', function (s) { return s.put(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), id); })
        .catch(function (e) { if (e && e.name === 'QuotaExceededError') throw e; memory[id] = bytes; });
    },
    get: function (id) {
      if (memory[id]) return Promise.resolve(memory[id]);
      if (native) { var b = native.hlGet(id); return b ? Promise.resolve(fromB64(b)) : Promise.reject(new Error('missing')); }
      return idb('readonly', function (s) { return s.get(id); }).then(function (v) { if (!v) throw new Error('missing'); return new Uint8Array(v); });
    },
    del: function (id) {
      delete memory[id];
      if (native) { native.hlDel(id); return Promise.resolve(); }
      return idb('readwrite', function (s) { return s.delete(id); }).catch(function () { /* already gone */ });
    }
  };

  // ---- match history ----
  var HKEY = 'bgp_history', MAX_HISTORY = 500;
  var history = (function () { try { return JSON.parse(localStorage.getItem(HKEY)) || []; } catch (e) { return []; } })();
  function saveHistory() { try { localStorage.setItem(HKEY, JSON.stringify(history)); } catch (e) { /* storage unavailable */ } }
  function byId(id) { for (var i = 0; i < history.length; i++) if (history[i].id === id) return history[i]; return null; }
  function withHL() { return history.filter(function (r) { return r.hl && !r.hl.gone; }); }
  function usage() { var b = 0, n = 0; withHL().forEach(function (r) { b += r.hl.bytes; n++; }); return { bytes: b, count: n }; }
  function dropHL(rec) { if (!rec || !rec.hl || rec.hl.gone) return Promise.resolve(); rec.hl.gone = true; saveHistory(); return store.del(rec.id); }
  // keep the newest `keep` highlights (keep = Infinity: all, 0: none)
  function enforce(keep) {
    var list = withHL(), jobs = [];
    for (var i = keep; i < list.length; i++) jobs.push(dropHL(list[i]));
    return Promise.all(jobs);
  }
  // store a finished match; `hl` = { match, clips } or null; policy = { mode: 'all'|'last'|'none', keep }
  function addMatch(rec, hl, policy) {
    history.unshift(rec);
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
    saveHistory();
    if (!hl || !hl.clips.length || policy.mode === 'none') return Promise.resolve(rec);
    return pack(hl).then(function (bytes) {
      var attempt = function (left) {
        return store.put(rec.id, bytes).then(function () {
          rec.hl = { bytes: bytes.length, clips: hl.clips.length }; saveHistory();
          return enforce(policy.mode === 'last' ? policy.keep : Infinity);
        }, function (e) {
          // the device is full: make room by dropping the oldest highlights, then try again
          var list = withHL();
          if (!left || !list.length) throw e;
          return dropHL(list[list.length - 1]).then(function () { return attempt(left - 1); });
        });
      };
      return attempt(20);
    }).then(function () { return rec; }, function () { return rec; });
  }
  function clearAll(alsoHistory) {
    var jobs = history.filter(function (r) { return r.hl && !r.hl.gone; }).map(function (r) { return store.del(r.id); });
    if (alsoHistory) history.length = 0; else history.forEach(function (r) { if (r.hl) r.hl.gone = true; });
    saveHistory();
    return Promise.all(jobs);
  }
  function load(id) { return store.get(id).then(unpack); }

  window.BGHL = {
    FS: FS, STEP: STEP, RATE: RATE, encode: encode, frameAt: frameAt, pack: pack, unpack: unpack,
    history: function () { return history; }, byId: byId, usage: usage, addMatch: addMatch, load: load,
    dropHL: dropHL, enforce: enforce, clearAll: clearAll, withHL: withHL, isApp: !!native, toB64: toB64,
    _store: store
  };
})();
