// review.js — review mode: Sameep tags things on the live site, a Claude session pulls the notes and fixes them.
// On with ?mode=review (sticky for this browser), off with ?mode=off or the toolbar's power box. When off this file
// does nothing else: no CSS, no listeners, no network.
//
//   Pick  → tap/click anything (text, an icon, a window, the studio monitor) → chips + an optional suggestion → Save.
//           Touch: long-press anything to pick it without opening pick mode first.
//   Clip  → a sound note on the podcast line that's playing, at this second (hiss, reword, say X first, …).
//   Notes → your notes with their status; tap the box to mark one done/open.
// Notes go to POST /api/feedback (analytics/src/feedback.js) with the admin token this browser holds: the one the
// admin page saves (sameep.ai/api/admin#k=…), or #k=<token> on the site in review mode. Notes that can't be sent
// wait in localStorage and go out on the next save or load. build/review/pull-feedback.mjs reads them back.
const KEY = 'otcv-review', TOKEN = 'otcv-admin', API_KEY = 'otcv-review-api', LAST = 'otcv-review-last', QUEUE = 'otcv-review-queue', POS = 'otcv-review-pos';
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage blocked */ } return null; };

const q = new URLSearchParams(location.search);
if (q.get('mode') === 'review') ls(KEY, '1');
if (q.get('mode') === 'off') ls(KEY, null);
if (ls(KEY) === '1') start();

function start() {
  const LIVE = /(^|\.)sameep\.ai$/.test(location.hostname);
  // the token only ever goes to these: a ?api= (or a stored value) that isn't one of them is ignored, so a link
  // like sameep.ai/?mode=review&api=https://evil can't redirect it. 4361 is the local Worker (launch.json "api-local").
  const BASES = ['https://sameep.ai/api', 'http://localhost:8787/api', 'http://127.0.0.1:8787/api', 'http://localhost:4361/api', 'http://127.0.0.1:4361/api'];
  const okBase = (b) => (BASES.includes(b) ? b : null);
  const asked = q.get('api')?.replace(/\/+$/, '');
  if (asked) { if (okBase(asked)) ls(API_KEY, asked); else console.warn('[review] ignoring ?api=' + asked + ': not an allowed API base'); }
  if (ls(API_KEY) && !okBase(ls(API_KEY))) ls(API_KEY, null);
  const API = LIVE ? '/api' : okBase(ls(API_KEY)) || 'https://sameep.ai/api';
  const ORIGINS = new Set([location.origin, ...BASES.map((b) => new URL(b).origin)].filter((o) => o === location.origin ? LIVE : true));
  // #k=<token> logs this browser in (the fragment never reaches a server), then leaves the address bar
  const hk = new URLSearchParams(location.hash.slice(1)).get('k');
  if (hk) { ls(TOKEN, hk); history.replaceState(null, '', location.pathname + location.search); }

  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = new URL('../css/review.css', import.meta.url).href;
  document.head.append(css);

  // ------------------------------------------------------------ the podcast, read from the outside
  // ?debug exposes window.__otcv.podcast; otherwise the clip element is caught as it plays and its src is looked up
  // in episode.json (every line's audio, per host and version) to get the node and line.
  // every element that's been played; whether it holds a clip is checked when a note is made (play() can come
  // before the src is set, e.g. on a resume)
  const played = new Set();
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...a) { played.add(this); return play.apply(this, a); };
  const isClip = (el) => /\/audio\/clips\//.test(el?.currentSrc || el?.src || '');
  const clipEl_ = () => { const c = [...played].filter(isClip); return c.find((el) => !el.paused) || c.pop() || null; };
  const clips = new Map(); // 'audio/clips/x.mp3' → {node, line, host, text}
  let defHost = null; // episode.json hosts[0]: who hosts when the visitor hasn't picked
  fetch(new URL('../data/episode.json', import.meta.url)).then((r) => r.json()).then((ep) => {
    defHost = ep.hosts?.[0]?.id || null;
    const add = (audio, v) => { if (audio && !clips.has(audio)) clips.set(audio, v); };
    for (const [node, n] of Object.entries(ep.nodes || {})) {
      for (const l of n.lines || []) {
        const each = (src, host) => {
          add(src.audio, { node, line: l.id, host, text: src.text || l.text });
          for (const o of Object.values(src.v || {})) add(o.audio, { node, line: l.id, host, text: o.text || src.text || l.text });
        };
        each(l, null);
        for (const [host, o] of Object.entries(l.h || {})) each(o, host);
      }
    }
  }).catch(() => {});
  const clipPath = (src) => { try { return decodeURIComponent(new URL(src, location.href).pathname).replace(/^.*?(audio\/clips\/)/, '$1'); } catch { return null; } };
  function podState() {
    const pod = window.__otcv?.podcast;
    const host = pod?.hostId || ls('otcv-host') || defHost;
    const el = pod?.audio || clipEl_();
    const src = el?.currentSrc || el?.src || '';
    const clip = /\/audio\/clips\//.test(src) ? clipPath(src) : null;
    const hit = clip ? clips.get(clip) : null;
    const line = pod?.lines?.[pod.li];
    const s = {
      node: pod?.nodeId || hit?.node || null,
      line: line?.id || hit?.line || (clip ? clip.replace(/^.*\//, '').replace(/\.mp3$/, '') : null),
      host: hit?.host || host,
      clip,
      t: el && clip ? Math.round((pod ? pod.t : el.currentTime) * 10) / 10 : null,
      playing: el ? !el.paused : false,
      line_text: (line?.text || hit?.text || '').slice(0, 300) || null,
    };
    return s.node || s.clip ? s : { host };
  }

  // ------------------------------------------------------------ what was picked
  const UI = 'rv'; // every review element carries data-rv; picks ignore them
  const mine = (el) => !!el?.closest?.('[data-rv]');
  const clean = (s, n = 160) => (s || '').replace(/\s+/g, ' ').trim().slice(0, n);
  const label = (el) => clean(el.getAttribute('aria-label') || el.getAttribute('alt') || el.getAttribute('title') || el.innerText || el.textContent || '', 120);
  function context(el) {
    const win = el.closest('.win'), mon = el.closest('.mon'), icon = el.closest('.icon'), bar = el.closest('.menubar');
    const c = {};
    if (win) c.window = win.getAttribute('aria-label') || clean(win.querySelector('.win__title')?.textContent, 60);
    if (mon) c.monitor = [mon.dataset.type, clean(mon.querySelector('h3, .mon__title, [class*="title"]')?.textContent, 60)].filter(Boolean).join(': ') || 'monitor';
    if (icon) c.item = clean(icon.querySelector('.icon__label')?.textContent || icon.getAttribute('title'), 60);
    if (bar) c.item = c.item || 'menu bar: ' + label(el).slice(0, 40);
    c.area = mon ? 'monitor' : win ? 'window:' + c.window : icon ? 'desktop' : bar ? 'menubar' : el.closest('#hero') ? 'hero' : 'page';
    return c;
  }
  // a selector that finds this element again: an id or a stable data-* hook if there is one, else a short tag.class
  // path anchored on the nearest window or id, with :nth-of-type only where siblings are ambiguous
  const css_ = (s) => (window.CSS?.escape ? CSS.escape(s) : s.replace(/[^\w-]/g, '\\$&'));
  const DATA = ['data-host', 'data-id', 'data-tab', 'data-len', 'data-i', 'data-type'];
  function step(el) {
    if (el.id && document.querySelectorAll('#' + css_(el.id)).length === 1) return { s: '#' + css_(el.id), anchor: true };
    let s = el.tagName.toLowerCase();
    if (el.matches('.win')) { const a = el.getAttribute('aria-label'); return { s: `section.win[aria-label="${a?.replace(/"/g, '\\"')}"]`, anchor: !!a }; }
    const cls = [...el.classList].filter((c) => !/^is-|^has-|^rv/.test(c)).slice(0, 2);
    s += cls.map((c) => '.' + css_(c)).join('');
    for (const d of DATA) if (el.hasAttribute(d)) { s += `[${d}="${el.getAttribute(d).replace(/"/g, '\\"')}"]`; break; }
    const sib = el.parentElement ? [...el.parentElement.children].filter((n) => n.matches(s)) : [];
    if (sib.length > 1) s += `:nth-of-type(${[...el.parentElement.children].filter((n) => n.tagName === el.tagName).indexOf(el) + 1})`;
    return { s };
  }
  function selector(el) {
    const parts = [];
    for (let n = el; n && n !== document.body && n.nodeType === 1; n = n.parentElement) {
      const st = step(n);
      parts.unshift(st.s);
      const sel = parts.join(' > ');
      if (st.anchor || parts.length >= 6) {
        try { if (document.querySelectorAll(sel).length === 1) return sel; } catch { /* odd class names */ }
        if (st.anchor) continue;
      }
    }
    return parts.join(' > ');
  }
  // a small crop, only where it's cheap: an <img>/<canvas>/<video> that isn't cross-origin
  function shot(el) {
    const m = el.matches('img, canvas, video') ? el : el.querySelector?.(':scope > img, :scope > canvas');
    if (!m) return null;
    try {
      const w = m.naturalWidth || m.videoWidth || m.width, hgt = m.naturalHeight || m.videoHeight || m.height;
      if (!w || !hgt) return null;
      const k = Math.min(1, 320 / Math.max(w, hgt));
      const c = document.createElement('canvas');
      c.width = Math.round(w * k); c.height = Math.round(hgt * k);
      c.getContext('2d').drawImage(m, 0, 0, c.width, c.height);
      const d = c.toDataURL('image/jpeg', 0.7);
      return d.length < 110_000 ? d : null;
    } catch { return null; } // tainted canvas
  }
  function device() {
    if (!matchMedia('(pointer: coarse)').matches) return 'desktop';
    return Math.min(screen.width, screen.height) < 600 ? 'phone' : 'tablet';
  }
  function ua() {
    const u = navigator.userAgent;
    const os = /iPhone|iPad/.test(u) ? 'iOS' : /Android/.test(u) ? 'Android' : /Mac/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : 'other';
    const b = /CriOS|Chrome\//.test(u) ? 'Chrome' : /Firefox|FxiOS/.test(u) ? 'Firefox' : /Safari\//.test(u) ? 'Safari' : 'browser';
    return os + ' ' + b;
  }

  // ------------------------------------------------------------ network
  const token = () => ls(TOKEN);
  // the authorization header goes only to an allowed origin, checked on the resolved URL at send time
  const authFor = (url) => (ORIGINS.has(new URL(url, location.href).origin) && token() ? { authorization: 'Bearer ' + token() } : {});
  const call = (path, opt = {}) => fetch(API + path, { ...opt, headers: { 'content-type': 'application/json', ...opt.headers, ...authFor(API + path) } })
    .then(async (r) => { const b = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(b.error || r.status), { status: r.status }); return b; });
  const queue = () => { try { return JSON.parse(ls(QUEUE) || '[]'); } catch { return []; } };
  async function flush() {
    let list = queue();
    while (list.length && token()) {
      try { await call('/feedback', { method: 'POST', body: JSON.stringify(list[0]) }); } catch (e) { if (e.status === 400) { /* bad note: drop it */ } else break; }
      list = queue().slice(1); ls(QUEUE, JSON.stringify(list));
    }
    return list.length;
  }

  // ------------------------------------------------------------ UI
  const h = (tag, props = {}, ...kids) => {
    const [t, ...cls] = tag.split('.');
    const el = document.createElement(t);
    if (cls.length) el.className = cls.join(' ');
    for (const [k, v] of Object.entries(props)) {
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else if (v != null && v !== false) el.setAttribute(k, v);
    }
    el.append(...kids.flat().filter((x) => x != null));
    return el;
  };
  const TAGS = {
    ui: [['copy', 'Copy change'], ['remove', 'Remove'], ['change', 'Change it'], ['bug', 'Bug'], ['off', 'Looks off'], ['love', 'Love it']],
    sound: [['hiss', 'Hiss here'], ['reword', 'Reword'], ['first', 'Say X first'], ['pronounce', 'Pronunciation'], ['long', 'Too long'], ['retake', 'Retake']],
  };
  const HINT = { copy: 'New copy…', remove: 'Why (optional)…', change: 'Do X instead…', bug: 'What happened…', off: 'What looks off…', love: 'What works (optional)…',
    hiss: 'Where / what (optional)…', reword: 'Say it like…', first: 'Say this first…', pronounce: 'How it should sound…', long: 'What to cut (optional)…', retake: 'How to read it…' };
  const tagName = Object.fromEntries([...TAGS.ui, ...TAGS.sound]);
  const fmtT = (t) => (t == null ? '' : `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`);

  let picking = false, target = null, notes = [], openList = false;
  const box = h('div.rv-box', { 'data-rv': UI, 'aria-hidden': 'true' });
  const catcher = h('div.rv-catch', { 'data-rv': UI });
  const count = h('span.rv-count', {}, '0');
  const pickBtn = h('button.rv-btn', { type: 'button', 'aria-pressed': 'false', title: 'Pick something to tag', 'aria-label': 'Pick' }, h('span.rv-ico.rv-ico--pick'), h('span.rv-lbl', {}, 'Pick'));
  const clipBtn = h('button.rv-btn.rv-btn--clip', { type: 'button', title: 'Sound note on the playing line' }, h('span.rv-ico.rv-ico--clip'), 'Clip');
  const listBtn = h('button.rv-btn', { type: 'button', 'aria-pressed': 'false', title: 'Your notes', 'aria-label': 'Notes' }, h('span.rv-lbl', {}, 'Notes'), count);
  const offBtn = h('button.rv-power', { type: 'button', title: 'Turn review mode off', 'aria-label': 'Turn review mode off' });
  const grip = h('span.rv-grip', { title: 'Drag to move · tap to fold' });
  const status = h('div.rv-status', { 'data-rv': UI, role: 'status' });
  const bar = h('div.rv-bar', { 'data-rv': UI, role: 'toolbar', 'aria-label': 'Review mode' }, grip, h('span.rv-name', {}, 'Review'), pickBtn, clipBtn, listBtn, offBtn);
  const list = h('div.rv-list', { 'data-rv': UI, hidden: true });
  const sheet = h('div.rv-sheet', { 'data-rv': UI, hidden: true, role: 'dialog', 'aria-label': 'New note' });
  document.body.append(box, catcher, list, sheet, bar, status);
  document.documentElement.classList.add('rv-on');

  // drag the toolbar by its grip; it stays where it was left
  try { const p = JSON.parse(ls(POS) || 'null'); if (p) Object.assign(bar.style, { left: p.x + 'px', top: p.y + 'px', right: 'auto', bottom: 'auto' }); } catch { /* default spot */ }
  const keepIn = () => {
    const r = bar.getBoundingClientRect();
    if (bar.style.left && (r.right > innerWidth || r.bottom > innerHeight || r.left < 0 || r.top < 0)) Object.assign(bar.style, { left: '', top: '', right: '', bottom: '' });
  };
  if (ls(POS + '-min')) bar.classList.add('is-min');
  addEventListener('resize', keepIn); requestAnimationFrame(keepIn);
  grip.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const r = bar.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    const mv = (ev) => {
      const x = Math.max(0, Math.min(innerWidth - r.width, ev.clientX - dx)), y = Math.max(0, Math.min(innerHeight - r.height, ev.clientY - dy));
      Object.assign(bar.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' });
    };
    const up = (ev) => {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      // a tap (no drag) folds the toolbar down to Pick + the count, or opens it again
      if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 5) { bar.classList.toggle('is-min'); ls(POS + '-min', bar.classList.contains('is-min') ? '1' : null); requestAnimationFrame(keepIn); return; }
      const b = bar.getBoundingClientRect(); ls(POS, JSON.stringify({ x: Math.round(b.left), y: Math.round(b.top) }));
    };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  });

  let stT = 0;
  const say = (msg, ms = 2600) => { status.textContent = msg; status.classList.add('is-on'); clearTimeout(stT); stT = setTimeout(() => status.classList.remove('is-on'), ms); };

  function outline(el) {
    if (!el) { box.hidden = true; return; }
    const r = el.getBoundingClientRect();
    Object.assign(box.style, { left: r.left - 2 + 'px', top: r.top - 2 + 'px', width: r.width + 4 + 'px', height: r.height + 4 + 'px' });
    box.dataset.label = (el.tagName.toLowerCase() + (el.classList[0] ? '.' + el.classList[0] : '')).slice(0, 40);
    box.hidden = false;
  }
  // under the catcher: the topmost site element at this point
  const under = (x, y) => document.elementsFromPoint(x, y).find((n) => !mine(n) && n !== document.documentElement && n !== document.body) || null;

  function setPicking(on) {
    picking = on;
    pickBtn.setAttribute('aria-pressed', String(on));
    catcher.classList.toggle('is-on', on);
    document.documentElement.classList.toggle('rv-picking', on);
    if (!on && !target) outline(null);
    if (on) say(matchMedia('(pointer: coarse)').matches ? 'Tap anything to tag it' : 'Click anything to tag it · Esc to stop');
  }
  catcher.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') outline(under(e.clientX, e.clientY)); });
  catcher.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    const el = under(e.clientX, e.clientY);
    setPicking(false);
    if (el) compose({ el });
  });
  pickBtn.addEventListener('click', () => { closeSheet(); setPicking(!picking); });

  // touch: a long-press on anything picks it (review mode only), and swallows the click that follows
  let lp = 0, lpAt = null, swallow = false;
  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || picking || mine(e.target) || !sheet.hidden) return;
    lpAt = { x: e.clientX, y: e.clientY };
    lp = setTimeout(() => { const el = under(lpAt.x, lpAt.y); lpAt = null; if (el) { swallow = true; setTimeout(() => { swallow = false; }, 900); navigator.vibrate?.(12); compose({ el }); } }, 550);
  }, true);
  const cancelLp = (e) => { if (lpAt && (!e.clientX || Math.hypot(e.clientX - lpAt.x, e.clientY - lpAt.y) > 10)) { clearTimeout(lp); lpAt = null; } };
  addEventListener('pointermove', cancelLp, true);
  addEventListener('pointerup', () => { clearTimeout(lp); lpAt = null; }, true);
  addEventListener('pointercancel', () => { clearTimeout(lp); lpAt = null; }, true);
  addEventListener('click', (e) => { if (swallow) { swallow = false; e.preventDefault(); e.stopPropagation(); } }, true);
  addEventListener('contextmenu', (e) => { if (swallow || !sheet.hidden) e.preventDefault(); }, true);

  clipBtn.addEventListener('click', () => {
    const s = podState();
    if (!s.clip) { say('No podcast line playing yet'); return; }
    setPicking(false);
    compose({ el: document.querySelector('.win--podcast') || document.body, sound: s });
  });

  // ------------------------------------------------------------ the note sheet
  function compose({ el, sound }) {
    target = { el, sound: sound || null };
    // picked inside the podcast while a line is loaded: offer both kinds, starting with the page kind
    const pod = sound || (el.closest('.win--podcast, .mon') ? podState() : null);
    target.pod = pod?.clip ? pod : null;
    let kind = sound ? 'sound' : 'ui';
    let tag = ls(LAST + '-' + kind) || TAGS[kind][0][0];
    outline(sound ? null : el);

    const chips = h('div.rv-chips', { role: 'radiogroup', 'aria-label': 'Tag' });
    const text = h('textarea.rv-text', { rows: '2', maxlength: '2000' });
    const what = h('div.rv-what');
    const kinds = h('div.rv-kinds', { role: 'tablist' });
    const mic = h('button.rv-mic', { type: 'button', title: 'Dictate', 'aria-label': 'Dictate' });
    let voiced = false;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) mic.hidden = true;
    let rec = null;
    mic.addEventListener('click', () => {
      if (rec) { rec.stop(); return; }
      rec = new SR(); rec.lang = 'en-GB'; rec.interimResults = true;
      const before = text.value ? text.value.replace(/\s*$/, ' ') : '';
      rec.onresult = (ev) => { text.value = before + [...ev.results].map((r) => r[0].transcript).join(''); voiced = true; };
      rec.onend = () => { rec = null; mic.classList.remove('is-on'); };
      rec.onerror = (ev) => say('Mic: ' + ev.error);
      mic.classList.add('is-on'); rec.start();
    });

    let snap = null; // what was picked, taken when it's picked: the site may re-render it before Save
    const paintWhat = () => {
      if (!snap || snap.el !== el || el.isConnected) snap = { el, c: context(el), selector: selector(el), text: label(el), shot: shot(el) };
      const c = snap.c;
      what.replaceChildren(
        kind === 'sound'
          ? h('span', {}, h('b', {}, target.pod.line || 'clip'), ` · ${target.pod.host || 'host'} · ${fmtT(target.pod.t)}`, target.pod.line_text ? h('q', {}, target.pod.line_text.slice(0, 90)) : null)
          : h('span', {}, h('b', {}, c.area.replace(/^window:/, '')), ' · ', h('code', {}, el.tagName.toLowerCase()), snap.text ? h('q', {}, snap.text.slice(0, 90)) : null),
        kind === 'ui' ? h('button.rv-up', { type: 'button', title: 'Pick the bigger thing around it', onclick: () => {
          if (el.parentElement && el.parentElement !== document.body) { el = el.parentElement; target.el = el; outline(el); paintWhat(); }
        } }, '↑ Parent') : '',
      );
    };
    const paint = () => {
      kinds.replaceChildren(...(target.pod ? ['ui', 'sound'] : [kind]).map((k) => h('button.rv-kind' + (k === kind ? '.is-on' : ''), { type: 'button', role: 'tab', 'aria-selected': String(k === kind), onclick: () => {
        kind = k; tag = ls(LAST + '-' + kind) || TAGS[kind][0][0]; outline(kind === 'ui' ? el : null); paint();
      } }, k === 'ui' ? 'This thing' : 'The audio')));
      chips.replaceChildren(...TAGS[kind].map(([id, name]) => h('button.rv-chip' + (id === tag ? '.is-on' : '') + '.rv-chip--' + id, { type: 'button', role: 'radio', 'aria-checked': String(id === tag), onclick: () => { tag = id; paint(); } }, name)));
      text.placeholder = HINT[tag] || 'Suggestion (optional)…';
      paintWhat();
    };
    paint();

    const save = h('button.rv-save', { type: 'button' }, 'Save');
    const cancel = h('button.rv-cancel', { type: 'button' }, 'Cancel');
    const close = h('button.rv-close', { type: 'button', 'aria-label': 'Close' });
    sheet.replaceChildren(
      h('div.rv-head', {}, close, h('div.rv-stripes', { 'aria-hidden': 'true' }), h('h2.rv-title', {}, 'New note')),
      h('div.rv-body', {}, kinds, what, chips, h('div.rv-field', {}, text, mic), h('div.rv-actions', {}, cancel, save)),
    );
    sheet.hidden = false;
    if (!matchMedia('(pointer: coarse)').matches) text.focus();
    close.onclick = cancel.onclick = closeSheet;
    text.onkeydown = (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save.click(); if (e.key === 'Escape') closeSheet(); };
    save.onclick = async () => {
      rec?.stop();
      ls(LAST + '-' + kind, tag);
      const c = snap.c;
      const s = kind === 'sound' ? target.pod : { ...(podState()), ...(target.pod || {}) };
      const note = {
        mode: 'review', ts: Date.now(), site: LIVE ? 'live' : 'dev', kind, tag, note: text.value.trim() || null, voice: voiced,
        area: kind === 'sound' ? 'podcast:' + (s.node || 'clip') : c.area,
        selector: kind === 'sound' ? null : snap.selector, text: kind === 'sound' ? s.line_text : snap.text,
        url: location.pathname + location.search + location.hash,
        state: { ...s, window: c.window, item: c.item, monitor: c.monitor },
        viewport: `${innerWidth}x${innerHeight}@${Math.round(devicePixelRatio * 10) / 10}`, device: device(), ua: ua(),
        shot: kind === 'sound' ? null : snap.shot,
      };
      const list_ = queue(); list_.push(note); ls(QUEUE, JSON.stringify(list_));
      closeSheet();
      if (!token()) { say('Saved here. Sign in to send it'); signIn(); return; }
      const left = await flush();
      say(left ? `Saved here, ${left} waiting to send` : `${tagName[tag]} noted`);
      refresh();
    };
  }
  function closeSheet() { sheet.hidden = true; sheet.replaceChildren(); target = null; outline(null); }

  // ------------------------------------------------------------ sign in, list, power
  function signIn() {
    openList = true; list.hidden = false; listBtn.setAttribute('aria-pressed', 'true');
    const inp = h('input.rv-token', { type: 'password', placeholder: 'Admin token', autocomplete: 'off' });
    const go = h('button.rv-save', { type: 'button' }, 'Sign in');
    go.onclick = async () => { if (!inp.value.trim()) return; ls(TOKEN, inp.value.trim()); const left = await flush(); refresh(); if (!left) say('Signed in'); };
    list.replaceChildren(h('div.rv-head', {}, h('h2.rv-title', {}, 'Sign in')), h('div.rv-body', {},
      h('p.rv-p', {}, 'Paste the admin token once for this browser (or open sameep.ai/api/admin#k=… on this device).'), h('div.rv-field', {}, inp), h('div.rv-actions', {}, go)));
  }
  async function refresh() {
    if (!token()) { count.textContent = String(queue().length); return; }
    try {
      notes = (await call('/feedback?status=all')).items || [];
      count.textContent = String(notes.filter((n) => n.status === 'open').length + queue().length);
      if (openList) paintList();
    } catch (e) {
      if (e.status === 401) { ls(TOKEN, null); say('Token not accepted'); if (openList) signIn(); }
      count.textContent = String(queue().length);
    }
  }
  function paintList() {
    const waiting = queue();
    const rows = notes.map((n) => {
      const done = n.status === 'done';
      const where = n.kind === 'sound' ? `${n.state?.line || ''} · ${fmtT(n.state?.t)}` : (n.area || '').replace(/^window:/, '');
      const tick = h('button.rv-tick' + (done ? '.is-on' : ''), { type: 'button', role: 'checkbox', 'aria-checked': String(done), 'aria-label': done ? 'Reopen' : 'Mark done', onclick: async () => {
        tick.disabled = true;
        try { await call('/feedback/' + n.id, { method: 'PATCH', body: JSON.stringify({ status: done ? 'open' : 'done' }) }); } catch { say('Could not update'); }
        refresh();
      } });
      return h('li.rv-item' + (done ? '.is-done' : ''), {}, tick, h('div.rv-item__main', {},
        h('div.rv-item__top', {}, h('span.rv-tag.rv-chip--' + n.tag, {}, tagName[n.tag] || n.tag), h('span.rv-item__where', {}, where)),
        n.note ? h('div.rv-item__note', {}, n.note) : n.el_text ? h('div.rv-item__note.is-quiet', {}, '“' + n.el_text.slice(0, 80) + '”') : null));
    });
    list.replaceChildren(
      h('div.rv-head', {}, h('h2.rv-title', {}, `Notes · ${notes.filter((n) => n.status === 'open').length} open`)),
      h('div.rv-body', {},
        waiting.length ? h('p.rv-p', {}, `${waiting.length} waiting to send`, h('button.rv-up', { type: 'button', onclick: async () => { await flush(); refresh(); } }, 'Retry')) : null,
        rows.length ? h('ul.rv-items', {}, rows) : h('p.rv-p', {}, 'No notes yet. Pick something and tag it.'),
        h('p.rv-p.rv-foot', {}, h('button.rv-up', { type: 'button', onclick: () => { ls(TOKEN, null); signIn(); } }, 'Sign out'))));
  }
  listBtn.addEventListener('click', () => {
    openList = !openList; list.hidden = !openList; listBtn.setAttribute('aria-pressed', String(openList));
    if (openList) { if (!token()) signIn(); else { paintList(); refresh(); } }
  });
  offBtn.addEventListener('click', () => {
    ls(KEY, null);
    HTMLMediaElement.prototype.play = play;
    [box, catcher, list, sheet, bar, status, css].forEach((n) => n.remove());
    document.documentElement.classList.remove('rv-picking', 'rv-on');
    // the address bar may still say ?mode=review: drop it so a reload stays off
    if (q.get('mode') === 'review') { q.delete('mode'); history.replaceState(null, '', location.pathname + (q.size ? '?' + q : '') + location.hash); }
  });
  addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, textarea, [contenteditable]')) return;
    if (e.key === 'Escape') { if (!sheet.hidden) closeSheet(); else if (picking) setPicking(false); }
  });

  flush().then(refresh);
  window.__otcvReview = { podState, selector, context, api: API }; // for QA from the console
}
