// The single CV sheet: a subdivided plane deformed on the CPU.
// - rigid origami folds (vertex groups rotated about fold lines, in sequence)
// - crumple into a ball (octahedral wrap + ridged noise, staggered per vertex)
// - uncrumple to a flat sheet that keeps its creases
import * as THREE from '../../vendor/three.module.min.js';
import { clamp, smooth, noise3, ridged3, fbm3, fastNormals } from './util.js';

export const SHEET_W = 1;
export const SHEET_H = 1.4142;

export function paperMaterial(front, back, extra = {}) {
  const mat = new THREE.MeshStandardMaterial({
    map: front, side: THREE.DoubleSide, roughness: 0.82, metalness: 0, ...extra,
  });
  const uniforms = { uBack: { value: back }, uFacet: { value: 0.8 }, uAOAmt: { value: 0 }, uWarm: { value: 0 } };
  mat.userData.u = uniforms;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aAO;\nvarying float vAO;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAO = aAO;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uBack; uniform float uFacet; uniform float uAOAmt; uniform float uWarm; varying float vAO;')
      .replace('#include <map_fragment>', `
#ifdef USE_MAP
  vec4 sampledDiffuseColor = gl_FrontFacing ? texture2D(map, vMapUv) : texture2D(uBack, vec2(1.0 - vMapUv.x, vMapUv.y));
  diffuseColor *= sampledDiffuseColor;
#endif
  diffuseColor.rgb *= mix(1.0, vAO, uAOAmt);`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
  vec3 fN = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
  fN = faceforward(fN, -vViewPosition, fN);
  normal = normalize(mix(normal, fN, uFacet));`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += diffuseColor.rgb * uWarm * vec3(1.0, 0.45, 0.18);`);
  };
  mat.customProgramCacheKey = () => 'paper-v1';
  return mat;
}

export function gridGeometry(nx, ny, w, h) {
  const vx = nx + 1, vy = ny + 1, n = vx * vy;
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), ao = new Float32Array(n).fill(1);
  for (let j = 0; j < vy; j++) for (let i = 0; i < vx; i++) {
    const k = j * vx + i;
    pos[k * 3] = (i / nx - 0.5) * w; pos[k * 3 + 1] = (j / ny - 0.5) * h; pos[k * 3 + 2] = 0;
    uv[k * 2] = i / nx; uv[k * 2 + 1] = j / ny;
  }
  const idx = new (n > 65535 ? Uint32Array : Uint16Array)(nx * ny * 6);
  let t = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * vx + i, b = a + 1, c = a + vx, d = c + 1;
    idx[t++] = a; idx[t++] = b; idx[t++] = d; idx[t++] = a; idx[t++] = d; idx[t++] = c;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('aAO', new THREE.BufferAttribute(ao, 1).setUsage(THREE.DynamicDrawUsage));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);
  return g;
}

const D = Math.PI / 180;
const r2 = (x, y) => { const l = Math.hypot(x, y); return [x / l, y / l]; };
const HY = SHEET_H / 2;

// Dart plane. Lines are given in the flat state left by the previous (completed) folds.
// dir: which side of the sheet (local z) the flap swings toward.
const FOLDS = [
  { id: 'A', P: [0, HY], U: r2(-0.5, -0.5), rep: [-0.45, HY - 0.05], dir: -1, full: 178 * D },
  { id: 'B', P: [0, HY], U: r2(0.5, -0.5), rep: [0.45, HY - 0.05], dir: -1, full: 178 * D },
  { id: 'C', P: [0, HY], U: r2(-0.5, -(HY + 0.5)), rep: [-0.46, -0.1], dir: -1, full: 177 * D },
  { id: 'D', P: [0, HY], U: r2(0.5, -(HY + 0.5)), rep: [0.46, -0.1], dir: -1, full: 177 * D },
  { id: 'E', P: [0, 0], U: [0, 1], rep: [0.3, 0], dir: 1, full: 174 * D },
  { id: 'FL', P: [-0.13, 0], U: [0, 1], rep: [-0.3, 0], dir: -1, full: 92 * D, half: -1 },
  { id: 'FR', P: [-0.13, 0], U: [0, 1], rep: [-0.3, 0], dir: 1, full: 92 * D, half: 1 },
];

export class Sheet {
  constructor({ nx = 72, ny = 102 } = {}) {
    this.nx = nx; this.ny = ny;
    this.geo = gridGeometry(nx, ny, SHEET_W, SHEET_H);
    this.n = (nx + 1) * (ny + 1);
    const pos = this.geo.attributes.position.array;
    this.rest = pos.slice();
    this.out = pos;
    this.ao = this.geo.attributes.aAO.array;
    this._prepFolds();
    this.folded = new Float32Array(this.n * 3);
    this.angles = FOLDS.map((f) => f.full);
    this._fold(this.angles, this.folded);
    this._prepBall();
    this._prepFlat();
    this.mode = '';
  }

  get foldCount() { return FOLDS.length; }

  _prepFolds() {
    const n = this.n, rest = this.rest;
    const fx = new Float32Array(n), fy = new Float32Array(n);
    for (let v = 0; v < n; v++) { fx[v] = rest[v * 3]; fy[v] = rest[v * 3 + 1]; }
    const eps = 0.006;
    this.fold = FOLDS.map((f) => {
      const [px, py] = f.P, [ux, uy] = f.U;
      const sd = (x, y) => (x - px) * uy - (y - py) * ux; // signed distance to line
      const repSide = Math.sign(sd(f.rep[0], f.rep[1]));
      const w = new Float32Array(n);
      for (let v = 0; v < n; v++) {
        if (f.half && Math.sign(rest[v * 3] || 1e-6) !== f.half) continue;
        const d = sd(fx[v], fy[v]) * repSide;
        w[v] = d > eps ? 1 : d < -eps ? 0 : smooth((d + eps) / (2 * eps));
      }
      // sign so the flap swings toward f.dir
      const vx = f.rep[0] - px, vy = f.rep[1] - py;
      // rotate rep by small +angle; z' = sin(a) * (u × v).z
      const cz = ux * vy - uy * vx;
      const sign = Math.sign(cz) === Math.sign(f.dir) ? 1 : -1;
      // advance the flat state (reflect members across the line)
      for (let v = 0; v < n; v++) {
        if (w[v] < 0.5) continue;
        const dx = fx[v] - px, dy = fy[v] - py;
        const along = dx * ux + dy * uy;
        const rx = px + ux * along, ry = py + uy * along;
        fx[v] = 2 * rx - fx[v]; fy[v] = 2 * ry - fy[v];
      }
      return { px, py, ux, uy, w, sign };
    });
  }

  _fold(angles, out) {
    const n = this.n, rest = this.rest;
    out.set(rest);
    for (let k = 0; k < this.fold.length; k++) {
      const a = angles[k];
      if (a <= 1e-4) continue;
      const { px, py, ux, uy, w, sign } = this.fold[k];
      const A = a * sign, ca = Math.cos(A), sa = Math.sin(A);
      for (let v = 0; v < n; v++) {
        const wv = w[v];
        if (wv === 0) continue;
        let c = ca, s = sa;
        if (wv < 1) { c = Math.cos(A * wv); s = Math.sin(A * wv); }
        const i = v * 3;
        const x = out[i] - px, y = out[i + 1] - py, z = out[i + 2];
        const dot = ux * x + uy * y;
        // Rodrigues with axis u=(ux,uy,0): u×v = (uy*z, -ux*z, ux*y - uy*x)
        out[i] = px + x * c + uy * z * s + ux * dot * (1 - c);
        out[i + 1] = py + y * c - ux * z * s + uy * dot * (1 - c);
        out[i + 2] = z * c + (ux * y - uy * x) * s;
      }
    }
  }

  _prepBall() {
    const n = this.n, nx = this.nx, ny = this.ny;
    this.ball = new Float32Array(n * 3);
    this.aoBall = new Float32Array(n);
    this.crinkle = new Float32Array(n * 3);
    this.lag = new Float32Array(n);
    // centre of the folded plane
    let cx = 0, cy = 0, cz = 0;
    for (let v = 0; v < n; v++) { cx += this.folded[v * 3]; cy += this.folded[v * 3 + 1]; cz += this.folded[v * 3 + 2]; }
    cx /= n; cy /= n; cz /= n;
    this.ballCenter = [cx, cy, cz];
    const R = 0.21;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
      const v = j * (nx + 1) + i;
      let u = (i / nx) * 2 - 1, w = (j / ny) * 2 - 1;
      // octahedral wrap of the square onto a sphere (seamless)
      let x = u, y = w, z = 1 - Math.abs(u) - Math.abs(w);
      if (z < 0) { const ox = x; x = (1 - Math.abs(y)) * Math.sign(ox || 1); y = (1 - Math.abs(ox)) * Math.sign(y || 1); }
      let l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
      // tangential jitter so the facets don't line up
      x += fbm3(x * 2 + 1, y * 2, z * 2, 2) * 0.25; y += fbm3(x * 2, y * 2 + 5, z * 2, 2) * 0.25; z += fbm3(x * 2, y * 2, z * 2 + 9, 2) * 0.25;
      l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
      const rid = ridged3(x * 1.7, y * 1.7, z * 1.7, 3);
      const rad = R * (0.9 + 0.2 * (rid - 0.5) + 0.05 * noise3(x * 4, y * 4, z * 4));
      this.ball[v * 3] = cx + x * rad; this.ball[v * 3 + 1] = cy + y * rad; this.ball[v * 3 + 2] = cz + z * rad;
      this.aoBall[v] = clamp(0.5 + (rad / R - 0.8) * 2.2, 0.35, 1);
      this.crinkle[v * 3] = noise3(u * 4, w * 4, 1.3); this.crinkle[v * 3 + 1] = noise3(u * 4, w * 4, 7.7); this.crinkle[v * 3 + 2] = noise3(u * 5, w * 5, 3.1) * 1.6;
      this.lag[v] = 0.32 * (0.5 + 0.5 * noise3(u * 1.6, w * 1.6, 4.2)) + 0.1 * (1 - Math.max(Math.abs(u), Math.abs(w)));
    }
  }

  _prepFlat() {
    const n = this.n;
    this.flat = this.rest.slice();
    this.aoFlat = new Float32Array(n);
    for (let v = 0; v < n; v++) {
      const x = this.rest[v * 3], y = this.rest[v * 3 + 1];
      const r = ridged3(x * 2.6 + 3, y * 2.6, 0.5, 4);
      this.flat[v * 3 + 2] = (r - 0.55) * 0.028 + noise3(x * 11, y * 11, 2) * 0.004;
      this.aoFlat[v] = clamp(0.8 + (r - 0.55) * 0.9, 0.55, 1);
    }
  }

  // wrinkle height at sheet coords (x,y) — strips use the same function so the swap is seamless
  static wrinkle(x, y) {
    const r = ridged3(x * 2.6 + 3, y * 2.6, 0.5, 4);
    return [(r - 0.55) * 0.028 + noise3(x * 11, y * 11, 2) * 0.004, clamp(0.8 + (r - 0.55) * 0.9, 0.55, 1)];
  }

  setFlat() {
    if (this.mode === 'rest') return;
    this.out.set(this.rest); this.ao.fill(1);
    this._commit(true); this.mode = 'rest';
  }

  setFold(angles) {
    this._fold(angles, this.out);
    if (this.mode !== 'fold') { this.ao.fill(1); this.geo.attributes.aAO.needsUpdate = true; }
    this.mode = 'fold';
    this._commit(false);
  }

  // c: 0 = folded plane, 1 = ball
  setCrumple(c) {
    const n = this.n, o = this.out, F = this.folded, B = this.ball, K = this.crinkle, L = this.lag, A = this.ao;
    for (let v = 0; v < n; v++) {
      const t = smooth(clamp(c * 1.45 - L[v]));
      const amp = Math.sin(Math.PI * t) * 0.07;
      const i = v * 3;
      o[i] = F[i] + (B[i] - F[i]) * t + K[i] * amp;
      o[i + 1] = F[i + 1] + (B[i + 1] - F[i + 1]) * t + K[i + 1] * amp;
      o[i + 2] = F[i + 2] + (B[i + 2] - F[i + 2]) * t + K[i + 2] * amp;
      A[v] = 1 + (this.aoBall[v] - 1) * t;
    }
    this.mode = 'crumple';
    this.geo.attributes.aAO.needsUpdate = true;
    this._commit(false);
  }

  // u: 0 = ball, 1 = flat (with creases)
  setUncrumple(u) {
    const n = this.n, o = this.out, F = this.flat, B = this.ball, K = this.crinkle, L = this.lag, A = this.ao;
    for (let v = 0; v < n; v++) {
      const t = smooth(clamp(u * 1.45 - (0.42 - L[v])));
      const amp = Math.sin(Math.PI * t) * 0.05;
      const i = v * 3;
      o[i] = B[i] + (F[i] - B[i]) * t + K[i] * amp;
      o[i + 1] = B[i + 1] + (F[i + 1] - B[i + 1]) * t + K[i + 1] * amp;
      o[i + 2] = B[i + 2] + (F[i + 2] - B[i + 2]) * t + K[i + 2] * amp;
      A[v] = this.aoBall[v] + (this.aoFlat[v] - this.aoBall[v]) * t;
    }
    this.mode = 'uncrumple';
    this.geo.attributes.aAO.needsUpdate = true;
    this._commit(false);
  }

  _commit(aoToo) {
    this.geo.attributes.position.needsUpdate = true;
    if (aoToo) this.geo.attributes.aAO.needsUpdate = true;
    fastNormals(this.geo);
  }
}

export { FOLDS };
