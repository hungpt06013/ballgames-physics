/* Ballgames Physics – canvas drawing: arenas, crowd, players (faces & cosmetics), balls, power-ups. */
(function () {
  'use strict';
  var E = window.BGP;
  var W = E.W, GROUND = E.GROUND, COM_H = E.COM_H;
  var HIP_Y = COM_H - E.HIP_H, SH_Y = COM_H - E.SHOULDER_H, HEAD_Y = COM_H - 158;
  var SKIN = '#f8e2c0', INK = '#1d1d1f', TAU = Math.PI * 2, BURNT_SKIN = '#4a3b31';
  var skin = SKIN; // skin colour of the player being drawn
  var FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  // ---------- helpers ----------
  function line(c, x1, y1, x2, y2) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
  function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, TAU); }
  function rrect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function outlined(c, path, width, inner, color) {
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = INK; c.lineWidth = width; c.stroke(path);
    c.strokeStyle = color; c.lineWidth = inner; c.stroke(path);
  }
  function hash(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function textOutlined(c, txt, x, y, size, fill, stroke) {
    c.font = '900 ' + size + 'px ' + FONT;
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    c.lineWidth = Math.max(3, size * 0.22); c.strokeStyle = stroke; c.strokeText(txt, x, y);
    c.fillStyle = fill; c.fillText(txt, x, y);
  }
  function emoji(c, txt, x, y, size) {
    c.font = size + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, x, y);
  }
  function star(c, x, y, r) {
    c.beginPath();
    for (var k = 0; k < 10; k++) { var a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; c[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath();
  }

  // ---------- background ----------
  var CROWD_COLS = ['#ef5b5b', '#3fb4ea', '#f5a524', '#4cc36b', '#a66bea', '#f37ac1', '#f2d33a', '#ffffff', '#5a5f6b'];
  // the calm crowd is drawn once into an offscreen canvas; only a cheering crowd is animated per frame
  var crowdCache = { key: '', cv: null };
  function crowd(c, m, x0, x1, t, excite) {
    var top = GROUND - 205;
    if (excite < 0.05 && typeof document !== 'undefined') {
      var k = c.getTransform ? c.getTransform().a : 1, y0 = top - 30, h = GROUND - y0;
      var key = m.id + '|' + Math.round(x0) + '|' + Math.round(x1) + '|' + k.toFixed(3);
      if (crowdCache.key !== key) {
        var cv = crowdCache.cv || document.createElement('canvas');
        cv.width = Math.ceil((x1 - x0) * k); cv.height = Math.ceil(h * k);
        var cc = cv.getContext('2d');
        cc.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
        cc.clearRect(x0, y0, x1 - x0, h);
        crowdDraw(cc, m, x0, x1, 0, 0);
        crowdCache.key = key; crowdCache.cv = cv;
      }
      c.drawImage(crowdCache.cv, x0, y0, x1 - x0, h);
      return;
    }
    crowdDraw(c, m, x0, x1, t, excite);
  }
  function crowdDraw(c, m, x0, x1, t, excite) {
    var top = GROUND - 205, i, r;
    c.save();
    c.globalAlpha = m.dark ? 0.35 : 0.55;
    c.fillStyle = '#c9d6dc';
    c.fillRect(x0, top, x1 - x0, GROUND - top);
    for (r = 0; r < 4; r++) {
      var y = top + 22 + r * 42;
      for (var x = Math.floor(x0 / 34) * 34 + (r % 2) * 17; x < x1; x += 34) {
        i = Math.round(x / 17) * 7 + r * 131;
        var hop = Math.max(0, Math.sin(t * (7 + hash(i) * 3) + i)) * (2 + excite * 16);
        c.fillStyle = CROWD_COLS[Math.floor(hash(i) * CROWD_COLS.length)];
        rrect(c, x - 10, y - hop + 8, 20, 26, 7); c.fill();
        c.fillStyle = hash(i + 3) < 0.5 ? '#f8e2c0' : '#d9a776';
        circle(c, x, y - hop, 9); c.fill();
        if (excite > 0.3 && hash(i + 9) < 0.5) { // arms up when the crowd goes wild
          c.strokeStyle = c.fillStyle; c.lineWidth = 4;
          line(c, x - 9, y - hop + 12, x - 14, y - hop - 10); line(c, x + 9, y - hop + 12, x + 14, y - hop - 10);
        }
      }
    }
    c.globalAlpha = 1;
    // advertising boards / boards in front of the stands
    c.fillStyle = m.dark ? '#2a3770' : '#eaf2f5';
    c.fillRect(x0, GROUND - 34, x1 - x0, 34);
    c.fillStyle = 'rgba(0,0,0,0.08)';
    c.fillRect(x0, GROUND - 38, x1 - x0, 5);
    c.restore();
  }

  function skyDeco(c, m, x0, x1, t) {
    var i;
    if (m.deco === 'moon') {
      c.fillStyle = '#ffffff';
      for (i = 0; i < 90; i++) {
        var sx = x0 + hash(i) * (x1 - x0), sy = -60 + hash(i + 50) * (GROUND - 80);
        c.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.3 + i));
        c.fillRect(sx, sy, 3, 3);
      }
      c.globalAlpha = 1;
      circle(c, 1290, 150, 58); c.fillStyle = '#3d8fe0'; c.fill(); c.lineWidth = 5; c.strokeStyle = INK; c.stroke();
      c.fillStyle = '#5cc04f';
      c.beginPath(); c.ellipse(1272, 135, 22, 15, 0.4, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(1310, 172, 18, 11, -0.3, 0, TAU); c.fill();
      return;
    }
    if (m.deco === 'sand') {
      circle(c, 1340, 140, 62); c.fillStyle = '#ffd23f'; c.fill(); c.lineWidth = 5; c.strokeStyle = INK; c.stroke();
      c.fillStyle = '#39b7e3'; c.fillRect(x0, GROUND - 80, x1 - x0, 80);
      c.strokeStyle = '#ffffff'; c.lineWidth = 4; c.beginPath();
      for (var wx = x0; wx < x1; wx += 40) { c.moveTo(wx, GROUND - 60 + Math.sin(wx * 0.05 + t * 2) * 3); c.lineTo(wx + 22, GROUND - 60 + Math.sin(wx * 0.05 + t * 2 + 1) * 3); }
      c.stroke();
    }
    c.fillStyle = m.dark ? '#2a3770' : '#ffffff';
    for (i = 0; i < 7; i++) {
      var span = (x1 - x0) + 400;
      var cx = x0 - 200 + ((hash(i + 3) * span + t * (6 + i * 2)) % span);
      var cy = 70 + hash(i + 9) * 250, s = 0.7 + hash(i + 17) * 0.7;
      c.beginPath();
      c.arc(cx, cy, 34 * s, 0, TAU); c.arc(cx + 40 * s, cy - 14 * s, 42 * s, 0, TAU);
      c.arc(cx + 86 * s, cy, 32 * s, 0, TAU); c.rect(cx, cy, 86 * s, 32 * s);
      c.fill();
    }
  }

  function ground(c, m, x0, x1, bottom) {
    var h = bottom - GROUND, i, x;
    c.fillStyle = m.ground; c.fillRect(x0, GROUND, x1 - x0, h);
    c.fillStyle = m.ground2;
    switch (m.deco) {
      case 'grass':
        for (x = Math.floor(x0 / 160) * 160; x < x1; x += 160) c.fillRect(x, GROUND, 80, h);
        break;
      case 'wood':
        c.fillRect(x0, GROUND, x1 - x0, 14);
        c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 3;
        for (i = 1; i < 6; i++) line(c, x0, GROUND + i * 30, x1, GROUND + i * 30);
        for (i = 0; i < 6; i++) for (x = Math.floor(x0 / 260) * 260 + (i % 2) * 130; x < x1; x += 260) line(c, x, GROUND + i * 30, x, GROUND + i * 30 + 30);
        break;
      case 'yard':
        c.fillStyle = 'rgba(255,255,255,0.75)';
        for (x = 160; x <= W - 160; x += 160) c.fillRect(x - 3, GROUND, 6, 26);
        break;
      case 'sand':
        for (i = 0; i < 70; i++) c.fillRect(x0 + hash(i + 70) * (x1 - x0), GROUND + 12 + hash(i + 140) * (h - 20), 6, 4);
        break;
      case 'moon':
        for (i = 0; i < 9; i++) {
          c.beginPath(); c.ellipse(x0 + hash(i + 200) * (x1 - x0), GROUND + 25 + hash(i + 220) * 70, 30 + hash(i) * 40, 9 + hash(i + 1) * 8, 0, 0, TAU); c.fill();
        }
        break;
      case 'ice':
        c.strokeStyle = 'rgba(120,170,200,0.35)'; c.lineWidth = 3;
        for (i = 0; i < 16; i++) { var ix = x0 + hash(i + 300) * (x1 - x0), iy = GROUND + 15 + hash(i + 330) * 80; line(c, ix, iy, ix + 70, iy + 8); }
        c.fillStyle = '#e06a6a'; c.fillRect(W / 2 - 4, GROUND, 8, h);
        break;
      case 'dirt':
        for (i = 0; i < 40; i++) { circle(c, x0 + hash(i + 400) * (x1 - x0), GROUND + 14 + hash(i + 440) * (h - 20), 3 + hash(i) * 5); c.fill(); }
        break;
    }
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x0, GROUND, x1 - x0, 5);
  }

  function background(c, m, x0, x1, bottom, t, excite) {
    skyDeco(c, m, x0, x1, t);
    if (m.crowd) crowd(c, m, x0, x1, t, excite || 0);
    ground(c, m, x0, x1, bottom);
  }

  // ---------- arena structures ----------
  function drawGoal(c, A, side, col) {
    var D = A.goalD, top = A.goalTop;
    c.save();
    if (side === 1) { c.translate(W, 0); c.scale(-1, 1); }
    var p = new Path2D();
    p.moveTo(6, GROUND); p.lineTo(6, top - 19); p.lineTo(D, top); p.lineTo(D, GROUND);
    c.fillStyle = 'rgba(255,255,255,0.88)'; c.fill(p);
    c.save(); c.clip(p);
    c.strokeStyle = '#a8b8c4'; c.lineWidth = 2; c.beginPath();
    for (var x = 6; x < D; x += 13) { c.moveTo(x, top - 22); c.lineTo(x, GROUND); }
    for (var y = top - 22; y < GROUND; y += 13) { c.moveTo(6, y); c.lineTo(D, y); }
    c.stroke(); c.restore();
    outlined(c, p, 14, 8, col);
    // goal line: the ball has to cross it completely
    c.fillStyle = 'rgba(255,255,255,0.9)'; c.fillRect(D - 4, GROUND + 2, 8, 34);
    c.restore();
  }
  function drawHoop(c, A, side, layer, col) {
    var bx = A.boardX, rf = A.rimFront, ry = A.rimY;
    c.save();
    if (side === 1) { c.translate(W, 0); c.scale(-1, 1); }
    if (layer === 'back') {
      var p = new Path2D(); p.moveTo(bx - 55, GROUND); p.lineTo(bx - 55, ry + 70); p.lineTo(bx, ry + 40);
      outlined(c, p, 15, 9, col);
      rrect(c, bx - 8, ry - 165, 16, 220, 4); c.fillStyle = '#ffffff'; c.fill(); c.lineWidth = 4; c.strokeStyle = INK; c.stroke();
    } else {
      var net = new Path2D(), n = 5, i;
      for (i = 0; i <= n; i++) {
        var tx = bx + 10 + (rf - bx - 10) * i / n, bxx = bx + 24 + (rf - bx - 40) * i / n;
        net.moveTo(tx, ry); net.lineTo(bxx, ry + 64);
        if (i < n) { var tx2 = bx + 10 + (rf - bx - 10) * (i + 1) / n, bx2 = bx + 24 + (rf - bx - 40) * (i + 1) / n; net.moveTo(tx, ry); net.lineTo(bx2, ry + 64); net.moveTo(tx2, ry); net.lineTo(bxx, ry + 64); }
      }
      outlined(c, net, 5.5, 2.5, '#ffffff');
      var rim = new Path2D(); rim.moveTo(bx, ry); rim.lineTo(rf + 3, ry);
      outlined(c, rim, 13, 7, col);
    }
    c.restore();
  }
  function drawPosts(c, A, side, col) {
    var x = A.postX, by = A.barY;
    c.save();
    if (side === 1) { c.translate(W, 0); c.scale(-1, 1); }
    var p = new Path2D();
    p.moveTo(x, GROUND); p.lineTo(x, by);
    p.moveTo(x - 22, by - 330); p.lineTo(x - 22, by); p.lineTo(x + 22, by); p.lineTo(x + 22, by - 330);
    outlined(c, p, 14, 8, col);
    c.restore();
  }
  function drawNet(c, A) {
    var x = W / 2, top = A.netTop;
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x - 9, top, 18, GROUND - top);
    c.strokeStyle = 'rgba(40,40,40,0.55)'; c.lineWidth = 2; c.beginPath();
    for (var y = top; y < GROUND; y += 12) { c.moveTo(x - 9, y); c.lineTo(x + 9, y); }
    c.moveTo(x - 9, top); c.lineTo(x - 9, GROUND); c.moveTo(x + 9, top); c.lineTo(x + 9, GROUND);
    c.stroke();
    var p = new Path2D(); p.moveTo(x, GROUND); p.lineTo(x, top - 6);
    outlined(c, p, 9, 4, '#d8d8d8');
    rrect(c, x - 13, top - 6, 26, 12, 4); c.fillStyle = '#ffffff'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
  }
  function drawMidline(c) {
    var x = W / 2;
    // cones mark the line nobody may cross
    for (var k = 0; k < 2; k++) {
      var cx = x + (k ? 26 : -26);
      c.beginPath(); c.moveTo(cx - 14, GROUND); c.lineTo(cx, GROUND - 40); c.lineTo(cx + 14, GROUND); c.closePath();
      c.fillStyle = '#f2d33a'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
      c.fillStyle = '#ffffff'; c.fillRect(cx - 7, GROUND - 24, 14, 6);
    }
    c.save(); c.globalAlpha = 0.5; c.setLineDash([18, 14]); c.strokeStyle = '#ffffff'; c.lineWidth = 4;
    line(c, x, GROUND - 200, x, GROUND); c.restore();
  }
  function structures(c, A, layer, colorOf) {
    switch (A.type) {
      case 'goal': if (layer === 'back') { drawGoal(c, A, 0, colorOf(0)); drawGoal(c, A, 1, colorOf(1)); } break;
      case 'hoop': drawHoop(c, A, 0, layer, colorOf(0)); drawHoop(c, A, 1, layer, colorOf(1)); break;
      case 'posts': if (layer === 'back') { drawPosts(c, A, 0, colorOf(0)); drawPosts(c, A, 1, colorOf(1)); } break;
      case 'volley': if (layer === 'back') drawNet(c, A); break;
      case 'bomb': if (layer === 'back') drawMidline(c); break;
    }
  }
  function shields(c, w, t) {
    var A = w.arena;
    for (var k = 0; k < 2; k++) {
      var s = A.shield[k];
      if (!s || !(w.fx.shield[k] > 0)) continue;
      var tl = w.fx.shield[k];
      c.save();
      c.globalAlpha = tl < 1.5 && Math.floor(t * 10) % 2 ? 0.25 : 0.55;
      c.lineCap = 'round';
      c.strokeStyle = '#7fe3ff'; c.lineWidth = s.r * 2 + 10; line(c, s.x1, s.y1, s.x2, s.y2);
      c.strokeStyle = '#ffffff'; c.lineWidth = 4; line(c, s.x1, s.y1, s.x2, s.y2);
      c.restore();
    }
  }

  // ---------- players ----------
  function leg(c, x, y, ang) {
    c.save(); c.translate(x, y); c.rotate(-ang);
    var L = 64;
    c.lineCap = 'round';
    c.strokeStyle = INK; c.lineWidth = 15; line(c, 0, 0, 0, L - 2);
    c.strokeStyle = skin; c.lineWidth = 9; line(c, 0, 0, 0, L - 16);
    c.strokeStyle = '#ffffff'; line(c, 0, L - 17, 0, L - 5);
    c.fillStyle = INK; c.beginPath(); c.ellipse(5, L + 1, 12.5, 7.5, 0, 0, TAU); c.fill();
    c.restore();
  }
  function arm(c, x, y, ang, col, len) {
    len = len || 44;
    c.save(); c.translate(x, y); c.rotate(-ang);
    c.lineCap = 'round';
    c.strokeStyle = INK; c.lineWidth = 13; line(c, 0, 0, 0, len);
    c.strokeStyle = skin; c.lineWidth = 7; line(c, 0, 2, 0, len);
    if (col) { c.strokeStyle = col; c.lineWidth = 8; line(c, 0, 0, 0, 11); }
    c.restore();
  }
  function hairPath(c, kind, hx, hy, r, color) {
    c.fillStyle = color; c.strokeStyle = INK; c.lineWidth = 2;
    switch (kind) {
      case 'bald': return;
      case 'afro':
        circle(c, hx - 4, hy - 6, r + 9); c.fill(); return; // drawn behind the head
      case 'long':
        c.beginPath(); c.arc(hx - 1, hy - 2, r + 2, Math.PI * 0.85, Math.PI * 2.04); c.lineTo(hx - 8, hy - 4); c.lineTo(hx - r - 6, hy + 26); c.lineTo(hx - r - 2, hy + 6); c.closePath(); c.fill(); return;
      case 'spiky':
        c.beginPath(); c.moveTo(hx - r, hy - 2);
        for (var k = 0; k <= 5; k++) { var a = Math.PI * (1.0 + k * 0.2); c.lineTo(hx + Math.cos(a) * (r + 12), hy + Math.sin(a) * (r + 12)); c.lineTo(hx + Math.cos(a + 0.1) * (r - 2), hy + Math.sin(a + 0.1) * (r - 2)); }
        c.closePath(); c.fill(); return;
      case 'pony':
        c.beginPath(); c.arc(hx - 1, hy - 2, r + 1, Math.PI * 0.9, Math.PI * 2.04); c.closePath(); c.fill();
        c.beginPath(); c.ellipse(hx - r - 8, hy + 2, 7, 15, 0.4, 0, TAU); c.fill(); return;
      case 'mohawk':
        c.fillStyle = '#e8463c';
        c.beginPath(); c.moveTo(hx - 14, hy - 12);
        for (k = 0; k < 5; k++) { var px = hx - 14 + k * 7; c.lineTo(px + 3, hy - r - 14); c.lineTo(px + 7, hy - r + 2); }
        c.closePath(); c.fill(); return;
      default:
        c.beginPath(); c.arc(hx - 1, hy - 2, r + 1, Math.PI * 0.9, Math.PI * 2.04); c.closePath(); c.fill();
    }
  }
  function hat(c, kind, hx, hy, r, col) {
    c.lineWidth = 3; c.strokeStyle = INK; c.lineJoin = 'round';
    switch (kind) {
      case 'cap':
        c.beginPath(); c.arc(hx, hy - 3, r + 1, Math.PI * 1.02, Math.PI * 1.98); c.closePath();
        c.fillStyle = col.dark; c.fill(); c.stroke();
        rrect(c, hx + 8, hy - 8, 20, 6, 3); c.fill(); c.stroke(); break;
      case 'party':
        c.beginPath(); c.moveTo(hx - 13, hy - r + 4); c.lineTo(hx + 2, hy - r - 34); c.lineTo(hx + 15, hy - r + 4); c.closePath();
        c.fillStyle = '#a66bea'; c.fill(); c.stroke();
        c.fillStyle = '#f2d33a'; circle(c, hx + 2, hy - r - 36, 6); c.fill(); c.stroke(); break;
      case 'headphones':
        c.strokeStyle = INK; c.lineWidth = 7; c.beginPath(); c.arc(hx, hy, r + 3, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
        c.strokeStyle = '#ef5b5b'; c.lineWidth = 3; c.stroke();
        c.fillStyle = '#ef5b5b'; rrect(c, hx - 9, hy - 10, 14, 20, 6); c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke(); break;
      case 'chef':
        c.fillStyle = '#ffffff';
        rrect(c, hx - 15, hy - r - 6, 30, 14, 3); c.fill(); c.stroke();
        c.beginPath(); c.arc(hx - 9, hy - r - 14, 11, 0, TAU); c.arc(hx + 9, hy - r - 14, 11, 0, TAU); c.arc(hx, hy - r - 22, 12, 0, TAU); c.fill();
        c.stroke(); break;
      case 'cowboy':
        c.fillStyle = '#9a6332';
        c.beginPath(); c.ellipse(hx, hy - r + 4, r + 16, 6, 0, 0, TAU); c.fill(); c.stroke();
        rrect(c, hx - 12, hy - r - 18, 24, 22, 7); c.fill(); c.stroke();
        c.fillStyle = col.main; c.fillRect(hx - 12, hy - r - 2, 24, 4); break;
      case 'santa':
        c.beginPath(); c.moveTo(hx - 18, hy - r + 6); c.quadraticCurveTo(hx + 4, hy - r - 40, hx - 30, hy - r - 10); c.lineTo(hx + 18, hy - r + 6); c.closePath();
        c.fillStyle = '#e8463c'; c.fill(); c.stroke();
        c.fillStyle = '#ffffff'; rrect(c, hx - 20, hy - r + 1, 40, 9, 4); c.fill(); c.stroke();
        circle(c, hx - 30, hy - r - 10, 6); c.fill(); c.stroke(); break;
      case 'viking':
        c.beginPath(); c.arc(hx, hy - 2, r + 2, Math.PI, TAU); c.closePath(); c.fillStyle = '#9aa3ad'; c.fill(); c.stroke();
        c.fillStyle = '#f4ecd6';
        c.beginPath(); c.moveTo(hx - 16, hy - 12); c.quadraticCurveTo(hx - 30, hy - 26, hx - 22, hy - 44); c.quadraticCurveTo(hx - 20, hy - 26, hx - 8, hy - 18); c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(hx + 16, hy - 12); c.quadraticCurveTo(hx + 30, hy - 26, hx + 22, hy - 44); c.quadraticCurveTo(hx + 20, hy - 26, hx + 8, hy - 18); c.closePath(); c.fill(); c.stroke(); break;
      case 'halo':
        c.strokeStyle = '#ffd23f'; c.lineWidth = 5; c.beginPath(); c.ellipse(hx, hy - r - 12, 16, 5, 0, 0, TAU); c.stroke(); break;
      case 'crown':
        c.beginPath(); c.moveTo(hx - 15, hy - r + 2); c.lineTo(hx - 15, hy - r - 14); c.lineTo(hx - 8, hy - r - 6); c.lineTo(hx, hy - r - 18);
        c.lineTo(hx + 8, hy - r - 6); c.lineTo(hx + 15, hy - r - 14); c.lineTo(hx + 15, hy - r + 2); c.closePath();
        c.fillStyle = '#ffd23f'; c.fill(); c.stroke();
        c.fillStyle = '#ef5b5b'; circle(c, hx, hy - r - 4, 3); c.fill(); break;
    }
  }
  function face(c, kind, hx, hy) {
    var ex = hx + 10, ey = hy - 1, mx = hx + 11, my = hy + 9;
    c.fillStyle = INK; c.strokeStyle = INK; c.lineWidth = 2.5; c.lineCap = 'round';
    switch (kind) {
      case 'happy':
        c.beginPath(); c.arc(ex, ey + 2, 4, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
        c.beginPath(); c.arc(mx - 1, my - 3, 6, Math.PI * 0.1, Math.PI * 0.9); c.closePath(); c.fill(); break;
      case 'sad':
        circle(c, ex, ey, 2.6); c.fill();
        c.beginPath(); c.arc(mx, my + 5, 5, Math.PI * 1.2, Math.PI * 1.8); c.stroke();
        c.fillStyle = '#7fd3ff'; c.beginPath(); c.ellipse(ex + 2, ey + 7, 2, 3.5, 0, 0, TAU); c.fill(); break;
      case 'dizzy':
        line(c, ex - 3, ey - 3, ex + 3, ey + 3); line(c, ex - 3, ey + 3, ex + 3, ey - 3);
        c.beginPath(); c.moveTo(mx - 5, my); c.quadraticCurveTo(mx - 2, my - 3, mx, my); c.quadraticCurveTo(mx + 2, my + 3, mx + 5, my); c.stroke(); break;
      case 'effort':
        circle(c, ex, ey, 2.6); c.fill();
        line(c, ex - 4, ey - 6, ex + 3, ey - 4);
        circle(c, mx, my, 3.4); c.fill(); break;
      case 'cold':
        circle(c, ex, ey, 2.6); c.fill();
        c.beginPath(); c.moveTo(mx - 5, my); for (var k = 0; k < 4; k++) c.lineTo(mx - 3 + k * 2.6, my + (k % 2 ? -2 : 2)); c.stroke(); break;
      default:
        circle(c, ex, ey, 2.6); c.fill();
        line(c, mx - 3, my, mx + 3, my);
    }
  }
  function shirtPattern(c, kind, col, num, x, y, w, h) {
    c.save(); rrect(c, x, y, w, h, 11); c.clip();
    switch (kind) {
      case 'stripes': c.fillStyle = 'rgba(255,255,255,0.75)'; for (var k = x + 4; k < x + w; k += 10) c.fillRect(k, y, 5, h); break;
      case 'hoops': c.fillStyle = col.dark; for (k = y + 6; k < y + h; k += 12) c.fillRect(x, k, w, 6); break;
      case 'stars': c.fillStyle = '#ffd23f'; star(c, x + w / 2, y + 18, 7); c.fill(); star(c, x + 8, y + 36, 4); c.fill(); star(c, x + w - 8, y + 42, 4); c.fill(); break;
      case 'flame':
        c.fillStyle = '#ffb02e'; c.beginPath(); c.moveTo(x, y + h);
        for (k = 0; k <= 6; k++) c.lineTo(x + k * w / 6, y + h - (k % 2 ? 26 : 12));
        c.lineTo(x + w, y + h); c.closePath(); c.fill(); break;
      case 'number': textOutlined(c, String(num), x + w / 2, y + h / 2 - 2, 22, '#ffffff', col.dark); break;
      default: c.fillStyle = 'rgba(255,255,255,0.85)'; c.fillRect(x + w / 2 - 3, y + 11, 6, 22);
    }
    c.restore();
  }

  // look: { col:{main,dark}, hat, hair, shirt, num, face, frozen, armT, mapId, hairCol }
  function player(c, p, look) {
    var col = look.col, at = look.armT || 0, mid = look.mapId;
    skin = look.burnt ? BURNT_SKIN : SKIN;
    c.save();
    c.translate(p.x, p.y); c.rotate(p.a); c.scale(p.f * p.sc, p.sc);
    // back arm
    arm(c, -3, SH_Y + 6, -0.35 + at * 3.0, col.dark);
    leg(c, -3, HIP_Y, 0.03);
    leg(c, 3, HIP_Y, p.leg);
    // torso
    var tx = -15, ty = SH_Y - 3, tw = 30, th = HIP_Y - SH_Y + 6;
    rrect(c, tx, ty, tw, th, 11); c.fillStyle = col.main; c.fill(); c.lineWidth = 3.5; c.strokeStyle = INK; c.stroke();
    shirtPattern(c, look.shirt, col, look.num, tx, ty, tw, th);
    rrect(c, -16, HIP_Y - 7, 32, 20, 6); c.fillStyle = col.dark; c.fill(); c.stroke();
    // head
    var hx = 3, hy = HEAD_Y, r = 19, gear = mid === 'football';
    var hairKind = look.hair || 'default';
    if (!gear && hairKind === 'afro') hairPath(c, 'afro', hx, hy, r, look.hairCol);
    circle(c, hx, hy, r); c.fillStyle = skin; c.fill(); c.lineWidth = 3.5; c.strokeStyle = INK; c.stroke();
    if (gear) {
      c.beginPath(); c.arc(hx - 1, hy - 1, r + 3, Math.PI * 0.62, Math.PI * 2.08); c.closePath();
      c.fillStyle = col.main; c.fill(); c.lineWidth = 3.5; c.strokeStyle = INK; c.stroke();
      c.strokeStyle = '#9aa0a6'; c.lineWidth = 3; c.beginPath();
      c.moveTo(hx + 12, hy - 4); c.lineTo(hx + 25, hy - 4); c.moveTo(hx + 12, hy + 5); c.lineTo(hx + 24, hy + 5); c.moveTo(hx + 24, hy - 6); c.lineTo(hx + 24, hy + 8);
      c.stroke();
    } else {
      if (hairKind !== 'afro') hairPath(c, hairKind, hx, hy, r, look.hairCol);
      var h = look.hat && look.hat !== 'none' ? look.hat : null;
      if (!h && mid === 'basket') {
        c.save(); circle(c, hx, hy, r - 1.5); c.clip();
        c.fillStyle = '#ffffff'; c.fillRect(hx - r, hy - 12, 2 * r, 9);
        c.restore();
        c.strokeStyle = INK; c.lineWidth = 2; c.strokeRect(hx - r + 1, hy - 12, 2 * r - 2, 9);
      } else if (!h && mid === 'volley') h = 'cap';
      if (h) hat(c, h, hx, hy, r, col);
    }
    face(c, look.face, hx, hy);
    if (mid === 'moon') {
      circle(c, hx, hy, r + 9); c.fillStyle = 'rgba(190,225,255,0.28)'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#ffffff'; c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 3; c.beginPath(); c.arc(hx, hy, r + 3, Math.PI * 1.15, Math.PI * 1.45); c.stroke();
    }
    arm(c, 3, SH_Y + 6, 0.3 + at * 2.75, col.main);
    if (look.frozen) {
      c.globalAlpha = 0.45; rrect(c, -28, HEAD_Y - 30, 56, COM_H - HEAD_Y + 40, 16); c.fillStyle = '#bfefff'; c.fill(); c.globalAlpha = 1;
      c.strokeStyle = '#ffffff'; c.lineWidth = 2;
      for (var k = 0; k < 4; k++) { var sx = -14 + k * 9, sy = -20 + (k % 2) * 40; line(c, sx - 5, sy, sx + 5, sy); line(c, sx, sy - 5, sx, sy + 5); }
    }
    c.restore();
    skin = SKIN;
  }

  // ---------- balls ----------
  function pentagon(c, x, y, r, rot) {
    c.beginPath();
    for (var k = 0; k < 5; k++) { var a = rot + k * TAU / 5 - Math.PI / 2; c[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); }
    c.closePath(); c.fill();
  }
  function soccerSkin(c, skin, R, t) {
    circle(c, 0, 0, R);
    switch (skin) {
      case 'smiley':
        c.fillStyle = '#ffd23f'; c.fill(); c.fillStyle = INK;
        circle(c, -R * 0.35, -R * 0.25, R * 0.12); c.fill(); circle(c, R * 0.35, -R * 0.25, R * 0.12); c.fill();
        c.lineWidth = 3; c.strokeStyle = INK; c.beginPath(); c.arc(0, R * 0.05, R * 0.55, Math.PI * 0.15, Math.PI * 0.85); c.stroke(); break;
      case 'watermelon':
        c.fillStyle = '#5cbf4a'; c.fill();
        c.save(); c.clip(); c.strokeStyle = '#2f7d2a'; c.lineWidth = 5;
        for (var k = -2; k <= 2; k++) { c.beginPath(); c.ellipse(k * R * 0.42, 0, R * 0.18, R * 1.1, 0, 0, TAU); c.stroke(); }
        c.restore(); break;
      case 'rainbow':
        var rc = ['#ef5b5b', '#f5a524', '#f2d33a', '#4cc36b', '#3fb4ea', '#a66bea'];
        for (k = 0; k < 6; k++) { c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, k * TAU / 6, (k + 1) * TAU / 6); c.closePath(); c.fillStyle = rc[k]; c.fill(); }
        circle(c, 0, 0, R * 0.25); c.fillStyle = '#ffffff'; c.fill(); break;
      case 'fire':
        var g = c.createRadialGradient(0, 0, 2, 0, 0, R);
        g.addColorStop(0, '#fff6a0'); g.addColorStop(0.5, '#ffb02e'); g.addColorStop(1, '#e8463c');
        c.fillStyle = g; c.fill(); break;
      case 'planet':
        c.fillStyle = '#3d8fe0'; c.fill();
        c.save(); c.clip(); c.fillStyle = '#5cc04f';
        c.beginPath(); c.ellipse(-R * 0.3, -R * 0.2, R * 0.4, R * 0.25, 0.4, 0, TAU); c.fill();
        c.beginPath(); c.ellipse(R * 0.35, R * 0.35, R * 0.3, R * 0.2, -0.3, 0, TAU); c.fill(); c.restore(); break;
      case 'gold':
        c.fillStyle = '#f2c230'; c.fill();
        c.save(); c.clip(); c.fillStyle = '#c4960f';
        pentagon(c, 0, 0, R * 0.36, 0);
        for (var q = 0; q < 5; q++) { var a = q * TAU / 5 - Math.PI / 2; pentagon(c, Math.cos(a) * R * 0.98, Math.sin(a) * R * 0.98, R * 0.32, Math.PI / 5); }
        c.fillStyle = 'rgba(255,255,255,0.6)'; circle(c, -R * 0.35, -R * 0.4, R * 0.18); c.fill();
        c.restore(); break;
      default:
        c.fillStyle = '#ffffff'; c.fill();
        c.save(); c.clip(); c.fillStyle = INK;
        pentagon(c, 0, 0, R * 0.36, 0);
        for (q = 0; q < 5; q++) { a = q * TAU / 5 - Math.PI / 2; pentagon(c, Math.cos(a) * R * 0.98, Math.sin(a) * R * 0.98, R * 0.32, Math.PI / 5); }
        c.restore();
    }
    void t;
  }
  // extra: { skin, fuse: seconds or -1, t }
  function ball(c, b, type, R, extra) {
    extra = extra || {};
    c.save(); c.translate(b.x, b.y);
    if (type === 'football') {
      c.rotate(b.ang);
      c.beginPath(); c.ellipse(0, 0, R * 1.4, R * 0.92, 0, 0, TAU);
      c.fillStyle = '#9a4d22'; c.fill(); c.lineWidth = 4; c.strokeStyle = INK; c.stroke();
      c.strokeStyle = '#ffffff'; c.lineWidth = 3;
      line(c, -R * 0.45, 0, R * 0.45, 0);
      for (var k = -2; k <= 2; k++) line(c, k * R * 0.2, -R * 0.18, k * R * 0.2, R * 0.18);
      line(c, -R * 1.05, -R * 0.42, -R * 1.05, R * 0.42); line(c, R * 1.05, -R * 0.42, R * 1.05, R * 0.42);
      c.restore(); return;
    }
    c.rotate(b.ang);
    circle(c, 0, 0, R);
    if (type === 'basket') {
      c.fillStyle = '#f08a24'; c.fill();
      c.save(); c.clip(); c.strokeStyle = INK; c.lineWidth = 2.5;
      line(c, -R, 0, R, 0); line(c, 0, -R, 0, R);
      c.beginPath(); c.arc(-R * 1.25, 0, R * 0.95, -0.9, 0.9); c.stroke();
      c.beginPath(); c.arc(R * 1.25, 0, R * 0.95, Math.PI - 0.9, Math.PI + 0.9); c.stroke();
      c.restore();
    } else if (type === 'volley') {
      c.fillStyle = '#ffffff'; c.fill();
      c.save(); c.clip();
      var cols = ['#ffd23f', '#3fb4ea', '#ffffff'];
      for (var j = 0; j < 3; j++) {
        c.fillStyle = cols[j]; c.beginPath();
        c.arc(Math.cos(j * TAU / 3) * R * 1.1, Math.sin(j * TAU / 3) * R * 1.1, R * 0.95, 0, TAU); c.fill();
      }
      c.strokeStyle = INK; c.lineWidth = 2; c.beginPath();
      for (j = 0; j < 3; j++) { c.moveTo(0, 0); c.lineTo(Math.cos(j * TAU / 3 + Math.PI / 3) * R, Math.sin(j * TAU / 3 + Math.PI / 3) * R); }
      c.stroke(); c.restore();
    } else if (type === 'beach') {
      var bc = ['#ef5b5b', '#ffffff', '#3fb4ea', '#ffffff', '#ffd23f', '#ffffff'];
      for (var s = 0; s < 6; s++) {
        c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, s * TAU / 6, (s + 1) * TAU / 6); c.closePath();
        c.fillStyle = bc[s]; c.fill();
      }
      circle(c, 0, 0, R * 0.2); c.fillStyle = '#ffffff'; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
      circle(c, 0, 0, R);
    } else if (type === 'bomb') {
      c.fillStyle = '#2b2b2b'; c.fill();
      c.fillStyle = 'rgba(255,255,255,0.25)'; circle(c, -R * 0.35, -R * 0.35, R * 0.25); c.fill();
      c.fillStyle = '#7a7a7a'; c.fillRect(-7, -R - 8, 14, 10);
      c.strokeStyle = '#b48a52'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, -R - 8); c.quadraticCurveTo(10, -R - 20, 4, -R - 26); c.stroke();
      var flick = 4 + Math.random() * 4;
      c.fillStyle = '#ffb02e'; circle(c, 4, -R - 27, flick); c.fill(); c.fillStyle = '#fff6a0'; circle(c, 4, -R - 27, flick * 0.5); c.fill();
    } else soccerSkin(c, extra.skin, R, extra.t);
    circle(c, 0, 0, R); c.lineWidth = 4; c.strokeStyle = INK; c.stroke();
    c.restore();
    if (extra.zap > 0) {
      c.save(); c.translate(b.x, b.y);
      if (type === 'football') { c.beginPath(); c.ellipse(0, 0, R * 1.4, R * 0.92, b.ang, 0, TAU); } else circle(c, 0, 0, R);
      c.fillStyle = 'rgba(20,20,20,0.55)'; c.fill();
      c.lineCap = 'round';
      for (var z = 0; z < 3; z++) {
        var a0 = extra.t * 7 + z * 2.1;
        c.strokeStyle = z % 2 ? '#ffffff' : '#7fe3ff'; c.lineWidth = 3; c.beginPath();
        for (var s2 = 0; s2 < 5; s2++) { var a = a0 + s2 * 0.35, rr = R * (1.05 + 0.35 * hash(z * 7 + s2 + Math.floor(extra.t * 12))); c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        c.stroke();
      }
      c.restore();
      textOutlined(c, '⚡' + Math.ceil(extra.zap), b.x, b.y - R - 26, 30, '#ffd23f', INK);
    }
    if (type === 'bomb' && extra.fuse >= 0) {
      var urgent = extra.fuse < 3;
      textOutlined(c, String(Math.max(0, Math.ceil(extra.fuse))), b.x, b.y + 2, R * 1.05, urgent && Math.floor(extra.t * 8) % 2 ? '#ff4040' : '#ffffff', INK);
    }
  }
  function trail(c, tr, R, fire) {
    var n = tr.length / 2;
    if (n < 3) return;
    var dx = tr[tr.length - 2] - tr[0], dy = tr[tr.length - 1] - tr[1];
    if (dx * dx + dy * dy < 140 * 140) return;
    for (var i = 0; i < n - 1; i++) {
      var k = (i + 1) / n;
      c.globalAlpha = (fire ? 0.6 : 0.45) * k;
      c.fillStyle = fire ? (i % 2 ? '#ffb02e' : '#e8463c') : '#ffffff';
      circle(c, tr[i * 2], tr[i * 2 + 1], R * (0.35 + 0.55 * k)); c.fill();
    }
    c.globalAlpha = 1;
  }

  // ---------- power-ups / weather ----------
  function item(c, it, t) {
    if (!it.on) return;
    var info = E.ITEMS[it.type], bob = it.landed ? Math.sin(t * 5) * 4 : 0, x = it.x, y = it.y + bob;
    if (!info) return;
    if (!it.landed) {
      c.strokeStyle = INK; c.lineWidth = 2; line(c, x - 22, y - 40, x - 14, y - 12); line(c, x + 22, y - 40, x + 14, y - 12);
      c.beginPath(); c.arc(x, y - 40, 26, Math.PI, TAU); c.closePath(); c.fillStyle = '#ffffff'; c.fill(); c.lineWidth = 3; c.stroke();
      c.fillStyle = '#ef5b5b'; c.beginPath(); c.arc(x, y - 40, 26, Math.PI * 1.33, Math.PI * 1.66); c.lineTo(x, y - 40); c.closePath(); c.fill();
    }
    if (it.landed && it.life < 2 && Math.floor(t * 10) % 2) return;
    c.globalAlpha = 0.35; circle(c, x, y, 30 + Math.sin(t * 6) * 3); c.fillStyle = '#ffd23f'; c.fill(); c.globalAlpha = 1;
    rrect(c, x - 22, y - 22, 44, 44, 10); c.fillStyle = '#ffffff'; c.fill(); c.lineWidth = 3.5; c.strokeStyle = INK; c.stroke();
    c.fillStyle = INK; emoji(c, info.icon, x, y + 2, 28);
  }
  // ---------- weather / disasters ----------
  // lightning craters: a scorched hole in the ground that fills back up
  function craters(c, hz, t) {
    for (var i = 0; i < hz.craters.length; i++) {
      var cr = hz.craters[i], k = E.craterDepth(cr), x = cr.x, r = cr.r, s;
      if (k <= 0) continue;
      c.fillStyle = 'rgba(25,18,10,0.5)'; c.beginPath(); c.ellipse(x, GROUND + 4, r + 30, 10, 0, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(x - r - 8, GROUND);
      for (s = -1; s <= 1.0001; s += 0.1) c.lineTo(x + s * r, GROUND + k * (1 - s * s));
      c.lineTo(x + r + 8, GROUND); c.closePath();
      c.fillStyle = '#2b1c12'; c.fill(); c.lineWidth = 4; c.strokeStyle = INK; c.stroke();
      for (var e = 0; e < 7; e++) {
        var q = hash(e * 3.1 + cr.x) * 1.6 - 0.8, fl = 0.5 + 0.5 * Math.sin(t * 9 + e * 2);
        c.fillStyle = 'rgba(255,' + (110 + (fl * 80 | 0)) + ',30,' + (0.45 + 0.45 * fl) * Math.min(1, k / 20) + ')';
        circle(c, x + q * r, GROUND + k * (1 - q * q) - 5, 3 + fl * 3); c.fill();
      }
    }
  }
  // tornado: a grey funnel, thin at the ground and wide in the sky, with spinning bands
  function tornado(c, hz, t) {
    if (!(hz.torT > 0)) return;
    var vis = Math.max(0, Math.min(1, (hz.torDur - hz.torT) / 0.7, hz.torT / 0.7)), x = hz.torX, top = -140, n = 18, i, k, y, half, cx;
    var pts = [];
    for (i = 0; i <= n; i++) {
      k = i / n; y = GROUND - (GROUND - top) * k; half = 34 + (E.TOR_R * 1.35 - 34) * k * k; cx = x + Math.sin(t * 3 + k * 4) * 34 * k;
      pts.push([cx, y, half]);
    }
    c.save(); c.globalAlpha = 0.6 * vis;
    c.beginPath();
    for (i = 0; i <= n; i++) c.lineTo(pts[i][0] - pts[i][2], pts[i][1]);
    for (i = n; i >= 0; i--) c.lineTo(pts[i][0] + pts[i][2], pts[i][1]);
    c.closePath();
    var g = c.createLinearGradient(x - E.TOR_R, 0, x + E.TOR_R, 0);
    g.addColorStop(0, 'rgba(110,118,130,0.35)'); g.addColorStop(0.5, 'rgba(150,158,170,0.85)'); g.addColorStop(1, 'rgba(110,118,130,0.35)');
    c.fillStyle = g; c.fill();
    c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,0.75)';
    for (i = 1; i < n; i += 2) {
      var p0 = pts[i], ph = (t * 4 + i * 0.7) % TAU;
      c.beginPath(); c.ellipse(p0[0], p0[1], p0[2] * 0.95, 6 + p0[2] * 0.08, 0, ph, ph + 2.2); c.stroke();
    }
    c.restore();
  }
  // dark cloud gathering over the spot a bolt is about to hit, and a flashing mark below it
  function lightningWarn(c, warn, t) {
    if (!warn) return;
    var x = warn.x, fl = Math.floor(t * 12) % 2;
    c.fillStyle = 'rgba(60,64,78,0.92)';
    [[-60, 20, 46], [-10, 6, 58], [48, 18, 48], [10, 34, 50]].forEach(function (q) { circle(c, x + q[0], 150 + q[1], q[2]); c.fill(); });
    c.save(); c.setLineDash([12, 10]); c.lineWidth = 5; c.strokeStyle = fl ? '#ffd23f' : 'rgba(255,210,63,0.4)';
    c.beginPath(); c.ellipse(x, GROUND + 2, 44, 10, 0, 0, TAU); c.stroke(); c.restore();
  }
  function bolt(c, b) {
    if (!b) return;
    var a = Math.max(0, 1 - b.age / 0.35), x0 = b.x + (hash(b.x) - 0.5) * 120, y0 = -160, n = 9, pts = [], i;
    for (i = 0; i <= n; i++) {
      var k = i / n, jit = i === 0 || i === n ? 0 : (hash(b.x * 0.37 + i) - 0.5) * 90;
      pts.push([x0 + (b.x - x0) * k + jit, y0 + (b.y - y0) * k]);
    }
    c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
    [[18, 'rgba(255,230,120,' + 0.45 * a + ')'], [7, 'rgba(255,255,255,' + a + ')']].forEach(function (st) {
      c.lineWidth = st[0]; c.strokeStyle = st[1]; c.beginPath();
      for (var j = 0; j <= n; j++) c.lineTo(pts[j][0], pts[j][1]);
      c.stroke();
    });
    c.restore();
  }
  // fog over the whole view (screen space): a veil plus drifting banks
  function fog(c, a, w, h, t) {
    if (!(a > 0)) return;
    c.fillStyle = 'rgba(214,221,228,' + (0.72 * a) + ')'; c.fillRect(0, 0, w, h);
    for (var i = 0; i < 6; i++) {
      var span = w + h, x = ((hash(i + 40) * span + t * (24 + 14 * i) * (i % 2 ? 1 : -1)) % span + span) % span - h * 0.5;
      var y = h * (0.15 + 0.7 * hash(i + 60)), r = h * (0.35 + 0.2 * hash(i + 80));
      var g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(240,244,248,' + 0.7 * a + ')'); g.addColorStop(1, 'rgba(240,244,248,0)');
      c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
  }

  window.BGDraw = {
    INK: INK, SKIN: SKIN, TAU: TAU, FONT: FONT,
    line: line, circle: circle, rrect: rrect, outlined: outlined, hash: hash, textOutlined: textOutlined, emoji: emoji, star: star,
    background: background, structures: structures, shields: shields, player: player, ball: ball, trail: trail, item: item,
    craters: craters, tornado: tornado, lightningWarn: lightningWarn, bolt: bolt, fog: fog
  };
})();
