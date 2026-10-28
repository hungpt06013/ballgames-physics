/* Ballgames Physics – progression data: player profiles, coins & shop, stats. */
(function () {
  'use strict';
  function load(k, d) { try { var v = localStorage.getItem('bgp_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem('bgp_' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }

  // jersey colours a player can pick (used for their own player in 4-player solo mode)
  var COLORS = [
    { main: '#ef5b5b', dark: '#c63e44', name: 'Đỏ' }, { main: '#f5a524', dark: '#c98316', name: 'Cam' },
    { main: '#3fb4ea', dark: '#2387bd', name: 'Xanh dương' }, { main: '#4cc36b', dark: '#2f9a4f', name: 'Xanh lá' },
    { main: '#a66bea', dark: '#7c45c0', name: 'Tím' }, { main: '#f37ac1', dark: '#c94e96', name: 'Hồng' },
    { main: '#f2d33a', dark: '#c4a612', name: 'Vàng' }, { main: '#2fc6b5', dark: '#1b968a', name: 'Ngọc' },
    { main: '#5a5f6b', dark: '#373a42', name: 'Đen' }, { main: '#f4f4f4', dark: '#c4c4c4', name: 'Trắng' }
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
      { id: 'crown', name: 'Vương miện', price: 300, icon: '👑' }
    ],
    hair: [
      { id: 'default', name: 'Tóc ngắn', price: 0, icon: '💇' },
      { id: 'bald', name: 'Đầu trọc', price: 40, icon: '🥚' },
      { id: 'long', name: 'Tóc dài', price: 60, icon: '👱' },
      { id: 'afro', name: 'Tóc xù', price: 60, icon: '🦁' },
      { id: 'spiky', name: 'Tóc dựng', price: 70, icon: '⚡' },
      { id: 'pony', name: 'Tóc buộc', price: 70, icon: '🎀' },
      { id: 'mohawk', name: 'Tóc mào gà', price: 80, icon: '🐓' }
    ],
    shirt: [
      { id: 'plain', name: 'Áo trơn', price: 0, icon: '👕' },
      { id: 'number', name: 'Áo có số', price: 40, icon: '🔢' },
      { id: 'stripes', name: 'Sọc dọc', price: 60, icon: '🦓' },
      { id: 'hoops', name: 'Sọc ngang', price: 60, icon: '🐝' },
      { id: 'stars', name: 'Áo ngôi sao', price: 120, icon: '⭐' },
      { id: 'flame', name: 'Áo lửa', price: 150, icon: '🔥' }
    ],
    ball: [
      { id: 'classic', name: 'Bóng cổ điển', price: 0, icon: '⚽' },
      { id: 'smiley', name: 'Mặt cười', price: 80, icon: '😀' },
      { id: 'watermelon', name: 'Dưa hấu', price: 100, icon: '🍉' },
      { id: 'rainbow', name: 'Cầu vồng', price: 120, icon: '🌈' },
      { id: 'fire', name: 'Bóng lửa', price: 150, icon: '☄️' },
      { id: 'planet', name: 'Hành tinh', price: 200, icon: '🪐' },
      { id: 'gold', name: 'Bóng vàng', price: 400, icon: '🥇' }
    ]
  };
  var SHOP_TABS = [{ id: 'hat', name: 'Mũ' }, { id: 'hair', name: 'Tóc' }, { id: 'shirt', name: 'Áo' }, { id: 'ball', name: 'Bóng' }];

  function defaultProfile(i) { return { name: 'P' + (i + 1), color: i, hat: 'none', hair: 'default', shirt: 'plain' }; }
  function defaultStats() {
    return { played: 0, byMode: {}, botWins: { easy: 0, normal: 0, hard: 0 }, botLosses: { easy: 0, normal: 0, hard: 0 }, botDraws: { easy: 0, normal: 0, hard: 0 },
      goals: 0, goalsBySport: {}, fastest: 0, streak: 0, bestStreak: 0, coinsEarned: 0 };
  }

  var D = load('meta', null) || {};
  D.coins = D.coins || 0;
  D.owned = D.owned || {};
  SHOP_TABS.forEach(function (t) { D.owned[t.id] = D.owned[t.id] || {}; D.owned[t.id][SHOP[t.id][0].id] = 1; });
  D.profiles = D.profiles || [];
  for (var i = 0; i < 4; i++) D.profiles[i] = Object.assign(defaultProfile(i), D.profiles[i] || {});
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
    equip: function (cat, id, slot) {
      if (!this.owns(cat, id)) return false;
      if (cat === 'ball') D.ball = id; else D.profiles[slot][cat] = id;
      persist(); return true;
    },
    profile: function (i) { return D.profiles[i]; },
    color: function (i) { return COLORS[D.profiles[i].color] || COLORS[i]; },
    stats: function () { return D.stats; },
    resetStats: function () { D.stats = defaultStats(); persist(); }
  };
})();
