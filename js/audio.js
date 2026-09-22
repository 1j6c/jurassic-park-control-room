/* Moteur audio : tout est synthétisé (aucun fichier), sauf la voix enregistrée de Nedry. */
JP.audio = (() => {
  let ctx = null, master = null, noise = null;
  const live = { hum: null, rain: null, alarm: null };
  let voiceBuf = null, ringHz = 42;
  let playing = [];

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = JP.state.muted ? 0 : 0.7;
      master.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  const ready = () => !!ctx;

  function tone({ freq = 440, type = 'square', dur = 0.1, vol = 0.1, attack = 0.005, slideTo = null, dest = null }) {
    const c = ensure(), o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || master);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  function burst({ dur = 0.1, vol = 0.2, filter = 'bandpass', freq = 2000, q = 1, attack = 0.002, dest = null }) {
    const c = ensure(), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime;
    s.buffer = noise; s.loop = true;
    f.type = filter; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || master);
    s.start(t); s.stop(t + dur + 0.05);
  }
  function distortionCurve(k) {
    const n = 2048, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (3 + k) * x * 20 * (Math.PI / 180) / (Math.PI + k * Math.abs(x)); }
    return c;
  }

  /* ---- bruitages ---- */
  const click = () => { if (!ready()) return; burst({ dur: 0.025, vol: 0.09, freq: 3200, q: 0.7 }); };
  const beep = (f = 880) => tone({ freq: f, type: 'square', dur: 0.09, vol: 0.07 });
  const error = () => { tone({ freq: 220, type: 'square', dur: 0.22, vol: 0.09 }); setTimeout(() => tone({ freq: 165, type: 'square', dur: 0.3, vol: 0.09 }), 120); };
  const blip = () => tone({ freq: JP.rand(1200, 2400), type: 'sine', dur: 0.04, vol: 0.05 });
  const clunk = () => { burst({ dur: 0.18, vol: 0.5, filter: 'lowpass', freq: 220, q: 0.6 }); tone({ freq: 70, type: 'sine', dur: 0.25, vol: 0.3 }); };
  const chime = () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => setTimeout(() => tone({ freq: f, type: 'sine', dur: 1.6, vol: 0.12, attack: 0.02 }), i * 130));
    setTimeout(() => tone({ freq: 261.6, type: 'triangle', dur: 2.2, vol: 0.08, attack: 0.05 }), 0);
  };
  const modem = () => { for (let i = 0; i < 9; i++) setTimeout(blip, i * 55); };

  function hum(on) {
    if (on && !live.hum) {
      const c = ensure(), g = c.createGain(); g.gain.value = 0.0001; g.connect(master);
      const o1 = c.createOscillator(); o1.frequency.value = 60; o1.type = 'sine';
      const o2 = c.createOscillator(); o2.frequency.value = 120; o2.type = 'sine';
      const g2 = c.createGain(); g2.gain.value = 0.35;
      const s = c.createBufferSource(); s.buffer = noise; s.loop = true;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 380;
      const gs = c.createGain(); gs.gain.value = 0.5;
      o1.connect(g); o2.connect(g2); g2.connect(g); s.connect(f); f.connect(gs); gs.connect(g);
      o1.start(); o2.start(); s.start();
      g.gain.exponentialRampToValueAtTime(0.03, c.currentTime + 2);
      live.hum = { g, stop() { g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.6); setTimeout(() => { o1.stop(); o2.stop(); s.stop(); }, 700); } };
    } else if (!on && live.hum) { live.hum.stop(); live.hum = null; }
  }
  function rain(level) {
    if (!ready()) return;
    if (!live.rain) {
      const c = ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = noise; s.loop = true; f.type = 'highpass'; f.frequency.value = 1400; g.gain.value = 0.0001;
      s.connect(f); f.connect(g); g.connect(master); s.start();
      live.rain = { g };
    }
    live.rain.g.gain.linearRampToValueAtTime(Math.max(0.0001, level * 0.07), ctx.currentTime + 1.5);
  }
  function thunder(distanceMi = 5) {
    if (!ready()) return;
    JP.bus.emit('flash');
    const delay = Math.min(4, distanceMi * 0.35) * 1000;
    setTimeout(() => {
      burst({ dur: 2.2 + JP.rand(0, 1.5), vol: JP.clamp(0.7 - distanceMi * 0.05, 0.15, 0.7), filter: 'lowpass', freq: 160, q: 0.5, attack: 0.03 });
      tone({ freq: 38, type: 'sine', dur: 2.4, vol: 0.28, attack: 0.05 });
      if (distanceMi < 4) burst({ dur: 0.35, vol: 0.35, filter: 'bandpass', freq: 900, q: 0.8 });
    }, delay);
  }
  function alarm(on) {
    if (on && !live.alarm) {
      const c = ensure(), o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sawtooth'; o.frequency.value = 520; f.type = 'lowpass'; f.frequency.value = 1300; g.gain.value = 0.045;
      o.connect(f); f.connect(g); g.connect(master); o.start();
      let hi = true;
      const iv = setInterval(() => { hi = !hi; o.frequency.setTargetAtTime(hi ? 520 : 390, c.currentTime, 0.02); }, 480);
      live.alarm = { stop() { clearInterval(iv); g.gain.setTargetAtTime(0.0001, c.currentTime, 0.05); setTimeout(() => o.stop(), 300); } };
    } else if (!on && live.alarm) { live.alarm.stop(); live.alarm = null; }
  }
  function thump() {
    if (!ready()) return;
    tone({ freq: 40, type: 'sine', dur: 1.1, vol: 0.7, attack: 0.012, slideTo: 28 });
    burst({ dur: 0.22, vol: 0.4, filter: 'lowpass', freq: 110, q: 0.7 });
    JP.bus.emit('thump');
  }
  function roar() {
    if (!ready()) return;
    const c = ctx, sh = c.createWaveShaper(); sh.curve = distortionCurve(30);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
    const g = c.createGain(); g.gain.value = 1; sh.connect(f); f.connect(g); g.connect(master);
    tone({ freq: 140, type: 'sawtooth', dur: 1.6, vol: 0.22, attack: 0.08, slideTo: 55, dest: sh });
    tone({ freq: 95, type: 'sawtooth', dur: 1.8, vol: 0.18, attack: 0.1, slideTo: 40, dest: sh });
    burst({ dur: 1.5, vol: 0.14, filter: 'bandpass', freq: 420, q: 0.6, attack: 0.1 });
  }
  function setMuted(m) {
    JP.state.muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.7, ctx.currentTime, 0.05);
    document.getElementById('cb-mute')?.classList.toggle('off', m);
  }

  /* ---- Voix de Nedry ---- */
  async function loadVoice(dataUrl) {
    const c = ensure();
    const buf = await (await fetch(dataUrl)).arrayBuffer();
    voiceBuf = await c.decodeAudioData(buf);
    return voiceBuf;
  }
  function hasVoice() { return !!voiceBuf; }
  function clearVoice() { voiceBuf = null; }
  function setRingHz(hz) { ringHz = hz; }

  /* Joue la voix enregistrée dans un modulateur en anneau. Retourne {analyser, done: Promise} */
  function speakVoice() {
    const c = ensure();
    const src = c.createBufferSource(); src.buffer = voiceBuf; src.playbackRate.value = 0.9;
    const ring = c.createGain(); ring.gain.value = 0;
    const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = ringHz; osc.connect(ring.gain);
    const sh = c.createWaveShaper(); sh.curve = distortionCurve(16); sh.oversample = '2x';
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3400;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 180;
    const out = c.createGain(); out.gain.value = 2.4;
    const an = c.createAnalyser(); an.fftSize = 512;
    src.connect(ring); ring.connect(sh); sh.connect(hp); hp.connect(lp); lp.connect(out); out.connect(an); an.connect(master);
    osc.start(); src.start();
    const h = { src, osc };
    playing.push(h);
    const done = new Promise(res => { src.onended = () => { try { osc.stop(); } catch {} playing = playing.filter(x => x !== h); res(); }; });
    return { analyser: an, done, duration: voiceBuf.duration / 0.9 };
  }
  function stopVoice() {
    playing.forEach(h => { try { h.src.stop(); h.osc.stop(); } catch {} });
    playing = [];
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }
  /* Synthèse vocale de secours */
  function tts(text, lang) {
    if (!('speechSynthesis' in window)) return { done: Promise.resolve(), duration: 2.5 };
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'en' ? 'en-US' : 'fr-FR'; u.rate = 0.92; u.pitch = lang === 'en' ? 0.5 : 0.25; u.volume = JP.state.muted ? 0 : 1;
    const voices = speechSynthesis.getVoices();
    const pref = lang === 'en' ? /Zarvox|Trinoids|Fred|Ralph/ : /Thomas|Jacques/;
    const v = voices.find(x => /^(fr|en)/i.test(x.lang) && x.lang.startsWith(u.lang.slice(0, 2)) && pref.test(x.name))
           || voices.find(x => x.lang.startsWith(u.lang.slice(0, 2)));
    if (v) u.voice = v;
    const done = new Promise(res => { u.onend = res; u.onerror = res; });
    speechSynthesis.speak(u);
    return { done, duration: Math.max(2.2, text.length * 0.07) };
  }
  if ('speechSynthesis' in window) { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices(); }

  /* Enregistrement micro (secondes) → dataURL */
  function record(seconds, onTick) {
    return new Promise(async (resolve, reject) => {
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
      catch (e) { reject(e); return; }
      const rec = new MediaRecorder(stream), chunks = [];
      rec.ondataavailable = e => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType });
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
      };
      rec.start();
      let n = seconds; onTick?.(n);
      const iv = setInterval(() => { n--; if (n > 0) onTick?.(n); else { clearInterval(iv); rec.stop(); } }, 1000);
    });
  }

  return { ensure, ready, click, beep, error, blip, clunk, chime, modem, hum, rain, thunder, alarm, thump, roar, setMuted,
           loadVoice, hasVoice, clearVoice, setRingHz, speakVoice, stopVoice, tts, record };
})();
