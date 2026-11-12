// ui.js: tiny, DOM-free helpers every page uses. Shared and frozen (owned by Design).
// html`...` escapes every interpolation unless it is wrapped in raw() or is the result of another html``.

class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Safe(String(s));
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const part = (v) => (v instanceof Safe ? v.s : Array.isArray(v) ? v.map(part).join('') : v === false || v == null ? '' : esc(v));
export function html(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => { out += part(v) + strings[i + 1]; });
  return new Safe(out);
}

// money: sample shop data is INR paise; billing is whole US dollars
export const inr = (paise) => '₹' + Math.round((paise || 0) / 100).toLocaleString('en-IN');
export const usd = (n) => '$' + Number(n || 0).toLocaleString('en-US');
export const num = (n) => Number(n || 0).toLocaleString('en-IN');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// '2026-11-12' or ms -> '12 Nov 2026'
export function day(v) {
  const d = typeof v === 'number' ? new Date(v) : new Date(String(v) + 'T00:00:00Z');
  return Number.isNaN(d.getTime()) ? '' : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
// ms -> 'just now' / '5 min ago' / '3 h ago' / '12 Nov 2026'
export function ago(ms, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return day(ms);
}

// the draft -> approved -> checked vocabulary, shown the same on every page
export const STATUS = {
  draft: 'Draft', pending: 'Waiting for a tap', awaiting_check: 'Needs a second check', approved: 'Approved',
  checked: 'Checked', rejected: 'Rejected', connected: 'Connected', not_connected: 'Not connected', error: 'Needs attention',
  paid: 'Paid', due: 'Due', upcoming: 'Upcoming',
};
export const pill = (status) => html`<span class="pill-s is-${status}">${STATUS[status] || status}</span>`;

// the label every demo surface carries
export const SAMPLE = 'Sample data';
export const sampleTag = (ws) => (ws?.demo ? html`<span class="sample-tag">${SAMPLE}</span>` : '');

export const ROLE_NAMES = { owner: 'Owner', admin: 'Admin', member: 'Member', viewer: 'Viewer' };
export const can = (role, min) => ({ viewer: 1, member: 2, admin: 3, owner: 4 }[role] || 0) >= ({ viewer: 1, member: 2, admin: 3, owner: 4 }[min]);
