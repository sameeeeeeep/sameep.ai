// On the Pack 1 page: a "Try it now" button on each mod card that opens the browser demo in a sheet.
// The demo itself lives at /wispr-builders/try/ (its own page, so it can also open from the desktop Wispr folder).
(() => {
  const MODS = { 'wispr-guru': 'guru', 'wispr-file': 'file', 'wispr-wish': 'wish', 'wispr-review': 'review', 'wispr-pm': 'pm' };
  const css = `
  .try-now { display: flex; align-items: center; gap: 10px 12px; flex-wrap: wrap; margin-top: 14px; }
  .try-now .w-cta { cursor: pointer; font-family: inherit; }
  .try-now span { font: 400 13px/1.35 var(--w-sans, sans-serif); opacity: .75; }
  .try-sheet { position: fixed; inset: 0; z-index: 1000; background: rgb(26 26 26 / .45); display: grid; place-items: center; padding: 24px; opacity: 0; transition: opacity .15s cubic-bezier(.05,.6,.4,.95); }
  .try-sheet.is-in { opacity: 1; }
  .try-sheet iframe { width: min(1120px, 100%); height: min(900px, 100%); border: 0; border-radius: 16px; background: #f5f4f0; box-shadow: 0 20px 25px -5px rgb(0 0 0 / .2), 0 8px 10px -6px rgb(0 0 0 / .2); }
  @media (max-width: 640px) { .try-sheet { padding: 0; } .try-sheet iframe { width: 100%; height: 100%; border-radius: 0; } }
  html.try-lock, html.try-lock body { overflow: hidden; }`;
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);

  let sheet = null, opener = null;
  function open(mod) {
    opener = document.activeElement;
    sheet = document.createElement('div'); sheet.className = 'try-sheet';
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-label', 'Try Pack 1 in your browser');
    const f = document.createElement('iframe');
    f.src = `/wispr-builders/try/?mod=${mod}&embed=1${/[?&]mute\b/.test(location.search) ? '&mute' : ''}`;
    f.title = 'Try Pack 1'; f.allow = 'clipboard-read; clipboard-write; microphone';
    sheet.append(f); document.body.append(sheet);
    document.documentElement.classList.add('try-lock');
    requestAnimationFrame(() => sheet.classList.add('is-in'));
    f.addEventListener('load', () => f.contentWindow?.focus());
    sheet.addEventListener('click', (e) => { if (e.target === sheet) close(); });
    window.wbTrack?.('try_open', { mod });
  }
  function close() {
    if (!sheet) return;
    const s = sheet; sheet = null; s.classList.remove('is-in');
    setTimeout(() => s.remove(), 160);
    document.documentElement.classList.remove('try-lock');
    opener?.focus?.();
  }
  addEventListener('message', (e) => { if (e.origin === location.origin && e.data?.t === 'wb-try-close') close(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheet) close(); });

  function mount() {
    let n = 0;
    for (const [id, mod] of Object.entries(MODS)) {
      const card = document.getElementById(id);
      if (!card || card.querySelector('.try-now')) continue;
      const box = document.createElement('div'); box.className = 'try-now';
      box.innerHTML = '<button type="button" class="w-cta w-cta--sm">Try it now</button><span>In your browser, no install</span>';
      box.querySelector('button').addEventListener('click', () => open(mod));
      const after = card.querySelector('.app__p');
      after ? after.after(box) : card.append(box);
      n++;
    }
    return n;
  }
  // the shelf is rendered by app.js; mount once it's there
  if (!mount()) new MutationObserver((_, o) => { if (mount()) o.disconnect(); }).observe(document.getElementById('apps') || document.body, { childList: true, subtree: true });
  // /wispr-builders/#try-file opens straight into that demo
  const m = location.hash.match(/^#try-(guru|file|wish|review|pm)$/); if (m) open(m[1]);
})();
