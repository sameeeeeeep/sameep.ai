// chats.js: Work. One screen that is chat, voice and tasks together.
//   Left:   area threads (Website, Performance, Ops, Content, Finance, Support, All hands) with unread and
//           "needs you" counts.
//   Middle: the thread. People, vendors and the area's agent; text and voice notes (recorded here, played back
//           here). The agent replies and turns a message into a task card. Approval cards work as before.
//           Decision cards sit in the thread: a question, options, one recommended, "Something else", one tap.
//   Right:  the area's board: Plan, Final, In progress, Done, Revision. The agent moves cards as it works; people
//           tap Approve plan (Plan -> Final), Check (In progress or Done, never by whoever approved the plan) and
//           Send back (-> Revision). Every tap is recorded with who and when.
// Route: #/w/<wid>/chats/<area slug> (default all-hands). API: worker src/modules/chats.js ("Work").
// view() is pure (Node tests it); mount() fetches, binds, records and plays voice notes, and polls.
import { html, pill, sampleTag, can, ago } from '../js/ui.js';
import { hrefFor } from '../js/app.js';
import { apiBase, token } from '../js/api.js';

export const title = 'Work';
export const POLL_MS = 10_000;
export const LIVE_MS = 3_000;           // while the agent is working on a card

const KIND = {
  discount: 'Discount code', ad_budget: 'Ad budget', reply: 'Customer reply', restock: 'Restock', payout: 'Vendor payout',
  refund: 'Refund', post: 'Post', drive_read: 'Drive and Calendar read',
};
export const STAGES = [
  { key: 'plan', name: 'Plan', empty: 'No plans waiting.' },
  { key: 'final', name: 'Final', empty: 'Nothing approved and waiting to start.' },
  { key: 'in_progress', name: 'In progress', empty: 'The agent is not working on anything here.' },
  { key: 'done', name: 'Done', empty: 'Nothing finished yet.' },
  { key: 'revision', name: 'Revision', empty: 'Nothing sent back.' },
];

// 'rohan@unfiltrd.example' -> 'Rohan'; agent names pass through
export const person = (who) => {
  if (!who) return '';
  if (!String(who).includes('@')) return who;
  const n = String(who).split('@')[0].split(/[._-]/)[0];
  return n.charAt(0).toUpperCase() + n.slice(1);
};
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
export const clock = (ms) => { const s = Math.max(0, Math.round((ms || 0) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const count = (n) => (n > 99 ? '99+' : String(n));

// ---- approval cards (unchanged rules: Approve, Edit, Reject, and a second person's Check) ---------

function cardActions(c, ctx, ui) {
  const me = ctx.me?.user?.email;
  const member = can(ctx.role, 'member');
  const out = [];
  // data-version: the card version painted on screen; the API refuses a decision on any other version
  if (c.can.approve) out.push(html`<button class="btn is-primary is-small" type="button" data-act="approve" data-id="${c.id}" data-version="${c.version}">Approve</button>`);
  else if (member && c.status === 'pending' && me && c.edited_by === me) {
    out.push(html`<button class="btn is-small" type="button" disabled title="You edited this card, so someone else approves it.">Approve</button>`);
  } else if (member && c.status === 'pending' && c.kind === 'drive_read') {
    out.push(html`<button class="btn is-small" type="button" disabled title="Only admins and the owner can approve Drive and Calendar reads.">Approve</button>`);
  }
  if (c.can.check) out.push(html`<button class="btn is-primary is-small" type="button" data-act="check" data-id="${c.id}" data-version="${c.version}">Check and approve</button>`);
  else if (member && c.status === 'awaiting_check' && me && c.approved_by === me) {
    out.push(html`<button class="btn is-small" type="button" disabled title="A second person must check this. You approved it.">Check</button>`);
  }
  if (c.can.edit) out.push(html`<button class="btn is-small" type="button" data-act="edit" data-id="${c.id}">Edit</button>`);
  if (c.can.reject) out.push(html`<button class="btn is-small" type="button" data-act="reject" data-id="${c.id}">Reject</button>`);
  if (!out.length) return '';
  return html`<div class="ch-acts"${ui.busy === c.id ? ' aria-busy="true"' : ''}>${out}</div>`;
}

function cardView(c, ctx, ui) {
  const editing = ui.editing === c.id && c.can.edit;
  const rejecting = ui.rejecting === c.id && c.can.reject;
  const who = [];
  if (c.approved_by) who.push(`Approved by ${c.names?.approved_by || person(c.approved_by)}`);
  if (c.checked_by) who.push(`checked by ${c.names?.checked_by || person(c.checked_by)}`);
  if (c.edited_by) who.push(`edited by ${c.names?.edited_by || person(c.edited_by)}`);
  const body = editing
    ? html`<form class="ch-edit" data-form="edit" data-id="${c.id}" data-version="${c.version}">
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
      ? html`<form class="ch-reject" data-form="reject" data-id="${c.id}" data-version="${c.version}">
          <label class="field"><span>Why reject it?</span><input name="reason" maxlength="300" required></label>
          <div class="ch-acts"><button class="btn is-primary is-small" type="submit">Reject</button>
            <button class="btn is-small" type="button" data-act="cancel">Cancel</button></div></form>`
      : editing ? '' : cardActions(c, ctx, ui)}
  </div>`;
}

// ---- task cards -------------------------------------------------------------------------------------

function taskWho(t, ui) {
  const n = (k, e) => t.names?.[k] || person(e);
  const out = [];
  if (t.plan_approved_by) out.push(html`<li>Plan approved by <b>${n('plan_approved_by', t.plan_approved_by)}</b>, ${ago(t.plan_approved_ts, ui.now)}</li>`);
  if (t.checked_by) out.push(html`<li>Checked by <b>${n('checked_by', t.checked_by)}</b>, ${ago(t.checked_ts, ui.now)}</li>`);
  if (t.stage === 'revision' && t.sent_back_by) out.push(html`<li>Sent back by <b>${n('sent_back_by', t.sent_back_by)}</b>, ${ago(t.sent_back_ts, ui.now)}: ${t.reason}</li>`);
  return out.length ? html`<ul class="wk-who">${out}</ul>` : '';
}

// what the card says the agent or the people are doing now
function taskState(t, ctx) {
  const steps = t.steps || [];
  if (t.stage === 'plan') return 'Waiting for someone to approve the plan.';
  if (t.stage === 'final') return t.working ? 'Approved. The agent starts shortly.' : ctx.ws?.demo ? 'Approved and waiting to start.' : 'Approved. Agents run in demo workspaces only for now.';
  if (t.stage === 'in_progress') return `Step ${Math.min(t.progress + 1, steps.length)} of ${steps.length}: ${steps[t.progress] || 'wrapping up'}`;
  if (t.stage === 'done') return t.checked_by ? 'Done and checked.' : 'Done. Needs a check from a second person.';
  return t.working ? 'The agent is re-planning around the note.' : 'Waiting for a new plan.';
}

function taskActions(t, ctx, ui) {
  const me = ctx.me?.user?.email;
  if (!can(ctx.role, 'member')) return '';
  if (ui.sendingBack === t.id && t.can.send_back) {
    return html`<form class="wk-sendback" data-form="send-back" data-id="${t.id}" data-version="${t.version}">
      <label class="wk-field"><span>What needs to change?</span><input name="reason" maxlength="300" required autocomplete="off"></label>
      <div class="wk-acts"><button class="wk-btn is-go" type="submit">Send back</button><button class="wk-btn" type="button" data-act="cancel">Cancel</button></div>
    </form>`;
  }
  const out = [];
  const busy = ui.busy === `t${t.id}`;
  if (t.can.approve_plan) out.push(html`<button class="wk-btn is-go" type="button" data-act="approve-plan" data-id="${t.id}" data-version="${t.version}"${busy ? ' disabled' : ''}>Approve plan</button>`);
  if (t.can.check) out.push(html`<button class="wk-btn is-go" type="button" data-act="check-work" data-id="${t.id}" data-version="${t.version}"${busy ? ' disabled' : ''}>Check</button>`);
  else if ((t.stage === 'in_progress' || t.stage === 'done') && !t.checked_by && me && t.plan_approved_by === me) {
    out.push(html`<button class="wk-btn" type="button" disabled title="A second person must check this. You approved the plan.">Check</button>`);
  }
  if (t.can.send_back) out.push(html`<button class="wk-btn" type="button" data-act="send-back" data-id="${t.id}">Send back</button>`);
  return out.length ? html`<div class="wk-acts">${out}</div>` : '';
}

// full = in the thread (every step listed); otherwise the board's compact card
export function taskView(t, ctx, ui, full = false) {
  const steps = t.steps || [];
  const pct = t.stage === 'done' ? 100 : t.stage === 'in_progress' ? Math.round((t.progress / Math.max(1, steps.length)) * 100) : 0;
  const mine = t.can?.approve_plan || t.can?.check;
  return html`<article class="wk-task is-${t.stage}${t.complete ? ' is-complete' : ''}${full ? ' is-full' : ''}${ui.focus === t.id ? ' is-focus' : ''}" data-task="${t.id}">
    <header class="wk-task-top">
      <span class="wk-proj">${t.project || t.group_name || ''}</span>
      <span class="wk-stage">${mine ? html`<span class="wk-you">Needs you</span>` : ''}${t.complete ? 'Checked' : t.stage_name}</span>
    </header>
    <h3 class="wk-task-t">${t.title}</h3>
    ${t.stage === 'in_progress' || t.stage === 'done' ? html`<div class="wk-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${steps.length}" aria-valuenow="${t.stage === 'done' ? steps.length : t.progress}" aria-label="Steps done"><span style="width:${pct}%"></span></div>` : ''}
    <p class="wk-state">${taskState(t, ctx)}</p>
    ${full && steps.length ? html`<ol class="wk-steps">${steps.map((s, i) => html`<li class="${t.stage === 'done' || (t.stage === 'in_progress' && i < t.progress) ? 'is-done' : t.stage === 'in_progress' && i === t.progress ? 'is-now' : ''}">${s}</li>`)}</ol>` : ''}
    ${taskWho(t, ui)}
    ${taskActions(t, ctx, ui)}
  </article>`;
}

// ---- messages ---------------------------------------------------------------------------------------

function voiceView(m, ui) {
  const v = m.voice;
  const playing = ui.playing === v.id;
  return html`<div class="wk-voice">
    <div class="wk-voice-row">
      <button class="wk-play" type="button" data-play="${v.id}" aria-label="${playing ? 'Pause the voice note' : 'Play the voice note'}">${playing ? 'Pause' : 'Play'}</button>
      <span class="wk-vname">Voice note</span>
      <span class="wk-vlen mono" data-vpos="${v.id}">${playing && ui.playPos ? `${clock(ui.playPos)} / ` : ''}${clock(v.duration_ms)}</span>
    </div>
    ${v.transcript
      ? html`<p class="wk-tr"><span class="wk-tr-l">Transcript, made on the sender's device</span>${v.transcript}</p>`
      : html`<p class="wk-tr is-none"><span class="wk-tr-l">No transcript</span>Demo mode has no server transcription. Play the note to hear it.</p>`}
  </div>`;
}

function messageView(m, ctx, ui) {
  if (m.author_kind === 'system') return html`<li class="ch-msg is-system" data-id="${m.id}"><span>${m.body}</span> <span class="muted">${ago(m.ts, ui.now)}</span></li>`;
  const asTask = m.author_kind === 'person' && can(ctx.role, 'member') && !m.task_id;
  return html`<li class="ch-msg is-${m.author_kind}" data-id="${m.id}">
    <div class="ch-msg-h"><b>${m.author_name || person(m.author)}</b>${m.author_kind === 'agent' ? html` <span class="ch-tag mono">Agent</span>` : ''}${m.author_kind === 'vendor' ? html` <span class="ch-tag mono">Vendor</span>` : ''}
      <span class="muted ch-time">${ago(m.ts, ui.now)}</span></div>
    ${m.voice ? voiceView(m, ui) : html`<p class="ch-body">${m.body}</p>`}
    ${m.task_id ? html`<button class="wk-link" type="button" data-act="focus" data-id="${m.task_id}">On the board</button>`
      : asTask ? html`<button class="wk-link" type="button" data-act="make-task" data-id="${m.id}"${ui.busy === `m${m.id}` ? ' disabled' : ''}>Make it a task</button>` : ''}
    ${m.task ? taskView(m.task, ctx, ui, true) : ''}
    ${m.card ? cardView(m.card, ctx, ui) : ''}
  </li>`;
}

// ---- decision cards: a question, 2 to 4 options, one recommended, "something else", one tap ----------
// Members vote with one tap, add their own option, or comment. Each voter's agent has pre-voted with a reason
// (advice, never counted). The card resolves by its rule and says who decided; the agent then posts its draft as
// a result card for someone other than the decider to check. API: worker src/modules/cards.js (/decisions).

export const RULE_NAME = { owner: 'Owner decides', majority: 'Majority vote', founder: 'Majority, founder breaks ties' };
const HOW = { owner: 'the owner', majority: 'majority', founder_tiebreak: 'the founder, breaking a tie' };

function dcOption(c, o, ui) {
  const mine = c.my_vote === o.id;
  const pre = c.my_pre && c.my_pre.option_id === o.id && c.my_vote == null;
  const closed = c.status !== 'open';
  const names = o.voters.map((v) => v.name).filter(Boolean);
  const inner = html`<span class="dc-opt-l">${o.label}${o.recommended ? html`<span class="dc-rec mono">Recommended</span>` : ''}${o.won ? html`<span class="dc-won mono">Decided</span>` : ''}</span>
    <span class="dc-n mono" aria-label="${o.count} ${o.count === 1 ? 'vote' : 'votes'}">${o.count}</span>
    ${o.detail ? html`<span class="dc-opt-d">${o.detail}</span>` : ''}
    ${o.author_kind === 'person' ? html`<span class="dc-opt-by">Suggested by ${o.author_name}</span>` : ''}
    ${names.length ? html`<span class="dc-opt-who">Voted: ${names.join(', ')}</span>` : ''}`;
  const cls = `dc-opt${mine ? ' is-mine' : ''}${pre ? ' is-pre' : ''}${o.won ? ' is-won' : ''}${closed && !o.won ? ' is-out' : ''}`;
  if (c.can.vote) {
    return html`<li><button class="${cls}" type="button" data-dc="vote" data-id="${c.id}" data-opt="${o.id}" aria-pressed="${mine}"${ui.busy === `d${c.id}` ? ' disabled' : ''}>${inner}</button></li>`;
  }
  return html`<li><div class="${cls}">${inner}</div></li>`;
}

function dcDecided(c, ui) {
  const d = c.decided;
  if (!d) return '';
  const o = c.options.find((x) => x.id === d.option_id);
  const by = d.how === 'majority' ? `By majority, ${d.note}${d.name ? `. The deciding vote was ${d.name}'s` : ''}` : `By ${HOW[d.how] || d.how}, ${d.name}`;
  return html`<p class="dc-out"><b>${o ? o.label : 'Decided'}.</b> ${by}, ${ago(d.ts, ui.now)}.${c.results.length ? ' The agent drafted the work below.' : ''}</p>`;
}

function dcComments(c, ui) {
  const all = c.comments || [];
  const open = ui.dcThread === c.id;
  const shown = open ? all : all.slice(-2);
  return html`<div class="dc-talk">
    ${all.length > shown.length ? html`<button class="wk-link" type="button" data-dc="thread" data-id="${c.id}">All ${all.length} comments</button>` : ''}
    ${shown.length ? html`<ul class="dc-comments">${shown.map((m) => html`<li><b>${m.name}</b> ${m.body} <span class="ch-time">${ago(m.ts, ui.now)}</span></li>`)}</ul>` : ''}
    ${c.can.comment ? html`<form class="dc-line" data-form="dc-comment" data-id="${c.id}">
      <label class="sr" for="dc-c-${c.id}">Comment on this card</label>
      <input id="dc-c-${c.id}" name="body" maxlength="600" placeholder="Comment" autocomplete="off">
      <button class="wk-btn" type="submit">Post</button></form>` : ''}
  </div>`;
}

function dcDecision(c, ctx, ui) {
  const busy = ui.busy === `d${c.id}`;
  const tied = c.tally.tied ? c.options.filter((o) => o.count === Math.max(...c.options.map((x) => x.count))) : c.options;
  return html`<article class="dc is-${c.status}${c.needs_you ? ' is-you' : ''}" data-dc-card="${c.id}">
    <header class="dc-top"><span>${c.kind === 'handoff' ? 'Hand-off' : 'Decision'}${c.project ? ` · ${c.project}` : ''}</span>
      <span>${c.needs_you ? html`<span class="wk-you">Needs you</span> ` : ''}${RULE_NAME[c.rule]}</span></header>
    <h3 class="dc-q">${c.title}</h3>
    ${c.context ? html`<p class="dc-ctx">${c.context}</p>` : ''}
    <ol class="dc-opts">
      ${c.options.map((o) => dcOption(c, o, ui))}
      ${c.can.suggest ? (ui.suggesting === c.id
        ? html`<li><form class="dc-else is-open" data-form="dc-suggest" data-id="${c.id}">
            <label class="sr" for="dc-s-${c.id}">Your option</label>
            <input id="dc-s-${c.id}" name="label" maxlength="120" placeholder="Your option, in a few words" required autocomplete="off">
            <input name="detail" maxlength="300" placeholder="Why (optional)" autocomplete="off" aria-label="Why">
            <div class="wk-acts"><button class="wk-btn is-go" type="submit"${busy ? ' disabled' : ''}>Add option</button><button class="wk-btn" type="button" data-dc="cancel">Cancel</button></div>
          </form></li>`
        : html`<li><button class="dc-else" type="button" data-dc="suggest" data-id="${c.id}">Something else</button></li>`) : ''}
    </ol>
    ${c.status === 'open' && c.my_pre && c.my_vote == null ? html`<p class="dc-pre">Your agent leans <b>${(c.options.find((o) => o.id === c.my_pre.option_id) || {}).label}</b>: ${c.my_pre.reason} It does not count until you tap.</p>` : ''}
    ${c.can.decide ? html`<div class="dc-decide"><span>${c.rule === 'owner' ? 'You decide this one.' : 'It is tied. You break the tie.'}</span>
      ${tied.map((o) => html`<button class="wk-btn" type="button" data-dc="decide" data-id="${c.id}" data-opt="${o.id}" data-version="${c.version}"${busy ? ' disabled' : ''}>Go with ${o.label}</button>`)}</div>` : ''}
    ${c.status === 'open' ? html`<p class="dc-wait">${c.waiting_on}</p>` : dcDecided(c, ui)}
    ${c.status === 'open' && ui.videos && ui.videos[c.id] ? html`<p class="dc-vid"><a href="${hrefFor(ctx.wid, 'standup', 'videos', c.id)}">Watch the walkthrough, ${ui.videos[c.id]}</a></p>` : ''}
    ${dcComments(c, ui)}
  </article>`;
}

function dcResult(c, ctx, ui) {
  const busy = ui.busy === `d${c.id}`;
  const me = ctx.me?.user?.email;
  const lines = String(c.context || '').split('\n\n');
  return html`<article class="dc is-result is-${c.status}${c.needs_you ? ' is-you' : ''}" data-dc-card="${c.id}">
    <header class="dc-top"><span>Result to check${c.revision > 1 ? ` · revision ${c.revision}` : ''}</span>
      <span>${c.needs_you ? html`<span class="wk-you">Needs you</span> ` : ''}${c.status === 'checked' ? 'Checked' : c.status === 'sent_back' ? 'Sent back' : 'Draft'}</span></header>
    <h3 class="dc-q">${c.title}</h3>
    ${lines.map((p) => html`<p class="dc-draft">${p}</p>`)}
    <p class="dc-note">${ctx.ws?.demo ? 'Demo mode: a draft, nothing was sent or published.' : 'A draft. Nothing leaves until a person sends it.'}</p>
    ${c.status === 'to_check' ? html`<p class="dc-wait">${c.waiting_on}</p>` : ''}
    ${c.checked ? html`<p class="dc-out">Checked by <b>${c.checked.name}</b>, ${ago(c.checked.ts, ui.now)}.</p>` : ''}
    ${c.sent_back ? html`<p class="dc-out">Sent back by <b>${c.sent_back.name}</b>, ${ago(c.sent_back.ts, ui.now)}: ${c.sent_back.reason}</p>` : ''}
    ${ui.dcBack === c.id && c.can.send_back
      ? html`<form class="wk-sendback" data-form="dc-back" data-id="${c.id}" data-version="${c.version}">
          <label class="wk-field"><span>What needs to change?</span><input name="reason" maxlength="300" required autocomplete="off"></label>
          <div class="wk-acts"><button class="wk-btn is-go" type="submit">Send back</button><button class="wk-btn" type="button" data-dc="cancel">Cancel</button></div></form>`
      : c.can.check || c.can.send_back ? html`<div class="wk-acts">
          ${c.can.check ? html`<button class="wk-btn is-go" type="button" data-dc="check" data-id="${c.id}" data-version="${c.version}"${busy ? ' disabled' : ''}>Check</button>` : ''}
          ${c.can.send_back ? html`<button class="wk-btn" type="button" data-dc="back" data-id="${c.id}">Send back</button>` : ''}</div>`
        : c.status === 'to_check' && me && c.checker?.email !== me && can(ctx.role, 'member') ? html`<div class="wk-acts"><button class="wk-btn" type="button" disabled title="Someone other than the person who decided checks the result.">Check</button></div>` : ''}
  </article>`;
}

export const decisionView = (c, ctx, ui) => (c.kind === 'result' ? dcResult(c, ctx, ui) : dcDecision(c, ctx, ui));

function decisionItem(c, ctx, ui) {
  const author = c.posted_kind === 'person' ? c.posted_name : c.posted_by;
  return html`<li class="ch-msg is-${c.posted_kind === 'person' ? 'person' : 'agent'} is-dc" data-dc-id="${c.id}">
    <div class="ch-msg-h"><b>${author}</b>${c.posted_kind !== 'person' ? html` <span class="ch-tag mono">Agent</span>` : ''}<span class="muted ch-time">${ago(c.ts, ui.now)}</span></div>
    ${decisionView(c, ctx, ui)}
  </li>`;
}

// ---- the page ---------------------------------------------------------------------------------------

function threadsView(groups, slug, ctx, dec = {}) {
  return html`<nav class="ch-groups wk-threads" aria-label="Threads">${groups.map((x) => {
    const needs = (x.needs_you ?? x.open_cards ?? 0) + (dec[x.slug] || 0);
    const unread = x.slug === slug ? 0 : x.unread || 0;
    return html`<a class="ch-group" href="${hrefFor(ctx.wid, 'chats', x.slug)}"${x.slug === slug ? html` aria-current="page"` : ''}>
      <span class="ch-group-n"><span class="wk-gname">${x.name}</span>${unread ? html`<span class="wk-unread" title="${unread} unread">${count(unread)}</span>` : ''}</span>
      <span class="ch-group-l muted">${x.last ? `${x.last.author_name}: ${x.last.body}` : x.agent}</span>
      ${needs ? html`<span class="wk-needs"><span class="ch-count">${count(needs)}</span> need${needs === 1 ? 's' : ''} you</span>` : ''}
    </a>`;
  })}</nav>`;
}

function boardView(data, ctx, ui) {
  const b = data.board;
  if (!b) return html`<aside class="wk-board" aria-label="Board"><p class="loading">Loading the board</p></aside>`;
  const by = Object.fromEntries(STAGES.map((s) => [s.key, []]));
  for (const t of b.tasks || []) (by[t.stage] || by.plan).push(t);
  // in Done, work still waiting for a check comes first
  by.done.sort((x, y) => Number(!!x.checked_by) - Number(!!y.checked_by) || y.updated - x.updated);
  const g = data.group;
  return html`<aside class="wk-board" aria-label="${g ? `${g.name} board` : 'Board'}">
    <header class="wk-board-h"><h2>${g ? g.name : ''} board</h2><p>${(b.tasks || []).length} ${(b.tasks || []).length === 1 ? 'task' : 'tasks'}</p></header>
    ${STAGES.map((s) => html`<section class="wk-col is-${s.key}" aria-label="${s.name}">
      <h3 class="wk-col-h">${s.name} <span class="mono">${by[s.key].length}</span></h3>
      ${by[s.key].length ? html`<div class="wk-col-list">${by[s.key].map((t) => taskView(t, ctx, ui))}</div>` : html`<p class="wk-col-empty">${s.empty}</p>`}
    </section>`)}
  </aside>`;
}

function composerView(g, ctx, ui) {
  if (!can(ctx.role, 'member')) return html`<p class="ch-readonly muted">You have view access: you can read this thread and its board, but not post or tap.</p>`;
  if (ui.rec) {
    return html`<div class="wk-rec" role="group" aria-label="Recording a voice note">
      <span class="wk-rec-t mono" id="wk-rec-t">${clock(ui.rec.ms || 0)}</span>
      <p class="wk-rec-tr" id="wk-rec-tr">${ui.rec.transcript || (ui.rec.listening ? 'Recording. Your words show here as you speak.' : 'Recording. This browser gives no live transcript.')}</p>
      <div class="wk-acts">
        <button class="wk-btn is-go" type="button" data-rec="send"${ui.rec.sending ? ' disabled' : ''}>${ui.rec.sending ? 'Sending' : 'Send voice note'}</button>
        <button class="wk-btn" type="button" data-rec="cancel"${ui.rec.sending ? ' disabled' : ''}>Cancel</button>
      </div>
    </div>`;
  }
  return html`<form class="ch-compose wk-compose" data-form="send">
    <label class="sr" for="ch-body">Message to ${g.name}</label>
    <textarea id="ch-body" name="body" rows="2" maxlength="2000" placeholder="Message ${g.name}. Ask for a piece of work and the agent plans it.">${ui.draft || ''}</textarea>
    <div class="wk-compose-b">
      ${ui.canRecord !== false ? html`<button class="wk-btn" type="button" data-rec="start" title="Record a voice note">Record</button>` : ''}
      <button class="wk-btn is-go" type="submit"${ui.sending ? ' disabled' : ''}>${ui.sending ? 'Sending' : 'Send'}</button>
    </div>
  </form>`;
}

// data = { groups, slug, group, messages, board: {tasks}, ui: { pane, editing, rejecting, sendingBack, busy, error, draft, now, rec, playing } }
export function view(data, ctx) {
  const ui = { now: Date.now(), ...(data?.ui || {}) };
  const groups = data?.groups || [];
  const slug = data?.slug || 'all-hands';
  const g = data?.group || groups.find((x) => x.slug === slug);
  const pane = ui.pane || 'thread';
  const top = html`<div class="wk-top"><h1 class="wk-h">Work ${sampleTag(ctx.ws)}</h1>
    <p class="wk-sub">Talk to each area by text or voice. Its agent turns asks into planned tasks and works them across the board. A person approves the plan, and someone else checks the work.</p></div>`;
  const threads = threadsView(groups, slug, ctx, data?.decisionsByGroup || {});

  if (!g) {
    return html`<section class="wk ch" data-pane="thread">${top}<div class="wk-grid">${threads}<div class="ch-thread wk-thread">
      ${ui.error ? html`<p class="err" role="alert">${ui.error}</p>` : html`<p class="loading">Loading</p>`}</div></div></section>`;
  }

  const messages = [...(data.messages || [])].sort((a, b) => a.ts - b.ts || a.id - b.id);
  const decisions = (data.decisions || []).filter((c) => c.group === g.slug);
  const timeline = [...messages.map((m) => ({ ts: m.ts, m })), ...decisions.map((c) => ({ ts: c.ts, c }))].sort((a, b) => a.ts - b.ts);
  const tools = (g.connectors || []).length
    ? html`<span class="ch-tools">${g.connectors.map((c) => html`<span class="ch-tool is-${c.status || 'not_connected'}" title="${c.status === 'connected' ? 'Connected' : 'Not connected'}">${c.name}</span>`)}</span>`
    : html`<span class="ch-tools muted">Reads the other groups' summaries, never a tool directly.</span>`;
  const people = (g.members || []).map((p) => p.name).filter(Boolean);
  const needs = (data.board?.tasks || []).filter((t) => t.needs_you).length;
  const decNeeds = decisions.filter((c) => c.needs_you).length;

  return html`<section class="wk ch" data-pane="${pane}">${top}
    <div class="wk-grid">${threads}
    <div class="wk-switch" role="tablist" aria-label="Show">
      <button type="button" role="tab" data-switch="thread" aria-selected="${pane === 'thread'}">Thread</button>
      <button type="button" role="tab" data-switch="board" aria-selected="${pane === 'board'}">Board${needs ? ` (${needs} for you)` : ''}</button>
    </div>
    <div class="ch-thread wk-thread">
      <header class="ch-head wk-head"><h2 class="ch-title">${g.name}</h2>
        <p class="ch-meta"><span>${g.agent}</span>${tools}</p>
        ${decNeeds ? html`<p class="ch-meta"><button class="wk-link" type="button" data-dc="jump">${decNeeds} ${decNeeds === 1 ? 'card needs' : 'cards need'} your tap in this thread</button></p>` : ''}
        ${people.length ? html`<p class="ch-meta muted">With ${people.join(', ')}</p>` : ''}
      </header>
      ${ui.error ? html`<p class="err ch-err" role="alert">${ui.error}</p>` : ''}
      ${timeline.length
        ? html`<ol class="ch-msgs" id="ch-msgs">${timeline.map((x) => (x.c ? decisionItem(x.c, ctx, ui) : messageView(x.m, ctx, ui)))}</ol>`
        : html`<p class="empty ch-msgs">No messages in ${g.name} yet.${can(ctx.role, 'member') ? ' Ask for a piece of work to start.' : ''}</p>`}
      ${composerView(g, ctx, ui)}
    </div>
    ${boardView({ ...data, group: g }, ctx, ui)}
    </div></section>`;
}

// ---- mount ------------------------------------------------------------------------------------------

export async function mount(root, ctx) {
  const slug = ctx.params[0] || 'all-hands';
  const canRecord = typeof window !== 'undefined' && !!window.MediaRecorder && !!navigator.mediaDevices?.getUserMedia;
  const s = { groups: [], slug, group: null, messages: [], board: null, decisions: [], decisionsByGroup: {},
    ui: { pane: 'thread', editing: null, rejecting: null, sendingBack: null, busy: null, error: '', draft: '', sending: false, rec: null, playing: null, playPos: 0, focus: null, canRecord,
      suggesting: null, dcBack: null, dcThread: null } };
  let dead = false, timer = null, stale = false, placed = false, readTo = 0, boardSig = '', dcSig = '';
  const D = `/w/${ctx.wid}/decisions`;
  const W = `/w/${ctx.wid}/chats`;
  const enc = encodeURIComponent(slug);

  const lastId = () => s.messages.reduce((n, m) => Math.max(n, m.id), 0);
  const holding = () => s.ui.editing != null || s.ui.rejecting != null || s.ui.sendingBack != null || s.ui.suggesting != null || s.ui.dcBack != null
    || (typeof document !== 'undefined' && !!document.activeElement?.closest?.('.dc-line') && !!document.activeElement.value);
  const dsig = (list) => (list || []).map((c) => `${c.id}:${c.version}:${c.status}:${c.tally.voted}:${c.comments.length}:${c.options.length}`).join(',');
  const sig = (b) => (b?.tasks || []).map((t) => `${t.id}:${t.version}`).join(',');
  const working = () => (s.board?.tasks || []).some((t) => t.working && t.next_at && t.next_at - Date.now() < 90_000);

  // after you send something, the thread follows it down even if you had scrolled up
  let stickUntil = 0;
  function paint() {
    if (dead) return;
    const box = root.querySelector('#ch-msgs');
    const atBottom = !box || box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    const boardTop = root.querySelector('.wk-board')?.scrollTop || 0;
    const ta = root.querySelector('#ch-body');
    if (ta) s.ui.draft = ta.value;
    const hadFocus = ta && document.activeElement === ta;
    // comment boxes on decision cards keep what you typed across a repaint
    const lines = {};
    root.querySelectorAll('.dc-line input').forEach((i) => { if (i.value) lines[i.id] = i.value; });
    const lineFocus = document.activeElement?.closest?.('.dc-line') ? document.activeElement.id : null;
    s.ui.now = Date.now();
    root.innerHTML = String(view(s, ctx));
    const nb = root.querySelector('#ch-msgs');
    if (nb && (atBottom || Date.now() < stickUntil)) nb.scrollTop = nb.scrollHeight;
    const bd = root.querySelector('.wk-board');
    if (bd) bd.scrollTop = boardTop;
    if (hadFocus) root.querySelector('#ch-body')?.focus();
    for (const [id, v] of Object.entries(lines)) { const i = root.querySelector(`#${id}`); if (i) i.value = v; }
    if (lineFocus) root.querySelector(`#${lineFocus}`)?.focus();
    if (!placed) { // on a phone the thread strip scrolls sideways: bring the open one into view once
      const cur = root.querySelector('.ch-group[aria-current="page"]');
      if (cur && s.groups.length) { cur.parentElement.scrollLeft = Math.max(0, cur.offsetLeft - cur.parentElement.offsetLeft - 16); placed = true; }
    }
    root.querySelector('[data-form="edit"] input, [data-form="reject"] input, [data-form="send-back"] input, [data-form="dc-suggest"] input, [data-form="dc-back"] input')?.focus();
    markRead();
  }

  async function markRead() {
    const last = lastId();
    if (!last || last <= readTo) return;
    readTo = last;
    try { await ctx.api('POST', `${W}/${enc}/read`, { last }); } catch { readTo = 0; /* the next paint tries again */ }
  }

  async function load() {
    const [g, t, b, d, ds] = await Promise.all([ctx.api('GET', W), ctx.api('GET', `${W}/${enc}`), ctx.api('GET', `${W}/work?group=${enc}`),
      ctx.api('GET', `${D}?group=${enc}`).catch(() => ({ cards: [] })), ctx.api('GET', `${D}/summary`).catch(() => ({ by_group: {} }))]);
    s.groups = g.groups; s.group = t.group; s.messages = t.messages; s.board = b; boardSig = sig(b);
    s.decisions = d.cards || []; s.decisionsByGroup = ds.by_group || {}; dcSig = dsig(s.decisions);
    // [standup] open cards that have a walkthrough get a link to it (worker src/modules/standup.js)
    if (s.decisions.some((c) => c.status === 'open')) {
      const v = await ctx.api('GET', `/w/${ctx.wid}/standup/videos`).catch(() => null);
      if (v) s.ui.videos = Object.fromEntries((v.videos || []).map((x) => { const n = Math.max(0, Math.round(x.seconds || 0)); return [x.card_id, n < 60 ? `${n} s` : `${Math.floor(n / 60)} min${n % 60 ? ` ${n % 60} s` : ''}`]; }));
    }
  }

  async function refresh() {
    try { await load(); s.ui.error = ''; } catch (e) { s.ui.error = e.message; }
    if (holding() || s.ui.rec) stale = true; else paint();
  }

  // reading the board is what lets the demo agent make its next move, so poll it, faster while it works
  async function poll() {
    if (dead || (typeof document !== 'undefined' && document.hidden)) return;
    try {
      const [b, r, d] = await Promise.all([ctx.api('GET', `${W}/work?group=${enc}`), ctx.api('GET', `${W}/${enc}?after=${lastId()}`), ctx.api('GET', `${D}?group=${enc}`).catch(() => null)]);
      if (dead) return;
      if (sig(b) !== boardSig || r.messages.length || (d && dsig(d.cards) !== dcSig)) await refresh();
    } catch { /* a missed poll is fine; the next one tries again */ }
  }
  function schedule() {
    clearTimeout(timer);
    if (dead) return;
    timer = setTimeout(async () => {
      if (stale && !holding() && !s.ui.rec) { stale = false; paint(); }
      await poll();
      schedule();
    }, working() ? LIVE_MS : POLL_MS);
  }

  async function act(fn, okMsg) {
    try { await fn(); s.ui.error = ''; if (okMsg) ctx.toast(typeof okMsg === 'function' ? okMsg() : okMsg); } catch (e) { s.ui.error = e.message; }
    s.ui.busy = null;
    await refresh();
    schedule();
  }

  // ---- voice: MediaRecorder, plus the browser's own speech recognition when it has one ----
  let rec = null;
  function stopTracks(r) { try { r?.stream?.getTracks().forEach((t) => t.stop()); } catch { /* */ } try { r?.sr?.stop(); } catch { /* */ } clearInterval(r?.tick); }
  async function recStart() {
    if (rec) return;
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch {
      s.ui.error = 'The microphone is blocked. Allow it for this site to send voice notes.'; return paint();
    }
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find((t) => window.MediaRecorder.isTypeSupported?.(t)) || '';
    const mr = new window.MediaRecorder(stream, type ? { mimeType: type } : undefined);
    rec = { mr, stream, chunks: [], start: Date.now(), transcript: '', final: '' };
    const r = rec;
    mr.ondataavailable = (e) => { if (e.data && e.data.size) r.chunks.push(e.data); };
    mr.start(250);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let listening = false;
    if (SR) {
      try {
        const sr = new SR();
        sr.continuous = true; sr.interimResults = true; sr.lang = navigator.language || 'en-IN';
        sr.onresult = (e) => {
          let interim = '';
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) r.final += e.results[i][0].transcript + ' ';
            else interim += e.results[i][0].transcript;
          }
          r.transcript = (r.final + interim).trim();
          const el = root.querySelector('#wk-rec-tr'); if (el && r.transcript) el.textContent = r.transcript;
        };
        sr.onerror = () => { /* the recording carries on without a transcript */ };
        sr.start(); r.sr = sr; listening = true;
      } catch { listening = false; }
    }
    s.ui.rec = { ms: 0, transcript: '', listening };
    r.tick = setInterval(() => {
      const ms = Date.now() - r.start;
      const el = root.querySelector('#wk-rec-t'); if (el) el.textContent = clock(ms);
      if (ms >= 120_000) recSend(); // two minutes is the cap
    }, 250);
    paint();
  }
  function recCancel() {
    if (!rec) return;
    try { if (rec.mr.state !== 'inactive') rec.mr.stop(); } catch { /* */ }
    stopTracks(rec); rec = null; s.ui.rec = null; paint();
  }
  async function recSend() {
    if (!rec || s.ui.rec?.sending) return;
    stickUntil = Date.now() + 6000;
    const r = rec;
    const ms = Date.now() - r.start;
    clearInterval(r.tick);
    s.ui.rec = { ...s.ui.rec, sending: true, ms, transcript: r.transcript }; paint();
    await new Promise((res) => { r.mr.onstop = res; try { r.mr.stop(); } catch { res(); } });
    stopTracks(r);
    const blob = new Blob(r.chunks, { type: (r.mr.mimeType || 'audio/webm').split(';')[0] });
    const fd = new FormData();
    fd.append('audio', blob, 'voice-note');
    fd.append('ms', String(ms));
    if (r.transcript) fd.append('transcript', r.transcript);
    rec = null;
    s.ui.rec = null;
    await act(async () => {
      const res = await fetch(`${apiBase()}${W}/${enc}/voice`, { method: 'POST', headers: { authorization: `Bearer ${token.get()}` }, body: fd });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || `Could not send the voice note (${res.status}).`);
    }, 'Voice note sent.');
  }

  // ---- playback: fetched with the session (an <audio src> cannot carry it), kept per note ----
  const audio = typeof Audio !== 'undefined' ? new Audio() : null;
  const urls = new Map();
  if (audio) {
    audio.ontimeupdate = () => {
      s.ui.playPos = audio.currentTime * 1000;
      const el = root.querySelector(`[data-vpos="${s.ui.playing}"]`);
      const m = s.messages.find((x) => x.voice?.id === s.ui.playing);
      if (el && m) el.textContent = `${clock(s.ui.playPos)} / ${clock(m.voice.duration_ms)}`;
    };
    audio.onended = () => { s.ui.playing = null; s.ui.playPos = 0; paint(); };
  }
  async function play(id) {
    if (!audio) return;
    if (s.ui.playing === id) { audio.pause(); s.ui.playing = null; return paint(); }
    try {
      if (!urls.has(id)) {
        const res = await fetch(`${apiBase()}${W}/voice/${id}`, { headers: { authorization: `Bearer ${token.get()}` } });
        if (!res.ok) throw new Error('Could not load that voice note.');
        urls.set(id, URL.createObjectURL(await res.blob()));
      }
      audio.src = urls.get(id); s.ui.playing = id; s.ui.playPos = 0; paint();
      await audio.play();
    } catch (e) { s.ui.playing = null; s.ui.error = e.message || 'This browser cannot play that voice note.'; paint(); }
  }

  const cardPath = (id, a) => `/w/${ctx.wid}/cards/${id}/${a}`;

  // one tap on a decision card: vote, decide, check; or open "Something else" / Send back
  function onDecision(b) {
    const id = Number(b.dataset.id), a = b.dataset.dc;
    if (a === 'cancel') { s.ui.suggesting = s.ui.dcBack = null; stale = false; return paint(); }
    if (a === 'suggest') { s.ui.suggesting = id; s.ui.dcBack = null; return paint(); }
    if (a === 'back') { s.ui.dcBack = id; s.ui.suggesting = null; return paint(); }
    if (a === 'thread') { s.ui.dcThread = s.ui.dcThread === id ? null : id; return paint(); }
    if (a === 'jump') { s.ui.pane = 'thread'; paint(); root.querySelector('.dc.is-you')?.scrollIntoView?.({ block: 'center' }); return; }
    if (b.disabled) return;
    s.ui.busy = `d${id}`; b.disabled = true;
    if (a === 'vote') {
      let msg = 'Vote counted.';
      act(async () => {
        const r = await ctx.api('POST', `${D}/${id}/vote`, { option_id: Number(b.dataset.opt) });
        if (r.card.status === 'resolved') msg = 'That settled it. The agent drafted the work for a check.';
      }, () => msg);
      return;
    }
    if (a === 'decide') { act(() => ctx.api('POST', `${D}/${id}/decide`, { option_id: Number(b.dataset.opt), version: Number(b.dataset.version) }), 'Decided. The agent is drafting the work.'); return; }
    if (a === 'check') { act(() => ctx.api('POST', `${D}/${id}/check`, { version: Number(b.dataset.version) }), 'Checked.'); return; }
    s.ui.busy = null;
  }

  const onClick = (e) => {
    const dc = e.target.closest('[data-dc]');
    if (dc) { onDecision(dc); return; }
    const sw = e.target.closest('[data-switch]');
    if (sw) { s.ui.pane = sw.dataset.switch; return paint(); }
    const rb = e.target.closest('[data-rec]');
    if (rb) { if (!rb.disabled) ({ start: recStart, send: recSend, cancel: recCancel })[rb.dataset.rec]?.(); return; }
    const pb = e.target.closest('[data-play]');
    if (pb) { play(Number(pb.dataset.play)); return; }
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const id = Number(b.dataset.id), a = b.dataset.act;
    if (a === 'cancel') { s.ui.editing = s.ui.rejecting = s.ui.sendingBack = null; stale = false; return paint(); }
    if (a === 'edit') { s.ui.editing = id; s.ui.rejecting = s.ui.sendingBack = null; return paint(); }
    if (a === 'reject') { s.ui.rejecting = id; s.ui.editing = s.ui.sendingBack = null; return paint(); }
    if (a === 'send-back') { s.ui.sendingBack = id; s.ui.editing = s.ui.rejecting = null; return paint(); }
    if (a === 'approve' || a === 'check') {
      s.ui.busy = id; b.disabled = true;
      act(() => ctx.api('POST', cardPath(id, a), { version: Number(b.dataset.version) }), a === 'check' ? 'Checked and approved.' : 'Approved.');
      return;
    }
    if (a === 'approve-plan' || a === 'check-work') {
      s.ui.busy = `t${id}`; b.disabled = true;
      act(() => ctx.api('POST', `${W}/work/${id}/${a === 'approve-plan' ? 'approve' : 'check'}`, { version: Number(b.dataset.version) }),
        a === 'approve-plan' ? 'Plan approved. The agent takes it from here.' : 'Checked.');
      return;
    }
    if (a === 'make-task') {
      s.ui.busy = `m${id}`; b.disabled = true;
      act(() => ctx.api('POST', `${W}/${enc}/messages/${id}/task`), 'The agent planned it. It is on the board.');
      return;
    }
    if (a === 'focus') {
      s.ui.focus = id; s.ui.pane = 'board'; paint();
      root.querySelector(`.wk-board [data-task="${id}"]`)?.scrollIntoView?.({ block: 'center' });
      setTimeout(() => { if (s.ui.focus === id) { s.ui.focus = null; root.querySelector(`.wk-board [data-task="${id}"]`)?.classList.remove('is-focus'); } }, 2400);
      return;
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
      s.ui.sending = true; stickUntil = Date.now() + 6000; paint();
      act(async () => { await ctx.api('POST', `${W}/${enc}/messages`, { body }); s.ui.draft = ''; const ta = root.querySelector('#ch-body'); if (ta) ta.value = ''; })
        .finally(() => { s.ui.sending = false; paint(); });
      return;
    }
    if (kind === 'dc-suggest') {
      const label = f.querySelector('[name="label"]').value.trim(), detail = f.querySelector('[name="detail"]').value.trim();
      if (!label) { s.ui.error = 'Write your option first.'; return paint(); }
      s.ui.suggesting = null; stale = false;
      act(() => ctx.api('POST', `${D}/${id}/suggest`, { label, detail }), 'Your option is on the card. Anyone can vote for it.');
      return;
    }
    if (kind === 'dc-comment') {
      const input = f.querySelector('[name="body"]'), body = input.value.trim();
      if (!body) return;
      input.value = '';
      act(() => ctx.api('POST', `${D}/${id}/comment`, { body }));
      return;
    }
    if (kind === 'dc-back') {
      const reason = f.querySelector('[name="reason"]').value.trim();
      if (!reason) { s.ui.error = 'Say what needs to change.'; return paint(); }
      s.ui.dcBack = null; stale = false;
      act(() => ctx.api('POST', `${D}/${id}/send-back`, { reason, version: Number(f.dataset.version) }), 'Sent back. The agent posted a revised draft.');
      return;
    }
    if (kind === 'send-back') {
      const reason = f.querySelector('[name="reason"]').value.trim();
      if (!reason) { s.ui.error = 'Say what needs to change.'; return paint(); }
      s.ui.sendingBack = null; stale = false;
      act(() => ctx.api('POST', `${W}/work/${id}/send-back`, { reason, version: Number(f.dataset.version) }), 'Sent back. The agent re-plans around your note.');
      return;
    }
    if (kind === 'edit') {
      const title = f.querySelector('[name="title"]').value.trim();
      const fields = [...f.querySelectorAll('input[data-label]')].map((i) => ({ label: i.dataset.label, value: i.value.trim() }));
      s.ui.editing = null; stale = false;
      act(() => ctx.api('POST', cardPath(id, 'edit'), { title, fields, version: Number(f.dataset.version) }), 'Card updated. Someone else approves it now.');
      return;
    }
    if (kind === 'reject') {
      const reason = f.querySelector('[name="reason"]').value.trim();
      if (!reason) { s.ui.error = 'Say why it is rejected.'; return paint(); }
      s.ui.rejecting = null; stale = false;
      act(() => ctx.api('POST', cardPath(id, 'reject'), { reason, version: Number(f.dataset.version) }), 'Rejected.');
    }
  };

  const onKey = (e) => {
    if (e.target.id === 'ch-body' && e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.target.form?.requestSubmit(); }
    if (e.key === 'Escape' && (holding() || s.ui.rec)) { if (s.ui.rec) recCancel(); else { s.ui.editing = s.ui.rejecting = s.ui.sendingBack = s.ui.suggesting = s.ui.dcBack = null; paint(); } }
  };

  root.addEventListener('click', onClick);
  root.addEventListener('submit', onSubmit);
  root.addEventListener('keydown', onKey);
  paint();
  try { await load(); } catch (e) { s.ui.error = e.message; }
  paint();
  schedule();

  return () => {
    dead = true;
    clearTimeout(timer);
    if (rec) { try { rec.mr.stop(); } catch { /* */ } stopTracks(rec); rec = null; }
    if (audio) { audio.pause(); audio.removeAttribute('src'); }
    urls.forEach((u) => URL.revokeObjectURL(u));
    root.removeEventListener('click', onClick);
    root.removeEventListener('submit', onSubmit);
    root.removeEventListener('keydown', onKey);
  };
}
