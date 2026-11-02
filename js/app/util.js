// util.js — tiny helpers shared by the app.
export const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const raf = () => new Promise((r) => requestAnimationFrame(r));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isNarrow = () => matchMedia('(max-width: 760px)').matches;

// h('div.class#id', {attrs}, ...children) — small DOM builder; strings become text nodes.
export function h(sel, attrs, ...kids) {
  const m = sel.match(/^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i);
  const el = document.createElement((m && m[1]) || 'div');
  if (m && m[2]) m[2].replace(/([.#])([\w-]+)/g, (_, t, n) => (t === '.' ? el.classList.add(n) : (el.id = n)));
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'style' && typeof v === 'object') for (const [p, x] of Object.entries(v)) { if (p.startsWith('--')) el.style.setProperty(p, x); else el.style[p] = x; }
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k in el && k !== 'list' && k !== 'type' && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

// Only allow http(s) and relative URLs (persona bundles come from anywhere).
export function safeUrl(u, base = location.href) {
  if (!u || typeof u !== 'string') return null;
  try {
    const url = new URL(u, base);
    return ['https:', 'http:', 'blob:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function fillName(str, name) {
  if (!str) return str;
  return String(str).replace(/\{(name|visitor)\}/g, name || 'you');
}

export function words(str) { return (String(str || '').match(/\S+/g) || []).length; }
