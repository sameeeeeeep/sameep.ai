// mobile.js: the phone shell for COS. Loads after app.js and only adds things; the desktop
// shell is untouched (mobile.css shows all of this at 760 px and below, and hides the icon rail there).
//
//   The bottom tab bar   Dashboard, Chat (badged with the cards waiting for a tap or a check), Agents, More
//   More                 a bottom sheet with every other section
//   Needs you            (any [data-mb-needs]) a bottom sheet with one decision card at a time; its main button (the recommended option, or
//                        Check) sits pinned at the bottom of the sheet, in thumb reach. After a tap the next card shows.
//   The account button   in the top bar, opening the existing account menu (the rail that held it is hidden on a phone)
//
// Pure pieces (tabsView, needsView, mainAction, waiting) take plain data and return strings, so Node can test them.
import { html, raw, ICONS } from './ui.js';

export const TABS = [['home', 'COS'], ['tasks', 'Tasks'], ['chat', 'Chat']];
const BADGED = 'chat'; // where the work lives: each module's To do, and All modules
// what the More sheet lists (every other section)
export const MORE = [['dash', 'Dashboard'], ['products', 'Products'], ['canvas', 'Canvas'], ['agents', 'Agents'], ['hub', 'Hub'], ['today', 'Today'], ['standup', 'Standup'], ['company', 'Company'], ['inbox', 'Inbox'],
  ['chats', 'Work'], ['team', 'Members'], ['hiring', 'Hiring'], ['billing', 'Billing']];

// Pure: the cards that need a person (a tap or a check), newest first
export function waiting(decisions) {
  return Object.values(decisions || {}).filter((d) => d.status === 'open' || d.status === 'to_check').sort((a, b) => b.ts - a.ts);
}

// Pure: the bottom bar. wid, the section in view, the count waiting (a badge on Chat), and whether More is open
export function tabsView(wid, section, count, open = false) {
  const inMore = MORE.some(([k]) => k === section);
  const tab = ([k, label]) => html`<a class="mb-tab" href="#/w/${encodeURIComponent(wid)}/${k}"${raw(k === section && !open ? ' aria-current="page"' : '')}><span class="mb-ic">${raw(ICONS[k] || '')}${k === BADGED && count ? html`<span class="mb-badge mono">${count}</span>` : ''}</span><span class="mb-l">${label}${k === BADGED && count ? html`<span class="sr"> (${count} need you)</span>` : ''}</span></a>`;
  return html`${TABS.map(tab)}<button class="mb-tab" id="mb-more" type="button" aria-expanded="${String(open)}" aria-controls="mb-sheet"${raw(open || inMore ? ' aria-current="page"' : '')}><span class="mb-ic">${raw(ICONS.more || '')}</span><span class="mb-l">More</span></button>`;
}

// Pure: the More sheet, one big tile per section
export function moreView(wid, section) {
  return html`<header class="mb-sh-h"><h2>More</h2><button class="mb-x" type="button" data-mb="close">Close</button></header>
    <div class="mb-sh-b"><ul class="mb-more">${MORE.map(([k, l]) => html`<li><a href="#/w/${encodeURIComponent(wid)}/${k}"${raw(k === section ? ' aria-current="page"' : '')}><span class="mb-ic">${raw(ICONS[k] || '')}</span><span>${l}</span></a></li>`)}</ul></div>`;
}

// Pure: the card's main button, from the decision itself: the recommended option (else the first), or Check.
// Returns { dec, opt, label } or null when the current person cannot act on it.
export function mainAction(d) {
  if (!d) return null;
  if (d.status === 'to_check') return { dec: 'check', label: 'Check' };
  if (d.status !== 'open') return null;
  const o = d.options.find((x) => x.recommended) || d.options[0];
  if (!o) return null;
  const verb = d.kind === 'approve' ? 'Approve' : d.kind === 'ask' ? 'Answer' : 'Pick';
  return { dec: 'decide', opt: o.key, label: `${verb}: ${o.label}` };
}

// Pure: the sheet. list = waiting(...), cur = the id in view, card = decisionCard html for it
export function needsView(list, curId, card) {
  const i = Math.max(0, list.findIndex((d) => String(d.id) === String(curId)));
  const d = list[i];
  const head = html`<header class="mb-sh-h"><h2>Needs you</h2>${list.length ? html`<span class="mono muted">${i + 1} of ${list.length}</span>` : ''}<button class="mb-x" type="button" data-mb="close">Close</button></header>`;
  if (!d) return html`${head}<div class="mb-sh-b"><p class="mb-empty">Nothing needs you. The agents are on it.</p></div>`;
  const rest = list.filter((x) => x !== d);
  return html`${head}
    <div class="mb-sh-b">
      ${raw(String(card))}
      ${rest.length ? html`<h3 class="mb-next-h">Next</h3><ul class="mb-next">${rest.map((x) => html`<li><button type="button" data-mb="pick" data-id="${x.id}"><span>${x.title}</span><span class="muted">${x.status === 'open' ? `${x.decider?.name || 'Anyone'} ${x.kind === 'ask' ? 'is asked' : 'decides'}` : `${x.decided_by} decided · needs a check`}</span></button></li>`)}</ul>` : ''}
    </div>`;
}

if (typeof document !== 'undefined') boot();

function boot() {
  const $ = (id) => document.getElementById(id);
  const shell = $('shell');
  if (!shell) return;
  const phone = matchMedia('(max-width: 760px)');

  const bar = document.createElement('nav');
  bar.className = 'mb-tabs'; bar.id = 'mb-tabs'; bar.setAttribute('aria-label', 'Sections');
  shell.appendChild(bar);

  // the account button moves to the top bar on a phone
  const me = document.createElement('button');
  me.id = 'mb-me'; me.type = 'button'; me.className = 'mb-me';
  me.setAttribute('aria-label', 'Your account');
  document.querySelector('.top-r')?.appendChild(me);
  me.addEventListener('click', (e) => { e.stopPropagation(); $('me-btn')?.click(); });

  const sheet = document.createElement('div');
  sheet.className = 'mb-sheet-bg'; sheet.hidden = true;
  sheet.innerHTML = '<div class="mb-sheet" id="mb-sheet" role="dialog" aria-modal="true" aria-label="Needs you"><div id="mb-sh-in"></div><div class="mb-sh-f" id="mb-sh-f"></div></div>';
  document.body.appendChild(sheet);

  let wid = null, section = null, data = null, curId = null, open = false, mode = 'more', stop = null, unbind = null;
  const cos = () => import('./cos.js');
  const api = (...a) => import('./api.js').then((m) => m.api(...a));
  const toast = (msg) => { const t = $('toast'); if (!t) return; t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3400); };
  const ctx = () => ({ wid, api, toast });

  const count = () => (data ? waiting(data.decisions).length : 0);
  const paintBar = () => { if (wid) bar.innerHTML = String(tabsView(wid, section, count(), open)); me.textContent = $('me-init')?.textContent || ''; };

  async function load() {
    if (!wid) return;
    const m = await cos();
    const w = wid;
    try {
      const [state, feed] = await Promise.all([m.cosApi(ctx(), 'GET', 'state'), m.cosApi(ctx(), 'GET', 'feed')]);
      if (w !== wid) return;
      data = { state, decisions: feed.decisions || {} };
    } catch { /* keep the last count */ }
  }

  async function paintSheet() {
    if (!open) return;
    if (mode === 'more') {
      $('mb-sh-in').innerHTML = String(moreView(wid, section));
      $('mb-sh-f').innerHTML = '';
      sheet.querySelector('.mb-sheet').classList.remove('has-go');
      sheet.querySelector('.mb-sheet').setAttribute('aria-label', 'More');
      return;
    }
    sheet.querySelector('.mb-sheet').setAttribute('aria-label', 'Needs you');
    const m = await cos();
    const list = data ? waiting(data.decisions) : [];
    if (!list.some((d) => String(d.id) === String(curId))) curId = list[0]?.id ?? null;
    const d = list.find((x) => String(x.id) === String(curId));
    const card = d ? m.decisionCard(d, { ...data.state, wid }) : '';
    $('mb-sh-in').innerHTML = String(needsView(list, curId, card));
    // the main button, pinned at the bottom: the same data-dec attributes the card's own buttons carry
    const a = mainAction(d);
    const inCard = d && a && $('mb-sh-in').querySelector(a.dec === 'check' ? '[data-dec="check"]' : `[data-dec="decide"][data-opt="${CSS.escape(a.opt)}"]`);
    if (inCard) {
      const asWho = inCard.dataset.as ? ` as ${inCard.textContent.replace(/^.* as /, '')}` : '';
      $('mb-sh-f').innerHTML = String(html`<button class="btn is-primary mb-go" type="button" data-dec="${inCard.dataset.dec}" data-id="${inCard.dataset.id}" data-v="${inCard.dataset.v}"${inCard.dataset.opt ? html` data-opt="${inCard.dataset.opt}"` : ''}${inCard.dataset.as ? html` data-as="${inCard.dataset.as}"` : ''}><span>${a.label}${asWho}</span></button>`);
      inCard.closest('li, .cs-acts')?.classList.add('mb-pinned');
      sheet.querySelector('.mb-sheet').classList.add('has-go');
    } else {
      $('mb-sh-f').innerHTML = '';
      sheet.querySelector('.mb-sheet').classList.remove('has-go');
    }
  }

  async function refresh() { await load(); paintBar(); await paintSheet(); }

  async function setOpen(v) {
    open = v; sheet.hidden = !v;
    document.documentElement.classList.toggle('mb-locked', v);
    paintBar();
    if (v) {
      $('mb-sh-in').innerHTML = '<p class="mb-empty">Loading</p>';
      await refresh();
      sheet.querySelector('.mb-x')?.focus();
    } else $('mb-more')?.focus();
  }

  async function follow() {
    const p = location.hash.replace(/^#\/?/, '').split('/');
    const w = p[0] === 'w' && p[1] ? decodeURIComponent(p[1]) : null;
    section = p[2] || null;
    if (w !== wid) {
      wid = w; data = null; curId = null;
      if (stop) stop(); stop = null;
      if (unbind) unbind(); unbind = null;
      if (wid) {
        const m = await cos();
        stop = m.live(ctx(), refresh, 4000);
        unbind = m.bindCards(sheet, ctx(), async () => { await refresh(); });
        refresh();
      }
    }
    if (open) setOpen(false); else paintBar();
    mode = 'more';
  }

  bar.addEventListener('click', (e) => { if (e.target.closest('#mb-more')) { e.preventDefault(); mode = 'more'; setOpen(!open); } });
  // anything marked data-mb-needs (on a phone) opens Needs you, one card at a time
  document.addEventListener('click', (e) => { const n = e.target.closest('[data-mb-needs]'); if (n && phone.matches) { e.preventDefault(); mode = 'needs'; setOpen(true); } });
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet || e.target.closest('[data-mb="close"]')) { setOpen(false); return; }
    const pick = e.target.closest('[data-mb="pick"]');
    if (pick) { curId = pick.dataset.id; paintSheet(); sheet.querySelector('.mb-sh-b')?.scrollTo(0, 0); return; }
    // links inside a card (the record chip) leave the sheet
    if (e.target.closest('a[href^="#/"]')) setOpen(false);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) setOpen(false); });
  addEventListener('hashchange', follow);
  addEventListener('cos:as', () => { if (wid) refresh(); });
  // the shell shows after sign-in; the initials arrive then. follow(), not just paintBar(): opening #demo (or a magic
  // link) swaps the hash with history.replaceState, which fires no hashchange, so the bar would never learn the workspace
  new MutationObserver(() => follow()).observe($('me-init') || document.body, { childList: true, characterData: true, subtree: true });
  phone.addEventListener?.('change', () => { if (!phone.matches && open) setOpen(false); });
  follow();
}
