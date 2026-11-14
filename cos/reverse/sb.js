/* sb.js: the storyboard landing (Sameep's 16 beats). Three modes, with zoom transitions between them:
     scene  full-bleed objects (the 3D shelf and box, the sketch, the phone, the shoot, the listings)
     panel  the real Coco app (an iframe of /cos/app/ at the right view; a screenshot if it can't load)
     focus  the app dimmed behind, one card forward; it resolves into the panel with a "Decided" stamp
   Headline top-left (mono time line + a big Bricolage line). The Chief of staff dock sits bottom-right and only
   arrives once the voice note is sent. Everything is driven by config.storyboard (names live in the private config). */
import { init as initDoor } from './door3d.js?v=sb2';

const Q = new URLSearchParams(location.search);
const MUTED = Q.has('mute');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const str = (v, d) => (v == null || v === '' ? (d == null ? '' : d) : String(v));
const arr = (v) => (Array.isArray(v) ? v : []);
const PHONE = () => innerWidth < 760;

let cfg, SB, B = [], i = -1, playing = true, timer = 0, resT = 0, msgT = 0, raf = 0, prevMode = 'scene';
const ui = {};
let box = null, boxOn = false;

/* ---------- sound: unlocked by the first tap (the PIN or any tap), the voice note plays on the record beat ---------- */
let AC = null, SOUND = false; const CLIPS = {};
function clip(url) { if (!CLIPS[url]) { const a = new Audio(); a.preload = 'auto'; a.src = url; CLIPS[url] = a; } return CLIPS[url]; }
function unlock() {
  if (MUTED || SOUND) return;
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) { AC = null; }
  SOUND = true;
  Object.values(cfg.audio || {}).forEach((u) => { if (!u) return; const a = clip(u); a.muted = true; const p = a.play(); if (p && p.then) p.then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; }); });
  setSound();
}
function setSound() { if (ui.sound) { ui.sound.textContent = SOUND ? 'Sound on' : 'Sound off'; ui.sound.setAttribute('aria-pressed', SOUND ? 'true' : 'false'); } }
function tone(f, d, v, type, to) {
  if (!SOUND || !AC) return;
  const n = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f, n); if (to) o.frequency.exponentialRampToValueAtTime(to, n + d);
  g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(v, n + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, n + d);
  o.connect(g); g.connect(AC.destination); o.start(n); o.stop(n + d + 0.05);
}
const SFX = { sent: () => tone(520, 0.14, 0.1, 'sine', 1300), pop: () => tone(660, 0.12, 0.08), stamp: () => { tone(420, 0.1, 0.08); setTimeout(() => tone(840, 0.14, 0.06), 90); }, dock: () => tone(740, 0.16, 0.06, 'triangle') };
let NOW = null;
function playClip(key, onEnd) {
  stopClip(); const u = (cfg.audio || {})[key]; if (!u || MUTED) return false;
  if (!SOUND) return false;
  const a = clip(u); try { a.currentTime = 0; } catch (e) { /* */ }
  NOW = a; a.onended = () => { if (NOW === a) { NOW = null; if (onEnd) onEnd(); } };
  const p = a.play(); if (p && p.catch) p.catch(() => { if (NOW === a) NOW = null; if (ui.tapHear) ui.tapHear.hidden = false; });
  return true;
}
function stopClip() { if (NOW) { try { NOW.pause(); } catch (e) { /* */ } NOW = null; } }

/* ---------- the app (the real Coco app, same origin; a screenshot when it can't load) ---------- */
function appUrl(view) {
  /* config only: no URL overrides, so a link can never point the frame somewhere else */
  const A = SB.app || {}, base = str(A.base, '../app/');
  const v = str((A.views || {})[view], '');
  return base + v;
}
function appView(view) {
  if (!view || ui.appView === view) return;
  ui.appView = view;
  const url = appUrl(view), shot = (PHONE() && IMG('app_' + view + '_m')) || IMG('app_' + view);
  if (shot) ui.appShot.src = shot;
  try {
    if (ui.frame.dataset.base && url.split('#')[0] === ui.frame.dataset.base && ui.frame.contentWindow && ui.frame.contentWindow.location) { ui.frame.contentWindow.location.hash = url.split('#')[1] || ''; return; }
  } catch (e) { /* cross-origin: reload instead */ }
  ui.frame.dataset.base = url.split('#')[0]; ui.frame.src = url;
}

/* ---------- 3D box ---------- */
function ensureBox() {
  if (box) return box;
  /* her door: the parcel on the mat (the earlier 3D doorstep), opened there */
  try {
    const src = IMG('product');
    box = initDoor({ brand: { name: str((SB.box || {}).name), product: str((SB.box || {}).product) }, palette: cfg.palette || {}, shipping: cfg.shipping || {}, charmSrc: src }, () => src);
    ui.d3.appendChild(box.el); sizeBox();
  } catch (e) { box = null; }
  return box;
}
function sizeBox() {
  if (!box) return;
  const w = ui.d3.clientWidth || innerWidth, hh = ui.d3.clientHeight || innerHeight;
  if (PHONE()) box.size(w, hh, w * 0.5, hh * 0.56, Math.min(w * 0.78, hh * 0.42));
  else box.size(w, hh, w * 0.64, hh * 0.56, Math.min(w * 0.34, hh * 0.5));
}
function runBox(fn, dur) {
  cancelAnimationFrame(raf); if (!ensureBox()) return;
  const t0 = performance.now();
  (function f(now) {
    const t = REDUCED ? 1 : clamp((now - t0) / dur, 0, 1);
    box.doorPose(fn(t));
    if (boxOn) raf = requestAnimationFrame(f);
  })(t0);
}
/* poses: the box opening, delivered (held open, product up), and the full reverse */
const POSE = {
  /* today, at her door: the parcel lands, the tape and label come off, the flaps open, the charm rises */
  open: (t) => ({ drop: ease(seg(t, 0, 0.18)), open: seg(t, 0.26, 0.62), rise: seg(t, 0.6, 0.94), cam: seg(t, 0.5, 1) * 0.55 }),
  /* delivered: the parcel on her mat, shut */
  held: (t) => ({ drop: ease(seg(t, 0, 0.3)), open: 0, rise: 0, cam: 0 }),
  /* the reverse: the charm goes back in, the flaps close, tape and label go back on; the parcel sits at the door */
  close: (t) => ({ drop: 1, rise: 1 - ease(seg(t, 0, 0.3)), open: 1 - seg(t, 0.3, 0.86), cam: (1 - ease(seg(t, 0.55, 1))) * 0.55 })
};

/* ---------- builders for each kind of beat ---------- */
const IMG = (k) => str((SB.images || {})[k]);   /* under 'images': the private loader swaps those refs */
function img(src, cls, alt) { const e = h('img', cls); e.alt = alt || ''; e.decoding = 'async'; e.src = src; return e; }
function face(name, cls) {
  const src = (cfg.faces || {})[name]; const s = h('span', 'sb-face' + (cls ? ' ' + cls : ''));
  if (src) s.appendChild(img(src)); else s.textContent = str(name).charAt(0); return s;
}
function mark(t) { return h('span', 'sb-mark', t); }
function waveBars(n, cls) { const w = h('span', cls || 'sb-wave'); for (let k = 0; k < n; k++) { const b = h('i'); b.style.height = Math.round(18 + 70 * Math.abs(Math.sin(k * 1.7) * Math.cos(k * 0.45))) + '%'; w.appendChild(b); } return w; }
function ticks() { const s = h('span', 'sb-ticks'); s.innerHTML = '<svg viewBox="0 0 18 10" aria-hidden="true"><path d="M1 5.5l2.6 2.6L9 2.5M7.5 8l.6.6L13.5 2.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'; return s; }
function phone(b, sent) {
  const p = h('div', 'sb-phone');
  const hd = h('div', 'sb-ph-hd'); hd.appendChild(mark('C')); const ht = h('div'); ht.appendChild(h('b', null, 'Chief of staff')); ht.appendChild(h('span', null, str(SB.app_name, 'Coco'))); hd.appendChild(ht); p.appendChild(hd);
  const body = h('div', 'sb-ph-body');
  /* a sliver of the chat before the note: a date chip and what she said a minute earlier */
  const P = SB.phone || {};
  if (P.chip) body.appendChild(h('span', 'sb-chip', P.chip));
  arr(P.earlier).forEach((m) => { const e = h('div', 'sb-bub is-me is-text'); e.appendChild(h('span', null, m[0])); e.appendChild(h('span', 'sb-bub-t', m[1])); body.appendChild(e); });
  const ph = h('div', 'sb-bub is-me is-photo'); ph.appendChild(img(IMG('sketch'))); ph.appendChild(h('span', 'sb-bub-t', '1:13 am')); body.appendChild(ph);
  if (sent) {
    const vn = h('div', 'sb-bub is-me is-voice'); vn.appendChild(h('span', 'sb-play')); vn.appendChild(waveBars(26)); vn.appendChild(h('span', 'sb-len', str(b.len, '0:20'))); const tt = h('span', 'sb-bub-t', '1:14 am'); tt.appendChild(ticks()); vn.appendChild(tt);
    body.appendChild(vn); ui.flyBub = vn;
  }
  p.appendChild(body);
  if (!sent) {
    const rec = h('div', 'sb-rec'); rec.appendChild(h('span', 'sb-rec-dot')); const tm = h('span', 'sb-rec-t', '0:00'); rec.appendChild(tm);
    const live = h('span', 'sb-rec-w'); rec.appendChild(live); rec.appendChild(h('span', 'sb-rec-mic'));
    p.appendChild(rec); ui.recT = tm; ui.recW = live;
  } else {
    const inp = h('div', 'sb-ph-in'); inp.appendChild(h('span', null, 'Message')); p.appendChild(inp);
  }
  return p;
}
const BUILD = {
  'box-open': () => { boxOn = true; runBox(POSE.open, (B[i].dur || 5400) * 0.92); return null; },
  'held': () => { boxOn = true; runBox(POSE.held, 1400); return null; },
  'box-close': () => { boxOn = true; runBox(POSE.close, (B[i].dur || 5000) * 0.95); return null; },
  sketch: (b) => {
    const w = h('div', 'sb-morph');
    w.appendChild(img(IMG('product'), 'sb-fly'));
    const pg = h('div', 'sb-page'); pg.appendChild(h('span', 'sb-scrawl', str(b.scrawl)));
    pg.appendChild(img(IMG('sketch'), 'sb-sk'));
    arr(b.notes).forEach((n, k) => { const s = h('span', 'sb-note n' + k, n); pg.appendChild(s); });
    w.appendChild(pg); return w;
  },
  record: (b) => {
    const p = phone(b, false);
    const tap = h('button', 'sb-taphear', 'Tap to hear ' + str(b.who, 'her')); tap.type = 'button'; tap.hidden = true; ui.tapHear = tap;
    tap.addEventListener('click', (e) => { e.stopPropagation(); unlock(); tap.hidden = true; playClip(b.voice); });
    p.appendChild(tap);
    /* the timer counts, the waveform grows bar by bar; the real note plays when sound is on */
    let n = 0; const total = Math.max(20, Math.round((b.dur || 4800) / 160));
    clearInterval(ui.recI); ui.recI = setInterval(() => {
      if (!ui.recW || !ui.recW.isConnected) return clearInterval(ui.recI);
      n++; const s = Math.min(n * 0.16, 99); ui.recT.textContent = '0:' + String(Math.floor(s)).padStart(2, '0');
      if (ui.recW.children.length < 34) { const bar = h('i'); bar.style.height = Math.round(20 + 70 * Math.abs(Math.sin(n * 1.3) * Math.cos(n * 0.4))) + '%'; ui.recW.appendChild(bar); }
      if (n > total * 4) clearInterval(ui.recI);
    }, 160);
    const ok = playClip(b.voice); if (!ok && !MUTED && (cfg.audio || {})[b.voice]) tap.hidden = false;
    return p;
  },
  send: (b) => { const p = phone(b, true); SFX.sent(); setTimeout(() => { if (ui.flyBub) ui.flyBub.classList.add('is-fly'); }, 900); return p; },
  project: (b) => {
    const c = h('div', 'sb-card sb-proj'); const th = h('div', 'sb-proj-th'); th.appendChild(img(IMG('sketch'))); c.appendChild(th);
    const tx = h('div'); tx.appendChild(h('span', 'sb-k', str(b.kicker))); tx.appendChild(h('h3', null, str(b.title)));
    const own = h('div', 'sb-own'); own.appendChild(face(b.owner)); own.appendChild(h('span', null, str(b.owner) + ' owns it')); tx.appendChild(own); c.appendChild(tx); return c;
  },
  agents: (b) => {
    const c = h('div', 'sb-card sb-agents');
    arr(b.agents).forEach((a, k) => {
      const r = h('div', 'sb-ag'); const ring = h('span', 'sb-ring'); ring.style.setProperty('--p', a[1]); ring.style.setProperty('--d', (k * 0.35) + 's'); ring.appendChild(h('b', null, a[0].charAt(0)));
      r.appendChild(ring); const t = h('div'); t.appendChild(h('b', null, a[0])); t.appendChild(h('span', null, a[2] || '')); r.appendChild(t); c.appendChild(r);
    });
    return c;
  },
  decide: (b) => {
    const c = h('div', 'sb-card sb-dec'); c.appendChild(h('h3', null, str(b.q)));
    const g = h('div', 'sb-opts' + (arr(b.options).length > 2 ? ' is-3' : ''));
    arr(b.options).forEach((o) => {
      const btn = h('button', 'sb-opt' + (o.ai ? ' is-ai' : '')); btn.type = 'button'; btn.dataset.choose = o.label;
      const pic = h('span', 'sb-opt-pic'); if (o.pic && IMG(o.pic)) pic.appendChild(img(IMG(o.pic))); else { const ph = h('span', 'sb-opt-ph'); pic.appendChild(ph); }
      btn.appendChild(pic); btn.appendChild(h('b', null, o.label)); btn.appendChild(h('span', 'sb-opt-s', o.ai ? 'AI pick' : str(o.sub)));
      btn.addEventListener('click', (e) => { e.stopPropagation(); unlock(); each(g.children, (x) => x.classList.toggle('is-pick', x === btn)); choose(o.label); });
      g.appendChild(btn);
    });
    c.appendChild(g); return c;
  },
  shoot: () => {
    const w = h('div', 'sb-shoot'); w.appendChild(img(IMG('shoot'), 'sb-shoot-img')); w.appendChild(h('span', 'sb-flash'));
    const cam = h('span', 'sb-cam'); w.appendChild(cam); return w;
  },
  listing: (b) => {
    const w = h('div', 'sb-row5');
    arr(b.channels).forEach((c, k) => {
      const m = h('div', 'sb-mini'); m.style.animationDelay = (k * 0.18) + 's';
      m.appendChild(h('b', null, c)); m.appendChild(img(IMG('listing'))); m.appendChild(h('span', 'sb-mini-p', str(b.price)));
      const l = h('span', 'sb-live', 'Live'); l.style.animationDelay = (0.9 + k * 0.25) + 's'; m.appendChild(l); w.appendChild(m);
    });
    return w;
  },
  coco: (b) => {
    const c = h('div', 'sb-card sb-coco');
    const wm = h('div', 'sb-coco-wm'); wm.appendChild(h('b', null, 'Coco')); wm.appendChild(h('span', null, 'by sameep.ai')); c.appendChild(wm);
    c.appendChild(h('p', 'sb-coco-l', str(b.line)));
    const ul = h('ul', 'sb-parts'); arr(b.parts).forEach((p, k) => { const li = h('li', k ? '' : 'is-lead'); li.appendChild(h('b', null, p[0])); li.appendChild(h('span', null, p[1])); ul.appendChild(li); }); c.appendChild(ul);
    const go = h('button', 'sb-go', str(b.cta, 'See the scope and pricing')); go.type = 'button';
    go.addEventListener('click', (e) => { e.stopPropagation(); unlock(); offer(); }); c.appendChild(go);
    return c;
  }
};
function each(list, fn) { Array.prototype.forEach.call(list, fn); }

/* ---------- show a beat ---------- */
function show(k) {
  k = clamp(k, 0, B.length - 1);
  const b = B[k]; i = k;
  clearTimeout(timer); clearTimeout(resT); clearInterval(ui.recI); stopClip();
  const mode = b.m || 'scene';
  const trans = (mode !== 'scene' && prevMode === 'scene') ? 'is-zout' : (mode === 'scene' && prevMode !== 'scene') ? 'is-zin' : '';
  prevMode = mode;
  /* 3D: on for the box beats only */
  const is3d = /^(box-open|held|box-close)$/.test(b.kind);
  boxOn = is3d; if (!is3d) cancelAnimationFrame(raf);
  ui.root.dataset.mode = mode; ui.root.classList.toggle('is-3d', is3d); ui.root.classList.toggle('is-dark', false);   /* the doorstep is light plaster: ink type */
  /* the app: shown in panel and focus, dimmed in focus */
  if (mode !== 'scene') appView(b.app || 'today');
  ui.app.className = 'sb-app' + (mode === 'scene' ? '' : mode === 'focus' ? ' is-dim' : ' is-on') + (trans === 'is-zout' ? ' is-zout' : '');
  /* headline */
  ui.when.textContent = str(b.when); ui.hl.textContent = str(b.hl);
  ui.head.classList.remove('is-in'); void ui.head.offsetWidth; ui.head.classList.add('is-in');
  /* the scene or the card */
  ui.scene.innerHTML = ''; ui.focus.innerHTML = ''; ui.stamp.classList.remove('is-on');
  const built = BUILD[b.kind] ? BUILD[b.kind](b) : null;
  if (built) {
    if (mode === 'focus') { ui.focus.appendChild(built); ui.focus.className = 'sb-focus is-on'; }
    else { ui.scene.appendChild(built); ui.scene.className = 'sb-scene is-on ' + (trans === 'is-zin' ? 'is-zin' : ''); }
  }
  if (mode !== 'focus') ui.focus.className = 'sb-focus';
  if (mode === 'focus') SFX.pop();
  /* the Chief of staff: arrives once the note is sent, then speaks a beat after each scene settles */
  dockFor(b);
  /* progress, controls */
  ui.bar.style.transform = 'scaleX(' + ((k + 1) / B.length).toFixed(3) + ')'; ui.count.textContent = (k + 1) + ' / ' + B.length;
  ui.prev.disabled = k === 0;
  /* timing: a focus beat resolves itself at 55% (the AI pick), unless the visitor picks first */
  if (mode === 'focus') resT = setTimeout(() => resolve(), (b.dur || 5000) * 0.55);
  let dur = (b.dur || 5000) + (mode === 'focus' ? 1600 : 0);
  if (b.kind === 'record' && NOW && isFinite(NOW.duration) && NOW.duration > 0) dur = Math.max(dur, NOW.duration * 1000 + 700);
  else if (b.kind === 'record' && NOW) { NOW.addEventListener('loadedmetadata', () => { if (B[i] === b && playing) { clearTimeout(timer); timer = setTimeout(() => next(), Math.max(b.dur || 4800, NOW ? NOW.duration * 1000 + 700 : 0)); } }, { once: true }); }
  if (playing && k < B.length - 1) timer = setTimeout(() => next(), dur);
  try { history.replaceState(null, '', location.pathname + location.search.replace(/([?&])step=\d+&?/, '$1').replace(/[?&]$/, '') + '#' + (location.hash.indexOf('pin') >= 0 ? 'pin' : '')); } catch (e) { /* */ }
}
function dockFor(b) {
  clearTimeout(msgT);
  const d = ui.dock;
  if (!b.cos) { if (!b.dockKeep) d.classList.remove('is-in'); return; }
  ui.cstate.textContent = ''; ui.cmsg.innerHTML = ''; ui.cmsg.appendChild(dots());
  const wasIn = d.classList.contains('is-in');
  msgT = setTimeout(() => {
    if (!wasIn) SFX.dock();
    d.classList.add('is-in');
    msgT = setTimeout(() => { if (B[i] === b) { ui.cmsg.textContent = b.cos; ui.cstate.textContent = str(b.st); } }, 900);
  }, wasIn ? 250 : 1500);
}
function dots() { const s = h('span', 'sb-dots'); s.appendChild(h('i')); s.appendChild(h('i')); s.appendChild(h('i')); return s; }
function resolve(pick) {
  const b = B[i]; if (!b || b.m !== 'focus' || ui.focus.classList.contains('is-resolve')) return;
  const ai = arr(b.options).filter((o) => o.ai)[0];
  const name = pick || (ai && ai.label) || '';
  if (!pick && ai) each(ui.focus.querySelectorAll('[data-choose]'), (x) => x.classList.toggle('is-pick', x.dataset.choose === ai.label));
  ui.stamp.textContent = str(b.done, 'Added to the board').replace('__PICK__', name);
  ui.focus.classList.add('is-resolve'); ui.app.className = 'sb-app is-on'; ui.root.dataset.mode = 'panel'; ui.stamp.classList.add('is-on'); SFX.stamp();
  ui.cmsg.textContent = pick ? 'Got it. Going with ' + name + '.' : str(b.cos_done, b.options ? 'Going with ' + name + '.' : 'Done. It’s on the board.');
}
function choose(name) { clearTimeout(resT); resolve(name); clearTimeout(timer); if (playing) timer = setTimeout(() => next(), 2600); }
function next() { if (i < B.length - 1) show(i + 1); }
function prev() { if (i > 0) show(i - 1); }
function setPlay(on) { playing = on; ui.play.textContent = on ? 'Pause' : 'Play'; if (on) show(i); else clearTimeout(timer); }

/* ---------- the ending: the existing Coco offer pages (story.js renders them) ---------- */
function offer() {
  playing = false; clearTimeout(timer); ui.play.textContent = 'Play';
  if (cfg.offer && window.cosOffer) window.cosOffer(cfg, ui.offer);
  else if (SB.cta_href) location.href = SB.cta_href;
}

/* ---------- build ---------- */
function build() {
  document.documentElement.classList.add('is-sb');
  const app = document.getElementById('app') || document.body;
  app.innerHTML = '';
  const r = h('section', 'sb'); r.setAttribute('aria-label', str(SB.title, 'Coco')); ui.root = r;
  ui.d3 = h('div', 'sb-3d'); r.appendChild(ui.d3);
  ui.app = h('div', 'sb-app'); ui.frame = h('iframe', 'sb-frame'); ui.frame.title = 'Coco'; ui.frame.setAttribute('loading', 'eager'); ui.frame.setAttribute('tabindex', '-1');
  ui.appShot = h('img', 'sb-appshot'); ui.appShot.alt = ''; ui.app.appendChild(ui.appShot); ui.app.appendChild(ui.frame); r.appendChild(ui.app);
  /* the live app shows only when it really is the signed-in workspace (same origin, the app rendered);
     otherwise the screenshot of the real app underneath stays */
  ui.frame.addEventListener('load', () => {
    setTimeout(() => {
      let ok = false;
      try { const d = ui.frame.contentDocument; const t = d && d.body ? d.body.innerText.slice(0, 400) : ''; ok = !!d && /Coco/.test(d.title || t) && !/did not open|sign in|enter the pin|log in/i.test(t); } catch (e) { ok = false; }
      ui.app.classList.toggle('is-loaded', ok);
    }, 1800);
  });
  ui.scene = h('div', 'sb-scene'); r.appendChild(ui.scene);
  ui.focus = h('div', 'sb-focus'); r.appendChild(ui.focus);
  ui.stamp = h('div', 'sb-stamp'); r.appendChild(ui.stamp);
  ui.head = h('header', 'sb-head'); ui.when = h('p', 'sb-when'); ui.hl = h('h2', 'sb-hl'); ui.head.appendChild(ui.when); ui.head.appendChild(ui.hl); r.appendChild(ui.head);
  ui.dock = h('aside', 'sb-dock'); ui.dock.setAttribute('aria-live', 'polite');
  const dh = h('div', 'sb-dock-hd'); dh.appendChild(mark('C')); dh.appendChild(h('b', null, 'Chief of staff')); ui.cstate = h('span', 'sb-cstate'); dh.appendChild(ui.cstate); ui.dock.appendChild(dh);
  ui.cmsg = h('p', 'sb-cmsg'); ui.dock.appendChild(ui.cmsg); r.appendChild(ui.dock);
  const ctl = h('nav', 'sb-ctl'); ctl.setAttribute('aria-label', 'Story controls');
  const brand = h('span', 'sb-wm'); brand.appendChild(h('b', null, 'Coco')); brand.appendChild(h('span', null, 'by sameep.ai')); ctl.appendChild(brand);
  ui.prev = h('button', 'sb-btn', 'Back'); ui.play = h('button', 'sb-btn is-main', 'Pause'); ui.next = h('button', 'sb-btn', 'Next'); ui.sound = h('button', 'sb-btn', 'Sound off');
  [ui.prev, ui.play, ui.next, ui.sound].forEach((x) => { x.type = 'button'; ctl.appendChild(x); });
  const bw = h('span', 'sb-bar'); ui.bar = h('i'); bw.appendChild(ui.bar); ctl.appendChild(bw); ui.count = h('span', 'sb-count'); ctl.appendChild(ui.count);
  if (MUTED) ui.sound.hidden = true;
  r.appendChild(ctl);
  ui.offer = h('div', 'sb-offer'); r.appendChild(ui.offer);
  app.appendChild(r);
  ui.prev.addEventListener('click', (e) => { e.stopPropagation(); unlock(); prev(); });
  ui.next.addEventListener('click', (e) => { e.stopPropagation(); unlock(); next(); });
  ui.play.addEventListener('click', (e) => { e.stopPropagation(); unlock(); setPlay(!playing); });
  ui.sound.addEventListener('click', (e) => { e.stopPropagation(); if (SOUND) { SOUND = false; stopClip(); setSound(); } else unlock(); });
  addEventListener('pointerdown', () => unlock(), { once: true, capture: true });
  addEventListener('keydown', (e) => { if (e.target.closest && e.target.closest('.sb-offer')) return; if (e.key === 'ArrowRight') { unlock(); next(); } if (e.key === 'ArrowLeft') prev(); });
  addEventListener('resize', () => { sizeBox(); });
  setSound();
}

function start(raw) {
  cfg = raw || {}; SB = cfg.storyboard || {}; B = arr(SB.beats);
  if (!B.length) return false;
  document.title = str((cfg.page || {}).title, 'Coco') + ' · ' + str(SB.tagline, 'the chief of staff OS for consumer brands, by sameep.ai');
  build();
  if (SB.app) appView('today');
  const st = /[?&]step=(\d+)/.exec(location.search);
  playing = !Q.has('still');
  show(st ? +st[1] - 1 : 0);
  window.__sb = { show, next, prev, get i() { return i; }, get beat() { return B[i]; }, choose, resolve, offer, n: B.length };
  return true;
}
window.cosSB = start;
dispatchEvent(new Event('cosSB'));
