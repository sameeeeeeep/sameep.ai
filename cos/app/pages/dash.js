// dash.js: the Dashboard, the first screen. A few big tiles you read at a glance, one idea each: the money, the
// orders, what needs you (with the one tap), what the agents did since yesterday, the launch, stock running low and
// the team. Details are a tap away (each tile links to its surface).
// API: GET cos/state, cos/feed (js/cos.js), GET /w/:wid/today, GET /w/:wid/os/inventory. Any of the last two may
// be missing; its tiles then step aside.
import { html, raw, inr, num } from '../js/ui.js';
import { cosApi, live, bindCards, quickAct, quickBtn, ago } from '../js/cos.js';
import { mark, agentOf, face, shot, productSrc, brandOf } from '../js/look.js';
import { STAGES, build } from '../js/journey.js';
import { pictures } from './products.js';

export const title = 'Dashboard';
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dshort = (iso) => { const d = new Date(String(iso) + 'T00:00:00Z'); return Number.isNaN(d.getTime()) ? '' : `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };
export const greeting = (h) => (h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');

// short money: ₹2.2L, ₹48K, ₹1.3Cr (from paise)
export function money(paise) {
  const r = Math.round((paise || 0) / 100);
  if (r >= 1e7) return `₹${(r / 1e7).toFixed(r >= 1e8 ? 0 : 1)}Cr`;
  if (r >= 1e5) return `₹${(r / 1e5).toFixed(r >= 1e6 ? 0 : 1)}L`;
  if (r >= 1e3) return `₹${Math.round(r / 1e3)}K`;
  return `₹${r}`;
}
const delta = (k) => (k && k.delta_pct != null ? html`<span class="db-delta">${k.delta_pct > 0 ? '+' : ''}${k.delta_pct}%<span class="db-vs"> vs last week</span></span>` : '');

// Pure: a person's name; a role key the world has not filled ("ops") reads as the role, "Ops"
export function nameOf(s, n) {
  if (!n) return '';
  const p = (s?.people || {})[n];
  if (p) return p.name;
  if (n === 'cos') return 'Chief of staff';
  return /^[a-z_]+$/.test(n) ? n.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : n;
}

// Pure: bars for a series, last bar in ink
export function bars(values, { w = 300, h = 84, label = 'Trend' } = {}) {
  const v = (values || []).map(Number);
  if (v.length < 2) return '';
  const max = Math.max(1, ...v), gap = 4, bw = (w - gap * (v.length - 1)) / v.length;
  return raw(`<svg class="db-bars" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${label}">${v.map((n, i) => {
    const bh = Math.max(2, Math.round((n / max) * (h - 2)));
    return `<rect x="${(i * (bw + gap)).toFixed(1)}" y="${h - bh}" width="${bw.toFixed(1)}" height="${bh}" rx="2"${i === v.length - 1 ? ' class="is-last"' : ''}/>`;
  }).join('')}</svg>`);
}
// Pure: a line for a series, area under it, the last point marked
export function line(values, { w = 160, h = 44, label = 'Trend' } = {}) {
  const v = (values || []).map(Number).filter(Number.isFinite);
  if (v.length < 2) return '';
  const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
  const pts = v.map((n, i) => [+(i * (w / (v.length - 1))).toFixed(1), +(h - 3 - ((n - lo) / span) * (h - 6)).toFixed(1)]);
  const d = 'M' + pts.map((p) => p.join(' ')).join(' L');
  const [lx, ly] = pts[pts.length - 1];
  return raw(`<svg class="db-line" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img" aria-label="${label}"><path class="a" d="${d} L${w} ${h} L0 ${h}Z"/><path d="${d}"/><circle cx="${lx}" cy="${ly}" r="3"/></svg>`);
}

// Pure: what the agents did since yesterday (else this week): their posts, newest first, one per decision chain
export function overnight(posts = [], now = Date.now()) {
  const agent = posts.filter((p) => p.actor_kind === 'agent').sort((a, b) => b.ts - a.ts);
  let span = 'since yesterday', list = agent.filter((p) => now - p.ts < 36 * 3600e3);
  if (list.length < 2) { span = 'this week'; list = agent.filter((p) => now - p.ts < 7 * 86400e3); }
  if (!list.length) { span = 'lately'; list = agent.slice(0, 12); }
  const agents = [...new Set(list.map((p) => p.actor))];
  return { span, n: list.length, agents, items: list };
}

// Pure. data = {state, feed:{posts,decisions}, today, inv}; ctx = {wid, ws}
export function view(data, ctx, now = Date.now()) {
  const { state: s, feed = {}, today: t, inv } = data;
  const ws = ctx.ws || { name: '', demo: s?.demo };
  const sx = { ...s, wid: ctx.wid };
  const wid = encodeURIComponent(ctx.wid);
  const go = (sec) => `#/w/${wid}/${sec}`;
  const decisions = Object.values(feed.decisions || {});
  const open = decisions.filter((d) => d.status === 'open' || d.status === 'to_check').sort((a, b) => b.ts - a.ts);
  const kp = (k) => (t?.kpis || []).find((x) => x.key === k);
  const rev = kp('revenue'), ord = kp('orders'), aov = kp('aov');
  const trend = t?.trend || [];
  const on = overnight(feed.posts, now);
  const plan = s?.plan;
  const low = (inv?.stock || []).filter((x) => x.low).sort((a, b) => a.on_hand / a.reorder_point - b.on_hand / b.reorder_point);
  const people = Object.values(s?.people || {}).filter((p) => !p.placeholder);
  const waitFor = (name) => open.filter((d) => (d.status === 'open' ? d.decider?.name : d.checker?.name) === name).length;
  const first = String(s?.me?.name || '').split(' ')[0];
  const nm = (n) => nameOf(s, n);

  // ---- tiles
  const money1 = rev ? html`<a class="db-t db-money" href="${go('today')}">
      <p class="db-l">Sales, ${dshort(t.day)}</p>
      <p class="db-big">${inr(rev.value)}</p>
      ${delta(rev)}
      ${bars(trend.map((d) => d.revenue), { label: 'Sales, last 14 days' })}
      <p class="db-axis"><span>${dshort(trend[0]?.day)}</span><span>${dshort(trend[trend.length - 1]?.day)}</span></p>
    </a>` : '';
  const small = (k, l, fmt, series) => (k ? html`<a class="db-t db-small" href="${go('today')}">
      <p class="db-l">${l}</p><p class="db-mid">${fmt(k.value)}</p>${delta(k)}${line(series, { label: `${l}, last 14 days` })}</a>` : '');
  const orders = small(ord, 'Orders', num, trend.map((d) => d.orders));
  const aovT = small(aov, 'Average order', inr, trend.filter((d) => d.orders).map((d) => d.revenue / d.orders));

  const need = (d) => {
    const a = quickAct(d, sx);
    const pic = productSrc(ws, d.fn);
    return html`<li class="db-need">
      <a class="db-need-v" href="${go(`chat/${encodeURIComponent(d.thread || 'all')}`)}" data-open-dec="${d.id}">${pic ? shot(ws, d.fn) : mark(d.agent, 44)}</a>
      <a class="db-need-t" href="${go(`chat/${encodeURIComponent(d.thread || 'all')}`)}" data-open-dec="${d.id}"><b>${d.title}</b><span>${agentOf(d.agent).name} · ${d.status === 'to_check' ? `Check ${nm(d.decided_by)}'s call` : `${nm(d.decider?.name) || 'Anyone'}${d.kind === 'ask' ? ' is asked' : ' decides'}`}</span></a>
      ${a ? quickBtn(a, 'is-primary', a.dec === 'check' ? 'Check' : a.verb) : ''}
    </li>`;
  };
  const needs = html`<section class="db-t db-needs" aria-label="Needs you">
      <div class="db-needs-h"><p class="db-big">${open.length}</p><p class="db-needs-w">${open.length === 1 ? 'thing needs you' : open.length ? 'things need you' : 'Nothing needs you'}</p></div>
      ${open.length ? html`<ul class="db-need-l">${open.slice(0, 3).map(need)}</ul>${open.length > 3 ? html`<a class="db-more" href="${go('chat/all')}">See all ${open.length}</a>` : ''}` : html`<p class="db-calm">The agents are on it.</p>`}
    </section>`;

  const night = on.n ? html`<a class="db-t db-night" href="${go('chat/all')}">
      <p class="db-mid"><b>${on.n}</b> things done</p>
      <p class="db-sub">by ${on.agents.length} agent${on.agents.length === 1 ? '' : 's'}, ${on.span}</p>
      <ul class="db-did">${on.items.slice(0, 3).map((p) => html`<li>${mark(p.actor, 24)}<span><b>${agentOf(p.actor).name}</b> ${p.text}</span></li>`)}</ul>
    </a>` : '';

  let launch = '';
  if (plan) {
    const days = Math.max(0, plan.launch - (s.today || 0));
    const nx = (plan.milestones || []).filter((m) => !m.done && m.day >= (s.today || 0)).sort((a, b) => a.day - b.day)[0];
    const pct = Math.min(100, Math.max(0, ((s.today || 0) / plan.launch) * 100));
    const pic = productSrc(ws, 'launch');
    launch = html`<a class="db-t db-launch${pic ? ' has-pic' : ''}" href="${go('company')}">
      ${pic ? html`<img class="db-launch-pic" src="${pic}" alt="" loading="lazy">` : ''}
      <p class="db-l">Launch</p>
      <p class="db-big">${days}<span class="db-unit"> days</span></p>
      <p class="db-sub">${dshort(plan.launch_date)}${plan.slack != null ? `, ${plan.slack} days spare` : ''}</p>
      <span class="db-track"><i style="width:${pct.toFixed(0)}%"></i></span>
      ${nx ? html`<p class="db-next">${face(ws, nx.owner, 24)}<span>Next: ${nx.title}, ${dshort(nx.date)}</span></p>` : ''}
    </a>`;
  }

  const stock = low.length ? html`<a class="db-t db-stock" href="${go('chat/ops/records/stock')}">
      <p class="db-l">Running low</p><p class="db-mid"><b>${low.length}</b> stock lines</p>
      <ul class="db-meters">${low.slice(0, 3).map((x) => html`<li><span class="db-m-n">${x.name}${/dark store|quick/i.test(x.location || '') ? html`<small> dark store</small>` : ''}</span><span class="db-m-b"><i style="width:${Math.min(100, Math.round((x.on_hand / x.reorder_point) * 100))}%"></i></span><span class="db-m-v">${num(x.on_hand)}</span></li>`)}</ul>
    </a>` : '';

  // every product on its road: where it is and how far along (pages/products.js has the whole journey)
  const prods = data.products || [];
  const prodsT = prods.length ? html`<a class="db-t db-prods" href="${go('products')}">
      <p class="db-l">Products</p>
      <ul>${prods.map((p) => html`<li>${data.pics?.[p.id] ? html`<img class="pj-pic" src="${data.pics[p.id]}" alt="" loading="lazy">` : html`<span class="pj-pic is-swatch" style="--sw:${p.color}" aria-hidden="true"></span>`}<span><b>${p.name}</b><small><span class="mono">${p.stage + 1}/10</span> ${STAGES[p.stage].label} · ${p.status}</small><span class="pj-track"><i style="width:${Math.round(p.pct * 100)}%"></i></span></span></li>`)}</ul>
    </a>` : '';

  const team = people.length ? html`<a class="db-t db-team" href="${go('agents')}">
      <p class="db-l">Team</p>
      <ul class="db-faces">${people.slice(0, 6).map((p) => { const n = waitFor(p.name); return html`<li>${face(ws, p.name, 48)}${n ? html`<span class="db-badge">${n}</span>` : ''}<span class="db-fn">${p.name.split(' ')[0]}</span></li>`; })}</ul>
    </a>` : '';

  return html`<section class="pg db">
    <header class="db-head"><h1>${greeting(new Date(now).getHours())}${first ? `, ${first}` : ''}</h1>${s?.demo ? html`<span class="sample-tag">Sample data</span>` : ''}</header>
    <div class="db-grid">
      ${money1}${orders}${aovT}${needs}${prodsT}${night}${launch}${stock}${team}
    </div>
  </section>`;
}

export async function mount(root, ctx) {
  let data = null;
  const base = `/w/${encodeURIComponent(ctx.wid)}`;
  const load = async () => {
    const [state, feed, today, inv] = await Promise.all([
      cosApi(ctx, 'GET', 'state'), cosApi(ctx, 'GET', 'feed'),
      ctx.api('GET', `${base}/today`).catch(() => null), ctx.api('GET', `${base}/os/inventory`).catch(() => null),
    ]);
    data = { state, feed, today, inv };
    // the products tile: the private brand's own journey (its pack), else a sample brand's, from its records
    try {
      const [recs, pk] = await Promise.all([cosApi(ctx, 'GET', 'records'), ctx.pack ? ctx.pack().catch(() => null) : null]);
      const pack = pk && pk.journey ? pk.journey : null;
      const brand = brandOf(ctx.ws) || (ctx.ws?.demo ? 'ohra' : null);
      data.products = build({ brand: pack ? null : brand, pack, records: recs.records || [], people: state.people, plan: state.plan, today: state.today });
      data.pics = await pictures(ctx, data.products, pack);
    } catch { data.products = []; }
  };
  // a fresh copy seeds on its first read; a read that raced it comes back empty, so look again shortly
  const settle = async () => { for (let i = 0; i < 4 && !(data.feed?.posts || []).length && data.state?.presence; i++) { await new Promise((r) => setTimeout(r, 1200)); await load(); } };
  const paint = () => { root.innerHTML = String(view(data, ctx)); };
  const refresh = async () => { try { await load(); paint(); } catch (e) { ctx.toast(e.message); } };
  await load(); await settle(); paint();
  const unbind = bindCards(root, ctx, refresh);
  // a tap on a waiting item opens its module's chat on that card
  root.addEventListener('click', (e) => {
    const j = e.target.closest('[data-open-dec]');
    if (!j) return;
    try { sessionStorage.setItem('cos.focusDec', j.dataset.openDec); } catch { /* */ }
  });
  const stop = live(ctx, refresh);
  return () => { stop(); unbind(); };
}
export { ago };
