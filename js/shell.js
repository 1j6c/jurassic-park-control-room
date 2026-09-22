/* Console IRIX (csh) : commandes du parc, système de fichiers, journal système, refus façon Nedry. */
JP.shell = (() => {
  const out = JP.el('div', { class: 'term-out' });
  const input = JP.el('input', { class: 'term-in', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'off' });
  const promptEl = JP.el('span', { class: 'term-prompt' });
  const root = JP.el('div', { class: 'term' }, out, JP.el('div', { class: 'term-line' }, promptEl, input));
  let n = 1, cwd = '/usr/jpsys', history = [], hIdx = -1, busy = false, pending = null;
  const HOST = 'jpsys', USER = 'arnold';
  const prompt = () => `${HOST} ${n}% `;
  promptEl.textContent = prompt();

  const MAX = 700;
  function print(text = '', cls = '') {
    for (const line of String(text).split('\n')) {
      const d = JP.el('div', { class: cls, text: line });
      out.append(d);
    }
    while (out.childNodes.length > MAX) out.removeChild(out.firstChild);
    out.scrollTop = out.scrollHeight;
  }
  function typeOut(text, cls = '', cps = 14) {
    return new Promise(res => {
      const d = JP.el('div', { class: cls }); out.append(d);
      let i = 0;
      const iv = setInterval(() => {
        d.textContent = text.slice(0, ++i); out.scrollTop = out.scrollHeight;
        if (i % 3 === 0) JP.audio.click();
        if (i >= text.length) { clearInterval(iv); res(); }
      }, cps);
    });
  }
  const focus = () => input.focus({ preventScroll: true });
  root.addEventListener('click', focus);

  /* Journal système → console */
  JP.bus.on('log', e => print(`*** ${e.t}  ${e.msg}`, 'log-' + e.cls));

  /* ---- Historique / complétion ---- */
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const v = input.value; input.value = ''; hIdx = -1; exec(v, true); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (history.length) { hIdx = Math.min(history.length - 1, hIdx + 1); input.value = history[history.length - 1 - hIdx]; } }
    else if (e.key === 'ArrowDown') { e.preventDefault(); hIdx = Math.max(-1, hIdx - 1); input.value = hIdx < 0 ? '' : history[history.length - 1 - hIdx]; }
    else if (e.key === 'Tab') { e.preventDefault(); complete(); }
    else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); out.innerHTML = ''; }
    else if (e.key === 'c' && e.ctrlKey) { e.preventDefault(); print(prompt() + input.value + '^C', 'echo'); input.value = ''; pending = null; }
    else JP.audio.click();
  });
  function complete() {
    const v = input.value, parts = v.split(' ');
    if (parts.length <= 1) { const m = Object.keys(cmds).filter(c => c.startsWith(v) && !hiddenCmds.has(c)); if (m.length === 1) input.value = m[0] + ' '; else if (m.length) print(m.join('  '), 'dim'); return; }
    const last = parts[parts.length - 1], dir = last.includes('/') ? last.slice(0, last.lastIndexOf('/') + 1) : '', base = last.slice(dir.length);
    const d = JP.fs.get(dir || '.', cwd); if (!d || d.node.type !== 'dir') return;
    const m = JP.fs.list(d.node, base.startsWith('.')).map(([name, node]) => name + (node.type === 'dir' ? '/' : '')).filter(x => x.startsWith(base));
    if (m.length === 1) { parts[parts.length - 1] = dir + m[0]; input.value = parts.join(' '); } else if (m.length) print(m.join('  '), 'dim');
  }

  /* ---- Exécution ---- */
  const SYSTEM_CMDS = new Set(['access', 'fences', 'tour', 'sensors', 'cameras', 'cams', 'power', 'locks', 'cryo', 'phones', 'kill', 'reset', 'restart', 'unlock']);
  const hiddenCmds = new Set(['please', 'mr', 'dodgson', 'hammond', 'malcolm', 'grant', 'lex', 'tim', 'muldoon', 'nedry', 'dna', 'butts', 'hold', 'spared', 'clever', 'goat', 'sudo', 'su', 'exit', 'logout', 'vi', 'emacs', 'rm', 'magic', 'nocrt', 'ellie', 'sattler', 'wu', 'verify', 'credits', 'author', '1j6c', 'gennaro', 'arnold', 'ray', 'ian', 'alan', 'john', 'dennis', 'lawyer', 'w', 'id', 'top', 'unix', 'more', 'less', 'head', 'cams', 'comms', 'syslog']);
  function echo(v) { print(prompt() + v, 'echo'); n++; promptEl.textContent = prompt(); }

  async function exec(v, fromUser = false) {
    v = String(v);
    const line = v.trim();
    echo(v);
    if (pending) { const p = pending; pending = null; p(line.toLowerCase()); return; }
    if (!line) return;
    if (fromUser && (!history.length || history[history.length - 1] !== line)) history.push(line);
    if (busy) { print('(busy — command queued)', 'dim'); await JP.sleep(400); }
    busy = true;
    try {
      const args = line.split(/\s+/), c = args[0].toLowerCase(), rest = args.slice(1), full = line.toLowerCase();
      if (JP.state.phase === 'shed' || JP.state.phase === 'shutdown') { print('system is down — restore power at the maintenance shed.', 'warn'); return; }
      if (JP.state.locked && (full === 'mr goodbytes' || full === 'mr. goodbytes')) { await backdoor(); return; }
      if (JP.state.locked && SYSTEM_CMDS.has(c)) { await deny(line); return; }
      const fn = cmds[c];
      if (!fn) { print(`${c}: Command not found.`, 'err'); JP.audio.beep(220); return; }
      await fn(rest, line);
    } finally { busy = false; }
  }

  /* Refus (cadence du film) */
  async function deny(line) {
    JP.state.denials++;
    JP.state.stats.path.push('denied: ' + line);
    const d = JP.state.denials;
    if (d === 1) { await typeOut('ACCESS: PERMISSION DENIED.', 'err'); JP.audio.error(); return; }
    if (d === 2) { await typeOut('ACCESS: PERMISSION DENIED.', 'err'); JP.audio.error(); JP.say('arnold', '...'); return; }
    if (d === 3) { await typeOut('ACCESS: PERMISSION DENIED....and....', 'err', 22); await JP.sleep(500); JP.nedry.lockout(); return; }
    JP.audio.error();
    JP.nedry.spawn();
  }
  async function backdoor() {
    JP.state.stats.path.push('backdoor: mr goodbytes');
    await typeOut('ACCESS: keycheck bypass — uid nedry — "mr goodbytes" accepted.', 'warn', 18);
    await JP.sleep(400);
    JP.nedry.release('backdoor');
    await typeOut('whte_rbt.obj: terminated (pid 4127).  main program grid: RELEASED.', 'ok', 14);
    JP.say('muldoon', 'How the hell did you know that?');
    JP.say('arnold', 'It was in his keychecks. He typed it right in front of us.');
    JP.scenario.onBackdoor();
  }

  function ask(question) { print(question, 'warn'); busy = false; return new Promise(res => { pending = res; }); }

  /* ---- Commandes ---- */
  const cmds = {
    help() {
      print(`JURASSIC PARK SYSTEM CONTROL — command summary
  access <system>     open a control panel (main program grid, security, fences, tour, ...)
  status              summary of all park systems
  fences [reset|test] perimeter fence control        sensors      motion sensor network
  tour [stop|resume]  tour program                   cameras      video surveillance
  power               power distribution             cryo         embryo cold storage
  phones [test]       PBX / communications           dock         east dock
  weather             storm watch                    map          island system map
  locks [engage|release] visitor center door locks   people       logged-in sessions
  who / ps / kill     users and processes            keychecks    keystroke audit log
  ls / cd / cat / find / pwd   file system            fsn          3D file system navigator
  ack                 acknowledge alarms             log          tail the system log
  shutdown / reboot   full system power cycle        timeline     scenario events
  mute / unmute       sound                          clear        clear screen
`, 'dim');
    },
    status() {
      const s = JP.sys, on = s.fences.filter(f => f.on).length;
      print(`PARK SYSTEMS STATUS — ${JP.clock.clockStr()}`, 'cyan');
      print(`  main program grid   ${JP.state.locked ? 'LOCKED (whte_rbt.obj, uid nedry)' : JP.state.phase === 'restored' ? 'ONLINE — restored' : 'ONLINE'}`, JP.state.locked ? 'err' : 'ok');
      print(`  fences              ${on}/${s.fences.length} energized${on < s.fences.length ? '  <<< ' + s.fences.filter(f => !f.on).map(f => f.id).join(',') + ' OFF' : ''}`, on === s.fences.length ? 'ok' : 'err');
      print(`  motion sensors      ${s.sensors.online ? s.sensors.online + ' online' : 'OFFLINE'}`, s.sensors.online ? 'ok' : 'err');
      print(`  cameras             ${s.cameras.online ? s.cameras.online + ' online' : 'NO SIGNAL'}`, s.cameras.online ? 'ok' : 'err');
      print(`  door locks          VC ${s.locks.visitorCenter ? 'ENGAGED' : 'RELEASED'} · lab ${s.locks.lab ? 'ENGAGED' : 'RELEASED'} · cryo ${s.locks.cryo ? 'ENGAGED' : 'RELEASED'}`, s.locks.visitorCenter ? 'ok' : 'err');
      print(`  phones              ${s.phones.lines.filter(l => l.on).length ? 'up' : 'ALL LINES DEAD'}`, s.phones.lines[0].on ? 'ok' : 'err');
      print(`  tour                ${s.tour.state} — ${s.tour.vehicles.map(v => v.id + (v.signal ? '' : ' LOST')).join(', ')}`, s.tour.state === 'STOPPED' ? 'err' : 'ok');
      print(`  power               ${s.power.main ? 'main generator online' : 'OFF'}`, s.power.main ? 'ok' : 'err');
      print(`  cryo vault          ${s.cryo.vials}/15 vials · door ${s.cryo.door}`, s.cryo.vials === 15 ? 'ok' : 'err');
      print(`  storm               ${s.storm.distance.toFixed(1)} mi · ${s.storm.wind.toFixed(0)} kn · ${s.storm.phase}`, s.storm.distance < 4 ? 'warn' : '');
      print(`  tyrannosaur         ${JP.state.rex.loose ? (JP.state.rex.hidden ? 'AT LARGE — contact lost' : 'AT LARGE — sector 4/5') : 'in paddock'}`, JP.state.rex.loose ? 'err' : 'ok');
      print(`  velociraptors       ${JP.state.raptors.loose ? (JP.state.raptors.contained ? 'contained — visitor center east wing' : 'LOOSE — visitor center') : 'in pen'}`, JP.state.raptors.loose && !JP.state.raptors.contained ? 'err' : 'ok');
    },
    async access(a) {
      const what = a.join(' ').toLowerCase();
      const map = [[/grid|program|control/, 'map', 'MAIN PROGRAM GRID'], [/security|fence/, 'fences', 'SECURITY — FENCES'], [/sensor/, 'sensors', 'MOTION SENSORS'], [/tour|vehicle/, 'tour', 'TOUR PROGRAM'],
        [/cam|video/, 'cameras', 'VIDEO'], [/power|breaker/, 'power', 'POWER'], [/cryo|embryo|lab/, 'cryo', 'CRYOGENICS'], [/phone|pbx|comm/, 'comms', 'PBX'], [/dock|ship|boat/, 'dock', 'EAST DOCK'], [/weather|storm|env/, 'weather', 'ENVIRONMENTAL'], [/map|island/, 'map', 'SYSTEM MAP'], [/people|user|session/, 'people', 'PERSONNEL']];
      if (!what) { print('usage: access <system>   (main program grid, security, fences, tour, cameras, power, cryo, phones, dock, weather, map)', 'dim'); return; }
      const hit = map.find(([re]) => re.test(what));
      if (!hit) { print(`access: unknown system "${what}"`, 'err'); return; }
      await typeOut(`ACCESS: ${hit[2]} — GRANTED.`, 'ok', 10);
      JP.panels.open(hit[1]);
    },
    fences(a) {
      const sub = (a[0] || 'list').toLowerCase();
      if (sub === 'list') { JP.panels.open('fences'); JP.sys.fences.forEach(f => print(`  ${f.id.padEnd(4)} ${f.name.padEnd(26)} ${f.on ? '10,000 V  ENERGIZED' : '      0 V  OFFLINE'}`, f.on ? 'ok' : 'err')); return; }
      if (sub === 'test') { print('fence test: pulsing all circuits...', 'dim'); JP.sys.fences.forEach(f => print(`  ${f.name.padEnd(26)} ${f.on ? 'OK' : 'NO CONTINUITY'}`, f.on ? 'ok' : 'err')); return; }
      if (sub === 'reset') return JP.scenario.fenceReset();
      print('usage: fences [list|test|reset]', 'dim');
    },
    sensors() { JP.panels.open('sensors'); const s = JP.sys.sensors; print(s.online ? `motion sensor network: ${s.online}/${s.total} online — ${s.hits} hits since boot` : 'motion sensor network: OFFLINE', s.online ? 'ok' : 'err'); },
    tour(a) {
      const sub = (a[0] || '').toLowerCase(), t = JP.sys.tour;
      JP.panels.open('tour');
      if (sub === 'stop') { if (t.state === 'STOPPED') print('tour: vehicles have no power.', 'err'); else { t.state = 'HOLDING'; JP.log('TOUR: vehicles holding (operator)', 'warn'); } }
      else if (sub === 'resume') { if (t.state === 'STOPPED') print('tour: no power on the induction rail.', 'err'); else { t.state = 'EN ROUTE'; JP.log('TOUR: resumed', 'ok'); } }
      else if (sub === 'return') { if (t.state === 'STOPPED') print('tour: no power on the induction rail.', 'err'); else { t.state = 'RETURNING'; JP.log('TOUR: vehicles returning to garage', 'warn'); } }
      else print(`tour: ${t.state} — progress ${(t.progress * 100).toFixed(0)}% — ${t.vehicles.map(v => v.id + ' ' + (v.signal ? 'OK' : 'LOST')).join(', ')}`, t.state === 'STOPPED' ? 'err' : 'ok');
    },
    cameras() { JP.panels.open('cameras'); print(JP.sys.cameras.online ? '36 cameras online' : 'video: NO SIGNAL on all 36 cameras', JP.sys.cameras.online ? 'ok' : 'err'); },
    cams(a) { return cmds.cameras(a); },
    power() { JP.panels.open('power'); },
    cryo() { JP.panels.open('cryo'); const c = JP.sys.cryo; print(`cryo vault: ${c.vials}/15 vials · ${c.temp} °C · door ${c.door} · last badge ${c.lastBadge}`, c.vials === 15 ? 'ok' : 'err'); },
    phones(a) {
      JP.panels.open('comms');
      const up = JP.sys.phones.lines.filter(l => l.on).length;
      if (a[0] === 'test') { JP.sys.phones.lines.forEach(l => print(`  ${l.name.padEnd(26)} ${l.on ? 'dial tone' : 'NO CARRIER'}`, l.on ? 'ok' : 'err')); return; }
      if (a[0] === 'call') { print(up ? 'dialing mainland... ring... ring... "InGen San José, please hold."' : 'no dial tone. the phones are dead.', up ? 'ok' : 'err'); return; }
      print(up ? `PBX: ${up}/6 lines up` : 'PBX: ALL LINES DEAD', up ? 'ok' : 'err');
    },
    comms(a) { return cmds.phones(a); },
    dock() { JP.panels.open('dock'); },
    weather() { JP.panels.open('weather'); const w = JP.sys.storm; print(`storm front ${w.distance.toFixed(1)} mi ENE · wind ${w.wind.toFixed(0)} kn · ${w.pressure.toFixed(1)} hPa · ${w.phase}`, w.distance < 4 ? 'warn' : ''); },
    map() { JP.panels.open('map'); },
    people() { JP.panels.open('people'); },
    open(a) { const id = (a[0] || '').toLowerCase(); if (JP.panels.reg[id]) JP.panels.open(id); else print('open: ' + Object.keys(JP.panels.reg).join(' '), 'dim'); },
    locks(a) {
      const sub = (a[0] || '').toLowerCase();
      if (sub === 'engage') return JP.scenario.locksEngage('console');
      if (sub === 'release') { JP.sys.locks.visitorCenter = false; JP.log('DOOR LOCKS: visitor center — RELEASED (operator)', 'warn'); return; }
      print(`door locks: visitor center ${JP.sys.locks.visitorCenter ? 'ENGAGED' : 'RELEASED'} · genetics lab ${JP.sys.locks.lab ? 'ENGAGED' : 'RELEASED'} · cryo vault ${JP.sys.locks.cryo ? 'ENGAGED' : 'RELEASED'}`, JP.sys.locks.visitorCenter ? 'ok' : 'err');
      print('control file: /usr/jpsys/security/visitor_center/door_locks  (fsn)', 'dim');
    },
    who() { print('USER      TTY     FROM             STATUS', 'dim'); JP.sys.users.forEach(u => print(`${u.user.padEnd(9)} ${u.tty.padEnd(7)} ${u.from.padEnd(16)} ${u.status}${u.note ? ' — ' + u.note : ''}`, u.status === 'AWAY' ? 'warn' : '')); },
    w(a) { return cmds.who(a); },
    ps() { print('  PID USER      %CPU COMMAND', 'dim'); JP.sys.procs.forEach(p => print(`${String(p.pid).padStart(5)} ${p.user.padEnd(9)} ${p.cpu.toFixed(1).padStart(4)} ${p.cmd}`, p.cmd.includes('whte_rbt') ? 'err' : '')); },
    top(a) { return cmds.ps(a); },
    kill(a) {
      const pid = parseInt(a[a.length - 1]); const p = JP.sys.procs.find(x => x.pid === pid);
      if (!p) { print(`kill: ${a.join(' ') || '?'}: No such process`, 'err'); return; }
      if (p.user === 'nedry' && p.cmd.includes('whte_rbt')) { print(`kill: (${pid}) — Operation not permitted. Process is protected by its owner.`, 'err'); JP.audio.error(); return; }
      if (p.user === 'root' || p.user === 'jpsys') { print(`kill: (${pid}) — Not owner.`, 'err'); return; }
      JP.sys.procs = JP.sys.procs.filter(x => x !== p); print(`[${pid}] terminated`, 'dim');
    },
    keychecks() {
      print('KEYCHECK LOG — workstation 3 — uid nedry — (audit trail, /usr/jpsys/security/keychecks.log)', 'cyan');
      JP.fs.KEYCHECKS.forEach(([t, c]) => print(`  ${t}  ${c}`, c === 'whte_rbt.obj' ? 'err' : c === 'mr goodbytes' ? 'warn' : ''));
      if (JP.state.phase !== 'normal') JP.say('muldoon', 'What did he do to the system?');
    },
    ack() { if (!JP.sys.alarm.active) { print('no active alarm.', 'dim'); return; } JP.sys.alarm.active = false; JP.audio.alarm(false); print('alarm acknowledged.', 'ok'); },
    log(a) { const k = parseInt(a[0]) || 20; JP.syslog.slice(-k).forEach(l => print(l, 'dim')); },
    syslog(a) { return cmds.log(a); },
    timeline() { JP.scenario.timeline().forEach(l => print(l.text, l.cls)); },
    scenario(a) { return JP.scenario.cmd(a); },
    timescale(a) { const v = parseFloat(a[0]); if (!v) { print(`timescale: ${JP.state.timescale}×`, 'dim'); return; } JP.state.timescale = JP.clamp(v, 0.5, 20); document.getElementById('cb-speed').textContent = JP.state.timescale + '×'; print(`timescale set to ${JP.state.timescale}×`, 'ok'); },
    mute() { JP.audio.setMuted(true); print('sound muted', 'dim'); },
    unmute() { JP.audio.setMuted(false); print('sound on', 'dim'); },
    nocrt() { document.body.classList.toggle('nocrt'); },
    clear() { out.innerHTML = ''; },
    fsn() { JP.panels.open('fsn'); print('fsn: File System Navigator — ← → siblings · ↑ enter · ↓ up · Tab files · ⏎ open', 'dim'); },
    unix(a) { return cmds.fsn(a); },
    async shutdown() {
      if (JP.state.phase === 'restored') { print('shutdown: park is nominal. not today.', 'dim'); return; }
      if (JP.state.phase === 'normal') { print('shutdown: all systems nominal.', 'dim'); JP.say('hammond', 'Absolutely not. We have guests on the tour.'); return; }
      print('shutdown: this will cut ALL park power — fences, locks, tour, labs. Every system.', 'warn');
      JP.say('hammond', 'Are you sure?');
      const v = await ask('Shut down the entire system? (y/n)');
      if (v !== 'y' && v !== 'yes') { print('shutdown aborted.', 'dim'); return; }
      JP.say('hammond', 'Do it.');
      JP.say('arnold', 'Hold onto your butts.');
      await JP.scenario.shutdown();
    },
    reboot() { print(JP.state.phase === 'restored' || JP.state.phase === 'normal' ? 'reboot: not now.' : 'reboot: system must be power-cycled from the maintenance shed. use: shutdown', 'warn'); },

    /* fichiers */
    pwd() { print(cwd); },
    cd(a) { const r = JP.fs.get(a[0] || '~', cwd); if (!r) { print(`${a[0]}: No such file or directory.`, 'err'); return; } if (r.node.type !== 'dir') { print(`${a[0]}: Not a directory.`, 'err'); return; } cwd = r.path; },
    ls(a) {
      const long = a.includes('-l') || a.includes('-la') || a.includes('-al'), all = a.includes('-a') || a.includes('-la') || a.includes('-al');
      const target = a.find(x => !x.startsWith('-')) || '.';
      const r = JP.fs.get(target, cwd); if (!r) { print(`${target}: No such file or directory.`, 'err'); return; }
      if (r.node.type === 'file') { print(target); return; }
      const items = JP.fs.list(r.node, all);
      if (long) { print(`total ${items.length}`, 'dim'); for (const [name, node] of items) { const owner = r.path.startsWith('/usr/nedry') ? 'nedry ' : r.path.startsWith('/usr/people/') ? r.path.split('/')[3].padEnd(6) : 'jpsys '; print(`${node.type === 'dir' ? 'drwxr-xr-x' : node.bin ? '-rwxr-x---' : '-rw-r--r--'}  1 ${owner} ${JP.fs.fmtSize(node.type === 'dir' ? 512 : node.size)} Jun 11 ${node.type === 'dir' ? '09:12' : '18:31'} ${name}${node.type === 'dir' ? '/' : ''}`, node.special === 'whte_rbt' ? 'err' : node.type === 'dir' ? 'cyan' : ''); } }
      else print(items.map(([name, node]) => name + (node.type === 'dir' ? '/' : node.bin ? '*' : '')).join('   '), 'cyan');
    },
    cat(a) {
      if (!a.length) { print('usage: cat <file>', 'dim'); return; }
      for (const f of a) {
        const r = JP.fs.get(f, cwd); if (!r) { print(`cat: cannot open ${f}`, 'err'); continue; }
        if (r.node.type === 'dir') { print(`cat: ${f}: Is a directory`, 'err'); continue; }
        if (r.node.special === 'whte_rbt') { JP.audio.error(); print(JP.fs.content(r.node), 'err'); print('\n[binary garbage — 1,842,176 bytes — compiled by nedry, workstation 3]', 'warn'); continue; }
        print(JP.fs.content(r.node), r.node.bin ? 'dim' : '');
      }
    },
    more(a) { return cmds.cat(a); }, less(a) { return cmds.cat(a); }, head(a) { return cmds.cat(a); },
    file(a) { for (const f of a) { const r = JP.fs.get(f, cwd); print(r ? `${f}: ${r.node.type === 'dir' ? 'directory' : r.node.bin ? 'MIPS ELF executable' : 'ASCII text'}` : `${f}: cannot open`, r ? '' : 'err'); } },
    find(a) { const needle = a.find(x => !x.startsWith('-') && x !== '/' && x !== '.') || a[0]; if (!needle) { print('usage: find <name>', 'dim'); return; } const r = JP.fs.find(JP.fs.root, needle); r.length ? r.forEach(p => print(p, p.includes('nedry') ? 'warn' : '')) : print('find: no match', 'dim'); },
    echo(a) { print(a.join(' ')); },
    date() { print(`Fri Jun 11 ${JP.clock.clockStr()} CST 1993`); },
    uname() { print('IRIX jpsys 4.0.5 06151813 IP12 mips'); },
    hostname() { print('jpsys'); },
    uptime() { print(`  ${JP.clock.clockStr()}  up ${JP.fmtMMSS(JP.state.sim)},  ${JP.sys.users.filter(u => u.status !== 'OFF-LINE').length} users,  load average: 0.62, 0.58, 0.41`); },
    whoami() { print(USER); }, id() { print('uid=1001(arnold) gid=20(staff) groups=20(staff),100(jpsys)'); },
    df() { print('Filesystem    Type  blocks     use   avail  %use  Mounted on\n/dev/root      efs  1966080  1420400  545680   72%  /\n/dev/dsk/dks0d1s6 efs 4096000 3710050 385950 91%  /usr\n/dev/dsk/dks0d2s7 efs 2048000  620110 1427890  30%  /var', 'dim'); },
    free() { print('total real memory = 64 Mb   available = 21 Mb   (nedry\'s compile is eating the rest)', 'dim'); },
    man(a) { const c = a[0]; print(c && cmds[c] ? `${c}(1) — Jurassic Park System Control. See "help".` : 'What manual page do you want?', 'dim'); },
    su() { print('Sorry.', 'err'); }, sudo() { print('sudo: command not found. This is 1993.', 'err'); },
    rm() { print('rm: Operation not permitted. (audit: arnold tried to delete something. noted.)', 'err'); },
    vi() { print('vi: terminal too small. and nobody has time for that right now.', 'dim'); }, emacs() { print('emacs: not installed. spared every expense on that one.', 'dim'); },
    exit() { print('You can\'t leave. Not until the park is back online.', 'warn'); }, logout(a) { return cmds.exit(a); },
    magic() { print('the magic word? ...he never said what it was.', 'dim'); },
    verify() {
      const a = JP.AUTHOR;
      print('AUTHORSHIP — signed statement', 'cyan');
      print(a.statement, 'ok');
      print('');
      print('Ed25519 public key (DER, base64): ' + a.pubkey, 'dim');
      print('Signature (base64):               ' + a.signature, 'dim');
      print('');
      print('Verify it yourself (openssl 3):', 'warn');
      print(`  printf '%s' "${a.statement}" > s.txt`, 'dim');
      print(`  { echo "-----BEGIN PUBLIC KEY-----"; echo "${a.pubkey}"; echo "-----END PUBLIC KEY-----"; } > pub.pem`, 'dim');
      print(`  echo "${a.signature}" | base64 -d > s.sig`, 'dim');
      print('  openssl pkeyutl -verify -pubin -inkey pub.pem -rawin -in s.txt -sigfile s.sig', 'dim');
      print('');
      print('Anyone can check it. Only the key holder can sign a new one. See also: /usr/people/1j6c', 'dim');
    },
    credits(a) { return cmds.verify(a); },
    author(a) { return cmds.verify(a); },
    '1j6c'() { print('1j6c. Built this in September 2026 without typing the code: directed it, checked it against the film, kept what was right.\ngithub.com/1j6c · cat /usr/people/1j6c/README · verify', 'log-say'); },

    /* le mot magique et autres répliques */
    please() { if (JP.state.locked) { JP.nedry.taunt(); JP.say('arnold', 'Please! God damn it! I hate this hacker crap!'); } else print('you\'re welcome.', 'dim'); },
    mr(a) { if (a.join(' ').toLowerCase() === 'goodbytes') print('(not locked — nothing to bypass)', 'dim'); else print('mr: Command not found.', 'err'); },
    dodgson() { print('"Dodgson! We\'ve got Dodgson here!" — "See? Nobody cares."', 'log-say'); },
    nedry() { const u = JP.sys.users.find(x => x.user === 'nedry'); print(`NEDRY, Dennis — systems programmer — workstation 3 — ${u.status}${u.note ? ' (' + u.note + ')' : ''}\n2,000,000 lines of code. "I am totally unappreciated in my time."`, 'warn'); },
    dennis(a) { return cmds.nedry(a); },
    hammond() { print('"Spared no expense."', 'log-say'); },
    john(a) { return cmds.hammond(a); },
    malcolm() { print('"Life, uh... finds a way."', 'log-say'); },
    ian(a) { return cmds.malcolm(a); },
    grant() { print('"...six foot turkey."', 'log-say'); },
    alan(a) { return cmds.grant(a); },
    lex() { print('"It\'s a UNIX system! I know this!"', 'log-say'); JP.panels.open('fsn'); },
    tim() { print('"Are you a dinosaur nerd?" — "I prefer the term \'expert\'."', 'log-say'); },
    muldoon() { print('"Clever girl."', 'log-say'); },
    clever(a) { return cmds.muldoon(a); },
    ellie() { print('"Dinosaurs eat man. Woman inherits the Earth."', 'log-say'); }, sattler(a) { return cmds.ellie(a); },
    wu() { print('"All the animals in Jurassic Park are female. We\'ve engineered them that way."', 'log-say'); },
    gennaro() { print('"When you gotta go, you gotta go." — last seen: rex viewpoint restroom.', 'log-say'); }, lawyer(a) { return cmds.gennaro(a); },
    arnold() { print('"I can\'t get Jurassic Park back online without Dennis Nedry."', 'log-say'); }, ray(a) { return cmds.arnold(a); },
    spared() { print('"...no expense."', 'log-say'); },
    goat() { print(JP.state.rex.loose ? 'goat: not found.' : 'goat: tethered at rex viewpoint. still there. for now.', 'dim'); },
    butts() { print('"Hold onto your butts."', 'log-say'); }, hold(a) { return cmds.butts(a); },
    dna() {
      print(`   ,-.      MR. DNA
  ( oo)     "Hi! I'm Mr. DNA!"
   \\_/      Dinosaur blood, in a mosquito, in amber — 100 million years old.
   ||       Gaps in the sequence? Frog DNA. Thinking machines. Virtual reality displays.
  /||\\      ...and then the park just runs itself.  Bingo! Dino DNA!`, 'log-say');
    },
  };

  return { root, print, typeOut, exec, focus, deny, prompt: () => prompt(), get cwd() { return cwd; } };
})();
