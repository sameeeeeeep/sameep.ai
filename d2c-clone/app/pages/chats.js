// chats.js (module B): one group chat per area with its agent, people and vendors. Agents draft approval
// cards; a person taps Approve, Edit, Reject or Check (a second, different person checks anything that moves
// money or changes prices). Route: #/w/<wid>/chats/<group slug> (default all-hands).
// API: CONTRACT.md "Chats". view() is pure; mount() fetches, binds, and polls every 10 s while mounted.
import { html, pill, sampleTag, can, ago } from '../js/ui.js';
import { hrefFor } from '../js/app.js';

export const title = 'Chats';
export const POLL_MS = 10_000;

const KIND = {
  discount: 'Discount code', ad_budget: 'Ad budget', reply: 'Customer reply', restock: 'Restock', payout: 'Vendor payout',
  refund: 'Refund', post: 'Post', drive_read: 'Drive and Calendar read',
};
// 'rohan@unfiltrd.example' -> 'Rohan'; agent names pass through
export const person = (who) => {
  if (!who) return '';
  if (!String(who).includes('@')) return who;
  const n = String(who).split('@')[0].split(/[._-]/)[0];
  return n.charAt(0).toUpperCase() + n.slice(1);
};

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

function cardActions(c, ctx, ui) {
  const me = ctx.me?.user?.email;
  const member = can(ctx.role, 'member');
  const out = [];
  if (c.can.approve) out.push(html`<button class="btn is-primary is-small" type="button" data-act="approve" data-id="${c.id}">Approve</button>`);
  else if (member && c.status === 'pending' && c.kind === 'drive_read') {
    out.push(html`<button class="btn is-small" type="button" disabled title="Only admins and the owner can approve Drive and Calendar reads.">Approve</button>`);
  }
  if (c.can.check) out.push(html`<button class="btn is-primary is-small" type="button" data-act="check" data-id="${c.id}">Check and approve</button>`);
  else if (member && c.status === 'awaiting_check' && me && c.approved_by === me) {
    out.push(html`<button class="btn is-small" type="button" disabled title="A second person must check this. You approved it.">Check</button>`);
  }
  if (c.can.edit) out.push(html`<button class="btn is-small" type="button" data-act="edit" data-id="${c.id}">Edit</button>`);
  if (c.can.reject) out.push(html`<button class="btn is-small" type="button" data-act="reject" data-id="${c.id}">Reject</button>`);
  if (!out.length) return '';
  const busy = ui.busy === c.id;
  return html`<div class="ch-acts"${busy ? ' aria-busy="true"' : ''}>${out}</div>`;
}

function cardView(c, ctx, ui) {
  const editing = ui.editing === c.id && c.can.edit;
  const rejecting = ui.rejecting === c.id && c.can.reject;
  const who = [];
  if (c.approved_by) who.push(`Approved by ${person(c.approved_by)}`);
  if (c.checked_by) who.push(`checked by ${person(c.checked_by)}`);
  if (c.edited_by) who.push(`edited by ${person(c.edited_by)}`);
  const body = editing
    ? html`<form class="ch-edit" data-form="edit" data-id="${c.id}">
        <label class="field"><span>Title</span><input name="title" value="${c.title}" maxlength="160" required></label>
        ${c.fields.map((f, i) => html`<label class="field"><span>${f.label}</span>
          <input name="f${i}" data-label="${f.label}" value="${f.value}" maxlength="600"></label>`)}
        <div class="ch-acts"><button class="btn is-primary is-small" type="submit">Save changes</button>
          <button class="btn is-small" type="button" data-act="cancel">Cancel</button></div>
      </form>`
    : html`<h3 class="ch-card-t">${c.title}</h3>
      ${c.fields.length ? html`<dl class="ch-fields">${c.fields.map((f) => html`<div><dt>${f.label}</dt><dd>${f.value}</dd></div>`)}</dl>` : ''}`;
  return html`<div class="ch-card is-${c.status}" data-card="${c.id}">
    <div class="ch-card-top"><span class="mono ch-kind">${KIND[c.kind] || c.kind}</span>${pill(c.status)}</div>
    ${body}
    ${c.needs_second && c.status !== 'rejected' ? html`<p class="ch-note">Moves money or changes prices: after approval, a second person checks it.</p>` : ''}
    ${who.length ? html`<p class="ch-note">${cap(who.join(', '))}.</p>` : ''}
    ${c.status === 'rejected' && c.reason ? html`<p class="ch-note">Rejected: ${c.reason}</p>` : ''}
    ${c.status === 'approved' && ctx.ws?.demo ? html`<p class="ch-note">Demo mode: nothing was sent.</p>` : ''}
    ${rejecting
      ? html`<form class="ch-reject" data-form="reject" data-id="${c.id}">
          <label class="field"><span>Why reject it?</span><input name="reason" maxlength="300" required></label>
          <div class="ch-acts"><button class="btn is-primary is-small" type="submit">Reject</button>
            <button class="btn is-small" type="button" data-act="cancel">Cancel</button></div></form>`
      : editing ? '' : cardActions(c, ctx, ui)}
  </div>`;
}

function messageView(m, ctx, ui) {
  if (m.author_kind === 'system') return html`<li class="ch-msg is-system" data-id="${m.id}"><span>${m.body}</span> <span class="muted">${ago(m.ts, ui.now)}</span></li>`;
  return html`<li class="ch-msg is-${m.author_kind}" data-id="${m.id}">
    <div class="ch-msg-h"><b>${m.author_name || person(m.author)}</b>${m.author_kind === 'agent' ? html` <span class="ch-tag mono">Agent</span>` : ''}${m.author_kind === 'vendor' ? html` <span class="ch-tag mono">Vendor</span>` : ''}
      <span class="muted ch-time">${ago(m.ts, ui.now)}</span></div>
    <p class="ch-body">${m.body}</p>
    ${m.card ? cardView(m.card, ctx, ui) : ''}
  </li>`;
}

// data = { groups, slug, group, messages, ui: { editing, rejecting, busy, error, draft, now } }
export function view(data, ctx) {
  const ui = { now: Date.now(), ...(data?.ui || {}) };
  const groups = data?.groups || [];
  const slug = data?.slug || 'all-hands';
  const g = data?.group || groups.find((x) => x.slug === slug);
  const top = html`<div class="pg-top"><div><h1 class="pg-h">Chats ${sampleTag(ctx.ws)}</h1>
    <p class="pg-sub">One group per area. Each agent reads only its own area's tools and only drafts: nothing happens until a person taps.</p></div></div>`;

  const list = html`<nav class="ch-groups" aria-label="Groups">${groups.map((x) => html`
    <a class="ch-group" href="${hrefFor(ctx.wid, 'chats', x.slug)}"${x.slug === slug ? html` aria-current="page"` : ''}>
      <span class="ch-group-n">${x.name}${x.open_cards ? html` <span class="ch-count" title="Cards waiting for a tap">${x.open_cards}</span>` : ''}</span>
      <span class="ch-group-l muted">${x.last ? `${x.last.author_name}: ${x.last.body}` : x.agent}</span>
    </a>`)}</nav>`;

  if (!g) {
    return html`<section class="pg ch">${top}<div class="ch-wrap">${list}<div class="ch-thread">
      ${ui.error ? html`<p class="err" role="alert">${ui.error}</p>` : html`<p class="loading">Loading</p>`}</div></div></section>`;
  }

  const messages = data.messages || [];
  const tools = (g.connectors || []).length
    ? html`<span class="ch-tools">${g.connectors.map((c) => html`<span class="ch-tool is-${c.status || 'not_connected'}" title="${c.status === 'connected' ? 'Connected' : 'Not connected'}">${c.name}</span>`)}</span>`
    : html`<span class="ch-tools muted">Reads the other groups' summaries, never a tool directly.</span>`;
  const people = (g.members || []).map((p) => p.name).filter(Boolean);

  const composer = can(ctx.role, 'member')
    ? html`<form class="ch-compose" data-form="send">
        <label class="sr" for="ch-body">Message to ${g.name}</label>
        <textarea id="ch-body" name="body" rows="2" maxlength="2000" placeholder="Message ${g.name}. Ask the agent to draft something.">${ui.draft || ''}</textarea>
        <button class="btn is-primary is-small" type="submit"${ui.sending ? ' disabled' : ''}>${ui.sending ? 'Sending' : 'Send'}</button>
      </form>`
    : html`<p class="ch-readonly muted">You have view access: you can read this group, but not post or decide cards.</p>`;

  return html`<section class="pg ch">${top}<div class="ch-wrap">${list}
    <div class="ch-thread">
      <header class="ch-head"><h2 class="ch-title">${g.name}</h2>
        <p class="ch-meta"><span>${g.agent}</span>${tools}</p>
        ${people.length ? html`<p class="ch-meta muted">With ${people.join(', ')}</p>` : ''}
      </header>
      ${ui.error ? html`<p class="err ch-err" role="alert">${ui.error}</p>` : ''}
      ${messages.length
        ? html`<ol class="ch-msgs" id="ch-msgs">${messages.map((m) => messageView(m, ctx, ui))}</ol>`
        : html`<p class="empty ch-msgs">No messages in ${g.name} yet.${can(ctx.role, 'member') ? ' Ask the agent for something to start.' : ''}</p>`}
      ${composer}
    </div></div></section>`;
}

export async function mount(root, ctx) {
  const slug = ctx.params[0] || 'all-hands';
  const s = { groups: [], slug, group: null, messages: [], ui: { editing: null, rejecting: null, busy: null, error: '', draft: '', sending: false } };
  let dead = false, timer = null, stale = false, placed = false;

  const lastId = () => s.messages.reduce((n, m) => Math.max(n, m.id), 0);
  const holding = () => s.ui.editing != null || s.ui.rejecting != null;

  function paint() {
    if (dead) return;
    const box = root.querySelector('#ch-msgs');
    const atBottom = !box || box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    const ta = root.querySelector('#ch-body');
    if (ta) s.ui.draft = ta.value;
    const hadFocus = ta && document.activeElement === ta;
    s.ui.now = Date.now();
    root.innerHTML = String(view(s, ctx));
    const nb = root.querySelector('#ch-msgs');
    if (nb && atBottom) nb.scrollTop = nb.scrollHeight;
    if (hadFocus) root.querySelector('#ch-body')?.focus();
    if (!placed) { // on a phone the group strip scrolls sideways: bring the open group into view once
      const cur = root.querySelector('.ch-group[aria-current="page"]');
      if (cur && s.groups.length) { cur.parentElement.scrollLeft = Math.max(0, cur.offsetLeft - cur.parentElement.offsetLeft - 16); placed = true; }
    }
    root.querySelector('[data-form="edit"] input, [data-form="reject"] input')?.focus();
  }

  async function load() {
    const [g, t] = await Promise.all([ctx.api('GET', `/w/${ctx.wid}/chats`), ctx.api('GET', `/w/${ctx.wid}/chats/${encodeURIComponent(slug)}`)]);
    s.groups = g.groups; s.group = t.group; s.messages = t.messages;
  }

  async function refresh() {
    try { await load(); s.ui.error = ''; } catch (e) { s.ui.error = e.message; }
    if (holding()) stale = true; else paint();
  }

  async function poll() {
    if (dead || (typeof document !== 'undefined' && document.hidden)) return;
    try {
      const r = await ctx.api('GET', `/w/${ctx.wid}/chats/${encodeURIComponent(slug)}?after=${lastId()}`);
      if (dead || !r.messages.length) return;
      await refresh(); // new messages can change older cards too (a decision posts a system message)
    } catch { /* a missed poll is fine; the next one tries again */ }
  }

  async function act(fn, okMsg) {
    try { await fn(); s.ui.error = ''; if (okMsg) ctx.toast(okMsg); } catch (e) { s.ui.error = e.message; }
    s.ui.busy = null;
    await refresh();
  }

  const cardPath = (id, a) => `/w/${ctx.wid}/cards/${id}/${a}`;

  const onClick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const id = Number(b.dataset.id), a = b.dataset.act;
    if (a === 'cancel') { s.ui.editing = s.ui.rejecting = null; stale = false; return paint(); }
    if (a === 'edit') { s.ui.editing = id; s.ui.rejecting = null; return paint(); }
    if (a === 'reject') { s.ui.rejecting = id; s.ui.editing = null; return paint(); }
    if (a === 'approve' || a === 'check') {
      s.ui.busy = id; b.disabled = true;
      act(() => ctx.api('POST', cardPath(id, a)), a === 'check' ? 'Checked and approved.' : 'Approved.');
    }
  };

  const onSubmit = (e) => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    const kind = f.dataset.form, id = Number(f.dataset.id);
    if (kind === 'send') {
      const body = f.querySelector('textarea').value.trim();
      if (!body) { s.ui.error = 'Write a message first.'; return paint(); }
      s.ui.sending = true; paint();
      act(async () => { await ctx.api('POST', `/w/${ctx.wid}/chats/${encodeURIComponent(slug)}/messages`, { body }); s.ui.draft = ''; const ta = root.querySelector('#ch-body'); if (ta) ta.value = ''; })
        .finally(() => { s.ui.sending = false; paint(); });
      return;
    }
    if (kind === 'edit') {
      const title = f.querySelector('[name="title"]').value.trim();
      const fields = [...f.querySelectorAll('input[data-label]')].map((i) => ({ label: i.dataset.label, value: i.value.trim() }));
      s.ui.editing = null; stale = false;
      act(() => ctx.api('POST', cardPath(id, 'edit'), { title, fields }), 'Card updated.');
      return;
    }
    if (kind === 'reject') {
      const reason = f.querySelector('[name="reason"]').value.trim();
      if (!reason) { s.ui.error = 'Say why it is rejected.'; return paint(); }
      s.ui.rejecting = null; stale = false;
      act(() => ctx.api('POST', cardPath(id, 'reject'), { reason }), 'Rejected.');
    }
  };

  const onKey = (e) => {
    if (e.target.id === 'ch-body' && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.target.form?.requestSubmit(); }
  };

  root.addEventListener('click', onClick);
  root.addEventListener('submit', onSubmit);
  root.addEventListener('keydown', onKey);
  paint();
  try { await load(); } catch (e) { s.ui.error = e.message; }
  paint();
  timer = setInterval(() => { if (stale && !holding()) { stale = false; paint(); } poll(); }, POLL_MS);

  return () => {
    dead = true;
    clearInterval(timer);
    root.removeEventListener('click', onClick);
    root.removeEventListener('submit', onSubmit);
    root.removeEventListener('keydown', onKey);
  };
}
