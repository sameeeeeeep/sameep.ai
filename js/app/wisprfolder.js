// wisprfolder.js — the Wispr folder: what I made for Wispr, in three parts.
//   Wispr for Builders: small Claude mods that make voice a superpower (Pack 1 is public on GitHub:
//     the pack page installs all of it; Video and Guru also have their own pages)
//   The fun one: Wispr Wrapped
//   The plan: Wispr Growth OS (its own tab, behind a team sign-in)
// Each icon has a hover card (data-card="wispr-<id>", copy in js/app/cards.js). Nothing is probed: a mod
// ships by moving it from SOON into its section's items (its page at <path>/ must be live first).
import { h } from './util.js';
import { sound } from './audio.js';

const at = (p) => new URL('../../' + p, import.meta.url).href;
const mod = (id, label, path) => ({ id, label, url: at(path + '/') });
export const SECTIONS = [
  { id: 'builders', title: 'Wispr for Builders', note: 'Pack 1. Small Claude mods that make your voice a superpower.',
    items: [mod('builders', 'Pack 1', 'wispr-builders'), mod('try', 'Try Pack 1', 'wispr-builders/try'), mod('wispreditor', 'Wispr Video', 'wispr-editor'), mod('guru', 'Wispr Guru', 'wispr-guru')],
    soon: [] },
  { id: 'fun', title: 'The fun one', note: 'My real Flow history, as a story.',
    items: [mod('wrapped', 'Wispr Wrapped', 'wispr-wrapped')] },
  { id: 'plan', title: 'The plan', note: 'How I’d grow Flow in India.',
    items: [{ id: 'growthos', label: 'Wispr Growth OS', url: at('growth-os/?version=wispr') }] },
];
export const WISPR = {
  id: 'wispr', label: 'Wispr',
  card: { what: 'What I made for Wispr', proof: 'Wispr for Builders, the fun one, and the plan' },
  items: SECTIONS.flatMap((s) => s.items),
};

// the window's insides use Wispr Flow's app mode (sand page, white panels, Figtree, sentence case) from the kit;
// the window chrome stays the desktop's. Loaded once, the first time the folder opens.
const KIT_FONTS = 'https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Figtree:wght@400;500;600;700&family=Google+Sans+Code:wght@400;500&display=swap';
const APP_CSS = `
.win--wfold .win__body { background: var(--sand-500); color: var(--vast-950); font-family: var(--w-sans); gap: 8px; padding: 8px; }
.win--wfold .folder__bar { border: 0; padding: 8px 8px 2px; text-align: left; font: 500 12px/1 var(--w-sans); letter-spacing: .08em; text-transform: uppercase; color: var(--vast-600); }
.win--wfold .wsec { background: var(--w-card); border: 1px solid var(--sand-600); border-radius: var(--w-r-lg); overflow: hidden; }
.win--wfold .wsec-row { gap: 8px; border-top: 0; }
.win--wfold .wsec[data-sec="plan"] { border-left: 1px solid var(--sand-600); }
.win--wfold .wsec__head { padding: 14px 14px 0; gap: 2px 8px; }
.win--wfold .wsec__t { font: 600 14px/1.3 var(--w-sans); letter-spacing: -.005em; color: var(--vast-950); }
.win--wfold .wsec[data-sec="builders"] .wsec__t::before { display: none; }
.win--wfold .wsec__note { font: 400 13px/1.35 var(--w-sans); color: var(--vast-700); }
.win--wfold .folder__grid { background: none; padding: 8px 8px 10px; }
.win--wfold .folder__grid .icon { border-radius: var(--w-r-md); transition: background-color var(--w-base) var(--w-ease); }
.win--wfold .folder__grid .icon:hover { background: var(--sand-500); }
.win--wfold .folder__grid .icon__label { font: 500 13px/1.25 var(--w-sans); color: var(--vast-950); background: none; }
.win--wfold .icon.is-selected .icon__label { background: var(--sand-600); color: var(--vast-950); }
.win--wfold .wsec-row .wsec { display: flex; flex-direction: column; }
.win--wfold .wsec-row .folder__grid { margin-top: auto; }
/* the hover card for a Wispr item: the Flow app's popover (white, 12px radius, Figtree), not the desktop's Platinum */
body:has(.win--wfold [aria-describedby="icard"]) .icard { grid-template-columns: 48px minmax(0, 1fr); gap: 10px 12px; padding: 14px; border: 1px solid var(--sand-600); border-radius: var(--w-r-lg); background: var(--w-card); color: var(--vast-950); box-shadow: var(--w-shadow-lg); font: 400 13px/1.45 var(--w-sans); transition: opacity var(--w-base) var(--w-ease), transform var(--w-base) var(--w-ease); }
body:has(.win--wfold [aria-describedby="icard"]) .icard__pic.is-icon { width: 48px; height: 48px; padding: 0; border: 0; background: none; image-rendering: auto; }
body:has(.win--wfold [aria-describedby="icard"]) .icard__t { font: 600 14px/1.3 var(--w-sans); }
body:has(.win--wfold [aria-describedby="icard"]) .icard__what { color: var(--vast-950); }
body:has(.win--wfold [aria-describedby="icard"]) .icard__why { font-size: 12px; color: var(--vast-700); }
body:has(.win--wfold [aria-describedby="icard"]) .icard__where { padding-top: 10px; border-top: 1px solid var(--sand-600); font: 500 12px/1.3 var(--w-sans); color: var(--vast-600); }
.win--wfold .wsec__more { font: 400 13px/1.35 var(--w-sans); color: var(--vast-700); }
`;
function ensureKit() {
  if (document.getElementById('wispr-kit-css')) return;
  const link = (id, href) => Object.assign(document.createElement('link'), { id, rel: 'stylesheet', href });
  document.head.append(link('wispr-kit-css', at('wispr-kit/wispr.css')), link('wispr-kit-fonts', KIT_FONTS),
    Object.assign(document.createElement('style'), { id: 'wispr-folder-css', textContent: APP_CSS }),
    Object.assign(document.createElement('script'), { id: 'wispr-status-js', src: at('wispr-kit/status.js') }));
}

// still(): false (the guide that asked was skipped meanwhile) and it stays shut
export async function openWisprFolder(wm, { still = () => true } = {}) {
  const was = wm.get('folder-wispr');
  if (was) { was.focus(); return; }
  if (!still()) return;
  ensureKit();
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
