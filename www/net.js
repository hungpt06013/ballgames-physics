/* Ballgames Physics – online play: the match state as exact numbers, each player's button as a log of presses, and
 * the rollback that keeps every device showing the same match. Pure logic (no DOM, no network) so it runs in the
 * browser and in Node for testing.
 *
 * How it works
 *  - Time in a round is counted in physics steps (1/120 s). Every button change is stamped with the step it happens
 *    at and gets a sequence number (q) from the device that owns that button.
 *  - The host's device plays the real match (scores, weather, highlights) a few steps behind the present: it only
 *    plays a step once it has the buttons of everybody for it (or once a player has kept it waiting MAX_WAIT steps:
 *    then his button counts as unchanged, and a change that comes too late is moved to the next step still open).
 *    Those are the official presses. Every few steps it sends the real state (exact doubles) and the official presses.
 *  - Every device, the host's too, shows a prediction: the latest real state, played on to the present with every
 *    press known so far (one's own at once; somebody else's as soon as it arrives; unknown ones as unchanged). When
 *    something about the past turns out different (a press that arrived late, a new real state), the present is
 *    played again from the real state - a rollback - and the jump this makes on screen is eased out over a moment.
 *  - The engine is deterministic and the state is sent bit for bit, so with the same presses every device computes
 *    exactly the same match (tested: test/netsync.cjs).
 */
(function (root, factory) {
  var E = root && root.BGP ? root.BGP : (typeof require === 'function' ? require('./engine.js') : null);
  var api = factory(E);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BGNet = api;
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  var DT = E.DT;
  // raised whenever the game plays differently (physics, sports, bots): games of different versions do not play
  // together online (the guest is told to update). 2: v4.2 (the giant ball's smaller goal, bots' bicycle kicks)
  var VERSION = 2;
  // the longest the host waits for somebody's buttons (steps); a change arriving later is moved to the next open step
  var MAX_WAIT = 30;
  // the jump a rollback makes on screen fades out with this time constant (s); a jump bigger than SNAP px is not eased
  var EASE_T = 0.09, SNAP = 260;

  // ---------------------------------------------------------------- the state as numbers
  var KINDS = ['', 'kick', 'head', 'body'];
  var ITEM_TYPES = [''].concat(Object.keys(E.ITEMS));
  // player fields (b: true/false)
  var PF = [['x'], ['y'], ['vx'], ['vy'], ['a'], ['w'], ['leg'], ['legW'], ['phase'], ['prev', 1], ['press', 1], ['gT'], ['cT'],
    ['jumpCd'], ['jumpT'], ['popT'], ['downT'], ['riseT'], ['air', 1], ['slide'], ['holdT'], ['active', 1], ['role'], ['baseSc']];
  var BF = [['x'], ['y'], ['vx'], ['vy'], ['ang'], ['spin'], ['outT'], ['stillT'], ['over'], ['prevX'], ['prevY'], ['touchGround', 1],
    ['lastTeam'], ['lastAng'], ['lastX'], ['lastPid'], ['lastAir', 1], ['lastLeg']];
  function n01(v) { return v ? 1 : 0; }

  // the whole state of a world (what the next steps depend on) as an array of doubles
  function encode(w) {
    var o = [VERSION, w.balls.length, w.time, w.seed, w.itemT, w.bombT, w.credit, w.scoreBall], i, j, k;
    for (i = 0; i < 4; i++) {
      var p = w.players[i];
      for (j = 0; j < PF.length; j++) o.push(PF[j][1] ? n01(p[PF[j][0]]) : p[PF[j][0]]);
      o.push(p.sc);
    }
    for (i = 0; i < w.balls.length; i++) {
      var b = w.balls[i];
      for (j = 0; j < BF.length; j++) o.push(BF[j][1] ? n01(b[BF[j][0]]) : b[BF[j][0]]);
      o.push(b.lastBy[0], b.lastBy[1], b.touchT[0], b.touchT[1], Math.max(0, KINDS.indexOf(b.lastKind)));
    }
    var it = w.item;
    o.push(n01(it.on), it.x, it.y, Math.max(0, ITEM_TYPES.indexOf(it.type)), it.life, n01(it.landed));
    var fx = w.fx;
    o.push(fx.kick[0], fx.kick[1], fx.shield[0], fx.shield[1], fx.freeze[0], fx.freeze[1], fx.big[0], fx.big[1], fx.big[2], fx.big[3], fx.magnetT, fx.magnetId);
    var hz = w.hz;
    o.push(hz.quakeT, hz.quakeDur, hz.torT, hz.torDur, hz.torX0, hz.torX, hz.stun[0], hz.stun[1], hz.stun[2], hz.stun[3], hz.craters.length);
    for (k = 0; k < hz.craters.length; k++) { var c = hz.craters[k]; o.push(c.x, c.r, c.d, c.t); }
    for (k = 0; k < 6; k++) o.push(w.stick[k], w.side[k]);
    var A = w.arena; // (the moving crossbars: worked out again every step, sent for the picture)
    o.push(A.goalTop || 0, A.segs.length > 1 ? A.segs[0].y1 : 0, A.segs.length > 1 ? A.segs[0].y2 : 0, A.segs.length > 1 ? A.segs[1].y1 : 0, A.segs.length > 1 ? A.segs[1].y2 : 0);
    return new Float64Array(o);
  }
  // puts a state from encode() into w (a world of the same round: same sport, settings and modifiers)
  function decode(w, a) {
    if (a[0] !== VERSION) throw new Error('state version');
    var o = 1, nb = a[o++], i, j;
    w.time = a[o++]; w.seed = a[o++]; w.itemT = a[o++]; w.bombT = a[o++]; w.credit = a[o++]; w.scoreBall = a[o++];
    for (i = 0; i < 4; i++) {
      var p = w.players[i];
      for (j = 0; j < PF.length; j++) p[PF[j][0]] = PF[j][1] ? a[o++] === 1 : a[o++];
      var sc = a[o++];
      if (p.sc !== sc) E.setScale(p, sc);
    }
    if (w.balls.length !== nb) throw new Error('ball count');
    for (i = 0; i < nb; i++) {
      var b = w.balls[i];
      for (j = 0; j < BF.length; j++) b[BF[j][0]] = BF[j][1] ? a[o++] === 1 : a[o++];
      b.lastBy[0] = a[o++]; b.lastBy[1] = a[o++]; b.touchT[0] = a[o++]; b.touchT[1] = a[o++]; b.lastKind = KINDS[a[o++]] || '';
    }
    w.ball = w.balls[0];
    var it = w.item;
    it.on = a[o++] === 1; it.x = a[o++]; it.y = a[o++]; it.type = ITEM_TYPES[a[o++]] || ''; it.life = a[o++]; it.landed = a[o++] === 1;
    var fx = w.fx;
    fx.kick[0] = a[o++]; fx.kick[1] = a[o++]; fx.shield[0] = a[o++]; fx.shield[1] = a[o++]; fx.freeze[0] = a[o++]; fx.freeze[1] = a[o++];
    fx.big[0] = a[o++]; fx.big[1] = a[o++]; fx.big[2] = a[o++]; fx.big[3] = a[o++]; fx.magnetT = a[o++]; fx.magnetId = a[o++];
    var hz = w.hz;
    hz.quakeT = a[o++]; hz.quakeDur = a[o++]; hz.torT = a[o++]; hz.torDur = a[o++]; hz.torX0 = a[o++]; hz.torX = a[o++];
    hz.stun[0] = a[o++]; hz.stun[1] = a[o++]; hz.stun[2] = a[o++]; hz.stun[3] = a[o++];
    var nc = a[o++]; hz.craters.length = 0;
    for (i = 0; i < nc; i++) { hz.craters.push({ x: a[o], r: a[o + 1], d: a[o + 2], t: a[o + 3] }); o += 4; }
    for (i = 0; i < 6; i++) { w.stick[i] = a[o++]; w.side[i] = a[o++]; }
    var A = w.arena;
    if (A.moveGoal) { A.goalTop = a[o]; A.segs[0].y1 = a[o + 1]; A.segs[0].y2 = a[o + 2]; A.segs[1].y1 = a[o + 3]; A.segs[1].y2 = a[o + 4]; }
    o += 5;
    for (i = 0; i < 4; i++) if (w.players[i].active) E.shapes(w.players[i]);
    return w;
  }
  // a short fingerprint of a state (to compare two devices)
  function hash(arr) {
    var u = new Uint32Array(arr.buffer, arr.byteOffset, arr.length * 2), h = 0x811c9dc5;
    for (var i = 0; i < u.length; i++) { h ^= u[i]; h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  // doubles <-> text for messages, bit for bit
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', B64I = {};
  for (var bi = 0; bi < 64; bi++) B64I[B64.charAt(bi)] = bi;
  function toText(arr) {
    var u = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength), s = '', i;
    for (i = 0; i + 2 < u.length; i += 3) { var n = (u[i] << 16) | (u[i + 1] << 8) | u[i + 2]; s += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63]; }
    var r = u.length - i;
    if (r === 1) { n = u[i] << 16; s += B64[n >> 18] + B64[(n >> 12) & 63] + '=='; }
    else if (r === 2) { n = (u[i] << 16) | (u[i + 1] << 8); s += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + '='; }
    return s;
  }
  function fromText(s) {
    var len = s.length / 4 * 3 - (s.slice(-2) === '==' ? 2 : (s.slice(-1) === '=' ? 1 : 0)), u = new Uint8Array(len), j = 0;
    for (var i = 0; i < s.length; i += 4) {
      var n = (B64I[s[i]] << 18) | (B64I[s[i + 1]] << 12) | ((B64I[s[i + 2]] || 0) << 6) | (B64I[s[i + 3]] || 0);
      if (j < len) u[j++] = n >> 16; if (j < len) u[j++] = (n >> 8) & 255; if (j < len) u[j++] = n & 255;
    }
    if (len % 8) throw new Error('state length');
    return new Float64Array(u.buffer);
  }

  // ---------------------------------------------------------------- one button's presses
  // entries { q: sequence number, n: step, v: down?, o: official (step fixed by the host) }, in sequence order
  function Log() { this.e = []; }
  Log.prototype.find = function (q) { for (var i = this.e.length - 1; i >= 0; i--) if (this.e[i].q === q) return i; return -1; };
  // returns true when the log changed
  Log.prototype.put = function (q, n, v, official) {
    var i = this.find(q);
    if (i >= 0) {
      var x = this.e[i];
      if (x.o || (!official && x.n === n)) return false;
      if (official) { var ch = x.n !== n || x.v !== v; x.n = n; x.v = v; x.o = true; return ch; }
      x.n = n; return true;
    }
    var e = { q: q, n: n, v: !!v, o: !!official }, k = this.e.length;
    while (k > 0 && this.e[k - 1].q > q) k--;
    this.e.splice(k, 0, e);
    return true;
  };
  Log.prototype.last = function () { return this.e.length ? this.e[this.e.length - 1] : null; };
  // the value at step n: v0 at step `from`, then every change after `from` up to n. Steps never go back in sequence
  // order (a change can't happen before an earlier one); a change of one's own not official yet, stamped at or
  // before `from`, would be moved by the host past it: it counts from `from` + 1.
  Log.prototype.at = function (n, v0, from, officialOnly) {
    var v = v0, eff = -Infinity;
    for (var i = 0; i < this.e.length; i++) {
      var x = this.e[i];
      if (officialOnly && !x.o) continue;
      var s = Math.max(x.n, eff);
      if (!x.o && s <= from) s = from + 1;
      eff = s;
      if (s <= from) continue;
      if (s > n) break;
      v = x.v;
    }
    return v;
  };
  Log.prototype.prune = function (before) { var k = 0; while (k < this.e.length - 1 && this.e[k].n < before && this.e[k].o) k++; if (k) this.e.splice(0, k); };

  // ---------------------------------------------------------------- the host's side
  // nSlots buttons (2 with one button per side, 4 with one per player). The host plays the real match.
  function Host(nSlots, opts) {
    opts = opts || {};
    this.ns = nSlots; this.maxWait = opts.maxWait || MAX_WAIT;
    this.remote = []; this.qMax = []; this.qOwn = [];
    for (var i = 0; i < nSlots; i++) { this.remote.push(false); this.qMax.push(0); this.qOwn.push(0); }
    this.r = 0; this.round(0);
  }
  // a new round: the real state is at step 0, nobody presses
  Host.prototype.round = function (r) {
    this.r = r; this.C = 0; this.playT = 0; this.logs = []; this.known = []; this.fresh = []; this.v0 = [];
    for (var i = 0; i < this.ns; i++) { this.logs.push(new Log()); this.known.push(0); this.v0.push(false); }
  };
  Host.prototype.T = function () { return Math.floor(this.playT); };
  Host.prototype.setRemote = function (slot, on) { this.remote[slot] = !!on; this.known[slot] = Math.max(this.known[slot], this.C); };
  Host.prototype.value = function (slot) { var l = this.logs[slot].last(); return l ? l.v : this.v0[slot]; };
  Host.prototype.at = function (slot, n) { return this.logs[slot].at(n, this.v0[slot], -1); };
  Host.prototype.add = function (slot, q, n, v) {
    var l = this.logs[slot].last();
    n = Math.max(n, this.C + 1, l ? l.n : 0);
    this.logs[slot].put(q, n, v, true);
    this.fresh.push([slot, q, n, v ? 1 : 0]);
    this.ver = (this.ver || 0) + 1;
    return n;
  };
  // this device's own button (and a bot's) changes now (stamped at the present step, or the next one still open)
  Host.prototype.local = function (slot, v, n) {
    v = !!v;
    if (this.value(slot) === v) return;
    this.qOwn[slot] = Math.max(this.qOwn[slot], this.qMax[slot]) + 1; this.qMax[slot] = this.qOwn[slot];
    this.add(slot, this.qOwn[slot], n === undefined ? this.T() : n, v);
  };
  // a remote player's changes [[q, step, down], ...] (the last few, sent again every time), known up to step upTo
  Host.prototype.remoteIn = function (slot, list, upTo) {
    for (var i = 0; i < list.length; i++) {
      var q = list[i][0], n = list[i][1], v = !!list[i][2];
      if (q <= this.qMax[slot]) continue;
      this.qMax[slot] = q;
      if (this.value(slot) !== v) this.add(slot, q, n, v);
    }
    if (upTo > this.known[slot]) this.known[slot] = upTo;
  };
  // can step n be played for real? (everybody's buttons known up to it, or somebody kept it waiting too long)
  Host.prototype.ready = function (n) {
    if (n > this.T()) return false;
    if (n <= this.T() - this.maxWait) return true;
    for (var i = 0; i < this.ns; i++) if (this.remote[i] && this.known[i] < n) return false;
    return true;
  };
  Host.prototype.inputs = function (n, out) { for (var i = 0; i < this.ns; i++) out[i] = this.at(i, n); return out; };
  Host.prototype.confirmed = function (n) {
    this.C = n;
    if (n % 240 === 0) for (var i = 0; i < this.ns; i++) this.logs[i].prune(n - 600);
  };
  // what has changed since the last call: [[slot, q, step, down], ...] (official)
  Host.prototype.takeFresh = function () { var f = this.fresh; this.fresh = []; return f; };
  // the official changes after step `after`, for every slot (sent with each real state, in case a message was lost)
  Host.prototype.recent = function (after) {
    var out = [];
    for (var i = 0; i < this.ns; i++) {
      var e = this.logs[i].e;
      for (var k = e.length - 1; k >= 0 && e[k].n > after; k--) out.push([i, e[k].q, e[k].n, e[k].v ? 1 : 0]);
    }
    return out;
  };
  // the last change of every button the host has had
  Host.prototype.ack = function () { return this.qMax.slice(); };
  // the presses at step n of the real match (sent with a real state as `cur`)
  Host.prototype.cur = function (n) { var o = []; for (var i = 0; i < this.ns; i++) o.push(this.at(i, n) ? 1 : 0); return o; };

  // ---------------------------------------------------------------- a guest's side
  function Guest(nSlots, me) {
    this.ns = nSlots; this.me = me; this.q = 0; this.round(0);
  }
  Guest.prototype.round = function (r) {
    this.r = r; this.baseN = -1; this.cur = []; this.logs = []; this.sent = [];
    for (var i = 0; i < this.ns; i++) { this.logs.push(new Log()); this.cur.push(false); }
    this.ver = 0;
  };
  Guest.prototype.value = function (slot) { var l = this.logs[slot].last(); return l ? l.v : this.cur[slot]; };
  // this device's button changes at step n; returns the entries to send (the last few, sent every time)
  Guest.prototype.local = function (v, n) {
    v = !!v;
    if (this.me >= 0 && this.value(this.me) !== v) {
      this.q++;
      this.logs[this.me].put(this.q, n, v, false);
      this.sent.push([this.q, n, v ? 1 : 0]);
      if (this.sent.length > 12) this.sent.shift();
      this.ver++;
    }
    return this.sent;
  };
  // official changes from the host [[slot, q, step, down], ...]
  Guest.prototype.official = function (list) {
    var ch = false;
    for (var i = 0; i < list.length; i++) { var x = list[i]; if (this.logs[x[0]].put(x[1], x[2], !!x[3], true)) ch = true; }
    if (ch) this.ver++;
    return ch;
  };
  // a real state at step n: the presses at that step (cur), the official changes around it, and the last change of
  // each button the host has had (ack). A change of mine it has had but that isn't in the list was played long ago
  // (or changed nothing): it is in cur already and is dropped.
  Guest.prototype.base = function (n, cur, list, ack) {
    this.baseN = n;
    for (var i = 0; i < this.ns; i++) this.cur[i] = !!cur[i];
    this.official(list);
    var me = this.me;
    if (me >= 0 && ack) {
      var a = ack[me] || 0, e = this.logs[me].e;
      for (i = e.length - 1; i >= 0; i--) if (!e[i].o && e[i].q <= a) e.splice(i, 1);
      this.sent = this.sent.filter(function (s) { return s[0] > a; });
    }
    for (i = 0; i < this.ns; i++) this.logs[i].prune(n - 240);
    this.ver++;
  };
  // the official presses of steps a+1..b are all known (from the host)?
  Guest.prototype.knownTo = function (a, b) { return b <= this.baseN; };
  Guest.prototype.inputs = function (n, out) {
    for (var i = 0; i < this.ns; i++) out[i] = this.logs[i].at(n, this.cur[i], this.baseN);
    return out;
  };

  // ---------------------------------------------------------------- the prediction (with rollback)
  // press(inputs) -> the presses of the 4 players for a step (one button per side drives both players of the side)
  function Predictor(nSlots) {
    this.ns = nSlots;
    this.w = E.emptyWorld(); this.n = -1; this.old = E.emptyWorld(); this.ok = false;
    this.ver = -1; this.baseVer = -1; this.emitN = -1; this.evs = [];
    this.inp = []; this.pr = [false, false, false, false];
    this.off = new Float64Array(4 * 3 + 2 * 2);
    this.stats = { runs: 0, rollbacks: 0, fixes: 0, maxFix: 0, steps: 0 };
  }
  Predictor.prototype.reset = function () { this.ok = false; this.n = -1; this.emitN = -1; this.off.fill(0); };
  Predictor.prototype.presses = function () {
    var inp = this.inp, pr = this.pr;
    if (this.ns === 2) { pr[0] = pr[1] = inp[0]; pr[2] = pr[3] = inp[1]; } else for (var i = 0; i < 4; i++) pr[i] = inp[i];
    return pr;
  };
  // play w on from step a to step b; the events of steps not played before are kept (sounds, sparks)
  Predictor.prototype.play = function (w, a, b, inputs, emit) {
    for (var n = a + 1; n <= b; n++) {
      inputs(n, this.inp);
      var fresh = emit && n > this.emitN;
      w.events = fresh ? [] : null;
      E.stepPlayers(w, this.presses());
      if (fresh) { for (var i = 0; i < w.events.length; i++) this.evs.push(w.events[i]); this.emitN = n; }
      this.stats.steps++;
    }
    w.events = null;
  };
  // the world at step T: the real state `base` (at step baseN) played on with inputs(n, out). baseVer / ver change
  // whenever the real state or anything known about the presses changes; then everything is played again from the
  // real state and the difference to what was shown is eased out.
  Predictor.prototype.run = function (base, baseN, baseVer, T, inputs, ver) {
    if (T < baseN) T = baseN;
    this.stats.runs++;
    var same = this.ok && baseVer === this.baseVer && ver === this.ver && this.n >= baseN && this.n <= T;
    if (same) { this.play(this.w, this.n, T, inputs, true); this.n = T; return this.w; }
    var cont = this.ok && this.n >= 0 && this.n <= T && T - this.n < 60;
    if (cont) { E.copyWorld(this.old, this.w); this.play(this.old, this.n, T, inputs, false); }
    E.copyWorld(this.w, base); this.w.events = null;
    this.play(this.w, baseN, T, inputs, true);
    if (cont) this.fix(this.old, this.w);
    this.n = T; this.ok = true; this.baseVer = baseVer; this.ver = ver; this.stats.rollbacks++;
    return this.w;
  };
  // what was shown (old) and what is now known to be right (w) differ: ease the difference out
  Predictor.prototype.fix = function (old, w) {
    var o = this.off, big = 0, i, k;
    for (i = 0; i < 4; i++) {
      var p = old.players[i], q = w.players[i];
      if (!q.active) continue;
      var dx = p.x - q.x, dy = p.y - q.y, da = p.a - q.a;
      while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      var d = Math.sqrt(dx * dx + dy * dy); big = Math.max(big, d);
      if (d > SNAP) continue;
      o[i * 3] += dx; o[i * 3 + 1] += dy; o[i * 3 + 2] += da;
    }
    if (old.balls.length === w.balls.length) for (k = 0; k < w.balls.length && k < 2; k++) {
      var bx = old.balls[k].x - w.balls[k].x, by = old.balls[k].y - w.balls[k].y, bd = Math.sqrt(bx * bx + by * by);
      big = Math.max(big, bd);
      if (bd > SNAP) continue;
      o[12 + k * 2] += bx; o[12 + k * 2 + 1] += by;
    }
    if (big > 1e-9) { this.stats.fixes++; this.stats.maxFix = Math.max(this.stats.maxFix, big); }
  };
  Predictor.prototype.ease = function (dt) { var k = Math.exp(-dt / EASE_T); for (var i = 0; i < this.off.length; i++) { this.off[i] *= k; if (Math.abs(this.off[i]) < 0.01) this.off[i] = 0; } };
  // what to draw: the prediction plus what is left of the eased-out jumps (into out, a world of the same round)
  Predictor.prototype.view = function (out) {
    var w = this.w, o = this.off, i;
    E.copyWorld(out, w);
    for (i = 0; i < 4; i++) { var p = out.players[i]; if (!p.active) continue; p.x += o[i * 3]; p.y += o[i * 3 + 1]; p.a += o[i * 3 + 2]; E.shapes(p); }
    for (i = 0; i < out.balls.length && i < 2; i++) { out.balls[i].x += o[12 + i * 2]; out.balls[i].y += o[12 + i * 2 + 1]; }
    return out;
  };
  Predictor.prototype.takeEvents = function () { var e = this.evs; this.evs = []; return e; };

  // ---------------------------------------------------------------- the check
  // Played again from the previous real state (prev, at step a) with the official presses, does a guest get exactly
  // the host's next real state (next, at step b)? (Only meaningful when nothing outside the physics - lightning,
  // a quake... - changed the world in between.) Returns true / false.
  function replayMatches(prev, a, next, b, logs, curA, scratch, ns) {
    var w = E.copyWorld(scratch, prev), inp = [], pr = [false, false, false, false], i;
    w.events = null;
    for (var n = a + 1; n <= b; n++) {
      for (i = 0; i < ns; i++) inp[i] = logs[i].at(n, curA[i], a, true);
      if (ns === 2) { pr[0] = pr[1] = inp[0]; pr[2] = pr[3] = inp[1]; } else for (i = 0; i < 4; i++) pr[i] = inp[i];
      E.stepPlayers(w, pr);
    }
    var x = encode(w), y = encode(next);
    if (x.length !== y.length) return false;
    for (i = 0; i < x.length; i++) if (x[i] !== y[i] && !(x[i] !== x[i] && y[i] !== y[i])) return false;
    return true;
  }

  // ---------------------------------------------------------------- sessions: the messages of both sides
  // Messages (JSON): r = round. Reliable: {t:'round', r, info, d} a new round (info: what the game needs to make its
  // world; d: its state at step 0), {t:'go', r, k, T} the round's clock runs on from step T (k: steps per step),
  // {t:'stop', r} it stops (a pause, a point).
  // Unreliable (may get lost or come in another order; everything important is sent again):
  //  guest -> host {t:'in', r, c: [[q, step, down], ...], u: known up to step}, {t:'pi', i: ping id}
  //  host -> guest {t:'in', r, f: [[slot, q, step, down], ...]} official changes (the newest),
  //                {t:'sn', r, n, d, cur, rec, ack, x} the real state at step n (x counts changes made outside the
  //                physics, e.g. lightning: a guest only checks its replay when x stayed the same),
  //                {t:'po', i, T, k, r} pong: the host's present step T and clock speed k
  var SNAP_EVERY = 6, PING_MS = 100;

  // The host. send(peerId, msg, reliable). The game calls frame() every frame while a round is played, and gives a
  // function that plays one real step (it asks inputs(n) for the presses, botPress() for its bots' choices first).
  function HostSession(nSlots, mySlot, send) {
    this.ns = nSlots; this.me = mySlot; this.send = send;
    this.h = new Host(nSlots); this.pred = new Predictor(nSlots);
    this.peers = {}; this.world = null; this.playing = false; this.rate = 1; this.ext = 0; this.lastSnap = -99;
    this.inp = []; this.pr = [false, false, false, false]; this.baseVer = 0;
  }
  HostSession.prototype.addPeer = function (id, slot) { this.peers[id] = { slot: slot }; if (slot >= 0) this.h.setRemote(slot, true); };
  HostSession.prototype.removePeer = function (id) {
    var p = this.peers[id]; delete this.peers[id];
    if (p && p.slot >= 0) this.h.setRemote(p.slot, false);
  };
  HostSession.prototype.each = function (msg, reliable) { for (var id in this.peers) this.send(id, msg, reliable); };
  HostSession.prototype.onMessage = function (id, m) {
    var p = this.peers[id];
    if (!p || !m) return;
    if (m.t === 'in' && m.r === this.h.r && p.slot >= 0 && Array.isArray(m.c)) this.h.remoteIn(p.slot, m.c, +m.u || 0);
    else if (m.t === 'pi') this.send(id, { t: 'po', i: m.i, T: this.h.playT, k: this.rate, r: this.h.r, p: this.playing ? 1 : 0 }, false);
  };
  // a new round: world is its state at step 0; info goes to the guests so they can make the same world
  HostSession.prototype.round = function (r, world, info) {
    this.h.round(r); this.pred.reset(); this.world = world; this.playing = false; this.lastSnap = -99; this.baseVer++;
    for (var id in this.peers) if (this.peers[id].slot >= 0) this.h.setRemote(this.peers[id].slot, true);
    this.each({ t: 'round', r: r, info: info, d: toText(encode(world)) }, true);
  };
  HostSession.prototype.go = function (rate) { this.playing = true; this.rate = rate; this.each({ t: 'go', r: this.h.r, k: rate, T: this.h.playT }, true); };
  HostSession.prototype.stop = function () { if (!this.playing) return; this.playing = false; this.each({ t: 'stop', r: this.h.r }, true); };
  // the world was changed outside the physics (lightning, a quake...)
  HostSession.prototype.edited = function () { this.ext++; };
  HostSession.prototype.botPress = function (slot, v, n) { this.h.local(slot, v, n); };
  HostSession.prototype.presses = function (inp) {
    var pr = this.pr;
    if (this.ns === 2) { pr[0] = pr[1] = inp[0]; pr[2] = pr[3] = inp[1]; } else for (var i = 0; i < 4; i++) pr[i] = inp[i];
    return pr;
  };
  // the presses of the 4 players at step n of the real match
  HostSession.prototype.inputs = function (n) { return this.presses(this.h.inputs(n, this.inp)); };
  // a frame: the clock moves on, this device's button, then every step that can be played for real (step(n) plays
  // step n and returns true when the round is over), then what the guests need
  HostSession.prototype.frame = function (dt, localPress, step) {
    if (!this.playing) return;
    var h = this.h;
    h.playT += dt / DT * this.rate;
    if (this.me >= 0) h.local(this.me, localPress);
    for (var k = 0; k < 60 && this.playing && h.ready(h.C + 1); k++) {
      var n = h.C + 1, over = step(n);
      h.confirmed(n); this.baseVer++;
      if (over) { this.playing = false; break; }
    }
    if (h.C - this.lastSnap >= SNAP_EVERY || (!this.playing && h.C !== this.lastSnap)) this.snap();
    var f = h.takeFresh();
    if (f.length || this.relayAgain > 0) {
      if (f.length) this.relayAgain = 3; else this.relayAgain--;
      this.each({ t: 'in', r: h.r, f: h.recent(h.C - 30) }, false);
    }
  };
  HostSession.prototype.snap = function () {
    var h = this.h;
    this.lastSnap = h.C;
    this.each({ t: 'sn', r: h.r, n: h.C, d: toText(encode(this.world)), cur: h.cur(h.C), rec: h.recent(h.C - 60), ack: h.ack(), x: this.ext }, false);
  };
  // what this device shows: the real match played on to the present (into out, a world of the same round)
  HostSession.prototype.view = function (dt, out) {
    var h = this.h, self = this;
    this.pred.run(this.world, h.C, this.baseVer, Math.max(h.C, h.T()), function (n, o) { return h.inputs(n, o); }, h.ver || 0);
    this.pred.ease(dt);
    return this.pred.view(out);
  };

  // A guest. send(msg, reliable). makeWorld(info) makes the world of a round (the same sport, settings, modifiers).
  function GuestSession(nSlots, mySlot, send, makeWorld) {
    this.ns = nSlots; this.me = mySlot; this.send = send; this.makeWorld = makeWorld;
    this.g = new Guest(nSlots, mySlot); this.pred = new Predictor(nSlots); this.clock = new Clock();
    this.base = null; this.spare = null; this.baseVer = 0; this.playing = false; this.r = -1; this.info = null;
    this.pings = {}; this.pingId = 0; this.pingT = 0; this.now = 0; this.lastX = 0;
    this.check = { done: 0, bad: 0, skipped: 0 }; this.lastNow = 0;
  }
  GuestSession.prototype.onMessage = function (m, now) {
    if (!m) return;
    var g = this.g;
    if (m.t === 'round') {
      this.r = m.r; this.info = m.info; g.round(m.r);
      this.base = decode(this.makeWorld(m.info), fromText(m.d)); this.spare = this.makeWorld(m.info);
      g.baseN = 0; this.baseVer++; this.pred.reset(); this.playing = false; this.clock.run = false; this.clock.reset(0); this.lastX = -1;
      this.clock.rate = m.info && m.info.rate || 1;
    } else if (m.r !== this.r) return;
    else if (m.t === 'go') {
      this.playing = true; this.clock.rate = m.k || 1; this.clock.run = true;
      this.clock.reset((+m.T || 0) + (this.clock.rtt ? this.clock.rtt / 2 / 1000 / DT * this.clock.rate : 0));
    } else if (m.t === 'stop') { this.playing = false; this.clock.run = false; }
    else if (m.t === 'in') { if (Array.isArray(m.f)) g.official(m.f); }
    else if (m.t === 'sn') {
      if (!(m.n > g.baseN) || !this.base) return;
      var next = decode(this.spare, fromText(m.d)), prevN = g.baseN, prevCur = g.cur.slice();
      g.official(m.rec || []);
      // played again from the previous real state with the official presses: exactly the host's state?
      if (m.x === this.lastX && prevN >= 0 && m.n - prevN <= 60) {
        if (replayMatches(this.base, prevN, next, m.n, g.logs, prevCur, this.scratch || (this.scratch = E.emptyWorld()), this.ns)) this.check.done++;
        else { this.check.done++; this.check.bad++; }
      } else this.check.skipped++;
      this.lastX = m.x;
      g.base(m.n, m.cur || [], [], m.ack);
      this.spare = this.base; this.base = next; this.baseVer++;
    } else if (m.t === 'po') {
      var t0 = this.pings[m.i];
      if (t0 === undefined) return;
      delete this.pings[m.i];
      if (m.p) this.clock.sample(m.T, now - t0, m.k || 1); else this.clock.rtt = this.clock.rtt ? this.clock.rtt * 0.8 + (now - t0) * 0.2 : now - t0;
    }
  };
  // a frame (now: ms): the clock, this device's button, a ping now and then
  GuestSession.prototype.frame = function (dt, now, localPress) {
    this.now = now;
    if (now - this.pingT >= PING_MS) {
      this.pingT = now; this.pingId++; this.pings[this.pingId] = now;
      if (this.pingId > 40) delete this.pings[this.pingId - 40];
      this.send({ t: 'pi', i: this.pingId }, false);
    }
    if (!this.playing || !this.base) return;
    this.clock.tick(dt);
    var T = Math.max(this.clock.T(), this.g.baseN);
    this.send({ t: 'in', r: this.r, c: this.g.local(localPress, T), u: T }, false);
  };
  GuestSession.prototype.T = function () { return Math.max(this.clock.T(), this.g.baseN); };
  // what this device shows (into out, a world of the same round)
  GuestSession.prototype.view = function (dt, out) {
    if (!this.base) return null;
    var g = this.g;
    this.pred.run(this.base, g.baseN, this.baseVer, this.playing ? this.T() : g.baseN, function (n, o) { return g.inputs(n, o); }, g.ver);
    this.pred.ease(dt);
    return this.pred.view(out);
  };

  // ---------------------------------------------------------------- the clock
  // A guest's estimate of the host's present step: every answer to a ping says where the host was; the estimate
  // follows it smoothly (a little faster or slower), and jumps only when it is far off.
  function Clock() { this.t = 0; this.rtt = 0; this.best = Infinity; this.samples = []; this.run = false; this.rate = 1; }
  Clock.prototype.reset = function (t) { this.t = t || 0; this.samples = []; this.best = Infinity; };
  // the host was at step hostT (its clock running at `rate` steps per step) when it answered a ping sent rtt ms ago
  Clock.prototype.sample = function (hostT, rtt, rate) {
    this.rate = rate;
    this.samples.push(rtt); if (this.samples.length > 20) this.samples.shift();
    this.best = Math.min.apply(null, this.samples);
    this.rtt = this.rtt ? this.rtt * 0.8 + rtt * 0.2 : rtt;
    if (rtt > this.best * 1.6 + 25) return; // a slow answer says little about the time
    var est = hostT + (rtt / 2) / 1000 / DT * rate, err = est - this.t;
    if (Math.abs(err) > 12) this.t = est; else this.t += err * 0.25;
  };
  Clock.prototype.tick = function (dt) { if (this.run) this.t += dt / DT * this.rate; };
  Clock.prototype.T = function () { return Math.floor(this.t); };

  return {
    VERSION: VERSION, MAX_WAIT: MAX_WAIT, encode: encode, decode: decode, hash: hash, toText: toText, fromText: fromText,
    Log: Log, Host: Host, Guest: Guest, Predictor: Predictor, Clock: Clock, replayMatches: replayMatches,
    HostSession: HostSession, GuestSession: GuestSession, SNAP_EVERY: SNAP_EVERY
  };
});
