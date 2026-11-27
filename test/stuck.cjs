// Two players caught together get apart quickly and smoothly: legs hooked (both holding the button face to face),
// pinned against a wall / goal post, one lying on top of the other, standing inside each other.
// node test/stuck.cjs [engine path]
const E = require(process.argv[2] || '../www/engine.js');
const NS = E.NS;
let fails = 0;
const check = (name, ok, info) => { if (!ok) fails++; console.log((ok ? 'ok   ' : 'FAIL ') + name + (info !== undefined ? '  ' + info : '')); };
function overlap(A, B) { let w = -Infinity; for (let i = 0; i < NS; i++) for (let j = 0; j < NS; j++) { const p = A.rad[i] + B.rad[j] - Math.hypot(A.sx[i] - B.sx[j], A.sy[i] - B.sy[j]); if (p > w) w = p; } return w; }
// set up two players (ia, ib), run `sec` seconds with presses(t) -> [a, b]; returns the longest run of overlapping
// visibly (more than 3 px) and the biggest step of a body beyond its own speed (after the first 0.1 s, in which a
// player set up inside a wall is put back)
function run(map, ia, ib, place, presses, sec, mods) {
  const w = E.createWorld(map, null, 5, mods || {}); w.events = null;
  const A = w.players[ia], B = w.players[ib];
  w.players.forEach((p, i) => { if (i !== ia && i !== ib) { p.active = false; p.x = -5000 - i * 500; } });
  place(w, A, B); E.shapes(A); E.shapes(B);
  let runT = 0, longest = 0, jump = 0;
  for (let s = 0; s < Math.round(sec / E.DT); s++) {
    const t = s * E.DT, pr = [false, false, false, false], pp = presses(t); pr[ia] = pp[0]; pr[ib] = pp[1];
    const b4 = [A, B].map(p => [p.x, p.y]);
    E.stepPlayers(w, pr);
    w.balls.forEach(b => { b.x = b.prevX = E.W / 2; b.y = b.prevY = -900; b.vx = b.vy = 0; });
    if (t > 0.1) [A, B].forEach((p, k) => { jump = Math.max(jump, Math.hypot(p.x - b4[k][0] - p.vx * E.DT, p.y - b4[k][1] - p.vy * E.DT)); });
    runT = overlap(A, B) > 3 ? runT + E.DT : 0; longest = Math.max(longest, runT);
  }
  return { longest, jump };
}
const stand = (p, x) => { p.x = x; p.y = E.GROUND - E.COM_H * p.sc; p.vx = p.vy = p.w = p.a = 0; };
const cases = [];
// 1. face to face, both holding the button (raised legs across each other), now and then let go and pressed again
for (const map of ['soccer', 'moon', 'ice']) for (const gap of [40, 60, 80]) for (const pair of [[0, 2], [1, 3]])
  cases.push(['legs hooked, ' + map + ' gap ' + gap, map, pair, (w, A, B) => { stand(A, 800 - gap / 2); stand(B, 800 + gap / 2); },
    t => [t > 0.1 && (t % 1.6) < 1.3, t > 0.15 && ((t + 0.4) % 1.7) < 1.4], 6]);
// 2. pinned against the wall / the goal / the backboard by an opponent jumping at him again and again
for (const map of ['soccer', 'basket', 'bomb', 'football']) for (const pair of [[2, 0], [3, 1]])
  cases.push(['pinned at the side, ' + map, map, pair, (w, A, B) => { const x0 = w.arena.wallX + (w.arena.goalD || w.arena.boardX || 0) + 40; stand(A, x0); stand(B, x0 + 70); },
    t => [(t % 0.9) < 0.12, ((t + 0.3) % 0.7) < 0.15], 6]);
// 3. one lying on top of the other (team-mates and opponents)
for (const map of ['soccer', 'moon']) for (const pair of [[0, 1], [0, 2]]) for (const dx of [0, 15])
  cases.push(['lying on top, ' + map + (pair[1] === 1 ? ' mates' : ' opps') + ' dx ' + dx, map, pair, (w, A, B) => {
    stand(A, 800); stand(B, 800 + dx); B.a = 1.5; B.y = E.GROUND - 150; }, t => [false, false], 4]);
// 4. started inside each other (e.g. after both grew with the mushroom)
for (const map of ['soccer', 'giant']) for (const pair of [[0, 1], [0, 2]])
  cases.push(['inside each other, ' + map + (pair[1] === 1 ? ' mates' : ' opps'), map, pair, (w, A, B) => { stand(A, 800); stand(B, 815); }, t => [false, false], 4]);
// 5. giants (bigger bodies) bumping into each other
for (const pair of [[0, 2], [0, 1]])
  cases.push(['giants, ' + (pair[1] === 1 ? 'mates' : 'opps'), 'soccer', pair, (w, A, B) => { stand(A, 760); stand(B, 860); },
    t => [(t % 0.8) < 0.3, ((t + 0.25) % 0.9) < 0.3], 6, { giant: true }]);
const groups = {};
for (const c of cases) {
  const r = run(c[1], c[2][0], c[2][1], c[3], c[4], c[5], c[6]), g = c[0].split(',')[0];
  const o = groups[g] || (groups[g] = { longest: 0, at: '', jump: 0 });
  if (r.longest > o.longest) { o.longest = r.longest; o.at = c[0]; }
  o.jump = Math.max(o.jump, r.jump);
}
for (const g in groups) {
  const o = groups[g];
  check(g + ': apart within 1 s', o.longest < 1, 'longest overlap ' + o.longest.toFixed(2) + ' s (' + o.at + ')');
  check(g + ': no visible jumps while getting apart', o.jump < 15, 'biggest step ' + o.jump.toFixed(1) + ' px');
}
console.log(fails ? fails + ' FAILED' : 'all checks passed');
