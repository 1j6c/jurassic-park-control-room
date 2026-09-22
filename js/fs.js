/* Système de fichiers virtuel (IRIX), partagé par la console et le navigateur 3D. */
JP.fs = (() => {
  const D = (children, meta = {}) => ({ type: 'dir', children, ...meta });
  const F = (content, size, meta = {}) => ({ type: 'file', content, size: size || (typeof content === 'string' ? content.length : 0), ...meta });

  const garbage = (n, seeds) => {
    let s = '';
    const chars = '█▓▒░¶§µðþæ≠∞≈¬@#%&$*';
    for (let i = 0; i < n; i++) {
      if (seeds.length && Math.random() < 0.02) s += ' ' + seeds[Math.floor(Math.random() * seeds.length)] + ' ';
      else s += chars[Math.floor(Math.random() * chars.length)];
      if (i % 64 === 63) s += '\n';
    }
    return s;
  };

  const KEYCHECKS = [
    ['18:31:04', 'system'], ['18:31:09', 'nedry'], ['18:31:12', 'goto command level'], ['18:31:15', 'nedry'],
    ['18:31:19', '040/#xy/67&'], ['18:31:24', 'mr goodbytes'], ['18:31:28', 'keycheck off'], ['18:31:30', 'safety off'],
    ['18:31:33', 'sl off'], ['18:31:37', 'security'], ['18:31:41', 'whte_rbt.obj'],
  ];

  const SPECIES = [
    ['Tyrannosaurus rex', 1, 'TYR'], ['Velociraptor', 3, 'RAP'], ['Dilophosaurus', 3, 'DIL'], ['Triceratops', 4, 'TRI'],
    ['Brachiosaurus', 4, 'BRA'], ['Parasaurolophus', 2, 'BRA'], ['Gallimimus', 8, 'GAL'], ['Herrerasaurus', 2, 'HER'],
    ['Metriacanthosaurus', 2, 'MET'], ['Baryonyx', 1, 'BAR'], ['Segisaurus', 5, 'SEG'], ['Proceratosaurus', 3, 'PRO'],
    ['Stegosaurus', 0, '—'], ['Compsognathus', 0, '—'], ['Apatosaurus', 0, '—'],
  ];

  const root = D({
    bin: D(Object.fromEntries(['sh', 'csh', 'ls', 'cat', 'ps', 'kill', 'who', 'login', 'su', 'fsn', 'winterm', 'toolchest', 'jpctl', 'fencectl', 'tourd', 'camd', 'cc', 'make', 'vi'].map(n => [n, F('ELF binary', Math.round(JP.rand(12000, 480000)), { bin: true })]))),
    dev: D({ console: F('', 0, { dev: true }), ttyq1: F('', 0, { dev: true }), ttyq3: F('', 0, { dev: true }), dsk: D({ dks0d1s0: F('', 0, { dev: true }) }) }),
    etc: D({
      passwd: F(`root:x:0:0:Super-User:/:/bin/csh
sys:x:2:2:System:/:
jpsys:x:100:100:Jurassic Park System Control:/usr/jpsys:/bin/csh
arnold:x:1001:20:Ray Arnold, Chief Engineer:/usr/people/arnold:/bin/csh
nedry:x:1002:20:Dennis Nedry, Systems programmer:/usr/nedry:/bin/csh
hammond:x:1003:20:John Hammond, CEO InGen:/usr/people/hammond:/bin/csh
muldoon:x:1004:20:Robert Muldoon, Game warden:/usr/people/muldoon:/bin/csh
wu:x:1005:30:Henry Wu, Chief geneticist:/usr/people/wu:/bin/csh
harding:x:1006:30:Gerry Harding, Veterinarian:/usr/people/harding:/bin/csh
1j6c:x:2026:20:Systems contractor:/usr/people/1j6c:/bin/csh
`),
      motd: F(`Welcome to Jurassic Park.
Isla Nublar — InGen Systems Group — IRIX 4.0.5

  "We spared no expense."  — J. Hammond

Unauthorized access is a violation of InGen policy 7.3.
`),
      hosts: F(`127.0.0.1    localhost
192.9.200.3  jpsys jpsys.ingen.com    # control room, workstation 1
192.9.200.5  ws3.ingen.com            # workstation 3 (nedry)
192.9.200.20 lab.ingen.com            # genetics lab
192.9.200.40 dock.ingen.com           # east dock terminal
192.9.200.60 shed.ingen.com           # maintenance shed
`),
      fstab: F(`/dev/root       /       efs  rw,raw=/dev/rroot 0 0
/dev/dsk/dks0d1s6 /usr  efs  rw 0 0
/dev/dsk/dks0d2s7 /var  efs  rw 0 0
`),
    }),
    tmp: D({ 'cc.4127.o': F(garbage(300, ['phones', 'ring', 'PBX']), 18334), 'soda.txt': F('vending machine: out of Barbasol. ask nedry.\n') }),
    usr: D({
      jpsys: D({
        control: D({
          'jpctl.cfg': F(`# Jurassic Park main program grid — configuration
grid.nodes        = 32
grid.master       = jpsys
grid.watchdog     = 30s
security.keycheck = on
security.safety   = on
security.sl       = on
`),
          'grid.status': F(() => `main program grid: ${JP.state.locked ? 'LOCKED (owner: nedry, pid 4127)' : 'ONLINE'}\n`),
        }),
        security: D({
          'fences.cfg': F(() => JP.sys.fences.map(f => `${f.id.padEnd(4)} ${f.name.padEnd(26)} ${f.kv.toFixed(1)} kV  ${f.on ? 'ENERGIZED' : 'OFF'}`).join('\n') + '\n'),
          visitor_center: D({
            door_locks: F(() => `VISITOR CENTER — DOOR LOCK CONTROL\nstate = ${JP.sys.locks.visitorCenter ? 'ENGAGED' : 'RELEASED'}\n`, 64, { special: 'door_locks' }),
            'east_wing.map': F('east wing: kitchen, dining hall, control room stairwell, lab corridor\n'),
          }),
          genetics_lab: D({ door_locks: F(() => `GENETICS LAB — DOOR LOCK CONTROL\nstate = ${JP.sys.locks.lab ? 'ENGAGED' : 'RELEASED'}\n`, 64) }),
          cryogenics: D({ vault: F(() => `CRYO VAULT\ndoor = ${JP.sys.cryo.door}\nvials = ${JP.sys.cryo.vials}/15\n`, 48) }),
          'keychecks.log': F(() => 'KEYCHECK LOG — workstation 3 — uid nedry\n' + KEYCHECKS.map(([t, c]) => `${t}  ${c}`).join('\n') + '\n', 512),
        }),
        tour: D({
          'tour.prog': F(`# TOUR PROGRAM — Explorer XLT autonomous track
00  DEPART   visitor center garage
01  PASS     dilophosaur enclosure     (narration: Richard Kiley — spared no expense)
02  STOP     tyrannosaur paddock        (goat tether)
03  PASS     triceratops enclosure
04  STOP     brachiosaur lagoon
05  RETURN   visitor center
speed = 15 mph   headway = 90 ft   power = induction rail
`),
          'vehicles.db': F(() => JP.sys.tour.vehicles.map(v => `${v.id}  ${v.occ.padEnd(28)} ${v.signal ? 'TELEMETRY OK' : 'SIGNAL LOST'}`).join('\n') + '\n'),
        }),
        db: D({
          'species.db': F(SPECIES.map(([n, c, p]) => `${n.padEnd(22)} ${String(c).padStart(2)}  ${p}`).join('\n') + '\n', 2048),
          'sensors.db': F('1432 motion sensors — grid 12 — polling 4 Hz\n', 60000),
          'guests.db': F(`GRANT, Alan        paleontologist       EXP-04
SATTLER, Ellie     paleobotanist        EXP-05
MALCOLM, Ian       mathematician        EXP-04
GENNARO, Donald    attorney             EXP-04
MURPHY, Lex        guest (12)           EXP-05
MURPHY, Tim        guest (9)            EXP-05
`),
        }),
        bin: D({ jpctl: F('ELF', 220000, { bin: true }), fencectl: F('ELF', 88000, { bin: true }), sensord: F('ELF', 140000, { bin: true }), camd: F('ELF', 96000, { bin: true }) }),
      }),
      nedry: D({
        'whte_rbt.obj': F(garbage(900, ['AH AH AH', 'MAGIC WORD', 'whte_rbt', 'Dodgson', 'nobody cares', 'keycheck', 'security']), 1842176, { bin: true, special: 'whte_rbt' }),
        'phones.c': F(`/* phones.c — PBX debug, InGen Isla Nublar
 * D. Nedry — "I finished debugging the phones."
 * NOTE: system compiles for 18-20 minutes. some minor systems may go on and off.
 *       (that's what I'll tell them anyway)
 */
#include <stdio.h>
#include "pbx.h"

int main(int argc, char **argv) {
    pbx_t *p = pbx_open("/dev/pbx0");
    if (!p) { perror("pbx"); return 1; }
    /* TODO: fix line 4 crosstalk — when they pay me what I'm worth */
    pbx_reset(p);
    return 0;
}
`),
        'todo.txt': F(`1. finish "debugging" the phones
2. vending machine (soda)
3. east dock — 7:00 PM — do NOT be late
4. get paid. finally.

"I am totally unappreciated in my time."
`),
        '.notes': F(`Dodgson. East Dock. Anne B. 7:00 PM sharp.
Barbasol can — 15 species, 2 of each. Keep it cold.
18 minute window. No one will notice.

backdoor: mr goodbytes
`, 220, { hidden: true }),
        'core': F(garbage(200, ['SIGSEGV']), 4194304, { bin: true }),
        Mail: D({ inbox: F(`From dodgson@biosyn.com Thu Jun 10 22:14:03 1993
Subject: your fee

Dennis — 750,000 on delivery, 50,000 per viable embryo. Docks, 7 PM.
Don't get cute.  — L.D.

From hammond@ingen.com Fri Jun 11 09:02:41 1993
Subject: RE: RE: RE: compensation

Dennis, I'm not going to argue about this again. Finish the phones.
                                                   — J.H.
`) }),
      }),
      people: D({
        arnold: D({ '.cshrc': F('set prompt = "jpsys %h% "\nalias ll ls -l\n'), 'notes.txt': F('Nedry\'s workstation: 2 million lines of code. He\'s the only one who knows how half of it works.\nHold onto your butts.\n') }),
        hammond: D({ 'expense.txt': F('SPARED NO EXPENSE.\n'), 'flea_circus.txt': F('Petticoat Lane. The trapeze, the carousel... all an illusion. I wanted to show them something real.\n') }),
        muldoon: D({ 'raptors.txt': F('They show extreme intelligence. Problem-solving. They remember.\nThe big one — she\'s the one to watch. When she looks at you, you can see she\'s working things out.\n') }),
        wu: D({ 'frog_dna.txt': F('Sequence gaps filled with West African frog DNA (Hyperolius). Population control: all animals engineered female. Lysine contingency in place.\n') }),
        malcolm: D({ 'chaos.txt': F('Life, uh, finds a way.\n\nYou were so preoccupied with whether or not you could, you didn\'t stop to think if you should.\n') }),
        grant: D({ 'raptor_claw.txt': F('Six-inch retractable claw. Like a razor. On the middle toe.\n') }),
        lex: D({ 'unix.txt': F('It\'s a UNIX system! I know this!\n'), 'dinosaur.txt': F(`
                __
               / _)
        .-^^^-/ /
     __/       /
    <__.|_|-|_|      Lex was here. Vegetarian.
`) }),
        '1j6c': D({
          '.signature': F(() => `${JP.AUTHOR.statement}\n\nEd25519 public key (DER, base64):\n${JP.AUTHOR.pubkey}\n\nSignature (base64):\n${JP.AUTHOR.signature}\n\nVerify:\n  echo -n "<statement>" > s.txt\n  echo "<signature>" | base64 -d > s.sig\n  openssl pkeyutl -verify -pubin -inkey pub.pem -rawin -in s.txt -sigfile s.sig\n`, 640),
          'README': F(`This machine was built in September 2026 by someone who does not type the code
himself. He directs the machine that types it, checks every line against the film,
and decides what stays.

If you found this file, you went looking. Good. That's the whole point of the console.

Copy it, fork it, ship it, sell it. Just don't tell people you built it: the signature
next to this file says otherwise, and only one person can produce another one.

                                                            1j6c
`),
          '.cshrc': F('set prompt = "1j6c %h% "\nalias ahahah "echo you did not say the magic word"\n'),
        }),
        tim: D({ 'notes.txt': F('Dr. Grant is cool. He said dinosaurs turned into birds.\nDo they have any velociraptors? ...six foot turkey.\n') }),
      }),
      lib: D({ 'libc.so': F('', 900000, { bin: true }), 'libgl.so': F('', 1200000, { bin: true }), 'libjp.so': F('', 600000, { bin: true }) }),
      sbin: D({ shutdown: F('', 30000, { bin: true }), reboot: F('', 20000, { bin: true }), fsck: F('', 60000, { bin: true }) }),
    }),
    var: D({
      adm: D({ SYSLOG: F(() => JP.syslog.join('\n') + '\n', 40000) }),
      spool: D({ lp: D({}) }),
    }),
  });

  /* Chemins */
  function normalize(path, cwd) {
    if (!path || path === '~') path = '/usr/people/arnold';
    if (!path.startsWith('/')) path = (cwd === '/' ? '' : cwd) + '/' + path;
    const out = [];
    for (const seg of path.split('/')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') out.pop(); else out.push(seg);
    }
    return '/' + out.join('/');
  }
  function get(path, cwd = '/') {
    const p = normalize(path, cwd);
    if (p === '/') return { node: root, path: p, name: '/' };
    let node = root, name = '/';
    for (const seg of p.slice(1).split('/')) {
      if (node.type !== 'dir' || !node.children[seg]) return null;
      node = node.children[seg]; name = seg;
    }
    return { node, path: p, name };
  }
  function content(node) { return typeof node.content === 'function' ? node.content() : node.content; }
  function list(node, all = false) {
    return Object.entries(node.children).filter(([n, c]) => all || !c.hidden).sort((a, b) => a[0].localeCompare(b[0]));
  }
  function find(node, needle, base = '', acc = []) {
    for (const [n, c] of Object.entries(node.children || {})) {
      const p = base + '/' + n;
      if (n.toLowerCase().includes(needle.toLowerCase())) acc.push(p);
      if (c.type === 'dir') find(c, needle, p, acc);
    }
    return acc;
  }
  function fmtSize(n) { return String(n).padStart(9); }

  return { root, get, normalize, content, list, find, fmtSize, KEYCHECKS, SPECIES };
})();
