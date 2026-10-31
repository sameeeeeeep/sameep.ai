// work.js — the "Work" app: a plain, browsable index of every project, so the
// portfolio works without the podcast too. Data: data/work.json
// [{id,title,oneLiner,status,links:[{label,url}],shots:[],video,poster,embed,explainer}]
import { h, safeUrl, isNarrow } from './util.js';
import { sound } from './audio.js';

export async function loadWork(persona) {
  const url = persona.isCustom ? (persona.workUrl ? safeUrl(persona.workUrl, persona.base) : null) : safeUrl('data/work.json', persona.base);
  if (url) {
    try {
      const r = await fetch(url, { cache: 'no-cache' });
      if (r.ok) {
        const d = await r.json();
        const list = Array.isArray(d) ? d : d.items || d.work || [];
        // site work.json paths are site-relative; a custom bundle's are relative to its own file
        if (list.length) return { list, base: persona.isCustom ? url : persona.base };
      }
    } catch { /* fall through */ }
  }
  // fallback: the persona's short work list
  return {
    base: persona.base,
    list: (persona.work || []).map((w, i) => ({
      id: 'w' + i, title: w.title, oneLiner: w.caption || '', status: w.status || '',
      links: w.url ? [{ label: 'Open ' + w.title, url: w.url }] : [], embed: w.type === 'iframe' ? w.url : null,
    })),
  };
}

const media = (u, base) => (u ? safeUrl(u, base) : null);

export async function openWork(wm, persona, { focusId } = {}) {
  const w = wm.win('work', { title: 'Work', width: 900, height: 620, className: 'win--work' });
  if (w.body.dataset.ready) { if (focusId) w.select?.(focusId); return w; }
  w.body.dataset.ready = '1';
  w.body.append(h('p.work__loading', 'Reading the drive…'));
  const { list, base } = await loadWork(persona);
  const items = list.filter((it) => it && it.title);

  const nav = h('ul.work__list', { role: 'listbox', 'aria-label': 'Projects' });
  const detail = h('article.work__detail', { tabindex: '-1' });
  const back = h('button.btn.btn--sm.work__back', { type: 'button', onclick: () => root.classList.remove('is-detail') }, '‹ All work');
  const root = h('div.work', h('div.work__nav', h('p.finder__meta', `${items.length} projects · live where possible`), nav), h('div.work__pane', back, detail));
  w.body.replaceChildren(root);

  const show = (it) => {
    nav.querySelectorAll('.work__item').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === it.id)));
    const shots = (it.shots || []).map((s) => media(typeof s === 'string' ? s : s.src, base)).filter(Boolean);
    const links = (it.links || []).map((l) => ({ label: l.label || l.url, url: safeUrl(l.url, base) })).filter((l) => l.url);
    const embed = media(it.embed, base);
    const video = media(it.video, base);
    const parts = [
      h('header.work__head',
        h('h3.work__title', it.title),
        it.status && h('span.work__status', it.status)),
      it.oneLiner && h('p.work__one', it.oneLiner),
    ];
    if (video) parts.push(h('video.work__video', { src: video, poster: media(it.poster, base) || undefined, controls: true, playsinline: true, preload: 'none' }));
    if (shots.length) parts.push(gallery(shots, it.title));
    if (embed) {
      const frameWrap = h('div.work__embed');
      const load = h('button.btn', { type: 'button', onclick: () => {
        frameWrap.replaceChildren(h('iframe', { sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox', src: embed, title: it.title + ' (live)', loading: 'lazy', allow: 'autoplay; fullscreen; clipboard-write', referrerpolicy: 'strict-origin-when-cross-origin' }));
      } }, 'Load the live version here');
      frameWrap.append(load);
      parts.push(h('div.work__live', h('p.small', 'Live embed. If it stays blank, the site refuses framing: use Open ↗.'), frameWrap));
    }
    const explainerVideo = /\.(mp4|webm|mov)(\?|$)/i.test(String(it.explainer || '')) ? media(it.explainer, base) : null;
    if (explainerVideo) parts.push(h('div.work__explainer', h('p.small', 'The 30-second explainer'), h('video.work__video', { src: explainerVideo, controls: true, playsinline: true, preload: 'none' })));
    else if (it.explainer) parts.push(h('div.work__explainer', ...String(it.explainer).split(/\n{2,}/).map((p) => h('p', p))));
    if (links.length) parts.push(h('div.work__links', links.map((l) => h('a.btn', { href: l.url, target: '_blank', rel: 'noopener' }, l.label + ' ↗'))));
    detail.replaceChildren(...parts.filter(Boolean));
    detail.scrollTop = 0;
    root.classList.add('is-detail');
    if (!isNarrow()) detail.focus({ preventScroll: true });
  };

  items.forEach((it) => {
    const thumb = media(it.poster || (it.shots || [])[0]?.src || (it.shots || [])[0], base);
    nav.append(h('li', h('button.work__item', { type: 'button', role: 'option', dataset: { id: it.id }, 'aria-selected': 'false', onclick: () => { sound.tick('click'); show(it); } },
      h('span.work__thumb', thumb ? h('img', { src: thumb, alt: '', loading: 'lazy' }) : h('img', { src: 'img/ui/folder.svg', alt: '', class: 'is-icon' })),
      h('span.work__meta', h('span.work__name', it.title), it.oneLiner && h('span.work__line', it.oneLiner)))));
  });
  w.select = (id) => { const it = items.find((x) => x.id === id); if (it) show(it); };
  const first = items.find((x) => x.id === focusId) || (!isNarrow() && items[0]);
  if (first) show(first);
  return w;
}

export function gallery(srcs, title = '') {
  let i = 0;
  const img = h('img', { src: srcs[0], alt: `${title} screenshot 1 of ${srcs.length}`, loading: 'lazy' });
  const count = h('span.gallery__count', `1 / ${srcs.length}`);
  const go = (d) => { i = (i + d + srcs.length) % srcs.length; img.src = srcs[i]; img.alt = `${title} screenshot ${i + 1} of ${srcs.length}`; count.textContent = `${i + 1} / ${srcs.length}`; };
  const el = h('figure.gallery', h('div.gallery__frame', img),
    srcs.length > 1 && h('figcaption.gallery__bar',
      h('button.btn.btn--sm', { type: 'button', 'aria-label': 'Previous screenshot', onclick: () => go(-1) }, '‹'),
      count,
      h('button.btn.btn--sm', { type: 'button', 'aria-label': 'Next screenshot', onclick: () => go(1) }, '›')));
  return el;
}
