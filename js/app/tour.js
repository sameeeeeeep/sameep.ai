// tour.js — the first-visit tour, played while OFF THE CV installs. A ghost Mac arrow glides around the
// desktop by itself with a small caption in Wispr Flow's look: the work on the left (it opens a folder
// and shows one hover card), fun things and games on the right, then the show itself. The visitor's own
// mouse stays free; nothing is covered. Skip tour, Esc, or opening the show ends it, and it never
// repeats (localStorage) unless the URL has ?tour. Phones and reduced motion get step highlights only.
import { h, clamp, isNarrow, reducedMotion } from './util.js';

const KEY = 'offthecv.tour';
const STOP = Symbol('stop');

export const tourSeen = () => { try { return localStorage.getItem(KEY) === 'done' && !new URLSearchParams(location.search).has('tour'); } catch { return false; } };
const markSeen = () => { try { localStorage.setItem(KEY, 'done'); } catch { /* private mode: this visit only */ } };

const ARROW = '<svg viewBox="0 0 12 19" width="18" height="28" aria-hidden="true"><path d="M1 1v15l3.6-3.4 2.6 5.6 2.4-1.1-2.6-5.5H12L1 1z" fill="#111" stroke="#fff" stroke-width="1.1" stroke-linejoin="round"/></svg>';

export function startTour({ area }) {
  if (tourSeen()) return null;
  if (!document.getElementById('font-wispr')) document.head.append(h('link#font-wispr', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=EB+Garamond:wght@500&family=Figtree:wght@400;600&display=swap' }));
  const glide = !isNarrow() && !reducedMotion();  // phones and reduced motion: highlights, no gliding cursor
  const $ = (sel) => area.querySelector(sel);
  const phone = isNarrow();  // one grid on a phone, so no left and right

  const ghost = glide ? h('div.gtour__cursor', { 'aria-hidden': 'true' }) : null;
  if (ghost) ghost.innerHTML = ARROW;
  const text = h('p.gtour__text'), extra = h('div.gtour__extra');
  const cap = h('div.gtour__cap', { role: 'status', 'aria-live': 'polite' },
    text, extra, h('div.gtour__row', h('span.gtour__brand', 'Tour'), h('button.gtour__skip', { type: 'button', onclick: () => end() }, 'Skip tour')));
  area.append(...[ghost, cap].filter(Boolean));

  let alive = true, at = { x: 0, y: 0 }, lit = [], done, crtFrom = null;
  const finished = new Promise((r) => { done = r; });
  const sleep = (ms) => new Promise((r, j) => setTimeout(() => (alive ? r() : j(STOP)), ms));
  const live = () => { if (!alive) throw STOP; };
  const box = (el) => { const A = area.getBoundingClientRect(), r = el.getBoundingClientRect(); return { x: r.left - A.left, y: r.top - A.top, w: r.width, h: r.height, A }; };

  // the caption sits beside the cursor (or under the highlighted thing), always inside the desktop
  let side = 'right';  // the caption goes left of the cursor when something opens on its right (the hover card)
  function placeCap(x, y, below) {
    const A = area.getBoundingClientRect(), cw = cap.offsetWidth, ch = cap.offsetHeight;
    let cx = side === 'left' ? x - cw - 16 : x + 22, cy = y + 14;
    if (side === 'right' && cx + cw > A.width - 10) cx = x - cw - 14;
    if (side === 'left' && cx < 10) cx = x + 22;
    if (below) { cx = x - cw / 2; cy = below.y + below.h + 10; if (cy + ch > A.height - 10) cy = below.y - ch - 10; }
    cap.style.left = clamp(cx, 10, A.width - cw - 10) + 'px';
    cap.style.top = clamp(cy, 10, A.height - ch - 10) + 'px';
  }
  function say(line, more = null) {
    text.textContent = line;
    extra.replaceChildren(...(more ? [more] : []));
    cap.classList.add('is-on');
  }
  function light(...els) {
    lit.forEach((e) => e.classList.remove('is-tour-lit'));
    lit = els.filter(Boolean); lit.forEach((e) => e.classList.add('is-tour-lit'));
  }
  // glide the ghost to the middle of an element (or show the caption under it, without the cursor)
  async function to(el, ms = 800, dx = 0.5, dy = 0.5) {
    live();
    if (!el) return false;
    if (!glide) el.scrollIntoView?.({ block: 'nearest' });
    const b = box(el), x = b.x + b.w * dx, y = b.y + b.h * dy;
    if (ghost) {
      ghost.style.transitionDuration = ms + 'ms';
      ghost.style.transform = `translate(${x}px, ${y}px)`;
      at = { x, y };
      placeCap(x, y);
      await sleep(ms);
    } else { placeCap(x, y, b); await sleep(ms); }  // no cursor: the highlight holds as long as the glide would
    return true;
  }
  const press = async () => { if (!ghost) return; ghost.classList.add('is-press'); await sleep(160); ghost.classList.remove('is-press'); };

  // the Wispr Flow pill, mocked: hold your key and talk
  const pill = () => h('div.gtour__pill', h('span.gtour__wave', { 'aria-hidden': 'true' }, Array.from({ length: 9 }, (_, i) => h('i', { style: { animationDelay: `${(i * 97) % 600}ms` } }))), h('span', 'Hold your Flow key, say where to go'));

  async function run() {
    const A = area.getBoundingClientRect();
    if (ghost) { ghost.style.transitionDuration = '0ms'; ghost.style.transform = `translate(${A.width * 0.52}px, ${A.height * 0.5}px)`; at = { x: A.width * 0.52, y: A.height * 0.5 }; requestAnimationFrame(() => ghost.classList.add('is-on')); }
    say('A quick tour while it installs.');
    if (ghost) placeCap(at.x, at.y); else placeCap(A.width / 2, 40);
    await sleep(650);

    // 1. the work, on the left: open a folder, show one hover card, close it again
    const folder = $('[data-card="folder-growth"]') || $('.icons--proj [data-card^="folder-"]');
    light(...[...area.querySelectorAll('.icons--proj [data-card^="folder-"]')]);
    say(phone ? 'Your work is in these folders. Tap one to see inside.' : 'Your work is on the left, in folders.');
    await to(folder, 950);
    await sleep(900);
    if (glide && folder) {
      await press(); folder.click();
      await sleep(550);
      const win = $('.win--folder.is-front');
      const item = win?.querySelector('[data-card="slumber"]') || win?.querySelector('[data-card]');
      if (item) {
        side = 'left'; say('Hover anything for what it is and my part in it.');
        await to(item, 700);
        item.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
        await sleep(1900);  // the card shows after 300 ms, then stays about 1.5 s
        item.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, pointerType: 'mouse', relatedTarget: document.body }));
      }
      side = 'right';
      const close = win?.querySelector('.win__close');
      if (close) { await to(close, 450); await press(); close.click(); }
      await sleep(250);
    } else await sleep(800);

    // 2. fun things and games, on the right
    const fun = $('[data-card="folder-fun"]'), games = $('.is-games .icon'), juke = $('.win--juke, .win--island');
    say(phone ? 'Fun things and games are down here.' : 'Fun things and games are on the right.');
    light(fun, games);
    await to(fun, 1000); await sleep(650);
    await to(games, 500); await sleep(450);
    if (juke) { light(juke); say('And the jukebox: 60 songs from ’99. Skip one any time.'); await to(juke, 650, 0.5, glide ? 0.12 : 0.5); await sleep(900); }

    // the screen: Flat, then Off, then back to Flat, then theirs (Flat for a first visit); nothing is saved
    const crtBtn = document.querySelector('.menubar__crt'), crt = window.otcvCrt;
    if (glide && crtBtn && crt) {
      crtFrom = crt.mode;
      light(crtBtn); say('You can change the screen if you like.');
      await to(crtBtn, 900);
      for (const [m, label] of [['flat', 'Flat: the iMac look, and the default.'], ['off', 'Off: clean pixels, no CRT.'], ['flat', 'Back to Flat.']]) {
        await press(); crt.preview(m); say(label); await sleep(1000);
      }
      crt.restore(crtFrom); crtFrom = null;
    }

    // 3. the show itself, as the install finishes
    const show = $('.win--install:not(.is-closing)') || $('.is-offthecv .icon');
    light(show);
    say('This is the portfolio: a podcast you steer. Hold your Wispr Flow key and say where to go.', pill());
    await to(show, 950, 0.5, glide && show?.classList.contains('win--install') ? 0.62 : 0.5);
    await sleep(2300);

    // Wispr teammates: after the show, their own folder
    const gos = $('[data-app="growthos"]');
    if (gos) { light(gos); say('After the show, open this one: Wispr Growth OS. A growth plan I started for your team. Rough, not reviewed yet.'); await to(gos, 900); await sleep(2600); }
    done();  // the installer can finish now; the Open countdown takes over
    await sleep(900);
    end();
  }

  function end() {
    if (!alive) return;
    alive = false;
    if (crtFrom) { window.otcvCrt?.restore(crtFrom); crtFrom = null; }  // skipped mid-demo: their own screen back
    markSeen();
    done();
    light();
    cap.classList.remove('is-on'); ghost?.classList.remove('is-on');
    setTimeout(() => { cap.remove(); ghost?.remove(); }, 300);
    document.removeEventListener('keydown', onKey, true);
  }
  const onKey = (e) => { if (e.key === 'Escape' && alive) { e.stopPropagation(); end(); } };
  document.addEventListener('keydown', onKey, true);
  run().catch((e) => { if (e !== STOP) { console.warn('[tour]', e); end(); } });
  return { get active() { return alive; }, end, finished };
}
