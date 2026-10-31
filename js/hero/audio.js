// Hero SFX. Loads audio/sfx/<name>.mp3 when present; otherwise a quiet synthesized stand-in.
// Unlocks on the first user gesture. Never throws.
import { sharedCtx } from '../unlock.js';

const NAMES = ['paper-slide', 'paper-flip', 'paper-fold', 'whoosh', 'crumple', 'shred', 'match-strike', 'fire-loop', 'cd-whirr'];

export class HeroAudio {
  constructor() {
    this.ctx = null;
    this.buffers = new Map();
    this.muted = false;
    try { this.muted = localStorage.getItem('offthecv.muted') === '1'; } catch { /* private mode */ }
    this.unlocked = false;
    this.fire = null;
    this.onchange = null;
    const unlock = () => this.unlock();
    this._unlock = unlock;
    ['pointerdown', 'keydown', 'touchend'].forEach((e) => addEventListener(e, unlock, { passive: true }));
  }

  unlock() {
    if (this.unlocked) return;
    try {
      this.ctx = sharedCtx();
      if (!this.ctx) return;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
      this.ctx.resume?.();
      this.unlocked = true;
      ['pointerdown', 'keydown', 'touchend'].forEach((e) => removeEventListener(e, this._unlock));
      this._noise = this._makeNoise();
      NAMES.forEach((n) => this._load(n));
      this.onchange?.();
    } catch { /* no audio */ }
  }

  async _load(name) {
    try {
      const r = await fetch(`audio/sfx/${name}.mp3`);
      if (!r.ok) return;
      const ab = await r.arrayBuffer();
      const buf = await new Promise((res, rej) => this.ctx.decodeAudioData(ab, res, rej));
      this.buffers.set(name, buf);
      if (name === 'fire-loop' && this.fire) this._startFire(true);
    } catch { /* fall back to synth */ }
  }

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('offthecv.muted', m ? '1' : '0'); } catch { /* ignore */ }
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
    this.onchange?.();
  }

  _makeNoise() {
    const ctx = this.ctx, len = ctx.sampleRate * 2;
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  play(name, gain = 1) {
    if (!this.ctx || this.muted) return;
    try {
      const ctx = this.ctx, now = ctx.currentTime;
      const out = ctx.createGain();
      out.gain.value = gain;
      out.connect(this.master);
      const buf = this.buffers.get(name);
      if (buf) {
        const s = ctx.createBufferSource(); s.buffer = buf; s.connect(out); s.start(now);
        return;
      }
      this._synth(name, out, now);
    } catch { /* ignore */ }
  }

  _noiseSrc(out, now, dur, { type = 'bandpass', f0 = 2000, f1 = f0, q = 0.8, a = 0.01, peak = 0.3, rate = 1 } = {}) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = this._noise; s.playbackRate.value = rate;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, now); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(peak, now + a);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    s.connect(f); f.connect(g); g.connect(out);
    s.start(now, Math.random()); s.stop(now + dur + 0.05);
    return g;
  }

  _synth(name, out, now) {
    switch (name) {
      case 'paper-slide': this._noiseSrc(out, now, 0.55, { f0: 1800, f1: 3800, q: 0.6, a: 0.12, peak: 0.12 }); break;
      case 'paper-flip': this._noiseSrc(out, now, 0.28, { f0: 900, f1: 4200, q: 0.9, a: 0.04, peak: 0.18 }); break;
      case 'paper-fold':
        this._noiseSrc(out, now, 0.22, { f0: 2600, f1: 1400, q: 1.2, a: 0.02, peak: 0.14 });
        this._noiseSrc(out, now + 0.16, 0.06, { type: 'highpass', f0: 3000, peak: 0.2, a: 0.003 }); break;
      case 'whoosh': this._noiseSrc(out, now, 0.9, { f0: 300, f1: 2400, q: 1.6, a: 0.35, peak: 0.16 }); break;
      case 'crumple':
        for (let i = 0; i < 16; i++) this._noiseSrc(out, now + i * 0.035 + Math.random() * 0.03, 0.05 + Math.random() * 0.06, { type: 'highpass', f0: 1500 + Math.random() * 3000, peak: 0.08 + Math.random() * 0.12, a: 0.003 });
        break;
      case 'shred':
        for (let i = 0; i < 14; i++) this._noiseSrc(out, now + i * 0.045, 0.07, { f0: 3200 - i * 60, q: 2, peak: 0.12, a: 0.004 });
        break;
      case 'match-strike':
        this._noiseSrc(out, now, 0.18, { f0: 1200, f1: 5000, q: 0.7, a: 0.01, peak: 0.35 });
        this._noiseSrc(out, now + 0.16, 0.7, { type: 'lowpass', f0: 900, f1: 300, peak: 0.3, a: 0.02 });
        break;
      case 'cd-whirr': {
        const ctx = this.ctx;
        const o = ctx.createOscillator(); o.type = 'triangle';
        o.frequency.setValueAtTime(80, now); o.frequency.exponentialRampToValueAtTime(420, now + 1.6);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.06, now + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
        o.connect(g); g.connect(out); o.start(now); o.stop(now + 2.3);
        this._noiseSrc(out, now + 0.05, 2.0, { f0: 600, f1: 2600, q: 3, a: 0.5, peak: 0.05 });
        break;
      }
      default: break;
    }
  }

  // continuous fire bed; level 0..1
  setFire(level) {
    if (!this.ctx) return;
    if (!this.fire && level > 0.01) this._startFire(false);
    if (this.fire) this.fire.g.gain.setTargetAtTime(this.muted ? 0 : level * 0.5, this.ctx.currentTime, 0.12);
  }

  _startFire(replace) {
    try {
      const ctx = this.ctx;
      if (this.fire && replace) { try { this.fire.src.stop(); } catch { /* */ } }
      const g = this.fire?.g || ctx.createGain();
      if (!this.fire) { g.gain.value = 0; g.connect(this.master); }
      const src = ctx.createBufferSource();
      src.loop = true;
      const buf = this.buffers.get('fire-loop');
      if (buf) { src.buffer = buf; src.connect(g); } else {
        src.buffer = this._noise;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520;
        src.connect(f); f.connect(g);
      }
      src.start();
      this.fire = { src, g };
    } catch { /* ignore */ }
  }

  crackle(level) {
    if (!this.ctx || this.muted || level < 0.05) return;
    if (Math.random() < level * 0.25) this._noiseSrc(this.master, this.ctx.currentTime, 0.03 + Math.random() * 0.04, { type: 'highpass', f0: 2000 + Math.random() * 3000, peak: 0.05 + Math.random() * 0.12 * level, a: 0.002 });
  }
}
