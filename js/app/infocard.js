// infocard.js — a small Platinum info card for desktop project icons and folder items, so people can
// decide what to open. Mouse: hover 300 ms, gone on mouse-out or Esc. Touch: first tap shows the card
// with Open, second tap (or Open) opens. Any element with data-card="<id>" gets one; the copy is that
// id's `card` in data/work.json, a folder's own card (data-card="folder-<id>"), or js/app/cards.js for the
// system icons, toys and games. The guide (js/guide/guide.js) shows the same card inside its caption: content(el).
import { h, clamp } from './util.js';
import { MORE_CARDS } from './cards.js';

const GAP = 10, EDGE = 8, DELAY = 300;

// where a click goes, in a few words
function where(el, folder, opens) {
  if (folder) return `Opens a folder of ${folder.items.length}`;
  if (el.matches('[aria-label$="still being built"], [aria-label$="coming soon"]')) return 'Coming soon: it opens here the moment it’s live';
  if (opens) return opens;
  const href = el.getAttribute('href');
  if (!href) return '';
  const u = new URL(href, location.href);
  if (u.origin === location.origin) return 'Opens a page on sameep.ai ↗';
  if (u.hostname === 'github.com') return 'Opens on GitHub ↗';
  return `Opens ${u.hostname.replace(/^www\./, '')} ↗`;
}

export function installCards({ area, loadList, folders = [], chapter, onHear, quiet = () => false }) {
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
    if (w?.card) return { title: w.title, ...w.card };
    return MORE_CARDS[id] || null;
  };
  const pic = (d) => (d.thumb ? h('img.icard__pic', { src: d.thumb, alt: '', decoding: 'async' })
    : (d.icon || d.iconUrl) && h('img.icard__pic.is-icon', { src: d.iconUrl || `img/ui/${d.icon}.svg`, alt: '', decoding: 'async' }));
  // the card's insides: picture, name, what it is, the one-line why, where a click goes
  function content(el, { touch = false, guide = false } = {}) {
    const d = data(el.dataset.card);
    if (!d) return null;
    const node = d.node && chapter?.(d.node);
    return [
      pic(d) || h('span.icard__pic.is-blank'),
      h('div.icard__body',
        h('p.icard__t', d.title),
        d.what && h('p.icard__what', d.what),
        d.proof && h('p.icard__why', d.proof)),
      h('p.icard__where', where(el, d.folder, d.opens), node && h('span', ` · On the podcast: ${node}`)),
      (touch || guide) && h('div.icard__btns',
        node && onHear && h('button.btn.btn--sm', { type: 'button', onclick: () => { hide(); onHear(d.node); } }, 'Hear it'),
        touch && h('button.btn.btn--sm.btn--primary', { type: 'button', onclick: () => { const t = el; hide(); t.dataset.cardOpen = '1'; t.click(); } }, 'Open')),
    ].filter(Boolean);
  }

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
    if (quiet()) return false;  // the guide is up: it shows this card itself
    const kids = content(el, { touch });
    if (!kids) return false;
    card.replaceChildren(...kids);
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
  document.addEventListener('guide:start', hide);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && shownFor) { e.stopPropagation(); hide(); } }, true);
  // for the guide: the same card, as a block it can put in its caption (null if the item has none)
  const forGuide = (el) => {
    const kids = el?.dataset?.card && content(el, { guide: true });
    return kids ? h('div.icard.is-on.is-inline', kids.filter((k) => !k.classList.contains('icard__btns') || k.childElementCount)) : null;
  };
  return { hide, content: forGuide, ready };
}
