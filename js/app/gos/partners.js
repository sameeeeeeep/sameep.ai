// gos/partners.js — People, Events and Run it tools: influencer calendar, connects, partnerships,
// negotiation drafts, event vendors and the integrations map. Words come from D.MORE.partners (after sign-in);
// edits stay on this device (store('partners-…')). Nothing here sends a message: drafts are copied or opened in mail.
import { h, sound, D, safeHttp, fmtD, TODAY, tag, sample, gbox, gboxW, ul, rich, secondOrder, tabs, select, copyBtn, download, csv, head, store, avatar, art } from './kit.js';

const P = () => D.MORE?.partners || {};
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const ymd = (d) => d.toISOString().slice(0, 10);
const firstName = (n) => String(n || '').replace(/^Sample:\s*/i, '').split(/[\s(]/)[0] || 'there';
const noSrc = (s) => String(s || '').replace(/\s?\[\d+(?:,\s*\d+)*\]/g, '').trim();
const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
const put = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false && k !== ''));
const empty = (t, ...kids) => h('div.empty', t, ...kids);
const missing = () => [h('div.empty', 'This part of the plan didn’t load. Sign out and in again.')];

// a person or business, with its display picture (public YouTube picture for creators we have one for)
const photoOf = (name) => P().photos?.[name];
const who = (name, sub, extra) => h('div.who', avatar({ name: String(name || '').replace(/^Sample:\s*/i, ''), photo: photoOf(name), size: 34 }),
  h('div.who__t', h('span.tbl__name', name), sub ? h('span.tbl__sub', sub) : null, extra || null));

// the Creators module's own saved shortlist (wgos.v1 → stars / stages), read-only here
function shortlisted() {
  let S = {};
  try { S = JSON.parse(localStorage.getItem('wgos.v1') || '{}'); } catch { /* blocked: nothing shortlisted */ }
  const stars = S.stars || {}, stages = S.stages || {};
  return (D.CREATORS || []).filter((c) => stars[c.handle] || (stages[c.handle] && !['found', 'passed'].includes(stages[c.handle])));
}

const toolBtn = (label, onclick, primary) => h('button.btn.btn--sm' + (primary ? '.btn--primary' : ''), { type: 'button', onclick }, label);
const field = (label, input, full) => h('label' + (full ? '.full' : ''), label, input);
const inp = (name, attrs = {}) => h('input.field', { name, ...attrs });

// ================================================================ 1. influencer calendar
function infcal(m, { go }) {
  const C = P().infcal;
  if (!C) return missing();
  const kinds = C.kinds;
  const kindT = (k) => kinds.find((x) => x.id === k)?.t || k;
  const st = store('partners-infcal', { items: [], view: 'month', cursor: TODAY.slice(0, 7) });
  const items = () => st.v.items;
  const commit = () => { st.save(); draw(); };
  const late = (it) => !it.done && it.date < TODAY;
  const list = () => shortlisted();

  const pane = h('div');
  const tools = h('div.pinf__bar.bar');
  function plan() {
    const creators = list();
    if (!creators.length) return;
    let n = 0;
    for (const c of creators) {
      if (items().some((it) => it.who === c.name)) continue;
      for (const k of kinds) { items().push({ id: uid('d'), who: c.name, kind: k.id, date: addDays(TODAY, k.d), done: false, note: '' }); n++; }
    }
    commit(); sound.tick('pick');
    planMsg.textContent = n ? `Added ${n} dates. Move them once each creator agrees.` : 'Everyone shortlisted already has dates.';
  }
  const planMsg = h('span.small', { style: { margin: 0 } });

  // add form
  const f = h('form.form', { hidden: true },
    field('Creator', inp('who', { required: true, list: 'pinf-who', placeholder: 'Pick or type a name' })),
    h('datalist#pinf-who'),
    field('What', select('draft', kinds.map((k) => [k.id, k.t]), () => {}, 'Deliverable')),
    field('Date', inp('date', { type: 'date', required: true, value: TODAY })),
    field('Note', inp('note', { placeholder: 'e.g. owner: Creator lead' }), true),
    h('div.form__row', h('button.btn', { type: 'button', onclick: () => { f.hidden = true; } }, 'Cancel'), h('button.btn.btn--primary', { type: 'submit' }, 'Add date')));
  f.querySelector('select').name = 'kind';
  f.addEventListener('submit', (e) => { e.preventDefault(); const d = Object.fromEntries(new FormData(f)); items().push({ id: uid('d'), done: false, ...d }); st.v.cursor = d.date.slice(0, 7); f.reset(); f.hidden = true; commit(); sound.tick('pick'); });
  const fillWho = () => put(f.querySelector('datalist'), ...[...new Set([...list().map((c) => c.name), ...items().map((i) => i.who)])].map((n) => h('option', { value: n })));

  const ics = (it) => {
    const esc = (s) => String(s || '').replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
    const d = it.date.replace(/-/g, ''), e = addDays(it.date, 1).replace(/-/g, '');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Wispr Growth OS//Influencer calendar//EN', 'BEGIN:VEVENT', `UID:${it.id}@growth-os`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${e}`, `SUMMARY:${esc(kindT(it.kind) + ': ' + it.who)}`, `DESCRIPTION:${esc(it.note || 'From Wispr Growth OS')}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  };
  const exportCsv = () => download('wispr-influencer-calendar.csv', csv([['creator', 'deliverable', 'date', 'done', 'overdue', 'note'], ...[...items()].sort((a, b) => a.date.localeCompare(b.date)).map((i) => [i.who, kindT(i.kind), i.date, i.done ? 'yes' : 'no', late(i) ? 'yes' : 'no', i.note])]));

  function chip(it) {
    return h('button.pinf__chip' + (it.done ? '.is-done' : '') + (late(it) ? '.is-late' : ''), { type: 'button', dataset: { k: it.kind }, onclick: () => detail(it), title: kindT(it.kind) + ' · ' + it.who },
      avatar({ name: it.who, photo: photoOf(it.who), size: 22 }), h('span.pinf__kw', h('span.pinf__k', kindT(it.kind)), h('span.pinf__w', it.who)));
  }
  const detailBox = h('div');
  function detail(it) {
    const move = (n) => { it.date = addDays(it.date, n); st.v.cursor = it.date.slice(0, 7); commit(); detail(it); };
    put(detailBox, h('article.brief', { style: { '--c': 'var(--strawberry)' } },
      h('div.brief__head', h('div.who', avatar({ name: it.who, photo: photoOf(it.who), size: 44 }), h('div', h('h3.brief__t', kindT(it.kind)), h('p.brief__dates', it.who, ' · ', fmtD(it.date), late(it) ? ' · overdue' : '')))),
      h('div.pinf__acts',
        h('label.pinf__done', h('input', { type: 'checkbox', checked: !!it.done, onchange: (e) => { it.done = e.target.checked; commit(); detail(it); } }), 'Done'),
        toolBtn('← 1 day', () => move(-1)), toolBtn('1 day →', () => move(1)),
        h('input.field', { type: 'date', value: it.date, 'aria-label': 'Move to date', onchange: (e) => { if (e.target.value) { it.date = e.target.value; st.v.cursor = it.date.slice(0, 7); commit(); detail(it); } } }),
        toolBtn('Download .ics', () => download(`${it.kind}-${it.who.replace(/\W+/g, '-').toLowerCase()}.ics`, ics(it), 'text/calendar')),
        toolBtn('Remove', () => { st.v.items = items().filter((x) => x !== it); put(detailBox, ); commit(); })),
      h('label.pinf__note', 'Note', h('input.field', { value: it.note || '', placeholder: 'Owner, link, what was agreed', onchange: (e) => { it.note = e.target.value; st.save(); } }))));
    detailBox.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }

  function month() {
    const [y, mo] = st.v.cursor.split('-').map(Number);
    const first = new Date(Date.UTC(y, mo - 1, 1));
    const startPad = (first.getUTCDay() + 6) % 7; // Monday first
    const daysIn = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    const cells = [];
    for (let i = 0; i < startPad; i++) cells.push(h('div.pinf__day.is-pad', { 'aria-hidden': 'true' }));
    for (let d = 1; d <= daysIn; d++) {
      const iso = ymd(new Date(Date.UTC(y, mo - 1, d)));
      const here = items().filter((it) => it.date === iso);
      cells.push(h('div.pinf__day' + (here.length ? '' : '.is-empty') + (iso === TODAY ? '.is-today' : ''),
        h('span.pinf__n', h('span.pinf__dow', new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short' }) + ' '), String(d)), here.map(chip)));
    }
    const label = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const shift = (n) => { const d = new Date(Date.UTC(y, mo - 1 + n, 1)); st.v.cursor = ymd(d).slice(0, 7); commit(); };
    const any = items().some((it) => it.date.startsWith(st.v.cursor));
    return [h('div.pinf__nav', toolBtn('‹', () => shift(-1)), h('p.pinf__label', label), toolBtn('›', () => shift(1)), toolBtn('Today', () => { st.v.cursor = TODAY.slice(0, 7); commit(); })),
      h('div.pinf__month', ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => h('div.pinf__wd', d)), cells),
      any ? null : h('p.note', 'Nothing this month.')];
  }
  function week() {
    const now = new Date(TODAY + 'T00:00:00');
    const mon = addDays(TODAY, -((now.getDay() + 6) % 7));
    const wk = st.v.week || mon;
    const shift = (n) => { st.v.week = addDays(wk, n * 7); commit(); };
    const daysList = Array.from({ length: 7 }, (_, i) => addDays(wk, i));
    return [h('div.pinf__nav', toolBtn('‹', () => shift(-1)), h('p.pinf__label', 'Week of ' + fmtD(wk)), toolBtn('›', () => shift(1)), toolBtn('This week', () => { st.v.week = mon; commit(); })),
      h('div.pinf__week', daysList.map((iso) => { const here = items().filter((it) => it.date === iso); return h('div.pinf__wrow' + (iso === TODAY ? '.is-today' : ''), h('p.pinf__wlabel', new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })), h('div.pinf__wchips', here.length ? here.map(chip) : h('span.muted.small', '—'))); }))];
  }
  function overdueBox() {
    const lateOnes = items().filter(late).sort((a, b) => a.date.localeCompare(b.date));
    if (!lateOnes.length) return null;
    return h('div.pinf__late', h('p.pinf__latet', `${lateOnes.length} overdue`), h('div.pinf__wchips', lateOnes.map(chip)));
  }

  function draw() {
    fillWho();
    const viewSel = h('div.gtabs.pinf__views', { role: 'tablist' }, [['month', 'Month'], ['week', 'Week']].map(([v, t]) => h('button.gtab', { type: 'button', role: 'tab', 'aria-selected': String(st.v.view === v), onclick: () => { st.v.view = v; commit(); } }, t)));
    put(tools, viewSel, toolBtn('+ Add a date', () => { f.hidden = !f.hidden; }), toolBtn('Plan dates for my shortlist', plan, true), planMsg);
    if (!items().length) {
      const n = list().length;
      put(pane, empty(n ? `You have ${n} creator${n > 1 ? 's' : ''} shortlisted. Plan their four dates in one click, or add a date by hand.` : 'Nobody is shortlisted yet. Star creators in the Creators module, then come back to plan their dates.',
        h('div.row', { style: { marginTop: '12px', justifyContent: 'center' } }, n ? toolBtn('Plan dates for my shortlist', plan, true) : toolBtn('Go to Creators', () => go('creators'), true))));
      return;
    }
    put(pane, overdueBox() || '', ...(st.v.view === 'week' ? week() : month()));
  }
  draw();
  const legend = h('div.pinf__legend', kinds.map((k) => h('span.pinf__lg', { dataset: { k: k.id } }, k.t)), h('span.pinf__lg.is-late', 'Overdue'));
  return [head(m, C.why, toolBtn('Export CSV', exportCsv)),
    tools, f, legend, pane, detailBox,
    h('p.note', rich(C.planNote)),
    h('div.gos-grid.gos-grid--2', { style: { marginTop: '14px' } }, gbox('How the dates work', ul(C.rules)), gbox('Second-order', secondOrder(C.so)))];
}

// ================================================================ 2. connects
function connects(m, { go }) {
  const C = P().connects;
  if (!C) return missing();
  const seed = () => C.sample.map((r, i) => ({ id: 's' + i, sample: true, kind: r.kind, who: r.who, org: '', channel: r.channel, date: addDays(TODAY, -r.ago), said: r.said, next: r.next, due: addDays(TODAY, r.due), owner: r.owner, intro: r.intro }));
  const st = store('partners-connects', { rows: null });
  if (!st.v.rows) { st.v.rows = seed(); st.save(); }
  const rows = () => st.v.rows;
  const commit = () => st.save();
  const weekEnd = addDays(TODAY, 6);
  const exportCsv = () => download('wispr-connects.csv', csv([['kind', 'who', 'org', 'channel', 'date', 'what was said', 'next step', 'due', 'owner', 'warm intro', 'sample'], ...rows().map((r) => [r.kind, r.who, r.org, r.channel, r.date, r.said, r.next, r.due, r.owner, r.intro, r.sample ? 'yes' : ''])]));

  function addForm(onDone) {
    const names = [...(D.CREATORS || []).map((c) => c.name), ...(D.COLLABS || []).map((c) => c.name)];
    const f = h('form.form',
      field('Creator or brand?', select('creator', [['creator', 'Creator'], ['brand', 'Brand']], () => {}, 'Kind')),
      field('Who', inp('who', { required: true, list: 'pcon-names', placeholder: 'Name or page' })),
      h('datalist#pcon-names', names.map((n) => h('option', { value: n }))),
      field('Org or handle', inp('org')),
      field('Channel', select(C.channels[0], C.channels.map((c) => [c, c]), () => {}, 'Channel')),
      field('Date', inp('date', { type: 'date', value: TODAY, required: true })),
      field('What was said', inp('said', { required: true, placeholder: 'One line' }), true),
      field('Next step', inp('next', { required: true, placeholder: 'One action, with a verb' })),
      field('Due', inp('due', { type: 'date', value: addDays(TODAY, 3) })),
      field('Owner (role)', select(C.roles[0], C.roles.map((c) => [c, c]), () => {}, 'Owner')),
      field('Warm intro (who knows who)', inp('intro', { placeholder: 'e.g. via a GrowthX member' })),
      h('div.form__row', h('button.btn', { type: 'button', onclick: () => onDone(false) }, 'Cancel'), h('button.btn.btn--primary', { type: 'submit' }, 'Log it')));
    const sels = f.querySelectorAll('select'); sels[0].name = 'kind'; sels[1].name = 'channel'; sels[2].name = 'owner';
    f.addEventListener('submit', (e) => { e.preventDefault(); rows().unshift({ id: uid('c'), ...Object.fromEntries(new FormData(f)) }); commit(); sound.tick('pick'); onDone(true); });
    return f;
  }

  function log() {
    const q = { kind: 'all', text: '' };
    const body = h('tbody');
    const count = h('span.small', { style: { margin: 0 } });
    const formBox = h('div');
    const draw = () => {
      const list = rows().filter((r) => (q.kind === 'all' || r.kind === q.kind) && (!q.text || [r.who, r.org, r.said, r.next, r.intro, r.owner].join(' ').toLowerCase().includes(q.text)));
      count.textContent = `${list.length} of ${rows().length}`;
      put(body, ...list.map((r) => {
        const lateR = r.due && r.due < TODAY;
        return h('tr',
          h('td.tbl__wide', who(r.who, [r.kind === 'brand' ? 'Brand' : 'Creator', r.org].filter(Boolean).join(' · '), r.sample ? sample() : null)),
          h('td', { 'data-k': 'Channel' }, r.channel, h('span.tbl__sub', fmtD(r.date))),
          h('td.tbl__wide', { 'data-k': 'Said' }, r.said),
          h('td.tbl__wide', { 'data-k': 'Next' }, r.next || '—', r.due && h('span.tbl__sub' + (lateR ? '.is-overdue' : ''), (lateR ? 'Overdue · ' : 'By ') + fmtD(r.due))),
          h('td', { 'data-k': 'Owner' }, r.owner || '—'),
          h('td', toolBtn('Remove', () => { st.v.rows = rows().filter((x) => x !== r); commit(); draw(); })));
      }));
    };
    draw();
    return [
      h('div.bar',
        h('input.field', { type: 'search', placeholder: 'Search who, what, next…', 'aria-label': 'Search the log', oninput: (e) => { q.text = e.target.value.toLowerCase(); draw(); } }),
        select('all', [['all', 'Creators + brands'], ['creator', 'Creators'], ['brand', 'Brands']], (v) => { q.kind = v; draw(); }, 'Kind'),
        toolBtn('+ Log a connect', () => { put(formBox, gboxW('New connect', addForm((ok) => { put(formBox, ); if (ok) draw(); }))); }, true),
        toolBtn('Clear samples', () => { if (confirm('Remove the sample rows?')) { st.v.rows = rows().filter((r) => !r.sample); commit(); draw(); } }),
        count),
      formBox,
      h('div.tbl-wrap', { style: { maxHeight: '480px' } }, h('table.tbl.tbl--stack', h('thead', h('tr', ['Who', 'Channel', 'What was said', 'Next step', 'Owner', ''].map((t) => h('th', t)))), body)),
      h('p.note', 'Rows marked Sample are made up to show the layout: no real person or company is behind them, and nobody has been contacted.'),
    ];
  }

  function followups() {
    const box = h('div');
    const draw = () => {
      const open = rows().filter((r) => r.due && r.next);
      const groups = [['Overdue', open.filter((r) => r.due < TODAY)], ['Due today', open.filter((r) => r.due === TODAY)], ['This week', open.filter((r) => r.due > TODAY && r.due <= weekEnd)]];
      if (!groups.some(([, l]) => l.length)) { put(box, empty('Nothing due this week. Log a connect with a next step and a date, and it shows up here.')); return; }
      put(box, ...groups.filter(([, l]) => l.length).map(([t, l]) => gboxW(`${t} · ${l.length}`, h('div.pcon__fu', l.sort((a, b) => a.due.localeCompare(b.due)).map((r) => h('div.pcon__furow' + (r.due < TODAY ? '.is-late' : ''),
        who(r.who, `${r.owner || 'No owner'} · ${fmtD(r.due)}`, r.sample ? sample() : null),
        h('p.pcon__next', r.next),
        h('div.pcon__btns',
          toolBtn('Done', () => { r.said = (r.said ? r.said + ' · ' : '') + 'Done: ' + r.next; r.next = ''; r.due = ''; commit(); draw(); sound.tick('pick'); }),
          toolBtn('+2 days', () => { r.due = addDays(r.due < TODAY ? TODAY : r.due, 2); commit(); draw(); }))))))));
    };
    draw();
    return [box, h('p.note', 'Done moves the step into “what was said” and clears the date. Log the next step from the Log tab.')];
  }

  function intros() {
    const list = rows();
    const body = h('tbody', list.map((r) => h('tr',
      h('td.tbl__wide', who(r.who, r.kind === 'brand' ? 'Brand' : 'Creator', r.sample ? sample() : null)),
      h('td.tbl__wide', { 'data-k': 'Intro' }, h('input.field', { value: r.intro || '', placeholder: 'Who could introduce us?', 'aria-label': 'Warm intro for ' + r.who, onchange: (e) => { r.intro = e.target.value; commit(); } })),
      h('td', { 'data-k': 'Owner' }, r.owner || '—'))));
    const known = list.filter((r) => r.intro).length;
    return [h('p.small', `${known} of ${list.length} have a warm route in. A warm intro beats a cold DM, so ask around before the first message.`),
      h('div.tbl-wrap', { style: { maxHeight: '480px' } }, h('table.tbl.tbl--stack', h('thead', h('tr', ['Who', 'Who knows them', 'Owner'].map((t) => h('th', t)))), body))];
  }

  function templates() {
    let t = C.templates[0];
    const vals = { name: '', who: 'developers', topic: 'building with AI tools', reason: 'the timing doesn’t fit this quarter' };
    const out = h('div.post');
    const fill = () => { out.textContent = t.body.replace(/\{(\w+)\}/g, (_, k) => (k === 'name' ? (vals.name || 'there') : vals[k] || '{' + k + '}')); };
    const inputs = h('div.form', ['name', 'who', 'topic', 'reason'].map((k) => field({ name: 'Their first name', who: 'Their audience / who to meet', topic: 'Topic', reason: 'Reason (for the no)' }[k], h('input.field', { value: vals[k], oninput: (e) => { vals[k] = e.target.value; fill(); } }))));
    fill();
    return [h('div.bar', select(t.id, C.templates.map((x) => [x.id, x.t]), (v) => { t = C.templates.find((x) => x.id === v); fill(); }, 'Template'), copyBtn(() => out.textContent, 'Copy message')),
      inputs, out, gbox('Rules', ul(C.rules)), gbox('Second-order', secondOrder(C.so))];
  }

  const dueCount = () => rows().filter((r) => r.due && r.next && r.due <= TODAY).length;
  return [head(m, C.why, toolBtn('Export CSV', exportCsv), toolBtn('Open CRM', () => go('crm'))),
    dueCount() ? h('p.pcon__alert', `${dueCount()} follow-up${dueCount() > 1 ? 's' : ''} due today or overdue.`) : null,
    tabs(['Log', 'Follow-ups', 'Who knows who', 'Templates'], (i) => [log, followups, intros, templates][i](), 0)];
}

// ================================================================ 3. partnerships
function partners(m, { go }) {
  const C = P().deals;
  if (!C) return missing();
  const stages = C.stages;
  const collab = (id) => (D.COLLABS || []).find((c) => c.id === id);
  const seed = () => (D.COLLABS || []).filter((c) => C.fromTier[c.tier]).map((c) => ({ id: c.id, from: c.id, name: c.name, cat: c.cat, stage: C.fromTier[c.tier], owner: 'Partnerships', next: '' }));
  const st = store('partners-deals', { rows: null, ex: {}, checks: {} });
  if (!st.v.rows) { st.v.rows = seed(); st.save(); }
  const rows = () => st.v.rows;
  const commit = () => st.save();
  const exportCsv = () => download('wispr-partnerships.csv', csv([['partner', 'category', 'stage', 'owner', 'next', 'we give', 'they give', 'checklist done'], ...rows().map((r) => { const ex = exOf(r); const n = Object.values(st.v.checks[r.id] || {}).filter(Boolean).length; return [r.name, r.cat, r.stage, r.owner, r.next, ex.we.map((x) => x.t).join(' | '), ex.they.map((x) => x.t).join(' | '), n]; })]));
  // value exchange: starts from the collab's own give/get, then edited here
  function exOf(r) {
    if (!st.v.ex[r.id]) { const c = collab(r.from); st.v.ex[r.id] = { we: c?.give ? [{ k: C.giveKinds[0], t: noSrc(c.give) }] : [], they: c?.get ? [{ k: 'Their channel', t: noSrc(c.get) }] : [] }; }
    return st.v.ex[r.id];
  }
  let cur = rows()[0]?.id;
  const pick = (id) => rows().find((r) => r.id === id) || rows()[0];

  function board() {
    const box = h('div');
    const formBox = h('div');
    const draw = () => {
      put(box, h('div.pdeal__board', stages.map((s, si) => {
        const here = rows().filter((r) => r.stage === s);
        return h('section.pdeal__col', h('p.pdeal__colt', s, h('span.gos__count', String(here.length))), h('p.pdeal__help', C.stageHelp[s] || ''),
          here.map((r) => h('div.pdeal__card',
            who(r.name, r.cat),
            h('input.field.pdeal__next', { value: r.next || '', placeholder: 'Next step', 'aria-label': 'Next step for ' + r.name, onchange: (e) => { r.next = e.target.value; commit(); } }),
            h('div.pdeal__mv',
              h('button.btn.btn--sm', { type: 'button', disabled: si === 0, 'aria-label': 'Move back', onclick: () => { r.stage = stages[si - 1]; commit(); draw(); } }, '←'),
              select(r.stage, stages.map((x) => [x, x[0].toUpperCase() + x.slice(1)]), (v) => { r.stage = v; commit(); draw(); }, 'Stage for ' + r.name),
              h('button.btn.btn--sm', { type: 'button', disabled: si === stages.length - 1, 'aria-label': 'Move on', onclick: () => { r.stage = stages[si + 1]; commit(); draw(); sound.tick('pick'); } }, '→')))));
      })));
    };
    const addF = () => {
      const f = h('form.form', field('Partner', inp('name', { required: true, placeholder: 'Company or community' })), field('Category', inp('cat', { placeholder: 'e.g. Campus' })),
        field('Owner (role)', inp('owner', { value: 'Partnerships' })), field('Next step', inp('next')),
        h('div.form__row', h('button.btn', { type: 'button', onclick: () => put(formBox, ) }, 'Cancel'), h('button.btn.btn--primary', { type: 'submit' }, 'Add')));
      f.addEventListener('submit', (e) => { e.preventDefault(); rows().push({ id: uid('p'), stage: 'idea', ...Object.fromEntries(new FormData(f)) }); commit(); put(formBox, ); draw(); sound.tick('pick'); });
      put(formBox, gboxW('New partnership', f));
    };
    draw();
    return [h('div.bar', toolBtn('+ Add a partner', addF, true), toolBtn('Scores in Collabs', () => go('collabs')),
      toolBtn('Re-seed from Collabs', () => { if (confirm('Replace this board with the Collabs list again?')) { st.v.rows = seed(); commit(); draw(); } })), formBox, box,
    h('p.note', 'Seeded from the Collabs list (Cut left off). Nothing has been pitched; every stage is a plan.')];
  }

  function dealPicker(onPick) { return select(cur, rows().map((r) => [r.id, r.name]), (v) => { cur = v; onPick(); }, 'Partnership'); }

  function exchange() {
    const box = h('div');
    const draw = () => {
      const r = pick(cur); if (!r) { put(box, empty('Add a partner first.')); return; }
      const ex = exOf(r);
      const side = (k, label) => h('div.pdeal__side', h('p.card__t', label),
        h('ul.pdeal__ex', ex[k].map((x, i) => h('li',
          select(x.k, [...new Set([...C.giveKinds, x.k])].map((g) => [g, g]), (v) => { x.k = v; commit(); }, 'Kind'),
          h('input.field', { value: x.t, 'aria-label': label + ' detail', onchange: (e) => { x.t = e.target.value; commit(); } }),
          h('button.btn.btn--sm', { type: 'button', 'aria-label': 'Remove line', onclick: () => { ex[k].splice(i, 1); commit(); draw(); } }, '✕')))),
        toolBtn('+ Add a line', () => { ex[k].push({ k: C.giveKinds[0], t: '' }); commit(); draw(); }));
      const c = collab(r.from);
      put(box, h('div.bar', dealPicker(draw)), h('div.gos-grid.gos-grid--2', side('we', 'Wispr gives'), side('they', r.name + ' gives')),
        c?.so ? gbox('Second-order (from Collabs)', secondOrder(c.so)) : null);
    };
    draw();
    return [box, h('p.note', 'Write each side in one line. If one side’s list is much longer, the deal won’t last.')];
  }

  function onePager() {
    const out = h('textarea.field.field--area.pdeal__one', { rows: 16, 'aria-label': 'One-pager' });
    const box = h('div');
    const draw = () => {
      const r = pick(cur); if (!r) { put(box, empty('Add a partner first.')); return; }
      const c = collab(r.from) || {};
      const ex = exOf(r);
      out.value = [C.onePagerHead.replace('{partner}', r.name), '',
        'Why us, together', noSrc(c.why) || '…', '',
        'The idea', noSrc(c.format) || '…', '',
        'Wispr gives', ...ex.we.map((x) => `• ${x.k}: ${x.t}`), '',
        `${r.name} gives`, ...ex.they.map((x) => `• ${x.k}: ${x.t}`), '',
        'First step', noSrc(c.first) || r.next || '…', '',
        'How we’ll measure it', noSrc(c.kpi) || '…', '',
        'Owners', `Wispr: ${r.owner || 'Partnerships'} · ${r.name}: to agree`, '',
        C.onePagerFoot].join('\n');
    };
    draw();
    put(box, h('div.bar', dealPicker(draw), toolBtn('Rebuild', draw), copyBtn(() => out.value, 'Copy one-pager')), h('div.pdeal__onewrap', out, art('partners-handshake', 'Two laptops on a café table in Bengaluru', { ratio: '3/4' })));
    return [box, h('p.note', 'Built from the deal’s Collabs entry and its value exchange. Edit freely before you copy; edits here aren’t saved.')];
  }

  function checklist() {
    const box = h('div');
    const draw = () => {
      const r = pick(cur); if (!r) { put(box, empty('Add a partner first.')); return; }
      const ck = (st.v.checks[r.id] ||= {});
      const total = C.checklist.reduce((n, g) => n + g.items.length, 0);
      const done = Object.values(ck).filter(Boolean).length;
      put(box, h('div.bar', dealPicker(draw), h('span.small', { style: { margin: 0 } }, `${done} of ${total} done`)),
        h('div.meter', h('span.meter__bar', h('i', { style: { width: (done / total) * 100 + '%' } })), h('span.meter__v', `${done}/${total}`)),
        h('div.gos-grid', { style: { marginTop: '12px' } }, C.checklist.map((g) => gboxW(g.g, h('ul.check', g.items.map((t, i) => { const k = g.g + i; return h('li', h('label', h('input', { type: 'checkbox', checked: !!ck[k], onchange: (e) => { ck[k] = e.target.checked; commit(); draw(); } }), h('span', rich(t)))); }))))));
    };
    draw();
    return [box, gbox('Second-order', secondOrder(C.so))];
  }

  return [head(m, C.why, toolBtn('Export CSV', exportCsv)),
    tabs(['Pipeline', 'Value exchange', 'One-pager', 'Co-marketing checklist'], (i) => [board, exchange, onePager, checklist][i](), 0)];
}

// ================================================================ 4. negotiation (drafts only, never sends)
function negotiate(m) {
  const C = P().negotiate;
  if (!C) return missing();
  const st = store('partners-negotiate', { threads: [], cur: null, ceiling: C.ceiling, open: C.open });
  const threads = () => st.v.threads;
  const commit = () => st.save();
  const words = (s) => ' ' + String(s).toLowerCase().replace(/[’‘]/g, "'").replace(/[^\p{L}\p{N}₹'\s]/gu, ' ').replace(/\s+/g, ' ') + ' ';
  // simple rules: count keyword hits per intent; a clear no or yes wins over the rest
  function classify(text) {
    const w = words(text);
    const hits = C.intents.map((it) => ({ id: it.id, t: it.t, n: it.kw.filter((k) => w.includes(' ' + k.toLowerCase() + ' ') || (k === '₹' && w.includes('₹'))).length })).filter((x) => x.n);
    if (asks(text).length && !hits.some((x) => x.id === 'money')) hits.push({ id: 'money', t: C.intents.find((i) => i.id === 'money').t, n: 1 });
    if (hits.some((x) => x.id === 'no')) return hits.filter((x) => x.id === 'no');
    hits.sort((a, b) => b.n - a.n);
    return hits.some((x) => x.id !== 'yes') ? hits.filter((x) => x.id !== 'yes') : hits;
  }
  // money amounts: ₹90,000 · Rs 1.2 lakh · 80k
  function asks(text) {
    const out = [];
    const re = /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)\s*(k|l|lakh|lac|lakhs)?|\b([\d,]+(?:\.\d+)?)\s*(k|lakh|lac|lakhs)\b/gi;
    let mm;
    while ((mm = re.exec(text))) { const n = parseFloat((mm[1] || mm[3]).replace(/,/g, '')); const u = (mm[2] || mm[4] || '').toLowerCase(); out.push(n * (u === 'k' ? 1e3 : u.startsWith('l') ? 1e5 : 1)); }
    return out.filter((n) => n >= 1000);
  }
  function draft(t, text, intents) {
    const pb = C.playbook;
    const ask = Math.max(0, ...asks(text));
    const lines = [`Hi ${t.first || 'there'},`, ''];
    let counter = false;
    if (!intents.length) lines.push(pb.unknown);
    for (const it of intents) {
      if (it.id === 'money') {
        if (counter) continue; // one number per round, at most
        const amount = ask && ask <= st.v.ceiling ? ask : st.v.ceiling;
        lines.push((ask && ask <= st.v.ceiling ? pb.moneyAt : pb.money).replace('{amount}', inr(amount)));
        counter = true;
      } else if (pb[it.id]) lines.push(pb[it.id]);
    }
    if (!intents.some((i) => i.id === 'no')) lines.push('', pb.sign);
    lines.push('', 'Thanks,');
    return { text: lines.join('\n'), counter };
  }
  // guardrail checks run on whatever is in the draft box, including your edits
  function checks(text, round) {
    const nums = asks(text);
    const lower = text.toLowerCase();
    return {
      ceiling: nums.every((n) => n <= st.v.ceiling),
      perpetual: !/perpetu|in perpetuity|forever|lifetime rights|for all time/.test(lower) || /don.t ask for perpetual|no perpetual|not perpetual|never perpetual/.test(lower),
      promise: !/guarantee|we promise|assured|you will get \d|will get you|promise (you )?(views|sales|results|signups)/.test(lower),
      writing: /in writing|written confirmation|confirm .* by email/.test(lower) || round?.intents?.[0]?.id === 'no',
      counter: new Set(nums).size <= 1,
    };
  }

  const side = h('div.pneg__threads');
  const main = h('div.pneg__main');
  const draw = () => { drawThreads(); drawMain(); };
  function newThread(who, kind, msg) {
    const t = { id: uid('t'), who: who || 'New thread', first: /^Sample:/i.test(who || '') || !who ? '' : firstName(who), kind: kind || 'creator', to: '', subject: 'Wispr Flow × ' + (who || '').replace(/^Sample:\s*/i, ''), rounds: [] };
    threads().unshift(t); st.v.cur = t.id; commit();
    if (msg) addRound(t, msg);
    draw();
  }
  function addRound(t, msg) {
    const intents = classify(msg);
    const d = draft(t, msg, intents);
    t.rounds.push({ at: new Date().toISOString(), them: msg, intents, draft: d.text, counter: d.counter, sent: false });
    commit();
  }
  function drawThreads() {
    put(side, 
      h('p.small', { style: { margin: '0 0 6px' } }, 'Threads on this device'),
      ...threads().map((t) => h('button.pneg__t', { type: 'button', 'aria-current': t.id === st.v.cur ? 'true' : null, onclick: () => { st.v.cur = t.id; commit(); draw(); } },
        avatar({ name: t.who.replace(/^Sample:\s*/i, ''), photo: photoOf(t.who), size: 28 }), h('span.pneg__tn', t.who, h('span.tbl__sub', `${t.rounds.length} round${t.rounds.length === 1 ? '' : 's'}`)))),
      threads().length ? null : h('p.muted.small', 'None yet. Start one or pick a sample.'));
  }
  function drawMain() {
    const t = threads().find((x) => x.id === st.v.cur);
    const starter = () => {
      const whoIn = h('input.field', { placeholder: 'Who is this with? e.g. a creator’s channel name', 'aria-label': 'Thread name' });
      const kindSel = select('creator', [['creator', 'Creator'], ['brand', 'Brand']], () => {}, 'Kind');
      const msg = h('textarea.field.field--area', { rows: 5, placeholder: 'Paste their reply here', 'aria-label': 'Their reply' });
      return gboxW('New thread',
        h('div.bar', whoIn, kindSel),
        msg,
        h('div.row', toolBtn('Read it and draft a reply', () => { if (!msg.value.trim()) { msg.focus(); return; } newThread(whoIn.value.trim() || 'New thread', kindSel.value, msg.value.trim()); sound.tick('pick'); }, true)),
        h('p.small', { style: { marginTop: '14px' } }, 'Or pick a sample thread:'),
        h('div.pneg__samples', C.samples.map((s) => h('button.pneg__sample', { type: 'button', onclick: () => newThread(s.who, s.kind, s.msg) }, h('span.tbl__name', s.who), h('span.tbl__sub', s.msg.slice(0, 80) + '…')))));
    };
    if (!t) { put(main, starter()); return; }
    const last = t.rounds[t.rounds.length - 1];
    const ta = h('textarea.field.field--area.pneg__draft', { rows: 11, 'aria-label': 'Draft reply' }, last?.draft || '');
    const toIn = h('input.field', { type: 'email', value: t.to || '', placeholder: 'Their email (optional, not saved anywhere else)', 'aria-label': 'To', onchange: (e) => { t.to = e.target.value.trim(); commit(); } });
    const subj = h('input.field', { value: t.subject || '', 'aria-label': 'Subject', onchange: (e) => { t.subject = e.target.value; commit(); } });
    const gl = h('ul.lint.pneg__gl');
    const runChecks = () => { const c = checks(ta.value, last); put(gl, ...C.guardrails.map((g) => h('li' + (c[g.id] ? '' : '.is-bad'), g.t))); };
    ta.addEventListener('input', () => { if (last) { last.draft = ta.value; commit(); } runChecks(); });
    runChecks();
    const mailto = () => { const to = /^[^@\s,;?&]+@[^@\s,;?&]+\.[a-z]{2,}$/i.test(t.to || '') ? encodeURIComponent(t.to) : ''; return `mailto:${to}?subject=${encodeURIComponent(t.subject || '')}&body=${encodeURIComponent(ta.value)}`; };
    const next = h('textarea.field.field--area', { rows: 3, placeholder: 'They replied again? Paste it here for the next round.', 'aria-label': 'Next reply' });
    put(main, 
      h('div.pneg__top', who(t.who, t.kind === 'brand' ? 'Brand' : 'Creator', /^Sample:/i.test(t.who) ? sample() : null),
        toolBtn('Delete thread', () => { if (confirm('Delete this thread from this device?')) { st.v.threads = threads().filter((x) => x !== t); st.v.cur = null; commit(); draw(); } })),
      h('ol.pneg__hist', t.rounds.map((r, i) => h('li',
        h('p.pneg__k', `Round ${i + 1} · they said`, h('span.tags', r.intents.length ? r.intents.map((x) => tag(x.t, x.id === 'no' ? 'cut' : x.id === 'yes' ? 'live' : 'warn')) : tag('Not sure', 'idea'))),
        h('p.pneg__them', r.them),
        i < t.rounds.length - 1 ? h('details', h('summary', 'Our draft that round'), h('p.pneg__old', r.draft)) : null))),
      h('div.pneg__work',
        h('div',
          h('p.pneg__k', 'Draft reply (edit it, it’s yours)'),
          ta,
          h('div.form', field('Their first name', h('input.field', { value: t.first || '', placeholder: 'there', onchange: (e) => { t.first = e.target.value.trim(); commit(); } })), field('To', toIn), field('Subject', subj, true)),
          h('div.row.pneg__send', copyBtn(() => ta.value, 'Copy draft'), h('a.btn.btn--primary.pneg__mail', { href: '#', onclick: (e) => { e.preventDefault(); location.href = mailto(); } }, 'Open in mail'),
            toolBtn('Redraft', () => { if (!last) return; const d = draft(t, last.them, last.intents); last.draft = d.text; last.counter = d.counter; commit(); drawMain(); })),
          h('p.note', 'Nothing is sent from here. Open in mail starts a new message in your own mail app; you read it and press send.')),
        h('aside.pneg__guard', h('p.pneg__k', 'Guardrails'), gl,
          h('label.pneg__money', 'Budget ceiling (₹)', h('input.field', { type: 'number', min: 0, step: 1000, value: st.v.ceiling, onchange: (e) => { st.v.ceiling = Math.max(0, +e.target.value || 0); commit(); runChecks(); } }), sample()),
          h('p.small', C.ceilingNote))),
      gboxW('Next round', next, h('div.row', toolBtn('Read it and draft', () => { if (!next.value.trim()) return; addRound(t, next.value.trim()); drawMain(); drawThreads(); sound.tick('pick'); }, true))));
  }
  draw();
  return [head(m, C.why, toolBtn('+ New thread', () => { st.v.cur = null; commit(); drawMain(); drawThreads(); })),
    h('div.pneg', side, main),
    h('div.gos-grid.gos-grid--2', { style: { marginTop: '16px' } }, gbox('Rules', ul(C.rules)), gbox('Second-order', secondOrder(C.so)))];
}

// ================================================================ 5. vendors
function vendors(m) {
  const C = P().vendors;
  if (!C) return missing();
  const st = store('partners-vendors', { mine: [], short: {} });
  const all = () => [...C.list.map((v, i) => ({ ...v, id: 'v' + i })), ...st.v.mine];
  const typeT = (t) => C.types.find((x) => x[0] === t)?.[1] || t;
  const cities = [...new Set(C.list.map((v) => v.city))];
  const q = { city: 'all', type: 'all', text: '', short: false };
  const grid = h('div.pven__grid');
  const count = h('span.small', { style: { margin: 0 } });
  const formBox = h('div');
  const draw = () => {
    const list = all().filter((v) => (q.city === 'all' || v.city === q.city) && (q.type === 'all' || v.type === q.type) && (!q.short || st.v.short[v.id]) && (!q.text || [v.name, v.does, v.fit].join(' ').toLowerCase().includes(q.text)));
    count.textContent = `${list.length} of ${all().length}`;
    put(grid, ...(list.length ? list.map((v) => h('div.card.pven__card', { style: { '--c': 'var(--tangerine)' } },
      h('div.card__top', h('div.who', avatar({ name: v.name, size: 36 }), h('div.who__t', h('p.card__t', v.name), h('span.tbl__sub', `${typeT(v.type)} · ${v.city}`))),
        h('button.star', { type: 'button', 'aria-pressed': String(!!st.v.short[v.id]), 'aria-label': 'Shortlist ' + v.name, onclick: (e) => { st.v.short[v.id] = !st.v.short[v.id]; st.save(); e.currentTarget.setAttribute('aria-pressed', String(!!st.v.short[v.id])); if (q.short) draw(); } }, '★')),
      h('p.card__p', v.does),
      v.fit ? h('p.card__p.muted', h('b', 'Why: '), v.fit) : null,
      h('p.card__meta', v.url ? h('a', { href: safeHttp(v.url), target: '_blank', rel: 'noopener' }, 'Public page ↗') : null, v.mine ? tag('Added by you', 'real') : tag(C.flag, 'warn'),
        v.mine ? h('button.btn.btn--sm', { type: 'button', onclick: () => { st.v.mine = st.v.mine.filter((x) => x.id !== v.id); st.save(); draw(); } }, 'Remove') : null)))
      : [empty('No vendors match. Clear a filter, or add your own.')]));
  };
  const addF = () => {
    const f = h('form.form', field('Business name', inp('name', { required: true })), field('City', inp('city', { required: true, list: 'pven-cities', value: 'Bengaluru' })), h('datalist#pven-cities', cities.map((c) => h('option', { value: c }))),
      field('Type', select('venue', C.types, () => {}, 'Type')), field('Public website or page', inp('url', { type: 'url', placeholder: 'https://' })),
      field('What they do', inp('does', { required: true }), true), field('Why they fit', inp('fit'), true),
      h('div.form__row', h('button.btn', { type: 'button', onclick: () => put(formBox, ) }, 'Cancel'), h('button.btn.btn--primary', { type: 'submit' }, 'Add vendor')));
    f.querySelector('select').name = 'type';
    f.addEventListener('submit', (e) => { e.preventDefault(); st.v.mine.push({ id: uid('m'), mine: true, ...Object.fromEntries(new FormData(f)) }); st.save(); put(formBox, ); draw(); sound.tick('pick'); });
    put(formBox, gboxW('Add a vendor', f, h('p.note', 'Business details only. No personal names or personal numbers.')));
  };
  const exportCsv = () => download('wispr-event-vendors.csv', csv([['name', 'city', 'type', 'what they do', 'why they fit', 'public page', 'shortlisted', 'status'], ...all().map((v) => [v.name, v.city, typeT(v.type), v.does, v.fit, v.url, st.v.short[v.id] ? 'yes' : '', v.mine ? 'added by you' : C.flag])]));
  draw();
  const byCity = cities.map((c) => `${C.list.filter((v) => v.city === c).length} in ${c}`).join(' · ');
  return [head(m, C.why, toolBtn('+ Add a vendor', addF), toolBtn('Export CSV', exportCsv)),
    h('div.pven__intro', h('div', h('p.lede', byCity), gbox('Before you book', ul(C.rules))), art('partners-vendors-setup', 'A small event being set up in a Mumbai warehouse space', { ratio: '4/3' })),
    h('div.bar',
      h('input.field', { type: 'search', placeholder: 'Search name or service…', 'aria-label': 'Search vendors', oninput: (e) => { q.text = e.target.value.toLowerCase(); draw(); } }),
      select('all', [['all', 'All cities'], ...cities.map((c) => [c, c])], (v) => { q.city = v; draw(); }, 'City'),
      select('all', [['all', 'All types'], ...C.types], (v) => { q.type = v; draw(); }, 'Type'),
      h('label.small', { style: { margin: 0, display: 'flex', gap: '6px', alignItems: 'center', minHeight: '40px' } }, h('input', { type: 'checkbox', onchange: (e) => { q.short = e.target.checked; draw(); } }), '★ only'),
      count),
    formBox, grid];
}

// ================================================================ 6. integrations
const SVGNS = 'http://www.w3.org/2000/svg';
const s = (tag_, attrs = {}, ...kids) => { const el = document.createElementNS(SVGNS, tag_); for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v); kids.flat().forEach((k) => k != null && el.append(k instanceof Node ? k : document.createTextNode(String(k)))); return el; };
function integrations(m) {
  const C = P().integrations;
  if (!C) return missing();
  const st = store('partners-integrations', { status: {}, sel: 'sheet' });
  const statusOf = (t) => st.v.status[t.id] || t.status;
  const toolOf = (n) => C.tools.find((t) => t.id === n.tool);
  const W = 900, BW = 230, BH = 50, COLX = [20, 335, 650], ROWY = (r) => 24 + r * 84;
  const pos = Object.fromEntries(C.nodes.map((n) => [n.id, { x: COLX[n.col], y: ROWY(n.row) }]));
  const H = Math.max(...C.nodes.map((n) => ROWY(n.row))) + BH + 24;
  const detail = h('div');
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'pint__svg', role: 'img', 'aria-label': 'How the growth tools connect' });
  const draw = () => {
    const sel = st.v.sel;
    put(svg, 
      s('defs', {}, s('marker', { id: 'pint-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, s('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'currentColor' }))),
      ...C.edges.map(([a, b, label]) => {
        const A = pos[a], B = pos[b]; if (!A || !B) return null;
        const back = A.x >= B.x; // a draft going back to the Worker
        const x1 = back ? A.x : A.x + BW, y1 = A.y + BH / 2, x2 = back ? B.x + BW : B.x, y2 = B.y + BH / 2;
        const mx = (x1 + x2) / 2;
        const on = sel && (a === sel || b === sel);
        const d = back ? `M${x1},${y1} C${x1 - 60},${y1 + 50} ${x2 + 60},${y2 + 50} ${x2},${y2}` : `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
        return s('g', { class: 'pint__edge' + (on ? ' is-on' : '') }, s('path', { d, 'marker-end': 'url(#pint-arrow)' }), on ? s('text', { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 6, 'text-anchor': 'middle' }, label) : null);
      }),
      ...C.nodes.map((n) => {
        const p = pos[n.id], t = toolOf(n), stt = t ? statusOf(t) : 'later';
        const g = s('g', { class: `pint__node is-${stt}` + (n.id === sel ? ' is-sel' : ''), tabindex: 0, role: 'button', 'aria-label': n.t + ', ' + stt },
          s('rect', { x: p.x, y: p.y, width: BW, height: BH, rx: 14 }),
          s('circle', { cx: p.x + 18, cy: p.y + BH / 2, r: 5 }),
          s('text', { x: p.x + 32, y: p.y + BH / 2 + 5 }, n.t));
        const pickN = () => { st.v.sel = n.id; st.save(); draw(); sound.tick('click'); };
        g.addEventListener('click', pickN);
        g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickN(); } });
        return g;
      }));
    const n = C.nodes.find((x) => x.id === sel), t = n && toolOf(n);
    put(detail, t ? h('article.brief', { style: { '--c': 'var(--plat-4)' } },
      h('div.brief__head', h('div', h('h3.brief__t', n.t), h('p.brief__dates', t.tool, ' · ', statusOf(t)))),
      h('dl.dl', h('dt', 'Does'), h('dd', rich(t.purpose)), h('dt', 'In'), h('dd', t.in), h('dt', 'Out'), h('dd', t.out), h('dt', 'Owner'), h('dd', t.owner), h('dt', 'What we know'), h('dd', rich(t.note))),
      h('p.small', 'Connects to: ', C.edges.filter(([a, b]) => a === sel || b === sel).map(([a, b, l], i) => [i ? ' · ' : '', (C.nodes.find((x) => x.id === (a === sel ? b : a)) || {}).t, ` (${l})`]))) : null);
    drawTable();
  };
  const body = h('tbody');
  let filter = 'all';
  const drawTable = () => put(body, ...C.tools.filter((t) => filter === 'all' || statusOf(t) === filter).map((t) => h('tr',
    h('td.tbl__name', h('div.who', avatar({ name: t.tool, size: 28 }), h('span', t.tool))),
    h('td.tbl__wide', { 'data-k': 'Purpose' }, rich(t.purpose)),
    h('td', { 'data-k': 'In' }, t.in), h('td', { 'data-k': 'Out' }, t.out), h('td', { 'data-k': 'Owner' }, t.owner),
    h('td', { 'data-k': 'Status' }, select(statusOf(t), [['have', 'Have'], ['need', 'Need'], ['later', 'Later']], (v) => { st.v.status[t.id] = v; st.save(); draw(); }, 'Status for ' + t.tool)),
    h('td.tbl__wide.muted', rich(t.note)))));
  const exportCsv = () => download('wispr-growth-integrations.csv', csv([['tool', 'purpose', 'in', 'out', 'owner', 'status', 'what we know'], ...C.tools.map((t) => [t.tool, noSrc(t.purpose), t.in, t.out, t.owner, statusOf(t), noSrc(t.note)])]));
  draw();
  const legend = h('div.pint__legend', [['have', 'Have'], ['need', 'Need'], ['later', 'Later']].map(([k, t]) => h('span.pint__lg.is-' + k, t)));
  return [head(m, C.why, toolBtn('Export CSV', exportCsv)),
    gbox('Sameep’s own pattern', h('p', rich(C.pattern))),
    legend, h('div.pint__wrap', svg), h('p.note', 'Tap a box to see what flows in and out. The status is yours to change in the table, and the boxes follow.'), detail,
    h('div.bar', { style: { marginTop: '14px' } }, select('all', [['all', 'Every tool'], ['have', 'Have'], ['need', 'Need'], ['later', 'Later']], (v) => { filter = v; drawTable(); }, 'Status')),
    h('div.tbl-wrap', h('table.tbl.tbl--stack', h('thead', h('tr', ['Tool', 'Purpose', 'In', 'Out', 'Owner', 'Status', 'What we know'].map((t) => h('th', t)))), body)),
    gbox('Second-order', secondOrder(C.so))];
}

// ================================================================ the modules
const lateCount = () => { try { const v = JSON.parse(localStorage.getItem('wgos.partners-infcal') || '{}'); return (v.items || []).filter((i) => !i.done && i.date < TODAY).length; } catch { return 0; } };
const dueConnects = () => { try { const v = JSON.parse(localStorage.getItem('wgos.partners-connects') || '{}'); return (v.rows || []).filter((r) => r.due && r.next && r.due <= TODAY).length; } catch { return 0; } };

export const MODULES = [
  { id: 'infcal', label: 'Influencer calendar', c: 'var(--strawberry)', group: 'People', kicker: 'Creator dates', render: infcal, count: lateCount },
  { id: 'connects', label: 'Connects', c: 'var(--pulse)', group: 'People', kicker: 'Outreach log', render: connects, count: dueConnects },
  { id: 'partners', label: 'Partnerships', c: 'var(--grape)', group: 'People', kicker: 'Brand deals', render: partners },
  { id: 'negotiate', label: 'Negotiation', c: 'var(--fathom)', group: 'People', kicker: 'Draft replies, never sent', render: negotiate },
  { id: 'vendors', label: 'Event vendors', c: 'var(--tangerine)', group: 'Events', kicker: 'Bengaluru · Mumbai · Delhi', render: vendors, count: () => P().vendors?.list?.length || 0 },
  { id: 'integrations', label: 'Integrations', c: 'var(--plat-4)', group: 'Run it', kicker: 'What plugs into what', render: integrations },
];
