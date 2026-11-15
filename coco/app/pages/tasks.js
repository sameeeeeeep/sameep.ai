// tasks.js: Tasks, the work across every module and product as one list (js/journey.js lines), filterable by module
// and by state. Each row: a round checkbox, the line, its product and module, the owner on the right (an agent's
// glyph or a person's face) and, on a person's call, the one action. The same row as the Products checklist.
// Routes: #/w/<wid>/tasks[/<module>]   (the sidebar's Modules link here)
import { html, raw } from '../js/ui.js';
import { live } from '../js/cos.js';
import { mark, face, agentOf } from '../js/look.js';
import { STAGES, MODS, href } from '../js/journey.js';
import { loadJourney, icon } from './products.js';

export const title = 'Tasks';
export const MOD_ORDER = ['ideas', 'npd', 'logistics', 'warehouse', 'listing', 'marketing', 'crm'];
const SHOW = [['open', 'Open'], ['done', 'Done'], ['all', 'All']];
const CHECK = raw('<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>');
const RANK = { call: 0, working: 1, queued: 2, done: 3 };

// Pure: every line of every product up to its current stage, with where it belongs
export function rows(products = []) {
  const out = [];
  for (const p of products) {
    p.lists.forEach((list, i) => {
      if (i > p.stage) return; // later stages are a plan, not tasks yet
      for (const l of list) out.push({ ...l, product: p, stage: i, mod: STAGES[i].mod });
    });
  }
  return out;
}
// Pure: the rows a filter keeps, the ones waiting on a person first
export function pick(all, mod = null, show = 'open') {
  return all.filter((r) => (!mod || r.mod === mod) && (show === 'all' || (show === 'done' ? r.st === 'done' : r.st !== 'done')))
    .sort((a, b) => RANK[a.st] - RANK[b.st] || b.stage - a.stage);
}

function row(r, ws, wid) {
  const h = href(wid, r.link);
  const owner = r.by.agent ? html`<span class="pj-own">${mark(r.by.agent, 20)}<span>${agentOf(r.by.agent).name}</span></span>`
    : html`<span class="pj-own">${face(ws, r.by.person, 20)}<span>${String(r.by.person).split(' ')[0]}</span></span>`;
  return html`<li class="pj-row is-${r.st}">
    <span class="pj-ck" aria-hidden="true">${r.st === 'done' ? CHECK : ''}</span>
    <span class="pj-row-t">${h ? html`<a href="${h}">${r.t}</a>` : r.t}<span>${r.product.name}, ${STAGES[r.stage].label.toLowerCase()} in #${r.mod}</span></span>
    ${owner}
    ${r.st === 'call' && h ? html`<a class="pj-act" href="${h}">Decide</a>` : ''}
  </li>`;
}

// Pure. data = { products }; ui = { mod, show }
export function view(data, ctx, ui = {}) {
  const ws = ctx.ws || {};
  const wid = encodeURIComponent(ctx.wid);
  const all = rows(data.products || []);
  const mod = MOD_ORDER.includes(ui.mod) ? ui.mod : null;
  let show = SHOW.some(([k]) => k === ui.show) ? ui.show : 'open';
  // a module with nothing open opens on everything it did, rather than an empty list
  if (!ui.picked && show === 'open' && !pick(all, mod, 'open').length) show = 'all';
  const list = pick(all, mod, show);
  const openN = (m) => all.filter((r) => (!m || r.mod === m) && r.st !== 'done').length;
  const tab = (m, label) => html`<a href="#/w/${wid}/tasks${m ? '/' + m : ''}"${raw((mod || null) === m ? ' aria-current="page"' : '')}>${label} <span class="tk-n">${openN(m)}</span></a>`;
  return html`<section class="pg tk">
    <header class="pj-head"><h1 class="pg-h">${mod ? `#${mod}` : 'Tasks'}</h1>${ws.demo ? html`<span class="sample-tag">Sample data</span>` : ''}</header>
    <nav class="tk-mods" aria-label="Modules">${tab(null, 'All')}${MOD_ORDER.map((m) => tab(m, `#${m}`))}</nav>
    <section class="pj-list tk-list">
      <header class="tk-h"><div class="tk-show" role="group" aria-label="Show">${SHOW.map(([k, l]) => html`<button type="button" data-show="${k}"${raw(k === show ? ' aria-pressed="true"' : '')}>${l}</button>`)}</div>
        ${mod ? html`<a class="tk-chat" href="${href(ctx.wid, { thread: MODS[mod].thread })}"><span class="pj-mi">${icon(mod, 16)}</span>Open the #${mod} chat</a>` : ''}</header>
      ${list.length ? html`<ul class="pj-rows">${list.map((r) => row(r, ws, ctx.wid))}</ul>` : html`<p class="tk-empty">${show === 'done' ? 'Nothing done here yet.' : 'Nothing open here.'}</p>`}
    </section>
  </section>`;
}

export async function mount(root, ctx) {
  const ui = { mod: ctx.params?.[0] || null, show: 'open' };
  let data = null;
  const load = async () => { data = await loadJourney(ctx); };
  const paint = () => { root.innerHTML = String(view(data, ctx, ui)); };
  await load(); paint();
  root.addEventListener('click', (e) => { const b = e.target.closest('[data-show]'); if (b) { ui.show = b.dataset.show; ui.picked = true; paint(); } });
  return live(ctx, async () => { try { await load(); paint(); } catch { /* next tick */ } });
}
