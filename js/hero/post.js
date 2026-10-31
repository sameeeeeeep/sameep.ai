// Lightweight post stack: HDR scene RT → dual-filter bloom → lens composite
// (soft-shoulder tonemap that leaves LDR untouched, vignette, edge blur, CA, grain).
import * as THREE from '../../vendor/three.module.min.js';

const VERT = /* glsl */`
varying vec2 vUv;
void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const DOWN = /* glsl */`
precision highp float;
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold; uniform float uPrefilter;
varying vec2 vUv;
vec3 pre(vec3 c){
  if (uPrefilter < 0.5) return c;
  float br = max(c.r, max(c.g, c.b));
  float knee = uThreshold * 0.6;
  float soft = clamp(br - uThreshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-4);
  float w = max(soft, br - uThreshold) / max(br, 1e-4);
  return c * w;
}
void main(){
  vec2 t = uTexel;
  vec3 a = texture2D(tSrc, vUv + t * vec2(-2., 2.)).rgb;
  vec3 b = texture2D(tSrc, vUv + t * vec2( 0., 2.)).rgb;
  vec3 c = texture2D(tSrc, vUv + t * vec2( 2., 2.)).rgb;
  vec3 d = texture2D(tSrc, vUv + t * vec2(-2., 0.)).rgb;
  vec3 e = texture2D(tSrc, vUv).rgb;
  vec3 f = texture2D(tSrc, vUv + t * vec2( 2., 0.)).rgb;
  vec3 g = texture2D(tSrc, vUv + t * vec2(-2.,-2.)).rgb;
  vec3 h = texture2D(tSrc, vUv + t * vec2( 0.,-2.)).rgb;
  vec3 i = texture2D(tSrc, vUv + t * vec2( 2.,-2.)).rgb;
  vec3 j = texture2D(tSrc, vUv + t * vec2(-1., 1.)).rgb;
  vec3 k = texture2D(tSrc, vUv + t * vec2( 1., 1.)).rgb;
  vec3 l = texture2D(tSrc, vUv + t * vec2(-1.,-1.)).rgb;
  vec3 m = texture2D(tSrc, vUv + t * vec2( 1.,-1.)).rgb;
  vec3 col = e*0.125 + (a+c+g+i)*0.03125 + (b+d+f+h)*0.0625 + (j+k+l+m)*0.125;
  col = pre(col);
  gl_FragColor = vec4(min(col, vec3(64.0)), 1.0);
}`;

const UP = /* glsl */`
precision highp float;
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uRadius;
varying vec2 vUv;
void main(){
  vec2 t = uTexel * uRadius;
  vec3 s = texture2D(tSrc, vUv).rgb * 4.0;
  s += (texture2D(tSrc, vUv + vec2(-t.x, 0.)).rgb + texture2D(tSrc, vUv + vec2(t.x, 0.)).rgb
     +  texture2D(tSrc, vUv + vec2(0., -t.y)).rgb + texture2D(tSrc, vUv + vec2(0., t.y)).rgb) * 2.0;
  s += texture2D(tSrc, vUv + vec2(-t.x,-t.y)).rgb + texture2D(tSrc, vUv + vec2(t.x,-t.y)).rgb
     + texture2D(tSrc, vUv + vec2(-t.x, t.y)).rgb + texture2D(tSrc, vUv + vec2(t.x, t.y)).rgb;
  gl_FragColor = vec4(s / 16.0, 1.0);
}`;

const FINAL = /* glsl */`
precision highp float;
uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tSoft;
uniform vec2 uRes; uniform float uTime; uniform float uBloom; uniform float uVignette;
uniform float uGrain; uniform float uEdgeBlur; uniform float uCA; uniform float uExposure; uniform float uFade;
uniform vec3 uBg;
varying vec2 vUv;
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 shoulder(vec3 x){
  // identity below 0.72, smooth roll-off to 1.0 above (keeps LDR art exact)
  vec3 k = vec3(0.72);
  vec3 over = max(x - k, 0.0);
  vec3 r = k + (1.0 - k) * (1.0 - exp(-over / (1.0 - k)));
  return mix(x, r, step(k, x));
}
vec3 toSRGB(vec3 c){
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c));
}
void main(){
  vec2 uv = vUv;
  vec2 cc = uv - 0.5;
  float asp = uRes.x / uRes.y;
  float r2 = dot(cc * vec2(asp, 1.0), cc * vec2(asp, 1.0)) / (0.25 * (asp*asp + 1.0));
  // chromatic fringe grows toward the edges
  vec2 off = cc * uCA * r2 / uRes * 2.0;
  vec3 col;
  col.r = texture2D(tScene, uv + off).r;
  col.g = texture2D(tScene, uv).g;
  col.b = texture2D(tScene, uv - off).b;
  vec3 soft = texture2D(tSoft, uv).rgb;
  col = mix(col, soft, clamp(r2 * uEdgeBlur, 0.0, 0.85));
  col += texture2D(tBloom, uv).rgb * uBloom;
  col *= uExposure;
  float vig = smoothstep(1.25, 0.15, r2);
  col = mix(uBg * 0.55, col, mix(1.0, vig, uVignette));
  col = shoulder(col);
  col = mix(col, uBg, uFade);
  vec3 o = toSRGB(col);
  float n = hash(gl_FragCoord.xy + fract(uTime * 7.13) * 431.0) - 0.5;
  o += n * uGrain;
  o += (hash(gl_FragCoord.yx * 1.31) - 0.5) / 255.0;
  gl_FragColor = vec4(o, 1.0);
}`;

export class Post {
  constructor(renderer, { mobile }) {
    this.r = renderer;
    this.mobile = mobile;
    this.levels = mobile ? 3 : 4;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.quad = new THREE.Mesh(geo, null);
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);

    const rtOpts = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.main = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 2, depthBuffer: true });
    this.mips = [];
    for (let i = 0; i < this.levels; i++) this.mips.push(new THREE.WebGLRenderTarget(4, 4, rtOpts));
    this.soft = new THREE.WebGLRenderTarget(4, 4, rtOpts);
    this.soft2 = new THREE.WebGLRenderTarget(4, 4, rtOpts);

    this.down = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: DOWN, depthTest: false, depthWrite: false,
      uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1.0 }, uPrefilter: { value: 0 } },
    });
    this.up = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: UP, depthTest: false, depthWrite: false,
      blending: THREE.AdditiveBlending, transparent: true,
      uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1.0 } },
    });
    this.final = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FINAL, depthTest: false, depthWrite: false,
      uniforms: {
        tScene: { value: null }, tBloom: { value: null }, tSoft: { value: null },
        uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uBloom: { value: 0.6 },
        uVignette: { value: 0.85 }, uGrain: { value: 0.035 }, uEdgeBlur: { value: 0.55 }, uCA: { value: 1.6 },
        uExposure: { value: 1 }, uFade: { value: 0 }, uBg: { value: new THREE.Color('#0f0d0b') },
      },
    });
    this.params = this.final.uniforms;
  }

  setSize(w, h, dpr) {
    const W = Math.max(2, Math.round(w * dpr)), H = Math.max(2, Math.round(h * dpr));
    this.main.setSize(W, H);
    let mw = W >> 2, mh = H >> 2;   // bloom starts at quarter res
    for (const m of this.mips) { m.setSize(Math.max(2, mw), Math.max(2, mh)); mw >>= 1; mh >>= 1; }
    this.soft.setSize(Math.max(2, W >> 2), Math.max(2, H >> 2));
    this.soft2.setSize(Math.max(2, W >> 3), Math.max(2, H >> 3));
    this.params.uRes.value.set(W, H);
  }

  pass(mat, target) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.scene, this.cam);
  }

  render(scene, camera) {
    const r = this.r;
    r.setRenderTarget(this.main);
    r.clear();
    r.render(scene, camera);

    // bloom down chain
    const d = this.down.uniforms;
    let src = this.main.texture, sw = this.main.width, sh = this.main.height;
    for (let i = 0; i < this.levels; i++) {
      d.tSrc.value = src; d.uTexel.value.set(1 / sw, 1 / sh); d.uPrefilter.value = i === 0 ? 1 : 0;
      this.pass(this.down, this.mips[i]);
      src = this.mips[i].texture; sw = this.mips[i].width; sh = this.mips[i].height;
    }
    // up chain (additive into the larger level)
    const u = this.up.uniforms;
    r.autoClear = false;
    for (let i = this.levels - 1; i > 0; i--) {
      const s = this.mips[i];
      u.tSrc.value = s.texture; u.uTexel.value.set(1 / s.width, 1 / s.height);
      this.pass(this.up, this.mips[i - 1]);
    }
    r.autoClear = true;
    // soft copy of the full frame for the lens edge blur
    d.uPrefilter.value = 0;
    d.tSrc.value = this.main.texture; d.uTexel.value.set(1 / this.main.width, 1 / this.main.height);
    this.pass(this.down, this.soft);
    d.tSrc.value = this.soft.texture; d.uTexel.value.set(1 / this.soft.width, 1 / this.soft.height);
    this.pass(this.down, this.soft2);

    const f = this.params;
    f.tScene.value = this.main.texture;
    f.tBloom.value = this.mips[0].texture;
    f.tSoft.value = this.soft2.texture;
    this.pass(this.final, null);
  }

  dispose() {
    [this.main, this.soft, this.soft2, ...this.mips].forEach((t) => t.dispose());
    [this.down, this.up, this.final].forEach((m) => m.dispose());
  }
}
