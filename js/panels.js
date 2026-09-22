/* Panneaux de contrôle du parc (fenêtres 4Dwm). Les boutons tapent des commandes dans la console. */
JP.panels = (() => {
  const reg = {};
  const def = (id, spec) => { reg[id] = spec; };
  const lamp = on => `<i class="lamp ${on === true ? 'on' : on === false ? 'off' : on}"></i>`;
  const btn = (label, cmd, extra = '') => `<span class="mx-btn ${extra}" data-cmd="${cmd}">${label}</span>`;
  const cmdOf = e => { const b = e.target.closest('[data-cmd]'); if (b) { JP.audio.click(); JP.shell.exec(b.dataset.cmd); } };

  function open(id) {
    const spec = reg[id];
    if (!spec) return null;
    const existing = JP.wm.get(id);
    if (existing) return JP.wm.open({ id });
    const body = JP.el('div', { class: spec.cls || 'p' });
    body.addEventListener('click', cmdOf);
    const r = rect(id);
    const ctl = spec.build(body) || {};
    const w = JP.wm.open({ id, title: spec.title, glyph: spec.glyph, x: r.x, y: r.y, w: r.w, h: r.h, body, gray: spec.gray,
      onResize: ctl.onResize, onShow: ctl.onShow, onHide: ctl.onHide });
    if (ctl.update) { ctl.update(); JP.clock.every(spec.hz || 4, () => { if (JP.wm.isVisible(w)) ctl.update(); }); }
    return w;
  }
  function openAll(list) { list.forEach(open); }

  /* Disposition initiale (proportionnelle à l'écran) */
  function rect(id) {
    const W = innerWidth, H = innerHeight - 74, T = 34;
    const L = {
      map:      { x: 8,        y: T,            w: W * .44 - 8,  h: H * .64 },
      fences:   { x: W * .445, y: T,            w: W * .27,      h: H * .36 },
      tour:     { x: W * .72,  y: T,            w: W * .275,     h: H * .36 },
      sensors:  { x: W * .445, y: T + H * .37,  w: W * .27,      h: H * .27 },
      cameras:  { x: W * .72,  y: T + H * .37,  w: W * .275,     h: H * .27 },
      console:  { x: 8,        y: T + H * .65,  w: W * .58,      h: H * .35 - 4 },
      weather:  { x: W * .59,  y: T + H * .65,  w: W * .405,     h: H * .35 - 4 },
      power:    { x: W * .3,   y: T + 40,       w: 420, h: 300 },
      cryo:     { x: W * .32,  y: T + 60,       w: 460, h: 330 },
      comms:    { x: W * .34,  y: T + 80,       w: 380, h: 260 },
      dock:     { x: W * .36,  y: T + 100,      w: 400, h: 240 },
      people:   { x: W * .3,   y: T + 120,      w: 520, h: 260 },
      fsn:      { x: W * .12,  y: T + 30,       w: W * .76,      h: H * .8 },
      end:      { x: W * .25,  y: T + 60,       w: W * .5,       h: H * .6 },
    };
    return L[id] || { x: 100, y: 100, w: 400, h: 300 };
  }

  /* ---------- Carte ---------- */
  def('map', { title: 'Isla Nublar — System Map', glyph: 'MAP', cls: 'p map-p', build(body) { body.style.padding = '0'; JP.island.mount(body); } });

  /* ---------- Clôtures ---------- */
  def('fences', { title: 'Perimeter Fence Control', glyph: 'FNC', build(body) {
    return { update() {
      const f = JP.sys.fences, on = f.filter(x => x.on).length, al = JP.sys.alarm;
      body.innerHTML = `<h1><span>PERIMETER FENCE CONTROL</span><span class="st ${on === f.length ? '' : 'off'}">${on}/${f.length} ENERGIZED</span></h1>
        <table><tr><th></th><th>FENCE</th><th class="r">VOLTAGE</th><th class="r">CURRENT</th><th>STATUS</th></tr>
        ${f.map(x => `<tr class="${x.on ? '' : 'off'}"><td>${lamp(x.on)}</td><td>${x.name}</td><td class="r">${x.on ? JP.num(x.kv * 1000) + ' V' : '0 V'}</td><td class="r">${x.on ? (2.1 + Math.random() * .6).toFixed(2) + ' A' : '0.00 A'}</td><td>${x.on ? 'ENERGIZED' : 'OFFLINE'}</td></tr>`).join('')}
        </table>
        <div class="toolbar">${btn('RESET ALL', 'fences reset')}${btn('TEST', 'fences test')}${btn('ACK ALARM', 'ack', al.active ? '' : 'dis')}</div>
        <div class="note">${al.active ? '<span style="color:var(--red)">■ ALARM: ' + al.text + '</span>' : 'Last test 18:20:04 — all fences OK · 10,000 V induction'}</div>`;
    } };
  } });

  /* ---------- Capteurs ---------- */
  def('sensors', { title: 'Motion Sensor Network', glyph: 'SNS', hz: 2, build(body) {
    const rates = {};
    return { update() {
      const s = JP.sys.sensors, act = JP.island.activitySnapshot();
      for (const p of JP.island.PADDOCKS) rates[p.id] = (rates[p.id] || 0) * 0.7 + (act[p.id] || 0) * 0.3;
      const on = s.online > 0;
      body.innerHTML = `<h1><span>MOTION SENSOR NETWORK</span><span class="st ${on ? '' : 'off'}">${on ? s.online + ' / ' + s.total + ' ONLINE' : 'NETWORK OFFLINE'}</span></h1>
        <table><tr><th>ZONE</th><th class="r">SENSORS</th><th class="r">ACTIVITY</th><th>TRACKING</th></tr>
        ${JP.island.PADDOCKS.map(p => {
          const lost = (p.id === 'tyr' && JP.state.rex.loose) || (p.id === 'rap' && JP.state.raptors.loose);
          const r = rates[p.id] || 0;
          return `<tr class="${!on ? 'off' : lost ? 'warn' : ''}"><td>${p.name}</td><td class="r">${p.small ? 4 : p.pts.length * 2}</td><td class="r">${on ? '▮'.repeat(Math.min(6, Math.round(r * 2))).padEnd(6, '▯') : '------'}</td><td>${!on ? 'NO DATA' : lost ? '0 — BREACH' : p.n + (p.n > 1 ? ' animals' : ' animal')}</td></tr>`;
        }).join('')}</table>
        <div class="note">Polling 4 Hz · grid 12 · total hits: ${s.hits}</div>`;
    } };
  } });

  /* ---------- Visite ---------- */
  def('tour', { title: 'Tour Program — Explorer XLT', glyph: 'TUR', build(body) {
    return { update() {
      const t = JP.sys.tour;
      const st = t.state;
      body.innerHTML = `<h1><span>TOUR PROGRAM</span><span class="st ${st === 'STOPPED' ? 'off' : st === 'RETURNING' ? 'warn' : ''}">${st}</span></h1>
        <div class="kv"><b>Track</b><span class="v">induction rail · loop 4.2 mi</span><b>Speed</b><span class="v">${st === 'STOPPED' ? '0' : t.speed} mph</span><b>Next</b><span class="v">${st === 'STOPPED' ? 'TYRANNOSAUR PADDOCK — HOLDING' : t.next}</span></div>
        <div class="bar" style="margin:8px 0"><i style="width:${(t.progress * 100).toFixed(1)}%" class="${st === 'STOPPED' ? 'crit' : ''}"></i></div>
        <table><tr><th></th><th>VEHICLE</th><th>OCCUPANTS</th><th>TELEMETRY</th></tr>
        ${t.vehicles.map(v => `<tr class="${!v.signal ? 'off' : ''}"><td>${lamp(v.signal ? (st === 'STOPPED' ? 'warn' : true) : false)}</td><td>${v.id}</td><td>${v.occ}</td><td>${!v.signal ? 'SIGNAL LOST' : st === 'STOPPED' ? 'STOPPED — no power' : 'OK · ' + (14.6 + Math.random() * .8).toFixed(1) + ' mph'}</td></tr>`).join('')}
        </table>
        <div class="toolbar">${btn('STOP', 'tour stop')}${btn('RESUME', 'tour resume')}${btn('RETURN TO GARAGE', 'tour return')}</div>
        <div class="note">Narration: Richard Kiley (spared no expense) · headway 90 ft · goat tether at rex viewpoint</div>`;
    } };
  } });

  /* ---------- Caméras ---------- */
  def('cameras', { title: 'Video Surveillance', glyph: 'CAM', cls: 'cams', build(body) {
    const CAMS = [{ n: '07', name: 'REX PADDOCK' }, { n: '12', name: 'RAPTOR PEN' }, { n: '03', name: 'VISITOR CTR' }, { n: '21', name: 'EAST DOCK' }];
    const cams = CAMS.map(c => {
      const cv = JP.el('canvas', { width: 160, height: 100 });
      const el = JP.el('div', { class: 'cam' }, cv, JP.el('div', { class: 'lbl', text: `CAM ${c.n} ${c.name}` }), JP.el('div', { class: 'rec', text: '● REC' }), JP.el('div', { class: 'ns', text: 'NO SIGNAL' }));
      body.append(el);
      const trees = Array.from({ length: 7 }, () => ({ x: Math.random() * 160, w: 4 + Math.random() * 8, h: 20 + Math.random() * 40 }));
      return { ...c, cv, el, ctx: cv.getContext('2d'), trees, blob: { x: Math.random() * 160, dir: 1, t: 0 } };
    });
    const nz = JP.el('canvas', { width: 80, height: 50 }), nctx = nz.getContext('2d'), img = nctx.createImageData(80, 50);
    function noise(alpha) {
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      nctx.putImageData(img, 0, 0);
      return nz;
    }
    let frame = 0;
    function draw() {
      frame++;
      const online = JP.sys.cameras.online > 0, ts = JP.clock.clockStr();
      const n = noise();
      for (const c of cams) {
        const x = c.ctx;
        c.el.classList.toggle('nosig', !online);
        x.imageSmoothingEnabled = false;
        if (!online) { x.globalAlpha = 1; x.drawImage(n, 0, 0, 160, 100); continue; }
        const g = x.createLinearGradient(0, 0, 0, 100); g.addColorStop(0, '#061a0e'); g.addColorStop(.55, '#0c2a16'); g.addColorStop(1, '#173a20');
        x.globalAlpha = 1; x.fillStyle = g; x.fillRect(0, 0, 160, 100);
        x.fillStyle = '#0a2412'; x.fillRect(0, 58, 160, 42);
        x.fillStyle = '#04120a';
        for (const t of c.trees) x.fillRect(t.x, 58 - t.h, t.w, t.h);
        if (c.n === '21') { x.fillStyle = '#1e3a4a'; x.fillRect(0, 62, 160, 38); x.fillStyle = '#3a4a52'; x.fillRect(90, 55, 60, 6); }
        if (c.n === '03') { x.fillStyle = '#2a3a2a'; x.fillRect(30, 30, 100, 30); x.fillStyle = '#ffd98a'; for (let i = 0; i < 5; i++) x.fillRect(38 + i * 18, 38, 6, 8); }
        /* silhouette (rex loose sur cam 07, raptors sur 12/03) */
        const b = c.blob;
        const show = (c.n === '07' && JP.state.rex.loose && !JP.state.rex.hidden) || (c.n === '12' && !JP.state.raptors.loose) || (c.n === '03' && JP.state.raptors.loose && !JP.state.raptors.contained) || (c.n === '07' && frame % 400 < 120);
        if (show) { b.x += b.dir * 0.35; if (b.x > 170 || b.x < -20) b.dir *= -1; x.fillStyle = 'rgba(0,0,0,.85)'; x.beginPath(); x.ellipse(b.x, 52, c.n === '07' ? 16 : 8, c.n === '07' ? 12 : 6, 0, 0, Math.PI * 2); x.fill(); x.fillRect(b.x - 4, 52, 4, 10); x.fillRect(b.x + 6, 52, 4, 10); }
        /* pluie */
        if (JP.sys.storm.rain > 0.2) { x.strokeStyle = 'rgba(180,220,255,.25)'; for (let i = 0; i < 30; i++) { const rx = Math.random() * 160, ry = Math.random() * 100; x.beginPath(); x.moveTo(rx, ry); x.lineTo(rx - 2, ry + 7); x.stroke(); } }
        x.globalAlpha = 0.16; x.drawImage(n, 0, 0, 160, 100); x.globalAlpha = 1;
        x.fillStyle = 'rgba(0,0,0,.15)'; for (let y = 0; y < 100; y += 3) x.fillRect(0, y, 160, 1);
        x.fillStyle = '#fff'; x.font = '8px Menlo, monospace'; x.fillText(ts, 4, 96);
        x.fillText(`NV ${c.n === '21' ? 'DOCK' : 'IR'}`, 120, 96);
      }
    }
    return { update: draw };
  }, hz: 12 });

  /* ---------- Météo ---------- */
  def('weather', { title: 'Environmental — Tropical Storm Watch', glyph: 'WX', cls: 'p wx', hz: 6, build(body) {
    const cv = JP.el('canvas', { width: 190, height: 190 }), x = cv.getContext('2d');
    const kv = JP.el('div');
    body.append(cv, kv);
    let ang = 0;
    return { update() {
      const w = JP.sys.storm;
      ang += 0.09;
      x.fillStyle = '#020a06'; x.fillRect(0, 0, 190, 190);
      x.strokeStyle = 'rgba(60,255,112,.25)';
      for (let r = 30; r <= 90; r += 30) { x.beginPath(); x.arc(95, 95, r, 0, Math.PI * 2); x.stroke(); }
      x.beginPath(); x.moveTo(95, 5); x.lineTo(95, 185); x.moveTo(5, 95); x.lineTo(185, 95); x.stroke();
      /* île */
      x.fillStyle = 'rgba(60,255,112,.35)'; x.beginPath(); x.ellipse(95, 95, 10, 16, 0, 0, Math.PI * 2); x.fill();
      /* tempête : à l'est, se rapproche */
      const d = JP.clamp(w.distance, 0, 14) / 14 * 85 + 8;
      const sx = 95 + d, sy = 95 - d * 0.25;
      const g = x.createRadialGradient(sx, sy, 2, sx, sy, 50 + (14 - w.distance) * 2);
      g.addColorStop(0, 'rgba(255,80,80,.85)'); g.addColorStop(.35, 'rgba(255,200,60,.55)'); g.addColorStop(.7, 'rgba(60,255,112,.35)'); g.addColorStop(1, 'rgba(60,255,112,0)');
      x.fillStyle = g; x.beginPath(); x.arc(sx, sy, 55 + (14 - w.distance) * 2, 0, Math.PI * 2); x.fill();
      /* balayage */
      const sg = x.createConicGradient ? x.createConicGradient(ang, 95, 95) : null;
      if (sg) { sg.addColorStop(0, 'rgba(60,255,112,.5)'); sg.addColorStop(.12, 'rgba(60,255,112,0)'); sg.addColorStop(1, 'rgba(60,255,112,0)'); x.fillStyle = sg; x.beginPath(); x.moveTo(95, 95); x.arc(95, 95, 92, 0, Math.PI * 2); x.fill(); }
      x.fillStyle = '#8fa'; x.font = '9px Menlo'; x.fillText('RADAR 50 mi', 6, 12); x.fillText('N', 92, 12);
      const crit = w.distance < 3, warn = w.distance < 8;
      kv.innerHTML = `<h1><span>ENVIRONMENTAL</span><span class="st ${crit ? 'off' : warn ? 'warn' : ''}">${w.phase}</span></h1>
        <div class="kv">
          <b>Storm front</b><span class="v ${crit ? 'crit' : warn ? 'warn' : ''}">${w.distance.toFixed(1)} mi ENE</span>
          <b>ETA</b><span class="v ${crit ? 'crit' : warn ? 'warn' : ''}">${w.distance <= 0.2 ? 'OVERHEAD' : JP.fmtMMSS(w.etaMin * 60)}</span>
          <b>Wind</b><span class="v">${w.wind.toFixed(0)} kn · gusts ${w.gust.toFixed(0)} kn</span>
          <b>Pressure</b><span class="v ${w.pressure < 990 ? 'warn' : ''}">${w.pressure.toFixed(1)} hPa ↓</span>
          <b>Rain</b><span class="v">${w.rain <= 0 ? 'none' : (w.rain * 2.4).toFixed(1) + ' in/h'}</span>
          <b>Lightning</b><span class="v">${w.strikes} strikes</span>
          <b>Sea state</b><span class="v">${w.wind > 40 ? 'ROUGH — dock closing' : w.wind > 30 ? 'moderate' : 'slight'}</span>
          <b>Temp</b><span class="v">${(84 - (14 - w.distance) * 0.6).toFixed(0)} °F · humidity ${Math.min(99, 78 + (14 - w.distance) * 1.5).toFixed(0)}%</span>
        </div>
        <div class="note">${crit ? 'ADVISORY: all outdoor operations suspended. Helipad closed.' : warn ? 'ADVISORY: recall tour vehicles. Last boat before storm: ANNE B 19:00.' : 'Tropical storm tracking toward Isla Nublar. Monitor.'}</div>`;
    } };
  } });

  /* ---------- Console (corps fourni par le shell) ---------- */
  def('console', { title: 'Console — jpsys (winterm)', glyph: '%', cls: 'term-host', build(body) { body.style.height = '100%'; body.append(JP.shell.root); return { onShow: () => JP.shell.focus() }; } });

  /* ---------- Énergie ---------- */
  def('power', { title: 'Power Distribution', glyph: 'PWR', build(body) {
    return { update() {
      const p = JP.sys.power, b = p.breakers, names = { main: 'MAIN BREAKER', control: 'VISITOR CENTER / CONTROL', tour: 'TOUR INDUCTION RAIL', fences: 'PERIMETER FENCES', labs: 'GENETICS / CRYO', dock: 'EAST DOCK' };
      const load = p.main ? p.load + Math.random() * 2 : 0;
      body.innerHTML = `<h1><span>POWER DISTRIBUTION</span><span class="st ${p.main ? '' : 'off'}">${p.main ? 'MAIN GENERATOR ONLINE' : 'MAIN POWER OFF'}</span></h1>
        <div class="kv"><b>Generator</b><span class="v">${p.main ? '2 × 1.5 MW diesel · load ' + load.toFixed(0) + '%' : 'OFFLINE'}</span><b>Backup</b><span class="v">battery bus — control room only (40 min)</span></div>
        <div class="bar" style="margin:8px 0"><i style="width:${load.toFixed(0)}%" class="${load > 85 ? 'warn' : ''}"></i></div>
        <table><tr><th></th><th>CIRCUIT</th><th>STATUS</th></tr>
        ${Object.keys(names).map(k => `<tr class="${b[k] ? '' : 'off'}"><td>${lamp(!!b[k])}</td><td>${names[k]}</td><td>${b[k] ? 'CLOSED' : 'OPEN'}</td></tr>`).join('')}</table>
        <div class="note">Breaker panel: maintenance shed (east of visitor center). Manual reset only.</div>`;
    } };
  } });

  /* ---------- Cryogénie ---------- */
  def('cryo', { title: 'Cryogenics — Embryo Cold Storage', glyph: 'CRY', build(body) {
    return { update() {
      const c = JP.sys.cryo, sp = JP.fs.SPECIES;
      body.innerHTML = `<h1><span>EMBRYO COLD STORAGE — VAULT 1</span><span class="st ${c.vials < 15 ? 'off' : ''}">${c.vials} / 15 VIALS</span></h1>
        <div class="kv"><b>Temperature</b><span class="v ok">${c.temp.toFixed(1)} °C (LN₂)</span><b>Vault door</b><span class="v ${c.door === 'SEALED' ? 'ok' : 'crit'}">${c.door}</span><b>Last badge</b><span class="v">${c.lastBadge}</span></div>
        <table style="margin-top:8px"><tr><th>#</th><th>SPECIES</th><th>VIAL</th><th>#</th><th>SPECIES</th><th>VIAL</th><th>#</th><th>SPECIES</th><th>VIAL</th></tr>
        ${[0, 1, 2, 3, 4].map(r => '<tr>' + [0, 1, 2].map(col => { const i = col * 5 + r; const has = i < c.vials; return `<td>${i + 1}</td><td>${sp[i][0]}</td><td>${lamp(has)}${has ? 'OK' : 'MISSING'}</td>`; }).join('') + '</tr>').join('')}
        </table>
        <div class="note">Viable embryos — 2 per species — Barbasol-can-sized. Do not remove from LN₂.</div>`;
    } };
  } });

  /* ---------- Communications ---------- */
  def('comms', { title: 'Communications — PBX', glyph: 'PBX', build(body) {
    return { update() {
      const l = JP.sys.phones.lines, on = l.filter(x => x.on).length;
      body.innerHTML = `<h1><span>PBX — LINE STATUS</span><span class="st ${on ? '' : 'off'}">${on ? on + '/' + l.length + ' LINES UP' : 'ALL LINES DEAD'}</span></h1>
        <table>${l.map(x => `<tr class="${x.on ? '' : 'off'}"><td>${lamp(x.on)}</td><td>${x.name}</td><td>${x.on ? 'DIAL TONE' : 'NO CARRIER'}</td></tr>`).join('')}</table>
        <div class="toolbar">${btn('TEST LINES', 'phones test')}${btn('CALL MAINLAND', 'phones call mainland')}</div>
        <div class="note">nedry: "I finished debugging the phones." — compile running (18-20 min), minor systems may go on and off.</div>`;
    } };
  } });

  /* ---------- Dock ---------- */
  def('dock', { title: 'East Dock — Harbor Master', glyph: 'DCK', build(body) {
    return { update() {
      const d = JP.sys.dock, left = d.departs - JP.clock.simTime();
      body.innerHTML = `<h1><span>EAST DOCK</span><span class="st ${d.departed ? 'off' : left < 300 ? 'warn' : ''}">${d.departed ? 'DEPARTED' : 'SHIP IN PORT'}</span></h1>
        <div class="kv"><b>Vessel</b><span class="v">${d.ship} — supply barge, 380 t</span><b>Status</b><span class="v">${d.status}</span><b>Cargo</b><span class="v">${d.cargo}</span>
        <b>Departure</b><span class="v ${d.departed ? '' : left < 300 ? 'crit' : 'warn'}">${d.departed ? 'DEPARTED ' + JP.fmtClock(d.departs) : JP.fmtClock(d.departs) + ' — in ' + JP.fmtMMSS(left)}</span>
        <b>Sea</b><span class="v">${JP.sys.storm.wind > 40 ? 'ROUGH — captain will not wait' : 'moderate'}</span></div>
        <div class="big" style="margin-top:12px">${d.departed ? '— — : — —' : JP.fmtMMSS(left)}</div>
        <div class="note">Captain: "Last boat before the storm. I leave at seven, with or without your cargo."</div>`;
    } };
  } });

  /* ---------- Personnel ---------- */
  def('people', { title: 'Personnel — Sessions', glyph: 'WHO', build(body) {
    return { update() {
      body.innerHTML = `<h1><span>LOGGED-IN SESSIONS</span><span class="st">${JP.sys.users.filter(u => u.status === 'ACTIVE').length} ACTIVE</span></h1>
        <table><tr><th></th><th>USER</th><th>NAME</th><th>ROLE</th><th>TTY</th><th>FROM</th><th>STATUS</th></tr>
        ${JP.sys.users.map(u => `<tr class="${u.status === 'AWAY' ? 'warn' : u.status === 'OFF-LINE' ? 'off' : ''}"><td>${lamp(u.status === 'ACTIVE' ? true : u.status === 'AWAY' ? 'warn' : 'dim')}</td><td>${u.user}</td><td>${u.name}</td><td>${u.role}</td><td>${u.tty}</td><td>${u.from}</td><td>${u.status}${u.note ? ' — ' + u.note : ''}</td></tr>`).join('')}</table>`;
    } };
  } });

  /* ---------- FSN ---------- */
  def('fsn', { title: 'fsn — File System Navigator (3D)', glyph: 'FSN', cls: 'fsn', build(body) { return JP.fsn.mount(body); } });

  return { def, open, openAll, rect, reg };
})();
