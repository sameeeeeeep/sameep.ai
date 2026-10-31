// chooser.js — what the visitor picks from: option cards (title, what you'll
// get, minutes from the real audio, tags, one "Recommended"), the audience
// avatar, the recommended-route progress and the chapter map.
import { h } from './util.js';

const isHub = (id) => /-hub$|-again$/.test(id) || id === 'hub' || id === 'hub-first';

export function mins(sec) {
  if (!sec || sec < 1) return '';
  const m = Math.max(0.5, Math.round((sec / 60) * 2) / 2);
  return (m % 1 ? m.toFixed(1) : String(m)) + ' min';
}

// Episode-wide facts the chooser needs, computed once.
export class EpisodeMap {
  constructor(ep, durations, workList = []) {
    this.ep = ep;
    this.N = ep.nodes;
    this.D = durations || {};
    this.work = workList;
    this.route = ep.route || { stops: [] };
  }

  title(id) { return this.N[id]?.title || this.N[id]?.chapter || id; }

  sec(id) {
    const d = this.D.nodes?.[id]?.sec;
    if (d) return d;
    const n = this.N[id];
    return (n?.lines || []).reduce((a, l) => a + Math.max(2.4, String(l.text || '').split(/\s+/).length * 0.36 + 0.7), 0);
  }

  // a chapter entry's recommended path (falls back to the node alone)
  chapterSec(id) { return this.D.chapters?.[id]?.routeSec || this.sec(id); }
  chapterAllSec(id) { return this.D.chapters?.[id]?.allSec || this.sec(id); }
  isChapterEntry(id) { return !!(this.ep.chapters || []).find((c) => c.to === id) && !isHub(id); }

  // the sub-options inside a chapter: what its entry (and its hub) branch to
  subs(entry) {
    const n = this.N[entry];
    if (!n) return [];
    const ch = n.chapter;
    const out = [];
    const add = (id) => { if (this.N[id] && this.N[id].chapter === ch && !isHub(id) && id !== entry && !out.includes(id)) out.push(id); };
    const from = [entry, ...(n.choices || []).map((c) => c.to).filter((t) => isHub(t) && this.N[t]?.chapter === ch)];
    if (n.next && this.N[n.next]?.chapter === ch) from.push(n.next);
    for (const f of from) {
      if (f !== entry && !isHub(f)) add(f);
      for (const c of this.N[f]?.choices || []) if (!(c.demo?.type === 'link')) add(c.to);
    }
    return out;
  }

  tags(id, deep = false) {
    const ids = deep ? [id, ...(this.D.chapters?.[id]?.route || []), ...this.subs(id)] : [id];
    const t = new Set();
    for (const nid of ids) {
      const n = this.N[nid];
      if (!n) continue;
      for (const l of n.lines || []) {
        if (l.demo && l.demo.type !== 'link') t.add('has a demo');
        if (l.demo?.type === 'link') t.add('opens a site');
        if (l.visual?.type === 'stats') t.add('has numbers');
      }
      for (const c of n.choices || []) {
        if (c.demo?.type === 'link') t.add('opens a site');
        else if (c.demo) t.add('has a demo');
      }
      const w = n.work && this.work.find((x) => x.id === n.work);
      if (w?.video) t.add('screen recording');
    }
    return ['has a demo', 'has numbers', 'screen recording', 'opens a site'].filter((x) => t.has(x));
  }

  edges(id) {
    const n = this.N[id];
    if (!n) return [];
    const out = (n.choices || []).filter((c) => c.demo?.type !== 'link').map((c) => c.to);
    if (n.next) out.push(n.next);
    return out;
  }

  dist(a, b, max = 5) {
    if (a === b) return 0;
    let frontier = [a];
    const seen = new Set([a]);
    for (let d = 1; d <= max; d++) {
      const nx = [];
      for (const x of frontier) for (const y of this.edges(x)) {
        if (y === b) return d;
        if (!seen.has(y)) { seen.add(y); nx.push(y); }
      }
      frontier = nx;
    }
    return Infinity;
  }

  nextStop(visited) { return (this.route.stops || []).find((s) => !visited.has(s)) || null; }

  // the one recommended choice index for a menu, given what's been heard
  recommended(nodeId, visited) {
    const n = this.N[nodeId];
    const ch = (n?.choices || []).map((c, i) => ({ c, i })).filter(({ c }) => c.demo?.type !== 'link');
    if (!ch.length) return -1;
    const stop = this.nextStop(visited);
    if (stop) {
      let best = null;
      for (const { c, i } of ch) {
        const d = c.to === stop ? 0 : this.dist(c.to, stop);
        if (d < Infinity && (!best || d < best.d || (d === best.d && c.recommended))) best = { d, i };
      }
      if (best && best.d <= 3) return best.i;
    }
    const st = ch.find(({ c }) => c.recommended);
    return st ? st.i : -1;
  }

  routeProgress(visited) {
    const stops = this.route.stops || [];
    const done = stops.filter((s) => visited.has(s)).length;
    const path = this.D.route?.path || [];
    const left = path.filter((p) => !visited.has(p)).reduce((a, p) => a + this.sec(p), 0);
    return { stops, done, total: stops.length, left, all: this.D.route?.sec || 0 };
  }
}

// ------------------------------------------------------------------ pieces
export function avatarEl(visitor, cls = 'aud__av') {
  const src = visitor?.photo || visitor?.character?.thumb || visitor?.character?.src;
  return h('span.' + cls, { 'aria-hidden': 'true' }, src ? h('img', { src, alt: '', width: 64, height: 64, draggable: 'false' }) : h('span.aud__blank'));
}

export function audienceEl(visitor, line) {
  const name = visitor?.name;
  return h('div.aud',
    avatarEl(visitor),
    h('p.aud__txt', h('span.aud__k', 'You, in the audience'), h('span.aud__n', name || 'Guest'), line && h('span.aud__l', line)));
}

export function routeEl(map, visited, { onJump } = {}) {
  const p = map.routeProgress(visited);
  if (!p.total) return null;
  return h('div.route', { role: 'group', 'aria-label': `Recommended route, ${p.done} of ${p.total} done` },
    h('span.route__k', 'Recommended route'),
    h('ol.route__dots', p.stops.map((s) => h('li', h('button.route__dot' + (visited.has(s) ? '.is-done' : ''), {
      type: 'button', title: map.title(s), 'aria-label': map.title(s) + (visited.has(s) ? ', heard' : ''), onclick: () => onJump?.(s),
    })))),
    h('span.route__t', p.done >= p.total ? 'done' : (p.left ? '≈ ' + mins(p.left) + ' left' : `${p.done}/${p.total}`)));
}

export function cardEl(map, choice, i, { rec, visited, current, onPick }) {
  const to = choice.to;
  const entry = map.isChapterEntry(to) && map.N[to]?.chapter !== map.N[current]?.chapter;
  const sec = entry ? map.chapterSec(to) : map.sec(to);
  const subs = entry ? map.subs(to) : [];
  const tags = map.tags(to, entry);
  const seen = visited.has(to);
  const blurb = map.N[to]?.blurb;
  return h('button.card' + (rec ? '.is-rec' : '') + (seen ? '.is-seen' : ''), { type: 'button', dataset: { i: String(i), to }, onclick: () => onPick(choice, choice.label, true) },
    rec && h('span.card__rec', 'Recommended'),
    h('span.card__head', h('span.card__t', map.title(to) || choice.label), h('span.card__min', mins(sec))),
    blurb && h('span.card__b', blurb),
    subs.length ? h('span.card__in', h('span.card__ink', 'Inside: '), subs.map((s) => map.title(s)).join(' · ')) : null,
    (tags.length || seen) && h('span.card__tags', seen && h('span.tag.tag--seen', 'heard'), tags.slice(0, seen ? 1 : 2).map((t) => h('span.tag', t))));
}

// utility choices: open links, show-here demos, back-to-menu hops
export const isUtility = (map, c) => !!c.demo || isHub(c.to);

export function chapterMap(map, { visited, currentChapter, onGo }) {
  const chapters = (map.ep.chapters || []).filter((c) => map.N[c.to]);
  const stops = new Set(map.route.stops || []);
  return chapters.map((c, idx) => {
    const ch = map.N[c.to].chapter;
    const subs = map.subs(c.to);
    const heard = [c.to, ...subs].some((s) => visited.has(s));
    const cur = ch === currentChapter;
    return h('li.cmap__ch' + (cur ? '.is-current' : '') + (heard ? '.is-visited' : ''),
      h('button.chap', { type: 'button', dataset: { to: c.to }, 'aria-current': cur ? 'true' : 'false', onclick: () => onGo(c.to) },
        h('span.chap__n', String(idx + 1).padStart(2, '0')),
        h('span.chap__t', c.label, stops.has(c.to) && h('span.chap__star', { title: 'On the recommended route', 'aria-label': ', recommended' }, ' ★')),
        h('span.chap__m', isHub(c.to) ? '' : mins(map.chapterSec(c.to)))),
      subs.length ? h('ul.cmap__subs', subs.map((s) => h('li', h('button.sub' + (visited.has(s) ? '.is-visited' : '') + (stops.has(s) ? '.is-rec' : ''), { type: 'button', dataset: { to: s }, onclick: () => onGo(s) },
        h('span.sub__t', map.title(s)), h('span.sub__m', mins(map.sec(s))))))) : null);
  });
}
