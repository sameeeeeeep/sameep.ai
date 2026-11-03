// crtfx.js — the CRT look after boot, and the switch for it. Three modes:
//   Curved: the flat look plus the whole live page bent like convex tube glass. It fills
//           the screen and crops nothing (every edge maps onto itself, the middle swells).
//   Flat:   the glass shader (js/app/crt.js: scanlines, triads, glow, vignette) plus a hint
//           of RGB convergence fringe on text (css/crt.css). The default.
//   Off:    clean pixels, no CRT at all.
// The "CRT" button in the menu bar cycles Curved → Flat → Off (Special › Display on phones,
// where the bar's right side is cut off); remembered.
//
// How Curved stays clickable: the bend is a visual SVG displacement filter on .crt__screen,
// so the DOM underneath doesn't move. A transparent "hit glass" (.crt-hit) over the screen
// takes the pointer, works out which page point is *drawn* under it (the same barrel the
// filter samples, see src()) and replays the event there: pointer + mouse events, click,
// dblclick, context menu, wheel scrolling, focus, hover enter/leave and pointer capture
// (drags). CSS :hover can't be replayed, so hovers show through cursor changes only;
// iframes get the real pointer (a few px off mid-screen) since they can't be reached.
// Curved is desktop-only (fine pointer, ≥900px) and opt-in: the filter costs frames.

const KEY = 'otcv-crt-mode';
const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode: this visit only */ } };
const MODES = ['curved', 'flat', 'off'];
const LABEL = { curved: 'Curved', flat: 'Flat', off: 'Off' };
const desk = matchMedia('(min-width: 900px) and (pointer: fine)');

// the old on/off + curved switches carry over
function saved() {
  const m = get(KEY);
  if (MODES.includes(m)) return m;
  if (get('otcv-crt') === 'off') return 'off';
  if (get('otcv-curve') === 'on') return 'curved';
  return null;
}
// Flat by default, everywhere: it's the iMac look at no cost to sharpness or clicks. Curved
// softens text a touch and costs frames, so it's there for whoever wants the full tube.
// Low-power devices get Flat too, the shader just ticks slower there (js/app/crt.js).
let mode = saved() || 'flat';
let btn = null, item = null;

const can = (m) => m !== 'curved';   // Curved is off for now: the switch is Flat / Off, a saved Curved shows as Flat
const shown = () => (can(mode) ? mode : 'flat'); // a saved Curved shows as Flat on a phone
function next() {
  let i = MODES.indexOf(shown());
  do i = (i + 1) % MODES.length; while (!can(MODES[i]));
  return MODES[i];
}

function apply() {
  const m = shown();
  const root = document.documentElement;
  root.classList.toggle('crt-full', m !== 'off');
  root.classList.toggle('crt-plain', m === 'off');
  window.__otcvCrt?.setStrength(m === 'off' ? -1 : 1);
  window.__otcvCrt?.setBend?.(m === 'curved' ? K : 0);
  bend(m === 'curved');
  hit.toggle(m === 'curved');
  const n = next();
  if (item) item.textContent = `Display: ${LABEL[m]} CRT (switch to ${LABEL[n]})`;
  if (btn) {
    btn.textContent = `CRT: ${LABEL[m]}`;
    btn.dataset.mode = m;
    btn.title = `CRT ${LABEL[m].toLowerCase()}. Click for ${LABEL[n].toLowerCase()}.`;
  }
}
function cycle() { mode = next(); set(KEY, mode); apply(); }

// ---- curved glass: the barrel map
// For each output point, where on the page it samples from. A bulge that pins the frame:
// every edge maps onto itself (nothing is cropped), the middle swells, and lines bow more
// toward the centre than near the corners, so the page looks like it sits behind convex glass.
const K = 0.1, A = 0.6;
const warp = (cx, cy) => [cx * (1 - K * (1 - cx * cx) * (1 - A * cy * cy)), cy * (1 - K * (1 - cy * cy) * (1 - A * cx * cx))];
const screenEl = () => document.querySelector('.crt__screen');
// client point you see → client point of the page drawn there
function src(x, y) {
  const r = screenEl()?.getBoundingClientRect();
  if (!r || !r.width) return [x, y];
  const cx = (x - r.left) / r.width * 2 - 1, cy = (y - r.top) / r.height * 2 - 1;
  if (Math.abs(cx) > 1 || Math.abs(cy) > 1) return [x, y];
  const [sx, sy] = warp(cx, cy);
  return [r.left + (sx + 1) / 2 * r.width, r.top + (sy + 1) / 2 * r.height];
}

let bentFor = '';
function bend(want) {
  const scr = screenEl();
  want = !!(want && scr);
  document.documentElement.classList.toggle('crt-curve', want);
  if (!want) return;
  const { width: W, height: H } = scr.getBoundingClientRect();
  const key = `${W | 0}x${H | 0}`;
  if (!W || !H || bentFor === key) return;
  bentFor = key;
  const mw = 256, mh = Math.max(2, Math.round(256 * H / W));
  const off = new Float32Array(mw * mh * 2); let max = 0;
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    const cx = (x + 0.5) / mw * 2 - 1, cy = (y + 0.5) / mh * 2 - 1;
    const [sx, sy] = warp(cx, cy);
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

// ---- the hit glass: replays the pointer where the page is drawn
const hit = (() => {
  let el = null, on = false, hover = null, down = null, cap = null, through = null;
  const under = (x, y) => document.elementsFromPoint(x, y).find((n) => n !== el) || null;
  const common = (a, b) => { if (!a || !b) return a || b; let n = a; while (n && !n.contains(b)) n = n.parentElement; return n; };
  const send = (t, type, e, [x, y], extra = {}) => {
    if (!t) return true;
    const Ctor = type.startsWith('pointer') || type.endsWith('pointercapture') ? PointerEvent : type === 'wheel' ? WheelEvent : MouseEvent;
    const bubbles = !/^(pointer|mouse)(enter|leave)$/.test(type);
    return t.dispatchEvent(new Ctor(type, {
      bubbles, cancelable: bubbles, composed: true, view: window,
      clientX: x, clientY: y, screenX: e.screenX + x - e.clientX, screenY: e.screenY + y - e.clientY,
      button: e.button, buttons: e.buttons, detail: e.detail,
      ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey, metaKey: e.metaKey,
      pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: e.isPrimary, pressure: e.pressure, width: e.width, height: e.height,
      deltaX: e.deltaX, deltaY: e.deltaY, deltaZ: e.deltaZ, deltaMode: e.deltaMode, ...extra,
    }));
  };
  const chain = (n) => { const a = []; for (; n; n = n.parentElement) a.push(n); return a; };
  function hoverTo(t, e, p) {
    if (t === hover) return;
    const was = hover; hover = t;
    send(was, 'pointerout', e, p, { relatedTarget: t }); send(was, 'mouseout', e, p, { relatedTarget: t });
    const keep = new Set(chain(t));
    for (const n of chain(was)) if (!keep.has(n)) { send(n, 'pointerleave', e, p, { relatedTarget: t }); send(n, 'mouseleave', e, p, { relatedTarget: t }); }
    send(t, 'pointerover', e, p, { relatedTarget: was }); send(t, 'mouseover', e, p, { relatedTarget: was });
    const old = new Set(chain(was));
    for (const n of chain(t).reverse()) if (!old.has(n)) { send(n, 'pointerenter', e, p, { relatedTarget: was }); send(n, 'mouseenter', e, p, { relatedTarget: was }); }
    if (el) el.style.cursor = t ? getComputedStyle(t).cursor : '';
  }
  // the hit glass lets go while the pointer is over an iframe (it can't be reached from here)
  function passThrough(f) { through = f; if (el) el.style.pointerEvents = f ? 'none' : ''; }
  addEventListener('pointermove', (e) => { if (through && e.target !== through) passThrough(null); }, true);

  // drags: a page element taking capture really captures to the glass, and the glass keeps
  // sending that element the moves until it lets go
  const P = Element.prototype, real = { set: P.setPointerCapture, rel: P.releasePointerCapture, has: P.hasPointerCapture };
  P.setPointerCapture = function (id) {
    if (!on || this === el) return real.set.call(this, id);
    cap = this; try { real.set.call(el, id); } catch { /* pointer already up */ }
    send(cap, 'gotpointercapture', { pointerId: id, screenX: 0, screenY: 0, clientX: 0, clientY: 0 }, [0, 0]);
  };
  P.releasePointerCapture = function (id) {
    if (cap !== this) return real.rel.call(this, id);
    const was = cap; cap = null; try { real.rel.call(el, id); } catch { /* noop */ }
    send(was, 'lostpointercapture', { pointerId: id, screenX: 0, screenY: 0, clientX: 0, clientY: 0 }, [0, 0]);
  };
  P.hasPointerCapture = function (id) { return cap === this || real.has.call(this, id); };

  function scrollFrom(t, dx, dy) {
    for (let n = t; n && n !== document.documentElement; n = n.parentElement) {
      const s = getComputedStyle(n);
      const y = dy && /(auto|scroll)/.test(s.overflowY) && (dy > 0 ? n.scrollTop + n.clientHeight < n.scrollHeight - 1 : n.scrollTop > 0);
      const x = dx && /(auto|scroll)/.test(s.overflowX) && (dx > 0 ? n.scrollLeft + n.clientWidth < n.scrollWidth - 1 : n.scrollLeft > 0);
      if (x || y) { n.scrollBy({ left: x ? dx : 0, top: y ? dy : 0 }); return; }
    }
  }
  const focusable = 'input, textarea, select, button, a[href], [tabindex], [contenteditable]';

  function make() {
    const tube = document.querySelector('.crt__tube');
    if (!tube || el) return !!el;
    el = document.createElement('div');
    el.className = 'crt-hit';
    el.setAttribute('aria-hidden', 'true');
    tube.append(el);
    const at = (e) => src(e.clientX, e.clientY);
    el.addEventListener('pointermove', (e) => {
      const p = at(e), t = cap || under(...p);
      if (!cap && !e.buttons && t?.tagName === 'IFRAME') { hoverTo(t, e, p); passThrough(t); return; }
      hoverTo(t, e, p);
      if (send(cap || t, 'pointermove', e, p)) send(cap || t, 'mousemove', e, p);
    });
    el.addEventListener('pointerleave', (e) => { if (!cap && !through) hoverTo(null, e, at(e)); });
    el.addEventListener('pointerdown', (e) => {
      const p = at(e), t = under(...p);
      down = t;
      hoverTo(t, e, p);
      if (!send(t, 'pointerdown', e, p) || !send(t, 'mousedown', e, p)) return;
      const f = t?.closest?.(focusable);
      if (f) f.focus({ preventScroll: true });
      else if (screenEl()?.contains(document.activeElement)) document.activeElement.blur?.();
    });
    const up = (type) => (e) => {
      const p = at(e), t = cap || under(...p);
      send(t, type, e, p);
      if (type === 'pointerup') send(t, 'mouseup', e, p);
      if (cap) P.releasePointerCapture.call(cap, e.pointerId);
    };
    el.addEventListener('pointerup', up('pointerup'));
    el.addEventListener('pointercancel', up('pointercancel'));
    for (const type of ['click', 'auxclick', 'dblclick', 'contextmenu']) {
      el.addEventListener(type, (e) => {
        const p = at(e), t = common(down, under(...p));
        if (!send(t, type, e, p)) e.preventDefault();
        else if (type === 'click' && t?.tagName === 'SELECT') try { t.showPicker(); } catch { /* not supported */ }
      });
    }
    el.addEventListener('wheel', (e) => {
      const p = at(e), t = under(...p);
      if (!send(t, 'wheel', e, p)) return;
      const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
      scrollFrom(t, e.deltaX * k, e.deltaY * k);
    }, { passive: true });
    // the glass's own events stop here: the page only hears the replayed ones (a window-level
    // drag listener would otherwise get every move twice, once at the unbent point), and its
    // mousedown mustn't take focus away from what the replayed one just focused
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerover', 'pointerout', 'pointerenter', 'pointerleave',
      'mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout', 'click', 'auxclick', 'dblclick', 'contextmenu', 'wheel']) {
      el.addEventListener(type, (e) => { e.stopPropagation(); if (type === 'mousedown') e.preventDefault(); }, { passive: type !== 'mousedown' });
    }
    return true;
  }
  return {
    make,
    toggle(want) {
      on = want && make();
      if (el) el.hidden = !on;
      if (!on) { cap = null; down = null; passThrough(null); }
    },
  };
})();

let ro = null;
function watchScreen() {
  const scr = screenEl();
  if (!scr || ro) return;
  ro = new ResizeObserver(() => { bentFor = ''; apply(); }); ro.observe(scr);
  desk.addEventListener?.('change', () => { bentFor = ''; apply(); });
}

function mount() {
  const right = document.querySelector('.menubar__right');
  if (!right || right.querySelector('.menubar__crt')) return;
  btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'menubar__crt';
  btn.setAttribute('aria-label', 'CRT display mode');
  btn.onclick = cycle;
  right.insertBefore(btn, right.querySelector('.menubar__sound') || null);
  // and in Special, which is reachable on phones where the bar's right side is cut off
  const special = [...document.querySelectorAll('.menu')].find((m) => /Special/.test(m.querySelector('.menu__btn')?.textContent || ''));
  const list = special?.querySelector('.menu__list');
  if (list) {
    const close = () => { special.classList.remove('is-open'); special.querySelector('.menu__btn').setAttribute('aria-expanded', 'false'); };
    item = document.createElement('button');
    item.type = 'button'; item.className = 'menu__item'; item.setAttribute('role', 'menuitem');
    item.onclick = () => { cycle(); close(); };
    const li = document.createElement('li'); li.setAttribute('role', 'none'); li.append(item);
    list.prepend(li);
  }
  apply();
}

apply();
// the menu bar and the CRT appear after boot: watch for them once, then let go
const mo = new MutationObserver(() => { if (window.__otcvCrt && !apply.crt) { apply.crt = true; apply(); } mount(); watchScreen(); if (btn && ro) mo.disconnect(); });
mo.observe(document.documentElement, { childList: true, subtree: true });
