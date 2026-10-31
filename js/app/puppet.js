// puppet.js — a sprite seat: closed/mid/open mouth frames driven by an amplitude
// level, random blinks, and a lit/unlit state for the active speaker.
import { h } from './util.js';

const load = (src) => new Promise((r) => {
  if (!src) return r(null);
  const i = new Image();
  i.decoding = 'async';
  i.onload = () => r(i);
  i.onerror = () => r(null);
  i.src = src;
});

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
  constructor(seat, { frames, label, placeholder = {} }) {
    this.seat = seat;
    this.frames = frames || {};
    this.ph = placeholder;
    this.label = label || '';
    this.imgs = {};
    this.state = 'closed';
    this.lastSwap = 0;
    this.nextBlink = performance.now() + 1500 + Math.random() * 3000;
    this.blinkUntil = 0;
    this.level = 0;
  }

  async load() {
    const keys = ['closed', 'mid', 'open', 'blink'];
    const imgs = await Promise.all(keys.map((k) => load(this.frames[k])));
    if (!imgs[0]) {
      this.seat.classList.add('is-placeholder');
      this.src = placeholderFrames(this.ph.color, this.ph.skin, this.ph.hair);
    } else {
      this.src = {};
      keys.forEach((k, i) => (this.src[k] = imgs[i] ? this.frames[k] : this.frames.closed));
    }
    // stack all four frames and flip visibility (no decode flicker on swaps)
    for (const k of keys) {
      const im = h('img.puppet__img', { alt: k === 'closed' ? this.label : '', draggable: 'false', src: this.src[k] });
      if (k !== 'closed') im.classList.add('is-off');
      this.imgs[k] = im;
      this.seat.append(im);
    }
    return this;
  }

  // level: 0..1 smoothed loudness; only the active speaker gets a level
  update(now, level) {
    if (!this.src) return;
    // simple attack/release envelope so the mouth doesn't chatter
    this.level = level > this.level ? level : this.level * 0.82 + level * 0.18;
    let want = this.level > 0.42 ? 'open' : this.level > 0.14 ? 'mid' : 'closed';
    if (now > this.nextBlink && want === 'closed') { this.blinkUntil = now + 120; this.nextBlink = now + 2200 + Math.random() * 4200; }
    if (now < this.blinkUntil) want = 'blink';
    if (want !== this.state && (now - this.lastSwap > 65 || want === 'blink')) {
      this.imgs[this.state]?.classList.add('is-off');
      this.imgs[want]?.classList.remove('is-off');
      this.state = want;
      this.lastSwap = now;
    }
  }

  setActive(on) { this.seat.classList.toggle('is-active', on); }
}
