// synth.js — sample-domain synthesis for the boot chime and the 56k handshake.
// Pure functions (no WebAudio), so the same code renders in the browser and in
// node (tools/render-sfx.mjs → audio/sfx/*.mp3).

const TAU = Math.PI * 2;

function rng(seed = 7) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ------------------------------------------------------------------ chime
// A warm, original "power on" chord: Dmaj9 spread over four octaves, struck
// like a felt mallet on a glass bell, with a slow shimmer.
export function renderChime(sr = 44100) {
  const dur = 3.6;
  const n = Math.floor(sr * dur);
  const out = new Float32Array(n);
  const notes = [73.42, 110.0, 146.83, 185.0, 220.0, 329.63, 440.0]; // D2 A2 D3 F#3 A3 E4 A4
  notes.forEach((f, i) => {
    const t0 = i * 0.011;
    const amp = 0.16 / (1 + i * 0.18);
    const s0 = Math.floor(t0 * sr);
    for (let k = s0; k < n; k++) {
      const t = (k - s0) / sr;
      const env = Math.min(1, t / 0.012) * Math.exp(-t * (0.9 + i * 0.12));
      const vib = 1 + 0.0016 * Math.sin(TAU * 4.8 * t + i);
      const ph = TAU * f * vib * t;
      out[k] += amp * env * (Math.sin(ph) + 0.32 * Math.sin(2 * ph + 0.3) * Math.exp(-t * 3) + 0.12 * Math.sin(3.01 * ph) * Math.exp(-t * 6));
    }
  });
  // soft glass sparkle on top
  [880, 1318.5, 1760].forEach((f, i) => {
    const s0 = Math.floor((0.05 + i * 0.07) * sr);
    for (let k = s0; k < n; k++) {
      const t = (k - s0) / sr;
      out[k] += 0.025 * Math.exp(-t * 4) * Math.sin(TAU * f * t);
    }
  });
  return finish(out, sr, { lp: 5200, hp: 40, gain: 1.0 });
}

// ------------------------------------------------------------------ dial-up
const DTMF = {
  1: [697, 1209], 2: [697, 1336], 3: [697, 1477], 4: [770, 1209], 5: [770, 1336], 6: [770, 1477],
  7: [852, 1209], 8: [852, 1336], 9: [852, 1477], 0: [941, 1336],
};

// Returns { data, marks } where marks are seconds for the dialog to follow.
export function renderDialup(sr = 22050, number = '15550199') {
  const rand = rng(56000);
  const dur = 12.6;
  const n = Math.floor(sr * dur);
  const out = new Float32Array(n);
  const S = (t) => Math.floor(t * sr);
  const tone = (t0, t1, freqs, amp, shape) => {
    for (let k = S(t0); k < Math.min(n, S(t1)); k++) {
      const t = k / sr, lt = t - t0;
      const e = shape ? shape(lt, t1 - t0) : edge(lt, t1 - t0, 0.006);
      let v = 0;
      for (const f of freqs) v += Math.sin(TAU * f * t);
      out[k] += amp * e * v / freqs.length;
    }
  };
  const marks = {};

  // 0.2 — off hook, dial tone
  marks.dialtone = 0.2;
  tone(0.2, 1.15, [350, 440], 0.34);
  // 1.25 — DTMF
  marks.dialing = 1.25;
  let t = 1.25;
  for (const d of number) { tone(t, t + 0.075, DTMF[d], 0.42); t += 0.115; }
  // ringback ×1 (plus a line click)
  marks.ringing = t + 0.35;
  click(out, S(t + 0.25), 0.25, rand);
  tone(t + 0.35, t + 1.95, [440, 480], 0.26, (lt, d) => edge(lt, d, 0.02) * (0.85 + 0.15 * Math.sin(TAU * 20 * lt)));
  t += 2.35;
  // answer tone: 2100 Hz with phase reversals every 450 ms (the "eeee")
  marks.answer = t;
  click(out, S(t - 0.05), 0.35, rand);
  {
    const a0 = t, a1 = t + 1.7;
    for (let k = S(a0); k < S(a1); k++) {
      const lt = k / sr - a0;
      const flip = Math.floor(lt / 0.45) % 2 ? Math.PI : 0;
      out[k] += 0.3 * edge(lt, a1 - a0, 0.01) * (0.9 + 0.1 * Math.sin(TAU * 15 * lt)) * Math.sin(TAU * 2100 * lt + flip);
    }
    // caller's CM bursts underneath
    fsk(out, sr, a0 + 0.2, a0 + 1.5, 1650, 1850, 300, 0.07, rand);
    t = a1;
  }
  // the "bing-bong" + V.8/V.22 warbles
  marks.handshake = t;
  tone(t, t + 0.22, [980], 0.22); tone(t + 0.22, t + 0.44, [1180], 0.22);
  tone(t + 0.48, t + 0.7, [980], 0.18); tone(t + 0.7, t + 0.92, [1180], 0.18);
  fsk(out, sr, t + 0.95, t + 1.9, 1200, 2400, 600, 0.22, rand);
  fsk(out, sr, t + 1.1, t + 1.9, 980, 1650, 300, 0.12, rand);
  t += 2.0;
  // line probing: multitone chirp pairs
  marks.probing = t;
  for (let i = 0; i < 2; i++) {
    const p0 = t + i * 0.42;
    tone(p0, p0 + 0.32, [150, 450, 750, 1050, 1350, 1650, 1950, 2250, 2550, 2850, 3150, 3450], 0.38);
  }
  t += 0.95;
  // the screech: band-limited scrambled noise with amplitude breathing + carriers
  marks.training = t;
  {
    const s0 = S(t), s1 = S(t + 2.6);
    let lp1 = 0, lp2 = 0;
    for (let k = s0; k < s1 && k < n; k++) {
      const lt = (k - s0) / sr;
      const w = rand() * 2 - 1;
      lp1 += 0.55 * (w - lp1); lp2 += 0.12 * (lp1 - lp2); // crude band-pass (lp1 - lp2)
      const breath = 0.6 + 0.4 * Math.sin(TAU * 3.1 * lt) * Math.sin(TAU * 0.7 * lt + 1);
      const car = 0.25 * Math.sin(TAU * 1800 * lt + 3 * Math.sin(TAU * 600 * lt)) + 0.18 * Math.sin(TAU * 1200 * lt);
      out[k] += edge(lt, 2.6, 0.03) * (0.75 * (lp1 - lp2) * breath + car * 0.35 * (lt < 1.2 ? 1 : 0.4));
    }
    t += 2.6;
  }
  // settled: soft hiss that fades, then the line goes quiet
  marks.connected = t + 0.15;
  {
    const s0 = S(t), s1 = Math.min(n, S(t + 1.4));
    let lp = 0;
    for (let k = s0; k < s1; k++) {
      const lt = (k - s0) / sr;
      lp += 0.3 * ((rand() * 2 - 1) - lp);
      out[k] += 0.22 * lp * Math.exp(-lt * 2.6);
    }
  }
  marks.end = Math.min(dur, t + 1.4);
  return { data: finish(out, sr, { lp: 3600, hp: 280, gain: 0.95 }), marks, sampleRate: sr };
}

function edge(lt, d, a) { return Math.min(1, lt / a, (d - lt) / a); }

function click(out, k0, amp, rand) {
  for (let k = k0; k < k0 + 260 && k < out.length; k++) out[k] += amp * (rand() * 2 - 1) * Math.exp(-(k - k0) / 50);
}

function fsk(out, sr, t0, t1, f0, f1, baud, amp, rand) {
  let ph = 0, bit = 0, nextFlip = 0;
  for (let k = Math.floor(t0 * sr); k < Math.min(out.length, Math.floor(t1 * sr)); k++) {
    const lt = k / sr - t0;
    if (lt >= nextFlip) { bit = rand() > 0.5 ? 1 : 0; nextFlip += 1 / baud; }
    ph += TAU * (bit ? f1 : f0) / sr;
    out[k] += amp * edge(lt, t1 - t0, 0.01) * Math.sin(ph);
  }
}

// one-pole high/low-pass + gentle tanh limiter
function finish(buf, sr, { lp, hp, gain }) {
  const aL = 1 - Math.exp(-TAU * lp / sr);
  const aH = Math.exp(-TAU * hp / sr);
  let l = 0, hpPrevIn = 0, hpPrevOut = 0;
  let peak = 0;
  for (let k = 0; k < buf.length; k++) {
    l += aL * (buf[k] - l);
    const h = aH * (hpPrevOut + l - hpPrevIn);
    hpPrevIn = l; hpPrevOut = h;
    buf[k] = Math.tanh(h * 1.4) * gain;
    peak = Math.max(peak, Math.abs(buf[k]));
  }
  if (peak > 0.95) for (let k = 0; k < buf.length; k++) buf[k] *= 0.95 / peak;
  return buf;
}
