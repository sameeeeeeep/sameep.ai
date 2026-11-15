// standup.js: the standup the chief of staff runs itself. Each morning at 9:00 India time (and on demand) it reads
// the boards, tasks, decisions and the Inbox, writes per person what is done, doing and blocked and per area what
// moved, reads it aloud (the browser's speech, with the transcript on screen), posts it to All hands and asks each
// person one thing: any blockers? One tap answers. The weekly recap works the same way over seven days.
// Decision walkthroughs: an open card that needs explaining (more than two options, or high stakes) gets a short
// narrated slide sequence built from its own data. Watch it, then tap the card right under it.
// API: worker src/modules/standup.js (/standup), cards.js (/decisions). view() is pure; mount() fetches and binds.
import { html, raw, sampleTag, can, ago, day } from '../js/ui.js';
import { hrefFor } from '../js/app.js';
import { decisionView } from './chats.js';

export const title = 'Standup';

const AREA_ORDER = ['all-hands', 'ops', 'content', 'performance', 'website', 'finance', 'support'];
const KIND_NAME = { daily: 'Standup', weekly: 'Weekly recap' };

// 95 -> '1 min 35 s', 40 -> '40 s'
export const secs = (n) => { const s = Math.max(0, Math.round(n || 0)); return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ''}`; };
// how long the voiceover runs, at the pace the worker estimates walkthroughs (2.6 words a second)
export const scriptSeconds = (script) => Math.round((script || []).reduce((n, p) => n + String(p.text).split(/\s+/).length, 0) / 2.6);
// '#/w/x/standup/videos/12' params -> what the page shows
export function route(params) {
  const [a, b] = params || [];
  if (a === 'weekly') return { tab: 'weekly' };
  if (a === 'videos') return { tab: 'videos', video: /^\d+$/.test(b || '') ? Number(b) : null };
  if (/^\d+$/.test(a || '')) return { tab: 'one', id: Number(a) };
  return { tab: 'daily' };
}

// ---- the voiceover player and transcript ----------------------------------------------------------------

function voice(s, ui) {
  const playing = ui.voice === 'standup';
  const now = playing ? ui.part : -1;
  return html`<section class="su-voice card" aria-label="Voiceover">
    <div class="su-voice-h">
      <button class="su-play${playing ? ' is-on' : ''}" type="button" data-su="${playing ? 'stop' : 'play'}"${ui.speech ? '' : raw(' disabled title="This browser cannot read aloud. The transcript is below."')}>
        <span class="su-play-i" aria-hidden="true">${playing ? raw('<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>') : raw('<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>')}</span>
        <span>${playing ? 'Stop' : 'Play the standup'}</span></button>
      <p class="su-voice-m"><b>${s.made_by_name}</b> · ${secs(scriptSeconds(s.script))} · ${ui.speech ? 'read aloud by your browser' : 'transcript only on this browser'}${s.voice?.mode === 'server' ? ' · server voice on' : ''}</p>
    </div>
    <ol class="su-script">${s.script.map((p, i) => html`<li class="${i === now ? 'is-now' : i < now ? 'is-past' : ''}"${i === now ? raw(' aria-current="true"') : ''}>${p.text}</li>`)}</ol>
  </section>`;
}

// ---- the one question: any blockers? ----------------------------------------------------------------------

function ask(s, ctx, ui) {
  const a = s.my_ask;
  if (!a) {
    return can(ctx.role, 'member')
      ? html`<section class="su-ask is-quiet"><p>This ${s.kind === 'weekly' ? 'recap' : 'standup'} did not ask you. Write a new one and it will.</p></section>`
      : html`<section class="su-ask is-quiet"><p>Viewers read the standup. Members are asked for their blockers.</p></section>`;
  }
  const q = s.kind === 'weekly' ? 'Will anything block you next week?' : 'Anything blocking you?';
  const busy = ui.busy === 'reply';
  if (a.answer && !ui.changing) {
    return html`<section class="su-ask is-done" aria-live="polite">
      <p class="su-ask-q">${q}</p>
      <p class="su-ask-a">${a.answer === 'none' ? 'You said: no blockers.' : html`You said: <b>${a.blocker}</b>. It is in All hands, and the next standup opens with it.`}</p>
      <button class="linkish" type="button" data-su="change">Change my answer</button>
    </section>`;
  }
  return html`<section class="su-ask" aria-label="Your blockers">
    <p class="su-ask-q">${q}</p>
    <p class="su-ask-s">One tap. ${a.suggestions.length ? 'These look stuck from the boards:' : 'Nothing of yours looks stuck from the boards.'}</p>
    <div class="su-ask-b">
      <button class="btn is-primary" type="button" data-su="none"${busy ? ' disabled' : ''}>No blockers</button>
      ${a.suggestions.map((t, i) => html`<button class="btn" type="button" data-su="pick" data-i="${i}"${busy ? ' disabled' : ''}>Blocked: ${t}</button>`)}
      ${ui.other ? '' : html`<button class="btn" type="button" data-su="other"${busy ? ' disabled' : ''}>Something else</button>`}
    </div>
    ${ui.other ? html`<form class="su-other" data-su-form="other">
      <label class="sr" for="su-other">What is blocking you</label>
      <input id="su-other" name="text" maxlength="300" placeholder="What is blocking you, in a few words" required autocomplete="off">
      <button class="btn is-primary is-small" type="submit"${busy ? ' disabled' : ''}>Send</button>
      <button class="btn is-small" type="button" data-su="cancel">Cancel</button></form>` : ''}
    ${ui.err ? html`<p class="err">${ui.err}</p>` : ''}
  </section>`;
}

// ---- the numbers, the people, the areas ----------------------------------------------------------------------

function numbers(s) {
  const n = s.numbers || {};
  const tile = (l, v, sub = '') => html`<div class="kpi su-kpi"><span class="kpi-l">${l}</span><span class="kpi-v">${v}</span>${sub ? html`<span class="kpi-d">${sub}</span>` : ''}</div>`;
  return html`<div class="kpis su-kpis">
    ${tile('Done', n.done || 0)}${tile('In progress', n.doing || 0)}${tile('Blocked', n.blocked || 0)}
    ${tile('Waiting on a tap', n.taps || 0)}${tile('Decisions open', n.decisions_open || 0, n.explain ? `${n.explain} with a walkthrough` : '')}
    ${n.sales ? tile(s.kind === 'weekly' ? 'Sales, 7 days' : `Sales, ${day(n.sales.day).replace(/ \d{4}$/, '')}`, n.sales.shown, n.sales.delta == null ? '' : `${n.sales.delta > 0 ? 'Up' : n.sales.delta < 0 ? 'Down' : 'Level'} ${Math.abs(n.sales.delta)}%`) : tile('Inbox', n.inbox || 0, n.found ? `${n.found} tasks found` : '')}
  </div>`;
}

function list(label, items, total, cls) {
  return html`<div class="su-col ${cls}${total ? ' has-n' : ''}"><p class="su-col-h mono">${label} <span>${total}</span></p>
    ${items.length ? html`<ul>${items.map((t) => html`<li>${t}</li>`)}${total > items.length ? html`<li class="muted">and ${total - items.length} more</li>` : ''}</ul>` : html`<p class="su-none">Nothing</p>`}</div>`;
}

function answerChip(p) {
  const a = p.ask;
  if (!a) return '';
  if (!a.answer) return html`<span class="su-chip">Not answered</span>`;
  return a.answer === 'none' ? html`<span class="su-chip is-ok">No blockers</span>` : html`<span class="su-chip is-bad" title="${a.blocker}">Blocked</span>`;
}

function person(p, me) {
  return html`<article class="su-person card${p.email === me ? ' is-me' : ''}">
    <header><div><h3>${p.name}${p.email === me ? html` <span class="su-you mono">You</span>` : ''}</h3><p class="muted">${p.title}</p></div>${answerChip(p)}</header>
    ${p.ask?.answer === 'blocked' ? html`<p class="su-said">Said: ${p.ask.blocker}</p>` : ''}
    ${p.n.done + p.n.doing + p.n.blocked ? html`<div class="su-cols">
      ${list('Done', p.done, p.n.done, 'is-done')}${list('Doing', p.doing, p.n.doing, 'is-doing')}${list('Blocked', p.blocked, p.n.blocked, 'is-blocked')}
    </div>` : html`<p class="su-none">Nothing on the boards in this window.</p>`}
    ${p.n.taps ? html`<p class="su-taps">Waiting on ${p.email === me ? 'you' : p.name.split(' ')[0]}: ${p.taps.slice(0, 2).join('; ')}${p.n.taps > 2 ? `, and ${p.n.taps - 2} more` : ''}.</p>` : ''}
  </article>`;
}

// you first, then whoever is blocked, then the busiest
export const peopleOrder = (people, me) => [...(people || [])].sort((a, b) => (b.email === me) - (a.email === me) || b.n.blocked - a.n.blocked
  || (b.n.done + b.n.doing) - (a.n.done + a.n.doing));

function areas(s) {
  const rows = [...(s.areas || [])].sort((a, b) => (b.n_moved - a.n_moved) || AREA_ORDER.indexOf(a.slug) - AREA_ORDER.indexOf(b.slug));
  return html`<ul class="su-areas">${rows.map((a) => html`<li class="su-area">
    <div class="su-area-h"><b>${a.name}</b><span class="mono muted">${a.agent}</span></div>
    <p class="su-area-c mono">${a.counts.done} done · ${a.counts.doing} doing · ${a.counts.plan} in plan${a.counts.revision ? ` · ${a.counts.revision} sent back` : ''}${a.counts.decisions ? ` · ${a.counts.decisions} to decide` : ''}</p>
    ${a.moved.length ? html`<ul class="su-moved">${a.moved.map((m) => html`<li>${m}</li>`)}</ul>` : html`<p class="su-none">Nothing moved.</p>`}
  </li>`)}</ul>`;
}

// ---- walkthroughs ---------------------------------------------------------------------------------------

// one slide, drawn from the card's data: figures as big numbers, option votes, the vote bars
export function slideView(sl, i, n) {
  const max = Math.max(1, ...(sl.bars || []).map((b) => b.n));
  return html`<div class="su-slide is-${sl.kind}" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${n}">
    <p class="su-slide-n mono">${i + 1} / ${n}${sl.tag ? html` · ${sl.tag}` : ''}</p>
    <h3 class="su-slide-t">${sl.title}</h3>
    ${(sl.figures || []).length ? html`<div class="su-figs">${sl.figures.map((f) => html`<span class="su-fig">${f}</span>`)}</div>` : ''}
    ${(sl.lines || []).map((l) => html`<p class="su-slide-l">${l}</p>`)}
    ${sl.votes ? html`<p class="su-slide-v mono">${sl.votes.n} ${sl.votes.n === 1 ? 'vote' : 'votes'}${sl.votes.names.length ? `: ${sl.votes.names.join(', ')}` : ''}</p>` : ''}
    ${(sl.bars || []).length ? html`<ul class="su-bars">${sl.bars.map((b) => html`<li><span class="su-bar-l">${b.label}${b.recommended ? html` <span class="mono muted">recommended</span>` : ''}</span>
      <span class="su-bar"><span style="width:${Math.round((b.n / max) * 100)}%"></span></span><span class="mono">${b.n}</span></li>`)}</ul>` : ''}
  </div>`;
}

function player(v, ui) {
  const n = v.slides.length, i = Math.min(ui.slide || 0, n - 1), playing = ui.voice === `video:${v.card_id}`;
  return html`<div class="su-player">
    <div class="su-steps" aria-hidden="true">${v.slides.map((_, k) => html`<span class="${k < i ? 'is-past' : k === i ? 'is-now' : ''}"></span>`)}</div>
    ${slideView(v.slides[i], i, n)}
    <div class="su-ctl">
      <button class="btn is-small" type="button" data-su="prev"${i === 0 ? ' disabled' : ''}>Back</button>
      <button class="btn is-small is-primary" type="button" data-su="${playing ? 'vstop' : 'vplay'}"${ui.speech ? '' : raw(' disabled title="This browser cannot read aloud. Read the transcript."')}>${playing ? 'Pause' : i === 0 ? 'Play' : 'Play from here'}</button>
      <button class="btn is-small" type="button" data-su="next"${i >= n - 1 ? ' disabled' : ''}>Next</button>
      <span class="mono muted">${secs(v.seconds)} narrated</span>
    </div>
    <details class="su-trans"${ui.speech ? '' : ' open'}><summary>Transcript</summary>
      <ol>${v.slides.map((sl, k) => html`<li class="${k === i ? 'is-now' : ''}">${sl.say}</li>`)}</ol></details>
    ${ui.ended ? html`<p class="su-end">That is the walkthrough. Tap the card below.</p>` : ''}
  </div>`;
}

function videoCard(v, data, ctx, ui) {
  const open = ui.video === v.card_id;
  const full = data.full?.[v.card_id];
  const card = (data.cards || []).find((c) => c.id === v.card_id);
  const watched = (full || v).watched_by || [];
  return html`<article class="su-video card${open ? ' is-open' : ''}" id="su-v-${v.card_id}">
    <header class="su-video-h">
      <div><p class="mono muted">${v.group_name} · ${v.agent}</p><h3>${v.title}</h3><p class="su-why">Needs explaining: ${v.reason}.</p></div>
      ${open ? html`<button class="btn is-small" type="button" data-su="close">Close</button>`
        : html`<a class="btn is-small is-primary" href="${hrefFor(ctx.wid, 'standup', 'videos', v.card_id)}">Watch, ${secs(v.seconds)}</a>`}
    </header>
    ${watched.length ? html`<p class="su-watched mono">Watched by ${watched.map((w) => w.name).join(', ')}</p>` : ''}
    ${open ? (full ? player(full, ui) : html`<p class="loading">Loading the walkthrough</p>`) : ''}
    ${open && card ? html`<div class="wk su-card">${decisionView(card, ctx, ui.dc || {})}</div>` : ''}
    ${open && !card && full ? html`<p class="note">This card is no longer open. <a class="linkish" href="${hrefFor(ctx.wid, 'chats', v.group)}">Open ${v.group_name} in Work</a></p>` : ''}
  </article>`;
}

function videos(data, ctx, ui) {
  const vs = data.overview?.videos || [];
  if (!vs.length) return html`<p class="empty">No decision needs a walkthrough right now. Cards with more than two options or high stakes get one.</p>`;
  return html`<div class="su-videos">${vs.map((v) => videoCard(v, data, ctx, ui))}</div>`;
}

function history(o, s, ctx) {
  const rows = (o.history || []).filter((h) => !s || h.id !== s.id).slice(0, 8);
  if (!rows.length) return '';
  return html`<section class="su-sec"><h2 class="sec-h">Earlier</h2><ul class="su-hist">${rows.map((h) => html`<li>
    <a href="${hrefFor(ctx.wid, 'standup', h.id)}"><b>${h.title}</b><span class="muted">${h.headline}</span></a>
    <span class="mono muted">${h.made_by.startsWith('agent:') ? 'Chief of staff' : 'On demand'}${h.sample ? ' · sample' : ''}</span></li>`)}</ul></section>`;
}

// ---- the page ----------------------------------------------------------------------------------------------

export function view(data, ctx) {
  const ui = data.ui || {};
  const o = data.overview || {};
  const s = o.standup;
  const r = data.route || { tab: 'daily' };
  const nVid = (o.videos || []).length;
  const tab = (key, label, href, n = null) => html`<a href="${href}"${r.tab === key || (key === 'daily' && r.tab === 'one' && s?.kind === 'daily') || (key === 'weekly' && r.tab === 'one' && s?.kind === 'weekly') ? raw(' aria-current="page"') : ''}>${label}${n ? html` <span class="tab-n">${n}</span>` : ''}</a>`;
  const tabs = html`<nav class="tabs" aria-label="Standup">
    ${tab('daily', 'This morning', hrefFor(ctx.wid, 'standup'))}${tab('weekly', 'Weekly recap', hrefFor(ctx.wid, 'standup', 'weekly'))}${tab('videos', 'Walkthroughs', hrefFor(ctx.wid, 'standup', 'videos'), nVid)}</nav>`;
  const member = can(ctx.role, 'member');
  const runBtn = (kind) => (member ? html`<button class="btn" type="button" data-su="run" data-kind="${kind}"${ui.busy === 'run' ? ' disabled' : ''}>${kind === 'weekly' ? 'Write the recap now' : 'Write it now'}</button>` : '');

  if (r.tab === 'videos') {
    return html`<section class="pg su">${tabs}
      <div class="pg-top"><div><h1 class="pg-h">Decision walkthroughs ${sampleTag(ctx.ws)}</h1>
        <p class="pg-sub">When a decision has more than two options or high stakes, the agent builds a short narrated walkthrough from the card itself: the options, the numbers, the votes and its recommendation. Watch, then tap.</p></div></div>
      ${data.error ? html`<p class="err">${data.error}</p>` : videos(data, ctx, ui)}
    </section>`;
  }

  const kind = r.tab === 'weekly' ? 'weekly' : s?.kind || 'daily';
  if (!s) {
    return html`<section class="pg su">${tabs}
      <div class="pg-top"><div><h1 class="pg-h">${KIND_NAME[kind]} ${sampleTag(ctx.ws)}</h1>
        <p class="pg-sub">${kind === 'weekly' ? `The chief of staff writes the weekly recap on ${o.next?.weekly_day || 'Monday'} mornings.` : `The chief of staff writes the standup at ${o.next?.hour || 9}:00 ${o.next?.timezone || 'India time'}.`} None yet.</p></div>${runBtn(kind)}</div>
      ${data.error ? html`<p class="err">${data.error}</p>` : ''}
    </section>`;
  }
  const when = s.on_schedule ? `Written by the chief of staff, ${ago(s.ts, ui.now)}` : `Written on demand for ${s.made_by_name}, ${ago(s.ts, ui.now)}`;
  return html`<section class="pg su">${tabs}
    <div class="pg-top"><div><h1 class="pg-h">${s.title} ${s.sample ? sampleTag(ctx.ws) : ''}</h1>
      <p class="pg-sub">${s.headline} ${when}, from the boards, tasks, decisions and the Inbox. Posted to All hands.</p></div>${runBtn(s.kind)}</div>
    ${data.error ? html`<p class="err">${data.error}</p>` : ''}
    <div class="su-top">${voice(s, ui)}${ask(s, ctx, ui)}</div>
    ${numbers(s)}
    ${nVid && s.kind === 'daily' ? html`<p class="su-vlink"><a class="linkish" href="${hrefFor(ctx.wid, 'standup', 'videos')}">${nVid} ${nVid === 1 ? 'decision has' : 'decisions have'} a walkthrough</a> to watch before you tap.</p>` : ''}
    <section class="su-sec"><h2 class="sec-h">People <span class="mono muted">${s.answered} of ${s.asked} answered</span></h2>
      <div class="su-people">${peopleOrder(s.people, ctx.me?.user?.email).map((p) => person(p, ctx.me?.user?.email))}</div></section>
    <section class="su-sec"><h2 class="sec-h">What moved, by area</h2>${areas(s)}</section>
    ${history(o, s, ctx)}
  </section>`;
}

// ---- speech ------------------------------------------------------------------------------------------------

function pickVoice(synth) {
  const vs = synth.getVoices ? synth.getVoices() : [];
  return vs.find((v) => /en-IN/i.test(v.lang)) || vs.find((v) => /en-GB/i.test(v.lang)) || vs.find((v) => /^en/i.test(v.lang)) || null;
}
// Speaks a list of parts in order; short sentences per utterance so long parts never stall. Returns stop().
function speakParts(parts, { onPart, onDone }) {
  const synth = globalThis.speechSynthesis;
  let stopped = false, i = 0;
  synth.cancel();
  const voiceOf = pickVoice(synth);
  const next = () => {
    if (stopped) return;
    if (i >= parts.length) { onDone && onDone(); return; }
    const idx = i++;
    onPart && onPart(idx);
    const sentences = String(parts[idx]).match(/[^.!?]+[.!?]*\s*/g) || [String(parts[idx])];
    let k = 0;
    const say = () => {
      if (stopped) return;
      if (k >= sentences.length) { next(); return; }
      const u = new SpeechSynthesisUtterance(sentences[k++].trim());
      if (voiceOf) u.voice = voiceOf;
      u.rate = 1.02;
      u.onend = say;
      u.onerror = () => { if (!stopped) say(); };
      synth.speak(u);
    };
    say();
  };
  next();
  return () => { stopped = true; synth.cancel(); };
}

// ---- mount ----------------------------------------------------------------------------------------------

export async function mount(root, ctx) {
  if (typeof document !== 'undefined' && !document.querySelector('link[data-css="standup"]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = new URL('./standup.css', import.meta.url).href; l.dataset.css = 'standup';
    document.head.appendChild(l);
  }
  const W = `/w/${ctx.wid}/standup`, D = `/w/${ctx.wid}/decisions`;
  const r = route(ctx.params);
  const speech = typeof globalThis.speechSynthesis !== 'undefined' && typeof globalThis.SpeechSynthesisUtterance !== 'undefined';
  const data = { route: r, overview: null, cards: [], full: {}, ui: { speech, video: r.video || null, slide: 0, now: Date.now(), dc: {} } };
  let stop = null, alive = true;

  const paint = () => {
    if (!alive) return;
    const active = document.activeElement && root.contains(document.activeElement) ? document.activeElement.id : null;
    data.ui.now = Date.now();
    root.innerHTML = String(view(data, ctx));
    if (active) root.querySelector('#' + CSS.escape(active))?.focus();
  };
  const halt = () => { if (stop) { stop(); stop = null; } data.ui.voice = null; };

  async function loadVideo(id) {
    try {
      const [v, d] = await Promise.all([ctx.api('GET', `${W}/videos/${id}`), ctx.api('GET', `${D}?status=open`)]);
      data.full[id] = v.video; data.cards = d.cards || [];
    } catch (e) { data.error = e.message; }
    paint();
  }

  async function load() {
    try {
      const path = r.tab === 'weekly' ? `${W}?kind=weekly` : r.tab === 'one' ? `${W}/${r.id}` : W;
      data.overview = await ctx.api('GET', r.tab === 'videos' ? W : path);
      data.error = null;
    } catch (e) { data.error = e.message; }
    paint();
    if (data.ui.video) { await loadVideo(data.ui.video); document.getElementById(`su-v-${data.ui.video}`)?.scrollIntoView?.({ block: 'start' }); }
  }

  const s = () => data.overview?.standup;
  async function reply(body) {
    data.ui.busy = 'reply'; data.ui.err = null; paint();
    try {
      const res = await ctx.api('POST', `${W}/${s().id}/reply`, body);
      data.overview.standup = res.standup; data.ui.other = false; data.ui.changing = false;
      ctx.toast(body.answer === 'none' ? 'Thanks. No blockers.' : 'Blocker posted to All hands.');
    } catch (e) { data.ui.err = e.message; }
    data.ui.busy = null; paint();
  }

  function playVideo(v) {
    halt();
    data.ui.voice = `video:${v.card_id}`; data.ui.ended = false;
    const start = data.ui.slide || 0;
    stop = speakParts(v.slides.slice(start).map((x) => x.say), {
      onPart: (k) => { data.ui.slide = start + k; paint(); },
      onDone: () => {
        data.ui.voice = null; stop = null; data.ui.ended = true; paint();
        if (can(ctx.role, 'member')) ctx.api('POST', `${W}/videos/${v.card_id}/watched`).catch(() => { /* the record is a nicety */ });
      },
    });
    paint();
  }

  async function onDecision(b) {
    const id = Number(b.dataset.id), a = b.dataset.dc, ui = data.ui.dc;
    if (a === 'cancel') { ui.suggesting = null; return paint(); }
    if (a === 'suggest') { ui.suggesting = id; return paint(); }
    if (a === 'thread') { ui.dcThread = ui.dcThread === id ? null : id; return paint(); }
    if (b.disabled || (a !== 'vote' && a !== 'decide')) return;
    ui.busy = `d${id}`; paint();
    try {
      if (a === 'vote') {
        const res = await ctx.api('POST', `${D}/${id}/vote`, { option_id: Number(b.dataset.opt) });
        ctx.toast(res.card.status === 'resolved' ? 'That settled it. The agent drafted the work for a check.' : 'Vote counted.');
      } else {
        await ctx.api('POST', `${D}/${id}/decide`, { option_id: Number(b.dataset.opt), version: Number(b.dataset.version) });
        ctx.toast('Decided. The agent is drafting the work.');
      }
    } catch (e) { ctx.toast(e.message); }
    ui.busy = null;
    await loadVideo(id);
  }

  const onClick = async (e) => {
    const dc = e.target.closest('[data-dc]');
    if (dc) { onDecision(dc); return; }
    const b = e.target.closest('[data-su]');
    if (!b || b.disabled) return;
    const a = b.dataset.su;
    if (a === 'play' && s()) {
      halt(); data.ui.voice = 'standup'; data.ui.part = 0;
      stop = speakParts(s().script.map((p) => p.text), { onPart: (k) => { data.ui.part = k; paint(); root.querySelector('.su-script .is-now')?.scrollIntoView?.({ block: 'nearest' }); }, onDone: () => { data.ui.voice = null; stop = null; paint(); } });
      return paint();
    }
    if (a === 'stop' || a === 'vstop') { halt(); return paint(); }
    if (a === 'none') return reply({ answer: 'none' });
    if (a === 'pick') return reply({ answer: 'blocked', pick: Number(b.dataset.i) });
    if (a === 'other') { data.ui.other = true; paint(); root.querySelector('#su-other')?.focus(); return; }
    if (a === 'cancel') { data.ui.other = false; return paint(); }
    if (a === 'change') { data.ui.changing = true; return paint(); }
    if (a === 'run') {
      halt(); data.ui.busy = 'run'; paint();
      try {
        data.overview = await ctx.api('POST', `${W}/run`, { kind: b.dataset.kind });
        ctx.toast('Written, posted to All hands, and everyone was asked for blockers.');
        const k = data.overview.standup.kind;
        if ((k === 'weekly') !== (r.tab === 'weekly') || r.tab === 'one') ctx.go('standup', ...(k === 'weekly' ? ['weekly'] : []));
      } catch (e) { data.error = e.message; }
      data.ui.busy = null; return paint();
    }
    const v = data.full[data.ui.video];
    if (a === 'close') { halt(); data.ui.video = null; ctx.go('standup', 'videos'); return; }
    if (!v) return;
    if (a === 'vplay') return playVideo(v);
    if (a === 'prev' || a === 'next') {
      const wasPlaying = data.ui.voice === `video:${v.card_id}`;
      halt();
      data.ui.slide = Math.max(0, Math.min(v.slides.length - 1, (data.ui.slide || 0) + (a === 'next' ? 1 : -1)));
      data.ui.ended = false;
      if (wasPlaying) return playVideo(v);
      return paint();
    }
  };

  const onSubmit = async (e) => {
    const f = e.target;
    if (f.dataset.suForm === 'other') {
      e.preventDefault();
      const t = String(new FormData(f).get('text') || '').trim();
      if (t) reply({ answer: 'blocked', text: t });
      return;
    }
    const kind = f.dataset.form;
    if (kind === 'dc-suggest' || kind === 'dc-comment') {
      e.preventDefault();
      const id = Number(f.dataset.id), fd = new FormData(f);
      try {
        if (kind === 'dc-suggest') await ctx.api('POST', `${D}/${id}/suggest`, { label: fd.get('label'), detail: fd.get('detail') || '' });
        else await ctx.api('POST', `${D}/${id}/comment`, { body: fd.get('body') });
        data.ui.dc.suggesting = null;
        ctx.toast(kind === 'dc-suggest' ? 'Your option is on the card.' : 'Comment posted.');
      } catch (err) { ctx.toast(err.message); }
      await loadVideo(id);
    }
  };

  root.addEventListener('click', onClick);
  root.addEventListener('submit', onSubmit);
  await load();
  return () => { alive = false; halt(); root.removeEventListener('click', onClick); root.removeEventListener('submit', onSubmit); };
}
