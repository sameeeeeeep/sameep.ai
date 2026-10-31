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

// a line's text/audio for this version, honouring `v` overrides
export function pick(line) {
  const o = line.v?.[VERSION] || {};
  return { text: o.text ?? line.text, audio: o.audio ?? line.audio };
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
