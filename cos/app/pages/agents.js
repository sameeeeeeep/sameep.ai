// agents.js: Team and agents. The people (faces, what waits on each) and the agents (each a plain named role with a
// monogram mark, what it is on now). One line each; the Feed and Chat hold the detail. API: GET cos/state, cos/feed.
import { html } from '../js/ui.js';
import { cosApi, live, ago } from '../js/cos.js';
import { mark, agentOf, face } from '../js/look.js';

export const title = 'Team';

// Pure. data = {state, feed}
export function view(data, ctx, ui = {}) {
  const { state: s, feed = {} } = data;
  const ws = ctx.ws || { name: '', demo: s?.demo };
  const tab = ui.tab || 'agents';
  const open = Object.values(feed.decisions || {}).filter((d) => d.status === 'open' || d.status === 'to_check');
  const waitFor = (name) => open.filter((d) => (d.status === 'open' ? d.decider?.name : d.checker?.name) === name).length;
  // the Chief of staff is COS's lead agent: it runs the room, assigns, chases and relays what people said. It leads.
  const lead = (a) => /^chief of staff$/i.test(a.name);
  const agents = (s?.presence?.running?.agents || []).slice().sort((a, b) => (lead(b) ? 1 : 0) - (lead(a) ? 1 : 0));
  const people = Object.values(s?.people || {});
  const tabs = html`<div class="ag-tabs" role="group" aria-label="Show">
    <button type="button" data-ag="agents" aria-pressed="${tab === 'agents'}">Agents <span class="mono">${agents.length}</span></button>
    <button type="button" data-ag="people" aria-pressed="${tab === 'people'}">People <span class="mono">${people.length}</span></button></div>`;
  // each agent opens the chat of the module it runs (its thread, else the module of its first function)
  const modFor = (name) => (data.threads || []).find((t) => t.agent === name)?.slug || (data.threads || []).find((t) => (t.fns || []).some((f) => f.agent === name))?.slug || null;
  const agentList = html`<ul class="ag-grid">${agents.map((a) => { const c = agentOf(a.name); const m = modFor(a.name); return html`<li class="ag-c">
    ${mark(a.name, 44)}
    <p class="ag-n"><b>${c.name}</b>${lead(a) ? html`<span>Lead agent. Runs the room and relays what people said.</span>` : ''}</p>
    <p class="ag-now">${a.now}</p>
    ${a.ts ? html`<p class="ag-t">${ago(a.ts)}</p>` : ''}
    ${m ? html`<a class="ag-go" href="#/w/${encodeURIComponent(ctx.wid)}/chat/${encodeURIComponent(m)}">Open #${m}</a>` : ''}
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
  const load = async () => { const [state, feed, th] = await Promise.all([cosApi(ctx, 'GET', 'state'), cosApi(ctx, 'GET', 'feed'), cosApi(ctx, 'GET', 'threads').catch(() => ({ threads: [] }))]); data = { state, feed, threads: th.threads }; };
  const paint = () => { root.innerHTML = String(view(data, ctx, ui)); };
  await load(); paint();
  root.addEventListener('click', (e) => { const b = e.target.closest('[data-ag]'); if (b) { ui.tab = b.dataset.ag; paint(); } });
  const stop = live(ctx, async () => { try { await load(); paint(); } catch { /* next tick */ } });
  return () => stop();
}
