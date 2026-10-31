// Procedural canvas textures for the hero. Everything here is generated at runtime
// (or loaded from img/hero/*.webp when pre-baked) and is privacy-safe by construction:
// the CV contact block is drawn as solid redaction bars; bullets are greeked gibberish.

import { mulberry32 } from './util.js';

const INK = '#171512';
const ACCENT = '#b4472b';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function grain(ctx, w, h, amt, seed = 7) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const r = mulberry32(seed);
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amt;
    d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.9;
  }
  ctx.putImageData(img, 0, 0);
}

function fibers(ctx, w, h, count, color, seed = 3, maxLen = 0.03) {
  const r = mulberry32(seed);
  ctx.save();
  ctx.strokeStyle = color;
  for (let i = 0; i < count; i++) {
    const x = r() * w, y = r() * h, l = (0.2 + r()) * maxLen * w, a = r() * Math.PI * 2;
    ctx.globalAlpha = 0.04 + r() * 0.08;
    ctx.lineWidth = 0.5 + r() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  ctx.restore();
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const LETTERS = 'eeeeaaaoiinnrrsttlcdumhpgfbwyvk';
function word(r) {
  const n = 2 + ((r() * 8) | 0);
  let s = '';
  for (let i = 0; i < n; i++) s += LETTERS[(r() * LETTERS.length) | 0];
  return s;
}
// greeked line of gibberish words; drawn into a low-res layer so it reads as blurred text
function greek(ctx, x, y, width, size, r, color = '#4b463f', weight = 400, font = 'Spline Sans Mono') {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px "${font}", monospace`;
  let cx = x;
  while (cx < x + width) {
    const w = word(r);
    const m = ctx.measureText(w).width;
    if (cx + m > x + width) break;
    ctx.fillText(w, cx, y);
    cx += m + size * 0.45;
  }
}

function fitText(ctx, text, maxW, size, weight, family) {
  let s = size;
  ctx.font = `${weight} ${s}px "${family}", sans-serif`;
  while (ctx.measureText(text).width > maxW && s > 6) { s -= 1; ctx.font = `${weight} ${s}px "${family}", sans-serif`; }
  return s;
}

// --------------------------------------------------------------------------- CV
const ROLES = [
  { co: 'nailinit', role: 'Chief of Staff' },
  { co: 'often', role: 'Co-Founder' },
  { co: 'mosaic', role: 'Product Manager' },
  { co: 'nykaa', role: 'Product Manager' },
  { co: 'mpage', role: 'Consultant' },
  { co: 'shopclues', role: 'Marketing Analytics Intern' },
];

function wordmark(ctx, id, x, y, w, h) {
  // clean text wordmarks (not real logos)
  ctx.save();
  ctx.textBaseline = 'middle';
  const cy = y + h / 2;
  const B = 'Bricolage Grotesque';
  if (id === 'nailinit') {
    const s = fitText(ctx, 'nailinit', w, h * 0.62, 800, B);
    ctx.fillStyle = '#c93a66';
    ctx.fillText('nailinit', x, cy);
    ctx.beginPath(); ctx.arc(x + ctx.measureText('nailinit').width + s * 0.16, cy + s * 0.22, s * 0.09, 0, 7); ctx.fill();
  } else if (id === 'often') {
    const s = fitText(ctx, 'Often', w * 0.78, h * 0.7, 600, B);
    ctx.fillStyle = '#0e6f66';
    ctx.beginPath(); ctx.arc(x + s * 0.32, cy, s * 0.3, 0, 7); ctx.fill();
    ctx.fillStyle = '#f7f2e6'; ctx.beginPath(); ctx.arc(x + s * 0.32, cy, s * 0.13, 0, 7); ctx.fill();
    ctx.fillStyle = '#0e6f66';
    ctx.fillText('Often', x + s * 0.75, cy + s * 0.02);
  } else if (id === 'mosaic') {
    const s = fitText(ctx, 'mosaic', w * 0.8, h * 0.5, 800, B);
    ctx.fillStyle = '#24543f';
    const g = s * 0.22;
    for (let i = 0; i < 4; i++) ctx.fillRect(x + (i % 2) * g * 1.15, cy - s * 0.42 + ((i / 2) | 0) * g * 1.15, g, g);
    ctx.fillText('mosaic', x + g * 2.7, cy - s * 0.22);
    ctx.font = `400 ${s * 0.55}px "Spline Sans Mono", monospace`;
    ctx.fillText('wellness', x + g * 2.75, cy + s * 0.42);
  } else if (id === 'nykaa') {
    fitText(ctx, 'NYKAA', w * 0.95, h * 0.62, 800, B);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
    ctx.fillStyle = '#e1306c';
    ctx.fillText('NYKAA', x, cy);
  } else if (id === 'mpage') {
    const s = fitText(ctx, 'Michael Page', w, h * 0.46, 600, B);
    ctx.fillStyle = '#1f2c55';
    ctx.fillText('Michael Page', x, cy);
    ctx.fillRect(x, cy + s * 0.55, w * 0.32, Math.max(1.5, s * 0.08));
  } else if (id === 'shopclues') {
    const s = fitText(ctx, 'ShopClues', w, h * 0.55, 800, B);
    ctx.fillStyle = '#0f8f8c';
    ctx.fillText('Shop', x, cy);
    const sw = ctx.measureText('Shop').width;
    ctx.fillStyle = '#e8820e';
    ctx.fillText('Clues', x + sw, cy);
    void s;
  }
  ctx.restore();
}

export function drawCVFront(W) {
  const H = Math.round(W * 1.4142);
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const u = W / 100;
  const r = mulberry32(42);

  // paper
  ctx.fillStyle = '#f6f2e8';
  ctx.fillRect(0, 0, W, H);
  const tone = ctx.createRadialGradient(W * 0.4, H * 0.35, W * 0.1, W * 0.5, H * 0.5, W * 0.95);
  tone.addColorStop(0, 'rgba(255,255,250,0.35)');
  tone.addColorStop(1, 'rgba(200,185,160,0.18)');
  ctx.fillStyle = tone; ctx.fillRect(0, 0, W, H);

  // ---- blurred layer (greeked copy): drawn at 1/3 scale then upscaled
  const k = 4;
  const bl = makeCanvas(Math.ceil(W / k), Math.ceil(H / k));
  const b = bl.getContext('2d');
  b.scale(1 / k, 1 / k);
  b.textBaseline = 'alphabetic';
  // summary paragraph
  for (let i = 0; i < 3; i++) greek(b, 7 * u, 22 * u + i * 2.5 * u, (i === 2 ? 52 : 84) * u, 1.6 * u, r, '#45403a');
  // entries
  const top = 34 * u, step = 15.2 * u;
  ROLES.forEach((e, i) => {
    const y = top + i * step;
    greek(b, 25 * u, y + 4.6 * u, 26 * u, 1.35 * u, r, '#6b655c');
    for (let l = 0; l < 3; l++) {
      const yy = y + 7.9 * u + l * 2.35 * u;
      b.fillStyle = '#57514a';
      b.beginPath(); b.arc(25.6 * u, yy - 0.45 * u, 0.32 * u, 0, 7); b.fill();
      greek(b, 26.8 * u, yy, (l === 2 ? 22 : 34) * u + r() * 4 * u, 1.45 * u, r, '#4b463f');
    }
  });
  // right column
  const colX = 70 * u, colW = 23 * u;
  const blocks = [[38, 4], [74, 5], [98, 3]];
  blocks.forEach(([y0, n]) => {
    for (let l = 0; l < n; l++) greek(b, colX, (y0 + 3.4 + l * 2.6) * u, colW - (l % 2) * 5 * u, 1.4 * u, r, '#4b463f');
  });
  // skill chips (outlined)
  b.strokeStyle = '#6d675e'; b.lineWidth = 0.18 * u;
  for (let i = 0; i < 6; i++) {
    const cx = colX + (i % 2) * 11.5 * u, cy = (57.5 + ((i / 2) | 0) * 3.6) * u;
    rrect(b, cx, cy, 10.5 * u, 2.5 * u, 1.2 * u); b.stroke();
    greek(b, cx + 1 * u, cy + 1.75 * u, 8.5 * u, 1.2 * u, r, '#5c564e');
  }
  // footer
  greek(b, 7 * u, 136 * u, 60 * u, 1.2 * u, r, '#8a8378');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bl, 0, 0, W, H);

  // ---- crisp layer
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;
  ctx.font = `800 ${7.4 * u}px "Bricolage Grotesque", sans-serif`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${-0.12 * u}px`;
  ctx.fillText('Sameep Rehlan', 6.6 * u, 12 * u);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.fillStyle = '#4a453d';
  ctx.font = `400 ${1.75 * u}px "Spline Sans Mono", monospace`;
  ctx.fillText('Building consumer products and practical AI tools.', 7 * u, 16 * u);

  // contact block: fully redacted
  const cw = [21, 17, 24, 14];
  cw.forEach((w, i) => {
    const y = (5.6 + i * 2.75) * u;
    ctx.fillStyle = '#8c857a';
    rrect(ctx, 69 * u, y + 0.15 * u, 1.3 * u, 1.3 * u, 0.25 * u); ctx.fill();
    ctx.fillStyle = '#121110';
    rrect(ctx, 71.2 * u, y, w * u, 1.6 * u, 0.2 * u); ctx.fill();
  });

  ctx.fillStyle = INK;
  ctx.fillRect(7 * u, 18.6 * u, 86 * u, 0.22 * u);

  const label = (t, x, y) => {
    ctx.fillStyle = ACCENT;
    ctx.font = `500 ${1.35 * u}px "Spline Sans Mono", monospace`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${0.35 * u}px`;
    ctx.fillText(t, x, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  };
  label('EXPERIENCE', 7 * u, 31 * u);
  label('EDUCATION', colX, 38 * u);
  label('SKILLS', colX, 54.5 * u);
  label('PROJECTS', colX, 74 * u);
  label('ELSEWHERE', colX, 98 * u);

  ROLES.forEach((e, i) => {
    const y = top + i * step;
    wordmark(ctx, e.co, 7 * u, y, 15 * u, 5.4 * u);
    ctx.fillStyle = INK;
    ctx.font = `600 ${2.15 * u}px "Bricolage Grotesque", sans-serif`;
    ctx.fillText(e.role, 25 * u, y + 2.4 * u);
    if (i < ROLES.length - 1) {
      ctx.fillStyle = 'rgba(30,26,20,0.12)';
      ctx.fillRect(25 * u, y + step - 2.2 * u, 39 * u, 0.12 * u);
    }
  });
  ctx.fillStyle = 'rgba(30,26,20,0.14)';
  ctx.fillRect(66.5 * u, 28 * u, 0.12 * u, 100 * u);

  fibers(ctx, W, H, 900, '#7a6a52', 11, 0.02);
  grain(ctx, W, H, 10, 5);
  return c;
}

export function drawCVBack(front) {
  const W = front.width, H = front.height;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#efe9dc';
  ctx.fillRect(0, 0, W, H);
  // show-through: the front, mirrored (we're looking at it from behind), soft + faint
  const k = 4;
  const s = makeCanvas(Math.ceil(W / k), Math.ceil(H / k));
  const sc = s.getContext('2d');
  sc.translate(s.width, 0); sc.scale(-1, 1);
  sc.drawImage(front, 0, 0, s.width, s.height);
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.globalCompositeOperation = 'multiply';
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(s, 0, 0, W, H);
  ctx.restore();
  const tone = ctx.createLinearGradient(0, 0, W, H);
  tone.addColorStop(0, 'rgba(255,250,240,0.12)');
  tone.addColorStop(1, 'rgba(160,140,110,0.12)');
  ctx.fillStyle = tone; ctx.fillRect(0, 0, W, H);
  fibers(ctx, W, H, 1300, '#6f604a', 19, 0.025);
  grain(ctx, W, H, 12, 9);
  return c;
}

// Anonymous CVs for the pile: 4 layouts in a 2×2 atlas, everything greeked (nobody's data).
export function drawPileAtlas(W = 1024) {
  const cw = W / 2, ch = Math.round(cw * 1.4142);
  const c = makeCanvas(W, ch * 2);
  const ctx = c.getContext('2d');
  const accents = ['#2d5a8c', '#8c2d3b', '#2e6b4f', '#5b4a8a'];
  for (let cell = 0; cell < 4; cell++) {
    const ox = (cell % 2) * cw, oy = ((cell / 2) | 0) * ch;
    const r = mulberry32(100 + cell);
    const u = cw / 100;
    ctx.save();
    ctx.translate(ox, oy);
    ctx.fillStyle = ['#f7f4ec', '#f4f1ea', '#f6f3ea', '#f3f0e8'][cell];
    ctx.fillRect(0, 0, cw, ch);
    const acc = accents[cell];
    const k = 2.5;
    const bl = makeCanvas(Math.ceil(cw / k), Math.ceil(ch / k));
    const b = bl.getContext('2d');
    b.scale(1 / k, 1 / k);
    const side = cell === 1 || cell === 3;
    if (cell === 2) { b.fillStyle = acc; b.fillRect(0, 0, cw, 20 * u); }
    // name + title (greeked, heavy)
    greek(b, side ? 36 * u : 8 * u, 11 * u, 50 * u, 6 * u, r, cell === 2 ? '#f4efe4' : '#1b1a18', 800, 'Bricolage Grotesque');
    greek(b, side ? 36 * u : 8 * u, 16 * u, 40 * u, 2 * u, r, cell === 2 ? '#e8e0d0' : '#55504a');
    if (side) {
      b.fillStyle = cell === 3 ? '#ece6da' : acc; b.globalAlpha = cell === 3 ? 1 : 0.12;
      b.fillRect(0, 0, 28 * u, ch); b.globalAlpha = 1;
      b.fillStyle = '#c9c1b2'; b.beginPath(); b.arc(14 * u, 14 * u, 8 * u, 0, 7); b.fill();
      for (let i = 0; i < 22; i++) greek(b, 4 * u, (32 + i * 4.2) * u, 20 * u, 1.6 * u, r, '#5b564e');
    }
    const x0 = side ? 36 * u : 8 * u, wcol = side ? 56 * u : 84 * u;
    let y = 26 * u;
    for (let sct = 0; sct < 4; sct++) {
      b.fillStyle = acc; b.fillRect(x0, y, 14 * u, 1.6 * u);
      y += 5 * u;
      const n = 2 + ((r() * 2) | 0);
      for (let e = 0; e < n; e++) {
        greek(b, x0, y, wcol * 0.6, 2.1 * u, r, '#24221f', 600, 'Bricolage Grotesque');
        y += 3.4 * u;
        for (let l = 0; l < 3; l++) { greek(b, x0 + 2 * u, y, wcol - 4 * u - r() * 14 * u, 1.5 * u, r, '#5b564e'); y += 2.6 * u; }
        y += 2 * u;
        if (y > ch - 10 * u) break;
      }
      if (y > ch - 14 * u) break;
    }
    ctx.drawImage(bl, 0, 0, cw, ch);
    ctx.restore();
  }
  grain(ctx, W, ch * 2, 9, 77);
  return c;
}

// --------------------------------------------------------------------------- envelope (kraft)
export function drawKraft(W, H, side) {
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const r = mulberry32(side === 'front' ? 3 : 4);
  ctx.fillStyle = side === 'inside' ? '#6e4f31' : '#a9804f';
  ctx.fillRect(0, 0, W, H);
  // mottling
  for (let i = 0; i < 260; i++) {
    const x = r() * W, y = r() * H, rad = (0.03 + r() * 0.12) * W;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const dark = r() > 0.5;
    g.addColorStop(0, dark ? 'rgba(80,50,20,0.07)' : 'rgba(230,200,150,0.06)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  fibers(ctx, W, H, 2400, '#3d2814', 21, 0.035);
  fibers(ctx, W, H, 900, '#e6c896', 22, 0.02);
  const u = W / 100;
  if (side === 'front') {
    // postage stamp
    ctx.save();
    ctx.translate(76 * u, 8 * u);
    ctx.rotate(0.04);
    ctx.fillStyle = '#f1ead8';
    for (let i = 0; i <= 10; i++) { // perforations
      ctx.beginPath(); ctx.arc(i * 1.6 * u, 0, 0.55 * u, 0, 7); ctx.arc(i * 1.6 * u, 20 * u, 0.55 * u, 0, 7); ctx.fill();
    }
    ctx.fillRect(0, 0, 16 * u, 20 * u);
    ctx.fillStyle = '#0a8fa8';
    ctx.fillRect(1.4 * u, 1.4 * u, 13.2 * u, 13 * u);
    ctx.strokeStyle = '#f6efe0'; ctx.lineWidth = 0.7 * u; ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) { // a voice waveform
      const hgt = [2, 4, 7, 4.5, 9, 5, 3, 6, 2][i] * u * 0.55;
      ctx.beginPath(); ctx.moveTo(3 * u + i * 1.25 * u, 7.9 * u - hgt / 2); ctx.lineTo(3 * u + i * 1.25 * u, 7.9 * u + hgt / 2); ctx.stroke();
    }
    ctx.fillStyle = '#1b1712';
    ctx.font = `600 ${2.2 * u}px "Spline Sans Mono", monospace`;
    ctx.fillText('₹5', 1.6 * u, 18.5 * u);
    ctx.restore();
    // cancellation waves
    ctx.strokeStyle = 'rgba(25,25,40,0.55)'; ctx.lineWidth = 0.35 * u;
    for (let j = 0; j < 4; j++) {
      ctx.beginPath();
      for (let x = 56 * u; x < 86 * u; x += u) ctx.lineTo(x, 13 * u + j * 1.8 * u + Math.sin(x / (1.6 * u)) * 0.7 * u);
      ctx.stroke();
    }
    // handwritten address
    ctx.fillStyle = '#1d2747';
    ctx.font = `400 ${6.6 * u}px "Patrick Hand", cursive`;
    ctx.save();
    ctx.translate(26 * u, 52 * u); ctx.rotate(-0.035);
    ctx.fillText('Wispr Flow', 0, 0);
    ctx.font = `400 ${4.6 * u}px "Patrick Hand", cursive`;
    ctx.fillText('Growth team — India', 0, 7 * u);
    ctx.fillText('Bengaluru', 0, 13.5 * u);
    ctx.restore();
    // rubber stamp
    ctx.save();
    ctx.translate(18 * u, 108 * u); ctx.rotate(-0.16);
    ctx.strokeStyle = 'rgba(178,44,34,0.78)'; ctx.fillStyle = 'rgba(178,44,34,0.78)';
    ctx.lineWidth = 0.8 * u;
    rrect(ctx, 0, 0, 40 * u, 13 * u, 1.5 * u); ctx.stroke();
    ctx.font = `800 ${5.2 * u}px "Bricolage Grotesque", sans-serif`;
    ctx.fillText('NO CVs', 3.4 * u, 6.8 * u);
    ctx.font = `500 ${1.9 * u}px "Spline Sans Mono", monospace`;
    ctx.fillText('APPLICATION Nº 2000', 3.6 * u, 10.8 * u);
    // patchy ink
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 160; i++) { ctx.globalAlpha = r() * 0.5; ctx.beginPath(); ctx.arc(r() * 40 * u, r() * 13 * u, r() * 0.9 * u, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  if (side === 'back') {
    // flap seams
    ctx.strokeStyle = 'rgba(50,30,12,0.35)'; ctx.lineWidth = 0.35 * u;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W * 0.5, H * 0.44); ctx.lineTo(W, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W * 0.42, H * 0.52); ctx.moveTo(W, H); ctx.lineTo(W * 0.58, H * 0.52); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,230,190,0.18)'; ctx.lineWidth = 0.25 * u;
    ctx.beginPath(); ctx.moveTo(0, 0.6 * u); ctx.lineTo(W * 0.5, H * 0.44 + 0.6 * u); ctx.lineTo(W, 0.6 * u); ctx.stroke();
  }
  grain(ctx, W, H, 16, side === 'front' ? 1 : 2);
  return c;
}

// --------------------------------------------------------------------------- matchbox
export function drawMatchLabel(W = 640, H = 420) {
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const u = W / 100;
  ctx.fillStyle = '#efe6d2'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#1f3b36'; ctx.fillRect(3 * u, 3 * u, 94 * u, H - 6 * u);
  ctx.strokeStyle = '#e8d8b6'; ctx.lineWidth = 0.6 * u;
  ctx.strokeRect(5.5 * u, 5.5 * u, 89 * u, H - 11 * u);
  // flame emblem
  ctx.save();
  ctx.translate(20 * u, H * 0.5);
  const fl = (s, col) => {
    ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(0, -11 * u * s);
    ctx.bezierCurveTo(7 * u * s, -3 * u * s, 6 * u * s, 6 * u * s, 0, 8 * u * s);
    ctx.bezierCurveTo(-6 * u * s, 6 * u * s, -7 * u * s, -3 * u * s, 0, -11 * u * s);
    ctx.fill();
  };
  fl(1, '#ff6c4c'); fl(0.62, '#ffa946'); fl(0.3, '#fff1c4');
  ctx.restore();
  ctx.fillStyle = '#f2e7cf';
  ctx.font = `800 ${11 * u}px "Bricolage Grotesque", sans-serif`;
  ctx.fillText('No. 2000', 34 * u, H * 0.47);
  ctx.font = `500 ${3.4 * u}px "Spline Sans Mono", monospace`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${0.6 * u}px`;
  ctx.fillText('SAFETY MATCHES', 34.5 * u, H * 0.47 + 7 * u);
  ctx.fillStyle = '#ffa946';
  ctx.fillText('STRIKE ONCE · BURN BRIGHT', 34.5 * u, H * 0.47 + 13 * u);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.fillStyle = '#ffa946';
  for (let i = 0; i < 26; i++) { ctx.beginPath(); ctx.arc(8 * u + i * 3.3 * u, H - 9 * u, 0.55 * u, 0, 7); ctx.fill(); }
  grain(ctx, W, H, 14, 31);
  return c;
}

export function drawStriker(W = 256, H = 64) {
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const r = mulberry32(8);
  ctx.fillStyle = '#4a2c1c'; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = r() > 0.5 ? 'rgba(20,10,5,0.5)' : 'rgba(140,100,70,0.35)';
    ctx.fillRect(r() * W, r() * H, 1 + r() * 1.5, 1 + r() * 1.5);
  }
  return c;
}

export function drawCard(W = 256, H = 256, base = '#d9c6a2', seed = 12) {
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, W, H);
  fibers(ctx, W, H, 300, '#6b5434', seed, 0.05);
  grain(ctx, W, H, 14, seed);
  return c;
}

// --------------------------------------------------------------------------- CD label
export function drawCDLabel(S = 1024) {
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const R = S / 2;
  ctx.translate(R, R);
  // silver lacquer
  const g = ctx.createRadialGradient(-R * 0.3, -R * 0.4, R * 0.1, 0, 0, R);
  g.addColorStop(0, '#eef0f2'); g.addColorStop(0.6, '#d7dade'); g.addColorStop(1, '#bfc3c9');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill();
  // fine concentric brushing
  for (let i = 0; i < 220; i++) {
    const rr = R * (0.2 + 0.8 * (i / 220));
    ctx.strokeStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(80,90,100,0.04)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, 7); ctx.stroke();
  }
  // printed rim text (fictional media brand)
  const rim = 'CD-R · 80 MIN · 700 MB · 1× – 52× · RECORDABLE · ';
  ctx.fillStyle = 'rgba(70,78,92,0.75)';
  ctx.font = `500 ${S * 0.022}px "Spline Sans Mono", monospace`;
  let a = -Math.PI * 0.95;
  for (let k = 0; k < 2; k++) {
    for (const ch of rim) {
      ctx.save(); ctx.rotate(a); ctx.translate(0, -R * 0.9); ctx.fillText(ch, 0, 0); ctx.restore();
      a += (ctx.measureText(ch).width + S * 0.002) / (R * 0.9);
    }
  }
  // printed write-on lines
  ctx.strokeStyle = 'rgba(80,88,100,0.18)'; ctx.lineWidth = 2;
  [-0.52, -0.36, 0.36, 0.52].forEach((y) => {
    const hw = Math.sqrt(Math.max(0, 0.78 * 0.78 - y * y)) * R * 0.92;
    ctx.beginPath(); ctx.moveTo(-hw, y * R); ctx.lineTo(hw, y * R); ctx.stroke();
  });
  // Sharpie handwriting
  ctx.save();
  ctx.rotate(-0.09);
  ctx.fillStyle = '#121218';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(18,18,24,0.35)'; ctx.shadowBlur = S * 0.003;
  ctx.font = `400 ${S * 0.15}px "Patrick Hand", cursive`;
  ctx.fillText('SAMEEP', 0, -R * 0.4);
  ctx.font = `400 ${S * 0.085}px "Patrick Hand", cursive`;
  ctx.fillText('— WORK —', 0, -R * 0.21);
  ctx.font = `400 ${S * 0.1}px "Patrick Hand", cursive`;
  ctx.fillText('DO NOT LOSE', 0, R * 0.5);
  ctx.lineWidth = S * 0.007; ctx.strokeStyle = '#121218'; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-R * 0.42, R * 0.57); ctx.quadraticCurveTo(0, R * 0.6, R * 0.44, R * 0.555); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-R * 0.36, R * 0.63); ctx.quadraticCurveTo(0, R * 0.655, R * 0.38, R * 0.62); ctx.stroke();
  ctx.restore();
  return c;
}

// --------------------------------------------------------------------------- table
export function drawTable(S = 512) {
  const c = makeCanvas(S, S);
  const ctx = c.getContext('2d');
  const r = mulberry32(77);
  ctx.fillStyle = '#7a7068'; ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 1600; i++) {
    const y = r() * S;
    ctx.strokeStyle = r() > 0.5 ? 'rgba(40,32,26,0.06)' : 'rgba(255,240,220,0.04)';
    ctx.lineWidth = 0.5 + r() * 2;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(S * 0.3, y + (r() - 0.5) * 8, S * 0.6, y + (r() - 0.5) * 8, S, y); ctx.stroke();
  }
  grain(ctx, S, S, 22, 78);
  return c;
}

// --------------------------------------------------------------------------- iMac placeholder
// Same framing contract as img/imac/imac-front.webp: glass at (0.215,0.135,0.57,0.43), slot at y≈0.70.
export function drawIMacPlaceholder(W = 1600, H = 1400, glass = { x: 0.215, y: 0.135, w: 0.57, h: 0.43 }, slot = { x: 0.5, y: 0.7, w: 0.22 }) {
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const X = (v) => v * W, Y = (v) => v * H;
  // shadow on the table
  const sh = ctx.createRadialGradient(X(0.5), Y(0.95), 0, X(0.5), Y(0.95), X(0.42));
  sh.addColorStop(0, 'rgba(0,0,0,0.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh; ctx.fillRect(0, Y(0.85), W, Y(0.15));
  // foot
  ctx.fillStyle = 'rgba(150,200,210,0.55)';
  rrect(ctx, X(0.33), Y(0.86), X(0.34), Y(0.08), X(0.03)); ctx.fill();
  // translucent bondi shell
  const body = ctx.createLinearGradient(X(0.08), 0, X(0.92), 0);
  body.addColorStop(0, 'rgba(6,92,112,0.96)'); body.addColorStop(0.18, 'rgba(14,150,175,0.92)');
  body.addColorStop(0.5, 'rgba(70,190,205,0.9)'); body.addColorStop(0.82, 'rgba(14,150,175,0.92)'); body.addColorStop(1, 'rgba(6,92,112,0.96)');
  ctx.fillStyle = body;
  rrect(ctx, X(0.07), Y(0.025), X(0.86), Y(0.86), X(0.13)); ctx.fill();
  // pinstripes
  ctx.save();
  rrect(ctx, X(0.07), Y(0.025), X(0.86), Y(0.86), X(0.13)); ctx.clip();
  for (let x = X(0.07); x < X(0.93); x += 5) { ctx.fillStyle = 'rgba(255,255,255,0.045)'; ctx.fillRect(x, 0, 1.4, H); }
  const top = ctx.createLinearGradient(0, Y(0.02), 0, Y(0.9));
  top.addColorStop(0, 'rgba(255,255,255,0.28)'); top.addColorStop(0.25, 'rgba(255,255,255,0)'); top.addColorStop(1, 'rgba(0,30,40,0.35)');
  ctx.fillStyle = top; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // ice-white front bezel
  const bez = ctx.createLinearGradient(0, Y(0.07), 0, Y(0.84));
  bez.addColorStop(0, 'rgba(246,250,251,0.97)'); bez.addColorStop(1, 'rgba(214,228,232,0.97)');
  ctx.fillStyle = bez;
  rrect(ctx, X(0.14), Y(0.07), X(0.72), Y(0.77), X(0.07)); ctx.fill();
  // screen surround
  ctx.fillStyle = '#2b3033';
  rrect(ctx, X(glass.x - 0.022), Y(glass.y - 0.025), X(glass.w + 0.044), Y(glass.h + 0.05), X(0.03)); ctx.fill();
  // glass
  const gl = ctx.createRadialGradient(X(glass.x + glass.w * 0.5), Y(glass.y + glass.h * 0.5), X(0.05), X(glass.x + glass.w * 0.5), Y(glass.y + glass.h * 0.5), X(0.4));
  gl.addColorStop(0, '#11181a'); gl.addColorStop(1, '#050708');
  ctx.fillStyle = gl;
  rrect(ctx, X(glass.x), Y(glass.y), X(glass.w), Y(glass.h), X(0.018)); ctx.fill();
  const refl = ctx.createLinearGradient(X(glass.x), Y(glass.y), X(glass.x + glass.w * 0.6), Y(glass.y + glass.h * 0.6));
  refl.addColorStop(0, 'rgba(255,255,255,0.10)'); refl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = refl;
  rrect(ctx, X(glass.x), Y(glass.y), X(glass.w), Y(glass.h), X(0.018)); ctx.fill();
  // speaker grilles
  ctx.fillStyle = 'rgba(70,90,98,0.55)';
  for (const sx of [0.215, 0.665]) {
    for (let i = 0; i < 8; i++) for (let j = 0; j < 5; j++) {
      ctx.beginPath(); ctx.arc(X(sx + 0.015 + i * 0.0145), Y(0.665 + j * 0.022), X(0.0038), 0, 7); ctx.fill();
    }
  }
  // slot
  ctx.fillStyle = '#0d1214';
  rrect(ctx, X(slot.x - slot.w / 2), Y(slot.y - 0.006), X(slot.w), Y(0.012), Y(0.006)); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillRect(X(slot.x - slot.w / 2 + 0.01), Y(slot.y + 0.008), X(slot.w - 0.02), 1.5);
  // power LED
  ctx.fillStyle = '#9bd13a';
  ctx.beginPath(); ctx.arc(X(0.5), Y(0.78), X(0.004), 0, 7); ctx.fill();
  return c;
}
