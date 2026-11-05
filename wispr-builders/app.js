// Wispr for Builders: the pack shelf. Flip REPO_LIVE once github.com/sameeeeeeep/wispr-for-builders is public.
(() => {
  const REPO_LIVE = true;
  const REPO = 'sameeeeeeep/wispr-for-builders';

  // status: 'tested' = built and checked end to end on a Mac; 'live' = shipped with its own page on this site;
  // 'core' = installs with the pack, the others use it.
  const MODS = [
    { id: 'wispr-file', name: 'Wispr File', tile: 'F', hue: '#f0d7ff', status: 'tested',
      tag: 'Find any file by saying it',
      say: ['the GST invoice from October', 'last screenshot of the admin panel', 'two, copy the path'],
      body: 'Spotlight searches your Mac and the results come back as numbered thumbnails. Say “two” and it pastes the file into the app you were in, or reveals, opens or copies it.',
      img: 'img/card.webp', alt: 'A numbered card of three image tiles, the second one highlighted, above a field that says Say two' },
    { id: 'wispr-wish', name: 'Wispr Wish', tile: 'W', hue: '#ffbcf2', status: 'tested',
      tag: 'Say what should happen to a file',
      say: ['make this a PDF', 'compress this video for WhatsApp', 'transcribe this audio', 'split this bill three ways'],
      body: 'Works on what you selected in Finder, with ffmpeg and an on-device transcript. Ask for a small tool, like a timer or a QR code, and it opens in its own window. It asks before deleting anything.',
      img: 'img/wish.webp', alt: 'Three small dark windows: a bill split at 944 rupees each, a QR code for a link, and a 10 minute timer' },
    { id: 'wispr-review', name: 'Wispr Review', tile: 'R', hue: '#cfe8dc', status: 'tested',
      tag: 'Review a website by talking at it',
      say: ['too big on mobile', 'say per seat, and add annual pricing'],
      body: 'Point at anything on a page and talk. A Chrome extension pins the note to that element with a crop. Claude reads the notes with /wispr-review and fixes them one by one.',
      img: 'img/review.webp', alt: 'A web page with a note pinned to the price that says Price should say per seat, and a Review dock in the corner' },
    { id: 'wispr-pm', name: 'Wispr PM', tile: 'P', hue: '#ffa946', status: 'tested',
      tag: 'Your task boards, by voice',
      say: ['park this for the portfolio', 'what’s next', 'split this into tasks', 'what’s waiting on me'],
      body: 'One Markdown board per project. Say “start a thread” on a card and a Claude Code session works on it, then moves it to review when it’s done.' },
    { id: 'wispr-guru', name: 'Wispr Guru', tile: 'G', hue: '#ff6c4c', status: 'live', page: '/wispr-guru/',
      tag: 'A second cursor that shows you where to click',
      say: ['walk me through exporting a frame in Figma', 'done', 'wait, where?'],
      body: 'Guru points at the control you need, shows the step beside it and waits. When a long Claude turn finishes, it gives you a card to dictate your reply into.' },
    { id: 'wispr-video', name: 'Wispr Video', tile: 'V', hue: '#034f46', ink: true, status: 'live', page: '/wispr-editor/',
      tag: 'A video editor you talk to',
      say: ['cut the silences', 'highlight the product name', 'export 9:16'],
      body: 'A teleprompter that moves when you finish a line, word-timed captions, and edits you say out loud. Exports 9:16, 4:5 and 16:9.',
      img: 'img/video.webp', alt: 'The Wispr Video editor with a preview, a transcript and a timeline' },
    { id: 'wispr-bridge', name: 'Wispr Bridge', tile: 'B', hue: '#e4e4d0', status: 'core', wide: true,
      tag: 'What ties the pack together',
      say: ['(anything, into wispr-bridge ask)'],
      body: 'Dictate any request and it goes to the mod that handles it. Every mod shows choices on the same numbered card, answered by voice, a number key or a click.' },
  ];
  const STATUS = { tested: 'Tested', live: 'Live', core: 'Included' };

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const line = (m) => `/plugin install ${m.id}@wispr-for-builders`;

  document.getElementById('apps').innerHTML = MODS.map((m) => `
    <article class="app${m.img ? ' app--shot' : ''}${m.wide ? ' app--wide' : ''}" id="${m.id}">
      <div class="app__head">
        <span class="tile${m.ink ? ' tile--ink' : ''}" style="--hue:${m.hue}" aria-hidden="true">${m.tile}</span>
        <div class="app__t">
          <h3>${esc(m.name)}</h3>
          <p>${esc(m.tag)}</p>
        </div>
        <span class="pill pill--${m.status}">${STATUS[m.status]}</span>
      </div>
      <ul class="say" aria-label="Things to say">${m.say.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      <p class="app__p">${esc(m.body)}${m.page ? ` <a href="${m.page}">Try the demo</a>` : ''}</p>
      ${m.img ? `<img class="app__img" src="${m.img}" alt="${esc(m.alt)}" loading="lazy" decoding="async">` : ''}
      <div class="cmd cmd--sm">
        <code id="cmd-${m.id}">${esc(line(m))}</code>
        <button class="btn btn--light" type="button" data-copy="cmd-${m.id}" aria-label="Copy the ${esc(m.name)} install line">Copy</button>
      </div>
    </article>`).join('');

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
