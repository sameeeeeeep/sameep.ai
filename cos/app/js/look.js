// look.js: the pictures. Every agent is its plain name with a monogram mark, every person a face (illustrated, for the sample brands) or
// initials, and work carries a product shot of the brand it belongs to. Pure: names in, html out.
//
//   agentOf(agentName)      { name, role, mark } (a plain named role and its monogram)
//   brandOf(ws)             'ohra' | 'ondri' | 'siro' | null  (only the public sample brands carry pictures)
//   faceSrc(ws, personName) the face picture's path, or null (then initials)
//   productSrc(ws, fn)      a product shot for a function's work, or null
//   mark(agentName, size)   the agent's monogram     face(ws, name, size)  <img> or initials     shot(ws, fn)  <img>
import { html, raw, esc } from './ui.js';

const A = './assets';
// the workspace in view (js/app.js sets it on every route), for the shared pieces that do not get a ctx
let cur = null;
export const useWs = (ws) => { cur = ws || null; };
export const curWs = () => cur;
// Agents are plain named roles ("Ops agent", "Finance agent", "Chief of staff") with a neutral monogram mark.
// agentOf(agentName) -> { name: 'Ops agent', role: 'Ops', mark: 'O' }
export function agentOf(agent) {
  const name = String(agent || 'Chief of staff').trim() || 'Chief of staff';
  const role = /^chief of staff$/i.test(name) ? 'Chief of staff' : name.replace(/\s*agent$/i, '');
  const words = role.split(/\s+/).filter((w) => w && !/^(of|and|the)$/i.test(w));
  const mark = /^[A-Z]{2,}$/.test(role) ? role.slice(0, 3) : words.slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  return { name, role, mark: mark || 'A' };
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

export const mark = (agent, size = 40) => html`<span class="lk-av is-agent" ${px(size)} title="${agentOf(agent).name}" aria-hidden="true">${agentOf(agent).mark}</span>`;
export function face(ws, name, size = 40) {
  const src = faceSrc(ws, name);
  return src ? html`<span class="lk-av" ${px(size)}><img src="${src}" alt="" loading="lazy"></span>` : html`<span class="lk-av is-init" ${px(size)} aria-hidden="true">${initials(name)}</span>`;
}
// an actor from the feed: an agent is its mark, a person is a face
export const who = (ws, name, agent, size = 40) => (agent ? mark(name, size) : face(ws, name, size));
export const shot = (ws, fn, cls = '') => { const s = productSrc(ws, fn); return s ? html`<img class="lk-shot ${cls}" src="${s}" alt="" loading="lazy">` : ''; };
// an agent by its name in plain type, its mark a small badge beside it
export const agentTag = (agent, size = 18) => html`<span class="lk-tag">${mark(agent, size)}<b>${agentOf(agent).name}</b></span>`;
export { esc };
