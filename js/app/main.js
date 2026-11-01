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
import { fillUrl } from './demos.js';
import { isWispr, withVersion } from '../version.js';

export async function mountApp(root, { episodeUrl } = {}) {
  const reduced = reducedMotion();
  root.replaceChildren();
  root.classList.add('app');
  document.documentElement.classList.add('in-app');

  const screen = h('div.crt__screen');
  const glass = h('div.crt', h('div.crt__tube', screen));
  root.append(glass);
  const crt = new CRT(glass.querySelector('.crt__tube'), { reduced });

  const dataP = loadPersona({ episodeUrl });
  const fast = new URLSearchParams(location.search).has('fast');
  let persona;
  if (!fast) {
    // the boot needs persona copy; wait briefly, never long
    const quick = await Promise.race([dataP, wait(1200).then(() => null)]);
    persona = quick?.persona || { name: 'Sameep Rehlan', shortName: 'Sameep' };
    await runBoot({ crt, root: glass, persona, reduced });
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
  let pod = null;
  const ctx = {
    wm, persona,
    connectedAt: Date.now(),
    podcast: () => pod,
    alert: wm.alert,
    askName: (q) => (pod ? pod.askName(q) : Promise.resolve('')),
    openPodcast() {
      if (!pod) { desk.notice('The tape is still being recorded. Try again in a minute.'); return; }
      pod.win.el.hidden ? wm.win('podcast') : pod.win.focus();
    },
    open(id) { apps.find((a) => a.id === id)?.open(); },
    setWallHour: (hr) => desk.setWall(hr),
    endCard: (fromIcon) => endCard(wm, persona, () => pod, fromIcon),
  };
  const apps = buildApps(ctx);
  desk.renderIcons(apps);
  desk.renderMenus(ctx, apps);

  if (episode && episode.nodes) {
    pod = new Podcast({ wm, layer: desk.area, persona, episode, onEnd: () => ctx.endCard() });
    await wait(reduced ? 0 : 500);
    pod.open();
    const q = new URLSearchParams(location.search);
    if (q.has('debug') && q.get('seat')) pod.studioReady.then(() => pod.seatForQA(q.get('seat')));
    if (q.has('debug') && q.get('node')) {
      pod.go(q.get('node'), { push: false });
      for (let i = 0; i < +(q.get('line') || 0); i++) pod.skip();
      if (q.get('shot')) pod.studioReady.then(() => setTimeout(() => pod.studio.cut(q.get('shot'), q.get('who') || 'host'), 300));
    } else {
      if (!q.has('skiphost')) await pod.pickHost({ first: true });
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
  const toast = h('div.desk__toast', { role: 'status' });
  area.append(icons, toast);
  const desk = h('div.desk', h('div.desk__fallback'), wall, menubar, area);
  screen.append(desk);

  return {
    area,
    setWall(hr) { wall.classList.remove('is-loaded'); wall.src = wallSrc(hr); },
    notice(msg) { toast.textContent = msg; toast.classList.add('is-on'); clearTimeout(toast._t); toast._t = setTimeout(() => toast.classList.remove('is-on'), 4200); },
    renderIcons(apps) {
      icons.replaceChildren(...apps.map((a) => h('li', h('button.icon' + (a.className ? '.' + a.className : ''), { type: 'button', onclick: (e) => { sound.tick('click'); icons.querySelectorAll('.is-selected').forEach((n) => n.classList.remove('is-selected')); e.currentTarget.classList.add('is-selected'); a.open(); } },
        h('img', { src: `img/ui/${a.icon}.svg`, alt: '', width: 48, height: 48, draggable: 'false' }),
        h('span.icon__label', a.label)))));
    },
    renderMenus(ctx, apps) {
      const clock = h('span.menubar__clock');
      const tick = () => { const d = new Date(); clock.textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
      tick(); setInterval(tick, 15000);
      const soundBtn = h('button.menubar__sound', { type: 'button', 'aria-pressed': String(sound.on), 'aria-label': 'Sound', title: 'Sound on/off', onclick: () => sound.toggle() }, h('span.ico.ico--speaker'));
      const syncSound = (on) => { soundBtn.classList.toggle('is-off', !on); soundBtn.setAttribute('aria-pressed', String(on)); };
      syncSound(sound.on); sound.onChange(syncSound);
      const pod = () => ctx.podcast();
      const menus = [
        { label: h('img', { src: 'img/ui/offthecv.svg', alt: 'OFF THE CV', width: 18, height: 18 }), cls: 'menu--logo', items: [
          ['About OFF THE CV…', () => ctx.open('hd')],
          ['-'],
          ['Sound on / off', () => sound.toggle()],
          ['Restart…', () => { location.href = location.pathname + (isWispr ? '?skip&version=wispr' : '?skip'); }],
        ] },
        { label: 'File', items: [['Open Podcast', () => ctx.openPodcast()], ['Change host…', () => { ctx.openPodcast(); pod()?.pickHost(); }], ['Open Wispr Flow', () => ctx.open('wispr')], ['-'], ['Close Window', () => document.querySelector('.win.is-front .win__close')?.click()]] },
        { label: 'Edit', items: [['Undo CV burning', null], ['Cut', null], ['Copy', null], ['Paste', null]] },
        { label: 'Podcast', items: [['Play / Pause', () => pod()?.toggle()], ['Skip', () => pod()?.skip()], ['Back', () => pod()?.back()], ['-'], ['Change my character…', () => { ctx.openPodcast(); pod()?.recast(); }]] },
        { label: 'Special', items: [['Empty Trash', () => ctx.open('trash')], ['Make your own…', () => ctx.endCard(true)], ['Shut Down', () => ctx.endCard(true)]] },
        { label: 'Help', items: [['Read Me', () => ctx.open('readme')], ['Résumé.doc', () => ctx.open('resume')]] },
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
      const make = h('a.menubar__make', { href: withVersion('make/'), target: '_blank', rel: 'noopener', title: 'Make your own with Switchboard' }, h('span', 'Make your own'), h('span', { 'aria-hidden': 'true' }, '↗'));
      menubar.append(left, h('div.menubar__right', make, h('span.menubar__app', persona.showName), soundBtn, clock));
    },
  };
}

// ---------------------------------------------------------------------------
function endCard(wm, persona, pod, fromIcon) {
  const make = persona.links.find((l) => l.kind === 'make');
  const others = persona.links.filter((l) => l !== make);
  const L = wm.get('podcast')?.el.getBoundingClientRect();
  const w = wm.win('end', { title: 'Make your own', width: 440, className: 'win--end', center: true });
  if (w.body.childElementCount) return;
  w.body.append(h('div.end',
    h('p.end__kicker', fromIcon ? 'Switchboard' : 'That’s a wrap'),
    h('h2.end__title', 'Make your own.'),
    h('p.end__lede', `This app isn’t only ${persona.shortName}’s. Point your Claude at your own work through Switchboard, and it drafts the questions, the answers, the voice and the cast: your own episode, on this same iMac.`),
    make && h('a.btn.btn--primary.btn--lg', { href: make.url, target: '_blank', rel: 'noopener' }, (make.label || 'Make your own') + ' ↗'),
    h('ul.end__links', others.map((l) => h('li', h('a', { href: l.url, target: '_blank', rel: 'noopener' }, l.label + ' ↗')))),
    h('div.end__row',
      h('button.btn', { type: 'button', onclick: () => { w.close(); pod()?.go(pod().ep.nodes.hub ? 'hub' : pod().ep.start); } }, 'Pick another thread'),
      h('button.btn', { type: 'button', onclick: () => { w.close(); pod()?.go(pod().ep.start, { push: false }); } }, 'Replay from the top'))));
  void L; void isNarrow;
}
