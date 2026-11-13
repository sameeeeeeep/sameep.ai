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
    /* v3: the sameep.ai lobby (css/app.css .lock): dark blurred room, clock, faces in loose rows, name box */
    '.pl-lobby{grid-template-rows:auto 1fr auto;place-items:initial;justify-items:center;gap:8px;padding:clamp(24px,6vh,64px) 16px clamp(20px,4vh,36px);color:#fff;text-shadow:0 1px 12px rgba(0,0,0,.35);background:radial-gradient(40vmax 30vmax at 18% 22%,rgba(64,96,104,.55),transparent 70%),radial-gradient(36vmax 28vmax at 82% 70%,rgba(52,70,92,.6),transparent 70%),radial-gradient(30vmax 24vmax at 60% 12%,rgba(40,66,72,.5),transparent 70%),radial-gradient(28vmax 22vmax at 12% 86%,rgba(60,80,70,.45),transparent 70%),#142027}',
    '.pl-lobby .pl-top{gap:6px;justify-items:center}',
    '.pl-online{display:inline-flex;align-items:center;gap:7px;margin-top:4px!important;padding:4px 11px;border-radius:999px;background:rgba(255,255,255,.16);font-weight:600;font-size:13px;text-shadow:none}',
    '.pl-online::before{content:"";width:8px;height:8px;border-radius:50%;background:#5df07a;box-shadow:0 0 8px #5df07a;animation:pl-pulse 1.6s ease-in-out infinite}',
    '@keyframes pl-pulse{50%{opacity:.35}}',
    '.pl-lobby .pl-field{position:absolute;inset:0;z-index:1;pointer-events:none}',
    '.pl-user{position:absolute;left:0;top:0;width:calc(var(--bub,50px) * 2.3);display:grid;justify-items:center;gap:6px;padding:0;border:0;background:none;color:#fff;font-family:inherit;cursor:pointer;pointer-events:auto;-webkit-tap-highlight-color:transparent}',
    '.pl-user[hidden]{display:none}',
    '.pl-user>*{transition:scale .25s ease,opacity .3s,box-shadow .25s}',
    '.pl-av{width:calc(var(--bub,50px) * 1.41);height:calc(var(--bub,50px) * 1.41);border-radius:50%;overflow:hidden;display:grid;place-items:center;background:rgba(255,255,255,.22);box-shadow:0 4px 16px rgba(0,0,0,.3),0 0 0 2px rgba(255,255,255,.4);transform:scale(0)}',
    '.pl-av img{width:100%;height:100%;object-fit:cover;display:block}',
    '.pl-av.is-ini{background:linear-gradient(150deg,hsl(var(--hue) 28% 60%),hsl(calc(var(--hue) + 30) 24% 44%))}',
    '.pl-glyph{font:500 calc(var(--bub,50px) * .5)/1 "Bricolage Grotesque",system-ui,sans-serif;color:#fff}',
    '.pl-user.is-in .pl-av{animation:pl-pop .75s cubic-bezier(.2,1.6,.4,1) both,pl-bob var(--d,5s) ease-in-out .75s infinite;transform:none}',
    '.pl-name{font-weight:600;font-size:13.5px;line-height:1.2;text-align:center;text-shadow:0 1px 6px rgba(0,0,0,.45);opacity:0;transition:opacity .4s .3s}',
    '.pl-user.is-in .pl-name{opacity:1}',
    '.pl-user:hover .pl-av,.pl-user:focus-visible .pl-av{scale:1.08;box-shadow:0 6px 22px rgba(0,0,0,.35),0 0 0 3px #fff}',
    '.pl-user:focus-visible{outline:none}',
    '.pl-user.is-picked .pl-av{animation-play-state:paused;box-shadow:0 0 0 4px #3ddc84,0 0 28px rgba(61,220,132,.75);scale:1.12}',
    '.pl-user.is-picked .pl-name{color:#3ddc84}',
    '.pl-field.has-pick .pl-user:not(.is-picked)>*{opacity:.25}',
    '.pl-lobby .pl-bottom{grid-row:3;align-self:end;width:min(360px,100%);gap:8px}',
    '.pl-lobby .pl-ask{font-weight:600;font-size:20px;line-height:1.2;text-align:center}',
    '.pl-lobby .pl-form{position:relative;display:block}',
    '.pl-lobby .pl-in{width:100%;height:44px;padding:0 48px;border-radius:999px;background:rgba(255,255,255,.22);box-shadow:inset 0 0 0 1px rgba(255,255,255,.35);color:#fff;text-align:center;font-size:16px}',
    '.pl-lobby .pl-in::placeholder{color:rgba(255,255,255,.78)}',
    '.pl-lobby .pl-in:focus{box-shadow:inset 0 0 0 1.5px #fff}',
    '.pl-lobby .pl-go{position:absolute;right:3px;top:3px;width:38px;height:38px;padding:0;border-radius:50%;background:rgba(255,255,255,.9);color:#123;font:700 17px/1 system-ui,sans-serif}',
    '.pl-lobby .pl-msg{min-height:1.3em;font-size:13px;opacity:.85}',
    '.pl-lobby .pl-alt{min-height:36px;padding:0 16px;border-radius:999px;background:rgba(255,255,255,.14);color:#fff;font-size:13px;text-decoration:none}',
    '.pl-lobby .pl-alt:hover,.pl-lobby .pl-alt:focus-visible{background:rgba(255,255,255,.26);box-shadow:inset 0 0 0 1.5px #fff}',
    '@media (max-width:500px){.pl-name{font-size:12px;max-width:calc(var(--bub,40px) * 2.2)}}',
    '@media (prefers-reduced-motion:reduce){.pl-user.is-in .pl-av{animation:none}.pl-online::before{animation:none}.pl-user.is-picked .pl-av{scale:none}}',
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

  /* the lobby, as on the sameep.ai lock screen: a dark blurred room, the big clock, everyone as a round face
     in loose rows (each bobbing on its own beat), "Find your face" at the bottom. Tap your face: it goes green
     and the PIN box opens. Any face works, so someone not on the team still gets in with the PIN.
     Faces only (gate/f1..f5); each is labelled by role, never by name. */
  var PEOPLE = [
    { f: 1, role: 'Founder' }, { f: 2, role: 'Chief of Staff' }, { f: 3, role: 'Founder’s office' },
    { f: 4, role: 'Content and social' }, { f: 5, role: 'Product analyst' }, { ini: 'H', role: 'Influencer marketing', hue: 330 }
  ];
  var field, top, users = [], picked = null, R = 50;
  function buildLock() {
    lock = h('div', 'pl pl-lobby'); lock.setAttribute('role', 'dialog'); lock.setAttribute('aria-label', 'Sign in');
    top = h('div', 'pl-top');
    var time = h('p', 'pl-time'), date = h('p', 'pl-date'), pill = h('p', 'pl-online', PEOPLE.length + ' people in the workspace');
    function tick() { var d = new Date(); time.textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, ''); date.textContent = d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }); }
    tick(); clockTimer = setInterval(tick, 15000);
    top.appendChild(time); top.appendChild(date); top.appendChild(pill);
    field = h('div', 'pl-field'); field.setAttribute('role', 'listbox'); field.setAttribute('aria-label', 'The team');
    bottom = h('div', 'pl-bottom');
    msg = h('p', 'pl-msg'); msg.setAttribute('role', 'status'); msg.setAttribute('aria-live', 'polite');
    lock.appendChild(top); lock.appendChild(field); lock.appendChild(bottom);
    document.body.appendChild(lock);
    PEOPLE.forEach(function (m, i) {
      var u = h('button', 'pl-user'); u.type = 'button'; u.setAttribute('role', 'option'); u.setAttribute('aria-label', m.role);
      var fc = h('span', 'pl-av');
      if (m.f) { var im = h('img'); im.alt = ''; im.decoding = 'async'; im.width = im.height = 120; im.src = base + 'gate/f' + m.f + '.webp'; fc.appendChild(im); }
      else { fc.classList.add('is-ini'); fc.style.setProperty('--hue', m.hue); fc.appendChild(h('span', 'pl-glyph', m.ini)); }
      u.appendChild(fc); u.appendChild(h('span', 'pl-name', m.role));
      u.style.setProperty('--d', (4.2 + ((i * 7) % 30) / 10) + 's'); u.style.setProperty('--dl', (-((i * 13) % 50) / 10) + 's');
      u.addEventListener('click', function () { choose(u); });
      field.appendChild(u); users.push(u);
      (function (e, d) { setTimeout(function () { e.classList.add('is-in'); }, d); })(u, 150 + i * 110);
    });
    askFace();
    place();
    addEventListener('resize', place);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
  }
  /* the lobby's grid (era.js): a staggered grid over the screen minus the clock and the name box, each slot
     nudged a little off true, sorted middle-out; one face per slot */
  function place() {
    if (!field || !lock.isConnected) return;
    var F = field.getBoundingClientRect(), W = F.width, H = F.height, narrow = W < 500, PAD = 12, FOOT = 1.55;
    R = narrow ? 42 : 60;
    field.style.setProperty('--bub', R + 'px');
    var zones = [top, bottom].map(function (z) { var r = z.getBoundingClientRect(); return { l: r.left - F.left - PAD, t: r.top - F.top - PAD, r: r.right - F.left + PAD, b: r.bottom - F.top + PAD }; });
    /* a small team: rows of three, centred in the clear band between the clock and the name box,
       each face nudged a little off true and every other row offset half a step, as the lobby does */
    var per = narrow ? 2 : 3, rows = Math.ceil(users.length / per), sx = R * (narrow ? 2.9 : 2.9), sy = R * (1 + FOOT) + (narrow ? 18 : 30);
    var band0 = zones[0].b + R, band1 = zones[1].t - R * FOOT, cy = (band0 + band1) / 2;
    sy = Math.min(sy, rows > 1 ? (band1 - band0) / (rows - 1) : sy);
    var cells = [];
    for (var r = 0; r < rows; r++) {
      var n = Math.min(per, users.length - r * per), y = cy + (r - (rows - 1) / 2) * sy, off = (r % 2 ? 1 : -1) * sx * .18;
      for (var c = 0; c < n; c++) {
        var k = r * 31 + c * 17;
        cells.push({ x: W / 2 + (c - (n - 1) / 2) * sx + off + ((k % 7) - 3) * R * .06, y: y + ((k % 5) - 2) * R * .1 });
      }
    }
    users.forEach(function (u, i) {
      var cell = cells[i];
      u.hidden = !cell;
      if (cell) u.style.transform = 'translate3d(' + (cell.x - R * 1.15).toFixed(1) + 'px,' + (cell.y - R).toFixed(1) + 'px,0)';
    });
  }
  function choose(u) {
    users.forEach(function (x) { x.classList.toggle('is-picked', x === u); x.setAttribute('aria-selected', x === u ? 'true' : 'false'); });
    field.classList.add('has-pick');
    if (!picked) { picked = u; askPin(); } else { picked = u; var i = bottom.querySelector('input'); if (i) i.focus({ preventScroll: true }); }
  }
  /* first screen: the ask, and the PIN box already there for anyone who knows it */
  function askFace() {
    var i = inp('password', 'Or type the PIN', { inputmode: 'numeric', pattern: '[0-9]*', maxlength: '12', 'aria-label': 'PIN' });
    show('Find your face', pinForm(i), altBtn('Email me a code', askEmail), true);
  }
  function pinForm(i) {
    return form(i, '→', function () {
      msg.textContent = 'Checking…';
      return api('POST', '/auth/pin', { pin: i.value }).then(function (r) { signedIn(r.token, r.workspace); })
        .catch(function (x) { i.value = ''; throw x; });
    });
  }
  var stopBubbles = function () { clearInterval(clockTimer); removeEventListener('resize', place); };

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
  function show(ask, f, alt, soft) {
    bottom.replaceChildren(h('p', 'pl-ask', ask), f, msg);
    if (alt) bottom.appendChild(alt);
    if (soft && !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    setTimeout(function () { var i = f.querySelector('input'); if (i) i.focus({ preventScroll: true }); }, 60);
  }
  function altBtn(text, fn) { var b = h('button', 'pl-alt', text); b.type = 'button'; b.addEventListener('click', function () { msg.textContent = ''; fn(); }); return b; }

  function askPin() {
    var i = inp('password', 'PIN', { inputmode: 'numeric', pattern: '[0-9]*', maxlength: '12', 'aria-label': 'PIN' });
    show('Enter the PIN', pinForm(i), altBtn('Email me a code', askEmail));
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
