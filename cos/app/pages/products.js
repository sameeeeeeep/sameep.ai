// products.js: Products, every product's road from idea to doorstep (js/journey.js builds them). Laid out as Chhotu's
// product flow: product cards, the journey strip, then three columns.
//   modules      the product's modules as plain rows: icon, name, the people on it, one status word
//   checklist    the stage in view as hairline rows: one round checkbox, the line, its owner on the right (an agent's
//                star glyph or a person's face); a person's decision reads as their call
//   Now + OS     the dark Now card (the current stage, its people and agents, what comes next) and the product's
//                record, a dash until a value is real, each value linked to the module item it came from
// One accent (the current stage, the primary button, focus); no tints, washes or nested cards.
// Routes: #/w/<wid>/products[/<product>[/<stage 1-10>]]
// API: GET cos/state, cos/records (js/cos.js) and the private brand pack (ctx.pack(), members only).
import { html, raw, num } from '../js/ui.js';
import { cosApi, live } from '../js/cos.js';
import { mark, face, agentOf, brandOf } from '../js/look.js';
import { STAGES, MODS, build, now, shown, href } from '../js/journey.js';

export const title = 'Products';

const CHECK = raw('<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>');
export const icon = (mod, size = 16) => raw(`<svg viewBox="0 0 16 16" width="${size}" height="${size}" aria-hidden="true"><path d="${MODS[mod]?.icon || 'M3 3h10v10H3z'}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
const first = (n) => String(n || '').split(' ')[0];
const MOD_ORDER = ['ideas', 'npd', 'logistics', 'warehouse', 'listing', 'marketing', 'crm'];

// Pure: route params -> { product, stage } (stage is 0-based, null = the product's current stage)
export function route(params = []) {
  const [p, s] = params;
  const n = Number(s);
  return { product: p || null, stage: Number.isInteger(n) && n >= 1 && n <= 10 ? n - 1 : null };
}

// a product's picture: its shot, else a swatch in its colour (the product's own colour, never chrome)
function pic(p, data, cls = '') {
  const src = data.pics?.[p.id];
  return src ? html`<img class="pj-pic ${cls}" src="${src}" alt="" loading="lazy">`
    : html`<span class="pj-pic is-swatch ${cls}" style="--sw:${p.color}" aria-hidden="true"></span>`;
}
// an owner on the right of a row: the agent's glyph and name, or the person's face and first name
function owner(l, ws) {
  if (l.by.agent) return html`<span class="pj-own">${mark(l.by.agent, 20)}<span>${agentOf(l.by.agent).name}</span></span>`;
  const n = first(l.by.person);
  return html`<span class="pj-own">${face(ws, l.by.person, 20)}<span>${n}</span></span>`;
}

// Pure: each module's word for this product. Done, Working, Your call, or Later; and the people on it.
export function modules(p) {
  return MOD_ORDER.map((m) => {
    const idx = STAGES.map((s, i) => (s.mod === m ? i : -1)).filter((i) => i >= 0);
    const lines = idx.flatMap((i) => p.lists[i] || []);
    const people = [...new Set(lines.filter((l) => l.by.person).map((l) => l.by.person))].slice(0, 3);
    const agents = new Set(lines.filter((l) => l.by.agent).map((l) => l.by.agent)).size;
    const cur = idx.includes(p.stage);
    const word = idx.every((i) => i < p.stage) ? 'Done' : cur ? (lines.some((l) => l.st === 'call') ? 'Your call' : 'Working')
      : idx.some((i) => i < p.stage) ? 'Done so far' : 'Later';
    const go = cur ? p.stage : idx.find((i) => i > p.stage) ?? idx[idx.length - 1];
    return { mod: m, people, agents, word, go, cur };
  });
}

// one checklist row: a round box, the line (and one quiet second line), a bar while it moves, the owner on the right
function row(l, ws, wid) {
  const h = href(wid, l.link);
  const sub = l.st === 'done' && l.call && l.choice ? l.choice : l.raised ? `Raised by ${agentOf(l.raised).name}` : l.note;
  return html`<li class="pj-row is-${l.st}">
    <span class="pj-ck" aria-hidden="true">${l.st === 'done' ? CHECK : ''}</span>
    <span class="pj-row-t">${h ? html`<a href="${h}">${l.t}</a>` : l.t}${sub ? html`<span>${sub}</span>` : ''}</span>
    ${l.st === 'working' && l.pct != null ? html`<span class="pj-bar" role="img" aria-label="${Math.round(l.pct * 100)}% done"><i style="width:${Math.round(l.pct * 100)}%"></i></span>` : ''}
    ${owner(l, ws)}
    ${l.st === 'call' && h ? html`<a class="pj-act" href="${h}">Decide</a>` : ''}
    <span class="sr">${l.st === 'done' ? 'Done' : l.st === 'call' ? 'Waiting for a decision' : l.st === 'working' ? 'Working' : 'Queued'}</span>
  </li>`;
}

// Pure. data = { products, state, pics, roles, presence }; ctx = { wid, ws }; ui = route()
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
  const stageHref = (i) => `${base}/${encodeURIComponent(p.id)}/${i + 1}`;

  // ---- product cards
  const cards = html`<nav class="pj-prods" aria-label="Products">${products.map((x) => html`<a class="pj-pc" href="${base}/${encodeURIComponent(x.id)}"${raw(x.id === p.id ? ' aria-current="page"' : '')}>
      ${pic(x, data)}
      <span class="pj-pc-b">
        <span class="pj-pc-n"><b>${x.name}</b><span>${x.cat}</span></span>
        <span class="pj-track"><i style="width:${Math.round(x.pct * 100)}%"></i></span>
        <span class="pj-pc-s"><span>${x.stage + 1}/10 ${STAGES[x.stage].label}</span><span class="pj-tone is-${x.tone}">${x.status}</span></span>
      </span>
    </a>`)}</nav>`;

  const strip = stripView(p, data, sel, stageHref);

  // ---- modules: plain rows
  const mods = html`<nav class="pj-mods" aria-label="Modules">${modules(p).map((m) => html`<a class="pj-mod${STAGES[sel].mod === m.mod ? ' is-on' : ''}" href="${stageHref(m.go)}"${raw(STAGES[sel].mod === m.mod ? ' aria-current="true"' : '')}>
      <span class="pj-mi">${icon(m.mod, 16)}</span>
      <span class="pj-mod-n">#${m.mod}</span>
      <span class="pj-mod-w${m.cur ? ' is-cur' : ''}">${m.word}</span>
      <span class="pj-stack">${m.people.map((x) => face(ws, x, 22))}${m.agents ? mark('agents', 22) : ''}</span>
    </a>`)}</nav>`;

  // ---- the checklist for the stage in view
  const lines = p.lists[sel] || [];
  const doneN = lines.filter((l) => l.st === 'done').length;
  const earlier = sel === p.stage && p.stage > 0 ? p.lists.slice(0, p.stage).flat().length : 0;
  const d = p.days[sel];
  const list = html`<section class="pj-list" aria-labelledby="pj-list-h">
    <header class="pj-list-h">
      <h2 id="pj-list-h">${st.label}</h2>
      <p>${sel === p.stage ? 'Now' : sel < p.stage ? 'Done' : 'Next'} in <a href="${href(ctx.wid, { thread: MODS[st.mod].thread })}">#${st.mod}</a>${d != null && sel <= p.stage ? `, from day ${d}` : ''}. ${sel > p.stage ? `${lines.length} to do` : `${doneN} of ${lines.length} done`}</p>
    </header>
    <ul class="pj-rows">
      ${earlier ? html`<li class="pj-row is-earlier"><a href="${stageHref(p.stage - 1)}">Earlier: ${p.stage} stages, ${earlier} done</a></li>` : ''}
      ${lines.map((l) => row(l, ws, ctx.wid))}
    </ul>
  </section>`;

  const nowCard = nowView(p, data, ctx, stageHref);
  const os = osView(p, ctx);

  return html`<section class="pg pj">
    <header class="pj-head"><h1 class="pg-h">Products</h1>${ws.demo ? html`<span class="sample-tag">Sample data</span>` : ''}</header>
    ${cards}
    ${strip}
    <div class="pj-cols">
      ${mods}
      ${list}
      <aside class="pj-side">${nowCard}${os}</aside>
    </div>
  </section>`;
}


// ---- shared pieces (the Products view and the one-view workspace, pages/home.js)
// the strip: numbered circles on one line, the line filled up to the current stage. stageHref(i) -> where a stage goes
export function stripView(p, data, sel, stageHref) {
  const fill = (p.stage / (STAGES.length - 1)) * 90;
  return html`<nav class="pj-strip" aria-label="${p.name}, the journey"><ol style="--fill:${fill.toFixed(1)}%">${STAGES.map((x, i) => {
    const k = i < p.stage ? 'is-done' : i === p.stage ? 'is-now' : 'is-next';
    const d = p.days[i];
    return html`<li class="pj-st ${k}${i === sel ? ' is-sel' : ''}"><a href="${stageHref(i)}"${raw(i === p.stage ? ' aria-current="step"' : '')}>
      <span class="pj-dot">${i < p.stage ? CHECK : i === p.stage ? pic(p, data, 'is-dot') : html`<span>${i + 1}</span>`}</span>
      <span class="pj-st-l">${x.label}</span>
      <span class="pj-st-m">#${x.mod}${d != null && i <= p.stage + 1 ? `, day ${d}` : ''}</span>
    </a></li>`;
  })}</ol></nav>`;
}
// the dark Now card: the current stage, its goal, its people and agents, and what comes next
export function nowView(p, data, ctx, stageHref) {
  const ws = ctx.ws || {};
  const n = now(p, data.presence);
  const roles = Object.fromEntries(Object.values(data.state?.people || {}).map((x) => [x.name, x.title]));
  const roleOf = (name) => (data.roles || {})[name] || roles[name] || '';
  return html`<section class="pj-now" aria-label="Now">
    <p class="pj-now-h"><span>Now · Day ${n.day}</span><span>Stage ${n.n} of 10</span></p>
    <div class="pj-now-p">${pic(p, data, 'is-tall')}<div><p class="pj-now-n">${p.name}</p><p class="pj-now-s">${n.stage.label}</p><p class="pj-now-g">${n.stage.goal}</p></div></div>
    ${n.people.length || n.agents.length ? html`<ul class="pj-now-who">
      ${n.people.map((x) => html`<li>${face(ws, x, 30)}<span><b>${x}</b><span>${roleOf(x)}</span></span></li>`)}
      ${n.agents.map((a) => html`<li>${mark(a.name, 30)}<span><b>${agentOf(a.name).name}</b><span>${a.doing}</span></span></li>`)}
    </ul>` : ''}
    ${n.next ? html`<a class="pj-now-next" href="${stageHref(n.n)}">Next: ${n.next.label} in #${n.next.mod}</a>`
      : html`<a class="pj-now-next" href="${href(ctx.wid, { thread: MODS.ideas.thread })}">Next: the next idea in #ideas</a>`}
  </section>`;
}
// OS · this product: the record, a dash until a value is real, each value linked to where it came from
export function osView(p, ctx) {
  return html`<section class="pj-os" aria-label="OS, ${p.name}">
    <h2>OS · ${p.name}</h2>
    <dl>${p.record.map((r) => {
      const v = shown(p, r), h = v != null ? href(ctx.wid, r.link) : null;
      const cell = html`<dt>${r.k}</dt><dd>${v != null ? v : (r.soon && r.at === p.stage ? r.soon : '—')}</dd>`;
      return h ? html`<a class="pj-os-r" href="${h}">${cell}</a>` : html`<div class="pj-os-r is-empty">${cell}</div>`;
    })}</dl>
  </section>`;
}
export { pic, row as checkRow, CHECK };

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

// Every product's journey for a workspace: its state, records and (for a private brand) its pack. Shared by Products,
// Tasks, Canvas, the Dashboard tile and the sidebar's product list. ctx needs { wid, ws, api, pack? }.
export async function loadJourney(ctx) {
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
  return { products, state, records: recs.records || [], pack, pics: await pictures(ctx, products, pack), roles, presence: pack ? null : state.presence };
}

export async function mount(root, ctx) {
  let data = null;
  const load = async () => { data = await loadJourney(ctx); };
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
