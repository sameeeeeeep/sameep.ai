/* story.js (v4): the product's journey through the Chief of Staff, idea to doorstep. Interactive by default.
   Used when the brand config has a `story` block; scroll.js plays the parcel opening, then hands over
   (window.cosStory(cfg, {from: 'parcel'})). A deep link (?step=N) opens on an Enter gate instead.

   Screen: header (brand, team, Prev / Play demo / Next, sound) · a strip of stages with days · three columns:
   module tiles | the active module (its people and agents, the stage of objects, a caption, the thread) | the dark
   Now card, "OS · this product" and the stage checklist.

   Beats run in strict order, one at a time: a message (its voice note plays to the end), an agent's "working…" then its
   result, a task that ticks, a decision. Decisions wait for the VIEWER: the AI pick is marked, either option is real,
   and each option has its own object, OS values, delay in days and consequence beats (`then`) before the story rejoins.
   Next finishes the current beat at once; at a decision it takes the AI pick; at the end of a stage it opens the
   next one. Play demo runs it all (decisions take the AI pick after a pause), paced by the audio and reading time.

   config.story = { title, line, product{name,img}, os_keys, modules[], chapters[{ title, stops[] }] }
   stop  = { id, module, label, day, when, title, scene{objs[]}, thread[item] }
   item  = { k: msg|cos|task|decision|record, who, agent, text, voice, len, via, where, desc, media, done, owner, land,
             os{}, options[{ label, ai, land, os{}, delay, then[item] }], title, rows, area, tray }
   Sound: on after the first tap (parcel or Enter); never with ?mute. ?autoplay starts Play demo; ?step=N opens stage N. */
(function () {
  'use strict';
  var Q = new URLSearchParams(location.search);
  var MUTED = Q.has('mute'), REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cfg, stops = [], mods = [], si = -1, maxSeen = 0, tok = 0, AUTO = Q.has('autoplay'), ui = {}, tiles = {};
  var CH = {}, OS = {}, DELAY = {}, state = 'idle';

  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function str(v, d) { return (typeof v === 'string' && v.trim()) ? v.trim() : (d || ''); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function words(t) { return String(t || '').split(/\s+/).filter(Boolean).length; }
  function first(w) { return str(w).split(/\s+/)[0]; }
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }
  function raf2(fn) { requestAnimationFrame(function () { requestAnimationFrame(fn); }); }

  /* ---------- waits that Next can cut short ---------- */
  var W = null;
  function wait(ms, t) {
    return new Promise(function (res, rej) {
      var w = { done: function () { if (W === w) W = null; clearTimeout(w.timer); t === tok ? res() : rej('stale'); } };
      w.timer = setTimeout(w.done, REDUCED ? Math.min(ms, 300) : ms); W = w;
    });
  }
  function skip() { if (NOW) stopVoice(); if (W) W.done(); }

  /* ---------- sound ---------- */
  var AC = null, SOUND = false, NOW = null, NOISE = null;
  function unlock() {
    if (MUTED) return;
    try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); SOUND = true; } catch (e) { AC = null; }
    setSoundBtn();
  }
  function tone(f, t0, d, v, type, to) {
    var o = AC.createOscillator(), g = AC.createGain(), n = AC.currentTime + t0;
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, n); if (to) o.frequency.exponentialRampToValueAtTime(to, n + d);
    g.gain.setValueAtTime(0, n); g.gain.linearRampToValueAtTime(v, n + .01); g.gain.exponentialRampToValueAtTime(.0001, n + d);
    o.connect(g); g.connect(AC.destination); o.start(n); o.stop(n + d + .05);
  }
  function noise(t0, d, v, f0, f1) {
    if (!NOISE) { NOISE = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); var c = NOISE.getChannelData(0); for (var i = 0; i < c.length; i++) c[i] = Math.random() * 2 - 1; }
    var s = AC.createBufferSource(), fl = AC.createBiquadFilter(), g = AC.createGain(), n = AC.currentTime + t0;
    s.buffer = NOISE; fl.type = 'bandpass'; fl.Q.value = .8; fl.frequency.setValueAtTime(f0, n); fl.frequency.exponentialRampToValueAtTime(f1, n + d);
    g.gain.setValueAtTime(0, n); g.gain.linearRampToValueAtTime(v, n + d * .4); g.gain.exponentialRampToValueAtTime(.0001, n + d);
    s.connect(fl); fl.connect(g); g.connect(AC.destination); s.start(n); s.stop(n + d + .05);
  }
  var SFX = {
    msg: function () { tone(1046, 0, .11, .04); tone(1568, .06, .15, .03); },
    voice: function () { tone(520, 0, .06, .03, 'sine', 780); },
    typing: function () { tone(1320, 0, .03, .015, 'triangle'); tone(1320, .09, .03, .012, 'triangle'); },
    task: function () { tone(880, 0, .07, .025, 'triangle'); },
    done: function () { tone(784, 0, .12, .03); tone(1175, .08, .2, .03); },
    ask: function () { tone(1800, 0, .03, .03, 'square', 900); },
    decision: function () { tone(659, 0, .14, .03); tone(880, .09, .14, .03); tone(1319, .18, .26, .026); },
    land: function () { tone(110, 0, .22, .06, 'sine', 60); noise(0, .12, .02, 900, 300); },
    stage: function () { noise(0, .6, .025, 400, 2200); tone(392, .12, .7, .018); }
  };
  function sfx(k) { if (!SOUND || !AC || MUTED || !SFX[k]) return; try { SFX[k](); } catch (e) { /* */ } }
  var CLIPS = {};
  function clipUrl(v) { if (!v) return ''; var A = cfg.audio || {}; return A[v] || (/\.(mp3|m4a|ogg|wav)(\?|$)|^blob:/.test(v) ? v : ''); }
  function clip(url) { if (!CLIPS[url]) { var a = new Audio(); a.preload = 'auto'; a.src = url; CLIPS[url] = a; } return CLIPS[url]; }
  function stopVoice() { if (NOW) { var n = NOW; NOW = null; try { n.a.pause(); } catch (e) { /* */ } n.el.classList.remove('is-playing'); if (n.end) n.end(); } }
  function playVoice(url, el, onEnd) {
    stopVoice();
    if (!url || !SOUND || MUTED) return false;
    var a = clip(url); try { a.currentTime = 0; } catch (e) { /* */ } a.volume = .9;
    var me = { a: a, el: el, end: onEnd }; NOW = me; el.classList.add('is-playing'); sfx('voice');
    var bar = el.querySelector('.vn-prog');
    a.ontimeupdate = function () { if (bar && a.duration) bar.style.transform = 'scaleX(' + (a.currentTime / a.duration).toFixed(3) + ')'; };
    a.onended = a.onerror = function () { if (NOW !== me) return; NOW = null; el.classList.remove('is-playing'); if (bar) bar.style.transform = 'scaleX(1)'; if (onEnd) onEnd(); };
    var p = a.play(); if (p && p.catch) p.catch(function () { if (NOW === me) { NOW = null; el.classList.remove('is-playing'); if (onEnd) onEnd(); } });
    return true;
  }
  function setSoundBtn() { if (!ui.sound) return; ui.sound.textContent = SOUND ? 'Sound on' : 'Sound off'; ui.sound.setAttribute('aria-pressed', SOUND ? 'true' : 'false'); }

  /* ---------- assets, people, agents ---------- */
  function asset(key) {
    if (!key) return '';
    var A = cfg.assets || {};
    if (A[key]) return A[key];
    if (/^(blob:|data:|https?:|\.|\/|p\/)|\.(webp|png|jpe?g)(\?|$)/.test(key)) return key;
    return 'assets/' + cfg.id + '/' + key + '.webp';
  }
  var FACES = {
    ohra: ['aditi', 'naina', 'arjun', 'tanvi', 'vikram', 'kavya', 'customer', 'agency'],
    ondri: ['kavya', 'meher', 'rohan', 'tara', 'zoya', 'ira', 'customer', 'agency'],
    siro: ['nikhil', 'pooja', 'farhan', 'leela', 'varun', 'meera', 'customer', 'agency']
  };
  function isCustomer(w) { return /customer|,/i.test(w); }
  function isAgency(w) { return /studio|agency/i.test(w); }
  function isAgent(w) { return /agent$|^chief of staff$/i.test(str(w)); }
  function faceSrc(who) {
    var w = str(who), F = cfg.faces || {};
    var keys = [w, first(w), first(w).toLowerCase(), isCustomer(w) ? 'customer' : isAgency(w) ? 'agency' : ''];
    for (var i = 0; i < keys.length; i++) if (keys[i] && typeof F[keys[i]] === 'string' && F[keys[i]]) return F[keys[i]];
    var s = isCustomer(w) ? 'customer' : isAgency(w) ? 'agency' : first(w).toLowerCase();
    return (FACES[cfg.id] || []).indexOf(s) >= 0 ? 'faces/' + cfg.id + '-' + s + '.webp' : '';
  }
  function roleOf(who) { var t = arr(cfg.team).filter(function (m) { return m.name === first(who) || m.name === who; })[0]; return t ? t.role : /^GG/.test(str(who)) ? 'Founder’s agent' : ''; }
  function agentMark(n) { n = str(n, 'Chief of staff'); return /^chief/i.test(n) ? 'CS' : n.charAt(0).toUpperCase(); }
  function faceEl(who, cls) {
    var w = str(who, '?'), el = h('span', 'sx-face' + (cls ? ' ' + cls : ''));
    el.title = w;
    if (isAgent(w)) { el.classList.add('sx-mark'); el.textContent = agentMark(w); return el; }
    var src = faceSrc(w);
    if (src) { var im = h('img'); im.alt = ''; im.decoding = 'async'; im.src = src; el.appendChild(im); }
    else el.textContent = /^GG/.test(w) ? 'GG' : w.charAt(0);
    return el;
  }

  /* ---------- public brands: stops from the older stage schema ---------- */
  var STAGE_MOD = { voice: 'ideas', standup: 'ideas', hire: 'npd', samples: 'npd', vendor: 'npd', packaging: 'npd', po: 'npd',
    shoot: 'marketing', listing: 'listing', ad: 'marketing', order: 'logistics', packed: 'warehouse', support: 'crm', courier: 'logistics', delivered: 'crm' };
  var STAGE_AGENT = { voice: 'Research agent', standup: 'Chief of staff', samples: 'Research agent', vendor: 'Vendor agent', packaging: 'Design agent',
    po: 'Vendor agent', shoot: 'Content agent', listing: 'Website agent', ad: 'Ads agent', order: 'Ops agent', packed: 'Ops agent', courier: 'Ops agent', support: 'Support agent', delivered: 'Chief of staff' };
  var STAGE_LABEL = { voice: 'Idea', standup: 'Plan', samples: 'Samples', vendor: 'Vendor', packaging: 'Packaging', po: 'PO', shoot: 'Shoot', listing: 'Listing', ad: 'Ads', order: 'First order', delivered: 'Loop closed' };
  var DEFAULT_MODS = [
    { id: 'ideas', name: '#ideas', about: 'Voice notes and DMs become ideas', agent: 'Research agent' },
    { id: 'npd', name: '#npd', about: 'Concepts, samples, vendors, packaging', agent: 'Vendor agent' },
    { id: 'logistics', name: '#logistics', about: 'Inbound and outbound shipments', agent: 'Ops agent' },
    { id: 'warehouse', name: '#warehouse', about: 'Receiving, QC, dispatch', agent: 'Ops agent' },
    { id: 'listing', name: '#listing', about: 'D2C and marketplaces', agent: 'Website agent' },
    { id: 'marketing', name: '#marketing', about: 'Shoots, creators, ads', agent: 'Ads agent' },
    { id: 'crm', name: '#crm', about: 'Delivered, check-ins, repeat', agent: 'Support agent' }];
  function stageStop(id, n) {
    var st = arr(cfg.stages).filter(function (s) { return s.id === id; })[0];
    if (!st) return null;
    var fl = arr(st.flow), A = cfg.audio || {}, th = [], ag = STAGE_AGENT[id] || 'Chief of staff';
    fl.forEach(function (b, i) {
      if ((b.t === 'raised' && b.who) || b.t === 'q') {
        var v = id === 'voice' && i === 0 ? 'voice-note' : A[id + '-' + (i + 1)] ? id + '-' + (i + 1) : b.t === 'q' && A[id + '-q'] ? id + '-q' : isAgency(b.who) && A[id + '-agency'] ? id + '-agency' : '';
        th.push({ k: 'msg', who: b.who, via: b.via, where: b.where, text: id === 'voice' && i === 0 && cfg.voice ? cfg.voice.words : b.text, voice: v,
          len: id === 'voice' && i === 0 && cfg.voice ? cfg.voice.length : (b.media && b.media.len) || '' });
        if (b.t === 'q' && b.answer) th.push({ k: 'cos', agent: ag, text: b.answer });
      } else if (b.t === 'ask') {
        var ops = arr(b.options);
        th.push({ k: 'decision', who: b.who, text: b.text, options: ops.map(function (o, j) {
          return j === 0 ? { label: o, ai: true } : { label: o, then: [{ k: 'cos', agent: ag, text: 'Noted. Going with "' + ops[0] + '" after a second look: it keeps the date.' }] }; }) });
      } else if (b.t === 'assign' || b.t === 'done') th.push({ k: 'task', owner: ag, text: b.text, done: b.desc || 'Done' });
      else th.push({ k: 'cos', agent: ag, text: b.text, desc: b.desc || b.caught, media: b.media && b.media.type !== 'photo' ? b.media : null });
    });
    var obj = st.object === 'phone' ? 'hero' : st.object === 'wireframe' ? 'wireframe_ink' : st.object;
    var objs = id === 'voice' ? [{ id: 'vn', voice: { who: (cfg.voice || {}).who, len: (cfg.voice || {}).length, time: (cfg.voice || {}).time }, x: 50, y: 50, w: 60 }]
      : [{ id: 'main', src: obj, x: 50, y: 52, w: 64 }];
    return { id: id, module: STAGE_MOD[id] || 'ideas', label: STAGE_LABEL[id] || id, day: null, when: st.when, title: st.summary, scene: { objs: objs }, thread: th.slice(0, 6) };
  }

  /* ---------- the page ---------- */
  function svg(d) { return '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="' + d + '" fill="currentColor"/></svg>'; }
  function build() {
    document.documentElement.classList.add('is-story');
    var track = document.getElementById('track');
    track.innerHTML = ''; track.className = 'sx-track'; track.style.height = '';
    var stage = h('div', 'sx-stage'); ui.stage = stage; track.appendChild(stage);

    var top = h('header', 'sx-top');
    var br = h('div', 'sx-brand'); br.appendChild(h('span', 'sx-logo', str((cfg.brand || {}).name, 'C').replace(/[^a-z]/gi, '').charAt(0).toUpperCase()));
    var bt = h('span', 'sx-brand-t'); bt.appendChild(h('b', null, str((cfg.brand || {}).name))); bt.appendChild(h('span', null, 'Chief of Staff')); br.appendChild(bt);
    top.appendChild(br);
    var team = h('div', 'sx-team');
    var stack = h('span', 'sx-people'); arr(cfg.team).forEach(function (m) { stack.appendChild(faceEl(m.name, 'is-sm')); }); team.appendChild(stack);
    var agents = {}; stops.forEach(function (s) { arr(s.thread).forEach(function (it) { var a = it.k === 'cos' ? str(it.agent, 'Chief of staff') : isAgent(it.owner) ? it.owner : ''; if (a) agents[a] = 1; }); });
    team.appendChild(h('span', 'sx-team-n', arr(cfg.team).length + ' people · ' + Object.keys(agents).length + ' agents'));
    top.appendChild(team);
    var ctl = h('div', 'sx-ctl');
    ui.prev = h('button', 'sx-btn sx-icon'); ui.prev.type = 'button'; ui.prev.setAttribute('aria-label', 'Previous stage'); ui.prev.innerHTML = svg('M10.5 3 5.5 8l5 5');
    ui.prev.querySelector('path').setAttribute('fill', 'none'); ui.prev.querySelector('path').setAttribute('stroke', 'currentColor'); ui.prev.querySelector('path').setAttribute('stroke-width', '2');
    ui.play = h('button', 'sx-btn sx-play'); ui.play.type = 'button';
    ui.next = h('button', 'sx-btn sx-next'); ui.next.type = 'button';
    ui.prev.addEventListener('click', function () { if (si > 0) open(si - 1, -1); });
    ui.play.addEventListener('click', function () { unlock(); setAuto(!AUTO); });
    ui.next.addEventListener('click', function () { unlock(); next(); });
    ctl.appendChild(ui.prev); ctl.appendChild(ui.play); ctl.appendChild(ui.next);
    if (!MUTED) {
      ui.sound = h('button', 'sx-btn sx-sound'); ui.sound.type = 'button';
      ui.sound.addEventListener('click', function () { if (!SOUND) unlock(); else { SOUND = false; stopVoice(); } setSoundBtn(); });
      ctl.appendChild(ui.sound); setSoundBtn();
    }
    top.appendChild(ctl);
    stage.appendChild(top);

    /* the journey strip */
    ui.strip = h('nav', 'sx-strip'); ui.strip.setAttribute('aria-label', 'Stages');
    stops.forEach(function (s, i) {
      var b = h('button', 'sx-st'); b.type = 'button'; b.dataset.i = i;
      b.appendChild(h('span', 'sx-st-n', String(i + 1)));
      var tx = h('span', 'sx-st-tx'); tx.appendChild(h('b', null, s.label)); b._sub = h('span', null, modOf(s.module).name); tx.appendChild(b._sub); b.appendChild(tx);
      b.addEventListener('click', function () { if (i <= maxSeen && i !== si) { unlock(); open(i, i < si ? -1 : 1); } });
      ui.strip.appendChild(b);
    });
    stage.appendChild(ui.strip);

    var main = h('div', 'sx-main'); stage.appendChild(main);
    /* left: module tiles */
    ui.tiles = h('nav', 'sx-tiles'); ui.tiles.setAttribute('aria-label', 'Modules'); main.appendChild(ui.tiles);
    mods.forEach(function (m) {
      var t = h('button', 'sx-tile'); t.type = 'button'; t.dataset.mod = m.id;
      var hd = h('div', 'sx-tile-hd'); hd.appendChild(h('b', null, m.name)); t._status = h('span', 'sx-tile-st', ''); hd.appendChild(t._status); t.appendChild(hd);
      var pv = h('div', 'sx-tile-pv'); t._pvFace = h('span', 'sx-tile-face'); pv.appendChild(t._pvFace); t._pv = h('span', 'sx-tile-tx', m.about || ''); pv.appendChild(t._pv); t.appendChild(pv);
      var ft = h('div', 'sx-tile-ft'); t._people = h('span', 'sx-people'); ft.appendChild(t._people); t._agent = h('span', 'sx-agent', m.agent || ''); ft.appendChild(t._agent); t.appendChild(ft);
      owners(m).forEach(function (p) { t._people.appendChild(faceEl(p, 'is-xs')); });
      t.addEventListener('click', function () {
        var last = -1; stops.forEach(function (s, i) { if (s.module === m.id && i <= maxSeen) last = i; });
        if (last >= 0 && last !== si) { unlock(); open(last, last < si ? -1 : 1); }
      });
      tiles[m.id] = t; ui.tiles.appendChild(t);
    });

    /* centre: the active module */
    var card = h('section', 'sx-card'); main.appendChild(card);
    var ch = h('div', 'sx-card-hd');
    var cn = h('div', 'sx-chan'); ui.chan = h('b', null, ''); cn.appendChild(ui.chan); ui.purpose = h('span', null, ''); cn.appendChild(ui.purpose); ch.appendChild(cn);
    ui.who = h('div', 'sx-card-who'); ch.appendChild(ui.who);
    card.appendChild(ch);
    ui.scene = h('div', 'sx-scene'); card.appendChild(ui.scene);
    ui.cap = h('div', 'sx-cap'); ui.cap.setAttribute('aria-live', 'polite'); card.appendChild(ui.cap);
    ui.thread = h('div', 'sx-thread'); ui.thread.setAttribute('role', 'log'); ui.thread.setAttribute('aria-live', 'polite'); card.appendChild(ui.thread);

    /* right: now, OS, checklist */
    var side = h('aside', 'sx-side'); main.appendChild(side);
    var now = h('section', 'sx-now'); ui.now = now;
    var nh = h('div', 'sx-now-hd'); ui.nowDay = h('span', null, ''); ui.nowN = h('span', null, ''); nh.appendChild(ui.nowDay); nh.appendChild(ui.nowN); now.appendChild(nh);
    var nb = h('div', 'sx-now-bd'); ui.nowImg = h('span', 'sx-now-img'); nb.appendChild(ui.nowImg);
    var nt = h('div'); ui.nowLabel = h('b', null, ''); ui.nowLine = h('span', null, ''); nt.appendChild(ui.nowLabel); nt.appendChild(ui.nowLine); nb.appendChild(nt); now.appendChild(nb);
    ui.nowPeople = h('div', 'sx-now-people'); now.appendChild(ui.nowPeople);
    ui.nowBtn = h('button', 'sx-now-btn'); ui.nowBtn.type = 'button'; ui.nowBtn.addEventListener('click', function () { unlock(); next(); }); now.appendChild(ui.nowBtn);
    side.appendChild(now);
    var os = h('section', 'sx-os'); os.appendChild(h('b', 'sx-side-h', 'OS · this product'));
    ui.os = h('dl', 'sx-os-dl'); os.appendChild(ui.os); side.appendChild(os);
    arr(cfg.story.os_keys || ['Idea', 'Format', 'Vendor', 'Shade', 'Units', 'Launch', 'Channels', 'Orders']).forEach(function (k) {
      var dt = h('dt', null, k), dd = h('dd', null, '—'); ui.os.appendChild(dt); ui.os.appendChild(dd); ui['os_' + k] = dd;
    });
    var ck = h('section', 'sx-check'); ui.checkH = h('b', 'sx-side-h', 'This stage'); ck.appendChild(ui.checkH);
    ui.check = h('ul', 'sx-check-ul'); ck.appendChild(ui.check); side.appendChild(ck);

    var endEl = document.getElementById('end');
    if (window.renderEnding && endEl) { endEl.innerHTML = ''; window.renderEnding(cfg, endEl); }
  }
  function owners(m) { return (Array.isArray(m.owners) ? m.owners : m.owner ? [m.owner] : []).slice(0, 3); }
  function modOf(id) { return mods.filter(function (m) { return m.id === id; })[0] || { id: id, name: '#' + id }; }

  /* ---------- preload this stage and the next two ---------- */
  var LOADED = {};
  function preload(i) {
    if (i < 0 || i >= stops.length) return Promise.resolve();
    if (LOADED[i]) return LOADED[i];
    var s = stops[i], jobs = [];
    function img(src) { if (!src) return; var im = new Image(); im.src = src; jobs.push((im.decode ? im.decode() : Promise.resolve()).catch(function () {})); }
    arr(s.scene && s.scene.objs).forEach(function (o) { if (o.src) img(asset(o.src)); if (o.voice) img(faceSrc(o.voice.who)); if (o.listing) img(asset(o.listing.src || (cfg.story.product || {}).img)); });
    (function walk(list) { arr(list).forEach(function (it) {
      if (it.who) img(faceSrc(it.who));
      if (it.media && (it.media.src || it.media.kit)) img(asset(it.media.src || it.media.kit));
      var u = clipUrl(it.voice); if (u) clip(u);
      arr(it.options).forEach(function (o) { walk(o.then); });
    }); })(s.thread);
    LOADED[i] = Promise.race([Promise.all(jobs), new Promise(function (r) { setTimeout(r, 3000); })]);
    return LOADED[i];
  }

  /* ---------- objects ---------- */
  function bars(n, cls) {
    var w = h('span', cls);
    for (var i = 0; i < n; i++) { var b = h('i'); b.style.height = (25 + Math.round(70 * Math.abs(Math.sin(i * 2.3 + 1) * Math.cos(i * .7)))) + '%'; w.appendChild(b); }
    return w;
  }
  function objEl(o) {
    var el = h('div', 'sx-ob'); el.dataset.id = o.id || '';
    el.style.left = (o.x != null ? o.x : 50) + '%'; el.style.top = (o.y != null ? o.y : 55) + '%';
    el.style.setProperty('--w', (o.w || 50) + '%'); el.style.setProperty('--r', (o.rot || 0) + 'deg'); el.style.zIndex = o.z || 1;
    var body;
    if (o.doc || o.idea) {
      var d = o.doc || o.idea;
      body = h('div', 'sx-paper' + (o.idea ? ' is-idea' : ''));
      if (o.idea) body.appendChild(h('span', 'sx-paper-k', str(o.idea.kind, 'Idea')));
      body.appendChild(h('b', 'sx-paper-t', str(d.title)));
      if (d.sub) body.appendChild(h('span', 'sx-paper-s', d.sub));
      var dl = h('dl'); arr(d.rows).forEach(function (r) { dl.appendChild(h('dt', null, r[0])); dl.appendChild(h('dd', null, r[1])); }); body.appendChild(dl);
    } else if (o.voice) {
      body = h('div', 'sx-vnote');
      var top = h('div', 'sx-vnote-hd'); top.appendChild(faceEl(o.voice.who, 'is-big'));
      var nm = h('div'); nm.appendChild(h('b', null, str(o.voice.who))); nm.appendChild(h('span', null, [o.voice.time, 'voice note', o.voice.len].filter(Boolean).join(' · '))); top.appendChild(nm);
      body.appendChild(top); body.appendChild(bars(40, 'sx-vnote-wave'));
    } else if (o.swatch) {
      body = h('div', 'sx-chip'); var sw = h('i'); sw.style.background = o.swatch.color; body.appendChild(sw);
      var tx = h('div'); tx.appendChild(h('b', null, o.swatch.name)); if (o.swatch.sub) tx.appendChild(h('span', null, o.swatch.sub)); body.appendChild(tx);
    } else if (o.swipes) {
      body = h('div', 'sx-swipes');
      if (o.title) body.appendChild(h('b', 'sx-swipes-t', o.title));
      var row = h('div', 'sx-swipes-row');
      o.swipes.forEach(function (s) { var c = h('div', 'sx-swipe'); var sk = h('span', 'sx-skin'); var st = h('i'); st.style.background = s.color; sk.appendChild(st); c.appendChild(sk); c.appendChild(h('span', null, s.name)); row.appendChild(c); });
      body.appendChild(row);
    } else if (o.listing) {
      var L = o.listing; body = h('div', 'sx-listing');
      body.appendChild(h('span', 'sx-listing-ch', L.channel));
      var im = h('img'); im.alt = ''; im.src = asset(L.src || (cfg.story.product || {}).img); body.appendChild(im);
      el._line = h('b', null, str(L.title, (cfg.story.product || {}).name)); body.appendChild(el._line);
      var pr = h('div', 'sx-listing-pr'); pr.appendChild(h('span', null, str(L.price, '₹999'))); if (L.note) pr.appendChild(h('span', 'sx-listing-n', L.note)); body.appendChild(pr);
    } else {
      body = h('img', 'sx-ob-img'); body.alt = ''; body.decoding = 'async'; body.src = asset(o.src);
    }
    if (o.label) el.appendChild(h('span', 'sx-ob-label', o.label));
    el._stamp = h('span', 'sx-stamp', ''); el.appendChild(el._stamp);
    var inner = h('div', 'sx-ob-in'); inner.appendChild(body); el.appendChild(inner);
    if (o.at === 'cue') el.classList.add('is-wait');
    return el;
  }
  function setScene(stop, dir) {
    each(ui.scene.querySelectorAll('.sx-set'), function (old) {
      old.classList.add(dir < 0 ? 'is-out-back' : 'is-out'); setTimeout(function () { if (old.parentNode) old.parentNode.removeChild(old); }, 700);
    });
    var set = h('div', 'sx-set');
    arr((stop.scene || {}).objs).forEach(function (o) { set.appendChild(objEl(o)); });
    set.classList.add(dir < 0 ? 'is-in-back' : 'is-in');
    ui.scene.appendChild(set); ui.set = set;
    raf2(function () { set.classList.remove('is-in', 'is-in-back'); });
  }
  function land(id, quiet, note) {
    var set = ui.set; if (!set || !id) return;
    if (Array.isArray(id)) { id.forEach(function (x, n) { if (quiet) land(x, true); else setTimeout(function () { land(x); }, n * 220); }); return; }
    var e = set.querySelector('.sx-ob[data-id="' + id + '"]'); if (!e) return;
    if (note) { e._stamp.textContent = note; e.classList.add('has-stamp'); }
    if (!e.classList.contains('is-wait')) return;
    /* an object that takes another's place (the glass mockup, a vendor chip) hides the one already there */
    each(set.querySelectorAll('.sx-ob:not(.is-wait)'), function (o) { if (o !== e && o.style.left === e.style.left && o.style.top === e.style.top) o.classList.add('is-gone'); });
    e.classList.remove('is-wait'); if (!quiet) { e.classList.add('is-land'); setTimeout(function () { sfx('land'); }, 380); }
  }
  function listingLine(text) { if (!ui.set) return; each(ui.set.querySelectorAll('.sx-ob'), function (e) { if (e._line && text) e._line.textContent = text; }); }

  /* ---------- the caption under the stage ---------- */
  function caption(stop) {
    each(ui.cap.children, function (old) { old.classList.add('is-gone'); setTimeout(function () { if (old.parentNode) old.parentNode.removeChild(old); }, 350); });
    var c = h('div', 'sx-cap-in');
    c.appendChild(h('span', 'sx-cap-mod', modOf(stop.module).name + (stop.when ? ' · ' + stop.when : '')));
    c.appendChild(h('h2', 'sx-title', str(stop.title)));
    ui.cap.appendChild(c);
  }

  /* ---------- the thread ---------- */
  var VIA = { whatsapp: 'WhatsApp', email: 'Email', meeting: 'Meeting', call: 'Call', dm: 'Instagram DM', app: '' };
  function mediaEl(m) {
    if (!m || !m.type) return null;
    var el = h('div', 'sx-media sx-m-' + m.type);
    if (m.type === 'chart') {
      var max = Math.max.apply(null, arr(m.values).map(Number)) || 1;
      arr(m.values).forEach(function (v, i) {
        var row = h('div', 'sx-bar' + (i === (m.hi || 0) ? ' is-hi' : ''));
        row.appendChild(h('span', 'sx-bar-l', str(arr(m.labels)[i])));
        var tr = h('span', 'sx-bar-t'); var f = h('i'); f.style.transform = 'scaleX(' + (Number(v) / max).toFixed(3) + ')'; tr.appendChild(f); row.appendChild(tr);
        row.appendChild(h('span', 'sx-bar-v', String(v)));
        el.appendChild(row);
      });
      if (m.unit) el.appendChild(h('span', 'sx-media-note', m.unit));
    } else if (m.type === 'swatch') {
      var sw = h('div', 'sx-sw'); arr(m.colors).forEach(function (c) { var i = h('i'); i.style.background = c; sw.appendChild(i); });
      el.appendChild(sw); if (m.label) el.appendChild(h('span', 'sx-media-note', m.label));
    } else if (m.type === 'doc' || m.type === 'link') {
      el.appendChild(h('b', null, str(m.name || m.title))); if (m.note) el.appendChild(h('span', 'sx-media-note', m.note));
    } else return null;
    return el;
  }
  function row(it) {
    var k = it.k, r = h('div', 'sx-row sx-' + k);
    if (k === 'msg' || k === 'cos') {
      var who = k === 'cos' ? str(it.agent, 'Chief of staff') : str(it.who);
      r.appendChild(faceEl(who));
      var b = h('div', 'sx-bub');
      var hd = h('div', 'sx-bub-hd'); hd.appendChild(h('b', null, who));
      var meta = k === 'cos' ? str(it.desc) : [roleOf(who), Object.prototype.hasOwnProperty.call(VIA, it.via) ? VIA[it.via] : it.via, it.where].filter(Boolean).join(' · ');
      if (meta) hd.appendChild(h('span', null, meta));
      b.appendChild(hd);
      var url = clipUrl(it.voice);
      if (url || it.len) {
        var vn = h('button', 'sx-vn-b'); vn.type = 'button'; vn.setAttribute('aria-label', 'Play ' + who + '’s voice note');
        vn.appendChild(h('span', 'vn-play'));
        var wv = bars(30, 'vn-bars'); var pg = h('i', 'vn-prog'); wv.appendChild(pg); vn.appendChild(wv);
        vn.appendChild(h('span', 'vn-len', str(it.len, '0:0' + Math.min(9, 2 + Math.round(words(it.text) / 3)))));
        vn.addEventListener('click', function (e) { e.stopPropagation(); unlock(); if (NOW && NOW.el === vn) skip(); else playVoice(url, vn); });
        b.appendChild(vn); r._voice = { url: url, btn: vn };
      }
      b.appendChild(h('p', url || it.len ? 'sx-tr' : 'sx-text', it.text));
      var md = mediaEl(it.media); if (md) b.appendChild(md);
      r.appendChild(b);
    } else if (k === 'task') {
      r.appendChild(h('span', 'sx-chk'));
      var t = h('div', 'sx-task-b');
      t.appendChild(h('span', 'sx-kind', 'Task' + (it.owner ? ' · ' + it.owner : '')));
      t.appendChild(h('p', null, it.text)); t.appendChild(h('span', 'sx-task-done', it.done || 'Done'));
      r.appendChild(t);
    } else if (k === 'decision') {
      var w2 = first(it.who) || 'Someone', d = h('div', 'sx-dec');
      var dh = h('div', 'sx-dec-hd'); dh.appendChild(faceEl(it.who, 'is-xs')); dh.appendChild(h('span', 'sx-kind', 'Decision for ' + w2 + ' · you decide')); d.appendChild(dh);
      d.appendChild(h('p', null, it.text));
      var ops = h('div', 'sx-opts'); r._opts = [];
      arr(it.options).forEach(function (o, i) {
        var b2 = h('button', 'sx-opt'); b2.type = 'button'; b2.disabled = true; b2.appendChild(h('span', null, o.label));
        if (o.ai) b2.appendChild(h('em', 'sx-pick', 'AI pick'));
        ops.appendChild(b2); r._opts.push(b2);
      });
      d.appendChild(ops);
      r._by = h('span', 'sx-dec-by', ''); d.appendChild(r._by);
      r.appendChild(d);
    } else if (k === 'record') {
      var rc = h('div', 'sx-rec'); rc.appendChild(h('span', 'sx-kind', 'Record' + (it.area ? ' · ' + it.area : '')));
      rc.appendChild(h('b', null, it.title));
      var dl = h('dl'); arr(it.rows).forEach(function (x) { dl.appendChild(h('dt', null, x[0])); dl.appendChild(h('dd', null, x[1])); }); rc.appendChild(dl);
      r.appendChild(rc);
    } else if (k === 'typing') {
      r.appendChild(faceEl(it.agent));
      var ty = h('div', 'sx-typing'); ty.appendChild(h('span', null, str(it.agent) + ' is working')); ty.appendChild(h('i', 'sx-dots')); r.appendChild(ty);
    }
    return r;
  }
  function scrollTo(r, instant) {
    var t = ui.thread, y = t.scrollHeight - t.clientHeight;
    if (r) y = Math.min(y, r.offsetTop - 12);
    if (instant || REDUCED) t.scrollTop = y; else t.scrollTo({ top: y, behavior: 'smooth' });
  }
  function divider(stop) { var d = h('div', 'sx-div'); d.appendChild(h('span', null, [stop.label, dayOf(stopIndex(stop)) ? 'Day ' + dayOf(stopIndex(stop)) : ''].filter(Boolean).join(' · '))); return d; }
  function stopIndex(stop) { return stops.indexOf(stop); }

  /* ---------- choices, days, OS ---------- */
  function key(stop, k) { return stop.id + ':' + k; }
  function delayBefore(i) { var d = 0; for (var j = 0; j < i; j++) d += DELAY[stops[j].id] || 0; return d; }
  function dayOf(i) { var s = stops[i]; return s && s.day != null ? s.day + delayBefore(i) : null; }
  function setOS(o, flash) {
    Object.keys(o || {}).forEach(function (k) {
      OS[k] = o[k]; var dd = ui['os_' + k]; if (!dd) return;
      dd.textContent = o[k]; dd.classList.add('is-set');
      if (flash) { dd.classList.remove('is-flash'); void dd.offsetWidth; dd.classList.add('is-flash'); }
    });
  }
  function resetOS() { OS = {}; each(ui.os.querySelectorAll('dd'), function (dd) { dd.textContent = '—'; dd.classList.remove('is-set', 'is-flash'); }); }
  /* the items of a stop in the order they happen, with the viewer's choices and their consequences spliced in */
  function itemsOf(stop) {
    var out = [];
    arr(stop.thread).forEach(function (it, k) {
      out.push({ it: it, k: k });
      if (it.k === 'decision' && CH[key(stop, k)] != null) { var o = it.options[CH[key(stop, k)]]; arr(o && o.then).forEach(function (x, n) { out.push({ it: x, k: k + '.' + n }); }); }
    });
    return out;
  }
  function aiIndex(it) { var i = 0; arr(it.options).forEach(function (o, j) { if (o.ai) i = j; }); return i; }

  /* ---------- the side: now card, checklist, tiles, strip ---------- */
  function nowCard(i) {
    var s = stops[i], m = modOf(s.module), d = dayOf(i);
    ui.nowDay.textContent = 'Now' + (d != null ? ' · Day ' + d : '');
    ui.nowN.textContent = 'Stage ' + (i + 1) + ' of ' + stops.length;
    ui.nowImg.innerHTML = '';
    if (i === 0) ui.nowImg.appendChild(faceEl(owners(m)[0] || (cfg.brand || {}).founder, 'is-big'));
    else { var im = h('img'); im.alt = ''; im.src = asset((cfg.story.product || {}).img || 'hero'); ui.nowImg.appendChild(im); }
    ui.nowLabel.textContent = s.label + ' · ' + m.name; ui.nowLine.textContent = s.title;
    ui.nowPeople.innerHTML = '';
    owners(m).forEach(function (p) { var e = h('span', 'sx-np'); e.appendChild(faceEl(p, 'is-sm')); var tx = h('span'); tx.appendChild(h('b', null, first(p) === 'GG' ? 'GG' : first(p))); tx.appendChild(h('span', null, roleOf(p))); e.appendChild(tx); ui.nowPeople.appendChild(e); });
    var ag = h('span', 'sx-np is-agent'); ui.nowAgent = ag; ag.appendChild(faceEl(m.agent || 'Chief of staff', 'is-sm')); var at = h('span'); at.appendChild(h('b', null, str(m.agent, 'Chief of staff'))); ag._st = h('span', null, 'ready'); at.appendChild(ag._st); ag.appendChild(at);
    ui.nowPeople.appendChild(ag);
  }
  function agentState(text, on) { if (ui.nowAgent) { ui.nowAgent._st.textContent = text; ui.nowAgent.classList.toggle('is-working', !!on); } }
  function setState(st, who) {
    state = st;
    var s = stops[si], nx = stops[si + 1];
    var label = st === 'decide' ? 'Take the AI pick' : st === 'done' ? (nx ? 'Next: ' + nx.label + ' in ' + modOf(nx.module).name : 'See the team') : 'Next';
    ui.nowBtn.textContent = label; ui.next.textContent = st === 'done' && nx ? 'Next stage' : label === 'See the team' ? 'See the team' : st === 'decide' ? 'AI pick' : 'Next';
    ui.now.classList.toggle('is-ready', st === 'done');
    ui.now.classList.toggle('is-decide', st === 'decide');
    ui.prev.disabled = si <= 0;
    ui.stage.classList.toggle('is-decide', st === 'decide');
  }
  function setAuto(on) {
    AUTO = on; ui.play.textContent = on ? 'Pause' : 'Play demo'; ui.play.classList.toggle('is-on', on);
    if (on) { if (state === 'done') next(); else if (state === 'decide' && ui.pick) setTimeout(function () { if (AUTO && state === 'decide' && ui.pick) ui.pick(null); }, 1600); }
  }
  function checklist(stop) {
    ui.check.innerHTML = ''; ui.checkH.textContent = stop.label + ': the checklist';
    arr(stop.thread).forEach(function (it, k) {
      if (it.k !== 'task' && it.k !== 'decision') return;
      ui.check.appendChild(checkLine(it, stop, k));
    });
  }
  function checkLine(it, stop, k) {
    var li = h('li', 'sx-ck'); li.dataset.k = k;
    li.appendChild(h('span', 'sx-ck-box'));
    li.appendChild(h('span', 'sx-ck-t', it.k === 'task' ? it.text : str(it.tray, it.text)));
    var own = it.k === 'decision' ? it.who : it.owner || 'Chief of staff';
    var o = h('span', 'sx-ck-o'); o.appendChild(faceEl(own, 'is-xs')); o.appendChild(h('span', null, first(own) === 'GG' ? 'GG' : isAgent(own) ? own : first(own))); li.appendChild(o);
    return li;
  }
  function ck(k) { return ui.check.querySelector('.sx-ck[data-k="' + k + '"]'); }
  function ckState(k, st, text) { var li = ck(k); if (!li) return; li.className = 'sx-ck is-' + st; if (text) li.querySelector('.sx-ck-t').textContent = text; }
  function tilePreview(mid, it) {
    var t = tiles[mid]; if (!t || !it || it.k === 'typing') return;
    var who = it.k === 'cos' ? str(it.agent, 'Chief of staff') : it.k === 'task' ? str(it.owner, 'Chief of staff') : it.who;
    var txt = it.k === 'task' ? 'Task: ' + it.text : it.k === 'decision' ? 'Decision: ' + str(it.tray, it.text) : it.k === 'record' ? it.title : it.text;
    t._pvFace.innerHTML = ''; if (who) t._pvFace.appendChild(faceEl(who, 'is-xs'));
    t._pv.textContent = (who ? first(who) + ': ' : '') + txt;
  }
  function tilesFor(i) {
    var active = stops[i].module;
    mods.forEach(function (m) {
      var t = tiles[m.id], mine = [], reached = false, later = false, last = null;
      stops.forEach(function (s, j) { if (s.module !== m.id) return; mine.push(j); if (j < i) { reached = true; var its = itemsOf(s); if (its.length) last = its[its.length - 1].it; } if (j > i) later = true; });
      t.classList.toggle('is-active', m.id === active);
      t.classList.toggle('is-done', reached && m.id !== active);
      t.classList.toggle('is-idle', !reached && m.id !== active);
      t.disabled = !mine.some(function (j) { return j <= maxSeen; });
      t._status.textContent = m.id === active ? 'Open now' : reached ? (later ? 'Back later' : '✓ Done') : 'Next';
      t._agent.textContent = str(m.agent);
      t._pvFace.innerHTML = '';
      if (last) tilePreview(m.id, last); else t._pv.textContent = m.next || m.about || '';
    });
  }
  function strip(i) {
    each(ui.strip.children, function (b, j) {
      b.classList.toggle('is-on', j === i); b.classList.toggle('is-past', j < i); b.disabled = j > maxSeen;
      var d = dayOf(j); b._sub.textContent = modOf(stops[j].module).name + (d != null ? ' · Day ' + d : '');
      b.querySelector('.sx-st-n').textContent = j < i ? '✓' : String(j + 1);
    });
    var on = ui.strip.children[i]; if (on && ui.strip.scrollWidth > ui.strip.clientWidth) ui.strip.scrollTo({ left: on.offsetLeft - 16, behavior: REDUCED ? 'auto' : 'smooth' });
  }

  /* ---------- a stage ---------- */
  function renderDone(stop, its) {
    its.forEach(function (x) {
      var it = x.it, r = row(it); r.classList.add('is-in'); ui.thread.appendChild(r);
      if (it.k === 'task') r.classList.add('is-done');
      if (it.k === 'decision') { var c = CH[key(stop, x.k)]; if (c == null) c = CH[key(stop, x.k)] = aiIndex(it); answer(r, it, c); }
      setOS(it.os);
    });
  }
  function answer(r, it, c) {
    var o = it.options[c] || {};
    r._opts.forEach(function (b, j) { b.disabled = true; b.classList.toggle('is-chosen', j === c); b.classList.toggle('is-not', j !== c); });
    var lb = String(o.label || '').replace(/^["“]|["”]$/g, '');
    r._by.textContent = '✓ ' + first(it.who) + ' chose “' + lb + '”' + (o.ai ? '' : ', not the AI pick');
    r.classList.add('is-answered');
    return o;
  }
  function open(i, dir) {
    i = Math.max(0, Math.min(stops.length - 1, i));
    var t = ++tok; if (W) { clearTimeout(W.timer); W = null; } stopVoice(); ui.pick = null;
    si = i; maxSeen = Math.max(maxSeen, i);
    var stop = stops[i];
    preload(i).then(function () { preload(i + 1); preload(i + 2); });
    /* everything before this stage is settled: OS values, days, choices (the AI pick where the viewer never chose) */
    resetOS();
    for (var j = 0; j < i; j++) {
      var s = stops[j];
      itemsOf(s).forEach(function (x) {
        if (x.it.k === 'decision' && CH[key(s, x.k)] == null) { CH[key(s, x.k)] = aiIndex(x.it); var o = x.it.options[CH[key(s, x.k)]]; DELAY[s.id] = (DELAY[s.id] || 0) + (o.delay || 0); }
      });
      itemsOf(s).forEach(function (x) { setOS(x.it.os); if (x.it.k === 'decision') setOS(x.it.options[CH[key(s, x.k)]].os); });
      if (s.launch || s.id === 'listing') setOS({ Launch: 'Day ' + dayOf(j) });
    }
    /* a stage replayed from the start forgets its own choices */
    Object.keys(CH).forEach(function (k2) { if (k2.indexOf(stop.id + ':') === 0) delete CH[k2]; }); DELAY[stop.id] = 0;
    strip(i); tilesFor(i); nowCard(i); checklist(stop); setState('run');
    var m = modOf(stop.module);
    ui.chan.textContent = m.name; ui.purpose.textContent = m.about || '';
    ui.who.innerHTML = ''; var pp = h('span', 'sx-people'); owners(m).forEach(function (p) { pp.appendChild(faceEl(p, 'is-sm')); }); ui.who.appendChild(pp);
    ui.who.appendChild(h('span', 'sx-agent-chip', str(m.agent)));
    /* the module's thread so far: earlier stages in this module, settled */
    ui.thread.innerHTML = '';
    for (var k = 0; k < i; k++) if (stops[k].module === stop.module) { ui.thread.appendChild(divider(stops[k])).classList.add('is-in'); renderDone(stops[k], itemsOf(stops[k])); }
    scrollTo(null, true);
    setScene(stop, dir || 1); caption(stop); sfx('stage');
    if (stop.launch || stop.id === 'listing') setOS({ Launch: 'Day ' + dayOf(i) }, true);
    (LOADED[i] || Promise.resolve()).then(function () { return wait(1000, t); }).then(function () {
      var d = divider(stop); ui.thread.appendChild(d); raf2(function () { d.classList.add('is-in'); scrollTo(d); });
      return wait(350, t);
    }).then(function () { return runBeats(stop, t); }).then(function () {
      setState('done'); agentState('done', false);
      each(ui.set.querySelectorAll('.sx-ob.is-wait'), function (e) { if (!e.dataset.id || !/^(glass|var)$/.test(e.dataset.id)) {} });
      if (AUTO) return wait(2400, t).then(function () { next(); });
    }).catch(function () {});
  }
  function runBeats(stop, t) {
    var k = 0;
    return new Promise(function (resolve, reject) {
      (function step() {
        if (t !== tok) return reject('stale');
        var its = itemsOf(stop); if (k >= its.length) return resolve();
        var x = its[k++];
        beat(stop, x.it, x.k, t).then(step, reject);
      })();
    });
  }
  function beat(stop, it, k, t) {
    var mid = stop.module;
    function add(r) { ui.thread.appendChild(r); raf2(function () { r.classList.add('is-in'); scrollTo(r); }); }
    function after() { if (it.land) land(it.land); setOS(it.os, true); if (it.line) listingLine(it.line); if (it.land) return wait(900, t); return Promise.resolve(); }
    var read = Math.min(4400, 1200 + (words(it.text) + (it.media ? 6 : 0) + (it.rows ? 8 : 0)) * 130);
    if (it.k === 'msg' || it.k === 'record') {
      var r = row(it); add(r); sfx('msg'); tilePreview(mid, it);
      var go = r._voice && SOUND ? new Promise(function (res, rej) {
        var ok = playVoice(r._voice.url, r._voice.btn, function () { if (W) W.done(); else res(); });
        if (!ok) return wait(read, t).then(res, rej);
        wait(30000, t).then(res, rej);      /* resolved early by the clip ending or by Next */
      }) : wait(read, t);
      return go.then(function () { return wait(350, t); }).then(after);
    }
    if (it.k === 'cos') {
      var ag = str(it.agent, 'Chief of staff'), ty = row({ k: 'typing', agent: ag }); add(ty); sfx('typing'); agentState('working…', true);
      return wait(1100, t).then(function () {
        ty.parentNode && ty.parentNode.removeChild(ty);
        var r2 = row(it); add(r2); sfx('msg'); tilePreview(mid, it); agentState('ready', false);
        return wait(read, t);
      }).then(after);
    }
    if (it.k === 'task') {
      var r3 = row(it); add(r3); sfx('task'); tilePreview(mid, it);
      var line = ck(k); if (!line) { ui.check.appendChild(checkLine(it, stop, k)); }
      ckState(k, 'working'); if (isAgent(it.owner)) agentState('working…', true);
      return wait(Math.max(1500, read * .7), t).then(function () {
        r3.classList.add('is-done'); ckState(k, 'done'); agentState('ready', false); sfx('done');
        return wait(500, t);
      }).then(after);
    }
    if (it.k === 'decision') {
      var r4 = row(it); add(r4); sfx('ask'); tilePreview(mid, it);
      ckState(k, 'waiting'); setState('decide');
      return new Promise(function (res, rej) {
        function pick(c) {
          if (t !== tok || !ui.pick) return; ui.pick = null;
          if (c == null) c = aiIndex(it);
          CH[key(stop, k)] = c;
          var o = answer(r4, it, c); sfx('decision');
          DELAY[stop.id] = (DELAY[stop.id] || 0) + (o.delay || 0);
          ckState(k, 'done', str(it.tray, it.text) + ': ' + o.label);
          if (o.land) land(o.land, false, o.note);
          if (o.label && /^"|^“/.test(o.label)) listingLine(o.label.replace(/^["“]|["”]$/g, ''));
          setOS(o.os, true); strip(si); nowCard(si);
          setState('run');
          wait(o.land ? 1100 : 700, t).then(res, rej);
        }
        ui.pick = pick;
        r4._opts.forEach(function (b, j) { b.disabled = false; b.addEventListener('click', function () { unlock(); pick(j); }); });
        if (AUTO) setTimeout(function () { if (AUTO && ui.pick === pick) pick(null); }, 2600);
      });
    }
    return Promise.resolve();
  }
  /* Next: finish the beat, take the AI pick, or open the next stage */
  function next() {
    if (state === 'decide' && ui.pick) return ui.pick(null);
    if (state === 'run') return skip();
    if (state === 'done') {
      if (si < stops.length - 1) return open(si + 1, 1);
      setAuto(false);
      var e = document.getElementById('end'); if (e) e.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
      setTimeout(function () { each(document.querySelectorAll('#end .fin-team > li'), function (li, n) { setTimeout(function () { li.classList.add('is-up'); }, 200 + n * 170); }); }, 500);
    }
  }
  function onKey(e) {
    if (e.target && /input|textarea|select|button/i.test(e.target.tagName) && e.key === ' ') return;
    if (ui.gate) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ui.gate._go(); } return; }
    if (scrollY > innerHeight * .5) return;
    if (e.key === 'ArrowRight' || e.key === ' ' || (e.key === 'Enter' && !/button/i.test((e.target || {}).tagName || ''))) { e.preventDefault(); unlock(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); if (si > 0) open(si - 1, -1); }
  }

  /* ---------- the Enter gate (deep links; the parcel tap is the gate otherwise) ---------- */
  function gate(start) {
    var g = h('div', 'sx-gate'); ui.gate = g;
    var c = h('div', 'sx-gate-in');
    c.appendChild(h('h1', null, str(cfg.story.title)));
    if (cfg.story.line) c.appendChild(h('p', null, cfg.story.line));
    var tm = h('div', 'sx-gate-team'); arr(cfg.team).forEach(function (m) { tm.appendChild(faceEl(m.name, 'is-sm')); }); c.appendChild(tm);
    var b = h('button', 'sx-gate-btn', MUTED ? 'Enter' : 'Enter, with sound'); b.type = 'button'; c.appendChild(b);
    g.appendChild(c); ui.stage.appendChild(g);
    g._go = function () { unlock(); g.classList.add('is-out'); ui.gate = null; setTimeout(function () { if (g.parentNode) g.parentNode.removeChild(g); }, 500); start(); };
    b.addEventListener('click', g._go);
    setTimeout(function () { b.focus({ preventScroll: true }); }, 50);
  }

  window.cosStory = function (raw, opts) {
    cfg = raw || {};
    if (!cfg.story || !arr(cfg.story.chapters).length) return false;
    document.title = str((cfg.page || {}).title, 'Chief of Staff: ' + str((cfg.brand || {}).name));
    arr(cfg.story.chapters).forEach(function (c) { arr(c.stops).forEach(function (st, n) { var s = typeof st === 'string' ? stageStop(st, n) : st; if (s) stops.push(s); }); });
    stops.forEach(function (s, i) { if (s.day == null) s.day = null; });
    mods = arr(cfg.story.modules).length ? cfg.story.modules : DEFAULT_MODS.filter(function (m) { return stops.some(function (s) { return s.module === m.id; }); });
    build();
    addEventListener('keydown', onKey);
    preload(0); preload(1);
    var s0 = /[?&]step=(\d+)/.exec(location.search), first0 = s0 ? Math.max(0, Math.min(stops.length - 1, +s0[1] - 1)) : 0;
    maxSeen = first0;
    setAuto(AUTO);
    function start() { open(first0, 1); }
    if (opts && opts.from === 'parcel') { if (!MUTED) unlock(); start(); }
    else if (AUTO && MUTED) start();
    else gate(start);
    ui.stage.classList.add('is-arrive'); raf2(function () { ui.stage.classList.remove('is-arrive'); });
    window.__story = { open: open, next: next, stops: stops, get si() { return si; }, get state() { return state; }, choose: function (c) { if (ui.pick) ui.pick(c); } };
    return true;
  };
})();
