/* p3-geo.js: geometry for the parcel. Metres throughout. */
import * as THREE from './vendor/three.module.min.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (t) => t * t * (3 - 2 * t);

/* fast normals for an indexed geometry (the sameep.ai hero's helper) */
export function fastNormals(geo) {
  const pos = geo.attributes.position.array, nrm = geo.attributes.normal.array, idx = geo.index.array;
  nrm.fill(0);
  for (let t = 0, n = idx.length; t < n; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const abx = pos[b] - pos[a], aby = pos[b + 1] - pos[a + 1], abz = pos[b + 2] - pos[a + 2];
    const acx = pos[c] - pos[a], acy = pos[c + 1] - pos[a + 1], acz = pos[c + 2] - pos[a + 2];
    const x = aby * acz - abz * acy, y = abz * acx - abx * acz, z = abx * acy - aby * acx;
    nrm[a] += x; nrm[a + 1] += y; nrm[a + 2] += z; nrm[b] += x; nrm[b + 1] += y; nrm[b + 2] += z; nrm[c] += x; nrm[c + 1] += y; nrm[c + 2] += z;
  }
  for (let i = 0, n = nrm.length; i < n; i += 3) { const l = Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2]) || 1; nrm[i] /= l; nrm[i + 1] /= l; nrm[i + 2] /= l; }
  geo.attributes.normal.needsUpdate = true;
}

/* a builder that collects quads into material groups */
class Builder {
  constructor() { this.p = []; this.uv = []; this.idx = []; this.groups = []; }
  v(x, y, z, u, w) { this.p.push(x, y, z); this.uv.push(u, w); return this.p.length / 3 - 1; }
  grid(nu, nv, fn, flip) {   /* fn(i/nu, j/nv) -> [x,y,z,u,v]; returns nothing; triangles appended */
    const base = this.p.length / 3;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const r = fn(i / nu, j / nv); this.v(r[0], r[1], r[2], r[3], r[4]); }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = base + j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      if (flip) this.idx.push(a, c, b, b, c, d); else this.idx.push(a, b, c, b, d, c);
    }
  }
  group(mat, fn) { const s = this.idx.length; fn(); this.groups.push([s, this.idx.length - s, mat]); }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx); this.groups.forEach(([s, c, m]) => g.addGroup(s, c, m));
    g.computeVertexNormals(); return g;
  }
}

/* ---------------- the box body: four walls as one folded ring, flutes vertical ----------------
   rounded score corners; the long walls stand T taller than the end walls (the outer flaps sit on the inner ones);
   walls bulge a hair, and the front wall carries a dent. groups: 0 outer liner, 1 inner liner, 2 top edge (flutes) */
export function boxRing({ W, D, H, T, rOut = 0.005, nPer = 18, nUp = 14, dent }) {
  /* perimeter path of the outer face, counter-clockwise seen from above, starting mid front wall (z = +D/2) */
  const pts = [];   /* [x, z, nx, nz, s] */
  const hw = W / 2, hd = D / 2, r = rOut;
  const straight = (x0, z0, x1, z1, nx, nz, n) => { for (let i = 0; i < n; i++) { const t = i / n; pts.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, nx, nz]); } };
  const nW = Math.round(nPer * W / 0.2), nD = Math.round(nPer * D / 0.2), nA = 5;
  /* front wall: from x=0 to x=hw-r at z=+hd, going +x */
  straight(0, hd, hw - r, hd, 0, 1, Math.ceil(nW / 2));
  const arcCW = (cx, cz, a0, a1, n) => { for (let i = 0; i < n; i++) { const a = a0 + (i / n) * (a1 - a0); pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r, Math.cos(a), Math.sin(a)]); } };
  arcCW(hw - r, hd - r, Math.PI / 2, 0, nA);
  straight(hw, hd - r, hw, -hd + r, 1, 0, nD);
  arcCW(hw - r, -hd + r, 0, -Math.PI / 2, nA);
  straight(hw - r, -hd, -hw + r, -hd, 0, -1, nW);
  arcCW(-hw + r, -hd + r, -Math.PI / 2, -Math.PI, nA);
  straight(-hw, -hd + r, -hw, hd - r, -1, 0, nD);
  arcCW(-hw + r, hd - r, Math.PI, Math.PI / 2, nA);
  straight(-hw + r, hd, 0, hd, 0, 1, Math.ceil(nW / 2));
  pts.push(pts[0].slice());
  let s = 0; pts.forEach((p, i) => { if (i) s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]); p[4] = s; });
  const N = pts.length - 1;
  /* wall top: long walls (|nz| dominant) at H, end walls at H - T */
  const topAt = (p) => H - T * clamp((Math.abs(p[2]) - 0.3) / 0.4, 0, 1) * 1 + 0 * p[3];
  const bulge = (p, y) => {
    const along = Math.abs(p[3]) > 0.5 ? Math.abs(p[0]) / hw : Math.abs(p[1]) / hd;   /* 0 centre .. 1 corner */
    const fb = Math.cos(along * Math.PI / 2) * Math.sin(clamp(y / H, 0, 1) * Math.PI);
    return 0.0018 * fb;
  };
  const dentAt = (p, y) => {
    if (!dent || p[3] < 0.5) return 0;   /* front wall only */
    const dx = p[0] - dent.x, dy = y - dent.y, d2 = (dx * dx) / (dent.rx * dent.rx) + (dy * dy) / (dent.ry * dent.ry);
    let v = -dent.depth * Math.exp(-d2 * 2.2);
    const crease = Math.abs(dx * Math.cos(dent.a) + dy * Math.sin(dent.a));   /* a sharp fold through the dent */
    v -= dent.depth * 0.5 * Math.exp(-d2 * 1.4) * Math.max(0, 1 - crease / 0.004);
    return v;
  };
  const B = new Builder();
  const P = (i, t, inner) => {
    const p = pts[i], y = t * topAt(p);
    const off = bulge(p, y) + dentAt(p, y) - (inner ? T : 0);
    /* corners: inner face radius shrinks */
    return [p[0] + p[2] * off, y, p[1] + p[3] * off, p[4], y];
  };
  B.group(0, () => B.grid(N, nUp, (u, v) => P(Math.round(u * N), v, false), false));
  const nOuter = B.p.length / 3;
  B.group(1, () => B.grid(N, nUp, (u, v) => P(Math.round(u * N), v, true), true));
  /* top edge (the folded crease shows as liner, use the flute stripe texture across the thickness) */
  B.group(2, () => B.grid(N, 1, (u, v) => { const i = Math.round(u * N), p = pts[i], y = topAt(p), off = -(v * T) + bulge(p, y); return [p[0] + p[2] * off, y, p[1] + p[3] * off, p[4] / 0.006, v]; }, false));
  /* bottom edge */
  B.group(2, () => B.grid(N, 1, (u, v) => { const i = Math.round(u * N), p = pts[i], off = -(v * T); return [p[0] + p[2] * off, 0, p[1] + p[3] * off, p[4] / 0.006, v]; }, true));
  const g = B.build();
  /* wear on the outer liner: the folded corners scuffed lighter, a band of grime along the foot, the dent's crease darker */
  const cnt = g.attributes.position.count, col = new Float32Array(cnt * 3).fill(1), pa = g.attributes.position.array;
  for (let i = 0; i < nOuter; i++) {
    const x = pa[i * 3], y = pa[i * 3 + 1], z = pa[i * 3 + 2];
    const cx = Math.max(0, 1 - (hw - Math.abs(x)) / 0.012), cz = Math.max(0, 1 - (hd - Math.abs(z)) / 0.012), corner = Math.min(cx, cz);
    const foot = Math.max(0, 1 - y / 0.014), lip = Math.max(0, 1 - (H - y) / 0.006);
    let k = 1 + corner * 0.1 + lip * 0.05 - foot * 0.16;
    if (dent) { const dd = dentAt(pts[0], 0); void dd; }
    col[i * 3] = k; col[i * 3 + 1] = k * (1 - foot * 0.02); col[i * 3 + 2] = k * (1 - foot * 0.04);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/* ---------------- a flat slab of board (flap, bottom): groups 0 top, 1 bottom, 2 cut edge across the flutes, 3 cut edge along them
   x in [-w/2, w/2], y in [-t/2, t/2], z in [-d, 0] (the hinge at z = 0). flutesAlongZ: true for outer flaps.
   bow: the flap's own curve (metres at the free edge) */
export function slab(w, t, d, { flutesAlongZ = true, bow = 0, nx = 8, nz = 6, cornerR = 0.0025 } = {}) {
  const B = new Builder(), hw = w / 2, ht = t / 2;
  const sag = (x, z) => { const fz = -z / d; return bow * fz * fz + bow * 0.4 * Math.sin((x / w + 0.5) * Math.PI) * fz; };
  /* round the two free corners by pulling the edge in (a cut corner is never perfectly square) */
  const ux = (x, z) => [x, z];
  const top = (u, v, y) => { const x = -hw + u * w, z = -v * d; const q = ux(x, z); return [q[0], y + sag(q[0], q[1]), q[1], flutesAlongZ ? q[0] : q[1], flutesAlongZ ? q[1] : q[0]]; };
  B.group(0, () => B.grid(nx, nz, (u, v) => top(u, v, ht), false));
  B.group(1, () => B.grid(nx, nz, (u, v) => top(u, v, -ht), true));
  /* the free edge (z = -d) and the hinge edge (z = 0) */
  const edgeZ = (z, flip) => B.grid(nx, 1, (u, v) => { const x = -hw + u * w, y = -ht + v * t; return [x, y + sag(x, z), z, x / 0.0074, v]; }, flip);
  const edgeX = (x, flip) => B.grid(nz, 1, (u, v) => { const z = -u * d, y = -ht + v * t; return [x, y + sag(x, z), z, z / 0.004, v]; }, flip);
  B.group(flutesAlongZ ? 2 : 3, () => { edgeZ(-d, true); edgeZ(0, false); });
  B.group(flutesAlongZ ? 3 : 2, () => { edgeX(-hw, true); edgeX(hw, false); });
  void cornerR;
  return B.build();
}

/* ---------------- the label: a grid we deform on the CPU (peel, flutter, press) ---------------- */
export function labelGrid(w, h, nx = 42, ny = 26) {
  const B = new Builder();
  B.grid(nx, ny, (u, v) => [u * w, 0, -v * h, u, v], false);   /* lies in xz (y up), origin at the label's corner (0,0) */
  const g = B.build(); g.attributes.position.setUsage(THREE.DynamicDrawUsage);
  g.userData = { nx, ny, w, h, rest: g.attributes.position.array.slice() };
  return g;
}

/* ---------------- tape: a strip following a path (polyline in a plane), with a path-length attribute ----------------
   path: [[x, y], ...] in the strip's own plane (x along, y up); the strip extends across z in [z0, z1]. */
export function tapeStrip(path, z0, z1, { seg = 4, n = 1, v0 = 1, v1 = 0 } = {}) {
  /* resample the path with small rounded bends */
  const pts = []; let L = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(len / 0.01) * seg / 4);
    for (let j = 0; j < k; j++) { const t = j / k; pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  pts.push(path[path.length - 1]);
  const s = [0]; for (let i = 1; i < pts.length; i++) { L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); s.push(L); }
  const N = pts.length - 1, B = new Builder(), across = [];
  B.group(0, () => B.grid(N, n, (u, v) => { const i = Math.round(u * N); across.push(v); return [pts[i][0], pts[i][1], z0 + (z1 - z0) * v, s[i], v0 + (v1 - v0) * v]; }, true));
  const g = B.build();
  /* aS: distance along the tape (m); aV: 0..1 across */
  const aS = new Float32Array(g.attributes.position.count), aV = new Float32Array(g.attributes.position.count);
  for (let j = 0, k = 0; j <= n; j++) for (let i = 0; i <= N; i++, k++) { aS[k] = s[i]; aV[k] = j / n; }
  g.setAttribute('aS', new THREE.BufferAttribute(aS, 1)); g.setAttribute('aV', new THREE.BufferAttribute(aV, 1));
  g.userData = { length: L };
  return g;
}

/* ---------------- crinkle-cut paper: a zig-zag ribbon ---------------- */
export function crinkle(len = 0.085, wid = 0.0058, folds = 5, amp = 0.0018) {
  /* crinkle-cut paper: a soft wave (not a sawtooth), sampled finely so its silhouette stays smooth */
  const B = new Builder();
  B.group(0, () => B.grid(folds * 8, 1, (u, v) => {
    const x = (u - 0.5) * len, y = Math.sin(u * folds * Math.PI * 2) * amp * 0.5;
    return [x, y + Math.sin(u * Math.PI * 2) * 0.004, (v - 0.5) * wid, u, v];
  }, false));
  return B.build();
}

/* ---------------- carton panels: shapes in dieline mm, extruded by the board's thickness ----------------
   returns a geometry with uv = atlas coords (0..1 over the dieline) on every vertex; caps are told apart in the shader by normal.z */
export function panelGeo(shape, dl, tb, mm, ox, oy) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: tb, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -tb);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const xm = p.getX(i) / mm + ox, ym = p.getY(i) / mm + oy;   /* back to dieline mm */
    uv.setXY(i, (xm - dl.X0) / dl.w, (ym - dl.Y0) / dl.h);
  }
  return g;
}
/* shape helpers in metres, relative to a hinge origin */
export function rectShape(x, y, w, h) { const s = new THREE.Shape(); s.moveTo(x, y); s.lineTo(x + w, y); s.lineTo(x + w, y + h); s.lineTo(x, y + h); s.closePath(); return s; }
/* a tongue / dust flap: tapered sides, rounded free corners */
export function flapShape(w, h, { taper = 0.15, round = 0.5, up = true } = {}) {
  const s = new THREE.Shape(), t = w * taper, rr = Math.min(h * round, w * 0.25), dir = up ? 1 : -1;
  s.moveTo(0, 0); s.lineTo(w, 0);
  s.lineTo(w - t * 0.3, dir * (h - rr)); s.quadraticCurveTo(w - t * 0.35, dir * h, w - t * 0.35 - rr, dir * h);
  s.lineTo(t * 0.35 + rr, dir * h); s.quadraticCurveTo(t * 0.35, dir * h, t * 0.3, dir * (h - rr));
  s.closePath();
  if (!up) { /* keep winding counter-clockwise */ const pts = s.getPoints(8).reverse(); return new THREE.Shape(pts); }
  return s;
}

/* rounded mat: a rounded-rect slab with a bevel */
export function roundSlab(w, d, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: h - 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.003, bevelSegments: 2, curveSegments: 6 });
  g.rotateX(-Math.PI / 2); g.translate(0, 0.002, 0);
  /* uv in metres from x,z */
  const p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i), p.getZ(i));
  return g;
}

export { clamp, smooth };
