// today.js (module B): the day at a glance. KPIs against the same weekday last week, a 14-day revenue trend,
// the channel split, what needs a tap, and a short briefing written from the numbers.
// API: GET /d2c-api/w/:wid/today (CONTRACT.md "Today"). view() is pure; mount() fetches and binds.
import { html, inr, num, day, pill, sampleTag } from '../js/ui.js';
import { hrefFor } from '../js/app.js';

export const title = 'Today';

const KIND = { card: 'Card', task: 'Task', po: 'Purchase order', invoice: 'Vendor invoice', adjustment: 'Stock adjustment' };
const AREA = { website: 'Website', performance: 'Performance', ops: 'Ops', content: 'Content', finance: 'Finance', support: 'Support', 'all-hands': 'All hands' };
// up is good for these; for ad spend and returns a change is shown without judging it
const UP_IS_GOOD = new Set(['revenue', 'orders', 'aov', 'roas']);

export function fmt(value, unit) {
  if (unit === 'inr') return inr(value);
  if (unit === 'ratio') return Number(value || 0).toFixed(2) + 'x';
  if (unit === 'pct') return Number(value || 0).toFixed(1) + '%';
  return num(value);
}

function deltaLine(k) {
  if (k.delta_pct == null) return html`<span class="td-delta muted">No number for last week</span>`;
  const d = k.delta_pct;
  const tone = d === 0 || !UP_IS_GOOD.has(k.key) ? '' : d > 0 ? ' is-good' : ' is-bad';
  const word = d === 0 ? 'Level' : d > 0 ? `Up ${Math.abs(d)}%` : `Down ${Math.abs(d)}%`;
  return html`<span class="td-delta${tone}">${word} <span class="muted">vs ${fmt(k.prev, k.unit)} last week</span></span>`;
}

function trendSvg(trend) {
  const W = 14 * 20, H = 96, max = Math.max(1, ...trend.map((t) => t.revenue));
  const bars = trend.map((t, i) => {
    const h = t.revenue ? Math.max(2, Math.round((t.revenue / max) * (H - 4))) : 0;
    const last = i === trend.length - 1;
    return html`<rect x="${i * 20 + 2}" y="${H - h}" width="16" height="${h}" rx="3" class="${last ? 'td-bar is-last' : 'td-bar'}"><title>${day(t.day)}: ${inr(t.revenue)}, ${num(t.orders)} orders</title></rect>`;
  });
  return html`<svg class="td-trend" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Revenue for the last 14 days">
    <line x1="0" y1="${H - 0.5}" x2="${W}" y2="${H - 0.5}" class="td-axis"></line>${bars}</svg>`;
}

export function view(data, ctx) {
  const ws = ctx.ws;
  const top = html`<div class="pg-top"><div><h1 class="pg-h">Today ${sampleTag(ws)}</h1>
    <p class="pg-sub">${data?.day ? day(data.day) : ''}${data?.day ? '. ' : ''}Compared with the same day last week.</p></div></div>`;
  if (!data) return html`<section class="pg td">${top}<p class="loading">Loading</p></section>`;

  const kpis = data.kpis || [], trend = data.trend || [], channels = data.channels || [], needs = data.needs_you || [];
  const hasNumbers = kpis.some((k) => k.value) || trend.some((t) => t.revenue);
  const chTotal = channels.reduce((n, c) => n + (c.revenue || 0), 0);
  const conn = data.connectors || { connected: 0, total: 0, stale: [] };

  const brief = (data.briefing || []).length
    ? html`<div class="card td-brief"><h2 class="td-h">Briefing</h2><ul>${data.briefing.map((s) => html`<li>${s}</li>`)}</ul></div>`
    : '';

  const numbers = hasNumbers ? html`
    <div class="td-kpis">${kpis.map((k) => html`<div class="card td-kpi"><span class="td-label">${k.label}</span>
      <span class="td-value">${fmt(k.value, k.unit)}</span>${deltaLine(k)}</div>`)}</div>
    <div class="td-two">
      <div class="card"><h2 class="td-h">Revenue, last 14 days</h2>${trendSvg(trend)}
        <p class="td-axis-l mono"><span>${trend[0] ? day(trend[0].day) : ''}</span><span>${trend.length ? day(trend[trend.length - 1].day) : ''}</span></p></div>
      <div class="card"><h2 class="td-h">Channels</h2>
        <ul class="td-ch">${channels.map((c) => {
          const pct = chTotal ? Math.round((c.revenue / chTotal) * 100) : 0;
          return html`<li><span class="td-ch-n">${c.label} <span class="td-ch-p mono">${pct}%</span></span><span class="td-ch-v">${inr(c.revenue)} <span class="muted">${num(c.orders)} orders</span></span>
            ${c.source_label ? html`<span class="td-ch-src muted">${c.source ? `From ${c.source_label}` : c.source_label}</span>` : ''}
            <span class="td-ch-bar" aria-hidden="true"><span style="width:${pct}%"></span></span></li>`;
        })}</ul></div>
    </div>`
    : html`<div class="card empty td-empty">No sales numbers for this day yet. They appear here once the sales tools are connected in Hub and connections.</div>`;

  const needList = needs.length
    ? html`<ul class="td-needs">${needs.map((n) => {
        const parts = String(n.href || '').split('/').filter(Boolean);
        return html`<li><a class="td-need" href="${hrefFor(ctx.wid, ...parts)}" data-go="${parts.join('/')}">
          <span class="td-need-t">${n.title}</span>
          <span class="td-need-m mono">${KIND[n.kind] || n.kind} · ${AREA[n.area] || n.area || ''}</span>
          ${pill(n.status)}</a></li>`;
      })}</ul>`
    : html`<p class="empty">Nothing needs you right now.</p>`;

  const connLine = conn.connected
    ? html`${conn.connected} of ${conn.total} tools connected${conn.stale.length ? html`, <span class="td-stale">${conn.stale.length} not synced in a day</span>` : ''}.`
    : html`No tools connected yet.`;

  return html`<section class="pg td">${top}
    ${brief}
    ${numbers}
    <div class="card td-needs-wrap"><div class="td-needs-h"><h2 class="td-h">Needs you</h2>
      <a class="td-conn muted" href="${hrefFor(ctx.wid, 'hub')}" data-go="hub">${connLine}</a></div>${needList}</div>
  </section>`;
}

export async function mount(root, ctx) {
  root.innerHTML = String(view(null, ctx));
  const data = await ctx.api('GET', `/w/${ctx.wid}/today`);
  root.innerHTML = String(view(data, ctx));
  const onClick = (e) => {
    const a = e.target.closest('[data-go]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    e.preventDefault();
    ctx.go(...a.dataset.go.split('/'));
  };
  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}
