// ask.js: the shell's ask bar, answered by the brain (d2c-clone-app docs/brain.md).
//
//   runAsk({api, wid, q, fallback, onState, alive})   GET w/:wid/brain (online?), POST brain/ask, then long-polls
//                        GET brain/jobs/:id?wait=20 until the job is done or failed. Only when the brain is offline (the
//                        status says so, or the ask answers 503) does it call fallback(q), the demo engine's answer, and
//                        that answer is always labelled as such.
//   Chat (pages/chat.js) runs the same loop with extra {thread, as} (the line is posted in the thread and the answer
//   comes back there) and fallbackOnError: a reply must never be left dead, so a failed, refused or too-slow brain
//   falls back to the demo reply too, as fallback(q, {offline, message}) (message: the line the brain already posted,
//   null if none).
//   askView(state, wid)  the answer panel, pure (string in, string out) so Node can test it.
//
// state.mode is 'brain' or 'demo'. A brain state carries the job's status while it runs, then lines
// [{text, source_labels, unverified}] and gaps. A demo state carries replies [{author_name, body}] and offline (the
// reason). Either can carry error. Nothing here touches the DOM.
import { html } from './ui.js';

export const POLL_WAIT = 20;          // seconds per long-poll (the Worker caps it at 25)
export const MAX_MS = 6 * 60_000;     // past this, stop waiting (the runner's own timeout is 4 min a try)
export const OFFLINE_NOTE = 'Brain offline, showing the demo answer.';

const ACTIVE = new Set(['queued', 'running']);

// under a demo reply Chat gave in the brain's place: why (offline, or it did not answer)
export const demoNote = (reason) => (/offline/i.test(String(reason || '')) ? OFFLINE_NOTE : 'The brain did not answer, showing the demo answer.');

export const CHAT_MAX_MS = 90_000;   // Chat waits this long for the brain, then the demo reply answers instead

export async function runAsk({ api, wid, q, fallback, onState = () => {}, alive = () => true, now = Date.now, maxMs = MAX_MS, extra = null, fallbackOnError = false }) {
  const t0 = now();
  let message = null; // the line the brain posted in a thread (Chat)
  const demo = async (offline) => {
    if (!fallback) return { q, mode: 'demo', offline, error: 'The brain is offline, so there is no answer right now.' };
    onState({ q, mode: 'demo', busy: true, offline, message });
    if (!alive()) return null;
    try {
      const r = await fallback(q, { offline, message });
      return { q, mode: 'demo', offline, message, replies: (r?.replies || []).filter((m) => m && m.body) };
    } catch (e) {
      return { q, mode: 'demo', offline, message, error: e?.message || 'The demo answer did not load.' };
    }
  };
  // the Ask bar shows a brain error as it is; Chat answers with the demo reply instead (never a dead message)
  const failed = (error) => (fallbackOnError ? demo(error) : { q, mode: 'brain', message, error });
  // is the brain online for this workspace? (GET brain; a failed check counts as online and lets the ask decide)
  try {
    const st = (await api('GET', `/w/${wid}/brain`))?.brain;
    if (st && st.online === false) return demo(st.reason || 'Brain offline.');
  } catch { /* the ask below answers 503 if it is offline */ }
  if (!alive()) return null;
  let job;
  try {
    const r = await api('POST', `/w/${wid}/brain/ask`, { question: q, ...(extra || {}) });
    job = r?.job; message = r?.message || null;
  } catch (e) {
    if (e?.status === 503) return demo(e.message || 'Brain offline.'); // went offline between the check and the ask
    return failed(e?.message || 'The question did not reach the brain.');
  }
  if (!job) return failed('The brain did not take the question. Try again.');
  while (ACTIVE.has(job.status)) {
    onState({ q, mode: 'brain', busy: true, status: job.status, message });
    if (!alive()) return null;
    if (now() - t0 > maxMs) return failed(fallbackOnError ? 'The brain did not answer in time.' : 'The brain is taking too long. Try again in a minute.');
    try {
      const r = await api('GET', `/w/${wid}/brain/jobs/${job.id}?wait=${POLL_WAIT}`);
      if (!r?.job) return failed('The question was lost. Try again.');
      job = r.job;
    } catch (e) {
      return failed(e?.message || 'Lost touch with the brain.');
    }
  }
  if (!alive()) return null;
  if (job.status === 'done' && Array.isArray(job.output?.lines)) {
    const secs = job.done_ts && job.ts ? Math.max(1, Math.round((job.done_ts - job.ts) / 1000)) : null;
    return { q, mode: 'brain', message, lines: job.output.lines, gaps: job.output.gaps || '', secs };
  }
  return failed(`The brain could not answer: ${job.error || 'no answer came back'}.`.replace(/\.\.$/, '.'));
}

// 'Sales numbers, 12 Nov (sample)' -> ['Sales numbers, 12 Nov', true]
export function splitSample(label) {
  const s = String(label || '').trim();
  const m = s.match(/^(.*?)\s*\(sample\)$/i);
  return m ? [m[1], true] : [s, false];
}

const chip = (label) => {
  const [name, sample] = splitSample(label);
  return html`<li class="ask-src">${name}${sample ? html`<span class="ask-src-s"> (sample)</span>` : ''}</li>`;
};

export function brainLine(l) {
  const labels = [...new Set((l.source_labels || []).filter(Boolean))];
  const unv = (l.unverified || []).length;
  return html`<li class="ask-line"><p class="ask-ans-b">${l.text}</p>${labels.length || unv ? html`<ul class="ask-srcs" aria-label="Sources">${labels.map(chip)}${unv ? html`<li class="ask-src is-unv">${unv === 1 ? '1 number not in the records' : `${unv} numbers not in the records`}</li>` : ''}</ul>` : ''}</li>`;
}

// Pure: the answer panel. wid builds the link to All hands (the demo answer is posted there).
export function askView(s, wid) {
  if (!s) return '';
  const demo = s.mode === 'demo';
  const close = html`<button class="ask-x" type="button" data-ask="close">Close</button>`;
  const head = html`<div class="ask-ans-h"><b>${demo ? 'Demo answer' : 'Chief of staff'}</b>${close}</div>
    <p class="ask-ans-q">You asked: ${s.q}</p>${demo ? html`<p class="ask-off">${OFFLINE_NOTE}</p>` : ''}`;
  let body;
  if (s.busy) {
    body = demo ? html`<p class="ask-ans-b muted">Loading the demo answer</p>`
      : html`<p class="ask-ans-b muted ask-think" role="status">Thinking</p>`;
  } else if (s.error) {
    body = html`<p class="ask-ans-b err">${s.error}</p>`;
  } else if (demo) {
    body = (s.replies || []).length
      ? s.replies.map((r) => html`<p class="ask-ans-b">${r.body}</p>${r.source ? html`<p class="ask-ans-q">Source: ${r.source}</p>` : ''}`)
      : html`<p class="ask-ans-b">Sent to All hands. The chief of staff answers there, and the team sees it too.</p>`;
  } else {
    body = html`<ol class="ask-lines">${(s.lines || []).map(brainLine)}</ol>${s.gaps ? html`<p class="ask-gap">Not in the records: ${s.gaps}</p>` : ''}`;
  }
  const foot = demo && !s.busy && !s.error
    ? html`<p class="ask-ans-f"><a class="linkish" href="#/w/${encodeURIComponent(wid)}/chat/all-hands" data-ask="close">Open the thread in Chat</a></p>` : '';
  return html`${head}${body}${foot}`;
}
