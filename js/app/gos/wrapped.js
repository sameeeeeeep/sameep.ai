// gos/wrapped.js — Wispr Wrapped: the pitch, then a clickable story player (tap, keys, swipe), a 1080×1920
// share card drawn to a canvas, and "try your own numbers". Words and facts come from D.MORE.wrapped.
import { h, D, head, gbox, gboxW, rich, secondOrder, store, copyBtn, download, csv, art, sound } from './kit.js';

const RM = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const nf = (n) => Math.round(Number(n) || 0).toLocaleString('en-IN');
const one = (n) => { const r = Math.round((Number(n) || 0) * 10) / 10; return r.toLocaleString('en-IN', { maximumFractionDigits: 1 }); };
const fill = (s, o) => String(s ?? '').replace(/\{(\w+)\}/g, (_, k) => (o[k] ?? ''));
const artUrl = (id) => new URL(`../../../growth-os/art/${id}.webp`, import.meta.url).href;
const hour12 = (hr) => { const x = ((Number(hr) % 24) + 24) % 24; return (x % 12 || 12) + (x < 12 ? 'am' : 'pm'); };
const num = (v, d = 0, max = 1e9) => { const n = Number(String(v ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : d; };
const APP_W = [31, 22, 17, 14, 9]; // sample shares of words for apps 1–5 (rest is "everything else")
const PAL = { lumen: '#ffffeb', vast: '#1a1a1a', paper: '#fffdf9', fathom: '#034f46', dawn: '#f0d7ff', signal: '#ffbcf2', glow: '#ffa946', flare: '#ff6c4c', pulse: '#7f1c34', mint: '#cfe8dc', mute: '#5d5d52' };

// numbers → everything a card needs
function crunch(v, F) {
  const words = Math.max(1, num(v.words, 1));
  const avg = Math.max(40, num(v.avgWpm, 140, 400));
  const typedH = words / F.typeWpm / 60, spokenH = words / avg / 60, savedH = Math.max(0, typedH - spokenH);
  const apps = String(v.apps || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 5);
  const fast = num(v.fastestWpm, 0, 600), diff = fast - F.blackburnWpm;
  const hin = Math.min(100, num(v.hinglish, 0, 100)), hindi = Math.min(4, 100 - hin);
  const S = {
    ...v, typeWpm: F.typeWpm, gitaN: F.gitaVerses, words, avg, typedH, spokenH, savedH, apps: apps.length ? apps : ['WhatsApp'], fast, diff, hin, hindi, eng: 100 - hin - hindi,
    hp: one(words / F.hpWords), comm: (words / F.talkWpm / 60) < 10 ? one(words / F.talkWpm / 60) : nf(words / F.talkWpm / 60), raj: one((savedH * 60) / F.rajdhaniMin),
    emailX: one(num(v.emailWords) / F.emailBest), peak: hour12(num(v.peakHour, 23, 23)),
  };
  // the Flow type: first rule that fits
  S.typeId = S.lateNights >= 14 ? 'late' : fast >= 190 ? 'fast' : hin >= 30 ? 'hinglish' : num(v.emailWords) >= 400 ? 'email' : 'steady';
  return S;
}

function phrasesFor(S) {
  return { ...S, name: S.name || 'You', year: S.year || new Date().getFullYear(), app1: S.apps[0], app3: S.apps[2] || S.apps[S.apps.length - 1],
    day: S.fastestDay || 'One day', diff: nf(Math.abs(S.diff)), top: S.topHinglish || 'basically', count: nf(S.lateCount), x: S.emailX, streak: nf(S.streak),
    typed: one(S.typedH), spoken: one(S.spokenH), raj: S.raj, hp: S.hp, comm: S.comm, gita: nf(S.gitaN) };
}

// count up a number (skipped with reduced motion)
function odo(el, to, fmt = nf, ms = 1200) {
  el.textContent = fmt(to);
  if (RM()) return;
  const t0 = performance.now();
  const step = (t) => { if (!el.isConnected) return; const p = Math.min(1, (t - t0) / ms); el.textContent = fmt(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

// shrink big type until it fits its box
function fit(card) {
  card.querySelectorAll('.wr-huge, .wr-t, .wr-share__big, .wr-tile__v').forEach((el) => {
    el.style.fontSize = '';
    let fs = parseFloat(getComputedStyle(el).fontSize), n = 0;
    while (el.scrollWidth > el.clientWidth + 1 && fs > 12 && n++ < 40) { fs *= 0.92; el.style.fontSize = fs + 'px'; }
  });
}

const r = (d, ...kids) => h('div.wr-r', { style: { '--d': d + 's' } }, ...kids); // a line that rises in
const bg = (id) => { const img = h('img.wr-art', { src: artUrl(id), alt: '', 'aria-hidden': 'true', loading: 'lazy', onload: () => img.classList.add('is-in'), onerror: () => img.remove() }); return img; };
// inline SVG has to be parsed, not built with createElement
const svgBox = (cls, vb, inner) => { const d = h('div.' + cls, { 'aria-hidden': 'true' }); d.innerHTML = `<svg viewBox="${vb}" preserveAspectRatio="xMidYMid meet">${inner}</svg>`; return d; };
const bars = () => h('div.wr-bars', { 'aria-hidden': 'true' }, [6, 14, 18, 10, 4].map((x, i) => h('i', { style: { '--h': x, '--i': i } })));

// ---- the cards
function buildCards(S, T, F, api) {
  const P = phrasesFor(S);
  const L = [];
  const add = (id, label, dur, body, run) => L.push({ id, label, dur, body, run });
  const src = (t) => t ? h('p.wr-src', rich(t)) : null;
  const huge = (val, fmt = nf) => { const el = h('div.wr-huge', fmt(val)); return { el, run: () => odo(el, val, fmt) }; };

  // 1 intro
  add('intro', 'Intro', 6500, () => {
    const t = fill(T.intro.t, P), i = t.indexOf(P.name);
    return [bg('wrapped-desk'), h('div.wr-blob.wr-blob--a'), h('div.wr-blob.wr-blob--b'), bars(), h('div.wr-push'),
      r(0.2, h('p.wr-k', T.intro.k)),
      r(0.35, h('h2.wr-t.wr-t--xl', i >= 0 ? [t.slice(0, i), h('em', P.name), t.slice(i + P.name.length)] : t)),
      r(0.6, h('p.wr-p', T.intro.p)), r(0.8, h('p.wr-foot', 'Tap or press → to start'))];
  });

  // 2 quiz
  add('quiz', 'Quiz', 14000, () => {
    const w = S.words, opts = [Math.round(w * 0.35 / 100) * 100, w, Math.round(w * 2.6 / 100) * 100];
    const order = [opts[0], opts[2], opts[1]];
    const msg = h('p.wr-p.wr-quiz__msg', { 'aria-live': 'polite' });
    const box = h('div.wr-opts', order.map((o) => h('button.wr-opt', { type: 'button', onclick: (e) => {
      e.stopPropagation();
      if (box.classList.contains('is-done')) return;
      box.classList.add('is-done');
      box.querySelectorAll('.wr-opt').forEach((b) => b.classList.add(Number(b.dataset.v) === w ? 'is-right' : 'is-wrong'));
      msg.textContent = o === w ? T.quiz.right : T.quiz.wrong;
      sound.tick('click');
      setTimeout(() => api.nextIf('quiz'), 1500);
    }, dataset: { v: o } }, nf(o) + ' words')));
    return [h('div.wr-q', { 'aria-hidden': 'true' }, '?'), h('div.wr-push'), r(0.1, h('p.wr-k', T.quiz.k)), r(0.25, h('h2.wr-t', T.quiz.t)), r(0.45, box), msg];
  });

  // 3 words
  { const n = huge(S.words); add('words', 'Words', 8000, () => [bg('wrapped-books'), h('div.wr-stack', { 'aria-hidden': 'true' }, Array.from({ length: Math.min(8, Math.max(1, Math.ceil(S.words / F.hpWords))) }, (_, i) => h('i', { style: { '--i': i } }))), h('div.wr-push'),
    r(0.1, h('p.wr-k', T.words.k)), r(0.2, n.el), r(0.35, h('p.wr-unit', T.words.unit)),
    r(0.6, h('p.wr-p', fill(T.words.p, P))), r(0.8, h('p.wr-p.wr-p--sm', fill(T.words.p2, P))), r(1, src(T.words.src))], n.run); }

  // 4 time saved
  { const n = huge(S.savedH, (x) => nf(x)); add('saved', 'Time saved', 8500, () => [bg('wrapped-train'), h('div.wr-rail', { 'aria-hidden': 'true' }, h('div.wr-train', h('i'), h('i'), h('i'))), h('div.wr-push'),
    r(0.1, h('p.wr-k', T.saved.k)), r(0.2, n.el), r(0.35, h('p.wr-unit', T.saved.unit)),
    r(0.6, h('p.wr-p', fill(T.saved.p, P))), r(0.8, h('p.wr-p.wr-p--sm', fill(T.saved.p2, P))), r(1, src(T.saved.src))], n.run); }

  // 5 apps
  add('apps', 'Top apps', 8000, () => {
    const max = APP_W[0];
    return [h('div.wr-push'), r(0.1, h('p.wr-k', T.apps.k)), r(0.2, h('h2.wr-t', fill(T.apps.t, P))),
      h('ol.wr-apps', S.apps.map((a, i) => h('li', { style: { '--d': (0.4 + i * 0.15) + 's', '--w': (APP_W[i] / max * 100) + '%' } },
        h('span.wr-apps__n', String(i + 1)), h('span.wr-apps__a', a), h('span.wr-apps__bar', h('i')), h('span.wr-apps__v', APP_W[i] + '%')))),
      r(1.3, h('p.wr-p', fill(T.apps.p, P)))];
  });

  // 6 fastest day
  { const n = huge(S.fast); add('fastest', 'Fastest day', 8000, () => {
    const ang = Math.min(1, S.fast / 260) * 180 - 90;
    return [svgBox('wr-gauge', '0 0 200 110', `<path d="M15 100 A85 85 0 0 1 185 100" fill="none" stroke="rgba(26,26,26,.18)" stroke-width="14" stroke-linecap="round"/><path class="wr-gauge__arc" pathLength="1" d="M15 100 A85 85 0 0 1 185 100" fill="none" stroke="${PAL.vast}" stroke-width="14" stroke-linecap="round" style="--p:${Math.min(1, S.fast / 260)}"/><g class="wr-gauge__needle" style="--a:${ang}deg"><line x1="100" y1="100" x2="100" y2="30" stroke="${PAL.flare}" stroke-width="5" stroke-linecap="round"/></g><circle cx="100" cy="100" r="9" fill="${PAL.vast}"/>`),
      h('div.wr-push'), r(0.1, h('p.wr-k', T.fastest.k)), r(0.2, n.el), r(0.35, h('p.wr-unit', T.fastest.unit)),
      r(0.6, h('p.wr-p', fill(T.fastest.p, P), ' ', fill(S.diff >= 0 ? T.fastest.p2Over : T.fastest.p2Under, P))), r(0.9, src(T.fastest.src))];
  }, n.run); }

  // 7 hinglish
  { const n = huge(S.hin, (x) => Math.round(x) + '%'); add('hinglish', 'Hinglish', 8000, () => [
    h('div.wr-chips', { 'aria-hidden': 'true' }, (T.hinglish.chips || []).map((c, i) => h('span', { style: { '--i': i } }, c))), h('div.wr-push'),
    r(0.1, h('p.wr-k', T.hinglish.k)), r(0.2, n.el), r(0.35, h('p.wr-unit', T.hinglish.unit)),
    r(0.5, h('div.wr-split', { role: 'img', 'aria-label': `English ${S.eng}%, Hinglish ${S.hin}%, Hindi ${S.hindi}%` },
      h('i.wr-split__en', { style: { flexGrow: S.eng } }, S.eng >= 12 ? 'English' : ''), h('i.wr-split__hi', { style: { flexGrow: S.hin } }, S.hin >= 12 ? 'Hinglish' : ''), S.hindi ? h('i.wr-split__hd', { style: { flexGrow: S.hindi } }) : null)),
    r(0.7, h('p.wr-p', fill(T.hinglish.p, P))), r(0.9, src(T.hinglish.src))], n.run); }

  // 8 after 11pm
  { const n = huge(num(S.lateNights)); add('late', 'Late nights', 8000, () => [bg('wrapped-night'), h('div.wr-moon', { 'aria-hidden': 'true' }),
    svgBox('wr-clock', '0 0 100 100', `<circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,235,.35)" stroke-width="2"/>${Array.from({ length: 12 }, (_, i) => `<line x1="50" y1="9" x2="50" y2="${i % 3 ? 13 : 16}" stroke="rgba(255,255,235,.6)" stroke-width="2" transform="rotate(${i * 30} 50 50)"/>`).join('')}<line class="wr-clock__h" x1="50" y1="50" x2="50" y2="28" stroke="${PAL.glow}" stroke-width="4" stroke-linecap="round"/><line class="wr-clock__m" x1="50" y1="50" x2="50" y2="16" stroke="${PAL.lumen}" stroke-width="2.5" stroke-linecap="round"/>`),
    h('div.wr-push'), r(0.1, h('p.wr-k', T.late.k)), r(0.2, n.el), r(0.35, h('p.wr-unit', T.late.unit)),
    r(0.6, h('p.wr-p', fill(T.late.p, P))), r(0.9, src(T.late.src))], n.run); }

  // 9 the email you didn't type
  { const n = huge(num(S.emailWords)); add('email', 'The email', 8500, () => [
    h('div.wr-mail', { 'aria-hidden': 'true' }, h('div.wr-mail__bar', h('i'), h('i'), h('i')),
      h('p.wr-mail__row', h('b', 'To'), ' ', S.emailTo || '…'), h('p.wr-mail__row', h('b', 'Subject'), ' ', S.emailSubject || 'Re: Re:'),
      h('div.wr-mail__lines', Array.from({ length: 9 }, (_, i) => h('i', { style: { '--i': i, width: (60 + ((i * 37) % 38)) + '%' } }))),
      h('span.wr-mail__badge', nf(S.emailWords) + ' words')),
    h('div.wr-push'), r(0.1, h('p.wr-k', T.email.k)), r(0.2, n.el), r(0.35, h('p.wr-unit', T.email.unit)),
    r(0.6, h('p.wr-p', fill(T.email.p, P))), r(0.9, src(T.email.src))], n.run); }

  // 10 Flow type
  add('type', 'Your Flow type', 8000, () => {
    const ty = (T.types || []).find((x) => x.id === S.typeId) || (T.types || [])[0] || { t: '', p: '' };
    return [h('div.wr-confetti', { 'aria-hidden': 'true' }, Array.from({ length: 28 }, (_, i) => h('i', { style: { '--i': i, '--x': ((i * 37) % 100) + '%', '--c': [PAL.signal, PAL.glow, PAL.dawn, PAL.lumen][i % 4] } }))),
      h('div.wr-push'), r(0.1, h('p.wr-k', T.type.k)), r(0.25, h('h2.wr-t.wr-t--xl', h('em', ty.t))), r(0.5, h('p.wr-p', ty.p)),
      r(0.8, h('dl.wr-stats', (T.type.stats || []).map(([k, v]) => h('div', h('dt', k), h('dd', fill(v, P))))))];
  });

  // 11 share card
  add('share', 'Share card', 0, () => [shareHtml(S, T, P, api.isSample()), h('div.wr-share__btns', h('button.wr-btn.wr-btn--primary', { type: 'button', onclick: (e) => { e.stopPropagation(); api.download(); } }, 'Download card'), h('button.wr-btn', { type: 'button', onclick: (e) => { e.stopPropagation(); api.openMine(); } }, 'Try your own numbers'))]);
  return L;
}

function tilesFor(S, T, P) {
  const ty = (T.types || []).find((x) => x.id === S.typeId) || { t: '' };
  return [
    { k: 'Hours saved', v: nf(S.savedH), s: 'vs typing at ' + S.typeWpm + ' wpm', bg: PAL.fathom, fg: PAL.lumen },
    { k: 'Top app', v: S.apps[0], s: APP_W[0] + '% of my words', bg: PAL.dawn, fg: PAL.vast },
    { k: 'Fastest day', v: nf(S.fast), s: 'words a minute', bg: PAL.signal, fg: PAL.vast },
    { k: 'Hinglish', v: S.hin + '%', s: '"' + (S.topHinglish || 'basically') + '", mostly', bg: PAL.glow, fg: PAL.vast },
    { k: 'My Flow type', v: ty.t, s: nf(S.streak) + '-day streak', bg: PAL.vast, fg: PAL.lumen, wide: true },
  ];
}
function shareHtml(S, T, P, isSample) {
  return h('div.wr-share',
    h('div.wr-share__top', h('span.wr-share__logo', bars(), 'Flow'), isSample ? h('span.wr-share__tag', 'Sample year') : null),
    h('p.wr-share__k', fill(T.share.k, P)),
    h('div.wr-share__big', nf(S.words)), h('p.wr-share__unit', 'words, ', h('em', 'spoken')),
    h('div.wr-share__grid', tilesFor(S, T, P).map((t) => h('div.wr-tile' + (t.wide ? '.wr-tile--wide' : ''), { style: { background: t.bg, color: t.fg } }, h('span.wr-tile__k', t.k), h('span.wr-tile__v', t.v), h('span.wr-tile__s', t.s)))),
    h('p.wr-share__cta', T.share.cta), h('p.wr-share__foot', T.share.foot));
}

// ---- the 1080×1920 PNG
function rrect(c, x, y, w, hh, rad) { c.beginPath(); c.moveTo(x + rad, y); c.arcTo(x + w, y, x + w, y + hh, rad); c.arcTo(x + w, y + hh, x, y + hh, rad); c.arcTo(x, y + hh, x, y, rad); c.arcTo(x, y, x + w, y, rad); c.closePath(); }
function fitText(c, text, font, size, maxW, min = 24) { let s = size; do { c.font = font.replace('{s}', s); if (c.measureText(text).width <= maxW) break; s -= 4; } while (s > min); return s; }
async function drawCard(S, T, P, isSample) {
  try { await Promise.all(['400 200px "EB Garamond"', 'italic 400 90px "EB Garamond"', '600 40px Figtree', '400 30px Figtree'].map((f) => document.fonts.load(f))); } catch { /* system fonts then */ }
  const W = 1080, H = 1920, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d'), serif = '"EB Garamond", Georgia, serif', sans = 'Figtree, system-ui, sans-serif';
  c.fillStyle = PAL.lumen; c.fillRect(0, 0, W, H);
  c.fillStyle = PAL.dawn; c.beginPath(); c.arc(980, 260, 260, 0, Math.PI * 2); c.fill();
  // logo bars + name
  c.fillStyle = PAL.vast; [12, 28, 36, 20, 8].forEach((bh, i) => { rrect(c, 80 + i * 18, 120 - bh, 11, bh * 2, 5.5); c.fill(); });
  c.font = `600 48px ${sans}`; c.textBaseline = 'middle'; c.fillText('Flow', 186, 122);
  if (isSample) { c.font = `600 30px ${sans}`; const tw = c.measureText('SAMPLE YEAR').width; c.fillStyle = '#fff0d9'; rrect(c, W - 80 - tw - 48, 92, tw + 48, 60, 30); c.fill(); c.fillStyle = '#7a4b00'; c.fillText('SAMPLE YEAR', W - 80 - tw - 24, 123); }
  c.textBaseline = 'alphabetic'; c.fillStyle = PAL.mute; c.font = `500 40px ${sans}`; c.fillText(fill(T.share.k, P), 80, 300);
  c.fillStyle = PAL.vast; const bs = fitText(c, nf(S.words), `400 {s}px ${serif}`, 250, W - 160); c.font = `400 ${bs}px ${serif}`; c.fillText(nf(S.words), 72, 520);
  c.font = `400 84px ${serif}`; c.fillText('words, ', 80, 630); const ww = c.measureText('words, ').width; c.font = `italic 400 84px ${serif}`; c.fillText('spoken', 80 + ww, 630);
  // tiles
  const tiles = tilesFor(S, T, P), gx = 80, gw = (W - 160 - 24) / 2, th = 290;
  tiles.forEach((t, i) => {
    const col = t.wide ? 0 : i % 2, row = Math.floor(i / 2), x = gx + col * (gw + 24), y = 700 + row * (th + 24), w = t.wide ? W - 160 : gw;
    c.fillStyle = t.bg; rrect(c, x, y, w, th, 36); c.fill();
    if (t.wide) { c.fillStyle = PAL.flare; c.beginPath(); c.arc(x + w - 70, y + 70, 22, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = t.fg; c.font = `600 32px ${sans}`; c.globalAlpha = 0.8; c.fillText(t.k.toUpperCase(), x + 36, y + 64); c.globalAlpha = 1;
    const vs = fitText(c, t.v, `400 {s}px ${serif}`, t.wide ? 96 : 110, w - 72); c.font = `400 ${vs}px ${serif}`; c.fillText(t.v, x + 34, y + 186);
    c.font = `400 30px ${sans}`; c.globalAlpha = 0.85; c.fillText(t.s, x + 36, y + 246); c.globalAlpha = 1;
  });
  c.fillStyle = PAL.vast; c.font = `600 38px ${sans}`; c.fillText(T.share.cta, 80, 1730);
  c.fillStyle = PAL.mute; c.font = `400 32px ${sans}`; c.fillText(T.share.foot + (isSample ? ' · numbers are made up' : ''), 80, 1800);
  return cv;
}

// ---- the player
function player(W) {
  const T = W.story, F = W.facts;
  const mine = store('wrapped-mine', { on: false, v: {} });
  const isSample = () => !mine.v.on;
  const data = () => (mine.v.on ? { ...W.sample, ...mine.v.v } : W.sample);
  let S, list = [], idx = 0, elapsed = 0, t0 = 0, paused = RM(), held = false, holdT = 0, down = null;

  const barsEl = h('div.wr-prog');
  const stage = h('div.wr-cards');
  const badge = h('span.wr-badge');
  const phone = h('div.wr-phone', { tabindex: '0', role: 'region', 'aria-roledescription': 'story', 'aria-label': 'Wispr Wrapped story. Left and right arrow keys move between cards, space pauses.' },
    barsEl, h('div.wr-top', h('span.wr-top__logo', bars(), 'Wispr Wrapped'), badge), stage);
  const pauseBtn = h('button.btn.btn--sm', { type: 'button', onclick: () => togglePause() });
  const panel = minePanel();
  const banner = h('p.wr-banner');

  function api() { return { nextIf: (id) => { if (list[idx]?.id === id) go(idx + 1); }, isSample, download: dl, openMine: () => { panel.open = true; panel.scrollIntoView({ behavior: RM() ? 'auto' : 'smooth', block: 'nearest' }); panel.querySelector('input')?.focus({ preventScroll: true }); } }; }

  function load() {
    S = crunch(data(), F);
    list = buildCards(S, T, F, api());
    badge.replaceChildren(isSample() ? h('span.tag.tag--sample', { title: 'Made-up numbers to show the format. Real numbers need Wispr data.' }, 'Sample year') : h('span.tag.tag--real', 'Your numbers'));
    banner.replaceChildren(h('b', isSample() ? 'Sample year. ' : 'Your numbers. '), isSample() ? 'Every number in this story is made up to show the format; the comparisons use real public figures (linked on each card). Real numbers need Wispr data.' : 'Typed in by you, kept in this browser only.');
    barsEl.replaceChildren(...list.map((c, i) => h('button.wr-prog__b', { type: 'button', 'aria-label': `Card ${i + 1}: ${c.label}`, onclick: (e) => { e.stopPropagation(); go(i); } }, h('i'))));
    idx = -1; go(0, true);
  }
  function go(i, quiet) {
    i = Math.max(0, Math.min(list.length - 1, i));
    const c = list[i], prev = idx; idx = i;
    const el = h('section.wr-card.wr-card--' + c.id, { 'aria-label': `${i + 1} of ${list.length}: ${c.label}` }, ...[].concat(c.body()));
    el.querySelectorAll('a').forEach((a) => a.addEventListener('pointerup', (e) => e.stopPropagation()));
    el.classList.toggle('is-back', prev > i);
    stage.replaceChildren(el);
    requestAnimationFrame(() => { fit(el); el.classList.add('is-on'); c.run?.(); });
    [...barsEl.children].forEach((b, j) => { b.firstChild.style.width = j < idx ? '100%' : '0%'; b.setAttribute('aria-current', String(j === idx)); });
    elapsed = 0; t0 = performance.now();
    if (!quiet) sound.tick('click');
  }
  function togglePause(v = !paused) { paused = v; pauseBtn.textContent = paused ? 'Play' : 'Pause'; }
  function tick(now) {
    if (phone.isConnected) { seen = true; away = 0; } else if (seen || ++away > 900) return; // module closed: stop
    const c = list[idx];
    if (c && c.dur && !paused && !held && !document.hidden) {
      elapsed += now - t0;
      if (elapsed >= c.dur) { if (idx < list.length - 1) go(idx + 1, true); else elapsed = c.dur; }
    }
    t0 = now;
    const b = barsEl.children[idx]; if (b && c) b.firstChild.style.width = (c.dur ? Math.min(100, elapsed / c.dur * 100) : 100) + '%';
    requestAnimationFrame(tick);
  }
  let started = false, seen = false, away = 0;
  const kick = () => { if (!started) { started = true; t0 = performance.now(); requestAnimationFrame(tick); } };

  // tap left = back, right = next; hold = pause; swipe
  phone.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, a, input, textarea, select')) return;
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
    holdT = setTimeout(() => { held = true; phone.classList.add('is-held'); }, 220);
  });
  const up = (e) => {
    clearTimeout(holdT);
    const wasHeld = held; held = false; phone.classList.remove('is-held');
    if (!down || e.type !== 'pointerup') { down = null; return; }
    const dx = e.clientX - down.x, dy = e.clientY - down.y; down = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) { go(idx + (dx < 0 ? 1 : -1)); return; }
    if (wasHeld) return;
    const rc = phone.getBoundingClientRect();
    if (e.clientX - rc.left < rc.width * 0.3) go(idx - 1); else if (idx < list.length - 1) go(idx + 1); else go(0);
  };
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => phone.addEventListener(t, up));
  phone.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
    else if (e.key === ' ' && !e.target.closest('button')) { e.preventDefault(); togglePause(); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(list.length - 1); }
  });
  addEventListener('resize', () => { const el = stage.firstChild; if (el && phone.isConnected) fit(el); });

  async function dl() {
    try {
      const cv = await drawCard(S, T, phrasesFor(S), isSample());
      cv.toBlob((b) => { if (!b) return; const a = h('a', { href: URL.createObjectURL(b), download: `wispr-wrapped-${String(S.name || 'you').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${S.year}.png` }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); }, 'image/png');
    } catch (err) { console.warn('[wrapped] card failed', err); }
  }
  const caption = () => `My ${S.year} on Wispr Flow: ${nf(S.words)} words spoken, ${nf(S.savedH)} hours I didn't spend typing, ${S.hin}% Hinglish.${isSample() ? ' (Sample numbers.)' : ''}`;

  function minePanel() {
    const fields = [
      ['name', 'Name', 'text'], ['year', 'Year', 'number'], ['words', 'Words dictated this year', 'number'], ['avgWpm', 'Your usual words a minute', 'number'],
      ['apps', 'Top apps, most used first (comma separated)', 'text', true], ['fastestWpm', 'Fastest day, words a minute', 'number'], ['fastestDay', 'Which day was that', 'text'],
      ['hinglish', 'Hinglish share, %', 'number'], ['topHinglish', 'Most-said Hinglish word', 'text'], ['lateNights', 'Nights in a row after 11pm', 'number'],
      ['lateCount', 'Late-night dictations this year', 'number'], ['peakHour', 'Busiest hour (0–23)', 'number'], ['emailWords', 'Longest email, words', 'number'],
      ['emailTo', 'Who it was to', 'text'], ['emailSubject', 'Its subject', 'text'], ['longestMin', 'Longest session, minutes', 'number'], ['longestApp', 'In which app', 'text'], ['streak', 'Longest streak, days', 'number'],
    ];
    const cur = () => ({ ...W.sample, ...(mine.v.v || {}) });
    const form = h('form.form.wr-form', { onsubmit: (e) => {
      e.preventDefault();
      const v = {}; fields.forEach(([k, , t]) => { const x = form.elements[k].value.trim(); if (x !== '') v[k] = t === 'number' ? num(x) : x.slice(0, 60); });
      mine.v = { on: true, v }; mine.save(); load(); phone.focus({ preventScroll: true }); phone.scrollIntoView({ behavior: RM() ? 'auto' : 'smooth', block: 'center' });
    } },
      fields.map(([k, label, t, full]) => h('label' + (full ? '.full' : ''), label, h('input.field', { name: k, type: 'text', inputmode: t === 'number' ? 'numeric' : null, value: String(cur()[k] ?? ''), autocomplete: 'off' }))),
      h('div.form__row', h('button.btn', { type: 'button', onclick: () => { mine.v = { on: false, v: {} }; mine.save(); fields.forEach(([k]) => { form.elements[k].value = String(W.sample[k] ?? ''); }); load(); } }, 'Back to the sample'), h('button.btn.btn--primary', { type: 'submit' }, 'Play my story')));
    return h('details.wr-mine', { open: mine.v.on }, h('summary', 'Try your own numbers'), h('p.note', 'Type rough guesses; the story and the share card rebuild. Stays in this browser.'), form);
  }

  load();
  kick();
  togglePause(paused);
  const controls = h('div.wr-ctrl',
    h('button.btn.btn--sm', { type: 'button', 'aria-label': 'Previous card', onclick: () => go(idx - 1) }, '←'), pauseBtn,
    h('button.btn.btn--sm', { type: 'button', 'aria-label': 'Next card', onclick: () => go(idx + 1) }, '→'),
    h('button.btn.btn--sm', { type: 'button', onclick: () => go(0) }, 'Replay'),
    h('button.btn.btn--sm', { type: 'button', onclick: () => go(list.length - 1) }, 'Share card'));
  return h('div.wr-play', { id: 'wr-play' }, banner,
    h('div.wr-play__grid', h('div.wr-play__phone', phone, controls),
      h('div.wr-play__side',
        h('p.wr-hint', 'Tap the right side for next, left for back. Hold to pause. Swipe on a phone. Arrow keys when the story is focused.'),
        h('div.bar', h('button.btn.btn--primary', { type: 'button', onclick: dl }, 'Download card (PNG)'), copyBtn(caption, 'Copy caption')),
        panel)));
}

// ---- the pitch
function pitch(W) {
  const P = W.pitch;
  const st = store('wrapped-data', { ok: {} });
  const rows = () => P.data.map((d) => [d.k, d.d, d.have, st.v.ok[d.k] ? 'yes' : 'no']);
  const dataTbl = h('div.tbl-wrap', h('table.tbl.tbl--stack', h('thead', h('tr', h('th', 'Stat'), h('th', 'What it is'), h('th', 'Where it comes from'), h('th', 'Eng confirmed'))),
    h('tbody', P.data.map((d) => h('tr', h('td.tbl__name', { 'data-k': '' }, d.k), h('td.tbl__wide', rich(d.d)), h('td.tbl__wide.muted', rich(d.have)),
      h('td', h('label.wr-ok', h('input', { type: 'checkbox', checked: !!st.v.ok[d.k], onchange: (e) => { st.v.ok[d.k] = e.target.checked; st.save(); } }), h('span', 'Confirmed'))))))));
  const brief = () => [
    'Wispr Wrapped: New Year stats for Flow (second week of January)', '', P.lede.replace(/\s*\[\d+(?:,\s*\d+)*\]/g, ''), '',
    'Why:', ...P.why.map((x) => '- ' + x.replace(/\s*\[\d+(?:,\s*\d+)*\]/g, '')), '',
    'Data needed:', ...P.data.map((d) => `- ${d.k}: ${d.d}${st.v.ok[d.k] ? ' (eng confirmed)' : ''}`), '',
    'Privacy:', ...P.privacy.map((x) => '- ' + x.replace(/\s*\[\d+(?:,\s*\d+)*\]/g, '')), '',
    'Mechanics: ' + P.mechanics.map((x) => x.replace(/\s*\[\d+(?:,\s*\d+)*\]/g, '')).join(' → '), '',
    'KPIs:', ...P.kpis.map((k) => `- ${k.k}: ${k.d.replace(/\s*\[\d+(?:,\s*\d+)*\]/g, '')}`),
  ].join('\n');
  return [
    h('div.wr-pitch',
      h('div.wr-pitch__lede', h('p.lede', rich(P.lede)), h('div.bar', copyBtn(brief, 'Copy the brief'), h('button.btn.btn--sm', { type: 'button', onclick: () => document.getElementById('wr-play')?.scrollIntoView({ behavior: RM() ? 'auto' : 'smooth', block: 'start' }) }, 'Play the story ↓'))),
      art('wrapped-hero', 'Friends on a Bengaluru rooftop in January, comparing phones', { ratio: '4/3' })),
    gbox('Why it works for Flow', h('ul.ul', P.why.map((t) => h('li', rich(t))))),
    gboxW('Who did it first', h('div.gos-grid', P.precedents.map((p) => h('div.card', h('p.card__t', p.t), h('p.card__p', rich(p.d)))))),
    gbox('What it needs from Flow', h('p', 'Counts only. Tick a row once engineering confirms it can be computed on the device.'), dataTbl,
      h('div.bar', { style: { marginTop: '12px', marginBottom: 0 } }, h('button.btn.btn--sm', { type: 'button', onclick: () => download('wispr-wrapped-data.csv', csv([['Stat', 'What', 'Source today', 'Eng confirmed'], ...rows()])) }, 'Export CSV'))),
    h('section.brief', h('div.brief__head', h('h3.brief__t', 'Privacy rules')), h('ul.ul', P.privacy.map((t) => h('li', rich(t)))), h('p.note', rich(P.lowUsers))),
    gbox('How it spreads', h('ol.steps', P.mechanics.map((t) => h('li', rich(t))))),
    gbox('How we know it worked', h('div.kpis', P.kpis.map((k) => h('div.kpi' + (k.north ? '.kpi--north' : ''), h('span.kpi__k', k.north ? 'North star' : 'Measure'), h('span.kpi__name', k.k), h('span.kpi__d', rich(k.d)))))),
    gbox('Second-order', secondOrder(P.so)),
  ];
}

export const MODULES = [{
  id: 'wrapped', label: 'Wispr Wrapped', c: 'var(--dawn)', group: 'Plan', kicker: 'The standout idea',
  render(m) {
    const W = D.MORE?.wrapped;
    if (!W || !W.story) return [head(m, null), h('div.empty', 'Sign in as a Wispr teammate to load Wispr Wrapped.')];
    return [
      head(m, W.why),
      ...pitch(W),
      h('section.gbox.gbox--white.wr-story', h('h3.gbox__label', 'The story, clickable'), player(W)),
    ];
  },
}];
