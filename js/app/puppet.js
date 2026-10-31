// puppet.js — a sprite seat. Two looks (side: towards the other person,
// front: into the camera) × six frames (closed / mid / open / wide / oo / blink),
// all cut from one master so nothing shifts between them. Every frame is an
// <img> stacked in the seat and preloaded; a swap only flips visibility.
//
// Lip-sync: the analyser loudness is normalised against a slowly decaying
// peak (so a quiet voice still opens the mouth), smoothed with a fast attack /
// slower release envelope, mapped to loudness bands with hysteresis, and every
// shape is held for 60–90 ms. Each new syllable rolls a small vowel variation
// (rounded "oo", or one band smaller) so it never reads as a metronome.
// Blinks are random every 2–6 s and only land while the mouth is closed.
import { h, clamp } from './util.js';
import { manifestReady } from './stage.js';

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
  }

  // Work out every frame this seat has: explicit set, else the manifest entry
  // whose dir matches frames.closed, else just the four frames we were given.
  async #frameSet() {
    if (this.frames.set) return this.frames.set;
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
    return this;
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
    if (gap > 250) { this.env = 0; this.avg = 0; this.band = 0; this.holdUntil = 0; }

    // 1. normalise against a slowly decaying peak, then attack/release envelope
    level = level > 0.006 ? level : 0;
    //    (minus part of the running average, so the mouth shuts between syllables
    //    instead of hanging open through a whole phrase)
    this.peak = Math.max(level, this.peak * Math.exp(-dt / 2200), 0.14);
    this.avg += (level - this.avg) * (1 - Math.exp(-dt / 400));
    const floor = 0.6 * this.avg;
    const x = clamp((level - floor) / Math.max(0.05, this.peak - floor), 0, 1);
    const tau = x > this.env ? 24 : 70;
    const prevEnv = this.env;
    this.env += (x - this.env) * (1 - Math.exp(-dt / tau));
    const e = this.env;

    // 2. bands with hysteresis; a new syllable (rise out of a dip) rolls a vowel
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
    const look = this.seat.dataset.look === 'front' && this.src.front ? 'front' : 'side';
    const lookChanged = !this.key.startsWith(look + ':');
    if (lookChanged || (want !== this.shape && (now >= this.holdUntil || want === 'blink' || this.shape === 'blink'))) {
      if (want !== this.shape) this.holdUntil = now + 60 + Math.random() * 30;
      this.#show(look, want);
    }
  }

  setActive(on) { this.seat.classList.toggle('is-active', on); }
}
