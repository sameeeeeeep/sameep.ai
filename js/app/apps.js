// apps.js — the desktop's tiny programs. Today's AI tools, as 1999 shipped them.
import { h, safeUrl } from './util.js';
import { openWork } from './work.js';
import { sound } from './audio.js';
import { renderSubtitle } from './subtitle.js';
import { openDemo, fillUrl } from './demos.js';

const FILLERS = /\b(um+|uh+|erm|like|you know|i mean|basically|kind of|sort of|actually|literally|so yeah|right\?)\b[,]?\s*/gi;

export function flowClean(raw) {
  let s = ' ' + raw.trim() + ' ';
  s = s.replace(FILLERS, ' ');
  s = s.replace(/\b(\w+)(\s*,?\s+\1\b)+/gi, '$1');            // "the the" → "the"
  s = s.replace(/\s+([,.!?])/g, '$1').replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').trim();
  s = s.replace(/^,\s*/, '');
  if (!s) return '';
  s = s[0].toUpperCase() + s.slice(1);
  s = s.replace(/([.!?]\s+)([a-z])/g, (_, p, c) => p + c.toUpperCase()).replace(/\bi\b/g, 'I');
  if (!/[.!?]$/.test(s)) s += '.';
  return s;
}

function chatApp(w, { greeting, replies, accent, placeholder }) {
  const log = h('div.chat__log', { 'aria-live': 'polite' }, h('p.chat__bot', greeting));
  const inp = h('input.field', { type: 'text', placeholder, 'aria-label': 'Message' });
  let i = 0;
  const form = h('form.chat__form', { onsubmit: (e) => {
    e.preventDefault();
    const q = inp.value.trim();
    if (!q) return;
    log.append(h('p.chat__me', q));
    inp.value = '';
    const thinking = h('p.chat__bot.is-thinking', 'Thinking');
    log.append(thinking);
    log.scrollTop = log.scrollHeight;
    setTimeout(() => { thinking.classList.remove('is-thinking'); thinking.textContent = replies[i++ % replies.length].replace('{q}', q.slice(0, 40)); log.scrollTop = log.scrollHeight; sound.tick('click'); }, 900 + Math.random() * 700);
  } }, inp, h('button.btn.btn--primary', { type: 'submit' }, 'Send'));
  w.body.append(h('div.chat', { style: { '--accent': accent } }, log, form));
  setTimeout(() => inp.focus({ preventScroll: true }), 50);
}

export function buildApps(ctx) {
  const { wm, persona, podcast, alert } = ctx;
  const P = persona;
  const goChapter = (re) => {
    const c = podcast()?.chapterList?.find((x) => re.test(x.label));
    ctx.openPodcast();
    if (c) podcast().go(c.to);
  };

  return [
    { id: 'offthecv', label: 'OFF THE CV', icon: 'offthecv', open: () => ctx.openPodcast() },
    { id: 'work', label: 'Work', icon: 'folder', open: () => openWork(wm, P) },
    { id: 'wispr', label: 'Wispr Flow', icon: 'wispr', className: 'icon--wispr', open() {
      const w = wm.win('wispr', { title: 'Wispr Flow', width: 460, className: 'win--wispr' });
      const ta = h('textarea.field.field--area', { rows: 3, 'aria-label': 'Type the way you talk' }, 'so um I think the the CV is like kind of dead and uh voice is basically the new keyboard you know');
      const out = h('p.wf__out', { 'aria-live': 'polite' });
      const go = h('button.btn.btn--primary', { type: 'button', onclick: () => { const raw = ta.value; renderSubtitle(out, { text: flowClean(raw) || '…', messy: raw }); sound.tick('pick'); } }, 'Flow it');
      w.body.append(h('div.wf',
        h('div.wf__band', { 'aria-hidden': 'true' }),
        h('p.wf__title', 'Wispr Flow 1.0 for Macintosh'),
        h('p.wf__lede', 'Hold the fn key and talk. Type the way you talk below, and watch it clean up.'),
        ta, h('div.wf__row', go), out,
        h('p.wf__fine', 'This whole site was built by talking into the real one. Reimagined here as 1999 software; not affiliated, just a fan.')));
    } },
    { id: 'flowother', label: 'Flow (not that one)', icon: 'flowother', open: async () => {
      const r = await alert({ icon: 'img/ui/note.svg', title: 'Flow', message: 'This is Flow, a Switchboard wrapp Sameep named before he’d heard of Wispr Flow. Different Flow. Smaller Flow. Under review by a naming committee of one.', buttons: [{ label: 'Rename it' }, { label: 'Open the real one', primary: true }] });
      if (r === 1) ctx.open('wispr');
      else alert({ icon: 'img/ui/note.svg', title: 'Rename', message: 'Renaming “Flow” to “Flo”… The committee says that’s worse. Request denied.', buttons: [{ label: 'Fair', primary: true }] });
    } },
    { id: 'claude', label: 'Claude 1.0', icon: 'claude', open() {
      const w = wm.win('claude', { title: 'Claude 1.0', width: 400 });
      chatApp(w, { accent: '#d4744e', placeholder: 'Ask Claude 1.0…', greeting: 'Hello! I’m Claude 1.0. I run on 8 MB of RAM and a lot of good intentions.', replies: [
        'Happy to help with “{q}”. First, please insert Disk 2 of 14.',
        'I’ve written a SPEC.md for that. It spans three floppies.',
        'Great question. My context window is 640K, which ought to be enough for anybody.',
        'I could do that, but have you considered asking the podcast? It’s on this desktop.',
      ] });
    } },
    { id: 'chatgpt', label: 'ChatGPT 98', icon: 'chatgpt', open() {
      const w = wm.win('chatgpt', { title: 'ChatGPT 98', width: 400 });
      chatApp(w, { accent: '#0a8fa8', placeholder: 'Type a message…', greeting: 'Welcome to ChatGPT 98! You are visitor #000042.', replies: [
        'As a large language model from 1998, I can tell you “{q}” is very Y2K-compliant.',
        'Your conversation has been saved to A:\\. Please do not remove the disk.',
        'Error 404: opinion not found. Would you like to download one? (3 hrs at 28.8k)',
      ] });
    } },
    { id: 'cursor', label: 'Cursor Pro', icon: 'cursor', open() {
      const w = wm.win('cursor', { title: 'Cursor Pro — portfolio.c', width: 460, className: 'win--code' });
      const lines = ['/* portfolio.c */', '#include <voice.h>', '', 'int main(void) {'];
      const sugg = ['  cv_destroy(CV_BURN);', '  podcast_play("off-the-cv");', '  wispr_hold(FN_KEY);', '  hire(SAMEEP, WISPR_INDIA);', '  return 0;', '}'];
      let k = 0;
      const code = h('pre.code');
      const ghost = h('span.code__ghost');
      const render = () => { code.replaceChildren(lines.join('\n') + '\n', ghost); ghost.textContent = k < sugg.length ? sugg[k] : ''; };
      const accept = () => { if (k >= sugg.length) return; lines.push(sugg[k++]); sound.tick('click'); render(); };
      render();
      const btn = h('button.btn', { type: 'button', onclick: accept }, 'Accept (Tab)');
      w.body.append(code, h('div.code__bar', h('span', 'Grey text is a suggestion.'), btn));
      w.el.addEventListener('keydown', (e) => { if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); accept(); } });
      setTimeout(() => btn.focus({ preventScroll: true }), 50);
    } },
    { id: 'midjourney', label: 'Midjourney Paint', icon: 'midjourney', open() {
      const w = wm.win('midjourney', { title: 'Midjourney Paint', width: 360 });
      const N = 20;
      const cv = h('canvas.paint', { width: N, height: N, 'aria-label': 'Pixel canvas' });
      const g = cv.getContext('2d');
      g.fillStyle = '#f3eee2'; g.fillRect(0, 0, N, N);
      const pal = ['#111111', '#0a8fa8', '#ff8a1f', '#ff4f7b', '#7b4fd6', '#9bd13a', '#f3eee2'];
      let color = pal[1];
      let down = false;
      const dot = (e) => { const r = cv.getBoundingClientRect(); const x = Math.floor(((e.clientX - r.left) / r.width) * N), y = Math.floor(((e.clientY - r.top) / r.height) * N); g.fillStyle = color; g.fillRect(x, y, 1, 1); };
      cv.addEventListener('pointerdown', (e) => { down = true; cv.setPointerCapture(e.pointerId); dot(e); });
      cv.addEventListener('pointermove', (e) => down && dot(e));
      cv.addEventListener('pointerup', () => (down = false));
      const sw = h('div.paint__pal', pal.map((c) => h('button.swatch', { type: 'button', style: { background: c }, 'aria-label': 'Colour ' + c, onclick: (e) => { color = c; sw.querySelectorAll('.swatch').forEach((s) => s.classList.remove('is-on')); e.currentTarget.classList.add('is-on'); } })));
      sw.children[1].classList.add('is-on');
      const status = h('p.paint__status', '/imagine: draw something');
      w.body.append(cv, sw, h('div.paint__row', ...['U1', 'U2', 'V1', 'V2'].map((l) => h('button.btn.btn--sm', { type: 'button', onclick: () => { status.textContent = `${l}: upscaling at 2,400 baud. Estimated time: Tuesday.`; } }, l))), status);
    } },
    { id: 'elevenlabs', label: 'ElevenLabs Voice', icon: 'elevenlabs', open() {
      const w = wm.win('elevenlabs', { title: 'ElevenLabs Voice', width: 380 });
      const ta = h('textarea.field.field--area', { rows: 3, 'aria-label': 'Text to speak' }, 'Hello Wispr. I am a computer. I have been practising my vowels.');
      const pitch = h('input', { type: 'range', min: '0.2', max: '2', step: '0.1', value: '0.6', 'aria-label': 'Pitch' });
      const ok = 'speechSynthesis' in window;
      const btn = h('button.btn.btn--primary', { type: 'button', disabled: !ok, onclick: () => {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(ta.value.slice(0, 280));
        u.pitch = +pitch.value; u.rate = 0.9;
        speechSynthesis.speak(u);
      } }, ok ? 'Speak' : 'No speech engine');
      w.body.append(h('p.small', 'Voice: “Robot ’98” (the only voice)'), ta, h('label.small.row', 'Pitch', pitch), h('div.row', btn));
    } },
    { id: 'perplexity', label: 'Perplexity Search', icon: 'perplexity', open() {
      const w = wm.win('perplexity', { title: 'Perplexity Search', width: 420 });
      const inp = h('input.field', { type: 'text', value: 'who is sameep', 'aria-label': 'Search' });
      const res = h('ol.results', { 'aria-live': 'polite' });
      const go = (e) => {
        e?.preventDefault();
        const q = inp.value.trim() || 'everything';
        res.replaceChildren(
          h('li', h('b', `Answer: `), `“${q}” is best explained by the podcast on this desktop. It has chapters.`),
          h('li', h('b', 'Sources: '), '[1] Encarta 98, disc 2  [2] A GeoCities page with a guestbook  [3] Ask Jeeves (he shrugged)'));
        sound.tick('click');
      };
      w.body.append(h('form.row', { onsubmit: go }, inp, h('button.btn.btn--primary', { type: 'submit' }, 'Search')), res);
    } },
    { id: 'higgsfield', label: 'Higgsfield Movie', icon: 'higgsfield', open() {
      const w = wm.win('higgsfield', { title: 'Higgsfield Movie Maker', width: 440 });
      const frame = h('div.movie', h('img', { src: P.studio?.[0] || '', alt: 'The studio, through a movie camera' }));
      const status = h('p.small', 'Pick a camera move. Rendering at 0.3 fps.');
      const move = (m) => { frame.className = 'movie movie--' + m; status.textContent = `${m[0].toUpperCase() + m.slice(1)}: rendered in 11 hours (preview).`; };
      w.body.append(frame, h('div.row', ...['dolly', 'crash', 'orbit'].map((m) => h('button.btn.btn--sm', { type: 'button', onclick: () => move(m) }, m === 'crash' ? 'Crash zoom' : m[0].toUpperCase() + m.slice(1)))), status);
    } },
    { id: 'granola', label: 'Granola Notes', icon: 'granola', open() {
      const w = wm.win('granola', { title: 'Granola Notes — Meeting.txt', width: 420 });
      const extra = ['Action item: someone should probably hire him.', 'He said “voice is the new keyboard” four times. Counted.', 'Note to self: the CD was a pun. It took me a minute.'];
      let i = 0;
      const list = h('ul.notes', h('li', 'Candidate burned his CV. On purpose.'), h('li', 'Turned it into a CD, then a podcast, then a modem noise.'), h('li', 'Built the whole thing by talking to it.'));
      w.body.append(h('p.small', 'Meeting: Wispr India growth ✕ Sameep'), list,
        h('button.btn', { type: 'button', onclick: (e) => { if (i < extra.length) list.append(h('li.is-new', extra[i++])); if (i >= extra.length) e.currentTarget.disabled = true; } }, 'Enhance notes'));
    } },
    { id: 'notion', label: 'Notion Organizer', icon: 'notion', open() {
      const w = wm.win('notion', { title: 'Notion Organizer — To Do', width: 360 });
      const items = [['Burn CV', true], ['Press it onto a CD', true], ['Dial up', true], ['Record a podcast with myself', true], ['Get a reply from Wispr', false, true]];
      w.body.append(h('ul.todo', items.map(([t, done, locked], i) => h('li', h('label', h('input', { type: 'checkbox', checked: done, onclick: locked ? (e) => { e.preventDefault(); alert({ icon: 'img/ui/note.svg', title: 'Notion Organizer', message: 'Only Wispr can tick this one.', buttons: [{ label: 'Fair enough', primary: true }] }); } : null }), h('span', t))))));
    } },
    { id: 'figma', label: 'Figma Draw', icon: 'figma', open() {
      const w = wm.win('figma', { title: 'Figma Draw — Untitled', width: 420 });
      const board = h('div.board', { 'aria-label': 'Click and drag to draw a shape' });
      const cols = ['#0a8fa8', '#ff8a1f', '#ff4f7b', '#7b4fd6', '#9bd13a'];
      let s = null, start = null, ci = 0;
      board.addEventListener('pointerdown', (e) => { const r = board.getBoundingClientRect(); start = [e.clientX - r.left, e.clientY - r.top]; s = h('div.shape', { style: { left: start[0] + 'px', top: start[1] + 'px', background: cols[ci++ % cols.length] } }); board.append(s); board.setPointerCapture(e.pointerId); });
      board.addEventListener('pointermove', (e) => { if (!s) return; const r = board.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top; Object.assign(s.style, { left: Math.min(x, start[0]) + 'px', top: Math.min(y, start[1]) + 'px', width: Math.abs(x - start[0]) + 'px', height: Math.abs(y - start[1]) + 'px' }); });
      board.addEventListener('pointerup', () => { if (s && s.offsetWidth < 4) s.remove(); s = null; });
      w.body.append(board, h('p.small', 'Multiplayer: 1 cursor (you). Drag to draw.'));
    } },
    { id: 'switchboard', label: 'Make your own', icon: 'switchboard', open: () => ctx.endCard(true) },
    { id: 'wallpap', label: 'wallpap Controls', icon: 'wallpap', open() {
      const w = wm.win('wallpap', { title: 'wallpap Control Panel', width: 360 });
      const hour = new Date().getHours();
      const out = h('output.dot', String(hour).padStart(2, '0') + ':00');
      const sl = h('input', { type: 'range', min: '0', max: '23', value: String(hour), 'aria-label': 'Hour of day' });
      sl.addEventListener('input', () => { out.textContent = sl.value.padStart(2, '0') + ':00'; });
      sl.addEventListener('change', () => ctx.setWallHour(+sl.value));
      w.body.append(h('p.small', 'The desktop behind these icons is a live wallpap.live scene. Move the sun.'), h('div.row', sl, out),
        h('a.btn', { href: safeUrl(fillUrl(P.wallpaper?.url || '', '')) || 'https://wallpap.live', target: '_blank', rel: 'noopener' }, 'Open wallpap.live ↗'));
    } },
    { id: 'dialup', label: 'Remote Access', icon: 'dialup', open() {
      const w = wm.win('dialup', { title: 'Remote Access', width: 340 });
      const t0 = ctx.connectedAt;
      const clock = h('span.dot');
      const tick = () => { if (!clock.isConnected) return; const s = Math.floor((Date.now() - t0) / 1000); clock.textContent = [s / 3600, (s / 60) % 60, s % 60].map((v) => String(Math.floor(v)).padStart(2, '0')).join(':'); setTimeout(tick, 1000); };
      w.body.append(h('p', 'Connected at 56,000 bps.'), h('p.small', 'Time online: ', clock), h('div.row', h('button.btn', { type: 'button', onclick: () => alert({ icon: 'img/ui/stop.svg', title: 'Disconnect', message: 'Hanging up now would end the podcast mid-sentence. The host would never forgive you.', buttons: [{ label: 'Stay connected', primary: true }] }) }, 'Disconnect')));
      tick();
    } },
    { id: 'readme', label: 'Read Me.txt', icon: 'readme', open() {
      const w = wm.win('readme', { title: 'Read Me.txt', width: 480, className: 'win--text' });
      w.body.append(h('div.simpletext',
        h('p', 'READ ME'),
        h('p', 'This site was talked into existence.'),
        h('p', 'Every spec line, every “no, warmer”, every “scroll back and check it reverses” was dictated into Wispr Flow and handed to Claude as a prompt. The episode is drawn from the same dictation, so the AI version of me rambles the way I actually do.'),
        h('p', 'The subtitles in the podcast do what Flow does: you’ll see the raw version first, ums and all, then watch it clean itself up.'),
        h('p', 'Steering works the same way. Click into “Say it with Flow…”, hold your Flow key, and say where you want to go.'),
        h('p', 'Everything is original: the pixel icons, the modem noise (synthesised in your browser), the studio, the cast. No real logos were harmed.'),
        h('p', 'Source: github.com/sameeeeeeep')));
    } },
    { id: 'resume', label: 'Résumé.doc', icon: 'resume', open: async () => {
      const r = await alert({ icon: 'img/ui/stop.svg', title: 'Résumé.doc', message: 'This file format is no longer supported. Try talking instead.', buttons: [{ label: 'OK' }, { label: 'Talk instead', primary: true }] });
      if (r === 1) ctx.openPodcast();
    } },
    { id: 'hd', label: 'Macintosh HD', icon: 'hd', open() {
      const w = wm.win('hd', { title: 'About This Computer', width: 420 });
      w.body.append(h('div.about',
        h('img', { src: 'img/ui/offthecv.svg', alt: '', width: 64, height: 64 }),
        h('div',
          h('p.about__title', 'OFF THE CV OS 8.6'),
          h('p.small', 'Built-in memory: 32 MB'),
          h('p.small', 'Largest unused block: your attention span'),
          h('p.small', 'Built by voice with Wispr Flow and Claude. Fonts: Doto, Bricolage Grotesque, Spline Sans Mono, VT323, Patrick Hand.'),
          P.links.find((l) => l.kind === 'github') && h('a.btn', { href: P.links.find((l) => l.kind === 'github').url, target: '_blank', rel: 'noopener' }, 'Source on GitHub ↗'))));
    } },
    { id: 'trash', label: 'Trash', icon: 'trash', open() {
      const w = wm.win('trash', { title: 'Trash', width: 400 });
      const items = ['CV_final_FINAL_v7.pdf', 'keyboard (Wispr already broke it)', '2,000 applications', 'Inter.ttf', 'dark-mode-neon-glow.css', 'cover-letter-template.doc'];
      w.body.append(h('p.finder__meta', `${items.length} items`), h('ul.finder.finder--list', items.map((t) => h('li', h('span.finder__item.is-static', h('img', { src: 'img/ui/readme.svg', alt: '', width: 24, height: 24 }), h('span', t))))),
        h('div.row', h('button.btn', { type: 'button', onclick: async () => {
          const r = await alert({ icon: 'img/ui/note.svg', title: 'Empty Trash', message: 'The Trash can’t be emptied. Some things are worth keeping as lessons.', buttons: [{ label: 'OK' }, { label: 'Hear the lesson', primary: true }] });
          if (r === 1) goChapter(/didn|startup|often/i);
        } }, 'Empty Trash')));
    } },
  ];
}
