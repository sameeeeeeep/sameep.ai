// A shared wall of flame behind/between the burning strips, masked by their combined fronts.
import * as THREE from '../../vendor/three.module.min.js';
import { GLSL_NOISE } from './util.js';
import { NSTRIPS } from './strips.js';

const VERT = /* glsl */`
uniform vec2 uOrigin;
varying vec2 vP;
void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vP = wp.xy - uOrigin; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const FRAG = /* glsl */`
uniform float uX[${NSTRIPS}]; uniform float uY[${NSTRIPS}]; uniform float uOn[${NSTRIPS}];
uniform float uTime; uniform float uI; uniform float uSpread;
varying vec2 vP;
${GLSL_NOISE}
void main(){
  float wsum = 0.0, ysum = 0.0, cover = 0.0;
  for (int k = 0; k < ${NSTRIPS}; k++) {
    float dx = (vP.x - uX[k]) / uSpread;
    float w = exp(-dx * dx) * uOn[k];
    wsum += w; ysum += w * uY[k];
    cover = max(cover, w);
  }
  if (wsum < 0.02) discard;
  float y0 = ysum / wsum;                       // blended base of the fire along x
  float t = (vP.y - y0) / 0.62;                 // 0 at the base -> 1 at the tips
  if (t < -0.25 || t > 1.0) discard;
  float n = fbm2(vec2(vP.x * 5.5, vP.y * 3.0 - uTime * 2.2));
  float n2 = fbm2(vec2(vP.x * 15.0 + 4.0, vP.y * 8.0 - uTime * 4.2));
  float tongue = smoothstep(0.02, 0.2, n * 1.1 + n2 * 0.5 - t * 1.15 - 0.12);
  float body = tongue * smoothstep(-0.25, 0.05, t) * smoothstep(0.0, 0.5, cover);
  vec3 col = mix(vec3(1.9, 1.05, 0.32), vec3(1.5, 0.38, 0.05), smoothstep(0.0, 0.4, t));
  col = mix(col, vec3(0.5, 0.06, 0.01), smoothstep(0.45, 0.95, t));
  gl_FragColor = vec4(col * body * uI, 1.0);
}`;

export function makeFireWall() {
  const u = {
    uX: { value: new Array(NSTRIPS).fill(0) }, uY: { value: new Array(NSTRIPS).fill(0) }, uOn: { value: new Array(NSTRIPS).fill(0) },
    uTime: { value: 0 }, uI: { value: 0 }, uSpread: { value: 0.16 }, uOrigin: { value: new THREE.Vector2() },
  };
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 1, 1), new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, uniforms: u,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  m.frustumCulled = false;
  m.renderOrder = 3;
  m.visible = false;
  m.userData.u = u;
  return m;
}
