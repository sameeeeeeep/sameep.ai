// cos.js: what the four Chief of Staff surfaces (Feed, Chat, OS, Hub) share. The worker side is
// d2c-clone-app/src/modules/cos.js (section `cos`).
//
//   decisionCard(d, s)   THE decision card. Every surface renders a card with this one function, from the same
//                        decision object, so a tap in one surface shows the same state in all four.
//   bindCards(root, ctx, refresh)   one delegated handler for every card's buttons (decide, check, send back)
//   presence(s)          Running / Managing / Monitoring, the always-on strip
//   planStrip(plan)      the launch plan, with what moved
//   knock(moved, launch) the knock-on of a re-plan
//   live(ctx, fn)        calls fn when anything changes (pulse poll + other tabs), returns stop()
//   as / setAs           who is tapping: in a demo workspace the presenter taps as a person of the world
// Pure view functions take plain data and return html``; nothing touches the DOM at import time.
import { html, raw, esc } from './ui.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ---------------------------------------------------------------- who is tapping (demo personas)
const KEY = (wid) => `cos.as.${wid}`;
export const as = (wid) => { try { return globalThis.localStorage?.getItem(KEY(wid)) || 'founder'; } catch { return 'founder'; } };
export function setAs(wid, role) {
  try { globalThis.localStorage?.setItem(KEY(wid), role); } catch { /* this visit only */ }
  globalThis.dispatchEvent?.(new CustomEvent('cos:as', { detail: { wid, role } }));
}

// ctx.api with the persona attached: GETs as ?as=, POSTs in the body
export function cosApi(ctx, method, path, body) {
  const who = as(ctx.wid);
  if (method === 'GET') return ctx.api('GET', `/w/${ctx.wid}/cos/${path}${path.includes('?') ? '&' : '?'}as=${encodeURIComponent(who)}`);
  return ctx.api(method, `/w/${ctx.wid}/cos/${path}`, { ...(body || {}), as: who });
}

// ---------------------------------------------------------------- live: one tap updates every surface
// Polls GET cos/pulse every 3 s while the page is visible, and listens to taps in other tabs (BroadcastChannel).
export function live(ctx, onChange, every = 3000) {
  let v = null, stopped = false, t = null;
  const ch = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`cos-${ctx.wid}`) : null;
  const tick = async () => {
    if (stopped) return;
    if (globalThis.document?.visibilityState !== 'hidden') {
      try {
        const r = await ctx.api('GET', `/w/${ctx.wid}/cos/pulse`);
        if (v !== null && r.v !== v) onChange();
        v = r.v;
      } catch { /* next tick */ }
    }
    t = setTimeout(tick, every);
  };
  tick();
  if (ch) ch.onmessage = () => onChange();
  const onAs = (e) => { if (e.detail?.wid === ctx.wid) onChange(); };
  globalThis.addEventListener?.('cos:as', onAs);
  return () => { stopped = true; clearTimeout(t); if (ch) ch.close(); globalThis.removeEventListener?.('cos:as', onAs); };
}
// tell the other tabs (and this one's pulse) that something changed
export function changed(wid) {
  try { const c = new BroadcastChannel(`cos-${wid}`); c.postMessage(1); c.close(); } catch { /* single tab */ }
}

// ---------------------------------------------------------------- formatting
export function ago(ms, now = Date.now()) {
  if (!ms) return 'never';
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}
export const clock = (ms) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
export const dateShort = (iso) => { const d = new Date(String(iso) + 'T00:00:00Z'); return Number.isNaN(d.getTime()) ? '' : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };
export const rs = (n) => (n == null ? '' : '₹' + Math.round(n).toLocaleString('en-IN'));
export const initials = (name) => String(name || '?').replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
const SOURCE_KIND = { whatsapp: 'WhatsApp', email: 'Email', meeting: 'Meeting', connector: 'Connector', vendor: 'Vendor', agent: 'Agent' };
export function sourceLabel(src) {
  if (!src) return '';
  const [k, ...rest] = String(src).split(':');
  return rest.length ? `${SOURCE_KIND[k] || k}: ${rest.join(':')}` : (SOURCE_KIND[k] || k);
}

// a face: avatar (blob URL once loaded) or initials. Agents get a square mark.
export const faces = new Map(); // avatar path -> object URL
export function face(name, { avatar = null, agent = false, small = false } = {}) {
  if (agent) return html`<span class="cs-face is-agent${small ? ' is-sm' : ''}" aria-hidden="true">${raw(AGENT_MARK)}</span>`;
  const src = avatar && faces.get(avatar);
  return html`<span class="cs-face${small ? ' is-sm' : ''}" aria-hidden="true">${src ? raw(`<img src="${esc(src)}" alt="">`) : initials(name)}</span>`;
}
const AGENT_MARK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="7" width="14" height="11" rx="3"/><path d="M12 4v3M9.5 12h.01M14.5 12h.01"/></svg>';
export async function loadFaces(ctx, people) {
  const paths = [...new Set(Object.values(people || {}).map((p) => p.avatar).filter((p) => p && !faces.has(p)))];
  await Promise.all(paths.map(async (p) => {
    try {
      const { apiBase, token } = await import('./api.js');
      const r = await fetch(apiBase() + p, { headers: { authorization: `Bearer ${token.get()}` } });
      if (r.ok) faces.set(p, URL.createObjectURL(await r.blob()));
    } catch { /* initials */ }
  }));
}
export const avatarOf = (s, name) => Object.values(s?.people || {}).find((p) => p.name === name)?.avatar || null;

// ---------------------------------------------------------------- the decision card
export const STATUS = { open: 'Needs a tap', to_check: 'Needs a check', done: 'Done', sent_back: 'Sent back' };
const KIND = { approve: 'Approval', choose: 'Decision', ask: 'The agent asks', conflict: 'Two views' };

// d: a decision from the worker. s: {people, tappers} from GET cos/state (for faces and "tap as" names).
// opts.compact: the one-line form used under a decided post.
export function decisionCard(d, s = {}, opts = {}) {
  if (!d) return '';
  const chosen = d.options.find((o) => o.key === d.chosen);
  const tapper = (role) => (s.tappers || []).find((t) => t.role === role);
  const meRole = d.can?.as;
  // who can tap when the current persona cannot: the named person, else the founder
  const deciderRole = d.decider?.role || 'founder';
  const tapAs = d.can?.decide ? null : (d.status === 'open' && s.demo !== false ? tapper(deciderRole) : null);
  const checkAs = d.can?.check ? null : (d.status === 'to_check' && s.demo !== false ? pickChecker(d, s) : null);
  if (opts.compact) {
    return html`<a class="cs-ref" href="#" data-open-dec="${d.id}">${statusDot(d.status)}<span>${d.title}</span>${chosen ? html`<span class="muted">${chosen.label}</span>` : ''}</a>`;
  }
  const opt = (o) => {
    const isChosen = d.chosen === o.key;
    const moves = o.knock && d.launch_now != null && o.knock.launch !== d.launch_now;
    const meta = [o.cost && html`<span class="mono">${o.cost}</span>`, o.knock && (moves || d.launch_now !== 42) && html`<span class="mono">Launch day ${o.knock.launch}</span>`].filter(Boolean);
    let btn = '';
    if (d.status === 'open' && (d.can?.decide || tapAs)) {
      const label = d.kind === 'approve' ? 'Approve' : d.kind === 'ask' ? 'Answer' : 'Pick';
      const who = tapAs ? ` as ${short(tapAs)}` : '';
      btn = html`<button class="btn is-small${o.recommended ? ' is-primary' : ''}" type="button" data-dec="decide" data-id="${d.id}" data-v="${d.version}" data-opt="${o.key}"${tapAs ? html` data-as="${tapAs.role}"` : ''}>${label}${who}</button>`;
    }
    return html`<li class="cs-opt${o.recommended ? ' is-rec' : ''}${isChosen ? ' is-chosen' : ''}${d.chosen && !isChosen ? ' is-not' : ''}">
      <div class="cs-opt-t"><b>${o.label}</b>${o.recommended ? html`<span class="cs-rec">Recommended</span>` : ''}${isChosen ? html`<span class="cs-rec is-chosen">Chosen</span>` : ''}</div>
      ${o.detail ? html`<p class="cs-opt-d">${o.detail}</p>` : ''}
      ${meta.length ? html`<p class="cs-opt-m">${meta}</p>` : ''}
      ${btn}
    </li>`;
  };
  const who = [
    d.decider && html`<span>${d.kind === 'ask' ? 'Asked' : 'Decides'}: <b>${d.decider.name}</b></span>`,
    d.checker && html`<span>Checks: <b>${d.checker.name}</b> or anyone but the decider</span>`,
  ].filter(Boolean);
  const done = [
    d.decided_by && html`<span>${statusDot('done')}${d.decided_by} ${d.kind === 'approve' ? 'approved' : d.kind === 'ask' ? 'answered' : 'chose'} <span class="mono">${clockOrAgo(d.decided_ts)}</span></span>`,
    d.checked_by && html`<span>${statusDot('done')}${d.checked_by} checked <span class="mono">${clockOrAgo(d.checked_ts)}</span></span>`,
  ].filter(Boolean);
  return html`<article class="cs-card is-${d.status}" id="dec-${d.id}" data-flow="${d.flow}">
    <header class="cs-card-h">
      <span class="cs-kind">${KIND[d.kind] || 'Decision'}</span>
      <span class="cs-fn">${d.fn_name}</span>
      <span class="cs-st is-${d.status}">${STATUS[d.status] || d.status}</span>
    </header>
    <h3 class="cs-title">${d.title}</h3>
    ${d.why ? html`<p class="cs-why">${d.why}</p>` : ''}
    ${d.numbers.length ? html`<dl class="cs-nums">${d.numbers.map((n) => html`<div><dt>${n.label}</dt><dd class="mono">${n.value}</dd>${n.source ? html`<dd class="cs-src">${n.source.name} · ${ago(n.source.fetched)}</dd>` : ''}</div>`)}</dl>` : ''}
    ${d.positions.length ? html`<ul class="cs-pos">${d.positions.map((p) => html`<li>${face(p.name, { avatar: avatarOf(s, p.name), small: true })}<span><b>${p.name}</b> wants <b>${d.options.find((o) => o.key === p.option)?.label || p.option}</b><br><span class="muted">${p.note}</span></span></li>`)}</ul>` : ''}
    <ul class="cs-opts">${d.options.map(opt)}</ul>
    ${d.knock && d.knock.moved ? knock(d.knock.moved, d.knock.launch) : ''}
    ${d.note ? html`<p class="cs-note">${d.note}</p>` : ''}
    ${d.status === 'to_check' ? html`<div class="cs-check">
      <p>${d.decided_by} decided. ${d.checker ? `${d.checker.name} or anyone else checks it before it goes out.` : 'A second person checks it.'}</p>
      <div class="cs-acts">
        ${d.can?.check || checkAs ? html`<button class="btn is-small is-primary" type="button" data-dec="check" data-id="${d.id}" data-v="${d.version}"${checkAs ? html` data-as="${checkAs.role}"` : ''}>Check${checkAs ? ` as ${short(checkAs)}` : ''}</button>
        <button class="btn is-small" type="button" data-dec="back" data-id="${d.id}" data-v="${d.version}"${checkAs ? html` data-as="${checkAs.role}"` : ''}>Send back</button>` : html`<span class="muted">${meRole ? 'The person who decided cannot check it.' : ''}</span>`}
      </div>
    </div>` : ''}
    <footer class="cs-card-f">
      ${done.length ? done : who}
      ${d.record ? html`<a class="cs-rec-chip" href="#/w/${s.wid || ''}/os/${d.record.kind || 'all'}/${encodeURIComponent(d.record.ref)}">${raw(stepper(d.record.status))}<span class="mono">${d.record.ref}</span></a>` : ''}
      ${d.source ? html`<span class="cs-from">From ${SOURCE_KIND[d.source.kind] || d.source.kind}: ${d.source.from}</span>` : ''}
    </footer>
  </article>`;
}
// a person's first name; a role that is not a person yet ("External accountant") keeps its whole label
const short = (t) => (t.name === t.title || /\(|accountant|hiring|to hire/i.test(t.name) ? t.name : t.name.split(' ')[0]);
const clockOrAgo = (ms) => (ms && Date.now() - ms < 86400e3 ? clock(ms) : ago(ms));
const statusDot = (st) => html`<i class="cs-dot is-${st}" aria-hidden="true"></i>`;

// someone other than the decider, preferring the named checker
function pickChecker(d, s) {
  const t = s.tappers || [];
  const named = d.checker && t.find((x) => x.role === d.checker.role && x.name !== d.decided_by);
  return named || t.find((x) => x.name !== d.decided_by && x.role === 'cos') || t.find((x) => x.name !== d.decided_by) || null;
}

// draft -> approved -> checked, as three dots (held and rejected shown on the second)
export function stepper(status) {
  const i = { draft: 0, approved: 1, held: 1, rejected: 1, checked: 2 }[status] ?? 0;
  const dots = [0, 1, 2].map((k) => `<i class="${k <= i ? 'on' : ''}${k === 1 && (status === 'held' || status === 'rejected') ? ' is-' + status : ''}"></i>`).join('');
  return `<span class="cs-step" title="${esc(status)}" aria-label="${esc(status)}">${dots}</span>`;
}

// the knock-on of a re-plan: what moved, from which day to which
export function knock(moved, launch) {
  if (!moved || !moved.length) return '';
  const l = launch || {};
  return html`<div class="cs-knock">
    <p class="cs-knock-h">${l.to != null && l.from != null && l.to !== l.from ? html`Launch <span class="mono">day ${l.from}</span> to <span class="mono">day ${l.to}</span>` : html`Launch holds <span class="mono">day ${l.to ?? 42}</span>${l.slack != null ? html`, slack <span class="mono">${l.slack} d</span>` : ''}`}<span class="muted"> · ${moved.length} moved</span></p>
    <ul>${moved.slice(0, 8).map((m) => html`<li><span>${m.title}</span><span class="mono">${m.from} → ${m.to}</span></li>`)}</ul>
  </div>`;
}

// ---------------------------------------------------------------- presence and the plan
export function presence(s) {
  const p = s?.presence;
  if (!p) return '';
  const m = p.managing, mo = p.monitoring;
  return html`<section class="cs-pres" aria-label="What the chief of staff is doing">
    <details class="cs-pres-i"><summary><span class="cs-live" aria-hidden="true"></span><span class="cs-pres-l">Running</span><b class="mono">${p.running.n}</b><span class="cs-pres-s">agents</span></summary>
      <ul class="cs-pres-list">${p.running.agents.slice(0, 14).map((a) => html`<li>${face(a.name, { agent: true, small: true })}<span><b>${a.name}</b><span class="muted">${a.now}</span></span>${a.ts ? html`<span class="mono muted">${ago(a.ts)}</span>` : ''}</li>`)}</ul></details>
    <details class="cs-pres-i"><summary><span class="cs-pres-l">Managing</span><b class="mono">${m.open + m.to_check}</b><span class="cs-pres-s">cards</span><b class="mono">${m.drafts + m.approved}</b><span class="cs-pres-s">records in flight</span></summary>
      <ul class="cs-pres-list"><li><span>Waiting for a tap</span><b class="mono">${m.open}</b></li><li><span>Waiting for a check</span><b class="mono">${m.to_check}</b></li><li><span>Drafts</span><b class="mono">${m.drafts}</b></li><li><span>Approved, not checked</span><b class="mono">${m.approved}</b></li><li><span>On hold</span><b class="mono">${m.held}</b></li></ul></details>
    <details class="cs-pres-i"><summary><span class="cs-pres-l">Monitoring</span><b class="mono">${mo.monitors}</b><span class="cs-pres-s">numbers</span>${mo.breaches ? html`<b class="mono cs-warn">${mo.breaches}</b><span class="cs-pres-s">off track</span>` : ''}</summary>
      <p class="cs-pres-note">${mo.connectors} connectors watched. Open the Hub for every number with its source.</p></details>
  </section>`;
}

export function planStrip(plan, wid = '') {
  if (!plan) return '';
  const ms = plan.milestones || [];
  const lo = 18, hi = Math.max(plan.launch + 2, 46);
  const x = (d) => ((Math.min(Math.max(d, lo), hi) - lo) / (hi - lo)) * 100;
  const moved = ms.filter((m) => m.day !== m.base);
  return html`<section class="cs-plan" aria-label="Launch plan">
    <div class="cs-plan-h">
      <span class="cs-pres-l">Launch</span><b class="mono">day ${plan.launch}</b><span class="mono muted">${dateShort(plan.launch_date)}</span>
      <span class="mono muted">${plan.launch - 18} days to go</span>
      <span class="mono${plan.slack === 0 ? ' cs-warn' : ' muted'}">slack ${plan.slack} d</span>
      ${plan.launch !== plan.base ? html`<span class="mono cs-warn">planned day ${plan.base}</span>` : ''}
    </div>
    <div class="cs-axis" role="img" aria-label="${`Milestones from today (day 18) to launch (day ${plan.launch})`}">
      <span class="cs-axis-today" style="left:0%">Today</span>
      ${ms.filter((m) => m.day >= lo).map((m) => html`<i class="cs-ms${m.day !== m.base ? ' is-moved' : ''}${m.key === 'launch' ? ' is-launch' : ''}" style="left:${x(m.day).toFixed(1)}%" title="${m.title}: day ${m.day}${m.day !== m.base ? ` (was ${m.base})` : ''}"></i>`)}
    </div>
    ${moved.length ? html`<p class="cs-plan-moved"><span class="muted">Moved:</span> ${moved.slice(0, 5).map((m, i) => html`${i ? ' · ' : ''}${m.title} <span class="mono">${m.base}→${m.day}</span>`)}</p>` : html`<p class="cs-plan-moved muted">Nothing has moved. ${ms.length} milestones, each with an owner.</p>`}
  </section>`;
}

// the persona switcher (demo workspaces): who the presenter taps as
export function personaPicker(s, wid) {
  if (!s?.demo || !(s.tappers || []).length) return '';
  const cur = as(wid);
  return html`<label class="cs-as"><span>Tapping as</span><select data-as-pick>${s.tappers.map((t) => html`<option value="${t.role}"${t.role === cur ? ' selected' : ''}>${t.name === t.title ? t.name : `${t.name}, ${t.title}`}</option>`)}</select></label>`;
}

// ---------------------------------------------------------------- binding the card's buttons (one handler for all)
// refresh(): re-fetch and re-render the surface. Also handles "tap as X" (switch persona, then tap).
export function bindCards(root, ctx, refresh) {
  const onClick = async (e) => {
    const b = e.target.closest('[data-dec]');
    if (!b || !root.contains(b)) return;
    e.preventDefault();
    if (b.dataset.as) setAs(ctx.wid, b.dataset.as);
    const id = b.dataset.id, version = Number(b.dataset.v);
    let body = { version }, path = '';
    if (b.dataset.dec === 'decide') { path = `decisions/${id}/decide`; body.option = b.dataset.opt; }
    else if (b.dataset.dec === 'check') path = `decisions/${id}/check`;
    else {
      const reason = globalThis.prompt?.('Why does it go back? (one line)');
      if (!reason) return;
      path = `decisions/${id}/send-back`; body.reason = reason;
    }
    b.disabled = true;
    try {
      await cosApi(ctx, 'POST', path, body);
      changed(ctx.wid);
      ctx.toast?.(b.dataset.dec === 'decide' ? 'Done. Every surface shows it now.' : b.dataset.dec === 'check' ? 'Checked. Released.' : 'Sent back.');
    } catch (err) {
      ctx.toast?.(err.message);
    }
    await refresh();
  };
  const onChange = (e) => {
    const sel = e.target.closest('[data-as-pick]');
    if (sel && root.contains(sel)) setAs(ctx.wid, sel.value);
  };
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  return () => { root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); };
}

// a little page header used by all four surfaces
export function head(title, sub, s, wid, extra = '') {
  return html`<div class="cs-top">
    <div><h1 class="pg-h">${title}${s?.demo ? html` <span class="sample-tag">Sample data</span>` : ''}</h1>${sub ? html`<p class="pg-sub">${sub}</p>` : ''}</div>
    <div class="cs-top-r">${extra}${personaPicker(s, wid)}</div>
  </div>`;
}

// ---------------------------------------------------------------- one tap, outside the full card
// The one button a compact row carries: the recommended option (else the first), or Check. In a demo workspace a
// persona who cannot tap it taps as the person who can, the same rule the full card uses. null when no one here can.
export function quickAct(d, s = {}) {
  if (!d) return null;
  const tapper = (role) => (s.tappers || []).find((t) => t.role === role);
  if (d.status === 'to_check') {
    const as = d.can?.check ? null : (s.demo !== false ? pickChecker(d, s) : null);
    if (!d.can?.check && !as) return null;
    return { dec: 'check', id: d.id, v: d.version, as: as?.role || null, label: 'Check', who: as ? short(as) : '' };
  }
  if (d.status !== 'open') return null;
  const o = d.options.find((x) => x.recommended) || d.options[0];
  if (!o) return null;
  const as = d.can?.decide ? null : (s.demo !== false ? tapper(d.decider?.role || 'founder') : null);
  if (!d.can?.decide && !as) return null;
  const verb = d.kind === 'approve' ? 'Approve' : d.kind === 'ask' ? 'Answer' : 'Pick';
  return { dec: 'decide', id: d.id, v: d.version, opt: o.key, as: as?.role || null, verb, label: o.label, who: as ? short(as) : '' };
}
// the button for quickAct(); same data-dec attributes as the card's own, so bindCards handles it
export function quickBtn(a, cls = 'is-primary', text = null) {
  if (!a) return '';
  return html`<button class="btn is-small ${cls}" type="button" data-dec="${a.dec}" data-id="${a.id}" data-v="${a.v}"${a.opt ? html` data-opt="${a.opt}"` : ''}${a.as ? html` data-as="${a.as}"` : ''}>${text || (a.dec === 'check' ? 'Check' : a.verb)}</button>`;
}
