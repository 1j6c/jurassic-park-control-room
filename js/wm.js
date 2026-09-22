/* Gestionnaire de fenêtres façon 4Dwm : drag, focus, iconification, maximisation, redimensionnement. */
JP.wm = (() => {
  const layer = document.getElementById('windows');
  const iconbar = document.getElementById('iconbar');
  const wins = new Map();
  let zTop = 10, active = null;

  const deskH = () => innerHeight - 74;

  function open(o) {
    if (wins.has(o.id)) { const w = wins.get(o.id); restore(w); focus(w); return w; }
    const el = JP.el('div', { class: 'win' + (o.cls ? ' ' + o.cls : ''), tabindex: '-1' });
    el.style.cssText = `left:${Math.round(o.x)}px;top:${Math.round(o.y)}px;width:${Math.round(o.w)}px;height:${Math.round(o.h)}px;`;
    const tb = JP.el('div', { class: 'tb' },
      JP.el('div', { class: 'tb-menu' }),
      JP.el('div', { class: 'tb-title', text: o.title }),
      JP.el('div', { class: 'tb-btns' },
        o.noMin ? null : JP.el('div', { class: 'tb-btn tb-min', title: 'Iconify' }),
        JP.el('div', { class: 'tb-btn tb-max', title: 'Maximize' }),
        o.noClose ? null : JP.el('div', { class: 'tb-btn tb-close', title: 'Close' })));
    const body = JP.el('div', { class: 'body' + (o.gray ? ' gray' : '') });
    if (o.body) body.append(o.body);
    const grip = JP.el('div', { class: 'grip' });
    el.append(tb, body, grip);
    layer.append(el);
    const w = { id: o.id, el, tb, body, opts: o, icon: null, max: null, closed: false };
    wins.set(o.id, w);

    el.addEventListener('pointerdown', () => focus(w));
    tb.addEventListener('pointerdown', e => { if (e.target.closest('.tb-btn')) return; startDrag(w, e); });
    tb.addEventListener('dblclick', e => { if (!e.target.closest('.tb-btn')) toggleMax(w); });
    tb.querySelector('.tb-min')?.addEventListener('click', () => iconify(w));
    tb.querySelector('.tb-max').addEventListener('click', () => toggleMax(w));
    tb.querySelector('.tb-close')?.addEventListener('click', () => close(w));
    grip.addEventListener('pointerdown', e => startResize(w, e));
    focus(w);
    o.onOpen?.(w);
    JP.bus.emit('wm:open', w);
    return w;
  }

  function focus(w) {
    if (active === w) return;
    if (active) active.el.classList.remove('active');
    active = w;
    w.el.classList.add('active');
    w.el.style.zIndex = ++zTop;
    w.opts.onFocus?.(w);
  }
  function startDrag(w, e) {
    e.preventDefault();
    const r = w.el.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
    const move = ev => {
      w.el.style.left = JP.clamp(ev.clientX - ox, -r.width + 80, innerWidth - 80) + 'px';
      w.el.style.top = JP.clamp(ev.clientY - oy, 0, innerHeight - 30) + 'px';
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); w.el.classList.remove('dragging'); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    w.el.classList.add('dragging');
  }
  function startResize(w, e) {
    e.preventDefault(); e.stopPropagation();
    const r = w.el.getBoundingClientRect();
    const move = ev => {
      w.el.style.width = Math.max(220, ev.clientX - r.left) + 'px';
      w.el.style.height = Math.max(120, ev.clientY - r.top) + 'px';
      w.opts.onResize?.(w);
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); w.opts.onResize?.(w); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }
  function toggleMax(w) {
    if (w.max) { Object.assign(w.el.style, w.max); w.max = null; }
    else {
      w.max = { left: w.el.style.left, top: w.el.style.top, width: w.el.style.width, height: w.el.style.height };
      Object.assign(w.el.style, { left: '0px', top: '0px', width: innerWidth + 'px', height: deskH() + 'px' });
    }
    w.opts.onResize?.(w);
  }
  function iconify(w) {
    if (w.icon) return;
    w.el.style.display = 'none';
    w.icon = JP.el('div', { class: 'icon', title: w.opts.title, onclick: () => { restore(w); focus(w); } },
      JP.el('div', { class: 'icon-glyph', text: w.opts.glyph || w.opts.title.slice(0, 3).toUpperCase() }),
      JP.el('div', { class: 'icon-label', text: w.opts.title }));
    iconbar.append(w.icon);
    w.opts.onHide?.(w);
  }
  function restore(w) {
    if (w.icon) { w.icon.remove(); w.icon = null; }
    w.closed = false;
    w.el.style.display = '';
    w.opts.onShow?.(w);
  }
  function close(w) {
    if (w.opts.onClose && w.opts.onClose(w) === false) return;
    if (w.opts.destroyOnClose) { destroy(w); return; }
    w.closed = true;
    w.el.style.display = 'none';
    w.opts.onHide?.(w);
  }
  function destroy(w) {
    if (w.icon) w.icon.remove();
    w.el.remove();
    wins.delete(w.id);
    if (active === w) active = null;
  }
  function alertIcon(id, on) { const w = wins.get(id); if (w?.icon) w.icon.classList.toggle('alert', on); }
  function isVisible(w) { return w && !w.icon && !w.closed; }

  window.addEventListener('resize', () => {
    for (const w of wins.values()) {
      if (w.max) { Object.assign(w.el.style, { width: innerWidth + 'px', height: deskH() + 'px' }); continue; }
      const r = w.el.getBoundingClientRect();
      if (r.left > innerWidth - 80) w.el.style.left = (innerWidth - 80) + 'px';
      if (r.top > innerHeight - 30) w.el.style.top = (innerHeight - 30) + 'px';
      w.opts.onResize?.(w);
    }
  });

  return { open, focus, close, destroy, iconify, restore, toggleMax, alertIcon, isVisible,
           get: id => wins.get(id), all: () => [...wins.values()], active: () => active };
})();
