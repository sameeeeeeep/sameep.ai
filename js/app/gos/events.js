// gos/events.js — the Events area: 'eventlab' (four new event formats, each a full brief, on one
// Nov 2026 to Feb 2027 timeline) and 'runofshow' (a working run-of-show builder with print, CSV and a
// day-of checklist). Words come from D.MORE.events (served after sign-in); edits stay on this device.
import { h, D, sound, tag, sample, gbox, gboxW, rich, secondOrder, select, copyBtn, download, csv, head, store, art, fmtD, TODAY } from './kit.js';

const E = () => D.MORE?.events || {};
const FMTS = () => E().formats || [];
const STATUSES = ['idea', 'approved', 'live', 'done', 'cut'];
const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const uid = () => Math.random().toString(36).slice(2, 9);

// "18:30" ⇄ minutes after midnight
const toMin = (s) => { const m = String(s || '').match(/^(\d{1,2}):(\d{2})$/); return m ? (+m[1] * 60 + +m[2]) : 0; };
const clock = (n) => { const x = ((Math.round(n) % 1440) + 1440) % 1440; return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); };
const fmtLong = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const DEFAULT_START = { mic: '18:30', santa: '16:00', newyear: '18:00', founders: '19:30' };

const empty = (t) => h('p.empty', t);
const notReady = () => [empty('The event plans load after you sign in with a Wispr email.')];

// ================================================================ Event ideas
const lab = store('events-lab', { status: {}, notes: {}, budget: {}, extra: {}, santaNames: '', open: null });

function eventlab(m, { go, open } = {}) {
  const list = FMTS();
  if (!list.length) return [head(m, null), ...notReady()];
  const win = E().window || { from: '2026-11-01', to: '2027-02-28' };
  const statusOf = (f) => lab.v.status[f.id] || f.status || 'idea';

  let filter = 'all';
  const detail = h('div.evl-detail');
  const cardsBox = h('div.gos-grid');
  const tl = timeline(list, win, (f, d) => show(f, { date: d, scroll: true }));

  function drawCards() {
    const shown = list.filter((f) => filter === 'all' || statusOf(f) === filter);
    cardsBox.replaceChildren(...(shown.length ? shown.map((f) => h('button.card', { type: 'button', 'aria-pressed': String(lab.v.open === f.id), style: { '--c': f.c }, onclick: () => show(f, { scroll: true }) },
      h('div.card__top', h('p.card__t', f.name), tag(statusOf(f))),
      h('p.card__p', f.one),
      h('p.card__meta', h('span', (f.dates || []).length + ' dates'), h('span', f.dates?.[0] ? 'From ' + fmtD(f.dates[0].d) : ''), h('span', 'Budget ' + inr(budgetTotal(f)))))) : [empty('Nothing with that status yet.')]));
  }

  function show(f, { date, scroll } = {}) {
    lab.v.open = f.id; lab.save();
    drawCards();
    tl.mark(f.id, date);
    detail.replaceChildren(brief(f, { go, date, onStatus: drawCards }));
    if (scroll) detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (date) setTimeout(() => detail.querySelector(`[data-date="${date}"]`)?.classList.add('is-hit'), 50);
    sound.tick('pick');
  }

  const exportDates = () => download('wispr-event-dates.csv', csv([['Date', 'Format', 'What', 'Status'], ...list.flatMap((f) => (f.dates || []).map((d) => [d.d, f.name, d.t, statusOf(f)]))]));
  const view = [
    head(m, E().why, h('button.btn.btn--sm', { type: 'button', onclick: exportDates }, 'Export dates (CSV)')),
    gboxW('What lands when', tl.el, h('p.note', 'Nov 2026 to Feb 2027. Click a dot to open that event at that date.')),
    h('div.bar.evl-bar', h('span.evl-bar__k', 'Show'), select(filter, [['all', 'All formats'], ...STATUSES.map((s) => [s, s[0].toUpperCase() + s.slice(1)])], (v) => { filter = v; drawCards(); }, 'Filter by status')),
    cardsBox, detail,
  ];
  const start = list.find((f) => f.id === (open || lab.v.open)) || list[0];
  drawCards();
  show(start);
  return view;
}

// one clickable strip per format; a list on phones
function timeline(list, win, onPick) {
  const a = new Date(win.from + 'T00:00:00'), b = new Date(win.to + 'T00:00:00');
  const span = (b - a) / 864e5;
  const pct = (iso) => Math.max(0, Math.min(100, ((new Date(iso + 'T00:00:00') - a) / 864e5 / span) * 100));
  const months = [];
  const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  for (let d = new Date(a.getFullYear(), a.getMonth(), 1); d <= b; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) months.push(d);
  const todayIn = TODAY >= win.from && TODAY <= win.to;
  const now = () => (todayIn ? h('i.evtl__now', { style: { left: pct(TODAY) + '%' }, 'aria-hidden': 'true' }) : null);
  const dots = [];
  const rows = list.map((f) => {
    const ds = f.dates || [];
    const first = ds[0]?.d, last = ds[ds.length - 1]?.d;
    return h('div.evtl__row', { dataset: { f: f.id } },
      h('button.evtl__name', { type: 'button', onclick: () => onPick(f) }, h('i.evtl__chip', { style: { background: f.c } }), f.name),
      h('div.evtl__track', now(),
        first && h('span.evtl__span', { style: { left: pct(first) + '%', width: Math.max(0.5, pct(last) - pct(first)) + '%', background: f.c } }),
        ds.map((d) => { const btn = h('button.evtl__dot', { type: 'button', style: { left: pct(d.d) + '%', '--c': f.c }, title: fmtD(d.d) + ': ' + d.t, 'aria-label': `${f.name}, ${fmtLong(d.d)}: ${d.t}`, dataset: { f: f.id, d: d.d }, onclick: () => onPick(f, d.d) }); dots.push(btn); return btn; })));
  });
  const desk = h('div.evtl', { role: 'group', 'aria-label': 'Event timeline' },
    h('div.evtl__months', h('span'), h('div.evtl__mrow', months.map((d) => h('span.evtl__m', { style: { left: pct(isoOf(d)) + '%' } }, d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }))),
      todayIn && h('span.evtl__nowlabel', { style: { left: pct(TODAY) + '%' } }, 'Today'))),
    rows);
  // phones: the same dates as an agenda
  const all = list.flatMap((f) => (f.dates || []).map((d) => ({ f, ...d }))).sort((x, y) => x.d.localeCompare(y.d));
  const byMonth = {};
  for (const x of all) (byMonth[x.d.slice(0, 7)] ||= []).push(x);
  const agenda = h('div.evtl-agenda', Object.entries(byMonth).map(([mo, xs]) => h('div',
    h('p.evtl-agenda__m', new Date(mo + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })),
    h('div.evtl-agenda__list', xs.map((x) => h('button.evtl-agenda__item', { type: 'button', style: { '--c': x.f.c }, dataset: { f: x.f.id, d: x.d }, onclick: () => onPick(x.f, x.d) },
      h('span.evtl-agenda__d', fmtD(x.d)), h('span', h('b', x.f.name), ' · ', x.t, x.d < TODAY ? ' (past)' : '')))))));
  return {
    el: h('div', desk, agenda),
    mark(fid, d) {
      desk.querySelectorAll('.evtl__row').forEach((r) => r.classList.toggle('is-on', r.dataset.f === fid));
      dots.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.f === fid && (!d || b.dataset.d === d))));
      agenda.querySelectorAll('.evtl-agenda__item').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.f === fid && (!d || b.dataset.d === d))));
    },
  };
}

function budgetLines(f) {
  const own = lab.v.budget[f.id] || {};
  return [...(f.budget || []).map((b, i) => ({ ...b, key: 'b' + i, v: own['b' + i] ?? b.v, sample: b.sample && own['b' + i] == null })), ...(lab.v.extra[f.id] || []).map((b) => ({ ...b, mine: true }))];
}
const budgetTotal = (f) => budgetLines(f).reduce((s, b) => s + (Number(b.v) || 0), 0);

function brief(f, { go, date, onStatus }) {
  const status = () => lab.v.status[f.id] || f.status || 'idea';
  const sec = (label, ...kids) => gbox(label, ...kids);
  const list = (items) => h('ul.ul', (items || []).map((t) => h('li', rich(t))));
  const start = DEFAULT_START[f.id] || '18:00';

  // run of show, read-only here; the builder edits it
  let t = toMin(start);
  const rosTbl = h('div.tbl-wrap', h('table.tbl.tbl--stack.evl-ros',
    h('thead', h('tr', h('th', 'Time'), h('th', 'Min'), h('th', 'Segment'), h('th', 'Owner'), h('th', 'Mic / AV cue'), h('th', 'Notes'))),
    h('tbody', (f.ros || []).map((r) => { const at = clock(t); t += Number(r.dur) || 0; return h('tr',
      h('td.num', { 'data-k': 'Time' }, at), h('td.num', { 'data-k': 'Min' }, r.dur), h('td.tbl__name.tbl__wide', { 'data-k': 'Segment' }, r.seg), h('td', { 'data-k': 'Owner' }, r.owner), h('td.tbl__wide', { 'data-k': 'Cue' }, r.cue || '–'), h('td.tbl__wide.muted', { 'data-k': 'Notes' }, r.note || '–')); }),
      h('tr', h('td.num', clock(t)), h('td'), h('td.tbl__name.tbl__wide', 'End'), h('td'), h('td'), h('td')))));

  // budget: amounts you can change, each a sample until someone prices it
  const totalEl = h('span.evl-budget__total');
  const budgetBox = h('div.evl-budget');
  function drawBudget() {
    const lines = budgetLines(f);
    budgetBox.replaceChildren(
      ...lines.map((b) => h('div.evl-budget__row',
        b.mine ? h('input.field.evl-budget__k', { value: b.k, 'aria-label': 'Line name', oninput: (e) => { b.k = e.target.value; saveExtra(); } }) : h('span.evl-budget__k', b.k),
        h('label.evl-budget__v', h('span', '₹'), h('input.field', { type: 'number', min: '0', step: '1000', inputmode: 'numeric', value: String(b.v ?? 0), 'aria-label': b.k + ' amount', oninput: (e) => { const v = Math.max(0, Number(e.target.value) || 0); if (b.mine) { b.v = v; saveExtra(); } else { (lab.v.budget[f.id] ||= {})[b.key] = v; lab.save(); } sum(); onStatus(); }, onchange: () => drawBudget() })),
        b.sample ? sample() : tag('Entered', 'real'),
        b.mine ? h('button.btn.btn--sm', { type: 'button', 'aria-label': 'Remove ' + b.k, onclick: () => { lab.v.extra[f.id] = (lab.v.extra[f.id] || []).filter((x) => x.id !== b.id); lab.save(); drawBudget(); onStatus(); } }, 'Remove') : h('span'))),
      h('div.evl-budget__row.evl-budget__row--total', h('span.evl-budget__k', 'Total'), totalEl, h('span'), h('span')));
    sum();
  }
  function saveExtra() { lab.save(); }
  function sum() { totalEl.textContent = inr(budgetTotal(f)); }
  drawBudget();
  const addLine = h('button.btn.btn--sm', { type: 'button', onclick: () => { (lab.v.extra[f.id] ||= []).push({ id: uid(), k: 'New line', v: 0 }); lab.save(); drawBudget(); budgetBox.querySelector('.evl-budget__row:nth-last-child(2) input')?.select(); } }, 'Add a line');
  const resetBudget = h('button.btn.btn--sm', { type: 'button', onclick: () => { delete lab.v.budget[f.id]; delete lab.v.extra[f.id]; lab.save(); drawBudget(); onStatus(); } }, 'Reset to samples');
  const budgetCsv = h('button.btn.btn--sm', { type: 'button', onclick: () => download(`wispr-${f.id}-budget.csv`, csv([['Line', 'INR', 'Sample?'], ...budgetLines(f).map((b) => [b.k, b.v, b.sample ? 'sample' : 'entered']), ['Total', budgetTotal(f), '']])) }, 'Budget CSV');

  // the parts only some formats have
  const extras = [];
  if (f.plays) extras.push(sec('The plays', h('div.evl-plays', f.plays.map((p) => h('div.evl-play', h('p.evl-play__t', p.t), h('p.evl-play__d', rich(p.d)))))));
  if (f.people) extras.push(sec('Real shows and people that fit', h('div.tbl-wrap', h('table.tbl.tbl--stack',
    h('thead', h('tr', h('th', 'Who'), h('th', 'Kind'), h('th', 'With Wispr?'), h('th', 'Why'))),
    h('tbody', f.people.map((p) => h('tr',
      h('td.tbl__name.tbl__wide', { 'data-k': 'Who' }, p.name, p.src ? rich(` [${p.src}]`) : null),
      h('td', { 'data-k': 'Kind' }, p.kind),
      h('td', { 'data-k': 'Wispr' }, tag(p.wispr, /already/.test(p.wispr) ? 'live' : 'idea')),
      h('td.tbl__wide.muted', { 'data-k': 'Why' }, rich(p.note))))))),
  h('p.note', 'Checked by public search on 4 Nov 2026. ‘None found’ means no public Wispr sponsorship turned up, not that there is none. Contact through public pages only. ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); go('creators'); } }, 'See the Creators list →'))));
  if (f.kit) extras.push(sec('What’s in the kit', list(f.kit)), sec('Draw names', santaDraw()));
  if (f.stats) extras.push(sec('The numbers', h('ul.evl-stats', f.stats.map((s) => h('li', h('span', rich(s.t)), s.needsData ? tag('Needs data', 'warn') : null))),
    h('div.bar.evl-gap', h('button.btn.btn--primary', { type: 'button', onclick: () => go('wrapped') }, f.wrappedLink || 'Open Wispr Wrapped'))));
  if (f.guests) extras.push(h('div.gos-grid.gos-grid--2', sec('Guest mix', list(f.guests)), sec('What founders take home', list(f.takeaways))),
    sec('How it feeds LinkedIn', list(f.linkedin), h('div.bar.evl-gap', h('button.btn', { type: 'button', onclick: () => go('linkedin') }, 'Draft the posts in LinkedIn & founders'))));
  if (f.needsData?.length) extras.push(sec('Open before it can run', h('ul.evl-stats', f.needsData.map((t) => h('li', h('span', rich(t)), tag('Needs Wispr', 'warn'))))));

  const notes = h('textarea.field.field--area', { 'aria-label': 'Team notes', placeholder: 'Owner, venue holds, who said yes…', oninput: (e) => { lab.v.notes[f.id] = e.target.value; lab.save(); } });
  notes.value = lab.v.notes[f.id] || '';

  const text = () => [
    f.name.toUpperCase(), f.one, '', 'What: ' + f.what, 'Who: ' + f.who, 'Where: ' + (f.where || []).join('; '), 'When: ' + f.when, '',
    'Dates:', ...(f.dates || []).map((d) => `  ${d.d}  ${d.t}`), '',
    'Run of show (from ' + start + '):', ...(() => { let x = toMin(start); return (f.ros || []).map((r) => { const s = `  ${clock(x)}  ${r.dur} min  ${r.seg}  [${r.owner}]  ${r.cue || ''}`; x += Number(r.dur) || 0; return s; }); })(), '',
    'Budget (sample figures unless entered):', ...budgetLines(f).map((b) => `  ${b.k}: ${inr(b.v)}${b.sample ? ' (sample)' : ''}`), '  Total: ' + inr(budgetTotal(f)), '',
    'Staffing:', ...(f.staff || []).map((s) => '  ' + s), 'We film:', ...(f.film || []).map((s) => '  ' + s), '',
    'Success: ' + f.metric, '',
    'Second-order:', '  Causes: ' + f.so?.causes, '  Could backfire: ' + f.so?.backfire, '  Compounds: ' + f.so?.compounds, '  Kill it if: ' + f.so?.kill,
    lab.v.notes[f.id] ? '\nNotes: ' + lab.v.notes[f.id] : '',
  ].join('\n').replace(/\s*\[\d+(?:,\s*\d+)*\]/g, '');

  const arts = [f.art, f.art2, f.art3].filter(Boolean);
  return h('article.brief.evl-brief', { style: { '--c': f.c } },
    h('div.brief__head',
      h('div', h('h3.brief__t', f.name), h('p.brief__dates', f.when)),
      h('div.bar.evl-head-tools', select(status(), STATUSES, (v) => { lab.v.status[f.id] = v; lab.save(); onStatus(); }, 'Status'), copyBtn(text, 'Copy brief'))),
    h('div.evl-art', { dataset: { n: arts.length } }, arts.map((a, i) => art(a.id, a.alt, { ratio: i ? '4/3' : '16/9' }))),
    h('p.lede', rich(f.what)),
    h('div.gos-grid.gos-grid--2',
      sec('Who it’s for', h('p', rich(f.who))),
      sec('Where in India', list(f.where))),
    sec('Dates', h('ol.evl-dates', (f.dates || []).map((d) => h('li', { dataset: { date: d.d }, class: d.d === date ? 'is-hit' : null }, h('span.evl-dates__d', fmtLong(d.d)), h('span', d.t), d.d < TODAY ? tag('Past', 'done') : null)))),
    ...extras,
    sec('Run of show', h('p', f.rosTitle ? `${f.rosTitle}, from ${start}.` : `From ${start}.`), rosTbl,
      h('div.bar.evl-gap', h('button.btn.btn--primary', { type: 'button', onclick: () => go('runofshow', { seed: f.id }) }, 'Edit in Run of show'))),
    sec('Budget', budgetBox, h('div.bar.evl-gap', addLine, budgetCsv, resetBudget), h('p.note', 'Every figure starts as a sample. Type a real quote over one and it’s marked as entered.')),
    h('div.gos-grid.gos-grid--2', sec('Staffing', list(f.staff)), sec('What we film', list(f.film))),
    sec('Success looks like', h('p', rich(f.metric))),
    sec('Second-order', secondOrder(f.so)),
    sec('Team notes', notes, h('p.note', 'Saved on this device only.')));
}

// Secret Santa: names in, pairs out; nobody draws themselves
function santaDraw() {
  const ta = h('textarea.field.field--area', { 'aria-label': 'Names, one per line', placeholder: 'One name per line', oninput: (e) => { lab.v.santaNames = e.target.value; lab.save(); } });
  ta.value = lab.v.santaNames || '';
  const out = h('ol.evl-pairs');
  let pairs = [];
  function draw() {
    const names = [...new Set(ta.value.split('\n').map((s) => s.trim()).filter(Boolean))];
    if (names.length < 3) { out.replaceChildren(h('li.evl-pairs__msg', 'Add at least three names.')); pairs = []; return; }
    const s = names.slice();
    for (let i = s.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [s[i], s[j]] = [s[j], s[i]]; }
    pairs = s.map((n, i) => [n, s[(i + 1) % s.length]]); // one loop, so no one gets themselves
    out.replaceChildren(...pairs.map(([a, b]) => h('li', h('b', a), ' gives to ', h('b', b))));
    sound.tick('pick');
  }
  return h('div.evl-draw', ta,
    h('div.bar.evl-gap', h('button.btn.btn--primary', { type: 'button', onclick: draw }, 'Draw pairs'), copyBtn(() => pairs.map(([a, b]) => `${a} → ${b}`).join('\n') || 'Draw first', 'Copy pairs'),
      h('button.btn.btn--sm', { type: 'button', onclick: () => pairs.length && download('secret-santa-pairs.csv', csv([['Santa', 'Gives to'], ...pairs])) }, 'CSV')),
    out, h('p.note', 'Names stay on this device. Send each Santa only their own pair.'));
}

// ================================================================ Run of show
const ros = store('events-ros', { shows: [], cur: null });
const blankChecks = () => ({ done: {}, mine: [] });

function seedShow(fid) {
  const f = FMTS().find((x) => x.id === fid) || FMTS()[0];
  if (!f) return null;
  const first = (f.dates || []).find((d) => d.d >= TODAY) || f.dates?.[0];
  return { id: uid(), name: f.rosTitle || f.name, from: f.id, date: f.rosDate || first?.d || TODAY, start: DEFAULT_START[f.id] || '18:00', venue: '', rows: (f.ros || []).map((r) => ({ id: uid(), dur: r.dur, seg: r.seg, owner: r.owner, cue: r.cue || '', note: r.note || '' })), checks: blankChecks() };
}

function runofshow(m, { seed } = {}) {
  if (!FMTS().length) return [head(m, null), ...notReady()];
  const roles = E().roles || [];
  if (seed) {
    const have = ros.v.shows.find((s) => s.from === seed);
    if (have) ros.v.cur = have.id; else { const s = seedShow(seed); ros.v.shows.push(s); ros.v.cur = s.id; }
    ros.save();
  }
  if (!ros.v.shows.length) { const s = seedShow('mic'); ros.v.shows.push(s); ros.v.cur = s.id; ros.save(); }
  const cur = () => ros.v.shows.find((s) => s.id === ros.v.cur) || ros.v.shows[0];
  const save = () => ros.save();

  const wrap = h('div.ros');
  const dl = h('datalist#ros-roles', roles.map((r) => h('option', { value: r })));

  function draw() {
    const s = cur();
    ros.v.cur = s.id;
    s.checks ||= blankChecks();
    const picker = select(s.id, ros.v.shows.map((x) => [x.id, x.name || 'Untitled']), (v) => { ros.v.cur = v; save(); draw(); }, 'Pick a run of show');
    const seedSel = select('', [['', 'New from a format…'], ...FMTS().map((f) => [f.id, f.name])], (v) => { if (!v) return; const n = seedShow(v); ros.v.shows.push(n); ros.v.cur = n.id; save(); draw(); }, 'New from a format');
    const newBlank = h('button.btn.btn--sm', { type: 'button', onclick: () => { const n = { id: uid(), name: 'New event', date: TODAY, start: '18:00', venue: '', rows: [{ id: uid(), dur: 10, seg: 'Doors', owner: 'Guest wrangler', cue: '', note: '' }], checks: blankChecks() }; ros.v.shows.push(n); ros.v.cur = n.id; save(); draw(); } }, 'Blank');
    const dup = h('button.btn.btn--sm', { type: 'button', onclick: () => { const n = JSON.parse(JSON.stringify(s)); n.id = uid(); n.name = s.name + ' (copy)'; n.rows.forEach((r) => (r.id = uid())); n.checks = blankChecks(); ros.v.shows.push(n); ros.v.cur = n.id; save(); draw(); } }, 'Duplicate');
    const del = h('button.btn.btn--sm', { type: 'button', onclick: () => { if (!confirm(`Delete “${s.name}”? This can’t be undone.`)) return; ros.v.shows = ros.v.shows.filter((x) => x.id !== s.id); if (!ros.v.shows.length) ros.v.shows.push(seedShow('mic')); ros.v.cur = ros.v.shows[0].id; save(); draw(); } }, 'Delete');

    const field = (label, key, attrs = {}) => { const i = h('input.field', { value: s[key] || '', ...attrs, oninput: (e) => { s[key] = e.target.value; save(); if (key === 'start') times(); if (key === 'name') picker.querySelector(`option[value="${s.id}"]`).textContent = s.name || 'Untitled'; } }); return h('label', label, i); };
    const meta = h('div.form.ros-meta', field('Event', 'name'), field('Date', 'date', { type: 'date' }), field('Start time', 'start', { type: 'time', step: '300' }), field('Venue', 'venue', { placeholder: 'Room, city' }));

    // summary tiles
    const kEnd = h('p.kpi__v'), kLen = h('p.kpi__v'), kRows = h('p.kpi__v');
    const kpis = h('div.kpis.ros-kpis', h('div.kpi', h('p.kpi__k', 'Starts'), h('p.kpi__v', { dataset: { k: 'start' } }, s.start || '–')), h('div.kpi', h('p.kpi__k', 'Ends'), kEnd), h('div.kpi', h('p.kpi__k', 'Running time'), kLen), h('div.kpi', h('p.kpi__k', 'Segments'), kRows));

    // the rows
    const rowsBox = h('ol.ros-rows', { 'aria-label': 'Segments' });
    let dragId = null;
    function rowEl(r, i) {
      const inp = (key, attrs) => h('input.field', { value: r[key] ?? '', ...attrs, oninput: (e) => { r[key] = attrs?.type === 'number' ? Math.max(0, Number(e.target.value) || 0) : e.target.value; save(); if (key === 'dur') times(); } });
      const li = h('li.ros-row', { dataset: { id: r.id },
        ondragstart: (e) => { dragId = r.id; li.classList.add('is-drag'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', r.id); } catch { /* old browsers */ } },
        ondragend: () => { li.draggable = false; li.classList.remove('is-drag'); rowsBox.querySelectorAll('.is-over').forEach((x) => x.classList.remove('is-over')); },
        ondragover: (e) => { if (!dragId || dragId === r.id) return; e.preventDefault(); li.classList.add('is-over'); },
        ondragleave: () => li.classList.remove('is-over'),
        ondrop: (e) => { e.preventDefault(); if (!dragId || dragId === r.id) return; const from = s.rows.findIndex((x) => x.id === dragId), to = s.rows.findIndex((x) => x.id === r.id); const [mv] = s.rows.splice(from, 1); s.rows.splice(to, 0, mv); /* lands where it was dropped, above or below */ dragId = null; save(); drawRows(); sound.tick('pick'); } },
        h('button.ros-grip', { type: 'button', 'aria-label': 'Drag to reorder', title: 'Drag to reorder', onpointerdown: () => (li.draggable = true), onpointerup: () => (li.draggable = false) }, h('span', '⋮⋮')),
        h('span.ros-time', { dataset: { t: r.id } }),
        h('label.ros-f.ros-f--dur', h('span', 'Min'), inp('dur', { type: 'number', min: '0', step: '5', inputmode: 'numeric' })),
        h('label.ros-f.ros-f--seg', h('span', 'Segment'), inp('seg', { placeholder: 'What happens' })),
        h('label.ros-f.ros-f--own', h('span', 'Owner'), inp('owner', { list: 'ros-roles', placeholder: 'Role' })),
        h('div.ros-acts',
          h('button.btn.btn--sm', { type: 'button', 'aria-label': 'Move up', disabled: i === 0, onclick: () => move(i, -1) }, '↑'),
          h('button.btn.btn--sm', { type: 'button', 'aria-label': 'Move down', disabled: i === s.rows.length - 1, onclick: () => move(i, 1) }, '↓'),
          h('button.btn.btn--sm', { type: 'button', 'aria-label': 'Delete segment', onclick: () => { s.rows.splice(i, 1); save(); drawRows(); } }, '✕')),
        h('label.ros-f.ros-f--cue', h('span', 'Mic / AV cue'), inp('cue', { placeholder: 'Mics, screen, music' })),
        h('label.ros-f.ros-f--note', h('span', 'Notes'), inp('note', { placeholder: 'Anything the crew should know' })));
      return li;
    }
    function move(i, d) { const j = i + d; if (j < 0 || j >= s.rows.length) return; [s.rows[i], s.rows[j]] = [s.rows[j], s.rows[i]]; save(); drawRows(); }
    function drawRows() {
      rowsBox.replaceChildren(...(s.rows.length ? s.rows.map(rowEl) : [h('li.empty', 'No segments yet. Add one below.')]));
      times();
    }
    function times() {
      let t = toMin(s.start);
      for (const r of s.rows) { const el = rowsBox.querySelector(`[data-t="${r.id}"]`); if (el) el.textContent = clock(t); t += Number(r.dur) || 0; }
      const len = s.rows.reduce((a, r) => a + (Number(r.dur) || 0), 0);
      kEnd.textContent = clock(toMin(s.start) + len);
      kLen.textContent = len >= 60 ? `${Math.floor(len / 60)}h ${String(len % 60).padStart(2, '0')}m` : `${len}m`;
      kRows.textContent = String(s.rows.length);
      const st = kpis.querySelector('[data-k="start"]'); if (st) st.textContent = s.start || '–';
    }
    const addRow = h('button.btn.btn--primary', { type: 'button', onclick: () => { s.rows.push({ id: uid(), dur: 10, seg: '', owner: '', cue: '', note: '' }); save(); drawRows(); rowsBox.lastElementChild?.querySelector('.ros-f--seg input')?.focus(); } }, 'Add a segment');

    const rowsOut = () => { let t = toMin(s.start); return s.rows.map((r) => { const o = [clock(t), r.dur, r.seg, r.owner, r.cue, r.note]; t += Number(r.dur) || 0; return o; }); };
    const exportCsv = h('button.btn.btn--sm', { type: 'button', onclick: () => download(`run-of-show-${(s.name || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`, csv([['Time', 'Minutes', 'Segment', 'Owner', 'Mic / AV cue', 'Notes'], ...rowsOut(), [clock(toMin(s.start) + s.rows.reduce((a, r) => a + (Number(r.dur) || 0), 0)), '', 'End', '', '', '']])) }, 'CSV');
    const asText = () => [`${s.name} · ${s.date ? fmtLong(s.date) : ''} · ${s.venue || ''}`, ...rowsOut().map((r) => `${r[0]}  (${r[1]}m)  ${r[2]}  [${r[3]}]${r[4] ? '  · ' + r[4] : ''}`), `End ${kEnd.textContent}`].join('\n');
    const printBtn = h('button.btn.btn--sm', { type: 'button', onclick: () => printSheet(s, rowsOut(), kEnd.textContent, checkItems(s)) }, 'Print view');

    // day-of checklist: the shared list plus your own
    const checkBox = h('ul.check.ros-check');
    function checkItems(sh) { return [...(E().dayof || []).map((t, i) => ({ key: 'd' + i, t })), ...(sh.checks.mine || []).map((x) => ({ key: x.id, t: x.t, mine: true }))]; }
    function drawChecks() {
      const items = checkItems(s);
      checkBox.replaceChildren(...items.map((c) => h('li.ros-check__item',
        h('label', h('input', { type: 'checkbox', checked: !!s.checks.done[c.key], onchange: (e) => { s.checks.done[c.key] = e.target.checked; save(); prog(); } }), h('span', c.t)),
        c.mine ? h('button.btn.btn--sm', { type: 'button', 'aria-label': 'Remove ' + c.t, onclick: () => { s.checks.mine = s.checks.mine.filter((x) => x.id !== c.key); delete s.checks.done[c.key]; save(); drawChecks(); } }, '✕') : null)));
      prog();
    }
    const progEl = h('p.note');
    function prog() { const items = checkItems(s); const n = items.filter((c) => s.checks.done[c.key]).length; progEl.textContent = `${n} of ${items.length} done.`; }
    const newCheck = h('input.field', { placeholder: 'Add your own item', 'aria-label': 'New checklist item', onkeydown: (e) => { if (e.key === 'Enter') addCheck(); } });
    function addCheck() { const t = newCheck.value.trim(); if (!t) return; s.checks.mine.push({ id: uid(), t }); newCheck.value = ''; save(); drawChecks(); }

    wrap.replaceChildren(
      h('div.bar.ros-pick', picker, seedSel, newBlank, dup, del),
      gboxW('The event', meta),
      kpis,
      gboxW('Segments', h('p.note.ros-hint', 'Drag a row by its handle, or use the arrows. Times update as you type.'), rowsBox, h('div.bar.evl-gap', addRow, exportCsv, copyBtn(asText, 'Copy as text'), printBtn)),
      gboxW('Day-of checklist', checkBox, h('div.bar.evl-gap', newCheck, h('button.btn.btn--sm', { type: 'button', onclick: addCheck }, 'Add'), h('button.btn.btn--sm', { type: 'button', onclick: () => { s.checks.done = {}; save(); drawChecks(); } }, 'Untick all')), progEl),
      dl);
    drawRows(); drawChecks();
  }
  draw();
  return [head(m, E().rosWhy), wrap];
}

// a clean sheet in its own tab, so the crew can print it or save it as a PDF
function printSheet(s, rows, end, checks) {
  const w = window.open('', '_blank');
  if (!w) { alert('Your browser blocked the print tab. Allow pop-ups for this site, or use CSV instead.'); return; }
  const d = w.document;
  const el = (tagName, text, kids = []) => { const x = d.createElement(tagName); if (text != null) x.textContent = text; kids.forEach((k) => x.append(k)); return x; };
  d.title = 'Run of show: ' + (s.name || 'Event');
  const style = el('style', `body{font:14px/1.45 Figtree,system-ui,sans-serif;color:#1a1a1a;margin:32px}h1{font:400 32px/1.1 "EB Garamond",Georgia,serif;margin:0 0 4px}p{margin:0 0 18px;color:#5d5d52}table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;padding:8px 10px;border-bottom:1px solid #ddd}th{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#5d5d52}td:first-child,td:nth-child(2){white-space:nowrap;font-variant-numeric:tabular-nums}h2{font:400 22px "EB Garamond",Georgia,serif;margin:28px 0 8px}ul{padding:0;list-style:none}li{padding:4px 0}li::before{content:"☐  "}@media print{body{margin:12mm}button{display:none}}`);
  d.head.append(style);
  const tbl = el('table', null, [
    el('thead', null, [el('tr', null, ['Time', 'Min', 'Segment', 'Owner', 'Mic / AV cue', 'Notes'].map((t) => el('th', t)))]),
    el('tbody', null, [...rows.map((r) => el('tr', null, r.map((v) => el('td', String(v ?? ''))))), el('tr', null, [el('td', end), el('td', ''), el('td', 'End'), el('td', ''), el('td', ''), el('td', '')])]),
  ]);
  const btn = el('button', 'Print'); btn.onclick = () => w.print();
  d.body.append(el('h1', s.name || 'Run of show'), el('p', [s.date ? fmtLong(s.date) : '', s.venue, `${s.start} to ${end}`].filter(Boolean).join(' · ')), btn, tbl, el('h2', 'Day-of checklist'), el('ul', null, checks.map((c) => el('li', c.t))));
  setTimeout(() => { try { w.focus(); w.print(); } catch { /* the Print button is there */ } }, 300);
}

export const MODULES = [
  { id: 'eventlab', label: 'Event ideas', c: 'var(--dawn)', group: 'Events', kicker: 'Events · new formats', count: () => FMTS().length, render: eventlab },
  { id: 'runofshow', label: 'Run of show', c: 'var(--fathom)', group: 'Events', kicker: 'Events · run it', count: () => ros.v.shows.length || 0, render: runofshow },
];
