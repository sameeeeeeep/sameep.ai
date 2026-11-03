// infocard.js — a small Platinum info card for desktop project icons and folder items, so people can
// decide what to open. Mouse: hover 300 ms, gone on mouse-out or Esc. Touch: first tap shows the card
// with Open, second tap (or Open) opens. Any element with data-card="<id>" gets one; the copy is that
// id's `card` in data/work.json, or a folder's own card (data-card="folder-<id>").
import { h, clamp } from './util.js';

const GAP = 10, EDGE = 8, DELAY = 300;

// where a click goes, in a few words
function where(el, folder) {
  if (folder) return `Opens a folder of ${folder.items.length}`;
  const href = el.getAttribute('href');
  if (!href) return '';
  const u = new URL(href, location.href);
  if (u.origin === location.origin) return 'Opens a page on sameep.ai ↗';
  if (u.hostname === 'github.com') return 'Opens on GitHub ↗';
  return `Opens ${u.hostname.replace(/^www\./, '')} ↗`;
}

export function installCards({ area, loadList, folders = [], chapter, onHear }) {
  let list = null;
  const ready = loadList().then((l) => { list = l; }).catch(() => { list = []; });
  const byFolder = new Map(folders.map((f) => [`folder-${f.id}`, f]));
  const card = h('div.icard', { role: 'tooltip', id: 'icard', hidden: true });
  area.append(card);
  let timer = 0, shownFor = null, lastTouch = false;

  const data = (id) => {
    const f = byFolder.get(id);
    if (f) return f.card && { title: f.label, ...f.card, folder: f };
    const w = list?.find((x) => x.id === id);
    return w?.card && { title: w.title, ...w.card };
  };

  function place(el) {
    const A = area.getBoundingClientRect(), r = el.getBoundingClientRect();
    const cw = card.offsetWidth, ch = card.offsetHeight;
    const box = { l: r.left - A.left, t: r.top - A.top, r: r.right - A.left, b: r.bottom - A.top };
    let x, y;
    // beside the icon if there's room (right, then left), otherwise below or above it: never on top of it
    if (box.r + GAP + cw <= A.width - EDGE) x = box.r + GAP;
    else if (box.l - GAP - cw >= EDGE) x = box.l - GAP - cw;
    if (x != null) y = clamp(box.t, EDGE, Math.max(EDGE, A.height - ch - EDGE));
    else {
      x = clamp((box.l + box.r) / 2 - cw / 2, EDGE, Math.max(EDGE, A.width - cw - EDGE));
      y = box.b + GAP + ch <= A.height - EDGE ? box.b + GAP : Math.max(EDGE, box.t - GAP - ch);
    }
    card.style.left = x + 'px'; card.style.top = y + 'px';
  }

  function show(el, touch) {
    const d = data(el.dataset.card);
    if (!d) return false;
    const node = d.node && chapter?.(d.node);
    card.replaceChildren(...[
      d.thumb && h('img.icard__pic', { src: d.thumb, alt: '', decoding: 'async' }),
      h('div.icard__body',
        h('p.icard__t', d.title),
        d.what && h('p.icard__what', d.what),
        d.role && h('p.icard__row', h('b', 'Role'), d.role),
        d.proof && h('p.icard__row', h('b', 'Proof'), d.proof)),
      h('p.icard__where', where(el, d.folder), node && h('span', ` · On the podcast: ${node}`)),
      touch && h('div.icard__btns',
        node && onHear && h('button.btn.btn--sm', { type: 'button', onclick: () => { hide(); onHear(d.node); } }, 'Hear it'),
        h('button.btn.btn--sm.btn--primary', { type: 'button', onclick: () => { const t = el; hide(); t.dataset.cardOpen = '1'; t.click(); } }, 'Open'))].filter(Boolean));
    card.classList.toggle('is-touch', !!touch);
    card.hidden = false;
    place(el);
    requestAnimationFrame(() => card.classList.add('is-on'));
    el.setAttribute('aria-describedby', 'icard');
    shownFor = el;
    return true;
  }

  function hide() {
    clearTimeout(timer);
    if (!shownFor) return;
    shownFor.removeAttribute('aria-describedby');
    shownFor = null;
    card.classList.remove('is-on');
    card.hidden = true;
  }

  const later = (el) => { clearTimeout(timer); timer = setTimeout(() => ready.then(() => show(el, false)), DELAY); };

  area.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const el = e.target.closest('[data-card]');
    if (!el || el === shownFor) return;
    hide(); later(el);
  });
  area.addEventListener('pointerout', (e) => {
    if (e.pointerType === 'touch') return;
    const el = e.target.closest('[data-card]');
    if (el && !el.contains(e.relatedTarget)) hide();
  });
  area.addEventListener('focusin', (e) => { const el = e.target.closest('[data-card]'); if (el && !lastTouch) later(el); });
  area.addEventListener('focusout', (e) => { if (e.target.closest('[data-card]') && !card.contains(e.relatedTarget)) { if (!card.classList.contains('is-touch')) hide(); } });
  area.addEventListener('pointerdown', (e) => {
    lastTouch = e.pointerType === 'touch';
    if (shownFor && !card.contains(e.target) && !shownFor.contains(e.target)) hide();
  }, true);
  // touch: the first tap shows the card, the second opens it
  area.addEventListener('click', (e) => {
    const el = e.target.closest('[data-card]');
    if (!el) return;
    if (el.dataset.cardOpen) { delete el.dataset.cardOpen; return; }
    if (!lastTouch) { hide(); return; }
    if (shownFor === el) { hide(); return; }
    if (!list) return;  // copy not loaded yet: just open
    if (show(el, true)) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  area.addEventListener('scroll', hide, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && shownFor) { e.stopPropagation(); hide(); } }, true);
  return { hide };
}
