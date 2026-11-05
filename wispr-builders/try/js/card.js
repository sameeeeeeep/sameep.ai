// A browser replica of Wispr Bridge's card (wispr-bridge/helper/wb-card.swift): numbered rows or image tiles,
// a text box Flow types into ("two", "the second one", "1 but shorter"), digits, arrows, esc, drag.
// present(spec) resolves with the same result JSON the real card prints.
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---- pick parsing, ported 1:1 from wb-card.swift
const NUM = { one: 1, won: 1, first: 1, '1st': 1, two: 2, to: 2, too: 2, second: 2, '2nd': 2, three: 3, third: 3, '3rd': 3, tree: 3,
  four: 4, for: 4, fourth: 4, '4th': 4, five: 5, fifth: 5, six: 6, sixth: 6, seven: 7, seventh: 7, eight: 8, eighth: 8, nine: 9, ninth: 9 };
const FILL = new Set(['the', 'one', 'option', 'number', 'no', 'pick', 'choose', 'i', 'want', 'lets', "let's", 'go', 'with', 'please', 'and', 'a',
  'that', 'it', 'is', 'take', 'use', 'select', 'ones', 'both', 'done', 'ok', 'okay']);
const words = (s) => String(s).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
export function leadingPick(s, count) {
  const t = String(s).trim();
  const map = { one: 1, first: 1, two: 2, second: 2, three: 3, third: 3, four: 4, fourth: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
  let head = '', rest = t;
  if (/^\d/.test(t)) { head = t[0]; rest = t.slice(1); } else { const w = t.split(/[^A-Za-z]/)[0]; if (w && map[w.toLowerCase()]) { head = w; rest = t.slice(w.length); } }
  const n = Number(head) || map[head.toLowerCase()] || 0;
  const note = rest.replace(/^[\s,.:;\-—]+|[\s,.:;\-—]+$/g, '');
  if (!(n >= 1 && n <= count) || !note || !rest[0] || /[A-Za-z0-9]/.test(rest[0])) return null;
  return [n, note];
}
export function parsePicks(s, count) {
  const ws = words(s); if (!ws.length) return null;
  const picks = [];
  for (const w of ws) {
    const d = /^\d+$/.test(w) ? Number(w) : null;
    if (d && d >= 1 && d <= count) picks.push(d);
    else if (NUM[w] && NUM[w] <= count && !(w === 'one' && picks.length) && !(['to', 'for', 'too'].includes(w) && ws.length > 2)) picks.push(NUM[w]);
    else if (!FILL.has(w)) return null;
  }
  const u = [...new Set(picks)];
  return u.length ? u : null;
}
function matchLabel(s, opts) {
  const ws = words(s).filter((w) => !FILL.has(w)); if (!ws.length) return null;
  const hits = opts.map((o, i) => [i, words(o.label + ' ' + (o.detail || ''))]).filter(([, l]) => ws.every((w) => l.some((x) => x.startsWith(w))));
  return hits.length === 1 ? hits[0][0] + 1 : null;
}

// ---- where cards live: one "screen" element per demo; cards sit at its top centre, like the real one at the notch
let layer = null;
// scroll only this document (scrollIntoView would also scroll the Pack 1 page when this runs in its sheet)
export function reveal(el, pad = 16) {
  if (!el?.isConnected) return;
  const r = el.getBoundingClientRect(), top = 72;
  if (r.top < top) scrollBy({ top: r.top - top - pad, behavior: 'smooth' });
  else if (r.bottom > innerHeight) scrollBy({ top: Math.min(r.bottom - innerHeight + pad, r.top - top - pad), behavior: 'smooth' });
}
export function setLayer(el) { layer = el; }
let open = null; // one card at a time, as on the Mac
export const cardOpen = () => !!open;
export function closeCard() { if (open) open.cancel('replaced'); }

export const TOUCH = matchMedia('(hover: none)').matches;
const HOLD = TOUCH ? '<span class="wb-hold">Speak with the Flow keyboard</span>' : '<span class="wb-hold">Hold <kbd class="w-kbd">fn</kbd> and speak</span>';

export function present(spec) {
  if (open) open.cancel('replaced');
  return new Promise((resolve) => {
    const opts = (spec.options || []).slice(0, 9);
    const grid = opts.length > 0 && opts.every((o) => o.image);
    const multi = !!spec.multi;
    let sel = Math.max(0, Math.min((spec.recommended || 1) - 1, opts.length - 1));
    const chosen = new Set();
    const born = Date.now();
    const el = document.createElement('div');
    el.className = 'wb' + (grid ? ' wb--grid' : '') + (grid && opts.length < 3 ? ' wb--few' : '');
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', spec.title || 'Pick one');
    el.innerHTML = `
      <div class="wb__head"><span class="wb__lock">Wispr Bridge</span>${multi ? '<span class="wb__any">Pick any</span>' : ''}</div>
      <div class="wb__tt"><div class="wb__t">${esc(spec.title || 'Pick one')}</div>${spec.subtitle ? `<div class="wb__s">${esc(spec.subtitle)}</div>` : ''}</div>
      <div class="wb__opts" role="listbox" aria-label="Options">${opts.map((o, i) => grid ? `
        <button class="wb__tile" type="button" role="option" data-i="${i}"><span class="wb__img"><img src="${esc(o.image)}" alt="" draggable="false"><span class="wb__n">${i + 1}</span></span>
          <span class="wb__l">${esc(o.label)}</span>${o.detail ? `<span class="wb__d">${esc(o.detail)}</span>` : ''}</button>` : `
        <button class="wb__row" type="button" role="option" data-i="${i}"><span class="wb__n">${i + 1}</span>${o.image ? `<img class="wb__ico" src="${esc(o.image)}" alt="">` : ''}
          <span class="wb__rt"><span class="wb__l">${esc(o.label)}</span>${o.detail ? `<span class="wb__d">${esc(o.detail)}</span>` : ''}</span></button>`).join('')}</div>
      <input class="wb__in" type="text" autocomplete="off" spellcheck="false" aria-label="Your answer" placeholder="${TOUCH ? (multi ? 'Tap the ones to keep, then Done' : 'Tap one, or type a note') : (multi ? 'Click the ones to keep, then press return' : 'Click one, or press its number')}">
      <div class="wb__foot">${HOLD}${opts.length ? `<span class="wb-hint"><kbd class="w-kbd">${multi ? '1 3 ↵' : '1–' + Math.max(1, opts.length)}</kbd> to pick</span>` : ''}<span class="wb__sp"></span>
        <button class="w-btn w-btn--ghost wb__no" type="button">Not now</button>${multi ? '<button class="w-btn w-btn--primary wb__done" type="button">Done</button>' : ''}</div>`;
    const input = el.querySelector('.wb__in');
    const items = [...el.querySelectorAll('[data-i]')];
    const paint = () => items.forEach((b, i) => { const on = multi ? chosen.has(i) : i === sel; b.classList.toggle('is-on', on); b.classList.toggle('is-sel', i === sel); b.setAttribute('aria-selected', on); });
    let done = false, typedTimer = 0, digitTimer = 0, prev = '';
    const emit = (r) => {
      if (done) return; done = true; open = null;
      clearTimeout(typedTimer); clearTimeout(digitTimer);
      document.removeEventListener('keydown', onDocKey, true);
      el.classList.add('is-out'); setTimeout(() => el.remove(), 140);
      resolve(r);
    };
    const finish = (idx) => {
      if (multi) { const s = [...idx].sort((a, b) => a - b); return emit({ picks: s.map((i) => i + 1), labels: s.map((i) => opts[i].label) }); }
      emit({ pick: idx[0] + 1, label: opts[idx[0]].label });
    };
    const tap = (i) => {
      if (multi) { chosen.has(i) ? chosen.delete(i) : chosen.add(i); sel = i; paint(); return; }
      sel = i; paint(); items[i]?.classList.add('is-flash'); setTimeout(() => finish([i]), 120);
    };
    const submit = () => {
      if (Date.now() - born < 800) { input.value = ''; prev = ''; return; } // an Enter meant for the previous field
      const t = input.value.trim();
      if (t) {
        const lp = !multi && leadingPick(t, opts.length);
        if (lp) return emit({ pick: lp[0], label: opts[lp[0] - 1].label, note: lp[1] });
        const ps = parsePicks(t, opts.length);
        if (ps) return multi ? finish(ps.map((p) => p - 1)) : finish([ps[0] - 1]);
        const m = !multi && matchLabel(t, opts);
        if (m) return finish([m - 1]);
        if (multi && words(t).every((w) => ['done', 'ok', 'okay', "that's", 'thats', 'it', 'all'].includes(w)) && (chosen.size || /\ball\b/.test(t))) return finish(/\ball\b/.test(t) ? opts.map((_, i) => i) : [...chosen]);
        return emit({ text: t });
      }
      if (!opts.length) return emit({ cancelled: true, reason: 'empty' });
      multi ? finish(chosen.size ? [...chosen] : [sel]) : finish([sel]);
    };
    input.addEventListener('input', () => {
      const snap = input.value; const was = prev; prev = snap;
      clearTimeout(digitTimer);
      // a single digit typed by hand into the empty box: pick after a beat unless more is typed ("1 but shorter")
      if (!multi && was === '' && /^[1-9]$/.test(snap) && Number(snap) <= opts.length) {
        digitTimer = setTimeout(() => { if (input.value === snap) { input.value = ''; prev = ''; tap(Number(snap) - 1); } }, 700);
        return;
      }
      // Wispr pastes the whole utterance at once: if it is exactly a choice ("two."), pick after a beat
      if (multi || was !== '' || snap.length < 2) return;
      const ps = parsePicks(snap, opts.length);
      if (ps && ps.length === 1) typedTimer = setTimeout(() => { if (input.value === snap) tap(ps[0] - 1); }, 450);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); submit(); }
      else if (e.key === 'Escape') { e.preventDefault(); emit({ cancelled: true, reason: 'esc' }); }
      else if ((e.key === 'ArrowDown' || e.key === 'ArrowRight') && !input.value) { e.preventDefault(); sel = (sel + 1) % opts.length; paint(); }
      else if ((e.key === 'ArrowUp' || e.key === 'ArrowLeft') && !input.value) { e.preventDefault(); sel = (sel - 1 + opts.length) % opts.length; paint(); }
    });
    // keys while focus is elsewhere on the page (a button inside the card, the page body)
    const onDocKey = (e) => {
      if (e.target === input || !el.isConnected) return;
      const inField = /^(INPUT|TEXTAREA)$/.test(e.target.tagName) || e.target.isContentEditable;
      if (e.key === 'Escape') { e.preventDefault(); emit({ cancelled: true, reason: 'esc' }); }
      else if (!inField && /^[1-9]$/.test(e.key) && Number(e.key) <= opts.length) { e.preventDefault(); tap(Number(e.key) - 1); }
    };
    document.addEventListener('keydown', onDocKey, true);
    items.forEach((b) => b.addEventListener('click', () => tap(Number(b.dataset.i))));
    el.querySelector('.wb__no').addEventListener('click', () => emit({ cancelled: true, reason: 'dismissed' }));
    el.querySelector('.wb__done')?.addEventListener('click', () => finish(chosen.size ? [...chosen] : [sel]));
    // drag anywhere on the background
    let drag = null, dx = 0, dy = 0;
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button, input, a')) return;
      drag = { x: e.clientX - dx, y: e.clientY - dy }; el.setPointerCapture(e.pointerId); el.classList.add('is-drag');
    });
    el.addEventListener('pointermove', (e) => { if (!drag) return; dx = e.clientX - drag.x; dy = e.clientY - drag.y; el.style.translate = `${dx}px ${dy}px`; });
    const end = () => { drag = null; el.classList.remove('is-drag'); };
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    el.addEventListener('pointerenter', () => { if (document.activeElement !== input && !document.activeElement?.closest?.('.wb')) input.focus({ preventScroll: true }); });

    paint();
    (layer || document.body).append(el);
    requestAnimationFrame(() => el.classList.add('is-in'));
    input.focus({ preventScroll: true });
    setTimeout(() => reveal(el), 30);
    open = { cancel: (reason) => emit({ cancelled: true, reason }) };
  });
}

// toast card: never steals focus, auto-dismisses
export function notify(text, { title = 'Wispr Bridge', ttl = 3.5, action } = {}) {
  const host = layer || document.body;
  let box = host.querySelector('.wb-toasts');
  if (!box) { box = document.createElement('div'); box.className = 'wb-toasts'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite'); host.append(box); }
  const t = document.createElement('div');
  t.className = 'wb-toast';
  t.innerHTML = `<i></i><div><b>${esc(title)}</b><span>${esc(text)}</span></div><button type="button" aria-label="Dismiss">×</button>`;
  if (action) { const a = document.createElement('button'); a.type = 'button'; a.className = 'w-btn w-btn--outline wb-toast__a'; a.textContent = action.label; a.onclick = () => { action.run(); t.remove(); }; t.querySelector('div').append(a); }
  t.querySelector('button[aria-label]').onclick = () => t.remove();
  box.append(t);
  requestAnimationFrame(() => t.classList.add('is-in'));
  setTimeout(() => { t.classList.remove('is-in'); setTimeout(() => t.remove(), 200); }, ttl * 1000);
}
