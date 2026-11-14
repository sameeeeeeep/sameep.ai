/* p3-tex.js: every surface of the parcel scene, drawn on canvas (print, board, grain, flutes). No photos stand in for objects.
   The one image used is the founder's sketch, keyed down to its ink so it can be drawn onto the inside of the carton board. */

const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
export const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

/* value noise for canvas work (tileable at period p) */
function vnoise(p, seed) {
  const r = rng(seed), g = new Float32Array(p * p); for (let i = 0; i < g.length; i++) g[i] = r();
  const s = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = s(x - xi), fy = s(y - yi);
    const a = g[((yi % p + p) % p) * p + ((xi % p + p) % p)], b = g[((yi % p + p) % p) * p + (((xi + 1) % p + p) % p)];
    const c = g[(((yi + 1) % p + p) % p) * p + ((xi % p + p) % p)], d = g[(((yi + 1) % p + p) % p) * p + (((xi + 1) % p + p) % p)];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}
/* a tileable fbm field written straight into image data: fn(v 0..1, x, y) -> [r,g,b] */
function field(c, octaves, base, seed, paint) {
  const g = c.getContext('2d'), W = c.width, H = c.height, im = g.getImageData(0, 0, W, H), d = im.data;
  const ns = []; for (let o = 0; o < octaves; o++) ns.push(vnoise(base << o, seed + o * 17));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = 0, a = 0.5, n = 0;
    for (let o = 0; o < octaves; o++) { const f = (base << o) / W; v += a * ns[o](x * f, y * f * (W / H) * (H / W)); n += a; a *= 0.5; }
    v /= n; const k = (y * W + x) * 4; const col = paint(v, x, y);
    d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = 255;
  }
  g.putImageData(im, 0, 0); return g;
}
const hex = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const css = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a == null ? 1 : a})`;

/* ---------------- corrugated kraft ----------------
   one tile = TILE metres; flutes telegraph through the liner as faint vertical bands (an exact count per tile so it repeats) */
export const KRAFT_TILE = 0.25, FLUTES = 34;
export function kraft(px, { base = '#b48855', inner = false, seed = 3 } = {}) {
  const c = cv(px, px), B = hex(base), dark = mix(B, [70, 45, 20], 0.4), light = mix(B, [240, 214, 170], 0.32);
  const fl = px / FLUTES, r = rng(seed + 99);
  /* soft mottle (low contrast) + per-pixel grain */
  const g = field(c, 5, 5, seed, (v, x) => {
    const band = 0.5 + 0.5 * Math.cos((x / fl) * Math.PI * 2);
    let col = mix(B, v < 0.5 ? dark : light, Math.abs(v - 0.5) * 0.55);
    col = mix(col, dark, band * (inner ? 0.02 : 0.035));
    const gr = (r() - 0.5) * 14; return [col[0] + gr, col[1] + gr * 0.9, col[2] + gr * 0.7];
  });
  /* fibres: dense short strands, mostly along the machine direction */
  for (let i = 0; i < px * 26; i++) {
    const x = r() * px, y = r() * px, l = 3 + r() * 12, a = (r() - 0.5) * 0.7 + (r() < 0.25 ? Math.PI / 2 : 0);
    const lt = r() < 0.45;
    g.strokeStyle = css(lt ? mix(light, [255, 240, 210], 0.3) : mix(dark, [40, 25, 10], 0.3), 0.1 + r() * 0.16); g.lineWidth = 0.5 + r() * 0.7;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 2, y + Math.sin(a) * l * 0.5 + (r() - 0.5) * 2, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  /* flecks of recycled fibre */
  for (let i = 0; i < px * 0.5; i++) { g.fillStyle = css(r() < 0.75 ? [55, 36, 20] : [225, 210, 185], 0.2 + r() * 0.3); const s = 0.5 + r() * 1.1; g.fillRect(r() * px, r() * px, s, s * (0.4 + r())); }
  if (!inner) for (let i = 0; i < 7; i++) {
    const x = r() * px, y = r() * px, w = 40 + r() * 140;
    const gr = g.createLinearGradient(x, y, x + w, y); gr.addColorStop(0, css(light, 0)); gr.addColorStop(0.5, css(light, 0.16)); gr.addColorStop(1, css(light, 0));
    g.fillStyle = gr; g.fillRect(x, y, w, 1 + r() * 2.5);
  }
  return c;
}
/* bump for the liner: flute ridges + grain */
export function kraftBump(px, seed = 5) {
  const c = cv(px, px), fl = px / FLUTES;
  field(c, 4, 8, seed, (v, x) => { const b = 0.5 + 0.5 * Math.cos((x / fl) * Math.PI * 2); const t = 128 + b * 22 + (v - 0.5) * 60; return [t, t, t]; });
  return c;
}
/* the cut edge across the flutes: two liners and the wave between (one flute per tile width) */
export function fluteWave(w = 64, h = 32) {
  const c = cv(w, h), g = c.getContext('2d');
  g.fillStyle = '#4a3420'; g.fillRect(0, 0, w, h);                         /* the hollow flute, in shadow */
  const lin = h * 0.16;
  g.fillStyle = '#c7a173'; g.fillRect(0, 0, w, lin); g.fillRect(0, h - lin, w, lin);
  g.strokeStyle = '#b48c5c'; g.lineWidth = h * 0.11; g.beginPath();
  for (let x = 0; x <= w; x++) { const y = h / 2 + Math.cos((x / w) * Math.PI * 2) * (h / 2 - lin - h * 0.05); x ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  /* shading inside the arches */
  const gr = g.createLinearGradient(0, lin, 0, h - lin); gr.addColorStop(0, 'rgba(0,0,0,.25)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.25)');
  g.fillStyle = gr; g.fillRect(0, lin, w, h - 2 * lin);
  return c;
}
/* the cut edge along the flutes: liners and the medium seen side-on */
export function fluteStripe(w = 16, h = 32) {
  const c = cv(w, h), g = c.getContext('2d'), lin = h * 0.16;
  g.fillStyle = '#9b754a'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#c7a173'; g.fillRect(0, 0, w, lin); g.fillRect(0, h - lin, w, lin);
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, h * 0.45, w, h * 0.1);
  return c;
}

/* ---------------- packing tape (brown polypropylene, the brand's mark printed small along it) ---------------- */
export function tape(cfg, w = 1024, h = 96) {
  const c = cv(w, h), g = c.getContext('2d');
  g.fillStyle = '#9c6c35'; g.fillRect(0, 0, w, h);
  const r = rng(41);
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,220,170' : '60,35,10'},${0.015 + r() * 0.025})`; g.fillRect(0, r() * h, w, 0.6 + r() * 1.2); }
  const name = cfg.tapeText;
  if (name) {
    g.fillStyle = cfg.tapeInk || 'rgba(58,18,26,.78)'; g.font = `500 ${h * 0.34}px ${cfg.wordFont}`; g.textBaseline = 'middle';
    const step = w / 4; for (let k = 0; k < 4; k++) g.fillText(name, k * step + step * 0.22, h * 0.53);
  }
  /* the cut edges: slightly lighter, a hair serrated */
  g.fillStyle = 'rgba(255,230,190,.18)'; g.fillRect(0, 0, w, 2); g.fillRect(0, h - 2, w, 2);
  return c;
}

/* ---------------- barcode + 2D code (deterministic, look-alike, not scannable) ---------------- */
function bars(g, str, x, y, w, h) {
  let s = 7; for (const ch of str) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  const r = rng(s), mods = []; let tot = 0;
  mods.push(2, 1, 1, 1); /* start guard */
  while (tot < 140) { const m = 1 + Math.floor(r() * 4); mods.push(m); tot += m; }
  mods.push(1, 1, 2, 3); tot = mods.reduce((a, b) => a + b, 0);
  const u = w / tot; let cx = x;
  mods.forEach((m, i) => { if (i % 2 === 0) g.fillRect(cx, y, m * u - 0.3, h); cx += m * u; });
}
function matrix(g, str, x, y, s, n = 25) {
  let sd = 3; for (const ch of str) sd = (sd * 33 + ch.charCodeAt(0)) >>> 0;
  const r = rng(sd), u = s / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (r() < 0.47) g.fillRect(x + i * u, y + j * u, u + 0.4, u + 0.4);
  const finder = (fx, fy) => { g.clearRect(fx, fy, u * 7, u * 7); g.fillRect(fx, fy, u * 7, u * 7); g.clearRect(fx + u, fy + u, u * 5, u * 5); g.fillStyle = '#f7f5ee'; g.fillRect(fx + u, fy + u, u * 5, u * 5); g.fillStyle = '#141311'; g.fillRect(fx + u * 2, fy + u * 2, u * 3, u * 3); };
  finder(x, y); finder(x + s - u * 7, y); finder(x, y + s - u * 7);
}

/* ---------------- the shipping label (thermal, 140 x 84 mm at 10 px/mm) ---------------- */
export const LABEL_MM = [140, 84];
export function label(cfg, px = 10) {
  const W = LABEL_MM[0] * px, H = LABEL_MM[1] * px, c = cv(W, H), g = c.getContext('2d'), sh = cfg.shipping || {}, mm = (v) => v * px;
  g.fillStyle = '#f7f5ee'; g.fillRect(0, 0, W, H);
  const ink = '#141311'; g.fillStyle = ink; g.strokeStyle = ink;
  const sans = cfg.sansFont, mono = cfg.monoFont;
  g.lineWidth = mm(0.5);
  /* header: courier + service, prepaid box */
  g.font = `700 ${mm(6.2)}px ${sans}`; g.textBaseline = 'alphabetic'; g.fillText(sh.courier || 'Courier', mm(5), mm(10));
  g.font = `500 ${mm(3.4)}px ${sans}`; g.fillText((sh.service || 'Surface').toUpperCase(), mm(5), mm(15));
  g.fillRect(mm(96), mm(4), mm(39), mm(12)); g.fillStyle = '#f7f5ee'; g.font = `700 ${mm(5)}px ${sans}`; g.textAlign = 'center'; g.fillText('PREPAID', mm(115.5), mm(12)); g.textAlign = 'left'; g.fillStyle = ink;
  g.fillRect(mm(3), mm(18.5), mm(134), mm(0.6));
  /* AWB barcode */
  bars(g, sh.awb || '000000000000', mm(5), mm(21), mm(84), mm(15));
  g.font = `500 ${mm(3.3)}px ${mono}`; g.fillText('AWB ' + (sh.awb || ''), mm(5), mm(40.5));
  /* routing block */
  g.font = `700 ${mm(11)}px ${sans}`; g.textAlign = 'right'; g.fillText(sh.pin || '', mm(136), mm(33)); g.font = `500 ${mm(3)}px ${mono}`; g.fillText('DEL/SKT/04', mm(136), mm(39.5)); g.textAlign = 'left';
  g.fillRect(mm(3), mm(43), mm(134), mm(0.6));
  /* ship to */
  g.font = `500 ${mm(2.8)}px ${mono}`; g.fillText('SHIP TO', mm(5), mm(48));
  g.font = `700 ${mm(4.6)}px ${sans}`; g.fillText(sh.to_name || 'Customer', mm(5), mm(54.5));
  g.font = `400 ${mm(3.8)}px ${sans}`; g.fillText(sh.to_line || '', mm(5), mm(60)); g.fillText((sh.to_city || '') + (sh.pin ? ' ' + sh.pin : ''), mm(5), mm(65));
  /* from + order */
  g.font = `500 ${mm(2.8)}px ${mono}`; g.fillText('FROM', mm(5), mm(72));
  g.font = `400 ${mm(3.4)}px ${sans}`; g.fillText((cfg.brandName || '') + (cfg.city ? ', ' + cfg.city : ''), mm(5), mm(77));
  g.font = `400 ${mm(3)}px ${mono}`; g.fillText('ORDER ' + (sh.order || '') + '   ' + (sh.weight || ''), mm(5), mm(81.5));
  /* 2D code */
  matrix(g, (sh.awb || '') + (sh.order || ''), mm(103), mm(47), mm(31));
  g.strokeRect(mm(1.5), mm(1.5), W - mm(3), H - mm(3));
  /* thermal print: a little patchy */
  const r = rng(77), im = g.getImageData(0, 0, W, H), d = im.data;
  for (let k = 0; k < d.length; k += 4) if (d[k] < 120 && r() < 0.06) { d[k] = d[k + 1] = d[k + 2] = 60 + r() * 50; }
  g.putImageData(im, 0, 0);
  return c;
}
export function labelBack(px = 4) {
  const W = LABEL_MM[0] * px, H = LABEL_MM[1] * px, c = cv(W, H);
  field(c, 4, 6, 12, (v) => { const t = 228 + (v - 0.5) * 14; return [t, t - 3, t - 10]; });
  return c;
}

/* ---------------- the mono carton: one dieline atlas (print side) + its inside ----------------
   millimetres; x left to right on the print side: back | side | front | side | glue; y up from the body's foot */
export const CARTON = { W: 34, D: 26, H: 95, tongue: 12, dust: 12, glue: 10 };
export function dieline() {
  const { W, D, H, tongue, dust, glue } = CARTON;
  const x = { back: 0, s1: W, front: W + D, s2: 2 * W + D, glue: 2 * W + 2 * D };
  const r = {
    back: [x.back, 0, W, H], s1: [x.s1, 0, D, H], front: [x.front, 0, W, H], s2: [x.s2, 0, D, H], glue: [x.glue, 0, glue, H],
    topClose: [x.back, H, W, D], topTongue: [x.back, H + D, W, tongue],
    botClose: [x.front, -D, W, D], botTongue: [x.front, -D - tongue, W, tongue],
    dust1T: [x.s1, H, D, dust], dust2T: [x.s2, H, D, dust], dust1B: [x.s1, -dust, D, dust], dust2B: [x.s2, -dust, D, dust],
  };
  const X0 = 0, X1 = 2 * W + 2 * D + glue, Y0 = -D - tongue, Y1 = H + D + tongue;
  return { r, X0, X1, Y0, Y1, w: X1 - X0, h: Y1 - Y0 };
}
/* print side: board colour, the wave all the way round, wordmark in foil; foil mask in a second canvas (R = foil) */
export function cartonPrint(cfg, ppm = 12) {
  const dl = dieline(), { r } = dl, W = Math.round(dl.w * ppm), H = Math.round(dl.h * ppm);
  const c = cv(W, H), g = c.getContext('2d'), f = cv(W, H), fg = f.getContext('2d');
  fg.fillStyle = '#000'; fg.fillRect(0, 0, W, H);
  const P = (xm, ym) => [(xm - dl.X0) * ppm, (dl.Y1 - ym) * ppm];            /* mm -> canvas px (y down) */
  const board = cfg.board, cream = cfg.cream, wave = cfg.wave, foil = cfg.foil;
  /* whole sheet in board colour, glue flap left plain */
  g.fillStyle = board; g.fillRect(0, 0, W, H);
  const [gx, gy] = P(r.glue[0], r.glue[1] + r.glue[3]); g.fillStyle = '#ece6dc'; g.fillRect(gx, gy, r.glue[2] * ppm, r.glue[3] * ppm);
  /* print texture: a soft mottle so the flat colour reads as ink on board */
  const im = g.getImageData(0, 0, W, H), d = im.data, n = vnoise(64, 9), n2 = vnoise(256, 10);
  for (let y = 0; y < H; y += 1) for (let x2 = 0; x2 < W; x2 += 1) { const k = (y * W + x2) * 4, v = (n(x2 / W * 64, y / W * 64) - 0.5) * 6 + (n2(x2 / W * 256, y / W * 256) - 0.5) * 5; d[k] += v; d[k + 1] += v; d[k + 2] += v; }
  g.putImageData(im, 0, 0);
  /* the wave: one continuous band around back, sides and front (periodic over the wrap so it meets itself at the glue line) */
  const wrap = 2 * (CARTON.W + CARTON.D), mid = CARTON.H * 0.47, amp = 4.2, thick = 4.4;
  const yw = (xm) => mid + amp * Math.sin(((xm - CARTON.W - CARTON.D * 0.3) / wrap) * Math.PI * 2 * 2);
  g.fillStyle = wave; g.beginPath();
  for (let xm = 0; xm <= wrap; xm += 0.5) { const [px2, py] = P(xm, yw(xm) + thick / 2); xm ? g.lineTo(px2, py) : g.moveTo(px2, py); }
  for (let xm = wrap; xm >= 0; xm -= 0.5) { const [px2, py] = P(xm, yw(xm) - thick / 2); g.lineTo(px2, py); }
  g.closePath(); g.fill();
  /* text helpers */
  const text = (s, xm, ym, sizeMm, font, color, align = 'center', ctx = g, rot = 0) => {
    const [px2, py] = P(xm, ym); ctx.save(); ctx.translate(px2, py); ctx.rotate(rot); ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
    ctx.font = font.replace('$', (sizeMm * ppm).toFixed(1) + 'px'); ctx.fillText(s, 0, 0); ctx.restore();
  };
  const fit = (s, maxMm, sizeMm, font) => { g.font = font.replace('$', (sizeMm * ppm) + 'px'); const w = g.measureText(s).width / ppm; return w > maxMm ? sizeMm * maxMm / w : sizeMm; };
  const word = cfg.brandWord, wf = `${cfg.wordWeight} $ ${cfg.wordFont}`, sf = `400 $ ${cfg.sansFont}`, sfm = `500 $ ${cfg.sansFont}`;
  /* front */
  const fc = r.front[0] + CARTON.W / 2, ws = fit(word, CARTON.W * 0.78, 7.4, wf);
  text(word, fc, CARTON.H * 0.74, ws, wf, foil); text(word, fc, CARTON.H * 0.74, ws, wf, '#fff', 'center', fg);
  text(cfg.productLine, fc, CARTON.H * 0.3, fit(cfg.productLine, CARTON.W * 0.84, 3.0, sf), sf, cream);
  text(cfg.shade, fc, CARTON.H * 0.235, 2.6, sf, cream);
  text(cfg.net, fc, CARTON.H * 0.14, 2.6, sf, cream);
  /* back: small copy, barcode panel */
  const bc = r.back[0] + CARTON.W / 2;
  text(word, bc, CARTON.H * 0.86, fit(word, CARTON.W * 0.5, 4, wf), wf, foil); text(word, bc, CARTON.H * 0.86, fit(word, CARTON.W * 0.5, 4, wf), wf, '#fff', 'center', fg);
  const lines = cfg.backCopy;
  lines.forEach((l, i) => text(l, r.back[0] + 3, CARTON.H * 0.33 - i * 2.6, 1.55, sf, cream, 'left'));
  { const [bx, by] = P(r.back[0] + 7, CARTON.H * 0.14 + 7); g.fillStyle = cream; g.fillRect(bx, by, 20 * ppm, 9 * ppm); g.fillStyle = '#1a1414'; bars(g, cfg.ean, bx + 1.2 * ppm, by + 1 * ppm, 17.6 * ppm, 5.6 * ppm); g.font = `400 ${1.4 * ppm}px ${cfg.monoFont}`; g.textAlign = 'center'; g.fillText(cfg.ean, bx + 10 * ppm, by + 8.3 * ppm); }
  /* sides: the wordmark running up the panel, the shade on the other */
  const s1c = r.s1[0] + CARTON.D / 2, s2c = r.s2[0] + CARTON.D / 2;
  text(word, s1c + 1.3, CARTON.H * 0.73, fit(word, CARTON.H * 0.34, 4.4, wf), wf, foil, 'center', g, -Math.PI / 2); text(word, s1c + 1.3, CARTON.H * 0.73, fit(word, CARTON.H * 0.34, 4.4, wf), wf, '#fff', 'center', fg, -Math.PI / 2);
  text(cfg.shade, s2c + 1, CARTON.H * 0.75, 2.6, sfm, cream, 'center', g, -Math.PI / 2);
  text(cfg.net, s2c + 1, CARTON.H * 0.2, 2.2, sf, cream, 'center', g, -Math.PI / 2);
  /* top closure: wordmark small (reads from the front once folded) */
  const tc = r.topClose; text(word, tc[0] + CARTON.W / 2, tc[1] + CARTON.D * 0.4, fit(word, CARTON.W * 0.6, 4, wf), wf, foil, 'center', g, Math.PI); text(word, tc[0] + CARTON.W / 2, tc[1] + CARTON.D * 0.4, fit(word, CARTON.W * 0.6, 4, wf), wf, '#fff', 'center', fg, Math.PI);
  /* crease lines faintly debossed: drawn darker */
  g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = Math.max(1, ppm * 0.18);
  const line = (x1, y1, x2, y2) => { const a = P(x1, y1), b = P(x2, y2); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); };
  [r.s1[0], r.front[0], r.s2[0], r.glue[0]].forEach((xm) => line(xm, 0, xm, CARTON.H));
  line(r.back[0], CARTON.H, r.back[0] + CARTON.W, CARTON.H); line(r.front[0], 0, r.front[0] + CARTON.W, 0);
  return { print: c, foil: f, dl };
}
/* inside of the board: unprinted, greyish white; the sketch ink goes on a separate layer */
export function cartonInside(ppm = 6) {
  const dl = dieline(), W = Math.round(dl.w * ppm), H = Math.round(dl.h * ppm), c = cv(W, H);
  field(c, 4, 8, 31, (v) => { const t = 216 + (v - 0.5) * 14; return [t - 1, t - 3, t - 9]; });
  return c;
}
/* the sketch's ink, keyed off the notebook page, laid on the inside of the dieline (mirrored, since it is read from behind) */
export function sketchInk(img, ppm = 12) {
  const dl = dieline(), W = Math.round(dl.w * ppm), H = Math.round(dl.h * ppm), c = cv(W, H), g = c.getContext('2d');
  if (!img) return c;
  /* the drawing sits over the four body panels (x 0..120 mm), centred, as large as the body allows */
  const bodyW = 2 * (CARTON.W + CARTON.D), sz = Math.min(bodyW * 1.02, dl.h * 0.98);
  const t = cv(img.naturalWidth || img.width, img.naturalHeight || img.height), tg = t.getContext('2d');
  tg.drawImage(img, 0, 0);
  const im = tg.getImageData(0, 0, t.width, t.height), d = im.data;
  for (let k = 0; k < d.length; k += 4) {
    const R = d[k], G = d[k + 1], B = d[k + 2], lum = (R + G + B) / 765;
    let a = Math.min(1, Math.max(0, (0.74 - lum) / 0.3)) * (B > R + 16 ? 1 : 0);     /* dark and blue: biro, not ruling or shadow */
    d[k] = 18; d[k + 1] = 30; d[k + 2] = 118; d[k + 3] = Math.round(a * 255);
  }
  tg.putImageData(im, 0, 0);
  const cx = (bodyW / 2 - dl.X0) * ppm, cy = (dl.Y1 - (CARTON.H / 2)) * ppm;
  g.save(); g.translate(cx, cy); g.scale(-1, 1);
  g.drawImage(t, -sz * ppm / 2, -sz * ppm / 2, sz * ppm, sz * ppm); g.restore();
  /* the visible side of the inside reads mirrored on the canvas: the dieline is flipped to show it */
  return c;
}

/* ---------------- the doorstep ---------------- */
export function plaster(px = 512) {
  const c = cv(px, px), r = rng(4);
  const g = field(c, 5, 4, 21, (v) => { const t = 228 + (v - 0.5) * 22; return [t + 2, t - 2, t - 12]; });
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '120,105,90' : '255,250,240'},${0.04 + r() * 0.06})`; g.fillRect(r() * px, r() * px, 1 + r() * 2, 1 + r() * 2); }
  return c;
}
export function terrazzo(px = 1024) {
  /* kota-like stone tiles, 600 mm, with grout; the tile spans 1.2 m */
  const c = cv(px, px), r = rng(8);
  const g = field(c, 5, 4, 33, (v) => { const t = 168 + (v - 0.5) * 26; return [t + 10, t + 3, t - 8]; });
  for (let i = 0; i < px * 2; i++) { const s = 0.5 + r() * 1.2; g.fillStyle = `rgba(${r() < 0.5 ? '90,80,70' : '230,222,208'},${0.08 + r() * 0.14})`; g.beginPath(); g.ellipse(r() * px, r() * px, s, s * (0.5 + r() * 0.6), r() * 3, 0, Math.PI * 2); g.fill(); }
  /* faint veins */
  for (let i = 0; i < 18; i++) { g.strokeStyle = 'rgba(120,108,95,.08)'; g.lineWidth = 1 + r() * 2; g.beginPath(); let x = r() * px, y = r() * px; g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 120; y += (r() - 0.3) * 60; g.lineTo(x, y); } g.stroke(); }
  g.fillStyle = 'rgba(80,70,60,.55)'; g.fillRect(0, 0, px, 2.5); g.fillRect(0, px / 2, px, 2.5); g.fillRect(0, 0, 2.5, px); g.fillRect(px / 2, 0, 2.5, px);
  return c;
}
export function wood(px = 512, base = '#5b3a26') {
  const c = cv(px, px), B = hex(base), r = rng(14);
  const g = field(c, 3, 2, 17, (v) => mix(B, mix(B, [20, 10, 5], 0.5), v * 0.6));
  for (let i = 0; i < 220; i++) {
    g.strokeStyle = css(mix(B, r() < 0.5 ? [15, 8, 4] : [150, 100, 70], 0.4), 0.035 + r() * 0.06); g.lineWidth = 0.5 + r() * 2;
    const x0 = r() * px; g.beginPath(); g.moveTo(x0, 0); for (let y = 0; y <= px; y += 16) g.lineTo(x0 + Math.sin(y / 70 + i) * 4 + Math.sin(y / 23 + i * 3) * 1.2, y); g.stroke();
  }
  return c;
}
export function coir(px = 512) {
  /* coconut fibre: dense short strands, a darker border woven in */
  const c = cv(px, px), r = rng(19);
  const g = field(c, 4, 8, 44, (v) => mix([118, 82, 42], [168, 122, 66], v));
  for (let i = 0; i < px * 40; i++) {
    const x = r() * px, y = r() * px, a = r() * Math.PI, l = 2 + r() * 6;
    g.strokeStyle = r() < 0.5 ? `rgba(70,45,20,${0.25 + r() * 0.3})` : `rgba(200,155,95,${0.2 + r() * 0.3})`; g.lineWidth = 0.6 + r() * 0.8;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  return c;
}
export function coirBump(px = 256) {
  const c = cv(px, px), r = rng(23), g = c.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, px, px);
  for (let i = 0; i < px * 30; i++) { const x = r() * px, y = r() * px, a = r() * Math.PI; g.strokeStyle = r() < 0.5 ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.35)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4); g.stroke(); }
  return c;
}
export function terracotta(px = 256) {
  const c = cv(px, px), r = rng(29);
  const g = field(c, 5, 4, 51, (v) => mix([140, 78, 54], [178, 108, 78], v));
  for (let i = 0; i < 200; i++) { g.fillStyle = `rgba(240,220,200,${0.05 + r() * 0.1})`; g.fillRect(r() * px, r() * px, 1 + r() * 4, 1); }
  return c;
}
export function leaf(w = 64, h = 512) {
  /* snake-plant blade: dark green with lighter cross bands and a yellow edge */
  const c = cv(w, h), g = c.getContext('2d'), r = rng(61);
  g.fillStyle = '#2f4a2a'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 6 + r() * 10) { g.fillStyle = `rgba(150,180,120,${0.12 + r() * 0.14})`; g.beginPath(); g.ellipse(w / 2, y, w * 0.45, 2 + r() * 3, (r() - 0.5) * 0.4, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#b8a64a'; g.fillRect(0, 0, w * 0.07, h); g.fillRect(w * 0.93, 0, w * 0.07, h);
  return c;
}
/* a soft contact shadow: rounded rectangle, blurred */
export function contact(px = 256, aspect = 1) {
  const c = cv(px, Math.round(px / aspect)), g = c.getContext('2d'), w = c.width, h = c.height;
  g.filter = `blur(${px * 0.06}px)`; g.fillStyle = '#000';
  const m = px * 0.16; g.beginPath(); g.roundRect(m, m / aspect, w - 2 * m, h - 2 * m / aspect, px * 0.04); g.fill();
  return c;
}
/* the door number plate */
export function plate(text, cfg) {
  const c = cv(256, 128), g = c.getContext('2d');
  g.fillStyle = '#e9dfc8'; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#8a6d3b'; g.lineWidth = 6; g.strokeRect(5, 5, 246, 118);
  g.fillStyle = '#2a211b'; g.font = `600 64px ${cfg.sansFont}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 68);
  return c;
}
