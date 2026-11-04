// analytics.js — who ran what, for Sameep's eyes only (sameep.ai/admin).
// track(type, data) queues an event; batches go out with sendBeacon. Fire-and-forget:
// nothing here can throw into the show or wait on the network. Stored: a random visitor id,
// the version, device class, referrer host, the page, and what was picked/played/opened. No IPs, no
// fingerprinting (the Worker adds country/city from Cloudflare). Every page on the site loads this file:
// the app, the recording, the project pages and Growth OS, so one visit spans all of them.
import { VERSION } from './version.js';
import { POWER } from './power.js';

const LIVE = /(^|\.)sameep\.ai$/.test(location.hostname);
const URL_ = LIVE ? '/api/e' : 'https://sameep.ai/api/e';
const ls = (k, v) => { try { return v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch { return null; } };
const ss = (k, v) => { try { return v === undefined ? sessionStorage.getItem(k) : sessionStorage.setItem(k, v); } catch { return null; } };
const rid = () => Math.random().toString(36).slice(2, 12) + Date.now().toString(36);

// set by the admin page on this origin, or ?notrack: Sameep's own runs don't count
const off = ls('otcv-notrack') === '1' || new URLSearchParams(location.search).has('notrack');
const vid = ls('otcv-vid') || (ls('otcv-vid', rid()), ls('otcv-vid')) || rid();
// one visit = this tab, or any tab of the site active in the last 30 min (project pages open in new tabs)
const recent = (() => { const [id, t] = String(ls('otcv-last') || '').split(':'); return id && Date.now() - Number(t) < 1_800_000 ? id : null; })();
const sid = ss('otcv-sid') || (ss('otcv-sid', recent || rid()), ss('otcv-sid')) || recent || rid();
const t0 = performance.now();
let q = [], timer = 0, seen = 0, shownAt = document.hidden ? 0 : performance.now();

function device() {
  const w = Math.min(screen.width, screen.height);
  if (!matchMedia('(pointer: coarse)').matches) return 'desktop';
  return w < 600 ? 'phone' : 'tablet';
}
function ref() {
  try { const h = new URL(document.referrer).hostname; return h && h !== location.hostname ? h : null; } catch { return null; }
}
// campaign tags from the link (utm_source/medium/campaign, or ?via= / ?ref=), kept for the rest of the tab
function utm() {
  const u = new URLSearchParams(location.search);
  const tag = [u.get('utm_source') || u.get('via') || u.get('ref'), u.get('utm_medium'), u.get('utm_campaign')].filter(Boolean).join('/').slice(0, 80);
  if (tag) ss('otcv-utm', tag);
  return tag || ss('otcv-utm') || null;
}
const meta = { vid, sid, site: LIVE ? 'live' : 'dev', version: VERSION, power: POWER, device: device(), ref: ref(), path: location.pathname.slice(0, 64),
  vp: `${innerWidth}x${innerHeight}`, lang: (navigator.language || '').slice(0, 12), utm: utm() };

function flush() {
  clearTimeout(timer); timer = 0;
  if (!q.length || off) { q = []; return; }
  const body = JSON.stringify({ ...meta, ev: q.splice(0, 40) });
  try {
    // text/plain keeps it a "simple" request: no CORS preflight from localhost
    const blob = new Blob([body], { type: 'text/plain' });
    if (!navigator.sendBeacon?.(URL_, blob)) fetch(URL_, { method: 'POST', body, keepalive: true, mode: 'no-cors' }).catch(() => {});
  } catch { /* offline, blocked, whatever: the show goes on */ }
  if (q.length) flush();
}

export function track(type, d) {
  if (off) return;
  try {
    q.push({ type, t: Date.now(), d });
    ls('otcv-last', sid + ':' + Date.now());
    if (q.length >= 20) flush();
    else timer ||= setTimeout(flush, 4000);
  } catch { /* never break the caller */ }
}

// intro scroll: report 25/50/75/100% once each
let heroMax = 0;
export function heroProgress(p) {
  const m = Math.floor(Math.min(1, p) * 4) * 25;
  if (m > heroMax) { heroMax = m; track('hero_progress', { p: m }); }
}

// time on site (visible time), sent whenever the tab goes away
function away() {
  if (shownAt) { seen += performance.now() - shownAt; shownAt = 0; }
  track('leave', { s: Math.round((performance.now() - t0) / 1000), seen: Math.round(seen / 1000) });
  flush();
}
addEventListener('visibilitychange', () => { if (document.hidden) away(); else shownAt = performance.now(); });
addEventListener('pagehide', () => { if (shownAt) away(); });

track('page', { path: meta.path });

// how fast the page came up for them (navigation timing), once it has loaded
addEventListener('load', () => setTimeout(() => {
  const n = performance.getEntriesByType?.('navigation')?.[0];
  if (n) track('perf', { ttfb: Math.round(n.responseStart), load: Math.round(n.loadEventEnd || performance.now()) });
}, 0), { once: true });

// script errors visitors hit (a broken show for a Wispr teammate is worth knowing about): message + file, 5 per page
let errs = 0;
const oops = (msg, src, line) => { if (errs++ < 5) track('error', { msg: String(msg || 'error').slice(0, 80), src: String(src || '').split('/').pop().split('?')[0].slice(0, 48), line: Number(line) || 0 }); };
addEventListener('error', (e) => { if (e.message) oops(e.message, e.filename, e.lineno); });
addEventListener('unhandledrejection', (e) => oops(e.reason?.message || e.reason, e.reason?.stack?.match(/\/([\w.-]+\.js)/)?.[1], 0));

// where a link goes: a path on this site, else the other site's host
const dest = (a) => { try { const u = new URL(a.href, location.href); return u.origin === location.origin ? u.pathname : u.hostname; } catch { return null; } };

// Watched from the outside, so the app's own files (js/app/*) need no hooks: clicks on desktop icons and
// links, windows the app opens (js/app/wm.js: section.win, named by aria-label), and the lock screen
// (js/app/era.js: .lock, .lock__user; growth-os/: .pv__team). If those class names change, update here.
let lockPick = null;
const visitor = () => { try { return JSON.parse(ls('offthecv.visitor') || 'null'); } catch { return null; } };
function loggedIn() {
  if (lockPick === 'guest') return track('login', { as: 'guest' });
  const v = visitor();
  // Wispr teammates (ids w-…) by the name they picked; an account someone made for themselves stays nameless
  if (v?.character && /^w-/.test(v.character)) track('login', { as: 'team', id: v.character, name: v.name });
  else track('login', { as: 'own' });
}
addEventListener('click', (e) => {
  const t = e.target;
  const a = t?.closest?.('a[href]');
  // "Make your own" links live in a few places (menu bar, end card, the episode): catch them all here
  if (a && /(^|\/)make\/?(\?|$)|switchboard/i.test(a.getAttribute('href'))) track('make_your_own', { from: a.className.split(' ')[0] || 'link' });
  const icon = t?.closest?.('.icon');
  if (icon) track('icon', { label: (icon.dataset.label || icon.querySelector('.icon__label')?.textContent || '').trim().slice(0, 40), to: a ? dest(a) : undefined });
  else if (a) track('link', { to: dest(a) });
  const user = t?.closest?.('.lock__user');
  if (user) lockPick = user.classList.contains('is-guest') ? 'guest' : user.classList.contains('is-add') ? null : 'pick';
  if (t?.closest?.('.pv__team button')) { lockPick = 'pick'; setTimeout(loggedIn, 0); }
}, { capture: true, passive: true });

if (!off) {
  new MutationObserver((list) => {
    for (const m of list) {
      for (const n of m.addedNodes) if (n.nodeType === 1 && n.matches('section.win')) track('window', { title: (n.getAttribute('aria-label') || '').slice(0, 40) });
      // era.js saves the pick to localStorage right after removing the lock screen, before this runs
      for (const n of m.removedNodes) if (n.nodeType === 1 && n.classList.contains('lock')) loggedIn();
    }
  }).observe(document.body, { childList: true, subtree: true });
}

// videos marked data-track="name" (the recording): play, 25/50/75%, the end
document.querySelectorAll('video[data-track]').forEach((v) => {
  const name = v.dataset.track.slice(0, 32);
  let max = 0;
  const at = (k, p) => track('video', { name, at: k, p, s: Math.round(v.currentTime) });
  v.addEventListener('play', () => at('play', max));
  v.addEventListener('timeupdate', () => {
    const p = v.duration ? Math.floor((v.currentTime / v.duration) * 4) * 25 : 0;
    if (p > max && p < 100) { max = p; at('progress', p); }
  });
  v.addEventListener('ended', () => { max = 100; at('ended', 100); });
});
