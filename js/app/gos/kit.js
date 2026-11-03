// gos/kit.js — the shared parts every Growth OS module is built from (growthos.js uses them too).
// A module is { id, label, c, group, render(m, { go }) } and returns DOM nodes; its words come from the
// Worker (D.MORE.<key>, after sign-in), never from this public JS. Styles: css/gos-<file>.css, loaded on open.
import { h } from '../util.js';
import { sound } from '../audio.js';
import * as D from '../growthos-data.js';

export { h, sound, D };

// links from the plan data: http(s) only
export const safeHttp = (u) => (/^https?:\/\//i.test(String(u || '')) ? u : '#');
const TONES = { '#2f6fd6': 'var(--pulse)', '#e0b400': 'var(--glow)' };
export const tone = (c) => TONES[c] || c;
export const fmtD = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const days = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);
export const TODAY = new Date().toISOString().slice(0, 10);

export const tag = (t, kind = t) => h('span.tag.tag--' + String(kind).toLowerCase().replace(/\s+/g, '-'), t);
// every made-up number wears this
export const sample = (t = 'Sample') => h('span.tag.tag--sample', { title: 'Made-up number to show the layout. Real numbers need Wispr data.' }, t);
export const gbox = (label, ...kids) => h('section.gbox', h('h3.gbox__label', label), ...kids);
export const gboxW = (label, ...kids) => h('section.gbox.gbox--white', h('h3.gbox__label', label), ...kids);
export const ul = (items) => h('ul.ul', (items || []).map((t) => h('li', rich(t))));

// "text [3]" → text + a link to source 3
export function rich(t) {
  if (t == null) return null;
  const parts = String(t).split(/(\[\d+(?:,\s*\d+)*\])/g);
  return parts.map((p) => {
    const m = p.match(/^\[(\d+(?:,\s*\d+)*)\]$/);
    if (!m) return p;
    return m[1].split(/,\s*/).map((n) => { const s = (D.SOURCES || []).find((x) => String(x.id) === n); return h('a.src', { href: safeHttp(s?.url), target: '_blank', rel: 'noopener', title: s?.t || 'Source ' + n }, '[' + n + ']'); });
  });
}
export function secondOrder(so) {
  if (!so) return null;
  return h('div.so',
    h('div.so__cell', h('p.so__k', 'What it causes'), h('p.so__v', rich(so.causes))),
    h('div.so__cell.so__cell--back', h('p.so__k', 'Could backfire'), h('p.so__v', rich(so.backfire))),
    h('div.so__cell.so__cell--comp', h('p.so__k', 'How it compounds'), h('p.so__v', rich(so.compounds))),
    h('div.so__cell.so__cell--kill', h('p.so__k', 'Kill it if'), h('p.so__v', rich(so.kill))));
}
export function tabs(list, onPick, start = 0) {
  const pane = h('div.gtabpane');
  const btns = list.map((t, i) => h('button.gtab', { type: 'button', role: 'tab', 'aria-selected': String(i === start), onclick: () => pick(i) }, t));
  function pick(i) { btns.forEach((b, j) => b.setAttribute('aria-selected', String(i === j))); pane.replaceChildren(...[].concat(onPick(i))); sound.tick('click'); }
  pane.append(...[].concat(onPick(start)));
  return h('div', h('div.gtabs', { role: 'tablist' }, btns), pane);
}
export function select(value, options, onChange, label) {
  return h('select.sel', { 'aria-label': label, onchange: (e) => onChange(e.target.value) }, options.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o[0].toUpperCase() + o.slice(1)]; return h('option', { value: v, selected: v === value }, t); }));
}
export function copyBtn(getText, label = 'Copy') {
  const b = h('button.btn.btn--sm', { type: 'button', onclick: async () => { try { await navigator.clipboard.writeText(getText()); b.textContent = 'Copied'; } catch { b.textContent = 'Select and copy'; } setTimeout(() => (b.textContent = label), 1400); } }, label);
  return b;
}
export function download(name, text, type = 'text/csv') {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
export const csv = (rows) => rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
export const head = (m, why, ...tools) => h('header.gos__head', { style: { '--c': m.c } },
  h('div', h('p.gos__kicker', m.kicker || 'Growth OS'), h('h2.gos__title', m.label), why && h('p.gos__why', rich(why))),
  tools.length ? h('div.gos__tools', tools) : null);

// per-module state on this device: const st = store('ideas', { saved: [] }); st.v.saved.push(x); st.save();
export function store(ns, init = {}) {
  const key = 'wgos.' + ns;
  let v = init;
  try { v = { ...init, ...JSON.parse(localStorage.getItem(key) || '{}') }; } catch { /* corrupt or blocked: start fresh */ }
  return { v, save() { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode: this visit only */ } }, reset() { v = { ...init }; try { localStorage.removeItem(key); } catch { /* ignore */ } return v; } };
}

// a display picture: the public photo if there is one, else initials on a Wispr colour (never a broken image)
const AV_TONES = ['#f0d7ff', '#ffbcf2', '#ffa946', '#cfe8dc', '#e4e4d0', '#ffd9cf'];
export function initials(name) { return String(name || '?').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'; }
export function avatar({ name, photo, size = 36 } = {}) {
  const n = [...String(name || '')].reduce((a, ch) => a + ch.codePointAt(0), 0);
  const box = h('span.gav', { style: { '--s': size + 'px', '--bg': AV_TONES[n % AV_TONES.length] }, 'aria-hidden': 'true' }, h('span.gav__i', initials(name)));
  const src = safeHttp(photo);
  if (src !== '#') {
    const img = h('img.gav__img', { src, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', width: size, height: size, onerror: () => img.remove() });
    box.append(img);
  }
  return box;
}

// art made for the plan lives in site/growth-os/art/<id>.webp; until it exists, a calm placeholder
export function art(id, alt = '', { ratio = '4/3' } = {}) {
  const fig = h('figure.gart', { style: { aspectRatio: ratio } }, h('span.gart__ph', alt || id));
  const img = h('img.gart__img', { src: new URL(`../../../growth-os/art/${id}.webp`, import.meta.url).href, alt, loading: 'lazy', onload: () => fig.classList.add('is-in'), onerror: () => img.remove() });
  fig.prepend(img);
  return fig;
}

// module styles: css/gos-<name>.css, added once when the window opens
export function loadCss(name) {
  const id = 'gos-css-' + name;
  if (document.getElementById(id)) return;
  document.head.append(h('link', { id, rel: 'stylesheet', href: new URL(`../../../css/gos-${name}.css`, import.meta.url).href }));
}
