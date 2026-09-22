/* fsn — le navigateur 3D de fichiers d'IRIX ("It's a UNIX system! I know this!"). Canvas 2D, projection maison. */
JP.fsn = (() => {
  let cv, x, W = 800, H = 500, host, hdr, view, nodes = [], byPath = {}, cur = null, fileSel = -1;
  const cam = { x: 0, y: 1.3, z: -2.8 }, camT = { x: 0, y: 1.3, z: -2.8 };
  const PITCH = -0.42, F = 1.35, SPX = 1.9, SPZ = 2.6;
  let raf = null, visible = false, t0 = performance.now();

  function build() {
    nodes = []; byPath = {};
    const width = (node) => { const dirs = Object.entries(node.children).filter(([, c]) => c.type === 'dir'); return Math.max(1, dirs.reduce((a, [, c]) => a + width(c), 0)); };
    function layout(node, name, path, depth, x0, parent) {
      const w = width(node);
      const n = { name, path, node, depth, w, x: (x0 + w / 2) * SPX, z: depth * SPZ, parent, kids: [], files: Object.entries(node.children).filter(([, c]) => c.type !== 'dir') };
      nodes.push(n); byPath[path] = n;
      let off = x0;
      for (const [k, c] of Object.entries(node.children).filter(([, c]) => c.type === 'dir').sort((a, b) => a[0].localeCompare(b[0]))) {
        n.kids.push(layout(c, k, (path === '/' ? '' : path) + '/' + k, depth + 1, off, n));
        off += width(c);
      }
      return n;
    }
    const rootN = layout(JP.fs.root, '/', '/', 0, 0, null);
    const shift = rootN.x;
    for (const n of nodes) n.x -= shift;
    return rootN;
  }

  function mount(body) {
    host = body;
    hdr = JP.el('div', { class: 'fsn-hdr' }, JP.el('span', { class: 'path', text: '/' }), JP.el('span', { class: 'hint', text: '← → siblings · ↑ enter · ↓ up · Tab files · ⏎ open · click to fly' }));
    cv = JP.el('canvas', { tabindex: '0' });
    x = cv.getContext('2d');
    body.append(hdr, cv);
    if (!nodes.length) build();
    select(byPath['/usr/jpsys'] || nodes[0], true);
    cv.addEventListener('keydown', onKey);
    cv.addEventListener('click', onClick);
    cv.addEventListener('pointerdown', () => cv.focus());
    const ro = new ResizeObserver(resize); ro.observe(body);
    resize();
    return { onShow() { visible = true; cv.focus(); loop(); }, onHide() { visible = false; }, onResize: resize };
  }
  function resize() {
    if (!cv) return;
    const r = cv.getBoundingClientRect(); W = Math.max(200, Math.round(r.width)); H = Math.max(120, Math.round(r.height));
    cv.width = W; cv.height = H;
  }
  function select(n, snap = false) {
    cur = n; fileSel = -1;
    camT.x = n.x; camT.z = n.z - 2.8; camT.y = 1.3;
    if (snap) Object.assign(cam, camT);
    hdr.querySelector('.path').textContent = n.path + (n.files.length ? `   (${n.files.length} files)` : '');
    closeView();
  }
  function onKey(e) {
    const sib = cur.parent ? cur.parent.kids : [cur];
    const i = sib.indexOf(cur);
    if (e.key === 'ArrowLeft') { if (i > 0) select(sib[i - 1]); JP.audio.blip(); }
    else if (e.key === 'ArrowRight') { if (i < sib.length - 1) select(sib[i + 1]); JP.audio.blip(); }
    else if (e.key === 'ArrowUp') { if (cur.kids.length) select(cur.kids[0]); JP.audio.blip(); }
    else if (e.key === 'ArrowDown' || e.key === 'Backspace') { if (cur.parent) select(cur.parent); JP.audio.blip(); }
    else if (e.key === 'Tab') { e.preventDefault(); if (cur.files.length) { fileSel = (fileSel + 1) % cur.files.length; JP.audio.click(); } }
    else if (e.key === 'Enter') { if (fileSel >= 0) openFile(cur.files[fileSel]); else if (cur.kids.length) select(cur.kids[0]); }
    else if (e.key === 'Escape') closeView();
    else return;
    e.preventDefault();
  }
  function onClick(e) {
    const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    let best = null, bd = 40;
    for (const n of nodes) { const p = project(n.x, 0, n.z); if (!p) continue; const d = Math.hypot(p.x - mx, p.y - my); if (d < bd) { bd = d; best = n; } }
    if (best) { select(best); JP.audio.blip(); }
    cv.focus();
  }
  function project(px, py, pz) {
    const dx = px - cam.x, dy = py - cam.y, dz = pz - cam.z;
    const cy = Math.cos(PITCH), sy = Math.sin(PITCH);
    const y2 = dy * cy - dz * sy, z2 = dy * sy + dz * cy;
    if (z2 < 0.15) return null;
    return { x: W / 2 + dx * F / z2 * (H / 2), y: H / 2 - y2 * F / z2 * (H / 2), s: F / z2 * (H / 2), z: z2 };
  }
  function quad(pts, fill, stroke) {
    const p = pts.map(([a, b, c]) => project(a, b, c)); if (p.some(q => !q)) return;
    x.beginPath(); x.moveTo(p[0].x, p[0].y); for (let i = 1; i < p.length; i++) x.lineTo(p[i].x, p[i].y); x.closePath();
    if (fill) { x.fillStyle = fill; x.fill(); } if (stroke) { x.strokeStyle = stroke; x.stroke(); }
  }
  const fileColor = (name, node) => node.special === 'door_locks' ? '#ffe14a' : node.special === 'whte_rbt' ? '#ff3b3b' : node.bin ? '#b38cff' : /\.(cfg|prog)$/.test(name) ? '#ffb443' : /\.(db|log)$/.test(name) ? '#5fe8ff' : '#d8e8f0';

  function draw() {
    const t = (performance.now() - t0) / 1000;
    cam.x += (camT.x - cam.x) * 0.08; cam.y += (camT.y - cam.y) * 0.08; cam.z += (camT.z - cam.z) * 0.08;
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#000'); g.addColorStop(.55, '#02060f'); g.addColorStop(1, '#061225');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    /* grille au sol */
    x.lineWidth = 1;
    const gx0 = Math.floor((cam.x - 24) / SPX) * SPX;
    for (let gx = gx0; gx < cam.x + 24; gx += SPX) { const a = project(gx, -0.02, cam.z + 0.3), b = project(gx, -0.02, cam.z + 40); if (a && b) { x.strokeStyle = 'rgba(60,120,200,.18)'; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); } }
    for (let gz = Math.floor(cam.z / SPZ) * SPZ; gz < cam.z + 40; gz += SPZ) { const a = project(cam.x - 24, -0.02, gz), b = project(cam.x + 24, -0.02, gz); if (a && b) { x.strokeStyle = `rgba(60,120,200,${Math.max(0.03, 0.25 - (gz - cam.z) * 0.006)})`; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); } }
    /* du plus loin au plus proche */
    const sorted = [...nodes].sort((a, b) => b.z - a.z);
    for (const n of sorted) {
      /* câbles vers les enfants */
      for (const k of n.kids) {
        const a = project(n.x, 0.02, n.z + 0.5), b = project(k.x, 0.02, k.z - 0.5); if (!a || !b) continue;
        x.strokeStyle = k === cur || n === cur ? 'rgba(95,232,255,.9)' : 'rgba(95,232,255,.35)'; x.lineWidth = k === cur ? 2 : 1;
        x.beginPath(); x.moveTo(a.x, a.y); x.bezierCurveTo(a.x, a.y - 20, b.x, b.y + 20, b.x, b.y); x.stroke();
      }
    }
    for (const n of sorted) {
      const sel = n === cur, hw = 0.85, hd = 0.5, h = 0.1;
      const top = sel ? '#1e5f8a' : n.path.startsWith('/usr/nedry') ? '#4a2a3a' : '#123a5c', side = sel ? '#0e3a5a' : '#0a2238', edge = sel ? '#5fe8ff' : 'rgba(95,232,255,.55)';
      quad([[n.x - hw, 0, n.z - hd], [n.x + hw, 0, n.z - hd], [n.x + hw, -h, n.z - hd], [n.x - hw, -h, n.z - hd]], side, null);
      quad([[n.x - hw, 0, n.z - hd], [n.x + hw, 0, n.z - hd], [n.x + hw, 0, n.z + hd], [n.x - hw, 0, n.z + hd]], top, edge);
      if (sel) { x.shadowColor = '#5fe8ff'; x.shadowBlur = 18; quad([[n.x - hw, 0, n.z - hd], [n.x + hw, 0, n.z - hd], [n.x + hw, 0, n.z + hd], [n.x - hw, 0, n.z + hd]], null, edge); x.shadowBlur = 0; }
      /* fichiers : boîtes sur la plateforme */
      const files = n.files.slice(0, 12), cols = 4;
      files.forEach(([name, node], i) => {
        const c = i % cols, r = Math.floor(i / cols);
        const bx = n.x - hw + 0.22 + c * 0.4, bz = n.z - hd + 0.15 + r * 0.3;
        const bh = JP.clamp(0.12 + Math.log10(Math.max(10, node.size)) * 0.08, 0.12, 0.7), s = 0.13, d = 0.09;
        const col = fileColor(name, node), fsel = sel && fileSel === i;
        const pulse = node.special === 'door_locks' ? 0.5 + 0.5 * Math.sin(t * 6) : 1;
        x.globalAlpha = fsel ? 1 : 0.85 * pulse + 0.15;
        quad([[bx - s, bh, bz - d], [bx + s, bh, bz - d], [bx + s, 0, bz - d], [bx - s, 0, bz - d]], shade(col, 0.55), null);
        quad([[bx + s, bh, bz - d], [bx + s, bh, bz + d], [bx + s, 0, bz + d], [bx + s, 0, bz - d]], shade(col, 0.35), null);
        quad([[bx - s, bh, bz - d], [bx + s, bh, bz - d], [bx + s, bh, bz + d], [bx - s, bh, bz + d]], col, fsel ? '#fff' : null);
        x.globalAlpha = 1;
        if (sel) { const p = project(bx, bh + 0.05, bz); if (p) { x.fillStyle = fsel ? '#fff' : col; x.font = `${Math.max(8, Math.min(12, p.s * 0.05))}px Menlo`; x.textAlign = 'center'; x.fillText(name, p.x, p.y - 2); } }
      });
      /* étiquette du dossier */
      const lp = project(n.x, 0, n.z - hd - 0.1);
      if (lp) {
        const fs = JP.clamp(lp.s * 0.09, 7, 18);
        x.font = `${sel ? 'bold ' : ''}${fs}px Menlo`; x.textAlign = 'center';
        x.fillStyle = sel ? '#fff' : n.path.startsWith('/usr/nedry') ? '#ff9ab0' : '#9fd8ff';
        x.fillText(n.name + (n.files.length > 12 ? ` (+${n.files.length - 12})` : ''), lp.x, lp.y + fs + 2);
      }
    }
    /* HUD */
    x.textAlign = 'left'; x.fillStyle = '#5fe8ff'; x.font = '11px Menlo';
    x.fillText(`fsn  ${cur.path}`, 10, H - 24);
    x.fillStyle = '#678'; x.fillText(`${nodes.length} directories · cam ${cam.x.toFixed(1)},${cam.z.toFixed(1)}`, 10, H - 10);
    if (fileSel >= 0) { x.fillStyle = '#fff'; x.fillText(`▶ ${cur.files[fileSel][0]}  — ⏎ open`, W / 2, H - 10); }
  }
  function shade(hex, k) { const n = parseInt(hex.slice(1), 16); const r = (n >> 16) * k, g = ((n >> 8) & 255) * k, b = (n & 255) * k; return `rgb(${r | 0},${g | 0},${b | 0})`; }
  function loop() { if (raf) return; const step = () => { raf = null; if (!visible) return; draw(); raf = requestAnimationFrame(step); }; raf = requestAnimationFrame(step); }

  /* Ouverture d'un fichier : visionneuse, ou contrôle des verrous */
  function openFile([name, node]) {
    closeView();
    view = JP.el('div', { class: 'fsn-view' });
    if (node.special === 'door_locks') {
      const render = () => {
        view.innerHTML = `<h3>${cur.path}/${name}</h3><div>VISITOR CENTER — DOOR LOCK CONTROL</div><div style="margin:10px 0;font-size:18px">state = <b style="color:${JP.sys.locks.visitorCenter ? '#3cff70' : '#ff3b3b'}">${JP.sys.locks.visitorCenter ? 'ENGAGED' : 'RELEASED'}</b></div>`;
        const eng = JP.el('span', { class: 'mx-btn', text: 'ENGAGE LOCKS', onclick: () => { JP.audio.clunk(); JP.scenario.locksEngage('fsn'); render(); } });
        const rel = JP.el('span', { class: 'mx-btn', text: 'RELEASE', onclick: () => { JP.sys.locks.visitorCenter = false; JP.log('DOOR LOCKS: visitor center — RELEASED (fsn)', 'warn'); render(); } });
        const cls = JP.el('span', { class: 'mx-btn', text: 'CLOSE (Esc)', onclick: closeView });
        view.append(eng, rel, cls);
      };
      render();
    } else {
      const txt = node.special === 'whte_rbt' ? JP.fs.content(node).slice(0, 1200) + '\n\n[binary — 1,842,176 bytes — owner: nedry]' : node.bin ? `${name}: MIPS ELF executable, ${JP.num(node.size)} bytes` : JP.fs.content(node);
      view.append(JP.el('h3', { text: `${cur.path === '/' ? '' : cur.path}/${name}` }), JP.el('div', { text: txt }), JP.el('div', { style: 'margin-top:8px' }, JP.el('span', { class: 'mx-btn', text: 'CLOSE (Esc)', onclick: closeView })));
      if (node.special === 'whte_rbt') JP.audio.error();
    }
    host.append(view);
  }
  function closeView() { if (view) { view.remove(); view = null; } cv?.focus(); }
  function goTo(path) { const n = byPath[path]; if (n) select(n); }

  return { mount, goTo, get current() { return cur; } };
})();
