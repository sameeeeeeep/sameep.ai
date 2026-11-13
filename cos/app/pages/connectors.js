// connectors.js: Hub > Live data. Email, WhatsApp, Meta Ads, Instagram and Shopify: each one's state, where its
// data came from and when, Sample or Live, Sync now, and (admins, client workspaces) its keys and settings.
// Writes never start here: they are cards in Work, and this page lists how each one went.
// API: /d2c-api/w/:wid/connectors (worker src/connectors/routes.js). Opened from the Hub's "Live data" tab.
// view() is pure (Node tests import it); mount() fetches, renders, binds, and adds connectors.css once.
import { html, sampleTag, can, ago, num } from '../js/ui.js';

export const title = 'Live data';

const STATE = {
  ok: ['connected', 'Connected'], error: ['error', 'Needs attention'],
  not_connected: ['not_connected', 'Not connected'], never: ['pending', 'Not synced yet'],
};
const ACT = {
  send_email: 'Email', wa_reply: 'WhatsApp reply', ig_reply: 'Comment reply', ig_dm: 'Instagram DM',
  ad_budget: 'Budget change', refund: 'Refund', price: 'Price change', stock: 'Stock change', fulfil: 'Fulfilment',
};
const RUN = {
  awaiting_approval: ['pending', 'Waiting for a tap'], running: ['pending', 'Running'], done: ['connected', 'Done'],
  failed: ['error', 'Not sent'], unknown: ['error', 'Check in the tool'], cancelled: ['not_connected', 'Rejected'],
};
// [one, many], in the order they read best
const ROWS = {
  thread: ['thread', 'threads'], message: ['message', 'messages'], adset: ['ad set', 'ad sets'], day: ['day of spend', 'days of spend'],
  comment: ['comment', 'comments'], dm: ['DM thread', 'DM threads'], order: ['order', 'orders'], refund: ['refund', 'refunds'],
  product: ['product', 'products'], variant: ['variant', 'variants'], inventory: ['stock level', 'stock levels'], customer: ['customer', 'customers'],
};
const SITE = 'https://sameep.ai';

const pillOf = ([cls, label]) => html`<span class="pill-s is-${cls}">${label}</span>`;
const rowsLine = (rows) => Object.keys(ROWS).filter((k) => (rows || {})[k]).map((k) => `${num(rows[k])} ${ROWS[k][rows[k] === 1 ? 0 : 1]}`).join(', ');
const whereFrom = (c) => {
  if (c.mode !== 'live') return 'Sample data';
  const f = c.found || {};
  return f.address || f.verified_name || f.username && `@${f.username}` || c.config?.shop || c.config?.ad_account_id || 'Live';
};

export function view(data, ctx) {
  const role = ctx.role;
  const demo = !!(ctx.ws && ctx.ws.demo);
  const now = data.now || Date.now();
  const list = data.connectors || [];
  const base = `#/w/${encodeURIComponent(ctx.wid)}/hub`;
  const busy = data.busy || null;

  const settings = (c) => {
    if (data.open !== c.key) return '';
    const dis = busy === c.key ? ' disabled' : '';
    return html`<form class="cx-form" data-form="${c.key}">
      ${c.config_fields.map((f) => html`<label class="field"><span>${f.label}${f.optional ? ' (optional)' : ''}</span>
        <input type="text" name="${f.field}" data-cfg value="${c.config[f.field] || ''}" autocomplete="off" spellcheck="false">
        ${f.where ? html`<small class="muted">${f.where}</small>` : ''}</label>`)}
      ${c.key_fields.map((f) => {
        const k = (c.keys || {})[f.field] || {};
        const state = k.set ? (k.from === 'workspace' ? `Saved (${k.fp || 'set'})` : k.from === 'paste' ? 'Saved from a Paste step' : k.from === 'env' ? 'Set on the server' : `Using the ${String(k.from || '').split(':')[0].replace('_', ' ')} key`) : 'Not set';
        return html`<label class="field"><span>${f.label} <span class="muted cx-keystate">${state}</span></span>
          <input type="password" name="${f.field}" data-key-field autocomplete="new-password" spellcheck="false" placeholder="${k.set ? 'Leave empty to keep it' : 'Paste it here'}">
          <small class="muted">${f.where}</small></label>`;
      })}
      ${c.key === 'whatsapp' ? html`<p class="muted cx-hook">Webhook for Meta: <span class="mono">${SITE}/d2c-api/hooks/whatsapp/${ctx.wid}</span>, with the verify token above. Subscribe to messages.</p>` : ''}
      ${c.key === 'gmail' ? html`<p class="muted cx-hook">Add <span class="mono">${SITE}/d2c-api/hooks/google/callback</span> as an authorised redirect URI on the OAuth client, then save and tap Connect Gmail.</p>` : ''}
      <div class="hub-c-act"><button class="btn is-small is-primary" type="submit"${dis}>${busy === c.key ? 'Saving' : 'Save'}</button>
        <button class="btn is-small" type="button" data-act="close" data-key="${c.key}">Close</button></div>
    </form>`;
  };

  const card = (c) => {
    const dis = busy === c.key ? ' disabled' : '';
    const live = c.mode === 'live';
    const acts = [];
    if (can(role, 'member')) acts.push(html`<button class="btn is-small" type="button" data-act="sync" data-key="${c.key}"${dis}>${busy === c.key ? 'Working' : 'Sync now'}</button>`);
    if (can(role, 'admin') && !demo && data.open !== c.key) acts.push(html`<button class="btn is-small" type="button" data-act="open" data-key="${c.key}">Keys and settings</button>`);
    if (c.key === 'gmail' && can(role, 'admin') && !demo && live && c.keys?.client_id?.set && c.keys?.client_secret?.set) {
      acts.push(html`<button class="btn is-small${c.keys.refresh_token?.set ? '' : ' is-primary'}" type="button" data-act="google" data-key="gmail"${dis}>${c.keys.refresh_token?.set ? 'Sign in again' : 'Connect Gmail'}</button>`);
    }
    if (!acts.length) acts.push(html`<span class="muted hub-note">Viewers can see this but not sync it.</span>`);
    const seg = can(role, 'admin') ? html`<div class="cx-seg" role="group" aria-label="${c.name} data source">
        <button type="button" data-act="mode" data-mode="sample" data-key="${c.key}" aria-pressed="${!live}"${dis}>Sample</button>
        <button type="button" data-act="mode" data-mode="live" data-key="${c.key}" aria-pressed="${live}"${demo ? html` disabled title="A demo workspace stays on sample data. Live runs in a client workspace."` : dis}>Live</button>
      </div>` : '';
    return html`<li class="hub-c${c.status === 'ok' ? ' is-on' : ''}" data-key="${c.key}">
      <div class="hub-c-head"><b>${c.name}</b>${pillOf(STATE[c.status] || ['pending', c.status])}</div>
      <p class="muted hub-what">${c.what}</p>
      <p class="hub-meta mono">${whereFrom(c)} · ${c.fetched_at ? `Fetched ${ago(c.fetched_at, now)}` : 'Never fetched'}${c.syncing ? ' · syncing' : ''}</p>
      ${rowsLine(c.rows) ? html`<p class="hub-meta">${rowsLine(c.rows)}</p>` : ''}
      ${c.error ? html`<p class="err" role="alert">${c.error}${c.fetched_at && c.status === 'error' ? ` Showing what was fetched ${ago(c.fetched_at, now)}.` : ''}</p>` : ''}
      ${c.fix ? html`<p class="muted cx-fix">${c.fix}</p>` : ''}
      ${c.warning ? html`<p class="muted cx-fix">${c.warning}</p>` : ''}
      ${data.errors?.[c.key] ? html`<p class="err" role="alert">${data.errors[c.key]}</p>` : ''}
      ${seg}
      ${settings(c)}
      <div class="hub-c-act">${acts}</div>
    </li>`;
  };

  const tabs = html`<nav class="tabs" aria-label="Hub">
    <a href="${base}">Connectors</a>
    <a href="${base}/live" aria-current="page">Live data</a>
    <a href="${base}/syncs">Sync history</a>
  </nav>`;
  const actions = data.actions || [];
  const names = Object.fromEntries(list.map((c) => [c.key, c.name]));
  return html`<section class="pg hub cx">${tabs}
    <div class="pg-top"><div>
      <h1 class="pg-h">Live data ${sampleTag(ctx.ws)}</h1>
      <p class="pg-sub">Email, WhatsApp, Meta Ads, Instagram and Shopify, read on a schedule. Nothing is sent, refunded or changed until a person approves its card in Work.${demo ? ' This demo workspace stays on sample data.' : ''}</p>
    </div></div>
    ${data.error ? html`<p class="err" role="alert">${data.error}</p>` : ''}
    <ul class="hub-list">${list.map(card)}</ul>
    <section class="cx-acts"><h2 class="sec-h">Writes</h2>
      ${actions.length ? html`<div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Tool</th><th>What</th><th>Status</th><th>When</th><th>Note</th><th></th></tr></thead>
        <tbody>${actions.map((a) => html`<tr>
          <td>${names[a.connector] || a.connector}</td><td>${ACT[a.kind] || a.kind}${a.mode === 'sample' ? html` <span class="muted">(sample)</span>` : ''}</td>
          <td>${pillOf(RUN[a.status] || ['pending', a.status])}</td><td>${ago(a.finished_at || a.created_at, now)}</td>
          <td class="muted">${a.error || ''}</td>
          <td>${a.retryable && can(role, 'member') ? html`<button class="btn is-small" type="button" data-act="retry" data-id="${a.id}"${busy === 'retry' ? ' disabled' : ''}>Retry</button>` : ''}</td>
        </tr>`)}</tbody></table></div>`
        : html`<p class="empty card">No writes yet. Agents draft them as cards in Work.</p>`}
    </section>
  </section>`;
}

export async function mount(root, ctx) {
  if (typeof document !== 'undefined' && !document.querySelector('link[data-cx-css]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = new URL('./connectors.css', import.meta.url).href; l.dataset.cxCss = '1';
    document.head.appendChild(l);
  }
  const s = { busy: null, errors: {}, open: null, error: '' };
  let data = { connectors: [], actions: [] };
  const paint = () => { root.innerHTML = String(view({ ...data, ...s, now: Date.now() }, ctx)); };
  const load = async () => {
    const [c, a] = await Promise.all([ctx.api('GET', `/w/${ctx.wid}/connectors`), ctx.api('GET', `/w/${ctx.wid}/connectors/actions`)]);
    data = { connectors: c.connectors, actions: a.actions };
  };
  try { await load(); } catch (e) { s.error = e.message; }
  paint();

  async function run(key, fn) {
    s.busy = key; s.errors = { ...s.errors, [key]: '' }; paint();
    try { await fn(); await load(); } catch (e) { s.errors = { ...s.errors, [key]: e.message }; }
    s.busy = null; paint();
  }
  const path = (key, tail) => `/w/${ctx.wid}/connectors/${encodeURIComponent(key)}/${tail}`;

  const onClick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !root.contains(b) || b.disabled) return;
    const key = b.dataset.key, act = b.dataset.act;
    if (act === 'open' || act === 'close') { s.open = act === 'open' ? key : null; paint(); return; }
    if (act === 'mode') {
      run(key, async () => {
        const r = await ctx.api('PUT', path(key, 'mode'), { mode: b.dataset.mode });
        ctx.toast(r.sync?.ok ? `${r.connector.name}: ${b.dataset.mode === 'live' ? 'live' : 'sample'} data, synced.` : `${r.connector.name} is on ${b.dataset.mode}. ${r.connector.error || ''}`);
      });
    } else if (act === 'sync') {
      run(key, async () => { const r = await ctx.api('POST', path(key, 'sync')); ctx.toast(r.sync.ok ? `${r.connector.name} synced.` : r.sync.error); });
    } else if (act === 'google') {
      run(key, async () => { const r = await ctx.api('POST', `/w/${ctx.wid}/connectors/gmail/oauth/start`); location.href = r.url; });
    } else if (act === 'retry') {
      run('retry', async () => { const r = await ctx.api('POST', `/w/${ctx.wid}/connectors/actions/${encodeURIComponent(b.dataset.id)}/retry`); ctx.toast(r.sentence); });
    }
  };
  const onSubmit = (e) => {
    const f = e.target.closest('form[data-form]');
    if (!f || !root.contains(f)) return;
    e.preventDefault();
    const key = f.dataset.form;
    const cfg = {}, keys = {};
    f.querySelectorAll('[data-cfg]').forEach((i) => { cfg[i.name] = i.value; });
    f.querySelectorAll('[data-key-field]').forEach((i) => { if (i.value.trim()) keys[i.name] = i.value.trim(); });
    run(key, async () => {
      if (Object.keys(cfg).length) await ctx.api('PUT', path(key, 'config'), { fields: cfg });
      if (Object.keys(keys).length) await ctx.api('PUT', path(key, 'secrets'), { fields: keys });
      s.open = null;
      ctx.toast('Saved. Keys are stored encrypted and never shown again.');
    });
  };
  root.addEventListener('click', onClick);
  root.addEventListener('submit', onSubmit);
  return () => { root.removeEventListener('click', onClick); root.removeEventListener('submit', onSubmit); };
}
