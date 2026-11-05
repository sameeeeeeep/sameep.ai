// tour.js — the desktop's guides, all on the one engine (js/guide/guide.js): the desktop tour, the
// "after the show" stop at Wispr Growth OS, and a short first-open guide for each kind of window
// (project folders, the Wispr folder, Work, the games, Macster, the podcast).
// Every one plays once per visitor, moves only when they say (Next, Space, “next”), can be skipped from
// any step, ends by leaving them alone, and replays from the window's own “?”, the ? by the clock, or by
// holding Flow and saying “show me around”. Pointing at an icon shows its hover card inside the caption.
import { isNarrow } from './util.js';
import { isWispr } from '../version.js';
import { PLAYER } from './era.js';
import { defineGuide, firstOpen, play, playHere, guideOn, endGuide, flowPill, helpButton, seen, askFeedback } from '../guide/guide.js';

export { guideOn, endGuide };

const drawn = (el) => (el && el.getClientRects().length ? el : null);
const showEl = () => [...document.querySelectorAll('.win--install:not(.is-closing)')].find(drawn) || drawn(document.querySelector('.is-offthecv .icon'));
const q = (sel) => () => document.querySelector(sel);
// the first of these that isn't hidden under a window (the installer sits over the top of the games column)
const clear = (...sels) => () => {
  const all = sels.map((s) => document.querySelector(s)).filter(Boolean);
  return all.find((el) => { const r = el.getBoundingClientRect(), t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return t && el.contains(t); }) || all[0] || null;
};
// the step's action opens an icon: past the hover card's "first tap shows the card" on a phone
const openEl = (g, el) => { g.end(); if (el) { el.dataset.cardOpen = '1'; el.click(); } };
const GAMES = ['.is-moto .icon', '.is-snake .icon', '.is-breakout .icon', '.is-roadrash .icon'];
// wait (briefly) for something a step needs, like a folder's icons after its window opens
const until = async (fn, ms = 3000) => { for (let t = 0; t < ms; t += 100) { if (fn()) return true; await new Promise((r) => setTimeout(r, 100)); } return false; };

export function installGuides({ area, cards, ctx }) {
  const cardFor = (el) => cards?.content(el);
  const layer = area.closest('.desk') || area;  // drawn over the menu bar too, so its steps aren't hidden under it
  const open = () => [...area.querySelectorAll('.win:not([hidden]):not(.is-closing):not(.is-shaded):not(.win--modal):not(.win--install)')].sort((a, b) => (+b.style.zIndex || 0) - (+a.style.zIndex || 0));
  const inFront = (fn) => () => { const w = open()[0]; return w && fn(w) ? 2 : 0; };
  const win = (fn) => () => open().find(fn) || null;
  const inWin = (w, sel) => () => w()?.querySelector(sel) || null;

  // ------------------------------------------------------------ the desktop tour (first visit)
  // a window the tour opens for a step: shut again when it moves on, unless they've touched it (then it's theirs)
  const borrowed = new Map();
  const borrow = async (key, isOpen, openIt) => {
    if (isOpen()) return;
    await openIt();
    if (!(await until(isOpen, 3000))) return;
    const w = isOpen(); borrowed.set(key, w);
    w.addEventListener('pointerdown', () => borrowed.delete(key), { once: true, capture: true });
  };
  const giveBack = (key) => { const w = borrowed.get(key); borrowed.delete(key); if (w?.isConnected) w.querySelector('.win__close')?.click(); };
  const workWin = q('.win--work:not(.is-closing)'), wisprWin = () => document.querySelector('.win--folder[aria-label="Wispr"]:not(.is-closing)');
  // the desktop tour: the work, the Wispr folder (Wispr version), then the show. The games stay out of it.
  // When it ends, however it ends, the show starts by itself 15 s later (main.js: the countdown pill)
  defineGuide('desktop', {
    area, layer, cardFor, label: 'Desktop guide', here: () => 1,
    start: { label: 'Start the show', run: () => ctx.startShow() },
    steps: () => [
      { at: null, say: 'Welcome to 1999. A quick tour: my work, then the show. Skip whenever you like.' },
      // the work, then the Wispr folder, opened for them and shut again after
      { at: () => workWin()?.querySelector('.work__list'), say: 'First, my work: everything I’ve made, in one list, each with its video and links.',
        enter: async (g) => { await borrow('work', workWin, async () => { if (g.active) ctx.open('work'); }); await until(() => workWin()?.querySelector('.work__item'), 4000); }, leave: () => giveBack('work') },
      { at: () => wisprWin()?.querySelector('.wsec[data-sec="builders"]'), when: () => isWispr, say: 'Then the Wispr folder. Up top, Wispr for Builders: small Claude mods you run by voice. Pack 1 is out: seven of them, one install.',
        enter: (g) => borrow('wispr', wisprWin, () => ctx.openWispr({ still: () => g.active })) },
      // the fun one and the plan share a row: point at the row, so the caption sits beside it, never on Growth OS
      { at: () => wisprWin()?.querySelector('.wsec-row'), when: () => isWispr, say: 'Below: the fun one, Wispr Wrapped, and the plan, Growth OS.',
        enter: () => until(() => wisprWin()?.querySelector('.wsec-row'), 3000), leave: () => giveBack('wispr') },
      { at: clear('[data-card="folder-growth"]', '[data-card="folder-switchboard"]', '[data-card="slumber"]'), when: () => !isWispr, card: true, say: isNarrow() ? 'My work lives up top. Tap any icon once for a card like this.' : 'Hover any icon on the left for a card like this.' },
      // last: the show. Wispr is the remote there (a phone has no Flow key: chips, or just say it)
      isNarrow()
        ? { at: showEl, centre: true, say: 'Then OFF THE CV, my portfolio as a show in my voice. It starts 15 s after this; tap a chip inside to jump around.' }
        : { at: showEl, centre: true, say: 'Then OFF THE CV, my portfolio as a show in my voice. It starts 15 s after this. Inside, tap a chip to jump around.' },
    ],
  });

  // ------------------------------------------------------------ after the show: Growth OS, once
  const growthEl = () => document.querySelector('.win--folder [data-card="wispr-growthos"]');
  defineGuide('after-show', {
    area, layer, cardFor, label: 'What’s next',
    steps: () => (isWispr ? [
      { at: null, say: 'Thanks for listening. One last stop, then I’ll leave you be.' },
      { at: growthEl, card: true, say: 'Wispr Growth OS: the growth plan I’d start with for your team. Campaigns is a good first page.',
        // skipped while the folder is still opening: it doesn't open after all
        enter: async (g) => { if (!growthEl()) { await ctx.openWispr({ still: () => g.active }); await until(growthEl); } },
        action: { label: 'Open Growth OS ↗', run: (g) => openEl(g, growthEl()) } },
      { at: q('.win--folder [data-card="wispr-wrapped"]'), card: true, enter: () => until(q('.win--folder [data-card="wispr-wrapped"]'), 1500), say: 'Beside it, the things I built for Wispr. That’s all from me; the desktop’s yours.' },
    ] : [
      { at: null, say: 'Thanks for listening. A few places to wander, then I’ll leave you be.' },
      { at: q('[data-card="folder-growth"]'), card: true, say: 'Every folder on the left opens onto real projects.' },
      { at: q('.is-switchboard .icon'), card: true, say: 'Want one of these? It takes one sentence to your Claude or Emergent.' },
      { at: clear(...GAMES), card: true, say: 'Or play one of mine. The desktop’s yours.' },
    ]),
  });

  // ------------------------------------------------------------ one guide per kind of window
  // the Wispr folder is a folder too: tell it apart by its title
  const isWisprF = (w) => w.matches('.win--folder') && w.getAttribute('aria-label') === 'Wispr';
  const isFolder = (w) => w.matches('.win--folder') && !isWisprF(w);
  const folderW = win(isFolder);
  defineGuide('folder', {
    area, layer, cardFor, holder: folderW, label: 'Folder guide', here: inFront(isFolder),
    steps: () => [
      { at: inWin(folderW, '.folder__grid [data-card]'), card: true, say: 'Each icon is a project. Hover one (or tap once) for a card like this.' },
      { at: inWin(folderW, '.folder__bar'), say: 'Most open the real thing in a new tab. Mine play right here.' },
      { at: inWin(folderW, '.win__close'), say: 'Done? The box, top left, closes it.' },
    ],
  });

  const wisprW = win(isWisprF);
  const wItem = (id) => inWin(wisprW, `[data-card="wispr-${id}"]`);
  const openIt = (id, label = 'Open it ↗') => ({ label, run: (g) => openEl(g, wItem(id)()) });
  defineGuide('wispr', {
    area, layer, cardFor, holder: wisprW, label: 'Wispr folder guide', here: inFront(isWisprF),
    steps: () => [
      { at: inWin(wisprW, '.wsec[data-sec="builders"] .wsec__head'), enter: () => until(wItem('wispreditor')), say: 'Wispr for Builders: small Claude mods that make voice a superpower. Pack 1 is out.' },
      { at: wItem('builders'), card: true, say: 'Pack 1: all seven mods on one page. Give the repo to your Claude and it installs them.' },
      { at: wItem('wispreditor'), card: true, say: 'Wispr Video: a teleprompter, recorder and editor. You say the edit, Claude makes it.' },
      { at: wItem('guru'), card: true, say: 'Wispr Guru: a voice guide for any software.' },
      { at: wItem('wrapped'), card: true, say: 'And the fun one, Wispr Wrapped: my real Flow history, as a story. Yours takes a minute of talking.', action: openIt('wrapped') },
      { at: wItem('growthos'), card: true, say: 'Growth OS is the plan: how I’d grow Wispr. Its own tab, behind a team sign-in.', action: openIt('growthos', 'Open Growth OS ↗') },
    ],
  });

  const isWork = (w) => w.matches('.win--work');
  const workW = win(isWork);
  defineGuide('work', {
    area, layer, cardFor, holder: workW, label: 'Work guide', here: inFront(isWork),
    steps: () => [
      { at: inWin(workW, '.work__list'), say: 'Everything I’ve made, in one list. No podcast required.', enter: () => until(inWin(workW, '.work__item')) },
      { at: inWin(workW, '.work__pane'), say: 'Pick one and its video, screenshots and links open here.' },
    ],
  });

  const isGame = (w) => w.matches('.win--game');
  const gameW = win(isGame);
  defineGuide('game', {
    area, layer, cardFor, holder: gameW, label: 'Game guide', here: inFront(isGame),
    steps: () => [
      { at: inWin(gameW, '.game'), say: () => { const help = gameW()?.querySelector('.game [class$="-help"]')?.textContent; return `Click into the game, then play.${help ? ' ' + help + '.' : ''}`; } },
      { at: inWin(gameW, '.win__close'), say: 'Close the window and the game stops. Good luck.' },
    ],
  });

  const isJuke = (w) => w.matches('.win--juke');
  const jukeW = win(isJuke);
  defineGuide('macster', {
    area, layer, cardFor, holder: jukeW, label: `${PLAYER.name} guide`, here: inFront(isJuke),
    steps: () => [
      { at: inWin(jukeW, '.juke__lcd'), say: 'Now playing. ⏭ skips, ❚❚ pauses.' },
      { at: inWin(jukeW, '.juke__ctrl'), say: 'The full deck: back, play, pause, stop, next, volume.' },
      { at: inWin(jukeW, '.win__shade'), say: 'Collapse it to the title bar; the music carries on.' },
    ],
  });

  const isPod = (w) => w.matches('.win--podcast');
  const podW = win(isPod);
  let wasPlaying = false;
  defineGuide('podcast', {
    area, layer, cardFor, holder: podW, label: 'Podcast guide', here: inFront(isPod),
    // the show waits while the guide talks, and carries on after
    onStart: () => { const p = ctx.podcast(); wasPlaying = !!p?.playing; if (wasPlaying) p.pause(); },
    onEnd: () => { const p = ctx.podcast(); if (wasPlaying && p && !p.playing && podW()) p.toggle(); wasPlaying = false; },
    steps: () => [
      // the Wispr version opens on the part made for them: point at it, gently
      { at: inWin(podW, '.mcards'), when: () => isWispr, centre: true, say: 'This first part is the one made for you: Wispr for Builders. Tap a card to open that piece.' },
      isNarrow()
        ? { at: inWin(podW, '.steer'), say: 'You steer. Tap a chip, or use ← → to jump between parts.' }
        : { at: inWin(podW, '.steer'), dx: 0.12, place: 'above', say: 'You steer. Tap a chip, or use ← → to jump between parts.' },
      { at: inWin(podW, '.transport'), say: isNarrow() ? 'Back, pause, skip: a part at a time.' : 'Back, pause, skip: a part at a time. Space pauses.' },
      isNarrow()
        ? { at: inWin(podW, '.chap-drawer'), say: 'The episode map: jump anywhere, or pick a project and hear just that. Enjoy the show.' }
        : { at: inWin(podW, '.pod__side'), dx: 0.2, dy: 0.15, place: 'left', say: 'The episode map: jump anywhere, or pick a project and hear just that. Enjoy the show.' },
    ],
  });

  // ------------------------------------------------------------ first opens, and a ? on every window that has a guide
  const MODS = [['podcast', isPod], ['wispr', isWisprF], ['folder', isFolder], ['work', isWork], ['game', isGame], ['macster', isJuke]];
  const idOf = (w) => MODS.find(([, fn]) => fn(w))?.[0];
  const addHelp = (w) => {
    const id = idOf(w), bar = w.querySelector('.win__bar'), tools = w.querySelector('.win__tools');
    if (!id || !tools || bar.querySelector('.gtour-help')) return;
    tools.prepend(helpButton(id, { label: 'Show me around this window' }));
  };
  const busy = () => guideOn() || !!document.querySelector('.lock, .win--modal:not([hidden]), .cast') || ctx.installing;
  const endCardUp = () => !!document.querySelector('.win--end:not(.is-closing):not([hidden])');
  // has the show really played? (closing it at the host pick isn't "after the show")
  let played = false;
  until(() => ctx.podcast()?.playing, 3600000).then((ok) => { played = ok; });
  // Macster and the podcast start theirs from main.js (openMacster / podcastReady); the rest on first open
  const AUTO = new Set(['wispr', 'folder', 'work', 'game']);
  new MutationObserver((recs) => {
    for (const r of recs) for (const n of r.addedNodes) {
      if (!(n instanceof HTMLElement) || !n.matches('.win')) continue;
      const wasBusy = guideOn();  // opened by a guide (or while one was up): not a first open of its own
      // look once the window has settled
      setTimeout(() => {
        if (!n.isConnected || n.hidden || n.classList.contains('is-closing')) return;
        addHelp(n);
        const id = idOf(n);
        if (id && AUTO.has(id) && !wasBusy && !busy()) firstOpen(id);
      }, 600);
    }
  }).observe(area, { childList: true });
  area.querySelectorAll('.win').forEach(addHelp);

  return {
    first: () => firstOpen('desktop'),
    desktop: () => play('desktop'),
    here: () => playHere(),
    // once per visitor, after the show closes or ends; then (once, ever) the one-line feedback card
    afterShow: async () => {
      if (!played || seen('after-show')) return null;
      // the "Make your own" card first: after-show waits for it to close, never sits on top of it
      await until(() => !endCardUp() && !busy(), 600000);
      if (seen('after-show') || busy()) return null;
      const g = play('after-show');
      const ask = () => setTimeout(() => { if (!busy()) askFeedback({ area, where: 'after-show' }); }, 1200);
      if (g) g.finished.then(ask); else ask();
      return g;
    },
    // or after a few minutes on the desktop, if the show never got them there: asked once nothing else is going on
    feedbackLater: (ms = 5 * 60000) => setTimeout(function check() {
      if (seen('feedback')) return;
      const pod = ctx.podcast();
      if (busy() || (pod?.playing && podW())) { setTimeout(check, 30000); return; }
      askFeedback({ area, where: 'desktop' });
    }, ms),
    openMacster: () => setTimeout(() => { if (!busy()) firstOpen('macster'); }, 600),
    // the first time the show is really playing (host picked, welcome closed)
    podcastReady: async () => {
      if (seen('podcast')) return;
      const ok = await until(() => podW() && !document.querySelector('.cast, .win--modal:not([hidden])') && ctx.podcast()?.playing, 180000);
      if (ok) await until(() => !busy(), 60000);
      if (ok && !busy() && podW() && ctx.podcast()?.playing) firstOpen('podcast');
    },
  };
}
