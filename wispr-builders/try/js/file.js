// Wispr File, in the browser: the real mod's parser (lib/find.mjs parse/parseWhen, ported), a ranking like its
// Spotlight ranking, over the sample Mac in mac.js. Picking a file copies it to the clipboard as an image.
import { FILES, PATH, whenLabel, thumbURL, filePNG } from './mac.js';
import { present, notify, TOUCH } from './card.js';

const ACTIONS = [
  [/\b(copy|grab) (the |its )?(file )?path\b|\bpath (of|to)\b/, 'path'],
  [/\b(reveal|show (it |me )?in finder|in finder|where is|where's|locate)\b/, 'reveal'],
  [/\battach(ed|ing)?\b/, 'attach'],
  [/\bpaste\b|\bdrop (it )?(in|into)\b|\bput (it )?(in|into)\b|\bsend\b/, 'paste'],
  [/\bopen\b/, 'open'],
  [/\bcopy\b/, 'copy'],
];
const WHERE = [
  [/\b(on|from|in) (my |the )?desktop\b/, 'Desktop'],
  [/\b(in|from) (my |the )?downloads?( folder)?\b/, 'Downloads'],
  [/\b(in|from) (my |the )?documents( folder)?\b/, 'Documents'],
  [/\b(in|from) (my |the )?pictures( folder)?\b/, 'Pictures'],
];
const KINDS = { screenshot: 'screenshot', image: 'image', pdf: 'PDF', deck: 'deck', sheet: 'spreadsheet', doc: 'document', video: 'video', audio: 'audio', folder: 'folder', archive: 'archive' };
const KIND_WORDS = [
  [/\bscreen ?(shot|grab|cap(ture)?)s?\b|\bsnip\b/, 'screenshot'],
  [/\bscreen ?recordings?\b/, 'video'],
  [/\b(photos?|pictures?|pics?|images?|selfies?|jpe?gs?|pngs?|heics?|scans?)\b/, 'image'],
  [/\bpdfs?\b/, 'pdf'],
  [/\b(decks?|presentations?|slides?|keynotes?|pptx?|powerpoints?)\b/, 'deck'],
  [/\b(spreadsheets?|sheets?|excel|xlsx?|csvs?|numbers file)\b/, 'sheet'],
  [/\b(docx?|word (doc|file|document)s?|pages doc)\b/, 'doc'],
  [/\b(videos?|movies?|clips?|mp4|mov|recordings?)\b/, 'video'],
  [/\b(audio|songs?|mp3|wav|voice memos?|podcasts?)\b/, 'audio'],
  [/\bfolders?\b/, 'folder'],
  [/\b(zips?|archives?)\b/, 'archive'],
];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const STOP = new Set(('find get show open grab fetch pull up look search for where is the a an my me i i\'ve ive took taken ' +
  'made saved of from in on at to with that this it its which one ones please file files thing stuff some any ' +
  'and or copy paste attach reveal into send drop put finder can you could would like want need called named ' +
  'about last latest newest recent recently most document documents version copy here there them those these ' +
  'all was were be been have has had just quick quickly really kind sort type downloaded download received got sent shared emailed created edited wrote saved').split(' '));
const NUMWORDS = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, ten: 10 };
const DAY = 86_400_000;
const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

export function parseWhen(t, now = new Date()) {
  const today = dayStart(now);
  const r = (from, to, label) => ({ from: +from, to: +to, label });
  if (/\btoday\b/.test(t)) return r(today, +today + DAY, 'today');
  if (/\byesterday\b/.test(t)) return r(+today - DAY, today, 'yesterday');
  let m = t.match(/\b(?:last|past) (\d+|two|three|four|five|six|seven|ten) days\b/);
  if (m) { const n = Number(m[1]) || NUMWORDS[m[1]] || 3; return r(+today - n * DAY, +today + DAY, `last ${n} days`); }
  if (/\bthis week\b/.test(t)) return r(+today - 7 * DAY, +today + DAY, 'this week');
  if (/\blast week\b/.test(t)) return r(+today - 14 * DAY, +today - 3 * DAY, 'last week');
  if (/\bthis month\b/.test(t)) return r(new Date(now.getFullYear(), now.getMonth(), 1), +today + DAY, 'this month');
  if (/\blast month\b/.test(t)) return r(new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 1), 'last month');
  if (/\bthis year\b/.test(t)) return r(new Date(now.getFullYear(), 0, 1), +today + DAY, 'this year');
  if (/\blast year\b/.test(t)) return r(new Date(now.getFullYear() - 1, 0, 1), new Date(now.getFullYear(), 0, 1), 'last year');
  m = t.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b(?:\s+(\d{4}))?/);
  if (m && !(m[1] === 'may' && !m[2] && !/\b(in|from|of|during) may\b/.test(t))) {
    const mi = MONTHS.indexOf(m[1].slice(0, 3));
    let y = m[2] ? Number(m[2]) : now.getFullYear();
    if (!m[2] && mi > now.getMonth()) y -= 1;
    return r(new Date(y, mi, 1), new Date(y, mi + 1, 1), m[0][0].toUpperCase() + m[0].slice(1));
  }
  m = t.match(/\b(?:in|from) (20\d\d)\b/);
  if (m) return r(new Date(+m[1], 0, 1), new Date(+m[1] + 1, 0, 1), m[1]);
  return null;
}

export function parse(text) {
  const raw = String(text || '').trim();
  let t = ' ' + raw.toLowerCase().replace(/[’']s\b/g, '').replace(/[“”"]/g, ' ') + ' ';
  const plan = { text: raw, terms: [], kind: null, range: null, recent: false, action: null, app: null, where: null };
  for (const [re, a] of ACTIONS) if (re.test(t)) { plan.action = a; break; }
  const app = t.match(/\b(?:into|in|to|on) (slack|mail|gmail|messages|imessage|whatsapp|notion|figma|chatgpt|claude|discord|telegram)\b/);
  if (app) { plan.app = app[1]; if (!plan.action) plan.action = 'attach'; t = t.replace(app[0], ' '); }
  for (const [re, dir] of WHERE) if (re.test(t)) { plan.where = dir; t = t.replace(re, ' '); break; }
  plan.range = parseWhen(t);
  if (plan.range) {
    t = t.replace(/\b(today|yesterday|this week|last week|this month|last month|this year|last year|(last|past) \S+ days)\b/g, ' ')
      .replace(/\b(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|june?|july?|aug(ust)?|sept?(ember)?|oct(ober)?|nov(ember)?|dec(ember)?)\b(\s+20\d\d)?/g, ' ')
      .replace(/\b(in|from) may\b/g, ' ').replace(/\b(in|from) 20\d\d\b/g, ' ');
  }
  if (/\b(last|latest|newest|most recent|recent|just took|just saved|just downloaded)\b/.test(t)) plan.recent = true;
  for (const [re, k] of KIND_WORDS) { if (re.test(t)) { plan.kind = k; t = t.replace(re, ' '); break; } }
  // the action words were matched above; drop them so "reveal it" is not a search term
  t = t.replace(/\b(reveal|locate|attach|paste|path|it)\b/g, ' ');
  const ws = t.replace(/[^a-z0-9À-￿_\-. ]+/g, ' ').split(/\s+/).map((w) => w.replace(/^[.\-]+|[.\-]+$/g, ''));
  plan.terms = [...new Set(ws.filter((w) => w && w.length > 1 && !STOP.has(w)))].slice(0, 5);
  return plan;
}

// rank: name matches beat text matches; kind and date count; recent files and Desktop/Downloads/Documents get a nudge
function rank(plan, { dropDate = false } = {}) {
  const now = Date.now();
  const range = dropDate ? null : plan.range;
  const kindOk = (f) => !plan.kind || f.kind === plan.kind || (plan.kind === 'image' && f.kind === 'screenshot' && !plan.terms.length) || (plan.kind === 'pdf' && f.name.endsWith('.pdf'));
  const out = [];
  for (const f of FILES) {
    if (plan.where && f.folder !== plan.where) continue;
    if (range && !(+f.date >= range.from && +f.date < range.to)) continue;
    if (!kindOk(f)) continue;
    const name = f.name.toLowerCase().split(/[^a-z0-9]+/);
    const text = f.text.split(/\s+/);
    let s = 0, hit = 0;
    for (const w of plan.terms) {
      const stem = w.replace(/s$/, '');
      if (name.some((x) => x.startsWith(stem))) { s += 3; hit++; } else if (text.some((x) => x.startsWith(stem))) { s += 1.6; hit++; }
    }
    if (plan.terms.length && !hit) continue;
    if (plan.terms.length > 1 && hit < Math.ceil(plan.terms.length / 2)) continue;
    if (plan.kind && f.kind === plan.kind) s += 1.2;
    if (range) s += 1;
    const age = (now - f.date) / DAY;
    s += plan.recent || !plan.terms.length ? Math.max(0, 3 - age / 4) : Math.max(0, 0.6 - age / 60);
    if (/Desktop|Downloads|Documents/.test(f.folder)) s += 0.15;
    out.push({ f, s });
  }
  out.sort((a, b) => b.s - a.s || b.f.date - a.f.date);
  return out.map((x) => x.f);
}

export function search(text) {
  const plan = parse(text);
  if (!plan.terms.length && !plan.kind && !plan.range) return { plan, items: [] };
  let items = rank(plan);
  if (!items.length && plan.range) { items = rank(plan, { dropDate: true }); plan.droppedDate = !!items.length; }
  return { plan, items: items.slice(0, 6) };
}

const VERB = { paste: 'paste into the front app', attach: 'attach', copy: 'copy', reveal: 'show in Finder', open: 'open', path: 'copy the path' };
// "find my passport photo" -> "passport photo", for a card title that asks, like the real card does
const noun = (t) => t.replace(/[,.!?].*$/, '').replace(/^\s*(?:please\s+)?(?:find|get|grab|show(?: me)?|pull up|open|where(?:'s| is)|look for|search for)\s+/i, '').replace(/^(?:me\s+)?(?:my|the|a|an|that|this)\s+/i, '').replace(/^(?:last|latest|newest|most recent)\s+/i, '').trim().slice(0, 48);
const detailOf = (f) => `${whenLabel(f.date)} · ${f.folder}`;

export async function runFile(text, ui, depth = 0) {
  const { plan, items } = search(text);
  ui.route({ intent: 'file.find', args: { query: plan.terms.join(' ') || null, kind: plan.kind, when: plan.range?.label || null, where: plan.where }, mod: 'Wispr File' });
  if (!items.length) {
    notify(`Nothing on this sample Mac matches “${text}”. Try “my passport photo” or “the invoice from ${new Date(Date.now() - 31 * DAY).toLocaleString('en', { month: 'long' })}”.`, { title: 'Wispr File', ttl: 5 });
    return;
  }
  const action = plan.action || 'copy';
  const what = [plan.terms.join(' '), plan.kind && KINDS[plan.kind], plan.range && !plan.droppedDate && plan.range.label].filter(Boolean).join(' · ');
  const r = await present({
    mod: 'Wispr File',
    title: noun(text) ? `Which ${noun(text)}?` : 'Which file?',
    subtitle: `${items.length} on this sample Mac. ${TOUCH ? 'Tap' : 'Click'} one to ${VERB[action] === VERB.paste ? 'copy it' : VERB[action]}.`,
    options: items.map((f) => ({ label: f.name, detail: detailOf(f), image: thumbURL(f) })),
    recommended: 1,
  });
  ui.result(r);
  if (r.cancelled) return;
  if (r.text) {
    // the real card's parseReply: a number anywhere ("the second one, reveal it") is a pick, plus an action;
    // anything else refines the search once with the words that are left ("none of these, the blue one")
    const rt = ' ' + r.text.toLowerCase() + ' ';
    const ORD = { one: 1, first: 1, two: 2, second: 2, three: 3, third: 3, four: 4, fourth: 4, five: 5, fifth: 5, six: 6, sixth: 6 };
    const nm = rt.match(/\b([1-6])\b|\b(first|second|third|fourth|fifth|sixth)\b|\b(one|two|three|four|five|six)\b(?! of)/);
    const n = nm ? Number(nm[1]) || ORD[nm[2] || nm[3]] : 0;
    if (n >= 1 && n <= items.length && !/\bnone\b/.test(rt)) { let a = action; for (const [re, x] of ACTIONS) if (re.test(rt)) { a = x; break; } return act_(items[n - 1], a, ui); }
    const more = rt.replace(/\b(none|not|no|of|these|those|this|that|it|the|one|ones|instead|actually|rather|i meant?|want)\b/g, ' ').replace(/[^a-z0-9 ]/g, ' ').trim();
    if (depth < 1 && more) return runFile(`${plan.terms.join(' ')} ${more}`, ui, depth + 1);
    notify('Still nothing picked, so File stopped here.', { title: 'Wispr File' });
    return;
  }
  const f = items[r.pick - 1];
  let act = action;
  if (r.note) for (const [re, a] of ACTIONS) if (re.test(' ' + r.note.toLowerCase() + ' ')) { act = a; break; }
  await act_(f, act, ui);
}

async function act_(f, act, ui) {
  if (act === 'path') {
    try { await navigator.clipboard.writeText(PATH(f)); notify(`Copied the path: ${PATH(f)}`, { title: 'Wispr File' }); }
    catch { notify(PATH(f), { title: 'Wispr File · the path', ttl: 6 }); }
    return;
  }
  if (act === 'reveal') { ui.reveal(f); notify(`Showing ${f.name} in the sample Finder below.`, { title: 'Wispr File' }); return; }
  if (act === 'open') { ui.preview(f); return; }
  // copy / paste / attach: the file goes on the clipboard as an image
  try {
    const blob = filePNG(f);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    notify(`Copied ${f.name} as an image. ${TOUCH ? 'Paste it anywhere.' : 'Press ⌘V anywhere to paste it.'}`, { title: 'Wispr File', ttl: 5 });
    ui.copied(f);
  } catch {
    notify(`Your browser blocked the copy. Here’s the file instead.`, { title: 'Wispr File', ttl: 4 });
    ui.preview(f);
  }
}
