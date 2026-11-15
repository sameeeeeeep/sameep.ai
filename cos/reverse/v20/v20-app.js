/* v20-app.js: the paper panel of the v20 landing. A white thread (400 px) and a paper canvas that shows ONE artefact,
   large and centred. Every artefact lands in the thread (as an attachment) and on the canvas at the same moment; the canvas
   cuts hard from one artefact to the next and the thread keeps the history. No morphs, no fades: messages rise a few px
   into place, faces drop onto tasks, bars fill. Every artefact, attachment and task opens big when clicked (env.open).
   No names in this file: everything comes from the config's v20 block. */

const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const str = (v, d) => (v == null || v === '' ? (d == null ? '' : d) : String(v));
const arr = (v) => (Array.isArray(v) ? v : []);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const EZ = 'cubic-bezier(.22,.8,.24,1)';
const PHONE = () => innerWidth < 760;
const words = (s) => str(s).split(/\s+/).filter(Boolean).length;

/* the reading clock: a message holds long enough to read at a calm pace */
export const read = (s) => Math.max(1700, 900 + words(s) * 270);

const isAgent = (w) => /agent$|^chief of staff$/i.test(str(w));
const isCos = (w) => /^chief of staff$/i.test(str(w));
/* "Tanvi's agent" -> "Tanvi": a person's own agent is their face inside the Coco ring */
const agentOf = (w) => { const m = /^(.+?)['’]s agent$/i.exec(str(w)); return m ? m[1] : null; };

export function createPanel(cfg, host, env) {
  env = env || {};
  const V = cfg.v20 || {};
  const pic = (k) => (env.img ? env.img(k) : k);

  /* ---------- people ---------- */
  function faceSrc(who) {
    const F = cfg.faces || {}, w = str(who), f = w.split(/[\s,]+/)[0];
    return (typeof F[w] === 'string' && F[w]) || (typeof F[f] === 'string' && F[f]) || '';
  }
  function face(who, cls) {
    const w = str(who, '?'), e = h('span', 'p-av' + (cls ? ' ' + cls : ''));
    /* the ring means agent: Coco is the empty ring, a person's agent is their face in the ring, Coco's own agents carry a letter */
    const ow = agentOf(w);
    if (ow) {
      e.classList.add('is-agent', 'is-clone'); const s0 = faceSrc(ow);
      if (s0) { const im = h('img'); im.alt = ''; im.decoding = 'async'; im.src = s0; e.appendChild(im); } else e.textContent = ow.charAt(0).toUpperCase();
      return e;
    }
    if (isAgent(w)) { e.classList.add('is-agent'); if (isCos(w)) e.classList.add('is-coco'); else e.textContent = w.charAt(0).toUpperCase(); return e; }
    const s = faceSrc(w);
    if (s) { const im = h('img'); im.alt = ''; im.decoding = 'async'; im.src = s; e.appendChild(im); } else { e.classList.add('is-ini'); e.textContent = w.charAt(0).toUpperCase(); }
    return e;
  }
  /* @mentions in ink weight, nothing coloured */
  function rich(cls, text) {
    const e = h('p', cls), t = str(text), re = /@(Chief of staff|[A-Z][a-z]+ agent|[A-Z][\w]+)/g; let last = 0, m;
    while ((m = re.exec(t))) { if (m.index > last) e.appendChild(document.createTextNode(t.slice(last, m.index))); e.appendChild(h('b', null, m[0])); last = m.index + m[0].length; }
    if (last < t.length) e.appendChild(document.createTextNode(t.slice(last)));
    return e;
  }

  /* ---------- the shared pieces an element can travel as (identical in the scene and on the canvas) ---------- */
  function bars(n, seed) { const w = h('span', 'vb-w'); for (let k = 0; k < n; k++) { const b = h('i'); b.style.height = Math.round(18 + 76 * Math.abs(Math.sin((k + (seed || 0)) * 1.7) * Math.cos(k * 0.45))) + '%'; w.appendChild(b); } return w; }
  /* the voice bubble: the phone's sent note, the thread's attachment and the canvas's media are all this */
  function voiceBubble(len) { const b = h('div', 'vb'); b.appendChild(h('span', 'vb-p')); b.appendChild(bars(30)); b.appendChild(h('span', 'vb-l', str(len, '0:20'))); return b; }
  /* the shipping label: printed on the box in the scene, then the canvas's media */
  /* the shipping label, landscape like the thermal label the 3D printer prints: header, barcode, address, pin, code */
  function shipLabel() {
    const S = cfg.shipping || {}, L = h('div', 'sl');
    const top = h('div', 'sl-top'); top.appendChild(h('b', null, str(S.courier, 'Courier'))); top.appendChild(h('span', null, str(S.service, 'Surface'))); L.appendChild(top);
    const bc = h('div', 'sl-bc'); for (let k = 0; k < 54; k++) { const i = h('i'); i.style.width = (1 + (Math.abs(Math.sin(k * 7.3)) * 3 | 0)) + 'px'; bc.appendChild(i); } L.appendChild(bc);
    const bt = h('div', 'sl-bt');
    const to = h('div', 'sl-to'); to.appendChild(h('span', null, 'Deliver to')); to.appendChild(h('b', null, str(S.to_name, 'Customer'))); to.appendChild(h('p', null, str(S.to_line))); to.appendChild(h('p', 'sl-awb', 'AWB ' + str(S.awb))); bt.appendChild(to);
    const pin = h('div', 'sl-pin'); pin.appendChild(h('b', null, str(S.pin))); const qr = h('span', 'sl-qr'); for (let k = 0; k < 49; k++) { const i = h('i'); if ((Math.sin(k * 12.9898) * 43758.5453) % 1 > 0.42 || [0, 1, 7, 8, 5, 6, 12, 13, 35, 36, 42, 43].includes(k)) i.className = 'on'; qr.appendChild(i); } pin.appendChild(qr); bt.appendChild(pin);
    L.appendChild(bt);
    return L;
  }

  /* ---------- artefacts: one design system, six layouts ---------- */
  function media(m) {
    const d = h('div', 'a-media');
    if (!m) return d;
    if (m.voice) { d.classList.add('is-voice'); const v = voiceBubble(m.voice); d.appendChild(v); if (m.words) d.appendChild(h('p', 'a-words', '“' + m.words + '”')); return d; }
    if (m.label) { d.classList.add('is-label'); d.appendChild(shipLabel()); return d; }
    if (m.img) {
      d.classList.add(m.fit === 'cover' ? 'is-cover' : 'is-cut');
      const src = pic(m.img);
      if (src) { const im = h('img'); im.alt = str(m.alt); im.decoding = 'async'; im.src = src; d.appendChild(im); }
      else d.appendChild(h('span', 'a-ph', str(m.ph, m.img)));   /* a labelled hole until the art lands */
    }
    return d;
  }
  const head = (e, a) => { if (a.lab) e.appendChild(h('span', 'a-lab', a.lab)); if (a.title) e.appendChild(h('h4', 'a-t', a.title)); };
  const pill = (t, cls) => h('span', 'a-pick' + (cls ? ' ' + cls : ''), t);
  function tick() { const s = h('span', 'a-tk'); s.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.6 8.4l2.9 2.9 5.9-6.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'; return s; }

  function art(a, o) {
    o = o || {};
    const e = h('div', 'a is-' + str(a.kind, 'card'));
    e._a = a;
    if (a.kind === 'list') {
      const L = h('div', 'a-l'); head(L, a);
      if (a.clock) { e._clock = h('span', 'a-n is-clock', a.clock[o.done ? 1 : 0]); L.appendChild(e._clock); }
      else if (a.n) L.appendChild(h('span', 'a-n', a.n));
      if (a.sub) L.appendChild(h('span', 'a-sub', a.sub));
      e.appendChild(L);
      const R = h('div', 'a-rows'); e._rows = [];
      arr(a.rows).forEach((r, j) => {
        const row = h('button', 'a-row'); row.type = 'button'; row._r = r;
        const own = h('span', 'a-own'); own.appendChild(face(r.who)); row.appendChild(own);
        const tx = h('span', 'a-rt'); tx.appendChild(h('b', null, r.text)); const s2 = h('span', 'a-rs', isAgent(r.who) ? str(r.who) : str(r.who) + (r.due ? ' · ' + r.due : '')); tx.appendChild(s2); row.appendChild(tx);
        const st = h('span', 'a-st'); row.appendChild(st); row._st = st; row._own = own;
        row.addEventListener('click', (ev) => { ev.stopPropagation(); if (env.open) env.open({ task: r, art: a, st: row.dataset.st }); });
        R.appendChild(row); e._rows.push(row);
        rowState(row, o.done ? 'done' : (a.drop ? 'new' : 'queued'));
      });
      e.appendChild(R);
      return e;
    }
    if (a.kind === 'poll') {
      const T = h('div', 'a-hd'); head(T, a); if (a.sub) T.appendChild(h('span', 'a-sub', a.sub)); e.appendChild(T);
      const G = h('div', 'a-opts'); e._opts = [];
      const tot = Math.max(1, +a.total || arr(a.opts).reduce((s, x) => s + (+x.votes || 0), 0));
      arr(a.opts).forEach((x) => {
        const c = h('div', 'a-opt' + (x.ai ? ' is-ai' : '')); c.appendChild(media({ img: x.img, ph: x.name }));
        const t = h('div', 'a-ot'); t.appendChild(h('b', null, x.name)); if (x.sub) t.appendChild(h('span', null, x.sub)); c.appendChild(t);
        if (x.votes != null) { const v = h('div', 'a-vote'); const bar = h('span', 'a-bar'); const f = h('i'); bar.appendChild(f); v.appendChild(bar); const n = h('span', 'a-vn', (o.done ? x.votes : 0) + ' of ' + tot); v.appendChild(n); c.appendChild(v); c._f = f; c._n = n; c._v = +x.votes || 0; c._tot = tot; f.style.transform = 'scaleX(' + (o.done ? c._v / tot : 0) + ')'; }
        if (x.ai) c.appendChild(pill(str(a.pick, 'AI pick')));
        G.appendChild(c); e._opts.push(c);
      });
      e.appendChild(G); if (o.done) e.classList.add('is-decided');
      return e;
    }
    if (a.kind === 'photo') {   /* a photograph fills the card; a caption sits under it */
      const src = pic(PHONE() && a.img_m ? a.img_m : a.img), F = h('div', 'a-photo');
      if (src) { const im = h('img'); im.alt = str(a.title); im.decoding = 'async'; im.src = src; F.appendChild(im); } else F.appendChild(h('span', 'a-ph', str(a.title, a.img)));
      e.appendChild(F); const C = h('div', 'a-cap'); if (a.title) C.appendChild(h('b', null, a.title)); if (a.lab) C.appendChild(h('span', null, a.lab)); e.appendChild(C);
      return e;
    }
    if (a.kind === 'ads') {
      const T = h('div', 'a-l'); head(T, a); if (a.n) T.appendChild(h('span', 'a-n', a.n)); if (a.sub) T.appendChild(h('span', 'a-sub', a.sub)); e.appendChild(T);
      const G = h('div', 'a-cuts');
      arr(a.cuts).forEach((x) => { const c = h('div', 'a-cut' + (x.st ? ' is-' + x.st : '')); c.appendChild(media({ img: x.img, fit: 'cover', ph: x.name })); const t = h('div', 'a-ot'); t.appendChild(h('b', null, x.name)); t.appendChild(h('span', null, str(x.sub))); c.appendChild(t); if (x.st === 'win') c.appendChild(pill(str(a.pick, 'Winning'))); G.appendChild(c); });
      e.appendChild(G);
      return e;
    }
    if (a.kind === 'stats') {
      const T = h('div', 'a-hd'); head(T, a); e.appendChild(T);
      const G = h('div', 'a-nums'); arr(a.nums).forEach((x) => { const c = h('div'); c.appendChild(h('span', 'a-n', x[0])); c.appendChild(h('span', 'a-sub', x[1])); G.appendChild(c); }); e.appendChild(G);
      if (a.foot) e.appendChild(h('p', 'a-foot', a.foot));
      return e;
    }
    if (a.kind === 'table') {
      const T = h('div', 'a-hd'); head(T, a); e.appendChild(T);
      const tb = h('table', 'a-tb'); const tr0 = h('tr'); arr(a.cols).forEach((c) => tr0.appendChild(h('th', null, c))); tb.appendChild(tr0);
      arr(a.rows).forEach((r) => { const tr = h('tr'); arr(r).forEach((c) => tr.appendChild(h('td', null, c))); tb.appendChild(tr); });
      e.appendChild(tb);
      const F = h('div', 'a-tot'); if (a.total) { F.appendChild(h('span', 'a-sub', a.total[0])); F.appendChild(h('span', 'a-n', a.total[1])); }
      e._pill = pill(o.done && a.pickDone ? a.pickDone : str(a.pick, 'Approve')); if (o.done) e.classList.add('is-decided'); F.appendChild(e._pill);
      e.appendChild(F);
      return e;
    }
    if (a.kind === 'team') {   /* everyone and their agent: the original, then the same face in the ring */
      const L = h('div', 'a-l'); head(L, a); if (a.sub) L.appendChild(h('span', 'a-sub', a.sub)); e.appendChild(L);
      const G = h('div', 'a-pairs'); e._pairs = [];
      arr(a.pairs).forEach((who) => {
        const r = h('div', 'a-pair');
        const fs = h('span', 'a-pf'); fs.appendChild(face(who)); fs.appendChild(face(who + "'s agent")); r.appendChild(fs);
        const tx = h('span', 'a-rt'); tx.appendChild(h('b', null, who)); tx.appendChild(h('span', 'a-rs', who + "'s agent")); r.appendChild(tx);
        G.appendChild(r); e._pairs.push(r);
      });
      e.appendChild(G);
      return e;
    }
    if (a.kind === 'route') {  /* one task, handed along: Coco -> the person's agent -> the person -> the owner */
      const T = h('div', 'a-hd'); head(T, a); if (a.sub) T.appendChild(h('span', 'a-sub', a.sub)); e.appendChild(T);
      const R = h('div', 'a-route'); e._steps = [];
      arr(a.steps).forEach((s, j) => {
        if (j) R.appendChild(h('i', 'a-link'));
        const n = h('div', 'a-step'); const av = face(s.who); av.classList.add('is-big'); n.appendChild(av);
        n.appendChild(h('b', null, str(s.name, s.who))); n.appendChild(h('span', null, str(s.t)));
        R.appendChild(n); e._steps.push(n);
      });
      e.appendChild(R);
      if (a.pick) { const F = h('div', 'a-tot'); F.appendChild(h('span', 'a-sub', str(a.foot))); e._pill = pill(o.done && a.pickDone ? a.pickDone : a.pick); F.appendChild(e._pill); e.appendChild(F); }
      e._step = (k) => { e._steps.forEach((n, j) => n.classList.toggle('is-on', j < k)); e.querySelectorAll('.a-link').forEach((l, j) => l.classList.toggle('is-on', j + 1 < k)); };
      e._step(o.done ? e._steps.length : 1);
      if (o.done) e.classList.add('is-decided');
      return e;
    }
    /* card: media left, words right */
    e.appendChild(media(a.media));
    const R = h('div', 'a-side'); head(R, a);
    if (a.n) R.appendChild(h('span', 'a-n' + (str(a.n).length > 6 ? ' is-long' : ''), a.n));
    if (a.sub) R.appendChild(h('span', 'a-sub', a.sub));
    if (a.list) { const ul = h('ul', 'a-ul'); arr(a.list).forEach((x) => { const li = h('li'); li.appendChild(tick()); li.appendChild(h('span', null, x[0])); if (x[1]) li.appendChild(h('em', null, x[1])); ul.appendChild(li); }); R.appendChild(ul); }
    if (a.pick) { e._pill = pill(o.done && a.pickDone ? a.pickDone : a.pick); R.appendChild(e._pill); }
    if (o.done) e.classList.add('is-decided');
    e.appendChild(R);
    return e;
  }
  function rowState(row, st) {
    row.dataset.st = st; row._st.textContent = st === 'done' ? str(row._r.done, 'Done') : st === 'work' ? 'Working' : st === 'new' ? '' : 'Queued';
  }
  /* an artefact's own motion over the beat: rows go working -> done, the clock runs, faces drop, votes come in */
  function animate(e, dur) {
    const a = e._a || {}, my = token;
    const at = (ms, fn) => later(ms, () => { if (my === token && e.isConnected) fn(); });
    if (a.kind === 'list') {
      const R = e._rows || [], n = R.length || 1, span = Math.max(2400, dur - 1200);
      if (a.drop) {   /* the morning: tasks are made, then each owner's face drops onto theirs */
        R.forEach((row, j) => { row.classList.add('is-hold'); at(300 + j * 380, () => row.classList.remove('is-hold')); });
        R.forEach((row, j) => at(300 + n * 380 + 500 + j * 650, () => { rowState(row, 'queued'); row.classList.add('is-own'); if (!REDUCED) row._own.firstChild.animate([{ transform: 'translateY(-70px)' }, { transform: 'translateY(4px)', offset: 0.78 }, { transform: 'none' }], { duration: 620, easing: 'cubic-bezier(.3,0,.3,1)' }); }));
        return;
      }
      R.forEach((row, j) => { at(span * (j / n) * 0.7, () => rowState(row, 'work')); at(span * (0.3 + 0.7 * (j + 1) / n) - 200, () => rowState(row, 'done')); });
      if (a.clock && e._clock) clockRun(e._clock, a.clock[0], a.clock[1], span, at);
      return;
    }
    if (a.kind === 'poll') {
      (e._opts || []).forEach((c) => { if (c._f == null) return; const steps = c._v; for (let k = 1; k <= steps; k++) at(600 + k * 520, () => { c._n.textContent = k + ' of ' + c._tot; c._f.style.transform = 'scaleX(' + (k / c._tot) + ')'; }); });
    }
  }
  function clockRun(el, a, b, span, at) {
    const p = (s) => { const m = /(\d+):(\d+)\s*(am|pm)?/i.exec(s); if (!m) return null; let hh = +m[1] % 12; if (/pm/i.test(m[3] || '')) hh += 12; return hh * 60 + +m[2]; };
    const f = (t) => { const hh = Math.floor(t / 60) % 24, mm = t % 60, ap = hh >= 12 ? 'pm' : 'am'; return ((hh % 12) || 12) + ':' + String(mm).padStart(2, '0') + ' ' + ap; };
    const A = p(a), B = p(b); if (A == null || B == null) return;
    const N = 24; for (let k = 1; k <= N; k++) at(span * k / N, () => { el.textContent = f(Math.round(A + (B - A) * k / N)); });
  }
  function decide(e) {
    if (!e) return; e.classList.add('is-decided');
    const a = e._a || {}; if (e._pill && a.pickDone) e._pill.textContent = a.pickDone;
    if (env.sfx) env.sfx('stamp');
  }

  /* ---------- the frame ---------- */
  const ui = {};
  const root = h('div', 'p'); ui.root = root;
  ui.thr = h('section', 'p-thr'); ui.thr.setAttribute('aria-label', 'Thread'); ui.list = h('div', 'p-list'); ui.thr.appendChild(ui.list); root.appendChild(ui.thr);
  ui.cv = h('section', 'p-cv'); ui.cv.setAttribute('aria-label', 'Canvas');
  ui.lab = h('span', 'p-lab'); ui.cv.appendChild(ui.lab);
  ui.stage = h('div', 'p-stage'); ui.cv.appendChild(ui.stage);
  root.appendChild(ui.cv);
  host.appendChild(root);

  /* the canvas scale: the card is laid out at 860 x 500 and scaled to fit (desktop); on a phone it is fluid */
  function fit() {
    if (PHONE()) { root.style.removeProperty('--sk'); return; }
    const w = ui.cv.clientWidth, hh = ui.cv.clientHeight;
    if (!w || !hh) return;
    const board = !!root.querySelector('.bd-mid');   /* inside the board the canvas is one column of four: it scales further down */
    root.style.setProperty('--sk', Math.max(board ? 0.3 : 0.5, Math.min(1.12, (w - (board ? 36 : 96)) / 860, (hh - (board ? 90 : 120)) / 500)).toFixed(4));
  }
  addEventListener('resize', fit);

  let T = [], token = 0, cur = null;
  const later = (ms, fn) => { const t = token; T.push(setTimeout(() => { if (t === token) fn(); }, REDUCED ? Math.min(ms, 40) : ms)); };
  const wait = (ms) => new Promise((r) => later(ms, r));
  let asking = null;
  function stop() { T.forEach(clearTimeout); T = []; token++; asking = null; ui.list.querySelectorAll('.is-typing').forEach((e) => e.remove()); ui.cv.querySelectorAll('.p-call').forEach((e) => e.remove()); }
  /* a decision is the viewer's: the story holds on a button until they take it (Next and scroll take it too) */
  function askCall(it) {
    return new Promise((res) => {
      const my = token, bar = h('div', 'p-call');
      bar.appendChild(h('span', null, 'Your call, as ' + str(it.who)));
      const b = h('button', 'p-call-b', str(it.call, 'Approve')); b.type = 'button'; bar.appendChild(b);
      ui.cv.appendChild(bar);
      if (!REDUCED) bar.animate([{ translate: '0 14px' }, { translate: '0 0' }], { duration: 420, easing: EZ });
      const done = () => { if (asking !== done) return; asking = null; bar.remove(); if (my === token) res(); };
      asking = done;
      b.addEventListener('click', (ev) => { ev.stopPropagation(); done(); });
    });
  }

  /* the canvas shows exactly one artefact: a hard cut, then the card settles a few px (position only) */
  function show(a, o) {
    o = o || {};
    ui.stage.innerHTML = ''; cur = null;
    if (!a) return null;
    fit();
    const w = h('div', 'p-fit'), e = art(a, o);
    e.addEventListener('click', (ev) => { if (ev.target.closest('.a-row')) return; if (env.open) env.open({ art: a }); });
    w.appendChild(e); ui.stage.appendChild(w); cur = e;
    if (o.rise && !REDUCED) {
      e.animate([{ translate: '0 46px', scale: '.94' }, { translate: '0 0', scale: '1' }], { duration: 620, easing: EZ });
      const big = e.querySelector('.a-n'); if (big) big.animate([{ scale: '.5' }, { scale: '1.12', offset: 0.7 }, { scale: '1' }], { duration: 700, delay: 260, easing: EZ, fill: 'backwards' });
      if (env.sfx) { env.sfx('land'); if (/new project/i.test(str(a.lab))) later(300, () => env.sfx('chime')); }
    }
    return e;
  }
  function label(t) { ui.lab.textContent = str(t); }

  /* ---------- the thread ---------- */
  function attOf(a) {
    const b = h('button', 'p-att'); b.type = 'button';
    const m = (a.kind === 'photo' ? { img: PHONE() && a.img_m ? a.img_m : a.img } : null) || a.media || (a.opts && a.opts[0]) || (a.cuts && a.cuts.find((x) => x.st === 'win')) || null;
    if (m && m.voice) b.appendChild(voiceBubble(m.voice));
    else {
      if (m && m.label) { const t = h('span', 'p-att-i is-label'); t.appendChild(h('i')); b.appendChild(t); }
      else if (m && m.img && pic(m.img)) { const im = h('img', 'p-att-i'); im.alt = ''; im.src = pic(m.img); b.appendChild(im); }
      else { const t = h('span', 'p-att-i is-doc'); t.appendChild(h('i')); t.appendChild(h('i')); t.appendChild(h('i')); b.appendChild(t); }
      b.appendChild(h('span', 'p-att-t', str(a.title, a.lab)));
    }
    /* the chat is where things are said; clicking anything in it puts it on the canvas, big */
    b.addEventListener('click', (ev) => { ev.stopPropagation(); if (env.peek) env.peek(); show(a, { done: true, rise: true }); ui.list.querySelectorAll('.p-att.is-shown').forEach((x) => x.classList.remove('is-shown')); b.classList.add('is-shown'); });
    return b;
  }
  function msg(it) {
    const r = h('div', 'p-m'); r.appendChild(face(it.who));
    const c = h('div', 'p-mc'); c.appendChild(h('b', 'p-mn', str(it.who)));
    if (it.voice) { const vb = voiceBubble(it.vlen || '0:05'); vb.classList.add('is-msg'); c.appendChild(vb); r._vb = vb; }
    if (it.text) c.appendChild(rich('p-mt' + (it.voice ? ' is-said' : ''), it.text));
    if (it.art) c.appendChild(attOf(it.art));
    r.appendChild(c); return r;
  }
  function divider(t) { const d = h('div', 'p-div'); d.appendChild(h('span', null, t)); return d; }
  function typing(who) { const r = h('div', 'p-m is-typing'); r.appendChild(face(who)); const d = h('span', 'p-dots'); d.appendChild(h('i')); d.appendChild(h('i')); d.appendChild(h('i')); r.appendChild(d); ui.list.appendChild(r); toEnd(); return r; }
  function toEnd(smooth) { const t = ui.thr; try { t.scrollTo({ top: t.scrollHeight, behavior: smooth && !REDUCED ? 'smooth' : 'auto' }); } catch (e) { t.scrollTop = t.scrollHeight; } }
  function add(it, quick) { const r = msg(it); ui.list.appendChild(r); if (!quick && !REDUCED) r.animate([{ translate: '0 12px' }, { translate: '0 0' }], { duration: 420, easing: EZ }); toEnd(!quick); return r; }

  /* history: the thread as it stands before beat k (instant), and the canvas showing the last artefact */
  function history(beats) {
    stop(); ui.list.innerHTML = ''; let last = null, lastLab = '';
    beats.forEach((b) => {
      if (b.div) ui.list.appendChild(divider(b.div));
      arr(b.thread).forEach((it) => { add(it, true); if (it.art) last = it.art; });
      if (b.art) last = b.art; if (b.label) lastLab = b.label;
    });
    return { art: last, label: lastLab };
  }
  /* how long a beat runs: every message and artefact gets its reading time */
  function estimate(b) {
    if (b.hold) return b.hold;
    let t = 900;
    arr(b.thread).forEach((it) => { t += 650 + read(it.text) + (it.art ? 2400 : 0); });
    if (b.art && !arr(b.thread).some((x) => x.art)) t += 2400;
    return Math.max(8000, Math.min(13000, t));
  }
  /* play a panel beat. The canvas target for an arriving element is ready before the first message (env.land) */
  async function play(b, o) {
    o = o || {}; stop(); const my = token, live = () => my === token;
    const total = estimate(b), items = arr(b.thread);
    /* the canvas label moves with the canvas: it changes when this beat's first artefact lands */
    /* the canvas label, and (through o.onCue) the bottom line, change the moment this beat's first artefact is on the canvas */
    const anyArt = b.art || items.some((x) => x.art);
    let cued = false; const cue = () => { if (cued) return; cued = true; label(b.label); if (o.onCue) o.onCue(); };
    if (!anyArt || o.landing || b.art) cue();
    if (b.div && !o.noDiv) ui.list.appendChild(divider(b.div));
    /* the first artefact: with an element arriving, it is on the canvas from the start (the element lands on it) */
    const firstArt = b.art || (items.find((x) => x.art) || {}).art;
    let shown = null;
    if (o.landing && firstArt) { shown = show(firstArt); if (o.landing) await o.landing(shown); if (!live()) return; }
    else if (b.art) shown = show(b.art, { rise: true });
    else if (b.enter && firstArt) { shown = show(firstArt, { rise: true }); cue(); }
    if (shown && b.art) animate(shown, total);
    const slack = Math.max(0, total - estimateItems(items));
    await wait(o.landing ? 300 : 600); if (!live()) return;
    for (let j = 0; j < items.length; j++) {
      const it = items[j];
      if (it.decide) { await askCall(it); if (!live()) return; }
      const ty = it.instant || it.decide ? null : typing(it.who);
      await wait(it.instant || it.decide ? 0 : 650); if (!live()) return; if (ty) ty.remove();
      const row = add(it);
      let said = 0; if (it.voice && env.voice) { said = env.voice(it.voice) || 0; if (row._vb) { row._vb.classList.add('is-playing'); later(Math.max(said, 1200), () => row._vb.classList.remove('is-playing')); } }
      if (it.art) {
        if (!(shown && shown._a === it.art)) { shown = show(it.art, { rise: true }); }
        cue();
        animate(shown, Math.max(3000, read(it.text) + 2400 + slack / items.length));
      }
      if (it.step != null && shown && shown._step) shown._step(it.step);
      if (it.decide && shown) decide(shown);
      if (env.sfx) env.sfx('pop');
      await wait(Math.max(read(it.text), said + 500) + (it.art ? 2400 : 0) + slack / Math.max(1, items.length)); if (!live()) return;
    }
  }
  function estimateItems(items) { return 900 + items.reduce((t, it) => t + 650 + read(it.text) + (it.art ? 2400 : 0), 0); }

  /* every picture the panel shows, for the loader */
  function assets(beats) {
    const out = new Set(), add2 = (k) => { const u = k && pic(k); if (u) out.add(u); };
    const walk = (a) => { if (!a) return; arr(a.pairs).forEach((w) => { if (faceSrc(w)) out.add(faceSrc(w)); }); arr(a.steps).forEach((s) => { const w = agentOf(s.who) || s.who; if (faceSrc(w)) out.add(faceSrc(w)); }); if (a.media && a.media.img) add2(a.media.img); if (a.kind === 'photo') { add2(a.img); add2(a.img_m); } arr(a.opts).forEach((x) => add2(x.img)); arr(a.cuts).forEach((x) => add2(x.img)); arr(a.rows).forEach((r) => { if (!isAgent(r.who) && faceSrc(r.who)) out.add(faceSrc(r.who)); }); };
    beats.forEach((b) => { walk(b.art); arr(b.thread).forEach((it) => { walk(it.art); if (!isAgent(it.who) && faceSrc(it.who)) out.add(faceSrc(it.who)); }); });
    return Array.from(out);
  }
  return {
    el: root, play, stop, show, label, history, estimate, assets, art, fit, voiceBubble, shipLabel, face,
    get cur() { return cur; }, get asking() { return !!asking; }, answer: () => { if (asking) asking(); }, mediaOf: (e) => (e ? e.querySelector('.a-media') : null)
  };
}
