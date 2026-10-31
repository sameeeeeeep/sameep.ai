// podcast.js — the core: a studio where the host and the guest lip-sync to
// their clips, clean subtitles, a chapter map, transport, option cards and a
// "say where to go" field that steers the episode. The visitor is the audience:
// their avatar sits in the chooser, never on the studio set.
import { h, clamp, fillName, words, isNarrow, safeUrl, reducedMotion } from './util.js';
import { sound } from './audio.js';
import { Puppet } from './puppet.js';
import { spriteFrames } from './persona.js';
import { renderSubtitle } from './subtitle.js';
import { bestMatch, rankMatches } from './fuzzy.js';
import { openDemo, linkDialog } from './demos.js';
import { openCast, savedVisitor } from './cast.js';
import { Studio } from './stage.js';
import { loadWork, openWork } from './work.js';
import { Monitor, resolveVisual } from './monitor.js';
import { FlowBar } from './flowbar.js';
import { EpisodeMap, audienceEl, avatarEl, routeEl, cardEl, isUtility, chapterMap, mins } from './chooser.js';
import { isWispr, pick as pickVersion, shows } from '../version.js';

const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const estDur = (line) => Math.max(2.4, words(line.text) * 0.36 + 0.7);
const COPY = isWispr
  ? { placeholder: 'Say it with Flow…', hint: 'Hold your Wispr Flow key and talk. It lands in the field wherever you are. Or type. Or tap.', mic: 'Mic blocked. Type instead, or use your Wispr Flow key.' }
  : { placeholder: 'Say or type where to go…', hint: 'Type or dictate where to go. It lands in the field wherever you are. Or tap a card.', mic: 'Mic blocked. Type instead.' };
// auto-pick: how sure the match must be, and how long the "Heard" note waits
const SURE = 0.8, MARGIN = 0.12, SETTLE = 650, CONFIRM = 1500;

export class Podcast {
  constructor({ wm, layer, persona, episode, onEnd }) {
    this.wm = wm;
    this.layer = layer;
    this.persona = persona;
    this.ep = episode;
    this.onEnd = onEnd;
    this.base = persona.base;
    this.reduced = reducedMotion();
    const sv = savedVisitor();
    this.visitor = sv ? { name: sv.name || '', character: persona.characters.find((c) => c.id === sv.character) || null } : { name: '' };
    this.casted = false;
    this.history = [];
    this.visited = new Set();
    this.playing = false;
    this.token = 0;
    this.durs = [];
    this.lines = [];
    this.map = new EpisodeMap(episode, null, []);
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.crossOrigin = 'anonymous';
    this.sting = new Audio();
    this.sting.volume = 0.55;
    this.stingN = 0;
    this.sting.addEventListener('error', () => {
      // a sting the script names may not exist: rotate through the persona's stings instead
      const list = (this.persona.music?.stings || []).map((u) => this.#abs(u)).filter(Boolean);
      if (!list.length || this.stingRetry) return;
      this.stingRetry = true;
      this.sting.src = list[this.stingN++ % list.length];
      this.sting.play().catch(() => {});
    });
    this.bed = new Audio();
    this.bed.loop = true;
    this.bed.volume = 0.32;
    this.#resolveSpeakers();
    this.#castNode();
  }

  #abs(u) { return u ? safeUrl(u, this.base) : null; }

  #resolveSpeakers() {
    const sp = this.ep.speakers || {};
    const keys = Object.keys(sp);
    this.hostKey = keys.includes('host') ? 'host' : keys[0] || 'host';
    this.guestKey = keys.find((k) => k !== this.hostKey) || 'guest';
    const P = this.persona;
    this.speakers = {
      [this.hostKey]: { name: sp[this.hostKey]?.name || P.hostName, frames: spriteFrames(sp[this.hostKey]?.sprite, this.base) || P.hostFrames, seat: 'host' },
      [this.guestKey]: { name: sp[this.guestKey]?.name || P.guestName, frames: spriteFrames(sp[this.guestKey]?.sprite, this.base) || P.guestFrames, seat: 'guest' },
    };
  }

  // where the "pick your avatar" moment happens
  #castNode() {
    const N = this.ep.nodes || {};
    this.castAt = Object.keys(N).find((k) => N[k].cast || (N[k].lines || []).some((l) => l.action === 'cast'))
      || (N.intro ? 'intro' : this.ep.start);
  }

  // ------------------------------------------------------------------ chapters
  #chapters() {
    if (Array.isArray(this.ep.chapters) && this.ep.chapters.length) {
      return this.ep.chapters.filter((c) => this.ep.nodes[c.to]).map((c) => ({ label: c.label, to: c.to }));
    }
    const out = [], seen = new Set(), labels = new Set(), q = [this.ep.start];
    while (q.length) {
      const id = q.shift();
      if (seen.has(id) || !this.ep.nodes[id]) continue;
      seen.add(id);
      const n = this.ep.nodes[id];
      if (n.chapter && !labels.has(n.chapter)) { labels.add(n.chapter); out.push({ label: n.chapter, to: id }); }
      (n.choices || []).forEach((c) => q.push(c.to));
      if (n.next) q.push(n.next);
    }
    if (!this.ep.chapters) this.ep.chapters = out;
    return out;
  }

  // ------------------------------------------------------------------ UI
  open() {
    const P = this.persona;
    const L = this.layer.getBoundingClientRect();
    // leave the right-hand icon column visible on wide screens
    const reserve = L.width > 1180 ? 330 : L.width > 900 ? 120 : 0;
    const w = Math.min(1180, L.width - 40 - reserve);
    const hgt = Math.min(780, L.height - 28);
    this.win = this.wm.win('podcast', {
      title: `${P.showName} — ${P.episodeTitle || ''}`.replace(/ — $/, ''),
      width: w, height: hgt, persist: true,
      x: Math.max(12, (L.width - reserve - w) / 2), y: Math.max(12, (L.height - hgt) / 2),
      className: 'win--podcast',
      label: 'Podcast player',
      onClose: () => this.pause(),
    });
    this.win.onShow = () => { this.#layout(); this.flow?.ensureFocus(); };
    this.chapterList = this.#chapters();
    this.#build(this.win.body);
    this.#renderChapters();
    this.#loadMeta();
    this.#loop();
    return this;
  }

  // durations (from ffprobe, data/durations.json) + work.json for visuals and tags
  async #loadMeta() {
    const durP = this.persona.isCustom ? Promise.resolve(null)
      : fetch(safeUrl('data/durations.json', this.base), { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const workP = (this.workP ||= loadWork(this.persona).catch(() => ({ list: [], base: this.base })));
    const [dur, work] = await Promise.all([durP, workP]);
    this.workList = work.list || [];
    this.workBase = work.base || this.base;
    this.map = new EpisodeMap(this.ep, dur, this.workList);
    this.#renderChapters();
    if (this.node) {
      this.#renderChips(); this.#renderChooser();
      const l = this.lines[this.li];
      if (l && this.mode) this.#visual(l, this.speakers[l.who]?.seat || 'host');
    }
  }

  #build(body) {
    const P = this.persona;
    this.studio = new Studio({ persona: P, speakers: this.speakers, hostKey: this.hostKey, guestKey: this.guestKey, reduced: this.reduced });
    const stage = this.studio.el;
    this.seats = this.studio.seats;
    this.onAir = this.studio.onAir;
    this.studioReady = this.studio.init();
    this.name = h('p.lower3__name');
    this.sub = h('p.lower3__sub', { 'aria-live': 'polite' });
    const lower3 = h('div.lower3', h('div.lower3__head', this.name), this.sub);
    if (isNarrow()) stage.classList.add('stage--narrow');
    this.stage = stage;
    this.monitor = new Monitor(stage, { base: this.base, reduced: this.reduced, onOpenWork: (id) => openWork(this.wm, this.persona, { focusId: id }) });
    this.monitor.onSkip = () => { this.visSkip = this.nodeId; };

    // puppets
    const ph = { host: { color: '#7b4fd6', skin: '#e0b48c', hair: '#c7c7c7' }, guest: { color: '#0a8fa8', skin: '#b07a52', hair: '#1c120c' } };
    this.puppets = {};
    for (const [key, sp] of Object.entries(this.speakers)) {
      this.puppets[key] = new Puppet(this.seats[sp.seat], { frames: sp.frames, label: sp.name, placeholder: ph[sp.seat] });
      this.puppets[key].load();
    }
    // close-up puppets (full-frame cu-* frames) once the manifest says they exist
    this.cuPuppets = {};
    this.studioReady.then(() => {
      for (const [key, sp] of Object.entries(this.speakers)) {
        const frames = this.studio.cuFrames(sp.seat);
        if (!frames) continue;
        const pp = new Puppet(this.studio.cu[sp.seat], { frames, label: sp.name + ', close-up' });
        this.cuPuppets[key] = pp;
        pp.load().then(() => { if (!this.studio.cu[sp.seat].classList.contains('is-placeholder')) this.studio.hasCU[sp.seat] = true; });
      }
    });

    // transport
    this.btnBack = h('button.tbtn', { type: 'button', 'aria-label': 'Back', title: 'Back (←)', onclick: () => this.back() }, h('span.ico.ico--back'));
    this.btnPlay = h('button.tbtn.tbtn--play', { type: 'button', 'aria-label': 'Pause', title: 'Play / pause (space)', onclick: () => this.toggle() }, h('span.ico.ico--pause'));
    this.btnSkip = h('button.tbtn', { type: 'button', 'aria-label': 'Skip', title: 'Skip (→)', onclick: () => this.skip() }, h('span.ico.ico--skip'));
    this.scrubFill = h('div.scrub__fill');
    this.scrubKnob = h('div.scrub__knob');
    this.scrubTicks = h('div.scrub__ticks');
    this.scrub = h('div.scrub', { role: 'slider', tabindex: '0', 'aria-label': 'Scrub this segment', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' },
      h('div.scrub__track', this.scrubTicks, this.scrubFill), this.scrubKnob);
    this.time = h('span.time', '00:00 / 00:00');
    this.nodeLabel = h('span.now__label');
    const transport = h('div.transport', this.btnBack, this.btnPlay, this.btnSkip, this.scrub, this.time);
    this.#wireScrub();

    // steering: the audience badge, quick chips, the say field
    this.audBadge = h('span.steer__aud');
    this.chips = h('div.chips', { role: 'group', 'aria-label': 'Pull a thread' });
    this.sayIn = h('input.say__input', { type: 'text', placeholder: COPY.placeholder, 'aria-label': 'Say or type where to go next', autocomplete: 'off', enterkeyhint: 'go', spellcheck: 'false', autocapitalize: 'off' });
    this.sayMsg = h('div.say__msg', { 'aria-live': 'polite' });
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.mic = SR ? h('button.say__mic', { type: 'button', 'aria-label': 'Speak (uses your browser’s speech recognition)', title: 'Speak', onclick: () => this.#listen(SR) }, h('span.ico.ico--mic')) : null;
    this.sayForm = h('form.say', { onsubmit: (e) => { e.preventDefault(); this.#steer(this.sayIn.value); } },
      h('span.say__flow', { 'aria-hidden': 'true' }, isWispr ? h('img', { src: 'img/ui/wispr.svg', alt: '', width: 20, height: 20 }) : h('span.say__caret', '›')),
      this.sayIn, this.mic, h('button.say__go', { type: 'submit', 'aria-label': 'Go' }, 'Go'));
    const steer = h('div.steer', h('div.steer__label', this.audBadge, h('span.steer__k', 'Pull a thread'), this.nodeLabel), this.chips, this.sayForm, this.sayMsg);

    // the chooser (cards) — overlays the picture at a fork on desktop, sits in the flow on phones
    this.chooser = h('section.chooser', { hidden: true, 'aria-label': 'Choose what’s next' });

    // chapters (a map of the episode)
    this.chapEl = h('ol.chapters.cmap');
    this.routeSide = h('div.side__route');
    const side = h('aside.pod__side', h('h3.side__title', 'Episode map'), this.routeSide, this.chapEl,
      h('p.side__hint', COPY.hint));
    const chapDrawer = h('details.chap-drawer', h('summary', h('span', 'Episode map'), h('span.chap-drawer__meta')), h('div.chap-drawer__body'));

    this.stageCol = h('div.stage-col', stage, lower3);
    this.stageBox = h('div.stage-box', this.stageCol);
    this.main = h('div.pod__main', this.stageBox, transport, steer, chapDrawer);
    this.root = h('div.pod', this.main, side);
    this.lower3 = lower3;
    this.steer = steer;
    this.chapDrawer = chapDrawer;
    body.append(this.root);
    this.#layout();
    this.mq = matchMedia('(max-width: 760px)');
    this.mq.addEventListener?.('change', () => this.#layout());
    new ResizeObserver(() => this.#layout()).observe(this.layer);

    // keyboard
    this.win.el.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, [contenteditable]')) return;
      if (e.key === ' ') { e.preventDefault(); this.toggle(); }
      else if (e.key === 'ArrowRight' && e.target !== this.scrub) this.skip();
      else if (e.key === 'ArrowLeft' && e.target !== this.scrub) this.back();
    });

    // dictation / typing / paste, however it arrives
    this.flow = new FlowBar({
      input: this.sayIn,
      scope: this.win.el,
      isLive: () => !this.win.el.hidden && !this.win.body.querySelector('.cast'),
      onValue: (v, how) => this.#heardChange(v, how),
      onSubmit: (v) => this.#steer(v),
      onKey: (k) => { if (k === ' ') this.toggle(); else if (k === 'ArrowRight') this.skip(); else this.back(); },
    });
    this.sayIn.addEventListener('focus', () => this.root.classList.add('is-listening'));
    this.sayIn.addEventListener('blur', () => this.root.classList.remove('is-listening'));

    // audio graph for lip-sync
    const ctx = sound.ensure();
    if (ctx) {
      try {
        const src = ctx.createMediaElementSource(this.audio);
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 1024;
        this.buf = new Float32Array(this.analyser.fftSize);
        src.connect(this.analyser);
        this.analyser.connect(sound.master);
        const st = ctx.createMediaElementSource(this.sting);
        st.connect(sound.master);
        const bedSrc = ctx.createMediaElementSource(this.bed);
        this.bedGain = ctx.createGain();
        this.bedGain.gain.value = 0.55;
        bedSrc.connect(this.bedGain).connect(sound.master);
      } catch (e) { console.warn('[podcast] analyser', e); }
    }
    this.audio.addEventListener('ended', () => this.#lineEnded(this.token));
    this.audio.addEventListener('error', () => this.#fallback(this.token));
    this.audio.addEventListener('loadedmetadata', () => {
      if (isFinite(this.audio.duration) && this.mode === 'audio') { this.durs[this.li] = this.audio.duration; this.#ticks(); }
    });
    this.#renderAudience();
  }

  #layout() {
    const narrow = isNarrow();
    const side = this.root.querySelector('.pod__side');
    const drawer = this.chapDrawer.querySelector('.chap-drawer__body');
    if (narrow && this.chapEl.parentElement !== drawer) drawer.append(this.routeSide, this.chapEl);
    if (!narrow && this.chapEl.parentElement !== side) side.insertBefore(this.chapEl, side.querySelector('.side__hint')), side.insertBefore(this.routeSide, this.chapEl);
    this.stage.classList.toggle('stage--narrow', narrow);
    this.monitor.narrow = narrow;
    this.monitor.panelHost = this.stageCol;
    // the chooser: over the picture on desktop, under the say field on phones
    if (narrow && this.chooser.parentElement !== this.main) this.steer.after(this.chooser);
    if (!narrow && this.chooser.parentElement !== this.stageCol) this.stageCol.append(this.chooser);
    // short desktop screens: the map lives in the transport row as a popover
    const short = !narrow && matchMedia('(max-height: 780px)').matches;
    const transport = this.root.querySelector('.transport');
    if (short && this.chapDrawer.parentElement !== transport) transport.append(this.chapDrawer);
    if (!short && this.chapDrawer.parentElement === transport) this.main.append(this.chapDrawer);
    // keep the window fitted to the screen
    if (!narrow && this.win && !this.win.el.classList.contains('win--sheet')) {
      const L = this.layer.getBoundingClientRect();
      const hh = Math.min(780, L.height - 28);
      this.win.el.style.height = hh + 'px';
      const top = parseFloat(this.win.el.style.top) || 12;
      if (top + hh > L.height - 8) this.win.el.style.top = Math.max(8, L.height - hh - 12) + 'px';
    }
  }

  #renderChapters() {
    if (!this.chapEl) return;
    const cur = this.node?.chapter;
    this.chapEl.replaceChildren(...chapterMap(this.map, {
      visited: this.visited, currentChapter: cur,
      onGo: (to) => { this.chapDrawer.open = false; this.go(to, { from: 'chapter' }); },
    }));
    const r = routeEl(this.map, this.visited, { onJump: (s) => this.go(s, { from: 'chapter' }) });
    this.routeSide.replaceChildren(...(r ? [r] : []));
    const meta = this.chapDrawer.querySelector('.chap-drawer__meta');
    const p = this.map.routeProgress(this.visited);
    if (meta) meta.textContent = p.total ? `route ${p.done}/${p.total}${p.left && p.done < p.total ? ' · ≈ ' + mins(p.left) + ' left' : ''}` : '';
  }

  #markChapter() {
    const label = this.node?.chapter;
    this.#renderChapters();
    this.nodeLabel.textContent = label ? '· ' + (this.node.title && this.node.title !== label ? `${label} · ${this.node.title}` : label) : '';
  }

  #renderAudience(line) {
    this.audBadge.replaceChildren(avatarEl(this.visitor, 'steer__av'), h('span.steer__you', this.visitor?.name ? `${this.visitor.name}, in the audience` : 'You, in the audience'));
    if (this.chooserAud) this.chooserAud.replaceWith((this.chooserAud = audienceEl(this.visitor, line)));
  }

  // ------------------------------------------------------------------ playback
  start() { this.go(this.ep.start || Object.keys(this.ep.nodes)[0], { push: false }); }

  go(id, { push = true, from } = {}) {
    const node = this.ep.nodes[id];
    if (!node) { console.warn('[podcast] missing node', id); return; }
    if (push && this.nodeId) this.history.push(this.nodeId);
    this.nodeId = id;
    this.node = node;
    this.visited.add(id);
    // this version's lines (text/audio overrides, version-only lines)
    this.lines = (node.lines || []).filter(shows).map((l) => ({ ...l, ...pickVersion(l) }));
    this.durs = this.lines.map(estDur);
    this.#preloadDurations();
    this.visSkip = null;
    this.monitor.hide();
    this.#cancelConfirm();
    this.#renderChips();
    this.#markChapter();
    this.#ticks();
    this.#msg('');
    this.root.classList.remove('is-waiting');
    this.chooser.hidden = true;
    if (from) this.studio.loading();
    if (node.sting) this.#sting(node.sting);
    this.playing = true;
    this.#setPlayIcon();
    this.flow.ensureFocus();
    if (!this.lines.length) return this.#nodeEnded();
    this.#playLine(0, 0);
  }

  #preloadDurations() {
    const tok = this.nodeId;
    this.lines.forEach((l, i) => {
      const u = this.#abs(l.audio);
      if (!u) return;
      const a = new Audio();
      a.preload = 'metadata';
      a.addEventListener('loadedmetadata', () => { if (this.nodeId === tok && isFinite(a.duration)) { this.durs[i] = a.duration; this.#ticks(); } }, { once: true });
      a.src = u;
    });
  }

  #playLine(i, offset = 0) {
    const line = this.lines[i];
    if (!line) return this.#nodeEnded();
    const tok = ++this.token;
    this.li = i;
    this.subCtl?.cancel();
    const who = this.speakers[line.who] ? line.who : (line.who === 'guest' ? this.guestKey : this.hostKey);
    this.activeKey = who;
    for (const [k, p] of Object.entries(this.puppets)) p.setActive(k === who);
    const seat = this.speakers[who]?.seat || 'host';
    // shot grammar: wide to open a segment, medium on a change of speaker,
    // close-up on punchlines (or when the script says so)
    const prevSeat = this.studio.who;
    this.studio.setSpeaker(seat);
    this.studio.look?.(seat, line);
    if (offset < 0.25) {
      const wc = words(line.text);
      const punch = line.shot === 'cu' || (wc <= 12 && /[!?]["”’]?$/.test(line.text.trim()));
      const shot = line.shot || (i === 0 && !this.cutIn ? 'wide' : punch ? 'cu' : seat !== prevSeat || this.studio.shot === 'wide' ? 'ms' : this.studio.shot === 'cu' ? 'ms' : this.studio.shot);
      this.cutIn = false;
      this.studio.cut(shot, seat);
    }
    this.name.textContent = this.speakers[who]?.name || who;
    const text = fillName(line.text, this.visitor?.name);
    this.subCtl = renderSubtitle(this.sub, { text });
    this.studio.cutaway(line.cutaway ? this.#abs(line.cutaway) : null, line.text);
    this.#visual(line, seat);
    this.sub.classList.toggle('is-long', words(text) > 34);
    this.sub.scrollTop = 0;
    if (offset < 0.25 && line.offer) this.#offer();
    if (offset < 0.25) {
      if (line.sting) this.#sting(line.sting);
      if (line.demo) this.#demo(line.demo);
    }
    // the host "…" thinks for a beat before speaking (game-UI touch)
    if (offset < 0.25 && seat === 'host' && this.playing && !this.reduced && this.lastThink !== tok) {
      this.lastThink = tok;
      this.mode = 'hold';
      this.studio.thinking('host', 480).then(() => { if (tok === this.token) this.#startLine(line, offset, tok); });
      return;
    }
    this.#startLine(line, offset, tok);
  }

  // the studio monitor: a line's own visual, else the node's project on the
  // guest's lines; host lines keep whatever is up. × skips visuals for the node.
  #visual(line, seat) {
    if (this.visSkip === this.nodeId || line.cutaway || line.visual === 'none') { if (line.cutaway || line.visual === 'none') this.monitor.hide(); return; }
    const work = this.workList || [];
    if (line.visual) {
      const v = resolveVisual(line.visual, work, this.workBase || this.base);
      if (v) return this.monitor.show(v, 'line:' + line.id);
    }
    if (seat === 'host') return; // keep what's showing
    if (this.node.work && work.length) {
      const v = resolveVisual({ type: 'work', work: this.node.work }, work, this.workBase || this.base);
      if (v) return this.monitor.show(v, 'work:' + this.node.work);
    }
    this.monitor.hide();
  }

  #startLine(line, offset, tok) {
    // audio, else a word-count timer
    const url = this.#abs(line.audio);
    this.offset = offset;
    if (url && !this.failed?.has(url)) {
      this.mode = 'audio';
      if (this.audio.src !== url) this.audio.src = url;
      const seek = () => { try { this.audio.currentTime = offset; } catch { /* noop */ } };
      if (offset > 0) { if (this.audio.readyState >= 1) seek(); else this.audio.addEventListener('loadedmetadata', seek, { once: true }); }
      else if (this.audio.readyState >= 1) seek();
      if (this.playing) this.audio.play().catch((e) => { if (e.name !== 'AbortError') this.#fallback(tok); });
    } else {
      this.#timerMode(offset);
    }
  }

  #timerMode(offset) {
    this.mode = 'timer';
    this.audio.pause();
    this.tStart = performance.now() - offset * 1000;
    this.tPaused = this.playing ? null : offset;
  }

  #fallback(tok) {
    if (tok !== this.token || this.mode === 'timer') return;
    const url = this.audio.src;
    (this.failed ||= new Set()).add(url);
    const at = this.audio.currentTime || 0;
    this.durs[this.li] = estDur(this.lines[this.li]);
    this.#timerMode(Math.min(at, this.durs[this.li] - 0.5));
    this.#ticks();
  }

  get t() {
    if (this.mode === 'hold') return 0;
    if (this.mode === 'audio') return this.audio.currentTime || 0;
    if (this.tPaused != null) return this.tPaused;
    return (performance.now() - (this.tStart || 0)) / 1000;
  }

  #lineEnded(tok) {
    if (tok !== this.token) return;
    const next = this.li + 1;
    this.mode = null;
    if (next < this.lines.length) {
      setTimeout(() => { if (tok === this.token && this.playing) this.#playLine(next, 0); else if (tok === this.token) { this.li = next; this.pendingLine = true; } }, 280);
    } else this.#nodeEnded();
  }

  async #nodeEnded() {
    const tok = ++this.token;
    this.mode = null;
    for (const p of Object.values(this.puppets)) p.setActive(false);
    // the cast call: after the host introduces the show, the visitor joins the audience
    if (!this.casted && this.nodeId === this.castAt) {
      this.casted = true;
      await this.#cast();
      if (tok !== this.token) return;
    }
    const n = this.node;
    if (n.end || (!n.choices?.length && !n.next) || this.nodeId === 'outro') this.onEnd?.();
    if (n.choices?.length) {
      this.root.classList.add('is-waiting');
      this.playing = false;
      this.#setPlayIcon();
      this.monitor.hide();
      this.#renderChooser();
      this.chooser.hidden = false;
      setTimeout(() => this.flow.ensureFocus(), 50);
      // something was said while the answer played: use it now
      if (this.queued) { const q = this.queued; this.queued = null; this.#heard(q, { atFork: true }); }
    } else if (n.next) {
      setTimeout(() => { if (tok === this.token) this.go(n.next); }, 900);
    } else {
      this.playing = false;
      this.#setPlayIcon();
    }
  }

  async #cast() {
    this.pause();
    const v = await openCast(this.win.body, { persona: this.persona, hostName: this.speakers[this.hostKey]?.name });
    this.visitor = v;
    this.#renderAudience();
    this.playing = true;
    this.#setPlayIcon();
    this.flow.ensureFocus();
  }

  recast() { this.#cast(); }

  // dev/QA: set an audience avatar without the picker (?debug&seat=<id>)
  seatForQA(id, name = 'Asha') {
    const c = this.persona.characters.find((x) => x.id === id);
    if (!c) return;
    this.casted = true;
    this.visitor = { name, character: { ...c } };
    this.#renderAudience();
    if (this.node) this.#renderChooser();
  }

  // ------------------------------------------------------------------ steering
  #renderChips() {
    const n = this.node;
    const rec = this.map.recommended(this.nodeId, this.visited);
    const chips = (n.choices || []).map((c, i) => {
      const util = isUtility(this.map, c);
      const to = c.to;
      const entry = this.map.isChapterEntry(to) && this.map.N[to]?.chapter !== n.chapter;
      const m = util ? '' : mins(entry ? this.map.chapterSec(to) : this.map.sec(to));
      return h('button.chip' + (i === rec ? '.is-rec' : '') + (util ? '.chip--util' : ''), { type: 'button', dataset: { i: String(i) }, onclick: () => this.#pick(c, c.label, true) },
        c.label, m && h('span.chip__m', m));
    });
    if (!chips.length && n.next && this.ep.nodes[n.next]) {
      const nx = this.ep.nodes[n.next];
      chips.push(h('button.chip.chip--next', { type: 'button', onclick: () => this.go(n.next) }, 'Next: ' + (nx.chapter && nx.chapter !== n.chapter ? nx.chapter : 'keep going')));
    }
    this.chips.replaceChildren(...chips);
  }

  #renderChooser() {
    const n = this.node;
    if (!n?.choices?.length) { this.chooser.replaceChildren(); return; }
    const rec = this.map.recommended(this.nodeId, this.visited);
    const ctx = { visited: this.visited, current: this.nodeId, onPick: (c, said, g) => this.#pick(c, said, g) };
    const cards = [], utils = [];
    n.choices.forEach((c, i) => {
      if (isUtility(this.map, c)) utils.push(h('button.ubtn' + (c.demo?.type === 'link' ? '.ubtn--link' : '') + (i === rec ? '.is-rec' : ''), { type: 'button', dataset: { i: String(i) }, onclick: () => this.#pick(c, c.label, true) }, c.label + (c.demo?.type === 'link' ? ' ↗' : '')));
      else cards.push(cardEl(this.map, c, i, { ...ctx, rec: i === rec }));
    });
    const host = this.speakers[this.hostKey]?.name?.split(' ')[0] || 'The host';
    this.chooserAud = audienceEl(this.visitor, `${host} is waiting on you`);
    const total = this.map.D.totalSec;
    this.chooser.replaceChildren(...[
      h('div.chooser__head', this.chooserAud, h('button.chooser__min', { type: 'button', 'aria-label': 'Hide the options and see the studio', title: 'See the studio', onclick: () => this.chooser.classList.toggle('is-min') }, h('span', { 'aria-hidden': 'true' }, '▾'))),
      h('div.chooser__cards', cards),
      utils.length ? h('div.chooser__utils', utils) : null,
      h('div.chooser__foot', routeEl(this.map, this.visited, { onJump: (s) => this.go(s, { from: 'chapter' }) }), total ? h('span.chooser__all', `Whole episode ≈ ${Math.round(total / 60)} min`) : null)].filter(Boolean));
    this.chooser.classList.remove('is-min');
  }

  #items() {
    const n = this.node;
    const items = (n.choices || []).map((c, i) => ({ key: 'c' + i, choice: c, phrases: [c.label, ...(c.say || []), this.map.title(c.to)].filter(Boolean) }));
    this.chapterList.forEach((c) => items.push({ key: 'ch:' + c.to, to: c.to, label: c.label, phrases: [c.label, this.map.title(c.to)], weight: 0.8 }));
    items.push(
      { key: 'skip', cmd: 'skip', phrases: ['skip', 'next', 'continue', 'go on', 'keep going', 'move on'], weight: 0.95 },
      { key: 'back', cmd: 'back', phrases: ['back', 'go back', 'previous', 'rewind'], weight: 0.95 },
      { key: 'pause', cmd: 'pause', phrases: ['pause', 'stop', 'hold on', 'wait'], weight: 0.95 },
      { key: 'play', cmd: 'play', phrases: ['play', 'resume', 'unpause'], weight: 0.95 },
      { key: 'menu', cmd: 'menu', phrases: ['menu', 'main menu', 'what else', 'other topics', 'something else'], weight: 0.9 },
    );
    return items;
  }

  #preview(q) {
    const m = q.trim().length > 1 ? bestMatch(q, this.#items().filter((i) => i.choice), 0.45) : null;
    const k = m ? m.item.key.slice(1) : null;
    this.root.querySelectorAll('.chip[data-i], .card[data-i], .ubtn[data-i]').forEach((c) => c.classList.toggle('is-match', k != null && c.dataset.i === k));
  }

  #msg(content, kind = '') {
    this.sayMsg.className = 'say__msg' + (kind ? ' say__msg--' + kind : '');
    this.sayMsg.replaceChildren(...[].concat(content || []));
  }

  #targetLabel(it) {
    if (it.choice) return it.choice.demo?.type === 'link' ? it.choice.label : this.map.title(it.choice.to) || it.choice.label;
    if (it.to) return it.label || this.map.title(it.to);
    return { skip: 'skip', back: 'back', pause: 'pause', play: 'play', menu: 'the menu' }[it.cmd];
  }

  // any change to the field, however it arrived: debounce, then decide
  #heardChange(v) {
    this.#preview(v);
    clearTimeout(this.settleT);
    if (this.confirm && v.trim() !== this.confirm.q) this.#cancelConfirm(true);
    if (!v.trim()) { if (!this.confirm) this.#msg(''); return; }
    this.settleT = setTimeout(() => this.#heard(v), SETTLE);
  }

  #heard(raw, { atFork = false } = {}) {
    const q = String(raw || '').trim();
    if (q.length < 3) return;
    const ranked = rankMatches(q, this.#items());
    const [a, b] = ranked;
    const waiting = atFork || this.root.classList.contains('is-waiting');
    if (!a || a.score < 0.5) {
      if (!this.node.choices?.length && !waiting) {
        // nothing to pick from yet: hold it for when the options appear
        this.queued = q;
        this.#msg([h('span.say__k', 'Heard'), ` “${q}”. I’ll match it when the options come up.`], 'queued');
      } else this.#msg([h('span.say__k', 'Heard'), ` “${q}”. No thread by that name yet. Try a card, or say “skip”.`], 'miss');
      return;
    }
    const tgt = (it) => it.choice?.to || it.to || it.cmd;
    const sure = a.score >= SURE && (!b || a.score - b.score >= MARGIN || (tgt(b.item) === tgt(a.item) && !a.item.choice?.demo));
    const label = this.#targetLabel(a.item);
    if (!sure) {
      this.#msg([h('span.say__k', 'Heard'), ` “${q}”. Did you mean `, h('button.say__link', { type: 'button', onclick: () => this.#steer(q) }, label), '? Press Enter.'], 'maybe');
      return;
    }
    if (a.item.cmd && a.item.cmd !== 'menu') return this.#steer(q); // transport commands act at once
    if (!waiting) {
      // mid-answer: queue it, go when the options appear (or now, if they say so)
      this.queued = q;
      this.#msg([h('span.say__k', 'Heard'), ` “${q}” → ${label}, after this answer. `,
        h('button.say__link', { type: 'button', onclick: () => { this.queued = null; this.#steer(q); } }, 'Go now'), ' · ',
        h('button.say__link', { type: 'button', onclick: () => { this.queued = null; this.flow.set(''); this.#preview(''); this.#msg(''); } }, 'Cancel')], 'queued');
      return;
    }
    // at a fork: a short visible confirmation, then go
    this.#cancelConfirm();
    const bar = h('i.say__bar', { style: { animationDuration: CONFIRM + 'ms' } });
    this.#msg([h('span.say__k', 'Heard'), ` “${q}” → going to ${label} `, bar,
      h('button.say__link', { type: 'button', 'data-keep-focus': '', onclick: () => { this.#cancelConfirm(true); this.flow.set(''); this.#preview(''); this.#msg('Cancelled. Pick again.'); } }, 'Cancel')], 'go');
    this.confirm = { q, t: setTimeout(() => { this.confirm = null; this.#steer(q); }, this.reduced ? 500 : CONFIRM) };
  }

  #cancelConfirm(quiet) {
    if (!this.confirm) return;
    clearTimeout(this.confirm.t);
    this.confirm = null;
    if (!quiet) this.#msg('');
  }

  #steer(q) {
    q = String(q || '').trim();
    clearTimeout(this.settleT);
    this.#cancelConfirm(true);
    if (!q) return;
    const m = bestMatch(q, this.#items(), 0.5);
    if (!m) {
      this.#msg([h('span.say__k', 'Heard'), ` “${q}”. No thread by that name yet. Try a card, or say “skip”.`], 'miss');
      this.sayForm.classList.remove('is-miss');
      void this.root.offsetWidth;
      this.sayForm.classList.add('is-miss');
      sound.tick('error');
      return;
    }
    this.flow.set('');
    this.queued = null;
    this.#preview('');
    this.#msg('');
    const it = m.item;
    if (it.choice) return this.#pick(it.choice, q, !this.rec);
    if (it.to) return this.#pick({ to: it.to, label: q }, q);
    if (it.cmd === 'skip') this.skip();
    if (it.cmd === 'back') this.back();
    if (it.cmd === 'pause') this.pause();
    if (it.cmd === 'play') this.play();
    if (it.cmd === 'menu') { const hub = this.ep.nodes.hub ? 'hub' : this.ep.start; this.#pick({ to: hub, label: q }, q); }
  }

  // the audience picks: the card flashes, the host takes it from there
  #pick(choice, said, gesture = false) {
    // a choice can carry a demo ("Open it" / "Show me here")
    if (choice.demo) {
      const d = choice.demo;
      const url = d.type === 'link' ? safeUrl(d.url, this.base) : null;
      if (url && gesture) window.open(url, '_blank', 'noopener');
      else this.#demo(d);
    }
    this.offerWin?.close();
    this.queued = null;
    this.#cancelConfirm(true);
    sound.tick('pick');
    const tok = ++this.token;
    this.audio.pause();
    this.subCtl?.cancel();
    const i = (this.node.choices || []).indexOf(choice);
    this.root.querySelectorAll(`.card[data-i="${i}"], .chip[data-i="${i}"]`).forEach((c) => c.classList.add('is-picked'));
    this.audBadge.classList.add('is-picked');
    setTimeout(() => this.audBadge.classList.remove('is-picked'), 900);
    setTimeout(() => {
      if (tok !== this.token) return;
      this.go(choice.to, { from: 'pick' });
    }, this.reduced ? 120 : 320);
  }

  #listen(SR) {
    if (this.rec) { this.rec.stop(); return; }
    const rec = new SR();
    rec.lang = navigator.language || 'en-US';
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    this.rec = rec;
    this.mic.classList.add('is-on');
    let finalText = '';
    rec.onresult = (e) => {
      let s = '';
      for (const r of e.results) { s += r[0].transcript; if (r.isFinal) finalText = s; }
      this.flow.set(s);
      this.#preview(s);
    };
    rec.onerror = (e) => { this.#msg(e.error === 'not-allowed' ? COPY.mic : 'Didn’t catch that.', 'miss'); };
    rec.onend = () => {
      this.rec = null;
      this.mic.classList.remove('is-on');
      if (finalText) this.#steer(finalText);
    };
    try { rec.start(); } catch { this.rec = null; this.mic.classList.remove('is-on'); }
  }

  // ------------------------------------------------------------------ transport
  play() {
    if (this.playing) return;
    if (this.root.classList.contains('is-waiting') && this.mode == null) {
      // replay the last line of a finished node
      this.root.classList.remove('is-waiting');
      this.chooser.hidden = true;
      this.playing = true; this.#setPlayIcon();
      return this.#playLine(Math.max(0, this.lines.length - 1), 0);
    }
    this.playing = true;
    this.#setPlayIcon();
    if (this.pendingLine) { this.pendingLine = false; return this.#playLine(this.li, 0); }
    if (this.mode === 'audio') this.audio.play().catch(() => this.#fallback(this.token));
    else if (this.mode === 'timer') { this.tStart = performance.now() - (this.tPaused || 0) * 1000; this.tPaused = null; }
  }
  pause() {
    if (!this.playing) return;
    this.playing = false;
    this.#setPlayIcon();
    if (this.mode === 'audio') this.audio.pause();
    else if (this.mode === 'timer') this.tPaused = this.t;
  }
  toggle() { this.playing ? this.pause() : this.play(); }
  skip() {
    if (!this.node) return;
    if (this.root.classList.contains('is-waiting')) {
      // at a fork: skip takes the recommended card, else the default path
      const rec = this.map.recommended(this.nodeId, this.visited);
      const c = this.node.choices?.[rec];
      if (c) this.#pick(c, c.label);
      else if (this.node.next) this.go(this.node.next);
      return;
    }
    this.playing = true; this.#setPlayIcon();
    if (this.li + 1 < this.lines.length) this.#playLine(this.li + 1, 0);
    else { this.audio.pause(); this.#nodeEnded(); }
  }
  back() {
    if (!this.node) return;
    this.root.classList.remove('is-waiting');
    this.chooser.hidden = true;
    this.playing = true; this.#setPlayIcon();
    if (this.mode && this.t > 2) return this.#playLine(this.li, 0);
    if (this.li > 0 && this.mode) return this.#playLine(this.li - 1, 0);
    if (!this.mode && this.lines.length) return this.#playLine(Math.max(0, this.lines.length - 1), 0);
    const prev = this.history.pop();
    if (prev) this.go(prev, { push: false });
    else this.#playLine(0, 0);
  }

  #bedSync() {
    const u = this.#abs(this.persona.music?.bed);
    if (!u) return;
    if (this.playing) {
      if (!this.bed.src) this.bed.src = u;
      this.bed.play().catch(() => {});
    } else this.bed.pause();
  }

  #setPlayIcon() {
    this.#bedSync();
    this.btnPlay.querySelector('.ico').className = 'ico ' + (this.playing ? 'ico--pause' : 'ico--play');
    this.btnPlay.setAttribute('aria-label', this.playing ? 'Pause' : 'Play');
    this.onAir?.classList.toggle('is-on', this.playing);
  }

  #sting(u) {
    const url = this.#abs(u);
    if (!url) return;
    this.stingRetry = false;
    this.sting.src = url;
    this.sting.currentTime = 0;
    this.sting.play().catch(() => {});
  }

  async #demo(demo) {
    if (demo.type !== 'link') {
      const card = await this.#cardFor(demo);
      await this.studio.itemCard(card);
    }
    openDemo(demo, {
      wm: this.wm,
      getName: () => this.visitor?.name,
      askName: (q) => this.#askName(q),
      anchor: (big) => {
        const L = this.layer.getBoundingClientRect();
        const W = this.win.el.getBoundingClientRect();
        const dw = big ? 560 : 380;
        if (L.width - (W.right - L.left) > dw + 24) return { x: W.right - L.left + 12, y: W.top - L.top + 24 };
        return { x: L.width - dw - 20, y: Math.max(16, W.top - L.top + 40) };
      },
    });
  }

  askName(q) { return this.#askName(q); }

  // "Shall I open that in a new tab?" — the host offers; the dialog carries the link
  #offer() {
    const n = this.node;
    const linkChoice = (n.choices || []).find((c) => c.demo?.type === 'link' && c.demo.url);
    const anyDemo = linkChoice?.demo || (n.choices || []).find((c) => c.demo?.url)?.demo || [...this.lines].reverse().find((l) => l.demo?.url)?.demo;
    if (!anyDemo) return;
    const url = safeUrl(anyDemo.url.replace(/\{[a-z]+\}/g, ''), this.base);
    if (!url) return;
    const hereChoice = (n.choices || []).find((c) => c.demo && c.demo.type !== 'link');
    this.offerWin = linkDialog(this.wm, {
      url, title: anyDemo.title || url,
      onOpen: () => { if (linkChoice) setTimeout(() => this.#pick({ ...linkChoice, demo: null }, linkChoice.label), 60); },
      extra: hereChoice ? { label: hereChoice.label, run: () => this.#pick(hereChoice, hereChoice.label, true) } : null,
    });
  }

  async #cardFor(demo) {
    const work = await (this.workP ||= loadWork(this.persona).catch(() => ({ list: [] })));
    const host = (() => { try { return new URL(demo.url.replace(/\{[a-z]+\}/g, ''), this.base).hostname.replace(/^www\./, ''); } catch { return ''; } })();
    const t = (demo.title || '').toLowerCase();
    const it = (work.list || []).find((w) => (w.links || []).some((l) => l.url && host && l.url.includes(host)) || (w.embed && host && w.embed.includes(host)) || (w.title && t.includes(w.title.toLowerCase())));
    const kind = { iframe: 'live site', qr: 'live room · scan', video: 'recording', image: 'screenshots', gallery: 'screenshots', mockup: 'mockup' }[demo.type] || 'link';
    const c = demo.card || {};
    return {
      title: c.title || it?.title || (demo.title || host).split(':')[0],
      rows: [['type', c.type || it?.type || kind], ['status', c.status || it?.status || 'live'], ['built', c.built || it?.built || it?.year], ['at', host]],
    };
  }

  #askName(q) {
    return new Promise((resolve) => {
      const w = this.wm.win(null, { title: 'One quick thing', width: 380, className: 'win--alert', modal: true, center: true, sheet: false });
      const inp = h('input.cast__name', { type: 'text', maxlength: '24', placeholder: 'Your first name', value: this.visitor?.name || '' });
      const done = (val) => { w.close(); if (val) { this.visitor = { ...(this.visitor || {}), name: val }; this.#renderAudience(); } resolve(val || ''); };
      w.body.append(h('form.ask', { onsubmit: (e) => { e.preventDefault(); done(inp.value.trim()); } },
        h('label', h('span', q), inp),
        h('div.alert__btns', h('button.btn', { type: 'button', onclick: () => done('') }, 'Skip'), h('button.btn.btn--primary', { type: 'submit' }, 'OK'))));
      setTimeout(() => inp.focus(), 40);
    });
  }

  // ------------------------------------------------------------------ scrub
  #ticks() {
    const total = this.durs.reduce((a, b) => a + b, 0) || 1;
    let acc = 0;
    this.scrubTicks.replaceChildren(...this.durs.slice(0, -1).map((d) => { acc += d; return h('span', { style: { left: (acc / total) * 100 + '%' } }); }));
    this.total = total;
  }

  #nodeTime() {
    let acc = 0;
    for (let i = 0; i < (this.li || 0); i++) acc += this.durs[i] || 0;
    if (!this.mode) return this.root.classList.contains('is-waiting') ? this.total : acc;
    return acc + Math.min(this.t, this.durs[this.li] || 0);
  }

  #seekFrac(f) {
    if (!this.lines.length) return;
    let target = clamp(f, 0, 0.999) * this.total;
    let i = 0;
    while (i < this.durs.length - 1 && target > this.durs[i]) { target -= this.durs[i]; i++; }
    this.root.classList.remove('is-waiting');
    this.chooser.hidden = true;
    if (!this.playing) { this.playing = true; this.#setPlayIcon(); }
    this.#playLine(i, target);
  }

  #wireScrub() {
    let dragging = false;
    const frac = (e) => { const r = this.scrub.getBoundingClientRect(); return (e.clientX - r.left) / r.width; };
    this.scrub.addEventListener('pointerdown', (e) => { dragging = true; this.scrub.setPointerCapture(e.pointerId); this.dragFrac = clamp(frac(e), 0, 1); });
    this.scrub.addEventListener('pointermove', (e) => { if (dragging) this.dragFrac = clamp(frac(e), 0, 1); });
    this.scrub.addEventListener('pointerup', (e) => { if (!dragging) return; dragging = false; this.#seekFrac(clamp(frac(e), 0, 1)); this.dragFrac = null; });
    this.scrub.addEventListener('pointercancel', () => { dragging = false; this.dragFrac = null; });
    this.scrub.addEventListener('keydown', (e) => {
      const cur = this.#nodeTime() / (this.total || 1);
      if (e.key === 'ArrowRight') { e.preventDefault(); this.#seekFrac(cur + 0.05); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.#seekFrac(cur - 0.05); }
    });
  }

  // ------------------------------------------------------------------ frame loop
  #loop() {
    const step = (now) => {
      requestAnimationFrame(step);
      if (this.win?.el.hidden) return;
      // timer-mode line end
      if (this.mode === 'timer' && this.playing && this.t >= (this.durs[this.li] || 0)) this.#lineEnded(this.token);
      // loudness → mouth
      let level = 0;
      if (this.playing && this.mode === 'audio' && this.analyser && !this.audio.paused) {
        this.analyser.getFloatTimeDomainData(this.buf);
        let s = 0;
        for (let i = 0; i < this.buf.length; i++) s += this.buf[i] * this.buf[i];
        level = clamp(Math.sqrt(s / this.buf.length) * 5.5, 0, 1);
      } else if (this.playing && this.mode === 'timer') {
        const t = this.t;
        level = Math.max(0, Math.sin(t * 11.3) * 0.6 + Math.sin(t * 4.1 + 1) * 0.4) * (0.6 + 0.4 * Math.sin(t * 1.7));
      }
      for (const [k, p] of Object.entries(this.puppets)) p.update(now, k === this.activeKey ? level : 0);
      for (const [k, p] of Object.entries(this.cuPuppets || {})) if (!this.studio.cu[this.speakers[k].seat].hidden) p.update(now, k === this.activeKey ? level : 0);
      this.stage.style.setProperty('--level', level.toFixed(3));
      // long lines scroll with the speech so the lower third never outgrows its slot
      const over = this.sub.scrollHeight > this.sub.clientHeight + 2;
      if (over !== this.subOver) { this.subOver = over; this.sub.classList.toggle('is-scroll', over); }
      if (this.mode && over) {
        // page by whole lines so the window never shows a half-cut line
        const d = this.durs[this.li] || 1;
        const lh = parseFloat(getComputedStyle(this.sub).lineHeight) || 20;
        const max = this.sub.scrollHeight - this.sub.clientHeight;
        const top = Math.min(max, Math.round(max * clamp((this.t - 0.15 * d) / (0.75 * d), 0, 1) / lh) * lh);
        if (Math.abs(this.sub.scrollTop - top) > 1) this.sub.scrollTop = top;
        this.subMore = true; this.sub.classList.toggle('is-more', top < max - 1);
      } else if (this.subMore !== false) { this.subMore = false; this.sub.classList.remove('is-more'); }
      // scrub
      const cur = this.dragFrac != null ? this.dragFrac * this.total : this.#nodeTime();
      const f = clamp(cur / (this.total || 1), 0, 1);
      this.scrubFill.style.transform = `scaleX(${f})`;
      this.scrubKnob.style.left = f * 100 + '%';
      this.scrub.setAttribute('aria-valuenow', String(Math.round(f * 100)));
      const txt = `${fmt(cur)} / ${fmt(this.total)}`;
      if (this.time.textContent !== txt) this.time.textContent = txt;
    };
    requestAnimationFrame(step);
  }
}
