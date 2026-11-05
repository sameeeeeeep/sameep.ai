// wisprfolder.js — the Wispr folder: what I made for Wispr, in three parts.
//   Wispr for Builders: small Claude mods that make voice a superpower (Pack 1: Video and Guru out now;
//     Review, File, Wish and PM on the way, listed in one muted line)
//   The fun one: Wispr Wrapped
//   The plan: Wispr Growth OS (its own tab, behind a team sign-in)
// Each icon has a hover card (data-card="wispr-<id>", copy in js/app/cards.js). Nothing is probed: a mod
// ships by moving it from SOON into its section's items (its page at <path>/ must be live first).
import { h } from './util.js';
import { sound } from './audio.js';

const at = (p) => new URL('../../' + p, import.meta.url).href;
const mod = (id, label, path) => ({ id, label, url: at(path + '/') });
export const SECTIONS = [
  { id: 'builders', title: 'Wispr for Builders', note: 'Pack 1 · small Claude mods that make voice a superpower',
    items: [mod('wispreditor', 'Wispr Video', 'wispr-editor'), mod('guru', 'Wispr Guru', 'wispr-guru')],
    soon: ['Review', 'File', 'Wish', 'PM'] },
  { id: 'fun', title: 'The fun one', note: 'My real Flow history, as a story',
    items: [mod('wrapped', 'Wispr Wrapped', 'wispr-wrapped')] },
  { id: 'plan', title: 'The plan', note: 'How I’d grow Wispr, section by section',
    items: [{ id: 'growthos', label: 'Wispr Growth OS', icon: at('growth-os/icon.svg'), url: at('growth-os/?version=wispr') }] },
];
export const WISPR = {
  id: 'wispr', label: 'Wispr',
  card: { what: 'What I made for Wispr', proof: 'Wispr for Builders, the fun one, and the plan' },
  items: SECTIONS.flatMap((s) => s.items),
};

// still(): false (the guide that asked was skipped meanwhile) and it stays shut
export async function openWisprFolder(wm, { still = () => true } = {}) {
  const was = wm.get('folder-wispr');
  if (was) { was.focus(); return; }
  if (!still()) return;
  const area = document.querySelector('.desk__area')?.getBoundingClientRect();
  const n = document.querySelectorAll('.win--folder:not([hidden])').length;
  const W = 460;
  const w = wm.win('folder-wispr', { title: WISPR.label, width: W, className: 'win--folder win--wfold', ...(area ? { x: Math.max(8, (area.width - W) / 2 - 48 + n * 26), y: 48 + n * 26 } : {}) });
  if (w.body.childElementCount) return;
  const img = (g) => h('img', { src: g.icon || `img/ui/proj-${g.id}.svg`, alt: '', width: 48, height: 48, draggable: 'false' });
  const icon = (g) => h('a.icon.icon--file', { href: g.url, target: '_blank', rel: 'noopener', dataset: { card: 'wispr-' + g.id }, onclick: () => sound.tick('click') }, img(g), h('span.icon__label', g.label));
  const sec = (s) => h('section.wsec', { dataset: { sec: s.id }, 'aria-labelledby': 'wsec-' + s.id },
    h('header.wsec__head', h('h3.wsec__t', { id: 'wsec-' + s.id }, s.title), h('p.wsec__note', s.note)),
    h('ul.folder__grid', s.items.map((g) => h('li', icon(g)))),
    s.soon?.length ? h('p.wsec__more', `${s.soon.length} more on the way: ${s.soon.join(', ')}`) : null);
  // the fun one and the plan side by side, in one row (one thing for the tour to point at)
  const [top, ...rest] = SECTIONS;
  w.body.append(h('p.folder__bar', `${WISPR.items.length} items · each opens in a new tab`), sec(top), h('div.wsec-row', rest.map(sec)));
}
