// hub.js: Hub and connections. Every tool a brand runs on as a tile (status, last sync, rows, freshness),
// grouped by the area (and agent) that may read it, plus data freshness, the latest syncs and a sync history. API: GET/POST /d2c-api/w/:wid/hub (CONTRACT.md).
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
      if (can(role, 'member')) out.push(html`<button class="btn is-small" type="button" data-act="sync" data-key="${c.key}"${dis}>${busy ? 'Working' : c.owner_tap ? 'Ask to read' : 'Sync now'}</button>`);
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

  const fresh = (c) => {
    if (c.status !== 'connected' || !c.last_sync) return html`<span class="hub-fresh" aria-hidden="true"><span style="width:0%"></span></span>`;
    const age = Math.max(0, (data.now || Date.now()) - c.last_sync), pct = Math.max(4, Math.round(100 - Math.min(1, age / 86400e3) * 100));
    return html`<span class="hub-fresh${age > 86400e3 ? ' is-stale' : ''}" title="${age > 86400e3 ? 'Not synced in a day' : 'Synced in the last day'}"><span style="width:${age > 86400e3 ? 100 : pct}%"></span></span>`;
  };

  const connector = (c) => html`
    <li class="hub-c${c.status === 'connected' ? ' is-on' : ''}" data-key="${c.key}">
      <div class="hub-c-head"><b>${c.name}</b>${pill(c.status)}</div>
      <p class="muted hub-what">${c.what}${c.status === 'connected' && c.mode === 'demo' ? html` <span class="hub-mode mono">demo</span>` : ''}</p>
      <p class="hub-meta mono">${c.last_sync ? html`Last sync ${ago(c.last_sync, data.now)}` : 'Never synced'} · ${num(c.rows)} rows</p>
      ${fresh(c)}
      ${driveState(c)}
      ${errors[c.key] ? html`<p class="err" role="alert">${errors[c.key]}</p>` : ''}
      <div class="hub-c-act">${actions(c)}</div>
    </li>`;

  const groups = GROUPS.map((g) => ({ ...g, items: conns.filter((c) => c.group === g.slug) })).filter((g) => g.items.length);
  const on = conns.filter((c) => c.status === 'connected');
  const now = data.now || Date.now();
  const stale = on.filter((c) => !c.last_sync || now - c.last_sync > 86400e3);
  const rows = on.reduce((n, c) => n + (c.rows || 0), 0);
  const lastSync = Math.max(0, ...on.map((c) => c.last_sync || 0));
  const tab = ctx.params && ctx.params[0] === 'syncs' ? 'syncs' : 'connectors';
  const base = `#/w/${encodeURIComponent(ctx.wid)}/hub`;
  const syncRows = (list) => html`<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Tool</th><th>Status</th><th class="r">Rows</th><th>By</th><th>When</th><th>Note</th></tr></thead>
      <tbody>${list.map((r) => html`<tr><td>${names[r.connector] || r.connector}</td><td>${runPill(r.status)}</td><td class="r">${num(r.rows)}</td><td class="mono">${r.started_by}</td><td>${ago(r.started_at, data.now)}</td><td class="muted">${r.note || ''}</td></tr>`)}</tbody>
    </table></div>`;

  const tabs = html`<nav class="tabs" aria-label="Hub">
    <a href="${base}"${tab === 'connectors' ? html` aria-current="page"` : ''}>Connectors <span class="tab-n">${on.length}/${conns.length}</span></a>
    <a href="${base}/live">Live data</a>
    <a href="${base}/syncs"${tab === 'syncs' ? html` aria-current="page"` : ''}>Sync history</a>
  </nav>`;
  const top = html`<div class="pg-top"><div>
      <h1 class="pg-h">Hub and connections ${sampleTag(ctx.ws)}</h1>
      <p class="pg-sub">Every tool the brand runs on, and which agent may read it. Each agent reads only its own area's tools; All hands reads the hub's summaries.${demo ? ' Demo mode: connecting and syncing use sample rows and never call a vendor.' : ''}</p>
    </div></div>`;

  if (tab === 'syncs') {
    const list = data.history || data.syncs || [];
    return html`<section class="pg hub">${tabs}${top}
      <div class="hub-filter"><label class="field"><span>Tool</span><select id="hub-pick">
        <option value="">Every tool (latest 20)</option>
        ${conns.map((c) => html`<option value="${c.key}"${data.pick === c.key ? ' selected' : ''}>${c.name}</option>`)}
      </select></label></div>
      ${data.error ? html`<p class="err" role="alert">${data.error}</p>` : ''}
      ${list.length ? syncRows(list) : html`<p class="empty card">No syncs yet.</p>`}
    </section>`;
  }

  return html`<section class="pg hub">${tabs}${top}
    <div class="kpis hub-kpis">
      <div class="kpi"><span class="kpi-l">Connected</span><span class="kpi-v">${on.length} of ${conns.length}</span><span class="kpi-f"><span class="kpi-d">${conns.length - on.length} not connected</span></span></div>
      <div class="kpi${stale.length ? ' is-watch' : ''}"><span class="kpi-l">Not synced in a day</span><span class="kpi-v">${stale.length}</span><span class="kpi-f"><span class="kpi-d${stale.length ? ' is-bad' : ''}">${stale.length ? stale.map((c) => c.name).join(', ') : 'All fresh'}</span></span></div>
      <div class="kpi"><span class="kpi-l">Rows in the hub</span><span class="kpi-v">${num(rows)}</span><span class="kpi-f"><span class="kpi-d">from connected tools</span></span></div>
      <div class="kpi"><span class="kpi-l">Last sync</span><span class="kpi-v">${lastSync ? ago(lastSync, data.now) : 'Never'}</span><span class="kpi-f"><span class="kpi-d">${(data.syncs || []).length} recent runs</span></span></div>
    </div>
    ${data.error ? html`<p class="err" role="alert">${data.error}</p>` : ''}
    ${groups.map((g) => html`<section class="hub-g">
      <h2 class="hub-gh">${g.name} <span class="muted hub-agent">read by the ${g.agent}</span></h2>
      <ul class="hub-list">${g.items.map(connector)}</ul>
    </section>`)}

    <div class="hub-two">
      <section><h2 class="sec-h">Data freshness</h2>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Table</th><th class="r">Rows</th><th>Updated</th></tr></thead>
          <tbody>${(data.tables || []).map((t) => html`<tr><td>${t.label} <span class="muted mono">${t.name}</span></td><td class="r">${num(t.rows)}</td><td>${t.updated ? ago(t.updated, data.now) : html`<span class="muted">No rows yet</span>`}</td></tr>`)}</tbody>
        </table></div></section>
      <section><h2 class="sec-h">Latest syncs</h2>
        ${(data.syncs || []).length ? syncRows(data.syncs.slice(0, 6)) : html`<p class="empty card">No syncs yet.</p>`}
        ${(data.syncs || []).length > 6 ? html`<p class="note"><a class="linkish" href="${base}/syncs">All sync history</a></p>` : ''}
      </section>
    </div>
  </section>`;
}

export async function mount(root, ctx) {
  if (ctx.params && ctx.params[0] === 'live') return (await import('./connectors.js')).mount(root, ctx); // Live data: Gmail, WhatsApp, Meta, Instagram, Shopify
  const s = { busy: null, errors: {}, waiting: {}, error: '', pick: '', history: null };
  let data = null;
  const paint = () => { root.innerHTML = String(view({ ...data, ...s, now: Date.now() }, ctx)); };
  const load = async () => { data = await ctx.api('GET', `/w/${ctx.wid}/hub`); };
  await load();
  paint();

  // Sync history: one tool's runs (GET hub/syncs?connector=)
  const onChange = async (e) => {
    if (e.target.id !== 'hub-pick') return;
    s.pick = e.target.value; s.error = '';
    try { s.history = s.pick ? (await ctx.api('GET', `/w/${ctx.wid}/hub/syncs?connector=${encodeURIComponent(s.pick)}`)).runs : null; }
    catch (err) { s.error = err.message; }
    paint();
  };
  root.addEventListener('change', onChange);

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
  return () => { root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); };
}
