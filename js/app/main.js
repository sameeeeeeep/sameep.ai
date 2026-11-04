// main.js — OFF THE CV.app: boots inside the iMac's CRT, dials up, lands on a
// Platinum desktop and opens the podcast.
import { h, wait, reducedMotion, isNarrow, safeUrl } from './util.js';
import { sound } from './audio.js';
import { CRT } from './crt.js';
import { runBoot } from './bootseq.js';
import { createWM } from './wm.js';
import { loadPersona } from './persona.js';
import { buildApps } from './apps.js';
import { Podcast } from './podcast.js';
import { stylisePhoto } from './cast.js';
import { jukebox, installer, installed, splash, login, FOLDERS, STARS, MY_GAMES, openFolder, openGames, openGame } from './era.js';
import { fillUrl } from './demos.js';
import { installCards } from './infocard.js';
import { startTour, guideOn, endGuide } from './tour.js';
import { loadWork } from './work.js';
import { isWispr, withVersion } from '../version.js';
import { clearResume } from '../resume.js';

export async function mountApp(root, { episodeUrl, resume } = {}) {
  const reduced = reducedMotion();
  root.replaceChildren();
  root.classList.add('app');
  document.documentElement.classList.add('in-app');

  const screen = h('div.crt__screen');
  const glass = h('div.crt', h('div.crt__tube', screen));
  root.append(glass);
  const crt = new CRT(glass.querySelector('.crt__tube'), { reduced });

  const dataP = loadPersona({ episodeUrl });
  const fast = new URLSearchParams(location.search).has('fast') || !!resume; // a resume skips the boot it already saw
  const q0 = new URLSearchParams(location.search);
  const eraOn = !fast && !q0.has('debug') && !q0.has('noera'); // the 1999 minute: music, a desktop installer, then the show
  let persona;
  if (!fast) {
    // the boot needs persona copy; wait briefly, never long
    const quick = await Promise.race([dataP, wait(1200).then(() => null)]);
    persona = quick?.persona || { name: 'Sameep Rehlan', shortName: 'Sameep' };
    await runBoot({ crt, root: glass, persona, reduced, installer: !eraOn });
  } else {
    await sound.unlock();
  }
  const { persona: P, episode } = await dataP;
  persona = P;
  if (P.isCustom) {
    // Third-party bundles run on this domain, so say plainly whose content it is.
    document.body.append(h('div.thirdparty', { role: 'note', style: 'position:fixed;left:50%;top:8px;transform:translateX(-50%);z-index:99999;padding:6px 12px;border-radius:999px;background:#1a1a1a;color:#f3eee2;font:500 12px/1.4 "Spline Sans Mono",monospace' }, `You're viewing ${P.name || 'someone'}'s bundle. It isn't made or checked by Sameep.`));
  }
  document.title = `${persona.showName} — ${persona.name}`;

  // ------------------------------------------------------------ desktop
  crt.setMode('glass');
  const desk = buildDesktop(screen, persona);
  screen.classList.add('is-on');
  await wait(reduced ? 0 : 420);

  const wm = createWM(desk.area);
  let pod = null, juke = null;
  const ctx = {
    wm, persona,
    connectedAt: Date.now(),
    podcast: () => pod,
    alert: wm.alert,
    askName: (q) => (pod ? pod.askName(q) : Promise.resolve('')),
    installing: false,
    openPodcast() {
      if (ctx.installing) {
        // on a phone the icon is the installer, so tapping it means "open it now"
        if (isNarrow() && ctx.skipInstall) { ctx.skipInstall(); return; }
        desk.notice('OFF THE CV is still installing. It opens by itself when it’s done.'); return;
      }
      if (ctx.launch) { ctx.launch(); return; }
      if (!pod) { desk.notice('The tape is still being recorded. Try again in a minute.'); return; }
      pod.win.el.hidden ? wm.win('podcast') : pod.win.focus();
    },
    open(id) { apps.find((a) => a.id === id)?.open(); },
    setWallHour: (hr) => desk.setWall(hr),
    endCard: (fromIcon) => { endCard(wm, persona, () => pod, fromIcon); if (!fromIcon) ctx.afterShow?.(); },
    tour: () => startTour({ area: desk.area, openPlayer: () => ctx.openJukebox() }),  // Help › Show me around, and the ? by the clock
    // the player's icon: bring it back after it's been closed (or open it for the first time on ?fast)
    openJukebox() {
      const w = wm.get('jukebox');
      if (w) { if (w.el.classList.contains('is-shaded')) w.shade(false); w.focus(); return; }
      juke = jukebox(wm, { reduced });
    },
  };
  const apps = buildApps(ctx);
  const pick = (ids) => ids.map((id) => apps.find((a) => a.id === id)).filter(Boolean);
  // left: the work. Folders in the first column (Growth OS adds itself above them), the best of them out on
  // the desktop in the second, so nothing good hides in a folder. right: the system (HD up top, Trash at the
  // bottom) and the toys, then a column of games
  const folderApp = (f) => ({ id: 'folder-' + f.id, card: 'folder-' + f.id, label: f.label, icon: 'folder-' + f.id, open: () => openFolder(wm, f) });
  desk.renderProjects([...FOLDERS.map(folderApp), ...pick(['work'])],
    // the application extras: the Wispr version only (the pages stay reachable by URL)
    [...STARS, ...(isWispr ? [{ id: 'brewbot', card: 'brewbot', label: 'Brew-bot', url: 'brewbot/' }, { id: 'recording', card: 'recording', label: 'Recording', url: 'recording/' }] : [])]);
  desk.renderIcons([...pick(['offthecv', 'hd', 'wispr', 'jukebox', 'styleguide', 'builtwith', 'readme', 'resume', 'sayhi', 'switchboard', 'claude', 'chatgpt']),
    { id: 'emergent', label: 'Emergent', icon: 'proj-emergent', url: 'https://emergent.sh/' }, ...pick(['trash'])],
  [...MY_GAMES.map((g) => ({ ...g, open: () => openGame(wm, g.id, { reduced }) })), { id: 'games', label: 'More games', icon: 'proj-games', open: () => openGames(wm, { reduced }) }]);
  desk.renderMenus(ctx, apps);
  // hover (or first tap) on a project or folder: what it is, my part, one proof point, where it opens
  installCards({ area: desk.area, folders: FOLDERS, loadList: () => loadWork(persona).then((r) => r.list),
    chapter: (id) => { const n = pod?.ep?.nodes?.[id]; return n && (n.title || n.chapter); },
    onHear: (id) => { ctx.openPodcast(); pod?.go(id); } });
  const era = eraOn;
  // right after the modem connects, Mac OS asks who you are (Wispr version: the team, with faces)
  const loggedIn = era ? await login(desk.area, persona, { reduced, stylise: stylisePhoto }) : null;
  if (loggedIn) import('./growthos.js').then((m) => m.install({ wm, area: desk.area, visitor: loggedIn })); // Wispr teammates only
  juke = era ? jukebox(wm, { reduced }) : null;
  let tour = null;

  if (episode && episode.nodes) {
    pod = new Podcast({ wm, layer: desk.area, persona, episode, onEnd: () => ctx.endCard() });
    if (era) {
      ctx.installing = true;
      desk.setInstalling(true);
      if (isNarrow()) desk.notice('OFF THE CV is installing. It only takes a moment.');
      // every visit: the guide plays while it installs and keeps going after; the Open countdown waits for it
      tour = startTour({ area: desk.area, openPlayer: () => ctx.openJukebox() });
      tour?.finished.then(() => { if (ctx.installing) ctx.skipInstall?.(); });  // skipped during the install: no need to wait
      await installer(wm, { reduced, minMs: tour ? 8000 : 3000, onProgress: desk.setProgress, bindSkip: (skip) => { ctx.skipInstall = skip; } });
      ctx.skipInstall = null;
      ctx.installing = false;
      desk.setInstalling(false);  // the icon lands on the desktop
      const ready = installed(wm, { onCount: desk.setBadge, hold: guideOn, layer: desk.area });
      ctx.launch = ready.open;
      await ready.done;
      endGuide();  // opening the show ends the guide
      ctx.launch = null;
      await Promise.all([juke.fadeOut(), splash(desk.area, persona, { reduced })]);
      juke.win.close();
    } else await wait(reduced ? 0 : 500);
    pod.open();
    // after the show (closed, cancelled or finished): a short "what's next" guide
    const whatsNext = () => setTimeout(() => { if (!guideOn() && !document.querySelector('.lock')) startTour({ area: desk.area, kind: 'next', openPlayer: () => ctx.openJukebox() }); }, 900);
    new MutationObserver(() => { if (pod.win?.el.hidden) whatsNext(); }).observe(pod.win.el, { attributes: true, attributeFilter: ['hidden'] });
    ctx.afterShow = whatsNext;
    const q = new URLSearchParams(location.search);
    if (q.has('debug') && q.get('seat')) pod.studioReady.then(() => pod.seatForQA(q.get('seat')));
    if (q.has('debug') && q.get('node')) {
      pod.go(q.get('node'), { push: false });
      for (let i = 0; i < +(q.get('line') || 0); i++) pod.skip();
      if (q.get('shot')) pod.studioReady.then(() => setTimeout(() => pod.studio.cut(q.get('shot'), q.get('who') || 'host'), 300));
    } else if (resume?.node && episode.nodes[resume.node]) {
      // back from an iOS reload: same thread, same line (host, length, seat are already saved)
      (resume.visited || []).forEach((id) => pod.visited.add(id));
      pod.go(resume.node, { push: false, line: resume.line || 0 });
    } else {
      if (!q.has('skiphost')) await pod.pickHost({ first: true, visitor: loggedIn });
      pod.start();
    }
  } else {
    desk.notice('Episode not found. The desktop still works; the podcast is on its way.');
  }
  if (new URLSearchParams(location.search).has('debug')) window.__otcv = { crt, wm, podcast: pod, persona };
  return { crt, wm, podcast: pod };
}

// ---------------------------------------------------------------------------
function buildDesktop(screen, persona) {
  const hour = new Date().getHours();
  const wallSrc = (hr) => safeUrl(fillUrl(persona.wallpaper?.url || 'https://wallpap.live/scenes/koi.html?hour={hour}&weather=clear&muted=1', '').replace(/hour=\d+/, 'hour=' + hr));
  const wall = h('iframe.desk__wall', { sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox', title: persona.wallpaper?.title || 'Live wallpaper', tabindex: '-1', 'aria-hidden': 'true', loading: 'lazy', allow: 'autoplay' });
  // load the live wallpaper once the desktop is up (it's heavy; the gradient carries until then)
  setTimeout(() => { wall.src = wallSrc(hour); }, 600);
  wall.addEventListener('load', () => wall.classList.add('is-loaded'));

  const menubar = h('nav.menubar', { 'aria-label': 'Menu bar' });
  const area = h('div.desk__area');
  const icons = h('ul.icons', { 'aria-label': 'Desktop' });
  // desktop: two icon columns, one each side; phone: one home-screen grid that scrolls as a whole
  const home = h('div.desk__home', icons);
  const toast = h('div.desk__toast', { role: 'status' });
  area.append(home, toast);
  const desk = h('div.desk', h('div.desk__fallback'), wall, menubar, area);
  screen.append(desk);

  // one desktop icon: a button that opens a window, or a link (url) that opens the real thing in a new tab
  const appIcon = (a, cls = '') => {
    const img = h('img', { src: `img/ui/${a.icon || 'proj-' + a.id}.svg`, alt: '', width: 48, height: 48, draggable: 'false' });
    const k = [cls, a.className].filter(Boolean).map((c) => '.' + c).join('');
    const dataset = a.card ? { card: a.card } : null;  // a hover card (js/app/infocard.js)
    if (a.url) return h('a.icon' + k, { href: a.url, target: '_blank', rel: 'noopener', title: a.label + ' (opens in a new tab)', dataset, onclick: () => sound.tick('click') }, img, h('span.icon__label', a.label));
    return h('button.icon' + k, { type: 'button', dataset, onclick: (e) => { sound.tick('click'); home.querySelectorAll('.is-selected').forEach((n) => n.classList.remove('is-selected')); e.currentTarget.classList.add('is-selected'); a.open(); } },
      img, h('span.icon__label', a.label));
  };

  return {
    area,
    setWall(hr) { wall.classList.remove('is-loaded'); wall.src = wallSrc(hr); },
    notice(msg) { toast.textContent = msg; toast.classList.add('is-on'); clearTimeout(toast._t); toast._t = setTimeout(() => toast.classList.remove('is-on'), 4200); },
    // right edge: system icons (Mac OS put the disk top right and the Trash bottom right), then the fun stuff
    // in its own column; on a phone the fun stuff sits after the projects
    renderIcons(apps, fun = []) {
      icons.replaceChildren(...apps.map((a) => h('li.is-' + a.id, appIcon(a))), ...fun.map((a, i) => h('li.is-fun.is-' + a.id + (i ? '' : '.is-fun-first'), appIcon(a, 'icon--proj'))));
    },
    // projects: the folders, then the stars in a column of their own; each star opens the real thing in a new tab
    renderProjects(apps, list) {
      const ul = h('ul.icons.icons--proj', { 'aria-label': 'Projects' }, ...apps.map((a) => h('li', appIcon(a))), ...list.map((p, i) => h('li.is-star' + (i ? '' : '.is-star-first'), appIcon(p, 'icon--proj'))));
      home.append(ul);
    },
    // desktop: the icon appears when the install is done; phone: it sits there downloading, like an app
    setInstalling(on) {
      const btn = icons.querySelector('.is-offthecv .icon'), li = btn?.parentElement;
      if (!li) return;
      const label = btn.querySelector('.icon__label');
      if (on && isNarrow()) {
        btn.classList.add('is-installing');
        btn.dataset.label = label.textContent; label.textContent = 'Installing…';
        btn.style.setProperty('--p', '0');
        btn.querySelector('img').after(h('span.icon__dl', { 'aria-hidden': 'true' }));
      } else if (on) li.hidden = true;
      else {
        if (btn.classList.contains('is-installing')) { btn.classList.remove('is-installing'); label.textContent = btn.dataset.label; btn.querySelector('.icon__dl')?.remove(); }
        li.hidden = false;
        li.classList.add('is-new'); sound.tick('pick');
      }
    },
    setProgress(p) { icons.querySelector('.icon.is-installing')?.style.setProperty('--p', p.toFixed(3)); },
    // phone: a badge counts down to the show opening by itself; null clears it
    setBadge(n) {
      const btn = icons.querySelector('.is-offthecv .icon');
      if (!btn || !isNarrow()) return;
      const label = btn.querySelector('.icon__label');
      let b = btn.querySelector('.icon__badge');
      if (n == null) { b?.remove(); if (btn.dataset.label) label.textContent = btn.dataset.label; return; }
      if (!b) { b = h('span.icon__badge', { 'aria-hidden': 'true' }); btn.append(b); btn.dataset.label = btn.dataset.label || label.textContent; label.textContent = 'Tap to open'; }
      b.textContent = String(n);
    },
    renderMenus(ctx, apps) {
      const clock = h('span.menubar__clock');
      // the clock stands still while the lock screen is up, and catches up the moment you're in
      const tick = () => { if (menubar.closest('.desk')?.classList.contains('is-locked')) return; const d = new Date(); clock.textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
      tick(); setInterval(tick, 15000); document.addEventListener('otcv:unlock', tick);
      const help = h('button.menubar__help', { type: 'button', 'aria-label': 'Show me around', title: 'Show me around', onclick: () => ctx.tour() }, '?');
      const soundBtn = h('button.menubar__sound', { type: 'button', 'aria-pressed': String(sound.on), 'aria-label': 'Sound', title: 'Sound on/off', onclick: () => sound.toggle() }, h('span.ico.ico--speaker'));
      const syncSound = (on) => { soundBtn.classList.toggle('is-off', !on); soundBtn.setAttribute('aria-pressed', String(on)); };
      syncSound(sound.on); sound.onChange(syncSound);
      const pod = () => ctx.podcast();
      const menus = [
        { label: h('img', { src: 'img/ui/offthecv.svg', alt: 'OFF THE CV', width: 18, height: 18 }), cls: 'menu--logo', items: [
          ['About OFF THE CV…', () => ctx.open('hd')],
          ['-'],
          ['Sound on / off', () => sound.toggle()],
          ['Restart…', () => { clearResume(); location.href = location.pathname + (isWispr ? '?skip&version=wispr' : '?skip'); }],
        ] },
        { label: 'File', items: [['Open Podcast', () => ctx.openPodcast()], ['Change host…', () => { ctx.openPodcast(); pod()?.pickHost(); }], ['Open Wispr Flow', () => ctx.open('wispr')], ['-'], ['Close Window', () => document.querySelector('.win.is-front .win__close')?.click()]] },
        { label: 'Edit', items: [['Undo CV burning', null], ['Cut', null], ['Copy', null], ['Paste', null]] },
        { label: 'Podcast', items: [['Play / Pause', () => pod()?.toggle()], ['Skip', () => pod()?.skip()], ['Back', () => pod()?.back()], ['-'], ['Change my character…', () => { ctx.openPodcast(); pod()?.recast(); }]] },
        { label: 'Special', items: [['Show me around', () => ctx.tour()], ['Empty Trash', () => ctx.open('trash')], ['Make your own sameep.ai…', () => ctx.endCard(true)], ['Shut Down', () => ctx.endCard(true)]] },
        { label: 'Help', items: [['Show me around', () => ctx.tour()], ['-'], ['Read Me', () => ctx.open('readme')], ['Résumé.doc', () => ctx.open('resume')]] },
      ];
      let openMenu = null;
      const closeAll = () => { menubar.querySelectorAll('.menu.is-open').forEach((m) => { m.classList.remove('is-open'); m.querySelector('.menu__btn').setAttribute('aria-expanded', 'false'); }); openMenu = null; };
      const left = h('ul.menubar__menus', menus.map((m) => {
        const list = h('ul.menu__list', { role: 'menu' }, m.items.map(([t, fn]) => t === '-' ? h('li.menu__sep', { role: 'separator' }) :
          h('li', { role: 'none' }, h('button.menu__item', { type: 'button', role: 'menuitem', disabled: !fn, onclick: () => { closeAll(); fn?.(); } }, t))));
        const btn = h('button.menu__btn', { type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false', onclick: (e) => {
          e.stopPropagation();
          const li = e.currentTarget.parentElement;
          const was = li.classList.contains('is-open');
          closeAll();
          if (!was) { li.classList.add('is-open'); e.currentTarget.setAttribute('aria-expanded', 'true'); openMenu = li; }
        } }, m.label);
        btn.addEventListener('pointerenter', (e) => { if (openMenu && openMenu !== e.currentTarget.parentElement) e.currentTarget.click(); });
        return h('li.menu' + (m.cls ? '.' + m.cls : ''), btn, list);
      }));
      document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.menubar')) closeAll(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });
      // the way into Switchboard: always one click from anywhere in the app
      const make = h('a.menubar__make', { href: MAKE_URL, target: '_blank', rel: 'noopener', title: MAKE_SAY }, h('span', 'Make your own'), h('span', { 'aria-hidden': 'true' }, '↗'));
      menubar.append(left, h('div.menubar__right', make, h('span.menubar__app', persona.showName), soundBtn, help, clock));
    },
  };
}

// ---------------------------------------------------------------------------
// the one call to action, everywhere: say one sentence to your own Claude
const MAKE_URL = 'https://sameep.ai/make';
const MAKE_SAY = 'Use Wispr to tell your Claude to “make your own sameep.ai using your GitHub profile”';
function endCard(wm, persona, pod, fromIcon) {
  const others = persona.links.filter((l) => l.kind !== 'make');
  const L = wm.get('podcast')?.el.getBoundingClientRect();
  const w = wm.win('end', { title: 'Make your own', width: 440, className: 'win--end', center: true });
  if (w.body.childElementCount) return;
  w.body.append(h('div.end',
    h('p.end__kicker', fromIcon ? 'One sentence' : 'That’s a wrap'),
    h('h2.end__title', 'Make your own.'),
    h('p.end__lede', `This app isn’t only ${persona.shortName}’s. Use Wispr to tell your Claude:`),
    h('p.end__say', { style: 'margin:0 0 14px;padding:10px 12px;border:2px solid currentColor;font:500 15px/1.4 "Spline Sans Mono",monospace' }, '“Make your own sameep.ai using your GitHub profile.”'),
    h('p.end__lede', 'It reads your GitHub, writes your episode in your voice, draws your pixel guest, and builds this same iMac for you.'),
    h('a.btn.btn--primary.btn--lg', { href: MAKE_URL, target: '_blank', rel: 'noopener' }, 'sameep.ai/make ↗'),
    h('ul.end__links', others.map((l) => h('li', l.kind === 'email' ? h('a', { href: l.url }, l.label) : h('a', { href: l.url, target: '_blank', rel: 'noopener' }, l.label + ' ↗')))),
    h('div.end__row',
      h('button.btn', { type: 'button', onclick: () => { w.close(); pod()?.go(pod().ep.nodes.hub ? 'hub' : pod().ep.start); } }, 'Pick another thread'),
      h('button.btn', { type: 'button', onclick: () => { w.close(); pod()?.go(pod().ep.start, { push: false }); } }, 'Replay from the top'))));
  void L; void isNarrow;
}
