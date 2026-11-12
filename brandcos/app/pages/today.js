// today.js: the command centre's first screen. A greeting and the daily brief (written from the workspace's
// own numbers), six KPI tiles with 14-day sparklines, what needs a person's tap, the channel split and the
// revenue trend. API: GET /w/:wid/today (and ?day= for the sparkline history), GET /w/:wid/os for low stock.
// view() is pure (Node tests import it); mount() fetches and binds.
import { html, inr, num, day, pill, sampleTag, spark } from '../js/ui.js';
import { hrefFor } from '../js/app.js';

export const title = 'Today';

const KIND = { card: 'Card', decision: 'Decision', result: 'Result to check', task: 'Task', po: 'Purchase order', invoice: 'Vendor invoice', adjustment: 'Stock adjustment' };
const AREA = { website: 'Website', performance: 'Performance', ops: 'Ops', content: 'Content', finance: 'Finance', support: 'Support', 'all-hands': 'All hands' };
// up is good for these; for ad spend and returns a change is shown without judging it
const UP_IS_GOOD = new Set(['revenue', 'orders', 'aov', 'roas']);
const DOWN_IS_BAD_FOR = new Set(['returns']);
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function fmt(value, unit) {
  if (unit === 'inr') return inr(value);
  if (unit === 'ratio') return Number(value || 0).toFixed(2) + 'x';
  if (unit === 'pct') return Number(value || 0).toFixed(1) + '%';
  return num(value);
}

export const greeting = (hour) => (hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');

function tone(k) {
  const d = k.delta_pct;
  if (d == null || d === 0) return '';
  if (UP_IS_GOOD.has(k.key)) return d > 0 ? ' is-good' : ' is-bad';
  if (DOWN_IS_BAD_FOR.has(k.key) && d > 15) return ' is-bad';
  return '';
}
function deltaLine(k) {
  if (k.delta_pct == null) return html`<span class="kpi-d">No number for last week</span>`;
  const d = k.delta_pct;
  const word = d === 0 ? 'Level' : d > 0 ? `Up ${Math.abs(d)}%` : `Down ${Math.abs(d)}%`;
  return html`<span class="kpi-d${tone(k)}" title="${fmt(k.prev, k.unit)} on the same day last week">${word}</span>`;
}
// a tile worth a second look: a money number down more than 10%, or returns up more than 25%
const watch = (k) => k.delta_pct != null && ((UP_IS_GOOD.has(k.key) && k.delta_pct <= -10) || (k.key === 'returns' && k.delta_pct >= 25));

// 14-day sparkline values per KPI: revenue, orders and average order come from the trend; the rest from the
// day-by-day history mount() fetches (data.series), when it has arrived
export function seriesFor(key, data) {
  if (data.series && data.series[key]) return data.series[key];
  const t = data.trend || [];
  if (key === 'revenue') return t.map((d) => d.revenue);
  if (key === 'orders') return t.map((d) => d.orders);
  if (key === 'aov') return t.filter((d) => d.orders).map((d) => d.revenue / d.orders);
  return [];
}

function trendSvg(trend) {
  const W = 14 * 20, H = 120, max = Math.max(1, ...trend.map((t) => t.revenue));
  const bars = trend.map((t, i) => {
    const h = t.revenue ? Math.max(2, Math.round((t.revenue / max) * (H - 6))) : 0;
    const last = i === trend.length - 1;
    return html`<rect x="${i * 20 + 3}" y="${H - h}" width="14" height="${h}" rx="2" class="${last ? 'td-bar is-last' : 'td-bar'}"><title>${day(t.day)}: ${inr(t.revenue)}, ${num(t.orders)} orders</title></rect>`;
  });
  return html`<svg class="td-trend" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Revenue for the last 14 days">
    <line x1="0" y1="${H - 0.5}" x2="${W}" y2="${H - 0.5}" class="td-axis"></line>${bars}</svg>`;
}

function needsList(ctx, needs, max = 0) {
  if (!needs.length) return html`<p class="empty">Nothing needs you right now.</p>`;
  const shown = max ? needs.slice(0, max) : needs;
  const more = needs.length - shown.length;
  return html`<ul class="td-needs">${shown.map((n) => {
    const parts = String(n.href || '').split('/').filter(Boolean);
    return html`<li><a class="td-need" href="${hrefFor(ctx.wid, ...parts)}" data-go="${parts.join('/')}">
      <span class="td-need-t">${n.title}</span>
      <span class="td-need-m mono">${KIND[n.kind] || n.kind} · ${AREA[n.area] || n.area || 'No area'}</span>
      ${pill(n.status)}</a></li>`;
  })}</ul>${more > 0 ? html`<p class="td-more"><a class="linkish" href="${hrefFor(ctx.wid, 'today', 'needs')}" data-go="today/needs">All ${needs.length} waiting</a></p>` : ''}`;
}

// the brief: the worker's sentences (built from this workspace's rows) as one paragraph, with what the OS knows
export function briefText(data) {
  const lines = [...(data.briefing || [])];
  if (data.low_stock) {
    const s = `${data.low_stock} stock ${data.low_stock === 1 ? 'line sits' : 'lines sit'} below the reorder point.`;
    lines.splice(Math.min(3, lines.length), 0, s);
  }
  return lines.join(' ');
}

export function view(data, ctx) {
  const ws = ctx.ws;
  const tab = ctx.params && ctx.params[0] === 'needs' ? 'needs' : 'today';
  const needs = (data && data.needs_you) || [];
  const tabs = html`<nav class="tabs" aria-label="Today">
    <a href="${hrefFor(ctx.wid, 'today')}" data-go="today"${tab === 'today' ? html` aria-current="page"` : ''}>Today</a>
    <a href="${hrefFor(ctx.wid, 'today', 'needs')}" data-go="today/needs"${tab === 'needs' ? html` aria-current="page"` : ''}>Needs you${needs.length ? html` <span class="tab-n">${needs.length}</span>` : ''}</a>
  </nav>`;
  if (!data) return html`<section class="pg td">${tabs}<p class="loading">Loading</p></section>`;

  const name = (ctx.me && ctx.me.user && ctx.me.user.name) || '';
  const now = data.now ? new Date(data.now) : null;
  const when = now ? `${WEEKDAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}` : '';
  const conn = data.connectors || { connected: 0, total: 0, stale: [] };
  const connLine = conn.connected
    ? html`${conn.connected} of ${conn.total} tools connected${conn.stale.length ? html`, ${conn.stale.length} not synced in a day` : ''}`
    : html`No tools connected yet`;

  if (tab === 'needs') {
    return html`<section class="pg td">${tabs}
      <div class="pg-top"><div><h1 class="pg-h">Needs you ${sampleTag(ws)}</h1>
        <p class="pg-sub">Everything an agent or a teammate has drafted that waits for a person: approve it, check it, or send it back. Newest first.</p></div></div>
      <div class="card td-needs-wrap">${needsList(ctx, needs)}</div>
    </section>`;
  }

  const kpis = data.kpis || [], trend = data.trend || [], channels = data.channels || [];
  const hasNumbers = kpis.some((k) => k.value) || trend.some((t) => t.revenue);
  const chTotal = channels.reduce((n, c) => n + (c.revenue || 0), 0);
  const decisions = needs.length;

  const head = html`<div class="td-head">
    <h1 class="pg-h">${greeting(data.hour ?? 9)}${name ? `, ${name}` : ''}. ${sampleTag(ws)}</h1>
    <p class="pg-sub">Here is ${ws.name}${when ? ` on ${when}` : ''}${data.day ? `, with numbers for ${day(data.day)}` : ''}. ${decisions
      ? `${decisions} ${decisions === 1 ? 'thing needs' : 'things need'} a decision today.`
      : 'Nothing is waiting on you.'}</p>
  </div>`;

  const brief = briefText(data)
    ? html`<article class="card td-brief">
        <header class="td-brief-h"><span class="td-mark" aria-hidden="true">C</span><div><h2>Daily brief</h2>
          <p class="mono muted">Written from ${conn.connected || 'no'} connected ${conn.connected === 1 ? 'tool' : 'tools'}, the OS and every agent run</p></div></header>
        <p class="td-brief-p">${briefText(data)}</p>
      </article>`
    : '';

  const tiles = hasNumbers ? html`<h2 class="sec-h">Numbers for ${day(data.day)} against the same day last week</h2>
    <div class="kpis td-kpis">${kpis.map((k) => html`<div class="kpi${watch(k) ? ' is-watch' : ''}">
      <span class="kpi-l">${k.label}</span>
      <span class="kpi-v">${fmt(k.value, k.unit)}</span>
      <span class="kpi-f">${deltaLine(k)}${spark(seriesFor(k.key, data), `${k.label}, last 14 days`)}</span>
    </div>`)}</div>`
    : html`<div class="card empty td-empty">No sales numbers for this day yet. They appear here once the sales tools are connected in the Hub.</div>`;

  const right = hasNumbers ? html`<div class="td-side">
      <section class="card"><h2 class="sec-h">Channels</h2>
        <ul class="td-ch">${channels.map((c) => {
          const pct = chTotal ? Math.round((c.revenue / chTotal) * 100) : 0;
          return html`<li><span class="td-ch-n">${c.label}</span><span class="td-ch-v mono">${inr(c.revenue)}</span>
            <span class="td-ch-bar" aria-hidden="true"><span style="width:${pct}%"></span></span>
            <span class="td-ch-src muted">${pct}% · ${num(c.orders)} orders${c.source_label ? html` · ${c.source ? `From ${c.source_label}` : c.source_label}` : ''}</span></li>`;
        })}</ul></section>
      <section class="card"><h2 class="sec-h">Revenue, last 14 days</h2>${trendSvg(trend)}
        <p class="td-axis-l mono"><span>${trend[0] ? day(trend[0].day) : ''}</span><span>${trend.length ? day(trend[trend.length - 1].day) : ''}</span></p></section>
    </div>` : '';

  return html`<section class="pg td">${tabs}
    ${head}
    ${brief}
    ${tiles}
    <div class="td-two${hasNumbers ? '' : ' is-one'}">
      <section class="card td-needs-wrap"><div class="td-needs-h"><h2 class="sec-h">Needs you</h2>
        <a class="td-conn mono" href="${hrefFor(ctx.wid, 'hub')}" data-go="hub">${connLine}</a></div>${needsList(ctx, needs, 7)}</section>
      ${right}
    </div>
  </section>`;
}

export async function mount(root, ctx) {
  const now = new Date();
  let data = null;
  const paint = () => { root.innerHTML = String(view(data && { ...data, now: now.getTime(), hour: now.getHours() }, ctx)); };
  paint();
  const base = `/w/${ctx.wid}`;
  const [today, os] = await Promise.all([
    ctx.api('GET', `${base}/today`),
    ctx.api('GET', `${base}/os`).catch(() => null),
  ]);
  data = { ...today, low_stock: os ? os.low_stock : 0 };
  paint();

  const onClick = (e) => {
    const a = e.target.closest('[data-go]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    e.preventDefault();
    ctx.go(...a.dataset.go.split('/'));
  };
  root.addEventListener('click', onClick);

  // sparkline history: each earlier day of the trend, for the KPIs the trend does not carry
  let live = true;
  const days = (today.trend || []).slice(0, -1).map((t) => t.day);
  if (days.length && (today.kpis || []).some((k) => k.value) && !(ctx.params && ctx.params[0] === 'needs')) {
    Promise.all(days.map((d) => ctx.api('GET', `${base}/today?day=${d}`).catch(() => null))).then((hist) => {
      if (!live || hist.some((h) => !h)) return;
      const all = [...hist, today];
      const series = {};
      for (const k of today.kpis) series[k.key] = all.map((h) => (h.kpis.find((x) => x.key === k.key) || {}).value || 0);
      data = { ...data, series };
      paint();
    });
  }
  return () => { live = false; root.removeEventListener('click', onClick); };
}
