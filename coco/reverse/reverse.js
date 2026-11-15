/* reverse.js: the "one order, rewound" landing engine (object scenes).
   Loads brands/<id>.json (?brand=, default ondri) and scenes/_shared/screens.json.
   Physical scenes: scenes/<brand>/<NN-id>.webp, full-frame photographs with the product in them.
   Device scenes: scenes/_shared/<NN-id>.webp, a shared plate whose screen is drawn here in HTML and
   mapped onto the screen quad with a CSS matrix3d. Nothing else is layered on a photo except the
   leader-line tags. Missing images fall back to a plain studio-grey placeholder.
   Narrative: open on 01-delivered; the first scroll rewinds every scene in reverse (~1.5 s) to
   17-voice; then one scene per scroll step forward, 16-meeting ... 01-delivered; then #end.
   html.film = sticky stage driven by scroll. html.still = stacked, no rewind (reduced motion). */
(function () {
  'use strict';

  var root = document.documentElement;
  var show = document.getElementById('show');
  var STILL = root.classList.contains('still');

  /* Scene order (01 .. 17). Device scenes draw their screen in HTML. */
  var ORDER = ['delivered', 'courier', 'packed', 'order', 'support', 'listing', 'ad', 'shoot', 'kitting',
    'qc', 'inbound', 'po', 'packaging', 'formula', 'hire', 'meeting', 'voice'];
  var DEVICE = { order: 'phone', support: 'phone', listing: 'monitor', ad: 'phone', voice: 'phone' };
  /* Fallback screen quads (fractions of the plate, tl tr br bl) used until screens.json has a measurement. */
  var QUAD_PHONE = [[0.436, 0.17], [0.564, 0.17], [0.564, 0.83], [0.436, 0.83]];
  var QUAD_MONITOR = [[0.29, 0.16], [0.71, 0.16], [0.71, 0.70], [0.29, 0.70]];
  var PLATE_W = 1536, PLATE_H = 864; /* render size, used before an image has loaded */
  var BASE_W = { phone: 360, monitor: 1280 };

  function sceneId(id) { var n = ORDER.indexOf(id) + 1; return (n < 10 ? '0' : '') + n + '-' + id; }

  /* ---------- tiny DOM helpers ---------- */
  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = String(text);
    return e;
  }
  function svgEl(tag, attrs) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function str(v, d) { return (typeof v === 'string' && v.trim()) ? v.trim() : (d || ''); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hexOk(c) { return typeof c === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c); }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function icon(path, size) {
    var s = svgEl('svg', { viewBox: '0 0 24 24', width: size || 16, height: size || 16, 'aria-hidden': 'true' });
    s.appendChild(svgEl('path', { d: path }));
    return s;
  }
  var I_CHECK = 'M5 12.5l4.5 4.5L19 7.5';
  var I_PLAY = 'M8 5.5v13l11-6.5z';
  var I_PAUSE = 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z';

  /* ---------- load ---------- */
  var params = new URLSearchParams(location.search);
  var brandId = params.get('brand') || 'ondri';
  if (!/^[a-z0-9_-]{1,40}$/i.test(brandId)) brandId = 'ondri';

  Promise.all([
    fetch('brands/' + brandId + '.json', { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status); return r.json();
    }),
    fetch('scenes/_shared/screens.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
  ]).then(function (res) {
    try { init(res[0], res[1] || {}); }
    catch (err) { fail('This brand file could not be drawn: ' + err.message); if (window.console) console.warn(err); }
  }).catch(function () { fail('Could not load the brand file for "' + brandId + '".'); });

  function fail(msg) {
    show.textContent = '';
    var w = h('div', 'msg-wrap'); w.appendChild(h('p', 'msg', msg)); show.appendChild(w);
  }

  /* ---------- config ---------- */
  var cfg, screens, byId = {};

  function init(raw, scr) {
    cfg = raw; screens = scr;
    if (!cfg || !Array.isArray(cfg.stages)) throw new Error('no stages');
    cfg.brand = cfg.brand || {};
    cfg.assets = cfg.assets || {};
    cfg.voice = cfg.voice || {};
    cfg.intro = cfg.intro || {};
    cfg.stages.forEach(function (s) { if (s && ORDER.indexOf(s.id) >= 0) byId[s.id] = s; });
    ORDER.forEach(function (id) { if (!byId[id]) byId[id] = { id: id, when: '', line: '', tap: null, tags: [] }; });
    var pal = cfg.palette || {};
    if (hexOk(pal.accent)) root.style.setProperty('--acc', pal.accent);
    if (cfg.brand.name) document.title = cfg.brand.name + ': one order, rewound';

    buildSteps();
    if (STILL) buildStill(); else buildFilm();
    renderEnd();
  }

  /* Steps: 0 open on delivered, 1 the voice note, 2..17 forward meeting -> delivered. */
  var steps = [];
  function buildSteps() {
    steps.push({ id: 'delivered', intro: true });
    steps.push({ id: 'voice' });
    for (var i = ORDER.length - 2; i >= 0; i--) steps.push({ id: ORDER[i] });
  }

  /* ---------- ending (ending.js, written separately) ---------- */
  function renderEnd() {
    var el = document.getElementById('end');
    if (!el) return;
    if (typeof window.renderEnding === 'function') {
      try { window.renderEnding(cfg, el); return; } catch (e) { if (window.console) console.warn(e); }
    }
    el.textContent = '';
    el.className = 'end-fallback';
    var p = h('p', 'line', str(cfg.end && cfg.end.line, 'She had the idea. Everything after it got done.'));
    var a = h('a', 'btn', 'Try the demo'); a.href = '../../app/#demo';
    el.appendChild(p); el.appendChild(a);
  }

  /* ---------- one frame (a step) ---------- */
  function buildFrame(step, idx) {
    var st = byId[step.id];
    var kind = DEVICE[step.id] || null;
    var sid = sceneId(step.id);
    var f = h('article', 'frame' + (kind ? ' is-device' : '') + (step.intro ? ' is-intro' : ''));
    f.dataset.scene = sid;
    f.dataset.step = idx;

    var pic = h('div', 'pic');
    var cam = h('div', 'cam');
    var img = h('img');
    img.alt = '';
    img.decoding = 'async';
    img.src = kind ? 'scenes/_shared/' + sid + '.webp' : 'scenes/' + brandId + '/' + sid + '.webp';
    img.addEventListener('error', function () { f.classList.add('no-image'); layoutFrame(f); });
    img.addEventListener('load', function () {
      layoutFrame(f);
      /* decode now so the rewind flip-book never shows an undecoded frame */
      if (img.decode) img.decode().catch(function () {});
    });
    cam.appendChild(img);
    if (kind) {
      var scr = h('div', 'screen ' + kind);
      scr.appendChild(buildScreen(step.id, st));
      cam.appendChild(scr);
    }
    pic.appendChild(cam);
    var tagLayer = h('div', 'tags');
    tagLayer.setAttribute('aria-hidden', 'true');
    pic.appendChild(tagLayer);
    f.appendChild(pic);

    f.appendChild(buildCopy(step, st));
    f._img = img; f._kind = kind; f._step = step; f._stage = st;
    return f;
  }

  function buildCopy(step, st) {
    var c = h('div', 'copy');
    var when = step.id === 'voice' ? joinWhen(cfg.voice.when, cfg.voice.time) || st.when : st.when;
    c.appendChild(h('p', 'when', when || ''));
    if (step.intro) {
      c.appendChild(h('p', 'line', str(cfg.intro.line, 'This is one order, delivered.')));
      c.appendChild(h('p', 'sub', str(cfg.intro.sub, 'Scroll to rewind it.')));
      return c;
    }
    if (step.id === 'voice') { c.appendChild(buildVoiceCopy()); return c; }
    c.appendChild(h('p', 'line', str(st.line)));
    var taps = Array.isArray(st.tap) ? st.tap : (st.tap ? [st.tap] : []);
    taps.slice(0, 2).forEach(function (t) { c.appendChild(buildTap(t)); });
    return c;
  }
  function joinWhen(a, b) { a = str(a); b = str(b); return a && b ? a + ', ' + b : a || b; }

  /* ---------- the human tap: a small app card that presses itself ---------- */
  var VERBS = { approved: 'approve', scanned: 'scan', rejected: 'reject', chose: 'choose', made: 'make',
    picked: 'pick', confirmed: 'confirm', voted: 'vote', signed: 'sign', sent: 'send', booked: 'book',
    accepted: 'accept', checked: 'check', paid: 'pay', ok: 'OK' };
  function imperative(what) {
    var w = str(what).split(/\s+/), v = (w[0] || '').toLowerCase();
    var base = VERBS[v] || v.replace(/ied$/, 'y').replace(/([^e])ed$/, '$1').replace(/ed$/, 'e');
    return { verb: base, rest: w.slice(1).join(' ') };
  }
  function buildTap(t) {
    var who = str(t.who, 'Someone'), what = str(t.what), cost = str(t.cost);
    var im = imperative(what);
    var card = h('div', 'tap');
    var av = h('span', 'av', who.replace(/^the\s+/i, '').charAt(0).toUpperCase());
    av.setAttribute('aria-hidden', 'true');
    var txt = h('span', 'ask');
    var askLine = cap(who) + ', ' + im.verb + (im.rest ? ' ' + im.rest : '') + '?';
    var doneLine = cap(who) + ' ' + what + (cost ? ' · ' + cost : '');
    txt.textContent = askLine;
    var btn = h('button', 'press');
    btn.type = 'button';
    var lab = h('span', 'lab', cap(im.verb));
    btn.appendChild(lab);
    btn.appendChild(icon(I_CHECK, 16));
    btn.setAttribute('aria-label', cap(im.verb) + ': ' + askLine);
    card.appendChild(av); card.appendChild(txt); card.appendChild(btn);
    card._press = function () {
      if (card.classList.contains('done')) return;
      card.classList.add('pressing');
      setTimeout(function () {
        card.classList.remove('pressing'); card.classList.add('done');
        txt.textContent = doneLine;
        btn.setAttribute('aria-label', 'Done: ' + doneLine);
      }, 170);
    };
    card._reset = function () { card.classList.remove('done', 'pressing'); txt.textContent = askLine; btn.setAttribute('aria-label', cap(im.verb) + ': ' + askLine); };
    btn.addEventListener('click', function () { card._press(); });
    return card;
  }

  /* ---------- the voice note (copy side): play on tap, words light up ---------- */
  var voice = { words: [], playing: false, t0: 0, dur: 0, raf: 0, audio: null, ui: [] };
  function buildVoiceCopy() {
    var wrap = h('div', 'voice');
    /* forward order: the voice note comes first, so it opens with a lead, not a look back */
    var who = str(cfg.voice.who, str(cfg.brand.founder, 'the founder'));
    wrap.appendChild(h('p', 'line lead', str(cfg.voice.lead, 'Before any of it, ' + who + ' left herself a voice note.')));
    var p = h('p', 'line words');
    var words = str(cfg.voice.words, '').split(/\s+/).filter(Boolean);
    words.forEach(function (w, i) {
      var s = h('span', 'w', w);
      p.appendChild(s);
      if (i < words.length - 1) p.appendChild(document.createTextNode(' '));
      voice.words.push(s);
    });
    voice.dur = Math.max(4, words.length * 0.36);
    var btn = h('button', 'play');
    btn.type = 'button';
    btn.appendChild(icon(I_PLAY, 16));
    btn.appendChild(h('span', 'lab', 'Play ' + str(cfg.voice.who, 'her') + '’s voice note'));
    btn.appendChild(h('span', 'dur', fmtTime(voice.dur)));
    btn.addEventListener('click', toggleVoice);
    voice.ui.push(btn);
    wrap.appendChild(btn);
    wrap.appendChild(p);
    return wrap;
  }
  function fmtTime(s) { s = Math.round(s); return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60); }
  function toggleVoice() {
    if (voice.playing) { stopVoice(false); return; }
    var src = str(cfg.voice.audio);
    voice.playing = true;
    root.classList.add('voice-on');
    setPlayIcons(true);
    voice.words.forEach(function (w) { w.classList.remove('lit'); });
    if (src) {
      try {
        voice.audio = voice.audio || new Audio(src);
        voice.audio.currentTime = 0;
        voice.audio.onloadedmetadata = function () { if (isFinite(voice.audio.duration)) voice.dur = voice.audio.duration; };
        voice.audio.onended = function () { stopVoice(true); };
        voice.audio.play().catch(function () { voice.audio = null; });
      } catch (e) { voice.audio = null; }
    }
    voice.t0 = performance.now();
    tickVoice();
  }
  function tickVoice() {
    if (!voice.playing) return;
    var t = voice.audio && !voice.audio.paused ? voice.audio.currentTime : (performance.now() - voice.t0) / 1000;
    var p = clamp(t / voice.dur, 0, 1);
    var n = Math.ceil(p * voice.words.length);
    voice.words.forEach(function (w, i) { w.classList.toggle('lit', i < n); });
    document.querySelectorAll('.vn-bars').forEach(function (b) { b.style.setProperty('--p', p); });
    document.querySelectorAll('.vn-time').forEach(function (e) { e.textContent = fmtTime(t) + ' / ' + fmtTime(voice.dur); });
    if (p >= 1 && !(voice.audio && !voice.audio.paused)) { stopVoice(true); return; }
    voice.raf = requestAnimationFrame(tickVoice);
  }
  function stopVoice(ended) {
    voice.playing = false;
    cancelAnimationFrame(voice.raf);
    if (voice.audio) { try { voice.audio.pause(); } catch (e) {} }
    root.classList.remove('voice-on');
    setPlayIcons(false);
    if (ended) voice.words.forEach(function (w) { w.classList.add('lit'); });
  }
  function setPlayIcons(on) {
    voice.ui.forEach(function (b) {
      var p = b.querySelector('svg path');
      if (p) p.setAttribute('d', on ? I_PAUSE : I_PLAY);
      var l = b.querySelector('.lab');
      if (l && b.classList.contains('play')) l.textContent = (on ? 'Pause ' : 'Play ') + str(cfg.voice.who, 'her') + '’s voice note';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  /* ---------- device screens (HTML, mapped onto the plate) ---------- */
  function heroImg(cls) {
    var i = h('img', cls);
    i.alt = '';
    i.src = str(cfg.assets.hero, 'assets/' + brandId + '/hero.webp');
    i.addEventListener('error', function () { i.style.visibility = 'hidden'; });
    return i;
  }
  function clockOf(when) {
    var m = /(\d{1,2}:\d{2})/.exec(str(when));
    return m ? m[1] : '9:41';
  }
  function listingCard() {
    var l = byId.listing || {}, c = l.card || {};
    return {
      title: str(c.title, str(cfg.brand.product, 'The product')),
      price: str(c.price, ''),
      rating: typeof c.rating === 'number' ? c.rating : null
    };
  }
  function stars(r) {
    var s = h('span', 'stars');
    var full = Math.round(r || 0);
    for (var i = 0; i < 5; i++) s.appendChild(h('i', i < full ? 'on' : '', '★'));
    return s;
  }
  function statusBar(when, dark) {
    var b = h('div', 'sb');
    b.appendChild(h('span', '', clockOf(when)));
    var r = h('span', 'sb-r');
    r.appendChild(h('i', 'sig')); r.appendChild(h('i', 'bat'));
    b.appendChild(r);
    return b;
  }

  function buildScreen(id, st) {
    var name = str(cfg.brand.name, 'Brand');
    var card = listingCard();
    var s;
    if (id === 'order') {
      s = h('div', 'scr light s-order');
      s.appendChild(statusBar(st.when));
      s.appendChild(h('div', 'o-brand', name));
      var ok = h('div', 'o-ok'); ok.appendChild(icon(I_CHECK, 30)); s.appendChild(ok);
      s.appendChild(h('div', 'o-h', 'Order confirmed'));
      s.appendChild(h('div', 'o-sub', 'Arriving in 3 days'));
      var item = h('div', 'o-item');
      var th = h('span', 'o-thumb'); th.appendChild(heroImg()); item.appendChild(th);
      var meta = h('span', 'o-meta'); meta.appendChild(h('b', '', card.title)); meta.appendChild(h('span', '', 'Qty 1'));
      item.appendChild(meta);
      if (card.price) item.appendChild(h('span', 'o-price', card.price));
      s.appendChild(item);
      var rows = [['Deliver to', str(cfg.brand.city, 'Home')], ['Payment', 'Paid, UPI'], ['Order', '#' + name.slice(0, 2).toUpperCase() + '-20418']];
      rows.forEach(function (r) { var d = h('div', 'o-row'); d.appendChild(h('span', '', r[0])); d.appendChild(h('span', '', r[1])); s.appendChild(d); });
    } else if (id === 'support') {
      s = h('div', 'scr light s-chat');
      s.appendChild(statusBar(st.when));
      var top = h('div', 'c-top');
      var av = h('span', 'c-av', name.charAt(0)); top.appendChild(av);
      var tt = h('span', 'c-tt'); tt.appendChild(h('b', '', name)); tt.appendChild(h('span', '', 'Usually replies in minutes'));
      top.appendChild(tt);
      s.appendChild(top);
      var log = h('div', 'c-log');
      var t = clockOf(st.when);
      log.appendChild(bubble('me', str(st.ask, 'Is this right for me?'), t));
      log.appendChild(bubble('them', str(st.answer, 'Yes. Here is how to start.'), addMin(t, 2)));
      s.appendChild(log);
      var inp = h('div', 'c-in'); inp.appendChild(h('span', '', 'Message')); s.appendChild(inp);
    } else if (id === 'listing') {
      s = h('div', 'scr light s-pdp');
      var nav = h('div', 'p-nav');
      nav.appendChild(h('b', '', name));
      var links = h('span', 'p-links'); ['Shop', 'Story', 'Cart (1)'].forEach(function (x) { links.appendChild(h('span', '', x)); });
      nav.appendChild(links);
      s.appendChild(nav);
      var body = h('div', 'p-body');
      var ph = h('div', 'p-photo'); ph.appendChild(heroImg()); body.appendChild(ph);
      var info = h('div', 'p-info');
      info.appendChild(h('div', 'p-title', card.title));
      if (card.rating != null) {
        var rt = h('div', 'p-rate'); rt.appendChild(stars(card.rating)); rt.appendChild(h('span', '', card.rating.toFixed(1) + ' from early reviews'));
        info.appendChild(rt);
      }
      if (card.price) info.appendChild(h('div', 'p-price', card.price));
      info.appendChild(h('div', 'p-cta', 'Add to cart'));
      info.appendChild(h('div', 'p-note', 'Ships from ' + str(cfg.brand.city, 'the studio') + ' in 2 days'));
      body.appendChild(info);
      s.appendChild(body);
    } else if (id === 'ad') {
      s = h('div', 'scr s-ad');
      var pal = cfg.palette || {};
      var bg = (pal.sky && hexOk(pal.sky[1])) ? pal.sky[1] : '#c9b8a3';
      s.style.background = bg;
      s.appendChild(statusBar(st.when));
      var head = h('div', 'a-head');
      head.appendChild(h('span', 'a-av', name.charAt(0)));
      var hn = h('span', 'a-n'); hn.appendChild(h('b', '', name)); hn.appendChild(h('span', '', 'Sponsored'));
      head.appendChild(hn);
      s.appendChild(head);
      var hero = h('div', 'a-hero'); hero.appendChild(heroImg()); s.appendChild(hero);
      var foot = h('div', 'a-foot');
      foot.appendChild(h('span', 'a-t', card.title));
      foot.appendChild(h('span', 'a-cta', 'Shop now'));
      s.appendChild(foot);
      var stats = Array.isArray(st.stats) ? st.stats : (st.tags || []).map(function (x) { return x && x.text; });
      var strip = h('div', 'a-stats');
      stats.filter(Boolean).slice(0, 3).forEach(function (x) { strip.appendChild(h('span', '', String(x))); });
      s.appendChild(strip);
    } else {
      s = h('div', 'scr dark s-voice');
      s.appendChild(statusBar(cfg.voice.time || st.when, true));
      s.appendChild(h('div', 'v-who', str(cfg.voice.who, str(cfg.brand.founder, 'Founder'))));
      s.appendChild(h('div', 'v-when', str(cfg.voice.time, clockOf(st.when)) + ', voice note'));
      var bars = h('div', 'vn-bars');
      var seed = 7;
      for (var i = 0; i < 44; i++) {
        seed = (seed * 9301 + 49297) % 233280;
        var v = 0.18 + 0.82 * Math.abs(Math.sin(i * 0.55)) * (0.45 + 0.55 * seed / 233280);
        var bar = h('i'); bar.style.height = Math.round(v * 100) + '%';
        bar.style.setProperty('--i', (i + 0.5) / 44);
        bars.appendChild(bar);
      }
      s.appendChild(bars);
      s.appendChild(h('div', 'vn-time', '0:00 / ' + fmtTime(voice.dur || 7)));
      var pb = h('button', 'v-play');
      pb.type = 'button';
      pb.setAttribute('aria-label', 'Play the voice note');
      pb.appendChild(icon(I_PLAY, 28));
      pb.addEventListener('click', toggleVoice);
      voice.ui.push(pb);
      s.appendChild(pb);
    }
    return s;
  }
  function bubble(who, text, time) {
    var b = h('div', 'bub ' + who);
    b.appendChild(h('span', 'bt', text));
    b.appendChild(h('span', 'bm', time));
    return b;
  }
  function addMin(t, m) {
    var p = /^(\d{1,2}):(\d{2})$/.exec(t); if (!p) return t;
    var mm = +p[2] + m, hh = +p[1] + Math.floor(mm / 60); mm %= 60;
    return hh + ':' + (mm < 10 ? '0' : '') + mm;
  }

  /* ---------- geometry: cover-fit, homography, tags ---------- */
  function coverBox(pic, img) {
    var W = pic.clientWidth, H = pic.clientHeight;
    var iw = (img && img.naturalWidth) || PLATE_W, ih = (img && img.naturalHeight) || PLATE_H;
    var s = Math.max(W / iw, H / ih);
    var dw = iw * s, dh = ih * s;
    return { W: W, H: H, x: (W - dw) / 2, y: (H - dh) / 2, w: dw, h: dh, iw: iw, ih: ih };
  }
  function homography(src, dst) {
    var A = [], i, j, k;
    for (i = 0; i < 4; i++) {
      var x = src[i][0], y = src[i][1], u = dst[i][0], v = dst[i][1];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
    }
    for (i = 0; i < 8; i++) {
      var p = i;
      for (j = i + 1; j < 8; j++) if (Math.abs(A[j][i]) > Math.abs(A[p][i])) p = j;
      var t = A[i]; A[i] = A[p]; A[p] = t;
      for (j = i + 1; j < 8; j++) {
        var f = A[j][i] / A[i][i];
        for (k = i; k < 9; k++) A[j][k] -= f * A[i][k];
      }
    }
    var hh = new Array(8);
    for (i = 7; i >= 0; i--) {
      var sum = A[i][8];
      for (j = i + 1; j < 8; j++) sum -= A[i][j] * hh[j];
      hh[i] = sum / A[i][i];
    }
    return hh;
  }
  function quadFor(f) {
    var e = screens[f.dataset.scene];
    var q = e && (Array.isArray(e) ? e : e.quad);
    if (Array.isArray(q) && q.length === 4) return q;
    return f._kind === 'monitor' ? QUAD_MONITOR : QUAD_PHONE;
  }
  function toPx(box, p) { return [box.x + p[0] * box.w, box.y + p[1] * box.h]; }
  function dist(a, b) { return Math.sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1])); }

  /* Tags shown on a frame: never on the intro, the voice note, or a missing image (nothing to point at). */
  function frameTags(f) {
    if (f._step.intro || f._step.id === 'voice' || f.classList.contains('no-image')) return [];
    return (f._stage.tags || []).filter(function (t) {
      return t && str(t.text) && Array.isArray(t.at) && isFinite(+t.at[0]) && isFinite(+t.at[1]);
    }).slice(0, 2);
  }
  /* Slide the cover crop (object-position) so the tag anchors stay in view, as little as needed.
     If every anchor cannot fit, keep the first one in view. Physical scenes only: a device scene
     keeps its screen centred. */
  function focusCrop(f, box) {
    var img = f._img;
    img.style.objectPosition = '';
    if (f._kind) return box;
    var tags = frameTags(f);
    if (!tags.length) return box;
    var M = box.W < 700 ? 28 : 56;
    function axis(pos, size, view, key) {
      if (size <= view + 0.5) return pos;
      var vals = tags.map(function (t) { return clamp(+t.at[key], 0, 1) * size; });
      var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
      var a = Math.max(M - lo, view - size), b = Math.min(view - M - hi, 0);
      if (a > b) { lo = hi = vals[0]; a = Math.max(M - lo, view - size); b = Math.min(view - M - hi, 0); }
      return a > b ? pos : clamp(pos, a, b);
    }
    var nx = axis(box.x, box.w, box.W, 0), ny = axis(box.y, box.h, box.H, 1);
    if (nx === box.x && ny === box.y) return box;
    var px = box.w > box.W ? nx / (box.W - box.w) * 100 : 50;
    var py = box.h > box.H ? ny / (box.H - box.h) * 100 : 50;
    img.style.objectPosition = px.toFixed(3) + '% ' + py.toFixed(3) + '%';
    box.x = nx; box.y = ny;
    return box;
  }

  function layoutFrame(f) {
    var pic = f.querySelector('.pic');
    if (!pic) return;
    pic.style.height = '';
    if (!pic.clientWidth) return;
    var box = coverBox(pic, f.classList.contains('no-image') ? null : f._img);
    box = focusCrop(f, box);
    if (f._kind && box.W < 760 && !STILL) {
      /* narrow screens: never crop the device's screen; shrink the picture to fit it instead */
      var qq = quadFor(f);
      var qw = (Math.max(qq[0][0], qq[1][0], qq[2][0], qq[3][0]) - Math.min(qq[0][0], qq[1][0], qq[2][0], qq[3][0])) * box.iw;
      var qh = (Math.max(qq[0][1], qq[1][1], qq[2][1], qq[3][1]) - Math.min(qq[0][1], qq[1][1], qq[2][1], qq[3][1])) * box.ih;
      var sNow = box.w / box.iw, sFit = Math.min((box.W - 24) / qw, (box.H - 24) / qh);
      if (sFit < sNow) {
        pic.style.height = Math.round(Math.min(box.H, box.ih * sFit)) + 'px';
        box = coverBox(pic, f.classList.contains('no-image') ? null : f._img);
      }
    }
    var cam = f.querySelector('.cam');
    cam.style.width = box.W + 'px'; cam.style.height = box.H + 'px';
    var quadPx = null;
    if (f._kind) {
      var q = quadFor(f);
      quadPx = q.map(function (p) { return toPx(box, p); });
      var scr = f.querySelector('.screen');
      /* screen box in plate pixels -> aspect */
      var qi = q.map(function (p) { return [p[0] * box.iw, p[1] * box.ih]; });
      var wq = (dist(qi[0], qi[1]) + dist(qi[3], qi[2])) / 2;
      var hq = (dist(qi[0], qi[3]) + dist(qi[1], qi[2])) / 2;
      var w = BASE_W[f._kind], hgt = Math.round(w * hq / wq);
      scr.style.width = w + 'px'; scr.style.height = hgt + 'px';
      var m = homography([[0, 0], [w, 0], [w, hgt], [0, hgt]], quadPx);
      scr.style.transform = 'matrix3d(' + [m[0], m[3], 0, m[6], m[1], m[4], 0, m[7], 0, 0, 1, 0, m[2], m[5], 0, 1].join(',') + ')';
      f.classList.toggle('flat-screen', f.classList.contains('no-image'));
    }
    drawTags(f, box, quadPx);
  }

  /* Leader-line tags. tags[].at is [x, y] as fractions of the SCENE IMAGE; the dot lands exactly on that
     pixel of the cover-cropped photo. The tag goes outward, toward the nearest edge it fits against,
     and never over the copy panel, the home link, another tag or (when there is room) a device screen. */
  function rectHit(a, b) { return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0; }
  function relRect(el, layerR, pad) {
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { x0: r.left - layerR.left - pad, y0: r.top - layerR.top - pad, x1: r.right - layerR.left + pad, y1: r.bottom - layerR.top + pad };
  }
  var DIRS = [[1, 0], [-1, 0], [0, -1], [0, 1], [0.71, -0.71], [-0.71, -0.71], [0.71, 0.71], [-0.71, 0.71]];
  function drawTags(f, box, quadPx) {
    var layer = f.querySelector('.tags');
    layer.textContent = '';
    var tags = frameTags(f);
    if (!tags.length) return;
    var W = box.W, H = box.H;
    var svg = svgEl('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H });
    layer.appendChild(svg);
    var narrow = W < 700;
    var EDGE = narrow ? 8 : 14, GAP = 8;
    var layerR = layer.getBoundingClientRect();
    var hard = [], soft = [];
    if (!STILL) {
      var copy = f.querySelector('.copy');
      var cr = copy && relRect(copy, layerR, 14);
      if (cr && rectHit(cr, { x0: 0, y0: 0, x1: W, y1: H })) hard.push(cr);
      var home = document.querySelector('.home');
      var hr = home && relRect(home, layerR, 8);
      if (hr) hard.push(hr);
    }
    if (quadPx) {
      var xs = quadPx.map(function (c) { return c[0]; }), ys = quadPx.map(function (c) { return c[1]; });
      soft.push({ x0: Math.min.apply(null, xs), y0: Math.min.apply(null, ys), x1: Math.max.apply(null, xs), y1: Math.max.apply(null, ys) });
    }
    var dots = tags.map(function (t) { return toPx(box, [clamp(+t.at[0], 0, 1), clamp(+t.at[1], 0, 1)]); });
    var placed = [];
    tags.forEach(function (t, i) {
      var p = dots[i];
      /* the anchor must be on screen and not under the copy panel, or the tag would point at nothing */
      if (p[0] < 4 || p[0] > W - 4 || p[1] < 4 || p[1] > H - 4) return;
      var pr = { x0: p[0], y0: p[1], x1: p[0], y1: p[1] };
      if (hard.some(function (o) { return rectHit(pr, o); })) return;
      var tag = h('span', 'tag', t.text);
      layer.appendChild(tag);
      var tw = tag.offsetWidth, th = tag.offsetHeight;
      var best = null;
      /* the last pass steps each straight direction just clear of a device screen */
      function clearReach(d) {
        var r = 0;
        soft.forEach(function (o) {
          if (d[0] > 0) r = Math.max(r, o.x1 + 20 - p[0]); else if (d[0] < 0) r = Math.max(r, p[0] - o.x0 + 20);
          else if (d[1] > 0) r = Math.max(r, o.y1 + 20 - p[1]); else r = Math.max(r, p[1] - o.y0 + 20);
        });
        return r;
      }
      [narrow ? 22 : 44, narrow ? 40 : 84, 12, 'clear'].forEach(function (pass) {
        if (best && best.score < 1e5) return;
        if (pass === 'clear' && !soft.length) return;
        DIRS.forEach(function (d) {
          var reach = pass === 'clear' ? (d[0] && d[1] ? 0 : clearReach(d)) : pass;
          /* a long leader across a screen reads worse than a tag on it: cap the clearing reach */
          if (!reach || (pass === 'clear' && reach > (narrow ? 120 : 240))) return;
          var x = d[0] > 0 ? p[0] + reach * Math.abs(d[0]) : d[0] < 0 ? p[0] - reach * Math.abs(d[0]) - tw : p[0] - tw / 2;
          var y = d[1] > 0 ? p[1] + reach * Math.abs(d[1]) : d[1] < 0 ? p[1] - reach * Math.abs(d[1]) - th : p[1] - th / 2;
          var r = { x0: x, y0: y, x1: x + tw, y1: y + th };
          if (r.x0 < EDGE || r.y0 < EDGE || r.x1 > W - EDGE || r.y1 > H - EDGE) return;
          var g = { x0: r.x0 - GAP, y0: r.y0 - GAP, x1: r.x1 + GAP, y1: r.y1 + GAP };
          if (hard.some(function (o) { return rectHit(g, o); })) return;
          if (placed.some(function (o) { return rectHit(g, o.r); })) return;
          if (dots.some(function (q, j) { return j !== i && rectHit(g, { x0: q[0], y0: q[1], x1: q[0], y1: q[1] }); })) return;
          /* score: distance from the dot to the frame edge in this direction (nearest edge wins) */
          var tx = d[0] > 0 ? (W - p[0]) / d[0] : d[0] < 0 ? p[0] / -d[0] : Infinity;
          var ty = d[1] > 0 ? (H - p[1]) / d[1] : d[1] < 0 ? p[1] / -d[1] : Infinity;
          var score = pass === 'clear' ? reach : Math.min(tx, ty) * (d[0] && d[1] ? 1.12 : d[0] ? 1 : 1.2);
          if (soft.some(function (o) { return rectHit(g, o); })) score += 1e5;
          if (!best || score < best.score) best = { score: score, r: r, x: x, y: y };
        });
      });
      if (!best) { layer.removeChild(tag); return; }
      tag.style.left = Math.round(best.x) + 'px'; tag.style.top = Math.round(best.y) + 'px';
      placed.push(best);
      /* leader: from the dot to the nearest point on the tag's edge */
      var ex = clamp(p[0], best.r.x0, best.r.x1), ey = clamp(p[1], best.r.y0, best.r.y1);
      svg.appendChild(svgEl('path', { d: 'M' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + 'L' + ex.toFixed(1) + ' ' + ey.toFixed(1), class: 'lead' }));
      svg.appendChild(svgEl('circle', { cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: 3, class: 'dot' }));
    });
  }

  /* ---------- film: sticky stage, one step per viewport of scroll ---------- */
  var frames = [], cur = -1, settleT = 0, rewinding = false, rewindT = 0, film, stage, readout;

  function buildFilm() {
    film = h('div', 'film');
    film.style.setProperty('--n', steps.length);
    stage = h('div', 'stage');
    steps.forEach(function (st, i) {
      var f = buildFrame(st, i);
      frames.push(f);
      stage.appendChild(f);
      var snap = h('div', 'snap'); snap.style.top = (i * 100) + 'svh'; film.appendChild(snap);
    });
    readout = h('div', 'rewind');
    readout.setAttribute('aria-hidden', 'true');
    readout.appendChild(h('p', 'when', ''));
    stage.appendChild(readout);
    film.appendChild(stage);
    show.textContent = '';
    show.appendChild(film);
    relayout();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { relayout(); onScroll(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
    onScroll();
  }
  function relayout() { (frames.length ? frames : []).forEach(layoutFrame); document.querySelectorAll('.still .frame').forEach(layoutFrame); }

  function stepFromScroll() {
    var vh = stage.clientHeight || window.innerHeight;
    var rel = (window.scrollY - film.offsetTop) / vh;
    return clamp(Math.round(rel), 0, steps.length - 1);
  }
  function onScroll() {
    var s = stepFromScroll();
    if (s === cur && !rewinding) return;
    if (rewinding) {
      if (s === 1) return;         /* still rewinding toward the voice note */
      abortRewind();
    }
    if (cur === 0 && s === 1) { runRewind(); return; }
    go(s, cur >= 0);
  }

  function show_(f, mode) {
    frames.forEach(function (o) { if (o !== f) o.classList.remove('on', 'in', 'flip'); });
    f.classList.remove('in', 'flip');
    if (mode === 'flip') f.classList.add('flip');
    if (mode === 'in') { void f.offsetWidth; f.classList.add('in'); }
    f.classList.add('on');
  }
  function go(s, animate) {
    var prev = frames[cur];
    cur = s;
    var f = frames[s];
    clearTimeout(settleT);
    if (prev && prev !== f) resetTaps(prev);
    if (prev && prev._step.id === 'voice' && f._step.id !== 'voice' && voice.playing) stopVoice(false);
    stage.classList.remove('rewinding');
    show_(f, animate ? 'in' : null);
    settleT = setTimeout(function () { settle(f); }, animate ? 650 : 400);
  }
  function settle(f) {
    var cards = f.querySelectorAll('.tap');
    Array.prototype.forEach.call(cards, function (c, i) {
      setTimeout(function () { if (frames[cur] === f) c._press(); }, i * 520);
    });
  }
  function resetTaps(f) { Array.prototype.forEach.call(f.querySelectorAll('.tap'), function (c) { c._reset(); }); }

  /* The rewind: hard cuts through every scene, 01 -> 17, each frame shorter than the last. */
  function runRewind() {
    rewinding = true;
    clearTimeout(settleT);
    resetTaps(frames[cur]);
    stage.classList.add('rewinding');
    var seq = ORDER.map(function (id) {
      for (var i = steps.length - 1; i >= 1; i--) if (steps[i].id === id) return frames[i];
      return frames[0];
    });
    var n = seq.length, k = 0;
    function next() {
      if (!rewinding) return;
      if (k >= n) { rewinding = false; go(1, false); return; }
      var f = seq[k];
      show_(f, 'flip');
      readout.firstChild.textContent = f._step.id === 'voice' ? joinWhen(cfg.voice.when, cfg.voice.time) : str(f._stage.when);
      var d = 150 - (100 * k / (n - 1)); /* 150 ms down to 50 ms: ~1.7 s in all */
      k++;
      rewindT = setTimeout(next, k === n ? 220 : d * 0.88);
    }
    next();
  }
  function abortRewind() {
    rewinding = false;
    clearTimeout(rewindT);
    stage.classList.remove('rewinding');
  }

  /* ---------- still: stacked, no rewind, taps already done ---------- */
  function buildStill() {
    var wrap = h('div', 'stack');
    steps.forEach(function (st, i) {
      var f = buildFrame(st, i);
      f.classList.add('on');
      Array.prototype.forEach.call(f.querySelectorAll('.tap'), function (c) { c._press(); });
      frames.push(f);
      wrap.appendChild(f);
    });
    show.textContent = '';
    show.appendChild(wrap);
    window.addEventListener('resize', function () { frames.forEach(layoutFrame); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { frames.forEach(layoutFrame); });
    frames.forEach(layoutFrame);
  }
})();
