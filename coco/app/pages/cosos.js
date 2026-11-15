// cosos.js: the records (once the OS page; #/w/<wid>/os redirects into Chat, js/app.js MOVED). Every record (tasks, POs, vendor invoices, QC batches, stock, orders) goes draft -> approved ->
// checked; the person who approves never checks, and the agent that drafted it never approves. A record that came
// from a decision carries that card (js/cos.js), and checking either one checks both.
// Shown inside a module's chat: #/w/<wid>/chat/<module>/records/<kind>/<ref> (kind: all|task|po|invoice|qc|stock|order).
// The approve, check and reject taps are bound by pages/chat.js (data-rec).
import { html } from '../js/ui.js';
import { decisionCard, stepper, rs, ago, personaPicker } from '../js/cos.js';
import { raw } from '../js/ui.js';

export const TABS = [['task', 'Tasks'], ['po', 'POs'], ['invoice', 'Invoices'], ['qc', 'QC batches'], ['stock', 'Stock'], ['order', 'Orders']];
const ST = { draft: 'Draft', approved: 'Approved', checked: 'Checked', held: 'On hold', rejected: 'Rejected' };

// Pure: the records pane inside a module (pages/chat.js, the Records tab), or all modules'.
// data = {state, records, decisions, sel: {record, log, decision} | null}; base = the tab's href ('#/w/x/chat/ops/records')
// kind = the kind chip in view ('all' or one of TABS); records arrive already filtered to the module
export function recordsPane(data, ctx, { base, kind = 'all' } = {}) {
  const { state: s, records = [], decisions = {}, sel } = data;
  const sx = { ...s, wid: ctx.wid };
  const live = (r) => r.status === 'draft' || r.status === 'approved' || r.status === 'held';
  const kinds = TABS.filter(([k]) => records.some((r) => r.kind === k));
  const shown = (kind === 'all' ? records : records.filter((r) => r.kind === kind)).slice().sort((a, b) => Number(live(b)) - Number(live(a)));
  const row = (r) => {
    const d = r.decision_id ? decisions[r.decision_id] : null;
    const right = r.kind === 'stock' ? stockLine(r) : [r.amount != null && html`<span class="mono">${rs(r.amount)}</span>`, r.qty != null && r.kind !== 'order' && html`<span class="mono muted">${r.qty.toLocaleString('en-IN')} units</span>`].filter(Boolean);
    return html`<li><a class="os2-row" href="${base}/${r.kind}/${encodeURIComponent(r.ref)}"${raw(sel && sel.record.ref === r.ref ? ' aria-current="true"' : '')}>
      <span class="os2-ref">${r.ref}</span>
      <span class="os2-t"><b>${r.title}</b><small>${who(r)}</small></span>
      <span class="os2-r">${raw(stepper(r.status))}${right}${d && (d.status === 'open' || d.status === 'to_check') ? html`<span class="os2-card">${d.status === 'open' ? 'Needs a tap' : 'Needs a check'}</span>` : ''}</span>
    </a></li>`;
  };
  const chip = (k, l, n) => html`<a href="${base}${k === 'all' ? '' : '/' + k}"${raw(k === kind ? ' aria-current="page"' : '')}>${l} <span class="mono">${n}</span></a>`;
  return html`<div class="wk-recs">
    <div class="wk-recs-h">
      <nav class="os2-tabs" aria-label="Records">${chip('all', 'All', records.length)}${kinds.map(([k, l]) => chip(k, l, records.filter((r) => r.kind === k).length))}</nav>
      ${personaPicker(s, ctx.wid)}
    </div>
    <div class="os2${sel ? '' : ' is-one'}">
      ${shown.length ? html`<ul class="os2-list">${shown.map(row)}</ul>` : html`<p class="empty">No records here yet.</p>`}
      ${sel ? detail(sel, sx, ctx, base + (kind === 'all' ? '' : '/' + kind)) : ''}
    </div>
  </div>`;
}

function who(r) {
  const parts = [r.maker && `Made by ${r.maker}`, r.approved_by && `approved by ${r.approved_by}`, r.checked_by && `checked by ${r.checked_by}`].filter(Boolean);
  return parts.join(', ') || (r.owner ? `Owner ${r.owner}` : '');
}
function stockLine(r) {
  const d = r.data || {};
  const cover = d.per_day ? Math.floor(r.qty / d.per_day) : null;
  return [html`<span class="mono">${r.qty.toLocaleString('en-IN')}</span>`, cover != null ? html`<span class="mono${cover < 10 ? ' cs-warn' : ' muted'}">${cover} days cover</span>` : d.incoming ? html`<span class="mono muted">${d.incoming.toLocaleString('en-IN')} incoming</span>` : ''];
}

export function detail(sel, sx, ctx, back = `#/w/${ctx.wid}/chat/all/records`) {
  const r = sel.record, d = sel.decision;
  const step = (k, label, by, ts) => html`<div class="${by || (k === 'draft') ? 'on' : ''}${k === 'approved' && (r.status === 'held' || r.status === 'rejected') ? ' is-held' : ''}"><b>${label}</b>${by || ''}${ts ? html`<br><span class="mono">${ago(ts)}</span>` : ''}</div>`;
  const acts = [
    r.can.approve && html`<button class="btn is-small is-primary" type="button" data-rec="approve" data-ref="${r.ref}">Approve</button>`,
    r.can.check && !(d && d.status === 'open') && html`<button class="btn is-small is-primary" type="button" data-rec="check" data-ref="${r.ref}">Check</button>`,
    r.can.reject && html`<button class="btn is-small" type="button" data-rec="reject" data-ref="${r.ref}">Reject</button>`,
  ].filter(Boolean);
  const blocked = r.status === 'approved' && !r.can.check && r.can.who && (r.can.who === r.approved_by)
    ? html`<p class="muted">${r.can.who} approved this, so someone else checks it. Switch who is tapping above.</p>` : '';
  return html`<aside class="os2-det">
    <div class="os2-box">
      <a class="os2-close linkish" href="${back}">Back to the list</a>
      <p class="mono muted">${r.ref} · ${ST[r.status] || r.status}</p>
      <h2>${r.title}</h2>
      <div class="os2-flow">${step('draft', 'Draft', r.maker)}${step('approved', r.status === 'held' ? 'On hold' : r.status === 'rejected' ? 'Rejected' : 'Approved', r.approved_by, r.approved_ts)}${step('checked', 'Checked', r.checked_by, r.checked_ts)}</div>
      <dl class="os2-kv">
        ${r.fn_name ? html`<dt>Area</dt><dd>${r.fn_name}</dd>` : ''}
        ${r.owner ? html`<dt>Owner</dt><dd>${r.owner}</dd>` : ''}
        ${r.amount != null ? html`<dt>Amount</dt><dd class="mono">${rs(r.amount)}</dd>` : ''}
        ${r.qty != null ? html`<dt>${r.kind === 'stock' ? 'On hand' : 'Units'}</dt><dd class="mono">${r.qty.toLocaleString('en-IN')}</dd>` : ''}
        ${r.data?.per_day ? html`<dt>Selling</dt><dd class="mono">${r.data.per_day} a day</dd>` : ''}
        ${r.data?.location ? html`<dt>Location</dt><dd>${r.data.location}</dd>` : ''}
        ${r.data?.unit && r.data?.po_unit ? html`<dt>Rate</dt><dd class="mono">₹${r.data.unit} billed vs ₹${r.data.po_unit} on ${r.data.po}</dd>` : ''}
        ${r.due ? html`<dt>Due</dt><dd class="mono">${r.due}</dd>` : ''}
        ${r.data?.approver ? html`<dt>Approves</dt><dd>${r.data.approver}${r.data.checker ? `, ${r.data.checker} checks` : ''}</dd>` : ''}
        ${r.data?.note ? html`<dt>Note</dt><dd>${r.data.note}</dd>` : ''}
      </dl>
      ${acts.length ? html`<div class="cs-acts">${acts}</div>` : ''}${blocked}
      ${sel.log?.length ? html`<div><h3 class="cs-h2">History</h3><ul class="os2-log">${sel.log.map((l) => html`<li><span>${l.what} · ${l.by}</span><span class="mono">${ago(l.ts)}</span></li>`)}</ul></div>` : ''}
    </div>
    ${d ? decisionCard(d, sx) : ''}
  </aside>`;
}

