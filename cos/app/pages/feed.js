// feed.js: the Feed, ranked rather than a raw log. Three parts:
//   Needs you     the decisions waiting for a person, each with who raised it (a cat), one picture, the number that
//                 matters and the one tap; the full card (js/cos.js decisionCard) opens under Details.
//   Done for you  the closed decisions, a whole chain (found, decided, checked, done) as one line, batched into a
//                 digest per day ("3 agents closed 4 things") that opens.
//   FYI           everything else the agents posted, batched per agent and deduped.
// group() is pure (Node tests import it); view() renders it; mount() fetches and binds.
import { html } from '../js/ui.js';
import { cosApi, live, bindCards, decisionCard, quickAct, quickBtn, ago, clock, loadFaces } from '../js/cos.js';
import { cat, catOf, face, productSrc, shot } from '../js/look.js';
import { nameOf } from './dash.js';

export const title = 'Feed';

export function dayKey(ms, now = Date.now()) {
  const d0 = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const diff = Math.round((d0(now) - d0(ms)) / 86400e3);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return 'This week';
  return 'Earlier';
}

// Pure: where a thing came from, as a chip: WhatsApp, email, a meeting, a connector, an agent's own work.
// src: 'whatsapp:Brand group' (a post) or {kind, from} (a decision); ts: when it came in
const SRC = { whatsapp: 'WhatsApp', email: 'Email', meeting: 'Meeting', connector: 'Data', vendor: 'Vendor', agent: 'Agent' };
export function srcOf(src) {
  if (!src) return null;
  if (typeof src === 'object') return src.kind ? { kind: src.kind, label: SRC[src.kind] || src.kind, from: src.from || '', text: src.text || '' } : null;
  const [k, ...rest] = String(src).split(':');
  return { kind: k, label: SRC[k] || k, from: rest.join(':'), text: '' };
}
export const srcChip = (src, ts) => { const x = srcOf(src); return x ? html`<span class="fd-src is-${x.kind}"><b>${x.label}</b>${x.from ? html`<span>${x.from}</span>` : ''}${ts ? html`<span class="fd-src-t">${clock(ts)}</span>` : ''}</span>` : ''; };

// Pure: posts + decisions -> { needs, done: [{k, items}], fyi: [{actor, posts}] }
export function group(posts = [], decisions = {}, now = Date.now()) {
  const byDec = new Map();
  for (const p of posts) if (p.decision_id != null) { if (!byDec.has(p.decision_id)) byDec.set(p.decision_id, []); byDec.get(p.decision_id).push(p); }
  const all = Object.values(decisions);
  const rank = (d) => (d.status === 'to_check' ? 0 : 1);
  const needs = all.filter((d) => d.status === 'open' || d.status === 'to_check').sort((a, b) => rank(a) - rank(b) || b.ts - a.ts)
    .map((d) => ({ d, post: (byDec.get(d.id) || []).find((p) => p.actor_kind === 'agent') || null }));
  const closed = all.filter((d) => d.status === 'done' || d.status === 'sent_back').map((d) => {
    const chain = (byDec.get(d.id) || []).slice().sort((a, b) => b.ts - a.ts);
    const did = chain.find((p) => p.actor_kind === 'agent' && p.verb === 'did');
    const ts = Math.max(d.updated || 0, d.checked_ts || 0, d.decided_ts || 0, ...chain.map((p) => p.ts));
    return { d, agent: d.agent || chain.find((p) => p.actor_kind === 'agent')?.actor || 'Chief of staff', result: did ? did.text : null, ts };
  }).sort((a, b) => b.ts - a.ts);
  const done = [];
  for (const it of closed) {
    const k = dayKey(it.ts, now);
    if (!done.length || done[done.length - 1].k !== k) done.push({ k, items: [] });
    done[done.length - 1].items.push(it);
  }
  // FYI: posts tied to no decision we show, batched by agent, the same line once
  const known = new Set(all.map((d) => d.id));
  const seen = new Set();
  const loose = posts.filter((p) => (p.decision_id == null || !known.has(p.decision_id)) && !seen.has(p.actor + '|' + p.text) && seen.add(p.actor + '|' + p.text)).sort((a, b) => b.ts - a.ts);
  const fyi = [];
  for (const p of loose) {
    const g = fyi.find((x) => x.actor === p.actor);
    if (g) g.posts.push(p); else fyi.push({ actor: p.actor, agent: p.actor_kind === 'agent', posts: [p] });
  }
  return { needs, done, fyi };
}

// Pure. data = {state, posts, decisions}
export function view(data, ctx, ui = {}, now = Date.now()) {
  const { state: s, posts = [], decisions = {} } = data;
  const ws = ctx.ws || { name: '', demo: s?.demo };
  const sx = { ...s, wid: ctx.wid };
  const g = group(posts, decisions, now);
  const nm = (n) => nameOf(s, n);
  const pf = (n, z) => (n === 'Chief of staff' ? cat(n, z) : face(ws, n, z)); // a person's face; the chief of staff is a cat

  const need = ({ d, post }) => {
    const a = quickAct(d, sx);
    const pic = productSrc(ws, d.fn);
    const rec = d.options.find((o) => o.recommended) || d.options[0];
    const n = d.numbers?.[0];
    const c = catOf(d.agent);
    return html`<article class="fd-need" id="need-${d.id}">
      <div class="fd-need-top">
        <span class="fd-pic${pic ? '' : ' is-cat'}">${pic ? shot(ws, d.fn) : cat(d.agent, 56)}</span>
        <div class="fd-need-b">
          <p class="fd-who">${pic ? cat(d.agent, 22) : ''}<b>${c.name}</b><span>${c.role}${post ? `, ${ago(post.ts, now)}` : ''}</span></p>
          <h3 class="fd-need-t">${d.title}</h3>
          ${d.source || post?.source ? html`<details class="fd-orig"><summary>${srcChip(d.source || post.source, post?.ts || d.ts)}</summary>
            <blockquote class="fd-quote">${srcOf(d.source)?.text || post?.text || ''}</blockquote>
            ${d.thread ? html`<a class="fd-open" href="#/w/${encodeURIComponent(ctx.wid)}/chat/${encodeURIComponent(d.thread)}">Open in ${d.thread_name ? `#${d.thread_name.toLowerCase()}` : 'Chat'}</a>` : ''}</details>` : ''}
          ${n ? html`<p class="fd-num"><b>${n.value}</b><span>${n.label}</span></p>` : ''}
        </div>
      </div>
      <div class="fd-act">
        ${d.status === 'to_check'
          ? html`<p class="fd-sug">${pf(nm(d.decided_by), 22)}<span>${nm(d.decided_by)} chose <b>${d.options.find((o) => o.key === d.chosen)?.label || ''}</b></span></p>`
          : rec ? html`<p class="fd-sug">${pf(nm(d.decider?.name), 22)}<span>${nm(d.decider?.name) || 'Anyone'}${d.kind === 'ask' ? ', asked' : ''}: <b>${rec.label}</b>${d.options.length > 1 ? html` <span class="muted">or ${d.options.length - 1} more</span>` : ''}</span></p>` : ''}
        ${a ? quickBtn(a, 'is-primary', a.dec === 'check' ? 'Check' : a.verb) : ''}
      </div>
      <details class="fd-more"><summary>Details</summary>${decisionCard(d, sx)}</details>
    </article>`;
  };

  const closedLine = (it) => html`<li class="fd-done">
    ${cat(it.agent, 32)}
    <div><p><b>${catOf(it.agent).name}</b> ${it.result || it.d.title}</p>
      <p class="fd-done-m">${it.d.decided_by ? html`${pf(nm(it.d.decided_by), 18)}<span>${nm(it.d.decided_by)} chose${it.d.checked_by ? `, ${nm(it.d.checked_by)} checked` : ''}</span>` : ''}${srcChip(it.d.source)}<span class="fd-t">${ago(it.ts, now)}</span></p></div>
  </li>`;
  const digest = (grp, i) => {
    const agents = [...new Set(grp.items.map((x) => x.agent))];
    return html`<details class="fd-digest" id="dg-${i}"${i === 0 && ui.openFirst ? ' open' : ''}>
      <summary><span class="fd-stack">${agents.slice(0, 4).map((a) => cat(a, 34))}</span>
        <span class="fd-dg-t"><b>${agents.length} agent${agents.length === 1 ? '' : 's'} closed ${grp.items.length} thing${grp.items.length === 1 ? '' : 's'}</b><span>${grp.k}</span></span></summary>
      <ul class="fd-done-l">${grp.items.map(closedLine)}</ul>
    </details>`;
  };
  const fyiItem = (f, i) => {
    const p = f.posts[0];
    const one = html`<div class="fd-fyi-h">${f.agent ? cat(f.actor, 32) : face(ws, nm(f.actor), 32)}<div><p><b>${f.agent ? catOf(f.actor).name : nm(f.actor)}</b> ${p.text}</p><p class="fd-done-m">${srcChip(p.source, p.ts)}<span class="fd-t">${ago(p.ts, now)}</span></p></div></div>`;
    if (f.posts.length === 1) return html`<li class="fd-fyi">${one}</li>`;
    return html`<li class="fd-fyi" id="fy-${i}"><details><summary>${one}<span class="fd-n">${f.posts.length - 1} more</span></summary>
      <ul class="fd-fyi-l">${f.posts.slice(1).map((q) => html`<li>${q.text}<span class="fd-t">${ago(q.ts, now)}</span></li>`)}</ul></details></li>`;
  };

  return html`<section class="pg fd">
    <header class="db-head"><h1>Feed</h1>${s?.demo ? html`<span class="sample-tag">Sample data</span>` : ''}</header>
    <div class="fd-cols"><div class="fd-col">
    <h2 class="fd-h">Needs you <span class="fd-c">${g.needs.length}</span></h2>
    ${g.needs.length ? html`<div class="fd-needs">${g.needs.map(need)}</div>` : html`<p class="fd-calm">Nothing needs you. The agents are on it.</p>`}
    </div><div class="fd-col">
    ${g.done.length ? html`<h2 class="fd-h">Done for you</h2><div class="fd-digests">${g.done.map(digest)}</div>` : ''}
    ${g.fyi.length ? html`<h2 class="fd-h">FYI</h2><ul class="fd-fyis">${g.fyi.map(fyiItem)}</ul>` : ''}
    </div></div>
  </section>`;
}

export async function mount(root, ctx) {
  let data = null;
  const load = async () => {
    const [state, f] = await Promise.all([cosApi(ctx, 'GET', 'state'), cosApi(ctx, 'GET', 'feed')]);
    data = { state, ...f };
    await loadFaces(ctx, state.people);
  };
  // a fresh copy seeds on its first read; a read that raced it comes back empty, so look again shortly
  const settle = async () => { for (let i = 0; i < 4 && !(data.posts || []).length && data.state?.presence; i++) { await new Promise((r) => setTimeout(r, 1200)); await load(); } };
  // keep what the person opened across a live refresh
  const paint = () => {
    const open = new Set([...root.querySelectorAll('details[open]')].map((d) => d.closest('[id]')?.id + '|' + d.className));
    root.innerHTML = String(view(data, ctx, { openFirst: !paint.n }));
    paint.n = (paint.n || 0) + 1;
    for (const d of root.querySelectorAll('details')) if (open.has(d.closest('[id]')?.id + '|' + d.className)) d.open = true;
  };
  const refresh = async () => { try { await load(); paint(); } catch (e) { ctx.toast(e.message); } };
  await load(); await settle(); paint();
  focusCard(root, ctx);
  const unbind = bindCards(root, ctx, refresh);
  const stop = live(ctx, refresh);
  return () => { stop(); unbind(); };
}

// scroll to a waiting item and outline it briefly (from the Dashboard, or the presenter panel)
export function flash(root, id) {
  const card = root.querySelector(`#dec-${id}`);
  if (!card) return;
  const box = card.closest('.fd-need') || card;
  box.scrollIntoView({ block: 'center' });
  box.classList.add('is-flash');
  setTimeout(() => box.classList.remove('is-flash'), 2200);
}
// the presenter panel (cos.focus = a flow) or the Dashboard (cos.focusDec = a decision id) focuses a card once
export function focusCard(root, ctx) {
  let flow = null, dec = null;
  try { flow = sessionStorage.getItem('cos.focus'); sessionStorage.removeItem('cos.focus'); dec = sessionStorage.getItem('cos.focusDec'); sessionStorage.removeItem('cos.focusDec'); } catch { /* */ }
  if (dec && root.querySelector(`#dec-${CSS.escape(dec)}`)) { setTimeout(() => flash(root, dec), 250); return; }
  if (!flow) return;
  const el = root.querySelector(`[data-flow="${CSS.escape(flow)}"]`);
  if (el) setTimeout(() => flash(root, el.id.replace('dec-', '')), 250);
}
