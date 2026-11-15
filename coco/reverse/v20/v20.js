/* v20.js: the v20 Coco landing. A film letterbox frames the story: the top bar holds the wordmark and the chapters,
   the bottom bar the line being said, the when, and a 2px progress line. The picture plays between them.
   Six chapters, each scene -> element -> panel: a scene from the real world, then ONE element travels out of it and
   lands on the panel's canvas, then the panel (v20-app.js) works on it. That travel is the one deliberate move per
   chapter; everything else is a hard cut. Nothing advances by itself: the viewer steps through with scroll, swipe, Next
   or the arrow keys (?autoplay brings the timed run back for recordings). Every artefact and task opens when clicked.
   Everything comes from config.v20 (names live in the private config). */
import { createPanel, EZ, read } from './v20-app.js?v=v21u';

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
const PAPER = '#F2F0EB';
const P3_URL = '../p20-parcel.js?v=p20k', DOOR_URL = '../door3d.js?v=sb2';   /* module-relative: the same URLs the page's boot list fetched */   /* keep in step with the boot list in scroll20.html */
const P3 = !Q.has('door3d');
const AUTO = !Q.has('manual');   /* the story plays itself once the viewer clicks to begin; it holds at the milestones (send the note, the decisions). ?manual = stepped */
let started = !AUTO;

let cfg, V, B = [], CH = [], i = -1, playing = true, timer = 0, raf = 0;
const ui = {};
let box = null, boxOn = false, boxReady = false, initP3 = null, p3Failed = false, initDoor = null, p3fonts = false, panel = null;
let viewOpen = false, wasPlaying = false;

/* ---------- images: config keys -> the first path that exists (a missing file falls through to the next) ---------- */
const GOOD = {};
function IMG(k) {
  if (!k) return '';
  const I = Object.assign({}, (cfg.storyboard || {}).images || {}, V.images || {});
  const v = I[k] != null ? I[k] : k;
  const L = arr(v).length ? v : [v];
  if (GOOD[k] !== undefined) return GOOD[k];
  return str(L[0]);
}
function candidates(k) {
  const I = Object.assign({}, (cfg.storyboard || {}).images || {}, V.images || {});
  const v = I[k]; if (v == null) return /\.(webp|png|jpe?g)|^blob:|^data:/.test(k) ? [k] : [];
  return (Array.isArray(v) ? v : [v]).filter(Boolean);
}

/* ---------- sound: off until a tap; the voice note plays on the midnight scene ---------- */
let AC = null, SOUND = false; const CLIPS = {}; let NOW = null;
function clip(url) { if (!CLIPS[url]) { const a = new Audio(); a.preload = 'auto'; a.src = url; CLIPS[url] = a; } return CLIPS[url]; }
function unlock() {
  if (MUTED || SOUND) return;
  try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) { AC = null; }
  SOUND = true;
  Object.values(cfg.audio || {}).forEach((u) => { if (!u) return; const a = clip(u); a.muted = true; const p = a.play(); if (p && p.then) p.then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; }); });
  setSound();
}
function tone(f, d, v, type, to) {
  if (!SOUND || !AC) return;
  const n = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f, n); if (to) o.frequency.exponentialRampToValueAtTime(to, n + d);
  g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(v, n + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, n + d);
  o.connect(g); g.connect(AC.destination); o.start(n); o.stop(n + d + 0.05);
}
function noise(d, v, f, q, type, to) {
  if (!SOUND || !AC) return;
  const n = AC.currentTime, len = Math.max(1, Math.floor(AC.sampleRate * d)), buf = AC.createBuffer(1, len, AC.sampleRate), ch = buf.getChannelData(0);
  for (let k = 0; k < len; k++) ch[k] = Math.random() * 2 - 1;
  const src = AC.createBufferSource(); src.buffer = buf; const bq = AC.createBiquadFilter(); bq.type = type || 'bandpass'; bq.frequency.setValueAtTime(f, n); if (to) bq.frequency.exponentialRampToValueAtTime(to, n + d); bq.Q.value = q || 1;
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(v, n + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, n + d);
  src.connect(bq); bq.connect(g); g.connect(AC.destination); src.start(n); src.stop(n + d + 0.02);
}
/* what the parcel does, heard: a lift, a landing, paper peeling, tape, card flaps, the printer */
const BOXFX = {
  lift: () => noise(0.5, 0.05, 500, 0.8, 'bandpass', 2400), land: () => { tone(120, 0.22, 0.09); noise(0.14, 0.06, 300, 0.7, 'lowpass'); }, settle: () => tone(150, 0.12, 0.04),
  peel: () => noise(0.42, 0.045, 3200, 1.4, 'bandpass', 5200), 'label-off': () => noise(0.16, 0.04, 4200, 1.2), 'tape-slit': () => noise(0.5, 0.06, 2400, 2.2, 'bandpass', 3600),
  flap: () => { noise(0.12, 0.06, 420, 0.8, 'lowpass'); tone(210, 0.07, 0.03); }, 'carton-rise': () => noise(0.4, 0.03, 900, 0.7, 'bandpass', 1800), 'tuck-open': () => noise(0.1, 0.04, 1200, 1), 'slide-out': () => noise(0.5, 0.03, 700, 0.7, 'bandpass', 2000),
  'carton-in': () => noise(0.35, 0.03, 800, 0.7), 'carton-down': () => { tone(140, 0.14, 0.05); noise(0.1, 0.04, 400, 0.8, 'lowpass'); }, 'tape-run': () => noise(0.9, 0.06, 2200, 2.4, 'bandpass', 3000), 'tape-cut': () => noise(0.08, 0.07, 5000, 1.5),
  'label-print': () => { tone(96, 0.7, 0.03, 'square'); noise(0.7, 0.02, 2600, 3); }, 'label-tear': () => noise(0.14, 0.05, 4600, 1.3), 'label-press': () => { tone(180, 0.1, 0.05); noise(0.08, 0.04, 600, 0.8, 'lowpass'); }, ready: () => { tone(660, 0.12, 0.04); setTimeout(() => tone(990, 0.2, 0.04), 110); }
};
const SFX = { recv: () => tone(740, 0.07, 0.03, 'sine', 980), sendh: () => tone(560, 0.08, 0.035, 'sine', 420), type: () => { tone(1500, 0.02, 0.012, 'square'); setTimeout(() => tone(1700, 0.02, 0.01, 'square'), 120); setTimeout(() => tone(1400, 0.02, 0.01, 'square'), 260); }, ping: () => tone(1180, 0.09, 0.035, 'triangle', 1560), miss: () => tone(220, 0.16, 0.05, 'sawtooth', 160), tab: () => noise(0.07, 0.03, 2400, 1.2), ching: () => { tone(1320, 0.1, 0.05, 'triangle'); setTimeout(() => tone(1760, 0.24, 0.05, 'triangle'), 80); }, rec: () => { tone(880, 0.09, 0.05); setTimeout(() => tone(880, 0.09, 0.05), 140); }, approve: () => { tone(523, 0.1, 0.06); setTimeout(() => tone(784, 0.2, 0.06), 90); noise(0.06, 0.03, 3000, 1); }, voice: () => tone(1040, 0.06, 0.03, 'triangle'), whoosh: () => noise(0.35, 0.04, 700, 0.8, 'bandpass', 2600), sent: () => tone(520, 0.14, 0.08, 'sine', 1300), pop: () => tone(660, 0.1, 0.035), stamp: () => { tone(420, 0.1, 0.06); setTimeout(() => tone(840, 0.14, 0.04), 90); }, land: () => tone(240, 0.16, 0.06), tick: () => tone(880, 0.07, 0.03, 'triangle'), done: () => { tone(620, 0.08, 0.04, 'triangle'); setTimeout(() => tone(930, 0.12, 0.04, 'triangle'), 70); }, chime: () => { tone(523, 0.22, 0.05); setTimeout(() => tone(659, 0.22, 0.05), 110); setTimeout(() => tone(784, 0.34, 0.05), 220); } };
function playClip(key) {
  stopClip(); const u = (cfg.audio || {})[key]; if (!u || MUTED || !SOUND) return false;
  const a = clip(u); try { a.currentTime = 0; } catch (e) { /* */ }
  NOW = a; const p = a.play(); if (p && p.catch) p.catch(() => { if (NOW === a) NOW = null; });
  return true;
}
function stopClip() { if (NOW) { try { NOW.pause(); } catch (e) { /* */ } NOW = null; } }

/* ---------- the 3D parcel (chapter 1, 5 and 6). parcel3d today; v20-3d adds the rewind and the packing line ----------
   Feature-detected: box.rewind(t) / box.pack(t) / box.arrive(t), or box.caps.{rewind,pack,arrive} meaning doorPose({rewind:t}) etc.
   Until they land, the door pose and a labelled placeholder stand in. */
/* p20 (v20-3d): box.play('open' | 'pack' | 'door', t). Chapter 1 is one take: t 0..0.3 is the parcel lifting off her mat and
   flying back to the packing station, 0.3..1 is parcel3d's opening there (label peel, open, product out, hero on paper). */
const P20 = () => !!box && typeof box.play === 'function';
const OPEN_SPLIT = 0.3;
const cap = (k) => !!box && (P20() ? /^(rewind|pack|arrive)$/.test(k) : (typeof box[k] === 'function' || !!(box.caps && box.caps[k])));
const poseOf = (k) => (t) => { if (typeof box[k] === 'function') { box[k](t); return null; } const o = {}; o[k] = t; return o; };
function p3cfg() { return { brand: cfg.brand || {}, box: (cfg.storyboard || {}).box || {}, palette: cfg.palette || {}, shipping: cfg.shipping || {} }; }
function ensureBox() {
  if (box) return box;
  try {
    const src = IMG('product');
    if (P3 && !initP3 && !p3Failed) return null;
    if (P3 && initP3) {
      box = initP3(Object.assign(p3cfg(), { station: V.station || {} }), (k) => (k === 'sketch' ? IMG('sketch') : src), { paper: PAPER, fontsIn: p3fonts, lazy: true });
      ui.d3.appendChild(box.el); sizeBox();
      if (box.on) box.on('hero', (r) => onHero(r));
      if (box.on) box.on('*', (name) => { if (BOXFX[name]) BOXFX[name](); });
      if (box.on) box.on('label', (r) => onLabel(r));
      return box;
    }
    if (!initDoor) return null;
    box = initDoor({ brand: { name: str(((cfg.storyboard || {}).box || {}).name), product: str(((cfg.storyboard || {}).box || {}).product) }, palette: cfg.palette || {}, shipping: cfg.shipping || {}, charmSrc: src }, () => src);
    ui.d3.appendChild(box.el); sizeBox();
  } catch (e) { box = null; }
  return box;
}
function sizeBox() {
  if (!box) return;
  const w = ui.d3.clientWidth || innerWidth, hh = ui.d3.clientHeight || innerHeight;
  if (P20()) { box.size(w, hh, w * 0.5, hh * (PHONE() ? 0.52 : 0.5)); return; }
  if (PHONE()) box.size(w, hh, w * 0.5, hh * 0.52, Math.min(w * 0.78, hh * 0.42));
  else box.size(w, hh, w * 0.5, hh * 0.5, Math.min(w * 0.34, hh * 0.5));
}
function runBox(fn, dur) {
  cancelAnimationFrame(raf); if (!boxReady || !ensureBox()) return false;
  const t0 = performance.now();
  (function f(now) {
    const t = REDUCED ? 1 : clamp((now - t0) / dur, 0, 1);
    const p = fn(t); if (p) box.doorPose(p);
    if (boxOn && t < 1) raf = requestAnimationFrame(f);
  })(t0);
  return true;
}
const POSE = {
  door: () => ({ drop: 1, open: 0, rise: 0, cam: 0 }),
  open: (t) => ({ drop: 1, open: seg(t, 0.12, 0.55), rise: seg(t, 0.52, 0.9), cam: seg(t, 0.45, 1) * 0.55, unfold: seg(t, 0.78, 1) }),
  arrive: (t) => ({ drop: ease(seg(t, 0, 0.35)), open: 0, rise: 0, cam: 0 })
};

/* ---------- the match cut (chapter 1): the 3D product at its hero pose -> its own pixels -> the doodle draws over ---------- */
let HERO = null;
const PROD_BOX = { l: 201 / 900, w: 498 / 900, t: 0, h: 1 };
const BOT3D = { cx: 0.33, t: 0.155, b: 0.952, w: 0.615 };
const SK_MAP = { l: -0.165, t: -0.178, s: 1.272 };
function onHero(r) {
  if (!r) return;
  const x = r.x != null ? r.x : r.left, y = r.y != null ? r.y : r.top, w = r.w != null ? r.w : r.width, hh = r.h != null ? r.h : r.height;
  if (!(w > 4 && hh > 4)) return;
  const o = ui.d3.getBoundingClientRect(), R = ui.pic.getBoundingClientRect();
  HERO = { x: x + o.left - R.left, y: y + o.top - R.top, w, h: hh, a: 0 };
  try {
    const cv = box && box.el, k = cv && cv.clientWidth ? cv.width / cv.clientWidth : 0;
    if (k > 0) {
      const x0 = Math.max(0, x - w * 0.25), y0 = Math.max(0, y - hh * 0.1), x1 = Math.min(cv.clientWidth, x + w * 1.25), y1 = Math.min(cv.clientHeight, y + hh * 1.16);
      const c = document.createElement('canvas'); c.width = Math.round((x1 - x0) * k); c.height = Math.round((y1 - y0) * k);
      c.getContext('2d').drawImage(cv, x0 * k, y0 * k, c.width, c.height, 0, 0, c.width, c.height);
      c.className = 'mc-ph'; HERO.snap = { el: c, x: x0 + o.left - R.left, y: y0 + o.top - R.top, w: x1 - x0, h: y1 - y0 };
    }
  } catch (e) { /* tainted: the product photo stands in */ }
  if (B[i] && B[i].scene === 'open' && B[i + 1] && B[i + 1].scene === 'sketch' && AUTO && playing && !viewOpen) { clearTimeout(timer); show(i + 1); }
}
function heroRect() {
  if (HERO) return HERO;
  const W = ui.pic.clientWidth, H = ui.pic.clientHeight, hh = Math.min(PHONE() ? H * 0.42 : Math.min(H * 0.62, 520), (W - 24) / SK_MAP.s);
  return { x: W / 2 - hh * PROD_BOX.w / 2, y: H * 0.52 - hh / 2, w: hh * PROD_BOX.w, h: hh, a: 0 };
}
const STROKES = [
  { w: 46, at: 0, d: 650, p: 'M365 175C300 170 250 200 250 255C250 300 268 310 268 318C248 330 245 360 250 390C255 410 262 415 262 420L262 700C265 760 300 775 370 775C440 775 480 760 488 700L488 420C490 410 495 400 495 385C495 340 480 325 470 318C482 300 490 280 488 250C480 200 440 170 390 175Z' },
  { w: 50, at: 420, d: 520, p: 'M360 150C350 60 470 35 482 108C486 150 440 165 418 150M482 150L520 220L540 290L560 340C605 360 605 425 560 432C515 430 518 360 556 330' },
  { w: 74, at: 640, d: 640, p: 'M270 230L470 260L270 300L470 340L270 380L470 420L280 470L480 520L280 580L480 640L280 700L470 750' },
  { w: 52, at: 1050, d: 420, p: 'M100 90L240 75L110 130L230 120L140 170L262 192' },
  { w: 56, at: 1250, d: 420, p: 'M590 140L770 110L600 190L770 170L670 225L745 215M672 250C682 300 650 322 608 332' },
  { w: 56, at: 1450, d: 420, p: 'M110 230L190 240L110 300L190 310L115 350L190 360L115 410L198 430L115 470L202 470L115 515' },
  { w: 52, at: 1650, d: 380, p: 'M60 600L252 580L90 640L242 640L110 690L262 680' },
  { w: 52, at: 1830, d: 380, p: 'M620 490L722 480L620 540L722 530M590 640L702 620L600 680L702 670L600 712L722 705' }
];
let skN = 0;
function doodle(src) {
  const id = 'vsk' + (++skN), NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 800 800'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('class', 'mc-ink'); svg.setAttribute('aria-hidden', 'true');
  const mask = document.createElementNS(NS, 'mask'); mask.id = id; mask.setAttribute('maskUnits', 'userSpaceOnUse'); ['x', 'y'].forEach((k) => mask.setAttribute(k, 0)); mask.setAttribute('width', 800); mask.setAttribute('height', 800);
  const paths = STROKES.map((st) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', st.p); p.setAttribute('pathLength', '1'); p.setAttribute('fill', 'none'); p.setAttribute('stroke', '#fff'); p.setAttribute('stroke-width', st.w); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); p.style.strokeDasharray = '1 1'; p.style.strokeDashoffset = '1'; mask.appendChild(p); return p; });
  const defs = document.createElementNS(NS, 'defs'); defs.appendChild(mask); svg.appendChild(defs);
  const im = document.createElementNS(NS, 'image'); im.setAttribute('href', src); im.setAttribute('width', 800); im.setAttribute('height', 800); im.setAttribute('mask', 'url(#' + id + ')'); svg.appendChild(im);
  svg.draw = (t0, full) => paths.forEach((p, k) => { const st = STROKES[k]; if (REDUCED || full) { p.style.strokeDashoffset = '0'; return; } p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: st.d, delay: (t0 || 0) + st.at, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'both' }); });
  return svg;
}
function placeAt(el, x, y, w, hh) { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = w + 'px'; el.style.height = hh + 'px'; }
function img(src, cls, alt) { const e = h('img', cls); e.alt = alt || ''; e.decoding = 'async'; if (src) e.src = src; return e; }

/* ---------- scenes ---------- */
/* a labelled hole where a still or a 3D shot will go, so the story runs before every piece has landed */
function hole(t, s) { const d = h('div', 'sc-hole'); d.appendChild(h('b', null, t)); if (s) d.appendChild(h('span', null, s)); return d; }
function still(k, ph) {
  const src = IMG(k), w = h('div', 'sc-still');
  if (src) { const im = img(src); im.onerror = () => { im.remove(); w.appendChild(hole(ph || k)); }; w.appendChild(im); } else w.appendChild(hole(ph || k));
  return w;
}
/* the element sitting in its scene, at a rect given as fractions of the picture */
function element(b, host) {
  const E = b.el || {}, at = arr(E.at).length === 4 ? E.at : [0.42, 0.3, 0.16, 0.4];
  const P = ui.pic.getBoundingClientRect(), W = P.width, H = P.height;
  let x = at[0] * W, y = at[1] * H, w = at[2] * W, hh = at[3] * H;
  if (PHONE() && arr(E.at_m).length === 4) { x = E.at_m[0] * W; y = E.at_m[1] * H; w = E.at_m[2] * W; hh = E.at_m[3] * H; }
  const n = h('div', 'el');
  if (E.label) { n.classList.add('is-label'); n.appendChild(panel.shipLabel()); }
  else { n.classList.add(E.fit === 'cover' ? 'is-cover' : 'is-cut'); n.appendChild(img(IMG(E.img))); }
  placeAt(n, x, y, w, hh); host.appendChild(n); ui.elNode = n;
  return n;
}
const play3 = (ch, a, z) => (t) => { box.play(ch, a + (z - a) * t); return null; };
const SCENE = {
  door: () => { boxOn = true; if (P20()) runBox(play3('open', 0, 0), 1); else if (cap('rewind')) runBox(() => poseOf('rewind')(0), 1); else runBox(POSE.door, 1); return null; },
  rewind: (b) => {
    if (P20()) { boxOn = true; runBox(play3('open', 0, OPEN_SPLIT), b.dur * 0.97); return null; }
    if (cap('rewind')) { boxOn = true; runBox(poseOf('rewind'), b.dur * 0.92); return null; }
    boxOn = false; return hole(str(b.ph, 'The packing station'), 'the 3D rewind (v20-3d) plays here');
  },
  open: (b) => { boxOn = true; if (P20()) runBox(play3('open', OPEN_SPLIT, 1), b.dur * 0.97); else runBox(POSE.open, b.dur * 0.94); return null; },
  sketch: (b) => {
    const r = heroRect(), wrap = h('div', 'mc');
    let ph, sk = h('div', 'mc-sk');
    if (HERO && HERO.snap) {
      const S = HERO.snap; ph = S.el; placeAt(ph, S.x, S.y, S.w, S.h); HERO.snap = null;
      const sy = (BOT3D.b - BOT3D.t) * r.h / 515, sx = BOT3D.w * r.w / 219;
      placeAt(sk, r.x + BOT3D.cx * r.w - 367 * sx, r.y + BOT3D.t * r.h - 196 * sy, 800 * sx, 800 * sy);
    } else {
      const pw = r.h, px = r.x - PROD_BOX.l * pw - (pw * PROD_BOX.w - r.w) / 2;
      ph = img(IMG('product'), 'mc-ph'); placeAt(ph, px, r.y, pw, pw);
      placeAt(sk, px + pw * SK_MAP.l, r.y + pw * SK_MAP.t, pw * SK_MAP.s, pw * SK_MAP.s);
    }
    wrap.appendChild(ph);
    const ink = doodle(str(IMG('sketch_ink'), IMG('sketch'))); sk.appendChild(ink); wrap.appendChild(sk);
    const seek = ui.seek;
    ink.draw(seek ? 0 : 120, seek);
    if (REDUCED || seek) ph.remove(); else setTimeout(() => ph.remove(), 120 + STROKES[0].at + STROKES[0].d);
    return wrap;
  },
  phone: (b) => {
    const w = h('div', 'sc-night'), p = h('div', 'ph');
    p.appendChild(h('i', 'ph-isl'));
    const sb = h('div', 'ph-sb'); sb.appendChild(h('b', null, str(b.clock, '1:32'))); const sg = h('span', 'ph-sig'); sg.appendChild(h('i')); sg.appendChild(h('i')); sg.appendChild(h('i')); sg.appendChild(h('em')); sb.appendChild(sg); p.appendChild(sb);
    const hd = h('div', 'ph-hd'); hd.appendChild(h('i', 'ph-back')); hd.appendChild(panel.face('Chief of staff')); const ht = h('div'); ht.appendChild(h('b', null, str(V.wordmark, 'Coco'))); ht.appendChild(h('span', null, 'chief of staff · online')); hd.appendChild(ht); p.appendChild(hd);
    const body = h('div', 'ph-body'), P = (cfg.storyboard || {}).phone || {};
    if (P.chip) body.appendChild(h('span', 'ph-chip', P.chip));
    const tick2 = () => { const t = h('i', 'ph-ck'); return t; };
    arr(P.earlier).forEach((m) => { const e = h('div', 'ph-b is-text'); e.appendChild(h('span', null, m[0])); const t = h('span', 'ph-t', m[1]); t.appendChild(tick2()); e.appendChild(t); body.appendChild(e); });
    const sk = h('div', 'ph-b is-photo'); sk.appendChild(img(str(IMG('sketch_ink'), IMG('sketch')))); { const t = h('span', 'ph-t', str(b.photo_at, '1:31 am')); t.appendChild(tick2()); sk.appendChild(t); } body.appendChild(sk);
    const sent = h('div', 'ph-b is-voice'); const vb = panel.voiceBubble(b.len); sent.appendChild(vb); { const t = h('span', 'ph-t', str(b.at, '1:32 am')); t.appendChild(tick2()); sent.appendChild(t); } body.appendChild(sent);
    p.appendChild(body);
    const recw = h('div', 'ph-recw'), tr = h('p', 'ph-tr'); recw.appendChild(tr);
    const rec = h('div', 'ph-rec'); rec.appendChild(h('span', 'ph-dot')); const tm = h('span', 'ph-rt', '0:00'); rec.appendChild(tm); const live = h('span', 'ph-rw'); rec.appendChild(live); rec.appendChild(h('span', 'ph-mic')); recw.appendChild(rec); p.appendChild(recw);
    const inp = h('div', 'ph-in'); inp.appendChild(h('span', null, 'Message')); inp.appendChild(h('i', 'ph-mic')); p.appendChild(inp);
    w.appendChild(p);
    sent.hidden = true; inp.hidden = true;
    const send = () => { if (!recw.isConnected || recw.hidden) return; ui.sceneAct = null; clearInterval(ui.recI); recw.hidden = true; if (AUTO && started && playing && !ui.seek) { clearTimeout(timer); timer = setTimeout(autoNext, 2400); } sent.hidden = false; inp.hidden = false; ui.elNode = vb; if (!ui.seek) { SFX.sent(); if (!REDUCED) sent.animate([{ translate: '0 14px', scale: '.96' }, { translate: '0 0', scale: '1' }], { duration: 380, easing: EZ }); } };
    if (ui.seek) { send(); return w; }
    /* every word has its moment: the cues are the spoken phrases with their start and end in the clip */
    const cues = arr(b.cues).length ? arr(b.cues) : [[str(b.words), 0.3, Math.max(4, str(b.words).split(/\s+/).length * 0.33)]];
    const W = []; cues.forEach((c) => { const ws = str(c[0]).split(/\s+/).filter(Boolean), tot = ws.reduce((a, x) => a + x.length + 1, 0) || 1; let acc = 0; ws.forEach((x) => { const sp = h('span', null, x + ' '); sp.style.visibility = 'hidden'; tr.appendChild(sp); W.push({ sp, t: c[1] + (c[2] - c[1]) * acc / tot }); acc += x.length + 1; }); });
    const total = cues[cues.length - 1][2] + 0.5, useA = SOUND && !MUTED && !!(cfg.audio || {})[b.voice];
    const t0 = performance.now(); let bars = 0, done = 0;
    /* the clock is the clip's own time when it is playing, so the words can never run ahead of the voice */
    const clock = () => { const el = (performance.now() - t0) / 1000; if (useA && NOW && !NOW.paused && !NOW.ended) return NOW.currentTime; if (useA && NOW && NOW.ended) return total; if (useA && el < 1.6) return 0; return useA ? el - 1.6 : el - 0.4; };
    SFX.rec(); if (b.voice) setTimeout(() => { if (B[i] === b) playClip(b.voice); }, 380);
    clearInterval(ui.recI);
    ui.recI = setInterval(() => {
      if (!rec.isConnected) return clearInterval(ui.recI);
      const t = clock(); if (t <= 0) return;
      tm.textContent = '0:' + String(Math.floor(t)).padStart(2, '0');
      while (done < W.length && W[done].t <= t) { W[done].sp.style.visibility = ''; done++; }
      const want = Math.min(34, Math.floor(t / 0.16)); while (bars < want) { const bar = h('i'); bar.style.height = Math.round(20 + 70 * Math.abs(Math.sin(bars * 1.3) * Math.cos(bars * 0.4))) + '%'; live.appendChild(bar); bars++; }
      if (t >= total) { clearInterval(ui.recI); send(); }
    }, 60);
    return w;
  },
  /* the dashboard: the whole OS on one screen (side nav, ask bar, the numbers, the chart, what the agents did, one draft waiting) */
  dash: (b) => {
    const d = b.os || {}, w = h('div', 'os'), seq = !ui.seek && !REDUCED, T = (ms, fn) => { if (seq) { const k = i; setTimeout(() => { if (i === k && w.isConnected) fn(); }, ms); } else fn(); };
    const nav = h('aside', 'os-nav'); const wm = h('b', 'os-wm', str(V.wordmark, 'Coco')); nav.appendChild(wm); nav.appendChild(h('span', 'os-wms', str(V.lockup, 'chief of staff OS')));
    arr(d.nav).forEach((n, j) => { const a = h('span', 'os-ni' + (j === 0 ? ' is-on' : ''), n); nav.appendChild(a); }); w.appendChild(nav);
    const main = h('div', 'os-main'); w.appendChild(main);
    const ask = h('div', 'os-ask'); ask.appendChild(panel.face('Chief of staff')); const at = h('span', null, ''); ask.appendChild(at); main.appendChild(ask);
    const hd = h('div', 'os-hd'); hd.appendChild(h('h2', null, str(d.greet))); hd.appendChild(h('span', null, str(d.sub))); main.appendChild(hd);
    const K = h('div', 'os-kpis'); arr(d.kpis).forEach((k) => { const c = h('div', 'os-k'); c.appendChild(h('span', 'os-kk', k[0])); const n = h('b', null, k[1]); c.appendChild(n); c.appendChild(h('span', 'os-ks', k[2])); K.appendChild(c); }); main.appendChild(K);
    const row = h('div', 'os-row'); main.appendChild(row);
    const ch = h('section', 'os-card os-chart'); ch.appendChild(h('span', 'os-ct', str((d.chart || {}).title, 'Orders by channel')));
    const S = arr((d.chart || {}).series), mx = Math.max(1, ...S.flatMap((x) => arr(x.pts))), NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 600 200'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('class', 'os-svg');
    const paths = S.map((x, j) => { const P = arr(x.pts), pth = document.createElementNS(NS, 'path'); pth.setAttribute('d', 'M' + P.map((v, q) => (q * 600 / Math.max(1, P.length - 1)).toFixed(1) + ' ' + (192 - v / mx * 180).toFixed(1)).join(' L')); pth.setAttribute('class', 'os-l os-l' + j); pth.setAttribute('pathLength', '1'); svg.appendChild(pth); return pth; });
    ch.appendChild(svg);
    const lg = h('div', 'os-lg'); S.forEach((x, j) => { const r = h('div'); r.appendChild(h('span', null, x.name)); const bar = h('i', 'os-b os-b' + j); const f = h('em'); f.style.width = Math.round(arr(x.pts).slice(-1)[0] / mx * 100) + '%'; bar.appendChild(f); r.appendChild(bar); r.appendChild(h('b', null, str(x.n))); lg.appendChild(r); }); ch.appendChild(lg);
    row.appendChild(ch);
    const fd = h('section', 'os-card os-feed'); fd.appendChild(h('span', 'os-ct', str(d.feed_title, 'Today, from the agents')));
    const rows = arr(d.feed).map((f) => { const r = h('div', 'os-fr'); r.appendChild(h('em', null, f[0])); r.appendChild(h('span', null, f[1])); fd.appendChild(r); return r; });
    let dr = null; if (d.draft) { dr = h('div', 'os-draft'); dr.appendChild(h('b', null, d.draft.title)); dr.appendChild(h('p', null, d.draft.text)); const ac = h('div', 'os-acts'); arr(d.draft.acts).forEach((a, j) => ac.appendChild(h('span', j ? '' : 'is-go', a))); dr.appendChild(ac); fd.appendChild(dr); }
    row.appendChild(fd);
    /* it fills in the way a screen does when you open it: the question, the numbers, the lines, then what happened */
    if (seq) {
      [...K.children].forEach((c) => { c.style.visibility = 'hidden'; }); rows.forEach((r) => { r.style.visibility = 'hidden'; }); if (dr) dr.style.visibility = 'hidden';
      paths.forEach((pth) => { pth.style.strokeDasharray = '1'; pth.style.strokeDashoffset = '1'; });
      const q = str(d.ask); [...q].forEach((c0, j) => T(500 + j * 45, () => { at.textContent = q.slice(0, j + 1); if (j % 3 === 0) SFX.type(); }));
      const t1 = 600 + q.length * 45;
      [...K.children].forEach((c, j) => T(t1 + j * 260, () => { c.style.visibility = ''; c.animate([{ translate: '0 14px' }, { translate: '0 0' }], { duration: 420, easing: EZ }); SFX.tick(); panel.sheen(c); }));
      paths.forEach((pth, j) => T(t1 + 1200 + j * 350, () => { pth.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1300, easing: 'cubic-bezier(.3,.6,.3,1)', fill: 'forwards' }); }));
      rows.forEach((r, j) => T(t1 + 1900 + j * 420, () => { r.style.visibility = ''; r.animate([{ translate: '14px 0' }, { translate: '0 0' }], { duration: 360, easing: EZ }); SFX.recv(); }));
      if (dr) T(t1 + 2000 + rows.length * 420, () => { dr.style.visibility = ''; dr.animate([{ translate: '0 16px', scale: '.97' }, { translate: '0 0', scale: '1' }], { duration: 460, easing: EZ }); SFX.land(); panel.sheen(dr); });
    } else at.textContent = str(d.ask);
    return w;
  },
  still: (b) => { const w = still(PHONE() && b.img_m ? b.img_m : b.img, b.ph); if (b.el) placeEl(b, w); const im = w.querySelector('img'); if (im && !REDUCED && !ui.seek) im.animate([{ transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 6500, easing: 'cubic-bezier(.2,.6,.2,1)' }); return w; },
  pack: (b) => {
    if (P20()) { boxOn = true; ui.labelHost = h('div', 'sc-over'); runBox(play3('pack', 0, 1), b.p3dur || b.dur * 0.9); return ui.labelHost; }
    if (cap('pack')) { boxOn = true; runBox(poseOf('pack'), b.dur * 0.8); const w = h('div', 'sc-over'); if (b.el) ui.sceneT = setTimeout(() => element(b, w), ui.seek ? 0 : b.dur * 0.55); return w; }
    boxOn = false; const w = still(b.img, b.ph); if (b.el) setTimeout(() => element(b, w), 0); return w;
  },
  arrive: (b) => { boxOn = true; if (P20()) runBox(play3('door', 0, 1), Math.min(b.dur * 0.9, 4200)); else if (cap('arrive')) runBox(poseOf('arrive'), b.dur * 0.9); else runBox(POSE.arrive, b.dur * 0.9); return null; },
  end: () => { boxOn = true; if (P20()) runBox(play3('door', 1, 1), 1); else runBox(POSE.door, 1); return null; }
};
const IS3D = (b) => b.type === 'scene' && (/^(door|open|arrive|end)$/.test(b.scene) || (b.scene === 'rewind' && cap('rewind')) || (b.scene === 'pack' && cap('pack')));

/* a still drawn object-fit: cover; its element sits at the image-fraction rect, mapped through the crop (exact pixels) */
function placeEl(b, host) {
  const im = host.querySelector('img'), E = b.el || {}, ph = PHONE();
  const fr = (ph && arr(E.frac_m).length === 4 ? E.frac_m : E.frac);
  const go = () => {
    if (!host.isConnected && !ui.scene.contains(host)) return;
    if (!im || !fr || !im.naturalWidth) { element(b, host); return; }
    const W = ui.pic.clientWidth, H = ui.pic.clientHeight, iw = im.naturalWidth, ih = im.naturalHeight, k = Math.max(W / iw, H / ih), ox = (W - iw * k) / 2, oy = (H - ih * k) / 2;
    const n = h('div', 'el ' + (E.fit === 'cover' ? 'is-cover is-print' : 'is-cut'));
    n.appendChild(img(IMG(ph && E.img_m ? E.img_m : E.img)));
    placeAt(n, ox + fr[0] * iw * k, oy + fr[1] * ih * k, fr[2] * iw * k, fr[3] * ih * k);
    const show = () => { host.appendChild(n); ui.elNode = n; };
    if (E.appear && !ui.seek) ui.sceneT = setTimeout(show, E.appear); else show();
  };
  if (im && !im.complete) im.addEventListener('load', go, { once: true }); else setTimeout(go, 0);
}
/* the pressed label on the 3D box (p20 'label' event): a flat copy laid exactly over it, which then lifts out */
function onLabel(r) {
  const host = ui.labelHost; if (!host || !host.isConnected || !r || !(B[i] && B[i].el)) return;   /* only when the label is going to travel; otherwise the 3D label is the only one */
  const C = r.corners, d = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const w = C ? d(C.tl, C.tr) : r.w, hh = C ? d(C.tl, C.bl) : r.h, cx = r.cx != null ? r.cx : r.x + r.w / 2, cy = r.cy != null ? r.cy : r.y + r.h / 2;
  const o = ui.d3.getBoundingClientRect(), P = ui.pic.getBoundingClientRect();
  const n = h('div', 'el is-label is-on3d'), L = panel.shipLabel(); n.appendChild(L); host.appendChild(n);
  const nw = L.offsetWidth, nh = L.offsetHeight;
  n.style.left = '0px'; n.style.top = '0px'; n.style.width = nw + 'px'; n.style.height = nh + 'px';
  const x = cx + o.left - P.left, y = cy + o.top - P.top;
  n._geo = { cx: x, cy: y, sx: w / nw, sy: hh / nh, a: +(r.angle || 0), nw, nh };
  n.style.transformOrigin = '50% 50%';
  n.style.transform = 'translate(' + (x - nw / 2) + 'px,' + (y - nh / 2) + 'px) rotate(' + n._geo.a + 'deg) scale(' + n._geo.sx + ',' + n._geo.sy + ')';
  ui.elNode = n;
}
/* ---------- the element travels out of its scene and lands on the canvas ---------- */
function rectIn(el, P) { const a = el.getBoundingClientRect(); return { x: a.left - P.left, y: a.top - P.top, w: a.width, h: a.height }; }
function contained(imgEl, r) {   /* the visible picture inside an object-fit: contain box */
  const nw = imgEl.naturalWidth, nh = imgEl.naturalHeight; if (!nw || !nh) return r;
  const s = Math.min(r.w / nw, r.h / nh), w = nw * s, hh = nh * s; return { x: r.x + (r.w - w) / 2, y: r.y + (r.h - hh) / 2, w, h: hh };
}
function travel(src, card) {
  return new Promise((done) => {
    const P = ui.pic.getBoundingClientRect(), M = panel.mediaOf(card);
    if (!src || !M || REDUCED) { done(); return; }
    const kind = src.kind, tgt = kind === 'voice' ? M.querySelector('.vb') : kind === 'label' ? M.querySelector('.sl') : M.querySelector('img');
    if (!tgt) { done(); return; }
    let to = rectIn(tgt, P); if (kind === 'img' && !M.classList.contains('is-cover')) to = contained(tgt, to);
    if (!src.r && !src.g) { done(); return; }
    const fly = src.node; fly.classList.add('fly'); ui.fly.appendChild(fly);
    tgt.style.visibility = 'hidden';
    const fin = () => { tgt.style.visibility = ''; fly.remove(); SFX.land(); done(); };
    let an;
    if (kind === 'img') {
      placeAt(fly, src.r.x, src.r.y, src.r.w, src.r.h);
      if (M.classList.contains('is-cover')) fly.classList.add('is-cover');
      an = fly.animate([{ left: src.r.x + 'px', top: src.r.y + 'px', width: src.r.w + 'px', height: src.r.h + 'px' }, { left: to.x + 'px', top: to.y + 'px', width: to.w + 'px', height: to.h + 'px' }], { duration: 1300, easing: EZ, fill: 'forwards' });
    } else {   /* the same component, natural size, moved and scaled from one rect to the other */
      const nw = src.nw, nh = src.nh; fly.style.width = nw + 'px'; fly.style.height = nh + 'px'; fly.style.left = '0px'; fly.style.top = '0px'; fly.style.transformOrigin = '50% 50%';
      const geo = (r) => ({ cx: r.x + r.w / 2, cy: r.y + r.h / 2, sx: r.w / nw, sy: r.h / nh, a: 0 });
      const tf = (g) => 'translate(' + (g.cx - nw / 2) + 'px,' + (g.cy - nh / 2) + 'px) rotate(' + g.a + 'deg) scale(' + g.sx + ',' + g.sy + ')';
      const g0 = src.g || geo(src.r), g1 = geo(to);
      an = fly.animate([{ transform: tf(g0) }, { transform: tf(g1) }], { duration: 1300, easing: EZ, fill: 'forwards' });
    }
    an.onfinish = fin; an.oncancel = fin;
  });
}
/* take the element out of the scene before the cut (its rect, and a copy at natural size) */
function grab() {
  const n = ui.elNode; if (!n || !n.isConnected) return null;
  const P = ui.pic.getBoundingClientRect(), r = rectIn(n, P);
  if (n.classList.contains('vb')) { const c = n.cloneNode(true); return { kind: 'voice', r, node: wrapFly(c), nw: n.offsetWidth, nh: n.offsetHeight }; }
  if (n._geo) { const g = n._geo, c = n.querySelector('.sl').cloneNode(true); return { kind: 'label', g, node: wrapFly(c), nw: g.nw, nh: g.nh }; }
  if (n.classList.contains('is-label')) { const s = n.querySelector('.sl'); const c = s.cloneNode(true); return { kind: 'label', r: rectIn(s, P), node: wrapFly(c), nw: s.offsetWidth, nh: s.offsetHeight }; }
  const im = n.querySelector('img'); if (!im) return null;
  const node = h('div', 'el-fly'); node.appendChild(img(im.currentSrc || im.src));
  return { kind: 'img', r: n.classList.contains('is-cover') ? r : contained(im, r), node };
}
function wrapFly(c) { const d = h('div', 'el-fly is-dom'); d.appendChild(c); return d; }

/* ---------- show a beat ---------- */
/* ---------- the guide: a pointer and a caption that names each new thing as it first appears (the sameep.ai guide, here) ---------- */
const GSEL = { phone: '.ph', team: '.bd-team', strip: '.bd-strip', stage: '.bd-st.is-on', side: '.bd-tiles', thread: () => { const l = document.querySelectorAll('.p-list .p-m'); return l[l.length - 1] || document.querySelector('.p-thr'); }, now: '.bd-now', tasks: '.bd-tasks', task: '.bd-tc.is-active', canvas: () => document.querySelector('.p-stage .a') || document.querySelector('.p-inline:last-of-type .a') || document.querySelector('.p-stage'), tabs: '.p-tabs' };
const GARROW = '<svg viewBox="0 0 12 19" width="20" height="31" aria-hidden="true"><path d="M1 1v15l3.6-3.4 2.6 5.6 2.4-1.1-2.6-5.5H12L1 1z" fill="#0B0B0C" stroke="#fff" stroke-width="1.1" stroke-linejoin="round"/></svg>';
let G = null;
function guideOff() { if (!G) return; const g = G; G = null; clearTimeout(g.t); if (g.lit) g.lit.classList.remove('is-guided'); g.cap.remove(); if (g.cur) g.cur.remove(); g.res(); }
function guide(list, k) {
  list = arr(list); if (!list.length || ui.seek || !AUTO || Q.has('noguide')) return Promise.resolve();
  guideOff();
  return new Promise((res) => {
    const cap = h('div', 'v-guide'), tx = h('p'), bar = h('i', 'v-gbar'); cap.appendChild(tx); cap.appendChild(bar); cap.setAttribute('role', 'status');
    const cur = PHONE() || REDUCED ? null : h('div', 'v-gcur'); if (cur) cur.innerHTML = GARROW;
    ui.root.appendChild(cap); if (cur) ui.root.appendChild(cur);
    const g = G = { cap, cur, lit: null, t: 0, res }; let n = -1;
    const step = () => {
      if (G !== g) return; n++;
      if (n >= list.length || i !== k || !playing) return guideOff();
      const it = list[n], sel = GSEL[it.at] || it.at, el = typeof sel === 'function' ? sel() : document.querySelector(sel), vis = el && el.getClientRects().length ? el : null;
      if (g.lit) g.lit.classList.remove('is-guided'); g.lit = vis; if (vis) vis.classList.add('is-guided');
      tx.textContent = it.text; cap.classList.remove('is-on'); void cap.offsetWidth;
      const W = innerWidth, H = innerHeight, cw = cap.offsetWidth, ch = cap.offsetHeight, r = vis ? vis.getBoundingClientRect() : null;
      let x, y, px, py;
      if (!r) { x = (W - cw) / 2; y = H - ch - 18; }
      else if (PHONE()) {
        /* on a phone the note sits right above what it is about (under it when there is no room), never over it */
        x = (W - cw) / 2; y = r.top - ch - 10; if (y < 118) y = Math.min(r.bottom + 10, H - ch - 12);
      }
      else if (r.width > W * 0.3) {
        /* a card on the canvas: the note hangs off its lower left corner, outside the card */
        x = clamp(r.left, 12, W - cw - 12); y = r.bottom + 18; if (y + ch > H - 12) y = Math.max(12, r.top - ch - 18);
        px = x + 22; py = y < r.top ? r.top + 4 : r.bottom - 8;
      }
      else {
        /* beside the thing it is naming, level with it: right, else left, else under */
        py = clamp(r.top + Math.min(r.height / 2, 44), 70, H - 60);
        if (r.right + cw + 44 < W) { x = r.right + 26; px = r.right - 6; y = clamp(py - ch / 2, 12, H - ch - 12); }
        else if (r.left - cw - 44 > 0) { x = r.left - cw - 26; px = r.left + 6; y = clamp(py - ch / 2, 12, H - ch - 12); }
        else { x = clamp(r.left + r.width / 2 - cw / 2, 12, W - cw - 12); px = r.left + r.width / 2; py = Math.min(r.bottom - 6, H - ch - 60); y = py + 30; }
      }
      cap.style.left = Math.round(x) + 'px'; cap.style.top = Math.round(y) + 'px'; cap.classList.add('is-on');
      if (cur && r) { cur.style.transform = 'translate(' + Math.round(px - 2) + 'px,' + Math.round(py - 2) + 'px)'; cur.classList.add('is-on'); } else if (cur) cur.classList.remove('is-on');
      const ms = clamp(1500 + String(it.text).split(/\s+/).length * 240, 3000, 5600);
      bar.getAnimations().forEach((a) => a.cancel()); bar.animate([{ scale: '0 1' }, { scale: '1 1' }], { duration: ms, easing: 'linear', fill: 'forwards' });
      SFX.pop(); g.t = setTimeout(step, ms);
    };
    cap.addEventListener('click', (e) => { e.stopPropagation(); clearTimeout(g.t); step(); });
    g.t = setTimeout(step, 350);
  });
}
const guideFor = (b, on) => arr(b && b.guide).filter((x) => (x.on || 'pre') === on);

function show(k, how) {
  k = clamp(k, 0, B.length - 1);
  const b = B[k], from = i, seq = (k === from + 1 && how !== 'seek') || how === 'replay';
  i = k; ui.seek = !seq && how !== 'first';
  clearTimeout(timer); clearTimeout(ui.sceneT); clearTimeout(ui.stT); clearInterval(ui.recI); stopClip(); ui.sceneAct = null;
  closeView(true); guideOff();
  const ch = b.ch;
  ui.root.dataset.ch = CH[ch].id; ui.root.dataset.type = b.type; ui.root.dataset.scene = b.scene || '';
  chapters(ch);
  if (b.type !== 'panel' || !seq) setLine(b);   /* a panel beat played in order changes the line with its first artefact (onCue) */
  const dur = durOf(b);
  if (b.type === 'panel') {
    /* the element (if this beat is entered from its scene) is taken before the hard cut */
    const src = seq && B[from] && B[from].type === 'scene' && b.enter && !PHONE() ? grab() : null;
    boxOn = false; cancelAnimationFrame(raf);
    ui.root.classList.remove('is-3d');
    ui.scene.innerHTML = ''; ui.scene.className = 'v-scene';
    ui.panelHost.classList.add('is-on');
    ui.root.classList.toggle('bd-build', !!src && !REDUCED);
    ui.root.dataset.focus = b.tasks ? 'tasks' : '';   /* on a phone, a beat that hands out tasks shows the task cards where the canvas is */
    ui.workDone = seq ? 0 : 99; ui.workOn = !seq; ui.tasksOn = !seq || !b.tasks; clearTimeout(ui.bdT); board(k, !seq); if (seq) ui.bdT = setTimeout(() => { if (i === k && ui.tasksOn) board(k, true); }, dur);
    panel.fit();
    if (!seq || from < 0 || B[from].type !== 'panel') {
      /* rebuild the thread from history when we jumped in, or arrive from a scene (the thread keeps everything) */
      const H = panel.history(B.slice(0, k).filter((x) => x.type === 'panel'));
      if (!seq) { panel.label(b.label); if (H.art && !b.art && !b.enter) panel.show(H.art); }
    }
    const po = { onCue: () => { if (B[i] === b) setLine(b); } }; if (src) po.landing = (card) => travel(src, card).then(buildAround);
    const go0 = () => { if (i !== k) return; Promise.resolve(panel.play(b, po)).then(() => { if (i === k && !ui.tasksOn) { ui.tasksOn = true; board(k, false); SFX.land(); return new Promise((r) => setTimeout(r, 1500)); } }).then(() => (seq && i === k && playing ? guide(guideFor(b, 'end'), k) : null)).then(() => { if (i === k && AUTO && started && playing) { clearTimeout(timer); timer = setTimeout(autoNext, 1600); } }); };
    /* the guide names what is new before the conversation starts, so nobody reads two things at once */
    const go = () => { if (i !== k) return; const pre = seq && !src ? guideFor(b, 'pre') : []; if (pre.length) guide(pre, k).then(go0); else go0(); };
    if (seq && !src && ui.bd && ui.bd.stageChanged && !REDUCED) { clearTimeout(ui.stT); ui.stT = setTimeout(go, 900); } else go();
  } else {
    panel.stop(); ui.panelHost.classList.remove('is-on');
    const is3d = IS3D(b);
    boxOn = is3d; if (!is3d) cancelAnimationFrame(raf);
    ui.root.classList.toggle('is-3d', is3d);
    ui.scene.innerHTML = ''; ui.elNode = null;
    b.dur = dur;
    const built = SCENE[b.scene] ? SCENE[b.scene](b) : null;
    ui.scene.className = 'v-scene' + (built ? ' is-on' : '');
    if (built) ui.scene.appendChild(built);
    if (b.scene === 'end') endCard(b);
    if (seq && b.guide && started) setTimeout(() => { if (i === k && playing) guide(guideFor(b, 'pre'), k); }, 900);
  }
  ui.next.disabled = k === B.length - 1;
  window.__beatT0 = performance.now();
  ui.back.disabled = k === 0;
  if (AUTO && started && playing && k < B.length - 1) { if (b.type !== 'panel' && b.scene !== 'phone') timer = setTimeout(autoNext, dur); runProgress(dur); } else runProgress(0);
}
function durOf(b) {
  if (b.type === 'panel') return panel.estimate(b) + (b.enter ? 2200 : 0);
  return b.hold || 7000;
}
/* the progress line: the whole story's clock, beat by beat */
let CUM = [], TOTAL = 1;
function timeline() { CUM = []; let t = 0; B.forEach((b) => { CUM.push(t); t += durOf(b); }); TOTAL = t || 1; }
function runProgress(ms) {
  const a = CUM[i] / TOTAL, z = (CUM[i] + durOf(B[i])) / TOTAL, bar = ui.prog;
  bar.getAnimations().forEach((x) => x.cancel());
  if (!ms || !playing) { bar.style.transform = 'scaleX(' + (AUTO ? a : z).toFixed(4) + ')'; return; }   /* stepped: the line shows how far in you are */
  bar.style.transform = 'scaleX(' + z.toFixed(4) + ')';
  bar.animate([{ transform: 'scaleX(' + a.toFixed(4) + ')' }, { transform: 'scaleX(' + z.toFixed(4) + ')' }], { duration: ms, easing: 'linear' });
}
function setLine(b) {
  const L = ui.line; L.innerHTML = '';
  L.appendChild(document.createTextNode(str(b.line)));
  if (b.line2) { L.appendChild(document.createTextNode(' ')); L.appendChild(h('span', null, b.line2)); }
  ui.when.textContent = str(b.when);
  if (ui.hint) ui.hint.textContent = AUTO || b.scene === 'end' ? '' : (PHONE() ? 'Swipe up' : 'Scroll') + ' to continue';
}
function chapters(ch) {
  ui.chs.forEach((e, j) => { e.classList.toggle('is-on', j === ch && !CH[j].quiet); e.classList.toggle('is-done', j < ch); e.setAttribute('aria-current', j === ch ? 'step' : 'false'); });
  ui.chNow.textContent = str(CH[ch].name);
}
function endCard(b) {
  const a = h('div', 'v-end is-modal'), m = h('div', 'v-modal');
  m.appendChild(h('b', 'v-mw', str(V.wordmark, 'Coco')));
  m.appendChild(h('p', 'v-mt', str(b.tag, 'The chief of staff OS for consumer brands')));
  const go = h('button', 'v-go', str(b.cta, 'View project scope')); go.type = 'button';
  go.addEventListener('click', (e) => { e.stopPropagation(); unlock(); offer(); });
  const again = h('button', 'v-again', 'Watch again'); again.type = 'button';
  again.addEventListener('click', (e) => { e.stopPropagation(); playing = true; setPlayBtn(); show(0, 'seek'); started = false; begin(); });
  m.appendChild(go); m.appendChild(again); a.appendChild(m); ui.scene.appendChild(a); ui.scene.classList.add('is-on');
  if (!REDUCED) m.animate([{ translate: '0 30px', scale: '.94' }, { translate: '0 0', scale: '1' }], { duration: 620, easing: 'cubic-bezier(.22,.8,.24,1)' });
  SFX.chime(); setTimeout(() => panel && panel.sheen(m), 420);
}


/* ---------- the board (the v5 screen): around the thread and the canvas sit the team bar, the stage strip, the channel
   tiles, and the Now card with tasks and agents. Everything is derived from the beats up to the current one. ---------- */
const isAg = (w) => /agent$|^chief of staff$/i.test(str(w));
const nameOf = (w) => (/^chief of staff$/i.test(str(w)) ? str(V && V.wordmark, 'Coco') : str(w));
const dayOf = (b) => { const m = /Day (\d+)/.exec(str(b && b.when)); return m ? +m[1] : null; };
const clip2 = (t, n) => { t = str(t); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };
let STG = [], CHN = [], PEOPLE = [];
function boardData() {
  STG = []; CHN = []; PEOPLE = [];
  const seen = {};
  B.forEach((b, k) => {
    if (b.type !== 'panel') return;
    if (b.stage && !STG.some((x) => x.name === b.stage)) STG.push({ name: b.stage, first: k, day: dayOf(b) });
    if (b.chan && !CHN.some((x) => x.name === b.chan)) CHN.push({ name: b.chan, first: k });
    arr(b.thread).forEach((it) => { if (it.who && !isAg(it.who) && cfg.faces && cfg.faces[it.who] && !seen[it.who]) { seen[it.who] = 1; PEOPLE.push(it.who); } });
  });
  Object.keys(cfg.faces || {}).forEach((w) => { if (!seen[w] && typeof cfg.faces[w] === 'string') { seen[w] = 1; PEOPLE.push(w); } });
}
function buildBoard() {
  const root = ui.panelHost.querySelector('.p'); if (!root) return;
  const bd = ui.bd = {};
  bd.team = h('div', 'bd-team'); ui.top.insertBefore(bd.team, ui.top.children[1] || null);
  bd.strip = h('nav', 'bd-strip'); bd.strip.setAttribute('aria-label', 'Stages'); ui.panelHost.insertBefore(bd.strip, root);
  bd.stg = STG.map((s, n) => {
    const e = h('button', 'bd-st'); e.type = 'button'; e.appendChild(h('i', null, String(n + 1)));
    const t = h('span'); t.appendChild(h('b', null, s.name)); if (s.day != null) t.appendChild(h('small', null, 'Day ' + s.day)); e.appendChild(t);
    e.addEventListener('click', (ev) => { ev.stopPropagation(); unlock(); show(s.first, 'seek'); });
    bd.strip.appendChild(e); return e;
  });
  bd.tiles = h('aside', 'bd-tiles'); root.insertBefore(bd.tiles, root.firstChild);
  bd.mid = h('section', 'bd-mid'); root.insertBefore(bd.mid, root.querySelector('.p-cv'));
}
function lightStage(si) {
  const e = ui.bd && ui.bd.stg[si]; if (!e || REDUCED) return;
  e.animate([{ backgroundSize: '0% 100%', color: '#0B0B0C' }, { backgroundSize: '100% 100%', color: '#0B0B0C', offset: 0.55 }, { backgroundSize: '100% 100%', color: '#FFFFFF' }], { duration: 760, easing: 'cubic-bezier(.22,.8,.24,1)', fill: 'backwards' });
  e.animate([{ scale: '1' }, { scale: '1.06', offset: 0.6 }, { scale: '1' }], { duration: 760, easing: 'cubic-bezier(.22,.8,.24,1)' });
  setTimeout(() => { SFX.stamp(); if (panel) panel.sheen(e); }, 380);
}
/* an element that arrives from a scene stays where it lands, and the board assembles around it: canvas, tasks, chat, channels, stages */
function buildAround() {
  return new Promise((res) => {
    const r = ui.root; if (!r.classList.contains('bd-build')) return res();
    r.classList.remove('bd-build');
    if (REDUCED) return res();
    const parts = [ui.bd.mid, ui.panelHost.querySelector('.p-thr'), ui.bd.tiles, ui.bd.strip, ui.bd.team, ui.panelHost.querySelector('.p-lab')].filter(Boolean);
    parts.forEach((el, n) => { el.animate([{ opacity: 0, translate: '0 22px' }, { opacity: 0, translate: '0 22px', offset: 0.01 }, { opacity: 1, translate: '0 0' }], { duration: 480, delay: n * 150, easing: 'cubic-bezier(.22,.8,.24,1)', fill: 'backwards' }); setTimeout(() => SFX.tick(), n * 150); });
    setTimeout(() => { const si = STG.findIndex((x) => x.name === (B[i] || {}).stage); lightStage(si); setTimeout(res, 900); }, parts.length * 150 + 300);
  });
}
/* what moved since the last render gets a small move of its own, in order, so the eye lands on the change */
const BEZ = 'cubic-bezier(.22,.8,.24,1)', BACK = 'cubic-bezier(.3,1.5,.5,1)';
function board(k, settled) {
  const bd = ui.bd; if (!bd) return;
  const was = bd.was || { on: {}, clones: false, tasks: {}, done: {}, agents: {}, stage: -1 }, cur = { on: {}, clones: false, tasks: {}, done: {}, agents: {}, stage: -1 };
  const live = !ui.seek && !REDUCED; let lag = 0;
  const move = (el, frames, o) => { if (live) el.animate(frames, Object.assign({ duration: 420, easing: BEZ, fill: 'backwards' }, o)); };
  const b = B[k], past = B.slice(0, k + 1).filter((x) => x.type === 'panel');
  const day = dayOf(b) || 0;
  /* who is here: at night only the one who spoke; from the morning everyone, and their agents once they have them */
  const spoke = {}; let clones = false; const agents = [];
  past.forEach((x) => {
    if (x.id === 'agents' || x.clones) clones = true;
    const here = x === b;
    const note = (w, text) => { if (!w) return; if (!isAg(w)) { spoke[w] = 1; return; } let a = agents.find((y) => y.who === w); if (!a) { a = { who: w }; agents.push(a); } if (text) a.last = text; a.live = here; };
    arr(x.thread).forEach((it) => { note(it.who, it.text); if (it.art && it.art.kind === 'list') arr(it.art.rows).forEach((r) => note(r.who, r.text)); });
    if (x.work) arr(x.work.agents).forEach((r) => note(r.who, r.text));
    arr(x.agents).forEach((r) => note(r.who, r.text));
  });
  bd.team.innerHTML = '';
  const fs = h('span', 'bd-faces');
  cur.clones = clones;
  PEOPLE.forEach((w) => {
    const on = day >= 1 || spoke[w]; const f = panel.face(w, on ? '' : 'is-off'); fs.appendChild(f);
    if (on) { cur.on[w] = 1; if (!was.on[w]) { move(f, [{ scale: '.4', opacity: .28 }, { scale: '1', opacity: 1 }], { delay: lag, easing: BACK }); lag += 140; } }
    if (clones) { const c = panel.face(w + "'s agent"); fs.appendChild(c); if (!was.clones) { move(c, [{ scale: '0' }, { scale: '1' }], { delay: lag, easing: BACK }); lag += 140; } }
  });
  bd.team.appendChild(fs);
  const online = PEOPLE.filter((w) => day >= 1 || spoke[w]).length, nAg = agents.length + (clones ? PEOPLE.length : 0);
  bd.team.appendChild(h('span', 'bd-count', online + (online === 1 ? ' person' : ' people') + ' online · ' + nAg + (nAg === 1 ? ' agent' : ' agents')));
  /* stages */
  const si = STG.findIndex((s) => s.name === b.stage);
  cur.stage = si;
  if (si !== was.stage && bd.stg[si] && live && !ui.root.classList.contains('bd-build')) lightStage(si);
  bd.stageChanged = si !== was.stage;
  bd.stg.forEach((e, n) => { e.classList.toggle('is-on', n === si); e.classList.toggle('is-done', n < si); if (n === si && e.scrollIntoView && bd.strip.scrollWidth > bd.strip.clientWidth) bd.strip.scrollTo({ left: e.offsetLeft - 24 }); });
  /* the sidebar, as in the app: projects, products, modules */
  bd.tiles.innerHTML = '';
  const sec = (name) => { const s0 = h('div', 'sd-sec'); s0.appendChild(h('span', 'sd-h', name)); bd.tiles.appendChild(s0); return s0; };
  const proj = (() => { let a0 = null; B.forEach((x) => arr(x.thread).forEach((it) => { if (!a0 && it.art && /new project/i.test(str(it.art.lab))) a0 = { art: it.art, at: B.indexOf(x) }; })); return a0; })();
  const hasProj = proj && (k > proj.at || (k === proj.at && settled));
  const liveAt = STG.findIndex((x) => /launch/i.test(x.name)), isLive = liveAt >= 0 && si >= liveAt;
  const P1 = sec('Projects');
  if (hasProj) { const r = h('div', 'sd-row is-on'); r.appendChild(h('b', null, str(proj.art.n) + ' ' + str(proj.art.title))); r.appendChild(h('span', null, str(b.stage) + (dayOf(b) != null ? ' · Day ' + dayOf(b) : ''))); P1.appendChild(r); if (!was.proj) { move(r, [{ translate: '-12px 0' }, { translate: '0 0' }], {}); if (live) SFX.pop(); } }
  else P1.appendChild(h('p', 'sd-none', 'None yet'));
  cur.proj = hasProj ? 1 : 0;
  const P2 = sec('Products');
  if (hasProj) { const r = h('div', 'sd-row' + (isLive ? ' is-live' : '')); const pi2 = IMG('product'); if (pi2 && day >= 10) r.appendChild(img(pi2, 'sd-pi')); const t2 = h('div'); t2.appendChild(h('b', null, str(proj.art.title))); const st2 = h('span', null, isLive ? 'Live' : 'In development'); t2.appendChild(st2); r.appendChild(t2); P2.appendChild(r); if (isLive && !was.live) { move(st2, [{ scale: '.6' }, { scale: '1' }], { easing: BACK }); if (live) SFX.done(); } }
  else P2.appendChild(h('p', 'sd-none', 'None yet'));
  cur.live = isLive ? 1 : 0;
  const P3 = sec('Modules');
  const MOD = { '#ideas': 'Ideas', '#team': 'Team', '#npd': 'New product', '#marketing': 'Marketing', '#orders': 'Orders' };
  CHN.forEach((cn) => {
    const used = past.some((x) => x.chan === cn.name && x !== b), open = b.chan === cn.name;
    const r = h('div', 'sd-mod' + (open ? ' is-on' : used ? ' is-done' : '')); r.appendChild(h('i')); r.appendChild(h('span', null, MOD[cn.name] || cn.name.replace(/^#/, '')));
    P3.appendChild(r);
  });
  { const r = h('div', 'sd-mod' + (b.dash ? ' is-on' : '')); r.appendChild(h('i')); r.appendChild(h('span', null, 'Dashboard')); P3.appendChild(r); }
  /* now */
  bd.mid.innerHTML = '';
  const now = h('div', 'bd-now');
  const nh = h('div', 'bd-nh'); nh.appendChild(h('span', null, 'Now · ' + str(b.when))); nh.appendChild(h('span', null, 'Stage ' + (si + 1) + ' of ' + STG.length)); now.appendChild(nh);
  const nb = h('div', 'bd-nb'); const pi = IMG('product'); if (pi && day >= 21) nb.appendChild(img(pi, 'bd-np')); else if (IMG('sketch_ink') || IMG('sketch')) nb.appendChild(img(str(IMG('sketch_ink'), IMG('sketch')), 'bd-np is-sk'));
  const nt = h('div'); nt.appendChild(h('b', null, str(b.stage))); nt.appendChild(h('p', null, str(b.chan))); nb.appendChild(nt); now.appendChild(nb);   /* the stage once, and where it is happening */
  bd.mid.appendChild(now);
  /* one pane: the tasks, and inside the task being worked on, the agents working on it. Nothing here repeats on the canvas. */
  const stageDay = si >= 0 ? STG[si].day : null, stageBeats = past.filter((x) => x.stage === b.stage);
  const T = [];
  past.forEach((x) => {
    if (x.work && (x !== b || ui.workOn)) T.push({ key: 'w:' + x.work.title, title: x.work.title, who: x.work.who, due: '', work: x.work, here: x === b });
    if (x === b && !ui.tasksOn) return;   /* this beat's tasks land once they have been announced */
    arr(x.tasks).forEach((r) => T.push({ key: r.text, title: r.text, who: r.who, due: r.due, dueDay: +(/Day (\d+)/.exec(str(r.due)) || [0, -1])[1] }));
  });
  const under = b.under || (stageBeats.find((x) => x.under) || {}).under;
  const tk = h('div', 'bd-tasks'); tk.appendChild(h('span', 'bd-h', 'Tasks'));
  if (!T.length) tk.appendChild(h('p', 'bd-empty', 'No tasks yet'));
  let tlag = 250;
  T.forEach((t) => {
    let done, active, nest = [];
    if (t.work) {
      const ags = arr(t.work.agents), wd = t.here ? Math.min(ui.workDone || 0, ags.length) : ags.length;
      done = wd >= ags.length; active = t.here && !done;
      nest = ags.map((a, n) => ({ who: a.who, text: n < wd ? str(a.done, 'Done') : a.text, tag: n < wd ? 'done' : 'working', work: n >= wd }));
    } else {
      active = (under ? under === t.title : t.dueDay === stageDay);
      done = t.dueDay >= 0 && (day > t.dueDay || (day === t.dueDay && !!settled && !B.slice(k + 1).some((x) => x.type === 'panel' && x.stage === b.stage)));
      if (active && !done) {
        const seen = {};
        /* the agents on this task: each works, then reports its result (the beat's Coco line waits for them) */
        stageBeats.forEach((x) => { if (x === b && !ui.workOn) return; arr(x.agents).forEach((a, j) => { const fin = x !== b || j < (ui.workDone || 0); nest.push({ who: a.who, key: a.who + '|' + a.text, text: fin ? str(a.done, 'Done') : a.text, tag: fin ? 'done' : 'working', work: !fin }); }); });
        if (!nest.length) stageBeats.forEach((x) => arr(x.thread).forEach((it) => { if (isAg(it.who) && !/^chief of staff$/i.test(it.who)) { const lv = x === b && !settled; if (!seen[it.who]) { seen[it.who] = { who: it.who }; nest.push(seen[it.who]); } seen[it.who].text = it.text; seen[it.who].tag = lv ? 'working' : 'done'; seen[it.who].work = lv; } }));
      }
      active = active && !done;
    }
    const state = done ? 'Done' : active ? 'In progress' : 'Queued';
    const card = h('div', 'bd-tc' + (done ? ' is-done' : active ? ' is-active' : ''));
    const hd = h('div', 'bd-tch'); hd.appendChild(h('b', null, t.title)); const chip = h('span', 'bd-chip', state); hd.appendChild(chip); card.appendChild(hd);
    const pair = clones && !t.work && !isAg(t.who);
    const o = h('div', 'bd-tco'); o.appendChild(panel.face(t.who)); if (pair) o.appendChild(panel.face(t.who + "'s agent")); o.appendChild(h('span', null, nameOf(t.who) + (pair ? ' and agent' : '') + (t.due ? ' \u00b7 ' + t.due : ''))); card.appendChild(o);
    if (active || (t.work && t.here)) {
      const total = Math.max(1, nest.length), fin = nest.filter((a) => !a.work).length;
      const pg = h('div', 'bd-pg'); const fill = h('i'); fill.style.transform = 'scaleX(' + (nest.length ? Math.max(0.08, fin / total) : 0.3) + ')'; pg.appendChild(fill); card.appendChild(pg);
      if (nest.length) {
        const N = h('div', 'bd-nest');
        nest.slice(-3).forEach((a, n) => {
          const ar = h('div', 'bd-na' + (a.work ? ' is-work' : '')); ar.appendChild(panel.face(a.who));
          const at = h('div'); at.appendChild(h('b', null, a.who)); at.appendChild(h('p', null, clip2(a.text, 46))); ar.appendChild(at);
          const tag = h('span', 'bd-tag' + (a.work ? ' is-work' : ''), a.work ? 'working' : 'done'); ar.appendChild(tag);
          const ak = t.key + '>' + (a.key || a.who); cur.agents[ak] = a.work ? 2 : 1;
          if (!was.agents[ak]) { move(ar, [{ translate: '-14px 0' }, { translate: '0 0' }], { delay: tlag + 250 + n * 220 }); if (live) setTimeout(() => SFX.tick(), tlag + 250 + n * 220); }
          else if (was.agents[ak] === 2 && !a.work) { move(tag, [{ scale: '.5' }, { scale: '1' }], { easing: BACK }); move(at, [{ translate: '0 6px' }, { translate: '0 0' }], {}); if (live) SFX.done(); }
          N.appendChild(ar);
        });
        card.appendChild(N);
      }
    } else if (t.work && done) card.appendChild(h('span', 'bd-sum', arr(t.work.agents).length + ' agents · done overnight'));
    cur.tasks[t.key] = active ? 2 : 1; if (done) cur.done[t.key] = 1;
    if (!was.tasks[t.key]) { move(card, [{ translate: '0 18px', scale: '.97' }, { translate: '0 0', scale: '1' }], { delay: tlag }); if (live) setTimeout(() => SFX.pop(), tlag); tlag += 170; }
    else if (done && !was.done[t.key]) { move(chip, [{ scale: '.5' }, { scale: '1' }], { delay: 150, easing: BACK }); if (live) setTimeout(() => SFX.done(), 150); }
    else if (active && was.tasks[t.key] === 1) { move(card, [{ scale: '1' }, { scale: '1.03', offset: 0.5 }, { scale: '1' }], { duration: 520 }); move(chip, [{ scale: '.5' }, { scale: '1' }], { easing: BACK }); if (live) { SFX.tick(); panel.sheen(card); } }
    tk.appendChild(card);
  });
  bd.mid.appendChild(tk);
  bd.was = cur;
}

/* autoplay never takes a decision or sends the note for the viewer: it holds until they do */
function autoNext() { if (!playing || viewOpen) return; if ((panel && panel.asking) || ui.sceneAct) { timer = setTimeout(autoNext, 600); return; } if (i < B.length - 1) show(i + 1); }
function begin() { if (started) return false; started = true; playing = true; setPlayBtn(); ui.root.classList.add('is-started'); if (ui.startB) { ui.startB.remove(); ui.startB = null; } unlock(); B.forEach((x) => arr(x.thread).forEach((it) => { const u = it.voice && (cfg.audio || {})[it.voice]; if (u && !MUTED) clip(u); })); if (i === 0) show(1); else show(i, 'seek'); return true; }
function next() {
  if (begin()) return;
  /* a waiting interaction comes first: Next and scroll take the decision or send the note, then the story moves */
  if (panel && panel.asking) { panel.answer(); return; }
  if (ui.sceneAct) { const f = ui.sceneAct; ui.sceneAct = null; f(); return; }
  if (i < B.length - 1) show(i + 1);
}
function prev() { if (i > 0) show(i - 1, 'seek'); }
function setPlay(on) {
  if (on && !started) { begin(); return; }
  playing = on; setPlayBtn();
  if (on) {
    /* resume replays the beat that was interrupted, from its start, with everything before it in place */
    if (viewOpen) closeView(true);
    if (B[i] && B[i].type === 'panel') panel.history(B.slice(0, i).filter((x) => x.type === 'panel'));
    show(i, 'replay');
  } else {
    /* pause stops everything: the timers, the chat, the voice, the scene */
    guideOff(); clearTimeout(timer); clearTimeout(ui.sceneT); clearTimeout(ui.stT); clearTimeout(ui.bdT); clearInterval(ui.recI); cancelAnimationFrame(raf); stopClip(); if (panel) panel.stop(); runProgress(0);
  }
}
/* resume after a pause on a panel beat restarts the beat from its history (nothing replays twice) */
function setPlayBtn() { ui.play.classList.toggle('is-paused', !playing); ui.play.setAttribute('aria-label', playing ? 'Pause' : 'Play'); }
function setSound() { if (!ui.sound) return; ui.sound.classList.toggle('is-off', !SOUND); ui.sound.setAttribute('aria-label', SOUND ? 'Mute' : 'Sound on'); }

/* ---------- open anything: an artefact or a task, big, over the panel; autoplay pauses while it's open ---------- */
function openView(o) {
  if (!o) return;
  wasPlaying = viewOpen ? wasPlaying : playing;
  playing = false; clearTimeout(timer); setPlayBtn(); runProgress(0);
  panel.stop();
  viewOpen = true; ui.view.innerHTML = ''; ui.view.classList.add('is-on');
  const x = h('button', 'v-x', 'Close'); x.type = 'button'; x.addEventListener('click', (e) => { e.stopPropagation(); closeView(); });
  const body = h('div', 'v-vb');
  if (o.task) {
    const t = o.task, c = h('div', 'v-task');
    const top = h('div', 'v-task-o'); top.appendChild(panel.face(t.who)); const nm = h('div'); nm.appendChild(h('b', null, str(t.who))); nm.appendChild(h('span', null, str(t.role, /agent$/i.test(str(t.who)) ? 'Agent' : 'Owner'))); top.appendChild(nm); c.appendChild(top);
    c.appendChild(h('h4', null, str(t.text)));
    const dl = h('dl'); [['Status', o.st === 'done' ? (/^done$/i.test(str(t.done)) ? 'Done' : 'Done, ' + str(t.done)) : o.st === 'work' ? 'Working on it' : 'Assigned'], ['Due', t.due], ['From', o.art && o.art.title]].forEach((r) => { if (r[1]) { dl.appendChild(h('dt', null, r[0])); dl.appendChild(h('dd', null, r[1])); } }); c.appendChild(dl);
    if (t.note) c.appendChild(h('p', null, t.note));
    body.appendChild(c);
  } else {
    const w = h('div', 'p-fit'); w.appendChild(panel.art(o.art, { done: true })); body.appendChild(w);
  }
  ui.view.appendChild(body); ui.view.appendChild(x);
  const W = ui.view.clientWidth, H = ui.view.clientHeight;
  if (!PHONE()) ui.view.style.setProperty('--sk', Math.max(0.5, Math.min(1.25, (W - 120) / 860, (H - 140) / 500)).toFixed(4));
  if (!REDUCED) body.animate([{ translate: '0 16px' }, { translate: '0 0' }], { duration: 460, easing: EZ });
  x.focus({ preventScroll: true });
}
function closeView(silent) {
  if (!viewOpen) return; viewOpen = false; ui.view.classList.remove('is-on'); ui.view.innerHTML = '';
  if (!silent && wasPlaying) { playing = true; setPlayBtn(); show(i, 'seek'); }
}

/* ---------- the offer (sb-offer.js), or the CTA link ---------- */
function offer() {
  playing = false; clearTimeout(timer); setPlayBtn(); runProgress(0);
  ui.root.classList.add('is-offer');
  const close = () => { ui.root.classList.remove('is-offer'); ui.offer.innerHTML = ''; };
  const href = str(V.cta_href, (cfg.storyboard || {}).cta_href);
  if (cfg.offer && window.cocoOffer) window.cocoOffer(cfg, ui.offer, { onClose: close });
  else if (href) location.href = href;
  else ui.root.classList.remove('is-offer');
}

/* ---------- build ---------- */
const ICONS = {
  play: '<svg class="i-pause" viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="3" width="2.6" height="10" rx=".8"/><rect x="9.4" y="3" width="2.6" height="10" rx=".8"/></svg><svg class="i-play" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.4-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5z"/></svg>',
  next: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.4 3.3v9.4a.6.6 0 0 0 .9.5l6.8-4.7a.6.6 0 0 0 0-1L4.3 2.8a.6.6 0 0 0-.9.5z"/><rect x="11.4" y="3" width="1.9" height="10" rx=".8"/></svg>',
  sound: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6v4h2.6L8.5 13V3L4.6 6z"/><path class="i-wave" d="M10.6 5.6a3.4 3.4 0 0 1 0 4.8M12.4 3.8a6 6 0 0 1 0 8.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path class="i-x" d="M10.5 6l4 4M14.5 6l-4 4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'
};
function btn(cls, label, svg) { const b = h('button', 'v-b ' + cls); b.type = 'button'; b.setAttribute('aria-label', label); b.innerHTML = svg; return b; }
function build() {
  document.documentElement.classList.add('is-v20');
  const mount = document.getElementById('app') || document.body; mount.innerHTML = '';
  const r = h('section', 'v'); r.setAttribute('aria-label', str(V.title, 'Coco')); ui.root = r;
  /* top bar */
  const top = h('header', 'v-top'); ui.top = top;
  const wm = h('p', 'v-wm'); wm.appendChild(h('b', null, str(V.wordmark, 'Coco'))); wm.appendChild(h('span', null, str(V.lockup, 'chief of staff OS'))); top.appendChild(wm);
  const nav = h('nav', 'v-chs'); nav.setAttribute('aria-label', 'Chapters'); ui.chs = [];
  CH.forEach((c, j) => { const e = h('button', 'v-ch', c.name); e.type = 'button'; if (c.quiet) e.hidden = true; e.addEventListener('click', (ev) => { ev.stopPropagation(); unlock(); show(c.first, 'seek'); }); nav.appendChild(e); ui.chs.push(e); });
  top.appendChild(nav); ui.chNow = h('span', 'v-chnow'); top.appendChild(ui.chNow);
  r.appendChild(top);
  /* the picture */
  const pic = h('div', 'v-pic'); ui.pic = pic;
  ui.d3 = h('div', 'v-3d'); pic.appendChild(ui.d3);
  ui.panelHost = h('div', 'v-panel'); pic.appendChild(ui.panelHost);
  ui.scene = h('div', 'v-scene'); pic.appendChild(ui.scene);
  ui.fly = h('div', 'v-fly'); pic.appendChild(ui.fly);
  ui.view = h('div', 'v-view'); ui.view.setAttribute('role', 'dialog'); ui.view.setAttribute('aria-label', 'Opened'); pic.appendChild(ui.view);
  ui.view.addEventListener('click', (e) => { if (e.target === ui.view) closeView(); });
  r.appendChild(pic);
  /* bottom bar */
  const bot = h('footer', 'v-bot');
  ui.line = h('p', 'v-line'); ui.line.setAttribute('aria-live', 'polite'); bot.appendChild(ui.line);
  const side = h('div', 'v-side'); ui.when = h('span', 'v-when'); side.appendChild(ui.when); ui.hint = h('span', 'v-hint'); side.appendChild(ui.hint);
  const ctl = h('div', 'v-ctl'); ui.play = btn('is-play', 'Pause', ICONS.play); ui.back = btn('is-back', 'Back', ICONS.next); ui.next = btn('is-next', 'Next', ICONS.next); ui.next.insertBefore(h('span', null, 'Next'), ui.next.firstChild); ui.sound = btn('is-sound', 'Sound on', ICONS.sound);
  [ui.play, ui.back, ui.next, ui.sound].forEach((x) => ctl.appendChild(x)); if (MUTED) ui.sound.hidden = true; if (!AUTO) ui.play.hidden = true;
  side.appendChild(ctl); bot.appendChild(side);
  const pg = h('div', 'v-prog'); ui.prog = h('i'); pg.appendChild(ui.prog); bot.appendChild(pg);
  r.appendChild(bot);
  ui.offer = h('div', 'v-offer'); r.appendChild(ui.offer);
  mount.appendChild(r);
  panel = createPanel(cfg, ui.panelHost, { img: IMG, sfx: (k) => { if (SFX[k]) SFX[k](); }, open: openView,
    voice: (k) => { const len = +((cfg.audio_len || {})[k] || 0) * 1000; SFX.voice(); playClip(k); return len; },
    peek: () => { if (AUTO && playing) setPlay(false); },
    note: (g) => { if (ui.seek || !playing) return; guide([g], i); },
    work: () => new Promise((res) => {
      const k = i, b = B[k], n = arr(b && ((b.work && b.work.agents) || b.agents)).length, wa = b && (b.workArt || (b.work && b.work.art));
      ui.workOn = true;
      if (!n || ui.seek || REDUCED) { ui.workDone = n; board(k, false); return res(); }
      ui.workDone = 0; board(k, false);
      guide(guideFor(b, 'work'), k).then(() => {
        if (i !== k || !playing) return res();
        if (wa) panel.showWork(wa, 1300 + n * 1100);
        setTimeout(() => { if (i === k && playing) guide(guideFor(b, 'during'), k); }, 500);
        let c = 0; const tick = () => { if (i !== k) return res(); c++; ui.workDone = c; board(k, false); if (c >= n) setTimeout(res, 800); else setTimeout(tick, 1100); };
        setTimeout(tick, 1700);
      });
    }) });
  top.appendChild(ctl);   /* the controls live in the top bar: nothing sits under the picture */
  boardData(); buildBoard();
  ui.next.addEventListener('click', (e) => { e.stopPropagation(); unlock(); next(); });
  ui.back.addEventListener('click', (e) => { e.stopPropagation(); prev(); });
  ui.play.addEventListener('click', (e) => { e.stopPropagation(); unlock(); setPlay(!playing); });
  ui.sound.addEventListener('click', (e) => { e.stopPropagation(); if (SOUND) { SOUND = false; stopClip(); setSound(); } else unlock(); });
  addEventListener('pointerdown', () => unlock(), { once: true, capture: true });
  ui.pic.addEventListener('click', (e) => { if (!started && !(e.target.closest && e.target.closest('button, a'))) begin(); });
  addEventListener('keydown', (e) => {
    if (ui.root.classList.contains('is-offer')) return;
    if (e.key === 'Escape' && viewOpen) { closeView(); return; }
    if (e.target.closest && e.target.closest('button, a, input')) return;
    const k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !AUTO)) { e.preventDefault(); unlock(); next(); }
    else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') { e.preventDefault(); prev(); }
    else if (k === ' ') { e.preventDefault(); unlock(); setPlay(!playing); }
  });
  /* scroll and swipe step the story one beat at a time (a short lock so one flick is one beat) */
  let stepLock = 0;
  const step = (d) => { const t = performance.now(); if (t < stepLock || viewOpen || ui.root.classList.contains('is-offer')) return; stepLock = t + 850; unlock(); if (d > 0) next(); else prev(); };
  /* an inner scroller keeps the gesture only while it can still move that way; at its end the story steps */
  const own = (el, d) => { for (let n = el; n && n !== ui.root; n = n.parentElement) { if (n.scrollHeight > n.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(n).overflowY)) { if (d == null) return true; if (d > 0 ? n.scrollTop + n.clientHeight < n.scrollHeight - 2 : n.scrollTop > 0) return true; } } return false; };
  /* one flick is one step: after a step the wheel is ignored until the gesture (and its inertia) has gone quiet */
  let wheelBusy = false, wheelT = 0;
  addEventListener('wheel', (e) => { if (e.target.closest && own(e.target, e.deltaY)) return; e.preventDefault(); clearTimeout(wheelT); wheelT = setTimeout(() => { wheelBusy = false; }, 160); if (wheelBusy || Math.abs(e.deltaY) < 8) return; wheelBusy = true; step(e.deltaY); }, { passive: false });
  let ty = null, tx = null;
  addEventListener('touchstart', (e) => { const t = e.touches[0]; ty = t.clientY; tx = t.clientX; }, { passive: true });
  addEventListener('touchend', (e) => { if (ty == null) return; const t = e.changedTouches[0], dy = ty - t.clientY, dx = tx - t.clientX; ty = null; if (e.target.closest && own(e.target, dy)) return; if (Math.abs(dy) > 48 && Math.abs(dy) > Math.abs(dx)) step(dy); else if (Math.abs(dx) > 60) step(dx); }, { passive: true });
  let rz = 0; addEventListener('resize', () => { sizeBox(); clearTimeout(rz); rz = setTimeout(() => { panel.fit(); }, 120); });
  if (AUTO) { playing = false; const sbn = h('button', 'v-start'); sbn.type = 'button'; sbn.setAttribute('aria-label', 'Play'); sbn.appendChild(h('span', null, 'Play')); sbn.addEventListener('click', (e) => { e.stopPropagation(); begin(); }); pic.appendChild(sbn); ui.startB = sbn; }
  setSound(); setPlayBtn();
}

/* the config's chapters -> one flat list of beats (each knows its chapter) */
function flatten() {
  B = []; CH = [];
  arr(V.chapters).forEach((c, j) => {
    CH.push({ id: str(c.id, 'c' + j), name: str(c.name), quiet: !!c.quiet, first: B.length });
    let firstPanel = true;
    arr(c.beats).forEach((b) => {
      if (b.skip) return;   /* kept in the config, left out of the story (easy to bring back) */
      const x = Object.assign({}, b, { ch: j });
      /* a config without stages/channels (the private one, until it is rebuilt) still gets a working board */
      if (x.type === 'panel') { if (!x.stage) { const m = /^#\d+\s*\u00b7\s*([^\u00b7]+)/.exec(str(x.label)); x.stage = m ? m[1].trim() : str(c.name, 'Stage'); } if (!x.chan) x.chan = '#' + str(c.id, 'c' + j); }
      if (x.type === 'panel' && firstPanel) { x.div = str(c.div, c.name); firstPanel = false; }
      B.push(x);
    });
  });
}

/* ---------- the loader ----------
   scroll20.html paints the loader (black, the wordmark, a 2px line) before any script runs and has already started the
   parcel's modules. Here every picture the story shows comes from the config (private: the unlocked blob URLs), each is
   decoded, and the parcel is built and warmed. The line follows real bytes, decodes and the 3D steps; when it's full the
   loader is cut away and beat 1 is already running. Nothing waits past 12 s. */
const LD = window.__V20L || null;
const PRIME = !P3 ? null : LD && LD.prime ? LD.prime : import(P3_URL).then((t) => t.prime()).catch(() => 0);
const LOAD_MAX = 12000, HOLD = [];
const now = () => Math.round(performance.now());
const frame = () => new Promise((r) => { requestAnimationFrame(() => r()); setTimeout(r, 120); });   /* a background tab has no frames: never stall on one */
function getFile(url, o) { if (LD && LD.get) return LD.get(url, o); return fetch(url).then((r) => { if (!r.ok) throw 0; return r.blob(); }).then(() => ({ url, ok: true }), () => ({ url, ok: false })); }
function decodeImg(u) { const im = new Image(); im.decoding = 'async'; im.src = u; HOLD.push(im); return (im.decode ? im.decode() : new Promise((res, rej) => { im.onload = res; im.onerror = rej; })).then(() => true, () => false); }
/* a key with several candidate paths settles on the first that loads (the v20 stills replace the stand-ins as they land) */
function resolveKey(k) {
  const L = candidates(k); if (!L.length) return Promise.resolve();
  let p = Promise.resolve(false);
  L.forEach((u) => { p = p.then((ok) => ok || getFile(u, { kind: 'img', low: true }).then((it) => (it && it.ok === false ? false : decodeImg(u))).then((d) => { if (d) GOOD[k] = u; return d; })); });
  return p.then((ok) => { if (!ok) GOOD[k] = ''; return ok; });
}
const FONTS = ['500 46px "Clash Display"', '600 30px "Clash Display"', '400 17px "Clash Display"', '300 40px "Clash Display"', '400 30px "Gasoek One"'];
function loadThen(k0) {
  const T = window.__T = window.__T || {}; T.start = now();
  const el = document.querySelector('.vl'), bar = el && el.querySelector('.vl-bar i');
  const t0 = LD && !LD.priv ? 0 : performance.now();
  const st = { dec: 0, init: 0, warm: 0, fonts: 0 }, miss = [];
  const I = Object.assign({}, (cfg.storyboard || {}).images || {}, V.images || {});
  const keys = Object.keys(I).filter((k) => !/^app_/.test(k));
  const keyed = keys.map((k) => resolveKey(k).then((ok) => { st.dec++; if (!ok && candidates(k).length) miss.push(k); }));
  const pics = Promise.all(keyed).then(() => Promise.all(panel.assets(B.filter((b) => b.type === 'panel')).map((u) => /^(blob:|data:)/.test(u) || keys.some((k) => GOOD[k] === u) ? true : getFile(u, { kind: 'img', low: true }).then((it) => (it && it.ok === false ? (miss.push(u), false) : decodeImg(u))))));
  const fonts = (document.fonts && document.fonts.load ? Promise.all(FONTS.map((f) => document.fonts.load(f).catch(() => null))) : Promise.resolve()).then(() => { st.fonts = 1; });
  const d3 = (async () => {
    if (!P3) { initDoor = (await import(DOOR_URL)).init; boxReady = !!ensureBox(); st.init = st.warm = 1; return; }
    try {
      let m; try { m = await import(P3_URL); } catch (e) { m = await import('../parcel3d.js?v=p3v4'); }   /* p20, else parcel3d */
      T.imported = now();
      const [kept, fin] = await Promise.all([PRIME, m.fonts ? Promise.race([m.fonts(p3cfg()), new Promise((r) => setTimeout(() => r(false), 2500))]) : false]);
      T.kept = kept; p3fonts = !!fin; initP3 = m.init;
      await frame(); if (!ensureBox()) throw new Error('init() failed');
      T.init = now(); st.init = 1; await frame();
      if (box.warm) await box.warm({ open: true });
      if (box.warm) box.warm({ rest: true });
      T.warmed = now(); st.warm = 1; boxReady = true;
    } catch (e) {
      console.warn('[coco] the 3D parcel failed, using the fallback scene:', e && e.message);
      p3Failed = true; initP3 = null; if (box) { try { box.el.remove(); } catch (x) { /* */ } box = null; }
      try { initDoor = (await import(DOOR_URL)).init; boxReady = !!ensureBox(); } catch (x) { /* a hole stands in */ }
      st.init = st.warm = 1;
    }
  })();
  let shown = 0, live = true;
  const tick = () => {
    if (!live) return;
    let sz = 0, got = 0;
    (LD ? LD.items : []).forEach((it) => { const n = it.size || 40000; sz += n; got += it.done ? n : Math.min(it.got || 0, n); });
    const files = sz ? got / sz : 1, dec = keys.length ? st.dec / keys.length : 1;
    const p = 0.6 * files + 0.08 * dec + 0.02 * st.fonts + 0.2 * st.init + 0.1 * st.warm;
    shown = Math.max(shown, shown + (p - shown) * 0.3);
    if (bar) bar.style.transform = 'scaleX(' + shown.toFixed(4) + ')';
    if (el) el.setAttribute('aria-valuenow', String(Math.round(shown * 100)));
    requestAnimationFrame(tick);
  };
  if (bar) tick();
  const ready = Promise.all([pics, fonts, d3]);
  const late = new Promise((r) => setTimeout(() => r('late'), Math.max(0, t0 + LOAD_MAX - performance.now())));
  Promise.race([ready.then(() => 'ready'), late]).then(async (how) => {
    T.ready = now();
    if (how === 'late') console.warn('[coco] started after 12 s without:', (LD ? LD.items : []).filter((it) => !it.done).map((it) => it.url).concat(miss, st.init ? [] : ['3D init']));
    else if (miss.length) console.warn('[coco] started without:', miss);
    live = false; if (bar) { bar.style.transform = 'none'; await frame(); await frame(); }
    timeline();
    show(k0, k0 ? 'seek' : 'first');
    if (el) el.remove();
    document.documentElement.classList.remove('vl-q');
    T.cut = now();
    if (how === 'ready') { try { localStorage.setItem('v20.ld', JSON.stringify({ v: 'v20a', t: Date.now() })); } catch (e) { /* */ } }
    if (!boxReady) d3.then(() => { if (boxReady && IS3D(B[i]) && playing) show(i, 'seek'); });
  });
}

function start(raw) {
  if (cfg) return true;
  const c = raw || {}; if (!c.v20 || !arr(c.v20.chapters).length) return false;
  cfg = c; V = cfg.v20;
  flatten();
  document.title = str(V.title, 'Coco') + ' · ' + str(V.tagline, 'the chief of staff OS for consumer brands, by sameep.ai');
  build();
  const st = /[?&]step=(\d+)/.exec(location.search);
  playing = !Q.has('still') && !AUTO; setPlayBtn();
  loadThen(clamp(st ? +st[1] - 1 : 0, 0, B.length - 1));
  window.__v20 = { show: (k) => show(k, 'seek'), next, prev, get i() { return i; }, get beat() { return B[i]; }, n: B.length, B, get total() { return TOTAL; }, open: openView, close: closeView, setPlay, offer, get box() { return box; } };
  return true;
}
window.cosV20 = start;
/* the public route: the boot script fetched the config already. The private one asks for it after the lock (pin-loader
   holds ./brands/*.json until sign-in, then answers with the unlocked config) */
if (LD && LD.cfgP) LD.cfgP.then((raw) => { if (!start(raw)) console.warn('[coco] this config has no v20 block'); }, (e) => console.warn('[coco] config failed', e));
else fetch('./brands/' + (Q.get('brand') || 'private').replace(/[^a-z0-9_-]/gi, '') + '.json').then((r) => r.json()).then((raw) => { if (!start(raw)) console.warn('[coco] this config has no v20 block'); }, (e) => console.warn('[coco] config failed', e));
