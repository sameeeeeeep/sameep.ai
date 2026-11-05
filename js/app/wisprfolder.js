// wisprfolder.js — the Wispr folder: what I made for Wispr, in one place. Growth OS opens in its own tab
// (growth-os/ has its own team sign-in), then the Wispr product prototypes (Wrapped, the voice editor, Guru).
// Each icon has a hover card (data-card="wispr-<id>", copy in js/app/cards.js). A prototype whose
// page isn't up yet shows as "building" instead of a dead link; the check runs each time the folder opens,
// so its icon goes live the moment the page ships.
import { h } from './util.js';
import { sound } from './audio.js';

const at = (p) => new URL('../../' + p, import.meta.url).href;
export const WISPR = {
  id: 'wispr', label: 'Wispr',
  card: { what: 'What I made for Wispr', proof: 'A growth plan for your team, then Wispr product prototypes' },
  items: [
    { id: 'growthos', label: 'Wispr Growth OS', icon: at('growth-os/icon.svg'), url: at('growth-os/?version=wispr') },
    { id: 'wrapped', label: 'Wispr Wrapped', url: at('wispr-wrapped/'), probe: true },
    { id: 'wispreditor', label: 'Voice Editor', url: at('wispr-editor/'), probe: true },
    { id: 'guru', label: 'Wispr Guru', url: at('wispr-guru/'), probe: true },
  ],
};

// is the page there yet? (a 404 from Pages means not shipped)
const live = (u) => fetch(u, { method: 'HEAD', cache: 'no-store' }).then((r) => r.ok, () => false);

// still(): checked after the probes; false (the guide that asked was skipped meanwhile) and it stays shut
export async function openWisprFolder(wm, { still = () => true } = {}) {
  const was = wm.get('folder-wispr');
  if (was) { was.focus(); return; }
  const up = await Promise.all(WISPR.items.map((g) => (g.probe ? live(g.url) : true)));
  if (!still()) return;
  const area = document.querySelector('.desk__area')?.getBoundingClientRect();
  const n = document.querySelectorAll('.win--folder:not([hidden])').length;
  const w = wm.win('folder-wispr', { title: WISPR.label, width: 420, className: 'win--folder', ...(area ? { x: (area.width - 420) / 2 - 48 + n * 26, y: 48 + n * 26 } : {}) });
  if (w.body.childElementCount) return;
  const img = (g, off) => h('img', { src: g.icon || `img/ui/proj-${g.id}.svg`, alt: '', width: 48, height: 48, draggable: 'false', style: off ? { filter: 'grayscale(1)', opacity: '.5' } : null });
  const building = up.filter((x) => !x).length;
  w.body.append(h('p.folder__bar', `${WISPR.items.length} items · ` + (building ? `${building} still being built` : 'each opens in a new tab')),
    h('ul.folder__grid', WISPR.items.map((g, i) => h('li', up[i]
      ? h('a.icon.icon--file', { href: g.url, target: '_blank', rel: 'noopener', dataset: { card: 'wispr-' + g.id }, onclick: () => sound.tick('click') }, img(g), h('span.icon__label', g.label))
      : h('button.icon.icon--file', { type: 'button', dataset: { card: 'wispr-' + g.id }, 'aria-label': `${g.label}, still being built`, onclick: () => { sound.tick('click'); wm.alert({ icon: 'img/ui/note.svg', title: g.label, message: 'Still being built. It opens here the moment it’s done.', buttons: [{ label: 'OK', primary: true }] }); } },
        img(g, true), h('span.icon__label', g.label),
        h('span', { style: { font: '600 10px/1.4 var(--f-ui)', padding: '0 5px', background: '#ffd23f', color: '#111', borderRadius: '2px' } }, 'Building…'))))));
}
