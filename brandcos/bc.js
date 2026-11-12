// sameep.ai/brandcos: the scroll story (reversible: every frame is a pure function of scroll position),
// the two doors (instant demo; email -> 6-digit code -> ./app/) and the plan builder.
(function () {
  var BEATS = 8, W = 400, H = 520;
  var SCENE_OF = ['pieces', 'pieces', 'pieces', 'cmd', 'cmd', 'hub', 'board', 'today'];
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var ease = function (x) { x = clamp(x, 0, 1); return x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var on = function (el, yes) { if (el) el.classList.toggle('is-on', !!yes); };
  var each = function (root, sel, fn) { Array.prototype.forEach.call(root.querySelectorAll(sel), fn); };
  var put = function (el, x, y, r) { el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)' + (r ? ' rotate(' + r.toFixed(2) + 'deg)' : ''); };

  // ── the brand's pieces: where each of the 9 fragments sits in beats 0, 1 and 2 ──
  var BOX = { chat: [0, 8, 258, 256, -1.5], sheet: [122, 236, 278, 168, 1.5], head: [0, 414, 300, 106, 0] };
  // fragment -> [box, slot] while scattered (beat 1)
  var SCATTER = [['head', 0], ['head', 1], ['sheet', 0], ['chat', 0], ['chat', 1], ['chat', 2], ['sheet', 1], ['chat', 3], ['sheet', 2]];
  var LOOK = { chat: 'is-bub', sheet: 'is-cell', head: 'is-note' };
  function b0(i) { var g = Math.floor(i / 3), j = i % 3; return [0, g * 172 + 58 + j * 30, 400, 0]; }
  function b1(i) {
    var s = SCATTER[i], k = s[1];
    if (s[0] === 'chat') return [12, 54 + k * 50, 222, -1.5];
    if (s[0] === 'sheet') return [134, 282 + k * 38, 254, 1.5];
    return [14, 452 + k * 30, 280, 0];
  }
  function b2(i) { var g = Math.floor(i / 3), j = i % 3; return [16, 56 + g * 152 + 26 + j * 38, 368, 0]; }

  // ── sparklines ──
  var SPARK = [
    [10, 12, 11, 14, 13, 15, 14, 17, 16, 19, 18, 22],
    [12, 13, 12, 15, 16, 18, 17, 20, 21, 23, 24, 26],
    [8, 9, 11, 10, 12, 13, 12, 14, 15, 14, 16, 17],
    [24, 22, 21, 19, 18, 17, 15, 14, 13, 11, 10, 9]
  ];
  function sparkD(a) {
    var mn = Math.min.apply(null, a), mx = Math.max.apply(null, a);
    return a.map(function (v, i) { return (i ? 'L' : 'M') + (i * 100 / (a.length - 1)).toFixed(1) + ' ' + (26 - (v - mn) / (mx - mn) * 24).toFixed(1); }).join(' ');
  }
  function money(v, f) {
    if (f === 'L') return '₹' + (v / 1e5).toFixed(2) + 'L';
    if (f === 'K') return '₹' + (v / 1e3).toFixed(1) + 'K';
    if (f === 'd') return Math.round(v) + ' days';
    return String(Math.round(v));
  }

  var ASKED = 'What runs out this week?';
  var BOARD_OTHER = [null,
    ['Hire: operations executive', 1, 'Final: a shortlist of 6, interviews booked', 'Riya', 'Approve shortlist'],
    ['Ad: Diwali carousel, ₹40K', 2, 'Performance agent building 4 variants', 'Arjun', 'Review'],
    ['Reel: festive launch', 0, 'Plan: script and shot list drafted', 'Meera', 'Approve plan']];

  // one-time set-up of a canvas root: split the brief into words, draw the sparkline paths
  function prep(root) {
    each(root, '[data-brief]', function (el) {
      el.innerHTML = el.textContent.split(' ').map(function (w) { return '<span class="w">' + w + '</span>'; }).join(' ');
    });
    each(root, '[data-spark]', function (p) {
      p.setAttribute('d', sparkD(SPARK[+p.dataset.spark])); p.setAttribute('pathLength', '1');
      p.style.strokeDasharray = '1'; p.style.strokeDashoffset = p.hasAttribute('data-full') ? '0' : '1';
    });
    each(root, '.lane', function (el) { var l = +el.dataset.l; el.style.top = (42 + l * 119.5) + 'px'; el.style.height = '119.5px'; });
    each(root, '.box', function (el) { var b = BOX[el.dataset.box]; el.style.left = b[0] + 'px'; el.style.top = b[1] + 'px'; el.style.width = b[2] + 'px'; el.style.height = b[3] + 'px'; el.style.transform = b[4] ? 'rotate(' + b[4] + 'deg)' : ''; });
    each(root, '.win-sec', function (el) { el.style.top = (56 + (+el.dataset.s) * 152) + 'px'; });
    each(root, '.word', function (el) { el.style.top = ((+el.dataset.w) * 172) + 'px'; });
  }

  // draw beat b at progress t (0..1) into one canvas root
  function draw(root, b, t) {
    var scene = SCENE_OF[b];
    each(root, '.scene', function (s) { on(s, s.dataset.scene === scene); });

    if (scene === 'pieces') {
      each(root, '.word', function (el) {
        var g = +el.dataset.w, k = ease((t - g * .26) / .1);
        el.style.visibility = b === 0 && t >= g * .26 ? 'visible' : 'hidden';
        el.style.opacity = String(lerp(.2, 1, k));
        put(el, 0, lerp(14, 0, k));
      });
      each(root, '.box', function (el) { el.style.visibility = b === 1 ? 'visible' : 'hidden'; });
      root.querySelector('[data-win]').style.visibility = b === 2 ? 'visible' : 'hidden';
      each(root, '.frag', function (el) {
        var i = +el.dataset.f, g = Math.floor(i / 3), j = i % 3, p, look = '', vis = true;
        if (b === 0) {
          var st = g * .26 + .06 + j * .05, k0 = ease((t - st) / .1);
          vis = t >= st; p = b0(i); p = [p[0], p[1] + lerp(10, 0, k0), p[2], 0];
        } else if (b === 1) {
          var k1 = ease((t - i * .05) / .4), a = b0(i), z = b1(i);
          p = [lerp(a[0], z[0], k1), lerp(a[1], z[1], k1), lerp(a[2], z[2], k1), lerp(0, z[3], k1)];
          look = LOOK[SCATTER[i][0]];
        } else {
          var order = [3, 4, 5, 0, 1, 2, 6, 7, 8].indexOf(i);
          var k2 = ease((t - order * .045) / .4), c = b1(i), d = b2(i);
          p = [lerp(c[0], d[0], k2), lerp(c[1], d[1], k2), lerp(c[2], d[2], k2), lerp(c[3], 0, k2)];
          look = 'is-row';
        }
        el.className = 'frag' + (look ? ' ' + look : '');
        el.style.visibility = vis ? 'visible' : 'hidden';
        el.style.width = p[2].toFixed(1) + 'px';
        put(el, p[0], p[1], p[3]);
      });
    }

    if (scene === 'cmd') {
      var words = root.querySelectorAll('.brief .w');
      var shown = b === 3 ? Math.round(clamp(t / .5, 0, 1) * words.length) : words.length;
      Array.prototype.forEach.call(words, function (w, i) { on(w, i < shown); });
      var kc = b === 3 ? ease((t - .5) / .35) : 1;
      each(root, '[data-count]', function (el) { el.textContent = money(+el.dataset.count * kc, el.dataset.fmt); });
      each(root, '[data-spark]', function (p) { if (!p.hasAttribute('data-full')) p.style.strokeDashoffset = String(1 - kc); });
      var needs = root.querySelector('[data-needs]');
      var kn = b === 4 ? ease(t / .16) : 0;
      needs.style.transform = 'translateY(' + ((1 - kn) * 380).toFixed(1) + 'px)';
      var PRESS = [.42, .6, .78], DONE = ['Meera accepted', 'Arjun picked the bundle', 'Riya approved'], WHO = ['Handed to Meera', 'Arjun decides', 'Riya reviews'];
      each(root, '.ask', function (el) {
        var a = +el.dataset.a, st = .14 + a * .08, k = ease((t - st) / .08);
        on(el, b === 4 && t >= st);
        el.style.transform = 'translateY(' + lerp(12, 0, k).toFixed(1) + 'px)';
        var pressed = b === 4 && t >= PRESS[a];
        el.querySelector('[data-press]').classList.toggle('is-pressed', pressed);
        el.querySelector('.who').textContent = pressed ? DONE[a] : WHO[a];
      });
    }

    if (scene === 'hub') {
      var FROM = [[-90, -70], [150, -110], [420, -60], [470, 160], [400, 560], [140, 600], [-140, 440], [-130, 170]];
      each(root, '.tool', function (el) {
        var i = +el.dataset.i, k = ease((t - i * .03) / .45), f = FROM[i];
        put(el, lerp(f[0], (i % 4) * 102.67, k), lerp(f[1], Math.floor(i / 4) * 46 + 6, k));
      });
      each(root, '.hub-r', function (el) { on(el, t >= .5 + (+el.dataset.r) * .08); });
    }

    if (scene === 'board') {
      var card = root.querySelector('.kcard');
      var set = function (k, v) { card.querySelector('[data-k="' + k + '"]').textContent = v; };
      var btn = card.querySelector('[data-k="btn"]');
      var tab = t < .7 ? 0 : t < .8 ? 1 : t < .9 ? 2 : 3;
      each(root, '.tab', function (el) { on(el, +el.dataset.tab === tab); });
      var lane, state, who = '', label = '', pressed = false;
      if (tab === 0) {
        var mv = function (a, c, x, y) { return lerp(x, y, ease((t - a) / (c - a))); };
        if (t < .18) { lane = 0; state = 'Drafted by the Ops agent from 3 vendor quotes'; who = 'Arjun'; label = 'Approve plan'; pressed = t >= .1; }
        else if (t < .28) { lane = mv(.18, .28, 0, 1); state = 'Plan approved by Arjun'; }
        else if (t < .38) { lane = 1; state = 'Final: 400 units from Pune Fill & Pack'; who = 'Arjun'; label = 'Send PO'; pressed = t >= .32; }
        else if (t < .46) { lane = mv(.38, .46, 1, 2); state = 'Ops agent sent the PO and booked pickup'; }
        else if (t < .58) { lane = 2; state = 'Ops agent tracking delivery, due Friday'; who = 'Riya'; label = 'Check delivery'; pressed = t >= .52; }
        else if (t < .66) { lane = mv(.58, .66, 2, 3); state = 'Riya checked it: 400 received'; }
        else { lane = 3; state = 'Done. Stock cover back to 41 days'; }
        set('title', 'Purchase order: Vitamin C Serum, 400');
      } else {
        var o = BOARD_OTHER[tab];
        set('title', o[0]); lane = o[1]; state = o[2]; who = o[3]; label = o[4];
      }
      set('state', state); set('who', who);
      btn.textContent = label; btn.style.visibility = label ? 'visible' : 'hidden';
      btn.classList.toggle('is-pressed', pressed);
      card.style.transform = 'translateY(' + (42 + lane * 119.5 + 12).toFixed(1) + 'px)';
    }

    if (scene === 'today') {
      var n = Math.round(clamp((t - .06) / .34, 0, 1) * ASKED.length);
      root.querySelector('[data-typed]').textContent = ASKED.slice(0, n);
      root.querySelector('[data-send]').classList.toggle('is-pressed', t >= .44);
      on(root.querySelector('[data-answer]'), t >= .54);
    }
  }

  function fit(wrap, canvas) {
    var w = wrap.clientWidth, h = wrap.clientHeight || w * H / W;
    var s = Math.min(w / W, h / H, 1.5);
    var x = (w - W * s) / 2, y = Math.max(0, (h - H * s) / 2);
    if (w < 700) y = 0;
    return canvas.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) scale(' + s.toFixed(4) + ')';
  }

  var story = document.getElementById('story');
  var stage = story.querySelector('.stage');
  var caps = Array.prototype.slice.call(story.querySelectorAll('.cap'));
  var wrap = story.querySelector('.canvas-wrap'), canvas = document.getElementById('canvas');
  // on a phone, caption and canvas sit as one block, centred in the screen
  function fitMain() {
    stage.style.paddingTop = '';
    if (window.innerWidth <= 900) {
      var w = wrap.clientWidth, h = wrap.clientHeight, sc = Math.min(w / W, h / H, 1.5), left = h - H * sc;
      if (left > 8) stage.style.paddingTop = (parseFloat(getComputedStyle(stage).paddingTop) + left / 2).toFixed(1) + 'px';
    }
    fit(wrap, canvas);
  }
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  prep(canvas);

  if (reduce || /[?&]static\b/.test(location.search)) {
    // every beat, finished, stacked
    document.documentElement.classList.add('static');
    var pairs = [];
    caps.forEach(function (cap, b) {
      var block = document.createElement('div'); block.className = 'beat-block';
      var c = cap.cloneNode(true);
      var w2 = document.createElement('div'); w2.className = 'canvas-wrap'; w2.setAttribute('aria-hidden', 'true');
      var cv = canvas.cloneNode(true); cv.removeAttribute('id'); cv.querySelectorAll('[id]').forEach(function (x) { x.removeAttribute('id'); });
      w2.appendChild(cv); block.appendChild(c); block.appendChild(w2); stage.appendChild(block);
      draw(cv, b, 1); pairs.push([w2, cv]);
    });
    var refit = function () { pairs.forEach(function (p) { fit(p[0], p[1]); }); };
    window.addEventListener('resize', refit); refit();
  } else {
    var last = '';
    var frame = function () {
      var r = story.getBoundingClientRect(), span = story.offsetHeight - window.innerHeight;
      var p = clamp(-r.top / span, 0, 1), bf = p * BEATS;
      var b = Math.min(BEATS - 1, Math.floor(bf)), t = clamp((bf - b) / .85, 0, 1);
      var key = b + ':' + t.toFixed(3);
      if (key === last) return; last = key;
      caps.forEach(function (c, i) { on(c, i === b); });
      draw(canvas, b, t);
    };
    var tick = false;
    var onScroll = function () { if (!tick) { tick = true; requestAnimationFrame(function () { tick = false; frame(); }); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { fitMain(); last = ''; frame(); });
    fitMain(); frame();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitMain(); last = ''; frame(); });
  }

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
