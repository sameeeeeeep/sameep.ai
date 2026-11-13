/* pin-loader.js: a private show behind a sign-in, for the Chief of Staff landing (cos/reverse/scroll.html).
   Public and neutral on purpose: no brand, no names, no workspace ids. Everything private comes from the Worker
   after sign-in, to members only.

   Off unless the URL asks for it (/cos/#pin or /cos/?pin). Then:
   1. A lock screen: the time, faces drifting, and two ways in: the PIN (POST /d2c-api/auth/pin) or an emailed
      6-digit code (POST /d2c-api/auth/login, then /auth/verify; the Worker answers the same for every address).
      The session is the app's own (localStorage d2c.session), so "Open your workspace" lands signed in.
      A session that still works skips the lock screen.
   2. The show config comes from GET /d2c-api/w/:wid/landing. Every "@path" string in it is fetched with the
      session from /w/:wid/landing/asset/<path> and swapped for a blob URL (img, three.js textures and audio all
      take those).
   3. scroll.js asks for ./brands/<id>.json as usual; while the lock is up that fetch waits, then gets the config.
      scroll.js itself is unchanged: this file must load BEFORE it (a plain <script> in <head> or before scroll.js).
   4. After the story: the config's scope and pricing render under the ending (section#scope).
   Include line for scroll.html: <script src="./pin-loader.js?v=1"></script> (before the scroll.js script tag). */
(function () {
  'use strict';
  var q = new URLSearchParams(location.search);
  if (!/^#pin$/i.test(location.hash) && !q.has('pin')) return;

  /* scroll.js reads ?brand once; a neutral id keeps it off the public brands' faces and paths */
  q.set('pin', ''); q.set('brand', 'private');
  history.replaceState(null, '', location.pathname + '?' + q.toString().replace(/=(?=&|$)/g, ''));

  var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var API = (function () {
    var a = LOCAL && q.get('api');
    try { if (a && /^(localhost|127\.0\.0\.1)$/.test(new URL(a).hostname)) return new URL(a).origin + '/d2c-api'; } catch (e) { /* */ }
    return '/d2c-api';
  })();
  var TOKEN_KEY = 'd2c.session';
  var store = {
    get: function () { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } },
    set: function (t) { try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch (e) { /* */ } }
  };
  var mem = null;
  function token() { return mem || store.get(); }

  function api(method, path, body) {
    var t = token(), headers = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (t) headers.authorization = 'Bearer ' + t;
    return realFetch(API + path, { method: method, headers: headers, body: body === undefined ? undefined : JSON.stringify(body) })
      .catch(function () { var e = new Error('Can’t reach the server. Check your connection.'); e.status = 0; throw e; })
      .then(function (r) {
        return r.json().catch(function () { return null; }).then(function (d) {
          if (!r.ok) { var e = new Error((d && d.error) || 'Request failed (' + r.status + ').'); e.status = r.status; throw e; }
          return d;
        });
      });
  }

  /* ---------- the wait: scroll.js's config fetch is held until sign-in ---------- */
  var realFetch = window.fetch.bind(window);
  var release, held = new Promise(function (res) { release = res; });
  window.fetch = function (url, opts) {
    if (typeof url === 'string' && /(^|\/)brands\/[^/?]+\.json/.test(url)) {
      return held.then(function (cfg) { return new Response(JSON.stringify(cfg), { headers: { 'content-type': 'application/json' } }); });
    }
    return realFetch(url, opts);
  };

  /* ---------- styles: the lock screen, and scope + pricing ---------- */
  var css = [
    '.pl{position:fixed;inset:0;z-index:2147483000;display:grid;grid-template-rows:auto 1fr auto;justify-items:center;padding:clamp(28px,7vh,72px) 16px clamp(24px,5vh,48px);background:#1c2b31;color:#fff;font-family:"Bricolage Grotesque",system-ui,sans-serif;overflow:hidden;transition:opacity .5s,transform .5s}',
    '.pl.is-out{opacity:0;transform:scale(1.03);pointer-events:none}',
    '.pl p{margin:0}',
    '.pl-top{text-align:center;display:grid;gap:6px;position:relative;z-index:2}',
    '.pl-time{font-weight:600;font-size:clamp(64px,13vw,140px);line-height:1;letter-spacing:-.045em;font-variant-numeric:tabular-nums}',
    '.pl-date{font-weight:600;font-size:clamp(15px,2vw,20px);opacity:.9}',
    '.pl-field{position:absolute;inset:0;z-index:1;pointer-events:none}',
    '.pl-face{position:absolute;width:76px;height:76px;margin:-38px 0 0 -38px;border-radius:50%;overflow:hidden;background:rgba(255,255,255,.18);box-shadow:0 4px 16px rgba(0,0,0,.3),0 0 0 2px rgba(255,255,255,.55);opacity:0;transform:scale(.4);transition:opacity .7s,transform .7s cubic-bezier(.2,1.4,.4,1)}',
    '.pl-face.is-on{opacity:1;transform:scale(1)}',
    '.pl-face img{width:100%;height:100%;object-fit:cover;display:block;animation:pl-bob var(--d,5s) ease-in-out infinite}',
    '@keyframes pl-bob{50%{transform:translateY(-6px)}}',
    '.pl-bottom{position:relative;z-index:2;display:grid;justify-items:center;gap:10px;width:min(340px,100%);align-self:end}',
    '.pl-ask{font-weight:600;font-size:17px}',
    '.pl-form{display:flex;gap:8px;width:100%}',
    '.pl-in{flex:1;min-width:0;height:44px;padding:0 18px;border:0;border-radius:999px;background:rgba(255,255,255,.2);box-shadow:inset 0 0 0 1px rgba(255,255,255,.4);color:#fff;font:500 16px "Bricolage Grotesque",system-ui,sans-serif;outline:none}',
    '.pl-in::placeholder{color:rgba(255,255,255,.75)}',
    '.pl-in:focus{box-shadow:inset 0 0 0 1.5px #fff}',
    '.pl-in.is-code{letter-spacing:.35em;text-align:center;font-variant-numeric:tabular-nums}',
    '.pl-go{height:44px;padding:0 20px;border:0;border-radius:999px;background:#fff;color:#1c2b31;font:600 15px "Bricolage Grotesque",system-ui,sans-serif;cursor:pointer}',
    '.pl-go:disabled{opacity:.6;cursor:default}',
    '.pl-msg{min-height:1.4em;font-weight:500;font-size:14px;text-align:center;opacity:.92}',
    '.pl-alt{padding:6px 14px;min-height:32px;border:0;border-radius:999px;background:rgba(255,255,255,.14);color:#fff;font:500 14px "Bricolage Grotesque",system-ui,sans-serif;cursor:pointer}',
    '.pl-alt:hover,.pl-alt:focus-visible{background:rgba(255,255,255,.26);outline:none}',
    '@media (prefers-reduced-motion:reduce){.pl-face img{animation:none}.pl,.pl-face{transition:none}}',
    /* scope + pricing, on the page's light paper */
    '#scope{background:#f3f1ec;color:#1d1c1a;font-family:"Bricolage Grotesque",system-ui,sans-serif;padding:96px 16px 120px}',
    '#scope .sc{max-width:1040px;margin:0 auto}',
    '#scope h2{margin:0 0 12px;font-weight:600;font-size:clamp(32px,5vw,56px);line-height:1;letter-spacing:-.03em}',
    '#scope h3{margin:56px 0 16px;font-weight:600;font-size:22px}',
    '#scope p{margin:0}',
    '#scope .sc-lead{max-width:60ch;font-size:19px;line-height:1.5;color:#3d3a35}',
    '#scope .sc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}',
    '#scope .sc-card{padding:20px;border-radius:14px;background:#fff;box-shadow:0 0 0 1px #e3dfd6}',
    '#scope .sc-card b{display:block;font-weight:600;font-size:17px;margin-bottom:6px}',
    '#scope .sc-card span{display:block;font-size:15px;line-height:1.5;color:#4a463f}',
    '#scope .sc-meta{font-family:"Spline Sans Mono",ui-monospace,monospace;font-size:13px;color:#6b665c;margin-bottom:8px}',
    '#scope .sc-chips{display:flex;flex-wrap:wrap;gap:8px}',
    '#scope .sc-chips span{padding:6px 12px;border-radius:999px;background:#fff;box-shadow:0 0 0 1px #e3dfd6;font-size:15px}',
    '#scope .sc-steps{list-style:none;margin:0;padding:0;display:grid;gap:10px}',
    '#scope .sc-steps li{display:grid;grid-template-columns:120px 1fr;gap:16px;padding:16px 0;border-top:1px solid #e3dfd6;font-size:16px;line-height:1.5}',
    '#scope .sc-steps li span{font-family:"Spline Sans Mono",ui-monospace,monospace;font-size:14px;color:#6b665c}',
    '#scope .sc-price{font-weight:600;font-size:40px;letter-spacing:-.02em;margin:10px 0 2px}',
    '#scope .sc-plan ul{margin:14px 0 0;padding-left:18px;font-size:15px;line-height:1.6;color:#3d3a35}',
    '#scope .sc-plan.is-suggested{box-shadow:0 0 0 2px #1d1c1a}',
    '#scope .sc-tag{display:inline-block;margin-left:8px;font-family:"Spline Sans Mono",ui-monospace,monospace;font-size:12px;font-weight:500;color:#6b665c}',
    '#scope .sc-note{margin-top:16px;font-size:14px;color:#6b665c}',
    '#scope .sc-ctas{display:flex;flex-wrap:wrap;gap:10px;margin-top:56px}',
    '#scope .sc-cta{display:inline-flex;align-items:center;min-height:48px;padding:0 24px;border-radius:999px;background:#1d1c1a;color:#f3f1ec;font-weight:600;font-size:16px;text-decoration:none}',
    '#scope .sc-cta.is-2{background:transparent;color:#1d1c1a;box-shadow:inset 0 0 0 1.5px #1d1c1a}',
    '#scope .sc-prod{display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:center;margin-bottom:72px}',
    '#scope .sc-shades{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0 12px}',
    '#scope .sc-shades span{display:inline-flex;align-items:center;gap:8px;padding:6px 12px 6px 6px;border-radius:999px;background:#fff;box-shadow:0 0 0 1px #e3dfd6;font-size:15px}',
    '#scope .sc-shades i{width:20px;height:20px;border-radius:50%}',
    '#scope .sc-pics{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
    '#scope .sc-pics img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:14px;background:#fff;box-shadow:0 0 0 1px #e3dfd6}',
    '@media (max-width:760px){#scope .sc-prod{grid-template-columns:1fr}}',
    '@media (max-width:600px){#scope{padding:64px 16px 88px}#scope .sc-steps li{grid-template-columns:1fr;gap:4px}}'
  ].join('\n');
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var REF = /^@(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.[a-z0-9]+$/i;
  var MEDIA = /^(assets|audio|faces|images|media)$/;
  var TYPES = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', mp3: 'audio/mpeg' };
  function safeHref(v) {
    if (typeof v !== 'string' || !v) return '';
    try { var u = new URL(v, location.href); return /^(https?|mailto):$/.test(u.protocol) ? v : ''; } catch (e) { return ''; }
  }
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  /* ---------- the lock screen ---------- */
  var lock, msg, bottom, faceTimer = 0, clockTimer = 0;
  var base = (document.currentScript && document.currentScript.src) ? document.currentScript.src.replace(/[^/]*$/, '') : './';

  function buildLock() {
    lock = h('div', 'pl'); lock.setAttribute('role', 'dialog'); lock.setAttribute('aria-label', 'Sign in');
    var top = h('div', 'pl-top'), time = h('p', 'pl-time'), date = h('p', 'pl-date');
    top.appendChild(time); top.appendChild(date);
    function tick() {
      var d = new Date();
      time.textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, '');
      date.textContent = d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
    }
    tick(); clockTimer = setInterval(tick, 10000);
    var field = h('div', 'pl-field');
    bottom = h('div', 'pl-bottom');
    msg = h('p', 'pl-msg'); msg.setAttribute('role', 'status'); msg.setAttribute('aria-live', 'polite');
    lock.appendChild(top); lock.appendChild(h('div')); lock.appendChild(bottom); lock.appendChild(field);
    document.body.appendChild(lock);
    faces(field);
    askPin();
  }

  /* faces take turns around the edges, clear of the clock and the form */
  function faces(field) {
    var N = 9, spots = [[.12, .3], [.88, .28], [.2, .62], [.82, .64], [.08, .82], [.92, .84], [.32, .44], [.68, .46], [.5, .62]];
    if (innerWidth < 600) spots = [[.15, .34], [.85, .34], [.12, .56], [.88, .56], [.3, .46], [.7, .46]];
    var els = spots.map(function (p, i) {
      var f = h('span', 'pl-face'), im = h('img'); im.alt = ''; im.decoding = 'async';
      im.src = base + 'gate/f' + ((i % N) + 1) + '.webp';
      im.style.setProperty('--d', (4 + (i % 3)) + 's');
      f.style.left = (p[0] * 100) + '%'; f.style.top = (p[1] * 100) + '%';
      f.appendChild(im); field.appendChild(f);
      setTimeout(function () { f.classList.add('is-on'); }, 200 + i * 140);
      return f;
    });
    var next = spots.length;
    faceTimer = setInterval(function () {
      var f = els[Math.floor(Math.random() * els.length)];
      f.classList.remove('is-on');
      setTimeout(function () { f.firstChild.src = base + 'gate/f' + ((next++ % N) + 1) + '.webp'; f.classList.add('is-on'); }, 800);
    }, 2600);
  }

  function form(input, label, onSubmit) {
    var f = h('form', 'pl-form'); f.noValidate = true;
    var go = h('button', 'pl-go', label); go.type = 'submit';
    f.appendChild(input); f.appendChild(go);
    f.addEventListener('submit', function (e) {
      e.preventDefault(); go.disabled = true; input.disabled = true;
      Promise.resolve(onSubmit()).catch(function (x) {
        msg.textContent = x.message || 'That didn’t work. Try again.';
      }).then(function () { go.disabled = false; input.disabled = false; });
    });
    return f;
  }
  function inp(type, ph, extra) {
    var i = h('input', 'pl-in'); i.type = type; i.placeholder = ph; i.autocomplete = 'off'; i.required = true;
    Object.keys(extra || {}).forEach(function (k) { i.setAttribute(k, extra[k]); });
    return i;
  }
  function show(ask, f, alt) {
    bottom.replaceChildren(h('p', 'pl-ask', ask), f, msg);
    if (alt) bottom.appendChild(alt);
    setTimeout(function () { var i = f.querySelector('input'); if (i) i.focus({ preventScroll: true }); }, 60);
  }
  function altBtn(text, fn) { var b = h('button', 'pl-alt', text); b.type = 'button'; b.addEventListener('click', function () { msg.textContent = ''; fn(); }); return b; }

  function askPin() {
    var i = inp('password', 'PIN', { inputmode: 'numeric', pattern: '[0-9]*', maxlength: '12', 'aria-label': 'PIN' });
    show('Enter the PIN', form(i, 'Open', function () {
      msg.textContent = 'Checking…';
      return api('POST', '/auth/pin', { pin: i.value }).then(function (r) { signedIn(r.token, r.workspace); })
        .catch(function (x) { i.value = ''; throw x; });
    }), altBtn('Email me a code', askEmail));
  }
  var email = '', nonce = null;
  function askEmail() {
    var i = inp('email', 'you@company.com', { inputmode: 'email', autocomplete: 'email', 'aria-label': 'Work email' });
    i.value = email;
    show('Get a code by email', form(i, 'Send', function () {
      email = i.value.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) { msg.textContent = 'That doesn’t look like an email.'; return; }
      msg.textContent = 'Sending…';
      return api('POST', '/auth/login', { email: email }).then(function (r) { nonce = r && r.nonce; askCode(); });
    }), altBtn('Use the PIN', askPin));
  }
  function askCode() {
    var i = inp('text', '123456', { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '7', 'aria-label': '6-digit code' });
    i.classList.add('is-code');
    msg.textContent = 'If ' + email + ' has access, a 6-digit code is on its way. It lasts 15 minutes.';
    show('Check your email', form(i, 'Open', function () {
      msg.textContent = 'Checking…';
      return api('POST', '/auth/verify', { email: email, code: i.value.replace(/\s+/g, ''), nonce: nonce || undefined })
        .then(function (r) { signedIn(r.token, null); });
    }), altBtn('Use a different email', askEmail));
  }

  /* ---------- after sign-in: find the show, fetch its files, hand it to scroll.js ---------- */
  function signedIn(t, wid) {
    mem = t; store.set(t);
    msg.textContent = 'Opening…';
    return load(wid).catch(function (x) {
      if (x && x.status === 401) { mem = null; store.set(null); }
      msg.textContent = x && x.status === 404 ? 'This isn’t open for your account.' : (x.message || 'That didn’t open. Try again.');
      throw x;
    });
  }
  function findShow(wid) {
    if (wid) return api('GET', '/w/' + encodeURIComponent(wid) + '/landing').then(function (c) { return { wid: wid, cfg: c }; });
    return api('GET', '/me').then(function (m) {
      var ids = ((m && m.workspaces) || []).map(function (w) { return w.id; });
      var i = 0;
      function next() {
        if (i >= ids.length) { var e = new Error('This isn’t open for your account.'); e.status = 404; throw e; }
        var id = ids[i++];
        return api('GET', '/w/' + encodeURIComponent(id) + '/landing').then(function (c) { return { wid: id, cfg: c }; })
          .catch(function (x) { if (x.status === 404 || x.status === 403) return next(); throw x; });
      }
      return next();
    });
  }
  function load(wid) {
    return findShow(wid).then(function (r) {
      var refs = {};
      /* only media fields take files: kit images, faces, product pictures, chat photos, audio clips */
      (function walk(v, media) {
        if (typeof v === 'string') { if (media && REF.test(v)) refs[v] = 1; return; }
        if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { walk(v[k], media || MEDIA.test(k)); });
      })(r.cfg, false);
      var list = Object.keys(refs), done = 0, urls = {};
      var auth = { authorization: 'Bearer ' + token() };
      function one(ref) {
        var path = ref.slice(1).split('/').map(encodeURIComponent).join('/');
        return realFetch(API + '/w/' + encodeURIComponent(r.wid) + '/landing/asset/' + path, { headers: auth })
          .then(function (res) { if (!res.ok) throw new Error(res.status); return res.blob(); })
          .then(function (b) {
            var type = TYPES[ref.split('.').pop().toLowerCase()];
            if (!type || (b.type && b.type !== type)) throw new Error('type');
            urls[ref] = URL.createObjectURL(new Blob([b], { type: type }));
          }).catch(function () { urls[ref] = ''; })
          .then(function () { done++; msg.textContent = 'Loading ' + done + ' of ' + list.length; });
      }
      var q2 = list.slice(), workers = [];
      for (var k = 0; k < 6; k++) workers.push((function run() { var ref = q2.shift(); return ref ? one(ref).then(run) : null; })());
      return Promise.all(workers).then(function () {
        var cfg = (function swap(v, media) {
          if (typeof v === 'string') return media && Object.prototype.hasOwnProperty.call(urls, v) ? urls[v] : v;
          if (Array.isArray(v)) return v.map(function (x) { return swap(x, media); });
          if (v && typeof v === 'object') { var o = {}; Object.keys(v).forEach(function (k) { o[k] = swap(v[k], media || MEDIA.test(k)); }); return o; }
          return v;
        })(r.cfg, false);
        /* links from the config become hrefs here and in the ending: http(s) and mailto only */
        var end = cfg.end || {}, ln = end.links || {};
        Object.keys(ln).forEach(function (k) { if (!safeHref(ln[k])) delete ln[k]; });
        open(cfg);
      });
    });
  }
  function open(cfg) {
    clearInterval(faceTimer); clearInterval(clockTimer);
    if (lock) { lock.classList.add('is-out'); setTimeout(function () { lock.remove(); }, 600); }
    scrollTo(0, 0);
    release(cfg);
    afterEnding(cfg);
  }

  /* ---------- scope + pricing, under the ending ---------- */
  function afterEnding(cfg) {
    var sc = cfg.scope, pr = cfg.pricing, pd = cfg.product;
    if (!sc && !pr) return;
    var sec = h('section'); sec.id = 'scope';
    var w = h('div', 'sc'); sec.appendChild(w);
    if (pd) {
      var pw = h('div', 'sc-prod');
      var pt = h('div', 'sc-prod-t');
      pt.appendChild(h('h2', null, pd.name));
      if (pd.line) pt.appendChild(h('p', 'sc-lead', pd.line));
      var sh = h('div', 'sc-shades');
      (pd.shades || []).forEach(function (x) { var c = h('span'); var dot = h('i'); dot.style.background = x[1]; c.appendChild(dot); c.appendChild(document.createTextNode(x[0])); sh.appendChild(c); });
      pt.appendChild(sh);
      pt.appendChild(h('p', 'sc-meta', [pd.price, pd.size].filter(Boolean).join(' · ')));
      if (pd.pack) pt.appendChild(h('p', 'sc-note', pd.pack));
      pw.appendChild(pt);
      var pics = h('div', 'sc-pics');
      (pd.images || []).filter(Boolean).slice(0, 2).forEach(function (u) { var im = h('img'); im.src = u; im.alt = ''; im.decoding = 'async'; pics.appendChild(im); });
      pw.appendChild(pics); w.appendChild(pw);
    }
    if (sc) {
      w.appendChild(h('h2', null, sc.title || 'Scope'));
      if (sc.lead) w.appendChild(h('p', 'sc-lead', sc.lead));
      if (sc.inputs) {
        w.appendChild(h('h3', null, 'Where it picks work up'));
        var g = h('div', 'sc-grid'); sc.inputs.forEach(function (x) { var c = h('div', 'sc-card'); c.appendChild(h('b', null, x.name)); c.appendChild(h('span', null, x.text)); g.appendChild(c); }); w.appendChild(g);
      }
      if (sc.gg) {
        w.appendChild(h('h3', null, 'The founder’s own agent'));
        var c0 = h('div', 'sc-card'); c0.appendChild(h('b', null, sc.gg.name)); c0.appendChild(h('span', null, sc.gg.text)); w.appendChild(c0);
      }
      if (sc.teams) {
        w.appendChild(h('h3', null, 'Teams and workflows'));
        var g2 = h('div', 'sc-grid');
        sc.teams.forEach(function (x) { var c = h('div', 'sc-card'); c.appendChild(h('b', null, x.name)); c.appendChild(h('p', 'sc-meta', x.people)); c.appendChild(h('span', null, x.work)); g2.appendChild(c); });
        w.appendChild(g2);
      }
      [['Agents', sc.agents], ['Connected tools', sc.integrations]].forEach(function (p) {
        if (!p[1]) return;
        w.appendChild(h('h3', null, p[0]));
        var ch = h('div', 'sc-chips'); p[1].forEach(function (t) { ch.appendChild(h('span', null, t)); }); w.appendChild(ch);
      });
      if (sc.rollout) {
        w.appendChild(h('h3', null, 'Rollout'));
        var ol = h('ol', 'sc-steps');
        sc.rollout.forEach(function (x) { var li = h('li'); li.appendChild(h('span', null, x.when)); li.appendChild(h('p', null, x.what)); ol.appendChild(li); });
        w.appendChild(ol);
      }
    }
    if (pr) {
      w.appendChild(h('h3', null, pr.title || 'Pricing'));
      var g3 = h('div', 'sc-grid');
      (pr.plans || []).forEach(function (p) {
        var c = h('div', 'sc-card sc-plan' + (p.id === pr.suggested ? ' is-suggested' : ''));
        var nm = h('b', null, p.name); if (p.id === pr.suggested) nm.appendChild(h('span', 'sc-tag', 'Suggested'));
        c.appendChild(nm); c.appendChild(h('p', 'sc-price', p.start)); c.appendChild(h('span', null, p.then));
        var ul = h('ul'); (p.items || []).forEach(function (t) { ul.appendChild(h('li', null, t)); }); c.appendChild(ul);
        g3.appendChild(c);
      });
      w.appendChild(g3);
      if (pr.note) w.appendChild(h('p', 'sc-note', pr.note));
    }
    var links = (cfg.end || {}).links || {}, ws = (cfg.end || {}).workspace;
    var ctas = h('div', 'sc-ctas');
    var a1 = h('a', 'sc-cta', ((cfg.page || {}).cta || {}).demo || 'Open your workspace');
    a1.href = '../app/' + (ws ? '#/w/' + encodeURIComponent(ws) + '/today' : '');
    var a2 = h('a', 'sc-cta is-2', 'Talk to Sameep'); a2.href = safeHref(links.talk) || 'mailto:hello@sameep.ai';
    ctas.appendChild(a1); ctas.appendChild(a2); w.appendChild(ctas);
    function place() {
      var end = document.getElementById('end');
      if (end && end.parentNode) { end.parentNode.insertBefore(sec, end.nextSibling); return true; }
      return false;
    }
    if (!place()) document.addEventListener('DOMContentLoaded', place);
  }

  /* ---------- go ---------- */
  function start() {
    if (!document.body) return document.addEventListener('DOMContentLoaded', start);
    var t = store.get();
    if (!t) return buildLock();
    /* a session that still opens a show skips the lock screen */
    mem = t;
    findShow(null).then(function () { return load(null); }).catch(function () { mem = null; buildLock(); });
  }
  start();
})();
