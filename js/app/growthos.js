// growthos.js — "Wispr Growth OS": a growth plan for Wispr Flow you can click through, as a
// Platinum control panel. Only the Wispr team see the icon (Wispr version + a teammate login).
// Content lives in growthos-data.js; anything a visitor changes stays on their device (wgos.v1).
import { h, isNarrow } from './util.js';
import { sound } from './audio.js';
import { isWispr } from '../version.js';
import { flowClean } from './apps.js';
import { name as sawName } from '../analytics.js';
import * as D from './growthos-data.js';
import { extraModules } from './gos/index.js';
import { loadCss, avatar, appHead, art } from './gos/kit.js';
import { glyph } from './gos/apps.js';

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
export function install({ wm, area, visitor, icon = true }) {
  if (!canSeeGrowthOS(visitor)) return false;
  // top of the left column, above the projects (the right column is the system and the toys)
  const icons = area.querySelector('.icons--proj') || area.querySelector('.icons');
  if (!icons || area.querySelector('[data-app="growthos"]')) return false;
  const btn = h('button.icon.icon--gos', { type: 'button', dataset: { app: 'growthos' }, onclick: () => { sound.tick('click'); openTab(wm, visitor); } },
    h('img', { src: new URL('../../growth-os/icon.svg', import.meta.url).href, alt: '', width: 48, height: 48, draggable: 'false' }),
    h('span.icon__label', 'Wispr Growth OS'));
  if (icon) icons.prepend(h('li.is-new', btn));  // off when the Wispr folder carries it
  if (fromLink) openGrowthOS(wm, { visitor });
  // when the show's end card opens, add a nudge to this folder (the next thing to look at)
  new MutationObserver(() => {
    const end = area.querySelector('.win--end .end');
    if (!end || end.querySelector('.end__gos')) return;
    end.append(h('div.end__gos',
      h('p.end__kicker', 'Next, for the Wispr team'),
      h('p.end__lede', 'I started a growth plan for Wispr Flow. It’s a rough prototype, not reviewed yet, but it’s where I’d start.'),
      h('button.btn.btn--primary', { type: 'button', onclick: () => { sound.tick('click'); openTab(wm, visitor); } }, 'Open Wispr Growth OS ↗')));
  }).observe(area, { childList: true });  // windows are direct children of the desktop
  return true;
}

// Growth OS lives in its own tab (growth-os/, same origin, so the lock-screen login carries over);
// if the browser blocks the tab, it opens in a window here instead
export const GROWTH_URL = new URL('../../growth-os/?version=wispr', import.meta.url).href;
function openTab(wm, visitor) {
  const tab = window.open(GROWTH_URL, '_blank');
  if (!tab) openGrowthOS(wm, { visitor });
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
const STATUSES = ['idea', 'planned', 'live', 'done'];
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
const head = (m, why, ...tools) => appHead(m, why, tools);

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
  const name = (v?.name || teamId(v).replace(/^w-/, '')).split(' ')[0];
  const ready = () => addExtras().catch((e) => console.warn('[growth os] extras', e)).then(() => renderPlan(w, { name, start }));
  if (token.get()) {
    w.body.append(h('div.gos-lock', h('p.big', 'Opening the plan…')));
    fetchPlan().then(ready).catch((e) => { if (e.status === 401) token.set(null); signIn(w, ready, e.status === 401 ? 'Your session ended. Sign in again.' : e.message, name); });
  } else signIn(w, ready, fromLink === 'expired' ? 'That link has expired. Ask for a new code.' : null, name);
  return w;
}

// a first name off a work email for the visit log (tanay.k@wispr.ai → Tanay); the address itself is never sent
const firstName = (email) => { const w = String(email).split('@')[0].split(/[._+-]/)[0].replace(/[^a-z]/gi, ''); return w.length > 1 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''; };
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
      try { const d = await api('/verify', { method: 'POST', body: { email, code: inp.value } }); token.set(d.token); sawName(firstName(email), 'growth'); await fetchPlan(); sound.tick('pick'); done(); } catch (err) { msg.textContent = err.message; busy(f, false); inp.select(); }
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
  const box = h('details.gos-wip',
    h('summary', h('span.gos-wip__dot', { 'aria-hidden': 'true' }), h('span', 'Work in progress'), h('span.gos-wip__n', `${wip.open.length} open`)),
    h('div.gos-wip__pop',
      h('p.gos-wip__note', wip.note, wip.updated ? ` Updated ${fmtD(wip.updated)}.` : ''),
      h('ul.gos-wip__list', wip.open.map((o) => h('li', h('button', { type: 'button', onclick: () => { box.open = false; jump(o.mod); } }, h('span', o.t), h('span.tag', o.s)))))));
  return box;
}

// the OS's structure: eight sections down the side, each a few tabs; every module lives in exactly one
const SECTIONS = [
  { id: 'plan', t: 'Plan', g: 'dash', art: 'mb-quiet-speed', line: 'The bet, month by month, and how we’d know it’s working.', tabs: [['home', 'Overview'], ['dash', 'Measures'], ['tracking', 'Tracking']] },
  { id: 'campaigns', t: 'Campaigns', g: 'campaigns', art: 'ev-founder-dinner', line: 'Five campaigns from December, on one board.', tabs: [['campaigns', 'All campaigns'], ['storyboards', 'Storyboards'], ['wrapped', 'Wispr Wrapped']] },
  { id: 'ideas', t: 'Ideas', g: 'ideas', art: 'mb-talking-voicenote', line: 'Untested ideas, each with the cheapest way to try it.', tabs: [['ideas', 'Idea bank'], ['brainstorm', 'Brainstorm']] },
  { id: 'brand', t: 'Brand', g: 'brand', art: 'guide-do-people', line: 'How Flow should look and sound in India.', tabs: [['guide', 'Guideline'], ['moodboards', 'Moodboards'], ['brand', 'Cool in India?']] },
  { id: 'social', t: 'Social', g: 'lincal', art: 'mb-desk-11pm', line: 'Founder posts, the posting calendar and channel numbers.', tabs: [['linkedin', 'Founder posts'], ['lincal', 'Calendar'], ['social', 'Numbers'], ['contests', 'Contests']] },
  { id: 'creators', t: 'Creators', g: 'creators', art: 'ev-stream-desk', line: 'Who we’d work with, and where each conversation is.', tabs: [['creators', 'Creators'], ['infcal', 'Calendar'], ['connects', 'Outreach'], ['negotiate', 'Negotiation'], ['crm', 'Contacts']] },
  { id: 'partners', t: 'Partners', g: 'partners', art: 'partners-handshake', line: 'Brands, programmes and products to team up with.', tabs: [['collabs', 'Brand collabs'], ['partners', 'Deals'], ['integrations', 'Integrations']] },
  { id: 'events', t: 'Events', g: 'events', art: 'ev-mic-taping', line: 'Formats, run of show and the vendors behind them.', tabs: [['events', 'Formats'], ['eventlab', 'New formats'], ['runofshow', 'Run of show'], ['vendors', 'Vendors']] },
];
const secOf = (id) => SECTIONS.find((s) => s.tabs.some(([t]) => t === id));
const PROTO = 'Prototype, not reviewed. A first draft of where I’d start, made before talking to anyone at Wispr. Some of these ideas are probably bad; read everything as a question.';

function renderPlan(w, { name, start }) {
  const page = h('article.gos__page', { tabindex: '-1' });
  const signOut = async () => { try { await api('/logout', { method: 'POST' }); } catch { /* signing out locally anyway */ } token.set(null); loaded = null; w.body.dataset.ready = ''; w.close(); };
  const reset = () => { if (confirm('Clear your edits in Growth OS on this device?')) { for (const k of Object.keys(localStorage)) if (k.startsWith('wgos.') && k !== TOKEN) localStorage.removeItem(k); location.reload(); } };
  const top = h('div.gos__top', h('span.gos__sp'),
    wipNote(D.MORE.wip, (id) => go(id)),
    h('details.gos__menu', h('summary', { 'aria-label': 'Account' }, name ? name[0].toUpperCase() : '·'),
      h('div.gos__menupop', h('p', name ? `Signed in as ${name}` : 'Signed in'), h('button', { type: 'button', onclick: () => go('sources') }, 'Sources'), h('button', { type: 'button', onclick: reset }, 'Clear my edits'), h('button', { type: 'button', onclick: signOut }, 'Sign out'))));
  const icon = (g, size = 20) => { const s = h('span.grail__ic'); s.innerHTML = glyph(g, size); return s; };
  const railBtn = (id, label, g, onclick) => h('button.grail__b', { type: 'button', 'data-sec': id, onclick }, icon(g), h('span', label));
  const rail = h('nav.grail', { 'aria-label': 'Sections' },
    railBtn('home', 'Home', 'home', () => showHome()),
    SECTIONS.map((s) => railBtn(s.id, s.t, s.g, () => go(s.tabs[0][0]))));
  const mark = (id) => rail.querySelectorAll('.grail__b').forEach((b) => b.setAttribute('aria-current', String(b.dataset.sec === id)));
  const root = h('div.gos.gos--os', rail, h('div.gos__main', h('p.gos-proto.gos-proto--bar', h('b', 'Prototype, not reviewed. '), PROTO.replace(/^Prototype, not reviewed\. /, '')), page));
  w.body.replaceChildren(root);
  // the window's own title bar carries the open tickets and your account
  const bar = w.el.querySelector('.win__bar');
  bar.querySelector('.gos__top')?.remove();
  bar.append(top);

  function showHome() {
    mark('home');
    root.classList.remove('is-app');
    const soon = allCampaigns().filter((c) => c.art && statusOf(c) !== 'done').sort((a, b) => a.start.localeCompare(b.start)).slice(0, 4);
    page.replaceChildren(h('div.ghome',
      h('header.ghome__head',
        h('h2.ghome__hi', name ? `Hi ${name}.` : 'Hi.'),
        h('p.ghome__sub', 'Wispr Flow in India, December to May. The plan, the campaigns and the people, in eight sections.')),
      h('div.gsecs', SECTIONS.map((s) => h('button.gsec', { type: 'button', onclick: () => go(s.tabs[0][0]) },
        art(s.art, '', { ratio: '16/10' }),
        h('span.gsec__b', h('span.gsec__t', s.t), h('span.gsec__l', s.line), h('span.gsec__tabs', s.tabs.map(([, t]) => t).join(' · ')))))),
      soon.length ? h('section.ghome__group', h('h3.ghome__g', 'Coming up'),
        h('div.home-strip', soon.map((c) => h('button.ccard', { type: 'button', style: { '--c': tone(c.c) }, onclick: () => go('campaigns', { focus: c.id }) },
          art(c.art, '', { ratio: '4/3' }), h('span.ccard__b', h('span.ccard__t', c.name), h('span.ccard__m', monthSpan(c), ' · ', statusOf(c))))))) : null));
    page.scrollTop = 0;
  }
  function go(id, opts = {}) {
    const m = mod(id);
    if (!m) return showHome();
    const s = secOf(id);
    mark(s?.id || '');
    root.classList.add('is-app');
    page.style.setProperty('--c', m.c);
    const tabsRow = s ? h('div.gsec-head',
      h('h2.gsec-head__t', s.t),
      s.tabs.length > 1 ? h('div.gtabs.gsec-tabs', { role: 'tablist' }, s.tabs.filter(([t]) => mod(t)).map(([t, label]) => h('button.gtab', { type: 'button', role: 'tab', 'aria-selected': String(t === id), onclick: () => go(t) }, label))) : null) : null;
    page.replaceChildren(...[tabsRow, h('div.gsec-body', ...[].concat(m.render(m, { go, ...opts })))].filter(Boolean));
    page.scrollTop = 0;
    if (!opts.quiet) sound.tick('click');
    if (isNarrow()) page.focus({ preventScroll: true });
  }
  w.go = go;
  if (start) go(start, { quiet: true }); else showHome();
}

// ================================================================ modules

// ---------------------------------------------------------------- start here
function home(m, { go }) {
  const P = D.PLAN;
  return [
    head({ ...m, kicker: 'Read this first' }, null),
    h('p.lede', rich(P.thesis)),
    h('div.home-strip', allCampaigns().filter((c) => c.art).sort((a, b) => a.start.localeCompare(b.start)).map((c) => h('button.ccard', { type: 'button', style: { '--c': tone(c.c) }, onclick: () => go('campaigns', { focus: c.id }) },
      art(c.art, '', { ratio: '4/3' }), h('span.ccard__b', h('span.ccard__t', c.name), h('span.ccard__m', monthSpan(c)))))),
    gboxW('The bet, in three lines', ul(P.bets)),
    gbox('Month by month', h('div.gos-grid', P.days90.map((p) => h('div.card', h('div.card__top', h('p.card__t', p.t)), ul(p.items))))),
    gbox('What we need to start', ul(P.asks)),
    h('div.row', h('button.btn.btn--primary', { type: 'button', onclick: () => go('dash') }, 'See how it’s measured →'), h('button.btn', { type: 'button', onclick: () => go('campaigns') }, 'Open campaigns')),
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
const statusOf = (c) => (STATUSES.includes(S.status[c.id]) ? S.status[c.id] : STATUSES.includes(c.status) ? c.status : 'idea');
const CAMP_COLS = [['idea', 'Ideas'], ['planned', 'Planned'], ['live', 'Live'], ['done', 'Done']];
const monthSpan = (c) => { const f = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short' }); const a = f(c.start), z = f(c.end); return a === z ? a : `${a} – ${z}`; };
function campaigns(m, opts) {
  const list = allCampaigns().sort((a, b) => a.start.localeCompare(b.start));
  const detail = h('div.camp-detail');
  const rerender = (o = {}) => { const page = document.querySelector('.gos__page'); const keep = page?.scrollTop; page?.replaceChildren(...campaigns(m, { ...opts, ...o })); if (page) page.scrollTop = keep; };
  const open = (c) => { detail.replaceChildren(briefView(c, () => campaigns(m, { ...opts, focus: c.id }), opts)); detail.scrollIntoView({ behavior: 'smooth', block: 'start' }); sound.tick('pick'); };

  // the board: one column per stage, a picture on every card; drag a card, or set its stage in the brief
  const board = () => h('div.cboard', CAMP_COLS.map(([st, label]) => {
    const cards = list.filter((c) => statusOf(c) === st);
    const col = h('section.cboard__col', { ondragover: (e) => { e.preventDefault(); col.classList.add('is-over'); }, ondragleave: () => col.classList.remove('is-over'),
      ondrop: (e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) { S.status[id] = st; save(); sound.tick('pick'); rerender({ tab: 0 }); } } },
      h('h3.cboard__h', label, h('span', String(cards.length))),
      cards.length ? cards.map((c) => h('button.ccard', { type: 'button', draggable: 'true', style: { '--c': tone(c.c) }, ondragstart: (e) => e.dataTransfer.setData('text/plain', c.id), onclick: () => open(c) },
        c.art ? art(c.art, '', { ratio: '16/9' }) : h('span.ccard__swatch'),
        h('span.ccard__b', h('span.ccard__t', c.name), h('span.ccard__p', c.line || rich(c.goal)), h('span.ccard__m', monthSpan(c), ' · ', c.owner || 'Owner tbc'))))
        : h('p.cboard__empty', 'Nothing here yet'));
    return col;
  }));

  // the plan: months across, one bar per campaign
  const plan = () => {
    const first = D.CALENDAR.from, last = D.CALENDAR.to;
    const weeks = Math.ceil(days(first, last) / 7);
    const x = (d) => `calc(${Math.max(0, days(first, d)) / 7} * var(--wk))`;
    const months = [];
    for (let d = new Date(first + 'T00:00:00'); d <= new Date(last + 'T00:00:00'); d.setMonth(d.getMonth() + 1, 1)) months.push(new Date(d));
    const tl = h('div.tl', { style: { '--n': weeks } }, h('div.tl__in',
      h('div.tl__months', h('div', { style: { padding: '0 8px' } }, 'Campaign'), h('div.tl__mrow', months.map((d) => h('span.tl__m', { style: { left: x(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`) } }, d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }))))),
      h('div', { style: { position: 'relative' } },
        list.map((c) => h('div.tl__row', h('button.tl__name', { type: 'button', onclick: () => open(c) }, c.name),
          h('div.tl__track', h('button.tl__bar', { type: 'button', title: `${c.name}: ${fmtD(c.start)} – ${fmtD(c.end)}`, 'aria-label': c.name, onclick: () => open(c), style: { left: x(c.start), width: `max(8px, calc(${Math.max(1, days(c.start, c.end)) / 7} * var(--wk)))`, '--c': tone(c.c) || 'var(--bondi)' } })))),
        h('div', { style: { position: 'absolute', inset: '0 0 0 220px', pointerEvents: 'none' } },
          TODAY >= first && TODAY <= last ? h('span.tl__mark.tl__today', { style: { left: x(TODAY), top: '0' } }, h('span.tl__marklabel', 'Today')) : null))));
    const byMonth = {};
    list.forEach((c) => { const k = c.start.slice(0, 7); (byMonth[k] ||= []).push(c); });
    const agenda = h('div.agenda', Object.entries(byMonth).map(([k, cs]) => h('div',
      h('p.agenda__m', new Date(k + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })),
      h('div.agenda__list', cs.map((c) => campCard(c, () => open(c)))))));
    return [tl, agenda];
  };

  const form = newCampaignForm(() => campaigns(m, opts));
  const view = [
    head(m, D.CALENDAR.why, h('button.btn.btn--primary.btn--sm', { type: 'button', onclick: () => { form.hidden = !form.hidden; } }, '+ New campaign')),
    form,
    tabs(['Board', 'Plan'], (i) => (i ? plan() : board()), opts.tab || 0),
    detail,
  ];
  if (opts.focus) { const f = list.find((c) => c.id === opts.focus); if (f) detail.append(briefView(f, () => campaigns(m, { ...opts, focus: f.id }), opts)); }
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
  // data-camp / data-guide: the campaign's own short guide (js/guide/page.js plays it the first time this brief opens)
  return h('article.brief', { style: { '--c': tone(c.c) }, dataset: { camp: c.id, guide: c.guide ? JSON.stringify({ name: c.name, ...c.guide }) : '' } },
    h('div.brief__head',
      h('div', h('h3.brief__t', c.name), h('p.brief__dates', `${fmtD(c.start)} – ${fmtD(c.end)} · ${c.owner || 'Owner: tbc'}`), c.line && h('p.brief__line', c.line)),
      h('div.row', { style: { marginTop: 0 } }, tag(st), select(st, STATUSES, (v) => { S.status[c.id] = v; save(); const keep = page?.scrollTop; page?.replaceChildren(...rerender()); if (page) page.scrollTop = keep; }, 'Status'),
        copyBtn(() => briefText(c), 'Copy brief'))),
    h('dl.dl',
      h('dt', 'The idea'), h('dd', rich(c.idea)),
      c.why && [h('dt', 'Why it works'), h('dd', rich(c.why))],
      c.map?.length && [h('dt', 'What each mod captures'), h('dd', h('ul.ul', c.map.map((m) => h('li', h('strong', m.mod), ': ', m.job, h('span', { style: { opacity: 0.8, whiteSpace: 'nowrap' } }, ` (${m.state})`)))))],
      c.steps?.length && [h('dt', 'First 3 steps'), h('dd', h('ol.ul', c.steps.map((t) => h('li', rich(t)))))],
      h('dt', 'Cost and effort'), h('dd', rich(c.budget || 'tbc')),
      h('dt', 'KPIs'), h('dd', ul(c.kpis || [])),
      c.example && [h('dt', 'Real example'), h('dd', rich(c.example))],
      c.install && [h('dt', 'How it installs'), h('dd', rich(c.install))],
      protosOf(c).length && [h('dt', protosOf(c).length > 1 ? 'Try the prototypes' : 'Try the prototype'), h('dd', h('ul.ul', protosOf(c).map(protoLink)))],
      h('dt', 'Goal'), h('dd', rich(c.goal)),
      h('dt', 'Who for'), h('dd', rich(c.audience)),
      h('dt', 'The insight'), h('dd', rich(c.insight)),
      h('dt', 'Channels'), h('dd', rich((c.channels || []).join(' · '))),
      c.links?.length && [h('dt', 'Uses'), h('dd', c.links.map((l, i) => [i ? ' · ' : '', h('a', { href: '#', onclick: (e) => { e.preventDefault(); go?.(l.mod); } }, l.t)]))]),
    gbox('Second-order', secondOrder(c.so)));
}
// a prototype page that isn't up yet shows as "being built" instead of a dead link
const protosOf = (c) => c.protos || (c.proto ? [c.proto] : []);
function protoLink(p) {
  const li = h('li', p.t, h('span', { style: { opacity: 0.8, whiteSpace: 'nowrap' } }, ' (being built)'));
  fetch(p.href, { method: 'HEAD', cache: 'no-store' }).then((r) => { if (r.ok) li.replaceChildren(h('a', { href: p.href, target: '_blank', rel: 'noopener' }, p.t)); }, () => {});
  return li;
}
function briefText(c) {
  return [`${c.name} (${fmtD(c.start)} – ${fmtD(c.end)})`, '', c.line || '', c.why ? `Why it works: ${c.why}` : '', ...(c.steps?.length ? ['First 3 steps:', ...c.steps.map((s, i) => `${i + 1}. ${s}`)] : []), ...(c.map?.length ? ['What each mod captures:', ...c.map.map((m) => `- ${m.mod}: ${m.job} (${m.state})`)] : []), c.example ? `Real example: ${c.example}` : '', ...protosOf(c).map((p) => `Prototype: ${p.t}, https://sameep.ai${p.href}`), '', `Goal: ${c.goal}`, `Who for: ${c.audience}`, `Insight: ${c.insight}`, `Idea: ${c.idea}`, `Channels: ${(c.channels || []).join(', ')}`, 'KPIs:', ...(c.kpis || []).map((k) => '- ' + k), `Budget: ${c.budget || 'tbc'}`, '', 'Second-order',
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
  // a picture on every event (the plan's own art)
  const EV_ART = { tvt: 'ev-stream-desk', mic: 'ev-mic-taping', booth: 'ev-vo-booth', inbox: 'mb-monsoon-office', build: 'sb-startup-7', fest: 'ev-city-drop' };
  const cards = h('div.cgrid', D.EVENTS.map((e) => h('button.ccard', { type: 'button', 'aria-pressed': 'false', style: { '--c': tone(e.c) }, onclick: (ev) => show(e, ev.currentTarget) },
    EV_ART[e.id] ? art(EV_ART[e.id], '', { ratio: '16/9' }) : h('span.ccard__swatch'),
    h('span.ccard__b', h('span.ccard__t', e.name), h('span.ccard__p', e.one), h('span.ccard__m', e.where)))));
  function show(e, btn) {
    on = e.id;
    cards.querySelectorAll('.ccard').forEach((c) => c.setAttribute('aria-pressed', String(c === btn)));
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
    const body = h('div.crgrid');
    const count = h('span.small', { style: { margin: 0 } });
    const draw = () => {
      const rows = D.CREATORS.filter((c) => (q.region === 'all' || c.region === q.region) && (q.bucket === 'all' || c.bucket === q.bucket) && (q.tier === 'all' || c.tier === q.tier) && (!q.starred || S.stars[c.handle]) && (!q.fresh || !c.promotedWispr) &&
        (!q.text || [c.name, c.handle, c.fit, c.bucket, c.niche].join(' ').toLowerCase().includes(q.text)));
      count.textContent = `${rows.length} of ${D.CREATORS.length}`;
      // a card per creator: face first, then reach, then one line on fit (the rest on tap)
      body.replaceChildren(...rows.map((c) => h('article.crcard',
        h('div.crcard__top', avatar({ name: c.name, photo: c.photo, size: 56 }),
          h('button.star', { type: 'button', 'aria-pressed': String(!!S.stars[c.handle]), 'aria-label': 'Shortlist ' + c.name, onclick: (e) => { S.stars[c.handle] = !S.stars[c.handle]; if (S.stars[c.handle] && stageOf(c) === 'found') S.stages[c.handle] = 'shortlisted'; save(); e.currentTarget.setAttribute('aria-pressed', String(!!S.stars[c.handle])); } }, '★')),
        h('h4.crcard__n', c.name),
        h('p.crcard__m', [first(c.followers), c.tier, c.region === 'IN' ? 'India' : 'Global'].filter(Boolean).join(' · ')),
        h('span.tags', c.pick ? tag('Top pick', 'approved') : null, c.dont ? tag('Conflict: builds a competing app', 'warn') : null, c.promotedWispr ? tag('Already with Flow', 'done') : null),
        h('details.fit', h('summary', rich(c.fit)), c.format && h('p', h('b', 'Format: '), c.format), c.risk && h('p', h('b', 'Watch: '), c.risk), h('p.muted', first(c.handle), ' · as of ', c.followersAsOf || '?', ' · ', c.source && h('a', { href: safeHttp(c.source), target: '_blank', rel: 'noopener' }, 'source ↗'))))));
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
      body,
      h('p.note', 'Public creators, researched for fit. Nobody here has been contacted. Counts are approximate, dated on each card.'),
    ];
    draw();
    return view;
  }

  function pipeline() {
    const list = D.CREATORS.filter((c) => S.stars[c.handle] || stageOf(c) !== 'found');
    if (!list.length) return h('div.empty', 'Star creators in Discover to start a pipeline. Each one moves from contacted → replied → briefed → live → rights cleared.');
    // a kanban: one column per stage, a face on every card; ← → moves a creator along
    const cols = STAGES.filter((s) => s !== 'found' && s !== 'passed');
    const move = (c, d) => { const i = cols.indexOf(stageOf(c) === 'found' ? 'shortlisted' : stageOf(c)); const n = cols[Math.min(cols.length - 1, Math.max(0, i + d))]; S.stages[c.handle] = n; save(); sound.tick('click'); paint(); };
    const wrap = h('div');
    const paint = () => wrap.replaceChildren(h('div.kb', cols.map((st) => {
      const cs = list.filter((c) => (stageOf(c) === 'found' ? 'shortlisted' : stageOf(c)) === st);
      return h('section.kb__col', h('h3.cboard__h', st, h('span', String(cs.length))),
        cs.length ? cs.map((c) => h('div.kb__card', avatar({ name: c.name, photo: c.photo, size: 44 }),
          h('div.kb__t', h('b', c.name), h('span', first(c.followers) || c.tier)),
          h('div.kb__mv', h('button', { type: 'button', 'aria-label': 'Back a stage', onclick: () => move(c, -1) }, '←'), h('button', { type: 'button', 'aria-label': 'Next stage', onclick: () => move(c, 1) }, '→'))))
          : h('p.cboard__empty', 'Nobody here'));
    })), h('p.note', 'Star creators in Discover to add them here. Moving a card sends nothing.'));
    paint();
    return wrap;
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
