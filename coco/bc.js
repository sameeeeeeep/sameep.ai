// bc.js: the brandcos landing.
// 1. Film: the page is one sticky stage. Scroll position p (in viewport heights) is eased toward the real
//    scroll every frame, then each layer is set from p with transform and opacity only, so it scrubs both ways.
//    Photo n sits under photo n+1. Each cut is a short dissolve during which both photos share one anchor point
//    on screen and one scale, and push in together, so the carried object (data-fx, data-fy: where it sits in
//    the photo) stays put and grows through the cut. Between cuts the camera eases back and drifts to the next
//    anchor. Overlays (.ov) ride the same transform as their photo; .quad children are mapped onto a screen
//    in the photo with a perspective matrix.
// 2. Ending: a normal-flow section that lies over the last screen of the stage. Voice note first; the closing
//    line and the way in appear after the note ends, or after half a screen more of scroll.
// 3. Log in: the email-code flow against /d2c-api.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  var film = root.classList.contains('film');
  var qs = new URLSearchParams(location.search);
  var capture = qs.has('capture');

  var clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  var smooth = function (x) { x = clamp(x, 0, 1); return x * x * x * (x * (x * 6 - 15) + 10); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  // ---------------------------------------------------------------- 1. film
  var scenes = Array.prototype.slice.call(document.querySelectorAll('.scene'));
  var N = scenes.length;               // 16 layers at p = 1..N: 15 steps, then the photo the voice note sits on
  var STEPS = N - 1;
  var LO = 1.06, HI = 1.14, WC = 0.25; // push range and dissolve length (in screens)
  var p = 0, target = 0, unit = 1, vw = 1, vh = 1, last = 0, raf = 0, narrow = false, lift = 56;
  var stage = $('stage'), track = $('track'), intro = $('intro'), fill = $('rail-fill'), count = $('count');
  var ending = $('ending'), endImg = $('end-img');
  var layers = scenes.map(function (el, i) {
    var img = el.querySelector('img'), d = el.dataset;
    var copy = el.querySelector('.copy');
    return { n: i + 1, el: el, img: img, ov: el.querySelector('.ov'), copy: copy,
      tc: copy && copy.querySelector('.tc'), bubs: Array.prototype.slice.call(el.querySelectorAll('[data-at]')),
      quads: Array.prototype.slice.call(el.querySelectorAll('.quad')),
      fx0: +d.fx || .5, fy0: +d.fy || .62, mfx: +d.mfx || 0, mfy: +d.mfy || 0,
      pax: +d.ax || .5, pmax: +d.max || 0, pay: +d.ay || 0, pmay: +d.may || 0,
      ar: 2400 / 1350, taps: +d.taps || 0, live: false, copyLive: false, go: false, aria: null };
  });
  var tapsBy = []; layers.reduce(function (sum, L) { sum += L.taps; tapsBy[L.n] = sum; return sum; }, 0);
  var A = [], M = [];                  // per cut k (between layer k and k+1): shared anchor and scale floor

  function sReq(L, ax, ay) {
    return Math.max(ay * vh / (L.fy * L.H), (1 - ay) * vh / ((1 - L.fy) * L.H), ax * vw / (L.fx * L.W), (1 - ax) * vw / ((1 - L.fx) * L.W));
  }
  function range(L, s) {               // anchor positions that keep this photo covering the stage at scale s
    return { x0: 1 - s * (1 - L.fx) * L.W / vw, x1: s * L.fx * L.W / vw, y0: 1 - s * (1 - L.fy) * L.H / vh, y1: s * L.fy * L.H / vh };
  }
  function fit(v, a, b) { return a <= b ? clamp(v, a, b) : (a + b) / 2; }

  function measure() {
    vw = stage.clientWidth; vh = stage.clientHeight;
    unit = vh; narrow = vw < 700; lift = narrow ? 40 : 56;
    var dax = .5, day = narrow ? .5 : .6;
    layers.forEach(function (L) {
      var W = Math.max(vw, vh * L.ar), H = W / L.ar;
      L.W = W; L.H = H;
      L.fx = narrow && L.mfx ? L.mfx : L.fx0; L.fy = narrow && L.mfy ? L.mfy : L.fy0;
      L.img.style.width = W + 'px'; L.img.style.height = H + 'px';
      var r = range(L, LO);
      L.P = { x: fit(narrow ? (L.pmax || dax) : L.pax, r.x0, r.x1), y: fit((narrow ? L.pmay : L.pay) || day, r.y0, r.y1) };
      L.m = Math.max(1, sReq(L, L.P.x, L.P.y) / LO);
      if (L.ov) {
        L.ov.style.width = W + 'px'; L.ov.style.height = H + 'px';
        L.quads.forEach(function (q) { mapQuad(q, W, H); });
      }
    });
    A[0] = layers[0].P; M[0] = layers[0].m;
    for (var k = 1; k < N; k++) {
      var a = layers[k - 1], b = layers[k], ra = range(a, LO), rb = range(b, LO);
      var ax = fit((a.P.x + b.P.x) / 2, Math.max(ra.x0, rb.x0), Math.min(ra.x1, rb.x1));
      var ay = fit((a.P.y + b.P.y) / 2, Math.max(ra.y0, rb.y0), Math.min(ra.y1, rb.y1));
      A[k] = { x: ax, y: ay };
      M[k] = Math.max(1, sReq(a, ax, ay) / LO, sReq(b, ax, ay) / LO);
    }
    // the last photo settles to a plain cover crop, which the ending section repeats exactly
    var F = layers[N - 1];
    F.fin = { tx: clamp(F.P.x * vw - F.fx * F.W, vw - F.W, 0), ty: clamp(F.P.y * vh - F.fy * F.H, vh - F.H, 0) };
    if (endImg) endImg.style.objectPosition = (F.W > vw + .5 ? F.fin.tx / (vw - F.W) * 100 : 50).toFixed(3) + '% ' + (F.H > vh + .5 ? F.fin.ty / (vh - F.H) * 100 : 50).toFixed(3) + '%';
  }

  function mapQuad(el, W, H) {
    var f = el.dataset.quad.split(',').map(Number), p = [];
    for (var i = 0; i < 8; i += 2) { p.push(f[i] * W, f[i + 1] * H); }
    var w = (Math.hypot(p[2] - p[0], p[3] - p[1]) + Math.hypot(p[4] - p[6], p[5] - p[7])) / 2;
    var h = (Math.hypot(p[6] - p[0], p[7] - p[1]) + Math.hypot(p[4] - p[2], p[5] - p[3])) / 2;
    var x0 = p[0], y0 = p[1], x1 = p[2], y1 = p[3], x2 = p[4], y2 = p[5], x3 = p[6], y3 = p[7];
    var dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2, sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
    var den = dx1 * dy2 - dx2 * dy1, g = (sx * dy2 - dx2 * sy) / den, hh = (dx1 * sy - sx * dy1) / den;
    var a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3, d = y1 - y0 + g * y1, e = y3 - y0 + hh * y3;
    el.style.width = w + 'px'; el.style.height = h + 'px';
    el.style.transform = 'matrix3d(' + [a / w, d / w, 0, g / w, b / h, e / h, 0, hh / h, 0, 0, 1, 0, x0, y0, 0, 1].map(function (v) { return +v.toFixed(8); }).join(',') + ')';
  }

  function setLive(el, on, key, L) {
    if (L[key] === on) return;
    L[key] = on; el.classList.toggle('live', on);
    if (key === 'live' && L.ov) L.ov.classList.toggle('live', on);
  }

  // Keep only the photos near p in the render tree: the current one, one back, two ahead.
  var curWin = -1;
  function loadWindow(q) {
    var cur = Math.round(q);
    if (cur === curWin) return; curWin = cur;
    layers.forEach(function (L) {
      var want = L.n >= cur - 1 && L.n <= cur + 2;
      if (want === L.go) return;
      L.go = want; L.img.classList.toggle('go', want);
      if (want) {
        L.img.loading = 'eager';
        var dec = function () { if (L.img.decode) L.img.decode().catch(function () {}); };
        if (L.img.complete && L.img.naturalWidth) dec(); else L.img.addEventListener('load', dec, { once: true });
      }
    });
  }

  function place(L, q) {
    var n = L.n, s, ax, ay, op = 1, blur = 0, tx, ty;
    var cIn = n - 1 + 0.3, cInEnd = n === 1 ? 0 : cIn + WC, cOut = n + 0.3;
    if (n > 1) op = smooth((q - cIn) / WC);
    if (n > 1 && q < cInEnd) {
      s = lerp(LO, HI, smooth((q - cIn) / WC)) * M[n - 1]; ax = A[n - 1].x; ay = A[n - 1].y;
    } else if (n < N && q >= cOut) {
      var u = clamp((q - cOut) / WC, 0, 1);
      s = lerp(LO, HI, smooth(u)) * M[n]; ax = A[n].x; ay = A[n].y; blur = 2.6 * Math.sin(Math.PI * u);
    } else if (n < N) {
      // scale eases back across the whole stretch; the anchor (and scale floor) settles on this photo's own
      // framing exactly at p = n, then leaves toward the next cut
      var e = smooth((q - cInEnd) / (cOut - cInEnd)), from, to, w, mm;
      if (q < n) { from = n - 1; w = smooth((q - cInEnd) / (n - cInEnd)); ax = lerp(A[from].x, L.P.x, w); ay = lerp(A[from].y, L.P.y, w); mm = lerp(M[from], L.m, w); }
      else { to = n; w = smooth((q - n) / (cOut - n)); ax = lerp(L.P.x, A[to].x, w); ay = lerp(L.P.y, A[to].y, w); mm = lerp(L.m, M[to], w); }
      s = lerp(HI, LO, e) * mm;
    } else {                           // last photo: ease out to the plain cover crop by N - .15
      var f = smooth((q - cInEnd) / (N - 0.15 - cInEnd)), s0 = HI * M[n - 1];
      var tx0 = A[n - 1].x * vw - s0 * L.fx * L.W, ty0 = A[n - 1].y * vh - s0 * L.fy * L.H;
      s = lerp(s0, 1, f); tx = lerp(tx0, L.fin.tx, f); ty = lerp(ty0, L.fin.ty, f);
    }
    if (tx === undefined) { tx = ax * vw - s * L.fx * L.W; ty = ay * vh - s * L.fy * L.H; }
    tx = clamp(tx, vw - s * L.W, 0); ty = clamp(ty, vh - s * L.H, 0);
    var tf = 'translate3d(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px,0) scale(' + s.toFixed(5) + ')';
    var fl = blur > 0.05 ? 'blur(' + blur.toFixed(2) + 'px)' : 'none';
    L.img.style.transform = tf; L.img.style.opacity = op.toFixed(4); L.img.style.filter = fl;
    if (L.ov) { L.ov.style.transform = tf; L.ov.style.opacity = op.toFixed(4); L.ov.style.filter = fl; }
  }

  function render() {
    var q = clamp(p, 0, N);
    loadWindow(q);
    for (var i = 0; i < N; i++) {
      var L = layers[i], n = L.n;
      var start = n === 1 ? -1 : n - 1 + 0.3, end = n === N ? Infinity : n + 0.3 + WC;
      var vis = q >= start && q <= end;
      setLive(L.img, vis, 'live', L);
      if (vis) place(L, q);
    }
    copyAt(intro, 0, q, introState);
    for (var j = 0; j < STEPS; j++) copyAt(layers[j].copy, layers[j].n, q, layers[j]);
    fill.style.transform = 'scaleY(' + clamp(q / STEPS, 0, 1).toFixed(4) + ')';
    var cur = clamp(Math.round(q), 1, STEPS);
    var txt = 'Step ' + cur + ' of ' + STEPS + ' · ' + tapsBy[cur] + (tapsBy[cur] === 1 ? ' human tap' : ' human taps');
    if (count.textContent !== txt) count.textContent = txt;
    count.classList.toggle('gone', q < 0.55 || q > STEPS + 0.45);
  }
  var introState = { live: false, aria: null };
  function copyAt(el, c, q, L) {
    var d = q - c, op;
    if (c === 0) op = 1 - smooth((d - 0.2) / 0.14);
    else op = smooth((d + 0.42) / 0.14) * (1 - smooth((d - 0.34) / 0.14));
    var vis = op > 0.002;
    setLive(el, vis, 'copyLive', L);
    var hide = op < 0.5;
    if (L.aria !== hide) { L.aria = hide; el.setAttribute('aria-hidden', String(hide)); el.classList.toggle('on', !hide); }
    if (!vis) { if (el.style.opacity !== '0') el.style.opacity = '0'; return; }
    el.style.transform = 'translate3d(0,' + (-d * lift).toFixed(2) + 'px,0)';
    el.style.opacity = op.toFixed(4);
    if (L.tc) {                        // the human tap presses itself as the scene settles
      var k = clamp((d + 0.17) / 0.12, 0, 1);
      L.tc.style.setProperty('--k', (1 - 0.05 * Math.sin(Math.PI * k)).toFixed(4));
      L.tc.classList.toggle('done', d > -0.11);
    }
    for (var b = 0; L.bubs && b < L.bubs.length; b++) {
      L.bubs[b].style.setProperty('--o', smooth((d - +L.bubs[b].dataset.at) / 0.07).toFixed(3));
    }
  }

  function readScroll() {
    var top = track.getBoundingClientRect().top;
    target = clamp(-top / unit, 0, N);
  }
  function frame(now) {
    raf = 0;
    var dt = Math.min(64, now - (last || now)); last = now;
    var k = 1 - Math.exp(-dt / 105);
    p += (target - p) * k;
    if (Math.abs(target - p) < 0.0004) p = target;
    render();
    if (p !== target) raf = requestAnimationFrame(frame); else last = 0;
  }
  function kick() {
    readScroll();
    endCheck();
    if (capture) { p = target; render(); return; }
    if (!raf) raf = requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- 2. ending
  var audio = $('vn-audio'), vn = $('vn'), wave = $('vn-wave'), timeEl = $('vn-time'), textEl = $('vn-text'), play = $('vn-play');
  var say = $('vn-say'), after = $('end-after'), revealed = false;
  function reveal() {
    if (revealed) return; revealed = true;
    say.classList.add('shown');
    if (!played) words.forEach(function (w) { w.el.classList.add('on'); });
    after.classList.add('shown');
  }
  function endCheck() {
    if (!film) return;
    var top = ending.getBoundingClientRect().top;
    ending.classList.toggle('solid', top <= 0.5);
    if (-top >= 0.5 * unit) reveal();
    if (top > unit * 0.5 && !audio.paused) audio.pause();
  }

  var PEAKS = [.06,.06,.06,.06,.91,.85,.70,.42,.79,.41,.51,.36,.64,.82,.69,.52,.36,.53,.64,.15,.61,.55,.27,.06,.06,.06,.06,.06,.06,.06,.06,.73,.92,.46,.86,.43,.56,.35,.06,.06,.45,.89,.73,.71,.31,.68,.35,.06,.06,.06,.06,.06,.06,.06,.06,.06,.06,.21,.62,.92,1,.74,.17,.68,.48,.13,.06,.06,.06,.06,.06,.06];
  var SEGS = [[0.61, 3.4, 'What if the house could smell like the first rain?'], [4.62, 5.72, 'Like wet earth,'], [5.99, 7.16, 'right when it starts.'], [8.53, 9.8, 'Can we make that?']];
  var DUR = 10.66;
  var bars = PEAKS.map(function (h) { var b = document.createElement('span'); b.style.setProperty('--h', (h * .55).toFixed(3)); wave.appendChild(b); return b; });
  var words = [];
  textEl.textContent = '';
  SEGS.forEach(function (seg, si) {
    var parts = seg[2].split(' ');
    parts.forEach(function (w, wi) {
      var s = document.createElement('span'); s.className = 'w'; s.textContent = w;
      textEl.appendChild(s); textEl.appendChild(document.createTextNode(' '));
      words.push({ el: s, at: seg[0] + (seg[1] - seg[0]) * wi / parts.length - 0.05 });
    });
    if (si === 0) textEl.appendChild(document.createTextNode(' '));
  });
  var fmt = function (t) { t = Math.max(0, Math.round(t)); return Math.floor(t / 60) + ':' + (t % 60 < 10 ? '0' : '') + (t % 60); };
  var vraf = 0, played = false;
  function paintAt(t, dur, playing) {
    var head = t / dur * bars.length;
    for (var i = 0; i < bars.length; i++) {
      var on = i < head, near = Math.exp(-Math.pow(i - head, 2) / 6);
      var h = PEAKS[i] * (on ? 1 : .55) * (playing ? 1 + .45 * near * (0.6 + 0.4 * Math.sin(t * 22 + i)) : 1);
      bars[i].style.setProperty('--h', Math.min(1, Math.max(.06, h)).toFixed(3));
      bars[i].classList.toggle('on', on);
    }
    for (var j = 0; j < words.length; j++) if (played) words[j].el.classList.toggle('on', t >= words[j].at);
    timeEl.textContent = !playing && !t ? fmt(dur) : fmt(t);
  }
  function paint() {
    paintAt(audio.currentTime || 0, audio.duration || DUR, !audio.paused);
    vraf = audio.paused ? 0 : requestAnimationFrame(paint);
  }
  function start() {
    played = true; textEl.classList.add('armed'); say.classList.add('shown');
    words.forEach(function (w) { w.el.classList.remove('on'); });
  }
  play.addEventListener('click', function () {
    if (audio.paused) {
      if (audio.ended || audio.currentTime >= (audio.duration || DUR) - 0.05) audio.currentTime = 0;
      if (!audio.currentTime) start();
      var pr = audio.play(); if (pr && pr.catch) pr.catch(function () {});
    } else audio.pause();
  });
  audio.addEventListener('play', function () { vn.classList.add('playing'); play.setAttribute('aria-label', 'Pause the voice note'); if (!vraf) vraf = requestAnimationFrame(paint); });
  audio.addEventListener('pause', function () { vn.classList.remove('playing'); play.setAttribute('aria-label', "Play Kavya's voice note, 11 seconds"); paint(); });
  audio.addEventListener('ended', function () { words.forEach(function (w) { w.el.classList.add('on'); }); paint(); setTimeout(reveal, 600); });
  wave.addEventListener('click', function (e) {
    var r = wave.getBoundingClientRect(), dur = audio.duration || DUR;
    if (!played) start();
    audio.currentTime = clamp((e.clientX - r.left) / r.width, 0, 1) * dur;
    if (audio.paused) { var pr = audio.play(); if (pr && pr.catch) pr.catch(function () {}); }
  });
  $('skip').addEventListener('click', function (e) {
    e.preventDefault();
    var y = ending.getBoundingClientRect().top + scrollY;
    scrollTo(0, y); reveal(); play.focus({ preventScroll: true });
  });

  if (film) {
    track.style.setProperty('--units', String(N));
    measure(); readScroll(); p = target; render(); endCheck();
    addEventListener('scroll', kick, { passive: true });
    addEventListener('resize', function () { measure(); readScroll(); p = target; render(); endCheck(); });
    window.__bc = { units: N,
      seek: function (x) { p = target = x; render(); },
      // capture hooks for the preview video: a voice-note frame at time t, and the closing fade (0..1)
      vnAt: function (t, playing) { if (!played) start(); vn.classList.toggle('playing', !!playing); paintAt(t, DUR, !!playing); if (!playing && t >= DUR) words.forEach(function (w) { w.el.classList.add('on'); }); },
      endFade: function (x) { after.classList.add('shown'); after.style.opacity = x.toFixed(3); after.style.transform = 'translateY(' + ((1 - x) * 14).toFixed(2) + 'px)'; revealed = true; } };
  }

  // ---------------------------------------------------------------- 3. log in
  var login = $('login'), opener = $('login-open');
  opener.addEventListener('click', function () {
    var open = login.hidden;
    login.hidden = !open; opener.setAttribute('aria-expanded', String(open));
    if (open) setTimeout(function () { $('lf-email').focus({ preventScroll: true }); login.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 60);
  });
  var LOCAL = ['localhost', '127.0.0.1', '[::1]'];
  var API = '/d2c-api', apiParam = '';
  if (LOCAL.indexOf(location.hostname) >= 0 && qs.get('api')) {
    try { var u = new URL(qs.get('api')); if (LOCAL.indexOf(u.hostname) >= 0) { API = u.origin + '/d2c-api'; apiParam = u.origin; } } catch (e) {}
  }
  if (apiParam) document.querySelectorAll('a[href="./app/#demo"]').forEach(function (a) { a.href = './app/?api=' + encodeURIComponent(apiParam) + '#demo'; });

  var lf = $('lf'), cf = $('cf'), msg = $('lf-msg'), email = '';
  function tell(text, unreachable) {
    msg.textContent = text;
    if (unreachable) {
      msg.textContent = 'Sign-in is not reachable right now. Try again in a minute, or email ';
      var a = document.createElement('a'); a.href = 'mailto:hello@sameep.ai?subject=' + encodeURIComponent('brandcos login'); a.textContent = 'hello@sameep.ai';
      msg.appendChild(a); msg.appendChild(document.createTextNode('.'));
    }
    if (text || unreachable) msg.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  async function post(path, body) {
    var res = await fetch(API + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    var out = null; try { out = await res.json(); } catch (e) {}
    return { status: res.status, body: out };
  }
  function busy(form, yes) { form.querySelectorAll('button, input').forEach(function (x) { x.disabled = yes; }); }
  lf.addEventListener('submit', async function (e) {
    e.preventDefault();
    email = lf.email.value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { tell('Enter your work email.'); lf.email.focus(); return; }
    busy(lf, true); tell('Sending your code…');
    try {
      var r = await post('/auth/login', { email: email });
      if (r.status === 404 || r.status === 405 || r.status >= 500 || !r.body) { tell('', true); return; }
      if (r.status === 429) { tell('Too many tries. Wait a few minutes and try again.'); return; }
      if (r.status >= 400) { tell((r.body && r.body.error) || 'That did not work. Check the email and try again.'); return; }
      $('cf-to').textContent = email;
      lf.hidden = true; cf.hidden = false;
      tell('If this email belongs to a brand, a code is on its way. It works for 15 minutes.');
      cf.code.focus({ preventScroll: true });
    } catch (err) { tell('', true); }
    finally { busy(lf, false); }
  });
  cf.addEventListener('submit', async function (e) {
    e.preventDefault();
    var code = cf.code.value.replace(/\D/g, '');
    if (code.length !== 6) { tell('Enter the 6-digit code from the email.'); return; }
    busy(cf, true); tell('Checking…');
    try {
      var r = await post('/auth/verify', { email: email, code: code });
      if (r.status === 404 || r.status === 405 || r.status >= 500) { tell('', true); return; }
      if (r.status === 429) { tell('Too many tries. Wait a few minutes and try again.'); return; }
      var token = r.body && r.body.token;
      if (r.status >= 400 || !token) { tell('That code did not work. Check it, or use a different email to get a new one.'); return; }
      try { localStorage.setItem('d2c.session', token); } catch (err) {}
      tell('You are in. Opening your workspace…');
      location.href = './app/' + (apiParam ? '?api=' + encodeURIComponent(apiParam) : '');
    } catch (err) { tell('', true); }
    finally { busy(cf, false); }
  });
  $('cf-back').addEventListener('click', function () { cf.hidden = true; lf.hidden = false; cf.code.value = ''; tell(''); lf.email.focus(); });
})();
