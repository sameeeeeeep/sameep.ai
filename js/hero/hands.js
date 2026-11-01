// hands.js — hands-on hero (high power). At a few resting poses the thing on
// screen can be grabbed: fold the sheet by dragging a corner, drag the CV down
// into the shredder, swipe the match along the box, drag the flame to the
// paper, push the CD into the iMac's slot. A drag scrubs the page between that
// pose and the next, so scroll and hands drive one timeline and stay in sync;
// let go past a third of the way and it glides on, short of that it settles back.
// At the finished plane a tiny picker offers three folds (also by voice).
const V = (x, y) => ({ x, y });

export function makeHands({ stage, camera, THREE, grooves, isBusy, glide, world, onStyle, style, reduced }) {
  // from pose → to pose, what to grab, which way to drag
  const ACTS = [
    { from: 3, to: 4, grab: 'paper', dir: 'any', reach: 0.26, hint: 'Drag a corner to fold it' },
    { from: 6, to: 7, grab: 'paper', dir: V(0, 1), reach: 0.3, hint: 'Drag it down into the shredder' },
    { from: 7, to: 8, grab: 'box', dir: 'x', reach: 0.24, hint: 'Swipe the match along the box' },
    { from: 8, to: 9, grab: 'match', toward: 'strips', reach: 0.2, hint: 'Drag the flame to the paper' },
    { from: 11, to: 12, grab: 'cd', toward: 'slot', reach: 0.22, hint: 'Drag the CD into the slot' },
  ];
  const v3 = new THREE.Vector3();
  const screenOf = (name) => {
    const p = world[name]?.();
    if (!p) return null;
    v3.copy(p).project(camera);
    if (v3.z > 1) return null;
    const r = stage.getBoundingClientRect();
    return V(r.left + (v3.x * 0.5 + 0.5) * r.width, r.top + (-v3.y * 0.5 + 0.5) * r.height);
  };
  const unit = () => Math.min(innerWidth, innerHeight);
  const at = () => {
    const g = grooves(), y = scrollY;
    let i = 0;
    for (let k = 1; k < g.length; k++) if (Math.abs(g[k] - y) < Math.abs(g[i] - y)) i = k;
    return Math.abs(g[i] - y) < 6 && !isBusy() ? i : -1;
  };

  // ---- the hint (a soft ring on the thing you can grab) and the fold picker
  const hint = document.createElement('div');
  hint.className = 'hands-hint';
  hint.innerHTML = '<i aria-hidden="true"></i><span></span>';
  const pick = document.createElement('div');
  pick.className = 'fold-pick';
  pick.setAttribute('role', 'radiogroup');
  pick.setAttribute('aria-label', 'Pick a fold');
  pick.innerHTML = '<span class="fold-pick__k">Pick a fold</span>'
    + [['dart', 'Dart'], ['glider', 'Glider'], ['stunt', 'Stunt']].map(([k, t]) => `<button type="button" role="radio" data-k="${k}">${t}</button>`).join('');
  pick.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) onStyle(b.dataset.k); });
  stage.append(hint, pick);
  const syncPick = () => pick.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.k === style())));

  let drag = null, used = new Set(), raf = 0, endedAt = 0;
  function tick() {
    raf = requestAnimationFrame(tick);
    const i = drag ? -1 : at();
    pick.classList.toggle('is-on', i === 4);
    if (i === 4) syncPick();
    const a = ACTS.find((x) => x.from === i);
    const s = a && screenOf(a.grab);
    if (!s || used.has(a.from)) { hint.classList.remove('is-on'); return; }
    const r = stage.getBoundingClientRect();
    hint.style.transform = `translate(${s.x - r.left}px, ${s.y - r.top}px)`;
    hint.querySelector('span').textContent = a.hint;
    hint.classList.add('is-on');
  }
  raf = requestAnimationFrame(tick);

  function down(e) {
    if (e.button > 0 || e.target.closest('button, a, .hero-pill, .vpill, .coach')) return;
    const i = at();
    const a = ACTS.find((x) => x.from === i);
    if (!a) return;
    const s = screenOf(a.grab);
    if (!s || Math.hypot(e.clientX - s.x, e.clientY - s.y) > a.reach * unit()) return;
    let dir = a.dir, len = 0.28 * unit();
    if (a.toward) {
      const t = screenOf(a.toward);
      if (!t) return;
      dir = V(t.x - s.x, t.y - s.y);
      const d = Math.max(1, Math.hypot(dir.x, dir.y));
      dir = V(dir.x / d, dir.y / d);
      len = Math.max(60, Math.min(d, 0.32 * unit())); // the target can sit far off-screen at close framings
    }
    const g = grooves();
    drag = { a, x0: e.clientX, y0: e.clientY, dir, len, from: g[a.from], to: g[a.to], k: 0, id: e.pointerId };
    hint.classList.remove('is-on');
    stage.classList.add('is-grabbing');
    try { e.target.setPointerCapture?.(e.pointerId); } catch { /* fine */ }
    e.preventDefault();
    e.stopPropagation();
  }
  function move(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    const d = drag.dir;
    const along = d === 'any' ? Math.hypot(dx, dy) : d === 'x' ? Math.abs(dx) : dx * d.x + dy * d.y;
    drag.k = Math.max(0, Math.min(1, along / drag.len));
    scrollTo(0, drag.from + (drag.to - drag.from) * drag.k);
    e.preventDefault();
  }
  function up(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const { k, from, to, a } = drag;
    drag = null;
    endedAt = performance.now();
    stage.classList.remove('is-grabbing');
    if (k > 0.33) { used.add(a.from); glide(to); } else glide(from);
    e.preventDefault();
  }
  addEventListener('pointerdown', down, { capture: true, passive: false });
  addEventListener('pointermove', move, { passive: false });
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);

  return {
    get busy() { return !!drag; },
    // touchend arrives after pointerup: the swipe that was a drag must not also step the story
    justDragged: () => performance.now() - endedAt < 400,
    destroy() {
      cancelAnimationFrame(raf);
      removeEventListener('pointerdown', down, { capture: true });
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
      hint.remove(); pick.remove();
    },
    reduced,
  };
}
