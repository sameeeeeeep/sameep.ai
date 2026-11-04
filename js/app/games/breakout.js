// breakout.js — Rangoli Breakout, a DOS-era brick breaker on a 320x240 canvas. Three rangoli patterns,
// some bricks need two hits, and now and then a diya falls that widens the paddle. No sound.
import { h } from '../util.js';

export const meta = { id: 'breakout', title: 'Rangoli Breakout', width: 480 };

const W = 320, H = 240, TOP = 16, BW = 16, BH = 8, BX = 16, BY = 30, PY = 222, BALL = 4;
const COL = { p: '#ff3e9a', o: '#ff8a1f', y: '#ffd23f', t: '#1fc7b6', u: '#9b4dff' };
const PAL = Object.values(COL);
const INK = '#f4ecff', DIM = '#8f7fb0', BG = '#140a24';

// 18 columns each, symmetric like a rangoli; a capital letter is a brick that takes two hits
const LEVELS = [
  { name: 'LOTUS', rows: [
    '......uuuuuu......',
    '....uuyyyyyyuu....',
    '..uuyyooOOooyyuu..',
    'ttyyooppPPppooyytt',
    '..uuyyooOOooyyuu..',
    '....uuyyyyyyuu....',
    '......uuuuuu......'] },
  { name: 'KOLAM STAR', rows: [
    '........PP........',
    '......ppyypp......',
    '..t..ooyUUyoo..t..',
    'tTt.ooyuuuuyoo.tTt',
    '..t..ooyUUyoo..t..',
    '......ppyypp......',
    '........PP........',
    'oyoyoyoyooyoyoyoyo'] },
  { name: 'DIWALI THALI', rows: [
    'uuuuuuuuuuuuuuuuuu',
    'uTTTTTTTTTTTTTTTTu',
    'uTppppppppppppppTu',
    'uTpOOOOyyyyOOOOpTu',
    'uTpOyyyPPPPyyyOpTu',
    'uTpOOOOyyyyOOOOpTu',
    'uTppppppppppppppTu',
    'uTTTTTTTTTTTTTTTTu'] },
];

// 3x5 pixel font, one octal digit per row
const FONT = Object.fromEntries(('A25755 B65656 C34443 D65556 E74647 F74644 G34553 H55755 I72227 J11152 K55655 L44447 M57755 ' +
  'N65555 O25552 P65644 Q25563 R65655 S34216 T72222 U55557 V55552 W55775 X55255 Y55222 Z71247 075557 126227 261247 361216 ' +
  '455711 574616 634757 771222 875757 975716 /11244 :02020 !22202 .00002 -00700 +02720 =07070').split(' ').map((g) => [g[0], g.slice(1)]));
function text(ctx, s, x, y, k, col, align = 'left') {
  s = String(s).toUpperCase();
  const w = s.length * 4 * k - k;
  x = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
  [...s].forEach((ch) => {
    const g = FONT[ch];
    ctx.fillStyle = typeof col === 'function' ? col(ch, x) : col;
    if (g) for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (+g[r] & (4 >> c)) ctx.fillRect(x + c * k, y + r * k, k, k);
    x += 4 * k;
  });
}

// the falling diya: y flame, o flame core, c clay, d dark clay
const DIYA = ['...y...', '..yoy..', '...o...', 'ccccccc', '.ccdcc.', '..ddd..'];
const DIYA_C = { y: '#ffe36a', o: '#ff8a1f', c: '#d0602a', d: '#7a2e14' };

const CSS = `
.bk{display:flex;flex-direction:column;align-items:center;gap:8px;outline:none;user-select:none;-webkit-user-select:none}
.bk canvas{display:block;width:100%;height:auto;image-rendering:crisp-edges;image-rendering:pixelated;touch-action:none;border:2px solid #111;box-sizing:border-box;background:${BG};cursor:none}
.bk-help{margin:0;font:11px/1.3 Geneva,Verdana,sans-serif;color:#444;text-align:center}`;

export function mount(host, { reduced = false, narrow = false } = {}) {
  const touch = narrow || matchMedia('(pointer: coarse)').matches;
  const cv = h('canvas', { width: W, height: H, 'aria-label': 'Rangoli Breakout game screen' });
  const ctx = cv.getContext('2d');
  const root = h('div.bk', { tabindex: '0' }, h('style', CSS), cv,
    h('p.bk-help', touch ? 'Drag to move the paddle · tap to launch' : 'Mouse or ←/→ (A/D) to move · Space launches · P pauses'));
  host.append(root);

  // a faint kolam dot grid, drawn once
  const bg = document.createElement('canvas'); bg.width = W; bg.height = H;
  const bx = bg.getContext('2d');
  bx.fillStyle = BG; bx.fillRect(0, 0, W, H);
  bx.fillStyle = '#2a1a46';
  for (let y = TOP + 8; y < H; y += 16) for (let x = 8; x < W; x += 16) bx.fillRect(x, y, 1, 1);
  bx.fillStyle = '#3a2a5a'; bx.fillRect(0, TOP - 2, W, 1);

  let state = 'title', paused = false, raf = 0, last = 0, gone = false;
  let level = 0, score = 0, lives = 3, bricks = [], ball, speed, px = W / 2, wideT = 0, diya = null, parts = [], shake = 0, flash = 0;
  const keys = new Set();
  const pw = () => (wideT > 0 ? 60 : 40);

  function load(n) {
    level = n; bricks = [];
    LEVELS[n].rows.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch === '.') return;
      const hp = ch === ch.toUpperCase() ? 2 : 1;
      bricks.push({ x: BX + c * BW, y: BY + r * BH, col: COL[ch.toLowerCase()], hp });
    }));
    serve();
  }
  function serve() { state = 'serve'; ball = { x: px - 2, y: PY - BALL, vx: 0, vy: 0 }; speed = 150 + level * 15; diya = null; }
  function newGame() { score = 0; lives = 3; wideT = 0; parts = []; load(0); }
  function launch() {
    const a = (Math.random() - 0.5) * 0.8;
    ball.vx = speed * Math.sin(a); ball.vy = -speed * Math.cos(a);
    state = 'play';
  }
  // one button for everything: start, launch, next level, play again, unpause
  function action() {
    if (paused) { paused = false; return; }
    if (state === 'title' || state === 'over' || state === 'win') newGame();
    else if (state === 'serve') launch();
    else if (state === 'clear') load(level + 1);
  }

  function hit(b) {
    b.hp--;
    speed = Math.min(270, speed + 1.5);
    if (b.hp > 0) { score += 5; return; }
    score += 10;
    bricks.splice(bricks.indexOf(b), 1);
    if (!reduced) for (let i = 0; i < 5; i++) parts.push({ x: b.x + 8, y: b.y + 4, vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 80, t: 0.45, col: b.col });
    if (!diya && Math.random() < 0.14) diya = { x: b.x + 1, y: b.y };
    if (!bricks.length) { state = 'clear'; flash = reduced ? 0 : 0.4; if (level === LEVELS.length - 1) state = 'win'; }
  }
  const overlap = (b) => ball.x < b.x + BW - 1 && ball.x + BALL > b.x && ball.y < b.y + BH - 1 && ball.y + BALL > b.y;

  // move one axis at a time and bounce on whichever axis hit, in small steps so a fast ball can't tunnel
  function stepBall(d) {
    ball.x += ball.vx * d;
    if (ball.x < 0) { ball.x = 0; ball.vx = Math.abs(ball.vx); }
    if (ball.x + BALL > W) { ball.x = W - BALL; ball.vx = -Math.abs(ball.vx); }
    let b = bricks.find(overlap);
    if (b) { ball.x -= ball.vx * d; ball.vx = -ball.vx; hit(b); if (state !== 'play') return; }
    ball.y += ball.vy * d;
    if (ball.y < TOP) { ball.y = TOP; ball.vy = Math.abs(ball.vy); }
    b = bricks.find(overlap);
    if (b) { ball.y -= ball.vy * d; ball.vy = -ball.vy; hit(b); if (state !== 'play') return; }
    // the paddle steers: where it lands sets the angle, up to 60 degrees off vertical
    const w = pw();
    if (ball.vy > 0 && ball.y + BALL >= PY && ball.y + BALL <= PY + 6 && ball.x + BALL > px - w / 2 && ball.x < px + w / 2) {
      const t = Math.max(-1, Math.min(1, (ball.x + BALL / 2 - px) / (w / 2)));
      ball.vx = speed * Math.sin(t * 1.05); ball.vy = -speed * Math.cos(t * 1.05); ball.y = PY - BALL;
    }
    if (ball.y > H) {
      lives--; wideT = 0;
      if (!reduced) shake = 0.3;
      if (lives <= 0) state = 'over'; else serve();
    }
  }

  function update(dt) {
    const k = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
    if (k) px += k * 240 * dt;
    px = Math.max(pw() / 2, Math.min(W - pw() / 2, px));
    if (state === 'serve') { ball.x = px - BALL / 2; ball.y = PY - BALL; }
    if (state === 'play') {
      const n = Math.ceil((speed * dt) / 2);
      for (let i = 0; i < n && state === 'play'; i++) stepBall(dt / n);
    }
    if (state === 'play' || state === 'serve') {
      if (wideT > 0) wideT -= dt;
      if (diya) {
        diya.y += 55 * dt;
        if (diya.y + 12 >= PY && diya.y <= PY + 6 && diya.x + 14 > px - pw() / 2 && diya.x < px + pw() / 2) { wideT = 12; score += 25; diya = null; }
        else if (diya.y > H) diya = null;
      }
    }
    for (const p of parts) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; }
    parts = parts.filter((p) => p.t > 0);
    shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt);
  }

  function frame(t) {
    if (!host.isConnected) return destroy();
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
    if (!paused) update(dt);
    draw(t);
  }

  function brick(b) {
    ctx.fillStyle = b.col; ctx.fillRect(b.x, b.y, BW - 1, BH - 1);
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(b.x, b.y, BW - 1, 1); ctx.fillRect(b.x, b.y, 1, BH - 1);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(b.x, b.y + BH - 2, BW - 1, 1); ctx.fillRect(b.x + BW - 2, b.y, 1, BH - 1);
    // two-hit bricks wear a white rangoli dot-diamond until the first hit
    if (b.hp > 1) { ctx.fillStyle = '#fff'; ctx.fillRect(b.x + 7, b.y + 2, 1, 1); ctx.fillRect(b.x + 6, b.y + 3, 3, 1); ctx.fillRect(b.x + 7, b.y + 4, 1, 1); }
  }
  function draw(t) {
    ctx.save();
    if (shake > 0) ctx.translate(Math.round((Math.random() - 0.5) * 4), Math.round((Math.random() - 0.5) * 4));
    ctx.drawImage(bg, 0, 0);
    if (state === 'title') { title(t); ctx.restore(); return; }
    text(ctx, 'SCORE ' + String(score).padStart(5, '0'), 4, 2, 2, INK);
    text(ctx, 'LV ' + (level + 1), W / 2, 2, 2, DIM, 'center');
    for (let i = 0; i < lives; i++) { ctx.fillStyle = PAL[i % PAL.length]; ctx.fillRect(W - 8 - i * 10, 4, 6, 6); }
    bricks.forEach(brick);
    if (diya) DIYA.forEach((row, r) => [...row].forEach((p, c) => { if (p !== '.') { ctx.fillStyle = DIYA_C[p]; ctx.fillRect(diya.x + c * 2, diya.y + r * 2, 2, 2); } }));
    for (const p of parts) { ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); }
    // paddle: a striped border, like the edge of a saree
    const w = pw(), x = Math.round(px - w / 2);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x, PY, w, 6);
    ctx.fillStyle = '#ff3e9a'; for (let i = 2; i < w - 2; i += 6) ctx.fillRect(x + i, PY + 2, 3, 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(x, PY, w, 1);
    if (wideT > 0 && (wideT > 2 || Math.floor(t / 120) % 2)) { ctx.fillStyle = '#ff8a1f'; ctx.fillRect(x, PY + 5, w, 1); }
    if (state !== 'over') { ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(ball.x), Math.round(ball.y), BALL, BALL); }
    if (state === 'serve') msg([LEVELS[level].name, touch ? 'TAP TO LAUNCH' : 'SPACE TO LAUNCH']);
    else if (state === 'clear') msg(['LEVEL ' + (level + 1) + ' CLEAR!', 'NEXT: ' + LEVELS[level + 1].name, 'ENTER / TAP TO GO ON']);
    else if (state === 'win') msg(['YOU WIN!', 'SCORE ' + score, 'ENTER / TAP TO PLAY AGAIN']);
    else if (state === 'over') msg(['GAME OVER', 'SCORE ' + score, 'ENTER / TAP TO TRY AGAIN']);
    else if (paused) msg(['PAUSED', 'PRESS ANY KEY']);
    if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash})`; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }
  function msg(lines) {
    const y = 120;
    ctx.fillStyle = 'rgba(20,10,36,.85)'; ctx.fillRect(28, y - 6, W - 56, lines.length * 16 + 8);
    ctx.fillStyle = '#ff3e9a'; ctx.fillRect(28, y - 6, W - 56, 1); ctx.fillRect(28, y + lines.length * 16 + 1, W - 56, 1);
    lines.forEach((l, i) => text(ctx, l, W / 2, y + i * 16, 2, i ? INK : '#ffd23f', 'center'));
  }
  function title(t) {
    const rainbow = (ch, x) => PAL[Math.floor(x / 16) % PAL.length];
    text(ctx, 'RANGOLI', W / 2, 40, 5, rainbow, 'center');
    text(ctx, 'BREAKOUT', W / 2, 74, 5, rainbow, 'center');
    // a little rangoli of bricks
    const ring = ['..pp..', '.oyyo.', 'putTup', '.oyyo.', '..pp..'];
    ring.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch !== '.') brick({ x: W / 2 - 48 + c * BW, y: 112 + r * BH, col: COL[ch.toLowerCase()], hp: ch === ch.toUpperCase() ? 2 : 1 });
    }));
    if (reduced || Math.floor(t / 500) % 2 === 0) text(ctx, 'PRESS ENTER / TAP TO START', W / 2, 168, 2, INK, 'center');
    text(ctx, touch ? 'DRAG TO MOVE  TAP TO LAUNCH' : 'MOUSE OR ARROWS  SPACE LAUNCHES', W / 2, 192, 2, DIM, 'center');
    text(ctx, '3 LIVES  3 LEVELS  CATCH THE DIYA', W / 2, 210, 2, DIM, 'center');
  }

  // keys only count while the game is the thing you last touched or focused
  let armed = true;
  const onDown = (e) => { armed = host.contains(e.target); if (!armed) keys.clear(); };
  const onFocus = (e) => { armed = host.contains(e.target); if (!armed) keys.clear(); };
  const onKey = (e) => {
    // a key aimed at something else that has focus (a field, another window) is never ours
    const elsewhere = e.target instanceof Element && e.target !== document.body && e.target !== document.documentElement && !host.contains(e.target);
    if (!armed || elsewhere || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) { keys.add(e.code); if (paused) paused = false; return; }
    if (e.repeat) return;
    if (e.code === 'Enter' || e.code === 'Space') return action();
    if (e.code === 'KeyP' && (state === 'play' || state === 'serve')) return (paused = !paused);
    if (paused) paused = false;
  };
  const onKeyUp = (e) => keys.delete(e.code);
  const onBlur = () => keys.clear();
  const onVis = () => { if (document.hidden) { keys.clear(); if (state === 'play') paused = true; } };

  // pointer: hover moves the paddle with a mouse, drag moves it on touch; a tap (no real drag) is the action
  const toX = (e) => { const r = cv.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * W; };
  let down = null;
  const onPDown = (e) => {
    down = { x: e.clientX, y: e.clientY, moved: false };
    root.focus({ preventScroll: true });
    try { cv.setPointerCapture(e.pointerId); } catch { /* fine */ }
    if (e.pointerType !== 'mouse') px = toX(e);
  };
  const onPMove = (e) => {
    if (e.pointerType === 'mouse' || down) px = toX(e);
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) down.moved = true;
  };
  const onPUp = () => { if (down && !down.moved) action(); down = null; };
  cv.addEventListener('pointerdown', onPDown);
  cv.addEventListener('pointermove', onPMove);
  cv.addEventListener('pointerup', onPUp);
  cv.addEventListener('pointercancel', () => { down = null; });
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('focusin', onFocus, true);
  document.addEventListener('visibilitychange', onVis);

  raf = requestAnimationFrame(frame);
  requestAnimationFrame(() => { if (!gone) root.focus({ preventScroll: true }); });

  function destroy() {
    if (gone) return;
    gone = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    document.removeEventListener('pointerdown', onDown, true);
    document.removeEventListener('focusin', onFocus, true);
    document.removeEventListener('visibilitychange', onVis);
    host.replaceChildren();
  }
  return { destroy };
}
