// Try Pack 1: one Bridge ask field, a mod per tab, and a "screen" where the mod's card and sample data live.
// Flow types into whatever field has focus, so the ask field keeps focus between requests.
import { classify } from './router.js';
import { setLayer, notify, closeCard, cardOpen, reveal } from './card.js';
import { runFile, search } from './file.js';
import { FILES, PATH, whenLabel, thumbURL } from './mac.js';
import { runApp, runConvert, runWishOther, fmt } from './wish.js';
import { runPM, BOARD, PROJECTS, waitingCount } from './pm.js';
import { runReview, initReview, reviewOn, reviewState } from './review.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const params = new URLSearchParams(location.search);
const EMBED = params.has('embed');
const lastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toLocaleString('en', { month: 'long' });

const MODS = {
  file: { name: 'File', h: 'Find any file <em>by saying it</em>', sub: 'File searches this sample Mac of 60 made-up files and shows the best matches as thumbnails. Click one and it’s copied as an image, ready to paste anywhere.',
    say: ['find my passport photo', `the invoice from ${lastMonth}`, 'last screenshot of the admin panel', 'the pricing deck'], ph: 'Say “find my passport photo”' },
  wish: { name: 'Wish', h: 'Say what should <em>happen to a file</em>', sub: 'Conversions really run in your browser on the selected image, and nothing is uploaded. Small tools open in their own window.',
    say: ['make this a WebP', 'make it smaller for WhatsApp', 'make this a PDF', 'a 25 min timer', 'split ₹2,400 four ways', 'a QR for sameep.ai'], ph: 'Say “make this a WebP”' },
  review: { name: 'Review', h: 'Review a page <em>by talking at it</em>', sub: 'Turn on review mode, point at anything on this page, and say the note. It pins itself there. Then send all of it to Claude in one paste.',
    say: [], ph: 'Turn on review mode below, then point and talk' },
  pm: { name: 'PM', h: 'Your task boards, <em>by voice</em>', sub: 'A sample board across three projects. Park things, ask what’s next, and see what’s waiting on you, all from one sentence.',
    say: ['what’s next on the portfolio', 'what’s waiting on me', 'park fix the footer links for the portfolio', 'start a thread on the podcast player', 'split this into tasks: fix the footer, add OG images and test on mobile'], ph: 'Say “what’s next on the portfolio”' },
  guru: { name: 'Guru', h: 'A second cursor that <em>shows you where</em>', sub: 'Guru points at the control you need, shows the step beside it, and waits for you. It has its own demo.', say: [], ph: 'Say “walk me through exporting a frame”', page: '/wispr-guru/' },
  video: { name: 'Video', h: 'A video editor <em>you talk to</em>', sub: 'A teleprompter that moves when you finish a line, word-timed captions, and edits you say out loud. It has its own demo.', say: [], ph: 'Say “cut the silences”', page: '/wispr-editor/' },
};
const ORDER = ['file', 'wish', 'review', 'pm', 'guru', 'video'];
let mod = MODS[params.get('mod')] ? params.get('mod') : (MODS[location.hash.slice(1)] ? location.hash.slice(1) : 'file');

const q = $('#q'), stage = $('#stage'), layer = $('#layer'), routeEl = $('#route');
setLayer(layer);

// ---------------------------------------------------------------- the ask field
function focusAsk() { if (!cardOpen() && !reviewState().on) q.focus({ preventScroll: true }); }
async function send(text) {
  text = text.trim(); if (!text) return;
  q.value = ''; closeCard();
  const c = classify(text);
  // like the real router, a noun phrase that names something on this Mac is a file search
  if (!c.mod && search(text).items.length) Object.assign(c, { mod: 'file', intent: 'file.find' });
  const target = c.mod;
  if (target && target !== mod) { setMod(target, { keepRoute: true }); }
  try {
    if (c.mod === 'file') await runFile(text, ui);
    else if (c.mod === 'wish') { if (c.intent === 'convert') await runConvert(text, ui); else if (c.args.app) await runApp(c.args.app, text, ui); else await runWishOther(text, ui); }
    else if (c.mod === 'review') runReview(c.args, ui);
    else if (c.mod === 'pm') await runPM(text, ui);
    else if (c.mod === 'guru' || c.mod === 'video') { ui.route({ intent: c.intent, args: c.args, mod: 'Wispr ' + MODS[c.mod].name }); notify(`${MODS[c.mod].name} has its own demo. Open it below.`, { title: 'Wispr Bridge' }); }
    else { ui.route({ intent: 'ask', args: c.args, mod: null }); notify('On your Mac, Bridge would send that to Claude. This demo knows File, Wish, Review and PM: try one of the suggestions.', { title: 'Wispr Bridge', ttl: 5 }); }
  } finally { setTimeout(focusAsk, 60); }
}
q.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); send(q.value); } });
$('#go').addEventListener('click', () => send(q.value));

// a suggestion chip types the whole sentence at once, like Flow does, then sends it
function dictate(text) {
  q.value = text; q.focus({ preventScroll: true });
  q.classList.add('is-typed'); setTimeout(() => q.classList.remove('is-typed'), 400);
  setTimeout(() => send(text), 420);
}

// mic fallback for people without Flow: the browser's own speech recognition
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SR) {
  const mic = $('#mic'); mic.hidden = false;
  let rec = null;
  mic.addEventListener('click', () => {
    if (rec) { rec.stop(); return; }
    rec = new SR(); rec.lang = 'en-IN'; rec.interimResults = true; rec.maxAlternatives = 1;
    mic.classList.add('is-on'); mic.setAttribute('aria-pressed', 'true'); mic.querySelector('span').textContent = 'Listening…';
    let final = '';
    rec.onresult = (e) => { let s = ''; for (const r of e.results) s += r[0].transcript; q.value = s; if (e.results[e.results.length - 1].isFinal) final = s; };
    rec.onerror = () => {};
    rec.onend = () => { mic.classList.remove('is-on'); mic.setAttribute('aria-pressed', 'false'); mic.querySelector('span').textContent = 'No Flow? Use the mic'; rec = null; if (final.trim()) send(final); };
    rec.start();
  });
}

// ---------------------------------------------------------------- tabs, copy, install line
const tabs = $('#tabs');
tabs.innerHTML = `<div class="w-seg" role="tablist">${ORDER.map((id) => `<button type="button" role="tab" data-mod="${id}">${MODS[id].name}</button>`).join('')}</div>`;
tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-mod]'); if (b) { setMod(b.dataset.mod); focusAsk(); } });

function setMod(id, { keepRoute = false } = {}) {
  const prev = mod; mod = id;
  closeCard();
  if (prev === 'review' && id !== 'review' && reviewState().on) reviewOn(false);
  tabs.querySelectorAll('[data-mod]').forEach((b) => { const on = b.dataset.mod === id; b.setAttribute('aria-selected', on); b.classList.toggle('is-on', on); if (on) { const r = b.getBoundingClientRect(), tr = tabs.getBoundingClientRect(); if (r.left < tr.left || r.right > tr.right) tabs.scrollLeft += r.left - tr.left - 8; } });
  const m = MODS[id];
  $('#h').innerHTML = m.h; $('#sub').textContent = m.sub;
  $('#cmd').textContent = `/plugin install wispr-${id === 'video' ? 'video' : id}@wispr-for-builders`;
  q.placeholder = m.ph;
  $('#chips').innerHTML = m.say.map((s) => `<button type="button" class="t-chip">${esc(s)}</button>`).join('');
  $('#ask').classList.toggle('is-quiet', !m.say.length);
  if (!keepRoute) routeEl.hidden = true;
  document.body.dataset.mod = id;
  history.replaceState(null, '', `?mod=${id}${EMBED ? '&embed=1' : ''}${params.has('mute') ? '&mute' : ''}`);
  RENDER[id]();
  window.wbTrack?.('try_mod', { mod: id });
}
$('#chips').addEventListener('click', (e) => { const b = e.target.closest('.t-chip'); if (b) dictate(b.textContent); });
$('#copycmd').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('#cmd').textContent); $('#copycmd').textContent = 'Copied'; setTimeout(() => ($('#copycmd').textContent = 'Copy'), 1500); } catch { /* blocked */ } });

if (EMBED) {
  document.body.classList.add('is-embed');
  const c = $('#close'); c.hidden = false; c.onclick = () => parent.postMessage({ t: 'wb-try-close' }, location.origin);
  $('[data-home]').addEventListener('click', (e) => { e.preventDefault(); parent.postMessage({ t: 'wb-try-close' }, location.origin); });
}

// ---------------------------------------------------------------- what the mods call back into
const ui = {
  route({ intent, args, mod: m, note }) {
    const a = Object.fromEntries(Object.entries(args || {}).filter(([, v]) => v != null && v !== ''));
    routeEl.hidden = false;
    routeEl.innerHTML = `<span class="t-route__k">Bridge</span><span>→ ${m ? esc(m) : 'Claude'}</span><code>${esc(JSON.stringify({ intent, args: a }))}</code>${note ? `<span class="t-route__n">${esc(note)}</span>` : ''}`;
  },
  result(r) { if (!routeEl.hidden) { const c = document.createElement('code'); c.className = 't-route__r'; c.textContent = '← ' + JSON.stringify(r); routeEl.querySelector('.t-route__r')?.remove(); routeEl.append(c); } },
  // File
  reveal(f) { if (mod !== 'file') setMod('file', { keepRoute: true }); finder.folder = f.folder; finder.sel = f.id; RENDER.file(); const li = stage.querySelector(`[data-f="${f.id}"]`); if (li) { li.parentElement.scrollTop = li.offsetTop - 20; reveal(li); } },
  preview(f) { openDialog(f.name, `<figure class="t-prev"><img src="${thumbURL(f)}" alt="${esc(f.name)}"><figcaption><code>${esc(PATH(f))}</code><span>${esc(whenLabel(f.date))}</span></figcaption></figure><p class="t-fine">On your Mac, File opens the real file in its app.</p>`); },
  copied(f) { finder.sel = f.id; if (mod === 'file') RENDER.file(); },
  // Wish
  selection: () => wishSel(),
  busy(b) { stage.classList.toggle('is-busy', b); },
  converted(o) { wishOut = o; if (o.blob !== o.from.blob) { wishFiles.push({ name: o.name, blob: o.blob, made: true }); } RENDER.wish(); },
  miniWindow({ title, html, h }) {
    const w = document.createElement('div'); w.className = 't-mini'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-label', title);
    w.innerHTML = `<div class="t-mini__bar"><span class="t-mini__dots"><i></i><i></i><i></i></span><b>${esc(title)}</b><button type="button" aria-label="Close">×</button></div>`;
    const f = document.createElement('iframe'); f.title = title; f.srcdoc = html; f.style.height = (h || 360) + 'px'; f.setAttribute('allow', 'clipboard-write');
    w.append(f); w.querySelector('button').onclick = () => { w.remove(); focusAsk(); };
    let d = null, dx = 0, dy = 0; const bar = w.querySelector('.t-mini__bar');
    bar.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; d = { x: e.clientX - dx, y: e.clientY - dy }; bar.setPointerCapture(e.pointerId); });
    bar.addEventListener('pointermove', (e) => { if (!d) return; dx = e.clientX - d.x; dy = e.clientY - d.y; w.style.translate = `${dx}px ${dy}px`; });
    bar.addEventListener('pointerup', () => (d = null));
    const n = layer.querySelectorAll('.t-mini').length; w.style.setProperty('--i', n % 4);
    layer.append(w);
    setTimeout(() => reveal(w), 30);
  },
  // PM
  showProject(p) { pmView = p || 'all'; if (mod === 'pm') RENDER.pm(); },
  render(p, id) { pmView = pmView === 'all' ? 'all' : p; pmFlash = id; if (mod === 'pm') RENDER.pm(); },
  flash(id, p) { this.render(p, id); },
  snooze() { pmSnoozed = true; RENDER.pm(); },
};

function openDialog(title, html) {
  const d = $('#dlg'); $('#dlg-t').textContent = title; $('#dlg-b').innerHTML = html; d.hidden = false;
  const close = () => { d.hidden = true; document.removeEventListener('keydown', k, true); focusAsk(); };
  const k = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', k, true);
  d.onclick = (e) => { if (e.target === d || e.target.closest('[data-x]')) close(); };
  d.querySelector('[data-x]').focus();
  return d;
}

// ---------------------------------------------------------------- stages
const finder = { folder: 'All', sel: null };
const FOLDERS = ['All', 'Desktop', 'Downloads', 'Documents', 'Pictures'];
let wishFiles = null, wishPick = 0, wishOut = null;
let pmView = 'portfolio', pmFlash = null, pmSnoozed = false;

const RENDER = {
  file() {
    const list = FILES.filter((f) => finder.folder === 'All' || f.folder === finder.folder).sort((a, b) => b.date - a.date);
    stage.innerHTML = `<div class="t-win t-finder">
      <div class="t-win__bar"><span class="t-mini__dots"><i></i><i></i><i></i></span><b>This sample Mac</b><span class="t-win__n">${FILES.length} made-up files</span></div>
      <div class="t-finder__body">
        <nav class="t-finder__side" aria-label="Folders">${FOLDERS.map((x) => `<button type="button" class="${x === finder.folder ? 'is-on' : ''}" data-folder="${x}">${x === 'All' ? 'All files' : x}</button>`).join('')}</nav>
        <ul class="t-finder__grid">${list.map((f) => `<li data-f="${f.id}" class="${f.id === finder.sel ? 'is-sel' : ''}"><img src="${thumbURL(f)}" alt="" loading="lazy"><span>${esc(f.name)}</span><small>${esc(whenLabel(f.date))}</small></li>`).join('')}</ul>
      </div></div>`;
    stage.querySelector('.t-finder__side').onclick = (e) => { const b = e.target.closest('[data-folder]'); if (b) { finder.folder = b.dataset.folder; RENDER.file(); } };
    stage.querySelector('.t-finder__grid').onclick = (e) => { const li = e.target.closest('[data-f]'); if (li) ui.preview(FILES.find((f) => f.id === +li.dataset.f)); };
  },

  async wish() {
    if (!wishFiles) {
      wishFiles = [{ name: 'IMG_2041.jpg', url: 'samples/IMG_2041.jpg' }, { name: 'studio-desk.png', url: 'samples/studio-desk.png' }];
      stage.innerHTML = '<p class="t-fine t-pad">Loading the samples…</p>';
      await Promise.all(wishFiles.map(async (f) => { f.blob = await fetch(f.url).then((r) => r.blob()); }));
      if (mod !== 'wish') return;
    }
    const sel = wishSel();
    const urlOf = (f) => (f.thumb ??= URL.createObjectURL(f.blob));
    const isImg = (f) => /^image\//.test(f.blob.type);
    stage.innerHTML = `<div class="t-wish">
      <div class="t-win t-sel">
        <div class="t-win__bar"><span class="t-mini__dots"><i></i><i></i><i></i></span><b>Finder selection</b><span class="t-win__n">what “this” means</span></div>
        <ul class="t-sel__list">${wishFiles.map((f, i) => `<li><button type="button" data-w="${i}" class="${i === wishPick ? 'is-on' : ''}" ${isImg(f) ? '' : 'disabled'} aria-pressed="${i === wishPick}">
          ${isImg(f) ? `<img src="${urlOf(f)}" alt="">` : '<span class="t-sel__doc">PDF</span>'}<span class="t-sel__t"><b>${esc(f.name)}</b><small>${fmt(f.blob.size)}${f.made ? ' · new' : ''}</small></span></button></li>`).join('')}
          <li><label class="t-sel__own"><input type="file" accept="image/*" hidden><span>Choose your own image</span><small>or drop one here. It stays in this tab.</small></label></li></ul>
      </div>
      <div class="t-win t-out" aria-live="polite">
        <div class="t-win__bar"><span class="t-mini__dots"><i></i><i></i><i></i></span><b>${wishOut ? 'Done' : 'Result'}</b></div>
        ${wishOut ? outHTML(wishOut) : `<div class="t-out__empty"><p>Say what should happen to <b>${esc(sel?.name || 'the selected file')}</b>.</p><p class="t-fine">“make this a WebP”, “make it smaller for WhatsApp”, “half size”, “make this a PDF”</p></div>`}
      </div></div>`;
    stage.querySelector('.t-sel__list').onclick = (e) => { const b = e.target.closest('[data-w]'); if (b) { wishPick = +b.dataset.w; RENDER.wish(); focusAsk(); } };
    const inp = stage.querySelector('input[type=file]');
    inp.onchange = () => addOwn(inp.files[0]);
    const sl = stage.querySelector('.t-sel');
    sl.ondragover = (e) => { e.preventDefault(); sl.classList.add('is-drop'); };
    sl.ondragleave = () => sl.classList.remove('is-drop');
    sl.ondrop = (e) => { e.preventDefault(); sl.classList.remove('is-drop'); addOwn(e.dataTransfer.files[0]); };
    stage.querySelector('[data-dl]')?.addEventListener('click', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(wishOut.blob); a.download = wishOut.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 800); });
  },

  review() {
    stage.innerHTML = `<div class="t-rv">
      <div class="t-rv__steps">
        <ol><li><b>Turn on review mode</b> with the button below.</li><li><b>Point at anything on this page</b>, hold <kbd class="w-kbd">fn</kbd> and say the note. ${matchMedia('(hover: none)').matches ? 'On a phone, tap it first.' : 'Click to lock an element first if you like.'}</li><li><b>Point at the next thing</b> and talk again.</li><li><b>Send to Claude</b> shows what Claude gets.</li></ol>
        <button type="button" class="w-btn w-btn--primary" id="rv-on">${reviewState().on ? 'Review mode is on' : 'Turn on review mode'}</button>
      </div>
      <article class="t-site" data-rv aria-label="A sample page to review">
        <header class="t-site__nav"><b>Northwind Notes</b><span>Product</span><span>Pricing</span><span>Sign in</span></header>
        <div class="t-site__hero"><h2>Notes that write themselves</h2><p>Capture meetings, tag action items, and share a summary in one click.</p><button type="button" class="t-site__cta">Start free trial</button></div>
        <div class="t-site__plans">
          <div class="t-site__plan"><h3>Starter</h3><p class="t-site__price">$8<small>/mo</small></p><p>3 notebooks · 1 GB</p></div>
          <div class="t-site__plan is-pop"><h3>Team</h3><p class="t-site__price">$12<small>/mo</small></p><p>Unlimited notebooks · shared tags</p></div>
          <div class="t-site__plan"><h3>Business</h3><p class="t-site__price">Contact us</p><p>SSO · audit log · admin</p></div>
        </div>
        <p class="t-site__fine">Prices exclude taxes. Cancel any time.</p>
      </article>
      <p class="t-fine">Things to say: “Team should say per seat, and add annual pricing”, “this button is too big on mobile”, or anything about this demo page itself.</p>
    </div>`;
    $('#rv-on').onclick = () => { runReview({ mode: reviewState().on ? 'off' : 'on' }, ui); RENDER.review(); };
  },

  pm() {
    const cols = ['backlog', 'doing', 'review', 'done'];
    const names = { backlog: 'Backlog', doing: 'Doing', review: 'Review', done: 'Done' };
    const shown = BOARD.filter((c) => pmView === 'all' || c.project === pmView);
    const wc = waitingCount();
    stage.innerHTML = `<div class="t-pm">
      <div class="t-pm__top"><div class="w-seg t-pm__seg" role="tablist" aria-label="Board">${[...Object.keys(PROJECTS), 'all'].map((p) => `<button type="button" data-p="${p}" class="${p === pmView ? 'is-on' : ''}" aria-selected="${p === pmView}">${p === 'all' ? 'All boards' : p}</button>`).join('')}</div>
        ${wc && !pmSnoozed ? `<button type="button" class="t-pill" data-wait><i></i>${wc} waiting on you</button>` : ''}</div>
      <div class="t-pm__cols">${cols.map((col) => { const cs = shown.filter((c) => c.col === col); return `<section class="t-pm__col"><h3>${names[col]} <span>${cs.length}</span></h3><ul>${cs.map((c) => `
        <li class="t-pm__card${c.id === pmFlash ? ' is-flash' : ''}${c.running ? ' is-run' : ''}"><b>${esc(c.title)}</b><span>${pmView === 'all' ? esc(c.project) + ' · ' : ''}${c.prio}${c.running ? ' · thread running' : ''}${c.waited ? ' · waited ' + esc(c.waited) : ''}${c.me ? ' · @me' : ''}</span></li>`).join('')}</ul></section>`; }).join('')}</div>
      <p class="t-fine">On your Mac, each project is a plain Markdown board, and a thread is Claude Code working on the card. Here the thread is simulated.</p>
    </div>`;
    stage.querySelector('.t-pm__seg').onclick = (e) => { const b = e.target.closest('[data-p]'); if (b) { pmView = b.dataset.p; RENDER.pm(); } };
    stage.querySelector('[data-wait]')?.addEventListener('click', () => send('what’s waiting on me'));
    if (pmFlash) { reveal(stage.querySelector('.is-flash')); setTimeout(() => { pmFlash = null; }, 1600); }
  },

  guru() { stage.innerHTML = linkStage('guru', 'Walk me through exporting a frame in Figma', ['done', 'wait, where?']); },
  video() { stage.innerHTML = linkStage('video', 'Cut the silences', ['highlight the product name', 'export 9:16']); },
};

function linkStage(id, line, more) {
  const m = MODS[id];
  return `<div class="t-link">
    <div class="t-link__say"><span class="w-eyebrow">You say</span><p>“${esc(line)}”</p><ul>${more.map((s) => `<li>“${esc(s)}”</li>`).join('')}</ul></div>
    <div class="t-link__go"><p>${id === 'guru' ? 'Guru’s demo runs a sample app window where Guru points and steps you through it.' : 'Video’s demo is the full editor in your browser: script, teleprompter, captions and voice edits.'}</p>
      <a class="w-btn w-btn--primary w-btn--lg" href="${m.page}" ${EMBED ? 'target="_top"' : ''}>Open the ${m.name} demo</a></div></div>`;
}

function outHTML(o) {
  const smaller = o.blob.size < o.from.blob.size;
  const pct = Math.round(100 * (1 - o.blob.size / o.from.blob.size));
  const isImg = /^image\//.test(o.blob.type);
  o.url ??= URL.createObjectURL(o.blob);
  return `<div class="t-out__res">
    ${isImg ? `<img src="${o.url}" alt="The converted image">` : `<object data="${o.url}" type="application/pdf" aria-label="The new PDF"><span class="t-sel__doc">PDF</span></object>`}
    <dl class="t-out__dl">
      <div><dt>Before</dt><dd><b>${fmt(o.from.blob.size)}</b><span>${esc(o.from.name)} · ${o.W}×${o.H}</span></dd></div>
      <div><dt>After</dt><dd><b>${fmt(o.blob.size)}</b><span>${esc(o.name)} · ${o.w}×${o.h}</span></dd></div>
    </dl>
    <p class="t-out__d">${smaller ? `${pct}% smaller.` : o.blob === o.from.blob ? '' : `${Math.abs(pct)}% bigger.`} ${o.note ? esc(o.note) : 'Made in this tab. On your Mac it’s saved next to the original.'}</p>
    <button type="button" class="w-btn w-btn--outline" data-dl>Download ${esc(o.name)}</button></div>`;
}
function wishSel() { return wishFiles?.[wishPick] && /^image\//.test(wishFiles[wishPick].blob?.type) ? wishFiles[wishPick] : null; }
function addOwn(file) {
  if (!file) return;
  if (!/^image\//.test(file.type)) return notify('Pick an image. Video and audio need your Mac.', { title: 'Wispr Wish' });
  wishFiles.push({ name: file.name, blob: file }); wishPick = wishFiles.length - 1; wishOut = null; RENDER.wish(); focusAsk();
}

// Review: the export dialog shows exactly what the extension copies
initReview({
  onChange() { if (mod === 'review') { const b = $('#rv-on'); if (b) b.textContent = reviewState().on ? 'Review mode is on' : 'Turn on review mode'; } },
  onExport({ prompt, md, json, count }) {
    const d = openDialog(`What Claude gets · ${count} note${count > 1 ? 's' : ''}`, `
      <div class="w-seg t-xseg" role="tablist"><button type="button" class="is-on" data-x-t="p">Prompt</button><button type="button" data-x-t="m">Markdown</button><button type="button" data-x-t="j">JSON</button></div>
      <pre class="t-pre" tabindex="0"></pre>
      <div class="t-dialog__foot"><span class="t-fine">Copied the prompt. On your Mac you paste it into Claude Code in the site’s repo, and Claude fixes the notes one by one.</span><button type="button" class="w-btn w-btn--primary" data-copy>Copy</button></div>`);
    const pre = d.querySelector('.t-pre'); const map = { p: prompt, m: md, j: json }; let cur = 'p'; pre.textContent = prompt;
    d.querySelector('.t-xseg').onclick = (e) => { const b = e.target.closest('[data-x-t]'); if (!b) return; cur = b.dataset.xT; pre.textContent = map[cur]; d.querySelectorAll('[data-x-t]').forEach((x) => x.classList.toggle('is-on', x === b)); };
    d.querySelector('[data-copy]').onclick = async (e) => { try { await navigator.clipboard.writeText(map[cur]); e.target.textContent = 'Copied'; } catch { e.target.textContent = 'Copy failed'; } };
  },
});

// keep keys for Flow: typing anywhere on the page goes to the ask field
document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || cardOpen() || reviewState().on || !$('#dlg').hidden) return;
  const t = e.target; if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
  if (e.key.length === 1 && e.key !== ' ') q.focus({ preventScroll: true });
});
document.addEventListener('paste', (e) => {
  // Flow pastes; if nothing is focused, catch it in the ask field
  const t = e.target; if (/^(INPUT|TEXTAREA)$/.test(t.tagName) || cardOpen()) return;
  const s = e.clipboardData?.getData('text'); if (s) { e.preventDefault(); q.value = s; q.focus(); }
});

setMod(mod);
if (!matchMedia('(hover: none)').matches) q.focus({ preventScroll: true });
