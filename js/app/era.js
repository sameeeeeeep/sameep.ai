// era.js — the first minute on the desktop, as 1999 did it. The amp player is already playing a song
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

// projects on the desktop: the left column is five folders, every item opening a working page in a new tab.
// Where a project has no public page, it gets a short one on this site (sameep.ai/<slug>/). Icon: img/ui/proj-<id>.svg
// Hover cards: each item's copy is its data/work.json entry (`card`); a folder's own card is here.
export const FOLDERS = [
  { id: 'growth', label: 'Growth work', card: { what: 'Getting people talking before a launch or a sale', proof: '+30% sale conversion at Nykaa', thumb: 'img/work/diwali/desktop-1.webp', node: 'g-intro' }, items: [
    { id: 'pinkbox', label: 'Nykaa Pink Box', url: 'pinkbox/' },
    { id: 'khushi', label: 'Khushi Kapoor launch', url: 'khushi-launch/' },
    { id: 'slumber', label: 'Secret Slumber Party', url: 'secretslumberparty/' },
    { id: 'diwali', label: 'Diwali invite', url: 'https://diwaliparty.live/' },
    { id: 'happydiwali', label: 'happydiwali.to', url: 'https://happydiwali.to/' },
  ] },
  // Switchboard is a folder of its own wrapps: the app, its public site and store, then the best wrapps built on it
  { id: 'switchboard', label: 'Switchboard', card: { what: 'Switchboard, its store, and the wrapps that run on it', proof: '90+ wrapps so far, none needing an API key', thumb: 'video/switchboard-poster.webp', node: 'sb-intro' }, items: [
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
  { id: 'tools', label: 'Claude tools', card: { what: 'Small tools that make Claude better at my work', proof: 'Four are open source on GitHub', thumb: 'video/video2ai-poster.webp', node: 'tools-intro' }, items: [
    { id: 'video2ai', label: 'video2ai', url: 'https://github.com/sameeeeeeep/video2ai' },
    { id: 'refs', label: '/refs', url: 'https://github.com/sameeeeeeep/references-mcp' },
    { id: 'asknotch', label: 'Ask Notch', url: 'https://github.com/sameeeeeeep/ask-notch' },
    { id: 'cut', label: 'Cut', url: 'cut/' },
    { id: 'annotate', label: 'Annotate', url: 'annotate/' },
    { id: 'cartridge', label: 'Cartridge', url: 'https://cartridge.thelastprompt.ai' },
    { id: 'pastedeck', label: 'PasteDeck', url: 'pastedeck/' },
  ] },
  { id: 'products', label: 'Products', card: { what: 'Products, from live shows to travel hacking', proof: 'ppt.live: 50 phones joined at once, zero errors', thumb: 'video/pptlive-poster.webp', node: 'ppt-intro' }, items: [
    { id: 'pptlive', label: 'ppt.live', url: 'https://www.ppt.live' },
    { id: 'often', label: 'Often', url: 'often/' },
    { id: 'trippy', label: 'Trippy', url: 'trippy/' },
    { id: 'nia', label: 'Nia', url: 'nia/' },
    { id: 'prophexy', label: 'Prophexy', url: 'https://thelastprompt.ai/prophexy/' },
  ] },
  { id: 'fun', label: 'Fun', card: { what: 'Side quests and half-finished things', proof: 'MacCat’s cats led to wallpap’s, then psspss', thumb: 'video/wallpap-poster.webp', node: 'fun-intro' }, items: [
    { id: 'wallpap', label: 'wallpap', url: 'https://wallpap.live' },
    { id: 'agentbar', label: 'The Agent Bar', url: 'https://thelastprompt.ai/agentbreakroom/' },
    { id: 'maccat', label: 'MacCat', url: 'https://github.com/sameeeeeeep/maccat' },
    { id: 'bluetune', label: 'Bluetune', url: 'https://thelastprompt.ai/bluetune/' },
    { id: 'alter', label: 'Alter', url: 'https://github.com/sameeeeeeep/alter' },
    { id: 'vibedj', label: 'Vibe DJ', url: 'https://github.com/sameeeeeeep/vibe-dj' },
  ] },
];

// the best of the folders, out on the desktop where they can be seen (the folders keep the long tail).
// psspss sits here on its own: it isn't a side quest any more
const every = () => FOLDERS.flatMap((f) => f.items);
const SHORT = { slumber: 'Slumber Party' };  // desktop labels get two short lines
export const STARS = [
  { id: 'psspss', label: 'psspss', url: 'https://github.com/sameeeeeeep/psspss' },
  ...['slumber', 'diwali', 'pptlive', 'agentbar', 'wallpap'].map((id) => every().find((g) => g.id === id)).filter(Boolean),
].map((g) => ({ ...g, label: SHORT[g.id] || g.label, card: g.id }));

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------------------------------------------------------------- the jukebox
// a parody of the 1999 amp players: its own skin, a spectrum, a seek bar, a track line. The name lives
// here only, so renaming it is one line
export const PLAYER = { name: 'Macster', ver: '2.99' };
export function jukebox(wm, { reduced } = {}) {
  const narrow = isNarrow();
  // bottom left, just clear of the projects column; on a phone it hangs from the menu bar like a live activity
  const layer = document.querySelector('.desk__area');
  const col = document.querySelector('.icons--proj')?.getBoundingClientRect(), area = layer?.getBoundingClientRect();
  const x = col && area && !narrow ? col.right - area.left + 14 : 16;
  // audio only: the YouTube player is mounted invisibly (it has to be on screen to play); the LCD is the only UI
  const host = h('div.juke__host', { 'aria-hidden': 'true' });
  const w = wm.win('jukebox', { title: `${PLAYER.name} ${PLAYER.ver}`, width: 340, x, y: 9999, className: 'win--juke' + (narrow ? ' win--island' : ''), sheet: false,
    onClose: () => { host.remove(); layer?.classList.remove('has-island'); removeEventListener('message', onMsg); off?.(); clearInterval(timer); } });
  if (narrow) layer?.classList.add('has-island');
  const Q = shuffled(PLAYLIST);  // this visit's order: Next, Previous and auto-advance all follow it
  let i = 0;
  const src = `https://www.youtube-nocookie.com/embed/${Q[0].id}?autoplay=1&enablejsapi=1&controls=0&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&mute=${sound.on ? 0 : 1}&origin=${encodeURIComponent(location.origin)}`;
  const frame = h('iframe.juke__vid', { src, title: `${PLAYER.name} (audio)`, allow: 'autoplay; encrypted-media', referrerpolicy: 'strict-origin-when-cross-origin', tabindex: '-1' });
  const post = (msg) => { try { frame.contentWindow?.postMessage(JSON.stringify(msg), '*'); } catch { /* not ready */ } };
  const cmd = (func, args = []) => post({ event: 'command', func, args });
  const clock = h('span.juke__time', '0:00');
  const state = h('span.juke__state', '▶');
  const track = h('span.juke__track');
  const marquee = h('div.juke__marquee', track);
  const status = h('p.juke__status');
  const seekFill = h('i');
  const seek = h('div.juke__seek', { 'aria-hidden': 'true' }, seekFill);
  const bars = h('div.juke__bars', { 'aria-hidden': 'true' }, Array.from({ length: 14 }, (_, k) => h('i', { style: { animationDelay: (-(k * 37) % 900) + 'ms' } })));
  let t = 0, dur = 0, playing = true, timer = 0, live = false, lastGo = 0;
  const paint = () => { clock.textContent = fmt(t); seekFill.style.transform = `scaleX(${dur ? Math.min(1, t / dur).toFixed(3) : 0})`; };
  // the clock ticks locally, and snaps to the player's own time whenever it reports one
  const run = () => { clearInterval(timer); timer = setInterval(() => { if (playing) { t += 1; paint(); } }, 1000); };
  const setPlaying = (on, label) => { playing = on; w.el.classList.toggle('is-playing', on); state.textContent = label || (on ? '▶' : '❚❚'); toggle.textContent = on ? '❚❚' : '▶'; toggle.setAttribute('aria-label', on ? 'Pause' : 'Play'); };
  const show = () => {
    const s = Q[i];
    track.textContent = `${i + 1}. ${s.artist.toUpperCase()} - ${s.title.toUpperCase()} *** ${PLAYER.name.toUpperCase()} *** `.repeat(2);
    status.textContent = `Track ${i + 1} of ${Q.length} · ${s.artist}`;
    w.el.setAttribute('aria-label', `${PLAYER.name}, now playing ${s.title} by ${s.artist}`);
  };
  const go = (n) => {
    i = (n + Q.length) % Q.length; lastGo = Date.now();
    t = 0; dur = 0; paint();
    cmd('loadVideoById', [Q[i].id]);
    setPlaying(true); show(); sound.tick('click');
  };
  // the player can report one ending twice, and the old track's end can arrive just after a skip: ignore those
  const ended = (grace = 2500) => { if (Date.now() - lastGo > grace) go(i + 1); };
  const next = () => go(i + 1), prev = () => (t > 3 ? (cmd('seekTo', [0, true]), t = 0, paint()) : go(i - 1));
  const toggle = h('button.juke__toggle', { type: 'button', 'aria-label': 'Pause', onclick: (e) => { e.stopPropagation(); if (playing) { cmd('pauseVideo'); setPlaying(false); } else { cmd('playVideo'); setPlaying(true); } } }, '❚❚');
  const skip = h('button.juke__toggle.juke__skip', { type: 'button', 'aria-label': 'Next track', onclick: (e) => { e.stopPropagation(); next(); } }, '⏭');
  const btn = (txt, aria, fn) => h('button.juke__btn', { type: 'button', 'aria-label': aria, title: aria, onclick: (e) => { e.stopPropagation(); fn(); } }, txt);
  const vol = h('input.juke__vol', { type: 'range', min: '0', max: '100', value: '100', 'aria-label': 'Volume', title: 'Volume' });
  vol.addEventListener('input', () => cmd('setVolume', [+vol.value]));
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
      if (typeof d.info.duration === 'number' && d.info.duration > 0) dur = d.info.duration;
      if (typeof d.info.currentTime === 'number' && d.info.currentTime > 0) t = Math.floor(d.info.currentTime);
      paint();
    }
  }
  addEventListener('message', onMsg);
  host.append(frame);
  (layer || w.el).append(host);
  w.body.append(h('div.juke',
    h('div.juke__lcd',
      h('div.juke__row', state, clock, h('span.juke__kbps', h('b', '128'), ' kbps ', h('b', '44'), ' kHz ', h('em', 'stereo'))),
      marquee, bars, toggle, skip),
    seek,
    h('div.juke__ctrl',
      btn('⏮', 'Previous track', prev),
      btn('▶', 'Play', () => { cmd('playVideo'); setPlaying(true); }),
      btn('❚❚', 'Pause', () => { cmd('pauseVideo'); setPlaying(false); }),
      btn('■', 'Stop', () => { cmd('pauseVideo'); cmd('seekTo', [0, true]); t = 0; paint(); setPlaying(false, '■'); }),
      btn('⏭', 'Next track', next),
      vol),
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
      const steps = 13, from = +vol.value;
      for (let k = steps; k >= 0; k--) { cmd('setVolume', [Math.round((k / steps) * from)]); await wait(ms / steps); }
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
    h('div.inst__row', h('span.inst__note', 'My work is on the left. Toys and games are on the right.'), h('button.btn', { type: 'button', onclick: () => skip() }, 'Skip'))));
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

// ---------------------------------------------------------------- the games
// three I made in the spirit of '99 (js/app/games/*.js, each in its own window), then the classics
const GAME_MODS = { moto: () => import('./games/moto.js'), snake: () => import('./games/snake.js'), breakout: () => import('./games/breakout.js') };
export const MY_GAMES = [
  { id: 'moto', label: 'Moto Thappad' },
  { id: 'snake', label: 'Samosa Snake' },
  { id: 'breakout', label: 'Rangoli Breakout' },
];
// the real ones, out on the desktop: each plays in the browser on the Internet Archive (emulated, nothing to
// install) and opens in a new tab. Icons are drawn here, not the box art
const IA = (id) => `https://archive.org/details/${id}`;
export const CLASSICS = [
  { id: 'roadrash', label: 'Road Rash', url: IA('sg_Road_Rash_1991_Electronic_Arts_EU-US_en') },
  { id: 'doom', label: 'DOOM', url: IA('msdos_DOOM_1993') },
  { id: 'prince', label: 'Prince of Persia', url: IA('msdos_Prince_of_Persia_1990') },
  { id: 'simcity', label: 'SimCity', url: IA('msdos_SimCity_1989') },
  { id: 'darkforces', label: 'Dark Forces', url: IA('star-wars-dark-forces_201612') },
];
// the folder: the classics above plus a few more that still run in a browser
export const GAMES = [
  ...CLASSICS,
  { id: 'minesweeper', label: 'Minesweeper', url: 'https://minesweeper.online/' },
  { id: 'solitaire', label: 'Solitaire', url: 'https://www.solitr.com/' },
  { id: 'skifree', label: 'SkiFree', url: 'https://basicallydan.github.io/skifree.js/' },
  { id: 'tetris', label: 'Tetris', url: 'https://tetris.com/play-tetris' },
  { id: 'pacman', label: 'Pac-Man', url: 'https://www.google.com/logos/2010/pacman10-i.html' },
];

// one of mine in a window of its own; closing the window stops the game
export async function openGame(wm, id, { reduced } = {}) {
  const was = wm.get('game-' + id);
  if (was) { was.focus(); return was; }
  const m = await GAME_MODS[id]?.();
  if (!m) return null;
  let game = null;
  const w = wm.win('game-' + id, { title: m.meta.title, width: m.meta.width, className: 'win--game', onClose: () => game?.destroy() });
  const host = h('div.game', { tabindex: '0' });
  w.body.append(host);
  game = m.mount(host, { reduced, narrow: isNarrow() });
  // the window was placed while it was empty: now the canvas is in, centre it on its real height
  const layer = w.el.parentElement;
  if (!isNarrow() && layer) requestAnimationFrame(() => { w.el.style.top = Math.max(12, (layer.clientHeight - w.el.offsetHeight) / 2) + 'px'; });
  host.focus({ preventScroll: true });
  return w;
}

export function openGames(wm, opts) {
  openFolder(wm, { id: 'games', label: 'Games', items: [...MY_GAMES.map((g) => ({ ...g, open: () => openGame(wm, g.id, opts) })), ...GAMES] });
}

// a Mac OS folder window: a grid of icons, each opening the real thing in a new tab
export function openFolder(wm, f) {
  // cascade like the Finder: each folder window that's already open pushes the next one down and right
  const width = f.items.length > 6 ? 500 : 420, area = document.querySelector('.desk__area')?.getBoundingClientRect();
  const n = document.querySelectorAll('.win--folder:not([hidden])').length;
  const at = area ? { x: (area.width - width) / 2 - 48 + n * 26, y: 48 + n * 26 } : {};
  const w = wm.win('folder-' + f.id, { title: f.label, width, className: 'win--folder', ...at });
  if (w.body.childElementCount) return;
  const img = (g) => h('img', { src: `img/ui/${g.icon || 'proj-' + g.id}.svg`, alt: '', width: 48, height: 48, draggable: 'false' });
  const mine = f.items.filter((g) => g.open).length;
  w.body.append(h('p.folder__bar', `${f.items.length} items · ` + (mine ? `${mine} play here, the rest open in a new tab` : 'each opens in a new tab')),
    h('ul.folder__grid', f.items.map((g) => h('li', g.open
      ? h('button.icon.icon--file', { type: 'button', dataset: { card: g.id }, onclick: () => { sound.tick('click'); g.open(); } }, img(g), h('span.icon__label', g.label))
      : h('a.icon.icon--file', { href: g.url, target: '_blank', rel: 'noopener', dataset: { card: g.id }, onclick: () => sound.tick('click') }, img(g), h('span.icon__label', g.label))))));
}

// ---------------------------------------------------------------- the lock screen
// After the modem connects, Mac OS asks who you are. Everyone is a bobbing bubble in a loose crowd that
// takes turns on screen (the Slumber Party wall's way: kept elements, CSS motion); type to filter, or tap your face.
// Wispr version: the whole team is there (data/wispr-team.json: first name, role, public photo, source).
// Tapping your bubble turns it green and lets you straight in; there's no passcode. Anyone not listed
// can add their own account (name + selfie); it lives on their device only and is there next time.
const ACCOUNTS = 'offthecv.accounts';
const ownAccounts = () => { try { return JSON.parse(localStorage.getItem(ACCOUNTS) || '[]'); } catch { return []; } };
const saveOwn = (list) => { try { localStorage.setItem(ACCOUNTS, JSON.stringify(list.slice(-4))); } catch { /* full or private: this visit only */ } };

// hold: a capture scene (?scene=lock): no auto-guest countdown
export function login(layer, persona, { reduced, stylise, hold = false } = {}) {
  return new Promise((resolve) => {
    const team = (persona.characters || []).filter((c) => c.team);
    // the lobby's "Name · Role" tooltips are set in Wispr's Figtree
    if (team.length && !document.getElementById('font-figtree')) document.head.append(h('link#font-figtree', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Figtree:wght@500;700&display=swap' }));
    let roster = null;  // the Wispr lobby: everyone on the team, from data/wispr-team.json
    const time = h('p.lock__time'), date = h('p.lock__date'), online = h('p.lock__online', { style: 'visibility:hidden' }, 'Just you in the room right now');
    const tick = () => { const d = new Date(); time.textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, ''); date.textContent = d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }); };
    tick(); const clk = setInterval(tick, 15000);
    const stopHere = presence((n) => { online.style.visibility = n ? '' : 'hidden'; online.textContent = n > 1 ? `${n} in the room right now` : 'Just you in the room right now'; });

    const field = h('div.lock__field', { role: 'listbox', 'aria-label': 'Accounts' });
    // a teammate who came in before (offthecv.visitor, written at finish) is welcomed back by name
    const before = (() => { try { const v = JSON.parse(localStorage.getItem('offthecv.visitor') || 'null'); return typeof v?.character === 'string' && v.character.startsWith('w-') ? v : null; } catch { return null; } })();
    const ask = h('p.lock__ask', team.length ? (before ? `Welcome back, ${before.name}` : 'Find your face') : 'Who’s coming in?');
    const search = h('input.lock__search', { type: 'text', placeholder: 'Type your name', hidden: !team.length, 'aria-label': 'Your name', autocomplete: 'off', spellcheck: false, enterkeyhint: 'go' });
    let hintText = before ? 'Tap your face to go in' : '';
    const hint = h('p.lock__hint', hintText);
    const pickView = h('div.lock__picked', { hidden: true });
    const addView = h('form.lock__add', { hidden: true });
    // skip, and the auto-guest: 20 s with nobody touching anything shows a 15 s countdown, then in as a guest.
    // Typing, hovering a face, a click or a key cancels it (and the 20 s start again); "Stay here" turns it off.
    const skip = h('button.lock__skip', { type: 'button', hidden: !team.length, onclick: () => guestIn(false, true) }, 'Continue as guest →');
    const left = h('b', '15');
    const auto = h('div.lock__auto', { role: 'status', hidden: true },
      h('span', h('span.lock__as', 'Going in as a guest in '), left, ' s'),
      h('button', { type: 'button', onclick: () => { autoOff = true; stopAuto(); if (team.length) search.focus({ preventScroll: true }); } }, 'Stay'),
      h('button', { type: 'button', onclick: () => guestIn(false) }, 'Go now'));
    const el = h('div.lock', { role: 'dialog', 'aria-label': 'Log in' },
      // the plain route has only two bubbles: its question sits under the clock, above them
      h('div.lock__top', time, date, online, !team.length && ask),
      h('div.lock__mid', field, pickView, addView, h('div.lock__bottom', team.length && ask, search, hint, auto, skip)));
    const IDLE = 20000, COUNT = 15;
    let idleT = 0, cdT = 0, autoOff = hold;
    // the countdown makes the name box taller: the faces' keep-out zone is measured again whenever it shows or goes
    function stopAuto() { clearTimeout(idleT); clearInterval(cdT); idleT = cdT = 0; if (!auto.hidden) { auto.hidden = true; measure(); } }
    // only on the faces screen with an empty name box: someone who typed a name or opened "add account" is still deciding
    function arm() { stopAuto(); if (!autoOff && !pick && !q && el.dataset.view === 'field') idleT = setTimeout(countdown, IDLE); }
    function countdown() {
      if (autoOff || pick || q || el.dataset.view !== 'field') return;
      if (document.hidden) { idleT = setTimeout(countdown, 1000); return; }  // wait until they can see it
      const back = bubbles.find((b) => b.a.back)?.a;
      auto.querySelector('.lock__as').textContent = back ? `Going in as ${back.label} in ` : 'Going in as a guest in ';
      let n = COUNT; left.textContent = n; auto.hidden = false; measure();
      cdT = setInterval(() => {
        if (document.hidden) return;
        left.textContent = --n;
        if (n <= 0) { stopAuto(); guestIn(true); }
      }, 1000);
    }
    const nudge = (e) => { if (!e.target.closest?.('.lock__auto')) arm(); };
    for (const t of ['pointerdown', 'keydown', 'input', 'touchstart', 'wheel']) el.addEventListener(t, nudge, { passive: true, capture: true });
    // a moving mouse anywhere on the lock screen means someone's there; only real movement counts (the faces
    // drift under a still mouse all the time), checked at most four times a second
    let movedAt = 0;
    // (by position: the curved CRT's hit glass replays moves as synthetic events with no movementX/Y)
    let lx = -1, ly = -1;
    el.addEventListener('pointermove', (e) => { if (e.clientX === lx && e.clientY === ly) return; lx = e.clientX; ly = e.clientY; if (e.timeStamp - movedAt < 250) return; movedAt = e.timeStamp; nudge(e); }, { passive: true });
    // hover as a class, not :hover: under the curved CRT the real pointer sits on the hit glass, which only
    // replays pointerover/pointerout to the faces
    // a face near the top of the screen shows its tooltip under the face instead (the field clips above)
    // and one near a side edge slides its tooltip in (the arrow still points at the face)
    const flip = (u) => {
      const t = u?.querySelector('.lock__tip'); if (!t) return;
      const ub = u.getBoundingClientRect(), fb = field.getBoundingClientRect(), mid = ub.left + ub.width / 2, half = t.offsetWidth / 2;
      u.classList.toggle('is-low', ub.top - fb.top < t.offsetHeight + 14);
      const tx = Math.max(fb.left + 6 - (mid - half), Math.min(0, fb.right - 6 - (mid + half)));
      t.style.setProperty('--tx', Math.round(tx) + 'px');
    };
    el.addEventListener('pointerover', (e) => { const u = e.target.closest?.('.lock__user'); if (u) { flip(u); u.classList.add('is-hover'); } });
    el.addEventListener('focusin', (e) => flip(e.target.closest?.('.lock__user')));
    el.addEventListener('pointerout', (e) => { const u = e.target.closest?.('.lock__user'); if (u && !u.contains(e.relatedTarget)) u.classList.remove('is-hover'); });
    // touch: a long press (450 ms) shows that face's "Name · Role" tooltip for a moment instead of picking it
    let lpT = 0, lpEl = null, lpHit = false, tipT = 0;
    const tipOff = () => { el.querySelectorAll('.lock__user.is-tip').forEach((u) => u.classList.remove('is-tip')); };
    el.addEventListener('pointerdown', (e) => {
      const u = e.pointerType !== 'mouse' && e.target.closest?.('.lock__user');
      clearTimeout(lpT); lpHit = false; lpEl = u || null;
      if (!u || !u.querySelector('.lock__tip')) return;
      lpT = setTimeout(() => { lpHit = true; tipOff(); flip(u); u.classList.add('is-tip'); clearTimeout(tipT); tipT = setTimeout(() => u.classList.remove('is-tip'), 2200); }, 450);
    });
    const lpEnd = () => clearTimeout(lpT);
    el.addEventListener('pointerup', lpEnd); el.addEventListener('pointercancel', lpEnd);
    el.addEventListener('pointermove', (e) => { if (lpEl && e.pointerType !== 'mouse' && (Math.abs(e.movementX) + Math.abs(e.movementY) > 6)) lpEnd(); });
    el.addEventListener('contextmenu', (e) => { if (e.target.closest?.('.lock__user')) e.preventDefault(); });
    el.addEventListener('click', (e) => { if (lpHit && e.target.closest?.('.lock__user') === lpEl) { e.preventDefault(); e.stopImmediatePropagation(); lpHit = false; } }, true);
    // the countdown goes in as the returning teammate when there is one; the skip button is always a guest
    function guestIn(isAuto, asGuest = false) {
      const back = !asGuest && bubbles.find((b) => b.a.back)?.a;
      if (back) return choose({ ...back, auto: isAuto });
      const g = bubbles.find((b) => b.a.id === 'guest')?.a || { id: 'guest', label: 'Guest' };
      choose({ ...g, auto: isAuto });
    }

    // ---- bubbles
    let bubbles = [];
    // photos load the first time a face is shown (the team is ~140 people, a dozen on screen at once);
    // a teammate with no public photo gets their initials on a colour of their own
    const initials = (s) => s.split(/[\s.-]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
    const face = (a) => a.src ? h('span.lock__face', h('img', { dataset: { src: a.src }, alt: '', width: 96, height: 96, decoding: 'async' }))
      : a.member ? h('span.lock__face.lock__face--ini', { style: `--hue:${hash(a.id) % 360}` }, h('span.lock__glyph', { 'aria-hidden': 'true' }, initials(a.label)))
      : h('span.lock__face', h('span.lock__glyph', { 'aria-hidden': 'true' }, a.glyph ?? (a.label || '?')[0].toUpperCase()));
    function build() {
      // a teammate with an illustrated character (persona.json) also takes that seat in the audience
      const people = roster ? roster.map((m) => { const c = team.find((t) => t.id === m.id); return { id: m.id, label: m.name, blurb: m.role, tag: m.tag, src: m.photo || c?.thumb || null, team: c || null, member: true }; })
        : team.map((c) => ({ id: c.id, label: c.label, blurb: c.blurb, src: c.thumb || c.src, team: c }));
      if (before) { const i = people.findIndex((m) => m.id === before.character); if (i >= 0) people.unshift({ ...people.splice(i, 1)[0], back: true });
        else if (roster) { ask.textContent = 'Find your face'; hintText = ''; if (!q) hint.textContent = ''; } }  // no longer on the team list
      // Wispr: the + bubble and the "Continue as guest" button; the plain route: two bubbles, guest or add
      const accounts = [...ownAccounts().map((a) => ({ ...a, own: true })), ...people,
        { id: 'add', label: 'Add yours', blurb: 'Name + selfie', glyph: '+' }, ...(team.length ? [] : [{ id: 'guest', label: 'Guest', blurb: 'Just looking', glyph: '' }])];
      field.replaceChildren();
      bubbles = accounts.map((a) => {
        // every teammate looks the same (no founder size, no investor/advisor pills): the name under the face,
        // and "Name · Role" in a Wispr-style tooltip on hover, focus or a long press. Add / Guest keep their line
        const person = !!(a.member || a.team) && !a.own;
        const b = h('button.lock__user' + (a.id === 'add' ? '.is-add' : a.id === 'guest' ? '.is-guest' : '') + (a.back ? '.is-back' : ''),
          { type: 'button', role: 'option', 'aria-label': person && a.blurb ? `${a.label}, ${a.blurb}` : null, onclick: () => choose(a) },
          face(a), h('span.lock__name', a.label),
          person ? a.blurb && h('span.lock__tip', { 'aria-hidden': 'true' }, h('b', a.label), ' · ', a.blurb) : a.blurb && h('span.lock__role', a.blurb));
        field.append(b);
        return { a, el: b, x: 0, y: 0, vx: 0, vy: 0, on: true };
      });
      place();
    }
    // the lobby, the way the Slumber Party wall does a crowd: every face is a kept element that sits in a
    // slot of a loose, staggered grid around the clock and the name box, and only the CSS bob moves (no
    // per-frame layout, so 60+ faces stay smooth). Tanay, Sahaj and Nimisha always hold the middle slots,
    // Add and Guest sit by the name box; everyone else takes turns, one face at a time fading out and the
    // next one in the queue fading in where it was, until the whole team has been round. Typing fills the
    // middle slots with the matches at once. Reduced motion: no bob, slower turns.
    const PINNED = ['w-tanay', 'w-sahaj', 'w-nimisha'];
    let W = 0, H = 0, R = 40, rot = 0, cap = 12, q = '', cells = [], queue = [];
    const always = (b) => b.a.id === 'add' || b.a.id === 'guest' || b.a.own || b.a.back;  // never rotated out
    const pinned = (b) => PINNED.includes(b.a.id);
    const matches = (b) => { const l = b.a.label.toLowerCase(); return l.startsWith(q) || l.split(' ').some((w) => w.startsWith(q)); };
    const hash = (str) => { let x = 0; for (const c of str) x = (x * 31 + c.charCodeAt(0)) | 0; return Math.abs(x); };
    function load(b) { const img = b.el.querySelector('img[data-src]'); if (img) { img.src = img.dataset.src; img.removeAttribute('data-src'); } }
    function vis(b, on) { if (on) load(b); b.on = on; b.el.classList.toggle('is-gone', !on); b.el.tabIndex = on ? 0 : -1; b.el.setAttribute('aria-hidden', on ? 'false' : 'true'); if (!on) b.cell = null; }
    function put(b, cell) {
      b.cell = cell; cell.b = b;
      b.el.style.transform = `translate3d(${(cell.x - R * 1.15).toFixed(1)}px, ${(cell.y - R).toFixed(1)}px, 0)`;
      const i = hash(b.a.id);
      b.el.style.setProperty('--d', (4.2 + (i % 30) / 10) + 's');        // ppt's bob: its own 4.2–7.2 s beat
      b.el.style.setProperty('--dl', (-(i % 50) / 10) + 's');
    }
    // the clock block up top and the name box at the bottom are keep-out zones; a face is its circle plus its
    // name under it: [x-R, x+R] x [y-R, y+FOOT*R]
    let zones = [];
    const PAD = 12, FOOT = 1.55;
    function measure() {
      const F = field.getBoundingClientRect();
      zones = [el.querySelector('.lock__top'), el.querySelector('.lock__bottom')].filter((z) => z && !z.hidden).map((z) => {
        const r = z.getBoundingClientRect();
        return { l: r.left - F.left - PAD, t: r.top - F.top - PAD, r: r.right - F.left + PAD, b: r.bottom - F.top + PAD };
      });
    }
    const hits = (x, y, z) => x + R > z.l && x - R < z.r && y + R * FOOT > z.t && y - R < z.b;
    // the slots: a staggered grid over the whole screen, minus the zones, each nudged a little off true so it
    // reads as a crowd, not a table; sorted middle-out (the middle of the clear space below the clock)
    function grid() {
      W = field.clientWidth; H = field.clientHeight;
      measure();
      const narrow = W < 500;
      R = narrow ? 36 : 40;
      field.style.setProperty('--bub', R + 'px');
      const sx = R * (narrow ? 2.3 : 2.45), sy = R * (1 + FOOT) + (narrow ? 16 : 22);  // room for a two-line name
      const cols = Math.max(1, Math.floor((W - R * 0.4) / sx)), x0 = (W - (cols - 1) * sx) / 2;
      const out = [];
      for (let r = 0, y = R + 28; y + R * FOOT <= H - 4; r++, y += sy) {
        const shift = r % 2 && cols > 2 ? sx / 2 : 0;
        for (let c = 0; c < cols - (shift ? 1 : 0); c++) {
          const k = r * 31 + c * 17, x = x0 + c * sx + shift + ((k % 7) - 3) * R * 0.05, yy = y + ((k % 5) - 2) * R * 0.06;
          if (x - R < 0 || x + R > W || zones.some((z) => hits(x, yy, z))) continue;
          out.push({ x, y: yy, b: null });
        }
      }
      const top = zones[0] ? zones[0].b : 0, bot = zones[1] ? zones[1].t : H, cx = W / 2, cy = (top + bot) / 2;
      out.sort((p, o) => Math.hypot(p.x - cx, (p.y - cy) * 1.3) - Math.hypot(o.x - cx, (o.y - cy) * 1.3));
      cells = out.slice(0, narrow ? 14 : 36);  // a calm room, not a wall: the rest take turns
      cap = cells.length;
      field.classList.toggle('is-tight', narrow);
    }
    // everyone in their slot: pinned ones in the middle, Add/Guest by the name box, the rest from the queue
    function place() {
      grid();
      bubbles.forEach((b) => vis(b, false));
      cells.forEach((c) => { c.b = null; });
      if (q) return filter();
      const free = cells.slice();
      const take = (pick) => { const i = pick(); if (i < 0) return null; return free.splice(i, 1)[0]; };
      // Add and Guest always show their line under the name, so they need a deeper foot clear of the name box
      const deep = (c) => !zones.some((z) => c.x + R > z.l && c.x - R < z.r && c.y + R * (FOOT + 1) > z.t && c.y - R < z.b);
      const nearBox = () => { const z = zones[1]; if (!z) return free.length - 1; let best = -1, d = Infinity; free.forEach((c, i) => { if (!deep(c)) return; const dd = Math.hypot(c.x - (z.l + z.r) / 2, c.y - z.t); if (dd < d) { d = dd; best = i; } }); return best; };
      for (const b of bubbles.filter((x) => x.a.back)) { const c = take(() => (free.length ? 0 : -1)); if (c) { put(b, c); vis(b, true); } }
      for (const b of bubbles.filter(pinned)) { const c = take(() => (free.length ? 0 : -1)); if (c) { put(b, c); vis(b, true); } }
      for (const b of bubbles.filter((x) => always(x) && !x.a.back && x.a.id !== 'add' && x.a.id !== 'guest')) { const c = take(() => (free.length ? 0 : -1)); if (c) { put(b, c); vis(b, true); } }
      for (const id of ['guest', 'add']) { const b = bubbles.find((x) => x.a.id === id), c = b && take(nearBox); if (c) { put(b, c); vis(b, true); } }
      const rest = bubbles.filter((b) => !always(b) && !pinned(b));
      if (!queue.length || queue.some((b) => !bubbles.includes(b))) queue = rest.slice().sort(() => Math.random() - 0.5);  // a different crowd each visit
      for (const c of free) { const b = queue.shift(); if (!b) break; put(b, c); vis(b, true); queue.push(b); }
      queue = queue.filter((b) => !b.on).concat(queue.filter((b) => b.on));  // the ones waiting go first
    }
    // one face at a time hands its slot to the next one in the queue, so the whole team comes round
    function rotate() {
      if (q || pick || document.hidden || el.dataset.view !== 'field') return;
      const outs = bubbles.filter((b) => b.on && !always(b) && !pinned(b) && !b.el.matches('.is-hover, :focus-visible'));
      const n = queue.find((b) => !b.on);
      if (!outs.length || !n) return;
      const o = outs[Math.floor(Math.random() * outs.length)], cell = o.cell;
      load(n);  // its photo starts loading now, so it fades in with a face, not an empty ring
      vis(o, false); queue = queue.filter((b) => b !== o && b !== n).concat([n, o]);
      cell.b = null;  // free while it's empty; a relayout or a filter in the meantime takes the slot back
      setTimeout(() => { if (q || pick || n.on || cell.b || !cells.includes(cell)) return; put(n, cell); vis(n, true); n.el.classList.remove('is-new'); void n.el.offsetWidth; n.el.classList.add('is-new'); }, 450);
    }
    const ro = new ResizeObserver(() => { if (Math.abs(field.clientWidth - W) > 4 || Math.abs(field.clientHeight - H) > 4) place(); });

    // ---- typing filters at once: the matches take the middle slots, everyone else steps back
    function filter() {
      if (!q) { hint.textContent = hintText; place(); return; }
      const add = bubbles.find((b) => b.a.id === 'add');
      const all = bubbles.filter((b) => b.a.id !== 'add' && b.a.id !== 'guest' && matches(b)), hit = all.slice(0, Math.max(1, cap - 1));
      hint.textContent = all.length > hit.length ? `${all.length - hit.length} more match, keep typing` : all.length ? hintText : 'Not here? Add your own account';
      cells.forEach((c) => { c.b = null; });
      for (const b of bubbles) if (!hit.includes(b) && b !== add) vis(b, false);
      hit.forEach((b, i) => { if (cells[i]) { put(b, cells[i]); vis(b, true); } else vis(b, false); });  // no slot yet (grid still hidden): stays out
      if (add && cells[hit.length]) { put(add, cells[hit.length]); vis(add, true); }
    }
    search.addEventListener('input', () => { const was = q; q = search.value.trim().toLowerCase(); if (q !== was) filter(); arm(); });  // arm again: an emptied box counts down again
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
      stopAuto();
      sound.tick('pick');
      const b = bubbles.find((x) => x.a.id === a.id);
      b?.el.classList.add('is-picked');
        field.classList.add('has-pick');
      setTimeout(finish, reduced ? 150 : 650);
    }
    function back() { pick = null; show('field'); setTimeout(() => search.focus({ preventScroll: true }), 30); }
    function show(which) {
      el.dataset.view = which;
      field.hidden = which !== 'field'; pickView.hidden = which !== 'pick'; addView.hidden = which !== 'add';
      el.querySelector('.lock__bottom').hidden = which !== 'field';
      // a mouse and keyboard: the name box is ready to type into (touch: no keyboard popping up)
      if (which === 'field' && team.length && matchMedia('(hover: hover) and (pointer: fine)').matches) setTimeout(() => search.focus({ preventScroll: true }), 0);
      arm();
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
        // the lobby must be showing (and the name box cleared) before it's rebuilt, or the grid has no slots;
        // and whatever happens to the lobby, the new account always goes in
        search.value = ''; q = '';
        show('field');
        try { build(); } catch (err) { console.warn('lobby rebuild', err); }
        choose({ ...a, own: true });
      };
      addView.replaceChildren(h('button.lock__facebtn', { type: 'button', onclick: () => file.click(), 'aria-label': 'Take a selfie' }, pic), file,
        h('p.lock__big', 'New account'), h('p.lock__note', 'Your selfie stays on this device. Sameep sees the name.'),
        h('div.lock__form', nameIn, h('button.lock__go', { type: 'submit', 'aria-label': 'Create account' }, '→')), snap,
        h('button.lock__back', { type: 'button', onclick: back }, '← Other accounts'));
      show('add');
      setTimeout(() => nameIn.focus({ preventScroll: true }), 60);
    }

    const finish = async () => {
      if (!pick) return;
      stopAuto();
      el.classList.add('is-out');
      clearInterval(clk); clearInterval(rot); ro.disconnect(); stopHere();
      sound.tick('open');
      await wait(reduced ? 0 : 450);
      el.remove();
      desk?.classList.remove('is-locked');
      document.dispatchEvent(new Event('otcv:unlock'));  // the menu-bar clock catches up
      // who came in, for analytics.js: a teammate by id and name, an own account by its name, a guest by what they typed (if anything)
      const typed = search.value.trim().replace(/\s+/g, ' ').slice(0, 40), mate = !!(pick.team || pick.member);
      document.dispatchEvent(new CustomEvent('otcv:login', { detail: pick.id === 'guest' ? { as: 'guest', auto: !!pick.auto, name: typed.length > 1 ? typed : undefined }
        : { as: mate ? 'team' : 'own', id: mate ? pick.id : undefined, name: pick.label } }));
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
    rot = setInterval(rotate, reduced ? 5000 : 2800);
    requestAnimationFrame(() => el.classList.add('is-on'));
  });
}

// ---------------------------------------------------------------- installed: open it, or it opens itself
// resolves when the visitor clicks Open (here or on the new desktop icon via `open`), or after `secs`
// on a phone there's no window: the icon wears a badge counting down (onCount), and tapping it opens the show
export function installed(wm, { secs = 15, onCount, hold = () => false, layer, pill = false } = {}) {
  // The install is done: Open goes straight in; otherwise a visible countdown opens the show by itself.
  // "Not yet" / "Stay on the desktop" cancels it, and then the icon just waits to be opened. While hold() is
  // true (a guide is showing) nothing is drawn and nothing counts. pill: a guide ran first, so when it ends
  // (Done, Skip, Esc) a small pill counts the same 15 s instead of the Installer window. While they have
  // something open (a window, a folder, a game) the count pauses, and the pill hides until they're back.
  let go;
  const p = new Promise((r) => { go = r; });
  const narrow = isNarrow();
  const left = h('b', String(secs));
  let n = secs, t = 0, w = null, bar = null, stopped = false;
  const area = layer || document.querySelector('.desk__area');
  const away = () => !!document.querySelector('.lock, .cast') || [...(area?.querySelectorAll('.win:not([hidden]):not(.is-closing):not(.is-shaded):not(.win--install):not(.win--juke)') || [])].length > 0;
  const stop = (fromClose) => {
    stopped = true;
    clearInterval(t); t = 0;
    onCount?.(null);
    if (fromClose !== true) w?.close();
    bar?.remove();
  };
  const btns = () => pill
    ? [h('button.btn', { type: 'button', onclick: () => stop() }, 'Not yet'), h('button.btn.btn--primary', { type: 'button', onclick: () => go() }, 'Start now')]
    : [h('button.btn', { type: 'button', onclick: () => stop() }, narrow ? 'Not yet' : 'Stay on the desktop'), h('button.btn.btn--primary', { type: 'button', onclick: () => go() }, 'Open')];
  const draw = () => {
    if (w || bar || stopped) return;
    if (!narrow && !pill) {
      w = wm.win('installed', { title: 'Installer', width: 420, y: 40, className: 'win--install', sheet: false, onClose: () => { if (t) stop(true); } });
      w.body.append(h('div.inst',
        h('div.inst__head', h('img', { src: 'img/ui/offthecv.svg', alt: '', width: 40, height: 40 }), h('div', h('p.inst__t', 'Installation complete'), h('p.inst__s', '“OFF THE CV” is on your desktop. Open its icon any time.'))),
        h('p.inst__doing', 'Opens by itself in ', left, ' s'),
        h('div.inst__row.inst__row--end', ...btns())));
    } else {
      // the pill (and the phone's bar): no window, a small bar at the bottom does the same job as the badge on the icon
      bar = h('div.inst-bar' + (pill ? '.is-pill' : ''), { role: 'status' }, h('img', { src: 'img/ui/offthecv.svg', alt: '', width: 28, height: 28 }),
        pill ? h('p', h('b', 'OFF THE CV'), ' starts in ', left, '…') : h('p', h('b', 'OFF THE CV'), ' opens in ', left, ' s'), ...btns());
      area?.append(bar);
    }
    sound.tick('pick');
    onCount?.(n);
  };
  let paused = false;
  const pause = (on) => {
    if (on === paused) return;
    paused = on;
    if (bar) bar.hidden = on;
    onCount?.(on ? null : n);
  };
  if (!hold()) draw();
  t = setInterval(() => {
    if (stopped) return;
    if (hold()) { pause(true); return; }
    if (!w && !bar) { draw(); return; }  // drawn the moment the hold lifts; counts from the next second
    if (away()) { pause(true); return; }
    if (paused) { pause(false); return; }  // back on the desktop: the same number, counting from the next second
    n -= 1; left.textContent = String(Math.max(0, n)); onCount?.(Math.max(0, n));
    if (n <= 0) go();
  }, 1000);
  // stay(): what "Not yet" does: no countdown, the icon waits
  return { open: () => go(), stay: () => stop(), done: p.then(() => { clearInterval(t); t = 0; w?.close(); bar?.remove(); onCount?.(null); }) };
}
