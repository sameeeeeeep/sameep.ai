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
const MIN_HOLD = 50;
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
    this.banks = {}; // look → { cv, ctx, img, meta, cur, next }
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
      this.#loadBanks(); // no await: the seat works without it
    }
    return this;
  }

  // frame banks for whichever looks this seat has (bank.json lists poses)
  async #loadBanks() {
    let idx = null;
    try { const r = await fetch(this.dir + 'bank.json', { cache: 'no-cache' }); idx = r.ok ? await r.json() : null; } catch { idx = null; }
    if (!idx) return;
    for (const look of Object.keys(this.src)) {
      const twin = Object.keys(this.banks).find((k) => this.src[k] === this.src[look]);
      if (twin) { this.banks[look] = this.banks[twin]; continue; } // a front-only seat reuses one bank
      const closed = this.src[look].closed || '';
      const pose = /\/cu-front-closed\.webp/.test(closed) ? 'cu-front' : /\/cu-closed\.webp/.test(closed) ? null : look;
      const meta = pose && idx[pose];
      if (!meta?.frames?.length) continue;
      const img = await load(this.dir + meta.sheet);
      if (!img) continue;
      const cv = h('canvas.puppet__img.puppet__bank.is-off', { width: meta.size[0], height: meta.size[1], 'aria-hidden': 'true' });
      this.seat.append(cv);
      const fr = meta.frames;
      // a frame "continues" its predecessor when they are neighbours in the source video
      const step = fr.length > 1 ? Math.min(...fr.slice(1).map((f, i) => f[0] - fr[i][0]).filter((d) => d > 0)) : 1;
      this.banks[look] = { cv, ctx: cv.getContext('2d'), img, meta, step, cur: meta.rest ?? 0, drawn: -1, next: 0, quietSince: 0 };
    }
  }

  #drawBank(b, i) {
    if (b.drawn === i) return;
    const [px, py, pw, ph] = b.meta.patch;
    const [tw, th] = b.meta.tile || [pw, ph]; // close-up sheets are stored at half size
    const c = b.meta.cols;
    b.ctx.clearRect(px, py, pw, ph);
    b.ctx.drawImage(b.img, (i % c) * tw, Math.floor(i / c) * th, tw, th, px, py, pw, ph);
    b.drawn = i;
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
    if (resting && fr[b.cur][1] < 0.18) return;                    // closed: hold until speech resumes
    if (now < b.next) return;
    // catch up if a frame was missed, but never skip more than one source frame
    b.next = Math.max(now, b.next + dt) + (resting ? -dt * 0.4 : 0); // a pause winds down a little faster
    let n = b.cur + b.dir;
    if (n < 0 || n >= fr.length) { b.dir = -b.dir; n = b.cur + b.dir; }
    b.cur = Math.max(0, Math.min(fr.length - 1, n));
  }

  get hasFront() { return !!this.src?.front; }

  #show(look, shape) {
    const key = `${look}:${shape}`;
    if (key === this.key) return;
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

    // 2. frame bank over a closed base, when this look has one and someone is talking
    const bank = this.banks[look];
    const useBank = bank && speaking && (pc || level > 0 || this.env > 0.02);
    for (const b of Object.values(this.banks)) if (b !== bank || !useBank) b.cv.classList.add('is-off');
    if (useBank) {
      this.#stepBank(bank, now, target, ROUND[want] || 0, want === 'closed');
      this.#drawBank(bank, bank.cur);
      bank.cv.classList.remove('is-off');
      want = 'closed'; // the base under the patch (eyes can still blink)
    }

    // 3. blinks: random, 2–6 s apart, only with the mouth shut (sometimes a double)
    if (now < this.blinkUntil) want = want === 'closed' ? 'blink' : want;
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
