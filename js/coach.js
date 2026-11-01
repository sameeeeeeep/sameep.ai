// coach.js — first-time guides: a small speech bubble pointing at the thing to use
// ("swipe to move the story", "tap a card or just say it"). Each tip shows once per
// visitor (localStorage), one at a time, and goes away the moment it's acted on.
//   coach.show(id, anchorEl, html, { place: 'top' | 'bottom', ms })   coach.done(id)
// html is our own static copy (a <b> or two), never anything a visitor typed.
const KEY = 'otcv-tip-';
const seen = (id) => { try { return localStorage.getItem(KEY + id) === '1'; } catch { return false; } };
const mark = (id) => { try { localStorage.setItem(KEY + id, '1'); } catch { /* private mode: shows again, harmless */ } };
const force = /[?&]tips\b/.test(location.search); // ?tips: show them all again (QA)

let cur = null; // { id, el, anchor, raf, timer }

function style() {
  if (document.getElementById('coach-css')) return;
  const s = document.createElement('style');
  s.id = 'coach-css';
  s.textContent = `
.coach { position: fixed; z-index: 9999; max-width: min(300px, calc(100vw - 24px)); padding: 10px 34px 11px 13px; border-radius: 10px;
  background: #fff6d8; color: #1c1611; font: 500 14px/1.4 'Bricolage Grotesque', system-ui, sans-serif; box-shadow: 0 8px 28px rgba(0,0,0,.45);
  pointer-events: auto; animation: coach-in .25s ease-out; }
.coach b { font-weight: 800; }
.coach__x { position: absolute; top: 4px; right: 4px; width: 26px; height: 26px; border: 0; border-radius: 6px; background: none; color: inherit; font: 700 16px/1 system-ui; cursor: pointer; opacity: .6; }
.coach__x:hover { opacity: 1; }
.coach__tip { position: absolute; width: 12px; height: 12px; background: inherit; transform: rotate(45deg); }
.coach[data-place="top"] .coach__tip { bottom: -6px; }
.coach[data-place="bottom"] .coach__tip { top: -6px; }
@keyframes coach-in { from { opacity: 0; transform: translateY(6px); } }
@media (prefers-reduced-motion: reduce) { .coach { animation: none; } }`;
  document.head.append(s);
}

function place() {
  if (!cur) return;
  const { el, anchor } = cur;
  if (!anchor.isConnected || anchor.offsetParent === null && getComputedStyle(anchor).position !== 'fixed') { hide(); return; }
  const r = anchor.getBoundingClientRect(), b = el.getBoundingClientRect();
  let where = cur.place;
  if (where === 'top' && r.top - b.height - 14 < 4) where = 'bottom';
  if (where === 'bottom' && r.bottom + b.height + 14 > innerHeight - 4) where = 'top';
  const x = Math.max(12, Math.min(innerWidth - b.width - 12, r.left + r.width / 2 - b.width / 2));
  const y = where === 'top' ? r.top - b.height - 12 : r.bottom + 12;
  el.dataset.place = where;
  el.style.left = x + 'px'; el.style.top = Math.max(4, y) + 'px';
  el.querySelector('.coach__tip').style.left = Math.max(10, Math.min(b.width - 22, r.left + r.width / 2 - x - 6)) + 'px';
  cur.raf = requestAnimationFrame(place);
}

function hide() {
  if (!cur) return;
  cancelAnimationFrame(cur.raf); clearTimeout(cur.timer);
  cur.el.remove();
  cur = null;
}

export const coach = {
  // false if it was already seen (or another tip is up), so callers can skip follow-ups
  show(id, anchor, html, { place: where = 'top', ms = 14000 } = {}) {
    if (!anchor || (seen(id) && !force) || cur) return false;
    style();
    const el = document.createElement('div');
    el.className = 'coach';
    el.setAttribute('role', 'status');
    el.innerHTML = `<span class="coach__tip" aria-hidden="true"></span>${html}<button class="coach__x" type="button" aria-label="Got it">×</button>`;
    el.querySelector('.coach__x').onclick = () => coach.done(id);
    document.body.append(el);
    mark(id);
    cur = { id, el, anchor, place: where, raf: 0, timer: setTimeout(hide, ms) };
    place();
    return true;
  },
  done(id) { if (cur && (!id || cur.id === id)) hide(); else if (id) mark(id); },
  seen,
};
