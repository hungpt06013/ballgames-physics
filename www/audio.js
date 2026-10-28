/* Ballgames Physics – sound effects, procedural background music and crowd ambience. */
(function () {
  'use strict';

  // music styles: tempo, root note (MIDI), scale, chord progression (scale degrees per bar)
  var STYLES = {
    sport: { bpm: 122, root: 60, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 5, 3, 4], lead: 'square', kick: [0, 8], seed: 3 },
    beach: { bpm: 104, root: 65, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 3, 4, 0], lead: 'triangle', kick: [0, 10], seed: 7 },
    space: { bpm: 84, root: 57, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 2, 6], lead: 'sine', kick: [0], seed: 11 },
    arena: { bpm: 134, root: 52, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 0, 5, 6], lead: 'sawtooth', kick: [0, 6, 8, 14], seed: 5 },
    menu: { bpm: 112, root: 62, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 4, 5, 3], lead: 'triangle', kick: [0, 8], seed: 13 }
  };
  var STYLE_FOR_MAP = { volley: 'beach', moon: 'space', bomb: 'arena' };

  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  var S = {
    ac: null, master: null, sfx: null, mus: null, sfxOn: true, musicOn: true, quiet: false, last: {},
    init: function () {
      if (!this.ac) {
        try {
          var AC = window.AudioContext || window.webkitAudioContext;
          if (AC) {
            var ac = this.ac = new AC();
            this.master = ac.createGain(); this.master.gain.value = 0.8; this.master.connect(ac.destination);
            this.sfx = ac.createGain(); this.sfx.gain.value = 0.85; this.sfx.connect(this.master);
            this.mus = ac.createGain(); this.mus.gain.value = this.musicOn ? 0.16 : 0; this.mus.connect(this.master);
          }
        } catch (e) { this.ac = null; }
      }
      if (this.ac && this.ac.state === 'suspended') this.ac.resume();
      if (this.ac && !this.timer) {
        var self = this;
        this.timer = setInterval(function () { self.tick(); }, 30);
      }
    },
    ok: function (name, gap) {
      if (!this.sfxOn || !this.ac || this.quiet) return false;
      var t = this.ac.currentTime;
      if (this.last[name] && t - this.last[name] < gap) return false;
      this.last[name] = t; return true;
    },
    tone: function (f0, f1, dur, type, vol, delay, dest) {
      var ac = this.ac, t = ac.currentTime + (delay || 0);
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest || this.sfx); o.start(t); o.stop(t + dur + 0.03);
    },
    noiseBuf: function () {
      if (!this.nbuf) {
        var ac = this.ac, n = ac.sampleRate * 2; this.nbuf = ac.createBuffer(1, n, ac.sampleRate);
        var d = this.nbuf.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      }
      return this.nbuf;
    },
    noise: function (dur, vol, freq, q, delay, attack, dest, when) {
      var ac = this.ac, t = when || ac.currentTime + (delay || 0);
      var s = ac.createBufferSource(); s.buffer = this.noiseBuf();
      var fl = ac.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = freq; fl.Q.value = q || 1;
      var g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + (attack || 0.005));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(fl); fl.connect(g); g.connect(dest || this.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    },
    // ---- effects ----
    kick: function (v, boost) { if (!this.ok('kick', 0.05)) return; var k = Math.min(1, v / 1500); this.tone(170, 55, 0.14, 'sine', 0.25 + 0.5 * k); this.noise(0.05, 0.12 + 0.2 * k, 1800, 0.8); if (boost) this.noise(0.3, 0.25, 600, 0.7); },
    bounce: function (v) { if (!this.ok('bounce', 0.06)) return; var k = Math.min(1, v / 1200); this.tone(125, 70, 0.09, 'sine', 0.08 + 0.3 * k); },
    post: function () { if (!this.ok('post', 0.08)) return; this.tone(1250, 1180, 0.35, 'triangle', 0.22); this.tone(1870, 1800, 0.25, 'sine', 0.08); },
    jump: function () { if (!this.ok('jump', 0.09)) return; this.tone(240, 420, 0.08, 'sine', 0.04); },
    whistle: function () { if (!this.ok('whistle', 0.3)) return; this.tone(2350, 2250, 0.16, 'square', 0.04); this.tone(2350, 2250, 0.38, 'square', 0.04, 0.2); },
    cheer: function () { if (!this.ok('cheer', 0.5)) return; this.noise(1.8, 0.3, 1100, 0.6, 0, 0.25); this.noise(1.4, 0.12, 2600, 0.9, 0.1, 0.2); },
    click: function () { if (!this.sfxOn || !this.ac) return; this.tone(700, 520, 0.05, 'square', 0.04); },
    pickup: function () { if (!this.ok('pickup', 0.2)) return; var n = [72, 76, 79, 84]; for (var i = 0; i < 4; i++) this.tone(midi(n[i]), midi(n[i]), 0.12, 'square', 0.06, i * 0.06); },
    freeze: function () { if (!this.ok('freeze', 0.3)) return; for (var i = 0; i < 6; i++) this.tone(2400 - i * 250, 2200 - i * 250, 0.1, 'sine', 0.06, i * 0.04); },
    explode: function () { if (!this.ok('explode', 0.3)) return; this.noise(1.2, 0.6, 180, 0.5, 0, 0.01); this.tone(110, 30, 0.8, 'sine', 0.6); this.noise(0.5, 0.3, 1200, 0.6); },
    shield: function () { if (!this.ok('shield', 0.1)) return; this.tone(900, 1300, 0.15, 'triangle', 0.12); },
    coin: function () { if (!this.sfxOn || !this.ac) return; this.tone(midi(83), midi(83), 0.07, 'square', 0.05); this.tone(midi(88), midi(88), 0.18, 'square', 0.05, 0.07); },
    star: function (i) { if (!this.sfxOn || !this.ac) return; this.tone(midi(76 + i * 4), midi(76 + i * 4), 0.3, 'triangle', 0.15, i * 0.25); },
    beep: function (hi) { if (!this.ok('beep', 0.2)) return; this.tone(hi ? 1320 : 880, hi ? 1320 : 880, hi ? 0.4 : 0.12, 'square', 0.05); },
    // weather / disasters
    thunder: function () { if (!this.ok('thunder', 0.3)) return; this.noise(0.25, 0.5, 2600, 0.7, 0, 0.003); this.noise(2.2, 0.45, 140, 0.6, 0.05, 0.05); this.tone(70, 35, 1.6, 'sine', 0.35, 0.05); },
    rumble: function () { if (!this.ok('rumble', 0.8)) return; this.noise(1.6, 0.3, 90, 0.8, 0, 0.2); this.noise(1.2, 0.12, 400, 0.6, 0.2, 0.2); },
    whoosh: function () { if (!this.ok('whoosh', 1)) return; this.noise(2.2, 0.22, 700, 1.4, 0, 0.5); this.noise(2, 0.12, 1500, 2, 0.3, 0.6); },
    buzzer: function () { if (!this.ok('buzzer', 0.5)) return; this.tone(220, 210, 0.9, 'sawtooth', 0.12); this.tone(277, 270, 0.9, 'sawtooth', 0.08); },
    // ---- crowd ambience ----
    setCrowd: function (on) {
      if (!this.ac) return;
      var want = on && this.sfxOn && !this.quiet;
      if (want && !this.crowd) {
        var ac = this.ac, s = ac.createBufferSource(); s.buffer = this.noiseBuf(); s.loop = true;
        var fl = ac.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 850; fl.Q.value = 0.5;
        var g = ac.createGain(); g.gain.value = 0.0001; g.gain.setTargetAtTime(0.035, ac.currentTime, 0.6);
        s.connect(fl); fl.connect(g); g.connect(this.sfx); s.start();
        this.crowd = { s: s, g: g };
      } else if (!want && this.crowd) {
        var c = this.crowd; this.crowd = null;
        c.g.gain.setTargetAtTime(0.0001, this.ac.currentTime, 0.2);
        setTimeout(function () { try { c.s.stop(); } catch (e) { /* already stopped */ } }, 800);
      }
    },
    // ---- music ----
    setMusic: function (on) {
      this.musicOn = on;
      if (this.mus) this.mus.gain.setTargetAtTime(on ? 0.16 : 0, this.ac.currentTime, 0.1);
    },
    style: 'menu', step: 0, nextT: 0, bar: 0,
    setStyle: function (mapId) {
      var st = mapId === 'menu' ? 'menu' : (STYLE_FOR_MAP[mapId] || 'sport');
      if (st !== this.style) { this.style = st; this.step = 0; this.bar = 0; this.mel = null; }
    },
    melody: function (st) {
      // a deterministic two-bar motif built from chord tones
      var seed = st.seed, out = [];
      for (var i = 0; i < 32; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        var hit = [0, 3, 6, 8, 10, 12, 14].indexOf(i % 16) >= 0 && (seed % 5) !== 0;
        out.push(hit ? seed % 3 : -1);
      }
      return out;
    },
    tick: function () {
      var ac = this.ac;
      if (!ac || !this.musicOn || ac.state !== 'running') { if (ac) this.nextT = ac.currentTime + 0.05; return; }
      var st = STYLES[this.style], spb = 60 / st.bpm / 4;
      if (!this.mel) this.mel = this.melody(st);
      if (this.nextT < ac.currentTime) this.nextT = ac.currentTime + 0.05;
      while (this.nextT < ac.currentTime + 0.15) {
        this.playStep(st, this.step, this.nextT, spb);
        this.nextT += spb;
        this.step = (this.step + 1) % 16;
        if (this.step === 0) this.bar = (this.bar + 1) % 4;
      }
    },
    playStep: function (st, s, t, spb) {
      var deg = st.prog[this.bar], sc = st.scale, dst = this.mus, dl = Math.max(0, t - this.ac.currentTime);
      function note(d, oct) { var k = ((d % 7) + 7) % 7; return st.root + sc[k] + 12 * (Math.floor(d / 7) + oct); }
      var chord = [note(deg, 0), note(deg + 2, 0), note(deg + 4, 0)];
      if (s === 0 || s === 6 || s === 8 || s === 14) this.tone(midi(chord[0] - 24), midi(chord[0] - 24), spb * 1.8, 'triangle', 0.5, dl, dst);
      if (st.kick.indexOf(s) >= 0) this.tone(150, 45, 0.16, 'sine', 0.55, dl, dst);
      if (s % 2 === 0) this.noise(0.04, s % 4 === 2 ? 0.12 : 0.06, 7000, 1, 0, 0.002, dst, t);
      if (s === 4 || s === 12) for (var i = 0; i < 3; i++) this.tone(midi(chord[i]), midi(chord[i]), spb * 1.5, 'square', 0.05, dl, dst);
      var m = this.mel[(this.bar % 2) * 16 + s];
      if (m >= 0) this.tone(midi(chord[m] + 12), midi(chord[m] + 12), spb * 1.6, st.lead, st.lead === 'sawtooth' ? 0.06 : 0.1, dl, dst);
    }
  };

  window.BGAudio = S;
})();
