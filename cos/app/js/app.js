// app.js: the shell and the router for the brandcos product.
// Routes are hashes: #/w/<workspace>/<section>/<params...>, e.g. #/w/acme/chats/ops, #/w/acme/os/pos.
// A magic link lands with #l=<link token>: the sign-in screen asks the person to tap "Open my workspace",
// which POSTs it to /auth/link for a session. Opening the link alone (a mail scanner) changes nothing.
// #s=expired means the link was malformed. #demo opens a fresh sample workspace with no email (POST /demo);
// #demo?brand=<id> (Try the demo at the end of a brandcos show) opens one carrying that show's brand.
// Either way the hash is dropped from the address bar.
//
// Shell: an icon rail (sections), a breadcrumb with the "agents live" pill, the page, and an ask bar that asks the
// brain (js/ask.js: POST brain/ask, then the job) and shows its lines with their sources. When the brain is offline
// it falls back to the demo engine's answer in All hands, labelled as the demo answer.
//
// Page contract (pages/<name>.js): export `title`, a pure `view(data, ctx)` (string-in, string-out, no DOM,
// so Node can test it) and `mount(root, ctx)`, which fetches, renders and binds; it may return a cleanup fn.
// ctx = { wid, ws: {id, name, demo, role}, role, me: {user, workspaces}, params, api, go, toast, refreshMe }
import { api, apiBase, token, ApiError } from './api.js';
import { html, esc, ROLE_NAMES, ICONS, can } from './ui.js';
import { askView, runAsk } from './ask.js';
import './steps.js'; // human steps: any [data-step-open] row opens its sheet

// The four Chief of Staff surfaces come first (Feed, Chat, OS, Hub: pages/feed.js, chat.js, cosos.js, coshub.js,
// all built on js/cos.js). The rest of the product follows under a divider (`more`).
export const NAV = [
  { section: 'feed',    label: 'Feed',    page: '../pages/feed.js' },
  { section: 'chat',    label: 'Chat',    page: '../pages/chat.js' },
  { section: 'os',      label: 'OS',      page: '../pages/cosos.js' },
  { section: 'hub',     label: 'Hub',     page: '../pages/coshub.js' },
  { section: 'today',   label: 'Today',   page: '../pages/today.js', more: true },
  { section: 'standup', label: 'Standup', page: '../pages/standup.js', more: true },
  { section: 'company', label: 'Company', page: '../pages/company.js', more: true },
  { section: 'inbox',   label: 'Inbox',   page: '../pages/inbox.js', more: true },
  { section: 'chats',   label: 'Work',    page: '../pages/chats.js', more: true },
  { section: 'team',    label: 'Team',    page: '../pages/team.js', more: true },
  { section: 'hiring',  label: 'Hiring',  page: '../pages/hiring.js', more: true },
  { section: 'billing', label: 'Billing', page: '../pages/billing.js', more: true },
];
export const HOME = 'feed';

// agents running (the world's 19 functions share 16 agents; the shell's pill links to the Feed)
export const AGENTS = 16;

// what the ask bar offers on each screen
export const ASKS = {
  feed: ['How are sales today?', 'What is waiting for a tap?', 'When is the launch?'],
  chat: ['How are sales today?', 'What is the stock cover?'],
  today: ['What needs me today?', 'What stocks out this week?', 'How did ads do yesterday?'],
  chats: ['What is everyone working on?', 'What is waiting for a tap?'],
  hub: ['How are sales today?', 'How is RTO?', 'What is the cash runway?'],
  os: ['What is the stock cover?', 'Which vendor invoices are open?', 'What is waiting for a tap?'],
  company: ['Which function is behind?', 'What is waiting on a tap for the launch?', 'What did the agents do today?'],
  inbox: ['What did the agent find today?', 'What is overdue?', 'What is waiting on me?'],
  hiring: ['Which roles are open?', 'Who is on the shortlist?'],
  team: ['Who still needs to sign in?', 'Who approves money items?'],
  billing: ['When is the next invoice due?', 'What does month 2 cost?'],
};

// Pure: '#/w/acme/os/pos' -> { wid: 'acme', section: 'os', params: ['pos'] }
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

// the ask bar's answer panel lives in js/ask.js (the brain, with the demo answer only when it is offline)
export { askView };

// #demo, or #demo?brand=<id> from the end of a show. A well-formed id is the only parameter read.
export const DEMO_HASH = /^#demo(\?brand=[a-z0-9-]{0,40})?$/i;
export const demoBrand = (hash) => { const m = String(hash || '').match(/^#demo\?brand=([a-z0-9][a-z0-9-]{1,23})$/i); return m ? m[1].toLowerCase() : null; };

if (typeof document !== 'undefined') boot();

function boot() {
  const $ = (id) => document.getElementById(id);
  apiBase(); // resolve (and on localhost remember) ?api= before the hash or search changes
  let me = null, cleanup = null, linkExpired = false, linkToken = null, wantDemo = false, wantPin = false, seq = 0, cur = null, ask = null;

  const m = location.hash.match(/^#([sl])=([a-z0-9]+)$/i);
  if (m) {
    if (m[1] === 'l' && /^[a-f0-9]{48}$/.test(m[2])) linkToken = m[2]; else linkExpired = true;
    history.replaceState(null, '', location.pathname + location.search);
  } else if (/^#pin$/i.test(location.hash)) {
    // #pin: a private workspace behind a PIN. The Worker checks the PIN (POST /auth/pin) and answers with a session.
    wantPin = true;
    history.replaceState(null, '', location.pathname + location.search);
  } else if (DEMO_HASH.test(location.hash)) {
    wantDemo = demoBrand(location.hash) || true;
    history.replaceState(null, '', location.pathname + location.search);
  }

  const toast = (msg) => {
    const t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3400);
  };

  // a fresh sample workspace for this visitor, no email: the worker's POST /demo
  async function openDemo(brand = null) {
    $('signin').hidden = false; $('shell').hidden = true;
    $('signin').innerHTML = String(html`<div class="si"><p class="si-note">Opening the demo workspace</p></div>`);
    try {
      // #demo?brand=<id> (the end of a brandcos show): the copy carries that show's brand; the Worker falls back to
      // the sample brand for an id it does not know
      const r = await api('POST', brand ? `/demo?brand=${encodeURIComponent(brand)}` : '/demo');
      token.set(r.token);
      history.replaceState(null, '', location.pathname + location.search + hrefFor(r.workspace.id, HOME));
      return true;
    } catch (e) {
      $('signin').innerHTML = String(html`<div class="si"><h1>The demo did not open</h1><p class="si-note">${e.message}</p><p class="si-alt"><button class="btn is-primary" id="retry" type="button">Try again</button></p></div>`);
      $('retry').onclick = () => { wantDemo = brand || true; start(); };
      return false;
    }
  }

  function showPin() {
    $('shell').hidden = true; $('signin').hidden = false;
    $('signin').innerHTML = String(html`<div class="si"><a class="si-brand" href="../"><span class="si-mark" aria-hidden="true">C</span>Chief of Staff</a>
      <h1>Enter the PIN</h1>
      <form id="pin-form" class="si-form" novalidate>
        <label class="field"><span>PIN</span><input id="pin-in" name="pin" type="password" inputmode="numeric" autocomplete="off" pattern="[0-9]*" maxlength="12" required autofocus></label>
        <button class="btn is-primary" type="submit" id="pin-go">Open</button>
        <p class="err" role="alert" id="pin-err" hidden></p>
      </form></div>`);
    $('pin-form').onsubmit = async (e) => {
      e.preventDefault();
      const err = $('pin-err'), go = $('pin-go');
      err.hidden = true; go.disabled = true; go.textContent = 'Checking';
      try {
        const r = await api('POST', '/auth/pin', { pin: $('pin-in').value });
        token.set(r.token);
        history.replaceState(null, '', location.pathname + location.search + hrefFor(r.workspace, HOME));
        start();
      } catch (x) {
        err.textContent = x.message || 'That PIN is not right.'; err.hidden = false;
        go.disabled = false; go.textContent = 'Open'; $('pin-in').select();
      }
    };
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
    if (wantPin) { wantPin = false; return showPin(); }
    if (wantDemo) {
      const brand = typeof wantDemo === 'string' ? wantDemo : null;
      wantDemo = false;
      // already in a demo from this device: go back to it rather than making another (for a show brand, only a copy
      // of that brand counts: its workspace carries the brand's name)
      const same = (w) => w.id.startsWith('demo-') && (!brand || w.name.toLowerCase() === brand);
      let reuse = false;
      if (token.get()) { try { await loadMe(); reuse = me.workspaces.some(same); } catch { /* new demo */ } }
      if (reuse) location.replace(hrefFor(me.workspaces.find(same).id, HOME));
      else if (!(await openDemo(brand))) return;
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

  // The brain answers when it is online for this workspace; only when it is offline (503) does the demo engine's
  // answer show, posted in All hands as before and labelled "Brain offline, showing the demo answer".
  let askRun = 0;
  async function sendAsk(text) {
    const q = String(text || '').trim();
    if (!q || !cur || (ask && ask.busy)) return;
    const ws = cur, run = ++askRun;
    const alive = () => run === askRun && cur && cur.id === ws.id;
    const show = (st) => { if (!alive()) return; ask = st; paintAsk(ws, parseHash(location.hash).section); };
    show({ q, mode: 'brain', busy: true, status: 'queued' });
    $('ask-q').value = '';
    const fallback = async (question) => {
      const { as, changed } = await import('./cos.js');
      const r = await api('POST', `/w/${ws.id}/cos/threads/all-hands/messages`, { body: question, as: as(ws.id) });
      changed(ws.id);
      return r;
    };
    const st = await runAsk({ api, wid: ws.id, q, fallback, onState: show, alive });
    if (st) show(st);
  }
  const closeAsk = () => { askRun++; ask = null; if (cur) paintAsk(cur, parseHash(location.hash).section); };

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
    if (!ws || !r.section) { location.replace(hrefFor(ws ? ws.id : me.workspaces[0].id, HOME)); return; }
    if (cur && cur.id !== ws.id) { ask = null; askRun++; }
    cur = ws;

    const nav = NAV.find((n) => n.section === r.section);
    $('ws').innerHTML = me.workspaces.map((w) => `<option value="${esc(w.id)}"${w.id === ws.id ? ' selected' : ''}>${esc(w.name)}</option>`).join('');
    $('ws-pick').hidden = me.workspaces.length < 2;
    $('role').textContent = ROLE_NAMES[ws.role] || ws.role;
    const link = (n) => `<a href="${hrefFor(ws.id, n.section)}" aria-label="${esc(n.label)}"${n.more ? ' class="is-more"' : ''}${n.section === r.section ? ' aria-current="page"' : ''}>${ICONS[n.section] || ''}<span class="rail-tip" aria-hidden="true">${esc(n.label)}</span></a>`;
    $('nav').innerHTML = NAV.filter((n) => !n.more).map(link).join('') + '<span class="rail-sep" aria-hidden="true"></span>' + NAV.filter((n) => n.more).map(link).join('');
    // on a phone the bottom bar holds the four surfaces; the rest are in the account menu
    $('me-more').innerHTML = NAV.filter((n) => n.more).map((n) => `<a href="${hrefFor(ws.id, n.section)}">${esc(n.label)}</a>`).join('');
    $('crumb-ws').textContent = ws.name;
    $('crumb-sec').textContent = nav.label;
    document.body.dataset.section = r.section; // Chat has its own composer, so the shell's ask bar steps aside there
    const visitor = /@demo\.example$/.test(me.user.email);
    $('sample-pill').hidden = !ws.demo;
    $('sample-pill').textContent = visitor ? 'Demo copy, resets in a day' : 'Sample data';
    $('sample-pill').title = visitor ? 'Your own copy of a sample brand. Numbers and people are made up and nothing is sent anywhere.' : 'Demo mode: sample numbers, nothing is sent anywhere.';
    $('agents-n').textContent = `${AGENTS} agents running`;
    $('agents-pill').href = hrefFor(ws.id, 'feed');
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
      import('./guide.js').then((g) => g.mountGuide(ctx)).catch(() => { /* the panel is optional */ });
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
    if (e.key === 'Escape') { if (!menu.hidden) { setMenu(false); meBtn.focus(); } else if (ask && cur) closeAsk(); }
  });

  // ask bar
  $('ask').addEventListener('submit', (e) => { e.preventDefault(); sendAsk($('ask-q').value); });
  $('ask').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-q]');
    if (chip) { sendAsk(chip.dataset.q); return; }
    if (e.target.closest('[data-ask="close"]') && cur) closeAsk();
  });

  $('ws').addEventListener('change', (e) => { setMenu(false); location.hash = hrefFor(e.target.value, HOME); });
  $('signout').addEventListener('click', async () => {
    setMenu(false);
    try { await api('POST', '/auth/logout'); } catch { /* signed out anyway */ }
    token.set(null); ask = null; askRun++; cur = null; import('./guide.js').then((g) => g.unmountGuide()); showSignin();
  });
  addEventListener('hashchange', () => {
    if (DEMO_HASH.test(location.hash)) { wantDemo = demoBrand(location.hash) || true; history.replaceState(null, '', location.pathname + location.search); start(); return; }
    route();
  });
  addEventListener('d2c:signedout', showSignin);
  start();
}
