// feed.js: the board a module's chat shows (and the All modules view merges): To do, In progress, Done.
// Not a route of its own any more: #/w/<wid>/feed redirects to #/w/<wid>/chat/all (js/app.js MOVED), and
// pages/chat.js renders boardView() for one module or for all of them. The groups come from js/board.js (pure).
//   To do        each card: who raised it (a cat), a picture, the number that matters, where it came from (the
//                original line and a link to it in the module's chat), the one tap; the full card under Details
//   In progress  each record in flight: its maker (a cat for an agent), owner (a face), where it came from, its step
//   Done         folded: closed cards (the chain as one line) and checked records
import { html } from '../js/ui.js';
import { decisionCard, quickAct, quickBtn, ago, clock, stepper } from '../js/cos.js';
import { raw } from '../js/ui.js';
import { cat, catOf, face, productSrc, shot } from '../js/look.js';
import { board, ALL } from '../js/board.js';
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
// a record with no source line still says where it came from: a sync is data, an agent is the agent's own work
export const makerSrc = (r) => (r?.maker ? (/sync$/i.test(r.maker) ? { kind: 'connector', from: r.maker.replace(/\s*sync$/i, '') } : { kind: 'agent', from: '' }) : null); // the cat already says which agent

const STEP = { draft: 'Draft', approved: 'Approved, needs a check', held: 'On hold', checked: 'Checked', rejected: 'Rejected' };

// Pure. b = board(...) from js/board.js; opts = {scope, mods: {slug: name}, now}
export function boardView(b, data, ctx, opts = {}) {
  const { state: s } = data;
  const now = opts.now || Date.now();
  const scope = opts.scope || ALL;
  const mods = opts.mods || {};
  const ws = ctx.ws || { name: '', demo: s?.demo };
  const sx = { ...s, wid: ctx.wid };
  const wid = encodeURIComponent(ctx.wid);
  const nm = (n) => nameOf(s, n);
  const pf = (n, z) => (n === 'Chief of staff' ? cat(n, z) : face(ws, n, z)); // a person's face; the chief of staff is a cat
  const modChip = (m) => (scope === ALL && m ? html`<a class="wk-mod" href="#/w/${wid}/chat/${encodeURIComponent(m)}">#${m}</a>` : '');
  const recHref = (r, m) => `#/w/${wid}/chat/${encodeURIComponent(scope === ALL ? m : scope)}/records/${encodeURIComponent(r.kind)}/${encodeURIComponent(r.ref)}`;

  const need = ({ d, post, mod }) => {
    const a = quickAct(d, sx);
    const pic = productSrc(ws, d.fn);
    const rec = d.options.find((o) => o.recommended) || d.options[0];
    const n = d.numbers?.[0];
    const c = catOf(d.agent);
    const src = d.source || post?.source;
    return html`<article class="fd-need" id="need-${d.id}">
      <div class="fd-need-top">
        <span class="fd-pic${pic ? '' : ' is-cat'}">${pic ? shot(ws, d.fn) : cat(d.agent, 56)}</span>
        <div class="fd-need-b">
          <p class="fd-who">${pic ? cat(d.agent, 22) : ''}<b>${c.name}</b><span>${c.role}${post ? `, ${ago(post.ts, now)}` : ''}</span>${modChip(mod)}</p>
          <h3 class="fd-need-t">${d.title}</h3>
          ${src ? html`<details class="fd-orig"><summary>${srcChip(src, post?.ts || d.ts)}</summary>
            <blockquote class="fd-quote">${srcOf(d.source)?.text || post?.text || ''}</blockquote>
            <a class="fd-open" href="#/w/${wid}/chat/${encodeURIComponent(d.thread || mod)}/chat">Open in #${d.thread || mod}</a></details>` : ''}
          ${n ? html`<p class="fd-num"><b>${n.value}</b><span>${n.label}</span></p>` : ''}
        </div>
      </div>
      <div class="fd-act">
        ${d.status === 'to_check'
          ? html`<p class="fd-sug">${pf(nm(d.decided_by), 22)}<span>${nm(d.decided_by)} chose <b>${d.options.find((o) => o.key === d.chosen)?.label || ''}</b></span></p>`
          : rec ? html`<p class="fd-sug">${pf(nm(d.decider?.name), 22)}<span>${nm(d.decider?.name) || 'Anyone'}: <b>${rec.label}</b>${d.options.length > 1 ? html` <span class="muted">or ${d.options.length - 1} more</span>` : ''}</span></p>` : ''}
        ${a ? quickBtn(a, 'is-primary', a.dec === 'check' ? 'Check' : a.verb) : ''}
      </div>
      <details class="fd-more"><summary>Details</summary>${decisionCard(d, sx)}</details>
    </article>`;
  };

  // a record in flight: maker (cat or the data it synced from), title, owner, source, step
  const doingRow = ({ r, mod, source }) => {
    const agent = /agent$|^chief of staff$/i.test(r.maker || '');
    return html`<li><a class="wk-row" href="${recHref(r, mod)}">
      <span class="wk-row-v">${agent ? cat(r.maker, 34) : pf(nm(r.owner), 34)}</span>
      <span class="wk-row-b"><b>${r.title}</b>
        <span class="wk-row-m">${r.owner ? html`${pf(nm(r.owner), 18)}<span>${nm(r.owner)}</span>` : ''}${srcChip(source || makerSrc(r))}<span class="wk-st is-${r.status}">${STEP[r.status] || r.status}</span></span></span>
      <span class="wk-row-r">${raw(stepper(r.status))}<span class="mono">${r.ref}</span>${scope === ALL ? html`<span class="wk-mod">#${mod}</span>` : ''}</span>
    </a></li>`;
  };

  const doneRow = (it) => {
    if (it.type === 'card') {
      const d = it.d;
      return html`<li class="fd-done">
        ${cat(it.agent, 32)}
        <div><p><b>${catOf(it.agent).name}</b> ${it.result || d.title}</p>
          <p class="fd-done-m">${d.decided_by ? html`${pf(nm(d.decided_by), 18)}<span>${nm(d.decided_by)} chose${d.checked_by ? `, ${nm(d.checked_by)} checked` : ''}</span>` : ''}${srcChip(d.source)}<a class="fd-open" href="#/w/${wid}/chat/${encodeURIComponent(d.thread || it.mod)}/chat">#${d.thread || it.mod}</a><span class="fd-t">${ago(it.ts, now)}</span></p></div>
      </li>`;
    }
    const r = it.r;
    const agent = /agent$|^chief of staff$/i.test(r.maker || '');
    return html`<li class="fd-done">
      ${agent ? cat(r.maker, 32) : pf(nm(r.owner), 32)}
      <div><p><a class="wk-done-a" href="${recHref(r, it.mod)}">${r.title}</a></p>
        <p class="fd-done-m">${r.checked_by ? html`${pf(nm(r.checked_by), 18)}<span>${nm(r.checked_by)} checked</span>` : ''}${srcChip(it.source || makerSrc(r))}${modChip(it.mod)}<span class="fd-t">${ago(it.ts, now)}</span></p></div>
    </li>`;
  };

  const SHOW = 6;
  const doingList = (list) => html`<ul class="wk-rows">${list.slice(0, SHOW).map(doingRow)}</ul>${list.length > SHOW
    ? html`<details class="wk-moreg"><summary>${list.length - SHOW} more in progress</summary><ul class="wk-rows">${list.slice(SHOW).map(doingRow)}</ul></details>` : ''}`;
  // the agents of this module and what each is on now
  const agentsNow = (opts.agents || []).length ? html`<ul class="wk-now">${opts.agents.map((a) => html`<li>${cat(a.name, 26)}<span><b>${catOf(a.name).name}</b> ${a.now}</span>${a.ts ? html`<span class="fd-t">${ago(a.ts, now)}</span>` : ''}</li>`)}</ul>` : '';

  return html`<div class="wk-board">
    <section class="wk-g" aria-label="To do">
      <h3 class="wk-h">To do <span class="fd-c">${b.todo.length}</span></h3>
      ${b.todo.length ? html`<div class="fd-needs">${b.todo.map(need)}</div>` : html`<p class="fd-calm">Nothing needs you here.</p>`}
    </section>
    <section class="wk-g" aria-label="In progress">
      <h3 class="wk-h">In progress <span class="fd-c">${b.doing.length}</span></h3>
      ${agentsNow}
      ${b.doing.length ? doingList(b.doing) : html`<p class="fd-calm">Nothing in flight.</p>`}
      ${b.done.length ? html`<details class="wk-done"${opts.openDone ? ' open' : ''}><summary><span class="wk-h">Done <span class="fd-c">${b.done.length}</span></span><span class="fd-stack">${[...new Set(b.done.filter((x) => x.type === 'card').map((x) => x.agent))].slice(0, 4).map((a) => cat(a, 26))}</span></summary>
        <ul class="fd-done-l">${b.done.slice(0, 30).map(doneRow)}</ul></details>` : ''}
    </section>
  </div>`;
}

// convenience for tests and the old callers: the whole board for a scope as html
export function view(data, ctx, opts = {}) {
  return boardView(board(data, opts.scope || ALL, opts.fns || {}), data, ctx, opts);
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
export function focusCard(root) {
  let flow = null, dec = null;
  try { flow = sessionStorage.getItem('cos.focus'); dec = sessionStorage.getItem('cos.focusDec'); } catch { /* */ }
  if (dec && root.querySelector(`#dec-${CSS.escape(dec)}`)) { try { sessionStorage.removeItem('cos.focusDec'); } catch { /* */ } setTimeout(() => flash(root, dec), 250); return true; }
  const el = flow && root.querySelector(`[data-flow="${CSS.escape(flow)}"]`);
  if (el) { try { sessionStorage.removeItem('cos.focus'); } catch { /* */ } setTimeout(() => flash(root, el.id.replace('dec-', '')), 250); return true; }
  return false;
}
