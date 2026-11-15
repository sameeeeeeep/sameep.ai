/* p20-parcel.js: Coco landing v20, the parcel in real-time 3D for two chapters (a fork of parcel3d.js r3: same box, label,
   tape, carton, product, materials and post stack; parcel3d.js itself is untouched).

   Chapter 1, 'open': the parcel on her doorstep (parcel3d's first frame) lifts off the mat and flies back at the lens; its side
   wall fills the frame, and it lands on the packing station's bench (an object wipe, no crossfade). There the shipping label
   peels off, the tape is slit, the flaps open, the carton is lifted out, its tuck end opens and the product comes out to its
   hero pose on paper: 'hero' fires with the product's rect, exactly as parcel3d does, so the match cut to the sketch still works.
   Chapter 5, 'pack': the packing line run forwards on the same bench. Her carton goes into the box, the flaps close, the tape
   gun runs the seam, the thermal printer prints her label, it is carried over and pressed on, and the parcel sits ready for
   the courier: 'label' fires with the label's screen rect (bbox + the four corners) so the page can lift the label out.
   Chapter 6, 'door' (small): the packed parcel set down on her doormat.

   init(cfg, kitSrc, opts) -> { el, size(w,h,cx,cy), play(chapter, t), on(evt, fn), warm(o), heroRect(), labelRect(), still(name),
   stats(), setQuality(q), dispose(), DUR, cues }.  All strings and colours come from the config (cfg.box / cfg.shipping /
   cfg.station); nothing brand-specific lives here. */
import * as THREE from './vendor/three.module.min.js';
import * as TX from './p3-tex.js?v=p3v4';
import * as TS from './p20-tex.js?v=p20v2';
import { boxRing, slab, labelGrid, tapeStrip, crinkle, panelGeo, rectShape, flapShape, roundSlab, fastNormals } from './p3-geo.js?v=p3v2';
import { Post } from './p3-post.js?v=p3v2';

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (u, a, b) => clamp((u - a) / (b - a));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;
const smooth = (t) => t * t * (3 - 2 * t);
const D2R = Math.PI / 180;
/* a hinge that swings open with a little overshoot and settles */
const springOpen = (p) => (p <= 0 ? 0 : p >= 1 ? 1 : 1 - Math.exp(-5.2 * p) * Math.cos(7.6 * p) + Math.exp(-5.2) * Math.cos(7.6) * p);
/* a hinge that drops shut and bounces once off the rim */
const dropShut = (p) => { if (p <= 0) return 1; if (p >= 1) return 0; const q = p / 0.72; if (q < 1) return 1 - q * q; const b = (p - 0.72) / 0.28; return 0.055 * Math.sin(Math.PI * b) * (1 - b); };

/* ---------------- the chapters' timelines (t 0..1 each) and the cues the page can hang sounds on ---------------- */
/* opening: the old parcel3d opening from its peel (u 0.07) runs over t OPEN_U0..1; before it, the doorstep and the flight */
const OPEN_U0 = 0.3;
const uOf = (t) => 0.07 + ((t - OPEN_U0) / (1 - OPEN_U0)) * 0.93;   /* new t -> parcel3d's opening u */
const tOf = (u) => OPEN_U0 + ((u - 0.07) / 0.93) * (1 - OPEN_U0);
const FLY = { lift: 0.04, swap: 0.13, land: 0.2, settle: 0.225 };   /* up off her mat, a hard cut at the top of the arc, down onto the bench */
export const OPEN_CUES = [
  { t: FLY.lift, name: 'lift' }, { t: FLY.swap, name: 'cut-bench' }, { t: FLY.land, name: 'land' },
  ...[
    { t: 0.075, name: 'peel' }, { t: 0.255, name: 'label-off' }, { t: 0.315, name: 'tape-slit' },
    { t: 0.445, name: 'flap', i: 0 }, { t: 0.49, name: 'flap', i: 1 }, { t: 0.535, name: 'flap', i: 2 }, { t: 0.565, name: 'flap', i: 3 },
    { t: 0.605, name: 'carton-rise' }, { t: 0.718, name: 'tuck-open' }, { t: 0.775, name: 'slide-out' }, { t: 0.9, name: 'cut' },
  ].map((c) => Object.assign({}, c, { t: +tOf(c.t).toFixed(4) })),
];
/* the hero pose is settled from here on; 'hero' fires (with the product's screen rect) when the opening crosses it */
export const HERO_T = +tOf(0.97).toFixed(4);
/* packing: carton in, flaps, tape gun, label printed, carried, pressed, ready */
const PK = { cin: [0.02, 0.13], down: [0.12, 0.25], flaps: [[0.27, 0.32], [0.3, 0.35], [0.34, 0.4], [0.37, 0.43]], gunIn: [0.43, 0.475], run: [0.475, 0.585], gunOut: [0.585, 0.625],
  print: [0.635, 0.725], carry: [0.735, 0.815], press: [0.815, 0.87] };
export const LABEL_T = 0.965;
export const PACK_CUES = [
  { t: 0.03, name: 'carton-in' }, { t: 0.245, name: 'carton-down' },
  { t: 0.315, name: 'flap', i: 3 }, { t: 0.345, name: 'flap', i: 2 }, { t: 0.395, name: 'flap', i: 1 }, { t: 0.425, name: 'flap', i: 0 },
  { t: 0.478, name: 'tape-run' }, { t: 0.588, name: 'tape-cut' }, { t: 0.636, name: 'label-print' }, { t: 0.728, name: 'label-tear' },
  { t: 0.825, name: 'label-press' }, { t: 0.9, name: 'ready' },
];
export const DOOR_CUES = [{ t: 0.31, name: 'land' }];
/* recommended real-time lengths (seconds) */
export const DUR = { open: 15, pack: 13, door: 4 };
/* the stills reduced motion shows */
export const STILLS = { open: [0, 0.22, tOf(0.41), tOf(0.6), tOf(0.76), 1], pack: [0, 0.27, 0.45, 0.6, 0.73, 1], door: [1] };

/* doorstep light by time of day (same rule as door3d.js) */
const DOOR_LIGHT = {
  dusk: { sun: 0xffd6b0, si: 3.6, pos: [3.2, 1.8, 2.0], sky: 0xd9e2ee, hi: 0.55, gnd: 0x6a6056, env: 0.34 },
  morning: { sun: 0xfff3e6, si: 3.8, pos: [-1.6, 4.4, 2.4], sky: 0xe6eefb, hi: 0.5, gnd: 0x8b8880, env: 0.36 },
  day: { sun: 0xffffff, si: 3.6, pos: [-0.8, 5, 1.8], sky: 0xfffaf2, hi: 0.55, gnd: 0x8b8174, env: 0.38 },
};

/* the packing station: daylight from a big window on the left, white room */
const STATION_LIGHT = { sun: 0xfff6ec, si: 3.1, pos: [-2.6, 3.4, 1.9], sky: 0xf4f6f9, hi: 0.62, gnd: 0x8e8a83, env: 0.42 };

/* ---------------- config -> what gets printed ---------------- */
function resolve(cfg) {
  const box = cfg.box || (cfg.storyboard && cfg.storyboard.box) || {}, brand = cfg.brand || {};
  const name = box.name || brand.name || 'Brand';
  const accent = (cfg.palette && cfg.palette.accent) || '#c8664a';
  const dark = (h, k) => { const n = parseInt(h.slice(1), 16); const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k)); return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''); };
  const product = box.product || brand.product || '';
  return {
    brandName: name, brandWord: box.word || name, city: brand.city || '',
    productLine: box.line || product, shade: box.shade || '', net: box.size ? 'Net ' + box.size : '',
    board: box.board || dark(accent, 0.48), wave: box.wave || '#e8a9ad', foil: box.foil || '#d2aa63', cream: box.cream || '#f2e7d6',
    fill: box.fill || ['#c9a271', '#b58955', '#dbbd8f'],
    productColor: box.productColor || '#6a2035', metal: box.metal || '#dcae68',
    tapeText: box.tape === false ? '' : (box.tapeText || name), tapeInk: box.tapeInk,
    backCopy: box.back || [[product, box.shade].filter(Boolean).join(' · '), 'Apply to bare lips. Wear alone or over colour.', 'Store below 30°C, away from direct sun.', 'Made in India' + (brand.city ? ' · ' + brand.city : ''), 'Mfd 08/2026 · Batch 0142'],
    ean: box.ean || '8 906147 ' + String(1000 + (name.length * 977) % 9000) + '6',
    shipping: cfg.shipping || {}, plate: (cfg.door && cfg.door.plate) || 'B-14',
    /* the packing station (all optional): the tape gun's plastic, the printer's two plastics, its light */
    gun: (cfg.station && cfg.station.gun) || '#26272a', gunGrip: (cfg.station && cfg.station.grip) || '#151516',
    printer: (cfg.station && cfg.station.printer) || '#e9e8e4', printerBase: (cfg.station && cfg.station.printerBase) || '#3a3b3e',
    wordFont: box.wordFont || '"Fraunces", "Iowan Old Style", Georgia, serif', wordWeight: box.wordWeight || 500,
    sansFont: '"Inter", system-ui, -apple-system, sans-serif', monoFont: '"Spline Sans Mono", ui-monospace, monospace',
  };
}
const FONTS_CSS = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500&family=Inter:wght@400;500;700&family=Spline+Sans+Mono:wght@400;500;600&display=swap';
/* the print's fonts, loaded ahead of init(): true when all of them are in, and then init({ fontsIn: true }) skips the redraw */
export function fonts(cfg) {
  const P = resolve(cfg || {}), FF = [`${P.wordWeight} 40px ${P.wordFont}`, `500 20px ${P.sansFont}`, `700 20px ${P.sansFont}`, `500 20px ${P.monoFont}`];
  if (!document.fonts || !document.fonts.load) return Promise.resolve(false);
  let l = document.querySelector('link[data-p3fonts]');
  if (!l) { l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONTS_CSS; l.dataset.p3fonts = '1'; document.head.appendChild(l); }
  const sheet = l.sheet && l.media !== 'print' ? Promise.resolve() : new Promise((r) => { l.addEventListener('load', () => setTimeout(r), { once: true }); l.addEventListener('error', r, { once: true }); });
  return sheet.then(() => Promise.all(FF.map((f) => document.fonts.load(f).catch(() => [])))).then((r) => r.every((x) => x && x.length > 0)).catch(() => false);
}

/* the surfaces kept in Cache Storage (parcel3d's and the station's), drawn in workers on a first visit: call ahead of init() */
export function prime(ms = 4000) { return Promise.all([TX.prime(ms), TS.prime(ms)]).then((r) => r[0] + r[1]); }

/* ---------------- dimensions (metres) ---------------- */
const BX = { W: 0.26, D: 0.23, H: 0.13, T: 0.004 };      /* the shipping box: 260 x 230 x 130 mm, 4 mm board */
const FLAP_D = BX.D / 2 - 0.0015;
const MAT_H = 0.018;
const PARCEL = { x: 0.02, z: -0.15, yaw: 0.06 };
const TAPE_W = 0.048, TAPE_TAIL = 0.055, TAPE_E = 0.0006;
const LB = { w: TX.LABEL_MM[0] / 1000, h: TX.LABEL_MM[1] / 1000, x: -0.112, z: -0.0028, rot: -1.0 * D2R };
const CT = { W: TX.CARTON.W / 1000, D: TX.CARTON.D / 1000, H: TX.CARTON.H / 1000, tb: 0.00045 };
const RISE_Y = 0.15, UNF_LIFT = 0.09;
const HS = 0.052;                                          /* the product: 52 mm tall (cap top), 24 mm across, a charm on a chain */
const LIFT = { y: 0.1, z: 0.035, tilt: 52 * D2R };         /* the carton held up out of the box, still lying, face tipped to the lens */   /* the carton lifts clear of the box as it unfolds */   /* the carton's centre above the box top at the top of its rise */

export function init(cfg, kitSrc, opts = {}) {
  cfg = cfg || {};
  const P = resolve(cfg);
  const MOBILE = opts.mobile != null ? opts.mobile : (matchMedia('(max-width: 767px)').matches || (matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < 900));
  const REDUCED = opts.reduced != null ? opts.reduced : matchMedia('(prefers-reduced-motion: reduce)').matches;
  const light = (function () {
    const sh = cfg.shipping || {};
    if (sh.light && DOOR_LIGHT[sh.light]) return DOOR_LIGHT[sh.light];
    const m = String(sh.delivered_at || '').match(/(\d{1,2})(?::\d{2})?\s*(am|pm)/i);
    if (!m) return DOOR_LIGHT.dusk;
    const hr = (+m[1] % 12) + (m[2].toLowerCase() === 'pm' ? 12 : 0);
    return hr < 12 ? DOOR_LIGHT.morning : hr < 16 ? DOOR_LIGHT.day : DOOR_LIGHT.dusk;
  })();
  if (!document.querySelector('link[data-p3fonts]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONTS_CSS; l.dataset.p3fonts = '1'; document.head.appendChild(l); }

  /* ---------------- renderer + post (sameep.ai's stack) ---------------- */
  const el = document.createElement('canvas');
  el.className = 'ly ly-3d p3-canvas';
  const renderer = new THREE.WebGLRenderer({ canvas: el, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const post = new Post(renderer, { mobile: MOBILE });
  const PP = post.params;
  PP.uBloom.value = 0; PP.uVignette.value = 0.42; PP.uGrain.value = 0.026; PP.uEdgeBlur.value = 0; PP.uCA.value = 0.35; PP.uExposure.value = 1.0;
  PP.uNear.value = 0.01; PP.uFar.value = 30;
  const BG = new THREE.Color(0xe7e0d4), PAPER = new THREE.Color(opts.paper || '#f4efe6');
  PP.uBg.value.copy(BG);
  const DPR = devicePixelRatio || 1;
  const levels = MOBILE ? [0.8, Math.min(1.25, DPR), Math.min(1.75, DPR)] : [Math.min(0.9, DPR), Math.min(1.15, DPR), Math.min(1.5, DPR)];
  const ADAPT = opts.quality == null;
  let quality = opts.quality != null ? opts.quality : 1;   /* measured: 1 holds 60 fps on an M1 Air at 1440 and on phones; the adaptive rule may step up */

  const scene = new THREE.Scene();
  scene.background = BG.clone();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 30);

  /* environment: a soft room (sky, a bright window toward the sun, a floor) baked into PMREM: one for the doorstep, one for the station */
  function roomEnv(L, wallC) {
    const es = new THREE.Scene();
    const sky = new THREE.Color(L.sky), gnd = new THREE.Color(L.gnd), sun = new THREE.Color(L.sun);
    const sg = new THREE.SphereGeometry(5, 32, 16), col = [];
    for (let i = 0; i < sg.attributes.position.count; i++) { const y = sg.attributes.position.getY(i) / 5; const c = gnd.clone().lerp(sky, smooth(clamp(y * 0.8 + 0.5))); col.push(c.r, c.g, c.b); }
    sg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    es.add(new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), new THREE.MeshBasicMaterial({ color: sun.clone().multiplyScalar(5) }));
    const sp = new THREE.Vector3(...L.pos).normalize().multiplyScalar(4); win.position.copy(sp); win.lookAt(0, 0, 0); es.add(win);
    const soft = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.6), new THREE.MeshBasicMaterial({ color: sky.clone().multiplyScalar(1.6) }));
    soft.position.set(-2.6, 2.4, 2.6); soft.lookAt(0, 0, 0); es.add(soft);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(wallC).multiplyScalar(0.7) })); wall.position.set(0, 1, -3); es.add(wall);
    const pm = new THREE.PMREMGenerator(renderer);
    const t = pm.fromScene(es, 0.03).texture; pm.dispose(); es.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    return t;
  }
  const ENV = { door: roomEnv(light, 0xd9d1c4), station: roomEnv(STATION_LIGHT, 0xf1efea) };
  scene.environment = ENV.door;

  /* lights */
  const hemi = new THREE.HemisphereLight(light.sky, light.gnd, light.hi); scene.add(hemi);
  const sun = new THREE.DirectionalLight(light.sun, light.si);
  sun.position.set(...light.pos).normalize().multiplyScalar(3).add(new THREE.Vector3(PARCEL.x, 0, PARCEL.z));
  sun.target.position.set(PARCEL.x, 0, PARCEL.z);
  sun.castShadow = true;
  const SM = MOBILE ? 1024 : 2048;
  sun.shadow.mapSize.set(SM, SM);
  Object.assign(sun.shadow.camera, { left: -0.95, right: 0.95, top: 0.95, bottom: -0.95, near: 0.5, far: 6 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.0015; sun.shadow.radius = MOBILE ? 2 : 3;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xe4ebf5, 0.25); fill.position.set(-2, 1.5, 3); scene.add(fill);

  /* ---------------- materials ---------------- */
  const T = (canvas, { repeat = 1, wrap = true, srgb = true } = {}) => {
    const t = new THREE.CanvasTexture(canvas);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    if (wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
    return t;
  };
  const KPX = MOBILE ? 512 : 1024;
  const kraftOutT = T(TX.kraft(KPX, { base: '#b58855', seed: 3 }), { repeat: 1 / TX.KRAFT_TILE });
  const kraftInT = T(TX.kraft(KPX / 2, { base: '#caa676', inner: true, seed: 9 }), { repeat: 1 / TX.KRAFT_TILE });
  const kraftBumpT = T(TX.kraftBump(KPX / 2), { repeat: 1 / TX.KRAFT_TILE, srgb: false });
  const waveT = T(TX.fluteWave()), stripeT = T(TX.fluteStripe());
  const kraftOut = new THREE.MeshStandardMaterial({ map: kraftOutT, bumpMap: kraftBumpT, bumpScale: 0.6, roughness: 0.9, envMapIntensity: light.env });
  const kraftIn = new THREE.MeshStandardMaterial({ map: kraftInT, bumpMap: kraftBumpT, bumpScale: 0.35, roughness: 0.95, envMapIntensity: light.env * 0.7 });
  const waveM = new THREE.MeshStandardMaterial({ map: waveT, roughness: 1, envMapIntensity: 0.3 });
  const stripeM = new THREE.MeshStandardMaterial({ map: stripeT, roughness: 1, envMapIntensity: 0.3 });
  const boardMats = [kraftOut, kraftIn, waveM, stripeM];

  /* tape: glossy, a little translucent, the reveal (aS < uLen) and a lifted leading end for the ending's fresh run */
  const tapeT = T(TX.tape(P), { wrap: true }); tapeT.repeat.set(1 / 0.24, 1);
  const tapeU = { uLen: { value: 10 }, uLift: { value: 0 } };
  const mkTape = (reveal) => {
    const m = new THREE.MeshStandardMaterial({ map: tapeT, roughness: 0.3, metalness: 0, transparent: true, opacity: 0.95, envMapIntensity: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    if (reveal) {
      m.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, tapeU);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aS; varying float vS; uniform float uLen; uniform float uLift;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvS = aS; float lead = smoothstep(uLen - 0.03, uLen, aS); transformed += objectNormal * lead * uLift;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vS; uniform float uLen;')
          .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vS > uLen) discard;');
      };
      m.customProgramCacheKey = () => 'p3-tape-reveal';
    }
    return m;
  };
  const tapeM = mkTape(false), tapeRunM = mkTape(true);
  tapeRunM.transparent = false; tapeRunM.opacity = 1; tapeRunM.polygonOffsetFactor = tapeRunM.polygonOffsetUnits = -4;   /* the fresh run hides the old cut tape under it */

  /* the label: print on the front, the adhesive back behind; uPrint reveals the print row by row (the ending's fresh label) */
  const labelT = T(TX.label(P, MOBILE ? 8 : 10), { wrap: false });
  const labelBackT = T(TX.labelBack(), { wrap: false });
  const labelU = { uBack: { value: labelBackT }, uPrint: { value: 1 } };
  const labelM = new THREE.MeshStandardMaterial({ map: labelT, side: THREE.DoubleSide, roughness: 0.62, envMapIntensity: 0.6 });
  labelM.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, labelU);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uBack; uniform float uPrint;')
      .replace('#include <map_fragment>', `
  vec4 lf = texture2D(map, vMapUv);
  float printed = step(vMapUv.y, uPrint);   /* the foot (v 0) comes out of the printer first */
  lf.rgb = mix(vec3(0.93, 0.92, 0.89), lf.rgb, printed);
  vec4 lb = texture2D(uBack, vec2(1.0 - vMapUv.x, vMapUv.y));
  diffuseColor *= gl_FrontFacing ? lf : lb;`);
  };
  labelM.customProgramCacheKey = () => 'p3-label';
  labelM.polygonOffset = true; labelM.polygonOffsetFactor = -8; labelM.polygonOffsetUnits = -8;   /* the label is stuck over the tape: it wins the depth test at any distance */

  /* carton board: one material; the cap facing +z (object space) is the print, -z the unprinted inside, the rest the cut edge.
     Foil (from the mask) goes metallic and smoother; the print is satin; the inside carries the sketch ink (uInk reveals it). */
  const CPPM = MOBILE ? 8 : 12;
  const cp = TX.cartonPrint(P, CPPM);
  const printT = T(cp.print, { wrap: false }), foilT = T(cp.foil, { wrap: false, srgb: false });
  const insideT = T(TX.cartonInside(6), { wrap: false });
  const inkCanvas = TX.sketchInk(null, CPPM), inkT = T(inkCanvas, { wrap: false });
  const cartonU = { uFoil: { value: foilT }, uInside: { value: insideT }, uInk: { value: inkT }, uInkAmt: { value: 0 }, uCore: { value: new THREE.Color(P.board).multiplyScalar(0.85) } };   /* panel edges meet at the folds: board colour, not a pale outline */
  const cartonM = new THREE.MeshStandardMaterial({ map: printT, roughness: 0.46, metalness: 0, envMapIntensity: 1.35 });
  cartonM.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, cartonU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vNz;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvNz = normal.z;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying float vNz; uniform sampler2D uFoil; uniform sampler2D uInside; uniform sampler2D uInk; uniform float uInkAmt; uniform vec3 uCore;
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f); return mix(mix(h21(i), h21(i+vec2(1,0)), u.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), u.x), u.y); }`)
      .replace('#include <map_fragment>', `
  float side = vNz > 0.5 ? 1.0 : (vNz < -0.5 ? -1.0 : 0.0);
  float foil = 0.0;
  if (side > 0.0) { diffuseColor *= texture2D(map, vMapUv); foil = texture2D(uFoil, vMapUv).r; }
  else if (side < 0.0) {
    vec3 bd = texture2D(uInside, vMapUv).rgb;
    vec4 ink = texture2D(uInk, vMapUv);
    float n = vn(vMapUv * vec2(60.0, 80.0)) * 0.35 + vn(vMapUv * 9.0) * 0.65;
    float reveal = smoothstep(uInkAmt * 1.25 - 0.2, uInkAmt * 1.25 - 0.05, (1.0 - vMapUv.y) * 0.55 + n * 0.45);
    diffuseColor.rgb *= mix(bd, ink.rgb, ink.a * (1.0 - reveal) * 0.92);
  } else diffuseColor.rgb *= uCore;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = side > 0.0 ? mix(roughnessFactor, 0.2, foil) : 0.88;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = side > 0.0 ? foil : 0.0;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * foil * 0.28;');
  };
  cartonM.customProgramCacheKey = () => 'p3-carton';

  /* ---------------- the doorstep set ---------------- */
  const set = new THREE.Group(); scene.add(set);
  const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ envMapIntensity: light.env }, o));
  const add = (geo, mat, x, y, z, parent = set, cast = true, recv = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = recv; parent.add(m); return m; };
  const WALL_Z = -0.62;
  /* floor: kota stone, 600 mm tiles */
  const floorT = T(TX.terrazzo(MOBILE ? 512 : 1024), { repeat: 1 / 1.2 });
  const floor = add(new THREE.PlaneGeometry(8, 6), std({ map: floorT, roughness: 0.55 }), 0, 0, 1.5, set, false, true);
  floor.rotation.x = -Math.PI / 2;
  { const uv = floor.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, uv.getY(i) * 6); }
  /* wall with plaster, a skirting */
  const plasterT = T(TX.plaster(512), { repeat: 1 / 0.8 });
  const wall = add(new THREE.PlaneGeometry(8, 3.2), std({ map: plasterT, roughness: 0.95 }), 0, 1.6, WALL_Z, set, false, true);
  { const uv = wall.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, uv.getY(i) * 3.2); }
  add(new THREE.BoxGeometry(8, 0.08, 0.012), std({ color: 0xcfc6b6, roughness: 0.6 }), 0, 0.04, WALL_Z + 0.006);
  /* the door: teak, recessed in a frame, with raised panels, a brass lever, the number plate */
  const woodT = T(TX.wood(512, '#6a4128'), { repeat: 1 });
  const teak = std({ map: woodT, roughness: 0.55 });
  const frameM = std({ map: T(TX.wood(256, '#4e2f1c')), roughness: 0.6 });
  const DX = 0.2, DW = 0.92, DH = 2.08;
  add(new THREE.BoxGeometry(0.07, DH + 0.07, 0.12), frameM, DX - DW / 2 - 0.035, (DH + 0.07) / 2, WALL_Z + 0.02);
  add(new THREE.BoxGeometry(0.07, DH + 0.07, 0.12), frameM, DX + DW / 2 + 0.035, (DH + 0.07) / 2, WALL_Z + 0.02);
  add(new THREE.BoxGeometry(DW + 0.14, 0.07, 0.12), frameM, DX, DH + 0.035, WALL_Z + 0.02);
  const doorG = new THREE.Group(); doorG.position.set(DX, 0.022, WALL_Z - 0.01); set.add(doorG);
  add(new THREE.BoxGeometry(DW, DH, 0.04), teak, 0, DH / 2, 0, doorG);
  [[-0.2, 0.5], [0.2, 0.5], [-0.2, 1.45], [0.2, 1.45]].forEach(([x, y]) => {
    const h = y < 1 ? 0.74 : 0.92;
    add(new THREE.BoxGeometry(0.3, h, 0.012), teak, x, y + (y > 1 ? 0.08 : 0), 0.024, doorG);
    add(new THREE.BoxGeometry(0.26, h - 0.04, 0.008), teak, x, y + (y > 1 ? 0.08 : 0), 0.032, doorG);
  });
  const brass = std({ color: 0xc8a25e, metalness: 1, roughness: 0.32, envMapIntensity: 1.2 });
  add(new THREE.BoxGeometry(0.05, 0.16, 0.012), brass, DW / 2 - 0.09, 1.02, 0.026, doorG);
  const lever = add(new THREE.BoxGeometry(0.13, 0.022, 0.022), brass, DW / 2 - 0.13, 1.06, 0.05, doorG);
  void lever;
  const plateM = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.08), std({ map: T(TX.plate(P.plate, P), { wrap: false }), roughness: 0.4 }));
  plateM.position.set(0, 1.62, 0.04); doorG.add(plateM);
  add(new THREE.CylinderGeometry(0.008, 0.008, 0.01, 16), brass, 0, 1.5, 0.025, doorG).rotation.x = Math.PI / 2;
  /* the doorstep: a marble threshold */
  add(new THREE.BoxGeometry(DW + 0.14, 0.022, 0.13), std({ color: 0xe8e4dc, roughness: 0.35 }), DX, 0.011, WALL_Z + 0.06);
  /* the doormat: coir with a bevelled edge */
  const coirT = T(TX.coir(MOBILE ? 256 : 512), { repeat: 1 / 0.25 }), coirB = T(TX.coirBump(256), { repeat: 1 / 0.12, srgb: false });
  const mat = add(roundSlab(0.66, 0.42, MAT_H, 0.02), std({ map: coirT, bumpMap: coirB, bumpScale: 2.2, roughness: 1 }), PARCEL.x + 0.04, 0, PARCEL.z - 0.03, set, false, true);
  void mat;
  /* a snake plant by the frame */
  {
    const potG = new THREE.Group(); potG.position.set(-0.52, 0, -0.42); set.add(potG);
    const prof = [[0.0, 0], [0.105, 0], [0.12, 0.02], [0.135, 0.2], [0.15, 0.215], [0.15, 0.235], [0.135, 0.235], [0.128, 0.22], [0, 0.22]].map(([x, y]) => new THREE.Vector2(x, y));
    const pot = add(new THREE.LatheGeometry(prof, 36), std({ map: T(TX.terracotta()), roughness: 0.85 }), 0, 0, 0, potG); void pot;
    add(new THREE.CylinderGeometry(0.128, 0.128, 0.006, 32), std({ color: 0x3a2a1e, roughness: 1 }), 0, 0.215, 0, potG, false, true);
    const leafT = T(TX.leaf(), { wrap: false }), leafM = std({ map: leafT, roughness: 0.55, side: THREE.DoubleSide });
    for (let i = 0; i < 9; i++) {
      const hgt = 0.42 + ((i * 37) % 11) / 11 * 0.32, wid = 0.045 + ((i * 13) % 5) * 0.004;
      const g = new THREE.PlaneGeometry(wid, hgt, 2, 10); g.translate(0, hgt / 2, 0);
      const p = g.attributes.position; for (let k = 0; k < p.count; k++) { const y = p.getY(k) / hgt; p.setX(k, p.getX(k) * Math.sin(Math.PI * Math.min(1, y * 1.15 + 0.08)) ); p.setZ(k, Math.pow(y, 2) * 0.05 + Math.abs(p.getX(k)) * 0.6); }
      g.computeVertexNormals();
      const lf = add(g, leafM, Math.cos(i * 2.4) * 0.05, 0.215, Math.sin(i * 2.4) * 0.05, potG);
      lf.rotation.set((Math.sin(i * 1.7)) * 0.2, i * 2.4, Math.cos(i * 1.3) * 0.18);
    }
  }

  const TB0 = BX.T;
  /* ---------------- the packing station ----------------
     It shares the doorstep's world spot: the cutting mat's top is at MAT_H, exactly where the coir mat's top is, so the parcel,
     the carton lift and the hero pose all use the same keys. Only one of the two sets is ever visible (setSet). */
  const station = new THREE.Group(); station.visible = false; scene.add(station);
  const BENCH = { x0: -0.95, x1: 1.05, z0: -0.555, z1: 0.235, t: 0.03, top: MAT_H - 0.003 };
  const BW = BENCH.x1 - BENCH.x0, BD = BENCH.z1 - BENCH.z0, BCX = (BENCH.x0 + BENCH.x1) / 2, BCZ = (BENCH.z0 + BENCH.z1) / 2;
  const sstd = (o) => new THREE.MeshStandardMaterial(Object.assign({ envMapIntensity: STATION_LIGHT.env }, o));
  {
    /* birch-ply top, 30 mm, its cut plies on the edges */
    const birchT = T(TS.birch(MOBILE ? 512 : 1024)); birchT.repeat.set(BW / TS.BIRCH_TILE, BD / TS.BIRCH_TILE);
    const plyT = T(TS.plyEdge(512, 64)); plyT.wrapT = THREE.ClampToEdgeWrapping; plyT.repeat.set(BW / 0.3, 1);
    const plySideT = plyT.clone(); plySideT.repeat.set(BD / 0.3, 1); plySideT.needsUpdate = true;
    const topM = sstd({ map: birchT, roughness: 0.62 }), edgeM = sstd({ map: plyT, roughness: 0.8 }), sideM = sstd({ map: plySideT, roughness: 0.8 });
    add(new THREE.BoxGeometry(BW, BENCH.t, BD), [sideM, sideM, topM, topM, edgeM, edgeM], BCX, BENCH.top - BENCH.t / 2, BCZ, station, false, true);
    /* a powder-coated steel frame under it */
    const steel = sstd({ color: 0x1d1e20, roughness: 0.42, metalness: 0.55 });
    const LEG = 0.88, ly = BENCH.top - BENCH.t - LEG / 2;
    [[BENCH.x0 + 0.06, BENCH.z0 + 0.05], [BENCH.x1 - 0.06, BENCH.z0 + 0.05], [BENCH.x0 + 0.06, BENCH.z1 - 0.06], [BENCH.x1 - 0.06, BENCH.z1 - 0.06]].forEach(([x, z]) => add(new THREE.BoxGeometry(0.04, LEG, 0.04), steel, x, ly, z, station));
    add(new THREE.BoxGeometry(BW - 0.12, 0.05, 0.03), steel, BCX, BENCH.top - BENCH.t - 0.025, BENCH.z1 - 0.06, station);
    add(new THREE.BoxGeometry(BW - 0.12, 0.05, 0.03), steel, BCX, BENCH.top - BENCH.t - 0.025, BENCH.z0 + 0.05, station);
    add(new THREE.BoxGeometry(BW - 0.12, 0.03, 0.03), steel, BCX, ly - LEG / 2 + 0.15, BENCH.z1 - 0.06, station);
    /* floor and the wall behind, pegboard on it */
    const floorY = BENCH.top - BENCH.t - LEG;
    const concT = T(TS.concrete(MOBILE ? 256 : 512)); concT.repeat.set(4, 3);
    const fl = add(new THREE.PlaneGeometry(8, 6), sstd({ map: concT, roughness: 0.5 }), 0, floorY, 1.5, station, false, true); fl.rotation.x = -Math.PI / 2;
    add(new THREE.PlaneGeometry(8, 4), sstd({ color: 0xeeece7, roughness: 0.92 }), 0, floorY + 2, BENCH.z0 - 0.012, station, false, true);
    const pegT = T(TS.pegboard(512)); pegT.repeat.set(2.6 / TS.PEG_TILE, 1.0 / TS.PEG_TILE);
    const pegB = T(TS.pegboard(512), { srgb: false }); pegB.repeat.copy(pegT.repeat);
    add(new THREE.BoxGeometry(2.6, 1.0, 0.006), [sstd({ color: 0xd8d4cc }), sstd({ color: 0xd8d4cc }), sstd({ color: 0xd8d4cc }), sstd({ color: 0xd8d4cc }), sstd({ map: pegT, bumpMap: pegB, bumpScale: 1.2, roughness: 0.85 }), sstd({ color: 0xd8d4cc })], 0.05, BENCH.top + 0.5, BENCH.z0 - 0.004, station, false, true);
  }
  /* the cutting mat the parcel sits on (its top at MAT_H) */
  const cutT = T(TS.cutmat(MOBILE ? 1.1 : 1.6), { wrap: false });
  const cutEdge = sstd({ color: 0x2b332f, roughness: 0.7 });
  const cutMat = add(new THREE.BoxGeometry(TS.MAT_MM[0] / 1000, 0.003, TS.MAT_MM[1] / 1000), [cutEdge, cutEdge, sstd({ map: cutT, roughness: 0.72 }), cutEdge, cutEdge, cutEdge], PARCEL.x + 0.03, MAT_H - 0.0015, PARCEL.z + 0.0, station, false, true);
  cutMat.rotation.y = 0.035;
  /* the thermal label printer: a matte base, a semi-gloss lid, the label comes out of the slot at the seam between them */
  const PRN = { x: -0.39, z: -0.3, yaw: 0.5, w: 0.2, d: 0.25, slotY: 0.071 };
  const printer = new THREE.Group(); printer.position.set(PRN.x, BENCH.top, PRN.z); printer.rotation.y = PRN.yaw; station.add(printer);
  {
    const baseM = sstd({ color: new THREE.Color(P.printerBase), roughness: 0.55 }), lidM = sstd({ color: new THREE.Color(P.printer), roughness: 0.34 });
    add(roundSlab(PRN.w, PRN.d, 0.07, 0.028), baseM, 0, 0, 0, printer);
    const lid = add(roundSlab(PRN.w - 0.002, PRN.d - 0.012, 0.088, 0.034), lidM, 0, 0.0705, -0.006, printer); void lid;
    const dark = sstd({ color: 0x0c0c0d, roughness: 0.6 });
    add(new THREE.BoxGeometry(0.162, 0.005, 0.012), dark, 0, PRN.slotY, PRN.d / 2 - 0.004, printer, false, false);
    add(new THREE.BoxGeometry(0.168, 0.004, 0.004), sstd({ color: 0x8a8c90, roughness: 0.3, metalness: 1 }), 0, PRN.slotY - 0.004, PRN.d / 2 + 0.0015, printer, false, true);   /* tear bar */
    const btn = add(new THREE.CylinderGeometry(0.009, 0.009, 0.004, 24), sstd({ color: new THREE.Color(P.printerBase), roughness: 0.4 }), 0.062, 0.1595, 0.078, printer); void btn;
    add(new THREE.BoxGeometry(0.06, 0.0008, 0.008), dark, -0.04, 0.1585, 0.08, printer, false, false);   /* the lid's release line */
  }
  /* box blanks, flat, stacked at the left end */
  {
    const blank = slab(0.36, TB0, 0.46, { flutesAlongZ: false, nx: 2, nz: 2 });
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(blank, boardMats); m.castShadow = m.receiveShadow = true;
      m.position.set(-0.735 + Math.sin(i * 2.1) * 0.005, BENCH.top + TB0 / 2 + i * (TB0 + 0.0003), 0.13 + Math.cos(i * 1.7) * 0.005);
      m.rotation.y = 0.03 + Math.sin(i * 3.3) * 0.014; station.add(m);
    }
  }

  /* ---------------- the parcel ---------------- */
  const { W, D, H } = BX, TB = BX.T;
  const parcel = new THREE.Group(); parcel.position.set(PARCEL.x, MAT_H, PARCEL.z); parcel.rotation.y = PARCEL.yaw; scene.add(parcel);
  const ringOut = kraftOut.clone(); ringOut.vertexColors = true;
  const ring = new THREE.Mesh(boxRing({ W, D, H, T: TB, nPer: MOBILE ? 12 : 20, nUp: MOBILE ? 8 : 14, dent: { x: 0.075, y: 0.085, rx: 0.032, ry: 0.024, depth: 0.0032, a: 0.7 } }), [ringOut, kraftIn, stripeM]);
  ring.castShadow = ring.receiveShadow = true; parcel.add(ring);
  const bottom = new THREE.Mesh(slab(W - 2 * TB, TB, D - 2 * TB, { nx: 2, nz: 2 }), boardMats); bottom.position.set(0, TB / 2, (D - 2 * TB) / 2); bottom.receiveShadow = true; parcel.add(bottom);
  /* flaps: [front outer, back outer, right inner, left inner] — a yaw group at the crease, a pivot that swings about its local x */
  function hinge(x, y, z, yaw, w, d, bow) {
    const yawG = new THREE.Group(); yawG.position.set(x, y, z); yawG.rotation.y = yaw; parcel.add(yawG);
    const piv = new THREE.Group(); yawG.add(piv);
    const m = new THREE.Mesh(slab(w, TB, d, { flutesAlongZ: true, bow, nx: 10, nz: 6 }), boardMats); m.castShadow = m.receiveShadow = true;
    m.position.z = -TB / 2 * 0; piv.add(m);
    return piv;
  }
  const flaps = [
    hinge(0, H + TB / 2, D / 2 - TB / 2, 0, W, FLAP_D, 0),
    hinge(0, H + TB / 2, -D / 2 + TB / 2, Math.PI, W, FLAP_D, 0),
    hinge(W / 2 - TB / 2, H - TB / 2, 0, Math.PI / 2, D - 2 * TB - 0.002, FLAP_D, 0),
    hinge(-W / 2 + TB / 2, H - TB / 2, 0, -Math.PI / 2, D - 2 * TB - 0.002, FLAP_D, 0),
  ];
  const FLAP_OPEN = [208 * D2R, 196 * D2R, 112 * D2R, 118 * D2R];
  /* contact shadow on the mat */
  const contactM = new THREE.MeshBasicMaterial({ map: T(TX.contact(256, W / D), { wrap: false }), transparent: true, opacity: 0.55, depthWrite: false, color: 0x000000 });
  contactM.blending = THREE.MultiplyBlending; contactM.premultipliedAlpha = true;
  const contactS = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.32, D * 1.32), new THREE.MeshBasicMaterial({ map: contactM.map, transparent: true, opacity: 0.5, depthWrite: false, color: 0x1a120a }));
  contactS.rotation.x = -Math.PI / 2; contactS.position.set(PARCEL.x, MAT_H + 0.0012, PARCEL.z); contactS.rotation.z = PARCEL.yaw; contactS.renderOrder = 1; scene.add(contactS);

  /* tape: the closed run (one piece), and the same run split in two halves on the flaps + two tails on the end walls */
  const TOPY = H + TB + TAPE_E;
  const runPath = [[-W / 2 - TAPE_E, TOPY - TAPE_TAIL], [-W / 2 - TAPE_E, TOPY - 0.0015], [-W / 2 + 0.0015, TOPY], [W / 2 - 0.0015, TOPY], [W / 2 + TAPE_E, TOPY - 0.0015], [W / 2 + TAPE_E, TOPY - TAPE_TAIL]];
  const asTape = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = false; m.receiveShadow = true; return m; };
  /* the strip is built in its (x, y) plane with z across; that is exactly the parcel's x/y with the seam along x */
  const tapeClosed = asTape(tapeStrip(runPath, -TAPE_W / 2, TAPE_W / 2), tapeM); parcel.add(tapeClosed);
  const halfPath = [[-W / 2 + 0.0002, TOPY], [W / 2 - 0.0002, TOPY]];
  const tapeHalfF = asTape(tapeStrip(halfPath, 0.0, TAPE_W / 2, { n: 2, v0: 0.5, v1: 0 }), tapeM), tapeHalfB = asTape(tapeStrip(halfPath, -TAPE_W / 2, 0.0, { n: 2, v0: 1, v1: 0.5 }), tapeM);
  const tailPathL = [[-W / 2 - TAPE_E, TOPY - TAPE_TAIL], [-W / 2 - TAPE_E, TOPY - 0.0015], [-W / 2 + 0.0002, TOPY]];
  const tailPathR = [[W / 2 - 0.0002, TOPY], [W / 2 + TAPE_E, TOPY - 0.0015], [W / 2 + TAPE_E, TOPY - TAPE_TAIL]];
  const tailL = asTape(tapeStrip(tailPathL, -TAPE_W / 2, TAPE_W / 2), tapeM), tailR = asTape(tapeStrip(tailPathR, -TAPE_W / 2, TAPE_W / 2), tapeM);
  parcel.add(tapeHalfF, tapeHalfB, tailL, tailR);
  /* the fresh run for the ending: a touch further out so it lies over the old cut tape */
  const runPath2 = runPath.map(([x, y]) => [x + Math.sign(x) * (Math.abs(x) > W / 2 - 0.001 ? 0.0009 : 0), y + (y >= TOPY - 0.0001 ? 0.0018 : 0)]);   /* clears the old cut edges, which lift ~1.4 mm */
  const tapeRun = asTape(tapeStrip(runPath2, -TAPE_W / 2 - 0.0005, TAPE_W / 2 + 0.0005, { n: 1 }), tapeRunM); parcel.add(tapeRun);
  const RUN_LEN = tapeRun.geometry.userData.length;
  parcel.updateMatrixWorld(true);
  flaps[0].attach(tapeHalfF); flaps[1].attach(tapeHalfB);
  const halfRest = [tapeHalfF, tapeHalfB].map((m) => m.geometry.attributes.position.array.slice());

  /* the label on the front flap */
  const lgeo = labelGrid(LB.w, LB.h, MOBILE ? 30 : 44, MOBILE ? 18 : 28);
  const labelMesh = new THREE.Mesh(lgeo, labelM); labelMesh.renderOrder = 5; labelMesh.castShadow = true; labelMesh.receiveShadow = true;
  const labelG = new THREE.Group(); labelG.position.set(-LB.w / 2, TOPY + 0.0026, LB.h / 2);   /* centred on the top of the box, over the tape seam */ labelG.rotation.y = LB.rot; labelG.add(labelMesh); parcel.add(labelG);
  parcel.updateMatrixWorld(true); flaps[0].attach(labelG);
  const LREST = lgeo.userData.rest, LPOS = lgeo.attributes.position.array;
  /* what the label leaves behind: a faint glue patch with a few torn fibres */
  const residueC = TX.cv(256, 154), rg = residueC.getContext('2d'); rg.fillStyle = 'rgba(255,255,255,0)'; rg.fillRect(0, 0, 256, 154);
  rg.fillStyle = 'rgba(70,45,22,.22)'; rg.fillRect(6, 6, 244, 142);
  for (let i = 0; i < 14; i++) { rg.fillStyle = `rgba(245,240,230,${0.25 + Math.random() * 0.35})`; const x = Math.random() < 0.6 ? 4 + Math.random() * 30 : Math.random() * 250; rg.beginPath(); rg.ellipse(x, 6 + Math.random() * 142, 1 + Math.random() * 5, 0.6 + Math.random() * 2, Math.random() * 3, 0, Math.PI * 2); rg.fill(); }
  const residue = new THREE.Mesh(new THREE.PlaneGeometry(LB.w, LB.h), new THREE.MeshStandardMaterial({ map: T(residueC, { wrap: false }), transparent: true, opacity: 0, roughness: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  residue.rotation.x = -Math.PI / 2; residue.position.set(LB.w / 2, -0.00012, -LB.h / 2); labelG.add(residue);

  /* crinkle fill (instanced) + a bed under it */
  const fillGroup = new THREE.Group(); parcel.add(fillGroup);
  const bed = new THREE.Mesh(new THREE.PlaneGeometry(W - 2 * TB, D - 2 * TB, 18, 16), std({ color: new THREE.Color(P.fill[0]).multiplyScalar(0.62), roughness: 1 }));
  { const p = bed.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, (Math.sin(p.getX(i) * 90) * Math.cos(p.getY(i) * 70) + Math.sin(p.getX(i) * 31 + 2)) * 0.004); bed.geometry.computeVertexNormals(); }
  bed.rotation.x = -Math.PI / 2; bed.position.y = 0.062; bed.receiveShadow = true; fillGroup.add(bed);
  const NC = MOBILE ? 200 : 360;
  const crM = std({ roughness: 0.8, side: THREE.DoubleSide, envMapIntensity: 0.4 });
  const crinkles = new THREE.InstancedMesh(crinkle(), crM, NC); crinkles.castShadow = false; crinkles.receiveShadow = true;
  {
    let s = 17; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), c = new THREE.Color();
    for (let i = 0; i < NC; i++) {
      let x, z; do { x = (r() - 0.5) * (W - 0.03); z = (r() - 0.5) * (D - 0.03); } while (Math.abs(x) < CT.H * 0.56 && Math.abs(z - 0.004) < CT.W * 0.64);
      const near = Math.abs(x) < CT.H / 2 + 0.05 && Math.abs(z - 0.004) < CT.W / 2 + 0.045;   /* strands nestle flat round the carton, below its face */
      const y = near ? 0.064 + r() * 0.007 : 0.066 + Math.pow(r(), 0.45) * 0.04;
      const tilt = near ? 0.1 : 0.6;
      e.set((r() - 0.5) * tilt, r() * Math.PI * 2, (r() - 0.5) * tilt); q.setFromEuler(e); sc.setScalar(0.7 + r() * 0.35);
      /* a strand is ~85 mm long: keep its whole length inside the walls, whatever way it lies (none pokes through the box) */
      { const half = 0.0425 * sc.x + 0.003, hx = Math.abs(Math.cos(e.y)) * half, hz = Math.abs(Math.sin(e.y)) * half, mx = Math.max(0.004, W / 2 - TB - hx - 0.003), mz = Math.max(0.004, D / 2 - TB - hz - 0.003);
        x = Math.max(-mx, Math.min(mx, x)); z = Math.max(-mz, Math.min(mz, z)); }
      m4.compose(v.set(x, y, z), q, sc); crinkles.setMatrixAt(i, m4);
      c.set(P.fill[i % P.fill.length]).offsetHSL(0, 0, (r() - 0.5) * 0.06); crinkles.setColorAt(i, c);
    }
  }
  fillGroup.add(crinkles);

  /* ---------------- the mono carton: a folding chain of real panels (dieline in mm) ---------------- */
  const MM = 0.001, tb = CT.tb, dl = cp.dl, R = dl.r;
  const cartL = new THREE.Group(); scene.add(cartL);        /* the carton's own frame: front +z, top end +y, origin at its centre */
  const cart = new THREE.Group(); cart.rotation.y = Math.PI; cartL.add(cart);   /* the chain prints on -z: turn it to face front */
  const chain = new THREE.Group(); cart.add(chain);          /* the dieline's frame: the back panel's bottom-left at the origin */
  const nodes = {};
  function node(name, parent, px, py, pz, shape, ox, oy, axis, sign) {
    const g = new THREE.Group(); g.position.set(px, py, pz); parent.add(g);
    const m = new THREE.Mesh(panelGeo(shape, dl, tb, MM, ox, oy), cartonM); m.castShadow = true; m.receiveShadow = true; g.add(m);
    nodes[name] = { g, axis, sign }; return g;
  }
  const cw = CT.W, cd = CT.D, ch = CT.H, inset = -tb * 1.25;
  const back = node('back', chain, 0, 0, 0, rectShape(0, 0, cw, ch), R.back[0], 0, null, 0);
  const s1 = node('s1', back, cw, 0, 0, rectShape(0, 0, cd, ch), R.s1[0], 0, 'y', 1);
  const front = node('front', s1, cd, 0, 0, rectShape(0, 0, cw, ch), R.front[0], 0, 'y', 1);
  const s2 = node('s2', front, cw, 0, 0, rectShape(0, 0, cd, ch), R.s2[0], 0, 'y', 1);
  const glueS = new THREE.Shape(); glueS.moveTo(0, 0); glueS.lineTo(R.glue[2] * MM, 0.004); glueS.lineTo(R.glue[2] * MM, ch - 0.004); glueS.lineTo(0, ch); glueS.closePath();
  node('glue', s2, cd, 0, inset, glueS, R.glue[0], 0, 'y', 1);
  const topC = node('topC', back, 0, ch, 0, rectShape(0, 0, cw, cd), R.topClose[0], R.topClose[1], 'x', -1);
  node('topT', topC, 0, cd, inset, flapShape(cw, TX.CARTON.tongue * MM, { up: true }), R.topTongue[0], R.topTongue[1], 'x', -1);
  node('d1T', s1, 0, ch, inset, flapShape(cd, TX.CARTON.dust * MM, { up: true, taper: 0.3 }), R.dust1T[0], R.dust1T[1], 'x', -1);
  node('d2T', s2, 0, ch, inset, flapShape(cd, TX.CARTON.dust * MM, { up: true, taper: 0.3 }), R.dust2T[0], R.dust2T[1], 'x', -1);
  const botC = node('botC', front, 0, 0, 0, rectShape(0, -cd, cw, cd), R.botClose[0], 0, 'x', 1);
  node('botT', botC, 0, -cd, inset, flapShape(cw, TX.CARTON.tongue * MM, { up: false }), R.botTongue[0], -cd / MM, 'x', 1);
  node('d1B', s1, 0, 0, inset, flapShape(cd, TX.CARTON.dust * MM, { up: false, taper: 0.3 }), R.dust1B[0], 0, 'x', 1);
  node('d2B', s2, 0, 0, inset, flapShape(cd, TX.CARTON.dust * MM, { up: false, taper: 0.3 }), R.dust2B[0], 0, 'x', 1);
  void front;
  const setFold = (name, f) => { const n = nodes[name]; if (!n.axis) return; n.g.rotation[n.axis] = n.sign * f * Math.PI / 2; };
  /* assembled: the chain's box centre is (cw/2, ch/2, -cd/2); flat: the dieline's centre (in its own plane) */
  const C_ASM = new THREE.Vector3(cw / 2, ch / 2, -cd / 2);
  const C_FLAT = new THREE.Vector3(((dl.X0 + dl.X1) / 2) * MM, ((dl.Y0 + dl.Y1) / 2) * MM, 0);
  /* fold state from u: 0 flat .. 1 closed (the order a packer folds it); unfold runs it backwards */
  function foldCarton(u) {
    const sides = ease(seg(u, 0.0, 0.42));
    setFold('s1', sides); setFold('front', ease(seg(u, 0.04, 0.42))); setFold('s2', ease(seg(u, 0.08, 0.44))); setFold('glue', ease(seg(u, 0.1, 0.46)));
    const dust = ease(seg(u, 0.46, 0.64)); ['d1T', 'd2T', 'd1B', 'd2B'].forEach((n) => setFold(n, dust));
    setFold('topC', ease(seg(u, 0.62, 0.84))); setFold('botC', ease(seg(u, 0.62, 0.84)));
    setFold('topT', ease(seg(u, 0.78, 1))); setFold('botT', ease(seg(u, 0.78, 1)));
    const flat = 1 - ease(seg(u, 0, 0.46));
    chain.position.copy(C_ASM).lerp(C_FLAT, flat).negate();
  }
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  /* ---------------- the product: the charm lip oil (capsule body, squishy two-lobe cap, gold split ring, chain, lobster clasp) ---------------- */
  const prodCol = new THREE.Color(P.productColor);
  const siliM = new THREE.MeshPhysicalMaterial({ color: prodCol, roughness: 0.66, sheen: 0.35, sheenRoughness: 0.55, sheenColor: prodCol.clone().lerp(new THREE.Color(0xffffff), 0.3), envMapIntensity: 0.7 });
  const goldM = new THREE.MeshStandardMaterial({ color: new THREE.Color(P.metal), metalness: 1, roughness: 0.22, envMapIntensity: 1.6 });
  const prod = new THREE.Group(); scene.add(prod);            /* origin at the base, +y to the cap, the charm on its +x side, front +z */
  const pm = new THREE.Group(); pm.scale.setScalar(HS); prod.add(pm);   /* built in units of the product's height */
  const V2 = (x, y) => new THREE.Vector2(x, y);
  const LSEG = MOBILE ? 40 : 64;
  const pmesh = (geo, mat, parent = pm) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  {
    /* the silhouette is measured off the kit photo (sb/charm.webp), in units of the product's height: body, seam, cap lobes, dome */
    const BODY = [[0.0005, 0], [0.06, 0.002], [0.096, 0.011], [0.122, 0.024], [0.14, 0.037], [0.153, 0.05], [0.163, 0.062], [0.171, 0.075], [0.186, 0.1], [0.197, 0.126], [0.205, 0.151], [0.21, 0.177], [0.213, 0.202], [0.216, 0.253], [0.216, 0.316], [0.214, 0.38], [0.212, 0.45], [0.209, 0.525], [0.205, 0.541]];
    const CAP = [[0.192, 0.55], [0.2, 0.556], [0.209, 0.57], [0.216, 0.583], [0.226, 0.609], [0.231, 0.634], [0.232, 0.659], [0.231, 0.685], [0.222, 0.71], [0.211, 0.735], [0.2, 0.759], [0.201, 0.774], [0.206, 0.786], [0.216, 0.812], [0.227, 0.837], [0.229, 0.863], [0.225, 0.888], [0.217, 0.913], [0.202, 0.939], [0.176, 0.964], [0.156, 0.977], [0.118, 0.99], [0.06, 0.998], [0.0005, 1.0]];
    /* the body mirrors the cap: the same two soft lobes below the seam as above it (the plain capsule read wrong) */
    void BODY;
    const BH = 0.548, bpts = new THREE.SplineCurve(CAP.slice().reverse().map(([x, y]) => V2(x, (1 - y) / 0.45 * BH))).getPoints(MOBILE ? 56 : 84);
    pmesh(new THREE.LatheGeometry([...bpts, V2(0.19, 0.556)], LSEG), siliM);
    /* the brand on the body: the wordmark printed tone on tone around the upper body lobe, facing the front (+z) */
    {
      const wc = document.createElement('canvas'); wc.width = 1024; wc.height = 256;
      const wt = new THREE.CanvasTexture(wc); wt.colorSpace = THREE.SRGBColorSpace; wt.anisotropy = 4;
      const ink = '#' + prodCol.clone().lerp(new THREE.Color(0xffffff), 0.66).getHexString();
      const drawW = () => {
        const g = wc.getContext('2d'); g.clearRect(0, 0, 1024, 256); g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
        let px = 150; g.font = `${P.wordWeight} ${px}px ${P.wordFont}`; const w = g.measureText(P.brandWord).width; if (w > 880) { px *= 880 / w; g.font = `${P.wordWeight} ${px}px ${P.wordFont}`; }
        g.fillText(P.brandWord, 512, 134); wt.needsUpdate = true;
      };
      drawW(); if (document.fonts && document.fonts.load) document.fonts.load(`${P.wordWeight} 40px ${P.wordFont}`).then(drawW, () => {});
      const arc = 1.5, wm = new THREE.Mesh(new THREE.CylinderGeometry(0.2338, 0.2338, 0.088, 48, 1, true, -arc / 2, arc), new THREE.MeshStandardMaterial({ map: wt, transparent: true, roughness: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      wm.position.y = 0.415; wm.renderOrder = 2; pm.add(wm);
    }
    const cpts = new THREE.SplineCurve(CAP.map(([x, y]) => V2(x, y))).getPoints(MOBILE ? 56 : 84);
    pmesh(new THREE.LatheGeometry([V2(0.186, 0.552), ...cpts], LSEG), siliM);
    /* the moulded loop on top (the ring threads it) */
    const loop = pmesh(new THREE.TorusGeometry(0.034, 0.018, 12, 28), siliM); loop.position.set(0, 1.025, 0); loop.scale.set(1, 1.05, 0.8);
  }
  /* the charm hangs from the loop: a pivot there so it can swing and hang true when the product tips. Placed off the photo:
     a large split ring tipped back ~50 deg, a short chain dropping almost straight, a tall lobster clasp beside the cap */
  const charmG = new THREE.Group(); charmG.position.set(0, 1.04, 0); pm.add(charmG);
  const chainG = new THREE.Group(); charmG.add(chainG);
  {
    const rc = V(0.097, 1.05, -0.02).sub(charmG.position);
    const ring = pmesh(new THREE.TorusGeometry(0.137, 0.011, 8, 64), goldM, charmG); ring.position.copy(rc); ring.rotation.set(-0.9, 0.05, 0);
    const ring2 = pmesh(new THREE.TorusGeometry(0.137, 0.011, 8, 64, 1.2), goldM, charmG); ring2.position.copy(rc).add(V(0, 0.008, 0.006)); ring2.rotation.set(-0.9, 0.05, 0.25);   /* the split ring's doubled turn */
    ring.updateMatrix(); const anchor = V(0.137 * Math.cos(-0.42), 0.137 * Math.sin(-0.42), 0).applyMatrix4(ring.matrix);
    chainG.position.copy(anchor);
    const linkG = new THREE.TorusGeometry(0.029, 0.0078, 6, 16);
    const N = 4, dir = V(0.3, -1, 0.02).normalize(), up = V(0, 1, 0);
    let p = V(0, 0, 0);
    for (let i = 0; i < N; i++) {
      const L = pmesh(linkG, goldM, chainG); L.scale.set(1, 1.65, 1);
      L.quaternion.setFromUnitVectors(up, dir); if (i % 2) L.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(up, Math.PI / 2));
      L.position.copy(p).addScaledVector(dir, 0.029); p.addScaledVector(dir, 0.052);
    }
    /* the lobster clasp: jump ring, swivel stem, the teardrop body with its hooked tip, the lever across the gap, the thumb trigger */
    const cl = new THREE.Group(); cl.position.copy(p).add(V(0.022, 0.004, 0)); cl.rotation.z = 0.16; cl.scale.setScalar(1.7); chainG.add(cl);
    const jr = pmesh(new THREE.TorusGeometry(0.018, 0.0055, 6, 16), goldM, cl); jr.position.set(0, -0.01, 0); jr.rotation.y = Math.PI / 2;
    const stem = pmesh(new THREE.CylinderGeometry(0.009, 0.012, 0.03, 10), goldM, cl); stem.position.set(0, -0.04, 0);
    /* the lobster body: a solid teardrop claw with its eye, extruded and bevelled; the spring gate along the inner left; the thumb trigger */
    const tear = (R, cy, k, n = 40) => { const pts = []; for (let i = 0; i <= n; i++) { const t = (i / n) * Math.PI * 2; pts.push(V2(R * 0.78 * Math.sin(t) * Math.pow(Math.abs(Math.sin(t / 2)), 0.85), cy + R * Math.cos(t) * k)); } return pts; };
    const outer = new THREE.Shape(tear(0.074, -0.112, 1, MOBILE ? 32 : 48));
    outer.holes.push(new THREE.Path(tear(0.04, -0.128, 1.05, MOBILE ? 24 : 36).reverse()));
    const bodyGeo = new THREE.ExtrudeGeometry(outer, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.007, bevelSize: 0.006, bevelSegments: 3, curveSegments: 8 }); bodyGeo.translate(0, 0, -0.006);
    const lob = pmesh(bodyGeo, goldM, cl); lob.position.set(0.004, 0, 0);
    const gate = pmesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.06, 8), goldM, cl); gate.position.set(-0.012, -0.112, 0.012); gate.rotation.z = -0.22;
    const beak = pmesh(new THREE.BoxGeometry(0.03, 0.011, 0.016), goldM, cl); beak.position.set(0.04, -0.07, 0); beak.rotation.z = 0.55;   /* the claw's tip */
    const trig = pmesh(new THREE.BoxGeometry(0.02, 0.012, 0.014), goldM, cl); trig.position.set(-0.036, -0.088, 0); trig.rotation.z = 0.6;
  }
  /* the product's own bounds (the rect the page gets), measured once at rest */
  prod.updateMatrixWorld(true);
  const PROD_BOX = new THREE.Box3().setFromObject(prod);

  /* ---------------- the station's props that reuse the parcel's parts ---------------- */
  /* a roll of the brand's tape (axis along z): printed outer turn, amber layered faces, a kraft core */
  const tapeEdgeM = new THREE.MeshStandardMaterial({ color: 0x7c5328, roughness: 0.26, envMapIntensity: 1.0, side: THREE.DoubleSide });
  const coreM = kraftIn.clone(); coreM.side = THREE.DoubleSide;
  function tapeRoll(R = 0.05, r0 = 0.038, w = TAPE_W) {
    const g = new THREE.Group();
    const sideT = tapeT.clone(); sideT.repeat.set((2 * Math.PI * R) / 0.24, 1); sideT.needsUpdate = true;
    const side = new THREE.Mesh(new THREE.CylinderGeometry(R, R, w, 64, 1, true), new THREE.MeshStandardMaterial({ map: sideT, roughness: 0.3, envMapIntensity: 0.9 }));
    side.rotation.x = Math.PI / 2; g.add(side);
    for (const sz of [-1, 1]) { const c = new THREE.Mesh(new THREE.RingGeometry(r0, R, 64, 1), tapeEdgeM); c.position.z = sz * w / 2; g.add(c); }
    const core = new THREE.Mesh(new THREE.CylinderGeometry(r0, r0, w * 1.03, 40, 1, true), coreM); core.rotation.x = Math.PI / 2; g.add(core);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }
  /* a roll of blank thermal labels (white, 100 mm wide) */
  function labelRoll() {
    const g = new THREE.Group(), R = 0.046, r0 = 0.02, w = 0.104;
    const paper = sstd({ color: 0xf3f2ee, roughness: 0.55 }), faces = sstd({ color: 0xe6e3dc, roughness: 0.7, side: THREE.DoubleSide });
    const s = new THREE.Mesh(new THREE.CylinderGeometry(R, R, w, 64, 1, true), paper); s.rotation.x = Math.PI / 2; g.add(s);
    for (const sz of [-1, 1]) { const c = new THREE.Mesh(new THREE.RingGeometry(r0, R, 64, 1), faces); c.position.z = sz * w / 2; g.add(c); }
    const core = new THREE.Mesh(new THREE.CylinderGeometry(r0, r0, w * 1.02, 32, 1, true), coreM); core.rotation.x = Math.PI / 2; g.add(core);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return { g, r0 };
  }
  /* pegs on the board with tape rolls hung on them (landscape only: in portrait they would sit cropped on the top edge) */
  const hung = new THREE.Group(); station.add(hung);
  {
    const pegM = sstd({ color: 0xa9abaf, roughness: 0.28, metalness: 1 }), PY = BENCH.top + 0.8, ZB = BENCH.z0 - 0.001;
    const hang = (x, roll, r0, w) => {
      const peg = add(new THREE.CylinderGeometry(0.0032, 0.0032, w + 0.04, 12), pegM, x, PY, ZB + (w + 0.04) / 2, hung, false, true); peg.rotation.x = Math.PI / 2;
      roll.position.set(x, PY - r0 + 0.0034, ZB + 0.012 + w / 2); roll.rotation.z = Math.sin(x * 40) * 0.6; roll.traverse((o) => { o.castShadow = false; }); hung.add(roll);
    };
    hang(-0.17, tapeRoll(), 0.038, TAPE_W); hang(0.03, tapeRoll(), 0.038, TAPE_W); hang(0.23, tapeRoll(0.044, 0.038, TAPE_W), 0.038, TAPE_W);
    void labelRoll;
  }
  /* the tape gun: nose at its origin, travelling +x, up +y, across z; the roll above and behind the nose, the grip trailing */
  const gun = new THREE.Group(); gun.visible = false; scene.add(gun);
  const GUN_RC = V(-0.088, 0.07, 0);
  {
    const plastic = sstd({ color: new THREE.Color(P.gun), roughness: 0.42 }), grip = sstd({ color: new THREE.Color(P.gunGrip), roughness: 0.82 });
    const metal = sstd({ color: 0xb4b6ba, roughness: 0.25, metalness: 1 });
    const roll = tapeRoll(0.052, 0.038, TAPE_W); roll.position.copy(GUN_RC); gun.add(roll);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 32), plastic); hub.rotation.x = Math.PI / 2; hub.position.set(GUN_RC.x, GUN_RC.y, -0.029); gun.add(hub);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.062, 16), metal); axle.rotation.x = Math.PI / 2; axle.position.copy(GUN_RC); gun.add(axle);
    /* the side frame: one plate from the nose round behind the roll to the grip */
    const fs = new THREE.Shape([V2(0.006, -0.002), V2(0.012, 0.024), V2(-0.045, 0.072), V2(-0.07, 0.11), V2(-0.11, 0.118), V2(-0.155, 0.1), V2(-0.16, 0.078), V2(-0.12, 0.04), V2(-0.03, -0.004)]);
    const plate = new THREE.Mesh(new THREE.ExtrudeGeometry(fs, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0015, bevelSegments: 2, curveSegments: 6 }), plastic);
    plate.position.z = -0.0345; gun.add(plate);
    /* the grip, a cross bar to it, the pressure roller and the serrated blade at the nose */
    const gp = new THREE.Mesh(new THREE.CapsuleGeometry(0.0155, 0.085, 6, 16), grip); gp.position.set(-0.19, 0.085, -0.004); gp.rotation.z = Math.PI / 2 + 0.38; gun.add(gp);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.034, 12), plastic); bar.rotation.x = Math.PI / 2; bar.position.set(-0.148, 0.085, -0.018); gun.add(bar);
    const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.058, 20), grip); roller.rotation.x = Math.PI / 2; roller.position.set(-0.004, 0.0085, 0); gun.add(roller);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.0025, 0.016, 0.056), metal); blade.position.set(0.008, 0.015, 0); blade.rotation.z = -0.5; gun.add(blade);
    /* the tape from the roll, round the roller, down to the box */
    const a0 = -1.05, A = [GUN_RC.x + Math.cos(a0) * 0.052, GUN_RC.y + Math.sin(a0) * 0.052];
    const feed = new THREE.Mesh(tapeStrip([A, [-0.004 + 0.0075 * Math.cos(1.3), 0.0085 + 0.0075 * Math.sin(1.3)], [0.0035, 0.0085], [0.0005, 0.0003]], -TAPE_W / 2, TAPE_W / 2, { seg: 2 }), tapeM);
    gun.add(feed);
    gun.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }
  /* the gun parked on the bench, lying on its frame plate */
  const GUN_PARK = { p: V(0.1, BENCH.top + 0.0365, -0.37), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, -0.35, 'XYZ')).premultiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), 0.12)) };
  /* the brand's cartons waiting by the board: the same carton, folded shut, cloned */
  foldCarton(1);
  const cartonStack = [];
  [[0.335, -0.43, 0.08], [0.375, -0.425, -0.03], [0.415, -0.432, 0.05]].forEach(([x, z, yaw]) => {
    const c = cart.clone(true); c.position.set(x, BENCH.top + CT.H / 2, z); c.rotation.set(0, Math.PI + yaw, 0); station.add(c); cartonStack.push(c);
  });
  /* parcels already packed, waiting for the courier: the parcel's own parts, closed and taped, each with a label */
  const tapeRunPack = asTape(tapeStrip(runPath, -TAPE_W / 2, TAPE_W / 2, { n: 1 }), tapeRunM); tapeRunPack.name = 'tapeRunPack'; parcel.add(tapeRunPack);
  const PACK_LEN = tapeRunPack.geometry.userData.length;
  {
    [tapeHalfF, tapeHalfB, tailL, tailR].forEach((m) => { m.name = 'tapeOld'; });
    tapeRun.name = 'tapeRun'; fillGroup.name = 'fill'; residue.name = 'residue'; labelMesh.name = 'label'; tapeClosed.name = 'tapeClosed';
    const labelStill = new THREE.MeshStandardMaterial({ map: labelT, roughness: 0.62, envMapIntensity: 0.6 });
    const still = labelGrid(LB.w, LB.h, 2, 2);
    [[0.555, BENCH.top, -0.25, -0.22], [0.548, BENCH.top + H + TB + 0.0005, -0.262, -0.1]].forEach(([x, y, z, yaw]) => {
      const c = parcel.clone(true), drop = [];
      c.traverse((o) => { if (['tapeOld', 'tapeRun', 'tapeRunPack', 'fill', 'residue'].includes(o.name)) drop.push(o); if (o.name === 'label') { o.geometry = still; o.material = labelStill; } });
      drop.forEach((o) => o.parent.remove(o));
      c.position.set(x, y, z); c.rotation.set(0, yaw, 0); c.visible = true; station.add(c);
    });
  }

  /* ---------------- state + poses ---------------- */
  const PW = (v) => v.clone().applyAxisAngle(V(0, 1, 0), PARCEL.yaw).add(V(PARCEL.x, MAT_H, PARCEL.z));   /* parcel-local -> world */
  const TOPW = PW(V(0, H + TB, 0)), RISEW = PW(V(0, H + TB + RISE_Y, 0));
  const QE = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'YXZ'));
  /* the carton lying on its back in the fill (top end toward +x), and held up out of the box, face tipped toward the lens */
  const CART_LIE = PW(V(0.004, 0.062 + CT.D / 2 - 0.0025, 0.004));
  const HELD = PW(V(0.006, H + TB + LIFT.y, LIFT.z));
  /* camera keys: [pos, target] */
  const CAM = {
    door: [V(0.78, 1.18, 1.2), V(0.1, 0.24, -0.3)],
    label: [V(TOPW.x + 0.17, TOPW.y + 0.47, TOPW.z + 0.43), V(TOPW.x - 0.02, TOPW.y - 0.01, TOPW.z + 0.035)],
    flaps: [V(TOPW.x + 0.2, TOPW.y + 0.5, TOPW.z + 0.46), V(TOPW.x, TOPW.y - 0.035, TOPW.z)],
    lift: [V(HELD.x + 0.085, HELD.y + 0.07, HELD.z + 0.25), HELD.clone()],
  };
  const LIFT_YAW = Math.atan2(CAM.lift[0].x - HELD.x, CAM.lift[0].z - HELD.z);
  const Q_LIE = QE(-Math.PI / 2, PARCEL.yaw + 0.1, -Math.PI / 2), Q_HELD = QE(-0.16, LIFT_YAW, 0);   /* v20: held upright, face to the lens, tipped back a touch so the open top shows */
  /* the product in the carton: base toward the open (top) end, cap toward the closed end; it slides out base first */
  const P_IN_Y = CT.H / 2 - HS - 0.009, SLIDE = HS + 0.024;   /* the product stands in the carton cap up; it rises out of the open top */
  const Q_PIN = new THREE.Quaternion();
  /* the hero: where the slid-out product stands up (its middle stays put), turned to the lens */
  const HERO_P = (() => {
    const m = new THREE.Matrix4().compose(HELD, Q_HELD, V(1, 1, 1));
    const mid = V(0, P_IN_Y + SLIDE + HS * 0.5, 0).applyMatrix4(m);
    return mid.add(V(-0.004, -HS * 0.5 + 0.012, 0.01));
  })();
  const HERO_YAW = LIFT_YAW, HERO_EL = 0.035;   /* near eye level, like the kit photo */
  const HERO_C = HERO_P.clone().add(V(0.003, HS * 0.6, 0));
  CAM.hero = [HERO_C.clone().add(V(Math.sin(HERO_YAW) * Math.cos(HERO_EL), Math.sin(HERO_EL), Math.cos(HERO_YAW) * Math.cos(HERO_EL)).multiplyScalar(0.3)), HERO_C.clone()];
  let k = 1, vw = 10, vh = 10, OX = 0, OY = 0, offW = 1, phone = false;
  const camPos = V(0, 0, 0), camTgt = V(0, 0, 0);
  /* piecewise blend through a list of [t, key] stops, eased per segment */
  function camTrack(t, stops) {
    let i = 0; while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
    const [t0, a] = stops[i], [t1, b] = stops[i + 1], f = ease(seg(t, t0, t1));
    camPos.copy(CAM[a][0]).lerp(CAM[b][0], f); camTgt.copy(CAM[a][1]).lerp(CAM[b][1], f);
    return f;
  }
  /* the station's keys: the establishing shot (box, printer, cartons, packed parcels), into the open box, the printer's slot, ready */
  scene.updateMatrixWorld(true);
  const SLOT = new THREE.Matrix4().multiplyMatrices(printer.matrixWorld, new THREE.Matrix4().compose(V(0, PRN.slotY + 0.0006, PRN.d / 2 + 0.0025), new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), 0.09), V(1, 1, 1)));
  const SLOT_P = V(0, 0, 0).applyMatrix4(SLOT), PRN_F = V(Math.sin(PRN.yaw), 0, Math.cos(PRN.yaw));
  const PR_T = SLOT_P.clone().addScaledVector(PRN_F, 0.05).add(V(0.0, -0.005, 0));
  Object.assign(CAM, {
    apex: [V(TOPW.x + 0.3, TOPW.y + 0.24 - (H + TB) / 2 + 0.36, TOPW.z + 0.64), V(TOPW.x, TOPW.y + 0.24 - (H + TB) / 2, TOPW.z)],
    benchIn: [V(TOPW.x + 0.44, TOPW.y + 0.56, TOPW.z + 0.92), V(TOPW.x - 0.03, TOPW.y - 0.07, TOPW.z - 0.07)],
    packIn: [V(TOPW.x + 0.3, TOPW.y + 0.42, TOPW.z + 0.56), V(TOPW.x + 0.02, TOPW.y + 0.03, TOPW.z + 0.0)],
    printer: [PR_T.clone().addScaledVector(PRN_F, 0.26).add(V(0.13, 0.2, 0.02)), PR_T.clone()],
    ready: [V(TOPW.x + 0.43, TOPW.y + 0.43, TOPW.z + 0.6), V(TOPW.x + 0.09, TOPW.y - 0.05, TOPW.z - 0.05)],
  });
  /* the opening's track at the bench, in parcel3d's u (from the peel on) */
  const OPEN_TRACK = [[0, 'label'], [0.3, 'label'], [0.42, 'flaps'], [0.6, 'flaps'], [0.7, 'lift'], [0.8, 'lift'], [0.895, 'hero'], [1, 'hero']];
  const PACK_TRACK = [[0, 'packIn'], [0.2, 'packIn'], [0.27, 'flaps'], [0.6, 'flaps'], [0.645, 'printer'], [0.73, 'printer'], [0.8, 'label'], [0.87, 'label'], [0.95, 'ready'], [1, 'ready']];

  /* the label: peel (s 0..1 across), release (0..1 off and away); press is peel backwards */
  const PEEL_N = (() => { const nx = -LB.w, nz = -LB.h * 0.72, l = Math.hypot(nx, nz); return [nx / l, nz / l]; })();
  const QMAX = -(LB.w * PEEL_N[0] + LB.h * PEEL_N[1]) + 0.004;
  const lv = new THREE.Vector3();
  function labelShape(peel, release, wobble) {
    const nx = PEEL_N[0], nz = PEEL_N[1];            /* direction the front travels, in the label's (a, b) plane; b runs along -z */
    const s = peel * QMAX, Rr = 0.0075 + 0.004 * peel, phi = lerp(0.5, 2.25, smooth(clamp(peel * 1.3)));
    const n = LPOS.length / 3, Sx = LB.w, Sz = LB.h;
    /* release: the whole label leaves; a rigid move plus a travelling flutter */
    const rel = easeIn(release), up = 0.32 * rel + 0.09 * smooth(release), out = 0.24 * smooth(release) + 0.1 * rel, side = 0.16 * smooth(release);
    for (let i = 0; i < n; i++) {
      const a = LREST[i * 3], b = -LREST[i * 3 + 2];   /* label coords: a along x, b along -z */
      const q = (a - Sx) * nx + (b - Sz) * nz;          /* distance from the start corner along the peel direction */
      let d = s - q, x = a, y = 0, z = -b;
      if (d > 0) {
        const fx = a + nx * d, fz = b + nz * d;          /* foot on the peel front */
        const th = d / Rr;
        let ox, oy;
        if (th < phi) { ox = -Rr * Math.sin(th); oy = Rr * (1 - Math.cos(th)); }
        else { const ex = -Rr * Math.sin(phi), ey = Rr * (1 - Math.cos(phi)), r2 = d - Rr * phi; ox = ex - Math.cos(phi) * r2; oy = ey + Math.sin(phi) * r2; }
        /* a little life in the lifted part */
        oy += Math.sin(d * 60 + wobble * 3) * 0.0012 * clamp(d / 0.04) * (1 - release);
        x = fx + nx * ox; z = -(fz + nz * ox); y = oy;
      }
      if (release > 0) {
        const ph = a / Sx;
        y += Math.sin(ph * 7 - release * 16) * 0.012 * smooth(release) + up;
        x += side + Math.sin(release * 5 + ph * 2) * 0.01 * release;
        z += out;
      }
      LPOS[i * 3] = x; LPOS[i * 3 + 1] = y; LPOS[i * 3 + 2] = z;
    }
    if (release > 0) {
      labelMesh.rotation.set(-release * 0.8 + Math.sin(release * 9) * 0.25, release * 1.4, release * 0.5);
      labelMesh.position.set(LB.w * 0.5 * release, 0, -LB.h * 0.5 * release);
    } else { labelMesh.rotation.set(0, 0, 0); labelMesh.position.set(0, 0, 0); }
    lgeo.attributes.position.needsUpdate = true; fastNormals(lgeo);
    void lv;
  }
  /* tape halves: the slit runs from left to right; behind it the two halves part and lift a hair */
  function slit(c) {
    [tapeHalfF, tapeHalfB].forEach((m, k2) => {
      const pa = m.geometry.attributes.position.array, rest = halfRest[k2], av = m.geometry.attributes.aV.array, sgn = k2 ? -1 : 1;
      for (let i = 0; i < av.length; i++) {
        const x = rest[i * 3];
        const pass = smooth(clamp((c * (W + 0.04) - 0.02 - (x + W / 2)) / 0.03));
        const edge = k2 ? av[i] : 1 - av[i];     /* 1 at the seam edge */
        pa[i * 3] = rest[i * 3];
        pa[i * 3 + 1] = rest[i * 3 + 1] + pass * edge * edge * 0.0014;
        pa[i * 3 + 2] = rest[i * 3 + 2] + sgn * pass * edge * 0.0034;
      }
      m.geometry.attributes.position.needsUpdate = true;
    });
  }
  function setFlap(i, f) { flaps[i].rotation.x = f * FLAP_OPEN[i]; }

  /* everything in one place: the state record -> the scene */
  const S = { set: 'door', hover: 0, drop: 1, peel: 0, release: 0, slit: 0, split: false, tape: 'closed', flaps: [0, 0, 0, 0], rise: 0, lid: 0, slide: 0, up: 0, cdrop: 0, settle: 1, sway: 0, paper: false, fold: 1, ink: 0, print: 1, run: -1, residue: 0, inBox: true, cin: 1, lab: null, gun: -1 };
  const qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), vA = V(0, 0, 0), vB = V(0, 0, 0), mA = new THREE.Matrix4(), mB = new THREE.Matrix4(), UP = V(0, 1, 0), ONE = V(1, 1, 1);
  const PAPER_IN = (() => {   /* the paper colour that comes out of the post's shoulder as exactly PAPER (the page's own ground) */
    const k = 0.72, f = (y) => (y <= k ? y : k - (1 - k) * Math.log(1 - Math.min(0.999, (y - k) / (1 - k))));
    return new THREE.Color(f(PAPER.r), f(PAPER.g), f(PAPER.b));
  })();
  const BG_ST = new THREE.Color(0xe9e7e2);
  /* the product's soft shadow on the paper */
  const heroShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: T(TX.contact(256, 1), { wrap: false }), color: 0x3b2318, transparent: true, opacity: 0.3, depthWrite: false }));
  heroShadow.rotation.x = -Math.PI / 2; heroShadow.visible = false; scene.add(heroShadow);
  /* which set is on: the doorstep, the station, or the paper of the hero; and the light between door (0) and station (1) */
  let lookKey = '';
  function setLook(paper, which) {
    const key = paper ? 'paper' : which; if (key === lookKey) return; lookKey = key;
    set.visible = !paper && which === 'door'; station.visible = gun.visible = !paper && which === 'station';
    parcel.visible = contactS.visible = !paper; heroShadow.visible = paper;
    scene.environment = which === 'station' ? ENV.station : ENV.door;
    scene.background = paper ? PAPER_IN : which === 'station' ? BG_ST : BG;
    PP.uBg.value.copy(which === 'station' ? BG_ST : BG);
    PP.uVignette.value = paper ? 0 : 0.42; PP.uGrain.value = paper ? 0 : 0.026; PP.uCA.value = paper ? 0 : 0.35; PP.uFade.value = 0;
  }
  const LD = { sky: new THREE.Color(light.sky), gnd: new THREE.Color(light.gnd), sun: new THREE.Color(light.sun), pos: V(...light.pos).normalize() };
  const LS = { sky: new THREE.Color(STATION_LIGHT.sky), gnd: new THREE.Color(STATION_LIGHT.gnd), sun: new THREE.Color(STATION_LIGHT.sun), pos: V(...STATION_LIGHT.pos).normalize() };
  let lightM = -1;
  function setLight(m) {
    if (m === lightM) return; lightM = m;
    hemi.color.copy(LD.sky).lerp(LS.sky, m); hemi.groundColor.copy(LD.gnd).lerp(LS.gnd, m); hemi.intensity = lerp(light.hi, STATION_LIGHT.hi, m);
    sun.color.copy(LD.sun).lerp(LS.sun, m); sun.intensity = lerp(light.si, STATION_LIGHT.si, m);
    sun.position.copy(LD.pos).lerp(LS.pos, m).normalize().multiplyScalar(3).add(V(PARCEL.x, 0, PARCEL.z));
  }

  /* the tape gun along the fresh run: the head at path length s, the gun's x along the run, y out of the box */
  const pathAt = (s, out) => {
    let acc = 0;
    for (let i = 0; i < runPath.length - 1; i++) {
      const a = runPath[i], b = runPath[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (s <= acc + l || i === runPath.length - 2) { const f = clamp((s - acc) / l); out[0] = a[0] + (b[0] - a[0]) * f; out[1] = a[1] + (b[1] - a[1]) * f; return out; }
      acc += l;
    }
    return out;
  };
  const pA = [0, 0], pB = [0, 0], gX = V(0, 0, 0), gY = V(0, 0, 0), gZ = V(0, 0, 1);
  function gunOnPath(s, lift, outP, outQ) {
    pathAt(s, vA.toArray ? pA : pA); pathAt(s - 0.014, pB); const p1 = pathAt(s + 0.014, [0, 0]);
    let tx = p1[0] - pB[0], ty = p1[1] - pB[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    gX.set(tx, ty, 0); gY.set(-ty, tx, 0);
    mB.makeBasis(gX, gY, gZ).setPosition(pA[0] + gY.x * (TAPE_E + 0.0004 + lift), pA[1] + gY.y * (TAPE_E + 0.0004 + lift), 0);
    mA.multiplyMatrices(parcel.matrixWorld, mB).decompose(outP, outQ, vB);
  }
  const gP0 = V(0, 0, 0), gQ0 = new THREE.Quaternion(), gP1 = V(0, 0, 0), gQ1 = new THREE.Quaternion();
  const arcTo = (pa, qa, pb, qb, f, hop) => { gun.position.copy(pa).lerp(pb, f); gun.position.y += Math.sin(Math.PI * f) * hop; gun.quaternion.copy(qa).slerp(qb, f); };
  /* the roll hangs under the gun: keep it clear of the mat while it works low on the side of the box */
  const gFloor = V(0, 0, 0);
  function poseGun(e) { poseGun0(e); if (e >= PK.gunIn[0] && e < PK.gunOut[1]) { const y0 = parcel.getWorldPosition(gFloor).y + 0.128; if (gun.position.y < y0) gun.position.y = y0; } }
  function poseGun0(e) {
    parcel.updateMatrixWorld(true);
    if (e < PK.gunIn[0] || e >= PK.gunOut[1]) { gun.position.copy(GUN_PARK.p); gun.quaternion.copy(GUN_PARK.q); return; }
    if (e < PK.gunIn[1]) {
      const f = seg(e, PK.gunIn[0], PK.gunIn[1]);
      gunOnPath(0, 0.045, gP1, gQ1);
      if (f < 0.72) { arcTo(GUN_PARK.p, GUN_PARK.q, gP1, gQ1, ease(f / 0.72), 0.1); return; }
      gunOnPath(0, 0, gP0, gQ0); arcTo(gP1, gQ1, gP0, gQ0, ease((f - 0.72) / 0.28), 0); return;
    }
    if (e < PK.run[1]) { gunOnPath(ease(seg(e, PK.run[0], PK.run[1])) * PACK_LEN, 0, gP0, gQ0); gun.position.copy(gP0); gun.quaternion.copy(gQ0); return; }
    const f = seg(e, PK.gunOut[0], PK.gunOut[1]);
    gunOnPath(PACK_LEN, 0.05, gP1, gQ1);
    if (f < 0.25) { gunOnPath(PACK_LEN, 0, gP0, gQ0); arcTo(gP0, gQ0, gP1, gQ1, easeOut(f / 0.25), 0); return; }
    arcTo(gP1, gQ1, GUN_PARK.p, GUN_PARK.q, ease((f - 0.25) / 0.75), 0.08);
  }

  /* the opening's flight: a match cut. The parcel lifts off her mat (the courier's drop rewound), turning once, to the top of
     its arc, where the camera has closed in on it; hard cut, same parcel, same pose, same camera, now over the bench; it comes
     down onto the bench and the camera pulls back. The box, its label and its tape are on screen on both sides of the cut. */
  const REST_Q = new THREE.Quaternion().setFromAxisAngle(UP, PARCEL.yaw), REST_P = V(PARCEL.x, MAT_H, PARCEL.z);
  const APEX_Y = 0.24;
  function flyPose(t) {
    if (t <= FLY.lift || t >= FLY.settle) return;
    let y, s;
    if (t < FLY.swap) { const f = seg(t, FLY.lift, FLY.swap); y = APEX_Y * Math.sin(f * Math.PI / 2); s = 0.5 * f; }
    else if (t < FLY.land) { const g = seg(t, FLY.swap, FLY.land); y = APEX_Y * (1 - g * g); s = 0.5 + 0.5 * g; }
    else { const b = seg(t, FLY.land, FLY.settle); y = Math.sin(Math.PI * Math.min(1, b * 1.7)) * 0.01 * (1 - b); s = 1; }
    /* one full turn over the flight (back to its own yaw on landing), the lid tipped toward the lens at the top */
    const turn = Math.PI * 2 * smooth(s), tip = -0.32 * Math.sin(Math.PI * s);
    parcel.position.copy(REST_P); parcel.position.y += y;
    parcel.quaternion.copy(REST_Q).multiply(qB.setFromEuler(new THREE.Euler(tip, turn, 0.06 * Math.sin(Math.PI * 2 * s), 'YXZ')));
    contactS.material.opacity = 0.5 * clamp(1 - y / 0.2);
  }

  function apply(time) {
    setLook(S.paper, S.set);
    /* parcel drop (the courier's, in the door chapter) */
    const dropY = (() => {
      const d = S.drop; if (d >= 1) return 0;
      const fall = clamp(d / 0.62); let y = 0.7 * (1 - fall * fall);
      if (d > 0.62) { const b = (d - 0.62) / 0.38; y = Math.sin(Math.PI * Math.min(1, b * 1.6)) * 0.03 * (1 - b); }
      return y;
    })();
    parcel.position.set(PARCEL.x, MAT_H + dropY, PARCEL.z);
    parcel.rotation.set(0, PARCEL.yaw, S.drop < 1 ? (S.drop > 0.62 ? Math.sin((S.drop - 0.62) * 40) * 0.015 * (1 - (S.drop - 0.62) / 0.38) : (1 - clamp(S.drop / 0.62)) * 0.08) : 0);
    contactS.material.opacity = 0.5 * clamp(1 - dropY / 0.4);
    /* label */
    labelG.visible = (S.peel < 1 || S.release < 1) && S.hover >= 0;
    if (labelG.visible) labelShape(S.peel, S.release, time);
    if (S.hover > 0) { labelMesh.position.set(0, S.hover * 0.07, 0.01 * S.hover); labelMesh.rotation.set(0.4 * Math.min(1, S.hover), 0, 0.04 * Math.sin(time * 0.2) * Math.min(1, S.hover)); }
    labelMesh.castShadow = S.peel > 0.002 || !!S.lab;
    if (S.lab) {
      /* printing: the label comes out of the printer's slot (only what is out is printed); carry: it is torn off and carried to its spot */
      parcel.updateMatrixWorld(true); labelG.updateWorldMatrix(true, false);
      mA.copy(labelG.matrixWorld).invert().multiply(SLOT).multiply(mB.compose(vA.set(-LB.w / 2, 0, S.lab.print * LB.h), qA.identity(), ONE));
      mA.decompose(vA, qA, vB);
      const c = ease(S.lab.carry);
      if (c > 0) { vB.set(0, 0.07, 0.01); qB.setFromEuler(new THREE.Euler(0.4, 0, 0.04 * Math.sin(time * 0.2))); vA.lerp(vB, c); vA.y += Math.sin(Math.PI * c) * 0.1 + Math.sin(Math.PI * clamp(c * 6)) * 0.006; qA.slerp(qB, c); }
      labelMesh.position.copy(vA); labelMesh.quaternion.copy(qA);
    }
    residue.material.opacity = S.residue * 0.4;
    labelU.uPrint.value = S.print;
    /* tape: the old closed run, the slit halves, or the fresh run the gun lays */
    tapeClosed.visible = S.tape === 'closed';
    [tapeHalfF, tapeHalfB, tailL, tailR].forEach((m) => { m.visible = S.tape === 'split'; });
    if (S.tape === 'split') slit(S.slit);
    tapeRun.visible = false;
    tapeRunPack.visible = S.tape === 'pack' && S.run >= 0;
    tapeU.uLen.value = S.run < 0 ? 0 : S.run >= 1 ? PACK_LEN + 0.05 : S.run * PACK_LEN; tapeU.uLift.value = 0;
    /* flaps */
    S.flaps.forEach((f, i) => setFlap(i, f));

    /* the carton: lying face up in the fill, lifted out still lying (the top end leads up, then levels), held face to the lens */
    foldCarton(S.fold);
    const lid = S.lid;   /* the tuck end opens: the closing panel swings out past flat with its tongue, then the dust flaps flare */
    if (lid > 0) {
      setFold('topC', lerp(1, -0.22, springOpen(seg(lid, 0, 0.75))));
      setFold('topT', lerp(1, 0.18, ease(seg(lid, 0.05, 0.6))));
      const dust = ease(seg(lid, 0.35, 1)); setFold('d1T', lerp(1, 0.08, dust)); setFold('d2T', lerp(1, 0.08, dust));
    }
    const r = S.rise;
    vA.copy(CART_LIE).lerp(HELD, ease(r)); vA.y = lerp(CART_LIE.y, HELD.y, 0.55 * easeOut(r) + 0.45 * smooth(r));
    qA.slerpQuaternions(Q_LIE, Q_HELD, smooth(seg(r, 0.08, 1)));
    const lead = 0.22 * Math.sin(Math.PI * clamp(r * 1.12)) * (1 - 0.6 * r);   /* the top end leads up out of the fill */
    vB.set(0, 1, 0).applyQuaternion(qA); const ax = vB.clone().cross(UP); if (ax.lengthSq() > 1e-6) qA.premultiply(qB.setFromAxisAngle(ax.normalize(), lead));
    if (S.cdrop > 0) { const c = easeIn(S.cdrop); vA.y -= 0.32 * c; vA.x -= 0.03 * c; qA.premultiply(qB.setFromAxisAngle(V(0, 0, 1), 0.5 * c)); }
    /* the packing line: her carton comes in from the cartons by the board before it goes down into the fill */
    if (S.cin < 1) { const f = 1 - ease(S.cin); vA.add(V(0.36 * f, 0.07 * Math.sin(Math.PI * f) - 0.02 * f, -0.24 * f)); qA.premultiply(qB.setFromAxisAngle(UP, 0.7 * f)); }
    cartL.position.copy(vA); cartL.quaternion.copy(qA);
    cartonU.uInkAmt.value = 0;
    cartL.visible = !S.paper && S.cdrop < 1 && (S.inBox ? (S.flaps[0] > 0.02 || S.rise > 0) : true);
    fillGroup.visible = S.flaps[0] > 0.02 || S.flaps[2] > 0.02 || S.rise > 0;

    /* the product: in the carton's frame while it slides, then it tips upright into the hero pose */
    prod.visible = S.paper || (cartL.visible && S.lid > 0.05) || S.up > 0;
    if (prod.visible) {
      cartL.updateMatrixWorld(true);
      vA.set(0, P_IN_Y + SLIDE * ease(S.slide), 0).applyMatrix4(cartL.matrixWorld);
      qA.copy(cartL.quaternion).multiply(Q_PIN);
      const u = ease(S.up), hy = HERO_YAW + 0.55 * (1 - smooth(S.settle));
      qB.setFromAxisAngle(UP, hy);
      if (u > 0) {
        const midA = V(0, HS / 2, 0).applyQuaternion(qA).add(vA);
        const midH = V(0, HS / 2, 0).applyQuaternion(qB).add(HERO_P);
        const mid = midA.lerp(midH, u); mid.y += Math.sin(Math.PI * u) * 0.012;
        qA.slerp(qB, u);
        vA.copy(mid).sub(V(0, HS / 2, 0).applyQuaternion(qA));
      }
      if (S.paper) { vA.copy(HERO_P); qA.copy(qB); }
      prod.position.copy(vA); prod.quaternion.copy(qA);
      const out = S.paper ? 1 : smooth(seg(S.slide, 0.85, 1));
      vB.set(0, -1, 0).applyQuaternion(qB.copy(qA).invert());
      const hang = Math.atan2(vB.x, -vB.y);
      charmG.rotation.set(0.25 * S.sway * 0.6, 0, hang * out * 0.92 + S.sway);
      chainG.rotation.z = -S.sway * 0.7;
      heroShadow.position.set(HERO_P.x, HERO_P.y + 0.0003, HERO_P.z); heroShadow.scale.set(HS * 0.95, HS * 0.6, 1);
    }
    if (S.set === 'station' && !S.paper) poseGun(S.gun);
  }

  /* parcel3d's opening at its u (0.07 .. 1): peel, slit, flaps, lift, tuck, slide, cut, settle */
  function oldOpen(t) {
    S.drop = 1;
    S.peel = ease(seg(t, 0.07, 0.24)); S.release = seg(t, 0.235, 0.34); S.residue = smooth(seg(t, 0.1, 0.26));
    S.print = 1; S.run = -1; S.lab = null; S.cin = 1;
    S.split = t > 0.31; S.tape = S.split ? 'split' : 'closed'; S.slit = ease(seg(t, 0.315, 0.41));
    S.flaps = [springOpen(seg(t, 0.415, 0.5)), springOpen(seg(t, 0.455, 0.54)), springOpen(seg(t, 0.505, 0.58)), springOpen(seg(t, 0.53, 0.6))];
    S.rise = seg(t, 0.6, 0.715); S.hover = 0;
    S.lid = seg(t, 0.715, 0.785);
    S.slide = seg(t, 0.77, 0.845);
    S.up = seg(t, 0.835, 0.9); S.cdrop = seg(t, 0.85, 0.9);
    S.paper = t >= 0.9;
    S.settle = seg(t, 0.9, 0.97);
    const sx = seg(t, 0.835, 0.97);
    S.sway = (0.4 * Math.exp(-3.6 * sx) * Math.sin(sx * 15) + 0.05 * Math.sin(seg(t, 0.8, 0.85) * Math.PI)) * (1 - smooth(seg(t, 0.93, 0.97)));
    S.fold = 1; S.ink = 0; S.inBox = true; S.gun = -1;
  }
  /* chapter 1: the doorstep, the flight, the bench, then the opening */
  const DOOR_OUT = [[0, 'door'], [FLY.lift, 'door'], [FLY.swap, 'apex'], [1, 'apex']];
  const STATION_IN = [[0, 'apex'], [FLY.swap, 'apex'], [0.235, 'benchIn'], [0.255, 'benchIn'], [OPEN_U0 + 0.012, 'label'], [1, 'label']];
  function openState(t) {
    S.set = t >= FLY.swap ? 'station' : 'door';
    const u = t < OPEN_U0 ? 0.07 : uOf(t);
    oldOpen(u);
    if (t < FLY.swap) camTrack(t, DOOR_OUT);
    else if (t < OPEN_U0 + 0.012) camTrack(t, STATION_IN);
    else camTrack(u, OPEN_TRACK);
    return u;
  }
  /* chapter 5: the packing line, forwards */
  function packState(e) {
    S.set = 'station'; S.paper = false; S.drop = 1; S.fold = 1; S.ink = 0; S.inBox = true;
    S.lid = 0; S.slide = 0; S.up = 0; S.cdrop = 0; S.sway = 0; S.settle = 1;
    S.cin = ease(seg(e, PK.cin[0], PK.cin[1]));
    S.rise = 1 - ease(seg(e, PK.down[0], PK.down[1]));
    S.flaps = [dropShut(seg(e, ...PK.flaps[3])), dropShut(seg(e, ...PK.flaps[2])), dropShut(seg(e, ...PK.flaps[1])), dropShut(seg(e, ...PK.flaps[0]))];
    S.split = false; S.tape = 'pack'; S.slit = 0;
    S.run = e < PK.run[0] ? -1 : ease(seg(e, PK.run[0], PK.run[1]));
    S.release = 0; S.residue = 0;
    if (e < PK.print[0]) { S.hover = -1; S.lab = null; S.print = 0; S.peel = 0; }
    else if (e < PK.press[0]) { S.hover = 0; S.lab = { print: seg(e, PK.print[0], PK.print[1]), carry: seg(e, PK.carry[0], PK.carry[1]) }; S.print = S.lab.print; S.peel = 0.14 * smooth(S.lab.carry); }
    else { S.lab = null; S.print = 1; S.hover = 1 - ease(seg(e, PK.press[0], PK.press[0] + 0.028)); S.peel = 0.14 * (1 - ease(seg(e, PK.press[0] + 0.012, PK.press[1]))); if (S.hover <= 0) S.hover = 0; }
    S.gun = e;
    camTrack(e, PACK_TRACK);
  }
  /* chapter 6: the packed parcel set down on her mat */
  function doorState(d) {
    S.set = 'door'; S.paper = false; S.fold = 1; S.ink = 0; S.inBox = true; S.lid = 0; S.slide = 0; S.up = 0; S.cdrop = 0; S.sway = 0; S.settle = 1; S.rise = 0; S.cin = 1;
    S.flaps = [0, 0, 0, 0]; S.split = false; S.tape = 'pack'; S.run = 1; S.lab = null; S.print = 1; S.hover = 0; S.peel = 0; S.release = 0; S.residue = 0; S.gun = -1;
    S.drop = seg(d, 0, 0.5);
    camPos.copy(CAM.door[0]); camTgt.copy(CAM.door[1]);
  }

  /* ---------------- render ---------------- */
  const tmpV = V(0, 0, 0);
  /* from the lift on the camera frames what the shot is about: the carton, then carton + product, then the product's hero bounds */
  const FB = new THREE.Box3(), FB2 = new THREE.Box3(), FS = new THREE.Sphere(), FS2 = new THREE.Sphere(), FD = V(0, 0, 0), FC = V(0, 0, 0);
  let fitW = 0, liftK = 1, HERO_S = null;
  function heroSphere() {
    if (HERO_S) return HERO_S;
    const keep = [prod.position.clone(), prod.quaternion.clone(), charmG.rotation.clone(), chainG.rotation.z];
    prod.position.copy(HERO_P); prod.quaternion.setFromAxisAngle(UP, HERO_YAW); charmG.rotation.set(0, 0, 0); chainG.rotation.z = 0;
    prod.updateMatrixWorld(true); HERO_S = new THREE.Box3().setFromObject(prod).getBoundingSphere(new THREE.Sphere());
    prod.position.copy(keep[0]); prod.quaternion.copy(keep[1]); charmG.rotation.copy(keep[2]); chainG.rotation.z = keep[3]; prod.updateMatrixWorld(true);
    return HERO_S;
  }
  function fitCam(w, toProd = 0, toHero = 0, prodOnly = 0) {
    fitW = w; if (w <= 0) return;
    cartL.updateMatrixWorld(true);
    if (toHero < 1) { FB.setFromObject(cart); if (toProd > 0 && prod.visible) { prod.updateMatrixWorld(true); FB.union(FB2.setFromObject(prod)); } FB.getBoundingSphere(FS); }
    else FS.copy(heroSphere());
    if (toProd > 0 && toHero < 1) { FB.setFromObject(cart).getBoundingSphere(FS2); FS2.center.lerp(FS.center, toProd); FS2.radius = lerp(FS2.radius, FS.radius, toProd); FS.copy(FS2); }
    if (prodOnly > 0 && toHero < 1) { prod.updateMatrixWorld(true); FB2.setFromObject(prod).getBoundingSphere(FS2); FS.center.lerp(FS2.center, prodOnly); FS.radius = lerp(FS.radius, FS2.radius * 1.15, prodOnly); }
    if (toHero > 0 && toHero < 1) { const hs = heroSphere(); FS.center.lerp(hs.center, toHero); FS.radius = lerp(FS.radius, hs.radius, toHero); }
    FD.copy(camPos).sub(camTgt).normalize();
    const vf = camera.fov * D2R / 2, hf = Math.atan(Math.tan(vf) * camera.aspect);
    const d = FS.radius * lerp(1.3, camera.aspect < 1 ? 1.12 : 1.62, toHero) / Math.sin(Math.min(vf, hf));   /* portrait is width-bound: less room */
    FC.copy(FS.center).addScaledVector(FD, d);
    camTgt.lerp(FS.center, w); camPos.lerp(FC, w);
  }
  function placeCamera() {
    tmpV.copy(camPos).sub(camTgt).multiplyScalar(lerp(k, 1, fitW)).add(camTgt);
    camera.position.copy(tmpV); camera.lookAt(camTgt);
    /* the stage's offset only holds while the parcel is small in frame; once the camera moves in, centre it */
    const ox = Math.round(OX * offW), oy = Math.round(OY * offW);
    camera.setViewOffset(vw, vh, ox, oy, vw, vh); camera.updateProjectionMatrix();
    /* focus on what the shot is about; the wider the shot, the shallower the blur */
    const dist = camera.position.distanceTo(camTgt);
    PP.uFocus.value = dist; PP.uAperture.value = lerp(1.05, 0.6, clamp((dist - 0.25) / 1.3));
  }
  let frames = 0, lastT = 0, last = { kind: '', v: -1 }, qAcc = 0, qN = 0, qSlow = 0, qFast = 0;
  const qMax = 2;
  const ft = [];
  let held = !!opts.lazy;   /* lazy: nothing draws until warm(), which compiles the programs in parallel first */
  function render() {
    if (held) return;
    const now = performance.now();
    if (lastT) { ft.push(now - lastT); if (ft.length > 240) ft.shift(); }
    /* adaptive resolution (sameep.ai's rule): step down after two slow windows, up after three fast ones */
    if (ADAPT && ft.length && now - lastT < 100) {
      qAcc += now - lastT; qN++;
      if (qN >= 40) { const a = qAcc / qN; qAcc = 0; qN = 0;
        if (a > 19) { qSlow++; qFast = 0; } else if (a < 13.5) { qFast++; qSlow = 0; } else { qSlow = qFast = 0; }
        if (qSlow >= 2 && quality > 0) { qSlow = 0; setQuality(quality - 1); }
        else if (qFast >= 3 && quality < qMax) { qFast = 0; setQuality(quality + 1); }
      }
    }
    lastT = now; frames++;
    post.render(scene, camera);
  }
  function stats() { if (!ft.length) return {}; const s = ft.slice().sort((a, b) => a - b); const avg = s.reduce((a, b) => a + b, 0) / s.length; return { fps: +(1000 / avg).toFixed(1), avg: +avg.toFixed(2), p95: +s[Math.floor(s.length * 0.95)].toFixed(2), worst: +s[s.length - 1].toFixed(2), frames, quality, dpr: levels[quality] }; }

  /* cues: fire every cue crossed since the last pose, in the direction of travel */
  const listeners = {};
  function on(name, fn) { (listeners[name] = listeners[name] || []).push(fn); return () => { listeners[name] = listeners[name].filter((f) => f !== fn); }; }
  let quiet = false;   /* warm() draws every phase without telling the page */
  const emit = (name, data) => { if (quiet) return; (listeners[name] || []).forEach((f) => { try { f(data); } catch (e) { /* a sound failing never stops the scene */ } }); (listeners['*'] || []).forEach((f) => { try { f(name, data); } catch (e) { /* */ } }); };
  function crossed(kind, a, b, cues) {
    if (a < 0 || a === b) return;
    const dir = b > a ? 1 : -1;
    cues.forEach((c) => { if ((dir > 0 && c.t > a && c.t <= b) || (dir < 0 && c.t <= a && c.t > b)) emit(c.name, { kind, i: c.i, dir, t: c.t }); });
  }

  /* ---------------- play(chapter, t) ---------------- */
  const CUES = { open: OPEN_CUES, pack: PACK_CUES, door: DOOR_CUES };
  let lastCh = '', lastPT = -1, time = 0;
  function play(ch, t) {
    if (!CUES[ch]) return;
    t = clamp(t); if (REDUCED) t = snap(t, STILLS[ch]);
    const prev = ch === lastCh ? lastPT : -1;
    crossed(ch, prev, t, CUES[ch]); lastCh = ch; lastPT = t;
    time = t * 40;
    if (ch === 'open') {
      const u = openState(t); apply(time);
      fitCam(smooth(seg(u, 0.62, 0.7)), smooth(seg(u, 0.77, 0.83)), u >= 0.9 ? 1 : smooth(seg(u, 0.855, 0.9)), smooth(seg(u, 0.825, 0.86)));
      offW = t < FLY.swap ? 1 - smooth(seg(t, FLY.lift, FLY.swap)) : 0;
      setLight(t < FLY.swap ? 0 : 1);
      placeCamera(); flyPose(t);
    } else if (ch === 'pack') {
      packState(t); apply(time); fitCam(0); offW = 0; setLight(1); placeCamera();
    } else {
      doorState(t); apply(time); fitCam(0); offW = 1; setLight(0);
      if (S.drop < 1 && S.drop > 0.62 && prev >= 0 && prev < t) { /* the 'land' cue is in DOOR_CUES */ }
      placeCamera();
    }
    render();
    if (ch === 'open' && t >= HERO_T && prev < HERO_T) emit('hero', heroRect());
    if (ch === 'pack' && t >= LABEL_T && prev < LABEL_T) emit('label', labelRect());
  }
  const snap = (t, list) => list.reduce((p, s) => (t >= s - 1e-6 ? s : p), list[0]);
  function pose() { if (lastCh) play(lastCh, lastPT); else play('open', 0); }
  /* named stills (reduced motion, posters, tests) */
  const STILL = {
    door: ['open', 0], flight: ['open', 0.1], bench: ['open', 0.24], peel: ['open', tOf(0.18)], slit: ['open', tOf(0.41)], open: ['open', tOf(0.6)],
    carton: ['open', tOf(0.76)], product: ['open', tOf(0.86)], hero: ['open', 1], sketch: ['open', 1],
    'pack-in': ['pack', 0.1], 'in-box': ['pack', 0.26], shut: ['pack', 0.45], taping: ['pack', 0.53], taped: ['pack', 0.63], printing: ['pack', 0.69],
    carry: ['pack', 0.78], pressed: ['pack', 0.87], ready: ['pack', 1], arrived: ['door', 1],
  };
  function still(name) { const s = STILL[name] || STILL.door; lastPT = -1; play(s[0], s[1]); }

  /* size: the canvas fills the stage; (cx, cy) is where the parcel sits while the shot is wide (door3d's contract) */
  function size(w, h, cx, cy, B) {
    w = Math.round(w); h = Math.round(h); if (!w || !h) return;
    phone = w < 820;
    vw = w; vh = h;
    renderer.setPixelRatio(levels[quality]); renderer.setSize(w, h, false);
    post.setSize(w, h, levels); post.use(quality === 2 ? 2 : quality);
    el.style.width = w + 'px'; el.style.height = h + 'px';
    camera.aspect = w / h;
    OX = cx != null ? Math.round(w / 2 - cx) : 0; OY = cy != null ? Math.round(h / 2 - cy) : 0;
    /* portrait: back the camera off so the box keeps its width */
    const asp = w / h; k = asp < 1.3 ? clamp(1.3 / asp * 0.82, 1, 2.2) : 1; liftK = asp < 1 ? clamp(1 / asp * 1.45, 1.8, 3.4) : 1.8;
    CAM.door[1].x = phone ? PARCEL.x + 0.02 : 0.1; CAM.door[0].x = phone ? 0.5 : 0.78;
    /* portrait: the ready shot centres on the label's side of the parcel so the label stays whole */
    hung.visible = asp >= 1;
    CAM.ready[1].x = TOPW.x + (asp < 1 ? -0.035 : 0.09); CAM.ready[0].x = TOPW.x + (asp < 1 ? 0.3 : 0.43);
    void B;
    pose();
  }
  function setQuality(q) { quality = clamp(q, 0, 2) | 0; renderer.setPixelRatio(levels[quality]); renderer.setSize(vw, vh, false); post.use(quality); }

  /* the carton's rectangle on screen (door3d's lipRect, for a 2D hand-off) */
  function lipRect() {
    const b = new THREE.Box3().setFromObject(cart), c = b.getCenter(V(0, 0, 0)).project(camera), top = V(c.x, b.max.y, 0);
    void top;
    const corners = []; for (let i = 0; i < 8; i++) corners.push(V(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(camera));
    const ys = corners.map((p) => (-p.y * 0.5 + 0.5) * vh), xs = corners.map((p) => (p.x * 0.5 + 0.5) * vw);
    return { x: (c.x * 0.5 + 0.5) * vw, y: (-c.y * 0.5 + 0.5) * vh, h: Math.max(...ys) - Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) };
  }

  /* the product's rectangle on screen in the canvas's CSS pixels: x, y (top left), w, h, and its centre cx, cy.
     It covers the body, cap and the charm on its chain. Valid at any pose; the 'hero' event carries it at the settled hero pose. */
  const hv = V(0, 0, 0);
  function heroRect() {
    prod.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    /* tight: every vertex of the body, cap, ring, chain and clasp, projected */
    prod.traverse((o) => {
      if (!o.isMesh) return; const pa = o.geometry.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        hv.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld).project(camera);
        const x = (hv.x * 0.5 + 0.5) * vw, y = (-hv.y * 0.5 + 0.5) * vh;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    });
    const r = { x: +x0.toFixed(1), y: +y0.toFixed(1), w: +(x1 - x0).toFixed(1), h: +(y1 - y0).toFixed(1), angle: 0 };
    Object.assign(r, { left: r.x, top: r.y, width: r.w, height: r.h, cx: r.x + r.w / 2, cy: r.y + r.h / 2, vw, vh });
    return r;
  }

  /* the shipping label on screen, in the canvas's CSS pixels: its bounding box (x, y, w, h + aliases), and the four corners of the
     printed face (tl = the header's left end, as the label reads), the angle of its top edge in degrees, and whether it is on screen */
  function labelRect() {
    parcel.updateMatrixWorld(true); labelMesh.updateWorldMatrix(true, false); camera.updateMatrixWorld(true);
    const pa = lgeo.attributes.position, { nx, ny } = lgeo.userData, pt = (i) => { hv.fromBufferAttribute(pa, i).applyMatrix4(labelMesh.matrixWorld).project(camera); return { x: +((hv.x * 0.5 + 0.5) * vw).toFixed(1), y: +((-hv.y * 0.5 + 0.5) * vh).toFixed(1) }; };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < pa.count; i++) { const q = pt(i); if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; }
    const tl = pt(ny * (nx + 1)), tr = pt(ny * (nx + 1) + nx), br = pt(nx), bl = pt(0);
    const r = { x: +x0.toFixed(1), y: +y0.toFixed(1), w: +(x1 - x0).toFixed(1), h: +(y1 - y0).toFixed(1) };
    Object.assign(r, { left: r.x, top: r.y, width: r.w, height: r.h, cx: +(r.x + r.w / 2).toFixed(1), cy: +(r.y + r.h / 2).toFixed(1), angle: +(Math.atan2(tr.y - tl.y, tr.x - tl.x) / D2R).toFixed(2), corners: { tl, tr, br, bl }, mm: TX.LABEL_MM.slice(), visible: labelG.visible && station.visible, vw, vh });
    return r;
  }

  /* text redraws once the web fonts land; the sketch ink once its image loads */
  const redrawText = () => {
    const c2 = TX.cartonPrint(P, CPPM); printT.image = c2.print; foilT.image = c2.foil; printT.needsUpdate = foilT.needsUpdate = true;
    labelT.image = TX.label(P, MOBILE ? 8 : 10); labelT.needsUpdate = true;
    tapeT.image = TX.tape(P); tapeT.needsUpdate = true;
    pose();
  };
  const fontsReady = (document.fonts && document.fonts.load) ? Promise.race([Promise.all([`${P.wordWeight} 40px ${P.wordFont}`, `500 20px ${P.sansFont}`, `700 20px ${P.sansFont}`, `500 20px ${P.monoFont}`].map((f) => document.fonts.load(f).catch(() => {}))), new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve();
  if (!opts.fontsIn) fontsReady.then(redrawText);   /* fontsIn: fonts() resolved first, so the first print is already the final one */
  const sketchSrc = (kitSrc && kitSrc('sketch')) || cfg.sketchSrc;
  const sketchReady = new Promise((res) => {
    if (!sketchSrc) return res();
    const im = new Image(); im.decoding = 'async';
    im.onload = () => { inkT.image = TX.sketchInk(im, CPPM); inkT.needsUpdate = true; res(); pose(); };
    im.onerror = () => res(); im.src = sketchSrc;
  });

  /* warm: compile every program (both sets) and upload every texture before the beat, then draw every phase once, quietly.
     Between draws the main thread is handed back (a task, not a frame), so the loader keeps painting.
     warm({ open: true }) is chapter 1 only (before beat 1); warm({ rest: true }) is chapters 5 and 6 (while the canvas is off screen). */
  const turn = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const OPEN_W = [0, 0.1, 0.126, 0.14, 0.2, 0.3, 0.38, 0.45, 0.55, 0.65, 0.75, 0.8, 0.86, 0.92, 1].map((u, i) => (i < 6 ? u : tOf(u)));
  const REST_W = [['pack', 0.1], ['pack', 0.3], ['pack', 0.45], ['pack', 0.53], ['pack', 0.6], ['pack', 0.69], ['pack', 0.78], ['pack', 0.85], ['pack', 1], ['door', 0.2], ['door', 1]];
  let compiled = false;
  async function warm(o = {}) {
    await Promise.all([fontsReady, sketchReady]);
    const keep = [lastCh, lastPT];
    quiet = true;
    try {
      if (!compiled) {
        compiled = true;
        openState(0.5); apply(0); placeCamera();
        const vis = [set, station, gun, parcel, cartL, prod, fillGroup, heroShadow, labelG, tapeRunPack, contactS];
        const was = vis.map((x) => x.visible); vis.forEach((x) => { x.visible = true; });
        if (held && renderer.compileAsync) { try { await renderer.compileAsync(scene, camera); } catch (e) { /* the draws below compile them */ } }
        held = false;
        renderer.compile(scene, camera);
        vis.forEach((x, i) => { x.visible = was[i]; }); lookKey = '';
        scene.traverse((ob) => { const ms = ob.material ? (Array.isArray(ob.material) ? ob.material : [ob.material]) : []; ms.forEach((m) => { for (const kk in m) { const v = m[kk]; if (v && v.isTexture) renderer.initTexture(v); } }); });
        [labelBackT, foilT, insideT, inkT, ENV.door, ENV.station].forEach((t) => renderer.initTexture(t));
      }
      held = false;
      const list = o.rest ? REST_W : OPEN_W.map((t) => ['open', t]).concat(o.open ? [] : REST_W);
      for (const [c, t] of list) { lastCh = ''; play(c, t); await turn(); }
      if (!o.rest) { const q0 = quality; for (let q = 0; q <= 2; q++) { setQuality(q); lastCh = ''; play('open', tOf(0.62)); await turn(); } setQuality(q0); }
    } finally {
      quiet = false;
      ft.length = 0; lastT = 0;
      lastCh = keep[0]; lastPT = keep[1]; if (lastCh) pose(); else { lastCh = ''; play('open', 0); lastPT = 0; }
    }
  }

  function dispose() {
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; ms.forEach((m) => { for (const kk in m) { const v = m[kk]; if (v && v.isTexture) v.dispose(); } m.dispose(); }); });
    ENV.door.dispose(); ENV.station.dispose();
    post.dispose(); renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss();
  }

  /* first frame: the parcel shut on her mat (parcel3d's first frame) */
  size(innerWidth, innerHeight);
  if (/[?&]debug3d\b/.test(location.search)) window.__p20 = { scene, THREE, camera, renderer, S, apply, CAM, nodes, cart, cartL, prod, parcel, post, gun, printer, station, set, heroRect, labelRect };
  return { el, size, play, on, warm, heroRect, labelRect, still, pose, stats, setQuality, dispose, cues: CUES, DUR, chapters: ['open', 'pack', 'door'], ready: Promise.all([fontsReady, sketchReady]), reduced: REDUCED };
}
