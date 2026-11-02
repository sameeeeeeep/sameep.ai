// monitor.js — the studio's picture-in-picture monitor. Shows the product
// while it's being talked about (screenshots, a screen recording) or a small
// stats dashboard when a line has numbers.
//
// A new visual opens BIG (filling the stage) for a beat, then glides (FLIP) down
// to a small picture-in-picture in whichever corner keeps the faces clear: the
// owner passes pickCorner(), which knows the shot and who's talking, and calls
// place() when that changes. Click the small one to re-open it big. On phones
// it opens full-width under the picture and collapses to a slim strip.
//
// line.visual: {type:'shots', work, shots?} | {type:'video', src, poster?, work?}
//              | {type:'stats', title, kpis:[{n|t, pre?, suf?, label}], bars:{title,rows:[[label,n]]}, funnel:{title,rows}, hold?}
//              | {type:'work', work}   (shots or recording, whichever the project has)
//              video extras: layout:'side' (a tall 9:16 panel beside the studio), sound:true (its own audio, ducked
//              under the voice; follows the mute switch and the podcast's play/pause), key (keep it running across lines)
//              | {type:'embed', work}  (the live product in a sandboxed iframe, inert until tapped; phones and low power get
//                the project's shots instead)
//              | {type:'cards', title, items:[{to, title, blurb, thumb}], cue:{<clip file>:[[sec, i]]}, hold?}
//                (the menu: each card lights up as the line's audio reaches its cue; click one to go there)
//              | 'none'
import { h, safeUrl } from './util.js';
import { sound } from './audio.js';

const fmtNum = (v) => Math.round(v).toLocaleString('en-US');
const CORNERS = ['tr', 'tl', 'br', 'bl'];

export class Monitor {
  constructor(stage, { base, reduced, onOpenWork }) {
    this.base = base;
    this.reduced = reduced;
    this.onOpenWork = onOpenWork;
    this.title = h('span.mon__title');
    this.btnBig = h('button.mon__btn', { type: 'button', 'aria-label': 'Expand', title: 'Expand', onclick: (e) => { e.stopPropagation(); this.toggleSize(); } }, h('span.mon__ico.mon__ico--big', { 'aria-hidden': 'true' }));
    this.btnX = h('button.mon__btn', { type: 'button', 'aria-label': 'Hide this', title: 'Hide (skip the visuals for this part)', onclick: (e) => { e.stopPropagation(); this.onSkip?.(); this.hide(); } }, h('span.mon__ico.mon__ico--x', { 'aria-hidden': 'true' }));
    this.screen = h('div.mon__screen');
    this.acts = h('div.mon__acts');
    this.el = h('div.mon', { hidden: true, role: 'region', 'aria-label': 'Studio monitor', dataset: { corner: 'tr' } },
      h('div.mon__bar', h('i.mon__led', { 'aria-hidden': 'true' }), this.title, this.btnBig, this.btnX),
      this.screen, this.acts);
    this.el.addEventListener('click', (e) => { if (this.small && !e.target.closest('button')) this.toggleSize(); });
    this.el.addEventListener('pointerenter', () => { this.hover = true; });
    this.el.addEventListener('pointerleave', () => { this.hover = false; });
    stage.append(this.el);
    this.stage = stage;
    this.panelHost = null; // phones: the monitor sits under the picture, full width
    this.narrow = false;
    this.key = null;
    this.size = 'pip';
    this.corner = 'tr';
    this.pickCorner = null;
  }

  get on() { return !this.el.hidden; }
  get small() { return this.size === 'pip' || this.size === 'strip'; }

  // big ⇄ small. A visitor who re-opens it keeps it big until they shrink it.
  toggleSize(force) {
    const next = force || (this.small ? (this.narrow ? 'panel' : 'full') : (this.narrow ? 'strip' : 'pip'));
    if (!force) { this.pinned = next === 'full' || next === 'panel'; clearTimeout(this.shrinkT); }
    if (next === 'pip') this.corner = this.pickCorner?.() || this.corner;
    this.#flip(() => this.#setSize(next));
  }

  #setSize(size) {
    this.size = size;
    this.el.dataset.size = size;
    this.el.dataset.corner = this.corner;
    const big = !this.small;
    this.btnBig.setAttribute('aria-label', big ? 'Shrink' : 'Expand');
    this.btnBig.title = big ? 'Shrink to the corner' : 'Expand';
    this.btnBig.querySelector('.mon__ico').classList.toggle('mon__ico--small', big);
  }

  // the small monitor moves to keep the speaker's face clear
  place(corner) {
    if (!CORNERS.includes(corner) || corner === this.corner) return;
    this.corner = corner;
    if (this.on && this.size === 'pip') this.#flip(() => { this.el.dataset.corner = corner; });
    else this.el.dataset.corner = corner;
  }

  // smooth size/position change: measure, apply, invert, play
  #flip(apply) {
    if (this.reduced || this.el.hidden || !this.el.animate) return apply();
    const a = this.el.getBoundingClientRect();
    apply();
    const b = this.el.getBoundingClientRect();
    if (!a.width || !b.width || (Math.abs(a.left - b.left) < 1 && Math.abs(a.top - b.top) < 1 && Math.abs(a.width - b.width) < 1)) return;
    this.flipAnim?.cancel();
    this.flipAnim = this.el.animate([
      { transformOrigin: '0 0', transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width}, ${a.height / b.height})` },
      { transformOrigin: '0 0', transform: 'none' },
    ], { duration: 560, easing: 'cubic-bezier(.2, .8, .2, 1)' });
  }

  // small inline actions ("Open it ↗", "Show me here") on the visual
  setActions(list = []) {
    this.acts.replaceChildren(...list.map((a) => h('button.mon__act' + (a.link ? '.mon__act--link' : ''), { type: 'button', onclick: (e) => { e.stopPropagation(); a.run(); } }, a.label)));
  }

  hide() {
    clearTimeout(this.shrinkT);
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.key = null;
    this.pinned = false;
    clearInterval(this.slideT);
    clearInterval(this.cueT);
    this.#unsound();
    this.screen.querySelector('video')?.pause();
    this.screen.replaceChildren();
  }

  // v is resolved already (work media filled in); key keeps media running across lines
  show(v, key) {
    if (!v) return this.hide();
    if (key && key === this.key && this.on) return;
    clearInterval(this.slideT);
    clearInterval(this.cueT);
    this.#unsound();
    clearTimeout(this.shrinkT);
    this.key = key;
    this.pinned = false;
    this.el.dataset.type = v.type;
    this.el.dataset.layout = v.layout || '';
    this.title.textContent = v.title || '';
    // how long it stays big before it tucks into the corner
    let hold = 3400;
    if (v.type === 'stats') {
      this.screen.replaceChildren(this.#stats(v));
      const big = (v.kpis?.length || 0) > 2 || v.funnel || (v.bars?.rows?.length || 0) > 2;
      hold = v.hold || (big ? 7000 : 4200);
    } else if (v.type === 'video') {
      const vid = h('video.mon__video', { muted: true, playsInline: true, loop: true, autoplay: true, preload: 'auto', poster: v.poster || null, src: v.src, 'aria-label': (v.title || 'Screen recording') + ', muted' });
      vid.muted = true;
      vid.addEventListener('error', () => { if (v.shots?.length) this.screen.replaceChildren(this.#slides(v)); }, { once: true });
      this.screen.replaceChildren(vid);
      vid.play?.().catch(() => {});
      if (v.sound) this.#sounded(vid, v.volume ?? 0.22);
      hold = v.hold || 3800;
    } else if (v.type === 'shots') {
      this.screen.replaceChildren(this.#slides(v));
      hold = v.hold || 3400;
    } else if (v.type === 'embed') {
      this.screen.replaceChildren(this.#embed(v));
      hold = v.hold || 9000;
    } else if (v.type === 'cards') {
      this.screen.replaceChildren(this.#cards(v));
      const last = Math.max(0, ...Object.values(v.cue || {}).flat().map((c) => c[0]));
      hold = v.hold || (last ? (last + 3) * 1000 : 6000);
    } else return this.hide();
    const host = this.narrow && this.panelHost ? this.panelHost : this.stage;
    if (this.el.parentElement !== host) host.append(this.el);
    if (v.work && this.onOpenWork) this.screen.append(h('button.mon__open', { type: 'button', onclick: (e) => { e.stopPropagation(); this.onOpenWork(v.work); } }, 'Open in Work ↗'));
    this.corner = this.pickCorner?.() || this.corner;
    this.#setSize(this.narrow ? 'panel' : (v.size === 'pip' ? 'pip' : 'full'));
    this.el.hidden = false;
    this.el.classList.remove('is-in'); void this.el.offsetWidth; this.el.classList.add('is-in');
    if (!this.small) this.#scheduleShrink(hold);
  }

  #scheduleShrink(ms) {
    clearTimeout(this.shrinkT);
    this.shrinkT = setTimeout(() => {
      if (this.el.hidden || this.pinned || this.small) return;
      if (this.hover) return this.#scheduleShrink(1500); // they're looking at it
      this.corner = this.pickCorner?.() || this.corner;
      this.#flip(() => this.#setSize(this.narrow ? 'strip' : 'pip'));
    }, ms);
  }

  // layout changed (phone ⇄ desktop): re-home without losing the visual
  rehome() {
    if (this.el.hidden) return;
    const host = this.narrow && this.panelHost ? this.panelHost : this.stage;
    if (this.el.parentElement !== host) host.append(this.el);
    const map = this.narrow ? { full: 'panel', pip: 'strip' } : { panel: 'full', strip: 'pip' };
    if (map[this.size]) this.#setSize(map[this.size]);
  }

  #slides(v) {
    const wrap = h('div.mon__slides');
    const imgs = v.shots.map((s, i) => h('img', { src: s, alt: `${v.title || 'Screenshot'} ${i + 1}`, loading: i ? 'lazy' : 'eager', draggable: 'false', class: i ? '' : 'is-on' }));
    wrap.append(...imgs);
    if (v.cue && imgs.length > 1) {
      this.#cued(v.cue, (i) => { if (i < 0) return; imgs.forEach((im, k) => im.classList.toggle('is-on', k === i)); });
      return wrap;
    }
    if (imgs.length > 1 && !this.reduced) {
      let i = 0;
      this.slideT = setInterval(() => { imgs[i].classList.remove('is-on'); i = (i + 1) % imgs.length; imgs[i].classList.add('is-on'); }, 3200);
    }
    return wrap;
  }

  // the live product: inert (no focus, no clicks) until tapped, so it never steals the say field or the keyboard;
  // if it hasn't loaded in 8s, the project's shots take its place
  #embed(v) {
    const frame = h('iframe.mon__frame', { src: v.src, title: v.title || 'Live product', loading: 'lazy', referrerpolicy: 'no-referrer',
      sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups', allow: 'autoplay; fullscreen', tabindex: '-1' });
    frame.inert = true;
    const tap = h('button.mon__tap', { type: 'button', onclick: (e) => { e.stopPropagation(); frame.inert = false; frame.removeAttribute('tabindex'); tap.remove(); this.pinned = true; clearTimeout(this.shrinkT); frame.focus?.(); } }, 'Tap to try it live');
    const wrap = h('div.mon__embed', frame, tap);
    const t = setTimeout(() => { if (wrap.isConnected && !loaded && v.shots?.length) wrap.replaceWith(this.#slides(v)); }, 8000);
    let loaded = false;
    frame.addEventListener('load', () => { loaded = true; clearTimeout(t); }, { once: true });
    return wrap;
  }

  // a clip with its own sound (the Diwali song): quiet under the voice, silent when muted, paused with the podcast
  #sounded(vid, vol) {
    let was = null;
    const sync = () => {
      const on = sound.on && (this.isPlaying?.() ?? true);
      vid.muted = !sound.on;
      vid.volume = vol;
      if ((this.isPlaying?.() ?? true) && vid.paused) vid.play?.().catch(() => { vid.muted = true; vid.play?.().catch(() => {}); });
      else if (!(this.isPlaying?.() ?? true) && !vid.paused) vid.pause();
      if (on !== was) { was = on; this.onSound?.(on); }
    };
    this.soundT = setInterval(sync, 250);
    sync();
  }

  #unsound() {
    if (!this.soundT) return;
    clearInterval(this.soundT);
    this.soundT = null;
    this.onSound?.(false);
  }

  // the menu as cards; the one being talked about lights up (cue times are per clip, so every host's take works)
  #cards(v) {
    const cards = v.items.map((it) => h('button.mcard', { type: 'button', onclick: (e) => { e.stopPropagation(); this.onGo?.(it.to); } },
      h('span.mcard__pic', it.thumb && h('img', { src: it.thumb, alt: '', loading: 'eager', draggable: 'false' })),
      h('span.mcard__t', it.title), h('span.mcard__b', it.blurb)));
    const wrap = h('div.mcards', cards);
    if (v.cue) this.#cued(v.cue, (i) => cards.forEach((c, k) => { c.classList.toggle('is-lit', k === i); if (k === i) c.classList.add('is-seen'); }));
    return wrap;
  }

  // run apply(i) as the line's audio reaches each [seconds, index] cue; cue is per clip file, so every host's take lines up
  // (no matching clip → the first list on a wall clock)
  #cued(cueMap, apply) {
    const t0 = performance.now();
    let at = null;
    const tick = () => {
      const a = this.audio;
      const file = a?.src ? decodeURIComponent(a.src.split('/').pop().split('?')[0]) : '';
      const cue = cueMap[file] || cueMap.default || Object.values(cueMap)[0];
      if (!cue) return;
      const t = cueMap[file] ? a.currentTime : (performance.now() - t0) / 1000;
      let i = -1;
      for (const [sec, k] of cue) if (t >= sec) i = k;
      if (i !== at) { at = i; apply(i); }
    };
    this.cueT = setInterval(tick, 120);
    tick();
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
  if (raw.type === 'embed' && it) {
    const live = it.embed && !document.documentElement.classList.contains('power-low') && !matchMedia('(max-width: 760px)').matches;
    if (live) return { type: 'embed', src: abs(it.embed), title: raw.title || it.title, shots, hold: raw.hold, work: it.id };
    return resolveVisual({ ...raw, type: 'work' }, work, base);
  }
  if (raw.type === 'cards') return { ...raw, items: (raw.items || []).map((it) => ({ ...it, thumb: abs(it.thumb) })) };
  if (raw.type === 'video') { const src = abs(raw.src || it?.video); return src ? { type: 'video', src, poster: abs(raw.poster || it?.poster), title, shots, hold: raw.hold, work: it?.id, layout: raw.layout, sound: raw.sound, volume: raw.volume } : null; }
  if (raw.type === 'shots') return shots.length ? { type: 'shots', shots, title, hold: raw.hold, work: it?.id, cue: raw.cue } : null;
  if (raw.type === 'work' && it) {
    if (it.video) return { type: 'video', src: abs(it.video), poster: abs(it.poster), title, shots, work: it.id };
    if (shots.length) return { type: 'shots', shots, title, work: it.id };
  }
  return null;
}
