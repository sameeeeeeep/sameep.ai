// The Bondi iMac: a camera-facing plane carrying img/imac/imac-front.webp (the same image boot.js
// zooms into), or a drawn placeholder with the same framing. Plus the CRT glow on the glass.
import * as THREE from '../../vendor/three.module.min.js';
import { drawIMacPlaceholder } from './textures.js';

const GLOW_FRAG = /* glsl */`
uniform float uGlow; uniform float uTime;
varying vec2 vUv;
void main(){
  vec2 c = vUv - 0.5;
  float r = length(c * vec2(1.0, 0.85));
  float scan = 0.86 + 0.14 * sin(vUv.y * 380.0);
  float roll = 0.93 + 0.07 * sin(vUv.y * 5.0 - uTime * 1.6);
  float body = smoothstep(0.75, 0.05, r);
  float edge = smoothstep(0.5, 0.44, abs(c.x)) * smoothstep(0.5, 0.44, abs(c.y));
  vec3 col = vec3(0.62, 1.0, 0.86) * (0.22 + 0.78 * body) * scan * roll * edge;
  gl_FragColor = vec4(col * uGlow, 1.0);
}`;
const GLOW_VERT = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// Measured on img/imac/imac-front.webp (1388×1096, 3/4 view). Manifest values win.
const PHOTO = {
  quad: [[0.355, 0.146], [0.762, 0.162], [0.806, 0.674], [0.403, 0.727]], // TL TR BR BL
  slot: { x: 0.638, y: 0.792, w: 0.195, tilt: 0.065 },
};
const DRAWN = {
  quad: [[0.215, 0.135], [0.785, 0.135], [0.785, 0.565], [0.215, 0.565]],
  slot: { x: 0.5, y: 0.7, w: 0.3, tilt: 0 },
};

export async function loadIMac({ height = 2.1, aniso = 4 } = {}) {
  let manifest = null;
  try {
    const r = await fetch('img/manifest.json', { cache: 'no-cache' });
    if (r.ok) manifest = await r.json();
  } catch { /* none */ }

  const img = await new Promise((res) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = 'img/imac/imac-front.webp';
  });
  const base = img ? PHOTO : DRAWN;
  let quad = base.quad.map((p) => p.slice());
  let slot = { ...base.slot };
  const m = manifest?.imac;
  if (m?.screenQuad && m.screenQuad.length === 4) quad = m.screenQuad;
  else if (m?.screen) {
    const s = Array.isArray(m.screen) ? { x: m.screen[0], y: m.screen[1], w: m.screen[2], h: m.screen[3] } : m.screen;
    if (typeof s.x === 'number' && !img) quad = [[s.x, s.y], [s.x + s.w, s.y], [s.x + s.w, s.y + s.h], [s.x, s.y + s.h]];
  }
  if (m?.slot) {
    const sl = Array.isArray(m.slot) ? { x: m.slot[0], y: m.slot[1], w: m.slot[2] } : m.slot;
    slot = { ...slot, ...Object.fromEntries(Object.entries(sl).filter(([, v]) => typeof v === 'number')) };
  }
  const xs = quad.map((p) => p[0]), ys = quad.map((p) => p[1]);
  const bbox = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };

  const source = img || drawIMacPlaceholder(1600, 1400, bbox, slot);
  const iw = img ? img.naturalWidth : 1600, ih = img ? img.naturalHeight : 1400;
  const t = new THREE.Texture(source);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; t.needsUpdate = true;
  const W = height * iw / ih, H = height;
  const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: true, fog: false, opacity: 0, alphaTest: 0.02 });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
  plane.renderOrder = 10;

  const L = (u, v, z = 0) => new THREE.Vector3((u - 0.5) * W, (0.5 - v) * H, z);
  const qg = new THREE.BufferGeometry();
  const P = quad.map(([u, v]) => L(u, v, 0.002));
  qg.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    P[3].x, P[3].y, P[3].z, P[2].x, P[2].y, P[2].z, P[1].x, P[1].y, P[1].z, P[0].x, P[0].y, P[0].z]), 3));
  qg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
  qg.setIndex([0, 1, 2, 0, 2, 3]);
  const glowU = { uGlow: { value: 0 }, uTime: { value: 0 } };
  const glow = new THREE.Mesh(qg, new THREE.ShaderMaterial({
    vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, uniforms: glowU,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  glow.renderOrder = 11;
  glow.frustumCulled = false;
  // slot light: a soft pulse along the slot mouth as the disc is taken in
  const slotU = { uGlow: { value: 0 } };
  const slotGlow = new THREE.Mesh(new THREE.PlaneGeometry(slot.w * W * 1.0, 0.06), new THREE.ShaderMaterial({
    vertexShader: GLOW_VERT,
    fragmentShader: /* glsl */`uniform float uGlow; varying vec2 vUv;
      void main(){ vec2 c = (vUv - 0.5) * vec2(2.0, 2.0); float d = c.x * c.x * c.x * c.x * 1.6 + c.y * c.y * 3.0;
        gl_FragColor = vec4(vec3(0.55, 1.0, 0.9) * exp(-d * 2.2) * uGlow, 1.0); }`,
    uniforms: slotU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  slotGlow.position.copy(L(slot.x, slot.y, 0.004));
  slotGlow.rotation.z = (slot.tilt || 0);
  slotGlow.renderOrder = 12;
  const g = new THREE.Group();
  g.add(plane, glow, slotGlow);
  return {
    group: g, plane, mat, glowU, slotU, W, H, hasImage: !!img,
    slotLocal: L(slot.x, slot.y), slotW: slot.w * W, slotTilt: slot.tilt || 0,
    glassCorners: [L(bbox.x, bbox.y), L(bbox.x + bbox.w, bbox.y + bbox.h)],
    imageCorners: [L(0, 0), L(1, 1)],
    glassBox: bbox,
  };
}
