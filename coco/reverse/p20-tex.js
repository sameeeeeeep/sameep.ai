/* p20-tex.js: the packing station's surfaces, drawn on canvas (birch-ply bench, ply edge, pegboard, concrete floor,
   cutting mat). Seeded, so they come out the same every visit: like p3-tex's kept surfaces they are drawn in module
   workers on a first visit and kept in Cache Storage as lossless PNG ('p20tex-v1'); a return visit decodes them off-thread.
   Bump TEXC when any of them changes. Nothing brand-specific lives here. */

const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const cv = (w, h) => { if (typeof document === 'undefined') return new OffscreenCanvas(w, h); const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function vnoise(p, seed) {
  const r = rng(seed), g = new Float32Array(p * p); for (let i = 0; i < g.length; i++) g[i] = r();
  const s = (t) => t * t * (3 - 2 * t), w = (v) => ((v % p) + p) % p;
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = s(x - xi), fy = s(y - yi);
    const a = g[w(yi) * p + w(xi)], b = g[w(yi) * p + w(xi + 1)], c = g[w(yi + 1) * p + w(xi)], d = g[w(yi + 1) * p + w(xi + 1)];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}
/* a tileable fbm field: sx, sy stretch the noise (grain runs along x when sy > sx) */
function field(c, octaves, base, seed, paint, sx = 1, sy = 1) {
  const g = c.getContext('2d'), W = c.width, H = c.height, im = g.getImageData(0, 0, W, H), d = im.data;
  const ns = []; for (let o = 0; o < octaves; o++) ns.push([vnoise((base * sx) << o, seed + o * 17), vnoise((base * sy) << o, seed + o * 31)]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = 0, a = 0.5, n = 0;
    for (let o = 0; o < octaves; o++) { v += a * ns[o][0](x * ((base * sx) << o) / W, y * ((base * sy) << o) / H); n += a; a *= 0.5; }
    v /= n; const k = (y * W + x) * 4, col = paint(v, x, y);
    d[k] = col[0]; d[k + 1] = col[1]; d[k + 2] = col[2]; d[k + 3] = 255;
  }
  g.putImageData(im, 0, 0); return g;
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/* ---------------- the bench: birch-ply top (one tile = BIRCH_TILE m), grain along x ---------------- */
export const BIRCH_TILE = 0.6;
function birch_(px = 1024) {
  const c = cv(px, px), r = rng(41);
  const lo = [214, 192, 156], hi = [232, 216, 186];
  const g = field(c, 4, 2, 51, (v, x, y) => {
    /* long, gently wavering grain bands across the sheet */
    const band = 0.5 + 0.5 * Math.sin((y / px) * Math.PI * 2 * 9 + Math.sin((x / px) * Math.PI * 2 * 2) * 1.2 + v * 4.0);
    return mix(lo, hi, 0.35 + v * 0.45 + band * 0.12);
  }, 1, 6);
  for (let i = 0; i < 160; i++) {   /* fine grain lines */
    g.strokeStyle = `rgba(${r() < 0.6 ? '150,118,78' : '250,238,214'},${0.04 + r() * 0.07})`; g.lineWidth = 0.6 + r() * 1.4;
    const y0 = r() * px, ph = r() * 6; g.beginPath(); g.moveTo(0, y0);
    for (let x = 0; x <= px; x += 16) g.lineTo(x, y0 + Math.sin((x / px) * Math.PI * 2 * 2 + ph) * 5 + Math.sin((x / px) * Math.PI * 2 * 7 + ph * 2) * 1.2);
    g.stroke();
  }
  for (let i = 0; i < 9; i++) {   /* a few small pin knots, the way birch faces have them */
    const x = r() * px, y = r() * px, s = 2 + r() * 4;
    g.fillStyle = 'rgba(120,88,52,.28)'; g.beginPath(); g.ellipse(x, y, s * 2.4, s, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(90,62,34,.35)'; g.beginPath(); g.ellipse(x, y, s * 0.8, s * 0.5, 0, 0, Math.PI * 2); g.fill();
  }
  /* wear: a few faint marks where things get slid */
  for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(110,90,60,${0.03 + r() * 0.04})`; g.lineWidth = 0.5; const x = r() * px, y = r() * px; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20 + r() * 60, y + (r() - 0.5) * 4); g.stroke(); }
  return c;
}
/* the cut edge of 30 mm birch ply: thin alternating plies (u runs along the edge, v across the 30 mm) */
function plyEdge_(w = 512, h = 64) {
  const c = cv(w, h), g = c.getContext('2d'), r = rng(23), N = 13;
  for (let i = 0; i < N; i++) {
    const y0 = (i / N) * h, y1 = ((i + 1) / N) * h, dark = i % 2;
    g.fillStyle = dark ? '#b99a6c' : '#dcc59c'; g.fillRect(0, y0, w, y1 - y0 + 0.5);
  }
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '120,90,55' : '245,232,205'},${0.08 + r() * 0.12})`; g.fillRect(r() * w, r() * h, 1 + r() * 6, 0.6); }
  g.fillStyle = 'rgba(80,60,35,.35)'; g.fillRect(0, 0, w, 1.2); g.fillRect(0, h - 1.2, w, 1.2);
  return c;
}
/* ---------------- pegboard: painted hardboard, 6 mm holes on a 25 mm pitch; one tile = PEG_TILE m (8 x 8 holes) ---------------- */
export const PEG_TILE = 0.2;
function pegboard_(px = 512) {
  const c = cv(px, px), r = rng(61), n = 8, p = px / n, hr = (3 / 25) * p;
  const g = field(c, 4, 4, 71, (v) => { const t = 232 + (v - 0.5) * 10; return [t, t - 2, t - 7]; });
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '160,150,135' : '255,255,250'},${0.03 + r() * 0.05})`; g.fillRect(r() * px, r() * px, 1, 1); }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * p, y = (j + 0.5) * p;
    g.fillStyle = 'rgba(120,110,98,.10)'; g.beginPath(); g.arc(x + 0.5, y + 0.7, hr + 1.2, 0, Math.PI * 2); g.fill();   /* a soft lip where the paint rolls into the hole */
    g.fillStyle = '#8d8478'; g.beginPath(); g.arc(x, y, hr * 0.86, 0, Math.PI * 2); g.fill();   /* the hole: the wall behind, in shadow, not black */
    g.fillStyle = 'rgba(60,52,44,.35)'; g.beginPath(); g.arc(x + hr * 0.2, y + hr * 0.25, hr * 0.6, 0, Math.PI * 2); g.fill();
  }
  return c;
}
/* ---------------- floor: sealed concrete, one tile = 2 m ---------------- */
function concrete_(px = 512) {
  const c = cv(px, px), r = rng(83);
  const g = field(c, 5, 3, 91, (v) => { const t = 150 + (v - 0.5) * 34; return [t + 4, t + 2, t - 2]; });
  for (let i = 0; i < px * 3; i++) { const s = 0.4 + r() * 1.1; g.fillStyle = `rgba(${r() < 0.5 ? '90,88,84' : '205,200,192'},${0.1 + r() * 0.15})`; g.fillRect(r() * px, r() * px, s, s); }
  return c;
}
/* ---------------- the cutting mat under the box: 600 x 450 mm, grey-green, 10 mm grid, 50 mm majors, knife scores ---------------- */
export const MAT_MM = [600, 450];
function cutmat_(ppm = 1.6) {
  const W = Math.round(MAT_MM[0] * ppm), H = Math.round(MAT_MM[1] * ppm), c = cv(W, H), r = rng(97), mm = (v) => v * ppm;
  const g = field(c, 3, 3, 103, (v) => mix([52, 64, 58], [62, 75, 68], v));
  g.lineWidth = Math.max(0.6, mm(0.25));
  for (let x = 10; x < MAT_MM[0]; x += 10) { g.strokeStyle = x % 50 ? 'rgba(200,214,204,.20)' : 'rgba(214,226,216,.42)'; g.beginPath(); g.moveTo(mm(x), mm(10)); g.lineTo(mm(x), H - mm(10)); g.stroke(); }
  for (let y = 10; y < MAT_MM[1]; y += 10) { g.strokeStyle = y % 50 ? 'rgba(200,214,204,.20)' : 'rgba(214,226,216,.42)'; g.beginPath(); g.moveTo(mm(10), mm(y)); g.lineTo(W - mm(10), mm(y)); g.stroke(); }
  g.strokeStyle = 'rgba(214,226,216,.5)'; g.lineWidth = mm(0.4);
  for (let x = 10; x < MAT_MM[0]; x += 5) { const l = x % 10 ? 2 : 4; g.beginPath(); g.moveTo(mm(x), mm(3)); g.lineTo(mm(x), mm(3 + l)); g.stroke(); }   /* ruler ticks along the top edge */
  for (let i = 0; i < 70; i++) {   /* healed knife scores */
    g.strokeStyle = `rgba(${r() < 0.6 ? '30,38,34' : '150,166,156'},${0.12 + r() * 0.18})`; g.lineWidth = 0.6;
    const x = r() * W, y = r() * H, a = (r() < 0.6 ? 0 : Math.PI / 2) + (r() - 0.5) * 0.25, l = mm(20 + r() * 140);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, W, 1); g.fillRect(0, H - 1, W, 1); g.fillRect(0, 0, 1, H); g.fillRect(W - 1, 0, 1, H);
  return c;
}

/* ---------------- kept surfaces (same scheme as p3-tex.js) ---------------- */
const TEXC = 'p20tex-v2', KEPT = new Map(), TODO = [];
let saveT = 0, wk = null;
const keyOf = (name, a) => new URL('/__p20tex/' + encodeURIComponent(name + JSON.stringify(a)), location.origin).href;
const MOBILE = () => matchMedia('(max-width: 767px)').matches || (matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < 900);
/* the calls p20-parcel.js makes, with their exact arguments (mirror them when they change; an unlisted one is drawn on the main thread) */
export function plan(mobile) {
  const m = mobile ? 0.3 : 1;
  return [['birch', [mobile ? 512 : 1024], 420 * m], ['plyEdge', [512, 64], 10], ['pegboard', [512], 60], ['concrete', [mobile ? 256 : 512], 60 * m], ['cutmat', [mobile ? 1.1 : 1.6], 70 * m]];
}
let primed = null;
export function prime(ms = 4000) {
  if (primed) return primed;
  const P = plan(MOBILE()).map(([n, a, w]) => [n, a, keyOf(n, a), w]);
  const fromCache = (async () => {
    if (!self.caches || !self.createImageBitmap) return;
    const c = await caches.open(TEXC);
    await Promise.all(P.map(async ([, , k]) => { const r = await c.match(k); if (!r) return; KEPT.set(k, await createImageBitmap(await r.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' })); }));
  })().catch(() => {});
  const draw = fromCache.then(() => {
    const todo = P.filter(([, , k]) => !KEPT.has(k));
    if (!todo.length || !self.Worker || !self.OffscreenCanvas) return;
    const n = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 4) - 1, todo.length)), lanes = Array.from({ length: n }, () => []), load = new Array(n).fill(0);
    todo.slice().sort((a, b) => b[3] - a[3]).forEach((j) => { const i = load.indexOf(Math.min(...load)); lanes[i].push(j.slice(0, 3)); load[i] += j[3]; });
    return Promise.all(lanes.map((jobs) => new Promise((res) => {
      let w; try { w = new Worker(import.meta.url, { type: 'module' }); } catch (e) { return res(); }
      let left = jobs.length;
      w.onmessage = (e) => { if (e.data && e.data.b) KEPT.set(e.data.k, e.data.b); if (--left <= 0) res(); };
      w.onerror = () => res();
      w.postMessage({ jobs, n: TEXC });
      setTimeout(res, ms);
    })));
  });
  primed = Promise.race([draw.then(() => KEPT.size), new Promise((r) => setTimeout(() => r(-1), ms))]);
  return primed;
}
function save() {
  saveT = 0;
  if (!self.caches || !self.OffscreenCanvas || !self.Worker) return;
  try {
    if (!wk) {
      const src = 'onmessage=async(e)=>{const d=e.data;try{const o=new OffscreenCanvas(d.b.width,d.b.height);o.getContext("2d").drawImage(d.b,0,0);'
        + 'const bl=await o.convertToBlob({type:"image/png"});const c=await caches.open(d.n);await c.put(d.k,new Response(bl,{headers:{"content-type":"image/png"}}));}catch(x){}};';
      wk = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    }
    TODO.splice(0).forEach(([k, c]) => createImageBitmap(c).then((b) => wk.postMessage({ k, b, n: TEXC }, [b])).catch(() => {}));
  } catch (e) { /* no cache: drawn again next time */ }
}
const kept = (name, fn) => (...a) => {
  const k = keyOf(name, a), b = KEPT.get(k);
  if (b) { const c = cv(b.width, b.height); c.getContext('2d').drawImage(b, 0, 0); return c; }
  const c = fn(...a); TODO.push([k, c]); if (!saveT) saveT = setTimeout(save, 60); return c;
};
if (typeof document === 'undefined' && typeof self !== 'undefined' && typeof self.postMessage === 'function') {
  self.onmessage = async (e) => {
    const { jobs, n } = e.data || {}, cache = self.caches ? await caches.open(n).catch(() => null) : null;
    const GEN = { birch: birch_, plyEdge: plyEdge_, pegboard: pegboard_, concrete: concrete_, cutmat: cutmat_ };
    const saves = [];
    for (const [name, a, k] of jobs || []) {
      try {
        const c = GEN[name](...a), b = await createImageBitmap(c);
        self.postMessage({ k, b }, [b]);
        if (cache) saves.push(c.convertToBlob({ type: 'image/png' }).then((bl) => cache.put(k, new Response(bl, { headers: { 'content-type': 'image/png' } }))).catch(() => {}));
      } catch (x) { self.postMessage({ k }); }
    }
    await Promise.all(saves); self.close();
  };
}
export const birch = kept('birch', birch_);
export const plyEdge = kept('plyEdge', plyEdge_);
export const pegboard = kept('pegboard', pegboard_);
export const concrete = kept('concrete', concrete_);
export const cutmat = kept('cutmat', cutmat_);
