// products.js: Products, every product's road from idea to doorstep (js/journey.js builds them).
//   the switcher     one card per product: its picture, where it is (stage n of 10) and a progress bar
//   the strip        the 10 stages, each with its module and day: done ticked, the current one lit, the rest dimmed
//   the checklist    the stage in view, one line per piece of work, each owned by an agent or a person; a person's
//                    decision reads as their call
//   Now              the current stage: its goal, the people on it, the agents at work and what each is doing, and
//                    what comes next
//   OS               this product's record, filling in as work happens; a dash until a value is real, each value
//                    linked to the module item it came from
// Routes: #/w/<wid>/products[/<product>[/<stage 1-10>]]
// API: GET cos/state, cos/records (js/cos.js) and the private brand pack (ctx.pack(), members only).
import { html, raw, num } from '../js/ui.js';
import { cosApi, live } from '../js/cos.js';
import { mark, face, agentOf, brandOf } from '../js/look.js';
import { STAGES, MODS, build, now, shown, href } from '../js/journey.js';

export const title = 'Products';

const CHECK = raw('<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>');
export const icon = (mod, size = 16) => raw(`<svg viewBox="0 0 16 16" width="${size}" height="${size}" aria-hidden="true"><path d="${MODS[mod]?.icon || 'M3 3h10v10H3z'}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
const tint = (mod) => raw(`style="--tint:${MODS[mod]?.tint || '#6b6a64'}"`);
const first = (n) => String(n || '').split(' ')[0];

// Pure: route params -> { product, stage } (stage is 0-based, null = the product's current stage)
export function route(params = []) {
  const [p, s] = params;
  const n = Number(s);
  return { product: p || null, stage: Number.isInteger(n) && n >= 1 && n <= 10 ? n - 1 : null };
}

// a product's picture: its shot, else a swatch in its colour
function pic(p, data, cls = '') {
  const src = data.pics?.[p.id];
  return src ? html`<img class="pj-pic ${cls}" src="${src}" alt="" loading="lazy">`
    : html`<span class="pj-pic is-swatch ${cls}" style="--sw:${p.color}" aria-hidden="true"></span>`;
}
// an owner: an agent's mark and plain name, or a person's face and first name
function owner(by, ws, size = 20) {
  return by.agent ? html`<span class="pj-own">${mark(by.agent, size)}<span>${agentOf(by.agent).name}</span></span>`
    : html`<span class="pj-own">${face(ws, by.person, size)}<span>${first(by.person)}</span></span>`;
}

// one checklist line, in the landing board's four states: Queued, Working, Done, Your call
function line(l, ws, wid, day) {
  const h = href(wid, l.link);
  const person = l.by.person ? first(l.by.person) : null;
  const pill = l.st === 'done' ? (l.call ? `${person || 'Their'} decided` : 'Done') : l.st === 'call' ? `${person ? `${person}'s` : 'Your'} call`
    : l.st === 'working' ? 'Working' : 'Queued';
  const meta = l.st === 'done' ? html`${l.call && l.choice ? html`<span class="pj-ln-c">${l.choice}</span>` : ''}${owner(l.by, ws, 18)}${day ? html`<span class="mono">day ${day}</span>` : ''}`
    : html`${owner(l.by, ws, 18)}${l.raised ? html`<span class="pj-ln-n">raised by ${agentOf(l.raised).name}</span>` : ''}${l.note ? html`<span class="pj-ln-n">${l.note}</span>` : ''}`;
  const t = h ? html`<a href="${h}">${l.t}</a>` : l.t;
  return html`<li class="pj-ln is-${l.st}${l.call ? ' is-decision' : ''}">
    <span class="pj-ck" aria-hidden="true">${l.st === 'done' ? CHECK : ''}</span>
    <div class="pj-ln-b">
      <p class="pj-ln-t">${t}</p>
      <p class="pj-ln-m">${meta}</p>
      ${l.st === 'working' && l.pct != null ? html`<span class="pj-bar" role="img" aria-label="${Math.round(l.pct * 100)}% done"><i style="width:${Math.round(l.pct * 100)}%"></i></span>` : ''}
    </div>
    <span class="pj-pill">${pill}</span>
  </li>`;
}

// Pure. data = { products, state, pics }; ctx = { wid, ws }; ui = route()
export function view(data, ctx, ui = {}) {
  const { products = [], state: s = {} } = data;
  const ws = ctx.ws || {};
  const wid = encodeURIComponent(ctx.wid);
  const base = `#/w/${wid}/products`;
  if (!products.length) {
    return html`<section class="pg pj"><h1 class="pg-h">Products</h1>
      <p class="pj-empty">No products yet. When an idea lands in #ideas, it starts its journey here.</p></section>`;
  }
  const p = products.find((x) => x.id === ui.product) || products[0];
  const sel = ui.stage ?? p.stage;
  const st = STAGES[sel];
  const n = now(p, data.presence);
  const roles = Object.fromEntries(Object.values(s.people || {}).map((x) => [x.name, x.title]));
  const roleOf = (name) => (data.roles || {})[name] || roles[name] || '';

  // ---- the switcher
  const cards = html`<nav class="pj-prods" aria-label="Products">${products.map((x) => html`<a class="pj-pc${x.id === p.id ? ' is-on' : ''}" href="${base}/${encodeURIComponent(x.id)}"${raw(x.id === p.id ? ' aria-current="page"' : '')}>
      ${pic(x, data)}
      <span class="pj-pc-b">
        <span class="pj-pc-n">${x.name}</span>
        <span class="pj-pc-s"><span class="mono">${x.stage + 1}/10</span> ${STAGES[x.stage].label}<span class="pj-tone is-${x.tone}">${x.status}</span></span>
        <span class="pj-track"><i style="width:${Math.round(x.pct * 100)}%"></i></span>
      </span>
    </a>`)}</nav>`;

  // ---- the strip
  const strip = html`<nav class="pj-strip" aria-label="${p.name}, the journey"><ol>${STAGES.map((x, i) => {
    const k = i < p.stage ? 'is-done' : i === p.stage ? 'is-now' : 'is-next';
    const d = p.days[i];
    return html`<li class="pj-st ${k}${i === sel ? ' is-sel' : ''}" ${tint(x.mod)}><a href="${base}/${encodeURIComponent(p.id)}/${i + 1}"${raw(i === sel ? ' aria-current="step"' : '')}>
      <span class="pj-dot">${i < p.stage ? CHECK : html`<span class="mono">${i + 1}</span>`}</span>
      <span class="pj-st-l">${x.label}</span>
      <span class="pj-st-m"><span class="pj-mi">${icon(x.mod, 12)}</span>#${x.mod}</span>
      <span class="pj-st-d mono">${d != null && i <= p.stage + 1 ? `Day ${d}` : ''}</span>
    </a></li>`;
  })}</ol></nav>`;

  // ---- the checklist for the stage in view
  const lines = p.lists[sel] || [];
  const doneN = lines.filter((l) => l.st === 'done').length;
  const callN = lines.filter((l) => l.st === 'call').length;
  const list = html`<section class="pj-list" ${tint(st.mod)} aria-labelledby="pj-list-h">
    <header class="pj-list-h">
      <span class="pj-mi is-lg">${icon(st.mod, 18)}</span>
      <div><h2 id="pj-list-h">${st.label} <a href="${href(ctx.wid, { thread: MODS[st.mod].thread })}">#${st.mod}</a></h2>${sel !== p.stage ? html`<p class="pj-goal">${st.goal}</p>` : ''}</div>
      <p class="pj-count mono">${sel > p.stage ? `${lines.length} queued` : `${doneN} of ${lines.length} done${callN ? `, ${callN} for a call` : ''}`}</p>
    </header>
    <ul class="pj-lines">${lines.map((l) => line(l, ws, ctx.wid, p.days[sel]))}</ul>
  </section>`;

  // ---- Now
  const nowCard = html`<section class="pj-now" aria-label="Now">
    <p class="pj-now-h"><span class="mono">Now · Day ${n.day}</span><span class="mono">Stage ${n.n} of 10</span></p>
    <div class="pj-now-p">${pic(p, data, 'is-sm')}<div><p class="pj-now-n">${p.name}</p><p class="pj-now-s">${n.stage.label}</p></div></div>
    <p class="pj-now-g">${n.stage.goal}</p>
    ${n.people.length ? html`<ul class="pj-now-who">${n.people.map((x) => html`<li>${face(ws, x, 30)}<span><b>${x}</b><span>${roleOf(x)}</span></span></li>`)}</ul>` : ''}
    ${n.agents.length ? html`<ul class="pj-now-who is-agents">${n.agents.map((a) => html`<li>${mark(a.name, 30)}<span><b>${agentOf(a.name).name}</b><span>${a.doing}</span></span></li>`)}</ul>` : ''}
    ${n.next ? html`<a class="pj-now-next" href="${base}/${encodeURIComponent(p.id)}/${n.n + 1}">Next: ${n.next.label} in #${n.next.mod}</a>`
      : html`<a class="pj-now-next" href="${href(ctx.wid, { thread: MODS.ideas.thread })}">Next: the next idea in #ideas</a>`}
  </section>`;

  // ---- OS · this product
  const os = html`<section class="pj-os" aria-labelledby="pj-os-h">
    <h2 id="pj-os-h">OS · ${p.name}</h2>
    <dl>${p.record.map((r) => {
      const v = shown(p, r), h = v != null ? href(ctx.wid, r.link) : null;
      const row = html`<dt>${r.k}</dt><dd class="${v != null ? 'mono' : 'pj-nil'}">${v != null ? v : (r.soon && r.at === p.stage ? r.soon : '—')}</dd>`;
      return h ? html`<a class="pj-os-r${r.at === p.stage ? ' is-new' : ''}" href="${h}">${row}</a>` : html`<div class="pj-os-r is-empty">${row}</div>`;
    })}</dl>
  </section>`;

  return html`<section class="pg pj">
    <header class="pj-head"><h1 class="pg-h">Products</h1>${ws.demo ? html`<span class="sample-tag">Sample data</span>` : ''}</header>
    ${cards}
    ${strip}
    <div class="pj-body">
      <div class="pj-main">${list}</div>
      <aside class="pj-side">${nowCard}${os}</aside>
    </div>
  </section>`;
}

// public sample brands' shots are static files; a private brand's are members-only assets, fetched with the session
// once per visit (kept by workspace and product)
const picCache = new Map();
export async function pictures(ctx, products, pack) {
  const key = `${ctx.wid}|${products.map((p) => p.id + ':' + (p.img || '')).join(',')}`;
  if (!picCache.has(key)) picCache.set(key, fetchPics(ctx, products, pack));
  return picCache.get(key);
}
async function fetchPics(ctx, products, pack) {
  const out = {};
  const b = brandOf(ctx.ws);
  if (!pack && b) for (const p of products) if (p.img) out[p.id] = `./assets/products/${b}/${p.img}.webp`;
  if (pack) {
    const { apiBase, token } = await import('../js/api.js');
    await Promise.all(products.filter((p) => /^kit\/[a-z0-9_-]+\.webp$/.test(String(p.img || ''))).map(async (p) => {
      try {
        const r = await fetch(`${apiBase()}/w/${encodeURIComponent(ctx.wid)}/landing/asset/${p.img}`, { headers: { authorization: `Bearer ${token.get()}` } });
        if (r.ok) out[p.id] = URL.createObjectURL(await r.blob());
      } catch { /* a swatch */ }
    }));
  }
  return out;
}

export async function mount(root, ctx) {
  let data = null;
  const load = async () => {
    const [state, recs, pk] = await Promise.all([
      cosApi(ctx, 'GET', 'state'), cosApi(ctx, 'GET', 'records').catch(() => ({ records: [] })),
      ctx.pack ? ctx.pack().catch(() => null) : null,
    ]);
    const pack = pk && pk.journey ? pk.journey : null;
    const brand = brandOf(ctx.ws) || (ctx.ws?.demo ? 'ohra' : null);
    const products = build({ brand: pack ? null : brand, pack, records: recs.records || [], people: state.people, plan: state.plan, presence: state.presence, today: state.today });
    const roles = Object.fromEntries((pk?.team || []).map((t) => [t.name, t.role]));
    // what each agent is doing right now comes from the demo engine's presence, which tells the sample brands' story;
    // a private brand's own lines say it themselves
    data = { products, state, pics: await pictures(ctx, products, pack), roles, presence: pack ? null : state.presence };
  };
  const paint = () => {
    const strip = root.querySelector('.pj-strip'), keep = strip ? strip.scrollLeft : null;
    root.innerHTML = String(view(data, ctx, route(ctx.params)));
    // a strip wider than the screen opens on the stage in view (and keeps its place on a live refresh)
    const st = root.querySelector('.pj-strip'), on = root.querySelector('.pj-st.is-sel');
    if (st && keep != null) st.scrollLeft = keep;
    else if (st && on && st.scrollWidth > st.clientWidth) st.scrollLeft = Math.max(0, on.offsetLeft - (st.clientWidth - on.offsetWidth) / 2);
  };
  const refresh = async () => { try { await load(); paint(); } catch (e) { ctx.toast(e.message); } };
  await load(); paint();
  return live(ctx, refresh);
}
export { num };
