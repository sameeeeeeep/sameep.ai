// hiring.js: agent-run hiring. The agent finds the role, writes the JD, readies the post, screens, schedules,
// drafts the offer and onboarding; people decide at every gate. API: /d2c-api/w/:wid/hiring (worker docs/hiring.md).
// Routes: #/w/<wid>/hiring                     every open role
//         #/w/<wid>/hiring/<role>              one role: pipeline board, JD and post, drafts, interviews
//         #/w/<wid>/hiring/<role>/<candidate>  the same, with that candidate open
// view() is pure (string in, string out) so Node can test it; mount() fetches, renders and binds.
import { html, raw, sampleTag, day, ago } from '../js/ui.js';

export const title = 'Hiring';

const STATUS_LABEL = {
  need: 'Need found', jd_draft: 'JD drafted', jd_approved: 'JD approved', post_ready: 'Post ready', posted: 'Posted',
  screening: 'Screening', shortlisting: 'Shortlisting', interviewing: 'Interviewing', deciding: 'Final pick',
  offer: 'Offer', onboarding: 'Onboarding', filled: 'Filled', closed: 'Closed',
};
const STEPS = ['need', 'jd_draft', 'jd_approved', 'post_ready', 'posted', 'shortlisting', 'interviewing', 'deciding', 'offer', 'onboarding', 'filled'];
const WHO = { agent: 'Agent', person: 'You', founder: 'Founder' };
// board columns: candidate stages grouped the way a hiring manager thinks about them
export const COLUMNS = [
  { key: 'new', label: 'Applied', stages: ['applied', 'screened_in'] },
  { key: 'short', label: 'Shortlisted', stages: ['shortlisted'] },
  { key: 'iv', label: 'Interviews', stages: ['interview'] },
  { key: 'final', label: 'Finalists', stages: ['scored', 'picked'] },
  { key: 'offer', label: 'Offer', stages: ['offer', 'accepted'] },
  { key: 'joined', label: 'Joining', stages: ['onboarding', 'hired'] },
];
const OUT = ['screened_out', 'dropped', 'declined', 'rejected', 'duplicate'];
const OUT_LABEL = { screened_out: 'Not a fit', dropped: 'Dropped out', declined: 'Declined', rejected: 'Closed', duplicate: 'Duplicate' };
const KIND = { linkedin_post: 'LinkedIn post', invite_email: 'Interview invite', reject_email: 'Rejection email', offer_letter: 'Offer letter', intro_post: 'Intro post' };
const lakh = (n) => (n == null ? '' : `₹${(n / 100000).toFixed(n % 100000 ? 1 : 0)} lakh`);
const band = (r) => (r.band_min && r.band_max ? `${lakh(r.band_min)} to ${lakh(r.band_max)}` : 'No band set');
const name = (names, email) => (names && names[email]) || String(email || '').split('@')[0].replace(/^./, (c) => c.toUpperCase());
const href = (wid, ...p) => '#/' + ['w', wid, 'hiring', ...p].map(encodeURIComponent).join('/');
const decides = (lv) => lv === 'founder' || lv === 'hiring';

function waitingTag(w) {
  if (!w || !w.who) return html`<span class="hr-wait is-done">${w ? w.what : ''}</span>`;
  return html`<span class="hr-wait is-${w.who}"><b>${WHO[w.who]}</b> ${w.what}</span>`;
}

function steps(status) {
  const i = STEPS.indexOf(status === 'screening' ? 'posted' : status);
  return html`<ol class="hr-steps" aria-label="Where this role is">${STEPS.map((s, k) => html`<li class="${k < i ? 'is-done' : k === i ? 'is-now' : ''}"${k === i ? raw(' aria-current="step"') : ''}><span>${STATUS_LABEL[s]}</span></li>`)}</ol>`;
}

// ------------------------------------------------------------------ list of roles

function listView(d, ctx) {
  const roles = d.roles || [];
  return html`<section class="pg hr">
    <div class="pg-top"><div>
      <h1 class="pg-h">Hiring ${sampleTag(ctx.ws)}</h1>
      <p class="pg-sub">The agent finds the roles you need from meetings, chats and email, writes the JD, screens applicants and drafts every message. You approve, pick and send.</p>
    </div></div>
    ${d.error ? html`<p class="err" role="alert">${d.error}</p>` : ''}
    ${roles.length ? html`<div class="hr-roles">${roles.map((r) => {
      const live = ['applied', 'screened_in', 'shortlisted', 'interview', 'scored', 'picked', 'offer', 'accepted', 'onboarding'].reduce((s, k) => s + (r.stages[k] || 0), 0);
      return html`<a class="card hr-role" href="${href(ctx.wid, r.id)}">
        <div class="hr-role-top"><b class="hr-role-t">${r.title}</b><span class="pill-s">${STATUS_LABEL[r.status] || r.status}</span></div>
        <p class="hr-src">${r.found_by === 'agent' ? 'Found by the agent' : 'Opened by ' + name(null, r.found_by)}${r.source ? html` in ${r.source}` : ''}</p>
        <p class="hr-reason">${r.reason}</p>
        <div class="hr-role-foot">${waitingTag(r.waiting)}<span class="muted">${live} in play</span></div>
      </a>`;
    })}</div>` : html`<div class="card empty">No roles yet. When the agent spots a gap in a meeting, a group chat or an email, the role shows up here with its reasons.</div>`}
  </section>`;
}

// ------------------------------------------------------------------ one role

function gateBar(d) {
  const r = d.role, lv = d.my_level, busy = d.busy ? raw(' disabled') : '';
  const out = [];
  const agentTurn = r.waiting && r.waiting.who === 'agent';
  if (agentTurn && lv) out.push(html`<button class="btn is-primary" type="button" data-act="agent"${busy}>Let the agent do it</button>`);
  if (decides(lv)) {
    if (r.status === 'jd_draft') out.push(html`<button class="btn is-primary" type="button" data-act="approve-jd"${busy}>Approve the JD</button>`);
    if (r.status === 'post_ready') out.push(html`<button class="btn is-primary" type="button" data-act="posted"${busy}>I posted it on LinkedIn</button>`);
  }
  if (r.status === 'offer' && !r.offer_approved_by && lv === 'founder') {
    out.push(html`<button class="btn is-primary" type="button" data-act="approve-offer"${busy}>${r.offer && r.offer.above_band ? 'Approve, above the band' : 'Approve the offer'}</button>`);
  }
  if (!out.length && r.waiting && r.waiting.who === 'founder' && lv !== 'founder') out.push(html`<span class="muted">Only a founder can approve this offer.</span>`);
  if (!lv) out.push(html`<span class="muted">You can follow this role. Its hiring people decide.</span>`);
  return out;
}

function candCard(c, d, ctx) {
  const open = d.open === c.id;
  return html`<a class="hr-c${open ? ' is-open' : ''}${c.note ? ' has-note' : ''}" href="${href(ctx.wid, d.role.id, c.id)}"${open ? raw(' aria-current="true"') : ''}>
    <span class="hr-c-n">${c.name}</span>
    <span class="hr-c-m">${c.current_title}${c.years != null ? html` · ${c.years} yrs` : ''}</span>
    <span class="hr-c-s">${c.score != null ? html`Interview ${c.score}/5` : c.screen_score != null ? html`Screen ${c.screen_score}` : 'Not screened'}${d.role.proposed_pick === c.id ? html` · <b>Recommended</b>` : ''}${d.role.picked === c.id ? html` · <b>Picked</b>` : ''}</span>
  </a>`;
}

function board(d, ctx) {
  const cs = d.candidates || [];
  const out = cs.filter((c) => OUT.includes(c.stage));
  return html`<div class="hr-board" role="list">${COLUMNS.map((col) => {
    const list = cs.filter((c) => col.stages.includes(c.stage)).sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || (b.screen_score ?? 0) - (a.screen_score ?? 0));
    return html`<div class="hr-col" role="listitem"><div class="hr-col-h"><span>${col.label}</span><span class="tab-n">${list.length}</span></div>
      ${list.length ? list.map((c) => candCard(c, d, ctx)) : html`<p class="hr-none">None</p>`}</div>`;
  })}</div>
  ${out.length ? html`<details class="hr-out"><summary>${out.length} out of the running</summary><ul>${out.map((c) => html`<li><a href="${href(ctx.wid, d.role.id, c.id)}">${c.name}</a> <span class="muted">${OUT_LABEL[c.stage]}${c.note ? html`: ${c.note}` : ''}</span></li>`)}</ul></details>` : ''}`;
}

function candPanel(d, ctx) {
  const c = (d.candidates || []).find((x) => x.id === d.open);
  if (!c) return '';
  const lv = d.my_level, busy = d.busy ? raw(' disabled') : '';
  const ivs = (d.interviews || []).filter((i) => i.candidate_id === c.id && i.status !== 'cancelled');
  const confirmed = ivs.find((i) => i.status === 'confirmed');
  const acts = [];
  if (decides(lv)) {
    if (['screened_in', 'screened_out'].includes(c.stage) && ['screening', 'shortlisting', 'interviewing'].includes(d.role.status)) acts.push(html`<button class="btn is-small is-primary" type="button" data-act="shortlist" data-id="${c.id}"${busy}>Shortlist</button>`);
    if (c.stage === 'scored' && d.role.status === 'deciding') acts.push(html`<button class="btn is-small is-primary" type="button" data-act="pick" data-id="${c.id}"${busy}>Make the offer to ${c.name.split(' ')[0]}</button>`);
    if (c.stage === 'offer' && d.role.offer_approved_by) {
      acts.push(html`<button class="btn is-small is-primary" type="button" data-act="answer" data-yes="1" data-id="${c.id}"${busy}>Accepted</button>`);
      acts.push(html`<button class="btn is-small" type="button" data-act="answer" data-yes="0" data-id="${c.id}"${busy}>Declined</button>`);
    }
    if (['screened_in', 'shortlisted', 'interview', 'scored', 'picked', 'offer'].includes(c.stage)) acts.push(html`<button class="btn is-small" type="button" data-act="drop" data-id="${c.id}"${busy}>Dropped out</button>`);
  }
  return html`<aside class="card hr-cand" aria-label="Candidate">
    <div class="hr-cand-top"><div><h2 class="hr-cand-n">${c.name}</h2><p class="muted">${c.current_title}${c.years != null ? html` · ${c.years} years` : ''}${c.pii && c.location ? html` · ${c.location}` : ''}</p></div>
      <a class="btn is-small" href="${href(ctx.wid, d.role.id)}" aria-label="Close">Close</a></div>
    ${c.pii ? html`<dl class="hr-dl">
      <div><dt>Email</dt><dd>${c.email || 'None given'}</dd></div><div><dt>Phone</dt><dd>${c.phone || 'None given'}</dd></div>
      <div><dt>Expects</dt><dd>${c.expected_ctc != null ? lakh(c.expected_ctc) + ' a year' : 'Not said'}</dd></div><div><dt>Source</dt><dd>${c.source}</dd></div>
    </dl>${c.summary ? html`<p class="hr-sum">${c.summary}</p>` : ''}` : html`<p class="muted">Contact details, pay and the resume are only shown to this role's hiring people and the founders.</p>`}
    ${c.screen_score != null ? html`<div class="hr-screen"><p class="hr-k">Agent's screen: ${c.screen_score} out of 100</p><ul>${c.screen_reasons.map((x) => html`<li>${x}</li>`)}</ul></div>` : ''}
    ${c.note ? html`<p class="hr-note">${c.note}</p>` : ''}
    ${ivs.length ? html`<div class="hr-ivs">${ivs.map((i) => html`<p><b>${i.round}</b> ${day(i.starts_at)} with ${name(d.names, i.interviewer)}: <span class="pill-s">${i.status}</span>${i.scorecard && i.scorecard.recommendation ? html` ${i.scorecard.recommendation.replace('_', ' ')}` : ''}${i.scorecard && i.scorecard.notes ? html`<span class="hr-sub">${i.scorecard.notes}</span>` : ''}</p>`)}</div>` : ''}
    ${confirmed && (decides(lv) || confirmed.interviewer === (ctx.me && ctx.me.user && ctx.me.user.email)) ? html`<form class="hr-score" data-id="${c.id}">
      <p class="hr-k">Scorecard</p>
      ${(d.role.must_haves || []).slice(0, 4).map((m) => html`<label class="field hr-scale"><span>${m}</span><select name="s:${m}"><option value="">-</option>${[1, 2, 3, 4, 5].map((n) => html`<option>${n}</option>`)}</select></label>`)}
      <label class="field"><span>Recommendation</span><select name="recommendation" required><option value="">Choose</option><option value="strong_yes">Strong yes</option><option value="yes">Yes</option><option value="no">No</option><option value="strong_no">Strong no</option></select></label>
      <label class="field"><span>Notes</span><textarea name="notes" maxlength="1200"></textarea></label>
      <button class="btn is-small is-primary" type="submit"${busy}>Send scorecard</button>
    </form>` : ''}
    ${d.dropping === c.id ? html`<form class="hr-drop" data-id="${c.id}"><label class="field"><span>What happened</span><input name="reason" maxlength="200" placeholder="Took another offer" required></label><button class="btn is-small is-primary" type="submit"${busy}>Mark dropped out</button><button class="btn is-small" type="button" data-act="cancel-drop">Cancel</button></form>`
      : acts.length ? html`<div class="hr-acts">${acts}</div>` : ''}
  </aside>`;
}

function jdPanel(d) {
  const r = d.role;
  const post = (d.drafts || []).filter((x) => x.kind === 'linkedin_post').pop();
  const t = d.jdTab === 'post' && post ? 'post' : 'jd';
  if (!r.jd && !post) return '';
  return html`<section class="card hr-jd" aria-label="Job description and post">
    <div class="tabs hr-tabs" role="tablist"><button type="button" role="tab" data-jdtab="jd" aria-selected="${t === 'jd'}">Job description</button>${post ? html`<button type="button" role="tab" data-jdtab="post" aria-selected="${t === 'post'}">LinkedIn post</button>` : ''}</div>
    ${t === 'jd' ? html`<pre class="hr-doc">${r.jd || 'Not written yet.'}</pre><p class="muted hr-by">${r.jd_approved_by ? html`Approved by ${name(d.names, r.jd_approved_by)}` : 'Drafted by the agent, waiting for approval'}</p>`
      : html`<div class="hr-post"><p class="hr-post-h">${post.subject}</p><pre class="hr-doc">${post.body}</pre></div><p class="muted hr-by">${post.status === 'sent' ? html`Posted by ${name(d.names, post.sent_by)} ${ago(post.sent_at)}` : 'Drafted by the agent. It goes up only when a person posts it.'}</p>`}
  </section>`;
}

function draftsPanel(d) {
  const ds = (d.drafts || []).filter((x) => x.kind !== 'linkedin_post' && x.status !== 'discarded');
  if (!ds.length) return '';
  const lv = d.my_level, busy = d.busy ? raw(' disabled') : '';
  return html`<section class="card hr-drafts" aria-label="Messages waiting">
    <p class="hr-k">Outbound, all drafts until a person sends them</p>
    <ul>${ds.map((x) => html`<li><div><b>${KIND[x.kind]}</b> <span class="pill-s is-${x.status === 'sent' ? 'approved' : x.status === 'approved' ? 'awaiting_check' : 'draft'}">${x.status}</span>
        ${x.body ? html`<details><summary>${x.subject}</summary><pre class="hr-doc">${x.body}</pre></details>` : html`<span class="muted"> Only the hiring people can read this.</span>`}</div>
      ${decides(lv) ? html`<div class="hr-dacts">${x.status === 'draft' && x.kind !== 'offer_letter' ? html`<button class="btn is-small" type="button" data-act="draft-approve" data-id="${x.id}"${busy}>Approve</button>` : ''}${x.status === 'approved' ? html`<button class="btn is-small" type="button" data-act="draft-sent" data-id="${x.id}"${busy}>I sent it</button>` : ''}${x.status !== 'sent' ? html`<button class="btn is-small" type="button" data-act="draft-discard" data-id="${x.id}"${busy}>Discard</button>` : ''}</div>` : ''}
    </li>`)}</ul>
  </section>`;
}

function interviewsPanel(d) {
  const iv = (d.interviews || []).filter((i) => i.status === 'drafted');
  if (!iv.length) return '';
  const busy = d.busy ? raw(' disabled') : '';
  return html`<section class="card hr-drafts" aria-label="Interview slots to confirm">
    <p class="hr-k">Interview slots the agent drafted</p>
    <ul>${iv.map((i) => html`<li><div><b>${i.candidate}</b> <span class="muted">${i.round}, ${day(i.starts_at)}, with ${name(d.names, i.interviewer)}</span></div>
      ${decides(d.my_level) ? html`<div class="hr-dacts"><button class="btn is-small is-primary" type="button" data-act="confirm-iv" data-id="${i.id}"${busy}>Confirm slot and invite</button></div>` : ''}</li>`)}</ul>
  </section>`;
}

function onboardingPanel(d, ctx) {
  const ob = d.onboarding || [];
  if (!ob.length) return '';
  const busy = d.busy ? raw(' disabled') : '';
  const me = ctx.me && ctx.me.user && ctx.me.user.email;
  return html`<section class="card hr-drafts" aria-label="Onboarding">
    <p class="hr-k">Onboarding checklist</p>
    <ul>${ob.map((o) => html`<li><div><b>${o.item}</b><span class="hr-sub muted">${o.detail}</span></div>
      <div class="hr-dacts">${o.done_at ? html`<span class="pill-s is-approved">done by ${name(d.names, o.done_by)}</span>` : (decides(d.my_level) || o.owner === me) ? html`<button class="btn is-small" type="button" data-act="onboard" data-id="${o.id}"${busy}>Done</button>` : html`<span class="muted">${name(d.names, o.owner)}</span>`}</div></li>`)}</ul>
  </section>`;
}

function roleView(d, ctx) {
  const r = d.role;
  return html`<section class="pg hr">
    <p class="hr-back"><a href="${href(ctx.wid)}">All roles</a></p>
    <div class="pg-top"><div>
      <h1 class="pg-h">${r.title} ${sampleTag(ctx.ws)}</h1>
      <p class="pg-sub">${r.found_by === 'agent' ? 'Found by the agent' : 'Opened by ' + name(d.names, r.found_by)}${r.source ? html` in ${r.source}` : ''}. ${r.reason}</p>
      <p class="hr-meta muted">${band(r)}${r.location ? html` · ${r.location}` : ''}${r.hiring_manager ? html` · Hiring manager ${name(d.names, r.hiring_manager)}` : ''}</p>
    </div></div>
    ${steps(r.status)}
    <div class="hr-gate card">${waitingTag(r.waiting)}<div class="hr-gate-acts">${gateBar(d)}</div></div>
    ${d.flash ? html`<p class="hr-flash" role="status">${d.flash}</p>` : ''}
    ${d.error ? html`<p class="err" role="alert">${d.error}</p>` : ''}
    <div class="hr-main${d.open ? ' has-open' : ''}">
      <div class="hr-left">${board(d, ctx)}${interviewsPanel(d)}${onboardingPanel(d, ctx)}${d.open ? '' : jdPanel(d)}${draftsPanel(d)}</div>
      ${d.open ? html`<div class="hr-right">${candPanel(d, ctx)}</div>` : ''}
    </div>
  </section>`;
}

export function view(d, ctx) {
  return d.role ? roleView(d, ctx) : listView(d, ctx);
}

// ------------------------------------------------------------------ mount

export async function mount(root, ctx) {
  if (typeof document !== 'undefined' && !document.querySelector('link[data-page="hiring"]')) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./hiring.css', import.meta.url).href; l.dataset.page = 'hiring';
    document.head.appendChild(l);
  }
  const base = `/w/${ctx.wid}/hiring`;
  const roleId = Number(ctx.params && ctx.params[0]) || null;
  const openId = Number(ctx.params && ctx.params[1]) || null;
  let s = { busy: false, error: '', flash: '', jdTab: 'jd', dropping: null };

  async function load() {
    if (!roleId) { const d = await ctx.api('GET', base); s = { ...s, ...d, role: null }; return; }
    const d = await ctx.api('GET', `${base}/roles/${roleId}`);
    s = { ...s, ...d, open: openId };
  }
  const paint = () => {
    root.innerHTML = String(view(s, ctx));
    const now = root.querySelector('.hr-steps .is-now'); // phones: keep the current step in view
    if (now && now.parentElement.scrollWidth > now.parentElement.clientWidth) now.parentElement.scrollLeft = now.offsetLeft - 16;
  };
  try { await load(); } catch (e) { s.error = e.message; if (roleId) s.role = null; }
  paint();

  async function run(fn, flashFrom) {
    s.busy = true; s.error = ''; s.flash = ''; paint();
    try {
      const out = await fn();
      if (out && out.role) { s = { ...s, ...out, open: s.open }; }
      if (out && flashFrom) s.flash = flashFrom(out) || '';
    } catch (e) { s.error = e.message; }
    s.busy = false; s.dropping = null; paint();
  }
  const R = () => `${base}/roles/${roleId}`;

  const onClick = (e) => {
    const t = e.target.closest('[data-act],[data-jdtab]');
    if (!t) return;
    if (t.dataset.jdtab) { s.jdTab = t.dataset.jdtab; paint(); return; }
    const id = t.dataset.id;
    const a = t.dataset.act;
    if (a === 'agent') run(() => ctx.api('POST', `${R()}/agent`), (o) => o.did || (o.waiting && o.waiting.what));
    if (a === 'approve-jd') run(() => ctx.api('POST', `${R()}/approve-jd`), () => 'JD approved. The agent drafts the LinkedIn post next.');
    if (a === 'posted') run(() => ctx.api('POST', `${R()}/posted`), () => 'Marked posted. The agent screens applicants as they arrive.');
    if (a === 'approve-offer') {
      const above = s.role.offer && s.role.offer.above_band;
      if (above && !confirm('This offer is above the band. Approve it anyway?')) return;
      run(() => ctx.api('POST', `${R()}/offer/approve`, above ? { above_band: true } : {}), () => 'Offer approved. Send the letter, then record the answer.');
    }
    if (a === 'shortlist') run(() => ctx.api('POST', `${R()}/candidates/${id}/shortlist`), () => 'Shortlisted. Let the agent draft the interview invite.');
    if (a === 'pick') run(() => ctx.api('POST', `${R()}/candidates/${id}/pick`), (o) => o.escalated || 'Picked. The offer goes to a founder for approval.');
    if (a === 'answer') run(() => ctx.api('POST', `${R()}/candidates/${id}/answer`, { accepted: t.dataset.yes === '1' }), (o) => (o.role.status === 'onboarding' ? 'Accepted. The onboarding checklist is ready.' : 'Declined. The agent recommends the next best finalist.'));
    if (a === 'drop') { s.dropping = Number(id); paint(); return; }
    if (a === 'cancel-drop') { s.dropping = null; paint(); return; }
    if (a === 'confirm-iv') run(() => ctx.api('POST', `${base}/interviews/${id}/confirm`), () => 'Slot confirmed. The invite is approved; send it from your calendar.');
    if (a === 'draft-approve') run(() => ctx.api('POST', `${base}/drafts/${id}/approve`), () => 'Approved. Send it, then mark it sent.');
    if (a === 'draft-sent') run(() => ctx.api('POST', `${base}/drafts/${id}/sent`), () => 'Marked as sent by you.');
    if (a === 'draft-discard') run(() => ctx.api('POST', `${base}/drafts/${id}/discard`), () => 'Discarded.');
    if (a === 'onboard') run(() => ctx.api('POST', `${base}/onboarding/${id}/done`), () => 'Ticked off.');
  };
  const onSubmit = (e) => {
    const f = e.target;
    if (f.classList.contains('hr-drop')) {
      e.preventDefault();
      run(() => ctx.api('POST', `${R()}/candidates/${f.dataset.id}/drop`, { reason: f.reason.value }), (o) => (o.promoted ? 'Marked dropped out. The agent moved the next best candidate up.' : 'Marked dropped out.'));
    }
    if (f.classList.contains('hr-score')) {
      e.preventDefault();
      const scores = {};
      for (const el of f.elements) if (el.name && el.name.startsWith('s:') && el.value) scores[el.name.slice(2)] = Number(el.value);
      run(() => ctx.api('POST', `${R()}/candidates/${f.dataset.id}/scorecard`, { scores, recommendation: f.recommendation.value, notes: f.notes.value }), () => 'Scorecard sent.');
    }
  };
  root.addEventListener('click', onClick);
  root.addEventListener('submit', onSubmit);
  return () => { root.removeEventListener('click', onClick); root.removeEventListener('submit', onSubmit); };
}
