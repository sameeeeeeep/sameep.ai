// home.js: the COS workspace, one view (laid out as Chhotu's product flow). The landing screen after sign-in.
//   top      the COS wordmark, the product chip with its switcher, the team's faces, Prev / Play demo / Next
//   strip    the 10 stages, numbered circles on one line, "#module, day N" under each
//   left     the products, then the modules (#ideas ... #crm): faces, how many agents, the latest line or what waits
//   centre   THE view: the selected module's thread. Stage posts with their checklists (an owner on every row), agent
//            posts with their decision cards (the AI pick marked), the Chief of staff relaying what people said
//            ("Aditi said: ..."), documents and images that open in place, full. A composer at the bottom.
//            With no module selected, the centre is today: the numbers, what needs you, what the agents did.
//   right    the dark Now card, Tasks across modules (open, your call first), OS · this product
// Phones: the module strip on top, then the thread; Now, Tasks and OS open in a sheet.
// Routes: #/w/<wid>/home[/<product>[/<module>[/<stage 1-10>]]]. Clicks inside the view change it in place (no reload).
import { html, raw, inr, num } from '../js/ui.js';
import { cosApi, live, bindCards, decisionCard, quickAct, quickBtn, ago, clock } from '../js/cos.js';
import { mark, face, agentOf, brandOf } from '../js/look.js';
import { STAGES, MODS, href } from '../js/journey.js';
import { loadJourney, stripView, nowView, osView, pic, checkRow, icon } from './products.js';
import { rows as taskRows, pick as taskPick, MOD_ORDER } from './tasks.js';
import { overnight } from './dash.js';

export const title = 'COS';
// which module a world function's work belongs to
export const FN_MOD = { brand: 'npd', npd: 'npd', procurement: 'npd', packaging: 'logistics', qc: 'logistics', finance: 'logistics',
  warehouse: 'warehouse', logistics: 'logistics', channels: 'listing', website: 'listing', performance: 'marketing', influencer: 'marketing',
  content: 'marketing', pr: 'marketing', crm: 'crm', support: 'crm', analytics: 'ideas', people: 'ideas', investors: 'ideas' };
// a product shot for a stage's post (sample brands)
const STAGE_SHOT = { concept: 'trials5', design: 'variants3', sourcing: 'box_flat', production: 'qc', warehouse: 'carton_top',
  live: 'hero_boxed', marketing: 'hero', orders: 'parcel', loop: 'hero' };
const KIND = { po: 'Purchase order', invoice: 'Invoice', qc: 'QC batch', stock: 'Stock', order: 'Order', task: 'Task' };
const STATUS = { draft: 'Draft', approved: 'Approved', held: 'On hold', rejected: 'Rejected', checked: 'Checked' };
const first = (n) => String(n || '').split(' ')[0];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayShort = (iso) => { const d = new Date(String(iso) + 'T00:00:00Z'); return Number.isNaN(d.getTime()) ? '' : `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };

// Pure: route params -> { product, mod, stage }
export function route(params = []) {
  const [p, m, s] = params;
  const n = Number(s);
  return { product: p || null, mod: MOD_ORDER.includes(m) ? m : null, stage: Number.isInteger(n) && n >= 1 && n <= 10 ? n - 1 : null };
}

// Pure: does a feed post belong to this product? The launch takes the posts that name no other product; another
// product takes the posts that name it.
export function forProduct(text, p, products) {
  const t = String(text || '').toLowerCase();
  const named = (x) => t.includes(x.name.toLowerCase()) || t.includes(x.name.toLowerCase().split(' ').slice(0, 2).join(' '));
  if (named(p)) return true;
  if (p.kind !== 'launch') return false;
  return !products.some((x) => x !== p && named(x));
}

// Pure: the thread of one module for one product, oldest first. Stage posts (with their checklists), then the feed's
// agent posts (with their cards and documents) and the Chief of staff's relays of what people decided.
export function thread(p, mod, feed = {}, products = [], people = {}) {
  const items = [];
  STAGES.forEach((st, i) => {
    if (st.mod !== mod || i > p.stage || !(p.lists[i] || []).length) return;
    const lines = p.lists[i];
    const agent = (lines.find((l) => l.by.agent) || {}).by?.agent || 'Chief of staff';
    items.push({ type: 'stage', i, agent, lines, day: p.days[i] });
  });
  const posts = (feed.posts || []).filter((x) => FN_MOD[x.fn] === mod).slice().sort((a, b) => a.ts - b.ts);
  const decs = feed.decisions || {};
  const nameOf = (k) => people[k]?.name || null;
  for (const x of posts) {
    const d = x.decision_id != null ? decs[x.decision_id] : null;
    if (!forProduct(`${x.text} ${d?.title || ''}`, p, products)) continue;
    if (x.actor_kind === 'agent') items.push({ type: 'agent', post: x, decision: x.verb === 'found' ? d : null });
    else if (x.verb === 'decided') {
      const who = nameOf(x.actor) || x.actor;
      const chose = d ? (d.options.find((o) => o.key === d.chosen)?.label || '') : String(x.text || '').replace(/^Chose:\s*/, '');
      if (/^[A-Z]/.test(who)) items.push({ type: 'relay', who, said: chose, ts: x.ts });
    }
  }
  return items;
}

// Pure: a module's line in the left column: the people on it, how many agents, the latest line or what waits
export function moduleRow(p, mod, feed = {}, products = []) {
  const idx = STAGES.map((s, i) => (s.mod === mod ? i : -1)).filter((i) => i >= 0);
  const lines = idx.flatMap((i) => p.lists[i] || []);
  const people = [...new Set(lines.filter((l) => l.by.person).map((l) => l.by.person))].slice(0, 3);
  const posts = (feed.posts || []).filter((x) => FN_MOD[x.fn] === mod && x.actor_kind === 'agent' && forProduct(x.text, p, products));
  const agents = new Set([...lines.filter((l) => l.by.agent).map((l) => l.by.agent), ...posts.map((x) => x.actor)]).size;
  const latest = posts.sort((a, b) => b.ts - a.ts)[0];
  const cur = idx.includes(p.stage);
  const waiting = cur ? (lines.find((l) => l.st === 'call') || lines.find((l) => l.st === 'working')) : null;
  const day = idx.filter((i) => i <= p.stage).map((i) => p.days[i]).filter((x) => x != null)[0];
  const later = idx.every((i) => i > p.stage);
  const last = latest ? { who: agentOf(latest.actor).name, text: latest.text }
    : waiting ? { who: 'Waiting', text: waiting.t } : later ? { who: 'Later', text: `Opens at ${STAGES[idx[0]].label.toLowerCase()}` } : { who: 'Done', text: `${lines.length} of ${lines.length} done` };
  return { mod, people, agents, last, cur, later, day };
}

// ---------------------------------------------------------------- the pieces
function docView(r) {
  const rows = [['Status', STATUS[r.status] || r.status], r.qty != null && ['Quantity', num(r.qty)], r.amount != null && ['Amount', `₹${Math.round(r.amount).toLocaleString('en-IN')}`],
    r.data?.vendor && ['Vendor', r.data.vendor], r.data?.location && ['Where', r.data.location], r.data?.unit && ['Per unit', `₹${r.data.unit}`], r.maker && ['Made by', r.maker]].filter(Boolean);
  return html`<details class="hv-doc"><summary><span class="hv-doc-k">${KIND[r.kind] || r.kind} <span class="mono">${r.ref}</span></span><b>${r.title}</b><span class="hv-doc-o">Open</span></summary>
    <dl>${rows.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl></details>`;
}
const shotSrc = (ws, data, p, key) => { const b = brandOf(ws); return b && key ? `./assets/products/${b}/${key}.webp` : (key && data.pics?.[p.id]) || null; };
function imgView(src, alt) {
  return src ? html`<button class="hv-img" type="button" data-full="${src}" aria-label="Open the image full size"><img src="${src}" alt="${alt}" loading="lazy"></button>` : '';
}
function msgHead(who, isAgent, ws, when) {
  return html`${isAgent ? mark(who, 32) : face(ws, who, 32)}<p class="hv-m-h"><b>${isAgent ? agentOf(who).name : who}</b>${isAgent ? html`<span class="hv-tag">Agent</span>` : ''}<span class="hv-when">${when}</span></p>`;
}

function centreThread(p, mod, data, ctx, ui) {
  const ws = ctx.ws || {};
  const s = data.state || {};
  const sx = { ...s, wid: ctx.wid };
  const recs = Object.fromEntries((data.records || []).map((r) => [r.ref, r]));
  const items = thread(p, mod, data.feed, data.products, s.people);
  const sent = (ui.sent || {})[`${p.id}:${mod}`] || [];
  const m = MODS[mod];
  const people = [...new Set(items.filter((x) => x.type === 'stage').flatMap((x) => x.lines.filter((l) => l.by.person).map((l) => l.by.person)))];
  const agents = [...new Set(items.flatMap((x) => (x.type === 'stage' ? x.lines.filter((l) => l.by.agent).map((l) => l.by.agent) : x.type === 'agent' ? [x.post.actor] : [])))];
  const post = (x) => {
    if (x.type === 'stage') {
      const st = STAGES[x.i];
      const shot = imgView(shotSrc(ws, data, p, STAGE_SHOT[st.key]), `${p.name}, ${st.label}`);
      const done = x.lines.filter((l) => l.st === 'done').length;
      return html`<li class="hv-m is-agent" id="hv-stage-${x.i}">
        ${msgHead(x.agent, true, ws, x.day != null ? `Day ${x.day}` : '')}
        <div class="hv-b"><p>${st.label}: ${st.goal} <span class="hv-q">${done} of ${x.lines.length} done.</span></p>
          ${shot}
          <ul class="pj-rows hv-todo">${x.lines.map((l) => checkRow(l, ws, ctx.wid))}</ul></div></li>`;
    }
    if (x.type === 'relay') {
      return html`<li class="hv-m is-agent">${msgHead('Chief of staff', true, ws, ago(x.ts))}<div class="hv-b"><p>${x.who} said: ${x.said}</p></div></li>`;
    }
    const r = x.post.record_ref ? recs[x.post.record_ref] : null;
    return html`<li class="hv-m is-agent">${msgHead(x.post.actor, true, ws, ago(x.post.ts))}
      <div class="hv-b"><p>${x.post.text}</p>${x.decision ? decisionCard(x.decision, sx) : ''}${r ? docView(r) : ''}</div></li>`;
  };
  const mine = sent.map((x) => html`<li class="hv-m${x.agent ? ' is-agent' : ''}">${msgHead(x.who, !!x.agent, ws, clock(x.ts))}<div class="hv-b"><p>${x.body}</p></div></li>`);
  return html`<section class="hv-c" aria-label="#${mod}">
    <header class="hv-c-h"><div><h2>#${mod}</h2><p>${STAGES.filter((s2) => s2.mod === mod).map((s2) => s2.label).join(', ')}</p></div>
      <p class="hv-c-who">${people.slice(0, 3).map((n) => html`<span class="hv-pp">${face(ws, n, 22)}${first(n)}</span>`)}${agents.slice(0, 2).map((a) => html`<span class="hv-pp">${mark(a, 22)}${agentOf(a).name}</span>`)}</p></header>
    <ul class="hv-msgs" id="hv-msgs">${items.length || mine.length ? html`${items.map(post)}${mine}` : html`<li class="hv-empty">Nothing in #${mod} for ${p.name} yet. It opens at ${STAGES.find((s2) => s2.mod === mod).label.toLowerCase()}.</li>`}</ul>
    <form class="hv-comp" data-hv-send autocomplete="off">${face(ws, s.me?.name || '', 30)}<label class="sr" for="hv-in">Message #${mod}</label>
      <input id="hv-in" maxlength="2000" placeholder="Message #${mod} about ${p.name}: people and agents both read this"><button class="btn is-primary" type="submit"${ui.busy ? ' disabled' : ''}>Send</button></form>
  </section>`;
}

function centreToday(data, ctx) {
  const ws = ctx.ws || {};
  const s = data.state || {};
  const sx = { ...s, wid: ctx.wid };
  const t = data.today;
  const kp = (k) => (t?.kpis || []).find((x) => x.key === k);
  const nums = [['Sales', kp('revenue'), inr], ['Orders', kp('orders'), num], ['Average order', kp('aov'), inr]].filter(([, k]) => k);
  const open = Object.values(data.feed?.decisions || {}).filter((d) => d.status === 'open' || d.status === 'to_check').sort((a, b) => b.ts - a.ts);
  const on = overnight(data.feed?.posts || []);
  const wid = encodeURIComponent(ctx.wid);
  const p0 = data.products[0];
  return html`<section class="hv-c is-today" aria-label="Today">
    <header class="hv-c-h"><div><h2>Today</h2><p>${t?.day ? `The latest full day, ${dayShort(t.day)}` : 'What needs you, and what the agents did'}</p></div></header>
    <div class="hv-today">
      ${nums.length ? html`<dl class="hv-nums">${nums.map(([l, k, f]) => html`<div><dt>${l}</dt><dd>${f(k.value)}</dd>${k.delta_pct != null ? html`<dd class="hv-d">${k.delta_pct > 0 ? '+' : ''}${k.delta_pct}% on last week</dd>` : ''}</div>`)}</dl>` : ''}
      <h3>${open.length ? `${open.length} things need you` : 'Nothing needs you'}</h3>
      <ul class="hv-need">${open.map((d, i) => { const a = quickAct(d, sx); const m = FN_MOD[d.fn] || 'ideas'; return html`<li>
        <a href="#/w/${wid}/home/${encodeURIComponent(p0?.id || '')}/${m}" data-hv-go="${m}"><b>${d.title}</b><span>${agentOf(d.agent).name} in #${m}</span></a>
        ${a ? quickBtn(a, i === 0 ? 'is-primary' : '', a.dec === 'check' ? 'Check' : a.verb) : ''}</li>`; })}</ul>
      ${on.n ? html`<h3>${on.n} things done ${on.span}</h3><ul class="hv-did">${on.items.slice(0, 5).map((x) => html`<li>${mark(x.actor, 24)}<span><b>${agentOf(x.actor).name}</b> ${x.text}</span></li>`)}</ul>` : ''}
    </div>
  </section>`;
}

// Pure. data = { products, state, feed, records, pics, roles, presence, today }; ui = route() + { sent, busy, sheet, playing }
export function view(data, ctx, ui = {}) {
  const ws = ctx.ws || {};
  const s = data.state || {};
  const wid = encodeURIComponent(ctx.wid);
  const products = data.products || [];
  if (!products.length) return html`<section class="hv"><p class="pj-empty">No products yet. When an idea lands in #ideas, it starts its journey here.</p></section>`;
  const p = products.find((x) => x.id === ui.product) || products[0];
  const mod = ui.mod;
  const sel = ui.stage ?? (mod ? STAGES.findIndex((x, i) => x.mod === mod && i >= p.stage) : p.stage);
  const selStage = sel >= 0 ? sel : p.stage;
  const go = (m, st) => `#/w/${wid}/home/${encodeURIComponent(p.id)}${m ? `/${m}` : ''}${st != null ? `/${st + 1}` : ''}`;
  const stageHref = (i) => go(STAGES[i].mod, i);
  const people = Object.values(s.people || {}).filter((x) => !x.placeholder);
  const agentsN = (s.presence?.running?.agents || []).length;

  const top = html`<header class="hv-top">
    <a class="hv-brand" href="${go(null)}" data-hv-go=""><b>COS</b><span>Company OS for consumer brands</span></a>
    <label class="hv-chip">${pic(p, data, 'is-chip')}<span class="sr">Product</span>
      <select data-hv-prod>${products.map((x) => html`<option value="${x.id}"${raw(x.id === p.id ? ' selected' : '')}>${x.name}</option>`)}</select>
      <span class="hv-chip-s">${STAGES[p.stage].label}, day ${p.today}</span></label>
    <span class="hv-team"><span class="hv-stack">${people.slice(0, 6).map((x) => face(ws, x.name, 28))}</span><span>${people.length} people, ${agentsN} agents</span></span>
    <span class="hv-ctl">
      <button class="btn is-small" type="button" data-hv-step="-1" aria-label="Previous stage">Prev</button>
      <button class="btn is-small is-primary" type="button" data-hv-play>${ui.playing ? 'Pause' : 'Play demo'}</button>
      <button class="btn is-small" type="button" data-hv-step="1" aria-label="Next stage">Next</button>
      <details class="hv-more"><summary>More</summary><nav>${[['products', 'Products'], ['tasks', 'Tasks'], ['chat', 'Chat'], ['canvas', 'Canvas'], ['dash', 'Dashboard'], ['agents', 'Agents'], ['hub', 'Hub'], ['team', 'Team'], ['billing', 'Billing']].map(([k, l]) => html`<a href="#/w/${wid}/${k}">${l}</a>`)}<button type="button" data-hv-account>Account</button></nav></details>
    </span>
  </header>`;

  const left = html`<aside class="hv-left" aria-label="Products and modules">
    <p class="hv-h">Products</p>
    <ul class="hv-prods">${products.map((x) => html`<li><a href="#/w/${wid}/home/${encodeURIComponent(x.id)}${mod ? `/${mod}` : ''}" data-hv-prod-go="${x.id}"${raw(x.id === p.id ? ' aria-current="true"' : '')}>${pic(x, data, 'is-row')}<span><b>${x.name}</b><span>${x.stage + 1}/10 ${STAGES[x.stage].label}</span></span></a></li>`)}</ul>
    <p class="hv-h">Modules</p>
    <a class="hv-mod is-today${!mod ? ' is-on' : ''}" href="${go(null)}" data-hv-go=""${raw(!mod ? ' aria-current="true"' : '')}><span class="hv-mod-n">Today</span><span class="hv-mod-l">The numbers and what needs you</span></a>
    ${MOD_ORDER.map((m) => { const r = moduleRow(p, m, data.feed, products); return html`<a class="hv-mod${m === mod ? ' is-on' : ''}${r.later ? ' is-later' : ''}" href="${go(m)}" data-hv-go="${m}"${raw(m === mod ? ' aria-current="true"' : '')}>
      <span class="hv-mod-n"><span class="pj-mi">${icon(m, 16)}</span>#${m}${r.day != null ? html`<span class="hv-mod-d">Day ${r.day}</span>` : ''}</span>
      <span class="hv-mod-w"><span class="pj-stack">${r.people.map((x) => face(ws, x, 22))}${r.agents ? mark('agents', 22) : ''}</span>${r.agents ? `${r.agents} agent${r.agents === 1 ? '' : 's'}` : ''}</span>
      <span class="hv-mod-l"><b>${r.last.who}:</b> ${r.last.text}</span></a>`; })}
  </aside>`;

  const open = taskPick(taskRows(products), null, 'open').slice(0, 6);
  const right = html`<aside class="hv-right" aria-label="Now, tasks and the record">
    ${nowView(p, data, ctx, stageHref)}
    <section class="pj-os hv-tasks"><h2>Tasks across modules</h2>
      <ul class="pj-rows">${open.map((r) => html`<li class="pj-row is-${r.st}"><span class="pj-ck" aria-hidden="true"></span><span class="pj-row-t"><a href="${go(r.mod, r.stage)}" data-hv-go="${r.mod}" data-hv-prod2="${r.product.id}">${r.t}</a><span>${r.st === 'call' ? `${first(r.by.person)}'s call` : r.by.agent ? agentOf(r.by.agent).name : first(r.by.person)}, #${r.mod}</span></span></li>`)}</ul>
      <a class="hv-all" href="#/w/${wid}/tasks">All tasks</a></section>
    ${osView(p, ctx)}
  </aside>`;

  const phoneMods = html`<nav class="hv-pm" aria-label="Modules"><a href="${go(null)}" data-hv-go=""${raw(!mod ? ' aria-current="true"' : '')}>Today</a>${MOD_ORDER.map((m) => html`<a href="${go(m)}" data-hv-go="${m}"${raw(m === mod ? ' aria-current="true"' : '')}>#${m}</a>`)}</nav>`;

  return html`<section class="hv${ui.sheet ? ' is-sheet' : ''}">
    ${top}
    ${stripView(p, data, mod ? selStage : -1, stageHref)}
    ${phoneMods}
    <div class="hv-cols">
      ${left}
      ${mod ? centreThread(p, mod, data, ctx, ui) : centreToday(data, ctx)}
      ${right}
    </div>
    <button class="hv-sheet-btn" type="button" data-hv-sheet aria-expanded="${String(!!ui.sheet)}">${ui.sheet ? 'Close' : `Now, stage ${p.stage + 1} of 10`}</button>
    <div class="hv-light" hidden><button type="button" data-hv-close>Close</button><img alt=""></div>
  </section>`;
}

export async function mount(root, ctx) {
  const ui = { ...route(ctx.params), sent: {}, busy: false, sheet: false, playing: false };
  let data = null, timer = null;
  const base = `/w/${encodeURIComponent(ctx.wid)}`;
  const load = async () => {
    const [j, feed, today] = await Promise.all([loadJourney(ctx), cosApi(ctx, 'GET', 'feed'), ctx.api('GET', `${base}/today`).catch(() => null)]);
    data = { ...j, feed, today };
  };
  const at = () => `#/w/${encodeURIComponent(ctx.wid)}/home/${encodeURIComponent(ui.product || data.products[0]?.id || '')}${ui.mod ? `/${ui.mod}` : ''}${ui.mod && ui.stage != null ? `/${ui.stage + 1}` : ''}`;
  const paint = (scroll = false) => {
    const strip = root.querySelector('.pj-strip'), keep = strip ? strip.scrollLeft : null;
    const msgs0 = root.querySelector('#hv-msgs'), keepMsgs = msgs0 ? msgs0.scrollTop : null;
    root.innerHTML = String(view(data, ctx, ui));
    if (!scroll && keepMsgs != null) { const m = root.querySelector('#hv-msgs'); if (m) m.scrollTop = keepMsgs; }
    const st = root.querySelector('.pj-strip'), on = root.querySelector('.pj-st.is-sel') || root.querySelector('.pj-st.is-now');
    if (st && keep != null && !scroll) st.scrollLeft = keep;
    else if (st && on && st.scrollWidth > st.clientWidth) st.scrollLeft = Math.max(0, on.offsetLeft - (st.clientWidth - on.offsetWidth) / 2);
    if (scroll) {
      const target = ui.stage != null ? root.querySelector(`#hv-stage-${ui.stage}`) : null;
      const msgs = root.querySelector('#hv-msgs');
      if (target) target.scrollIntoView({ block: 'start' }); else if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }
  };
  // move in place: no route, no reload; the address follows
  const set = (patch) => {
    Object.assign(ui, patch);
    try { history.replaceState(null, '', location.pathname + location.search + at()); } catch { /* */ }
    paint(true);
  };
  const p = () => data.products.find((x) => x.id === ui.product) || data.products[0];
  const step = (dir) => {
    const cur = ui.stage ?? (ui.mod ? STAGES.findIndex((x, i) => x.mod === ui.mod && i >= p().stage) : p().stage - 1);
    const next = Math.max(0, Math.min(p().stage, (cur < 0 ? p().stage : cur) + dir));
    set({ mod: STAGES[next].mod, stage: next });
  };
  root.addEventListener('click', (e) => {
    const t = e.target;
    const g = t.closest('[data-hv-go]');
    if (g && root.contains(g)) { e.preventDefault(); const prod = g.dataset.hvProd2; set({ mod: g.dataset.hvGo || null, stage: null, ...(prod ? { product: prod } : {}), sheet: false }); return; }
    const pg = t.closest('[data-hv-prod-go]');
    if (pg) { e.preventDefault(); set({ product: pg.dataset.hvProdGo, stage: null }); return; }
    const sa = t.closest('.pj-st a');
    if (sa && root.contains(sa)) { e.preventDefault(); const i = [...root.querySelectorAll('.pj-st a')].indexOf(sa); set({ mod: STAGES[i].mod, stage: i }); return; }
    const sp = t.closest('[data-hv-step]');
    if (sp) { step(Number(sp.dataset.hvStep)); return; }
    if (t.closest('[data-hv-play]')) {
      if (timer) { clearInterval(timer); timer = null; ui.playing = false; paint(); return; }
      ui.playing = true; set({ mod: STAGES[0].mod, stage: 0 });
      timer = setInterval(() => { const cur = ui.stage ?? 0; if (cur >= p().stage) { clearInterval(timer); timer = null; ui.playing = false; paint(); return; } step(1); }, 2600);
      return;
    }
    if (t.closest('[data-hv-sheet]')) { ui.sheet = !ui.sheet; paint(); return; }
    const im = t.closest('[data-full]');
    if (im) { const l = root.querySelector('.hv-light'); l.querySelector('img').src = im.dataset.full; l.hidden = false; return; }
    if (t.closest('[data-hv-close]') || t.classList.contains('hv-light')) { root.querySelector('.hv-light').hidden = true; return; }
    if (t.closest('[data-hv-account]')) { document.getElementById('me-btn')?.click(); return; }
  });
  root.addEventListener('change', (e) => { const s = e.target.closest('[data-hv-prod]'); if (s) set({ product: s.value, stage: null }); });
  root.addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-hv-send]');
    if (!f) return;
    e.preventDefault();
    const body = f.querySelector('input').value.trim();
    if (!body || !ui.mod) return;
    const key = `${p().id}:${ui.mod}`;
    const list = (ui.sent[key] = ui.sent[key] || []);
    list.push({ who: data.state?.me?.name || 'You', body, ts: Date.now() });
    ui.busy = true; paint(true);
    try {
      const r = await cosApi(ctx, 'POST', `threads/${MODS[ui.mod].thread}/messages`, { body });
      for (const x of r.replies || []) list.push({ who: x.author || MODS[ui.mod] && 'Chief of staff', agent: x.author_kind !== 'person', body: x.body, ts: x.ts || Date.now() });
    } catch (err) { list.push({ who: 'Chief of staff', agent: true, body: `Not sent: ${err.message}`, ts: Date.now() }); }
    ui.busy = false; paint(true);
  });
  const refresh = async () => { try { await load(); paint(); } catch (e) { ctx.toast(e.message); } };
  await load(); paint(true);
  const unbind = bindCards(root, ctx, refresh);
  const stop = live(ctx, refresh);
  return () => { stop(); unbind(); if (timer) clearInterval(timer); };
}
