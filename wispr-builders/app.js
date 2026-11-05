// Wispr for Builders: the pack shelf. Flip REPO_LIVE once github.com/sameeeeeeep/wispr-for-builders is public.
(() => {
  const REPO_LIVE = true;
  const REPO = 'sameeeeeeep/wispr-for-builders';

  // key: the product's id in /wispr-kit/status.json, the one place statuses live (Live / Testing / In progress).
  const MODS = [
    { id: 'wispr-file', clip: 'file-mac', clipAlt: 'Wispr File on a Mac: a dictated search, Quick Look results on the Wispr Bridge card, one picked', name: 'Wispr File', key: 'file',
      tag: 'Find any file by saying it',
      say: ['the GST invoice from October', 'last screenshot of the admin panel', 'the signed lease PDF'],
      body: 'File searches your Mac with Spotlight and shows the results as numbered thumbnails. Click one, or press its number, and File pastes it into the app you were in, or reveals, opens, or copies it.',
      img: 'img/card.webp', alt: 'The Wispr Bridge card: three numbered poster tiles with the second one selected, a note field, and a Not now button' },
    { id: 'wispr-wish', clip: 'wish-mac', clipAlt: 'Wispr Wish on a Mac converting sameep.ai’s og.png to WebP, 154 KB to 80 KB', name: 'Wispr Wish', key: 'wish',
      tag: 'Say what should happen to a file',
      say: ['make this a PDF', 'compress this video for WhatsApp', 'transcribe this audio', 'split this bill three ways'],
      body: 'Wish works on what you selected in Finder, with ffmpeg and an on-device transcript. Ask for a small tool, like a timer or a QR code, and it opens in its own window. Wish asks before deleting anything.',
      img: 'img/wish.webp', alt: 'Three small dark windows: a bill split at 944 rupees each, a QR code for a link, and a 10 minute timer' },
    { id: 'wispr-review', clip: 'review', clipAlt: 'Wispr Review on sameep.ai: a note pinned to the hero, then sent to Claude', name: 'Wispr Review', key: 'review',
      tag: 'Review a website by talking at it',
      say: ['too big on mobile', 'say per seat, and add annual pricing'],
      body: 'Point at anything on a page and talk. Review’s Chrome extension pins your note to that element with a crop. Claude reads the notes with /wispr-review and fixes them one by one.',
      img: 'img/review.webp', alt: 'A web page with a note pinned to the price that says Price should say per seat, and a Review dock in the corner' },
    { id: 'wispr-pm', clip: 'pm-mac', clipAlt: 'Wispr PM on a Mac showing the real portfolio board on the Wispr Bridge card', name: 'Wispr PM', key: 'pm',
      tag: 'Your task boards, by voice',
      say: ['park this for the portfolio', 'split this into tasks', 'what’s waiting on me'],
      body: 'PM keeps one Markdown board per project. Click Start on a card and a Claude Code session works on it, then moves it to review when it’s done.' },
    { id: 'wispr-guru', clip: 'guru-video', clipAlt: 'Wispr Guru on the Mac, pointing through recording a take in Wispr Video', name: 'Wispr Guru', key: 'guru', page: '/wispr-guru/',
      tag: 'A second cursor that shows you where to click',
      say: ['walk me through exporting a frame in Figma', 'how do I add a page number in Pages'],
      body: 'Guru points at the control you need, shows the step beside it, and moves on when you click it. When a long Claude turn finishes, Guru gives you a card to dictate your reply into.' },
    { id: 'wispr-video', clip: 'video-real', clipAlt: 'Wispr Video on the Mac: the teleprompter follows what Flow types, then Claude cuts the pauses (stand-in camera and voice)', name: 'Wispr Video', key: 'video', page: '/wispr-editor/',
      tag: 'A video editor you talk to',
      say: ['cut the silences', 'highlight the product name', 'export 9:16'],
      body: 'Video gives you a teleprompter that follows you as you read, word-timed captions, and edits you say out loud. It exports 9:16, 4:5, and 16:9.',
      img: 'img/video.webp', alt: 'The Wispr Video editor with a preview, a transcript and a timeline' },
    { id: 'wispr-bridge', name: 'Wispr Bridge', key: 'bridge', wide: true,
      tag: 'What ties the pack together',
      say: ['(anything, into wispr-bridge ask)'],
      body: 'Dictate any request and Bridge sends it to the mod that handles it. Every mod shows choices on the same numbered card. Pick with a click or a number key, and dictate anything longer.' },
  ];
    const short = (m) => m.name.replace(/^Wispr /, '');

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const line = (m) => `/plugin install ${m.id}@wispr-for-builders`;

  document.getElementById('apps').innerHTML = MODS.map((m) => `
    <article class="w-mcard app${m.img || m.clip ? ' app--shot' : ''}${m.wide ? ' app--wide' : ''}" id="${m.id}">
      <div class="app__head">
        <span class="w-tile" aria-hidden="true">${esc(short(m))}</span>
        <div class="app__t">
          <h3>${esc(m.name)}</h3>
          <p>${esc(m.tag)}</p>
        </div>
        <span class="pill" data-wstatus="${m.key}" hidden></span>
      </div>
      <ul class="say" aria-label="Things to say">${m.say.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      <p class="app__p">${esc(m.body)}${m.page ? ` <a href="${m.page}">Try the demo</a>` : ''}</p>
      ${m.clip ? `<video class="app__img app__clip" muted loop playsinline preload="none" poster="gifs/${m.clip}.jpg" data-clip="gifs/${m.clip}" aria-label="${esc(m.clipAlt)}"></video>`
        : m.img ? `<img class="app__img" src="${m.img}" alt="${esc(m.alt)}" loading="lazy" decoding="async">` : ''}
      <div class="cmd cmd--sm">
        <code id="cmd-${m.id}">${esc(line(m))}</code>
        <button class="w-cta w-cta--sm w-cta--ghost cmd__copy" type="button" data-copy="cmd-${m.id}" aria-label="Copy the ${esc(m.name)} install line">Copy</button>
      </div>
    </article>`).join('');

  window.WisprStatus && WisprStatus.fill(document.getElementById('apps'));

  // the frosted strip under the sticky nav follows the nav's real height (it wraps on phones)
  const topbar = document.querySelector('.top');
  if (topbar && 'ResizeObserver' in window) new ResizeObserver(() => {
    const h = Math.ceil(topbar.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--wb-navh', h + 'px');
    document.documentElement.style.scrollPaddingTop = (16 + h + 24) + 'px';
  }).observe(topbar);

  // clips: one plays at a time, the most visible one; the rest rest on their posters with no source, so the page
  // never holds more than one video decoder (two side by side failed to decode in testing). Reduced motion: controls.
  const clips = [...document.querySelectorAll('.app__clip')];
  const attach = (v) => {
    if (v.childElementCount) return;
    v.append(Object.assign(document.createElement('source'), { src: v.dataset.clip + '.webm', type: 'video/webm' }),
      Object.assign(document.createElement('source'), { src: v.dataset.clip + '.mp4', type: 'video/mp4' }));
    v.load();
  };
  const detach = (v) => { if (!v.childElementCount) return; v.pause(); v.replaceChildren(); v.load(); };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    clips.forEach((v) => { v.controls = true; attach(v); });  // preload stays none: nothing loads until play
  } else if ('IntersectionObserver' in window) {
    // visible clips take turns: each plays once through, then the next visible one starts; hover plays one now
    const seen = new Map();
    let on = null;
    const visible = () => clips.filter((v) => (seen.get(v) || 0) > 0.35);
    const play = (v) => {
      if (v === on) { if (v) { v.currentTime = 0; v.play().catch(() => {}); } return; }
      if (on) detach(on);
      on = v;
      if (on) { attach(on); on.play().catch(() => {}); }
    };
    const next = () => { const vis = visible(); if (!vis.length) return play(null); const i = vis.indexOf(on); play(vis[(i + 1) % vis.length]); };
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => seen.set(e.target, e.intersectionRatio));
      if (!on || (seen.get(on) || 0) <= 0.35) { const vis = visible(); play(vis[0] || null); }
    }, { threshold: [0, 0.35, 0.6, 1] });
    clips.forEach((v) => {
      v.loop = false;
      v.addEventListener('ended', () => { if (v === on) next(); });
      v.addEventListener('mouseenter', () => { if ((seen.get(v) || 0) > 0.35) play(v); });
      io.observe(v);
    });
  } else if (clips[0]) { attach(clips[0]); clips[0].play().catch(() => {}); }

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
