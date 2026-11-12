// sameep.ai/brandclone: the scroll story (reversible: every frame is a pure function of scroll position)
// and the demo log-in (email -> 6-digit code -> /d2c-clone/app/).
(function () {
  var BEATS = 6, W = 520;
  var SCENE_OF = ['sort', 'sort', 'hub', 'ops', 'board', 'today'];
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var ease = function (x) { x = clamp(x, 0, 1); return x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var on = function (el, yes) { if (el) el.classList.toggle('is-on', !!yes); };

  // pile (beat 1) and group-room targets (beat 2), in the 520x520 design box
  var PILE = [[118, 120, -6], [150, 168, 4], [104, 214, -3], [160, 262, 5], [112, 308, -4], [146, 354, 3]];
  var GROUPS = ['website', 'performance', 'ops', 'content', 'finance', 'all'];
  var cardW = (W - 12) / 2, cardH = (W - 24) / 3;
  function roomOf(g) { var i = GROUPS.indexOf(g); return [(i % 2) * (cardW + 12) + 9, Math.floor(i / 2) * (cardH + 12) + 46]; }
  var TOOL_FROM = [[-20, 20], [300, -10], [420, 120], [440, 300], [330, 470], [60, 470], [-30, 330], [-40, 170]];
  function toolTo(i) { return [20 + (i % 4) * 122, 40 + Math.floor(i / 4) * 52]; }

  function money(v, f) {
    if (f === 'L') return '₹' + (v / 1e5).toFixed(2) + 'L';
    if (f === 'K') return '₹' + (v / 1e3).toFixed(1) + 'K';
    return String(Math.round(v));
  }

  // draw beat b at progress t (0..1) into one canvas root
  function draw(root, b, t) {
    var scene = SCENE_OF[b];
    root.querySelectorAll('.scene').forEach(function (s) { on(s, s.dataset.scene === scene); });

    if (scene === 'sort') {
      var groups = root.querySelector('.groups');
      groups.style.visibility = b === 1 ? 'visible' : 'hidden';
      root.querySelectorAll('.bub').forEach(function (el, i) {
        var p = PILE[i], x, y, r, sc = 1, shown;
        if (b === 0) { shown = t >= i / 7; x = p[0]; y = p[1]; r = p[2]; }
        else {
          shown = true;
          var k = ease((t - i * .07) / .5), to = roomOf(el.dataset.g);
          x = lerp(p[0], to[0], k); y = lerp(p[1], to[1], k); r = lerp(p[2], 0, k);
        }
        el.style.visibility = shown ? 'visible' : 'hidden';
        el.style.transform = 'translate(' + x + 'px,' + y + 'px) rotate(' + r + 'deg) scale(' + sc + ')';
      });
    }
    if (scene === 'hub') {
      var k2 = ease(t / .55);
      root.querySelectorAll('.tool').forEach(function (el, i) {
        var f = TOOL_FROM[i], to = toolTo(i);
        el.style.transform = 'translate(' + lerp(f[0], to[0], k2) + 'px,' + lerp(f[1], to[1], k2) + 'px)';
      });
      root.querySelectorAll('.hub-r').forEach(function (el, i) { on(el, t >= .6 + i * .09); });
    }
    if (scene === 'ops') {
      var steps = [.05, .3, .55];
      root.querySelectorAll('[data-m]').forEach(function (el) { on(el, t >= steps[+el.dataset.m]); });
      var po = root.querySelector('.po');
      po.style.transform = 'translateY(' + lerp(24, 0, ease((t - .55) / .2)) + 'px)';
    }
    if (scene === 'board') {
      var LANE_Y = function (l) { return 44 + l * 86; };
      root.querySelectorAll('.lane').forEach(function (el) { el.style.top = LANE_Y(+el.dataset.l) + 'px'; });
      var card = root.querySelector('.kcard'), act = root.querySelector('.k-act');
      var tab = t < .68 ? 0 : t < .78 ? 1 : t < .88 ? 2 : 3;
      root.querySelectorAll('.tab').forEach(function (el) { on(el, +el.dataset.tab === tab); });
      var setText = function (k, v) { card.querySelector('[data-k="' + k + '"]').textContent = v; };
      var lane, state, action = '';
      if (tab === 0) {
        // the Ops card walks the board; only the column moves need a person
        var mv = function (a, b) { return ease((t - a) / (b - a)); };
        lane = t < .14 ? 0 : t < .26 ? lerp(0, 1, mv(.14, .26)) : t < .3 ? 1 : t < .4 ? lerp(1, 2, mv(.3, .4)) : t < .52 ? 2 : lerp(2, 3, mv(.52, .62));
        state = t < .14 ? 'Waiting for approval' : t < .3 ? 'Approved by Arjun' : t < .52 ? 'Ops agent working' : 'Checked by Riya';
        action = t < .14 ? 'You approve the plan' : t < .3 ? 'Approved: the agent takes it from here' : t < .52 ? 'The agent does the work' : 'A second person checks it';
        setText('title', 'Purchase order: Vitamin C Serum, 400');
        card.querySelectorAll('.k-w').forEach(function (el) { on(el, t >= [.36, .46][+el.dataset.w] && t < .62); });
      } else {
        var other = [null, ['Hire: operations executive', 1, 'Shortlist of 6, waiting for interviews'], ['Ad: festive carousel, ₹40K', 2, 'Performance agent building 4 variants'], ['Campaign: festive sale launch', 0, 'Plan ready for your approval']][tab];
        setText('title', other[0]); lane = other[1]; state = other[2]; action = 'Same board, same moves';
        card.querySelectorAll('.k-w').forEach(function (el) { on(el, false); });
      }
      setText('state', state);
      card.classList.toggle('is-final', tab === 0 && t >= .14 && t < .52);
      card.classList.toggle('is-done', tab === 0 && t >= .62);
      card.style.transform = 'translateY(' + (LANE_Y(lane) + 8) + 'px)';
      act.textContent = action;
    }
    if (scene === 'today') {
      var c = ease(t / .6);
      root.querySelectorAll('[data-count]').forEach(function (el) { el.textContent = money(+el.dataset.count * c, el.dataset.fmt); });
      root.querySelectorAll('.n-r').forEach(function (el) { on(el, t >= .62 + (+el.dataset.n) * .1); });
    }
  }

  function fit(wrap, canvas) {
    var s = Math.min(wrap.clientWidth, wrap.clientHeight || wrap.clientWidth) / W;
    canvas.style.transform = 'scale(' + s + ')';
  }

  var story = document.getElementById('story');
  var stage = story.querySelector('.stage');
  var caps = story.querySelectorAll('.caps .cap');
  var wrap = story.querySelector('.canvas-wrap');
  var canvas = document.getElementById('canvas');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]still\b/.test(location.search);

  if (reduce) {
    // stacked and finished: one block per beat, each with its own copy of the canvas
    document.documentElement.classList.add('static');
    var frag = document.createDocumentFragment();
    for (var b = 0; b < BEATS; b++) {
      var block = document.createElement('div'); block.className = 'beat-block';
      block.appendChild(caps[b].cloneNode(true));
      var w2 = wrap.cloneNode(true); w2.querySelector('.canvas').removeAttribute('id');
      block.appendChild(w2); frag.appendChild(block);
    }
    stage.innerHTML = ''; stage.appendChild(frag);
    var fitAll = function () {
      stage.querySelectorAll('.beat-block').forEach(function (bl, i) {
        var w = bl.querySelector('.canvas-wrap'), c = bl.querySelector('.canvas'); fit(w, c); draw(c, i, i === 4 ? .64 : 1);
      });
    };
    fitAll(); window.addEventListener('resize', fitAll);
  } else {
    var last = '';
    var frame = function () {
      var r = story.getBoundingClientRect();
      var span = story.offsetHeight - window.innerHeight;
      var p = clamp(-r.top / span, 0, .99999) * BEATS;
      var b = Math.floor(p), t = p - b;
      var key = b + ':' + t.toFixed(3);
      if (key === last) return; last = key;
      caps.forEach(function (c, i) { on(c, i === b); });
      draw(canvas, b, t);
    };
    var tick = false;
    var onScroll = function () { if (!tick) { tick = true; requestAnimationFrame(function () { tick = false; frame(); }); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { fit(wrap, canvas); last = ''; frame(); });
    fit(wrap, canvas); frame();
  }

  // ── demo log-in ───────────────────────────────────────────────────────
  var qs = new URLSearchParams(location.search);
  var local = ['localhost', '127.0.0.1'].indexOf(location.hostname) >= 0;
  var API = '/d2c-api';
  if (local && qs.get('api')) {
    try { var u = new URL(qs.get('api')); if (['localhost', '127.0.0.1'].indexOf(u.hostname) >= 0) API = u.origin + '/d2c-api'; } catch (e) {}
  }
  var lf = document.getElementById('lf'), cf = document.getElementById('cf'), msg = document.getElementById('lf-msg');
  var email = '';

  function say(text, withMail) {
    msg.textContent = text;
    if (withMail) {
      msg.textContent = 'Demo logins open soon. Email ';
      var a = document.createElement('a'); a.href = 'mailto:hello@sameep.ai?subject=' + encodeURIComponent('Brand Clone demo'); a.textContent = 'hello@sameep.ai';
      msg.appendChild(a); msg.appendChild(document.createTextNode(" and I'll set yours up."));
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say('Enter your work email.'); return; }
    busy(lf, true); say('Sending your code…');
    try {
      var r = await post('/auth/login', { email: email });
      if (r.status === 404 || r.status >= 500) { say('', true); return; }
      if (r.status === 429) { say('Too many tries. Wait a few minutes and try again.'); return; }
      if (r.status >= 400) { say((r.body && r.body.error) || 'That didn’t work. Check the email and try again.'); return; }
      document.getElementById('cf-to').textContent = email;
      lf.hidden = true; cf.hidden = false; say('If this email has a demo, a code is on its way. It works for 15 minutes.');
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
      var token = r.body && (r.body.token || r.body.session);
      if (r.status >= 400 || !token) { say('That code didn’t work. Check it, or use a different email to get a new one.'); return; }
      try { localStorage.setItem('d2c.session', token); } catch (err) {}
      location.href = '../d2c-clone/app/#token=' + encodeURIComponent(token);
    } catch (err) { say('', true); }
    finally { busy(cf, false); }
  });

  document.getElementById('cf-back').addEventListener('click', function () { cf.hidden = true; lf.hidden = false; cf.code.value = ''; say(''); lf.email.focus(); });
})();
