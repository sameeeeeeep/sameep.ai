// snake.js — Samosa Snake, a 1997 phone-LCD snake. The LCD is 160x144 real pixels scaled up crisp;
// walls kill, like they did on the phones. Every 5th thing to eat is a chai that goes cold in 5 seconds.
// No sound: the phone was on silent.
import { h, store } from '../util.js';

export const meta = { id: 'snake', title: 'Samosa Snake', width: 380 };

const W = 160, H = 144, CELL = 8, COLS = 19, ROWS = 15, X0 = 4, Y0 = 19;
const C = { bg: '#9bbc0f', off: '#93b40f', mid: '#306230', ink: '#0f380f', ghost: '#6f8f1f' };
const CHAI_MS = 5000, BEST = 'samosa-snake-best';

// 3x5 pixel font, one octal digit per row (the phone had nothing smoother)
const FONT = Object.fromEntries(('A25755 B65656 C34443 D65556 E74647 F74644 G34553 H55755 I72227 J11152 K55655 L44447 M57755 ' +
  'N65555 O25552 P65644 Q25563 R65655 S34216 T72222 U55557 V55552 W55775 X55255 Y55222 Z71247 075557 126227 261247 361216 ' +
  '455711 574616 634757 771222 875757 975716 /11244 :02020 !22202 .00002 -00700 +02720 =07070').split(' ').map((g) => [g[0], g.slice(1)]));
function text(ctx, s, x, y, k, col, align = 'left') {
  s = String(s).toUpperCase();
  const w = s.length * 4 * k - k;
  x = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
  ctx.fillStyle = col;
  for (const ch of s) {
    const g = FONT[ch];
    if (g) for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (+g[r] & (4 >> c)) ctx.fillRect(x + c * k, y + r * k, k, k);
    x += 4 * k;
  }
}

// 7x7 sprites: # ink, + mid, o lit. Two chai frames so the steam wobbles.
const SAMOSA = ['.......', '...#...', '..#+#..', '.#+o+#.', '#+++++#', '#######', '.......'];
// the big one for the title, crimped along the bottom like the real thing
const BIG = ['......#......', '.....#+#.....', '....#+o+#....', '...#+++++#...', '..#++o++++#..', '.#+++++++o+#.', '#+++++++++++#', '#############', '.#.#.#.#.#.#.'];
const CHAI = [['.#..#..', '..#..#.', '#####..', '#+++###', '#+++#.#', '#+++###', '.###...'],
  ['..#..#.', '.#..#..', '#####..', '#+++###', '#+++#.#', '#+++###', '.###...']];
function sprite(ctx, rows, x, y, k = 1) {
  rows.forEach((row, r) => [...row].forEach((p, c) => {
    if (p === '.') return;
    ctx.fillStyle = p === '#' ? C.ink : p === 'o' ? C.bg : C.mid;
    ctx.fillRect(x + c * k, y + r * k, k, k);
  }));
}

const DIRS = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };

const CSS = `
.sn{display:flex;flex-direction:column;align-items:center;gap:10px;outline:none;user-select:none;-webkit-user-select:none}
.sn-bezel{width:100%;box-sizing:border-box;padding:10px 10px 14px;background:#3b403a;border:2px solid #111;border-radius:8px 8px 20px 20px;box-shadow:inset 2px 2px 0 #5d635b,inset -2px -2px 0 #262a25}
.sn-bezel canvas{display:block;width:100%;height:auto;image-rendering:crisp-edges;image-rendering:pixelated;touch-action:none;border:2px solid #1b1f1a;box-sizing:border-box;background:${C.bg}}
.sn-brand{margin:8px 0 0;text-align:center;font:bold 10px/1 Geneva,Verdana,sans-serif;letter-spacing:3px;color:#9aa096}
.sn-pad{display:grid;grid-template-columns:repeat(3,46px);grid-template-rows:repeat(3,40px);gap:4px}
.sn-pad button{font:14px/1 Geneva,Verdana,sans-serif;color:#111;background:#dcdcdc;border:1px solid #111;border-radius:4px;box-shadow:inset 1px 1px 0 #fff,inset -1px -1px 0 #888;touch-action:none;padding:0;cursor:pointer}
.sn-pad button:active{background:#b8b8b8;box-shadow:inset 1px 1px 0 #777}
.sn-help{margin:0;font:11px/1.3 Geneva,Verdana,sans-serif;color:#444;text-align:center}`;

export function mount(host, { reduced = false, narrow = false } = {}) {
  const touch = narrow || matchMedia('(pointer: coarse)').matches;
  const cv = h('canvas', { width: W, height: H, 'aria-label': 'Samosa Snake game screen' });
  const ctx = cv.getContext('2d');
  const btn = (label, aria, fn) => h('button', { type: 'button', tabindex: '-1', 'aria-label': aria, onpointerdown: (e) => { e.preventDefault(); fn(); } }, label);
  const pad = touch && h('div.sn-pad',
    h('span'), btn('▲', 'Up', () => turn(0, -1)), h('span'),
    btn('◀', 'Left', () => turn(-1, 0)), btn('●', 'Start or pause', () => action()), btn('▶', 'Right', () => turn(1, 0)),
    h('span'), btn('▼', 'Down', () => turn(0, 1)), h('span'));
  const root = h('div.sn', { tabindex: '0' }, h('style', CSS), h('div.sn-bezel', cv, h('p.sn-brand', 'SAMOSAFONE')), pad,
    h('p.sn-help', touch ? 'Swipe the screen or use the pad. ● starts and pauses.' : 'Arrows or WASD to steer · Enter starts · P pauses'));
  host.append(root);

  let state = 'title', paused = false, raf = 0, last = 0, acc = 0, clock = 0, dieT = 0, gone = false;
  let snake, dir, queue, item, score = 0, eaten, step, ghosts = [], newBest = false;
  let best = +store.get(BEST) || 0;

  function reset() {
    snake = [{ x: 6, y: 7 }, { x: 5, y: 7 }, { x: 4, y: 7 }];
    dir = [1, 0]; queue = []; ghosts = []; score = 0; eaten = 0; step = 170; acc = 0; clock = 0; newBest = false;
    spawn();
  }
  function spawn() {
    const free = [];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (!snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
    if (!free.length) return die();
    const at = free[Math.floor(Math.random() * free.length)];
    // every 5th item is a chai, worth more but only while it's hot
    item = { ...at, chai: (eaten + 1) % 5 === 0, born: clock };
  }
  function start() { reset(); state = 'play'; paused = false; }
  function die() {
    state = 'dying'; dieT = 0;
    if (score > best) { best = score; newBest = true; store.set(BEST, String(best)); }
  }
  // queue turns so two quick taps between ticks both count, but never a 180
  function turn(dx, dy) {
    if (state === 'title' || state === 'over') return start();
    if (paused) { paused = false; return; }
    if (state !== 'play') return;
    const [lx, ly] = queue.length ? queue[queue.length - 1] : dir;
    if ((dx === -lx && dy === -ly) || (dx === lx && dy === ly) || queue.length > 2) return;
    queue.push([dx, dy]);
  }
  function action() {
    if (state === 'title' || state === 'over') start();
    else if (state === 'play') paused = !paused;
  }

  function tick() {
    if (queue.length) dir = queue.shift();
    const hd = { x: snake[0].x + dir[0], y: snake[0].y + dir[1] };
    const eats = item && hd.x === item.x && hd.y === item.y;
    const body = eats ? snake : snake.slice(0, -1);
    if (hd.x < 0 || hd.y < 0 || hd.x >= COLS || hd.y >= ROWS || body.some((s) => s.x === hd.x && s.y === hd.y)) return die();
    snake.unshift(hd);
    if (eats) {
      score += item.chai ? 50 : 10; eaten++;
      step = Math.max(65, step - 5);
      spawn();
    } else {
      const t = snake.pop();
      ghosts.push({ x: t.x, y: t.y, a: 1 });
    }
  }

  function frame(t) {
    if (!host.isConnected) return destroy();
    raf = requestAnimationFrame(frame);
    const dt = Math.min(100, t - (last || t)); last = t;
    if (state === 'play' && !paused) {
      clock += dt; acc += dt;
      while (acc >= step && state === 'play') { acc -= step; tick(); }
      // a chai left too long goes cold; it still counts as the 5th item
      if (state === 'play' && item && item.chai && clock - item.born > CHAI_MS) { eaten++; spawn(); }
    } else if (state === 'dying') {
      dieT += dt;
      if (dieT > (reduced ? 500 : 1000)) state = 'over';
    }
    if (!paused) for (const g of ghosts) g.a -= dt / 140;
    ghosts = ghosts.filter((g) => g.a > 0);
    draw(t);
  }

  function field() {
    // unlit LCD cells, so the screen reads as a dot matrix even when empty
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.off;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) ctx.fillRect(X0 + x * CELL, Y0 + y * CELL, 7, 7);
    ctx.fillStyle = C.ink;
    ctx.fillRect(2, 17, 156, 1); ctx.fillRect(2, 140, 156, 1); ctx.fillRect(2, 17, 1, 124); ctx.fillRect(157, 17, 1, 124);
  }

  function draw(t) {
    field();
    if (state === 'title') return title(t);
    // hud: score left, best right, a shrinking bar while the chai is hot
    text(ctx, String(score).padStart(4, '0'), 4, 4, 2, C.ink);
    text(ctx, 'HI ' + String(best).padStart(4, '0'), 156, 6, 1, C.mid, 'right');
    if (item && item.chai && state === 'play') {
      const left = Math.max(0, 1 - (clock - item.born) / CHAI_MS);
      ctx.fillStyle = C.mid; ctx.fillRect(48, 7, Math.round(44 * left), 3);
      ctx.fillStyle = C.ink; ctx.fillRect(47, 6, 1, 5); ctx.fillRect(92, 6, 1, 5);
    }
    // the ghost of where the tail just was: the slow LCD hasn't caught up yet
    for (const g of ghosts) {
      ctx.globalAlpha = Math.max(0, g.a) * 0.6; ctx.fillStyle = C.ghost;
      ctx.fillRect(X0 + g.x * CELL, Y0 + g.y * CELL, 7, 7);
    }
    ctx.globalAlpha = 1;
    if (item) {
      const blink = item.chai && clock - item.born > CHAI_MS - 1500 && Math.floor(clock / 150) % 2;
      if (!blink) sprite(ctx, item.chai ? CHAI[Math.floor(t / 300) % 2] : SAMOSA, X0 + item.x * CELL, Y0 + item.y * CELL);
    }
    const hide = state === 'dying' && !reduced && Math.floor(dieT / 160) % 2;
    if (!hide) snake.forEach((s, i) => {
      const x = X0 + s.x * CELL, y = Y0 + s.y * CELL;
      ctx.fillStyle = C.ink; ctx.fillRect(x, y, 7, 7);
      // bridge to the next segment so the body reads as one snake, notched like the phones
      const n = snake[i + 1];
      if (n) ctx.fillRect(Math.min(x, X0 + n.x * CELL) + (n.x !== s.x ? 7 : 1), Math.min(y, Y0 + n.y * CELL) + (n.y !== s.y ? 7 : 1), n.x !== s.x ? 1 : 5, n.y !== s.y ? 1 : 5);
      if (i === 0) { ctx.fillStyle = C.bg; ctx.fillRect(x + 3 + dir[0] * 2 - (dir[1] ? 1 : 0), y + 3 + dir[1] * 2 - (dir[0] ? 1 : 0), 1, 1); ctx.fillRect(x + 3 + dir[0] * 2 + (dir[1] ? 1 : 0), y + 3 + dir[1] * 2 + (dir[0] ? 1 : 0), 1, 1); }
    });
    if (state === 'over') over();
    else if (paused) box(['PAUSED', 'PRESS ANY KEY']);
  }

  function box(lines) {
    const hgt = lines.length * 10 + 8;
    const y = Math.round(Y0 + 60 - hgt / 2);
    ctx.fillStyle = C.ink; ctx.fillRect(18, y - 1, 124, hgt + 2);
    ctx.fillStyle = C.bg; ctx.fillRect(19, y, 122, hgt);
    lines.forEach((l, i) => text(ctx, l, 80, y + 5 + i * 10, 1, C.ink, 'center'));
  }
  function title(t) {
    text(ctx, 'SAMOSA', 80, 30, 3, C.ink, 'center');
    text(ctx, 'SNAKE', 80, 50, 3, C.ink, 'center');
    sprite(ctx, BIG, 67, 72, 2);
    if (reduced || Math.floor(t / 600) % 2 === 0) { text(ctx, 'PRESS ENTER / TAP', 80, 98, 1, C.ink, 'center'); text(ctx, 'TO START', 80, 106, 1, C.ink, 'center'); }
    text(ctx, 'WALLS KILL  CHAI = 50', 80, 122, 1, C.mid, 'center');
    if (best) text(ctx, 'HI ' + best, 80, 6, 1, C.mid, 'center');
  }
  function over() {
    const y = 42;
    ctx.fillStyle = C.ink; ctx.fillRect(14, y - 1, 132, 62);
    ctx.fillStyle = C.bg; ctx.fillRect(15, y, 130, 60);
    text(ctx, 'GAME OVER', 80, y + 6, 2, C.ink, 'center');
    text(ctx, 'SCORE ' + score, 80, y + 22, 1, C.ink, 'center');
    text(ctx, newBest ? 'NEW BEST!' : 'BEST ' + best, 80, y + 31, 1, C.mid, 'center');
    text(ctx, 'ENTER / TAP', 80, y + 43, 1, C.ink, 'center');
    text(ctx, 'TO PLAY AGAIN', 80, y + 51, 1, C.ink, 'center');
  }

  // keys only count while the game is the thing you last touched or focused
  let armed = true;
  const onDown = (e) => { armed = host.contains(e.target); };
  const onFocus = (e) => { armed = host.contains(e.target); };
  const onKey = (e) => {
    // a key aimed at something else that has focus (a field, another window) is never ours
    const elsewhere = e.target instanceof Element && e.target !== document.body && e.target !== document.documentElement && !host.contains(e.target);
    if (!armed || elsewhere || e.metaKey || e.ctrlKey || e.altKey) return;
    const d = DIRS[e.code];
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    if (d) return turn(d[0], d[1]);
    if (e.code === 'Enter' || e.code === 'Space') return paused ? (paused = false) : action();
    if (e.code === 'KeyP') return action();
    if (paused) paused = false;
  };
  const onVis = () => { if (document.hidden && state === 'play') paused = true; };

  // swipes on the screen: every 18px of drag is one turn, so you can steer without lifting
  let sw = null;
  const onPDown = (e) => { sw = { x: e.clientX, y: e.clientY, moved: false }; root.focus({ preventScroll: true }); try { cv.setPointerCapture(e.pointerId); } catch { /* fine */ } };
  const onPMove = (e) => {
    if (!sw) return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    if (state === 'play') Math.abs(dx) > Math.abs(dy) ? turn(Math.sign(dx), 0) : turn(0, Math.sign(dy));
    sw = { x: e.clientX, y: e.clientY, moved: true };
  };
  const onPUp = () => {
    if (sw && !sw.moved) paused ? (paused = false) : state !== 'play' ? action() : null;
    sw = null;
  };
  cv.addEventListener('pointerdown', onPDown);
  cv.addEventListener('pointermove', onPMove);
  cv.addEventListener('pointerup', onPUp);
  cv.addEventListener('pointercancel', () => { sw = null; });
  window.addEventListener('keydown', onKey);
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
    document.removeEventListener('pointerdown', onDown, true);
    document.removeEventListener('focusin', onFocus, true);
    document.removeEventListener('visibilitychange', onVis);
    host.replaceChildren();
  }
  return { destroy };
}
