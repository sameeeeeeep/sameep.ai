// subtitle.js — plain, clean subtitles: the line's text, with the word being spoken lit up
// karaoke-style from data/words.json (one [start, end] per script word, made by
// build/script-tools/words.py). No timings for a clip → plain text, no highlight.
// (The old messy → clean dictation effect is gone; `messy` stays in the JSON, unused.)
import { h, safeUrl } from './util.js';

// keep in step with TOKEN in build/script-tools/words.py
const WORD = /[\p{L}\p{N}][\p{L}\p{N}_'’.\-]*/gu;
let timesP = null;
const loadTimes = (base) => (timesP ||= fetch(safeUrl('data/words.json', base), { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));

const loops = new WeakMap(); // el → its running highlighter, so a new line always stops the old one

// text → span of text nodes and one span per script word
function wordSpans(text) {
  const out = h('span.sub__clean');
  const spans = [];
  let at = 0;
  for (const m of text.matchAll(WORD)) {
    if (!/[a-z0-9]/i.test(m[0])) continue;
    if (m.index > at) out.append(text.slice(at, m.index));
    const w = m[0].replace(/[.'’\-]+$/, ''); // a full stop or closing quote isn't lit
    const s = h('span.sub__w', w);
    spans.push(s);
    out.append(s);
    at = m.index + w.length;
  }
  if (at < text.length) out.append(text.slice(at));
  return { out, spans };
}

// index of the word at time t: the last word that has started, held through short gaps,
// dropped in a real pause (> .35 s past its end) so silence shows no highlight
function wordAt(times, t) {
  let lo = 0, hi = times.length - 1, i = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (times[m][0] <= t) { i = m; lo = m + 1; } else hi = m - 1; }
  return i >= 0 && t <= times[i][1] + 0.35 ? i : -1;
}

// media: the <audio> playing the line; clip: its path ("audio/clips/x.mp3"). The highlight only
// runs while that clip is what the element is playing (timer fallback / a swapped src → none).
export function renderSubtitle(el, { text, media, clip, base }) {
  loops.get(el)?.cancel();
  el.textContent = '';
  el.classList.remove('is-messy', 'is-cleaning');
  const { out, spans } = wordSpans(text || '');
  el.append(out);
  el.classList.add('is-clean');
  let raf = 0, dead = false, cur = -1, last = -1;
  const ctl = {
    cancel() { dead = true; cancelAnimationFrame(raf); if (loops.get(el) === ctl) loops.delete(el); },
    // top of the lit (or last lit, through a pause) word inside el's scrolled content, for the lower third's line paging
    wordTop: () => (last >= 0 ? spans[last].getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop : null),
  };
  loops.set(el, ctl);
  if (!media || !clip || !spans.length) return ctl;
  const light = (i) => {
    if (i === cur) return;
    spans[cur]?.classList.remove('is-now');
    spans[i]?.classList.add('is-now');
    cur = i;
    if (i >= 0) last = i;
  };
  const ours = () => { try { return new URL(media.currentSrc || media.src).pathname.endsWith('/' + clip); } catch { return false; } };
  loadTimes(base).then((all) => {
    const times = all[clip];
    if (dead || !times || times.length !== spans.length) return; // text and timings disagree: no highlight
    const tick = () => {
      if (dead) return;
      raf = requestAnimationFrame(tick);
      // paused keeps its word; seek / scrub just lands on a new one
      light(ours() ? wordAt(times, media.currentTime || 0) : -1);
    };
    tick();
  });
  return ctl;
}
