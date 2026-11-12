// app.js: the shell and the router for the brandcos product.
// Routes are hashes: #/w/<workspace>/<section>/<params...>, e.g. #/w/unfiltrd/chats/ops, #/w/unfiltrd/os/pos.
// A magic link lands with #l=<link token>: the sign-in screen asks the person to tap "Open my workspace",
// which POSTs it to /auth/link for a session. Opening the link alone (a mail scanner) changes nothing.
// #s=expired means the link was malformed. #demo opens a fresh sample workspace with no email (POST /demo).
// Either way the hash is dropped from the address bar.
//
// Shell: an icon rail (sections), a breadcrumb with the "agents live" pill, the page, and an ask bar that
// sends a line to the chief of staff in All hands (POST chats/all-hands/messages) and shows the answer.
//
// Page contract (pages/<name>.js): export `title`, a pure `view(data, ctx)` (string-in, string-out, no DOM,
// so Node can test it) and `mount(root, ctx)`, which fetches, renders and binds; it may return a cleanup fn.
// ctx = { wid, ws: {id, name, demo, role}, role, me: {user, workspaces}, params, api, go, toast, refreshMe }
import { api, apiBase, token, ApiError } from './api.js';
import { html, esc, ROLE_NAMES, ICONS, can } from './ui.js';

export const NAV = [
  { section: 'today',   label: 'Today',   page: '../pages/today.js' },
  { section: 'inbox',   label: 'Inbox',   page: '../pages/inbox.js' },
  { section: 'chats',   label: 'Work',    page: '../pages/chats.js' },
  { section: 'hub',     label: 'Hub',     page: '../pages/hub.js' },
  { section: 'os',      label: 'OS',      page: '../pages/os.js' },
  { section: 'team',    label: 'Team',    page: '../pages/team.js' },
  { section: 'hiring',  label: 'Hiring',  page: '../pages/hiring.js' },
  { section: 'billing', label: 'Billing', page: '../pages/billing.js' },
];

// one agent per chat group (the worker's catalog GROUPS)
export const AGENTS = 7;

// what the ask bar offers on each screen
export const ASKS = {
  today: ['What needs me today?', 'What stocks out this week?', 'How did ads do yesterday?'],
  chats: ['What is everyone working on?', 'What is waiting for a tap?'],
  hub: ['Which tools have not synced today?', 'What does each agent read?'],
  os: ['What stocks out this week?', 'Which vendor invoices are due?', 'Draft a restock for low stock'],
  inbox: ['What did the agent find today?', 'What is overdue?', 'What is waiting on me?'],
  hiring: ['Which roles are open?', 'Who is on the shortlist?'],
  team: ['Who still needs to sign in?', 'Who approves money items?'],
  billing: ['When is the next invoice due?', 'What does month 2 cost?'],
};

// Pure: '#/w/unfiltrd/os/pos' -> { wid: 'unfiltrd', section: 'os', params: ['pos'] }
export function parseHash(hash) {
  const p = String(hash || '').replace(/^#\/?/, '').split('/').filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch { return s; } });
  if (p[0] !== 'w' || !p[1]) return { wid: null, section: null, params: [] };
  return { wid: p[1], section: NAV.some((n) => n.section === p[2]) ? p[2] : null, params: p.slice(3) };
}
export const hrefFor = (wid, section, ...params) => '#/' + ['w', wid, section, ...params].map(encodeURIComponent).join('/');

// Pure: 'Riya Shah' -> 'RS', 'asha@x.example' -> 'AS'
export const initials = (name, email) => {
  const w = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (w.length > 1) return (w[0][0] + w[w.length - 1][0]).toUpperCase();
  return String(w[0] || String(email || '').split('@')[0] || '?').slice(0, 2).toUpperCase();
};

// Pure: the ask bar's answer panel. state = { q, busy, error, replies: [{author_name, body}], sent }
export function askView(s, wid) {
  if (!s) return '';
  const body = s.busy
    ? html`<p class="ask-ans-b muted">Asking the chief of staff</p>`
    : s.error
      ? html`<p class="ask-ans-b err">${s.error}</p>`
      : (s.replies || []).length
        ? s.replies.map((r) => html`<p class="ask-ans-b">${r.body}</p>`)
        : html`<p class="ask-ans-b">Sent to All hands. The chief of staff answers there, and the team sees it too.</p>`;
  const who = (s.replies || [])[0]?.author_name || 'Chief of staff';
  return html`<div class="ask-ans-h"><b>${who}</b><button class="ask-x" type="button" data-ask="close">Close</button></div>
    <p class="ask-ans-q">You asked: ${s.q}</p>${body}
    ${s.busy ? '' : html`<p class="ask-ans-f"><a class="linkish" href="${hrefFor(wid, 'chats', 'all-hands')}" data-ask="close">Open the thread in Work</a></p>`}`;
}

if (typeof document !== 'undefined') boot();

function boot() {
  const $ = (id) => document.getElementById(id);
  apiBase(); // resolve (and on localhost remember) ?api= before the hash or search changes
  let me = null, cleanup = null, linkExpired = false, linkToken = null, wantDemo = false, seq = 0, cur = null, ask = null;

  const m = location.hash.match(/^#([sl])=([a-z0-9]+)$/i);
  if (m) {
    if (m[1] === 'l' && /^[a-f0-9]{48}$/.test(m[2])) linkToken = m[2]; else linkExpired = true;
    history.replaceState(null, '', location.pathname + location.search);
  } else if (/^#demo$/i.test(location.hash)) {
    wantDemo = true;
    history.replaceState(null, '', location.pathname + location.search);
  }

  const toast = (msg) => {
    const t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3400);
  };

  // a fresh sample workspace for this visitor, no email: the worker's POST /demo
  async function openDemo() {
    $('signin').hidden = false; $('shell').hidden = true;
    $('signin').innerHTML = String(html`<div class="si"><p class="si-note">Opening the demo workspace</p></div>`);
    try {
      const r = await api('POST', '/demo');
      token.set(r.token);
      history.replaceState(null, '', location.pathname + location.search + hrefFor(r.workspace.id, 'today'));
      return true;
    } catch (e) {
      $('signin').innerHTML = String(html`<div class="si"><h1>The demo did not open</h1><p class="si-note">${e.message}</p><p class="si-alt"><button class="btn is-primary" id="retry" type="button">Try again</button></p></div>`);
      $('retry').onclick = () => { wantDemo = true; start(); };
      return false;
    }
  }

  async function showSignin() {
    if (cleanup) { try { cleanup(); } catch { /* */ } cleanup = null; }
    me = null;
    $('shell').hidden = true; $('signin').hidden = false;
    const mod = await import('../pages/signin.js');
    const email = new URLSearchParams(location.search).get('email') || '';
    mod.mount($('signin'), { api, token, expired: linkExpired, link: linkToken, email, toast, onSignedIn: start, onDemo: () => { wantDemo = true; start(); } });
    linkExpired = false; linkToken = null;
  }

  async function loadMe() { me = await api('GET', '/me'); return me; }

  async function start() {
    if (wantDemo) {
      wantDemo = false;
      // already in a demo from this device: go back to it rather than making another
      let reuse = false;
      if (token.get()) { try { await loadMe(); reuse = me.workspaces.some((w) => w.id.startsWith('demo-')); } catch { /* new demo */ } }
      if (reuse) location.replace(hrefFor(me.workspaces.find((w) => w.id.startsWith('demo-')).id, 'today'));
      else if (!(await openDemo())) return;
    }
    if (!token.get() || linkToken) return showSignin();
    try { await loadMe(); } catch (e) {
      if (e instanceof ApiError && e.status === 401) return showSignin();
      $('signin').hidden = false; $('signin').innerHTML = String(html`<div class="si"><h1>Can’t open your workspace</h1><p class="si-note">${e.message}</p><p class="si-alt"><button class="btn" id="retry" type="button">Try again</button></p></div>`);
      $('retry').onclick = start; return;
    }
    $('signin').hidden = true; $('shell').hidden = false;
    $('me-name').textContent = me.user.name || me.user.email.split('@')[0];
    $('me-mail').textContent = me.user.email;
    $('me-init').textContent = initials(me.user.name, me.user.email);
    route();
  }

  function paintAsk(ws, section) {
    const viewer = !can(ws.role, 'member');
    const q = $('ask-q');
    q.placeholder = viewer ? 'Viewers can read everything here; a member can ask the chief of staff.' : `Ask about ${ws.name}, or say what to do`;
    q.disabled = viewer; $('ask-send').disabled = viewer;
    $('ask-chips').innerHTML = viewer ? '' : (ASKS[section] || []).map((a) => `<button type="button" data-q="${esc(a)}">${esc(a)}</button>`).join('');
    const ans = $('ask-ans');
    ans.hidden = !ask; ans.innerHTML = ask ? String(askView(ask, ws.id)) : '';
  }

  async function sendAsk(text) {
    const q = String(text || '').trim();
    if (!q || !cur || (ask && ask.busy)) return;
    const ws = cur;
    ask = { q, busy: true }; paintAsk(ws, parseHash(location.hash).section);
    $('ask-q').value = '';
    try {
      const r = await api('POST', `/w/${ws.id}/chats/all-hands/messages`, { body: q });
      ask = { q, replies: (r.replies || []).filter((m) => m.body) };
    } catch (e) {
      ask = { q, error: e.message };
    }
    if (cur && cur.id === ws.id) paintAsk(ws, parseHash(location.hash).section);
  }

  async function route() {
    if (!me) return;
    const mine = ++seq; // a later route() makes this one stale
    if (!me.workspaces.length) {
      $('nav').innerHTML = ''; $('ws').innerHTML = ''; $('banner').innerHTML = '';
      $('crumb-ws').textContent = 'Chief of Staff'; $('crumb-sec').textContent = 'No workspace';
      $('page').innerHTML = String(html`<section class="pg"><h1 class="pg-h">No workspace yet</h1><p class="pg-sub">This email is signed in but not part of a workspace. Ask your admin to add you.</p></section>`);
      return;
    }
    const r = parseHash(location.hash);
    const ws = me.workspaces.find((w) => w.id === r.wid);
    if (!ws || !r.section) { location.replace(hrefFor(ws ? ws.id : me.workspaces[0].id, 'today')); return; }
    if (cur && cur.id !== ws.id) ask = null;
    cur = ws;

    const nav = NAV.find((n) => n.section === r.section);
    $('ws').innerHTML = me.workspaces.map((w) => `<option value="${esc(w.id)}"${w.id === ws.id ? ' selected' : ''}>${esc(w.name)}</option>`).join('');
    $('ws-pick').hidden = me.workspaces.length < 2;
    $('role').textContent = ROLE_NAMES[ws.role] || ws.role;
    $('nav').innerHTML = NAV.map((n) => `<a href="${hrefFor(ws.id, n.section)}" aria-label="${esc(n.label)}"${n.section === r.section ? ' aria-current="page"' : ''}>${ICONS[n.section] || ''}<span class="rail-tip" aria-hidden="true">${esc(n.label)}</span></a>`).join('');
    $('crumb-ws').textContent = ws.name;
    $('crumb-sec').textContent = nav.label;
    const visitor = /@demo\.example$/.test(me.user.email);
    $('sample-pill').hidden = !ws.demo;
    $('sample-pill').textContent = visitor ? 'Demo copy, resets in a day' : 'Sample data';
    $('sample-pill').title = visitor ? 'Your own copy of a sample brand. Numbers and people are made up and nothing is sent anywhere.' : 'Demo mode: sample numbers, nothing is sent anywhere.';
    $('agents-n').textContent = `${AGENTS} agents live`;
    $('agents-pill').href = hrefFor(ws.id, 'chats', 'all-hands');
    paintAsk(ws, r.section);

    if (cleanup) { try { cleanup(); } catch { /* */ } cleanup = null; }
    // a fresh #page per route: a slow page that finishes after the user moved on paints into a detached
    // node, and listeners a page bound on the old root go with it
    const old = $('page'), root = old.cloneNode(false);
    old.replaceWith(root);
    root.innerHTML = '<p class="loading">Loading</p>';
    document.title = `${nav.label} · ${ws.name} · Chief of Staff`;
    const ctx = {
      wid: ws.id, ws, role: ws.role, me, params: r.params, api, toast,
      go: (section, ...params) => { location.hash = hrefFor(ws.id, section, ...params); },
      refreshMe: async () => { await loadMe(); route(); },
      ask: (q) => sendAsk(q),
    };
    try {
      const mod = await import(nav.page);
      if (mine !== seq) return; // moved on while loading
      const done = (await mod.mount(root, ctx)) || null;
      if (mine !== seq) { if (done) { try { done(); } catch { /* */ } } return; } // moved on while mounting
      cleanup = done;
    } catch (e) {
      if (mine !== seq) return;
      root.innerHTML = String(html`<section class="pg"><h1 class="pg-h">${nav.label}</h1><p class="err">${e.status === 501 ? 'This part is still being built.' : e.message}</p></section>`);
    }
  }

  // account menu
  const menu = $('me-menu'), meBtn = $('me-btn');
  const setMenu = (open) => { menu.hidden = !open; meBtn.setAttribute('aria-expanded', String(open)); };
  meBtn.addEventListener('click', (e) => { e.stopPropagation(); setMenu(menu.hidden); });
  document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (!menu.hidden) { setMenu(false); meBtn.focus(); } else if (ask && cur) { ask = null; paintAsk(cur, parseHash(location.hash).section); } }
  });

  // ask bar
  $('ask').addEventListener('submit', (e) => { e.preventDefault(); sendAsk($('ask-q').value); });
  $('ask').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-q]');
    if (chip) { sendAsk(chip.dataset.q); return; }
    if (e.target.closest('[data-ask="close"]') && cur) { ask = null; paintAsk(cur, parseHash(location.hash).section); }
  });

  $('ws').addEventListener('change', (e) => { setMenu(false); location.hash = hrefFor(e.target.value, 'today'); });
  $('signout').addEventListener('click', async () => {
    setMenu(false);
    try { await api('POST', '/auth/logout'); } catch { /* signed out anyway */ }
    token.set(null); ask = null; cur = null; showSignin();
  });
  addEventListener('hashchange', () => {
    if (/^#demo$/i.test(location.hash)) { history.replaceState(null, '', location.pathname + location.search); wantDemo = true; start(); return; }
    route();
  });
  addEventListener('d2c:signedout', showSignin);
  start();
}
