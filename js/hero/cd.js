// The CD-R: diffraction-grating rainbow + thin-film dye + hub + Sharpie label,
// and the GPU "motes" that collapse from the fire into the disc.
import * as THREE from '../../vendor/three.module.min.js';
import { mulberry32 } from './util.js';

export const CD_R = 0.3;

const DISC_VERT = /* glsl */`
varying vec3 vPos; varying vec3 vN; varying vec3 vRad; varying float vR; varying vec2 vXY;
void main(){
  vXY = position.xy / ${CD_R.toFixed(3)};
  vR = length(vXY);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPos = wp.xyz;
  vN = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
  vRad = normalize(mat3(modelMatrix) * vec3(normalize(position.xy + 1e-5), 0.0));
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const DISC_FRAG = /* glsl */`
uniform vec3 uLight; uniform vec3 uLight2; uniform float uTime; uniform float uHeat; uniform float uAlpha; uniform float uSpin;
varying vec3 vPos; varying vec3 vN; varying vec3 vRad; varying float vR; varying vec2 vXY;
vec3 bump3y(vec3 x, vec3 yo){ vec3 y = 1.0 - x * x; return clamp(y - yo, 0.0, 1.0); }
vec3 spectral(float w){
  if (w < 400.0 || w > 700.0) return vec3(0.0);
  float x = (w - 400.0) / 300.0;
  const vec3 c1 = vec3(3.54585104, 2.93225262, 2.41593945), x1 = vec3(0.69549072, 0.49228336, 0.27699880), y1 = vec3(0.02312639, 0.15225084, 0.52607955);
  const vec3 c2 = vec3(3.90307140, 3.21182957, 3.96587128), x2 = vec3(0.11748627, 0.86755042, 0.66077860), y2 = vec3(0.84897130, 0.88445281, 0.73949448);
  return bump3y(c1 * (x - x1), y1) + bump3y(c2 * (x - x2), y2);
}
vec3 grating(vec3 R, vec3 T, vec3 L, vec3 V){
  float u = abs(dot(R, L) + dot(R, V));
  float tl = dot(T, L) + dot(T, V);
  float lobe = exp(-tl * tl * 7.0);
  vec3 c = vec3(0.0);
  for (int m = 1; m <= 3; m++) c += spectral(u * 1600.0 / float(m));
  return c * lobe;
}
void main(){
  vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vPos);
  if (dot(N, V) < 0.0) N = -N;
  vec3 R = normalize(vRad - N * dot(vRad, N));
  vec3 T = normalize(cross(N, R));
  vec3 L = normalize(uLight), L2 = normalize(uLight2);
  vec3 Rv = reflect(-V, N);
  // studio env: dark room with two softboxes
  float sb = smoothstep(0.75, 0.98, dot(Rv, L)) * 2.2 + smoothstep(0.85, 0.99, dot(Rv, L2)) * 1.1;
  vec3 env = mix(vec3(0.018, 0.016, 0.015), vec3(0.32, 0.3, 0.28), smoothstep(-0.2, 0.9, Rv.y)) + vec3(1.0, 0.95, 0.88) * sb;
  vec3 diff = grating(R, T, L, V) * 1.5 + grating(R, T, L2, V) * 0.6;
  float r = vR;
  float ct = abs(dot(N, V));
  vec3 film = 0.5 + 0.5 * cos(6.2832 * (vec3(0.0, 0.33, 0.67) + 1.7 * ct + r * 2.1 + uSpin * 0.05));
  vec3 col; float a = 1.0;
  if (r < 0.31) {               // clear polycarbonate hub
    float ring = smoothstep(0.012, 0.0, abs(r - 0.25)) * 0.6 + smoothstep(0.01, 0.0, abs(r - 0.3)) * 0.5;
    col = env * 0.35 + vec3(0.6, 0.65, 0.7) * ring * (0.4 + sb);
    a = 0.42 + ring * 0.4;
  } else if (r < 0.37) {        // mirror band
    col = env * 0.85 + diff * 0.5;
  } else if (r < 0.985) {       // dye + data
    vec3 dye = vec3(0.16, 0.42, 0.40) * (0.65 + 0.35 * film);
    float burned = smoothstep(0.79, 0.785, r);
    dye = mix(dye, dye * vec3(0.62, 0.7, 0.85), burned * 0.8);
    col = dye * (0.25 + env * 0.9) + diff * (1.0 - burned * 0.15) + film * 0.035 * sb;
    col += vec3(0.04) * smoothstep(0.004, 0.0, abs(r - 0.79));
  } else {                      // clear rim
    col = env * 0.5 + diff * 0.2; a = 0.65;
  }
  // heat from the fire it was born in
  float rings = 0.5 + 0.5 * sin(r * 60.0 - uTime * 3.0);
  col += vec3(3.2, 0.9, 0.18) * uHeat * (0.5 + 0.5 * rings) * smoothstep(0.2, 0.9, r);
  gl_FragColor = vec4(col, a * uAlpha);
}`;

export function makeCD(labelCanvas, aniso) {
  const g = new THREE.Group();
  const u = {
    uLight: { value: new THREE.Vector3(-0.4, 0.7, 0.8) }, uLight2: { value: new THREE.Vector3(0.8, 0.2, 0.6) },
    uTime: { value: 0 }, uHeat: { value: 0 }, uAlpha: { value: 1 }, uSpin: { value: 0 },
  };
  const ring = new THREE.RingGeometry(CD_R * 0.125, CD_R, 160, 4);
  const data = new THREE.Mesh(ring, new THREE.ShaderMaterial({
    vertexShader: DISC_VERT, fragmentShader: DISC_FRAG, uniforms: u, transparent: true, side: THREE.FrontSide,
  }));
  data.position.z = 0.0012;
  const lt = new THREE.CanvasTexture(labelCanvas);
  lt.colorSpace = THREE.SRGBColorSpace; lt.anisotropy = aniso;
  const labelMat = new THREE.MeshStandardMaterial({ map: lt, metalness: 0.35, roughness: 0.42, transparent: true });
  const label = new THREE.Mesh(ring, labelMat);
  label.rotation.y = Math.PI;
  label.position.z = -0.0012;
  // label UVs: ring uv is planar; flip u so text reads correctly from the back
  const edge = new THREE.Mesh(new THREE.CylinderGeometry(CD_R, CD_R, 0.0024, 160, 1, true), new THREE.MeshStandardMaterial({ color: 0xa8b4b8, metalness: 0.6, roughness: 0.3 }));
  edge.rotation.x = Math.PI / 2;
  g.add(data, label, edge);
  data.renderOrder = 2; label.renderOrder = 2;
  g.userData = { u, labelMat, data, label };
  return g;
}

// motes: light that spirals from the fire into the disc (GPU, deterministic in progress)
const MOTE_VERT = /* glsl */`
attribute vec3 aStart; attribute vec4 aSeed;
uniform float uProg; uniform float uTime; uniform vec3 uCenter; uniform vec3 uAx; uniform vec3 uAy; uniform float uScale;
varying vec4 vCol;
void main(){
  float t = clamp((uProg - aSeed.z * 0.38) / 0.62, 0.0, 1.0);
  float e = 1.0 - pow(1.0 - t, 3.0);
  float ang = aSeed.x + (1.0 - e) * 5.0 + uTime * 0.3;
  vec3 target = uCenter + (uAx * cos(ang) + uAy * sin(ang)) * aSeed.y * ${CD_R.toFixed(3)};
  vec3 rel = aStart - uCenter;
  float sw = (1.0 - e) * 2.4;
  vec3 axis = normalize(cross(uAx, uAy));
  rel = rel * cos(sw) + cross(axis, rel) * sin(sw) + axis * dot(axis, rel) * (1.0 - cos(sw));
  vec3 p = mix(uCenter + rel, target, e);
  p.y += sin(uTime * 1.3 + aSeed.x * 4.0) * 0.02 * (1.0 - e);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float a = smoothstep(0.0, 0.08, uProg) * (1.0 - smoothstep(0.82, 1.0, t));
  gl_PointSize = max(1.0, aSeed.w * uScale / -mv.z * (1.0 + (1.0 - e)));
  vec3 hot = vec3(3.6, 1.2, 0.25);
  vec3 iri = 0.6 + 0.6 * cos(6.2832 * (vec3(0.0, 0.33, 0.67) + aSeed.x * 0.16));
  vCol = vec4(mix(hot, iri * 2.2, smoothstep(0.35, 0.9, e)), a);
}`;
const MOTE_FRAG = /* glsl */`
varying vec4 vCol;
void main(){ vec2 c = gl_PointCoord - 0.5; float d = dot(c,c) * 4.0; gl_FragColor = vec4(vCol.rgb * exp(-d * 3.5) * vCol.a, 1.0); }`;

export function makeMotes(n) {
  const r = mulberry32(55);
  const start = new Float32Array(n * 3), seed = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    seed[i * 4] = r() * Math.PI * 2;
    seed[i * 4 + 1] = 0.16 + Math.sqrt(r()) * 0.82;
    seed[i * 4 + 2] = r();
    seed[i * 4 + 3] = 0.008 + r() * 0.016;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('aStart', new THREE.BufferAttribute(start, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);
  const u = {
    uProg: { value: 0 }, uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() },
    uAx: { value: new THREE.Vector3(1, 0, 0) }, uAy: { value: new THREE.Vector3(0, 1, 0) }, uScale: { value: 600 },
  };
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({
    vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG, uniforms: u,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  pts.frustumCulled = false;
  pts.renderOrder = 7;
  pts.userData = { u, start, r };
  return pts;
}

// scatter the motes' start positions over the area where the strips burned
export function seedMotes(pts, cx, cy, cz, w, h) {
  const { start, r } = pts.userData;
  const n = start.length / 3;
  const rr = mulberry32(91);
  for (let i = 0; i < n; i++) {
    start[i * 3] = cx + (rr() - 0.5) * w;
    start[i * 3 + 1] = cy + (rr() - 0.35) * h;
    start[i * 3 + 2] = cz + (rr() - 0.5) * 0.9;
  }
  void r;
  pts.geometry.attributes.aStart.needsUpdate = true;
}
