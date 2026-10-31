// wm.js — a tiny Platinum window manager. Windows drag by their title bar on
// desktop; on narrow screens they become bottom sheets.
import { h, clamp, isNarrow } from './util.js';
import { sound } from './audio.js';

let z = 10;
const open = new Map();

export function createWM(layer) {
  function win(id, { title, width = 420, height, x, y, className = '', onClose, tools = [], modal = false, center = false, sheet = true, label, persist = false } = {}) {
    if (id && open.has(id)) { const w = open.get(id); if (w.el.hidden) { w.el.hidden = false; sound.tick('open'); w.onShow?.(); } w.focus(); return w; }
    const body = h('div.win__body');
    const closeBtn = h('button.win__close', { type: 'button', 'aria-label': 'Close ' + title });
    const bar = h('header.win__bar',
      closeBtn,
      h('div.win__stripes', { 'aria-hidden': 'true' }),
      h('h2.win__title', title),
      h('div.win__tools', tools),
    );
    const el = h('section.win' + (className ? '.' + className.split(' ').join('.') : ''), { role: 'dialog', 'aria-label': label || title, tabindex: '-1' }, bar, body);
    const narrow = isNarrow() && sheet;
    if (narrow) el.classList.add('win--sheet');
    if (modal) el.classList.add('win--modal');
    layer.append(el);

    const L = layer.getBoundingClientRect();
    if (!narrow) {
      const w = Math.min(width, L.width - 24);
      el.style.width = w + 'px';
      if (height) el.style.height = Math.min(height, L.height - 24) + 'px';
      const hh = el.offsetHeight;
      const px = center || x == null ? (L.width - w) / 2 : x;
      const py = center || y == null ? Math.max(12, (L.height - hh) / 2) : y;
      el.style.left = clamp(px, 12, Math.max(12, L.width - w - 12)) + 'px';
      el.style.top = clamp(py, 12, Math.max(12, L.height - Math.min(hh, L.height - 24) - 12)) + 'px';
    }

    const api = {
      id, el, body, bar,
      focus() { el.style.zIndex = ++z; layer.querySelectorAll('.win.is-front').forEach((n) => n.classList.remove('is-front')); el.classList.add('is-front'); },
      close() {
        if (!el.isConnected || el.hidden) return;
        sound.tick('close');
        if (persist) { el.hidden = true; onClose?.(); return; }
        open.delete(id);
        el.classList.add('is-closing');
        setTimeout(() => el.remove(), 160);
        onClose?.();
      },
      setTitle(t) { bar.querySelector('.win__title').textContent = t; },
    };
    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); api.close(); });
    el.addEventListener('pointerdown', () => api.focus());
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal) { e.stopPropagation(); api.close(); } });

    if (!narrow) {
      let drag = null;
      bar.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button, a, input')) return;
        drag = { dx: e.clientX - el.offsetLeft, dy: e.clientY - el.offsetTop };
        bar.setPointerCapture(e.pointerId);
        el.classList.add('is-dragging');
      });
      bar.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const R = layer.getBoundingClientRect();
        el.style.left = clamp(e.clientX - drag.dx, -el.offsetWidth + 80, R.width - 80) + 'px';
        el.style.top = clamp(e.clientY - drag.dy, 0, R.height - 32) + 'px';
      });
      const end = () => { drag = null; el.classList.remove('is-dragging'); };
      bar.addEventListener('pointerup', end);
      bar.addEventListener('pointercancel', end);
    }

    if (id) open.set(id, api);
    sound.tick('open');
    api.focus();
    // content is added after creation: re-fit once it has a real height
    if (!narrow) requestAnimationFrame(() => {
      const R = layer.getBoundingClientRect();
      const hh = Math.min(el.offsetHeight, R.height - 24);
      const top = parseFloat(el.style.top) || 12;
      if (center) el.style.top = Math.max(12, (R.height - hh) / 2) + 'px';
      else if (top + hh > R.height - 12) el.style.top = Math.max(12, R.height - hh - 12) + 'px';
    });
    requestAnimationFrame(() => el.classList.add('is-open'));
    return api;
  }

  function alert({ icon = 'img/ui/stop.svg', title = '', message, buttons = [{ label: 'OK', primary: true }] }) {
    return new Promise((resolve) => {
      const w = win(null, { title: title || 'Alert', width: 420, className: 'win--alert', modal: true, center: true, sheet: false });
      const btns = buttons.map((b, i) => h('button.btn' + (b.primary ? '.btn--primary' : ''), { type: 'button', onclick: () => { w.close(); resolve(i); } }, b.label));
      w.body.append(h('div.alert', h('img.alert__icon', { src: icon, alt: '', width: 48, height: 48 }), h('div.alert__msg', message)), h('div.alert__btns', btns));
      sound.tick('error');
      setTimeout(() => btns.find((_, i) => buttons[i].primary)?.focus(), 30);
    });
  }

  return { win, alert, get: (id) => open.get(id), closeAll() { [...open.values()].forEach((w) => w.close()); } };
}
