// Draws the desktop's pixel-art icons (original art, 32×32 grid) → img/ui/*.svg
// Run: node tools/build-icons.mjs   (from site/)
import { writeFileSync, mkdirSync } from 'node:fs';

const N = 32;
const C = {
  k: '#111111', w: '#ffffff', g1: '#eeeeee', g2: '#dddddd', g3: '#bbbbbb', g4: '#888888', g5: '#555555',
  beige: '#e9e0c9', beige2: '#cfc3a5', beige3: '#a8987a',
  bondi: '#0a8fa8', bondiL: '#5cc8db', bondiD: '#06606f', aqua: '#b8ffe9',
  tang: '#ff8a1f', tangD: '#c75f0a', straw: '#ff4f7b', strawD: '#c22a54', grape: '#7b4fd6', grapeL: '#a888ee',
  lime: '#9bd13a', limeD: '#5f8f1c', yellow: '#ffd23f', flame: '#ffa946', ember: '#ff6c4c',
  clay: '#d4744e', clayD: '#9e4a2b', cream: '#fff7e3', brown: '#8a5a2b', brownL: '#c08850', brownD: '#5a3612',
  term: '#0c2a1f', termG: '#57ff9a', sky: '#9fd8ff', water: '#2f7fa8', waterL: '#56a9cf', wood: '#a0642d', woodL: '#d39a5a',
  folder: '#a9a9f5', folderD: '#6b6bc7', folderL: '#d6d6ff',
};

function canvas() {
  const b = new Array(N * N).fill(null);
  const api = {
    b,
    px(x, y, c) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < N && y < N) b[y * N + x] = C[c] || c; },
    get(x, y) { return x >= 0 && y >= 0 && x < N && y < N ? b[y * N + x] : null; },
    rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) api.px(x + i, y + j, c); },
    frame(x, y, w, h, c) { api.rect(x, y, w, 1, c); api.rect(x, y + h - 1, w, 1, c); api.rect(x, y, 1, h, c); api.rect(x + w - 1, y, 1, h, c); },
    hline(x0, x1, y, c) { for (let x = x0; x <= x1; x++) api.px(x, y, c); },
    vline(x, y0, y1, c) { for (let y = y0; y <= y1; y++) api.px(x, y, c); },
    line(x0, y0, x1, y1, c) {
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let e = dx + dy;
      for (;;) { api.px(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
    },
    disc(cx, cy, r, c) { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) api.px(x, y, c); },
    ellipse(cx, cy, rx, ry, c) { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) api.px(x, y, c); },
    fn(f) { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const c = f(x, y); if (c) api.px(x, y, c); } },
    round(x, y, w, h, c) { api.rect(x + 1, y, w - 2, h, c); api.rect(x, y + 1, w, h - 2, c); },
    // black outline around everything drawn so far
    outline(c = 'k') {
      const add = [];
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (api.get(x, y)) continue;
        if (api.get(x - 1, y) || api.get(x + 1, y) || api.get(x, y - 1) || api.get(x, y + 1)) add.push([x, y]);
      }
      add.forEach(([x, y]) => api.px(x, y, c));
    },
    text(str, x, y, c) { // 3×5 micro font
      const F = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111', C: '111100100100111', V: '101101101101010', '?': '111001011000010', '!': '010010010000010', R: '110101110101101', W: '101101101111101' };
      [...str].forEach((ch, i) => { const g = F[ch]; if (!g) return; for (let j = 0; j < 15; j++) if (g[j] === '1') api.px(x + i * 4 + (j % 3), y + Math.floor(j / 3), c); });
    },
  };
  return api;
}

function toSVG(b, size = N) {
  let out = '';
  for (let y = 0; y < N; y++) {
    let x = 0;
    while (x < N) {
      const c = b[y * N + x];
      if (!c) { x++; continue; }
      let w = 1; while (x + w < N && b[y * N + x + w] === c) w++;
      out += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${c}"/>`;
      x += w;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" width="${size}" height="${size}" shape-rendering="crispEdges">${out}</svg>\n`;
}

const icons = {};

// Shared: a paper document with a folded corner
function doc(p, x = 6, y = 3, w = 20, h = 26) {
  p.rect(x, y, w, h, 'w');
  p.rect(x + w - 6, y, 6, 6, null);
  for (let i = 0; i < 6; i++) p.hline(x + w - 6, x + w - 6 + i, y + i, 'g2');
  p.line(x + w - 6, y, x + w - 1, y + 5, 'g4');
  p.outline();
}

icons.claude = (p) => { // a cream speech balloon with a clay-orange twinkle
  p.round(3, 5, 26, 17, 'cream');
  p.rect(7, 22, 4, 2, 'cream'); p.rect(7, 24, 2, 2, 'cream'); p.px(7, 26, 'cream');
  p.outline();
  p.hline(5, 26, 6, 'w');
  const cx = 16, cy = 13;
  p.vline(cx, cy - 6, cy + 6, 'clay'); p.hline(cx - 6, cx + 6, cy, 'clay');
  p.vline(cx - 1, cy - 3, cy + 3, 'clay'); p.vline(cx + 1, cy - 3, cy + 3, 'clay');
  p.hline(cx - 3, cx + 3, cy - 1, 'clay'); p.hline(cx - 3, cx + 3, cy + 1, 'clay');
  p.px(cx, cy, 'yellow'); p.px(cx - 1, cy - 1, 'clayD'); p.px(cx + 1, cy + 1, 'clayD');
  [[cx - 4, cy - 4], [cx + 4, cy - 4], [cx - 4, cy + 4], [cx + 4, cy + 4]].forEach(([x, y]) => p.px(x, y, 'flame'));
};

icons.chatgpt = (p) => { // beige 98-era monitor, green prompt, speech balloon
  p.rect(3, 4, 22, 18, 'beige'); p.rect(9, 22, 10, 2, 'beige2'); p.rect(6, 24, 16, 3, 'beige');
  p.outline();
  p.rect(5, 6, 18, 13, 'term');
  p.hline(7, 9, 9, 'termG'); p.px(8, 8, 'termG'); p.px(8, 10, 'termG');
  p.hline(11, 18, 9, 'termG'); p.hline(7, 15, 12, 'termG'); p.hline(7, 13, 15, 'termG'); p.rect(14, 15, 2, 1, 'w');
  p.hline(4, 23, 5, 'w'); p.px(21, 20, 'lime'); p.hline(4, 6, 20, 'beige3');
  // balloon
  p.round(20, 1, 11, 8, 'w'); p.frame(20, 1, 11, 8, 'k'); p.px(20, 1, null); p.px(30, 1, null); p.px(20, 8, null); p.px(30, 8, null);
  p.px(21, 9, 'k'); p.px(22, 9, 'k'); p.px(21, 10, 'k');
  p.text('98', 22, 3, 'bondi');
};

icons.cursor = (p) => { // code page with a caret and a big pointer
  doc(p, 4, 2, 20, 26);
  const L = [[7, 7, 'grape', 5], [13, 7, 'g4', 6], [9, 10, 'bondi', 9], [9, 13, 'tang', 4], [14, 13, 'g4', 5], [11, 16, 'lime', 7], [9, 19, 'straw', 6], [7, 22, 'grape', 3]];
  L.forEach(([x, y, c, w]) => p.hline(x, x + w - 1, y, c));
  p.vline(17, 18, 21, 'k');
  // pointer arrow
  const arrow = ['k', 'kk', 'kwk', 'kwwk', 'kwwwk', 'kwwwwk', 'kwwwwwk', 'kwwwwwwk', 'kwwwwkkkk', 'kwwkwk', 'kwk kwk', 'kk  kwk', 'k    kk'];
  arrow.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === 'k') p.px(18 + i, 16 + j, 'k'); if (ch === 'w') p.px(18 + i, 16 + j, 'w'); }));
};

icons.midjourney = (p) => { // paint palette and brush
  p.ellipse(15, 17, 13, 10, 'woodL');
  p.disc(21, 21, 2.6, null); p.outline();
  p.ellipse(14, 15, 11, 7, '#e2ae6e');
  p.disc(21, 21, 2.6, null);
  [[8, 13, 'straw'], [12, 10, 'yellow'], [17, 10, 'lime'], [22, 13, 'bondi'], [9, 18, 'grape'], [14, 20, 'tang']].forEach(([x, y, c]) => { p.disc(x + 0.5, y + 0.5, 2, 'k'); p.disc(x + 0.5, y + 0.5, 1.5, c); p.px(x - 1, y - 1, 'w'); });
  p.line(30, 1, 19, 15, 'brownD'); p.line(29, 1, 18, 15, 'brownL'); p.line(30, 2, 20, 15, 'brown');
  p.rect(16, 15, 3, 3, 'g4'); p.rect(14, 18, 3, 3, 'straw'); p.px(13, 21, 'strawD');
};

icons.elevenlabs = (p) => { // ribbon microphone with waves
  p.round(10, 2, 12, 16, 'g3'); p.rect(15, 18, 2, 6, 'g4'); p.rect(9, 24, 14, 3, 'g5');
  p.outline();
  for (let y = 4; y < 17; y += 2) p.hline(11, 20, y, 'g5');
  p.vline(11, 3, 16, 'g1');
  p.rect(13, 9, 6, 3, 'grape'); p.hline(13, 18, 9, 'grapeL');
  // sound arcs
  [[6, 6], [3, 4]].forEach(([x, h], i) => { p.vline(x, 10 - h + 2, 10 + h - 2, i ? 'bondiL' : 'bondi'); p.px(x + 1, 10 - h + 1, i ? 'bondiL' : 'bondi'); p.px(x + 1, 10 + h - 1, i ? 'bondiL' : 'bondi'); });
  [[25, 6], [28, 4]].forEach(([x, h], i) => { p.vline(x, 10 - h + 2, 10 + h - 2, i ? 'bondiL' : 'bondi'); p.px(x - 1, 10 - h + 1, i ? 'bondiL' : 'bondi'); p.px(x - 1, 10 + h - 1, i ? 'bondiL' : 'bondi'); });
};

icons.perplexity = (p) => { // encyclopedia + magnifier
  p.rect(3, 14, 18, 14, 'grape'); p.rect(3, 26, 18, 2, 'w'); p.outline();
  p.hline(5, 18, 17, 'yellow'); p.hline(5, 14, 20, 'grapeL'); p.vline(4, 14, 25, 'grapeL');
  p.disc(19, 11, 8.5, 'k'); p.disc(19, 11, 7, 'bondi'); p.disc(19, 11, 5.5, 'aqua');
  p.px(16, 8, 'w'); p.px(17, 7, 'w'); p.px(15, 9, 'w');
  p.line(25, 17, 30, 22, 'brownD'); p.line(25, 18, 29, 22, 'brownD'); p.line(26, 17, 30, 21, 'brown'); p.line(24, 17, 25, 18, 'k');
};

icons.higgsfield = (p) => { // clapperboard
  p.rect(4, 13, 24, 15, 'g5'); p.outline();
  p.rect(5, 14, 22, 2, 'g4');
  p.hline(6, 25, 18, 'w'); p.hline(6, 18, 21, 'g3'); p.hline(6, 21, 24, 'g3');
  // tilted clapper
  for (let i = 0; i < 24; i++) { const y = 11 - Math.round(i * 0.35); for (let t = 0; t < 4; t++) p.px(4 + i, y + t, ((i + t) >> 2) % 2 ? 'k' : 'w'); }
  p.line(4, 11, 27, 3, 'k'); p.line(4, 15, 27, 7, 'k');
  p.px(23, 24, 'tang'); p.px(24, 23, 'tang'); p.px(25, 24, 'tang'); p.px(24, 25, 'tang'); p.px(24, 24, 'yellow');
};

icons.granola = (p) => { // a bowl of granola with a spoon
  p.line(22, 2, 17, 13, 'g3'); p.line(23, 2, 18, 13, 'g4'); p.rect(21, 1, 4, 3, 'g3');
  p.ellipse(16, 14, 13, 4, 'brownL');
  p.fn((x, y) => (y >= 14 && ((x + 0.5 - 16) / 13) ** 2 + ((y + 0.5 - 14) / 13) ** 2 <= 1 ? 'straw' : null));
  p.rect(12, 26, 8, 3, 'strawD');
  p.outline();
  [[6, 13], [9, 12], [12, 14], [15, 12], [18, 13], [22, 12], [25, 14], [11, 11], [20, 15], [8, 15]].forEach(([x, y], i) => { p.px(x, y, i % 2 ? 'brownD' : 'brown'); p.px(x + 1, y, 'brownL'); p.px(x, y - 1, i % 3 ? 'cream' : 'yellow'); });
  p.hline(6, 26, 19, '#ff8fa9'); p.hline(8, 24, 22, 'strawD');
};

icons.notion = (p) => { // spiral planner with checkboxes
  p.rect(6, 3, 22, 26, 'w'); p.outline();
  for (let y = 5; y < 28; y += 4) { p.rect(3, y, 5, 2, 'g4'); p.px(3, y, 'k'); }
  [7, 13, 19].forEach((y, i) => {
    p.frame(10, y, 4, 4, 'k');
    if (i < 2) { p.px(11, y + 1, 'lime'); p.px(12, y + 2, 'limeD'); p.px(13, y, 'limeD'); p.px(14, y - 1, 'limeD'); }
    p.hline(16, 25, y + 1, i < 2 ? 'g3' : 'g5'); p.hline(16, 22, y + 3, i < 2 ? 'g3' : 'g4');
  });
  p.hline(10, 24, 25, 'g2');
  p.rect(25, 3, 3, 6, 'straw');
};

icons.figma = (p) => { // vector pen nib with a bezier and handles
  p.fn((x, y) => { const cx = 16; const t = (y - 4) / 18; if (y < 4 || y > 22) return null; const half = Math.round(1 + t * 7); return Math.abs(x - cx) <= half ? 'g2' : null; });
  p.rect(10, 22, 13, 5, 'g4');
  p.outline();
  p.vline(16, 6, 17, 'k'); p.disc(16.5, 17.5, 1.6, 'k'); p.px(16, 17, 'w');
  p.vline(13, 9, 20, 'w');
  p.rect(10, 22, 13, 1, 'g3');
  // curve + handles
  p.line(1, 28, 6, 22, 'straw'); p.line(6, 22, 10, 21, 'straw');
  p.line(22, 30, 27, 26, 'grape'); p.line(27, 26, 30, 20, 'grape');
  p.rect(0, 27, 3, 3, 'k'); p.px(1, 28, 'w'); p.rect(29, 18, 3, 3, 'k'); p.px(30, 19, 'w');
};

icons.wispr = (p) => { // Wispr Flow: a 1984-style rainbow badge with a waveform
  const stripes = ['lime', 'yellow', 'tang', 'straw', 'grape', 'bondi'];
  p.round(2, 2, 28, 28, 'w');
  for (let i = 0; i < 6; i++) p.rect(2, 3 + i * 4 + (i ? 0 : -1), 28, i ? 4 : 5, stripes[i]);
  p.rect(2, 27, 28, 2, 'bondi');
  p.px(2, 2, null); p.px(29, 2, null); p.px(2, 29, null); p.px(29, 29, null);
  p.outline();
  const H = [2, 4, 7, 10, 6, 12, 8, 5, 9, 3, 6, 2];
  H.forEach((h, i) => { const x = 5 + i * 2; p.rect(x, 16 - h, 1, h * 2, 'w'); p.px(x + 1, 16 - h + 1, 'k'); p.vline(x + 1, 16 - h + 1, 16 + h - 1, 'k'); });
};

icons.flowother = (p) => { // "Flow (no, the other one)" — the grey knock-off
  p.round(2, 4, 26, 26, 'g3'); p.outline();
  p.hline(3, 26, 5, 'g1'); p.vline(3, 5, 28, 'g1'); p.hline(3, 27, 29, 'g5');
  [3, 5, 8, 4, 9, 6, 3, 5, 7, 2].forEach((h, i) => p.rect(6 + i * 2, 17 - h, 1, h * 2, 'g5'));
  p.disc(25, 6, 5.5, 'k'); p.disc(25, 6, 4.5, 'tang'); p.text('?', 24, 4, 'k');
};

icons.readme = (p) => {
  doc(p, 6, 2, 20, 27);
  for (let y = 9; y < 26; y += 3) p.hline(9, y === 24 ? 17 : 22, y, 'g4');
  p.text('R', 9, 4, 'k'); p.hline(13, 18, 6, 'g3');
  p.round(19, 20, 5, 7, 'bondi'); p.vline(21, 27, 28, 'k'); p.hline(19, 23, 29, 'k');
};

icons.resume = (p) => {
  doc(p, 6, 2, 20, 27);
  p.rect(7, 3, 13, 5, 'bondi'); p.text('CV', 9, 3, 'w');
  for (let y = 11; y < 26; y += 3) { p.hline(9, 22, y, 'g3'); p.hline(9 + (y % 5), 14 + (y % 4), y, 'g4'); }
  p.vline(23, 1, 9, 'g4'); p.vline(25, 1, 9, 'g4'); p.hline(23, 25, 0, 'g4'); p.hline(23, 25, 10, 'g4'); p.vline(24, 3, 8, 'g5');
};

icons.trash = (p) => { // Platinum trash can with shredded strips poking out
  for (let i = 0; i < 5; i++) { const x = 9 + i * 3; p.rect(x, 1 + (i % 2) * 2, 2, 8, 'w'); p.rect(x, 1 + (i % 2) * 2, 2, 2, i % 2 ? 'ember' : 'g5'); }
  p.rect(5, 8, 22, 3, 'g3'); p.rect(13, 6, 6, 2, 'g4');
  p.fn((x, y) => (y >= 11 && y <= 29 && x >= 7 + Math.floor((y - 11) / 9) && x <= 24 - Math.floor((y - 11) / 9) ? 'g2' : null));
  p.outline();
  for (let x = 10; x <= 21; x += 3) p.vline(x, 13, 27, 'g4');
  p.vline(8, 12, 28, 'w'); p.hline(6, 25, 9, 'w');
};

icons.offthecv = (p) => { // the burned CD-R
  const cx = 16, cy = 16;
  const band = ['bondiL', 'aqua', 'lime', 'yellow', 'flame', 'straw', 'grapeL', 'bondi'];
  p.fn((x, y) => {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
    if (d > 14) return null;
    if (d < 2.4) return null;
    if (d < 5) return 'g2';
    const a = (Math.atan2(dy, dx) / Math.PI + 1) * 4 + d * 0.12;
    return band[Math.floor(a) % band.length];
  });
  p.outline();
  p.disc(16, 16, 5, 'g1'); p.disc(16, 16, 2.4, null);
  p.fn((x, y) => (Math.hypot(x + 0.5 - 16, y + 0.5 - 16) < 2.4 && Math.hypot(x + 0.5 - 16, y + 0.5 - 16) > 1.4 ? 'k' : null));
  p.line(8, 7, 11, 5, 'w'); p.px(7, 8, 'w');
  p.hline(18, 27, 22, 'k'); p.hline(19, 25, 24, 'k');
};

icons.dialup = (p) => { // modem with handset
  p.round(2, 16, 28, 11, 'beige'); p.outline();
  p.hline(3, 28, 17, 'w'); p.hline(3, 28, 25, 'beige2');
  ['lime', 'lime', 'tang', 'straw', 'lime'].forEach((c, i) => p.rect(6 + i * 4, 21, 2, 2, c));
  // handset
  p.rect(6, 7, 20, 4, 'g5'); p.rect(4, 9, 6, 6, 'g5'); p.rect(22, 9, 6, 6, 'g5');
  p.hline(7, 24, 7, 'g4');
  p.outline();
  p.line(14, 3, 18, 3, 'bondi'); p.line(12, 1, 20, 1, 'bondiL');
};

icons.wallpap = (p) => { // framed pond with a koi
  p.rect(2, 4, 28, 24, 'wood'); p.outline();
  p.hline(3, 28, 5, 'woodL'); p.vline(3, 5, 26, 'woodL');
  p.rect(5, 7, 22, 18, 'water');
  p.hline(7, 12, 10, 'waterL'); p.hline(18, 24, 21, 'waterL'); p.hline(8, 11, 22, 'waterL');
  p.ellipse(15, 15, 5, 2.4, 'tang'); p.px(10, 14, 'tang'); p.px(9, 13, 'tang'); p.px(9, 16, 'tang'); p.px(8, 17, 'tang');
  p.rect(14, 14, 3, 2, 'w'); p.px(18, 14, 'k');
  p.disc(23, 10, 2.5, 'lime'); p.px(23, 10, 'limeD');
};

icons.hd = (p) => {
  p.rect(2, 11, 28, 12, 'g3'); p.outline();
  p.hline(3, 28, 12, 'g1'); p.hline(3, 28, 21, 'g4'); p.vline(3, 12, 21, 'g1');
  p.rect(5, 18, 3, 1, 'lime'); p.rect(20, 15, 7, 1, 'g4'); p.rect(20, 17, 7, 1, 'g4');
};

icons.switchboard = (p) => { // telephone switchboard patch panel
  p.rect(3, 4, 26, 22, 'brownD'); p.outline();
  p.rect(5, 6, 22, 18, 'g5');
  for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) { p.rect(7 + x * 4, 8 + y * 4, 2, 2, 'k'); p.px(7 + x * 4, 8 + y * 4, 'g4'); }
  p.line(8, 9, 12, 20, 'straw'); p.line(12, 20, 19, 13, 'straw');
  p.line(16, 9, 20, 16, 'lime'); p.line(20, 16, 24, 21, 'lime');
  p.line(24, 9, 22, 13, 'yellow'); p.line(22, 13, 8, 17, 'yellow');
  p.rect(6, 27, 20, 3, 'brown'); p.outline();
};

icons.folder = (p) => { // Mac OS 8 folder
  p.rect(3, 6, 11, 4, 'folder'); p.rect(3, 9, 26, 19, 'folder'); p.outline();
  p.hline(4, 12, 7, 'folderL'); p.hline(4, 27, 10, 'folderL'); p.vline(4, 10, 26, 'folderL');
  p.hline(4, 28, 27, 'folderD'); p.vline(28, 10, 27, 'folderD');
};

// alert glyphs
icons.stop = (p) => {
  p.fn((x, y) => { const dx = Math.abs(x + 0.5 - 16), dy = Math.abs(y + 0.5 - 16); return dx < 13 && dy < 13 && dx + dy < 18 ? 'straw' : null; });
  p.outline();
  p.rect(14, 8, 4, 11, 'w'); p.rect(14, 21, 4, 3, 'w');
};
icons.note = (p) => { // a little talking CRT face
  p.round(4, 4, 24, 20, 'beige'); p.rect(11, 24, 10, 3, 'beige2'); p.outline();
  p.rect(7, 7, 18, 13, 'bondi'); p.rect(11, 10, 2, 3, 'w'); p.rect(19, 10, 2, 3, 'w');
  p.hline(12, 19, 16, 'w'); p.px(11, 15, 'w'); p.px(20, 15, 'w');
};

mkdirSync('img/ui', { recursive: true });
for (const [name, draw] of Object.entries(icons)) {
  const p = canvas(); draw(p);
  writeFileSync(`img/ui/${name}.svg`, toSVG(p.b, 64));
}
// favicon = the CD
{ const p = canvas(); icons.offthecv(p); writeFileSync('img/ui/favicon.svg', toSVG(p.b, 32)); }
console.log('icons:', Object.keys(icons).length);
