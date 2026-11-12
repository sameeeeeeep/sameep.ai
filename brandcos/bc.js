// sameep.ai/brandcos: one day at a brand, scrubbed by scroll (every frame is a pure function of scroll position, so it
// runs backwards too), the close with its login, and the plan builder.
(function () {
  var root = document.documentElement;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var ease = function (x) { x = clamp(x, 0, 1); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var span = function (p, a, b) { return clamp((p - a) / (b - a), 0, 1); };
  var mq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  var small = window.matchMedia ? matchMedia('(max-width: 700px)') : { matches: false };
  function motion() { return root.classList.contains('motion'); }
  var GW = 390, GH = 844; // the glass is a phone screen, 390 x 844, mapped onto the device in the photo

  // the 2D projective map from the glass rectangle onto a quad (TL, TR, BR, BL), as a CSS matrix3d
  function m3d(q) {
    var x0 = q[0][0], y0 = q[0][1], x1 = q[1][0], y1 = q[1][1], x2 = q[2][0], y2 = q[2][1], x3 = q[3][0], y3 = q[3][1];
    var dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
    var det = dx1 * dy2 - dx2 * dy1, g = (dx3 * dy2 - dx2 * dy3) / det, h = (dx1 * dy3 - dx3 * dy1) / det;
    var a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, d = y1 - y0 + g * y1, e = y3 - y0 + h * y3;
    return 'matrix3d(' + [a / GW, d / GW, 0, g / GW, b / GH, e / GH, 0, h / GH, 0, 0, 1, 0, x0, y0, 0, 1].map(function (n) { return +n.toFixed(6); }).join(',') + ')';
  }
  function parseQuad(el) {
    var q = (el.dataset.quad || '').trim().split(/\s+/).map(function (s) { return s.split(',').map(Number); });
    var k = parseFloat(el.dataset.inset) || 0, cx = 0, cy = 0;
    q.forEach(function (p) { cx += p[0] / 4; cy += p[1] / 4; });
    return q.map(function (p) { return [p[0] + (cx - p[0]) * k, p[1] + (cy - p[1]) * k]; });
  }
  // where the image sits in a box under object-fit: cover at object-position fx% 50%
  function cover(W, H, fx) {
    var s = Math.max(W / 3, H / 2), iw = 3 * s, ih = 2 * s;
    return { ox: (W - iw) * fx / 100, oy: (H - ih) / 2, iw: iw, ih: ih };
  }
  function toPx(q, c) { return q.map(function (p) { return [c.ox + c.iw * p[0] / 100, c.oy + c.ih * p[1] / 100]; }); }
  var dist = function (a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); };

  var scenes = Array.prototype.map.call(document.querySelectorAll('.sc'), function (el) {
    var $ = function (s) { return el.querySelector(s); };
    return { el: el, kind: el.dataset.kind, stage: $('.sc-stage'), cam: $('.cam'), plate: $('.plate'), glass: $('.glass'), shade: $('.shade'),
      copy: $('.copy'), txt: $('.hero-txt'), notch: $('.notch'), strip: $('.strip'), side: $('.side'), funnel: $('.funnel'),
      rows: el.querySelectorAll('.fn li'), fnShot: $('.fn-shot'), states: el.querySelectorAll('.states'), quad: el.dataset.quad ? parseQuad(el) : null,
      hero: el.classList.contains('sc-hero'), geo: null, last: -1 };
  });

  function pinned(s) { return motion() && (s.kind === 'device' || ((s.kind === 'strip' || s.kind === 'split' || s.kind === 'funnel') && !small.matches)); }

  function measure(s) {
    var W = s.cam.clientWidth, H = s.cam.clientHeight, m = small.matches;
    var fx = parseFloat(s.el.dataset.fx); if (isNaN(fx)) fx = 50;
    var g = { W: W, H: H };
    if (s.quad) {
      // on a phone, slide the photo so the device sits in the middle of the frame
      if (m) { var c0 = cover(W, H, 50), mid = (s.quad[0][0] + s.quad[2][0]) / 2; fx = clamp((c0.iw * mid / 100 - W / 2) / (c0.iw - W) * 100, 0, 100); }
      var c = cover(W, H, fx), q = toPx(s.quad, c);
      var C = [(q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4];
      var len = Math.max(dist(q[0], q[3]), dist(q[1], q[2]));
      var to = (m ? s.el.dataset.toM : s.el.dataset.to || '50,50').split(',').map(Number);
      var z = parseFloat(m ? s.el.dataset.zoomM : s.el.dataset.zoom) || .8;
      g.C = C; g.D = [W * to[0] / 100, H * to[1] / 100]; g.Z = Math.max(1, z * H / len); g.mat = m3d(q);
    }
    s.plate.style.objectPosition = fx + '% 50%';
    if (s.glass) s.glass.style.transform = g.mat || '';
    s.geo = g;
  }

  function setStates(s, p) {
    Array.prototype.forEach.call(s.states, function (box) {
      var at = (box.dataset.steps || '').split(',').map(Number), q = p;
      if (!pinned(s)) { var r = box.getBoundingClientRect(); q = clamp((innerHeight * .9 - r.top) / (innerHeight * .7), 0, 1); at = at.map(function (a) { return a * .9; }); }
      var n = 0; at.forEach(function (a) { if (q >= a) n++; });
      Array.prototype.forEach.call(box.children, function (st, i) { st.classList.toggle('on', i === n); });
    });
  }
  function show(el, o, dy) { if (!el) return; el.style.opacity = String(o); el.style.visibility = o > 0 ? 'visible' : 'hidden'; el.style.transform = dy ? 'translateY(' + dy.toFixed(1) + 'px)' : ''; }

  function draw(s, p) {
    var g = s.geo;
    if (s.kind === 'device') {
      var glassIn = s.hero ? span(p, .06, .2) : span(p, .04, .16);
      var e = ease(s.hero ? span(p, .16, .6) : span(p, .12, .52));
      var k = lerp(1, g.Z, e), De = [lerp(g.C[0], g.D[0], e), lerp(g.C[1], g.D[1], e)];
      var tx = clamp(De[0] - k * g.C[0], g.W - k * g.W, 0), ty = clamp(De[1] - k * g.C[1], g.H - k * g.H, 0);
      s.cam.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) scale(' + k.toFixed(4) + ')';
      s.glass.style.opacity = String(glassIn);
      if (s.shade) s.shade.style.opacity = String((parseFloat(s.el.dataset.dark) || .5) * e);
      if (s.hero) { var h = span(p, .08, .22); show(s.txt, 1 - h, -h * 24); }
      var c = s.hero ? span(p, .52, .64) : span(p, .44, .56);
      if (s.notch) {
        var d = ease(span(p, .3, .46));
        s.notch.style.opacity = String(span(p, .3, .38)); s.notch.style.visibility = d > 0 ? 'visible' : 'hidden';
        s.notch.style.transform = 'translate(-50%,' + ((1 - d) * -60).toFixed(1) + 'px)';
        c = span(p, .5, .6);
      }
      show(s.copy, c, (1 - ease(c)) * 16);
    } else if (s.kind === 'strip') {
      s.plate.style.transform = 'scale(' + lerp(1.28, 1.42, p).toFixed(4) + ')';
      var t = ease(span(p, .06, .26)); s.strip.style.opacity = String(t); s.strip.style.transform = 'translateX(' + ((1 - t) * 60).toFixed(1) + 'px)';
      var c2 = span(p, .14, .28); show(s.copy, c2, (1 - ease(c2)) * 16);
    } else if (s.kind === 'split') {
      var c3 = span(p, .08, .22); show(s.copy, c3, (1 - ease(c3)) * 16);
    } else if (s.kind === 'funnel') {
      Array.prototype.forEach.call(s.rows, function (li, i) { var o = span(p, .1 + i * .12, .18 + i * .12); show(li, o, (1 - ease(o)) * 14); });
      var fs = span(p, .62, .72); show(s.fnShot, fs, (1 - ease(fs)) * 14);
      var c4 = span(p, .04, .16); show(s.copy, c4, (1 - ease(c4)) * 16);
    }
  }

  function clearAll() {
    scenes.forEach(function (s) {
      [s.cam, s.glass, s.shade, s.copy, s.txt, s.notch, s.strip, s.plate, s.fnShot].concat(Array.prototype.slice.call(s.rows)).forEach(function (el) {
        if (el) { el.style.opacity = ''; el.style.transform = ''; el.style.visibility = ''; } });
      s.last = -1; s.geo = null;
    });
  }

  var vh = innerHeight;
  function frame() {
    scenes.forEach(function (s) {
      var r = s.el.getBoundingClientRect();
      if (r.bottom < -vh || r.top > vh * 2) return;
      var p = clamp(-r.top / Math.max(1, r.height - vh), 0, 1);
      setStates(s, p);
      if (!pinned(s)) { if (s.glass && !s.geo) { measure(s); s.glass.style.opacity = '1'; } return; }
      if (!s.geo) measure(s);
      if (Math.abs(p - s.last) < .0004) return;
      s.last = p; draw(s, p);
    });
    placeClose();
  }

  // the close: the end-of-day brief on the phone in the photo
  var close = document.querySelector('.close'), closeQ = close && close.dataset.quad ? parseQuad(close) : null, closeKey = '';
  function placeClose() {
    if (!closeQ) return;
    var box = close.querySelector('.close-media'), W = box.clientWidth, H = box.clientHeight, key = W + 'x' + H;
    if (key === closeKey) return; closeKey = key;
    var fx = 50;
    if (small.matches) { var c0 = cover(W, H, 50), mid = (closeQ[0][0] + closeQ[2][0]) / 2; fx = clamp((c0.iw * mid / 100 - W / 2) / (c0.iw - W) * 100, 0, 100); }
    box.querySelector('.plate').style.objectPosition = fx + '% 50%';
    box.querySelector('.glass').style.transform = m3d(toPx(closeQ, cover(W, H, fx)));
  }

  // the bar steps aside while you read down, and comes back as soon as you scroll up
  var top = document.getElementById('top'), lastY = scrollY;
  function bar() {
    var y = scrollY;
    if (y < 80 || y < lastY - 4) top.classList.remove('is-away');
    else if (y > lastY + 4) top.classList.add('is-away');
    lastY = y;
  }

  function relayout() {
    vh = innerHeight; closeKey = '';
    scenes.forEach(function (s) { s.el.classList.toggle('pin', pinned(s)); });
    scenes.forEach(function (s) { s.geo = null; s.last = -1; });
    if (!motion()) clearAll();
    frame();
  }
  var tick = false;
  addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(function () { tick = false; frame(); bar(); }); } }, { passive: true });
  addEventListener('resize', relayout);
  if (small.addEventListener) small.addEventListener('change', function () { clearAll(); relayout(); });
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { root.classList.toggle('motion', !mq.matches); clearAll(); relayout(); });
  relayout();
  addEventListener('load', relayout);

  // log in: a text link under the demo button opens the form
  var lfOpen = document.getElementById('lf-open'), login = document.getElementById('login');
  function openLogin() { login.hidden = false; lfOpen.setAttribute('aria-expanded', 'true'); }
  lfOpen.addEventListener('click', function () { if (login.hidden) { openLogin(); document.getElementById('lf-email').focus(); } else { login.hidden = true; lfOpen.setAttribute('aria-expanded', 'false'); } });
  document.querySelectorAll('a[href="#start"]').forEach(function (a) { a.addEventListener('click', function () { openLogin(); }); });
  if (location.hash === '#start') openLogin();

  // ── log in to your brand ──
  var qs = new URLSearchParams(location.search);
  var LOCAL = ['localhost', '127.0.0.1', '[::1]'];
  var local = LOCAL.indexOf(location.hostname) >= 0;
  var API = '/d2c-api', apiParam = '';
  if (local && qs.get('api')) {
    try { var u = new URL(qs.get('api')); if (LOCAL.indexOf(u.hostname) >= 0) { API = u.origin + '/d2c-api'; apiParam = u.origin; } } catch (e) {}
  }
  // local dev: the demo doors carry the same ?api= so the app talks to the local worker too
  if (apiParam) document.querySelectorAll('a[href="./app/#demo"]').forEach(function (a) { a.href = './app/?api=' + encodeURIComponent(apiParam) + '#demo'; });
  var lf = document.getElementById('lf'), cf = document.getElementById('cf'), msg = document.getElementById('lf-msg');
  var email = '';

  function say(text, closed) {
    msg.textContent = text;
    if (closed) {
      msg.textContent = 'Demo logins open soon. Email ';
      var a = document.createElement('a'); a.href = 'mailto:hello@sameep.ai?subject=' + encodeURIComponent('Chief of Staff demo'); a.textContent = 'hello@sameep.ai';
      msg.appendChild(a); msg.appendChild(document.createTextNode('.'));
    }
  }
  async function post(path, data) {
    var res = await fetch(API + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    var body = null; try { body = await res.json(); } catch (e) {}
    return { status: res.status, body: body };
  }
  function busy(form, yes) { form.querySelectorAll('button, input').forEach(function (x) { x.disabled = yes; }); }

  lf.addEventListener('submit', async function (e) {
    e.preventDefault();
    email = lf.email.value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say('Enter your work email.'); lf.email.focus(); return; }
    busy(lf, true); say('Sending your code…');
    try {
      var r = await post('/auth/login', { email: email });
      if (r.status === 404 || r.status >= 500 || !r.body) { say('', true); return; }
      if (r.status === 429) { say('Too many tries. Wait a few minutes and try again.'); return; }
      if (r.status >= 400) { say((r.body && r.body.error) || 'That didn’t work. Check the email and try again.'); return; }
      document.getElementById('cf-to').textContent = email;
      lf.hidden = true; cf.hidden = false; say('If this email belongs to a brand, a code is on its way. It works for 15 minutes.');
      cf.code.focus();
    } catch (err) { say('', true); }
    finally { busy(lf, false); }
  });

  cf.addEventListener('submit', async function (e) {
    e.preventDefault();
    var code = cf.code.value.replace(/\D/g, '');
    if (code.length !== 6) { say('Enter the 6-digit code from the email.'); return; }
    busy(cf, true); say('Checking…');
    try {
      var r = await post('/auth/verify', { email: email, code: code });
      if (r.status === 404 || r.status >= 500) { say('', true); return; }
      var token = r.body && r.body.token;
      if (r.status === 429) { say('Too many tries. Wait a few minutes and try again.'); return; }
      if (r.status >= 400 || !token) { say('That code didn’t work. Check it, or use a different email to get a new one.'); return; }
      try { localStorage.setItem('d2c.session', token); } catch (err) {}
      say('You’re in. Opening your workspace…');
      location.href = './app/' + (apiParam ? '?api=' + encodeURIComponent(apiParam) : '');
    } catch (err) { say('', true); }
    finally { busy(cf, false); }
  });

  document.getElementById('cf-back').addEventListener('click', function () { cf.hidden = true; lf.hidden = false; cf.code.value = ''; say(''); lf.email.focus(); });

  // ── plans: the same builder as the pricing page. All prices in USD. ──
  (function () {
    var PRICE = { integration: 1000, access: 100, extraWeeks: 100, custom: 100 };
    var HOURS = { base: 6, extraWeeks: 6, custom: 6 }; // 2 weeks x 3 hours; 6 hours a month
    var PRESETS = { budget: { m1: false, m2: false, custom: false }, balanced: { m1: true, m2: false, custom: false }, hands: { m1: true, m2: true, custom: true } };
    var TEAM_NAMES = { founders: 'Founders', ops: 'Ops and warehouse', growth: 'Growth and ads', content: 'Content and social', finance: 'Finance', support: 'Customer support', agency: 'Your agency' };
    var form = document.getElementById('plan');
    var $ = function (id) { return document.getElementById(id); };
    var box = function (n) { return form.elements[n]; };
    var usd = function (n) { return '$' + n.toLocaleString('en-US'); };
    var hrs = function (n) { return n === 1 ? '1 hour' : (Math.round(n * 10) / 10) + ' hours'; };
    var teamBoxes = function () { return Array.prototype.slice.call(form.querySelectorAll('input[name="team"]')); };

    function state() {
      return { m1: box('m1').checked, m2: box('m2').checked, custom: box('custom').checked,
        teams: teamBoxes().filter(function (i) { return i.checked; }).map(function (i) { return i.value; }) };
    }
    function presetFor(s) { for (var k in PRESETS) { var p = PRESETS[k]; if (p.m1 === s.m1 && p.m2 === s.m2 && p.custom === s.custom) return k; } return null; }
    function query(s) {
      var q = [];
      if (s.m1) q.push('m1=1'); if (s.m2) q.push('m2=1'); if (s.custom) q.push('custom=1');
      if (s.teams.length) q.push('teams=' + s.teams.join(','));
      return location.pathname + (q.length ? '?' + q.join('&') : '') + location.hash;
    }
    function link(s) { return location.origin + query(s).replace(/#.*$/, '') + '#plans'; }

    function render() {
      var s = state();
      var m1 = PRICE.integration + (s.m1 ? PRICE.extraWeeks : 0) + (s.custom ? PRICE.custom : 0);
      var m2 = PRICE.access + (s.m2 ? PRICE.extraWeeks : 0) + (s.custom ? PRICE.custom : 0);
      var m3 = PRICE.access + (s.custom ? PRICE.custom : 0);
      var h1 = HOURS.base + (s.m1 ? HOURS.extraWeeks : 0) + (s.custom ? HOURS.custom : 0);
      var h2 = (s.m2 ? HOURS.extraWeeks : 0) + (s.custom ? HOURS.custom : 0);
      var h3 = s.custom ? HOURS.custom : 0;
      $('s-m1').textContent = usd(m1); $('s-m2').textContent = usd(m2); $('s-m3').textContent = usd(m3);
      $('s-hours').textContent = 'Hours with me: ' + hrs(h1) + ' in month 1, ' + hrs(h2) + ' in month 2, ' +
        (h3 ? hrs(h3) + ' each month after.' : 'none after that unless you add custom hours.');
      var n = s.teams.length, early = h1 + h2;
      $('split').textContent = n
        ? n + (n === 1 ? ' team' : ' teams') + ' across ' + hrs(early) + ' in the first two months: about ' + hrs(early / n) + ' each.' +
          (early / n < 1 ? ' That is under an hour a team, so consider adding weeks.' : '')
        : 'No teams picked yet.';
      var p = presetFor(s);
      Array.prototype.forEach.call(form.elements.preset, function (r) { r.checked = r.value === p; });
      var names = s.teams.map(function (t) { return TEAM_NAMES[t]; });
      var lines = [
        'Hi Sameep, here is the plan I picked:', '',
        'First-time integration (includes month 1 and 2 weeks of help): $1,000',
        'Access and updates from month 2: $100 a month',
        'Two more weeks in month 1: ' + (s.m1 ? 'yes' : 'no'),
        'Two weeks in month 2: ' + (s.m2 ? 'yes' : 'no'),
        'Custom development and training, 6 hours a month: ' + (s.custom ? 'yes' : 'no'),
        'Teams to train: ' + (names.length ? names.join(', ') : 'not sure yet'), '',
        'Month 1: ' + usd(m1) + '. Month 2: ' + usd(m2) + '. Each month after: ' + usd(m3) + '.', '',
        'Link: ' + link(s), '', 'Company:', 'Best time to talk:'
      ];
      $('send').href = 'mailto:hello@sameep.ai?subject=' + encodeURIComponent('Chief of Staff plan') + '&body=' + encodeURIComponent(lines.join('\n'));
    }

    if (qs.has('m1') || qs.has('m2') || qs.has('custom') || qs.has('teams')) {
      box('m1').checked = qs.get('m1') === '1'; box('m2').checked = qs.get('m2') === '1'; box('custom').checked = qs.get('custom') === '1';
      var picked = (qs.get('teams') || '').split(',');
      teamBoxes().forEach(function (i) { i.checked = picked.indexOf(i.value) >= 0; });
    } else {
      var bal = PRESETS.balanced; box('m1').checked = bal.m1; box('m2').checked = bal.m2; box('custom').checked = bal.custom;
    }
    form.addEventListener('change', function (e) {
      if (e.target.name === 'preset') { var p = PRESETS[e.target.value]; box('m1').checked = p.m1; box('m2').checked = p.m2; box('custom').checked = p.custom; }
      render();
      try { history.replaceState(null, '', query(state())); } catch (err) {}
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    $('copy').addEventListener('click', function () {
      var url = link(state());
      var done = function () { $('copied').textContent = 'Link copied.'; };
      var fail = function () { $('copied').textContent = 'Copy this link: ' + url; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, fail); else fail();
    });
    render();
  })();
})();
