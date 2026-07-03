// Sonido: ambientes por nivel (audio real de la wiki si existe; si no, síntesis
// por bioma) y efectos sintetizados con WebAudio. Cero archivos obligatorios.
// Overrides: game/assets/sounds/<nombre>.(mp3|ogg|wav) sustituye al sintetizado.
(function () {
  let ctx = null, master = null;
  let muted = false;
  try { muted = localStorage.getItem('backrooms-mute') === '1'; } catch (e) {}
  let ambientStop = null;
  let heartbeatOn = false;
  const overrides = {}; // nombre -> HTMLAudio listo

  const NOMBRES = ['paso', 'golpe', 'dano', 'recoger', 'dado', 'puerta', 'registrar', 'muerte', 'victoria', 'latido'];

  // detecta overrides del usuario (silencioso si no existen)
  for (const n of NOMBRES) {
    for (const ext of ['mp3', 'ogg', 'wav']) {
      const el = new window.Audio();
      el.addEventListener('canplaythrough', () => { if (!overrides[n]) overrides[n] = el; }, { once: true });
      el.src = 'assets/sounds/' + n + '.' + ext;
      el.preload = 'auto';
    }
  }

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return true;
    } catch (e) { return false; }
  }

  function unlock() {
    try {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) {}
  }

  // ---------- bloques de síntesis ----------
  function noiseBuffer(dur) {
    const b = ctx.createBuffer(1, Math.max(1, ctx.sampleRate * dur), ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  function ruido(dur, freq, gain, type = 'lowpass', slideTo) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq;
    if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(f).connect(g).connect(master);
    src.start();
  }

  function tono(freq, dur, gain, type = 'sine', slideTo) {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(master);
    o.start(); o.stop(ctx.currentTime + dur + 0.05);
  }

  let pasoAlt = false;
  const SYNTH = {
    paso() { pasoAlt = !pasoAlt; ruido(0.09, pasoAlt ? 900 : 700, 0.10); },
    golpe() { tono(90, 0.18, 0.5, 'triangle', 45); ruido(0.16, 1600, 0.28, 'bandpass'); },
    dano() { tono(160, 0.22, 0.32, 'sawtooth', 70); },
    recoger() { tono(660, 0.09, 0.2, 'sine'); setTimeout(() => ctx && tono(990, 0.12, 0.18), 70); },
    dado() {
      for (let i = 0; i < 6; i++)
        setTimeout(() => ctx && ruido(0.05, 2500 + Math.random() * 1500, 0.12, 'bandpass'), i * 110 + Math.random() * 40);
    },
    puerta() { ruido(0.35, 300, 0.22, 'lowpass', 90); tono(70, 0.3, 0.22, 'sine', 45); },
    registrar() { ruido(0.28, 1800, 0.14, 'bandpass', 500); tono(210, 0.12, 0.1, 'square', 190); },
    muerte() { tono(220, 1.4, 0.4, 'sawtooth', 40); ruido(1.2, 500, 0.2, 'lowpass', 60); },
    victoria() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => ctx && tono(f, 0.5, 0.2), i * 160));
    },
    latido() { tono(55, 0.12, 0.5, 'sine', 40); setTimeout(() => ctx && tono(50, 0.14, 0.4, 'sine', 38), 180); },
  };

  function play(nombre) {
    try {
      if (muted) return;
      const ov = overrides[nombre];
      if (ov) { const el = ov.cloneNode(); el.volume = 0.5; el.play().catch(() => {}); return; }
      if (!ctx) return;
      SYNTH[nombre]?.();
    } catch (e) {}
  }

  // ---------- ambiente por nivel ----------
  function stopAmbient() {
    try { ambientStop?.(); } catch (e) {}
    ambientStop = null;
  }

  function ambientSynth(levelDef) {
    if (!ctx) return;
    const nodes = [];
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 2);
    g.connect(master);
    const bioma = levelDef.bioma;
    const psico = (levelDef.reglas || []).some((r) => ['aislamiento', 'vigilado', 'tiempo_raro', 'alucinaciones'].includes(r));

    if (['pasillos', 'hospital', 'oficinas', 'garaje'].includes(bioma)) {
      // zumbido fluorescente: 120 Hz + armónico desafinado + soplo agudo
      for (const [f, v, ty] of [[120, 0.5, 'sawtooth'], [241.5, 0.18, 'sine'], [363, 0.06, 'sine']]) {
        const o = ctx.createOscillator();
        o.type = ty; o.frequency.value = f;
        const og = ctx.createGain(); og.gain.value = v;
        o.connect(og).connect(g); o.start();
        nodes.push(o);
      }
      const n = ctx.createBufferSource();
      n.buffer = noiseBuffer(2); n.loop = true;
      const nf = ctx.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 6000;
      const ng = ctx.createGain(); ng.gain.value = 0.02;
      n.connect(nf).connect(ng).connect(g); n.start();
      nodes.push(n);
    } else if (bioma === 'tuneles') {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 68;
      const og = ctx.createGain(); og.gain.value = 0.5;
      o.connect(og).connect(g); o.start(); nodes.push(o);
      const drip = setInterval(() => {
        if (!muted && ctx) tono(1200 + Math.random() * 800, 0.06, 0.05, 'sine', 500);
      }, 2600 + Math.random() * 1500);
      nodes.push({ stop: () => clearInterval(drip) });
    } else {
      // viento: ruido filtrado con LFO lento (exterior, bosque, ciudad, torres)
      const n = ctx.createBufferSource();
      n.buffer = noiseBuffer(3); n.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 400; f.Q.value = 0.6;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;
      const lg = ctx.createGain(); lg.gain.value = 220;
      lfo.connect(lg).connect(f.frequency); lfo.start();
      const ng = ctx.createGain(); ng.gain.value = 0.6;
      n.connect(f).connect(ng).connect(g); n.start();
      nodes.push(n, lfo);
    }
    if (psico || levelDef.oscuridad > 0.7) {
      const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 42;
      const sg = ctx.createGain(); sg.gain.value = 0.25;
      sub.connect(sg).connect(g); sub.start(); nodes.push(sub);
    }
    ambientStop = () => {
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
      setTimeout(() => nodes.forEach((x) => { try { x.stop(); } catch (e) {} }), 700);
    };
  }

  function ambient(levelDef) {
    try {
      stopAmbient();
      if (muted) return;
      const wikiSrc = (window.AUDIO_MANIFEST || {})[levelDef.id];
      if (wikiSrc) {
        const el = new window.Audio(wikiSrc);
        el.loop = true; el.volume = 0.32;
        el.play().catch(() => {});
        ambientStop = () => { el.pause(); el.src = ''; };
        return;
      }
      if (ctx) ambientSynth(levelDef);
    } catch (e) {}
  }

  // latido con cordura baja
  setInterval(() => {
    try {
      const w = window.Game?.world;
      if (!w || !w.player || w.over || muted || !ctx) return;
      if (w.player.cordura < 25 && w.level) SYNTH.latido();
    } catch (e) {}
  }, 1600);

  function toggleMute() {
    muted = !muted;
    try { localStorage.setItem('backrooms-mute', muted ? '1' : '0'); } catch (e) {}
    if (master) master.gain.value = muted ? 0 : 0.5;
    if (muted) stopAmbient();
    else if (window.Game?.world?.level) ambient(window.Game.world.level);
    return muted;
  }

  window.Sfx = { unlock, play, ambient, stopAmbient, toggleMute, get muted() { return muted; } };
})();
