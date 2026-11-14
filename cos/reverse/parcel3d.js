/* parcel3d.js: the Coco landing's opening and ending, in real-time 3D (the sameep.ai hero's approach: real geometry, posed by scroll).
   A corrugated shipping box on her doormat. Opening: the label peels off and flutters away, the tape is slit, the flaps open,
   the brand's mono carton rises out of the crinkle fill and turns to show its front, then unfolds into its flat dieline:
   the inside of the board carries the founder's sketch ("3 months earlier"). Ending: the carton goes back in, the flaps close,
   fresh tape runs across, a fresh label prints and presses on, and the parcel sits at the door.

   Drop-in for door3d.js:  init(cfg, kitSrc) -> { el, size(w,h,cx,cy,B), pose(), doorPose({drop,open,rise,cam,unfold,end}), lipRect() }
   plus  scrub(t) (the opening, 0..1), ending(t) (0..1), on(name, fn) (sound cues), warm() (compile + upload ahead of the beat),
   still(name), stats(), dispose().  All strings come from the config; nothing brand-specific lives here. */
import * as THREE from './vendor/three.module.min.js';
import * as TX from './p3-tex.js';
import { boxRing, slab, labelGrid, tapeStrip, crinkle, panelGeo, rectShape, flapShape, roundSlab, fastNormals } from './p3-geo.js';
import { Post } from './p3-post.js';

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

/* ---------------- the cues the page can hang sounds on ---------------- */
export const OPEN_CUES = [
  { t: 0.075, name: 'peel' }, { t: 0.255, name: 'label-off' }, { t: 0.315, name: 'tape-slit' },
  { t: 0.445, name: 'flap', i: 0 }, { t: 0.49, name: 'flap', i: 1 }, { t: 0.535, name: 'flap', i: 2 }, { t: 0.565, name: 'flap', i: 3 },
  { t: 0.615, name: 'carton-rise' }, { t: 0.815, name: 'unfold' }, { t: 0.9, name: 'sketch' },
];
export const END_CUES = [
  { t: 0.02, name: 'carton-in' }, { t: 0.165, name: 'carton-down' },
  { t: 0.255, name: 'flap', i: 3 }, { t: 0.295, name: 'flap', i: 2 }, { t: 0.345, name: 'flap', i: 1 }, { t: 0.39, name: 'flap', i: 0 },
  { t: 0.42, name: 'tape-run' }, { t: 0.56, name: 'label-print' }, { t: 0.7, name: 'label-press' }, { t: 0.84, name: 'settle' },
];
/* the stills reduced motion shows (opening t / ending t) */
export const STILLS = { open: [0, 0.41, 0.6, 0.78, 1], end: [0, 0.42, 1] };

/* doorstep light by time of day (same rule as door3d.js) */
const DOOR_LIGHT = {
  dusk: { sun: 0xffd6b0, si: 3.6, pos: [3.2, 1.8, 2.0], sky: 0xd9e2ee, hi: 0.55, gnd: 0x6a6056, env: 0.34 },
  morning: { sun: 0xfff3e6, si: 3.8, pos: [-1.6, 4.4, 2.4], sky: 0xe6eefb, hi: 0.5, gnd: 0x8b8880, env: 0.36 },
  day: { sun: 0xffffff, si: 3.6, pos: [-0.8, 5, 1.8], sky: 0xfffaf2, hi: 0.55, gnd: 0x8b8174, env: 0.38 },
};

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
    tapeText: box.tape === false ? '' : (box.tapeText || name), tapeInk: box.tapeInk,
    backCopy: box.back || [[product, box.shade].filter(Boolean).join(' · '), 'Apply to bare lips. Wear alone or over colour.', 'Store below 30°C, away from direct sun.', 'Made in India' + (brand.city ? ' · ' + brand.city : ''), 'Mfd 08/2026 · Batch 0142'],
    ean: box.ean || '8 906147 ' + String(1000 + (name.length * 977) % 9000) + '6',
    shipping: cfg.shipping || {}, plate: (cfg.door && cfg.door.plate) || 'B-14',
    wordFont: box.wordFont || '"Fraunces", "Iowan Old Style", Georgia, serif', wordWeight: box.wordWeight || 500,
    sansFont: '"Inter", system-ui, -apple-system, sans-serif', monoFont: '"Spline Sans Mono", ui-monospace, monospace',
  };
}
const FONTS_CSS = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500&family=Inter:wght@400;500;700&family=Spline+Sans+Mono:wght@400;500;600&display=swap';

/* ---------------- dimensions (metres) ---------------- */
const BX = { W: 0.26, D: 0.23, H: 0.13, T: 0.004 };      /* the shipping box: 260 x 230 x 130 mm, 4 mm board */
const FLAP_D = BX.D / 2 - 0.0015;
const MAT_H = 0.018;
const PARCEL = { x: 0.02, z: -0.15, yaw: 0.06 };
const TAPE_W = 0.048, TAPE_TAIL = 0.055, TAPE_E = 0.0006;
const LB = { w: TX.LABEL_MM[0] / 1000, h: TX.LABEL_MM[1] / 1000, x: -0.112, z: -0.0028, rot: -1.0 * D2R };
const CT = { W: TX.CARTON.W / 1000, D: TX.CARTON.D / 1000, H: TX.CARTON.H / 1000, tb: 0.00045 };
const RISE_Y = 0.15, UNF_LIFT = 0.09;   /* the carton lifts clear of the box as it unfolds */   /* the carton's centre above the box top at the top of its rise */

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

  /* environment: a soft doorstep room (sky, a bright window toward the sun, warm floor) baked into PMREM */
  {
    const es = new THREE.Scene();
    const sky = new THREE.Color(light.sky), gnd = new THREE.Color(light.gnd), sun = new THREE.Color(light.sun);
    const sg = new THREE.SphereGeometry(5, 32, 16), col = [];
    for (let i = 0; i < sg.attributes.position.count; i++) { const y = sg.attributes.position.getY(i) / 5; const c = gnd.clone().lerp(sky, smooth(clamp(y * 0.8 + 0.5))); col.push(c.r, c.g, c.b); }
    sg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    es.add(new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), new THREE.MeshBasicMaterial({ color: sun.clone().multiplyScalar(5) }));
    const sp = new THREE.Vector3(...light.pos).normalize().multiplyScalar(4); win.position.copy(sp); win.lookAt(0, 0, 0); es.add(win);
    const soft = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.6), new THREE.MeshBasicMaterial({ color: sky.clone().multiplyScalar(1.6) }));
    soft.position.set(-2.6, 2.4, 2.6); soft.lookAt(0, 0, 0); es.add(soft);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xd9d1c4).multiplyScalar(0.7) })); wall.position.set(0, 1, -3); es.add(wall);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(es, 0.03).texture; pm.dispose();
  }

  /* lights */
  const hemi = new THREE.HemisphereLight(light.sky, light.gnd, light.hi); scene.add(hemi);
  const sun = new THREE.DirectionalLight(light.sun, light.si);
  sun.position.set(...light.pos).normalize().multiplyScalar(3).add(new THREE.Vector3(PARCEL.x, 0, PARCEL.z));
  sun.target.position.set(PARCEL.x, 0, PARCEL.z);
  sun.castShadow = true;
  const SM = MOBILE ? 1024 : 2048;
  sun.shadow.mapSize.set(SM, SM);
  Object.assign(sun.shadow.camera, { left: -0.85, right: 0.85, top: 0.85, bottom: -0.85, near: 0.5, far: 6 });
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
  float printed = step(1.0 - uPrint, vMapUv.y);
  lf.rgb = mix(vec3(0.93, 0.92, 0.89), lf.rgb, printed);
  lf.rgb *= 1.0 - 0.6 * smoothstep(0.012, 0.0, abs(vMapUv.y - (1.0 - uPrint))) * step(0.001, uPrint) * step(uPrint, 0.999);
  vec4 lb = texture2D(uBack, vec2(1.0 - vMapUv.x, vMapUv.y));
  diffuseColor *= gl_FrontFacing ? lf : lb;`);
  };
  labelM.customProgramCacheKey = () => 'p3-label';

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
  const labelMesh = new THREE.Mesh(lgeo, labelM); labelMesh.castShadow = true; labelMesh.receiveShadow = true;
  const labelG = new THREE.Group(); labelG.position.set(LB.x, TOPY + 0.0002, D / 2 - TB / 2 + LB.z); labelG.rotation.y = LB.rot; labelG.add(labelMesh); parcel.add(labelG);
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
      let x, z; do { x = (r() - 0.5) * (W - 0.125); z = (r() - 0.5) * (D - 0.115); } while (Math.abs(x) < CT.W * 0.7 && Math.abs(z) < CT.D * 0.7);
      const y = 0.066 + Math.pow(r(), 0.45) * 0.04;
      e.set((r() - 0.5) * 0.6, r() * Math.PI * 2, (r() - 0.5) * 0.6); q.setFromEuler(e); sc.setScalar(0.7 + r() * 0.35);
      m4.compose(v.set(x, y, z), q, sc); crinkles.setMatrixAt(i, m4);
      c.set(P.fill[i % P.fill.length]).offsetHSL(0, 0, (r() - 0.5) * 0.06); crinkles.setColorAt(i, c);
    }
  }
  fillGroup.add(crinkles);

  /* ---------------- the mono carton: a folding chain of real panels (dieline in mm) ---------------- */
  const MM = 0.001, tb = CT.tb, dl = cp.dl, R = dl.r;
  const cart = new THREE.Group(); scene.add(cart);          /* the carton, front facing +z, origin at its centre */
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
  cart.rotation.order = 'YXZ';
  /* the inside of the carton, in the box: standing on the fill */
  const CART_IN = new THREE.Vector3(0.004, 0.012 + ch / 2, 0.002);

  /* ---------------- state + poses ---------------- */
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const PW = (v) => v.clone().applyAxisAngle(V(0, 1, 0), PARCEL.yaw).add(V(PARCEL.x, MAT_H, PARCEL.z));   /* parcel-local -> world */
  const TOPW = PW(V(0, H + TB, 0)), RISEW = PW(V(0, H + TB + RISE_Y, 0));
  /* camera keys: [pos, target] */
  const CAM = {
    door: [V(0.78, 1.18, 1.2), V(0.1, 0.24, -0.3)],
    label: [V(TOPW.x + 0.17, TOPW.y + 0.47, TOPW.z + 0.43), V(TOPW.x - 0.02, TOPW.y - 0.01, TOPW.z + 0.035)],
    flaps: [V(TOPW.x + 0.2, TOPW.y + 0.5, TOPW.z + 0.46), V(TOPW.x, TOPW.y - 0.035, TOPW.z)],
    rise: [V(RISEW.x + 0.12, RISEW.y + 0.07, RISEW.z + 0.27), V(RISEW.x, RISEW.y - 0.065, RISEW.z)],
    carton: [V(RISEW.x + 0.08, RISEW.y + 0.035, RISEW.z + 0.255), V(RISEW.x, RISEW.y + 0.004, RISEW.z)],
    flat: [V(RISEW.x, RISEW.y + 0.004, RISEW.z + 0.315), V(RISEW.x, RISEW.y, RISEW.z)],
  };
  let k = 1, vw = 10, vh = 10, OX = 0, OY = 0, offW = 1, phone = false;
  const camPos = V(0, 0, 0), camTgt = V(0, 0, 0);
  /* piecewise blend through a list of [t, key] stops, eased per segment */
  function camTrack(t, stops) {
    let i = 0; while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
    const [t0, a] = stops[i], [t1, b] = stops[i + 1], f = ease(seg(t, t0, t1));
    camPos.copy(CAM[a][0]).lerp(CAM[b][0], f); camTgt.copy(CAM[a][1]).lerp(CAM[b][1], f);
    return f;
  }
  const OPEN_TRACK = [[0, 'door'], [0.08, 'label'], [0.3, 'label'], [0.42, 'flaps'], [0.6, 'flaps'], [0.7, 'rise'], [0.78, 'carton'], [0.815, 'carton'], [0.95, 'flat'], [1, 'flat']];
  const END_TRACK = [[0, 'rise'], [0.18, 'flaps'], [0.4, 'flaps'], [0.5, 'label'], [0.78, 'label'], [1, 'door']];

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
  const S = { hold: 0, hover: 0, drop: 1, peel: 0, release: 0, slit: 0, split: false, flaps: [0, 0, 0, 0], rise: 0, turn: 0, fold: 1, ink: 0, print: 1, run: -1, residue: 0, fade: 0, cam: null, inBox: true };
  function apply(time) {
    /* parcel drop (the opening's landing) */
    const dropY = (() => {
      const d = S.drop; if (d >= 1) return 0;
      const fall = clamp(d / 0.62); let y = 0.7 * (1 - fall * fall);
      if (d > 0.62) { const b = (d - 0.62) / 0.38; y = Math.sin(Math.PI * Math.min(1, b * 1.6)) * 0.03 * (1 - b); }
      return y;
    })();
    parcel.position.y = MAT_H + dropY;
    parcel.rotation.z = S.drop < 1 ? (S.drop > 0.62 ? Math.sin((S.drop - 0.62) * 40) * 0.015 * (1 - (S.drop - 0.62) / 0.38) : (1 - clamp(S.drop / 0.62)) * 0.08) : 0;
    contactS.material.opacity = 0.5 * clamp(1 - dropY / 0.4);
    /* label */
    labelG.visible = (S.peel < 1 || S.release < 1) && S.hover >= 0;
    if (labelG.visible) labelShape(S.peel, S.release, time);
    if (S.hover > 0) { labelMesh.position.set(0, S.hover * 0.07, 0.01 * S.hover); labelMesh.rotation.set(0.55 * Math.min(1, S.hover), 0, 0.04 * Math.sin(time * 0.2) * Math.min(1, S.hover)); }
    labelMesh.castShadow = S.peel > 0.002;
    residue.material.opacity = S.residue * 0.4;
    labelU.uPrint.value = S.print;
    /* tape */
    tapeClosed.visible = !S.split && S.run < 0;
    [tapeHalfF, tapeHalfB, tailL, tailR].forEach((m) => { m.visible = S.split; });
    if (S.split) slit(S.slit);
    tapeRun.visible = S.run >= 0;
    tapeU.uLen.value = S.run * (RUN_LEN + 0.03); tapeU.uLift.value = S.run > 0 && S.run < 1 ? 0.004 : 0;
    /* flaps */
    S.flaps.forEach((f, i) => setFlap(i, f));
    /* the carton: in the box, rising, turning to the lens, unfolding */
    foldCarton(S.fold);
    const r = S.rise;
    const inW = PW(CART_IN);
    const peak = RISEW.clone();
    cart.position.copy(inW).lerp(peak, ease(r));
    cart.position.y += Math.sin(Math.PI * clamp(r)) * 0.015 + UNF_LIFT * liftK * ease(1 - S.fold);
    /* facing: the box's own yaw in the box, then square to the camera's side as it comes up */
    const faceYaw = Math.atan2(CAM.flat[0].x - peak.x, CAM.flat[0].z - peak.z);
    const threeQ = faceYaw - 0.62 + 0.24 * S.hold;
    cart.rotation.y = lerp(PARCEL.yaw + 0.35, lerp(threeQ, faceYaw, 1 - S.fold), smooth(S.turn)) + Math.sin(r * Math.PI) * 0.12 * (1 - S.turn);
    cart.rotation.x = -0.1 * Math.sin(Math.PI * clamp(r)) * (1 - S.turn * 0.7) + lerp(0, -0.04, S.turn) * (1 - (1 - S.fold));
    cart.rotation.z = 0.05 * Math.sin(Math.PI * r) * (1 - S.turn);
    /* the chain hangs with the back panel toward the lens when flat: turn it so the inside (the sketch) faces the camera */
    cart.rotation.y += Math.PI;   /* the chain's print side faces -z when folded round; the carton's front is the chain's front panel */
    cartonU.uInkAmt.value = S.ink;
    cart.visible = S.inBox ? (S.flaps[0] > 0.02 || S.rise > 0) : true;
    fillGroup.visible = S.flaps[0] > 0.02 || S.flaps[2] > 0.02 || S.rise > 0;
    PP.uFade.value = S.fade; PP.uBg.value.copy(BG).lerp(PAPER, S.fade > 0 ? 1 : 0);
  }

  /* the opening: t 0..1 */
  function openState(t) {
    S.drop = 1;
    S.peel = ease(seg(t, 0.07, 0.24)); S.release = seg(t, 0.235, 0.34); S.residue = smooth(seg(t, 0.1, 0.26));
    S.print = 1; S.run = -1;
    S.split = t > 0.31; S.slit = ease(seg(t, 0.315, 0.41));
    S.flaps = [springOpen(seg(t, 0.415, 0.5)), springOpen(seg(t, 0.455, 0.54)), springOpen(seg(t, 0.505, 0.58)), springOpen(seg(t, 0.53, 0.6))];
    S.rise = seg(t, 0.6, 0.77); S.turn = smooth(seg(t, 0.66, 0.8)); S.hold = smooth(seg(t, 0.74, 0.86)); S.hover = 0;
    S.fold = 1 - seg(t, 0.81, 0.95);
    S.ink = smooth(seg(t, 0.88, 0.99));
    S.fade = opts.handoffFade === false ? 0 : smooth(seg(t, 0.975, 1));
    S.inBox = true;
    camTrack(t, OPEN_TRACK);
    /* the camera rides up with the carton as it unfolds */
    const lift = UNF_LIFT * liftK * ease(1 - S.fold); camPos.y += lift; camTgt.y += lift;
  }
  /* the ending: e 0..1 (the carton comes from where the opening left it risen; it goes back in assembled) */
  function endState(e) {
    S.drop = 1; S.fold = 1; S.ink = 0; S.fade = 0; S.inBox = true;
    S.rise = 1 - ease(seg(e, 0.0, 0.17)); S.turn = 1 - smooth(seg(e, 0.0, 0.14));
    S.flaps = [dropShut(seg(e, 0.34, 0.41)), dropShut(seg(e, 0.29, 0.36)), dropShut(seg(e, 0.24, 0.3)), dropShut(seg(e, 0.2, 0.26))];
    /* the old cut tape stays under the new run; the old label is long gone */
    S.split = true; S.slit = 1;
    S.run = e < 0.42 ? -1 : ease(seg(e, 0.42, 0.55));
    S.hold = 1; S.release = 0; S.residue = 0;
    S.print = smooth(seg(e, 0.5, 0.64));
    S.hover = e < 0.48 ? -1 : lerp(3.2, 1, easeOut(seg(e, 0.48, 0.56))) * (1 - ease(seg(e, 0.64, 0.72)));
    S.peel = 0.3 * (1 - ease(seg(e, 0.69, 0.81)));
    camTrack(e, END_TRACK);
  }

  /* ---------------- render ---------------- */
  const tmpV = V(0, 0, 0);
  /* from the rise to the flat sheet the camera frames the carton itself: its bounds, centred, with room around it, at any aspect */
  const FB = new THREE.Box3(), FS = new THREE.Sphere(), FD = V(0, 0, 0), FC = V(0, 0, 0);
  let fitW = 0, liftK = 1;   /* portrait frames back off further to fit the width, so the sheet lifts higher to leave the box out of shot */
  function fitCam(w) {
    fitW = w; if (w <= 0) return;
    cart.updateMatrixWorld(true); FB.setFromObject(cart); FB.getBoundingSphere(FS);
    FD.copy(camPos).sub(camTgt).normalize();
    const vf = camera.fov * D2R / 2, hf = Math.atan(Math.tan(vf) * camera.aspect);
    const d = FS.radius * 1.3 / Math.sin(Math.min(vf, hf));
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
    PP.uFocus.value = dist; PP.uAperture.value = lerp(1.05, 0.6, clamp((dist - 0.25) / 1.3)) * (1 - 0.55 * (1 - S.fold));
  }
  let frames = 0, lastT = 0, last = { kind: '', v: -1 }, qAcc = 0, qN = 0, qSlow = 0, qFast = 0;
  const qMax = 2;
  const ft = [];
  function render() {
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
  const emit = (name, data) => { (listeners[name] || []).forEach((f) => { try { f(data); } catch (e) { /* a sound failing never stops the scene */ } }); (listeners['*'] || []).forEach((f) => { try { f(name, data); } catch (e) { /* */ } }); };
  function crossed(kind, a, b, cues) {
    if (a < 0 || a === b) return;
    const dir = b > a ? 1 : -1;
    cues.forEach((c) => { if ((dir > 0 && c.t > a && c.t <= b) || (dir < 0 && c.t <= a && c.t > b)) emit(c.name, { kind, i: c.i, dir, t: c.t }); });
  }
  const snap = (t, list) => list.reduce((p, s) => (t >= s - 1e-6 ? s : p), list[0]);

  let lastOpen = -1, lastEnd = -1, time = 0;
  function scrub(t) {
    t = clamp(t); if (REDUCED) t = snap(t, STILLS.open);
    crossed('open', lastOpen, t, OPEN_CUES); lastOpen = t; lastEnd = -1;
    openState(t); time = t * 40; apply(time);
    fitCam(smooth(seg(t, 0.62, 0.72)));
    offW = 1 - smooth(seg(t, 0.04, 0.3));
    placeCamera(); render();
  }
  function ending(e) {
    e = clamp(e); if (REDUCED) e = snap(e, STILLS.end);
    crossed('end', lastEnd, e, END_CUES); lastEnd = e; lastOpen = -1;
    endState(e); time = e * 40; apply(time);
    fitCam(1 - smooth(seg(e, 0.03, 0.15)));
    offW = smooth(seg(e, 0.8, 1));
    placeCamera(); render();
  }
  /* door3d.js compatibility: the storyboard's poses */
  function doorPose(s) {
    s = s || {};
    if (s.end != null) { ending(s.end); return; }
    const open = clamp(s.open || 0), rise = clamp(s.rise || 0), unfold = clamp(s.unfold || 0);
    /* open 0..1 -> peel, slit, flaps (t 0.07..0.6); rise -> 0.6..0.8; unfold -> 0.8..1 */
    let t = open * 0.6; if (rise > 0) t = 0.6 + rise * 0.2; if (unfold > 0) t = 0.8 + unfold * 0.2;
    if (REDUCED) t = snap(t, STILLS.open);
    crossed('open', lastOpen, t, OPEN_CUES); lastOpen = t;
    openState(t);
    S.drop = s.drop == null ? 1 : clamp(s.drop);
    if (S.drop < 1 && last.kind !== 'landed' && S.drop > 0.62) { last.kind = 'landed'; emit('land', { kind: 'open' }); }
    if (S.drop < 0.5) last.kind = '';
    apply(t * 40);
    fitCam(smooth(seg(t, 0.62, 0.72)));
    offW = 1 - smooth(seg(t, 0.04, 0.3));
    placeCamera(); render();
  }
  function pose() { if (lastEnd >= 0) ending(lastEnd); else scrub(Math.max(0, lastOpen)); }
  function still(name) { const m = { closed: 0, slit: 0.41, open: 0.6, carton: 0.78, sketch: 1 }; if (name === 'shut') return ending(1); scrub(m[name] != null ? m[name] : 0); }

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

  /* text redraws once the web fonts land; the sketch ink once its image loads */
  const redrawText = () => {
    const c2 = TX.cartonPrint(P, CPPM); printT.image = c2.print; foilT.image = c2.foil; printT.needsUpdate = foilT.needsUpdate = true;
    labelT.image = TX.label(P, MOBILE ? 8 : 10); labelT.needsUpdate = true;
    tapeT.image = TX.tape(P); tapeT.needsUpdate = true;
    pose();
  };
  const fontsReady = (document.fonts && document.fonts.load) ? Promise.race([Promise.all([`${P.wordWeight} 40px ${P.wordFont}`, `500 20px ${P.sansFont}`, `700 20px ${P.sansFont}`, `500 20px ${P.monoFont}`].map((f) => document.fonts.load(f).catch(() => {}))), new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve();
  fontsReady.then(redrawText);
  const sketchSrc = (kitSrc && kitSrc('sketch')) || cfg.sketchSrc;
  const sketchReady = new Promise((res) => {
    if (!sketchSrc) return res();
    const im = new Image(); im.decoding = 'async';
    im.onload = () => { inkT.image = TX.sketchInk(im, CPPM); inkT.needsUpdate = true; res(); pose(); };
    im.onerror = () => res(); im.src = sketchSrc;
  });

  /* warm: compile every program and upload every texture before the beat (no hitch on the first frame) */
  async function warm() {
    await Promise.all([fontsReady, sketchReady]);
    const keep = [lastOpen, lastEnd];
    for (const t of [0, 0.3, 0.5, 0.7, 0.9]) { openState(t); apply(0); placeCamera(); }
    renderer.compile(scene, camera);
    scene.traverse((o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; ms.forEach((m) => { for (const kk in m) { const v = m[kk]; if (v && v.isTexture) renderer.initTexture(v); } }); });
    [labelBackT, foilT, insideT, inkT].forEach((t) => renderer.initTexture(t));
    /* draw every phase once (programs incl. shadow-depth variants, instance buffers, the label's dynamic upload) */
    for (const t of [0, 0.15, 0.3, 0.38, 0.45, 0.55, 0.65, 0.75, 0.85, 0.92, 1]) { scrub(t); await new Promise((r) => requestAnimationFrame(r)); }
    for (const e of [0.1, 0.3, 0.5, 0.6, 0.75, 1]) { ending(e); await new Promise((r) => requestAnimationFrame(r)); }
    /* every quality level's render targets drawn once, so a quality step never hitches */
    const q0 = quality; for (let q = 0; q <= 2; q++) { setQuality(q); scrub(0.62); await new Promise((r) => requestAnimationFrame(r)); } setQuality(q0);
    ft.length = 0; lastT = 0;
    lastOpen = keep[0]; lastEnd = keep[1]; pose();
  }

  function dispose() {
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; ms.forEach((m) => { for (const kk in m) { const v = m[kk]; if (v && v.isTexture) v.dispose(); } m.dispose(); }); });
    post.dispose(); renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss();
  }

  /* first frame: the parcel shut on the mat */
  size(innerWidth, innerHeight);
  if (/[?&]debug3d\b/.test(location.search)) window.__p3 = { scene, THREE, camera, renderer, S, apply, CAM, nodes, cart, parcel, post };
  return { el, size, pose, doorPose, scrub, ending, still, lipRect, on, warm, ready: Promise.all([fontsReady, sketchReady]), stats, setQuality, dispose, cues: { open: OPEN_CUES, end: END_CUES }, reduced: REDUCED };
}
