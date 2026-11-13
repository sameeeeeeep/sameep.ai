// coshub.js: the Hub. Every connector's state (connected, not synced, not connected), what each agent reads, and
// every number the agents watch with its source and when it was fetched. Sync and connect work in demo mode;
// a Drive and Calendar read waits for the owner's tap as the one decision card.
import { html } from '../js/ui.js';
import { cosApi, live, ago, head, face, changed } from '../js/cos.js';

export const title = 'Hub';
export const STATE = { connected: 'Connected', not_synced: 'Not synced', not_connected: 'Not connected' };

const src = (s) => (s ? html`<span class="hb-src is-${s.state}">${s.name} · ${ago(s.fetched)}${s.state === 'not_synced' ? ' · not synced' : ''}</span>` : '');

// Pure. data = {state, hub}
export function view(data, ctx) {
  const { state: s, hub: h } = data;
  const canTap = ['member', 'admin', 'owner'].includes(ctx.role);
  const counts = { connected: 0, not_synced: 0, not_connected: 0 };
  for (const c of h.connectors) counts[c.state]++;
  const btn = (c) => {
    if (!canTap) return '';
    // a client workspace: Sync now reads for real (the Hub API; a private workspace reads through its company OS link)
    if (!h.demo) return c.state !== 'not_connected' && !c.owner_tap ? html`<button class="btn is-small" type="button" data-conn="hubsync" data-key="${c.key}">Sync now</button>` : '';
    if (c.state === 'not_connected') return html`<button class="btn is-small" type="button" data-conn="connect" data-key="${c.key}">Connect</button>`;
    if (c.owner_tap) return html`<button class="btn is-small" type="button" data-conn="sync" data-key="${c.key}">Ask to read</button>`;
    return html`<button class="btn is-small${c.state === 'not_synced' ? ' is-primary' : ''}" type="button" data-conn="sync" data-key="${c.key}">Sync now</button>`;
  };
  return html`<section class="pg">
    ${head('Hub', '', s, ctx.wid, html`<a class="btn is-small" href="#/w/${encodeURIComponent(ctx.wid)}/hub/live">Live data</a>`)}
    ${h.numbers.length ? html`<div class="hb-nums">${h.numbers.map((n) => html`<div class="hb-num"><span class="l">${n.label}, latest full day</span><span class="v">${n.value}</span>${n.sub ? html`<span class="s">${n.sub}</span>` : ''}${src(n.source)}</div>`)}</div>` : ''}
    <h2 class="cs-h2">Connectors <span class="hb-count">${counts.connected} of ${h.connectors.length} on</span></h2>
    <div class="hb-grid">${h.connectors.map((c) => html`<article class="hb-c is-${c.state}">
      <div class="hb-c-h"><b>${c.name}</b><span class="hb-state is-${c.state}">${STATE[c.state]}</span></div>
      <p class="hb-what">${c.what}</p>
      <p class="hb-src${c.state === 'not_synced' ? ' is-not_synced' : ''}">${c.state === 'not_connected' ? 'Not connected' : c.last_sync ? `Fetched ${ago(c.last_sync)} · ${c.rows.toLocaleString('en-IN')} rows` : c.owner_tap ? 'Each read waits for the owner' : 'Never synced'}</p>
      ${c.state === 'not_synced' && /^Last sync failed/.test(c.note || '') ? html`<p class="hb-src is-not_synced">${c.note}</p>` : ''}
      <p class="hb-read">Read by ${c.readers.length ? c.readers.join(', ') : 'no agent yet'}</p>
      ${btn(c)}
    </article>`)}</div>
    <details class="hb-more"><summary>What each agent reads</summary>
    <ul class="hb-agents">${h.agents.map((a) => html`<li><b>${face(a.name, { agent: true, small: true })}<span>${a.name}<small>${a.fns.join(', ')}</small></span></b>
      <span class="hb-reads">${a.reads.length ? a.reads.map((r) => html`<span class="hb-state is-${r.state}">${r.name}</span>`) : html`<span class="muted">Hub summaries only</span>`}</span></li>`)}</ul></details>
    <details class="hb-more"><summary>What the agents watch <span class="hb-count">${h.monitors.length}</span></summary>
    <ul class="hb-mon">${h.monitors.map((m) => html`<li><span><b>${m.label}</b><br><small>${m.limit ? `Keep ${m.limit}` : ''}</small></span><span><span class="v is-${m.state}">${m.value}</span><br>${src(m.source)}</span></li>`)}</ul></details>
  </section>`;
}

export async function mount(root, ctx) {
  // Hub > Live data: Gmail, WhatsApp, Meta Ads, Instagram and Shopify (pages/connectors.js)
  if (ctx.params && ctx.params[0] === 'live') return (await import('./connectors.js')).mount(root, ctx);
  if (ctx.params && ctx.params[0] === 'syncs') return (await import('./hub.js')).mount(root, ctx); // Sync history (the Live data page links it)
  let data = null;
  const load = async () => {
    const [state, hub] = await Promise.all([cosApi(ctx, 'GET', 'state'), cosApi(ctx, 'GET', 'hub')]);
    data = { state, hub };
  };
  const paint = () => { root.innerHTML = String(view(data, ctx)); };
  const refresh = async () => { try { await load(); paint(); } catch (e) { ctx.toast(e.message); } };
  await load(); paint();
  root.addEventListener('click', async (e) => {
    const sel = e.target.closest('[data-as-pick]');
    if (sel) return;
    const b = e.target.closest('[data-conn]');
    if (!b) return;
    b.disabled = true;
    try {
      if (b.dataset.conn === 'hubsync') {
        const r = await ctx.api('POST', `/w/${ctx.wid}/hub/connectors/${encodeURIComponent(b.dataset.key)}/sync`);
        ctx.toast(r.run?.note || r.note || (r.run?.ok === false || r.run?.status === 'error' ? 'The sync did not finish.' : 'Synced.'));
        changed(ctx.wid);
        return refresh();
      }
      const r = await cosApi(ctx, 'POST', `connectors/${b.dataset.key}/${b.dataset.conn}`, {});
      changed(ctx.wid);
      ctx.toast(r.queued ? 'Asked the founder: the read waits for one tap (Feed and Chat show the card).' : b.dataset.conn === 'connect' ? 'Connected in demo mode.' : 'Synced. Numbers from it read fetched just now.');
    } catch (err) { ctx.toast(err.message); }
    await refresh();
  });
  root.addEventListener('change', (e) => { const sel = e.target.closest('[data-as-pick]'); if (sel) import('../js/cos.js').then((m) => m.setAs(ctx.wid, sel.value)); });
  const stop = live(ctx, refresh);
  return () => stop();
}
