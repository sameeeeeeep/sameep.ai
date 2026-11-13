// look.js: the pictures. Every agent is a named cat, every person a face (illustrated, for the sample brands) or
// initials, and work carries a product shot of the brand it belongs to. Pure: names in, html out.
//
//   catOf(agentName)        { name, coat, src, role } (the Chief of staff is Miso, the Finance agent is Paisa ...)
//   brandOf(ws)             'ohra' | 'ondri' | 'siro' | null  (only the public sample brands carry pictures)
//   faceSrc(ws, personName) the face picture's path, or null (then initials)
//   productSrc(ws, fn)      a product shot for a function's work, or null
//   cat(agentName, size)    <img> of the cat     face(ws, name, size)  <img> or initials     shot(ws, fn)  <img>
import { html, raw, esc } from './ui.js';

const A = './assets';
// sixteen agents, five coats; a name each, the way you would name a cat
const CATS = {
  'Chief of staff': ['Miso', 'siamese'], 'Finance agent': ['Paisa', 'black'], 'Ops agent': ['Dabba', 'orange'],
  'Brand agent': ['Kesar', 'calico'], 'NPD agent': ['Pixel', 'grey'], 'Packaging agent': ['Tofu', 'siamese'],
  'Procurement agent': ['Bunty', 'orange'], 'Support agent': ['Mishti', 'calico'], 'Performance agent': ['Turbo', 'black'],
  'QC agent': ['Chai', 'grey'], 'Channels agent': ['Momo', 'orange'], 'Website agent': ['Biscuit', 'calico'],
  'Influencer agent': ['Gigi', 'siamese'], 'Content agent': ['Inky', 'black'], 'CRM agent': ['Pista', 'grey'],
  'People agent': ['Kulfi', 'calico'],
};
const COATS = ['black', 'calico', 'grey', 'orange', 'siamese'];
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function catOf(agent) {
  const a = String(agent || 'Chief of staff');
  const k = CATS[a] || CATS[Object.keys(CATS).find((n) => n.toLowerCase() === a.toLowerCase())];
  const coat = k ? k[1] : COATS[hash(a) % COATS.length];
  const role = a === 'Chief of staff' ? 'Chief of staff' : a.replace(/\s*agent$/i, '');
  return { name: k ? k[0] : role, coat, role, src: `${A}/cats/${coat}.webp` };
}

const BRANDS = new Set(['ohra', 'ondri', 'siro']);
export const brandOf = (ws) => { const n = String(ws?.name || '').trim().toLowerCase(); return ws?.demo !== false && BRANDS.has(n) ? n : null; };

const FACES = new Set(['ohra-aditi', 'ohra-agency', 'ohra-arjun', 'ohra-customer', 'ohra-kavya', 'ohra-naina', 'ohra-tanvi', 'ohra-vikram',
  'ondri-agency', 'ondri-customer', 'ondri-ira', 'ondri-kavya', 'ondri-meher', 'ondri-rohan', 'ondri-tara', 'ondri-zoya',
  'siro-agency', 'siro-customer', 'siro-farhan', 'siro-leela', 'siro-meera', 'siro-nikhil', 'siro-pooja', 'siro-varun']);
export function faceSrc(ws, name) {
  const b = brandOf(ws);
  const first = String(name || '').trim().split(/\s+/)[0].toLowerCase();
  return b && FACES.has(`${b}-${first}`) ? `${A}/faces/${b}-${first}.webp` : null;
}

// which product shot fits a function's work
const SHOT = { procurement: 'carton_top', packaging: 'box_flat', npd: 'trials5', brand: 'variants3', warehouse: 'carton_top',
  logistics: 'parcel', support: 'hero_boxed', performance: 'hero', quality: 'qc', qc: 'qc', influencer: 'hero', content: 'variants3',
  website: 'hero', channels: 'hero_boxed', crm: 'hero_boxed', launch: 'hero', kit: 'kit_flatlay' };
export function productSrc(ws, fn) {
  const b = brandOf(ws), k = SHOT[fn];
  return b && k ? `${A}/products/${b}/${k}.webp` : null;
}

export const initials = (name) => String(name || '?').replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
const px = (n) => raw(`style="--sz:${Number(n) || 40}px"`);

export const cat = (agent, size = 40) => { const c = catOf(agent); return html`<span class="lk-av is-cat" ${px(size)}><img src="${c.src}" alt="" loading="lazy"></span>`; };
export function face(ws, name, size = 40) {
  const src = faceSrc(ws, name);
  return src ? html`<span class="lk-av" ${px(size)}><img src="${src}" alt="" loading="lazy"></span>` : html`<span class="lk-av is-init" ${px(size)} aria-hidden="true">${initials(name)}</span>`;
}
// an actor from the feed: an agent is its cat, a person is a face
export const who = (ws, name, agent, size = 40) => (agent ? cat(name, size) : face(ws, name, size));
export const shot = (ws, fn, cls = '') => { const s = productSrc(ws, fn); return s ? html`<img class="lk-shot ${cls}" src="${s}" alt="" loading="lazy">` : ''; };
// a cat's display name with its job, "Paisa, Finance"
export const catLabel = (agent) => { const c = catOf(agent); return c.name === c.role ? c.name : `${c.name}`; };
export { esc };
