// sameep.ai/brandcos: one day at a brand, scrubbed by scroll (every frame is a pure function of scroll position, so it
// runs backwards too), the two doors (instant demo; email -> 6-digit code -> ./app/) and the plan builder.
(function () {
  // ── the real product screens. Swap any of these for a final capture and every scene picks it up. ──
  var SCREENS = {
    today: 'assets/ui-today.webp',       // 1 morning brief (phone)
    board: 'assets/ui-board.webp',       // 2 vendor call -> board card, Plan to In progress (laptop)
    stock: 'assets/ui-stock.webp',       // 3 stock mismatch -> ops card with votes (laptop)
    revision: 'assets/ui-revision.webp', // 4 listing price -> card to Revision (phone)
    plan: 'assets/ui-plan.webp',         // 5 creator shoot -> launch timeline (laptop)
    thread: 'assets/ui-thread.webp',     // 6 11pm -> notch card in the team group chat (phone)
    hub: 'assets/ui-hub.webp',           // 7 GST invoice -> the hub (laptop)
    hiring: 'assets/ui-hiring.webp'      // 8 interview -> hiring (laptop)
  };
  Array.prototype.forEach.call(document.querySelectorAll('img[data-screen]'), function (img) {
    var src = SCREENS[img.dataset.screen]; if (src && img.getAttribute('src') !== src) img.src = src;
  });

  var root = document.documentElement;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var ease = function (x) { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var span = function (p, a, b) { return clamp((p - a) / (b - a), 0, 1); };

  // reduced motion (or a change to it mid-visit): the stacked, finished version
  var mq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  function motion() { return root.classList.contains('motion'); }

  var scenes = Array.prototype.map.call(document.querySelectorAll('.sc'), function (el) {
    var f = (el.dataset.from || '50,50,10,0').split(',').map(Number);
    return { el: el, stage: el.querySelector('.sc-stage'), scr: el.querySelector('.scr'), copy: el.querySelector('.copy'),
      hero: el.classList.contains('sc-hero'), txt: el.querySelector('.hero-txt'), dusk: el.querySelector('.dusk'),
      fx: parseFloat(getComputedStyle(el).getPropertyValue('--fx')) || 50, from: f, geo: null, last: -1 };
  });

  // where the device in the photo sits on screen: object-fit: cover math on a 3:2 image
  function measure(s) {
    var W = s.stage.clientWidth, H = s.stage.clientHeight;
    var sc = Math.max(W / 3, H / 2), iw = 3 * sc, ih = 2 * sc;
    var ox = (W - iw) * s.fx / 100, oy = (H - ih) / 2;
    var cx = ox + iw * s.from[0] / 100, cy = oy + ih * s.from[1] / 100, dw = iw * s.from[2] / 100;
    var r = s.scr, fw = r.offsetWidth, fh = r.offsetHeight;
    var fcx = r.offsetLeft + fw / 2, fcy = r.offsetTop + fh / 2;
    s.geo = { dx: cx - fcx, dy: cy - fcy, s0: Math.max(dw / fw, .04), rot: s.from[3] };
  }

  function draw(s, p) {
    var g = s.geo;
    // the screen: rises out of the device, straightens, and grows to a readable frame
    var a = s.hero ? .28 : .08, b = s.hero ? .62 : .5;
    var k = ease(span(p, a, b));
    s.scr.style.opacity = String(span(p, a, a + (b - a) * .45));
    s.scr.style.transform = 'translate(' + (g.dx * (1 - k)).toFixed(1) + 'px,' + (g.dy * (1 - k)).toFixed(1) + 'px) rotate(' + (g.rot * (1 - k)).toFixed(2) + 'deg) scale(' + lerp(g.s0, 1, k).toFixed(4) + ')';
    // the line: comes in once the screen has landed
    var c = s.hero ? span(p, .56, .7) : span(p, .36, .52);
    s.copy.style.opacity = String(c);
    s.copy.style.transform = 'translateY(' + ((1 - ease(c)) * 18).toFixed(1) + 'px)';
    s.copy.style.visibility = c > 0 ? 'visible' : 'hidden';
    if (s.hero) {
      // dawn: the room brightens as the headline gives way
      var h = span(p, .1, .26);
      s.txt.style.opacity = String(1 - h);
      s.txt.style.transform = 'translateY(' + (-h * 24).toFixed(1) + 'px)';
      s.txt.style.visibility = h < 1 ? 'visible' : 'hidden';
      s.dusk.style.opacity = String(.52 * (1 - ease(span(p, .04, .4))));
    }
  }

  function clear() {
    scenes.forEach(function (s) {
      [s.scr, s.copy, s.txt, s.dusk].forEach(function (el) { if (el) { el.style.opacity = ''; el.style.transform = ''; el.style.visibility = ''; } });
      s.last = -1;
    });
  }

  var vh = window.innerHeight;
  function frame() {
    if (!motion()) return;
    scenes.forEach(function (s) {
      var r = s.el.getBoundingClientRect();
      if (r.bottom < -vh || r.top > vh * 2) return;
      var p = clamp(-r.top / Math.max(1, r.height - vh), 0, 1);
      if (!s.geo) measure(s);
      if (Math.abs(p - s.last) < .0005) return;
      s.last = p; draw(s, p);
    });
  }
  function relayout() {
    vh = window.innerHeight;
    if (!motion()) return;
    scenes.forEach(function (s) { s.geo = null; s.last = -1; });
    frame();
  }
  var tick = false;
  window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(function () { tick = false; frame(); }); } }, { passive: true });
  window.addEventListener('resize', relayout);
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { root.classList.toggle('motion', !mq.matches); if (mq.matches) clear(); relayout(); });
  relayout();
  window.addEventListener('load', relayout);

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
