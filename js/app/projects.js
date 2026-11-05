// projects.js — the "By project" tab of the episode map: one card per project,
// a line on what it is, and a click plays the part of the episode about it.
// For anyone who wants the work, not the whole show.
import { h } from './util.js';
import { mins } from './chooser.js';
import { shows } from '../version.js';

// node: where the episode talks about it. work: its work.json entry (poster, one-liner).
// Projects with no node open their work page instead; url: a page of its own (new tab). only: one version's group.
export const PROJECTS = [
  { group: 'Made for Wispr', only: 'wispr', items: [
    { node: 'builders', title: 'Wispr for Builders', tag: 'Pack 1: Claude mods you run by voice', blurb: 'The part of the show made for Wispr, about a minute long.' },
    { title: 'Guru', url: 'wispr-guru/', tag: 'A second cursor that shows you how', thumb: 'img/work/wispr/guru.jpg' },
    { title: 'Wispr Video', url: 'wispr-editor/', tag: 'Teleprompter, recorder and editor in one', thumb: 'img/work/wispr/video.jpg' },
    { title: 'Wispr Wrapped', url: 'wispr-wrapped/', tag: 'A Wrapped of your Wispr Flow history', thumb: 'img/work/wispr/wrapped.jpg' },
  ] },
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
    { node: 'g-slumber', title: 'The Secret Slumber Party', tag: 'A sleepover you apply to by DM', blurb: 'Khushi Kapoor’s sleepover for Nailinit, and the film.' },
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
  for (const g of PROJECTS.filter(shows)) {
    const cards = g.items.map((p) => {
      const w = p.work ? byId.get(p.work) : null;
      const node = p.node && map.N[p.node] ? p.node : null;
      const pic = (title) => h('span.pcard__pic', p.thumb || w?.poster ? h('img', { src: src(p.thumb || w.poster), alt: '', loading: 'lazy', decoding: 'async' }) : h('span.pcard__mono', { 'aria-hidden': 'true' }, title.slice(0, 1)));
      if (p.url && !node) return h('li', h('a.pcard', { href: src(p.url), target: '_blank', rel: 'noopener' }, pic(p.title),
        h('span.pcard__body', h('span.pcard__t', p.title), h('span.pcard__tag', p.tag), p.blurb && h('span.pcard__blurb', p.blurb), h('span.pcard__go', 'Open the page ↗'))));
      if (!w && !node) return null;
      const title = p.title || w?.title || map.title(node);
      const now = node && node === currentNode;
      const heard = node && visited.has(node);
      return h('li', h('button.pcard' + (now ? '.is-now' : '') + (heard ? '.is-visited' : ''), {
        type: 'button', 'aria-current': now ? 'true' : null,
        onclick: () => (node ? onGo(node) : onOpen(p.work)),
      },
        pic(title),
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
