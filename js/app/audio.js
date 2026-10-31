// audio.js — one AudioContext for the app: master mute, synthesized SFX,
// and an analyser tap for lip-sync.
import { renderChime, renderDialup } from './synth.js';
import { store } from './util.js';
import { sharedCtx } from '../unlock.js';

const KEY = 'offthecv.sound';
const listeners = new Set();

export const sound = {
  ctx: null,
  master: null,
  on: store.get(KEY) !== 'off',

  ensure() {
    if (this.ctx) return this.ctx;
    this.ctx = sharedCtx();   // the hero's, already unlocked by the entry tap
    if (!this.ctx) return null;
    this.master = this.ctx.createGain();
    this.master.gain.value = this.on ? 1 : 0;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  },
  get unlocked() { return !!this.ctx && this.ctx.state === 'running'; },
  async unlock() {
    const ctx = this.ensure();
    if (!ctx) return false;
    // resume() stays pending until a user gesture in some browsers → never wait forever
    if (ctx.state !== 'running') { try { await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 350))]); } catch { /* noop */ } }
    return ctx.state === 'running';
  },
  canAutoplay() {
    return !!(navigator.userActivation && navigator.userActivation.hasBeenActive);
  },
  set(on) {
    this.on = on;
    store.set(KEY, on ? 'on' : 'off');
    if (this.master) this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.03);
    listeners.forEach((fn) => fn(on));
  },
  toggle() { this.set(!this.on); },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  playSamples(data, sr, { gain = 1 } = {}) {
    const ctx = this.ensure();
    if (!ctx) return { stop() {}, done: Promise.resolve() };
    const buf = ctx.createBuffer(1, data.length, sr);
    buf.copyToChannel(data, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.master);
    const done = new Promise((r) => (src.onended = r));
    src.start();
    const t0 = ctx.currentTime;
    return {
      done,
      get time() { return ctx.currentTime - t0; },
      stop() { try { g.gain.setTargetAtTime(0, ctx.currentTime, 0.04); src.stop(ctx.currentTime + 0.2); } catch { /* noop */ } },
    };
  },

  chime() {
    if (!this.unlocked) return null;
    this._chime ||= renderChime(this.ctx.sampleRate);
    return this.playSamples(this._chime, this.ctx.sampleRate, { gain: 0.9 });
  },

  dialup() {
    const d = renderDialup(22050);
    const player = this.unlocked ? this.playSamples(d.data, d.sampleRate, { gain: 0.55 }) : null;
    return { marks: d.marks, player };
  },

  // small UI ticks (synthesized, no files)
  tick(kind = 'click') {
    if (!this.unlocked || !this.on) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    const f = { click: 1800, open: 660, close: 440, error: 180, pick: 990 }[kind] || 1200;
    o.type = kind === 'error' ? 'square' : 'triangle';
    o.frequency.setValueAtTime(f, t);
    if (kind === 'open') o.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.08);
    if (kind === 'close') o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.08);
    if (kind === 'pick') o.frequency.setValueAtTime(f * 1.335, t + 0.06);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(kind === 'click' ? 0.05 : 0.08, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'error' ? 0.25 : 0.12));
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.3);
  },
};
