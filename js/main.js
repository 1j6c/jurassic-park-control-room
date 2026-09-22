/* Démarrage : boot, bureau, Toolchest, horloge, effets (éclairs, pas du T-Rex, verre d'eau). */
(async () => {
  const st = JP.state;
  await JP.nedry.init();

  /* Le son ne peut démarrer qu'après un geste utilisateur */
  const unlockAudio = () => { JP.audio.ensure(); JP.nedry.loadSavedVoice(); if (st.phase !== 'boot') JP.audio.hum(true); };
  document.addEventListener('keydown', unlockAudio, { once: true });
  document.addEventListener('pointerdown', unlockAudio, { once: true });

  /* ---- Toolchest ---- */
  const menus = {
    desktop: [
      ['System Map', () => JP.panels.open('map')], ['Console', () => JP.panels.open('console')], ['Perimeter Fences', () => JP.panels.open('fences')],
      ['Motion Sensors', () => JP.panels.open('sensors')], ['Tour Program', () => JP.panels.open('tour')], ['Video Surveillance', () => JP.panels.open('cameras')],
      ['Environmental', () => JP.panels.open('weather')], ['Power Distribution', () => JP.panels.open('power')], ['Cryogenics', () => JP.panels.open('cryo')],
      ['Communications', () => JP.panels.open('comms')], ['East Dock', () => JP.panels.open('dock')], ['Personnel', () => JP.panels.open('people')],
      'sep', ['fsn — File System Navigator', () => JP.panels.open('fsn')],
    ],
    system: [
      ['Nedry Setup (photo, voice)...', () => JP.nedry.openSettings()], 'sep',
      ['Timeline', () => JP.shell.exec('timeline')], ['Scenario: skip to next event', () => JP.shell.exec('scenario skip')], ['Scenario: pause / resume', () => JP.shell.exec(st.running ? 'scenario pause' : 'scenario resume')],
      ['Time scale 1× / 3× / 6×', () => JP.shell.exec('timescale ' + (st.timescale >= 6 ? 1 : st.timescale >= 3 ? 6 : 3))], 'sep',
      ['Mute / Unmute', () => JP.audio.setMuted(!st.muted)], ['CRT filter on/off', () => document.body.classList.toggle('nocrt')], ['Full screen', () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()], 'sep',
      ['Shutdown...', () => JP.shell.exec('shutdown')], ['Restart scenario', () => location.reload()], 'sep',
      ['About', () => { JP.shell.print('Jurassic Park: System Control — IRIX 4.0.5 — InGen Systems Group. "It\'s a UNIX system."', 'cyan'); JP.shell.print('Built by 1j6c, 2026. Signed: type "verify".', 'dim'); }],
    ],
  };
  for (const [k, items] of Object.entries(menus)) {
    const m = document.getElementById('tc-' + k);
    for (const it of items) m.append(it === 'sep' ? JP.el('div', { class: 'sep' }) : JP.el('div', { text: it[0], onclick: e => { e.stopPropagation(); closeMenus(); JP.audio.click(); it[1](); } }));
  }
  const closeMenus = () => document.querySelectorAll('.tc-item.open').forEach(x => x.classList.remove('open'));
  document.querySelectorAll('.tc-item').forEach(it => it.addEventListener('click', e => { e.stopPropagation(); const was = it.classList.contains('open'); closeMenus(); if (!was) it.classList.add('open'); }));
  document.addEventListener('click', closeMenus);
  document.getElementById('cb-mute').addEventListener('click', () => JP.audio.setMuted(!st.muted));
  document.getElementById('cb-speed').addEventListener('click', () => JP.shell.exec('timescale ' + (st.timescale >= 6 ? 1 : st.timescale >= 3 ? 6 : 3)));

  /* ---- Barre d'horloge ---- */
  JP.clock.every(4, () => {
    document.getElementById('cb-time').textContent = JP.clock.clockStr();
    const w = JP.sys.storm, s = document.getElementById('cb-storm');
    s.textContent = w.distance <= 0.3 ? 'STORM OVERHEAD' : 'STORM ETA ' + JP.fmtMMSS(w.etaMin * 60);
    s.className = w.distance < 3 ? 'crit' : w.distance < 8 ? 'warn' : '';
    const d = JP.sys.dock, left = d.departs - JP.clock.simTime(), sh = document.getElementById('cb-ship');
    sh.textContent = d.departed ? 'ANNE B DEPARTED' : 'ANNE B DEP 19:00 (' + JP.fmtMMSS(left) + ')';
    sh.className = d.departed ? '' : left < 180 ? 'crit' : left < 420 ? 'warn' : '';
  });

  /* ---- Effets ---- */
  const desktop = document.getElementById('desktop'), flash = document.getElementById('flash'), ripple = document.getElementById('ripple');
  JP.bus.on('flash', () => { flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go'); });
  JP.bus.on('thump', () => {
    desktop.classList.remove('shake'); void desktop.offsetWidth; desktop.classList.add('shake');
    const i = JP.el('i'); ripple.append(i); setTimeout(() => i.remove(), 1500);
    glassRipple();
  });

  /* Le verre d'eau */
  const gc = document.getElementById('glass'), gx = gc.getContext('2d');
  let amp = 0, ph = 0;
  function glassRipple() { amp = 1; }
  JP.clock.onFrame(dt => {
    amp *= Math.pow(0.15, dt); ph += dt * 22;
    const W = gc.width, H = gc.height;
    gx.clearRect(0, 0, W, H);
    /* verre */
    gx.strokeStyle = 'rgba(220,235,255,.8)'; gx.lineWidth = 2;
    gx.beginPath(); gx.moveTo(14, 8); gx.lineTo(20, 96); gx.quadraticCurveTo(36, 102, 52, 96); gx.lineTo(58, 8); gx.stroke();
    /* eau */
    const lvl = 40;
    gx.fillStyle = 'rgba(120,180,255,.45)';
    gx.beginPath(); gx.moveTo(16 + (lvl - 8) / 88 * 6, lvl);
    for (let x = 16; x <= 56; x += 2) gx.lineTo(x, lvl + Math.sin(x / 4 + ph) * amp * 4 + Math.sin(x / 2 - ph * 1.7) * amp * 2);
    gx.lineTo(51, 95); gx.quadraticCurveTo(36, 100, 21, 95); gx.closePath(); gx.fill();
    gx.strokeStyle = 'rgba(200,230,255,.9)'; gx.lineWidth = 1.2;
    gx.beginPath(); for (let x = 16; x <= 56; x += 2) { const y = lvl + Math.sin(x / 4 + ph) * amp * 4 + Math.sin(x / 2 - ph * 1.7) * amp * 2; x === 16 ? gx.moveTo(x, y) : gx.lineTo(x, y); } gx.stroke();
    if (amp > 0.05) { gx.strokeStyle = `rgba(255,255,255,${amp * .5})`; for (let r = 1; r < 4; r++) { gx.beginPath(); gx.ellipse(36, lvl, r * 6 * (1.2 - amp) + 2, r * 2, 0, 0, Math.PI * 2); gx.stroke(); } }
    gx.fillStyle = 'rgba(200,230,255,.5)'; gx.font = '8px Menlo'; gx.fillText('H2O', 28, 6);
  });

  /* ---- Boot puis bureau ---- */
  document.getElementById('desktop').style.visibility = 'hidden';
  await JP.boot.run();
  document.getElementById('desktop').style.visibility = '';
  if (JP.audio.ready()) { JP.audio.chime(); JP.audio.hum(true); }

  JP.panels.openAll(['map', 'fences', 'tour', 'sensors', 'cameras', 'weather', 'console']);
  for (const id of ['power', 'cryo', 'comms', 'dock', 'people', 'fsn']) { JP.panels.open(id); JP.wm.iconify(JP.wm.get(id)); }
  JP.wm.focus(JP.wm.get('console'));
  JP.shell.focus();

  JP.shell.print('Jurassic Park System Control v2.1 — jpsys — IRIX 4.0.5', 'cyan');
  JP.shell.print('Fri Jun 11 18:48:00 CST 1993 — you are arnold (Chief Engineer) — type "help".', 'dim');
  JP.shell.print('Tropical storm inbound. Tour under way. Nedry is at workstation 3 "debugging the phones".', 'dim');
  JP.shell.print('');
  JP.scenario.start();
  JP.log('SYSTEM: all park systems nominal — 32 nodes — main program grid ONLINE', 'ok');
})();
