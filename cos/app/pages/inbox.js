// inbox.js: what the agent found on its own. It reads meetings, WhatsApp and email, files the work with an owner
// and a checker, and shows it here with the exact quote it came from. The owner accepts, hands it on, or drops it.
// Below that: what's overdue or escalated, and what's waiting on you (approve, check).
// API: /d2c-api/w/:wid/taskos/* and /intake (d2c-clone-app docs/taskos.md). view() is pure; mount() fetches and binds.
import { html, sampleTag, can, day, ago, safeHref } from '../js/ui.js';
import { hrefFor } from '../js/app.js';
import { stepsSection } from '../js/steps.js';

export const title = 'Inbox';

const KIND = { meeting: 'Meeting', whatsapp: 'WhatsApp', email: 'Email' };
const AREA = { website: 'Website', performance: 'Performance', ops: 'Ops', content: 'Content', finance: 'Finance', support: 'Support', 'all-hands': 'All hands' };
const STATE = { plan: 'Plan', final: 'Final', progress: 'In progress', done: 'Done', revision: 'Revision', dropped: 'Dropped' };
const PRI = { p1: 'Urgent', p2: 'Normal', p3: 'Low' };
const LEVEL = ['', 'Owner nudged', 'Checker told', 'With the founder'];
const nameOf = (t, k, email) => (t.names && t.names[k]) || String(email || '').split('@')[0] || 'nobody';

export const due = (t, now = Date.now()) => {
  const d = t.due_ts - now, h = Math.round(Math.abs(d) / 3600_000);
  if (d < 0) return h < 48 ? `${h} h overdue` : `${Math.round(h / 24)} days overdue`;
  return h < 24 ? `due in ${h} h` : `due ${day(t.due_ts)}`;
};

function source(t) {
  if (!t.source_kind && !t.source_quote) return '';
  const where = KIND[t.source_kind] || 'Source';
  const link = safeHref(t.source_link); // http(s) only, checked again here whatever the API sent
  return html`<figure class="ib-src">
    <blockquote>${t.source_quote}</blockquote>
    <figcaption>${where}${t.source_sender ? html`, ${t.source_sender}` : ''}${t.source_title ? html`, ${t.source_title}` : ''}${
      link ? html` <a class="linkish" href="${link}" target="_blank" rel="noopener noreferrer">Open the source</a>` : ''}</figcaption>
  </figure>`;
}

function reassignForm(t, data) {
  const people = (data.people || []).filter((p) => p.role !== 'viewer');
  return html`<form class="ib-reassign" data-id="${t.id}">
    <label class="field"><span>Owner</span><select name="owner_email">${people.map((p) => html`<option value="${p.email}"${p.email === t.owner_email ? ' selected' : ''}>${p.name || p.email}</option>`)}</select></label>
    <label class="field"><span>Checker</span><select name="checker_email">${people.map((p) => html`<option value="${p.email}"${p.email === t.checker_email ? ' selected' : ''}>${p.name || p.email}</option>`)}</select></label>
    <button class="btn is-small is-primary" type="submit"${data.busy ? ' disabled' : ''}>Hand on</button>
    <button class="btn is-small" type="button" data-act="cancel">Cancel</button>
  </form>`;
}

function rejectForm(t, data) {
  return html`<form class="ib-reject" data-id="${t.id}">
    <label class="field"><span class="sr">Why drop it</span><input name="reason" maxlength="300" placeholder="Why, in a few words" required></label>
    <button class="btn is-small" type="submit"${data.busy ? ' disabled' : ''}>Drop it</button>
    <button class="btn is-small" type="button" data-act="cancel">Cancel</button>
  </form>`;
}

function actions(t, data) {
  if (data.open === `reassign:${t.id}`) return reassignForm(t, data);
  if (data.open === `reject:${t.id}`) return rejectForm(t, data);
  if (data.open === `back:${t.id}`) {
    return html`<form class="ib-back" data-id="${t.id}">
      <label class="field"><span class="sr">What needs changing</span><input name="reason" maxlength="300" placeholder="What needs changing" required></label>
      <button class="btn is-small" type="submit"${data.busy ? ' disabled' : ''}>Send back</button>
      <button class="btn is-small" type="button" data-act="cancel">Cancel</button></form>`;
  }
  const c = t.can || {}, dis = data.busy ? ' disabled' : '';
  const b = (act, label, primary) => html`<button class="btn is-small${primary ? ' is-primary' : ''}" type="button" data-act="${act}" data-id="${t.id}"${dis}>${label}</button>`;
  return [
    c.accept ? b('accept', 'Accept', true) : '',
    c.approve ? b('approve', 'Approve plan', true) : '',
    c.start ? b('start', t.state === 'revision' ? 'Start again' : 'Start', false) : '',
    c.submit ? b('submit', 'Mark finished', true) : '',
    c.check ? b('check', 'Check', true) : '',
    c.send_back ? b('open-back', 'Send back', false) : '',
    c.reassign ? b('open-reassign', 'Hand on', false) : '',
    c.reject ? b('open-reject', 'Drop', false) : '',
  ];
}

function card(t, data, { showSource = true } = {}) {
  return html`<article class="ib-card${t.escalation ? ' is-esc' : ''}${t.overdue ? ' is-late' : ''}">
    <header class="ib-h">
      <span class="ib-t">${t.kind === 'decision' ? 'Decision' : AREA[t.area] || 'Task'}</span>
      <span class="ib-meta">${STATE[t.state]}${t.submitted && t.state === 'progress' ? ', finished, waiting for a check' : ''}</span>
      <span class="ib-due${t.overdue ? ' is-late' : ''}">${due(t)}</span>
    </header>
    <h3 class="ib-title">${t.title}</h3>
    ${showSource ? source(t) : ''}
    <p class="ib-people">Owner ${nameOf(t, 'owner', t.owner_email)}, checker ${nameOf(t, 'checker', t.checker_email)}, ${PRI[t.priority]}${
      t.approved_by ? html`, approved by ${nameOf(t, 'approved_by', t.approved_by)}` : ''}${t.escalation ? html`, <b class="ib-esc">${LEVEL[t.escalation]}</b>` : ''}</p>
    <div class="ib-acts">${actions(t, data)}</div>
  </article>`;
}

// decision and result cards in the groups that wait on this person: a vote, an owner's or founder's call, a check
const RULE = { owner: 'Owner decides', majority: 'Majority vote', founder: 'Majority, founder breaks ties' };
function decisionsSection(data, ctx) {
  const list = data.decisions || [];
  return html`<section class="ib-sec">
    <h2 class="sec-h">Cards waiting on you <span class="tab-n">${list.length}</span></h2>
    <p class="pg-sub ib-sub">Agents ask in the groups. Vote, decide or check in one tap from the thread.</p>
    ${list.length ? html`<div class="ib-list">${list.map((c) => html`<article class="ib-card">
      <header class="ib-h"><span class="ib-t">${c.kind === 'result' ? 'Result to check' : c.kind === 'handoff' ? 'Hand-off' : 'Decision'}</span>
        <span class="ib-meta">${AREA[c.group] || c.group_name}${c.kind === 'result' ? '' : `, ${RULE[c.rule]}`}</span></header>
      <h3 class="ib-title">${c.title}</h3>
      <p class="ib-people">${c.waiting_on}</p>
      <div class="ib-acts"><a class="btn is-small is-primary" href="${hrefFor(ctx.wid, 'chats', c.group)}">Open in ${AREA[c.group] || c.group_name}</a></div>
    </article>`)}</div>` : html`<p class="empty">No card in any group is waiting on you.</p>`}
  </section>`;
}

export function view(data, ctx) {
  const all = data.tasks || [];
  const me = ctx.me && ctx.me.user && ctx.me.user.email;
  const found = all.filter((t) => t.found_by_agent && !t.accepted && t.state === 'plan');
  const late = all.filter((t) => (t.overdue || t.escalation) && !['done', 'dropped'].includes(t.state) && !found.includes(t));
  const mine = all.filter((t) => !found.includes(t) && !late.includes(t) && Object.values(t.can || {}).some(Boolean) && (t.owner_email === me || t.checker_email === me || t.can.approve));
  const s = data.summary || {};
  const viewer = !can(ctx.role, 'member');
  const section = (h, sub, list, empty, opts) => html`<section class="ib-sec">
    <h2 class="sec-h">${h} <span class="tab-n">${list.length}</span></h2>
    ${sub ? html`<p class="pg-sub ib-sub">${sub}</p>` : ''}
    ${list.length ? html`<div class="ib-list">${list.map((t) => card(t, data, opts))}</div>` : html`<p class="empty">${empty}</p>`}
  </section>`;
  return html`<section class="pg ib">
    <div class="pg-top"><div>
      <h1 class="pg-h">Inbox ${sampleTag(ctx.ws)}</h1>
      <p class="pg-sub">Work the agent found in your meetings, WhatsApp and email, already given an owner and a checker. Nobody had to raise it. Agents draft; people accept, approve and check.</p>
    </div></div>
    <div class="kpis ib-kpis">
      <div class="kpi"><span class="kpi-l">Found by the agent</span><span class="kpi-v">${s.found || 0}</span><span class="kpi-f"><span class="kpi-d">waiting to be accepted</span></span></div>
      <div class="kpi${s.overdue ? ' is-watch' : ''}"><span class="kpi-l">Overdue</span><span class="kpi-v">${s.overdue || 0}</span><span class="kpi-f"><span class="kpi-d${s.overdue ? ' is-bad' : ''}">past their due time</span></span></div>
      <div class="kpi${s.escalated ? ' is-watch' : ''}"><span class="kpi-l">Escalated</span><span class="kpi-v">${s.escalated || 0}</span><span class="kpi-f"><span class="kpi-d">owner, then checker, then founder</span></span></div>
      <div class="kpi"><span class="kpi-l">On you</span><span class="kpi-v">${s.mine || 0}</span><span class="kpi-f"><span class="kpi-d">you own or check these</span></span></div>
    </div>
    ${data.error ? html`<p class="err" role="alert">${data.error}</p>` : ''}
    ${viewer ? html`<p class="note">You can read everything here. A member accepts, approves and checks.</p>` : ''}
    ${section('Found by the agent', 'Each one shows the line it came from. Accept it, hand it to someone else, or drop it.', found, 'Nothing new. The agent files work here as soon as it hears about it.')}
    ${stepsSection(data.steps, ctx)}
    ${decisionsSection(data, ctx)}
    ${section('Overdue and escalated', '', late, 'Nothing is late.', { showSource: false })}
    ${section('Waiting on you', '', mine, 'Nothing needs you right now.', { showSource: false })}
    ${(data.sources || []).length ? html`<section class="ib-sec">
      <h2 class="sec-h">What the agent read</h2>
      <table class="tbl ib-read"><thead><tr><th>Source</th><th>From</th><th>Result</th><th>When</th></tr></thead><tbody>
        ${data.sources.slice(0, 12).map((r) => html`<tr><td>${KIND[r.kind]}${r.title ? html`: ${r.title}` : ''}</td><td>${r.sender_name || r.sender_email || 'Team'}</td>
          <td>${r.outcome === 'tasks' ? `${r.found} filed` : r.outcome === 'updated' ? 'Updated a task' : r.outcome === 'fyi' ? 'FYI, not on the team' : 'Nothing to do'}</td><td>${ago(r.received_ts)}</td></tr>`)}
      </tbody></table></section>` : ''}
  </section>`;
}

export async function mount(root, ctx) {
  const base = `/w/${ctx.wid}`;
  const s = { tasks: [], summary: {}, sources: [], people: [], decisions: [], open: null, busy: false, error: '' };
  async function load() {
    const [list, sum, src, team, dec, st] = await Promise.all([
      ctx.api('GET', `${base}/taskos/tasks`), ctx.api('GET', `${base}/taskos/summary`), ctx.api('GET', `${base}/intake`),
      ctx.api('GET', `${base}/team`).catch(() => ({ members: [] })),
      ctx.api('GET', `${base}/decisions?mine=1`).catch(() => ({ cards: [] })),
      ctx.api('GET', `${base}/steps`).catch(() => ({ steps: [] })),
    ]);
    s.steps = st.steps || [];
    s.decisions = dec.cards || [];
    s.tasks = list.tasks; s.summary = sum; s.sources = src.sources; s.people = team.members || team.people || [];
  }
  const paint = () => { root.innerHTML = String(view(s, ctx)); };
  try { await load(); } catch (e) { s.error = e.message; }
  paint();

  async function run(fn) {
    s.busy = true; s.error = ''; paint();
    try { await fn(); s.open = null; await load(); } catch (e) { s.error = e.message; }
    s.busy = false; paint();
  }
  const post = (id, a, b = {}) => ctx.api('POST', `${base}/taskos/tasks/${id}/${a}`, b);

  const onClick = (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = Number(btn.dataset.id), a = btn.dataset.act;
    if (a === 'cancel') { s.open = null; paint(); return; }
    if (a.startsWith('open-')) { s.open = `${a.slice(5)}:${id}`; paint(); return; }
    run(() => post(id, a));
  };
  const onSubmit = (e) => {
    const f = e.target.closest('form'); if (!f) return;
    e.preventDefault();
    const id = Number(f.dataset.id), v = Object.fromEntries(new FormData(f));
    if (f.classList.contains('ib-reassign')) run(() => post(id, 'reassign', v));
    else if (f.classList.contains('ib-reject')) run(() => post(id, 'reject', v));
    else if (f.classList.contains('ib-back')) run(() => post(id, 'send-back', v));
  };
  root.addEventListener('click', onClick);
  root.addEventListener('submit', onSubmit);
  return () => { root.removeEventListener('click', onClick); root.removeEventListener('submit', onSubmit); };
}
