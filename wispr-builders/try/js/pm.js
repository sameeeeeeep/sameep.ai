// Wispr PM, in the browser: a sample board across three projects, the real mod's keyword router (park, what's next,
// what's waiting on me, mark done, start a thread, split this into tasks) and its cards, word for word.
// Threads are simulated here; on the Mac a thread is Claude Code working on the card.
import { present, notify, TOUCH } from './card.js';

export const PROJECTS = {
  portfolio: { name: 'portfolio', aliases: ['portfolio', 'sameep.ai', 'sameep ai', 'the site', 'my site', 'my portfolio', 'website'] },
  nailinit: { name: 'nailinit', aliases: ['nailinit', 'nail in it', 'nail it', 'nailin it', 'nail init'] },
  'wispr-pack': { name: 'wispr-pack', aliases: ['wispr pack', 'wispr-pack', 'the pack', 'pack 1', 'wispr for builders', 'builders', 'wispr'] },
};
let uid = 0;
const C = (project, title, col, prio, extra = {}) => ({ id: ++uid, project, title, col, prio, ...extra });
export const BOARD = [
  C('portfolio', 'Hero copy on mobile wraps to 4 lines', 'doing', 'high'),
  C('portfolio', 'Add the podcast player to the iMac', 'backlog', 'high'),
  C('portfolio', 'Case study page for Secret Slumber Party', 'backlog', 'med'),
  C('portfolio', 'OG images for every project page', 'backlog', 'low'),
  C('portfolio', 'Admin: export visitors as CSV', 'review', 'med', { waited: '2h', needs: 'check the CSV columns' }),
  C('portfolio', 'Fix the 375px overflow on the desktop', 'done', 'high'),
  C('nailinit', 'Email Arjun about the samples', 'backlog', 'high', { me: true }),
  C('nailinit', 'Pick the shade names for the autumn kit', 'doing', 'med'),
  C('nailinit', 'Shopify: bundle discount for 3 kits', 'review', 'high', { waited: '1d', needs: 'approve the discount rules' }),
  C('nailinit', 'Compare MOQ from the 3 vendors', 'backlog', 'med'),
  C('wispr-pack', 'Record the 60 s demo for Pack 1', 'doing', 'high'),
  C('wispr-pack', 'README: one install line per mod', 'review', 'med', { waited: '35m', needs: 'read it once' }),
  C('wispr-pack', 'Guru: test with real Flow dictation', 'backlog', 'high', { me: true }),
  C('wispr-pack', 'Pack 2 list for editors', 'backlog', 'low'),
];
let last = 'portfolio';
const PRIO = { high: 0, med: 1, low: 2 };
export const COL = { backlog: 'Backlog', doing: 'In progress', review: 'In review', done: 'Done' };
export const PRI = { high: 'High priority', med: 'Medium priority', low: 'Low priority' };
const cards = (p) => BOARD.filter((t) => t.project === p);

export function projectOf(t) {
  for (const [id, p] of Object.entries(PROJECTS)) for (const a of p.aliases) if (new RegExp(`\\b(?:for|on|to|in|into)?\\s*(?:the\\s+)?${a.replace(/[.\-]/g, '\\$&')}\\b`).test(t)) return id;
  return null;
}
const stripProject = (s) => { let x = s; for (const p of Object.values(PROJECTS)) for (const a of p.aliases) x = x.replace(new RegExp(`\\s*\\b(?:for|on|to|in|into)\\s+(?:the\\s+)?${a.replace(/[.\-]/g, '\\$&')}\\b`, 'i'), ''); return x.trim(); };
function findCard(text, project) {
  const ws = text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !['the', 'and', 'for', 'card', 'task', 'fix', 'done', 'mark', 'thread', 'start', 'one'].includes(w));
  if (!ws.length) return null;
  const pool = project ? cards(project) : BOARD;
  const scored = pool.map((c) => [c, ws.filter((w) => c.title.toLowerCase().includes(w)).length]).filter(([, n]) => n).sort((a, b) => b[1] - a[1] || (a[0].col === 'done') - (b[0].col === 'done'));
  return scored[0]?.[0] || null;
}

// the keyword router: instant, no model (lib/pm.mjs `parse`)
export function parsePM(raw) {
  const t = ' ' + raw.toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ').trim() + ' ';
  const project = projectOf(t);
  if (/\binto tasks\b/.test(t)) return { op: 'split', project, dump: raw.replace(/^.*?\binto tasks\b[:,.\s-]*/i, '') };
  if (/\bwaiting on me\b|\bwhat'?s waiting\b|\bin review\b/.test(t)) return { op: 'waiting' };
  if (/\bwhat'?s next\b|\bwhat is next\b|\bnext up\b|\bwhat should i do\b/.test(t)) return { op: 'next', project };
  let m = raw.match(/\bstart (?:a )?thread (?:on|for) (.+)/i);
  if (m) return { op: 'thread', project, text: stripProject(m[1]).replace(/^the\s+/i, '') };
  m = raw.match(/\bmark (.+?) (?:as )?(done|doing)\b/i);
  if (m) return { op: m[2].toLowerCase(), project, text: stripProject(m[1]).replace(/^the\s+/i, '') };
  m = raw.match(/\b(?:park|remind me to|add)\s+(.+)/i);
  if (m) { const what = stripProject(m[1]).replace(/[.!]$/, '').replace(/^(?:a |an )?(?:new )?(?:task|card|todo|to-do)(?: to| for)?\s+/i, ''); return { op: 'park', project, text: /^(this|that|it)$/i.test(what) ? null : what }; }
  return { op: 'board', project };
}

export async function runPM(raw, ui) {
  const a = parsePM(raw);
  const p = a.project || last;
  if (a.project) last = a.project;
  ui.route({ intent: 'pm', args: { op: a.op, project: a.op === 'waiting' ? null : p, ...(a.text ? { text: a.text } : {}) }, mod: 'Wispr PM' });
  if (a.op === 'board') { ui.showProject(p); return notify(`Showing the ${p} board. Try “what’s next on ${p}”.`, { title: 'Wispr PM' }); }

  if (a.op === 'park') {
    let text = a.text;
    if (!text) {
      // "park this": the real mod parks the first line of your clipboard
      try { text = (await navigator.clipboard.readText()).split('\n').map((s) => s.trim()).find(Boolean); } catch { /* not allowed */ }
      if (!text) return notify('“Park this” parks the first line of your clipboard, and this browser didn’t share it. Say it instead: “park fix the footer for the portfolio”.', { title: 'Wispr PM', ttl: 6 });
    }
    text = text[0].toUpperCase() + text.slice(1);
    const dupe = cards(p).find((c) => c.title.toLowerCase() === text.toLowerCase());
    if (dupe) { ui.flash(dupe.id, p); return notify(`Already on the ${p} board: ${dupe.title}`, { title: 'Wispr PM' }); }
    const c = C(p, text.slice(0, 90), 'backlog', 'med', { fresh: true }); BOARD.push(c);
    ui.render(p, c.id);
    return notify(`Parked on ${p}: ${c.title}`, { title: 'Wispr PM' });
  }

  if (a.op === 'next') {
    const list = cards(p).filter((c) => c.col === 'doing' || c.col === 'backlog').sort((x, y) => (x.col !== 'doing') - (y.col !== 'doing') || PRIO[x.prio] - PRIO[y.prio]).slice(0, 4);
    ui.showProject(p);
    if (!list.length) return notify(`Nothing open on ${p}.`, { title: 'Wispr PM' });
    const r = await present({ mod: 'Wispr PM', title: `Next on ${p}`, subtitle: 'Pick one to act on it.', options: list.map((t) => ({ label: t.title.slice(0, 70), detail: [COL[t.col], PRI[t.prio]].filter(Boolean).join(' · ') })), recommended: 1 });
    ui.result(r);
    if (r.cancelled) return;
    let card = r.pick ? list[r.pick - 1] : findCard(r.text, p);
    if (!card) return notify('No card matched that.', { title: 'Wispr PM' });
    if (r.note) return act(card, r.note, ui);
    return cardMenu(card, ui);
  }

  if (a.op === 'waiting') {
    const w = BOARD.filter((c) => c.col === 'review' || (c.me && c.col !== 'done'));
    ui.showProject(null);
    if (!w.length) return notify('Nothing is waiting on you.', { title: 'Wispr PM' });
    const opts = w.map((it) => ({ label: it.title.slice(0, 70), detail: [it.project, it.waited && `waited ${it.waited}`, it.needs || (it.me ? 'tagged @me' : '')].filter(Boolean).join(' · ') }));
    opts.push({ label: 'Snooze for an hour', detail: 'Hide the pill; it comes back with anything new after that' });
    const r = await present({ mod: 'Wispr PM', title: `${w.length} waiting on you`, subtitle: `${TOUCH ? 'Tap' : 'Click'} one to open it`, options: opts, recommended: 1 });
    ui.result(r);
    if (r.cancelled) return;
    if (r.pick === opts.length) { ui.snooze(); return notify('Snoozed for an hour.', { title: 'Wispr PM' }); }
    const card = r.pick ? w[r.pick - 1] : findCard(r.text);
    if (!card) return;
    if (r.note) return act(card, r.note, ui);
    return cardMenu(card, ui);
  }

  if (a.op === 'done' || a.op === 'doing') {
    const card = findCard(a.text || '', a.project);
    if (!card) return notify(`No card on the board matches “${a.text}”.`, { title: 'Wispr PM' });
    move(card, a.op, ui);
    return notify(a.op === 'done' ? `Done: ${card.title}` : `Doing: ${card.title}`, { title: 'Wispr PM' });
  }

  if (a.op === 'thread') {
    let card = findCard(a.text || '', a.project);
    if (!card) { card = C(p, a.text[0].toUpperCase() + a.text.slice(1), 'backlog', 'med', { fresh: true }); BOARD.push(card); ui.render(p, card.id); }
    return threadMenu(card, ui);
  }

  if (a.op === 'split') {
    const items = a.dump.split(/\s*(?:[,;\n]|\band then\b|\bthen\b|\balso\b|\band\b)\s*/i).map((s) => s.replace(/^(to|i need to|we need to)\s+/i, '').trim()).filter((s) => s.length > 2);
    if (items.length < 2) return notify('Say the list after “split this into tasks”, like “split this into tasks: fix the footer, add OG images and test on mobile”. (On your Mac it can split your clipboard too.)', { title: 'Wispr PM', ttl: 7 });
    const list = [...new Set(items.map((s) => s[0].toUpperCase() + s.slice(1)))].slice(0, 9);
    const r = await present({ mod: 'Wispr PM', multi: true, title: `${list.length} cards for ${p}. Keep which?`, subtitle: `${TOUCH ? 'Tap' : 'Click'} the ones to keep, then Done.`, options: list.map((c) => ({ label: c, detail: 'New task' })) });
    ui.result(r);
    if (r.cancelled || !r.picks) return;
    let lastId; for (const i of r.picks) { const c = C(p, list[i - 1], 'backlog', 'med', { fresh: true }); BOARD.push(c); lastId = c.id; }
    ui.render(p, lastId);
    return notify(`Added ${r.picks.length} cards to ${p}.`, { title: 'Wispr PM' });
  }
}

function move(card, col, ui) { card.col = col; if (col !== 'review') { delete card.waited; delete card.needs; } if (col === 'done') card.me = false; ui.render(card.project, card.id); }

async function cardMenu(card, ui) {
  const r = await present({
    mod: 'Wispr PM', title: card.title.slice(0, 80), subtitle: `${card.project} · ${COL[card.col]}`,
    options: [{ label: 'Start a thread on it', detail: 'claude -p in the project, pings you when done' }, { label: 'Mark done' }, { label: 'Park it (backlog)' }, { label: 'Mark doing' }],
  });
  ui.result(r);
  if (r.cancelled) return;
  if (r.text) return act(card, r.text, ui);
  return act(card, ['thread', 'done', 'park', 'doing'][r.pick - 1], ui);
}
async function act(card, what, ui) {
  const w = what.toLowerCase();
  if (/thread|start|claude/.test(w)) return threadMenu(card, ui);
  if (/done|finish/.test(w)) { move(card, 'done', ui); return notify(`Done: ${card.title}`, { title: 'Wispr PM' }); }
  if (/park|backlog|later/.test(w)) { move(card, 'backlog', ui); return notify(`Parked: ${card.title}`, { title: 'Wispr PM' }); }
  if (/doing|now/.test(w)) { move(card, 'doing', ui); return notify(`Doing: ${card.title}`, { title: 'Wispr PM' }); }
  notify(`Noted on “${card.title}”: ${what}`, { title: 'Wispr PM' });
}
async function threadMenu(card, ui) {
  const r = await present({ mod: 'Wispr PM', title: `Start a thread: ${card.title.slice(0, 60)}`, subtitle: card.project, options: [{ label: 'In the background', detail: 'claude -p, pings you when done' }, { label: 'Open in Terminal', detail: 'an interactive Claude Code thread' }] });
  ui.result(r);
  if (r.cancelled) return;
  move(card, 'doing', ui); card.running = true; ui.render(card.project, card.id);
  notify(`Thread started on “${card.title}”. On your Mac this is Claude Code working in ${card.project}; here it’s simulated.`, { title: 'Wispr PM', ttl: 5 });
  setTimeout(() => {
    card.running = false; card.col = 'review'; card.waited = 'just now'; card.needs = 'read what Claude changed';
    ui.render(card.project, card.id);
    notify(`Finished: ${card.title}. It’s waiting on you.`, { title: 'Wispr PM', ttl: 5 });
  }, 6500);
}

export const waitingCount = () => BOARD.filter((c) => c.col === 'review' || (c.me && c.col !== 'done')).length;
