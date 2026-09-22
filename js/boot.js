/* Séquence de boot IRIX 4.0.5 (plein écran). */
JP.boot = (() => {
  const el = document.getElementById('boot'), pre = document.getElementById('boot-text');
  const LINES = [
    ['Running power-on diagnostics...', 300],
    ['IP12 — R4000 100 MHz — cache 8K/8K — 64 MB memory ..... OK', 500, 'ok'],
    ['SCSI: dks0d1 — 1.2 GB — dks0d2 — 2.0 GB — ready', 250],
    ['Starting up the system...', 700],
    ['', 100],
    ['IRIX Release 4.0.5 IP12 Version 06151813 System V', 200],
    ['Copyright 1987-1992 Silicon Graphics, Inc.', 80],
    ['All Rights Reserved.', 300],
    ['Total real memory = 64 Mb', 60],
    ['Available memory = 56 Mb', 200],
    ['The system is coming up.  Please wait.', 900],
    ['Mounting file systems: / /usr /var ..... done', 350],
    ['Checking file system consistency ..... done', 500],
    ['Starting network: jpsys (192.9.200.3) — ec0 10baseT', 300],
    ['Starting daemons: syslogd inetd lpd sendmail cron', 300],
    ['', 100],
    ['JURASSIC PARK SYSTEM CONTROL v2.1 — InGen Systems Group — build 1j6c', 500, 'ok'],
    ['   main program grid .............. 32 nodes ..... online', 220, 'ok'],
    ['   perimeter fence controller ..... 12 circuits . online', 220, 'ok'],
    ['   motion sensor network .......... 1,432 ....... online', 220, 'ok'],
    ['   video surveillance ............. 36 cameras .. online', 220, 'ok'],
    ['   tour program ................... 2 vehicles .. online', 220, 'ok'],
    ['   cryogenics ..................... vault 1 ..... online', 220, 'ok'],
    ['   communications (PBX) ........... 6 lines ..... online', 220, 'ok'],
    ['   door locks ..................... engaged ..... online', 220, 'ok'],
    ['', 300],
    ['Welcome to Jurassic Park.', 700, 'ok'],
    ['', 200],
  ];
  const REBOOT = [
    ['', 200],
    ['Power restored — cold start.', 600, 'warn'],
    ['IRIX Release 4.0.5 IP12 Version 06151813 System V', 200],
    ['Total real memory = 64 Mb', 200],
    ['The system is coming up.  Please wait.', 900],
    ['Checking file system consistency ..... /usr: unexpected inconsistency — REPAIRED', 900, 'warn'],
    ['Starting network: jpsys (192.9.200.3)', 300],
    ['', 100],
    ['JURASSIC PARK SYSTEM CONTROL v2.1', 400, 'ok'],
    ['   main program grid .............. online  (owner: jpsys — whte_rbt.obj: NOT FOUND)', 400, 'ok'],
    ['   perimeter fence controller ..... 12 circuits . DE-ENERGIZED — manual reset', 400, 'err'],
    ['   motion sensor network .......... online', 200, 'ok'],
    ['   video surveillance ............. online', 200, 'ok'],
    ['   communications (PBX) ........... online', 200, 'ok'],
    ['   door locks ..................... RELEASED (default)', 400, 'err'],
    ['', 300],
    ['Welcome back to Jurassic Park. Hold onto your butts.', 900, 'ok'],
  ];

  function run(opts = {}) {
    return new Promise(async resolve => {
      el.hidden = false; pre.innerHTML = '';
      let skip = false;
      const onKey = () => { skip = true; };
      document.addEventListener('keydown', onKey);
      const lines = opts.reboot ? REBOOT : LINES;
      for (const [text, wait, cls] of lines) {
        const d = JP.el('div', { class: cls || '', text });
        pre.append(d);
        if (JP.audio.ready() && text) JP.audio.blip();
        if (!skip) await JP.sleep(wait);
      }
      if (!opts.reboot) {
        const login = JP.el('div', { text: 'jpsys login: ' }); pre.append(login);
        await typeInto(login, 'arnold', skip ? 0 : 90);
        const pw = JP.el('div', { text: 'Password: ' }); pre.append(pw);
        await JP.sleep(skip ? 0 : 500);
        pre.append(JP.el('div', { text: 'Last login: Fri Jun 11 07:58:12 on ttyq1' }));
        pre.append(JP.el('div', { class: 'ok', text: 'Starting 4Dwm... Toolchest ready.' }));
        await JP.sleep(skip ? 0 : 700);
      } else await JP.sleep(400);
      document.removeEventListener('keydown', onKey);
      el.hidden = true;
      resolve();
    });
  }
  function typeInto(node, text, ms) {
    return new Promise(res => { let i = 0; const base = node.textContent; const iv = setInterval(() => { node.textContent = base + text.slice(0, ++i); if (JP.audio.ready()) JP.audio.click(); if (i >= text.length) { clearInterval(iv); res(); } }, ms || 1); });
  }
  return { run };
})();
