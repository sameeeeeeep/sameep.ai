// analytics.js — who ran what, for Sameep's eyes only (sameep.ai/api/admin).
// track(type, data) queues an event; batches go out with sendBeacon. Fire-and-forget:
// nothing here can throw into the show or wait on the network. Stored: a random visitor id,
// the version, device class, referrer host, and what was picked/played. No IPs, no fingerprinting.
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
const sid = ss('otcv-sid') || (ss('otcv-sid', rid()), ss('otcv-sid')) || rid();
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
const meta = { vid, sid, site: LIVE ? 'live' : 'dev', version: VERSION, power: POWER, device: device(), ref: ref() };

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

// "Make your own" links live in a few places (menu bar, end card, the episode): catch them all here
addEventListener('click', (e) => {
  const a = e.target?.closest?.('a[href]');
  if (a && /(^|\/)make\/?(\?|$)|switchboard/i.test(a.getAttribute('href'))) track('make_your_own', { from: a.className.split(' ')[0] || 'link' });
}, { capture: true, passive: true });
