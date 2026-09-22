/* Scénario : la chronologie du film, pilotée par l'horloge du parc et par les actions de l'opérateur. */
JP.scenario = (() => {
  const st = JP.state, sys = JP.sys;
  const queue = [];                          // { at: simSeconds, fn }
  const schedule = (delay, fn) => queue.push({ at: st.sim + delay, fn });
  const done = new Set();
  let reminderAt = 0, reminderIdx = 0, nextThump = 0, rexTimer = 0, lastRainLevel = -1, stormStrikeAcc = 0;

  /* ---- Événements datés (secondes parc depuis le boot) ---- */
  const EVENTS = [
    { at: 45, id: 'phones', label: 'Nedry: phones "debugged", compile running', run() {
      JP.log('MAIL from nedry: "I finished debugging the phones. The system\'s compiling for 18-20 minutes — some minor systems may go on and off for a while. Nothing to worry about."', 'nedry');
    } },
    { at: 100, id: 'away', label: 'Nedry leaves workstation 3', run() {
      const u = sys.users.find(x => x.user === 'nedry'); u.status = 'AWAY'; u.note = 'vending machine';
      JP.say('nedry', 'Anybody want a soda? I\'m going up to the machine.');
      JP.log('SESSION: nedry — idle (workstation 3, screen not locked)', 'warn');
      sys.procs = sys.procs.filter(p => !p.cmd.startsWith('cc ')); sys.procs.push({ pid: 2290, user: 'nedry', cpu: 0.1, cmd: 'sleep 1080' });
    } },
    { at: 140, id: 'recall', label: 'Hammond recalls the tour (storm)', run() {
      sys.tour.state = 'RETURNING'; sys.tour.next = 'Visitor center — 1.4 mi';
      JP.say('hammond', 'The storm is closing in. Bring the vehicles back. We\'ll pick up the tour tomorrow where we left off.');
      JP.log('TOUR: recall issued — EXP-04, EXP-05 returning to garage', 'warn');
    } },
    { at: 170, id: 'badge', label: '(cryo vault badge access — unlogged)', hidden: true, run() { /* Nedry est dans le labo. Personne ne regarde. */ } },
    { at: 200, id: 'sabotage', label: 'whte_rbt.obj executes', run: sabotage },
    { at: 262, id: 'jeep', label: 'JP-12 leaves by the east gate', run() {
      sys.jp12 = { state: 'EN ROUTE — East Dock road', signal: true, progress: 0, stopped: false };
      const u = sys.users.find(x => x.user === 'nedry'); u.status = 'OFF-LINE'; u.note = 'badge: EAST GATE 18:52';
      JP.log('EAST GATE: opened — badge NEDRY, D. — vehicle JP-12 outbound', 'alert');
      JP.say('muldoon', 'Where the hell is he going?');
      let t = 0; const iv = JP.clock.onFrame(dt => { const s = dt * st.timescale; t += s; sys.jp12.progress = Math.min(1, t / 62); if (sys.jp12.progress >= 1 || sys.jp12.offroad != null) iv(); });
    } },
    { at: 300, id: 'rex', label: 'Tyrannosaur breaches the paddock fence', run() {
      if (sys.fences.find(f => f.id === 'tyr').on) { JP.log('SENSORS: TYRANNOSAUR PADDOCK — fence contact — 10,000 V — animal backed off', 'warn'); JP.say('muldoon', 'She tested the fence. It held. Nice work.'); return; }
      st.rex.loose = true; st.rex.target = [...JP.island.REX_VIEW];
      JP.log('BACKUP SENSORS: TYRANNOSAUR PADDOCK — fence line crossed — sector 4', 'alert');
      JP.say('malcolm', 'Where\'s the goat?');
      sys.alarm = { active: true, text: 'TYRANNOSAUR — PADDOCK BREACH — SECTOR 4' }; JP.audio.alarm(true);
      nextThump = performance.now() + 1500; rexTimer = performance.now();
    } },
    { at: 312, id: 'roar', label: 'Roar', run() { if (!st.rex.loose) return; JP.audio.roar(); JP.log('ACOUSTIC: 118 dB event — sector 4', 'warn'); } },
    { at: 320, id: 'exp04', label: 'EXP-04 signal lost', run() { if (!st.rex.loose) { JP.log('TOUR: EXP-04, EXP-05 — occupants accounted for — awaiting rail power', 'ok'); return; } sys.tour.vehicles[0].signal = false; JP.log('TOUR: EXP-04 — TELEMETRY LOST — last position: rex viewpoint', 'alert'); JP.say('hammond', 'Where are the kids?!'); JP.audio.roar(); } },
    { at: 330, id: 'crash', label: 'JP-12 leaves the road', run() {
      sys.jp12.offroad = 0; sys.jp12.state = 'OFF ROAD — sector 7';
      let t = 0; const iv = JP.clock.onFrame(dt => { t += dt * st.timescale; sys.jp12.offroad = Math.min(1, t / 14); if (sys.jp12.offroad >= 1) { iv(); sys.jp12.stopped = true; sys.jp12.state = 'STOPPED — sector 7 — Dilophosaur enclosure boundary'; JP.log('JP-12: STOPPED off road — sector 7 — no movement — Dilophosaur enclosure (fence: OFF)', 'alert'); } });
      JP.log('JP-12: heading change — missed the East Dock turn (visibility: storm)', 'warn');
    } },
    { at: 342, id: 'exp05', label: 'EXP-05 no response', run() { if (!st.rex.loose) return; JP.log('TOUR: EXP-05 — occupants not responding — vehicle intact', 'warn'); } },
    { at: 384, id: 'jeeplost', label: 'JP-12 signal lost', run() { sys.jp12.signal = false; sys.jp12.state = 'SIGNAL LOST — sector 7'; JP.log('JP-12: SIGNAL LOST — sector 7', 'alert'); JP.say('muldoon', 'That\'s the Dilophosaur enclosure. If he\'s on foot in there...'); } },
    { at: 420, id: 'cryo', label: 'Cryo vault: 15 vials missing', run() {
      sys.cryo.vials = 0; sys.cryo.door = 'OPEN'; sys.cryo.lastBadge = 'NEDRY, D. — 18:50:52 (delayed log)';
      sys.locks.lab = false; sys.locks.cryo = false;
      JP.log('CRYO VAULT 1: badge NEDRY, D. 18:50:52 — door OPEN — inventory: 0 of 15 vials', 'alert');
      JP.say('wu', 'The embryos. All fifteen species. They\'re gone.');
      JP.say('hammond', 'Nedry...');
      JP.wm.alertIcon('cryo', true);
    } },
    { at: 720, id: 'ship', label: 'ANNE B departs (19:00)', run() {
      if (sys.dock.departed) return;
      sys.dock.departed = true; sys.dock.status = 'DEPARTED 19:00 — cargo: none'; sys.dock.cargo = 'none (no delivery received)';
      JP.log('EAST DOCK: ANNE B — DEPARTED 19:00 — passengers 0 — cargo NONE — "I said seven."', 'warn');
      JP.say('muldoon', 'Whatever he was carrying, it never made it to the boat.');
    } },
  ];

  /* ---- Le sabotage ---- */
  function sabotage() {
    st.phase = 'sabotage'; st.stats.sabotageAt = JP.clock.simTime(); st.stats.path.push('sabotage');
    sys.procs.push({ pid: 4127, user: 'nedry', cpu: 97.4, cmd: 'whte_rbt.obj' });
    JP.log('SECURITY: keycheck OFF — workstation 3', 'warn');
    schedule(2, () => JP.log('SECURITY: safety interlocks OFF — workstation 3', 'warn'));
    schedule(4, () => { JP.log('EXEC: whte_rbt.obj — pid 4127 — uid nedry — priority: realtime', 'alert'); JP.audio.beep(330); });
    schedule(7, () => { sys.cameras.online = 0; JP.log('VIDEO: cameras 01-36 — SIGNAL LOST', 'alert'); JP.wm.alertIcon('cameras', true); });
    let d = 9;
    for (const f of sys.fences) {
      if (f.id === 'rap') continue;
      schedule(d, () => { f.on = false; JP.log(`FENCE CONTROL: ${f.name} — power OFF`, 'alert'); JP.audio.beep(JP.rand(200, 300)); });
      d += 0.8;
    }
    schedule(d + 0.5, () => { sys.alarm = { active: true, text: 'FENCE FAILURE — 11 CIRCUITS' }; JP.audio.alarm(true); JP.log('FENCE CONTROL: VELOCIRAPTOR PEN — power ON (unaffected)', 'ok'); JP.say('arnold', 'The fences are failing all over the park!'); });
    schedule(d + 2, () => { sys.locks.visitorCenter = false; sys.locks.lab = false; sys.locks.cryo = false; JP.log('DOOR LOCKS: visitor center, genetics lab, cryo vault — RELEASED', 'alert'); });
    schedule(d + 3.5, () => { sys.phones.lines.forEach(l => l.on = false); JP.log('PBX: all 6 lines — NO CARRIER', 'alert'); JP.say('hammond', 'The phones are out too?'); JP.wm.alertIcon('comms', true); });
    schedule(d + 5, () => { JP.island.stopTourAtRexView(); sys.tour.next = '—'; JP.log('TOUR: induction rail power OFF — EXP-04, EXP-05 STOPPED — Tyrannosaur paddock, sector 4', 'alert'); JP.say('hammond', 'Why did the vehicles stop?'); });
    schedule(d + 7, () => { sys.sensors.online = 0; JP.log('SENSORS: motion sensor network — OFFLINE', 'alert'); });
    schedule(d + 9, () => {
      st.locked = true; JP.state.stats.path.push('grid locked');
      JP.log('CONTROL: main program grid — access restricted — owner: nedry', 'alert');
      JP.say('arnold', 'Nedry\'s workstation... What did he do? He turned the safety systems off. He doesn\'t want anyone to see what he\'s about to do.');
      JP.say('hammond', 'Look at this workstation. What a complete slob. Get it back online, Ray.');
      JP.audio.hum(true);
    });
    reminderAt = st.sim + 190;
  }

  /* ---- Actions opérateur ---- */
  function fenceReset() {
    if (st.phase === 'normal') { JP.shell.print('fences: all 12 circuits already energized.', 'ok'); return; }
    if (st.phase === 'shed' || st.phase === 'shutdown' || !sys.power.main) { JP.shell.print('fences: no main power.', 'err'); return; }
    if (st.phase === 'restored') { JP.shell.print('fences: nominal.', 'ok'); return; }
    JP.shell.print('fencectl: re-energizing all circuits (10,000 V)...', 'warn');
    st.stats.path.push('fences reset');
    let i = 0;
    const off = sys.fences.filter(f => !f.on);
    const iv = setInterval(() => {
      if (i >= off.length) { clearInterval(iv); afterFenceReset(); return; }
      off[i].on = true; JP.log(`FENCE CONTROL: ${off[i].name} — ENERGIZED — 10,000 V`, 'ok'); JP.audio.clunk(); i++;
    }, 420);
  }
  function afterFenceReset() {
    if (st.rex.loose && !st.rex.hidden) { st.rex.hidden = true; JP.log('TYRANNOSAUR: outside paddock — fences up — contact lost, sector 5', 'warn'); }
    if (st.raptors.loose && !st.raptors.contained) {
      JP.log('WARNING: VISITOR CENTER — door locks RELEASED — 3 raptors inside the building', 'alert');
      JP.say('sattler', 'The fences are up but they\'re already inside! Lex — the door locks!');
      return;
    }
    restored();
  }
  function locksEngage(source) {
    if (!sys.power.main) { JP.shell.print('door locks: no power.', 'err'); return; }
    if (sys.locks.visitorCenter) { JP.shell.print('door locks: visitor center — already engaged.', 'ok'); return; }
    sys.locks.visitorCenter = true; st.stats.path.push('door locks (' + source + ')');
    JP.log('DOOR LOCKS: visitor center — ENGAGED' + (source === 'fsn' ? ' (fsn)' : ''), 'ok');
    if (st.raptors.loose && !st.raptors.contained) {
      st.raptors.contained = true; sys.alarm.active = false; JP.audio.alarm(false); JP.audio.clunk();
      JP.say('lex', source === 'fsn' ? 'Yes! I did it! I know this — it\'s a UNIX system!' : 'The locks! They\'re engaged!');
      JP.say('grant', 'Lex, you did it! Doors are locked — they\'re shut out of the control room.');
      JP.log('VISITOR CENTER: raptors contained — east wing / kitchen — control room secure', 'ok');
      if (sys.fences.every(f => f.on)) restored();
      else { JP.say('sattler', 'Now the fences. From the console: fences reset'); JP.log('NEXT: re-energize perimeter fences — "fences reset"', 'warn'); }
    }
  }
  function onBackdoor() {
    st.phase = 'recovering'; st.stats.path.push('recovering (backdoor)');
    JP.log('CONTROL: grid released — fences remain OFF — use "fences reset"', 'warn');
    sys.procs = sys.procs.filter(p => p.pid !== 4127);
    sys.cameras.online = 36; sys.sensors.online = 1432; sys.phones.lines.forEach(l => l.on = true); sys.locks.visitorCenter = true;
    JP.log('VIDEO: cameras restored · SENSORS: network online · PBX: lines up · DOOR LOCKS: engaged', 'ok');
    JP.say('hammond', 'Ray... you did it. Now the fences!');
  }

  /* ---- Arrêt total, cabane de maintenance, redémarrage ---- */
  async function shutdown() {
    st.phase = 'shutdown'; st.running = false; st.stats.path.push('shutdown');
    JP.nedry.release('system shutdown');
    JP.audio.alarm(false); sys.alarm.active = false;
    const p = JP.shell.print;
    p('Shutting down all park systems.', 'warn');
    await JP.sleep(500);
    for (const line of ['tourd ......... halted', 'camd .......... halted', 'sensord ....... halted', 'phoned ........ halted', 'cryod ......... halted', 'fencectl ...... halted  (ALL FENCES DE-ENERGIZED — including VELOCIRAPTOR PEN)', 'jpctl ......... halted', 'syslogd ....... halted']) {
      await JP.shell.typeOut(line, line.includes('VELOCIRAPTOR') ? 'err' : 'dim', 6); JP.audio.blip(); await JP.sleep(180);
    }
    sys.fences.forEach(f => f.on = false); sys.cameras.online = 0; sys.sensors.online = 0; sys.phones.lines.forEach(l => l.on = false);
    sys.locks.visitorCenter = false; sys.power.main = false; Object.keys(sys.power.breakers).forEach(k => sys.power.breakers[k] = false);
    sys.tour.state = 'STOPPED'; st.locked = false; st.raptors.loose = true;
    sys.procs = sys.procs.filter(p => p.pid !== 4127);
    JP.syslog.push(`${JP.clock.clockStr()} jpsys alert: VELOCIRAPTOR PEN — fence power OFF (system shutdown)`);
    await JP.shell.typeOut('The system is down.', 'err', 30);
    JP.audio.hum(false);
    await JP.sleep(1200);
    const halt = document.getElementById('halt'), ht = document.getElementById('halt-text');
    halt.hidden = false; ht.textContent = '';
    for (const line of ['SYSTEM HALTED', '', 'Main power: OFF', 'Backup bus: control room lighting only (40 min)', '', 'To restart: maintenance shed — circuit breaker panel — east of the visitor center.', '', 'muldoon: "The raptor fences... they\'re not out, are they?"', 'arnold: "No no, the fences are all fine. ...oh no. Jesus. The shutdown must have turned off all the fences."', 'sattler: "I\'m going with you. Someone has to throw the breakers."', '', 'It\'s a 300 yard walk in the storm. Through raptor territory.', '', '[ press any key to reach the shed ]']) {
      ht.textContent += line + '\n'; await JP.sleep(line ? 420 : 200); if (line) JP.audio.blip();
    }
    st.phase = 'shed';
    await new Promise(res => { const h = () => { document.removeEventListener('keydown', h); document.removeEventListener('click', h); res(); }; document.addEventListener('keydown', h); document.addEventListener('click', h); });
    JP.audio.thunder(1);
    halt.hidden = true;
    openShed();
  }

  function openShed() {
    const shed = document.getElementById('shed');
    shed.hidden = false; shed.innerHTML = '';
    const names = { main: 'MAIN', control: 'VISITOR CTR', tour: 'TOUR RAIL', fences: 'FENCES', labs: 'LABS / CRYO', dock: 'EAST DOCK' };
    const log = JP.el('div', { class: 'shed-log' });
    const slog = t => { log.append(JP.el('div', { text: JP.clock.clockStr() + '  ' + t })); while (log.childNodes.length > 5) log.removeChild(log.firstChild); };
    let primer = 0, mainOn = false;
    const primerBar = JP.el('i');
    const stepPrimer = JP.el('div', { class: 'step' }, JP.el('h4', { text: '1 · CHARGE THE PRIMER' }), JP.el('div', { text: 'Pump the handle until pressure builds. (4 strokes)' }),
      JP.el('span', { class: 'mx-btn', text: 'PUMP', onclick() { if (primer >= 4) return; primer++; JP.audio.clunk(); primerBar.style.width = primer * 25 + '%'; slog(`primer: stroke ${primer}/4`); if (primer >= 4) { stepPrimer.classList.add('done'); slog('primer: CHARGED'); stepMain.classList.remove('dis'); } } }),
      JP.el('div', { class: 'primer' }, primerBar));
    const stepMain = JP.el('div', { class: 'step dis' }, JP.el('h4', { text: '2 · THROW THE MAIN' }), JP.el('div', { text: 'Push the main lever all the way up. It\'s heavy.' }),
      JP.el('span', { class: 'mx-btn', text: 'THROW MAIN LEVER', onclick() { if (primer < 4 || mainOn) return; mainOn = true; JP.audio.clunk(); setTimeout(JP.audio.clunk, 120); brk.main.classList.add('on'); brk.main.querySelector('.lamp').className = 'lamp on'; sys.power.breakers.main = true; stepMain.classList.add('done'); stepBrk.classList.remove('dis'); slog('MAIN BREAKER: CLOSED — bus energized'); Object.keys(brk).filter(k => k !== 'main').forEach(k => brk[k].classList.remove('dis')); } }));
    const stepBrk = JP.el('div', { class: 'step dis' }, JP.el('h4', { text: '3 · BREAKERS, ONE AT A TIME' }), JP.el('div', { text: 'Flip each circuit on the panel. Visitor center last if you want lights in the control room first — your call.' }));
    const brk = {};
    const grid = JP.el('div', { class: 'shed-grid' });
    for (const k of Object.keys(names)) {
      const b = JP.el('div', { class: 'brk dis' }, JP.el('div', { text: names[k] }), JP.el('div', { class: 'sw' }), JP.el('i', { class: 'lamp dim' }));
      b.querySelector('.sw').addEventListener('click', () => {
        if (k === 'main') { stepMain.querySelector('.mx-btn').click(); return; }
        if (!mainOn || sys.power.breakers[k]) return;
        sys.power.breakers[k] = true; b.classList.add('on'); b.querySelector('.lamp').className = 'lamp on'; JP.audio.clunk(); slog(`${names[k]}: CLOSED`);
        if (Object.values(sys.power.breakers).every(Boolean)) { stepBrk.classList.add('done'); slog('POWER RESTORED — all circuits closed'); setTimeout(powerRestored, 1400); }
      });
      brk[k] = b; grid.append(b);
    }
    const panel = JP.el('div', { class: 'shed-panel' }, JP.el('div', { class: 'warn-strip' }),
      JP.el('h2', { text: 'MAINTENANCE SHED — CIRCUIT BREAKER PANEL' }), JP.el('div', { class: 'sub', text: 'InGen · Isla Nublar · 2 × 1.5 MW · Danger: high voltage · Ellie Sattler is here. Something else is too.' }),
      grid, JP.el('div', { class: 'shed-steps' }, stepPrimer, stepMain, stepBrk), log);
    shed.append(panel);
    slog('shed: door open — panel dark — primer not charged');
    JP.say('sattler', 'Okay. I\'m in. Mr. Hammond — what do I do?');
    JP.say('hammond', 'Charge the primer, throw the main, then the breakers one at a time. Just like the manual.');
    setTimeout(() => { if (st.phase === 'shed') slog('...something is in here with you. Move.'); }, 15000);
  }

  async function powerRestored() {
    st.stats.path.push('breakers');
    sys.power.main = true; sys.power.load = 48;
    JP.audio.chime();
    JP.say('sattler', 'Mr. Hammond, I think we\'re back in business!');
    const shed = document.getElementById('shed');
    await JP.sleep(600);
    shed.hidden = true;
    await JP.boot.run({ reboot: true });
    rebooted();
  }
  function rebooted() {
    st.phase = 'rebooted'; st.running = true; st.stats.path.push('rebooted');
    sys.cameras.online = 36; sys.sensors.online = 1432; sys.phones.lines.forEach(l => l.on = true); sys.tour.state = 'STOPPED';
    JP.audio.hum(true);
    JP.log('SYSTEM: reboot complete — main program grid ONLINE — owner: jpsys', 'ok');
    JP.log('FENCE CONTROL: all 12 circuits DE-ENERGIZED — manual reset required ("fences reset")', 'warn');
    JP.log('DOOR LOCKS: visitor center — RELEASED (default after power loss)', 'warn');
    schedule(6, () => { JP.log('SENSORS: VELOCIRAPTOR PEN — 0 animals detected — fence line crossed during shutdown', 'alert'); sys.alarm = { active: true, text: 'VELOCIRAPTOR PEN — BREACH' }; JP.audio.alarm(true); JP.say('muldoon', 'The raptor fences were down. They\'re out. Clever girl.'); });
    schedule(16, () => { JP.log('MOTION: VISITOR CENTER — east wing / kitchen — 3 contacts — moving toward control room', 'alert'); JP.say('grant', 'Lex! The door locks — can you get them from the computer?'); });
    schedule(24, () => { JP.say('lex', 'It\'s a UNIX system! I know this!'); JP.log('HINT: fsn → /usr/jpsys/security/visitor_center/door_locks → ENGAGE   (or: locks engage)', 'warn'); JP.panels.open('fsn'); JP.fsn.goTo('/usr/jpsys/security'); });
    reminderAt = st.sim + 80; reminderIdx = 0;
  }

  function restored() {
    if (st.phase === 'restored') return;
    st.phase = 'restored'; st.stats.restoredAt = JP.clock.simTime(); st.stats.path.push('restored');
    st.locked = false; sys.alarm.active = false; JP.audio.alarm(false);
    if (st.rex.loose) st.rex.hidden = true;
    JP.audio.chime();
    JP.log('JURASSIC PARK — ALL SYSTEMS NOMINAL — fences 12/12 · locks engaged · grid online', 'ok');
    JP.say('hammond', 'We\'re back. We\'re back!');
    JP.say('malcolm', 'You never had control. That\'s the illusion.');
    setTimeout(endCard, 1800);
  }
  function endCard() {
    const t = st.stats, mins = t.sabotageAt ? JP.fmtMMSS(t.restoredAt - t.sabotageAt) : '—';
    const body = JP.el('div', { class: 'endcard' });
    body.innerHTML = `<h2>JURASSIC PARK — SYSTEMS RESTORED</h2>
      <div class="kv">
        <b>Time to recovery</b><span class="v">${mins} (park time) — sabotage ${t.sabotageAt ? JP.fmtClock(t.sabotageAt) : '—'} → restored ${JP.fmtClock(t.restoredAt)}</span>
        <b>Access denials</b><span class="v">${st.denials}</span>
        <b>Nedry windows</b><span class="v">${JP.nedry.count || 'closed'}</span>
        <b>Recovery path</b><span class="v">${t.path.filter(p => !p.startsWith('denied')).join(' → ')}</span>
        <b>Losses</b><span class="v">${[sys.tour.vehicles[0].signal ? null : 'EXP-04 (destroyed at rex viewpoint)', sys.jp12.signal === false ? 'JP-12 — D. Nedry, missing, sector 7' : null, sys.cryo.vials < 15 ? '15 embryos (missing, Barbasol can)' : null, sys.dock.departed ? 'ANNE B departed, cargo none' : null, 'D. Gennaro (restroom)', st.raptors.loose ? 'R. Arnold (maintenance shed)' : null].filter(Boolean).join(' · ') || 'none'}</span>
        <b>Tyrannosaur</b><span class="v">${st.rex.loose ? 'at large — sector 5 — "we\'ll deal with it in the morning"' : 'in paddock'}</span>
        <b>Velociraptors</b><span class="v">${st.raptors.loose ? 'contained — visitor center east wing (3)' : 'in pen'}</span>
      </div>
      <div class="q">"Life, uh... finds a way."<small>— Dr. Ian Malcolm</small></div>
      <div class="q">"After careful consideration, I've decided not to endorse your park."<small>— Dr. Alan Grant</small></div>
      <div class="note" style="color:#567;margin-top:14px">Report filed by 1j6c. Type "verify" in the console.</div>`;
    body.append(JP.el('span', { class: 'mx-btn', text: 'RUN AGAIN', onclick: () => location.reload() }), JP.el('span', { class: 'mx-btn', text: 'KEEP EXPLORING', onclick: () => JP.wm.close(JP.wm.get('end')) }));
    const r = JP.panels.rect('end');
    JP.wm.open({ id: 'end', title: 'InGen — Incident Report', glyph: 'END', x: r.x, y: r.y, w: r.w, h: r.h, body });
  }

  /* ---- Rappels ---- */
  const REM_SABOTAGE = [
    ['arnold', 'I can\'t get Jurassic Park back online without Dennis Nedry.'],
    ['hammond', 'Where is Nedry?! Find Nedry! Check the vending machines!'],
    ['muldoon', 'Even Nedry knew better than to mess with the raptor fences.'],
    ['arnold', 'There\'s one thing we haven\'t tried. Shut down the whole system. Every system. And reboot.   (type: shutdown)'],
    ['muldoon', 'He typed it all right in front of us. Check the keychecks.'],
    ['malcolm', 'Boy, do I hate being right all the time.'],
  ];
  const REM_RAPTORS = [
    ['grant', 'Lex! The door locks! Can you do it?'],
    ['sattler', 'Visitor center — security — door locks. In the file system. Go, Lex!   (type: fsn)'],
    ['lex', 'It\'s a UNIX system... I know this!'],
  ];
  const REM_FENCES = [['sattler', 'The fences are still down. From the console: fences reset'], ['hammond', 'Get those fences up, Ray. ...Ray?']];

  /* ---- Boucle ---- */
  function tick(dt) {
    if (!st.running) return;
    const sim = dt * st.timescale;
    /* événements datés */
    for (const e of EVENTS) if (!done.has(e.id) && st.sim >= e.at) { done.add(e.id); e.run(); }
    for (let i = queue.length - 1; i >= 0; i--) if (st.sim >= queue[i].at) { const q = queue.splice(i, 1)[0]; q.fn(); }
    /* rappels */
    if (reminderAt && st.sim >= reminderAt) {
      let list = null;
      if (st.phase === 'sabotage') list = REM_SABOTAGE;
      else if (st.phase === 'rebooted' && st.raptors.loose && !st.raptors.contained) list = REM_RAPTORS;
      else if ((st.phase === 'rebooted' || st.phase === 'recovering') && !sys.fences.every(f => f.on)) list = REM_FENCES;
      if (list) { const [who, text] = list[reminderIdx % list.length]; JP.say(who, text); reminderIdx++; }
      reminderAt = st.sim + 75;
    }
    environment(sim);
    /* T-Rex : pas lourds */
    if (st.rex.loose && !st.rex.hidden && performance.now() > nextThump) {
      JP.audio.thump(); nextThump = performance.now() + JP.rand(3200, 6500);
      if (performance.now() - rexTimer > 170000) { st.rex.hidden = true; JP.log('TYRANNOSAUR: sensor contact lost — sector 5 — moving north', 'warn'); }
    }
  }
  /* Tempête : distance, vent, pression, pluie, éclairs */
  function environment(sim) {
    const w = sys.storm;
    w.distance = Math.max(0.2, w.distance - sim * (14 / 1500));
    const k = 14 - w.distance;
    w.wind = 24 + k * 3.2 + Math.sin(st.sim / 7) * 2; w.gust = w.wind * 1.3 + Math.sin(st.sim / 3) * 3;
    w.pressure = 1003.8 - k * 1.6; w.rain = JP.clamp((6.5 - w.distance) / 5, 0, 1);
    w.etaMin = w.distance / 14 * 25;
    w.phase = w.distance <= 0.3 ? 'OVERHEAD' : w.distance < 3 ? 'SEVERE' : w.distance < 8 ? 'WARNING' : 'APPROACHING';
    if (JP.audio.ready() && Math.abs(w.rain - lastRainLevel) > 0.05) { lastRainLevel = w.rain; JP.audio.rain(w.rain); }
    if (w.distance < 9) {
      stormStrikeAcc += sim;
      if (stormStrikeAcc > 1) { stormStrikeAcc = 0; if (Math.random() < 0.02 + (9 - w.distance) * 0.006) { w.strikes++; JP.audio.thunder(w.distance); if (Math.random() < 0.12) JP.log(`LIGHTNING: strike — sector ${JP.pick(['3C', '5B', '6D', '2E', '7C'])} — ${w.distance.toFixed(1)} mi`, 'warn'); } }
    }
  }

  function timeline() {
    return EVENTS.filter(e => !e.hidden).map(e => ({ text: `${done.has(e.id) ? '✓' : ' '} ${JP.fmtClock(st.simStart + e.at)}  ${e.label}${!done.has(e.id) && st.sim < e.at ? '   (T-' + JP.fmtMMSS((e.at - st.sim) / st.timescale) + ' real)' : ''}`, cls: done.has(e.id) ? 'dim' : 'warn' }));
  }
  function cmd(a) {
    const s = (a[0] || 'status').toLowerCase();
    if (s === 'status') { JP.shell.print(`phase: ${st.phase} · locked: ${st.locked} · park time ${JP.clock.clockStr()} · ${st.running ? 'running' : 'paused'} · ${st.timescale}×`, 'cyan'); return; }
    if (s === 'pause') { st.running = false; JP.shell.print('scenario paused', 'dim'); return; }
    if (s === 'resume') { st.running = true; JP.shell.print('scenario running', 'dim'); return; }
    if (s === 'skip') { const next = EVENTS.find(e => !done.has(e.id) && st.sim < e.at); if (next) { st.sim = next.at; JP.shell.print(`jumped to ${next.label}`, 'warn'); } else JP.shell.print('no pending event', 'dim'); return; }
    if (s === 'restart') { location.reload(); return; }
    JP.shell.print('scenario [status|pause|resume|skip|restart]', 'dim');
  }
  function start() { st.phase = 'normal'; st.running = true; JP.clock.onFrame(tick); }

  return { start, shutdown, fenceReset, locksEngage, onBackdoor, timeline, cmd, restored, events: EVENTS };
})();
