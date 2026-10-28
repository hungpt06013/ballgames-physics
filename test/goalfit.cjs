// Every goal map, every ball size the settings allow (0.7–1.6), with and without beginner mode and with each
// round modifier: (a) a ball resting fully inside the goal scores, (b) a ball rolled at the goal goes in,
// (c) hard bots playing each other actually score.
const E = require('../www/engine.js');
const maps = E.MAPS.filter(m => m.type === 'goal').map(m => m.id);
const sizes = [0.7, 1, 1.3, 1.6], mods = ['', 'movingGoal', 'bouncy', 'lowGrav', 'giant', 'tiny', 'trampoline', 'twoBalls'];
let fails = 0, checks = 0;
function world(id, size, beg, mod, seed) {
  const s = Object.assign({}, E.DEFAULT_SETTINGS, { ballSize: size, beginner: beg });
  const m = {}; if (mod) m[mod] = true;
  const w = E.createWorld(id, s, seed || 7, m); w.events = null;
  return w;
}
function rollIn(id, size, beg, mod, side, startT) {
  const w = world(id, size, beg, mod);
  for (const p of w.players) p.active = false;
  E.resetRound(w, 0); w.time = startT;
  const A = w.arena, R = A.P.ballR;
  w.balls.forEach((b, i) => { b.x = b.prevX = side === 0 ? A.goalD + R + 160 + i * 400 : E.W - A.goalD - R - 160 - i * 400; b.y = b.prevY = E.GROUND - R; b.vx = side === 0 ? -750 : 750; b.vy = 0; });
  for (let i = 0; i < 120 * 5; i++) { const s = E.stepPlayers(w, [0, 0, 0, 0]); if (s >= 0) return s; }
  return -1;
}
const rows = [];
for (const id of maps) for (const beg of [false, true]) for (const size of sizes) {
  const A = E.buildArena(id, Object.assign({}, E.DEFAULT_SETTINGS, { ballSize: size, beginner: beg }), {});
  const R = A.P.ballR;
  // (a) resting inside, both sides
  for (const side of [0, 1]) {
    const w = world(id, size, beg, ''); for (const p of w.players) p.active = false; E.resetRound(w, 0);
    const b = w.ball; b.x = b.prevX = side === 0 ? R + 2 : E.W - R - 2; b.y = b.prevY = E.GROUND - R; b.vx = b.vy = 0;
    const s = E.stepPlayers(w, [0, 0, 0, 0]); checks++;
    if (s !== 1 - side) { fails++; console.log('FAIL resting', id, size, beg, side, s); }
  }
  // (b) rolled in, every modifier; the moving crossbar is tried at several moments
  const res = [];
  for (const mod of mods) {
    let ok = true;
    for (const side of [0, 1]) {
      const tries = mod === 'movingGoal' ? [0, 1.5, 3, 4.5] : [0];
      const got = tries.map(t => rollIn(id, size, beg, mod, side, t));
      checks++;
      if (!got.includes(1 - side)) { ok = false; fails++; console.log('FAIL roll', id, 'size', size, 'beginner', beg, mod || 'none', 'side', side, got); }
    }
    res.push(ok ? '.' : 'X');
  }
  rows.push(`${id.padEnd(6)} size ${size.toFixed(1)} beg ${beg ? 'Y' : 'N'}  ballR ${R.toFixed(0).padStart(3)}  goal ${A.goalD}x${A.goalH | 0}  roll-in per modifier ${res.join('')}`);
}
console.log(rows.join('\n'));
// (c) hard bots score with the biggest ball
for (const id of ['giant', 'soccer']) for (const beg of [false, true]) {
  const w = world(id, 1.6, beg, '', 11); const a = new E.Bot(0, 'hard', 1), b = new E.Bot(1, 'hard', 2); let goals = 0, t = 0;
  for (; t < 120 * 90; t++) { const s = E.step(w, a.update(w), b.update(w)); if (s >= 0) { goals++; E.resetRound(w, 1 - s); } }
  console.log(`bots 90 s on ${id}, ball x1.6, beginner ${beg ? 'on' : 'off'}: ${goals} goals`);
}
console.log(`checks ${checks}, failures ${fails}`);
