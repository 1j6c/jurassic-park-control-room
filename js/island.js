/* Carte vivante d'Isla Nublar : enclos, clôtures, capteurs, animaux, véhicules, tempête. */
JP.island = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const S = (tag, attrs = {}, ...kids) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
    for (const k of kids) if (k != null) e.append(k.nodeType ? k : document.createTextNode(String(k)));
    return e;
  };
  const P = pts => pts.map(p => p.join(',')).join(' ');

  const COAST = [[500,40],[560,55],[610,80],[650,120],[690,170],[720,230],[740,300],[750,370],[745,440],[705,470],[720,510],[760,540],[770,570],[750,620],[730,680],[700,740],[660,800],[610,850],[560,890],[510,920],[460,930],[410,915],[360,890],[320,850],[290,800],[260,740],[240,680],[225,620],[230,560],[245,500],[235,440],[240,380],[260,320],[285,260],[320,200],[360,150],[400,110],[450,70]];
  const PADDOCKS = [
    { id: 'pro', name: 'PROCERATOSAUR', pts: [[455,95],[560,85],[600,140],[560,185],[470,180],[440,140]], n: 3, carn: true },
    { id: 'her', name: 'HERRERASAUR', pts: [[330,190],[440,170],[455,265],[400,300],[335,285]], n: 2, carn: true },
    { id: 'gal', name: 'GALLIMIMUS PLAINS', pts: [[570,180],[690,200],[715,300],[640,330],[575,305]], n: 8 },
    { id: 'rap', name: 'RAPTOR PEN', pts: [[545,335],[590,335],[592,372],[547,372]], n: 3, carn: true, small: true },
    { id: 'met', name: 'METRIACANTHOSAUR', pts: [[262,395],[350,385],[370,470],[340,540],[255,520]], n: 2, carn: true },
    { id: 'tyr', name: 'TYRANNOSAUR PADDOCK', pts: [[392,470],[520,460],[545,520],[540,620],[440,640],[388,590]], n: 1, carn: true, rex: true },
    { id: 'dil', name: 'DILOPHOSAUR', pts: [[600,400],[690,410],[680,470],[640,505],[600,480]], n: 3, carn: true },
    { id: 'tri', name: 'TRICERATOPS', pts: [[300,640],[410,650],[425,740],[370,780],[290,760]], n: 4 },
    { id: 'bra', name: 'BRACHIOSAUR / PARASAUR', pts: [[450,700],[600,690],[650,780],[585,850],[480,865],[430,790]], n: 6, lake: [[500,760],[560,750],[590,790],[560,830],[500,825],[475,795]] },
    { id: 'bar', name: 'BARYONYX', pts: [[630,560],[730,570],[725,655],[680,690],[620,650]], n: 1, carn: true },
    { id: 'seg', name: 'SEGISAUR', pts: [[300,780],[375,790],[390,850],[345,870],[300,850]], n: 5, carn: true },
  ];
  const TOUR_D = 'M505,412 L565,432 C600,480 585,540 565,570 C545,640 500,672 450,672 L435,672 C400,672 380,640 372,600 C365,540 372,500 380,470 C400,432 440,420 505,412 Z';
  const SPUR_D = 'M450,672 L438,745';
  const DOCK_D = 'M540,405 L600,392 L660,392 L700,420 L708,478';
  const OFFROAD_D = 'M700,420 L688,448 L672,462 L660,470';
  const REX_VIEW = [565, 570];

  const centroid = pts => { const n = pts.length; return [pts.reduce((a, p) => a + p[0], 0) / n, pts.reduce((a, p) => a + p[1], 0) / n]; };
  const scalePoly = (pts, k, c) => pts.map(([x, y]) => [c[0] + (x - c[0]) * k, c[1] + (y - c[1]) * k]);
  const inPoly = (x, y, pts) => {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const bbox = pts => ({ x0: Math.min(...pts.map(p => p[0])), x1: Math.max(...pts.map(p => p[0])), y0: Math.min(...pts.map(p => p[1])), y1: Math.max(...pts.map(p => p[1])) });

  let svg, layers = {}, tourPath, spurPath, dockPath, offPath, animals = [], sensors = [], vehEls = {}, jp12El, rexEl, raptorEls = [], stormEl, rainG, statusEl;
  const show = { fences: true, sensors: true, vehicles: true, sectors: true, storm: true };
  const activity = {};   // hits par enclos (pour le panneau capteurs)

  function build() {
    svg = S('svg', { viewBox: '0 0 1000 1000', preserveAspectRatio: 'xMidYMid meet' });
    const defs = S('defs');
    defs.innerHTML = `
      <radialGradient id="g-land" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#2f7a35"/><stop offset="1" stop-color="#1c4a24"/></radialGradient>
      <linearGradient id="g-storm" x1="0" x2="1"><stop offset="0" stop-color="#5a6f8a" stop-opacity="0"/><stop offset=".35" stop-color="#4a5f7a" stop-opacity=".55"/><stop offset="1" stop-color="#2a3448" stop-opacity=".85"/></linearGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <clipPath id="clip-land"><polygon points="${P(COAST)}"/></clipPath>
      <style>
        .fence { fill: none; stroke-width: 2.2; stroke-linejoin: round; }
        .fence.on { stroke: #ffd23c; stroke-dasharray: 7 3; animation: flow 1s linear infinite; }
        .fence.off { stroke: #ff3b3b; stroke-dasharray: 2 6; animation: blink .9s steps(2) infinite; }
        @keyframes flow { to { stroke-dashoffset: -10; } }
        @keyframes blink { 50% { opacity: .3; } }
        .pad-fill { fill: rgba(255,210,60,.05); }
        .pad-fill.off { fill: rgba(255,59,59,.12); }
        .lbl { fill: #cfe; font-size: 11px; letter-spacing: .5px; paint-order: stroke; stroke: #04101c; stroke-width: 3px; }
        .lbl.sm { font-size: 9px; fill: #9cb; }
        .sec { stroke: rgba(120,170,220,.16); stroke-width: 1; }
        .sec-lbl { fill: rgba(150,200,255,.35); font-size: 12px; }
        .sensor { fill: #5b6f80; }
        .sensor.hit { fill: #fff; filter: url(#glow); }
        .sensor.dead { fill: #3a2a2a; }
        .animal { filter: url(#glow); }
        .bld { fill: #d8dee6; stroke: #1c2a38; stroke-width: 1; }
        .rain line { stroke: rgba(180,210,255,.45); stroke-width: 1; }
        .rain { animation: rainfall .45s linear infinite; }
        @keyframes rainfall { from { transform: translate(6px,-30px); } to { transform: translate(-6px,30px); } }
        .veh text { font-size: 9px; fill: #5fe8ff; font-weight: 700; }
        .veh rect { fill: #5fe8ff; stroke: #000; }
        .veh.stopped rect { fill: #ffb443; animation: blink 1s steps(2) infinite; }
        .veh.lost rect { fill: #ff3b3b; animation: none; } .veh.lost text { fill: #ff3b3b; }
      </style>`;
    svg.append(defs);

    /* Eau */
    svg.append(S('rect', { width: 1000, height: 1000, fill: '#04101c' }));
    for (let i = 0; i < 14; i++) svg.append(S('path', { d: `M0,${60 + i * 70} q60,-8 120,0 t120,0 t120,0 t120,0 t120,0 t120,0 t120,0 t120,0`, fill: 'none', stroke: 'rgba(80,140,200,.08)', 'stroke-width': 1 }));
    svg.append(S('polygon', { points: P(COAST), fill: 'none', stroke: 'rgba(60,140,200,.35)', 'stroke-width': 10 }));
    svg.append(S('polygon', { points: P(COAST), fill: 'url(#g-land)', stroke: '#8fd0a0', 'stroke-width': 1.5 }));
    const c = centroid(COAST);
    svg.append(S('polygon', { points: P(scalePoly(COAST, 0.78, c)), fill: 'rgba(120,200,120,.08)', stroke: 'rgba(160,230,160,.25)', 'stroke-width': 1 }));
    svg.append(S('polygon', { points: P(scalePoly(COAST, 0.55, c)), fill: 'rgba(120,200,120,.08)', stroke: 'rgba(160,230,160,.25)', 'stroke-width': 1 }));
    svg.append(S('polygon', { points: P(scalePoly(COAST, 0.32, [430, 560])), fill: 'rgba(120,200,120,.1)', stroke: 'rgba(160,230,160,.25)', 'stroke-width': 1 }));
    /* Rivières */
    svg.append(S('path', { d: 'M470,120 C440,220 380,300 390,420 M620,220 C640,300 600,360 640,420 C700,470 690,560 720,600', fill: 'none', stroke: '#3c8fc4', 'stroke-width': 2, opacity: .7 }));

    /* Secteurs */
    layers.sectors = S('g');
    for (let i = 1; i < 8; i++) {
      layers.sectors.append(S('line', { class: 'sec', x1: i * 125, y1: 0, x2: i * 125, y2: 1000 }));
      layers.sectors.append(S('line', { class: 'sec', x1: 0, y1: i * 125, x2: 1000, y2: i * 125 }));
    }
    for (let i = 0; i < 8; i++) {
      layers.sectors.append(S('text', { class: 'sec-lbl', x: i * 125 + 4, y: 14 }, i + 1));
      layers.sectors.append(S('text', { class: 'sec-lbl', x: 4, y: i * 125 + 30 }, 'ABCDEFGH'[i]));
    }
    svg.append(layers.sectors);

    /* Enclos + clôtures */
    layers.fences = S('g');
    for (const p of PADDOCKS) {
      const g = S('g', { 'data-id': p.id });
      g.append(S('polygon', { points: P(p.pts), class: 'pad-fill', id: 'padfill-' + p.id }));
      if (p.lake) g.append(S('polygon', { points: P(p.lake), fill: '#2b6d9c', stroke: '#7cc4ff', 'stroke-width': 1 }));
      g.append(S('polygon', { points: P(p.pts), class: 'fence on', id: 'fence-' + p.id }));
      const cc = centroid(p.pts);
      g.append(S('text', { class: 'lbl' + (p.small ? ' sm' : ''), x: cc[0], y: cc[1] + (p.small ? 3 : -4), 'text-anchor': 'middle' }, p.name));
      if (!p.small) g.append(S('text', { class: 'lbl sm', x: cc[0], y: cc[1] + 10, 'text-anchor': 'middle', id: 'padinfo-' + p.id }, ''));
      layers.fences.append(g);
    }
    layers.fences.append(S('polygon', { points: P(scalePoly(COAST, 0.965, c)), class: 'fence on', id: 'fence-per' }));
    svg.append(layers.fences);

    /* Capteurs */
    layers.sensors = S('g');
    for (const p of PADDOCKS) {
      const pts = p.pts;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        for (const t of (p.small ? [0] : [0, 0.5])) {
          const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
          const el = S('rect', { class: 'sensor', x: x - 2, y: y - 2, width: 4, height: 4 });
          sensors.push({ x, y, el, pad: p.id, hot: 0 });
          layers.sensors.append(el);
        }
      }
    }
    svg.append(layers.sensors);

    /* Routes */
    const roads = S('g');
    roads.append(S('path', { d: TOUR_D, fill: 'none', stroke: '#000', 'stroke-width': 5, opacity: .6 }));
    tourPath = S('path', { d: TOUR_D, fill: 'none', stroke: '#ffb443', 'stroke-width': 3 });
    roads.append(tourPath);
    roads.append(S('path', { d: TOUR_D, fill: 'none', stroke: '#fff', 'stroke-width': .6, 'stroke-dasharray': '4 4' }));
    spurPath = S('path', { d: SPUR_D, fill: 'none', stroke: '#ffb443', 'stroke-width': 2 });
    roads.append(spurPath);
    roads.append(S('path', { d: DOCK_D, fill: 'none', stroke: '#000', 'stroke-width': 4, opacity: .6 }));
    dockPath = S('path', { d: DOCK_D, fill: 'none', stroke: '#c8c8c8', 'stroke-width': 2 });
    roads.append(dockPath);
    offPath = S('path', { d: OFFROAD_D, fill: 'none', stroke: 'none' });
    roads.append(offPath);
    roads.append(S('text', { class: 'lbl sm', x: 612, y: 386 }, 'EAST DOCK ROAD'));
    roads.append(S('text', { class: 'lbl sm', x: 574, y: 578 }, 'REX VIEWPOINT'));
    svg.append(roads);

    /* Bâtiments */
    const b = S('g');
    b.append(S('rect', { class: 'bld', x: 468, y: 352, width: 70, height: 52, rx: 2 }));
    b.append(S('text', { class: 'lbl', x: 503, y: 372, 'text-anchor': 'middle', style: 'font-size:10px;fill:#123;stroke:none' }, 'VISITOR'));
    b.append(S('text', { class: 'lbl', x: 503, y: 384, 'text-anchor': 'middle', style: 'font-size:10px;fill:#123;stroke:none' }, 'CENTER'));
    b.append(S('text', { class: 'lbl', x: 503, y: 397, 'text-anchor': 'middle', style: 'font-size:7px;fill:#456;stroke:none' }, 'CONTROL ROOM'));
    b.append(S('circle', { cx: 452, cy: 330, r: 9, fill: '#333', stroke: '#eee', 'stroke-width': 1 }));
    b.append(S('text', { x: 452, y: 334, 'text-anchor': 'middle', style: 'font-size:10px;fill:#fff;font-weight:700' }, 'H'));
    b.append(S('rect', { class: 'bld', x: 548, y: 382, width: 40, height: 22 }));
    b.append(S('text', { class: 'lbl sm', x: 568, y: 396, 'text-anchor': 'middle', style: 'fill:#123;stroke:none;font-size:7px' }, 'GENETICS'));
    b.append(S('rect', { class: 'bld', x: 425, y: 425, width: 28, height: 16 }));
    b.append(S('text', { class: 'lbl sm', x: 439, y: 452, 'text-anchor': 'middle' }, 'MAINT. SHED'));
    b.append(S('rect', { class: 'bld', x: 472, y: 410, width: 30, height: 12 }));
    b.append(S('text', { class: 'lbl sm', x: 487, y: 434, 'text-anchor': 'middle' }, 'GARAGE'));
    b.append(S('rect', { class: 'bld', x: 704, y: 474, width: 8, height: 8 }));
    b.append(S('line', { x1: 708, y1: 478, x2: 738, y2: 486, stroke: '#d8dee6', 'stroke-width': 3 }));
    b.append(S('text', { class: 'lbl sm', x: 712, y: 500, 'text-anchor': 'middle' }, 'EAST DOCK'));
    b.append(S('rect', { class: 'bld', x: 556, y: 401, width: 6, height: 8, id: 'eastgate' }));
    b.append(S('text', { class: 'lbl sm', x: 559, y: 424, 'text-anchor': 'middle' }, 'E. GATE'));
    svg.append(b);

    /* Animaux */
    layers.animals = S('g');
    for (const p of PADDOCKS) {
      const bb = bbox(p.pts);
      for (let i = 0; i < p.n; i++) {
        let x, y, tries = 0;
        do { x = JP.rand(bb.x0, bb.x1); y = JP.rand(bb.y0, bb.y1); } while (!inPoly(x, y, p.pts) && ++tries < 50);
        const el = S('circle', { class: 'animal', cx: x, cy: y, r: p.rex ? 5 : 2.4, fill: p.carn ? '#ff6b6b' : '#8cff8c' });
        const a = { x, y, vx: JP.rand(-1, 1), vy: JP.rand(-1, 1), pad: p, el, rex: !!p.rex, speed: p.rex ? 0.35 : p.id === 'gal' ? 1.4 : 0.6 };
        animals.push(a);
        layers.animals.append(el);
        if (p.rex) rexEl = a;
      }
    }
    svg.append(layers.animals);

    /* Véhicules */
    layers.vehicles = S('g');
    for (const id of ['EXP-04', 'EXP-05', 'JP-12']) {
      const g = S('g', { class: 'veh', id: 'veh-' + id });
      g.append(S('rect', { x: -7, y: -4, width: 14, height: 8, rx: 1 }));
      g.append(S('text', { x: 9, y: 3 }, id));
      layers.vehicles.append(g);
      vehEls[id] = g;
    }
    vehEls['JP-12'].style.display = 'none';
    jp12El = vehEls['JP-12'];
    svg.append(layers.vehicles);

    /* Tempête */
    layers.storm = S('g');
    stormEl = S('rect', { x: 1000, y: 0, width: 800, height: 1000, fill: 'url(#g-storm)' });
    layers.storm.append(stormEl);
    rainG = S('g', { class: 'rain', 'clip-path': 'url(#clip-land)', style: 'display:none' });
    for (let i = 0; i < 140; i++) {
      const x = JP.rand(180, 820), y = JP.rand(0, 1000);
      rainG.append(S('line', { x1: x, y1: y, x2: x - 5, y2: y + 16 }));
    }
    layers.storm.append(rainG);
    svg.append(layers.storm);

    /* Cartouche */
    const t = S('g');
    t.append(S('text', { x: 20, y: 60, style: 'font-size:26px;fill:#fff;font-weight:700;letter-spacing:3px' }, 'ISLA NUBLAR'));
    t.append(S('text', { x: 20, y: 80, style: 'font-size:10px;fill:#9cb' }, '10°N 87°W · 120 mi W of Costa Rica · 22 sq mi'));
    t.append(S('text', { x: 20, y: 96, style: 'font-size:10px;fill:#9cb' }, 'JURASSIC PARK SYSTEM MAP · rev 2.1 · InGen'));
    t.append(S('text', { x: 980, y: 990, 'text-anchor': 'end', style: 'font-size:10px;fill:#9cb' }, 'GRID 125 m · SECTORS 1-8 / A-H'));
    const lg = S('g', { transform: 'translate(20,900)' });
    lg.append(S('line', { x1: 0, y1: 0, x2: 30, y2: 0, class: 'fence on' }));
    lg.append(S('text', { x: 38, y: 4, style: 'font-size:10px;fill:#cfe' }, 'FENCE ENERGIZED 10,000 V'));
    lg.append(S('line', { x1: 0, y1: 18, x2: 30, y2: 18, class: 'fence off' }));
    lg.append(S('text', { x: 38, y: 22, style: 'font-size:10px;fill:#cfe' }, 'FENCE OFFLINE'));
    lg.append(S('circle', { cx: 15, cy: 36, r: 3, fill: '#ff6b6b' }));
    lg.append(S('text', { x: 38, y: 40, style: 'font-size:10px;fill:#cfe' }, 'CARNIVORE'));
    lg.append(S('circle', { cx: 15, cy: 54, r: 3, fill: '#8cff8c' }));
    lg.append(S('text', { x: 38, y: 58, style: 'font-size:10px;fill:#cfe' }, 'HERBIVORE'));
    lg.append(S('rect', { x: 12, y: 68, width: 6, height: 6, class: 'sensor' }));
    lg.append(S('text', { x: 38, y: 76, style: 'font-size:10px;fill:#cfe' }, 'MOTION SENSOR'));
    t.append(lg);
    svg.append(t);
    return svg;
  }

  function mount(container) {
    const wrap = JP.el('div', { class: 'map-wrap' });
    wrap.append(build());
    const tools = JP.el('div', { class: 'map-tools' });
    for (const k of Object.keys(show)) {
      const btn = JP.el('div', { class: 'mx-btn on', text: k.toUpperCase(), onclick: () => { show[k] = !show[k]; btn.classList.toggle('on', show[k]); layers[k].style.display = show[k] ? '' : 'none'; JP.audio.click(); } });
      tools.append(btn);
    }
    statusEl = JP.el('div', { class: 'st', text: '' });
    tools.append(statusEl);
    wrap.append(tools);
    container.append(wrap);
    JP.clock.onFrame(tick);
    return wrap;
  }

  /* Position le long d'un chemin (t ∈ 0..1) */
  const along = (path, t) => path.getPointAtLength(JP.clamp(t, 0, 1) * path.getTotalLength());
  let rexViewT = null;
  function rexViewProgress() {
    if (rexViewT != null) return rexViewT;
    const L = tourPath.getTotalLength(); let best = 0, bd = 1e9;
    for (let i = 0; i <= 400; i++) { const p = tourPath.getPointAtLength(L * i / 400); const d = Math.hypot(p.x - REX_VIEW[0], p.y - REX_VIEW[1]); if (d < bd) { bd = d; best = i / 400; } }
    return (rexViewT = best);
  }

  function tick(dt) {
    const sim = dt * JP.state.timescale;
    const sys = JP.sys, st = JP.state;

    /* Clôtures */
    for (const f of sys.fences) {
      const el = svg.getElementById('fence-' + f.id); if (!el) continue;
      el.setAttribute('class', 'fence ' + (f.on ? 'on' : 'off'));
      svg.getElementById('padfill-' + f.id)?.setAttribute('class', 'pad-fill' + (f.on ? '' : ' off'));
    }

    /* Animaux : marche aléatoire dans l'enclos, sortie si clôture HS pour le rex/raptors */
    for (const a of animals) {
      if (a.rex) { rexTick(a, sim); continue; }
      if (a.pad.id === 'rap' && st.raptors.loose) { raptorTick(a, sim); continue; }
      if (Math.random() < 0.02) { a.vx = JP.rand(-1, 1); a.vy = JP.rand(-1, 1); }
      const nx = a.x + a.vx * a.speed * sim * 0.6, ny = a.y + a.vy * a.speed * sim * 0.6;
      if (inPoly(nx, ny, a.pad.pts)) { a.x = nx; a.y = ny; } else { a.vx *= -1; a.vy *= -1; }
      a.el.setAttribute('cx', a.x); a.el.setAttribute('cy', a.y);
    }

    /* Capteurs */
    const sensorsOn = sys.sensors.online > 0;
    for (const s of sensors) {
      if (!sensorsOn) { s.el.setAttribute('class', 'sensor dead'); continue; }
      let hit = false;
      for (const a of animals) if (Math.abs(a.x - s.x) < 40 && Math.abs(a.y - s.y) < 40 && Math.hypot(a.x - s.x, a.y - s.y) < 40) { hit = true; break; }
      if (hit && s.hot <= 0) { s.hot = 1.2; sys.sensors.hits++; activity[s.pad] = (activity[s.pad] || 0) + 1; }
      s.hot -= dt;
      s.el.setAttribute('class', 'sensor' + (s.hot > 0 ? ' hit' : ''));
    }
    for (const p of PADDOCKS) {
      const info = svg.getElementById('padinfo-' + p.id);
      if (info) info.textContent = sensorsOn ? `TRACKING ${p.id === 'tyr' && st.rex.loose ? 0 : p.id === 'rap' && st.raptors.loose ? 0 : p.n}` : 'NO DATA';
    }

    /* Véhicules de la visite */
    const tour = sys.tour;
    if (tour.state === 'EN ROUTE') tour.progress = (tour.progress + sim / 2860) % 1;
    else if (tour.state === 'RETURNING') tour.progress = Math.max(0, tour.progress - sim / 2860);
    const p1 = along(tourPath, tour.progress), p2 = along(tourPath, (tour.progress - 0.012 + 1) % 1);
    vehEls['EXP-04'].setAttribute('transform', `translate(${p1.x},${p1.y})`);
    vehEls['EXP-05'].setAttribute('transform', `translate(${p2.x},${p2.y})`);
    tour.vehicles.forEach((v, i) => {
      const el = vehEls[v.id];
      el.setAttribute('class', 'veh' + (!v.signal ? ' lost' : tour.state === 'STOPPED' ? ' stopped' : ''));
      el.style.display = v.hidden ? 'none' : '';
    });

    /* Jeep de Nedry */
    const j = sys.jp12;
    if (j.progress != null) {
      jp12El.style.display = j.hidden ? 'none' : '';
      const p = j.offroad != null ? along(offPath, j.offroad) : along(dockPath, j.progress);
      jp12El.setAttribute('transform', `translate(${p.x},${p.y})`);
      jp12El.setAttribute('class', 'veh' + (!j.signal ? ' lost' : j.stopped ? ' stopped' : ''));
    }

    /* Tempête */
    const w = sys.storm;
    stormEl.setAttribute('x', 1000 - (14 - JP.clamp(w.distance, 0, 14)) / 14 * 620);
    rainG.style.display = w.rain > 0.15 && show.storm ? '' : 'none';
    rainG.style.opacity = JP.clamp(w.rain, 0, 1);

    if (statusEl) statusEl.textContent = `${sensorsOn ? sys.sensors.hits + ' sensor hits' : 'SENSORS OFFLINE'} · ${tour.state} ${(tour.progress * 100).toFixed(0)}%`;
  }

  /* T-Rex : dans l'enclos, puis sort vers le point de vue, puis erre */
  function rexTick(a, sim) {
    const st = JP.state;
    if (!st.rex.loose) {
      if (Math.random() < 0.01) { a.vx = JP.rand(-1, 1); a.vy = JP.rand(-1, 1); }
      const nx = a.x + a.vx * a.speed * sim * 0.6, ny = a.y + a.vy * a.speed * sim * 0.6;
      if (inPoly(nx, ny, a.pad.pts)) { a.x = nx; a.y = ny; } else { a.vx *= -1; a.vy *= -1; }
    } else if (st.rex.hidden) {
      a.el.style.display = 'none';
    } else {
      const tgt = st.rex.target || REX_VIEW;
      const dx = tgt[0] - a.x, dy = tgt[1] - a.y, d = Math.hypot(dx, dy);
      if (d < 4) st.rex.target = [JP.rand(480, 640), JP.rand(540, 700)];
      else { a.x += dx / d * 0.8 * sim; a.y += dy / d * 0.8 * sim; }
      a.el.setAttribute('r', 6);
    }
    a.el.setAttribute('cx', a.x); a.el.setAttribute('cy', a.y);
  }
  /* Raptors : sortent de l'enclos vers le visitor center */
  function raptorTick(a, sim) {
    const st = JP.state;
    const tgt = st.raptors.contained ? [JP.rand(540, 560), JP.rand(378, 400)] : (a.tgt || (a.tgt = [JP.rand(492, 540), JP.rand(356, 404)]));
    const dx = tgt[0] - a.x, dy = tgt[1] - a.y, d = Math.hypot(dx, dy);
    if (d < 3) a.tgt = [JP.rand(470, 545), JP.rand(350, 410)];
    else { a.x += dx / d * 1.6 * sim; a.y += dy / d * 1.6 * sim; }
    a.el.setAttribute('cx', a.x); a.el.setAttribute('cy', a.y);
  }

  function activitySnapshot() { const o = { ...activity }; for (const k in activity) activity[k] = 0; return o; }
  function stopTourAtRexView() { JP.sys.tour.progress = rexViewProgress(); JP.sys.tour.state = 'STOPPED'; }
  function rexPos() { return rexEl ? [rexEl.x, rexEl.y] : REX_VIEW; }

  return { mount, PADDOCKS, activitySnapshot, stopTourAtRexView, rexViewProgress, rexPos, REX_VIEW };
})();
