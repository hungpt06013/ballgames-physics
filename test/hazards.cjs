// physics checks for the weather / disaster hazards
const E = require('../www/engine.js');
const bad = w => w.players.some(p => !isFinite(p.x) || !isFinite(p.y) || !isFinite(p.a)) || w.balls.some(b => !isFinite(b.x) || !isFinite(b.y));
function run(w, secs, fn, presses) { for (let i = 0; i < secs * 120; i++) { E.stepPlayers(w, presses ? presses(i) : [0, 0, 0, 0]); if (fn) fn(i); if (bad(w)) throw new Error('NaN'); } }
// tornado lifts what is inside and drops it afterwards
{
  const w = E.createWorld('soccer', null, 3, {}); w.events = null;
  w.ball.x = w.ball.prevX = 520; w.ball.y = w.ball.prevY = E.GROUND - 24; w.ball.vx = w.ball.vy = 0;
  E.startTornado(w, 500, 6);
  let maxUp = [0, 0, 0, 0], ballTop = 9e9, spin = 0;
  run(w, 6, () => { w.players.forEach((p, i) => { maxUp[i] = Math.max(maxUp[i], E.GROUND - p.y); }); ballTop = Math.min(ballTop, w.ball.y); spin = Math.max(spin, Math.abs(w.players[1].w)); });
  console.log('tornado@500: player lift (px)', maxUp.map(v => v | 0).join(','), '| ball highest y', ballTop | 0, '| max spin', spin.toFixed(1));
  run(w, 3);
  console.log('3 s after: players y', w.players.map(p => p.y | 0).join(','), 'ball y', w.ball.y | 0, 'standing', w.players.map(p => Math.abs(p.a) < 0.5 && p.gT < 0.1).join(','));
}
// lightning: ground -> crater, ball rolls into it; player -> stunned 5 s
{
  const w = E.createWorld('soccer', null, 3, {}); w.events = [];
  const hit = E.strike(w, 500);
  console.log('strike at 500 hits', hit.kind, 'craters', w.hz.craters.length);
  w.ball.x = w.ball.prevX = 430; w.ball.y = w.ball.prevY = E.GROUND - 24; w.ball.vx = 120; w.ball.vy = 0;
  let lowest = 0; run(w, 2, () => { lowest = Math.max(lowest, w.ball.y); w.events.length = 0; });
  console.log('ball rolled into crater: lowest y', lowest | 0, '(ground', E.GROUND - 24, ') now x', w.ball.x | 0);
  run(w, 3.5, () => { w.events.length = 0; });
  console.log('after 5.5 s craters', w.hz.craters.length, 'ball y', w.ball.y | 0);
  const p = w.players[1]; const h2 = E.strike(w, p.x);
  let jumped = false; const y0 = p.y;
  run(w, 4, () => { if (p.y < y0 - 120) jumped = true; w.events.length = 0; }, i => [0, i % 30 < 5, 0, 0]);
  console.log('strike on player', h2.kind, h2.id, 'stun left', w.hz.stun[1].toFixed(2), 'jumped while stunned:', jumped);
  run(w, 1.5, () => { w.events.length = 0; }, i => [0, i % 30 < 5, 0, 0]);
  console.log('after stun ends: jumped', w.players[1].y < E.GROUND - 200 || w.players[1].vy < -100 || w.players[1].cT > 0.1);
  const ballHit = (() => { const b = w.ball; b.x = b.prevX = 1200; b.y = b.prevY = 400; b.vx = b.vy = 0; return E.strike(w, 1200); })();
  console.log('strike on ball', ballHit.kind, ballHit.id, 'ball vy', w.ball.vy | 0);
}
// earthquake: players wobble but stay on their feet and can still play
{
  const w = E.createWorld('soccer', null, 3, {}); w.events = null;
  E.startQuake(w, 10);
  let amax = 0, falls = 0, hops = 0; let prevVy = 0;
  run(w, 10, i => { amax = Math.max(amax, ...w.players.map(p => Math.abs(p.a))); if (w.ball.vy < -100 && prevVy >= -100 && w.ball.y > E.GROUND - 40) hops++; prevVy = w.ball.vy; });
  console.log('quake 10 s: max lean', amax.toFixed(2), 'rad, ball hops', hops, 'quake level after', E.quakeLevel(w.hz));
}
// bots with every hazard on
{
  const w = E.createWorld('basket', null, 9, {}); w.events = [];
  const a = new E.Bot(0, 'hard', 1), b = new E.Bot(1, 'hard', 2); let goals = 0;
  for (let i = 0; i < 120 * 40; i++) {
    if (i % 1200 === 0) E.startTornado(w, 300 + (i / 1200) * 300, 6);
    if (i % 1500 === 600) E.startQuake(w, 8);
    if (i % 700 === 300) E.strike(w, 200 + (i * 37) % 1200);
    const s = E.step(w, a.update(w), b.update(w)); w.events.length = 0;
    if (bad(w)) throw new Error('NaN with bots');
    if (s >= 0) { goals++; E.resetRound(w, 1 - s); }
  }
  console.log('bots 40 s with hazards: goals', goals, 'ok');
}
