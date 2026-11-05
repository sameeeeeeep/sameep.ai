// gos/brand.js — the Brand group's working tools: a brand guideline (with a "say it like Wispr" checker),
// moodboards for India directions, a social numbers dashboard, a LinkedIn calendar and contest kits.
// Words come from D.MORE.brand (served after sign-in); edits stay on this device (wgos.brand-*).
import { h, sound, D, rich, tag, sample, gbox, gboxW, ul, secondOrder, tabs, select, copyBtn, download, csv, head, store, art, fmtD, TODAY } from './kit.js';

const B = () => D.MORE?.brand || {};
const plain = (t) => String(t ?? '').replace(/\s?\[\d+(?:,\s*\d+)*\]/g, '');
const missing = (m) => [head(m, null), h('div.empty', 'This part of the plan didn’t load. Close Growth OS and sign in again.')];
const nf = (n) => (n == null || Number.isNaN(n) ? '–' : Math.round(n).toLocaleString('en-IN'));
const pct = (n) => (n == null || !Number.isFinite(n) ? '–' : (n * 100).toFixed(1) + '%');
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const clone = (x) => JSON.parse(JSON.stringify(x));
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); };
const mondayOf = (s) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };
async function copyText(t, el, label) { try { await navigator.clipboard.writeText(t); if (el) { el.dataset.copied = '1'; setTimeout(() => delete el.dataset.copied, 1200); } sound.tick('pick'); } catch { if (el && label) el.title = 'Copy failed: select it by hand'; } }
// re-render one part of a page and keep the scroll where it was
const swap = (box, ...kids) => { const page = box.closest('.gos__page'); const y = page?.scrollTop; box.replaceChildren(...kids.flat()); if (page) page.scrollTop = y; };

// inline SVG (h() makes HTML elements, charts need the SVG namespace)
const NS = 'http://www.w3.org/2000/svg';
function sv(name, attrs = {}, ...kids) {
  const el = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const k of kids.flat()) if (k != null) el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return el;
}

// ================================================================ 1. brand guideline
function lum(hex) {
  const c = hex.replace('#', '').match(/../g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// the "say it like Wispr" checker: rule-based flags and a plainer suggestion
export function analyse(text, R) {
  const hits = [];
  const find = (re, kind, extra = () => ({})) => { for (const mm of text.matchAll(re)) hits.push({ i: mm.index, j: mm.index + mm[0].length, kind, word: mm[0], ...extra(mm) }); };
  const wordRe = (w) => new RegExp(`(^|[^\\p{L}\\p{N}])(${esc(w)})(?=$|[^\\p{L}\\p{N}])`, 'giu');
  const findWord = (w, kind, say) => { for (const mm of text.matchAll(wordRe(w))) { const i = mm.index + mm[1].length; hits.push({ i, j: i + mm[2].length, kind, word: mm[2], say }); } };
  find(/!+/g, 'bang');
  (R.hype || []).forEach((w) => findWord(w, 'hype'));
  (R.jargon || []).forEach((j) => findWord(j.w, 'jargon', j.say));
  const ALLOW = new Set(['UPI', 'IIT', 'IIM', 'CEO', 'CTO', 'SaaS', 'NCR', 'GST', 'IPL', 'OOH', 'WhatsApp', 'LinkedIn', 'ASCI', 'DPDP']);
  find(/\b[A-Z]{4,}\b/g, 'caps');
  const emoji = [...text.matchAll(/\p{Extended_Pictographic}/gu)];
  if (emoji.length > 1) emoji.slice(1).forEach((mm) => hits.push({ i: mm.index, j: mm.index + mm[0].length, kind: 'emoji', word: mm[0] }));
  // longest wins where hits overlap (e.g. "transcription solution" over "solution")
  const marks = hits.filter((x) => !(x.kind === 'caps' && (ALLOW.has(x.word) || hits.some((y) => y !== x && y.kind !== 'caps' && y.i <= x.i && y.j >= x.j))))
    .sort((a, b) => a.i - b.i || (b.j - b.i) - (a.j - a.i))
    .filter((x, k, arr) => !arr.slice(0, k).some((y) => y.i <= x.i && y.j > x.i));
  const long = [];
  for (const mm of text.matchAll(/[^.!?\n]+[.!?]*/g)) { const n = (mm[0].match(/[\p{L}\p{N}'’-]+/gu) || []).length; if (n > (R.maxWords || 20)) long.push({ s: mm[0].trim(), n }); }
  // the suggestion: swap or drop the flagged words, full stops for bangs, calm capitals
  let out = '';
  let at = 0;
  for (const x of marks) {
    out += text.slice(at, x.i);
    if (x.kind === 'bang') out += '.';
    else if (x.kind === 'jargon') out += plain(x.say || '');
    else if (x.kind === 'caps') out += x.word.toLowerCase();
    else if (x.kind === 'emoji') out += '';
    // hype: dropped
    at = x.j;
  }
  out += text.slice(at);
  out = out.trim().replace(/[ \t]{2,}/g, ' ').replace(/\s+([.,;:])/g, '$1').replace(/\.{2,}/g, '.').replace(/(^|[.?]\s+)([a-z])/g, (_, a, b) => a + b.toUpperCase()).replace(/\b(a|an|the|our|your)\s+(?=[.,])/gi, '').trim();
  return { marks, long, out };
}

function guide(m) {
  const G = B().guide;
  if (!G) return missing(m);
  return [head(m, G.why),
    h('p.gb-disc', tag('Sameep’s read', 'warn'), ' ', G.disclaimer),
    tabs(['Logo', 'Colour', 'Type', 'Voice', 'Say it like Wispr', 'India', 'Do and don’t'], (i) => [logo, colour, type, voice, rewriter, india, pairs][i](), 0)];

  function logo() {
    // no drawn lockup on purpose: the real marks come from Wispr's own media kit
    return [h('p.lede', 'The logo isn’t redrawn here. For the real marks, use Wispr’s media kit: ',
        h('a', { href: 'https://wisprflow.ai/media-kit', target: '_blank', rel: 'noopener' }, 'wisprflow.ai/media-kit ↗'), '.'),
      h('p.note', G.logo.note),
      h('div.gos-grid.gos-grid--2', { style: { marginTop: '6px' } }, gboxW('Do', ul(G.logo.rules)), gboxW('Don’t', ul(G.logo.donts)))];
  }

  function colour() {
    const total = G.colours.reduce((a, c) => a + (c.mix || 0), 0) || 1;
    return [
      h('ul.gb-sw', G.colours.map((c) => {
        const onVast = contrast(c.hex, '#1a1a1a'), onLumen = contrast(c.hex, '#ffffeb');
        const ink = onVast >= onLumen ? '#1a1a1a' : '#ffffeb';
        const best = Math.max(onVast, onLumen);
        const b = h('button.gb-sw__chip', { type: 'button', style: { background: c.hex, color: ink }, 'aria-label': `Copy ${c.n} ${c.hex}`, onclick: () => copyText(c.hex.toUpperCase(), b) },
          h('span.gb-sw__hex', c.hex.toUpperCase()), h('span.gb-sw__copied', 'Copied'));
        return h('li.gb-sw__item', b,
          h('p.gb-sw__n', c.n), h('p.gb-sw__role', c.role),
          h('p.gb-sw__ratio', `Text in ${ink === '#1a1a1a' ? 'Vast' : 'Lumen'} on it: ${best.toFixed(1)}:1 `, tag(best >= 4.5 ? 'AA text' : best >= 3 ? 'Large text only' : 'Decoration only', best >= 4.5 ? 'real' : best >= 3 ? 'sample' : 'warn')));
      })),
      gboxW('Rough mix on a page',
        h('div.gb-mix', { role: 'img', 'aria-label': 'Rough colour mix: ' + G.colours.map((c) => `${c.n} ${c.mix}%`).join(', ') },
          G.colours.map((c) => h('span', { style: { flexGrow: String(c.mix || 0.5), background: c.hex }, title: `${c.n} · about ${Math.round((c.mix / total) * 100)}%` }))),
        h('p.note', G.colourNote)),
    ];
  }

  function type() {
    const st = store('brand-guide', { line: '', size: 1, italic: true });
    const inp = h('input.field', { value: st.v.line || G.type[0].sample, 'aria-label': 'Your own line to set in type', oninput: () => { st.v.line = inp.value; st.save(); draw(); } });
    const size = h('input', { type: 'range', min: 0.6, max: 1.4, step: 0.05, value: st.v.size, 'aria-label': 'Specimen size', oninput: () => { st.v.size = +size.value; st.save(); draw(); } });
    const it = h('input', { type: 'checkbox', checked: st.v.italic, onchange: () => { st.v.italic = it.checked; st.save(); draw(); } });
    const out = h('div');
    const serifLine = (t) => {
      if (!st.v.italic) return t;
      const known = G.type[0].italic && t.endsWith(G.type[0].italic) ? G.type[0].italic : null;
      const tail = known || (t.match(/(?:\S+\s+)?\S+\s*$/) || [''])[0];
      return [t.slice(0, t.length - tail.length), h('em', tail)];
    };
    const draw = () => {
      const t = inp.value.trim() || G.type[0].sample;
      out.replaceChildren(...G.type.map((f, k) => h('section.gb-spec',
        h('div.gb-spec__head', h('p.gb-spec__name', { style: { fontFamily: f.family } }, f.font), h('p.gb-spec__role', rich(f.role))),
        f.sizes.map((px, j) => h('p.gb-spec__line', { style: { fontFamily: f.family, fontSize: Math.round(px * st.v.size) + 'px', fontWeight: k === 1 && j === 2 ? '600' : '400', letterSpacing: k === 1 && j === 2 ? '.12em' : null, textTransform: k === 1 && j === 2 ? 'uppercase' : null } },
          h('span.gb-spec__px', `${px}px${k === 1 && j === 2 ? ' · 600 caps' : ''}`), k === 0 ? serifLine(t) : (j === 0 ? f.sample : t))),
        h('p.gb-spec__abc', { style: { fontFamily: f.family } }, 'Aa Bb Cc Gg Qq Rr 0123456789 ₹ & ? —'))));
    };
    draw();
    return [h('div.bar', inp, h('label.gb-ctl', 'Size', size), h('label.gb-ctl', it, 'Italic last phrase')), out, gbox('Type habits', ul(G.typeRules))];
  }

  function voice() {
    const V = G.voice;
    return [h('div.gos-grid.gos-grid--2', V.principles.map((p) => h('div.card', h('p.card__t', p.t), h('p.card__p', rich(p.p))))),
      gbox('How Wispr actually says it', h('div.gb-quotes', V.lines.map((l) => h('blockquote.quote', l.q, h('cite', rich(l.why))))))];
  }

  function rewriter() {
    const R = G.rewriter;
    const st = store('brand-guide-rw', { text: '' });
    const ta = h('textarea.field.field--area', { rows: 5, 'aria-label': 'Paste a line to check', oninput: () => { st.v.text = ta.value; st.save(); run(); } }, st.v.text || R.sample);
    const marked = h('div.post.gb-marked', { 'aria-live': 'polite' });
    const flags = h('ul.lint');
    const out = h('div.post');
    const count = h('p.gb-rw__count');
    const run = () => {
      const text = ta.value;
      const { marks, long, out: sug } = analyse(text, R);
      let at = 0;
      const frag = [];
      marks.forEach((x) => { frag.push(text.slice(at, x.i), h('mark.gb-mark.gb-mark--' + x.kind, { title: R.flags[x.kind] + (x.say ? ` Try: “${plain(x.say)}”` : '') }, x.word)); at = x.j; });
      frag.push(text.slice(at));
      marked.replaceChildren(...frag);
      const groups = {};
      marks.forEach((x) => (groups[x.kind] ||= []).push(x));
      const items = Object.entries(groups).map(([k, xs]) => h('li.is-bad', h('span', h('b', R.flags[k]), ' ', [...new Set(xs.map((x) => (x.kind === 'jargon' && x.say ? `${x.word} → ${plain(x.say)}` : x.word)))].filter((w) => w !== '!' || k === 'bang').slice(0, 8).join(' · '))));
      long.forEach((l) => items.push(h('li.is-bad', h('span', h('b', R.flags.long), ` ${l.n} words: “${l.s.slice(0, 70)}${l.s.length > 70 ? '…' : ''}”`))));
      const n = marks.length + long.length;
      count.replaceChildren(h('span.gb-rw__n', String(n)), n === 1 ? ' flag' : ' flags', n ? '' : ' · ' + R.flags.ok);
      flags.replaceChildren(...(items.length ? items : [h('li', R.flags.ok)]));
      out.textContent = sug || '…';
    };
    run();
    return [h('p.small.gb-rw__how', R.how), ta,
      h('div.row', h('button.btn.btn--sm', { type: 'button', onclick: () => { ta.value = R.sample; st.v.text = ''; st.save(); run(); } }, 'Try the bad example'), h('button.btn.btn--sm', { type: 'button', onclick: () => { ta.value = ''; st.v.text = ''; st.save(); run(); ta.focus(); } }, 'Clear')),
      h('div.gos-grid.gos-grid--2', { style: { marginTop: '14px' } },
        gboxW('What it flagged', count, marked, flags),
        gboxW('A plainer start', out, h('div.row', copyBtn(() => out.textContent, 'Copy')), h('p.note', 'A starting point, not the answer. Long sentences need you to split them; it won’t guess where.')))];
  }

  function india() {
    const I = G.india;
    return [h('p.lede', rich(I.intro)),
      gboxW('Hinglish', ul(I.hinglish)),
      gbox('Festivals and seasons', h('div.tbl-wrap', h('table.tbl.tbl--stack', h('thead', h('tr', ['Moment', 'When', 'Do', 'Avoid'].map((t) => h('th', t)))),
        h('tbody', I.festivals.map((f) => h('tr', h('td.tbl__name', f.t), h('td', { 'data-k': 'When' }, rich(f.when)), h('td.tbl__wide', rich(f.do)), h('td.tbl__wide.muted', rich(f.avoid)))))))),
      gboxW('What to avoid in India', ul(I.avoid))];
  }

  function pairs() {
    return [h('p.small', 'The “don’t” side stays a description on purpose.'),
      ...G.pairs.map((p) => gbox(p.t, h('div.gb-pair',
        h('figure.gb-pair__side', h('span.gb-pair__k.is-do', 'Do'), art(p.do.art, p.do.alt, { ratio: '4/3' }), h('figcaption', rich(p.do.p))),
        h('figure.gb-pair__side.is-dont', h('span.gb-pair__k.is-dont', 'Don’t'), art(p.dont.art, p.dont.alt, { ratio: '4/3' }), h('figcaption', rich(p.dont.p))))))];
  }
}

// ================================================================ 2. moodboards
function moodboards(m) {
  const M = B().moodboards;
  if (!M?.boards?.length) return missing(m);
  const st = store('brand-moodboards', { pinned: null, notes: {}, open: null });
  const picker = h('div.gos-grid.mb-pick');
  const detail = h('div');
  let cur = M.boards.find((b) => b.id === st.v.open) || M.boards.find((b) => b.id === st.v.pinned) || M.boards[0];
  const summary = (b) => [
    `Moodboard: ${b.name}${st.v.pinned === b.id ? ' (current direction)' : ''}`, plain(b.line), '',
    `Palette: ${b.palette.map(([n, x]) => `${n} ${x}`).join(', ')}`,
    `Type: ${b.type.head} / ${b.type.body}. ${b.type.note}`,
    'Look at:', ...b.refs.map((r) => '- ' + plain(r)),
    `Use it for: ${b.use.join(', ')}`, `Avoid: ${plain(b.avoid)}`,
    st.v.notes[b.id] ? `\nTeam notes: ${st.v.notes[b.id]}` : '',
  ].join('\n').trim();
  const drawPicker = () => picker.replaceChildren(...M.boards.map((b) => h('button.card.mb-card', { type: 'button', 'aria-pressed': String(b.id === cur.id), onclick: () => { cur = b; st.v.open = b.id; st.save(); drawPicker(); show(); sound.tick('pick'); } },
    h('span.mb-dots', b.palette.map(([n, x]) => h('i', { style: { background: x }, title: n }))),
    h('div.card__top', h('p.card__t', b.name)),
    h('p.card__p', rich(b.line)),
    st.v.pinned === b.id ? h('p.card__meta', tag('Current direction', 'approved')) : null)));
  function show() {
    const b = cur;
    const pinned = st.v.pinned === b.id;
    const notes = h('textarea.field.field--area', { rows: 3, 'aria-label': 'Team notes on ' + b.name, placeholder: 'What the team thinks. What to change. Who’s shooting it.', oninput: () => { st.v.notes[b.id] = notes.value; st.save(); } }, st.v.notes[b.id] || '');
    swap(detail, h('section.mb',
      h('div.mb__head',
        h('div', h('h3.mb__t', b.name), h('p.mb__line', rich(b.line))),
        h('div.row', { style: { marginTop: 0 } },
          h('button.btn.btn--sm' + (pinned ? '.btn--primary' : ''), { type: 'button', 'aria-pressed': String(pinned), onclick: () => { st.v.pinned = pinned ? null : b.id; st.save(); drawPicker(); show(); sound.tick('pick'); } }, pinned ? 'Pinned as current direction' : 'Pin as current direction'),
          copyBtn(() => summary(b), 'Copy summary'))),
      h('div.mb__body',
        h('div.mb__grid', b.tiles.map((t) => h('div.mb__tile', art(t.art, t.alt, { ratio: t.ratio || '4/3' })))),
        h('aside.mb__side',
          h('div.mb__block', h('p.mb__k', 'Palette'), h('div.mb__pal', b.palette.map(([n, x]) => { const c = h('button.mb__chip', { type: 'button', 'aria-label': `Copy ${n} ${x}`, onclick: () => copyText(x.toUpperCase(), c) }, h('i', { style: { background: x } }), h('span', n, h('small', x.toUpperCase())), h('span.gb-sw__copied', 'Copied')); return c; }))),
          h('div.mb__block', h('p.mb__k', 'Type'), h('p.mb__spec', b.name.split(' ').slice(0, -1).join(' ') + ' ', h('em', b.name.split(' ').slice(-1)[0] + '.')), h('p.mb__body2', `${b.type.head} · ${b.type.body}. ${b.type.note}`)),
          h('div.mb__block', h('p.mb__k', 'Look at (study, don’t copy)'), h('ol.ul', b.refs.map((r) => h('li', rich(r))))),
          h('div.mb__block', h('p.mb__k', 'Use it for'), h('div.tags', b.use.map((u) => tag(u, 'real')))),
          h('div.mb__block', h('p.mb__k', 'Avoid'), h('p.mb__body2', rich(b.avoid))))),
      gboxW('Team notes', notes, h('p.note', 'Saved on this device. Copy the summary to share it.')),
      b.so && gbox('Second-order', secondOrder(b.so))));
  }
  drawPicker(); show();
  return [head(m, M.why), picker, detail,
    h('p.note', 'Tiles are art placeholders; the important ones are being made. References link to the public work; they’re for mood, not to lift.')];
}

// ================================================================ 3. social performance
const METRIC_KEYS = ['followers', 'reach', 'views', 'eng', 'clicks', 'posts'];
function social(m) {
  const S = B().social;
  if (!S?.channels) return missing(m);
  const st = store('brand-social', { mode: 'sample', rows: [], metric: 'reach', channel: 'all' });
  const body = h('div');
  const sampleRows = () => S.sample.weeks.flatMap((wk, i) => S.channels.map((c) => { const d = S.sample[c.id] || {}; return { wk, ch: c.id, ...Object.fromEntries(METRIC_KEYS.map((k) => [k, d[k]?.[i] ?? null])) }; }));
  const rowsNow = () => (st.v.mode === 'sample' ? sampleRows() : st.v.rows);
  const val = (r, k) => {
    if (!r) return null;
    if (k === 'er') return r.reach ? r.eng / r.reach : null;
    if (k === 'ctr') return r.reach ? r.clicks / r.reach : null;
    const v = r[k]; return v === '' || v == null ? null : +v;
  };
  const fmtK = (k, v) => (k === 'er' || k === 'ctr' ? pct(v) : nf(v));
  const metricOpts = [...S.metrics.filter((x) => x.id !== 'posts').map((x) => [x.id, x.t]), ['er', 'Engagement rate'], ['ctr', 'Click rate']];
  const csvOf = (rows) => csv([['week', 'channel', ...METRIC_KEYS, 'note'], ...rows.map((r) => [r.wk, r.ch, ...METRIC_KEYS.map((k) => r[k] ?? ''), r.note || ''])]);

  const modeBtns = h('div.gtabs.gs-mode', { role: 'tablist' }, [['sample', 'Sample'], ['ours', 'Our numbers']].map(([v, t]) => h('button.gtab', { type: 'button', role: 'tab', 'aria-selected': String(st.v.mode === v), onclick: (e) => { st.v.mode = v; st.save(); modeBtns.querySelectorAll('.gtab').forEach((b) => b.setAttribute('aria-selected', String(b === e.currentTarget))); draw(); sound.tick('click'); } }, t)));

  function draw() {
    const isS = st.v.mode === 'sample';
    const rows = rowsNow();
    const weeks = [...new Set(rows.map((r) => r.wk))].sort();
    const get = (ch, wk) => rows.find((r) => r.ch === ch && r.wk === wk);
    const chans = S.channels.filter((c) => st.v.channel === 'all' || c.id === st.v.channel);
    const tagS = () => (isS ? sample() : null);
    const out = [];
    out.push(isS ? h('p.gs-banner', { role: 'note' }, h('b', 'Sample data. '), S.sampleBanner) : h('p.gs-banner.is-ours', 'Our numbers: typed in by the team, from each platform’s insights. Stored on this device; export the CSV to share.'));
    if (!rows.length) {
      out.push(h('div.empty', S.emptyOurs));
    } else {
      const last = weeks[weeks.length - 1], prev = weeks[weeks.length - 2];
      out.push(h('p.gs-asof', `Week of ${fmtD(last)}`, isS ? [' ', sample()] : null));
      out.push(h('div.gs-tiles', S.channels.map((c) => {
        const r = get(c.id, last), p = prev ? get(c.id, prev) : null;
        const fol = val(r, 'followers'), dF = fol != null && val(p, 'followers') != null ? fol - val(p, 'followers') : null;
        return h('div.kpi.gs-tile', { style: { '--c': c.c } },
          h('span.kpi__k', c.name, ' ', tagS()),
          h('span.kpi__v', fmtK('reach', val(r, 'reach'))), h('span.kpi__d', 'reach'),
          h('dl.gs-tile__dl',
            h('dt', 'Followers'), h('dd', nf(fol), dF != null ? h('span' + (dF < 0 ? '.is-overdue' : '.gs-up'), ` ${dF >= 0 ? '+' : '−'}${nf(Math.abs(dF))}`) : null),
            h('dt', 'Engagement rate'), h('dd', pct(val(r, 'er'))),
            h('dt', 'Link clicks'), h('dd', nf(val(r, 'clicks')))));
      })));
      // controls + charts
      const k = st.v.metric;
      out.push(h('div.bar.gs-ctl',
        select(k, metricOpts, (v) => { st.v.metric = v; st.save(); draw(); }, 'Metric'),
        select(st.v.channel, [['all', 'All channels'], ...S.channels.map((c) => [c.id, c.name])], (v) => { st.v.channel = v; st.save(); draw(); }, 'Channel'),
        h('span.gs-legend', chans.map((c) => h('span', h('i', { style: { background: c.c } }), c.name)))));
      const lines = chans.map((c) => ({ name: c.name, c: c.c, vals: weeks.map((w) => val(get(c.id, w), k)) }));
      const mName = metricOpts.find((x) => x[0] === k)?.[1] || k;
      out.push(h('div.gos-grid.gs-charts',
        gboxW(`${mName} by week`, tagS(), lineChart(weeks, lines, (v) => fmtK(k, v), mName)),
        gboxW(`${mName}, week of ${fmtD(last)}`, tagS(), h('div.gs-bars', S.channels.map((c) => { const v = val(get(c.id, last), k); const mx = Math.max(...S.channels.map((x) => val(get(x.id, last), k) || 0)) || 1; return h('div.gs-bars__row', h('span', c.name), h('span.gs-bars__track', h('i', { style: { width: ((v || 0) / mx) * 100 + '%', background: c.c } })), h('span.gs-bars__v', fmtK(k, v))); })))));
      // table
      const tb = h('tbody', [...rows].sort((a, b) => b.wk.localeCompare(a.wk) || a.ch.localeCompare(b.ch)).map((r) => h('tr',
        h('td.tbl__name', fmtD(r.wk), h('span.tbl__sub', S.channels.find((c) => c.id === r.ch)?.name || r.ch), isS ? sample() : null),
        ...['followers', 'reach', 'views', 'eng', 'clicks', 'posts'].map((kk) => h('td.num', { 'data-k': S.metrics.find((x) => x.id === kk)?.t }, nf(val(r, kk)))),
        h('td.num', { 'data-k': 'Eng. rate' }, pct(val(r, 'er'))),
        h('td', isS ? null : h('button.btn.btn--sm', { type: 'button', 'aria-label': 'Remove this week', onclick: () => { st.v.rows = st.v.rows.filter((x) => x !== r); st.save(); draw(); } }, 'Remove')))));
      out.push(h('div.tbl-wrap.gs-tbl', { style: { marginTop: '16px', maxHeight: '360px' } }, h('table.tbl.tbl--stack', h('thead', h('tr', ['Week', 'Followers', 'Reach', 'Views', 'Engagements', 'Clicks', 'Posts', 'Eng. rate', ''].map((t) => h('th', t)))), tb)));
    }
    out.push(form());
    swap(body, out);
  }

  function form() {
    const lastMon = addDays(mondayOf(TODAY), -7);
    const num = (name, label) => h('label', label, h('input.field', { type: 'number', name, min: 0, step: 1, inputmode: 'numeric' }));
    const f = h('form.form',
      h('label', 'Week starting (Monday)', h('input.field', { type: 'date', name: 'wk', required: true, value: lastMon })),
      h('label', 'Channel', select(S.channels[0].id, S.channels.map((c) => [c.id, c.name]), () => {}, 'Channel')),
      ...S.metrics.map((x) => num(x.id, x.t)),
      h('label.full', 'Note (anything odd this week)', h('input.field', { name: 'note', placeholder: 'e.g. Instagram changed how it counts views' })),
      h('div.form__row', h('button.btn.btn--primary', { type: 'submit' }, 'Save the week')));
    f.querySelector('select').name = 'ch';
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      const r = { wk: mondayOf(d.wk), ch: d.ch, note: d.note || '' };
      METRIC_KEYS.forEach((k) => { r[k] = d[k] === '' ? null : Math.max(0, +d[k]); });
      st.v.rows = [...st.v.rows.filter((x) => !(x.wk === r.wk && x.ch === r.ch)), r];
      st.v.mode = 'ours'; st.save();
      modeBtns.querySelectorAll('.gtab').forEach((b, i) => b.setAttribute('aria-selected', String(i === 1)));
      sound.tick('pick'); draw();
    });
    return gboxW('Add a week', h('p.small', 'One channel at a time. Saving the same week and channel again replaces it. It switches you to “Our numbers”.'), f);
  }

  draw();
  return [head(m, S.why, modeBtns, h('button.btn.btn--sm', { type: 'button', onclick: () => (st.v.rows.length ? download('wispr-india-social.csv', csvOf(st.v.rows)) : alert('No weeks of our own yet. Add one first.')) }, 'Export our CSV')),
    body,
    gbox('What each number means', h('div.tbl-wrap', h('table.tbl.tbl--stack', h('thead', h('tr', ['Metric', 'What it means', 'Where to find it'].map((t) => h('th', t)))),
      h('tbody', [...S.metrics.map((x) => h('tr', h('td.tbl__name', x.t), h('td.tbl__wide', rich(x.def)), h('td.tbl__wide.muted', rich(x.where)))),
        ...S.derived.map((x) => h('tr', h('td.tbl__name', x.t, h('span.tbl__sub', 'worked out')), h('td.tbl__wide', rich(x.def)), h('td.tbl__wide.muted', 'Calculated here')))])))),
    gboxW('Benchmarks', h('p', rich(S.noBench))),
    gbox('How we fill it', ul(S.rules))];
}

function lineChart(weeks, lines, fmt, label) {
  const all = lines.flatMap((l) => l.vals).filter((v) => v != null);
  if (!all.length) return h('div.empty', 'Nothing to draw for this metric yet.');
  const W = 640, H = 250, P = { l: 58, r: 14, t: 14, b: 30 };
  const max = Math.max(...all) * 1.1 || 1;
  const x = (i) => P.l + (weeks.length < 2 ? (W - P.l - P.r) / 2 : (i * (W - P.l - P.r)) / (weeks.length - 1));
  const y = (v) => H - P.b - (v / max) * (H - P.t - P.b);
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => sv('g', {}, sv('line', { x1: P.l, x2: W - P.r, y1: y(max * f), y2: y(max * f), class: 'gs-chart__grid' }), sv('text', { x: P.l - 8, y: y(max * f) + 4, 'text-anchor': 'end', class: 'gs-chart__t' }, fmt(max * f))));
  const step = Math.ceil(weeks.length / 6);
  const xl = weeks.map((w, i) => (i % step === 0 || i === weeks.length - 1 ? sv('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', class: 'gs-chart__t' }, fmtD(w)) : null));
  const paths = lines.map((l) => {
    let d = '', pen = false;
    l.vals.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true; });
    return sv('g', {}, sv('path', { d, fill: 'none', style: `stroke:${l.c}`, class: 'gs-chart__line' }),
      l.vals.map((v, i) => (v == null ? null : sv('circle', { cx: x(i), cy: y(v), r: 3.5, style: `fill:${l.c}`, class: 'gs-chart__dot' }, sv('title', {}, `${l.name}, ${fmtD(weeks[i])}: ${fmt(v)}`)))));
  });
  return sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'gs-chart', role: 'img', 'aria-label': `${label} by week, ${lines.map((l) => l.name).join(', ')}` }, grid, xl, paths);
}

// ================================================================ 4. LinkedIn calendar
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function lcStore() { return store('brand-lincal', { posts: null, month: null, pillar: 'all', who: 'all', open: null }); }
function lincal(m, { go }) {
  const L = B().lincal;
  if (!L?.seed) return missing(m);
  const st = lcStore();
  let posts = st.v.posts ? st.v.posts : clone(L.seed);
  const commit = () => { st.v.posts = posts; st.save(); };
  if (!st.v.month) st.v.month = TODAY.slice(0, 7) >= L.months[0] && TODAY.slice(0, 7) <= L.months[L.months.length - 1] ? TODAY.slice(0, 7) : L.months[0];
  const pil = (id) => L.pillars.find((p) => p.id === id) || L.pillars[0];
  const who = (id) => L.people.find((p) => p.id === id) || { name: id || 'Someone', role: '' };
  const cal = h('div');
  const editor = h('div');
  const shown = () => posts.filter((p) => (st.v.pillar === 'all' || p.pillar === st.v.pillar) && (st.v.who === 'all' || p.who === st.v.who));
  const initials = (n) => String(n).split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const move = (id, d) => { const p = posts.find((x) => x.id === id); if (!p || !d) return; p.d = d; commit(); st.v.month = d.slice(0, 7); st.save(); draw(); if (st.v.open === id) edit(p); sound.tick('pick'); };

  const chip = (p) => {
    const b = h('button.lc-post.is-' + p.status, { type: 'button', draggable: 'true', style: { '--c': pil(p.pillar).c }, title: `${p.title} · ${who(p.who).name} · ${p.status}`, 'aria-label': `${p.title}, ${who(p.who).name}, ${p.status}. Open to edit.`, onclick: () => edit(p) },
      h('span.lc-post__who', initials(who(p.who).name)), h('span.lc-post__t', p.title), h('span.lc-post__st', p.status));
    b.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; b.classList.add('is-drag'); });
    b.addEventListener('dragend', () => b.classList.remove('is-drag'));
    return b;
  };

  function draw() {
    const [Y, M] = st.v.month.split('-').map(Number);
    const first = new Date(Y, M - 1, 1);
    const start = addDays(iso(first), -((first.getDay() + 6) % 7));
    const daysIn = new Date(Y, M, 0).getDate();
    const cells = Math.ceil((((first.getDay() + 6) % 7) + daysIn) / 7) * 7;
    const list = shown();
    const grid = h('div.lc-grid', { role: 'grid', 'aria-label': 'Posts by day' },
      DOW.map((d) => h('div.lc-dow', d)),
      Array.from({ length: cells }, (_, i) => {
        const d = addDays(start, i);
        const inM = d.slice(0, 7) === st.v.month;
        const cell = h('div.lc-day' + (inM ? '' : '.is-out') + (d === TODAY ? '.is-today' : ''), { role: 'gridcell', dataset: { d } },
          h('div.lc-day__top', h('span.lc-day__n', String(+d.slice(8))), h('button.lc-add', { type: 'button', 'aria-label': 'New post on ' + fmtD(d), onclick: () => add(d) }, '+')),
          list.filter((p) => p.d === d).map(chip));
        cell.addEventListener('dragover', (e) => { e.preventDefault(); cell.classList.add('is-over'); });
        cell.addEventListener('dragleave', () => cell.classList.remove('is-over'));
        cell.addEventListener('drop', (e) => { e.preventDefault(); cell.classList.remove('is-over'); move(e.dataTransfer.getData('text/plain'), d); });
        return cell;
      }));
    const monthPosts = list.filter((p) => p.d.slice(0, 7) === st.v.month).sort((a, b) => a.d.localeCompare(b.d));
    const agenda = h('div.lc-agenda', monthPosts.length ? monthPosts.map((p) => h('div.lc-agenda__row', h('span.lc-agenda__d', fmtD(p.d), h('small', DOW[(new Date(p.d + 'T00:00:00').getDay() + 6) % 7])), chip(p))) : h('div.empty', 'Nothing planned this month. Tap “+ New post”.'));
    const counts = L.statuses.map((s) => [s, posts.filter((p) => p.status === s).length]);
    swap(cal,
      h('div.bar.lc-bar',
        h('div.lc-nav', h('button.btn.btn--sm', { type: 'button', 'aria-label': 'Previous month', onclick: () => shift(-1) }, '‹'),
          h('span.lc-month', first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })),
          h('button.btn.btn--sm', { type: 'button', 'aria-label': 'Next month', onclick: () => shift(1) }, '›')),
        select(st.v.pillar, [['all', 'All pillars'], ...L.pillars.map((p) => [p.id, p.t])], (v) => { st.v.pillar = v; st.save(); draw(); }, 'Pillar'),
        select(st.v.who, [['all', 'Everyone'], ...L.people.map((p) => [p.id, p.name])], (v) => { st.v.who = v; st.save(); draw(); }, 'Who'),
        h('span.lc-counts', counts.map(([s, n]) => h('span', tag(s, s === 'posted' ? 'done' : s === 'approved' ? 'approved' : s === 'drafted' ? 'live' : 'idea'), ' ', String(n))))),
      h('div.lc-legend', L.pillars.map((p) => h('span', { title: plain(p.p) }, h('i', { style: { background: p.c } }), p.t))),
      grid, agenda,
      h('p.note', 'Drag a post to another day, or open it and change the date. ', L.note));
  }
  const shift = (n) => { const [Y, M] = st.v.month.split('-').map(Number); const d = new Date(Y, M - 1 + n, 1); st.v.month = iso(d).slice(0, 7); st.save(); draw(); };
  function add(d) {
    const p = { id: uid('p'), d: d || (st.v.month === TODAY.slice(0, 7) ? TODAY : st.v.month + '-01'), who: 'company', pillar: st.v.pillar !== 'all' ? st.v.pillar : 'build', status: 'idea', title: 'New post', text: '' };
    posts.push(p); commit(); draw(); edit(p, true);
  }
  function edit(p, focusTitle) {
    st.v.open = p.id; st.save();
    const save = () => { commit(); draw(); };
    const count = h('span.lc-count');
    const recount = () => { const t = text.value; count.textContent = `${t.trim() ? t.trim().split(/\s+/).length : 0} words · ${t.length} characters`; };
    const title = h('input.field', { value: p.title, 'aria-label': 'Post title', oninput: () => { p.title = title.value || 'Untitled'; save(); } });
    const text = h('textarea.field.field--area', { rows: 8, 'aria-label': 'Post text', placeholder: 'Dictate it first. Then trim.', oninput: () => { p.text = text.value; commit(); recount(); } }, p.text || '');
    const date = h('input.field', { type: 'date', value: p.d, 'aria-label': 'Post date', onchange: () => move(p.id, date.value) });
    recount();
    swap(editor, h('article.brief.lc-ed', { style: { '--c': pil(p.pillar).c } },
      h('div.brief__head',
        h('div', h('h3.brief__t', p.title), h('p.brief__dates', `${fmtD(p.d)} · ${who(p.who).name}${who(p.who).role ? ' (' + who(p.who).role + ')' : ''} · ${pil(p.pillar).t}`)),
        h('div.row', { style: { marginTop: 0 } }, h('button.btn.btn--sm', { type: 'button', onclick: () => { st.v.open = null; st.save(); editor.replaceChildren(); } }, 'Close'))),
      h('div.form.lc-form',
        h('label.full', 'Title (for us, not posted)', title),
        h('label', 'Who posts it', select(p.who, L.people.map((x) => [x.id, x.name + (x.role ? ' · ' + x.role : '')]), (v) => { p.who = v; save(); edit(p); }, 'Who')),
        h('label', 'Pillar', select(p.pillar, L.pillars.map((x) => [x.id, x.t]), (v) => { p.pillar = v; save(); edit(p); }, 'Pillar')),
        h('label', 'Status', select(p.status, L.statuses.map((s) => [s, s[0].toUpperCase() + s.slice(1)]), (v) => { p.status = v; save(); edit(p); }, 'Status')),
        h('label', 'Date', h('div.lc-date', h('button.btn.btn--sm', { type: 'button', 'aria-label': 'One day earlier', onclick: () => move(p.id, addDays(p.d, -1)) }, '−1'), date, h('button.btn.btn--sm', { type: 'button', 'aria-label': 'One day later', onclick: () => move(p.id, addDays(p.d, 1)) }, '+1'))),
        h('label.full', 'Post text', text, count)),
      h('div.row',
        copyBtn(() => text.value, 'Copy text'),
        h('button.btn.btn--sm.btn--primary', { type: 'button', onclick: async () => { await copyText(text.value); go('linkedin'); } }, 'Copy and open the LinkedIn linter →'),
        h('button.btn.btn--sm', { type: 'button', onclick: () => { if (!confirm('Delete this post idea?')) return; posts = posts.filter((x) => x.id !== p.id); commit(); st.v.open = null; st.save(); editor.replaceChildren(); draw(); } }, 'Delete')),
      h('p.note', 'The linter is in LinkedIn & founders → Dictate a post. Paste the text there.'),
      gbox('Pillar', h('p', rich(pil(p.pillar).p)))));
    if (focusTitle) setTimeout(() => { title.select(); editor.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 40);
  }
  const csvOut = () => csv([['date', 'who', 'role', 'pillar', 'status', 'title', 'text'], ...[...posts].sort((a, b) => a.d.localeCompare(b.d)).map((p) => [p.d, who(p.who).name, who(p.who).role, pil(p.pillar).t, p.status, p.title, p.text])]);
  draw();
  const open = posts.find((p) => p.id === st.v.open);
  if (open) edit(open);
  return [head(m, L.why,
    h('button.btn.btn--sm.btn--primary', { type: 'button', onclick: () => add() }, '+ New post'),
    h('button.btn.btn--sm', { type: 'button', onclick: () => download('wispr-linkedin-calendar.csv', csvOut()) }, 'Export CSV'),
    h('button.btn.btn--sm', { type: 'button', onclick: () => { if (confirm('Put the calendar back to the starting ideas? Your edits here go.')) { posts = clone(L.seed); commit(); st.v.open = null; st.save(); editor.replaceChildren(); draw(); } } }, 'Reset')),
  cal, editor,
  h('div.gos-grid.gos-grid--2', { style: { marginTop: '6px' } },
    gboxW('Who posts', h('ul.ul', L.people.map((p) => h('li', h('b', p.name), ' · ', p.role, p.url ? [' · ', h('a', { href: p.url, target: '_blank', rel: 'noopener' }, 'public profile')] : null, ' ', rich(p.src))))),
    gbox('Rules', ul(L.rules)))];
}

// ================================================================ 5. contests & giveaways
function contests(m) {
  const C = B().contests;
  if (!C?.mechanics?.length) return missing(m);
  const st = store('brand-contests', { pick: null, checks: {}, entries: {}, gen: {} });
  let cur = C.mechanics.find((x) => x.id === st.v.pick) || C.mechanics[0];
  const picker = h('div.gos-grid');
  const detail = h('div');
  const drawPicker = () => picker.replaceChildren(...C.mechanics.map((c) => {
    const n = (st.v.entries[c.id] || []).length;
    return h('button.card', { type: 'button', 'aria-pressed': String(c.id === cur.id), style: { '--c': 'var(--signal)' }, onclick: () => { cur = c; st.v.pick = c.id; st.save(); drawPicker(); show(); sound.tick('pick'); } },
      h('div.card__top', h('p.card__t', c.name)), h('p.card__p', rich(c.one)), h('p.card__meta', h('span', c.channel), h('span', n ? `${n} entr${n === 1 ? 'y' : 'ies'}` : 'No entries yet')));
  }));
  function show() {
    const c = cur;
    swap(detail, h('article.brief', { style: { '--c': 'var(--signal)' } },
      h('div.brief__head', h('div', h('h3.brief__t', c.name), h('p.brief__dates', `${c.channel} · ${c.hashtag}`)), tag('Check with legal', 'warn')),
      h('p.lede.ct-one', rich(c.one))),
    tabs(['The mechanic', 'Legal checklist', 'Rules text', 'Entries'], (i) => [mech, legal, rules, entries][i](c), 0));
  }
  function mech(c) {
    const total = c.judging.reduce((a, [, w]) => a + w, 0) || 1;
    return [h('div.gos-grid.gos-grid--2',
      gboxW('How to enter', h('ol.ul', c.how.map((t) => h('li', rich(t))))),
      gboxW('Who can enter', ul(c.eligibility))),
    gboxW('Prize', h('p', rich(c.prize)), h('p.note', 'Prize values get set with finance; none are promised here.')),
    gboxW('Judging', h('div.ct-judge', c.judging.map(([t, w]) => h('div.ct-judge__row', h('span', t), h('span.meter__bar', h('i', { style: { width: (w / total) * 100 + '%' } })), h('span.ct-judge__w', w + '%')))), h('p.note', 'Weights are ours to set; written down before launch so judging is about skill.')),
    gboxW('Timeline', h('ol.ct-tl', c.timeline.map(([w, t]) => h('li', h('b', w), h('span', rich(t)))))),
    gbox('Second-order', secondOrder(c.so))];
  }
  function legal(c) {
    const done = (st.v.checks[c.id] ||= {});
    return [h('p.gs-banner.is-legal', h('b', 'Not legal advice. '), C.disclaimer),
      gboxW('For this contest', h('ul.check', c.legal.map((t, i) => h('li', h('label', h('input', { type: 'checkbox', checked: !!done[i], onchange: (e) => { done[i] = e.target.checked; st.save(); } }), h('span', rich(t))))))),
      gbox('For every contest in India', h('div.gos-grid.gos-grid--2', C.common.map((x) => h('div.card', h('div.card__top', h('p.card__t', x.t), tag('Check with legal', 'warn')), h('p.card__p', rich(x.p))))))];
  }
  function rules(c) {
    const g = (st.v.gen[c.id] ||= { org: 'Wispr Inc. (legal to confirm the entity)', start: '', end: '', age: 18, excluded: '', prize: plain(c.prize), contact: 'https://wisprflow.ai', licence: 12, data: 'your name, handle, city and entry link', keep: 30 });
    const out = h('div.post.ct-rules');
    const field = (k, label, attrs = {}) => h('label' + (attrs.full ? '.full' : ''), label, h('input.field', { value: g[k] ?? '', ...attrs, full: null, oninput: (e) => { g[k] = e.target.value; st.save(); draw(); } }));
    const f = h('div.form',
      field('org', 'Organiser', { full: true }),
      field('start', 'Opens', { type: 'date' }), field('end', 'Closes', { type: 'date' }),
      field('age', 'Minimum age', { type: 'number', min: 18 }), field('excluded', 'Not open in (states, if legal says so)', { placeholder: 'Leave empty unless legal advises' }),
      field('prize', 'Prize', { full: true }),
      field('licence', 'We can share entries for (months)', { type: 'number', min: 0 }), field('keep', 'Delete entrant data after (days)', { type: 'number', min: 0 }),
      field('data', 'Data we collect', { full: true }), field('contact', 'Questions go to (public page)', { full: true }));
    const D8 = (s) => (s ? fmtD(s) + ' ' + s.slice(0, 4) : '[date]');
    const text = () => {
      const crit = c.judging.map(([t, w]) => `${t} (${w}%)`).join(', ');
      const ann = g.end ? D8(addDays(g.end, 7)) : '[a week after close]';
      return [
        `${c.name}: official rules`, 'DRAFT. Not reviewed by legal. Do not publish until legal signs off.', '',
        `1. Organiser. ${g.org} runs this contest. ${c.channel.split(/[+,]/)[0].trim()} doesn’t sponsor, endorse or run it.`,
        `2. Dates. Opens ${D8(g.start)} and closes ${D8(g.end)} at 11:59 pm IST. Late entries don’t count.`,
        `3. Who can enter. ${c.eligibility.map(plain).join('. ')}. Minimum age ${g.age || 18}.${g.excluded ? ` Not open to residents of ${g.excluded}.` : ''}`,
        `4. How to enter. ${c.how.map((t, i) => `(${i + 1}) ${plain(t)}`).join(' ')} Use ${c.hashtag}. Entry is free. No purchase or paid plan is needed.`,
        `5. Judging. A panel picks the winners on: ${crit}. Winners are chosen on these criteria, not by chance.`,
        `6. Prizes. ${g.prize} Prizes can’t be swapped for cash. Tax deducted at source applies where the law requires it, before the prize is handed over.`,
        `7. Winners. Announced by ${ann}. We contact winners on the platform they entered on. If a winner doesn’t reply within 7 days, the next entry in line wins.`,
        `8. Your entry. It must be your own work, and anyone shown in it must have agreed. You keep ownership. You let ${g.org.replace(/\s*\(.*\)/, '')} share it, with credit, on its own channels for ${g.licence || 0} months.`,
        `9. Your data. We collect only ${g.data}, only to run this contest, and delete it ${g.keep || 0} days after the winners are announced.`,
        '10. Disqualification. Abuse, slurs, fake or copied entries, entries about real people without their OK, or breaking the platform’s rules.',
        `11. Questions. ${g.contact}`,
      ].join('\n');
    };
    const draw = () => { out.textContent = text(); };
    draw();
    return [h('p.gs-banner.is-legal', h('b', 'Draft for legal. '), 'Fill the blanks, copy it, send it to legal. It says DRAFT at the top until they’ve signed it off.'),
      gboxW('Fill in', f), h('div.row', copyBtn(() => out.textContent, 'Copy rules'), h('button.btn.btn--sm', { type: 'button', onclick: () => download(`${c.id}-rules-draft.txt`, out.textContent, 'text/plain') }, 'Download .txt')), out];
  }
  function entries(c) {
    const list = (st.v.entries[c.id] ||= []);
    const body = h('tbody');
    const sum = h('span.small', { style: { margin: 0 } });
    const draw = () => {
      sum.textContent = `${list.length} entries · ${list.filter((e) => e.status === 'shortlisted').length} shortlisted · ${list.filter((e) => e.status === 'winner').length} winners`;
      body.replaceChildren(...(list.length ? [...list].sort((a, b) => (+b.score || 0) - (+a.score || 0)).map((e) => h('tr',
        h('td.tbl__name', e.who, h('span.tbl__sub', [e.city, e.date && fmtD(e.date)].filter(Boolean).join(' · '))),
        h('td', { 'data-k': 'Entry' }, /^https?:\/\//i.test(e.link || '') ? h('a', { href: e.link, target: '_blank', rel: 'noopener noreferrer' }, 'Open ↗') : (e.link || '—')),
        h('td', { 'data-k': 'Score' }, h('input.field.ct-score', { type: 'number', min: 0, max: 100, value: e.score ?? '', 'aria-label': 'Score for ' + e.who, onchange: (ev) => { e.score = ev.target.value; st.save(); draw(); } })),
        h('td', { 'data-k': 'Status' }, select(e.status, C.entryStatuses.map((s) => [s, s[0].toUpperCase() + s.slice(1)]), (v) => { e.status = v; st.save(); draw(); drawPicker(); }, 'Status for ' + e.who)),
        h('td.tbl__wide.muted', e.notes || ''),
        h('td', h('button.btn.btn--sm', { type: 'button', 'aria-label': 'Remove ' + e.who, onclick: () => { if (!confirm('Remove this entry?')) return; list.splice(list.indexOf(e), 1); st.save(); draw(); drawPicker(); } }, 'Remove')))) : [h('tr', h('td.muted', { colspan: 6 }, 'No entries yet. Add them as they come in, or after each day of the stall.'))]));
    };
    const f = h('form.form',
      h('label', 'Name or handle', h('input.field', { name: 'who', required: true, placeholder: '@handle' })),
      h('label', 'Link to the entry', h('input.field', { name: 'link', type: 'url', placeholder: 'https://instagram.com/…' })),
      h('label', 'City', h('input.field', { name: 'city' })),
      h('label', 'Entered on', h('input.field', { name: 'date', type: 'date', value: TODAY })),
      h('label.full', 'Notes', h('input.field', { name: 'notes', placeholder: 'Why it stood out. No phone numbers or emails here.' })),
      h('div.form__row', h('button.btn.btn--primary', { type: 'submit' }, 'Add entry')));
    f.addEventListener('submit', (e) => { e.preventDefault(); list.push({ id: uid('e'), status: 'received', score: '', ...Object.fromEntries(new FormData(f)) }); st.save(); f.reset(); f.querySelector('[name=date]').value = TODAY; draw(); drawPicker(); sound.tick('pick'); });
    draw();
    const exp = () => download(`${c.id}-entries.csv`, csv([['who', 'link', 'city', 'date', 'score', 'status', 'notes'], ...list.map((e) => [e.who, e.link, e.city, e.date, e.score, e.status, e.notes])]));
    return [h('div.bar', sum, h('button.btn.btn--sm', { type: 'button', onclick: exp }, 'Export CSV')),
      h('div.tbl-wrap', h('table.tbl.tbl--stack', h('thead', h('tr', ['Entrant', 'Entry', 'Score', 'Status', 'Notes', ''].map((t) => h('th', t)))), body)),
      gboxW('Add an entry', f),
      h('p.note', 'Stored on this device only. Keep it to what judging needs, and clear it once winners are announced.')];
  }
  drawPicker(); show();
  return [head(m, C.why), h('p.gs-banner.is-legal', h('b', 'Not legal advice. '), C.disclaimer), picker, detail];
}

// ================================================================ the modules
export const MODULES = [
  { id: 'guide', label: 'Brand guideline', c: 'var(--fathom)', group: 'Brand', kicker: 'Brand book, my read', render: guide },
  { id: 'moodboards', label: 'Moodboards', c: 'var(--dawn)', group: 'Brand', kicker: 'Directions for India', render: moodboards, count: () => B().moodboards?.boards?.length || 0 },
  { id: 'social', label: 'Social performance', c: 'var(--glow)', group: 'Brand', kicker: 'Measure the channels', render: social },
  { id: 'lincal', label: 'LinkedIn calendar', c: 'var(--pulse)', group: 'Brand', kicker: 'Founder and company posts', render: lincal, count: () => (lcStore().v.posts || B().lincal?.seed || []).filter((p) => p.status !== 'posted').length },
  { id: 'contests', label: 'Contests & giveaways', c: 'var(--signal)', group: 'Brand', kicker: 'Run a contest', render: contests, count: () => B().contests?.mechanics?.length || 0 },
];
