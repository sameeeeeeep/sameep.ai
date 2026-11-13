// agents.js: Team and agents. The people (faces, what waits on each) and the agents (a named cat each, what it is
// on now). One line each; the Feed and Chat hold the detail. API: GET cos/state, cos/feed.
import { html } from '../js/ui.js';
import { cosApi, live, ago } from '../js/cos.js';
import { cat, catOf, face } from '../js/look.js';

export const title = 'Team';

// Pure. data = {state, feed}
export function view(data, ctx, ui = {}) {
  const { state: s, feed = {} } = data;
  const ws = ctx.ws || { name: '', demo: s?.demo };
  const tab = ui.tab || 'agents';
  const open = Object.values(feed.decisions || {}).filter((d) => d.status === 'open' || d.status === 'to_check');
  const waitFor = (name) => open.filter((d) => (d.status === 'open' ? d.decider?.name : d.checker?.name) === name).length;
  const agents = s?.presence?.running?.agents || [];
  const people = Object.values(s?.people || {});
  const tabs = html`<div class="ag-tabs" role="group" aria-label="Show">
    <button type="button" data-ag="agents" aria-pressed="${tab === 'agents'}">Agents <span class="mono">${agents.length}</span></button>
    <button type="button" data-ag="people" aria-pressed="${tab === 'people'}">People <span class="mono">${people.length}</span></button></div>`;
  const agentList = html`<ul class="ag-grid">${agents.map((a) => { const c = catOf(a.name); return html`<li class="ag-c">
    ${cat(a.name, 64)}
    <p class="ag-n"><b>${c.name}</b><span>${c.role}</span></p>
    <p class="ag-now">${a.now}</p>
    ${a.ts ? html`<p class="ag-t">${ago(a.ts)}</p>` : ''}
  </li>`; })}</ul>`;
  const peopleList = html`<ul class="ag-grid is-people">${people.map((p) => { const n = waitFor(p.name); return html`<li class="ag-c">
    ${face(ws, p.placeholder ? '' : p.name, 64)}
    <p class="ag-n"><b>${p.name}</b><span>${p.title}</span></p>
    <p class="ag-now">${n ? `${n} waiting on ${p.placeholder ? 'this role' : p.name.split(' ')[0]}` : 'Nothing waiting'}</p>
  </li>`; })}</ul>`;
  return html`<section class="pg ag">
    <header class="db-head"><h1>Team</h1>${s?.demo ? html`<span class="sample-tag">Sample data</span>` : ''}</header>
    ${tabs}
    ${tab === 'agents' ? agentList : peopleList}
  </section>`;
}

export async function mount(root, ctx) {
  const ui = { tab: ctx.params?.[0] === 'people' ? 'people' : 'agents' };
  let data = null;
  const load = async () => { const [state, feed] = await Promise.all([cosApi(ctx, 'GET', 'state'), cosApi(ctx, 'GET', 'feed')]); data = { state, feed }; };
  const paint = () => { root.innerHTML = String(view(data, ctx, ui)); };
  await load(); paint();
  root.addEventListener('click', (e) => { const b = e.target.closest('[data-ag]'); if (b) { ui.tab = b.dataset.ag; paint(); } });
  const stop = live(ctx, async () => { try { await load(); paint(); } catch { /* next tick */ } });
  return () => stop();
}
