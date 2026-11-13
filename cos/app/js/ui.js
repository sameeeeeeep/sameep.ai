// ui.js: tiny, DOM-free helpers every page uses (brandcos product).
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

// An outside link from API data, for href: only absolute http(s) URLs pass; anything else (javascript:, data:, a
// relative path, a protocol-relative //host) gives null, so the caller renders no link at all.
export function safeHref(v) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!/^https?:\/\//i.test(s)) return null;
  try { const u = new URL(s); return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname ? u.href : null; } catch { return null; }
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

// A sparkline: values -> inline SVG polyline in a 76 x 26 box, last point marked. Fewer than 2 values -> ''.
export function spark(values, label = '') {
  const v = (values || []).map(Number).filter((n) => Number.isFinite(n));
  if (v.length < 2) return '';
  const W = 76, H = 26, lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
  const pts = v.map((n, i) => [+(i * (W / (v.length - 1))).toFixed(1), +(H - 2 - ((n - lo) / span) * (H - 4)).toFixed(1)]);
  const d = 'M' + pts.map((p) => p.join(' ')).join(' L');
  const [lx, ly] = pts[pts.length - 1];
  return html`<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label || 'Trend'}"><path d="${d}"></path><circle cx="${lx}" cy="${ly}" r="2"></circle></svg>`;
}

// Rail icons (stroke icons, 24 x 24). Decorative: every link also carries its name.
const I = (d) => raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`);
export const ICONS = {
  dash: I('<rect x="3.5" y="3.5" width="7.5" height="10" rx="2"/><rect x="13" y="3.5" width="7.5" height="6" rx="2"/><rect x="13" y="11.5" width="7.5" height="9" rx="2"/><rect x="3.5" y="15.5" width="7.5" height="5" rx="2"/>'),
  agents: I('<rect x="6" y="6" width="12" height="12" rx="2.5"/><path d="M10 2.5v3M14 2.5v3M10 18.5v3M14 18.5v3M2.5 10h3M2.5 14h3M18.5 10h3M18.5 14h3"/>'),
  more: I('<circle cx="5.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.5" cy="12" r="1.4"/>'),
  feed: I('<path d="M4 6h16M4 12h10M4 18h13"/><circle cx="19" cy="12" r="1.5"/>'),
  products: I('<path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>'),
  chat: I('<path d="M20 12a7.5 7.5 0 0 1-11 6.6L4 20l1-4.3A7.5 7.5 0 1 1 20 12z"/>'),
  today: I('<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>'),
  chats: I('<path d="M20 12.5a7.5 7.5 0 0 1-11 6.6L4 20l1-4.3A7.5 7.5 0 1 1 20 12.5z"/><path d="m9 12.5 2 2 4-4"/>'),
  hub: I('<path d="M9 3v5M15 3v5"/><path d="M6 8h12v3a6 6 0 0 1-12 0V8z"/><path d="M12 17v4"/>'),
  os: I('<path d="m12 3 8.5 4.5L12 12 3.5 7.5 12 3z"/><path d="m3.5 12 8.5 4.5 8.5-4.5"/><path d="m3.5 16.5 8.5 4.5 8.5-4.5"/>'),
  team: I('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6"/>'),
  billing: I('<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>'),
  company: I('<rect x="3.5" y="3.5" width="6" height="6" rx="1.5"/><rect x="14.5" y="3.5" width="6" height="6" rx="1.5"/><rect x="9" y="14.5" width="6" height="6" rx="1.5"/><path d="M6.5 9.5v2.5h11V9.5M12 12v2.5"/>'),
  inbox: I('<path d="M3.5 13.5 6 5.5h12l2.5 8"/><path d="M3.5 13.5V18a1.5 1.5 0 0 0 1.5 1.5h14a1.5 1.5 0 0 0 1.5-1.5v-4.5H15a3 3 0 0 1-6 0H3.5z"/>'),
  standup: I('<path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/>'),
  hiring: I('<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20a6.5 6.5 0 0 1 13 0"/><path d="M19 8v6M16 11h6"/>'),
};
