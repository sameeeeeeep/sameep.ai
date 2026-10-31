// podcast.js — the core: a studio where the host and the guest lip-sync to
// their clips, Wispr-style subtitles, chapters, transport, branch chips and a
// "Say it with Flow…" field that steers the episode.
import { h, clamp, fillName, words, isNarrow, safeUrl, reducedMotion } from './util.js';
import { sound } from './audio.js';
import { Puppet } from './puppet.js';
import { spriteFrames } from './persona.js';
import { renderSubtitle } from './subtitle.js';
import { bestMatch } from './fuzzy.js';
import { openDemo, linkDialog } from './demos.js';
import { openCast, savedVisitor } from './cast.js';
import { flowClean } from './apps.js';
import { Studio } from './stage.js';
import { loadWork } from './work.js';

const fmt = (s) => { s = Math.max(0, Math.floor(s || 0)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const estDur = (line) => Math.max(2.4, words(line.text) * 0.36 + 0.7);

export class Podcast {
  constructor({ wm, layer, persona, episode, onEnd }) {
    this.wm = wm;
    this.layer = layer;
    this.persona = persona;
    this.ep = episode;
    this.onEnd = onEnd;
    this.base = persona.base;
    this.reduced = reducedMotion();
    this.visitor = savedVisitor() ? { ...savedVisitor(), character: null } : { name: '' };
    this.casted = false;
    this.history = [];
    this.visited = new Set();
    this.playing = false;
    this.token = 0;
    this.durs = [];
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

  // where the "pick your character" moment happens
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
    this.win.onShow = () => this.#layout();
    this.#build(this.win.body);
    this.chapterList = this.#chapters();
    this.#renderChapters();
    this.#loop();
    return this;
  }

  #build(body) {
    const P = this.persona;
    this.studio = new Studio({ persona: P, speakers: this.speakers, hostKey: this.hostKey, guestKey: this.guestKey, reduced: this.reduced });
    const stage = this.studio.el;
    this.seats = this.studio.seats;
    this.youSeat = this.studio.youSeat;
    this.onAir = this.studio.onAir;
    this.studioReady = this.studio.init();
    this.name = h('p.lower3__name');
    this.sub = h('p.lower3__sub', { 'aria-live': 'polite' });
    this.tag = h('span.lower3__tag', { 'aria-hidden': 'true' });
    const lower3 = h('div.lower3', h('div.lower3__head', this.name, this.tag), this.sub);
    if (isNarrow()) stage.classList.add('stage--narrow');
    this.stage = stage;

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

    // steering
    this.chips = h('div.chips', { role: 'group', 'aria-label': 'Pull a thread' });
    this.sayIn = h('input.say__input', { type: 'text', placeholder: 'Say it with Flow…', 'aria-label': 'Say or type where to go next', autocomplete: 'off', enterkeyhint: 'go', spellcheck: 'false' });
    this.sayMsg = h('p.say__msg', { 'aria-live': 'polite' });
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.mic = SR ? h('button.say__mic', { type: 'button', 'aria-label': 'Speak (uses your browser’s speech recognition)', title: 'Speak', onclick: () => this.#listen(SR) }, h('span.ico.ico--mic')) : null;
    const say = h('form.say', { onsubmit: (e) => { e.preventDefault(); this.#steer(this.sayIn.value); } },
      h('span.say__flow', { 'aria-hidden': 'true' }, h('img', { src: 'img/ui/wispr.svg', alt: '', width: 20, height: 20 })),
      this.sayIn, this.mic, h('button.say__go', { type: 'submit', 'aria-label': 'Go' }, 'Go'));
    this.sayIn.addEventListener('input', () => this.#preview(this.sayIn.value));
    this.sayIn.addEventListener('focus', () => this.youSeat.classList.add('is-listening'));
    this.sayIn.addEventListener('blur', () => this.youSeat.classList.remove('is-listening'));
    const steer = h('div.steer', h('p.steer__label', h('span', 'Pull a thread'), this.nodeLabel), this.chips, say, this.sayMsg);

    // chapters
    this.chapEl = h('ol.chapters');
    const side = h('aside.pod__side', h('h3.side__title', 'Chapters'), this.chapEl,
      h('p.side__hint', 'Hold your Wispr Flow key and talk into the field. Or type. Or tap.'));
    const chapDrawer = h('details.chap-drawer', h('summary', 'Chapters'), h('div.chap-drawer__body'));

    this.stageBox = h('div.stage-box', h('div.stage-col', stage, lower3));
    this.root = h('div.pod',
      h('div.pod__main', this.stageBox, transport, steer, chapDrawer),
      side);
    this.lower3 = lower3;
    this.chapDrawer = chapDrawer;
    body.append(this.root);
    this.#layout();
    this.mq = matchMedia('(max-width: 760px)');
    this.mq.addEventListener?.('change', () => this.#layout());

    // keyboard
    this.win.el.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, [contenteditable]')) return;
      if (e.key === ' ') { e.preventDefault(); this.toggle(); }
      else if (e.key === 'ArrowRight' && e.target !== this.scrub) this.skip();
      else if (e.key === 'ArrowLeft' && e.target !== this.scrub) this.back();
    });

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
  }

  #layout() {
    const narrow = isNarrow();
    const side = this.root.querySelector('.pod__side');
    const drawer = this.chapDrawer.querySelector('.chap-drawer__body');
    if (narrow && this.chapEl.parentElement !== drawer) drawer.append(this.chapEl);
    if (!narrow && this.chapEl.parentElement !== side) side.insertBefore(this.chapEl, side.querySelector('.side__hint'));
    this.stage.classList.toggle('stage--narrow', narrow);
    // the lower third hangs under the picture so it never hides the visitor's stool
  }

  #renderChapters() {
    this.chapEl.replaceChildren(...this.chapterList.map((c, i) => h('li',
      h('button.chap', { type: 'button', dataset: { to: c.to }, onclick: () => { this.chapDrawer.open = false; this.go(c.to, { from: 'chapter' }); } },
        h('span.chap__n', String(i + 1).padStart(2, '0')), h('span.chap__t', c.label)))));
  }

  #markChapter() {
    const n = this.ep.nodes[this.nodeId];
    const label = n?.chapter;
    this.chapEl.querySelectorAll('.chap').forEach((b) => {
      const c = this.chapterList.find((x) => x.to === b.dataset.to);
      const visited = [...this.visited].some((id) => this.ep.nodes[id]?.chapter === c?.label);
      b.classList.toggle('is-visited', visited);
      const cur = c && c.label === label;
      b.classList.toggle('is-current', cur);
      b.setAttribute('aria-current', cur ? 'true' : 'false');
    });
    this.nodeLabel.textContent = label ? '· ' + label : '';
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
    this.durs = (node.lines || []).map(estDur);
    this.#preloadDurations(node);
    this.#renderChips();
    this.#markChapter();
    this.#ticks();
    this.sayMsg.textContent = '';
    this.root.classList.remove('is-waiting');
    if (from) this.studio.loading();
    if (node.sting) this.#sting(node.sting);
    this.playing = true;
    this.#setPlayIcon();
    if (!node.lines?.length) return this.#nodeEnded();
    this.#playLine(0, 0);
  }

  #preloadDurations(node) {
    const tok = this.nodeId;
    (node.lines || []).forEach((l, i) => {
      const u = this.#abs(l.audio);
      if (!u) return;
      const a = new Audio();
      a.preload = 'metadata';
      a.addEventListener('loadedmetadata', () => { if (this.nodeId === tok && isFinite(a.duration)) { this.durs[i] = a.duration; this.#ticks(); } }, { once: true });
      a.src = u;
    });
  }

  #playLine(i, offset = 0) {
    const line = this.node.lines[i];
    if (!line) return this.#nodeEnded();
    const tok = ++this.token;
    this.li = i;
    this.subCtl?.cancel();
    const who = this.speakers[line.who] ? line.who : (line.who === 'guest' ? this.guestKey : this.hostKey);
    this.activeKey = who;
    for (const [k, p] of Object.entries(this.puppets)) p.setActive(k === who);
    this.youSeat.classList.remove('is-active');
    const seat = this.speakers[who]?.seat || 'host';
    // shot grammar: wide to open a segment, medium on a change of speaker,
    // close-up on punchlines (or when the script says so)
    const prevSeat = this.studio.who;
    this.studio.setSpeaker(seat);
    if (offset < 0.25) {
      const wc = words(line.text);
      const punch = line.shot === 'cu' || (wc <= 12 && /[!?]["”’]?$/.test(line.text.trim()));
      const shot = line.shot || (i === 0 && !this.cutIn ? 'wide' : punch ? 'cu' : seat !== prevSeat || this.studio.shot === 'wide' ? 'ms' : this.studio.shot === 'cu' ? 'ms' : this.studio.shot);
      this.cutIn = false;
      this.studio.cut(shot === 'ms' || shot === 'cu' ? shot : shot, seat);
    }
    this.name.textContent = this.speakers[who]?.name || who;
    const name = this.visitor?.name;
    const text = fillName(line.text, name);
    const messy = line.messy ? fillName(line.messy, name) : null;
    this.tag.textContent = messy ? 'RAW' : '';
    this.tag.classList.toggle('is-clean', false);
    this.subCtl = renderSubtitle(this.sub, { text, messy: offset > 0.5 ? null : messy, reduced: this.reduced, onClean: () => { this.tag.textContent = 'FLOW'; this.tag.classList.add('is-clean'); } });
    this.studio.cutaway(line.cutaway ? this.#abs(line.cutaway) : null, line.text);
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
    this.durs[this.li] = estDur(this.node.lines[this.li]);
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
    if (next < this.node.lines.length) {
      setTimeout(() => { if (tok === this.token && this.playing) this.#playLine(next, 0); else if (tok === this.token) { this.li = next; this.pendingLine = true; } }, 280);
    } else this.#nodeEnded();
  }

  async #nodeEnded() {
    const tok = ++this.token;
    this.mode = null;
    for (const p of Object.values(this.puppets)) p.setActive(false);
    // the cast call: after the host introduces the show, the visitor takes a seat
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
      if (!isNarrow()) setTimeout(() => this.sayIn.focus({ preventScroll: true }), 50);
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
    this.#seatVisitor();
    this.playing = true;
    this.#setPlayIcon();
  }

  recast() { this.#cast(); }

  // dev/QA: seat a character without the picker (?debug&seat=<id>)
  seatForQA(id, name = 'Asha') {
    const c = this.persona.characters.find((x) => x.id === id);
    if (!c) return;
    this.casted = true;
    this.visitor = { name, character: { ...c } };
    this.#seatVisitor();
  }

  #seatVisitor() {
    const v = this.visitor || {};
    const src = v.photo || v.character?.src;
    if (!src) { this.youSeat.hidden = true; return; }
    const holder = this.youSeat.querySelector('.seat-you__img');
    const img = h('img', { src, alt: v.name ? `${v.name}, on the studio iMac` : 'You, on the studio iMac' });
    img.onerror = () => { const t = this.persona.characters.find((c) => c.id === v.character?.id)?.thumb; if (t && img.src !== t) img.src = t; };
    holder.replaceChildren(img);
    this.youSeat.hidden = false;
    this.youSeat.classList.add('is-arriving');
    setTimeout(() => this.youSeat.classList.remove('is-arriving'), 1200);
  }

  // ------------------------------------------------------------------ steering
  #renderChips() {
    const n = this.node;
    const chips = (n.choices || []).map((c, i) => h('button.chip', { type: 'button', dataset: { i: String(i) }, onclick: () => this.#pick(c, c.label, true) }, c.label));
    if (!chips.length && n.next && this.ep.nodes[n.next]) {
      const nx = this.ep.nodes[n.next];
      chips.push(h('button.chip.chip--next', { type: 'button', onclick: () => this.go(n.next) }, 'Next: ' + (nx.chapter && nx.chapter !== n.chapter ? nx.chapter : 'keep going')));
    }
    this.chips.replaceChildren(...chips);
  }

  #items() {
    const n = this.node;
    const items = (n.choices || []).map((c, i) => ({ key: 'c' + i, choice: c, phrases: [c.label, ...(c.say || [])] }));
    this.chapterList.forEach((c) => items.push({ key: 'ch:' + c.to, to: c.to, phrases: [c.label], weight: 0.8 }));
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
    this.chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-match', !!m && c.dataset.i === m.item.key.slice(1)));
  }

  #steer(q) {
    q = q.trim();
    if (!q) return;
    const m = bestMatch(q, this.#items(), 0.5);
    if (!m) {
      this.sayMsg.textContent = 'No thread by that name yet. Try one of the chips, or say “skip”.';
      this.root.querySelector('.say').classList.remove('is-miss');
      void this.root.offsetWidth;
      this.root.querySelector('.say').classList.add('is-miss');
      sound.tick('error');
      return;
    }
    this.sayIn.value = '';
    this.#preview('');
    const it = m.item;
    if (it.choice) return this.#pick(it.choice, q, !this.rec);
    if (it.to) return this.#pick({ to: it.to, label: q }, q);
    if (it.cmd === 'skip') this.skip();
    if (it.cmd === 'back') this.back();
    if (it.cmd === 'pause') this.pause();
    if (it.cmd === 'play') this.play();
    if (it.cmd === 'menu') { const hub = this.ep.nodes.hub ? 'hub' : this.ep.start; this.#pick({ to: hub, label: q }, q); }
  }

  // the visitor speaks: their seat lights up and their line shows in the lower third
  #pick(choice, said, gesture = false) {
    // a choice can carry a demo ("Open it" / "Show me here")
    if (choice.demo) {
      const d = choice.demo;
      const url = d.type === 'link' ? safeUrl(d.url, this.base) : null;
      if (url && gesture) window.open(url, '_blank', 'noopener');
      else this.#demo(d);
    }
    this.offerWin?.close();
    sound.tick('pick');
    const tok = ++this.token;
    this.audio.pause();
    this.subCtl?.cancel();
    for (const p of Object.values(this.puppets)) p.setActive(false);
    this.studio.cutaway(null);
    this.studio.setSpeaker('you');
    if (!this.youSeat.hidden) this.studio.cut('ms', 'you');
    this.youSeat.classList.add('is-active');
    this.name.textContent = this.visitor?.name ? `${this.visitor.name} (you)` : 'You';
    // the visitor's words get the Flow treatment too
    const clean = flowClean(said);
    this.tag.textContent = clean && clean !== said ? 'RAW' : '';
    this.tag.classList.remove('is-clean');
    this.subCtl = renderSubtitle(this.sub, { text: clean || said, messy: clean && clean !== said ? said : null, reduced: this.reduced, onClean: () => { this.tag.textContent = 'FLOW'; this.tag.classList.add('is-clean'); } });
    if (!this.youSeat.hidden) this.studio.sayBubble(said);
    setTimeout(() => {
      if (tok !== this.token) return;
      this.youSeat.classList.remove('is-active');
      this.go(choice.to, { from: 'pick' });
    }, this.reduced ? 200 : clean && clean !== said ? 2300 : 1100);
  }

  #listen(SR) {
    if (this.rec) { this.rec.stop(); return; }
    const rec = new SR();
    rec.lang = navigator.language || 'en-US';
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    this.rec = rec;
    this.mic.classList.add('is-on');
    this.youSeat.classList.add('is-listening');
    let finalText = '';
    rec.onresult = (e) => {
      let s = '';
      for (const r of e.results) { s += r[0].transcript; if (r.isFinal) finalText = s; }
      this.sayIn.value = s;
      this.#preview(s);
    };
    rec.onerror = (e) => { this.sayMsg.textContent = e.error === 'not-allowed' ? 'Mic blocked. Type instead, or use your Wispr Flow key.' : 'Didn’t catch that.'; };
    rec.onend = () => {
      this.rec = null;
      this.mic.classList.remove('is-on');
      this.youSeat.classList.remove('is-listening');
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
      this.playing = true; this.#setPlayIcon();
      return this.#playLine(Math.max(0, this.node.lines.length - 1), 0);
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
      // at a fork: skip takes the default path
      if (this.node.next) this.go(this.node.next);
      return;
    }
    this.playing = true; this.#setPlayIcon();
    if (this.li + 1 < this.node.lines.length) this.#playLine(this.li + 1, 0);
    else { this.audio.pause(); this.#nodeEnded(); }
  }
  back() {
    if (!this.node) return;
    this.root.classList.remove('is-waiting');
    this.playing = true; this.#setPlayIcon();
    if (this.mode && this.t > 2) return this.#playLine(this.li, 0);
    if (this.li > 0 && this.mode) return this.#playLine(this.li - 1, 0);
    if (!this.mode && this.node.lines.length) return this.#playLine(Math.max(0, this.node.lines.length - 1), 0);
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
    const anyDemo = linkChoice?.demo || (n.choices || []).find((c) => c.demo?.url)?.demo || [...(n.lines || [])].reverse().find((l) => l.demo?.url)?.demo;
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
      const done = (val) => { w.close(); if (val) this.visitor = { ...(this.visitor || {}), name: val }; resolve(val || ''); };
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
    if (!this.node?.lines?.length) return;
    let target = clamp(f, 0, 0.999) * this.total;
    let i = 0;
    while (i < this.durs.length - 1 && target > this.durs[i]) { target -= this.durs[i]; i++; }
    this.root.classList.remove('is-waiting');
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
        const d = this.durs[this.li] || 1;
        this.sub.scrollTop = (this.sub.scrollHeight - this.sub.clientHeight) * clamp((this.t - 0.15 * d) / (0.75 * d), 0, 1);
      }
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
