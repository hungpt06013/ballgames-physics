/* Ballgames Physics – game flow, input, HUD, menus, replays, tutorial. */
(function () {
  'use strict';
  var E = window.BGP, Snd = window.BGAudio, Meta = window.BGMeta, D = window.BGDraw, HL = window.BGHL;
  var W = E.W, GROUND = E.GROUND, DT = E.DT, COM_H = E.COM_H, INK = D.INK, TAU = D.TAU;
  var DEF_TEAM = [
    { main: '#ef5b5b', dark: '#c63e44', name: 'ĐỎ' },
    { main: '#3fb4ea', dark: '#2387bd', name: 'XANH' }
  ];
  var LEVEL_NAMES = { easy: 'DỄ', normal: 'THƯỜNG', hard: 'KHÓ', hardLite: 'KHÓ' };
  var LEVEL_COINS = { easy: 10, normal: 20, hard: 40 };
  var SCORE_WORDS = { goal: 'VÀOOO!', hoop: 'VÀO RỔ!', posts: 'QUA CỘT!', volley: 'ĂN ĐIỂM!', bomb: 'BÙM!' };
  var FLASH_WORDS = { goal: 'VÀO! ✔', hoop: 'VÀO RỔ! ✔', posts: 'QUA CỘT! ✔', volley: 'CHẠM SÂN!', bomb: 'BÙM!' };
  var BOT_LOOK = { hat: 'none', hair: 'default', shirt: 'number' };
  var NO_SCORER = '#aab4bf';
  var TOOL_SCREENS = ['menu', 'setup', 'settings', 'help', 'shop', 'profiles', 'stats', 'history', 'pause', 'over', 'vote', 'firstRun'];
  // weather & disasters: how often each comes (seconds, counted while nothing else is going on) and how long it lasts
  var WX = {
    fog: { name: 'Sương mù', icon: '🌫️', every: [5, 10], dur: 6 },
    quake: { name: 'Động đất', icon: '🏚️', every: [8, 15], dur: 10 },
    lightning: { name: 'Sấm sét', icon: '⚡', every: [8, 15], dur: 1.4 },
    tornado: { name: 'Lốc xoáy', icon: '🌪️', every: [8, 15], dur: 6 }
  };
  var WX_IDS = Object.keys(WX), MOD_IDS = Object.keys(E.MODS), ITEM_IDS = Object.keys(E.ITEMS);
  var WARN_TIME = 0.8, ZAP_TIME = 5;

  // ---------- storage ----------
  var load = Meta.load, store = Meta.store;
  var ALL_MAPS = E.MAPS.map(function (m) { return m.id; });
  var settings = Object.assign({}, E.DEFAULT_SETTINGS, load('settings', {}));
  var prefs = Object.assign({ level: 'hard', fmtType: 'p', fmtPoints: 5, fmtMinutes: 2, bombTime: 12,
    mods: true, modList: MOD_IDS.slice(), items: true, itemList: ITEM_IDS.slice(), weather: false, wxList: WX_IDS.slice(), beginner: false,
    slots: ['h', 'h', 'h', 'h'], replay: true, music: true, sound: true, maps: ALL_MAPS.slice(),
    hlAsked: false, hlMode: 'all', hlKeep: 30 }, load('prefs', {}));
  // older versions stored the format as 'p5' / 't120'
  if (typeof prefs.target === 'number' && !prefs.fmt) prefs.fmt = 'p' + prefs.target;
  if (typeof prefs.fmt === 'string') {
    if (prefs.fmt[0] === 't') { prefs.fmtType = 't'; prefs.fmtMinutes = (+prefs.fmt.slice(1) || 120) / 60; }
    else { prefs.fmtType = 'p'; prefs.fmtPoints = +prefs.fmt.slice(1) || 5; }
  }
  delete prefs.fmt; delete prefs.target;
  function keepKnown(list, ids) { list = (list || []).filter(function (k) { return ids.indexOf(k) >= 0; }); return list.length ? list : ids.slice(); }
  prefs.modList = keepKnown(prefs.modList, MOD_IDS); prefs.itemList = keepKnown(prefs.itemList, ITEM_IDS); prefs.wxList = keepKnown(prefs.wxList, WX_IDS);
  // prefs.maps: the sports ticked in the match setup (sports removed in later versions are dropped)
  prefs.maps = (prefs.maps || []).filter(function (id) { return E.MAP_BY_ID[id]; });
  if (!prefs.maps.length) prefs.maps = ALL_MAPS.slice();
  if (!E.LEVELS[prefs.level]) prefs.level = 'hard';
  if (['all', 'last', 'none'].indexOf(prefs.hlMode) < 0) prefs.hlMode = 'all';
  prefs.hlKeep = Math.max(1, Math.min(100, Math.round(+prefs.hlKeep) || 30));
  delete prefs.sport; delete prefs.knownMaps;
  function savePrefs() { store('prefs', prefs); }
  savePrefs();

  // ---------- light / dark ----------
  // prefs.theme: 'light' or 'dark' once chosen; until then it follows the phone
  var darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function isDark() { return prefs.theme ? prefs.theme === 'dark' : !!(darkQuery && darkQuery.matches); }
  function applyTheme() {
    var dark = isDark();
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#1b2430' : '#5cc04f';
    var tb = document.getElementById('themeBtn');
    if (tb) tb.textContent = dark ? '☀️' : '🌙';
    var tg = document.getElementById('tgDark');
    if (tg) tg.classList.toggle('on', dark);
  }
  function toggleTheme() { prefs.theme = isDark() ? 'light' : 'dark'; savePrefs(); applyTheme(); }
  if (darkQuery && darkQuery.addEventListener) darkQuery.addEventListener('change', applyTheme);
  applyTheme();
  Snd.musicOn = prefs.music; Snd.sfxOn = prefs.sound;

  // ---------- game state ----------
  var G = {
    state: 'menu', prev: 'play', mode: 'bot', cfg: null, score: [0, 0], world: null, bot: null, bots: [null, null, null, null],
    demo: true, demoCtl: null, demoNext: 0, queue: [], qi: 0, timer: 0, fade: 0, fadeDir: 0, scorer: -1, credit: -1,
    shake: 0, acc: 0, trails: [[], []], parts: [], armT: [0, 0, 0, 0], pressed: [false, false, false, false], round: 0,
    note: '', noteT: 0, botMs: 0, botWin: 0, perfUpd: 0, perfRen: 0, excite: 0, clock: 0, golden: false, roundT: 0,
    word: '', sub: '', hold: [0, 0, 0, 0], tut: null, earned: 0,
    replay: null, modName: '', wx: null, noPoint: '', wxv: { fog: 0, bolt: null, warn: null, zap: 0, bombGone: false }, rwxv: null, screenFlash: 0
  };
  function teamCol(t) { return DEF_TEAM[t]; }
  function is4(mode) { return mode === 'ffa' || mode === 'team4'; }
  function soloish(mode) { return mode === 'bot' || mode === 'tutorial'; }
  function slotTeam(i) { return i < 2 ? 0 : 1; }
  function slotColor(i) { return G.mode === 'ffa' ? Meta.color(i) : teamCol(slotTeam(i)); }
  function nameOf(i) { return Meta.profile(i).name || ('P' + (i + 1)); }
  function slotLabel(i) { var n = nameOf(i); return n === 'P' + (i + 1) ? n : 'P' + (i + 1) + ' · ' + n; }

  // ---------- canvas ----------
  var canvas = document.getElementById('c'), ctx = canvas.getContext('2d');
  var view = { s: 1, ox: 0, oy: 0, cw: 1, ch: 1, dpr: 1 };
  // while a highlight video is recorded the canvas is drawn 1280 pixels wide, whatever the screen
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = window.innerWidth, ch = window.innerHeight;
    if (G.exporting) dpr = EXPORT_W / cw;
    canvas.width = 2 * Math.round(cw * dpr / 2); canvas.height = 2 * Math.round(ch * dpr / 2);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    var s = Math.min(cw / W, ch / E.H);
    view = { s: s, ox: (cw - W * s) / 2, oy: (ch - E.H * s) / 2, cw: cw, ch: ch, dpr: dpr };
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- input ----------
  var keys = {}, pointers = {};
  var P1K = { KeyA: 1, KeyS: 1, KeyD: 1, KeyW: 1, KeyQ: 1, KeyE: 1, KeyZ: 1, KeyX: 1, KeyC: 1, KeyF: 1, KeyG: 1, ShiftLeft: 1, ControlLeft: 1, Space: 1 };
  var P2K = { KeyJ: 1, KeyK: 1, KeyL: 1, KeyI: 1, KeyO: 1, KeyP: 1, KeyM: 1, KeyN: 1, ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Enter: 1, NumpadEnter: 1, ShiftRight: 1, ControlRight: 1, Numpad0: 1, Slash: 1, Period: 1 };
  var K4 = [
    { KeyQ: 1, KeyW: 1, KeyE: 1, KeyA: 1, KeyS: 1, KeyD: 1, KeyZ: 1, KeyX: 1, KeyC: 1, ShiftLeft: 1, ControlLeft: 1 },
    { KeyR: 1, KeyT: 1, KeyY: 1, KeyF: 1, KeyG: 1, KeyH: 1, KeyV: 1, KeyB: 1, Space: 1 },
    { KeyU: 1, KeyI: 1, KeyO: 1, KeyJ: 1, KeyK: 1, KeyL: 1, KeyN: 1, KeyM: 1, Comma: 1 },
    { ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Enter: 1, NumpadEnter: 1, ShiftRight: 1, ControlRight: 1, KeyP: 1, Slash: 1, Period: 1, Numpad0: 1, Numpad1: 1, Numpad2: 1, Numpad3: 1 }
  ];
  function isBotSlot(i) { return !!G.bots[i]; }
  function keySlot(code) {
    if (code === 'Escape') return -1;
    if (soloish(G.mode)) return 0;
    if (is4(G.mode)) { for (var i = 0; i < 4; i++) if (K4[i][code]) return redirect(i); return -1; }
    return P1K[code] ? 0 : (P2K[code] ? 1 : -1);
  }
  // a quadrant that belongs to a bot is handed to the human on the same side
  function redirect(i) {
    if (!isBotSlot(i)) return i;
    var o = i ^ 1;
    return isBotSlot(o) ? -1 : o;
  }
  function pointSlot(x, y) {
    if (soloish(G.mode)) return 0;
    var right = x >= window.innerWidth / 2;
    if (!is4(G.mode)) return right ? 1 : 0;
    return redirect((right ? 2 : 0) + (y < window.innerHeight / 2 ? 1 : 0));
  }
  var latch = [false, false, false, false];
  function clearInput() { keys = {}; pointers = {}; for (var i = 0; i < 4; i++) { latch[i] = false; G.hold[i] = 0; } }
  window.addEventListener('keydown', function (e) {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (dlg) { if (e.code === 'Escape' && dlg.cancel !== undefined) dlg.close(dlg.cancel); return; }
    if (G.state === 'highlight') {
      if (e.code === 'Escape') closeHighlight(); else if (!e.repeat && !G.hlp.exporting) hlNext();
      return;
    }
    if (e.code === 'Escape') { if (G.state === 'paused') resume(); else pauseGame(); return; }
    var slot = keySlot(e.code);
    if (inGame() && slot >= 0) e.preventDefault();
    if (!e.repeat && slot >= 0) latch[slot] = true;
    keys[e.code] = true; Snd.init();
    if (G.state === 'replay' && slot >= 0) skipReplay();
  });
  window.addEventListener('keyup', function (e) { delete keys[e.code]; });
  window.addEventListener('blur', function () { keys = {}; pointers = {}; });
  var touch = document.getElementById('touch');
  touch.addEventListener('pointerdown', function (e) {
    e.preventDefault(); Snd.init();
    if (G.state === 'replay') { skipReplay(); return; }
    if (G.state === 'highlight') { if (!G.hlp.exporting) hlNext(); return; }
    var slot = pointSlot(e.clientX, e.clientY);
    if (slot < 0) return;
    pointers[e.pointerId] = slot; latch[slot] = true;
  });
  function release(e) { delete pointers[e.pointerId]; }
  touch.addEventListener('pointerup', release);
  touch.addEventListener('pointercancel', release);
  touch.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  function inGame() { return G.state === 'play' || G.state === 'intro' || G.state === 'scored' || G.state === 'replay'; }
  // a tap shorter than one physics step still registers (latch) and lasts at least `tapLen`
  function humanPress(slot, w) {
    if (latch[slot]) { latch[slot] = false; G.hold[slot] = w.time + (settings.tapLen || 0); return true; }
    if (w.time < G.hold[slot]) return true;
    var k;
    for (k in keys) if (keySlot(k) === slot) return true;
    for (k in pointers) if (pointers[k] === slot) return true;
    return false;
  }

  // ---------- screens ----------
  function $(id) { return document.getElementById(id); }
  function show(id) {
    TOOL_SCREENS.forEach(function (k) { $(k).classList.toggle('hidden', k !== id); });
    var playing = id === null && G.state !== 'menu';
    $('pauseBtn').classList.toggle('hidden', !playing || G.state === 'replay' || G.state === 'highlight');
    $('hlClose').classList.toggle('hidden', !(id === null && G.state === 'highlight' && !(G.hlp && G.hlp.exporting)));
    $('coach').classList.toggle('hidden', !(G.mode === 'tutorial' && id === null && G.state !== 'menu'));
    G.screen = id;
  }
  function refreshMenu() {
    $('menuCoins').textContent = '🪙 ' + Meta.coins();
    $('soundBtn').firstChild.textContent = prefs.sound ? '🔊' : '🔇';
  }
  function segSelect(segId, value) {
    Array.prototype.forEach.call($(segId).children, function (b) { b.classList.toggle('on', b.dataset.v === String(value)); });
  }

  // --- match setup ---
  var setupMode = 'bot';
  function openSetup(mode) {
    setupMode = mode;
    $('setupTitle').textContent = { '2p': '👥 2 người', bot: '🤖 Đấu với bot', ffa: '🙋 4 người · điểm riêng', team4: '🤝 2 vs 2' }[mode];
    $('rowSlots').classList.toggle('hidden', !is4(mode));
    refreshSetup();
    show('setup');
  }
  function refreshSetup() {
    var four = is4(setupMode), anyBot = setupMode === 'bot' || (four && prefs.slots.indexOf('b') >= 0);
    $('rowLevel').classList.toggle('hidden', !anyBot);
    segSelect('lvlSeg', prefs.level); segSelect('fmtType', prefs.fmtType);
    var fv = $('fmtValue'), pts = prefs.fmtType === 'p';
    fv.min = pts ? 1 : 0.5; fv.max = pts ? 99 : 60; fv.step = pts ? 1 : 0.5;
    if (document.activeElement !== fv) fv.value = pts ? prefs.fmtPoints : prefs.fmtMinutes;
    $('fmtUnit').textContent = pts ? 'điểm thì thắng' : 'phút';
    $('rowBomb').classList.toggle('hidden', prefs.maps.indexOf('bomb') < 0);
    if (document.activeElement !== $('bombTime')) $('bombTime').value = prefs.bombTime;
    var sb = $('slotBtns'); sb.innerHTML = '';
    for (var i = 0; i < 4; i++) (function (i) {
      var b = document.createElement('button'); b.className = 'chip' + (prefs.slots[i] === 'h' ? ' on' : '');
      var nm = nameOf(i);
      b.textContent = prefs.slots[i] === 'h' ? '🙋 ' + (nm === 'P' + (i + 1) ? nm : 'P' + (i + 1) + ' ' + nm) : '🤖 P' + (i + 1) + ' Bot';
      if (prefs.slots[i] === 'h' && setupMode === 'ffa') b.style.boxShadow = 'inset 0 -6px 0 ' + Meta.color(i).main;
      b.addEventListener('click', function () {
        prefs.slots[i] = prefs.slots[i] === 'h' ? 'b' : 'h';
        if (prefs.slots.indexOf('h') < 0) prefs.slots[i] = 'h'; // keep at least one human
        savePrefs(); Snd.click(); refreshSetup();
      });
      sb.appendChild(b);
    })(i);
    buildChecks($('sportChecks'), 'sportBox', ALL_MAPS, E.MAP_BY_ID, prefs.maps);
    var all = prefs.maps.length === ALL_MAPS.length;
    $('sportAll').textContent = all ? 'Chỉ bóng đá' : 'Chọn tất cả';
    // each option has its own list of things to tick, shown while the option is on
    [['tgMods', 'modChecks', prefs.mods, MOD_IDS, E.MODS, prefs.modList],
      ['tgItems', 'itemChecks', prefs.items, ITEM_IDS, E.ITEMS, prefs.itemList],
      ['tgWeather', 'wxChecks', prefs.weather, WX_IDS, WX, prefs.wxList]].forEach(function (o) {
      $(o[0]).classList.toggle('on', o[2]);
      $(o[1]).classList.toggle('hidden', !o[2]);
      if (o[2]) buildChecks($(o[1]), 'optBox', o[3], o[4], o[5]);
    });
    $('tgBeginner').classList.toggle('on', prefs.beginner);
  }
  // checkbox list over `ids` (labels from info[id].icon/name) that edits `list` in place; at least one stays ticked
  function buildChecks(box, cls, ids, info, list) {
    box.innerHTML = '';
    ids.forEach(function (id) {
      var on = list.indexOf(id) >= 0;
      var lab = document.createElement('label'); lab.className = cls + (on ? ' on' : '');
      var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = on;
      cb.addEventListener('change', function () {
        var i = list.indexOf(id);
        if (cb.checked && i < 0) list.push(id);
        else if (!cb.checked && i >= 0) {
          if (list.length > 1) list.splice(i, 1);
          else { cb.checked = true; Snd.beep(false); return; }
        }
        savePrefs(); Snd.click(); refreshSetup();
      });
      var txt = document.createElement('span'); txt.textContent = info[id].icon + ' ' + info[id].name;
      lab.appendChild(cb); lab.appendChild(txt);
      box.appendChild(lab);
    });
  }
  function clampNum(v, lo, hi, step) { v = Math.round(+v / step) * step; return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo; }
  function readFormat(commit) {
    var fv = $('fmtValue'), v = parseFloat(String(fv.value).replace(',', '.'));
    if (!isFinite(v)) { if (commit) refreshSetup(); return; }
    if (prefs.fmtType === 'p') prefs.fmtPoints = clampNum(v, 1, 99, 1); else prefs.fmtMinutes = clampNum(v, 0.5, 60, 0.5);
    savePrefs();
    if (commit) fv.value = prefs.fmtType === 'p' ? prefs.fmtPoints : prefs.fmtMinutes;
  }
  function readBomb(commit) {
    var bv = $('bombTime'), v = parseFloat(bv.value);
    if (!isFinite(v)) { if (commit) bv.value = prefs.bombTime; return; }
    prefs.bombTime = clampNum(v, 3, 60, 1); savePrefs();
    if (commit) bv.value = prefs.bombTime;
  }
  $('fmtValue').addEventListener('input', function () { readFormat(false); });
  $('fmtValue').addEventListener('change', function () { readFormat(true); });
  $('bombTime').addEventListener('input', function () { readBomb(false); });
  $('bombTime').addEventListener('change', function () { readBomb(true); });
  $('fmtType').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; prefs.fmtType = b.dataset.v; savePrefs(); Snd.click(); refreshSetup(); });
  $('lvlSeg').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; prefs.level = b.dataset.v; savePrefs(); Snd.click(); refreshSetup(); });
  $('tgMods').addEventListener('click', function () { prefs.mods = !prefs.mods; savePrefs(); Snd.click(); refreshSetup(); });
  $('tgItems').addEventListener('click', function () { prefs.items = !prefs.items; savePrefs(); Snd.click(); refreshSetup(); });
  $('tgWeather').addEventListener('click', function () { prefs.weather = !prefs.weather; savePrefs(); Snd.click(); refreshSetup(); });
  $('tgBeginner').addEventListener('click', function () { prefs.beginner = !prefs.beginner; savePrefs(); Snd.click(); refreshSetup(); });
  $('sportAll').addEventListener('click', function () {
    prefs.maps = prefs.maps.length === ALL_MAPS.length ? ['soccer'] : ALL_MAPS.slice();
    savePrefs(); Snd.click(); refreshSetup();
  });

  // --- settings ---
  var SLIDERS = [
    { key: 'jump', label: 'Lực nhảy', min: 0.6, max: 1.5, step: 0.05, fmt: 'x' },
    { key: 'kick', label: 'Lực sút', min: 0.6, max: 1.6, step: 0.05, fmt: 'x' },
    { key: 'gravity', label: 'Trọng lực', min: 0.4, max: 1.6, step: 0.05, fmt: 'x' },
    { key: 'bounce', label: 'Độ nảy bóng', min: 0.4, max: 1.4, step: 0.05, fmt: 'x' },
    { key: 'ballSize', label: 'Cỡ bóng', min: 0.7, max: 1.6, step: 0.05, fmt: 'x' },
    { key: 'speed', label: 'Tốc độ game', min: 0.6, max: 1.4, step: 0.05, fmt: 'x' },
    { key: 'jumpDelay', label: 'Độ trễ nhảy (sút trước khi bật)', min: 0, max: 0.12, step: 0.01, fmt: 's' },
    { key: 'tapLen', label: 'Độ dài tối thiểu 1 lần chạm', min: 0, max: 0.2, step: 0.01, fmt: 's' }
  ];
  function buildSettings() {
    var box = $('sliders'); box.innerHTML = '';
    SLIDERS.forEach(function (d) {
      var wrap = document.createElement('div'); wrap.className = 'slider';
      var lab = document.createElement('label');
      var name = document.createElement('span'); name.textContent = d.label;
      var val = document.createElement('span');
      lab.appendChild(name); lab.appendChild(val);
      var inp = document.createElement('input');
      inp.type = 'range'; inp.min = d.min; inp.max = d.max; inp.step = d.step; inp.value = settings[d.key];
      var upd = function () {
        settings[d.key] = +inp.value;
        val.textContent = d.fmt === 'x' ? '×' + (+inp.value).toFixed(2) : Math.round(+inp.value * 1000) + ' ms';
        store('settings', settings);
      };
      inp.addEventListener('input', upd); upd();
      wrap.appendChild(lab); wrap.appendChild(inp); box.appendChild(wrap);
    });
    $('tgReplay').classList.toggle('on', prefs.replay);
    $('tgMusic').classList.toggle('on', prefs.music);
    $('tgSfx').classList.toggle('on', prefs.sound);
    $('tgDark').classList.toggle('on', isDark());
    buildHLSettings();
  }
  $('tgReplay').addEventListener('click', function () { prefs.replay = !prefs.replay; savePrefs(); buildSettings(); });
  $('tgMusic').addEventListener('click', function () { prefs.music = !prefs.music; Snd.init(); Snd.setMusic(prefs.music); savePrefs(); buildSettings(); });
  $('tgDark').addEventListener('click', function () { toggleTheme(); Snd.click(); });
  $('themeBtn').addEventListener('click', function () { toggleTheme(); Snd.init(); Snd.click(); });
  $('tgSfx').addEventListener('click', function () { prefs.sound = !prefs.sound; Snd.sfxOn = prefs.sound; savePrefs(); buildSettings(); refreshMenu(); });

  // --- shop ---
  var shopTab = 'hat', shopSlot = 0;
  function buildShop() {
    $('shopCoins').textContent = '🪙 ' + Meta.coins();
    var tabs = $('shopTabs'); tabs.innerHTML = '';
    Meta.SHOP_TABS.forEach(function (t) {
      var b = document.createElement('button'); b.className = 'chip' + (t.id === shopTab ? ' on' : ''); b.textContent = t.name;
      b.addEventListener('click', function () { shopTab = t.id; Snd.click(); buildShop(); });
      tabs.appendChild(b);
    });
    $('shopFor').classList.toggle('hidden', shopTab === 'ball');
    var ss = $('shopSlot'); ss.innerHTML = '';
    for (var i = 0; i < 4; i++) (function (i) {
      var b = document.createElement('button'); b.textContent = nameOf(i); b.className = i === shopSlot ? 'on' : '';
      b.addEventListener('click', function () { shopSlot = i; Snd.click(); buildShop(); });
      ss.appendChild(b);
    })(i);
    var grid = $('shopGrid'); grid.innerHTML = '';
    Meta.SHOP[shopTab].forEach(function (it) {
      var owned = Meta.owns(shopTab, it.id);
      var eq = shopTab === 'ball' ? Meta.D.ball === it.id : Meta.profile(shopSlot)[shopTab] === it.id;
      var card = document.createElement('div');
      card.className = 'card' + (eq ? ' eq' : (owned ? ' owned' : (Meta.coins() < it.price ? ' locked' : '')));
      card.innerHTML = '<div class="ic">' + it.icon + '</div><div>' + it.name + '</div><div class="price">' +
        (eq ? '✔ Đang dùng' : (owned ? 'Đã có · bấm để dùng' : '🪙 ' + it.price)) + '</div>';
      card.addEventListener('click', function () {
        if (!owned) {
          if (!Meta.buy(shopTab, it.id)) { Snd.beep(false); card.animate && card.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], 200); return; }
          Snd.coin();
        } else Snd.click();
        Meta.equip(shopTab, it.id, shopSlot);
        buildShop(); refreshMenu();
      });
      grid.appendChild(card);
    });
  }

  // --- player profiles ---
  var profSlot = 0;
  function buildProfiles() {
    var tabs = $('profTabs'); tabs.innerHTML = '';
    for (var i = 0; i < 4; i++) (function (i) {
      var b = document.createElement('button'); b.className = 'chip' + (i === profSlot ? ' on' : ''); b.textContent = slotLabel(i);
      b.addEventListener('click', function () { profSlot = i; Snd.click(); buildProfiles(); });
      tabs.appendChild(b);
    })(i);
    var pr = Meta.profile(profSlot);
    $('profName').value = pr.name;
    var sw = $('profColors'); sw.innerHTML = '';
    Meta.COLORS.forEach(function (c, ci) {
      var b = document.createElement('button'); b.style.background = c.main; b.title = c.name; b.className = pr.color === ci ? 'on' : '';
      b.addEventListener('click', function () { pr.color = ci; Meta.save(); Snd.click(); buildProfiles(); });
      sw.appendChild(b);
    });
    var items = $('profItems'); items.innerHTML = '';
    ['hat', 'hair', 'shirt'].forEach(function (cat) {
      Meta.SHOP[cat].forEach(function (it) {
        if (!Meta.owns(cat, it.id)) return;
        var b = document.createElement('button'); b.className = 'chip' + (pr[cat] === it.id ? ' on' : ''); b.textContent = it.icon + ' ' + it.name;
        b.addEventListener('click', function () { Meta.equip(cat, it.id, profSlot); Snd.click(); buildProfiles(); });
        items.appendChild(b);
      });
    });
    drawPreview();
  }
  $('profName').addEventListener('input', function () {
    var v = $('profName').value.replace(/[<>]/g, '').slice(0, 10);
    Meta.profile(profSlot).name = v || ('P' + (profSlot + 1)); Meta.save();
    Array.prototype.forEach.call($('profTabs').children, function (b, i) { b.textContent = slotLabel(i); });
  });
  var previewP = null;
  function drawPreview() {
    var cv = $('profCanvas'), c = cv.getContext('2d');
    if (!previewP) { previewP = E.createWorld('soccer', null, 1).players[1]; }
    var p = previewP, pr = Meta.profile(profSlot);
    p.x = 165; p.y = 320 - COM_H * 1.6; p.a = 0; p.f = 1; p.leg = -0.12; E.setScale(p, 1.6); p.id = profSlot;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
    c.fillStyle = '#4fae48'; c.fillRect(0, 320, cv.width, cv.height - 320);
    D.player(c, p, { col: Meta.color(profSlot), hat: pr.hat, hair: pr.hair, shirt: pr.shirt, num: profSlot + 1, face: 'happy',
      hairCol: profSlot % 2 ? '#5b3a1f' : INK, armT: 0.6, mapId: 'soccer' });
    D.textOutlined(c, pr.name, cv.width / 2, 400, 30, '#ffffff', INK);
  }

  // --- stats ---
  function buildStats() {
    var s = Meta.stats(), rows = [];
    function wl(l) { return s.botWins[l] + ' thắng · ' + s.botLosses[l] + ' thua' + (s.botDraws && s.botDraws[l] ? ' · ' + s.botDraws[l] + ' hoà' : ''); }
    var fav = '', best = 0;
    for (var k in s.goalsBySport) if (s.goalsBySport[k] > best) { best = s.goalsBySport[k]; fav = E.MAP_BY_ID[k] ? E.MAP_BY_ID[k].icon + ' ' + E.MAP_BY_ID[k].name : k; }
    rows.push(['🎮 Trận đã chơi', s.played]);
    rows.push(['🤖 Đấu bot Dễ', wl('easy')]);
    rows.push(['🤖 Đấu bot Thường', wl('normal')]);
    rows.push(['🤖 Đấu bot Khó', wl('hard')]);
    rows.push(['🔥 Chuỗi thắng bot Khó dài nhất', s.bestStreak]);
    rows.push(['⚽ Tổng bàn thắng', s.goals]);
    rows.push(['❤️ Môn ghi nhiều nhất', fav ? fav + ' (' + best + ')' : '—']);
    rows.push(['⚡ Bàn thắng nhanh nhất', s.fastest ? s.fastest.toFixed(1) + ' giây' : '—']);
    rows.push(['🪙 Xu đã kiếm', s.coinsEarned]);
    $('statList').innerHTML = rows.map(function (r) { return '<div class="stat"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>'; }).join('');
  }

  // --- global click actions ---
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    Snd.init(); Snd.click();
    switch (b.dataset.act) {
      case 'setup': openSetup(b.dataset.mode); break;
      case 'start': readFormat(true); readBomb(true); show(null); startMatch({ mode: setupMode }); break;
      case 'back': backFromScreen(); break;
      case 'settings': buildSettings(); show('settings'); break;
      case 'defaults':
        settings = Object.assign({}, E.DEFAULT_SETTINGS);
        store('settings', settings); buildSettings(); break;
      case 'help': show('help'); break;
      case 'shop': G.shopFrom = G.screen; buildShop(); show('shop'); break;
      case 'profiles': buildProfiles(); show('profiles'); break;
      case 'stats': buildStats(); show('stats'); break;
      case 'history': buildHistory(); show('history'); break;
      case 'hlWatch': if (G.lastHL) playHighlight(G.lastHL, 'over'); break;
      case 'hlExport': if (G.lastHL) exportHighlight(G.lastHL, 'over'); break;
      case 'resetStats': Meta.resetStats(); buildStats(); break;
      case 'tutorial': startTutorial(); break;
      case 'skipTutorial': Meta.D.tutorialSkipped = true; Meta.save(); show('menu'); break;
      case 'sound': prefs.sound = !prefs.sound; Snd.sfxOn = prefs.sound; savePrefs(); refreshMenu(); break;
      case 'resume': resume(); break;
      case 'restart': restart(); break;
      case 'toMenu': toMenu(); break;
    }
  });
  $('pauseBtn').addEventListener('click', function () { pauseGame(); });
  function backFromScreen() {
    if (G.screen === 'shop' && G.shopFrom === 'profiles') { buildProfiles(); show('profiles'); return; }
    refreshMenu(); show('menu');
  }

  // ---------- flow ----------
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function makeQueue(first, avoid) {
    var q = shuffle(((G.cfg && G.cfg.maps) || prefs.maps).slice());
    if (first && q.indexOf('soccer') > 0) { q.splice(q.indexOf('soccer'), 1); q.unshift('soccer'); }
    if (avoid && q.length > 1 && q[0] === avoid) q.push(q.shift());
    return q;
  }
  // colour of the scoring structure on one side (0 = left, the target of the right-hand side).
  // 4-player solo: it shows who would get the point (grey while nobody of that side has touched the ball).
  function targetColor(side) {
    var team = side === 0 ? 1 : 0;
    if (!G.demo && G.looks && G.looks.ffa && G.world) {
      var who = G.world.ball.lastBy[team];
      return who >= 0 ? G.looks.p[who].col.main : NO_SCORER;
    }
    return teamCol(team).main;
  }
  function matchSettings() {
    var cfg = G.cfg || {};
    return Object.assign({}, settings, { beginner: !!cfg.beginner, powerups: !!cfg.items, itemList: cfg.itemList, bombTime: cfg.bombTime });
  }
  // a random modifier for the round, from the ones ticked in the setup that suit this sport
  function pickMods(id) {
    if (!G.cfg || !G.cfg.mods || Math.random() > 0.55) return {};
    var list = E.modsFor(id).filter(function (k) { return !G.cfg.modList || G.cfg.modList.indexOf(k) >= 0; }), m = {};
    if (!list.length) return m;
    m[list[Math.floor(Math.random() * list.length)]] = true;
    return m;
  }
  function newWorld(id, serve, swapRoles, mods) {
    var w = E.createWorld(id, G.demo ? settings : matchSettings(), (Math.random() * 4294967295) >>> 0, mods || {});
    if (swapRoles) for (var i = 0; i < 4; i++) w.players[i].role = 1 - w.players[i].role;
    E.resetRound(w, serve);
    w.events.length = 0;
    return w;
  }
  function startDemo() {
    G.demo = true; G.mode = '2p'; G.cfg = null; G.wx = null; G.rwxv = null;
    G.wxv = { fog: 0, bolt: null, warn: null, zap: 0, bombGone: false };
    var id = ALL_MAPS[Math.floor(Math.random() * ALL_MAPS.length)];
    G.world = newWorld(id, -1); G.trails = [[], []];
    G.demoCtl = [demoController(0), demoController(1)]; G.demoNext = 0;
    Snd.quiet = true; Snd.setStyle('menu'); Snd.setCrowd(false);
  }
  function resetBots() {
    G.bot = null; G.bots = [null, null, null, null];
  }
  function newBot(team, level, slot) {
    var b = new E.Bot(team, level, (Math.random() * 4294967295) >>> 0, slot);
    if (G.cfg && G.cfg.beginner) b.extraMistake = 0.2;
    return b;
  }
  function fmtString() {
    return prefs.fmtType === 't' ? 't' + Math.round(clampNum(prefs.fmtMinutes, 0.5, 60, 0.5) * 60) : 'p' + clampNum(prefs.fmtPoints, 1, 99, 1);
  }
  // cfg: { mode, level, fmt ('p5' = first to 5, 't120' = 120 s), maps, mods, modList, items, itemList, weather, wxList, bombTime, beginner, slots }
  function startMatch(cfg) {
    Snd.init();
    cfg = Object.assign({ level: prefs.level, fmt: fmtString(), maps: prefs.maps.slice(), mods: prefs.mods, modList: prefs.modList.slice(),
      items: prefs.items, itemList: prefs.itemList.slice(), weather: prefs.weather, wxList: prefs.wxList.slice(), bombTime: prefs.bombTime,
      beginner: prefs.beginner, slots: prefs.slots.slice() }, cfg);
    G.cfg = cfg; G.mode = cfg.mode; G.demo = false; G.round = 0; G.earned = 0; G.golden = false;
    G.matchT = 0; G.goalsLog = []; G.playedMaps = []; G.hlm = { clips: [], singles: [], misses: [] }; G.lastHL = null; G.ps = newStats();
    G.score = is4(cfg.mode) ? [0, 0, 0, 0] : [0, 0];
    G.target = cfg.fmt[0] === 'p' ? +cfg.fmt.slice(1) : 0;
    G.clock = cfg.fmt[0] === 't' ? +cfg.fmt.slice(1) : 0;
    resetBots();
    if (cfg.mode === 'bot') G.bot = newBot(1, cfg.level, -1);
    if (is4(cfg.mode)) for (var i = 0; i < 4; i++) if (cfg.slots[i] === 'b') G.bots[i] = newBot(slotTeam(i), cfg.level, i);
    G.looks = matchLooks(); G.hlSettings = matchSettings();
    G.queue = makeQueue(true); G.qi = 0;
    clearInput();
    Snd.quiet = false;
    startRound(-1);
    G.fade = 1; G.fadeDir = -1;
    show(null);
  }
  function restart() {
    if (G.mode === 'tutorial') { startTutorial(); return; }
    startMatch(G.cfg);
  }
  function startRound(serve) {
    G.round++;
    var id = G.queue[G.qi], mods = G.mode === 'tutorial' ? {} : pickMods(id);
    G.world = newWorld(id, serve, is4(G.mode) && G.round % 2 === 0, mods);
    var mk = Object.keys(mods)[0];
    G.modName = mk ? E.MODS[mk].icon + ' ' + E.MODS[mk].name : '';
    G.roundMods = mods; G.clipDone = false; G.hlw = G.hlm ? newWatch() : null; G.psT = [-9, -9, -9, -9]; G.pressT = [-9, -9, -9, -9];
    if (G.playedMaps && G.playedMaps.indexOf(id) < 0) G.playedMaps.push(id);
    if (G.bot) G.bot.reset();
    G.bots.forEach(function (b) { if (b) b.reset(); });
    G.state = 'intro'; G.timer = 1.6; G.trails = [[], []]; G.scorer = -1; G.credit = -1; G.acc = 0; G.roundT = 0; G.flash = null;
    G.noPoint = ''; G.screenFlash = 0;
    G.wx = G.cfg && G.cfg.weather && G.mode !== 'tutorial' ? newWeather(G.cfg.wxList) : null;
    G.wxv = { fog: 0, bolt: null, warn: null, zap: 0, bombGone: false };
    // a tap's minimum hold is measured in world time, which restarts with every round
    for (var i = 0; i < 4; i++) { G.hold[i] = 0; latch[i] = false; }
    G.rec = new Recorder();
    Snd.setStyle(id); Snd.setCrowd(!!E.MAP_BY_ID[id].crowd);
  }
  function nextRound() {
    var last = G.queue[G.qi];
    if (!G.noPoint) G.qi++; // a round stopped without a point is played again in the same sport
    if (G.qi >= G.queue.length) { G.queue = makeQueue(false, last); G.qi = 0; }
    startRound(G.scorer >= 0 ? 1 - G.scorer : -1);
    G.fadeDir = -1;
  }

  // ---------- scoring ----------
  function commentary(w, team) {
    var A = w.arena, b = w.balls[w.scoreBall] || w.ball, word = SCORE_WORDS[A.type], sub = '';
    if (A.type === 'bomb') { return { word: word, sub: 'Bom nổ bên sân ' + (team === 0 ? 'phải' : 'trái') + '!' }; }
    var own = b.lastTeam >= 0 && b.lastTeam !== team;
    if (own && A.type !== 'volley') return { word: 'PHẢN LƯỚI!', sub: 'Ôi không, đưa bóng vào lưới nhà!' };
    var goalX = team === 0 ? W : 0, far = Math.abs(goalX - b.lastX) > 900;
    if (E.isBicycle(b, team)) sub = 'XE ĐẠP CHỔNG NGƯỢC! 🚲';
    else if (b.lastKind === 'head') sub = A.type === 'hoop' ? 'Đánh đầu vào rổ! 🗣️' : 'ĐÁNH ĐẦU! 🗣️';
    else if (w.fx.kick[team] > 0) sub = 'SIÊU SÚT LỬA! 🔥';
    else if (far && A.type !== 'volley') sub = A.type === 'hoop' ? 'Ném xa từ giữa sân! 🎯' : 'SÚT XA SIÊU PHẨM! 🚀';
    else if (G.roundT < 4) sub = 'CHỚP NHOÁNG! ⚡';
    return { word: word, sub: sub };
  }
  function onScore(team) {
    if (G.demo) { if (G.demoNext <= 0) G.demoNext = 1.3; return; }
    var w = G.world, b = w.balls[w.scoreBall] || w.ball, col = teamCol(team);
    G.scorer = team; G.credit = w.credit; G.noteT = 0; G.goalBall = w.scoreBall;
    if (G.wx) G.wx.zap = null;
    var com = commentary(w, team);
    G.word = com.word; G.sub = com.sub;
    if (G.mode === 'tutorial') return;
    hlScored(team);
    var human = !soloish(G.mode) || team === 0;
    if (G.mode === 'ffa') {
      if (G.credit >= 0) { G.score[G.credit]++; col = Meta.color(G.credit); }
    } else if (G.mode === 'team4') {
      for (var i = 0; i < 4; i++) if (slotTeam(i) === team) G.score[i]++;
    } else G.score[team]++;
    if (human) {
      var st = Meta.stats();
      st.goals++; st.goalsBySport[w.arena.map.id] = (st.goalsBySport[w.arena.map.id] || 0) + 1;
      if (!st.fastest || G.roundT < st.fastest) st.fastest = G.roundT;
      Meta.save();
      if (soloish(G.mode)) { G.earned += 2; }
    }
    G.state = 'scored'; G.timer = 1.9; G.shake = 1; G.excite = 1;
    G.rec.mark(w, team);
    var A0 = w.arena.type;
    if (b.lastTeam >= 0 && b.lastTeam !== team && A0 !== 'volley' && A0 !== 'bomb') statAdd(b.lastPid, 'own'); else statAdd(G.credit, 'goals');
    if (G.goalsLog) G.goalsLog.push({ t: Math.round(G.matchT), team: team, credit: G.credit, map: w.arena.map.id, who: scorerName(team, G.credit), sub: com.sub || com.word });
    confetti(b.x, b.y, team, col);
    Snd.whistle(); Snd.cheer();
    try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) { /* not supported */ }
  }
  function uniqueLeader() {
    var s = G.score, best = -1, who = -1, tie = false;
    var idx = G.mode === 'team4' ? [0, 2] : (G.mode === 'ffa' ? [0, 1, 2, 3] : [0, 1]);
    idx.forEach(function (i) { if (s[i] > best) { best = s[i]; who = i; tie = false; } else if (s[i] === best) tie = true; });
    return tie ? -1 : who;
  }
  function matchWinner() {
    if (G.target) { for (var i = 0; i < G.score.length; i++) if (G.score[i] >= G.target) return i; return -1; }
    if (G.clock > 0) return -1;
    return uniqueLeader();
  }
  // draw = the time ran out level and the players voted to stop there
  function endMatch(draw) {
    G.state = 'over';
    Snd.setCrowd(false);
    var w = draw ? -1 : matchWinner(), txt, color = '', html, st = Meta.stats(), reward = G.earned, mode = G.mode;
    st.played++; st.byMode[mode] = (st.byMode[mode] || 0) + 1;
    html = scoreHtml();
    if (mode === 'ffa') {
      if (!draw) { txt = nameOf(w) + ' THẮNG! 🏆'; color = textCol(Meta.color(w)); }
      reward += 5;
    } else if (mode === 'team4') {
      if (!draw) { var t = w < 2 ? 0 : 1; txt = 'ĐỘI ' + DEF_TEAM[t].name + ' THẮNG! 🏆'; color = textCol(teamCol(t)); }
      reward += 5;
    } else if (mode === '2p') {
      if (!draw) { txt = nameOf(w) + ' THẮNG! 🏆'; color = textCol(teamCol(w)); }
      reward += 5;
    } else {
      var lvl = G.cfg.level, won = w === 0;
      if (draw) { st.botDraws[lvl] = (st.botDraws[lvl] || 0) + 1; reward += 5; if (lvl === 'hard') st.streak = 0; }
      else if (won) { st.botWins[lvl]++; reward += LEVEL_COINS[lvl]; if (lvl === 'hard') { st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); } }
      else { st.botLosses[lvl]++; reward += 3; if (lvl === 'hard') st.streak = 0; }
      if (!draw) { color = textCol(teamCol(w)); txt = won ? 'BẠN THẮNG! 🏆' : 'BOT THẮNG! 🤖'; }
    }
    if (draw) txt = 'HOÀ! 🤝';
    Meta.save();
    Meta.addCoins(reward);
    $('resultText').textContent = txt;
    $('resultText').style.color = color;
    $('resultScore').innerHTML = html;
    $('resultReward').textContent = reward > 0 ? '+' + reward + ' 🪙' : '';
    if (reward > 0) Snd.coin();
    var ms = matchStats(w, draw), pbox = $('resultStats');
    pbox.innerHTML = '';
    if (ms) pbox.appendChild(statsTable(ms, mode));
    // the match goes into the history, with its highlight (kept or not as the player chose)
    var clips = finishHighlights(), rec = matchRecord(w, draw);
    if (ms) { rec.ps = ms.list; rec.mvp = ms.mvp; }
    var hl = clips ? { match: { id: rec.id, date: rec.date, mode: mode, settings: G.hlSettings, looks: G.looks,
      mvp: ms ? { n: ms.list[ms.mvp].n, r: ms.list[ms.mvp].r } : null }, clips: clips } : null;
    G.lastHL = hl;
    var tools = [['☰ Menu', 'toMenu']];
    if (hl) tools.push(['🎬 Xem highlight', 'hlWatch'], ['⬇️ Tải highlight', 'hlExport']);
    setOverButtons([['↻ CHƠI LẠI', 'restart']], tools);
    show('over');
    (prefs.hlAsked || !hl ? Promise.resolve() : askPolicy()).then(function () {
      return HL.addMatch(rec, hl, { mode: prefs.hlMode, keep: prefs.hlKeep });
    });
  }
  function matchRecord(winner, draw) {
    var mode = G.mode, r = {
      id: 'm' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36), date: Date.now(), mode: mode, fmt: G.cfg.fmt,
      maps: (G.playedMaps || []).slice(), score: G.score.slice(), names: [0, 1, 2, 3].map(nameOf), bots: G.bots.map(Boolean),
      winner: draw ? -1 : winner, draw: !!draw, dur: Math.round(G.matchT || 0), goals: G.goalsLog || [], hl: null
    };
    if (mode === 'bot' || (is4(mode) && G.bots.some(Boolean))) r.level = G.cfg.level;
    if (mode === 'bot') r.result = draw ? 'draw' : (winner === 0 ? 'win' : 'loss');
    return r;
  }
  // white or yellow kits are unreadable as text on the white result card
  function lum(hex) { var n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; }
  function textCol(col) {
    if (isDark()) return lum(col.main) > 0.3 ? col.main : 'var(--text)';
    return lum(col.main) < 0.72 ? col.main : (lum(col.dark) < 0.62 ? col.dark : 'var(--text)');
  }
  function scoreSpan(col, txt) { return '<span style="color:' + textCol(col) + '">' + txt + '</span>'; }
  function setOverButtons(main, tools) {
    var m = $('overMain'); m.textContent = main[0][0]; m.dataset.act = main[0][1];
    var t = $('overTools'); t.innerHTML = '';
    tools.forEach(function (x) { var b = document.createElement('button'); b.className = 'btn'; b.textContent = x[0]; b.dataset.act = x[1]; t.appendChild(b); });
  }
  function pauseGame() {
    if (!inGame() || G.state === 'replay') return;
    G.prev = G.state; G.state = 'paused'; clearInput();
    show('pause');
  }
  function resume() {
    if (G.state !== 'paused') return;
    G.state = G.prev; G.acc = 0; clearInput();
    show(null);
  }
  function toMenu() {
    G.state = 'menu'; resetBots(); G.mode = '2p'; G.hlm = null; G.hlw = null; G.ps = null;
    startDemo(); refreshMenu(); show('menu');
    G.fade = 1; G.fadeDir = -1;
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) pauseGame(); });
  // Android back button (called from the native wrapper); returns true when handled
  window.__back = function () {
    if (dlg) { if (dlg.cancel !== undefined) dlg.close(dlg.cancel); return true; }
    if (G.state === 'highlight') { closeHighlight(); return true; }
    if (G.state === 'vote') return true;
    if (inGame()) { if (G.state === 'replay') skipReplay(); else pauseGame(); return true; }
    if (G.state === 'paused') { resume(); return true; }
    if (G.state === 'over') { toMenu(); return true; }
    if (G.screen && G.screen !== 'menu') { backFromScreen(); return true; }
    return false;
  };

  // ---------- tutorial ----------
  var TUT = [
    { text: '① Chạm màn hình (hoặc bấm phím) để NHẢY', small: 'Cầu thủ nhảy theo hướng đang nghiêng' },
    { text: '② Bóng ở trước chân — chạm để SÚT!', small: 'Chân vung trước rồi mới bật nhảy' },
    { text: '③ GIỮ nút khi đang bay để XOAY NGƯỜI', small: 'Xoay thật mạnh — sút xe đạp chổng ngược!' }
  ];
  function startTutorial() {
    Snd.init();
    G.cfg = { mode: 'tutorial', level: 'easy', fmt: 'p99', maps: ['soccer'], mods: false, items: false, beginner: false, slots: ['h', 'h', 'h', 'h'] };
    G.mode = 'tutorial'; G.demo = false; G.round = 0; G.score = [0, 0]; G.target = 0; G.clock = 0; G.earned = 0;
    G.hlm = null; G.matchT = 0; G.ps = null;
    resetBots();
    G.looks = matchLooks();
    G.queue = ['soccer']; G.qi = 0;
    clearInput(); Snd.quiet = false;
    startRound(-1);
    var w = G.world;
    for (var i = 0; i < 4; i++) w.players[i].active = i === 1;
    E.resetRound(w, 0);
    w.ball.x = w.ball.prevX = 1300; w.ball.y = w.ball.prevY = GROUND - 30;
    G.state = 'play'; G.tut = { step: 0, t: 0, ok: 0 };
    setCoach();
    G.fade = 1; G.fadeDir = -1;
    show(null);
  }
  function setCoach() {
    var s = TUT[G.tut.step];
    $('coach').innerHTML = s ? s.text + '<small>' + s.small + '</small>' : '🎉 HOÀN THÀNH!';
  }
  function tutorialTick(dt, w) {
    var t = G.tut, p = w.players[1];
    t.t += dt;
    w.ball.outT = 0; w.ball.stillT = 0; // no automatic re-drop while learning
    if (t.ok > 0) { t.ok -= dt; if (t.ok <= 0) advanceTutorial(w); return; }
    if (t.step === 0 && w.events.some(function (e) { return e.t === 'jump' && e.id === 1; })) passStep();
    else if (t.step === 1) {
      var b = w.ball;
      if (t.place && p.cT < 0.05 && p.gT < 0.05) { t.place = false; placeTutorialBall(w); }
      else if (!t.place && Math.abs(b.x - p.x) > 400 && b.y > GROUND - 60 && Math.abs(b.vx) < 30) t.place = true;
      if (w.events.some(function (e) { return e.t === 'kick' && e.id === 1 && e.v > 300; })) passStep();
    } else if (t.step === 2 && p.cT > 0.1 && Math.abs(p.a) > 2.2) passStep();
  }
  function passStep() { G.tut.ok = 0.9; Snd.star(G.tut.step); G.note = '✔ Tốt lắm!'; G.noteT = 0.9; }
  function placeTutorialBall(w) {
    var p = w.players[1], b = w.ball;
    b.x = b.prevX = Math.max(260, Math.min(W - 260, p.x + p.f * 95)); b.y = b.prevY = GROUND - w.arena.P.ballR; b.vx = b.vy = 0; b.spin = 0;
    G.trails = [[], []];
  }
  function advanceTutorial(w) {
    G.tut.step++;
    if (G.tut.step === 1) G.tut.place = true;
    if (G.tut.step >= TUT.length) {
      var first = !Meta.D.tutorialDone;
      Meta.D.tutorialDone = true; Meta.save();
      if (first) Meta.addCoins(30);
      G.state = 'over'; $('coach').classList.add('hidden');
      $('resultText').textContent = '🎓 ĐÃ HỌC XONG!'; $('resultText').style.color = '#3f9a3b';
      $('resultScore').textContent = 'Giờ thử đấu với bot hoặc rủ bạn bè nhé!';
      $('resultReward').textContent = first ? '+30 🪙' : '';
      $('resultStats').innerHTML = '';
      setOverButtons([['☰ VỀ MENU', 'toMenu']], [['↻ Học lại', 'restart']]);
      show('over');
      return;
    }
    setCoach();
  }

  function demoController(team) {
    var until = 0, seen = -1, delay = 0.15;
    return function (w) {
      var b = w.ball, close = false;
      for (var i = 0; i < 4; i++) {
        var p = w.players[i]; if (p.team !== team) continue;
        var dx = (b.x - p.x) * p.f;
        if (dx > -30 && dx < 160 && b.y > GROUND - 340) close = true;
      }
      if (close && seen < 0) seen = w.time;
      if (!close) seen = -1;
      if (seen >= 0 && w.time - seen > delay && w.time > until + 0.3) {
        until = w.time + 0.1 + Math.random() * 0.25; delay = 0.08 + Math.random() * 0.25;
      }
      if (!close && w.time > until + 1.2 && Math.random() < 0.005) until = w.time + 0.15;
      return w.time < until;
    };
  }

  // ---------- replay recording ----------
  // Every recorded physics step keeps what is needed to redraw it exactly: players, balls, the falling item,
  // every power-up timer (fire, shield, freeze, big, magnet), the bomb fuse and all the weather.
  // Highlights keep the same frames (see highlights.js, which must use the same layout).
  var FS = 90, RB = Math.round(16 / DT), REPLAY_LEAD = 5, REPLAY_SLOW = 0.4;
  function Recorder() { this.buf = new Float32Array(RB * FS); this.n = 0; this.goal = -1; this.shotT = -1; this.lead = 0; }
  Recorder.prototype.push = function (w) {
    var f = this.buf, o = (this.n % RB) * FS, i, p, b, fx = w.fx, hz = w.hz, it = w.item, v = G.wxv;
    f[o++] = w.time;
    for (i = 0; i < 4; i++) {
      p = w.players[i];
      f[o++] = p.x; f[o++] = p.y; f[o++] = p.a; f[o++] = p.leg; f[o++] = p.press ? 1 : 0; f[o++] = p.sc; f[o++] = p.cT; f[o++] = hz.stun[i];
    }
    for (i = 0; i < 2; i++) {
      b = w.balls[i] || w.balls[0];
      f[o++] = b.x; f[o++] = b.y; f[o++] = b.ang; f[o++] = b.vx; f[o++] = b.vy; f[o++] = b.lastTeam;
    }
    f[o++] = it.on ? (it.landed ? 2 : 1) : 0; f[o++] = it.x; f[o++] = it.y; f[o++] = ITEM_IDS.indexOf(it.type);
    f[o++] = w.arena.goalTop || 0;
    f[o++] = fx.kick[0]; f[o++] = fx.kick[1]; f[o++] = fx.shield[0]; f[o++] = fx.shield[1]; f[o++] = fx.freeze[0]; f[o++] = fx.freeze[1];
    for (i = 0; i < 4; i++) f[o++] = fx.big[i];
    f[o++] = fx.magnetT; f[o++] = fx.magnetId;
    f[o++] = w.bombT;
    f[o++] = hz.quakeT; f[o++] = hz.quakeDur; f[o++] = hz.torT; f[o++] = hz.torDur; f[o++] = hz.torX;
    for (i = 0; i < 3; i++) { var c = hz.craters[i]; f[o++] = c ? c.x : 0; f[o++] = c ? c.r : 0; f[o++] = c ? c.d : 0; f[o++] = c ? c.t : 0; }
    f[o++] = v.fog; f[o++] = v.bolt ? v.bolt.x : 0; f[o++] = v.bolt ? v.bolt.y : 0; f[o++] = v.bolt ? v.bolt.age : -1;
    f[o++] = v.warn ? v.warn.x : -1; f[o++] = v.zap; f[o++] = v.zapBall === undefined ? -1 : v.zapBall; f[o++] = v.bombGone ? 1 : 0;
    f[o++] = w.ball.lastBy[0]; f[o++] = w.ball.lastBy[1];
    this.n++;
  };
  Recorder.prototype.apply = function (w, k) { applyFrame(w, this.buf, (k % RB) * FS); };
  // puts one recorded frame (array f, starting at offset o) into world w: used by the replay and the highlights
  function applyFrame(w, f, o) {
    var i, p, b, fx = w.fx, hz = w.hz, it = w.item;
    o++; // the time
    for (i = 0; i < 4; i++) {
      p = w.players[i];
      p.x = f[o++]; p.y = f[o++]; p.a = f[o++]; p.leg = f[o++]; p.press = f[o++] > 0;
      var sc = f[o++]; if (p.sc !== sc) E.setScale(p, sc);
      p.cT = f[o++]; hz.stun[i] = f[o++];
      E.shapes(p);
    }
    for (i = 0; i < 2; i++) {
      b = w.balls[i];
      if (!b) { o += 6; continue; }
      b.x = f[o++]; b.y = f[o++]; b.ang = f[o++]; b.vx = f[o++]; b.vy = f[o++]; b.lastTeam = f[o++];
    }
    var ion = f[o++]; it.on = ion > 0; it.landed = ion > 1; it.x = f[o++]; it.y = f[o++]; it.type = ITEM_IDS[f[o++]] || '';
    var gt = f[o++]; if (w.arena.goalTop) w.arena.goalTop = gt;
    fx.kick[0] = f[o++]; fx.kick[1] = f[o++]; fx.shield[0] = f[o++]; fx.shield[1] = f[o++]; fx.freeze[0] = f[o++]; fx.freeze[1] = f[o++];
    for (i = 0; i < 4; i++) fx.big[i] = f[o++];
    fx.magnetT = f[o++]; fx.magnetId = f[o++];
    w.bombT = f[o++];
    hz.quakeT = f[o++]; hz.quakeDur = f[o++]; hz.torT = f[o++]; hz.torDur = f[o++]; hz.torX = f[o++];
    hz.craters.length = 0;
    for (i = 0; i < 3; i++) { var cx = f[o++], cr = f[o++], cd = f[o++], ct = f[o++]; if (ct > 0) hz.craters.push({ x: cx, r: cr, d: cd, t: ct }); }
    var v = G.rwxv || (G.rwxv = {});
    v.fog = f[o++];
    var bx = f[o++], by = f[o++], ba = f[o++];
    v.bolt = ba >= 0 ? { x: bx, y: by, age: ba } : null;
    var wxX = f[o++]; v.warn = wxX >= 0 ? { x: wxX } : null;
    v.zap = f[o++]; v.zapBall = f[o++]; v.bombGone = f[o++] > 0;
    w.ball.lastBy[0] = f[o++]; w.ball.lastBy[1] = f[o++];
  }
  // remember the goal frame and the moment the scoring side last touched the ball (for an own goal that is
  // the shot that hit the other side); with no such touch, the last touch by anybody
  Recorder.prototype.mark = function (w, team) {
    var b = w.balls[w.scoreBall] || w.ball;
    this.goal = this.n; this.lead = 0;
    this.shotT = b.touchT[team] >= 0 ? b.touchT[team] : Math.max(b.touchT[0], b.touchT[1]);
  };
  Recorder.prototype.timeAt = function (k) { return this.buf[(k % RB) * FS]; };
  // newest recorded frame at or before world time t (but not older than the buffer)
  Recorder.prototype.frameAt = function (t, from, to) {
    for (var k = to; k > from; k--) if (this.timeAt(k) <= t) return k;
    return from;
  };
  // recorded frames shown again for the last point (also kept as its highlight clip)
  function replayWindow() {
    var rec = G.rec, goal = rec.goal - 1, oldest = Math.max(rec.n - RB + 1, 0);
    var to = Math.min(rec.n - 1, goal + Math.round(0.8 / DT));
    var shot = rec.shotT >= 0 ? rec.frameAt(rec.shotT, oldest, goal) : goal;
    var from = rec.frameAt(rec.timeAt(shot) - (rec.lead || REPLAY_LEAD), oldest, shot);
    if (to - from < 60) return null;
    // real speed for the build-up; once the slow motion starts (just before the shot, or at most 2.5 s before
    // the ball goes in when the shot travelled for a long time) it stays slow until the end of the replay
    var slowFrom = Math.max(shot - Math.round(0.35 / DT), goal - Math.round(2.5 / DT));
    return { from: from, to: to, goal: goal, slowFrom: slowFrom };
  }
  function startReplay() {
    var r = replayWindow();
    if (!r) return false;
    G.replay = { k: r.from, from: r.from, to: r.to, goal: r.goal, acc: 0, speed: 1, slowFrom: r.slowFrom, slowTo: r.to };
    G.state = 'replay'; G.trails = [[], []]; G.flash = null;
    show(null);
    return true;
  }
  // in the replay, the moment the ball goes in gets a burst around the ball and a small label
  function goalFlash() {
    var w = G.world, b = w.balls[G.goalBall] || w.ball;
    var col = G.noPoint ? ZAP_COL : (G.mode === 'ffa' && G.credit >= 0 ? Meta.color(G.credit) : teamCol(G.scorer));
    burst(b.x, b.y, G.noPoint ? '⚡ SÉT!' : (FLASH_WORDS[w.arena.type] || 'VÀO!'), col, w.arena.P.ballR);
  }
  // rings, sparks and a short label around the ball (the moment of a goal or a save in a replay or highlight)
  function burst(x, y, txt, col, R) {
    G.flash = { x: x, y: y, t: 0, txt: txt, col: col };
    for (var i = 0; i < 3; i++) addPart(x, y, 0, 0, 0.6 + i * 0.3, i === 1 ? col.main : '#ffffff', R + 4, 0, 'ring');
    sparks(x, y, 14, '#ffd23f');
    Snd.star(0);
  }
  function skipReplay() { if (G.state === 'replay') endReplay(); }
  function endReplay() {
    G.replay = null; G.state = 'scored'; G.timer = 0; G.flash = null;
    if (matchWinner() >= 0) endMatch(); else { G.fadeDir = 1; show(null); }
  }

  // ---------- weather & disasters ----------
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function newWeather(list) {
    var wx = { list: list.slice(), timer: {}, active: {}, warn: null, bolt: null, zap: null, fog: 0, bombGone: false, strikeK: -1, strikeT: -1, rumbleT: 0 };
    list.forEach(function (id) { wx.timer[id] = rnd(WX[id].every[0], WX[id].every[1]); });
    return wx;
  }
  function anyWeather(wx) { for (var k in wx.active) return true; return !!wx.warn; }
  // a phenomenon is due: 90% it comes alone and every countdown restarts, so they don't pile up;
  // 9% one more comes with it, 0.9% two more, 0.1% all four at once
  function triggerWeather(w, first) {
    var wx = G.wx, r = Math.random(), extra = r < 0.9 ? 0 : (r < 0.99 ? 1 : (r < 0.999 ? 2 : 3));
    var others = shuffle(wx.list.filter(function (id) { return id !== first; }));
    var set = [first].concat(others.slice(0, extra)), names = [];
    set.forEach(function (id) { startPhenomenon(w, id); names.push(WX[id].icon + ' ' + WX[id].name.toUpperCase()); });
    wx.list.forEach(function (id) { wx.timer[id] = rnd(WX[id].every[0], WX[id].every[1]); });
    G.note = names.join(' + ') + '!'; G.noteT = 1.6;
  }
  function startPhenomenon(w, id) {
    var wx = G.wx;
    wx.active[id] = WX[id].dur;
    if (id === 'quake') { E.startQuake(w, WX.quake.dur); Snd.rumble(); wx.rumbleT = 1.4; }
    else if (id === 'tornado') { E.startTornado(w, Math.floor(Math.random() * 4) * W / 4 + W / 8, WX.tornado.dur); Snd.whoosh(); }
    else if (id === 'lightning') {
      // aimed at the ball or a player now and then, otherwise anywhere; it hits whatever is there when it comes down
      var r = Math.random(), x;
      if (r < 0.15) x = w.ball.x;
      else if (r < 0.4) { var act = w.players.filter(function (p) { return p.active; }); x = act[Math.floor(Math.random() * act.length)].x; }
      else x = 80 + Math.random() * (W - 160);
      wx.warn = { x: Math.max(40, Math.min(W - 40, x)), t: WARN_TIME };
    }
  }
  function doStrike(w, x) {
    var wx = G.wx, hit = E.strike(w, x), i;
    wx.bolt = { x: hit.x, y: hit.y, age: 0 };
    wx.strikeK = G.rec ? G.rec.n : -1; wx.strikeT = w.time;
    G.screenFlash = 0.7; G.shake = Math.max(G.shake, 0.6);
    Snd.thunder();
    sparks(hit.x, hit.y, 16, '#fff6a0');
    if (hit.kind === 'ground') {
      for (i = 0; i < 18; i++) addPart(x + (Math.random() - 0.5) * 90, GROUND - 4, (Math.random() - 0.5) * 500, -200 - Math.random() * 500, 0.7 + Math.random() * 0.4, w.arena.map.ground2, 5 + Math.random() * 7, 1500, 'dust');
    } else if (hit.kind === 'player') {
      G.note = '⚡ ' + whoName(hit.id) + ' bị sét đánh!'; G.noteT = 1.5;
    } else if (w.arena.type === 'bomb') {
      // the bomb goes off at once and nobody scores
      var b = w.balls[hit.id];
      Snd.explode(); explosion(b.x, b.y); G.shake = 1.4;
      w.bombT = 1e9; wx.bombGone = true; G.goalBall = hit.id;
      noPointEnd('bomb');
    } else {
      wx.zap = { t: ZAP_TIME, bi: hit.id };
      G.note = '⚡ Sét đánh trúng bóng! ' + ZAP_TIME + ' giây nữa dừng ván'; G.noteT = 2;
    }
  }
  // a round stopped by lightning: nobody scores, the strike is shown again and the same sport is played again
  function noPointEnd(reason) {
    if (G.state !== 'play') return;
    var wx = G.wx;
    if (wx.zap) G.goalBall = wx.zap.bi;
    G.scorer = -1; G.credit = -1; G.noPoint = reason; G.noteT = 0;
    hlScored(-1);
    G.word = reason === 'bomb' ? '💥 SÉT ĐÁNH TRÚNG BOM!' : '⚡ BÓNG BỊ SÉT ĐÁNH!';
    G.sub = 'Không ai được điểm';
    wx.zap = null;
    G.state = 'scored'; G.timer = 1.9; G.excite = 0.6;
    if (G.rec && wx.strikeK >= 0) { G.rec.goal = wx.strikeK + 1; G.rec.shotT = wx.strikeT; G.rec.lead = 2; }
    Snd.whistle();
  }
  // every physics step: running phenomena wear off, a bolt comes down, the next phenomenon is scheduled
  function weatherStep(w) {
    var wx = G.wx, v = G.wxv, k;
    if (!wx) return;
    for (k in wx.active) { wx.active[k] -= DT; if (wx.active[k] <= 0) delete wx.active[k]; }
    if (wx.warn) { wx.warn.t -= DT; if (wx.warn.t <= 0) { var x = wx.warn.x; wx.warn = null; doStrike(w, x); } }
    if (wx.bolt) { wx.bolt.age += DT; if (wx.bolt.age > 0.35) wx.bolt = null; }
    var f = wx.active.fog || 0;
    wx.fog = f > 0 ? Math.max(0, Math.min(1, WX.fog.dur - f, f)) : 0; // 1 s in, 1 s out
    if (wx.zap && G.state === 'play') { wx.zap.t -= DT; if (wx.zap.t <= 0) noPointEnd('zap'); }
    v.fog = wx.fog; v.bolt = wx.bolt; v.warn = wx.warn; v.zap = wx.zap ? wx.zap.t : 0; v.zapBall = wx.zap ? wx.zap.bi : -1; v.bombGone = wx.bombGone;
    if (G.state !== 'play' || anyWeather(wx)) return;
    // the countdowns only run while nothing is going on
    for (var i = 0; i < wx.list.length; i++) {
      var id = wx.list[i];
      wx.timer[id] -= DT;
      if (wx.timer[id] <= 0) { triggerWeather(w, id); break; }
    }
  }
  // every frame: shaking, flying dirt, smoke from burnt players, tornado debris
  function weatherFrame(dt) {
    var w = G.world, hz = w && w.hz, i;
    if (!hz) return;
    if (G.screenFlash > 0) G.screenFlash = Math.max(0, G.screenFlash - dt * 2.5);
    var q = E.quakeLevel(hz), col = w.arena.map.ground2, soil = ['#8a6340', '#6e4d30', '#a07a52', col];
    if (q > 0) {
      G.shake = Math.max(G.shake, 0.35 * q);
      for (i = 0; i < 3; i++) if (Math.random() < q) addPart(Math.random() * W, GROUND - 2, (Math.random() - 0.5) * 120, -250 - Math.random() * 450, 0.7 + Math.random() * 0.3, soil[i], 4 + Math.random() * 6, 1400, 'dust');
      if (G.wx && !playback()) { G.wx.rumbleT -= dt; if (G.wx.rumbleT <= 0) { G.wx.rumbleT = 1.4; Snd.rumble(); } }
    }
    for (i = 0; i < 4; i++) {
      var p = w.players[i];
      if (p.active && hz.stun[i] > 0 && Math.random() < 0.5) addPart(p.x + (Math.random() - 0.5) * 30, p.y - 60 * p.sc, (Math.random() - 0.5) * 30, -70 - Math.random() * 60, 0.9, 'rgba(60,60,60,0.55)', 7 + Math.random() * 7, -30, 'smoke');
    }
    if (hz.torT > 0 && Math.random() < 0.7) {
      var a = Math.random() * TAU, rr = 40 + Math.random() * E.TOR_R;
      addPart(hz.torX + Math.cos(a) * rr * 0.6, GROUND - 40 - Math.random() * 450, -Math.sin(a) * 500, -150 - Math.random() * 200, 0.6, Math.random() < 0.5 ? '#8a8f99' : col, 3 + Math.random() * 4, 0, 'dust');
    }
  }

  // ---------- highlights: saves and clips ----------
  // A save: the ball on its own would score for one side within SAVE_LOOK seconds, then a player of the other side
  // turns it away with foot, head or body, SAVE_CONFIRM seconds later it is still not going in, and
  //  - that player did something: his button was pressed (jump, kick, header, dive) at most SAVE_ACTIVE seconds before
  //    the touch; a ball that just hits someone standing still, or a shield, is no save,
  //  - it happened in his own half.
  // Saves by the same side less than SAVE_CHAIN seconds apart make one bigger save, which is always kept; of the
  // single saves the most dangerous third is kept. Every point, and every round stopped by lightning, is kept too.
  var SAVE_LOOK = 1, SAVE_CONFIRM = 0.25, SAVE_CHAIN = 3, SAVE_ACTIVE = 0.6, CLIP_PRE = 3, CLIP_POST = 1.5;
  var ZAP_COL = { main: '#ffd23f', dark: '#c4a612' };
  function newWatch() { return { tick: 0, threat: [null, null], cand: [], group: null, seen: [[-1, -1], [-1, -1]], miss: [] }; }
  function watchSaves(w) {
    var S = G.hlw, A = w.arena, ev = w.events, i;
    if (A.type === 'bomb') return;
    // a shot hitting the frame (post, bar, rim, board) makes a better miss
    for (i = 0; i < ev.length; i++) if (ev[i].t === 'post') S.miss.forEach(function (m) { if (w.time >= m.shot && w.time <= m.at + 0.3) m.post = true; });
    if (++S.tick % 2) return; // 60 looks a second are plenty
    for (var bi = 0; bi < w.balls.length && bi < 2; bi++) {
      var b = w.balls[bi], th = S.threat[bi], fut = E.ballFuture(A, b, SAVE_LOOK);
      if (A.type !== 'volley') lookForMiss(w, S, bi, b, fut);
      if (fut) {
        var att = fut.team, back = null;
        // going in again: the touch a moment ago saved nothing
        S.cand = S.cand.filter(function (c) { if (c.bi === bi && c.att === att) { back = c.th; return false; } return true; });
        if (!th && back) th = S.threat[bi] = back;
        if (!th || th.att !== att) th = S.threat[bi] = { att: att, since: w.time, shot: b.touchT[att], danger: 0 };
        th.seen = w.time; th.danger = Math.max(th.danger, 1 - fut.t / SAVE_LOOK);
        if (b.touchT[att] > th.shot) th.shot = b.touchT[att];
        // a shot on target: the attacking side's touch just now sent it goalwards (one per touch, dribbling counts once)
        if (b.lastTeam === att && b.touchT[att] >= w.time - 0.5 && b.touchT[att] - (th.counted || -9) > 0.5) { th.counted = b.touchT[att]; statAdd(b.lastBy[att], 'shots'); }
        continue;
      }
      if (!th) continue;
      S.threat[bi] = null;
      var def = 1 - th.att, t = b.touchT[def], by = b.lastTeam === def ? b.lastPid : -1;
      if (by < 0 || t < Math.max(th.since, th.seen - 0.1)) continue; // not turned away by a defender
      if (G.pressT[by] < t - SAVE_ACTIVE) continue; // he was just standing there
      if (def === 0 ? b.lastX > W / 2 : b.lastX < W / 2) continue; // not in his own half
      S.cand.push({ bi: bi, att: th.att, def: def, t: t, by: by, shot: th.shot >= th.since - 3 ? th.shot : th.since, danger: th.danger, th: th });
    }
    for (i = S.cand.length - 1; i >= 0; i--) if (w.time - S.cand[i].t >= SAVE_CONFIRM) addSave(S.cand.splice(i, 1)[0]);
    if (S.group && w.time - S.group.last > SAVE_CHAIN) closeGroup(true);
    for (i = S.miss.length - 1; i >= 0; i--) {
      var m = S.miss[i], mb = w.balls[m.bi], lastTouch = Math.max(mb.touchT[0], mb.touchT[1]);
      if (w.time <= m.at + 0.05 && lastTouch > m.shot + 0.1) S.miss.splice(i, 1); // blocked, or played on, before it got there
      else if (w.time >= m.at + CLIP_POST) fileMiss(S.miss.splice(i, 1)[0]);
    }
  }

  // A near miss: just after a shot the ball on its own goes in nowhere, but the same shot a little stronger, weaker,
  // higher or lower would have scored, whatever the sport (past the post, over the bar, off the rim). Nobody may touch
  // it before it gets there. How good a miss it was: how small a change would have scored, hitting the frame,
  // a long shot, a shot in the air, the power. The best fifth of a match's misses go into its highlight.
  var MISS_LOOK = 1.5, MISS_SPEED = 500, MISS_SHARE = 0.2;
  // [power, angle change in radians]
  var MISS_TRY = [[1, -0.015], [1, 0.015], [0.975, 0], [1.025, 0], [1, -0.03], [1, 0.03], [0.95, 0], [1.05, 0],
    [1, -0.06], [1, 0.06], [0.9, 0], [1.1, 0], [0.95, -0.03], [0.95, 0.03], [1.05, -0.03], [1.05, 0.03]];
  var probe = { x: 0, y: 0, vx: 0, vy: 0, ang: 0, spin: 0 };
  function lookForMiss(w, S, bi, b, fut) {
    var A = w.arena;
    for (var team = 0; team < 2; team++) {
      if (b.touchT[team] <= S.seen[bi][team]) continue;
      S.seen[bi][team] = b.touchT[team];
      var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (b.lastTeam !== team || sp < MISS_SPEED || fut || E.ballFuture(A, b, MISS_LOOK)) continue; // no shot, or going in
      var dir = Math.atan2(b.vy, b.vx), best = null;
      for (var i = 0; i < MISS_TRY.length; i++) {
        var v = MISS_TRY[i], a = dir + v[1];
        probe.x = b.x; probe.y = b.y; probe.vx = Math.cos(a) * sp * v[0]; probe.vy = Math.sin(a) * sp * v[0]; probe.ang = b.ang; probe.spin = b.spin;
        var f = E.ballFuture(A, probe, MISS_LOOK);
        if (!f || f.team !== team) continue;
        var close = 1 - 0.5 * (Math.abs(v[0] - 1) / 0.1 + Math.abs(v[1]) / 0.06); // 1: the tiniest change would have scored
        if (!best || close > best.close) best = { close: close, t: f.t };
      }
      if (!best) continue;
      S.miss = S.miss.filter(function (m) { return m.bi !== bi; }); // a newer shot with the same ball replaces it
      S.miss.push({ bi: bi, team: team, by: b.lastPid, shot: b.touchT[team], at: w.time + best.t, close: best.close,
        far: Math.abs((team === 0 ? W : 0) - b.x) > 700, air: b.lastAir, sp: sp, post: false });
    }
  }
  function fileMiss(m) {
    var rec = G.rec, r = recRange();
    var beauty = m.close + (m.post ? 0.25 : 0) + (m.far ? 0.2 : 0) + (m.air ? 0.15 : 0) + 0.2 * Math.min(1, m.sp / 1800);
    var from = rec.frameAt(Math.max(m.shot, m.at - 3) - CLIP_PRE, r.oldest, r.newest);
    var clip = makeClip(from, rec.frameAt(m.at + CLIP_POST, from, r.newest), [{ t: m.at, kind: 'miss', bi: m.bi, by: m.by, team: m.team, beauty: beauty }],
      [[Math.max(m.shot - 0.35, m.at - 1.2), m.at + 0.6]], {});
    if (clip) fileClip(clip);
  }
  // a finished save or miss clip goes into its list. One that took in a save counts as a save: two saves or more
  // are always kept, of the single ones the most dangerous third; of the misses the best fifth.
  function fileClip(clip) {
    var saves = clip.marks.filter(function (m) { return m.kind === 'save'; }), misses = clip.marks.filter(function (m) { return m.kind === 'miss'; });
    var list = saves.length ? saves : misses, by = [];
    list.forEach(function (m) { if (by.indexOf(m.by) < 0) by.push(m.by); });
    clip.by = by; clip.name = playerNames(by); clip.team = list[list.length - 1].team;
    if (saves.length) {
      clip.kind = 'save'; clip.n = saves.length;
      clip.danger = saves.reduce(function (a, m) { return a + (m.danger || 0.5); }, 0);
      (clip.n > 1 ? G.hlm.clips : G.hlm.singles).push(clip);
    } else {
      clip.kind = 'miss'; clip.n = misses.length;
      clip.beauty = Math.max.apply(null, misses.map(function (m) { return m.beauty || 0; }));
      G.hlm.misses.push(clip);
    }
  }
  function addSave(s) {
    var S = G.hlw, g = S.group;
    statAdd(s.by, 'saves');
    if (g && g.def === s.def && s.t - g.last <= SAVE_CHAIN) { g.saves.push(s); g.last = s.t; return; }
    closeGroup(true);
    S.group = { def: s.def, saves: [s], last: s.t };
  }
  // a run of saves is over: from 3 s before the first shot to 1.5 s after the last save, slowed around each save
  function closeGroup(keep) {
    var S = G.hlw, g = S && S.group;
    if (!g) return;
    S.group = null;
    if (!keep || !G.hlm) return;
    var rec = G.rec, r = recRange(), first = g.saves[0], last = g.saves[g.saves.length - 1];
    var from = rec.frameAt(Math.max(first.shot, first.t - 3) - CLIP_PRE, r.oldest, r.newest);
    var clip = makeClip(from, rec.frameAt(last.t + CLIP_POST, from, r.newest),
      g.saves.map(function (s) { return { t: s.t, kind: 'save', bi: s.bi, by: s.by, team: s.def, danger: s.danger }; }),
      g.saves.map(function (s) { return [Math.max(Math.max(s.shot, s.t - 3) - 0.35, s.t - 1), s.t + 0.6]; }), {});
    if (clip) fileClip(clip); // it may have taken in an earlier clip it overlapped
  }
  function recRange() { var n = G.rec.n; return { oldest: Math.max(n - RB + 1, 0), newest: n - 1 }; }
  function clipLen(c) { return c.frames.length / FS / HL.RATE; }
  // recorded frames [from, to] as a clip; marks and slow-motion spans are given in world time.
  // Earlier clips of this round that reach into it (a save, then the counter-attack goal) are merged into it,
  // so the same moment never shows up twice in a highlight.
  function makeClip(from, to, marks, slow, meta) {
    var rec = G.rec, oldest = recRange().oldest;
    if (to - from < 60) return null;
    [G.hlm.clips, G.hlm.singles, G.hlm.misses].forEach(function (list) {
      for (var i = list.length - 1; i >= 0; i--) {
        var c = list[i];
        if (c.round !== G.round || c.t + clipLen(c) < rec.timeAt(from) - 0.3) continue;
        list.splice(i, 1);
        c.marks.forEach(function (m) { marks.push(Object.assign({}, m, { t: c.t + m.t })); });
        c.slow.forEach(function (q) { slow.push([c.t + q[0], c.t + q[1]]); });
        if (c.t < rec.timeAt(from)) from = rec.frameAt(c.t, oldest, from);
      }
    });
    marks.sort(function (a, b) { return a.t - b.t; });
    var base = rec.timeAt(from), rel = function (t) { return Math.round((t - base) * 1000) / 1000; };
    return Object.assign({
      frames: HL.encode(rec.buf, RB, from, to), map: G.world.arena.map.id, mods: G.roundMods || {}, swap: is4(G.mode) && G.round % 2 === 0,
      round: G.round, t: base,
      marks: marks.map(function (m) { return { t: rel(m.t), kind: m.kind, bi: m.bi, by: m.by, team: m.team, danger: m.danger, beauty: m.beauty }; }),
      slow: slow.map(function (q) { return [rel(q[0]), rel(q[1])]; })
    }, meta);
  }
  // the point just scored (or the round stopped by lightning), the same stretch as its replay
  function captureGoalClip() {
    if (!G.hlm || G.clipDone || !G.rec || G.rec.goal <= 0) return;
    G.clipDone = true;
    var r = replayWindow(), rec = G.rec;
    if (!r) return;
    var kind = G.noPoint ? 'zap' : 'goal';
    var clip = makeClip(r.from, r.to, [{ t: rec.timeAt(r.goal), kind: kind, bi: G.goalBall || 0 }], [[rec.timeAt(r.slowFrom), rec.timeAt(r.to) + 1]], {
      kind: kind, team: G.scorer, credit: G.credit, word: G.word, sub: G.sub, score: G.score.slice(), name: G.noPoint ? '' : scorerName(G.scorer, G.credit) });
    if (clip) G.hlm.clips.push(clip);
  }
  // a point was scored (team) or the round was stopped (-1): saves are settled and the round's watching ends
  function hlScored(team) {
    var S = G.hlw;
    if (!S) return;
    S.cand.forEach(function (c) { if (c.att !== team) addSave(c); }); // a touch just before the ball went in saved nothing
    S.cand = []; S.threat = [null, null];
    S.miss.forEach(function (m) { if (G.world.time >= m.at) fileMiss(m); }); // one not there yet went in after all
    S.miss = [];
    var g = S.group;
    // saves made just before the same side conceded were not enough
    if (g) closeGroup(!(team >= 0 && g.def === 1 - team && G.world.time - g.last < SAVE_CHAIN));
    G.hlw = null;
  }
  function finishHighlights() {
    if (G.hlw) {
      G.hlw.miss.forEach(function (m) { if (G.world.time >= m.at) fileMiss(m); });
      closeGroup(true); G.hlw = null;
    }
    var H = G.hlm;
    G.hlm = null;
    if (!H) return null;
    var singles = H.singles.slice().sort(function (a, b) { return b.danger - a.danger; });
    var misses = H.misses.slice().sort(function (a, b) { return b.beauty - a.beauty; }); // best miss first
    var clips = H.clips.concat(singles.slice(0, singles.length ? Math.max(1, Math.round(singles.length / 3)) : 0),
      misses.slice(0, Math.ceil(misses.length * MISS_SHARE)));
    clips.sort(function (a, b) { return a.round - b.round || a.t - b.t; });
    return clips.length ? clips : null;
  }
  function scorerName(team, credit) {
    if (G.mode === 'ffa') return credit >= 0 ? nameOf(credit) : '';
    if (G.mode === 'team4') return team === 0 ? nameOf(0) + ' + ' + nameOf(1) : nameOf(2) + ' + ' + nameOf(3);
    if (soloish(G.mode)) return team === 0 ? nameOf(0) : 'Bot';
    return nameOf(team);
  }
  function playerNames(by) {
    var out = [];
    by.forEach(function (id) { var n = id >= 0 ? whoName(id) : '🛡️'; if (out.indexOf(n) < 0) out.push(n); });
    return out.join(' + ');
  }

  // ---------- player stats of a match, rating and MVP ----------
  // "player" = a person: each side in 2-player and bot matches (one button moves both bodies), each slot with 4 players
  function personOf(id) { return is4(G.mode) ? id : slotTeam(id); }
  function personName(i) { return is4(G.mode) ? nameOf(i) + (G.bots[i] ? ' 🤖' : '') : (G.mode === 'bot' && i === 1 ? 'Bot' : nameOf(i)); }
  function newStats() {
    var out = [];
    for (var i = 0; i < (is4(G.mode) ? 4 : 2); i++) out.push({ goals: 0, saves: 0, shots: 0, touches: 0, own: 0 });
    return out;
  }
  function statAdd(id, key) { if (G.ps && id >= 0 && id < 4) G.ps[personOf(id)][key]++; }
  // touches: kicks, headers and body hits; a player keeping the ball against him counts once
  function countTouches(w) {
    for (var i = 0; i < w.events.length; i++) {
      var e = w.events[i];
      if ((e.t !== 'kick' && e.t !== 'head' && e.t !== 'body') || !(e.id >= 0)) continue;
      if (w.time - G.psT[e.id] > 0.25) statAdd(e.id, 'touches');
      G.psT[e.id] = w.time;
    }
  }
  // 6.0 for an ordinary match. The result and the score margin weigh most (losing 1–6 ends far under 6),
  // then goals, saves, shots on target and touches; own goals cost a lot. Range 3.0–10.0.
  function rate(st, result, margin) {
    var d = 0.6 * st.goals + 0.4 * st.saves + 0.08 * st.shots + 0.01 * Math.min(st.touches, 40) - 0.45 * st.own +
      (result > 0 ? 0.6 : (result < 0 ? -1.2 : 0)) + Math.max(-1.8, Math.min(1.8, 0.3 * margin));
    var r = d >= 0 ? 6 + 4 * Math.tanh(d / 4) : 6 + 3 * Math.tanh(d / 2.5);
    return Math.round(Math.max(3, Math.min(10, r)) * 10) / 10;
  }
  // own (side's) score minus the opponent's; with 4 separate players, minus the best of the others
  function marginOf(i) {
    var s = G.score;
    if (G.mode === 'ffa') { var best = -1e9; for (var j = 0; j < 4; j++) if (j !== i) best = Math.max(best, s[j]); return s[i] - best; }
    if (G.mode === 'team4') return slotTeam(i) === 0 ? s[0] - s[2] : s[2] - s[0];
    return i === 0 ? s[0] - s[1] : s[1] - s[0];
  }
  // winner: as matchWinner() gives it (side, or slot with 4 players)
  function matchStats(winner, draw) {
    if (!G.ps) return null;
    var list = G.ps.map(function (st, i) {
      var won = G.mode === 'team4' ? slotTeam(i) === slotTeam(winner) : i === winner;
      return { n: personName(i), g: st.goals, s: st.saves, sh: st.shots, t: st.touches, o: st.own, r: rate(st, draw ? 0 : (won ? 1 : -1), marginOf(i)), win: !draw && won };
    });
    var mvp = 0;
    list.forEach(function (x, i) {
      var m = list[mvp];
      if (x.r > m.r || (x.r === m.r && (x.g > m.g || (x.g === m.g && (x.s > m.s || (x.s === m.s && x.win && !m.win)))))) mvp = i;
    });
    return { list: list, mvp: mvp };
  }
  function fmtRating(r) { return r.toFixed(1).replace('.', ','); }
  // the table of a match's player stats (end of match screen and history)
  function statsTable(ms, mode) {
    var box = el('div', 'pstats'), own = ms.list.some(function (x) { return x.o > 0; });
    var cols = [['⚽', 'g', 'Bàn thắng'], ['🧤', 's', 'Cứu thua'], ['🎯', 'sh', 'Sút trúng đích'], ['👟', 't', 'Chạm bóng']];
    if (own) cols.push(['😬', 'o', 'Phản lưới']);
    cols.push(['⭐', 'r', 'Điểm (rating)']);
    box.style.gridTemplateColumns = 'minmax(0, 1fr) repeat(' + cols.length + ', auto)';
    box.appendChild(el('span', 'ph', ''));
    cols.forEach(function (c) { var h = el('span', 'ph', c[0]); h.title = c[2]; box.appendChild(h); });
    ms.list.forEach(function (x, i) {
      var mvp = i === ms.mvp, nm = el('span', 'pn' + (mvp ? ' mvp' : ''), (mvp ? '🏅 ' : '') + x.n);
      nm.style.color = textCol(mode === 'ffa' ? Meta.color(i) : teamCol(mode === 'team4' ? slotTeam(i) : i));
      box.appendChild(nm);
      cols.forEach(function (c) { box.appendChild(el('span', 'pv' + (mvp ? ' mvp' : '') + (c[1] === 'r' ? ' pr' : ''), c[1] === 'r' ? fmtRating(x.r) : String(x[c[1]]))); });
    });
    var foot = el('div', 'pmvp', '🏅 MVP: ' + ms.list[ms.mvp].n + ' · ⭐ ' + fmtRating(ms.list[ms.mvp].r));
    var wrap = el('div', 'pwrap'); wrap.appendChild(box); wrap.appendChild(foot);
    return wrap;
  }

  // ---------- highlight player ----------
  // from: 'over' (just after the match) or 'history'; exporting: a video of it is being recorded
  function playHighlight(hl, from, exporting) {
    G.hlp = { hl: hl, from: from, exporting: !!exporting, ci: -1, k: 0, n: 0, speed: 1, hold: 0, c: null, f: new Float32Array(FS),
      back: { world: G.world, looks: G.looks }, elapsed: 0, total: hlDuration(hl) };
    G.looks = hl.match.looks; G.demo = false; G.shake = 0; G.excite = 0; G.noteT = 0;
    Snd.setCrowd(false);
    G.state = 'highlight';
    loadClip(0);
    G.fade = 1; G.fadeDir = -1;
    show(null);
  }
  function loadClip(ci) {
    var h = G.hlp, c = h.hl.clips[ci], w = E.createWorld(c.map, h.hl.match.settings, 1, c.mods || {});
    if (c.swap) for (var i = 0; i < 4; i++) w.players[i].role = 1 - w.players[i].role;
    h.ci = ci; h.c = c; h.k = 0; h.n = c.frames.length / FS; h.speed = inSlow(c, 0) ? REPLAY_SLOW : 1; h.hold = 0;
    G.world = w; G.trails = [[], []]; G.flash = null; G.rwxv = null; G.parts.length = 0;
    HL.frameAt(c.frames, 0, h.f); applyFrame(w, h.f, 0);
  }
  function inSlow(c, t) { for (var i = 0; i < c.slow.length; i++) if (t >= c.slow[i][0] && t <= c.slow[i][1]) return true; return false; }
  // seconds the whole highlight takes to play (for the export's progress)
  function hlDuration(hl) {
    var total = 0;
    hl.clips.forEach(function (c) {
      var len = c.frames.length / FS / HL.RATE;
      for (var t = 0; t < len; t += 0.05) total += inSlow(c, t) ? 0.05 / REPLAY_SLOW : 0.05;
      total += 1.1; // pause at the end and fades
    });
    return total;
  }
  function highlightStep(dt) {
    var h = G.hlp, c = h.c, t0 = h.k / HL.RATE;
    h.elapsed += dt;
    h.speed += ((inSlow(c, t0) ? REPLAY_SLOW : 1) - h.speed) * Math.min(1, dt * 8);
    h.k = Math.min(h.n - 1, h.k + dt * h.speed * HL.RATE);
    HL.frameAt(c.frames, h.k, h.f); applyFrame(G.world, h.f, 0);
    var t1 = h.k / HL.RATE;
    c.marks.forEach(function (m) { if (t0 < m.t && t1 >= m.t) hlFlash(m); });
    for (var bi = 0; bi < G.world.balls.length && bi < 2; bi++) { var tr = G.trails[bi]; tr.push(G.world.balls[bi].x, G.world.balls[bi].y); if (tr.length > 20) tr.splice(0, 2); }
    if (h.k >= h.n - 1) { h.hold += dt; if (h.hold > 0.5) hlNext(); }
    if (h.exporting) exportProgress(h.elapsed / h.total);
  }
  function hlFlash(m) {
    var w = G.world, c = G.hlp.c, b = w.balls[m.bi] || w.ball, col, txt;
    if (m.kind === 'save') {
      // each save in the colours of whoever made it (highlights kept by v2.5 only know the clip's first saver)
      var by = m.by !== undefined ? m.by : (c.by ? c.by[0] : -1), team = m.team !== undefined ? m.team : c.team;
      txt = '🧤 CỨU THUA!'; col = by >= 0 ? G.looks.p[by].col : teamCol(team);
    }
    else if (m.kind === 'zap') { txt = '⚡ SÉT!'; col = ZAP_COL; }
    else if (m.kind === 'miss') { txt = '😱 SUÝT VÀO!'; col = m.by >= 0 ? G.looks.p[m.by].col : teamCol(m.team); }
    else { txt = FLASH_WORDS[w.arena.type] || 'VÀO!'; col = G.looks.ffa && c.credit >= 0 ? G.looks.p[c.credit].col : teamCol(c.team); }
    burst(b.x, b.y, txt, col, w.arena.P.ballR);
  }
  function hlNext() { if (G.state === 'highlight' && !G.fadeDir) G.fadeDir = 1; }
  // called when the screen has faded out
  function hlAdvance() {
    var h = G.hlp;
    if (h.ci + 1 < h.hl.clips.length) { loadClip(h.ci + 1); G.fadeDir = -1; }
    else endHighlight();
  }
  function endHighlight() {
    var h = G.hlp;
    if (!h) return;
    G.hlp = null; G.flash = null; G.rwxv = null; G.parts.length = 0; G.trails = [[], []];
    if (h.from === 'over') { G.world = h.back.world; G.looks = h.back.looks; G.demo = false; G.state = 'over'; show('over'); }
    else { G.state = 'menu'; startDemo(); buildHistory(); show('history'); }
    G.fade = 1; G.fadeDir = -1;
    if (h.onEnd) h.onEnd();
  }
  function closeHighlight() {
    if (G.exportJob) G.exportJob.cancel(); else endHighlight();
  }
  function scoreText(s, mode) { return mode === 'ffa' ? s.join(' · ') : (mode === 'team4' ? s[0] + ' – ' + s[2] : s[0] + ' – ' + s[1]); }
  function clipTitle(c) {
    var icon = E.MAP_BY_ID[c.map] ? E.MAP_BY_ID[c.map].icon + ' ' : '';
    if (c.kind === 'save') return '🧤 ' + (c.n > 1 ? 'Cứu thua liên tiếp ×' + c.n : 'Cứu thua') + (c.name ? ' · ' + c.name : '');
    if (c.kind === 'zap') return icon + '⚡ Không ai được điểm';
    if (c.kind === 'miss') return '😱 Suýt vào' + (c.name ? ' · ' + c.name : '');
    return icon + (c.name ? c.name + ' · ' : '') + scoreText(c.score, G.hlp.hl.match.mode);
  }
  function drawHighlightHUD(c, u, cx) {
    var v = view, h = G.hlp, cl = h.c, N = h.hl.clips.length, pad = 3 * u;
    replayBars(c, u);
    var ty = barTextY(u), by = v.ch - ty;
    // top bar: which clip, what it is, the match's MVP (the ✖ button sits at its right end)
    var lw = barText(c, '🎬 HIGHLIGHT ' + (h.ci + 1) + '/' + N, pad, ty, 3.8 * u, '#ff5050', 'left');
    var right = v.cw - pad - (h.exporting ? 0 : Math.max(30, 8 * u) + 2 * u), mvp = h.hl.match.mvp;
    var rw = mvp ? barText(c, '🏅 MVP: ' + mvp.n + ' · ⭐ ' + fmtRating(mvp.r), right, ty, 3.2 * u, '#ffd23f', 'right') : 0;
    barText(c, clipTitle(cl), cx, ty, 3.8 * u, '#ffffff', 'center', v.cw - 2 * Math.max(pad + lw, v.cw - right + rw) - 4 * u);
    // bottom bar: slow motion, the moment or the commentary, what a tap does
    var tip = h.exporting ? 'BALLGAMES PHYSICS' : (h.ci + 1 < N ? 'Chạm để xem pha tiếp ⏭' : 'Chạm để kết thúc ⏹');
    var tw = barText(c, tip, v.cw - pad, by, 3.2 * u, '#ffffff', 'right');
    if (h.speed < 0.7) barText(c, SLOW_TXT, pad, by, 3.4 * u, '#ffd23f', 'left');
    var head = cl.kind === 'goal' ? (cl.sub || cl.word) : (cl.kind === 'zap' ? cl.word : '');
    barMiddle(c, u, by, head, v.cw - 2 * (Math.max(textW(SLOW_TXT, 3.4 * u), tw) + pad) - 4 * u);
  }

  // ---------- time up with the score level: draw, or golden goal? ----------
  // every human player votes; the golden goal is played when at least as many want it as want the draw
  function voters() {
    if (G.mode === 'bot') return [0];
    if (G.mode === '2p') return [0, 1];
    return [0, 1, 2, 3].filter(function (i) { return !G.bots[i]; });
  }
  function voterCol(id) { return G.mode === 'ffa' ? Meta.color(id) : teamCol(G.mode === '2p' ? id : slotTeam(id)); }
  function scoreHtml() {
    if (G.mode === 'ffa') return [0, 1, 2, 3].map(function (i) { return scoreSpan(Meta.color(i), esc(nameOf(i)) + ': ' + G.score[i]); }).join(' · ');
    if (G.mode === 'team4') return '<span class="r">' + esc(nameOf(0) + '+' + nameOf(1)) + ' ' + G.score[0] + '</span> – <span class="b">' + G.score[2] + ' ' + esc(nameOf(2) + '+' + nameOf(3)) + '</span>';
    if (G.mode === '2p') return '<span class="r">' + G.score[0] + '</span> – <span class="b">' + G.score[1] + '</span>';
    return scoreSpan(teamCol(0), G.score[0]) + ' – ' + scoreSpan(teamCol(1), G.score[1]);
  }
  function startVote() {
    G.state = 'vote'; G.votes = {}; G.voteDone = false; clearInput();
    var ids = voters(), box = $('voteRows');
    box.innerHTML = '';
    $('voteScore').innerHTML = scoreHtml();
    $('voteHint').textContent = ids.length > 1
      ? 'Mỗi người chọn: hoà luôn, hay đá tiếp bàn thắng vàng (ai ghi trước thắng)? Nếu số người chọn bàn vàng nhiều hơn hoặc bằng số người chọn hoà thì đá tiếp.'
      : 'Bạn muốn hoà luôn, hay đá tiếp bàn thắng vàng (ai ghi trước thắng)?';
    ids.forEach(function (id) {
      var row = document.createElement('div'); row.className = 'voteRow';
      if (ids.length > 1) {
        var nm = document.createElement('span'); nm.className = 'voteName'; nm.textContent = nameOf(id); nm.style.color = textCol(voterCol(id));
        row.appendChild(nm);
      }
      [['draw', '🤝 Hoà'], ['gold', '⭐ Bàn vàng']].forEach(function (o) {
        var b = document.createElement('button'); b.className = 'btn voteBtn'; b.textContent = o[1]; b.dataset.v = o[0];
        b.addEventListener('click', function () {
          if (G.voteDone) return;
          G.votes[id] = o[0]; Snd.click();
          Array.prototype.forEach.call(row.querySelectorAll('.voteBtn'), function (x) { x.classList.toggle('on', x.dataset.v === o[0]); });
          checkVote();
        });
        row.appendChild(b);
      });
      box.appendChild(row);
    });
    $('voteTally').textContent = '';
    show('vote');
  }
  function checkVote() {
    var ids = voters(), gold = 0, draw = 0;
    ids.forEach(function (id) { if (G.votes[id] === 'gold') gold++; else if (G.votes[id] === 'draw') draw++; });
    var left = ids.length - gold - draw;
    if (ids.length > 1) $('voteTally').textContent = '⭐ Bàn vàng: ' + gold + ' · 🤝 Hoà: ' + draw + (left ? ' · còn ' + left + ' người chưa chọn' : '');
    if (left) return;
    G.voteDone = true;
    setTimeout(function () {
      if (G.state !== 'vote') return;
      if (gold >= draw) {
        G.golden = true; G.state = 'play'; show(null);
        G.note = '⭐ BÀN VÀNG! Ai ghi trước thắng'; G.noteT = 2.4; Snd.whistle();
      } else endMatch(true);
    }, ids.length > 1 ? 900 : 150);
  }

  // ---------- dialogs & small messages ----------
  var dlg = null;
  function esc(t) { return String(t).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }
  // buttons: [[label, value, class]]; the back button (or Esc) answers `cancel`, or does nothing when it is undefined
  function dialog(title, body, buttons, cancel) {
    return new Promise(function (res) {
      $('dlgTitle').textContent = title;
      var bd = $('dlgBody'), bt = $('dlgBtns');
      bd.innerHTML = ''; bt.innerHTML = '';
      if (typeof body === 'string') { var p = document.createElement('p'); p.textContent = body; bd.appendChild(p); }
      else if (body) bd.appendChild(body);
      function close(v) { $('dialog').classList.add('hidden'); dlg = null; res(v); }
      buttons.forEach(function (x) {
        var e = document.createElement('button'); e.className = 'btn ' + (x[2] || ''); e.textContent = x[0];
        e.addEventListener('click', function () { Snd.click(); close(x[1]); });
        bt.appendChild(e);
      });
      dlg = { close: close, cancel: cancel };
      $('dialog').classList.remove('hidden');
    });
  }
  var toastT = 0;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.add('hidden'); }, 4000);
  }
  // sizes: KB below 1 MB, then MB with one decimal (Vietnamese decimal comma)
  function fmtMB(b) { if (!b) return '0 KB'; return b < 1048576 ? Math.max(1, Math.round(b / 1024)) + ' KB' : (b / 1048576).toFixed(1).replace('.', ',') + ' MB'; }

  // ---------- keeping highlights: the choice asked once, changeable in the settings ----------
  var POLICY = [['all', '💾 Lưu tất cả'], ['last', '🔢 Chỉ lưu'], ['none', '🚫 Không lưu']], policyN = 0;
  function policyBox(onChange) {
    var box = document.createElement('div'), name = 'policy' + (++policyN), cur = { mode: prefs.hlMode, keep: prefs.hlKeep }, radios = {}, num;
    box.className = 'policy';
    function changed() { if (onChange) onChange({ mode: cur.mode, keep: cur.keep }); }
    POLICY.forEach(function (o) {
      var lab = document.createElement('label'); lab.className = 'radio';
      var r = document.createElement('input'); r.type = 'radio'; r.name = name; r.value = o[0];
      radios[o[0]] = r;
      lab.appendChild(r); lab.appendChild(document.createTextNode(o[1]));
      r.addEventListener('change', function () { if (r.checked) { cur.mode = o[0]; changed(); } });
      if (o[0] === 'last') {
        num = document.createElement('input'); num.type = 'number'; num.className = 'num'; num.min = 1; num.max = 100; num.step = 1; num.inputMode = 'numeric';
        lab.appendChild(document.createTextNode(' ')); lab.appendChild(num); lab.appendChild(document.createTextNode(' trận gần nhất'));
        num.addEventListener('change', function () {
          var v = parseFloat(num.value);
          if (!isFinite(v)) { num.value = cur.keep; return; }
          cur.keep = clampNum(v, 1, 100, 1); num.value = cur.keep;
          if (!r.checked) { r.checked = true; cur.mode = 'last'; }
          changed();
        });
      }
      box.appendChild(lab);
    });
    function set(p) { cur.mode = p.mode; cur.keep = p.keep; for (var k in radios) radios[k].checked = k === p.mode; num.value = p.keep; }
    set(cur);
    return { el: box, get: function () { return { mode: cur.mode, keep: cur.keep }; }, set: set };
  }
  function askPolicy() {
    var pb = policyBox(null), body = document.createElement('div'), note = document.createElement('p');
    body.appendChild(pb.el);
    note.className = 'hint';
    note.textContent = 'Bạn có thể đổi lựa chọn này bất cứ lúc nào trong ⚙️ Cài đặt.' + (HL.isApp ? '' : ' Trên bản web, highlight được lưu trong trình duyệt này.');
    body.appendChild(note);
    return dialog('Lưu highlight các trận đấu? (mỗi trận khoảng 0,05–0,2 MB)', body, [['✔ Xong', 1, 'green']]).then(function () {
      var p = pb.get();
      prefs.hlMode = p.mode; prefs.hlKeep = p.keep; prefs.hlAsked = true; savePrefs();
    });
  }
  var setPolicy = null;
  function buildHLSettings() {
    var host = $('hlPolicy');
    host.innerHTML = '';
    setPolicy = policyBox(applyPolicy);
    host.appendChild(setPolicy.el);
    refreshUsage();
  }
  function refreshUsage() {
    var u = HL.usage();
    $('hlUsage').textContent = 'Highlight đang dùng: ' + fmtMB(u.bytes) + ' (' + u.count + ' trận)';
    $('hlClearAll').disabled = !u.count && !HL.history().length;
  }
  // a new choice in the settings: highlights it would delete are confirmed first
  function applyPolicy(p) {
    var list = HL.withHL(), drop = p.mode === 'none' ? list : (p.mode === 'last' ? list.slice(p.keep) : []);
    function commit() {
      prefs.hlMode = p.mode; prefs.hlKeep = p.keep; prefs.hlAsked = true; savePrefs();
      return HL.enforce(p.mode === 'none' ? 0 : (p.mode === 'last' ? p.keep : Infinity)).then(refreshUsage);
    }
    if (!drop.length) { commit(); return; }
    var mb = fmtMB(drop.reduce(function (a, r) { return a + r.hl.bytes; }, 0));
    var msg = p.mode === 'none' ? 'Highlight của tất cả ' + drop.length + ' trận đã lưu (' + mb + ') sẽ bị xoá.'
      : 'Highlight của ' + drop.length + ' trận cũ nhất (' + mb + ') sẽ bị xoá, chỉ giữ ' + p.keep + ' trận gần nhất.';
    dialog('Xoá bớt highlight?', msg + ' Lịch sử trận đấu vẫn được giữ.', [['Huỷ', false], ['🗑️ Xoá', true, 'red']], false).then(function (ok) {
      if (ok) commit(); else setPolicy.set({ mode: prefs.hlMode, keep: prefs.hlKeep });
    });
  }
  $('hlClearAll').addEventListener('click', function () {
    var u = HL.usage(), body = document.createElement('div'), p = document.createElement('p'), lab = document.createElement('label'), cb = document.createElement('input');
    p.textContent = (u.count ? 'Highlight của ' + u.count + ' trận (' + fmtMB(u.bytes) + ') sẽ bị xoá.' : 'Không còn highlight nào được lưu.') + ' Video đã tải về máy không bị ảnh hưởng.';
    lab.className = 'radio'; cb.type = 'checkbox';
    lab.appendChild(cb); lab.appendChild(document.createTextNode('Xoá luôn lịch sử trận đấu'));
    body.appendChild(p); body.appendChild(lab);
    dialog('🗑️ Xoá tất cả highlight?', body, [['Huỷ', false], ['🗑️ Xoá', true, 'red']], false).then(function (ok) {
      if (ok && (u.count || cb.checked)) HL.clearAll(cb.checked).then(function () { refreshUsage(); toast(cb.checked ? 'Đã xoá highlight và lịch sử trận đấu' : 'Đã xoá tất cả highlight'); });
    });
  });

  // ---------- match history ----------
  var hf = { mode: '', level: '', result: '', sport: '', sort: 'new' }, hSel = null, hOpen = {};
  var MODE_LABEL = { '2p': '👥 2 người', bot: '🤖 Đấu bot', ffa: '🙋 4 người', team4: '🤝 2 vs 2' };
  var LEVEL_LABEL = { easy: 'Dễ', normal: 'Thường', hard: 'Khó' };
  function two(n) { return ('0' + n).slice(-2); }
  function fmtDate(ms) { var d = new Date(ms); return two(d.getDate()) + '/' + two(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + two(d.getHours()) + ':' + two(d.getMinutes()); }
  function fmtDur(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + two(s % 60); }
  function fmtFormat(f) { return f[0] === 'p' ? '🎯 Chạm ' + f.slice(1) : '⏱ ' + String(+f.slice(1) / 60).replace('.', ',') + ' phút'; }
  function margin(r) {
    var s = r.score;
    if (r.mode === 'ffa') { var t = s.slice().sort(function (a, b) { return b - a; }); return t[0] - t[1]; }
    return Math.abs(r.mode === 'team4' ? s[0] - s[2] : s[0] - s[1]);
  }
  function filtered() {
    var list = HL.history().filter(function (r) {
      if (hf.mode && r.mode !== hf.mode) return false;
      if (hf.level && r.level !== hf.level) return false;
      if (hf.result === 'draw' ? !r.draw : (hf.result && r.result !== hf.result)) return false;
      return !hf.sport || (r.maps || []).indexOf(hf.sport) >= 0;
    });
    if (hf.sort === 'old') list.reverse();
    else if (hf.sort === 'margin') list.sort(function (a, b) { return margin(b) - margin(a) || b.date - a.date; });
    return list;
  }
  function hasHL(r) { return !!(r.hl && !r.hl.gone); }
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; }
  function scoreLine(r) {
    var n = r.names || [], s = r.score, R = '<span class="r">', B = '<span class="b">', X = '</span>';
    if (r.mode === 'ffa') return n.map(function (nm, i) { return (r.winner === i ? '<b>' : '') + esc(nm) + ' ' + s[i] + (r.winner === i ? '</b>' : ''); }).join(' · ');
    if (r.mode === 'team4') return R + esc(n[0] + '+' + n[1]) + ' ' + s[0] + X + ' – ' + B + s[2] + ' ' + esc(n[2] + '+' + n[3]) + X;
    return R + esc(n[0]) + ' ' + s[0] + X + ' – ' + B + s[1] + ' ' + esc(r.mode === 'bot' ? 'Bot' : n[1]) + X;
  }
  function resultTag(r) {
    if (r.draw) return ['🤝 Hoà', 'draw'];
    if (r.mode === 'bot') return r.result === 'win' ? ['🏆 Thắng', 'win'] : ['Thua', 'loss'];
    var n = r.names || [];
    return ['🏆 ' + (r.mode === 'team4' ? 'Đội ' + DEF_TEAM[r.winner < 2 ? 0 : 1].name : n[r.winner] || ''), 'win'];
  }
  function buildHistory() {
    segSelect('hfMode', hf.mode); segSelect('hfLevel', hf.level); segSelect('hfResult', hf.result);
    $('hfSport').value = hf.sport; $('hfSort').value = hf.sort;
    var list = filtered(), all = HL.history(), box = $('hList');
    box.innerHTML = '';
    $('hCount').textContent = list.length === all.length ? all.length + ' trận' : list.length + ' / ' + all.length + ' trận';
    $('hSelect').textContent = hSel ? '✖ Thôi chọn' : '☑️ Chọn nhiều';
    $('hSelect').classList.toggle('on', !!hSel);
    var pick = list.filter(hasHL);
    if (hSel) for (var id in hSel) if (!pick.some(function (r) { return r.id === id; })) delete hSel[id]; // filtered out or gone
    var chosen = pick.filter(function (r) { return hSel && hSel[r.id]; });
    $('hSelAll').classList.toggle('hidden', !hSel);
    $('hSelAll').textContent = chosen.length && chosen.length === pick.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả';
    $('hDelSel').classList.toggle('hidden', !hSel);
    $('hDelSel').disabled = !chosen.length;
    $('hDelSel').textContent = '🗑️ Xoá highlight đã chọn (' + chosen.length + ' trận · ' + fmtMB(chosen.reduce(function (a, r) { return a + r.hl.bytes; }, 0)) + ')';
    if (!list.length) box.appendChild(el('div', 'empty', all.length ? 'Không có trận nào khớp bộ lọc.' : 'Chưa có trận nào. Đấu xong một trận là trận đó hiện ở đây.'));
    list.forEach(function (r) { box.appendChild(historyCard(r)); });
  }
  function historyCard(r) {
    var card = el('div', 'hcard'), has = hasHL(r), tag = resultTag(r);
    if (hSel && has) {
      var cb = el('input'); cb.type = 'checkbox'; cb.className = 'hpick'; cb.checked = !!hSel[r.id];
      cb.addEventListener('change', function () { if (cb.checked) hSel[r.id] = true; else delete hSel[r.id]; buildHistory(); });
      card.appendChild(cb);
    }
    var main = el('div', 'hmain');
    main.appendChild(el('div', 'hmeta', fmtDate(r.date) + ' · ' + (MODE_LABEL[r.mode] || r.mode) + (r.level ? ' ' + LEVEL_LABEL[r.level] : '') + ' · ' + fmtFormat(r.fmt)));
    var sl = el('div', 'hscore'); sl.innerHTML = scoreLine(r) + ' <span class="htag ' + tag[1] + '">' + esc(tag[0]) + '</span>';
    main.appendChild(sl);
    var icons = (r.maps || []).map(function (m) { return E.MAP_BY_ID[m] ? E.MAP_BY_ID[m].icon : ''; }).join('');
    main.appendChild(el('div', 'hmeta', icons + ' · ⏱ ' + fmtDur(r.dur) + ' · ' + (r.goals || []).length + ' điểm · ' +
      (has ? '🎬 ' + r.hl.clips + ' pha · ' + fmtMB(r.hl.bytes) : (r.hl ? 'không còn highlight' : 'không lưu highlight')) +
      (r.ps ? ' · 🏅 MVP ' + r.ps[r.mvp].n : '')));
    if (hOpen[r.id]) {
      if (r.ps) main.appendChild(statsTable({ list: r.ps, mvp: r.mvp }, r.mode));
      var gl = el('div', 'hgoals');
      (r.goals || []).forEach(function (g) {
        var line = el('div', '', fmtDur(g.t) + '  ' + (E.MAP_BY_ID[g.map] ? E.MAP_BY_ID[g.map].icon : '') + ' ' + (g.who || '') + (g.sub ? ' — ' + g.sub : ''));
        line.style.color = textCol(r.mode === 'ffa' && g.credit >= 0 ? Meta.color(g.credit) : teamCol(g.team));
        gl.appendChild(line);
      });
      if (!(r.goals || []).length) gl.appendChild(el('div', '', 'Không có bàn thắng.'));
      main.appendChild(gl);
    }
    main.addEventListener('click', function () { if (hOpen[r.id]) delete hOpen[r.id]; else hOpen[r.id] = true; Snd.click(); buildHistory(); });
    card.appendChild(main);
    if (has && !hSel) {
      var acts = el('div', 'hacts');
      [['🎬 Xem', function () { openHL(r, false); }], ['⬇️ Tải', function () { openHL(r, true); }], ['🗑️ ' + fmtMB(r.hl.bytes), function () { deleteHL([r]); }]].forEach(function (a) {
        var b = el('button', 'chip', a[0]);
        b.addEventListener('click', function (e) { e.stopPropagation(); Snd.click(); a[1](); });
        acts.appendChild(b);
      });
      card.appendChild(acts);
    }
    return card;
  }
  function openHL(r, video) {
    HL.load(r.id).then(function (hl) {
      if (G.screen !== 'history') return;
      if (video) exportHighlight(hl, 'history'); else playHighlight(hl, 'history');
    }, function () {
      toast('⚠️ Không mở được highlight của trận này');
      HL.dropHL(r).then(buildHistory);
    });
  }
  function deleteHL(list) {
    var mb = fmtMB(list.reduce(function (a, r) { return a + r.hl.bytes; }, 0));
    var msg = (list.length > 1 ? 'Highlight của ' + list.length + ' trận (' + mb + ') sẽ bị xoá.' : 'Highlight của trận này (' + mb + ') sẽ bị xoá.') +
      ' Trận đấu vẫn còn trong lịch sử. Video đã tải về máy không bị ảnh hưởng.';
    dialog('🗑️ Xoá highlight?', msg, [['Huỷ', false], ['🗑️ Xoá', true, 'red']], false).then(function (ok) {
      if (!ok) return;
      Promise.all(list.map(HL.dropHL)).then(function () { if (hSel) hSel = {}; buildHistory(); toast('Đã xoá highlight (' + mb + ')'); });
    });
  }
  (function () {
    var sp = $('hfSport');
    sp.appendChild(new Option('Mọi môn', ''));
    E.MAPS.forEach(function (m) { sp.appendChild(new Option(m.icon + ' ' + m.name, m.id)); });
    [['hfMode', 'mode'], ['hfLevel', 'level'], ['hfResult', 'result']].forEach(function (o) {
      $(o[0]).addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; hf[o[1]] = b.dataset.v; Snd.click(); buildHistory(); });
    });
    sp.addEventListener('change', function () { hf.sport = sp.value; buildHistory(); });
    $('hfSort').addEventListener('change', function () { hf.sort = $('hfSort').value; buildHistory(); });
    $('hSelect').addEventListener('click', function () { hSel = hSel ? null : {}; Snd.click(); buildHistory(); });
    $('hSelAll').addEventListener('click', function () {
      var pick = filtered().filter(hasHL), allOn = pick.every(function (r) { return hSel[r.id]; });
      hSel = {};
      if (!allOn) pick.forEach(function (r) { hSel[r.id] = true; });
      Snd.click(); buildHistory();
    });
    $('hDelSel').addEventListener('click', function () {
      var list = filtered().filter(function (r) { return hasHL(r) && hSel && hSel[r.id]; });
      if (list.length) deleteHL(list);
    });
  })();

  // ---------- highlight video (WebM, recorded from the canvas while the highlight plays) ----------
  var EXPORT_W = 1280;
  function videoMime() {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported || !canvas.captureStream) return '';
    var l = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    for (var i = 0; i < l.length; i++) if (MediaRecorder.isTypeSupported(l[i])) return l[i];
    return '';
  }
  function stamp(ms) { var d = new Date(ms); return d.getFullYear() + two(d.getMonth() + 1) + two(d.getDate()) + '-' + two(d.getHours()) + two(d.getMinutes()) + two(d.getSeconds()); }
  function blobBytes(b) {
    if (b.arrayBuffer) return b.arrayBuffer().then(function (x) { return new Uint8Array(x); });
    return new Promise(function (res) { var r = new FileReader(); r.onload = function () { res(new Uint8Array(r.result)); }; r.readAsArrayBuffer(b); });
  }
  // browser: collect the pieces and download them as one file
  function blobSink(name) {
    var parts = [];
    return {
      push: function (b) { parts.push(b); },
      abort: function () { parts = []; },
      done: function () {
        var url = URL.createObjectURL(new Blob(parts, { type: 'video/webm' })), a = document.createElement('a');
        a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
        return Promise.resolve(name);
      }
    };
  }
  // app: hand the pieces to Android, which writes them into Movies/Ballgames
  function nativeSink(N, name, publicDir) {
    var where = N.videoBegin(name, !!publicDir), q = Promise.resolve(), ok = true;
    if (!where) return null;
    return {
      push: function (b) { q = q.then(function () { return blobBytes(b); }).then(function (u8) { if (ok && !N.videoChunk(HL.toB64(u8))) ok = false; }); },
      abort: function () { q = q.then(function () { N.videoAbort(); }); },
      done: function () { return q.then(function () { if (!ok) { N.videoAbort(); return ''; } return N.videoEnd() ? where : ''; }); }
    };
  }
  // Android 9 and older ask for the storage permission; without it the video goes to the app's own folder
  function storageAllowed(N) {
    if (!N.needsStoragePermission || !N.needsStoragePermission()) return Promise.resolve(true);
    return new Promise(function (res) {
      window.__perm = function (ok) { window.__perm = null; res(!!ok); };
      N.requestStoragePermission();
    });
  }
  function exportHighlight(hl, from) {
    var N = window.BGNative && typeof window.BGNative.videoBegin === 'function' ? window.BGNative : null, mime = videoMime();
    if (!mime) { dialog('Không tạo được video', 'Trình duyệt / điện thoại này chưa hỗ trợ ghi video từ game.', [['OK', 1, 'green']], 1); return; }
    var name = 'ballgames-highlight-' + stamp(hl.match.date) + '.webm';
    (N ? storageAllowed(N) : Promise.resolve(true)).then(function (pub) {
      var sink = N ? nativeSink(N, name, pub) : blobSink(name);
      if (!sink) { dialog('Không lưu được video', 'Không mở được thư mục để lưu video.', [['OK', 1, 'green']], 1); return; }
      G.exporting = true; resize();
      var stream = canvas.captureStream(30), rec, cancelled = false;
      try { rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3000000 }); } catch (e) { rec = null; }
      if (!rec) {
        stream.getTracks().forEach(function (t) { t.stop(); }); G.exporting = false; resize(); sink.abort();
        dialog('Không tạo được video', 'Không bắt đầu ghi video được.', [['OK', 1, 'green']], 1);
        return;
      }
      rec.ondataavailable = function (e) { if (e.data && e.data.size) sink.push(e.data); };
      rec.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        G.exporting = false; resize();
        $('exportBar').classList.add('hidden');
        if (cancelled) { sink.abort(); toast('Đã huỷ tạo video'); return; }
        sink.done().then(function (where) { toast(where ? '✅ Đã lưu video: ' + where : '⚠️ Không lưu được video'); });
      };
      G.exportJob = { cancel: function () { cancelled = true; endHighlight(); } };
      playHighlight(hl, from, true);
      G.hlp.onEnd = function () { G.exportJob = null; if (rec.state !== 'inactive') rec.stop(); };
      rec.start(1000);
      exportProgress(0);
      $('exportBar').classList.remove('hidden');
    });
  }
  function exportProgress(f) { $('exportPct').textContent = Math.max(0, Math.min(99, Math.floor(f * 100))) + '%'; }
  $('exportCancel').addEventListener('click', function () { if (G.exportJob) G.exportJob.cancel(); });
  $('hlClose').addEventListener('click', function () { Snd.click(); closeHighlight(); });

  // ---------- simulation ----------
  function updateBot(b, w) { var t0 = performance.now(); var r = b.update(w); G.botMs += performance.now() - t0; return r; }
  function runPhysics(dt) {
    var w = G.world; if (!w) return;
    G.acc += dt * settings.speed * (w.arena.timeScale || 1);
    var n = 0, pr = G.pressed;
    while (G.acc >= DT && n < 10) {
      G.acc -= DT; n++;
      var celebrate = G.state === 'scored' && !G.demo;
      if (G.demo) { pr[0] = pr[1] = G.demoCtl[0](w); pr[2] = pr[3] = G.demoCtl[1](w); }
      else if (is4(G.mode)) { for (var k = 0; k < 4; k++) pr[k] = G.bots[k] ? updateBot(G.bots[k], w) : humanPress(k, w); }
      else {
        var r = humanPress(0, w), bl = G.bot ? updateBot(G.bot, w) : (G.mode === '2p' ? humanPress(1, w) : false);
        pr[0] = pr[1] = r; pr[2] = pr[3] = bl;
      }
      if (celebrate) for (k = 0; k < 4; k++) pr[k] = w.players[k].team === G.scorer ? ((w.time * 1.5 + k * 0.37) % 1) < 0.12 : false;
      else if (G.hlw) for (k = 0; k < 4; k++) if (pr[k]) G.pressT[k] = w.time; // when each player last did something (saves)
      var sc = E.stepPlayers(w, pr);
      handleEvents(w);
      if (!G.demo) weatherStep(w);
      if (G.mode === 'tutorial') tutorialTick(DT, w);
      if (!G.demo && G.rec && (G.state === 'play' || G.state === 'scored')) G.rec.push(w);
      if (G.hlw && G.state === 'play') watchSaves(w);
      if (G.ps && G.state === 'play') countTouches(w);
      for (var bi = 0; bi < w.balls.length && bi < 2; bi++) {
        var tr = G.trails[bi]; tr.push(w.balls[bi].x, w.balls[bi].y);
        if (tr.length > 20) tr.splice(0, 2);
      }
      w.events.length = 0;
      if (sc >= 0 && (G.state === 'play' || G.demo) && G.mode !== 'tutorial') onScore(sc);
      if (G.state !== 'play' && G.state !== 'scored' && !G.demo) break;
    }
    if (n >= 10) G.acc = 0;
  }

  // the screen has gone fully white: what comes next depends on the state the fade was started from
  function fadedOut() {
    if (G.state === 'scored' || G.state === 'replay') nextRound();
    else if (G.state === 'highlight') hlAdvance();
    else G.fadeDir = -1; // nothing to switch to: the picture just comes back
  }
  function update(dt) {
    // Fades stand still while the game is paused. Pausing (X button, Android back, leaving the app) during the fade
    // after a point used to let it reach white while paused, so the next round never started: a white screen.
    if (G.state !== 'paused') {
      if (G.fadeDir) {
        G.fade += G.fadeDir * dt / 0.3;
        if (G.fade <= 0) { G.fade = 0; G.fadeDir = 0; }
        else if (G.fade >= 1) { G.fade = 1; G.fadeDir = 0; fadedOut(); }
      } else if (G.fade >= 1) fadedOut(); // never stay on a white screen
    }
    G.shake = Math.max(0, G.shake - dt * 2.5);
    G.excite = Math.max(0, G.excite - dt * 0.45);
    if (G.noteT > 0) G.noteT -= dt;
    if (G.state === 'play' || G.state === 'scored' || playback()) weatherFrame(dt);
    updateParticles(dt);
    switch (G.state) {
      case 'menu':
        runPhysics(dt);
        if (G.demoNext > 0) { G.demoNext -= dt; if (G.demoNext <= 0) { startDemo(); G.fade = 1; G.fadeDir = -1; } }
        return;
      case 'intro':
        G.timer -= dt;
        if (G.timer <= 0) { G.state = 'play'; Snd.whistle(); }
        return;
      case 'scored':
        G.timer -= dt;
        runPhysics(dt * 0.35);
        if (G.timer <= 0 && !G.fadeDir && G.fade === 0 && G.state === 'scored') {
          captureGoalClip();
          if (prefs.replay && G.rec && G.rec.goal > 0 && startReplay()) return;
          if (matchWinner() >= 0) endMatch(); else G.fadeDir = 1;
        }
        return;
      case 'highlight':
        highlightStep(dt);
        return;
      case 'replay':
        var rp = G.replay, want = rp.k >= rp.slowFrom && rp.k <= rp.slowTo ? REPLAY_SLOW : 1;
        rp.speed += (want - rp.speed) * Math.min(1, dt * 8);
        rp.acc += dt * rp.speed / DT;
        var k0 = rp.k;
        while (rp.acc >= 1 && rp.k < rp.to) { rp.acc -= 1; rp.k++; }
        G.rec.apply(G.world, rp.k);
        if (k0 < rp.goal && rp.k >= rp.goal) goalFlash();
        for (var bi = 0; bi < G.world.balls.length && bi < 2; bi++) { var tr = G.trails[bi]; tr.push(G.world.balls[bi].x, G.world.balls[bi].y); if (tr.length > 20) tr.splice(0, 2); }
        if (rp.k >= rp.to && !G.fadeDir) endReplay();
        return;
      case 'play':
        G.roundT += dt; G.matchT += dt;
        if (G.clock > 0) {
          var before = G.clock;
          G.clock = Math.max(0, G.clock - dt);
          if (before > 10 && G.clock <= 10) { G.note = '⏱ 10 giây cuối!'; G.noteT = 1.4; }
          if (G.clock <= 5 && Math.ceil(G.clock) !== Math.ceil(before)) Snd.beep(false);
          if (G.clock === 0 && before > 0) {
            Snd.buzzer();
            if (uniqueLeader() >= 0) { endMatch(); return; }
            startVote(); return;
          }
        }
        if (G.state !== 'play') return;
        runPhysics(dt);
        redropTick();
        // on slow phones fall back to cheaper planners instead of dropping frames
        G.botWin += dt;
        if (G.botWin >= 1) {
          if (G.botMs > 220) {
            var all = [G.bot].concat(G.bots);
            all.forEach(function (b) { if (b && b.level === 'hard') b.setLevel('hardLite'); else if (b && b.level === 'hardLite' && G.botMs > 400) b.setLevel('normal'); });
          }
          G.botMs = 0; G.botWin = 0;
        }
    }
  }

  // ---------- particles & events ----------
  function addPart(x, y, vx, vy, life, col, size, g, kind) {
    if (G.parts.length > 320) return;
    G.parts.push({ x: x, y: y, vx: vx, vy: vy, life: life, max: life, col: col, size: size, g: g, kind: kind, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 14 });
  }
  function confetti(x, y, team, col) {
    col = col || teamCol(team);
    var cols = [col.main, '#ffffff', '#ffd23f', col.dark];
    x = Math.max(80, Math.min(W - 80, x)); y = Math.min(y, GROUND - 40);
    for (var i = 0; i < 90; i++) {
      var a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, sp = 400 + Math.random() * 700;
      addPart(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 1.6 + Math.random() * 0.8, cols[i % 4], 7 + Math.random() * 7, 900, 'conf');
    }
  }
  function sparks(x, y, n, col) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * TAU, sp = 200 + Math.random() * 350;
      addPart(x, y, Math.cos(a) * sp, Math.sin(a) * sp, 0.22 + Math.random() * 0.12, col || '#ffffff', 4 + Math.random() * 3, 0, 'spark');
    }
  }
  function dust(x, y, n) {
    var col = G.world ? G.world.arena.map.ground2 : '#999';
    for (var i = 0; i < n; i++) addPart(x + (Math.random() - 0.5) * 30, y - 4, (Math.random() - 0.5) * 220, -Math.random() * 160, 0.35 + Math.random() * 0.2, col, 6 + Math.random() * 6, 600, 'dust');
  }
  function explosion(x, y) {
    for (var i = 0; i < 70; i++) {
      var a = Math.random() * TAU, sp = 200 + Math.random() * 900;
      addPart(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 200, 0.6 + Math.random() * 0.6, ['#ffb02e', '#e8463c', '#fff6a0', '#5a5a5a'][i % 4], 10 + Math.random() * 14, 500, 'dust');
    }
  }
  function updateParticles(dt) {
    var ps = G.parts;
    for (var i = ps.length - 1; i >= 0; i--) {
      var p = ps[i];
      p.life -= dt;
      if (p.life <= 0) { ps.splice(i, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      if (p.kind === 'conf') { p.vx *= 1 - 1.5 * dt; if (p.vy > 220) p.vy = 220; }
      if (p.y > GROUND + 40) p.y = GROUND + 40;
    }
  }
  function handleEvents(w) {
    var ev = w.events;
    for (var i = 0; i < ev.length; i++) {
      var e = ev[i];
      switch (e.t) {
        case 'kick': case 'head':
          Snd.kick(e.v, e.boost); sparks(e.x, e.y, Math.min(9, 2 + (e.v / 250) | 0), e.boost ? '#ffb02e' : null);
          if (e.v > 1100) { G.shake = Math.max(G.shake, 0.3); G.excite = Math.max(G.excite, 0.35); }
          break;
        case 'body': Snd.bounce(e.v * 0.6); break;
        case 'bounce': Snd.bounce(e.v); if (e.v > 380) dust(e.x, e.y, 4); break;
        case 'wall': Snd.bounce(e.v * 0.8); break;
        case 'post': Snd.post(); sparks(e.x, e.y, 4); break;
        case 'shield': Snd.shield(); sparks(e.x, e.y, 6, '#7fe3ff'); break;
        case 'jump': Snd.jump(); dust(e.x, e.y, 3); break;
        case 'explode': Snd.explode(); explosion(e.x, e.y); G.shake = 1.4; break;
        case 'pickup':
          var info = E.ITEMS[e.type];
          if (e.type === 'freeze') Snd.freeze(); else Snd.pickup();
          sparks(e.x, e.y, 12, '#ffd23f');
          if (!G.demo) { G.note = info.icon + ' ' + whoName(e.id) + ': ' + info.name + '!'; G.noteT = 1.4; }
          break;
        case 'respawn':
          sparks(e.x, e.y, 8);
          if (!G.demo && G.state === 'play') { G.note = 'TUNG BÓNG!'; G.noteT = 1.2; Snd.whistle(); }
          break;
      }
    }
  }
  function whoName(id) {
    if (is4(G.mode)) return nameOf(id);
    var team = slotTeam(id);
    if (soloish(G.mode)) return team === 0 ? nameOf(0) : 'Bot';
    return nameOf(team);
  }

  // ---------- drawing ----------
  // what each player of a match looks like, taken when it starts and kept with its highlights
  function matchLooks() {
    var four = is4(G.mode), out = [];
    for (var i = 0; i < 4; i++) {
      var team = slotTeam(i), prof, col;
      if (four) { prof = Meta.profile(i); col = G.mode === 'ffa' ? Meta.color(i) : teamCol(team); }
      else if (G.mode === '2p') { prof = Meta.profile(team); col = teamCol(team); }
      else { prof = team === 0 ? Meta.profile(0) : BOT_LOOK; col = teamCol(team); }
      var mk = four ? slotColor(i) : col;
      out.push({ hat: prof.hat, hair: prof.hair, shirt: prof.shirt, col: { main: col.main, dark: col.dark }, mark: { main: mk.main, dark: mk.dark },
        label: four ? nameOf(i) + (G.bots[i] ? ' 🤖' : '') : '' });
    }
    return { four: four, ffa: G.mode === 'ffa', p: out, ball: Meta.D.ball };
  }
  var DEMO_LOOK = { hat: 'none', hair: 'default', shirt: 'plain' };
  // the side cheering right now (scored, replay or highlight after the ball went in), or -1
  function goalMark(c) { for (var i = 0; i < c.marks.length; i++) if (c.marks[i].kind === 'goal') return c.marks[i]; return c.marks[0]; }
  function celebrating() {
    if (G.state === 'scored' || (G.state === 'replay' && G.replay && G.replay.k > G.rec.goal)) return G.scorer;
    var h = G.hlp;
    if (G.state === 'highlight' && h && h.c.kind === 'goal' && h.k / HL.RATE >= goalMark(h.c).t) return h.c.team;
    return -1;
  }
  function lookFor(i, p, w) {
    var m = w.arena.map, L = !G.demo && G.looks ? G.looks.p[i] : null, prof = L || DEMO_LOOK, col = L ? L.col : teamCol(p.team);
    var face = 'normal', frozen = w.fx.freeze[p.team] > 0, burnt = w.hz.stun[i] > 0, cheer = celebrating();
    if (burnt) { face = 'dizzy'; col = { main: '#3c3c3c', dark: '#202020' }; }
    else if (frozen) face = 'cold';
    else if (cheer >= 0) face = p.team === cheer ? 'happy' : 'sad';
    else if (Math.abs(p.a) > 1.4 && p.cT < 0.1) face = 'dizzy';
    else if (p.press) face = 'effort';
    return { col: col, hat: prof.hat, hair: prof.hair, shirt: prof.shirt, num: L && G.looks.four ? i + 1 : p.role + 1, face: face, frozen: frozen,
      burnt: burnt, hairCol: burnt ? INK : (p.id % 2 ? '#5b3a1f' : INK), armT: G.armT[i], mapId: m.id };
  }
  // replay or highlight: recorded frames are being shown
  function playback() { return G.state === 'replay' || G.state === 'highlight'; }
  // weather shown on screen: live, or as recorded while a replay runs
  function wxView() { return playback() && G.rwxv ? G.rwxv : G.wxv; }
  function drawWorld(c, w, dt) {
    var A = w.arena, m = A.map, i, p;
    for (i = 0; i < 4; i++) G.armT[i] += ((w.players[i].press ? 1 : 0) - G.armT[i]) * Math.min(1, dt * 16);
    var wv = wxView();
    D.structures(c, A, 'back', targetColor);
    D.shields(c, w, clock);
    D.craters(c, w.hz, clock);
    D.tornado(c, w.hz, clock);
    D.lightningWarn(c, wv.warn, clock);
    c.fillStyle = 'rgba(0,0,0,0.16)';
    var floorY = GROUND;
    for (i = 0; i < 4; i++) {
      p = w.players[i];
      if (!p.active) continue;
      var hgt = Math.max(0, floorY - (p.y + COM_H * p.sc)), sk = Math.max(0.3, 1 - hgt / 500) * p.sc;
      c.beginPath(); c.ellipse(p.x, floorY + 3, 32 * sk, 7 * sk, 0, 0, TAU); c.fill();
    }
    var R = A.P.ballR;
    for (i = 0; i < w.balls.length; i++) {
      if (wv.bombGone) break;
      var b = w.balls[i], bh = Math.max(0, GROUND - b.y - R), bk = Math.max(0.25, 1 - bh / 600);
      c.beginPath(); c.ellipse(b.x, GROUND + 3, R * 1.1 * bk, R * 0.3 * bk, 0, 0, TAU); c.fill();
    }
    D.item(c, w.item, clock);
    // magnet: faint pull lines from the ball to its holder
    if (w.fx.magnetT > 0 && w.fx.magnetId >= 0) {
      var mp = w.players[w.fx.magnetId];
      c.save(); c.setLineDash([10, 10]); c.strokeStyle = 'rgba(239,91,91,0.6)'; c.lineWidth = 4; D.line(c, mp.x, mp.y - 40, w.ball.x, w.ball.y); c.restore();
      c.fillStyle = INK; D.emoji(c, '🧲', mp.x, mp.y - 150 * mp.sc, 34);
    }
    for (i = 0; i < 4; i++) if (w.players[i].active) D.player(c, w.players[i], lookFor(i, w.players[i], w));
    for (i = 0; i < w.balls.length; i++) {
      if (wv.bombGone) break;
      var skin = !G.demo && G.looks ? G.looks.ball : Meta.D.ball;
      var bb = w.balls[i], fire = w.fx.kick[bb.lastTeam] > 0 || (skin === 'fire' && m.ball === 'soccer');
      D.trail(c, G.trails[i] || [], R, fire);
      D.ball(c, bb, m.ball, R, { skin: m.ball === 'soccer' ? skin : 'classic', fuse: A.type === 'bomb' ? w.bombT : -1, t: clock,
        zap: wv.zapBall === i ? wv.zap : 0 });
    }
    D.structures(c, A, 'front', targetColor);
    D.bolt(c, wv.bolt);
    drawRedropSpots(c, w);
    for (i = 0; i < 4; i++) {
      p = w.players[i];
      if (p.active && w.fx.big[i] > 0) { c.fillStyle = INK; D.emoji(c, '🍄', p.x, p.y - 170 * p.sc, 30); }
    }
  }

  // ---------- HUD ----------
  function drawButton(c, col, label, x, y, r, down, ix, iy) {
    c.save(); c.translate(x, y);
    var k = down ? 0.92 : 1;
    D.circle(c, 0, 0, r * k); c.fillStyle = down ? col.dark : col.main; c.fill();
    c.lineWidth = Math.max(3, r * 0.07); c.strokeStyle = INK; c.stroke();
    D.circle(c, 0, 0, r * 0.72 * k); c.lineWidth = Math.max(2, r * 0.05); c.strokeStyle = 'rgba(255,255,255,0.45)'; c.stroke();
    D.textOutlined(c, label, ix * r * 0.14, iy * r * 0.12, r * (label.length > 1 ? 0.48 : 0.62), '#ffffff', col.dark);
    c.restore();
  }
  function scorePill(c, x, y, w, h, u, col, value, tag) {
    D.rrect(c, x, y, w, h, 3 * u); c.fillStyle = col.main; c.fill(); c.lineWidth = Math.max(2.5, u * 0.6); c.strokeStyle = INK; c.stroke();
    if (tag) {
      D.textOutlined(c, tag, x + w * 0.3, y + h / 2 + u * 0.3, 3.4 * u, '#ffffff', INK);
      D.textOutlined(c, String(value), x + w * 0.7, y + h / 2 + u * 0.4, 7 * u, '#ffffff', INK);
    } else D.textOutlined(c, String(value), x + w / 2, y + h / 2 + u * 0.4, 8 * u, '#ffffff', INK);
  }
  function tag(c, x, y, txt, col, fs) {
    var tw = c.measureText(txt).width, pw = tw + fs * 0.9, ph = fs * 1.4;
    D.rrect(c, x - pw / 2, y - ph / 2, pw, ph, ph / 2);
    c.fillStyle = col.main; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
    c.lineWidth = Math.max(2, fs * 0.16); c.strokeStyle = col.dark; c.strokeText(txt, x, y + 1);
    c.fillStyle = '#ffffff'; c.fillText(txt, x, y + 1);
  }
  function hudTop(u) { return Math.max(8, u * 2); }
  function edgeY(x, u) {
    if (playback()) return barH(u) + 4; // under the replay's black bar
    var half = (is4(G.mode) ? 38 : 22) * u;
    return Math.abs(x - view.cw / 2) < half ? hudTop(u) + 11 * u + 7 * u : 3;
  }
  function drawPlayerMarks(c, u, w) {
    var v = view, four = !!(G.looks && G.looks.four), hidden = playback() ? barH(u) : 4;
    var fs = Math.round(Math.max(13, 3.9 * u));
    c.font = '900 ' + fs + 'px ' + D.FONT;
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    for (var i = 0; i < 4; i++) {
      var p = w.players[i];
      if (!p.active) continue;
      var L = G.looks.p[i], col = four ? L.mark : teamCol(p.team), label = four ? L.label : '';
      var top = 1e9;
      for (var j = 0; j < E.NS; j++) top = Math.min(top, p.sy[j] - p.rad[j]);
      var sx = v.ox + p.x * v.s, sy = v.oy + top * v.s;
      if (sy < hidden) {
        sx = Math.max(18, Math.min(v.cw - 18, sx));
        var ah = Math.max(14, fs * 1.1), ey = edgeY(sx, u);
        c.beginPath(); c.moveTo(sx, ey); c.lineTo(sx - ah * 0.75, ey + ah); c.lineTo(sx + ah * 0.75, ey + ah); c.closePath();
        c.fillStyle = col.main; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
        if (label) tag(c, sx, ey + ah + fs * 0.85, label, col, fs);
        else { D.circle(c, sx, ey + ah + 9, 7); c.fillStyle = col.main; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke(); }
      } else if (label) {
        var ph = fs * 1.4, ty = Math.max(ph / 2 + 2, sy - 8 - ph / 2);
        c.beginPath(); c.moveTo(sx - 6, ty + ph / 2 - 1); c.lineTo(sx + 6, ty + ph / 2 - 1); c.lineTo(sx, ty + ph / 2 + 7); c.closePath();
        c.fillStyle = col.main; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
        tag(c, sx, ty, label, col, fs);
      }
    }
  }
  // balls above the top of the screen (or hidden under the replay bar) get an arrow and a dot
  function drawBallArrows(c, u, A, w) {
    var v = view, hidden = playback() ? barH(u) : 0;
    if (wxView().bombGone) return;
    for (var bi = 0; bi < w.balls.length; bi++) {
      var b = w.balls[bi], R = A.P.ballR, sy = v.oy + (b.y + R) * v.s;
      if (sy < hidden) {
        var sx = Math.max(20, Math.min(v.cw - 20, v.ox + b.x * v.s)), by0 = edgeY(sx, u) + 3;
        c.fillStyle = INK; c.beginPath(); c.moveTo(sx, by0); c.lineTo(sx - 9, by0 + 14); c.lineTo(sx + 9, by0 + 14); c.closePath(); c.fill();
        D.circle(c, sx, by0 + 26, 9); c.fillStyle = '#ffffff'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
      }
    }
  }
  // ---------- re-drop warning ----------
  // a ball out of play (3 s) or lying still untouched (15 s) is dropped again in the middle: the last 3 seconds
  // are announced with a countdown, a beep each second and a dashed ring where it will come down
  var REDROP_WARN = 3;
  function redrops() {
    var w = G.world, out = [];
    if (!w || G.demo || G.mode === 'tutorial' || G.state !== 'play') return out;
    for (var i = 0; i < w.balls.length; i++) {
      var b = w.balls[i], left = Infinity;
      if (b.outT > 0.25) left = Math.min(left, E.OUT_TIME - b.outT); // a ball just flying over a goal for a moment is no warning
      if (b.stillT > 0) left = Math.min(left, E.STILL_TIME - b.stillT);
      if (left <= REDROP_WARN && left > 0) out.push({ left: left, x: W / 2 + (w.balls.length > 1 ? (i === 0 ? -160 : 160) : 0) });
    }
    return out;
  }
  function redropTick() {
    var r = redrops(), sec = r.length ? Math.ceil(Math.min.apply(null, r.map(function (x) { return x.left; }))) : 0;
    if (sec && sec !== G.redropSec) Snd.beep(false);
    G.redropSec = sec;
  }
  function drawRedropSpots(c, w) {
    var r = redrops();
    if (!r.length) return;
    var R = w.arena.P.ballR, pulse = 0.5 + 0.5 * Math.sin(clock * 8);
    r.forEach(function (d) {
      c.save(); c.globalAlpha = 0.6 + 0.4 * pulse;
      c.setLineDash([10, 8]); c.lineWidth = 5; c.strokeStyle = '#ffffff';
      D.circle(c, d.x, 150, R + 6); c.stroke();
      c.setLineDash([]); c.lineWidth = 2; c.strokeStyle = INK; D.circle(c, d.x, 150, R + 10); c.stroke();
      c.restore();
      D.textOutlined(c, String(Math.ceil(d.left)), d.x, 152, R * 1.1, '#ffd23f', INK);
    });
  }
  function drawRedropWarning(c, u, cx) {
    var r = redrops();
    if (!r.length) return;
    var sec = Math.ceil(Math.min.apply(null, r.map(function (x) { return x.left; })));
    D.textOutlined(c, '⚠️ Bóng sẽ được phát lại ở giữa sân sau ' + sec + ' giây', cx, view.ch * 0.24, 4.4 * u, '#ffd23f', INK);
  }
  function easeBack(t) { var s = 1.7; t -= 1; return t * t * ((s + 1) * t + s) + 1; }
  function fmtClock(s) { s = Math.ceil(s); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function banner(c, u, cx, y, title, sub, sc) {
    c.save(); c.translate(cx, y); c.scale(sc, sc);
    c.font = '900 ' + 7 * u + 'px ' + D.FONT;
    var tw = c.measureText(title).width + 10 * u;
    D.rrect(c, -tw / 2, -8 * u, tw, 16 * u, 4 * u); c.fillStyle = '#ffffff'; c.fill(); c.lineWidth = Math.max(3, u * 0.8); c.strokeStyle = INK; c.stroke();
    c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(title, 0, u * 0.5);
    if (sub) D.textOutlined(c, sub, 0, 13 * u, 4.2 * u, '#ffffff', INK);
    c.restore();
  }
  function drawHUD(c, A, w) {
    var v = view, u = Math.min(v.ch / 100, v.cw / 178);
    if (G.state === 'menu' || !A) return;
    var cx = v.cw / 2, top = hudTop(u), bh = 11 * u, i;
    if (G.state === 'replay') { drawReplayHUD(c, u, cx); drawPlayerMarks(c, u, w); drawBallArrows(c, u, A, w); return; }
    if (G.state === 'highlight') { drawHighlightHUD(c, u, cx); drawPlayerMarks(c, u, w); drawBallArrows(c, u, A, w); return; }
    // scoreboard
    if (G.mode === 'tutorial') {
      // the coach box takes the place of the scoreboard
    } else if (is4(G.mode)) {
      var pw = 15 * u, gap = 1.5 * u;
      for (i = 0; i < 4; i++) {
        var px = i < 2 ? cx - 4 * u - (2 - i) * pw - (1 - i) * gap : cx + 4 * u + (i - 2) * (pw + gap);
        scorePill(c, px, top, pw, bh, u, slotColor(i), G.score[i], 'P' + (i + 1));
      }
    } else {
      scorePill(c, cx - 18 * u, top, 15 * u, bh, u, teamCol(0), G.score[0]);
      scorePill(c, cx + 3 * u, top, 15 * u, bh, u, teamCol(1), G.score[1]);
    }
    if (G.mode !== 'tutorial') {
      D.textOutlined(c, A.map.icon, cx, top + bh / 2, 5 * u, '#ffffff', 'rgba(0,0,0,0)');
      var info = G.target ? 'Chạm ' + G.target : (G.golden ? '⭐ BÀN VÀNG' : '⏱ ' + fmtClock(G.clock));
      var wxIcons = '';
      if (G.wx) for (var wk in G.wx.active) wxIcons += WX[wk].icon;
      var line2 = (G.mode === 'ffa' ? 'Điểm riêng · ' : G.mode === 'team4' ? '2 vs 2 · ' : '') + info + (G.modName ? ' · ' + G.modName : '') + (wxIcons ? ' · ' + wxIcons : '');
      D.textOutlined(c, line2, cx, top + bh + 3.6 * u, (G.clock > 0 && G.clock <= 10 ? 4.4 : 3.4) * u, G.clock > 0 && G.clock <= 10 ? '#ffd23f' : '#ffffff', INK);
      // active power-ups per side
      for (var t = 0; t < 2; t++) {
        var icons = '';
        if (w.fx.kick[t] > 0) icons += '🔥';
        if (w.fx.shield[t] > 0) icons += '🛡️';
        if (w.fx.freeze[t] > 0) icons += '❄️';
        if (icons) { c.fillStyle = INK; D.emoji(c, icons, cx + (t === 0 ? -1 : 1) * 26 * u, top + bh / 2, 4.6 * u); }
      }
    }
    // buttons sit in the corners, partly off-screen like the original
    var pad = Math.max(10, 3 * u);
    c.globalAlpha = 0.92;
    if (is4(G.mode)) {
      var r4 = Math.max(30, 10.5 * u), o = r4 * 0.8;
      var lab = function (i) { return G.bots[i] ? '🤖' : 'P' + (i + 1); };
      drawButton(c, slotColor(0), lab(0), o, v.ch - o, r4, G.pressed[0], 1, -1);
      drawButton(c, slotColor(1), lab(1), o, o, r4, G.pressed[1], 1, 1);
      drawButton(c, slotColor(2), lab(2), v.cw - o, v.ch - o, r4, G.pressed[2], -1, -1);
      drawButton(c, slotColor(3), lab(3), v.cw - o, o, r4, G.pressed[3], -1, 1);
    } else {
      var r = Math.max(34, 12.5 * u);
      drawButton(c, teamCol(0), G.mode === 'tutorial' ? '●' : String(G.score[0]), r * 0.82, v.ch - r * 0.82, r, G.pressed[0], 1, -1);
      if (G.mode === '2p') drawButton(c, teamCol(1), String(G.score[1]), v.cw - r * 0.82, v.ch - r * 0.82, r, G.pressed[2], -1, -1);
    }
    c.globalAlpha = 1;
    if (G.mode === 'bot' && G.bot) {
      var bx = v.cw - pad - 23 * u, by = v.ch - pad - 9 * u;
      D.rrect(c, bx, by, 23 * u, 9 * u, 3 * u); c.fillStyle = G.pressed[2] ? teamCol(1).dark : teamCol(1).main; c.fill();
      c.lineWidth = Math.max(2.5, u * 0.6); c.strokeStyle = INK; c.stroke();
      D.textOutlined(c, 'BOT ' + LEVEL_NAMES[G.bot.level], bx + 11.5 * u, by + 4.7 * u, 3.6 * u, '#ffffff', INK);
    }
    drawPlayerMarks(c, u, w);
    drawBallArrows(c, u, A, w);
    // banners
    if (G.state === 'intro') {
      var ti = Math.min(1, (1.6 - G.timer) / 0.35), sc = easeBack(ti);
      var title = A.map.icon + ' ' + A.map.name.toUpperCase();
      var subTxt = G.modName ? 'Biến thể: ' + G.modName : 'Ván ' + G.round;
      banner(c, u, cx, v.ch * 0.36, title, subTxt, sc);
    } else if (G.state === 'scored' && (G.scorer >= 0 || G.noPoint)) {
      var t2 = Math.min(1, (1.9 - G.timer) / 0.4), s2 = easeBack(t2);
      var wcol = G.noPoint ? '#ffd23f' : (G.mode === 'ffa' && G.credit >= 0 ? Meta.color(G.credit).main : teamCol(G.scorer).main);
      var sub = G.sub;
      if (G.noPoint) { /* nobody scores */ }
      else if (G.mode === 'ffa') sub = (G.credit >= 0 ? nameOf(G.credit) + ' +1' : 'Không ai được điểm') + (G.sub ? ' · ' + G.sub : '');
      else if (G.mode === 'team4') sub = (G.scorer === 0 ? nameOf(0) + ' + ' + nameOf(1) : nameOf(2) + ' + ' + nameOf(3)) + ' +1' + (G.sub ? ' · ' + G.sub : '');
      c.save(); c.translate(cx, v.ch * 0.38); c.scale(s2, s2); c.rotate(-0.06);
      D.textOutlined(c, G.word, 0, 0, 16 * u, wcol, '#ffffff');
      if (sub) D.textOutlined(c, sub, 0, 12 * u, 5.2 * u, '#ffffff', INK);
      c.restore();
    }
    drawRedropWarning(c, u, cx);
    if (G.noteT > 0 && G.note && G.state !== 'intro') {
      var s3 = easeBack(Math.min(1, (1.4 - G.noteT) / 0.3));
      c.save(); c.translate(cx, v.ch * (G.state === 'scored' || G.mode === 'tutorial' ? 0.62 : 0.3)); c.scale(Math.max(0, s3), Math.max(0, s3));
      D.textOutlined(c, G.note, 0, 0, 7 * u, '#ffd23f', INK);
      c.restore();
    }
  }
  // The black film bars of a replay or highlight. All their text is written inside the bars, so nothing covers the
  // pitch: the holes of the film run along the outer edge, the text in the rest of the bar.
  var SLOW_TXT = '🐢 QUAY CHẬM';
  function barH(u) { return 10 * u; }
  function barTextY(u) { return 6.1 * u; } // middle of the text band of the top bar (the bottom bar mirrors it)
  function replayBars(c, u) {
    var v = view, bar = barH(u), hole = 1.4 * u;
    c.fillStyle = 'rgba(0,0,0,0.82)'; c.fillRect(0, 0, v.cw, bar); c.fillRect(0, v.ch - bar, v.cw, bar);
    c.fillStyle = 'rgba(255,255,255,0.8)';
    for (var x = 10; x < v.cw; x += 26) { c.fillRect(x, 0.7 * u, 12, hole); c.fillRect(x, v.ch - 0.7 * u - hole, 12, hole); }
    return bar;
  }
  function textW(txt, fs) { ctx.font = '900 ' + fs + 'px ' + D.FONT; return ctx.measureText(txt).width; }
  // text in a bar, aligned left / right / center at x; shrunk to fit `room` when given; returns its width
  function barText(c, txt, x, y, fs, fill, align, room) {
    if (!txt) return 0;
    var w = textW(txt, fs);
    if (room && w > room) { fs *= Math.max(0.55, room / w); w = textW(txt, fs); }
    D.textOutlined(c, txt, align === 'left' ? x + w / 2 : (align === 'right' ? x - w / 2 : x), y, fs, fill, '#000000');
    return w;
  }
  // a team colour that reads on the black bar
  function onBlack(col) { return lum(col.main) > 0.25 ? col.main : '#ffffff'; }
  // middle of the bottom bar: the moment's word ("VÀO! ✔", "CỨU THUA!"…) while it flashes, otherwise the commentary
  function barMiddle(c, u, y, text, room) {
    var fl = G.flash;
    if (fl && fl.t < 1.7) barText(c, fl.txt, view.cw / 2, y, 4.4 * u * (0.7 + 0.3 * easeBack(Math.min(1, fl.t / 0.25))), onBlack(fl.col), 'center', room);
    else barText(c, text, view.cw / 2, y, 4 * u, '#ffffff', 'center', room);
  }
  function drawReplayHUD(c, u, cx) {
    var v = view, pad = 3 * u;
    replayBars(c, u);
    var ty = barTextY(u), by = v.ch - ty;
    barText(c, '🎬 PHÁT LẠI', pad, ty, 3.8 * u, '#ff5050', 'left');
    if (G.replay && G.replay.speed < 0.7) barText(c, SLOW_TXT, pad, by, 3.4 * u, '#ffd23f', 'left');
    var tw = barText(c, 'Chạm để bỏ qua ⏭', v.cw - pad, by, 3.2 * u, '#ffffff', 'right');
    barMiddle(c, u, by, G.noPoint ? G.word : (G.sub || G.word), v.cw - 2 * (Math.max(textW(SLOW_TXT, 3.4 * u), tw) + pad) - 4 * u);
  }

  // ---------- render ----------
  var lastT = 0, clock = 0;
  function render(dt) {
    var v = view, c = ctx, w = G.world, A = w ? w.arena : null, m = A ? A.map : E.MAPS[0];
    clock += dt;
    c.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    var gy = v.oy + GROUND * v.s;
    var grad = c.createLinearGradient(0, 0, 0, gy);
    grad.addColorStop(0, m.sky[0]); grad.addColorStop(1, m.sky[1]);
    c.fillStyle = grad; c.fillRect(0, 0, v.cw, v.ch);
    var shx = 0, shy = 0;
    if (G.shake > 0) { shx = (Math.random() - 0.5) * 16 * G.shake; shy = (Math.random() - 0.5) * 10 * G.shake; }
    c.setTransform(v.dpr * v.s, 0, 0, v.dpr * v.s, v.dpr * (v.ox + shx), v.dpr * (v.oy + shy));
    var x0 = -v.ox / v.s - 30, x1 = (v.cw - v.ox) / v.s + 30, bottom = (v.ch - v.oy) / v.s + 30;
    D.background(c, m, x0, x1, bottom, clock, G.excite);
    if (isDark()) { var top = -v.oy / v.s - 30; c.fillStyle = 'rgba(6, 12, 32, 0.38)'; c.fillRect(x0, top, x1 - x0, bottom - top); }
    if (w) {
      drawWorld(c, w, dt);
      for (var i = 0; i < G.parts.length; i++) {
        var q = G.parts[i], k = q.life / q.max;
        c.globalAlpha = Math.min(1, k * 2);
        c.fillStyle = q.col;
        if (q.kind === 'ring') { c.strokeStyle = q.col; c.lineWidth = 3 + 7 * k; D.circle(c, q.x, q.y, q.size + (1 - k) * 110); c.stroke(); }
        else if (q.kind === 'conf') { c.save(); c.translate(q.x, q.y); c.rotate(q.rot); c.fillRect(-q.size / 2, -q.size / 4, q.size, q.size / 2); c.restore(); }
        else if (q.kind === 'smoke') { D.circle(c, q.x, q.y, q.size * (1.8 - k)); c.fill(); }
        else { D.circle(c, q.x, q.y, q.size * (q.kind === 'spark' ? k : 1)); c.fill(); }
      }
      c.globalAlpha = 1;
      if (G.flash && playback()) G.flash.t += dt; // its word is written in the bottom bar, the rings stay around the ball
    }
    c.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    if (w && !G.demo) {
      var wv = wxView();
      D.fog(c, wv.fog, v.cw, v.ch, clock);
      var sf = playback() ? (wv.bolt ? 0.6 * Math.max(0, 1 - wv.bolt.age / 0.35) : 0) : G.screenFlash;
      if (sf > 0) { c.fillStyle = 'rgba(255,255,240,' + Math.min(0.85, sf) + ')'; c.fillRect(0, 0, v.cw, v.ch); }
    }
    drawHUD(c, A, w);
    if (G.fade > 0) { c.fillStyle = 'rgba(255,255,255,' + G.fade + ')'; c.fillRect(0, 0, v.cw, v.ch); }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    var dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0.016;
    lastT = now;
    var t0 = performance.now();
    update(dt);
    var t1 = performance.now();
    render(dt);
    var t2 = performance.now();
    G.perfUpd += (t1 - t0 - G.perfUpd) * 0.05; G.perfRen += (t2 - t1 - G.perfRen) * 0.05;
  }

  refreshMenu();
  startDemo();
  show('menu');
  if (!Meta.D.tutorialDone && !Meta.D.tutorialSkipped) show('firstRun');
  requestAnimationFrame(frame);
  window.__game = G;
  // for the automated tests: step the game without waiting for the screen
  window.__api = { startMatch: startMatch, startTutorial: startTutorial, toMenu: toMenu, endMatch: endMatch, onScore: onScore,
    step: function (dt, n) { for (var i = 0; i < (n || 1); i++) update(dt); },
    weather: { trigger: triggerWeather, start: startPhenomenon, strike: doStrike } };
})();
