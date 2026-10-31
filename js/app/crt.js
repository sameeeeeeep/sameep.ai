// crt.js — one WebGL canvas over the iMac's glass.
//  • "screen" mode: draws a 2D source canvas (boot, installer, dial-up) through a
//    real CRT pass: barrel curvature, RGB convergence error, bloom, scanlines,
//    an aperture-grille phosphor mask, flicker, grain and a vignette.
//  • "glass" mode: the DOM desktop shows through; the shader only adds what sits
//    *on* the glass (very light scanlines + mask, curvature shading, reflection,
//    vignette, grain). It never resamples the DOM, so text stays crisp.

const VS = `attribute vec2 p; varying vec2 v; void main(){ v = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`;

const FS = `
precision mediump float;
varying vec2 v;
uniform sampler2D tex;
uniform vec2 res;       // canvas px
uniform vec2 texRes;    // source px
uniform float time;
uniform float mode;     // 0 = screen, 1 = glass
uniform float power;    // 0..1 power-on raster
uniform float k;        // curvature amount
uniform float flick;

float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }

vec2 barrel(vec2 uv){
  vec2 c = uv*2.-1.;
  c *= 1. + k * dot(c,c) * vec2(0.9, 1.15);
  c /= 1. + k * 1.05;
  return c*0.5+0.5;
}

float cornerMask(vec2 uv, float r){
  vec2 q = abs(uv*2.-1.);
  vec2 d = max(q - (1. - r), 0.);
  float dist = length(d) / r;
  return 1. - smoothstep(0.92, 1.0, dist) * step(0., 1.);
}

vec3 src(vec2 uv){ return texture2D(tex, uv).rgb; }

void main(){
  vec2 frag = gl_FragCoord.xy;
  vec2 uv0 = vec2(v.x, 1.0 - v.y);
  float vig = 16. * uv0.x*uv0.y*(1.-uv0.x)*(1.-uv0.y);
  float scan = 0.5 + 0.5*sin(frag.y * 3.14159 / 1.5);
  float tri = mod(floor(frag.x), 3.);
  vec3 mask = vec3(tri==0.?1.:.78, tri==1.?1.:.78, tri==2.?1.:.78);
  float grain = hash(frag + fract(time)*91.7) - 0.5;

  if (mode < 0.5) {
    vec2 uv = barrel(uv0);
    if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) { gl_FragColor = vec4(0.,0.,0.,1.); return; }
    vec2 px = 1. / texRes;
    vec2 off = (uv - 0.5) * 0.0028;
    vec3 col;
    col.r = texture2D(tex, uv + off).r;
    col.g = texture2D(tex, uv).g;
    col.b = texture2D(tex, uv - off).b;
    // bloom: wide, cheap 12-tap ring
    vec3 b = vec3(0.);
    for (int i = 0; i < 12; i++) {
      float a = float(i) * 0.5236;
      b += src(uv + vec2(cos(a), sin(a)) * px * 3.2);
      b += src(uv + vec2(cos(a+.26), sin(a+.26)) * px * 7.0);
    }
    b /= 24.;
    col += b * b * 0.85;
    // scanlines in source space so they bend with the glass
    float sl = 0.5 + 0.5*cos(uv.y * texRes.y * 6.28318);
    col *= mix(1.0, 0.72 + 0.28*sl, 0.55);
    col *= mix(vec3(1.), mask, 0.45);
    col *= 0.96 + 0.04*sin(time*60.) * flick;
    col += grain * 0.035;
    col *= pow(vig, 0.22);
    // power-on: a bright line opening vertically
    float line = smoothstep(power*0.5+0.002, power*0.5, abs(uv.y-0.5));
    col = mix(vec3(0.), col, line) + (1.-smoothstep(0.,0.004,abs(uv.y-0.5))) * (1.-power) * 1.5;
    float cm = cornerMask(uv0, 0.06);
    gl_FragColor = vec4(col * cm, 1.);
  } else {
    // glass over DOM: output premultiplied rgba
    vec2 c = uv0*2.-1.;
    float edge = smoothstep(0.55, 1.35, length(c * vec2(0.92, 1.0)));
    float dark = 0.0;
    dark += (1. - scan) * 0.075;                // fine scanlines
    dark += (1. - (mask.r+mask.g+mask.b)/3.) * 0.12; // phosphor triads
    dark += edge * 0.42;                         // curvature falloff
    dark += (1. - pow(vig, 0.35)) * 0.25;
    dark = clamp(dark + grain*0.03, 0., 0.9);
    // glass reflection: soft diagonal sheen top-left + tube rim highlight
    float sheen = smoothstep(0.5, 0., length((uv0 - vec2(0.18, 0.12)) * vec2(1.0, 1.6))) * 0.07;
    float rim = smoothstep(0.985, 1.0, max(abs(c.x), abs(c.y))) * 0.08;
    float fl = (sin(time*120.)*0.5+0.5) * 0.012 * flick;
    vec3 tint = vec3(0.72, 1.0, 0.91);
    float a = dark + fl;
    vec3 rgb = tint * (sheen + rim);
    float cm = cornerMask(uv0, 0.035);
    gl_FragColor = vec4(rgb, clamp(a + sheen + rim, 0., 1.)) * cm + vec4(0.,0.,0.,1.-cm);
  }
}`;

export class CRT {
  constructor(host, { reduced = false } = {}) {
    this.host = host;
    this.reduced = reduced;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'crt-gl';
    this.canvas.setAttribute('aria-hidden', 'true');
    host.append(this.canvas);
    this.mode = 0;
    this.power = 0;
    this.source = null;
    this.ok = this.#init();
    this.#resize();
    this.ro = new ResizeObserver(() => this.#resize());
    this.ro.observe(host);
    this.t0 = performance.now();
    this.running = true;
    this.#loop();
  }

  #init() {
    const gl = this.canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) { this.canvas.classList.add('crt-gl--none'); return false; }
    this.gl = gl;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    try {
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(pr);
      gl.useProgram(pr);
      this.pr = pr;
    } catch (e) { console.warn('[crt] shader', e); return false; }
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(this.pr, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    this.u = {};
    ['tex', 'res', 'texRes', 'time', 'mode', 'power', 'k', 'flick'].forEach((n) => (this.u[n] = gl.getUniformLocation(this.pr, n)));
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    return true;
  }

  #resize() {
    const r = this.host.getBoundingClientRect();
    const mobile = r.width < 768;
    // screen mode benefits from DPR; glass mode is soft by nature → 1x is plenty
    const dpr = this.mode === 0 ? Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2) : 1;
    this.canvas.width = Math.max(2, Math.round(r.width * dpr));
    this.canvas.height = Math.max(2, Math.round(r.height * dpr));
    this.size = { w: r.width, h: r.height };
    this.dirty = true;
    this.onResize?.(this.size);
  }

  setSource(canvas) { this.source = canvas; this.dirty = true; }
  setMode(m) {
    this.mode = m === 'glass' ? 1 : 0;
    this.canvas.classList.toggle('is-glass', this.mode === 1);
    this.#resize();
  }
  setPower(p) { this.power = p; }

  #loop = () => {
    if (!this.running) return;
    requestAnimationFrame(this.#loop);
    if (!this.ok) return;
    const now = performance.now();
    // glass mode only needs ~24fps (grain/flicker); screen mode follows the source
    if (this.mode === 1 && this.reduced && !this.dirty) return;
    if (this.mode === 1 && now - (this.last || 0) < 41) return;
    this.last = now;
    this.dirty = false;
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (this.mode === 0 && this.source) {
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.source);
      gl.uniform2f(this.u.texRes, this.source.width, this.source.height);
    } else {
      gl.uniform2f(this.u.texRes, 2, 2);
    }
    gl.uniform1i(this.u.tex, 0);
    gl.uniform2f(this.u.res, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.u.time, this.reduced ? 0 : (now - this.t0) / 1000);
    gl.uniform1f(this.u.mode, this.mode);
    gl.uniform1f(this.u.power, this.power);
    gl.uniform1f(this.u.k, this.size.w < 600 ? 0.035 : 0.06);
    gl.uniform1f(this.u.flick, this.reduced ? 0 : 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  destroy() { this.running = false; this.ro.disconnect(); this.canvas.remove(); }
}
