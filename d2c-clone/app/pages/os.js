// os.js (module C): the OS. Tasks, purchase orders, vendor invoices and stock, each moving
// draft -> approved -> checked (or rejected). Money items are approved by an admin; a different person checks.
// API: /d2c-api/w/:wid/os (CONTRACT.md "The OS"). view() is pure (Node tests import it); mount() fetches and binds.
import { html, pill, sampleTag, can, inr, num, day } from '../js/ui.js';

export const title = 'OS';

export const TABS = [
  { key: 'tasks', label: 'Tasks', kind: 'tasks', one: 'task' },
  { key: 'pos', label: 'Purchase orders', kind: 'pos', one: 'purchase order' },
  { key: 'invoices', label: 'Vendor invoices', kind: 'invoices', one: 'vendor invoice' },
  { key: 'inventory', label: 'Inventory', kind: 'adjustments', one: 'stock adjustment' },
];
const APPROVER = { tasks: 'member', pos: 'admin', invoices: 'admin', adjustments: 'admin' };
const AREAS = [['', 'No area'], ['website', 'Website'], ['performance', 'Performance'], ['ops', 'Ops'], ['content', 'Content'], ['finance', 'Finance'], ['support', 'Support'], ['all-hands', 'All hands']];

export const tabFor = (params) => TABS.find((t) => t.key === (params && params[0])) || TABS[0];
const who = (email) => { const n = String(email || '').split('@')[0] || ''; return n.charAt(0).toUpperCase() + n.slice(1); };
const rupees = (v) => { const n = Number(String(v ?? '').replace(/[,\s₹]/g, '')); return Number.isFinite(n) ? Math.round(n * 100) : NaN; };
export const linesTotal = (lines) => (lines || []).reduce((s, l) => { const q = Number(l.qty), c = rupees(l.unit_cost); return s + (Number.isFinite(q) && Number.isFinite(c) ? q * c : 0); }, 0);
const signed = (n) => (n > 0 ? '+' + num(n) : num(n));
// the stock change a check made: an adjustment's new on-hand, or what a received PO added
export function appliedLine(a) {
  if (!a) return '';
  if (Array.isArray(a.lines)) {
    const got = a.lines.map((l) => `${l.sku} now ${num(l.on_hand)}`).join(', ');
    return (got ? ` Stock at ${a.location}: ${got}.` : '') + (a.untracked && a.untracked.length ? ` Not in stock records: ${a.untracked.join(', ')}.` : '');
  }
  return ` Stock now ${a.on_hand} at ${a.location}.`;
}
const href = (wid, tab) => `#/w/${encodeURIComponent(wid)}/os/${tab}`;

// Approve / Check / Reject, straight from item.can (the Worker decides who may do what)
function actions(item, data, ctx, kind) {
  if (data.rejecting === item.id) {
    return html`<form class="os-reject" data-id="${item.id}">
      <label class="field"><span class="sr">Why reject</span><input name="reason" maxlength="300" placeholder="Why, in a few words" required value="${data.reason || ''}"></label>
      <button class="btn is-small is-primary" type="submit"${data.busy ? ' disabled' : ''}>Reject</button>
      <button class="btn is-small" type="button" data-act="cancel-reject">Cancel</button>
    </form>`;
  }
  const c = item.can || {};
  const dis = data.busy ? ' disabled' : '';
  const out = [];
  if (c.approve) out.push(html`<button class="btn is-small is-primary" type="button" data-act="approve" data-id="${item.id}"${dis}>Approve</button>`);
  // for a PO the check is the goods-received step: it adds the stock
  if (c.check) out.push(html`<button class="btn is-small is-primary" type="button" data-act="check" data-id="${item.id}"${dis}>${kind === 'pos' ? 'Goods received' : 'Check'}</button>`);
  if (c.reject) out.push(html`<button class="btn is-small" type="button" data-act="reject" data-id="${item.id}"${dis}>Reject</button>`);
  const me = ctx.me && ctx.me.user && ctx.me.user.email;
  if (item.status === 'approved' && !c.check && me && item.approved_by === me) out.push(html`<span class="muted os-hint">You approved this; a second person checks it.</span>`);
  if (out.length || !can(ctx.role, 'member')) return out;
  if (item.status === 'draft') return html`<span class="muted os-hint">${APPROVER[kind] === 'admin' ? 'An admin approves this.' : 'Waiting for approval.'}</span>`;
  return '';
}

function people(item) {
  return html`<span class="os-people">
    <span>Drafted by ${item.names?.created_by || who(item.created_by)}</span>
    ${item.approved_by ? html`<span>Approved by ${item.names?.approved_by || who(item.approved_by)}</span>` : ''}
    ${item.checked_by ? html`<span>Checked by ${item.names?.checked_by || who(item.checked_by)}</span>` : ''}
    ${item.status === 'rejected' ? html`<span>Rejected${item.data && item.data.rejected_by ? html` by ${who(item.data.rejected_by)}` : ''}${item.reason ? html`: ${item.reason}` : ''}</span>` : ''}
  </span>`;
}

const COLS = {
  tasks: [
    ['Task', (i) => html`<b>${i.title}</b>${i.area || i.assignee ? html`<span class="os-sub muted">${[i.area, i.assignee].filter(Boolean).join(' · ')}</span>` : ''}${i.data && i.data.notes ? html`<span class="os-sub muted">${i.data.notes}</span>` : ''}`],
    ['Due', (i) => (i.due ? day(i.due) : '')],
  ],
  pos: [
    ['Order', (i) => html`<b>${i.title}</b><span class="os-sub muted">${i.vendor}${i.data && i.data.lines ? html` · ${i.data.lines.length} ${i.data.lines.length === 1 ? 'line' : 'lines'}` : ''}</span>`],
    ['Amount', (i) => inr(i.amount), 'r'],
    ['Due', (i) => (i.due ? day(i.due) : '')],
  ],
  invoices: [
    ['Invoice', (i) => html`<b>${i.title}</b><span class="os-sub muted">${i.vendor}${i.data && i.data.po_ref ? html` · against ${i.data.po_ref}` : ''}</span>`],
    ['Amount', (i) => inr(i.amount), 'r'],
    ['Due', (i) => (i.due ? day(i.due) : '')],
  ],
  adjustments: [
    ['Change', (i) => html`<b>${i.title}</b><span class="os-sub muted mono">${i.data ? `${i.data.sku} at ${i.data.location}` : ''}</span>`],
    ['Units', (i) => (i.data ? signed(i.data.delta) : ''), 'r'],
  ],
};

function itemsTable(data, ctx, kind) {
  const items = data.items || [];
  if (!items.length) return html`<p class="empty card">Nothing here yet.${can(ctx.role, 'member') ? ' Draft the first one above.' : ''}</p>`;
  const cols = COLS[kind];
  const matches = data.matches || {};
  return html`<div class="tbl-wrap"><table class="tbl os-tbl">
    <thead><tr><th>Ref</th>${cols.map(([h, , cls]) => html`<th${cls ? html` class="${cls}"` : ''}>${h}</th>`)}<th>Status</th><th>People</th><th>Actions</th></tr></thead>
    <tbody>${items.map((i) => {
      const m = matches[i.id];
      return html`<tr data-id="${i.id}">
        <td class="mono">${i.ref}</td>
        ${cols.map(([, f, cls]) => html`<td${cls ? html` class="${cls}"` : ''}>${f(i)}</td>`)}
        <td>${pill(i.status)}</td>
        <td>${people(i)}</td>
        <td class="os-act">${actions(i, data, ctx, kind)}${m ? html`<span class="os-match">${m.po_amount == null ? `No ${m.po_ref} found to match.` : m.diff === 0 ? `Matches ${m.po_ref} exactly.` : `${m.diff > 0 ? 'Over' : 'Under'} ${m.po_ref} by ${inr(Math.abs(m.diff))} (PO ${inr(m.po_amount)}).`}</span>` : ''}</td>
      </tr>`;
    })}</tbody>
  </table></div>`;
}

const field = (label, input) => html`<label class="field"><span>${label}</span>${input}</label>`;

function createForm(data, ctx, tab) {
  if (!can(ctx.role, 'member')) return html`<p class="muted os-viewer">Viewers can read the OS but not draft or approve.</p>`;
  const f = data.form || {};
  const v = (k) => f[k] ?? '';
  const common = html`${field('Title', html`<input name="title" maxlength="200" required value="${v('title')}">`)}`;
  let body;
  if (tab.key === 'tasks') {
    body = html`${common}
      ${field('Area', html`<select name="area">${AREAS.map(([k, l]) => html`<option value="${k}"${v('area') === k ? ' selected' : ''}>${l}</option>`)}</select>`)}
      ${field('Assignee', html`<input name="assignee" maxlength="120" value="${v('assignee')}">`)}
      ${field('Due', html`<input name="due" type="date" value="${v('due')}">`)}
      <label class="field os-wide"><span>Notes</span><textarea name="notes" maxlength="1000">${v('notes')}</textarea></label>`;
  } else if (tab.key === 'pos') {
    const lines = data.lines && data.lines.length ? data.lines : [{ sku: '', qty: '', unit_cost: '' }];
    body = html`${common}
      ${field('Vendor', html`<input name="vendor" maxlength="120" required placeholder="Sample Packaging Co." value="${v('vendor')}">`)}
      ${field('Due', html`<input name="due" type="date" value="${v('due')}">`)}
      <fieldset class="os-lines os-wide"><legend>Lines</legend>
        ${lines.map((l, i) => html`<div class="os-line">
          <label class="field"><span>SKU</span><input data-line="${i}" name="sku" maxlength="40" required value="${l.sku}"></label>
          <label class="field"><span>Qty</span><input data-line="${i}" name="qty" type="number" min="1" step="1" required value="${l.qty}"></label>
          <label class="field"><span>Unit cost (₹)</span><input data-line="${i}" name="unit_cost" type="number" min="0" step="0.01" required value="${l.unit_cost}"></label>
          ${lines.length > 1 ? html`<button class="btn is-small" type="button" data-act="del-line" data-i="${i}">Remove</button>` : ''}
        </div>`)}
        <div class="os-lines-foot">
          ${lines.length < 50 ? html`<button class="btn is-small" type="button" data-act="add-line">Add line</button>` : ''}
          <span>Total <b id="os-total">${inr(linesTotal(lines))}</b></span>
        </div>
      </fieldset>`;
  } else if (tab.key === 'invoices') {
    body = html`${common}
      ${field('Vendor', html`<input name="vendor" maxlength="120" required value="${v('vendor')}">`)}
      ${field('Amount (₹)', html`<input name="amount" type="number" min="0.01" step="0.01" required value="${v('amount')}">`)}
      ${field('Due', html`<input name="due" type="date" value="${v('due')}">`)}
      ${field('Against PO (optional)', html`<input name="po_ref" list="os-po-refs" maxlength="20" placeholder="PO-0001" value="${v('po_ref')}">`)}
      <datalist id="os-po-refs">${(data.po_refs || []).map((r) => html`<option value="${r}"></option>`)}</datalist>`;
  } else {
    const skus = [...new Set((data.stock || []).map((s) => s.sku))];
    body = html`${common}
      ${field('SKU', html`<input name="sku" list="os-skus" maxlength="40" required value="${v('sku')}">`)}
      ${field('Location', html`<input name="location" list="os-locs" maxlength="80" required value="${v('location')}">`)}
      ${field('Units (negative takes stock out)', html`<input name="delta" type="number" step="1" required value="${v('delta')}">`)}
      <label class="field os-wide"><span>Notes</span><textarea name="notes" maxlength="1000">${v('notes')}</textarea></label>
      <datalist id="os-skus">${skus.map((s) => html`<option value="${s}"></option>`)}</datalist>
      <datalist id="os-locs">${(data.locations || []).map((s) => html`<option value="${s}"></option>`)}</datalist>`;
  }
  return html`<details class="card os-new"${data.open ? ' open' : ''}>
    <summary>New ${tab.one}</summary>
    <form id="os-form" class="os-form" novalidate>
      ${body}
      <div class="os-wide os-submit">
        <button class="btn is-primary is-small" type="submit"${data.busy ? ' disabled' : ''}>${data.busy ? 'Saving' : 'Save as draft'}</button>
        <span class="muted">Drafts wait for ${APPROVER[tab.kind] === 'admin' ? 'an admin' : 'a member'} to approve, then a different person ${tab.kind === 'pos' ? 'marks the goods received, which adds the stock' : 'checks'}.</span>
      </div>
      ${data.form_error ? html`<p class="err os-wide" role="alert">${data.form_error}</p>` : ''}
    </form>
  </details>`;
}

function stockTable(data) {
  const stock = data.stock || [];
  if (!stock.length) return html`<p class="empty card">No stock rows yet. A checked stock adjustment creates one.</p>`;
  return html`<div class="tbl-wrap"><table class="tbl os-stock">
    <thead><tr><th>SKU</th><th>Item</th><th>Location</th><th class="r">On hand</th><th class="r">Reorder at</th><th class="r">Unit cost</th></tr></thead>
    <tbody>${stock.map((s) => html`<tr class="${s.low ? 'is-low' : ''}">
      <td class="mono">${s.sku}</td><td>${s.name}${s.low ? html` <span class="os-low">Low</span>` : ''}</td><td>${s.location}</td>
      <td class="r">${num(s.on_hand)}</td><td class="r">${num(s.reorder_point)}</td><td class="r">${inr(s.unit_cost)}</td>
    </tr>`)}</tbody>
  </table></div>`;
}

// data = { items, counts, stock, locations, po_refs, form, lines, open, rejecting, reason, busy, error, form_error, matches }
export function view(data, ctx) {
  const tab = tabFor(ctx.params);
  const counts = data.counts || {};
  const waiting = (k) => { const c = counts[k]; return c ? (c.draft || 0) + (c.approved || 0) : 0; };
  const lowN = (data.stock || []).filter((s) => s.low).length || data.low_stock || 0;
  return html`<section class="pg os">
    <div class="pg-top">
      <div>
        <h1 class="pg-h">OS ${sampleTag(ctx.ws)}</h1>
        <p class="pg-sub">Every item moves draft, approved, checked. Money items (orders, invoices, stock) need an admin to approve, and a different person to check.</p>
      </div>
    </div>
    <nav class="tabs" aria-label="OS sections">${TABS.map((t) => {
      const n = t.key === 'inventory' ? waiting('adjustments') : waiting(t.key);
      return html`<a href="${href(ctx.wid, t.key)}"${t.key === tab.key ? html` aria-current="page"` : ''}>${t.label}${n ? html`<span class="os-n">${n}</span>` : ''}</a>`;
    })}</nav>
    ${data.error ? html`<p class="err" role="alert">${data.error}</p>` : ''}
    ${tab.key === 'inventory' ? html`
      <h2 class="os-h2">Stock${lowN ? html` <span class="os-low">${lowN} low</span>` : ''}</h2>
      ${stockTable(data)}
      <h2 class="os-h2">Stock adjustments</h2>` : ''}
    ${createForm(data, ctx, tab)}
    ${itemsTable(data, ctx, tab.kind)}
  </section>`;
}

export async function mount(root, ctx) {
  const tab = tabFor(ctx.params);
  const base = `/w/${ctx.wid}/os`;
  const blank = () => (tab.key === 'pos' ? [{ sku: '', qty: '', unit_cost: '' }] : []);
  const s = { items: [], counts: {}, stock: [], locations: [], po_refs: [], low_stock: 0, form: {}, lines: blank(), open: false,
    rejecting: null, reason: '', busy: false, error: '', form_error: '', matches: {} };

  async function load() {
    const jobs = [ctx.api('GET', `${base}/${tab.kind}`), ctx.api('GET', base)];
    if (tab.key === 'inventory') jobs.push(ctx.api('GET', `${base}/inventory`));
    if (tab.key === 'invoices') jobs.push(ctx.api('GET', `${base}/pos`));
    const [list, sum, extra] = await Promise.all(jobs);
    s.items = list.items; s.counts = sum.counts; s.low_stock = sum.low_stock;
    if (tab.key === 'inventory') { s.stock = extra.stock; s.locations = extra.locations; }
    if (tab.key === 'invoices') s.po_refs = extra.items.filter((p) => p.status !== 'rejected').map((p) => p.ref);
  }
  const paint = () => {
    const keep = root.querySelector('.os-new');
    if (keep) s.open = keep.open;
    root.innerHTML = String(view(s, ctx));
  };
  await load();
  paint();

  function bodyFor() {
    const f = s.form;
    const b = { title: f.title, due: f.due || undefined };
    if (tab.key === 'tasks') Object.assign(b, { area: f.area || undefined, assignee: f.assignee, notes: f.notes });
    if (tab.key === 'pos') Object.assign(b, { vendor: f.vendor, lines: s.lines.map((l) => ({ sku: String(l.sku || '').trim(), qty: Number(l.qty), unit_cost: rupees(l.unit_cost) })) });
    if (tab.key === 'invoices') Object.assign(b, { vendor: f.vendor, amount: rupees(f.amount), po_ref: f.po_ref || undefined });
    if (tab.key === 'inventory') Object.assign(b, { sku: String(f.sku || '').trim(), location: f.location, delta: Number(f.delta), notes: f.notes });
    return b;
  }

  async function run(fn) {
    s.busy = true; s.error = ''; paint();
    try { await fn(); } catch (e) { s.error = e.message; }
    s.busy = false; paint();
  }

  const onInput = (e) => {
    const t = e.target;
    if (t.closest('.os-reject')) { s.reason = t.value; return; }
    if (!t.closest('#os-form') || !t.name) return;
    if (t.dataset.line != null) {
      s.lines[Number(t.dataset.line)][t.name] = t.value;
      const tot = root.querySelector('#os-total');
      if (tot) tot.textContent = inr(linesTotal(s.lines));
    } else s.form[t.name] = t.value;
  };

  const onClick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !root.contains(b) || b.disabled) return;
    const id = Number(b.dataset.id);
    const act = b.dataset.act;
    if (act === 'add-line') { s.lines.push({ sku: '', qty: '', unit_cost: '' }); paint(); return; }
    if (act === 'del-line') { s.lines.splice(Number(b.dataset.i), 1); paint(); return; }
    if (act === 'reject') { s.rejecting = id; s.reason = ''; paint(); root.querySelector('.os-reject input')?.focus(); return; }
    if (act === 'cancel-reject') { s.rejecting = null; paint(); return; }
    if (act === 'approve' || act === 'check') {
      run(async () => {
        const r = await ctx.api('POST', `${base}/${tab.kind}/${id}/${act}`);
        if (r.match) s.matches = { ...s.matches, [id]: r.match };
        ctx.toast(`${r.item.ref} ${act === 'approve' ? 'approved' : tab.kind === 'pos' ? 'received' : 'checked'}.${appliedLine(r.applied)}`);
        await load();
      });
    }
  };

  const onSubmit = (e) => {
    const form = e.target;
    if (form.classList.contains('os-reject')) {
      e.preventDefault();
      const id = Number(form.dataset.id);
      const reason = s.reason.trim();
      if (!reason) { s.error = 'Say why, in a few words.'; paint(); return; }
      run(async () => {
        const r = await ctx.api('POST', `${base}/${tab.kind}/${id}/reject`, { reason });
        s.rejecting = null; s.reason = '';
        ctx.toast(`${r.item.ref} rejected.`);
        await load();
      });
      return;
    }
    if (form.id !== 'os-form') return;
    e.preventDefault();
    s.busy = true; s.form_error = ''; paint();
    (async () => {
      try {
        const r = await ctx.api('POST', `${base}/${tab.kind}`, bodyFor());
        s.form = {}; s.lines = blank(); s.open = false;
        const d = root.querySelector('.os-new'); if (d) d.open = false;
        ctx.toast(`${r.item.ref} saved as a draft.`);
        await load();
      } catch (err) { s.form_error = err.message; }
      s.busy = false; paint();
    })();
  };

  root.addEventListener('input', onInput);
  root.addEventListener('change', onInput);
  root.addEventListener('click', onClick);
  root.addEventListener('submit', onSubmit);
  return () => {
    root.removeEventListener('input', onInput);
    root.removeEventListener('change', onInput);
    root.removeEventListener('click', onClick);
    root.removeEventListener('submit', onSubmit);
  };
}
