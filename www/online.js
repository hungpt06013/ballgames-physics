/* Ballgames Physics – the online connection. Rooms run on PeerJS: the devices talk to each other directly (WebRTC);
 * the free PeerJS server only helps them find each other (and relays when two networks can't reach each other).
 * No account, nothing to pay. Two channels per guest: 'r' reliable and in order (the room, rounds), 'u' unordered
 * (presses, states, pings: a late one doesn't hold the others up). */
(function () {
  'use strict';
  var PREFIX = 'bgp-room-', ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', CODE_LEN = 5;
  function newCode() { var s = ''; for (var i = 0; i < CODE_LEN; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)]; return s; }
  function cleanCode(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LEN); }
  function peerOpts() { return window.BGP_PEER_OPTS || { debug: 0 }; } // (tests may point it at another server)
  // tests only (window.BGP_TEST_NET = { lat, jit, loss }): a slower network - each message waits lat + up to jit ms,
  // and that share of the unordered ones is lost. Never set in the game.
  function testSend(c, msg, reliable) {
    var t = window.BGP_TEST_NET;
    if (!t) { c.send(msg); return; }
    if (!reliable && Math.random() < (t.loss || 0)) return;
    var d = (t.lat || 0) + Math.random() * (t.jit || 0);
    if (reliable) { c._due = Math.max(c._due || 0, Date.now() + d); d = c._due - Date.now(); } // (in order)
    setTimeout(function () { try { if (c.open) c.send(msg); } catch (e) { /* closing */ } }, d);
  }

  // The host's side. h: { ready(code), join(id), message(id, msg), leave(id), error(type) }
  function Host(h) { this.h = h; this.conns = {}; this.tries = 0; this.closed = false; this.open(); }
  Host.prototype.open = function () {
    var self = this;
    this.code = newCode();
    var peer = this.peer = new window.Peer(PREFIX + this.code, peerOpts());
    peer.on('open', function () { if (!self.closed) self.h.ready(self.code); });
    peer.on('connection', function (c) { self.attach(c); });
    peer.on('error', function (e) {
      if (self.closed) return;
      if (e.type === 'unavailable-id' && self.tries++ < 6) { try { peer.destroy(); } catch (x) { /* gone */ } self.open(); return; }
      // the server lost: games keep going (the devices are connected directly); try to come back for new players
      if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error' || e.type === 'socket-closed') return;
      if (e.type === 'peer-unavailable') return;
      self.h.error(e.type || 'error');
    });
    peer.on('disconnected', function () { if (!self.closed) setTimeout(function () { try { if (!self.closed && peer.disconnected && !peer.destroyed) peer.reconnect(); } catch (x) { /* later */ } }, 1500); });
  };
  Host.prototype.attach = function (c) {
    var self = this, id = c.peer, s = this.conns[id] || (this.conns[id] = { r: null, u: null, ok: false });
    s[c.label === 'u' ? 'u' : 'r'] = c;
    var ready = function () { if (!s.ok && s.r && s.u && s.r.open && s.u.open) { s.ok = true; self.h.join(id); } };
    c.on('open', ready);
    c.on('data', function (d) { if (self.conns[id] === s) self.h.message(id, d); });
    c.on('close', function () { self.drop(id); });
    c.on('error', function () { self.drop(id); });
    ready();
  };
  Host.prototype.drop = function (id) {
    var s = this.conns[id];
    if (!s) return;
    delete this.conns[id];
    try { if (s.r) s.r.close(); if (s.u) s.u.close(); } catch (e) { /* gone */ }
    if (s.ok) this.h.leave(id);
  };
  Host.prototype.send = function (id, msg, reliable) {
    var s = this.conns[id];
    if (!s || !s.ok) return;
    var c = reliable ? s.r : s.u;
    try { if (c && c.open) testSend(c, msg, reliable); } catch (e) { /* closing */ }
  };
  Host.prototype.close = function () {
    this.closed = true;
    for (var id in this.conns) this.drop(id);
    try { this.peer.destroy(); } catch (e) { /* gone */ }
  };

  // A guest's side. h: { open(), message(msg), close(why) } - why: 'nohost' (no such room), 'timeout', 'closed', ...
  function Guest(code, h) {
    var self = this;
    this.h = h; this.ok = false; this.done = false;
    var peer = this.peer = new window.Peer(peerOpts());
    peer.on('open', function () {
      if (self.done) return;
      self.r = peer.connect(PREFIX + code, { label: 'r', reliable: true, serialization: 'json' });
      self.u = peer.connect(PREFIX + code, { label: 'u', reliable: false, serialization: 'json' });
      [self.r, self.u].forEach(function (c) {
        c.on('open', function () { if (!self.ok && self.r.open && self.u.open) { self.ok = true; clearTimeout(self.timer); h.open(); } });
        c.on('data', function (d) { if (!self.done) h.message(d); });
        c.on('close', function () { self.end('closed'); });
        c.on('error', function () { self.end('closed'); });
      });
    });
    peer.on('error', function (e) {
      if (e.type === 'peer-unavailable') self.end('nohost');
      else if (!self.ok) self.end(e.type || 'error');
    });
    this.timer = setTimeout(function () { if (!self.ok) self.end('timeout'); }, 15000);
  }
  Guest.prototype.end = function (why) {
    if (this.done) return;
    this.done = true; clearTimeout(this.timer);
    try { this.peer.destroy(); } catch (e) { /* gone */ }
    this.h.close(why);
  };
  Guest.prototype.send = function (msg, reliable) {
    var c = reliable ? this.r : this.u;
    try { if (c && c.open) testSend(c, msg, reliable); } catch (e) { /* closing */ }
  };
  Guest.prototype.close = function () { this.end('left'); };

  window.BGOnline = {
    Host: Host, Guest: Guest, cleanCode: cleanCode, CODE_LEN: CODE_LEN,
    available: function () { return typeof window.Peer === 'function' && typeof window.RTCPeerConnection === 'function'; }
  };
})();
