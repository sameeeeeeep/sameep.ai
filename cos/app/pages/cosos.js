// cosos.js: the OS. Every record (tasks, POs, vendor invoices, QC batches, stock, orders) goes draft -> approved ->
// checked; the person who approves never checks, and the agent that drafted it never approves. A record that came
// from a decision carries that card (js/cos.js), and checking either one checks both.
// Route: #/w/<wid>/os/<kind>/<ref>  (kind: task|po|invoice|qc|stock|order, or all with a ref)
import { html } from '../js/ui.js';
import { cosApi, live, bindCards, decisionCard, stepper, rs, ago, head, loadFaces, changed } from '../js/cos.js';
import { raw } from '../js/ui.js';

export const title = 'OS';
export const TABS = [['task', 'Tasks'], ['po', 'POs'], ['invoice', 'Invoices'], ['qc', 'QC batches'], ['stock', 'Stock'], ['order', 'Orders']];
const ST = { draft: 'Draft', approved: 'Approved', checked: 'Checked', held: 'On hold', rejected: 'Rejected' };

// Pure. data = {state, counts, records, decisions, sel: {record, log, decision} | null}; kind = tab
export function view(data, ctx, kind) {
  const { state: s, counts = {}, records = [], decisions = {}, sel } = data;
  const sx = { ...s, wid: ctx.wid };
  const n = (k) => { const c = counts[k] || {}; return (c.draft || 0) + (c.approved || 0) + (c.held || 0); };
  const row = (r) => {
    const d = r.decision_id ? decisions[r.decision_id] : null;
    const right = r.kind === 'stock' ? stockLine(r) : [r.amount != null && html`<span class="mono">${rs(r.amount)}</span>`, r.qty != null && r.kind !== 'order' && html`<span class="mono muted">${r.qty.toLocaleString('en-IN')} units</span>`].filter(Boolean);
    return html`<li><a class="os2-row" href="#/w/${ctx.wid}/os/${r.kind}/${encodeURIComponent(r.ref)}"${raw(sel && sel.record.ref === r.ref ? ' aria-current="true"' : '')}>
      <span class="os2-ref">${r.ref}</span>
      <span class="os2-t"><b>${r.title}</b><small>${who(r)}</small></span>
      <span class="os2-r">${raw(stepper(r.status))}${right}${d && (d.status === 'open' || d.status === 'to_check') ? html`<span class="os2-card">${d.status === 'open' ? 'Card: needs a tap' : 'Card: needs a check'}</span>` : ''}</span>
    </a></li>`;
  };
  return html`<section class="pg">
    ${head('OS', '', s, ctx.wid)}
    <p class="os2-rule">${raw(stepper('approved'))}<span>Draft, approved, checked. The approver never checks; the agent that drafts never approves.</span></p>
    <nav class="os2-tabs" aria-label="Records">${TABS.map(([k, l]) => html`<a href="#/w/${ctx.wid}/os/${k}"${raw(k === kind ? ' aria-current="page"' : '')}>${l}${n(k) ? html` <span class="mono">${n(k)}</span>` : ''}</a>`)}</nav>
    <div class="os2">
      ${records.length ? html`<ul class="os2-list">${records.map(row)}</ul>` : html`<p class="empty">No records here.</p>`}
      ${sel ? detail(sel, sx, ctx) : html`<aside class="os2-det"><div class="os2-box"><p class="muted">Pick a record to see who made it, who approved it, who checked it, and its card.</p></div></aside>`}
    </div>
  </section>`;
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

export function detail(sel, sx, ctx) {
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
      <a class="os2-close linkish" href="#/w/${ctx.wid}/os/${r.kind}">Back to the list</a>
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

export async function mount(root, ctx) {
  let kind = TABS.some(([k]) => k === ctx.params[0]) ? ctx.params[0] : 'task';
  const ref = ctx.params[1] || null;
  let data = null;
  const load = async () => {
    const [state, sel] = await Promise.all([cosApi(ctx, 'GET', 'state'), ref ? cosApi(ctx, 'GET', `records/${encodeURIComponent(ref)}`).catch(() => null) : null]);
    if (sel && ctx.params[0] === 'all') kind = sel.record.kind; // a link from a card that did not know the kind
    const recs = await cosApi(ctx, 'GET', `records?kind=${kind}`);
    data = { state, ...recs, sel };
    await loadFaces(ctx, state.people);
  };
  const paint = () => {
    root.innerHTML = String(view(data, ctx, kind));
    if (ref && matchMedia('(max-width: 1100px)').matches) root.querySelector('.os2-det')?.scrollIntoView({ block: 'start' });
  };
  const refresh = async () => { try { await load(); paint(); } catch (e) { ctx.toast(e.message); } };
  await load(); paint();
  const unbind = bindCards(root, ctx, refresh);
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-rec]');
    if (!b) return;
    b.disabled = true;
    try {
      await cosApi(ctx, 'POST', `records/${encodeURIComponent(b.dataset.ref)}/${b.dataset.rec}`, {});
      changed(ctx.wid);
      ctx.toast(b.dataset.rec === 'check' ? 'Checked. The card shows it everywhere.' : b.dataset.rec === 'approve' ? 'Approved. Someone else checks it next.' : 'Rejected.');
    } catch (err) { ctx.toast(err.message); }
    await refresh();
  });
  const stop = live(ctx, refresh);
  return () => { stop(); unbind(); };
}
