/* show.js: the v4 show. The story is told inside the product.
   Loads brands/<id>.json (?brand=, default ondri). A plain dark stage holds two objects: behind and to the left,
   the stage's scene as a framed print (scenes/<brand>/NN-id.webp, device scenes from scenes/_shared/) turned a few
   degrees in 3D, with the time and title written on it as its caption; in front, overlapping it, the brandcos
   window as a device-like panel. They drift a little apart while you scroll (parallax()). The window holds
   - the presence strip: the chief of staff is always on. Running / Managing / Monitoring with counts, and an
     activity line that types itself and rotates every 2.5 s (stage.presence). Each mode opens its list.
   - four real tabs: Feed (the chief of staff's posts, accumulating), Chat (stage.surfaces.chat), OS
     (stage.surfaces.os table) and Hub (stage.surfaces.hub metrics with source + fetched time).
   - ONE decision card (.cos-card) for every stage with a human tap (stage.card, or stage.decision on the listing
     stage, whose stage.card is the listing tile). The same card renders in the feed post, the chat thread, on the
     OS record row and in the Hub when a monitored signal raised it. Its state is shared per stage
     (pending -> pressing -> done): press it anywhere, it changes everywhere. It presses itself when the stage settles.
   Narrative (scroll-driven): open on delivered with the full feed -> first scroll rewinds (feed scrolls back fast,
   timestamps, scene and presence roll back) -> the voice note -> forward, one stage per scroll step -> ending.js.
   html.still (prefers-reduced-motion or ?still): no rewind animation, presence as a static list, no scene loops.
   Scene loops: scenes/<brand>/NN-id.mp4 (or scenes/_shared/ for device scenes), if present, plays muted over the
   still on the current stage only (setLoop()). */
(function () {
  'use strict';

  var root = document.documentElement;
  var STILL = root.classList.contains('still');

  var ORDER = ['delivered', 'courier', 'packed', 'order', 'support', 'listing', 'ad', 'shoot', 'kitting',
    'qc', 'inbound', 'po', 'packaging', 'formula', 'hire', 'meeting', 'voice'];
  var DEVICE = { order: 1, support: 1, listing: 1, ad: 1, voice: 1 };
  var FWD = ORDER.slice().reverse(); /* voice .. delivered */
  var TITLES = {
    voice: 'The idea', meeting: 'The meeting', hire: 'The hire', formula: 'The formula', packaging: 'The packaging',
    po: 'The purchase order', inbound: 'The shipment in', qc: 'The quality check', kitting: 'Kitting', shoot: 'The shoot',
    ad: 'The ads', listing: 'The product page', support: 'The question', order: 'The order', packed: 'Packed',
    courier: 'The courier', delivered: 'Delivered'
  };
  var AUTO = { support: 'chat', meeting: 'chat', shoot: 'chat', po: 'os', inbound: 'os', qc: 'os', kitting: 'os',
    order: 'os', packed: 'os', courier: 'hub', ad: 'hub', listing: 'hub' };
  var TABS = [['feed', 'Feed'], ['chat', 'Chat'], ['os', 'OS'], ['hub', 'Hub']];
  var MODES = [['running', 'Running'], ['managing', 'Managing'], ['monitoring', 'Monitoring']];
  var AGENT = 'Chief of staff';

  var params = new URLSearchParams(location.search);
  var brandId = (params.get('brand') || 'ondri').toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'ondri';

  var cfg, byId = {}, STEPS = [], cur = -1, target = 0, rewinding = false, tab = 'feed';
  var cards = {};      /* stage id -> { state, choice, timer } : the one shared card state */
  var posts = {};      /* stage id -> feed post element */
  var ui = {};

  /* ---------- helpers ---------- */
  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function str(v, d) { return (typeof v === 'string' && v.trim()) ? v.trim() : (d || ''); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function sceneSrc(id) {
    var n = ORDER.indexOf(id) + 1, nn = (n < 10 ? '0' : '') + n + '-' + id;
    return DEVICE[id] ? 'scenes/_shared/' + nn + '.webp' : 'scenes/' + brandId + '/' + nn + '.webp';
  }
  /* a scene may also have a short loop beside its still (same path, .mp4); the still stays underneath as poster/fallback */
  function loopSrc(id) { return sceneSrc(id).replace(/\.webp$/, '.mp4'); }
  function initialOf(name) { return str(name, '?').charAt(0).toUpperCase(); }

  /* ---------- load ---------- */
  fetch('brands/' + brandId + '.json', { cache: 'no-cache' }).then(function (r) {
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }).then(init).catch(function () {
    var s = document.getElementById('stage');
    s.textContent = '';
    s.appendChild(h('p', 'msg', 'Could not load the brand file for "' + brandId + '".'));
  });

  function init(raw) {
    cfg = raw && typeof raw === 'object' ? raw : {};
    cfg.brand = cfg.brand || {};
    cfg.intro = cfg.intro || {};
    cfg.voice = cfg.voice || {};
    arr(cfg.stages).forEach(function (s) { if (s && ORDER.indexOf(s.id) >= 0) byId[s.id] = s; });
    ORDER.forEach(function (id) { if (!byId[id]) byId[id] = { id: id, when: '', line: '', tap: null, tags: [] }; });
    ORDER.forEach(function (id) {
      var d = decisionOf(id);
      if (d) cards[id] = { state: 'pending', choice: recIndex(d), timer: null };
    });
    document.title = str(cfg.brand.name, 'One order') + ': one order, the feed';
    STEPS = ['open'].concat(FWD);
    preload();
    build();
    if (window.renderEnding) window.renderEnding(cfg, document.getElementById('end'));
    layout();
    addEventListener('resize', layout);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    layout(); /* again, now the print has its caption */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  }

  function preload() {
    ORDER.forEach(function (id) {
      var i = new Image();
      i.src = sceneSrc(id);
      if (i.decode) i.decode().catch(function () {});
    });
  }

  /* ---------- data with defaults ---------- */
  function surf(id) {
    var s = byId[id], sf = s.surfaces && typeof s.surfaces === 'object' ? s.surfaces : {};
    var chat = arr(sf.chat).length ? sf.chat : (s.line ? [{ who: AGENT, agent: true, time: clockPart(s.when), text: s.line }] : []);
    var os = sf.os && arr(sf.os.rows).length ? sf.os : {
      title: TITLES[id], cols: ['Field', 'Value'],
      rows: arr(s.tags).map(function (t, i) { return ['Note ' + (i + 1), str(t && t.text)]; })
    };
    var hub = sf.hub && arr(sf.hub.metrics).length ? sf.hub.metrics : [];
    return { thread: str(sf.thread, 'General'), chat: chat, os: os, hub: hub };
  }
  function presenceOf(id) {
    var p = byId[id].presence || {}, s = byId[id];
    function list(k, d) { var a = arr(p[k]).filter(function (x) { return str(x); }); return a.length ? a : d; }
    var tap = s.tap || null;
    return {
      running: list('running', [str(s.line, 'Keeping the day moving').split(',')[0]]),
      managing: list('managing', tap ? ['Waiting on ' + tap.who + ': ' + tap.what] : ['Nothing waiting on anyone']),
      monitoring: list('monitoring', ['Orders, live', 'Stock cover, daily', 'Ad ROAS, hourly'])
    };
  }
  function decisionOf(id) {
    var s = byId[id];
    if (!s || !s.tap) return null;
    var d = s.decision || s.card;
    return d && d.ask && arr(d.options).length ? d : null;
  }
  function recIndex(d) {
    var i = arr(d.options).findIndex(function (o) { return o && o.recommended; });
    return i < 0 ? 0 : i;
  }
  function clockPart(when) { var m = /(\d{1,2}:\d{2}\s*[ap]m)/i.exec(str(when)); return m ? m[1] : ''; }
  function whenFull(id) {
    var s = byId[id], w = str(s.when);
    if (clockPart(w)) return w;
    var first = surf(id).chat.filter(function (m) { return m.agent; })[0];
    return first && first.time ? (w ? w + ', ' : '') + first.time : w;
  }

  /* ---------- build the frame ---------- */
  function build() {
    var stage = document.getElementById('stage');
    stage.textContent = '';
    ui.track = document.getElementById('track');

    /* object 1: the scene as a framed print, its caption (time + title + counter) written under the picture */
    ui.print = h('figure', 'sv-print');
    ui.print.style.margin = '0';
    ui.scene = h('div', 'sv-shot');
    ui.img = h('img');
    ui.img.alt = '';
    ui.img.addEventListener('error', function () { ui.scene.classList.add('no-image'); });
    ui.img.addEventListener('load', function () { ui.scene.classList.remove('no-image'); });
    ui.scene.appendChild(ui.img);
    if (!STILL) ui.scene.appendChild(buildLoop());
    ui.print.appendChild(ui.scene);

    ui.cap = h('figcaption', 'sv-cap');
    ui.capW = h('p', 'sv-cap-w');
    ui.capT = h('p', 'sv-cap-t');
    ui.capN = h('p', 'sv-cap-n');
    ui.prog = h('div', 'sv-prog');
    ui.prog.appendChild(h('i'));
    ui.cap.appendChild(ui.capW); ui.cap.appendChild(ui.capT); ui.cap.appendChild(ui.capN); ui.cap.appendChild(ui.prog);
    ui.cap.setAttribute('aria-live', 'polite');
    ui.print.appendChild(ui.cap);
    stage.appendChild(ui.print);

    var win = h('section', 'sv-win');
    win.setAttribute('aria-label', str(cfg.brand.name, 'Brand') + ' in brandcos');
    ui.win = win;

    var bar = h('header', 'sv-bar');
    var crumbs = h('div', 'sv-crumbs');
    crumbs.appendChild(h('span', 'sv-logo', initialOf(cfg.brand.name))).setAttribute('aria-hidden', 'true');
    crumbs.appendChild(h('b', '', str(cfg.brand.name, 'Brand')));
    crumbs.appendChild(h('span', 'sv-sep', '/'));
    ui.crumb = crumbs.appendChild(h('span', 'sv-sec', 'Feed'));
    bar.appendChild(crumbs);
    ui.clock = bar.appendChild(h('span', 'sv-clock mono'));
    win.appendChild(bar);

    win.appendChild(buildPresence());

    var tabs = h('div', 'sv-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Surfaces');
    ui.tabs = {};
    ui.panels = {};
    var body = h('div', 'sv-body');
    TABS.forEach(function (t) {
      var b = h('button', '', t[1]);
      b.type = 'button';
      b.id = 'tab-' + t[0];
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', 'panel-' + t[0]);
      b.addEventListener('click', function () { setTab(t[0]); });
      b.addEventListener('keydown', function (e) {
        var i = TABS.findIndex(function (x) { return x[0] === t[0]; });
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          var n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length][0];
          setTab(n); ui.tabs[n].focus(); e.preventDefault();
        }
      });
      if (t[0] === 'feed') { ui.feedN = h('span', 'tab-n', '0'); b.appendChild(ui.feedN); }
      ui.tabs[t[0]] = tabs.appendChild(b);
      var p = h('div', 'sv-panel');
      p.id = 'panel-' + t[0];
      p.setAttribute('role', 'tabpanel');
      p.setAttribute('aria-labelledby', 'tab-' + t[0]);
      p.tabIndex = 0;
      ui.panels[t[0]] = body.appendChild(p);
    });
    win.appendChild(tabs);
    win.appendChild(body);
    ui.feed = ui.panels.feed.appendChild(h('ol', 'feed'));
    ui.feed.setAttribute('aria-label', 'The chief of staff, post by post');
    stage.appendChild(win);
    setTab('feed');
  }

  /* ---------- the scene loop: muted, looping, inline, over the still ----------
     One <video> on the print, so only the current stage's loop ever plays; it is shown only once it is actually
     playing (a hard cut from the still, whose first frame it matches) and paused whenever the stage leaves the screen
     or the tab is hidden. Existence is checked once per file with a HEAD request; a 404 or a decode error keeps the
     still. Reduced motion (html.still) never builds it. */
  var loops = {};            /* src -> Promise<boolean> */
  var stageSeen = true;
  function buildLoop() {
    var v = h('video', 'sv-vid');
    v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true; v.autoplay = true;
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
    v.setAttribute('disablepictureinpicture', '');
    v.preload = 'auto';
    v.addEventListener('playing', function () { if (v.getAttribute('src') === v._want) ui.scene.classList.add('has-vid'); });
    v.addEventListener('error', function () {
      if (v._want) loops[v._want] = Promise.resolve(false);
      ui.scene.classList.remove('has-vid');
    });
    v._want = '';
    ui.vid = v;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { stageSeen = es[0].isIntersecting; playLoop(); })
        .observe(document.getElementById('stage'));
    }
    document.addEventListener('visibilitychange', playLoop);
    return v;
  }
  function hasLoop(src) {
    if (!loops[src]) {
      loops[src] = fetch(src, { method: 'HEAD', cache: 'no-cache' }).then(function (r) {
        var ct = r.headers.get('content-type') || '';
        return r.ok && !/html/i.test(ct);
      }).catch(function () { return false; });
    }
    return loops[src];
  }
  function playLoop() {
    var v = ui.vid;
    if (!v || !v._want || v.getAttribute('src') !== v._want) return;
    if (stageSeen && !document.hidden) { if (v.paused) { var pr = v.play(); if (pr) pr.catch(function () {}); } }
    else if (!v.paused) v.pause();
  }
  function setLoop(id) {
    var v = ui.vid;
    if (!v) return;
    var want = id ? loopSrc(id) : '';
    if (want === v._want) { playLoop(); return; }
    v._want = want;
    ui.scene.classList.remove('has-vid');
    if (!v.paused) v.pause();
    if (v.getAttribute('src')) { v.removeAttribute('src'); v.load(); }
    if (!want) return;
    hasLoop(want).then(function (ok) {
      if (!ok || v._want !== want) return;
      v.setAttribute('src', want);
      playLoop();
    });
  }

  /* The track holds one viewport per step, plus HOLD of a viewport after the last one, so the delivered stage
     stays pinned and settled before the ending scrolls in under it (no half-moved stage over the ending). */
  var HOLD = 0.6;
  function layout() {
    ui.stage = document.getElementById('stage');
    var vh = ui.stage.clientHeight || innerHeight;
    ui.vh = vh;
    ui.track.style.height = Math.round((STEPS.length + HOLD) * vh) + 'px';
    /* phones: the window starts just under the print, so the print lies across its top edge by 18px */
    if (matchMedia('(max-width: 760px)').matches) {
      ui.stage.style.setProperty('--mtop', Math.round(ui.print.offsetTop + ui.print.offsetHeight - 18) + 'px');
    } else ui.stage.style.removeProperty('--mtop');
    parallax();
  }

  /* ---------- the two objects drift apart a little as you scroll ----------
     q = steps scrolled (continuous). wave = (1 - cos 2 pi q) / 2 is 0 on every settled step and 1 halfway between,
     so the print and the window lift by different amounts while you scroll and come back to rest; drift is the slow
     travel over the whole story. Both are CSS variables the two objects read with their own multipliers. */
  var pxRaf = 0;
  function parallax() {
    if (STILL || !ui.stage || !ui.vh) return;
    var q = clamp((scrollY - ui.track.offsetTop) / ui.vh, 0, STEPS.length - 1);
    var wave = (1 - Math.cos(2 * Math.PI * q)) / 2;
    var drift = q / (STEPS.length - 1) - 0.5;
    ui.stage.style.setProperty('--wave', wave.toFixed(4));
    ui.stage.style.setProperty('--drift', drift.toFixed(4));
  }

  /* ---------- presence: always on ---------- */
  var rot = { items: [], i: 0, timer: null, typer: null, open: null, pres: null };
  function buildPresence() {
    var w = h('div', 'sv-pres');
    w.setAttribute('aria-label', 'Chief of staff, always on');
    var row = h('div', 'pr-row');
    var who = h('div', 'pr-who');
    who.appendChild(h('span', 'pr-mark', 'C')).setAttribute('aria-hidden', 'true');
    var t = h('span');
    t.appendChild(h('b', '', AGENT));
    t.appendChild(document.createTextNode(' '));
    t.appendChild(h('span', 'muted', 'always on'));
    who.appendChild(t);
    row.appendChild(who);
    var modes = h('div', 'pr-modes');
    ui.modeBtn = {};
    MODES.forEach(function (m) {
      var b = h('button', 'pr-m');
      b.type = 'button';
      b.setAttribute('aria-expanded', 'false');
      b.setAttribute('aria-controls', 'pr-list');
      b.appendChild(h('span', '', m[1]));
      b._n = b.appendChild(h('span', 'n mono', '0'));
      b.addEventListener('click', function () { toggleMode(m[0]); });
      ui.modeBtn[m[0]] = modes.appendChild(b);
    });
    row.appendChild(modes);
    w.appendChild(row);

    var now = h('div', 'pr-now');
    now.setAttribute('aria-live', 'off');
    ui.prK = now.appendChild(h('span', 'pr-k mono'));
    ui.prT = now.appendChild(h('span', 'pr-txt'));
    ui.prBar = now.appendChild(h('span', 'pr-bar'));
    ui.prBar.appendChild(h('i'));
    w.appendChild(now);

    ui.prStatic = w.appendChild(h('div', 'pr-static'));
    ui.prList = h('ul', 'pr-list');
    ui.prList.id = 'pr-list';
    ui.prList.hidden = true;
    w.appendChild(ui.prList);
    document.addEventListener('click', function (e) {
      if (rot.open && !w.contains(e.target)) toggleMode(rot.open);
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && rot.open) toggleMode(rot.open); });
    return w;
  }
  function setPresence(id, rolling) {
    var p = presenceOf(id);
    rot.pres = p;
    MODES.forEach(function (m) { ui.modeBtn[m[0]]._n.textContent = String(p[m[0]].length); });
    if (rot.open) fillList(rot.open);
    ui.prStatic.textContent = '';
    MODES.forEach(function (m) {
      var col = h('div');
      col.appendChild(h('p', 'mono', m[1] + ', ' + p[m[0]].length));
      var ul = h('ul');
      p[m[0]].forEach(function (x) { ul.appendChild(h('li', '', x)); });
      col.appendChild(ul);
      ui.prStatic.appendChild(col);
    });
    /* interleave: running, managing, monitoring, running ... */
    var items = [], max = Math.max(p.running.length, p.managing.length, p.monitoring.length);
    for (var i = 0; i < max; i++) MODES.forEach(function (m) { if (p[m[0]][i]) items.push([m[1], p[m[0]][i]]); });
    rot.items = items;
    rot.i = 0;
    clearInterval(rot.timer);
    clearInterval(rot.typer);
    if (rolling) { showItem(true); return; }
    showItem(STILL);
    if (!STILL) rot.timer = setInterval(function () { rot.i = (rot.i + 1) % rot.items.length; showItem(false); }, 2500);
  }
  function showItem(instant) {
    var it = rot.items[rot.i];
    if (!it) return;
    ui.prK.textContent = it[0];
    clearInterval(rot.typer);
    ui.prBar.classList.remove('go');
    if (instant) { ui.prT.textContent = it[1]; return; }
    var n = 0, text = it[1];
    ui.prT.textContent = '';
    rot.typer = setInterval(function () {
      n += 2;
      ui.prT.textContent = text.slice(0, n);
      if (n >= text.length) clearInterval(rot.typer);
    }, 22);
    void ui.prBar.offsetWidth; /* restart the progress cue */
    ui.prBar.classList.add('go');
  }
  function fillList(mode) {
    var lab = MODES.filter(function (m) { return m[0] === mode; })[0][1];
    ui.prList.textContent = '';
    ui.prList.appendChild(h('li', 'pr-lh mono', lab + ' now, ' + rot.pres[mode].length));
    rot.pres[mode].forEach(function (x) { ui.prList.appendChild(h('li', '', x)); });
  }
  function toggleMode(mode) {
    var open = rot.open === mode ? null : mode;
    rot.open = open;
    MODES.forEach(function (m) { ui.modeBtn[m[0]].setAttribute('aria-expanded', String(m[0] === open)); });
    ui.prList.hidden = !open;
    if (open) fillList(open);
  }

  /* ---------- the one card ---------- */
  function makeCard(id) {
    var d = decisionOf(id);
    if (!d) return null;
    var c = h('div', 'cos-card');
    c.setAttribute('data-card', id);
    var hd = h('div', 'cc-h');
    hd.appendChild(h('span', 'cc-mark', 'C')).setAttribute('aria-hidden', 'true');
    var who = h('span', 'cc-who');
    who.appendChild(h('b', '', AGENT));
    who.appendChild(h('span', 'cc-area', str(d.area, 'Decision')));
    hd.appendChild(who);
    c._st = hd.appendChild(h('span', 'cc-st'));
    c.appendChild(hd);
    c.appendChild(h('p', 'cc-ask', str(d.ask)));
    var opts = h('div', 'cc-opts');
    opts.setAttribute('role', 'radiogroup');
    opts.setAttribute('aria-label', str(d.ask, 'Options'));
    c._opts = d.options.map(function (o, i) {
      var b = h('button', 'cc-opt');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.appendChild(h('span', 'cc-ol', str(o.label)));
      if (o.recommended) b.appendChild(h('span', 'cc-rec', 'Recommended'));
      b.addEventListener('click', function () {
        var s = cards[id];
        if (s.state !== 'pending') return;
        s.choice = i;
        sync(id);
      });
      return opts.appendChild(b);
    });
    c.appendChild(opts);
    var f = h('div', 'cc-f');
    var go = h('button', 'cc-go', str(d.action, 'Approve'));
    go.type = 'button';
    go.addEventListener('click', function () { press(id); });
    f.appendChild(go);
    f.appendChild(h('span', 'cc-for', 'For ' + str(d.by, 'the team')));
    c.appendChild(f);
    c._done = c.appendChild(h('p', 'cc-done'));
    c._chk = c.appendChild(h('p', 'cc-chk mono'));
    paint(c);
    return c;
  }
  function paint(c) {
    var id = c.getAttribute('data-card'), s = cards[id], d = decisionOf(id), tap = byId[id].tap || {};
    c.setAttribute('data-state', s.state);
    var done = s.state === 'done';
    c._st.textContent = done ? 'Done' : 'Waiting on ' + str(d.by, 'the team');
    c._opts.forEach(function (b, i) {
      b.setAttribute('aria-checked', String(i === s.choice));
      b.disabled = s.state !== 'pending';
    });
    c._done.hidden = !done;
    c._chk.hidden = !done;
    if (done) {
      c._done.textContent = str(tap.who, d.by) + ' ' + str(tap.what, 'approved it') + (tap.cost ? ' · ' + tap.cost : '');
      c._chk.textContent = 'Checked by ' + str(d.checker, AGENT);
    }
  }
  function sync(id) {
    document.querySelectorAll('.cos-card[data-card="' + id + '"]').forEach(paint);
  }
  function press(id) {
    var s = cards[id];
    if (!s || s.state !== 'pending') return;
    clearTimeout(s.timer);
    s.state = 'pressing';
    sync(id);
    setTimeout(function () { s.state = 'done'; sync(id); counter(); }, STILL ? 0 : 380);
  }

  /* ---------- the voice note ---------- */
  var voice = { playing: false, t0: 0, at: 0, dur: 10, raf: 0, audio: null, words: [] };
  function voiceDur() {
    var vm = surf('voice').chat.filter(function (m) { return m.voice; })[0];
    var m = vm && /^(\d+):(\d{2})$/.exec(str(vm.length));
    if (m) return +m[1] * 60 + +m[2];
    return Math.max(6, str(cfg.voice.words).split(/\s+/).length * 0.42);
  }
  function fmt(s) { s = Math.round(s); return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60); }
  function voiceBlock(withWords) {
    var wrap = h('div', 'vn-wrap');
    var row = h('div', 'vn');
    var b = h('button', 'vn-play', voice.playing ? 'Pause' : 'Play');
    b.type = 'button';
    b.setAttribute('aria-label', (voice.playing ? 'Pause ' : 'Play ') + str(cfg.voice.who, 'the founder') + '’s voice note');
    b.addEventListener('click', toggleVoice);
    row.appendChild(b);
    var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'vn-bars');
    svg.setAttribute('viewBox', '0 0 240 28');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 48; i++) {
      var hh = 6 + Math.round(20 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.31)));
      var r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', i * 5); r.setAttribute('y', (28 - hh) / 2);
      r.setAttribute('width', 3); r.setAttribute('height', hh); r.setAttribute('rx', 1.5);
      svg.appendChild(r);
    }
    row.appendChild(svg);
    row.appendChild(h('span', 'vn-time mono', fmt(voice.at) + ' / ' + fmt(voice.dur)));
    wrap.appendChild(row);
    if (withWords) {
      var p = h('p', 'vn-words');
      str(cfg.voice.words).split(/\s+/).forEach(function (w, i) {
        if (i) p.appendChild(document.createTextNode(' '));
        p.appendChild(h('span', 'w', w));
      });
      wrap.appendChild(p);
    }
    paintVoice(wrap);
    return wrap;
  }
  function paintVoice(scope) {
    var p = voice.dur ? clamp(voice.at / voice.dur, 0, 1) : 0;
    (scope || document).querySelectorAll('.vn-bars').forEach(function (svg) {
      var rs = svg.querySelectorAll('rect');
      rs.forEach(function (r, i) { r.classList.toggle('on', i / rs.length < p); });
    });
    (scope || document).querySelectorAll('.vn-words').forEach(function (pw) {
      var ws = pw.querySelectorAll('.w'), n = Math.ceil(p * ws.length);
      ws.forEach(function (w, i) { w.classList.toggle('lit', i < n); });
    });
    (scope || document).querySelectorAll('.vn-time').forEach(function (t) { t.textContent = fmt(voice.at) + ' / ' + fmt(voice.dur); });
    (scope || document).querySelectorAll('.vn-play').forEach(function (b) {
      b.textContent = voice.playing ? 'Pause' : 'Play';
      b.setAttribute('aria-label', (voice.playing ? 'Pause ' : 'Play ') + str(cfg.voice.who, 'the founder') + '’s voice note');
    });
  }
  function toggleVoice() {
    if (voice.playing) { stopVoice(false); return; }
    if (voice.at >= voice.dur) voice.at = 0;
    voice.playing = true;
    voice.t0 = performance.now() - voice.at * 1000;
    var src = str(cfg.voice.audio);
    if (src) {
      try {
        voice.audio = voice.audio || new Audio(src);
        voice.audio.currentTime = voice.at;
        voice.audio.play().catch(function () { voice.audio = null; });
      } catch (e) { voice.audio = null; }
    }
    tickVoice();
  }
  function tickVoice() {
    if (!voice.playing) return;
    voice.at = voice.audio && !voice.audio.paused ? voice.audio.currentTime : (performance.now() - voice.t0) / 1000;
    if (voice.at >= voice.dur) { voice.at = voice.dur; stopVoice(true); return; }
    paintVoice();
    voice.raf = requestAnimationFrame(tickVoice);
  }
  function stopVoice() {
    voice.playing = false;
    cancelAnimationFrame(voice.raf);
    if (voice.audio) try { voice.audio.pause(); } catch (e) { /* ignore */ }
    paintVoice();
  }

  /* ---------- Feed ---------- */
  function makePost(id) {
    var s = byId[id], sf = surf(id);
    var li = h('li', 'fp');
    li.setAttribute('data-stage', id);
    if (id === 'voice') {
      var who = str(cfg.voice.who, str(cfg.brand.founder, 'Founder'));
      li.appendChild(h('span', 'fp-av is-person', initialOf(who))).setAttribute('aria-hidden', 'true');
      var mv = h('div', 'fp-main');
      var hv = h('div', 'fp-h');
      hv.appendChild(h('b', '', who));
      hv.appendChild(h('span', 'fp-area', 'voice note, ' + sf.thread));
      hv.appendChild(h('time', 'mono', str(s.when, str(cfg.voice.when) + ', ' + str(cfg.voice.time))));
      mv.appendChild(hv);
      mv.appendChild(voiceBlock(true));
      var rep = sf.chat.filter(function (m) { return m.agent; })[0];
      if (rep) {
        var r = h('div', 'fp-reply');
        r.appendChild(h('span', 'fp-av', 'C')).setAttribute('aria-hidden', 'true');
        var rt = h('p');
        rt.appendChild(h('span', 'mono muted', rep.time + '  '));
        rt.appendChild(document.createTextNode(rep.text));
        r.appendChild(rt);
        mv.appendChild(r);
      }
      li.appendChild(mv);
      return li;
    }
    li.appendChild(h('span', 'fp-av', 'C')).setAttribute('aria-hidden', 'true');
    var m = h('div', 'fp-main');
    var hd = h('div', 'fp-h');
    hd.appendChild(h('b', '', AGENT));
    hd.appendChild(h('span', 'fp-area', sf.thread));
    hd.appendChild(h('time', 'mono', whenFull(id)));
    m.appendChild(hd);
    var row = h('div', 'fp-row');
    row.appendChild(h('p', 'fp-t', str(s.line)));
    var th = h('div', 'fp-thumb');
    var im = h('img');
    im.alt = '';
    im.loading = 'lazy';
    im.src = sceneSrc(id);
    im.addEventListener('error', function () { th.hidden = true; });
    th.appendChild(im);
    row.appendChild(th);
    m.appendChild(row);
    var tags = arr(s.tags).filter(function (t) { return t && str(t.text); });
    if (tags.length) {
      var ul = h('ul', 'fp-tags');
      tags.slice(0, 3).forEach(function (t) { ul.appendChild(h('li', '', t.text)); });
      m.appendChild(ul);
    }
    var card = makeCard(id);
    if (card) m.appendChild(card);
    li.appendChild(m);
    return li;
  }
  function setFeed(list, animateNew) {
    var want = {};
    list.forEach(function (id) { want[id] = 1; });
    Array.prototype.slice.call(ui.feed.children).forEach(function (li) {
      li.classList.remove('is-gone', 'is-new');
      if (!want[li.getAttribute('data-stage')]) ui.feed.removeChild(li);
    });
    list.forEach(function (id, i) {
      var p = posts[id] || (posts[id] = makePost(id));
      var at = ui.feed.children[i];
      if (at !== p) {
        var isNew = !p.parentNode;
        ui.feed.insertBefore(p, at || null);
        if (isNew && animateNew && !STILL) p.classList.add('is-new');
      }
    });
    ui.feedN.textContent = String(list.length);
  }
  function feedToEnd() { var p = ui.panels.feed; p.scrollTop = p.scrollHeight; }

  /* ---------- Chat ---------- */
  function renderChat(id) {
    var sf = surf(id), p = ui.panels.chat, d = decisionOf(id);
    p.textContent = '';
    var hd = h('div', 'sv-ph');
    hd.appendChild(h('b', '', '# ' + sf.thread));
    hd.appendChild(h('span', 'mono muted', str(cfg.brand.name) + ', ' + (arr(cfg.team).length || 1) + ' people and the chief of staff'));
    p.appendChild(hd);
    var ul = h('ol', 'ch-msgs');
    var agents = [];
    sf.chat.forEach(function (msg, i) { if (msg.agent) agents.push(i); });
    /* the agent drops the card into the thread: after its first message, or after its summary for picks made on results */
    var after = d ? ((id === 'formula' || id === 'hire') ? agents[agents.length - 1] : agents[0]) : -1;
    if (after == null) after = sf.chat.length - 1;
    sf.chat.forEach(function (msg, i) {
      var li = h('li', 'ch-msg' + (msg.agent ? ' is-agent' : ''));
      var av = h('span', 'ch-av' + (msg.agent ? '' : ' is-person'), msg.agent ? 'C' : initialOf(msg.who));
      av.setAttribute('aria-hidden', 'true');
      li.appendChild(av);
      var b = h('div');
      var mh = h('div', 'ch-msg-h');
      mh.appendChild(h('b', '', str(msg.who, 'Someone')));
      if (msg.time) mh.appendChild(h('span', 'mono', msg.time));
      b.appendChild(mh);
      if (msg.voice) b.appendChild(voiceBlock(true));
      else b.appendChild(h('p', 'ch-body', str(msg.text)));
      if (i === after) {
        var c = makeCard(id);
        if (c) b.appendChild(c);
      }
      li.appendChild(b);
      ul.appendChild(li);
    });
    p.appendChild(ul);
  }

  /* ---------- OS ---------- */
  function renderOS(id) {
    var os = surf(id).os, p = ui.panels.os, d = decisionOf(id);
    p.textContent = '';
    var hd = h('div', 'sv-ph');
    hd.appendChild(h('b', '', str(os.title, TITLES[id])));
    hd.appendChild(h('span', 'mono muted', 'OS, ' + str(d && d.area, surf(id).thread)));
    p.appendChild(hd);
    var cols = arr(os.cols || os.columns), rows = arr(os.rows);
    var wrap = h('div', 'tbl-wrap'), t = h('table', 'tbl');
    if (cols.length) {
      var thead = h('thead'), tr = h('tr');
      cols.forEach(function (c) { var th = h('th', '', c); th.scope = 'col'; tr.appendChild(th); });
      thead.appendChild(tr);
      t.appendChild(thead);
    }
    var tb = h('tbody');
    var at = d ? clamp(typeof d.osRow === 'number' ? d.osRow : 0, 0, Math.max(0, rows.length - 1)) : -1;
    rows.forEach(function (r, i) {
      var tr = h('tr', i === at ? 'is-here' : '');
      arr(r).forEach(function (cell) { tr.appendChild(h('td', '', String(cell))); });
      tb.appendChild(tr);
      if (i === at) {
        var ar = h('tr'), td = h('td', 'att');
        td.colSpan = Math.max(cols.length, arr(r).length, 1);
        td.appendChild(h('p', 'att-l mono', 'Decision on this record'));
        td.appendChild(makeCard(id));
        ar.appendChild(td);
        tb.appendChild(ar);
      }
    });
    t.appendChild(tb);
    wrap.appendChild(t);
    p.appendChild(wrap);
    var upd = clockPart(whenFull(id));
    p.appendChild(h('p', 'os-meta mono', 'Updated by the chief of staff' + (upd ? ' at ' + upd : '') + '. Every row links to its source thread.'));
  }

  /* ---------- Hub ---------- */
  function renderHub(id) {
    var mets = surf(id).hub, p = ui.panels.hub, d = decisionOf(id);
    p.textContent = '';
    var hd = h('div', 'sv-ph');
    hd.appendChild(h('b', '', 'The numbers behind it'));
    hd.appendChild(h('span', 'mono muted', 'each with its source and when it was fetched'));
    p.appendChild(hd);
    if (d && str(d.signal)) {
      var sec = h('div');
      sec.style.marginBottom = '18px';
      sec.appendChild(h('p', 'raised mono', 'Raised by monitoring: ' + d.signal));
      sec.appendChild(makeCard(id));
      p.appendChild(sec);
    }
    var g = h('div', 'kpis');
    mets.forEach(function (m) {
      var k = h('div', 'kpi');
      k.appendChild(h('span', 'kpi-l', str(m.label)));
      k.appendChild(h('span', 'kpi-v', str(m.value)));
      k.appendChild(h('span', 'kpi-s', str(m.source) + (m.fetched ? ', fetched ' + m.fetched : '')));
      g.appendChild(k);
    });
    p.appendChild(g);
    var w = h('div', 'hub-sec');
    w.appendChild(h('p', '', 'Watching now'));
    var ul = h('ul', 'watch');
    presenceOf(id).monitoring.forEach(function (x) {
      var parts = x.split(/,\s*/), li = h('li');
      li.appendChild(h('span', '', parts[0]));
      li.appendChild(h('span', 'mono', parts.slice(1).join(', ') || 'live'));
      ul.appendChild(li);
    });
    w.appendChild(ul);
    p.appendChild(w);
  }

  /* ---------- tabs ---------- */
  function setTab(name) {
    tab = name;
    TABS.forEach(function (t) {
      var on = t[0] === name;
      ui.tabs[t[0]].setAttribute('aria-selected', String(on));
      ui.tabs[t[0]].tabIndex = on ? 0 : -1;
      ui.panels[t[0]].hidden = !on;
    });
    ui.crumb.textContent = TABS.filter(function (t) { return t[0] === name; })[0][1];
    if (name === 'feed') feedToEnd();
  }

  /* ---------- caption + counter ---------- */
  function counter() {
    if (cur < 0) return;
    if (cur === 0) {
      ui.capN.textContent = str(cfg.intro.sub, 'Scroll back through everything it took.');
    } else {
      var n = cur - 1, taps = 0;
      Object.keys(cards).forEach(function (k) { if (cards[k].state === 'done') taps++; });
      ui.capN.textContent = cur === 1 ? 'Everything after it is in the feed.' : 'Steps so far: ' + n + '. Taps by people: ' + taps + '.';
    }
    ui.prog.style.setProperty('--p', String(cur / (STEPS.length - 1)));
  }
  function caption(id, open) {
    if (open) {
      ui.capT.textContent = str(cfg.intro.line, 'This is one order, delivered.');
      ui.capW.textContent = whenFull('delivered');
    } else if (id === 'voice') {
      ui.capT.textContent = str(cfg.voice.lead, 'Before any of it, there was a voice note.');
      ui.capW.textContent = whenFull('voice');
    } else {
      ui.capT.textContent = TITLES[id];
      ui.capW.textContent = whenFull(id);
    }
  }
  function setScene(id, live) {
    var src = sceneSrc(id);
    if (ui.img.getAttribute('src') !== src) ui.img.setAttribute('src', src);
    setLoop(live ? id : null); /* loops play only on a settled stage, never during the rewind */
  }

  /* ---------- the story ---------- */
  function onScroll() {
    if (!ui.vh) return;
    if (!pxRaf) pxRaf = requestAnimationFrame(function () { pxRaf = 0; parallax(); });
    var y = scrollY - ui.track.offsetTop;
    target = clamp(Math.round(y / ui.vh), 0, STEPS.length - 1);
    go(target);
  }
  function go(idx) {
    if (rewinding || idx === cur) return;
    var prev = cur;
    if (prev === 0 && idx > 0 && !STILL) { rewind(); return; }
    apply(idx, prev >= 0 && idx === prev + 1);
  }
  var MIX = { delivered: 'center', voice: 'center', meeting: 'app-l', hire: 'scene-r', formula: 'scene-l', packaging: 'scene-r',
    po: 'app-r', inbound: 'scene-l', qc: 'scene-r', kitting: 'scene-l', shoot: 'scene-r', ad: 'app-l', listing: 'app-r',
    support: 'app-l', order: 'app-r', packed: 'scene-l', courier: 'scene-r' };
  function mixFor(id) { var st = byId[id] || {}; return st.mix || MIX[id] || 'scene-r'; }
  function apply(idx, stepForward) {
    cur = idx;
    ui.stage.setAttribute('data-mix', mixFor(idx === 0 ? 'delivered' : FWD[idx - 1]));
    var open = idx === 0, id = open ? 'delivered' : FWD[idx - 1], pos = open ? FWD.length : idx - 1;
    /* card states follow the story: before now = done, after = pending, now = presses itself */
    Object.keys(cards).forEach(function (k) {
      var s = cards[k], kp = FWD.indexOf(k), d = decisionOf(k);
      clearTimeout(s.timer);
      if (kp < pos) { if (s.state !== 'done') { s.state = 'done'; } }
      else if (kp > pos) { s.state = 'pending'; s.choice = recIndex(d); }
      else if (s.state !== 'done') {
        s.state = 'pending';
        s.timer = setTimeout(function () { if (cur === idx) press(k); }, STILL ? 1200 : 1900);
      }
    });
    setFeed(open ? FWD : FWD.slice(0, idx), stepForward);
    Object.keys(cards).forEach(sync);
    setScene(id, true);
    ui.clock.textContent = whenFull(id);
    caption(id, open);
    setPresence(id, false);
    renderChat(id);
    renderOS(id);
    renderHub(id);
    setTab(open ? 'feed' : (AUTO[id] || 'feed'));
    if (id !== 'voice' && voice.playing) stopVoice();
    paintVoice();
    counter();
  }

  /* first scroll: rewind. The feed scrolls back fast, scene, clock, caption and presence roll back with it. */
  function rewind() {
    rewinding = true;
    if (rot.open) toggleMode(rot.open);
    setTab('feed');
    var frames = FWD.slice().reverse(); /* delivered .. voice */
    var panel = ui.panels.feed, from = panel.scrollTop, T = 1600, t0 = performance.now(), last = -1;
    clearInterval(rot.timer);
    function frame(now) {
      var t = Math.min(1, (now - t0) / T), e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      var k = Math.min(frames.length - 1, Math.floor(t * frames.length));
      if (k !== last) {
        last = k;
        var id = frames[k], kp = FWD.indexOf(id);
        setScene(id);
        ui.clock.textContent = whenFull(id);
        ui.capT.textContent = TITLES[id];
        ui.capW.textContent = whenFull(id);
        setPresence(id, true);
        FWD.forEach(function (sid, i) { if (posts[sid]) posts[sid].classList.toggle('is-gone', i > kp); });
      }
      panel.scrollTop = from * (1 - e);
      if (t < 1) requestAnimationFrame(frame);
      else {
        rewinding = false;
        cur = -1;
        apply(Math.max(1, target), false);
        onScroll(); /* the reader may have moved on (or back) while it rewound */
      }
    }
    requestAnimationFrame(frame);
  }
})();
