/* scroll.js: scroll is the timeline.
   One object stays on screen and the scroll position drives it continuously. The page opens on the delivered
   parcel; the first scroll scrubs its life backwards (parcel -> box -> phone screens -> product -> kit -> QC ->
   carton -> PO samples -> flat box -> trials -> mould -> sketch -> voice note), then scrolls forward through the
   same states one step at a time. At each pause the brandcos window slides in beside the object with what the
   chief of staff did there. Every frame is an interpolation between object states, so it is reversible and has no
   canned transitions.

   Template: ?brand=<id> loads brands/<id>.json and assets/<id>/ (the 12-object kit). The state table below is
   brand-agnostic: it names kit keys, not files. */
(function () {
  'use strict';

  var ORDER = ['voice', 'standup', 'hire', 'samples', 'vendor', 'packaging', 'po', 'shoot',
    'listing', 'ad', 'order', 'packed', 'support', 'courier', 'delivered'];
  var IO = ORDER.indexOf('order');   /* the order screen: the 3D packaging stretch starts here */
  var TITLE = {
    voice: 'The voice note', standup: 'The standup', hire: 'The maker', samples: 'The samples',
    vendor: 'The vendor', packaging: 'The packaging', po: 'The purchase order', shoot: 'The shoot', ad: 'The ad', listing: 'The listing', support: 'Support',
    order: 'The order', packed: 'Packed', courier: 'With the courier', delivered: 'Delivered'
  };

  /* which surface explains each step best (a stage can override with "surface") */
  var SURF = {
    voice: 'feed', standup: 'chat', hire: 'chat', samples: 'hub', vendor: 'os', packaging: 'feed', po: 'os', shoot: 'feed', ad: 'hub', listing: 'feed', support: 'chat', order: 'os',
    packed: 'feed', courier: 'hub', delivered: 'feed'
  };
  var SURF_LINE = {
    feed: 'What it did, as it did it',
    chat: 'The thread where your people talk',
    os: 'The record it keeps',
    hub: 'The numbers, and where they came from'
  };

  /* ---------- object states ----------
     Units: x, y, s (scale), w, h, rad are in B, the object box (B px square). r in degrees. o opacity.
     from / out: where a layer comes from when it enters, and goes when it leaves (defaults: rise and fade). */
  /* kit parts, as crop boxes [left, top, right, bottom] in image fractions (measured from the alpha).
     These defaults are Ohra's kit; a brand can pass its own in config `crops` (any key; missing keys fall back). */
  var TRIALS = [[.03, .195, .215, .8], [.22, .195, .405, .8], [.41, .195, .595, .8], [.6, .195, .785, .8], [.79, .195, .975, .8]];
  var CROPS = {
    trials: TRIALS, pick: 2,                                   /* pick: which trial becomes the product */
    pickAt: { x: .3275, y: -.31, s: .54 },                     /* where the picked trial fades out, on the packaging stop */
    flat: [.045, .045, .68, .965],                             /* the flat carton in box_flat */
    flatLip: { x: .3275, y: .0025, s: .974 },                  /* the product beside (or in front of) the flat carton */
    vL: [.105, .025, .35, .975], vR: [.665, .025, .92, .975],   /* the two other quotes in variants3 */
    qcR: 180,                                                  /* the product turned over under the lens */
    kit: {
      kBullet: { crop: [.215, .105, .34, .46], home: { x: 0, y: -.28 } },
      kTube: { crop: [.42, .025, .59, .465], home: { x: 0, y: .02 } },
      kCap: { crop: [.66, .195, .815, .465], home: { x: 0, y: .3 } },
      kCarton: { crop: [.1, .49, .66, .985], home: { x: -.7, y: .25 } },
      kCard: { crop: [.715, .6, .9, .88], home: { x: .7, y: .25 } }
    }
  };
  function cx(c) { return (c[0] + c[2]) / 2; }
  function cy(c) { return (c[1] + c[3]) / 2; }
  function kitPart(k, c, home) {
    /* a kit piece at its place in the flat-lay; it comes from (and goes back to) the assembled product */
    return { k: k, kit: 'kit_flatlay', crop: c, x: cx(c) - .5, y: cy(c) - .5, s: 1, z: 2,
      from: { x: home.x, y: home.y, s: .8, o: 0 }, out: { x: home.x, y: home.y, s: .8, o: 0 } };
  }
  var S = {};
  function buildStates(own) {
    var C = {}, o = own || {};
    Object.keys(CROPS).forEach(function (k) { C[k] = o[k] != null ? o[k] : CROPS[k]; });
    var kit = {}; Object.keys(CROPS.kit).forEach(function (k) { kit[k] = (o.kit || {})[k] || CROPS.kit[k]; });
    var T = C.trials, P = C.pick, F = C.flat, FL = C.flatLip, PA = C.pickAt, VL = C.vL, VR = C.vR;
    S = {
    voice: [
      { k: 'shadow', dom: 'shadow', y: .47, w: .5, h: .05 },
      { k: 'phone', dom: 'phone', w: .58, h: 1.16, rad: .07, r: -4, screen: 'voice', mob: { w: .76, h: 1.42, r: -2, y: 0 }, out: { s: .5, y: -.25, o: 0 } }
    ],
    standup: [
      { k: 'shadow', dom: 'shadow', y: .47, w: .4, h: .05 },
      { k: 'sketch', kit: 'wireframe_ink', s: .96, x: .22, mob: { x: .34, s: .62, y: .2 }, from: { clip: 0, o: 1 }, out: { s: .3, y: -.28, o: 0 } },
      /* the product: the standup runs in Chief of Staff's Feed; her note is item 1 */
      { k: 'phone', dom: 'phone', x: -.5, y: .02, w: .5, h: 1, rad: .07, r: -3, screen: 'standup', mob: { x: -.25, y: 0, w: .7, h: 1.38, r: -2 }, out: { x: -1.2, o: 0 } }
    ],
    hire: [
      { k: 'shadow', dom: 'shadow', y: .47, w: .9, h: .06 },
      { k: 'mould', kit: 'maker_tool', s: .96, from: { y: .4, o: 0 }, out: { y: .55, o: 0, s: .9 } }
    ],
    samples: [
      { k: 'shadow', dom: 'shadow', y: .47, w: .9, h: .05 }
    ].concat(T.map(function (c, i) {
      /* the five trials rise out of the maker's tool */
      return { k: 'b' + i, kit: 'trials5', crop: c, x: (cx(c) - .5) * .98, y: (cy(c) - .5) * .98, s: .98,
        from: { x: (cx(c) - .5) * .7, y: -.3, s: .35, o: 0 },
        out: i === P ? null : { x: (cx(c) - .5) * 1.9, y: (cy(c) - .5) * .98, o: 0 } };
    })),
    packaging: [
      { k: 'shadow', dom: 'shadow', y: .47, w: .95, h: .05 },
      /* the chosen trial becomes the product; the flat carton slides in beside it */
      { k: 'flat', kit: 'box_flat', crop: F, x: cx(F) - .5, y: cy(F) - .5, s: 1, from: { x: -.6, r: -6, o: 0 }, out: { x: -.7, o: 0 } },
      { k: 'lip', kit: 'hero', x: FL.x, y: FL.y, s: FL.s, from: { o: 0 } }
    ],
    vendor: [
      { k: 'shadow', dom: 'shadow', y: .47, w: .9, h: .05 },
      /* the winning sample becomes the product; two other vendors' samples join it: three quotes */
      { k: 'b' + P, kit: 'trials5', crop: T[P], x: 0, y: 0, s: .5, o: 0 },
      { k: 'vL', kit: 'variants3', crop: VL, x: (cx(VL) - .5) * .96, y: (cy(VL) - .5) * .96, s: .96, from: { x: -.7, o: 0 }, out: { x: -.6, o: 0 } },
      { k: 'lip', kit: 'hero', x: 0, y: 0, s: .96 },
      { k: 'vR', kit: 'variants3', crop: VR, x: (cx(VR) - .5) * .96, y: (cy(VR) - .5) * .96, s: .96, from: { x: .7, o: 0 }, out: { x: .6, o: 0 } }
    ],
    po: [
      { k: 'shadow', dom: 'shadow', y: .47, w: .5, h: .05 },
      /* the chosen product beside its purchase order */
      { k: 'lip', kit: 'hero', s: .8, x: .28, y: -.04, from: { o: 0 } }
    ],
    shoot: [
      { k: 'shadow', dom: 'shadow', y: .47, w: .42, h: .05 },
      /* the parts come back together into the finished product */
      { k: 'lip', kit: 'hero', s: .96, from: { s: .9, o: 0 } }
    ],
    ad: [
      { k: 'shadow', dom: 'shadow', y: .5, w: .5, h: .05 },
      { k: 'device', dom: 'device', w: .5, h: .98, rad: .075, screen: 'ad', from: { s: .7, o: 0 }, out: { s: .7, o: 0 } },
      { k: 'lip', kit: 'hero', s: .48, y: -.12, z: 3 }
    ],
    listing: [
      { k: 'shadow', dom: 'shadow', y: .47, w: 1.1, h: .05 },
      { k: 'device', dom: 'device', w: 1.3, h: .82, rad: .025, screen: 'listing' },
      { k: 'lip', kit: 'hero', s: .58, x: -.31, y: .04, z: 3 }
    ],
    order: [
      { k: 'shadow', dom: 'shadow', y: .5, w: .5, h: .05 },
      { k: 'device', dom: 'device', w: .5, h: .98, rad: .075, screen: 'order' },
      { k: 'lip', kit: 'hero', s: .26, y: -.22, z: 3, out: { x: 0, y: -.05, s: .62, o: 0 } }
    ],
    packed: [],      /* packed, support, courier and delivered are live 3D (box3d.js) */
    support: [
      /* "where's my order?": the support chat beside the sealed parcel */
      { k: 'device', dom: 'device', x: -.95, y: -.02, w: .5, h: .98, rad: .075, r: -3, screen: 'support', z: 4,
        from: { x: -1.3, r: -6, o: 0 }, out: { x: -1.3, r: -6, o: 0 },
        mob: { x: .55, y: .02, w: .44, h: .86, r: -3 } }
    ],
    courier: [],
    delivered: [
      /* the chief of staff's control panel, an object beside the parcel: her order flips to Delivered, then the care note */
      { k: 'notify', dom: 'device', look: 'window', x: -.98, y: -.04, w: 1.02, h: .62, rad: .02, r: -2, screen: 'notify', z: 4,
        from: { x: -1.3, r: -6, o: 0 }, out: { x: -1.35, r: -6, o: 0 },
        mob: { x: 0, y: .95, w: 1.45, h: .8, r: -1.5 } }
    ]
    };
  }
  buildStates(null);

  /* ---------- timeline (in viewport heights) ---------- */
  var L = { intro: 0.9, rew: 0.2, hold: 1.0, trans: 0.6 };
  var SEG = [];
  function buildSegments() {
    var at = 0, last = ORDER.length - 1, i;
    SEG = [];
    SEG.push({ type: 'intro', a: last, b: last, at: at, len: L.intro }); at += L.intro;
    for (i = last; i > 0; i--) { SEG.push({ type: 'rew', a: i, b: i - 1, at: at, len: L.rew }); at += L.rew; }
    for (i = 0; i <= last; i++) {
      SEG.push({ type: 'hold', a: i, b: i, at: at, len: L.hold }); at += L.hold;
      if (i < last) { SEG.push({ type: 'trans', a: i, b: i + 1, at: at, len: L.trans }); at += L.trans; }
    }
    return at;
  }

  /* ---------- helpers ---------- */
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function str(v, d) { return (typeof v === 'string' && v.trim()) ? v.trim() : (d || ''); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  /* one scroll unit = the track's own 100vh. On phones innerHeight changes as the browser bar collapses; the track
     (and the grooves) are laid out in CSS vh, so measuring against it keeps the story from shifting. Same as
     innerHeight on desktop. */
  function VH() { var t = document.getElementById('track'); return t && total ? t.offsetHeight / (total + 1) : innerHeight; }
  var STILL = false, ANIM_SHEET = false;
  try { STILL = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* old browser */ }

  var cfg = {}, byId = {}, brandId = 'ohra', total = 0, box3d = null, SEQ = [], MOBILE = false;
  /* the opening film (time, not scroll): the parcel drops onto her doormat, the phone slides in, wakes, two pings */
  var INTRO = { t0: 0, drop: 1, phone: 1, wake: 1, n1: 1, n2: 1, buzz: 0, done: true };
  function introTick(now) {
    if (!INTRO.t0) INTRO.t0 = now;
    var s = (now - INTRO.t0) / 1000;
    INTRO.drop = clamp(s / 1.1, 0, 1);
    INTRO.phone = smooth(1.3, 2.0, s);
    INTRO.wake = s > 2.2 ? 1 : 0;
    INTRO.n1 = s > 2.5 ? 1 : 0; INTRO.n2 = s > 3.4 ? 1 : 0;
    var b1 = s - 2.5, b2 = s - 3.4;
    INTRO.buzz = (b1 > 0 && b1 < .45 ? Math.sin(b1 * 90) * (1 - b1 / .45) : 0) + (b2 > 0 && b2 < .45 ? Math.sin(b2 * 90) * (1 - b2 / .45) : 0);
    INTRO.done = s > 3.9;
    render();
    if (!INTRO.done) requestAnimationFrame(introTick);
  }
  var stage, objEl, layerEls = {}, capWhen, capTitle, intro, win, ui = {};
  var cards = {};             /* one state per stage card, shared by every surface */
  var cur = -1, curTab = 'feed', userTab = false, lastPos = -1, raf = 0, presTimer = 0, presIdx = 0;

  function kitSrc(key) {
    var a = cfg.assets || {};
    return str(a[key], 'assets/' + brandId + '/' + key + '.webp');
  }

  /* ---------- build ---------- */
  function build() {
    stage = document.getElementById('stage');
    objEl = h('div', 'obj'); stage.appendChild(objEl);

    var cap = h('div', 'cap');
    capWhen = h('p', 'cap-when'); capTitle = h('p', 'cap-title');
    cap.appendChild(capWhen); cap.appendChild(capTitle);
    stage.appendChild(cap); ui.cap = cap;

    intro = h('div', 'intro');
    intro.appendChild(h('h1', 'intro-line', str((cfg.intro || {}).line, 'One order, delivered.')));
    intro.appendChild(h('p', 'intro-sub', str((cfg.intro || {}).sub, 'Scroll back.')));
    /* no headline: the opening is the parcel and her phone */

    var top = h('header', 'top');
    top.appendChild(h('p', 'top-name', 'COS'));
    top.appendChild(h('p', 'top-for', str((cfg.page || {}).title, 'Company OS for consumer brands').replace(/^(COS|Chief of Staff)\s*/i, '')));
    var dl = h('a', 'top-demo', 'Try the demo'); dl.href = '/cos/app/#demo?brand=' + brandId; top.appendChild(dl);
    stage.appendChild(top); ui.top = top;
    /* phone: the caption sheet (solid page colour, full width) and a probe that reads the safe-area insets */
    ui.sheet = h('div', 'sheet'); stage.appendChild(ui.sheet);
    ui.safe = h('div', 'safe-probe'); stage.appendChild(ui.safe);

    buildWindow();
    var ctl = h('div', 'ctl');
    ui.playBtn = h('button', 'ctl-btn ctl-main', 'Play'); ui.playBtn.type = 'button';
    ui.playBtn.addEventListener('click', startPlay); ctl.appendChild(ui.playBtn);
    if (!/[?&]mute\b/.test(location.search) && Object.keys(cfg.audio || {}).length) {   /* no clips, no toggle */
      var sb = h('button', 'ctl-btn', 'Sound off'); sb.type = 'button'; sb.setAttribute('aria-pressed', 'false'); ui.soundBtn = sb;
      sb.addEventListener('click', function () {
        SOUND = !SOUND; sb.textContent = SOUND ? 'Sound on' : 'Sound off'; sb.setAttribute('aria-pressed', String(SOUND));
        if (!SOUND && NOW_AUDIO) { NOW_AUDIO.pause(); NOW_AUDIO = null; }
        if (SOUND) { var u = PLAYER(); u.muted = false; u.volume = 1; u.src = (cfg.audio || {})['voice-note'] || ''; NOW_AUDIO = u; VOICE_T0 = performance.now(); u.onended = function () { if (NOW_AUDIO === u) NOW_AUDIO = null; }; u.play().catch(function (e) { sb.textContent = 'Sound blocked'; }); }
      });
      ctl.appendChild(sb);
    }
    stage.appendChild(ctl); ui.ctl = ctl;
    ui.zig = h('div', 'zig'); stage.appendChild(ui.zig);
    ui.presBar = win.querySelector('.pres'); ui.presBar.classList.add('pres-bar'); stage.appendChild(ui.presBar);
  }

  function makeLayer(def) {
    var el;
    if (def.kit) {
      el = h('img', 'ly ly-img');
      el.src = kitSrc(def.kit); el.alt = ''; el.decoding = 'async';
      if (def.blend) el.classList.add('ly-screen'); if (def.crop) el.classList.add('ly-crop');
    } else if (def.dom === 'shadow') {
      el = h('div', 'ly ly-shadow');
    } else if (def.dom === 'scan') {
      el = h('div', 'ly ly-scan');
    } else {
      el = h('div', 'ly ly-dev' + (def.look === 'window' ? ' ly-win' : ''));
      el.appendChild(h('div', 'dev-screen'));
    }
    el.style.zIndex = def.z || 2;
    objEl.appendChild(el);
    return el;
  }

  /* device screens, drawn in code; each is a child that crossfades by weight */
  function screenEl(dev, name) {
    var scr = dev.firstChild;
    var el = scr.querySelector('[data-s="' + name + '"]');
    if (el) return el;
    el = h('div', 'scr scr-' + name); el.setAttribute('data-s', name);
    var b = cfg.brand || {}, st = byId[name] || {};
    if (name === 'voice') {
      /* the product: Chief of Staff's Chat, her DM with the chief. Her voice note plays; the chief's reply types in. */
      var v = cfg.voice || {}, who = str(v.who, b.founder || 'Founder');
      el.classList.add('scr-app');
      var top = h('div', 'ap-top'); top.appendChild(h('span', 'ap-back', 'Chat'));
      var tt = h('div', 'ap-title'); tt.appendChild(h('b', null, 'Chief of staff')); tt.appendChild(h('span', null, 'Direct message, ' + who)); top.appendChild(tt);
      el.appendChild(top);
      var list = h('div', 'ap-msgs');
      list.appendChild(h('p', 'ap-sys', str(v.when, 'Today') + ', ' + str(v.time, '12:52 am')));
      function apm(nm, agent, time, body) {
        var m = h('div', 'ap-m' + (agent ? ' is-agent' : ''));
        var fc = agent ? markEl('cos', 'ap-face') : faceEl(nm, 'ap-face'); m.appendChild(fc);
        var hd = h('p', 'ap-h'); hd.appendChild(h('b', null, agent ? agentOf('cos')[0] : nm)); hd.appendChild(h('span', null, time)); m.appendChild(hd);
        if (body) m.appendChild(body);
        return m;
      }
      var vn = h('div', 'ap-vn'); vn.appendChild(h('span', 'ap-play'));
      var wv = h('span', 'ap-wave');
      for (var i = 0; i < 26; i++) { var bar = h('i'); bar.style.height = (20 + Math.round(75 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * .45)))) + '%'; wv.appendChild(bar); }
      var pg = h('span', 'ap-prog'); Array.prototype.forEach.call(wv.children, function (x) { var y = h('i'); y.style.height = x.style.height; pg.appendChild(y); }); wv.appendChild(pg);
      vn.appendChild(wv); vn.appendChild(h('span', 'ap-len', str(v.length, '0:16')));
      var vbox = h('div', 'ap-post'); vbox.appendChild(vn);
      if (v.words) vbox.appendChild(h('p', 'ap-tr', v.words));   /* the app transcribes the note */
      list.appendChild(apm(who, false, str(v.time, '12:52 am'), vbox));
      var rep = h('div', 'ap-rep');
      var dots = h('p', 'ap-typing'); dots.appendChild(h('i')); dots.appendChild(h('i')); dots.appendChild(h('i')); rep.appendChild(dots);
      var fb = arr((byId.voice || {}).flow).filter(function (x) { return x.t === 'assign'; })[0];
      rep.appendChild(h('p', 'ap-b', str(v.reply, fb ? fb.text : 'On it. Checking demand tonight.')));
      var rt = str(v.reply_time), tm = str(v.time, '12:52 am').match(/^(\d{1,2}):(\d{2})\s?([ap]m)$/i);
      if (!rt && tm) { var mm = +tm[2] + 1, hh = +tm[1]; if (mm > 59) { mm = 0; hh = hh % 12 + 1; } rt = hh + ':' + (mm < 10 ? '0' : '') + mm + ' ' + tm[3]; }   /* the chief answers a minute later */
      list.appendChild(apm('Chief of staff', true, rt || '12:53 am', rep));
      el.appendChild(list);
      var comp = h('div', 'ap-comp'); comp.appendChild(h('span', 'ap-in', 'Ask in plain words')); comp.appendChild(h('span', 'ap-send', 'Send'));
      el.appendChild(comp); el.insertBefore(statusBar(), el.firstChild); var tbv = tabBar(); tbv.querySelector('[data-t="Chat"]').classList.add('on'); el.appendChild(tbv);
    } else if (name === 'standup') {
      /* the product: Chief of Staff's Feed, the 10 am standup; item 1 is her note, played back with the overnight numbers */
      var v2 = cfg.voice || {}, fl = arr(st.flow), it1 = fl[0] || {}, hubB = arr((byId.voice || {}).flow).filter(function (x) { return x.s === 'hub'; })[0] || {};
      el.classList.add('scr-app');
      var tp = h('div', 'ap-top'); var tt2 = h('div', 'ap-title'); tt2.appendChild(h('b', null, 'Feed')); tt2.appendChild(h('span', null, str(st.when, 'Standup'))); tp.appendChild(tt2); el.appendChild(tp);
      var ls = h('div', 'ap-msgs');
      var post = h('div', 'ap-m is-agent'); post.appendChild(markEl('standup', 'ap-face'));
      var ph2 = h('p', 'ap-h'); ph2.appendChild(h('b', null, agentOf('standup')[0])); ph2.appendChild(h('span', null, (str(st.when).match(/\d{1,2}:\d{2}\s?[ap]m/) || ['10:00 am'])[0])); post.appendChild(ph2);
      var bd = h('div', 'ap-post');
      bd.appendChild(h('p', 'ap-b ap-b-on', str(it1.text, 'Item 1')));
      var vn2 = h('div', 'ap-vn'); vn2.appendChild(h('span', 'ap-play'));
      var wv2 = h('span', 'ap-wave');
      for (var j = 0; j < 22; j++) { var bj = h('i'); bj.style.height = (20 + Math.round(75 * Math.abs(Math.sin(j * 1.3 + 2) * Math.cos(j * .5)))) + '%'; wv2.appendChild(bj); }
      var pg2 = h('span', 'ap-prog'); Array.prototype.forEach.call(wv2.children, function (x) { var y = h('i'); y.style.height = x.style.height; pg2.appendChild(y); }); wv2.appendChild(pg2);
      vn2.appendChild(wv2); vn2.appendChild(h('span', 'ap-len', str(v2.length, '0:16'))); bd.appendChild(vn2);
      if (hubB.text) { var nb = h('p', 'ap-note'); nb.textContent = hubB.text; bd.appendChild(nb); }
      post.appendChild(bd); ls.appendChild(post);
      el.appendChild(ls); el.insertBefore(statusBar(), el.firstChild); var tbs = tabBar(); tbs.querySelector('[data-t="Feed"]').classList.add('on'); el.appendChild(tbs);
    } else if (name === 'ad') {
      el.appendChild(h('div', 'scr-img scr-img-ad'));
      el.appendChild(h('p', 'scr-label', str(b.name) + ', Sponsored'));
      var foot = h('div', 'scr-foot');
      foot.appendChild(h('p', 'scr-strong', str(b.product)));
      foot.appendChild(h('p', 'scr-btn', 'Shop now'));
      el.appendChild(foot);
    } else if (name === 'listing') {
      el.appendChild(h('div', 'scr-bar'));
      el.appendChild(h('div', 'scr-img scr-img-listing'));
      var col = h('div', 'scr-col');
      col.appendChild(h('p', 'scr-label', str(b.name)));
      col.appendChild(h('p', 'scr-strong scr-big', str(b.product)));
      col.appendChild(h('p', 'scr-label', firstTag(st) || 'In stock'));
      col.appendChild(h('p', 'scr-btn', 'Add to bag'));
      el.appendChild(col);
    } else if (name === 'support') {
      el.appendChild(h('p', 'scr-label', str(b.name) + ' support'));
      var chats = arr((st.surfaces || {}).chat);
      if (chats[0]) el.appendChild(h('p', 'bub', chats[0].text));
      /* v2: support is "where's my order?", asked while the parcel waits for pickup: the answer, then her reply */
      if (chats[1]) el.appendChild(h('p', 'bub bub-a', chats[1].text));
      if (chats[2]) el.appendChild(h('p', 'bub', chats[2].text));
    } else if (name === 'notify') {
      var sh = cfg.shipping || {}, dl = byId.delivered || {}, os = ((dl.surfaces || {}).os) || {};
      var met = (((dl.surfaces || {}).hub || {}).metrics || [])[0] || {};
      var today = parseInt(met.value, 10) || 38;
      var bar = h('div', 'cp-bar');
      bar.appendChild(h('span', 'cp-brand', str(b.name)));
      ['Feed', 'Chat', 'OS', 'Hub'].forEach(function (t) { bar.appendChild(h('span', 'cp-tab' + (t === 'OS' ? ' on' : ''), t)); });
      el.appendChild(bar);
      var tiles = h('div', 'cp-tiles');
      function tile(label, a, bv) {
        var t = h('div', 'cp-tile'); var v = h('p', 'cp-v');
        v.appendChild(h('span', 'was', String(a))); v.appendChild(h('span', 'now', String(bv)));
        t.appendChild(v); t.appendChild(h('p', 'cp-l', label)); return t;
      }
      tiles.appendChild(tile(str(met.label, 'Delivered today'), today - 1, today));
      var ofd = parseInt(sh.out_for_delivery, 10) || 12;
      tiles.appendChild(tile('Out for delivery', ofd, ofd - 1));
      el.appendChild(tiles);
      var tb = h('div', 'cp-rows');
      function row(id, to, st, mine) {
        var r = h('div', 'cp-row' + (mine ? ' mine' : ''));
        r.appendChild(h('span', 'cp-id', id)); r.appendChild(h('span', 'cp-to', to));
        var pill = h('span', 'cp-st');
        if (mine) { pill.appendChild(h('span', 'was pill pill-hold', 'Out for delivery')); pill.appendChild(h('span', 'now pill pill-done', 'Delivered ' + str(sh.delivered_at, '6:08 pm'))); }
        else pill.appendChild(h('span', 'pill ' + (st === 'Delivered' ? 'pill-done' : 'pill-hold'), st));
        r.appendChild(pill); return r;
      }
      var others = arr(sh.others).length ? sh.others : [['OH-20412', 'Indiranagar', 'Delivered'], ['OH-20421', 'Bandra West', 'Out for delivery']];
      if (others[0]) tb.appendChild(row(others[0][0], others[0][1], others[0][2]));
      tb.appendChild(row(str(sh.order, 'OH-20418'), str(sh.to_line, '').split(',')[0] + ' ' + str(sh.pin), '', true));
      others.slice(1).forEach(function (o) { tb.appendChild(row(o[0], o[1], o[2])); });
      el.appendChild(tb);
      var ag = h('p', 'cp-agent');
      ag.appendChild(h('span', 'cp-who', 'Chief of staff'));
      ag.appendChild(document.createTextNode(' Care note sent to ' + str(sh.order) + ', ' + str(sh.care_at, '7:10 pm')));
      el.appendChild(ag);
    } else if (name === 'order') {
      el.appendChild(h('p', 'scr-label', str(b.name)));
      el.appendChild(h('div', 'scr-img scr-img-order'));
      el.appendChild(h('p', 'scr-strong scr-big scr-mid', 'Order confirmed'));
      el.appendChild(h('p', 'scr-label', firstTag(st) || str(st.when)));
    }
    scr.appendChild(el);
    return el;
  }
  function firstTag(st) { var t = arr(st.tags)[0]; return t ? str(t.text) : ''; }

  /* ---------- the window: presence strip, four tabs, one shared card ---------- */
  function buildWindow() {
    win = h('section', 'win'); win.setAttribute('aria-label', 'Chief of staff');
    var head = h('div', 'win-head');
    head.appendChild(h('p', 'win-brand', str((cfg.brand || {}).name, 'Brand')));
    var tabs = h('div', 'tabs'); tabs.setAttribute('role', 'tablist');
    ui.tabs = {};
    ['feed', 'chat', 'os', 'hub'].forEach(function (t) {
      var b = h('button', 'tab', t === 'os' ? 'OS' : t.charAt(0).toUpperCase() + t.slice(1));
      b.type = 'button'; b.setAttribute('role', 'tab');
      b.addEventListener('click', function () {
        if (userTab && curTab === t) { userTab = false; buildFlow(); return; }
        userTab = true; setTab(t); renderBody();
      });
      tabs.appendChild(b); ui.tabs[t] = b;
    });
    head.appendChild(tabs);
    win.appendChild(head);
    ui.surfLine = h('p', 'surf-line');

    var pres = h('div', 'pres');
    ui.presModes = {};
    var modes = h('div', 'pres-modes');
    var names = ((cfg.page || {}).strip_modes) || {};
    ['running', 'managing', 'monitoring'].forEach(function (m) {
      var e = h('p', 'pres-mode'); var n = h('span', 'pres-n', '0');
      e.appendChild(n); e.appendChild(document.createTextNode(' ' + str(names[m], m.charAt(0).toUpperCase() + m.slice(1))));
      modes.appendChild(e); ui.presModes[m] = n;
    });
    pres.appendChild(modes);
    ui.presLine = h('p', 'pres-line');
    pres.appendChild(ui.presLine);
    win.appendChild(pres);

    ui.body = h('div', 'win-body');
    win.appendChild(ui.body);
  }

  function setTab(t) {
    curTab = t;
    Object.keys(ui.tabs).forEach(function (k) { ui.tabs[k].setAttribute('aria-selected', k === t ? 'true' : 'false'); });
    ui.surfLine.textContent = SURF_LINE[t];
    win.setAttribute('data-surf', t);
  }

  function decisionOf(st) { return st && st.card && st.card.ask ? st.card : null; }

  function cardEl(id) {
    var st = byId[id], d = decisionOf(st), c = cards[id];
    if (!d) return null;
    var el = h('div', 'cos-card');
    el.setAttribute('data-state', c.state);
    var top = h('p', 'cc-top', 'Chief of staff, ' + str(d.area, 'Decision'));
    el.appendChild(top);
    el.appendChild(h('p', 'cc-ask', d.ask));
    var opts = h('div', 'cc-opts');
    arr(d.options).forEach(function (o, i) {
      var b = h('button', 'cc-opt' + (o.recommended ? ' rec' : '') + (c.state !== 'pending' && i === c.choice ? ' on' : ''), o.label + (o.recommended ? ' (recommended)' : ''));
      b.type = 'button';
      b.addEventListener('click', function () { if (c.state === 'pending') { c.choice = i; press(id); } });
      opts.appendChild(b);
    });
    el.appendChild(opts);
    var tap = st.tap || {};
    el.appendChild(h('p', 'cc-by', c.state === 'done'
      ? str(tap.who, d.by) + ', ' + str(tap.cost, '1 tap') + (d.checker ? '. Checked by ' + d.checker + '.' : '')
      : 'Waiting on ' + str(d.by, 'the team')));
    return el;
  }
  function press(id) {
    var c = cards[id]; if (!c || c.state !== 'pending') return;
    c.state = 'done'; renderBody();
  }

  function post(id, latest) {
    var st = byId[id];
    var p = h('article', 'post' + (latest ? ' post-new' : ''));
    var hd = h('p', 'post-hd');
    hd.appendChild(h('span', 'post-who', 'Chief of staff'));
    hd.appendChild(h('span', 'post-when', str(st.when)));
    p.appendChild(hd);
    p.appendChild(h('p', 'post-line', str(st.line, id === 'voice' ? str((cfg.voice || {}).lead) : '')));
    var tags = arr(st.tags);
    if (tags.length && latest) {
      var chips = h('div', 'chips');
      tags.forEach(function (t) { chips.appendChild(h('span', 'chip', t.text)); });
      p.appendChild(chips);
    }
    if (latest) { var c = cardEl(id); if (c) p.appendChild(c); }
    return p;
  }

  function renderBody() {
    var id = ORDER[cur], st = byId[id] || {}, sf = st.surfaces || {}, body = ui.body;
    body.textContent = '';
    body.appendChild(h('p', 'back', 'Back to the step'));
    body.lastChild.addEventListener('click', function () { userTab = false; buildFlow(); });
    if (curTab === 'feed') {
      var from = Math.max(0, cur - 2);
      for (var i = from; i <= cur; i++) body.appendChild(post(ORDER[i], i === cur));
      body.scrollTop = body.scrollHeight;
    } else if (curTab === 'chat') {
      body.appendChild(h('p', 'sf-title', str(sf.thread, TITLE[id])));
      arr(sf.chat).forEach(function (m) {
        var b = h('div', 'msg' + (m.agent ? ' msg-a' : ''));
        b.appendChild(h('span', 'av', m.agent ? 'C' : str(m.who, '?').charAt(0)));
        var col = h('div', 'msg-col');
        var hd = h('p', 'post-hd'); hd.appendChild(h('span', 'post-who', m.who)); hd.appendChild(h('span', 'post-when', str(m.time)));
        col.appendChild(hd); col.appendChild(h('p', 'msg-text', m.text));
        b.appendChild(col);
        body.appendChild(b);
      });
      var c = cardEl(id); if (c) body.appendChild(c);
    } else if (curTab === 'os') {
      var os = sf.os || {};
      body.appendChild(h('p', 'sf-title', str(os.title, TITLE[id])));
      var tb = h('table', 'os');
      var tr = h('tr'); arr(os.cols).forEach(function (c) { tr.appendChild(h('th', null, c)); }); tb.appendChild(tr);
      var hi = (decisionOf(st) || {}).osRow;
      arr(os.rows).forEach(function (r, ri) {
        var row = h('tr', ri === hi ? 'hi' : null);
        arr(r).forEach(function (v, ci) {
          var td = h('td');
          var pill = /^(Pass|Fail|Delivered|Approved|Draft|Rejected|Checked|Open|Hold|Done|Shipped|Paid|Pending|Low|OK)$/i.test(String(v));
          if (pill && ci > 0) { var sp = h('span', 'pill pill-' + String(v).toLowerCase(), v); td.appendChild(sp); } else td.textContent = v;
          row.appendChild(td);
        });
        tb.appendChild(row);
      });
      body.appendChild(tb);
      var c2 = cardEl(id); if (c2) body.appendChild(c2);
    } else {
      body.appendChild(h('p', 'sf-title', 'Numbers, and where they came from'));
      var g = h('div', 'hub');
      arr((sf.hub || {}).metrics).forEach(function (m) {
        var e = h('div', 'met');
        e.appendChild(h('p', 'met-v', m.value));
        e.appendChild(h('p', 'met-l', m.label));
        e.appendChild(h('p', 'met-s', str(m.source) + (m.fetched ? ', ' + m.fetched : '')));
        g.appendChild(e);
      });
      body.appendChild(g);
      var c3 = cardEl(id); if (c3) body.appendChild(c3);
    }
  }

  function presence() {
    var st = byId[ORDER[cur]] || {}, p = st.presence || {};
    ['running', 'managing', 'monitoring'].forEach(function (m) { ui.presModes[m].textContent = String(arr(p[m]).length); });
    var all = [];
    ['running', 'managing', 'monitoring'].forEach(function (m) { arr(p[m]).forEach(function (t) { all.push(t); }); });
    if (!all.length) { ui.presLine.textContent = ''; return; }
    ui.presLine.textContent = all[presIdx % all.length];
  }

  function enterStage(i) {
    if (i === cur) return;
    cur = i;
    presIdx = 0;
    presence();
  }

  /* ---------- the step, in beats: raised -> assigned -> asks one person (or automatic) -> done ---------- */
  var LABEL = { raised: 'Task raised', assign: 'Chief of staff assigns', auto: 'Done automatically', done: 'Done', q: 'Asked' };
  var flowN = -1;
  function flowOf(id) { return arr((byId[id] || {}).flow); }
  /* where each message lands: the team's channel, the OS area, the Hub source */
  var CHANNEL = { voice: 'aditi-notes', standup: 'standup', hire: 'people', samples: 'npd', vendor: 'purchasing', packaging: 'npd', po: 'purchasing',
    shoot: 'content', ad: 'growth', listing: 'studio-pell', support: 'support',
    order: 'ops', packed: 'warehouse', courier: 'shipping', delivered: 'growth' };
  var AREA = { voice: 'Ideas', standup: 'Projects', hire: 'Hiring', samples: 'Product', vendor: 'Vendors', packaging: 'Packaging', po: 'Purchase orders',
    shoot: 'Content', ad: 'Ads', listing: 'Website', support: 'Orders',
    order: 'Orders', packed: 'Warehouse', courier: 'Shipments', delivered: 'Orders' };
  var SOURCE = { voice: 'Search trends', vendor: 'Quotes', ad: 'Meta Ads', support: 'Support inbox', courier: 'Courier data', delivered: 'Shopify', samples: 'QC log', po: 'Quotes' };
  function mapsFromConfig() {
    /* a brand names its own channels, OS areas and Hub sources; Ohra's are the defaults */
    [[CHANNEL, cfg.channels], [AREA, cfg.areas], [SOURCE, cfg.sources]].forEach(function (pr) {
      Object.keys(pr[1] || {}).forEach(function (k) { pr[0][k] = pr[1][k]; });
    });
  }
  function withMentions(el, text) {
    String(text).split(/(@[A-Z][a-z]+)/).forEach(function (part) {
      if (/^@[A-Z]/.test(part)) el.appendChild(h('b', 'mention', part)); else if (part) el.appendChild(document.createTextNode(part));
    });
    return el;
  }
  /* ---------- who is speaking: faces for people, monogram marks for the chief's agents ---------- */
  var FACES = {
    ohra: ['aditi', 'naina', 'arjun', 'tanvi', 'vikram', 'kavya', 'customer', 'agency'],
    ondri: ['kavya', 'meher', 'rohan', 'tara', 'zoya', 'ira', 'customer', 'agency'],
    siro: ['nikhil', 'pooja', 'farhan', 'leela', 'varun', 'meera', 'customer', 'agency']
  };
  /* each stop is run by one of the chief's agents: a plain role with a monogram mark */
  var AGENTS = {
    voice: ['Meetings agent', 'M'], standup: ['Meetings agent', 'M'], hire: ['Hiring agent', 'H'],
    samples: ['Research agent', 'R'], vendor: ['Vendor agent', 'V'], packaging: ['Project agent', 'P'],
    po: ['Vendor agent', 'V'], shoot: ['Content agent', 'C'], listing: ['Website agent', 'W'],
    ad: ['Ads agent', 'A'], order: ['Ops agent', 'O'], packed: ['Ops agent', 'O'],
    support: ['Support agent', 'S'], courier: ['Ops agent', 'O'], delivered: ['Chief of staff', 'CS']
  };
  function agentOf(sid) { return AGENTS[sid] || ['Chief of staff', 'CS']; }
  function isCustomer(who) { return /customer|,/i.test(str(who)); }
  function isAgency(who) { return /studio|inkline|agency/i.test(str(who)); }
  function faceSlug(who) {
    var w = str(who); if (!w) return '';
    var s = isCustomer(w) ? 'customer' : isAgency(w) ? 'agency' : w.toLowerCase().split(/\s+/)[0];
    return (FACES[brandId] || []).indexOf(s) >= 0 ? s : '';
  }
  /* a face the config supplies (cfg.faces, keyed by name, first name or slug) wins over the built-in brand faces */
  function cfgFace(who) {
    var F = cfg.faces, w = str(who); if (!F || typeof F !== 'object' || !w) return '';
    var keys = [w, personName(w), w.toLowerCase().split(/\s+/)[0], isCustomer(w) ? 'customer' : isAgency(w) ? 'agency' : ''];
    for (var i = 0; i < keys.length; i++) if (keys[i] && typeof F[keys[i]] === 'string' && F[keys[i]]) return F[keys[i]];
    return '';
  }
  function faceEl(who, cls) {
    var cf = cfgFace(who), s = cf ? '' : faceSlug(who), el = h('span', 'face' + (cls ? ' ' + cls : ''));
    if (cf || s) { var im = h('img'); im.alt = ''; im.decoding = 'async'; im.src = cf || 'faces/' + brandId + '-' + s + '.webp'; el.appendChild(im); }
    else { el.classList.add('face-txt'); el.textContent = str(who, '?').charAt(0); }
    return el;
  }
  function markEl(sid, cls) {
    var a = agentOf(sid), el = h('span', 'mk' + (a[1].length > 1 ? ' mk-2' : '') + (cls ? ' ' + cls : ''), a[1]);
    el.setAttribute('aria-hidden', 'true');
    return el;
  }
  function personName(who) { var w = str(who); return isCustomer(w) ? w.replace(/^Customer,?\s*/i, '') || 'Customer' : w; }
  /* the channel a beat arrived in decides what its card looks like; no two channels look alike */
  function kindOf(b, sid) {
    if (b.via === 'whatsapp') return 'whatsapp';
    if (b.via === 'email') return 'email';
    if (b.via === 'meeting') return sid === 'standup' ? 'huddle' : 'meeting';
    if (b.t === 'q') return 'dm';
    if (b.s === 'feed') return 'agent';
    if (b.s === 'os') return 'record';
    if (b.s === 'hub') return (str(b.src, SOURCE[sid]) === 'Quotes' || (b.media && b.media.type === 'doc')) ? 'doc' : 'data';
    var ch = str(b.ch, CHANNEL[sid] || '');
    if (b.media && b.media.type === 'voice' && b.who) return 'voicenote';
    if (isCustomer(b.who)) return 'whatsapp';
    if (isAgency(b.who) || /studio|inkline|agency/.test(ch)) return 'email';
    if (ch === 'support') return 'ticket';
    if (ch === 'standup') return 'huddle';
    return 'team';
  }
  function slugify(s) { return str(s).toLowerCase().replace(/[^a-z0-9]+/g, ''); }
  function recId(text) { var m = String(text || '').match(/\b([A-Z]{2,3}-\d{3,6})\b/); return m ? m[1] : ''; }
  function tickNo(sid) { var n = 0; String(brandId + sid).split('').forEach(function (c) { n = (n * 31 + c.charCodeAt(0)) % 9000; }); return 40000 + n; }
  function authorRow(face, name, meta) {
    var r = h('p', 'k-au'); r.appendChild(face);
    var t = h('span', 'k-au-t'); t.appendChild(h('b', null, name)); if (meta) t.appendChild(h('span', 'k-au-m', meta)); r.appendChild(t);
    return r;
  }
  function makeBeat(b, st) {
    var sid = st.id, kind = kindOf(b, sid), ag = agentOf(sid);
    var c = h('div', 'bc bc-' + b.s + ' bc-t-' + b.t + ' k k-' + kind);
    var mine = !b.who || b.t === 'ask' || b.t === 'assign' || b.t === 'auto' || b.t === 'done';   /* the agent speaks, unless a person raised it */
    var who = b.t === 'raised' && b.who ? b.who : null;
    var paren = (str(b.where).match(/\(([^)]+)\)\s*$/) || [])[1] || '';
    var whereClean = str(b.where).replace(/\s*\([^)]*\)\s*$/, '');
    if (b.via && !who) who = b.who || paren || null;
    if (b.caught) { var cg = h('p', 'k-caught'); cg.appendChild(markEl(sid)); cg.appendChild(h('span', null, b.caught)); c.appendChild(cg); }
    var chName = '#' + str(b.ch, CHANNEL[sid] || 'general');
    var body = function () { return withMentions(h('p', 'bc-text'), (b.t === 'ask' ? '@' + b.who + ' ' : '') + b.text); };
    if (kind === 'team') {
      var bar = h('p', 'k-bar'); bar.appendChild(h('span', 'k-ch', chName)); bar.appendChild(h('span', 'k-app', 'Team chat')); c.appendChild(bar);
      c.appendChild(authorRow(who ? faceEl(who) : markEl(sid), who ? personName(who) : ag[0], null));
      c.appendChild(body());
    } else if (kind === 'whatsapp') {
      var wb = h('p', 'k-bar'); wb.appendChild(h('span', 'k-ch', 'WhatsApp')); wb.appendChild(h('span', 'k-app', whereClean || personName(b.who))); c.appendChild(wb);
      var waWho = who || b.who || whereClean, bub = h('div', 'k-bub');
      if (b.via && waWho && !/\(DM\)|DM$/.test(str(b.where)) && whereClean !== personName(waWho)) bub.appendChild(h('b', 'k-bub-n', personName(waWho)));
      bub.appendChild(body()); bub.appendChild(h('span', 'k-read', 'Read')); c.appendChild(bub);
      c.insertBefore(faceEl(waWho, 'k-wa-face'), bub);
    } else if (kind === 'email') {
      var from = who || b.who || (/^\[/.test(str(b.where)) ? 'Shopify' : str(b.where).indexOf(':') > 0 ? str(b.where).split(':')[0] : str((cfg.brand || {}).name, 'Team') + ' inbox'), subj = b.where ? whereClean : str(b.text).split(/[.?!:]/)[0];
      var eh = h('div', 'k-mail');
      var l1 = h('p', 'k-mail-l'); l1.appendChild(h('span', 'k-mail-k', 'From')); l1.appendChild(h('span', null, personName(from) + (isAgency(from) ? ' <hello@' + slugify(from) + '.in>' : ''))); eh.appendChild(l1);
      var l2 = h('p', 'k-mail-l'); l2.appendChild(h('span', 'k-mail-k', 'To')); l2.appendChild(h('span', null, str((cfg.brand || {}).name, 'Team') + ' team')); eh.appendChild(l2);
      var l3 = h('p', 'k-mail-l k-mail-s'); l3.appendChild(h('span', 'k-mail-k', 'Subject')); l3.appendChild(h('span', null, subj.length > 46 ? subj.slice(0, 44) + '…' : subj)); eh.appendChild(l3);
      eh.insertBefore(faceEl(from, 'k-mail-face'), l1);
      c.appendChild(eh); c.appendChild(body());
    } else if (kind === 'ticket') {
      var tb = h('p', 'k-bar'); tb.appendChild(h('span', 'k-ch', 'Ticket #' + tickNo(sid))); tb.appendChild(h('span', 'k-st ' + (b.t === 'done' || b.t === 'auto' ? 'is-done' : 'is-open'), b.t === 'done' || b.t === 'auto' ? 'Solved' : 'Open')); c.appendChild(tb);
      c.appendChild(authorRow(who ? faceEl(who) : markEl(sid), who ? personName(who) : ag[0], who ? 'customer' : 'replied'));
      c.appendChild(body());
    } else if (kind === 'huddle') {
      var hb = h('p', 'k-bar'); hb.appendChild(h('span', 'k-ch', (whereClean || 'Standup').replace(/,.*$/, '') + (b.at ? ' · ' + b.at : ''))); hb.appendChild(h('span', 'k-live', 'Live')); c.appendChild(hb);
      var sp = authorRow(who ? faceEl(who) : markEl(sid), who ? personName(who) : ag[0], null);
      var wv = h('span', 'k-talk'); for (var i = 0; i < 9; i++) { var bi = h('i'); bi.style.animationDelay = (i * 70) + 'ms'; wv.appendChild(bi); } sp.appendChild(wv);
      c.appendChild(sp); var q2 = body(); q2.classList.add('k-said'); c.appendChild(q2);
    } else if (kind === 'meeting') {
      var mb = h('p', 'k-bar'); mb.appendChild(h('span', 'k-ch', 'Transcript')); mb.appendChild(h('span', 'k-app', whereClean.replace(/,\s*\d{1,2}:\d{2}$/, ''))); c.appendChild(mb);
      var tsm = (str(b.where).match(/(\d{1,2}:\d{2})$/) || [])[1];
      var ml = h('div', 'k-tr'); ml.appendChild(h('span', 'k-tr-t', str(b.at, tsm || ''))); ml.appendChild(who ? faceEl(who) : markEl(sid));
      var mt = h('div', 'k-tr-b'); mt.appendChild(h('b', null, who ? personName(who) : ag[0])); var said = body(); said.classList.add('k-said'); mt.appendChild(said); ml.appendChild(mt);
      c.appendChild(ml);
    } else if (kind === 'voicenote') {
      c.appendChild(authorRow(faceEl(b.who), personName(b.who), 'voice note'));
      c.appendChild(body());
    } else if (kind === 'dm') {
      var db = h('p', 'k-bar'); db.appendChild(h('span', 'k-ch', 'Direct message')); db.appendChild(h('span', 'k-app', 'COS')); c.appendChild(db);
      var qa = h('div', 'k-dm k-dm-q'); qa.appendChild(faceEl(b.who)); qa.appendChild(h('p', 'b-q', b.text)); c.appendChild(qa);
      var an = h('div', 'k-dm k-dm-a'); an.appendChild(markEl(sid)); an.appendChild(h('p', 'b-a', b.answer)); c.appendChild(an);
    } else if (kind === 'agent') {
      c.appendChild(authorRow(markEl(sid), ag[0], null));
      c.appendChild(body());
    } else if (kind === 'record') {
      var rb = h('p', 'k-bar'); rb.appendChild(h('span', 'k-ch', 'OS · ' + str(b.area, AREA[sid] || 'Records'))); var rid = recId(b.text); if (rid) rb.appendChild(h('span', 'k-id', rid)); c.appendChild(rb);
      var row = h('div', 'bc-row'); row.appendChild(h('p', 'bc-text', b.text));
      row.appendChild(h('span', 'pill ' + (b.t === 'raised' ? 'pill-hold' : 'pill-done'), b.t === 'raised' ? 'Open' : 'Done'));
      c.appendChild(row);
    } else if (kind === 'doc') {
      var dn = b.media && b.media.type === 'doc' ? b.media : null;
      var dh = h('p', 'k-doc-h'); dh.appendChild(h('span', 'k-doc-n', dn ? str(dn.name) : str(b.src, SOURCE[sid] || 'Quote') + '.pdf')); dh.appendChild(h('span', 'k-doc-p', dn && dn.note ? dn.note : 'Page 1 of 1')); c.appendChild(dh);
      var pg = h('div', 'k-page'); pg.appendChild(h('p', 'k-page-t', b.text)); for (var j = 0; j < 4; j++) pg.appendChild(h('i', 'k-rule')); c.appendChild(pg);
      b = Object.assign({}, b); if (dn) b.media = null;
    } else {   /* data: a Hub reading, with where it came from */
      var hb2 = h('p', 'k-bar'); hb2.appendChild(h('span', 'k-ch', 'Hub · ' + str(b.src, SOURCE[sid] || 'Data'))); hb2.appendChild(h('span', 'k-app', 'live')); c.appendChild(hb2);
      c.appendChild(body());
    }
    if (b.media && !(kind === 'voicenote' && false)) { var md = mediaEl(b.media); if (md) c.appendChild(md); }
    if (b.desc) c.appendChild(h('p', 'bc-desc', b.desc));
    if (arr(b.react).length) { var rx = h('p', 'bc-react'); arr(b.react).forEach(function (r) { rx.appendChild(h('span', 'rx', str(r))); }); c.appendChild(rx); }
    if (b.t === 'ask') {
      var opts = h('div', 'cc-opts');
      arr(b.options).forEach(function (o, oi) {
        var bt = h('button', 'cc-opt', o); bt.type = 'button';
        bt.addEventListener('click', function () { markOpt(c, oi); c.setAttribute('data-user', '1'); });
        opts.appendChild(bt);
      });
      c.appendChild(opts);
      var tap = st.tap || {};
      c.appendChild(h('p', 'b-tap', str(tap.who, b.who) + ', ' + str(tap.cost, '1 tap')));
    }
    return c;
  }
  function buildFlow() {}
  /* a chat attachment on a message: voice note, photo cut from the kit, colour chips, a tiny bar chart, a file, a link */
  function mediaEl(m) {
    if (!m || !m.type) return null;
    var el = h('div', 'md md-' + m.type), i;
    if (m.type === 'voice') {
      el.appendChild(h('span', 'md-play'));
      var wv = h('span', 'md-wave');
      for (i = 0; i < 28; i++) { var bar = h('i'); bar.style.height = (22 + Math.round(70 * Math.abs(Math.sin(i * 1.7 + 1) * Math.cos(i * .45)))) + '%'; wv.appendChild(bar); }
      el.appendChild(wv);
      el.appendChild(h('span', 'md-len', str(m.len, '0:16')));
    } else if (m.type === 'photo') {
      var c = Array.isArray(m.crop) && m.crop.length === 4 ? m.crop : [0, 0, 1, 1], ph = h('span', 'md-ph');
      var cw = Math.max(.01, c[2] - c[0]), ch = Math.max(.01, c[3] - c[1]);
      ph.style.backgroundImage = 'url("' + kitSrc(str(m.kit, 'hero')) + '")';
      ph.style.backgroundSize = (100 / cw) + '% ' + (100 / ch) + '%';
      ph.style.backgroundPosition = (cw >= 1 ? 0 : c[0] / (1 - cw) * 100) + '% ' + (ch >= 1 ? 0 : c[1] / (1 - ch) * 100) + '%';
      ph.style.aspectRatio = String(Math.min(1.6, Math.max(.6, cw / ch)));
      el.appendChild(ph);
      if (m.label) el.appendChild(h('span', 'md-cap', m.label));
    } else if (m.type === 'swatch') {
      var row = h('span', 'md-sw');
      arr(m.colors).forEach(function (col) { var sw = h('i'); sw.style.background = col; row.appendChild(sw); });
      el.appendChild(row);
      if (m.label) el.appendChild(h('span', 'md-cap', m.label));
    } else if (m.type === 'chart') {
      var vals = arr(m.values).map(Number), max = Math.max.apply(null, vals.concat([1])), bars = h('span', 'md-bars');
      vals.forEach(function (v, n) {
        var col = h('span', 'md-col'), b2 = h('i'); b2.style.height = Math.max(4, v / max * 100) + '%';
        col.appendChild(h('b', 'md-v', String(v) + (n === vals.length - 1 && m.unit ? ' ' + m.unit : '')));
        var bw = h('span', 'md-bw'); bw.appendChild(b2); col.appendChild(bw); col.appendChild(h('span', 'md-l', str(arr(m.labels)[n])));
        bars.appendChild(col);
      });
      el.appendChild(bars);
    } else if (m.type === 'doc') {
      var nm = str(m.name, 'File'), ext = (nm.match(/\.([a-z0-9]+)$/i) || [0, 'doc'])[1].toUpperCase();
      el.appendChild(h('span', 'md-ext', ext.slice(0, 4)));
      var tx = h('span', 'md-tx'); tx.appendChild(h('b', null, nm)); if (m.note) tx.appendChild(h('span', null, m.note)); el.appendChild(tx);
    } else if (m.type === 'link') {
      var tl = h('span', 'md-tx'); tl.appendChild(h('b', null, str(m.title))); if (m.note) tl.appendChild(h('span', null, m.note)); el.appendChild(tl);
    } else return null;
    return el;
  }

  /* ---------- the timeline: one spine through the object; stops and beats hang off it, zigzagging ---------- */
  var TL = [], LIVE = [], ANIM = false;
  /* timed stops: when the scroll is in a stop, its messages land one after another on a clock, not on scroll position.
     SQ[i] = { n: items shown (0 = the stop title), next: when the next may land, done, instant (shown in place on a return) } */
  var HOLD = {}, SQ = {}, SETTLE = 0.2;
  if (/[?&]debug\b/.test(location.search)) window.__cos = { SQ: SQ, HOLD: HOLD, settle: SETTLE, active: function () { return activeStop(scrollY / VH()); }, voice: function () { return voiceBusy(); } };
  function activeStop(pos) {
    for (var i = 0; i < ORDER.length; i++) if (HOLD[i] != null && pos >= HOLD[i] - 0.1 && pos < HOLD[i] + L.hold + 0.05) return i;
    return -1;
  }
  /* how long a message holds the stage before the next one lands */
  function words(t) { return String(t || '').split(/\s+/).filter(Boolean).length; }
  /* a message stays on its own for about 2 s plus the time it takes to read it, before the next one lands */
  function dwell(it) {
    if (!it || !it.b) return 2400;
    var b = it.b, d = clamp(1800 + 240 * (words(b.text) + words(b.answer) + words(b.desc)), 2400, 7000);
    if (b.t === 'ask') d += 1400;                /* options, then the tap */
    LIVE.forEach(function (lv) {
      if (lv.i !== it.i || lv.beat !== it.k) return;
      var t = lv.def.type;
      d = Math.max(d, t === 'pick' ? (lv.def.delay || 800) + 1000 : t === 'cycle' ? 1500 : t === 'text' ? 1300 : t === 'focus' ? 1000 : 900);
    });
    return d;
  }
  var TAP_AT = 2200;
  var WIDTH = { stop: 340, raised: 290, assign: 250, ask: 340, auto: 260, done: 280, q: 330 };
  /* the app's chrome: a status bar on top and a tab bar at the bottom (Feed, Chat, OS, Hub) */
  var TAB_ICON = {
    Feed: 'M4 6h16M4 12h16M4 18h10',
    Chat: 'M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
    OS: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    Hub: 'M5 20V11M10 20V5M15 20v-6M20 20V9'
  };
  function statusBar() {
    var sb = h('div', 'sbar'); sb.appendChild(h('span', 'sbar-t', '9:41'));
    var ic = h('span', 'sbar-ic'); ic.appendChild(h('i', 'sbar-sig')); ic.appendChild(h('i', 'sbar-bat')); sb.appendChild(ic);
    return sb;
  }
  function tabBar() {
    var tb = h('nav', 'tabbar');
    ['Feed', 'Chat', 'OS', 'Hub'].forEach(function (t) {
      var b = h('span', 'tabbar-t'); b.setAttribute('data-t', t);
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + TAB_ICON[t] + '"/></svg>';
      b.appendChild(h('span', 'tabbar-l', t)); tb.appendChild(b);
    });
    return tb;
  }
  function buildTimeline() {
    ui.spine = h('div', 'spine'); stage.insertBefore(ui.spine, objEl);
    ui.tlBack = h('div', 'tl tl-back'); stage.insertBefore(ui.tlBack, objEl);
    ui.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); ui.svg.setAttribute('class', 'story-lines'); ui.svg.style.zIndex = 1; objEl.appendChild(ui.svg);   /* above the 3D scene, below the product */
    ui.props = h('div', 'props'); stage.appendChild(ui.props);
    ui.tl = h('div', 'tl'); stage.appendChild(ui.tl);
    /* the app phone that stands in the scene: Chief of Staff's own screen, showing the stop's decisions and records */
    ui.dock = h('div', 'dock'); var dsc = h('div', 'dock-scr scr-app');
    dsc.appendChild(statusBar());
    var dtop = h('div', 'dock-top'); ui.dockMk = h('span', 'dock-av'); dtop.appendChild(ui.dockMk);
    var dtt = h('div', 'dock-tt'); ui.dockTitle = h('b', 'dock-title'); ui.dockSub = h('span', 'dock-sub'); dtt.appendChild(ui.dockTitle); dtt.appendChild(ui.dockSub); dtop.appendChild(dtt);
    dsc.appendChild(dtop);
    ui.dockBody = h('div', 'dock-body'); dsc.appendChild(ui.dockBody);
    var comp = h('div', 'dock-comp'); comp.appendChild(h('span', 'dock-in', 'Message')); comp.appendChild(h('span', 'dock-send')); dsc.appendChild(comp);
    dsc.appendChild(tabBar()); ui.dock.appendChild(dsc); stage.appendChild(ui.dock);
    var holdAt = HOLD;
    SEG.forEach(function (sg) { if (sg.type === 'hold') holdAt[sg.a] = sg.at; });
    ORDER.forEach(function (id, i) {
      var st = byId[id] || {}, beats = flowOf(id), side = i % 2 ? 1 : -1;
      var stop = h('div', 'tl-stop tl-stop-' + id);
      stop.appendChild(h('p', 'tl-when', id === 'voice' ? str((cfg.voice || {}).when) + ', ' + str((cfg.voice || {}).time) : str(st.when)));
      stop.appendChild(h('p', 'tl-title', TITLE[id]));
      if (st.summary) stop.appendChild(h('p', 'tl-desc', st.summary));
      add(stop, 'stop', holdAt[i] - .08, side, 0, i);
      beats.forEach(function (b, k) {
        var el = makeBeat(b, st);
        add(el, b.t, holdAt[i] + .1 + k * .15, k % 2 ? side : -side, k + 1, i, b);
      });
    });
    /* live moments: a screen's copy changes, or an OS toast lands, as a beat crosses */
    ORDER.forEach(function (id, i) {
      arr((byId[id] || {}).live).forEach(function (lv) {
        var o = { i: i, beat: lv.beat, def: lv, on: false, el: null, orig: null };
        if (lv.type === 'pick') {
          var pk = h('div', 'pick');
          pk.appendChild(h('p', 'pick-title', lv.title));
          arr(lv.groups).forEach(function (g) {
            var row = h('div', 'pick-row'); row.appendChild(h('p', 'pick-label', g.label));
            var opts = h('div', 'pick-opts');
            if (g.swatches) g.swatches.forEach(function (c, n) { var sw = h('span', 'pick-sw' + (n === g.chosen ? ' pick-win' : '')); sw.style.background = c; sw.title = (g.names || [])[n] || ''; opts.appendChild(sw); });
            else arr(g.options).forEach(function (o, n) { opts.appendChild(h('span', 'pick-opt' + (n === g.chosen ? ' pick-win' : ''), o)); });
            row.appendChild(opts); pk.appendChild(row);
          });
          ui.props.appendChild(pk); o.el = pk;
        }
        if (lv.type === 'stamp') {
          var stp = h('div', 'stampx'); stp.appendChild(h('span', 'stampx-t', lv.text)); if (lv.badge) stp.appendChild(h('span', 'stampx-b', lv.badge));
          ui.props.appendChild(stp); o.el = stp;
        }
        if (lv.type === 'cycle') { var rg = h('div', 'ring'); if (lv.label) rg.appendChild(h('span', 'ring-l', lv.label)); ui.props.appendChild(rg); o.el = rg; }
        if (lv.type === 'toast') {
          var tt = h('div', 'toast');
          var hd = h('p', 'toast-hd'); hd.appendChild(h('span', 'toast-where', str(lv.where, 'OS'))); hd.appendChild(h('span', 'toast-title', lv.title));
          tt.appendChild(hd); tt.appendChild(h('p', 'toast-text', lv.text));
          ui.props.appendChild(tt); o.el = tt;
        }
        LIVE.push(o);
      });
    });
    function add(el, type, wy, side, k, i, b) {
      el.style.width = (WIDTH[type] || 280) + 'px';
      var dot = h('i', 'tl-dot' + (type === 'stop' ? ' tl-dot-stop' : ''));
      var link = h('i', 'tl-link');
      ui.tlBack.appendChild(link); ui.tlBack.appendChild(dot); ui.tl.appendChild(el);
      /* dynamic placement: each item sits at its own distance from the spine */
      var jit = [0, 46, 14, 70, 28][(k + i) % 5];
      var it = { el: el, dot: dot, link: link, wy: wy, side: side, jit: jit, type: type, i: i, b: b, h: 0, k: k };
      if (b && k > 1) { it.path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); ui.svg.appendChild(it.path); }
      if (b) it.prop = makeProp(b, k, ORDER[i]);
      if (b && inApp(ORDER[i], b, k)) {   /* this beat plays inside the product mockup, so it does not float as a card */
        it.inApp = true;
        if (appBeat(b)) { it.dock = appItem(b, byId[ORDER[i]] || {}); dockList(i).appendChild(it.dock); }
      } else if (b && SCREEN_STOP[ORDER[i]] && appBeat(b)) {   /* screen stops: the screen is the hero, so the app's own card floats beside it */
        el.textContent = ''; el.classList.add('bc-app'); var ai = appItem(b, byId[ORDER[i]] || {}); ai.classList.add('in'); el.appendChild(ai);
      }
      TL.push(it);
      /* a groove per stop: the scroll settles once the scene has arrived, then its messages play in on a timer */
      if (type === 'stop') { var gv = h('i', 'groove'); gv.style.top = ((HOLD[i] + SETTLE) * 100) + 'vh'; document.getElementById('track').appendChild(gv); }
    }
  }
  /* a beat, shown on the object itself: raised = marker, assign = the agent, ask = the person (+ 1 tap), auto, done = stamp */
  var PROP_AT = [[-.3, -.3], [.3, -.14], [-.3, .1], [.28, .3], [-.05, .38]];
  /* beats the product mockup in the scene shows itself (the phone's Chat at the voice stop: her note, the chief's reply) */
  var PLAY_AT = -1, DOCK = {};
  /* the app's own components, for the mockups: the decision card (cos.js decisionCard) and the OS record row */
  function dockList(i) {
    if (DOCK[i]) return DOCK[i];
    var l = DOCK[i] = h('div', 'ap-list'), id = ORDER[i], st = byId[id] || {};
    if (id === 'standup') return l;
    l.appendChild(h('p', 'ap-sys in', str(st.when, 'Today')));
    var m = h('div', 'ap-hello in'); m.appendChild(markEl(id)); var t = h('p'); t.appendChild(h('b', null, agentOf(id)[0])); t.appendChild(document.createTextNode(' ' + (st.summary ? str(st.summary).split(/(?<=[.!?])\s/)[0] : 'On it.'))); m.appendChild(t); l.appendChild(m);
    return l;
  }
  function appItem(b, st) {
    var sid = st.id, el;
    if (b.t === 'ask') {
      el = h('article', 'ap-card');
      var hd = h('p', 'ap-card-h');
      hd.appendChild(h('span', 'ap-kind', /approve|go\b|ok go/i.test(arr(b.options)[0] || '') ? 'Approval' : 'Decision'));
      hd.appendChild(h('span', 'ap-fn', b.s === 'chat' ? '#' + str(b.ch, CHANNEL[sid] || 'general') : 'OS · ' + str(b.area, AREA[sid] || 'Records')));
      var stt = h('span', 'ap-st'); stt.appendChild(h('span', 'ap-st-o', 'Needs a tap')); stt.appendChild(h('span', 'ap-st-d', 'Done')); hd.appendChild(stt);
      el.appendChild(hd);
      el.appendChild(withMentions(h('p', 'ap-card-t'), b.text));
      if (b.media) { var md = mediaEl(b.media); if (md) el.appendChild(md); }
      var ul = h('div', 'ap-opts');
      arr(b.options).forEach(function (o, n) {
        var li = h('div', 'ap-opt' + (n === 0 ? ' is-rec' : ''));
        var t = h('p', 'ap-opt-t'); t.appendChild(h('b', null, o)); if (n === 0) t.appendChild(h('span', 'ap-rec', 'Recommended')); t.appendChild(h('span', 'ap-rec ap-chosen', 'Chosen')); li.appendChild(t);
        li.appendChild(h('span', 'ap-btn' + (n === 0 ? ' is-primary' : ''), o.charAt(0).toUpperCase() + o.slice(1) + (b.who ? ' as ' + b.who : '')));
        ul.appendChild(li);
      });
      el.appendChild(ul);
      var tap = st.tap || {}, ft = h('p', 'ap-card-f');
      ft.appendChild(h('span', 'ap-f-o', 'Decides: ' + str(b.who, 'founder')));
      ft.appendChild(h('span', 'ap-f-d', str(tap.who, b.who) + ' ' + (/^approve/i.test(arr(b.options)[0] || '') ? 'approved' : 'chose') + ', ' + str(tap.cost, '1 tap')));
      el.appendChild(ft);
    } else {
      el = h('div', 'ap-row');
      var rh = h('p', 'ap-row-h'); rh.appendChild(h('span', null, 'OS · ' + str(b.area, AREA[sid] || 'Records')));
      rh.appendChild(h('span', 'ap-pill ' + (b.t === 'raised' ? 'is-open' : 'is-done'), b.t === 'raised' ? 'Open' : 'Done'));
      el.appendChild(rh);
      el.appendChild(h('p', 'ap-row-t', b.text));
      if (b.desc) el.appendChild(h('p', 'ap-row-d', b.desc));
      if (b.media) { var md2 = mediaEl(b.media); if (md2) el.appendChild(md2); }
    }
    return el;
  }
  function mockupStop(id) { return id === 'voice' || id === 'standup'; }
  /* screen stops: the customer-facing screen is the hero there; the app's cards float beside it */
  var SCREEN_STOP = { ad: 1, listing: 1, support: 1, order: 1 };
  function appBeat(b) { return b.t === 'ask' || b.s === 'os'; }
  /* the app phone ("dock") stands in the scene at every stop with a decision or a record, except the screen stops */
  function dockStop(id) { return !SCREEN_STOP[id] && !mockupStop(id) && flowOf(id).some(appBeat); }
  function inApp(id, b, k) {
    if (dockStop(id)) return appBeat(b);
    if (id === 'standup') return k === 1 || appBeat(b);
    if (id !== 'voice') return false;
    var fl = flowOf(id), firstAssign = -1;
    fl.forEach(function (x, n) { if (firstAssign < 0 && x.t === 'assign') firstAssign = n + 1; });
    return k === 1 || k === firstAssign;
  }
  function typeInto(el, text) {
    clearInterval(el._typer); var cur = el.textContent;
    var i = cur.length;
    el._typer = setInterval(function () {                     /* backspace, then type the new line */
      if (i > 0 && cur) { i -= 2; el.textContent = cur.slice(0, Math.max(0, i)); if (i <= 0) cur = ''; return; }
      var n = el.textContent.length + 1; el.textContent = text.slice(0, n);
      if (n >= text.length) clearInterval(el._typer);
    }, 28);
  }
  /* ---------- sound: the voices of the people and the agent (off until asked; ?mute keeps it off) ---------- */
  /* one shared element: iOS only lets a media element play outside a tap once a tap has started it */
  var _PL = null; function PLAYER() { if (!_PL) { _PL = new Audio(); _PL.preload = 'auto'; _PL.setAttribute('playsinline', ''); } return _PL; }
  var SOUND = false, NOW_AUDIO = null, MUTED = /[?&]mute\b/.test(location.search);
  function clipsFor(it) {
    var id = ORDER[it.i], au = cfg.audio || {}, b = it.b || {}, out = [];
    if (au[id + '-' + it.k]) return [au[id + '-' + it.k]];   /* a clip for this exact beat (standup-1 = the voice note again) */
    if (b.t === 'raised' && id === 'voice') out.push(au['voice-note']);
    else if (b.t === 'raised' && b.who) out.push(au[id + '-agency']);
    else if (b.t === 'ask') { out.push(au[id + '-ask']); out.push(au[id + '-reply']); }
    else if (b.t === 'q') { out.push(au[id + '-q']); out.push(au[id + '-a']); }
    return out.filter(Boolean);
  }
  function beatVoice(it) {
    if (!SOUND || MUTED || SCENES) return;   /* scenes under the story: story.js owns the voice */
    var q = clipsFor(it); if (!q.length) return;
    if (NOW_AUDIO) { NOW_AUDIO.pause(); NOW_AUDIO = null; }
    VOICE_T0 = performance.now();
    (function next(n) {
      if (n >= q.length || !SOUND) { NOW_AUDIO = null; return; }
      var a = PLAYER(); a.pause(); a.muted = false; a.src = q[n]; NOW_AUDIO = a; a.volume = 1;
      var on = function () { setTimeout(function () { if (NOW_AUDIO === a) next(n + 1); }, 220); };
      a.onended = on; a.onerror = on;
      a.play().catch(function () { if (NOW_AUDIO === a) NOW_AUDIO = null; });
    })(0);
  }
  /* a beat's voice is still talking (capped, so a stalled clip over a slow network never holds the story) */
  var VOICE_T0 = 0;
  function voiceBusy() { return !!NOW_AUDIO && SOUND && !MUTED && performance.now() - VOICE_T0 < 25000; }
  function stopVoice() { if (NOW_AUDIO) { NOW_AUDIO.pause(); NOW_AUDIO = null; } }

  /* ---------- I've got no time: the whole story plays itself, stop by stop, beat by beat ---------- */
  var PLAY = { on: false, timer: 0 };
  function grooveList() { return Array.prototype.map.call(document.querySelectorAll('.groove'), function (g) { return g.offsetTop; }).sort(function (a, b) { return a - b; }); }
  function glideTo(y, dur, done) {
    var from = scrollY, t0 = performance.now();
    document.documentElement.style.scrollSnapType = 'none';
    (function step() {
      if (!PLAY.on) return;
      var k = clamp((performance.now() - t0) / dur, 0, 1), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      scrollTo(0, from + (y - from) * e); render();
      if (k < 1) PLAY.timer = setTimeout(step, 16); else done();
    })();
  }
  function stopPlay() {
    PLAY.on = false; clearTimeout(PLAY.timer); document.documentElement.style.scrollSnapType = '';
    if (ui.playBtn) ui.playBtn.textContent = 'Play';
  }
  function startPlay() {
    if (PLAY.on) { stopPlay(); return; }
    PLAY.on = true; AUTO.on = true; ui.playBtn.textContent = 'Pause';
    var vh = VH(), start = SEG.filter(function (q) { return q.type === 'hold'; })[0].at * vh;
    var gs = grooveList().filter(function (y) { return y >= start - 2; });
    var endY = document.getElementById('end').offsetTop;
    function go(n) {
      if (!PLAY.on) return;
      if (n < 0 || n >= gs.length) { glideTo(endY, 900, function () { AUTO.on = false; stopPlay(); }); return; }
      glideTo(gs[n], 700, function () {
        var t0 = performance.now();
        (function wait() {   /* the stop's messages play in on their timer; move on once they (and the voice) are done */
          if (!PLAY.on) return;
          render();
          var i = activeStop(scrollY / VH()), q = i >= 0 ? SQ[i] : null;
          var done = !q || (q.done && !voiceBusy());
          if (done || performance.now() - t0 > 30000) PLAY.timer = setTimeout(function () { go(n + 1); }, 650);
          else PLAY.timer = setTimeout(wait, 120);
        })();
      });
    }
    if (scrollY < start - 2) { AUTO.on = false; swoop(1, function () { if (PLAY.on) { AUTO.on = true; go(0); } }); }   /* the rewind first: one move */
    else go(gs.findIndex(function (y) { return y >= scrollY - 2; }));
  }
  ['wheel', 'touchstart', 'keydown'].forEach(function (ev) { addEventListener(ev, function (e) { if (PLAY.on && !(e.target && e.target.closest && e.target.closest('.ctl'))) { stopPlay(); AUTO.on = false; } }, { passive: true }); });
  function makeProp(b, k, sid) {
    var el = h('div', 'prop prop-' + b.t);
    if (b.t === 'raised') el.appendChild(h('span', 'pr-mark', '!'));
    else if (b.t === 'assign') el.appendChild(markEl(sid, 'pr-av pr-mk'));
    else if (b.t === 'ask') { el.appendChild(faceEl(b.who, 'pr-av pr-person')); var tp = h('span', 'pr-tap'); tp.appendChild(h('span', 'pr-tn', str(b.who, 'Founder') + ' · ')); tp.appendChild(document.createTextNode('1 tap')); el.appendChild(tp); }
    else if (b.t === 'auto') el.appendChild(h('span', 'pr-chip', 'Auto'));
    else if (b.t === 'q') el.appendChild(faceEl(b.who, 'pr-av pr-person'));
    else el.appendChild(h('span', 'pr-stamp', 'Done'));
    ui.props.appendChild(el);
    return el;
  }

  /* ---------- the journey: the newest card in the scene is tied to the app phone, and lands in it ---------- */
  var FLY = [], LINK = { key: '' };
  function phoneTarget(act) {
    if (ui.dock && ui.dock.classList.contains('in')) return ui.dock;
    var id = ORDER[act];
    if (layerEls.phone && mockupStop(id) && layerEls.phone.style.visibility !== 'hidden') return layerEls.phone;
    if (layerEls.notify && id === 'delivered' && layerEls.notify.style.visibility !== 'hidden') return layerEls.notify;
    return null;
  }
  function linkPhone(G) {
    if (!ui.link) {
      ui.link = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); ui.link.setAttribute('class', 'phone-link');
      ui.link.innerHTML = '<defs><marker id="pl-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z"/></marker></defs><path class="pl-path" marker-end="url(#pl-arrow)"/><circle class="pl-dot" r="4"/>';
      stage.appendChild(ui.link); ui.linkPath = ui.link.querySelector('.pl-path'); ui.linkDot = ui.link.querySelector('.pl-dot');
    }
    var act = activeStop(scrollY / VH()), tgt = act >= 0 ? phoneTarget(act) : null, src = null;
    if (tgt) TL.forEach(function (it) { if (it.i === act && it.on && it.type !== 'stop' && (!src || it.k > src.k)) src = it; });
    var sr = stage.getBoundingClientRect();
    ui.link.setAttribute('width', G.W); ui.link.setAttribute('height', G.H);
    /* cards that just landed in the phone fly in from the card before them */
    while (FLY.length) {
      var f = FLY.shift(), from = null;
      TL.forEach(function (it) { if (it.i === f.i && it.on && it.type !== 'stop' && it.k < f.k && (!from || it.k > from.k)) from = it; });
      if (from && tgt && f.dock.offsetParent) fly(from.el, f.dock, sr);
    }
    if (!tgt || !src || AUTO.on && !PLAY.on) { if (LINK.key) { ui.link.classList.remove('on'); LINK.key = ''; } return; }
    var a = src.el.getBoundingClientRect(), b = tgt.getBoundingClientRect();
    if (!a.width || !b.width) return;
    var aC = a.left + a.width / 2, bC = b.left + b.width / 2, right = aC > bC;
    var x0, y0, x1, y1;
    if (G.mob && a.top > b.bottom - 4) { x0 = a.left + Math.min(a.width * .3, 60) - sr.left; y0 = a.top - sr.top; x1 = Math.min(b.right - 24, x0) - sr.left + sr.left; y1 = b.bottom - sr.top - 6; }
    else { x0 = (right ? a.left : a.right) - sr.left; y0 = a.top + Math.min(a.height / 2, 40) - sr.top; x1 = (right ? b.right - 6 : b.left + 6) - sr.left; y1 = clamp(y0, b.top - sr.top + 60, b.bottom - sr.top - 90); }
    var dx = (x1 - x0) * .5, d = G.mob && a.top > b.bottom - 4
      ? 'M' + x0 + ' ' + y0 + ' C' + x0 + ' ' + (y0 + y1) / 2 + ' ' + x1 + ' ' + (y0 + y1) / 2 + ' ' + x1 + ' ' + y1
      : 'M' + x0 + ' ' + y0 + ' C' + (x0 + dx) + ' ' + y0 + ' ' + (x1 - dx) + ' ' + y1 + ' ' + x1 + ' ' + y1;
    ui.linkPath.setAttribute('d', d); ui.linkDot.setAttribute('cx', x0); ui.linkDot.setAttribute('cy', y0);
    var key = act + ':' + src.k;
    if (LINK.key !== key) {   /* a new step: draw the line again from the card to the phone */
      LINK.key = key; ui.link.classList.remove('on'); var L2 = ui.linkPath.getTotalLength ? ui.linkPath.getTotalLength() : 600;
      ui.linkPath.style.strokeDasharray = L2; ui.linkPath.style.strokeDashoffset = L2; ui.link.getBoundingClientRect();
      ui.link.classList.add('on'); ui.linkPath.style.strokeDashoffset = 0;
    }
  }
  function fly(fromEl, toEl, sr) {
    var a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
    if (!a.width || !b.width) return;
    var g = fromEl.cloneNode(true); g.classList.add('fly'); g.classList.remove('now');
    g.style.width = a.width + 'px'; g.style.transform = 'translate3d(' + (a.left - sr.left) + 'px,' + (a.top - sr.top) + 'px,0)';
    stage.appendChild(g); g.getBoundingClientRect();
    var s = Math.min(.6, b.width / a.width);
    g.style.transform = 'translate3d(' + (b.left - sr.left) + 'px,' + (b.top - sr.top) + 'px,0) scale(' + s.toFixed(3) + ')';
    g.style.opacity = '0';
    setTimeout(function () { if (g.parentNode) g.parentNode.removeChild(g); }, 800);
  }
  function updateTimeline(pos, G, cx, cy, B) {
    /* the beats appear in place, one by one, and leave when the stop ends; nothing slides with the scroll.
       p = how far past a beat the scroll is (in viewport heights): it appears at p >= 0 */
    var W = G.W, near = -1, bestD = 1e9;
    ui.spine.style.display = 'none';
    var P = function (it) { return pos - it.wy; };
    /* the clock: the stop the scroll is in plays its messages in, one after another; any other stop is cleared */
    var now = performance.now(), act = activeStop(pos);
    ORDER.forEach(function (id, i) {
      var q = SQ[i] || (SQ[i] = { n: -1, next: 0, done: false, instant: false, count: 0 });
      if (!q.count) TL.forEach(function (it) { if (it.i === i) q.count = Math.max(q.count, it.k); });
      if (i !== act) {
        if (q.n >= 0) { q.n = -1; q.done = false; if (q.voice) stopVoice(); q.voice = false; }
        return;
      }
      if (q.n < 0) {                                          /* arriving (first time or again): the title lands, then the story plays in */
        if (STILL) { q.n = q.count; q.done = true; q.instant = true; }
        else { q.n = 0; q.next = now + clamp(1300 + 160 * words((byId[ORDER[i]] || {}).summary), 1600, 3600); q.instant = false; }
      }
      while (!q.done && now >= q.next && !voiceBusy()) {
        if (q.n >= q.count) { q.done = true; break; }
        q.n++; q.voice = true;
        var cur = null; TL.forEach(function (it) { if (it.i === i && it.k === q.n) cur = it; });
        q.next = now + dwell(cur);
        break;
      }
      if (!q.done) ANIM = true;
    });
    var shown = function (it) { var q = SQ[it.i]; return it.i === act && q && q.n >= it.k; };
    var vOn = act >= 0 && mockupStop(ORDER[act]) && SQ[act] && SQ[act].n >= 0 ? act : -1;
    if (layerEls.phone && PLAY_AT !== vOn) { layerEls.phone.classList.remove('vn-play'); if (vOn >= 0) { layerEls.phone.offsetWidth; layerEls.phone.classList.add('vn-play'); } PLAY_AT = vOn; }
    TL.forEach(function (it) {
      var sh = shown(it);
      if (sh && !it.t0) it.t0 = SQ[it.i].instant ? now - 1e5 : now;
      if (!sh) it.t0 = 0;
    });
    var age = function (it) { return it.t0 ? now - it.t0 : -1; };
    updateDock(G, cx, B, act, now, shown, age);
    var SLOT = [[-1, -.44], [1, -.44], [-1, 0], [1, 0], [-1, .44], [1, .44]];   /* the story zigzags down the sides */
    var mobN = 0, colEnd = {}, cols = {};   /* per stop and side: where the last card ended, so cards never stack on the title or each other */
    TL.forEach(function (it) {
      var p = P(it);
      var on = shown(it) && !it.inApp;
      if (on !== it.on) { it.on = on; it.el.classList.toggle('in', on); }
      it.dot.style.display = it.link.style.display = 'none';
      if (Math.abs(p) < bestD) { bestD = Math.abs(p); near = it.i; }
      if (!on) return;
      var cw = G.mob ? W - 2 * mobPad(G) : (WIDTH[it.type] || 280);
      it.el.style.width = cw + 'px';
      var h = it.el.offsetHeight || 90, x, y;
      if (G.mob) { /* laid out below, in the caption sheet */ }
      else if (it.type === 'stop') { x = 36; y = 64; colEnd[it.i + 'L'] = y + h; colEnd[it.i + 'R'] = 44; }
      else {
        var sl = SLOT[(it.k - 1) % SLOT.length];
        if (ORDER[it.i] === 'delivered' || ORDER[it.i] === 'support' || dockStop(ORDER[it.i]) || ORDER[it.i] === 'standup') sl = [1, sl[1]];   /* the OS panel owns the left side at the door */
        x = sl[0] < 0 ? cx - B * .52 - 36 - cw : cx + B * .52 + 36;
        if (SCREEN_STOP[ORDER[it.i]] && layerEls.device && layerEls.device.style.visibility !== 'hidden') {   /* clear of the screen and its badges */
          var dRc = layerEls.device.getBoundingClientRect(), sRc = stage.getBoundingClientRect();
          x = sl[0] < 0 ? Math.min(x, dRc.left - sRc.left - 72 - cw) : Math.max(x, dRc.right - sRc.left + 72);
        }
        y = G.cy + sl[1] * B * 1.2 - h / 2;
        var side = it.i + (sl[0] < 0 ? 'L' : 'R');
        var floor = Math.max(56, (colEnd[side] || 44) + 14);
        y = Math.max(y, floor);
        x = clamp(x, 12, W - cw - 12);
        colEnd[side] = y + h;
        (cols[side] = cols[side] || []).push({ it: it, x: x, y: y, h: h, r: x + cw, floor: floor });   /* placed once the whole column is known */
      }
      if (!G.mob && it.type === 'stop') it.el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
      it.el.style.opacity = '';
      it.el.classList.toggle('now', it.type !== 'stop' && SQ[it.i].n === it.k);
      if (it.type === 'ask' && !it.el.getAttribute('data-user')) {
        var pressed = age(it) > TAP_AT;                  /* the tap lands once the ask has been read */
        if (age(it) < TAP_AT + 100) ANIM = true;
        if (pressed && !it.el.classList.contains('pressed')) markOpt(it.el, 0);
        if (!pressed && it.el.classList.contains('pressed')) { it.el.classList.remove('pressed'); Array.prototype.forEach.call(it.el.querySelectorAll('.cc-opt'), function (b) { b.classList.remove('on'); }); }
      }
    });
    /* a busy stop: when a column runs past the bottom (or under the status bar), it slides up into the free room, then
       shrinks as a whole, so every card stays on screen and none covers another */
    if (!G.mob) {
      var srS = stage.getBoundingClientRect(), pb = ui.presBar && ui.presBar.getBoundingClientRect(), pbOn = pb && pb.height && getComputedStyle(ui.presBar).opacity !== '0';
      Object.keys(cols).forEach(function (side) {
        var c = cols[side], end = c[c.length - 1].y + c[c.length - 1].h, minY = c[0].floor, maxY = G.H - 24;
        if (pbOn && c.some(function (q) { return q.r > pb.left - srS.left; })) maxY = Math.min(maxY, pb.top - srS.top - 14);
        var s = 1;
        if (end > maxY) {   /* pack the column tight from the bottom up; if even that is too tall, shrink it */
          var total = c.reduce(function (a, q) { return a + q.h; }, 0) + 14 * (c.length - 1);
          s = Math.max(.5, Math.min(1, (maxY - minY) / total));
          var y = Math.max(minY, maxY - total * s);
          c.forEach(function (q) { q.y = y; y += (q.h + 14) * s; });
        }
        c.forEach(function (q) {
          q.it.el.style.transformOrigin = '0 0';
          q.it.el.style.transform = 'translate3d(' + q.x + 'px,' + q.y + 'px,0)' + (s < 1 ? ' scale(' + s.toFixed(3) + ')' : '');
        });
      });
    }
    /* the thread: each step is joined to the one before it, the line passing behind the product */
    var sr = stage.getBoundingClientRect();
    ui.svg.setAttribute('width', W); ui.svg.setAttribute('height', G.H); ui.svg.style.display = G.mob ? 'none' : '';
    TL.forEach(function (it) {
      if (!it.path) return;
      var prev = null; TL.forEach(function (q) { if (q.i === it.i && q.k === it.k - 1) prev = q; });
      var show = !G.mob && it.on && prev && prev.on;
      if (!show) { if (it.drawn) { it.path.style.opacity = '0'; it.drawn = false; } return; }
      var a = prev.el.getBoundingClientRect(), b2 = it.el.getBoundingClientRect();
      var aL = a.left - sr.left < cx, bL = b2.left - sr.left < cx;
      var x0 = (aL ? a.right : a.left) - sr.left, y0 = a.top - sr.top + a.height / 2;
      var x1 = (bL ? b2.right : b2.left) - sr.left, y1 = b2.top - sr.top + b2.height / 2;
      var mx = (x0 + x1) / 2;
      var d = 'M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + ' C' + (aL === bL ? (aL ? x0 + 60 : x0 - 60) : mx).toFixed(1) + ' ' + y0.toFixed(1) + ' ' + (aL === bL ? (bL ? x1 + 60 : x1 - 60) : mx).toFixed(1) + ' ' + y1.toFixed(1) + ' ' + x1.toFixed(1) + ' ' + y1.toFixed(1);
      it.path.setAttribute('d', d);
      if (!it.drawn) {
        var len = it.path.getTotalLength();
        it.path.style.transition = 'none'; it.path.style.strokeDasharray = len; it.path.style.strokeDashoffset = len; it.path.style.opacity = '1';
        it.path.getBoundingClientRect();
        it.path.style.transition = 'stroke-dashoffset .6s cubic-bezier(.4, 0, .2, 1)'; it.path.style.strokeDashoffset = '0';
        it.drawn = true;
      }
    });

    /* phone: the story sheet. The stop's time, title and summary land first; then its messages build up as a thread
       under them, one at a time, each in its own place (nothing moves once it has landed). The sheet is sized for the
       whole thread when the stop arrives, and the scene above shrinks to fit it. If the thread is taller than the
       sheet can be, it scrolls up by whole messages. */
    if (G.mob) {
      /* phone, in scene: the stop's when-line and title sit over the top of the scene (beside the pills); its messages
         float over the lower part of the scene as a chat stack, newest at the bottom, older ones pushed up. The stack
         area is sized for the whole thread when the stop arrives, so the scene above sizes once and stays. */
      var pad = mobPad(G), stopIt = null, stackTop = MOB.rest;
      TL.forEach(function (it) { if (it.type === 'stop' && it.on) stopIt = it; });
      var cr = ui.ctl.getBoundingClientRect(), srM = stage.getBoundingClientRect(), nowB = ui.presBar.getBoundingClientRect().bottom - srM.top;
      if (stopIt) {
        var cwm = W - 2 * pad, msgs = TL.filter(function (q) { return q.i === stopIt.i && q.type !== 'stop'; }).sort(function (a, b) { return a.k - b.k; });
        /* the title flows around the pills: a float the size of the pill column */
        var yT = nowB + 8, fl = stopIt.el.querySelector('.tl-float');
        if (!fl) { fl = h('i', 'tl-float'); stopIt.el.insertBefore(fl, stopIt.el.firstChild); }
        fl.style.width = (W - (cr.left - srM.left) - pad + 10) + 'px'; fl.style.height = Math.max(0, cr.bottom - srM.top - yT + 4) + 'px';
        stopIt.el.style.width = cwm + 'px';
        stopIt.el.style.transform = 'translate3d(' + pad + 'px,' + yT + 'px,0)';
        MOB.headB = yT + stopIt.el.offsetHeight;
        MOB.mock = mockupStop(ORDER[stopIt.i]);
        msgs.forEach(function (q) { q.el.style.width = cwm + 'px'; });
        var GAP = 8, hs = msgs.map(function (q) { return q.el.offsetHeight; });
        var door = ORDER[stopIt.i] === 'delivered', bottom = G.H - G.sa.b - 14, maxStack = Math.round(G.H * (door || mockupStop(ORDER[stopIt.i]) || dockStop(ORDER[stopIt.i]) ? .3 : G.H < 720 ? .4 : .42));   /* at the door the OS panel needs the wall */
        var full = hs.reduce(function (a, b) { return a + b; }, 0) + GAP * Math.max(0, msgs.length - 1);
        stackTop = bottom - Math.min(full, maxStack);
        var lastK = -1; msgs.forEach(function (q, n) { if (q.on) lastK = n; });
        var yb = bottom, full2 = false;
        for (var n = lastK; n >= 0; n--) {
          var q = msgs[n]; if (!q.on) continue;
          var y = yb - hs[n];
          if (full2 || (y < stackTop - 1 && n !== lastK)) { full2 = true; q.el.classList.remove('in'); q.el.style.transition = 'none'; q.mobAt = null; continue; }   /* scrolled off the top of the stack */
          q.el.classList.add('in');
          var fresh = q.mobAt == null;
          q.el.style.transition = fresh ? 'none' : '';
          q.el.style.transform = 'translate3d(' + pad + 'px,' + y + 'px,0)';
          q.mobAt = y; yb = y - GAP;
        }
        msgs.forEach(function (q) { if (!q.on) q.mobAt = null; });
      } else MOB.headB = 0;
      MOB.target = G.sheetOn ? stackTop : MOB.rest;
      /* a stop with an OS toast or pick: the scene starts under that top slot, so the moment never covers the object */
      var hasTop = !!stopIt && !mockupStop(ORDER[stopIt.i]) && LIVE.some(function (lv) { return lv.i === stopIt.i && (lv.def.type === 'toast' || lv.def.type === 'pick'); });
      var hasPick = !!stopIt && LIVE.some(function (lv) { return lv.i === stopIt.i && lv.def.type === 'pick'; });
      MOB.topT = hasPick ? 116 : hasTop ? 72 : 0;
      ui.sheet.style.display = 'none';
    }
    if (near >= 0) enterStage(near);

    /* props: each lands on the object as its beat passes, stays for the stop, clears when the stop leaves */
    var stopOn = shown;
    TL.forEach(function (it) {
      if (!it.prop) return;
      var on = stopOn(it) && !mockupStop(ORDER[it.i]);   /* the product mockup carries the beats itself */
      if (on !== it.propOn) { it.propOn = on; it.prop.classList.toggle('in', on); if (on) beatVoice(it); }
      if (!on) return;
      var at = PROP_AT[(it.k - 1) % PROP_AT.length];
      if (G.mob && ORDER[it.i] === 'delivered') at = [at[0], .05 + (at[1] + .3) * .5];   /* phone: the OS panel is above the parcel, so props stay on the parcel */
      if (G.mob && wideScreen(ORDER[it.i])) at = [[-.36, .53], [-.12, .53], [.12, .53], [.36, .53], [0, .66]][(it.k - 1) % 5];   /* phone: the laptop runs edge to edge, so props line up under it, off its screen */
      var px = cx + at[0] * B * (G.mob ? 1.1 : 1), py = G.cy + at[1] * B, sid2 = ORDER[it.i];
      /* badges never cover a screen: on a screen stop they line up along the device's outer edge */
      var dvE = SCREEN_STOP[sid2] && layerEls.device && layerEls.device.style.visibility !== 'hidden' ? layerEls.device : null;
      if (dvE && !(G.mob && wideScreen(sid2))) {
        var dr = dvE.getBoundingClientRect(), so = stage.getBoundingClientRect(), L = dr.left - so.left, R = dr.right - so.left, T = dr.top - so.top, Bt = dr.bottom - so.top;
        var n = it.k - 1, side = !G.mob ? 0 : R + 30 <= G.W - 18 ? 1 : L - 30 >= 18 ? -1 : 0;
        if (side) { px = side > 0 ? R + 28 : L - 28; py = T + 34 + n * 54; }
        else {   /* desktop: a row under the screen, with room after an ask for its "1 tap" pill */
          px = L + 30; TL.forEach(function (q) { if (q.i === it.i && q.prop && q.k < it.k) px += q.type === 'ask' ? 190 : 56; });
          py = Bt + 30;
        }
      }
      /* and never sit on the app phone */
      if (ui.dock && ui.dock.classList.contains('in')) {
        var dk2 = ui.dock.getBoundingClientRect(), so2 = stage.getBoundingClientRect(), dR = dk2.right - so2.left, dL = dk2.left - so2.left;
        if (px > dL - 24 && px < dR + 32) px = dR + 32;
      }
      it.prop.classList.toggle('tap-left', px + 150 > G.W);   /* the "1 tap" pill goes on whichever side has room */
      it.prop.style.transform = 'translate3d(' + px + 'px,' + py + 'px,0)';
      if (it.type === 'ask') it.prop.classList.toggle('tapped', age(it) > TAP_AT);
    });

    LIVE.forEach(function (lv) {
      var it = null; TL.forEach(function (q) { if (q.i === lv.i && q.k === lv.beat) it = q; });
      if (!it) return;
      var on = stopOn(it);
      if (on && !lv.on) lv.t0 = SQ[lv.i].instant ? now - 1e5 : now;
      var since = on ? now - (lv.t0 || now) : 0;
      if (lv.def.type === 'focus') {
        var f = on ? clamp((since - (lv.def.delay || 0)) / 450, 0, 1) : 0;
        if (f > 0) arr(lv.def.dim).forEach(function (k) { var e = layerEls[k]; if (e) { e.style.opacity = (parseFloat(e.style.opacity || 1) * (1 - .82 * f)).toFixed(3); e.style.filter = 'grayscale(' + f + ')'; } });
        else arr(lv.def.dim).forEach(function (k) { var e = layerEls[k]; if (e) e.style.filter = ''; });
        if (on && f < 1) ANIM = true;
      } else if (lv.def.type === 'cycle') {
        var focusOn = LIVE.some(function (q) { return q.i === lv.i && q.def.type === 'focus' && q.on; });
        var show = on && !focusOn;
        lv.el.classList.toggle('in', show);
        if (show) {
          var keys = arr(lv.def.keys), kk = keys[Math.floor(since / 380) % keys.length], e2 = layerEls[kk];
          if (e2) { var r2 = e2.getBoundingClientRect(), sr = stage.getBoundingClientRect(); lv.el.style.transform = 'translate3d(' + (r2.left - sr.left + r2.width / 2) + 'px,' + (r2.top - sr.top + r2.height / 2) + 'px,0)'; }
          ANIM = true;
        }
      } else if (lv.def.type === 'pick') {
        lv.el.classList.toggle('in', on);
        lv.el.classList.toggle('chosen', on && since > (lv.def.delay || 800));
        if (on && since < (lv.def.delay || 800) + 50) ANIM = true;
        /* phone: it drops in at the top, under the chrome, like a notification; a later toast of the stop takes its slot */
        if (on && G.mob && LIVE.some(function (q) { return q.i === lv.i && q.def.type === 'toast' && q.on; })) lv.el.classList.remove('in');
        if (on) { lv.el.style.transform = G.mob ? 'translate3d(14px,' + G.slot + 'px,0)' : 'translate3d(' + (cx - 160) + 'px,' + (G.cy - B * .34) + 'px,0)'; if (since < (lv.def.delay || 800) + 50) ANIM = true; }
      } else if (lv.def.type === 'stamp') {
        lv.el.classList.toggle('in', on);
        var e3 = layerEls[lv.def.key];
        if (on && e3) {
          var c3 = (e3.style.clipPath || '').match(/inset\(([-\d.]+)% ([-\d.]+)% ([-\d.]+)% ([-\d.]+)%\)/), r3 = e3.getBoundingClientRect(), sr3 = stage.getBoundingClientRect();
          var L0 = 0, T0 = 0, R0 = 1, B0 = 1;
          if (c3) { T0 = +c3[1] / 100; R0 = 1 - c3[2] / 100; B0 = 1 - c3[3] / 100; L0 = +c3[4] / 100; }
          var ax = r3.left - sr3.left + r3.width * (L0 + (R0 - L0) * lv.def.at[0]), ay = r3.top - sr3.top + r3.height * (T0 + (B0 - T0) * lv.def.at[1]);
          lv.el.style.transform = 'translate3d(' + ax + 'px,' + ay + 'px,0)';
        }
      } else if (lv.def.type === 'toast') {
        if (G.mob && mockupStop(ORDER[lv.i])) on = false;   /* phone: the hero mockup owns the top; its Hub card says the same */
        if (on) lv.el.style.transform = G.mob ? 'translate3d(14px,' + G.slot + 'px,0)' : 'translate3d(' + (cx - 140) + 'px,' + (G.cy + B * (mockupStop(ORDER[lv.i]) ? .66 : .52) + 18) + 'px,0)';
        if (on !== lv.on) lv.el.classList.toggle('in', on);
      } else if (lv.def.type === 'text' && on !== lv.on) {
        var dv = layerEls.device, tgt = dv && dv.firstChild.querySelector('[data-s="' + lv.def.screen + '"] ' + lv.def.sel);
        if (tgt) {
          if (lv.orig == null) lv.orig = tgt.textContent;
          typeInto(tgt, on ? lv.def.to : lv.orig);
          tgt.classList.toggle('changed', on);
        }
      }
      lv.on = on;
    });
  }

  /* the app phone: in for a dock stop once its title has landed; its decisions and records appear as their beats land */
  var DOCK_ON = -1;
  function updateDock(G, cx, B, act, now, shown, age) {
    var id = act >= 0 ? ORDER[act] : '', on = act >= 0 && SQ[act] && SQ[act].n >= 0;
    /* standup: the same app items live inside the phone's Feed screen */
    var si = ORDER.indexOf('standup'), sl = DOCK[si];
    if (sl && !sl.parentNode && layerEls.phone) { var sm = layerEls.phone.querySelector('[data-s="standup"] .ap-msgs'); if (sm) { sl.classList.add('ap-list-in'); sm.appendChild(sl); } }
    if (sl && sl.parentNode && layerEls.phone) {   /* the Feed screen scrolls up to keep the newest card in view */
      var msE = sl.parentNode, scE = msE.parentNode, tpE = scE.querySelector('.ap-top');
      var room = scE.clientHeight - (tpE ? tpE.offsetHeight : 0) - 6, ov = Math.max(0, msE.scrollHeight - room);
      msE.style.transform = ov ? 'translate3d(0,' + (-ov) + 'px,0)' : '';
    }
    var items = TL.filter(function (it) { return it.dock; });
    items.forEach(function (it) {
      var sh = shown(it);
      if (sh !== it.dockOn) { it.dockOn = sh; it.dock.classList.toggle('in', sh); if (sh && !SQ[it.i].instant) FLY.push(it); }
      if (it.type === 'ask') { var pr = sh && age(it) > TAP_AT; if (pr !== it.dockPr) { it.dockPr = pr; it.dock.classList.toggle('pressed', pr); } if (sh && age(it) < TAP_AT + 100) ANIM = true; }
    });
    var show = on && dockStop(id);
    ui.dock.classList.toggle('in', show);
    if (!show) return;
    if (DOCK_ON !== act) { ui.dockBody.textContent = ''; ui.dockBody.appendChild(dockList(act)); DOCK_ON = act; }
    var w, hh, x, y;
    if (G.mob) {
      w = Math.round(G.W * .6); x = 14; y = Math.max(G.top + 2, (MOB.headB || 0) + 8 + (MOB.topC || 0));   /* under the title, and under a toast when one is up */
      hh = Math.min(w * 2.05, (MOB.cur || G.H * .6) + 34 - y);
      ui.dock.style.fontSize = (w / (G.H < 720 ? 20 : 18)).toFixed(2) + 'px';
    } else {
      w = clamp(G.W * .2, 250, 310); hh = Math.min(w * 2.05, G.H - 190);
      var stIt = null; TL.forEach(function (q) { if (q.type === 'stop' && q.i === act) stIt = q; });
      var tB = stIt ? 64 + stIt.el.offsetHeight + 18 : 170;   /* never over the stop's title */
      x = Math.max(24, cx - B * .55 - 48 - w); y = Math.max(tB, G.cy - hh / 2); hh = Math.min(hh, G.H - 70 - y);
      ui.dock.style.fontSize = (w / 18).toFixed(2) + 'px';
    }
    ui.dock.style.width = w + 'px'; ui.dock.style.height = hh + 'px';
    ui.dock.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) rotate(' + (G.mob ? 0 : -3) + 'deg)';
    /* the header follows the newest item: a decision opens its channel, a record its OS area */
    var last = null; items.forEach(function (it) { if (it.i === act && it.dockOn) last = it; });
    var tab = last && last.b.s === 'os' ? 'OS' : 'Chat';
    Array.prototype.forEach.call(ui.dock.querySelectorAll('.tabbar-t'), function (t) { t.classList.toggle('on', t.getAttribute('data-t') === tab); });
    var ttl = !last ? '#' + str(CHANNEL[id], 'general') : last.b.s === 'os' ? str(last.b.area, AREA[id] || 'Records') : '#' + str(last.b.ch, CHANNEL[id] || 'general');
    if (ui.dockTitle.textContent !== ttl) ui.dockTitle.textContent = ttl;
    if (ui.dockMkFor !== id) { ui.dockMkFor = id; ui.dockMk.textContent = ''; ui.dockMk.appendChild(markEl(id)); ui.dockSub.textContent = agentOf(id)[0] + ' is on it'; }
    /* newest at the bottom; when the list outgrows the screen it scrolls up */
    var lst = dockList(act), over = Math.max(0, lst.scrollHeight - ui.dockBody.clientHeight);
    lst.style.transform = 'translate3d(0,' + (-over) + 'px,0)';
  }
  /* a stop whose device runs wider than the object box (a laptop): on phones it is edge to edge */
  function wideScreen(id) { return (S[id] || []).some(function (d) { return d.dom === 'device' && (d.w || 0) > 1.1; }); }
  /* phone: the side margin of the caption sheet (safe-area aware) */
  function mobPad(G) { return Math.max(20, ((G.sa || {}).l || 0) + 16); }
  function markOpt(li, oi) {
    Array.prototype.forEach.call(li.querySelectorAll('.cc-opt'), function (b, i) { b.classList.toggle('on', i === oi); });
    li.classList.add('pressed');
  }
  /* ---------- the scrub ---------- */
  function resolve(def, side) {
    /* the full property set of a layer, optionally pushed to its from/out pose */
    var p = { x: def.x || 0, y: def.y || 0, s: def.s == null ? 1 : def.s, r: def.r || 0, o: def.o == null ? 1 : def.o,
      w: def.w || 0, h: def.h || 0, rad: def.rad || 0, clip: 1 };
    if (MOBILE && def.mob) Object.keys(def.mob).forEach(function (k) { p[k] = def.mob[k]; });
    var d = side ? def[side] : null;
    if (side && !d) d = side === 'from' ? { x: p.x - .35, s: p.s * .94, o: 0 } : { x: p.x + .35, s: p.s * .94, o: 0 };   /* time runs left to right */
    if (d) Object.keys(d).forEach(function (k) { p[k] = d[k]; });
    return p;
  }

  function pose(a, b, t) {
    /* interpolate state a -> state b at t (0..1), returning [{def, p, screens}] */
    var A = S[ORDER[a]], Bs = S[ORDER[b]], out = [], seen = {};
    if (a === b) return A.map(function (d) { var sc = {}; if (d.screen) sc[d.screen] = 1; return { def: d, p: resolve(d), sc: sc }; });
    var e = ease(t), arc = Math.sin(Math.PI * t);
    A.forEach(function (da) {
      var db = null;
      Bs.forEach(function (x) { if (x.k === da.k) db = x; });
      seen[da.k] = 1;
      var pa = resolve(da), pb = db ? resolve(db) : resolve(da, 'out'), p = {};
      Object.keys(pa).forEach(function (k) { p[k] = lerp(pa[k], pb[k], e); });
      if (db) { p.y -= .05 * arc; p.r += 4 * arc * (a % 2 ? 1 : -1); }
      var sc = {};
      if (da.screen) sc[da.screen] = db && db.screen !== da.screen ? 1 - smooth(.2, .65, t) : (db ? 1 : 1);
      if (db && db.screen && db.screen !== da.screen) sc[db.screen] = smooth(.35, .8, t);
      out.push({ def: db || da, p: p, sc: sc });
    });
    Bs.forEach(function (db) {
      if (seen[db.k]) return;
      var pa = resolve(db, 'from'), pb = resolve(db), p = {};
      Object.keys(pa).forEach(function (k) { p[k] = lerp(pa[k], pb[k], e); });
      var sc = {}; if (db.screen) sc[db.screen] = 1;
      out.push({ def: db, p: p, sc: sc });
    });
    return out;
  }

  function safeArea() {
    var c = ui.safe ? getComputedStyle(ui.safe) : null;
    return c ? { t: parseFloat(c.paddingTop) || 0, r: parseFloat(c.paddingRight) || 0, b: parseFloat(c.paddingBottom) || 0, l: parseFloat(c.paddingLeft) || 0 } : { t: 0, r: 0, b: 0, l: 0 };
  }
  function geometry() {
    var W = innerWidth, mob = W < 820;
    if (!mob) { var H0 = innerHeight; return { mob: false, W: W, H: H0, B: Math.min(H0 * .5, W * .32), cy: H0 * .5 }; }
    /* phone, full screen: the scene owns the stage; a thin chrome band on top, the caption sheet at the bottom, and the
       object as big as the space between them allows */
    var H = (stage && stage.clientHeight) || innerHeight, sa = safeArea();
    var top = Math.max(sa.t + 64, (MOB.headB || 0) - (MOB.mock ? 0 : 56)) + (MOB.topC || 0);   /* a dark product mockup never runs under the title */   /* under the title, + room for a toast or pick */
    MOB.rest = H - sa.b - 40;                                        /* no stop up: the scene has the whole screen */
    if (MOB.cur == null || MOB.H !== H) { MOB.cur = MOB.target = MOB.rest; MOB.H = H; }
    var bandTop = MOB.cur, sceneH = bandTop - top + Math.min(56, (H - bandTop) * .25);   /* the stack may overlap the scene's lower edge */
    return { mob: true, W: W, H: H, B: Math.min(W * .9, sceneH * .8), cy: top + sceneH * .5, top: top, bandTop: bandTop, sa: sa };
  }
  /* phone: where the story sheet's top is (cur eases toward target as a stop's thread is laid out) */
  var MOB = { cur: null, target: null, rest: 0, H: 0, topC: 0, topT: 0, headB: 0 }, wasOn = false;
  /* phone: at the door the parcel sits low, on the mat, so the OS panel can float on the wall above it */
  function mobCy(G, idx) { return ORDER[idx] === 'delivered' ? G.bandTop - .62 * G.B : G.cy; }

  /* a config with a `story` block: this engine plays only the opening (the parcel at her door, "Tap the parcel"),
     then hands the page to story.js (the module board) instead of rewinding */
  var HANDED = false, RETIRED = false, SCENES = false;
  /* scenes under the story (v8): story.js drives this engine stage to stage; it stays the full-bleed scene behind the
     cards. go(id) eases the camera to that stage's hold; a slow tick keeps its timed phone messages landing. */
  var SCN = { raf: 0, tick: 0 };
  function sceneGo(id, ms) {
    var i = ORDER.indexOf(id); if (i < 0 || HOLD[i] == null) return false;
    var from = FORCE_POS != null ? FORCE_POS : clamp(scrollY / VH(), 0, total), to = HOLD[i] + SETTLE;
    var D = REDUCE_HAND ? 0 : (ms || Math.min(2800, 1100 + Math.abs(to - from) * 260)), t0 = performance.now();
    cancelAnimationFrame(SCN.raf);
    (function f(now) {
      var k = D ? Math.min(1, (now - t0) / D) : 1, e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      FORCE_POS = from + (to - from) * e; render();
      if (k < 1) SCN.raf = requestAnimationFrame(f);
    })(t0);
    return true;
  }
  function sceneLive(on) { clearInterval(SCN.tick); if (on) SCN.tick = setInterval(function () { if (!document.hidden) render(); }, 250); }
  window.__scenes = { go: sceneGo, live: sceneLive, has: function (id) { var i = ORDER.indexOf(id); return i >= 0 && HOLD[i] != null; } };
  function handToStory() {
    if (HANDED || !window.cosStory) return;
    HANDED = true; HOVER.on = false; clearInterval(presTimer);
    removeEventListener('scroll', onScroll); removeEventListener('resize', onScroll);
    scrollTo(0, 0);
    /* the board is built underneath while the parcel keeps playing; story.js crosses over once stage 1 is decoded,
       then retires this stage (so there is never a blank frame) */
    window.cosStory(cfg, { from: 'parcel', keep: document.getElementById('stage'), retire: function () { RETIRED = true; }, scenes: function () { SCENES = true; HOVER.on = false; return window.__scenes; } });
  }
  var REDUCE_HAND = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function render() {
    if (RETIRED) return;
    raf = 0; ANIM = false;
    var vh = VH(), pos = FORCE_POS != null ? FORCE_POS : clamp(scrollY / vh, 0, total), seg = SEG[SEG.length - 1], i;
    for (i = 0; i < SEG.length; i++) { if (pos < SEG[i].at + SEG[i].len) { seg = SEG[i]; break; } }
    var t = clamp((pos - seg.at) / seg.len, 0, 1);
    if (MOB.cur != null && MOB.target != null && Math.abs(MOB.target - MOB.cur) > .5) { MOB.cur += (MOB.target - MOB.cur) * .16; ANIM_SHEET = true; } else { if (MOB.target != null) MOB.cur = MOB.target; ANIM_SHEET = false; }
    if (Math.abs(MOB.topT - MOB.topC) > .5) { MOB.topC += (MOB.topT - MOB.topC) * .16; ANIM_SHEET = true; } else MOB.topC = MOB.topT;
    var G = geometry(), B = G.B; MOBILE = G.mob;

    /* which state, and the window's presence (0 hidden .. 1 in) */
    var winIn = 0, side = 0, tSide = 0, nowIdx = seg.a;
    function sideOf(idx) { return 0; }   /* the object stays centre; the beats zigzag around it */
    if (seg.type === 'hold') { winIn = smooth(0, .18, t) * (1 - smooth(.9, 1, t)); side = sideOf(seg.a); }
    else if (seg.type === 'trans') {
      side = lerp(sideOf(seg.a), sideOf(seg.b), ease(t)); winIn = 0; nowIdx = t < .5 ? seg.a : seg.b;
    } else if (seg.type === 'rew') { side = 0; nowIdx = t < .5 ? seg.a : seg.b; }
    if (seg.type === 'rew' && seg.b === 0) side = lerp(0, sideOf(0), ease(t));
    if (seg.type === 'intro') side = .3;
    if (seg.type === 'rew' && seg.a === ORDER.length - 1) side = lerp(.3, 0, ease(t));
    tSide = G.mob ? 0 : side;
    if (G.mob) {
      var srT = stage.getBoundingClientRect().top;
      /* the top slot: under the chrome (name + Now line on the left, the pills on the right) */
      G.slot = Math.max(ui.ctl.getBoundingClientRect().bottom, ui.presBar.getBoundingClientRect().bottom, ui.top.getBoundingClientRect().bottom) - srT + 10;
      if (MOB.headB) G.slot = Math.max(G.slot, MOB.headB + 8);   /* OS moments drop in under the stop's title */
      var cyDoor = mobCy(G, ORDER.length - 1);
      G.cy = seg.a === seg.b ? mobCy(G, seg.a) : lerp(mobCy(G, seg.a), mobCy(G, seg.b), ease(t));
      /* the OS panel at the door: full width, on the wall between the chrome and the parcel */
      var nd = (S.delivered || [])[0];
      if (nd && nd.k === 'notify') {
        /* it keeps its proportions: when the story sheet leaves less room, the panel gets smaller instead of cut */
        var ph = clamp(cyDoor - .1 * B - G.slot - 6, 96, Math.min(G.W - 32, 420) / 1.65), pw = Math.min(G.W - 32, 420, ph * 1.65);
        nd.mob = { x: 0, y: (G.slot + ph / 2 - cyDoor) / B, w: pw / B, h: ph / B, r: -1 };
        G.panelFont = Math.min(pw / 27, ph / 15.5);
      }
      G.sheetOn = seg.type === 'hold' || seg.type === 'trans';
    }

    /* camera: object centre glides between left and right of the window, centred during intro and rewind */
    var dk = function (idx) { return idx >= 0 && dockStop(ORDER[idx]) ? 1 : 0; };
    var dF = seg.type === 'hold' ? dk(seg.a) : seg.type === 'trans' ? lerp(dk(seg.a), dk(seg.b), ease(t)) : 0;
    if (G.mob && dF > 0) { B = G.B = lerp(B, Math.min(B, G.W * .46), dF); }   /* phone: the app phone takes the left, the object moves right */
    var mk = function (idx) { return idx >= 0 && mockupStop(ORDER[idx]) ? 1 : 0; };
    var mF = seg.type === 'hold' ? mk(seg.a) : seg.type === 'trans' ? lerp(mk(seg.a), mk(seg.b), ease(t)) : 0;
    if (G.mob && mF > 0) {   /* phone: the app mockup is the hero, sized to the room between the title and the messages */
      var room = G.bandTop - G.top - 10;
      B = G.B = lerp(B, Math.min(G.W * .9, room / 1.42), mF); G.cy = lerp(G.cy, G.top + 4 + room / 2, mF);
    }
    var cx = G.W / 2 + tSide * G.W * .22 + (G.mob ? dF * G.W * .29 : 0);
    var cy = G.cy;
    var a = seg.a, b = seg.b, tt = t;
    if (seg.type === 'hold' || seg.type === 'intro') { b = a; tt = 0; }
    var t2 = (Math.min(a, b) === IO && Math.max(a, b) === IO + 1) ? (a === IO ? clamp(tt / .3, 0, 1) : 1 - clamp((1 - tt) / .3, 0, 1)) : tt;
    var layers = pose(a, b, t2);

    /* the object: one element per layer key, reused across states */
    var live = {};
    layers.forEach(function (L1) {
      var d = L1.def, p = L1.p, el = layerEls[d.k];
      if (!el) el = layerEls[d.k] = makeLayer(d);
      live[d.k] = 1;
      el.style.visibility = '';
      el.style.zIndex = d.z || 2;
      var x = cx + p.x * B, y = cy + p.y * B;
      if (d.dom === 'shadow' || d.dom === 'scan' || d.dom === 'phone' || d.dom === 'device') {
        el.style.width = (p.w * B) + 'px'; el.style.height = (p.h * B) + 'px';
        if (d.dom === 'phone' || d.dom === 'device') el.style.borderRadius = (p.rad * B) + 'px';
        el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) translate(-50%,-50%) rotate(' + p.r + 'deg) scale(' + p.s + ')';
      } else {
        el.style.width = B + 'px'; el.style.height = B + 'px';
        var c = d.crop;
        if (c) {
          /* a piece of a kit photo: (x, y) is where the piece's centre goes; it turns and scales about that centre */
          var ccx = (c[0] + c[2]) / 2 * 100, ccy = (c[1] + c[3]) / 2 * 100;
          el.style.transformOrigin = ccx + '% ' + ccy + '%';
          el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) translate(' + (-ccx) + '%,' + (-ccy) + '%) rotate(' + p.r + 'deg) scale(' + p.s + ')';
          el.style.clipPath = 'inset(' + (c[1] * 100) + '% ' + ((1 - c[2]) * 100) + '% ' + ((1 - c[3]) * 100) + '% ' + (c[0] * 100) + '%)';
        } else {
          el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) translate(-50%,-50%) rotate(' + p.r + 'deg) scale(' + p.s + ')';
          el.style.clipPath = p.clip < 1 ? 'inset(' + ((1 - p.clip) * 100).toFixed(2) + '% 0 0 0)' : '';
        }
      }
      if (d.k === 'notify' && seg.type === 'intro' && !INTRO.done) {
        var ph = INTRO.phone;
        p.o *= ph;
        el.style.transform = el.style.transform.replace(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px/, function (m0, X, Y) {
          return 'translate3d(' + (+X - (1 - ease(ph)) * B * .6 + INTRO.buzz * 4) + 'px,' + (+Y + (1 - ease(ph)) * B * .15) + 'px';
        });
      }
      if (d.k === 'notify') {
        var sc0 = el.firstChild.querySelector('.scr-notify');
        if (sc0) {
          var settled = !(seg.type === 'intro' && !INTRO.done);
          sc0.classList.toggle('awake', settled || INTRO.wake > 0);
          sc0.classList.toggle('n1', settled || INTRO.n1 > 0);
          sc0.classList.toggle('n2', settled || INTRO.n2 > 0);
        }
      }
      el.style.opacity = clamp(p.o, 0, 1).toFixed(3);
      if (d.dom === 'phone' || d.dom === 'device') {
        el.style.fontSize = (d.k === 'notify' && G.mob && G.panelFont ? G.panelFont : B / 26) + 'px';
        Object.keys(L1.sc).forEach(function (n) { screenEl(el, n); });
        Array.prototype.forEach.call(el.firstChild.children, function (s) {
          var w = L1.sc[s.getAttribute('data-s')] || 0;
          s.style.opacity = w.toFixed(3);
        });
      }
    });
    Object.keys(layerEls).forEach(function (k) { if (!live[k]) layerEls[k].style.visibility = 'hidden'; });

    /* the product sits inside its screen's image frame (ad image, listing photo, chat photo, order thumbnail) */
    var dev = layerEls.device, lipEl = layerEls.lip;
    if (dev && lipEl && live.device && live.lip) {
      var tx = 0, ty = 0, ts = 0, wsum = 0;
      Array.prototype.forEach.call(dev.firstChild.children, function (sc) {
        var w = parseFloat(sc.style.opacity || 0), fr = sc.querySelector('.scr-img');
        if (!fr || w < .01) return;
        var r = fr.getBoundingClientRect();
        tx += w * (r.left + r.width / 2); ty += w * (r.top + r.height * .52); ts += w * (r.height * .86 / (.95 * B)); wsum += w;
      });
      if (wsum > .01) {
        tx /= wsum; ty /= wsum; ts /= wsum;
        var m = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px[^)]*\) translate\(-50%, -50%\) rotate\(([-\d.]+)deg\) scale\(([-\d.]+)\)/.exec(lipEl.style.transform);
        if (m) {
          var k2 = clamp(wsum, 0, 1);
          lipEl.style.transform = 'translate3d(' + lerp(+m[1], tx, k2) + 'px,' + lerp(+m[2], ty, k2) + 'px,0) translate(-50%,-50%) rotate(' + m[3] + 'deg) scale(' + lerp(+m[4], ts, k2) + ')';
        }
      }
    }

    var seqOn = null;
    SEQ.forEach(function (q) {
      var on = (seg.type === 'trans' || seg.type === 'rew') && Math.min(a, b) === q.a && Math.max(a, b) === q.b;
      if (!on) { q.el.style.visibility = 'hidden'; return; }
      var f = a === q.a ? tt : 1 - tt, n = q.frames.length;
      var idx = Math.round(clamp(f, 0, 1) * (n - 1));
      for (var j = idx; j >= 0; j--) { if (q.frames[j].complete && q.frames[j].naturalWidth) { idx = j; break; } }
      if (idx !== q.last && q.frames[idx].complete) { q.ctx.drawImage(q.frames[idx], 0, 0, 640, 640); q.last = idx; }
      q.el.style.visibility = 'visible';
      q.el.style.width = q.el.style.height = B + 'px';
      q.el.style.transform = 'translate3d(' + (cx - B / 2) + 'px,' + (cy - B / 2) + 'px,0)';
      seqOn = q;
    });
    if (seqOn) Object.keys(layerEls).forEach(function (k) { if (k !== 'shadow') layerEls[k].style.visibility = 'hidden'; });

    /* the packaging stretch is live 3D: u runs 0..3 across order -> packed -> courier -> delivered */
    if (box3d) {
      /* one 3D stage under everything: desk scenes for the physical middle stops, the packaging stretch after the order */
      var UM = { order: 0, packed: 1, support: 2, courier: 2, delivered: 3 };
      var U = function (i) { return i < IO ? 0 : UM[ORDER[i]]; };
      var spNow = (seg.type === 'hold' || seg.type === 'intro') ? a : lerp(seg.a, seg.b, ease(t));
      var t3 = (Math.min(a, b) === IO && Math.max(a, b) === IO + 1) ? (a === IO ? clamp((tt - .15) / .85, 0, 1) : 1 - clamp((1 - tt - .15) / .85, 0, 1)) : tt;
      var u3 = (seg.type === 'hold' || seg.type === 'intro') ? U(a) : lerp(U(a), U(b), t3);
      if (Math.min(a, b) === IO && Math.max(a, b) === IO + 1) spNow = Math.max(spNow, IO);
      box3d.el.style.visibility = 'visible'; box3d.el.style.opacity = '1';
      box3d.size(G.W, G.H, cx, cy, B);
      box3d.el.style.transform = 'none';
      box3d.pose(u3, seg.type === 'intro' ? INTRO.drop : 1, spNow);
      var lipEl2 = layerEls.lip;
      if (lipEl2 && Math.min(a, b) === IO && Math.max(a, b) === IO + 1 && (seg.type === 'trans' || seg.type === 'rew')) {
        var fwd = a === IO ? tt : 1 - tt;                  /* 0 = on the order screen, 1 = packing */
        var R = box3d.lipRect(), fly = ease(clamp(fwd / .3, 0, 1));
        var mm = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px[^)]*\) translate\(-50%, -50%\) rotate\(([-\d.]+)deg\) scale\(([-\d.]+)\)/.exec(lipEl2.style.transform);
        if (mm && fwd < .3) {
          var fromX = +mm[1], fromY = +mm[2], fromS = +mm[4];
          lipEl2.style.visibility = ''; lipEl2.style.opacity = '1';
          lipEl2.style.transform = 'translate3d(' + lerp(fromX, R.x, fly) + 'px,' + (lerp(fromY, R.y, fly) - Math.sin(Math.PI * fly) * B * .25) + 'px,0) translate(-50%,-50%) rotate(' + (Math.sin(Math.PI * fly) * -14) + 'deg) scale(' + lerp(fromS, R.h / (.475 * B), fly) + ')';
        }
        lipEl2.style.opacity = (1 - smooth(.26, .34, fwd)).toFixed(3);
        box3d.el.style.opacity = smooth(.2, .3, fwd).toFixed(3);
      }
    }

    /* caption under the object */
    var capId = ORDER[nowIdx], st = byId[capId] || {};
    capWhen.textContent = capId === 'voice' ? str((cfg.voice || {}).when, st.when) + ', ' + str((cfg.voice || {}).time) : str(st.when);
    capTitle.textContent = TITLE[capId];
    var capO = seg.type === 'rew' ? 1 : 0;
    ui.cap.style.opacity = capO.toFixed(3);
    ui.cap.style.transform = 'translate3d(' + cx + 'px,' + (cy + B * .56) + 'px,0) translate(-50%,0)';
    ui.cap.classList.toggle('cap-fast', seg.type === 'rew');

    /* intro copy fades as the rewind starts */


    /* the window */

    var wx;
    if (G.mob) {
      win.style.transform = 'translate3d(0,' + ((1 - winIn) * 40) + 'px,0)';
    } else {
      var wSide = -sideOf(seg.a);                       /* the window sits opposite the object */
      wx = (1 - winIn) * 60 * wSide;
      win.style.left = wSide > 0 ? 'auto' : '';
      win.classList.toggle('win-left', wSide < 0);
      win.style.transform = 'translate3d(' + wx + 'px,-50%,0)';
    }
    win.style.display = 'none';

    /* the card presses itself part-way through the hold (a person's one tap) */
    updateTimeline(pos, G, cx, G.mob ? G.H * .6 : G.cy, B);
    linkPhone(G);
    if ((ANIM || (G.mob && ANIM_SHEET)) && !raf) raf = requestAnimationFrame(render);   /* time-based moments keep drawing */
    ui.presBar.style.opacity = seg.type === 'hold' || seg.type === 'trans' ? 1 : 0;
    ui.spine.style.opacity = seg.type === 'hold' || seg.type === 'trans' ? 1 : seg.type === 'rew' && seg.b === 0 ? ease(t) : 0;
  }

  /* the rewind: the first scroll from the parcel goes to the voice note in ONE move (and back up again). The scene in
     front whips off the way it came (time runs left to right, so the past is off to the right), the page jumps while
     nothing is on screen, and the voice note whips in. No scene in between is ever drawn. */
  var AUTO = { on: false, last: 0 }, FORCE_POS = null;
  var SWOOP_EL = function () { return [objEl, ui.props, ui.tl, ui.tlBack, ui.cap]; };
  function blockScroll(e) { e.preventDefault(); }
  function swoop(dir, done) {
    if (AUTO.on) return;
    var vh = VH(), target = dir > 0 ? (HOLD[0] + SETTLE) * vh : 0, W = innerWidth, t0 = 0, D = 760, jumped = false;
    AUTO.on = true; document.documentElement.style.scrollSnapType = 'none';
    FORCE_POS = dir > 0 ? 0 : HOLD[0] + SETTLE;                 /* hold the scene we are leaving; never scrub */
    addEventListener('wheel', blockScroll, { passive: false }); addEventListener('touchmove', blockScroll, { passive: false });
    function paint(x, b) {
      SWOOP_EL().forEach(function (e) { if (!e) return; e.style.transform = x ? 'translate3d(' + x.toFixed(1) + 'px,0,0)' : ''; e.style.filter = b > .2 ? 'blur(' + b.toFixed(1) + 'px)' : ''; });
    }
    function step() {
      var now = performance.now(); if (!t0) t0 = now;
      var k = clamp((now - t0) / D, 0, 1), sgn = dir > 0 ? -1 : 1;   /* to the past: the scene leaves left, the past comes in from the right */
      if (k < .42) { var e1 = Math.pow(k / .42, 2); paint(sgn * e1 * W * .9, e1 * 14); }
      else {
        if (!jumped) { jumped = true; FORCE_POS = null; scrollTo(0, target); AUTO.last = target / vh; }
        var e2 = 1 - Math.pow(1 - (k - .42) / .58, 3); paint(-sgn * (1 - e2) * W * .9, (1 - e2) * 14);
      }
      render();
      if (k < 1) setTimeout(step, 16);                          /* a timer, not rAF, so it always finishes */
      else {
        paint(0, 0); scrollTo(0, target); AUTO.last = target / vh;
        AUTO.on = false; document.documentElement.style.scrollSnapType = '';
        removeEventListener('wheel', blockScroll); removeEventListener('touchmove', blockScroll);
        render(); if (done) done();
      }
    }
    step();
  }
  function autoRewind() {
    var vh = VH(), pos = scrollY / vh, start = L.intro * 0.25, end = HOLD[0];
    var dir = pos - AUTO.last; AUTO.last = pos;
    if (AUTO.on || STILL || PLAY.on || pos <= start || pos >= end - 0.25 || Math.abs(dir) < 1e-4) return;
    swoop(dir > 0 ? 1 : -1);
  }
  /* settle: when scrolling stops between stops (any snap, momentum, a resized viewport), glide to the nearest stop,
     so a stop is always in view and its story plays. Inside the rewind, finish the move instead. */
  var SETTLE_T = 0, TOUCHING = false, GLIDE = 0;
  addEventListener('touchstart', function () { TOUCHING = true; clearTimeout(GLIDE); }, { passive: true });
  addEventListener('touchend', function () { TOUCHING = false; armSettle(); }, { passive: true });
  addEventListener('touchcancel', function () { TOUCHING = false; armSettle(); }, { passive: true });
  addEventListener('wheel', function () { clearTimeout(GLIDE); }, { passive: true });
  function armSettle() { clearTimeout(SETTLE_T); SETTLE_T = setTimeout(settleNow, 260); }
  function settleNow() {
    if (AUTO.on || PLAY.on || TOUCHING || !total || HOLD[0] == null) return;
    var vh = VH(), pos = scrollY / vh, last = ORDER.length - 1;
    if (pos > L.intro * 0.25 && pos < HOLD[0] - 0.1) { if (!STILL) swoop(pos > (L.intro * 0.25 + HOLD[0]) / 2 ? 1 : -1); return; }
    if (pos < HOLD[0] - 0.1 || pos > HOLD[last] + L.hold) return;
    if (activeStop(pos) >= 0) return;
    var y = scrollY, gs = grooveList(), best = gs[0];
    gs.forEach(function (g) { if (Math.abs(g - y) < Math.abs(best - y)) best = g; });
    var from = y, t0 = performance.now(), D = 380;
    document.documentElement.style.scrollSnapType = 'none';
    (function glide() {
      var k = clamp((performance.now() - t0) / D, 0, 1), e = 1 - Math.pow(1 - k, 3);
      scrollTo(0, from + (best - from) * e);
      if (k < 1) GLIDE = setTimeout(glide, 16); else document.documentElement.style.scrollSnapType = '';
    })();
  }
  function onScroll() { if (cfg.story) { if (scrollY > 20) handToStory(); return; } if (!AUTO.on) { autoRewind(); armSettle(); } if (!raf) raf = requestAnimationFrame(render); }

  /* ---------- the one tap: the parcel hangs over her doormat; tapping it drops it, and the story plays itself ---------- */
  var HOVER = { on: false, t0: 0 };
  function startHover() {
    INTRO.done = false; INTRO.phone = 0; INTRO.wake = INTRO.n1 = INTRO.n2 = 0; INTRO.drop = .52;
    HOVER.on = true; HOVER.t0 = performance.now(); stage.classList.add('await');
    ui.hint = h('button', 'hint', 'Tap the parcel'); ui.hint.type = 'button'; stage.appendChild(ui.hint);
    ui.ctl.classList.add('ctl-wait');
    (function bob(now) {
      if (!HOVER.on) return;
      var t = (now - HOVER.t0) / 1000;
      INTRO.drop = .52 + Math.sin(t * 2.2) * .025; INTRO.buzz = 0;
      render(); requestAnimationFrame(bob);
    })(HOVER.t0);
    stage.addEventListener('pointerdown', dropIt);
    addEventListener('keydown', function onKey(e) { if (HOVER.on && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); dropIt(e); } if (!HOVER.on) removeEventListener('keydown', onKey); });
    addEventListener('scroll', function onS() { if (HOVER.on && scrollY > 20) { endHover(); INTRO.done = true; INTRO.drop = 1; render(); if (cfg.story) handToStory(); } removeEventListener('scroll', onS); }, { passive: true });
  }
  function endHover() {
    HOVER.on = false; stage.classList.remove('await'); stage.removeEventListener('pointerdown', dropIt);
    if (ui.hint) { ui.hint.classList.add('out'); var hn = ui.hint; setTimeout(function () { if (hn.parentNode) hn.parentNode.removeChild(hn); }, 400); }
    ui.ctl.classList.remove('ctl-wait');
  }
  function dropIt(e) {
    if (!HOVER.on || (e && e.target && e.target.closest && e.target.closest('.ctl'))) return;
    endHover();
    if (!MUTED && Object.keys(cfg.audio || {}).length) {   /* this tap is the gesture the browser needs for sound */
      SOUND = true;
      if (ui.soundBtn) { ui.soundBtn.textContent = 'Sound on'; ui.soundBtn.setAttribute('aria-pressed', 'true'); }
      var u = PLAYER(); u.muted = true; u.src = (cfg.audio || {})['voice-note'] || ''; var pp = u.play(); if (pp && pp.then) pp.then(function () { u.pause(); u.muted = false; }).catch(function () { u.muted = false; });
    }
    INTRO.t0 = performance.now() - INTRO.drop * 1100;
    requestAnimationFrame(introTick);
    (function after() { if (!INTRO.done) return setTimeout(after, 120); setTimeout(function () { if (cfg.story) return handToStory(); if (scrollY < 20 && !PLAY.on) startPlay(); }, cfg.story ? 2200 : 1500); })();
  }
  function init(raw) {
    if (raw && raw.story) document.documentElement.classList.add('has-story');   /* the story's own UI replaces the old dark app panel */
    /* a config with a `story` block plays as three chapters (story.js); this engine steps aside */
    /* ?step=N, a reload part-way down, or reduced motion go straight to the board */
    if (raw && raw.story && window.cosStory && (/[?&]step=\d/.test(location.search) || STILL || scrollY > 10 || /[?&]nointro\b/.test(location.search))) { window.cosStory(raw); return; }
    cfg = raw || {};
    buildStates(cfg.crops);
    mapsFromConfig();
    arr(cfg.stages).forEach(function (s) { if (s && s.id) byId[s.id] = s; });
    ORDER.forEach(function (id) {
      if (!byId[id]) byId[id] = { id: id };
      var d = decisionOf(byId[id]);
      if (d) {
        var rec = 0; arr(d.options).forEach(function (o, i) { if (o.recommended) rec = i; });
        cards[id] = { state: 'pending', choice: rec };
      }
    });
    document.title = 'COS for ' + str((cfg.brand || {}).name, 'consumer brands') + ' · Company OS for consumer brands';
    total = buildSegments();
    document.getElementById('track').style.height = ((total + 1) * 100) + 'vh';
    var g0 = h('i', 'groove'); g0.style.top = '0'; document.getElementById('track').appendChild(g0);   /* the opening shot */
    build();
    buildTimeline();
    function mount3d() {
      if (box3d || !window.__box3d) return;
      try { box3d = window.__box3d(cfg, kitSrc); box3d.el.style.zIndex = 0; objEl.appendChild(box3d.el); render(); } catch (e) { box3d = null; }
    }
    mount3d(); addEventListener('box3d', mount3d);
    /* video moves: a clip cut into frames, drawn by scroll position (both directions) */
    Object.keys(cfg.sequences || {}).forEach(function (key) {
      var q = cfg.sequences[key], a = ORDER.indexOf(q.from), b = ORDER.indexOf(q.to);
      if (a < 0 || b < 0 || !q.count) return;
      var cv = h('canvas', 'ly ly-seq'); cv.width = cv.height = 640; cv.style.zIndex = 2; cv.style.visibility = 'hidden';
      objEl.appendChild(cv);
      var frames = [];
      for (var i = 0; i < q.count; i++) { var im = new Image(); im.decoding = 'async'; im.src = q.dir + '/' + String(i).padStart(3, '0') + '.webp'; frames.push(im); }
      SEQ.push({ a: Math.min(a, b), b: Math.max(a, b), el: cv, ctx: cv.getContext('2d'), frames: frames, last: -1 });
    });
    /* preload the kit so the scrub never waits */
    Object.keys(S).forEach(function (id) { S[id].forEach(function (d) {
      if (!layerEls[d.k]) {
        layerEls[d.k] = makeLayer(d); layerEls[d.k].style.visibility = 'hidden';
        if (layerEls[d.k].decode) layerEls[d.k].decode().catch(function () {});
      }
    }); });
    if (window.renderEnding) window.renderEnding(cfg, document.getElementById('end'));
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    presTimer = setInterval(function () { if (cur >= 0) { presIdx++; presence(); } }, 2600);
    render();
    window.__render = render;
    if (cfg.story && /[?&]autoplay\b/.test(location.search)) { startHover(); setTimeout(function () { dropIt(); }, 1800); }
    else if (!STILL && scrollY < 10 && !/[?&]nointro\b/.test(location.search)) startHover();
    else if (/[?&]autoplay\b/.test(location.search)) setTimeout(startPlay, 600);
  }

  var q = new URLSearchParams(location.search);
  brandId = (q.get('brand') || 'ohra').replace(/[^a-z0-9_-]/gi, '');
  fetch('./brands/' + brandId + '.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(init)
    .catch(function (e) { console.error(e && e.stack); document.getElementById('stage').textContent = 'Could not load brands/' + brandId + '.json (' + e.message + ')'; });
})();
