// HERO: "2,000 CVs" — a scroll-scrubbed, fully reversible still life.
// pile → envelope → origami → flight → crumple → shred → burn → CD → iMac.
// export async function mountHero(rootEl, { onDone, onProgress, onLoad })
// onLoad(0..1): how far the deferred build is (1 = every texture uploaded, every shader compiled)
import * as THREE from '../../vendor/three.module.min.js';
import { clamp, lerp, seg, smooth, easeInOut, easeOut, easeIn, easeOutQuart, isMobileish } from './util.js';
import { Post } from './post.js';
import { Sheet, paperMaterial, SHEET_H } from './sheet.js';
import { Strips, NSTRIPS } from './strips.js';
import { Pile } from './pile.js';
import { makeEnvelope, makeMatchbox, makeFlame, BOX, ENV_H } from './objects.js';
import { makeCD, makeMotes, seedMotes, CD_R } from './cd.js';
import { loadIMac } from './imac.js';
import { Particles } from './particles.js';
import { HeroAudio } from './audio.js';
import { makeFireWall } from './firewall.js';
import { drawCVFront, drawCVBack, drawCDLabel, drawTable, drawPileAtlas } from './textures.js';
import { makeHands } from './hands.js';
import { isLow } from '../power.js';
import { isWispr } from '../version.js';

const BEATS = [   // caption markup is font play: <b> dot-matrix, <i> handwriting, <em> flame, <s> struck
  { id: 'pile', len: 1.0, cap: isWispr ? 'Heard you received <b>2,000</b> CVs, all very similar.' : 'Every CV gets piled with <b>a thousand</b> others.' },
  { id: 'envelope', len: 1.4, cap: 'So I took <i>mine</i>,' },
  { id: 'origami', len: 1.3, cap: 'Made a <i>plane</i> out of it,' },
  { id: 'flight', len: 0.8, cap: '<b>Flew</b> it around,' },
  { id: 'crumple', len: 0.7, cap: 'Got <s>bored</s>,' },
  { id: 'shred', len: 1.1, cap: '<u>shredded</u> it,' },
  { id: 'burn', len: 1.8, cap: 'and <em>burned</em> it…' },
  { id: 'cd', len: 1.0, cap: '…onto a <b>CD</b>…' },
  { id: 'insert', len: 1.4, cap: 'for you to <i>experience</i>.' },  // holds at the slot (its own groove), then goes in
];
const TOTAL = BEATS.reduce((a, b) => a + b.len, 0);
{
  let acc = 0;
  for (const b of BEATS) { b.a = acc / TOTAL; acc += b.len; b.b = acc / TOTAL; }
}
const BI = Object.fromEntries(BEATS.map((b, i) => [b.id, i]));
const G = (id, local) => { const b = BEATS[BI[id]]; return b.a + (b.b - b.a) * local; };
// Scroll grooves: resting poses the page snaps to, so a scroll never stops mid-fold.
// One gesture moves one groove (scroll-snap-stop: always).
const GROOVES = () => [0, G('envelope', 0.57), G('envelope', 0.75), G('envelope', 1), G('origami', 1) - 1e-4, G('flight', 0.5),
  G('crumple', 0.9), G('shred', 1) - 1e-4, G('burn', 0.3), G('burn', 0.62), G('cd', 0.95), G('insert', 0.5), 1];

const S = new THREE.Vector3(2.5, 1.15, 0.7);       // the stage, where the sheet performs
const PILE_C = new THREE.Vector3(-0.35, 0, -2.0);
const IMAC_Z = -1.15;
const FOV = 32;
const B_IGN = 0.36;                                // burn-beat time the match touches paper

const FOLD_T = [[0.02, 0.2], [0.12, 0.3], [0.33, 0.49], [0.43, 0.59], [0.63, 0.8], [0.8, 0.96], [0.8, 0.96]];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function fontsReady() {
  if (!document.fonts?.load) return;
  const f = [
    '800 40px "Bricolage Grotesque"', '600 40px "Jersey 10"', '500 40px "Jersey 10"', '400 20px "Spline Sans Mono"',
    '500 20px "Spline Sans Mono"', '400 40px "Patrick Hand"', '800 40px "Doto"',
  ];
  await Promise.race([Promise.all(f.map((x) => document.fonts.load(x).catch(() => {}))), wait(2500)]);
}

function loadImage(src) {
  return new Promise((res) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
}

function canvasTex(src, aniso) {
  const t = src instanceof HTMLCanvasElement ? new THREE.CanvasTexture(src) : new THREE.Texture(src);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

function buildDOM(root, reduced) {
  root.classList.add('hero');
  root.innerHTML = `
    <div class="hero-track">
      <div class="hero-stage">
        <canvas class="hero-canvas" aria-hidden="true"></canvas>
        <div class="hero-fade" aria-hidden="true"></div>
        <header class="hero-top">
          <p class="hero-mark"><span>Sameep Rehlan</span><span class="hero-mark__sep">/</span><span>Off the CV</span></p>
          <button class="hero-pill hero-sound" type="button" aria-pressed="false" aria-label="Sound">
            <span class="hero-sound__bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="hero-sound__txt">Sound off</span>
          </button>
        </header>
        <div class="hero-counter" aria-live="off">
          <p class="hero-counter__num"><span>0</span></p>
          <p class="hero-counter__label">applications</p>
        </div>
        <footer class="hero-bottom">
          <div class="hero-cap" aria-live="polite">
            <p class="hero-cap__idx"><span class="hero-cap__n">01</span> / ${String(BEATS.length).padStart(2, '0')}</p>
            <p class="hero-cap__txt">${BEATS[0].cap}</p>
          </div>
          <button class="hero-pill hero-skip" type="button">Skip to the work <span aria-hidden="true">↓</span></button>
        </footer>
        <div class="hero-hint" aria-hidden="true"><span>Scroll</span><i></i></div>
        <div class="hero-progress" aria-hidden="true"><i></i></div>
      </div>
    </div>`;
  const q = (s) => root.querySelector(s);
  const track = q('.hero-track');
  track.style.setProperty('--hero-screens', String(reduced ? 7 : TOTAL + 1));
  return {
    track, stage: q('.hero-stage'), canvas: q('.hero-canvas'), fade: q('.hero-fade'),
    counter: q('.hero-counter'), num: q('.hero-counter__num span'), cap: q('.hero-cap'),
    capN: q('.hero-cap__n'), capT: q('.hero-cap__txt'), skip: q('.hero-skip'), sound: q('.hero-sound'),
    soundTxt: q('.hero-sound__txt'), hint: q('.hero-hint'), prog: q('.hero-progress i'),
  };
}

export async function mountHero(rootEl, { onDone, onProgress, onLoad } = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]rm\b/.test(location.search);
  const mobile = isMobileish();
  const T0 = performance.now();
  const DEBUG = /[?&]debug\b/.test(location.search);
  const STAGES = ['pile', 'first-frame', 'cv', 'sheet', 'strips', 'rest', 'compiled'];
  const mark = (s) => {
    if (DEBUG) console.log('[hero]', s, Math.round(performance.now() - T0));
    const i = STAGES.indexOf(s);
    if (i >= 0) try { onLoad?.((i + 1) / STAGES.length); } catch { /* the gate's problem */ }
  };
  const dom = buildDOM(rootEl, reduced);
  const audio = new HeroAudio();

  // ------------------------------------------------------------------ grooves
  // Each wheel flick, swipe or arrow key glides to the next resting pose; trackpad inertia is
  // swallowed, and a scrollbar drag that stops mid-fold settles to the nearest pose.
  const groovesOn = !/[?&](debug|timer)\b/.test(location.search);
  let gTop = [], gAnim = 0, gBusy = false, gQuiet = 0, gAcc = 0, gIdle = 0, gLive = groovesOn;
  const layoutGrooves = () => {
    const base = dom.track.getBoundingClientRect().top + scrollY;
    const total = dom.track.offsetHeight - dom.stage.clientHeight;
    gTop = GROOVES().map((p) => Math.round(base + p * total));
  };
  layoutGrooves();
  const glide = (to) => {
    cancelAnimationFrame(gAnim);
    const from = scrollY, d = to - from;
    if (Math.abs(d) < 2) return;
    const dur = reduced ? 1 : Math.min(1300, 650 + Math.abs(d) * 0.18);
    const t0 = performance.now(); gBusy = true;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      scrollTo(0, from + d * (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2));
      if (k < 1) gAnim = requestAnimationFrame(step); else gBusy = false;
    };
    gAnim = requestAnimationFrame(step);
  };
  const go = (dir) => {
    const y = scrollY;
    const to = dir > 0 ? gTop.find((t) => t > y + 4) : [...gTop].reverse().find((t) => t < y - 4);
    if (to !== undefined) glide(to);
    else if (dir > 0 && y >= gTop[gTop.length - 1] - 4) return false;   // past the last pose: let the page scroll on
    return true;
  };
  const inHero = () => gLive && !document.documentElement.classList.contains('is-gated') && scrollY <= gTop[gTop.length - 1] + 4;
  let hands = null; // high power: grab the paper, the match, the CD (hands.js)
  const onWheel = (e) => {
    if (!inHero() || e.ctrlKey || hands?.busy) return;
    if (e.deltaY > 0 && scrollY >= gTop[gTop.length - 1] - 4) return;
    e.preventDefault();
    const now = performance.now();
    const fresh = now - gQuiet > 220; gQuiet = now;
    if (gBusy || !fresh && gAcc === Infinity) return;            // still gliding, or the tail of the same flick
    gAcc = (fresh ? 0 : gAcc) + e.deltaY * (e.deltaMode === 1 ? 32 : 1);
    if (Math.abs(gAcc) > 24) { go(Math.sign(gAcc)); gAcc = Infinity; }
  };
  let ty = null;
  const onTouchStart = (e) => { ty = e.touches[0].clientY; };
  const onTouchMove = (e) => { if (inHero() && (ty !== null || hands?.busy)) e.preventDefault(); };
  const onTouchEnd = (e) => {
    if (hands?.busy || hands?.justDragged?.()) { ty = null; return; }
    if (ty === null || !inHero()) return;
    const dy = ty - (e.changedTouches[0]?.clientY ?? ty); ty = null;
    if (Math.abs(dy) > 30 && !gBusy) go(Math.sign(dy));
  };
  const onKey = (e) => {
    if (!inHero() || e.target.closest?.('input, textarea, [contenteditable], button')) return;
    const dir = { ArrowDown: 1, PageDown: 1, ' ': e.shiftKey ? -1 : 1, ArrowUp: -1, PageUp: -1 }[e.key];
    if (dir && go(dir)) e.preventDefault();
  };
  const onSettle = () => {   // scrollbar drags and anything else: settle to the nearest pose
    clearTimeout(gIdle);
    if (gBusy || !inHero() || hands?.busy) return;
    gIdle = setTimeout(() => {
      if (gBusy || !inHero()) return;
      const y = scrollY, near = gTop.reduce((a, t) => (Math.abs(t - y) < Math.abs(a - y) ? t : a), gTop[0]);
      if (Math.abs(near - y) > 4) glide(near);
    }, 180);
  };
  const snap = (on) => {
    gLive = on && groovesOn;
    const m = on && groovesOn ? addEventListener : removeEventListener;
    m('wheel', onWheel, { passive: false }); m('touchstart', onTouchStart, { passive: true });
    m('touchmove', onTouchMove, { passive: false }); m('touchend', onTouchEnd, { passive: true });
    m('keydown', onKey); m('scroll', onSettle, { passive: true });
    if (!on) cancelAnimationFrame(gAnim);
  };
  snap(true);

  // ------------------------------------------------------------------ renderer
  const renderer = new THREE.WebGLRenderer({ canvas: dom.canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false });
  renderer.setClearColor(0x0f0d0b, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const post = new Post(renderer, { mobile });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f0d0b);
  scene.fog = new THREE.Fog(0x0f0d0b, 7, 17);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 60);

  // ------------------------------------------------------------------ light
  const hemi = new THREE.HemisphereLight(0xffe2c2, 0x1a120c, 0.3);
  const key = new THREE.SpotLight(0xffe6c8, 2.1, 0, 0.5, 0.9, 0);
  key.position.set(-0.6, 6.8, 4.6);
  key.target.position.set(1.2, 0.6, -0.5);
  key.castShadow = true;
  key.shadow.mapSize.set(mobile ? 1024 : 1536, mobile ? 1024 : 1536);
  key.shadow.camera.near = 2; key.shadow.camera.far = 16;
  key.shadow.bias = -0.0012; key.shadow.normalBias = 0.0; key.shadow.radius = 3;
  const rim = new THREE.DirectionalLight(0xa9c2ff, 0.9);
  rim.position.set(3.2, 2.6, -3);
  const fillL = new THREE.DirectionalLight(0xffd9b0, 0.35);
  fillL.position.set(0.5, 1.2, 6);
  const fireLight = new THREE.PointLight(0xff8a3c, 0, 0, 1.6);
  const screenLight = new THREE.PointLight(0x9fffe0, 0, 0, 1.6);
  scene.add(hemi, key, key.target, rim, fillL, fireLight, screenLight);

  // table
  const tableTex = canvasTex(drawTable(512), aniso);
  tableTex.wrapS = tableTex.wrapT = THREE.RepeatWrapping;
  tableTex.repeat.set(6, 6);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x4a4038, map: tableTex, roughness: 0.78, metalness: 0 }));
  table.rotation.x = -Math.PI / 2;
  table.receiveShadow = true;
  scene.add(table);

  // ------------------------------------------------------------------ pile first (fast path to first frame)
  const atlas = canvasTex(drawPileAtlas(mobile ? 640 : 1024), aniso);
  const pile = new Pile({ count: mobile ? 400 : 2000, cvTex: atlas, mobile });
  pile.group.position.copy(PILE_C);
  scene.add(pile.group);
  mark('pile');

  // everything else is built after the first frame (see buildRest)
  let envelope, sheet, paperMat, sheetMesh, sheetG, strips, stripsG, mb, strikeFlash, cd, motes, imac, particles;
  let cvFront, cvBack, frontCanvas = null, FOLD_FULL, FOLD_BASE, angles, flameMat;
  // the picked fold's wings ease in (the last two folds are the wings)
  const wingStep = (dt) => {
    if (!FOLD_BASE) return;
    const goal = WING[foldStyle] || 1;
    if (Math.abs(goal - wingK) < 1e-4) wingK = goal; else wingK += (goal - wingK) * (1 - Math.exp(-(dt || 0.016) * 6));
    const n = FOLD_FULL.length;
    FOLD_FULL[n - 2] = FOLD_BASE[n - 2] * wingK; FOLD_FULL[n - 1] = FOLD_BASE[n - 1] * wingK;
  };
  const setFoldStyle = (k) => {
    if (!PATHS[k]) return false;
    foldStyle = k; path = PATHS[k]; dirty = true;
    return true;
  };
  let full = false;
  const stripFlames = [];
  const fireWall = makeFireWall();
  let wallI = 0;

  // ------------------------------------------------------------------ temps (no per-frame allocation)
  const V = () => new THREE.Vector3();
  const tA = V(), tB = V(), tC = V(), tD = V(), tE = V(), camT = V(), camD = V();
  const camP = V(), camL = V(), camPV = V(), camLV = V();
  let camSnap = true;
  const qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), qC = new THREE.Quaternion();
  const eA = new THREE.Euler();
  const mA = new THREE.Matrix4();
  const UP = new THREE.Vector3(0, 1, 0);
  const pt = new Float32Array(3);

  // envelope rest pose in the pile
  const slot = pile.slot || { x: 0.4, y: 0.6, z: -0.75, rot: 0.15, idx: 0 };
  const envStart = new THREE.Vector3(PILE_C.x + slot.x, PILE_C.y + slot.y + 0.012, PILE_C.z + slot.z + 0.32);
  const envOut = envStart.clone().add(new THREE.Vector3(0.05, 0.16, 1.35));
  const qEnvFlat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)).premultiply(new THREE.Quaternion().setFromAxisAngle(UP, slot.rot * 0.6));
  const qIdent = new THREE.Quaternion();
  const qYawPi = new THREE.Quaternion().setFromAxisAngle(UP, Math.PI);

  // origami end pose (3/4 view of the finished plane)
  const qOriEnd = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.22, Math.PI + 0.75, 0.0));
  // flight path (relative to S); starts and ends at the stage
  // three folds, three flights (picked at the finished plane, by tap or voice). All end the same
  // way, so the crumple that follows lines up whichever flew.
  const DART = [
    [0, 0, 0], [0.55, 0.12, -0.25], [1.0, 0.5, -0.8], [0.7, 1.05, -1.15], [-0.15, 1.0, -0.85], [-0.75, 0.55, -0.2],
    [-0.55, 0.32, 0.9], [0.0, 0.26, 1.85], [0.42, 0.22, 2.35], [0.95, 0.12, 1.5], [0.75, 0.04, 0.55], [0.25, 0, 0.12], [0, 0, 0],
  ];
  const curve = (pts) => new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal', 0.5);
  const PATHS = {
    dart: curve(DART),
    // wide, flat and slow: long lazy arcs, barely climbing
    glider: curve(DART.map(([x, y, z], i) => (i < 2 || i > DART.length - 4 ? [x, y, z] : [x * 1.18, 0.12 + y * 0.45, z * 1.12]))),
    // a climbing corkscrew, then the dive home
    stunt: curve([[0, 0, 0], [0.55, 0.12, -0.25], [1.0, 0.5, -0.8], [1.05, 0.72, -1.05], [0.6, 0.9, -1.45], [0.15, 1.1, -1.0], [0.6, 1.3, -0.55],
      [1.05, 1.42, -1.0], [0.6, 1.35, -1.45], [-0.15, 1.0, -0.85], [-0.75, 0.5, -0.2], ...DART.slice(6)]),
  };
  const WING = { dart: 1, glider: 0.8, stunt: 1.12 };      // wing fold (FL/FR) vs the dart's
  let foldStyle = 'dart', wingK = 1, path = PATHS.dart;
  const qPath = (f, out) => {
    const u = clamp(f, 0.0005, 0.9995);
    path.getTangentAt(u, tA).normalize();
    path.getTangentAt(clamp(u + 0.03, 0, 1), tB).normalize();
    tC.crossVectors(tA, UP);                                   // right
    if (tC.lengthSq() < 1e-6) tC.set(1, 0, 0); else tC.normalize(); // (a near-vertical climb)
    const turn = tB.sub(tA).dot(tC);
    const bank = clamp(-turn * 9, -1.1, 1.1) + Math.sin(f * 37) * 0.12 + Math.sin(f * 13) * 0.06;
    tD.crossVectors(tC, tA).normalize();                       // up
    tD.applyAxisAngle(tA, bank);
    tE.copy(tD).negate();                                       // local X = -up
    tC.crossVectors(tE, tA);                                    // local Z
    mA.makeBasis(tE, tA, tC);
    return out.setFromRotationMatrix(mA);
  };
  const qFlightEnd = qPath(1, new THREE.Quaternion());
  const qBall = qFlightEnd.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, 1.3, 0.2)));

  // ------------------------------------------------------------------ layout (depends on aspect)
  let aspect = 1, vw = 1, vh = 1;
  const camKeys = [];
  const L = { ign: new THREE.Vector3(), box: new THREE.Vector3(), boxYaw: -0.32, stripsC: new THREE.Vector3(), slotW: new THREE.Vector3(), cdScale: 1 };
  const mkKey = (p, T, D, w, h) => camKeys.push({ p, T: T.clone(), D: D.clone().normalize(), w, h });

  function layout() {
    if (!full) {
      camKeys.length = 0;
      const pt0 = tC.copy(PILE_C).add(tD.set(0.0, mobile ? 1.0 : 0.95, 0));
      mkKey(0, pt0, tB.set(0.16, 0.36, 1), aspect < 0.9 ? 4.0 : 6.6, 3.7);
      mkKey(1.0001, pt0, tB.set(0.16, 0.36, 1), aspect < 0.9 ? 4.0 : 6.6, 3.7);
      return;
    }
    strips.layout(aspect);
    const portrait = aspect < 0.9;
    // ignition point = bottom of the first strip (world)
    strips.cut = 1; strips.time = 0;
    strips.point(strips.firstStrip, 0.5, 0.0, pt);
    L.ign.set(pt[0], pt[1], pt[2]).add(S);
    L.box.set(L.ign.x + (portrait ? 0.08 : 0.3), 0, S.z + 0.62);
    L.boxYaw = portrait ? -0.12 : -0.32;
    L.stripsC.set(S.x, S.y + 0.05, S.z);
    seedMotes(motes, S.x, S.y, S.z, strips.spreadW, SHEET_H * 0.9);
    // iMac slot (world)
    L.slotW.copy(imac.slotLocal).add(imac.group.position);
    L.cdScale = clamp(imac.slotW * 0.98 / (CD_R * 2), 0.4, 1);

    camKeys.length = 0;
    const v = (x, y, z) => tA.set(x, y, z);
    const d = (x, y, z) => tB.set(x, y, z);
    const pileT = tC.copy(PILE_C).add(tD.set(0.0, mobile ? 1.0 : 0.95, 0));
    mkKey(0, pileT, d(0.16, 0.36, 1), portrait ? 4.0 : 6.6, 3.7);
    mkKey(G('pile', 0.85), tC.copy(envStart).add(tD.set(0, 0.25, 0)), d(0.15, 0.5, 1), 2.3, 1.7);
    mkKey(G('envelope', 0.12), tC.copy(envStart).add(tD.set(0, 0.25, 0.6)), d(0.1, 0.42, 1), 2.4, 1.8);
    mkKey(G('envelope', 0.42), v(S.x, S.y + 0.15, S.z), d(0.05, 0.14, 1), 1.5, 2.0);
    mkKey(G('envelope', 0.6), v(S.x, S.y + 0.42, S.z), d(0.04, 0.12, 1), 1.55, 2.75);
    mkKey(G('envelope', 0.82), v(S.x, S.y + 0.55, S.z), d(-0.06, 0.12, 1), 1.6, 3.05);
    mkKey(G('envelope', 1), v(S.x, S.y, S.z), d(-0.04, 0.1, 1), 1.35, 1.75);
    mkKey(G('origami', 0.55), v(S.x, S.y + 0.03, S.z), d(0.1, 0.14, 1), 1.25, 1.7);
    mkKey(G('origami', 1), v(S.x + (portrait ? -0.12 : 0), S.y + 0.05, S.z), d(0.45, 0.3, 1), portrait ? 1.7 : 1.15, 1.25);
    mkKey(G('flight', 0.16), v(S.x + (portrait ? 0.14 : 0.1), S.y + 0.42, S.z - 0.2), d(0.06, 0.14, 1), portrait ? 3.3 : 2.5, 1.75);
    mkKey(G('flight', 0.88), v(S.x + (portrait ? 0.1 : 0.05), S.y + 0.3, S.z), d(0.0, 0.14, 1), portrait ? 3.1 : 2.4, 1.7);
    mkKey(G('crumple', 0.35), v(S.x, S.y, S.z), d(0.05, 0.18, 1), portrait ? 1.7 : 1.0, portrait ? 1.7 : 1.0);
    mkKey(G('crumple', 1), v(S.x, S.y, S.z), d(-0.12, 0.22, 1), 0.75, 0.75);
    mkKey(G('shred', 0.28), v(S.x, S.y, S.z), d(0, 0.1, 1), 1.3, 1.75);
    mkKey(G('shred', 1), L.stripsC, d(0, 0.1, 1), strips.spreadW + 0.3, strips.spreadH + 0.2);
    mkKey(G('burn', 0.04), L.stripsC, d(0, 0.1, 1), strips.spreadW + 0.3, strips.spreadH + 0.2);
    mkKey(G('burn', 0.13), tC.copy(L.box).add(tD.set(-0.04, 0.1, 0)), d(0.22, 0.5, 1), 0.85, 0.62);
    mkKey(G('burn', 0.27), tC.copy(L.box).add(tD.set(-0.02, 0.12, 0)), d(0.18, 0.42, 1), 0.85, 0.62);
    mkKey(G('burn', 0.37), tC.copy(L.ign).lerp(L.box, 0.35).add(tD.set(0, 0.02, 0)), d(0.15, 0.25, 1), 1.0, 0.95);
    mkKey(G('burn', 0.55), L.stripsC, d(0, 0.12, 1), strips.spreadW + 0.45, strips.spreadH + 0.45);
    mkKey(G('burn', 0.96), tC.copy(L.stripsC).add(tD.set(0, 0.15, 0)), d(0, 0.1, 1), strips.spreadW + 0.2, strips.spreadH + 0.3);
    mkKey(G('cd', 0.5), v(S.x, S.y, S.z), d(0, 0.06, 1), 1.0, 1.0);
    mkKey(G('cd', 1), v(S.x, S.y, S.z), d(0, 0.04, 1), 0.95, 0.95);
    const ic = tC.copy(imac.group.position);
    mkKey(G('insert', 0.5), ic, d(0, 0, 1), imac.W * 1.1, imac.H * 1.1);
    mkKey(1.0001, ic, d(0, 0, 1), imac.W * 1.1, imac.H * 1.1);
  }

  function camAt(p) {
    let i = 0;
    while (i < camKeys.length - 2 && p >= camKeys[i + 1].p) i++;
    const a = camKeys[i], b = camKeys[i + 1];
    const t = easeInOut(clamp((p - a.p) / (b.p - a.p)));
    camT.lerpVectors(a.T, b.T, t);
    camD.lerpVectors(a.D, b.D, t).normalize();
    const w = lerp(a.w, b.w, t), h = lerp(a.h, b.h, t);
    const tn = Math.tan((FOV / 2) * Math.PI / 180);
    return Math.max(h / (2 * tn), w / (2 * tn * aspect));
  }

  // ------------------------------------------------------------------ sizing
  let dpr = 1;
  // adaptive quality: 2 = full, 1 = lighter, 0 = low-end (pixel budget, MSAA, particle rate)
  const QB = [0.55, 0.75, 1], QP = [0.35, 0.6, 1];
  let quality = 1, qAcc = 0, qN = 0, qWorst = 0, qSlow = 0, qFast = 0, qSkip = 180;
  // every level's render targets are pre-allocated (and warmed), so a switch is just a pointer swap
  function setQuality(q) {
    quality = q;
    post.use(q);
    applyPointScale();
    if (DEBUG) console.log('[hero] quality ->', q);
  }
  const levelDpr = [1, 1, 1];
  function applyPointScale() {
    const s = (vh * levelDpr[quality]) / (2 * Math.tan((FOV / 2) * Math.PI / 180));
    if (full) { particles.setScale(s); motes.material.uniforms.uScale.value = s; }
  }
  function resize(relayout = true) {
    vw = Math.max(1, dom.stage.clientWidth); vh = Math.max(1, dom.stage.clientHeight);
    aspect = vw / vh;
    const cap = mobile ? 1.5 : 2;
    const native = Math.min(window.devicePixelRatio || 1, cap);
    for (let q = 0; q < 3; q++) {
      const budget = (mobile ? 1.4e6 : 2.0e6) * QB[q];
      levelDpr[q] = vw * vh * native * native > budget ? Math.max(0.75, Math.sqrt(budget / (vw * vh))) : native;
    }
    // the canvas stays at the top level's size; lower levels render smaller and the final pass upsamples
    dpr = levelDpr[2];
    renderer.setPixelRatio(dpr);
    renderer.setSize(vw, vh, false);
    post.setSize(vw, vh, levelDpr);
    post.use(quality);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    applyPointScale();
    if (relayout) layout();
    dirty = true;
  }

  // ------------------------------------------------------------------ input
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  addEventListener('pointermove', (e) => { pointer.x = (e.clientX / innerWidth) * 2 - 1; pointer.y = -((e.clientY / innerHeight) * 2 - 1); }, { passive: true });

  let target = 0, prog = 0, dirty = true;
  function readScroll() {
    const r = dom.track.getBoundingClientRect();
    const total = dom.track.offsetHeight - dom.stage.clientHeight;
    target = clamp(-r.top / Math.max(1, total));
  }
  addEventListener('scroll', readScroll, { passive: true });

  dom.skip.addEventListener('click', () => {
    const top = dom.track.getBoundingClientRect().top + scrollY + dom.track.offsetHeight - dom.stage.clientHeight;
    audio.unlock();
    scrollTo({ top, behavior: 'instant' });
    readScroll();
  });
  const syncSound = () => {
    const on = audio.unlocked && !audio.muted;
    dom.sound.setAttribute('aria-pressed', String(on));
    dom.soundTxt.textContent = on ? 'Sound on' : 'Sound off';
    dom.sound.classList.toggle('is-on', on);
  };
  audio.onchange = syncSound;
  dom.sound.addEventListener('click', () => {
    if (!audio.unlocked) { audio.unlock(); audio.setMuted(false); } else audio.setMuted(!audio.muted);
    syncSound();
  });
  syncSound();

  // ------------------------------------------------------------------ sound cues (crossing detection)
  const cues = [
    [G('envelope', 0.04), 'paper-slide', 0.8], [G('envelope', 0.46), 'paper-slide', 0.7], [G('envelope', 0.63), 'paper-flip', 0.9],
    [G('envelope', 0.8), 'paper-slide', 0.8],
    ...FOLD_T.slice(0, 6).map(([a]) => [G('origami', a + 0.02), 'paper-fold', 0.8]),
    [G('flight', 0.06), 'whoosh', 0.9],
    [G('crumple', 0.05), 'crumple', 1], [G('shred', 0.03), 'crumple', 0.45], [G('shred', 0.33), 'shred', 1],
    [G('burn', 0.09), 'paper-slide', 0.5], [G('burn', 0.285), 'match-strike', 1],
    [G('cd', 0.06), 'whoosh', 0.6], [G('insert', 0.66), 'cd-whirr', 1],
  ];
  let lastP = 0;

  // ------------------------------------------------------------------ captions
  let capIdx = -1, lastCount = -1, lastProgUI = -1, lastCounterVis = -1;
  function setCaption(i) {
    if (i === capIdx) return;
    capIdx = i;
    dom.cap.classList.remove('is-in');
    void dom.cap.offsetWidth;
    dom.capN.textContent = String(i + 1).padStart(2, '0');
    dom.capT.innerHTML = BEATS[i].cap;
    dom.cap.classList.add('is-in');
  }

  // ------------------------------------------------------------------ the state machine (pure in p, plus ambient time)
  let introT = reduced ? 10 : 0;
  let doneCalled = false;
  let strikeFired = false;
  const spawnAcc = new Float32Array(NSTRIPS * 4);
  const prevFront = new Float32Array(NSTRIPS).fill(-1);
  const screenRect = { left: 0, top: 0, width: 0, height: 0, x: 0, y: 0, right: 0, bottom: 0 };

  function beatOf(p) {
    for (let i = 0; i < BEATS.length; i++) if (p < BEATS[i].b) return i;
    return BEATS.length - 1;
  }

  const PROF = new Float64Array(10); let PT = 0; window.__prof = PROF;
  function apply(p, time, dt) {
    if (!full) p = Math.min(p, G('pile', 0.97));
    PT = performance.now();
    const bi = beatOf(p);
    const loc = (id) => seg(p, BEATS[BI[id]].a, BEATS[BI[id]].b);
    const e = loc('envelope'), o = loc('origami'), f = loc('flight'), c = loc('crumple');
    const s = loc('shred'), b = loc('burn'), d = loc('cd'), ins = loc('insert');

    // ---- intro count / pile
    const fillP = easeOutQuart(clamp(introT / 2.6));
    pile.setFill(fillP);
    const count = Math.round(2000 * fillP);
    if (count !== lastCount) { lastCount = count; dom.num.textContent = count.toLocaleString('en-US'); }
    const counterVis = 1 - seg(p, G('pile', 0.75), G('envelope', 0.1));
    if (counterVis !== lastCounterVis) {
      lastCounterVis = counterVis;
      dom.counter.style.opacity = counterVis.toFixed(3);
      dom.counter.style.visibility = counterVis <= 0 ? 'hidden' : 'visible';
    }

    if (DEBUG) PROF[0] += performance.now() - (PT = PT || performance.now()), PT = performance.now();
    if (full) {
    // ---- envelope + sheet
    const envVisible = p < G('envelope', 1) && (fillP * (pile.count + 72) - 1 > slot.idx || reduced || introT > 2.6);
    envelope.visible = envVisible;
    sheetG.visible = p < G('envelope', 1) ? envVisible : p < G('shred', 0.31);
    if (p < G('envelope', 1)) {
      // envelope: slide out of the stack, rise to the stage, then flip
      const a1 = easeInOut(seg(e, 0, 0.22));
      const a2 = easeInOut(seg(e, 0.18, 0.44));
      tA.lerpVectors(envStart, envOut, a1);
      if (a2 > 0) {
        // quadratic bezier envOut → S (control above)
        tB.copy(envOut).add(tC.set(0, 0.9, 0.1));
        const u = a2, iu = 1 - u;
        tA.set(
          iu * iu * envOut.x + 2 * iu * u * tB.x + u * u * S.x,
          iu * iu * envOut.y + 2 * iu * u * tB.y + u * u * S.y,
          iu * iu * envOut.z + 2 * iu * u * tB.z + u * u * S.z,
        );
      }
      qA.slerpQuaternions(qEnvFlat, qIdent, a2);
      const flip = easeInOut(seg(e, 0.6, 0.78));
      qB.setFromAxisAngle(UP, Math.PI * flip);
      qA.premultiply(qB);
      // sway while it hangs in the air
      const sway = seg(e, 0.3, 0.6) * (1 - seg(e, 0.86, 1));
      qC.setFromEuler(eA.set(Math.sin(time * 0.7) * 0.025 * sway, Math.sin(time * 0.5) * 0.04 * sway, 0));
      qA.multiply(qC);
      // drop away at the end
      const drop = easeIn(seg(e, 0.84, 1));
      tA.y -= drop * 2.6; tA.z -= drop * 0.4;
      envelope.position.copy(tA);
      envelope.quaternion.copy(qA);
      if (drop > 0) envelope.rotateX(drop * 0.6);
      // sheet rides inside
      const off = 0.78 * easeInOut(seg(e, 0.45, 0.6)) + 0.92 * easeInOut(seg(e, 0.79, 0.93));
      tB.set(0, off, 0).applyQuaternion(qA);
      tB.add(tA); tB.y += drop * 2.6; tB.z += drop * 0.4;
      const settle = easeInOut(seg(e, 0.88, 1));
      sheetG.position.lerpVectors(tB, S, settle);
      sheetG.quaternion.copy(qA);
      if (sheet.mode !== 'rest') sheet.setFlat();
      paperMat.userData.u.uFacet.value = 0.0;
      paperMat.userData.u.uAOAmt.value = 0;
    } else if (p < G('origami', 1)) {
      wingStep(dt);
      for (let k = 0; k < angles.length; k++) angles[k] = easeInOut(seg(o, FOLD_T[k][0], FOLD_T[k][1])) * FOLD_FULL[k];
      sheet.setFold(angles);
      const turn = easeInOut(seg(o, 0.6, 1));
      sheetG.position.copy(S);
      sheetG.position.y += Math.sin(time * 0.8) * 0.01;
      sheetG.quaternion.slerpQuaternions(qYawPi, qOriEnd, turn);
      paperMat.userData.u.uFacet.value = 0.6;
      paperMat.userData.u.uAOAmt.value = 0;
    } else if (p < G('flight', 1)) {
      wingStep(dt);
      if (sheet.mode !== 'fold' || Math.abs(angles[angles.length - 1] - FOLD_FULL[angles.length - 1]) > 1e-4) {
        for (let k = 0; k < angles.length; k++) angles[k] = FOLD_FULL[k];
        sheet.setFold(angles);
      }
      path.getPointAt(easeInOut(f), tA);
      sheetG.position.copy(S).add(tA);
      qPath(easeInOut(f), qB);
      const blendIn = smooth(seg(f, 0, 0.14));
      sheetG.quaternion.slerpQuaternions(qOriEnd, qB, blendIn);
      paperMat.userData.u.uFacet.value = 0.6;
    } else if (p < G('crumple', 1)) {
      sheet.setCrumple(easeInOut(seg(c, 0, 0.88)));
      sheetG.position.copy(S);
      qB.setFromAxisAngle(tA.set(0.3, 1, 0.1).normalize(), easeOut(c) * 1.6 + time * 0.05 * c);
      sheetG.quaternion.copy(qFlightEnd).multiply(qB);
      paperMat.userData.u.uFacet.value = 0.6 + 0.3 * c;
      paperMat.userData.u.uAOAmt.value = c;
    } else if (p < G('shred', 0.31)) {
      const u = seg(s, 0, 0.3);
      sheet.setUncrumple(easeInOut(u));
      sheetG.position.copy(S);
      qB.setFromAxisAngle(tA.set(0.3, 1, 0.1).normalize(), 1.6);
      qC.copy(qFlightEnd).multiply(qB);
      sheetG.quaternion.slerpQuaternions(qC, qIdent, easeInOut(seg(u, 0.1, 1)));
      paperMat.userData.u.uFacet.value = lerp(0.9, 0.0, u);
      paperMat.userData.u.uAOAmt.value = 1;
    }

    if (DEBUG) PROF[1] += performance.now() - (PT = PT || performance.now()), PT = performance.now();
    // ---- strips
    const stripsOn = p >= G('shred', 0.31) && p < G('burn', 0.995);
    stripsG.visible = stripsOn;
    let burnActive = 0;
    if (stripsOn) {
      const cut = easeInOut(seg(s, 0.32, 1));
      strips.setBurn(b > 0 ? seg(b, B_IGN, 0.97) : 0);
      strips.update(p >= G('burn', 0) ? 1 : cut, time);
      burnActive = strips.active || 0;
    } else strips.setBurn(0);

    if (DEBUG) PROF[2] += performance.now() - (PT = PT || performance.now()), PT = performance.now();
    // ---- match + box
    const boxOn = p >= G('shred', 0.9) && p < G('cd', 0.3);
    mb.group.visible = boxOn;
    mb.match.visible = boxOn;
    let matchFlame = 0;
    if (boxOn) {
      const enter = easeOutQuart(seg(b, 0, 0.1));
      const leave = easeIn(seg(d, 0, 0.3));
      mb.group.position.set(L.box.x + (1 - enter) * 1.6 + leave * 1.6, 0, L.box.z + (1 - enter) * 0.4);
      mb.group.rotation.set(0, L.boxYaw + (1 - enter) * 0.6, 0);
      mb.group.updateMatrixWorld();
      const trayOut = easeInOut(seg(b, 0.08, 0.16));
      mb.tray.position.x = -trayOut * BOX.L * 0.55;
      // match keyframes in box-local space → world
      const rise = easeInOut(seg(b, 0.16, 0.24));
      const strike = easeIn(seg(b, 0.24, 0.285));
      const toPaper = easeInOut(seg(b, 0.3, B_IGN));
      const away = easeInOut(seg(b, 0.44, 0.56));
      // head position
      tA.set(-trayOut * BOX.L * 0.55 - BOX.L * 0.43, BOX.T * 0.42, 0.02).applyMatrix4(mb.group.matrixWorld); // lying in tray
      tB.set(BOX.L * 0.42, BOX.T * 0.55, BOX.W / 2 + 0.03).applyMatrix4(mb.group.matrixWorld);           // above striker start
      tB.y += 0.12 * (1 - strike);
      tC.set(-BOX.L * 0.36, BOX.T * 0.5, BOX.W / 2 + 0.014).applyMatrix4(mb.group.matrixWorld);          // striker end
      tD.copy(tA).lerp(tB, rise);
      if (strike > 0) { tE.set(BOX.L * 0.42, BOX.T * 0.5, BOX.W / 2 + 0.014).applyMatrix4(mb.group.matrixWorld); tD.copy(tE).lerp(tC, strike); }
      if (toPaper > 0) {
        tE.copy(L.ign); tE.y -= 0.035; tE.z += 0.02;
        const lift = Math.sin(Math.PI * toPaper) * 0.12;
        tD.lerpVectors(tC, tE, toPaper); tD.y += lift;
      }
      if (away > 0) {
        tE.copy(L.ign); tE.y -= 0.035; tE.z += 0.02;
        tC.copy(L.box); tC.x -= 0.32; tC.z += 0.12; tC.y = 0.012;
        tD.lerpVectors(tE, tC, away);
      }
      mb.match.position.copy(tD);
      // orientation (stick direction from head)
      tA.set(1, 0, 0).applyQuaternion(mb.group.quaternion);                  // lying along the tray
      tB.set(0.45, 0.85, 0.3).normalize();                                    // held for striking
      tC.set(-0.35, 0.88, 0.32).normalize();                                  // held up to the paper
      tE.set(0.9, 0.02, -0.4).normalize();                                    // dropped on the table
      tD.copy(tA).lerp(tB, rise).lerp(tC, toPaper).lerp(tE, away).normalize();
      mb.match.quaternion.setFromUnitVectors(UP, tD);
      // ignition
      const lit = b >= 0.285;
      const flare = lit ? 1 + 1.4 * (1 - seg(b, 0.285, 0.31)) : 0;
      const out = 1 - seg(b, 0.47, 0.55);
      matchFlame = lit ? flare * out : 0;
      mb.matchHead.color.setRGB(lit ? 0.06 : 0.77, lit ? 0.04 : 0.33, lit ? 0.03 : 0.23);
      mb.matchHead.emissiveIntensity = lit ? (0.6 + 0.4 * Math.sin(time * 20)) * Math.max(matchFlame, 0.2 * out) : 0;
      const charLen = lit ? BOX.L * 0.86 * 0.45 * seg(b, 0.285, 0.55) : 0;
      mb.char.scale.set(1, Math.max(0.001, charLen / 0.001), 1);
      mb.char.position.y = charLen / 2;
      mb.char.visible = lit;
      mb.flame.visible = matchFlame > 0.01;
      mb.flame.position.copy(mb.match.position);
      mb.flame.position.y += 0.004;
      mb.flame.userData.u.uI.value = matchFlame * (0.85 + 0.15 * Math.sin(time * 31));
      mb.flame.userData.u.uScale.value = 0.11 * (0.8 + 0.3 * Math.min(1.4, matchFlame));
      mb.flame.userData.u.uTime.value = time;
      // strike flash + sparks
      const flashK = seg(b, 0.282, 0.3);
      strikeFlash.visible = flashK > 0 && flashK < 1;
      strikeFlash.position.copy(mb.match.position);
      strikeFlash.userData.u.uI.value = Math.sin(Math.PI * flashK) * 2.2;
      strikeFlash.userData.u.uScale.value = 0.2;
      strikeFlash.userData.u.uTime.value = time;
      if (b >= 0.285 && lastP < G('burn', 0.285) && !reduced) {
        for (let i = 0; i < 46; i++) particles.spark(tD.x, tD.y, tD.z);
        strikeFired = true;
      }
      if (lit && matchFlame > 0.05 && !reduced && Math.random() < dt * 14) particles.flame(mb.match.position.x, mb.match.position.y + 0.02, mb.match.position.z, 0.05);
      if (out < 1 && out > 0 && !reduced && Math.random() < dt * 6) particles.smoke(mb.match.position.x, mb.match.position.y + 0.04, mb.match.position.z);
    } else { mb.flame.visible = false; strikeFlash.visible = false; }

    if (DEBUG) PROF[3] += performance.now() - (PT = PT || performance.now()), PT = performance.now();
    // ---- fire particles from burn fronts
    // edge flames (+ feed the shared fire wall)
    const wu = fireWall.userData.u;
    let nBurn = 0, zSum = 0;
    for (let k = 0; k < stripFlames.length; k++) {
      const fl = stripFlames[k];
      const f = strips.front[k];
      wu.uOn.value[k] *= 0.9;
      if (!stripsOn || f <= 0 || !strips.isBurning(k)) { fl.visible = false; continue; }
      const iy = strips.ign[k][1];
      let ly = iy + f;
      const upward = ly < SHEET_H;
      if (!upward) ly = iy - f;
      if (ly < 0) { fl.visible = false; continue; }
      strips.point(k, 0.5, clamp(ly / SHEET_H, 0, 1), pt);
      fl.visible = true;
      fl.position.set(pt[0] + S.x, pt[1] + S.y - 0.02, pt[2] + S.z + 0.005);
      const life = clamp(f / 0.08) * (1 - seg(f, strips.dur[k] * strips.speed - 0.2, strips.dur[k] * strips.speed));
      const u = fl.userData.u;
      u.uI.value = life * (upward ? 1 : 0.6) * (0.85 + 0.15 * Math.sin(time * 23 + k));
      u.uScale.value = (upward ? 0.34 : 0.2) * (0.9 + 0.1 * Math.sin(time * 3 + k));
      u.uTime.value = time + k;
      if (upward) {
        wu.uX.value[k] = pt[0]; wu.uY.value[k] = pt[1] - 0.06;
        wu.uOn.value[k] = Math.max(wu.uOn.value[k], life);
        nBurn++; zSum += pt[2];
      }
    }
    // the wall reads once three or more strips are alight
    const wallT = stripsOn ? clamp((nBurn - 2) / 2) : 0;
    wallI += (wallT - wallI) * (1 - Math.exp(-(dt || 0.016) * 3));
    fireWall.visible = wallI > 0.01;
    if (fireWall.visible) {
      fireWall.scale.set(strips.spreadW + 0.8, strips.spreadH + 0.9, 1);
      fireWall.position.set(0, 0.1, nBurn ? zSum / nBurn - 0.12 : fireWall.position.z);
      wu.uI.value = wallI * 0.6;
      wu.uTime.value = time;
      wu.uSpread.value = strips.portrait ? 0.1 : 0.17;
      wu.uOrigin.value.set(S.x, S.y);
    }
    // fire jumping to a new strip: a burst where it catches
    if (stripsOn && !reduced) {
      for (let k = 0; k < NSTRIPS; k++) {
        const f = strips.front[k];
        if (prevFront[k] < 0 && f >= 0 && p > lastP && p - lastP < 0.02) {
          strips.point(k, 0.5, strips.ign[k][1] / SHEET_H, pt);
          const x = pt[0] + S.x, y = pt[1] + S.y, z = pt[2] + S.z;
          for (let i = 0; i < 18; i++) particles.spark(x, y, z);
          for (let i = 0; i < 10; i++) particles.flame(x, y, z, 0.1);
          audio.crackle(1); audio.crackle(1);
        }
        prevFront[k] = f;
      }
    }
    if (stripsOn && burnActive && !reduced) {
      const rate = (mobile ? 0.55 : 1) * QP[quality];
      for (let k = 0; k < NSTRIPS; k++) {
        if (!strips.isBurning(k)) continue;
        const base = k * 4;
        spawnAcc[base] += dt * 40 * rate; spawnAcc[base + 1] += dt * 7 * rate; spawnAcc[base + 2] += dt * 5 * rate; spawnAcc[base + 3] += dt * 2.2 * rate;
        while (spawnAcc[base] >= 1) { spawnAcc[base]--; if (strips.frontPoint(k, pt)) particles.flame(pt[0] + S.x, pt[1] + S.y, pt[2] + S.z + 0.01, 0.075); }
        while (spawnAcc[base + 1] >= 1) { spawnAcc[base + 1]--; if (strips.frontPoint(k, pt)) particles.ember(pt[0] + S.x, pt[1] + S.y, pt[2] + S.z); }
        while (spawnAcc[base + 2] >= 1) { spawnAcc[base + 2]--; if (strips.frontPoint(k, pt)) particles.ash(pt[0] + S.x, pt[1] + S.y, pt[2] + S.z); }
        while (spawnAcc[base + 3] >= 1) { spawnAcc[base + 3]--; if (strips.frontPoint(k, pt)) particles.smoke(pt[0] + S.x, pt[1] + S.y + 0.05, pt[2] + S.z); }
      }
    }
    // a few lingering embers drift up while the CD forms
    if (bi === BI.cd && d < 0.4 && !reduced && Math.random() < dt * 10) particles.ember(S.x + (Math.random() - 0.5) * strips.spreadW, S.y - 0.5 + Math.random() * 0.6, S.z + (Math.random() - 0.5) * 0.6);
    if (!reduced) particles.update(dt, time);

    if (DEBUG) PROF[4] += performance.now() - (PT = PT || performance.now()), PT = performance.now();
    // ---- fire light
    let fireI = 0;
    if (matchFlame > 0) { fireLight.position.copy(mb.match.position); fireLight.position.y += 0.06; fireI = matchFlame * 0.7; }
    if (burnActive) {
      let cx = 0, cy = 0, cz = 0, n = 0;
      for (let k = 0; k < NSTRIPS; k++) if (strips.isBurning(k) && strips.frontPoint(k, pt)) { cx += pt[0]; cy += pt[1]; cz += pt[2]; n++; }
      if (n) {
        fireLight.position.lerp(tA.set(cx / n + S.x, cy / n + S.y, cz / n + S.z + 0.25), matchFlame > 0 ? 0.1 : 0.25);
        fireI = Math.max(fireI, Math.min(1.6, 0.45 + burnActive * 0.18));
      }
    }
    fireI *= 0.85 + 0.15 * Math.sin(time * 17) * Math.sin(time * 5.3);
    fireLight.intensity = fireI * 0.55;
    audio.setFire(clamp(burnActive / 4) + matchFlame * 0.3);
    audio.crackle(clamp(burnActive / 5));

    if (DEBUG) PROF[5] += performance.now() - (PT = PT || performance.now()), PT = performance.now();
    // ---- CD
    const cdOn = p >= G('cd', 0.04) && ins < 0.775;
    cd.visible = cdOn;
    const cu = cd.userData.u;
    if (cdOn) {
      const form = easeOut(seg(d, 0.1, 0.55));
      const heat = 1 - seg(d, 0.3, 0.72);
      cu.uHeat.value = heat * form;
      cu.uTime.value = time;
      cu.uAlpha.value = smooth(seg(d, 0.08, 0.3));
      const flip = easeInOut(seg(d, 0.62, 0.86));
      // face the camera, spin while hot, flip to the label
      tA.copy(S);
      tA.y += Math.sin(time * 0.9) * 0.012 * (1 - ins);
      cd.position.copy(tA);
      cd.lookAt(camera.position);
      const spin = (1 - easeOut(seg(d, 0.1, 0.75))) * 9 + Math.sin(time * 0.4) * 0.04;
      qB.setFromEuler(eA.set(pointer.sy * 0.32 + 0.1, pointer.sx * 0.42 + Math.PI * flip, -spin * (1 - flip)));
      cd.quaternion.multiply(qB);
      cu.uSpin.value = spin;
      cd.scale.setScalar(Math.max(0.0001, form * (0.94 + 0.06 * (1 - heat))));
      // insert: fly to the slot, lie flat (label up), slide in
      if (ins > 0) {
        // fly to the slot mouth, wait there with the slot lit (the caption's own step), then in
        const go = easeInOut(seg(ins, 0.08, 0.36));
        const push = easeInOut(seg(ins, 0.64, 0.8));
        const hold = seg(ins, 0.3, 0.38) * (1 - seg(ins, 0.62, 0.66));
        tB.copy(L.slotW).add(tC.set(0.3, 0.08, 0.6));            // in front of the slot mouth
        tC.copy(L.slotW).add(tD.set(-0.12, 0.0, -0.5));           // inside
        tD.copy(S).lerp(tB, go);
        tD.y += Math.sin(Math.PI * go) * 0.25 + Math.sin(time * 1.7) * 0.01 * hold;
        tD.lerp(tC, push);
        cd.position.copy(tD);
        qC.setFromEuler(eA.set(Math.PI / 2 - 0.42, 0, 0));          // label up, tipped toward camera
        qA.setFromAxisAngle(tE.set(0, 0, 1), -imac.slotTilt);
        qC.premultiply(qA);
        qA.setFromAxisAngle(UP, 0.55);
        qC.premultiply(qA);
        cd.quaternion.slerp(qC, easeInOut(seg(ins, 0.06, 0.38)));
        cd.scale.setScalar(lerp(1, L.cdScale, go));
      }
    }
    // pointer-driven light on the disc
    tA.set(-0.35 + pointer.sx * 0.9, 0.55 + pointer.sy * 0.7, 0.75).applyQuaternion(camera.quaternion);
    cu.uLight.value.copy(tA);
    tA.set(0.85 - pointer.sx * 0.4, 0.1, 0.6).applyQuaternion(camera.quaternion);
    cu.uLight2.value.copy(tA);

    // motes
    const mu = motes.material.uniforms;
    motes.visible = bi === BI.cd && d < 0.7;
    mu.uProg.value = seg(d, 0, 0.62);
    mu.uTime.value = time;
    mu.uCenter.value.copy(S);
    mu.uAx.value.set(1, 0, 0).applyQuaternion(cd.quaternion);
    mu.uAy.value.set(0, 1, 0).applyQuaternion(cd.quaternion);

    if (DEBUG) PROF[6] += performance.now() - (PT = PT || performance.now()), PT = performance.now();
    // ---- iMac
    const imacVis = smooth(seg(p, G('cd', 0.4), G('insert', 0.3)));
    imac.group.visible = imacVis > 0.001;
    imac.mat.opacity = imacVis;
    const glow = easeInOut(seg(ins, 0.84, 0.98));
    const open = smooth(seg(ins, 0.26, 0.4)) * (1 - seg(ins, 0.78, 0.86)) * (0.5 + 0.12 * Math.sin(time * 3)); // slot ready while the disc waits
    imac.slotU.uGlow.value = Math.max(open, Math.sin(Math.PI * seg(ins, 0.72, 0.92)) * 0.9) + glow * 0.15;
    imac.glowU.uGlow.value = glow * 0.42;
    imac.glowU.uTime.value = time;
    screenLight.position.set(imac.group.position.x + 0.2, imac.group.position.y + 0.2, imac.group.position.z + 0.9);
    screenLight.intensity = glow * 0.35;

    }
    // ---- lights / lens per beat
    pile.setVis(1 - smooth(seg(p, G('cd', 0.55), G('insert', 0.4))));
    pile.mesh.castShadow = p < G('origami', 0.2);   // background after the envelope: skip it in the shadow pass
    const dim = easeInOut(seg(ins, 0.25, 0.85));
    key.intensity = 2.1 * (1 - 0.55 * seg(b, 0.25, 0.5) * (1 - seg(d, 0.2, 0.8))) * (1 - dim * 0.97);
    hemi.intensity = 0.3 * (1 - dim * 0.95);
    rim.intensity = 0.9 * (1 - dim);
    fillL.intensity = 0.35 * (1 - dim);
    const P = post.params;
    P.uBloom.value = lerp(lerp(0.5, 0.95, seg(b, 0.2, 0.4) * (1 - seg(d, 0.6, 1))), 0.18, dim);
    P.uVignette.value = lerp(0.9, 0.0, dim);
    P.uEdgeBlur.value = lerp(mobile ? 0.35 : 0.6, 0.0, dim);
    P.uCA.value = lerp(1.6, 0.0, dim);
    P.uGrain.value = lerp(0.032, 0.012, dim);
    P.uTime.value = time;

    if (DEBUG) PROF[7] += performance.now() - (PT = PT || performance.now()), PT = performance.now();
    // ---- camera
    const dist = camAt(p);
    const parallax = 1 - dim;
    tE.copy(camT).addScaledVector(camD, dist);
    // critically damped spring toward the scripted camera (absorbs late-asset re-layouts)
    if (camSnap || !dt || ins >= 0.95) { camP.copy(tE); camL.copy(camT); camPV.set(0, 0, 0); camLV.set(0, 0, 0); camSnap = false; }
    else {
      const K = 90, C = 2 * Math.sqrt(K), h = Math.min(dt, 1 / 30);
      camPV.addScaledVector(tA.copy(tE).sub(camP), K * h).multiplyScalar(1 - C * h); camP.addScaledVector(camPV, h);
      camLV.addScaledVector(tA.copy(camT).sub(camL), K * h).multiplyScalar(1 - C * h); camL.addScaledVector(camLV, h);
    }
    camera.position.copy(camP);
    camera.position.x += (Math.sin(time * 0.31) * 0.012 + pointer.sx * 0.05) * parallax;
    camera.position.y += (Math.sin(time * 0.23) * 0.009 + pointer.sy * 0.035) * parallax;
    camera.lookAt(camL);

    if (DEBUG) PROF[8] += performance.now() - (PT = PT || performance.now()), PT = performance.now();
    // ---- UI
    setCaption(bi);
    if (Math.abs(p - lastProgUI) > 0.0005) { lastProgUI = p; dom.prog.style.transform = `scaleX(${p.toFixed(4)})`; }
    rootEl.classList.toggle('is-scrolled', p > 0.004);
    rootEl.classList.toggle('is-end', ins > 0.6);

    // ---- sound cues
    if (Math.abs(p - lastP) < 0.08) {
      for (const [cp, name, g] of cues) {
        if (lastP < cp && p >= cp) audio.play(name, g);
        else if (lastP > cp && p <= cp && name.startsWith('paper')) audio.play(name, g * 0.5);
      }
    }
    lastP = p;

    // ---- done
    if (full && !doneCalled && ins >= 0.985 && camPV.lengthSq() < 1e-8) {
      doneCalled = true;
      camera.updateMatrixWorld();
      const a = tA.copy(imac.glassCorners[0]).applyMatrix4(imac.group.matrixWorld).project(camera);
      const bb = tB.copy(imac.glassCorners[1]).applyMatrix4(imac.group.matrixWorld).project(camera);
      const r = dom.stage.getBoundingClientRect();
      const x0 = r.left + (a.x * 0.5 + 0.5) * r.width, y0 = r.top + (-a.y * 0.5 + 0.5) * r.height;
      const x1 = r.left + (bb.x * 0.5 + 0.5) * r.width, y1 = r.top + (-bb.y * 0.5 + 0.5) * r.height;
      Object.assign(screenRect, { left: x0, top: y0, x: x0, y: y0, width: x1 - x0, height: y1 - y0, right: x1, bottom: y1 });
      const ia = tA.copy(imac.imageCorners[0]).applyMatrix4(imac.group.matrixWorld).project(camera);
      const ib = tB.copy(imac.imageCorners[1]).applyMatrix4(imac.group.matrixWorld).project(camera);
      const imageRect = {
        left: r.left + (ia.x * 0.5 + 0.5) * r.width, top: r.top + (-ia.y * 0.5 + 0.5) * r.height,
        width: (ib.x - ia.x) * 0.5 * r.width, height: (ia.y - ib.y) * 0.5 * r.height,
      };
      snap(false);
      try { onDone?.({ screenRect: { ...screenRect }, imageRect, glass: imac.glassBox }); } catch (err) { console.error(err); }
    }
  }

  const yieldFrame = () => new Promise((r) => setTimeout(r, 0));
  // compile every program (incl. shadow-depth variants) and upload every texture up front,
  // so no beat pays a first-use hitch mid-scroll
  function warmup() {
    const hidden = [];
    scene.traverse((o) => { if (!o.visible) { hidden.push(o); o.visible = true; } });
    const prevFire = fireLight.intensity, prevScreen = screenLight.intensity;
    try {
      renderer.compile(scene, camera);
      scene.traverse((o) => {
        const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        for (const m of ms) for (const k in m) { const v = m[k]; if (v && v.isTexture) renderer.initTexture(v); }
        for (const m of ms) if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k].value; if (v && v.isTexture) renderer.initTexture(v); }
      });
      for (let q = 0; q < 3; q++) { post.use(q); post.render(scene, camera); }   // warm every level's targets (+ shadow programs)
      post.use(quality);
    } catch (err) { if (DEBUG) console.warn(err); }
    hidden.forEach((o) => { o.visible = false; });
    fireLight.intensity = prevFire; screenLight.intensity = prevScreen;
  }
  async function buildRest() {
    // ------------------------------------------------------------------ deferred build
    const W = mobile ? 900 : 1400;
    const [fImg, bImg, labelImg, matchImg, imacR] = await Promise.all([
      loadImage('img/hero/cv-front.webp'), loadImage('img/hero/cv-back.webp'),
      loadImage('img/hero/matchbox-top.webp'), loadImage('img/objects/match.webp'),
      loadIMac({ height: 2.1, aniso }), fontsReady(),
    ]);
    let frontSrc = fImg, backSrc = bImg;
    if (!frontSrc || !backSrc) {
      frontCanvas = drawCVFront(W);
      frontSrc = frontCanvas;
      backSrc = drawCVBack(frontCanvas);
    }
    mark('cv');
    cvFront = canvasTex(frontSrc, aniso);
    cvBack = canvasTex(backSrc, aniso);
    cvFront.generateMipmaps = true;

    // ------------------------------------------------------------------ objects
    envelope = makeEnvelope(aniso);
    scene.add(envelope);

    sheet = new Sheet(mobile ? { nx: 46, ny: 66 } : { nx: 62, ny: 88 });
    paperMat = paperMaterial(cvFront, cvBack);
    sheetMesh = new THREE.Mesh(sheet.geo, paperMat);
    sheetMesh.castShadow = true; sheetMesh.receiveShadow = true;
    sheetMesh.frustumCulled = false;
    sheetG = new THREE.Group();
    sheetG.add(sheetMesh);
    scene.add(sheetG);

    mark('sheet');
    await yieldFrame();
    strips = new Strips({ front: cvFront, back: cvBack, mobile });
    stripsG = new THREE.Group();
    stripsG.position.copy(S);
    stripsG.add(strips.mesh, strips.flameMesh, fireWall);
    // a licking flame sprite riding each strip's leading edge
    for (let k = 0; k < NSTRIPS; k++) { const f = makeFlame(k * 1.37); f.visible = false; scene.add(f); stripFlames.push(f); }
    scene.add(stripsG);

    mark('strips');
    await yieldFrame();
    mb = makeMatchbox(aniso, labelImg);
    if (labelImg) {
      const top = mb.group.children[0].material[2];
      top.metalness = 0.55; top.roughness = 0.38;
    }
    if (matchImg) {
      const mt = canvasTex(matchImg, aniso);
      mt.offset.set(0.22, 0); mt.repeat.set(0.74, 1);
      mt.center.set(0.5, 0.5); mt.rotation = Math.PI / 2;
      mb.match.children[0].material = new THREE.MeshStandardMaterial({ map: mt, roughness: 0.85 });
      mb.match.children[1].material.color.set(0xc4553a);
    }
    scene.add(mb.group, mb.match, mb.flame);
    strikeFlash = makeFlame(9.1);
    scene.add(strikeFlash);

    cd = makeCD(drawCDLabel(mobile ? 768 : 1024), aniso);
    scene.add(cd);
    motes = makeMotes(mobile ? 420 : 1100);
    scene.add(motes);

    imac = imacR;
    imac.group.position.set(S.x + 0.1, imac.H / 2 - 0.02, IMAC_Z);
    scene.add(imac.group);


    particles = new Particles(scene, { mobile });
    angles = new Array(sheet.foldCount).fill(0);
    FOLD_FULL = sheet.fold.map((_, k) => sheet.angles[k]);
    FOLD_BASE = FOLD_FULL.slice();
    mark('rest');
    full = true;
    resize();
    warmup();
    mark('compiled');
    if (reduced) { rmKey = -1; }
    dirty = true;
  }

  // ------------------------------------------------------------------ loop
  const stats = { avg: 0, worst: 0, spikes: [] };
  let running = true, visible = true, last = performance.now(), time = 0, raf = 0;
  let rmKey = -1, rmBusy = false;
  const RM_KEYS = [G('pile', 0.5), G('envelope', 0.57), G('envelope', 0.75), G('origami', 1) - 1e-4, G('flight', 0.5), G('crumple', 0.9),
    G('shred', 1) - 1e-4, G('burn', 0.62), G('cd', 0.95), G('insert', 0.5), 1];

  // ?timer drives frames with setTimeout (for headless/hidden test panes where rAF is paused)
  const TIMER = /[?&]timer\b/.test(location.search);
  // Idle windows look fast, so on Retina screens never climb to the heaviest level (it stalls the GPU mid-scroll).
  const Q_MAX = (window.devicePixelRatio || 1) >= 2 ? 1 : 2;
  const nextFrame = TIMER ? (f) => setTimeout(() => f(performance.now()), 16) : (f) => requestAnimationFrame(f);
  function frame(now) {
    raf = nextFrame(frame);
    if (!running || !visible) { last = now; return; }
    const rawDt = (now - last) / 1000;
    const dt = Math.min(0.05, rawDt);
    // measure real frame pacing (after warm-up), with hysteresis: step down only after two slow
    // windows in a row, step back up after three fast ones; ignore windows with a scroll jump
    if (full && !TIMER && rawDt > 0.05 && rawDt < 2 && stats.spikes.length < 40) stats.spikes.push(`${prog.toFixed(3)}:${Math.round(rawDt * 1000)}ms:q${quality}`);
    if (full && !TIMER && rawDt < 0.5) {
      if (qSkip > 0) qSkip--;
      else {
        qAcc += rawDt; qN++; qWorst = Math.max(qWorst, rawDt);
        if (qN >= 120) {
          const avg = qAcc / qN;
          stats.avg = avg; stats.worst = qWorst;
          if (avg > 0.026) { qSlow++; qFast = 0; } else if (avg < 0.014 && qWorst < 0.025) { qFast++; qSlow = 0; } else { qSlow = 0; qFast = 0; }
          if (qSlow >= 2 && quality > 0) { setQuality(quality - 1); qSlow = 0; qSkip = 90; }
          else if (qFast >= 3 && quality < Q_MAX) { setQuality(quality + 1); qFast = 0; qSkip = 90; }
          qAcc = 0; qN = 0; qWorst = 0;
        }
      }
    }
    last = now;
    readScroll();
    if (reduced) {
      // crossfade path: discrete poses, no ambient motion
      const k = Math.min(RM_KEYS.length - 1, Math.floor(target * RM_KEYS.length * 0.999));
      if (k !== rmKey && !rmBusy) {
        rmBusy = true;
        const first = rmKey < 0;
        dom.fade.classList.add('is-on');
        setTimeout(() => {
          rmKey = k; prog = RM_KEYS[k];
          apply(prog, 3, 0); lastP = prog;
          post.render(scene, camera);
          dom.fade.classList.remove('is-on');
          rmBusy = false;
          onProgress?.(target);
        }, first ? 0 : 260);
      }
      if (rmKey >= 0 && !rmBusy && (dirty || pointer.x !== pointer.sx)) { pointer.sx = 0; pointer.sy = 0; apply(prog, 3, 0); post.render(scene, camera); dirty = false; }
      return;
    }
    introT += dt;
    time += dt;
    // smooth scroll (critically damped-ish), snap on big jumps (skip)
    const tgt = full ? target : Math.min(target, G('pile', 0.97));
    const diff = tgt - prog;
    if (Math.abs(diff) > 0.3) { prog = tgt; camSnap = true; qSkip = Math.max(qSkip, 30); }
    else prog += diff * (1 - Math.exp(-dt * 5.5));
    if (Math.abs(tgt - prog) < 0.00005) prog = tgt;
    pointer.sx += (pointer.x - pointer.sx) * (1 - Math.exp(-dt * 4));
    pointer.sy += (pointer.y - pointer.sy) * (1 - Math.exp(-dt * 4));
    apply(prog, time, dt);
    post.render(scene, camera);
    onProgress?.(prog);
  }

  // ------------------------------------------------------------------ lifecycle
  // GPU loss: pause, show the poster fallback; resume if the browser restores us
  let lost = false;
  dom.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; running = false; rootEl.classList.add('is-lost'); }, false);
  dom.canvas.addEventListener('webglcontextrestored', () => {
    lost = false; rootEl.classList.remove('is-lost');
    scene.traverse((o) => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; ms.forEach((m) => { for (const k in m) if (m[k]?.isTexture) m[k].needsUpdate = true; m.needsUpdate = true; }); });
    resize(); running = document.visibilityState !== 'hidden' || TIMER;
  }, false);
  const ro = new ResizeObserver(() => { resize(); layoutGrooves(); });
  ro.observe(dom.stage);
  const io = new IntersectionObserver((ents) => { visible = ents[0].isIntersecting; }, { threshold: 0 });
  io.observe(dom.track);
  const onVis = () => { running = !lost && (TIMER || document.visibilityState !== 'hidden'); };
  document.addEventListener('visibilitychange', onVis);
  resize();
  readScroll();
  prog = target;
  raf = nextFrame(frame);
  rootEl.classList.add('is-ready');
  mark('first-frame');
  // the gate waits on this: nothing heavy may run after the visitor presses Enter
  const built = new Promise((res) => setTimeout(() => buildRest().catch((err) => console.error('[hero] build failed', err)).finally(res), 60));

  // dev hooks (harmless in prod)
  const emptyScene = new THREE.Scene();
  // hands-on mode (drag to fold/shred/strike, pick a fold) is switched off: Sameep wants scroll or
  // "Play it for me" only. hands.js stays in the repo; flip HANDS to bring it back.
  const HANDS = false;
  if (HANDS && !isLow && !reduced && groovesOn) {
    hands = makeHands({
      stage: dom.stage, camera, THREE, reduced,
      grooves: () => gTop, isBusy: () => gBusy, glide,
      style: () => foldStyle, onStyle: (k) => setFoldStyle(k),
      world: {
        paper: () => sheetG?.position, box: () => mb?.group.position, match: () => mb?.match.position,
        strips: () => L.stripsC, cd: () => cd?.position, slot: () => L.slotW,
      },
    });
  }
  const api = {
    built,
    stats: () => ({ avg: stats.avg, worst: stats.worst, spikes: stats.spikes.slice(), quality }),
    beats: BEATS.map(({ id, a, b }) => ({ id, a, b })),
    // voice and hands: one groove on (1) or back (-1), or glide to a named pose (same path scroll takes)
    step(dir) { if (gLive) go(dir); },
    goto(name) {
      const i = { pile: 0, envelope: 3, mine: 3, fold: 4, plane: 4, fly: 5, crumple: 6, shred: 7, strike: 8, match: 8, burn: 9, cd: 10, slot: 11, insert: 12 }[name];
      if (i === undefined || !gLive) return false;
      layoutGrooves(); glide(gTop[i]); return true;
    },
    foldStyle(k) {
      if (!setFoldStyle(k)) return false;
      if (api.groove < 4) api.goto('fold');
      return true;
    },
    get groove() { const y = scrollY; return gTop.reduce((a, t, i) => (Math.abs(t - y) < Math.abs(gTop[a] - y) ? i : a), 0); },
    jump(p) {
      const top = dom.track.getBoundingClientRect().top + scrollY + p * (dom.track.offsetHeight - dom.stage.clientHeight);
      scrollTo({ top, behavior: 'instant' }); readScroll(); prog = target; camSnap = true;
    },
    // dev: advance n frames at fixed dt at progress p, render, return a JPEG data URL of the canvas
    async shot(p, { frames = 20, dt = 1 / 60 } = {}) {
      api.jump(p);
      for (let i = 0; i < frames; i++) { introT += dt; time += dt; prog = target; apply(prog, time, dt); }
      post.render(scene, camera);
      return dom.canvas.toDataURL('image/jpeg', 0.82);
    },
    // dev: synchronous frame-cost benchmark (apply + render + 1px readback to wait for the GPU)
    bench(p0 = 0, p1 = 1, n = 600) {
      const gl = renderer.getContext(), px = new Uint8Array(4), out = [];
      for (let i = 0; i < n; i++) {
        const t0 = performance.now();
        prog = p0 + (p1 - p0) * (i / (n - 1)); time += 1 / 60; introT += 1 / 60;
        apply(prog, time, 1 / 60);
        if (api.dbgMode === 'scene') { renderer.setRenderTarget(null); renderer.render(scene, camera); }
        else if (api.dbgMode === 'post') { post.render(emptyScene, camera); }
        else if (api.dbgMode !== 'cpu') post.render(scene, camera);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        out.push(performance.now() - t0);
      }
      const s = out.slice().sort((a, b) => a - b);
      const spikes = out.map((v, i) => [v, +(p0 + (p1 - p0) * (i / (n - 1))).toFixed(3)]).filter(([v]) => v > 30).map(([v, pp]) => pp + ':' + v.toFixed(0));
      return { avg: +(out.reduce((a, b) => a + b, 0) / n).toFixed(2), p95: +s[Math.floor(n * 0.95)].toFixed(2), worst: +s[n - 1].toFixed(2), dpr: +levelDpr[quality].toFixed(2), quality, spikes };
    },
    exportCV: () => {
      const f = drawCVFront(1400);
      return { front: f.toDataURL('image/webp', 0.86), back: drawCVBack(f).toDataURL('image/webp', 0.86) };
    },
    dispose() { api.destroy(); },
    destroy() {
      if (api.destroyed) return; api.destroyed = true;
      cancelAnimationFrame(raf); clearTimeout(raf); ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      removeEventListener('scroll', readScroll);
      snap(false);
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        ms.forEach((m) => { for (const k in m) if (m[k]?.isTexture) m[k].dispose(); m.dispose(); });
      });
      Object.values(post).forEach(() => {});
      post.dispose(); renderer.dispose(); renderer.forceContextLoss?.();
      audio.dispose?.();
      hands?.destroy();
      if (window.__hero === api) window.__hero = null;
    },
  };
  if (DEBUG || TIMER) api.dbg = { renderer, post, key, pile, scene, resize, setQuality, setDpr: (d) => { renderer.setPixelRatio(d); renderer.setSize(vw, vh, false); post.setSize(vw, vh, d); } };
  window.__hero = api;
  return api;
}
