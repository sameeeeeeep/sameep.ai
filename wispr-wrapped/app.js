// Wispr Wrapped: a story player (tap, hold, swipe, keys), a 1080×1920 PNG of any card drawn from the same card
// data, and "make yours" (talk or paste, counted in this tab; only the counts go in the share link).
// A plain script, not a module, so the /wispr-wrapped skill can inline it into a page that opens from disk
// (file:// can't load modules). The page sets window.WW_DATA = { C, STORIES } and, optionally, WW_CONFIG.
// ?png=<mode>:<n> draws card n as a bare 1080×1920 image (the skill screenshots it with headless Chrome).
(() => {
const { C, STORIES } = window.WW_DATA;
const CFG = { yours: true, foot: ['A prototype by Sameep for Wispr', 'sameep.ai'], footHref: /^https?:$/.test(location.protocol) ? '/' : null, ...window.WW_CONFIG };
const track = (t, d) => { try { window.wwTrack?.(t, d); } catch { /* analytics never breaks the story */ } };

const $ = (s, el = document) => el.querySelector(s);
const RM = matchMedia('(prefers-reduced-motion: reduce)');
const nf = (n) => Math.round(n).toLocaleString('en-US');
const INK = new Set(['fathom', 'vast', 'flare']);
const fgOf = (bg) => (INK.has(bg) && bg !== 'flare' ? C.lumen : C.vast);
const FOOT = CFG.foot;
// on screen the foot's right side links home (never in the PNG, never from disk)
const footEnd = () => (CFG.footHref ? el('a', { href: CFG.footHref }, FOOT[1]) : el('span', {}, FOOT[1]));
const BLOBS = [[78, 24, 70], [18, 30, 62], [84, 58, 56], [30, 18, 80], [70, 40, 66]]; // x%, y%, size cqw, per card
const DUR = 7500;

function el(tag, attrs = {}, ...kids) {
  const [t, ...cls] = tag.split('.');
  const e = document.createElement(t || 'div');
  if (cls.length) e.className = cls.join(' ');
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'style') for (const [p, x] of Object.entries(v)) e.style.setProperty(p, x);
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : String(k));
  return e;
}

// ---------------------------------------------------------------- state
const story = $('.story'), cardEl = $('.card'), barsEl = $('.bars'), srcEl = $('.src');
const S = { mode: 'project', i: 0, paused: false, list: [], data: null, timer: 0, held: false };

function cardsOf(d) { return [...d.cards, { id: 'share', bg: 'lumen', share: d.share }]; }

function setMode(mode, i = 0, { push = true } = {}) {
  const d = mode === 'yours' ? S.yours : STORIES[mode];
  if (!d) { openOwn(); return; }
  S.mode = mode; S.data = d; S.list = cardsOf(d); S.i = Math.max(0, Math.min(i, S.list.length - 1));
  document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
  srcEl.textContent = d.src;
  barsEl.replaceChildren(...S.list.map(() => el('i', {}, el('b'))));
  show(S.i, null, true);
  if (push) syncUrl();
  track('wrapped_mode', { mode });
}

function syncUrl() {
  const u = new URL(location.href);
  u.searchParams.set('m', S.mode);
  if (S.i) u.searchParams.set('c', S.i + 1); else u.searchParams.delete('c');
  u.hash = S.mode === 'yours' && S.yoursCode ? 'y=' + S.yoursCode : '';
  try { history.replaceState(null, '', u); } catch { /* file:// in some browsers */ }
}

// ---------------------------------------------------------------- one card
function show(i, origin, first = false) {
  const prev = S.list[S.i];
  S.i = i;
  const c = S.list[i], bg = C[c.bg], fg = fgOf(c.bg);
  story.style.setProperty('--fg', fg);
  cardEl.classList.toggle('is-ink', INK.has(c.bg));
  cardEl.style.setProperty('--fg', fg);
  const body = c.share ? shareBody(c.share) : cardBody(c);
  const w = cardEl.clientWidth, h = cardEl.clientHeight;
  const flood = !first && !RM.matches && prev && prev.bg !== c.bg;
  if (flood) {
    const o = origin || { x: w * 0.85, y: h * 0.5 }, d = 2.1 * Math.hypot(Math.max(o.x, w - o.x), Math.max(o.y, h - o.y));
    const f = el('i.flood', { style: { left: o.x + 'px', top: o.y + 'px', width: d + 'px', height: d + 'px', '--bg': bg } });
    f.addEventListener('animationend', () => { cardEl.style.setProperty('--bg', bg); f.remove(); }, { once: true });
    cardEl.replaceChildren(f, body);
  } else {
    cardEl.style.setProperty('--bg', bg);
    cardEl.replaceChildren(body);
  }
  fitBig(body);
  const big = body.querySelector('[data-count]');
  if (big) countUp(big, Number(big.dataset.count));
  bars();
  $('[data-act="save"]').hidden = !!c.share;  // the share card has its own Save
  $('.side--prev').disabled = i === 0;
  $('.side--next').disabled = i === S.list.length - 1;
  syncUrl();
  track('wrapped_card', { mode: S.mode, card: c.id, n: i + 1 });
}

const r = (d, node) => { node.classList.add('r'); node.style.setProperty('--d', d + 's'); return node; };

function bigNode(c) {
  const isNum = typeof c.big === 'number';
  const txt = isNum ? nf(c.big) : c.big;
  const cls = isNum || txt.length <= 6 ? 'c__big' : txt.length > 14 ? 'c__big c__big--word c__big--long' : 'c__big c__big--word';
  const n = el('p', { class: cls }, txt);
  if (isNum) n.dataset.count = c.big;
  return n;
}

function cardBody(c) {
  const [bx, by, bs] = BLOBS[S.i % BLOBS.length];
  return el('div.c', {},
    el('i.blob', { style: { left: bx + '%', top: by + '%', '--s': bs + 'cqw' } }),
    r(0.15, el('p.c__k', {}, c.k)),
    c.id === 'intro' ? r(0.25, el('p.c__who', {}, S.data.who)) : null,
    c.viz ? r(0.3, vizNode(c.viz)) : null,
    el('div.c__push'),
    r(0.35, bigNode(c)),
    c.unit ? r(0.5, el('p.c__unit', {}, c.unit)) : null,
    c.p ? r(0.7, el('p.c__p', {}, c.p)) : null,
    c.id === 'intro' && S.i === 0 ? r(0.95, el('p.c__go', {}, 'Tap to start  →')) : null,
    c.note ? r(0.9, el('p.c__note', {}, el('b', {}, 'Estimate. '), c.note.replace(/^Estimate:\s*/, ''))) : null,
    r(1, el('p.c__foot', {}, el('span', {}, FOOT[0]), footEnd())));
}

function vizNode(v) {
  const box = el('div', { class: 'v v-' + v.type, 'aria-hidden': v.type === 'wave' ? 'true' : null });
  if (v.type === 'wave') [.35, .6, .9, .55, 1, .7, .4, .8, .5, .3, .65, .45].forEach((x, i) => box.append(el('i', { style: { '--h': x * 100 + '%', '--d': (-i * .17) + 's' } })));
  if (v.type === 'split') {
    const tot = v.items.reduce((a, [, n]) => a + n, 0);
    box.setAttribute('role', 'img'); box.setAttribute('aria-label', v.items.map(([l, n]) => `${l} ${nf(n)} words`).join(', '));
    v.items.forEach(([l, n]) => box.append(el('i', { style: { 'flex-grow': n } }, `${l} ${Math.round(n / tot * 100)}%`)));
  }
  if (v.type === 'list') {
    const max = Math.max(...v.items.map(([, n]) => n));
    box.replaceWith(); const ol = el('ol', { class: 'v v-list' });
    v.items.forEach(([l, n], i) => ol.append(el('li', { style: { '--d': (0.45 + i * 0.09) + 's' } }, el('b', {}, l), el('span', { style: { '--w': Math.max(.03, n / max) } }), el('em', {}, nf(n)))));
    return ol;
  }
  if (v.type === 'chips') v.items.forEach((t, i) => box.append(el('span', { style: { '--d': (0.4 + i * 0.07) + 's' } }, t)));
  if (v.type === 'quote') box.append(el('q', {}, v.text), v.by ? el('small', {}, v.by) : null);
  if (v.type === 'stats') { const dl = el('dl', { class: 'v v-stats' }); v.items.forEach(([k, x]) => dl.append(el('div', {}, el('dt', {}, k), el('dd', {}, x)))); return dl; }
  if (v.type === 'hours') {
    const max = Math.max(...v.items), peak = v.items.indexOf(max);
    box.setAttribute('role', 'img'); box.setAttribute('aria-label', `Words by hour of day; peak at ${peak}:00`);
    v.items.forEach((n, i) => box.append(el('i', { class: i === peak ? 'is-peak' : null, style: { '--h': (n / max * 100) + '%', '--d': (0.4 + i * 0.02) + 's' } })));
    return el('div', {}, box, el('p', { class: 'v-hours__l' }, el('span', {}, 'midnight'), el('span', {}, '6am'), el('span', {}, 'noon'), el('span', {}, '6pm')));
  }
  return box;
}

function shareBody(s) {
  const own = S.mode === 'yours';
  return el('div.c', {},
    r(0.1, el('p.c__k', {}, s.k)),
    r(0.2, el('p.c__who', {}, S.data.who)),
    el('div.c__push'),
    r(0.3, el('p.sh__big', {}, s.big)),
    r(0.4, el('p.c__unit', {}, s.unit)),
    el('div.sh__grid', {}, s.tiles.map(([k, v, bg], i) => el('div', { style: { background: C[bg], color: fgOf(bg), '--d': (0.5 + i * 0.1) + 's' } }, el('small', {}, k), el('b', {}, v)))),
    r(0.9, el('div.sh__btns', {},
      CFG.yours ? el('button.act.act--primary', { type: 'button', onclick: (e) => { e.stopPropagation(); openOwn(); } }, own ? 'Make another' : 'Make yours') : null,
      el(CFG.yours ? 'button.act' : 'button.act.act--primary', { type: 'button', onclick: (e) => { e.stopPropagation(); save(); } }, 'Save card'))),
    r(1, el('p.c__foot', {}, el('span', {}, FOOT[0]), footEnd())));
}

// shrink big type until it fits the card's width
function fitBig(body) {
  body.querySelectorAll('.c__big, .sh__big').forEach((n) => {
    let fs = parseFloat(getComputedStyle(n).fontSize), k = 0;
    while (n.scrollWidth > n.clientWidth + 1 && k++ < 30) { fs *= 0.93; n.style.fontSize = fs + 'px'; }
  });
}

function countUp(n, to) {
  if (RM.matches) return;
  const t0 = performance.now() + 350, ms = 1100;
  const step = (t) => {
    if (!n.isConnected) return;
    const p = Math.max(0, Math.min(1, (t - t0) / ms));
    n.textContent = nf(to * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  n.textContent = '0';
  requestAnimationFrame(step);
}

// ---------------------------------------------------------------- progress + autoplay
function bars() {
  clearTimeout(S.timer);
  const last = S.i === S.list.length - 1;
  [...barsEl.children].forEach((b, k) => {
    b.className = k < S.i ? 'is-past' : k === S.i && !last ? 'is-now' : k === S.i ? 'is-past' : '';
    const fill = b.firstChild; fill.style.animation = 'none'; void fill.offsetWidth; fill.style.animation = '';
  });
  story.style.setProperty('--dur', DUR + 'ms');
  const now = barsEl.children[S.i]?.firstChild;
  if (now && !last && !RM.matches) now.onanimationend = () => { if (!S.paused) go(1); };
  setPaused(S.paused);
}
function setPaused(p) {
  S.paused = p;
  story.classList.toggle('is-paused', p);
  const b = $('[data-act="pause"]');
  b.classList.toggle('is-play', p); b.setAttribute('aria-label', p ? 'Play' : 'Pause');
  b.hidden = RM.matches;
}
function go(dir, origin) {
  const j = S.i + dir;
  if (j < 0 || j >= S.list.length) return;
  show(j, origin);
}

// tap the left third to go back, anywhere else for next; hold to pause; swipe either way
let down = null;
cardEl.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button, a')) return;
  down = { x: e.clientX, y: e.clientY, t: performance.now(), was: S.paused };
  S.held = false;
  S.holdT = setTimeout(() => { S.held = true; setPaused(true); }, 220);
});
cardEl.addEventListener('pointerup', (e) => {
  clearTimeout(S.holdT);
  if (!down) return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y, box = cardEl.getBoundingClientRect();
  const was = down.was; down = null;
  if (S.held) { setPaused(was); return; }
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { go(dx < 0 ? 1 : -1); return; }
  const o = { x: e.clientX - box.left, y: e.clientY - box.top };
  go(o.x < box.width / 3 ? -1 : 1, o);
});
cardEl.addEventListener('pointercancel', () => { clearTimeout(S.holdT); if (S.held) setPaused(down?.was ?? false); down = null; });
cardEl.addEventListener('contextmenu', (e) => e.preventDefault());
$('.side--prev').onclick = () => go(-1);
$('.side--next').onclick = () => go(1);
addEventListener('keydown', (e) => {
  if (!$('.own').hidden || e.target.closest('input, textarea')) return;
  if (e.key === 'ArrowRight') go(1);
  else if (e.key === 'ArrowLeft') go(-1);
  else if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); setPaused(!S.paused); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && !S.paused) { setPaused(true); S.autoPaused = true; } else if (!document.hidden && S.autoPaused) { S.autoPaused = false; setPaused(false); } });

// tabs: one per story in the data, plus "Yours" where make-yours is on
$('.tabs').replaceChildren(...[...Object.keys(STORIES), ...(CFG.yours ? ['yours'] : [])].map((m) => el('button', { role: 'tab', 'data-mode': m, type: 'button',
  onclick: () => { if (m === 'yours' && !S.yours) openOwn(); else setMode(m); } }, m === 'yours' ? 'Yours' : STORIES[m].tab)));
$('[data-act="pause"]').onclick = () => setPaused(!S.paused);
$('[data-act="save"]').onclick = () => save();
if (CFG.link === false) $('[data-act="link"]').hidden = true;
$('[data-act="link"]').onclick = async (e) => {
  syncUrl();
  const b = e.currentTarget;
  try { await navigator.clipboard.writeText(location.href); b.textContent = 'Link copied'; }
  catch { prompt('Copy this link', location.href); }
  b.classList.add('is-done');
  setTimeout(() => { b.textContent = 'Copy link'; b.classList.remove('is-done'); }, 1800);
  track('wrapped_link', { mode: S.mode, card: S.list[S.i].id });
};
RM.addEventListener?.('change', () => bars());

function toast(t) { const n = el('div.toast', { role: 'status' }, t); document.body.append(n); setTimeout(() => n.remove(), 2200); }

// ---------------------------------------------------------------- the 1080×1920 PNG
const W = 1080, H = 1920, U = W / 100; // 1 cqw
function wrapText(c, text, maxW) {
  const out = []; let line = '';
  for (const w of String(text).split(/\s+/)) {
    const t = line ? line + ' ' + w : w;
    if (c.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}
function rr(c, x, y, w, h, rad) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, rad) : c.rect(x, y, w, h); }
function mix(fg, a) { // fg at alpha a, as rgba
  const n = parseInt(fg.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
const SERIF = '"EB Garamond", Georgia, serif', SANS = 'Figtree, system-ui, sans-serif';

async function drawPng(card) {
  // wait for the fonts, but never more than 5 s (offline: system fonts it is)
  try { await Promise.race([Promise.all([`400 100px ${SERIF}`, `italic 400 60px ${SERIF}`, `600 40px ${SANS}`, `500 40px ${SANS}`].map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 5000))]); } catch {}
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d'), bg = C[card.bg], fg = fgOf(card.bg), X = 7.5 * U, MW = W - 2 * X;
  c.fillStyle = bg; c.fillRect(0, 0, W, H);
  c.fillStyle = fg; c.textBaseline = 'alphabetic';
  // top: kicker, then the visual
  c.globalAlpha = .75; c.font = `600 ${3.6 * U}px ${SANS}`; c.letterSpacing = '4px';
  const kTxt = (card.share ? card.share.k : card.k).toUpperCase();
  c.fillText(kTxt, X, 13 * U); c.letterSpacing = '0px'; c.globalAlpha = 1;
  let y = 13 * U + 4 * U;
  if (card.share || card.id === 'intro') { c.globalAlpha = .6; c.font = `500 ${3.4 * U}px ${SANS}`; c.fillText(S.data.who, X, y + U); c.globalAlpha = 1; y += 4 * U; }
  if (card.viz && !card.share) drawViz(c, card.viz, X, y + 3 * U, MW, fg, bg);

  // bottom-up: foot, note, p, unit, big
  let b = H - 7 * U;
  c.globalAlpha = .55; c.font = `600 ${2.8 * U}px ${SANS}`;
  c.fillText(FOOT[0], X, b); c.textAlign = 'right'; c.fillText(FOOT[1], W - X, b); c.textAlign = 'left'; c.globalAlpha = 1;
  b -= 8 * U;
  if (card.share) return drawShare(c, card.share, X, MW, b, cv);
  if (card.note) {
    c.font = `500 ${3.3 * U}px ${SANS}`;
    const lines = wrapText(c, 'Estimate. ' + card.note.replace(/^Estimate:\s*/, ''), MW - 6.4 * U), lh = 4.5 * U, hh = lines.length * lh + 3.6 * U;
    c.fillStyle = mix(fg, .09); rr(c, X, b - hh, MW, hh, 3 * U); c.fill(); c.fillStyle = fg;
    lines.forEach((l, k) => c.fillText(l, X + 3.2 * U, b - hh + 2.4 * U + (k + 1) * lh - 1.1 * U));
    b -= hh + 3.4 * U;
  }
  if (card.p) {
    c.font = `500 ${4.5 * U}px ${SANS}`;
    const lines = wrapText(c, card.p, MW * .92), lh = 6.2 * U;
    lines.forEach((l, k) => c.fillText(l, X, b - (lines.length - 1 - k) * lh));
    b -= lines.length * lh + 3.4 * U;
  }
  if (card.unit) { c.font = `italic 400 ${7 * U}px ${SERIF}`; wrapText(c, card.unit, MW).reverse().forEach((l, k) => c.fillText(l, X, b - k * 7.7 * U)); b -= 4.6 * U + 7.7 * U * (wrapText(c, card.unit, MW).length); }
  const txt = typeof card.big === 'number' ? nf(card.big) : card.big;
  let fs = (typeof card.big === 'number' || txt.length <= 6 ? 27 : txt.length > 14 ? 13 : 17) * U;
  c.font = `400 ${fs}px ${SERIF}`;
  let lines = wrapText(c, txt, MW);
  while (lines.some((l) => c.measureText(l).width > MW) && fs > 40) { fs *= .93; c.font = `400 ${fs}px ${SERIF}`; lines = wrapText(c, txt, MW); }
  c.letterSpacing = `${-0.04 * fs}px`;
  lines.reverse().forEach((l, k) => c.fillText(l, X - fs * .02, b - k * fs * .95));
  c.letterSpacing = '0px';
  return cv;
}

function drawViz(c, v, x, y, w, fg, bg) {
  c.save();
  if (v.type === 'wave') { const hs = [.35, .6, .9, .55, 1, .7, .4, .8, .5, .3, .65, .45], gap = 1.6 * U, bw = (w - gap * 11) / 12, H0 = 30 * U; hs.forEach((h, i) => { const bh = H0 * h * .8; rr(c, x + i * (bw + gap), y + (H0 - bh) / 2, bw, bh, bw / 2); c.fill(); }); }
  if (v.type === 'split') {
    const tot = v.items.reduce((a, [, n]) => a + n, 0), hh = 13 * U; let cx = x;
    c.save(); rr(c, x, y, w, hh, 3 * U); c.clip();
    v.items.forEach(([l, n], i) => { const ww = w * n / tot; c.fillStyle = i ? mix(fg, .14) : fg; c.fillRect(cx, y, ww, hh); c.fillStyle = i ? fg : bg; c.font = `600 ${3.6 * U}px ${SANS}`; c.fillText(`${l} ${Math.round(n / tot * 100)}%`, cx + 3 * U, y + hh / 2 + 1.3 * U); cx += ww; });
    c.restore();
  }
  if (v.type === 'list') {
    const max = Math.max(...v.items.map(([, n]) => n)), lh = 6.4 * U;
    v.items.forEach(([l, n], i) => { const yy = y + i * lh; let ls = 3.8 * U; c.font = `600 ${ls}px ${SANS}`; while (c.measureText(l).width > 24.4 * U && ls > 2.2 * U) { ls *= .92; c.font = `600 ${ls}px ${SANS}`; } c.fillStyle = fg; c.fillText(l, x, yy + 3.8 * U); c.font = `600 ${3.8 * U}px ${SANS}`; const bx = x + 26.4 * U, bw = w - 26.4 * U - 14.4 * U; c.globalAlpha = .85; rr(c, bx, yy + 1.4 * U, Math.max(.03, n / max) * bw, 2.6 * U, 1.3 * U); c.fill(); c.globalAlpha = .7; c.textAlign = 'right'; c.fillText(nf(n), x + w, yy + 3.8 * U); c.textAlign = 'left'; c.globalAlpha = 1; });
  }
  if (v.type === 'chips') {
    c.font = `500 ${3.7 * U}px ui-monospace, Menlo, monospace`; let cx = x, cy = y; const ph = 7 * U, g = 1.8 * U;
    v.items.forEach((t) => { const tw = c.measureText(t).width + 6 * U; if (cx + tw > x + w) { cx = x; cy += ph + g; } c.fillStyle = C.paper; rr(c, cx, cy, tw, ph, ph / 2); c.fill(); c.fillStyle = fg; c.fillText(t, cx + 3 * U, cy + ph / 2 + 1.2 * U); c.strokeStyle = C.flare; c.lineWidth = .35 * U; c.beginPath(); for (let k = 0; k <= tw - 6 * U; k += 2 * U) { c.lineTo(cx + 3 * U + k, cy + ph / 2 + 2.6 * U + (k / (2 * U) % 2 ? .6 * U : -.2 * U)); } c.stroke(); cx += tw + g; });
  }
  if (v.type === 'quote') {
    c.font = `italic 400 ${7 * U}px ${SERIF}`; const lines = wrapText(c, v.text, w - 10 * U), lh = 7.7 * U, hh = lines.length * lh + (v.by ? 6 * U : 0) + 8 * U;
    c.fillStyle = mix(fg, .08); rr(c, x, y, w, hh, 4 * U); c.fill(); c.fillStyle = fg;
    lines.forEach((l, k) => c.fillText(l, x + 5 * U, y + 4.5 * U + (k + 1) * lh - 1.5 * U));
    if (v.by) { c.globalAlpha = .6; c.font = `600 ${3 * U}px ${SANS}`; c.letterSpacing = '3px'; c.fillText(v.by.toUpperCase(), x + 5 * U, y + hh - 4.5 * U); c.letterSpacing = '0px'; }
  }
  if (v.type === 'stats') {
    const g = 2.4 * U, tw = (w - g) / 2, th = 17 * U;
    v.items.forEach(([k, val], i) => { const tx = x + (i % 2) * (tw + g), ty = y + Math.floor(i / 2) * (th + g); c.fillStyle = mix(fg, .1); rr(c, tx, ty, tw, th, 3.4 * U); c.fill(); c.fillStyle = fg; c.globalAlpha = .7; c.font = `600 ${2.9 * U}px ${SANS}`; c.fillText(k.toUpperCase(), tx + 3.4 * U, ty + 6 * U); c.globalAlpha = 1; let fs = 7.4 * U; c.font = `400 ${fs}px ${SERIF}`; while (c.measureText(val).width > tw - 6.8 * U && fs > 20) { fs *= .92; c.font = `400 ${fs}px ${SERIF}`; } c.fillText(val, tx + 3.4 * U, ty + th - 3.6 * U); });
  }
  if (v.type === 'hours') {
    const max = Math.max(...v.items), peak = v.items.indexOf(max), g = .8 * U, bw = (w - g * 23) / 24, H0 = 26 * U;
    v.items.forEach((n, i) => { const bh = Math.max(.6 * U, H0 * n / max); c.globalAlpha = i === peak ? 1 : .3; c.fillStyle = i === peak ? C.glow : fg; rr(c, x + i * (bw + g), y + H0 - bh, bw, bh, [.8 * U, .8 * U, 0, 0]); c.fill(); });
    c.globalAlpha = .55; c.fillStyle = fg; c.font = `600 ${2.8 * U}px ${SANS}`; const ly = y + H0 + 4.2 * U;
    c.fillText('midnight', x, ly); c.fillText('6am', x + w * .25, ly); c.fillText('noon', x + w * .5, ly); c.textAlign = 'right'; c.fillText('6pm', x + w * .75 + 8 * U, ly); c.textAlign = 'left';
  }
  c.restore();
}

function drawShare(c, s, X, MW, b, cv) {
  const g = 2.4 * U, tw = (MW - g) / 2, th = 25 * U;
  const top = b - 2 * (th + g) + g;
  s.tiles.forEach(([k, v, bg], i) => {
    const tx = X + (i % 2) * (tw + g), ty = top + Math.floor(i / 2) * (th + g), fg = fgOf(bg);
    c.fillStyle = C[bg]; rr(c, tx, ty, tw, th, 4 * U); c.fill(); c.fillStyle = fg;
    c.globalAlpha = .75; c.font = `600 ${2.9 * U}px ${SANS}`; c.fillText(k.toUpperCase(), tx + 3.6 * U, ty + 6.4 * U); c.globalAlpha = 1;
    let vs = 6.6 * U; c.font = `400 ${vs}px ${SERIF}`; let lines = wrapText(c, v, tw - 7.2 * U);
    while (lines.length > 2 && vs > 3.6 * U) { vs *= .9; c.font = `400 ${vs}px ${SERIF}`; lines = wrapText(c, v, tw - 7.2 * U); }
    lines.slice(0, 3).reverse().forEach((l, k2) => c.fillText(l, tx + 3.6 * U, ty + th - 3.6 * U - k2 * vs * 1.03));
  });
  c.fillStyle = C.vast;
  let y = top - 6 * U;
  c.font = `italic 400 ${7 * U}px ${SERIF}`; c.fillText(s.unit, X, y); y -= 9.4 * U;
  let fs = 24 * U; c.font = `400 ${fs}px ${SERIF}`; while (c.measureText(s.big).width > MW && fs > 60) { fs *= .93; c.font = `400 ${fs}px ${SERIF}`; }
  c.letterSpacing = `${-0.04 * fs}px`; c.fillText(s.big, X - fs * .02, y); c.letterSpacing = '0px';
  return cv;
}

async function save() {
  const card = S.list[S.i];
  const b = $('[data-act="save"]'); b.textContent = 'Drawing…';
  try {
    const cv = await drawPng(card);
    const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
    const name = `wispr-wrapped-${S.mode}-${String(S.i + 1).padStart(2, '0')}-${card.id}.png`;
    const file = new File([blob], name, { type: 'image/png' });
    // phones: the share sheet (save to Photos, post to a story); everything else: a download
    if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Wispr Wrapped' }); } catch (e) { if (e.name !== 'AbortError') throw e; }
    } else {
      const a = el('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('Saved a 1080×1920 PNG');
    }
    track('wrapped_save', { mode: S.mode, card: card.id });
  } catch (e) { toast('Couldn’t draw that one. Try a screenshot?'); }
  b.textContent = 'Save this card';
}

// ---------------------------------------------------------------- make yours
const own = $('.own'), txt = $('.own__txt'), err = $('.own__err'), mic = $('.mic'), micT = $('.mic__t');
let lastFocus = null;
function openOwn() {
  if (!own) return;
  lastFocus = document.activeElement;
  own.hidden = false; err.textContent = '';
  setPaused(true);
  setTimeout(() => $('[data-own="copy"]').focus(), 30);
  track('wrapped_own_open', {});
}
function closeOwn() {
  stopMic(); own.hidden = true; lastFocus?.focus?.();
  if (!S.data) setMode('project');
}
if (own) {
own.addEventListener('click', (e) => { if (e.target === own) closeOwn(); });
own.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOwn(); });
$('[data-own="close"]').onclick = closeOwn;
$('[data-own="copy"]').onclick = async (e) => {
  const b = e.currentTarget, line = $('#own-cmd').textContent;
  try { await navigator.clipboard.writeText(line); b.textContent = 'Copied'; } catch { prompt('Copy this line', line); }
  setTimeout(() => { b.textContent = 'Copy'; }, 1800);
  track('wrapped_install_copy', {});
};
$('[data-own="sample"]').onclick = () => {
  txt.value = 'Okay so basically I think the onboarding is, you know, kind of long. Like, why do we ask for the team size before they have even tried it? I would honestly just let them talk first. Let them hold the key, say one sentence, and see it show up clean. That is the aha. Everything else can wait. Also, can we try a version where the first screen is just a mic? Literally just a mic. I think it would basically double activation, or at least, you know, we would learn something.';
  S.speechSecs = 0; err.textContent = ''; txt.focus();
};
$('[data-own="go"]').onclick = () => {
  stopMic();
  const st = analyse(txt.value, S.speechSecs || 0);
  if (!st) { err.textContent = txt.value.trim() ? 'A bit more, please: 30 words or more makes a Wrapped.' : 'Nothing yet. Talk for a minute, or paste something you wrote.'; txt.focus(); return; }
  setYours(st); own.hidden = true;
  track('wrapped_own_made', { src: S.speechSecs ? 'mic' : 'paste', words: st.n });
};
}

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, micOn = false, t0 = 0, tick = 0, base = '';
if (own) {
  if (!SR) { mic.disabled = true; micT.textContent = 'This browser can’t transcribe. Paste instead.'; }
  mic.onclick = () => (micOn ? stopMic() : startMic());
  txt.addEventListener('input', () => { if (!micOn && !txt.value.trim()) S.speechSecs = 0; });
}
function startMic() {
  if (!SR) return;
  rec = new SR(); rec.continuous = true; rec.interimResults = true; rec.lang = navigator.language || 'en-IN';
  base = txt.value.trim() ? txt.value.trim() + ' ' : '';
  let finals = '';
  rec.onstart = () => { micOn = true; t0 = performance.now(); mic.setAttribute('aria-pressed', 'true'); $('.mic__l').textContent = 'Stop'; err.textContent = ''; tick = setInterval(timer, 250); };
  rec.onresult = (e) => {
    let interim = '';
    for (let k = e.resultIndex; k < e.results.length; k++) { const t = e.results[k][0].transcript; if (e.results[k].isFinal) finals += t + ' '; else interim += t; }
    txt.value = base + finals + interim;
  };
  rec.onerror = (e) => {
    err.textContent = e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'The mic is blocked. Allow it from the address bar, or paste some text instead.'
      : e.error === 'no-speech' ? 'Didn’t hear anything. Try again, a bit closer to the mic.' : e.error === 'network' ? 'Speech recognition needs a connection here. Paste instead?' : 'The mic stopped (' + e.error + '). Paste some text instead?';
    track('wrapped_mic_error', { e: e.error });
  };
  rec.onend = () => { if (micOn) S.speechSecs = (S.speechSecs || 0) + (performance.now() - t0) / 1000; micOn = false; clearInterval(tick); mic.setAttribute('aria-pressed', 'false'); $('.mic__l').textContent = S.speechSecs > 1 ? 'Keep talking' : 'Start talking'; timer(); };
  try { rec.start(); } catch { err.textContent = 'Couldn’t start the mic. Paste instead?'; }
}
function stopMic() { if (rec && micOn) { try { rec.stop(); } catch {} } }
function timer() {
  const s = (S.speechSecs || 0) + (micOn ? (performance.now() - t0) / 1000 : 0), n = words(txt.value).length;
  if (s) micT.textContent = `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')} · ${n} words`;
}

// the counting
const words = (t) => String(t).toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’]*/gu) || [];
const FILLERS = ['you know', 'i mean', 'kind of', 'sort of', 'basically', 'literally', 'actually', 'honestly', 'like', 'um', 'uh', 'so', 'just', 'i think'];
const STOP = new Set('the a an and or but to of in on at for with is it it’s it\'s this that be are was were i you we they he she my our your me us them so just like what if then than there their have has had do does did not no yes can could would should will about from as by up out into over also very really get got go going one all more some any how when which who because think know actually basically literally even well okay oh um uh yeah i’m i\'m don’t don\'t that’s that\'s let let’s let\'s been being here make'.split(' '));
function analyse(text, secs) {
  const ws = words(text); const n = ws.length;
  if (n < 30) return null;
  const low = ' ' + ws.join(' ') + ' ';
  const fill = FILLERS.map((f) => [f, (low.match(new RegExp(' ' + f.replace(' ', ' ') + ' ', 'g')) || []).length]).filter(([, k]) => k).sort((a, b) => b[1] - a[1]);
  const freq = new Map(); ws.forEach((w) => { if (w.length > 2 && !STOP.has(w)) freq.set(w, (freq.get(w) || 0) + 1); });
  const top = [...freq].sort((a, b) => b[1] - a[1])[0] || [ws[0], 1];
  const sents = String(text).split(/(?<=[.!?])\s+|\n+/).map((s) => words(s).length).filter(Boolean);
  const longest = Math.max(...sents), avg = n / sents.length;
  const q = (text.match(/\?/g) || []).length, ex = (text.match(/!/g) || []).length;
  const fillN = fill.reduce((a, [, k]) => a + k, 0);
  const wpm = secs > 10 ? Math.round(n / (secs / 60)) : 0;
  return { n, wpm, secs: Math.round(secs), fill: fill.slice(0, 5), fillN, top: [top[0].slice(0, 24), top[1]], longest, avg: Math.round(avg), q, ex };
}
const TYPES = [
  [(s) => s.q >= 3, 'The Interviewer', 'More questions than answers, and that’s the point.'],
  [(s) => s.fillN / s.n > 0.06, 'The Thinker-Out-Loud', 'You find the point by talking towards it. Flow would tidy the path.'],
  [(s) => s.avg > 24, 'The Long-Take Talker', 'Sentences that keep going, then land.'],
  [(s) => s.ex >= 3, 'The Hype Person', 'Exclamation marks doing a lot of work.'],
  [(s) => s.wpm > 165, 'The Speed Talker', 'Faster than anyone types. By a lot.'],
  [() => true, 'The Straight Shooter', 'Short, clean, no detours. Rare.'],
];
function yoursStory(s) {
  const ty = TYPES.find(([f]) => f(s));
  const speak = s.wpm || 130, typeMin = s.n / 40, talkMin = s.n / speak, saved = Math.max(0, typeMin - talkMin);
  const mmss = (m) => m < 1 ? Math.round(m * 60) + ' s' : Math.floor(m) + ' min ' + Math.round((m % 1) * 60) + ' s';
  const f0 = s.fill[0];
  const cards = [
    { id: 'intro', bg: 'lumen', k: 'Your Wrapped · just now', big: 'You', serif: true, unit: s.wpm ? 'said out loud, counted' : 'in writing, counted', p: `${nf(s.n)} words. Here’s what they say about how you talk.`, viz: { type: 'wave' } },
    { id: 'words', bg: 'dawn', k: 'Words', big: s.n, unit: s.wpm ? `words in ${mmss(s.secs / 60)}` : 'words', p: s.wpm ? `You talk at ${s.wpm} words a minute. One minute a day of that is ${nf(s.wpm * 365)} words a year.` : `Said out loud, that’s about ${mmss(s.n / 130)} of talking.`, note: s.wpm ? null : 'Estimate: assumes you’d say it at 130 words a minute.' },
    { id: 'saved', bg: 'fathom', k: 'Time saved vs typing', big: mmss(saved), unit: 'back, roughly', p: `Typing ${nf(s.n)} words at 40 a minute takes ${mmss(typeMin)}. Saying them, ${mmss(talkMin)}.`, note: s.wpm ? `Estimate: 40 wpm is an average typist. You talked at ${s.wpm} wpm.` : 'Estimate: 40 wpm typing, 130 wpm talking.' },
    f0 ? { id: 'filler', bg: 'glow', k: 'Most-said filler', big: `“${f0[0]}”`, serif: true, unit: f0[1] === 1 ? 'once' : `${f0[1]} times`, p: `${s.fillN} filler words in all. Flow cuts the ums and keeps your meaning.`, viz: s.fill.length > 1 ? { type: 'list', items: s.fill.map(([f, k]) => [f, k]) } : null }
       : { id: 'filler', bg: 'glow', k: 'Fillers', big: '0', unit: 'ums, likes or you-knows', p: 'Not one. Suspiciously clean. Did you write this first?' },
    { id: 'top', bg: 'signal', k: 'Your word', big: `“${s.top[0]}”`, serif: true, unit: s.top[1] === 1 ? 'said once, still the winner' : `${s.top[1]} times`, p: 'The word you leaned on most, once the little ones are taken out.' },
    { id: 'longest', bg: 'mint', k: 'Longest sentence', big: s.longest, unit: 'words without a full stop', p: s.longest > 40 ? 'That’s one breath. Respect.' : 'Neat. You let the full stops do some work.' },
    { id: 'type', bg: 'flare', k: 'Voice personality', big: ty[1], serif: true, unit: '', p: ty[2], viz: { type: 'stats', items: [['Words', nf(s.n)], ['Speed', s.wpm ? s.wpm + ' wpm' : 'typed'], ['Questions', String(s.q)], ['Fillers', String(s.fillN)]] } },
  ];
  return {
    tab: 'Yours', who: 'You · this tab', src: 'Your numbers, counted in this tab. Your words weren’t sent to sameep.ai, and the share link holds only the counts.',
    cards, share: { k: 'My Wispr Wrapped', big: nf(s.n), unit: s.wpm ? 'words, spoken' : 'words, counted', tiles: [['Time back', '~' + mmss(saved), 'fathom'], ['Top word', `“${s.top[0]}”`, 'signal'], ['Filler', f0 ? `“${f0[0]}” ×${f0[1]}` : 'none', 'glow'], ['I am', ty[1], 'vast']] },
  };
}
function setYours(st) {
  S.yours = yoursStory(st);
  S.yoursCode = btoa(unescape(encodeURIComponent(JSON.stringify(st)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  setMode('yours');
}
function readYours(code) {
  try {
    const o = JSON.parse(decodeURIComponent(escape(atob(code.replace(/-/g, '+').replace(/_/g, '/')))));
    const int = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
    const word = (v) => String(v ?? '').toLowerCase().replace(/[^\p{L}\p{N}'’ ]/gu, '').slice(0, 24);
    const st = { n: int(o.n, 1e6), wpm: int(o.wpm, 400), secs: int(o.secs, 36000), fillN: int(o.fillN, 1e5), longest: int(o.longest, 1e4), avg: int(o.avg, 1e4), q: int(o.q, 1e4), ex: int(o.ex, 1e4),
      top: [word(o.top?.[0]) || 'words', int(o.top?.[1], 1e5)], fill: (Array.isArray(o.fill) ? o.fill : []).slice(0, 5).filter((x) => FILLERS.includes(x?.[0])).map(([f, k]) => [f, int(k, 1e5)]) };
    if (st.n < 30) return null;
    S.yoursCode = code;
    return yoursStory(st);
  } catch { return null; }
}

// ---------------------------------------------------------------- go
const q = new URLSearchParams(location.search), hy = location.hash.match(/y=([\w-]+)/);
if (hy) S.yours = readYours(hy[1]);
const first = Object.keys(STORIES)[0];
const png = q.get('png') === 'all' ? ['all'] : (q.get('png') || '').match(/^(\w+):(\d+)$/);
const m0 = png && png[1] ? png[1] : q.get('m') === 'yours' ? (S.yours ? 'yours' : first) : STORIES[q.get('m')] ? q.get('m') : first;
if (png?.[0] === 'all') {
  // every card of every story as "mode n id data:image/png…" lines, for `chrome --headless --dump-dom`
  (async () => {
    const out = [];
    for (const m of Object.keys(STORIES)) {
      S.mode = m; S.data = STORIES[m]; S.list = cardsOf(S.data);
      for (let k = 0; k < S.list.length; k++) out.push(`${m} ${k + 1} ${S.list[k].id} ${(await drawPng(S.list[k])).toDataURL('image/png')}`);
    }
    document.body.replaceChildren(el('pre', { id: 'png-out' }, out.join('\n')));
  })().catch((e) => document.body.replaceChildren(el('pre', { id: 'png-out' }, 'ERROR ' + e)));
} else if (png) {
  S.mode = m0; S.data = m0 === 'yours' ? S.yours : STORIES[m0]; S.list = cardsOf(S.data);
  drawPng(S.list[Math.min(S.list.length, Math.max(1, +png[2])) - 1]).then((cv) => {
    document.body.replaceChildren(el('img', { src: cv.toDataURL('image/png'), alt: '', style: { display: 'block', width: '1080px', height: '1920px' } }));
    document.body.style.overflow = 'hidden'; document.body.style.margin = '0';
    document.title = 'ready';
  });
} else {
  setMode(m0, Math.max(0, (parseInt(q.get('c'), 10) || 1) - 1), { push: false });
  if (q.get('m') === 'yours' && !S.yours) openOwn();
  document.fonts?.ready.then(() => fitBig(cardEl));
  addEventListener('resize', () => fitBig(cardEl));
}
})();
