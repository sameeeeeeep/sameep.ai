// era.js — the first minute on the desktop, as 1999 did it. A jukebox is already playing a song
// that every PC had in its shared folder; OFF THE CV installs in the background with an
// installer that takes its time; when it's done the music fades out and the show launches itself.
// Also: one desktop icon per project, each opening the real thing in a new tab.
import { h, wait, isNarrow } from './util.js';
import { sound } from './audio.js';
import { presence } from '../presence.js';

// the 1999 playlist: what every shared folder had, global and Bollywood. Each id is an upload that allows embedding
// (checked Nov 2026: playableInEmbed true); the player is audio only, the video never shows
const PLAYLIST = [
  { id: '68ugkg9RePc', artist: 'Eiffel 65', title: 'Blue (Da Ba Dee)' },
  { id: 'p47fEXGabaY', artist: 'Ricky Martin', title: 'Livin’ la Vida Loca' },
  { id: 'rjtUQAz2KsU', artist: 'A.R. Rahman', title: 'Taal Se Taal Mila' },
  { id: '4fndeDfaWCg', artist: 'Backstreet Boys', title: 'I Want It That Way' },
  { id: 'FrLequ6dUdM', artist: 'TLC', title: 'No Scrubs' },
  { id: 'Tfjoyp0g5HA', artist: 'Kavita Krishnamurthy & Vinod Rathod', title: 'Dholi Taro Dhol Baaje' },
  { id: 'EK_LN3XEcnw', artist: 'Lou Bega', title: 'Mambo No. 5' },
  { id: 'J8zlroVMYeM', artist: 'Sonu Nigam', title: 'Deewana Tera' },
  { id: '6Whgn_iE5uc', artist: 'Santana ft. Rob Thomas', title: 'Smooth' },
  { id: 'L_jWHffIx5E', artist: 'Smash Mouth', title: 'All Star' },
  { id: 'kIDWgqDBNXA', artist: 'Christina Aguilera', title: 'Genie in a Bottle' },
  { id: 'zLGZhp14UgY', artist: 'Jagjit Singh', title: 'Hoshwalon Ko Khabar Kya' },
];
// the filename it would have had in a 1999 shared folder
const fileOf = (s) => (s.artist + '_-_' + s.title).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9()._-]+/g, '_').replace(/_+/g, '_') + '.mp3';

// projects on the desktop (the left column): icon, label, where it opens (the project's own site or repo)
export const PROJECTS = [
  { id: 'switchboard', label: 'Switchboard', url: 'https://thelastprompt.ai/switchboard' },
  { id: 'pptlive', label: 'ppt.live', url: 'https://www.ppt.live' },
  { id: 'brandbrain', label: 'Brand Brain', url: 'https://brandbrain.thelastprompt.ai' },
  { id: 'wallpap', label: 'wallpap', url: 'https://wallpap.live' },
  { id: 'video2ai', label: 'video2ai', url: 'https://github.com/sameeeeeeep/video2ai' },
  { id: 'refs', label: '/refs', url: 'https://github.com/sameeeeeeep/references-mcp' },
  { id: 'asknotch', label: 'Ask Notch', url: 'https://github.com/sameeeeeeep/ask-notch' },
  { id: 'psspss', label: 'psspss', url: 'https://github.com/sameeeeeeep/psspss' },
];
// side quests and half-finished things: the right-hand side of the desktop
export const FUN = [
  { id: 'prophexy', label: 'Prophexy', url: 'https://thelastprompt.ai/prophexy/' },
  { id: 'agentbar', label: 'The Agent Bar', url: 'https://thelastprompt.ai/agentbreakroom/' },
  { id: 'happydiwali', label: 'happydiwali.to', url: 'https://happydiwali.to/' },
];

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------------------------------------------------------------- the jukebox
export function jukebox(wm, { reduced } = {}) {
  const narrow = isNarrow();
  // bottom left, just clear of the projects column; on a phone it hangs from the menu bar like a live activity
  const layer = document.querySelector('.desk__area');
  const col = document.querySelector('.icons--proj')?.getBoundingClientRect(), area = layer?.getBoundingClientRect();
  const x = col && area && !narrow ? col.right - area.left + 14 : 16;
  // audio only: the YouTube player is mounted invisibly (it has to be on screen to play); the LCD is the only UI
  const host = h('div.juke__host', { 'aria-hidden': 'true' });
  const w = wm.win('jukebox', { title: 'Jukebox ’99', width: 320, x, y: 9999, className: 'win--juke' + (narrow ? ' win--island' : ''), sheet: false,
    onClose: () => { host.remove(); layer?.classList.remove('has-island'); removeEventListener('message', onMsg); off?.(); clearInterval(timer); } });
  if (narrow) layer?.classList.add('has-island');
  let i = 0;
  const src = `https://www.youtube-nocookie.com/embed/${PLAYLIST[0].id}?autoplay=1&enablejsapi=1&controls=0&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&mute=${sound.on ? 0 : 1}&origin=${encodeURIComponent(location.origin)}`;
  const frame = h('iframe.juke__vid', { src, title: 'Jukebox ’99 (audio)', allow: 'autoplay; encrypted-media', referrerpolicy: 'strict-origin-when-cross-origin', tabindex: '-1' });
  const post = (msg) => { try { frame.contentWindow?.postMessage(JSON.stringify(msg), '*'); } catch { /* not ready */ } };
  const cmd = (func, args = []) => post({ event: 'command', func, args });
  const clock = h('span.juke__time', '0:00');
  const state = h('span.juke__state', '▶');
  const track = h('span.juke__track');
  const marquee = h('div.juke__marquee', track);
  const status = h('p.juke__status');
  const bars = h('div.juke__bars', { 'aria-hidden': 'true' }, Array.from({ length: 14 }, (_, k) => h('i', { style: { animationDelay: (-(k * 37) % 900) + 'ms' } })));
  let t = 0, playing = true, timer = 0, live = false, lastGo = 0;
  // the clock ticks locally, and snaps to the player's own time whenever it reports one
  const run = () => { clearInterval(timer); timer = setInterval(() => { if (playing) { t += 1; clock.textContent = fmt(t); } }, 1000); };
  const setPlaying = (on, label) => { playing = on; w.el.classList.toggle('is-playing', on); state.textContent = label || (on ? '▶' : '❚❚'); toggle.textContent = on ? '❚❚' : '▶'; toggle.setAttribute('aria-label', on ? 'Pause' : 'Play'); };
  const show = () => {
    const s = PLAYLIST[i];
    track.textContent = `${i + 1}. ${s.artist.toUpperCase()} - ${s.title.toUpperCase()} *** 1999 *** `.repeat(2);
    status.textContent = `Now playing · ${i + 1} of ${PLAYLIST.length} · ${fileOf(s)}`;
    w.el.setAttribute('aria-label', `Jukebox ’99, now playing ${s.title} by ${s.artist}`);
  };
  const go = (n) => {
    i = (n + PLAYLIST.length) % PLAYLIST.length; lastGo = Date.now();
    t = 0; clock.textContent = '0:00';
    cmd('loadVideoById', [PLAYLIST[i].id]);
    setPlaying(true); show(); sound.tick('click');
  };
  // the player can report one ending twice, and the old track's end can arrive just after a skip: ignore those
  const ended = (grace = 2500) => { if (Date.now() - lastGo > grace) go(i + 1); };
  const next = () => go(i + 1), prev = () => (t > 3 ? (cmd('seekTo', [0, true]), t = 0, clock.textContent = '0:00') : go(i - 1));
  const toggle = h('button.juke__toggle', { type: 'button', 'aria-label': 'Pause', onclick: (e) => { e.stopPropagation(); if (playing) { cmd('pauseVideo'); setPlaying(false); } else { cmd('playVideo'); setPlaying(true); } } }, '❚❚');
  const skip = h('button.juke__toggle.juke__skip', { type: 'button', 'aria-label': 'Next track', onclick: (e) => { e.stopPropagation(); next(); } }, '⏭');
  const btn = (txt, aria, fn) => h('button.juke__btn', { type: 'button', 'aria-label': aria, title: aria, onclick: (e) => { e.stopPropagation(); fn(); } }, txt);
  // the player talks back over postMessage: its time, and when a track ends (state 0) or can't play (onError)
  function onMsg(e) {
    if (e.source !== frame.contentWindow) return;
    let d; try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
    if (!d || !d.event) return;
    live = true;
    if (d.event === 'onStateChange' && d.info === 0) ended();
    else if (d.event === 'onError') ended(300);  // blocked or removed upload: skip it
    else if (d.event === 'infoDelivery' && d.info) {
      if (d.info.playerState === 0) ended();
      if (typeof d.info.currentTime === 'number' && d.info.currentTime > 0) { t = Math.floor(d.info.currentTime); clock.textContent = fmt(t); }
    }
  }
  addEventListener('message', onMsg);
  host.append(frame);
  (layer || w.el).append(host);
  w.body.append(h('div.juke',
    h('div.juke__lcd',
      h('div.juke__row', state, clock, h('span.juke__kbps', '128 kbps · 44 kHz · stereo')),
      marquee, bars, toggle, skip),
    h('div.juke__ctrl',
      btn('⏮', 'Previous track', prev),
      btn('▶', 'Play', () => { cmd('playVideo'); setPlaying(true); }),
      btn('❚❚', 'Pause', () => { cmd('pauseVideo'); setPlaying(false); }),
      btn('■', 'Stop', () => { cmd('pauseVideo'); cmd('seekTo', [0, true]); t = 0; clock.textContent = '0:00'; setPlaying(false, '■'); }),
      btn('⏭', 'Next track', next)),
    status));
  show();
  w.el.classList.add('is-playing');
  frame.addEventListener('load', () => {
    // subscribe to the player's events (what the IFrame API does under the hood)
    const hello = () => { if (!live && frame.isConnected) { post({ event: 'listening', id: 'juke', channel: 'widget' }); setTimeout(hello, 400); } };
    hello();
    setTimeout(() => cmd(sound.on ? 'unMute' : 'mute'), 600); run();
  });
  const off = sound.onChange((on) => cmd(on ? 'unMute' : 'mute'));
  void reduced;
  return {
    win: w,
    // the end of an era: volume down over a couple of seconds, then the tape stops
    async fadeOut(ms = 2600) {
      const steps = 13;
      for (let k = steps; k >= 0; k--) { cmd('setVolume', [Math.round((k / steps) * 100)]); await wait(ms / steps); }
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
// on a phone there's no window: the desktop icon fills up like an app downloading (onProgress), and tapping it skips (bindSkip)
export function installer(wm, { ready, minMs = 60000, reduced, onProgress, bindSkip } = {}) {
  const narrow = isNarrow();
  const w = narrow ? null : wm.win('install', { title: 'Installer', width: 400, y: 40, className: 'win--install', sheet: false });
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
  bindSkip?.(() => skip());
  w?.body.append(h('div.inst',
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
      onProgress?.(shown);
      const i = Math.min(steps.length - 1, Math.floor(shown * steps.length));
      if (doing.textContent !== steps[i][0]) { doing.textContent = steps[i][0]; file.textContent = steps[i][1]; left.textContent = String(steps.length - i); }
      if (shown >= 1) finish(); else requestAnimationFrame(tick);
    };
    const finish = async () => {
      if (done) return;
      done = true;
      fill.style.transform = 'scaleX(1)';
      onProgress?.(1);
      doing.textContent = 'Installation was successful.';
      file.textContent = 'OFF THE CV is on your desktop.';
      left.textContent = '0';
      sound.tick('pick');
      await wait(reduced || narrow ? 0 : 900);
      w?.close();
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

// ---------------------------------------------------------------- the lock screen
// After the modem connects, Mac OS asks who you are. Everyone floats as a bubble (ppt.live style:
// a little physics, they drift and nudge each other); type your name to filter, or tap your face.
// Wispr version: the team are there. Anyone can add their own account (name + selfie); it lives on
// their device only and is there next time. Logging in seats you in the audience as yourself.
const ACCOUNTS = 'offthecv.accounts';
const ownAccounts = () => { try { return JSON.parse(localStorage.getItem(ACCOUNTS) || '[]'); } catch { return []; } };
const saveOwn = (list) => { try { localStorage.setItem(ACCOUNTS, JSON.stringify(list.slice(-4))); } catch { /* full or private: this visit only */ } };

export function login(layer, persona, { reduced, stylise } = {}) {
  return new Promise((resolve) => {
    const team = (persona.characters || []).filter((c) => c.team);
    const time = h('p.lock__time'), date = h('p.lock__date'), online = h('p.lock__online', { hidden: true });
    const tick = () => { const d = new Date(); time.textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, ''); date.textContent = d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }); };
    tick(); const clk = setInterval(tick, 15000);
    const stopHere = presence((n) => { online.hidden = !n; online.textContent = n > 1 ? `${n} in the room right now` : 'Just you in the room right now'; });

    const field = h('div.lock__field', { role: 'listbox', 'aria-label': 'Accounts' });
    const search = h('input.lock__search', { type: 'text', placeholder: team.length ? 'Type your name, or tap your face' : 'Type your name', 'aria-label': 'Your name', autocomplete: 'off', spellcheck: false, enterkeyhint: 'go' });
    const hint = h('p.lock__hint', team.length ? 'Or add your own account' : 'Add your own account, or come in as a guest');
    const pickView = h('div.lock__picked', { hidden: true });
    const addView = h('form.lock__add', { hidden: true });
    const el = h('div.lock', { role: 'dialog', 'aria-label': 'Log in' },
      h('div.lock__top', time, date, online),
      h('div.lock__mid', field, pickView, addView, h('div.lock__bottom', search, hint)));

    // ---- bubbles
    let bubbles = [];
    const face = (a) => h('span.lock__face', a.src ? h('img', { src: a.src, alt: '', width: 96, height: 96 }) : h('span.lock__glyph', { 'aria-hidden': 'true' }, a.glyph ?? (a.label || '?')[0].toUpperCase()));
    function build() {
      const accounts = [...ownAccounts().map((a) => ({ ...a, own: true })), ...team.map((c) => ({ id: c.id, label: c.label, blurb: c.blurb, src: c.thumb || c.src, team: c })),
        { id: 'add', label: 'Add account', blurb: 'Name and a selfie', glyph: '+' }, { id: 'guest', label: 'Guest User', blurb: 'Just looking around', glyph: '' }];
      field.replaceChildren();
      bubbles = accounts.map((a) => {
        const b = h('button.lock__user' + (a.id === 'add' ? '.is-add' : a.id === 'guest' ? '.is-guest' : ''), { type: 'button', role: 'option', onclick: () => choose(a) },
          face(a), h('span.lock__name', a.label), a.blurb && h('span.lock__role', a.blurb));
        field.append(b);
        return { a, el: b, x: 0, y: 0, vx: 0, vy: 0, on: true };
      });
      place();
    }
    // physics: soft circles that push apart, bounce off the edges and wander a little
    let W = 0, H = 0, R = 52, raf = 0, last = 0;
    function place() {
      W = field.clientWidth; H = field.clientHeight; R = W < 500 ? 42 : 54;
      const n = bubbles.length, cols = Math.max(2, Math.min(n, Math.floor(W / (R * 2.3)))), rows = Math.ceil(n / cols), cw = Math.min(W / cols, R * 3.2);
      bubbles.forEach((b, i) => { const r = Math.floor(i / cols), inRow = Math.min(cols, n - r * cols); b.x = W / 2 + ((i % cols) - (inRow - 1) / 2) * cw + (Math.random() - 0.5) * 20; b.y = (Math.floor(i / cols) + 0.5) * (H / Math.max(rows, 1)) + (Math.random() - 0.5) * 20; b.vx = (Math.random() - 0.5) * 0.4; b.vy = (Math.random() - 0.5) * 0.4; });
      for (let k = 0; k < 120; k++) step(1, true);
      draw();
    }
    function step(dt, settle) {
      const live = bubbles.filter((b) => b.on);
      for (const b of live) {
        if (!settle) { b.vx += (Math.random() - 0.5) * 0.05 * dt; b.vy += (Math.random() - 0.5) * 0.05 * dt; }
        if (live.length < bubbles.length) { b.vx += (W / 2 - b.x) * 0.0006 * dt; b.vy += (H / 2 - b.y) * 0.0006 * dt; }
      }
      for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
        const p = live[i], q = live[j], dx = q.x - p.x, dy = (q.y - p.y) * 1.15, d = Math.hypot(dx, dy) || 0.01, min = R * 2.05;
        if (d < min) { const f = ((min - d) / d) * 0.06 * dt; p.vx -= dx * f; p.vy -= dy * f; q.vx += dx * f; q.vy += dy * f; }
      }
      for (const b of live) {
        b.vx *= 0.94; b.vy *= 0.94;
        const sp = Math.hypot(b.vx, b.vy), max = settle ? 6 : 0.9;
        if (sp > max) { b.vx *= max / sp; b.vy *= max / sp; }
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx); } if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx); }
        if (b.y < R * 0.9) { b.y = R * 0.9; b.vy = Math.abs(b.vy); } if (b.y > H - R * 1.1) { b.y = H - R * 1.1; b.vy = -Math.abs(b.vy); }
      }
    }
    function draw() { for (const b of bubbles) b.el.style.transform = `translate(${(b.x - R).toFixed(1)}px, ${(b.y - R).toFixed(1)}px)`; }
    const loop = (t) => { const dt = Math.min(3, (t - (last || t)) / 16.7); last = t; step(dt); draw(); raf = requestAnimationFrame(loop); };
    const ro = new ResizeObserver(() => { if (Math.abs(field.clientWidth - W) > 4 || Math.abs(field.clientHeight - H) > 4) place(); });

    // ---- typing filters
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      for (const b of bubbles) { b.on = !q || b.a.id === 'add' || b.a.label.toLowerCase().split(' ').some((w) => w.startsWith(q)); b.el.classList.toggle('is-gone', !b.on); }
    });
    search.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const q = search.value.trim().toLowerCase();
      const hits = bubbles.filter((b) => b.on && b.a.id !== 'add' && b.a.id !== 'guest');
      const exact = hits.find((b) => b.a.label.toLowerCase() === q);
      if (exact || hits.length === 1) choose((exact || hits[0]).a);
      else if (q && !hits.length) openAdd(search.value.trim());
    });

    // ---- picked: the face big, a passcode pill, return logs in
    let pick = null;
    function choose(a) {
      if (a.id === 'add') return openAdd(search.value.trim());
      pick = a;
      sound.tick('pick');
      const pw = h('input.lock__pw', { type: 'text', placeholder: 'No passcode needed', 'aria-label': 'Passcode', autocomplete: 'off', spellcheck: false });
      pickView.replaceChildren(face(a), h('p.lock__big', a.label), a.blurb && h('p.lock__role', a.blurb),
        h('form.lock__form', { onsubmit: (e) => { e.preventDefault(); finish(); } }, pw, h('button.lock__go', { type: 'submit', 'aria-label': 'Log in' }, '→')),
        h('button.lock__back', { type: 'button', onclick: back }, '← Other accounts'));
      show('pick');
      setTimeout(() => pw.focus({ preventScroll: true }), 60);
    }
    function back() { pick = null; show('field'); setTimeout(() => search.focus({ preventScroll: true }), 30); }
    function show(which) {
      el.dataset.view = which;
      field.hidden = which !== 'field'; pickView.hidden = which !== 'pick'; addView.hidden = which !== 'add';
      el.querySelector('.lock__bottom').hidden = which !== 'field';
    }

    // ---- add your own account: a name and a selfie, kept on this device
    function openAdd(name = '') {
      sound.tick('pick');
      let photo = null;
      const nameIn = h('input.lock__pw.lock__name-in', { type: 'text', value: name, placeholder: 'Your name', 'aria-label': 'Your name', maxlength: '24', autocomplete: 'given-name' });
      const pic = h('span.lock__face.lock__face--add', h('span.lock__glyph', { 'aria-hidden': 'true' }, '+'));
      const file = h('input', { type: 'file', accept: 'image/*', capture: 'user', hidden: true });
      const snap = h('button.lock__back', { type: 'button', onclick: () => file.click() }, 'Take a selfie');
      file.addEventListener('change', async () => {
        const f = file.files?.[0]; if (!f) return;
        snap.textContent = 'Developing…';
        photo = stylise ? await stylise(f) : null;
        snap.textContent = photo ? 'Retake' : 'Take a selfie';
        if (photo) pic.replaceChildren(h('img', { src: photo, alt: 'Your selfie', width: 96, height: 96 }));
      });
      addView.onsubmit = (e) => {
        e.preventDefault();
        const label = nameIn.value.trim().slice(0, 24);
        if (!label) return nameIn.focus();
        const a = { id: 'me-' + Math.random().toString(36).slice(2, 9), label, blurb: 'Your account, on this device', src: photo };
        saveOwn([...ownAccounts(), a]);
        build();
        choose({ ...a, own: true });
      };
      addView.replaceChildren(h('button.lock__facebtn', { type: 'button', onclick: () => file.click(), 'aria-label': 'Take a selfie' }, pic), file,
        h('p.lock__big', 'New account'), h('p.lock__role', 'Your selfie stays on this device. Nothing is uploaded.'),
        h('div.lock__form', nameIn, h('button.lock__go', { type: 'submit', 'aria-label': 'Create account' }, '→')), snap,
        h('button.lock__back', { type: 'button', onclick: back }, '← Other accounts'));
      show('add');
      setTimeout(() => nameIn.focus({ preventScroll: true }), 60);
    }

    const finish = async () => {
      if (!pick) return;
      el.classList.add('is-out');
      clearInterval(clk); cancelAnimationFrame(raf); ro.disconnect(); stopHere();
      sound.tick('open');
      await wait(reduced ? 0 : 450);
      el.remove();
      desk?.classList.remove('is-locked');
      if (pick.id === 'guest') return resolve(null);
      const character = pick.team ? { ...pick.team } : { id: 'photo', label: pick.label, src: pick.src };
      try { localStorage.setItem('offthecv.visitor', JSON.stringify({ name: pick.label, character: pick.team ? pick.id : null })); } catch { /* this visit only */ }
      resolve({ name: pick.label, character: pick.src || pick.team ? character : null, photo: pick.team ? null : pick.src || null });
    };

    const desk = layer.closest('.desk');
    desk?.classList.add('is-locked');
    layer.append(el);
    show('field');
    build();
    ro.observe(field);
    if (!reduced) raf = requestAnimationFrame(loop);
    requestAnimationFrame(() => el.classList.add('is-on'));
  });
}

// ---------------------------------------------------------------- installed: open it, or it opens itself
// resolves when the visitor clicks Open (here or on the new desktop icon via `open`), or after `secs`
// on a phone there's no window: the icon wears a badge counting down (onCount), and tapping it opens the show
export function installed(wm, { secs = 60, reduced, onCount } = {}) {
  let go;
  const p = new Promise((r) => { go = r; });
  const w = isNarrow() ? null : wm.win('installed', { title: 'Installer', width: 380, y: 40, className: 'win--install', sheet: false });
  const left = h('b', String(secs));
  w?.body.append(h('div.inst',
    h('div.inst__head', h('img', { src: 'img/ui/offthecv.svg', alt: '', width: 40, height: 40 }), h('div', h('p.inst__t', 'Installation complete'), h('p.inst__s', '“OFF THE CV” is now on your desktop.'))),
    h('p.inst__doing', 'Open it now, or it opens by itself in ', left, ' seconds.'),
    h('div.inst__row', h('span.inst__note', 'Double-click its icon any time.'), h('button.btn.btn--primary', { type: 'button', onclick: () => go() }, 'Open'))));
  sound.tick('pick');
  let n = reduced ? 3 : secs;
  onCount?.(n);
  const t = setInterval(() => { n -= 1; left.textContent = String(Math.max(0, n)); onCount?.(Math.max(0, n)); if (n <= 0) go(); }, 1000);
  return { open: () => go(), done: p.then(() => { clearInterval(t); w?.close(); onCount?.(null); }) };
}
