/* Ballgames Physics – progression data: player profiles, coins & shop, stats. */
(function () {
  'use strict';
  function load(k, d) { try { var v = localStorage.getItem('bgp_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem('bgp_' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }

  // shirt colours a player (or the bot) can pick: 16, no two alike - every pair at least 26 apart in CIEDE2000
  // (about 20 is already 'clearly different'); the first 10 keep their places (saved profiles keep their colour), red
  // and blue are the classic sides. In a match nobody wears the same colour as anyone else (game.js: personColors).
  var COLORS = [
    { main: '#ef5b5b', dark: '#c63e44', name: 'Đỏ' }, { main: '#f29a3f', dark: '#c87923', name: 'Cam' },
    { main: '#3fb4ea', dark: '#2387bd', name: 'Xanh dương' }, { main: '#6ade5f', dark: '#4ab843', name: 'Xanh lá' },
    { main: '#8b70f4', dark: '#6651c9', name: 'Tím' }, { main: '#ffa9e7', dark: '#d688c1', name: 'Hồng' },
    { main: '#fee526', dark: '#d6c100', name: 'Vàng' }, { main: '#009f8b', dark: '#007c6a', name: 'Ngọc' },
    { main: '#2b2b2b', dark: '#3c3c3c', name: 'Đen' }, { main: '#ffffff', dark: '#dadada', name: 'Trắng' },
    { main: '#3222a1', dark: '#4c35b7', name: 'Xanh đậm' }, { main: '#8a5123', dark: '#653408', name: 'Nâu' },
    { main: '#910042', dark: '#690026', name: 'Đỏ đô' }, { main: '#8d8a15', dark: '#6a6900', name: 'Xanh rêu' },
    { main: '#8a888c', dark: '#69676b', name: 'Xám' }, { main: '#13631f', dark: '#004303', name: 'Xanh lá đậm' }
  ];

  var SHOP = {
    hat: [
      { id: 'none', name: 'Không đội', price: 0, icon: '🚫' },
      { id: 'cap', name: 'Mũ lưỡi trai', price: 50, icon: '🧢' },
      { id: 'party', name: 'Mũ tiệc', price: 80, icon: '🥳' },
      { id: 'headphones', name: 'Tai nghe', price: 100, icon: '🎧' },
      { id: 'chef', name: 'Mũ đầu bếp', price: 120, icon: '🧑‍🍳' },
      { id: 'cowboy', name: 'Mũ cao bồi', price: 150, icon: '🤠' },
      { id: 'santa', name: 'Mũ Noel', price: 150, icon: '🎅' },
      { id: 'viking', name: 'Mũ Viking', price: 200, icon: '🪓' },
      { id: 'halo', name: 'Vòng thiên thần', price: 250, icon: '😇' },
      { id: 'crown', name: 'Vương miện', price: 300, icon: '👑' },
      { id: 'beanie', name: 'Mũ len', price: 60, icon: '🧶' },
      { id: 'helmet', name: 'Mũ bảo hiểm', price: 90, icon: '⛑️' },
      { id: 'bunny', name: 'Tai thỏ', price: 110, icon: '🐰' },
      { id: 'wizard', name: 'Mũ phù thủy', price: 160, icon: '🧙' },
      { id: 'pirate', name: 'Mũ hải tặc', price: 180, icon: '🏴‍☠️' },
      { id: 'grad', name: 'Mũ tốt nghiệp', price: 200, icon: '🎓' },
      { id: 'horns', name: 'Sừng quỷ', price: 220, icon: '😈' },
      { id: 'tophat', name: 'Mũ ảo thuật', price: 260, icon: '🎩' }
    ],
    hair: [
      { id: 'default', name: 'Tóc ngắn', price: 0, icon: '💇' },
      { id: 'bald', name: 'Đầu trọc', price: 40, icon: '🥚' },
      { id: 'long', name: 'Tóc dài', price: 60, icon: '👱' },
      { id: 'afro', name: 'Tóc xù', price: 60, icon: '🦁' },
      { id: 'spiky', name: 'Tóc dựng', price: 70, icon: '⚡' },
      { id: 'pony', name: 'Tóc buộc', price: 70, icon: '🎀' },
      { id: 'mohawk', name: 'Tóc mào gà', price: 80, icon: '🐓' },
      { id: 'curly', name: 'Tóc xoăn', price: 70, icon: '🌀' },
      { id: 'pigtails', name: 'Tóc hai bím', price: 80, icon: '👧' },
      { id: 'bangs', name: 'Tóc mái dài', price: 80, icon: '💁' },
      { id: 'bun', name: 'Tóc búi', price: 90, icon: '🍡' },
      { id: 'rainbow', name: 'Tóc 7 màu', price: 150, icon: '🌈' }
    ],
    shirt: [
      { id: 'plain', name: 'Áo trơn', price: 0, icon: '👕' },
      { id: 'number', name: 'Áo có số', price: 40, icon: '🔢' },
      { id: 'stripes', name: 'Sọc dọc', price: 60, icon: '🦓' },
      { id: 'hoops', name: 'Sọc ngang', price: 60, icon: '🐝' },
      { id: 'stars', name: 'Áo ngôi sao', price: 120, icon: '⭐' },
      { id: 'flame', name: 'Áo lửa', price: 150, icon: '🔥' },
      { id: 'checker', name: 'Áo caro', price: 80, icon: '🏁' },
      { id: 'cow', name: 'Áo bò sữa', price: 90, icon: '🐄' },
      { id: 'heart', name: 'Áo trái tim', price: 100, icon: '❤️' },
      { id: 'bolt', name: 'Áo sấm sét', price: 130, icon: '🌩️' },
      { id: 'galaxy', name: 'Áo thiên hà', price: 180, icon: '🌌' },
      { id: 'diamond', name: 'Áo kim cương', price: 250, icon: '💎' }
    ],
    ball: [
      { id: 'classic', name: 'Bóng cổ điển', price: 0, icon: '⚽' },
      { id: 'smiley', name: 'Mặt cười', price: 80, icon: '😀' },
      { id: 'watermelon', name: 'Dưa hấu', price: 100, icon: '🍉' },
      { id: 'rainbow', name: 'Cầu vồng', price: 120, icon: '🌈' },
      { id: 'fire', name: 'Bóng lửa', price: 150, icon: '☄️' },
      { id: 'planet', name: 'Hành tinh', price: 200, icon: '🪐' },
      { id: 'gold', name: 'Bóng vàng', price: 400, icon: '🥇' },
      { id: 'tennis', name: 'Bóng tennis', price: 80, icon: '🎾' },
      { id: 'orange', name: 'Quả cam', price: 100, icon: '🍊' },
      { id: 'eight', name: 'Bi-a số 8', price: 120, icon: '🎱' },
      { id: 'donut', name: 'Bánh donut', price: 130, icon: '🍩' },
      { id: 'snow', name: 'Bóng tuyết', price: 140, icon: '❄️' },
      { id: 'eye', name: 'Con mắt', price: 160, icon: '👁️' },
      { id: 'disco', name: 'Bóng disco', price: 250, icon: '🪩' }
    ]
  };
  Object.keys(SHOP).forEach(function (k) { var free = SHOP[k][0]; SHOP[k] = [free].concat(SHOP[k].slice(1).sort(function (a, b) { return a.price - b.price; })); });
  var SHOP_TABS = [{ id: 'hat', name: 'Mũ' }, { id: 'hair', name: 'Tóc' }, { id: 'shirt', name: 'Áo' }, { id: 'ball', name: 'Bóng' }];

  // (P1 red and P2 blue, the classic sides; P3 green, P4 orange)
  var DEFAULT_COLOR = [0, 2, 3, 1];
  function defaultProfile(i) { return { name: 'P' + (i + 1), color: DEFAULT_COLOR[i], hat: 'none', hair: 'default', shirt: 'plain' }; }
  // what the bots wear (every bot; a bot whose colour someone else already wears gets another one)
  function defaultBot() { return { color: 2, hat: 'none', hair: 'default', shirt: 'number' }; }
  function defaultStats() {
    return { played: 0, byMode: {}, botWins: { easy: 0, normal: 0, hard: 0 }, botLosses: { easy: 0, normal: 0, hard: 0 }, botDraws: { easy: 0, normal: 0, hard: 0 },
      goals: 0, goalsBySport: {}, fastest: 0, streak: 0, bestStreak: 0, coinsEarned: 0 };
  }

  var D = load('meta', null) || {};
  D.coins = D.coins || 0;
  D.owned = D.owned || {};
  SHOP_TABS.forEach(function (t) { D.owned[t.id] = D.owned[t.id] || {}; D.owned[t.id][SHOP[t.id][0].id] = 1; });
  D.profiles = D.profiles || [];
  // profiles saved before v4.1 that still have the old colours (P1 red, P2 orange, P3 blue, P4 green, never changed)
  // get the new ones, so P2 keeps the blue he always wore with 2 players
  if (!D.colorsV && D.profiles.length === 4 && D.profiles.every(function (p, k) { return p && p.color === k; })) D.profiles.forEach(function (p, k) { p.color = DEFAULT_COLOR[k]; });
  D.colorsV = 2;
  for (var i = 0; i < 4; i++) D.profiles[i] = Object.assign(defaultProfile(i), D.profiles[i] || {});
  D.bot = Object.assign(defaultBot(), D.bot || {});
  if (!(D.bot.color >= 0 && D.bot.color < COLORS.length)) D.bot.color = 2;
  D.profiles.forEach(function (p, k) { if (!(p.color >= 0 && p.color < COLORS.length)) p.color = DEFAULT_COLOR[k]; });
  D.ball = D.ball || 'classic';
  D.stats = Object.assign(defaultStats(), D.stats || {});
  // data of removed features (challenges, tournament) from older versions
  delete D.stars; delete D.best; delete D.tourney; delete D.stats.cups;

  function persist() { save('meta', D); }

  function find(cat, id) {
    var list = SHOP[cat] || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  window.BGMeta = {
    D: D, COLORS: COLORS, SHOP: SHOP, SHOP_TABS: SHOP_TABS,
    save: persist, load: load, store: save, find: find,
    coins: function () { return D.coins; },
    addCoins: function (n) { if (n > 0) { D.coins += n; D.stats.coinsEarned += n; persist(); } return D.coins; },
    owns: function (cat, id) { return !!(D.owned[cat] && D.owned[cat][id]); },
    buy: function (cat, id) {
      var it = find(cat, id);
      if (!it || this.owns(cat, id) || D.coins < it.price) return false;
      D.coins -= it.price; D.owned[cat][id] = 1; persist(); return true;
    },
    // slot: 0-3 (a player) or 'bot'
    equip: function (cat, id, slot) {
      if (!this.owns(cat, id)) return false;
      if (cat === 'ball') D.ball = id; else this.profile(slot)[cat] = id;
      persist(); return true;
    },
    profile: function (i) { return i === 'bot' ? D.bot : D.profiles[i]; },
    color: function (i) { return COLORS[this.profile(i).color] || COLORS[0]; },
    stats: function () { return D.stats; },
    resetStats: function () { D.stats = defaultStats(); persist(); }
  };
})();
