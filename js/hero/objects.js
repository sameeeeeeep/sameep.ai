// Envelope, matchbox + match (with flame shader).
import * as THREE from '../../vendor/three.module.min.js';
import { drawKraft, drawMatchLabel, drawStriker, drawCard } from './textures.js';
import { GLSL_NOISE } from './util.js';

export const ENV_W = 1.12, ENV_H = 1.56;

function tex(canvas, aniso = 4) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

export function makeEnvelope(aniso) {
  const g = new THREE.Group();
  const front = tex(drawKraft(768, 1070, 'front'), aniso);
  const back = tex(drawKraft(768, 1070, 'back'), aniso);
  const inside = tex(drawKraft(256, 356, 'inside'), aniso);
  const mk = (map, z, flip) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(ENV_W, ENV_H), new THREE.MeshStandardMaterial({ map, roughness: 0.92 }));
    m.position.z = z; if (flip) m.rotation.y = Math.PI;
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };
  g.add(mk(front, 0.009, false), mk(inside, 0.007, true), mk(back, -0.009, true), mk(inside, -0.007, false));
  // open flap on the back, leaning away
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-ENV_W / 2, 0, 0, ENV_W / 2, 0, 0, 0, 0.5, 0]), 3));
  fg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 1, 1, 1, 0.5, 0.6]), 2));
  fg.computeVertexNormals();
  const flap = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: back, side: THREE.DoubleSide, roughness: 0.92 }));
  flap.position.set(0, ENV_H / 2, -0.009);
  flap.rotation.x = -0.32;
  flap.castShadow = true;
  g.add(flap);
  // side seams (thickness)
  const seam = new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.95 });
  for (const sx of [-1, 1]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.006, ENV_H, 0.018), seam);
    s.position.x = sx * ENV_W / 2; g.add(s);
  }
  const bot = new THREE.Mesh(new THREE.BoxGeometry(ENV_W, 0.006, 0.018), seam);
  bot.position.y = -ENV_H / 2; g.add(bot);
  return g;
}

// ------------------------------------------------------------------------- flame
const FLAME_VERT = /* glsl */`
uniform float uScale;
varying vec2 vUv;
void main(){
  vUv = uv;
  vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  c.xy += position.xy * uScale;
  gl_Position = projectionMatrix * c;
}`;
const FLAME_FRAG = /* glsl */`
uniform float uTime; uniform float uI; uniform float uSeed;
varying vec2 vUv;
${GLSL_NOISE}
void main(){
  float y = vUv.y;
  float x = (vUv.x - 0.5) * 2.0;
  float n = fbm2(vec2(x * 1.4 + uSeed, y * 2.4 - uTime * 3.1));
  float n2 = vnoise(vec2(uTime * 6.0 + uSeed, 0.5));
  x += (n - 0.5) * 0.9 * y * y + (n2 - 0.5) * 0.12 * y;
  float width = 0.62 * pow(max(1.0 - y, 0.0), 0.75) * smoothstep(-0.06, 0.2, y);
  float body = 1.0 - smoothstep(width * 0.45, width + 0.02, abs(x));
  float tip = 0.78 + (n - 0.5) * 0.35;
  body *= smoothstep(0.0, 0.06, y) * (1.0 - smoothstep(tip - 0.25, tip, y));
  float core = (1.0 - smoothstep(0.0, width * 0.6, abs(x))) * (1.0 - smoothstep(0.12, 0.5, y)) * smoothstep(0.03, 0.12, y);
  vec3 col = mix(vec3(2.4, 0.62, 0.1), vec3(3.4, 2.3, 1.0), core);
  float blue = (1.0 - smoothstep(0.02, 0.2, y)) * (1.0 - smoothstep(0.0, width * 0.9, abs(x)));
  col = mix(col, vec3(0.25, 0.45, 1.8), blue * 0.75);
  gl_FragColor = vec4(col * body * uI, 1.0);
}`;

export function makeFlame(seed = 0) {
  const geo = new THREE.PlaneGeometry(0.5, 1, 1, 1);
  geo.translate(0, 0.5, 0);
  const u = { uTime: { value: 0 }, uI: { value: 0 }, uSeed: { value: seed }, uScale: { value: 0.1 } };
  const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    vertexShader: FLAME_VERT, fragmentShader: FLAME_FRAG, uniforms: u,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  m.frustumCulled = false;
  m.renderOrder = 6;
  m.userData.u = u;
  return m;
}

// ------------------------------------------------------------------------- matchbox
export const BOX = { L: 0.34, T: 0.07, W: 0.235 };

export function makeMatchbox(aniso, labelImg) {
  const { L, T, W } = BOX;
  const group = new THREE.Group();
  const label = tex(labelImg || drawMatchLabel(), aniso);
  const striker = tex(drawStriker(), aniso);
  const card = tex(drawCard(256, 256, '#cdb68c', 12), aniso);
  const inner = tex(drawCard(256, 256, '#e3d3b2', 13), aniso);
  const hidden = new THREE.MeshBasicMaterial({ visible: false });
  const sleeveMats = [
    hidden, hidden,
    new THREE.MeshStandardMaterial({ map: label, roughness: 0.6 }),
    new THREE.MeshStandardMaterial({ map: card, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ map: striker, roughness: 1 }),
    new THREE.MeshStandardMaterial({ map: striker, roughness: 1 }),
  ];
  const sleeve = new THREE.Mesh(new THREE.BoxGeometry(L, T, W), sleeveMats);
  sleeve.position.y = T / 2;
  sleeve.castShadow = true; sleeve.receiveShadow = true;
  group.add(sleeve);
  // tray: open-topped box (double-sided so the inside reads)
  const trayMat = new THREE.MeshStandardMaterial({ map: inner, roughness: 0.9, side: THREE.DoubleSide });
  const tray = new THREE.Mesh(new THREE.BoxGeometry(L * 0.97, T * 0.86, W * 0.94), [trayMat, trayMat, hidden, trayMat, trayMat, trayMat]);
  tray.castShadow = true; tray.receiveShadow = true;
  const trayG = new THREE.Group();
  trayG.position.y = T * 0.45;
  trayG.add(tray);
  // matches lying in the tray
  const stickGeo = new THREE.BoxGeometry(L * 0.86, 0.011, 0.011);
  const headGeo = new THREE.SphereGeometry(0.012, 12, 8); headGeo.scale(1.5, 1, 1);
  const wood = new THREE.MeshStandardMaterial({ color: 0xd9b98a, roughness: 0.8 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0x8e1d14, roughness: 0.55 });
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Mesh(stickGeo, wood);
    const z = -W * 0.38 + (i / 8) * W * 0.76;
    s.position.set(0, -T * 0.16 + (i % 2) * 0.011, z);
    s.rotation.y = (Math.sin(i * 7.1)) * 0.03;
    const h = new THREE.Mesh(headGeo, headMat);
    h.position.set(-L * 0.43, s.position.y, z);
    trayG.add(s, h);
  }
  group.add(trayG);

  // the match we strike (pivot at the head; stick along +y)
  const match = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.BoxGeometry(0.011, L * 0.86, 0.011), wood);
  stick.position.y = L * 0.43; stick.castShadow = true;
  const headM = new THREE.MeshStandardMaterial({ color: 0x8e1d14, roughness: 0.55, emissive: 0xff5a1a, emissiveIntensity: 0 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.0125, 16, 12), headM);
  head.scale.set(1.05, 1.6, 1.05); head.castShadow = true;
  const char = new THREE.Mesh(new THREE.BoxGeometry(0.0118, 0.001, 0.0118), new THREE.MeshStandardMaterial({ color: 0x120c08, roughness: 1 }));
  char.position.y = 0.0;
  match.add(stick, head, char);
  const flame = makeFlame(3.7);
  return { group, tray: trayG, match, matchHead: headM, char, flame };
}
