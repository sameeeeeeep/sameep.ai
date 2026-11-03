// bootseq.js — power-on → ROM check → installer → 56k dial-up, all drawn into a
// 2D canvas that the CRT shader displays through curved glass.
import { sound } from './audio.js';
import { renderDialup } from './synth.js';
import { h, wait } from './util.js';
import { isWispr } from '../version.js';
import { curveK, unbarrel } from './crt.js';

const C = {
  bg: '#04232b', bg2: '#063542', glow: '#b8ffe9', dim: '#5fb3a3', flame: '#ffa946', ember: '#ff6c4c',
  plat: '#dddddd', plat2: '#bbbbbb', plat3: '#888888', white: '#ffffff', ink: '#111111', bondi: '#0a8fa8', lime: '#9bd13a',
};

const loadImg = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });

export async function runBoot({ crt, root, persona, reduced, installer = true }) {
  const cv = document.createElement('canvas');
  const g = cv.getContext('2d');
  let W = 800, H = 600;
  const fit = () => {
    const { w, h } = crt.size;
    const portrait = h > w * 1.1;
    W = portrait ? 440 : 880;
    H = Math.round(W * (h / Math.max(1, w)));
    cv.width = W; cv.height = H;
  };
  fit();
  crt.onResize = fit;
  crt.setSource(cv);
  crt.setMode('screen');

  await Promise.race([
    Promise.all(['24px VT323', '30px "Jersey 10"', '500 14px "Spline Sans Mono"', '800 20px Doto'].map((f) => document.fonts.load(f))),
    wait(1500),
  ]).catch(() => {});
  const cd = await loadImg('img/ui/offthecv.svg');
  const modem = await loadImg('img/ui/dialup.svg');

  // ---------------------------------------------------------- skip + sound, on the glass
  // Drawn into the boot canvas (drawChrome) so they bend with the tube like the rest of the
  // screen. The real <button>s stay for keys, focus and screen readers: invisible, laid
  // over the spot the barrel draws them at (unbarrel(), js/app/crt.js), so clicks land.
  let skipped = false;
  let onSkip = () => {};
  const skipBtn = h('button.boot-skip', { type: 'button', onclick: () => { skipped = true; onSkip(); } }, 'Skip', h('span', { 'aria-hidden': 'true' }, ' ›'));
  const soundBtn = h('button.boot-sound', { type: 'button', 'aria-pressed': String(sound.on), onclick: () => { sound.toggle(); } }, sound.on ? 'Sound on' : 'Sound off');
  const offSound = sound.onChange((on) => { soundBtn.textContent = on ? 'Sound on' : 'Sound off'; soundBtn.setAttribute('aria-pressed', String(on)); });
  const chrome = h('div.boot-chrome.is-glass', soundBtn, skipBtn);
  root.append(chrome);
  // the menu bar's speaker (css/app.css .ico--speaker), 16×16: waves when on, a cross when off
  const SPK = new Path2D('M1 5h3l4-3v12l-4-3H1z');
  const WAVES = new Path2D('M10 5a4 4 0 010 6l-1-1a2.6 2.6 0 000-4zM12 3a7 7 0 010 10l-1-1a5.6 5.6 0 000-8z');
  const MUTE = new Path2D('M10 5l1-1 2 2 2-2 1 1-2 2 2 2-1 1-2-2-2 2-1-1 2-2z');
  const drawChrome = () => {
    const s = W / Math.max(1, crt.size.w); // canvas px per CSS px: the buttons keep their CSS size
    const pad = 14 * s, bh = 44 * s, gap = 8 * s, ico = 18 * s, edge = 32 * s; // in from the edge, clear of the dark corner
    font(25 * s); // a touch over the old 22px DOM size: the tube softens it
    const on = sound.on;
    const bs = [{ el: soundBtn, label: on ? 'Sound on' : 'Sound off', icon: true }, { el: skipBtn, label: 'Skip ›' }];
    let x = W - edge;
    const y = H - edge - bh;
    for (const b of [...bs].reverse()) { b.w = g.measureText(b.label).width + pad * 2 + (b.icon ? ico + 8 * s : 0); x -= b.w; b.x = x; x -= gap; }
    const k = curveK(crt.size.w), tube = crt.host.getBoundingClientRect(), box = root.getBoundingClientRect();
    for (const b of bs) {
      const hot = b.el.matches(':hover'), dim = b.icon && !on;
      g.save();
      g.globalAlpha = dim && !hot ? 0.75 : 1;
      g.beginPath(); g.roundRect ? g.roundRect(b.x, y, b.w, bh, 4 * s) : g.rect(b.x, y, b.w, bh);
      g.fillStyle = hot ? C.glow : 'rgba(4,35,43,.6)'; g.fill();
      g.lineWidth = Math.max(1, s); g.strokeStyle = 'rgba(184,255,233,.5)'; g.stroke();
      if (b.el.matches(':focus-visible')) { g.lineWidth = 2 * s; g.strokeStyle = C.flame; g.strokeRect(b.x - 3 * s, y - 3 * s, b.w + 6 * s, bh + 6 * s); }
      const ink = hot ? C.bg : C.glow;
      if (!hot) { g.shadowColor = 'rgba(184,255,233,.6)'; g.shadowBlur = 8 * s; }
      let tx = b.x + pad;
      if (b.icon) {
        g.save(); g.translate(tx, y + bh / 2 - ico / 2); g.scale(ico / 16, ico / 16);
        g.fillStyle = ink; g.fill(SPK); g.fill(on ? WAVES : MUTE); g.restore();
        tx += ico + 8 * s;
      }
      g.fillStyle = ink; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(b.label, tx, y + bh / 2 + s);
      g.restore();
      // the invisible real button, over where the tube shows this one
      const pts = [[b.x, y], [b.x + b.w, y], [b.x, y + bh], [b.x + b.w, y + bh]].map(([px, py]) => unbarrel(px / W * 2 - 1, py / H * 2 - 1, k));
      const xs = pts.map((p) => (p[0] + 1) / 2 * tube.width + tube.left - box.left), ys = pts.map((p) => (p[1] + 1) / 2 * tube.height + tube.top - box.top);
      const l = Math.min(...xs), t = Math.min(...ys);
      b.el.style.cssText = `left:${l}px;top:${t}px;width:${Math.max(...xs) - l}px;height:${Math.max(...ys) - t}px`;
    }
  };
  const onKey = (e) => { if (e.key === 'Escape') { skipped = true; onSkip(); } };
  addEventListener('keydown', onKey);

  let scene = () => {};
  let running = true;
  const t0 = performance.now();
  const frame = () => {
    if (!running) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    scene((performance.now() - t0) / 1000);
    g.setTransform(1, 0, 0, 1, 0, 0);
    drawChrome();
    crt.dirty = true;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  const sleep = (ms) => new Promise((r) => { const id = setTimeout(r, reduced ? Math.min(ms, 250) : ms); const prev = onSkip; onSkip = () => { clearTimeout(id); r(); prev(); }; });

  // ---------------------------------------------------------- helpers
  const font = (px, fam = 'VT323', w = '') => (g.font = `${w} ${px}px ${fam}`.trim());
  const text = (s, x, y, color = C.glow, align = 'left') => { g.fillStyle = color; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(s, x, y); };
  const bios = (now) => {
    g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
    // faint grid, a nod to the blue loader screens
    g.strokeStyle = 'rgba(184,255,233,0.04)'; g.lineWidth = 1;
    for (let x = 0; x < W; x += 24) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); g.stroke(); }
    for (let y = 0; y < H; y += 24) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); }
  };
  const platWindow = (x, y, w, hh, title) => {
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 4, y + 5, w, hh);
    g.fillStyle = C.plat; g.fillRect(x, y, w, hh);
    g.strokeStyle = C.ink; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, hh - 1);
    g.fillStyle = C.white; g.fillRect(x + 1, y + 1, w - 2, 1); g.fillRect(x + 1, y + 1, 1, hh - 2);
    g.fillStyle = C.plat3; g.fillRect(x + 1, y + hh - 2, w - 2, 1); g.fillRect(x + w - 2, y + 1, 1, hh - 2);
    // title bar stripes
    const tb = 22;
    for (let i = 0; i < 6; i++) { g.fillStyle = C.white; g.fillRect(x + 6, y + 5 + i * 2, w - 12, 1); g.fillStyle = C.plat3; g.fillRect(x + 6, y + 6 + i * 2, w - 12, 1); }
    // close box
    g.fillStyle = C.plat; g.fillRect(x + 10, y + 5, 12, 12); g.strokeStyle = C.ink; g.strokeRect(x + 10.5, y + 5.5, 11, 11);
    font(12, '"Spline Sans Mono"', '500');
    const tw = g.measureText(title).width + 18;
    g.fillStyle = C.plat; g.fillRect(x + w / 2 - tw / 2, y + 3, tw, 16);
    text(title, x + w / 2, y + 15, C.ink, 'center');
    g.fillStyle = C.plat3; g.fillRect(x + 1, y + tb, w - 2, 1);
    return { x: x + 16, y: y + tb + 14, w: w - 32, h: hh - tb - 28 };
  };
  const segBar = (x, y, w, hh, p, color = C.bondi) => {
    g.fillStyle = C.white; g.fillRect(x, y, w, hh);
    g.strokeStyle = C.ink; g.strokeRect(x + 0.5, y + 0.5, w - 1, hh - 1);
    const segs = Math.floor((w - 4) / 9);
    const on = Math.floor(segs * Math.max(0, Math.min(1, p)));
    for (let i = 0; i < on; i++) { g.fillStyle = color; g.fillRect(x + 3 + i * 9, y + 3, 7, hh - 6); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x + 3 + i * 9, y + 3, 7, 2); }
  };
  const wrap = (s, maxW) => {
    const out = []; let line = '';
    for (const w of s.split(' ')) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
    if (line) out.push(line);
    return out;
  };
  const pix = (img, x, y, s) => { if (!img) return; g.imageSmoothingEnabled = false; g.drawImage(img, x, y, s, s); g.imageSmoothingEnabled = true; };

  const cleanup = () => {
    running = false;
    removeEventListener('keydown', offKeyGuard);
    removeEventListener('keydown', onKey);
    offSound();
    chrome.remove();
  };
  const offKeyGuard = () => {};

  // ---------------------------------------------------------- A. power
  const needsGesture = !(await sound.unlock());
  if (needsGesture && !skipped) {
    crt.setPower(1);
    scene = (t) => {
      bios(t);
      const s = Math.min(W, H) * 0.2;
      pix(cd, W / 2 - s / 2, H / 2 - s * 0.95, s);
      font(W < 500 ? 22 : 26); text('Disc detected: ' + (persona.discLabel || 'WORK — DO NOT LOSE'), W / 2, H / 2 + s * 0.35, C.glow, 'center');
      if (Math.floor(t * 1.6) % 2 === 0) { font(W < 500 ? 22 : 26); text(W < 500 ? '[ tap to power on ]' : '[ press any key or click to power on ]', W / 2, H / 2 + s * 0.35 + 40, C.flame, 'center'); }
    };
    await new Promise((resolve) => {
      const go = () => { root.removeEventListener('pointerdown', go); removeEventListener('keydown', go); resolve(); };
      root.addEventListener('pointerdown', go);
      addEventListener('keydown', go);
      const prev = onSkip; onSkip = () => { go(); prev(); };
    });
  }
  await sound.unlock();
  if (skipped) { cleanup(); return { skipped: true }; }

  // power-on raster
  scene = (t) => { bios(t); };
  crt.setPower(0);
  sound.chime();
  const p0 = performance.now();
  await new Promise((r) => { const step = () => { const p = Math.min(1, (performance.now() - p0) / (reduced ? 1 : 520)); crt.setPower(1 - (1 - p) ** 3); if (p < 1) requestAnimationFrame(step); else r(); }; step(); });

  // ---------------------------------------------------------- B. ROM check
  const romLines = [
    `OFF THE CV ROM 1.0   (c) 1999 ${persona.name || 'Sameep Rehlan'}`,
    'Memory test ............ 32768K OK',
    'CD-ROM ................. 24x  OK',
    `Disc ................... "${persona.discLabel || 'WORK — DO NOT LOSE'}"`,
    isWispr ? 'Applications pile ...... 2,000 → 1' : 'CV pile ................ 1,000s → 1',
    'Mounting OFF THE CV.app',
  ];
  const romStart = performance.now();
  scene = () => {
    bios();
    const el = (performance.now() - romStart) / 1000;
    const size = W < 500 ? 20 : 26;
    font(size);
    const lh = size * 1.25;
    const x0 = W < 500 ? 18 : 48;
    let y = W < 500 ? 46 : 64;
    const shown = Math.min(romLines.length, Math.floor(el / 0.26) + 1);
    for (let i = 0; i < shown; i++) {
      const L = romLines[i];
      const chars = i === shown - 1 ? Math.floor(((el - i * 0.26) / 0.26) * L.length) : L.length;
      const s = L.slice(0, Math.max(0, chars));
      const lines = wrap(s, W - x0 * 2);
      lines.forEach((ln) => { text(ln, x0, y, i === 0 ? C.flame : C.glow); y += lh; });
      if (i === 0) y += lh * 0.4;
    }
    if (Math.floor(el * 3) % 2) { g.fillStyle = C.glow; g.fillRect(x0, y - size * 0.75, size * 0.5, size * 0.8); }
  };
  await sleep(2100);
  if (skipped) { cleanup(); return { skipped: true }; }

  // ---------------------------------------------------------- C. installer (skipped when the desktop does the installing: era.js)
  if (installer) {
  const steps = persona.installSteps || [
    'Installing the host…',
    `Installing ${persona.shortName || 'Sameep'} (AI)…`,
    'Teaching the host to wait for your pick…',
    'Removing CV.pdf…',
    'Converting experience to conversation…',
    'Warming up the modem…',
  ];
  const instStart = performance.now();
  const instDur = 4.4;
  scene = () => {
    // desktop-ish backdrop: bondi gradient with a soft dither
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0d6f84'); gr.addColorStop(1, '#063a47');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const el = (performance.now() - instStart) / 1000;
    const p = Math.min(1, el / instDur);
    const ww = Math.min(W - 32, 560), wh = W < 500 ? 300 : 280;
    const wx = Math.round(W / 2 - ww / 2), wy = Math.round(H / 2 - wh / 2);
    const c = platWindow(wx, wy, ww, wh, 'Installer');
    const iconS = W < 500 ? 56 : 72;
    pix(cd, c.x, c.y, iconS);
    const tx = c.x + iconS + 16;
    font(W < 500 ? 24 : 32, '"Jersey 10"', '600'); text(persona.appName || 'OFF THE CV.app', tx, c.y + (W < 500 ? 22 : 28), C.ink);
    font(12, '"Spline Sans Mono"', '500'); text('Version 1.0 (1999)', tx, c.y + (W < 500 ? 42 : 50), '#333');
    font(11, '"Spline Sans Mono"', '400');
    const tag = wrap(persona.appTagline || '90s software that walks you through someone’s work with AI.', c.x + c.w - tx);
    tag.forEach((ln, i) => text(ln, tx, c.y + (W < 500 ? 60 : 70) + i * 15, '#444'));
    const by = c.y + c.h - 52;
    g.fillStyle = C.plat3; g.fillRect(c.x, by - 26, c.w, 1); g.fillStyle = C.white; g.fillRect(c.x, by - 25, c.w, 1);
    const stepI = Math.min(steps.length - 1, Math.floor(p * steps.length));
    font(12, '"Spline Sans Mono"', '500'); text(p >= 1 ? 'Installation complete.' : steps[stepI], c.x, by - 8, C.ink);
    segBar(c.x, by, c.w - 64, 18, p);
    font(18, 'Doto', '800'); text(String(Math.round(p * 100)).padStart(3, ' ') + '%', c.x + c.w, by + 15, C.ink, 'right');
    font(11, '"Spline Sans Mono"', '400'); text(persona.installFooter || (isWispr ? 'Made by voice with Wispr Flow.' : 'Made by voice: dictated end to end.'), c.x, by + 40, '#555');
  };
  await sleep(instDur * 1000 + 600);
  if (skipped) { cleanup(); return { skipped: true }; }
  }

  // ---------------------------------------------------------- D. dial-up
  const dial = renderDialup(22050);
  const player = sound.unlocked ? sound.playSamples(dial.data, dial.sampleRate, { gain: 0.5 }) : null;
  const prevSkip = onSkip; onSkip = () => { player?.stop(); prevSkip(); };
  const M = dial.marks;
  const dStart = performance.now();
  const status = (t) => {
    if (t < M.dialing) return 'Waiting for dial tone…';
    if (t < M.ringing) return 'Dialing 1-555-0199…';
    if (t < M.answer) return 'Ringing…';
    if (t < M.handshake) return 'Modem answered. Negotiating…';
    if (t < M.probing) return 'Handshaking (please hold the line)…';
    if (t < M.training) return 'Probing the line…';
    if (t < M.connected) return 'Training equalizer at 56,000 bps…';
    return 'Connected at 56,000 bps';
  };
  scene = () => {
    const t = player ? player.time : (performance.now() - dStart) / 1000;
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0d6f84'); gr.addColorStop(1, '#063a47');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const ww = Math.min(W - 32, 520), wh = W < 500 ? 330 : 300;
    const wx = Math.round(W / 2 - ww / 2), wy = Math.round(H / 2 - wh / 2);
    const c = platWindow(wx, wy, ww, wh, 'Remote Access');
    pix(modem, c.x, c.y, 48);
    const tx = c.x + 64;
    font(12, '"Spline Sans Mono"', '500');
    text('Connect to:', tx, c.y + 14, '#333'); text('OFF THE CV Online', tx + 100, c.y + 14, C.ink);
    text('Number:', tx, c.y + 32, '#333'); text('1-555-0199 (fictional)', tx + 100, c.y + 32, C.ink);
    // scope of the real handshake audio
    const sx = c.x, sy = c.y + 60, sw = c.w, sh = W < 500 ? 70 : 64;
    g.fillStyle = '#0a1a14'; g.fillRect(sx, sy, sw, sh);
    g.strokeStyle = 'rgba(184,255,233,.12)'; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(sx, sy + (sh * i) / 4 + 0.5); g.lineTo(sx + sw, sy + (sh * i) / 4 + 0.5); g.stroke(); }
    g.strokeStyle = '#57ff9a'; g.lineWidth = 1.5; g.beginPath();
    const k0 = Math.floor(Math.max(0, t) * dial.sampleRate);
    for (let i = 0; i < sw; i++) {
      const v = dial.data[k0 + i * 3] || 0;
      const y = sy + sh / 2 - v * sh * 0.9;
      i ? g.lineTo(sx + i, y) : g.moveTo(sx + i, y);
    }
    g.stroke(); g.lineWidth = 1;
    // status + progress
    const done = t >= M.connected;
    font(13, '"Spline Sans Mono"', done ? '700' : '500');
    text('Status: ' + status(t), c.x, sy + sh + 26, C.ink);
    segBar(c.x, sy + sh + 38, c.w, 16, Math.min(1, t / M.connected), done ? C.lime : C.bondi);
    // LEDs
    ['HS', 'AA', 'CD', 'OH', 'RD', 'SD', 'TR', 'MR'].forEach((l, i) => {
      const lx = c.x + i * (c.w / 8) + 4, ly = sy + sh + 74;
      const on = l === 'OH' ? t > 0.2 : l === 'CD' ? done : l === 'RD' || l === 'SD' ? t > M.answer && Math.random() > 0.4 : l === 'TR' || l === 'MR' || l === 'HS' ? true : t > M.answer;
      g.fillStyle = on ? (l === 'CD' ? C.lime : C.ember) : '#5a1d10'; g.fillRect(lx, ly, 10, 6);
      font(10, '"Spline Sans Mono"', '500'); text(l, lx + 14, ly + 7, '#333');
    });
    if (done) {
      font(W < 500 ? 22 : 26, 'Doto', '800'); text('56,000 bps', c.x + c.w, c.y + 28, C.ink, 'right');
    }
  };
  await sleep(M.connected * 1000 + 300);
  await sleep(900);
  player?.stop();
  cleanup();
  return { skipped };
}
