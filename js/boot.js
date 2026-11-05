// boot.js — wires the hero (scroll story) to the app (inside the iMac).
// hero → onDone → zoom into the iMac's glass → reveal #app and mount it.
import { isWispr } from './version.js';
import { unlockAudio } from './unlock.js';
import { coach } from './coach.js';
import { resumable, clearResume, markStage } from './resume.js';
import './power.js';
import { track, heroProgress } from './analytics.js';

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
  track('hero_done', { how: info.resume ? 'resume' : info.instant ? 'skip' : 'scroll' });
  store.set(SEEN_KEY, '1');
  if (!info.resume) markStage('app');
  const modP = loadApp();

  if (!reduced && !info.instant) {
    await zoomIntoScreen(info.screenRect, info.imageRect).catch(() => {});
  }
  heroEl.hidden = true;
  heroEl.setAttribute('aria-hidden', 'true');
  // free the hero's GPU work before the app's CRT starts (one WebGL scene at a time)
  try { heroApi?.destroy?.(); } catch (e) { console.warn('[boot] hero destroy', e); }
  heroApi = null;
  heroEl.replaceChildren(); // drop the canvas and its backing store too (iOS counts it against the tab)
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
    const mounted = mountApp(appEl, { episodeUrl: EPISODE_URL, resume: info.resume, fast: !!info.fast });
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

// ---------------------------------------------------------------- stuck?
// A wheel, swipe or arrow that didn't move the story (iOS rubber-banding, focus stuck
// in a frame, a blocked wheel), twice: a guide with the other ways on.
const stuck = (() => {
  let p = 0, tries = 0, t = 0, shown = 0, on = false;
  const attempt = () => {
    if (!on || t || shown >= 2 || document.documentElement.classList.contains('is-gated')) return;
    const p0 = p;
    t = setTimeout(() => {
      t = 0;
      if (!on || p > 0.995) return;
      if (Math.abs(p - p0) > 0.002) { tries = 0; return; }
      if (++tries < 2) return;
      tries = 0; shown++;
      const touch = matchMedia('(pointer: coarse)').matches;
      coach.show('hero-stuck', heroEl.querySelector('.hero-cap'),
        touch ? 'Swipe up <b>once</b> and let go: one swipe, one step. Or tap <b>Skip to the work</b>.' : 'Press <b>↓</b> or <b>space</b> to step on. Or click <b>Skip to the work</b>.',
        { title: 'Stuck?', once: false, replace: true, ms: 12000 });
    }, 1300);
  };
  ['wheel', 'touchend', 'keydown'].forEach((ev) => addEventListener(ev, (e) => {
    if (ev === 'keydown' && !['ArrowDown', 'PageDown', ' ', 'ArrowUp', 'PageUp'].includes(e.key)) return;
    if (ev === 'wheel' && Math.abs(e.deltaY) < 8) return;
    attempt();
  }, { passive: true, capture: true }));
  return { progress(x) { p = x; on = !heroEl.hidden; } };
})();

// ---------------------------------------------------------------- entry gate
// A loader while the studio builds, then one click in. That click is the gesture browsers
// need for audio, so the story starts with sound on (or muted, if they pick that).
function entryGate() {
  const seen = store.get(SEEN_KEY) === '1';
  const g = document.createElement('div');
  g.className = 'gate';
  g.setAttribute('role', 'dialog');
  g.setAttribute('aria-label', 'Enter');
  // a Mac OS 9-style startup window: welcome box and progress bar
  g.innerHTML = `
    <div class="gate__in">
      <div class="gate__win">
        <img class="gate__logo" src="img/ui/offthecv.svg" alt="" width="64" height="64">
        <p class="gate__welcome">Welcome to</p>
        <p class="gate__name">Off the CV</p>
        <p class="gate__by">Sameep Rehlan</p>
        <p class="gate__status" aria-live="polite">Setting up the studio… <span>0</span>%</p>
        <div class="gate__bar" aria-hidden="true"><i></i></div>
        <div class="gate__actions">
          <button type="button" class="gate__quiet" disabled>Enter muted</button>
          <button type="button" class="gate__enter" disabled><span aria-hidden="true">▶</span> Enter <span>· sound on</span></button>
        </div>
        <p class="gate__how">${matchMedia('(pointer: coarse)').matches ? 'Best with sound on, and on a laptop. Works here too.' : 'Best with sound on.'}</p>
        ${seen ? '<button type="button" class="gate__skip">Skip the intro, go to the work →</button>' : ''}
      </div>
    </div>`;
  document.body.append(g);
  document.documentElement.classList.add('is-gated');
  const bar = g.querySelector('.gate__bar i'), pct = g.querySelector('.gate__status span'), status = g.querySelector('.gate__status');
  let p = 0, done = false, raf = 0, real = 0;
  const t0 = performance.now();
  const paint = () => {
    // real progress (the hero's build stages, then the app) with a slow creep between stages
    const t = (performance.now() - t0) / 1000;
    const goal = done ? 100 : Math.max(real * 95, Math.min(real * 95 + 12, 90 * (1 - Math.exp(-t / 3))));
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
    unlockAudio();
    track('gate_enter', { how: withSound ? 'sound' : 'muted' });
    store.set('offthecv.muted', withSound ? '0' : '1');
    store.set('offthecv.sound', withSound ? 'on' : 'off');
    close();
    // first time on a phone: say how the intro moves (desktop visitors find space / scroll themselves)
    const touch = matchMedia('(pointer: coarse)').matches;
    if (touch) setTimeout(() => coach.show('hero-scroll', heroEl.querySelector('.hero-cap'),
      '<b>Swipe up</b> to move the story along. One swipe, one step. Swipe down to go back.', { follow: false }), 1400);
    autoplayCard();
    // the hero's own sound pill reflects its state; nudge it to match the choice
    setTimeout(() => {
      const pill = heroEl.querySelector('.hero-sound');
      if (pill && (pill.getAttribute('aria-pressed') === 'true') !== withSound) pill.click();
    }, 60);
  };
  g.querySelector('.gate__enter').addEventListener('click', () => enter(true));
  // desktop: enter the way the intro moves (space or a scroll), so the gesture is learned before step one
  // (the entering press must not also count as the hero's first step, so it's stopped here; a flick's
  // inertia tail is swallowed for a moment too)
  let gateOpen = false, swallow = 0;
  const gated = () => document.documentElement.classList.contains('is-gated');
  const viaKey = (e) => {
    const scrolls = [' ', 'ArrowDown', 'PageDown', 'ArrowUp', 'PageUp', 'Home', 'End'].includes(e.key);
    if (!gateOpen) { if (scrolls && gated() && !e.target.closest?.('button')) e.preventDefault(); return; }   // still loading: nothing moves
    if (e.key !== ' ' || e.target.closest?.('button:not(.gate__enter), input, textarea')) return;
    e.preventDefault(); e.stopImmediatePropagation(); off(); enter(true);
  };
  const viaWheel = (e) => {
    if (!gateOpen) {
      if (gated() || performance.now() < swallow) { e.preventDefault(); e.stopImmediatePropagation(); }   // loading, or a flick's tail
      return;
    }
    if (e.deltaY <= 0) return;
    e.preventDefault(); e.stopImmediatePropagation(); off(); enter(true);   // a wheel isn't a gesture browsers unlock audio on: the next tap does
  };
  const off = () => {
    gateOpen = false; swallow = performance.now() + 900;
    removeEventListener('keydown', viaKey, true);
    setTimeout(() => removeEventListener('wheel', viaWheel, { capture: true }), 1000);
  };
  addEventListener('keydown', viaKey, true);
  addEventListener('wheel', viaWheel, { capture: true, passive: false });
  g.addEventListener('gate-ready', () => { gateOpen = true; });
  g.querySelectorAll('.gate__enter, .gate__quiet, .gate__skip').forEach((b) => b.addEventListener('click', off));
  g.querySelector('.gate__quiet').addEventListener('click', () => enter(false));
  g.querySelector('.gate__skip')?.addEventListener('click', () => { track('gate_enter', { how: 'skip' }); store.set('offthecv.sound', 'on'); close(); handoff({ instant: true, fast: true }); });
  return {
    progress(x) { real = Math.max(real, Math.min(1, x)); },
    ready() {
      done = true;
      status.firstChild.textContent = 'Ready. ';
      g.querySelectorAll('.gate__enter, .gate__quiet').forEach((b) => { b.disabled = false; });
      g.querySelector('.gate__enter').focus({ preventScroll: true });
      g.dispatchEvent(new Event('gate-ready'));
    },
  };
}

// ---------------------------------------------------------------- resume
// iOS reloaded the tab mid-show: one tap (the gesture audio needs) and we're back where they were
function resumeGate(r) {
  heroEl.hidden = true;
  const g = document.createElement('div');
  g.className = 'gate gate--resume';
  g.setAttribute('role', 'dialog');
  g.setAttribute('aria-label', 'Picking up where you left off');
  g.innerHTML = `
    <div class="gate__in">
      <div class="gate__win">
        <img class="gate__logo" src="img/ui/offthecv.svg" alt="" width="64" height="64">
        <p class="gate__name">Picking up where you left off</p>
        <p class="gate__by">${r.node ? 'The podcast carries on from the line you were on.' : 'Straight back to the iMac.'}</p>
        <div class="gate__actions">
          <button type="button" class="gate__enter"><span aria-hidden="true">▶</span> Carry on</button>
        </div>
        <button type="button" class="gate__skip gate__over">Start over from the pile of CVs</button>
      </div>
    </div>`;
  document.body.append(g);
  document.documentElement.classList.add('is-gated');
  const go = g.querySelector('.gate__enter');
  go.focus({ preventScroll: true });
  go.addEventListener('click', () => {
    unlockAudio();
    document.documentElement.classList.remove('is-gated');
    g.remove();
    handoff({ instant: true, resume: r });
  });
  g.querySelector('.gate__over').addEventListener('click', () => {
    clearResume();
    location.replace(location.pathname + location.search.replace(/([?&])(skip|app)\b&?/g, '$1').replace(/[?&]$/, ''));
  });
}

// "Play it for me": a card under the story that moves it one step every few seconds, so
// nobody has to scroll. Any scroll, swipe or key of their own hands control back.
function autoplayCard() {
  if (document.querySelector('.autoplay')) return;
  const el = document.createElement('div');
  el.className = 'autoplay';
  el.innerHTML = '<button type="button" class="autoplay__btn"><span class="autoplay__ico" aria-hidden="true">▶</span><span class="autoplay__t">Play it for me</span></button><span class="autoplay__or">or scroll</span>';
  document.body.append(el);
  const btn = el.querySelector('button'), label = el.querySelector('.autoplay__t'), ico = el.querySelector('.autoplay__ico');
  let timer = 0, mine = false;
  const stop = () => { clearInterval(timer); timer = 0; el.classList.remove('is-on'); ico.textContent = '▶'; label.textContent = 'Play it for me'; };
  const tick = () => {
    if (heroEl.hidden || !heroApi) { stop(); el.remove(); return; }
    mine = true; heroApi.step?.(1); setTimeout(() => { mine = false; }, 50);
  };
  btn.onclick = () => {
    coach.done('hero-scroll');
    if (!timer) track('autoplay');
    if (timer) return stop();
    el.classList.add('is-on'); ico.textContent = '❚❚'; label.textContent = 'Playing, tap to pause';
    tick(); timer = setInterval(tick, reduced ? 2400 : 3200);
  };
  const theirs = (e) => { if (timer && !mine && !el.contains(e.target)) stop(); };
  for (const t of ['wheel', 'touchstart', 'keydown']) addEventListener(t, theirs, { passive: true, capture: true });
  const gone = new MutationObserver(() => { if (heroEl.hidden) { stop(); el.remove(); gone.disconnect(); } });
  gone.observe(heroEl, { attributes: true, attributeFilter: ['hidden'] });
}

async function start() {
  // the tab was reloaded mid-show (iOS does this to heavy pages): offer to carry on
  const res = resumable();
  if (res) return resumeGate(res);

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
        onLoad: (x) => gate.progress(x * 0.85),
        onDone: (info) => handoff(info || {}),
        onProgress: (p) => {
          document.documentElement.style.setProperty('--hero-progress', String(p ?? 0));
          if (p > 0.02) coach.done('hero-scroll');
          heroProgress(p ?? 0);
          stuck.progress(p);
          if (p > 0.6) loadApp().catch(() => {});
        },
      });
    } catch (e) {
      console.error('[boot] hero failed', e);
      heroEl.innerHTML = '';
      placeholderHero('hero threw');
    }
  }
  // Enter only once everything the intro needs is built and compiled, and the app
  // module behind it is parsed: on a phone that work is seconds of main thread, and
  // doing it after Enter is what made the intro stutter. (Capped, so a stuck load never traps anyone.)
  await Promise.race([
    Promise.all([heroApi?.built, loadApp().catch(() => {}).then(() => gate.progress(0.92)), readManifest()]),
    wait(15000),
  ]);
  gate.ready();
}

start();
