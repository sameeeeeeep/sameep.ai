// chooser.js — what the visitor picks from: option cards (title, what you'll
// get, minutes from the real audio, tags, one "Recommended"), the audience
// avatar, the recommended-route progress and the chapter map.
import { h } from './util.js';

const isHub = (id) => /-hub$|-again$/.test(id) || id === 'hub' || id === 'hub-first';
const isOutro = (id) => id === 'outro-make' || id === 'outro';

export function mins(sec) {
  if (!sec || sec < 1) return '';
  const m = Math.max(0.5, Math.round((sec / 60) * 2) / 2);
  return (m % 1 ? m.toFixed(1) : String(m)) + ' min';
}

// Episode-wide facts the chooser needs, computed once.
export class EpisodeMap {
  // routeId: the length the visitor picked (ep.routes / durations.routes); ep.route otherwise
  constructor(ep, durations, workList = [], routeId = null) {
    this.ep = ep;
    this.N = ep.nodes;
    const R = durations?.routes?.[routeId];
    this.D = R ? { ...durations, route: R } : durations || {};
    this.work = workList;
    this.route = ep.routes?.[routeId] || ep.route || { stops: [] };
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

  // the next stop on the route: after the furthest one heard (never send them
  // back to an earlier stop they skipped), else the first one not heard yet
  nextStop(visited) {
    const stops = this.route.stops || [];
    let last = -1;
    stops.forEach((s, i) => { if (visited.has(s)) last = i; });
    return stops.slice(last + 1).find((s) => !visited.has(s)) || stops.find((s) => !visited.has(s)) || null;
  }

  // Where the show goes if you do nothing. Inside a topic: its next part you haven't heard
  // (a deep dive). Topic finished: back to the menu. At the menu: the next topic not yet
  // covered, in route order. Everything covered: the ending. Taking another branch still
  // works; this only decides the countdown pick.
  target(nodeId, visited) {
    const stops = (this.route.stops || []).filter((s) => this.N[s]);
    const left = stops.filter((s) => !visited.has(s) && s !== nodeId);
    const chap = this.N[nodeId]?.chapter;
    if (!isMainHub(nodeId) && chap) {
      const here = left.find((s) => this.N[s].chapter === chap && !isHub(s));
      if (here) return { to: here };
      if (left.some((s) => !isOutro(s))) return { menu: true };
    }
    return { to: left.find((s) => !isOutro(s)) || left[0] || 'outro-make' };
  }

  // the one recommended choice index for a menu, given what's been heard
  recommended(nodeId, visited) {
    const n = this.N[nodeId];
    // demo choices ("Open it", "Show me here") are inline actions, never the pick
    const ch = (n?.choices || []).map((c, i) => ({ c, i })).filter(({ c }) => !c.demo);
    if (!ch.length) return -1;
    const forced = ch.find(({ c }) => c.primary);
    if (forced) return forced.i;
    const t = this.target(nodeId, visited);
    if (t.menu) {
      const m = ch.find(({ c }) => isMainHub(c.to));
      if (m) return m.i;
    }
    const stop = t.to || this.nextStop(visited);
    if (stop) {
      let best = null;
      for (const { c, i } of ch) {
        const d = c.to === stop ? 0 : this.dist(c.to, stop);
        if (d < Infinity && (!best || d < best.d || (d === best.d && (c.primary || c.recommended)))) best = { d, i };
      }
      if (best && best.d <= 3) return best.i;
      const m = ch.find(({ c }) => isMainHub(c.to)); // can't get there from here: the menu can
      if (m && !isMainHub(nodeId)) return m.i;
    }
    const st = ch.find(({ c }) => c.primary) || ch.find(({ c }) => c.recommended);
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

// keep hyphenated words whole ("pre-buzz" never breaks at its hyphen)
const keepWhole = (label) => String(label).split(/(\s+)/).map((w) => (/\S-\S/.test(w) ? h('span.nobr', w) : w));

export function cardEl(map, choice, i, { rec, visited, current, onPick, size = '' }) {
  const to = choice.to;
  const entry = map.isChapterEntry(to) && map.N[to]?.chapter !== map.N[current]?.chapter;
  const sec = entry ? map.chapterSec(to) : map.sec(to);
  const subs = entry ? map.subs(to) : [];
  const tags = map.tags(to, entry);
  const seen = visited.has(to);
  const blurb = map.N[to]?.blurb;
  const title = isHub(to) ? choice.label : map.title(to) || choice.label;
  const small = size === 'door' || size === 'alt';
  return h('button.card' + (size ? '.card--' + size : '') + (rec ? '.is-rec' : '') + (seen ? '.is-seen' : ''), { type: 'button', dataset: { i: String(i), to }, onclick: () => onPick(choice, choice.label, true) },
    h('span.card__head', h('span.card__t', keepWhole(title)), h('span.card__min', mins(sec))),
    blurb && h('span.card__b', blurb),
    !small && subs.length ? h('span.card__in', h('span.card__ink', 'Inside: '), subs.map((s) => map.title(s)).join(' · ')) : null,
    (tags.length || seen) && h('span.card__tags', seen && h('span.tag.tag--seen', 'heard'), tags.slice(0, seen || small ? 1 : 2).map((t) => h('span.tag', t))));
}

// utility choices: open links, show-here demos, back-to-menu hops
export const isUtility = (map, c) => !!c.demo || isHub(c.to);
export const isMainHub = (id) => id === 'hub' || id === 'hub-first';

// Cut the decision load at a fork: ONE primary (the recommended next), at most
// two alternatives, the rest behind "More…". Demo choices become inline actions.
// The main menu shows every door, led by the recommended one.
export function planChoices(map, nodeId, visited) {
  const n = map.N[nodeId];
  const all = (n?.choices || []).map((c, i) => ({ c, i }));
  const actions = all.filter(({ c }) => c.demo);
  const pool = all.filter(({ c }) => !c.demo);
  if (!pool.length) return { primary: null, alts: [], more: [], doors: [], actions, menu: false };
  const r = map.recommended(nodeId, visited);
  const primary = pool.find((x) => x.i === r)
    || pool.find(({ c }) => !isHub(c.to) && !visited.has(c.to))
    || pool.find(({ c }) => !isMainHub(c.to))
    || pool[0];
  const rest = pool.filter((x) => x !== primary);
  if (isMainHub(nodeId)) return { primary, alts: [], more: [], doors: rest, actions, menu: true };
  const tier = ({ c }) => (isMainHub(c.to) ? 3 : isHub(c.to) ? 2 : visited.has(c.to) ? 1 : 0);
  const alts = rest.filter((x) => tier(x) < 3).sort((a, b) => tier(a) - tier(b) || a.i - b.i).slice(0, 2);
  const more = rest.filter((x) => !alts.includes(x));
  return { primary, alts, more, doors: [], actions, menu: false };
}

// Every part of the episode, grouped by chapter in the order the show reaches them. Inside a
// chapter, the parts its entry (or its hub) opens sit at the top level; the parts a part of its
// own opens (Wrapps → seven wrapps) nest one level under it. Hubs are menus, not parts: they
// pass straight through. Computed once per map.
export function episodeParts(map) {
  if (map._parts) return map._parts;
  const N = map.N, listed = map.ep.chapters || [];
  // the order the show reaches each node, from the start
  const order = new Map(), q = [map.ep.start || Object.keys(N)[0]];
  while (q.length) { const id = q.shift(); if (order.has(id) || !N[id]) continue; order.set(id, order.size); q.push(...map.edges(id)); }
  for (const id of Object.keys(N)) if (!order.has(id)) order.set(id, order.size);
  const byCh = new Map();
  for (const id of [...order.keys()]) { const ch = N[id].chapter || N[id].title || id; if (!byCh.has(ch)) byCh.set(ch, []); byCh.get(ch).push(id); }
  const groups = [];
  for (const [ch, ids] of byCh) {
    const li = listed.find((c) => N[c.to]?.chapter === ch);
    const entry = li && N[li.to] ? li.to : ids[0];
    const set = new Set(ids);
    const owner = new Map([[entry, null]]), bfs = [entry];
    while (bfs.length) {
      const x = bfs.shift();
      const own = isHub(x) ? owner.get(x) : x === entry ? null : owner.get(x) ?? x;
      for (const y of map.edges(x)) if (set.has(y) && !owner.has(y)) { owner.set(y, own); bfs.push(y); }
    }
    for (const id of ids) if (!owner.has(id)) owner.set(id, null);
    const parts = ids.filter((id) => !isHub(id));
    const top = parts.filter((id) => owner.get(id) == null).sort((a, b) => (a === entry ? -1 : b === entry ? 1 : 0));
    const kids = (p) => parts.filter((id) => owner.get(id) === p);
    groups.push({ ch, label: li?.label || ch, entry, hubOnly: !parts.length, parts, tree: top.map((id) => ({ id, kids: kids(id) })) });
  }
  return (map._parts = groups);
}

// The episode map: every chapter with every part (title · minutes), heard ones ticked, the one
// playing lit, the one ⏭ goes to marked "next". Chapters can fold; all start open.
export function chapterMap(map, { visited, currentNode, nextNode, folded, onGo, onToggle }) {
  const stops = new Set(map.route.stops || []);
  let n = 0;
  const part = (s, nested) => {
    const heard = visited.has(s), now = s === currentNode, next = s === nextNode && !now;
    return h('button.sub' + (heard ? '.is-visited' : '') + (stops.has(s) ? '.is-rec' : '') + (now ? '.is-now' : '') + (next ? '.is-next' : '') + (nested ? '.is-nested' : ''), {
      type: 'button', dataset: { to: s }, 'aria-current': now ? 'true' : null, onclick: () => onGo(s),
      'aria-label': `${map.title(s)}, ${mins(map.sec(s)) || 'short'}${now ? ', playing now' : heard ? ', heard' : ''}${next ? ', up next' : ''}`,
    }, h('i.sub__dot', { 'aria-hidden': 'true' }, now ? '▶' : heard ? '✓' : ''), h('span.sub__t', keepWhole(map.title(s)), next && h('span.sub__next', 'next')), h('span.sub__m', mins(map.sec(s))));
  };
  return episodeParts(map).map((g) => {
    if (g.hubOnly) {
      // the menu: one row that jumps back to it
      const cur = g.entry === currentNode || (isHub(currentNode) && map.N[currentNode]?.chapter === g.ch);
      return h('li.cmap__ch.cmap__ch--hub' + (cur ? '.is-current' : ''), h('button.chap', { type: 'button', dataset: { to: g.entry }, onclick: () => onGo(isMainHub(g.entry) ? 'hub' : g.entry) },
        h('span.chap__n', { 'aria-hidden': 'true' }, '≡'), h('span.chap__t', g.label, cur && h('span.chap__now', 'Now')), h('span.chap__m', 'all topics')));
    }
    const idx = ++n;
    const heardN = g.parts.filter((s) => visited.has(s)).length;
    const all = heardN === g.parts.length;
    const cur = g.ch === map.N[currentNode]?.chapter;
    const single = g.parts.length === 1;
    const open = !single && !folded.has(g.entry);
    const sec = g.parts.reduce((a, s) => a + map.sec(s), 0);
    const onRoute = g.parts.some((s) => stops.has(s));
    const head = h('button.chap', {
      type: 'button', dataset: { to: g.entry },
      'aria-expanded': single ? null : String(open), 'aria-current': cur && single ? 'true' : null,
      onclick: () => (single ? onGo(g.entry) : onToggle(g.entry)),
    },
      h('span.chap__n', all ? { 'aria-label': `${idx}, all heard` } : null, all ? '✓' : String(idx).padStart(2, '0')),
      h('span.chap__t', { title: g.label }, keepWhole(single ? map.title(g.entry) : g.label), onRoute && h('span.chap__route', { title: 'On the recommended route', 'aria-label': ', on the recommended route' }),
        cur && h('span.chap__now', 'Now')),
      h('span.chap__m', single ? mins(sec) : `${heardN ? `${heardN}/${g.parts.length} heard` : `${g.parts.length} parts`} · ${mins(sec)}`));
    const list = open ? h('ul.cmap__subs', g.tree.map((t) => h('li', part(t.id, false),
      t.kids.length ? h('ul.cmap__fork', { 'aria-label': `Opens from ${map.title(t.id)}` }, t.kids.map((k) => h('li', part(k, true)))) : null))) : null;
    return h('li.cmap__ch' + (cur ? '.is-current' : '') + (heardN ? '.is-visited' : '') + (open ? '.is-open' : '') + (onRoute ? '.is-route' : ''), head, list);
  });
}
