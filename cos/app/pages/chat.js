// chat.js: Chat, the home of work. Each module (Website, Performance, Ops, Content, Finance, Support, All hands: one
// group thread each, run by its agent) has its own chat with three tabs:
//   Tasks    the module's board (pages/feed.js boardView on js/board.js): To do, In progress, Done
//   Chat     the conversation: people and agents talk, agents drop the one decision card (js/cos.js), people ask in
//            plain words and the thread's agent answers
//   Records  the module's records (POs, invoices, QC batches, stock, orders, tasks: pages/cosos.js recordsPane)
// and one combined view, All modules, at the top of the list: every module's board merged, filterable by module.
// Routes: #/w/<wid>/chat                              the list (a phone) or All modules (a wide screen)
//         #/w/<wid>/chat/all[/records[/<kind>/<ref>]]     All modules
//         #/w/<wid>/chat/<module>[/tasks|chat|records[/<kind>/<ref>]]
// #/w/<wid>/feed and #/w/<wid>/os/... redirect here (js/app.js MOVED).
//
// The composer asks the brain the same way the ask bar does (js/ask.js runAsk, with {thread, as}): the line is posted
// in the thread, "Thinking" shows under it while the brain works, and the answer lands in the thread as the agent,
// each line with its sources as chips. When the brain is offline, fails, refuses or is too slow (CHAT_MAX_MS), the
// scripted demo reply answers instead and says so under it: a line is never left without an answer.
import { html, raw } from '../js/ui.js';
import { cosApi, live, bindCards, decisionCard, face, clock, ago, loadFaces, avatarOf, changed, sourceLabel, as } from '../js/cos.js';
import { runAsk, brainLine, demoNote, CHAT_MAX_MS } from '../js/ask.js';
import { board, fnMap, modOf, waitingBy, ALL } from '../js/board.js';
import { boardView, focusCard } from './feed.js';
import { recordsPane, TABS as KINDS } from './cosos.js';

export const title = 'Chat';
export const CHIPS = ['How are sales today?', 'What is waiting for a tap?', 'When is the launch?', 'What is the stock cover?'];
export const VIEWS = [['tasks', 'Tasks'], ['chat', 'Chat'], ['records', 'Records']];

// Pure: route params -> { scope, tab, kind, ref }. scope null = the list alone (a phone with no module open).
export function route(params = [], phone = false) {
  const [a, b, c, d] = params;
  if (!a) return { scope: phone ? null : ALL, tab: 'tasks', kind: 'all', ref: null };
  let tab = VIEWS.some(([k]) => k === b) ? b : 'tasks';
  if (a === ALL && tab === 'chat') tab = 'tasks';
  const kind = tab === 'records' && KINDS.some(([k]) => k === c) ? c : 'all';
  return { scope: a, tab, kind, ref: tab === 'records' && c ? (d || null) : null };
}

// Pure. data = {state, threads, feed: {posts, decisions}, recs: {records, decisions}, cur: thread | null, sel}
// ui = route() + {filter, draft, busy, pending, now}
export function view(data, ctx, ui = {}) {
  const { state: s, threads = [], feed = { posts: [], decisions: {} }, recs = { records: [], decisions: {} }, cur, sel } = data;
  const scope = ui.scope === undefined ? ALL : ui.scope;
  const tab = ui.tab || 'tasks';
  const wid = encodeURIComponent(ctx.wid);
  const fns = fnMap(threads);
  const wait = waitingBy(feed.decisions, fns);
  const total = Object.values(wait).reduce((a, n) => a + n, 0);
  const th = threads.find((t) => t.slug === scope) || null;
  const mods = Object.fromEntries(threads.map((t) => [t.slug, t.name]));
  const href = (sc, t) => `#/w/${wid}/chat/${encodeURIComponent(sc)}${t && t !== 'tasks' ? '/' + t : ''}`;
  const badge = (n) => (n ? html`<span class="ct-badge" title="Waiting for you">${n}</span>` : '');

  const list = html`<nav class="ct-list" aria-label="Modules">
    <a class="ct-th is-all" href="${href(ALL)}"${raw(scope === ALL ? ' aria-current="page"' : '')}>
      <span class="ct-th-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg></span>
      <span class="ct-th-n"><span>All modules</span>${badge(total)}</span>
      <span class="ct-th-p">To do, in progress and done, everywhere</span></a>
    ${threads.map((t) => html`<a class="ct-th" href="${href(t.slug)}"${raw(t.slug === scope ? ' aria-current="page"' : '')}>
      ${face(t.agent || 'Chief of staff', { agent: true })}
      <span class="ct-th-n"><span title="${t.name}">${t.name}${owner(t, s) ? html` <span class="ct-own">@${owner(t, s)}</span>` : ''}</span>${badge(wait[t.slug] || 0)}</span>
      <span class="ct-th-p">${t.preview ? `${t.preview.author}: ${t.preview.body}` : t.agent}</span></a>`)}
  </nav>`;

  let main = '';
  if (scope) {
    const isAll = scope === ALL;
    const name = isAll ? 'All modules' : th ? th.name : scope;
    const tabs = (isAll ? VIEWS.filter(([k]) => k !== 'chat') : VIEWS).map(([k, l]) => html`<a href="${href(scope, k)}"${raw(k === tab ? ' aria-current="page"' : '')}>${l}${k === 'tasks' && (isAll ? total : wait[scope]) ? html` <span class="mono">${isAll ? total : wait[scope]}</span>` : ''}</a>`);
    const who = th ? html`<p class="ct-who"><span class="ct-stack">${th.fns.map((f) => f.agent).filter((a, i, all) => all.indexOf(a) === i).map((a) => html`<span title="${a}">${face(a, { agent: true, small: true })}</span>`)}</span><span class="ct-stack">${th.people.map((p) => (s.people || {})[p]?.name || p).filter((n, i, all) => n && all.indexOf(n) === i).slice(0, 8).map((n) => html`<span title="${n}">${face(n, { avatar: avatarOf(s, n), small: true })}</span>`)}</span></p>` : '';
    let body = '';
    if (tab === 'tasks') {
      const filter = isAll && ui.filter && mods[ui.filter] ? ui.filter : null;
      const b = board({ ...feed, records: recs.records }, filter || scope, fns);
      const agents = isAll ? [] : (s?.presence?.running?.agents || []).filter((a) => th?.fns.some((f) => f.agent === a.name));
      const chips = isAll ? html`<div class="wk-filter" role="group" aria-label="Module">
        <button type="button" data-mod=""${raw(filter ? '' : ' aria-pressed="true"')}>All <span class="mono">${total}</span></button>
        ${threads.map((t) => html`<button type="button" data-mod="${t.slug}"${raw(filter === t.slug ? ' aria-pressed="true"' : '')}>${t.name}${wait[t.slug] ? html` <span class="mono">${wait[t.slug]}</span>` : ''}</button>`)}
      </div>` : '';
      body = html`${chips}${boardView(b, data, ctx, { scope: isAll && !filter ? ALL : (filter || scope), mods, agents, now: ui.now })}`;
    } else if (tab === 'records') {
      const records = (recs.records || []).filter((r) => isAll || modOf(fns, r.fn) === scope);
      body = recordsPane({ state: s, records, decisions: recs.decisions, sel }, ctx, { base: `${href(scope)}/records`, kind: ui.kind || 'all' });
    } else if (cur) {
      body = convo(cur, s, ctx, ui);
    } else body = html`<p class="loading">Loading</p>`;
    main = html`<div class="ct-main is-${tab}">
      <header class="ct-head">
        <a class="ct-back linkish" href="#/w/${wid}/chat">Modules</a>
        <h2 title="${name}">${th ? face(th.agent || 'Chief of staff', { agent: true, small: true }) : ''}${name}</h2>
        ${who}
        <nav class="ct-tabs" aria-label="${name}">${tabs}</nav>
      </header>
      <div class="ct-body">${body}</div>
    </div>`;
  }
  return html`<section class="pg ct-pg">
    <div class="ct${scope ? ' has-thread' : ''}">${list}${main}</div>
  </section>`;
}

// the conversation: messages, the pending line, the composer
function convo(cur, s, ctx, ui) {
  const sx = { ...s, wid: ctx.wid };
  const t = cur.thread;
  const canPost = ['member', 'admin', 'owner'].includes(ctx.role);
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
  return html`<ul class="ct-msgs" id="ct-msgs">${cur.messages.length || p ? html`${cur.messages.map(msg)}${pend}` : html`<li class="muted">No messages yet.</li>`}</ul>
    ${canPost ? html`<form class="ct-comp" id="ct-form" autocomplete="off">
      <div class="ct-chips">${CHIPS.map((c) => html`<button type="button" data-chip="${c}"${raw(ui.busy ? ' disabled' : '')}>${c}</button>`)}</div>
      <div class="ct-row"><label class="sr" for="ct-in">Message</label><input id="ct-in" maxlength="2000" placeholder="Ask in plain words, or say what to do" value="${ui.draft || ''}"><button class="btn is-primary" type="submit"${ui.busy ? ' disabled' : ''}>Send</button></div>
    </form>` : html`<p class="ct-comp muted">Viewers read everything; a member can ask.</p>`}`;
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

const FILTER = (wid) => `cos.mod.${wid}`;

export async function mount(root, ctx) {
  const phone = matchMedia('(max-width: 760px)').matches;
  const ui = { ...route(ctx.params, phone), draft: '', busy: false, pending: null, filter: null };
  try { ui.filter = sessionStorage.getItem(FILTER(ctx.wid)) || null; } catch { /* */ }
  // a presenter beat that pre-fills a question opens the module's conversation
  try {
    ui.draft = sessionStorage.getItem('cos.ask') || '';
    if (ui.draft && ui.scope && ui.scope !== ALL && !ctx.params[1]) ui.tab = 'chat';
    sessionStorage.removeItem('cos.ask');
  } catch { /* */ }
  const slug = ui.scope && ui.scope !== ALL ? ui.scope : null;
  let mounted = true, data = null;
  const load = async () => {
    const need = ui.scope && ui.tab === 'tasks';
    const [state, th, feed, recs, cur, sel] = await Promise.all([
      cosApi(ctx, 'GET', 'state'), cosApi(ctx, 'GET', 'threads'),
      cosApi(ctx, 'GET', 'feed'),
      need || ui.tab === 'records' ? cosApi(ctx, 'GET', 'records') : null,
      slug && ui.tab === 'chat' ? cosApi(ctx, 'GET', `threads/${encodeURIComponent(slug)}`) : null,
      ui.tab === 'records' && ui.ref ? cosApi(ctx, 'GET', `records/${encodeURIComponent(ui.ref)}`).catch(() => null) : null,
    ]);
    data = { state, threads: th.threads, feed, recs: recs || { records: [], decisions: {} }, cur, sel };
    // the reply has landed in the thread: the pending line is done
    if (ui.pending && !ui.busy && ui.pending.mid && cur?.messages.some((m) => m.reply_to === ui.pending.mid)) ui.pending = null;
    await loadFaces(ctx, state.people);
  };
  // a fresh copy seeds on its first read; a read that raced it comes back empty, so look again shortly
  const settle = async () => { for (let i = 0; i < 4 && !(data.feed?.posts || []).length && data.state?.presence; i++) { await new Promise((r) => setTimeout(r, 1200)); await load(); } };
  const paint = (scroll = false) => {
    if (!mounted) return;
    const open = new Set([...root.querySelectorAll('details[open]')].map((d) => d.closest('[id]')?.id + '|' + d.className));
    const box = root.querySelector('#ct-msgs');
    const atEnd = !box || box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    const inp = root.querySelector('#ct-in');
    if (inp) ui.draft = inp.value;
    root.innerHTML = String(view(data, ctx, ui));
    for (const d of root.querySelectorAll('details')) if (open.has(d.closest('[id]')?.id + '|' + d.className)) d.open = true;
    const nb = root.querySelector('#ct-msgs');
    if (nb && (scroll || atEnd)) nb.scrollTop = nb.scrollHeight;
    // on a phone the page scrolls, not the list (mobile.css): open a thread at its newest message
    if (nb && scroll && phone) scrollTo(0, document.documentElement.scrollHeight);
    if (ui.ref && scroll && matchMedia('(max-width: 1100px)').matches) root.querySelector('.os2-det')?.scrollIntoView({ block: 'start' });
  };
  const refresh = async () => { try { await load(); paint(); } catch (e) { ctx.toast(e.message); } };
  await load(); await settle(); paint(true);
  if (ui.tab === 'tasks') focusCard(root); else if (ui.tab === 'chat') focusFlow(root);
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
  root.addEventListener('click', async (e) => {
    const c = e.target.closest('[data-chip]');
    if (c) { send(c.dataset.chip); return; }
    const m = e.target.closest('[data-mod]');
    if (m) {
      ui.filter = m.dataset.mod || null;
      try { if (ui.filter) sessionStorage.setItem(FILTER(ctx.wid), ui.filter); else sessionStorage.removeItem(FILTER(ctx.wid)); } catch { /* */ }
      paint(); return;
    }
    // a record's approve, check or reject (the Records tab)
    const b = e.target.closest('[data-rec]');
    if (b) {
      b.disabled = true;
      try {
        await cosApi(ctx, 'POST', `records/${encodeURIComponent(b.dataset.ref)}/${b.dataset.rec}`, {});
        changed(ctx.wid);
        ctx.toast(b.dataset.rec === 'check' ? 'Checked. The card shows it everywhere.' : b.dataset.rec === 'approve' ? 'Approved. Someone else checks it next.' : 'Rejected.');
      } catch (err) { ctx.toast(err.message); }
      await refresh();
    }
  });
  const stop = live(ctx, refresh);
  return () => { mounted = false; stop(); unbind(); };
}

function focusFlow(root) {
  let flow = null;
  try { flow = sessionStorage.getItem('cos.focus'); sessionStorage.removeItem('cos.focus'); } catch { /* */ }
  const el = flow && root.querySelector(`[data-flow="${CSS.escape(flow)}"]`);
  if (el) setTimeout(() => { el.scrollIntoView({ block: 'center' }); el.classList.add('is-flash'); setTimeout(() => el.classList.remove('is-flash'), 2400); }, 250);
}
