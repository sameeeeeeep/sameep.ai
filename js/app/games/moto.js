// moto.js — MOTO THAPPAD: a dusk race up NH48 on a 100cc bike, slapping your way past seven
// rivals, autorickshaws, trucks and the odd cow. Pseudo-3D segment road drawn into a 320x200
// canvas and scaled up pixelated, so it reads like a floppy-disk game. No sound, ever.
import { h, store, clamp } from '../util.js';

export const meta = { id: 'moto', title: 'Moto Thappad', width: 520 };

const W = 320, H = 200, STEP = 1 / 60;
const SEG = 200, ROAD = 2000, LANES = 3, DRAW = 140;
const CAM_H = 1000, DEPTH = 1 / Math.tan((100 / 2) * Math.PI / 180), PZ = CAM_H * DEPTH;
const MAX = 11000, ACCEL = MAX / 3.2, BRAKE = -MAX * 1.1, DECEL = -MAX / 5;
const OFF_DECEL = -MAX / 1.6, OFF_LIMIT = MAX / 3.2, CENTRIFUGAL = 0.18;
const FIN_SEG = 3300, FIN_Z = FIN_SEG * SEG;
const BIKE_W = 260, BIKE_H = 325, BIKE_HALF = BIKE_W / ROAD / 2;
const FONT = "VT323, ui-monospace, Menlo, monospace";

// ---------- pixel sprites: half rows get mirrored, so bikes and autos stay symmetric ----------
const mirror = (rows) => rows.map((r) => r + [...r].reverse().join(''));
const BIKE = mirror([
  '......kk', '.....khh', '....khhh', '....khhw', '....kkkk',
  '...kssss', '..ksssss', '..ksssss', '.kaksss.', 'kmakssss',
  'kmmkjjjj', '.k.kjjjj', '...kjkmm', '...kjkrr', '....kkpp',
  '.....kmt', '.....ktt', '.....ktt', '.....ktt', '......kk',
]);
const AUTO = mirror([
  '..kkkkkk', '.kyyyyyy', 'kyyyyyyy', 'kykddddd', 'kykddddd', 'kykddddd', 'kyyyyyyy',
  'kggggggg', 'kgrrgggg', 'kggggkpp', 'kggggggg', 'kkkkkkkk', '.ktt....', '.ktt....', '..kk....',
]);
const TRUCK = mirror([
  'kkkkkkkk', 'kooooooo', 'kobbbbbb', 'koybybyb', 'kobbbbbb', 'kooooooo', 'kywwwwww',
  'kywwwwww', 'kywwwwww', 'kywwwwww', 'kooooooo', 'korrrooo', 'kkkkkkkk', 'kmmmmmmm',
  '.kttt...', '.kttt...', '..kk....',
]);
const COW = [
  '..................k.', '................kwk.', '..kkkkkkkkkkkkkkwwwk', 'kkwwwwkkwwwwwwwwwkwk',
  'k.wwwkkkwwwwkkwwwwnk', 'k.wwwwkwwwwwkkkwwwnk', '.kwwwwwwwwwwwwwwwkk.', '..kwwwwwwwwwwwwwk...',
  '..kwk.kwk..kwk.kwk..', '..kwk.kwk..kwk.kwk..', '..kkk.kkk..kkk.kkk..',
];

const BASE_PAL = { k: '#111111', a: '#c98a5a', m: '#9aa0a8', j: '#2b3a6b', r: '#ff3b30', p: '#f2e6a0', t: '#1c1c1c', w: '#f4f4f4' };
const AUTO_PAL = { k: '#111111', y: '#f6c90e', d: '#2a2420', g: '#2e8b3a', r: '#ff4d3a', p: '#f2e6a0', t: '#1a1a1a' };
const TRUCK_PAL = { k: '#111111', o: '#f08a24', b: '#2b6fd6', y: '#f6d21e', w: '#f6f0dc', r: '#e83a3a', m: '#7d7d86', t: '#1a1a1a' };
const COW_PAL = { k: '#2a2522', w: '#f1ece2', n: '#e9a0a0' };

const RIVALS = [
  { name: 'PAPPU', h: '#e83a3a', s: '#f6c90e', mean: 0.5 },
  { name: 'BUNTY', h: '#2b6fd6', s: '#ff8a1e', mean: 0.9 },
  { name: 'DOLLY', h: '#ff5fb0', s: '#ffffff', mean: 0.8 },
  { name: 'CHINTU', h: '#3bbf4a', s: '#6a3fb5', mean: 0.4 },
  { name: 'GOLU', h: '#f6c90e', s: '#1e9e9e', mean: 0.6 },
  { name: 'PINKY', h: '#b04dff', s: '#ffd0e0', mean: 0.7 },
  { name: 'TINKU', h: '#ff8a1e', s: '#2b3a6b', mean: 0.5 },
];
const YOU = { h: '#f4f4f4', s: '#d6332a' };
const BOARDS = ['GARAM CHAI', 'PUNCTURE WALA', 'JALEBI 24x7', 'DRIVE SLOW BHAI', 'PURE VEG', 'DILLI 0 KM?', 'TYRE SALE', 'LASSI 20/-'];
const ORD = (n) => n + (n === 1 ? 'ST' : n === 2 ? 'ND' : n === 3 ? 'RD' : 'TH');

// seeded rng so the road is the same every race (you get to learn the bends)
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const lerp = (a, b, t) => a + (b - a) * t;
const easeIn = (a, b, t) => a + (b - a) * t * t;
const easeInOut = (a, b, t) => a + (b - a) * (-Math.cos(t * Math.PI) / 2 + 0.5);
const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mix = (a, b, t) => `rgb(${(a[0] + (b[0] - a[0]) * t) | 0},${(a[1] + (b[1] - a[1]) * t) | 0},${(a[2] + (b[2] - a[2]) * t) | 0})`;

const C = {
  grass: [hex('#7b7a2c'), hex('#6f6e27')], rumble: [hex('#d23a2e'), hex('#efe6d2')],
  road: [hex('#55535c'), hex('#504e57')], lane: hex('#efe6d2'), fog: hex('#b4637a'),
};

// ---------- track ----------
function buildTrack() {
  const segs = [], r = rng(48);
  const lastY = () => (segs.length ? segs[segs.length - 1].p2.y : 0);
  const add = (curve, y) => {
    const i = segs.length;
    segs.push({ i, curve, p1: { z: i * SEG, y: lastY() }, p2: { z: (i + 1) * SEG, y }, sprites: [], clip: 0, p: [{}, {}] });
  };
  const road = (enter, hold, leave, curve, hill) => {
    const y0 = lastY(), y1 = y0 + hill * SEG, total = enter + hold + leave;
    for (let n = 0; n < enter; n++) add(easeIn(0, curve, n / enter), easeInOut(y0, y1, n / total));
    for (let n = 0; n < hold; n++) add(curve, easeInOut(y0, y1, (enter + n) / total));
    for (let n = 0; n < leave; n++) add(easeInOut(curve, 0, n / leave), easeInOut(y0, y1, (enter + hold + n) / total));
  };
  road(20, 60, 20, 0, 0);
  while (segs.length < FIN_SEG - 120) {
    const k = r(), len = 20 + ((r() * 30) | 0), dir = r() < 0.5 ? -1 : 1;
    const hill = (r() < 0.55 ? (r() * 40 - 18) : 0) | 0;
    if (k < 0.22) road(len, len, len, 0, hill);
    else if (k < 0.5) road(len, len * 2, len, dir * (2 + r() * 2), hill);
    else if (k < 0.7) road(len, len, len, dir * (4 + r() * 2), hill);
    else if (k < 0.85) { road(len, len, len, dir * 3, hill / 2 | 0); road(len, len, len, -dir * 3, -hill / 2 | 0); }
    else road(len, len, len, 0, (r() < 0.5 ? 1 : -1) * (25 + r() * 20) | 0);
  }
  // flatten out into the finish so the banner is visible from far off
  road(40, 40, 40, 0, (-lastY() / SEG) | 0);
  while (segs.length < FIN_SEG + 260) road(20, 20, 20, 0, 0);

  // roadside: palms, dhabas, billboards, milestones, neem trees
  const R = rng(99);
  let km = 0;
  for (const s of segs) {
    const i = s.i;
    if (i < 8) continue;
    if (i % 9 === 0) s.sprites.push({ t: 'palm', x: -(1.5 + R() * 0.9) });
    if (i % 9 === 4) s.sprites.push({ t: R() < 0.6 ? 'palm' : 'neem', x: 1.5 + R() * 0.9 });
    if (i % 55 === 22) s.sprites.push({ t: 'dhaba', x: (R() < 0.5 ? -1 : 1) * 2.4 });
    else if (i % 75 === 40) s.sprites.push({ t: 'board', x: (R() < 0.5 ? -1 : 1) * 2.1, text: BOARDS[(R() * BOARDS.length) | 0] });
    if (i % 40 === 12) s.sprites.push({ t: 'stone', x: 1.22, text: String(++km) });
    if (R() < 0.04) s.sprites.push({ t: 'neem', x: (R() < 0.5 ? -1 : 1) * (2.6 + R() * 2) });
  }
  segs[4].sprites.push({ t: 'banner', x: 0, text: 'START · NH48' });
  segs[FIN_SEG].sprites.push({ t: 'banner', x: 0, text: 'FINISH' });
  return segs;
}

// world sizes (units) for roadside art; cw = what you actually hit
const SIZE = {
  palm: { w: 900, h: 1900, cw: 220 }, neem: { w: 1500, h: 1500, cw: 300 }, dhaba: { w: 2600, h: 1300, cw: 2400 },
  board: { w: 2200, h: 1900, cw: 2000 }, stone: { w: 240, h: 300, cw: 240 }, banner: { w: ROAD * 2.5, h: 1700, cw: 0 },
  auto: { w: 480, h: 450, len: 500 }, truck: { w: 760, h: 860, len: 1300 }, cow: { w: 560, h: 310, len: 260 },
};

export function mount(host, { reduced = false, narrow = false } = {}) {
  const segs = buildTrack();
  const touchUI = narrow || matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

  // ---------- dom ----------
  const cv = h('canvas', { width: W, height: H, 'aria-label': 'Moto Thappad game screen',
    style: { width: '100%', height: 'auto', aspectRatio: '16 / 10', display: 'block', imageRendering: 'pixelated', background: '#1a1030', touchAction: 'none', cursor: 'pointer' } });
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const btnCss = { flex: '1 1 0', minWidth: '0', height: '52px', font: "400 22px/1 VT323, ui-monospace, monospace", color: '#111',
    background: '#e8e2d0', border: '2px solid #111', boxShadow: 'inset -3px -3px 0 #9d957e, inset 3px 3px 0 #fff', borderRadius: '0',
    touchAction: 'none', userSelect: 'none', webkitUserSelect: 'none', padding: '0', cursor: 'pointer' };
  const btn = (label, key, extra = {}) => h('button', { type: 'button', dataset: { key }, 'aria-label': key, style: { ...btnCss, ...extra } }, label);
  const pad = touchUI ? h('div', { style: { display: 'flex', gap: '6px', marginTop: '8px', userSelect: 'none' } },
    btn('◀', 'left'), btn('▶', 'right'), btn('BRAKE', 'down', { flex: '1.2 1 0', fontSize: '18px' }),
    btn('◀SLAP', 'slapL', { background: '#f6c90e', fontSize: '18px' }), btn('SLAP▶', 'slapR', { background: '#f6c90e', fontSize: '18px' })) : null;
  const wrap = h('div', { tabindex: '0', style: { outline: 'none', userSelect: 'none', webkitUserSelect: 'none', maxWidth: '100%' } }, cv, pad);
  host.append(wrap);
  try { document.fonts && document.fonts.load('16px VT323'); } catch { /* fine, fallback mono */ }

  // ---------- state ----------
  const keys = { left: false, right: false, up: false, down: false };
  const tbtn = { left: false, right: false, down: false };
  let lastInput = touchUI && narrow ? 'buttons' : 'keys';
  let state = 'title', stateT = 0, raceT = 0, best = parseFloat(store.get('moto.best')) || 0;
  let pos = 0, P, rivals, traffic, pops, shake = 0, flash = 0, skyX = 0, result = null;

  function reset() {
    pos = 0;
    P = { x: 0.3, speed: 0, hp: 100, crash: 0, spin: 0, safe: 0, slap: 0, slapDir: 0, cool: 0, lean: 0 };
    const order = RIVALS.map((r, i) => ({ r, k: Math.random() + i * 0.01 })).sort((a, b) => a.k - b.k);
    rivals = order.map(({ r }, i) => ({
      ...r, z: PZ + 700 + i * 520, x: i % 2 ? -0.45 : 0.45, speed: 0, hp: 3, crash: 0, spin: 0, slap: 0, slapDir: 0,
      cool: 1.5 + Math.random() * 2, skill: 0.8 + Math.random() * 0.1, tx: i % 2 ? -0.45 : 0.45, hit: 0, wob: Math.random() * 6, fin: 0,
    }));
    const R = rng(7 + ((Math.random() * 1e6) | 0));
    traffic = [];
    for (let z = 9000; z < FIN_Z - 4000; z += 5500 + R() * 7000) {
      const k = R(), t = k < 0.5 ? 'auto' : k < 0.82 ? 'truck' : 'cow';
      const x = [-0.66, 0, 0.66][(R() * 3) | 0] + (R() - 0.5) * 0.1;
      traffic.push({ t, z, x, speed: t === 'cow' ? 0 : MAX * (t === 'auto' ? 0.28 + R() * 0.08 : 0.22 + R() * 0.06) });
    }
    pops = []; shake = 0; flash = 0; raceT = 0; result = null;
  }
  reset();

  const segAt = (z) => segs[clamp(Math.floor(z / SEG), 0, segs.length - 1)];
  const pop = (text, color = '#ffe14a', big = false) => pops.push({ text, color, t: 0, big });

  function go(next) { state = next; stateT = 0; }
  function startRace() { reset(); go('count'); }

  // ---------- update ----------
  function crashPlayer(msg) {
    if (P.crash > 0 || P.safe > 0) return;
    P.crash = 1.3; P.spin = 0; P.hp = Math.max(0, P.hp - 18);
    pop(msg, '#ff6a4a', true);
    if (!reduced) { shake = 0.5; flash = 0.12; }
  }
  function crashRival(r) {
    if (r.crash > 0) return;
    r.crash = 2.2; r.spin = 0; r.hp = 3;
    const near = Math.abs(r.z - (pos + PZ)) < 4000;
    if (near) pop(r.name + ' GIRA!', '#9bff5e');
  }

  function playerSlap(dir) {
    if (state !== 'race' || P.crash > 0 || P.cool > 0) return;
    P.slap = 0.22; P.slapDir = dir; P.cool = 0.34;
    const pz = pos + PZ;
    let hit = null, bestD = 9;
    for (const r of rivals) {
      if (r.crash > 0) continue;
      const dz = Math.abs(r.z - pz), dx = (r.x - P.x) * dir;
      if (dz < 380 && dx > 0.04 && dx < 0.5 && dz + dx * 400 < bestD * 1000) { hit = r; bestD = (dz + dx * 400) / 1000; }
    }
    if (!hit) return;
    hit.hp -= 1; hit.hit = 0.14; hit.speed *= 0.72; hit.x += dir * 0.16; hit.tx = hit.x; hit.cool = Math.max(hit.cool, 0.5);
    if (!reduced) shake = Math.max(shake, 0.15);
    if (hit.hp <= 0 || Math.abs(hit.x) > 1.05) crashRival(hit);
    else pop('THAPPAD!');
  }

  // the sprite is the vehicle's back; its body runs forward from there. swept so a fast frame can't tunnel
  const swept = (rel0, rel1, len) => rel1 > -90 && rel0 < len;
  // after a tumble, put you beside whatever you hit instead of back inside it
  function clearSpot(b, pz) {
    for (const o of traffic) {
      const half = SIZE[o.t].w / ROAD / 2 + BIKE_HALF + 0.06, rel = pz - o.z;
      if (rel < -400 || rel > SIZE[o.t].len + 200 || Math.abs(b.x - o.x) >= half) continue;
      const side = b.x >= o.x ? 1 : -1, nx = o.x + side * half;
      b.x = Math.abs(nx) <= 0.95 ? nx : o.x - side * half;
    }
  }

  function updateRace(dt) {
    raceT += dt;
    const pz0 = pos + PZ, seg = segAt(pz0), speedPct = P.speed / MAX;
    P.cool = Math.max(0, P.cool - dt); P.slap = Math.max(0, P.slap - dt); P.safe = Math.max(0, P.safe - dt);
    const autoGas = lastInput === 'buttons';
    const left = keys.left || tbtn.left, right = keys.right || tbtn.right;
    const gas = keys.up || (autoGas && !tbtn.down && !keys.down), brake = keys.down || tbtn.down;

    if (P.crash > 0) {
      P.crash -= dt; P.spin += dt * 9;
      P.speed = Math.max(0, P.speed - MAX * 1.4 * dt);
      if (P.crash <= 0) {
        P.crash = 0; P.speed = 0; P.safe = 1.3; P.x = clamp(P.x, -0.85, 0.85); clearSpot(P, pos + PZ);
        if (P.hp <= 0) { P.hp = 60; pop('UTHO! GET UP', '#ffe14a'); }
      }
    } else {
      const dx = dt * 2.1 * Math.min(1, speedPct + 0.15);
      if (left) P.x -= dx; if (right) P.x += dx;
      P.lean = lerp(P.lean, left ? -1 : right ? 1 : 0, Math.min(1, dt * 10));
      P.x -= dx * speedPct * seg.curve * CENTRIFUGAL;
      if (gas) P.speed += ACCEL * dt * (1 - speedPct * 0.35);
      else if (brake) P.speed += BRAKE * dt;
      else P.speed += DECEL * dt;
      if (brake && gas) P.speed += BRAKE * 0.5 * dt;
      if (Math.abs(P.x) > 1 && P.speed > OFF_LIMIT) P.speed += OFF_DECEL * dt;
      P.x = clamp(P.x, -2.4, 2.4);
      P.speed = clamp(P.speed, 0, MAX);
    }
    const prevPos = pos;
    pos += P.speed * dt;
    const pz = pos + PZ;

    // roadside things only hurt when you leave the tarmac
    if (Math.abs(P.x) > 1 && P.crash <= 0) {
      for (const s of segAt(pz).sprites) {
        const cw = SIZE[s.t].cw / ROAD / 2;
        if (cw && Math.abs(P.x - s.x) < cw + BIKE_HALF) { crashPlayer('DHADAAM!'); P.x = clamp(P.x, -1.2, 1.2); break; }
      }
    }

    // traffic: rolls along, you hit it from behind
    for (const o of traffic) {
      const oz0 = o.z;
      o.z += o.speed * dt;
      if (o.z > FIN_Z + 20000) o.speed = 0;
      const sz = SIZE[o.t], half = sz.w / ROAD / 2;
      if (P.crash <= 0 && Math.abs(P.x - o.x) < half + BIKE_HALF * 0.8 && swept(prevPos + PZ - oz0, pz - o.z, sz.len)) {
        crashPlayer(o.t === 'cow' ? 'GAU MATA!' : o.t === 'truck' ? 'HORN OK PLEASE!' : 'AUTO SE TAKKAR!');
        P.speed = Math.min(P.speed, o.speed * 0.5);
      }
    }

    // rivals
    for (const r of rivals) {
      const rz0 = r.z;
      r.cool -= dt; r.slap = Math.max(0, r.slap - dt); r.hit = Math.max(0, r.hit - dt); r.wob += dt;
      if (r.crash > 0) {
        r.crash -= dt; r.spin += dt * 8; r.speed = Math.max(0, r.speed - MAX * 1.5 * dt);
        if (r.crash <= 0) { r.crash = 0; r.x = clamp(r.x, -0.8, 0.8); clearSpot(r, r.z); r.tx = r.x; }
        r.z += r.speed * dt;
        continue;
      }
      const dz = r.z - pz;
      // rubber band: stay in brawling range without making winning impossible
      let target = MAX * r.skill;
      if (dz > 6000) target *= 0.88; else if (dz < -5000) target *= 1.1;
      if (r.fin || r.z > FIN_Z) { r.fin = r.fin || raceT; target = Math.max(0, r.speed - MAX * dt); }
      if (Math.abs(r.x) > 1) target = Math.min(target, OFF_LIMIT);
      // same kind of pull-away as you, so the start is a proper scrum
      target = Math.min(target, MAX * 1.02);
      r.speed = r.speed < target ? Math.min(target, r.speed + ACCEL * 0.9 * dt * (1 - r.speed / MAX * 0.35)) : lerp(r.speed, target, Math.min(1, dt * 1.5));
      // lane choice: dodge traffic ahead, sidle up to you when close
      let tx = r.tx;
      for (const o of traffic) {
        const od = o.z - r.z;
        if (od > 0 && od < 2600 && Math.abs(o.x - tx) < SIZE[o.t].w / ROAD / 2 + 0.16) { tx = o.x > 0 ? o.x - 0.62 : o.x + 0.62; if (Math.abs(tx) > 0.85) tx = -Math.sign(o.x) * 0.5; break; }
      }
      if (Math.abs(dz) < 900 && state === 'race' && P.crash <= 0 && Math.random() < r.mean * dt * 2) tx = P.x + (r.x < P.x ? -0.28 : 0.28);
      r.tx = clamp(tx + Math.sin(r.wob) * 0.002, -0.85, 0.85);
      r.x = lerp(r.x, r.tx, Math.min(1, dt * 1.6));
      r.x -= dt * (r.speed / MAX) * segAt(r.z).curve * 0.02;
      r.z += r.speed * dt;
      // rivals crash into traffic too, which is very satisfying to watch
      for (const o of traffic) {
        if (Math.abs(r.x - o.x) < SIZE[o.t].w / ROAD / 2 + BIKE_HALF * 0.7 && swept(rz0 - (o.z - o.speed * dt), r.z - o.z, SIZE[o.t].len)) { crashRival(r); break; }
      }
      // shoulder bumps
      const ddx = r.x - P.x;
      if (Math.abs(r.z - pz) < 170 && Math.abs(ddx) < BIKE_HALF * 2 && P.crash <= 0) {
        const push = (BIKE_HALF * 2 - Math.abs(ddx)) / 2 * Math.sign(ddx || 1);
        r.x += push; P.x -= push;
      }
      // they slap back
      if (r.cool <= 0 && P.crash <= 0 && Math.abs(r.z - pz) < 330 && Math.abs(ddx) > 0.05 && Math.abs(ddx) < 0.42) {
        r.cool = 1.4 + Math.random() * 1.6 - r.mean * 0.6;
        r.slap = 0.24; r.slapDir = -Math.sign(ddx);
        if (P.safe <= 0 && Math.random() < 0.75) {
          P.hp -= 8; P.x += r.slapDir * 0.1; P.speed *= 0.93;
          pop(r.name + ' KA THAPPAD', '#ff8a8a');
          if (!reduced) { shake = Math.max(shake, 0.2); flash = 0.06; }
          if (P.hp <= 0) { P.hp = 0; P.safe = 0; crashPlayer('KNOCKED OUT'); }
        }
      }
    }

    if (pz >= FIN_Z) {
      const place = 1 + rivals.filter((r) => r.z >= pz || r.fin).length;
      const newBest = !best || raceT < best;
      if (newBest) { best = raceT; store.set('moto.best', String(raceT)); }
      result = { place, time: raceT, newBest };
      go('done');
    }
  }

  function updateCoast(dt) {
    // after the line (and on the title screen) everyone just rolls on
    P.speed = Math.max(0, P.speed - MAX * 0.4 * dt);
    pos += P.speed * dt;
    P.lean = lerp(P.lean, 0, dt * 5);
    for (const o of traffic) o.z += o.speed * dt;
    for (const r of rivals) { if (r.crash > 0) { r.crash -= dt; r.spin += dt * 8; } r.speed = Math.max(0, r.speed - MAX * 0.3 * dt); r.z += r.speed * dt; }
  }

  function update(dt) {
    stateT += dt;
    for (const p of pops) p.t += dt;
    pops = pops.filter((p) => p.t < 1.1).slice(-3);
    shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt);
    if (state === 'race') updateRace(dt);
    else if (state === 'count') { if (stateT >= 2.4) { go('race'); pop('GO! GO! GO!', '#9bff5e', true); } }
    else if (state === 'title') { if (!reduced) { pos = (pos + 1800 * dt) % (FIN_Z - 20000); } }
    else updateCoast(dt);
    const seg = segAt(pos + PZ);
    skyX += dt * (P.speed / MAX) * seg.curve * 0.01;
  }

  // ---------- drawing ----------
  function sprite(map, pal, cx, by, w, hgt, over) {
    const rows = map.length, cols = map[0].length, cw = w / cols, ch = hgt / rows, x0 = cx - w / 2, y0 = by - hgt;
    for (let y = 0; y < rows; y++) {
      const row = map[y];
      for (let x = 0; x < cols; x++) {
        const c = row[x];
        if (c === '.') continue;
        ctx.fillStyle = over || pal[c] || '#f0f';
        ctx.fillRect(Math.floor(x0 + x * cw), Math.floor(y0 + y * ch), Math.ceil(cw), Math.ceil(ch));
      }
    }
  }

  function bike(cx, by, w, hgt, rider, o = {}) {
    const pal = { ...BASE_PAL, h: rider.h, s: rider.s };
    ctx.save();
    ctx.translate(cx, by);
    if (o.spin) { ctx.translate(0, -hgt * 0.3); ctx.rotate(o.spin); ctx.translate(0, hgt * 0.3); }
    else if (o.lean) ctx.rotate(o.lean * 0.14);
    sprite(BIKE, pal, 0, 0, w, hgt, o.white ? '#ffffff' : null);
    if (o.slap) {
      // the thappad: an arm shoots out sideways with an open palm
      const d = o.slapDir, ay = -hgt * 0.68, len = w * 0.55;
      ctx.fillStyle = '#111111';
      ctx.fillRect(d > 0 ? w * 0.28 : -w * 0.28 - len, ay - 1, len + 1, Math.max(2, hgt * 0.09) + 2);
      ctx.fillStyle = pal.s;
      ctx.fillRect(d > 0 ? w * 0.28 : -w * 0.28 - len, ay, len * 0.6, Math.max(1, hgt * 0.09));
      ctx.fillStyle = BASE_PAL.a;
      const hx = d > 0 ? w * 0.28 + len * 0.6 : -w * 0.28 - len;
      ctx.fillRect(hx, ay - hgt * 0.04, len * 0.4, Math.max(2, hgt * 0.15));
    }
    ctx.restore();
  }

  function star(x, y, r) {
    ctx.fillStyle = '#ffe14a';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.stroke();
  }

  function text(str, x, y, size, color = '#fff', align = 'left', shadow = '#111') {
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = align; ctx.textBaseline = 'top';
    ctx.fillStyle = shadow; ctx.fillText(str, x + 1, y + 1);
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  }

  function smallText(str, cx, cy, w, color, bg) {
    // signboard text, only when the sign is big enough to read
    if (w < 22) return;
    const size = Math.min(14, Math.max(6, w / Math.max(4, str.length) * 1.7));
    ctx.font = `${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (bg) { ctx.fillStyle = bg; ctx.fillText(str, cx + 0.5, cy + 0.5); }
    ctx.fillStyle = color; ctx.fillText(str, cx, cy);
  }

  function scenery(s, x, by, sc) {
    const z = SIZE[s.t], w = z.w * sc, hh = z.h * sc;
    if (w < 1) return;
    const k = '#111111';
    if (s.t === 'palm') {
      ctx.fillStyle = '#5a3a22';
      for (let i = 0; i < 8; i++) { const t = i / 8; ctx.fillRect(x - w * 0.06 + Math.sin(t * 2.5) * w * 0.18, by - hh * (t + 0.125), w * 0.12 + 1, hh * 0.13 + 1); }
      const tx = x + Math.sin(2.5) * w * 0.18, ty = by - hh;
      ctx.strokeStyle = '#1f5a2a'; ctx.lineWidth = Math.max(1, w * 0.09);
      for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.6; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + Math.cos(a) * w * 0.4, ty + Math.sin(a) * w * 0.25, tx + Math.cos(a) * w * 0.55, ty + w * 0.22); ctx.stroke(); }
    } else if (s.t === 'neem') {
      ctx.fillStyle = '#4a3020'; ctx.fillRect(x - w * 0.06, by - hh * 0.45, w * 0.12 + 1, hh * 0.45);
      ctx.fillStyle = '#26472a'; ctx.beginPath(); ctx.ellipse(x, by - hh * 0.62, w * 0.5, hh * 0.36, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#335c33'; ctx.beginPath(); ctx.ellipse(x - w * 0.12, by - hh * 0.7, w * 0.28, hh * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    } else if (s.t === 'dhaba') {
      ctx.fillStyle = k; ctx.fillRect(x - w / 2 - 1, by - hh * 0.72 - 1, w + 2, hh * 0.72 + 1);
      ctx.fillStyle = '#c98a4a'; ctx.fillRect(x - w / 2, by - hh * 0.72, w, hh * 0.72);
      ctx.fillStyle = '#ffcf6a'; ctx.fillRect(x - w * 0.3, by - hh * 0.5, w * 0.22, hh * 0.25); // a lit window at dusk
      ctx.fillStyle = '#3a2418'; ctx.fillRect(x + w * 0.08, by - hh * 0.55, w * 0.18, hh * 0.55);
      ctx.fillStyle = '#4f8f8f'; ctx.beginPath(); ctx.moveTo(x - w * 0.58, by - hh * 0.7); ctx.lineTo(x + w * 0.58, by - hh * 0.7); ctx.lineTo(x + w * 0.45, by - hh * 0.86); ctx.lineTo(x - w * 0.45, by - hh * 0.86); ctx.fill();
      ctx.fillStyle = '#d6332a'; ctx.fillRect(x - w * 0.36, by - hh, w * 0.72, hh * 0.15);
      smallText('DHABA', x, by - hh * 0.925, w * 0.6, '#ffe14a', k);
      ctx.fillStyle = '#7a5230'; ctx.fillRect(x - w * 0.5, by - hh * 0.16, w * 0.3, hh * 0.05); // charpai
      ctx.fillRect(x - w * 0.49, by - hh * 0.12, w * 0.02 + 1, hh * 0.12); ctx.fillRect(x - w * 0.23, by - hh * 0.12, w * 0.02 + 1, hh * 0.12);
    } else if (s.t === 'board') {
      ctx.fillStyle = '#333'; ctx.fillRect(x - w * 0.35, by - hh * 0.55, w * 0.05 + 1, hh * 0.55); ctx.fillRect(x + w * 0.3, by - hh * 0.55, w * 0.05 + 1, hh * 0.55);
      ctx.fillStyle = k; ctx.fillRect(x - w / 2 - 1, by - hh - 1, w + 2, hh * 0.47 + 2);
      ctx.fillStyle = '#f6c90e'; ctx.fillRect(x - w / 2, by - hh, w, hh * 0.47);
      ctx.fillStyle = '#d6332a'; ctx.fillRect(x - w / 2, by - hh * 0.6, w, hh * 0.07);
      smallText(s.text, x, by - hh * 0.8, w * 0.9, '#111');
    } else if (s.t === 'stone') {
      ctx.fillStyle = k; ctx.fillRect(x - w / 2 - 1, by - hh - 1, w + 2, hh + 1);
      ctx.fillStyle = '#f1ece2'; ctx.fillRect(x - w / 2, by - hh * 0.6, w, hh * 0.6);
      ctx.fillStyle = '#f6c90e'; ctx.fillRect(x - w / 2, by - hh, w, hh * 0.4);
      smallText(s.text, x, by - hh * 0.32, w * 1.6, '#111');
    } else if (s.t === 'banner') {
      const pw = Math.max(1, w * 0.012);
      ctx.fillStyle = '#ddd'; ctx.fillRect(x - w * 0.42, by - hh, pw, hh); ctx.fillRect(x + w * 0.42 - pw, by - hh, pw, hh);
      ctx.fillStyle = k; ctx.fillRect(x - w * 0.42, by - hh, w * 0.84, hh * 0.2 + 1);
      // checkered cloth
      const n = 16, cw = w * 0.84 / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) { ctx.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f4'; ctx.fillRect(x - w * 0.42 + i * cw, by - hh + j * hh * 0.05, cw + 1, hh * 0.05 + 1); }
      ctx.fillStyle = '#d6332a'; ctx.fillRect(x - w * 0.42, by - hh * 0.9, w * 0.84, hh * 0.1);
      smallText(s.text, x, by - hh * 0.85, w * 0.5, '#ffe14a', k);
    }
  }

  function mover(m, x, by, sc) {
    if (m.t) {
      const z = SIZE[m.t], w = z.w * sc, hh = z.h * sc;
      if (m.t === 'auto') sprite(AUTO, AUTO_PAL, x, by, w, hh);
      else if (m.t === 'truck') { sprite(TRUCK, TRUCK_PAL, x, by, w, hh); if (w > 26) { smallText('HORN OK', x, by - hh * 0.6, w * 0.7, '#d6332a'); smallText('PLEASE', x, by - hh * 0.5, w * 0.6, '#2b6fd6'); } }
      else sprite(COW, COW_PAL, x, by, w, hh);
      return;
    }
    const w = BIKE_W * sc, hh = BIKE_H * sc;
    bike(x, by, w, hh, m, { spin: m.crash > 0 ? m.spin : 0, slap: m.slap > 0, slapDir: m.slapDir, white: m.hit > 0 && !reduced, lean: (m.tx - m.x) * 3 });
    if (m.hit > 0) star(x + (m.x < P.x ? w * 0.3 : -w * 0.3), by - hh * 0.75, Math.max(3, w * 0.3));
    if (w > 14 && m.crash <= 0) {
      // name tag + three health pips so you know who to finish off
      ctx.font = `${clamp(w * 0.32, 8, 12)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#111'; ctx.fillText(m.name, x + 1, by - hh - 2);
      ctx.fillStyle = m.h; ctx.fillText(m.name, x, by - hh - 3);
      for (let i = 0; i < 3; i++) { ctx.fillStyle = i < m.hp ? '#9bff5e' : '#5a2a2a'; ctx.fillRect(x - 5 + i * 4, by - hh - 2, 3, 2); }
    }
  }

  // sky is painted once; the sun sits low on the left like the drive out of Delhi at 6pm
  const sky = document.createElement('canvas'); sky.width = W; sky.height = H;
  (() => {
    const s = sky.getContext('2d'), g = s.createLinearGradient(0, 0, 0, H * 0.62);
    g.addColorStop(0, '#24163f'); g.addColorStop(0.35, '#5e2a62'); g.addColorStop(0.7, '#d4554e'); g.addColorStop(1, '#f6a650');
    s.fillStyle = g; s.fillRect(0, 0, W, H);
    s.fillStyle = '#ffd86a'; s.beginPath(); s.arc(W * 0.3, H * 0.5, 26, 0, Math.PI * 2); s.fill();
    s.fillStyle = '#f08a4c'; for (let i = 0; i < 5; i++) s.fillRect(0, H * 0.46 + i * 4.5, W, 1 + i * 0.5);
    s.fillStyle = 'rgba(255,240,200,.85)'; for (const [x, y] of [[40, 14], [120, 30], [210, 10], [280, 40], [250, 22], [70, 44]]) s.fillRect(x, y, 1, 1);
  })();
  const hillLayer = (seed, amp, base, color, freq) => {
    const c = document.createElement('canvas'); c.width = W * 2; c.height = H; const s = c.getContext('2d'), r = rng(seed);
    const ph = [r() * 6, r() * 6, r() * 6];
    s.fillStyle = color; s.beginPath(); s.moveTo(0, H);
    for (let x = 0; x <= W * 2; x += 2) {
      const t = x / (W * 2) * Math.PI * 2;
      s.lineTo(x, base - amp * (0.5 * Math.sin(t * freq + ph[0]) + 0.3 * Math.sin(t * freq * 2 + ph[1]) + 0.2 * Math.sin(t * freq * 5 + ph[2])));
    }
    s.lineTo(W * 2, H); s.fill();
    return c;
  };
  const hillsFar = hillLayer(3, 14, H * 0.52, '#7a3a6a', 3);
  const hillsNear = hillLayer(5, 10, H * 0.56, '#3e2347', 5);
  const drawLayer = (img, off) => { const o = ((off % (W * 2)) + W * 2) % (W * 2); ctx.drawImage(img, -o, 0); ctx.drawImage(img, W * 2 - o, 0); };

  function project(p, wz, wy, cx, cy, cz) {
    const camX = -cx, camY = wy - cy, camZ = wz - cz;
    p.cz = camZ;
    p.scale = DEPTH / camZ;
    p.sx = W / 2 + p.scale * camX * W / 2;
    p.sy = H / 2 - p.scale * camY * H / 2;
    p.sw = p.scale * ROAD * W / 2;
  }

  function poly(x1, y1, x2, y2, x3, y3, x4, y4, c) {
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.fill();
  }

  const buckets = Array.from({ length: DRAW }, () => []);

  function render() {
    const pz = pos + PZ, base = segAt(pos), pseg = segAt(pz);
    const ppct = (pz % SEG) / SEG, playerY = lerp(pseg.p1.y, pseg.p2.y, ppct);
    const camY = CAM_H + playerY, bpct = (pos % SEG) / SEG;
    ctx.save();
    if (shake > 0 && !reduced) ctx.translate(((Math.random() - 0.5) * 6 * shake / 0.5) | 0, ((Math.random() - 0.5) * 4 * shake / 0.5) | 0);

    ctx.drawImage(sky, 0, 0);
    drawLayer(hillsFar, skyX * 600 + 40);
    drawLayer(hillsNear, skyX * 1200);
    ctx.fillStyle = '#3e2347'; ctx.fillRect(0, H * 0.56, W, H * 0.44);

    // movers into per-segment buckets for back-to-front sprite drawing
    for (const b of buckets) b.length = 0;
    const put = (m) => { const n = Math.floor(m.z / SEG) - base.i; if (n >= 0 && n < DRAW) buckets[n].push(m); };
    traffic.forEach(put); rivals.forEach(put);

    let x = 0, dx = -(base.curve * bpct), maxy = H;
    for (let n = 0; n < DRAW; n++) {
      const seg = segs[base.i + n];
      if (!seg) break;
      const [a, b] = seg.p;
      project(a, seg.p1.z, seg.p1.y, P.x * ROAD - x, camY, pos);
      project(b, seg.p2.z, seg.p2.y, P.x * ROAD - x - dx, camY, pos);
      x += dx; dx += seg.curve;
      seg.clip = maxy; seg.vis = false;
      if (a.cz <= DEPTH || b.sy >= a.sy || b.sy >= maxy) continue;
      seg.vis = true;
      const fog = Math.min(0.85, Math.pow(n / DRAW, 1.6) * 1.1), alt = Math.floor(seg.i / LANES) % 2;
      ctx.fillStyle = mix(C.grass[alt], C.fog, fog); ctx.fillRect(0, b.sy, W, a.sy - b.sy + 1);
      const r1 = a.sw / 6, r2 = b.sw / 6;
      poly(a.sx - a.sw - r1, a.sy, a.sx - a.sw, a.sy, b.sx - b.sw, b.sy, b.sx - b.sw - r2, b.sy, mix(C.rumble[alt], C.fog, fog));
      poly(a.sx + a.sw + r1, a.sy, a.sx + a.sw, a.sy, b.sx + b.sw, b.sy, b.sx + b.sw + r2, b.sy, mix(C.rumble[alt], C.fog, fog));
      poly(a.sx - a.sw, a.sy, a.sx + a.sw, a.sy, b.sx + b.sw, b.sy, b.sx - b.sw, b.sy, mix(C.road[alt], C.fog, fog));
      if (alt) {
        const l1 = a.sw / 40, l2 = b.sw / 40, lc = mix(C.lane, C.fog, fog);
        for (const k of [-1 / 3, 1 / 3]) poly(a.sx + a.sw * 2 * k - l1, a.sy, a.sx + a.sw * 2 * k + l1, a.sy, b.sx + b.sw * 2 * k + l2, b.sy, b.sx + b.sw * 2 * k - l2, b.sy, lc);
      }
      maxy = b.sy;
    }

    // sprites, far to near, clipped behind hill crests; you get drawn in depth order among them
    const psc = DEPTH / PZ * W / 2, bob = state === 'race' && P.speed > 100 && !reduced ? (Math.floor(pos / 300) % 2) : 0;
    const blink = P.safe > 0 && Math.floor(P.safe * 10) % 2 && !reduced;
    const me = () => {
      if (!blink) bike(W / 2, H - 2 - bob, BIKE_W * psc, BIKE_H * psc, YOU, { spin: P.crash > 0 ? P.spin : 0, slap: P.slap > 0, slapDir: P.slapDir, lean: P.lean });
      if (P.slap > 0.15 && rivals.some((r) => r.hit > 0)) star(W / 2 + P.slapDir * BIKE_W * psc * 0.95, H - BIKE_H * psc * 0.7, 6);
    };
    const pn = pseg.i - base.i;
    let drewMe = P.crash > 0; // a tumbling rider goes on top so you can see yourself go down
    for (let n = DRAW - 1; n > 0; n--) {
      const seg = segs[base.i + n];
      if (!seg || seg.p[0].cz <= DEPTH * 2) continue;
      const [a, b] = seg.p, list = buckets[n];
      if (!seg.sprites.length && !list.length && n !== pn) continue;
      const clipped = seg.clip < H;
      if (clipped) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, seg.clip); ctx.clip(); }
      for (const s of seg.sprites) scenery(s, a.sx + a.scale * s.x * ROAD * W / 2, a.sy, a.scale * W / 2);
      list.sort((m1, m2) => m2.z - m1.z);
      for (const m of list) {
        if (n <= pn && !drewMe && m.z < pz) { if (clipped) ctx.restore(); me(); drewMe = true; if (clipped) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, seg.clip); ctx.clip(); } }
        const t = (m.z % SEG) / SEG, sc = lerp(a.scale, b.scale, t);
        mover(m, lerp(a.sx, b.sx, t) + sc * m.x * ROAD * W / 2, lerp(a.sy, b.sy, t), sc * W / 2);
      }
      if (clipped) ctx.restore();
      if (n === pn && !drewMe) { me(); drewMe = true; }
    }
    if (!drewMe || P.crash > 0) me();
    ctx.restore();

    if (flash > 0 && !reduced) { ctx.fillStyle = `rgba(255,255,255,${flash * 3})`; ctx.fillRect(0, 0, W, H); }
    hud();
  }

  function place() { const pz = pos + PZ; return 1 + rivals.filter((r) => r.z > pz).length; }
  const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;

  function hud() {
    const blinkOn = reduced || Math.floor(stateT * 2) % 2 === 0;
    if (state === 'title') {
      ctx.fillStyle = 'rgba(20,10,40,.55)'; ctx.fillRect(0, 0, W, H);
      text('MOTO', W / 2, 30, 44, '#ffe14a', 'center', '#d6332a');
      text('THAPPAD', W / 2, 64, 44, '#ffe14a', 'center', '#d6332a');
      text('NH48 AT DUSK · 8 RIDERS · NO RULES', W / 2, 108, 13, '#f6d6c0', 'center');
      text(touchUI ? '◀ ▶ STEER · AUTO GAS · SLAP ◀ ▶' : '← → STEER  ↑ GAS  ↓ BRAKE  J / K SLAP', W / 2, 128, 13, '#fff', 'center');
      if (blinkOn) text(touchUI ? 'TAP TO START' : 'PRESS ENTER / TAP TO START', W / 2, 156, 16, '#9bff5e', 'center');
      if (best) text('BEST ' + fmt(best), W / 2, 178, 12, '#f6d6c0', 'center');
      return;
    }
    const pz = pos + PZ;
    // left: position + health
    text(state === 'done' ? ORD(result.place) : `POS ${place()}/8`, 6, 3, 18, '#ffe14a');
    ctx.fillStyle = '#111'; ctx.fillRect(6, 23, 62, 7);
    ctx.fillStyle = '#5a2a2a'; ctx.fillRect(7, 24, 60, 5);
    ctx.fillStyle = P.hp > 50 ? '#9bff5e' : P.hp > 25 ? '#ffe14a' : '#ff5a4a'; ctx.fillRect(7, 24, 60 * Math.max(0, P.hp) / 100, 5);
    text('HP', 70, 20, 11, '#fff');
    // right: time
    text(fmt(state === 'done' ? result.time : raceT), W - 6, 3, 18, '#fff', 'right');
    // distance bar with everyone on it
    const bx = 100, bw = 120, by = 9;
    ctx.fillStyle = '#111'; ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
    ctx.fillStyle = '#5c5470'; ctx.fillRect(bx, by, bw, 3);
    ctx.fillStyle = '#f4f4f4'; ctx.fillRect(bx + bw - 2, by - 3, 2, 9);
    for (const r of rivals) { ctx.fillStyle = r.h; ctx.fillRect(bx + clamp(r.z / FIN_Z, 0, 1) * bw - 1, by, 2, 3); }
    ctx.fillStyle = '#fff'; ctx.fillRect(bx + clamp(pz / FIN_Z, 0, 1) * bw - 2, by - 2, 4, 7);
    text(`${Math.max(0, (FIN_Z - pz) / 100000).toFixed(1)} KM`, W / 2, 13, 11, '#f6d6c0', 'center');
    // bottom-left: speed
    text(String(Math.round(P.speed / MAX * 150)).padStart(3, ' '), 6, H - 28, 28, '#fff');
    text('KM/H', 42, H - 15, 12, '#f6d6c0');

    pops.forEach((p, i) => {
      const a = clamp(1.3 - p.t, 0, 1);
      ctx.globalAlpha = a;
      text(p.text, W / 2, 52 + i * 15 - (reduced ? 0 : p.t * 8), p.big ? 20 : 14, p.color, 'center');
      ctx.globalAlpha = 1;
    });

    if (state === 'count') {
      const n = 3 - Math.floor(stateT / 0.8);
      text(String(n), W / 2, 60, 56, '#ffe14a', 'center', '#d6332a');
    }
    if (state === 'done') {
      ctx.fillStyle = 'rgba(20,10,40,.7)'; ctx.fillRect(40, 44, W - 80, 118);
      ctx.strokeStyle = '#ffe14a'; ctx.strokeRect(40.5, 44.5, W - 81, 117);
      text(`FINISHED ${ORD(result.place)}`, W / 2, 50, 30, '#ffe14a', 'center', '#d6332a');
      const line = result.place === 1 ? 'NH48 KA RAJA!' : result.place <= 3 ? 'NOT BAD, BHAI' : 'AGLI BAAR. NEXT TIME.';
      text(line, W / 2, 82, 15, '#fff', 'center');
      text(`TIME ${fmt(result.time)}${result.newBest ? '  NEW BEST' : `  BEST ${fmt(best)}`}`, W / 2, 102, 13, '#f6d6c0', 'center');
      if (stateT > 1 && blinkOn) text(touchUI ? 'TAP TO RACE AGAIN' : 'PRESS ENTER / TAP TO RACE AGAIN', W / 2, 132, 15, '#9bff5e', 'center');
    }
  }

  // ---------- input ----------
  // only listen while the game window is the thing you're using; typing elsewhere stays yours
  const region = host.closest('.win') || host;
  let active = true;
  const editable = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  const onDocDown = (e) => { active = region.contains(e.target); };
  const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down' };
  const onKey = (e) => {
    if (!active || editable(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    const down = e.type === 'keydown', k = KEYMAP[e.code];
    if (k) { keys[k] = down; lastInput = 'keys'; if (e.code.startsWith('Arrow')) e.preventDefault(); return; }
    if (!down) return;
    if (e.code === 'KeyJ' || e.code === 'KeyZ') { lastInput = 'keys'; playerSlap(-1); }
    else if (e.code === 'KeyK' || e.code === 'KeyX') { lastInput = 'keys'; playerSlap(1); }
    else if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      if (e.repeat) return;
      lastInput = 'keys';
      advance();
    }
  };
  function advance() {
    if (state === 'title' || (state === 'done' && stateT > 1)) startRace();
  }
  const clearKeys = () => { for (const k in keys) keys[k] = false; for (const k in tbtn) tbtn[k] = false; };
  const onCanvasDown = (e) => { active = true; if (e.pointerType !== 'mouse') lastInput = 'buttons'; wrap.focus({ preventScroll: true }); advance(); };
  const onPad = (e) => {
    const b = e.target.closest('button[data-key]');
    if (!b) return;
    e.preventDefault();
    const k = b.dataset.key, down = e.type === 'pointerdown';
    if (down) { active = true; lastInput = 'buttons'; try { b.setPointerCapture(e.pointerId); } catch { /* old browsers */ } }
    b.style.boxShadow = down ? 'inset 3px 3px 0 #9d957e' : btnCss.boxShadow;
    if (k === 'slapL' || k === 'slapR') { if (down) { if (state === 'race') playerSlap(k === 'slapL' ? -1 : 1); else advance(); } return; }
    tbtn[k] = down;
    if (down && state !== 'race') advance();
  };

  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('blur', clearKeys);
  document.addEventListener('pointerdown', onDocDown, true);
  cv.addEventListener('pointerdown', onCanvasDown);
  if (pad) {
    for (const t of ['pointerdown', 'pointerup', 'pointercancel', 'lostpointercapture']) pad.addEventListener(t, onPad);
    pad.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  try { wrap.focus({ preventScroll: true }); } catch { /* not focusable yet */ }

  // ---------- loop: pauses when the tab hides, stops for good if the window is removed ----------
  let raf = 0, last = 0, acc = 0, running = false, dead = false, seen = host.isConnected;
  function frame(t) {
    if (dead) return;
    if (!host.isConnected) { if (seen) { destroy(); return; } raf = requestAnimationFrame(frame); return; }
    seen = true;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (t - last) / 1000)); last = t;
    acc += dt;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
    render();
  }
  function run() { if (running || dead || document.hidden) return; running = true; last = performance.now(); acc = 0; raf = requestAnimationFrame(frame); }
  function halt() { running = false; cancelAnimationFrame(raf); clearKeys(); }
  const onVis = () => (document.hidden ? halt() : run());
  document.addEventListener('visibilitychange', onVis);
  render();
  run();

  function destroy() {
    if (dead) return;
    dead = true; halt();
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    window.removeEventListener('blur', clearKeys);
    document.removeEventListener('pointerdown', onDocDown, true);
    document.removeEventListener('visibilitychange', onVis);
    host.replaceChildren();
  }
  return { destroy, get running() { return running; } };
}
