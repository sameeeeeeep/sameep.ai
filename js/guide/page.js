// page.js — the guide on a standalone page: <script type="module" src="…/js/guide/page.js" data-guide="<id>">.
// It loads the guide's look, waits until the page is really up (Growth OS waits for its sign-in), plays
// the page's guide the first time, and leaves a "?" bottom right to replay it. Holding Flow and saying
// "show me around" replays it too (js/guide/guide.js).
// A page with no entry below can mark its own steps: data-guide-step="1" data-guide-say="…" on each element.
import { defineGuide, firstOpen, helpButton, guideOn } from './guide.js';
import { h } from '../app/util.js';

const PAGES = {
  // Wispr Growth OS (growth-os/): the rail of sections, Campaigns first, the home grid, your account
  growthos: { ready: '.grail', area: '.desk__area', label: 'Growth OS guide', steps: [
    { at: '.grail', dx: 0.5, dy: 0.25, say: 'Eight sections down the side, from Plan to Events. Home brings you back here.' },
    { at: '.grail__b[data-sec="campaigns"]', say: 'Campaigns is a good first stop: five of them, on one board.' },
    { at: '.gsecs', dx: 0.5, dy: 0.2, say: 'Or start anywhere: each card says what’s inside.' },
    { at: '.gos__menu summary', say: 'Your account and the sources live up here. Have a wander.' },
  ] },
  // Wispr Wrapped (wispr-wrapped/)
  wrapped: { ready: '.story .card', label: 'Wispr Wrapped guide', help: 'top', steps: [
    { at: '.tabs', say: 'Three Wrappeds: a project, my year, and yours.' },
    { at: '.story', dx: 0.5, dy: 0.3, say: 'Tap the right side for the next card, the left to go back.' },
    { at: '.acts', say: 'Like one? Save it as an image, or copy a link.' },
    { at: '[data-mode="yours"]', say: 'Yours takes a minute of talking, or a paste. Whenever you like.' },
  ] },
  // a project's own page (css/case.css)
  case: { ready: '.cs', label: 'Project page guide', steps: [
    { at: '.cs-hero', dx: 0.3, dy: 0.5, say: 'What it is, in a line.' },
    { at: '.cs-media', dx: 0.5, dy: 0.3, say: 'What it looked like.' },
    { at: '.cs-cols', dx: 0.3, dy: 0.2, say: 'What happened, and what I took from it.' },
    { at: '.cs-top a', say: '← takes you back to the desktop, whenever.' },
  ] },
};

const me = document.querySelector('script[data-guide]');
const id = me?.dataset.guide;
if (id) {
  if (!document.querySelector('link[href$="css/guide.css"]')) document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: new URL('../../css/guide.css', import.meta.url).href }));
  // marked on the page itself: data-guide-step / data-guide-say
  const marked = () => [...document.querySelectorAll('[data-guide-say]')].sort((a, b) => (+a.dataset.guideStep || 0) - (+b.dataset.guideStep || 0))
    .map((el) => ({ at: () => (el.isConnected ? el : null), say: el.dataset.guideSay }));
  const def = PAGES[id] || { ready: '[data-guide-say]', label: 'Guide', steps: marked };
  const area = () => (def.area && document.querySelector(def.area)) || document.body;
  const shown = (el) => !!(el.offsetParent || el.getClientRects().length);
  const ready = () => document.querySelector(def.ready) && ![...document.querySelectorAll('.pv__lock, [aria-modal="true"]')].some(shown);
  // up to ten minutes for a sign-in; checked twice a second
  let n = 0;
  const wait = setInterval(() => {
    if (++n > 1200) return clearInterval(wait);
    if (!ready()) return;
    clearInterval(wait);
    defineGuide(id, { area: area(), label: def.label, here: () => 1, steps: def.steps });
    const q = helpButton(id, { floating: true });
    if (def.help === 'top') q.classList.add('is-top');  // clear of the page's own bottom row
    document.body.append(q);
    setTimeout(() => firstOpen(id), 700);
    if (id === 'growthos') campaignGuides(area());
  }, 500);
}

// Growth OS: each campaign's brief has its own two-step guide, the first time it opens: what someone could
// do with it (for Wispr, for a builder, for an editor or designer), then the demo when there is one.
// The lines come with the campaign itself (data-guide on the brief; the plan is only served signed in)
function campaignGuides(area) {
  const seenNow = new Set();
  const look = () => {
    const b = area.querySelector('article.brief[data-camp][data-guide]:not([data-guide=""])');
    if (!b || seenNow.has(b.dataset.camp) || guideOn()) return;
    seenNow.add(b.dataset.camp);
    let g; try { g = JSON.parse(b.dataset.guide); } catch { return; }
    const gid = 'camp-' + b.dataset.camp;
    const here = () => (b.isConnected ? b : null);
    const who = h('ul.gtour__who', [['For Wispr', g.wispr], ['For a builder', g.builder], ['For an editor or designer', g.editor]].filter(([, t]) => t).map(([k, t]) => h('li', h('b', k), ' ', t)));
    defineGuide(gid, { area, label: `${g.name} guide`, holder: here, steps: [
      { at: () => here()?.querySelector('.brief__head'), dx: 0.15, dy: 0.5, say: `${g.name}, in a line each:`, extra: () => who },
      g.demo
        ? { at: () => here()?.querySelector('.brief__t'), say: 'There’s a demo, if you’d like to see it move.', action: { label: 'Watch the demo ↗', run: (x) => { x.end(); open(g.demo, '_blank', 'noopener'); } } }
        : { at: () => here()?.querySelector('.dl'), dx: 0.1, dy: 0.05, say: 'The idea, why it works and the first three steps are all below. A demo video lands here once it’s cut.' },
    ] });
    b.scrollIntoView?.({ block: 'start' });
    setTimeout(() => firstOpen(gid), 500);
  };
  new MutationObserver(look).observe(area, { childList: true, subtree: true });
}
