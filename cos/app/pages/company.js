// company.js: the whole company as agents and people run it together. Two views:
//   Map       every function: its people (avatar or initials), its agent, its connectors, its open cards and its
//             edge cases. Pick a person to see what they own.
//   Timeline  the 45-day lipstick story (sample product): what each agent did, what each person did, and every
//             tap (approve, check, send back, decide), with today marked.
// API: GET /d2c-api/w/:wid/world (members only; d2c-clone-app src/modules/world.js). Avatars come from
// /w/:wid/world/avatar/:key with the session token, so a public demo copy (no avatars) shows initials.
// view() is pure; mount() fetches and binds.
import { html, raw, sampleTag, day } from '../js/ui.js';
import { apiBase, token } from '../js/api.js';
import { faceSrc, curWs } from '../js/look.js';

export const title = 'Company';

const COL = { plan: 'Plan', final: 'Final', in_progress: 'In progress', revision: 'Revision', done: 'Done' };
const TAP = { approve: 'Approved', check: 'Checked', send_back: 'Sent back', decide: 'Decided' };
const SRC = { meeting: 'Meeting', whatsapp: 'WhatsApp', email: 'Email', agent: 'Agent', connector: 'Connector' };
const FILTERS = [['all', 'Everything'], ['agent', 'Agents'], ['person', 'People'], ['tap', 'Taps']];

const source = (s) => {
  if (!s) return '';
  const [k, ...r] = String(s).split(':');
  return SRC[k] ? (r.length ? `${SRC[k]}: ${r.join(':').trim()}` : SRC[k]) : s;
};
// an agent's mark: a square chip (people are round faces)
const AG = raw('<span class="co-a" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="4" y="4" width="8" height="8" rx="1.5"/><path d="M6.5 2v2M9.5 2v2M6.5 12v2M9.5 12v2M2 6.5h2M2 9.5h2M12 6.5h2M12 9.5h2"/></svg></span>');
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

// a face: the avatar once loaded, else initials. p = {name, initials, avatar, placeholder}
export function face(p, av = {}, size = '') {
  if (!p) return '';
  // the loaded avatar, else the brand's illustrated face (a sample brand's, or a private brand's from its pack)
  const src = (p.avatar && av[p.avatar]) || faceSrc(curWs(), p.name);
  return html`<span class="co-face${size ? ' is-' + size : ''}${p.placeholder ? ' is-open' : ''}" title="${p.name}">${
    src ? html`<img src="${src}" alt="">` : html`<span aria-hidden="true">${p.initials}</span>`}</span>`;
}

function fnTile(f, data) {
  const ppl = data.people || {}, av = data.av || {};
  const open = f.open || [];
  const waiting = open.filter((c) => c.col === 'plan' || c.col === 'revision').length;
  const hit = data.who && f.people.includes(data.who);
  const dim = data.who && !hit;
  const name = (k) => (ppl[k] ? ppl[k].name : k);
  return html`<article class="co-fn${dim ? ' is-dim' : ''}${hit ? ' is-hit' : ''}" id="fn-${f.key}">
    <header class="co-fn-h">
      <h3>${f.name}</h3>
      <span class="co-n">${plural(open.length, 'open card')}</span>
    </header>
    <div class="co-row">
      <span class="co-agent">${AG}${f.agent}</span>
    </div>
    <ul class="co-people" aria-label="People">
      ${f.people.map((k) => html`<li>${face(ppl[k], av)}<span><b>${name(k)}</b><small>${ppl[k] ? ppl[k].title : ''}</small></span></li>`)}
    </ul>
    ${f.connectors.length ? html`<p class="co-conn">${f.connectors.map((c) => html`<span class="co-c is-${c.status}" title="${c.what}">${c.name}</span>`)}</p>` : ''}
    <p class="co-cols">${['plan', 'final', 'in_progress', 'revision', 'done'].map((k) => html`<span class="${f.counts[k] ? '' : 'is-zero'}${k === 'revision' && f.counts[k] ? ' is-rev' : ''}"><b>${f.counts[k] || 0}</b>${COL[k]}</span>`)}</p>
    ${open.length || f.edges.length ? html`<details class="co-more">
      <summary>${[open.length ? plural(open.length, 'open card') : '', f.edges.length ? plural(f.edges.length, 'edge case') : ''].filter(Boolean).join(', ')}${waiting ? html` <span class="co-wait">${waiting} waiting on a person</span>` : ''}</summary>
      ${open.length ? html`<ul class="co-cards">${open.map((c) => html`<li class="co-card is-${c.col}">
        <p class="co-card-h"><span class="co-col">${COL[c.col]}</span>${c.due ? html`<span class="co-due">due ${day(c.due)}</span>` : ''}</p>
        <p class="co-card-t">${c.title}</p>
        ${c.edge ? html`<p class="co-edge-tag">Edge case: ${(f.edges.find((x) => x.key === c.edge) || {}).title || c.edge}</p>` : ''}
        <p class="co-card-p">Owner ${name(c.owner) || 'nobody'}${c.approver ? html`, approves ${name(c.approver)}` : ''}${c.checker ? html`, checks ${name(c.checker)}` : ''}${c.source ? html`. ${source(c.source)}` : ''}</p>
        ${c.note ? html`<p class="co-card-n">${c.note}</p>` : ''}
      </li>`)}</ul>` : ''}
      ${f.edges.length ? html`<h4 class="co-sub">Edge cases the agent handles</h4><ul class="co-edges">${f.edges.map((e) => html`<li><b>${e.title}</b><span>${e.what}</span></li>`)}</ul>` : ''}
      ${f.approvals.length ? html`<h4 class="co-sub">Who approves</h4><ul class="co-appr">${f.approvals.map((a) => html`<li>${a}</li>`)}</ul>` : ''}
    </details>` : ''}
  </article>`;
}

function mapView(data) {
  const ppl = data.people || {};
  const owns = (k) => (data.functions || []).filter((f) => f.people.includes(k)).length;
  const keys = Object.keys(ppl).sort((a, b) => owns(b) - owns(a) || (ppl[a].placeholder - ppl[b].placeholder));
  return html`<div class="co-who" role="group" aria-label="Show what a person runs">
      <button type="button" class="co-chip" data-who="" aria-pressed="${!data.who}">Everyone</button>
      ${keys.map((k) => html`<button type="button" class="co-chip" data-who="${k}" aria-pressed="${data.who === k}">${face(ppl[k], data.av, 'sm')}${ppl[k].name}<span class="co-chip-n">${owns(k)}</span></button>`)}
    </div>
    <div class="co-map">${(data.functions || []).map((f) => fnTile(f, data))}</div>`;
}

// who did it: agent, person, or a person's tap
function actorView(e, data) {
  const person = Object.values(data.people || {}).find((p) => p.name === e.actor);
  if (e.kind === 'agent') return html`<span class="co-who-a">${AG}${e.actor}</span>`;
  return html`<span class="co-who-p">${face(person || { name: e.actor, initials: e.actor.slice(0, 2).toUpperCase() }, data.av, 'sm')}${e.actor}</span>`;
}

export function timelineView(data) {
  const p = data.product || {};
  const all = data.timeline || [];
  const f = data.filter || 'all';
  const show = all.filter((e) => f === 'all' || (f === 'tap' ? !!e.tap : e.kind === f));
  const fnName = Object.fromEntries((data.functions || []).map((x) => [x.key, x.name]));
  const edgeOf = (fn, k) => ((data.functions || []).find((x) => x.key === fn)?.edges || []).find((x) => x.key === k)?.title || 'Edge case';
  const span = p.span || 45;
  const perDay = Array.from({ length: span + 1 }, (_, d) => all.filter((e) => e.day === d));
  const max = Math.max(1, ...perDay.map((x) => x.length));
  const days = [...new Set(show.map((e) => e.day))];
  const dateOf = (d) => (p.start ? day(new Date(Date.parse(p.start + 'T00:00:00Z') + d * 86_400_000).toISOString().slice(0, 10)) : '');
  const counts = Object.fromEntries(FILTERS.map(([k]) => [k, all.filter((e) => k === 'all' || (k === 'tap' ? !!e.tap : e.kind === k)).length]));

  return html`<div class="co-ruler" aria-label="Days of the story">
      ${perDay.map((evs, d) => {
        const ag = evs.filter((e) => e.kind === 'agent').length, pe = evs.length - ag;
        const cls = ['co-d', d === p.today ? 'is-today' : '', d > p.today ? 'is-future' : '', d === p.launch ? 'is-launch' : ''].filter(Boolean).join(' ');
        return html`<button type="button" class="${cls}" data-day="${d}"${evs.length ? '' : ' disabled'} title="Day ${d}${d === p.today ? ', today' : ''}${d === p.launch ? ', launch' : ''}: ${plural(evs.length, 'event')}">
          <span class="co-bar"><i class="is-p" style="height:${Math.round((pe / max) * 100)}%"></i><i class="is-a" style="height:${Math.round((ag / max) * 100)}%"></i></span>
          ${d === p.today ? html`<span class="co-mark">Today</span>` : d === p.launch ? html`<span class="co-mark">Launch</span>` : d % 5 === 0 ? html`<span class="co-tick">${d}</span>` : ''}
        </button>`;
      })}
    </div>
    <p class="co-legend"><span><i class="is-a"></i>Agent</span><span><i class="is-p"></i>Person</span><span>Day ${p.today} of ${span}. Launch on day ${p.launch}. After today is the plan.</span></p>
    <div class="tabs co-tabs" role="tablist">${FILTERS.map(([k, label]) => html`<button type="button" role="tab" data-filter="${k}" aria-selected="${f === k}">${label}<span class="tab-n">${counts[k]}</span></button>`)}</div>
    ${days.length ? html`<ol class="co-tl">${days.map((d) => html`<li class="co-day${d === p.today ? ' is-today' : ''}${d > p.today ? ' is-future' : ''}" id="day-${d}">
      <h3 class="co-day-h"><span class="mono">Day ${d}</span><span>${dateOf(d)}</span>${d === p.today ? html`<b class="co-now">Today</b>` : ''}${d === p.launch ? html`<b class="co-launch">Launch</b>` : ''}${d > p.today ? html`<span class="co-plan">Planned</span>` : ''}</h3>
      <ul>${show.filter((e) => e.day === d).map((e) => html`<li class="co-ev is-${e.kind}${e.tap ? ' has-tap' : ''}">
        <div class="co-ev-h">${actorView(e, data)}${e.tap ? html`<span class="co-tap is-${e.tap}">${TAP[e.tap] || e.tap}</span>` : ''}<span class="co-ev-fn">${fnName[e.fn] || e.fn}</span></div>
        <p class="co-ev-t">${e.text}</p>
        ${e.source || e.edge ? html`<p class="co-ev-s">${e.source ? html`Found in ${source(e.source)}` : ''}${e.source && e.edge ? '. ' : ''}${e.edge ? html`<span class="co-ev-edge">Edge case: ${edgeOf(e.fn, e.edge)}</span>` : ''}</p>` : ''}
      </li>`)}</ul>
    </li>`)}</ol>` : html`<p class="empty">Nothing here for this filter.</p>`}`;
}

export function view(data, ctx) {
  const t = data.totals || {};
  const p = data.product || {};
  const tab = data.tab === 'timeline' ? 'timeline' : 'map';
  const base = `#/w/${encodeURIComponent(ctx.wid)}/company`;
  const empty = !(data.functions || []).length;
  return html`<section class="pg co">
    <div class="tabs">
      <a href="${base}"${tab === 'map' ? ' aria-current="page"' : ''}>Map</a>
      <a href="${base}/timeline"${tab === 'timeline' ? ' aria-current="page"' : ''}>Lipstick timeline</a>
    </div>
    <div class="pg-top"><div>
      <h1 class="pg-h">${tab === 'map' ? 'The company' : p.name || 'The launch'} ${sampleTag(ctx.ws)}</h1>
      <p class="pg-sub">${tab === 'map'
        ? 'Every function, the people who run it and the agent that works for them. Agents draft and chase; people approve, check and decide.'
        : 'Forty-five days, from picking a manufacturer to the week after launch. Every step the agents took, every step a person took, and every tap.'}</p>
    </div></div>
    ${data.error ? html`<p class="err" role="alert">${data.error}</p>` : ''}
    ${data.loading ? html`<p class="loading">Loading</p>` : empty && !data.error ? html`<p class="empty">This workspace has no company map yet.</p>` : html`
    <div class="kpis co-kpis">
      <div class="kpi"><span class="kpi-l">Functions</span><span class="kpi-v">${t.functions || 0}</span><span class="kpi-f"><span class="kpi-d">each with its own agent</span></span></div>
      <div class="kpi"><span class="kpi-l">Open cards</span><span class="kpi-v">${t.open || 0}</span><span class="kpi-f"><span class="kpi-d">plan, final, in progress, revision</span></span></div>
      <div class="kpi"><span class="kpi-l">Agent steps so far</span><span class="kpi-v">${t.agent_steps || 0}</span><span class="kpi-f"><span class="kpi-d">${t.taps || 0} taps by people</span></span></div>
      <div class="kpi"><span class="kpi-l">Launch</span><span class="kpi-v">Day ${p.today ?? 0}</span><span class="kpi-f"><span class="kpi-d">of ${p.span || 45}, launch on day ${p.launch ?? ''}</span></span></div>
    </div>
    ${tab === 'map' ? mapView(data) : timelineView(data)}
    ${p.sample ? html`<p class="note">The product, its shades and its numbers are placeholders for this demo.</p>` : ''}`}
  </section>`;
}

export async function mount(root, ctx) {
  const s = { loading: true, tab: ctx.params[0] === 'timeline' ? 'timeline' : 'map', filter: 'all', who: '', av: {} };
  const urls = [];
  let alive = true;
  const paint = () => { if (alive) root.innerHTML = String(view(s, ctx)); };
  paint();
  try {
    Object.assign(s, await ctx.api('GET', `/w/${ctx.wid}/world`));
  } catch (e) { s.error = e.message; }
  s.loading = false;
  paint();

  // avatars need the session token, so they come in as blobs (members only; a demo copy has none)
  const paths = [...new Set(Object.values(s.people || {}).map((p) => p.avatar).filter(Boolean))];
  await Promise.all(paths.map(async (path) => {
    try {
      const r = await fetch(apiBase() + path, { headers: { authorization: `Bearer ${token.get()}` } });
      if (!r.ok) return;
      const u = URL.createObjectURL(await r.blob());
      urls.push(u); s.av[path] = u;
    } catch { /* initials stay */ }
  }));
  if (paths.length) paint();

  const onClick = (e) => {
    const who = e.target.closest('[data-who]');
    if (who) { s.who = who.dataset.who; paint(); return; }
    const flt = e.target.closest('[data-filter]');
    if (flt) { s.filter = flt.dataset.filter; paint(); return; }
    const d = e.target.closest('[data-day]');
    if (d) {
      if (s.filter !== 'all' && !(s.timeline || []).some((x) => x.day === Number(d.dataset.day) && (s.filter === 'tap' ? x.tap : x.kind === s.filter))) { s.filter = 'all'; paint(); }
      const el = root.querySelector(`#day-${Number(d.dataset.day)}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  root.addEventListener('click', onClick);
  return () => { alive = false; root.removeEventListener('click', onClick); urls.forEach((u) => URL.revokeObjectURL(u)); };
}
