// steps.js: the human step, the last mile of every task. The agent takes the work as far as it can, then leaves the
// part only a person can do with the smallest interface for it. Seven kinds:
//   paste    a secure paste box straight into a connector (the value is never shown again)
//   review   the draft side by side with inline comments; approve or send back
//   record   voice or video with the script on screen (MediaRecorder), uploaded with a byte cap
//   upload   a camera photo, then the agent's read-back to confirm line by line
//   signoff  a prepared checklist
//   call     a ready call script: who, why, talking points, likely objections, the number, a box for the outcome
//   send     a prepared message; nothing goes out until the tap
// API: /d2c-api/w/:wid/steps (d2c-clone-app src/modules/steps.js).
//
// Pages use the pure views (stepList, stepsSection, waitingOnMe) and render rows carrying data-step-open="<id>".
// Importing this module in a browser binds one click handler on the document that opens the step in a sheet, so
// a page needs no wiring of its own. When a step changed, closing the sheet re-runs the route so lists refresh.
import { html, raw, ago, day } from './ui.js';
import { api, apiBase, token } from './api.js';

export const KIND = { paste: 'Paste', review: 'Review', record: 'Record', upload: 'Photo', signoff: 'Sign-off', call: 'Call', send: 'Send' };
const VERB = { paste: 'Paste the key', review: 'Review the draft', record: 'Record it', upload: 'Take the photo', signoff: 'Go through the list', call: 'Open the call script', send: 'Read and send' };
const STATUS = { waiting: 'Waiting', awaiting_check: 'Needs a check', done: 'Done', sent_back: 'Sent back', cancelled: 'Cancelled' };
const OUTCOMES = [['reached', 'Reached, agreed'], ['refused', 'Reached, did not agree'], ['call_back', 'Asked to call back'], ['no_answer', 'No answer'], ['wrong_number', 'Wrong number']];
const ACTION = {
  create: 'drafted the step', 'paste.try': 'tried a key', paste: 'stored the key', comment: 'commented', approve: 'approved', send_back: 'sent it back',
  record: 'recorded a take', photo: 'sent the photo', confirm: 'confirmed the read-back', signoff: 'signed off', 'call.attempt': 'logged a call',
  call: 'logged the call', send: 'tapped Send', check: 'checked it', cancel: 'cancelled it',
};
const CAP = { video: 12_000_000, audio: 4_000_000, image: 6_000_000 };

// ---- pure views (Node tests import these) ----------------------------------------------------------------------

// steps that wait on this person: theirs to do, or theirs to check
export const waitingOnMe = (steps) => (steps || []).filter((s) => s.can && (s.can.act || s.can.check));

export function due(s, now = Date.now()) {
  if (!s.due_ts) return '';
  const d = s.due_ts - now, h = Math.round(Math.abs(d) / 3_600_000);
  if (d < 0) return h < 48 ? `${h} h overdue` : `${Math.round(h / 24)} days overdue`;
  return h < 24 ? `due in ${Math.max(1, h)} h` : `due ${day(s.due_ts)}`;
}

export function stepRow(s) {
  return html`<li><button class="st-row${s.overdue ? ' is-late' : ''}" type="button" data-step-open="${s.id}">
    <span class="st-kind is-${s.kind}">${KIND[s.kind] || s.kind}</span>
    <span class="st-row-main"><span class="st-row-t">${s.title}</span>
      <span class="st-row-m">${s.status === 'awaiting_check' ? 'Needs your check' : VERB[s.kind]} · ${s.attach && s.attach.title}</span></span>
    <span class="st-row-d mono${s.overdue ? ' is-late' : ''}">${due(s)}</span>
  </button></li>`;
}

// a compact list for Today's Needs you
export function stepList(steps, { max = 0, moreHref = '' } = {}) {
  const list = steps || [];
  if (!list.length) return '';
  const shown = max ? list.slice(0, max) : list;
  const more = list.length - shown.length;
  return html`<div class="st-block"><p class="st-block-h">Your part <span class="tab-n">${list.length}</span></p>
    <ul class="st-list">${shown.map(stepRow)}</ul>
    ${more > 0 && moreHref ? html`<p class="td-more"><a class="linkish" href="${moreHref}">${more} more</a></p>` : ''}</div>`;
}

// the Inbox section: what waits on you first, then everyone else's open steps
export function stepsSection(steps, ctx) {
  const all = steps || [];
  const mine = waitingOnMe(all);
  const rest = all.filter((s) => !mine.includes(s) && ['waiting', 'awaiting_check'].includes(s.status));
  return html`<section class="ib-sec st-sec">
    <h2 class="sec-h">Your part <span class="tab-n">${mine.length}</span></h2>
    <p class="pg-sub ib-sub">The agent took these as far as it could. What is left needs a person: a key, a review, your voice, a photo, a call or a tap to send.</p>
    ${mine.length ? html`<ul class="st-list">${mine.map(stepRow)}</ul>` : html`<p class="empty">Nothing is waiting on you.</p>`}
    ${rest.length ? html`<details class="st-rest"><summary>${rest.length} more with the team</summary>
      <ul class="st-list">${rest.map((s) => html`${stepRow(s)}`)}</ul></details>` : ''}
    ${ctx && ctx.role === 'viewer' ? html`<p class="note">You can open and read every step. A member does them.</p>` : ''}
  </section>`;
}

const who = (p) => (p ? p.name : 'nobody');
const btn = (act, label, { primary = false, busy = false, extra = '' } = {}) =>
  html`<button class="btn is-small${primary ? ' is-primary' : ''}" type="button" data-st="${act}"${busy ? raw(' disabled') : ''}${raw(extra)}>${label}</button>`;

function head(s) {
  return html`<header class="st-head">
    <div class="st-head-l"><span class="st-kind is-${s.kind}">${KIND[s.kind]}</span><span class="st-status is-${s.status}">${STATUS[s.status]}</span>
      ${s.overdue ? html`<span class="st-row-d mono is-late">${due(s)}</span>` : s.due_ts && ['waiting', 'awaiting_check'].includes(s.status) ? html`<span class="st-row-d mono">${due(s)}</span>` : ''}</div>
    <button class="st-x" type="button" data-st="close" aria-label="Close">Close</button>
  </header>
  <h2 class="st-title" id="st-title">${s.title}</h2>
  <div class="st-why"><span class="st-mark" aria-hidden="true">C</span><p><b>${s.agent}</b> ${s.why}</p></div>
  <p class="st-meta">On ${s.attach.label.toLowerCase()}: <b>${s.attach.title}</b> · ${s.waiting_on}${s.checker && s.status === 'waiting' ? html` · ${who(s.checker)} checks it` : ''}</p>`;
}

function readOnlyNote(s) {
  if (s.status !== 'waiting' || s.can.act) return '';
  if (s.kind === 'paste') return html`<p class="note">Only an admin or the owner can put a key into a connector. It is on ${who(s.assignee)}.</p>`;
  return html`<p class="note">This one is on ${who(s.assignee)}. You can read it; an admin can take it over.</p>`;
}

// ---- per kind ----
function pasteBody(s, ui) {
  const p = s.payload;
  const r = s.result || {};
  if (s.status === 'done') return html`<div class="st-done"><p><b>${r.stored ? 'Key stored.' : 'Key checked.'}</b> ${r.note}</p><p class="mono muted">Fingerprint ${r.fp}</p></div>`;
  return html`<div class="st-two">
    <div><h3 class="st-h">Where to find it</h3><ol class="st-ol">${(p.where || []).map((w) => html`<li>${w}</li>`)}</ol></div>
    <div>${s.on_file ? html`<p class="st-onfile">A key is already on file (fingerprint <span class="mono">${s.on_file.fp}</span>, from ${s.on_file.set_by}, ${ago(s.on_file.ts)}). A new one replaces it.</p>` : ''}
      ${s.can.act ? html`<form class="st-form" data-form="paste" autocomplete="off">
        <label class="field"><span>${p.label}</span>
          <input name="value" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="512" required placeholder="Paste it here"></label>
        <p class="st-fine">${p.hint} It goes straight into the connector, encrypted. Nobody sees it again, here or anywhere.</p>
        <button class="btn is-primary" type="submit"${ui.busy ? raw(' disabled') : ''}>Store the key</button>
      </form>` : readOnlyNote(s)}</div></div>`;
}

function reviewBody(s, ui) {
  const p = s.payload, cm = s.comments || [];
  const at = (i) => cm.filter((c) => c.anchor === i);
  const open = s.status === 'waiting';
  const sel = ui.sel;
  return html`<div class="st-review">
    <article class="st-doc"><p class="st-doc-t">${p.doc_title}</p>
      ${p.draft.map((para, i) => html`<div class="st-para${sel === i ? ' is-sel' : ''}${at(i).length ? ' has-c' : ''}">
        ${s.can.comment ? html`<button type="button" class="st-para-b" data-st="sel" data-i="${i}" aria-label="Comment on paragraph ${i + 1}">${para}</button>` : html`<p>${para}</p>`}
        ${at(i).length ? html`<span class="st-para-n mono" aria-label="${at(i).length} comments">${at(i).length}</span>` : ''}</div>`)}
    </article>
    <aside class="st-side">
      ${s.can.comment ? (sel === null || sel === undefined
        ? html`<p class="st-fine">Tap a paragraph to comment on it.</p>`
        : html`<form class="st-form" data-form="comment"><p class="st-quote">${String(p.draft[sel] || '').slice(0, 90)}${String(p.draft[sel] || '').length > 90 ? '...' : ''}</p>
          <label class="field"><span>Your comment</span><textarea name="body" maxlength="600" required rows="3"></textarea></label>
          <div class="st-acts"><button class="btn is-small is-primary" type="submit"${ui.busy ? raw(' disabled') : ''}>Comment</button>${btn('unsel', 'Cancel')}</div></form>`) : ''}
      <h3 class="st-h">Comments <span class="tab-n">${cm.length}</span></h3>
      ${cm.length ? html`<ul class="st-comments">${cm.map((c) => html`<li><p class="st-c-q mono">Paragraph ${c.anchor + 1}</p><p>${c.body}</p><p class="st-c-by">${c.by_name}, ${ago(c.ts)}</p></li>`)}</ul>` : html`<p class="muted st-fine">No comments yet.</p>`}
      ${(p.used || []).length ? html`<h3 class="st-h">What the agent used</h3><ul class="st-ul">${p.used.map((u) => html`<li>${u}</li>`)}</ul>` : ''}
    </aside></div>
    ${open && s.can.act ? (ui.back ? backForm(ui) : html`<div class="st-acts st-foot-acts">${btn('approve', 'Approve', { primary: true, busy: ui.busy })}${btn('open-back', 'Send back', { busy: ui.busy })}</div>`) : readOnlyNote(s)}
    ${s.status === 'sent_back' ? html`<div class="st-done"><p><b>Sent back.</b> ${s.result.reason || `${s.result.comments} comments`}. The agent redrafts from the comments.</p></div>` : ''}
    ${s.status === 'done' ? html`<div class="st-done"><p><b>Approved</b> by ${who(s.done_by)} with ${s.result.comments} ${s.result.comments === 1 ? 'comment' : 'comments'}.</p></div>` : ''}`;
}

function backForm(ui) {
  return html`<form class="st-form st-back" data-form="back"><label class="field"><span>What needs changing</span>
    <input name="reason" maxlength="400" placeholder="In a line; your comments go with it"></label>
    <div class="st-acts"><button class="btn is-small" type="submit"${ui.busy ? raw(' disabled') : ''}>Send back</button>${btn('close-back', 'Cancel')}</div></form>`;
}

function clock(ms) { const s = Math.round((ms || 0) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

function recordBody(s, ui) {
  const p = s.payload, rec = ui.rec || {};
  const video = p.mode !== 'audio';
  const script = html`<div class="st-prompter${rec.phase === 'live' ? ' is-live' : ''}">${p.script.map((l) => html`<p>${l}</p>`)}</div>`;
  if (s.status !== 'waiting') {
    const t = s.result.take;
    const url = t && ui.files[t.file_id];
    return html`${script}<div class="st-done"><p><b>Recorded</b> by ${who(s.done_by)}${t && t.ms ? `, ${clock(t.ms)}` : ''}${s.status === 'awaiting_check' ? ', waiting for the check' : ''}.</p>
      ${url ? (t.mime.startsWith('video') ? html`<video class="st-media" controls playsinline src="${url}"></video>` : html`<audio controls src="${url}"></audio>`) : html`<p class="muted st-fine">Loading the take</p>`}</div>`;
  }
  if (!s.can.act) return html`${script}${readOnlyNote(s)}`;
  return html`<p class="st-for">${p.for} · up to ${p.max_s} s · ${video ? 'video' : 'voice'}</p>
    <div class="st-rec">
      ${script}
      <div class="st-cam">
        ${rec.phase === 'live' ? html`${video ? html`<video id="st-live" class="st-media" muted playsinline autoplay></video>` : html`<div class="st-voice" aria-hidden="true"></div>`}
          <p class="st-timer mono"><span class="st-dot" aria-hidden="true"></span><span id="st-clock">${clock(rec.ms)}</span> / ${clock(p.max_s * 1000)}</p>
          <div class="st-acts">${btn('rec-stop', 'Stop', { primary: true })}</div>`
        : rec.phase === 'done' ? html`${video ? html`<video class="st-media" controls playsinline src="${rec.url}"></video>` : html`<audio controls src="${rec.url}"></audio>`}
          <p class="st-fine">${rec.ms ? `${clock(rec.ms)}, ` : ''}${Math.round(rec.size / 1000)} KB. Watch it back, then use it or record again.</p>
          <div class="st-acts">${btn('rec-use', 'Use this take', { primary: true, busy: ui.busy })}${btn('rec-again', 'Record again', { busy: ui.busy })}</div>`
        : html`<div class="st-cam-idle"><p>${video ? 'Camera and microphone' : 'Microphone'} start when you press Record. The script stays on screen.</p></div>
          <div class="st-acts">${btn('rec-start', 'Record', { primary: true })}
            <label class="btn is-small st-file">Or pick a file<input type="file" accept="${video ? 'video/*,audio/*' : 'audio/*'}" data-file="take" hidden></label></div>`}
        ${rec.err ? html`<p class="err">${rec.err}</p>` : ''}
        <ul class="st-ul st-tips">${(p.tips || []).map((t) => html`<li>${t}</li>`)}</ul>
      </div>
    </div>`;
}

function uploadBody(s, ui) {
  const p = s.payload, r = s.result || {};
  const photoUrl = r.photo ? ui.files[r.photo.file_id] : ui.photo && ui.photo.url;
  if (!r.photo) {
    if (!s.can.act) return html`<p class="st-for">${p.shot}</p>${readOnlyNote(s)}`;
    return html`<div class="st-two"><div><h3 class="st-h">The shot</h3><p>${p.shot}</p>
        <h3 class="st-h">The agent checks</h3><ul class="st-ul">${p.expect.map((e) => html`<li>${e.label}</li>`)}</ul></div>
      <div>${ui.photo ? html`<img class="st-photo" src="${ui.photo.url}" alt="Your photo, before it is sent">
          <div class="st-acts">${btn('photo-send', 'Send the photo', { primary: true, busy: ui.busy })}${btn('photo-again', 'Take another', { busy: ui.busy })}</div>`
        : html`<label class="btn is-primary st-file">Take the photo<input type="file" accept="image/*" capture="environment" data-file="photo" hidden></label>
          <p class="st-fine">On a phone this opens the camera. On a laptop, pick a photo.</p>`}</div></div>`;
  }
  const rb = r.readback || [];
  const done = s.status !== 'waiting';
  return html`<div class="st-two">
    <div>${photoUrl ? html`<img class="st-photo" src="${photoUrl}" alt="The label photo">` : html`<p class="muted st-fine">Loading the photo</p>`}</div>
    <div><h3 class="st-h">The agent's read-back</h3><p class="st-fine">${r.readback_note}</p>
      ${done ? html`<ul class="st-rb">${rb.map((x, i) => html`<li class="${r.matches && r.matches[i] === false ? 'is-off' : 'is-ok'}"><span>${x.label}</span><b>${x.value}</b><span class="mono">${r.matches && r.matches[i] === false ? 'Does not match' : 'Matches'}</span></li>`)}</ul>
          <div class="st-done"><p><b>${r.outcome === 'mismatch' ? `${r.mismatch.length} ${r.mismatch.length === 1 ? 'line does' : 'lines do'} not match.` : 'Every line matches.'}</b>${r.note ? ` ${r.note}` : ''}</p></div>`
        : s.can.act ? html`<form class="st-form" data-form="confirm"><ul class="st-rb">${rb.map((x, i) => html`<li class="${ui.matches[i] === false ? 'is-off' : ui.matches[i] ? 'is-ok' : ''}">
            <span>${x.label}</span><b>${x.value}</b>
            <span class="st-yn" role="group" aria-label="${x.label}">${btn(`m-yes:${i}`, 'Matches', { extra: ui.matches[i] === true ? ' aria-pressed="true"' : ' aria-pressed="false"' })}${btn(`m-no:${i}`, 'Does not', { extra: ui.matches[i] === false ? ' aria-pressed="true"' : ' aria-pressed="false"' })}</span></li>`)}</ul>
          ${ui.matches.some((m) => m === false) ? html`<label class="field"><span>What the label shows instead</span><input name="note" maxlength="400" required></label>` : ''}
          <button class="btn is-primary" type="submit"${ui.busy || rb.some((_, i) => typeof ui.matches[i] !== 'boolean') ? raw(' disabled') : ''}>Confirm</button></form>`
        : readOnlyNote(s)}
    </div></div>`;
}

function signoffBody(s, ui) {
  const p = s.payload;
  const open = s.status === 'waiting' && s.can.act;
  const doneIds = new Set((s.result.ticked || []).map(String));
  const all = p.items.every((it) => ui.ticked.has(String(it.id)));
  return html`${p.ref ? html`<p class="st-for">${p.ref}</p>` : ''}
    <form class="st-form" data-form="signoff"><ul class="st-check">${p.items.map((it) => html`<li><label>
      <input type="checkbox" data-tick="${it.id}"${(open ? ui.ticked.has(String(it.id)) : doneIds.has(String(it.id))) ? raw(' checked') : ''}${open ? '' : raw(' disabled')}>
      <span>${it.text}</span></label></li>`)}</ul>
    ${open ? (ui.back ? '' : html`<label class="field"><span>Note (optional)</span><input name="note" maxlength="400"></label>
      <div class="st-acts"><button class="btn is-primary" type="submit"${ui.busy || !all ? raw(' disabled') : ''}>Sign off</button>${btn('open-back', 'Send back', { busy: ui.busy })}
      ${all ? '' : html`<span class="st-fine">${p.items.length - p.items.filter((it) => ui.ticked.has(String(it.id))).length} left to tick</span>`}</div>`) : ''}</form>
    ${open && ui.back ? backForm(ui) : ''}${open ? '' : readOnlyNote(s)}
    ${s.status === 'sent_back' ? html`<div class="st-done"><p><b>Sent back.</b> ${s.result.reason}</p></div>` : ''}
    ${['done', 'awaiting_check'].includes(s.status) ? html`<div class="st-done"><p><b>Signed off</b> by ${who(s.done_by)}${s.result.note ? `: ${s.result.note}` : ''}.</p></div>` : ''}`;
}

function callBody(s, ui) {
  const p = s.payload, r = s.result || {}, w = p.who || {};
  const tel = String(w.phone || '').replace(/[^+0-9]/g, '');
  const log = s.status === 'waiting' && s.can.act;
  const out = ui.outcome || '';
  return html`<div class="st-two">
    <div class="st-call">
      <div class="st-callee"><p class="st-callee-n">${w.name}</p><p class="muted">${w.company}</p>
        <a class="btn st-tel" href="tel:${tel}">Call ${w.phone}</a>${w.note ? html`<p class="st-fine">${w.note}</p>` : ''}</div>
      <h3 class="st-h">You want</h3><p class="st-goal">${p.goal}</p>
      <h3 class="st-h">Say</h3><ol class="st-ol">${p.points.map((x) => html`<li>${x}</li>`)}</ol>
      <h3 class="st-h">If they say</h3><dl class="st-obj">${p.objections.map((o) => html`<dt>${o.q}</dt><dd>${o.a}</dd>`)}</dl>
    </div>
    <div>${(r.attempts || []).length ? html`<h3 class="st-h">Calls so far</h3><ul class="st-att">${r.attempts.map((a) => html`<li><b>${a.label}</b>${a.next ? `, call back ${day(a.next)}` : ''}<span class="muted"> · ${ago(a.ts)}</span>${a.note ? html`<p>${a.note}</p>` : ''}</li>`)}</ul>` : ''}
      ${log ? html`<form class="st-form" data-form="call"><h3 class="st-h">How did it go</h3>
        <div class="st-radios" role="radiogroup" aria-label="Outcome">${OUTCOMES.map(([k, l]) => html`<label class="st-radio"><input type="radio" name="outcome" value="${k}"${out === k ? raw(' checked') : ''} required><span>${l}</span></label>`)}</div>
        ${out === 'call_back' ? html`<label class="field"><span>Call back on</span><input type="date" name="next" required></label>` : ''}
        <label class="field"><span>What they said${out === 'reached' || out === 'refused' ? '' : ' (optional)'}</span><textarea name="note" maxlength="1000" rows="3"${out === 'reached' || out === 'refused' ? raw(' required') : ''}></textarea></label>
        <button class="btn is-primary" type="submit"${ui.busy ? raw(' disabled') : ''}>Log the call</button></form>`
        : s.status === 'waiting' ? readOnlyNote(s)
        : html`<div class="st-done"><p><b>${(OUTCOMES.find((o) => o[0] === r.outcome) || [0, 'Logged'])[1]}.</b> ${r.note}</p></div>`}
    </div></div>`;
}

function sendBody(s, ui) {
  const p = s.payload, r = s.result || {};
  const open = s.status === 'waiting' && s.can.act;
  const to = html`<p class="st-to"><span class="mono">${p.channel === 'whatsapp' ? 'WhatsApp' : 'Email'} to</span> ${p.to.map((t, i) => html`${i ? ', ' : ''}${t.name}${t.address ? html` <span class="muted">${t.address}</span>` : ''}`)}</p>`;
  if (!open) {
    return html`${to}<div class="st-msg">${(r.subject ?? p.subject) ? html`<p class="st-msg-s">${r.subject ?? p.subject}</p>` : ''}<p class="st-msg-b">${r.body ?? p.body}</p></div>
      ${s.status === 'waiting' ? readOnlyNote(s) : html`<div class="st-done"><p><b>${s.status === 'awaiting_check' ? 'Tapped Send.' : 'Sent.'}</b> ${r.delivery}${r.edited ? ' Edited before sending.' : ''}</p></div>`}`;
  }
  return html`${to}<form class="st-form" data-form="send">
    ${p.channel === 'email' ? html`<label class="field"><span>Subject</span><input name="subject" maxlength="200" value="${p.subject}"></label>` : ''}
    <label class="field"><span>Message</span><textarea name="body" maxlength="6000" rows="12" required>${p.body}</textarea></label>
    <div class="st-acts"><button class="btn is-primary" type="submit"${ui.busy ? raw(' disabled') : ''}>Send</button><span class="st-fine">Nothing goes out until you tap Send.${s.checker ? ` ${who(s.checker)} checks it first.` : ''}</span></div></form>`;
}

const BODY = { paste: pasteBody, review: reviewBody, record: recordBody, upload: uploadBody, signoff: signoffBody, call: callBody, send: sendBody };

function history(s) {
  const ev = s.events || [];
  if (!ev.length) return '';
  return html`<details class="st-hist"><summary>History <span class="tab-n">${ev.length}</span></summary><ol>${ev.map((e) => html`<li><b>${e.by_name}</b> ${ACTION[e.action] || e.action}<span class="muted"> · ${ago(e.ts)}</span></li>`)}</ol></details>`;
}

// The whole sheet for one step. ui = { busy, err, sel, back, ticked: Set, matches: [], rec, photo, files: {fid: url}, cancel, outcome }
export function sheet(s, ui = {}) {
  ui = { files: {}, ticked: new Set(), matches: [], ...ui };
  return html`${head(s)}
    ${ui.err ? html`<p class="err st-err" role="alert">${ui.err}</p>` : ''}
    <div class="st-body">${(BODY[s.kind] || (() => ''))(s, ui)}</div>
    ${s.status === 'awaiting_check' ? html`<div class="st-checkbar">${s.can.check
      ? html`<p>${who(s.done_by)} finished this. A second person checks it before it counts.</p>${btn('check', 'Check', { primary: true, busy: ui.busy })}`
      : html`<p>${s.waiting_on}.</p>`}</div>` : ''}
    <footer class="st-foot">${history(s)}
      ${s.can.cancel ? (ui.cancel
        ? html`<form class="st-form st-cancel" data-form="cancel"><label class="field"><span class="sr">Why cancel</span><input name="reason" maxlength="300" placeholder="Why cancel it" required></label>
            <button class="btn is-small" type="submit"${ui.busy ? raw(' disabled') : ''}>Cancel the step</button>${btn('close-cancel', 'Keep it')}</form>`
        : btn('open-cancel', 'Cancel the step')) : ''}</footer>`;
}

// ---- the sheet in the browser ----------------------------------------------------------------------------------
const widNow = () => { const m = /^#\/w\/([^/]+)/.exec(globalThis.location?.hash || ''); return m ? decodeURIComponent(m[1]) : null; };

async function upload(wid, id, blob, name, version, ms) {
  const fd = new FormData();
  fd.set('file', blob, name);
  fd.set('version', String(version));
  if (ms) fd.set('ms', String(Math.round(ms)));
  let res;
  try { res = await fetch(`${apiBase()}/w/${wid}/steps/${id}/upload`, { method: 'POST', headers: { authorization: `Bearer ${token.get()}` }, body: fd }); }
  catch { throw new Error('Can’t reach the server. Check your connection and try again.'); }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || `Upload failed (${res.status}).`);
  return data;
}

async function fileUrl(wid, id, fid) {
  const res = await fetch(`${apiBase()}/w/${wid}/steps/${id}/files/${fid}`, { headers: { authorization: `Bearer ${token.get()}` } });
  if (!res.ok) throw new Error('Could not load the file.');
  return URL.createObjectURL(await res.blob());
}

const pickMime = (video) => {
  const list = video ? ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'] : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return list.find((m) => globalThis.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
};

export async function openStep(id, { wid = widNow() } = {}) {
  if (!wid || typeof document === 'undefined') return;
  const dlg = document.createElement('dialog');
  dlg.className = 'st-dlg';
  dlg.setAttribute('aria-labelledby', 'st-title');
  dlg.innerHTML = '<div class="st-sheet"><p class="loading">Loading</p></div>';
  document.body.append(dlg);
  dlg.showModal();
  const box = dlg.firstElementChild;
  let s = null, dirty = false, fresh = false, stream = null, recorder = null, timer = null;
  const ui = { busy: false, err: '', sel: null, back: false, ticked: new Set(), matches: [], rec: { phase: 'idle' }, photo: null, files: {}, cancel: false, outcome: '' };
  const urls = [];

  const paint = () => {
    if (!s) return;
    // typed text survives a repaint (a tick, a toggle); a pasted key never does
    const keep = fresh ? [] : [...box.querySelectorAll('form[data-form] input[type="text"], form[data-form] input:not([type]), form[data-form] input[type="date"], form[data-form] textarea')]
      .filter((el) => el.name && el.form.dataset.form !== 'paste').map((el) => [el.form.dataset.form, el.name, el.value]);
    box.innerHTML = String(sheet(s, ui));
    fresh = false;
    for (const [form, name, value] of keep) { const el = box.querySelector(`form[data-form="${form}"] [name="${name}"]`); if (el) el.value = value; }
    const live = box.querySelector('#st-live');
    if (live && stream) live.srcObject = stream;
  };
  async function loadFiles() {
    const ids = [s.result && s.result.take && s.result.take.file_id, s.result && s.result.photo && s.result.photo.file_id].filter(Boolean);
    for (const fid of ids) {
      if (ui.files[fid]) continue;
      try { const u = await fileUrl(wid, s.id, fid); urls.push(u); ui.files[fid] = u; } catch { /* the line says Loading */ }
    }
    paint();
  }
  const set = (step) => { s = step; if (s.kind === 'upload' && ui.matches.length !== ((s.result && s.result.readback) || []).length) ui.matches = []; paint(); loadFiles(); };
  async function run(fn) {
    ui.busy = true; ui.err = ''; paint();
    try { const r = await fn(); if (r && r.step) { dirty = true; fresh = true; ui.back = false; ui.cancel = false; ui.sel = null; set(r.step); } }
    catch (e) { ui.err = e.message; }
    ui.busy = false; paint();
  }
  const post = (act, body) => api('POST', `/w/${wid}/steps/${s.id}/${act}`, { version: s.version, ...body });

  function stopMedia() {
    clearInterval(timer); timer = null;
    if (recorder && recorder.state !== 'inactive') { try { recorder.stop(); } catch { /* */ } }
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  }
  async function startRec() {
    const video = s.payload.mode !== 'audio';
    ui.rec = { phase: 'idle' };
    if (!navigator.mediaDevices || !globalThis.MediaRecorder) { ui.rec.err = 'This browser cannot record here. Pick a file you recorded on your phone instead.'; paint(); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia(video ? { audio: true, video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } } } : { audio: true });
    } catch { ui.rec.err = 'The camera or microphone is blocked. Allow it in the browser, or pick a file instead.'; paint(); return; }
    const mime = pickMime(video);
    const chunks = [];
    recorder = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), ...(video ? { videoBitsPerSecond: 1_000_000 } : {}), audioBitsPerSecond: 64_000 });
    const t0 = Date.now();
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      const ms = Date.now() - t0;
      const blob = new Blob(chunks, { type: (recorder.mimeType || mime || (video ? 'video/webm' : 'audio/webm')) });
      if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
      const url = URL.createObjectURL(blob); urls.push(url);
      ui.rec = { phase: 'done', blob, url, ms, size: blob.size };
      if (blob.size > (video ? CAP.video : CAP.audio)) ui.rec.err = 'That take is over the size limit. Record a shorter one.';
      paint();
    };
    recorder.start(1000);
    ui.rec = { phase: 'live', ms: 0 };
    paint();
    timer = setInterval(() => {
      ui.rec.ms = Date.now() - t0;
      const c = box.querySelector('#st-clock'); if (c) c.textContent = clock(ui.rec.ms);
      if (ui.rec.ms >= s.payload.max_s * 1000) { clearInterval(timer); recorder.stop(); }
    }, 250);
  }

  const close = () => { stopMedia(); urls.forEach((u) => URL.revokeObjectURL(u)); dlg.close(); };
  dlg.addEventListener('close', () => {
    stopMedia(); dlg.remove();
    if (dirty) globalThis.dispatchEvent(new HashChangeEvent('hashchange')); // the page under the sheet reloads its lists
  });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) { close(); return; }
    const b = e.target.closest('[data-st]');
    if (!b || !s) return;
    const a = b.dataset.st;
    if (a === 'close') return close();
    if (a === 'sel') { ui.sel = Number(b.dataset.i); paint(); box.querySelector('textarea[name="body"]')?.focus(); return; }
    if (a === 'unsel') { ui.sel = null; paint(); return; }
    if (a === 'open-back') { ui.back = true; paint(); return; }
    if (a === 'close-back') { ui.back = false; paint(); return; }
    if (a === 'open-cancel') { ui.cancel = true; paint(); return; }
    if (a === 'close-cancel') { ui.cancel = false; paint(); return; }
    if (a === 'approve') return run(() => post('approve'));
    if (a === 'check') return run(() => post('check'));
    if (a === 'rec-start') return startRec();
    if (a === 'rec-stop') { clearInterval(timer); if (recorder && recorder.state !== 'inactive') recorder.stop(); return; }
    if (a === 'rec-again') { ui.rec = { phase: 'idle' }; paint(); return; }
    if (a === 'rec-use') {
      const r = ui.rec; if (!r.blob || r.err) return;
      const ext = /mp4/.test(r.blob.type) ? 'mp4' : /ogg/.test(r.blob.type) ? 'ogg' : 'webm';
      return run(() => upload(wid, s.id, r.blob, `take.${ext}`, s.version, r.ms));
    }
    if (a === 'photo-again') { ui.photo = null; paint(); return; }
    if (a === 'photo-send') { const f = ui.photo && ui.photo.file; if (f) return run(() => upload(wid, s.id, f, f.name || 'label.jpg', s.version)); return; }
    const m = /^m-(yes|no):(\d+)$/.exec(a);
    if (m) { ui.matches[Number(m[2])] = m[1] === 'yes'; paint(); }
  });
  dlg.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.tick) { t.checked ? ui.ticked.add(t.dataset.tick) : ui.ticked.delete(t.dataset.tick); paint(); return; }
    if (t.name === 'outcome') { ui.outcome = t.value; paint(); return; }
    if (t.dataset && t.dataset.file && t.files && t.files[0]) {
      const f = t.files[0];
      if (t.dataset.file === 'photo') {
        if (f.size > CAP.image) { ui.err = 'That photo is over 6 MB. Take it again at a lower size.'; paint(); return; }
        const url = URL.createObjectURL(f); urls.push(url); ui.photo = { file: f, url }; ui.err = ''; paint(); return;
      }
      const video = /^video\//.test(f.type);
      if (f.size > (video ? CAP.video : CAP.audio)) { ui.err = `That file is over ${Math.round((video ? CAP.video : CAP.audio) / 1e6)} MB.`; paint(); return; }
      const url = URL.createObjectURL(f); urls.push(url);
      ui.rec = { phase: 'done', blob: f, url, ms: 0, size: f.size }; ui.err = ''; paint();
      const probe = document.createElement(video ? 'video' : 'audio'); // the length of a picked file, for the take line
      probe.preload = 'metadata';
      probe.onloadedmetadata = () => { if (ui.rec.blob === f && Number.isFinite(probe.duration)) { ui.rec.ms = probe.duration * 1000; paint(); } };
      probe.src = url;
    }
  });
  dlg.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-form]'); if (!f || !s) return;
    e.preventDefault();
    const v = Object.fromEntries(new FormData(f));
    const kind = f.dataset.form;
    if (kind === 'paste') { const val = v.value; f.reset(); return run(() => post('paste', { value: val })); }
    if (kind === 'comment') return run(() => post('comment', { anchor: ui.sel, quote: String(s.payload.draft[ui.sel] || '').slice(0, 120), body: v.body }));
    if (kind === 'back') return run(() => post('send-back', { reason: v.reason || '' }));
    if (kind === 'confirm') return run(() => post('confirm', { matches: ui.matches, note: v.note || '' }));
    if (kind === 'signoff') return run(() => post('signoff', { ticked: [...ui.ticked].map(Number), note: v.note || '' }));
    if (kind === 'call') return run(() => post('call', { outcome: v.outcome, note: v.note || '', next: v.next || undefined }));
    if (kind === 'send') return run(() => post('send', { subject: v.subject, body: v.body }));
    if (kind === 'cancel') return run(() => post('cancel', { reason: v.reason }));
  });

  try { set((await api('GET', `/w/${wid}/steps/${id}`)).step); }
  catch (e) { box.innerHTML = String(html`<header class="st-head"><span></span><button class="st-x" type="button" data-st="close">Close</button></header><p class="err">${e.message}</p>`); box.querySelector('[data-st="close"]').onclick = close; }
}

// one handler for every page: any element with data-step-open opens that step
if (typeof document !== 'undefined' && !globalThis.__stepsBound) {
  globalThis.__stepsBound = true;
  document.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('[data-step-open]');
    if (!t || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    openStep(Number(t.dataset.stepOpen));
  });
}
