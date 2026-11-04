// tour.js — the desktop guide. A ghost Mac arrow glides slowly from stop to stop with a caption in
// Wispr Flow's look, explaining everything on the desktop, one short line each. It plays on every
// visit while OFF THE CV installs (and keeps going after: the Open countdown waits for it), advances
// by itself, pauses while the pointer is on the caption, and has Back / Next / Skip on every bubble.
// Esc or opening the show ends it; Help › Show me around (or the ? by the clock) plays it again.
// After the show closes, a short "what's next" tour points at where to go from there.
// Phones and reduced motion: no gliding cursor, the caption sits by a highlighted icon instead.
import { h, clamp, isNarrow, reducedMotion } from './util.js';
import { isWispr } from '../version.js';

const STOP = Symbol('stop');
const GLIDE = 1500;                                                  // one cursor move, eased (1.2–1.8 s)
const holdFor = (line) => Math.max(3000, line.trim().split(/\s+/).length * 250);  // 250 ms a word, 3 s at least
const ARROW = '<svg viewBox="0 0 12 19" width="18" height="28" aria-hidden="true"><path d="M1 1v15l3.6-3.4 2.6 5.6 2.4-1.1-2.6-5.5H12L1 1z" fill="#111" stroke="#fff" stroke-width="1.1" stroke-linejoin="round"/></svg>';
let current = null;                                                  // one guide at a time
export const guideOn = () => !!current?.active;
export const endGuide = () => current?.end();
const seenNext = new Set();                                          // "what's next" stops already shown this visit

// the Wispr Flow pill, mocked: hold your key and talk
const pill = () => h('div.gtour__pill', h('span.gtour__wave', { 'aria-hidden': 'true' }, Array.from({ length: 9 }, (_, i) => h('i', { style: { animationDelay: `${(i * 97) % 600}ms` } }))), h('span', 'Hold your Flow key, say where to go'));
const showEl = () => document.querySelector('.win--install:not(.is-closing)') || document.querySelector('.is-offthecv .icon');

// every stop: what to point at, one short line, and anything it does while it's there
function mainStops(phone) {
  const q = (s) => () => document.querySelector(s);
  const folder = (id) => q(`[data-card="folder-${id}"]`);
  return [
    { id: 'hello', at: () => null, say: 'Here’s the desktop. Watch, or use Next and Back.' },
    { id: 'growth', at: folder('growth'), say: phone ? 'Growth work: launches, sales and campaigns I ran.' : 'On the left, my work. Growth: launches, sales and campaigns.' },
    { id: 'peek', at: folder('growth'), say: 'Open a folder, then hover a project: what it is and my part.', desktopOnly: true, peek: true },
    { id: 'switchboard', at: folder('switchboard'), say: 'Switchboard: run any app on your own Claude, plus its wrapps.' },
    { id: 'tools', at: folder('tools'), say: 'Claude tools: small things that make Claude better at work.' },
    { id: 'products', at: folder('products'), say: 'Products I built or co-founded, Trippy included.' },
    { id: 'work', at: q('.icons--proj .icon:not([data-card]):not([data-app])'), say: 'Work: every project in one window, with videos.' },
    { id: 'recording', at: q('[data-card="recording"]'), say: 'Recording: my three-minute application video.', wisprOnly: true },
    { id: 'brewbot', at: q('[data-card="brewbot"]'), say: 'Brew-bot: a pour-over machine you run by voice.', wisprOnly: true },
    { id: 'fun', at: folder('fun'), say: phone ? 'Fun things and side quests.' : 'On the right, fun things and side quests.' },
    { id: 'games', at: q('.is-games .icon'), say: '1999 games, still playable in a browser.' },
    { id: 'juke', at: q(phone ? '.win--island' : '.win--juke'), say: phone ? 'The jukebox: 60 songs from ’99. Tap ⏭ to skip.' : 'The jukebox: 60 songs from ’99. Skip, pause or roll it up.' },
    { id: 'readme', at: q('.is-readme .icon'), say: 'Read Me: how this site was talked into existence.' },
    { id: 'styleguide', at: q('.is-styleguide .icon'), say: 'Wispr’s brand, as I read it, on one page.' },
    { id: 'built', at: q('.is-builtwith .icon'), say: 'Built with: the real numbers behind this build.' },
    { id: 'make', at: q('.is-switchboard .icon'), say: 'Make your own: tell your Claude to build you one.' },
    { id: 'menubar', at: q('.menubar__menus'), say: 'Up top: the Podcast menu, Help, and Special.', desktopOnly: true },
    { id: 'crt', at: q('.menubar__crt'), say: 'The screen has looks. Here they are.', desktopOnly: true, crt: true },
    { id: 'again', at: q('.menubar__help'), say: 'Press ? any time to see this tour again.', desktopOnly: true },
    { id: 'show', at: showEl, say: 'And this is the show: a podcast about my work.' },
    { id: 'steer', at: showEl, say: 'Steer it: hold your Wispr Flow key and say where to go. Or type.', extra: pill },
    { id: 'hosts', at: showEl, say: 'Pick one of four hosts first. Switch any time.' },
    { id: 'gos', at: q('[data-app="growthos"]'), say: 'Wispr Growth OS: a growth plan I started for your team.', wisprOnly: true },
  ];
}
function nextStops() {
  const q = (s) => () => document.querySelector(s);
  return [
    { id: 'n-hello', at: () => null, say: 'Thanks for listening. Here’s where to go next.' },
    { id: 'n-work', at: q('[data-card="folder-growth"]'), say: 'Open any folder on the left for a project’s own page.' },
    { id: 'n-gos', at: q('[data-app="growthos"]'), say: 'Wispr Growth OS: the plan I’d start with.', wisprOnly: true },
    { id: 'n-make', at: q('.is-switchboard .icon'), say: 'Make your own: say one sentence to your Claude.' },
    { id: 'n-juke', at: q('.win--juke, .win--island, .is-jukebox .icon'), say: 'The jukebox is still here, if you want more ’99.' },
    { id: 'n-rec', at: q('[data-card="recording"]'), say: 'And the Recording: three minutes, the short version.', wisprOnly: true },
  ];
}

export function startTour({ area, kind = 'main' } = {}) {
  current?.end();
  if (!document.getElementById('font-wispr')) document.head.append(h('link#font-wispr', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=EB+Garamond:wght@500&family=Figtree:wght@400;600&display=swap' }));
  const phone = isNarrow(), glide = !phone && !reducedMotion();
  let stops = (kind === 'next' ? nextStops() : mainStops(phone)).filter((s) => (!s.wisprOnly || isWispr) && (!s.desktopOnly || !phone));
  if (kind === 'next') { stops = stops.filter((s) => !seenNext.has(s.id)); if (stops.length < 2) return null; }

  const ghost = glide ? h('div.gtour__cursor', { 'aria-hidden': 'true' }) : null;
  if (ghost) ghost.innerHTML = ARROW;  // a fixed, local SVG string
  const text = h('p.gtour__text'), extra = h('div.gtour__extra'), count = h('span.gtour__n');
  const back = h('button.gtour__btn', { type: 'button', onclick: () => go(i - 1) }, 'Back');
  const next = h('button.gtour__btn.is-primary', { type: 'button', onclick: () => go(i + 1) }, 'Next');
  const skip = h('button.gtour__btn.is-text', { type: 'button', onclick: () => end() }, 'Skip');
  const cap = h('div.gtour__cap', { role: 'dialog', 'aria-live': 'polite', 'aria-label': 'Desktop guide' },
    text, extra, h('div.gtour__row', count, h('span.gtour__btns', skip, back, next)));
  area.append(...[ghost, cap].filter(Boolean));

  let alive = true, i = -1, token = 0, paused = false, lit = [], crtFrom = null, opened = null, hovered = null, done, side = 'right';
  const finished = new Promise((r) => { done = r; });
  // a wait that pauses while the pointer is on the caption, and stops if the visitor moves on
  const wait = (ms, my) => new Promise((res, rej) => {
    let left = ms, t0 = performance.now();
    const tick = () => {
      if (!alive || my !== token) return rej(STOP);
      const now = performance.now();
      if (!paused) left -= now - t0;
      t0 = now;
      if (left <= 0) return res();
      setTimeout(tick, Math.min(120, left));
    };
    tick();
  });
  const A = () => area.getBoundingClientRect();
  const box = (el) => { const a = A(), r = el.getBoundingClientRect(); return { x: r.left - a.left, y: r.top - a.top, w: r.width, h: r.height }; };
  function light(...els) { lit.forEach((e) => e.classList.remove('is-tour-lit')); lit = els.filter(Boolean); lit.forEach((e) => e.classList.add('is-tour-lit')); }
  function placeCap(x, y, near) {
    const a = A(), cw = cap.offsetWidth, ch = cap.offsetHeight;
    let cx, cy;
    if (!ghost) {
      if (near) { cx = near.x + near.w / 2 - cw / 2; cy = near.y + near.h + 10; if (cy + ch > a.height - 8) cy = near.y - ch - 10; }
      else { cx = (a.width - cw) / 2; cy = a.height * 0.3; }
    } else { cx = side === 'left' ? x - cw - 16 : x + 22; cy = y + 16; if (side === 'right' && cx + cw > a.width - 10) cx = x - cw - 14; if (side === 'left' && cx < 10) cx = x + 22; }
    cap.style.left = clamp(cx, 8, Math.max(8, a.width - cw - 8)) + 'px';
    cap.style.top = clamp(cy, 8, Math.max(8, a.height - ch - 8)) + 'px';
  }
  async function moveTo(el, my, ms = GLIDE, dx = 0.5, dy = 0.5) {
    const a = A();
    if (el && !glide) el.scrollIntoView?.({ block: 'nearest' });
    const b = el ? box(el) : { x: a.width * 0.42, y: a.height * 0.38, w: 0, h: 0 };
    const x = b.x + b.w * dx, y = b.y + b.h * dy;
    if (ghost) { ghost.style.transitionDuration = ms + 'ms'; ghost.style.transform = `translate(${x}px, ${y}px)`; placeCap(x, y); await wait(ms, my); }
    else placeCap(x, y, el ? b : null);
  }
  const press = async (my) => { if (!ghost) return; ghost.classList.add('is-press'); await wait(160, my); ghost.classList.remove('is-press'); };
  function say(line, more = null) { text.textContent = line; extra.replaceChildren(...(more ? [more] : [])); cap.classList.add('is-on'); }

  // leaving a stop puts things back: closes the folder it opened, hides the card, leaves the screen on Flat
  const flat = () => { const crt = window.otcvCrt; if (!crt) return; (crt.set || crt.setMode || crt.preview).call(crt, 'flat'); };
  function tidy() {
    if (hovered) { hovered.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, pointerType: 'mouse', relatedTarget: document.body })); hovered = null; }
    if (opened?.isConnected) opened.querySelector('.win__close')?.click();
    opened = null; side = 'right';
    if (crtFrom) { flat(); crtFrom = null; }
  }

  async function go(k) {
    if (!alive) return;
    tidy();
    if (k < 0) k = 0;
    while (k < stops.length && !stops[k].id.endsWith('hello') && !stops[k].at()) k++;  // nothing to point at: skip it
    if (k >= stops.length) return end(true);
    const my = ++token; i = k;
    const s = stops[k];
    if (kind === 'next') seenNext.add(s.id);
    count.textContent = `${k + 1} of ${stops.length}`;
    back.disabled = k === 0;
    next.textContent = k === stops.length - 1 ? 'Done' : 'Next';
    try {
      const el = s.at();
      light(el);
      say(s.say, s.extra?.());
      await moveTo(el, my);
      if (s.peek && glide && el) await peek(el, my);
      else if (s.crt && el) await crtDemo(my);
      else await wait(holdFor(s.say), my);
      go(k + 1);
    } catch (e) { if (e !== STOP) { console.warn('[tour]', e); end(); } }
  }
  // open the folder, glide to one project, let its hover card show for about 4 s
  async function peek(folder, my) {
    await press(my); folder.click();
    await wait(700, my);
    const win = area.querySelector('.win--folder.is-front'); opened = win;
    const item = win?.querySelector('[data-card="slumber"]') || win?.querySelector('[data-card]');
    if (!item) return wait(holdFor(stops[i].say), my);
    side = 'left';
    await moveTo(item, my, 1300);
    item.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' })); hovered = item;
    await wait(4300, my);  // the card shows after 300 ms, then stays about 4 s
  }
  // the CRT looks, about 2.5 s each, ending on Flat
  async function crtDemo(my) {
    const crt = window.otcvCrt;
    if (!crt) return wait(3000, my);
    crtFrom = crt.mode;
    await wait(1800, my);
    for (const [m, line] of [['curved', 'Curved: the whole tube, bent like glass.'], ['off', 'Off: clean pixels, no CRT.'], ['flat', 'Flat: the iMac look.']]) {
      crt.preview(m);
      if (crt.mode !== m) continue;                                  // not offered on this screen
      await press(my); say(line); await wait(2500, my);
    }
    flat(); crtFrom = null;
    const last = 'Flat is easiest on the eyes. Switch any time with one click.';
    say(last); await wait(holdFor(last), my);
  }

  function end(complete) {
    if (!alive) return;
    tidy();
    alive = false; token++;
    light();
    cap.classList.remove('is-on'); ghost?.classList.remove('is-on');
    setTimeout(() => { cap.remove(); ghost?.remove(); }, 300);
    document.removeEventListener('keydown', onKey, true);
    if (current === api) current = null;
    done(!!complete);
  }
  const onKey = (e) => { if (e.key === 'Escape' && alive) { e.stopPropagation(); end(); } };
  document.addEventListener('keydown', onKey, true);
  cap.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') paused = true; });
  cap.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') paused = false; });
  cap.addEventListener('focusin', () => { paused = true; });
  cap.addEventListener('focusout', (e) => { if (!cap.contains(e.relatedTarget)) paused = false; });

  const a = A();
  if (ghost) { ghost.style.transitionDuration = '0ms'; ghost.style.transform = `translate(${a.width * 0.5}px, ${a.height * 0.46}px)`; requestAnimationFrame(() => ghost.classList.add('is-on')); }
  const api = { get active() { return alive; }, end: () => end(), finished, kind };
  current = api;
  requestAnimationFrame(() => go(0));
  return api;
}
