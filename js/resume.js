// resume.js — iOS Safari throws away a heavy tab and reloads it, which used to
// drop visitors back at the entry screen minutes into the show. So the show
// writes where it is (stage, node, line, the threads already heard) as it goes,
// and a reload offers to pick up from there. Host, length and audience seat are
// already remembered by the welcome window (version.js, cast.js).
import { VERSION } from './version.js';

const KEY = 'otcv-resume';
const MAX_AGE = 3 * 60 * 60 * 1000; // older than this is a new visit, not a crash

export function readResume() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!r || Date.now() - (r.t || 0) > MAX_AGE) return null;
    return r;
  } catch { return null; }
}

function write(patch) {
  try {
    const was = readResume();
    const r = { ...(was && (was.v || 'default') === VERSION ? was : {}), ...patch, v: VERSION, t: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch { /* private mode: no resume */ }
}

// stage: 'app' once the hero and the CD are done
export const markStage = (stage) => write({ stage });
export const markLine = (node, line, visited) => write({ stage: 'app', node, line, visited: [...(visited || [])].slice(-60) });
export function clearResume() { try { localStorage.removeItem(KEY); } catch { /* noop */ } }

// should this load pick up? Not for QA links or an explicit fresh start
export function resumable() {
  const q = new URLSearchParams(location.search);
  if (['fresh', 'debug', 'node', 'timer'].some((k) => q.has(k))) return null;
  const r = readResume();
  if (r?.stage !== 'app') return null;
  // saved by the other version (sameep.ai, then the ?version=wispr link): that one starts fresh, hero and all
  if ((r.v || 'default') !== VERSION) return null;
  // "Straight back to the iMac" with no line to carry on from is only for the iOS reload it was made for;
  // a desktop visitor coming back gets the front door (and its Skip) instead
  if (!r.node && !matchMedia('(pointer: coarse)').matches) return null;
  return r;
}
