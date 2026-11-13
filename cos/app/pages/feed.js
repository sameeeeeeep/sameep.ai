// feed.js: the Feed. What the chief of staff and its agents did, as it happened, as short posts; where a person is
// needed, the post carries the one decision card (js/cos.js). Presence (running / managing / monitoring) and the
// launch plan sit on top; the queue of cards waiting for a tap sits on the side.
import { html } from '../js/ui.js';
import { cosApi, live, bindCards, decisionCard, presence, planStrip, knock, face, ago, clock, sourceLabel, head, loadFaces, avatarOf } from '../js/cos.js';

export const title = 'Feed';
const VERB = { did: '', found: 'found', asks: 'asks', decided: 'decided', checked: 'checked', sent_back: 'sent back', replanned: 're-planned', synced: '' };
export const FILTERS = [['all', 'All'], ['tap', 'Needs a tap'], ['decided', 'Decided'], ['replans', 'Re-plans']];

// Pure. data = {state, posts, decisions}; ui = {filter}
export function view(data, ctx, ui = {}) {
  const { state: s, posts = [], decisions = {} } = data;
  const sx = { ...s, wid: ctx.wid };
  const filter = ui.filter || 'all';
  const open = Object.values(decisions).filter((d) => d.status === 'open' || d.status === 'to_check').sort((a, b) => b.ts - a.ts);
  const shown = new Set();
  const keep = (p) => {
    const d = p.decision_id && decisions[p.decision_id];
    if (filter === 'tap') return d && (d.status === 'open' || d.status === 'to_check');
    if (filter === 'decided') return ['decided', 'checked', 'sent_back'].includes(p.verb);
    if (filter === 'replans') return p.verb === 'replanned';
    return true;
  };
  const list = posts.filter(keep);
  // group by day: Today, Yesterday, then story days
  const groups = [];
  for (const p of list) {
    const k = dayKey(p.ts);
    if (!groups.length || groups[groups.length - 1].k !== k) groups.push({ k, posts: [] });
    groups[groups.length - 1].posts.push(p);
  }
  const post = (p) => {
    const d = p.decision_id ? decisions[p.decision_id] : null;
    // the card shows once, on the post that raised it; later posts about it point back to it
    const full = d && !shown.has(d.id) && ['found', 'replanned', 'asks', 'did'].includes(p.verb);
    if (full) shown.add(d.id);
    const agent = p.actor_kind === 'agent';
    return html`<li class="fd-post${agent ? ' is-agent' : ''}">
      ${face(p.actor, { agent, avatar: avatarOf(s, p.actor) })}
      <p class="fd-h"><b>${p.actor}</b>${VERB[p.verb] ? html`<span class="fd-verb">${VERB[p.verb]}</span>` : ''}<span class="fd-t">${clock(p.ts)}</span></p>
      <p class="fd-text">${p.text}</p>
      ${p.source || p.fn_name || p.record_ref ? html`<p class="fd-meta">${p.fn_name ? html`<span>${p.fn_name}</span>` : ''}${p.source ? html`<span class="fd-chip">${sourceLabel(p.source)}</span>` : ''}${p.record_ref ? html`<a class="fd-chip" href="#/w/${ctx.wid}/os/all/${encodeURIComponent(p.record_ref)}">${p.record_ref}</a>` : ''}</p>` : ''}
      ${p.extra && p.extra.knock ? knock(p.extra.knock, p.extra.launch) : ''}
      ${full ? decisionCard(d, sx) : d ? html`<p class="fd-meta">${decisionCard(d, sx, { compact: true })}</p>` : ''}
    </li>`;
  };
  return html`<section class="pg">
    ${head('Feed', 'What your chief of staff and its agents did, as it happened. A card where a person is needed.', s, ctx.wid)}
    ${presence(s)}
    ${planStrip(s.plan, ctx.wid)}
    <div class="cs-wrap">
      <div>
        <div class="fd-tabs" role="group" aria-label="Show">${FILTERS.map(([k, l]) => html`<button type="button" data-filter="${k}" aria-pressed="${k === filter}">${l}${k === 'tap' ? html` <span class="mono">${open.length}</span>` : ''}</button>`)}</div>
        ${groups.length ? groups.map((g) => html`<h2 class="fd-day">${g.k}</h2><ul class="fd-list">${g.posts.map(post)}</ul>`) : html`<p class="empty">Nothing here yet.</p>`}
      </div>
      <aside class="cs-side">
        <div><h2>Waiting for a tap <span class="mono muted">${open.length}</span></h2>
          ${open.length ? html`<ul class="fd-q">${open.map((d) => html`<li><a href="#dec-${d.id}" data-jump="${d.id}"><span>${d.title}</span><span class="muted">${d.status === 'open' ? `${d.decider?.name || 'Anyone'} ${d.kind === 'ask' ? 'is asked' : 'decides'}` : `${d.decided_by} decided · needs a check`}</span></a></li>`)}</ul>` : html`<p class="muted">Nothing. The agents are on it.</p>`}
        </div>
      </aside>
    </div>
  </section>`;
}

export function dayKey(ms, now = Date.now()) {
  const d0 = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const diff = Math.round((d0(now) - d0(ms)) / 86400e3);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  const d = new Date(ms);
  return `${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]} · day ${18 - diff}`;
}

export async function mount(root, ctx) {
  const ui = { filter: 'all' };
  let data = null;
  const load = async () => {
    const [state, f] = await Promise.all([cosApi(ctx, 'GET', 'state'), cosApi(ctx, 'GET', 'feed')]);
    data = { state, ...f };
    await loadFaces(ctx, state.people);
  };
  const paint = () => { root.innerHTML = String(view(data, ctx, ui)); };
  const refresh = async () => { try { await load(); paint(); } catch (e) { ctx.toast(e.message); } };
  await load(); paint();
  focusCard(root, ctx);
  const unbind = bindCards(root, ctx, refresh);
  root.addEventListener('click', (e) => {
    const f = e.target.closest('[data-filter]');
    if (f) { ui.filter = f.dataset.filter; paint(); return; }
    const j = e.target.closest('[data-jump],[data-open-dec]');
    if (j) { e.preventDefault(); const id = j.dataset.jump || j.dataset.openDec; ui.filter = 'all'; paint(); flash(root, id); }
  });
  const stop = live(ctx, refresh);
  return () => { stop(); unbind(); };
}

// scroll to a card and outline it briefly (from the presenter panel or the side queue)
export function flash(root, id) {
  const el = root.querySelector(`#dec-${id}`);
  if (!el) return;
  el.scrollIntoView({ block: 'center' });
  el.classList.add('is-flash');
  setTimeout(() => el.classList.remove('is-flash'), 2200);
}
// ?flow=<key> in the session (set by the presenter panel) focuses that flow's card once
export function focusCard(root, ctx) {
  let flow = null, dec = null;
  try { flow = sessionStorage.getItem('cos.focus'); sessionStorage.removeItem('cos.focus'); dec = sessionStorage.getItem('cos.focusDec'); sessionStorage.removeItem('cos.focusDec'); } catch { /* */ }
  if (dec && root.querySelector(`#dec-${CSS.escape(dec)}`)) { setTimeout(() => flash(root, dec), 250); return; }
  if (!flow) return;
  const el = root.querySelector(`[data-flow="${CSS.escape(flow)}"]`);
  if (el) setTimeout(() => flash(root, el.id.replace('dec-', '')), 250);
}
