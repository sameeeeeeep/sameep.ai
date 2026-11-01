// puppet.js — a sprite seat. Two looks (side: towards the other person,
// front: into the camera) × six frames (closed / mid / open / wide / oo / blink),
// all cut from one master so nothing shifts between them. Every frame is an
// <img> stacked in the seat and preloaded; a swap only flips visibility.
//
// Mouth, best source first:
//  1. frame bank (img/sprites/<who>/bank.json): mouth/jaw patches cut from a
//     generated talking video, drawn on a canvas over the closed frame. Played
//     like a video texture: follow runs of consecutive source frames, jump to
//     the frame whose openness matches the target when it drifts, hold the
//     rest frame in pauses.
//  2. cue timeline (data/visemes.json, built by build/script-tools/visemes.py
//     from whisper word timings + the script + the clip's loudness): the shape
//     at the playing clip's currentTime, held at least 50 ms.
//  3. loudness (third-party ?persona= bundles, timer mode): the analyser level
//     normalised against a decaying peak, attack/release envelope, bands with
//     hysteresis, 60–90 ms holds and a little vowel variation.
// Blinks are random every 2–6 s and only land while the mouth is closed.
//
// Life (the head rig, bank.json "rig", built by videoframes.py --region head):
// once loaded the seat is drawn on one canvas each frame, drawImage only:
//   body  = the closed frame with the head's hard core cut out
//   head  = the current frame (closed / blink / cue shape) through a soft head
//           mask, plus the bank's mouth patch, then nodded / tilted about the
//           neck by a couple of pixels: the talking video's own head motion
//           for the frame being shown (front, close-up), or eased noise
//           (side; livelier while speaking, small nods while listening)
//   breath = a ~0.25 Hz one-pixel rise of everything above the desk line
// prefers-reduced-motion: no breathing, no head motion (mouth and blinks stay).
import { h, clamp } from './util.js';
import { manifestReady } from './stage.js';

// ---- the speech clip that is playing (for the cue timeline)
// podcast.js may call setSpeechAudio(this.audio); until then any media element
// that plays a clip we have cues for is picked up here.
const media = new Set();
let speech = null;
export function setSpeechAudio(el) { speech = el; }
if (typeof HTMLMediaElement !== 'undefined' && !HTMLMediaElement.prototype.__puppetHook) {
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...a) { if (media.size < 8) media.add(this); return play.apply(this, a); };
  HTMLMediaElement.prototype.__puppetHook = true;
}
let cueP = null;
let CUES = null;
const cueBySrc = new Map();
function loadCues(url) {
  cueP ||= fetch(url, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((j) => (CUES = j));
  return cueP;
}
function cuesFor(src) {
  if (!CUES || !src) return null;
  if (cueBySrc.has(src)) return cueBySrc.get(src);
  let path = '';
  try { path = decodeURIComponent(new URL(src, location.href).pathname); } catch { /* noop */ }
  const key = Object.keys(CUES).find((k) => path.endsWith('/' + k));
  const c = key ? CUES[key] : null;
  cueBySrc.set(src, c);
  return c;
}
const LEAD = 0.03; // mouth leads the sound a touch
const MIN_HOLD = 80; // a cue shape is held at least this long (no flapping)
function playingCues() {
  const list = speech ? [speech, ...media] : media;
  for (const el of list) {
    if (el.paused || el.ended) continue;
    const c = cuesFor(el.currentSrc || el.src);
    if (c) return { c, t: el.currentTime + LEAD };
  }
  return null;
}
// for QA: which source drives the mouth right now
export const lipsyncState = () => { const p = playingCues(); return { cues: !!CUES, playing: p ? +p.t.toFixed(2) : null }; };
// cue shape → target openness / roundness for the frame bank
const OPEN = { closed: 0, mid: 0.3, oo: 0.38, open: 0.66, wide: 0.95 };
const ROUND = { oo: 1 };
const load = (src) => new Promise((r) => {
  if (!src) return r(null);
  const i = new Image();
  i.decoding = 'async';
  i.onload = () => r(i);
  i.onerror = () => r(null);
  i.src = src;
});

const SHAPES = ['closed', 'mid', 'open', 'wide', 'oo', 'blink'];
// a missing frame borrows the nearest one that exists
const FALLBACK = { mid: 'closed', open: 'mid', wide: 'open', oo: 'mid', blink: 'closed' };
const BAND_SHAPE = ['closed', 'mid', 'open', 'wide'];
const UP = [0.25, 0.52, 0.88]; // envelope needed to climb into band 1, 2, 3
const DOWN = [0.15, 0.42, 0.76]; // and to drop back out of it

// 'cu-front-wide' → { look: 'front', shape: 'wide' }
export function parseFrameName(n) {
  const m = String(n).replace(/^cu-/, '').match(/^(?:(front|side)-)?(closed|mid|open|wide|oo|blink)$/);
  return m ? { look: m[1] || 'side', shape: m[2] } : null;
}

// Fallback character drawn as pixel SVG until the real sprites land.
function placeholderFrames(color = '#0a8fa8', skin = '#c98a5e', hair = '#2a1a12') {
  const mouths = {
    closed: '<rect x="14" y="21" width="5" height="1" fill="#5a2a1a"/>',
    mid: '<rect x="14" y="20" width="5" height="2" fill="#5a2a1a"/><rect x="15" y="21" width="3" height="1" fill="#ff8f8f"/>',
    open: '<rect x="13" y="19" width="7" height="4" fill="#3a1410"/><rect x="14" y="21" width="5" height="2" fill="#ff8f8f"/>',
    blink: '<rect x="14" y="21" width="5" height="1" fill="#5a2a1a"/>',
  };
  const eyes = (closed) => (closed
    ? '<rect x="11" y="15" width="3" height="1" fill="#111"/><rect x="19" y="15" width="3" height="1" fill="#111"/>'
    : '<rect x="12" y="14" width="2" height="2" fill="#111"/><rect x="19" y="14" width="2" height="2" fill="#111"/>');
  const body = `<rect x="4" y="28" width="25" height="12" fill="${color}"/><rect x="3" y="30" width="27" height="10" fill="${color}"/><rect x="13" y="26" width="7" height="3" fill="${skin}"/><rect x="9" y="8" width="15" height="18" fill="${skin}"/><rect x="8" y="10" width="17" height="14" fill="${skin}"/><rect x="8" y="5" width="17" height="6" fill="${hair}"/><rect x="7" y="7" width="3" height="9" fill="${hair}"/><rect x="23" y="7" width="3" height="8" fill="${hair}"/><rect x="13" y="28" width="7" height="2" fill="#f3eee2"/>`;
  const out = {};
  for (const k of Object.keys(mouths)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 33 40" shape-rendering="crispEdges">${body}${eyes(k === 'blink')}${mouths[k]}</svg>`;
    out[k] = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }
  return out;
}

export class Puppet {
  // frames: {closed,mid,open,blink} URLs (side look), or {set:{side:{…},front:{…}}}.
  // The look shown is read from seat.dataset.look ('front' | 'side'), which the Studio sets per line.
  constructor(seat, { frames, label, placeholder = {} }) {
    this.seat = seat;
    this.frames = frames || {};
    this.ph = placeholder;
    this.label = label || '';
    this.imgs = {}; // 'look:shape' → <img>
    this.key = '';
    this.shape = 'closed';
    this.band = 0;
    this.env = 0;
    this.peak = 0.25;
    this.avg = 0;
    this.dip = 0;
    this.wasFalling = false;
    this.vowel = 'normal';
    this.holdUntil = 0;
    this.blinkUntil = 0;
    this.blinkAgain = 0;
    this.nextBlink = performance.now() + 1500 + Math.random() * 3000;
    this.t = 0;
    this.ci = 0; // cue index cache
    this.banks = {}; // look → { img, meta, cur, next, dir, quietSince }
    this.rigs = {}; // look → { body, heads, scratch, sctx, meta }
    this.hbanks = {}; // look → whole-head bank (head-<pose> in bank.json): the video's own head, every frame
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.phase = Math.random() * Math.PI * 2; // breathing: every character on their own rhythm
    this.seed = Math.random() * 100;
    this.head = { x: 0, y: 0, r: 0 }; // eased head pose
    this.nodAt = 0; this.nodUntil = 0; this.nextNod = performance.now() + 2500 + Math.random() * 3000;
    this.amp = 0; // eased "how animated" (0 listening .. 1 speaking)
  }

  // Work out every frame this seat has: explicit set, else the manifest entry
  // whose dir matches frames.closed, else just the four frames we were given.
  async #frameSet() {
    if (this.frames.set) {
      // close-ups: a known sprite dir if the manifest lists it
      const c = this.frames.set.front?.closed || this.frames.set.side?.closed || '';
      const M = await manifestReady();
      for (const sp of Object.values(M.sprites || {})) {
        const dir = String(sp.dir || '').replace(/^\.?\//, '').replace(/\/$/, '');
        if (dir && c.includes(`/${dir}/`)) this.dir = c.slice(0, c.indexOf(`/${dir}/`) + dir.length + 2);
      }
      return this.frames.set;
    }
    const side = {};
    for (const k of SHAPES) if (this.frames[k]) side[k] = this.frames[k];
    const set = { side };
    const closed = this.frames.closed;
    if (!closed || closed.startsWith('data:')) return set;
    let path = '';
    try { path = new URL(closed).pathname; } catch { return set; }
    const M = await manifestReady();
    for (const sp of Object.values(M.sprites || {})) {
      const dir = String(sp.dir || '').replace(/^\.?\//, '').replace(/\/$/, '');
      if (!dir || !path.endsWith(`/${dir}/closed.webp`)) continue;
      const base = closed.replace(/closed\.webp(\?.*)?$/, '');
      this.dir = base;
      for (const n of sp.frames || []) {
        const f = parseFrameName(n);
        if (f) (set[f.look] ||= {})[f.shape] = `${base}${n}.webp`;
      }
    }
    return set;
  }

  async load() {
    const set = await this.#frameSet();
    const jobs = [];
    for (const [look, fr] of Object.entries(set)) for (const [shape, url] of Object.entries(fr)) jobs.push(load(url).then((ok) => ok && [look, shape, url]));
    const got = (await Promise.all(jobs)).filter(Boolean);
    const src = {};
    for (const [look, shape, url] of got) (src[look] ||= {})[shape] = url;
    if (!src.side?.closed) {
      if (src.front?.closed) src.side = src.front; // a front-only seat (close-ups)
      else {
        this.seat.classList.add('is-placeholder');
        const ph = placeholderFrames(this.ph.color, this.ph.skin, this.ph.hair);
        src.side = ph; delete src.front;
      }
    }
    if (src.front && !src.front.closed) delete src.front;
    // fill the gaps so every look has all six shapes
    for (const fr of Object.values(src)) {
      for (const k of SHAPES) { let s = k; while (!fr[s] && FALLBACK[s]) s = FALLBACK[s]; fr[k] = fr[s] || fr.closed; }
    }
    this.src = src;
    // one <img> per distinct URL (fallbacks share an element)
    const byUrl = new Map();
    for (const [look, fr] of Object.entries(src)) {
      for (const k of SHAPES) {
        let im = byUrl.get(fr[k]);
        if (!im) {
          im = h('img.puppet__img.is-off', { alt: '', draggable: 'false', src: fr[k] });
          byUrl.set(fr[k], im);
          this.seat.append(im);
        }
        this.imgs[`${look}:${k}`] = im;
      }
    }
    this.#show('side', 'closed');
    if (this.dir) {
      const root = this.dir.replace(/img\/sprites\/.*$/, '');
      loadCues(root + 'data/visemes.json');
      // no await: the seat works without it. Wait for the studio to be on screen first.
      const later = (fn) => setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1500 }) : fn()), 700);
      later(() => this.#loadBanks());
    }
    return this;
  }

  // frame banks + head rigs for whichever looks this seat has (bank.json lists poses)
  async #loadBanks() {
    let idx = null;
    try { const r = await fetch(this.dir + 'bank.json', { cache: 'no-cache' }); idx = r.ok ? await r.json() : null; } catch { idx = null; }
    if (!idx) return;
    for (const look of Object.keys(this.src)) {
      const twin = Object.keys(this.rigs).find((k) => this.src[k] === this.src[look]);
      if (twin) { this.banks[look] = this.banks[twin]; this.rigs[look] = this.rigs[twin]; this.hbanks[look] = this.hbanks[twin]; continue; } // a front-only seat
      const closed = this.src[look].closed || '';
      const pose = /\/cu-front-closed\.webp/.test(closed) ? 'cu-front' : /\/cu-closed\.webp/.test(closed) ? null : look;
      if (!pose) continue;
      const meta = idx[pose];
      const R = idx.rig?.[pose];
      const HM = idx['full-' + pose] || idx['head-' + pose]; // full: the whole seat from the video, no neck joint
      const [img, mask, cut, himg] = await Promise.all([
        meta?.frames?.length && !HM ? load(this.dir + meta.sheet) : null,
        R ? load(this.dir + R.mask) : null,
        R?.cut ? load(this.dir + R.cut) : null,
        HM?.frames?.length ? load(this.dir + HM.sheet) : null]);
      if (img) this.banks[look] = { img, meta, cur: meta.rest ?? 0, next: 0, dir: 1, quietSince: 0, idleNext: 0 };
      if (himg) this.hbanks[look] = { img: himg, meta: HM, cur: HM.rest ?? 0, next: 0, dir: 1, quietSince: 0, idleNext: 0, whole: true, full: !!idx['full-' + pose] };
      if (mask && (!R.cut || cut)) this.rigs[look] = this.#buildRig(look, R, mask, cut);
    }
    if (Object.keys(this.rigs).length) this.#useCanvas();
  }

  // pre-cut the layers once (load time): the body without its head, and one
  // masked head per mouth/eye frame, cropped to the head's box
  #buildRig(look, R, mask, cut) {
    const base = this.imgs[`${look}:closed`];
    const W = base.naturalWidth, H = base.naturalHeight;
    const [bx, by, bw, bh] = R.box;
    const cv = (w, hh) => { const c = document.createElement('canvas'); c.width = w; c.height = hh; return c; };
    const body = cv(W, H);
    const b = body.getContext('2d');
    b.drawImage(base, 0, 0);
    if (cut) { b.globalCompositeOperation = 'destination-out'; b.drawImage(cut, bx, by); }
    const heads = {};
    const made = new Map();
    for (const k of SHAPES) {
      const im = this.imgs[`${look}:${k}`];
      let c = made.get(im);
      if (!c) {
        c = cv(bw, bh);
        const x = c.getContext('2d');
        x.drawImage(im, -bx, -by);
        x.globalCompositeOperation = 'destination-in';
        x.drawImage(mask, 0, 0);
        made.set(im, c);
      }
      heads[k] = c;
    }
    // whole-head mode: the body also gives up the soft head area, so the still
    // sprite's own hair edge never shows round the video's head
    const bodyH = cv(W, H);
    const bH = bodyH.getContext('2d');
    bH.drawImage(body, 0, 0);
    bH.globalCompositeOperation = 'destination-out';
    bH.drawImage(mask, bx, by);
    const scratch = cv(bw, bh);
    const sctx = scratch.getContext('2d');
    sctx.imageSmoothingEnabled = false;
    return { body, bodyH, mask, heads, scratch, sctx, meta: R, W, H, opaque: !R.cut };
  }

  // one canvas replaces the <img> stack. Alpha seats get a few px of headroom
  // above the sprite so a nod never clips the hair.
  #useCanvas() {
    const r = Object.values(this.rigs)[0];
    const pad = r.opaque ? 0 : 8;
    this.pad = pad;
    this.cv = h('canvas.puppet__img.puppet__rig', { width: r.W, height: r.H + pad, 'aria-hidden': 'true' });
    if (pad) Object.assign(this.cv.style, { top: (-pad / r.H) * 100 + '%', height: ((r.H + pad) / r.H) * 100 + '%', inset: 'auto 0 0 0' });
    this.ctx = this.cv.getContext('2d');
    this.seat.append(this.cv);
    this.rigSince = performance.now();
    this.drawnKey = null;
  }

  // play the bank like the video it came from: straight through (ping-pong at the ends) while
  // talking, so jaw, cheeks and lips move together. In a pause keep going until a naturally
  // closed frame comes round, then hold it. No jumps: a jump is what reads as a pasted mouth.
  #stepBank(b, now, target, round, quiet) {
    const fr = b.meta.frames;
    const dt = 1000 / (b.meta.fps || 24);
    if (b.dir === undefined) b.dir = 1;
    if (quiet) { if (!b.quietSince) b.quietSince = now; } else b.quietSince = 0;
    const resting = b.quietSince && now - b.quietSince > 90;
    if (b.whole) {
      // a pause longer than a breath: settle on frame 0 (the calm, closed still) and hold;
      // speech starts again from there, as the video did. Shorter gaps just play on.
      if (b.quietSince && now - b.quietSince > 380) { this.#settle(b, now); return; }
    } else if (resting && fr[b.cur][1] < 0.18) return;              // closed: hold until speech resumes
    if (now < b.next) return;
    // catch up if a frame was missed, but never skip more than one source frame
    b.next = Math.max(now, b.next + dt) + (resting ? -dt * 0.4 : 0); // a pause winds down a little faster
    let n = b.cur + b.dir;
    if (n < 0 || n >= fr.length) { b.dir = -b.dir; n = b.cur + b.dir; }
    b.cur = Math.max(0, Math.min(fr.length - 1, n));
  }

  // to frame 0 with a short crossfade (whole-seat banks)
  #settle(b, now) {
    const calm = b.meta.calm ?? 0;
    if (b.cur === calm) return;
    b.fadeFrom = b.cur; b.fadeAt = now; b.cur = calm; b.dir = 1;
  }

  // listening: finish the movement to a closed mouth, then hold it. (Walking the
  // closed frames of a talking video still moves the lips.) Breathing keeps it alive.
  #idleBank(b, now) {
    if (b.whole) {
      // crossfade to frame 0, the video's first frame (the calm, closed still), so a
      // listener never hangs on a mid-sentence expression
      this.#settle(b, now);
      return;
    }
    if (now < b.idleNext) return;
    b.idleNext = now + 110;
    const fr = b.meta.frames;
    for (let s = 1; s < 30; s++) {
      let n = b.cur + b.dir * s;
      if (n < 0 || n >= fr.length) { b.dir = -b.dir; n = b.cur + b.dir; }
      n = Math.max(0, Math.min(fr.length - 1, n));
      if (fr[n][1] < 0.2) { b.cur = n; return; }
    }
  }

  get hasFront() { return !!this.src?.front; }

  #show(look, shape) {
    const key = `${look}:${shape}`;
    if (key === this.key) return;
    if (this.rigOn && this.rigs[look]) { this.key = key; this.shape = shape; return; } // drawn by #render
    if (this.rigOn) { this.rigOn = false; this.cv.classList.add('is-off'); }
    const next = this.imgs[key];
    const prev = this.imgs[this.key];
    if (next && next !== prev) {
      next.classList.remove('is-off');
      next.alt = this.label;
      if (prev) { prev.classList.add('is-off'); prev.alt = ''; }
    }
    this.key = key;
    this.shape = shape;
  }

  // level: 0..1 loudness this frame (0 for the seat that isn't talking)
  update(now, level) {
    if (!this.src) return;
    const gap = now - this.t;
    const dt = clamp(gap, 0, 64);
    this.t = now;
    // not drawn for a while (a hidden close-up): start again from rest
    if (gap > 250) { this.env = 0; this.avg = 0; this.band = 0; this.holdUntil = 0; this.ci = 0; }
    const speaking = this.seat.classList.contains('is-active') || (this.seat.classList.contains('cu') && !this.seat.hidden);
    const look = this.seat.dataset.look === 'front' && this.src.front ? 'front' : 'side';

    // 1. the shape the sound wants: cue timeline if this clip has one, else loudness
    const pc = speaking ? playingCues() : null;
    let want;
    let target;
    if (pc) {
      const c = pc.c;
      let i = this.ci < c.length && c[this.ci][0] <= pc.t ? this.ci : 0;
      while (i + 1 < c.length && c[i + 1][0] <= pc.t) i++;
      this.ci = i;
      want = c[i]?.[1] || 'closed';
      if (!(want in OPEN)) want = 'mid';
      target = OPEN[want];
      this.env = 0;
    } else {
      want = this.#loudness(dt, level);
      target = clamp(this.env, 0, 1) * 0.95;
    }

    // 2. frame bank: the mouth as it comes in the video frames. Once the rig is
    // up the bank always draws (speaking: play; pause: wind down and hold;
    // listening: slow idle walk), so nothing pops between bank and stills.
    const bank = this.hbanks[look] || this.banks[look];
    const rig = this.cv && this.rigs[look];
    const talking = speaking && (pc || level > 0 || this.env > 0.02);
    let patch = -1;
    if (bank && rig) {
      if (talking) { this.#stepBank(bank, now, target, ROUND[want] || 0, want === 'closed'); bank.lastTalk = now; bank.fadeFrom = null; }
      else this.#idleBank(bank, now);
      patch = bank.cur;
      want = 'closed'; // the base under the patch (eyes can still blink)
    }

    // 3. blinks: random, 2–6 s apart, only with the mouth shut (sometimes a double).
    // A whole-head bank blinks on its own, as filmed.
    if (bank?.whole && rig) { /* the video's own blinks */ }
    else if (now < this.blinkUntil) want = want === 'closed' ? 'blink' : want;
    else if (this.blinkAgain && now > this.blinkAgain && want === 'closed') {
      this.blinkAgain = 0; this.blinkUntil = now + 110;
    } else if (now > this.nextBlink && want === 'closed') {
      this.blinkUntil = now + 110 + Math.random() * 50;
      this.blinkAgain = Math.random() < 0.18 ? now + 260 : 0;
      this.nextBlink = now + 2000 + Math.random() * 4000;
      want = 'blink';
    }

    // 4. look comes from the Studio (per line); a look change swaps at once
    const lookChanged = !this.key.startsWith(look + ':');
    if (lookChanged || (want !== this.shape && (now >= this.holdUntil || want === 'blink' || this.shape === 'blink'))) {
      if (want !== this.shape) this.holdUntil = now + (pc ? MIN_HOLD : 60 + Math.random() * 30);
      this.#show(look, want);
    }
    if (rig) this.#render(now, dt, look, rig, bank, patch, speaking, pc ? target : clamp(this.env, 0, 1));
  }

  // ---- the rig, drawn every frame
  #render(now, dt, look, rig, bank, patch, speaking, open) {
    if (this.seat.hidden) return;
    if (!this.rigOn) { // hand over from the <img> stack
      this.rigOn = true;
      for (const im of Object.values(this.imgs)) im.classList.add('is-off');
      this.cv.classList.remove('is-off');
    }
    const t = now / 1000;
    const ease = (tau) => 1 - Math.exp(-dt / tau);
    this.amp += ((speaking ? 1 : 0) - this.amp) * ease(600);
    const live = this.reduced ? 0 : Math.min(1, (now - this.rigSince) / 600); // motion fades in after the swap
    // target head pose
    let x = 0, y = 0, r = 0;
    const R = rig.meta;
    const big = rig.opaque ? 1.6 : 1; // close-ups: the art's pixels are bigger
    const nz = (f, k) => Math.sin(t * f + this.seed * k) * 0.6 + Math.sin(t * f * 2.31 + this.seed * k * 1.7) * 0.4;
    if (bank?.meta.head && patch >= 0) {
      // the video's own nods and tilts for the frame on screen (idle walk: calmer)
      const hm = bank.meta.head[patch] || [0, 0, 0];
      const k = 0.35 + 0.65 * this.amp;
      x = hm[0] * k; y = hm[1] * k; r = hm[2] * k; // already in this pose's px
      x += nz(0.7, 1) * 0.3 * big; y += nz(0.5, 2) * 0.25 * big;
    } else {
      // profile: eased noise. Speaking: livelier, with a little lift on open vowels.
      const a = 0.35 + 0.65 * this.amp;
      const fwd = R.faces || 1;
      r = (nz(0.9, 3) * 0.55 * a + nz(0.33, 4) * 0.35) * fwd;
      y = nz(0.8, 5) * 0.7 * a - open * 0.6 * this.amp;
      x = nz(0.45, 6) * 0.6 * a * fwd;
      // listening: an occasional small nod towards the speaker
      if (!speaking && now > this.nextNod) { this.nodAt = now; this.nodUntil = now + 700; this.nextNod = now + 3000 + Math.random() * 5000; }
      if (now < this.nodUntil) { const p = (now - this.nodAt) / 700; const s = Math.sin(p * Math.PI); r += s * 1.1 * fwd; y += s * 1.0; }
    }
    // ease towards it (no jumps when the bank skips or the look changes)
    const hd = this.head;
    const e = ease(70);
    hd.x += (x * live - hd.x) * e; hd.y += (y * live - hd.y) * e; hd.r += (r * live - hd.r) * e;
    const breath = live * Math.sin(t * Math.PI * 2 * 0.25 + this.phase); // -1..1

    // compose the head: frame through the mask, then the mouth patch on top
    if (bank?.full && patch >= 0) { this.#renderFull(now, rig, bank, patch, breath); return; }
    const [bx, by, bw, bh] = R.box;
    const sc = rig.sctx;
    sc.globalCompositeOperation = 'copy';
    if (bank?.whole && patch >= 0) {
      // the video's whole head for this frame (close-up tiles are stored small: drawn back up, hard pixels)
      const m = bank.meta;
      const [tw, th] = m.tile;
      const i = m.frames[patch] ? patch : 0;
      sc.drawImage(bank.img, (i % m.cols) * tw, Math.floor(i / m.cols) * th, tw, th, 0, 0, bw, bh);
      sc.globalCompositeOperation = 'destination-in';
      sc.drawImage(rig.mask, 0, 0);
    } else sc.drawImage(rig.heads[this.shape] || rig.heads.closed, 0, 0);
    if (bank && !bank.whole && patch >= 0) {
      const m = bank.meta;
      const [px, py, pw, ph] = m.patch;
      const [tw, th] = m.tile || [pw, ph];
      const i = m.frames[patch] ? patch : 0;
      sc.globalCompositeOperation = 'source-atop'; // the patch only where the head is
      sc.drawImage(bank.img, (i % m.cols) * tw, Math.floor(i / m.cols) * th, tw, th, px - bx, py - by, pw, ph);
    }
    sc.globalCompositeOperation = 'source-over';

    const c = this.ctx;
    const pad = this.pad;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.cv.width, this.cv.height);
    if (rig.opaque) {
      // close-up: the frame stays put; the head (and a soft margin of room behind it) moves
      c.drawImage(bank?.whole ? rig.bodyH : rig.body, 0, 0);
      hd.yb = breath * 1.5;
    } else {
      // breathing: stretch about the desk line, so hands stay put and the head rises ~1 px
      const anchor = rig.H * 0.86;
      const k = (breath * 1.0) / anchor;
      c.setTransform(1, 0, 0, 1 + k, 0, pad - anchor * k);
      c.drawImage(bank?.whole ? rig.bodyH : rig.body, 0, 0);
      hd.yb = 0;
    }
    const [pvx, pvy] = R.pivot;
    c.translate(pvx + hd.x, pvy + hd.y + hd.yb);
    c.rotate((hd.r * Math.PI) / 180);
    c.drawImage(rig.scratch, bx - pvx, by - pvy);
    c.setTransform(1, 0, 0, 1, 0, 0);
  }

  // the whole seat, one video frame (tiles are stored small: drawn back up, hard pixels)
  #renderFull(now, rig, bank, patch, breath) {
    const m = bank.meta;
    const [tw, th] = m.tile;
    const [x0, y0, bw, bh] = m.box;
    const i = m.frames[patch] ? patch : 0;
    const tile = (n) => c.drawImage(bank.img, (n % m.cols) * tw, Math.floor(n / m.cols) * th, tw, th, x0, y0, bw, bh);
    const fade = bank.fadeFrom != null ? (now - bank.fadeAt) / 280 : 1;
    const c = this.ctx;
    const pad = this.pad;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.cv.width, this.cv.height);
    c.imageSmoothingEnabled = false;
    if (rig.opaque) c.drawImage(rig.body, 0, 0); // close-up: the room
    else { // breathing: stretch about the desk line
      const anchor = rig.H * 0.86;
      const k = (breath * 1.0) / anchor;
      c.setTransform(1, 0, 0, 1 + k, 0, pad - anchor * k);
    }
    if (fade < 1) { tile(bank.fadeFrom); c.globalAlpha = fade; tile(i); c.globalAlpha = 1; }
    else { bank.fadeFrom = null; tile(i); }
    c.setTransform(1, 0, 0, 1, 0, 0);
  }

  // loudness → shape (the fallback when a clip has no cue timeline)
  #loudness(dt, level) {
    // normalise against a slowly decaying peak, then attack/release envelope
    level = level > 0.006 ? level : 0;
    // (minus part of the running average, so the mouth shuts between syllables
    // instead of hanging open through a whole phrase)
    this.peak = Math.max(level, this.peak * Math.exp(-dt / 2200), 0.14);
    this.avg += (level - this.avg) * (1 - Math.exp(-dt / 400));
    const floor = 0.6 * this.avg;
    const x = clamp((level - floor) / Math.max(0.05, this.peak - floor), 0, 1);
    const tau = x > this.env ? 24 : 70;
    const prevEnv = this.env;
    this.env += (x - this.env) * (1 - Math.exp(-dt / tau));
    const e = this.env;
    // bands with hysteresis; a new syllable (rise out of a dip) rolls a vowel
    let band = this.band;
    while (band < 3 && e > UP[band]) band++;
    while (band > 0 && e < DOWN[band - 1]) band--;
    if (e < this.dip) this.dip = e;
    if (band === 0) this.dip = e;
    const rising = e > prevEnv;
    if (rising && (this.band === 0 ? band > 0 : e - (this.dip ?? 0) > 0.22 && this.wasFalling)) {
      const r = Math.random();
      this.vowel = r < 0.12 ? 'round' : r < 0.32 ? 'small' : r < 0.6 ? 'nowide' : 'normal';
      this.dip = e;
    }
    this.wasFalling = !rising;
    this.band = band;
    let want = BAND_SHAPE[band];
    if (band > 0 && this.vowel === 'round') want = 'oo';
    else if (band > 1 && this.vowel === 'small') want = BAND_SHAPE[band - 1];
    else if (band === 3 && this.vowel === 'nowide') want = 'open';
    return want;
  }

  setActive(on) { this.seat.classList.toggle('is-active', on); }
}
