// projects.js — the "By project" tab of the episode map: one card per project,
// a line on what it is, and a click plays the part of the episode about it.
// For anyone who wants the work, not the whole show.
import { h } from './util.js';
import { mins } from './chooser.js';

// node: where the episode talks about it. work: its work.json entry (poster, one-liner).
// Projects with no node open their work page instead.
export const PROJECTS = [
  { group: 'Things I built', items: [
    { work: 'switchboard', node: 'sb-intro', tag: 'Sign in with Google, but for AI' },
    { work: 'pptlive', node: 'ppt-intro', tag: 'Kahoot inside your slides' },
    { work: 'video2ai', node: 't-video', tag: 'Eyes for Claude' },
    { work: 'brandbrain', node: 'w-brandbrain', tag: 'A growth team in a tab' },
    { work: 'asknotch', node: 'sb-notch', tag: 'Claude asks from your notch' },
    { work: 'refs', node: 't-refs', tag: 'Taste, handed to your agent' },
    { work: 'prophexy', node: 'w-prophexy', tag: 'One computed reading a day' },
  ] },
  { group: 'Growth', items: [
    { node: 'g-nykaa', title: 'Nykaa sales', tag: 'Pre-buzz before the big sales', blurb: 'Getting people talking before the sale even opens.' },
    { work: 'diwali', node: 'g-diwali', tag: 'An invite you play, not open' },
    { node: 'g-slumber', title: 'The sleepover application', tag: 'A sleepover you apply to', blurb: 'An invite that made people want in.' },
    { work: 'nia', node: 'g-nailinit', tag: 'One screen to run a D2C brand' },
  ] },
  { group: 'The one that didn’t work', items: [
    { work: 'often', node: 'often-intro', tag: 'An AI travel hacker that couldn’t control its supply' },
  ] },
  { group: 'Fun and unfinished', items: [
    { work: 'wallpap', node: 'f-wallpap', tag: 'A living window as your wallpaper' },
    { work: 'psspss', node: 'f-psspss', tag: 'A household of AI cats' },
    { work: 'agentbar', node: 'f-agentbar', tag: 'A bar where AI agents hang out' },
    { work: 'pastedeck', node: 't-adhd', tag: 'The values you paste yourself' },
    { work: 'happydiwali', tag: 'A Diwali card you light' },
  ] },
];

const STATUS = { live: 'Live', wip: 'In progress', archived: 'Shut down' };

export function projectCards(map, { workList = [], base = '', currentNode, visited, onGo, onOpen }) {
  const byId = new Map(workList.map((w) => [w.id, w]));
  const src = (u) => (u ? new URL(u, base || location.href).href : '');
  const out = [];
  for (const g of PROJECTS) {
    const cards = g.items.map((p) => {
      const w = p.work ? byId.get(p.work) : null;
      const node = p.node && map.N[p.node] ? p.node : null;
      if (!w && !node) return null;
      const title = p.title || w?.title || map.title(node);
      const now = node && node === currentNode;
      const heard = node && visited.has(node);
      return h('li', h('button.pcard' + (now ? '.is-now' : '') + (heard ? '.is-visited' : ''), {
        type: 'button', 'aria-current': now ? 'true' : null,
        onclick: () => (node ? onGo(node) : onOpen(p.work)),
      },
        h('span.pcard__pic', w?.poster ? h('img', { src: src(w.poster), alt: '', loading: 'lazy', decoding: 'async' }) : h('span.pcard__mono', { 'aria-hidden': 'true' }, title.slice(0, 1))),
        h('span.pcard__body',
          h('span.pcard__t', title, w?.status && w.status !== 'live' ? h('span.pcard__st', STATUS[w.status] || w.status) : null),
          h('span.pcard__tag', p.tag),
          h('span.pcard__blurb', p.blurb || w?.oneLiner || ''),
          h('span.pcard__go', node ? (now ? '▶ Playing now' : `▶ Hear about it${map.sec(node) ? ' · ' + mins(map.sec(node)) : ''}`) : 'Open the project ↗'))));
    }).filter(Boolean);
    if (cards.length) out.push(h('li.pgroup', h('p.pgroup__t', g.group), h('ul.pgroup__list', cards)));
  }
  return out;
}
