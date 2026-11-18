// coco.js — Coco on the desktop: what it is, a way to see it (sameep.ai/coco), and the waitlist.
// The waitlist asks two quick taps (what you'd hand Coco first, who you are), then an email. Joining shows your own agent:
// a dot person drawn from your name (same name, same agent, every time). POST /api/waitlist (analytics/src/waitlist.js).
import { h } from './util.js';
import { sound } from './audio.js';
import { track } from '../analytics.js';

// same origin on sameep.ai; on localhost the Worker runs on :8790, or ?api=http://localhost:<port> (as clone.js)
const LOCAL = /^(localhost|127\.0\.0\.1)$/;
const override = new URLSearchParams(location.search).get('api') || '';
const API = (!LOCAL.test(location.hostname) ? ''
  : /^http:\/\/(localhost|127\.0\.0\.1):\d{1,5}$/.test(override) ? override : 'http://localhost:8790') + '/api/waitlist';

const PICKS = [['inbox', 'My inbox'], ['reorders', 'Reorders and stock'], ['hiring', 'Hiring'], ['launches', 'Launches'], ['content', 'Content'], ['other', 'Something else']];
const ROLES = [['founder', 'Founder'], ['team', 'On a team'], ['agency', 'An agency']];
const DONE_KEY = 'coco-waitlist';

export function openCoco(wm, { from = 'desktop', at } = {}) {
  const w = wm.win('coco', { title: 'Coco', width: 440, className: 'win--coco' });
  if (w.body.childElementCount) { w.focus(); if (at === 'form') w.body.querySelector('.coco__q')?.scrollIntoView({ block: 'nearest' }); return w; }
  track('coco_open', { from });
  const picks = new Set();
  let role = null;
  const chip = (label, on, onClick) => h('button.coco__chip', { type: 'button', 'aria-pressed': String(on), onclick: (e) => { onClick(); sound.tick('click'); sync(e.currentTarget.closest('.coco__chips')); } }, label);
  const pickRow = h('div.coco__chips', { role: 'group', 'aria-label': 'What would you hand Coco first?' },
    PICKS.map(([k, l]) => Object.assign(chip(l, false, () => (picks.has(k) ? picks.delete(k) : picks.add(k))), { _k: k })));
  const roleRow = h('div.coco__chips', { role: 'group', 'aria-label': 'You are' },
    ROLES.map(([k, l]) => Object.assign(chip(l, false, () => { role = role === k ? null : k; }), { _k: k })));
  const sync = (row) => row.querySelectorAll('.coco__chip').forEach((b) => b.setAttribute('aria-pressed', String(row === roleRow ? role === b._k : picks.has(b._k))));
  const email = h('input.coco__email', { type: 'email', name: 'email', autocomplete: 'email', inputmode: 'email', placeholder: 'you@yourbrand.com', 'aria-label': 'Your email', required: true });
  const trap = h('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true', style: 'position:absolute;left:-9999px;width:1px;height:1px' });
  const err = h('p.coco__err', { role: 'alert' });
  const send = h('button.coco__go', { type: 'submit' }, 'Join the waitlist');
  email.addEventListener('input', () => { err.textContent = ''; });
  const form = h('form.coco__form', { novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    const v = email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v)) { err.textContent = v ? 'That email doesn’t look right.' : 'Add your email first.'; email.focus(); return; }
    send.disabled = true; send.textContent = 'Joining…';
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: v, picks: [...picks], role, source: from === 'menu' ? 'desktop' : from, website: trap.value }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Couldn’t join just now. Try again in a minute.');
      track('coco_join', { from, role: role || 'none', n: picks.size });
      try { localStorage.setItem(DONE_KEY, v.split('@')[0]); } catch { /* storage blocked */ }
      sound.tick('pick');
      form.replaceWith(thanks(v.split('@')[0], d.already));
    } catch (x) {
      err.textContent = x.message || 'Couldn’t join just now. Try again in a minute.';
      send.disabled = false; send.textContent = 'Join the waitlist';
    }
  } },

  h('div.coco__row', email, send), trap, err);

  let joined = null;
  try { joined = localStorage.getItem(DONE_KEY); } catch { /* storage blocked */ }
  w.body.append(h('div.coco',
    h('p.coco__mark', { 'aria-label': 'Coco' }, 'coco'),
    panelReel(),
    h('p.coco__lede', 'Agents do the work. You just pick.'),
    h('a.coco__see', { href: 'coco/', target: '_blank', rel: 'noopener', onclick: () => track('link', { to: 'coco/' }) }, 'See the full demo ↗'),
    joined ? thanks(joined, true) : form));
  if (at === 'form') requestAnimationFrame(() => email.focus({ preventScroll: true }));
  return w;
}

// one short run of the panel at work, played once and left on its last frame: a message comes in, an agent turns it into
// a task and does it, the one call waits for you, a tap, done. Names and figures are made up (the public demo's).
function panelReel() {
  const face = (name) => { const c = h('canvas.coco__face', { width: 56, height: 56, 'aria-hidden': 'true' }); drawAgent(c, name); return c; };
  const msg = h('div.coco__r.is-msg', h('span.coco__src', 'WhatsApp · Tanvi'), h('span', 'Blush is at 40 units. Reorder?'));
  const task = h('div.coco__r.is-task', face('supplier'), h('span', h('b', 'Reorder blush · 500 units'), h('em.coco__work', 'Supplier agent is on it', h('i'), h('i'), h('i'))));
  const ok = h('span.coco__btn.is-go', 'Approve');
  const call = h('div.coco__r.is-call', h('span.coco__src', 'Your call'), h('b', 'PO to Kalpa Studios · ₹1.2L · ready Friday'), h('span.coco__acts', ok, h('span.coco__btn', 'Not now')));
  const done = h('div.coco__r.is-done', h('span', '✓ Sent. Kalpa confirmed Friday.'));
  const reel = h('div.coco__reel', { role: 'img', 'aria-label': 'A message comes in, an agent turns it into a task and does it, and you approve the one call' }, msg, task, call, done);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const T = reduce ? [0, 0, 0, 0, 0] : [300, 1500, 3300, 4600, 5200];
  const at = (ms, fn) => setTimeout(fn, ms);
  at(T[0], () => msg.classList.add('is-on'));
  at(T[1], () => task.classList.add('is-on'));
  at(T[2], () => { task.classList.add('is-did'); call.classList.add('is-on'); });
  at(T[3], () => ok.classList.add('is-tap'));
  at(T[4], () => { call.classList.add('is-did'); done.classList.add('is-on'); });
  return reel;
}

function thanks(name, already) {
  const cv = h('canvas.coco__agent', { width: 208, height: 208, 'aria-hidden': 'true' });
  drawAgent(cv, name);
  const who = pretty(name);
  return h('div.coco__done', { role: 'status' }, cv,
    h('div',
      h('p.coco__q', `${who}’s agent`),
      h('p.coco__sub', already ? 'You’re on the list. This is your agent; it’s saved.' : 'Your agent is saved. We’ll write when it’s your turn.')));
}

const pretty = (s) => { const t = String(s || 'you').split(/[._\-+\d]+/).filter(Boolean)[0] || 'Your'; return t[0].toUpperCase() + t.slice(1).toLowerCase(); };

// ---------------------------------------------------------------- a dot person from a name (13 × 13)
const N = 13;
const d = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / (ry || rx)) ** 2 <= 1;
const sh = (x, y) => y >= 9 && d(x, y, 6, 13.2, 5.8, 4.6);
const hd = (x, y) => d(x, y, 6, 4.6, 2.8);
const HAIR = {
  bob: (x, y) => (d(x, y, 6, 5, 2.4, 2.7) && y >= 3.6 ? 'S' : d(x, y, 6, 4.6, 4.1, 3.9) && y <= 7 ? 'H' : 0),
  short: (x, y) => (hd(x, y) ? (y <= 2 ? 'H' : 'S') : 0),
  curls: (x, y) => (d(x, y, 6, 5, 2.2, 2.4) && y >= 3.5 ? 'S' : d(x, y, 6, 4.2, 4.6, 4) && y <= 7 ? 'H' : 0),
  long: (x, y) => (hd(x, y) ? (y < 3 ? 'H' : 'S') : y >= 3 && y <= 9 && [2, 3, 9, 10].includes(x) ? 'H' : 0),
  bun: (x, y) => (hd(x, y) ? (y <= 2 ? 'H' : 'S') : d(x, y, 6, 0.6, 1.4) ? 'H' : 0),
  buzz: (x, y) => (hd(x, y) ? (y <= 1.9 ? 'H' : 'S') : 0),
};
const ACC = {
  none: () => 0,
  glasses: (x, y) => (y === 5 && [4, 6, 8].includes(x) ? 'A' : 0),
  headset: (x, y) => { const r = Math.hypot(x - 6, y - 4.6); if (y <= 4 && r > 3.3 && r < 4.4) return 'A'; if ([2, 10].includes(x) && (y === 4 || y === 5)) return 'A'; return y === 7 && (x === 8 || x === 9) ? 'A' : 0; },
  earring: (x, y) => ((x === 3 || x === 9) && y === 7 ? 'A' : 0),
};
const SK = ['#f1c9a5', '#e0ac83', '#c68a5e', '#9a6440', '#6e4528'];
const HC = ['#1d1a17', '#4a2e1e', '#8a4b2a', '#c9a14a', '#b84a3a', '#5e6ad2', '#d46a9a', '#e9e4d8'];
const CL = ['#e9a03b', '#3f8f7a', '#d85a30', '#5e6ad2', '#c2b8a3', '#d4537e', '#7f77dd'];
const AC = ['#f4f1ea', '#e9a03b', '#9fe1cb'];
function hash(s) { let x = 2166136261; for (const c of String(s).toLowerCase()) x = Math.imul(x ^ c.charCodeAt(0), 16777619); return x >>> 0; }
export function drawAgent(cv, name) {
  let x0 = hash(name);
  const p = (a) => { const v = a[x0 % a.length]; x0 = Math.imul(x0 ^ (x0 >>> 13), 2654435761) >>> 0; return v; };
  const hair = p(Object.keys(HAIR)), acc = p(['none', 'none', 'glasses', 'headset', 'earring']);
  const col = { S: p(SK), H: p(HC), C: p(CL), A: p(AC), E: '#141414' };
  const g = cv.getContext('2d'), s = cv.width, st = s / N, R = st * 0.38;
  g.fillStyle = '#0b0b0b'; g.fillRect(0, 0, s, s);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let r = ACC[acc](x, y) || HAIR[hair](x, y) || (sh(x, y) ? 'C' : 0);
    if (r === 'S' && y === 5 && (x === 5 || x === 7)) r = 'E';
    g.fillStyle = r ? col[r] : '#222';
    g.beginPath(); g.arc(x * st + st / 2, y * st + st / 2, r && r !== 'E' ? R : R * 0.55, 0, 7); g.fill();
  }
}
