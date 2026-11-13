// board.js: a module's work as a board. Pure: the Worker's decisions, posts and records in, three groups out.
//   To do        the cards waiting for a person (a tap or a check), a check first, then the newest
//   In progress  the records in flight (draft, approved, on hold) that no open card already holds, approved first
//   Done         the closed cards and the checked records, newest first (folded on screen)
// A module is a chat thread (the Worker's GROUPS: website, performance, ops, content, finance, support, all-hands);
// a function (procurement, qc ...) belongs to one, so records and posts find their module through fnMap(threads).
export const ALL = 'all';
export const isOpen = (d) => !!d && (d.status === 'open' || d.status === 'to_check');

// threads -> { fnKey: moduleSlug }
export function fnMap(threads = []) {
  const m = {};
  for (const t of threads) for (const f of t.fns || []) m[f.key] = t.slug;
  return m;
}
export const modOf = (fns, fn) => fns[fn] || 'all-hands';

const IP = { approved: 0, held: 1, draft: 2 };

// data = {decisions, posts, records}; scope = ALL or a module slug; fns = fnMap(threads)
export function board(data = {}, scope = ALL, fns = {}) {
  const { decisions = {}, posts = [], records = [] } = data;
  const inScope = (slug) => scope === ALL || slug === scope;
  const decs = Object.values(decisions).map((d) => ({ d, mod: d.thread || modOf(fns, d.fn) })).filter((x) => inScope(x.mod));
  const raised = new Map(); // the agent's post that raised each card
  for (const p of posts) if (p.decision_id != null && p.actor_kind === 'agent' && !raised.has(p.decision_id)) raised.set(p.decision_id, p);
  const did = new Map(); // what the agent did once a card closed
  for (const p of posts) if (p.decision_id != null && p.actor_kind === 'agent' && p.verb === 'did' && !did.has(p.decision_id)) did.set(p.decision_id, p);
  const rank = (d) => (d.status === 'to_check' ? 0 : 1);

  const todo = decs.filter((x) => isOpen(x.d)).sort((a, b) => rank(a.d) - rank(b.d) || b.d.ts - a.d.ts)
    .map((x) => ({ ...x, post: raised.get(x.d.id) || null }));

  // where a record came from: the card it belongs to, else a post that names it
  const srcFor = (r) => (r.decision_id != null && decisions[r.decision_id]?.source) || posts.find((p) => p.record_ref === r.ref && p.source)?.source || null;
  const held = new Set(todo.map((x) => x.d.record?.ref).filter(Boolean));
  const recs = records.map((r) => ({ r, mod: modOf(fns, r.fn) })).filter((x) => inScope(x.mod));
  const doing = recs.filter((x) => x.r.status in IP && !held.has(x.r.ref) && !isOpen(decisions[x.r.decision_id]))
    .sort((a, b) => IP[a.r.status] - IP[b.r.status] || (b.r.updated || 0) - (a.r.updated || 0))
    .map((x) => ({ ...x, source: srcFor(x.r) }));

  const closedRefs = new Set();
  const done = [];
  for (const x of decs) {
    if (x.d.status !== 'done' && x.d.status !== 'sent_back') continue;
    if (x.d.record?.ref) closedRefs.add(x.d.record.ref);
    const res = did.get(x.d.id);
    done.push({ type: 'card', d: x.d, mod: x.mod, agent: x.d.agent || 'Chief of staff', result: res ? res.text : null,
      ts: Math.max(x.d.updated || 0, x.d.checked_ts || 0, x.d.decided_ts || 0, res?.ts || 0) });
  }
  for (const x of recs) {
    if (x.r.status !== 'checked' || closedRefs.has(x.r.ref)) continue;
    done.push({ type: 'record', r: x.r, mod: x.mod, source: srcFor(x.r), ts: x.r.checked_ts || x.r.updated || x.r.ts || 0 });
  }
  done.sort((a, b) => b.ts - a.ts);
  return { todo, doing, done };
}

// Pure: what waits on a person, per module (badges on the module list and the filter chips)
export function waitingBy(decisions = {}, fns = {}) {
  const n = {};
  for (const d of Object.values(decisions)) if (isOpen(d)) { const m = d.thread || modOf(fns, d.fn); n[m] = (n[m] || 0) + 1; }
  return n;
}
