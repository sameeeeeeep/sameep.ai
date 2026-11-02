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
export function installer(wm, { ready, minMs = 15000, reduced } = {}) {
  const w = wm.win('install', { title: 'Installer', width: 400, y: 40, className: 'win--install', sheet: false });
  const steps = [
    ['Reading “OFF THE CV 1.0” disc…', 'Installer'],
    ['Copying 488 voice clips…', 'audio/clips/cold-open-01.mp3'],
    ['Teaching three hosts to lip-sync…', 'sprites/foyra.webp'],
    ['Hanging 60 story nodes…', 'data/episode.json'],
    ['Seating the audience…', 'img/characters/'],
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
    h('div.inst__row', h('span.inst__note', 'Sit back. It plays itself when it’s ready.'), h('button.btn', { type: 'button', onclick: () => skip() }, 'Open now'))));
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
      file.textContent = 'OFF THE CV will open by itself.';
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
