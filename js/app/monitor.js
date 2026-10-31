// monitor.js — the studio's picture-in-picture monitor. Shows the product
// while it's being talked about (screenshots, a screen recording) or a small
// stats dashboard when a line has numbers. Lives in the top-right corner of the
// stage, which is clear of both faces in every shot; it never touches the
// subtitles (they sit under the picture). Tap ⤢ to go full-stage, × to skip.
//
// line.visual: {type:'shots', work, shots?} | {type:'video', src, poster?, work?}
//              | {type:'stats', title, kpis:[{n|t, pre?, suf?, label}], bars:{title,rows:[[label,n]]}, funnel:{title,rows}}
//              | {type:'work', work}   (shots or recording, whichever the project has)
//              | 'none'
import { h, safeUrl } from './util.js';

const fmtNum = (v) => Math.round(v).toLocaleString('en-US');

export class Monitor {
  constructor(stage, { base, reduced, onOpenWork }) {
    this.base = base;
    this.reduced = reduced;
    this.onOpenWork = onOpenWork;
    this.title = h('span.mon__title');
    this.btnBig = h('button.mon__btn', { type: 'button', 'aria-label': 'Expand', title: 'Expand', onclick: (e) => { e.stopPropagation(); this.toggleSize(); } }, h('span.mon__ico.mon__ico--big', { 'aria-hidden': 'true' }));
    this.btnX = h('button.mon__btn', { type: 'button', 'aria-label': 'Hide this', title: 'Hide (skip the visuals for this part)', onclick: (e) => { e.stopPropagation(); this.onSkip?.(); this.hide(); } }, h('span.mon__ico.mon__ico--x', { 'aria-hidden': 'true' }));
    this.screen = h('div.mon__screen');
    this.el = h('div.mon', { hidden: true, role: 'region', 'aria-label': 'Studio monitor' },
      h('div.mon__bar', h('i.mon__led', { 'aria-hidden': 'true' }), this.title, this.btnBig, this.btnX),
      this.screen);
    this.el.addEventListener('click', (e) => { if (this.size === 'pip' && !e.target.closest('button')) this.toggleSize(); });
    stage.append(this.el);
    this.stage = stage;
    this.panelHost = null; // phones: numbers get a panel under the subtitles instead
    this.narrow = false;
    this.key = null;
    this.size = 'pip';
  }

  get on() { return !this.el.hidden; }

  toggleSize(force) {
    if (this.size === 'panel' && !force) return;
    this.size = force || (this.size === 'pip' ? 'full' : 'pip');
    this.el.dataset.size = this.size;
    this.btnBig.setAttribute('aria-label', this.size === 'pip' ? 'Expand' : 'Shrink');
    this.btnBig.title = this.size === 'pip' ? 'Expand' : 'Shrink back to the corner';
    this.btnBig.querySelector('.mon__ico').classList.toggle('mon__ico--small', this.size === 'full');
  }

  hide() {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.key = null;
    clearInterval(this.slideT);
    this.screen.querySelector('video')?.pause();
    this.screen.replaceChildren();
  }

  // v is resolved already (work media filled in); key keeps media running across lines
  show(v, key) {
    if (!v) return this.hide();
    if (key && key === this.key && this.on) return;
    clearInterval(this.slideT);
    this.key = key;
    this.el.dataset.type = v.type;
    this.title.textContent = v.title || '';
    let size = v.size || 'pip';
    if (v.type === 'stats') {
      this.screen.replaceChildren(this.#stats(v));
      const big = (v.kpis?.length || 0) > 2 || v.funnel || (v.bars?.rows?.length || 0) > 2;
      size = v.size || (big ? 'full' : 'pip');
    } else if (v.type === 'video') {
      const vid = h('video.mon__video', { muted: true, playsInline: true, loop: true, autoplay: true, preload: 'auto', poster: v.poster || null, src: v.src, 'aria-label': (v.title || 'Screen recording') + ', muted' });
      vid.muted = true;
      vid.addEventListener('error', () => { if (v.shots?.length) this.screen.replaceChildren(this.#slides(v)); }, { once: true });
      this.screen.replaceChildren(vid);
      vid.play?.().catch(() => {});
    } else if (v.type === 'shots') {
      this.screen.replaceChildren(this.#slides(v));
    } else return this.hide();
    const host = v.type === 'stats' && this.narrow && this.panelHost ? this.panelHost : this.stage;
    if (this.el.parentElement !== host) host.append(this.el);
    if (host !== this.stage) size = 'panel';
    if (v.work && this.onOpenWork) this.screen.append(h('button.mon__open', { type: 'button', onclick: (e) => { e.stopPropagation(); this.onOpenWork(v.work); } }, 'Open in Work ↗'));
    this.toggleSize(size);
    this.el.hidden = false;
    this.el.classList.remove('is-in'); void this.el.offsetWidth; this.el.classList.add('is-in');
  }

  #slides(v) {
    const wrap = h('div.mon__slides');
    const imgs = v.shots.map((s, i) => h('img', { src: s, alt: `${v.title || 'Screenshot'} ${i + 1}`, loading: i ? 'lazy' : 'eager', draggable: 'false', class: i ? '' : 'is-on' }));
    wrap.append(...imgs);
    if (imgs.length > 1 && !this.reduced) {
      let i = 0;
      this.slideT = setInterval(() => { imgs[i].classList.remove('is-on'); i = (i + 1) % imgs.length; imgs[i].classList.add('is-on'); }, 3200);
    }
    return wrap;
  }

  #stats(v) {
    const el = h('div.stats');
    const counters = [];
    if (v.kpis?.length) {
      el.append(h('div.stats__kpis', v.kpis.map((k) => {
        const num = h('span.stats__n');
        if (k.t != null) num.textContent = k.t;
        else counters.push([num, k.n]);
        return h('div.stats__kpi', h('p.stats__v', k.pre && h('span.stats__fix', k.pre), num, k.suf && h('span.stats__fix', k.suf)), h('p.stats__l', k.label));
      })));
    }
    const rowsOf = (spec, cls) => {
      const max = Math.max(...spec.rows.map((r) => r[1]));
      const first = spec.rows[0][1];
      return h('div.stats__chart.' + cls,
        spec.title && h('p.stats__ct', spec.title),
        h('div.stats__rows', spec.rows.map(([label, n], i) => {
          const fill = h('i.stats__fill', { style: { transitionDelay: (0.15 + i * 0.09) + 's' } });
          fill.style.setProperty('--f', String(n / max));
          const num = h('span.stats__rv');
          counters.push([num, n]);
          return h('div.stats__row', h('span.stats__rl', label), h('span.stats__track', fill), num,
            cls === 'stats--funnel' && i > 0 ? h('span.stats__pct', Math.round((n / first) * 100) + '%') : null);
        })));
    };
    if (v.funnel) el.append(rowsOf(v.funnel, 'stats--funnel'));
    if (v.bars) el.append(rowsOf(v.bars, 'stats--bars'));
    // count up (light: one rAF loop, ~0.9s)
    const T = this.reduced ? 0 : 900;
    const t0 = performance.now();
    const tick = (now) => {
      const p = T ? Math.min(1, (now - t0) / T) : 1;
      const e = 1 - Math.pow(1 - p, 3);
      for (const [node, n] of counters) node.textContent = fmtNum(n * e);
      if (p < 1 && el.isConnected) requestAnimationFrame(tick);
    };
    for (const [node] of counters) node.textContent = '0';
    requestAnimationFrame((now) => { el.classList.add('is-on'); tick(now); });
    return el;
  }
}

// line.visual (or the node's project) → a concrete visual for Monitor.show
export function resolveVisual(raw, work, base) {
  if (!raw || raw === 'none') return null;
  const abs = (u) => (u ? safeUrl(u, base) : null);
  const it = raw.work ? work.find((w) => w.id === raw.work) : null;
  const title = raw.title || it?.title || '';
  const shots = (raw.shots || it?.shots || []).map(abs).filter(Boolean);
  if (raw.type === 'stats') return raw;
  if (raw.type === 'video') { const src = abs(raw.src || it?.video); return src ? { type: 'video', src, poster: abs(raw.poster || it?.poster), title, shots, work: it?.id } : null; }
  if (raw.type === 'shots') return shots.length ? { type: 'shots', shots, title, work: it?.id } : null;
  if (raw.type === 'work' && it) {
    if (it.video) return { type: 'video', src: abs(it.video), poster: abs(it.poster), title, shots, work: it.id };
    if (shots.length) return { type: 'shots', shots, title, work: it.id };
  }
  return null;
}
