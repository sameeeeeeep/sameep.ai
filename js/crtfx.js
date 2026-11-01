// crtfx.js — the CRT look after boot, and the switches for it. The 1998 iMac had a
// 15" shadow-mask tube, so by default the desktop and podcast keep the boot's
// weight: the glass shader at full strength (js/app/crt.js) plus a hint of RGB
// convergence fringe on text (css/crt.css). The "CRT" button in the menu bar
// (Special › CRT effect on phones) turns it off; remembered.
// Special › Curved glass (desktop only, off by default) bends the whole live page
// like convex glass without cropping anything: an SVG displacement map built for the
// screen's size. It roughly halves the frame rate, so it's opt-in.
const KEY = 'otcv-crt', CURVE_KEY = 'otcv-curve';
const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode: this visit only */ } };

let on = get(KEY) !== 'off';
let curve = get(CURVE_KEY) === 'on';
let btn = null, item = null, curveItem = null;
const desk = matchMedia('(min-width: 900px) and (pointer: fine)');

function apply() {
  document.documentElement.classList.toggle('crt-full', on);
  document.documentElement.classList.toggle('crt-plain', !on);
  window.__otcvCrt?.setStrength(on ? 1 : -1);
  bend();
  if (item) item.textContent = on ? 'CRT effect: on' : 'CRT effect: off';
  if (curveItem) { curveItem.textContent = curve ? 'Curved glass: on' : 'Curved glass: off (slower)'; curveItem.parentElement.hidden = !desk.matches; }
  if (btn) { btn.setAttribute('aria-pressed', String(on)); btn.classList.toggle('is-off', !on); btn.title = on ? 'CRT effect on (click to turn off)' : 'CRT effect off (click to turn on)'; }
}

// ---- curved glass: the barrel map
let bentFor = '';
function bend() {
  const scr = document.querySelector('.crt__screen');
  const want = !!(on && curve && desk.matches && scr);
  document.documentElement.classList.toggle('crt-curve', want);
  if (!want) return;
  const { width: W, height: H } = scr.getBoundingClientRect();
  const key = `${W | 0}x${H | 0}`;
  if (!W || !H || bentFor === key) return;
  bentFor = key;
  // for each output pixel, where to sample from. A bulge that pins the frame: every edge maps
  // to itself (nothing is cropped), the middle swells, and lines bow more toward the centre
  // than near the corners, so the page looks like it sits behind convex glass.
  const k = 0.12, a = 0.6, mw = 256, mh = Math.max(2, Math.round(256 * H / W));
  const off = new Float32Array(mw * mh * 2); let max = 0;
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    const cx = (x + 0.5) / mw * 2 - 1, cy = (y + 0.5) / mh * 2 - 1;
    const sx = cx * (1 - k * (1 - cx * cx) * (1 - a * cy * cy)), sy = cy * (1 - k * (1 - cy * cy) * (1 - a * cx * cx));
    const i = (y * mw + x) * 2, ox = (sx - cx) * W / 2, oy = (sy - cy) * H / 2;
    off[i] = ox; off[i + 1] = oy; max = Math.max(max, Math.abs(ox), Math.abs(oy));
  }
  const scale = 2 * max + 1;
  const cv = document.createElement('canvas'); cv.width = mw; cv.height = mh;
  const g = cv.getContext('2d'), img = g.createImageData(mw, mh);
  for (let i = 0; i < mw * mh; i++) {
    img.data[i * 4] = Math.round((0.5 + off[i * 2] / scale) * 255);
    img.data[i * 4 + 1] = Math.round((0.5 + off[i * 2 + 1] / scale) * 255);
    img.data[i * 4 + 2] = 128; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  let svg = document.getElementById('crt-curve-svg');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'crt-curve-svg'; svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
    svg.innerHTML = '<filter id="crt-curve" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feImage result="map" preserveAspectRatio="none"/><feDisplacementMap in="SourceGraphic" in2="map" xChannelSelector="R" yChannelSelector="G"/></filter>';
    document.body.append(svg);
  }
  const fe = svg.querySelector('feImage');
  fe.setAttribute('href', cv.toDataURL()); fe.setAttribute('x', 0); fe.setAttribute('y', 0); fe.setAttribute('width', W); fe.setAttribute('height', H);
  svg.querySelector('feDisplacementMap').setAttribute('scale', scale.toFixed(2));
}
let ro = null;
function watchScreen() {
  const scr = document.querySelector('.crt__screen');
  if (!scr || ro) return;
  ro = new ResizeObserver(() => bend()); ro.observe(scr);
  desk.addEventListener?.('change', () => { bentFor = ''; apply(); });
}

function mount() {
  const right = document.querySelector('.menubar__right');
  if (!right || right.querySelector('.menubar__crt')) return;
  btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'menubar__crt';
  btn.textContent = 'CRT';
  btn.setAttribute('aria-label', 'CRT effect');
  btn.onclick = () => { on = !on; set(KEY, on ? 'on' : 'off'); apply(); };
  right.insertBefore(btn, right.querySelector('.menubar__sound') || null);
  // and in Special, which is reachable on phones where the bar's right side is cut off
  const special = [...document.querySelectorAll('.menu')].find((m) => /Special/.test(m.querySelector('.menu__btn')?.textContent || ''));
  const list = special?.querySelector('.menu__list');
  if (list) {
    const close = () => { special.classList.remove('is-open'); special.querySelector('.menu__btn').setAttribute('aria-expanded', 'false'); };
    const add = (fn) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'menu__item'; b.setAttribute('role', 'menuitem');
      b.onclick = () => { fn(); apply(); close(); };
      const li = document.createElement('li'); li.setAttribute('role', 'none'); li.append(b);
      return { b, li };
    };
    const a = add(() => { on = !on; set(KEY, on ? 'on' : 'off'); });
    const c = add(() => { curve = !curve; set(CURVE_KEY, curve ? 'on' : 'off'); if (curve && !on) { on = true; set(KEY, 'on'); } });
    item = a.b; curveItem = c.b;
    list.prepend(a.li, c.li);
  }
  apply();
}

apply();
// the menu bar and the CRT appear after boot: watch for them once, then let go
const mo = new MutationObserver(() => { if (window.__otcvCrt && !apply.crt) { apply.crt = true; apply(); } mount(); watchScreen(); if (btn && ro) mo.disconnect(); });
mo.observe(document.documentElement, { childList: true, subtree: true });
