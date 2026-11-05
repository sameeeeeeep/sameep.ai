// Wispr for Builders: the pack shelf. Flip REPO_LIVE once github.com/sameeeeeeep/wispr-for-builders is public.
(() => {
  const REPO_LIVE = true;
  const REPO = 'sameeeeeeep/wispr-for-builders';

  // status: 'tested' = built and checked end to end on a Mac; 'live' = shipped with its own page on this site;
  // 'core' = installs with the pack, the others use it.
  const MODS = [
    { id: 'wispr-file', name: 'Wispr File', status: 'tested',
      tag: 'Find any file by saying it',
      say: ['the GST invoice from October', 'last screenshot of the admin panel', 'two, copy the path'],
      body: 'File searches your Mac with Spotlight and shows the results as numbered thumbnails. Say “two” and File pastes it into the app you were in, or reveals, opens, or copies it.',
      img: 'img/card.webp', alt: 'A numbered card of three image tiles, the second one highlighted, above a field that says Say two' },
    { id: 'wispr-wish', name: 'Wispr Wish', status: 'tested',
      tag: 'Say what should happen to a file',
      say: ['make this a PDF', 'compress this video for WhatsApp', 'transcribe this audio', 'split this bill three ways'],
      body: 'Wish works on what you selected in Finder, with ffmpeg and an on-device transcript. Ask for a small tool, like a timer or a QR code, and it opens in its own window. Wish asks before deleting anything.',
      img: 'img/wish.webp', alt: 'Three small dark windows: a bill split at 944 rupees each, a QR code for a link, and a 10 minute timer' },
    { id: 'wispr-review', name: 'Wispr Review', status: 'tested',
      tag: 'Review a website by talking at it',
      say: ['too big on mobile', 'say per seat, and add annual pricing'],
      body: 'Point at anything on a page and talk. Review’s Chrome extension pins your note to that element with a crop. Claude reads the notes with /wispr-review and fixes them one by one.',
      img: 'img/review.webp', alt: 'A web page with a note pinned to the price that says Price should say per seat, and a Review dock in the corner' },
    { id: 'wispr-pm', name: 'Wispr PM', status: 'tested',
      tag: 'Your task boards, by voice',
      say: ['park this for the portfolio', 'what’s next', 'split this into tasks', 'what’s waiting on me'],
      body: 'PM keeps one Markdown board per project. Say “start a thread” on a card and a Claude Code session works on it, then moves it to review when it’s done.' },
    { id: 'wispr-guru', name: 'Wispr Guru', status: 'live', page: '/wispr-guru/',
      tag: 'A second cursor that shows you where to click',
      say: ['walk me through exporting a frame in Figma', 'done', 'wait, where?'],
      body: 'Guru points at the control you need, shows the step beside it, and waits. When a long Claude turn finishes, Guru gives you a card to dictate your reply into.' },
    { id: 'wispr-video', name: 'Wispr Video', status: 'live', page: '/wispr-editor/',
      tag: 'A video editor you talk to',
      say: ['cut the silences', 'highlight the product name', 'export 9:16'],
      body: 'Video gives you a teleprompter that moves when you finish a line, word-timed captions, and edits you say out loud. It exports 9:16, 4:5, and 16:9.',
      img: 'img/video.webp', alt: 'The Wispr Video editor with a preview, a transcript and a timeline' },
    { id: 'wispr-bridge', name: 'Wispr Bridge', status: 'core', wide: true,
      tag: 'What ties the pack together',
      say: ['(anything, into wispr-bridge ask)'],
      body: 'Dictate any request and Bridge sends it to the mod that handles it. Every mod shows choices on the same numbered card, answered by voice, a number key, or a click.' },
  ];
  const STATUS = { tested: 'Tested', live: 'Live', core: 'Included' };
  const short = (m) => m.name.replace(/^Wispr /, '');

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const line = (m) => `/plugin install ${m.id}@wispr-for-builders`;

  document.getElementById('apps').innerHTML = MODS.map((m) => `
    <article class="w-mcard app${m.img ? ' app--shot' : ''}${m.wide ? ' app--wide' : ''}" id="${m.id}">
      <div class="app__head">
        <span class="w-tile" aria-hidden="true">${esc(short(m))}</span>
        <div class="app__t">
          <h3>${esc(m.name)}</h3>
          <p>${esc(m.tag)}</p>
        </div>
        <span class="w-badge pill pill--${m.status}">${STATUS[m.status]}</span>
      </div>
      <ul class="say" aria-label="Things to say">${m.say.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      <p class="app__p">${esc(m.body)}${m.page ? ` <a href="${m.page}">Try the demo</a>` : ''}</p>
      ${m.img ? `<img class="app__img" src="${m.img}" alt="${esc(m.alt)}" loading="lazy" decoding="async">` : ''}
      <div class="cmd cmd--sm">
        <code id="cmd-${m.id}">${esc(line(m))}</code>
        <button class="w-btn w-btn--primary" type="button" data-copy="cmd-${m.id}" aria-label="Copy the ${esc(m.name)} install line">Copy</button>
      </div>
    </article>`).join('');

  // the segmented pill: All, or one mod at a time
  const seg = document.getElementById('seg');
  seg.innerHTML = [['all', 'All'], ...MODS.map((m) => [m.id, short(m)])].map(([id, t], i) =>
    `<button type="button" data-mod="${id}" aria-pressed="${i === 0}"${i === 0 ? ' class="is-on"' : ''}>${esc(t)}</button>`).join('');
  seg.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mod]');
    if (!b) return;
    seg.querySelectorAll('[data-mod]').forEach((x) => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', String(on)); });
    document.querySelectorAll('#apps .app').forEach((a) => { a.hidden = b.dataset.mod !== 'all' && a.id !== b.dataset.mod; });
    document.getElementById('apps').classList.toggle('is-one', b.dataset.mod !== 'all');
    b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });

  if (REPO_LIVE) document.querySelectorAll('[data-soon]').forEach((n) => n.remove());

  const toast = document.querySelector('.toast');
  let tt;
  const say = (t) => { toast.textContent = t; toast.hidden = false; clearTimeout(tt); tt = setTimeout(() => { toast.hidden = true; }, 2400); };

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch {}
    try {
      const ta = Object.assign(document.createElement('textarea'), { value: text });
      ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0';
      document.body.append(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch { return false; }
  };

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    const text = document.getElementById(b.dataset.copy).textContent;
    const ok = await copy(text);
    if (ok) {
      b.textContent = 'Copied'; b.classList.add('is-done');
      setTimeout(() => { b.textContent = 'Copy'; b.classList.remove('is-done'); }, 1800);
      say(REPO_LIVE ? 'Copied. Paste it into Claude Code.' : 'Copied. The repo goes public soon.');
    } else say('Couldn’t copy. Select the line and copy it.');
    try { window.wbTrack && window.wbTrack('wb_copy', { what: b.dataset.copy, repo: REPO, live: REPO_LIVE }); } catch {}
  });
})();
