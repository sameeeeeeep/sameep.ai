/* door3d.js: box3d.js plus doorPose() for the storyboard landing (sb.js): the parcel stays on her mat and opens there.
   box3d.js: the packaging, live in 3D (the sameep.ai hero's approach: real geometry, posed by scroll).
   One parameter u drives everything, so it scrubs both ways:
     u 0 -> 1  the brand's carton folds up around the lipstick, lies down and drops into a kraft mailer with paper fill
     u 1 -> 2  the mailer's flaps close, it is taped and the shipping label goes on (leaving the warehouse)
     u 2 -> 3  the courier scans the label and the parcel lands, still shut, on her doormat
   Scrolling back runs it in reverse: off the doormat, back through the scan, label peels off, tape off, flaps open.
   Exposes window.Box3D = { el, pose(u), size(px) }. Brand comes from the config passed to init(). */
import * as THREE from './vendor/three.module.min.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (u, a, b) => clamp((u - a) / (b - a), 0, 1);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const D90 = Math.PI / 2;

function noiseCanvas(base, fibres, size = 256) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 2200; i++) {
    g.fillStyle = fibres[i % fibres.length];
    g.globalAlpha = 0.05 + Math.random() * 0.08;
    g.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 6, 1);
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function cartonFace(brand, product, accent) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 840;
  const g = c.getContext('2d');
  g.fillStyle = '#efe7d8'; g.fillRect(0, 0, 256, 840);
  g.fillStyle = accent; g.fillRect(0, 560, 256, 6);
  g.fillStyle = '#2a211b';
  g.textAlign = 'center';
  g.font = '500 58px Inter, system-ui, sans-serif';
  g.fillText(brand, 128, 470);
  g.font = '400 22px Inter, system-ui, sans-serif';
  g.fillStyle = '#5b4e44';
  const words = product.split(' '); let line = '', y = 620;
  words.forEach((w) => { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > 210) { g.fillText(line, 128, y); y += 30; line = w; } else line = t; });
  if (line) g.fillText(line, 128, y);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1;   /* the front panel is seen from its back face */
  return t;
}

function labelFace(cfg) {
  const sh = cfg.shipping || {}, b = cfg.brand || {};
  const c = document.createElement('canvas'); c.width = 600; c.height = 400;
  const g = c.getContext('2d');
  g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, 600, 400);
  g.strokeStyle = '#1b1a17'; g.lineWidth = 3; g.strokeRect(10, 10, 580, 380);
  g.fillStyle = '#1b1a17';
  g.font = '600 30px Inter, system-ui, sans-serif'; g.fillText((sh.courier || 'Courier') + '  ' + (sh.service || ''), 28, 54);
  g.font = '500 24px Spline Sans Mono, monospace'; g.fillText('AWB ' + (sh.awb || '0000 0000 0000'), 28, 92);
  g.fillRect(10, 108, 580, 3);
  g.font = '400 20px Inter, system-ui, sans-serif'; g.fillStyle = '#4a4740'; g.fillText('TO', 28, 140);
  g.fillStyle = '#1b1a17'; g.font = '600 28px Inter, system-ui, sans-serif'; g.fillText(sh.to_name || 'Customer', 28, 174);
  g.font = '400 26px Inter, system-ui, sans-serif'; g.fillText((sh.to_line || '') + ' ' + (sh.pin || ''), 28, 208);
  g.font = '400 20px Inter, system-ui, sans-serif'; g.fillStyle = '#4a4740';
  g.fillText('FROM  ' + (b.name || '') + ', ' + (b.city || '') + '    ' + (sh.weight || ''), 28, 246);
  let x = 28; let seed = 11;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#1b1a17';
  while (x < 470) { const w = 2 + Math.floor(r() * 5); g.fillRect(x, 270, w, 90); x += w + 2 + Math.floor(r() * 4); }
  g.font = '600 40px Spline Sans Mono, monospace'; g.fillText(sh.pin || '', 482, 336);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/* doorstep light by time of day: sun colour, strength and position (low = long shadows), sky fill colour and strength */
const DOOR_LIGHT = {
  /* 7:10 pm: low warm sun from the right, long shadows, warm fill */
  dusk: { sun: 0xffc48c, si: 2.8, pos: [4.5, 2.2, 2.4], sky: 0xffe2c4, hi: 1.15, gnd: 0xb9a58c },
  /* 7 to 9 am: cool bright light from the left, the sun higher so the shadows are short, a faint warm edge only */
  morning: { sun: 0xfff6ec, si: 2.9, pos: [-2.2, 6.2, 3.2], sky: 0xe6eefb, hi: 1.35, gnd: 0xc4c3bd },
  /* midday: neutral, overhead */
  day: { sun: 0xffffff, si: 2.6, pos: [-1.2, 7, 2.5], sky: 0xfffaf2, hi: 1.6, gnd: 0xbdb2a2 },
};

export function init(cfg, kitSrc) {
  const brand = (cfg.brand && cfg.brand.name) || 'Brand';
  const product = (cfg.brand && cfg.brand.product) || '';
  const accent = (cfg.palette && cfg.palette.accent) || '#c8664a';
  /* the doorstep's time of day follows the config: shipping.light ('morning' | 'day' | 'dusk'),
     else read from shipping.delivered_at (before noon = morning, 4 pm on = dusk); no time = dusk (the 6:08 pm default) */
  const doorLight = (function () {
    const sh = cfg.shipping || {};
    if (sh.light && DOOR_LIGHT[sh.light]) return DOOR_LIGHT[sh.light];
    const m = String(sh.delivered_at || '').match(/(\d{1,2})(?::\d{2})?\s*(am|pm)/i);
    if (!m) return DOOR_LIGHT.dusk;
    const hr = (+m[1] % 12) + (m[2].toLowerCase() === 'pm' ? 12 : 0);
    return hr < 12 ? DOOR_LIGHT.morning : hr < 16 ? DOOR_LIGHT.day : DOOR_LIGHT.dusk;
  })();

  const el = document.createElement('canvas');
  el.className = 'ly ly-3d';
  const renderer = new THREE.WebGLRenderer({ canvas: el, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const hemi = new THREE.HemisphereLight(0xfffaf2, 0xb9a58c, 1.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(-2.5, 5, 3.5); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: 0.5, far: 20 });
  sun.shadow.radius = 6;
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -D90; ground.receiveShadow = true; scene.add(ground);

  /* ---------- materials ---------- */
  const kraftT = noiseCanvas('#b88a57', ['#8f6639', '#d2a873', '#a77a48']);
  const kraftInT = noiseCanvas('#c9a173', ['#a98152', '#dcb88a']);
  const kraft = new THREE.MeshStandardMaterial({ map: kraftT, roughness: 0.9 });
  const kraftIn = new THREE.MeshStandardMaterial({ map: kraftInT, roughness: 0.95 });
  const paperT = noiseCanvas('#efe7d8', ['#e2d7c4', '#f7f1e6'], 128);
  const cartonMat = new THREE.MeshStandardMaterial({ map: paperT, roughness: 0.75, side: THREE.DoubleSide });
  const cartonFront = new THREE.MeshStandardMaterial({ map: cartonFace(brand, product, accent), roughness: 0.7, side: THREE.DoubleSide });
  const tapeMat = new THREE.MeshStandardMaterial({ color: 0xc49a63, roughness: 0.4, transparent: true, opacity: 0.92 });

  /* ---------- the carton: a tuck-end box, folded from flat ---------- */
  const CW = 0.3, CD = 0.3, CH = 1.0;
  const carton = new THREE.Group(); scene.add(carton);
  const strip = new THREE.Group(); carton.add(strip);         /* the folding chain, rooted at the back panel */
  function panel(w, h, mat, parent, hingeX) {
    const g = new THREE.PlaneGeometry(w, h); g.translate(w / 2, 0, 0);
    const m = new THREE.Mesh(g, mat); m.castShadow = true;
    const pivot = new THREE.Group(); pivot.position.x = hingeX; pivot.add(m); parent.add(pivot);
    return pivot;
  }
  function flap(parentPivot, w, d, top, xOff) {
    const g = new THREE.PlaneGeometry(w, d); g.translate(w / 2, d / 2, 0);
    const m = new THREE.Mesh(g, cartonMat); m.castShadow = true;
    const p = new THREE.Group(); p.position.set(xOff || 0, top ? CH / 2 : -CH / 2, 0);
    if (!top) p.scale.y = -1;
    p.add(m); parentPivot.add(p); return p;
  }
  const back = panel(CW, CH, cartonMat, strip, 0);
  const rside = panel(CD, CH, cartonMat, back, CW);
  const front = panel(CW, CH, cartonFront, rside, CD);
  const lside = panel(CD, CH, cartonMat, front, CW);
  const flaps = {
    tuckT: flap(front, CW, CD, true), tuckB: flap(front, CW, CD, false),
    dustRT: flap(rside, CD, CD * 0.5, true), dustRB: flap(rside, CD, CD * 0.5, false),
    dustLT: flap(lside, CD, CD * 0.5, true), dustLB: flap(lside, CD, CD * 0.5, false)
  };

  /* the lipstick: the kit's own photo on a card, inside the carton */
  const loader = new THREE.TextureLoader();
  const heroT = loader.load(kitSrc('hero'), () => { dirty = true; }); heroT.colorSpace = THREE.SRGBColorSpace;
  const lip = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: heroT, transparent: true, alphaTest: 0.02 }));
  lip.scale.set(0.98, 0.98, 1);
  carton.add(lip);

  /* ---------- the mailer: base, walls, four hinged flaps ---------- */
  const MW = 1.7, MD = 1.1, MH = 0.42;
  const mailer = new THREE.Group(); scene.add(mailer);
  function box(w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; mailer.add(m); return m;
  }
  const T = 0.02;
  box(MW, T, MD, kraftIn, 0, T / 2, 0);
  box(MW, MH, T, kraft, 0, MH / 2, MD / 2);
  box(MW, MH, T, kraft, 0, MH / 2, -MD / 2);
  box(T, MH, MD, kraft, MW / 2, MH / 2, 0);
  box(T, MH, MD, kraft, -MW / 2, MH / 2, 0);
  function mflap(w, d, pos, axis, dir) {
    const g = new THREE.BoxGeometry(w, T, d);
    if (axis === 'x') g.translate(0, 0, -dir * d / 2); else g.translate(-dir * w / 2, 0, 0);
    const m = new THREE.Mesh(g, kraft); m.castShadow = true; m.receiveShadow = true;
    const p = new THREE.Group(); p.position.copy(pos); p.add(m); mailer.add(p);
    p.userData = { axis, dir }; return p;
  }
  const mf = {
    front: mflap(MW, MD / 2, new THREE.Vector3(0, MH, MD / 2), 'x', 1),
    back: mflap(MW, MD / 2, new THREE.Vector3(0, MH, -MD / 2), 'x', -1),
    left: mflap(MD * 0.42, MD, new THREE.Vector3(-MW / 2, MH, 0), 'z', -1),
    right: mflap(MD * 0.42, MD, new THREE.Vector3(MW / 2, MH, 0), 'z', 1)
  };
  /* closed = flat over the top (0); open = turned out past vertical */
  function setFlap(p, closed, lift) {
    const open = (1 - closed) * (Math.PI * 0.62);
    if (p.userData.axis === 'x') p.rotation.x = p.userData.dir * open; else p.rotation.z = -p.userData.dir * open;
    p.position.y = MH + (lift || 0);
  }
  const tape = new THREE.Mesh(new THREE.BoxGeometry(1, 0.004, 0.2), tapeMat);
  tape.position.set(0, MH + T + 0.004, 0); mailer.add(tape);

  /* the shipping label: hinged at its left edge so it can peel off and press on */
  const LW = 0.78, LH = 0.52;
  const labelPivot = new THREE.Group(); labelPivot.position.set(-0.62, MH + 0.024 + T + 0.006, 0.26); mailer.add(labelPivot);
  const lg = new THREE.PlaneGeometry(LW, LH); lg.translate(LW / 2, 0, 0); lg.rotateX(-D90);
  const labelMat = new THREE.MeshStandardMaterial({ map: labelFace(cfg), roughness: 0.6, side: THREE.DoubleSide, transparent: true });
  const label = new THREE.Mesh(lg, labelMat); label.castShadow = true; labelPivot.add(label);

  /* the courier's scan: a thin red line sweeping the label */
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(0.012, LH + 0.12), new THREE.MeshBasicMaterial({ color: 0xe0453a, transparent: true, opacity: 0.9 }));
  beam.rotation.x = -D90; mailer.add(beam);


  /* ---------- the world around it: the parcel is one of many (the sameep.ai CV-pile idea) ---------- */
  scene.fog = new THREE.Fog(0xf3f1ec, 6, 12);
  let sseed = 21; const srnd = () => ((sseed = (sseed * 16807) % 2147483647) / 2147483647);
  const steel = new THREE.MeshStandardMaterial({ color: 0x9a9a94, roughness: 0.45, metalness: 0.6 });
  const belt = new THREE.MeshStandardMaterial({ color: 0x3a3936, roughness: 0.7 });
  const kraftDark = new THREE.MeshStandardMaterial({ map: kraftT, color: 0xd9cbb8, roughness: 0.9 });
  const labelBlank = new THREE.MeshStandardMaterial({ color: 0xf7f5ef, roughness: 0.6 });
  function kbox(parent, w, h, d, x, y, z, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  function parcel(parent, w, h, d, x, y, z, ry, withLabel) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry || 0; parent.add(g);
    kbox(g, w, h, d, 0, h / 2, 0, srnd() < 0.5 ? kraft : kraftDark);
    kbox(g, w + 0.01, 0.006, Math.min(0.18, d * 0.25), 0, h + 0.003, 0, tapeMat);
    if (withLabel) kbox(g, w * 0.36, 0.004, d * 0.42, -w * 0.18, h + 0.006, d * 0.18, labelBlank);
    return g;
  }

  /* the warehouse: a conveyor (the parcel rides it) and a rack of stock behind */
  const wh = new THREE.Group(); scene.add(wh);
  kbox(wh, 12, 0.05, 1.5, 0, -0.025, 0, belt);
  for (let x = -6; x <= 6; x += 0.32) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.55, 12), steel);
    r.rotation.x = D90; r.position.set(x, -0.1, 0); wh.add(r);
  }
  kbox(wh, 12, 0.12, 0.05, 0, -0.07, 0.8, steel); kbox(wh, 12, 0.12, 0.05, 0, -0.07, -0.8, steel);
  [-5, -2, 1, 4].forEach((x) => { kbox(wh, 0.06, 0.9, 0.06, x, -0.55, 0.72, steel); kbox(wh, 0.06, 0.9, 0.06, x, -0.55, -0.72, steel); });
  [-2.6, 2.7, 5.4, -5.3].forEach((x) => parcel(wh, MW * (0.8 + srnd() * 0.3), MH * (0.9 + srnd() * 0.4), MD * (0.85 + srnd() * 0.3), x, 0, (srnd() - 0.5) * 0.2, (srnd() - 0.5) * 0.15, true));
  const rack = new THREE.Group(); rack.position.set(0, -1.0, -3.0); wh.add(rack);
  [-4.5, -1.5, 1.5, 4.5].forEach((x) => kbox(rack, 0.08, 3.2, 0.08, x, 1.6, 0.5, steel) && kbox(rack, 0.08, 3.2, 0.08, x, 1.6, -0.5, steel));
  [0.15, 1.15, 2.15].forEach((y) => {
    kbox(rack, 9.2, 0.05, 1.05, 0, y, 0, steel);
    for (let x = -4.3; x < 4.2;) {
      const w = 0.7 + srnd() * 0.9, h = 0.35 + srnd() * 0.45, d = 0.6 + srnd() * 0.35;
      parcel(rack, w, h, d, x + w / 2, y + 0.025, (srnd() - 0.5) * 0.15, 0, srnd() < 0.4);
      if (srnd() < 0.45) parcel(rack, w * 0.9, h * 0.8, d * 0.9, x + w / 2, y + 0.025 + h, 0, (srnd() - 0.5) * 0.2, false);
      x += w + 0.05;
    }
  });

  /* the van: cargo floor, walls, and a pile of other people's parcels */
  const van = new THREE.Group(); scene.add(van);
  const vanMetal = new THREE.MeshStandardMaterial({ color: 0xc9cac6, roughness: 0.55, metalness: 0.2 });
  const vanFloor = new THREE.MeshStandardMaterial({ color: 0x7d807f, roughness: 0.8, metalness: 0.2 });
  kbox(van, 5.6, 0.06, 3.4, 0, -0.03, -0.4, vanFloor);
  for (let x = -2.7; x <= 2.7; x += 0.18) kbox(van, 0.05, 0.012, 3.4, x, 0.006, -0.4, vanMetal);
  kbox(van, 5.6, 2.4, 0.05, 0, 1.2, -2.1, vanMetal);
  kbox(van, 0.05, 2.4, 3.4, -2.8, 1.2, -0.4, vanMetal);
  for (let x = -2.6; x <= 2.6; x += 0.5) kbox(van, 0.03, 2.3, 0.04, x, 1.15, -2.07, vanMetal);
  [[-1.9, -1.4], [-0.7, -1.5], [0.5, -1.45], [1.7, -1.4], [-2.2, -0.2], [2.2, -0.3], [-2.1, 0.8]].forEach(([x, z], i) => {
    let y = 0; const n = 1 + Math.floor(srnd() * 3);
    for (let k = 0; k < n; k++) {
      const w = 0.8 + srnd() * 0.7, h = 0.3 + srnd() * 0.4, d = 0.6 + srnd() * 0.4;
      parcel(van, w, h, d, x, y, z, (srnd() - 0.5) * 0.5, srnd() < 0.6); y += h;
    }
  });

  /* her door: doormat, wall, door */
  const door = new THREE.Group(); scene.add(door);
  const matT = noiseCanvas('#8a6a3f', ['#6e5230', '#a8834f', '#5b4327'], 256); matT.repeat.set(3, 2);
  kbox(door, 2.4, 0.03, 1.55, 0, -0.016, 0.1, new THREE.MeshStandardMaterial({ map: matT, roughness: 1 }));
  const plaster = new THREE.MeshStandardMaterial({ color: 0xe6e0d4, roughness: 0.95 });
  kbox(door, 16, 4.2, 0.12, 0, 2.1, -1.6, plaster);
  kbox(door, 1.7, 2.7, 0.08, 0.7, 1.35, -1.52, new THREE.MeshStandardMaterial({ color: 0x5a3b28, roughness: 0.6 }));
  kbox(door, 1.86, 0.1, 0.14, 0.7, 2.73, -1.52, plaster);
  kbox(door, 0.16, 0.035, 0.06, 0.08, 1.25, -1.46, steel);
  kbox(door, 18, 0.02, 22, 0, -0.04, 9, new THREE.MeshStandardMaterial({ color: 0xd8d1c4, roughness: 0.9 }));
  /* a lived-in doorstep: a potted plant by the frame, a number on the door */
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.5, 24), new THREE.MeshStandardMaterial({ color: 0xb5643f, roughness: 0.8 }));
  pot.position.set(-1.25, 0.25, -1.1); pot.castShadow = true; door.add(pot);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4f6b3a, roughness: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < 14; i++) {
    const lf = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.7), leafMat);
    const a = (i / 14) * Math.PI * 2;
    lf.position.set(-1.25 + Math.cos(a) * 0.08, 0.78 + srnd() * 0.15, -1.1 + Math.sin(a) * 0.08);
    lf.rotation.set(Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5); lf.castShadow = true; door.add(lf);
  }
  const plateC = document.createElement('canvas'); plateC.width = 128; plateC.height = 64;
  const pg = plateC.getContext('2d'); pg.fillStyle = '#e9e2d2'; pg.fillRect(0, 0, 128, 64); pg.fillStyle = '#2a211b';
  pg.font = '600 34px Inter, system-ui, sans-serif'; pg.textAlign = 'center'; pg.fillText('B-14', 64, 44);
  const plateT = new THREE.CanvasTexture(plateC); plateT.colorSpace = THREE.SRGBColorSpace;
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.17), new THREE.MeshStandardMaterial({ map: plateT, roughness: 0.5 }));
  plate.position.set(0.7, 2.05, -1.475); door.add(plate);

  /* paper fill: crinkled kraft strips */
  const fill = new THREE.Group(); mailer.add(fill);
  const fillGeo = new THREE.BoxGeometry(0.16, 0.012, 0.035);
  const fillMats = [new THREE.MeshStandardMaterial({ color: 0xc19563, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0xa97c4b, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0xd3ad7c, roughness: 0.9 })];
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) {
    const m = new THREE.Mesh(fillGeo, fillMats[i % 3]);
    m.position.set((rnd() - 0.5) * (MW - 0.12), 0.03 + rnd() * 0.07, (rnd() - 0.5) * (MD - 0.12));
    m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    m.castShadow = true; fill.add(m);
  }


  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  /* ---------- the physical middle stops: a surface and a few things on it (digital stops stay on the plain page) ---------- */
  function grainCanvas(base, dark, light, lines) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 512;
    const g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < (lines || 140); i++) {
      g.strokeStyle = i % 3 ? dark : light; g.globalAlpha = 0.06 + srnd() * 0.1; g.lineWidth = 1 + srnd() * 3;
      const y = srnd() * 512; g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x / 60 + i) * 4);
      g.stroke();
    }
    g.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function gridCanvas() {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d'); g.fillStyle = '#3f6b55'; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(230,240,220,.35)'; g.lineWidth = 1;
    for (let i = 0; i <= 512; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function poCanvas() {
    const sh = cfg.shipping || {}, b = cfg.brand || {};
    const c = document.createElement('canvas'); c.width = 600; c.height = 820;
    const g = c.getContext('2d'); g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, 600, 820);
    g.fillStyle = '#1b1a17'; g.font = '600 34px Inter, system-ui, sans-serif'; g.fillText('Purchase order', 44, 80);
    const po = cfg.po_doc || {};
    g.font = '400 22px Spline Sans Mono, monospace'; g.fillStyle = '#4a4740'; g.fillText((po.id || 'PO-0142') + '    ' + (b.name || ''), 44, 120);
    g.fillStyle = '#d9d4c8';
    for (let y = 180; y < 700; y += 46) g.fillRect(44, y, 512, 2);
    g.fillStyle = '#6f6a60'; g.font = '400 20px Inter, system-ui, sans-serif';
    ['Item', po.item || 'Ribbed tube, 5,000', 'Unit', 'Terms: ' + (po.terms || '45 days')].forEach((tx, i) => g.fillText(tx, 48, 172 + i * 46));
    g.strokeStyle = '#2b4a8a'; g.lineWidth = 3; g.beginPath(); g.moveTo(330, 740); g.bezierCurveTo(360, 700, 400, 780, 440, 720); g.bezierCurveTo(460, 700, 480, 760, 520, 730); g.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const M = (o) => new THREE.MeshStandardMaterial(o);
  const oak = M({ map: grainCanvas('#c9a87c', '#8c6a43', '#e3c79c'), roughness: 0.7 });
  const walnut = M({ map: grainCanvas('#5a3d2a', '#2f1f14', '#7b5638'), roughness: 0.6 });
  const benchSteel = M({ color: 0xb9bcbc, roughness: 0.35, metalness: 0.7 });
  const white = M({ color: 0xf4f2ec, roughness: 0.6 });
  const ceramic = M({ color: 0xefe9de, roughness: 0.35 });
  const chai = M({ color: 0xa8774a, roughness: 0.3 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transmission: 0.9, thickness: 0.2, transparent: true, opacity: 0.35 });
  const concrete = M({ map: noiseCanvas('#cfcac0', ['#b9b3a8', '#dcd7cd'], 256), roughness: 0.95 });
  const DESK = { p: V(0, 2.3, 5.3), t: V(0, 0.78, 0) }, TOP = { p: V(0, 6.6, 0.02), t: V(0, 0, 0) };
  const DESKS = {};
  const ORDER_AT = 10, LAST = 14;   /* v2 stop indices: the order screen, the doorstep */
  function desk(i, cam, light) { const g = new THREE.Group(); scene.add(g); g.visible = false; DESKS[i] = { g, cam: cam || DESK, light: light || 'day', items: [] }; return DESKS[i]; }
  function put(d, mesh, x, y, z, ry) { mesh.position.set(x, y, z); if (ry) mesh.rotation.y = ry; mesh.castShadow = true; mesh.receiveShadow = true; d.g.add(mesh); d.items.push({ m: mesh, y }); return mesh; }
  /* phone: the desk tops run toward the camera (the back edge stays put) so the table fills the tall screen to the bottom */
  const DEEP = [];
  const phoneSteel = M({ color: 0xc6c9c9, roughness: 0.45, metalness: 0.3 });   /* the long steel run toward the camera reads as a dark band at full metalness */
  function slab(d, mat, w, dd) { const m = new THREE.Mesh(new THREE.BoxGeometry(w || 9, 0.08, dd || 6), mat); m.position.set(0, -0.04, -0.6); m.receiveShadow = true; d.g.add(m); DEEP.push({ m, dd: dd || 6, back: -0.6 - (dd || 6) / 2, mat, pmat: mat === benchSteel ? phoneSteel : null }); return m; }
  function cup(d, x, z) {
    const c = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.32, 24), ceramic); body.position.y = 0.16; body.castShadow = true; c.add(body);
    const tea = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.01, 24), chai); tea.position.y = 0.29; c.add(tea);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.022, 8, 16), ceramic); handle.position.set(0.19, 0.17, 0); c.add(handle);
    return put(d, c, x, 0, z);
  }
  function pencil(d, x, z, ry) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6), M({ color: 0xe0b23a, roughness: 0.5 }));
    m.rotation.z = Math.PI / 2; const g = new THREE.Group(); g.add(m); g.rotation.y = ry || 0; return put(d, g, x, 0.03, z);
  }
  function sheet(d, x, z, ry, w, h, map) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w || 1.3, h || 1.7), map ? M({ map, roughness: 0.8 }) : white);
    m.rotation.x = -D90; const g = new THREE.Group(); g.add(m); g.rotation.y = ry || 0; return put(d, g, x, 0.006, z);
  }

  /* 0 voice: her bedside at 12:52 am */
  { const d = desk(0, DESK, 'night'); slab(d, walnut, 5, 3.5);
    put(d, new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.6, 24), glass), 1.25, 0.3, -0.5);
    const lamp = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.08, 24), M({ color: 0x2b2722, roughness: 0.4 })); base.position.y = 0.04; lamp.add(base);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.2, 8), M({ color: 0x2b2722 })); stem.position.y = 0.64; lamp.add(stem);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 0.42, 24, 1, true), M({ color: 0xf0e2c4, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x6b4a20, emissiveIntensity: 0.5 })); shade.position.y = 1.3; lamp.add(shade);
    put(d, lamp, -1.5, 0, -0.9); }
  /* 1 meeting: oak table, two chai cups, a pencil, loose sheets under the sketch */
  { const d = desk(1); slab(d, oak);
    sheet(d, 0, 0.1, 0.06, 1.5, 1.9); sheet(d, 0.25, -0.2, -0.12, 1.4, 1.8);
    cup(d, -1.35, -0.4); cup(d, 1.45, 0.2); pencil(d, 0.95, 0.75, 0.6); }
  /* 2 hire: a steel workbench, a tray of small pots */
  { const d = desk(2); slab(d, benchSteel);
    for (let i = 0; i < 6; i++) put(d, new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 20), M({ color: [0x8f3a2a, 0xa5412e, 0xb24a32, 0x9b3527, 0xc0553a, 0x84321f][i], roughness: 0.4 })), 1.3 + (i % 3) * 0.26, 0.06, 0.2 + Math.floor(i / 3) * 0.26); }
  /* 3 formula: a white lab tray */
  { const d = desk(4); slab(d, benchSteel);
    const tray = put(d, new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.06, 1.6), white), 0, 0.03, 0); DEEP.push({ m: tray, dd: 1.6, back: -0.8 });
    for (let i = 0; i < 8; i++) { srnd(); srnd(); } }   /* the voting cards read as stray paper; the votes live in the messages. srnd() still advances so later desks keep their layout */
  /* 4 packaging: a cutting mat and a steel ruler */
  { const d = desk(5); slab(d, oak); const gt = gridCanvas(); gt.repeat.set(3, 2);
    put(d, new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.02, 2.4), M({ map: gt, roughness: 0.8 })), 0, 0.01, 0);
    put(d, new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.015, 0.14), M({ color: 0xc8cbcc, metalness: 0.8, roughness: 0.3 })), 0.3, 0.03, 1.05, 0.05); }
  /* 5 po: the purchase order on the desk, a pen */
  { const d = desk(6); slab(d, oak);
    sheet(d, 0, 0, 0.04, 2.2, 3.0, poCanvas()); pencil(d, 1.5, 0.7, -0.4); }
  /* 6 inbound: from above, among other bulk cartons */
  { const d = desk('x6', TOP); slab(d, concrete, 12, 10);
    [[-2.6, -1.6], [2.6, -1.6], [-2.6, 1.6], [2.6, 1.6], [0, -2.9], [0, 2.9], [-4.6, 0], [4.6, 0]].forEach(([x, z], i) => {
      const bx = new THREE.Group(); kbox(bx, 2.2, 0.9, 2.2, 0, 0.45, 0, i % 2 ? kraft : kraftDark); kbox(bx, 2.22, 0.006, 0.24, 0, 0.903, 0, tapeMat);
      put(d, bx, x, 0, z, (srnd() - 0.5) * 0.2); }); }
  /* 7 qc: a white tray under a magnifier lamp */
  { const d = desk(3); slab(d, white);
    put(d, new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 1.5), M({ color: 0xffffff, roughness: 0.4 })), 0, 0.025, 0);
    const lamp = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 12, 48), M({ color: 0xeeeeea, roughness: 0.3 })); ring.rotation.x = D90 * 0.55; ring.position.set(0.55, 1.55, 0.55); lamp.add(ring);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.48, 48), glass); lens.rotation.x = D90 * 0.55; lens.position.copy(ring.position); lamp.add(lens);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.9, 8), M({ color: 0xdcdcd6, metalness: 0.4 })); arm.position.set(1.15, 0.85, -0.2); arm.rotation.z = 0.5; lamp.add(arm);
    put(d, lamp, 0, 0, 0); }
  /* 8 kitting: from above, a grey compartment tray */
  { const d = desk('x8', TOP); slab(d, concrete, 12, 10);
    const tray = new THREE.Group(); const grey = M({ color: 0x8c8f8f, roughness: 0.6 });
    kbox(tray, 4.4, 0.05, 4.2, 0, 0.025, 0, grey);
    [[-2.2, 0, 0.05, 4.2], [2.2, 0, 0.05, 4.2], [0, -2.1, 4.4, 0.05], [0, 2.1, 4.4, 0.05], [0, 0.05, 4.4, 0.05]].forEach(([x, z, w, dd]) => kbox(tray, w, 0.25, dd, x, 0.125, z, grey));
    put(d, tray, 0, 0, 0); }
  /* v2: inbound and kitting are gone; their desks are built (keeps srnd order) and dropped */
  ['x6', 'x8'].forEach((k) => { scene.remove(DESKS[k].g); delete DESKS[k]; });
  /* 9 shoot: a paper sweep and a softbox */
  { const d = desk(7); const paper = M({ color: 0xf6f3ec, roughness: 0.9, side: THREE.DoubleSide });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), paper); floor.rotation.x = -D90; floor.position.set(0, 0, 0.3); floor.receiveShadow = true; d.g.add(floor);
    const fg = new THREE.PlaneGeometry(6, 8); fg.translate(0, -4, 0); const front = new THREE.Mesh(fg, paper); front.rotation.x = -D90; front.position.set(0, 0, 1.8); front.receiveShadow = true; front.visible = false; d.g.add(front); DEEP.push({ m: front, show: true });
    const curve = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 6, 24, 1, true, 0, Math.PI / 2), paper); curve.rotation.z = D90; curve.rotation.y = 0; curve.position.set(0, 1.2, -1.2); curve.rotation.set(0, 0, D90); curve.receiveShadow = true;
    const cg = new THREE.Group(); cg.add(curve); cg.rotation.y = -D90; d.g.add(cg); cg.position.set(0, 0, 0);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), paper); back.position.set(0, 3.2, -2.4); d.g.add(back);
    const sb = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 8), M({ color: 0x222222 })); pole.position.y = 1.3; sb.add(pole);
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.0, 0.35), M({ color: 0x1b1b1b, roughness: 0.6 })); box.position.set(0.3, 2.5, 0); box.rotation.y = 0.7; sb.add(box);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.92), M({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9 })); face.position.set(0.42, 2.5, 0.12); face.rotation.y = 0.7; sb.add(face);
    sb.scale.setScalar(0.8); put(d, sb, -2.9, 0, -1.7); }

  /* ---------- the pose ---------- */
  let dirty = true, lastU = -1, lastDrop = -1, k = 1, vw = 10, vh = 10;
  const CAMS = {
    fold: { p: V(0, 0.75, 4.6), t: V(0, 0.5, 0) },          /* face-on to the carton, on the belt */
    packed: { p: V(0.9, 3.0, 5.2), t: V(0, 0.1, -0.5) },    /* the mailer on the conveyor, the rack behind */
    van: { p: V(-1.3, 2.5, 4.6), t: V(0, 0.4, -0.6) },      /* in the van, in the pile */
    door: { p: V(1.1, 2.1, 5.6), t: V(0.2, 0.7, -0.6) }     /* her door */
  };
  function slide(g, inA, inB, outA, outB, u) {
    const a = seg(u, inA, inB), b = seg(u, outA, outB);
    g.position.x = lerp(-9, 0, ease(a)) + lerp(0, 9, ease(b));   /* time runs left to right */
    g.visible = a > 0.001 && b < 0.999;
  }

  /* drop: the opening drop onto her doormat, 0 (in the air) .. 1 (settled); scroll keeps it at 1 */
  let lastSp = -1;
  function deskPose(sp) {
    [carton, mailer, wh, van, door].forEach((o) => { o.visible = false; });
    Object.keys(DESKS).forEach((key) => {
      const i = +key, d = DESKS[i], a = sp - i;
      if (a <= -1 || a >= 1) { d.g.visible = false; return; }
      d.g.visible = true;
      d.g.position.x = a < 0 ? lerp(-9, 0, ease(a + 1)) : lerp(0, 9, ease(a));   /* time runs left to right */
      const enter = a < 0 ? a + 1 : 1;
      d.items.forEach((it, n) => {
        const f = ease(clamp(enter * 1.9 - 0.35 - n * 0.14, 0, 1));            /* things land one by one */
        it.m.position.y = it.y + (1 - f) * 1.6;
        it.m.visible = f > 0.001;
      });
    });
    const i0 = Math.floor(sp), i1 = Math.min(LAST, i0 + 1), f = ease(sp - i0);
    const c0 = (DESKS[i0] || {}).cam || DESK, c1 = (DESKS[i1] || {}).cam || DESK;
    const p = c0.p.clone().lerp(c1.p, f), t = c0.t.clone().lerp(c1.t, f);
    p.sub(t).multiplyScalar(k).add(t);
    camera.position.copy(p); camera.lookAt(t);
    const night = (i0 === 0 ? 1 - f : 0);
    sun.color.set(0xffffff).lerp(new THREE.Color(0xffb878), night);
    sun.intensity = lerp(2.3, 1.2, night); sun.position.set(lerp(-2.5, -3.5, night), lerp(5, 3, night), lerp(3.5, 1.5, night));
    hemi.intensity = lerp(1.6, 0.55, night); hemi.color.set(0xfffaf2); hemi.groundColor.set(0xb9a58c);
    ground.position.y = 0;
    scene.fog.near = 5.2 * k; scene.fog.far = 11.5 * k;
    renderer.render(scene, camera);
  }

  function pose(u, drop, sp) {
    u = clamp(u, 0, 3); drop = drop == null ? 1 : clamp(drop, 0, 1); sp = sp == null ? LAST : sp;
    if (Math.abs(u - lastU) < 1e-4 && Math.abs(drop - lastDrop) < 1e-4 && Math.abs(sp - lastSp) < 1e-4 && !dirty) return;
    lastU = u; lastDrop = drop; lastSp = sp; dirty = false;
    if (sp <= ORDER_AT + 0.0001) { deskPose(sp); return; }   /* the order is a digital moment: plain page */
    Object.keys(DESKS).forEach((key) => { DESKS[key].g.visible = false; });
    carton.visible = true;

    /* 1. fold the carton (u 0..0.5): sides, then dust flaps, then tuck flaps */
    const f1 = ease(seg(u, 0.0, 0.3)), f2 = ease(seg(u, 0.26, 0.4)), f3 = ease(seg(u, 0.36, 0.5));
    rside.rotation.y = -f1 * D90; front.rotation.y = -f1 * D90; lside.rotation.y = -f1 * D90;
    strip.position.set(lerp(-0.45 - CW / 2, -CW / 2, f1), 0, lerp(0, -CD / 2, f1));
    ['dustRT', 'dustRB', 'dustLT', 'dustLB'].forEach((kk) => { flaps[kk].rotation.x = (kk.endsWith('B') ? -1 : 1) * f2 * D90; });
    flaps.tuckT.rotation.x = f3 * D90; flaps.tuckB.rotation.x = -f3 * D90;
    lip.visible = f3 < 0.98;

    /* 2. lay it down into the mailer (u 0.5..1) */
    const d = ease(seg(u, 0.5, 1));
    carton.rotation.set(lerp(0, -D90, d), lerp(0, -0.25, d), lerp(0, D90, d));
    carton.position.set(lerp(0, 0.1, d), lerp(CH / 2 + 0.02, 0.04 + CD / 2, d), lerp(0, 0.05, d));
    const mIn = ease(seg(u, 0.45, 0.95));
    mailer.position.set(0, lerp(-1.6, 0, mIn), lerp(0.6, 0, mIn));
    mailer.rotation.set(0, 0, 0);
    mailer.visible = mIn > 0.001;
    fill.scale.setScalar(lerp(0.01, 1, ease(seg(u, 0.75, 1)))); fill.visible = u > 0.75;

    /* 3. close, tape, label (u 1..1.72), then out of the warehouse into the van (1.75..2) */
    const shut = seg(u, 1.05, 1.45);
    carton.visible = shut < 0.999;   /* inside the shut box it is never seen */
    const sShort = ease(clamp(shut / 0.55, 0, 1)), sLong = ease(clamp((shut - 0.35) / 0.65, 0, 1));
    setFlap(mf.left, sShort, 0.002); setFlap(mf.right, sShort, 0.002);
    setFlap(mf.front, sLong, 0.024); setFlap(mf.back, sLong, 0.024);
    const tp = ease(seg(u, 1.45, 1.57));
    tape.visible = tp > 0.01; tape.scale.x = Math.max(0.001, tp * (MW + 0.3)); tape.position.y = MH + 0.024 + T + 0.004;
    const lb = ease(seg(u, 1.57, 1.72));
    labelPivot.rotation.z = (1 - lb) * 2.3;
    labelPivot.position.y = MH + 0.024 + T + 0.006 + (1 - lb) * 0.25;
    labelMat.opacity = clamp(lb * 3, 0, 1); label.visible = lb > 0.001;

    /* the scenes slide in and out around it; the conveyor carries it while it is packed */
    slide(wh, -1, -0.5, 1.75, 2.0, u);
    wh.position.x += clamp(u - 0.5, 0, 1.25) * 0.9;
    slide(van, 1.75, 2.0, 2.35, 2.8, u);
    slide(door, 2.35, 2.8, 9, 10, u);
    ground.position.y = u < 1.87 ? -1.0 : 0;
    const hop1 = Math.sin(Math.PI * seg(u, 1.75, 2.0)) * 0.45, hop2 = Math.sin(Math.PI * seg(u, 2.35, 2.8)) * 0.45;
    mailer.position.y += hop1 + hop2;
    mailer.rotation.y = lerp(0, 0.25, ease(seg(u, 1.75, 2.0))) + lerp(0, -0.6, ease(seg(u, 2.35, 2.8)));

    /* the courier's scan, in the van (u 2.02..2.25) */
    const sc = seg(u, 2.02, 2.25);
    beam.visible = sc > 0 && sc < 1;
    beam.position.set(-0.62 + sc * LW, MH + 0.024 + T + 0.012, 0.26);

    /* the opening drop: falls, lands with a small bounce, settles */
    if (drop < 1) {
      const fall = clamp(drop / 0.62, 0, 1);
      let y = 2.8 * (1 - fall * fall);
      if (drop > 0.62) { const b = (drop - 0.62) / 0.38; y = Math.sin(Math.PI * Math.min(1, b * 1.6)) * 0.12 * (1 - b); }
      mailer.position.y += y;
      mailer.rotation.z = drop > 0.62 ? Math.sin((drop - 0.62) * 40) * 0.03 * (1 - (drop - 0.62) / 0.38) : (1 - fall) * 0.12;
    } else mailer.rotation.z = 0;

    /* light per place: cool overhead in the warehouse, dimmer in the van, her door lit by the delivery's time of day */
    const lv = ease(seg(u, 1.75, 2.0)), ld = ease(seg(u, 2.35, 2.8)), L = doorLight;
    const cool = new THREE.Color(0xf2f6ff), dim = new THREE.Color(0xe9e6df), doorSun = new THREE.Color(L.sun);
    sun.color.copy(cool).lerp(dim, lv).lerp(doorSun, ld);
    sun.intensity = lerp(lerp(2.4, 1.6, lv), L.si, ld);
    sun.position.set(lerp(lerp(-1.5, -2.5, lv), L.pos[0], ld), lerp(lerp(6, 5, lv), L.pos[1], ld), lerp(lerp(2.5, 3.5, lv), L.pos[2], ld));
    hemi.intensity = lerp(lerp(1.7, 1.25, lv), L.hi, ld);
    hemi.color.set(0xfffaf2).lerp(new THREE.Color(L.sky), ld);
    hemi.groundColor.set(0xb9a58c).lerp(new THREE.Color(L.gnd), ld);

    /* camera: fold -> packed (warehouse) -> van -> door */
    const c1 = ease(seg(u, 0.5, 1)), c2 = ease(seg(u, 1.72, 2.0)), c3 = ease(seg(u, 2.35, 2.85));
    const p = CAMS.fold.p.clone().lerp(CAMS.packed.p, c1).lerp(CAMS.van.p, c2).lerp(CAMS.door.p, c3);
    const t = CAMS.fold.t.clone().lerp(CAMS.packed.t, c1).lerp(CAMS.van.t, c2).lerp(CAMS.door.t, c3);
    /* keep the parcel the same size on screen whatever the canvas size */
    p.sub(t).multiplyScalar(k).add(t);
    camera.position.copy(p); camera.lookAt(t);
    scene.fog.near = 5.2 * k; scene.fog.far = 11.5 * k;
    /* phone, at the door: the parcel is turned and sits left of the camera's aim, so slide the view until it is centred on cx */
    camera.setViewOffset(vw, vh, OX, OY, vw, vh); camera.updateProjectionMatrix();
    if (phone && ld > 0) {
      camera.updateMatrixWorld();
      mailer.updateMatrixWorld(true); let lo = Infinity, hi = -Infinity;
      mailer.traverseVisible((o) => {   /* the real corners on screen, not a world box around the turned parcel */
        if (!o.isMesh || !o.geometry.attributes.position) return;
        const pa = o.geometry.attributes.position;
        for (let i = 0; i < pa.count; i++) { V3.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld).project(camera); const x = (V3.x * 0.5 + 0.5) * vw; if (x < lo) lo = x; if (x > hi) hi = x; }
      });
      camera.setViewOffset(vw, vh, OX + Math.round(((lo + hi) / 2 - CX) * ld), OY, vw, vh); camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
  }

  /* the canvas fills the stage; (cx, cy) is where the parcel sits, B the object box the 2D layers use */
  let phone = false, OX = 0, OY = 0, CX = 0;
  const V3 = new THREE.Vector3();
  function size(w, h, cx, cy, B) {
    w = Math.round(w); h = Math.round(h);
    if ((w < 820) !== phone) {
      phone = w < 820;
      DEEP.forEach((o) => {
        if (o.show) { o.m.visible = phone; return; }
        o.m.scale.z = phone ? 4 : 1; o.m.position.z = o.back + o.dd * o.m.scale.z / 2;
        if (o.pmat) o.m.material = phone ? o.pmat : o.mat;
      });
    }
    if (w !== vw || h !== vh) { vw = w; vh = h; renderer.setSize(w, h, false); el.style.width = w + 'px'; el.style.height = h + 'px'; }
    camera.aspect = w / h;
    OX = Math.round(w / 2 - cx); OY = Math.round(h / 2 - cy); CX = cx;
    camera.setViewOffset(w, h, OX, OY, w, h);
    camera.updateProjectionMatrix();
    k = h / (1.6 * B);
    dirty = true;
  }

  /* the lipstick's rectangle on screen at u = 0 (centre x/y and height, canvas px), for the hand-off from 2D */
  function lipRect() {
    const keep = lastU, keepD = lastDrop, keepS = lastSp;
    dirty = true; pose(0, 1, 13.5);
    lip.updateMatrixWorld(true);
    const c = new THREE.Vector3(0, 0, 0).applyMatrix4(lip.matrixWorld).project(camera);
    const top = new THREE.Vector3(0, 0.47, 0).applyMatrix4(lip.matrixWorld).project(camera);
    const r = { x: (c.x * 0.5 + 0.5) * vw, y: (-c.y * 0.5 + 0.5) * vh, h: Math.abs(top.y - c.y) * vh };
    dirty = true; pose(keep, keepD, keepS);
    return r;
  }
  /* the storyboard's doorstep: the parcel stays on her doormat.
       drop 0 (in the air) .. 1 (landed)    open 0 (taped, labelled, shut) .. 1 (tape and label off, flaps open)
       rise 0 (inside) .. 1 (the charm up out of the parcel)    cam 0 (the door) .. 1 (close on the parcel) */
  const charmT = loader.load(cfg.charmSrc || kitSrc('hero'), () => { dirty = true; }); charmT.colorSpace = THREE.SRGBColorSpace;
  const charm = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: charmT, transparent: true, alphaTest: 0.02 }));
  charm.visible = false; charm.renderOrder = 2; scene.add(charm);
  const DIR = new THREE.Vector3(), BASE = new THREE.Vector3();
  function doorPose(s) {
    s = s || {};
    dirty = true; pose(3, s.drop == null ? 1 : s.drop, LAST);
    const open = clamp(s.open || 0, 0, 1), rise = clamp(s.rise || 0, 0, 1);
    const tOff = ease(seg(open, 0, 0.3)), lOff = ease(seg(open, 0.12, 0.42)), fl = ease(seg(open, 0.38, 1));
    tape.visible = tOff < 0.99; tape.scale.x = Math.max(0.001, (1 - tOff) * (MW + 0.3)); tape.position.y = MH + 0.024 + T + 0.004;
    labelPivot.rotation.z = lOff * 2.3; labelPivot.position.y = MH + 0.024 + T + 0.006 + lOff * 0.25;
    labelMat.opacity = clamp((1 - lOff) * 3, 0, 1); label.visible = lOff < 0.999;
    const shut = 1 - fl, sShort = ease(clamp(shut / 0.55, 0, 1)), sLong = ease(clamp((shut - 0.35) / 0.65, 0, 1));
    setFlap(mf.left, sShort, 0.002); setFlap(mf.right, sShort, 0.002); setFlap(mf.front, sLong, 0.024); setFlap(mf.back, sLong, 0.024);
    carton.visible = false; fill.visible = true; fill.scale.setScalar(1);
    /* the camera leans in toward the parcel */
    const c = clamp(s.cam || 0, 0, 1);
    if (c > 0) { camera.getWorldDirection(DIR); camera.position.addScaledVector(DIR, ease(c) * 2.4 * k); camera.updateMatrixWorld(); }
    /* the charm: a card that always faces the lens, rising out of the open parcel */
    charm.visible = rise > 0.001;
    if (charm.visible) {
      mailer.updateMatrixWorld(true);
      BASE.set(0, MH * 0.45, 0).applyMatrix4(mailer.matrixWorld);
      const r = ease(rise), sz = 0.95;
      charm.position.set(BASE.x, BASE.y + sz * 0.15 + r * 1.05, BASE.z);
      charm.scale.set(sz, sz, 1); charm.quaternion.copy(camera.quaternion);
    }
    renderer.render(scene, camera);
  }
  if (/[?&]debug3d\b/.test(location.search)) window.__scene = { scene, THREE };
  return { el, pose, size, lipRect, doorPose };
}
