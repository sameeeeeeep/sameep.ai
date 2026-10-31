// CPU particle pools (pre-allocated; swap-remove, no per-frame allocation).
// One additive pool (flame licks, embers, sparks) and one alpha pool (ash, smoke).
import * as THREE from '../../vendor/three.module.min.js';

const VERT = /* glsl */`
attribute float aSize; attribute vec4 aCol;
uniform float uScale;
varying vec4 vCol;
void main(){
  vCol = aCol;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = max(1.0, aSize * uScale / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG_ADD = /* glsl */`
varying vec4 vCol;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c) * 4.0;
  float a = exp(-d * 3.2) * (1.0 - smoothstep(0.7, 1.0, d));
  gl_FragColor = vec4(vCol.rgb * a * vCol.a, 1.0);
}`;
const FRAG_ALPHA = /* glsl */`
varying vec4 vCol;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c) * 4.0;
  float a = (1.0 - smoothstep(0.35, 1.0, d));
  gl_FragColor = vec4(vCol.rgb, a * vCol.a);
}`;

export const FLAME = 0, EMBER = 1, SPARK = 2, ASH = 3, SMOKE = 4;

class Pool {
  constructor(max, additive) {
    this.max = max;
    this.count = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.age = new Float32Array(max);
    this.life = new Float32Array(max);
    this.seed = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.type = new Uint8Array(max);
    this.size = new Float32Array(max);
    this.col = new Float32Array(max * 4);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos);
    g.setAttribute('aSize', this.aSize);
    g.setAttribute('aCol', this.aCol);
    g.setDrawRange(0, 0);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);
    this.uniforms = { uScale: { value: 600 } };
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: additive ? FRAG_ADD : FRAG_ALPHA, uniforms: this.uniforms,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.geo = g;
  }

  spawn(type, x, y, z, vx, vy, vz, life, size) {
    if (this.count >= this.max) return;
    const i = this.count++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.age[i] = 0; this.life[i] = life; this.size0[i] = size; this.type[i] = type; this.seed[i] = Math.random() * 100;
  }

  kill(i) {
    const j = --this.count;
    if (i === j) return;
    this.pos[i * 3] = this.pos[j * 3]; this.pos[i * 3 + 1] = this.pos[j * 3 + 1]; this.pos[i * 3 + 2] = this.pos[j * 3 + 2];
    this.vel[i * 3] = this.vel[j * 3]; this.vel[i * 3 + 1] = this.vel[j * 3 + 1]; this.vel[i * 3 + 2] = this.vel[j * 3 + 2];
    this.age[i] = this.age[j]; this.life[i] = this.life[j]; this.size0[i] = this.size0[j]; this.type[i] = this.type[j]; this.seed[i] = this.seed[j];
  }

  update(dt, t) {
    let i = 0;
    while (i < this.count) {
      this.age[i] += dt;
      const a = this.age[i] / this.life[i];
      if (a >= 1) { this.kill(i); continue; }
      const ty = this.type[i], s = this.seed[i];
      const p = i * 3;
      let vx = this.vel[p], vy = this.vel[p + 1], vz = this.vel[p + 2];
      const px = this.pos[p], py = this.pos[p + 1], pz = this.pos[p + 2];
      let r = 1, g = 1, b = 1, al = 1, sz = this.size0[i];
      if (ty === FLAME) {
        vx += Math.sin(py * 9 + t * 7 + s) * 0.5 * dt; vy += 0.9 * dt; vz *= 0.98;
        const k = a;
        r = 3.2 - k * 1.2; g = 1.9 * (1 - k) * (1 - k) + 0.25; b = 0.8 * Math.max(0, 1 - k * 3.0) + 0.04;
        al = Math.sin(Math.PI * Math.min(1, a * 1.15)) * 0.9;
        sz *= 1 - a * 0.55;
      } else if (ty === EMBER) {
        vx += Math.sin(py * 3.1 + t * 1.3 + s) * 0.35 * dt; vz += Math.cos(px * 2.7 + t * 1.1 + s) * 0.3 * dt;
        vy += (0.12 - vy * 0.6) * dt;
        const fl = 0.65 + 0.35 * Math.sin(t * 18 + s * 3);
        r = 3.6 * fl; g = 1.15 * fl * (1 - a * 0.6); b = 0.22 * (1 - a);
        al = Math.min(1, a * 8) * (1 - a * a);
      } else if (ty === SPARK) {
        vy -= 2.2 * dt; vx *= 0.97; vz *= 0.97;
        r = 4.5; g = 2.6 * (1 - a) + 0.6; b = 0.9 * (1 - a);
        al = 1 - a;
      } else if (ty === ASH) {
        vx += Math.sin(t * 2.3 + s) * 0.25 * dt; vz += Math.cos(t * 1.9 + s) * 0.2 * dt;
        vy += (0.05 - vy * 0.5) * dt;
        r = g = b = 0.035 + 0.03 * Math.sin(s); al = Math.min(1, a * 6) * (1 - a) * 0.9;
        sz *= 0.8 + 0.4 * Math.abs(Math.sin(t * 3 + s)); // tumbling flake reads as size flicker
      } else if (ty === SMOKE) {
        vx += Math.sin(py * 1.7 + t * 0.6 + s) * 0.12 * dt; vy += (0.22 - vy) * 0.8 * dt;
        r = 0.05; g = 0.042; b = 0.036; al = Math.sin(Math.PI * a) * 0.16;
        sz *= 1 + a * 3.5;
      }
      this.vel[p] = vx; this.vel[p + 1] = vy; this.vel[p + 2] = vz;
      this.pos[p] = px + vx * dt; this.pos[p + 1] = py + vy * dt; this.pos[p + 2] = pz + vz * dt;
      this.size[i] = sz;
      const c = i * 4;
      this.col[c] = r; this.col[c + 1] = g; this.col[c + 2] = b; this.col[c + 3] = al;
      i++;
    }
    this.geo.setDrawRange(0, this.count);
    if (this.count) {
      this.aPos.needsUpdate = true; this.aSize.needsUpdate = true; this.aCol.needsUpdate = true;
    }
  }

  clear() { this.count = 0; this.geo.setDrawRange(0, 0); }
}

export class Particles {
  constructor(scene, { mobile }) {
    this.add = new Pool(mobile ? 700 : 2200, true);
    this.alpha = new Pool(mobile ? 260 : 800, false);
    scene.add(this.add.points, this.alpha.points);
  }
  setScale(s) { this.add.uniforms.uScale.value = s; this.alpha.uniforms.uScale.value = s; }
  flame(x, y, z, size = 0.07) {
    this.add.spawn(FLAME, x + (Math.random() - 0.5) * 0.01, y, z, (Math.random() - 0.5) * 0.06, 0.18 + Math.random() * 0.25, (Math.random() - 0.5) * 0.04, 0.35 + Math.random() * 0.4, size * (0.7 + Math.random() * 0.6));
  }
  ember(x, y, z) {
    this.add.spawn(EMBER, x, y, z, (Math.random() - 0.5) * 0.25, 0.15 + Math.random() * 0.35, (Math.random() - 0.5) * 0.2, 1.4 + Math.random() * 2.4, 0.012 + Math.random() * 0.014);
  }
  spark(x, y, z) {
    const a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 1.4;
    this.add.spawn(SPARK, x, y, z, Math.cos(a) * sp * 0.6, Math.abs(Math.sin(a)) * sp * 0.8 + 0.2, (Math.random() - 0.3) * sp * 0.5, 0.25 + Math.random() * 0.35, 0.008 + Math.random() * 0.006);
  }
  ash(x, y, z) {
    this.alpha.spawn(ASH, x, y, z, (Math.random() - 0.5) * 0.1, 0.05 + Math.random() * 0.12, (Math.random() - 0.5) * 0.1, 2.2 + Math.random() * 2.8, 0.018 + Math.random() * 0.022);
  }
  smoke(x, y, z) {
    this.alpha.spawn(SMOKE, x, y, z, (Math.random() - 0.5) * 0.05, 0.12, (Math.random() - 0.5) * 0.05, 1.8 + Math.random() * 1.8, 0.08 + Math.random() * 0.06);
  }
  update(dt, t) { this.add.update(dt, t); this.alpha.update(dt, t); }
  clear() { this.add.clear(); this.alpha.clear(); }
}
