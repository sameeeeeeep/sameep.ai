// api.js: the one way pages talk to the Worker. Shared and frozen (owned by Design).
// Base: same origin /d2c-api. When this page itself runs on localhost, ?api=http://localhost:8787 points it
// at a local Worker (remembered on this device, so a magic link back to the page keeps working). Any other
// ?api value, or any ?api on a non-local page, is ignored.
// Nothing here touches the DOM at import time, so Node can import it for tests.

const LOCAL = new Set(['localhost', '127.0.0.1', '[::1]']);
const TOKEN_KEY = 'd2c.session', API_KEY = 'd2c.api';
const store = {
  get: (k) => { try { return globalThis.localStorage?.getItem(k) ?? null; } catch { return null; } },
  set: (k, v) => { try { v == null ? globalThis.localStorage?.removeItem(k) : globalThis.localStorage?.setItem(k, v); } catch { /* private mode: this visit only */ } },
};

// Pure: where the API lives for a page at `loc` ({hostname, search}), given a remembered override.
export function resolveBase(loc, remembered = null) {
  if (!LOCAL.has(loc.hostname)) return '/d2c-api';
  const asked = new URLSearchParams(loc.search || '').get('api') || remembered;
  if (asked) {
    try { const u = new URL(asked); if (LOCAL.has(u.hostname) && /^https?:$/.test(u.protocol)) return u.origin + '/d2c-api'; } catch { /* ignore */ }
  }
  return '/d2c-api';
}

let base = null;
export function apiBase() {
  if (base) return base;
  const loc = globalThis.location || { hostname: 'sameep.ai', search: '' };
  const q = new URLSearchParams(loc.search || '').get('api');
  base = resolveBase(loc, store.get(API_KEY));
  if (q && base !== '/d2c-api') store.set(API_KEY, q);
  return base;
}

export const token = { get: () => store.get(TOKEN_KEY), set: (t) => store.set(TOKEN_KEY, t || null) };

export class ApiError extends Error {
  constructor(status, message, data) { super(message); this.status = status; this.data = data; }
}

// api('GET', '/me') / api('POST', `/w/${wid}/team`, {email, name, role}) -> parsed JSON, or throws ApiError.
// A 401 clears the session and fires 'd2c:signedout' on window, which the shell answers with the sign-in screen.
export async function api(method, path, body) {
  const t = token.get();
  let res;
  try {
    res = await fetch(apiBase() + path, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(t ? { authorization: `Bearer ${t}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Can’t reach the server. Check your connection and try again.');
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (res.status === 401 && t) { token.set(null); globalThis.dispatchEvent?.(new Event('d2c:signedout')); }
  if (!res.ok) throw new ApiError(res.status, data?.error || `Request failed (${res.status}).`, data);
  return data;
}
