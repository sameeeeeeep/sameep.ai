// version.js — the site is a general portfolio; ?version=wispr turns on the
// Wispr Flow hiring-challenge copy. Remembered for the tab so the hero → app
// handoff and in-site links keep it.
const KEY = 'otcv-version';
const q = new URLSearchParams(location.search).get('version');
let v = q ? q.toLowerCase() : null;
try {
  if (v) sessionStorage.setItem(KEY, v);
  else v = sessionStorage.getItem(KEY);
} catch { /* storage blocked: URL only */ }

export const VERSION = v === 'wispr' ? 'wispr' : 'default';
export const isWispr = VERSION === 'wispr';

// a line's text/audio (and, if the version has one, visual) for this version and host, honouring `h[host]` then `v` overrides
// (a host override carries its own `v` variants)
export function pick(line, host) {
  const src = (host && line.h?.[host]) || line;
  const o = src.v?.[VERSION] || {};
  return { text: o.text ?? src.text, audio: o.audio ?? src.audio, ...(o.visual !== undefined && { visual: o.visual }) }; // a version may show its own visual
}

// who hosts the podcast: ?host=<id>, else the visitor's last pick (episode.json "hosts")
const HOST_KEY = 'otcv-host';
export function savedHost() {
  const q = new URLSearchParams(location.search).get('host');
  if (q) return q.toLowerCase();
  try { return localStorage.getItem(HOST_KEY); } catch { return null; }
}
export function saveHost(id) {
  try { localStorage.setItem(HOST_KEY, id); } catch { /* storage blocked */ }
}

// lines marked only:'wispr' or only:'default' are skipped in the other version
export const shows = (line) => !line.only || line.only === VERSION;

// keep the version on in-site links
export function withVersion(url) {
  if (!isWispr) return url;
  const u = new URL(url, location.href);
  if (u.origin !== location.origin) return url;
  u.searchParams.set('version', 'wispr');
  return u.pathname + u.search + u.hash;
}

// how long the visitor wants it (episode.json "routes": short | standard | full)
const LEN_KEY = 'otcv-length';
export function savedLength() {
  try { return localStorage.getItem(LEN_KEY); } catch { return null; }
}
export function saveLength(id) {
  try { localStorage.setItem(LEN_KEY, id); } catch { /* storage blocked */ }
}
