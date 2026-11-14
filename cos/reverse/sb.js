/* sb.js: the storyboard landing (16 beats). Two kinds of beat, with zoom transitions between them:
     scene  full-bleed objects (the parcel at her door, the sketch, the phone, Coco)
     board  the Coco app at true scale (sb-app.js): the thread, tasks, canvas; visuals open big, highlights lift
   No header strip and no footer bar: the line is a subtitle-style caption, the controls a floating pill that fades
   when idle, and a 2px progress line runs along the bottom edge. The Chief of staff dock arrives once the note is
   sent. Everything comes from config.storyboard (names live in the private config). */
import { init as initDoor } from './door3d.js?v=sb2';
import { createApp } from './sb-app.js?v=sb17';

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
/* parcel3d (built in brandcos/parcel3d/, copied here) plays beats 1, 14, 15: the parcel opens at her door, the carton
   unfolds into the sketch, and at the end it closes and goes back out. ?door3d falls back to the old low-poly scene. */
const P3_DEFAULT = true, P3_URL = './parcel3d.js?v=p3v2';
const P3 = (P3_DEFAULT || Q.has('p3')) && !Q.has('door3d');   /* ?door3d falls back to the old scene */
let initP3 = null, p3Failed = false;

let cfg, SB, B = [], i = -1, playing = true, timer = 0, msgT = 0, raf = 0, prevKind = '';
const ui = {};
let box = null, boxOn = false, app = null;

/* ---------- sound: unlocked by the first tap, the voice note plays on the record beat ---------- */
let AC = null, SOUND = false; const CLIPS = {};
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
const SFX = { sent: () => tone(520, 0.14, 0.1, 'sine', 1300), pop: () => tone(660, 0.12, 0.06), stamp: () => { tone(420, 0.1, 0.07); setTimeout(() => tone(840, 0.14, 0.05), 90); }, dock: () => tone(740, 0.16, 0.05, 'triangle') };
let NOW = null;
function playClip(key, onEnd) {
  stopClip(); const u = (cfg.audio || {})[key]; if (!u || MUTED || !SOUND) return false;
  const a = clip(u); try { a.currentTime = 0; } catch (e) { /* */ }
  NOW = a; a.onended = () => { if (NOW === a) { NOW = null; if (onEnd) onEnd(); } };
  const p = a.play(); if (p && p.catch) p.catch(() => { if (NOW === a) NOW = null; if (ui.tapHear) ui.tapHear.hidden = false; });
  return true;
}
function stopClip() { if (NOW) { try { NOW.pause(); } catch (e) { /* */ } NOW = null; } }

/* ---------- the 3D parcel at her door (beats 1 and 15) ---------- */
const IMG = (k) => str((SB.images || {})[k]);
const PAPER = '#F4F3EF';   /* the page's ground; parcel3d cuts to the product on exactly this paper, so the hand-off has no seam */
function ensureBox() {
  if (box) return box;
  try {
    const src = IMG('product');
    if (P3 && !initP3 && !p3Failed) return null;   /* still loading: never fall back to the old scene by accident */
    if (P3 && initP3) {
      box = initP3({ brand: cfg.brand || {}, box: SB.box || {}, palette: cfg.palette || {}, shipping: cfg.shipping || {} }, (k) => (k === 'sketch' ? IMG('sketch') : src), { paper: PAPER });
      ui.d3.appendChild(box.el); sizeBox();
      if (box.on) box.on('hero', (r) => onHero(r));
      if (box.on) box.on('*', (name) => { if (name === 'land' || name === 'settle') tone(180, 0.18, 0.08); else if (/flap|carton/.test(name)) tone(300, 0.08, 0.04); else if (/tape|peel|label/.test(name)) tone(900, 0.05, 0.03, 'triangle'); });
      return box;
    }
    box = initDoor({ brand: { name: str((SB.box || {}).name), product: str((SB.box || {}).product) }, palette: cfg.palette || {}, shipping: cfg.shipping || {}, charmSrc: src }, () => src);
    ui.d3.appendChild(box.el); sizeBox();
  } catch (e) { box = null; }
  return box;
}
function sizeBox() {
  if (!box) return;
  const w = ui.d3.clientWidth || innerWidth, hh = ui.d3.clientHeight || innerHeight;
  if (PHONE()) box.size(w, hh, w * 0.5, hh * 0.5, Math.min(w * 0.78, hh * 0.42));
  else box.size(w, hh, w * 0.5, hh * 0.5, Math.min(w * 0.34, hh * 0.5));
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
const POSE = {
  open: (t) => ({ drop: ease(seg(t, 0, 0.18)), open: seg(t, 0.26, 0.62), rise: seg(t, 0.6, 0.94), cam: seg(t, 0.5, 1) * 0.55 }),
  held: (t) => ({ drop: ease(seg(t, 0, 0.3)), open: 0, rise: 0, cam: 0 }),
  close: (t) => ({ drop: 1, rise: 1 - ease(seg(t, 0, 0.3)), open: 1 - seg(t, 0.3, 0.86), cam: (1 - ease(seg(t, 0.55, 1))) * 0.55 })
};
if (P3) { const o = POSE.open; POSE.open = (t) => Object.assign(o(t), { unfold: seg(t, 0.8, 1) }); POSE.close = (t) => ({ end: t }); }   /* unfold: the product out, then the hero */

/* ---------- the match cut: the 3D product at its hero pose -> the product photo at the same place -> the doodle ----------
   parcel3d emits box.on('hero', rect) when the real product reaches its hero pose on paper: {x, y, w, h} (or left/top/width/height)
   in CSS px of the 3D layer, with an optional angle (deg, or rad when |a| <= 3.2). Without it the cut uses a centred rect. */
let HERO = null;
const PROD_BOX = { l: 201 / 900, w: 498 / 900, t: 0, h: 1 };   /* the product photo's alpha bounds (sb/charm.webp, 900 square) */
const BOT3D = { cx: 0.366, t: 0.185, b: 0.951, w: 0.669 };   /* parcel3d's bottle (cap top to base, body width) inside heroRect, measured at 1440 and 390 */
const SK_MAP = { l: -0.165, t: -0.178, s: 1.272 };              /* the doodle's 800 square over the photo box: bottles line up */
function onHero(r) {
  if (!r) return;
  const x = r.x != null ? r.x : r.left, y = r.y != null ? r.y : r.top, w = r.w != null ? r.w : r.width, hh = r.h != null ? r.h : r.height;
  if (!(w > 4 && hh > 4)) return;
  let a = +(r.deg != null ? r.deg : r.angle || 0); if (r.deg == null && Math.abs(a) <= 3.2) a = a * 180 / Math.PI;
  const o = ui.d3.getBoundingClientRect(), R = ui.root.getBoundingClientRect();
  HERO = { x: x + o.left - R.left, y: y + o.top - R.top, w, h: hh, a };
  /* parcel3d emits hero right after it renders the frame, so the canvas still holds it: copy the product's patch of paper.
     The page then shows these exact pixels, and the swap frame is the 3D frame. */
  try {
    const cv = box && box.el, k = cv && cv.clientWidth ? cv.width / cv.clientWidth : 0;
    if (k > 0) {
      const x0 = Math.max(0, x - w * 0.25), y0 = Math.max(0, y - hh * 0.1), x1 = Math.min(cv.clientWidth, x + w * 1.25), y1 = Math.min(cv.clientHeight, y + hh * 1.16);
      const c = document.createElement('canvas'); c.width = Math.round((x1 - x0) * k); c.height = Math.round((y1 - y0) * k);
      c.getContext('2d').drawImage(cv, x0 * k, y0 * k, c.width, c.height, 0, 0, c.width, c.height);
      c.className = 'sb-mc-ph'; HERO.snap = { el: c, x: x0 + o.left - R.left, y: y0 + o.top - R.top, w: x1 - x0, h: y1 - y0 };
    }
  } catch (e) { /* a tainted or lost canvas: fall back to the product photo */ }
  if (B[i] && B[i].kind === 'box-open' && B[i + 1] && B[i + 1].kind === 'sketch' && playing) { clearTimeout(timer); show(i + 1); }
}
function heroRect() {
  if (HERO) return HERO;
  const W = ui.root.clientWidth, H = ui.root.clientHeight, hh = Math.min(PHONE() ? H * 0.38 : Math.min(H * 0.56, 520), (W - 24) / SK_MAP.s);   /* the doodle's notes stay on screen */
  return { x: W / 2 - hh * PROD_BOX.w / 2, y: H * (PHONE() ? 0.58 : 0.47) - hh / 2, w: hh * PROD_BOX.w, h: hh, a: 0 };
}
/* the doodle draws itself stroke by stroke: the ink layer under a mask of hand-paced passes (in the 800 sketch space) */
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
  const id = 'sbk' + (++skN), NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 800 800'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('class', 'sb-ink'); svg.setAttribute('aria-hidden', 'true');
  const mask = document.createElementNS(NS, 'mask'); mask.id = id; mask.setAttribute('maskUnits', 'userSpaceOnUse'); mask.setAttribute('x', 0); mask.setAttribute('y', 0); mask.setAttribute('width', 800); mask.setAttribute('height', 800);
  const paths = STROKES.map((st) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', st.p); p.setAttribute('pathLength', '1'); p.setAttribute('fill', 'none'); p.setAttribute('stroke', '#fff'); p.setAttribute('stroke-width', st.w); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); p.style.strokeDasharray = '1 1'; p.style.strokeDashoffset = '1'; mask.appendChild(p); return p; });
  const defs = document.createElementNS(NS, 'defs'); defs.appendChild(mask); svg.appendChild(defs);
  const im = document.createElementNS(NS, 'image'); im.setAttribute('href', src); im.setAttribute('width', 800); im.setAttribute('height', 800); im.setAttribute('mask', 'url(#' + id + ')'); svg.appendChild(im);
  svg.draw = (t0) => paths.forEach((p, k) => { const st = STROKES[k]; if (REDUCED) { p.style.strokeDashoffset = '0'; return; } p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: st.d, delay: (t0 || 0) + st.at, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'both' }); });
  return svg;
}
function placeAt(el, x, y, w, hh, a) { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.width = w + 'px'; el.style.height = hh + 'px'; if (a) el.style.transform = 'rotate(' + a + 'deg)'; }
/* hand the doodle on to the next beat (it flies into the phone) */
let skHand = null;

/* ---------- scene builders ---------- */
function img(src, cls, alt) { const e = h('img', cls); e.alt = alt || ''; e.decoding = 'async'; e.src = src; return e; }
function mark() { return h('span', 'sb-mark', 'C'); }
function waveBars(n, cls) { const w = h('span', cls || 'sb-wave'); for (let k = 0; k < n; k++) { const b = h('i'); b.style.height = Math.round(18 + 70 * Math.abs(Math.sin(k * 1.7) * Math.cos(k * 0.45))) + '%'; w.appendChild(b); } return w; }
function ticks() { const s = h('span', 'sb-ticks'); s.innerHTML = '<svg viewBox="0 0 18 10" aria-hidden="true"><path d="M1 5.5l2.6 2.6L9 2.5M7.5 8l.6.6L13.5 2.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'; return s; }
function phoneScale() { return PHONE() ? 1 : Math.max(1, Math.min(1.5, (innerHeight * 0.72) / 580)); }
const BUB_PAD = 6 / 168;   /* the bubble image shows the whole sheet; the drawing lands inside it */
function bubbleScale(w) { return ((PHONE() ? 132 : 168 * phoneScale()) * (1 - BUB_PAD * 2)) / w; }
function phone(b, sent) {
  const p = h('div', 'sb-phone');
  if (!PHONE()) p.style.setProperty('--ps', phoneScale().toFixed(3));
  const hd = h('div', 'sb-ph-hd'); hd.appendChild(mark()); const ht = h('div'); ht.appendChild(h('b', null, 'Chief of staff')); ht.appendChild(h('span', null, str(SB.app_name, 'Coco'))); hd.appendChild(ht); p.appendChild(hd);
  const body = h('div', 'sb-ph-body');
  const P = SB.phone || {};
  if (P.chip) body.appendChild(h('span', 'sb-chip', P.chip));
  arr(P.earlier).forEach((m) => { const e = h('div', 'sb-bub is-me is-text'); e.appendChild(h('span', null, m[0])); e.appendChild(h('span', 'sb-bub-t', m[1])); body.appendChild(e); });
  const ph = h('div', 'sb-bub is-me is-photo'); ph.appendChild(img(str(IMG('sketch_ink'), IMG('sketch')))); ph.appendChild(h('span', 'sb-bub-t', '1:13 am')); body.appendChild(ph);
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
  held: () => { boxOn = true; runBox(POSE.held, 1400); return null; },
  'box-close': () => { boxOn = true; runBox(POSE.close, (B[i].dur || 5000) * 0.95); return null; },
  sketch: () => {
    /* the match cut: the 3D frame's own pixels (or the product photo) take the 3D product's place, the doodle draws over it,
       and the picture cuts away the instant the outline closes */
    const r = heroRect(), wrap = h('div', 'sb-mc');
    let ph, sk = h('div', 'sb-mc-sk'), sw, shh;
    if (HERO && HERO.snap) {
      const S = HERO.snap; ph = S.el; placeAt(ph, S.x, S.y, S.w, S.h, 0); HERO.snap = null;
      /* the doodle's bottle (800 sketch space: centre x 367, 219 wide, cap top y 196, 515 tall) over the 3D bottle in the rect */
      const sy = (BOT3D.b - BOT3D.t) * r.h / 515, sx = BOT3D.w * r.w / 219;
      sw = 800 * sx; shh = 800 * sy;
      placeAt(sk, r.x + BOT3D.cx * r.w - 367 * sx, r.y + BOT3D.t * r.h - 196 * sy, sw, shh, 0);
    } else {
      const pw = r.h, px = r.x - PROD_BOX.l * pw - (pw * PROD_BOX.w - r.w) / 2;   /* the photo box whose product bounds sit on the rect */
      ph = img(IMG('product'), 'sb-mc-ph'); placeAt(ph, px, r.y, pw, pw, r.a);
      sw = shh = pw * SK_MAP.s; placeAt(sk, px + pw * SK_MAP.l, r.y + pw * SK_MAP.t, sw, sw, r.a);
    }
    wrap.appendChild(ph);
    const ink = doodle(str(IMG('sketch_ink'), IMG('sketch'))); sk.appendChild(ink); wrap.appendChild(sk);
    ink.draw(120);
    if (REDUCED) ph.remove(); else setTimeout(() => ph.remove(), 120 + STROKES[0].at + STROKES[0].d);   /* cut, the instant the outline closes */
    skHand = sk;
    /* before the cut to the phone, the doodle shrinks where it stands to the size of the photo bubble it becomes */
    const sb = bubbleScale(sw), sbY = bubbleScale(shh), at = Math.max(1800, (B[i].dur || 3800) - 520);
    if (!REDUCED) setTimeout(() => { if (!sk.isConnected) return; sk.dataset.s = sb + ',' + sbY; sk.animate([{ transform: 'rotate(' + (r.a || 0) + 'deg)' }, { transform: 'scale(' + sb + ',' + sbY + ')' }], { duration: 460, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }); }, at);
    return wrap;
  },
  record: (b) => {
    const p = phone(b, false);
    const tap = h('button', 'sb-taphear', 'Tap to hear ' + str(b.who, 'her')); tap.type = 'button'; tap.hidden = true; ui.tapHear = tap;
    tap.addEventListener('click', (e) => { e.stopPropagation(); unlock(); tap.hidden = true; playClip(b.voice); });
    p.appendChild(tap);
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
  send: (b) => { const p = phone(b, true); SFX.sent(); setTimeout(() => toDock(ui.flyBub), 450); return p; },
  coco: (b) => {
    const c = h('div', 'sb-coco');
    c.appendChild(h('h2', 'sb-coco-l', str(b.line)));
    const acts = h('div', 'sb-coco-go');
    const go = h('button', 'sb-go', str(b.cta, 'See the scope and pricing')); go.type = 'button';
    go.addEventListener('click', (e) => { e.stopPropagation(); unlock(); offer(); }); acts.appendChild(go);
    const again = h('button', 'sb-again', 'Watch again'); again.type = 'button';
    again.addEventListener('click', (e) => { e.stopPropagation(); if (app) app.reset(); setPlay(true, 0); }); acts.appendChild(again);
    c.appendChild(acts);
    return c;
  }
};

/* the sent note travels to the Chief of staff: a copy of the bubble lands on the dock's mark as the dock arrives */
function toDock(bub) {
  if (!bub || !bub.isConnected || REDUCED) return;
  const R = ui.root.getBoundingClientRect(), a = bub.getBoundingClientRect(), d = ui.dock;
  const c = bub.cloneNode(true); c.classList.add('is-copy'); c.style.left = (a.left - R.left) + 'px'; c.style.top = (a.top - R.top) + 'px'; c.style.width = a.width + 'px';
  ui.root.appendChild(c);
  const tx = d.offsetLeft + 16 - (a.left - R.left), ty = d.offsetTop + 14 - (a.top - R.top), s = 24 / a.width;
  const an = c.animate([{ transform: 'none' }, { transform: 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')' }], { duration: 640, easing: 'cubic-bezier(.6,0,.2,1)', fill: 'forwards' });
  an.onfinish = () => c.remove(); setTimeout(() => c.remove(), 1200);
}
/* the doodle travels into the phone and becomes the photo she sent, at the same scale as the bubble */
function flyInto(el, tgt) {
  if (!tgt) { el.remove(); return; }
  tgt.style.visibility = 'hidden';
  const R = ui.root.getBoundingClientRect(), t = tgt.getBoundingClientRect();
  const x = parseFloat(el.style.left), y = parseFloat(el.style.top), w = parseFloat(el.style.width), hh = parseFloat(el.style.height) || w, a = (/rotate\(([-\d.]+)deg/.exec(el.style.transform) || [0, 0])[1];
  const s = (t.width * (1 - BUB_PAD * 2)) / w, sY = (t.height * (1 - BUB_PAD * 2)) / hh, pre = !!el.dataset.s;   /* pre: already shrunk at the end of the sketch beat */
  const dx = t.left - R.left + t.width / 2 - (x + w / 2), dy = t.top - R.top + t.height / 2 - (y + hh / 2);
  el.classList.add('is-fly');
  el.getAnimations().forEach((x) => x.cancel());
  const S2 = s + ',' + sY;
  const kf = pre ? [{ transform: 'scale(' + el.dataset.s + ')' }, { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + S2 + ')' }]
    : [{ transform: 'rotate(' + a + 'deg)', offset: 0 }, { transform: 'scale(' + S2 + ')', offset: 0.42, easing: 'cubic-bezier(.3,0,.2,1)' }, { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + S2 + ')', offset: 1 }];
  const an = el.animate(kf, { duration: pre ? 520 : 760, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' });
  const done = () => { el.remove(); tgt.style.visibility = ''; };
  an.onfinish = done; an.oncancel = done;
  setTimeout(() => { if (el.isConnected && !ui.root.contains(tgt)) done(); }, 1400);
}

/* ---------- the product: the Coco app at true scale ---------- */
function ensureApp() {
  if (app) return app;
  app = createApp(cfg, ui.app, {
    img: IMG,
    sfx: (k) => { if (SFX[k]) SFX[k](); },
    onPick: (label) => {   /* the visitor picked: the Chief of staff answers, and the story moves on a little later */
      clearTimeout(msgT); ui.cmsg.textContent = 'Got it. Going with ' + label.replace(/^"|"$/g, '') + '.';
    }
  });
  return app;
}

/* ---------- show a beat ---------- */
function show(k) {
  k = clamp(k, 0, B.length - 1);
  const b = B[k]; const back = k < i; i = k;
  clearTimeout(timer); clearInterval(ui.recI); stopClip();
  const kind = b.kind === 'board' ? 'board' : 'scene';
  const is3d = /^(box-open|held|box-close)$/.test(b.kind);
  boxOn = is3d; if (!is3d) cancelAnimationFrame(raf);
  ui.root.classList.toggle('is-3d', is3d);
  ui.root.dataset.kind = kind; ui.root.dataset.beat = b.kind;
  /* the board: in for the product beats, out for the scenes */
  if (kind === 'board') {
    ensureApp();
    if (back && app) app.reset();
    if (prevKind !== 'board') { ui.app.classList.add('is-on'); if (!REDUCED) ui.app.animate([{ transform: 'translateY(14px)' }, { transform: 'none' }], { duration: 360, easing: 'cubic-bezier(.2,.8,.2,1)' }); }
    app.play(b);
  } else {
    if (app) app.stop();
    ui.app.classList.remove('is-on');
  }
  prevKind = kind;
  /* the caption */
  caption(b);
  /* the scene. Shared elements carry across: the doodle flies into the phone; the phone holds still from record to send */
  const prevBeat = ui.scene.dataset.k || '', fly = (b.kind === 'record' && prevBeat === 'sketch' && skHand && skHand.isConnected && !REDUCED) ? skHand : null;
  if (fly) ui.root.appendChild(fly);
  skHand = null;
  ui.scene.innerHTML = ''; ui.scene.dataset.k = b.kind;
  const built = BUILD[b.kind] ? BUILD[b.kind](b) : null;
  ui.scene.className = 'sb-scene' + (built ? ' is-on' : '');
  const still = b.kind === 'sketch' || fly || (b.kind === 'send' && prevBeat === 'record');
  if (built) { ui.scene.appendChild(built); if (!REDUCED && !still) built.animate([{ transform: 'translateY(14px)' }, { transform: 'none' }], { duration: 360, easing: 'cubic-bezier(.2,.8,.2,1)' }); }
  if (fly) flyInto(fly, built && built.querySelector('.sb-bub.is-photo img'));
  dockFor(b);
  ui.wm.classList.toggle('is-off', kind === 'board');
  ui.next.disabled = k === B.length - 1;
  /* timing */
  let dur = b.dur || 5000;
  if (kind === 'board' && app) dur = app.estimate(b) + 2400;   /* the board's own timeline sets the beat's length, plus a beat to read the dock */
  window.__beatT0 = performance.now();
  if (b.kind === 'record' && NOW && isFinite(NOW.duration) && NOW.duration > 0) dur = Math.max(dur, NOW.duration * 1000 + 700);
  else if (b.kind === 'record' && NOW) { NOW.addEventListener('loadedmetadata', () => { if (B[i] === b && playing) { clearTimeout(timer); const d2 = Math.max(b.dur || 4800, NOW ? NOW.duration * 1000 + 700 : 0); timer = setTimeout(() => next(), d2); runProgress(d2); } }, { once: true }); }
  if (playing && k < B.length - 1) { timer = setTimeout(() => next(), dur); runProgress(dur); } else runProgress(0);
  try { history.replaceState(null, '', location.pathname + location.search.replace(/([?&])step=\d+&?/, '$1').replace(/[?&]$/, '') + (location.hash.indexOf('pin') >= 0 ? '#pin' : '')); } catch (e) { /* */ }
}
/* the progress line: the beat's share of the whole runs out over the beat */
function runProgress(ms) {
  const a = i / B.length, z = (i + 1) / B.length, bar = ui.prog;
  bar.getAnimations().forEach((x) => x.cancel());
  if (!ms || !playing) { bar.style.transform = 'scaleX(' + (playing ? a : z).toFixed(4) + ')'; return; }
  bar.style.transform = 'scaleX(' + z.toFixed(4) + ')';
  bar.animate([{ transform: 'scaleX(' + a.toFixed(4) + ')' }, { transform: 'scaleX(' + z.toFixed(4) + ')' }], { duration: ms, easing: 'linear' });
}
/* the opening (every scene before the first board beat) is one sentence, built a line per beat as the headline */
function opening() { const k = B.findIndex((x) => x.kind === 'board'); return k < 0 ? 0 : k; }
function lead(k) {
  const L = ui.lead, lines = [];
  if (k < opening()) B.slice(0, k + 1).forEach((x) => { const t = str(x.hl); if (t && lines[lines.length - 1] !== t) lines.push(t); });
  const had = Array.from(L.children).map((e) => e.textContent);
  if (had.join('|') === lines.join('|')) return lines.length > 0;
  L.innerHTML = '';
  lines.forEach((t, n) => { const e = h('span', null, t); if (n >= had.length || had[n] !== t) e.className = 'is-new'; L.appendChild(e); });
  L.classList.toggle('is-on', lines.length > 0);
  return lines.length > 0;
}
function caption(b) {
  if (lead(i)) { ui.cap.classList.remove('is-in'); ui.cap.innerHTML = ''; ui.cap.dataset.key = ''; return; }
  const c = ui.cap;
  const key = str(b.when) + '|' + str(b.hl);
  if (b.hl && b.kind !== 'coco' && c.dataset.key === key && c.classList.contains('is-in')) return;   /* the same line holds across beats */
  c.innerHTML = ''; c.dataset.key = key;
  if (!b.hl || b.kind === 'coco') { c.classList.remove('is-in'); c.dataset.key = ''; return; }
  if (b.when) c.appendChild(h('span', 'sb-cap-w', b.when));
  c.appendChild(h('span', 'sb-cap-l', b.hl));
  c.classList.remove('is-in'); void c.offsetWidth; c.classList.add('is-in');
}
function dockFor(b) {
  clearTimeout(msgT);
  const d = ui.dock;
  if (!b.cos || b.kind === 'coco') { d.classList.remove('is-in'); ui.root.classList.remove('has-dock'); return; }
  ui.cstate.textContent = ''; ui.cmsg.innerHTML = ''; ui.cmsg.appendChild(dots());
  const wasIn = d.classList.contains('is-in');
  msgT = setTimeout(() => {
    if (!wasIn) SFX.dock();
    d.classList.add('is-in'); ui.root.classList.add('has-dock');
    msgT = setTimeout(() => { if (B[i] === b) { ui.cmsg.textContent = b.cos; ui.cstate.textContent = str(b.st); } }, b.kind === 'send' ? 500 : 900);
  }, wasIn ? 250 : b.kind === 'send' ? 900 : 1500);
}
function dots() { const s = h('span', 'sb-dots'); s.appendChild(h('i')); s.appendChild(h('i')); s.appendChild(h('i')); return s; }
function next() { if (i < B.length - 1) show(i + 1); }
function prev() { if (i > 0) show(i - 1); }
function setPlay(on, at) {
  playing = on; setPlayBtn();
  if (on) show(at == null ? i : at); else { clearTimeout(timer); runProgress(0); }
}
function setPlayBtn() { ui.play.classList.toggle('is-paused', !playing); ui.play.setAttribute('aria-label', playing ? 'Pause' : 'Play'); }
function setSound() { if (!ui.sound) return; ui.sound.classList.toggle('is-off', !SOUND); ui.sound.setAttribute('aria-label', SOUND ? 'Mute' : 'Sound on'); ui.sound.setAttribute('aria-pressed', SOUND ? 'false' : 'true'); }

/* ---------- the offer pages (sb-offer.js) ---------- */
function offer() {
  playing = false; clearTimeout(timer); setPlayBtn(); runProgress(0);
  ui.root.classList.add('is-offer');
  const close = () => { ui.root.classList.remove('is-offer'); ui.offer.innerHTML = ''; };
  if (cfg.offer && window.cocoOffer) window.cocoOffer(cfg, ui.offer, { onClose: close });
  else if (SB.cta_href) location.href = SB.cta_href;
  else ui.root.classList.remove('is-offer');
}

/* ---------- the controls: one floating pill that fades when idle ---------- */
function idle() {
  ui.root.classList.remove('is-idle'); clearTimeout(ui.idleT);
  ui.idleT = setTimeout(() => { if (!ui.ctl.matches(':hover, :focus-within')) ui.root.classList.add('is-idle'); }, 2000);
}
const ICONS = {
  play: '<svg class="i-pause" viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="2.5" width="3" height="11" rx="1"/><rect x="9.5" y="2.5" width="3" height="11" rx="1"/></svg><svg class="i-play" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.6v10.8a.6.6 0 0 0 .9.5l8.3-5.4a.6.6 0 0 0 0-1L5.4 2.1a.6.6 0 0 0-.9.5z"/></svg>',
  next: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2.9v10.2a.6.6 0 0 0 .9.5l7.4-5.1a.6.6 0 0 0 0-1L3.9 2.4a.6.6 0 0 0-.9.5z"/><rect x="11.6" y="2.5" width="2" height="11" rx="1"/></svg>',
  sound: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6v4h2.6L8.5 13V3L4.6 6z"/><path class="i-wave" d="M10.6 5.6a3.4 3.4 0 0 1 0 4.8M12.4 3.8a6 6 0 0 1 0 8.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path class="i-x" d="M10.5 6l4 4M14.5 6l-4 4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'
};
function btn(cls, label, svgHtml) { const b = h('button', 'sb-b ' + cls); b.type = 'button'; b.setAttribute('aria-label', label); b.innerHTML = svgHtml; return b; }

/* ---------- build ---------- */
function build() {
  document.documentElement.classList.add('is-sb');
  const mount = document.getElementById('app') || document.body;
  mount.innerHTML = '';
  const r = h('section', 'sb'); r.setAttribute('aria-label', str(SB.title, 'Coco')); ui.root = r;
  ui.d3 = h('div', 'sb-3d'); r.appendChild(ui.d3);
  ui.app = h('div', 'sb-app'); r.appendChild(ui.app);
  ui.scene = h('div', 'sb-scene'); r.appendChild(ui.scene);
  ui.wm = h('p', 'sb-wm'); ui.wm.appendChild(h('b', null, 'Coco')); ui.wm.appendChild(h('span', null, 'by sameep.ai')); r.appendChild(ui.wm);
  ui.cap = h('p', 'sb-cap'); ui.cap.setAttribute('aria-live', 'polite'); r.appendChild(ui.cap);
  ui.lead = h('h1', 'sb-lead'); ui.lead.setAttribute('aria-live', 'polite'); r.appendChild(ui.lead);
  ui.dock = h('aside', 'sb-dock'); ui.dock.setAttribute('aria-live', 'polite');
  const dh = h('div', 'sb-dock-hd'); dh.appendChild(mark()); dh.appendChild(h('b', null, 'Chief of staff')); ui.cstate = h('span', 'sb-cstate'); dh.appendChild(ui.cstate); ui.dock.appendChild(dh);
  ui.cmsg = h('p', 'sb-cmsg'); ui.dock.appendChild(ui.cmsg); r.appendChild(ui.dock);
  const ctl = h('nav', 'sb-ctl'); ctl.setAttribute('aria-label', 'Story controls'); ui.ctl = ctl;
  ui.play = btn('is-play', 'Pause', ICONS.play); ui.next = btn('is-next', 'Next', ICONS.next); ui.sound = btn('is-sound', 'Sound on', ICONS.sound);
  [ui.play, ui.next, ui.sound].forEach((x) => ctl.appendChild(x));
  if (MUTED) ui.sound.hidden = true;
  r.appendChild(ctl);
  const pg = h('div', 'sb-prog'); ui.prog = h('i'); pg.appendChild(ui.prog); r.appendChild(pg);
  ui.offer = h('div', 'sb-offer'); r.appendChild(ui.offer);
  mount.appendChild(r);
  ui.next.addEventListener('click', (e) => { e.stopPropagation(); unlock(); next(); });
  ui.play.addEventListener('click', (e) => { e.stopPropagation(); unlock(); setPlay(!playing); });
  ui.sound.addEventListener('click', (e) => { e.stopPropagation(); if (SOUND) { SOUND = false; stopClip(); setSound(); } else unlock(); });
  addEventListener('pointerdown', () => unlock(), { once: true, capture: true });
  ['pointermove', 'pointerdown', 'keydown', 'touchstart'].forEach((ev) => addEventListener(ev, idle, { passive: true }));
  addEventListener('keydown', (e) => {
    if (ui.root.classList.contains('is-offer') || (e.target.closest && e.target.closest('button, a, input'))) return;
    if (e.key === 'ArrowRight') { unlock(); next(); } else if (e.key === 'ArrowLeft') prev(); else if (e.key === ' ') { e.preventDefault(); unlock(); setPlay(!playing); }
  });
  addEventListener('resize', () => sizeBox());
  setSound(); setPlayBtn(); idle();
}

function start(raw) {
  cfg = raw || {}; SB = cfg.storyboard || {}; B = arr(SB.beats);
  if (!B.length) return false;
  document.title = str((cfg.page || {}).title, 'Coco') + ' · ' + str(SB.tagline, 'the chief of staff OS for consumer brands, by sameep.ai');
  build();
  ['product', 'sketch_ink'].forEach((k) => { const u = IMG(k); if (u) { const im = new Image(); im.src = u; if (im.decode) im.decode().catch(() => {}); } });
  const st = /[?&]step=(\d+)/.exec(location.search);
  playing = !Q.has('still'); setPlayBtn();
  const k0 = st ? +st[1] - 1 : 0;
  /* a deep link into the product beats replays the board from the first product beat, quietly, so the thread has its history */
  /* the parcel warms up before a 3D beat needs it; any other first beat shows at once while it warms behind */
  const first3d = /^(box-open|held|box-close)$/.test((B[clamp(k0, 0, B.length - 1)] || {}).kind);
  if (P3) {
    const ready = import(P3_URL).then((m) => { initP3 = m.init; ensureBox(); if (box && box.warm) return box.warm(); }).catch(() => { initP3 = null; p3Failed = true; });
    if (first3d) ready.then(() => show(k0)); else show(k0);
  } else show(k0);
  if (Q.has('offer')) offer();
  window.__sb = { show, next, prev, get i() { return i; }, get beat() { return B[i]; }, offer, n: B.length, get app() { return app; } };
  return true;
}
window.cosSB = start;
dispatchEvent(new Event('cosSB'));
