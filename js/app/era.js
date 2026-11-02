// era.js — the first minute on the desktop, as 1999 did it. A jukebox is already playing a song
// that every PC had in its shared folder; OFF THE CV installs in the background with an
// installer that takes its time; when it's done the music fades out and the show launches itself.
// Also: one desktop icon per project, each opening the real thing in a new tab.
import { h, wait } from './util.js';
import { sound } from './audio.js';

// Eiffel 65, Blue (Da Ba Dee), 1999: the official upload from the label (Bliss Corporation)
const SONG = { id: '68ugkg9RePc', artist: 'Eiffel 65', title: 'Blue (Da Ba Dee)', file: 'eiffel65_-_blue_(da_ba_dee).mp3', size: '3.4 MB' };

// projects on the desktop: icon, label, where it opens (the project's own site or repo)
export const PROJECTS = [
  { id: 'switchboard', label: 'Switchboard', url: 'https://thelastprompt.ai/switchboard' },
  { id: 'pptlive', label: 'ppt.live', url: 'https://www.ppt.live' },
  { id: 'brandbrain', label: 'Brand Brain', url: 'https://brandbrain.thelastprompt.ai' },
  { id: 'wallpap', label: 'wallpap', url: 'https://wallpap.live' },
  { id: 'video2ai', label: 'video2ai', url: 'https://github.com/sameeeeeeep/video2ai' },
  { id: 'refs', label: '/refs', url: 'https://github.com/sameeeeeeep/references-mcp' },
  { id: 'asknotch', label: 'Ask Notch', url: 'https://github.com/sameeeeeeep/ask-notch' },
  { id: 'prophexy', label: 'Prophexy', url: 'https://thelastprompt.ai/prophexy/' },
  { id: 'psspss', label: 'psspss', url: 'https://github.com/sameeeeeeep/psspss' },
  { id: 'agentbar', label: 'The Agent Bar', url: 'https://thelastprompt.ai/agentbreakroom/' },
  { id: 'happydiwali', label: 'happydiwali.to', url: 'https://happydiwali.to/' },
];

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------------------------------------------------------------- the jukebox
export function jukebox(wm, { reduced } = {}) {
  const narrow = matchMedia('(max-width: 760px)').matches;
  // bottom left, just clear of the projects column
  const col = document.querySelector('.icons--proj')?.getBoundingClientRect(), area = document.querySelector('.desk__area')?.getBoundingClientRect();
  const x = col && area && !narrow ? col.right - area.left + 14 : 16;
  const w = wm.win('jukebox', { title: 'Jukebox ’99', width: 320, x, y: 9999, className: 'win--juke', sheet: false });
  const src = `https://www.youtube-nocookie.com/embed/${SONG.id}?autoplay=1&enablejsapi=1&controls=0&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&mute=${sound.on ? 0 : 1}&origin=${encodeURIComponent(location.origin)}`;
  const frame = h('iframe.juke__vid', { src, title: `${SONG.artist}, ${SONG.title} (music video)`, allow: 'autoplay; encrypted-media', referrerpolicy: 'strict-origin-when-cross-origin', tabindex: '-1' });
  const cmd = (func, args = []) => { try { frame.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*'); } catch { /* not ready */ } };
  const clock = h('span.juke__time', '0:00');
  const state = h('span.juke__state', '▶');
  const status = h('p.juke__status', `Download complete: ${SONG.file} · ${SONG.size} · via LimeWire`);
  const bars = h('div.juke__bars', { 'aria-hidden': 'true' }, Array.from({ length: 14 }, (_, i) => h('i', { style: { animationDelay: (-(i * 37) % 900) + 'ms' } })));
  let t = 0, playing = true, timer = 0;
  const run = () => { clearInterval(timer); timer = setInterval(() => { if (playing) { t += 1; clock.textContent = fmt(t); } }, 1000); };
  const setPlaying = (on, label) => { playing = on; w.el.classList.toggle('is-playing', on); state.textContent = label || (on ? '▶' : '❚❚'); };
  const btn = (txt, aria, fn) => h('button.juke__btn', { type: 'button', 'aria-label': aria, title: aria, onclick: (e) => { e.stopPropagation(); fn(); } }, txt);
  w.body.append(h('div.juke',
    h('div.juke__lcd',
      h('div.juke__row', state, clock, h('span.juke__kbps', '128 kbps · 44 kHz · stereo')),
      h('div.juke__marquee', h('span', `${SONG.artist.toUpperCase()} - ${SONG.title.toUpperCase()} *** 1999 *** `.repeat(2))),
      bars),
    h('div.juke__screen', frame),
    h('div.juke__ctrl',
      btn('⏮', 'Back to the start', () => { cmd('seekTo', [0, true]); t = 0; clock.textContent = '0:00'; }),
      btn('▶', 'Play', () => { cmd('playVideo'); setPlaying(true); }),
      btn('❚❚', 'Pause', () => { cmd('pauseVideo'); setPlaying(false); }),
      btn('■', 'Stop', () => { cmd('pauseVideo'); cmd('seekTo', [0, true]); t = 0; clock.textContent = '0:00'; setPlaying(false, '■'); })),
    status));
  w.el.classList.add('is-playing');
  frame.addEventListener('load', () => { setTimeout(() => cmd(sound.on ? 'unMute' : 'mute'), 600); run(); });
  const off = sound.onChange((on) => cmd(on ? 'unMute' : 'mute'));
  void reduced;
  return {
    win: w,
    // the end of an era: volume down over a couple of seconds, then the tape stops
    async fadeOut(ms = 2600) {
      const steps = 13;
      for (let i = steps; i >= 0; i--) { cmd('setVolume', [Math.round((i / steps) * 100)]); await wait(ms / steps); }
      cmd('pauseVideo');
      setPlaying(false, '■');
      clearInterval(timer);
      status.textContent = 'Stopped. The show is starting.';
      off?.();
    },
  };
}

// ---------------------------------------------------------------- the installer
// resolves when the install is done (at least minMs, and not before `ready`); "Open now" skips ahead
export function installer(wm, { ready, minMs = 60000, reduced } = {}) {
  const w = wm.win('install', { title: 'Installer', width: 400, y: 40, className: 'win--install', sheet: false });
  const steps = [
    ['Reading “OFF THE CV 1.0” disc…', 'Installer'],
    ['Checking for viruses (none, probably)…', 'Norton AntiVirus 5.0'],
    ['Copying 488 voice clips…', 'audio/clips/cold-open-01.mp3'],
    ['Teaching three hosts to lip-sync…', 'sprites/foyra.webp'],
    ['Removing CV.pdf…', 'CV.pdf → Trash'],
    ['Hanging 60 story nodes…', 'data/episode.json'],
    ['Seating the audience…', 'img/characters/'],
    ['Defragmenting the anecdotes…', 'stories.db'],
    ['Teaching Gus the offside rule…', 'hosts/gus.cfg'],
    ['Calibrating K-56’s anxiety…', 'hosts/k56.cfg'],
    ['Pressing the Diwali invite…', 'work/diwali/'],
    ['Wiring Switchboard…', 'work/switchboard/'],
    ['Pouring drinks at the Agent Bar…', 'work/agentbar/'],
    ['Feeding the koi…', 'wallpap/koi.scene'],
    ['Warming up the tube…', 'crt.js'],
    ['Rewinding the tape…', 'Episode 01'],
  ];
  const doing = h('p.inst__doing', steps[0][0]);
  const file = h('p.inst__file', steps[0][1]);
  const left = h('span', String(steps.length));
  const fill = h('i');
  const bar = h('div.inst__bar', { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': 'Installing' }, fill);
  let skip;
  const skipP = new Promise((r) => { skip = r; });
  w.body.append(h('div.inst',
    h('div.inst__head', h('img', { src: 'img/ui/offthecv.svg', alt: '', width: 40, height: 40 }), h('div', h('p.inst__t', 'Installing “OFF THE CV”'), h('p.inst__s', 'Items remaining to be installed: ', left))),
    doing, bar, file,
    h('div.inst__row', h('span.inst__note', 'Have a play while you wait: the games and the projects are on the left.'), h('button.btn', { type: 'button', onclick: () => skip() }, 'Skip'))));
  return new Promise((resolve) => {
    const t0 = performance.now();
    const total = reduced ? 1500 : minMs;
    let done = false, readyNow = false;
    Promise.resolve(ready).then(() => { readyNow = true; });
    const tick = () => {
      if (done) return;
      const p = Math.min(1, (performance.now() - t0) / total);
      const shown = readyNow ? p : Math.min(p, 0.92);
      fill.style.transform = `scaleX(${shown.toFixed(3)})`;
      bar.setAttribute('aria-valuenow', String(Math.round(shown * 100)));
      const i = Math.min(steps.length - 1, Math.floor(shown * steps.length));
      if (doing.textContent !== steps[i][0]) { doing.textContent = steps[i][0]; file.textContent = steps[i][1]; left.textContent = String(steps.length - i); }
      if (shown >= 1) finish(); else requestAnimationFrame(tick);
    };
    const finish = async () => {
      if (done) return;
      done = true;
      fill.style.transform = 'scaleX(1)';
      doing.textContent = 'Installation was successful.';
      file.textContent = 'OFF THE CV is on your desktop.';
      left.textContent = '0';
      sound.tick('pick');
      await wait(reduced ? 0 : 900);
      w.close();
      resolve();
    };
    // rAF pauses in background tabs; a slow timer keeps it moving there
    const bg = setInterval(() => { if (done) clearInterval(bg); else tick(); }, 500);
    skipP.then(() => { readyNow = true; Promise.resolve(ready).then(finish); });
    requestAnimationFrame(tick);
  });
}

// ---------------------------------------------------------------- the launch splash
export async function splash(layer, persona, { reduced } = {}) {
  const el = h('div.splash', { role: 'status' },
    h('div.splash__card',
      h('img', { src: 'img/ui/offthecv.svg', alt: '', width: 64, height: 64 }),
      h('p.splash__t', persona.showName || 'OFF THE CV'),
      h('p.splash__s', `Episode 01 · ${persona.name || 'Sameep Rehlan'}`),
      h('p.splash__c', 'Version 1.0 · © 1999–2026 · All rights reversed'),
      h('div.splash__dots', { 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
      h('p.splash__go', 'Starting the show…')));
  layer.append(el);
  sound.tick('open');
  requestAnimationFrame(() => el.classList.add('is-on'));
  await wait(reduced ? 300 : 2600);
  el.classList.remove('is-on');
  await wait(reduced ? 0 : 350);
  el.remove();
}

// ---------------------------------------------------------------- the Games folder
// 90s games that still run in a browser, each opening in a new tab
export const GAMES = [
  { id: 'minesweeper', label: 'Minesweeper', url: 'https://minesweeper.online/' },
  { id: 'solitaire', label: 'Solitaire', url: 'https://www.solitr.com/' },
  { id: 'skifree', label: 'SkiFree', url: 'https://basicallydan.github.io/skifree.js/' },
  { id: 'doom', label: 'DOOM', url: 'https://playclassic.games/games/first-person-shooter-dos-games-online/play-doom-online/' },
  { id: 'prince', label: 'Prince of Persia', url: 'https://playclassic.games/games/run-and-gun-dos-games-online/play-prince-of-persia-online/' },
  { id: 'tetris', label: 'Tetris', url: 'https://tetris.com/play-tetris' },
  { id: 'pacman', label: 'Pac-Man', url: 'https://www.google.com/logos/2010/pacman10-i.html' },
];

export function openGames(wm) {
  const w = wm.win('games', { title: 'Games', width: 420, className: 'win--folder' });
  if (w.body.childElementCount) return;
  w.body.append(h('p.folder__bar', `${GAMES.length} items · each opens in a new tab`),
    h('ul.folder__grid', GAMES.map((g) => h('li', h('a.icon.icon--file', { href: g.url, target: '_blank', rel: 'noopener', onclick: () => sound.tick('click') },
      h('img', { src: `img/ui/proj-${g.id}.svg`, alt: '', width: 48, height: 48, draggable: 'false' }),
      h('span.icon__label', g.label))))));
}

// ---------------------------------------------------------------- Multiple Users (Wispr version)
// Mac OS 9 asked who you were after startup. Here it lists the Wispr Flow team, with their
// faces, plus Guest. Logging in as someone makes you them in the audience (same store the
// seat picker uses), so the host greets you by name and the seat step is skipped.
export function login(layer, persona, { reduced } = {}) {
  const team = (persona.characters || []).filter((c) => c.team);
  if (!team.length) return Promise.resolve(null);
  return new Promise((resolve) => {
    let pick = null;
    // a lock screen: the desktop blurred behind, the time big, every account as a round face
    const time = h('p.lock__time'), date = h('p.lock__date');
    const tick = () => { const d = new Date(); time.textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, ''); date.textContent = d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }); };
    tick(); const clk = setInterval(tick, 15000);
    const pw = h('input.lock__pw', { type: 'password', placeholder: 'No password needed', 'aria-label': 'Password', autocomplete: 'off' });
    const arrow = h('button.lock__go', { type: 'submit', 'aria-label': 'Log in' }, '→');
    const form = h('form.lock__form', { onsubmit: (e) => { e.preventDefault(); finish(); } }, pw, arrow);
    const back = h('button.lock__back', { type: 'button', onclick: () => choose(null) }, '← Other accounts');
    const accounts = [...team, { id: 'guest', label: 'Guest User', blurb: 'Just looking around', thumb: null }];
    const list = h('ul.lock__users', { role: 'listbox', 'aria-label': 'Accounts' }, accounts.map((c) => h('li', h('button.lock__user', { type: 'button', role: 'option', 'aria-selected': 'false', dataset: { id: c.id }, onclick: () => choose(c) },
      h('span.lock__face', c.thumb || c.src ? h('img', { src: c.thumb || c.src, alt: '', width: 96, height: 96 }) : h('span.lock__guest', { 'aria-hidden': 'true' })),
      h('span.lock__name', c.label), c.blurb && h('span.lock__role', c.blurb)))));
    const hint = h('p.lock__hint', 'Choose your account');
    const el = h('div.lock', { role: 'dialog', 'aria-label': 'Log in' },
      h('div.lock__top', time, date),
      h('div.lock__mid', list, form, back, hint));
    function choose(c) {
      pick = c;
      el.classList.toggle('is-picked', !!c);
      list.querySelectorAll('.lock__user').forEach((n) => { const on = c && n.dataset.id === c.id; n.classList.toggle('is-on', !!on); n.setAttribute('aria-selected', String(!!on)); });
      hint.textContent = c ? (c.id === 'guest' ? 'Press return to look around' : `Hi ${c.label}. Press return to log in`) : 'Choose your account';
      if (c) { sound.tick('pick'); setTimeout(() => pw.focus({ preventScroll: true }), 50); }
    }
    const finish = async () => {
      if (!pick) return;
      el.classList.add('is-out');
      clearInterval(clk);
      sound.tick('open');
      await wait(reduced ? 0 : 450);
      el.remove();
      desk?.classList.remove('is-locked');
      if (pick.id === 'guest') return resolve(null);
      const v = { name: pick.label, character: { ...pick }, photo: null };
      try { localStorage.setItem('offthecv.visitor', JSON.stringify({ name: v.name, character: pick.id })); } catch { /* this visit only */ }
      resolve(v);
    };
    const desk = layer.closest('.desk');
    desk?.classList.add('is-locked');
    layer.append(el);
    requestAnimationFrame(() => el.classList.add('is-on'));
  });
}

// ---------------------------------------------------------------- installed: open it, or it opens itself
// resolves when the visitor clicks Open (here or on the new desktop icon via `open`), or after `secs`
export function installed(wm, { secs = 60, reduced } = {}) {
  let go;
  const p = new Promise((r) => { go = r; });
  const w = wm.win('installed', { title: 'Installer', width: 380, y: 40, className: 'win--install', sheet: false });
  const left = h('b', String(secs));
  w.body.append(h('div.inst',
    h('div.inst__head', h('img', { src: 'img/ui/offthecv.svg', alt: '', width: 40, height: 40 }), h('div', h('p.inst__t', 'Installation complete'), h('p.inst__s', '“OFF THE CV” is now on your desktop.'))),
    h('p.inst__doing', 'Open it now, or it opens by itself in ', left, ' seconds.'),
    h('div.inst__row', h('span.inst__note', 'Double-click its icon any time.'), h('button.btn.btn--primary', { type: 'button', onclick: () => go() }, 'Open'))));
  sound.tick('pick');
  let n = reduced ? 3 : secs;
  const t = setInterval(() => { n -= 1; left.textContent = String(Math.max(0, n)); if (n <= 0) go(); }, 1000);
  return { open: () => go(), done: p.then(() => { clearInterval(t); w.close(); }) };
}
