// "XE ĐẠP CHỔNG NGƯỢC" only for real bicycle kicks
const E = require('../www/engine.js');
function scene(o) {
  const w = E.createWorld('soccer', null, 3, {}); w.events = null;
  for (const p of w.players) p.active = false;
  const p = w.players[1]; p.active = true;
  if (o.opp) w.players[2].active = true;
  E.resetRound(w, 0);
  p.x = 800; p.y = o.y; p.a = o.a; p.w = o.w || 0; p.vx = p.vy = 0; p.leg = o.leg; p.legW = 0; p.prev = true;
  p.cT = p.gT = o.air ? 1 : 0;
  E.shapes(p);
  const fx = p.sx[E.NS - 1], fy = p.sy[E.NS - 1], R = w.arena.P.ballR;
  const b = w.ball; b.x = b.prevX = fx + o.bdx; b.y = b.prevY = fy + o.bdy; b.vx = o.bvx || 0; b.vy = o.bvy || 0;
  if (o.opp) { const q = w.players[2]; q.x = 2000; q.y = 300; E.shapes(q); }
  let first = null;
  for (let i = 0; i < 120 && !first; i++) {
    E.stepPlayers(w, [0, o.press ? 1 : 0, 0, 0]);
    if (b.lastPid === 1) first = { kind: b.lastKind, air: b.lastAir, ang: b.lastAng.toFixed(2), leg: b.lastLeg.toFixed(2) };
    if (o.ground) { p.cT = p.gT = 0; }
  }
  if (o.opp) {
    // an opponent gets in the way of the shot and the ball comes off him
    const q = w.players[2]; q.x = b.x + b.vx * 0.05; q.y = b.y + b.vy * 0.05 + 40; q.vx = q.vy = 0; E.shapes(q);
    for (let i = 0; i < 60 && b.lastTeam !== 1; i++) E.stepPlayers(w, [0, 0, 0, 0]);
  }
  return { first, bicycle: E.isBicycle(b, 0), lastTeam: b.lastTeam };
}
const cases = [
  ['real bicycle: in the air, upside down, kicking leg up', { y: 470, a: 2.7, w: -6, leg: 1.95, air: true, press: true, bdx: 30, bdy: -10, bvx: -200, bvy: 200 }, true],
  ['upside down in the air but leg down (body/leg brushes ball)', { y: 470, a: 2.7, leg: -0.12, air: true, bdx: 25, bdy: 0, bvx: -300 }, false],
  ['lying on the ground, foot brushes the ball', { y: E.GROUND - 30, a: 1.75, leg: 1.95, air: false, ground: true, bdx: 26, bdy: -8, bvx: -300 }, false],
  ['upside down on the ground (fallen), leg up', { y: E.GROUND - 60, a: 2.6, leg: 1.95, air: false, ground: true, bdx: 26, bdy: -8, bvx: -300 }, false],
  ['normal kick, upright', { y: E.GROUND - 95, a: 0.05, leg: 1.4, air: false, press: true, bdx: 25, bdy: 0, bvx: -200 }, false],
  ['real bicycle but an opponent touches the ball after', { y: 470, a: 2.7, w: -6, leg: 1.95, air: true, press: true, bdx: 30, bdy: -10, bvx: -200, bvy: 200, opp: true }, false]
];
let bad = 0;
for (const [name, o, want] of cases) {
  const r = scene(o);
  const ok = r.bicycle === want; if (!ok) bad++;
  console.log((ok ? 'ok  ' : 'FAIL') + ' ' + name.padEnd(60), 'bicycle=' + r.bicycle, JSON.stringify(r.first), 'lastTeam', r.lastTeam);
}
// real games between bots: how often the old rule (only |angle| > 1.9 at the last touch) fired and the new one does
let goals = 0, oldHits = 0, newHits = 0; const oldOnly = [];
for (let g = 0; g < 6; g++) {
  const w = E.createWorld('soccer', null, 50 + g, {}); w.events = null;
  const a = new E.Bot(0, 'hard', g + 1), c = new E.Bot(1, 'hard', g + 9);
  for (let i = 0; i < 120 * 120; i++) {
    const s = E.step(w, a.update(w), c.update(w));
    if (s >= 0) {
      const b = w.balls[w.scoreBall]; goals++;
      const o = b.lastKind === 'kick' && Math.abs(b.lastAng) > 1.9, n = E.isBicycle(b, s);
      if (o) oldHits++; if (n) newHits++;
      if (o && !n) oldOnly.push({ air: b.lastAir, ang: +b.lastAng.toFixed(2), leg: +b.lastLeg.toFixed(2), sameTeam: b.lastTeam === s });
      E.resetRound(w, 1 - s);
    }
  }
}
console.log(`bot games: ${goals} goals, old rule said bicycle ${oldHits} times, new rule ${newHits}`);
console.log('old-rule-only postures (not bicycles):', JSON.stringify(oldOnly.slice(0, 8)));
console.log(bad ? bad + ' FAILED' : 'all scenario checks passed');
