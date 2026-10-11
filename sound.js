(() => {
  'use strict';

  const Y = (window.Yard = window.Yard || {});

  // Tiny synthesised sound effects, so the game needs no audio files.
  let ctx = null;
  let muted = false;

  function context() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (error) {
        return null;
      }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function audio() {
    return muted ? null : context();
  }

  // ---- Music: a jolly little tune with an "oom-pah" bass and a chuffing beat ----------
  const BPM = 132;
  const BEAT = 60 / BPM;
  const hz = midi => 440 * Math.pow(2, (midi - 69) / 12);
  const R = null;
  // Eight bars in C major: [midi note or R for a rest, length in beats].
  const MELODY = [
    [[72, .5], [76, .5], [79, .5], [76, .5], [72, .5], [76, .5], [79, 1]],
    [[81, .5], [79, .5], [77, .5], [76, .5], [74, 1], [72, 1]],
    [[77, .5], [81, .5], [84, .5], [81, .5], [77, .5], [81, .5], [84, 1]],
    [[84, .5], [81, .5], [79, .5], [77, .5], [76, 1], [72, 1]],
    [[74, .5], [77, .5], [79, .5], [77, .5], [74, .5], [77, .5], [79, 1]],
    [[81, .5], [79, .5], [77, .5], [76, .5], [74, 1], [71, 1]],
    [[72, .5], [76, .5], [79, .5], [84, .5], [79, .5], [76, .5], [72, 1]],
    [[74, 1], [71, 1], [72, 2]]
  ];
  // Bass note and the two chord notes played on the off-beats, per bar.
  const CHORDS = {
    C: { root: 48, chord: [64, 67] },
    F: { root: 41, chord: [65, 69] },
    G: { root: 43, chord: [62, 71] }
  };
  const BARS = ['C', 'C', 'F', 'C', 'G', 'G', 'C', 'C'];

  let musicOn = true;
  let musicGain = null;
  let musicTimer = null;
  let nextLoopAt = 0;
  let pass = 0;

  function note(out, midi, start, length, type, volume) {
    const a = ctx;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type;
    osc.frequency.value = hz(midi);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    osc.connect(gain).connect(out);
    osc.start(start);
    osc.stop(start + length + 0.03);
  }

  function chug(out, start) {
    const a = ctx;
    const buffer = a.createBuffer(1, Math.floor(a.sampleRate * 0.06), a.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const source = a.createBufferSource();
    const filter = a.createBiquadFilter();
    const gain = a.createGain();
    filter.type = 'bandpass';
    filter.frequency.value = 1400;
    gain.gain.value = 0.12;
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(out);
    source.start(start);
  }

  function scheduleLoop(startAt) {
    const out = musicGain;
    const brighter = pass % 2 === 1;
    MELODY.forEach((bar, barIndex) => {
      const barStart = startAt + barIndex * 4 * BEAT;
      const chord = CHORDS[BARS[barIndex]];
      let t = 0;
      for (const [pitch, beats] of bar) {
        if (pitch !== R) {
          const lift = brighter && barIndex >= 4 ? 12 : 0;
          note(out, pitch + lift, barStart + t * BEAT, beats * BEAT * 0.92, brighter ? 'square' : 'triangle', brighter ? 0.05 : 0.11);
        }
        t += beats;
      }
      for (let beat = 0; beat < 4; beat++) {
        const at = barStart + beat * BEAT;
        if (beat % 2 === 0) note(out, chord.root, at, BEAT * 0.8, 'triangle', 0.2);
        else for (const n of chord.chord) note(out, n, at, BEAT * 0.4, 'square', 0.03);
        chug(out, at);
        chug(out, at + BEAT / 2);
      }
    });
    pass++;
  }

  function tick() {
    if (!musicOn || !ctx) return;
    // Schedule each eight-bar loop a little before the previous one ends.
    while (nextLoopAt < ctx.currentTime + 4) {
      scheduleLoop(nextLoopAt);
      nextLoopAt += MELODY.length * 4 * BEAT;
    }
  }

  function startMusic() {
    if (!musicOn || musicGain) return;
    const a = context();
    if (!a) return;
    musicGain = a.createGain();
    musicGain.gain.value = 0.55;
    musicGain.connect(a.destination);
    nextLoopAt = a.currentTime + 0.1;
    pass = 0;
    tick();
    musicTimer = setInterval(tick, 1000);
  }

  function stopMusic() {
    clearInterval(musicTimer);
    musicTimer = null;
    if (musicGain) {
      const old = musicGain;
      musicGain = null;
      old.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      setTimeout(() => old.disconnect(), 400);
    }
  }

  function tone(freq, start, length, type, volume, slideTo) {
    const a = audio();
    if (!a) return;
    const osc = a.createOscillator();
    const gain = a.createGain();
    const t = a.currentTime + start;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + length);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(gain).connect(a.destination);
    osc.start(t);
    osc.stop(t + length + 0.05);
  }

  function noise(start, length, volume, freq) {
    const a = audio();
    if (!a) return;
    const buffer = a.createBuffer(1, Math.floor(a.sampleRate * length), a.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const source = a.createBufferSource();
    const filter = a.createBiquadFilter();
    const gain = a.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(a.destination);
    source.start(a.currentTime + start);
  }

  // ---- Station announcements (a chime, then a spoken message where the browser can do speech) ----
  let voice = null;
  // Prefer a bright, friendly-sounding English voice (the list differs on every device).
  const FRIENDLY = /(google uk english female|zira|hazel|susan|samantha|karen|tessa|moira|fiona|libby|sonia|female)/i;
  function pickVoice() {
    const voices = window.speechSynthesis.getVoices();
    voice = voices.find(v => /^en/i.test(v.lang) && FRIENDLY.test(v.name)) ||
      voices.find(v => /en[-_]GB/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang)) || null;
  }
  if ('speechSynthesis' in window) {
    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;
  }

  function speak(text, urgent) {
    if (muted || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
    const synth = window.speechSynthesis;
    // Don't talk over the last announcement unless this one is urgent.
    if (synth.speaking && !urgent) return;
    if (urgent) synth.cancel();
    if (!voice) pickVoice();
    const talk = new SpeechSynthesisUtterance(text);
    if (voice) talk.voice = voice;
    talk.lang = voice ? voice.lang : 'en-GB';
    // A high, bouncy, slightly quick voice, like a cartoon station master.
    talk.rate = 1.12;
    talk.pitch = 1.75;
    talk.volume = 0.7;
    synth.speak(talk);
  }

  // ---- Rain: a soft hiss that follows how hard it is raining ----
  let rainGain = null;
  function setRain(amount) {
    if (muted) amount = 0;
    if (!rainGain) {
      if (amount <= 0.02) return;
      const a = context();
      if (!a) return;
      const buffer = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const source = a.createBufferSource();
      const filter = a.createBiquadFilter();
      rainGain = a.createGain();
      filter.type = 'highpass';
      filter.frequency.value = 1800;
      rainGain.gain.value = 0;
      source.buffer = buffer;
      source.loop = true;
      source.connect(filter).connect(rainGain).connect(a.destination);
      source.start();
    }
    rainGain.gain.setTargetAtTime(amount * 0.035, ctx.currentTime, 0.4);
  }

  Y.sound = {
    setMuted(value) {
      muted = value;
      if (value && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    },
    setRain,
    announce(text, urgent = false) {
      if (muted) return;
      // "Ding-dong" before every announcement.
      tone(784, 0, 0.32, 'sine', 0.13);
      tone(622, 0.28, 0.5, 'sine', 0.13);
      setTimeout(() => speak(text, urgent), 700);
    },
    bell() {
      for (let i = 0; i < 4; i++) tone(1568, i * 0.17, 0.2, 'sine', 0.1);
    },
    isMuted: () => muted,
    unlock: () => context(),
    startMusic,
    stopMusic,
    isMusicOn: () => musicOn,
    setMusic(on) {
      musicOn = on;
      if (on) startMusic();
      else stopMusic();
    },
    pick() {
      tone(520, 0, 0.09, 'triangle', 0.18, 700);
    },
    drop() {
      tone(420, 0, 0.1, 'triangle', 0.16, 300);
    },
    deny() {
      tone(200, 0, 0.16, 'square', 0.08, 140);
    },
    couple() {
      noise(0, 0.12, 0.5, 900);
      tone(140, 0, 0.1, 'square', 0.12, 90);
    },
    toot() {
      tone(392, 0, 0.28, 'sawtooth', 0.07);
      tone(494, 0, 0.28, 'sawtooth', 0.06);
    },
    whistle() {
      tone(880, 0, 0.12, 'sine', 0.12, 1100);
      tone(1100, 0.16, 0.34, 'sine', 0.12, 1000);
    },
    ding() {
      tone(988, 0, 0.35, 'sine', 0.16);
      tone(1319, 0.12, 0.45, 'sine', 0.14);
    },
    chuff() {
      noise(0, 0.08, 0.16, 700);
    },
    cheer(stars) {
      for (let i = 0; i < 2 + stars; i++) tone(523 * Math.pow(1.122, i * 2), i * 0.09, 0.2, 'triangle', 0.14);
    },
    sad() {
      tone(330, 0, 0.3, 'triangle', 0.14, 220);
    }
  };
})();
