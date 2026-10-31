// demos.js — retro windows that show live work next to the podcast:
// iframes, a ppt.live QR, images, video and plain links. Every one has an
// "open in new tab" escape hatch in case a site refuses to be framed.
import { h, safeUrl, isNarrow } from './util.js';
import { qrcode } from '../../vendor/qrcode.mjs';
import { gallery } from './work.js';

const needsName = (u) => /\{name\}/.test(u) || /diwaliparty\.live/.test(u);

export function fillUrl(u, name) {
  const hour = String(new Date().getHours());
  let out = String(u).replace(/\{hour\}/g, hour).replace(/\{name\}/g, encodeURIComponent(name || ''));
  if (/diwaliparty\.live/.test(out) && name) {
    if (/[?&]name=(?=&|$)/.test(out)) out = out.replace(/([?&]name=)(?=&|$)/, '$1' + encodeURIComponent(name));
    else if (!/[?&]name=/.test(out)) out += (out.includes('?') ? '&' : '?') + 'name=' + encodeURIComponent(name);
  }
  return out;
}

export function qrSVG(text, { dark = '#111', light = '#fff' } = {}) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  const n = q.getModuleCount();
  const m = 2;
  let path = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) path += `M${c + m} ${r + m}h1v1h-1z`;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${n + m * 2} ${n + m * 2}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'QR code for ' + text);
  const bg = document.createElementNS(ns, 'rect');
  bg.setAttribute('width', '100%'); bg.setAttribute('height', '100%'); bg.setAttribute('fill', light);
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', path); p.setAttribute('fill', dark);
  svg.append(bg, p);
  return svg;
}

// "Should I open this for you?" — link demos ask instead of hijacking the tab.
export function linkDialog(wm, { url, title, onOpen, extra }) {
  const w = wm.win('link', { title: 'Open link', width: 420, className: 'win--alert win--link', center: true, sheet: false });
  const field = h('input.field.link__url', { type: 'text', readonly: true, value: url, 'aria-label': 'Link address', onfocus: (e) => e.target.select() });
  const copy = h('button.btn.btn--sm', { type: 'button', onclick: async () => {
    try { await navigator.clipboard.writeText(url); copy.textContent = 'Copied'; } catch { field.select(); copy.textContent = 'Press ⌘C'; }
    setTimeout(() => (copy.textContent = 'Copy'), 1600);
  } }, 'Copy');
  w.body.replaceChildren(
    h('div.alert', h('img.alert__icon', { src: 'img/ui/note.svg', alt: '', width: 48, height: 48 }),
      h('div', h('p.alert__msg', 'Should I open this for you in a new tab?'), h('p.small.link__title', title))),
    h('div.row', field, copy),
    h('div.alert__btns',
      h('button.btn', { type: 'button', onclick: () => w.close() }, 'Not now'),
      extra && h('button.btn', { type: 'button', onclick: () => { w.close(); extra.run(); } }, extra.label),
      h('a.btn.btn--primary', { href: url, target: '_blank', rel: 'noopener', onclick: () => { setTimeout(() => w.close(), 50); onOpen?.(); } }, 'Open it ↗')));
  return w;
}

// ctx: { wm, getName(), askName(), anchor() → {x,y} }
export async function openDemo(demo, ctx) {
  if (!demo) return null;
  const type = demo.type || 'link';
  const srcs = [].concat(demo.urls || demo.shots || demo.images || []).filter(Boolean);
  if (!demo.url && !srcs.length) return null;
  let name = ctx.getName?.();
  if (type === 'iframe' && needsName(demo.url) && !name) name = await ctx.askName?.('Your invite needs a name. What should it say?');
  const url = demo.url ? safeUrl(fillUrl(demo.url, name)) : null;
  const gal = srcs.map((u) => safeUrl(u)).filter(Boolean);
  if (!url && !gal.length) return null;
  const host = url ? new URL(url).hostname.replace(/^www\./, '') : '';
  const title = demo.title || host || 'Demo';

  if (type === 'link') return linkDialog(ctx.wm, { url, title });

  const link = safeUrl(demo.link || demo.url || '');
  const newTab = link ? h('a.win__tab', { href: link, target: '_blank', rel: 'noopener', title: 'Open in a new tab' }, 'Open ↗') : null;
  const big = type === 'iframe' || type === 'video' || type === 'mockup' || type === 'gallery';
  const pos = ctx.anchor?.(big) || {};
  const w = ctx.wm.win('demo', {
    title,
    width: big ? 560 : 380,
    height: type === 'iframe' ? 460 : undefined,
    x: pos.x, y: pos.y,
    className: 'win--demo',
    tools: newTab ? [newTab] : [],
  });
  // a reused demo window gets fresh content
  w.el.className = w.el.className.replace(/\bwin--demo-\S+/g, '').trim() + ' win--demo-' + type;
  w.setTitle(title);
  w.bar.querySelector('.win__tools').replaceChildren(...(newTab ? [newTab] : []));
  w.body.replaceChildren();
  const caption = demo.caption && h('figcaption', demo.caption);

  if (type === 'iframe') {
    const frame = h('iframe.demo__frame', {
      sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox', src: url, title, loading: 'lazy',
      allow: 'autoplay; fullscreen; clipboard-write',
      referrerpolicy: 'strict-origin-when-cross-origin',
    });
    const veil = h('div.demo__loading', h('span', 'Loading ' + host + '…'));
    frame.addEventListener('load', () => veil.classList.add('is-done'));
    w.body.append(h('div.demo__frame-wrap', frame, veil),
      h('p.demo__hint', 'Blank? Some sites refuse to be framed. ', h('a', { href: url, target: '_blank', rel: 'noopener' }, 'Open it in a new tab ↗')));
  } else if (type === 'qr') {
    w.body.append(h('div.demo__qr',
      h('div.demo__qr-code', qrSVG(url)),
      h('div.demo__qr-copy',
        h('p.demo__qr-head', demo.caption || 'Scan with your phone and join a real room.'),
        h('p.demo__qr-url', url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')),
        h('a.btn.btn--primary', { href: url, target: '_blank', rel: 'noopener' }, isNarrow() ? 'Open on this phone' : 'Open ' + host),
      )));
  } else if (type === 'image' || type === 'gallery') {
    const list = gal.length ? gal : [url];
    w.body.append(h('div.demo__media', gallery(list, title), caption));
  } else if (type === 'video') {
    const poster = demo.poster ? safeUrl(demo.poster) : null;
    w.body.append(h('figure.demo__media', h('video', { src: url, poster: poster || undefined, controls: true, playsinline: true, muted: true, autoplay: !poster, preload: 'metadata' }), caption));
  } else if (type === 'mockup') {
    const shot = gal[0] || url;
    const phone = demo.device === 'phone';
    w.body.append(h('figure.demo__media',
      h('div.mockup' + (phone ? '.mockup--phone' : ''),
        !phone && h('div.mockup__bar', h('i'), h('i'), h('i'), h('span', link ? new URL(link).hostname.replace(/^www\./, '') : title)),
        h('img', { src: shot, alt: demo.alt || title, loading: 'lazy' })),
      caption));
  } else {
    return linkDialog(ctx.wm, { url, title });
  }
  return w;
}
