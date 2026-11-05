// guide.js — the one guide engine for sameep.ai. The desktop, the podcast, every window and the
// standalone pages (Growth OS, Wispr Wrapped, the project pages) all run their guides through here,
// in one look: a ghost Mac arrow (desktop, when motion is fine) and a caption card in Wispr Flow's style.
//
// The rules, everywhere:
//  · it never moves on a timer: Next, Space, Enter, → (or saying “next”) moves on; ← or “back” goes back
//  · Skip, Esc or “skip” ends it from any step; the last step says so and leaves them alone
//  · a step pointing at something with a hover card shows that card inside the caption (one popup, never two)
//  · each module's guide plays once, the first time it opens (remembered per browser), and replays from
//    its “?” or by voice: hold Flow and say “show me around”
//
//   defineGuide(id, { steps, area, here, cardFor, onStart, onEnd, label })
//   firstOpen(id)   play it if it has never played here (and no other guide is up)
//   play(id)        play it now;  playHere()  the guide for whatever is in front
//   runGuide(opts)  the engine itself, for one-off guides
import { h, clamp, isNarrow, reducedMotion } from '../app/util.js';
import { track } from '../analytics.js';

const KEY = 'sameep.guides';
const ARROW = '<svg viewBox="0 0 12 19" width="18" height="28" aria-hidden="true"><path d="M1 1v15l3.6-3.4 2.6 5.6 2.4-1.1-2.6-5.5H12L1 1z" fill="#111" stroke="#fff" stroke-width="1.1" stroke-linejoin="round"/></svg>';
const GLIDE = 900;

// ---------------------------------------------------------------- once per visitor
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };
let memo = read();  // storage blocked: remembered for this tab only
export const seen = (id) => !!memo[id];
export function markSeen(id) { memo = { ...read(), ...memo, [id]: Date.now() }; try { localStorage.setItem(KEY, JSON.stringify(memo)); } catch { /* this tab only */ } }
// ?guides resets them all (for testing a first visit on a browser that has seen them)
if (new URLSearchParams(location.search).has('guides')) { memo = {}; try { localStorage.removeItem(KEY); } catch { /* fine */ } }

// ---------------------------------------------------------------- the registry
const mods = new Map();
let current = null;                                                  // one guide at a time
export const guideOn = () => !!current?.active;
export const endGuide = () => current?.end();
export const activeGuide = () => (current?.active ? current : null);
export function defineGuide(id, def) { mods.set(id, { id, ...def }); installVoice(); return id; }
export const hasGuide = (id) => mods.has(id);

export function play(id, extra = {}) {
  const m = mods.get(id);
  if (!m) return null;
  const g = runGuide({ ...m, ...extra, id });
  if (g) markSeen(id);  // only once it has really started: a guide with nothing to point at isn't spent
  return g;
}
export function firstOpen(id, extra) {
  if (seen(id) || guideOn() || !mods.has(id)) return null;
  return play(id, extra);
}
// the guide for what's in front: the module whose here() answers, highest rank first
export function playHere() {
  const list = [...mods.values()].filter((m) => m.here).map((m) => ({ m, r: m.here() })).filter((x) => x.r);
  list.sort((a, b) => (+b.r || 1) - (+a.r || 1));
  const pick = list[0]?.m || mods.get('desktop');
  return pick ? play(pick.id) : null;
}

// ---------------------------------------------------------------- voice and keys
// Wispr Flow types into whatever has focus, or pastes when nothing editable does: both are caught here,
// before the page's own handlers, so “show me around” works on any screen and “next” works mid-guide
const norm = (s) => String(s || '').toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ').trim();
const HELP = /^(?:hey |ok |okay )?(?:can you |please )?(?:show me around|show me round|give me a tour|take me around|guide me|walk me through (?:this|it)|how does this work)(?: please)?$/;
const NEXT = /^(?:next|next one|next step|continue|go on|carry on|okay next|ok next|got it)(?: please)?$/;
const BACK = /^(?:back|go back|previous|last one)(?: please)?$/;
const SKIP = /^(?:skip|skip it|skip the guide|stop|done|close|exit|end|that's enough|no thanks|i'm good)(?: please)?$/;
const OPEN = /^(?:open|open it|open that|yes|yes please|sure|let's go|let's see it)(?: please)?$/;
export function voiceCommand(text) {
  const t = norm(text);
  if (!t || t.length > 40) return false;
  const g = activeGuide();
  if (g) {
    if (NEXT.test(t)) { g.next(); return true; }
    if (BACK.test(t)) { g.back(); return true; }
    if (SKIP.test(t)) { g.end(); return true; }
    if (OPEN.test(t) && g.action()) return true;
    if (HELP.test(t)) return true;                                   // already showing you around
    return false;
  }
  if (HELP.test(t)) { playHere(); return true; }
  return false;
}
let voiceOn = false;
function installVoice() {
  if (voiceOn) return;
  voiceOn = true;
  const editable = (t) => t?.matches?.('input, textarea, [contenteditable=""], [contenteditable="true"]');
  addEventListener('paste', (e) => {
    const text = e.clipboardData?.getData('text/plain') || '';
    if (voiceCommand(text)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  // dictated into a field (the podcast's “say” bar, a search box): the whole value is the command, but only
  // when it arrived in one go (a dictation or a paste), never mid-typing: “endless” is not “end”
  addEventListener('input', (e) => {
    const t = e.target;
    if (!editable(t) || !('value' in t)) return;
    const whole = !e.inputType || /^insert(FromPaste|FromDrop|ReplacementText|FromDictation)$/.test(e.inputType) || (e.data || '') === t.value;
    if (whole && t.value.trim().length > 2 && voiceCommand(t.value)) { t.value = ''; e.stopImmediatePropagation(); }
  }, true);
  // typed with nothing editable focused: a short rolling buffer, read on Enter (or as soon as it says
  // “show me around”); while it's filling, Space is a space, not Next
  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || editable(e.target)) return;
    if (e.key === 'Enter' && typing()) { const b = buf; buf = ''; if (voiceCommand(b)) { e.preventDefault(); e.stopImmediatePropagation(); } return; }
    if (e.key.length !== 1 || (e.key === ' ' && !typing())) return;
    const now = performance.now();
    if (now - last > 1500) buf = '';
    last = now; buf = (buf + e.key).slice(-40);
    if (!activeGuide() && HELP.test(norm(buf))) { buf = ''; playHere(); }
  }, true);
}
let buf = '', last = 0;
const typing = () => !!buf.trim() && performance.now() - last < 1500;

// the Wispr Flow pill, mocked: hold your key and talk
export const flowPill = (say = 'Hold your Flow key, say where to go') => h('div.gtour__pill', h('span.gtour__wave', { 'aria-hidden': 'true' }, Array.from({ length: 9 }, (_, i) => h('i', { style: { animationDelay: `${(i * 97) % 600}ms` } }))), h('span', say));

// a “?” that replays a guide: in a window's title bar, or floating on a standalone page
export function helpButton(id, { floating = false, label = 'Show me around' } = {}) {
  return h(floating ? 'button.gtour-help.is-floating' : 'button.gtour-help', { type: 'button', 'aria-label': label, title: `${label} (or hold Flow and say “show me around”)`, onclick: (e) => { e.stopPropagation(); play(id); } }, '?');
}

// ---------------------------------------------------------------- one tiny feedback card, once
// "How was that?" with three taps and an optional line (dictate it with Flow, or type). It sits in a corner,
// never over what they're doing, closes with ×, Esc or a tap, and never comes back. Logged with track()
// (event "feedback", seen in the admin). Returns false if it has already been asked here.
export function askFeedback({ area = document.body, where = 'site' } = {}) {
  if (seen('feedback') || guideOn() || document.querySelector('.gfeed')) return false;
  markSeen('feedback');
  const fixed = area === document.body;
  let rate = null;
  const close = () => { card.classList.remove('is-on'); removeEventListener('keydown', onKey, true); setTimeout(() => card.remove(), 300); };
  const onKey = (e) => { if (e.key === 'Escape' && card.isConnected) { e.stopImmediatePropagation(); close(); } };
  const thanks = () => { body.replaceChildren(h('p.gtour__text', 'Thank you. Sameep reads every one.')); setTimeout(close, 2200); };
  const send = (extra = {}) => track('feedback', { where, rate, ...extra });
  const pick = (r) => { rate = r; send(); btns.querySelectorAll('button').forEach((b) => b.classList.toggle('is-primary', b.dataset.r === r)); say.hidden = false; say.querySelector('input').focus({ preventScroll: true }); };
  const btns = h('div.gfeed__btns', [['loved', 'Loved it'], ['good', 'Good'], ['meh', 'Not for me']].map(([r, t]) => h('button.gtour__btn', { type: 'button', dataset: { r }, onclick: () => pick(r) }, t)));
  const say = h('form.gfeed__say', { hidden: true, onsubmit: (e) => { e.preventDefault(); const t = e.target.elements.say.value.trim().slice(0, 500); if (t) send({ text: t }); thanks(); } },
    h('input', { name: 'say', type: 'text', maxlength: 500, placeholder: 'Anything else? Say it with Flow, or type', 'aria-label': 'Anything else' }),
    h('button.gtour__btn.is-primary', { type: 'submit' }, 'Send'));
  const body = h('div', h('p.gtour__text', 'How was that?'), btns, say, h('p.gtour__hint', 'One tap is plenty. Nothing else is asked.'));
  const card = h('div.gtour__cap.gfeed' + (fixed ? '.is-fixed' : ''), { role: 'dialog', 'aria-label': 'Quick feedback' },
    h('button.gfeed__x', { type: 'button', 'aria-label': 'Close', onclick: () => { if (!rate) track('feedback', { where, rate: 'dismissed' }); close(); } }, '×'), body);
  (fixed ? document.body : area).append(card);
  addEventListener('keydown', onKey, true);
  requestAnimationFrame(() => card.classList.add('is-on'));
  return true;
}

// ---------------------------------------------------------------- the engine
// steps: [{ at, say, card, action, extra, enter, leave, when, dx, dy }]
//   at      a selector or a function → the element to point at (none: the caption sits in the middle)
//   say     the line (string or function)
//   card    true: show the target's hover card inside the caption (needs cardFor)
//   action  { label, run(api) }: one primary button on that step (“Open Growth OS”)
//   enter   async, before the step: open what it needs; leave(): put it back
//   centre  true: if `at` isn't there, say it from the middle of the screen rather than skip the step
//   holder  a function → the window this guide is about: when it closes, the guide ends with it
//   layer   where the arrow and caption are drawn, when it isn't `area` (the desktop: over the menu bar too)
export function runGuide({ id = 'guide', steps, area = document.body, layer = null, cardFor, onStart, onEnd, label = 'Guide', start = null, holder = null, glide: wantGlide = true } = {}) {
  if (!document.getElementById('font-wispr')) document.head.append(h('link#font-wispr', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=EB+Garamond:wght@500&family=Figtree:wght@400;600&display=swap' }));
  const fixed = area === document.body || area === document.documentElement;
  const phone = isNarrow(), glide = wantGlide && !phone && !reducedMotion();
  // a target that isn't drawn (in a collapsed window, display:none) counts as missing
  const find = (at) => { const el = !at ? null : typeof at === 'function' ? at() : document.querySelector(at); return el && el.getClientRects().length ? el : null; };
  const usable = (s) => !s.at || s.enter || s.centre || !!find(s.at);
  const build = () => (typeof steps === 'function' ? steps() : steps).filter((s) => (!s.when || s.when()) && usable(s));
  if (!build().length) return null;  // nothing to show: leave whatever guide is up alone
  current?.end();
  let list = build();  // again: ending the last guide can close what it had opened
  if (!list.length) return null;
  const held = holder?.();
  if (holder && (!held || held.classList.contains('is-closing'))) return null;
  const mount = layer || area;

  const ghost = glide ? h('div.gtour__cursor', { 'aria-hidden': 'true' }) : null;
  if (ghost) ghost.innerHTML = ARROW;  // a fixed, local SVG string
  const text = h('p.gtour__text'), card = h('div.gtour__card'), extra = h('div.gtour__extra'), hint = h('p.gtour__hint'), count = h('span.gtour__n');
  const back = h('button.gtour__btn', { type: 'button', onclick: () => go(i - 1) }, 'Back');
  const next = h('button.gtour__btn.is-primary', { type: 'button', onclick: () => go(i + 1) }, 'Next');
  const skip = h('button.gtour__btn.is-text', { type: 'button', onclick: () => end() }, 'Skip');
  const act = h('button.gtour__btn.is-act', { type: 'button', hidden: true });
  // one primary per step: Next. “Start the show” is a quiet link until the last step, then it's the primary
  const startBtn = start ? h('button.gtour__btn.is-start', { type: 'button', onclick: () => { end(); start.run(); } }, start.label) : null;
  text.id = 'gtour-text-' + Math.random().toString(36).slice(2, 8);
  text.setAttribute('aria-live', 'polite');
  const cap = h('div.gtour__cap', { role: 'dialog', 'aria-label': label, 'aria-describedby': text.id },
    text, card, extra, h('div.gtour__row.gtour__row--act', act), hint,
    h('div.gtour__row', count, h('span.gtour__btns', skip, back, next)), startBtn && h('div.gtour__row.gtour__row--start', startBtn));
  if (fixed) { cap.classList.add('is-fixed'); ghost?.classList.add('is-fixed'); }
  (fixed ? document.body : mount).append(...[ghost, cap].filter(Boolean));

  let alive = true, i = -1, token = 0, lit = null, here = null, done, from = document.activeElement, watch = null;
  const finished = new Promise((r) => { done = r; });
  const A = () => (fixed ? { left: 0, top: 0, width: innerWidth, height: innerHeight } : mount.getBoundingClientRect());
  const box = (el) => { const a = A(), r = el.getBoundingClientRect(); return { x: r.left - a.left, y: r.top - a.top, w: r.width, h: r.height }; };
  const light = (el) => { lit?.classList.remove('is-tour-lit'); lit = el || null; lit?.classList.add('is-tour-lit'); };

  function placeCap(x, y, near) {
    const a = A(), cw = cap.offsetWidth, ch = cap.offsetHeight;
    let cx, cy;
    const G = 14;
    // never over the menu bar (the desktop draws the guide over it): cards start below it
    const T = 8 + (mount.querySelector?.(':scope > .menubar')?.offsetHeight || 0);
    if (!near) { cx = (a.width - cw) / 2; cy = ghost ? y + 30 : a.height * 0.3; }
    else if (!ghost) {  // no arrow (phones): under the thing, or over it, never on it
      cx = near.x + near.w / 2 - cw / 2;
      cy = near.y + near.h + 10;
      if (cy + ch > a.height - 8) cy = near.y - ch - 10;
      // a tall thing: the edge of the screen that covers the least of it
      if (cy < T) cy = near.y + near.h / 2 < a.height / 2 ? a.height - ch - 8 : T;
    } else if (near.x + near.w + G + cw <= a.width - 8) { cx = near.x + near.w + G; cy = clamp(y + 10, near.y, near.y + Math.max(0, near.h - 40)); }  // beside the thing, like a hover card
    else if (near.x - G - cw >= 8) { cx = near.x - G - cw; cy = clamp(y + 10, near.y, near.y + Math.max(0, near.h - 40)); }
    else if (near.y + near.h + G + ch <= a.height - 8) { cx = x - cw / 2; cy = near.y + near.h + G; }
    else if (near.y - G - ch >= T) { cx = x - cw / 2; cy = near.y - G - ch; }
    else { cx = x + 22; cy = y + 16; }  // it fills the screen: by the arrow
    cap.style.left = clamp(cx, 8, Math.max(8, a.width - cw - 8)) + 'px';
    cap.style.top = clamp(cy, T, Math.max(T, a.height - ch - 8)) + 'px';
  }
  function point(el, s, ms = GLIDE) {
    const a = A();
    const b = el ? box(el) : { x: a.width * 0.5, y: a.height * 0.36, w: 0, h: 0 };
    const x = b.x + b.w * (s?.dx ?? 0.5), y = b.y + b.h * (s?.dy ?? 0.5);
    if (ghost) { ghost.style.transitionDuration = ms + 'ms'; ghost.style.transform = `translate(${x}px, ${y}px)`; }
    placeCap(x, y, el ? b : null);
  }
  const reflow = () => { if (alive && i >= 0) point(here, list[i], 0); };

  function say(line) { text.textContent = line; }
  async function go(k) {
    if (!alive) return;
    const keep = cap.contains(document.activeElement);  // before anything in the caption changes
    const my = ++token;
    const was = list[i];
    try { was?.leave?.(); } catch (e) { console.warn('[guide]', e); }
    if (k < 0) k = 0;
    if (k >= list.length) return end(true);
    const dir = k < i ? -1 : 1;
    i = k;
    const s = list[k];
    count.textContent = `${k + 1} of ${list.length}`;
    back.disabled = k === 0;
    const last = k === list.length - 1;
    next.textContent = last ? 'Done' : 'Next';
    if (startBtn) { next.classList.toggle('is-primary', !last); startBtn.classList.toggle('is-last', last); startBtn.textContent = last ? start.label : `or ${start.label.charAt(0).toLowerCase() + start.label.slice(1)} →`; }
    hint.textContent = k === 0 ? (phone ? 'Tap Next.' : 'Next, Space, or say “next”. Esc skips.') : '';
    try { await s.enter?.(api); } catch (e) { console.warn('[guide]', e); }
    if (!alive || my !== token) return;
    const el = find(s.at);
    if (s.at && !el && !s.centre) { go(dir < 0 && k > 0 ? k - 1 : k + 1); return; }  // gone since: on past it (centre: true, the middle instead)
    here = el;
    if (el && !glide) el.scrollIntoView?.({ block: 'nearest' });
    if (el && fixed) { const r = el.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) el.scrollIntoView({ block: 'center' }); }
    light(el);
    say(typeof s.say === 'function' ? s.say(api) : s.say);
    const c = s.card && el && cardFor?.(el);
    card.replaceChildren(...(c ? [c] : []));
    cap.classList.toggle('has-card', !!c);
    extra.replaceChildren(...[s.extra?.()].filter(Boolean));
    act.hidden = !s.action;
    if (s.action) { act.textContent = s.action.label; act.onclick = () => s.action.run(api); }
    cap.classList.add('is-on');
    point(el, s);
    // a window still sliding in (a phone's bottom sheet): once it has landed, the caption follows it
    const was0 = el && JSON.stringify(box(el));
    setTimeout(() => { if (alive && my === token && here === el && el && JSON.stringify(box(el)) !== was0) point(el, s, 300); }, 520);
    // focus stays on Next, so Space always moves on; the action is a click, a Tab away, or “open it”
    if (keep || k === 0 || document.activeElement === document.body) next.focus({ preventScroll: true });
  }

  function end(complete, byKey) {
    if (!alive) return;
    // ended from a held key: its repeats mustn't fall through to the podcast or a game
    if (byKey) {
      const eat = (e) => { if (e.key === byKey && e.repeat) { e.preventDefault(); e.stopImmediatePropagation(); } };
      const up = (e) => { if (e.key === byKey) { removeEventListener('keydown', eat, true); removeEventListener('keyup', up, true); } };
      addEventListener('keydown', eat, true); addEventListener('keyup', up, true);
    }
    try { list[i]?.leave?.(); } catch (e) { console.warn('[guide]', e); }
    alive = false; token++;
    light(null);
    const hadFocus = cap.contains(document.activeElement);
    cap.classList.remove('is-on'); ghost?.classList.remove('is-on');
    setTimeout(() => { cap.remove(); ghost?.remove(); }, 300);
    watch?.disconnect();
    removeEventListener('keydown', onKey, true);
    removeEventListener('resize', reflow);
    removeEventListener('scroll', reflow, true);
    if (current === api) current = null;
    if (hadFocus && from?.isConnected && from !== document.body) from.focus?.({ preventScroll: true });
    try { onEnd?.(!!complete); } catch (e) { console.warn('[guide]', e); }
    done(!!complete);
  }
  // keys: Esc skips; Space, Enter or → moves on; ← goes back. A field with text in it keeps its keys,
  // and the caption's own buttons keep Space and Enter (they press themselves)
  const onKey = (e) => {
    if (!alive || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
    const t = e.target, inCap = cap.contains(t);
    // a modal on top (an alert, the end card's dialogs) keeps its own keys
    if (!inCap && t?.closest?.('[aria-modal="true"], .win--modal')) return;
    const go1 = [' ', 'Enter', 'ArrowRight', 'ArrowLeft'].includes(e.key);
    // a held key moves one step, never a run of them (and never presses a caption button twice)
    if (e.repeat && (go1 || e.key === 'Escape')) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); end(false, 'Escape'); return; }
    if (t?.matches?.('input, textarea, select, [contenteditable="true"]') && (t.value || t.isContentEditable)) return;
    if (e.key === ' ' && typing()) return;                           // typing a command: that's a space
    if (inCap && t.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) { e.stopImmediatePropagation(); return; }
    // Enter on a link, button, menu or tab outside the caption: that thing, not Next
    if (!inCap && e.key === 'Enter' && t?.closest?.('a, button, summary, [role="button"], [role="link"], [role="menuitem"], [role="tab"]')) return;
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); if (i === list.length - 1) end(true, e.key); else go(i + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); go(i - 1); }
  };
  addEventListener('keydown', onKey, true);
  addEventListener('resize', reflow);
  addEventListener('scroll', reflow, true);

  const api = {
    id, get active() { return alive; }, finished,
    end: () => end(), next: () => go(i + 1), back: () => go(i - 1), say,
    action: () => { const s = list[i]; if (!s?.action) return false; s.action.run(api); return true; },
  };
  current = api;
  document.dispatchEvent(new CustomEvent('guide:start', { detail: { id } }));  // a tapped hover card steps aside
  // its window closes, hides or collapses mid-guide: the guide goes with it, never left pointing at nothing
  if (held?.parentNode) {
    const gone = () => !held.isConnected || held.hidden || held.classList.contains('is-closing') || held.classList.contains('is-shaded');
    watch = new MutationObserver(() => { if (gone()) end(); });
    watch.observe(held.parentNode, { childList: true });
    watch.observe(held, { attributes: true, attributeFilter: ['hidden', 'class'] });
  }
  try { onStart?.(api); } catch (e) { console.warn('[guide]', e); }
  const a = A();
  if (ghost) { ghost.style.transitionDuration = '0ms'; ghost.style.transform = `translate(${a.width * 0.5}px, ${a.height * 0.46}px)`; requestAnimationFrame(() => ghost.classList.add('is-on')); }
  requestAnimationFrame(() => go(0));
  return api;
}
