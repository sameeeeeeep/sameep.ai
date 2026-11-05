// wisprfolder.js — the Wispr folder: what I made for Wispr, in three parts.
//   Wispr for Builders: small Claude mods that make voice a superpower (Pack 1: Video, Guru, Review, File, Wish, PM)
//   The fun one: Wispr Wrapped
//   The plan: Wispr Growth OS (its own tab, behind a team sign-in)
// Each icon has a hover card (data-card="wispr-<id>", copy in js/app/cards.js). A mod whose page isn't up yet
// shows as "Coming" instead of a dead link; the check runs each time the folder opens, so its icon goes live
// the moment the page ships.
import { h } from './util.js';
import { sound } from './audio.js';

const at = (p) => new URL('../../' + p, import.meta.url).href;
const mod = (id, label, path) => ({ id, label, url: at(path + '/'), probe: true });
export const SECTIONS = [
  { id: 'builders', title: 'Wispr for Builders', note: 'Pack 1 · small Claude mods that make voice a superpower',
    items: [mod('wispreditor', 'Wispr Video', 'wispr-editor'), mod('guru', 'Wispr Guru', 'wispr-guru'), mod('review', 'Wispr Review', 'wispr-review'),
      mod('file', 'Wispr File', 'wispr-file'), mod('wish', 'Wispr Wish', 'wispr-wish'), mod('pm', 'Wispr PM', 'wispr-pm')] },
  { id: 'fun', title: 'The fun one', note: 'My real Flow history, as a story',
    items: [{ id: 'wrapped', label: 'Wispr Wrapped', url: at('wispr-wrapped/'), probe: true }] },
  { id: 'plan', title: 'The plan', note: 'How I’d grow Wispr, section by section',
    items: [{ id: 'growthos', label: 'Wispr Growth OS', icon: at('growth-os/icon.svg'), url: at('growth-os/?version=wispr') }] },
];
export const WISPR = {
  id: 'wispr', label: 'Wispr',
  card: { what: 'What I made for Wispr', proof: 'Wispr for Builders, the fun one, and the plan' },
  items: SECTIONS.flatMap((s) => s.items),
};

// is the page there yet? (a 404 from Pages means not shipped)
const live = (u) => fetch(u, { method: 'HEAD', cache: 'no-store' }).then((r) => r.ok, () => false);

// still(): checked after the probes; false (the guide that asked was skipped meanwhile) and it stays shut
export async function openWisprFolder(wm, { still = () => true } = {}) {
  const was = wm.get('folder-wispr');
  if (was) { was.focus(); return; }
  const up = new Map(await Promise.all(WISPR.items.map(async (g) => [g.id, g.probe ? await live(g.url) : true])));
  if (!still()) return;
  const area = document.querySelector('.desk__area')?.getBoundingClientRect();
  const n = document.querySelectorAll('.win--folder:not([hidden])').length;
  const W = 460;
  const w = wm.win('folder-wispr', { title: WISPR.label, width: W, className: 'win--folder win--wfold', ...(area ? { x: Math.max(8, (area.width - W) / 2 - 48 + n * 26), y: 48 + n * 26 } : {}) });
  if (w.body.childElementCount) return;
  const img = (g, off) => h('img', { src: g.icon || `img/ui/proj-${g.id}.svg`, alt: '', width: 48, height: 48, draggable: 'false', class: off ? 'is-off' : null });
  const icon = (g) => up.get(g.id)
    ? h('a.icon.icon--file', { href: g.url, target: '_blank', rel: 'noopener', dataset: { card: 'wispr-' + g.id }, onclick: () => sound.tick('click') }, img(g), h('span.icon__label', g.label))
    : h('button.icon.icon--file.is-coming', { type: 'button', dataset: { card: 'wispr-' + g.id }, 'aria-label': `${g.label}, coming soon`,
      onclick: () => { sound.tick('click'); wm.alert({ icon: 'img/ui/note.svg', title: g.label, message: 'Coming soon. It opens here the moment it’s live.', buttons: [{ label: 'OK', primary: true }] }); } },
    img(g, true), h('span.icon__label', g.label), h('span.wsec__soon', 'Coming'));
  const nLive = WISPR.items.filter((g) => up.get(g.id)).length;
  w.body.append(h('p.folder__bar', `${WISPR.items.length} items · ${nLive} open in a new tab` + (nLive < WISPR.items.length ? `, ${WISPR.items.length - nLive} coming` : '')),
    ...SECTIONS.map((s) => h('section.wsec', { dataset: { sec: s.id }, 'aria-labelledby': 'wsec-' + s.id },
      h('header.wsec__head', h('h3.wsec__t', { id: 'wsec-' + s.id }, s.title), h('p.wsec__note', s.note)),
      h('ul.folder__grid', s.items.map((g) => h('li', icon(g)))))));
}
