// growthos.js — "Wispr Growth OS": a growth plan for Wispr Flow you can click through, as a
// Platinum control panel. Only the Wispr team see the icon (Wispr version + a teammate login).
// Content lives in growthos-data.js; anything a visitor changes stays on their device (wgos.v1).
import { h, isNarrow } from './util.js';
import { sound } from './audio.js';
import { isWispr } from '../version.js';
import { flowClean } from './apps.js';
import * as D from './growthos-data.js';
import { extraModules } from './gos/index.js';
import { loadCss, avatar } from './gos/kit.js';

// ---------------------------------------------------------------- the gate
// links from the plan data: http(s) only
const safeHttp = (u) => (/^https?:\/\//i.test(String(u || '')) ? u : '#');
const visitorOf = (v) => {
  if (v) return v;
  try { return JSON.parse(localStorage.getItem('offthecv.visitor') || 'null'); } catch { return null; }
};
const teamId = (v) => (typeof v?.character === 'string' ? v.character : v?.character?.id) || '';
export function canSeeGrowthOS(visitor) {
  return isWispr && teamId(visitorOf(visitor)).startsWith('w-');
}

// desktop hook: puts the folder icon on the desktop if this visitor is on the team
export function install({ wm, area, visitor }) {
  if (!canSeeGrowthOS(visitor)) return false;
  // top of the left column, above the projects (the right column is the system and the toys)
  const icons = area.querySelector('.icons--proj') || area.querySelector('.icons');
  if (!icons || area.querySelector('[data-app="growthos"]')) return false;
  const btn = h('button.icon.icon--gos', { type: 'button', dataset: { app: 'growthos' }, onclick: () => { sound.tick('click'); openGrowthOS(wm, { visitor }); } },
    h('img', { src: new URL('../../growth-os/icon.svg', import.meta.url).href, alt: '', width: 48, height: 48, draggable: 'false' }),
    h('span.icon__label', 'Wispr Growth OS'));
  icons.prepend(h('li.is-new', btn));
  if (fromLink) openGrowthOS(wm, { visitor });
  return true;
}

// ---------------------------------------------------------------- state (this device only)
const KEY = 'wgos.v1';
const S = (() => { try { return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return blank(); } })();
function blank() { return { status: {}, added: [], checks: {}, stars: {}, stages: {}, crm: null, ugc: [], scores: {}, board: [], drafts: [] }; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private mode: this visit only */ } };

// ---------------------------------------------------------------- sign-in (@wispr.ai only; the plan comes from the Worker)
// sameep.ai serves /api itself; local runs talk to the analytics Worker's dev server (?api= overrides)
// on sameep.ai it's always same-origin; ?api= may only pick another local Worker, never send the token elsewhere
const LOCAL_APIS = ['http://localhost:5173/api/growth', 'http://127.0.0.1:5173/api/growth', 'http://localhost:8787/api/growth'];
const API = /^(www\.)?sameep\.ai$/.test(location.hostname) ? '/api/growth'
  : LOCAL_APIS.includes(new URLSearchParams(location.search).get('api')) ? new URLSearchParams(location.search).get('api') : LOCAL_APIS[0];
const TOKEN = 'wgos.token';
const token = { get: () => { try { return localStorage.getItem(TOKEN); } catch { return null; } }, set: (t) => { try { t ? localStorage.setItem(TOKEN, t) : localStorage.removeItem(TOKEN); } catch { /* this visit only */ } } };
// a magic link lands on the site with #wgos=<token>: keep it, drop it from the address bar
const fromLink = (() => { const m = location.hash.match(/#wgos=([a-z0-9]+)/i); if (!m) return null; history.replaceState(null, '', location.pathname + location.search); if (m[1] !== 'expired') token.set(m[1]); return m[1]; })();
async function api(path, { method = 'GET', body } = {}) {
  const t = token.get();
  const r = await fetch(API + path, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(t ? { authorization: 'Bearer ' + t } : {}) }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || 'Something went wrong. Try again.'), { status: r.status });
  return d;
}
let loaded = null;
const fetchPlan = () => (loaded ||= api('/data').then((d) => { D.load(d.content); return d; }).catch((e) => { loaded = null; throw e; }));

// ---------------------------------------------------------------- helpers
// the sidebar's groups, in order; gos/*.js modules slot into these by `group`
const GROUPS = ['', 'Plan', 'Brand', 'People', 'Events', 'Run it'];
const MODULES = [
  { id: 'home', label: 'Start here', c: 'var(--vast)', group: '', render: home },
  { id: 'dash', label: 'Dashboard', c: 'var(--lime)', group: '', render: dash },
  { id: 'campaigns', label: 'Campaigns', c: 'var(--bondi)', group: 'Plan', render: campaigns },
  { id: 'brand', label: 'Brand: cool in India', c: 'var(--glow)', group: 'Brand', render: brand },
  { id: 'linkedin', label: 'LinkedIn & founders', c: 'var(--pulse)', group: 'Brand', render: linkedin },
  { id: 'creators', label: 'Creators', c: 'var(--strawberry)', group: 'People', render: creators },
  { id: 'collabs', label: 'Brand collabs', c: 'var(--grape)', group: 'People', render: collabs },
  { id: 'events', label: 'Events & popups', c: 'var(--tangerine)', group: 'Events', render: events },
  { id: 'crm', label: 'CRM', c: 'var(--plat-4)', group: 'Run it', render: crm },
  { id: 'sources', label: 'Sources', c: 'var(--line-2)', group: 'Run it', render: sources },
];
let extrasIn = false;
async function addExtras() {
  if (extrasIn) return;
  extrasIn = true;
  for (const f of ['kit', 'ideas', 'brand', 'partners', 'events', 'wrapped']) loadCss(f);
  const more = await extraModules();
  for (const m of more) if (!MODULES.some((x) => x.id === m.id)) MODULES.push({ group: 'Plan', ...m });
  // keep each group together, the original modules first within it
  MODULES.sort((a, b) => GROUPS.indexOf(a.group ?? '') - GROUPS.indexOf(b.group ?? ''));
}
const mod = (id) => MODULES.find((m) => m.id === id);
const TONES = { '#2f6fd6': 'var(--pulse)', '#e0b400': 'var(--glow)' };
const tone = (c) => TONES[c] || c;
const fmtD = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const days = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
const TODAY = new Date().toISOString().slice(0, 10);
const STATUSES = ['idea', 'approved', 'live', 'done', 'cut'];
const tag = (t, kind = t) => h('span.tag.tag--' + String(kind).toLowerCase(), t);
const sample = () => h('span.tag.tag--sample', { title: 'Made-up number to show the layout. Real numbers need Wispr data.' }, 'Sample');
const gbox = (label, ...kids) => h('section.gbox', h('h3.gbox__label', label), ...kids);
const gboxW = (label, ...kids) => h('section.gbox.gbox--white', h('h3.gbox__label', label), ...kids);
const ul = (items) => h('ul.ul', items.map((t) => h('li', rich(t))));
// "text [3]" → text + a link to source 3
function rich(t) {
  if (t == null) return null;
  const parts = String(t).split(/(\[\d+(?:,\s*\d+)*\])/g);
  return parts.map((p) => {
    const m = p.match(/^\[(\d+(?:,\s*\d+)*)\]$/);
    if (!m) return p;
    return m[1].split(/,\s*/).map((n) => { const s = D.SOURCES.find((x) => String(x.id) === n); return h('a.src', { href: safeHttp(s?.url), target: '_blank', rel: 'noopener', title: s?.t || 'Source ' + n }, '[' + n + ']'); });
  });
}
function secondOrder(so) {
  if (!so) return null;
  return h('div.so',
    h('div.so__cell', h('p.so__k', 'What it causes'), h('p.so__v', rich(so.causes))),
    h('div.so__cell.so__cell--back', h('p.so__k', 'Could backfire'), h('p.so__v', rich(so.backfire))),
    h('div.so__cell.so__cell--comp', h('p.so__k', 'How it compounds'), h('p.so__v', rich(so.compounds))),
    h('div.so__cell.so__cell--kill', h('p.so__k', 'Kill it if'), h('p.so__v', rich(so.kill))));
}
function tabs(list, onPick, start = 0) {
  const pane = h('div.gtabpane');
  const btns = list.map((t, i) => h('button.gtab', { type: 'button', role: 'tab', 'aria-selected': String(i === start), onclick: () => pick(i) }, t));
  function pick(i) { btns.forEach((b, j) => b.setAttribute('aria-selected', String(i === j))); pane.replaceChildren(...[].concat(onPick(i))); sound.tick('click'); }
  pane.append(...[].concat(onPick(start)));
  return h('div', h('div.gtabs', { role: 'tablist' }, btns), pane);
}
function select(value, options, onChange, label) {
  const s = h('select.sel', { 'aria-label': label, onchange: (e) => onChange(e.target.value) }, options.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o[0].toUpperCase() + o.slice(1)]; return h('option', { value: v, selected: v === value }, t); }));
  return s;
}
function copyBtn(getText, label = 'Copy') {
  const b = h('button.btn.btn--sm', { type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(getText()); b.textContent = 'Copied'; } catch { b.textContent = 'Select and copy'; } setTimeout(() => (b.textContent = label), 1400); } }, label);
  return b;
}
function download(name, text, type = 'text/csv') {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
const head = (m, why, ...tools) => h('header.gos__head', { style: { '--c': m.c } },
  h('div', h('p.gos__kicker', m.kicker || 'Growth OS'), h('h2.gos__title', m.label), why && h('p.gos__why', rich(why))),
  tools.length ? h('div.gos__tools', tools) : null);

// ---------------------------------------------------------------- the window
export function openGrowthOS(wm, { visitor, start } = {}) {
  const v = visitorOf(visitor);
  if (!document.getElementById('font-wispr')) document.head.append(h('link#font-wispr', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Figtree:wght@400;500;600&display=swap' }));
  const w = wm.win('growthos', { title: 'Wispr Growth OS', width: 1000, height: 680, className: 'win--gos', sheet: false });
  if (w.body.dataset.ready) { if (start) w.go?.(start); return w; }
  w.body.dataset.ready = '1';
  if (!canSeeGrowthOS(v)) {
    w.body.append(h('div.gos-lock',
      h('img', { src: new URL('../../growth-os/icon.svg', import.meta.url).href, alt: '', width: 64, height: 64 }),
      h('p.big', 'This folder is for the Wispr team.'),
      h('p', 'Log in as a Wispr teammate on the lock screen to open it.')));
    return w;
  }
  const name = (v?.name || '').split(' ')[0];
  const ready = () => addExtras().catch((e) => console.warn('[growth os] extras', e)).then(() => renderPlan(w, { name, start }));
  if (token.get()) {
    w.body.append(h('div.gos-lock', h('p.big', 'Opening the plan…')));
    fetchPlan().then(ready).catch((e) => { if (e.status === 401) token.set(null); signIn(w, ready, e.status === 401 ? 'Your session ended. Sign in again.' : e.message, name); });
  } else signIn(w, ready, fromLink === 'expired' ? 'That link has expired. Ask for a new code.' : null, name);
  return w;
}

// the email prompt inside the folder: @wispr.ai address → 6-digit code (or the magic link in the same email)
function signIn(w, done, notice, name = '') {
  // a guess from the teammate picked on the lock screen (firstname@wispr.ai); they can edit it
  const guess = String(name).toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
  let email = guess ? guess + '@wispr.ai' : '';
  const msg = h('p.gos-signin__msg', { role: 'status', 'aria-live': 'polite' }, notice || '');
  const icon = h('p.gos__kicker', 'A growth plan for Flow in India');
  const box = h('div.gos-lock.gos-signin');
  const busy = (f, on) => { f.querySelectorAll('input, button').forEach((x) => { x.disabled = on; }); };
  const askEmail = () => {
    const inp = h('input.field', { type: 'email', name: 'email', required: true, autocomplete: 'email', inputmode: 'email', placeholder: 'you@wispr.ai', value: email, 'aria-label': 'Your @wispr.ai email' });
    const f = h('form.gos-signin__form', { onsubmit: async (e) => {
      e.preventDefault();
      email = inp.value.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(email)) { msg.textContent = 'Use your @wispr.ai email.'; inp.focus(); return; } // the Worker decides who's allowed
      busy(f, true); msg.textContent = 'Sending…';
      try { await api('/login', { method: 'POST', body: { email } }); askCode(); } catch (err) { msg.textContent = err.message; busy(f, false); }
    } }, inp, h('button.btn.btn--primary', { type: 'submit' }, 'Send code'));
    box.replaceChildren(icon, h('p.big', 'For the Wispr team, ', h('em', 'only.')), h('p', email ? 'I\u2019ll send a code to your @wispr.ai email. Fix it if yours is different.' : 'Enter your @wispr.ai email and I\u2019ll send you a code.'), f, msg);
    setTimeout(() => { inp.focus({ preventScroll: true }); if (email) inp.select(); }, 60);
  };
  const askCode = () => {
    const inp = h('input.field.gos-signin__code', { type: 'text', name: 'code', required: true, autocomplete: 'one-time-code', inputmode: 'numeric', pattern: '[0-9 ]{6,7}', maxlength: 7, placeholder: '123456', 'aria-label': '6-digit code' });
    const f = h('form.gos-signin__form', { onsubmit: async (e) => {
      e.preventDefault();
      busy(f, true); msg.textContent = 'Checking…';
      try { const d = await api('/verify', { method: 'POST', body: { email, code: inp.value } }); token.set(d.token); await fetchPlan(); sound.tick('pick'); done(); } catch (err) { msg.textContent = err.message; busy(f, false); inp.select(); }
    } }, inp, h('button.btn.btn--primary', { type: 'submit' }, 'Open'));
    msg.textContent = '';
    box.replaceChildren(icon, h('p.big', 'Check your ', h('em', 'email.')), h('p', 'A 6-digit code is on its way to ', h('b', email), '. Or tap the link in the same email. Both last 15 minutes.'), f, msg,
      h('button.gos-signin__alt', { type: 'button', onclick: askEmail }, 'Use a different email'));
    setTimeout(() => inp.focus({ preventScroll: true }), 60);
  };
  w.body.replaceChildren(box);
  askEmail();
}

// the "work in progress" note: what's still open, each line jumps to its module
function wipNote(wip, jump) {
  if (!wip?.open?.length) return null;
  return h('details.gos-wip',
    h('summary', h('span.gos-wip__dot', { 'aria-hidden': 'true' }), 'Work in progress', h('span.gos-wip__n', `${wip.open.length} open`)),
    h('p.gos-wip__note', wip.note, wip.updated ? ` Updated ${fmtD(wip.updated)}.` : ''),
    h('ul.gos-wip__list', wip.open.map((o) => h('li', h('button', { type: 'button', onclick: () => jump(o.mod) }, h('span', o.t), h('span.tag', o.s))))));
}

function renderPlan(w, { name, start }) {
  const page = h('article.gos__page', { tabindex: '-1' });
  const nav = h('ul.gos__nav');
  const root = h('div.gos',
    h('aside.gos__side',
      h('p.gos__hello', name ? `Hi ${name}.` : 'Hi.'),
      h('p.gos__sub', 'A growth plan for Wispr Flow, built as tools you can click. Ready to start Monday.'),
      wipNote(D.MORE.wip, (id) => go(id)),
      nav,
      h('p.gos__foot', 'Made by Sameep. Everything is researched and cited. Your edits stay on this device. ',
        h('button', { type: 'button', onclick: () => { if (confirm('Clear your edits in Growth OS on this device?')) { localStorage.removeItem(KEY); location.reload(); } } }, 'Reset'), ' · ',
        h('button', { type: 'button', onclick: async () => { try { await api('/logout', { method: 'POST' }); } catch { /* signing out locally anyway */ } token.set(null); loaded = null; w.body.dataset.ready = ''; w.close(); } }, 'Sign out'))),
    h('div.gos__main', h('button.btn.btn--sm.gos__back', { type: 'button', onclick: () => { root.classList.remove('is-page'); } }, '‹ All modules'), page));
  w.body.replaceChildren(root);

  const counts = { campaigns: () => allCampaigns().filter((c) => statusOf(c) !== 'cut').length, creators: () => D.CREATORS.length, crm: () => crmRows().length, events: () => D.EVENTS.length, collabs: () => D.COLLABS.length };
  let cur = null;
  function renderNav() {
    let g = null;
    nav.replaceChildren(...MODULES.flatMap((m) => {
      const out = [];
      if (m.group !== g) { g = m.group; if (g) out.push(h('li.gos__navgroup', g)); }
      const n = counts[m.id] ? counts[m.id]() : m.count?.();
      out.push(h('li', h('button.gos__navbtn', { type: 'button', 'aria-current': m.id === cur ? 'page' : null, onclick: () => go(m.id) },
        h('span.gos__chip', { style: { '--c': m.c } }), h('span', m.label), n ? h('span.gos__count', String(n)) : h('span'))));
      return out;
    }));
  }
  function go(id, opts = {}) {
    const m = mod(id) || mod('home');
    cur = m.id;
    renderNav();
    page.style.setProperty('--c', m.c);
    page.replaceChildren(...[].concat(m.render(m, { go, ...opts })));
    page.scrollTop = 0;
    root.classList.add('is-page');
    if (!opts.quiet) sound.tick('click');
    if (isNarrow()) page.focus({ preventScroll: true });
  }
  w.go = go;
  renderNav();
  go(start || 'home', { quiet: true });
  if (isNarrow() && !start) root.classList.remove('is-page');
}

// ================================================================ modules

// ---------------------------------------------------------------- start here
function home(m, { go }) {
  const P = D.PLAN;
  return [
    head({ ...m, kicker: 'Read this first' }, null),
    h('p.lede', rich(P.thesis)),
    gboxW('The bet, in three lines', ul(P.bets)),
    gbox('The first 90 days', h('div.gos-grid.gos-grid--2', P.days90.map((p) => h('div.card', h('div.card__top', h('p.card__t', p.t), tag(p.when, 'real')), ul(p.items))))),
    gbox('What I’d cut, and why', h('div.tbl-wrap', h('table.tbl.tbl--stack', h('thead', h('tr', h('th', 'Cut'), h('th', 'Why'))),
      h('tbody', P.cut.map((c) => h('tr', h('td.tbl__name', c.t), h('td.tbl__wide', rich(c.why)))))))),
    gbox('Where my own lessons show up', h('div.gos-grid.gos-grid--2', P.learnings.map((l) => h('div.card',
      h('p.card__t', l.from), h('p.card__p', rich(l.lesson)), h('p.card__meta', h('span', '→ ', l.where.map((x, i) => [i ? ', ' : '', h('a', { href: '#', onclick: (e) => { e.preventDefault(); go(x.mod); } }, x.t)]))))))),
    gbox('What I’d need from Wispr in week one', ul(P.asks)),
    h('div.row', h('button.btn.btn--primary', { type: 'button', onclick: () => go('dash') }, 'See how it’s measured →'), h('button.btn', { type: 'button', onclick: () => go('campaigns') }, 'Open the calendar')),
  ];
}

// ---------------------------------------------------------------- dashboard
function dash(m, { go }) {
  const K = D.KPIS;
  return [
    head({ ...m, kicker: 'How we know it works' }, K.why),
    h('div.kpis',
      h('div.kpi.kpi--north', h('span.kpi__k', 'North star'), h('span.kpi__name', K.north.metric), h('span.kpi__d', rich(K.north.def)), h('span.kpi__d', h('b', 'How: '), rich(K.north.how))),
      K.tiles.map((t) => h('div.kpi', h('span.kpi__name', t.metric), h('span.kpi__d', rich(t.def))))),
    gboxW('The India funnel', h('ol.steps', K.funnel.map((f) => h('li', f.step))), h('p.note', K.funnelNote)),
    gbox('KPIs per module, and how each is measured',
      h('div.tbl-wrap', h('table.tbl.tbl--stack', h('thead', h('tr', ['Module', 'KPI', 'How it\u2019s measured', ''].map((t) => h('th', t)))),
        h('tbody', K.rows.map((r) => h('tr',
          h('td', { 'data-k': 'Module' }, h('a', { href: '#', onclick: (e) => { e.preventDefault(); go(r.mod); } }, mod(r.mod)?.label || r.mod)),
          h('td.tbl__name.tbl__wide', r.metric, h('span.tbl__sub', rich(r.def))),
          h('td.tbl__wide', rich(r.how)),
          h('td.muted', r.lead ? tag('Lead', 'real') : tag('Lag', 'done'))))))),
      h('p.note', 'Lead = moves this week and tells us early. Lag = what we actually want, moves slowly. Targets get set once Wispr\u2019s baseline is in.')),
    gbox('Attribution, plainly', ul(K.attribution)),
  ];
}

// ---------------------------------------------------------------- campaigns
const allCampaigns = () => [...D.CAMPAIGNS, ...S.added];
const statusOf = (c) => S.status[c.id] || c.status;
function campaigns(m, opts) {
  const list = allCampaigns().sort((a, b) => a.start.localeCompare(b.start));
  const first = D.CALENDAR.from, last = D.CALENDAR.to;
  const weeks = Math.ceil(days(first, last) / 7);
  const x = (d) => `calc(${days(first, d) / 7} * var(--wk))`;
  const detail = h('div');
  const open = (c) => { detail.replaceChildren(briefView(c, () => campaigns(m, { ...opts, focus: c.id }), opts)); detail.scrollIntoView({ behavior: 'smooth', block: 'start' }); sound.tick('pick'); };

  // month labels
  const months = [];
  for (let d = new Date(first + 'T00:00:00'); d <= new Date(last + 'T00:00:00'); d.setMonth(d.getMonth() + 1, 1)) months.push(new Date(d));
  const tl = h('div.tl', { style: { '--n': weeks } }, h('div.tl__in',
    h('div.tl__months', h('div', { style: { padding: '0 8px' } }, 'Campaign'), h('div.tl__mrow', months.map((d) => { const iso = d.toISOString().slice(0, 10) < first ? first : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; return h('span.tl__m', { style: { left: x(iso) } }, d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })); }))),
    h('div', { style: { position: 'relative' } },
      list.map((c) => h('div.tl__row', h('button.tl__name', { type: 'button', onclick: () => open(c) }, c.name),
        h('div.tl__track', h('button.tl__bar' + (statusOf(c) === 'cut' ? '.is-cut' : ''), { type: 'button', title: `${c.name}: ${fmtD(c.start)} – ${fmtD(c.end)}`, 'aria-label': c.name, onclick: () => open(c), style: { left: x(c.start), width: `max(8px, calc(${Math.max(1, days(c.start, c.end)) / 7} * var(--wk)))`, '--c': tone(c.c) || 'var(--bondi)' } })))),
      h('div', { style: { position: 'absolute', inset: '0 0 0 200px', pointerEvents: 'none' } },
        D.CALENDAR.marks.map((k) => h('span.tl__mark', { style: { left: x(k.d), top: '0' } }, h('span.tl__marklabel', k.t))),
        TODAY >= first && TODAY <= last ? h('span.tl__mark.tl__today', { style: { left: x(TODAY), top: '0' } }, h('span.tl__marklabel', 'Today')) : null))));

  // phone: an agenda by month
  const byMonth = {};
  list.forEach((c) => { const k = c.start.slice(0, 7); (byMonth[k] ||= []).push(c); });
  const agenda = h('div.agenda', Object.entries(byMonth).map(([k, cs]) => h('div',
    h('p.agenda__m', new Date(k + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })),
    h('div.agenda__list', cs.map((c) => campCard(c, () => open(c)))))));

  const form = newCampaignForm(() => campaigns(m, opts));
  const view = [
    head(m, D.CALENDAR.why, h('button.btn.btn--sm', { type: 'button', onclick: () => { form.hidden = !form.hidden; } }, '+ New campaign')),
    form, tl, agenda,
    h('p.note', 'Dashed lines are the moments we plan around. Tap a bar for its brief. Each brief ends with what it causes downstream, what could backfire, and when we kill it.'),
    detail,
  ];
  const focus = opts.focus ? list.find((c) => c.id === opts.focus) : list.find((c) => statusOf(c) !== 'cut');
  if (focus) detail.append(briefView(focus, () => campaigns(m, { ...opts, focus: focus.id }), opts));
  return view;
}
function campCard(c, onclick) {
  return h('button.card', { type: 'button', onclick, style: { '--c': tone(c.c) } },
    h('div.card__top', h('p.card__t', c.name), tag(statusOf(c))),
    h('p.card__p', rich(c.goal)),
    h('p.card__meta', h('span', `${fmtD(c.start)} – ${fmtD(c.end)}`), c.tier && h('span', c.tier)));
}
function briefView(c, rerender, { go } = {}) {
  const st = statusOf(c);
  const page = document.querySelector('.gos__page');
  return h('article.brief', { style: { '--c': tone(c.c) } },
    h('div.brief__head',
      h('div', h('h3.brief__t', c.name), h('p.brief__dates', `${fmtD(c.start)} – ${fmtD(c.end)} · ${days(c.start, c.end) + 1} days · ${c.owner || 'Owner: tbc'}`, c.tier ? ' · ' : '', c.tier && h('b', c.tier))),
      h('div.row', { style: { marginTop: 0 } }, tag(st), select(st, STATUSES, (v) => { S.status[c.id] = v; save(); const keep = page?.scrollTop; page?.replaceChildren(...rerender()); if (page) page.scrollTop = keep; }, 'Status'),
        copyBtn(() => briefText(c), 'Copy brief'))),
    h('dl.dl',
      h('dt', 'Goal'), h('dd', rich(c.goal)),
      h('dt', 'Who for'), h('dd', rich(c.audience)),
      h('dt', 'The insight'), h('dd', rich(c.insight)),
      h('dt', 'The idea'), h('dd', rich(c.idea)),
      h('dt', 'Channels'), h('dd', rich((c.channels || []).join(' · '))),
      h('dt', 'KPIs'), h('dd', ul(c.kpis || [])),
      h('dt', 'Budget'), h('dd', rich(c.budget || 'tbc')),
      c.learn && [h('dt', 'From my work'), h('dd', rich(c.learn))],
      c.links?.length && [h('dt', 'Uses'), h('dd', c.links.map((l, i) => [i ? ' · ' : '', h('a', { href: '#', onclick: (e) => { e.preventDefault(); go?.(l.mod); } }, l.t)]))]),
    gbox('Second-order', secondOrder(c.so)));
}
function briefText(c) {
  return [`${c.name} (${fmtD(c.start)} – ${fmtD(c.end)})`, '', `Goal: ${c.goal}`, `Who for: ${c.audience}`, `Insight: ${c.insight}`, `Idea: ${c.idea}`, `Channels: ${(c.channels || []).join(', ')}`, 'KPIs:', ...(c.kpis || []).map((k) => '- ' + k), `Budget: ${c.budget || 'tbc'}`, '', 'Second-order',
    `- Causes: ${c.so?.causes || ''}`, `- Could backfire: ${c.so?.backfire || ''}`, `- Compounds: ${c.so?.compounds || ''}`, `- Kill if: ${c.so?.kill || ''}`].join('\n').replace(/\s\[\d+(?:,\s*\d+)*\]/g, '');
}
function newCampaignForm(rerender) {
  const f = h('form.gbox.gbox--white.form', { hidden: true },
    h('h3.gbox__label', 'New campaign'),
    h('label.full', 'Name', h('input.field', { name: 'name', required: true, placeholder: 'e.g. Hinglish week' })),
    h('label', 'Starts', h('input.field', { name: 'start', type: 'date', required: true, min: D.CALENDAR.from, max: D.CALENDAR.to, value: TODAY > D.CALENDAR.from ? TODAY : D.CALENDAR.from })),
    h('label', 'Ends', h('input.field', { name: 'end', type: 'date', required: true, min: D.CALENDAR.from, max: D.CALENDAR.to })),
    h('label.full', 'Goal (one number)', h('input.field', { name: 'goal', required: true, placeholder: 'e.g. 3,000 activated users in Pune' })),
    h('label.full', 'The insight', h('textarea.field.field--area', { name: 'insight', rows: 2, placeholder: 'What do people believe or do today that this changes?' })),
    h('label.full', 'What could backfire?', h('textarea.field.field--area', { name: 'backfire', rows: 2, placeholder: 'Required. If you can’t think of one, think again.', required: true })),
    h('label.full', 'Kill it if', h('input.field', { name: 'kill', required: true, placeholder: 'e.g. cost per activated user above ₹400 after week 2' })),
    h('div.form__row', h('button.btn', { type: 'button', onclick: () => { f.hidden = true; } }, 'Cancel'), h('button.btn.btn--primary', { type: 'submit' }, 'Add to calendar')));
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    if (d.end < d.start) [d.start, d.end] = [d.end, d.start];
    S.added.push({ id: 'u' + Date.now().toString(36), name: d.name, start: d.start, end: d.end, status: 'idea', c: 'var(--plat-4)', owner: 'Added by you', goal: d.goal, audience: 'tbc', insight: d.insight || 'tbc', idea: 'tbc', channels: [], kpis: [d.goal], so: { causes: 'tbc', backfire: d.backfire, compounds: 'tbc', kill: d.kill } });
    save(); sound.tick('pick');
    const page = f.closest('.gos__page'); page.replaceChildren(...rerender());
  });
  return f;
}

// ---------------------------------------------------------------- events
function events(m) {
  const detail = h('div');
  let on = null;
  const cards = h('div.gos-grid', D.EVENTS.map((e) => h('button.card', { type: 'button', 'aria-pressed': 'false', style: { '--c': tone(e.c) }, onclick: (ev) => show(e, ev.currentTarget) },
    h('div.card__top', h('p.card__t', e.name), tag(e.tier, e.tier === 'Cut' ? 'cut' : 'real')), h('p.card__p', e.one), h('p.card__meta', h('span', e.where), h('span', e.cost)))));
  function show(e, btn) {
    on = e.id;
    cards.querySelectorAll('.card').forEach((c) => c.setAttribute('aria-pressed', String(c === btn)));
    const done = S.checks[e.id] || {};
    detail.replaceChildren(h('article.brief', { style: { '--c': tone(e.c) } },
      h('div.brief__head', h('div', h('h3.brief__t', e.name), h('p.brief__dates', `${e.where} · ${e.when} · ${e.cost}`))),
      h('p.lede', rich(e.idea)),
      e.game && gboxW('Try the stall: type vs talk', typeVsTalk()),
      h('div.gos-grid.gos-grid--2',
        gbox('Run sheet', h('ol.ul', e.runsheet.map((t) => h('li', rich(t))))),
        gbox('Checklist', h('ul.check', e.checklist.map((t, i) => h('li', h('label', h('input', { type: 'checkbox', checked: !!done[i], onchange: (ev) => { (S.checks[e.id] ||= {})[i] = ev.target.checked; save(); } }), h('span', t))))))),
      gbox('KPIs', ul(e.kpis)),
      gbox('Second-order', secondOrder(e.so))));
    if (btn) detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
    sound.tick('pick');
  }
  const view = [head(m, D.EVENTS_WHY), cards, detail];
  show(D.EVENTS[0], cards.firstChild);
  void on;
  return view;
}

// The dictation-challenge stall: type a line, see your words per minute next to talking speed.
function typeVsTalk() {
  const lines = D.TVT.lines;
  let line = lines[Math.floor(Math.random() * lines.length)];
  let t0 = 0;
  const shown = h('p.tvt__line');
  const inp = h('textarea.field.field--area', { rows: 2, 'aria-label': 'Type the line', placeholder: 'Start typing the line above. The clock starts on your first key.', autocomplete: 'off', spellcheck: false });
  const wpm = h('span.kpi__v', '–'), acc = h('span.kpi__v', '–'), talk = h('span.kpi__v', String(D.TVT.talkWpm));
  const name = h('input.field', { placeholder: 'Your name for the board', maxlength: 20, 'aria-label': 'Name for the leaderboard' });
  const board = h('ol.board');
  const paint = () => {
    const typed = inp.value;
    shown.replaceChildren(...[...line].map((ch, i) => i < typed.length ? (typed[i] === ch ? h('b', ch) : h('u', ch)) : ch));
  };
  const drawBoard = () => board.replaceChildren(...(S.board.length ? S.board.slice(0, 5).map((r) => h('li', h('span', r.n), h('span', `${r.w} wpm`))) : [h('li', h('span', 'Nobody yet. Go first.'), h('span', ''))]));
  const reset = () => { line = lines[(lines.indexOf(line) + 1) % lines.length]; inp.value = ''; t0 = 0; wpm.textContent = '–'; acc.textContent = '–'; paint(); };
  inp.addEventListener('input', () => {
    if (!t0) t0 = performance.now();
    paint();
    if (inp.value.length >= line.length) {
      const mins = (performance.now() - t0) / 60000;
      const right = [...line].filter((ch, i) => inp.value[i] === ch).length;
      const w = Math.round((right / 5) / Math.max(mins, 1 / 600));
      wpm.textContent = String(w); acc.textContent = Math.round((right / line.length) * 100) + '%';
      S.board.push({ n: (name.value.trim() || 'Anon').slice(0, 20), w }); S.board.sort((a, b) => b.w - a.w); S.board = S.board.slice(0, 20); save(); drawBoard();
      sound.tick('pick');
    }
  });
  // the talk round: the browser's own speech recogniser stands in for Flow (Chrome, Edge, Safari)
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const sayBtn = h('button.btn.btn--sm.btn--primary', { type: 'button', disabled: !SR, title: SR ? 'Say the line out loud' : 'This browser has no speech recogniser', onclick: () => {
    const r = new SR(); r.lang = 'en-IN'; r.interimResults = false;
    let s0 = 0;
    r.onstart = () => { s0 = performance.now(); sayBtn.textContent = 'Listening…'; };
    r.onresult = (e) => { const said = e.results[0][0].transcript; const n = said.trim().split(/\s+/).length; const w = Math.round(n / Math.max((performance.now() - s0) / 60000, 1 / 600)); talk.textContent = String(w); talk.nextSibling.textContent = `you, just now: “${said.slice(0, 60)}”`; };
    r.onend = () => { sayBtn.textContent = 'Now say it'; };
    r.onerror = () => { sayBtn.textContent = 'Mic blocked'; };
    r.start();
  } }, SR ? 'Now say it' : 'No mic here');
  paint(); drawBoard();
  return h('div.tvt',
    h('p.small', rich(D.TVT.how)),
    shown, inp,
    h('div.tvt__out', h('div.kpi', h('span.kpi__k', 'You typed'), wpm, h('span.kpi__d', 'words per minute')), h('div.kpi', h('span.kpi__k', 'Accuracy'), acc), h('div.kpi', h('span.kpi__k', 'Talking'), talk, h('span.kpi__d', rich(D.TVT.talkNote)))),
    h('div.row', name, sayBtn, h('button.btn.btn--sm', { type: 'button', onclick: reset }, 'Next line')),
    h('p.small', { style: { margin: '6px 0 0' } }, 'Leaderboard on this device'), board);
}

// ---------------------------------------------------------------- collabs
function collabs(m) {
  const W = D.COLLAB_WEIGHTS;
  const score = (c) => { const s = { ...c.scores, ...(S.scores[c.id] || {}) }; return Math.round((s.aud * W.aud + s.val * W.val + s.ease * W.ease + (6 - s.risk) * W.risk) / (5 * (W.aud + W.val + W.ease + W.risk)) * 100); };
  const detail = h('div');
  const body = h('tbody');
  const draw = (focusId) => {
    const rows = [...D.COLLABS].sort((a, b) => score(b) - score(a));
    body.replaceChildren(...rows.map((c) => h('tr' + (c.id === focusId ? '.is-on' : ''), { onclick: () => { show(c); draw(c.id); } },
      h('td.tbl__name.tbl__wide', c.name, h('span.tbl__sub', c.cat)),
      h('td.tbl__wide', rich(c.format)),
      h('td', { 'data-k': 'Fit' }, h('div.meter', { style: { minWidth: '110px' } }, h('span.meter__bar', h('i', { style: { width: score(c) + '%' } })), h('span.meter__v', String(score(c))))),
      h('td', tag(c.tier, c.tier === 'Cut' ? 'cut' : c.tier === 'Now' ? 'live' : 'idea')))));
  };
  function show(c) {
    const s = { ...c.scores, ...(S.scores[c.id] || {}) };
    const sl = (k, label) => { const out = h('output', String(s[k])); const r = h('input', { type: 'range', min: 1, max: 5, value: s[k], 'aria-label': label, oninput: (e) => { out.textContent = e.target.value; (S.scores[c.id] ||= {})[k] = +e.target.value; save(); draw(c.id); } }); return h('label.slider', h('span', label), r, out); };
    detail.replaceChildren(h('article.brief', { style: { '--c': 'var(--grape)' } },
      h('div.brief__head', h('div', h('h3.brief__t', c.name), h('p.brief__dates', c.cat))),
      h('dl.dl', h('dt', 'Why them'), h('dd', rich(c.why)), h('dt', 'We give'), h('dd', rich(c.give)), h('dt', 'They get'), h('dd', rich(c.get)), h('dt', 'First ask'), h('dd', rich(c.first)), h('dt', 'Measure'), h('dd', rich(c.kpi))),
      gbox('Score it yourself', h('div', { style: { display: 'grid', gap: '6px' } }, sl('aud', 'Audience overlap'), sl('val', 'Value to both sides'), sl('ease', 'Easy to ship'), sl('risk', 'Brand risk (high is bad)'))),
      c.so && gbox('Second-order', secondOrder(c.so))));
  }
  draw(D.COLLABS[0].id); show(D.COLLABS[0]);
  return [head(m, D.COLLABS_WHY), gbox('The rule', ul(D.COLLAB_RULES)),
    h('div.tbl-wrap', { style: { marginTop: '16px' } }, h('table.tbl.tbl--stack', h('thead', h('tr', ['Partner', 'The collab', 'Fit', 'When'].map((t) => h('th', t)))), body)),
    h('p.note', 'Fit = audience overlap, value both ways, ease, and low brand risk. Drag the sliders on any partner and the table re-sorts.'), detail];
}

// ---------------------------------------------------------------- creators
const STAGES = ['found', 'shortlisted', 'contacted', 'replied', 'briefed', 'live', 'rights cleared', 'passed'];
const first = (t) => String(t || '').split(/;\s*/)[0];
const stageOf = (c) => S.stages[c.handle] || 'found';
function creators(m) {
  return [head(m, D.CREATORS_WHY),
    tabs(['Discover', 'Pipeline', 'Brief builder', 'UGC & rights', 'Programme rules'], (i) => [discover, pipeline, briefBuilder, ugc, rules][i](), 0)];

  function discover() {
    const q = { text: '', region: 'all', bucket: 'all', tier: 'all', starred: false, fresh: false };
    const buckets = [...new Set(D.CREATORS.map((c) => c.bucket))];
    const body = h('tbody');
    const count = h('span.small', { style: { margin: 0 } });
    const draw = () => {
      const rows = D.CREATORS.filter((c) => (q.region === 'all' || c.region === q.region) && (q.bucket === 'all' || c.bucket === q.bucket) && (q.tier === 'all' || c.tier === q.tier) && (!q.starred || S.stars[c.handle]) && (!q.fresh || !c.promotedWispr) &&
        (!q.text || [c.name, c.handle, c.fit, c.bucket, c.niche].join(' ').toLowerCase().includes(q.text)));
      count.textContent = `${rows.length} of ${D.CREATORS.length}`;
      body.replaceChildren(...rows.map((c) => h('tr',
        h('td.tbl__star', h('button.star', { type: 'button', 'aria-pressed': String(!!S.stars[c.handle]), 'aria-label': 'Shortlist ' + c.name, onclick: (e) => { S.stars[c.handle] = !S.stars[c.handle]; if (S.stars[c.handle] && stageOf(c) === 'found') S.stages[c.handle] = 'shortlisted'; save(); e.currentTarget.setAttribute('aria-pressed', String(!!S.stars[c.handle])); } }, '★')),
        h('td.tbl__name.tbl__wide', h('div.who', avatar({ name: c.name, photo: c.photo }), h('div.who__t', c.name, h('span.tbl__sub', first(c.handle)))), h('span.tags', c.pick ? tag('Top pick', 'approved') : null, c.dont ? tag('Conflict: builds a competing app', 'warn') : null, c.promotedWispr ? tag('Already with Flow', 'done') : null)),
        h('td', { 'data-k': 'Reach' }, first(c.followers) || '?', h('span.tbl__sub', c.region === 'IN' ? 'India' : 'Global')),
        h('td', { 'data-k': 'Size' }, c.tier, h('span.tbl__sub', c.lang)),
        h('td.tbl__wide', h('details.fit', h('summary', rich(c.fit)), c.format && h('p', h('b', 'Format: '), c.format), c.risk && h('p', h('b', 'Watch: '), c.risk), h('p.muted', 'Reach as of ', c.followersAsOf || '?', ' · ', c.source && h('a', { href: safeHttp(c.source), target: '_blank', rel: 'noopener' }, 'source ↗')))))));
    };
    const onIn = (k) => (v) => { q[k] = v; draw(); };
    const view = [
      h('div.bar',
        h('input.field', { type: 'search', placeholder: 'Search name, niche, fit…', 'aria-label': 'Search creators', oninput: (e) => onIn('text')(e.target.value.toLowerCase()) }),
        select('all', [['all', 'India + global'], ['IN', 'India'], ['GLOBAL', 'Global']], onIn('region'), 'Region'),
        select('all', [['all', 'All niches'], ...buckets.map((b) => [b, b])], onIn('bucket'), 'Niche'),
        select('all', [['all', 'All sizes'], ...['nano', 'micro', 'mid', 'macro', 'mega'].map((t) => [t, t[0].toUpperCase() + t.slice(1)])], onIn('tier'), 'Size'),
        h('label.small', { style: { margin: 0, display: 'flex', gap: '6px', alignItems: 'center' } }, h('input', { type: 'checkbox', onchange: (e) => onIn('starred')(e.target.checked) }), '★ only'),
        h('label.small', { style: { margin: 0, display: 'flex', gap: '6px', alignItems: 'center' } }, h('input', { type: 'checkbox', onchange: (e) => onIn('fresh')(e.target.checked) }), 'New to Flow only'),
        count),
      h('div.tbl-wrap', { style: { maxHeight: '440px' } }, h('table.tbl.tbl--stack.tbl--creators', h('thead', h('tr', ['', 'Creator', 'Reach', 'Size', 'Why they fit (tap for format and risks)'].map((t) => h('th', t)))), body)),
      h('p.note', 'Real, public creators, researched for fit on 3 Nov 2026. Nobody here has been contacted, and none has agreed to anything. “Already with Flow” means we found a Flow video on their YouTube; Instagram and LinkedIn weren\u2019t checked. Counts are approximate, with the date checked.'),
    ];
    draw();
    return view;
  }

  function pipeline() {
    const list = D.CREATORS.filter((c) => S.stars[c.handle] || stageOf(c) !== 'found');
    if (!list.length) return h('div.empty', 'Star creators in Discover to start a pipeline. Each one moves from contacted → replied → briefed → live → rights cleared.');
    const cols = STAGES.filter((s) => s !== 'found');
    return [h('div.tbl-wrap', h('table.tbl.tbl--stack', h('thead', h('tr', ['Creator', 'Stage', 'Next step'].map((t) => h('th', t)))),
      h('tbody', list.map((c) => h('tr',
        h('td.tbl__name', h('div.who', avatar({ name: c.name, photo: c.photo, size: 30 }), h('div.who__t', c.name, h('span.tbl__sub', c.handle)))),
        h('td', select(stageOf(c) === 'found' ? 'shortlisted' : stageOf(c), cols, (v) => { S.stages[c.handle] = v; save(); }, 'Stage for ' + c.name)),
        h('td.tbl__wide.muted', D.NEXT_STEP[stageOf(c)] || '')))))),
    h('p.note', 'Stages here are yours to move; this is a planning view, so nothing is sent from it.')];
  }

  function briefBuilder() {
    const camps = allCampaigns().filter((c) => statusOf(c) !== 'cut');
    const pool = D.CREATORS.filter((c) => S.stars[c.handle]).length ? D.CREATORS.filter((c) => S.stars[c.handle]) : D.CREATORS;
    if (!pool.length || !camps.length) return h('div.empty', 'No creators or campaigns to brief yet.');
    let cr = pool[0], cp = camps[0];
    const out = h('div.post');
    const draw = () => { out.textContent = D.creatorBrief(cr, cp); };
    const view = [
      h('div.bar', select(cr.handle, pool.map((c) => [c.handle, c.name]), (v) => { cr = pool.find((c) => c.handle === v); draw(); }, 'Creator'),
        select(cp.id, camps.map((c) => [c.id, c.name]), (v) => { cp = camps.find((c) => c.id === v); draw(); }, 'Campaign'),
        copyBtn(() => out.textContent, 'Copy brief')),
      out,
      h('p.note', 'One page, no script. The brief tells them the problem and the one thing that must be true on screen; they decide how to say it.'),
    ];
    draw();
    return view;
  }

  function ugc() {
    const body = h('tbody');
    const draw = () => {
      const rows = S.ugc.length ? S.ugc : D.UGC_SAMPLE;
      body.replaceChildren(...rows.map((u, i) => {
        const left = u.until ? days(TODAY, u.until) : null;
        return h('tr',
          h('td.tbl__name', u.creator, h('span.tbl__sub', u.what), S.ugc.length ? null : sample()),
          h('td', { 'data-k': 'Rights' }, u.rights),
          h('td', { 'data-k': 'Until' }, u.until ? h('span' + (left < 14 ? '.is-overdue' : ''), fmtD(u.until) + (left < 0 ? ' · expired' : left < 14 ? ` · ${left}d left` : '')) : '—'),
          h('td', { 'data-k': 'Used in' }, u.used || '—'),
          h('td', S.ugc.length ? h('button.btn.btn--sm', { type: 'button', onclick: () => { S.ugc.splice(i, 1); save(); draw(); } }, 'Remove') : null));
      }));
    };
    const f = h('form.form', h('label', 'Creator', h('input.field', { name: 'creator', required: true })), h('label', 'What (link or name)', h('input.field', { name: 'what', required: true })),
      h('label', 'Rights', select('Organic repost only', D.RIGHTS, () => {}, 'Rights')), h('label', 'Usage until', h('input.field', { type: 'date', name: 'until' })),
      h('label', 'Used in', h('input.field', { name: 'used', placeholder: 'e.g. Meta ads, site' })), h('div.form__row', h('button.btn.btn--primary', { type: 'submit' }, 'Log it')));
    f.querySelector('select').name = 'rights';
    f.addEventListener('submit', (e) => { e.preventDefault(); S.ugc.push(Object.fromEntries(new FormData(f))); save(); f.reset(); draw(); sound.tick('pick'); });
    draw();
    return [gbox('Rights, plainly', ul(D.RIGHTS_RULES)), h('div.tbl-wrap', { style: { marginTop: '14px' } }, h('table.tbl.tbl--stack', h('thead', h('tr', ['Asset', 'Rights', 'Until', 'Used in', ''].map((t) => h('th', t)))), body)),
      gboxW('Log a new asset', f)];
  }

  function rules() { return [gbox('How the programme runs', ul(D.CREATOR_RULES)), gbox('Second-order', secondOrder(D.CREATOR_SO))]; }
}

// ---------------------------------------------------------------- linkedin
function linkedin(m) {
  const L = D.LINKEDIN;
  return [head(m, L.why),
    tabs(['Dictate a post', 'Pillars', 'The week', 'Rules'], (i) => [dictate, pillars, week, rulesTab][i](), 0)];

  function dictate() {
    const ta = h('textarea.field.field--area', { rows: 5, 'aria-label': 'Say your post the way you’d say it' }, L.sampleRaw);
    const out = h('div.post');
    const lint = h('ul.lint');
    const run = () => {
      const clean = flowClean(ta.value) || '';
      out.replaceChildren(h('div.post__who', h('span.post__av'), h('span', 'You · Wispr Flow')), clean);
      lint.replaceChildren(...L.lint.map((r) => h('li' + (r.test(clean) ? '' : '.is-bad'), r.t)));
      sound.tick('pick');
    };
    run();
    return [h('p.small', 'Founders and the India team say the post out loud, the way they’d tell a friend. Flow cleans it up. Then it gets checked against the rules before it goes out. (The sample below is made up.)'),
      ta, h('div.row', h('button.btn.btn--primary', { type: 'button', onclick: run }, 'Flow it'), copyBtn(() => out.textContent.replace(/^You · Wispr Flow/, ''), 'Copy post')),
      h('div.gos-grid.gos-grid--2', { style: { marginTop: '12px' } }, out, gboxW('Before it goes out', lint))];
  }
  function pillars() { return h('div.gos-grid.gos-grid--2', L.pillars.map((p) => h('div.card', h('div.card__top', h('p.card__t', p.t), tag(p.share, 'real')), h('p.card__p', rich(p.p)), h('p.card__meta', h('span', 'e.g. ', p.ex))))); }
  function week() {
    return [h('div.tbl-wrap', h('table.tbl', h('thead', h('tr', h('th', 'Who'), ...L.days.map((d) => h('th', d)))),
      h('tbody', L.week.map((r) => h('tr', h('td.tbl__name', r.who, h('span.tbl__sub', r.role)), ...r.slots.map((s) => h('td', s ? rich(s) : h('span.muted', '—')))))))),
    h('p.note', 'Roles, not names: the team decides who takes which slot.')];
  }
  function rulesTab() { return [gbox('Rules', ul(L.rules)), gbox('Second-order', secondOrder(L.so))]; }
}

// ---------------------------------------------------------------- brand
function brand(m) {
  const B = D.BRAND;
  return [head(m, B.why),
    h('p.lede', rich(B.thesis)),
    tabs(['Cultural territories', 'Brand codes', 'Is this cool?', 'Say / don’t say', 'Risks'], (i) => [terr, codes, coolTest, say, risks][i](), 0)];

  function terr() { return h('div.gos-grid.gos-grid--2', B.territories.map((t) => h('div.card', h('p.card__t', t.t), h('p.card__p', rich(t.p)), h('p.card__meta', h('span', 'First move: ', rich(t.ex)))))); }
  function codes() { return h('div.gos-grid', B.codes.map((c) => h('div.card', h('p.card__t', c.t), h('p.card__p', rich(c.p))))); }
  function coolTest() {
    const idea = h('input.field', { placeholder: 'Describe the idea in one line', 'aria-label': 'Idea' });
    const marks = B.coolTest.map(() => false);
    const meter = h('span.meter__bar', h('i', { style: { width: '0%' } }));
    const v = h('span.meter__v', '0/' + marks.length);
    const verdict = h('p.big', { style: { margin: '10px 0 0' } }, '');
    const draw = () => { const n = marks.filter(Boolean).length; meter.firstChild.style.width = (n / marks.length) * 100 + '%'; v.textContent = `${n}/${marks.length}`; verdict.textContent = B.verdicts[Math.min(B.verdicts.length - 1, Math.floor((n / marks.length) * (B.verdicts.length - 1) + 0.001))]; };
    draw();
    return [h('p.small', 'Run any idea through this before it gets a budget.'), idea,
      h('ul.check', { style: { marginTop: '10px' } }, B.coolTest.map((t, i) => h('li', h('label', h('input', { type: 'checkbox', onchange: (e) => { marks[i] = e.target.checked; draw(); } }), h('span', t))))),
      h('div.meter', { style: { marginTop: '12px' } }, meter, v), verdict];
  }
  function say() { return h('div.gos-grid.gos-grid--2', gboxW('Say', ul(B.say)), gboxW('Don’t say', ul(B.dont))); }
  function risks() { return [ul(B.risks), gbox('Second-order', secondOrder(B.so))]; }
}

// ---------------------------------------------------------------- crm
function crmRows() { return S.crm || D.CRM_SEED(); }
function crm(m) {
  let type = 'all', text = '';
  const body = h('tbody');
  const count = h('span.small', { style: { margin: 0 } });
  const commit = () => { S.crm = rows; save(); };
  let rows = crmRows().map((r) => ({ ...r }));
  const draw = () => {
    const list = rows.filter((r) => (type === 'all' || r.type === type) && (!text || [r.name, r.org, r.next, r.notes].join(' ').toLowerCase().includes(text)));
    count.textContent = `${list.length} contacts`;
    body.replaceChildren(...list.map((r) => {
      const late = r.due && r.due < TODAY && !['won', 'lost', 'parked'].includes(r.stage);
      return h('tr',
        h('td.tbl__name', h('div.who', avatar({ name: r.name, photo: r.photo || D.CREATORS.find((c) => c.name === r.name)?.photo, size: 32 }), h('div.who__t', r.name, h('span.tbl__sub', [r.type, r.org].filter(Boolean).join(' · '))))),
        h('td', { 'data-k': 'Stage' }, select(r.stage, D.CRM_STAGES, (v) => { r.stage = v; commit(); draw(); }, 'Stage for ' + r.name)),
        h('td.tbl__wide', { 'data-k': 'Next' }, r.next || '—', r.due && h('span.tbl__sub' + (late ? '.is-overdue' : ''), (late ? 'Overdue · ' : 'By ') + fmtD(r.due))),
        h('td', { 'data-k': 'Owner' }, r.owner || '—'),
        h('td.tbl__wide.muted', r.notes || ''));
    }));
  };
  const f = h('form.form', { hidden: true },
    h('label', 'Name', h('input.field', { name: 'name', required: true })),
    h('label', 'Type', select('Creator', D.CRM_TYPES, () => {}, 'Type')),
    h('label', 'Org / handle', h('input.field', { name: 'org' })),
    h('label', 'Owner (role)', h('input.field', { name: 'owner', placeholder: 'e.g. India growth' })),
    h('label.full', 'Next step', h('input.field', { name: 'next', required: true, placeholder: 'One action, with a verb' })),
    h('label', 'By', h('input.field', { type: 'date', name: 'due' })),
    h('label', 'Notes', h('input.field', { name: 'notes' })),
    h('div.form__row', h('button.btn', { type: 'button', onclick: () => { f.hidden = true; } }, 'Cancel'), h('button.btn.btn--primary', { type: 'submit' }, 'Add')));
  f.querySelector('select').name = 'type';
  f.addEventListener('submit', (e) => { e.preventDefault(); rows.unshift({ id: 'c' + Date.now().toString(36), stage: 'to contact', ...Object.fromEntries(new FormData(f)) }); commit(); f.reset(); f.hidden = true; draw(); sound.tick('pick'); });
  const csv = () => { const cols = ['name', 'type', 'org', 'stage', 'next', 'due', 'owner', 'notes']; return [cols.join(','), ...rows.map((r) => cols.map((k) => `"${String(r[k] || '').replace(/"/g, '""')}"`).join(','))].join('\n'); };
  draw();
  return [head(m, D.CRM_WHY, h('button.btn.btn--sm', { type: 'button', onclick: () => { f.hidden = !f.hidden; } }, '+ Add contact'), h('button.btn.btn--sm', { type: 'button', onclick: () => download('wispr-growth-crm.csv', csv()) }, 'Export CSV')),
    h('div.gbox.gbox--white', { hidden: false, style: { display: 'contents' } }, f),
    h('div.bar',
      h('input.field', { type: 'search', placeholder: 'Search…', 'aria-label': 'Search contacts', oninput: (e) => { text = e.target.value.toLowerCase(); draw(); } }),
      select('all', [['all', 'Everyone'], ...D.CRM_TYPES.map((t) => [t, t + 's'])], (v) => { type = v; draw(); }, 'Type'),
      count),
    h('div.tbl-wrap', { style: { maxHeight: '460px' } }, h('table.tbl.tbl--stack', h('thead', h('tr', ['Contact', 'Stage', 'Next step', 'Owner', 'Notes'].map((t) => h('th', t)))), body)),
    h('p.note', 'Seeded with the shortlisted creators, partners and venues from the other modules. Every one is at “to contact”: no outreach has happened.'),
    gbox('How it’s used', ul(D.CRM_RULES))];
}

// ---------------------------------------------------------------- sources
function sources(m) {
  return [head({ ...m, kicker: 'Receipts' }, 'Every [n] in the plan links here. Checked in early November 2026; prices and follower counts move, so re-check before spending.'),
    h('ol.ul', D.SOURCES.map((s) => h('li', { id: 'src-' + s.id }, h('a', { href: safeHttp(s.url), target: '_blank', rel: 'noopener' }, s.t), s.d ? h('span.muted', ' · ' + s.d) : null)))];
}
