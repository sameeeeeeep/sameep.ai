/* ending.js: the show's last beat. After the story closes on the delivered box, the company's own team
   appears face-down (brand name + role) and the cards turn over one by one as they scroll into view, each
   revealing that person's login, styled like the brandcos app. Then three CTAs.

   window.renderEnding(config, root) appends one <section class="fin"> to root and returns it.
   Data: config.team = [{ name, role, initial, waiting, email? }], config.end = { line, workspace, links? }.
   "Log in as <name>" goes to the real sign-in (../app/, email -> 6-digit code, POST /d2c-api/auth/login + verify)
   when end.workspace is set: ../app/?email=<email>#/w/<workspace>/today. ?email fills the address in (the app's
   invite path) and the hash survives sign-in, so the person lands in that workspace. A fictional brand
   (no workspace) falls back to ../app/#demo?brand=<config.id>, and the page says so.

   Motion: the cards turn with CSS 3D in sequence (the same "light up as named, in order" beat as the topic
   cards on sameep.ai, with its ease-out curve). Reduced motion (or html.still): face-up from the start, no turn.
   Keyboard: focusing a face-down card's login turns it at once, so nothing focusable is ever hidden. */
(function () {
  'use strict';

  function str(v, d) { return typeof v === 'string' && v.trim() ? v.trim() : (d || ''); }
  function h(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }
  function still() {
    var s = false;
    try { s = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* old browser */ }
    return s || document.documentElement.classList.contains('still') || /[?&]still\b/.test(location.search);
  }

  /* links from the config: http(s) and mailto only (same allowlist as pin-loader.js) */
  function safeHref(v) {
    if (typeof v !== 'string' || !v) return '';
    try { var u = new URL(v, location.href); return /^(https?|mailto):$/.test(u.protocol) ? v : ''; } catch (e) { return ''; }
  }

  function loginHref(member, end, demo) {
    var ws = str(end.workspace);
    if (!ws) return demo;
    var email = str(member.email);
    return '../app/' + (email ? '?email=' + encodeURIComponent(email) : '') + '#/w/' + encodeURIComponent(ws) + '/today';
  }

  var BRAND_ID = '', CFG_FACES = null;
  /* the person's illustrated face: the config's own (cfg.faces, keyed by name or first name) first, else
     faces/<brand>-<name>.webp; their initial if there is none */
  function avatar(m, cls) {
    var ini = str(m.initial, str(m.name, '?').charAt(0)).slice(0, 2).toUpperCase(), el = h('span', cls, ini);
    var name = str(m.name), first = name.toLowerCase().split(/\s+/)[0];
    var own = CFG_FACES && (str(CFG_FACES[name]) || str(CFG_FACES[name.split(/\s+/)[0]]) || str(CFG_FACES[first]));
    if (!own && (!BRAND_ID || !name)) return el;
    var im = document.createElement('img'); im.alt = ''; im.decoding = 'async';
    im.onload = function () { el.textContent = ''; el.appendChild(im); el.classList.add('has-face'); };
    im.src = own || 'faces/' + BRAND_ID + '-' + first + '.webp';
    return el;
  }
  function card(m, i, brand, end, demo) {
    var name = str(m.name, 'Teammate');
    var role = str(m.role);
    var li = h('li', 'fin-card');
    li.style.setProperty('--i', i);
    var flip = h('div', 'fin-flip');

    // face-down: the brand and the seat, nothing else. Decorative for screen readers (the face-up side says it all).
    var back = h('div', 'fin-face fin-back');
    back.setAttribute('aria-hidden', 'true');
    back.appendChild(h('span', 'fin-brand', brand));
    if (role) back.appendChild(h('span', 'fin-seat', role));
    flip.appendChild(back);

    // face-up: the person's app card
    var front = h('div', 'fin-face fin-front');
    var top = h('div', 'fin-top');
    top.appendChild(avatar(m, 'fin-av')).setAttribute('aria-hidden', 'true');
    var who = h('div', 'fin-who');
    who.appendChild(h('p', 'fin-name', name));
    if (role) who.appendChild(h('p', 'fin-role', role));
    top.appendChild(who);
    front.appendChild(top);
    if (str(m.waiting)) {
      var w = h('p', 'fin-wait');
      w.appendChild(h('span', 'fin-wait-k', 'Waiting'));
      w.appendChild(h('span', 'fin-wait-v', m.waiting));
      front.appendChild(w);
    }
    var a = h('a', 'fin-btn', 'Log in as ' + name);
    a.href = safeHref(loginHref(m, end, demo)) || demo;
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault(); openLogin(m, brand, a.href, demo);
    });
    front.appendChild(a);
    flip.appendChild(front);

    li.appendChild(flip);
    return li;
  }

  /* the login, full screen: the person's bubble in the middle, the rest of the team popping in around it,
     the code filling itself, then a choice: see the demo, or go back */
  var TEAM = [];
  function bubble(m, cls) {
    var b = h('span', 'lg-bub ' + (cls || ''));
    if (str(m.photo)) { var im = h('img'); im.src = m.photo; im.alt = ''; b.appendChild(im); }
    else { var a = avatar(m, 'lg-face'); while (a.firstChild) b.appendChild(a.firstChild); var mo = new MutationObserver(function () { b.textContent = ''; while (a.firstChild) b.appendChild(a.firstChild); mo.disconnect(); }); mo.observe(a, { childList: true }); }
    return b;
  }
  function openLogin(m, brand, href, demo) {
    var old = document.getElementById('lg'); if (old) old.remove();
    var ov = h('div', 'lg' + (still() ? ' lg-still' : '')); ov.id = 'lg';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Log in as ' + str(m.name));
    var ring = h('div', 'lg-ring');
    var others = TEAM.filter(function (x) { return x !== m; });
    others.forEach(function (x, i) {
      var b = bubble(x, 'lg-other'); var a = -Math.PI + ((i + 0.5) / Math.max(1, others.length)) * Math.PI;   /* an arc over the top */
      b.style.setProperty('--x', (Math.cos(a) * Math.min(190, innerWidth * .38)).toFixed(0) + 'px'); b.style.setProperty('--y', (Math.sin(a) * Math.min(150, innerWidth * .34)).toFixed(0) + 'px');
      b.style.setProperty('--d', (0.25 + i * 0.12) + 's');
      var tag = h('span', 'lg-tag', str(x.name)); b.appendChild(tag);
      ring.appendChild(b);
    });
    var me = bubble(m, 'lg-me'); ring.appendChild(me);
    ov.appendChild(ring);
    var box = h('div', 'lg-box');
    box.appendChild(h('p', 'lg-name', str(m.name)));
    box.appendChild(h('p', 'lg-role', str(m.role) + ', ' + brand));
    var mail = h('p', 'lg-mail', str(m.email, str(m.name).toLowerCase().replace(/[^a-z]/g, '') + '@' + brand.toLowerCase().replace(/[^a-z]/g, '') + '.example'));
    box.appendChild(mail);
    var code = h('div', 'lg-code'); var digits = [];
    for (var i = 0; i < 6; i++) { var d = h('span', 'lg-d'); code.appendChild(d); digits.push(d); }
    box.appendChild(code);
    var status = h('p', 'lg-status', 'Code sent to your email');
    box.appendChild(status);
    var row = h('div', 'lg-ctas');
    var go = h('a', 'lg-go', 'See the demo'); go.href = safeHref(href) || demo;
    var back = h('button', 'lg-back', 'Back'); back.type = 'button';
    back.addEventListener('click', function () { ov.classList.add('lg-out'); setTimeout(function () { ov.remove(); }, 300); });
    row.appendChild(go); row.appendChild(back);
    box.appendChild(row);
    ov.appendChild(box);
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('lg-in'); });
    var c = '482913'.split(''), k = 0;
    var timer = setInterval(function () {
      if (k < 6) { digits[k].textContent = c[k]; digits[k].classList.add('on'); k++; return; }
      clearInterval(timer); status.textContent = 'Signed in'; ov.classList.add('lg-done'); go.focus();
    }, still() ? 1 : 170);
    addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { back.click(); removeEventListener('keydown', esc); } });
  }

  var AGENTS = [['M', 'Meetings'], ['H', 'Hiring'], ['V', 'Vendors'], ['C', 'Content'], ['W', 'Website'], ['A', 'Ads'], ['O', 'Ops'], ['S', 'Support']];
  function glimpse(c, brand, team, demo) {
    var a = h('a', 'gl'); a.href = demo; a.setAttribute('aria-label', 'Open the ' + brand + ' demo');
    var win = h('div', 'gl-win');
    var bar = h('div', 'gl-bar'); bar.appendChild(h('b', null, 'Chief of Staff')); bar.appendChild(h('span', null, brand)); win.appendChild(bar);
    var body = h('div', 'gl-body');
    var founder = team[0] ? str(team[0].name) : '';
    body.appendChild(h('p', 'gl-hi', 'Good morning' + (founder ? ', ' + founder : '')));
    var needs = team.filter(function (m) { return str(m.waiting); });
    var n = 0; needs.forEach(function (m) { var k = str(m.waiting).match(/\d+/g); n += k ? Math.min(3, k.length) : 1; });
    n = Math.max(n, needs.length, 3);
    var tiles = h('div', 'gl-tiles');
    var big = h('div', 'gl-tile gl-big'); big.appendChild(h('b', null, String(n))); big.appendChild(h('span', null, 'things need you')); tiles.appendChild(big);
    var sh = c.shipping || {}, del = (c.stages || []).filter(function (s) { return s && s.id === 'delivered'; })[0] || {};
    var hub = ((del.surfaces || {}).hub || {}).metrics || [];
    [['Delivered today', hub[0] && hub[0].value ? String(hub[0].value).split(/\s|→|->/).pop() : '38'], ['Out for delivery', str(sh.out_for_delivery, '11')], ['Agents working', String(AGENTS.length)]].forEach(function (t) {
      var d = h('div', 'gl-tile'); d.appendChild(h('b', null, t[1])); d.appendChild(h('span', null, t[0])); tiles.appendChild(d);
    });
    body.appendChild(tiles);
    var cols = h('div', 'gl-cols');
    var list = h('ul', 'gl-needs');
    needs.slice(0, 4).forEach(function (m) { var li = h('li'); li.appendChild(avatar(m, 'gl-av')); var tx = h('div'); tx.appendChild(h('b', null, str(m.name))); tx.appendChild(h('span', null, str(m.waiting))); li.appendChild(tx); list.appendChild(li); });
    cols.appendChild(list);
    var ags = h('ul', 'gl-ags'); ags.setAttribute('aria-label', 'Agents');
    AGENTS.forEach(function (k) { var li = h('li'); var mk = h('span', 'gl-mk', k[0]); mk.setAttribute('aria-hidden', 'true'); li.appendChild(mk); li.appendChild(h('b', null, k[1])); ags.appendChild(li); });
    cols.appendChild(ags);
    body.appendChild(cols);
    win.appendChild(body); a.appendChild(win);
    a.appendChild(h('span', 'gl-go', 'Try the demo, as ' + (founder || brand)));
    return a;
  }
  window.renderEnding = function (config, root) {
    var c = config && typeof config === 'object' ? config : {};
    var end = c.end && typeof c.end === 'object' ? c.end : {};
    var links = end.links && typeof end.links === 'object' ? end.links : {};
    var brand = str(c.brand && c.brand.name, 'Your brand');
    var team = Array.isArray(c.team) ? c.team.filter(function (m) { return m && str(m.name); }).slice(0, 8) : [];
    TEAM = team;
    // the demo continues the show: a well-formed brand id rides along (../app/#demo?brand=<id>)
    var id = /^[a-z0-9][a-z0-9-]{1,23}$/.test(str(c.id)) ? str(c.id) : '';
    BRAND_ID = id;
    CFG_FACES = c.faces && typeof c.faces === 'object' ? c.faces : null;
    var demo = safeHref(str(links.demo)) || '/cos/app/#demo' + (id ? '?brand=' + id : '');
    var calm = still();

    var sec = h('section', 'fin' + (calm ? ' fin-still' : ''));
    sec.id = 'fin';
    sec.setAttribute('aria-labelledby', 'fin-h');
    var inner = h('div', 'fin-in');

    var hd = h('h2', 'fin-line', str(end.line, 'She had the idea. Everything after it got done.'));
    hd.id = 'fin-h';
    inner.appendChild(hd);

    var cards = [];
    if (team.length) {
      inner.appendChild(h('p', 'fin-sub', brand + '’s team. Each of them has their own login.'));
      var ul = h('ul', 'fin-team');
      ul.style.setProperty('--n', team.length);
      ul.setAttribute('data-n', String(team.length));
      ul.setAttribute('aria-label', brand + ' team logins');
      team.forEach(function (m, i) { var li = card(m, i, brand, end, demo); cards.push(li); ul.appendChild(li); });
      inner.appendChild(ul);
      if (!str(end.workspace)) inner.appendChild(h('p', 'fin-sub fin-note', brand + ' is a sample brand, so each login opens the demo workspace.'));
    }

    /* a glimpse of the real app, in the same world: the dashboard the demo opens on */
    inner.appendChild(glimpse(c, brand, team, demo));

    var row = h('div', 'fin-ctas');
    [['Try the demo', demo, 'fin-cta is-main'],
     ['See plans', safeHref(str(links.plans)) || '../plans/', 'fin-cta'],
     ['Talk to us', safeHref(str(links.talk)) || '../plans/#enquire', 'fin-cta']].forEach(function (b) {
      var a = h('a', b[2], b[0]);
      a.href = safeHref(b[1]) || '../plans/';
      row.appendChild(a);
    });
    inner.appendChild(row);
    sec.appendChild(inner);
    if (root && root.appendChild) root.appendChild(sec);

    // ---- the turn ----
    function up(li) { if (!li.classList.contains('is-up')) li.classList.add('is-up'); }
    if (calm || !('IntersectionObserver' in window)) { cards.forEach(up); return sec; }

    var queue = [], timer = null;
    function tick() {
      var li = queue.shift();
      if (!li) { timer = null; return; }
      up(li);
      timer = setTimeout(tick, 190);
    }
    function enqueue(li) {
      if (li.classList.contains('is-up') || queue.indexOf(li) > -1) return;
      queue.push(li);
      queue.sort(function (a, b) { return cards.indexOf(a) - cards.indexOf(b); });
      if (!timer) timer = setTimeout(tick, 120);
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { enqueue(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.6 });
    cards.forEach(function (li) {
      io.observe(li);
      li.addEventListener('focusin', function () { up(li); });
    });
    return sec;
  };
})();
