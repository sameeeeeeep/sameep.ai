// SHRED + BURN: the sheet as 14 vertical strips (one geometry, one draw call).
// CPU deformation (peel apart, flutter, curl, twist, burn-curl) so shadows + normals stay exact.
// Each strip has its own noise-dissolve burn front; fire propagates by proximity (Dijkstra).
import * as THREE from '../../vendor/three.module.min.js';
import { SHEET_W, SHEET_H, Sheet } from './sheet.js';
import { clamp, smooth, mulberry32, noise3, GLSL_NOISE, fastNormals } from './util.js';

export const NSTRIPS = 14;
const SW = SHEET_W / NSTRIPS;

const BURN_GLSL = /* glsl */`
uniform float uFront[${NSTRIPS}];
uniform vec2 uIgn[${NSTRIPS}];
uniform float uTime;
varying float vStrip; varying vec2 vLocal; varying float vBN;
${GLSL_NOISE}
float burnDist(out float front){
  int si = int(vStrip + 0.5);
  front = uFront[si];
  float bf = length(vLocal - uIgn[si]) + vBN;
  float hf = fbm2(vLocal * 34.0 + vStrip * 7.3) - 0.5;
  return bf + hf * 0.045 - front;
}`;

function patchVertex(src) {
  return src
    .replace('#include <common>', `#include <common>
attribute float aStrip; attribute vec2 aLocal; attribute float aBN; attribute float aAO;
varying float vStrip; varying vec2 vLocal; varying float vBN; varying float vAO;`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
vStrip = aStrip; vLocal = aLocal; vBN = aBN; vAO = aAO;`);
}

export function stripMaterial(front, back) {
  const mat = new THREE.MeshStandardMaterial({ map: front, side: THREE.DoubleSide, roughness: 0.82, metalness: 0 });
  const uniforms = {
    uBack: { value: back }, uFront: { value: new Array(NSTRIPS).fill(-1) },
    uIgn: { value: Array.from({ length: NSTRIPS }, () => new THREE.Vector2()) }, uTime: { value: 0 }, uSep: { value: 0 },
  };
  mat.userData.u = uniforms;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = patchVertex(sh.vertexShader);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D uBack; uniform float uSep; varying float vAO;
${BURN_GLSL}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  float bFront; float bd = burnDist(bFront);
  bool lit = bFront > -0.5;
  if (lit && bd < 0.0) discard;`)
      .replace('#include <map_fragment>', `
#ifdef USE_MAP
  vec4 sampledDiffuseColor = gl_FrontFacing ? texture2D(map, vMapUv) : texture2D(uBack, vec2(1.0 - vMapUv.x, vMapUv.y));
  diffuseColor *= sampledDiffuseColor;
#endif
  diffuseColor.rgb *= vAO;
  float edgeX = min(vLocal.x, ${SW.toFixed(6)} - vLocal.x);
  diffuseColor.rgb *= mix(1.0, 0.82 + 0.18 * smoothstep(0.0, 0.004, edgeX), uSep);
  float ember = 0.0, charB = 0.0;
  if (lit) {
    ember = 1.0 - smoothstep(0.0, 0.014, bd);
    charB = 1.0 - smoothstep(0.008, 0.07, bd);
    float scorch = 1.0 - smoothstep(0.04, 0.2, bd);
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.72, 0.52, 0.3), scorch);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.022, 0.018, 0.015), charB);
  }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  if (lit) {
    float fl = 0.75 + 0.25 * sin(uTime * 23.0 + vLocal.y * 40.0) * sin(uTime * 7.0 + vStrip);
    float glowN = fbm2(vLocal * 60.0 + uTime * 0.6);
    totalEmissiveRadiance += vec3(3.2, 1.0, 0.22) * ember * fl;
    totalEmissiveRadiance += vec3(1.6, 0.35, 0.06) * charB * smoothstep(0.45, 0.8, glowN) * (1.0 - ember) * 1.2;
  }`);
  };
  mat.customProgramCacheKey = () => 'strips-v1';

  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide });
  depth.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = patchVertex(sh.vertexShader);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${BURN_GLSL}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  float bFront; float bd = burnDist(bFront);
  if (bFront > -0.5 && bd < 0.0) discard;`);
  };
  depth.customProgramCacheKey = () => 'strips-depth-v1';
  return { mat, depth, uniforms };
}

export class Strips {
  constructor({ front, back, mobile }) {
    const sx = 3, sy = mobile ? 48 : 68;
    this.sx = sx; this.sy = sy;
    const vps = (sx + 1) * (sy + 1);
    this.vps = vps;
    const n = vps * NSTRIPS;
    this.n = n;
    const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), aStrip = new Float32Array(n);
    const aLocal = new Float32Array(n * 2), aBN = new Float32Array(n), aAO = new Float32Array(n);
    this.lu = new Float32Array(n); this.lv = new Float32Array(n); this.wz = new Float32Array(n);
    const idx = new Uint32Array(NSTRIPS * sx * sy * 6);
    let t = 0;
    for (let k = 0; k < NSTRIPS; k++) {
      for (let j = 0; j <= sy; j++) for (let i = 0; i <= sx; i++) {
        const v = k * vps + j * (sx + 1) + i;
        const lu = i / sx, lv = j / sy;
        const gx = (k + lu) / NSTRIPS; // global u
        const x = (gx - 0.5) * SHEET_W, y = (lv - 0.5) * SHEET_H;
        const [wz, ao] = Sheet.wrinkle(x, y);
        pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = wz;
        uv[v * 2] = gx; uv[v * 2 + 1] = lv;
        aStrip[v] = k; aLocal[v * 2] = lu * SW; aLocal[v * 2 + 1] = lv * SHEET_H;
        aBN[v] = noise3(x * 4.2, y * 4.2, k * 0.37) * 0.16 + noise3(x * 11, y * 11, 3.3) * 0.05;
        aAO[v] = ao;
        this.lu[v] = lu; this.lv[v] = lv; this.wz[v] = wz;
      }
      for (let j = 0; j < sy; j++) for (let i = 0; i < sx; i++) {
        const a = k * vps + j * (sx + 1) + i, b = a + 1, c = a + sx + 1, d = c + 1;
        idx[t++] = a; idx[t++] = b; idx[t++] = d; idx[t++] = a; idx[t++] = d; idx[t++] = c;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('aStrip', new THREE.BufferAttribute(aStrip, 1));
    g.setAttribute('aLocal', new THREE.BufferAttribute(aLocal, 2));
    g.setAttribute('aBN', new THREE.BufferAttribute(aBN, 1));
    g.setAttribute('aAO', new THREE.BufferAttribute(aAO, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 6);
    this.geo = g;
    this.pos = pos;
    this.bn = aBN;
    const { mat, depth, uniforms } = stripMaterial(front, back);
    this.u = uniforms;
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.customDepthMaterial = depth;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;

    // per-strip motion params
    const r = mulberry32(2026);
    this.P = Array.from({ length: NSTRIPS }, (_, k) => ({
      amp: 0.03 + r() * 0.05, freq: 3 + r() * 3, w: 0.8 + r() * 0.9, ph: r() * 6.28,
      twist: (r() - 0.5) * 1.6, curl: (r() - 0.5) * 0.22, bob: r() * 6.28, spinW: 0.15 + r() * 0.2,
      jx: (r() - 0.5), jy: (r() - 0.5), jz: r(), rz: (r() - 0.5), ry: (r() - 0.5), rx: (r() - 0.5), k,
    }));
    this.L = Array.from({ length: NSTRIPS }, () => ({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 }));
    this.front = new Float32Array(NSTRIPS).fill(-1);
    this.ign = Array.from({ length: NSTRIPS }, () => [SW / 2, 0.04]);
    this.T = new Float32Array(NSTRIPS);
    this.dur = new Float32Array(NSTRIPS);
    this.cut = 0; this.time = 0;
    this._v = new Float32Array(3);
  }

  // Float layout adapts to the viewport's shape so nothing crops in portrait.
  layout(aspect) {
    const portrait = aspect < 0.9;
    const spread = portrait ? 1.28 : Math.min(2.8, 1.5 + aspect * 0.75);
    const depth = portrait ? 1.1 : 0.85;
    this.P.forEach((p, k) => {
      const L = this.L[k];
      L.x = (k / (NSTRIPS - 1) - 0.5) * spread + p.jx * (portrait ? 0.03 : 0.07);
      L.y = p.jy * (portrait ? 0.34 : 0.22) + 0.05;
      L.z = (p.jz - 0.55) * depth;
      L.rz = p.rz * (portrait ? 0.32 : 0.42);
      L.ry = p.ry * 0.9;
      L.rx = p.rx * 0.3;
    });
    this.spreadW = spread + 0.25; this.spreadH = SHEET_H + (portrait ? 0.55 : 0.4);
    this.portrait = portrait;
    this._plan();
  }

  // first strip to catch: the one whose bottom is nearest the matchbox side (front-right)
  get firstStrip() { return this.portrait ? 9 : 10; }

  // strip-local point → strip-group space (static layout, no flutter) used for planning
  _staticPoint(k, lv, out) {
    const L = this.L[k];
    const y = (lv - 0.5) * SHEET_H;
    const cz = Math.cos(L.rz), sz = Math.sin(L.rz);
    out[0] = L.x - y * sz; out[1] = L.y + y * cz; out[2] = L.z;
    return out;
  }

  _plan() {
    // closest approach between every pair (sampled), then Dijkstra over arrival times
    const S = 16, a = [0, 0, 0], b = [0, 0, 0];
    const pair = [];
    for (let i = 0; i < NSTRIPS; i++) {
      pair[i] = [];
      for (let j = 0; j < NSTRIPS; j++) {
        if (i === j) { pair[i][j] = null; continue; }
        let best = 1e9, bi = 0, bj = 0;
        for (let si = 0; si <= S; si++) {
          this._staticPoint(i, si / S, a);
          for (let sj = 0; sj <= S; sj++) {
            this._staticPoint(j, sj / S, b);
            const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
            if (d < best) { best = d; bi = si / S; bj = sj / S; }
          }
        }
        pair[i][j] = { d: best, lvi: bi, lvj: bj };
      }
    }
    const speed = 1.0, jump = 0.8;
    const T = new Array(NSTRIPS).fill(Infinity), ign = new Array(NSTRIPS).fill(0.04), done = new Array(NSTRIPS).fill(false);
    const f0 = this.firstStrip;
    T[f0] = 0; ign[f0] = 0.03;
    for (let it = 0; it < NSTRIPS; it++) {
      let u = -1;
      for (let k = 0; k < NSTRIPS; k++) if (!done[k] && (u < 0 || T[k] < T[u])) u = k;
      if (u < 0 || T[u] === Infinity) break;
      done[u] = true;
      for (let v = 0; v < NSTRIPS; v++) {
        if (done[v]) continue;
        const pr = pair[u][v];
        const travel = Math.abs(pr.lvi - ign[u]) * SHEET_H / speed;
        const gap = Math.max(0, pr.d - 0.03);
        const hop = Math.pow(gap, 1.2) / jump * (gap > 0.6 ? 2 : 1);
        const at = T[u] + travel * 0.45 + hop + 0.04;
        if (at < T[v]) { T[v] = at; ign[v] = pr.lvj; }
      }
    }
    let end = 0;
    for (let k = 0; k < NSTRIPS; k++) {
      const il = ign[k];
      const far = Math.max(il, 1 - il) * SHEET_H;
      this.dur[k] = (far + 0.25) / speed;
      if (!isFinite(T[k])) T[k] = 0;
      this.T[k] = T[k];
      this.ign[k][0] = SW * 0.5; this.ign[k][1] = clamp(il, 0.02, 0.98) * SHEET_H;
      this.u.uIgn.value[k].set(this.ign[k][0], this.ign[k][1]);
      end = Math.max(end, T[k] + this.dur[k]);
    }
    this.planEnd = end;
    this.speed = speed;
  }

  // burn progress 0..1 across the whole propagation
  setBurn(q) {
    const tt = q * this.planEnd;
    let active = 0;
    for (let k = 0; k < NSTRIPS; k++) {
      const local = tt - this.T[k];
      if (q <= 0 || local < 0) this.front[k] = -1;
      else {
        this.front[k] = local * this.speed - 0.02;
        if (local < this.dur[k]) active++;
      }
      this.u.uFront.value[k] = this.front[k];
    }
    this.active = active;
    return active;
  }

  isBurning(k) { return this.front[k] > -0.5 && this.front[k] < this.dur[k] * this.speed; }

  // world-ish position of strip point (lu, lv) under the current deformation (strip-group space)
  point(k, lu, lv, out) {
    this._deform(k, lu, lv, (lv - 0.5) * SHEET_H, (lu - 0.5) * SW, 0, out);
    return out;
  }

  _deform(k, lu, lv, y0, xOff, wz, out) {
    const p = this.P[k], L = this.L[k], t = this.time;
    const f = smooth(clamp(this.cut * 1.7 - (1 - lv) * 0.7));
    let x = xOff, y = y0, z = wz;
    // flutter + curl
    z += f * (p.amp * Math.sin(lv * p.freq + t * p.w + p.ph) * (0.35 + lv) + p.curl * (lv - 0.5) * (lv - 0.5) * 2);
    // burn curl near the front
    const fr = this.front[k];
    if (fr > -0.5) {
      const dx = lu * SW - this.ign[k][0], dy = lv * SHEET_H - this.ign[k][1];
      const bf = Math.sqrt(dx * dx + dy * dy) + this._bn;
      const d = bf - fr;
      if (d < 0.16) {
        const c = (0.16 - Math.max(d, 0)) / 0.16;
        z += c * c * 0.07;
        x *= 1 - c * 0.35;
        y += Math.sign(dy) * -c * c * 0.02;
      }
    }
    // twist about the long axis
    const tw = f * (p.twist * (lv - 0.5) + 0.22 * Math.sin(t * 0.55 + p.ph + lv * 2.2));
    const ct = Math.cos(tw), st = Math.sin(tw);
    const x1 = x * ct - z * st, z1 = x * st + z * ct;
    // rigid: rx, ry (slow sway), rz
    const ry = f * (L.ry + 0.45 * Math.sin(t * p.spinW + p.ph));
    const rz = f * (L.rz + 0.05 * Math.sin(t * 0.4 + p.bob));
    const rx = f * L.rx;
    let X = x1, Y = y, Z = z1;
    let c = Math.cos(rx), s = Math.sin(rx);
    let tY = Y * c - Z * s; Z = Y * s + Z * c; Y = tY;
    c = Math.cos(ry); s = Math.sin(ry);
    let tX = X * c + Z * s; Z = -X * s + Z * c; X = tX;
    c = Math.cos(rz); s = Math.sin(rz);
    tX = X * c - Y * s; Y = X * s + Y * c; X = tX;
    const baseX = (k + 0.5) * SW - SHEET_W / 2;
    out[0] = X + baseX + (L.x - baseX) * f;
    out[1] = Y + f * (L.y + 0.035 * Math.sin(t * 0.5 + p.bob));
    out[2] = Z + f * (L.z + 0.03 * Math.cos(t * 0.42 + p.bob));
  }

  update(cut, time) {
    this.cut = cut; this.time = time;
    this.u.uSep.value = clamp(cut * 3);
    this.u.uTime.value = time;
    const pos = this.pos, vps = this.vps, o = this._v;
    for (let k = 0; k < NSTRIPS; k++) {
      for (let q = 0; q < vps; q++) {
        const v = k * vps + q;
        this._bn = this.bn[v];
        this._deform(k, this.lu[v], this.lv[v], (this.lv[v] - 0.5) * SHEET_H, (this.lu[v] - 0.5) * SW, this.wz[v], o);
        pos[v * 3] = o[0]; pos[v * 3 + 1] = o[1]; pos[v * 3 + 2] = o[2];
      }
    }
    this._bn = 0;
    this.geo.attributes.position.needsUpdate = true;
    fastNormals(this.geo);
  }

  // a random point on strip k's burn front (strip-group space); returns false if none
  frontPoint(k, out) {
    const fr = this.front[k];
    if (fr <= 0) return false;
    const [ix, iy] = this.ign[k];
    let lx = Math.random() * SW;
    let dx = lx - ix;
    if (Math.abs(dx) > fr) { lx = ix; dx = 0; }
    const dy = Math.sqrt(fr * fr - dx * dx);
    let side = Math.random() < 0.5 ? 1 : -1;
    let ly = iy + side * dy;
    if (ly < 0 || ly > SHEET_H) { side = -side; ly = iy + side * dy; }
    if (ly < 0 || ly > SHEET_H) return false;
    const lu = lx / SW, lv = ly / SHEET_H;
    this._bn = 0;
    this._deform(k, lu, lv, (lv - 0.5) * SHEET_H, (lu - 0.5) * SW, 0, out);
    return true;
  }
}
