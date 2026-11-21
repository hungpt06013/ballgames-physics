/* Ballgames Physics – sound effects, procedural background music and crowd ambience. */
(function () {
  'use strict';

  // Music styles - stadium music that drives the match along: tempo, root note (MIDI), scale, chords (scale degree of
  // each bar of an 8-bar section), lead / bass waves, kick and clap steps (16 a bar), stabs: off-beat chord hits,
  // arp: 16th-note arpeggios, gain: overall level
  var MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10], HARM = [0, 2, 3, 5, 7, 8, 11];
  var FOUR = [0, 4, 8, 12];
  var STYLES = {
    sport: { bpm: 148, root: 62, scale: MAJOR, prog: [0, 4, 5, 3, 0, 4, 3, 4], lead: 'square', bass: 'sawtooth', kick: FOUR, clap: [4, 12], stabs: [3, 6, 10], arp: false, seed: 3, gain: 1 },
    beach: { bpm: 128, root: 65, scale: MAJOR, prog: [0, 3, 4, 3, 0, 3, 4, 4], lead: 'triangle', bass: 'triangle', kick: [0, 7, 8], clap: [4, 12], stabs: [2, 6, 10, 14], arp: false, seed: 7, gain: 1 },
    space: { bpm: 134, root: 57, scale: MINOR, prog: [0, 5, 2, 6, 0, 5, 3, 4], lead: 'sine', bass: 'sawtooth', kick: FOUR, clap: [4, 12], stabs: [], arp: true, seed: 11, gain: 1 },
    arena: { bpm: 162, root: 52, scale: HARM, prog: [0, 0, 5, 4, 0, 0, 5, 6], lead: 'sawtooth', bass: 'square', kick: [0, 6, 10], clap: [4, 12], stabs: [3, 11], arp: true, seed: 5, gain: 1 },
    menu: { bpm: 118, root: 60, scale: MAJOR, prog: [0, 4, 5, 3], lead: 'triangle', bass: 'triangle', kick: [0, 8], clap: [4, 12], stabs: [6, 14], arp: false, seed: 13, gain: 0.8 }
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
    // a drowsy player woken with a start: a short high blip
    startle: function () { if (!this.ok('startle', 0.09)) return; this.tone(620, 900, 0.06, 'triangle', 0.035); },
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
    // ---- soundtrack of a highlight video ----
    // log: [{ t, fn, args }] (sound effect fn played at t seconds) and [{ t, crowd: true / false }] (crowd noise on /
    // off); played into an offline context of `seconds`, whatever the sound settings. Resolves to an AudioBuffer
    // (48 kHz stereo), or null where offline audio is missing.
    render: function (log, seconds) {
      var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!OAC || !log) return Promise.resolve(null);
      var rate = 48000, oac;
      try { oac = new OAC(2, Math.max(1, Math.ceil(seconds * rate)), rate); } catch (e) { return Promise.resolve(null); }
      var keep = { ac: this.ac, sfx: this.sfx, nbuf: this.nbuf, last: this.last, quiet: this.quiet, sfxOn: this.sfxOn }, now = 0;
      // the effects read the time from ac.currentTime: here it is the time of the sound being placed
      var clockAc = {
        sampleRate: rate,
        createOscillator: function () { return oac.createOscillator(); },
        createGain: function () { return oac.createGain(); },
        createBufferSource: function () { return oac.createBufferSource(); },
        createBiquadFilter: function () { return oac.createBiquadFilter(); },
        createBuffer: function (c, n, r) { return oac.createBuffer(c, n, r); }
      };
      Object.defineProperty(clockAc, 'currentTime', { get: function () { return now; } });
      var out = oac.createGain(); out.gain.value = 0.68; out.connect(oac.destination);
      this.ac = clockAc; this.sfx = out; this.nbuf = null; this.last = {}; this.quiet = false; this.sfxOn = true;
      try {
        var crowdFrom = -1;
        for (var i = 0; i <= log.length; i++) {
          var e = log[i];
          if (!e || e.crowd !== undefined) {
            var t = e ? e.t : seconds;
            if (crowdFrom >= 0 && (!e || !e.crowd)) { this.crowdSpan(oac, out, crowdFrom, t); crowdFrom = -1; }
            if (e && e.crowd && crowdFrom < 0) crowdFrom = e.t;
            continue;
          }
          now = e.t;
          if (typeof this[e.fn] === 'function') this[e.fn].apply(this, e.args || []);
        }
      } finally {
        for (var k in keep) this[k] = keep[k];
      }
      return oac.startRendering();
    },
    // the crowd noise of the stands, from t0 to t1 (fading in and out)
    crowdSpan: function (oac, dest, t0, t1) {
      if (t1 - t0 < 0.1) return;
      var s = oac.createBufferSource(); s.buffer = this.noiseBuf(); s.loop = true;
      var fl = oac.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 850; fl.Q.value = 0.5;
      var g = oac.createGain();
      g.gain.setValueAtTime(0.0001, t0); g.gain.setTargetAtTime(0.035, t0, 0.3); g.gain.setTargetAtTime(0.0001, Math.max(t0, t1 - 0.3), 0.1);
      s.connect(fl); fl.connect(g); g.connect(dest); s.start(t0); s.stop(t1 + 0.5);
    },
    // ---- music ----
    setMusic: function (on) {
      this.musicOn = on;
      if (this.mus) this.mus.gain.setTargetAtTime(on ? 0.16 : 0, this.ac.currentTime, 0.1);
    },
    styles: STYLES, style: 'menu', step: 0, nextT: 0, bar: 0, hype: false,
    setStyle: function (mapId) {
      var st = mapId === 'menu' ? 'menu' : (STYLE_FOR_MAP[mapId] || 'sport');
      if (st !== this.style) { this.style = st; this.step = 0; this.bar = 0; this.mel = null; }
    },
    // the end of a timed match (or a golden goal): busier drums, the lead an octave up
    setHype: function (on) { this.hype = !!on; },
    melody: function (st) {
      // a deterministic two-bar hook from chord tones: punchy syncopated rhythm, climbing towards the end of the bar
      var seed = st.seed, out = [], rhythm = [0, 2, 3, 6, 8, 10, 11, 14];
      for (var i = 0; i < 32; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        var s16 = i % 16, hit = rhythm.indexOf(s16) >= 0 && (s16 === 0 || (seed % 6) !== 0);
        out.push(hit ? Math.min(3, (seed % 3) + (s16 >= 10 ? 1 : 0)) : -1);
      }
      return out;
    },
    // a note through a low-pass filter that closes after the attack (bass, stabs, lead)
    synth: function (f, dur, type, vol, delay, cut, dest) {
      var ac = this.ac, t = ac.currentTime + (delay || 0);
      var o = ac.createOscillator(), fl = ac.createBiquadFilter(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      fl.type = 'lowpass'; fl.Q.value = 4;
      fl.frequency.setValueAtTime(cut, t); fl.frequency.exponentialRampToValueAtTime(Math.max(120, cut * 0.25), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(fl); fl.connect(g); g.connect(dest || this.mus); o.start(t); o.stop(t + dur + 0.03);
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
        if (this.step === 0) this.bar = (this.bar + 1) % st.prog.length;
      }
    },
    // one 16th-note step: four-on-the-floor kick, claps on 2 and 4, driving hats, an octave-bouncing bass, off-beat
    // chord stabs, the hook (an octave up in the second half of the 8 bars, arpeggios in some styles), a clap roll
    // into every fourth bar and a crash at the top of the section
    playStep: function (st, s, t, spb) {
      var bar = this.bar, deg = st.prog[bar], sc = st.scale, dst = this.mus, dl = Math.max(0, t - this.ac.currentTime);
      var gain = st.gain, hype = this.hype, half = bar >= 4, fill = bar % 4 === 3 && s >= 12;
      function note(d, oct) { var k = ((d % 7) + 7) % 7; return st.root + sc[k] + 12 * (Math.floor(d / 7) + oct); }
      var chord = [note(deg, 0), note(deg + 2, 0), note(deg + 4, 0), note(deg + 7, 0)];
      // drums
      if (st.kick.indexOf(s) >= 0 && !(fill && s > 12)) { this.tone(160, 42, 0.18, 'sine', 0.6 * gain, dl, dst); this.noise(0.012, 0.08 * gain, 3000, 0.7, 0, 0.001, dst, t); }
      if (st.clap.indexOf(s) >= 0) { this.noise(0.13, 0.2 * gain, 1500, 0.8, 0, 0.002, dst, t); this.noise(0.08, 0.1 * gain, 3200, 1, 0, 0.002, dst, t + 0.012); }
      if (fill) this.noise(0.07, (0.08 + 0.05 * (s - 12)) * gain, 1700, 0.9, 0, 0.002, dst, t); // clap roll into the next bar
      if (s % 4 === 2) this.noise(0.09, 0.08 * gain, 7600, 0.9, 0, 0.003, dst, t); // open hat on the off-beat
      else if (s % 2 === 0 || hype || half) this.noise(0.03, (s % 2 ? 0.035 : 0.05) * gain, 9500, 1, 0, 0.002, dst, t);
      if (bar === 0 && s === 0) this.noise(1.1, 0.1 * gain, 6000, 0.5, 0, 0.004, dst, t); // crash
      // octave bass: low root on the beat, an octave up on the off-beat (16ths in the final seconds)
      if (s % 2 === 0 || hype) {
        var bn = chord[0] - (s % 4 === 0 ? 24 : 12);
        this.synth(midi(bn), spb * (hype ? 0.9 : 1.7), st.bass, (st.bass === 'triangle' ? 0.42 : 0.2) * gain, dl, st.bass === 'triangle' ? 3000 : 900, dst);
      }
      // stabs: the chord on the one, and off-beat hits
      if (s === 0 || st.stabs.indexOf(s) >= 0) {
        var len = s === 0 ? spb * 3 : spb * 0.9;
        for (var i = 0; i < 3; i++) this.synth(midi(chord[i]), len, 'sawtooth', 0.035 * gain, dl, s === 0 ? 2600 : 2000, dst);
      }
      // arpeggio: up through the chord, 16ths (second half, or always where the style has it)
      if (st.arp && (half || st.bpm < 140 || hype)) this.synth(midi(chord[s % 4] + 12 + (s % 8 >= 4 ? 12 : 0)), spb * 0.8, st.lead === 'sawtooth' ? 'square' : st.lead, 0.04 * gain, dl, 3500, dst);
      // the hook
      var m = this.mel[(bar % 2) * 16 + s];
      if (m >= 0) {
        var up = (half || hype ? 24 : 12), f = midi(chord[m] + up);
        var lv = (st.lead === 'sawtooth' ? 0.05 : (st.lead === 'square' ? 0.06 : 0.11)) * gain;
        this.synth(f, spb * 1.7, st.lead, lv, dl, 4200, dst);
        if (st.lead === 'square') this.synth(f * 1.005, spb * 1.7, 'sawtooth', lv * 0.5, dl, 3000, dst); // a little detune for width
      }
    }
  };

  window.BGAudio = S;
})();
