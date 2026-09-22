/* whte_rbt.obj : la tête qui bouge, le doigt, la voix robotisée en boucle, les fenêtres qui se multiplient. */
JP.nedry = (() => {
  const PHRASES = { fr: "Ah ah ah ! Tu n'as pas dit le mot magique !", en: "Ah ah ah! You didn't say the magic word!" };
  const TAUNTS = { fr: "Ah ah ah ! « S'il te plaît », ça marche pas non plus, Ray !", en: "Ah ah ah! 'Please' doesn't work either, Ray!" };
  let windows = [], locked = false, loopId = 0, analyser = null, ttsSpeaking = false, jaw = 0, wallIv = null, photoUrl = null;
  const buf = new Uint8Array(512);
  const phrase = () => PHRASES[JP.state.lang] || PHRASES.fr;
  const taunt_ = () => TAUNTS[JP.state.lang] || TAUNTS.fr;

  const CARTOON = `<svg viewBox="0 0 200 200">
    <path d="M14 200 Q100 128 186 200 Z" fill="#2f7a9a"/>
    <g fill="#ffb347" opacity=".9"><circle cx="40" cy="186" r="6"/><circle cx="62" cy="174" r="5"/><circle cx="150" cy="178" r="6"/><circle cx="170" cy="190" r="5"/><circle cx="120" cy="190" r="4"/></g>
    <g fill="#ff6b8a" opacity=".85"><circle cx="30" cy="196" r="4"/><circle cx="80" cy="192" r="5"/><circle cx="160" cy="168" r="4"/><circle cx="185" cy="180" r="3"/></g>
    <rect x="72" y="150" width="56" height="34" fill="#eab887"/>
    <path d="M86 176 L100 200 L114 176 Z" fill="#fff"/>
    <ellipse cx="100" cy="100" rx="66" ry="74" fill="#f3c9a4"/>
    <ellipse cx="100" cy="164" rx="42" ry="13" fill="#e9b48a"/>
    <ellipse cx="60" cy="116" rx="14" ry="9" fill="#f0a08a" opacity=".6"/><ellipse cx="140" cy="116" rx="14" ry="9" fill="#f0a08a" opacity=".6"/>
    <path d="M34 82 Q38 26 100 22 Q162 26 166 82 Q150 52 100 50 Q50 52 34 82 Z" fill="#3b2a1e"/>
    <path d="M60 44 Q70 30 88 36 M110 34 Q130 28 140 44" stroke="#3b2a1e" stroke-width="6" fill="none" stroke-linecap="round"/>
    <rect x="70" y="128" width="60" height="6" fill="#fff"/>
    <ellipse class="nd-mouth" cx="100" cy="142" rx="32" ry="14" fill="#5a1414"/>
    <g class="nd-jaw">
      <path d="M40 132 Q100 160 160 132 Q160 176 100 182 Q40 176 40 132 Z" fill="#f3c9a4"/>
      <path d="M50 134 Q100 158 150 134" stroke="#8a3a3a" stroke-width="3" fill="none"/>
      <rect x="74" y="132" width="52" height="4" fill="#fff" opacity=".9"/>
    </g>
    <path d="M62 128 Q100 150 138 128" stroke="#5a1414" stroke-width="2.5" fill="none"/>
    <circle cx="72" cy="92" r="21" fill="rgba(200,230,255,.35)" stroke="#222" stroke-width="4"/>
    <circle cx="128" cy="92" r="21" fill="rgba(200,230,255,.35)" stroke="#222" stroke-width="4"/>
    <path d="M93 92 H107 M51 88 L36 82 M149 88 L164 82" stroke="#222" stroke-width="4"/>
    <path d="M58 80 Q64 74 72 78" stroke="#fff" stroke-width="2" fill="none" opacity=".8"/><path d="M114 80 Q120 74 128 78" stroke="#fff" stroke-width="2" fill="none" opacity=".8"/>
    <circle cx="74" cy="94" r="5" fill="#111"/><circle cx="130" cy="94" r="5" fill="#111"/>
    <path d="M54 66 Q72 58 90 68 M110 68 Q128 58 146 66" stroke="#3b2a1e" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M100 100 Q90 118 102 122" stroke="#c98a66" stroke-width="3" fill="none"/>
  </svg>`;
  const HAND = `<svg class="nd-hand" viewBox="0 0 100 130">
    <rect x="30" y="100" width="40" height="30" fill="#f3c9a4"/>
    <rect x="22" y="60" width="56" height="50" rx="14" fill="#f3c9a4" stroke="#222" stroke-width="3"/>
    <rect x="50" y="52" width="14" height="24" rx="7" fill="#f3c9a4" stroke="#222" stroke-width="3"/>
    <rect x="64" y="56" width="14" height="24" rx="7" fill="#f3c9a4" stroke="#222" stroke-width="3"/>
    <rect x="14" y="72" width="14" height="26" rx="7" fill="#f3c9a4" stroke="#222" stroke-width="3" transform="rotate(-30 21 85)"/>
    <rect x="35" y="4" width="16" height="66" rx="8" fill="#f3c9a4" stroke="#222" stroke-width="3"/>
  </svg>`;

  function buildStage() {
    const stage = JP.el('div', { class: 'nd-stage' });
    const face = JP.el('div', { class: 'nd-face' });
    if (photoUrl) {
      face.append(JP.el('div', { class: 'nd-photo' }, JP.el('img', { class: 'top', src: photoUrl, alt: '' }), JP.el('img', { class: 'jaw', src: photoUrl, alt: '' })));
    } else face.innerHTML = CARTOON;
    stage.append(JP.el('div', { class: 'nd-head' }, face));
    stage.insertAdjacentHTML('beforeend', HAND);
    stage.append(JP.el('div', { class: 'nd-caption', html: captionHtml(phrase()) }));
    return stage;
  }
  const captionHtml = p => { const i = p.indexOf('!'); return i > 0 ? `${p.slice(0, i + 1)} <b>${p.slice(i + 1).trim()}</b>` : p; };

  function makeWindow(first) {
    const k = windows.length;
    const W = innerWidth, H = innerHeight;
    const w = Math.min(380, W * .45), h = Math.min(430, H * .62);
    const x = first ? (W - w) / 2 : JP.rand(20, W - w - 20), y = first ? (H - h) / 2 - 30 : JP.rand(10, H - h - 80);
    const titles = ['NEDRYLAND SECURITY', 'AH AH AH', 'MAGIC WORD?', 'DODGSON?', 'nobody cares', 'PERMISSION DENIED', 'keycheck OFF', 'uid nedry'];
    const stage = buildStage();
    const win = JP.wm.open({ id: 'nedry-' + k + '-' + Date.now(), title: 'whte_rbt.obj — ' + (first ? titles[0] : JP.pick(titles)), cls: 'nedry', noMin: true, x, y, w, h, body: stage,
      onClose() { if (windows.length < 10) { JP.audio.beep(660); spawn(); spawn(); } else JP.audio.error(); return false; } });
    windows.push({ win, stage });
    return win;
  }

  function lockout() {
    if (locked) { spawn(); return; }
    locked = true; JP.state.locked = true;
    JP.state.stats.path.push('lockout');
    document.body.classList.add('locked');
    makeWindow(true);
    JP.audio.beep(880);
    wallIv = setInterval(() => JP.shell.print(phrase().toUpperCase(), 'magic'), 190);
    startVoice();
    requestAnimationFrame(ampFrame);
    JP.log('CONTROL: main program grid — LOCKED — owner nedry (whte_rbt.obj)', 'alert');
  }
  function spawn() { if (!locked) return; makeWindow(false); JP.audio.beep(JP.rand(700, 1100)); }
  function release(reason) {
    if (!locked) return;
    locked = false; JP.state.locked = false;
    clearInterval(wallIv); wallIv = null;
    loopId++;
    JP.audio.stopVoice();
    document.body.classList.remove('locked');
    windows.forEach(w => JP.wm.destroy(w.win));
    windows = [];
    JP.log(`CONTROL: main program grid — RELEASED (${reason})`, 'ok');
  }
  function taunt() {
    JP.audio.beep(520);
    for (const w of windows) { w.stage.classList.add('taunt'); w.stage.querySelector('.nd-caption').innerHTML = captionHtml(taunt_()); }
    setTimeout(() => { for (const w of windows) { w.stage.classList.remove('taunt'); w.stage.querySelector('.nd-caption').innerHTML = captionHtml(phrase()); } }, 3500);
    spawn();
  }

  /* Voix en boucle */
  async function startVoice() {
    const id = ++loopId;
    while (locked && id === loopId) {
      try {
        if (JP.audio.hasVoice()) { const r = JP.audio.speakVoice(); analyser = r.analyser; await r.done; analyser = null; }
        else { ttsSpeaking = true; const r = JP.audio.tts(phrase(), JP.state.lang); await Promise.race([r.done, JP.sleep(r.duration * 1000 + 400)]); ttsSpeaking = false; }
      } catch (e) { console.warn('voice', e); ttsSpeaking = false; analyser = null; }
      await JP.sleep(650);
    }
  }
  function ampFrame() {
    if (!locked) { jaw = 0; return; }
    let a = 0;
    if (analyser) { analyser.getByteTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; s += v * v; } a = Math.min(1, Math.sqrt(s / buf.length) * 5); }
    else if (ttsSpeaking) a = (0.25 + 0.75 * Math.abs(Math.sin(performance.now() / 75))) * (Math.random() < 0.88 ? 1 : 0.15);
    jaw += (a - jaw) * 0.45;
    for (const w of windows) w.stage.style.setProperty('--jaw', jaw.toFixed(3));
    requestAnimationFrame(ampFrame);
  }

  /* Réglages : photo, voix, langue */
  function setPhoto(url) {
    photoUrl = url;
    if (url) JP.store.set('photo', url); else JP.store.del('photo');
    for (const w of windows) { const s = buildStage(); w.win.body.innerHTML = ''; w.win.body.append(s); w.stage = s; }
    JP.bus.emit('nedry:photo', url);
  }
  function loadPhotoFile(file) {
    const img = new Image();
    img.onload = () => {
      const s = 512, c = document.createElement('canvas'); c.width = c.height = s;
      const g = c.getContext('2d'), m = Math.min(img.width, img.height);
      g.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s);
      setPhoto(c.toDataURL('image/jpeg', .85));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  }
  document.addEventListener('dragover', e => { e.preventDefault(); });
  document.addEventListener('drop', e => { e.preventDefault(); const f = [...e.dataTransfer.files].find(x => x.type.startsWith('image/')); if (f) { loadPhotoFile(f); JP.shell.print('nedry: photo loaded (drag & drop).', 'dim'); } });

  async function init() {
    photoUrl = JP.store.get('photo');
    JP.state.lang = JP.store.get('lang') || ((navigator.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en');
    const hz = parseFloat(JP.store.get('ringhz')); if (hz) JP.audio.setRingHz(hz);
  }
  async function loadSavedVoice() {
    const v = JP.store.get('voice');
    if (v && !JP.audio.hasVoice()) { try { await JP.audio.loadVoice(v); } catch (e) { console.warn('voice load', e); } }
  }

  function openSettings() {
    if (JP.wm.get('nedry-setup')) return JP.wm.open({ id: 'nedry-setup' });
    const body = JP.el('div', { class: 'nd-setup' });
    const status = JP.el('div', { class: 'status' });
    const prev = JP.el('img', { class: 'prev', src: photoUrl || '', alt: '' });
    if (!photoUrl) prev.style.visibility = 'hidden';
    JP.bus.on('nedry:photo', u => { prev.src = u || ''; prev.style.visibility = u ? '' : 'hidden'; });
    const file = JP.el('input', { type: 'file', accept: 'image/*', onchange: e => { if (e.target.files[0]) { loadPhotoFile(e.target.files[0]); status.textContent = 'Photo loaded.'; } } });
    const hzLabel = JP.el('span', { text: (JP.store.get('ringhz') || 42) + ' Hz' });
    const range = JP.el('input', { type: 'range', min: 20, max: 90, value: JP.store.get('ringhz') || 42, oninput: e => { JP.audio.setRingHz(+e.target.value); JP.store.set('ringhz', e.target.value); hzLabel.textContent = e.target.value + ' Hz'; } });
    const langBtn = l => JP.el('span', { class: 'mx-btn' + (JP.state.lang === l ? ' down' : ''), text: l.toUpperCase(), onclick: e => { JP.state.lang = l; JP.store.set('lang', l); body.querySelectorAll('.lang').forEach(b => b.classList.toggle('down', b.textContent.toLowerCase() === l)); for (const w of windows) w.stage.querySelector('.nd-caption').innerHTML = captionHtml(phrase()); } });
    body.append(
      JP.el('h2', { text: 'whte_rbt.obj — your face, your voice' }),
      JP.el('p', { text: 'A photo and 3 seconds of microphone. Your voice goes through a ring modulator (the robot voice from the film). Everything stays in this browser.' }),
      JP.el('div', { class: 'row' }, prev, JP.el('label', { class: 'mx-btn' }, '📷 Choose a photo', file), JP.el('span', { class: 'mx-btn', text: 'Remove', onclick: () => { setPhoto(null); status.textContent = 'Photo removed (cartoon).'; } })),
      JP.el('div', { class: 'row' },
        JP.el('span', { class: 'mx-btn', text: '🎙 Record my voice (3 s)', onclick: async () => {
          try { status.textContent = 'Get ready…'; const url = await JP.audio.record(3, n => status.textContent = `Speak! ${n}…`); status.textContent = 'Processing…'; await JP.audio.loadVoice(url); JP.store.set('voice', url) || (status.textContent = 'Voice loaded (too large to be saved).'); status.textContent = 'Voice recorded. Test it.'; }
          catch (e) { status.textContent = 'Microphone denied: ' + e.message; }
        } }),
        JP.el('span', { class: 'mx-btn', text: '▶ Test', onclick: async () => { await loadSavedVoice(); if (JP.audio.hasVoice()) JP.audio.speakVoice(); else JP.audio.tts(phrase(), JP.state.lang); } }),
        JP.el('span', { class: 'mx-btn', text: 'Delete voice', onclick: () => { JP.store.del('voice'); JP.audio.clearVoice(); status.textContent = 'Voice deleted (speech synthesis).'; } })),
      JP.el('div', { class: 'row' }, 'Nedry speaks: ', Object.assign(langBtn('fr'), { className: 'mx-btn lang' + (JP.state.lang === 'fr' ? ' down' : '') }), Object.assign(langBtn('en'), { className: 'mx-btn lang' + (JP.state.lang === 'en' ? ' down' : '') })),
      JP.el('div', { class: 'row' }, 'Robot: ', range, hzLabel),
      JP.el('div', { class: 'row' },
        JP.el('span', { class: 'mx-btn', text: '🔒 Test the lockout', onclick: () => { JP.audio.ensure(); lockout(); } }),
        JP.el('span', { class: 'mx-btn', text: '🔓 Release', onclick: () => release('setup') }),
        JP.el('span', { class: 'mx-btn', text: '⛶ Full screen', onclick: () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen() })),
      JP.el('p', { text: 'To get out of the lockout in the scenario: "shutdown" (the film\'s way) — or Nedry\'s password, which is lying around somewhere in his files.' }),
      status);
    JP.wm.open({ id: 'nedry-setup', title: 'Nedry Setup', glyph: 'ND', x: innerWidth / 2 - 230, y: 80, w: 460, h: 400, body, gray: true });
  }

  return { lockout, spawn, release, taunt, phrase, openSettings, init, loadSavedVoice, setPhoto, get locked() { return locked; }, get count() { return windows.length; } };
})();
