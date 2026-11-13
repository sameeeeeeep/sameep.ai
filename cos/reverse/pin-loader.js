/* pin-loader.js: a private show behind a sign-in, for the Chief of Staff landing (cos/reverse/scroll.html).
   Public and neutral on purpose: no brand, no names, no workspace ids. Everything private comes from the Worker
   after sign-in, to members only.

   Off unless the URL asks for it (/cos/#pin, /cos/?pin or /cos/?version=<any>). Then:
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
  /* ?version=<anything> is a shareable alias for the lock: the value is never read or matched here, so no client
     name lives in this file; the PIN decides which workspace opens */
  if (!/^#pin$/i.test(location.hash) && !q.has('pin') && !q.get('version')) return;

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
    /* the sameep.ai lock screen's lobby: round faces that drift, bob and take turns popping in */
    '.pl-face{position:absolute;width:var(--s,76px);height:var(--s,76px);margin:calc(var(--s,76px) / -2) 0 0 calc(var(--s,76px) / -2);animation:pl-drift var(--dd,16s) ease-in-out var(--dl,0s) infinite alternate;opacity:var(--o,1)}',
    '.pl-face i{display:block;width:100%;height:100%;border-radius:50%;overflow:hidden;background:rgba(255,255,255,.22);box-shadow:0 4px 16px rgba(0,0,0,.3),0 0 0 2px rgba(255,255,255,.4);transform:scale(0);transition:transform .7s ease}',
    '.pl-face.is-on i{animation:pl-pop .75s cubic-bezier(.2,1.6,.4,1) both,pl-bob var(--d,5s) ease-in-out .75s infinite}',
    '.pl-face.is-off i{transform:scale(.3);opacity:0;transition:transform .7s ease,opacity .7s ease}',
    '.pl-face img{width:100%;height:100%;object-fit:cover;display:block}',
    '@keyframes pl-bob{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-9px) rotate(2deg)}}',
    '@keyframes pl-pop{0%{transform:scale(0) rotate(-24deg)}70%{transform:scale(1.18) rotate(4deg)}100%{transform:scale(1) rotate(0)}}',
    '@keyframes pl-drift{0%{translate:0 0}50%{translate:var(--dx,18px) var(--dy,-12px)}100%{translate:calc(var(--dx,18px) * -.6) calc(var(--dy,-12px) * -.8)}}',
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
    '@media (prefers-reduced-motion:reduce){.pl-face,.pl-face.is-on i{animation:none;transform:none}.pl{transition:none}}',
    /* v2: floating bubbles on a light page, the sign-in in a card in the middle */
    '.pl{grid-template-rows:1fr;place-items:center;padding:16px;background:#f4f3ef;color:#15171c}',
    '.pl-b{position:absolute;left:0;top:0;will-change:transform}',
    '.pl-b i{display:block;width:100%;height:100%;border-radius:50%;overflow:hidden;background:#e7e3db;box-shadow:0 10px 26px -12px rgba(21,23,28,.35),0 0 0 3px rgba(255,255,255,.9);opacity:calc(.55 + var(--z,1) * .45);transform:scale(0);transition:transform .8s cubic-bezier(.2,1.5,.4,1)}',
    '.pl-b.is-on i{transform:scale(1);animation:pl-bob var(--bd,5s) ease-in-out var(--bl,0s) infinite}',
    '.pl-b img{width:100%;height:100%;object-fit:cover;display:block}',
    '.pl-card{align-self:center;width:min(380px,100%);padding:26px 24px 20px;border-radius:24px;background:rgba(255,255,255,.92);box-shadow:0 1px 0 rgba(21,23,28,.06),0 30px 60px -30px rgba(21,23,28,.35),0 0 0 1px rgba(21,23,28,.06)}',
    '.pl .pl-ask{font-size:20px;letter-spacing:-.01em}',
    '.pl .pl-in{background:#f4f3ef;box-shadow:inset 0 0 0 1px #d3d3cc;color:#15171c}',
    '.pl .pl-in::placeholder{color:#8b8f99}',
    '.pl .pl-in:focus{box-shadow:inset 0 0 0 1.5px #15171c}',
    '.pl .pl-go{background:#15171c;color:#fff}',
    '.pl .pl-alt{background:transparent;color:#3a3f4a;text-decoration:underline;text-underline-offset:3px}',
    '.pl .pl-alt:hover,.pl .pl-alt:focus-visible{background:#ece9e2}',
    '.pl .pl-load-b{background:#e3e3de}.pl .pl-load-b i{background:#15171c}',
    '@media (prefers-reduced-motion:reduce){.pl-b.is-on i{animation:none}}',
    /* scope + pricing, on the page's light paper */
    '.pl-load-t{display:block}.pl-load-b{display:block;width:min(240px,70vw);height:3px;margin:10px auto 0;border-radius:2px;background:rgba(255,255,255,.18);overflow:hidden}.pl-load-b i{display:block;height:100%;background:#fff;transform-origin:0 50%;transform:scaleX(0);transition:transform .3s ease}',
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
    /* light and airy: faces float as bubbles; the sign-in card sits in the middle */
    var field = h('div', 'pl-field');
    bottom = h('div', 'pl-bottom pl-card');
    msg = h('p', 'pl-msg'); msg.setAttribute('role', 'status'); msg.setAttribute('aria-live', 'polite');
    lock.appendChild(field); lock.appendChild(bottom);
    document.body.appendChild(lock);
    faces(field);
    askPin();
  }

  /* the faces float as soft bubbles: slow drift, a gentle bob, soft bumps off each other, the edges and the card,
     and a little parallax with the pointer (near ones move more). Faces only: gate/f1..f5. */
  var stopBubbles = function () {};
  function faces(field) {
    var N = 5, phone = innerWidth < 600, n = phone ? 9 : 14, W = innerWidth, H = innerHeight, still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var B = [], mx = 0, my = 0, raf = 0, last = performance.now();
    for (var i = 0; i < n; i++) {
      var r = (phone ? 26 : 34) + ((i * 37) % 7) * (phone ? 6 : 9), z = r / (phone ? 62 : 88);
      var el = h('span', 'pl-b'), w = h('i'), im = h('img'); im.alt = ''; im.decoding = 'async';
      im.src = base + 'gate/f' + ((i % N) + 1) + '.webp';
      el.style.width = el.style.height = (2 * r) + 'px'; el.style.setProperty('--z', z.toFixed(2)); el.style.setProperty('--bd', (4 + (i % 4) * .8) + 's'); el.style.setProperty('--bl', -(i * .9) + 's');
      w.appendChild(im); el.appendChild(w); field.appendChild(el);
      var ang = i * 2.399, sp = (phone ? 10 : 14) + (i % 5) * 3;
      B.push({ el: el, r: r, z: z, x: W * (.08 + .84 * ((i * .618) % 1)), y: H * (.1 + .8 * ((i * .382 + .17) % 1)), vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp });
      (function (e, d) { setTimeout(function () { e.classList.add('is-on'); }, d); })(el, 120 + i * 90);
    }
    function onMove(e) { mx = (e.clientX / W - .5); my = (e.clientY / H - .5); }
    addEventListener('pointermove', onMove, { passive: true });
    function onResize() { W = innerWidth; H = innerHeight; }
    addEventListener('resize', onResize);
    function card() { var c = bottom && bottom.getBoundingClientRect(); return c ? { x: c.left + c.width / 2, y: c.top + c.height / 2, w: c.width / 2 + 18, hh: c.height / 2 + 18 } : null; }
    function step(now) {
      var dt = Math.min(.05, (now - last) / 1000); last = now;
      var C = card();
      B.forEach(function (b) {
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); } if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
        if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); } if (b.y > H - b.r) { b.y = H - b.r; b.vy = -Math.abs(b.vy); }
        if (C) {   /* the card is a soft wall: push out and turn away */
          var dx = b.x - C.x, dy = b.y - C.y, ox = C.w + b.r - Math.abs(dx), oy = C.hh + b.r - Math.abs(dy);
          if (ox > 0 && oy > 0) { if (ox < oy) { b.x += (dx < 0 ? -ox : ox); b.vx = (dx < 0 ? -1 : 1) * Math.abs(b.vx); } else { b.y += (dy < 0 ? -oy : oy); b.vy = (dy < 0 ? -1 : 1) * Math.abs(b.vy); } }
        }
      });
      for (var i = 0; i < B.length; i++) for (var j = i + 1; j < B.length; j++) {   /* gentle bumps */
        var a = B[i], c = B[j], dx = c.x - a.x, dy = c.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1, m = a.r + c.r + 6;
        if (d < m) {
          var nx = dx / d, ny = dy / d, push = (m - d) / 2;
          a.x -= nx * push; a.y -= ny * push; c.x += nx * push; c.y += ny * push;
          var rv = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
          if (rv < 0) { a.vx += rv * nx * .9; a.vy += rv * ny * .9; c.vx -= rv * nx * .9; c.vy -= rv * ny * .9; }
        }
      }
      B.forEach(function (b) {
        var px = -mx * 26 * b.z, py = -my * 18 * b.z;
        b.el.style.transform = 'translate3d(' + (b.x - b.r + px).toFixed(1) + 'px,' + (b.y - b.r + py).toFixed(1) + 'px,0)';
      });
      raf = requestAnimationFrame(step);
    }
    if (still) { B.forEach(function (b) { b.el.style.transform = 'translate3d(' + (b.x - b.r) + 'px,' + (b.y - b.r) + 'px,0)'; }); }
    else raf = requestAnimationFrame(step);
    stopBubbles = function () { cancelAnimationFrame(raf); removeEventListener('pointermove', onMove); removeEventListener('resize', onResize); };
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
  /* a calm progress line while the workspace's files load: a bar and a count, never a raw '3 of 59' */
  function progress(n, total) {
    if (!msg) return;
    if (!msg._bar) { msg.textContent = ''; msg._t = document.createElement('span'); msg._t.className = 'pl-load-t'; msg.appendChild(msg._t);
      var b = document.createElement('span'); b.className = 'pl-load-b'; msg._bar = document.createElement('i'); b.appendChild(msg._bar); msg.appendChild(b); }
    msg._t.textContent = n >= total ? 'Opening the workspace' : 'Opening the workspace · ' + Math.round(100 * n / Math.max(1, total)) + '%';
    msg._bar.style.transform = 'scaleX(' + (n / Math.max(1, total)).toFixed(3) + ')';
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
      /* images first, so the bar moves quickly; the bigger audio clips come last */
      list.sort(function (a, b) { return (/\.mp3$/i.test(a) ? 1 : 0) - (/\.mp3$/i.test(b) ? 1 : 0); });
      progress(0, list.length);
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
          .then(function () { done++; progress(done, list.length); });
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
  /* agents are plain named roles with a neutral monogram in a private show (no mascots): the engine's agent
     marks and names are rewritten as they render */
  var ROLE = { Minutes: 'Meetings', Scout: 'Hiring', Patch: 'Research', Haggle: 'Purchasing', Sprint: 'Projects', Quill: 'Content',
    Polish: 'Website', Mango: 'Ads', Crate: 'Warehouse', Ink: 'Support', Boss: 'Chief of Staff' };
  function neutralAgents() {
    var st2 = document.createElement('style');
    st2.textContent = '.cat img{display:none!important}.cat{background:#1d1c1a!important;color:#f3f1ec;font:600 12px/1 "Bricolage Grotesque",system-ui,sans-serif}.cat::after{content:attr(data-m)}';
    document.head.appendChild(st2);
    function fix(root) {
      if (!root.querySelectorAll) return;
      var cats = root.classList && root.classList.contains('cat') ? [root] : [];
      Array.prototype.push.apply(cats, root.querySelectorAll('.cat'));
      cats.forEach(function (c) {
        if (c.getAttribute('data-m')) return;
        var row = c.parentNode, name = row && row.querySelector && row.querySelector('b');
        var t = name ? name.textContent : '';
        c.setAttribute('data-m', t === 'Chief of Staff' || !t ? 'C' : t.charAt(0));
      });
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n, list = [];
      while ((n = walker.nextNode())) list.push(n);
      list.forEach(function (tn) {
        var v = tn.nodeValue, w = v;
        var m0 = v.match(/^(\s*)([A-Z][a-z]+)(?=$|\s+(is|has|did|picked|caught|sent|on)\b|\s*$)/);
        if (m0 && Object.prototype.hasOwnProperty.call(ROLE, m0[2])) w = m0[1] + (ROLE[m0[2]] === 'Chief of Staff' ? 'Chief of Staff' : ROLE[m0[2]] + ' agent') + v.slice(m0[0].length);
        w = w.replace(/\b(\w+) cat\b/g, '$1 agent').replace(/\bcats?\b/gi, function (m) { return m[0] === 'C' ? 'Agent' : 'agent'; });
        if (w !== v) tn.nodeValue = w;
      });
      cats.forEach(function (c) {
        var b2 = c.parentNode && c.parentNode.querySelector && c.parentNode.querySelector('b');
        if (b2) c.setAttribute('data-m', b2.textContent === 'Chief of Staff' ? 'C' : b2.textContent.charAt(0));
      });
    }
    new MutationObserver(function (ms) { ms.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (x) { if (x.nodeType === 1) fix(x); }); }); })
      .observe(document.body, { childList: true, subtree: true });
    fix(document.body);
  }
  function open(cfg) {
    neutralAgents();
    clearInterval(faceTimer); clearInterval(clockTimer); stopBubbles();
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
