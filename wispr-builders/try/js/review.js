// Wispr Review, in the browser, reviewing this page. Point at anything, hold Flow and talk: the words land in the
// "point and talk" pill, the element locks, and the note saves itself ~2 s after you stop (Enter saves now, Esc drops).
// "Send to Claude" builds the exact prompt the extension copies (vendor/untrusted.js is the real file).
import { notify } from './card.js';

const SITE = location.host || 'file';
const notes = [];
let on = false, locked = null, hover = null, saveT = 0, root, pill, ta, hl, pins, dock, walkI = -1;
const touch = matchMedia('(hover: none)').matches;

// the extension's selector builder (content.js `selector`), short and stable
function selector(el) {
  if (el.id && /^[a-z][\w-]*$/i.test(el.id)) return '#' + el.id;
  const parts = [];
  for (let e = el; e && e !== document.body && parts.length < 5; e = e.parentElement) {
    if (e.id && /^[a-z][\w-]*$/i.test(e.id)) { parts.unshift('#' + e.id); break; }
    let s = e.tagName.toLowerCase();
    const cls = [...e.classList].filter((c) => /^[a-z][\w-]*$/i.test(c) && !/^is-/.test(c)).slice(0, 2);
    if (cls.length) s += '.' + cls.join('.');
    const sib = e.parentElement ? [...e.parentElement.children].filter((x) => x.tagName === e.tagName) : [];
    if (sib.length > 1) s += `:nth-of-type(${sib.indexOf(e) + 1})`;
    parts.unshift(s);
  }
  return parts.join(' > ');
}
const label = (el) => (el.getAttribute('aria-label') || el.alt || el.innerText || el.value || el.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 140);
function heading(el) {
  for (let e = el; e; e = e.parentElement) {
    const h = e.matches?.('h1,h2,h3') ? e : e.querySelector?.(':scope > h1, :scope > h2, :scope > h3, :scope > header h2');
    if (h && h.innerText) return h.innerText.trim().slice(0, 80);
  }
  return document.title;
}
const ours = (el) => !el || el.closest('.rv-ui, .wb, .wb-toasts, .t-dialog, .t-top, .t-mini');
function pickable(el) {
  // prefer a meaningful element over a bare text wrapper
  while (el && el !== document.body && !el.matches('button, a, img, input, h1, h2, h3, h4, p, li, label, [class*="price"], [class*="card"], [data-rv]') && el.parentElement && el.getBoundingClientRect().width < 24) el = el.parentElement;
  return el && el !== document.body && el !== document.documentElement ? el : null;
}

function box(el, cls) {
  const r = el.getBoundingClientRect();
  Object.assign(hl.style, { display: 'block', left: r.left + scrollX - 3 + 'px', top: r.top + scrollY - 3 + 'px', width: r.width + 6 + 'px', height: r.height + 6 + 'px' });
  hl.className = 'rv-ui rv-hl ' + cls;
}

function build() {
  root = document.createElement('div'); root.className = 'rv-ui rv-root';
  root.innerHTML = `
    <div class="rv-ui rv-hl"></div><div class="rv-ui rv-pins"></div>
    <div class="rv-ui rv-pill" role="group" aria-label="Wispr Review note">
      <div class="rv-pill__top"><span class="rv-dot"></span><b>Point and talk</b><span class="rv-pill__k">Hold <kbd class="w-kbd">fn</kbd> and speak</span></div>
      <textarea rows="2" aria-label="Your note" placeholder="${touch ? 'Tap something, then say or type the note' : 'Point at something, then say the note'}"></textarea>
      <div class="rv-pill__foot"><span><kbd class="w-kbd">return</kbd> saves</span><span><kbd class="w-kbd">esc</kbd> drops</span></div>
    </div>
    <div class="rv-ui rv-dock" role="toolbar" aria-label="Wispr Review">
      <span class="rv-dock__name">Wispr Review</span>
      <button type="button" data-a="mode" class="is-on">Voice</button>
      <button type="button" data-a="walk">Walk <span class="n">0</span></button>
      <button type="button" data-a="claude" class="primary">Send to Claude</button>
      <button type="button" data-a="md">.md</button>
      <button type="button" data-a="off" aria-label="Turn review off">×</button>
    </div>`;
  document.body.append(root);
  hl = root.querySelector('.rv-hl'); pins = root.querySelector('.rv-pins'); pill = root.querySelector('.rv-pill'); ta = pill.querySelector('textarea'); dock = root.querySelector('.rv-dock');
  // like content.js: while review mode is on, the note box keeps focus so Flow always has somewhere to type
  ta.addEventListener('blur', () => setTimeout(() => { if (on && !paused && !document.querySelector('.t-dialog:not([hidden]), .wb') && !/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName)) ta.focus({ preventScroll: true }); }, 0));
  addEventListener('focus', () => { if (on && !paused) ta.focus({ preventScroll: true }); });
  ta.addEventListener('input', () => {
    if (!ta.value.trim()) return;
    if (!locked && hover) { locked = hover; box(locked, 'is-locked'); }
    clearTimeout(saveT); saveT = setTimeout(save, 2000);
  });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
    else if (e.key === 'Escape') { e.preventDefault(); if (ta.value || locked) drop(); else setMode(false); }
  });
  dock.addEventListener('click', (e) => {
    const a = e.target.closest('button')?.dataset.a; if (!a) return;
    if (a === 'mode') setMode(!dock.querySelector('[data-a=mode]').classList.contains('is-on') ? true : 'paused');
    if (a === 'walk') walk();
    if (a === 'claude') exportNotes();
    if (a === 'md') download();
    if (a === 'off') setMode(false);
  });
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('click', onClick, true);
  addEventListener('scroll', () => { renderPins(); if (locked) box(locked, 'is-locked'); }, { passive: true });
  addEventListener('resize', renderPins);
}

let paused = false;
function onMove(e) {
  if (!on || paused) return;
  if (!touch) { pill.style.left = Math.min(innerWidth - 300, e.clientX + 18) + 'px'; pill.style.top = Math.min(innerHeight - 130, e.clientY + 18) + 'px'; }
  if (locked) return;
  const el = pickable(document.elementFromPoint(e.clientX, e.clientY));
  if (!el || ours(el)) { if (!ours(el)) hl.style.display = 'none'; return; }
  hover = el; box(el, '');
  if (document.activeElement !== ta) ta.focus({ preventScroll: true });
}
function onClick(e) {
  if (!on || paused || ours(e.target)) return;
  // a click locks the element (the extension's Option-click) instead of pressing it
  e.preventDefault(); e.stopPropagation();
  const el = pickable(e.target); if (!el) return;
  locked = el; hover = el; box(el, 'is-locked'); ta.focus({ preventScroll: true });
}

function setMode(v) {
  if (!root) build();
  if (v === 'paused') { paused = true; dock.querySelector('[data-a=mode]').classList.remove('is-on'); pill.hidden = true; hl.style.display = 'none'; return; }
  paused = false;
  on = !!v; document.documentElement.classList.toggle('rv-on', on);
  root.hidden = !on && !notes.length; pill.hidden = !on; dock.querySelector('[data-a=mode]').classList.toggle('is-on', on);
  if (!on) { drop(); hl.style.display = 'none'; dock.hidden = !notes.length; if (!notes.length) root.hidden = true; }
  else { dock.hidden = false; if (touch) { pill.classList.add('is-docked'); const s = document.querySelector('.t-site'); if (s) { const r = s.getBoundingClientRect(); scrollBy({ top: r.top - 80, behavior: 'smooth' }); } } ta.focus({ preventScroll: true }); }
  renderPins();
}
function drop() { clearTimeout(saveT); ta.value = ''; locked = null; hl.style.display = 'none'; }
function save() {
  clearTimeout(saveT);
  const text = ta.value.trim(); const el = locked || hover;
  if (!text) return;
  if (!el) { notify('Point at something first, then talk.', { title: 'Wispr Review' }); return; }
  const r = el.getBoundingClientRect();
  const n = {
    id: 'wr' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    n: notes.length + 1, ts: Date.now(), status: 'open', site: SITE, url: location.href.replace(/[?#].*$/, '') + (location.search.includes('mod=') ? '?mod=review' : ''), page: location.pathname, title: document.title,
    text, selector: selector(el), element: { tag: el.tagName.toLowerCase(), text: label(el), section: heading(el) },
    rect: { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) },
    viewport: { w: innerWidth, h: innerHeight, scroll_y: Math.round(scrollY) }, via: 'voice', shot: null, el,
  };
  notes.push(n);
  ta.value = ''; locked = null; hl.style.display = 'none';
  notify(`Note ${n.n} pinned`, { title: 'Wispr Review', ttl: 2.5 });
  renderPins(); onChange();
}
function renderPins() {
  if (!pins) return;
  dock.querySelector('.n').textContent = notes.length;
  pins.innerHTML = '';
  for (const n of notes) {
    const el = n.el?.isConnected ? n.el : document.querySelector(n.selector);
    if (!el) continue;
    const r = el.getBoundingClientRect(); if (!r.width && !r.height) continue;
    const p = document.createElement('button'); p.type = 'button'; p.className = 'rv-ui rv-pin' + (walkI >= 0 && notes[walkI] === n ? ' is-walk' : '');
    p.textContent = n.n; p.title = n.text; p.style.left = Math.max(4, r.left + scrollX - 10) + 'px'; p.style.top = Math.max(4, r.top + scrollY - 10) + 'px';
    p.onclick = () => notify(n.text, { title: `Note ${n.n}`, ttl: 4 });
    pins.append(p);
  }
}
function walk() {
  if (!notes.length) return notify('No notes yet. Point at something and talk.', { title: 'Wispr Review' });
  walkI = (walkI + 1) % notes.length; const n = notes[walkI];
  const el = n.el?.isConnected ? n.el : document.querySelector(n.selector);
  if (el) { const r = el.getBoundingClientRect(); scrollBy({ top: r.top - innerHeight / 2 + r.height / 2, behavior: 'smooth' }); }
  setTimeout(() => { renderPins(); notify(n.text, { title: `Note ${n.n} of ${notes.length}`, ttl: 4 }); }, 350);
}
const slim = (n) => { const { el, ...rest } = n; return rest; };
function exportNotes() {
  if (!notes.length) return notify('No open notes on this site', { title: 'Wispr Review' });
  const list = notes.map(slim);
  const prompt = window.WRUntrusted.claudePrompt(list, { sinkUp: false });
  const md = window.WRUntrusted.markdown(list);
  const json = JSON.stringify(list.map((n) => window.WRUntrusted.cleanNote(n)), null, 2);
  navigator.clipboard?.writeText(prompt).catch(() => {});
  onExport({ prompt, md, json, count: list.length });
}
function download() {
  if (!notes.length) return notify('No notes on this site', { title: 'Wispr Review' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([window.WRUntrusted.markdown(notes.map(slim))], { type: 'text/markdown' }));
  a.download = `review-${SITE}-${new Date().toISOString().slice(0, 10)}.md`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 500);
  notify(`Downloaded ${notes.length} notes`, { title: 'Wispr Review' });
}

let onChange = () => {}, onExport = () => {};
export function initReview(opts) { onChange = opts.onChange || onChange; onExport = opts.onExport || onExport; }
export function reviewOn(v = true) { setMode(v); }
export const reviewState = () => ({ on, count: notes.length });
export function reviewFocus() { if (on && !paused && ta) ta.focus({ preventScroll: true }); }
export function runReview(args, ui) {
  ui.route({ intent: 'review.note', args, mod: 'Wispr Review' });
  if (args.export) return exportNotes();
  setMode(args.mode !== 'off');
  if (args.mode !== 'off') notify(touch ? 'Review mode is on. Tap anything on this page, then say the note.' : 'Review mode is on. Point at anything on this page, hold fn and say the note.', { title: 'Wispr Review', ttl: 4 });
}
