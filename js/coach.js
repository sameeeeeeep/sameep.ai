// coach.js — first-time guides, in Wispr Flow's style: a black pill with a yellow
// ⚠, a bold white title, a grey line under it, and a round ✕ whose thin ring
// counts the guide down. It points at the thing to use ("swipe to move the
// story", "tap a card or just say it"). Each tip shows once per visitor
// (localStorage), one at a time, and goes away the moment it's acted on.
//   coach.show(id, anchorEl, html, { place: 'top' | 'bottom', ms, title, once, replace, follow })
//   coach.done(id)
// anchorEl may be 'dock' (bottom right, above the voice button) for guides about the voice.
// once:false guides (stuck? didn't catch that?) can show again; replace:true takes over
// from a guide that's up. follow:false places the guide once, on the page, so it scrolls away
// with it (for anchors on a sticky stage, where following would pin it to the screen).
// html/title are our own static copy, never anything a visitor typed.
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
.coach { position: fixed; z-index: 9999; display: flex; align-items: center; gap: 12px; max-width: min(380px, calc(100vw - 24px));
  padding: 12px 12px 12px 16px; border-radius: 24px; background: #0d0d0d; color: #9a9a9a;
  font: 500 13.5px/1.35 'Bricolage Grotesque', system-ui, sans-serif; box-shadow: 0 10px 34px rgba(0,0,0,.42), 0 0 0 1px rgba(255,255,255,.06);
  pointer-events: auto; animation: coach-in .28s cubic-bezier(.2,.9,.3,1.2); }
.coach__ico { flex: none; width: 22px; height: 22px; color: #f5c518; }
.coach__body { flex: 1; min-width: 0; }
.coach__t { margin: 0 0 2px; color: #fff; font-weight: 800; font-size: 15px; line-height: 1.25; }
.coach__s { margin: 0; }
.coach b { color: #fff; font-weight: 800; }
.coach kbd { display: inline-block; padding: 0 5px; border-radius: 5px; background: #262626; color: #fff; font: 700 12px/1.5 'Spline Sans Mono', monospace; }
.coach__x { position: relative; flex: none; width: 30px; height: 30px; border: 0; border-radius: 50%; background: #1f1f1f; color: #cfcfcf; cursor: pointer; padding: 0; }
.coach__x:hover { color: #fff; background: #2a2a2a; }
.coach__x svg { position: absolute; inset: 0; width: 30px; height: 30px; transform: rotate(-90deg); }
.coach__x circle { fill: none; stroke: #6b6b6b; stroke-width: 1.5; stroke-dasharray: 88; stroke-dashoffset: 0; animation: coach-ring var(--ms, 14s) linear forwards; }
.coach__x span { position: relative; font: 600 13px/30px system-ui; }
.coach__tip { position: absolute; width: 12px; height: 12px; background: #0d0d0d; transform: rotate(45deg); }
.coach[data-place="top"] .coach__tip { bottom: -5px; }
.coach[data-place="bottom"] .coach__tip { top: -5px; }
.coach[data-place="dock"] .coach__tip { display: none; }
.coach__act { margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.coach__btn { border: 0; border-radius: 999px; padding: 6px 12px; background: #fff; color: #0d0d0d; font: 700 12.5px/1 'Bricolage Grotesque', system-ui; cursor: pointer; }
.coach__heard { color: #fff; font-style: italic; }
@keyframes coach-in { from { opacity: 0; transform: translateY(8px) scale(.97); } }
@keyframes coach-ring { to { stroke-dashoffset: 88; } }
@media (prefers-reduced-motion: reduce) { .coach { animation: none; } .coach__x circle { animation: none; } }`;
  document.head.append(s);
}

const WARN = '<svg class="coach__ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.8c.6 0 1.1.3 1.4.8l8.6 15.2c.6 1.1-.2 2.4-1.4 2.4H3.4c-1.2 0-2-1.3-1.4-2.4L10.6 3.6c.3-.5.8-.8 1.4-.8z"/><path fill="#0d0d0d" d="M11 9h2v6h-2zM11 16.5h2v2h-2z"/></svg>';

function place() {
  if (!cur) return;
  const { el, anchor } = cur;
  if (anchor === 'dock') {
    const pill = document.querySelector('.vpill');
    const pr = pill?.getBoundingClientRect();
    el.dataset.place = 'dock';
    el.style.right = '16px';
    el.style.left = 'auto';
    el.style.top = 'auto';
    el.style.bottom = (pr && pr.height ? innerHeight - pr.top + 10 : 84) + 'px';
    cur.raf = requestAnimationFrame(place);
    return;
  }
  if (!anchor.isConnected || anchor.offsetParent === null && getComputedStyle(anchor).position !== 'fixed') { hide(); return; }
  const r = anchor.getBoundingClientRect(), b = el.getBoundingClientRect();
  let where = cur.place;
  if (where === 'top' && r.top - b.height - 14 < 4) where = 'bottom';
  if (where === 'bottom' && r.bottom + b.height + 14 > innerHeight - 4) where = 'top';
  const x = Math.max(12, Math.min(innerWidth - b.width - 12, r.left + r.width / 2 - b.width / 2));
  const y = where === 'top' ? r.top - b.height - 12 : r.bottom + 12;
  el.dataset.place = where;
  const page = !cur.follow; // on the page, not the screen: scrolls with it
  el.style.position = page ? 'absolute' : '';
  el.style.left = x + (page ? scrollX : 0) + 'px'; el.style.top = Math.max(4, y) + (page ? scrollY : 0) + 'px';
  el.querySelector('.coach__tip').style.left = Math.max(16, Math.min(b.width - 28, r.left + r.width / 2 - x - 6)) + 'px';
  if (!page) cur.raf = requestAnimationFrame(place);
}

function hide() {
  if (!cur) return;
  cancelAnimationFrame(cur.raf); clearTimeout(cur.timer);
  cur.el.remove();
  cur.onClose?.();
  cur = null;
}

export const coach = {
  // false if it was already seen (or another tip is up), so callers can skip follow-ups
  show(id, anchor, html, { place: where = 'top', ms = 14000, title = '', once = true, replace = false, follow = true, onClose } = {}) {
    if (!anchor || (once && seen(id) && !force)) return false;
    if (cur && !(replace || cur.id === id)) return false;
    if (cur) hide();
    style();
    const el = document.createElement('div');
    el.className = 'coach';
    el.setAttribute('role', 'status');
    el.style.setProperty('--ms', ms + 'ms');
    el.innerHTML = `<span class="coach__tip" aria-hidden="true"></span>${WARN}<div class="coach__body">${title ? `<p class="coach__t">${title}</p>` : ''}<div class="coach__s">${html}</div></div>`
      + '<button class="coach__x" type="button" aria-label="Got it"><svg viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="14"/></svg><span aria-hidden="true">✕</span></button>';
    el.querySelector('.coach__x').onclick = () => coach.done(id);
    document.body.append(el);
    if (once) mark(id);
    cur = { id, el, anchor, place: where, follow, raf: 0, timer: setTimeout(hide, ms), onClose };
    place();
    return el;
  },
  done(id) { if (cur && (!id || cur.id === id)) hide(); else if (id) mark(id); },
  get current() { return cur?.id || null; },
  seen,
};
