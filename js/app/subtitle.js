// subtitle.js — Wispr-style subtitles: the raw dictation appears first, then
// fillers get struck and fall away, fixes slide in, and the line settles clean.
import { h } from './util.js';

const key = (w) => w.toLowerCase().replace(/[^a-z0-9']/g, '');

// word-level LCS diff → [{w, op: 'keep'|'del'|'ins'}]
function diff(a, b) {
  const A = a.map(key), B = b.map(key);
  const n = a.length, m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    L[i][j] = A[i] && A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && A[i] && A[i] === B[j]) { out.push({ w: b[j], raw: a[i], op: 'keep' }); i++; j++; }
    else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) { out.push({ w: b[j], op: 'ins' }); j++; }
    else { out.push({ w: a[i], op: 'del' }); i++; }
  }
  return out;
}

export function renderSubtitle(el, { text, messy, reduced = false, onClean }) {
  el.textContent = '';
  el.classList.remove('is-clean', 'is-messy');
  const timers = [];
  if (!messy || reduced) {
    el.append(h('span.sub__clean', text));
    el.classList.add('is-clean');
    return { cancel() {} };
  }
  const parts = diff(messy.split(/\s+/).filter(Boolean), text.split(/\s+/).filter(Boolean));
  el.classList.add('is-messy');
  const spans = parts.map((p) => {
    const s = h('span.sw.sw--' + p.op, p.op === 'keep' ? (p.raw || p.w) : p.w);
    s.dataset.final = p.w;
    return s;
  });
  spans.forEach((s, i) => { el.append(s); if (i < spans.length - 1) el.append(' '); });

  // 1) messy words "type in" quickly, like live dictation
  const shown = spans.filter((s) => !s.classList.contains('sw--ins'));
  shown.forEach((s, i) => { s.style.opacity = '0'; timers.push(setTimeout(() => (s.style.opacity = ''), 40 + i * 55)); });
  const typed = 40 + shown.length * 55;

  // 2) clean up: strike fillers, then collapse them; slide fixes in
  timers.push(setTimeout(() => {
    el.classList.add('is-cleaning');
    spans.filter((s) => s.classList.contains('sw--del')).forEach((s, i) => timers.push(setTimeout(() => s.classList.add('is-struck'), i * 70)));
  }, typed + 450));
  timers.push(setTimeout(() => {
    spans.forEach((s) => {
      if (s.classList.contains('sw--del')) s.classList.add('is-gone');
      if (s.classList.contains('sw--ins')) s.classList.add('is-in');
      if (s.classList.contains('sw--keep')) s.textContent = s.dataset.final;
    });
  }, typed + 1100));
  timers.push(setTimeout(() => {
    // settle into plain text (collapses stray spaces left by removed words)
    el.textContent = '';
    el.append(h('span.sub__clean', text));
    el.classList.remove('is-messy', 'is-cleaning');
    el.classList.add('is-clean');
    onClean?.();
  }, typed + 1650));

  return { cancel() { timers.forEach(clearTimeout); } };
}
