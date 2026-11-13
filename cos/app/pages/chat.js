// chat.js: Chat. One group thread per area where people and agents talk. Agents drop the one decision card
// (js/cos.js) into the thread; people ask in plain words ("how are sales today?") and the thread's agent answers.
// Route: #/w/<wid>/chat/<thread slug>.
//
// The composer asks the brain the same way the ask bar does (js/ask.js runAsk, with {thread, as}): the line is posted
// in the thread, "Thinking" shows under it while the brain works, and the answer lands in the thread as the agent,
// each line with its sources as chips. The thread's earlier lines reach the brain only as quoted outside text
// (the Worker's brain-context). When the brain is offline, fails, refuses or is too slow (CHAT_MAX_MS), the scripted
// demo reply answers instead and says so under it: a line is never left without an answer.
import { html, raw } from '../js/ui.js';
import { cosApi, live, bindCards, decisionCard, face, clock, ago, head, loadFaces, avatarOf, changed, sourceLabel, as } from '../js/cos.js';
import { runAsk, brainLine, demoNote, CHAT_MAX_MS } from '../js/ask.js';

export const title = 'Chat';
export const CHIPS = ['How are sales today?', 'What is waiting for a tap?', 'When is the launch?', 'What is the stock cover?'];

// Pure. data = {state, threads, thread: {thread, messages, decisions} | null}
export function view(data, ctx, ui = {}) {
  const { state: s, threads = [], cur } = data;
  const sx = { ...s, wid: ctx.wid };
  const slug = cur?.thread?.slug || null;
  const canPost = ['member', 'admin', 'owner'].includes(ctx.role);
  const list = html`<nav class="ct-list" aria-label="Threads">${threads.map((t) => html`<a class="ct-th" href="#/w/${ctx.wid}/chat/${t.slug}"${raw(t.slug === slug ? ' aria-current="page"' : '')}>
    ${face(t.agent || 'Chief of staff', { agent: true })}
    <span class="ct-th-n"><span title="${t.name}">#${t.slug}${owner(t, s) ? html` <span class="ct-own">@${owner(t, s)}</span>` : ''}</span>${t.open ? html`<span class="ct-badge" title="Cards waiting">${t.open}</span>` : ''}</span>
    <span class="ct-th-p">${t.preview ? `${t.preview.author}: ${t.preview.body}` : t.agent}</span></a>`)}</nav>`;
  let main = '';
  if (cur) {
    const t = cur.thread;
    const msg = (m) => {
      if (m.author_kind === 'system') return html`<li class="ct-sys">${m.body} <span class="mono">${clock(m.ts)}</span></li>`;
      const d = m.decision_id ? cur.decisions[m.decision_id] : null;
      const agent = m.author_kind === 'agent';
      return html`<li class="ct-m${agent ? ' is-agent' : ''}">
        ${face(m.author, { agent, avatar: avatarOf(s, m.author) })}
        <p class="ct-m-h"><b>${m.author}</b><span class="mono">${clockOrDay(m.ts)}</span></p>
        ${m.brain ? brainBody(m.brain) : html`<p class="ct-b">${m.body}</p>`}
        ${m.source && !d && !m.brain ? html`<p class="ct-src">Source: ${sourceLabel(m.source)}</p>` : ''}
        ${m.demo ? html`<p class="ct-src ct-demo">${demoNote(m.demo)}</p>` : ''}
        ${d ? decisionCard(d, sx) : ''}
      </li>`;
    };
    // the line being asked: shown at once, then "Thinking" under it as the thread's agent until the reply lands
    const p = ui.pending;
    const agentName = t.agent || 'Chief of staff';
    const pend = !p ? '' : html`${p.mid && cur.messages.some((m) => m.id === p.mid) ? '' : html`<li class="ct-m is-pending">
        ${face(p.who, { avatar: avatarOf(s, p.who) })}
        <p class="ct-m-h"><b>${p.who}</b><span class="mono">Sending</span></p>
        <p class="ct-b">${p.q}</p>
      </li>`}${p.mid && cur.messages.some((m) => m.reply_to === p.mid) ? '' : html`<li class="ct-m is-agent" aria-live="polite">
        ${face(agentName, { agent: true })}
        <p class="ct-m-h"><b>${agentName}</b></p>
        ${p.answer ? brainBody(p.answer) : html`<p class="ct-b muted ct-think" role="status">${p.demo ? 'Loading the demo answer' : 'Thinking'}</p>`}
      </li>`}`;
    main = html`<div class="ct-main">
      <header class="ct-head">
        <a class="ct-back linkish" href="#/w/${ctx.wid}/chat">All threads</a>
        <h2 title="${t.name}">#${t.slug}${owner(t, s) ? html` <span class="ct-own">@${owner(t, s)}</span>` : ''}</h2>
        <p class="ct-who" aria-label="${[...t.fns.map((f) => f.agent), ...t.people.map((p) => p.name)].filter((a, i, all) => a && all.indexOf(a) === i).join(', ')}"><span class="ct-stack">${t.fns.map((f) => f.agent).filter((a, i, all) => all.indexOf(a) === i).map((a) => html`<span title="${a}">${face(a, { agent: true, small: true })}</span>`)}</span><span class="ct-stack">${t.people.map((p) => p.name).filter((n, i, all) => n && all.indexOf(n) === i).slice(0, 8).map((n) => html`<span title="${n}">${face((s.people || {})[n]?.name || n, { avatar: avatarOf(s, n), small: true })}</span>`)}</span></p>
      </header>
      <ul class="ct-msgs" id="ct-msgs">${cur.messages.length || p ? html`${cur.messages.map(msg)}${pend}` : html`<li class="muted">No messages yet.</li>`}</ul>
      ${canPost ? html`<form class="ct-comp" id="ct-form" autocomplete="off">
        <div class="ct-chips">${CHIPS.map((c) => html`<button type="button" data-chip="${c}"${raw(ui.busy ? ' disabled' : '')}>${c}</button>`)}</div>
        <div class="ct-row"><label class="sr" for="ct-in">Message</label><input id="ct-in" maxlength="2000" placeholder="Ask in plain words, or say what to do" value="${ui.draft || ''}"><button class="btn is-primary" type="submit"${ui.busy ? ' disabled' : ''}>Send</button></div>
      </form>` : html`<p class="ct-comp muted">Viewers read everything; a member can ask.</p>`}
    </div>`;
  }
  return html`<section class="pg">
    ${head('Chat', '', s, ctx.wid)}
    <div class="ct${cur ? ' has-thread' : ''}">${list}${main}</div>
  </section>`;
}
// the brain's answer in a thread: its lines with their sources as chips (as in the ask panel), and what the records lack
const brainBody = (b) => html`<ol class="ask-lines ct-lines">${(b.lines || []).map(brainLine)}</ol>${b.gaps ? html`<p class="ask-gap">Not in the records: ${b.gaps}</p>` : ''}`;

// a channel's owner, @tagged: the thread's named owner, else the first person on it (names or role keys)
export function owner(t, s = {}) {
  if (t.owner) return typeof t.owner === 'string' ? t.owner : t.owner.name;
  const p = (t.people || [])[0];
  if (!p) return '';
  return typeof p === 'string' ? (s.people || {})[p]?.name || '' : p.name || '';
}
const clockOrDay = (ms) => (Date.now() - ms < 20 * 3600e3 ? clock(ms) : ago(ms));

export async function mount(root, ctx) {
  const slug = ctx.params[0] || (matchMedia('(max-width: 760px)').matches ? null : 'all-hands');
  const ui = { draft: '', busy: false, pending: null };
  let mounted = true;
  try { ui.draft = sessionStorage.getItem('cos.ask') || ''; sessionStorage.removeItem('cos.ask'); } catch { /* */ }
  let data = null;
  const load = async () => {
    const [state, th, cur] = await Promise.all([cosApi(ctx, 'GET', 'state'), cosApi(ctx, 'GET', 'threads'), slug ? cosApi(ctx, 'GET', `threads/${encodeURIComponent(slug)}`) : null]);
    data = { state, threads: th.threads, cur };
    // the reply has landed in the thread: the pending line is done
    if (ui.pending && !ui.busy && ui.pending.mid && cur?.messages.some((m) => m.reply_to === ui.pending.mid)) ui.pending = null;
    await loadFaces(ctx, state.people);
  };
  const paint = (scroll = false) => {
    if (!mounted) return;
    const box = root.querySelector('#ct-msgs');
    const atEnd = !box || box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    const inp = root.querySelector('#ct-in');
    if (inp) ui.draft = inp.value;
    root.innerHTML = String(view(data, ctx, ui));
    const nb = root.querySelector('#ct-msgs');
    if (nb && (scroll || atEnd)) nb.scrollTop = nb.scrollHeight;
    // on a phone the page scrolls, not the list (mobile.css): open a thread at its newest message
    if (nb && scroll && matchMedia('(max-width: 760px)').matches) scrollTo(0, document.documentElement.scrollHeight);
  };
  const refresh = async () => { try { await load(); paint(); } catch (e) { ctx.toast(e.message); } };
  await load(); paint(true);
  focus(root);
  const unbind = bindCards(root, ctx, refresh);
  const send = async (text) => {
    const body = String(text || '').trim();
    if (!body || ui.busy || !slug) return;
    const who = as(ctx.wid);
    ui.busy = true; ui.draft = '';
    ui.pending = { q: body, who: (ctx.ws?.demo && data?.state?.people?.[who]?.name) || ctx.me?.user?.name || 'You', mid: null, demo: false, answer: null };
    const inp = root.querySelector('#ct-in'); if (inp) inp.value = '';
    paint(true);
    const path = `threads/${encodeURIComponent(slug)}/messages`;
    // the demo reply: to the line the brain already posted, or (nothing posted yet) the line and its reply
    const fallback = (q, { offline, message }) => (message
      ? cosApi(ctx, 'POST', `${path}/${message.id}/reply`, { offline })
      : cosApi(ctx, 'POST', path, { body, offline }));
    const st = await runAsk({
      api: ctx.api, wid: ctx.wid, q: body, extra: { thread: slug, as: who }, fallback, fallbackOnError: true, maxMs: CHAT_MAX_MS,
      alive: () => mounted,
      onState: (x) => {
        if (!mounted || !ui.pending) return;
        const posted = !ui.pending.mid && x.message?.id; // the brain posted the line: show the real one, with its time
        ui.pending.mid = x.message?.id ?? ui.pending.mid; ui.pending.demo = x.mode === 'demo';
        if (posted) refresh(); else paint(true);
      },
    }).catch((e) => ({ mode: 'demo', error: e?.message || 'The message did not send.' }));
    if (!st || !mounted) return;
    ui.busy = false;
    changed(ctx.wid);
    if (st.error) {
      ctx.toast(st.error);
      if (!st.message) ui.draft = body; // nothing was posted: give the line back
      ui.pending = null;
    } else if (ui.pending) {
      ui.pending.mid = st.message?.id ?? st.replies?.[0]?.reply_to ?? ui.pending.mid;
      // the brain's answer is posted by the Worker as the job closes; show it until the thread has it
      if (st.mode === 'brain') ui.pending.answer = { lines: st.lines, gaps: st.gaps };
      else ui.pending = null;
    }
    try { await load(); } catch (e) { ctx.toast(e.message); }
    paint(true);
    { const i = root.querySelector('#ct-in'); if (i) { i.value = ui.draft; i.focus(); } }
  };
  root.addEventListener('submit', (e) => { if (e.target.id === 'ct-form') { e.preventDefault(); send(root.querySelector('#ct-in').value); } });
  root.addEventListener('click', (e) => { const c = e.target.closest('[data-chip]'); if (c) send(c.dataset.chip); });
  const stop = live(ctx, refresh);
  return () => { mounted = false; stop(); unbind(); };
}

function focus(root) {
  let flow = null;
  try { flow = sessionStorage.getItem('cos.focus'); sessionStorage.removeItem('cos.focus'); } catch { /* */ }
  const el = flow && root.querySelector(`[data-flow="${CSS.escape(flow)}"]`);
  if (el) setTimeout(() => { el.scrollIntoView({ block: 'center' }); el.classList.add('is-flash'); setTimeout(() => el.classList.remove('is-flash'), 2400); }, 250);
}
