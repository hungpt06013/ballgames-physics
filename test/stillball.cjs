// a ball lying still and untouched for 15 s is dropped again in the middle (not the bomb)
const E = require('../www/engine.js');
let fails = 0;
const check = (name, ok, info) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info ? '  ' + info : '')); };
function world(map) {
  const w = E.createWorld(map, null, 7, {});
  w.players.forEach(p => { p.active = false; p.x = -3000; });
  const b = w.ball;
  b.x = b.prevX = 500; b.y = b.prevY = E.GROUND - w.arena.P.ballR; b.vx = b.vy = 0; b.spin = 0;
  return w;
}
function run(w, sec, each) {
  const pr = [false, false, false, false], ev = [];
  for (let i = 0; i < Math.round(sec / E.DT); i++) {
    if (each) each(w, i * E.DT);
    E.stepPlayers(w, pr);
    w.events.forEach(e => { if (e.t === 'respawn') ev.push(+(w.time).toFixed(2)); });
    w.events.length = 0;
  }
  return ev;
}
let w = world('soccer');
let ev = run(w, 14.5);
check('still for 14.5 s: stays', ev.length === 0 && Math.abs(w.ball.x - 500) < 2, 'x ' + w.ball.x.toFixed(0));
ev = run(w, 1);
check('still for 15 s: dropped again in the middle', ev.length === 1 && Math.abs(w.ball.x - E.W / 2) < 30, 'respawn at t=' + ev + ' x ' + w.ball.x.toFixed(0));

w = world('soccer');
ev = run(w, 18, (w, t) => { if (Math.abs(t - 10) < E.DT / 2) w.ball.vx = 300; }); // nudged at 10 s, rolls, stops again
check('nudged at 10 s: counting starts again once it stops', ev.length === 0, 'stillT ' + w.ball.stillT.toFixed(1) + ' x ' + w.ball.x.toFixed(0));
ev = run(w, 12);
check('...and it is dropped 15 s after it stopped', ev.length === 1, 'respawn at t=' + ev);

w = world('bomb'); w.bombT = 1000;
ev = run(w, 30);
check('bomb: never dropped again for lying still', ev.length === 0, 'x ' + w.ball.x.toFixed(0));

// a real touch (a kick at 14 s) starts the count again
w = E.createWorld('soccer', null, 3, {});
w.players.forEach((p, i) => { if (i) { p.active = false; p.x = -3000; } });
const p0 = w.players[0];
w.ball.x = w.ball.prevX = p0.x + 70; w.ball.y = w.ball.prevY = E.GROUND - w.arena.P.ballR; w.ball.vx = w.ball.vy = 0;
const pr = [false, false, false, false], resp = [];
let kickedAt = -1;
for (let i = 0; i < Math.round(25 / E.DT); i++) {
  const t = i * E.DT;
  pr[0] = t > 14 && t < 14.25; // press the button at 14 s
  const before = w.ball.touchT[0];
  E.stepPlayers(w, pr);
  if (kickedAt < 0 && w.ball.touchT[0] > 13.9 && w.ball.touchT[0] !== before) kickedAt = +w.time.toFixed(2);
  w.events.forEach(e => { if (e.t === 'respawn') resp.push(+w.time.toFixed(2)); });
  w.events.length = 0;
}
check('kicked at 14 s: not dropped at 15 s (count restarts from the touch)', kickedAt > 0 && !resp.some(t => t < kickedAt + 14), 'kicked at ' + kickedAt + ', re-drops at ' + JSON.stringify(resp));
console.log(fails ? fails + ' FAILED' : 'all checks passed');
