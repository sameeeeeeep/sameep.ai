// monitor.js — the studio's monitor. Shows the product while it's being talked
// about (screenshots, a screen recording, the live site) or a small stats
// dashboard when a line has numbers.
//
// SIDE, FULL OR SMALL: the rules
//   Sizes. Desktop: 'side' is a panel at the edge of the stage, beside the hosts
//   (36% wide for a screen, a full-height column for stats and the menu), on the
//   side that keeps the speaker's face clear. 'full' fills the stage and covers the
//   faces. 'pip' is a small corner picture-in-picture. Phones: 'panel' sits
//   full-width under the picture (it never covers anyone, so it stands in for side
//   and full), 'strip' is a slim thumbnail + title bar ("tap to open").
//   The owner passes pickCorner() (the corner that covers the least face; its
//   column picks the side) and calls place() at the start of every line. place() is
//   also the line tick: a line that starts without claiming the visual on screen
//   (its own visual, or the same visual.key) means the speaker has moved on.
//   1. Mostly side. Screens (video, shots, embed), stats and the menu cards open
//      'side' and stay there while they're spoken about. Nothing covers the hosts
//      unless the script says so.
//   2. Full is rare: only visuals marked size:'full' in episode.json, the handful of
//      big numbers reveals Sameep talks through. They stay full while spoken about.
//   3. When the speaker moves on, a screen tucks into the corner ('pip', a reminder
//      with "Open in Work"); stats and the menu go away, because their small
//      versions say nothing (one cropped KPI; four clipped card titles).
//   4. Never big: the node's project shown as a fallback on a guest line with no
//      visual of its own (key 'work:…') opens small, and so does size:'pip'.
//   5. Stats at side size are one column and scroll inside if they're long. The
//      menu at side size is a list (thumbnail + full title), not a grid.
//   6. The visitor can always expand (side → full) or shrink back; an expanded
//      visual stays expanded until they shrink it.
//   Per-visual overrides: size:'full' | 'pip'.
//
// line.visual: {type:'shots', work, shots?} | {type:'video', src, poster?, work?}
//              | {type:'stats', title, kpis:[{n|t, pre?, suf?, label}], bars:{title,rows:[[label,n]],log?,unit?}, funnel:{title,rows}}
//                stats extras, any mix: grid:{n, icon:'cv'|'phone'|'glass'|'dot', hl:{n,label}, label} (a pictogram),
//                steps:{rows:[{when,t,sub}]} (a timeline), flow:{rows:[{t,sub,hot}], loop} (a pipeline), tags:{rows},
//                checks:{rows}, news:[{pub, head, date, fact, url}] (press clippings), photo:{src|[src…],cap}, qr:{url,cap}, source
//              | {type:'work', work}   (shots or recording, whichever the project has)
//              video extras: layout:'side' (a tall 9:16 panel beside the studio), sound:true (its own audio, ducked
//              under the voice; follows the mute switch and the podcast's play/pause)
//              | {type:'embed', work}  (the live product in a sandboxed iframe, inert until tapped; phones and low power get
//                the project's shots instead)
//              | {type:'cards', title, items:[{to, title, blurb, thumb}], cue:{<clip file>:[[sec, i]]}} (one cue list per host's clip)
//                (the menu: each card lights up as the line's audio reaches its cue; click one to go there)
//              | 'none'
//              any visual: key (lines sharing a key keep one visual running), size
import { h, safeUrl } from './util.js';
import { sound } from './audio.js';
import { qrSVG } from './demos.js';

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
    stage.append(this.el);
    this.stage = stage;
    this.panelHost = null; // phones: the monitor sits under the picture, full width
    this.narrow = false;
    this.key = null;
    this.size = 'pip';
    this.corner = 'tr';
    this.pickCorner = null;
    this.tick = 0;   // lines started (see place())
    this.claim = 0;  // the last line that showed, or kept, the visual on screen
  }

  get on() { return !this.el.hidden; }
  get small() { return this.size === 'pip' || this.size === 'strip'; }

  // the button and a click on the small one (rule 6): pip → side, side ⇄ full; phones: strip ⇄ panel
  toggleSize() {
    let next;
    if (this.narrow) next = this.size === 'strip' ? 'panel' : (this.smallOK ? 'strip' : null);
    else next = this.size === 'side' ? 'full' : this.size === 'full' ? 'side' : (this.home || 'side');
    if (!next) return;
    this.pinned = next === 'full' || next === 'panel';
    this.corner = this.pickCorner?.() || this.corner;
    this.#flip(() => this.#setSize(next));
  }

  #setSize(size) {
    this.size = size;
    this.el.dataset.size = size;
    this.el.dataset.corner = this.corner;
    const shrink = size === 'full' || (size === 'panel' && this.smallOK);
    this.btnBig.setAttribute('aria-label', shrink ? 'Shrink' : 'Expand');
    this.btnBig.title = shrink ? 'Shrink' : 'Expand';
    this.btnBig.querySelector('.mon__ico').classList.toggle('mon__ico--small', shrink);
  }

  // the small monitor moves to keep the speaker's face clear. podcast.js calls this
  // at the start of every line, so it's also the line tick: once the line has run
  // its #visual, a visual nobody claimed means the speaker has moved on (rules 1, 2)
  place(corner) {
    const t = ++this.tick;
    queueMicrotask(() => { if (t === this.tick && this.claim !== t) this.#movedOn(); });
    if (!CORNERS.includes(corner) || corner === this.corner) return;
    this.corner = corner;
    if (this.on && (this.size === 'pip' || this.size === 'side')) this.#flip(() => { this.el.dataset.corner = corner; });
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

  // rule 3
  #movedOn() {
    if (this.el.hidden || this.pinned) return;
    if (!this.smallOK) return this.hide();
    if (this.small) return;
    this.corner = this.pickCorner?.() || this.corner;
    this.#flip(() => this.#setSize(this.narrow ? 'strip' : 'pip'));
  }

  hide() {
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
    this.claim = this.tick;
    if (key && key === this.key && this.on) return; // still spoken about: carry on at whatever size it is
    clearInterval(this.slideT);
    clearInterval(this.cueT);
    this.#unsound();
    this.key = key;
    this.pinned = false;
    this.el.dataset.type = v.type;
    this.el.dataset.layout = v.layout || '';
    this.title.textContent = v.title || '';
    // rule 3: screens have a legible small version; stats and the menu don't
    this.smallOK = v.type !== 'stats' && v.type !== 'cards';
    if (v.type === 'stats') {
      this.screen.replaceChildren(this.#stats(v));
    } else if (v.type === 'video') {
      const vid = h('video.mon__video', { muted: true, playsInline: true, loop: true, autoplay: true, preload: 'auto', poster: v.poster || null, src: v.src, 'aria-label': (v.title || 'Screen recording') + ', muted' });
      vid.muted = true;
      vid.addEventListener('error', () => { if (v.shots?.length) this.screen.replaceChildren(this.#slides(v)); }, { once: true });
      this.screen.replaceChildren(vid);
      vid.play?.().catch(() => {});
      if (v.sound) this.#sounded(vid, v.volume ?? 0.22);
    } else if (v.type === 'shots') {
      this.screen.replaceChildren(this.#slides(v));
    } else if (v.type === 'embed') {
      this.screen.replaceChildren(this.#embed(v));
    } else if (v.type === 'cards') {
      this.screen.replaceChildren(this.#cards(v));
    } else return this.hide();
    const host = this.narrow && this.panelHost ? this.panelHost : this.stage;
    if (this.el.parentElement !== host) host.append(this.el);
    if (v.work && this.onOpenWork) this.screen.append(h('button.mon__open', { type: 'button', onclick: (e) => { e.stopPropagation(); this.onOpenWork(v.work); } }, 'Open in Work ↗'));
    this.corner = this.pickCorner?.() || this.corner;
    // rules 1, 2, 4
    this.home = v.size === 'full' ? 'full' : 'side';
    const startSmall = this.smallOK && (v.size === 'pip' || String(key || '').startsWith('work:'));
    this.#setSize(this.narrow ? (startSmall ? 'strip' : 'panel') : (startSmall ? 'pip' : this.home));
    this.el.hidden = false;
    this.el.classList.remove('is-in'); void this.el.offsetWidth; this.el.classList.add('is-in');
  }

  // layout changed (phone ⇄ desktop): re-home without losing the visual
  rehome() {
    if (this.el.hidden) return;
    const host = this.narrow && this.panelHost ? this.panelHost : this.stage;
    if (this.el.parentElement !== host) host.append(this.el);
    const map = this.narrow ? { full: 'panel', side: 'panel', pip: 'strip' } : { panel: this.pinned ? 'full' : (this.home || 'side'), strip: 'pip' };
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
    const tap = h('button.mon__tap', { type: 'button', onclick: (e) => { e.stopPropagation(); frame.inert = false; frame.removeAttribute('tabindex'); tap.remove(); this.pinned = true; frame.focus?.(); } }, 'Tap to try it live');
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
    // layout: the numbers lead on the left (the first one is the hero), the one picture that explains them on the right
    const lead = h('div.stats__lead'), main = h('div.stats__main');
    const el = h('div.stats', lead, main);
    const counters = [];
    if (v.kpis?.length) {
      lead.append(h('div.stats__kpis', v.kpis.map((k) => {
        const num = h('span.stats__n');
        if (k.t != null) num.textContent = k.t;
        else counters.push([num, k.n]);
        const long = String(k.t ?? fmtNum(k.n)).length + (k.pre || '').length + (k.suf || '').length > 5;
        return h('div.stats__kpi' + (long ? '.is-long' : ''), h('p.stats__v', k.pre && h('span.stats__fix', k.pre), num, k.suf && h('span.stats__fix', k.suf)), h('p.stats__l', k.label));
      })));
    }
    // spec.log: for before/after rows a million miles apart, so the small one still shows
    const rowsOf = (spec, cls) => {
      const sc = spec.log ? (n) => Math.log10(n + 1) : (n) => n;
      const max = Math.max(...spec.rows.map((r) => sc(r[1])));
      const first = spec.rows[0][1];
      return h('div.stats__chart.' + cls,
        spec.title && h('p.stats__ct', spec.title),
        h('div.stats__rows', spec.rows.map(([label, n], i) => {
          const fill = h('i.stats__fill', { style: { transitionDelay: (0.15 + i * 0.09) + 's' } });
          fill.style.setProperty('--f', String(Math.max(0.012, sc(n) / max)));
          const num = h('span.stats__rv');
          counters.push([num, n, Array.isArray(spec.unit) ? spec.unit[i] : spec.unit]); // unit: one suffix for every row, or one per row
          return h('div.stats__row', h('span.stats__rl', label), h('span.stats__track', fill), num,
            cls === 'stats--funnel' && i > 0 ? h('span.stats__pct', Math.round((n / first) * 100) + '%') : null);
        })));
    };
    if (v.funnel) main.append(rowsOf(v.funnel, 'stats--funnel'));
    if (v.bars) main.append(rowsOf(v.bars, 'stats--bars'));
    if (v.qr) main.append(h('figure.stats__qr', h('span.stats__qrcode', qrSVG(v.qr.url)), h('figcaption', h('b', v.qr.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')), v.qr.cap && h('span', v.qr.cap))));
    // photo.src may be a list: the photos cross-fade, one every 2.6s
    if (v.photo) {
      const srcs = [].concat(v.photo.src);
      const imgs = srcs.map((u, i) => h('img', { src: safeUrl(u, this.base), alt: i ? '' : v.photo.cap || '', draggable: 'false', loading: i ? 'lazy' : 'eager', class: i ? '' : 'is-on' }));
      main.append(h('figure.stats__photo' + (imgs.length > 1 ? '.is-set' : ''), h('div.stats__pics', imgs), v.photo.cap && h('figcaption', v.photo.cap)));
      if (imgs.length > 1 && !this.reduced) { let i = 0; this.slideT = setInterval(() => { imgs[i].classList.remove('is-on'); i = (i + 1) % imgs.length; imgs[i].classList.add('is-on'); }, 2600); }
    }
    // a pictogram: n little icons filling in, the first hl.n of them lit
    if (v.grid) {
      const g = v.grid, lit = g.hl?.n ?? 0;
      main.append(h('div.stats__chart.stats--grid', g.title && h('p.stats__ct', g.title),
        h('div.stats__grid', { dataset: { icon: g.icon || 'dot' }, style: { '--cols': g.cols || Math.ceil(Math.sqrt(g.n * 2)) } },
          Array.from({ length: g.n }, (_, i) => h('i', { class: i < lit ? 'is-hl' : '', style: { transitionDelay: (i * Math.min(0.03, 1.2 / g.n)).toFixed(3) + 's', '--r': (((i * 37) % 17) - 8) + 'deg' } }))),
        h('p.stats__legend', g.hl && h('span.stats__key.is-hl', g.hl.label), g.label && h('span.stats__key', g.label))));
    }
    // a timeline: dated steps, lighting up left to right
    if (v.steps) {
      main.append(h('div.stats__chart.stats--steps', v.steps.title && h('p.stats__ct', v.steps.title),
        h('ol.stats__steps', v.steps.rows.map((s, i) => h('li', { style: { transitionDelay: (0.2 + i * 0.35) + 's' } },
          h('span.stats__when', s.when), h('b', s.t), s.sub && h('span.stats__sub', s.sub))))));
    }
    // a pipeline: steps joined by arrows, with an optional loop back
    // (several flows, e.g. before and after, stack as rows of one chart)
    if (v.flow) {
      const flows = [].concat(v.flow);
      main.append(h('div.stats__chart.stats--flow', flows.map((f, k) => h('div.stats__fl', f.title && h('p.stats__ct', f.title),
        h('ol.stats__flow' + (f.hot ? '.is-hot' : ''), f.rows.map((s, i) => h('li', { class: s.hot ? 'is-hot' : '', style: { transitionDelay: (0.15 + k * 0.6 + i * 0.22) + 's' } }, s.t || s, s.sub && h('small', s.sub)))),
        f.loop && h('p.stats__loop', '↺ ' + f.loop)))));
    }
    if (v.tags) main.append(h('div.stats__chart.stats--tags', v.tags.title && h('p.stats__ct', v.tags.title),
      h('ul.stats__tags', v.tags.rows.map((t, i) => h('li', { style: { transitionDelay: (0.1 + i * 0.06) + 's' } }, t)))));
    if (v.checks) main.append(h('div.stats__chart.stats--checks', v.checks.title && h('p.stats__ct', v.checks.title),
      h('ul.stats__checks', v.checks.rows.map((t, i) => h('li', { style: { transitionDelay: (0.2 + i * 0.3) + 's' } }, t)))));
    // press clippings: masthead, headline, date, the fact that matters
    if (v.news) main.append(h('div.stats__news', v.news.map((n, i) => h('a.clip', { href: safeUrl(n.url, this.base), target: '_blank', rel: 'noopener', style: { transitionDelay: (0.15 + i * 0.25) + 's' }, onclick: (e) => e.stopPropagation() },
      h('span.clip__pub', n.pub), h('b.clip__head', n.head), n.fact && h('span.clip__fact', n.fact), h('span.clip__date', n.date)))));
    if (v.source) el.append(h('p.stats__src', v.source));
    if (!lead.childElementCount) lead.remove();
    if (!main.childElementCount) main.remove();
    // count up (light: one rAF loop, ~0.9s)
    const T = this.reduced ? 0 : 900;
    const t0 = performance.now();
    const tick = (now) => {
      const p = T ? Math.min(1, (now - t0) / T) : 1;
      const e = 1 - Math.pow(1 - p, 3);
      for (const [node, n, u] of counters) node.textContent = fmtNum(n * e) + (u || '');
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
  // (resolved visuals keep key and size; the owner reads key, Monitor reads size)
  if (raw.type === 'embed' && it) {
    const live = it.embed && !document.documentElement.classList.contains('power-low') && !matchMedia('(max-width: 760px)').matches;
    if (live) return { type: 'embed', src: abs(it.embed), title: raw.title || it.title, shots, size: raw.size, work: it.id };
    return resolveVisual({ ...raw, type: 'work' }, work, base);
  }
  if (raw.type === 'cards') return { ...raw, items: (raw.items || []).map((it) => ({ ...it, thumb: abs(it.thumb) })) };
  if (raw.type === 'video') { const src = abs(raw.src || it?.video); return src ? { type: 'video', src, poster: abs(raw.poster || it?.poster), title, shots, size: raw.size, work: it?.id, layout: raw.layout, sound: raw.sound, volume: raw.volume } : null; }
  if (raw.type === 'shots') return shots.length ? { type: 'shots', shots, title, size: raw.size, work: it?.id, cue: raw.cue } : null;
  if (raw.type === 'work' && it) {
    if (it.video) return { type: 'video', src: abs(it.video), poster: abs(it.poster), title, shots, size: raw.size, work: it.id };
    if (shots.length) return { type: 'shots', shots, title, size: raw.size, work: it.id };
  }
  return null;
}
