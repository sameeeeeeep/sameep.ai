// The pile: ~2,000 CVs as one InstancedMesh. Sheets "fall in" on the GPU during the intro count.
import * as THREE from '../../vendor/three.module.min.js';
import { mulberry32 } from './util.js';

const TH = 0.0042;

function patch(sh, uniforms) {
  Object.assign(sh.uniforms, uniforms);
  if (sh.fragmentShader.includes('#include <fog_fragment>')) {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uVis; uniform vec3 uBg;')
      .replace('#include <fog_fragment>', '#include <fog_fragment>\n  gl_FragColor.rgb = mix(uBg, gl_FragColor.rgb, uVis);');
  }
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute float aIdx; attribute float aCell; uniform float uFill;')
    .replace('#include <uv_vertex>', `#include <uv_vertex>
#ifdef USE_MAP
  vMapUv = vMapUv * 0.5 + vec2(mod(aCell, 2.0), 1.0 - floor(aCell / 2.0)) * 0.5;
#endif`)
    .replace('#include <project_vertex>', `
  float lead = uFill - aIdx;
  float vis = step(0.0, lead);
  float fall = 1.0 - clamp(lead / 70.0, 0.0, 1.0);
  fall *= fall;
  vec4 mvPosition = vec4(transformed * vis, 1.0);
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
  mvPosition.y += fall * 2.6;
  mvPosition.xz += vec2(sin(aIdx * 12.9898), cos(aIdx * 78.233)) * fall * 0.7;
  mvPosition = modelViewMatrix * mvPosition;
  gl_Position = projectionMatrix * mvPosition;`);
}

export class Pile {
  constructor({ count, cvTex, mobile }) {
    const r = mulberry32(9);
    this.count = count;
    const th = mobile ? TH * 5 : TH * 1.2;
    const geo = new THREE.BoxGeometry(1, th, 1.4142);
    // paper-edge striations on the sides (one ream slab = several sheets on mobile)
    const ec = document.createElement('canvas'); ec.width = 4; ec.height = 32;
    const ex = ec.getContext('2d');
    ex.fillStyle = '#efe9dc'; ex.fillRect(0, 0, 4, 32);
    ex.fillStyle = '#b9b0a0'; ex.fillRect(0, 0, 4, 3);
    const et = new THREE.CanvasTexture(ec);
    et.colorSpace = THREE.SRGBColorSpace; et.wrapS = et.wrapT = THREE.RepeatWrapping; et.repeat.set(1, mobile ? 5 : 1);
    const edge = new THREE.MeshStandardMaterial({ map: et, roughness: 0.9 });
    const top = new THREE.MeshStandardMaterial({ map: cvTex, roughness: 0.85 });
    const bottom = new THREE.MeshStandardMaterial({ color: 0xe6dfd0, roughness: 0.9 });
    this.uniforms = { uFill: { value: count + 100 }, uVis: { value: 1 }, uBg: { value: new THREE.Color(0x0f0d0b) } };
    for (const m of [edge, top, bottom]) {
      m.onBeforeCompile = (sh) => patch(sh, this.uniforms);
      m.customProgramCacheKey = () => 'pile-v1';
    }
    const mats = [edge, edge, top, bottom, edge, edge];
    const mesh = new THREE.InstancedMesh(geo, mats, count);
    mesh.castShadow = true; mesh.receiveShadow = true;
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    depth.onBeforeCompile = (sh) => patch(sh, this.uniforms);
    depth.customProgramCacheKey = () => 'pile-depth-v1';
    mesh.customDepthMaterial = depth;

    // stacks (relative to the pile centre)
    const stacks = mobile
      ? [[-0.85, -0.35, 0.2, 0.34], [0.45, -0.6, -0.3, 0.3], [1.5, 0.15, 0.45, 0.16], [-0.2, 0.75, 0.1, 0.2]]
      : [[-1.75, -0.35, 0.28, 0.15], [-0.6, -0.85, -0.22, 0.19], [0.62, -0.6, 0.12, 0.17], [1.75, -0.8, -0.38, 0.13],
        [-1.15, 0.75, -0.08, 0.12], [1.15, 0.62, 0.42, 0.11], [0.0, 0.85, -0.5, 0.08]];
    const scatterN = Math.round(count * 0.05);
    const stackN = count - scatterN;
    const sizes = stacks.map((s) => Math.round(s[3] * stackN));
    sizes[0] += stackN - sizes.reduce((a, b) => a + b, 0);
    const layers = Math.max(...sizes);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    const idx = new Float32Array(count), cellA = new Float32Array(count);
    const col = new THREE.Color();
    let i = 0;
    const sheetSpacing = th * 1.02;
    this.slot = null;
    const lean = stacks.map(() => [(r() - 0.5) * 0.0011, (r() - 0.5) * 0.0011]);
    for (let l = 0; l < layers; l++) {
      for (let k = 0; k < stacks.length; k++) {
        if (l >= sizes[k]) continue;
        const [sx, sz, rot] = stacks[k];
        const topFrac = l / sizes[k];
        const jit = 0.012 + topFrac * topFrac * 0.05;
        p.set(sx + lean[k][0] * l + (r() - 0.5) * jit, l * sheetSpacing + th / 2, sz + lean[k][1] * l + (r() - 0.5) * jit);
        e.set((r() - 0.5) * 0.01, rot + (r() - 0.5) * (0.04 + topFrac * 0.12), (r() - 0.5) * 0.01);
        q.setFromEuler(e);
        m4.compose(p, q, s);
        mesh.setMatrixAt(i, m4);
        col.setScalar(0.9 + r() * 0.1); col.b *= 0.96 + r() * 0.04;
        mesh.setColorAt(i, col);
        idx[i] = i; cellA[i] = (r() * 4) | 0;
        // the envelope is tucked into the front-centre stack, ~60% of the way up
        if (k === (mobile ? 3 : 6) && l === Math.round(sizes[k] * 0.62)) this.slot = { x: sx, y: l * sheetSpacing + th, z: sz, rot, idx: i };
        i++;
      }
    }
    for (let j = 0; j < scatterN; j++, i++) {
      const a = r() * Math.PI * 2, rad = 1.9 + Math.pow(r(), 0.7) * 2.4;
      p.set(Math.min(Math.cos(a) * rad * 1.2, 1.4 + r() * 0.6), TH / 2 + j * 0.0004, Math.sin(a) * rad * 0.8 - 0.2);
      e.set((r() - 0.5) * 0.04, r() * Math.PI * 2, (r() - 0.5) * 0.04);
      q.setFromEuler(e); m4.compose(p, q, s);
      mesh.setMatrixAt(i, m4);
      col.setScalar(0.9 + r() * 0.1); mesh.setColorAt(i, col);
      idx[i] = i; cellA[i] = (r() * 4) | 0;
    }
    // draw top sheets first so early-z rejects the hidden layers beneath (huge overdraw saving);
    // aIdx keeps the original fill order for the intro count-up
    {
      const M = mesh.instanceMatrix.array, C = mesh.instanceColor.array;
      const order = Array.from({ length: count }, (_, k) => k).sort((a, b) => M[b * 16 + 13] - M[a * 16 + 13]);
      const M2 = new Float32Array(M.length), C2 = new Float32Array(C.length), I2 = new Float32Array(count), A2 = new Float32Array(count);
      order.forEach((src, dst) => {
        M2.set(M.subarray(src * 16, src * 16 + 16), dst * 16);
        C2.set(C.subarray(src * 3, src * 3 + 3), dst * 3);
        I2[dst] = idx[src]; A2[dst] = cellA[src];
      });
      M.set(M2); C.set(C2); idx.set(I2); cellA.set(A2);
      mesh.instanceColor.needsUpdate = true;
    }
    geo.setAttribute('aIdx', new THREE.InstancedBufferAttribute(idx, 1));
    geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cellA, 1));
    mesh.instanceMatrix.needsUpdate = true;
    this.mesh = mesh;
    this.group = new THREE.Group();
    this.group.add(mesh);
    this.height = layers * sheetSpacing;
  }

  setVis(v) { this.uniforms.uVis.value = v; this.group.visible = v > 0.002; }

  setFill(f) { this.uniforms.uFill.value = f * (this.count + 72) - 1; }
}
