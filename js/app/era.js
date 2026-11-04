// era.js — the first minute on the desktop, as 1999 did it. A jukebox is already playing a song
// that every PC had in its shared folder; OFF THE CV installs in the background with an
// installer that takes its time; when it's done the music fades out and the show launches itself.
// Also: one desktop icon per project, each opening the real thing in a new tab.
import { h, wait, isNarrow, clamp } from './util.js';
import { sound } from './audio.js';
import { presence } from '../presence.js';

// the jukebox: 60 songs from the shared folder of '99 (mostly 1997–99, a few earlier classics), 48 English and
// 12 Hindi pop. Each id is an upload that allows embedding (checked Nov 2026: playableInEmbed true, and each
// played in the hidden player); the player is audio only, the video never shows
const PLAYLIST = [
  { id: '1lyu1KKwC74', artist: 'The Verve', title: 'Bitter Sweet Symphony' },
  { id: 'VV1XWJN3nJo', artist: 'Natalie Imbruglia', title: 'Torn' },
  { id: 'Jnq9wPDoDKg', artist: 'Sixpence None the Richer', title: 'Kiss Me' },
  { id: 'E1fzJ_AYajA', artist: 'Len', title: 'Steal My Sunshine' },
  { id: 'ruAi4VBoBSM', artist: 'Fatboy Slim', title: 'Praise You' },
  { id: 'SSbBvKaM6sk', artist: 'Blur', title: 'Song 2' },
  { id: '2H5uWRjFsGc', artist: 'Chumbawamba', title: 'Tubthumping' },
  { id: 'gJLIiF15wjQ', artist: 'Spice Girls', title: 'Wannabe' },
  { id: '6M6samPEMpM', artist: 'Backstreet Boys', title: 'Everybody (Backstreet’s Back)' },
  { id: '_ZcmuKsyvzg', artist: '*NSYNC', title: 'Tearin’ Up My Heart' },
  { id: 'C-u5WLJ9Yk4', artist: 'Britney Spears', title: '...Baby One More Time' },
  { id: 'kIDWgqDBNXA', artist: 'Christina Aguilera', title: 'Genie in a Bottle' },
  { id: 'FrLequ6dUdM', artist: 'TLC', title: 'No Scrubs' },
  { id: 'NiF6-0UTqtc', artist: 'Destiny’s Child', title: 'Bills, Bills, Bills' },
  { id: 'T6QKqFPRZSA', artist: 'Lauryn Hill', title: 'Doo Wop (That Thing)' },
  { id: '3JcmQONgXJM', artist: 'Will Smith', title: 'Gettin’ Jiggy Wit It' },
  { id: 'fiBLgEx6svA', artist: 'Will Smith', title: 'Men in Black' },
  { id: 'EK_LN3XEcnw', artist: 'Lou Bega', title: 'Mambo No. 5' },
  { id: 'p47fEXGabaY', artist: 'Ricky Martin', title: 'Livin’ la Vida Loca' },
  { id: '_66jPJVS4JE', artist: 'Jennifer Lopez', title: 'Waiting for Tonight' },
  { id: 'nZXRV4MezEw', artist: 'Cher', title: 'Believe' },
  { id: 'x3ov9USxVxY', artist: 'Madonna', title: 'Ray of Light' },
  { id: '68ugkg9RePc', artist: 'Eiffel 65', title: 'Blue (Da Ba Dee)' },
  { id: '6Zbi0XmGtMw', artist: 'Vengaboys', title: 'We Like to Party!' },
  { id: 'ZyhrYis509A', artist: 'Aqua', title: 'Barbie Girl' },
  { id: 'L_jWHffIx5E', artist: 'Smash Mouth', title: 'All Star' },
  { id: '3cqU1pFRqYE', artist: 'Sugar Ray', title: 'Every Morning' },
  { id: 'beINamVRGy4', artist: 'Third Eye Blind', title: 'Semi-Charmed Life' },
  { id: 'xGytDsqkQY8', artist: 'Semisonic', title: 'Closing Time' },
  { id: 'NdYWuo9OFAw', artist: 'Goo Goo Dolls', title: 'Iris' },
  { id: 'mzJj5-lubeM', artist: 'Red Hot Chili Peppers', title: 'Scar Tissue' },
  { id: '6Whgn_iE5uc', artist: 'Santana ft. Rob Thomas', title: 'Smooth' },
  { id: 'NHozn0YXAeE', artist: 'Hanson', title: 'MMMBop' },
  { id: 'WQnAxOQxQIU', artist: 'Savage Garden', title: 'Truly Madly Deeply' },
  { id: 'nPXqkjpXZ_k', artist: 'All Saints', title: 'Never Ever' },
  { id: 'xcWOviMI6Lk', artist: 'Robbie Williams', title: 'Millennium' },
  { id: 'NI6aOFI7hms', artist: 'The Cardigans', title: 'Lovefool' },
  { id: 'mqFLXayD6e8', artist: 'Shania Twain', title: 'That Don’t Impress Me Much' },
  { id: '4fndeDfaWCg', artist: 'Backstreet Boys', title: 'I Want It That Way' },
  { id: '9Ht5RZpzPqw', artist: 'blink-182', title: 'All the Small Things' },
  { id: '6hzrDeceEKc', artist: 'Oasis', title: 'Wonderwall' },
  { id: 'PHzOOQfhPFg', artist: 'No Doubt', title: 'Just a Girl' },
  { id: 'fPO76Jlnz6c', artist: 'Coolio ft. L.V.', title: 'Gangsta’s Paradise' },
  { id: 'oKOtzIo-uYw', artist: 'Fugees', title: 'Killing Me Softly' },
  { id: 'Jne9t8sHpUc', artist: 'Alanis Morissette', title: 'Ironic' },
  { id: '0hiUuL5uTKc', artist: 'Montell Jordan', title: 'This Is How We Do It' },
  { id: 'HEXWRTEbj1I', artist: 'Haddaway', title: 'What Is Love' },
  { id: 'etviGf1uWlg', artist: 'Deee-Lite', title: 'Groove Is in the Heart' },
  // Hindi pop and Bollywood, the upbeat ones
  { id: '92ydUdqWE1g', artist: 'Daler Mehndi', title: 'Tunak Tunak Tun' },
  { id: 'h6Ze5Hqa1wA', artist: 'Daler Mehndi', title: 'Bolo Ta Ra Ra' },
  { id: 'dWqb-WqbGh8', artist: 'Lucky Ali', title: 'O Sanam' },
  { id: 'IvloHsmi_vg', artist: 'Alisha Chinai', title: 'Made in India' },
  { id: 'h6g9EoxKAdw', artist: 'Bombay Vikings', title: 'Kya Soorat Hai' },
  { id: 'cuMYU4bqZ_A', artist: 'Colonial Cousins', title: 'Sa Ni Dha Pa' },
  { id: 'ecPMVO7JuTo', artist: 'Silk Route', title: 'Dooba Dooba' },
  { id: 'nrT69Z1rlis', artist: 'Stereo Nation', title: 'Nachange Saari Raat' },
  { id: 'J8zlroVMYeM', artist: 'Sonu Nigam', title: 'Deewana Tera' },
  { id: '0tjVtYtZ384', artist: 'Falguni Pathak', title: 'Maine Payal Hai Chhankai' },
  { id: '8inhC8XvJS0', artist: 'Udit Narayan & Alka Yagnik', title: 'Koi Mil Gaya' },
  { id: '_rGz16v3CUM', artist: 'Bally Sagoo', title: 'Gur Nalon Ishq Mitha' },
];
// every visit gets its own shuffled order, so everyone walks in on a different song
const shuffled = (list) => { const a = list.slice(); for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; };
// the filename it would have had in a 1999 shared folder
const fileOf = (s) => (s.artist + '_-_' + s.title).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9()._-]+/g, '_').replace(/_+/g, '_') + '.mp3';

// projects on the desktop: the left column is five folders, every item opening a working page in a new tab.
// Where a project has no public page, it gets a short one on this site (sameep.ai/<slug>/). Icon: img/ui/proj-<id>.svg
// Hover cards: each item's copy is its data/work.json entry (`card`); a folder's own card is here.
export const FOLDERS = [
  { id: 'growth', label: 'Growth work', card: { what: 'Getting people talking before a launch or a sale', role: 'PM at Nykaa, chief of staff at Nailinit', proof: '+30% sale conversion at Nykaa', thumb: 'img/work/diwali/desktop-1.webp', node: 'g-intro' }, items: [
    { id: 'pinkbox', label: 'Nykaa Pink Box', url: 'pinkbox/' },
    { id: 'khushi', label: 'Khushi Kapoor launch', url: 'khushi-launch/' },
    { id: 'slumber', label: 'Secret Slumber Party', url: 'secretslumberparty/' },
    { id: 'diwali', label: 'Diwali invite', url: 'https://diwaliparty.live/' },
    { id: 'happydiwali', label: 'happydiwali.to', url: 'https://happydiwali.to/' },
  ] },
  // Switchboard is a folder of its own wrapps: the app, its public site and store, then the best wrapps built on it
  { id: 'switchboard', label: 'Switchboard', card: { what: 'Switchboard, its store, and the wrapps that run on it', role: 'Built all of it', proof: '90+ wrapps so far, none needing an API key', thumb: 'video/switchboard-poster.webp', node: 'sb-intro' }, items: [
    { id: 'switchboard', label: 'Switchboard', url: 'https://thelastprompt.ai/switchboard' },
    { id: 'thelastprompt', label: 'The Last Prompt', url: 'https://thelastprompt.ai/' },
    { id: 'brandbrain', label: 'Brand Brain', url: 'https://brandbrain.thelastprompt.ai' },
    { id: 'adforge', label: 'AdForge', url: 'https://adforge.thelastprompt.ai' },
    { id: 'adpulse', label: 'AdPulse', url: 'https://adpulse.thelastprompt.ai' },
    { id: 'reel', label: 'Reel', url: 'https://reel.thelastprompt.ai' },
    { id: 'marquee', label: 'Marquee', url: 'https://marquee.thelastprompt.ai' },
    { id: 'adgen', label: 'Adwall', url: 'https://adgen.thelastprompt.ai' },
    { id: 'aplus', label: 'A-Plus', url: 'https://aplus.thelastprompt.ai' },
    { id: 'prism', label: 'Prism', url: 'https://thelastprompt.ai/apps/prism-landing.html' },
    { id: 'cast', label: 'Cast', url: 'https://cast.thelastprompt.ai' },
    { id: 'take', label: 'Take', url: 'https://take.thelastprompt.ai' },
    { id: 'shelf', label: 'Shelf', url: 'https://shelf.thelastprompt.ai' },
    { id: 'batch', label: 'Batch', url: 'https://batch.thelastprompt.ai' },
    { id: 'copyflow', label: 'Copyflow', url: 'copyflow/' },
    { id: 'repurpose', label: 'Repurpose', url: 'repurpose/' },
    { id: 'reachout', label: 'Reachout', url: 'reachout/' },
  ] },
  { id: 'tools', label: 'Claude tools', card: { what: 'Small tools that make Claude better at my work', role: 'Built them for myself', proof: 'Four are open source on GitHub', thumb: 'video/video2ai-poster.webp', node: 'tools-intro' }, items: [
    { id: 'video2ai', label: 'video2ai', url: 'https://github.com/sameeeeeeep/video2ai' },
    { id: 'refs', label: '/refs', url: 'https://github.com/sameeeeeeep/references-mcp' },
    { id: 'asknotch', label: 'Ask Notch', url: 'https://github.com/sameeeeeeep/ask-notch' },
    { id: 'cut', label: 'Cut', url: 'cut/' },
    { id: 'annotate', label: 'Annotate', url: 'annotate/' },
    { id: 'cartridge', label: 'Cartridge', url: 'https://cartridge.thelastprompt.ai' },
    { id: 'pastedeck', label: 'PasteDeck', url: 'pastedeck/' },
  ] },
  { id: 'products', label: 'Products', card: { what: 'Products I built or co-founded', role: 'Founder, co-founder, builder', proof: 'ppt.live: 50 phones joined at once, zero errors', thumb: 'video/pptlive-poster.webp', node: 'ppt-intro' }, items: [
    { id: 'pptlive', label: 'ppt.live', url: 'https://www.ppt.live' },
    { id: 'often', label: 'Often', url: 'often/' },
    { id: 'trippy', label: 'Trippy', url: 'trippy/' },
    { id: 'nia', label: 'Nia', url: 'nia/' },
    { id: 'prophexy', label: 'Prophexy', url: 'https://thelastprompt.ai/prophexy/' },
  ] },
  { id: 'fun', label: 'Fun', card: { what: 'Side quests and half-finished things', role: 'Built for fun', proof: 'MacCat’s cats led to wallpap’s, then psspss', thumb: 'video/wallpap-poster.webp', node: 'fun-intro' }, items: [
    { id: 'wallpap', label: 'wallpap', url: 'https://wallpap.live' },
    { id: 'psspss', label: 'psspss', url: 'https://github.com/sameeeeeeep/psspss' },
    { id: 'agentbar', label: 'The Agent Bar', url: 'https://thelastprompt.ai/agentbreakroom/' },
    { id: 'maccat', label: 'MacCat', url: 'https://github.com/sameeeeeeep/maccat' },
    { id: 'bluetune', label: 'Bluetune', url: 'https://thelastprompt.ai/bluetune/' },
    { id: 'alter', label: 'Alter', url: 'https://github.com/sameeeeeeep/alter' },
    { id: 'vibedj', label: 'Vibe DJ', url: 'https://github.com/sameeeeeeep/vibe-dj' },
  ] },
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
  const Q = shuffled(PLAYLIST);  // this visit's order: Next, Previous and auto-advance all follow it
  let i = 0;
  const src = `https://www.youtube-nocookie.com/embed/${Q[0].id}?autoplay=1&enablejsapi=1&controls=0&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&mute=${sound.on ? 0 : 1}&origin=${encodeURIComponent(location.origin)}`;
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
    const s = Q[i];
    track.textContent = `${i + 1}. ${s.artist.toUpperCase()} - ${s.title.toUpperCase()} *** 1999 *** `.repeat(2);
    status.textContent = `Now playing · ${i + 1} of ${Q.length} · ${fileOf(s)}`;
    w.el.setAttribute('aria-label', `Jukebox ’99, now playing ${s.title} by ${s.artist}`);
  };
  const go = (n) => {
    i = (n + Q.length) % Q.length; lastGo = Date.now();
    t = 0; clock.textContent = '0:00';
    cmd('loadVideoById', [Q[i].id]);
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
// resolves when the install is done (about 3 s, and not before `ready`); "Skip" jumps to the end
// on a phone there's no window: the desktop icon fills up like an app downloading (onProgress), and tapping it skips (bindSkip)
export function installer(wm, { ready, minMs = 3000, reduced, onProgress, bindSkip } = {}) {
  const narrow = isNarrow();
  const w = narrow ? null : wm.win('install', { title: 'Installer', width: 400, y: 40, className: 'win--install', sheet: false });
  const steps = [
    ['Reading “OFF THE CV 1.0” disc…', 'Installer'],
    ['Checking for viruses (none, probably)…', 'Norton AntiVirus 5.0'],
    ['Copying 488 voice clips…', 'audio/clips/cold-open-01.mp3'],
    ['Teaching four hosts to lip-sync…', 'sprites/foyra.webp'],
    ['Removing CV.pdf…', 'CV.pdf → Trash'],
    ['Hanging 60 story nodes…', 'data/episode.json'],
    ['Seating the audience…', 'img/characters/'],
    ['Defragmenting the anecdotes…', 'stories.db'],
    ['Teaching Gus the offside rule…', 'hosts/gus.cfg'],
    ['Calibrating K-56’s anxiety…', 'hosts/k56.cfg'],
    ['Tuning Kimmy’s house band…', 'hosts/kimmy.cfg'],
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
    h('div.inst__row', h('span.inst__note', 'Projects are on the left, fun things and games on the right.'), h('button.btn', { type: 'button', onclick: () => skip() }, 'Skip'))));
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
      await wait(reduced || narrow ? 0 : 500);
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

export function openGames(wm) { openFolder(wm, { id: 'games', label: 'Games', items: GAMES }); }

// a Mac OS folder window: a grid of icons, each opening the real thing in a new tab
export function openFolder(wm, f) {
  // cascade like the Finder: each folder window that's already open pushes the next one down and right
  const width = f.items.length > 6 ? 500 : 420, area = document.querySelector('.desk__area')?.getBoundingClientRect();
  const n = document.querySelectorAll('.win--folder:not([hidden])').length;
  const at = area ? { x: (area.width - width) / 2 - 48 + n * 26, y: 48 + n * 26 } : {};
  const w = wm.win('folder-' + f.id, { title: f.label, width, className: 'win--folder', ...at });
  if (w.body.childElementCount) return;
  w.body.append(h('p.folder__bar', `${f.items.length} items · each opens in a new tab`),
    h('ul.folder__grid', f.items.map((g) => h('li', h('a.icon.icon--file', { href: g.url, target: '_blank', rel: 'noopener', dataset: { card: g.id }, onclick: () => sound.tick('click') },
      h('img', { src: `img/ui/${g.icon || 'proj-' + g.id}.svg`, alt: '', width: 48, height: 48, draggable: 'false' }),
      h('span.icon__label', g.label))))));
}

// ---------------------------------------------------------------- the lock screen
// After the modem connects, Mac OS asks who you are. Everyone floats as a bubble (ppt.live style:
// a little physics, they drift and nudge each other); type your name to filter, or tap your face.
// Wispr version: the whole team is there (data/wispr-team.json: first name, role, public photo, source).
// Tapping your bubble turns it green and lets you straight in; there's no passcode. Anyone not listed
// can add their own account (name + selfie); it lives on their device only and is there next time.
const ACCOUNTS = 'offthecv.accounts';
const ownAccounts = () => { try { return JSON.parse(localStorage.getItem(ACCOUNTS) || '[]'); } catch { return []; } };
const saveOwn = (list) => { try { localStorage.setItem(ACCOUNTS, JSON.stringify(list.slice(-4))); } catch { /* full or private: this visit only */ } };

export function login(layer, persona, { reduced, stylise } = {}) {
  return new Promise((resolve) => {
    const team = (persona.characters || []).filter((c) => c.team);
    let roster = null;  // the Wispr lobby: everyone on the team, from data/wispr-team.json
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
      // a teammate with an illustrated character (persona.json) also takes that seat in the audience
      const people = roster ? roster.map((m) => { const c = team.find((t) => t.id === m.id); return { id: m.id, label: m.name, blurb: m.role, src: m.photo || c?.thumb || null, team: c || null, member: true }; })
        : team.map((c) => ({ id: c.id, label: c.label, blurb: c.blurb, src: c.thumb || c.src, team: c }));
      const accounts = [...ownAccounts().map((a) => ({ ...a, own: true })), ...people,
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
    // motion, taken from the ppt.live lobby (show.html makePillWall + the .gpill pbob/ppop keyframes):
    // every face keeps cruising across the screen at 16–36 px/s (ppt's lane speeds), bobbing and tilting
    // on its own 4.2–7.2 s beat, and gently bounces off the edges and off each other. A few at a time:
    // every few seconds one drifts off an edge and a new face floats in from another. Typing pulls the
    // matches to the middle. Reduced motion: the same flow, slower, without the bob.
    let W = 0, H = 0, R = 58, raf = 0, last = 0, rot = 0, cap = 12, q = '';
    const SLOW = reduced ? 0.3 : 1;
    const always = (b) => b.a.id === 'add' || b.a.id === 'guest' || b.a.own;  // never rotated out
    const matches = (b) => b.a.id === 'add' || b.a.label.toLowerCase().split(' ').some((w) => w.startsWith(q));
    const hash = (str) => { let x = 0; for (const c of str) x = (x * 31 + c.charCodeAt(0)) | 0; return Math.abs(x); };
    function vis(b, on) { b.on = on; b.el.classList.toggle('is-gone', !on); b.el.tabIndex = on ? 0 : -1; b.el.setAttribute('aria-hidden', on ? 'false' : 'true'); }
    function cruise(b, ang = Math.random() * Math.PI * 2) {
      const i = hash(b.a.id), sp = (16 + ((i * 37) % 21)) * SLOW;       // ppt: speed = 16 + ((i*37) % 21) px/s
      b.sp = sp; b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp * 0.7;
      b.el.style.setProperty('--d', (4.2 + (i % 30) / 10) + 's');        // ppt: --d = 4.2 + (h%30)/10 s
      b.el.style.setProperty('--dl', (-(i % 50) / 10) + 's');            // ppt: --dl = -(h%50)/10 s
    }
    // the whole screen is the lobby, except two keep-out zones: the clock block up top and the name box
    // at the bottom. A face is its circle plus its name under it: [x-R, x+R] x [y-R, y+1.25R].
    let zones = [];
    const PAD = 14, FOOT = 1.25;
    function measure() {
      const F = field.getBoundingClientRect();
      zones = [el.querySelector('.lock__top'), el.querySelector('.lock__bottom')].filter((z) => z && !z.hidden).map((z) => {
        const r = z.getBoundingClientRect();
        return { l: r.left - F.left - PAD, t: r.top - F.top - PAD, r: r.right - F.left + PAD, b: r.bottom - F.top + PAD };
      });
    }
    const hits = (x, y, z) => x + R > z.l && x - R < z.r && y + R * FOOT > z.t && y - R < z.b;
    const free = (x, y) => !zones.some((z) => hits(x, y, z));
    // somewhere clear, fully on screen and out of the zones: the spot farthest from every face showing
    function spot() {
      const live = bubbles.filter((b) => b.on); let best = null, far = -1;
      for (let k = 0; k < 80; k++) {
        const x = R + Math.random() * Math.max(1, W - 2 * R), y = R + Math.random() * Math.max(1, H - (1 + FOOT) * R);
        if (!free(x, y)) continue;
        const d = live.reduce((m, b) => Math.min(m, Math.hypot(b.x - x, b.y - y)), Infinity);
        if (d > far) { far = d; best = [x, y]; }
      }
      return best || [W / 2, H / 2];
    }
    function place() {
      W = field.clientWidth; H = field.clientHeight;
      measure();
      const narrow = W < 500;
      R = narrow ? 40 : 58;
      field.style.setProperty('--bub', R + 'px');
      const room = W * H - zones.reduce((a, z) => a + (z.r - z.l) * (z.b - z.t), 0);
      cap = Math.max(narrow ? 5 : 6, Math.min(narrow ? 8 : 14, Math.floor(room / ((R * 3.6) ** 2))));
      bubbles.forEach((b) => { vis(b, false); b.leave = false; });
      const fixed = bubbles.filter(always), rest = bubbles.filter((b) => !always(b)).sort(() => Math.random() - 0.5);  // a different few each visit
      for (const b of [...fixed, ...rest.slice(0, Math.max(0, cap - fixed.length))]) { [b.x, b.y] = spot(); cruise(b); vis(b, true); }
      if (q) filter();
      draw();
    }
    // every few seconds one face fades out where it is and another fades in somewhere clear (paused while typing)
    function rotate() {
      if (q || pick || document.hidden) return;
      const out = bubbles.filter((b) => b.on && !always(b)), wait = bubbles.filter((b) => !b.on && !always(b));
      if (!out.length || !wait.length) return;
      vis(out[Math.floor(Math.random() * out.length)], false);
      const n = wait[Math.floor(Math.random() * wait.length)];
      [n.x, n.y] = spot(); cruise(n);
      vis(n, true); n.el.classList.remove('is-new'); void n.el.offsetWidth; n.el.classList.add('is-new');
    }
    // smooth and organic: a slow sine wander steers each face (no per-frame noise), neighbours, walls and
    // the two zones push through soft forces on the velocity (no snapping), and the speed eases back
    let clock = 0;
    function step(dt) {                                                 // dt in seconds
      clock += dt;
      const live = bubbles.filter((b) => b.on), gap = R * (q ? 2.3 : 2.7);
      const fx = new Map(live.map((b) => [b, [0, 0]]));
      for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
        const p = live[i], o = live[j], dx = o.x - p.x, dy = (o.y - p.y) * 0.72, d = Math.hypot(dx, dy) || 0.01;  // a name sits under each face: more room up and down
        if (d >= gap) continue;
        const k = ((gap - d) / gap) ** 2 * 90, nx = dx / d, ny = dy / d;
        fx.get(p)[0] -= nx * k; fx.get(p)[1] -= ny * k; fx.get(o)[0] += nx * k; fx.get(o)[1] += ny * k;
        if (d < gap * 0.62) { const c = (gap * 0.62 - d) * 0.5; p.x -= nx * c * dt * 4; p.y -= ny * c * dt * 4; o.x += nx * c * dt * 4; o.y += ny * c * dt * 4; }  // real overlap: ease apart
      }
      const lo = R, hi = H - R * FOOT, margin = R * 1.1;
      for (const b of live) {
        const f = fx.get(b);
        if (q) {                                                        // matches glide to the middle and settle
          f[0] += (W / 2 - b.x) * 1.6; f[1] += (H / 2 - b.y) * 1.6;
        } else {
          // soft walls at the screen edges
          if (b.x < R + margin) f[0] += ((R + margin - b.x) / margin) * 60; if (b.x > W - R - margin) f[0] -= ((b.x - (W - R - margin)) / margin) * 60;
          if (b.y < lo + margin) f[1] += ((lo + margin - b.y) / margin) * 60; if (b.y > hi - margin) f[1] -= ((b.y - (hi - margin)) / margin) * 60;
        }
        // the clock and the name box: a soft push away as a face comes near
        for (const z of zones) {
          const cx = clamp(b.x, z.l - R, z.r + R), cy = clamp(b.y, z.t - R * FOOT, z.b + R), ddx = b.x - cx, ddy = b.y - cy, dd = Math.hypot(ddx, ddy);
          if (dd < margin && dd > 0.01) { const k = ((margin - dd) / margin) * 90; f[0] += (ddx / dd) * k; f[1] += (ddy / dd) * k; }
        }
        if (q) {
          b.vx = (b.vx + f[0] * dt) * Math.pow(0.12, dt); b.vy = (b.vy + f[1] * dt) * Math.pow(0.12, dt);
        } else {
          // a slow, smooth wander: the heading turns along two sines, different for every face
          const ph = b.ph ?? (b.ph = Math.random() * 6.283), w = (Math.sin(clock * 0.35 + ph) * 0.5 + Math.sin(clock * 0.13 + ph * 2) * 0.35) * dt;
          const c = Math.cos(w), s2 = Math.sin(w); [b.vx, b.vy] = [b.vx * c - b.vy * s2, b.vx * s2 + b.vy * c];
          b.vx += f[0] * dt; b.vy += f[1] * dt;
          const v = Math.hypot(b.vx, b.vy) || 0.01, eased = v + (b.sp - v) * Math.min(1, 0.9 * dt);
          b.vx *= eased / v; b.vy *= eased / v;                         // never stops, never races
        }
        b.x += b.vx * dt; b.y += b.vy * dt;
        // safety only (the soft forces do the work): always fully on screen, never inside a zone
        b.x = clamp(b.x, R, W - R); b.y = clamp(b.y, lo, hi);
        for (const z of zones) if (hits(b.x, b.y, z)) {
          const out = [[z.l - R - b.x, 0], [z.r + R - b.x, 0], [0, z.t - R * FOOT - b.y], [0, z.b + R - b.y]].filter(([dx, dy]) => { const x = b.x + dx, y = b.y + dy; return x >= R && x <= W - R && y >= lo && y <= hi; });
          const m = out.sort((a, c) => Math.hypot(...a) - Math.hypot(...c))[0];
          if (m) { b.x += m[0]; b.y += m[1]; if (m[0]) b.vx = Math.sign(m[0]) * Math.abs(b.vx); if (m[1]) b.vy = Math.sign(m[1]) * Math.abs(b.vy); }
        }
      }
    }
    function draw() { for (const b of bubbles) if (b.on) b.el.style.transform = `translate3d(${(b.x - R).toFixed(1)}px, ${(b.y - R).toFixed(1)}px, 0)`; }
    const loop = (t) => { const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t; if (!pick) step(dt); draw(); raf = requestAnimationFrame(loop); };
    const ro = new ResizeObserver(() => { if (Math.abs(field.clientWidth - W) > 4 || Math.abs(field.clientHeight - H) > 4) place(); });

    // ---- typing filters: matches glide to the middle, the rest fade back
    function filter() {
      if (!q) { place(); return; }
      const hit = bubbles.filter(matches).slice(0, cap + 1);
      for (const b of bubbles) {
        const on = hit.includes(b);
        if (on && !b.on) { [b.x, b.y] = spot(); b.vx = b.vy = 0; }
        vis(b, on);
      }
    }
    search.addEventListener('input', () => { const was = q; q = search.value.trim().toLowerCase(); if (q !== was) filter(); });
    search.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const q = search.value.trim().toLowerCase();
      const hits = bubbles.filter((b) => b.on && b.a.id !== 'add' && b.a.id !== 'guest');
      const exact = hits.find((b) => b.a.label.toLowerCase() === q);
      if (exact || hits.length === 1) choose((exact || hits[0]).a);
      else if (q && !hits.length) openAdd(search.value.trim());
    });

    // ---- picked: your bubble turns green and you're in (no passcode)
    let pick = null;
    function choose(a) {
      if (a.id === 'add') return openAdd(search.value.trim());
      if (pick) return;
      pick = a;
      sound.tick('pick');
      const b = bubbles.find((x) => x.a.id === a.id);
      b?.el.classList.add('is-picked');
      if (b) { b.vx = b.vy = 0; }
      field.classList.add('has-pick');
      setTimeout(finish, reduced ? 150 : 650);
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
        show('field');
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
      clearInterval(clk); clearInterval(rot); cancelAnimationFrame(raf); ro.disconnect(); stopHere();
      sound.tick('open');
      await wait(reduced ? 0 : 450);
      el.remove();
      desk?.classList.remove('is-locked');
      document.dispatchEvent(new Event('otcv:unlock'));  // the menu-bar clock catches up
      if (pick.id === 'guest') return resolve(null);
      // team members without an illustrated character come in as their photo, keeping their w- id (Growth OS)
      const character = pick.team ? { ...pick.team } : { id: pick.member ? pick.id : 'photo', label: pick.label, src: pick.src };
      try { localStorage.setItem('offthecv.visitor', JSON.stringify({ name: pick.label, character: pick.team || pick.member ? pick.id : null })); } catch { /* this visit only */ }
      resolve({ name: pick.label, character: pick.src || pick.team || pick.member ? character : null, photo: pick.team ? null : pick.src || null });
    };

    const desk = layer.closest('.desk');
    desk?.classList.add('is-locked');
    layer.append(el);
    show('field');
    build();
    if (team.length) fetch('data/wispr-team.json').then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.team?.length && !pick) { roster = d.team; build(); } }).catch(() => {});
    ro.observe(field);
    raf = requestAnimationFrame(loop);  // reduced motion: same flow, slower (SLOW), no bob
    rot = setInterval(rotate, reduced ? 6000 : 3000);
    requestAnimationFrame(() => el.classList.add('is-on'));
  });
}

// ---------------------------------------------------------------- installed: open it, or it opens itself
// resolves when the visitor clicks Open (here or on the new desktop icon via `open`), or after `secs`
// on a phone there's no window: the icon wears a badge counting down (onCount), and tapping it opens the show
export function installed(wm, { secs = 15, onCount, hold = () => false, layer } = {}) {
  // The install is done: Open goes straight in; otherwise a visible countdown opens the show by itself.
  // "Stay on the desktop" cancels it, and then the icon just waits to be opened. The countdown holds
  // while hold() is true (the desktop tour is showing), so it never cuts the tour short.
  let go;
  const p = new Promise((r) => { go = r; });
  const narrow = isNarrow();
  const left = h('b', String(secs));
  const line = h('p.inst__doing', 'Opens by itself in ', left, ' s');
  let n = secs, t = 0, held = false;
  const stop = (fromClose) => {
    clearInterval(t); t = 0;
    onCount?.(null);
    if (fromClose !== true) w?.close();
    bar?.remove();
  };
  const btns = () => [h('button.btn', { type: 'button', onclick: () => stop() }, narrow ? 'Not yet' : 'Stay on the desktop'), h('button.btn.btn--primary', { type: 'button', onclick: () => go() }, 'Open')];
  const w = narrow ? null : wm.win('installed', { title: 'Installer', width: 420, y: 40, className: 'win--install', sheet: false, onClose: () => { if (t) stop(true); } });
  w?.body.append(h('div.inst',
    h('div.inst__head', h('img', { src: 'img/ui/offthecv.svg', alt: '', width: 40, height: 40 }), h('div', h('p.inst__t', 'Installation complete'), h('p.inst__s', '“OFF THE CV” is on your desktop. Open its icon any time.'))),
    line,
    h('div.inst__row.inst__row--end', ...btns())));
  // phone: no window, so a small bar under the grid does the same job as the badge on the icon
  const bar = narrow ? h('div.inst-bar', { role: 'status' }, h('img', { src: 'img/ui/offthecv.svg', alt: '', width: 28, height: 28 }), h('p', h('b', 'OFF THE CV'), ' opens in ', left, ' s'), ...btns()) : null;
  if (bar) (layer || document.querySelector('.desk__area'))?.append(bar);
  sound.tick('pick');
  onCount?.(n);
  const sync = () => {
    const h0 = hold();
    if (h0 !== held) { held = h0; bar?.classList.toggle('is-held', held); if (w) line.replaceChildren(...(held ? ['Opens by itself ', left, ' s after the tour'] : ['Opens by itself in ', left, ' s'])); }
    return held;
  };
  sync();
  t = setInterval(() => {
    if (sync()) return;
    n -= 1; left.textContent = String(Math.max(0, n)); onCount?.(Math.max(0, n));
    if (n <= 0) go();
  }, 1000);
  return { open: () => go(), done: p.then(() => { clearInterval(t); t = 0; w?.close(); bar?.remove(); onCount?.(null); }) };
}
