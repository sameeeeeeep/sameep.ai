// app.js: the shell and the router. Shared and frozen (owned by Design).
// Routes are hashes: #/w/<workspace>/<section>/<params...>, e.g. #/w/unfiltrd/chats/ops, #/w/unfiltrd/os/pos.
// A magic link lands with #s=<token> (or #s=expired); the token is kept and dropped from the address bar.
//
// Page contract (pages/<name>.js): export `title`, a pure `view(data, ctx)` (string-in, string-out, no DOM,
// so Node can test it) and `mount(root, ctx)`, which fetches, renders and binds; it may return a cleanup fn.
// ctx = { wid, ws: {id, name, demo, role}, role, me: {user, workspaces}, params, api, go, toast, refreshMe }
import { api, apiBase, token, ApiError } from './api.js';
import { html, esc, ROLE_NAMES } from './ui.js';

export const NAV = [
  { section: 'today',   label: 'Today',               page: '../pages/today.js' },
  { section: 'chats',   label: 'Chats',               page: '../pages/chats.js' },
  { section: 'hub',     label: 'Hub and connections', page: '../pages/hub.js' },
  { section: 'os',      label: 'OS',                  page: '../pages/os.js' },
  { section: 'team',    label: 'Team',                page: '../pages/team.js' },
  { section: 'billing', label: 'Billing',             page: '../pages/billing.js' },
];

// Pure: '#/w/unfiltrd/os/pos' -> { wid: 'unfiltrd', section: 'os', params: ['pos'] }
export function parseHash(hash) {
  const p = String(hash || '').replace(/^#\/?/, '').split('/').filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch { return s; } });
  if (p[0] !== 'w' || !p[1]) return { wid: null, section: null, params: [] };
  return { wid: p[1], section: NAV.some((n) => n.section === p[2]) ? p[2] : null, params: p.slice(3) };
}
export const hrefFor = (wid, section, ...params) => '#/' + ['w', wid, section, ...params].map(encodeURIComponent).join('/');

if (typeof document !== 'undefined') boot();

function boot() {
  const $ = (id) => document.getElementById(id);
  apiBase(); // resolve (and on localhost remember) ?api= before the hash or search changes
  let me = null, cleanup = null, linkExpired = false;

  const m = location.hash.match(/^#s=([a-z0-9]+)$/i);
  if (m) {
    if (m[1] === 'expired') linkExpired = true; else token.set(m[1]);
    history.replaceState(null, '', location.pathname + location.search);
  }

  const toast = (msg) => {
    const t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3200);
  };

  async function showSignin() {
    if (cleanup) { try { cleanup(); } catch { /* */ } cleanup = null; }
    me = null;
    $('shell').hidden = true; $('signin').hidden = false;
    const mod = await import('../pages/signin.js');
    const email = new URLSearchParams(location.search).get('email') || '';
    mod.mount($('signin'), { api, token, expired: linkExpired, email, toast, onSignedIn: start });
    linkExpired = false;
  }

  async function loadMe() { me = await api('GET', '/me'); return me; }

  async function start() {
    if (!token.get()) return showSignin();
    try { await loadMe(); } catch (e) {
      if (e instanceof ApiError && e.status === 401) return showSignin();
      $('signin').hidden = false; $('signin').innerHTML = String(html`<div class="si"><h1>Can’t open your workspace</h1><p class="si-note">${e.message}</p><button class="btn" id="retry">Try again</button></div>`);
      $('retry').onclick = start; return;
    }
    $('signin').hidden = true; $('shell').hidden = false;
    $('who').textContent = me.user.name ? `${me.user.name} · ${me.user.email}` : me.user.email;
    route();
  }

  async function route() {
    if (!me) return;
    if (!me.workspaces.length) {
      $('nav').innerHTML = ''; $('ws').innerHTML = ''; $('banner').innerHTML = '';
      $('page').innerHTML = String(html`<section class="pg"><h1 class="pg-h">No workspace yet</h1><p class="pg-sub">This email is signed in but not part of a workspace. Ask your admin to add you.</p></section>`);
      return;
    }
    const r = parseHash(location.hash);
    const ws = me.workspaces.find((w) => w.id === r.wid);
    if (!ws || !r.section) { location.replace(hrefFor(ws ? ws.id : me.workspaces[0].id, 'today')); return; }

    $('ws').innerHTML = me.workspaces.map((w) => `<option value="${esc(w.id)}"${w.id === ws.id ? ' selected' : ''}>${esc(w.name)}</option>`).join('');
    $('ws').disabled = me.workspaces.length < 2;
    $('role').textContent = ROLE_NAMES[ws.role] || ws.role;
    $('nav').innerHTML = NAV.map((n) => `<a href="${hrefFor(ws.id, n.section)}"${n.section === r.section ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`).join('');
    $('banner').innerHTML = ws.demo ? String(html`<div class="demo-banner"><b>Sample data.</b> ${ws.name} is in demo mode: the numbers and people are made up, and nothing is sent anywhere.</div>`) : '';

    if (cleanup) { try { cleanup(); } catch { /* */ } cleanup = null; }
    const root = $('page');
    root.innerHTML = '<p class="loading">Loading</p>';
    const nav = NAV.find((n) => n.section === r.section);
    document.title = `${nav.label} · ${ws.name} · D2C Clone`;
    const ctx = {
      wid: ws.id, ws, role: ws.role, me, params: r.params, api, toast,
      go: (section, ...params) => { location.hash = hrefFor(ws.id, section, ...params); },
      refreshMe: async () => { await loadMe(); route(); },
    };
    try {
      const mod = await import(nav.page);
      if (parseHash(location.hash).section !== r.section) return; // moved on while loading
      cleanup = (await mod.mount(root, ctx)) || null;
    } catch (e) {
      root.innerHTML = String(html`<section class="pg"><h1 class="pg-h">${nav.label}</h1><p class="err">${e.status === 501 ? 'This part is still being built.' : e.message}</p></section>`);
    }
  }

  $('ws').addEventListener('change', (e) => { location.hash = hrefFor(e.target.value, 'today'); });
  $('signout').addEventListener('click', async () => {
    try { await api('POST', '/auth/logout'); } catch { /* signed out anyway */ }
    token.set(null); showSignin();
  });
  addEventListener('hashchange', route);
  addEventListener('d2c:signedout', showSignin);
  start();
}
