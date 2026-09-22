/* Noyau : bus d'événements, état partagé, horloge du parc, utilitaires. */
window.JP = {};

/* provenance: type "verify" */
JP.AUTHOR = {
  statement: 'Jurassic Park: System Control was created by 1j6c (github.com/1j6c), September 22, 2026.',
  pubkey: 'MCowBQYDK2VwAyEA2wvQnmJewplacogglZ9PLTPHK3Yaoz9RfdM9t7XCUSQ=',
  signature: '29VSCxGLRdyD87HNWwdPsWQQKR9W+jJEmebFg/qHPVpL4dbWnOuV1oMFX7f4DmsjlaosKjviikY4vJ1BSInEAA==',
  ssh: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILUMMAT7m8m9PgZJc3ngRMpBEWvnFaZnzhtcTSCi6M0v',
};

JP.bus = (() => {
  const L = {};
  return {
    on(ev, fn) { (L[ev] ||= []).push(fn); return () => JP.bus.off(ev, fn); },
    off(ev, fn) { L[ev] = (L[ev] || []).filter(f => f !== fn); },
    emit(ev, data) { (L[ev] || []).slice().forEach(fn => { try { fn(data); } catch (e) { console.error('[bus]', ev, e); } }); },
  };
})();

JP.el = (tag, attrs = {}, ...children) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
};
JP.pad = (n, w = 2) => String(n).padStart(w, '0');
JP.fmtClock = sec => {
  sec = ((sec % 86400) + 86400) % 86400;
  return `${JP.pad(Math.floor(sec / 3600))}:${JP.pad(Math.floor(sec % 3600 / 60))}:${JP.pad(Math.floor(sec % 60))}`;
};
JP.fmtMMSS = sec => { sec = Math.max(0, Math.round(sec)); return `${JP.pad(Math.floor(sec / 60))}:${JP.pad(sec % 60)}`; };
JP.rand = (a, b) => a + Math.random() * (b - a);
JP.pick = a => a[Math.floor(Math.random() * a.length)];
JP.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
JP.sleep = ms => new Promise(r => setTimeout(r, ms));
JP.num = (n, d = 0) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

/* État global du scénario (le reste vit dans JP.sys) */
JP.state = {
  phase: 'boot',          // boot | normal | sabotage | shutdown | shed | rebooted | restored
  locked: false,          // whte_rbt.obj tient la grille de contrôle
  muted: false,
  timescale: 3,           // 1 s réelle = N s parc
  simStart: 18 * 3600 + 48 * 60,
  sim: 0,                 // secondes parc écoulées depuis le boot
  running: false,
  lang: 'fr',
  denials: 0,
  rex: { loose: false },
  raptors: { loose: false },
  stats: { sabotageAt: null, restoredAt: null, path: [] },
};

/* Modèle des systèmes du parc */
JP.sys = {
  fences: [
    { id: 'per', name: 'PERIMETER FENCE',        kv: 10.0, on: true },
    { id: 'tyr', name: 'TYRANNOSAUR PADDOCK',    kv: 10.0, on: true },
    { id: 'rap', name: 'VELOCIRAPTOR PEN',       kv: 10.0, on: true },
    { id: 'dil', name: 'DILOPHOSAUR ENCLOSURE',  kv: 10.0, on: true },
    { id: 'tri', name: 'TRICERATOPS ENCLOSURE',  kv: 10.0, on: true },
    { id: 'bra', name: 'BRACHIOSAUR / PARASAUR', kv: 10.0, on: true },
    { id: 'gal', name: 'GALLIMIMUS PLAINS',      kv: 10.0, on: true },
    { id: 'her', name: 'HERRERASAUR ENCLOSURE',  kv: 10.0, on: true },
    { id: 'met', name: 'METRIACANTHOSAUR',       kv: 10.0, on: true },
    { id: 'bar', name: 'BARYONYX ENCLOSURE',     kv: 10.0, on: true },
    { id: 'seg', name: 'SEGISAUR ENCLOSURE',     kv: 10.0, on: true },
    { id: 'pro', name: 'PROCERATOSAUR ENCLOSURE',kv: 10.0, on: true },
  ],
  alarm: { active: false, text: '' },
  cameras: { total: 36, online: 36 },
  sensors: { total: 1432, online: 1432, hits: 0, byPaddock: {} },
  phones: {
    lines: [
      { name: 'MAINLAND (San José, CR)', on: true }, { name: 'EAST DOCK', on: true },
      { name: 'VISITOR CENTER', on: true }, { name: 'MAINTENANCE SHED', on: true },
      { name: 'GENETICS LAB', on: true }, { name: 'BUNGALOW (Hammond)', on: true },
    ],
  },
  locks: { visitorCenter: true, lab: true, cryo: true },
  tour: {
    state: 'EN ROUTE', speed: 15, progress: 0.16, next: 'Tyrannosaur paddock — 0.9 mi',
    vehicles: [
      { id: 'EXP-04', occ: 'Grant, Malcolm, Gennaro', signal: true },
      { id: 'EXP-05', occ: 'Lex, Tim, Sattler', signal: true },
    ],
  },
  power: { main: true, load: 62, breakers: { main: true, control: true, tour: true, fences: true, labs: true, dock: true } },
  cryo: { vials: 15, temp: -196.0, door: 'SEALED', lastBadge: 'WU, H. — 14:22:07' },
  dock: { ship: 'ANNE B', departs: 19 * 3600, status: 'LOADING — hold 3', cargo: 'return leg: supplies, mail', departed: false },
  jp12: { state: 'PARKED — Visitor Center garage', signal: true },
  users: [
    { user: 'arnold',  name: 'ARNOLD, R.',  role: 'Chief Engineer',      tty: 'ttyq1', from: 'workstation 1',  status: 'ACTIVE' },
    { user: 'nedry',   name: 'NEDRY, D.',   role: 'Systems programmer',  tty: 'ttyq3', from: 'workstation 3',  status: 'ACTIVE' },
    { user: 'hammond', name: 'HAMMOND, J.', role: 'CEO — InGen',         tty: 'ttyq5', from: 'control room',   status: 'ACTIVE' },
    { user: 'muldoon', name: 'MULDOON, R.', role: 'Game warden',         tty: 'ttyq6', from: 'control room',   status: 'ACTIVE' },
    { user: 'wu',      name: 'WU, H.',      role: 'Chief geneticist',    tty: 'ttyq8', from: 'genetics lab',   status: 'IDLE' },
    { user: 'harding', name: 'HARDING, G.', role: 'Veterinarian',        tty: '-',     from: 'field (tri-3)',  status: 'OFF-LINE' },
  ],
  storm: { distance: 14.0, wind: 24, gust: 31, pressure: 1003.8, rain: 0, strikes: 0, etaMin: 25, phase: 'APPROACHING' },
  procs: [
    { pid: 1,    user: 'root',   cpu: 0.0,  cmd: 'init' },
    { pid: 88,   user: 'root',   cpu: 0.1,  cmd: 'syslogd' },
    { pid: 112,  user: 'root',   cpu: 0.0,  cmd: 'inetd' },
    { pid: 140,  user: 'root',   cpu: 0.2,  cmd: 'jpctl (main program grid)' },
    { pid: 141,  user: 'jpsys',  cpu: 1.4,  cmd: 'fencectl' },
    { pid: 142,  user: 'jpsys',  cpu: 3.8,  cmd: 'sensord' },
    { pid: 143,  user: 'jpsys',  cpu: 0.6,  cmd: 'tourd' },
    { pid: 144,  user: 'jpsys',  cpu: 5.1,  cmd: 'camd' },
    { pid: 145,  user: 'jpsys',  cpu: 0.2,  cmd: 'phoned' },
    { pid: 146,  user: 'jpsys',  cpu: 0.3,  cmd: 'cryod' },
    { pid: 2201, user: 'arnold', cpu: 0.0,  cmd: '-csh' },
    { pid: 2288, user: 'nedry',  cpu: 0.0,  cmd: '-csh' },
    { pid: 2290, user: 'nedry',  cpu: 12.6, cmd: 'cc -O2 phones.c (compiling)' },
  ],
};

/* Horloge : une boucle rAF, abonnés, temps parc */
JP.clock = (() => {
  let last = performance.now();
  const subs = [];
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (JP.state.running) JP.state.sim += dt * JP.state.timescale;
    for (const s of subs) { try { s(dt, now); } catch (e) { console.error('[frame]', e); } }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return {
    onFrame(fn) { subs.push(fn); return () => { const i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); }; },
    /* abonné à cadence réduite (hz) */
    every(hz, fn) { let acc = 0; return JP.clock.onFrame((dt, now) => { acc += dt; if (acc >= 1 / hz) { acc = 0; fn(dt, now); } }); },
    simTime() { return JP.state.simStart + JP.state.sim; },
    clockStr() { return JP.fmtClock(JP.state.simStart + JP.state.sim); },
  };
})();

/* Journal système : tout message passe ici (console + SYSLOG virtuel) */
JP.syslog = [];
JP.log = (msg, cls = 'sys') => {
  const t = JP.clock.clockStr();
  JP.syslog.push(`${t} jpsys ${cls}: ${msg}`);
  if (JP.syslog.length > 600) JP.syslog.shift();
  JP.bus.emit('log', { t, msg, cls });
};
JP.say = (who, text) => JP.log(`${who}: ${text}`, 'say');

JP.store = {
  get(k) { try { return localStorage.getItem('jp.' + k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('jp.' + k, v); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem('jp.' + k); } catch {} },
};
