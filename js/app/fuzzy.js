// fuzzy.js — match what the visitor said (dictated with Wispr Flow, typed, or
// heard by Web Speech) against choice labels + say[] keywords.

const STOP = new Set('a an the to of me about tell more please can you your i what how why on in and or is it its that this so um uh like just lets let us go do show talk with for my we our was were be'.split(' '));

export const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const toks = (s) => norm(s).split(' ').filter((t) => t && !STOP.has(t));

function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

function tokSim(q, t) {
  if (q === t) return 1;
  if (q.length >= 3 && (t.startsWith(q) || q.startsWith(t))) return 0.8;
  if (q.length >= 4 && t.length >= 4 && lev(q, t) <= (Math.min(q.length, t.length) > 6 ? 2 : 1)) return 0.7;
  return 0;
}

// score one phrase against the query (0..1+)
function phraseScore(qn, qt, phrase) {
  const pn = norm(phrase);
  if (!pn) return 0;
  if (qn === pn) return 1.2;
  let s = 0;
  if (pn.length >= 4 && qn.includes(pn)) s = Math.max(s, 1);          // they said the keyword
  if (qn.length >= 4 && pn.includes(qn)) s = Math.max(s, 0.85);       // they said part of the label
  const pt = toks(phrase);
  if (pt.length && qt.length) {
    let hit = 0;
    for (const p of pt) hit += Math.max(0, ...qt.map((q) => tokSim(q, p)));
    s = Math.max(s, (hit / pt.length) * 0.9 + Math.min(0.1, hit * 0.03));
  }
  return s;
}

// items → every item scored, best first: [{ item, score }]
export function rankMatches(query, items) {
  const qn = norm(query);
  const qt = toks(query);
  if (!qn) return [];
  return items.map((it) => {
    let s = 0;
    for (const p of it.phrases) s = Math.max(s, phraseScore(qn, qt, p));
    return { item: it, score: s * (it.weight ?? 1) };
  }).sort((a, b) => b.score - a.score);
}

// items: [{ key, phrases: [..], weight? }] → best { item, score } or null
export function bestMatch(query, items, min = 0.5) {
  const qn = norm(query);
  const qt = toks(query);
  if (!qn) return null;
  let best = null;
  for (const it of items) {
    let s = 0;
    for (const p of it.phrases) s = Math.max(s, phraseScore(qn, qt, p));
    s *= it.weight ?? 1;
    if (!best || s > best.score) best = { item: it, score: s };
  }
  return best && best.score >= min ? best : null;
}
