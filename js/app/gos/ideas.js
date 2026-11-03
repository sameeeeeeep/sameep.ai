// gos/ideas.js — the Plan area's working tools: Ideas (bank + generator), Brainstorm, Storyboards and
// Campaign tracking. Words come from D.MORE.ideas (served after sign-in); edits stay on this device.
import { h, D, sound, tag, sample, gbox, gboxW, ul, rich, secondOrder, tabs, select, copyBtn, download, csv, head, store, art, fmtD, days, TODAY } from './kit.js';

const X = () => D.MORE?.ideas || {};
const plain = (s) => String(s ?? '').replace(/\s?\[\d+(?:,\s*\d+)*\]/g, '');
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const empty = (t) => h('p.empty', t);
const late = (el, on) => { el.classList.toggle('is-overdue', !!on); return el; };
const stageList = () => X().stages || [['raw', 'Raw'], ['shortlisted', 'Shortlisted'], ['brainstorm', 'In brainstorm'], ['approved', 'Approved'], ['parked', 'Parked']];
const stageName = (id) => (stageList().find((s) => s[0] === id) || [id, id])[1];
const STAGE_TAG = { approved: 'approved', brainstorm: 'live', parked: 'done', shortlisted: 'real', raw: 'raw' };

// one store object per namespace for the whole session, so modules never overwrite each other's edits
const stores = {};
const st = (ns, init) => (stores[ns] ||= store('ideas-' + ns, init));
const bankS = () => st('bank', { added: [], stage: {}, stars: {}, f: { q: '', type: '', stage: '', star: false } });
const boardS = () => st('brainstorm', { cur: '', boards: {} });
const sbS = () => st('sb', { edits: {}, added: {} });
const trS = () => st('track', { cur: '', camps: {} });

export function allIdeas() {
  const s = bankS().v;
  return [...(X().bank || []), ...s.added].map((i) => ({ ...i, stage: s.stage[i.id] || i.stage || 'raw' }));
}
function setStage(id, stage) { const s = bankS(); s.v.stage[id] = stage; s.save(); }

// ================================================================ Ideas
function ideasModule(m, { go, focus } = {}) {
  const x = X();
  if (!x.bank) return [head(m, null), empty('The idea bank loads after sign-in.')];
  const S = bankS();
  const detail = h('div');
  const form = addIdeaForm(() => { paintList(); sound.tick('pick'); });
  const list = h('div');
  let paintList = () => {};

  function openIdea(i) {
    detail.replaceChildren(ideaBrief(i, go, () => { paintList(); const now = allIdeas().find((y) => y.id === i.id); if (now) openIdea(now); else detail.replaceChildren(); }));
    detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
    sound.tick('pick');
  }

  function bankPane() {
    const f = S.v.f;
    const q = h('input.field', { type: 'search', placeholder: 'Search ideas', value: f.q, 'aria-label': 'Search ideas', oninput: (e) => { f.q = e.target.value; S.save(); paintList(); } });
    const starBtn = h('button.btn.btn--sm', { type: 'button', 'aria-pressed': String(!!f.star), onclick: () => { f.star = !f.star; starBtn.setAttribute('aria-pressed', String(f.star)); starBtn.textContent = f.star ? '★ Starred only' : '☆ Starred only'; S.save(); paintList(); } }, f.star ? '★ Starred only' : '☆ Starred only');
    const bar = h('div.bar', q,
      select(f.type, [['', 'All types'], ...(x.types || []).map((t) => [t, t])], (v) => { f.type = v; S.save(); paintList(); }, 'Type'),
      select(f.stage, [['', 'All stages'], ...stageList()], (v) => { f.stage = v; S.save(); paintList(); }, 'Stage'),
      starBtn);
    paintList = () => {
      const needle = f.q.trim().toLowerCase();
      const rows = allIdeas().filter((i) => (!f.type || i.type === f.type) && (!f.stage || i.stage === f.stage) && (!f.star || S.v.stars[i.id]) && (!needle || (i.t + ' ' + i.pitch).toLowerCase().includes(needle)));
      list.replaceChildren(rows.length
        ? h('div.gos-grid.gi-cards', rows.map((i) => ideaCard(i, { onOpen: () => openIdea(i), onChange: paintList, go })))
        : empty(f.star ? 'No starred ideas match. Star a few with ☆.' : 'Nothing matches. Clear the filters, or add an idea.'));
      list.append(h('p.note', `${rows.length} of ${allIdeas().length} ideas. Stars and stages are saved on this device.`));
    };
    paintList();
    return [bar, list];
  }

  function stagePane() {
    const wrap = h('div.gi-kan');
    const paint = () => {
      const ids = stageList().map((s) => s[0]);
      wrap.replaceChildren(...stageList().map(([id, label]) => {
        const rows = allIdeas().filter((i) => i.stage === id);
        return h('section.gi-kan__col', h('h4.gi-kan__h', label, h('span.gos__count', String(rows.length))),
          rows.length ? rows.map((i) => {
            const k = ids.indexOf(id);
            return h('div.gi-kan__card',
              h('button.gi-kan__t', { type: 'button', onclick: () => openIdea(i) }, i.t),
              h('p.gi-kan__meta', i.type, ' · ', i.effort),
              h('div.gi-kan__mv',
                h('button.btn.btn--sm', { type: 'button', disabled: k === 0, 'aria-label': `Move ${i.t} back`, onclick: () => { setStage(i.id, ids[k - 1]); paint(); sound.tick('click'); } }, '←'),
                h('button.btn.btn--sm', { type: 'button', disabled: k === ids.length - 1, 'aria-label': `Move ${i.t} forward`, onclick: () => { setStage(i.id, ids[k + 1]); paint(); sound.tick('click'); } }, '→')));
          }) : h('p.gi-kan__empty', 'Nothing here.'));
      }));
    };
    paint();
    return [wrap, h('p.note', 'Move ideas along with the arrows. Raw → shortlisted → in brainstorm → approved. Parked is for good ideas at the wrong time.')];
  }

  const view = [
    head(m, x.why?.ideas,
      h('button.btn.btn--sm', { type: 'button', onclick: () => { form.hidden = !form.hidden; if (!form.hidden) form.querySelector('input')?.focus(); } }, '+ New idea'),
      h('button.btn.btn--sm', { type: 'button', onclick: () => download('wispr-india-ideas.csv', ideasCsv()) }, 'Export CSV')),
    form,
    tabs(['Bank', 'By stage', 'Generator'], (i) => (i === 0 ? bankPane() : i === 1 ? stagePane() : generator(() => { paintList(); }))),
    detail,
  ];
  const start = focus && allIdeas().find((i) => i.id === focus);
  if (start) setTimeout(() => openIdea(start), 0);
  return view;
}

function ideaCard(i, { onOpen, onChange, go }) {
  const S = bankS();
  const star = h('button.star', { type: 'button', 'aria-pressed': String(!!S.v.stars[i.id]), 'aria-label': `Star ${i.t}`, onclick: () => { S.v.stars[i.id] = !S.v.stars[i.id]; if (!S.v.stars[i.id]) delete S.v.stars[i.id]; S.save(); star.setAttribute('aria-pressed', String(!!S.v.stars[i.id])); star.textContent = S.v.stars[i.id] ? '★' : '☆'; sound.tick('click'); } }, S.v.stars[i.id] ? '★' : '☆');
  return h('div.card.gi-card', { style: { '--c': typeColor(i.type) } },
    h('div.card__top', h('p.card__t', i.t), star),
    h('p.card__p', rich(i.pitch)),
    h('div.tags', tag(i.type, 'real'), h('span.tag', { title: effortName(i.effort) }, 'Effort ' + i.effort), i.hero ? tag('Hero', 'live') : null, i.mine ? tag('Yours') : null, i.generated ? tag('Generated') : null),
    h('div.gi-card__row',
      select(i.stage, stageList(), (v) => { setStage(i.id, v); onChange(); sound.tick('click'); }, 'Stage'),
      h('button.btn.btn--sm', { type: 'button', onclick: onOpen }, 'Open'),
      h('button.btn.btn--sm', { type: 'button', onclick: () => go('brainstorm', { idea: i.id }) }, 'Brainstorm')));
}
const typeColor = (t) => ({ Campaign: 'var(--fathom)', Event: 'var(--glow)', 'Product-led': 'var(--dawn)', Partnership: 'var(--signal)' }[t] || 'var(--line-2)');
const effortName = (e) => ((X().efforts || []).find((x) => x[0] === e) || [e, e])[1];

function ideaBrief(i, go, rerender) {
  const b = i.brief;
  const sb = (X().storyboards || []).find((s) => s.idea === i.id);
  const S = bankS();
  return h('article.brief', { style: { '--c': typeColor(i.type) } },
    h('div.brief__head',
      h('div', h('h3.brief__t', i.t), h('p.brief__dates', `${i.type} · ${effortName(i.effort)} · ${stageName(i.stage)}`)),
      h('div.row', { style: { marginTop: 0 } },
        select(i.stage, stageList(), (v) => { setStage(i.id, v); rerender(); }, 'Stage'),
        copyBtn(() => ideaText(i), 'Copy'),
        h('button.btn.btn--sm', { type: 'button', onclick: () => go('brainstorm', { idea: i.id }) }, 'Brainstorm it'),
        sb && h('button.btn.btn--sm', { type: 'button', onclick: () => go('storyboards', { board: sb.id }) }, 'Storyboard'),
        i.mine && h('button.btn.btn--sm', { type: 'button', onclick: () => { if (!confirm(`Remove “${i.t}” from the bank on this device?`)) return; S.v.added = S.v.added.filter((y) => y.id !== i.id); S.save(); rerender(); } }, 'Remove'))),
    h('p.lede', rich(i.pitch)),
    b && b.ref && gbox('Where this comes from', h('p', rich(b.ref))),
    b && h('dl.dl',
      h('dt', 'Goal'), h('dd', rich(b.goal)),
      h('dt', 'Who for'), h('dd', rich(b.audience)),
      h('dt', 'The insight'), h('dd', rich(b.insight)),
      h('dt', 'The idea'), h('dd', rich(b.idea)),
      h('dt', 'Channels'), h('dd', rich((b.channels || []).join(' · '))),
      h('dt', 'KPIs'), h('dd', ul(b.kpis || [])),
      h('dt', 'Budget'), h('dd', rich(b.budget || 'tbc'))),
    gbox('Second-order', secondOrder(i.so)));
}
function ideaText(i) {
  const b = i.brief;
  return plain([
    `${i.t} (${i.type}, effort ${i.effort}, ${stageName(i.stage)})`, '', i.pitch,
    ...(b ? ['', `Goal: ${b.goal}`, `Who for: ${b.audience}`, `Insight: ${b.insight}`, `Idea: ${b.idea}`, `Channels: ${(b.channels || []).join(', ')}`, 'KPIs:', ...(b.kpis || []).map((k) => '- ' + k), `Budget: ${b.budget}`] : []),
    '', 'Second-order', `- Causes: ${i.so?.causes || ''}`, `- Could backfire: ${i.so?.backfire || ''}`, `- Compounds: ${i.so?.compounds || ''}`, `- Kill if: ${i.so?.kill || ''}`,
  ].join('\n'));
}
function ideasCsv() {
  const s = bankS().v;
  return csv([['Idea', 'Type', 'Effort', 'Stage', 'Starred', 'Pitch', 'Causes', 'Could backfire', 'Compounds', 'Kill if'],
    ...allIdeas().map((i) => [i.t, i.type, i.effort, stageName(i.stage), s.stars[i.id] ? 'yes' : '', plain(i.pitch), plain(i.so?.causes), plain(i.so?.backfire), plain(i.so?.compounds), plain(i.so?.kill)])]);
}

function addIdeaForm(done) {
  const x = X();
  const f = h('form.gbox.gbox--white.form', { hidden: true },
    h('h3.gbox__label', 'New idea'),
    h('label.full', 'Name', h('input.field', { name: 't', required: true, maxlength: 80, placeholder: 'e.g. Exam-season notes by voice' })),
    h('label.full', 'One-line pitch', h('input.field', { name: 'pitch', required: true, maxlength: 240, placeholder: 'Who, what, and why now, in one line' })),
    h('label', 'Type', select('Campaign', (x.types || []).map((t) => [t, t]), () => {}, 'Type')),
    h('label', 'Effort', select('S', (x.efforts || []).map((e) => [e[0], e[1]]), () => {}, 'Effort')),
    h('label.full', 'What it causes', h('input.field', { name: 'causes', placeholder: 'What happens next if it works' })),
    h('label.full', 'What could backfire?', h('input.field', { name: 'backfire', required: true, placeholder: 'Required. If you can’t think of one, think again.' })),
    h('label.full', 'How it compounds', h('input.field', { name: 'compounds', placeholder: 'Why it gets cheaper or better over time' })),
    h('label.full', 'Kill it if', h('input.field', { name: 'kill', required: true, placeholder: 'e.g. under 200 sign-ups in two weeks' })),
    h('div.form__row', h('button.btn', { type: 'button', onclick: () => { f.hidden = true; } }, 'Cancel'), h('button.btn.btn--primary', { type: 'submit' }, 'Add to the bank')));
  const sels = f.querySelectorAll('select');
  sels[0].name = 'type'; sels[1].name = 'effort';
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    const S = bankS();
    S.v.added.push({ id: uid('u'), t: d.t.trim(), pitch: d.pitch.trim(), type: d.type, effort: d.effort, stage: 'raw', mine: true, so: { causes: d.causes || 'tbc', backfire: d.backfire, compounds: d.compounds || 'tbc', kill: d.kill } });
    S.save(); f.reset(); f.hidden = true; done();
  });
  return f;
}

// ---------------------------------------------------------------- the generator
const fill = (tpl, ctx) => String(tpl || '').replace(/\{(\w)\.(\w+)\}/g, (_, k, f) => ctx[k]?.[f] ?? '');
const cap = (s) => s.replace(/(^|[.?]\s+)([a-z])/g, (_, a, b) => a + b.toUpperCase());
const hash = (s) => [...s].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
export function compose(g, pick) {
  const ctx = { m: g.moments.find((x) => x.id === pick.m), a: g.audiences.find((x) => x.id === pick.a), f: g.formats.find((x) => x.id === pick.f), b: g.behaviours.find((x) => x.id === pick.b) };
  if (!ctx.m || !ctx.a || !ctx.f || !ctx.b) return null;
  const n = hash(pick.m + pick.a + pick.f + pick.b);
  return {
    t: cap(fill(g.titles[n % g.titles.length], ctx)),
    pitch: cap(fill(g.pitches[n % g.pitches.length], ctx)),
    type: ctx.f.type, effort: ctx.f.effort,
    so: Object.fromEntries(Object.entries(g.so || {}).map(([k, v]) => [k, cap(fill(v, ctx))])),
    from: `${ctx.m.t} · ${ctx.a.t} · ${ctx.f.t} · ${ctx.b.t}`,
  };
}
function generator(onKeep) {
  const g = X().gen;
  if (!g) return empty('The generator loads after sign-in.');
  const S = st('gen', { m: g.moments[0].id, a: g.audiences[0].id, f: g.formats[0].id, b: g.behaviours[0].id });
  const pick = S.v;
  const out = h('div');
  const groups = [['m', 'An Indian moment', g.moments], ['a', 'An audience', g.audiences], ['f', 'A format', g.formats], ['b', 'A Flow behaviour', g.behaviours]];
  const chips = groups.map(([k, label, opts]) => h('fieldset.gi-ing',
    h('legend.gi-ing__l', label),
    h('div.gi-chips', opts.map((o) => h('button.gi-chip', { type: 'button', 'aria-pressed': String(pick[k] === o.id), title: o.when || o.who || '', onclick: (e) => { pick[k] = o.id; S.save(); e.currentTarget.parentNode.querySelectorAll('.gi-chip').forEach((c) => c.setAttribute('aria-pressed', String(c === e.currentTarget))); paint(); sound.tick('click'); } }, o.t)))));
  function paint() {
    const idea = compose(g, pick);
    if (!idea) { out.replaceChildren(empty('Pick one of each.')); return; }
    const keep = h('button.btn.btn--primary', { type: 'button', onclick: () => {
      const B = bankS();
      if (B.v.added.some((y) => y.t === idea.t && y.pitch === idea.pitch)) { keep.textContent = 'Already in the bank'; return; }
      B.v.added.push({ id: uid('g'), ...idea, stage: 'raw', mine: true, generated: true }); B.save();
      keep.textContent = 'Kept. It’s in the bank as Raw'; keep.disabled = true; sound.tick('pick'); onKeep();
    } }, 'Keep it');
    out.replaceChildren(h('article.brief.gi-gen',
      h('div.brief__head', h('div', h('p.gos__kicker', 'Composed from your picks'), h('h3.brief__t', idea.t), h('p.brief__dates', idea.from)),
        h('div.row', { style: { marginTop: 0 } }, tag(idea.type), tag('Effort ' + idea.effort), keep, copyBtn(() => plain(`${idea.t}\n\n${idea.pitch}\n\nCauses: ${idea.so.causes}\nCould backfire: ${idea.so.backfire}\nCompounds: ${idea.so.compounds}\nKill if: ${idea.so.kill}`)))),
      h('p.lede', rich(idea.pitch)),
      gbox('Second-order, to argue with', secondOrder(idea.so)),
      h('p.note', 'Made from templates, not an AI call. Same picks, same idea. Edit it once it’s in the bank by brainstorming it.')));
  }
  const shuffle = h('button.btn.btn--sm', { type: 'button', onclick: () => {
    groups.forEach(([k, , opts]) => { pick[k] = opts[Math.floor(Math.random() * opts.length)].id; });
    S.save(); chips.forEach((fs, gi) => fs.querySelectorAll('.gi-chip').forEach((c, ci) => c.setAttribute('aria-pressed', String(groups[gi][2][ci].id === pick[groups[gi][0]])))); paint(); sound.tick('pick');
  } }, 'Shuffle the picks');
  paint();
  return [gboxW('Pick the ingredients', h('div.gi-ings', chips), h('div.row', shuffle)), out];
}

// ================================================================ Brainstorm
let timer = null; // one round at a time: { end, left, running }
function brainstormModule(m, { go, idea } = {}) {
  const x = X();
  if (!x.brainstorm) return [head(m, null), empty('The brainstorm board loads after sign-in.')];
  const B = boardS();
  const ideas = allIdeas();
  if (!ideas.length) return [head(m, x.why?.brainstorm), empty('Add an idea to the bank first.')];
  const cur = ideas.find((i) => i.id === (idea || B.v.cur)) || ideas.find((i) => i.stage === 'brainstorm') || ideas[0];
  if (B.v.cur !== cur.id) { B.v.cur = cur.id; B.save(); }
  const board = (B.v.boards[cur.id] ||= { notes: [], hmw: 0 });
  const prompts = [...(x.brainstorm.special?.[cur.id] || []), ...(x.brainstorm.hmw || [])].map((p) => p.replace(/\{idea\}/g, '“' + cur.t + '”'));
  const DOTS = 5;
  const used = () => board.notes.reduce((a, n) => a + (n.dots || 0), 0);
  const save = () => B.save();

  // how-might-we
  const hmwText = h('p.quote.gi-hmw');
  const showHmw = () => { hmwText.textContent = prompts[board.hmw % prompts.length] || ''; };
  showHmw();
  const hmw = gboxW('How might we…', hmwText, h('div.row',
    h('button.btn.btn--sm', { type: 'button', onclick: () => { board.hmw = (board.hmw + 1) % prompts.length; save(); showHmw(); sound.tick('click'); } }, 'Next prompt'),
    copyBtn(() => prompts.join('\n'), 'Copy all prompts')));

  // the ten-minute round
  const clock = h('span.gi-clock', { role: 'timer', 'aria-live': 'off' });
  const status = h('p.note', { 'aria-live': 'polite' });
  const startBtn = h('button.btn.btn--primary.btn--sm', { type: 'button' });
  const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const paintClock = () => {
    const t = timer || { left: 600000, running: false };
    const left = t.running ? t.end - Date.now() : t.left;
    clock.textContent = fmt(left);
    startBtn.textContent = t.running ? 'Pause' : left < 600000 && left > 0 ? 'Resume' : 'Start 10 minutes';
    if (t.running && left <= 0) { timer = { left: 0, running: false }; status.textContent = 'Time. Stop writing and vote.'; sound.tick('pick'); paintClock(); }
  };
  startBtn.onclick = () => {
    const t = timer || { left: 600000, running: false };
    if (t.running) timer = { left: t.end - Date.now(), running: false };
    else { const left = t.left > 0 ? t.left : 600000; timer = { end: Date.now() + left, running: true }; status.textContent = 'Write. One thought per note. No judging yet.'; }
    paintClock(); sound.tick('click');
  };
  const reset = h('button.btn.btn--sm', { type: 'button', onclick: () => { timer = null; status.textContent = ''; paintClock(); } }, 'Reset');
  paintClock();
  const tick = setInterval(() => { if (!clock.isConnected) { clearInterval(tick); return; } if (timer?.running) paintClock(); }, 500);
  const round = gbox('The round', h('div.gi-round', clock, h('div.row', startBtn, reset)), status, h('ol.ul.gi-how', (x.brainstorm.howto || []).map((t) => h('li', t))));

  // sticky columns + dots
  const cols = h('div.gi-cols');
  const dotsLeft = h('span.tag');
  const out = h('div');
  function paintBoard() {
    dotsLeft.textContent = `${DOTS - used()} of ${DOTS} dots left`;
    cols.replaceChildren(...(x.brainstorm.columns || []).map(([id, label, hint]) => {
      const notes = board.notes.filter((n) => n.col === id).sort((a, b) => (b.dots || 0) - (a.dots || 0));
      const inp = h('input.field', { placeholder: hint, maxlength: 200, 'aria-label': `New ${label} note` });
      return h('section.gi-col.gi-col--' + id,
        h('h4.gi-col__h', label, h('span.gos__count', String(notes.length))),
        notes.length ? notes.map((n) => h('div.gi-note',
          h('p.gi-note__t', n.t),
          h('div.gi-note__row',
            h('span.gi-dots', { 'aria-label': `${n.dots || 0} dots` }, Array.from({ length: n.dots || 0 }, () => h('i'))),
            h('button.btn.btn--sm', { type: 'button', disabled: used() >= DOTS, 'aria-label': 'Add a dot', onclick: () => { n.dots = (n.dots || 0) + 1; save(); paintBoard(); sound.tick('click'); } }, '+'),
            h('button.btn.btn--sm', { type: 'button', disabled: !n.dots, 'aria-label': 'Take a dot back', onclick: () => { n.dots -= 1; save(); paintBoard(); } }, '−'),
            h('button.btn.btn--sm', { type: 'button', 'aria-label': 'Delete note', onclick: () => { board.notes = board.notes.filter((y) => y !== n); save(); paintBoard(); } }, '×')))) : h('p.gi-kan__empty', 'No notes yet.'),
        h('form.gi-col__add', { onsubmit: (e) => {
          e.preventDefault();
          const t = inp.value.trim(); if (!t) return;
          board.notes.push({ id: uid('n'), col: id, t, dots: 0 });
          if (['raw', 'shortlisted'].includes(cur.stage)) { setStage(cur.id, 'brainstorm'); cur.stage = 'brainstorm'; }
          save(); paintBoard(); sound.tick('click');
          cols.querySelector(`.gi-col--${id} input`)?.focus();
        } }, inp, h('button.btn.btn--sm', { type: 'submit' }, 'Add')));
    }));
    paintBrief();
  }
  const top = (col) => board.notes.filter((n) => n.col === col).sort((a, b) => (b.dots || 0) - (a.dots || 0))[0];
  function briefText() {
    const t = top('idea') || [...board.notes].sort((a, b) => (b.dots || 0) - (a.dots || 0))[0];
    if (!t) return '';
    return plain([
      `Campaign brief: ${cur.t}`, '',
      `The idea: ${t.t}${t.dots ? ` (${t.dots} of ${used()} dots)` : ''}`,
      `Starting point: ${cur.pitch}`,
      `The insight: ${top('insight')?.t || 'tbc, nobody wrote one'}`,
      `Biggest risk: ${top('risk')?.t || cur.so?.backfire || 'tbc'}`,
      `First cheap test: ${top('test')?.t || 'tbc'}`, '',
      'Second-order',
      `- Causes: ${cur.so?.causes || 'tbc'}`, `- Could backfire: ${cur.so?.backfire || 'tbc'}`, `- Compounds: ${cur.so?.compounds || 'tbc'}`, `- Kill if: ${cur.so?.kill || 'tbc'}`, '',
      'Other notes from the round:',
      ...board.notes.filter((n) => n !== t).map((n) => `- [${n.col}] ${n.t}${n.dots ? ` (${n.dots})` : ''}`),
    ].join('\n'));
  }
  function paintBrief() {
    const txt = briefText();
    out.replaceChildren(txt
      ? h('div', h('pre.post.gi-pre', txt), h('div.row', copyBtn(briefText, 'Copy the brief'), h('button.btn.btn--sm', { type: 'button', onclick: () => { setStage(cur.id, 'approved'); cur.stage = 'approved'; sound.tick('pick'); go('ideas', { focus: cur.id }); } }, 'Mark the idea approved')))
      : empty('Add a few notes and vote. The top idea note becomes the brief.'));
  }
  paintBoard();

  return [
    head(m, x.why?.brainstorm, select(cur.id, ideas.map((i) => [i.id, i.t]), (v) => go('brainstorm', { idea: v, quiet: true }), 'Idea to brainstorm')),
    h('p.lede', h('b', cur.t), ' · ', rich(cur.pitch)),
    h('div.gos-grid.gos-grid--2', hmw, round),
    gboxW('The board', h('div.bar', dotsLeft,
      h('button.btn.btn--sm', { type: 'button', onclick: () => { board.notes.forEach((n) => { n.dots = 0; }); save(); paintBoard(); } }, 'Clear dots'),
      h('button.btn.btn--sm', { type: 'button', onclick: () => { if (!confirm('Clear every note on this board?')) return; board.notes = []; save(); paintBoard(); } }, 'Clear board')), cols),
    gbox('Turn the top note into a campaign brief', out),
    h('p.note', 'Each idea keeps its own board on this device. Five dots for the room: hand the laptop round, or vote together.'),
  ];
}

// ================================================================ Storyboards
const FIELDS = [['shot', 'Shot'], ['see', 'What we see'], ['hear', 'What we hear / VO'], ['text', 'On-screen text'], ['dur', 'Seconds']];
function framesOf(b) {
  const S = sbS().v;
  const ed = S.edits[b.id] || {};
  return [...b.frames, ...(S.added[b.id] || [])].map((f, i) => ({ ...f, ...(ed[i] || {}), n: i + 1, mine: i >= b.frames.length }));
}
const secs = (fr) => fr.reduce((a, f) => a + (Number(f.dur) || 0), 0);
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
function storyboardsModule(m, { go, board } = {}) {
  const x = X();
  const list = x.storyboards || [];
  if (!list.length) return [head(m, null), empty('The storyboards load after sign-in.')];
  const start = Math.max(0, list.findIndex((b) => b.id === board));
  return [
    head(m, x.why?.storyboards),
    tabs(list.map((b) => b.t), (i) => boardView(list[i], go), start),
  ];
}
function boardView(b, go) {
  const S = sbS();
  let editing = false;
  const grid = h('div.gsb-grid');
  const meta = h('p.card__meta');
  const editBtn = h('button.btn.btn--sm', { type: 'button', 'aria-pressed': 'false', onclick: () => { editing = !editing; editBtn.setAttribute('aria-pressed', String(editing)); editBtn.textContent = editing ? 'Done editing' : 'Edit frames'; paint(); } }, 'Edit frames');
  const idea = allIdeas().find((i) => i.id === b.idea);
  function set(i, k, v) {
    const val = k === 'dur' ? Number(v) || 0 : v;
    // the frames you added are edited in place; the plan's frames keep their edits on the side
    if (i >= b.frames.length) S.v.added[b.id][i - b.frames.length][k] = val;
    else ((S.v.edits[b.id] ||= {})[i] ||= {})[k] = val;
    S.save(); paintMeta();
  }
  function paintMeta() { const fr = framesOf(b); meta.replaceChildren(h('span', `${fr.length} frames`), h('span', `${mmss(secs(fr))} running time`), idea ? h('span', stageName(idea.stage)) : null); }
  function paint() {
    paintMeta();
    grid.replaceChildren(...framesOf(b).map((f, i) => h('article.gsb-frame',
      art(`sb-${b.id}-${f.n}`, `Frame ${f.n}: ${plain(f.see)}`, { ratio: '16/9' }),
      h('div.gsb-frame__top', h('span.gsb-n', String(f.n).padStart(2, '0')), editing ? null : h('span.gsb-shot', f.shot), h('span.gsb-dur', (Number(f.dur) || 0) + 's')),
      editing
        ? h('div.gsb-edit', FIELDS.map(([k, label]) => h('label', label, k === 'see' || k === 'hear'
          ? h('textarea.field.field--area', { rows: 3, oninput: (e) => set(i, k, e.target.value) }, f[k] || '')
          : h('input.field', { type: k === 'dur' ? 'number' : 'text', min: k === 'dur' ? 0 : null, max: k === 'dur' ? 120 : null, value: String(f[k] ?? ''), oninput: (e) => set(i, k, e.target.value) }))),
          f.mine && h('button.btn.btn--sm', { type: 'button', onclick: () => { const a = S.v.added[b.id] || []; a.splice(i - b.frames.length, 1); S.save(); paint(); } }, 'Remove frame'))
        : [h('p.gsb-see', rich(f.see)), h('p.gsb-hear', h('b', 'Hear '), rich(f.hear)), f.text ? h('p.gsb-text', f.text) : null])));
    if (editing) grid.append(h('button.gsb-add', { type: 'button', onclick: () => { (S.v.added[b.id] ||= []).push({ shot: 'New shot', see: '', hear: '', text: '', dur: 3 }); S.save(); paint(); } }, '+ Add a frame'));
  }
  paint();
  return [
    h('p.lede', rich(b.logline)),
    h('div.bar',
      h('button.btn.btn--primary.btn--sm', { type: 'button', onclick: () => present(b) }, 'Present'),
      editBtn,
      copyBtn(() => shotList(b), 'Copy shot list'),
      idea && h('button.btn.btn--sm', { type: 'button', onclick: () => go('ideas', { focus: idea.id }) }, 'Open the idea'),
      h('button.btn.btn--sm', { type: 'button', onclick: () => { if (!confirm('Undo your edits to this storyboard?')) return; delete S.v.edits[b.id]; delete S.v.added[b.id]; S.save(); paint(); } }, 'Reset')),
    meta, grid,
    h('p.note', 'Pictures are placeholders until the art is made. Edits stay on this device.'),
  ];
}
function shotList(b) {
  const fr = framesOf(b);
  return plain([`${b.t}: shot list (${fr.length} frames, ${mmss(secs(fr))})`, b.logline, '',
    ...fr.flatMap((f) => [`${f.n}. ${f.shot} (${f.dur}s)`, `   See: ${f.see}`, `   Hear: ${f.hear}`, f.text ? `   On screen: ${f.text}` : null, ''].filter((l) => l != null))].join('\n'));
}
function present(b) {
  const fr = framesOf(b);
  let i = 0;
  const stage = h('div.gsb-pres__stage');
  const count = h('span.gsb-pres__n');
  const prev = h('button.btn', { type: 'button', 'aria-label': 'Previous frame', onclick: () => go(-1) }, '←');
  const next = h('button.btn', { type: 'button', 'aria-label': 'Next frame', onclick: () => go(1) }, '→');
  const close = () => { document.removeEventListener('keydown', key, true); ov.remove(); };
  const ov = h('div.gsb-pres', { role: 'dialog', 'aria-modal': 'true', 'aria-label': `${b.t}, presenting`, tabindex: '-1' },
    h('div.gsb-pres__bar', h('p.gsb-pres__t', b.t), count, h('button.btn.btn--sm', { type: 'button', onclick: close }, 'Close')),
    stage,
    h('div.gsb-pres__nav', prev, next));
  function paint() {
    const f = fr[i];
    count.textContent = `${i + 1} / ${fr.length}`;
    prev.disabled = i === 0; next.disabled = i === fr.length - 1;
    stage.replaceChildren(
      art(`sb-${b.id}-${f.n}`, `Frame ${f.n}: ${plain(f.see)}`, { ratio: '16/9' }),
      h('div.gsb-pres__copy',
        h('p.gos__kicker', `${f.shot} · ${f.dur}s`),
        h('p.gsb-pres__see', plain(f.see)),
        h('p.gsb-pres__hear', plain(f.hear)),
        f.text ? h('p.gsb-pres__text', f.text) : null));
  }
  function go(d) { const n = Math.min(fr.length - 1, Math.max(0, i + d)); if (n !== i) { i = n; paint(); sound.tick('click'); } }
  function key(e) {
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); go(-1); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  }
  document.addEventListener('keydown', key, true);
  paint();
  (document.querySelector('.win--gos .gos') || document.body).append(ov);
  ov.focus();
}

// ================================================================ Campaign tracking
const trackable = () => (D.CAMPAIGNS || []).filter((c) => c.status !== 'cut');
function campState(c) {
  const T = trS();
  return (T.v.camps[c.id] ||= { stage: 'brief', rag: '', why: '', items: {}, added: [], log: [], nums: {} });
}
function deliverables(c) {
  const tr = X().tracking || {};
  const s = campState(c);
  const mk = (d, key) => {
    const due = d.dueIso || addDays(d.end ? c.end : c.start, d.due || 0);
    return { key, t: d.t, stage: d.stage, role: d.role, due, status: 'to do', ...(s.items[key] || {}), mine: key.startsWith('u') };
  };
  return [...(tr.base || []).map((d, i) => mk(d, 'b' + i)), ...((tr.extra || {})[c.id] || []).map((d, i) => mk(d, 'x' + i)), ...s.added.map((d) => mk(d, d.key))]
    .sort((a, b) => a.due.localeCompare(b.due));
}
const ragName = (r) => ((X().tracking?.rag || []).find((x) => x[0] === r) || ['', 'Not set'])[1];
function trackingModule(m, { go, camp } = {}) {
  const tr = X().tracking;
  const list = trackable();
  if (!tr || !list.length) return [head(m, null), empty('Campaign tracking loads after sign-in.')];
  const T = trS();
  const c = list.find((x) => x.id === (camp || T.v.cur)) || list[0];
  if (T.v.cur !== c.id) { T.v.cur = c.id; T.save(); }
  const s = campState(c);
  const save = () => T.save();
  const stages = tr.stages || [];
  const stIds = stages.map((x) => x[0]);
  const log = (t, who = 'Growth OS') => { s.log.unshift({ at: new Date().toISOString(), who, t }); save(); paintLog(); };

  // overview
  const overview = h('div.tbl-wrap', h('table.tbl.tbl--stack', h('thead', h('tr', ['Campaign', 'Stage', 'Status', 'Done', 'Next due'].map((t) => h('th', t)))),
    h('tbody', list.map((x) => {
      const xs = campState(x); const dl = deliverables(x); const done = dl.filter((d) => d.status === 'done').length;
      const nxt = dl.find((d) => d.status !== 'done');
      return h('tr', { class: x.id === c.id ? 'is-on' : null },
        h('td.tbl__name', h('a', { href: '#', onclick: (e) => { e.preventDefault(); go('tracking', { camp: x.id, quiet: true }); } }, x.name)),
        h('td', { 'data-k': 'Stage' }, (stages.find((y) => y[0] === xs.stage) || ['', '—'])[1]),
        h('td', { 'data-k': 'Status' }, h('span.gtr-rag.gtr-rag--' + (xs.rag || 'none'), ragName(xs.rag))),
        h('td.num', { 'data-k': 'Done' }, `${done}/${dl.length}`),
        h('td', { 'data-k': 'Next due', class: nxt && nxt.due < TODAY ? 'is-overdue' : null }, nxt ? `${fmtD(nxt.due)} · ${nxt.t}` : 'All done'));
    }))));

  // flow strip
  const strip = h('ol.gtr-flow');
  function paintStrip() {
    const k = stIds.indexOf(s.stage);
    strip.replaceChildren(...stages.map(([id, label, hint], i) => h('li', { class: i < k ? 'is-done' : i === k ? 'is-on' : null },
      h('button.gtr-flow__b', { type: 'button', 'aria-current': i === k ? 'step' : null, title: hint, onclick: () => { if (s.stage === id) return; s.stage = id; save(); paintStrip(); log(`Moved to ${label}.`); sound.tick('click'); } },
        h('span.gtr-flow__n', String(i + 1)), h('span.gtr-flow__l', label)))));
  }
  paintStrip();

  // RAG
  const why = h('input.field', { value: s.why || '', placeholder: 'Why this colour, in one line', 'aria-label': 'Reason for status', onchange: (e) => { s.why = e.target.value; save(); log(`Status note: ${s.why}`); } });
  const ragRow = h('div.bar.gtr-ragrow',
    h('div.gtr-ragpick', { role: 'radiogroup', 'aria-label': 'Status' }, (tr.rag || []).map(([id, label]) => h('button.gtr-ragbtn.gtr-rag--' + id, { type: 'button', role: 'radio', 'aria-checked': String(s.rag === id), onclick: (e) => {
      s.rag = id; save(); e.currentTarget.parentNode.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b === e.currentTarget))); log(`Status set to ${label.toLowerCase()}.`); sound.tick('click');
    } }, label))), why);

  // deliverables
  const dlBox = h('div');
  function setItem(d, patch, note) { s.items[d.key] = { ...(s.items[d.key] || {}), ...patch }; save(); if (note) log(note); }
  function listView() {
    const dl = deliverables(c);
    return h('div.tbl-wrap', h('table.tbl.tbl--stack.gtr-dl', h('thead', h('tr', ['', 'Deliverable', 'Owner', 'Due', 'Status'].map((t) => h('th', t)))),
      h('tbody', dl.map((d) => h('tr', { class: d.status === 'done' ? 'is-done' : null },
        h('td.tbl__star', h('input.gtr-chk', { type: 'checkbox', checked: d.status === 'done', 'aria-label': `Done: ${d.t}`, onchange: (e) => { setItem(d, { status: e.target.checked ? 'done' : 'to do' }, `${e.target.checked ? 'Done' : 'Reopened'}: ${d.t}.`); paintDl(); } })),
        h('td.tbl__name.tbl__wide', d.t, h('span.tbl__sub', (stages.find((y) => y[0] === d.stage) || ['', d.stage])[1]),
          d.mine && h('button.gtr-x', { type: 'button', 'aria-label': `Remove ${d.t}`, onclick: () => { s.added = s.added.filter((y) => y.key !== d.key); delete s.items[d.key]; save(); paintDl(); } }, 'Remove')),
        h('td', { 'data-k': 'Owner' }, select(d.role, (tr.roles || []).map((r) => [r, r]), (v) => setItem(d, { role: v }), 'Owner role')),
        h('td', { 'data-k': 'Due' }, late(h('input.field.gtr-date', { type: 'date', value: d.due, 'aria-label': `Due date for ${d.t}`, onchange: (e) => { if (e.target.value) { setItem(d, { due: e.target.value }); paintDl(); } } }), d.due < TODAY && d.status !== 'done')),
        h('td', { 'data-k': 'Status' }, select(d.status, (tr.statuses || []).map((x) => [x, x[0].toUpperCase() + x.slice(1)]), (v) => { setItem(d, { status: v }, `${d.t}: ${v}.`); paintDl(); }, 'Status')))))));
  }
  function dlBoard() {
    const dl = deliverables(c);
    const sts = tr.statuses || [];
    return h('div.gi-kan.gtr-kan', sts.map((stt, k) => {
      const rows = dl.filter((d) => d.status === stt);
      return h('section.gi-kan__col', h('h4.gi-kan__h', stt[0].toUpperCase() + stt.slice(1), h('span.gos__count', String(rows.length))),
        rows.length ? rows.map((d) => h('div.gi-kan__card',
          h('p.gi-kan__t', d.t), h('p.gi-kan__meta', d.role, ' · ', h('span', { class: d.due < TODAY && stt !== 'done' ? 'is-overdue' : null }, fmtD(d.due))),
          h('div.gi-kan__mv',
            h('button.btn.btn--sm', { type: 'button', disabled: k === 0, 'aria-label': `Move ${d.t} back`, onclick: () => { setItem(d, { status: sts[k - 1] }, `${d.t}: ${sts[k - 1]}.`); paintDl(); } }, '←'),
            h('button.btn.btn--sm', { type: 'button', disabled: k === sts.length - 1, 'aria-label': `Move ${d.t} forward`, onclick: () => { setItem(d, { status: sts[k + 1] }, `${d.t}: ${sts[k + 1]}.`); paintDl(); } }, '→')))) : h('p.gi-kan__empty', 'Nothing here.'));
    }));
  }
  let dlMode = 0;
  const dlTabs = h('div.gtabs', { role: 'tablist' }, ['List', 'Board'].map((t, i) => h('button.gtab', { type: 'button', role: 'tab', 'aria-selected': String(i === dlMode), onclick: (e) => { dlMode = i; dlTabs.querySelectorAll('.gtab').forEach((b) => b.setAttribute('aria-selected', String(b === e.currentTarget))); paintDl(); } }, t)));
  function paintDl() { dlBox.replaceChildren(dlMode ? dlBoard() : listView()); paintProgress(); }
  const progress = h('p.note');
  function paintProgress() { const dl = deliverables(c); const done = dl.filter((d) => d.status === 'done').length; const late = dl.filter((d) => d.status !== 'done' && d.due < TODAY).length; progress.textContent = `${done} of ${dl.length} done${late ? ` · ${late} overdue` : ''}.`; }
  const addF = h('form.form.gtr-add', { hidden: true, onsubmit: (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(addF));
    if (!d.t.trim()) return;
    s.added.push({ key: uid('u'), t: d.t.trim(), role: d.role, stage: d.stage, dueIso: d.due || c.start });
    save(); log(`Added deliverable: ${d.t.trim()}.`); addF.reset(); addF.hidden = true; paintDl();
  } },
  h('label.full', 'Deliverable', h('input.field', { name: 't', required: true, maxlength: 120, placeholder: 'e.g. Hindi cutdown for Reels' })),
  h('label', 'Owner role', h('select.sel', { name: 'role' }, (tr.roles || []).map((r) => h('option', { value: r }, r)))),
  h('label', 'Stage', h('select.sel', { name: 'stage' }, stages.map(([id, l]) => h('option', { value: id }, l)))),
  h('label', 'Due', h('input.field', { name: 'due', type: 'date', value: c.start })),
  h('div.form__row', h('button.btn', { type: 'button', onclick: () => { addF.hidden = true; } }, 'Cancel'), h('button.btn.btn--primary', { type: 'submit' }, 'Add deliverable')));
  paintDl();

  // numbers the team types in
  const nums = gboxW('Numbers, typed in by the team',
    h('p.note', 'Nothing here is real until someone types it. Write where each number came from.'),
    h('div.tbl-wrap', h('table.tbl.tbl--stack', h('thead', h('tr', ['KPI', 'Value', 'Source / as of'].map((t) => h('th', t)))),
      h('tbody', (c.kpis || []).map((k, i) => {
        const v = (s.nums[i] ||= { v: '', src: '' });
        return h('tr',
          h('td.tbl__name.tbl__wide', rich(k)),
          h('td', { 'data-k': 'Value' }, h('input.field.gtr-num', { value: v.v, inputmode: 'decimal', placeholder: '—', 'aria-label': `Value for ${plain(k)}`, onchange: (e) => { v.v = e.target.value.trim(); save(); if (v.v) log(`${plain(k)}: ${v.v}${v.src ? ` (${v.src})` : ''}.`); } })),
          h('td', { 'data-k': 'Source' }, h('input.field', { value: v.src, placeholder: 'e.g. Mixpanel, 12 Dec', 'aria-label': `Source for ${plain(k)}`, onchange: (e) => { v.src = e.target.value.trim(); save(); } })));
      })))));

  // what happened
  const logList = h('div');
  const logIn = h('textarea.field.field--area', { rows: 2, placeholder: 'What happened? Write it like you’d tell a teammate.', 'aria-label': 'What happened' });
  const who = h('select.sel', { 'aria-label': 'Who' }, (tr.roles || []).map((r) => h('option', { value: r }, r)));
  const logF = h('form.gtr-logf', { onsubmit: (e) => { e.preventDefault(); const t = logIn.value.trim(); if (!t) return; log(t, who.value); logIn.value = ''; sound.tick('pick'); } }, logIn, h('div.row', who, h('button.btn.btn--primary.btn--sm', { type: 'submit' }, 'Add update')));
  function paintLog() {
    const samples = !s.log.length ? ((tr.sampleLog || {})[c.id] || []) : [];
    logList.replaceChildren(
      s.log.length ? h('ol.gtr-log', s.log.map((l) => h('li', h('p.gtr-log__m', h('b', l.who), ' · ', new Date(l.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })), h('p.gtr-log__t', l.t))))
        : samples.length ? h('div', h('ol.gtr-log.is-sample', samples.map((l) => h('li', h('p.gtr-log__m', h('b', l.who), ' · ', fmtD(addDays(c.start, l.d)), ' ', sample()), h('p.gtr-log__t', l.t)))), h('p.note', 'Example lines, to show the shape. They go away when you add your first update.'))
          : empty('Nothing logged yet. Moves, ticks and status changes land here too.'));
  }
  paintLog();

  return [
    head({ ...m, kicker: 'Run the campaigns' }, X().why?.tracking,
      select(c.id, list.map((x) => [x.id, x.name]), (v) => go('tracking', { camp: v, quiet: true }), 'Campaign'),
      h('button.btn.btn--sm', { type: 'button', onclick: () => download(`tracking-${c.id}.csv`, trackCsv()) }, 'Export CSV')),
    gbox('All campaigns', overview),
    h('article.gbox.gbox--white.gtr-camp', { style: { '--c': c.c } },
      h('div.gtr-camp__head', h('div', h('h3.gbox__label', c.name), h('p.card__meta', h('span', `${fmtD(c.start)} – ${fmtD(c.end)}`), h('span', c.owner || 'Owner tbc'), c.tier && h('span', c.tier), h('span', `${days(TODAY, c.start) > 0 ? `starts in ${days(TODAY, c.start)} days` : days(TODAY, c.end) >= 0 ? 'running now' : 'ended'}`))),
        h('button.btn.btn--sm', { type: 'button', onclick: () => go('campaigns', { focus: c.id }) }, 'Open the brief')),
      strip, ragRow),
    gbox('Deliverables', h('div.bar', dlTabs, h('button.btn.btn--sm', { type: 'button', onclick: () => { addF.hidden = !addF.hidden; } }, '+ Deliverable')), addF, dlBox, progress),
    nums,
    gbox('What happened', logF, logList),
  ];

  function trackCsv() {
    const rows = [['Campaign', 'Kind', 'Item', 'Owner / who', 'Due / when', 'Status / value', 'Stage / source']];
    for (const x of list) {
      const xs = campState(x);
      rows.push([x.name, 'Campaign', 'Stage and status', '', '', ragName(xs.rag), (stages.find((y) => y[0] === xs.stage) || ['', ''])[1] + (xs.why ? ` · ${xs.why}` : '')]);
      deliverables(x).forEach((d) => rows.push([x.name, 'Deliverable', d.t, d.role, d.due, d.status, d.stage]));
      (x.kpis || []).forEach((k, i) => { const n = xs.nums[i]; if (n?.v) rows.push([x.name, 'Number', plain(k), '', '', n.v, n.src]); });
      xs.log.forEach((l) => rows.push([x.name, 'Update', l.t, l.who, l.at.slice(0, 10), '', '']));
    }
    return csv(rows);
  }
}

// ================================================================ the modules
export const MODULES = [
  { id: 'ideas', label: 'Ideas', c: 'var(--glow)', group: 'Plan', kicker: 'The idea bank', render: ideasModule, count: () => (X().bank ? allIdeas().length : 0) },
  { id: 'brainstorm', label: 'Brainstorm', c: 'var(--dawn)', group: 'Plan', kicker: 'Ten minutes, one idea', render: brainstormModule },
  { id: 'storyboards', label: 'Storyboards', c: 'var(--signal)', group: 'Plan', kicker: 'See the film first', render: storyboardsModule, count: () => (X().storyboards || []).length },
  { id: 'tracking', label: 'Campaign tracking', c: 'var(--fathom)', group: 'Plan', kicker: 'Run the campaigns', render: trackingModule, count: () => (X().tracking ? trackable().length : 0) },
];
