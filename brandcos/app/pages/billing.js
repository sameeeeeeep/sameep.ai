// billing.js: the plan picked on the pricing page and the invoices it makes.
// The owner (the operator) edits the plan with the same toggles as the pricing page and marks invoices paid;
// everyone else in the workspace sees it read-only. API: GET/PUT /w/:wid/billing..., see CONTRACT.md "Billing".
import { html, usd, day, pill } from '../js/ui.js';

export const title = 'Billing';

// Same prices and hours as the pricing page (d2c-clone/pricing/pricing.js) and the Worker's catalog.js.
const PRICE = { integration: 1000, access: 100, m1_extra: 100, m2_extra: 100, custom: 100 };
const HOURS = { integration: 6, m1_extra: 6, m2_extra: 6, custom: 6 };
export const PRESETS = {
  budget: { m1_extra: false, m2_extra: false, custom: false },
  balanced: { m1_extra: true, m2_extra: false, custom: false },
  hands: { m1_extra: true, m2_extra: true, custom: true },
};
const PRESET_TEXT = [
  ['budget', 'Budgeted', 'Set-up plus monthly access. The team runs it after the first two weeks.'],
  ['balanced', 'Balanced', 'Two more weeks of help in month 1, so the habits stick.'],
  ['hands', 'Hands-on', 'Extra weeks in months 1 and 2, plus monthly hours for new builds and training.'],
];
const TEAMS = {
  founders: 'Founders', ops: 'Ops and warehouse', growth: 'Growth and ads', content: 'Content and social',
  finance: 'Finance', support: 'Customer support', agency: 'Your agency',
};
const TOGGLES = [
  ['m1_extra', 'Two more weeks in month 1', '6 more hours of implementation and training while the team gets started.', '+$100'],
  ['m2_extra', 'Two weeks in month 2', '6 hours to tune the set-up once the team has used it for a month.', '+$100'],
  ['custom', 'Custom development and training', '6 hours every month for new connectors, workflows, dashboards or training new people. Stop any month.', '+$100 a month'],
];

const hrs = (n) => (n === 1 ? '1 hour' : (Math.round(n * 10) / 10) + ' hours');

// Month totals, hours and the team split, built exactly as the pricing page and the Worker build them.
export function summaryFor(plan) {
  const p = plan || { teams: [] };
  const c = p.custom ? PRICE.custom : 0;
  const h1 = HOURS.integration + (p.m1_extra ? HOURS.m1_extra : 0) + (p.custom ? HOURS.custom : 0);
  const h2 = (p.m2_extra ? HOURS.m2_extra : 0) + (p.custom ? HOURS.custom : 0);
  const h3 = p.custom ? HOURS.custom : 0;
  const n = (p.teams || []).length, early = h1 + h2;
  return {
    month1: PRICE.integration + (p.m1_extra ? PRICE.m1_extra : 0) + c,
    month2: PRICE.access + (p.m2_extra ? PRICE.m2_extra : 0) + c,
    after: PRICE.access + c,
    hours: { month1: h1, month2: h2, after: h3 },
    team_split: n
      ? n + (n === 1 ? ' team' : ' teams') + ' across ' + hrs(early) + ' in the first two months: about ' + hrs(early / n) + ' each.' +
        (early / n < 1 ? ' That is under an hour a team, so consider adding weeks.' : '')
      : 'No teams picked yet.',
    hours_text: 'Hours with Sameep: ' + hrs(h1) + ' in month 1, ' + hrs(h2) + ' in month 2, ' +
      (h3 ? hrs(h3) + ' each month after.' : 'none after that unless you add custom hours.'),
  };
}

export function presetFor(p) {
  for (const [k, v] of Object.entries(PRESETS)) if (!!p.m1_extra === v.m1_extra && !!p.m2_extra === v.m2_extra && !!p.custom === v.custom) return k;
  return null;
}

// The editable copy of a plan (the fields PUT billing/plan takes).
export function planOf(p, today = '') {
  return p
    ? { start_date: p.start_date, m1_extra: !!p.m1_extra, m2_extra: !!p.m2_extra, custom: !!p.custom, custom_until: p.custom_until || null, teams: [...(p.teams || [])] }
    : { start_date: today, m1_extra: true, m2_extra: false, custom: false, custom_until: null, teams: [] };
}
const samePlan = (a, b) => JSON.stringify(planOf(a)) === JSON.stringify(planOf(b));

const on = (v) => (v ? ' checked' : '');

export function summaryBody(sum) {
  return html`<dl>
      <div><dt>Month 1</dt><dd>${usd(sum.month1)}</dd></div>
      <div><dt>Month 2</dt><dd>${usd(sum.month2)}</dd></div>
      <div><dt>Each month after</dt><dd>${usd(sum.after)}</dd></div>
    </dl>
    <p class="hours">${sum.hours_text}</p>
    <p class="note">${sum.team_split}</p>
    <p class="note">US dollars, before tax.</p>`;
}

function planForm(p, dirty, busy, error) {
  const preset = presetFor(p);
  return html`<form class="build bl-form" id="bl-form" aria-label="Plan" novalidate>
    <fieldset class="fs">
      <legend>Start date</legend>
      <label class="field bl-date"><span>Month 1 starts on</span><input type="date" name="start_date" value="${p.start_date}" required></label>
      <p class="note">Invoice 1 is issued on this date, then on the same day each month. Each is due 7 days later.</p>
    </fieldset>
    <fieldset class="fs">
      <legend>How hands-on?</legend>
      <div class="presets">${PRESET_TEXT.map(([k, name, text]) => html`<label class="pick"><input type="radio" name="preset" value="${k}"${on(k === preset)}><span class="pick-name">${name}</span><span>${text}</span></label>`)}</div>
    </fieldset>
    <fieldset class="fs">
      <legend>What's in it</legend>
      <ul class="lines">
        <li class="line fixed"><div><strong>First-time integration</strong><p>Connecting the tools, setting up the company, its group chats and agents, the first month of access, and two weeks of implementation and training (6 hours).</p></div><span class="amt">$1,000 once</span></li>
        <li class="line fixed"><div><strong>Access and updates</strong><p>The clone, the dashboards and every update, from month 2.</p></div><span class="amt">$100 a month</span></li>
        ${TOGGLES.map(([k, name, text, amt]) => html`<li class="line"><label class="tog"><input type="checkbox" name="${k}"${on(p[k])}><div><strong>${name}</strong><p>${text}</p></div></label><span class="amt">${amt}</span></li>`)}
      </ul>
      <label class="field bl-until"><span>Last month of custom hours (leave empty to keep going)</span><input type="month" name="custom_until" value="${p.custom_until || ''}"${p.custom ? '' : ' disabled'}></label>
    </fieldset>
    <fieldset class="fs">
      <legend>Which teams need training?</legend>
      <div class="teams">${Object.entries(TEAMS).map(([k, name]) => html`<label class="chip"><input type="checkbox" name="team" value="${k}"${on(p.teams.includes(k))}>${name}</label>`)}</div>
    </fieldset>
    <div class="bl-save">
      <button class="btn is-primary is-small" type="submit"${busy ? ' disabled' : ''}>${busy ? 'Saving' : 'Save plan'}</button>
      <span class="muted" id="bl-dirty">${dirty ? 'Unsaved changes' : ''}</span>
    </div>
    ${error ? html`<p class="err" role="alert">${error}</p>` : ''}
  </form>`;
}

function planReadOnly(p) {
  if (!p) return html`<div class="card"><p class="empty">No plan yet. Sameep sets it up after your first call.</p></div>`;
  const yes = (v) => (v ? 'Yes' : 'No');
  return html`<div class="card bl-ro">
    <dl class="bl-dl">
      <div><dt>Month 1 starts</dt><dd>${day(p.start_date)}</dd></div>
      <div><dt>First-time integration</dt><dd>$1,000 once</dd></div>
      <div><dt>Access and updates</dt><dd>$100 a month from month 2</dd></div>
      <div><dt>Two more weeks in month 1</dt><dd>${yes(p.m1_extra)}</dd></div>
      <div><dt>Two weeks in month 2</dt><dd>${yes(p.m2_extra)}</dd></div>
      <div><dt>Custom development and training</dt><dd>${p.custom ? (p.custom_until ? `Yes, through ${p.custom_until}` : 'Yes, monthly') : 'No'}</dd></div>
      <div><dt>Teams to train</dt><dd>${p.teams.length ? p.teams.map((t) => TEAMS[t] || t).join(', ') : 'Not picked yet'}</dd></div>
    </dl>
    <p class="note bl-ro-note">Only Sameep can change the plan or mark invoices paid. Ask him if something looks wrong.</p>
  </div>`;
}

// Billing is real in every workspace, demo or not: no sample tags here.
function invoiceTable(invoices, editable, rowBusy) {
  if (!invoices.length) return html`<div class="tbl-wrap"><p class="empty">Invoices appear once a plan is saved.</p></div>`;
  return html`<div class="tbl-wrap"><table class="tbl bl-tbl">
    <thead><tr><th>Invoice</th><th>Month</th><th>Issued</th><th>Due</th><th>Items</th><th class="r">Total</th><th>Status</th>${editable ? html`<th><span class="sr">Action</span></th>` : ''}</tr></thead>
    <tbody>${invoices.map((i) => html`<tr>
      <td class="mono">${i.no}</td>
      <td>${i.month}</td>
      <td class="bl-d">${day(i.issue_date)}</td>
      <td class="bl-d">${day(i.due_date)}</td>
      <td><ul class="bl-items">${i.lines.map((l) => html`<li><span>${l.label}</span> <span class="muted">${usd(l.amount)}</span></li>`)}</ul></td>
      <td class="r"><b>${usd(i.total)}</b></td>
      <td>${pill(i.status)}${i.status === 'paid' && i.paid_at ? html`<div class="muted bl-paid">${day(i.paid_at)}${i.note ? html`, ${i.note}` : ''}</div>` : ''}</td>
      ${editable ? html`<td class="r">${i.status === 'paid'
        ? html`<button class="btn is-small" type="button" data-unpaid="${i.no}"${rowBusy === i.no ? ' disabled' : ''}>Unmark</button>`
        : html`<button class="btn is-small" type="button" data-paid="${i.no}"${rowBusy === i.no ? ' disabled' : ''}>Mark paid</button>`}</td>` : ''}
    </tr>`)}</tbody>
  </table></div>`;
}

// three tiles: what is due now, the next invoice, and what has been paid
function billKpis(invoices) {
  if (!invoices.length) return '';
  const due = invoices.filter((i) => i.status === 'due');
  const next = invoices.find((i) => i.status === 'upcoming');
  const paid = invoices.filter((i) => i.status === 'paid');
  const sumOf = (l) => l.reduce((n, i) => n + (i.total || 0), 0);
  return html`<div class="kpis bl-kpis">
    <div class="kpi${due.length ? ' is-watch' : ''}"><span class="kpi-l">Due now</span><span class="kpi-v">${usd(sumOf(due))}</span><span class="kpi-f"><span class="kpi-d">${due.length ? due.map((i) => `${i.no} by ${day(i.due_date)}`).join(', ') : 'Nothing due'}</span></span></div>
    <div class="kpi"><span class="kpi-l">Next invoice</span><span class="kpi-v">${next ? usd(next.total) : 'None'}</span><span class="kpi-f"><span class="kpi-d">${next ? `${next.no}, issued ${day(next.issue_date)}` : 'No more invoices on this plan'}</span></span></div>
    <div class="kpi"><span class="kpi-l">Paid so far</span><span class="kpi-v">${usd(sumOf(paid))}</span><span class="kpi-f"><span class="kpi-d">${paid.length} of ${invoices.length} ${invoices.length === 1 ? 'invoice' : 'invoices'}</span></span></div>
  </div>`;
}

// data = Billing from the API, plus the page's own state: draft (owner's working plan), busy, error,
// rowBusy, rowError. Pure: no DOM, so Node can test it.
export function view(data, ctx) {

  const editable = !!data.editable;
  const draft = editable ? (data.draft || planOf(data.plan, data.today || '')) : null;
  const sum = editable ? summaryFor(draft) : data.summary;
  const dirty = editable && (!data.plan || !samePlan(draft, data.plan));
  return html`<section class="pg bl">
    <div class="pg-top"><div>
      <h1 class="pg-h">Billing</h1>
      <p class="pg-sub">The plan picked on the pricing page and the invoices it makes.${editable ? ' Invoices are worked out from the plan, so a change here recalculates every invoice below.' : ''}</p>
    </div></div>
    ${billKpis(data.invoices || [])}
    <div class="bl-layout">
      <div class="bl-main">${editable ? planForm(draft, dirty, data.busy, data.error) : planReadOnly(data.plan)}</div>
      <aside class="sum bl-sum" aria-live="polite"><h3>The plan</h3><div id="bl-sum">${sum ? summaryBody(sum) : ''}</div></aside>
    </div>
    <h2 class="bl-h2">Invoices</h2>
    ${data.rowError ? html`<p class="err" role="alert">${data.rowError}</p>` : ''}
    ${invoiceTable(data.invoices || [], editable, data.rowBusy)}
    <p class="note">Worked out from the plan: month 1 on the start date, then the same day each month, each due 7 days later. Month 1 is the integration and any extra weeks; from month 2, access plus anything added. US dollars, before tax.</p>
  </section>`;
}

// Reads the owner's form into a plan.
function readForm(form) {
  const f = form.elements;
  return {
    start_date: f.start_date.value,
    m1_extra: f.m1_extra.checked, m2_extra: f.m2_extra.checked, custom: f.custom.checked,
    custom_until: f.custom.checked && f.custom_until.value ? f.custom_until.value : null,
    teams: [...form.querySelectorAll('input[name="team"]')].filter((i) => i.checked).map((i) => i.value),
  };
}

export async function mount(root, ctx) {
  const today = new Date().toISOString().slice(0, 10);
  const s = { data: await ctx.api('GET', `/w/${ctx.wid}/billing`), draft: null, busy: false, error: '', rowBusy: null, rowError: '' };
  s.draft = s.data.editable ? planOf(s.data.plan, today) : null;
  const paint = () => { root.innerHTML = String(view({ ...s.data, draft: s.draft, busy: s.busy, error: s.error, rowBusy: s.rowBusy, rowError: s.rowError, today }, ctx)); };
  paint();
  if (!s.data.editable) return null;

  // live summary while the owner edits, without re-rendering the form (keeps focus)
  const live = (form) => {
    s.draft = readForm(form);
    root.querySelector('#bl-sum').innerHTML = String(summaryBody(summaryFor(s.draft)));
    const p = presetFor(s.draft);
    form.querySelectorAll('input[name="preset"]').forEach((r) => { r.checked = r.value === p; });
    form.elements.custom_until.disabled = !s.draft.custom;
    root.querySelector('#bl-dirty').textContent = !s.data.plan || !samePlan(s.draft, s.data.plan) ? 'Unsaved changes' : '';
  };
  const onChange = (e) => {
    const form = e.target.closest('#bl-form');
    if (!form) return;
    if (e.target.name === 'preset') {
      const p = PRESETS[e.target.value];
      for (const k of ['m1_extra', 'm2_extra', 'custom']) form.elements[k].checked = p[k];
    }
    live(form);
  };
  const onSubmit = async (e) => {
    if (e.target.id !== 'bl-form') return;
    e.preventDefault();
    s.draft = readForm(e.target);
    s.busy = true; s.error = ''; paint();
    try {
      s.data = await ctx.api('PUT', `/w/${ctx.wid}/billing/plan`, s.draft);
      s.draft = planOf(s.data.plan, today);
      ctx.toast?.('Plan saved.');
    } catch (err) { s.error = err.message; }
    s.busy = false; paint();
  };
  const onClick = async (e) => {
    const b = e.target.closest('[data-paid], [data-unpaid]');
    if (!b) return;
    const no = b.dataset.paid || b.dataset.unpaid;
    const form = root.querySelector('#bl-form');
    if (form) s.draft = readForm(form);
    s.rowBusy = no; s.rowError = ''; paint();
    try {
      s.data = await ctx.api(b.dataset.paid ? 'POST' : 'DELETE', `/w/${ctx.wid}/billing/invoices/${encodeURIComponent(no)}/paid`);
      ctx.toast?.(b.dataset.paid ? `${no} marked paid.` : `${no} is no longer marked paid.`);
    } catch (err) { s.rowError = err.message; }
    s.rowBusy = null; paint();
  };
  root.addEventListener('change', onChange);
  root.addEventListener('submit', onSubmit);
  root.addEventListener('click', onClick);
  return () => {
    root.removeEventListener('change', onChange);
    root.removeEventListener('submit', onSubmit);
    root.removeEventListener('click', onClick);
  };
}
