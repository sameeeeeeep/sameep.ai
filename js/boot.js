// boot.js — wires the hero (scroll story) to the app (inside the iMac).
// hero → onDone → zoom into the iMac's glass → reveal #app and mount it.
import { isWispr } from './version.js';

const heroEl = document.getElementById('hero');
const appEl = document.getElementById('app');
const params = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

const SEEN_KEY = 'offthecv.seen';
const EPISODE_URL = 'data/episode.json';
const IMAC_SRC = 'img/imac/imac-front.webp';
// Fallback glass rect inside imac-front.webp (normalized). Overridden by img/manifest.json → imac.screen.
let IMAC_SCREEN = { x: 0.362, y: 0.152, w: 0.44, h: 0.568 };
// Glass corners TL,TR,BR,BL (normalized to the image): the iMac sits at 3/4, so the glass is a quad.
let IMAC_QUAD = [[0.3559, 0.1478], [0.7558, 0.1642], [0.8019, 0.6642], [0.4049, 0.7254]];

let appModule = null;
const loadApp = () => (appModule ||= import('./app/main.js'));
let handedOff = false;
let heroApi = null;

function prefetchApp() {
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1200));
  idle(() => { loadApp().catch(() => {}); readManifest(); });
}

async function readManifest() {
  try {
    const r = await fetch('img/manifest.json', { cache: 'force-cache' });
    if (!r.ok) return;
    const m = await r.json();
    const s = m?.imac?.screen;
    if (Array.isArray(s) && s.length === 4) IMAC_SCREEN = { x: s[0], y: s[1], w: s[2], h: s[3] };
    else if (s && typeof s.x === 'number') IMAC_SCREEN = s;
    const q = m?.imac?.screenQuad;
    if (Array.isArray(q) && q.length === 4) IMAC_QUAD = q;
  } catch { /* no manifest yet */ }
}

// ---------------------------------------------------------------- handoff
async function handoff(info = {}) {
  if (handedOff) return;
  handedOff = true;
  store.set(SEEN_KEY, '1');
  const modP = loadApp();

  if (!reduced && !info.instant) {
    await zoomIntoScreen(info.screenRect, info.imageRect).catch(() => {});
  }
  heroEl.hidden = true;
  heroEl.setAttribute('aria-hidden', 'true');
  // free the hero's GPU work before the app's CRT starts (one WebGL scene at a time)
  try { heroApi?.destroy?.(); } catch (e) { console.warn('[boot] hero destroy', e); }
  heroApi = null;
  document.documentElement.classList.add('in-app');
  window.scrollTo(0, 0);
  appEl.hidden = false;

  // the CRT boot runs inside #app: lift the zoom overlay off it once the tube has painted
  // (mountApp only resolves after boot + dial-up, far too late to keep the overlay up)
  const lift = () => {
    const layer = document.querySelector('.boot-zoom');
    if (!layer) return;
    layer.style.transition = 'opacity .35s ease-out';
    layer.style.opacity = '0';
    setTimeout(() => layer.remove(), 420);
  };
  try {
    const { mountApp } = await modP;
    const mounted = mountApp(appEl, { episodeUrl: EPISODE_URL });
    await nextFrame(); await wait(120); lift();
    await mounted;
  } catch (err) {
    console.error('[boot] app failed to mount', err);
    appEl.innerHTML = '<div class="boot-fail"><p>The disc skipped. <a href="./?skip">Try again</a></p></div>';
  }
  document.querySelector('.boot-zoom')?.remove();
}

function containRect(imgW, imgH) {
  const vw = innerWidth, vh = innerHeight;
  const s = Math.min(vw / imgW, vh / imgH);
  const w = imgW * s, h = imgH * s;
  return { x: (vw - w) / 2, y: (vh - h) / 2, w, h };
}

function loadImg(src) {
  return new Promise((res) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
}

// The zoom: an overlay with the same iMac front image the hero ends on. If the
// hero tells us exactly where the glass is, we line our image up with it so the
// crossfade is invisible; then the glass grows until it fills the viewport.
async function zoomIntoScreen(screenRect, imageRect) {
  const im = await loadImg(IMAC_SRC);
  const layer = document.createElement('div');
  layer.className = 'boot-zoom';
  const stage = document.createElement('div');
  stage.className = 'boot-zoom__stage';
  layer.append(stage);

  let base; // rect of the whole iMac image in viewport px
  const iw = im?.naturalWidth || 1600, ih = im?.naturalHeight || 1400;
  if (imageRect && imageRect.width > 0) {
    // the hero told us exactly where its iMac image sits: match it pixel for pixel
    base = { x: imageRect.left, y: imageRect.top, w: imageRect.width, h: imageRect.height };
    if (screenRect && screenRect.width > 0) {
      IMAC_SCREEN = { x: (screenRect.left - base.x) / base.w, y: (screenRect.top - base.y) / base.h, w: screenRect.width / base.w, h: screenRect.height / base.h };
    }
  } else if (screenRect && screenRect.width > 0) {
    const w = screenRect.width / IMAC_SCREEN.w;
    const h = w * (ih / iw);
    base = { x: screenRect.left - IMAC_SCREEN.x * w, y: screenRect.top - IMAC_SCREEN.y * h, w, h };
  } else {
    base = containRect(iw, ih);
  }
  Object.assign(stage.style, { left: base.x + 'px', top: base.y + 'px', width: base.w + 'px', height: base.h + 'px' });
  if (im) { im.className = 'boot-zoom__imac'; im.alt = ''; stage.append(im); }
  else stage.classList.add('boot-zoom__stage--drawn');

  const glass = document.createElement('div');
  glass.className = 'boot-zoom__glass';
  Object.assign(glass.style, {
    left: IMAC_SCREEN.x * 100 + '%', top: IMAC_SCREEN.y * 100 + '%',
    width: IMAC_SCREEN.w * 100 + '%', height: IMAC_SCREEN.h * 100 + '%',
  });
  // clip the dark glass to the perspective quad so it never spills over the bezel
  const qx = IMAC_QUAD.map((c) => c[0]), qy = IMAC_QUAD.map((c) => c[1]);
  const bx = Math.min(...qx), by = Math.min(...qy), bw = Math.max(...qx) - bx, bh = Math.max(...qy) - by;
  glass.style.clipPath = 'polygon(' + IMAC_QUAD.map(([x, y]) => `${((x - bx) / bw * 100).toFixed(2)}% ${((y - by) / bh * 100).toFixed(2)}%`).join(', ') + ')';
  stage.append(glass);
  document.body.append(layer);

  // 1. crossfade in over the hero's last frame (identical image → invisible)
  await nextFrame();
  layer.classList.add('is-on');
  await wait(screenRect ? 120 : 420);

  // 2. the glass powers on: a thin phosphor line opens to a full raster
  glass.classList.add('is-power');
  await wait(380);

  // 3. dolly into the glass until it covers the viewport
  const gx = base.x + IMAC_SCREEN.x * base.w, gy = base.y + IMAC_SCREEN.y * base.h;
  const gw = IMAC_SCREEN.w * base.w, gh = IMAC_SCREEN.h * base.h;
  const s = Math.max(innerWidth / gw, innerHeight / gh) * 1.02;
  const tx = innerWidth / 2 - (gx + gw / 2) * s;
  const ty = innerHeight / 2 - (gy + gh / 2) * s;
  // as we dolly in, the glass squares up to fill the frame (no bezel corners at the end)
  glass.style.transition = 'clip-path 1.15s cubic-bezier(.7,0,.25,1)';
  glass.style.clipPath = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
  const anim = layer.animate(
    [{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${tx}px, ${ty}px) scale(${s})` }],
    { duration: 1150, easing: 'cubic-bezier(.7,0,.25,1)', fill: 'forwards' },
  );
  await anim.finished.catch(() => {});
  layer.classList.add('is-through');
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

// ---------------------------------------------------------------- hero
function placeholderHero(reason) {
  heroEl.classList.add('hero-placeholder');
  heroEl.innerHTML = `
    <div class="hp">
      <p class="hp__count">${isWispr ? '<span>2,000</span> applications' : '<span>1,000s</span> of CVs'}</p>
      <h1 class="hp__title">${isWispr ? 'Heard you got 2,000 CVs.<br>So I burned mine into a CD.' : 'No point in a CV. They’re all the same.<br>So I burned mine into a CD.'}</h1>
      <button class="hp__skip" type="button">Skip to the work</button>
    </div>`;
  heroEl.querySelector('.hp__skip').addEventListener('click', () => handoff());
  if (reason) console.info('[boot] hero placeholder:', reason);
}

// ---------------------------------------------------------------- entry gate
// A loader while the studio builds, then one click in. That click is the gesture browsers
// need for audio, so the story starts with sound on (or muted, if they pick that).
function entryGate() {
  const seen = store.get(SEEN_KEY) === '1';
  const g = document.createElement('div');
  g.className = 'gate';
  g.setAttribute('role', 'dialog');
  g.setAttribute('aria-label', 'Enter');
  g.innerHTML = `
    <div class="gate__in">
      <p class="gate__mark"><span>Sameep Rehlan</span><span class="gate__sep">/</span><span>Off the CV</span></p>
      ${isWispr ? '<p class="gate__aside">heard you got 2,000 of them…</p>' : ''}
      <h1 class="gate__title"><span class="gate__t1">CVs are</span> <span class="gate__t2">so 2025<i aria-hidden="true"></i></span></h1>
      <div class="gate__bar" aria-hidden="true"><i></i></div>
      <p class="gate__status" aria-live="polite">Setting up the studio… <span>0</span>%</p>
      <div class="gate__actions">
        <button type="button" class="gate__enter" disabled><span aria-hidden="true">▶</span> Enter <span>· sound on</span></button>
        <button type="button" class="gate__quiet" disabled>Enter muted</button>
        ${seen ? '<button type="button" class="gate__skip">Skip the intro, go to the work</button>' : ''}
      </div>
      <p class="gate__hint">Best with headphones. Scroll, swipe or use the arrow keys.</p>
    </div>`;
  document.body.append(g);
  document.documentElement.classList.add('is-gated');
  const bar = g.querySelector('.gate__bar i'), pct = g.querySelector('.gate__status span'), status = g.querySelector('.gate__status');
  let p = 0, done = false, raf = 0;
  const t0 = performance.now();
  const paint = () => {
    // creep toward 90% while loading; finish when the hero says it's ready
    const t = (performance.now() - t0) / 1000;
    const goal = done ? 100 : 90 * (1 - Math.exp(-t / 2.2));
    p += (goal - p) * (done ? 0.25 : 0.12);
    bar.style.clipPath = `inset(0 ${100 - p}% 0 0)`;
    pct.textContent = String(Math.round(p));
    if (done && p > 99.5) { bar.style.clipPath = 'none'; pct.textContent = '100'; return; }
    raf = requestAnimationFrame(paint);
  };
  raf = requestAnimationFrame(paint);
  const close = () => {
    cancelAnimationFrame(raf);
    document.documentElement.classList.remove('is-gated');
    g.classList.add('is-out');
    setTimeout(() => g.remove(), reduced ? 0 : 650);
  };
  const enter = (withSound) => {
    store.set('offthecv.muted', withSound ? '0' : '1');
    store.set('offthecv.sound', withSound ? 'on' : 'off');
    close();
    // the hero's own sound pill reflects its state; nudge it to match the choice
    setTimeout(() => {
      const pill = heroEl.querySelector('.hero-sound');
      if (pill && (pill.getAttribute('aria-pressed') === 'true') !== withSound) pill.click();
    }, 60);
  };
  g.querySelector('.gate__enter').addEventListener('click', () => enter(true));
  g.querySelector('.gate__quiet').addEventListener('click', () => enter(false));
  g.querySelector('.gate__skip')?.addEventListener('click', () => { store.set('offthecv.sound', 'on'); close(); handoff({ instant: true }); });
  return {
    ready() {
      done = true;
      status.firstChild.textContent = 'Ready. ';
      g.querySelectorAll('.gate__enter, .gate__quiet').forEach((b) => { b.disabled = false; });
      g.querySelector('.gate__enter').focus({ preventScroll: true });
    },
  };
}

async function start() {
  // Repeat visitors / ?skip go straight in.
  if (params.has('skip') || params.has('app')) {
    heroEl.hidden = true;
    return handoff({ instant: true });
  }

  const gate = entryGate();
  let mountHero = null;
  try {
    ({ mountHero } = await import('./hero/main.js'));
  } catch (e) {
    placeholderHero(e?.message);
  }
  if (typeof mountHero === 'function') {
    try {
      heroApi = await mountHero(heroEl, {
        onDone: (info) => handoff(info || {}),
        onProgress: (p) => {
          document.documentElement.style.setProperty('--hero-progress', String(p ?? 0));
          if (p > 0.6) loadApp().catch(() => {});
        },
      });
    } catch (e) {
      console.error('[boot] hero failed', e);
      heroEl.innerHTML = '';
      placeholderHero('hero threw');
    }
  }
  gate.ready();
  prefetchApp();
}

start();
