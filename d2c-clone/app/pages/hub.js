// hub.js (module C): Hub and connections. Every tool a brand runs on, grouped by the chat (and agent) that may
// read it, plus the hub tables and the latest syncs. API: GET/POST /d2c-api/w/:wid/hub (CONTRACT.md).
// view() is pure (Node tests import it); mount() fetches, renders and binds.
import { html, pill, sampleTag, can, ago, num } from '../js/ui.js';

export const title = 'Hub and connections';

// mirrors the worker's catalog GROUPS: which agent reads which connectors
const GROUPS = [
  { slug: 'website', name: 'Website', agent: 'Website agent' },
  { slug: 'performance', name: 'Performance', agent: 'Performance agent' },
  { slug: 'ops', name: 'Ops', agent: 'Ops agent' },
  { slug: 'content', name: 'Content', agent: 'Content agent' },
  { slug: 'finance', name: 'Finance', agent: 'Finance agent' },
  { slug: 'support', name: 'Support', agent: 'Support agent' },
];
const RUN = { ok: ['connected', 'Done'], running: ['pending', 'Running'], error: ['error', 'Failed'] };

const runPill = (s) => { const [cls, label] = RUN[s] || ['', s]; return html`<span class="pill-s is-${cls}">${label}</span>`; };

// data = GET hub answer + page state: { busy: key|null, errors: {key: msg}, waiting: {key: card}, error, now }
export function view(data, ctx) {
  const role = ctx.role;
  const demo = !!(ctx.ws && ctx.ws.demo);
  const conns = data.connectors || [];
  const names = Object.fromEntries(conns.map((c) => [c.key, c.name]));
  const reads = data.reads || [];
  const waiting = data.waiting || {};
  const errors = data.errors || {};

  const actions = (c) => {
    const busy = data.busy === c.key;
    const dis = busy ? ' disabled' : '';
    const out = [];
    if (c.status === 'connected') {
      if (can(role, 'member')) out.push(html`<button class="btn is-small is-primary" type="button" data-act="sync" data-key="${c.key}"${dis}>${busy ? 'Working' : c.owner_tap ? 'Ask to read' : 'Sync now'}</button>`);
      if (can(role, 'admin')) out.push(html`<button class="btn is-small" type="button" data-act="disconnect" data-key="${c.key}"${dis}>Disconnect</button>`);
    } else if (can(role, 'admin')) {
      if (demo) out.push(html`<button class="btn is-small is-primary" type="button" data-act="connect" data-key="${c.key}"${dis}>${busy ? 'Connecting' : 'Connect'}</button>`);
      else out.push(html`<span class="muted hub-note">Live connections are set up with Sameep during integration.</span>`);
    }
    if (!out.length) out.push(html`<span class="muted hub-note">${c.status === 'connected' ? 'Viewers can see syncs but not run them.' : 'An admin connects this.'}</span>`);
    return out;
  };

  // Drive and Calendar: reads that wait for a tap, and approved reads that can run once
  const driveState = (c) => {
    if (!c.owner_tap) return '';
    const pend = reads.filter((r) => r.status === 'pending' || r.status === 'awaiting_check');
    const ready = reads.filter((r) => r.status === 'approved');
    const asked = waiting[c.key];
    return html`
      <p class="hub-tap muted">Every read waits for an admin or the owner to tap Approve in Content chat. One approval, one read.</p>
      ${asked || pend.length ? html`<p class="hub-wait">Waiting for a tap in Content chat. <button class="linkish" type="button" data-act="go-content">Open Content chat</button></p>` : ''}
      ${c.status === 'connected' && ready.map((r) => html`<p class="hub-ready">Read approved${r.approved_by ? html` by ${r.approved_by}` : ''}.
        ${can(role, 'member') ? html`<button class="btn is-small is-primary" type="button" data-act="read" data-key="${c.key}" data-card="${r.card_id}"${data.busy === c.key ? ' disabled' : ''}>Run the read</button>` : ''}</p>`)}`;
  };

  const connector = (c) => html`
    <li class="hub-c" data-key="${c.key}">
      <div class="hub-c-main">
        <div class="hub-c-head"><b>${c.name}</b> ${pill(c.status)}${c.status === 'connected' && c.mode === 'demo' ? html` <span class="hub-mode mono">demo</span>` : ''}</div>
        <p class="muted hub-what">${c.what}</p>
        <p class="hub-meta mono">${c.last_sync ? html`Last sync ${ago(c.last_sync, data.now)}` : 'Never synced'} · ${num(c.rows)} rows</p>
        ${driveState(c)}
        ${errors[c.key] ? html`<p class="err" role="alert">${errors[c.key]}</p>` : ''}
      </div>
      <div class="hub-c-act">${actions(c)}</div>
    </li>`;

  const groups = GROUPS.map((g) => ({ ...g, items: conns.filter((c) => c.group === g.slug) })).filter((g) => g.items.length);
  const connected = conns.filter((c) => c.status === 'connected').length;

  return html`<section class="pg hub">
    <div class="pg-top">
      <div>
        <h1 class="pg-h">Hub and connections ${sampleTag(ctx.ws)}</h1>
        <p class="pg-sub">${connected} of ${conns.length} tools connected. Each agent reads only its own chat's tools; All hands reads the hub's summaries.${demo ? ' Demo mode: connecting and syncing use sample rows and never call a vendor.' : ''}</p>
      </div>
    </div>
    ${data.error ? html`<p class="err" role="alert">${data.error}</p>` : ''}
    <div class="hub-groups">
      ${groups.map((g) => html`<section class="card hub-g">
        <h2 class="hub-gh">${g.name} <span class="muted hub-agent">read by the ${g.agent}</span></h2>
        <ul class="hub-list">${g.items.map(connector)}</ul>
      </section>`)}
    </div>

    <h2 class="hub-h2">Hub tables</h2>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Table</th><th class="r">Rows</th><th>Updated</th></tr></thead>
      <tbody>${(data.tables || []).map((t) => html`<tr><td>${t.label} <span class="muted mono">${t.name}</span></td><td class="r">${num(t.rows)}</td><td>${t.updated ? ago(t.updated, data.now) : html`<span class="muted">No rows yet</span>`}</td></tr>`)}</tbody>
    </table></div>

    <h2 class="hub-h2">Latest syncs</h2>
    ${(data.syncs || []).length ? html`<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Tool</th><th>Status</th><th class="r">Rows</th><th>By</th><th>When</th><th>Note</th></tr></thead>
      <tbody>${data.syncs.map((r) => html`<tr><td>${names[r.connector] || r.connector}</td><td>${runPill(r.status)}</td><td class="r">${num(r.rows)}</td><td class="mono">${r.started_by}</td><td>${ago(r.started_at, data.now)}</td><td class="muted">${r.note || ''}</td></tr>`)}</tbody>
    </table></div>` : html`<p class="empty card">No syncs yet.</p>`}
  </section>`;
}

export async function mount(root, ctx) {
  const s = { busy: null, errors: {}, waiting: {}, error: '' };
  let data = null;
  const paint = () => { root.innerHTML = String(view({ ...data, ...s, now: Date.now() }, ctx)); };
  const load = async () => { data = await ctx.api('GET', `/w/${ctx.wid}/hub`); };
  await load();
  paint();

  async function act(kind, key, card) {
    s.busy = key; s.errors = { ...s.errors, [key]: '' }; paint();
    try {
      if (kind === 'connect' || kind === 'disconnect') {
        const r = await ctx.api('POST', `/w/${ctx.wid}/hub/connectors/${encodeURIComponent(key)}/${kind}`);
        ctx.toast(`${r.connector.name} ${kind === 'connect' ? 'connected in demo mode' : 'disconnected'}.`);
      } else {
        const r = await ctx.api('POST', `/w/${ctx.wid}/hub/connectors/${encodeURIComponent(key)}/sync`, card ? { card_id: Number(card) } : {});
        if (r.card) { s.waiting = { ...s.waiting, [key]: r.card }; ctx.toast('Asked in Content chat. An admin or the owner approves the read.'); }
        else ctx.toast(`Synced: ${r.run.rows} new rows.`);
      }
      await load();
    } catch (e) {
      s.errors = { ...s.errors, [key]: e.message };
    }
    s.busy = null; paint();
  }

  const onClick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !root.contains(b) || b.disabled) return;
    if (b.dataset.act === 'go-content') { ctx.go('chats', 'content'); return; }
    act(b.dataset.act, b.dataset.key, b.dataset.card);
  };
  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}
