/* Ballgames Physics – physics engine, sports, modifiers, power-ups and bot AI.
 * Pure logic (no DOM) so it runs both in the browser and in Node for testing. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BGP = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var W = 1600, H = 900, GROUND = 780, CEIL = -700;
  var DT = 1 / 120;
  var ITERS = 3;
  var BALL_MAX = 2300;

  // ---- player geometry (local frame: lx forward, ly up from the feet) ----
  var COM_H = 95, HIP_H = 80, SHOULDER_H = 138;
  var BODY = [[-4, 10, 10], [-3, 44, 9], [0, 78, 14], [0, 103, 15], [0, 128, 15], [2, 158, 19]];
  var LEG = [[36, 9], [67, 11]];
  var NB = BODY.length, NS = NB + LEG.length;
  var HEAD = 5;
  var RAD = new Float64Array(NS);
  for (var ri = 0; ri < NB; ri++) RAD[ri] = BODY[ri][2];
  for (ri = 0; ri < LEG.length; ri++) RAD[NB + ri] = LEG[ri][1];
  var P_MASS = 5, P_INERTIA = 2600;
  var LEG_REST = -0.12, LEG_KICK = 1.95, KICK_REACH = 12;
  var POP_TIME = 0.16, POP_REACH = 6, POP_SIN = Math.sin(1.3), POP_COS = Math.cos(1.3);
  var GETUP_DELAY = 0.3, RISE_TIME = 2;
  var BICYCLE_ANG = 2.0; // about 115°: the head is clearly below the hips
  var BOMB_TIME = 12, BIG_SCALE = 1.4, OUT_TIME = 3;
  // a ball lying still for STILL_TIME seconds with nobody touching it is dropped again in the middle (not the bomb)
  var STILL_TIME = 15, STILL_SPEED = 30;
  // weather / disasters (scheduled by the game, simulated here)
  var TOR_R = 170, TOR_TOP = 300, STUN_TIME = 5, CRATER_TIME = 5, CRATER_R = 80, CRATER_D = 55;

  // ---- sports ----
  var MAPS = [
    { id: 'soccer', name: 'Bóng đá', icon: '⚽', type: 'goal', ball: 'soccer',
      sky: ['#b9ecfb', '#e3f8fe'], ground: '#3f9a3b', ground2: '#48a843', deco: 'grass', crowd: true,
      g: 2000, gBall: 1700, jump: 1000, legSpd: 16, mu: 0.9,
      ballR: 24, ballM: 1, ballE: 0.62, ballDrag: 0.05, ballRoll: 0.7, kickE: 0.8, lift: 0.5,
      goalH: 330, goalD: 165 },
    { id: 'basket', name: 'Bóng rổ', icon: '🏀', type: 'hoop', ball: 'basket',
      sky: ['#c4f3fb', '#e9fcff'], ground: '#9c6a3d', ground2: '#a5734a', deco: 'wood', crowd: true,
      g: 1900, gBall: 1500, jump: 1080, legSpd: 15, mu: 0.95,
      ballR: 28, ballM: 1.1, ballE: 0.78, ballDrag: 0.03, ballRoll: 0.5, kickE: 0.75, lift: 1.0,
      rimH: 300, boardX: 150, rimFront: 320 },
    { id: 'football', name: 'Bóng bầu dục', icon: '🏈', type: 'posts', ball: 'football',
      sky: ['#bdf0fb', '#e6fbff'], ground: '#55c24a', ground2: '#5fcc54', deco: 'yard', crowd: true,
      g: 2000, gBall: 1600, jump: 1000, legSpd: 17, mu: 0.9,
      ballR: 22, ballM: 0.9, ballE: 0.5, ballDrag: 0.06, ballRoll: 1.2, kickE: 0.85, lift: 0.85,
      barH: 175, postX: 125 },
    { id: 'volley', name: 'Bóng chuyền bãi biển', icon: '🏐', type: 'volley', ball: 'volley',
      sky: ['#93def9', '#fff0c4'], ground: '#ecc97d', ground2: '#f2d390', deco: 'sand',
      g: 2000, gBall: 300, jump: 1050, legSpd: 14, mu: 0.8,
      ballR: 30, ballM: 0.6, ballE: 0.7, ballDrag: 0.55, ballRoll: 2.5, kickE: 0.7, lift: 1.0,
      netH: 230, serveY: 45 },
    { id: 'moon', name: 'Bóng đá Mặt Trăng', icon: '🌙', type: 'goal', ball: 'soccer',
      sky: ['#070b24', '#1d2a5c'], ground: '#9ba1ae', ground2: '#8a909d', deco: 'moon', dark: true,
      g: 850, gBall: 650, jump: 690, legSpd: 15, mu: 0.85,
      ballR: 24, ballM: 1, ballE: 0.7, ballDrag: 0.0, ballRoll: 0.4, kickE: 0.8, lift: 0.5,
      goalH: 330, goalD: 165 },
    { id: 'ice', name: 'Sân băng', icon: '🧊', type: 'goal', ball: 'soccer',
      sky: ['#cfe8ff', '#f2f9ff'], ground: '#bfe3f5', ground2: '#a9d6ec', deco: 'ice',
      g: 2000, gBall: 1700, jump: 1000, legSpd: 16, mu: 0.12,
      ballR: 24, ballM: 1, ballE: 0.55, ballDrag: 0.02, ballRoll: 0.05, kickE: 0.8, lift: 0.4,
      goalH: 230, goalD: 130 },
    { id: 'giant', name: 'Bóng khổng lồ', icon: '🎈', type: 'goal', ball: 'beach',
      sky: ['#ffd9ec', '#fff6e8'], ground: '#62b84f', ground2: '#6dc35a', deco: 'grass',
      g: 2000, gBall: 1000, jump: 1050, legSpd: 15, mu: 0.9,
      ballR: 62, ballM: 0.75, ballE: 0.72, ballDrag: 0.15, ballRoll: 0.8, kickE: 0.7, lift: 0.6,
      goalH: 400, goalD: 300 },
    { id: 'bomb', name: 'Bóng bom', icon: '💣', type: 'bomb', ball: 'bomb',
      sky: ['#ffd7c2', '#fff0e3'], ground: '#8d6e4f', ground2: '#977757', deco: 'dirt',
      g: 2000, gBall: 1500, jump: 1050, legSpd: 16, mu: 0.9,
      ballR: 28, ballM: 1.1, ballE: 0.55, ballDrag: 0.05, ballRoll: 0.9, kickE: 0.85, lift: 0.6 }
  ];
  var MAP_BY_ID = {};
  MAPS.forEach(function (m) { MAP_BY_ID[m.id] = m; });

  // random round modifiers
  var MODS = {
    twoBalls: { name: '2 quả bóng', icon: '✌️' },
    giant: { name: 'Người khổng lồ', icon: '🦍' },
    tiny: { name: 'Người tí hon', icon: '🐜' },
    trampoline: { name: 'Sàn bật nhún', icon: '🤸' },
    movingGoal: { name: 'Xà ngang di động', icon: '↕️' },
    bouncy: { name: 'Bóng siêu nảy', icon: '🟣' },
    lowGrav: { name: 'Trọng lực thấp', icon: '🪶' },
    slowmo: { name: 'Quay chậm', icon: '🐢' }
  };
  function modsFor(mapId) {
    var m = MAP_BY_ID[mapId] || MAPS[0], t = m.type, out = ['giant', 'trampoline', 'slowmo'];
    if (t !== 'hoop') out.push('tiny'); // tiny players can't reach the rim
    out.push('bouncy');
    if (t !== 'bomb') out.push('twoBalls');
    if (t === 'goal') out.push('movingGoal');
    if (m.id !== 'moon' && m.id !== 'volley') out.push('lowGrav');
    return out;
  }

  // power-ups that fall from the sky
  var ITEMS = {
    kick: { name: 'Siêu sút', icon: '🔥', dur: 7 },
    shield: { name: 'Khiên chắn', icon: '🛡️', dur: 7 },
    magnet: { name: 'Nam châm', icon: '🧲', dur: 5 },
    freeze: { name: 'Đóng băng', icon: '❄️', dur: 2.5 },
    big: { name: 'Phóng to', icon: '🍄', dur: 7 }
  };
  var ITEM_LIST = ['kick', 'shield', 'magnet', 'freeze', 'big'];
  function itemsFor(type) {
    if (type === 'goal' || type === 'hoop' || type === 'posts') return ITEM_LIST;
    return ['kick', 'magnet', 'freeze', 'big'];
  }

  var DEFAULT_SETTINGS = { jump: 1, gravity: 1, bounce: 1, kick: 1, ballSize: 1, speed: 1,
    jumpDelay: 0.06, tapLen: 0.08, beginner: false, powerups: true, modifiers: true, bombTime: BOMB_TIME };

  function seg(x1, y1, x2, y2, r) { return { x1: x1, y1: y1, x2: x2, y2: y2, r: r }; }
  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }

  function buildArena(mapId, settings, mods) {
    var m = MAP_BY_ID[mapId] || MAPS[0];
    var s = settings || DEFAULT_SETTINGS;
    mods = mods || {};
    var beg = !!s.beginner, gk = mods.lowGrav ? 0.55 : 1;
    var P = {
      g: m.g * num(s.gravity, 1) * gk, gBall: m.gBall * num(s.gravity, 1) * gk,
      jump: m.jump * num(s.jump, 1) * (mods.lowGrav ? 0.8 : 1), legSpd: m.legSpd * num(s.kick, 1), mu: m.mu,
      ballR: m.ballR * num(s.ballSize, 1) * (beg ? 1.2 : 1), ballInvM: 1 / m.ballM,
      ballE: Math.min(0.95, m.ballE * num(s.bounce, 1) * (mods.bouncy ? 1.45 : 1) * (mods.trampoline ? 1.15 : 1)),
      ballDrag: m.ballDrag, ballRoll: m.ballRoll,
      kickE: Math.min(0.98, m.kickE * (0.75 + 0.25 * num(s.kick, 1))),
      liftSin: Math.sin(m.lift), liftCos: Math.cos(m.lift),
      oval: m.ball === 'football',
      jumpDelay: Math.max(0, Math.min(0.15, num(s.jumpDelay, 0.06))),
      floorE: mods.trampoline ? 0.82 : 0,
      pscale: mods.giant ? 1.3 : (mods.tiny ? 0.72 : 1)
    };
    var A = { map: m, type: m.type, P: P, segs: [], mods: mods,
      split: m.type === 'volley' || m.type === 'bomb',
      timeScale: mods.slowmo ? 0.6 : 1, shield: [null, null], wallX: 0,
      bombTime: Math.max(3, Math.min(99, num(s.bombTime, BOMB_TIME))) };
    // power-ups: the ones this sport allows, narrowed to the ones ticked in the match setup
    var il = itemsFor(m.type);
    if (Array.isArray(s.itemList)) il = il.filter(function (k) { return s.itemList.indexOf(k) >= 0; });
    A.itemList = il; A.items = s.powerups !== false && il.length > 0;
    // how far the bot extrapolates the ball's flight: longer when it falls slowly
    A.futureT = Math.min(2.2, Math.max(1.1, 1.1 * Math.sqrt(1600 / P.gBall)));
    var segs = A.segs;
    if (m.type === 'goal') {
      var gh = m.goalH * (beg ? 1.2 : 1);
      // a goal only counts once the whole ball is past the goal line, so the goal is always deeper than
      // the ball is wide (with room to spare), whatever ball size the settings / beginner mode give
      var gd = Math.max(m.goalD, Math.round(2 * P.ballR + 70));
      A.goalH = A.goalH0 = gh; A.goalD = gd; A.moveGoal = !!mods.movingGoal;
      var top = GROUND - gh;
      A.goalTop = top;
      // crossbar slopes down towards the field so the ball never rests on it
      segs.push(seg(0, top - 20, gd, top, 7));
      segs.push(seg(W, top - 20, W - gd, top, 7));
      var sh = GROUND - gh * 1.4;
      A.shield[0] = seg(gd + 16, GROUND, gd + 16, sh, 9);
      A.shield[1] = seg(W - gd - 16, GROUND, W - gd - 16, sh, 9);
    } else if (m.type === 'hoop') {
      var ry = GROUND - m.rimH + (beg ? 40 : 0), rf = m.rimFront + (beg ? 20 : 0);
      A.rimY = ry; A.boardX = m.boardX; A.rimFront = rf;
      [0, 1].forEach(function (side) {
        var mx = side === 0 ? function (x) { return x; } : function (x) { return W - x; };
        segs.push(seg(mx(m.boardX), ry + 50, mx(m.boardX), ry - 160, 7));   // backboard
        segs.push(seg(mx(m.boardX), ry, mx(m.boardX + 12), ry, 5));         // rim joint
        segs.push(seg(mx(rf - 2), ry, mx(rf + 2), ry, 6));                  // front rim
        segs.push(seg(mx(m.boardX - 55), ry + 70, mx(m.boardX), ry + 40, 6)); // arm
        segs.push(seg(mx(m.boardX - 55), ry + 70, mx(m.boardX - 55), GROUND, 7)); // pole
        A.shield[side] = seg(mx(m.boardX + 4), ry - 14, mx(rf + 16), ry - 14, 8); // lid over the hoop
      });
      A.wallX = m.boardX - 55 - 7; // players stop at the back of the pole
    } else if (m.type === 'posts') {
      var by = GROUND - m.barH + (beg ? 40 : 0);
      A.barY = by; A.postX = m.postX;
      A.wallX = m.postX - 7; // players stop at the back of the goal post
      segs.push(seg(m.postX, GROUND, m.postX, by, 7));
      segs.push(seg(W - m.postX, GROUND, W - m.postX, by, 7));
      A.shield[0] = seg(m.postX + 20, by, m.postX + 20, by - 420, 9);
      A.shield[1] = seg(W - m.postX - 20, by, W - m.postX - 20, by - 420, 9);
    } else if (m.type === 'volley') {
      A.netTop = GROUND - m.netH + (beg ? 30 : 0);
      segs.push(seg(W / 2, GROUND, W / 2, A.netTop, 6));
    }
    return A;
  }

  // ---- world ----
  function makePlayer(team, role, id) {
    var p = {
      id: id, team: team, role: role, f: team === 0 ? 1 : -1, active: true,
      x: 0, y: 0, vx: 0, vy: 0, a: 0, w: 0, leg: LEG_REST, legW: 0, ls: 1,
      phase: 0, prev: false, press: false, gT: 1, cT: 1, jumpCd: 0, jumpT: 0, popT: 0, downT: 0, riseT: 0, air: false, slide: 0,
      sc: 1, baseSc: 1, invM: 0, invI: 0, rad: new Float64Array(NS),
      sx: new Float64Array(NS), sy: new Float64Array(NS),
      ex: new Float64Array(NS), ey: new Float64Array(NS)
    };
    setScale(p, 1);
    return p;
  }
  function setScale(p, sc) {
    p.sc = sc;
    for (var j = 0; j < NS; j++) p.rad[j] = RAD[j] * sc;
    var m = P_MASS * sc * sc;
    p.invM = 1 / m; p.invI = 1 / (m * P_INERTIA * sc * sc);
  }

  function makeBall() {
    // outT: how long the ball has been out of play; stillT: how long it has been lying still untouched;
    // touchT: world time of each team's last touch
    return { x: W / 2, y: 200, vx: 0, vy: 0, ang: 0, spin: 0, outT: 0, stillT: 0, lastBy: [-1, -1], touchT: [-1, -1],
      prevX: W / 2, prevY: 200, touchGround: false, lastTeam: -1,
      lastKind: '', lastAng: 0, lastX: 0, lastPid: -1, lastAir: false, lastLeg: 0 };
  }
  function makeItem() { return { on: false, x: 0, y: 0, type: '', life: 0, landed: false }; }
  function makeFx() { return { kick: [0, 0], shield: [0, 0], freeze: [0, 0], big: [0, 0, 0, 0], magnetT: 0, magnetId: -1 }; }
  // hazards: earthquake / tornado timers, lightning craters in the ground, players stunned (burnt) by lightning
  function makeHz() { return { quakeT: 0, quakeDur: 0, torT: 0, torDur: 0, torX0: 0, torX: 0, craters: [], stun: [0, 0, 0, 0] }; }

  function createWorld(mapId, settings, seed, mods) {
    var A = buildArena(mapId, settings, mods);
    var w = {
      time: 0, arena: A, settings: settings || DEFAULT_SETTINGS,
      players: [makePlayer(0, 0, 0), makePlayer(0, 1, 1), makePlayer(1, 0, 2), makePlayer(1, 1, 3)],
      balls: [makeBall()], events: [], seed: (seed >>> 0) || 12345,
      item: makeItem(), fx: makeFx(), hz: makeHz(), itemT: 6, bombT: A.bombTime,
      credit: -1, scoreBall: 0
    };
    if (mods && mods.twoBalls) w.balls.push(makeBall());
    w.ball = w.balls[0];
    for (var i = 0; i < 4; i++) { w.players[i].baseSc = A.P.pscale; setScale(w.players[i], A.P.pscale); }
    resetRound(w, -1);
    return w;
  }

  function rand(w) {
    w.seed = (w.seed * 1664525 + 1013904223) >>> 0;
    return w.seed / 4294967296;
  }

  function placeBall(b, x, y) {
    b.x = b.prevX = x; b.y = b.prevY = y; b.vx = 0; b.vy = 0; b.spin = 0; b.outT = 0; b.stillT = 0;
    b.lastBy[0] = b.lastBy[1] = -1; b.touchT[0] = b.touchT[1] = -1; b.lastTeam = -1; b.lastKind = ''; b.lastPid = -1; b.lastAir = false; b.lastLeg = 0;
    b.touchGround = false;
  }

  function resetRound(w, serveTeam) {
    var A = w.arena, pl = w.players, i, p;
    var pos;
    if (A.type === 'hoop') pos = [300, 640];
    else if (A.type === 'volley') pos = [300, 600];
    else if (A.type === 'bomb') pos = [250, 560];
    else pos = [Math.max(215, (A.goalD || 0) + 55), 560]; // the back player stands just in front of a deep goal
    for (i = 0; i < 4; i++) {
      p = pl[i];
      setScale(p, p.baseSc);
      var x = pos[p.role];
      p.x = p.team === 0 ? x : W - x;
      p.y = GROUND - COM_H * p.sc;
      p.vx = p.vy = 0; p.a = 0; p.w = 0;
      p.leg = LEG_REST; p.legW = 0; p.prev = p.press = false;
      p.gT = p.cT = 0; p.jumpCd = 0; p.jumpT = 0; p.popT = 0; p.downT = 0; p.riseT = 0; p.air = false; p.slide = 0;
      p.phase = (p.role === 0 ? 0 : 1.9) + (p.team === 0 ? 0 : 0.8) + rand(w) * 0.6;
      if (!p.active) { p.x = -2000 - i * 300; p.y = GROUND - COM_H; }
      shapes(p);
    }
    var b0 = w.balls[0];
    if (A.type === 'volley') {
      var sx = serveTeam === 1 ? W - 560 : (serveTeam === 0 ? 560 : (rand(w) < 0.5 ? 560 : W - 560));
      // volleyball-like serves start high so the receiving side has time to react
      placeBall(b0, sx, A.map.serveY || 45);
    } else {
      placeBall(b0, W / 2, A.type === 'bomb' ? 150 : 200);
      b0.vx = (rand(w) - 0.5) * 60;
    }
    if (w.balls.length > 1) {
      var b1 = w.balls[1];
      if (A.type === 'volley') placeBall(b1, W - b0.x, b0.y);
      else { placeBall(b1, W / 2 + 160, 120); b0.x = b0.prevX = W / 2 - 160; }
    }
    w.item.on = false; w.itemT = 5 + rand(w) * 3;
    var fx = w.fx; fx.kick[0] = fx.kick[1] = fx.shield[0] = fx.shield[1] = fx.freeze[0] = fx.freeze[1] = 0;
    fx.big[0] = fx.big[1] = fx.big[2] = fx.big[3] = 0; fx.magnetT = 0; fx.magnetId = -1;
    w.bombT = A.bombTime; w.credit = -1; w.scoreBall = 0;
    var hz = w.hz; hz.quakeT = hz.torT = 0; hz.craters.length = 0; hz.stun[0] = hz.stun[1] = hz.stun[2] = hz.stun[3] = 0;
  }

  function wrap(a) {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  }

  function shapes(p) {
    var ca = Math.cos(p.a), sa = Math.sin(p.a), f = p.f, sc = p.sc, j, lx, ly;
    for (j = 0; j < NB; j++) {
      lx = BODY[j][0] * f * sc; ly = (BODY[j][1] - COM_H) * sc;
      p.sx[j] = p.x + ca * lx + sa * ly;
      p.sy[j] = p.y + sa * lx - ca * ly;
      p.ex[j] = 0; p.ey[j] = 0;
    }
    var hl = (HIP_H - COM_H) * sc;
    var hx = p.x + sa * hl, hy = p.y - ca * hl;
    var sp = Math.sin(p.leg), cp = Math.cos(p.leg);
    var dx = ca * f * sp - sa * cp, dy = sa * f * sp + ca * cp;
    var tx = ca * f * cp + sa * sp, ty = sa * f * cp - ca * sp;
    for (j = 0; j < LEG.length; j++) {
      var s = LEG[j][0] * sc;
      p.sx[NB + j] = hx + dx * s; p.sy[NB + j] = hy + dy * s;
      p.ex[NB + j] = p.legW * s * tx; p.ey[NB + j] = p.legW * s * ty;
    }
  }

  function shiftPlayer(p, dx, dy) {
    p.x += dx; p.y += dy;
    for (var j = 0; j < NS; j++) { p.sx[j] += dx; p.sy[j] += dy; }
  }

  function jump(w, p, P) {
    var jx = Math.sin(p.a), jy = -Math.cos(p.a);
    // jumping while lying down hops straight up and turns the player back onto the feet
    if (jy > -0.55) { jx *= 0.35; jy = -0.95; p.w -= p.a * 3; p.riseT = RISE_TIME; } else p.riseT = 0;
    var J = P.jump * Math.sqrt(p.sc);
    p.vx = p.vx * 0.25 + jx * J * 1.05;
    p.vy = Math.min(p.vy, 0) * 0.25 + jy * J;
    p.w -= p.f * 1.0;
    p.jumpCd = 0.2; p.cT = 1; p.gT = 1; p.popT = POP_TIME;
    if (w.events) w.events.push({ t: 'jump', x: p.x, y: p.y + COM_H * p.sc, team: p.team, id: p.id });
  }

  // ---- weather / disasters ----
  // earthquake strength 0..1 (eases in and out)
  function quakeLevel(hz) {
    if (!(hz.quakeT > 0)) return 0;
    return Math.max(0, Math.min(1, (hz.quakeDur - hz.quakeT) / 0.6, hz.quakeT / 1.0));
  }
  // how strongly the tornado grabs something at (x, y): 0..1
  function torPull(hz, x, y) {
    if (!(hz.torT > 0) || y < TOR_TOP - 260) return 0;
    var d = Math.abs(x - hz.torX), k = d < TOR_R ? 1 : 1 - (d - TOR_R) / (TOR_R * 0.5);
    if (k <= 0) return 0;
    return k * Math.max(0, Math.min(1, (hz.torDur - hz.torT) / 0.7, hz.torT / 0.7));
  }
  // lightning craters lower the ground: out[0] = extra depth below GROUND, out[1] = its slope d(depth)/dx
  function craterDepth(c) { return c.d * Math.min(1, c.t / 1.0); } // fills back up during the last second
  function groundAt(craters, x, out) {
    out[0] = 0; out[1] = 0;
    for (var i = 0; i < craters.length; i++) {
      var c = craters[i], dx = x - c.x;
      if (dx <= -c.r || dx >= c.r) continue;
      var k = craterDepth(c), q = dx / c.r;
      out[0] += k * (1 - q * q); out[1] += -2 * k * q / c.r;
    }
    return out;
  }
  function startQuake(w, dur) { w.hz.quakeT = w.hz.quakeDur = dur; }
  function startTornado(w, x, dur) { var hz = w.hz; hz.torT = hz.torDur = dur; hz.torX0 = hz.torX = x; }
  // a lightning bolt coming down at x hits the highest thing in its path: a ball, a player or the ground
  function strike(w, x) {
    var A = w.arena, hz = w.hz, R = A.P.ballR, top = GROUND, hit = { kind: 'ground', id: -1, x: x, y: GROUND }, i, j;
    for (i = 0; i < w.balls.length; i++) {
      var b = w.balls[i];
      if (Math.abs(b.x - x) < R + 34 && b.y - R < top) { top = b.y - R; hit = { kind: 'ball', id: i, x: b.x, y: top }; }
    }
    for (i = 0; i < 4; i++) {
      var p = w.players[i];
      if (!p.active) continue;
      for (j = 0; j < NS; j++) {
        if (Math.abs(p.sx[j] - x) < p.rad[j] + 30 && p.sy[j] - p.rad[j] < top) { top = p.sy[j] - p.rad[j]; hit = { kind: 'player', id: i, x: p.sx[j], y: top }; }
      }
    }
    if (hit.kind === 'ground') {
      if (hz.craters.length >= 3) hz.craters.shift();
      hz.craters.push({ x: x, r: CRATER_R, d: CRATER_D, t: CRATER_TIME });
    } else if (hit.kind === 'player') {
      var q = w.players[hit.id];
      hz.stun[hit.id] = STUN_TIME;
      q.vy = Math.min(q.vy, 0) - 380; q.w += (rand(w) - 0.5) * 12;
    } else {
      var bb = w.balls[hit.id];
      bb.vy = -650; bb.vx *= 0.3; bb.spin = 30;
    }
    if (w.events) w.events.push({ t: 'strike', kind: hit.kind, id: hit.id, x: hit.x, y: hit.y });
    return hit;
  }

  function control(w, p, press, P, dt) {
    var f = p.f;
    var touching = p.cT < 0.07;
    if (p.jumpCd > 0) p.jumpCd -= dt;
    if (p.popT > 0) p.popT -= dt;
    if (p.riseT > 0) p.riseT -= dt;
    // the leg swings first and the hop follows a moment later, so the foot can
    // sweep a ball lying at the player's feet before the body leaves the ground
    if (press && !p.prev && touching && p.jumpCd <= 0 && p.jumpT <= 0) {
      if (P.jumpDelay > 0) p.jumpT = P.jumpDelay; else jump(w, p, P);
    }
    if (p.jumpT > 0) {
      p.jumpT -= dt;
      if (p.jumpT <= 0 && p.cT < 0.15) jump(w, p, P);
    }
    p.prev = press; p.press = press;
    var tgt = press ? LEG_KICK : LEG_REST;
    var lw = (tgt - p.leg) * 30, ls = P.legSpd;
    if (lw > ls) lw = ls; else if (lw < -ls) lw = -ls;
    p.legW = lw;
    var target = f * 0.07 + 0.2 * Math.sin(w.time * 2.1 + p.phase);
    var qk = quakeLevel(w.hz);
    if (qk > 0) target += qk * 0.45 * Math.sin(w.time * 10 + p.phase * 3); // earthquake: everybody wobbles
    var err = wrap(target - p.a);
    if (p.gT < 0.07 && Math.abs(p.a) < 1.0) {
      // standing: rotate around the planted foot (inverted pendulum), so the feet don't slide
      var dw = (55 * err - 6 * p.w) * dt;
      var rfx = p.sx[0] - p.x, rfy = p.sy[0] + p.rad[0] - p.y;
      p.w += dw; p.vx += dw * rfy; p.vy -= dw * rfx;
      // the planted foot grips the ground; on slippery maps it keeps the speed it landed with
      if (p.air) { p.slide = P.mu < 0.5 ? p.vx : 0; p.air = false; }
      var vfx = p.vx - p.w * rfy - p.slide;
      p.vx -= vfx * Math.min(1, 25 * dt * Math.max(P.mu, 0.6));
      p.slide -= p.slide * 0.9 * dt;
      p.downT = 0;
      if (Math.abs(p.a) < 0.35) p.riseT = 0; // back on the feet (a foot dragging during the hop doesn't count)
    } else if (touching) {
      p.air = true;
      p.w += ((Math.abs(p.a) > 1.1 ? 40 : 55) * err - 6 * p.w) * dt;
      if (Math.abs(p.a) > 0.75) {
        p.downT += dt;
        // lying: if the righting torque lifts the player off the ground, keep steering upright
        if (Math.abs(p.a) > 1.2) p.riseT = RISE_TIME;
        if (p.downT > GETUP_DELAY) {
          // lying (even upside down): hop up, spinning just enough to come down on the feet
          p.vy = -P.jump * 0.6; p.vx *= 0.3;
          p.w = Math.max(-12, Math.min(12, err * 5));
          p.downT = 0; p.cT = p.gT = 1; p.riseT = RISE_TIME;
        }
      } else p.downT = 0;
    } else if (press) {
      p.air = true;
      p.w -= f * 12 * dt; // holding in the air rotates backwards -> bicycle kicks
    } else if (p.riseT > 0) {
      p.air = true;
      p.w += (60 * err - 11 * p.w) * dt; // getting up: settle upright before landing
    } else {
      p.air = true;
      p.w += (9 * err - 1.8 * p.w) * dt;
    }
    if (p.w > 16) p.w = 16; else if (p.w < -16) p.w = -16;
  }

  function hitStatic(p, j, nx, ny, pen, e, mu, vt0) {
    var r = p.rad[j];
    var cx = p.sx[j] - nx * r, cy = p.sy[j] - ny * r;
    var rx = cx - p.x, ry = cy - p.y;
    var vx = p.vx - p.w * ry + p.ex[j], vy = p.vy + p.w * rx + p.ey[j];
    var vn = vx * nx + vy * ny;
    if (vn < 0) {
      var rn = rx * ny - ry * nx;
      var jn = -(1 + e) * vn / (p.invM + rn * rn * p.invI);
      p.vx += jn * nx * p.invM; p.vy += jn * ny * p.invM; p.w += rn * jn * p.invI;
      var tx = -ny, ty = nx;
      vx = p.vx - p.w * ry + p.ex[j]; vy = p.vy + p.w * rx + p.ey[j];
      var vt = vx * tx + vy * ty - vt0;
      var rt = rx * ty - ry * tx;
      var jt = -vt / (p.invM + rt * rt * p.invI);
      var lim = mu * jn;
      if (jt > lim) jt = lim; else if (jt < -lim) jt = -lim;
      p.vx += jt * tx * p.invM; p.vy += jt * ty * p.invM; p.w += rt * jt * p.invI;
    }
    shiftPlayer(p, nx * pen * 0.7, ny * pen * 0.7);
    if (ny < -0.6) { p.cT = 0; if (j === 0 || j === NS - 1) p.gT = 0; }
  }

  function closest(s, px, py, out) {
    var dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    var l2 = dx * dx + dy * dy;
    var t = l2 > 0 ? ((px - s.x1) * dx + (py - s.y1) * dy) / l2 : 0;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    out[0] = s.x1 + dx * t; out[1] = s.y1 + dy * t;
  }
  var tmp2 = [0, 0];

  var near = [];
  var tmpG = [0, 0];
  function playerStatic(A, p, craters) {
    var P = A.P, mu = P.mu, segs = A.segs, j, k, reach = 115 * p.sc;
    for (k = 0; k < segs.length; k++) {
      closest(segs[k], p.x, p.y, tmp2);
      var ddx = p.x - tmp2[0], ddy = p.y - tmp2[1], lim = reach + segs[k].r;
      near[k] = ddx * ddx + ddy * ddy < lim * lim;
    }
    // net games: each side stays in its own half
    var half = A.split ? W / 2 - 8 : -1;
    // trampoline floor: hard landings bounce
    var fe = P.floorE > 0 && p.vy > 250 ? P.floorE : 0;
    for (j = 0; j < NS; j++) {
      var r = p.rad[j], x = p.sx[j], y = p.sy[j];
      if (half > 0) {
        if (p.team === 0 && x + r > half) hitStatic(p, j, -1, 0, x + r - half, 0, 0.3, 0);
        else if (p.team === 1 && x - r < W - half) hitStatic(p, j, 1, 0, W - half - (x - r), 0, 0.3, 0);
        x = p.sx[j]; y = p.sy[j];
      }
      var gy = GROUND, gnx = 0, gny = -1, gk = 1;
      if (craters.length) {
        groundAt(craters, x, tmpG);
        if (tmpG[0] > 0) { gy += tmpG[0]; gk = 1 / Math.sqrt(1 + tmpG[1] * tmpG[1]); gnx = tmpG[1] * gk; gny = -gk; }
      }
      if (y + r > gy) {
        // the planted foot of a standing player grips (relative to its landing slide)
        if (j === 0 && p.a < 1 && p.a > -1) hitStatic(p, j, gnx, gny, (y + r - gy) * gk, fe, mu > 0.9 ? mu : 0.9, -p.slide);
        else hitStatic(p, j, gnx, gny, (y + r - gy) * gk, fe, mu, 0);
      }
      var wl = A.wallX, wr = W - A.wallX;
      if (p.sx[j] - r < wl) hitStatic(p, j, 1, 0, wl - (p.sx[j] - r), 0, 0.3, 0);
      else if (p.sx[j] + r > wr) hitStatic(p, j, -1, 0, p.sx[j] + r - wr, 0, 0.3, 0);
      for (k = 0; k < segs.length; k++) {
        var s = segs[k];
        if (!near[k]) continue;
        closest(s, p.sx[j], p.sy[j], tmp2);
        var dx = p.sx[j] - tmp2[0], dy = p.sy[j] - tmp2[1], rr = r + s.r;
        var d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 1e-9) {
          var d = Math.sqrt(d2);
          hitStatic(p, j, dx / d, dy / d, rr - d, 0, 0.6, 0);
        }
      }
    }
  }

  function playerPlayer(A, B) {
    var dx = B.x - A.x, dy = B.y - A.y, lim = 115 * (A.sc + B.sc);
    if (dx * dx + dy * dy > lim * lim) return;
    for (var i = 0; i < NS; i++) {
      for (var j = 0; j < NS; j++) {
        var nx = B.sx[j] - A.sx[i], ny = B.sy[j] - A.sy[i], rr = A.rad[i] + B.rad[j];
        var d2 = nx * nx + ny * ny;
        if (d2 >= rr * rr || d2 < 1e-9) continue;
        var d = Math.sqrt(d2);
        nx /= d; ny /= d;
        var pen = rr - d;
        var cx = A.sx[i] + nx * A.rad[i], cy = A.sy[i] + ny * A.rad[i];
        var rax = cx - A.x, ray = cy - A.y, rbx = cx - B.x, rby = cy - B.y;
        var vax = A.vx - A.w * ray + A.ex[i], vay = A.vy + A.w * rax + A.ey[i];
        var vbx = B.vx - B.w * rby + B.ex[j], vby = B.vy + B.w * rbx + B.ey[j];
        var vn = (vbx - vax) * nx + (vby - vay) * ny;
        if (vn < 0) {
          var rna = rax * ny - ray * nx, rnb = rbx * ny - rby * nx;
          var jn = -1.2 * vn / (A.invM + B.invM + rna * rna * A.invI + rnb * rnb * B.invI);
          A.vx -= jn * nx * A.invM; A.vy -= jn * ny * A.invM; A.w -= rna * jn * A.invI;
          B.vx += jn * nx * B.invM; B.vy += jn * ny * B.invM; B.w += rnb * jn * B.invI;
        }
        var c = pen * 0.35;
        shiftPlayer(A, -nx * c, -ny * c);
        shiftPlayer(B, nx * c, ny * c);
        if (ny > 0.6) A.cT = 0; else if (ny < -0.6) B.cT = 0;
      }
    }
  }

  // ball vs world; `ev` is an events array or null, `w` (optional) adds power-up shields
  function ballStatic(A, b, ev, first, w) {
    var P = A.P, R = P.ballR;
    var cr = w && w.hz.craters.length ? groundAt(w.hz.craters, b.x, tmpG) : null;
    if (cr && cr[0] > 0) {
      // inside a crater: bounce off (and roll down) its sloping floor
      var gy = GROUND + cr[0], gk = 1 / Math.sqrt(1 + cr[1] * cr[1]), gnx = cr[1] * gk, gny = -gk;
      if (b.y + R > gy) {
        var pen = (b.y + R - gy) * gk;
        b.x += gnx * pen; b.y += gny * pen;
        var vn = b.vx * gnx + b.vy * gny;
        if (vn < 0) {
          if (ev && -vn > 120) ev.push({ t: 'bounce', x: b.x, y: gy, v: -vn });
          var e = -vn > 45 ? P.ballE : 0;
          b.vx -= (1 + e) * vn * gnx; b.vy -= (1 + e) * vn * gny;
        }
        b.touchGround = true;
        if (first) { b.vx -= b.vx * P.ballRoll * DT; if (!P.oval) b.spin = b.vx / R; }
      }
    } else if (b.y + R > GROUND) {
      b.y = GROUND - R;
      if (b.vy > 0) {
        var vin = b.vy;
        if (ev && vin > 120) ev.push({ t: 'bounce', x: b.x, y: GROUND, v: vin });
        b.vy = -vin * P.ballE;
        if (b.vy > -45) b.vy = 0;
        if (P.oval) { b.vx += Math.sin(2 * b.ang) * vin * 0.35; b.spin += Math.cos(2 * b.ang) * vin * 0.02; }
      }
      b.touchGround = true;
      if (first) {
        b.vx -= b.vx * P.ballRoll * DT;
        if (!P.oval) b.spin = b.vx / R;
      }
    }
    if (b.x - R < 0) { b.x = R; if (b.vx < 0) { b.vx = -b.vx * 0.75; if (ev && b.vx > 150) ev.push({ t: 'wall', x: 0, y: b.y, v: b.vx }); } }
    else if (b.x + R > W) { b.x = W - R; if (b.vx > 0) { b.vx = -b.vx * 0.75; if (ev && -b.vx > 150) ev.push({ t: 'wall', x: W, y: b.y, v: -b.vx }); } }
    if (b.y - R < CEIL) { b.y = CEIL + R; if (b.vy < 0) b.vy = -b.vy * 0.6; }
    var segs = A.segs, n = segs.length;
    var s0 = w && w.fx.shield[0] > 0 ? A.shield[0] : null, s1 = w && w.fx.shield[1] > 0 ? A.shield[1] : null;
    for (var k = 0; k < n + 2; k++) {
      var s = k < n ? segs[k] : (k === n ? s0 : s1);
      if (!s) continue;
      closest(s, b.x, b.y, tmp2);
      var dx = b.x - tmp2[0], dy = b.y - tmp2[1], rr = R + s.r;
      var d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 1e-9) {
        var d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
        b.x += nx * (rr - d); b.y += ny * (rr - d);
        var vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          if (ev && vn < -150) ev.push({ t: k < n ? 'post' : 'shield', x: tmp2[0], y: tmp2[1], v: -vn });
          b.vx -= 1.6 * vn * nx; b.vy -= 1.6 * vn * ny;
          var vt = -b.vx * ny + b.vy * nx;
          b.vx -= -ny * vt * 0.08; b.vy -= nx * vt * 0.08;
        }
      }
    }
  }

  // the last touch: who, with what, in which posture (airborne = no contact with the ground or anyone for a moment)
  function touched(w, b, p, kind) {
    b.lastTeam = p.team; b.lastBy[p.team] = p.id; b.lastPid = p.id; b.touchT[p.team] = w.time; b.stillT = 0;
    b.lastKind = kind; b.lastAng = p.a; b.lastX = b.x;
    b.lastAir = p.cT > 0.06 && p.gT > 0.06; b.lastLeg = p.leg;
  }
  // a bicycle kick: the scoring side's player was last to touch the ball, with the raised kicking leg,
  // in the air and upside down (head well below the hips)
  function isBicycle(b, team) {
    return b.lastTeam === team && b.lastKind === 'kick' && b.lastAir && b.lastLeg > 1.0 && Math.abs(b.lastAng) > BICYCLE_ANG;
  }

  function ballPlayer(w, b, bi, p, P) {
    var R = P.ballR;
    var dx = b.x - p.x, dy = b.y - p.y, lim = 125 * p.sc + R;
    if (dx * dx + dy * dy > lim * lim) return;
    var kicking = p.legW > 3, popping = p.popT > 0;
    var boost = w.fx.kick[p.team] > 0 ? 1.55 : 1;
    if (kicking) legKick(w, b, p, P, boost);
    for (var j = 0; j < NS; j++) {
      // a swinging leg (or the feet of a player taking off) gets a slightly bigger reach
      // so balls lying near the feet are caught
      var lower = j < 2 || j >= NB;
      var reach = kicking && j >= NB ? KICK_REACH : (popping && lower ? POP_REACH : 0);
      var nx = b.x - p.sx[j], ny = b.y - p.sy[j], rr = R + p.rad[j] + reach;
      var d2 = nx * nx + ny * ny;
      if (d2 >= rr * rr || d2 < 1e-9) continue;
      var d = Math.sqrt(d2);
      nx /= d; ny /= d;
      var pen = rr - reach - d;
      var cx = p.sx[j] + nx * p.rad[j], cy = p.sy[j] + ny * p.rad[j];
      var rx = cx - p.x, ry = cy - p.y;
      var vpx = p.vx - p.w * ry + p.ex[j], vpy = p.vy + p.w * rx + p.ey[j];
      var rvx = b.vx - vpx, rvy = b.vy - vpy;
      // a swinging leg scoops the ball: it always leaves at least at the map's kick angle,
      // so a ball lying dead on the ground can still be lofted towards a hoop or posts
      var kx = nx, ky = ny;
      if (j >= NB && kicking && ny > -P.liftSin) { kx = p.f * P.liftCos; ky = -P.liftSin; }
      else if (popping && lower) {
        // taking off with the ball at the feet flicks it up: forward at the kick angle,
        // or almost straight up when it lies behind the player
        if (nx * p.f >= 0) { if (ny > -P.liftSin) { kx = p.f * P.liftCos; ky = -P.liftSin; } }
        else if (ny > -POP_SIN) { kx = -p.f * POP_COS; ky = -POP_SIN; }
      }
      var vn = rvx * kx + rvy * ky;
      if (vn < 0) {
        nx = kx; ny = ky;
        var rn = rx * ny - ry * nx;
        var e = j >= NB ? P.kickE : (j === HEAD ? 0.55 : 0.4);
        var jn = -(1 + e) * vn / (P.ballInvM + p.invM + rn * rn * p.invI);
        if (j >= NB) jn *= boost;
        b.vx += jn * nx * P.ballInvM; b.vy += jn * ny * P.ballInvM;
        p.vx -= jn * nx * p.invM * 0.6; p.vy -= jn * ny * p.invM * 0.6; p.w -= rn * jn * p.invI * 0.6;
        var vt = -rvx * ny + rvy * nx;
        b.spin += vt / R * 0.3;
        touched(w, b, p, j >= NB ? 'kick' : (j === HEAD ? 'head' : 'body'));
        if (w.events && jn > 250) w.events.push({ t: j >= NB ? 'kick' : (j === HEAD ? 'head' : 'body'), x: cx, y: cy, v: jn, team: p.team, id: p.id, boost: boost > 1 });
      }
      if (pen > 0) {
        var sx = b.x - p.sx[j], sy = b.y - p.sy[j];
        sx /= d; sy /= d;
        b.x += sx * pen * 0.8; b.y += sy * pen * 0.8;
        shiftPlayer(p, -sx * pen * 0.2, -sy * pen * 0.2);
      }
    }
  }

  // The swinging leg is checked as a whole capsule (hip -> foot) so a ball anywhere along
  // the sweep gets kicked, and it always leaves at least at the map's kick angle.
  function legKick(w, b, p, P, boost) {
    var R = P.ballR, hl = (HIP_H - COM_H) * p.sc;
    var hx = p.x + Math.sin(p.a) * hl, hy = p.y - Math.cos(p.a) * hl;
    var fx = p.sx[NS - 1], fy = p.sy[NS - 1];
    var dx = fx - hx, dy = fy - hy, l2 = dx * dx + dy * dy;
    var t = ((b.x - hx) * dx + (b.y - hy) * dy) / l2;
    if (t < 0.25) return; // the thigh next to the hip doesn't kick
    if (t > 1) t = 1;
    var cx = hx + dx * t, cy = hy + dy * t;
    var nx = b.x - cx, ny = b.y - cy, d = Math.sqrt(nx * nx + ny * ny);
    var rr = R + p.rad[NS - 1] + KICK_REACH;
    if (d >= rr || d < 1e-6) return;
    nx /= d; ny /= d;
    if (ny > -P.liftSin) { nx = p.f * P.liftCos; ny = -P.liftSin; }
    // contact velocity: body motion + leg swing at that point of the leg
    var rx = cx - p.x, ry = cy - p.y, s = t * LEG[LEG.length - 1][0] * p.sc;
    var ca = Math.cos(p.a), sa = Math.sin(p.a), sp = Math.sin(p.leg), cp = Math.cos(p.leg), f = p.f;
    var tx = ca * f * cp + sa * sp, ty = sa * f * cp - ca * sp;
    var vpx = p.vx - p.w * ry + p.legW * s * tx, vpy = p.vy + p.w * rx + p.legW * s * ty;
    var vn = (b.vx - vpx) * nx + (b.vy - vpy) * ny;
    if (vn >= 0) return;
    var rn = rx * ny - ry * nx;
    var jn = -(1 + P.kickE) * vn / (P.ballInvM + p.invM + rn * rn * p.invI) * boost;
    b.vx += jn * nx * P.ballInvM; b.vy += jn * ny * P.ballInvM;
    p.vx -= jn * nx * p.invM * 0.6; p.vy -= jn * ny * p.invM * 0.6; p.w -= rn * jn * p.invI * 0.6;
    b.spin += p.f * 8;
    touched(w, b, p, 'kick');
    if (w.events && jn > 250) w.events.push({ t: 'kick', x: cx, y: cy, v: jn, team: p.team, id: p.id, boost: boost > 1 });
  }

  function ballBall(a, b, R) {
    var dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy, rr = 2 * R;
    if (d2 >= rr * rr || d2 < 1e-9) return;
    var d = Math.sqrt(d2), nx = dx / d, ny = dy / d, pen = rr - d;
    a.x -= nx * pen / 2; a.y -= ny * pen / 2; b.x += nx * pen / 2; b.y += ny * pen / 2;
    var vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (vn < 0) { var j = -0.9 * vn; a.vx -= j * nx; a.vy -= j * ny; b.vx += j * nx; b.vy += j * ny; }
  }

  // returns the team a ball scores for this step, or -1 (goal / hoop / posts / net games)
  function checkScore(A, b) {
    var R = A.P.ballR;
    switch (A.type) {
      case 'goal':
        // the whole ball has to be over the goal line (the goal mouth), under the crossbar
        if (b.y > A.goalTop + 4) {
          if (b.x + R < A.goalD) return 1;
          if (b.x - R > W - A.goalD) return 0;
        }
        return -1;
      case 'hoop':
        if (b.prevY < A.rimY && b.y >= A.rimY && b.vy > 0) {
          if (b.x > A.boardX && b.x < A.rimFront) return 1;
          if (b.x < W - A.boardX && b.x > W - A.rimFront) return 0;
        }
        return -1;
      case 'posts':
        if (b.y < A.barY - 4) {
          if (b.prevX >= A.postX && b.x < A.postX) return 1;
          if (b.prevX <= W - A.postX && b.x > W - A.postX) return 0;
        }
        return -1;
      case 'volley':
        if (b.touchGround) return b.x < W / 2 ? 1 : 0;
        return -1;
    }
    return -1;
  }

  // ---- power-ups ----
  function spawnItem(w) {
    var A = w.arena, it = w.item, list = A.itemList;
    it.on = true; it.landed = false; it.life = 6;
    it.type = list[Math.floor(rand(w) * list.length)];
    if (A.split) it.x = (rand(w) < 0.5 ? 220 : W / 2 + 120) + rand(w) * (W / 2 - 340);
    else it.x = 260 + rand(w) * (W - 520);
    it.y = -40;
    if (w.events) w.events.push({ t: 'item', type: it.type, x: it.x, y: it.y });
  }
  function applyItem(w, p, type) {
    var fx = w.fx, dur = ITEMS[type].dur;
    if (type === 'kick') fx.kick[p.team] = dur;
    else if (type === 'shield') fx.shield[p.team] = dur;
    else if (type === 'magnet') { fx.magnetT = dur; fx.magnetId = p.id; }
    else if (type === 'freeze') fx.freeze[1 - p.team] = dur;
    else if (type === 'big') fx.big[p.id] = dur;
    if (w.events) w.events.push({ t: 'pickup', type: type, id: p.id, team: p.team, x: w.item.x, y: w.item.y });
  }
  function updateItems(w, dt) {
    var A = w.arena, fx = w.fx, pl = w.players, i;
    for (i = 0; i < 2; i++) {
      if (fx.kick[i] > 0) fx.kick[i] -= dt;
      if (fx.shield[i] > 0) fx.shield[i] -= dt;
      if (fx.freeze[i] > 0) fx.freeze[i] -= dt;
    }
    if (fx.magnetT > 0) fx.magnetT -= dt;
    for (i = 0; i < 4; i++) {
      var p = pl[i];
      if (fx.big[i] > 0) fx.big[i] -= dt;
      var target = fx.big[i] > 0 ? p.baseSc * BIG_SCALE : p.baseSc;
      if (Math.abs(p.sc - target) > 1e-3) {
        var ns = p.sc + Math.max(-1.5 * dt, Math.min(1.5 * dt, target - p.sc));
        p.y -= COM_H * (ns - p.sc); // grow upwards, not into the floor
        setScale(p, ns);
      }
    }
    if (!A.items) return;
    var it = w.item;
    if (!it.on) {
      w.itemT -= dt;
      if (w.itemT <= 0) spawnItem(w);
      return;
    }
    if (!it.landed) {
      it.y += 150 * dt;
      var floor = GROUND - 26;
      if (it.y >= floor) { it.y = floor; it.landed = true; }
    } else {
      it.life -= dt;
      if (it.life <= 0) { it.on = false; w.itemT = 7 + rand(w) * 5; return; }
    }
    for (i = 0; i < 4; i++) {
      var q = pl[i];
      if (!q.active) continue;
      var ddx = q.x - it.x, ddy = q.y - it.y;
      if (ddx * ddx + ddy * ddy > 200 * 200) continue;
      for (var j = 0; j < NS; j++) {
        var ex = q.sx[j] - it.x, ey = q.sy[j] - it.y, rr = q.rad[j] + 28;
        if (ex * ex + ey * ey < rr * rr) {
          applyItem(w, q, it.type);
          it.on = false; w.itemT = 8 + rand(w) * 5;
          return;
        }
      }
    }
  }

  // one button per team: both players of a team follow the same input
  var teamPress = [false, false, false, false];
  function step(w, press0, press1, iters) {
    teamPress[0] = teamPress[1] = !!press0;
    teamPress[2] = teamPress[3] = !!press1;
    return stepPlayers(w, teamPress, iters);
  }

  // one button per player (4-player modes); presses[i] drives w.players[i]
  function stepPlayers(w, presses, iters) {
    var A = w.arena, P = A.P, dt = DT, pl = w.players, fx = w.fx, i, j, p, b, bi, nIt = iters || ITERS;
    var balls = w.balls, nb = balls.length, hz = w.hz;
    w.time += dt;
    if (hz.quakeT > 0) hz.quakeT -= dt;
    if (hz.torT > 0) { hz.torT -= dt; hz.torX = hz.torX0 + 90 * Math.sin((hz.torDur - hz.torT) * 1.1); }
    for (i = hz.craters.length - 1; i >= 0; i--) { hz.craters[i].t -= dt; if (hz.craters[i].t <= 0) hz.craters.splice(i, 1); }
    var qk = quakeLevel(hz);
    if (A.moveGoal) {
      // the crossbars ride up and down
      var top = GROUND - A.goalH0 * (0.78 + 0.32 * Math.sin(w.time * 1.1));
      A.goalTop = top;
      A.segs[0].y1 = A.segs[1].y1 = top - 20; A.segs[0].y2 = A.segs[1].y2 = top;
    }
    for (i = 0; i < 4; i++) {
      p = pl[i];
      if (!p.active) continue;
      if (hz.stun[i] > 0) hz.stun[i] -= dt;
      var frozen = fx.freeze[p.team] > 0 || hz.stun[i] > 0;
      control(w, p, frozen ? false : presses[i], P, dt);
      if (frozen) p.w *= 1 - 4 * dt;
      p.vy += P.g * dt;
      p.vx -= p.vx * 0.12 * dt;
      if (qk > 0 && p.cT < 0.1) p.vx += qk * 3500 * Math.sin(w.time * 31 + i * 1.7) * dt;
      var tp = torPull(hz, p.x, p.y);
      if (tp > 0) {
        // tornado: lifted to about TOR_TOP, swung around its axis and spun
        p.vy += ((p.y > TOR_TOP ? -900 : 300) - P.g - 3 * p.vy) * tp * dt;
        p.vx += (-16 * (p.x - hz.torX) - 0.4 * p.vx + 500 * Math.sin(w.time * 5 + i)) * tp * dt;
        p.w += (9 - p.w) * 2 * tp * dt;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.a = wrap(p.a + p.w * dt);
      p.leg += p.legW * dt;
      p.gT += dt; p.cT += dt;
    }
    for (bi = 0; bi < nb; bi++) {
      b = balls[bi];
      b.prevX = b.x; b.prevY = b.y;
      b.vy += P.gBall * dt;
      if (bi === 0 && fx.magnetT > 0 && fx.magnetId >= 0) {
        // magnet: the ball is pulled towards the player who picked it up
        var mp = pl[fx.magnetId], mx = mp.x - b.x, my = mp.y - 40 * mp.sc - b.y, md = Math.sqrt(mx * mx + my * my);
        if (md > 50) { b.vx += mx / md * 1500 * dt; b.vy += my / md * 1500 * dt; }
      }
      var tb = torPull(hz, b.x, b.y);
      if (tb > 0) {
        b.vy += ((b.y > TOR_TOP ? -900 : 300) - P.gBall - 3 * b.vy) * tb * dt;
        b.vx += (-16 * (b.x - hz.torX) - 0.4 * b.vx + 600 * Math.sin(w.time * 5 + 2 + bi)) * tb * dt;
        b.spin += 20 * tb * dt;
      }
      var drag = 1 - P.ballDrag * dt;
      b.vx *= drag; b.vy *= drag;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.ang += b.spin * dt;
      b.touchGround = false;
    }
    for (var it = 0; it < nIt; it++) {
      for (i = 0; i < 4; i++) if (pl[i].active) { shapes(pl[i]); playerStatic(A, pl[i], hz.craters); }
      for (i = 0; i < 4; i++) {
        if (!pl[i].active) continue;
        for (j = i + 1; j < 4; j++) if (pl[j].active) playerPlayer(pl[i], pl[j]);
      }
      for (bi = 0; bi < nb; bi++) {
        b = balls[bi];
        ballStatic(A, b, it === 0 ? w.events : null, it === 0, w);
        for (i = 0; i < 4; i++) if (pl[i].active) ballPlayer(w, b, bi, pl[i], P);
      }
      if (nb > 1) ballBall(balls[0], balls[1], P.ballR);
    }
    for (bi = 0; bi < nb; bi++) {
      b = balls[bi];
      var sp2 = b.vx * b.vx + b.vy * b.vy;
      if (sp2 > BALL_MAX * BALL_MAX) { var k = BALL_MAX / Math.sqrt(sp2); b.vx *= k; b.vy *= k; }
      if (b.spin > 40) b.spin = 40; else if (b.spin < -40) b.spin = -40;
      if (qk > 0 && b.touchGround && rand(w) < qk * 0.03) b.vy -= 120 + 220 * rand(w); // the shaking ground makes the ball hop
      if (outOfPlay(A, b)) b.outT += dt; else b.outT = 0;
      if (A.type !== 'bomb' && b.vx * b.vx + b.vy * b.vy < STILL_SPEED * STILL_SPEED) b.stillT += dt; else b.stillT = 0;
      if (b.outT > OUT_TIME || b.stillT > STILL_TIME || !(Math.abs(b.x) < 1e6 && Math.abs(b.y) < 1e6)) {
        var rx = W / 2 + (nb > 1 ? (bi === 0 ? -160 : 160) : 0);
        placeBall(b, rx, 150);
        if (w.events) w.events.push({ t: 'respawn', x: rx, y: 150 });
      }
    }
    for (i = 0; i < 4; i++) {
      p = pl[i];
      if (p.active && !(Math.abs(p.x) < 1e6 && Math.abs(p.y) < 1e6 && Math.abs(p.a) < 10)) {
        p.x = p.team === 0 ? 300 : W - 300; p.y = GROUND - COM_H * p.sc; p.vx = p.vy = p.w = 0; p.a = 0;
      }
    }
    updateItems(w, dt);
    return scoreCheck(w);
  }

  // the ball is out of play on top of a goal, behind a backboard or behind a goal post (e.g. stuck behind a
  // basketball pole); anywhere else, including half over the goal line, only lying still untouched for STILL_TIME
  // seconds brings it back to the middle
  function outOfPlay(A, b) {
    var edge;
    if (A.type === 'goal') return (b.x < A.goalD || b.x > W - A.goalD) && b.y < A.goalTop;
    if (A.type === 'hoop') edge = A.boardX;
    else if (A.type === 'posts') edge = A.postX;
    else return false;
    return b.x < edge || b.x > W - edge;
  }
  // who scores this step (team or -1); also fills w.credit (player id or -1) and w.scoreBall
  function scoreCheck(w) {
    var A = w.arena, i, b;
    if (A.type === 'bomb') {
      w.bombT -= DT;
      if (w.bombT <= 0) {
        b = w.balls[0];
        var team = b.x < W / 2 ? 1 : 0;
        w.scoreBall = 0; w.credit = b.lastBy[team];
        if (w.events) w.events.push({ t: 'explode', x: b.x, y: b.y });
        return team;
      }
      return -1;
    }
    for (i = 0; i < w.balls.length; i++) {
      b = w.balls[i];
      var s = checkScore(A, b);
      if (s >= 0) { w.scoreBall = i; w.credit = b.lastBy[s]; return s; }
    }
    return -1;
  }

  // ---- cloning for look-ahead ----
  function copyPlayer(d, s) {
    d.x = s.x; d.y = s.y; d.vx = s.vx; d.vy = s.vy; d.a = s.a; d.w = s.w;
    d.leg = s.leg; d.legW = s.legW; d.phase = s.phase; d.prev = s.prev; d.press = s.press;
    d.gT = s.gT; d.cT = s.cT; d.jumpCd = s.jumpCd; d.jumpT = s.jumpT; d.popT = s.popT; d.downT = s.downT; d.riseT = s.riseT; d.air = s.air; d.slide = s.slide;
    d.active = s.active; d.role = s.role; d.baseSc = s.baseSc;
    if (d.sc !== s.sc) setScale(d, s.sc);
  }
  function copyBall(a, b) {
    a.x = b.x; a.y = b.y; a.vx = b.vx; a.vy = b.vy; a.ang = b.ang; a.spin = b.spin; a.outT = b.outT; a.stillT = b.stillT;
    a.lastBy[0] = b.lastBy[0]; a.lastBy[1] = b.lastBy[1]; a.touchT[0] = b.touchT[0]; a.touchT[1] = b.touchT[1];
    a.prevX = b.prevX; a.prevY = b.prevY; a.touchGround = b.touchGround; a.lastTeam = b.lastTeam;
    a.lastKind = b.lastKind; a.lastAng = b.lastAng; a.lastX = b.lastX; a.lastPid = b.lastPid; a.lastAir = b.lastAir; a.lastLeg = b.lastLeg;
  }
  function copyWorld(d, s) {
    d.time = s.time; d.arena = s.arena; d.settings = s.settings; d.seed = s.seed;
    for (var i = 0; i < 4; i++) copyPlayer(d.players[i], s.players[i]);
    while (d.balls.length < s.balls.length) d.balls.push(makeBall());
    d.balls.length = s.balls.length;
    for (i = 0; i < s.balls.length; i++) copyBall(d.balls[i], s.balls[i]);
    d.ball = d.balls[0];
    var a = d.item, c = s.item;
    a.on = c.on; a.x = c.x; a.y = c.y; a.type = c.type; a.life = c.life; a.landed = c.landed;
    var f = d.fx, g = s.fx;
    f.kick[0] = g.kick[0]; f.kick[1] = g.kick[1]; f.shield[0] = g.shield[0]; f.shield[1] = g.shield[1];
    f.freeze[0] = g.freeze[0]; f.freeze[1] = g.freeze[1]; f.magnetT = g.magnetT; f.magnetId = g.magnetId;
    for (i = 0; i < 4; i++) f.big[i] = g.big[i];
    d.itemT = s.itemT; d.bombT = s.bombT;
    var h = d.hz, k = s.hz;
    h.quakeT = k.quakeT; h.quakeDur = k.quakeDur; h.torT = k.torT; h.torDur = k.torDur; h.torX0 = k.torX0; h.torX = k.torX;
    for (i = 0; i < 4; i++) h.stun[i] = k.stun[i];
    h.craters.length = 0;
    for (i = 0; i < k.craters.length; i++) { var c0 = k.craters[i]; h.craters.push({ x: c0.x, r: c0.r, d: c0.d, t: c0.t }); }
    d.credit = -1; d.scoreBall = 0;
    return d;
  }
  function emptyWorld() {
    var w = { time: 0, arena: null, settings: null, seed: 1,
      players: [makePlayer(0, 0, 0), makePlayer(0, 1, 1), makePlayer(1, 0, 2), makePlayer(1, 1, 3)],
      balls: [makeBall()], events: null, item: makeItem(), fx: makeFx(), hz: makeHz(), itemT: 0, bombT: 0,
      credit: -1, scoreBall: 0 };
    w.ball = w.balls[0];
    return w;
  }

  // Ball-only flight prediction (ignores players). Returns {team, t} of the first score or null.
  var fb = makeBall();
  function ballFuture(A, b, seconds) {
    if (A.type === 'bomb') return null;
    fb.x = b.x; fb.y = b.y; fb.vx = b.vx; fb.vy = b.vy; fb.ang = b.ang; fb.spin = b.spin;
    var P = A.P, n = Math.round(seconds / DT), drag;
    for (var k = 0; k < n; k++) {
      fb.prevX = fb.x; fb.prevY = fb.y;
      fb.vy += P.gBall * DT;
      drag = 1 - P.ballDrag * DT;
      fb.vx *= drag; fb.vy *= drag;
      fb.x += fb.vx * DT; fb.y += fb.vy * DT;
      fb.ang += fb.spin * DT;
      fb.touchGround = false;
      ballStatic(A, fb, null, true, null);
      var sc = checkScore(A, fb);
      if (sc >= 0) return { team: sc, t: k * DT, x: fb.x, y: fb.y };
      if (fb.touchGround && Math.abs(fb.vy) < 1 && Math.abs(fb.vx) < 20) break;
    }
    return null;
  }

  // ---- bot ----
  // candidates: [delay, duration] of a button press relative to now; [-1, 0] = don't press
  var LEVELS = {
    easy: { period: 0.3, horizon: 0.45, mistake: 0.45, oppModels: 1, iters: 2,
      cands: [[-1, 0], [0, 0.15], [0, 0.4], [0.2, 0.2]] },
    normal: { period: 0.12, horizon: 0.7, mistake: 0.15, oppModels: 1, iters: 2,
      cands: [[-1, 0], [0, 0.08], [0, 0.2], [0, 0.45], [0.15, 0.2], [0.3, 0.25]] },
    hard: { period: 0.067, horizon: 0.9, mistake: 0, oppModels: 2, iters: 2,
      cands: [[-1, 0], [0, 0.06], [0, 0.15], [0, 0.3], [0, 0.6], [0.1, 0.2], [0.25, 0.25]] },
    // same as hard with a single opponent model: used automatically on slow devices
    hardLite: { period: 0.067, horizon: 0.9, mistake: 0, oppModels: 1, iters: 2,
      cands: [[-1, 0], [0, 0.06], [0, 0.15], [0, 0.3], [0, 0.6], [0.1, 0.2], [0.25, 0.25]] }
  };

  var NO_PRESS = [-1, 0];
  function pressAt(c, t) { return c[0] >= 0 && t >= c[0] && t < c[0] + c[1]; }
  function clamp1(v) { return v > 1 ? 1 : (v < -1 ? -1 : v); }

  function mapPotential(sim, b, team) {
    var A = sim.arena, d = team === 0 ? 1 : -1;
    var xr = d * (b.x - W / 2) / (W / 2);
    var vr = clamp1(d * b.vx / 1500);
    var hgt = (GROUND - b.y) / 450; if (hgt < 0) hgt = 0; else if (hgt > 1.2) hgt = 1.2;
    switch (A.type) {
      case 'hoop': {
        var hx = team === 0 ? W - (A.boardX + A.rimFront) / 2 : (A.boardX + A.rimFront) / 2;
        var near = 1 - Math.abs(b.x - hx) / 800; if (near < 0) near = 0;
        return 0.55 * xr + 0.2 * vr + 0.55 * hgt * near;
      }
      case 'posts':
        return 0.75 * xr + 0.3 * vr + (xr > 0.3 ? 0.35 * hgt * (vr > 0 ? 1 : 0.4) : 0);
      case 'volley': {
        var side = xr > 0 ? 1 : -1;
        var low = (b.y - (GROUND - 320)) / 320; if (low < 0) low = 0; else if (low > 1) low = 1;
        return 0.45 * side + 0.2 * vr + (side < 0 ? -0.6 * low * (b.vy > 0 ? 1 : 0.5) : 0.4 * low);
      }
      case 'bomb': {
        // the closer the fuse is to the end, the more it matters which side the bomb is on
        var urg = 1 + 2 * (1 - Math.min(1, sim.bombT / A.bombTime));
        return (0.5 * (xr > 0 ? 1 : -1) + 0.4 * xr + 0.25 * vr) * urg;
      }
      default:
        return 0.8 * xr + 0.3 * vr;
    }
  }

  function evaluate(sim, team, slot) {
    var A = sim.arena, pl = sim.players, d = team === 0 ? 1 : -1, v = 0, i, p;
    var b = sim.balls[0];
    for (var bi = 0; bi < sim.balls.length; bi++) {
      var bb = sim.balls[bi], k = bi === 0 ? 1 : 0.6;
      v += k * 400 * mapPotential(sim, bb, team);
      var fut = ballFuture(A, bb, A.futureT);
      if (fut) {
        if (fut.team === team) v += k * 2600 * (1 - 0.35 * fut.t);
        else v -= k * 3200 * (1 - 0.35 * fut.t);
      }
    }
    // in 4-player solo mode a bot also wants to be the one who touched the ball last
    if (slot >= 0 && b.lastBy[team] === slot) v += 40;
    var myBest = 1e9, opBest = 1e9;
    for (i = 0; i < 4; i++) {
      p = pl[i];
      if (!p.active) continue;
      var dist = Math.abs(p.x - b.x) + 0.5 * Math.abs(p.y - b.y);
      if (p.team === team) {
        v += 18 * Math.cos(p.a);
        if (d * (b.x - p.x) > 0) v += 28;
        if (dist < myBest && (slot < 0 || p.id === slot)) myBest = dist;
      } else if (dist < opBest) opBest = dist;
    }
    var adv = (opBest - myBest) * 0.1;
    if (adv > 50) adv = 50; else if (adv < -50) adv = -50;
    return v + adv;
  }

  // The bot plans by simulating the real physics ahead for a handful of button
  // press patterns and picking the best outcome. Planning is spread over several
  // physics steps (from a state predicted for the moment the plan takes effect)
  // so a single frame never has to run every rollout.
  // slot < 0: the bot presses for its whole team; otherwise it drives one player.
  function Bot(team, level, seed, slot) {
    this.team = team;
    this.slot = slot === undefined ? -1 : slot;
    this.extraMistake = 0;
    this.setLevel(level);
    this.sim = emptyWorld();
    this.base = emptyWorld();
    this.seed = (seed >>> 0) || 777;
    this.press = [false, false, false, false];
    this.prevs = [false, false, false, false];
    this.reset();
  }
  Bot.prototype.setLevel = function (level) {
    this.level = LEVELS[level] ? level : 'hard';
    this.cfg = LEVELS[this.level];
    this.job = null;
  };
  Bot.prototype.rand = function () {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  };
  Bot.prototype.reset = function () { this.plan = NO_PRESS; this.planT = 0; this.job = null; };
  Bot.prototype.mine = function (i) { return this.slot < 0 ? this.base.players[i].team === this.team : i === this.slot; };
  // inputs for every player at time t of a rollout
  Bot.prototype.inputs = function (cand, t, oppModel) {
    var pr = this.press, pl = this.base.players;
    for (var i = 0; i < 4; i++) {
      if (this.mine(i)) pr[i] = pressAt(cand, t);
      else if (pl[i].team === this.team) pr[i] = t < 0.1 && this.prevs[i];
      else pr[i] = oppModel === 0 ? (t < 0.1 && this.prevs[i]) : (t >= 0.12 && t < 0.35);
    }
    return pr;
  };
  Bot.prototype.rollout = function (cand, oppModel) {
    var sim = copyWorld(this.sim, this.base);
    var team = this.team, n = Math.round(this.cfg.horizon / DT);
    for (var k = 0; k < n; k++) {
      var sc = stepPlayers(sim, this.inputs(cand, k * DT, oppModel), this.cfg.iters);
      if (sc >= 0) {
        var bonus = this.slot >= 0 && sc === team && sim.credit === this.slot ? 300 : 0;
        return sc === team ? 9000 - k * 6 + bonus : -10000 + k * 6;
      }
    }
    return evaluate(sim, team, this.slot);
  };
  Bot.prototype.startJob = function (world) {
    var cfg = this.cfg, i;
    var K = Math.max(1, Math.round(cfg.period / DT));
    var base = copyWorld(this.base, world);
    for (i = 0; i < 4; i++) this.prevs[i] = world.players[i].prev;
    // predict the state at the moment the new plan will take over
    var pr = this.press;
    for (var k = 0; k < K; k++) {
      var me = pressAt(this.plan, base.time - this.planT);
      for (i = 0; i < 4; i++) pr[i] = this.mine(i) ? me : this.prevs[i];
      if (stepPlayers(base, pr) >= 0) break;
    }
    var total = cfg.cands.length * cfg.oppModels;
    this.job = { applyAt: world.time + K * DT, i: 0, total: total, per: Math.ceil(total / K),
      vals: new Array(cfg.cands.length), best: -1e18, bestC: cfg.cands[0] };
  };
  Bot.prototype.work = function () {
    var cfg = this.cfg, job = this.job, nm = cfg.oppModels;
    var ci = Math.floor(job.i / nm), om = job.i % nm, c = cfg.cands[ci];
    var v = this.rollout(c, om);
    if (om === 0) job.vals[ci] = v;
    else { var v0 = job.vals[ci]; v = 0.6 * Math.min(v0, v) + 0.4 * (v0 + v) / 2; }
    job.i++;
    if (om === nm - 1) {
      if (c[0] >= 0) v -= 4; // tiny cost for pressing: don't waste jumps
      if (v > job.best) { job.best = v; job.bestC = c; }
    }
  };
  Bot.prototype.update = function (world) {
    if (!this.job) this.startJob(world);
    var job = this.job;
    for (var n = 0; n < job.per && job.i < job.total; n++) this.work();
    if (world.time >= job.applyAt - 1e-9) {
      while (job.i < job.total) this.work();
      var c = job.bestC, mistake = this.cfg.mistake + this.extraMistake;
      if (mistake > 0 && this.rand() < mistake) c = this.cfg.cands[Math.floor(this.rand() * this.cfg.cands.length)];
      this.plan = c; this.planT = job.applyAt; this.lastValue = job.best;
      this.job = null;
    }
    return pressAt(this.plan, world.time - this.planT);
  };

  return {
    W: W, H: H, GROUND: GROUND, DT: DT, COM_H: COM_H, HIP_H: HIP_H, SHOULDER_H: SHOULDER_H,
    BODY: BODY, LEG: LEG, NB: NB, NS: NS, RAD: RAD, LEG_REST: LEG_REST, LEG_KICK: LEG_KICK, BOMB_TIME: BOMB_TIME,
    MAPS: MAPS, MAP_BY_ID: MAP_BY_ID, DEFAULT_SETTINGS: DEFAULT_SETTINGS, LEVELS: LEVELS,
    MODS: MODS, modsFor: modsFor, ITEMS: ITEMS, itemsFor: itemsFor,
    TOR_R: TOR_R, TOR_TOP: TOR_TOP, STUN_TIME: STUN_TIME, CRATER_TIME: CRATER_TIME, STILL_TIME: STILL_TIME, OUT_TIME: OUT_TIME,
    startQuake: startQuake, startTornado: startTornado, strike: strike, quakeLevel: quakeLevel, torPull: torPull,
    groundAt: groundAt, craterDepth: craterDepth, isBicycle: isBicycle,
    buildArena: buildArena, createWorld: createWorld, resetRound: resetRound, step: step, stepPlayers: stepPlayers,
    shapes: shapes, setScale: setScale, copyWorld: copyWorld, emptyWorld: emptyWorld, ballFuture: ballFuture,
    Bot: Bot
  };
});
