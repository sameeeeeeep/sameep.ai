/* story.js (v5): the product's journey through the Chief of Staff, idea to doorstep.
   Used when the brand config has a `story` block; scroll.js plays the parcel opening and hands over
   (window.cosStory(cfg, {from: 'parcel', keep, retire})); a deep link (?step=N) opens on an Enter gate instead.

   Screen: header (brand, team, Prev / Play demo / Next, sound) · stage strip with days · four columns:
     sidebar (modules: owners, agent status, latest preview)
     Chat (the module thread, with a Sources row that lights up the channel each input comes from)
     Tasks (the Now card, tasks and decisions, agents at work: what each is doing, steps done, last output, reports to)
     Canvas (the stage of objects and infographics, the caption under it, the product's stats strip)
   Phones: a module strip and Chat / Tasks / Canvas tabs (Canvas comes forward when an object lands).

   Beats run in strict order. An input arrives with its channel (WhatsApp, Gmail, Meet, Instagram, Shopify, ...) and
   shows its native look on the canvas for a moment; agents show "working" then their result; tasks tick; the chief
   announces and @mentions people and agents. Decisions wait for the viewer: visual option cards (image or swatch,
   cost, days, a comparison bar, the AI pick and its reason); each option is real and has its own objects, numbers,
   delay and consequence beats before the story rejoins. When a module's last beat lands the story moves on by itself
   ("Moving to #logistics…"); Next skips ahead; Play demo also takes the AI pick at decisions.

   config.story = { title, line, product{name,img}, os_keys, modules[], chapters[{ title, stops[] }] }
   stop  = { id, module, label, day, when, title, scene{objs[]}, thread[item], agents{name: {reports}} }
   item  = { k: msg|cos|task|decision|record, who, agent, text, voice, len, via, where, desc, media, done, owner, land,
             os{}, line, options[{ label, ai, reason, img, swatch, cost, days, bar, land, os{}, delay, note, then[item] }] }
   Sound: on after the first tap (parcel or Enter); never with ?mute. ?autoplay = Play demo; ?step=N opens stage N. */
(function () {
  'use strict';
  var Q = new URLSearchParams(location.search);
  var MUTED = Q.has('mute'), REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PHONE = function () { return innerWidth <= 860; };
  var cfg, stops = [], mods = [], si = -1, maxSeen = 0, tok = 0, AUTO = Q.has('autoplay'), ui = {}, tiles = {};
  var CH = {}, OS = {}, DELAY = {}, state = 'idle', AG = {};

  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function str(v, d) { return (typeof v === 'string' && v.trim()) ? v.trim() : (d || ''); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function words(t) { return String(t || '').split(/\s+/).filter(Boolean).length; }
  function first(w) { return str(w).split(/\s+/)[0]; }
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }
  function raf2(fn) { requestAnimationFrame(function () { requestAnimationFrame(fn); }); }
  function fmt(n) { return Math.round(n).toLocaleString('en-IN'); }

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
    tick: function () { tone(2200, 0, .02, .012, 'triangle'); },
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

  /* ---------- channels: where each input comes from (a neutral mark: a glyph in the channel's colour) ---------- */
  var SRC = {
    dm: ['Instagram', 'IG', '#c13584'], whatsapp: ['WhatsApp', 'W', '#1f9d55'], email: ['Gmail', 'M', '#c5221f'],
    meeting: ['Meet', 'Me', '#0f7b6c'], call: ['Call', 'C', '#5b616e'], shopify: ['Shopify', 'S', '#5e8e3e'],
    zepto: ['Zepto', 'Z', '#5a2a82'], blinkit: ['Blinkit', 'B', '#b78a00'], nykaa: ['Nykaa', 'N', '#d6116b'],
    amazon: ['Amazon', 'A', '#232f3e'], myntra: ['Myntra', 'My', '#a8325e'], purplle: ['Purplle', 'P', '#5f3a8f'], delhivery: ['Delhivery', 'D', '#b3261e'], ads: ['Meta Ads', 'Ad', '#2f5bd3'], app: ['Chief of Staff', 'CS', '#15171c']
  };
  var SRC_ROW = ['dm', 'meeting', 'whatsapp', 'email', 'shopify', 'ads', 'delhivery'];
  function srcMark(v, cls) {
    var s = SRC[v] || SRC.app, m = h('span', 'sx-src' + (cls ? ' ' + cls : ''));
    var g = h('i', null, s[1]); g.style.background = s[2]; m.appendChild(g); m.appendChild(h('span', null, s[0]));
    return m;
  }
  function lightSource(v) { if (!ui.sources) return; each(ui.sources.children, function (c) { c.classList.toggle('is-on', c.dataset.v === v); }); }

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
  function shortName(w) { return /^GG/.test(str(w)) ? 'GG' : isAgent(w) ? str(w) : first(w); }
  /* text with @mentions picked out */
  function textEl(tag, cls, text) {
    var el = h(tag, cls), re = /@(?:[A-Z][a-z]+ agent|Chief of staff|[A-Z][\w]+)/g, s = String(text || ''), last = 0, m;
    while ((m = re.exec(s))) { if (m.index > last) el.appendChild(document.createTextNode(s.slice(last, m.index))); el.appendChild(h('b', 'sx-at', m[0])); last = m.index + m[0].length; }
    if (last < s.length) el.appendChild(document.createTextNode(s.slice(last)));
    return el;
  }

  /* ---------- public brands: stops from the older stage schema ---------- */
  var STAGE_MOD = { voice: 'ideas', standup: 'ideas', hire: 'npd', samples: 'npd', vendor: 'npd', packaging: 'npd', po: 'npd',
    shoot: 'marketing', listing: 'listing', ad: 'marketing', order: 'logistics', packed: 'warehouse', support: 'crm', courier: 'logistics', delivered: 'crm' };
  var STAGE_AGENT = { voice: 'Research agent', standup: 'Chief of staff', samples: 'Research agent', vendor: 'Vendor agent', packaging: 'Design agent',
    po: 'Vendor agent', shoot: 'Content agent', listing: 'Website agent', ad: 'Ads agent', order: 'Ops agent', packed: 'Ops agent', courier: 'Ops agent', support: 'Support agent', delivered: 'Chief of staff' };
  var STAGE_LABEL = { voice: 'Idea', standup: 'Plan', samples: 'Samples', vendor: 'Vendor', packaging: 'Packaging', po: 'PO', shoot: 'Shoot', listing: 'Listing', ad: 'Ads', order: 'First order', delivered: 'Loop closed' };
  /* each module's identity: a small icon, one muted tint, and the boards it works on */
  var LOOK = {
    ideas: { tint: '#9a6b1f', title: 'Ideas', icon: 'M8 1.5a4.5 4.5 0 0 0-2.6 8.2V12h5.2V9.7A4.5 4.5 0 0 0 8 1.5zM6 13.5h4M6.6 15h2.8', boards: ['Inbox', 'Sparks', 'Idea score'] },
    npd: { tint: '#6c4f93', title: 'Product development', icon: 'M2.5 3.5h11v9h-11zM2.5 6.5h11M6 6.5v6', boards: ['Concept board', 'Mockups', 'Spec sheet', 'Vendors', 'Shades', 'Label'] },
    logistics: { tint: '#2d6a86', title: 'Logistics', icon: 'M1.5 4.5h8v6h-8zM9.5 7h3l2 2v1.5h-5M4 12.5a1.2 1.2 0 1 0 .01 0M11.5 12.5a1.2 1.2 0 1 0 .01 0', boards: ['Route', 'Shipments', 'Carriers'] },
    warehouse: { tint: '#66622f', title: 'Warehouse', icon: 'M1.5 6.5 8 2.5l6.5 4v7h-13zM5 13.5v-4h6v4', boards: ['Dock schedule', 'Receiving', 'QC', 'Pick-pack'] },
    listing: { tint: '#2f7556', title: 'Listing', icon: 'M2.5 2.5h11v11h-11zM5 5.5h6M5 8h6M5 10.5h3.5', boards: ['Channels', 'Product page', 'Price parity'] },
    marketing: { tint: '#9c4466', title: 'Marketing', icon: 'M2.5 9.5V6.5l8-3.5v10l-8-3.5zM10.5 6v4M4.5 9.5l1 4h2l-.8-3.6', boards: ['Calendar', 'Shoot board', 'Creators', 'Ads'] },
    crm: { tint: '#3d58a8', title: 'Customers', icon: 'M8 8a2.8 2.8 0 1 0 0-5.6A2.8 2.8 0 0 0 8 8zM2.5 14c.8-2.8 3-4.2 5.5-4.2s4.7 1.4 5.5 4.2', boards: ['Funnel', 'Delivered', 'Care notes', 'Reviews'] }
  };
  function look(id) { var m = modOf(id), L = LOOK[id] || {}; return { tint: m.tint || L.tint || '#5b616e', title: m.title || L.title || m.name, icon: m.icon || L.icon || 'M3 3h10v10H3z', boards: m.boards || L.boards || [] }; }
  function iconEl(id, cls) { var sp = h('span', 'sx-mi' + (cls ? ' ' + cls : '')); sp.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="' + look(id).icon + '" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'; return sp; }
  var DEFAULT_MODS = [
    { id: 'ideas', name: '#ideas', about: 'Voice notes and DMs become ideas', agent: 'Research agent' },
    { id: 'npd', name: '#npd', about: 'Concepts, samples, vendors, packaging', agent: 'Vendor agent' },
    { id: 'logistics', name: '#logistics', about: 'Inbound and outbound shipments', agent: 'Ops agent' },
    { id: 'warehouse', name: '#warehouse', about: 'Receiving, QC, dispatch', agent: 'Ops agent' },
    { id: 'listing', name: '#listing', about: 'D2C and marketplaces', agent: 'Website agent' },
    { id: 'marketing', name: '#marketing', about: 'Shoots, creators, ads', agent: 'Ads agent' },
    { id: 'crm', name: '#crm', about: 'Delivered, check-ins, repeat', agent: 'Support agent' }];
  function stageStop(id) {
    var st = arr(cfg.stages).filter(function (s) { return s.id === id; })[0];
    if (!st) return null;
    var fl = arr(st.flow), A = cfg.audio || {}, th = [], ag = STAGE_AGENT[id] || 'Chief of staff';
    fl.forEach(function (b, i) {
      if ((b.t === 'raised' && b.who) || b.t === 'q') {
        var v = id === 'voice' && i === 0 ? 'voice-note' : A[id + '-' + (i + 1)] ? id + '-' + (i + 1) : b.t === 'q' && A[id + '-q'] ? id + '-q' : isAgency(b.who) && A[id + '-agency'] ? id + '-agency' : '';
        th.push({ k: 'msg', who: b.who, via: b.via || (isCustomer(b.who) ? 'whatsapp' : 'app'), where: b.where, text: id === 'voice' && i === 0 && cfg.voice ? cfg.voice.words : b.text, voice: v,
          len: id === 'voice' && i === 0 && cfg.voice ? cfg.voice.length : (b.media && b.media.len) || '' });
        if (b.t === 'q' && b.answer) th.push({ k: 'cos', agent: ag, text: b.answer });
      } else if (b.t === 'ask') {
        var ops = arr(b.options);
        th.push({ k: 'decision', who: b.who, text: b.text, options: ops.map(function (o, j) {
          return j === 0 ? { label: o, ai: true, reason: 'Keeps the date and the plan.' } : { label: o, then: [{ k: 'cos', agent: ag, text: 'Noted. Going with "' + ops[0] + '" after a second look: it keeps the date.' }] }; }) });
      } else if (b.t === 'assign' || b.t === 'done') th.push({ k: 'task', owner: ag, text: b.text, done: b.desc || 'Done' });
      else th.push({ k: 'cos', agent: ag, text: b.text, desc: b.desc || b.caught, media: b.media && b.media.type !== 'photo' ? b.media : null });
    });
    var obj = st.object === 'phone' ? 'hero' : st.object === 'wireframe' ? 'wireframe_ink' : st.object;
    var objs = id === 'voice' ? [{ id: 'vn', voice: { who: (cfg.voice || {}).who, len: (cfg.voice || {}).length, time: (cfg.voice || {}).time }, x: 50, y: 50, w: 64 }]
      : [{ id: 'main', src: obj, x: 50, y: 52, w: 64 }];
    return { id: id, module: STAGE_MOD[id] || 'ideas', label: STAGE_LABEL[id] || id, day: null, when: st.when, title: st.summary, scene: { objs: objs }, thread: th.slice(0, 6) };
  }

  /* ---------- the page ---------- */
  function svgIcon(d) { return '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="' + d + '" fill="none" stroke="currentColor" stroke-width="2"/></svg>'; }
  function build(keep) {
    document.documentElement.classList.add('is-story');
    var track = document.getElementById('track');
    if (!keep) track.innerHTML = '';
    track.className = 'sx-track'; track.style.height = '';
    var stage = h('div', 'sx-stage'); ui.stage = stage;
    if (keep) { stage.classList.add('is-under'); track.insertBefore(stage, track.firstChild); } else track.appendChild(stage);

    var top = h('header', 'sx-top');
    var br = h('div', 'sx-brand'); br.appendChild(h('span', 'sx-logo', str((cfg.brand || {}).name, 'C').replace(/[^a-z]/gi, '').charAt(0).toUpperCase()));
    var bt = h('span', 'sx-brand-t'); bt.appendChild(h('b', null, str((cfg.brand || {}).name))); bt.appendChild(h('span', null, 'Chief of Staff')); br.appendChild(bt);
    top.appendChild(br);
    var team = h('div', 'sx-team');
    var stack = h('span', 'sx-people'); arr(cfg.team).forEach(function (m) { stack.appendChild(faceEl(m.name, 'is-sm')); }); team.appendChild(stack);
    team.appendChild(h('span', 'sx-team-n', arr(cfg.team).length + ' people · ' + allAgents().length + ' agents'));
    top.appendChild(team);
    var ctl = h('div', 'sx-ctl');
    ui.prev = h('button', 'sx-btn sx-icon'); ui.prev.type = 'button'; ui.prev.setAttribute('aria-label', 'Previous stage'); ui.prev.innerHTML = svgIcon('M10.5 3 5.5 8l5 5');
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

    /* products: category chips and a card per product with where it is now; the story follows the selected one */
    var P = arr(cfg.story.products);
    if (P.length) {
      var pr = h('section', 'sx-prods'); pr.setAttribute('aria-label', 'Products');
      var cats = ['All']; P.forEach(function (p) { if (p.cat && cats.indexOf(p.cat) < 0) cats.push(p.cat); });
      var chips = h('div', 'sx-cats'); ui.cats = chips;
      cats.forEach(function (c) {
        var n = c === 'All' ? P.length : P.filter(function (p) { return p.cat === c; }).length;
        var b = h('button', 'sx-cat' + (c === 'All' ? ' is-on' : '')); b.type = 'button'; b.appendChild(h('span', null, c)); b.appendChild(h('em', null, String(n)));
        b.addEventListener('click', function () { each(chips.children, function (x) { x.classList.toggle('is-on', x === b); }); each(ui.prods.children, function (card) { card.hidden = !(c === 'All' || card.dataset.cat === c); }); });
        chips.appendChild(b);
      });
      pr.appendChild(chips);
      ui.prods = h('div', 'sx-pcards');
      P.forEach(function (p, i) {
        var c = h('button', 'sx-pc' + (p.follow ? ' is-on' : '')); c.type = 'button'; c.dataset.cat = p.cat || '';
        if (p.img) { var im = h('img'); im.alt = ''; im.src = asset(p.img); c.appendChild(im); } else { var sw = h('i', 'sx-pc-sw'); sw.style.background = p.color || '#d3d3cc'; c.appendChild(sw); }
        var tx = h('span', 'sx-pc-tx'); tx.appendChild(h('b', null, p.name)); c._st = h('span', null, p.status || ''); tx.appendChild(c._st);
        var bar = h('span', 'sx-pc-bar'); c._bar = h('i'); c._bar.style.transform = 'scaleX(' + (p.pct || 0) + ')'; bar.appendChild(c._bar); tx.appendChild(bar);
        c.appendChild(tx);
        if (p.follow) ui.follow = c;
        c.addEventListener('click', function (e) { e.stopPropagation(); productPop(p, c); });
        ui.prods.appendChild(c);
      });
      pr.appendChild(ui.prods);
      stage.appendChild(pr);
      document.addEventListener('click', function () { if (ui.ppop) { ui.ppop.remove(); ui.ppop = null; } });
    }
    ui.strip = h('nav', 'sx-strip'); ui.strip.setAttribute('aria-label', 'Stages');
    stops.forEach(function (s, i) {
      var b = h('button', 'sx-st'); b.type = 'button'; b.dataset.i = i;
      b.appendChild(h('span', 'sx-st-n', String(i + 1)));
      var tx = h('span', 'sx-st-tx'); tx.appendChild(h('b', null, s.label)); b._sub = h('span', null, modOf(s.module).name); tx.appendChild(b._sub); b.appendChild(tx);
      b.addEventListener('click', function () { if (i <= maxSeen && i !== si) { unlock(); open(i, i < si ? -1 : 1); } });
      ui.strip.appendChild(b);
    });
    stage.appendChild(ui.strip);

    /* phones: Chat / Tasks / Canvas tabs */
    ui.tabs = h('div', 'sx-tabs'); ui.tabs.setAttribute('role', 'tablist');
    ['canvas', 'chat', 'tasks'].forEach(function (k) {
      var b = h('button', 'sx-tab', k === 'chat' ? 'Chat' : k === 'tasks' ? 'Tasks' : 'Canvas'); b.type = 'button'; b.dataset.k = k; b.setAttribute('role', 'tab');
      b._dot = h('i'); b.appendChild(b._dot);
      b.addEventListener('click', function () { tab(k, true); }); ui.tabs.appendChild(b);
    });
    stage.appendChild(ui.tabs);

    var main = h('div', 'sx-main'); ui.main = main; stage.appendChild(main);

    /* sidebar: modules */
    ui.tiles = h('nav', 'sx-tiles'); ui.tiles.setAttribute('aria-label', 'Modules'); main.appendChild(ui.tiles);
    mods.forEach(function (m) {
      var t = h('button', 'sx-tile'); t.type = 'button'; t.dataset.mod = m.id; t.style.setProperty('--tint', look(m.id).tint);
      var hd = h('div', 'sx-tile-hd'); var nm0 = h('span', 'sx-tile-n'); nm0.appendChild(iconEl(m.id)); nm0.appendChild(h('b', null, m.name)); hd.appendChild(nm0); t._status = h('span', 'sx-tile-st', ''); hd.appendChild(t._status); t.appendChild(hd);
      var pv = h('div', 'sx-tile-pv'); t._pvFace = h('span', 'sx-tile-face'); pv.appendChild(t._pvFace); t._pv = h('span', 'sx-tile-tx', m.about || ''); pv.appendChild(t._pv); t.appendChild(pv);
      var ft = h('div', 'sx-tile-ft'); t._people = h('span', 'sx-people'); ft.appendChild(t._people); t._agent = h('span', 'sx-agent', m.agent || ''); ft.appendChild(t._agent); t.appendChild(ft);
      owners(m).forEach(function (p) { t._people.appendChild(faceEl(p, 'is-xs')); });
      t._people.appendChild(h('span', 'sx-tile-own', owners(m).map(shortName).join(', ')));
      t.addEventListener('click', function () {
        var last = -1; stops.forEach(function (s, i) { if (s.module === m.id && i <= maxSeen) last = i; });
        if (last >= 0 && last !== si) { unlock(); open(last, last < si ? -1 : 1); }
      });
      tiles[m.id] = t; ui.tiles.appendChild(t);
    });

    /* pane 1: chat */
    var chat = h('section', 'sx-pane sx-chatp'); chat.dataset.k = 'chat'; main.appendChild(chat);
    var ch = h('div', 'sx-pane-hd');
    ui.chanIcon = h('span', 'sx-chan-i'); ch.appendChild(ui.chanIcon);
    var cn = h('div', 'sx-chan'); ui.chan = h('b', null, ''); cn.appendChild(ui.chan); ui.purpose = h('span', null, ''); cn.appendChild(ui.purpose); ch.appendChild(cn);
    ui.who = h('div', 'sx-card-who'); ch.appendChild(ui.who);
    chat.appendChild(ch);
    ui.sources = h('div', 'sx-sources'); ui.sources.setAttribute('aria-label', 'Sources');
    SRC_ROW.forEach(function (v) { var m = srcMark(v, 'is-row'); m.dataset.v = v; ui.sources.appendChild(m); });
    chat.appendChild(ui.sources);
    ui.thread = h('div', 'sx-thread'); ui.thread.setAttribute('role', 'log'); ui.thread.setAttribute('aria-live', 'polite'); chat.appendChild(ui.thread);

    /* pane 2: tasks (now card, tasks and decisions, agents at work) */
    var tasks = h('section', 'sx-pane sx-tasksp'); tasks.dataset.k = 'tasks'; main.appendChild(tasks);
    var now = h('section', 'sx-now'); ui.now = now;
    var nh = h('div', 'sx-now-hd'); ui.nowDay = h('span', null, ''); ui.nowN = h('span', null, ''); nh.appendChild(ui.nowDay); nh.appendChild(ui.nowN); now.appendChild(nh);
    var nb = h('div', 'sx-now-bd'); ui.nowImg = h('span', 'sx-now-img'); nb.appendChild(ui.nowImg);
    var nt = h('div'); ui.nowLabel = h('b', null, ''); ui.nowLine = h('span', null, ''); nt.appendChild(ui.nowLabel); nt.appendChild(ui.nowLine); nb.appendChild(nt); now.appendChild(nb);
    ui.nowBtn = h('button', 'sx-now-btn'); ui.nowBtn.type = 'button'; ui.nowBtn.addEventListener('click', function () { unlock(); next(); }); now.appendChild(ui.nowBtn);
    tasks.appendChild(now);
    var tk = h('section', 'sx-box sx-check'); ui.checkH = h('b', 'sx-side-h', 'Tasks'); tk.appendChild(ui.checkH);
    ui.check = h('ul', 'sx-check-ul'); tk.appendChild(ui.check); tasks.appendChild(tk);

    /* pane 3: canvas */
    var canvas = h('section', 'sx-pane sx-canvasp'); canvas.dataset.k = 'canvas'; main.appendChild(canvas);
    ui.cvHd = h('div', 'sx-cv-hd'); canvas.appendChild(ui.cvHd);
    ui.scene = h('div', 'sx-scene'); canvas.appendChild(ui.scene);
    ui.handoff = h('div', 'sx-handoff'); ui.scene.appendChild(ui.handoff);
    ui.cap = h('div', 'sx-cap'); ui.cap.setAttribute('aria-live', 'polite'); canvas.appendChild(ui.cap);
    ui.stats = h('div', 'sx-stats'); ui.stats.setAttribute('aria-label', 'This product'); canvas.appendChild(ui.stats);
    arr(cfg.story.os_keys || ['Idea', 'Format', 'Vendor', 'Shade', 'Units', 'Launch', 'Channels', 'Orders']).forEach(function (k) {
      var c = h('div', 'sx-stat-c'); c.appendChild(h('span', null, k)); var v = h('b', null, '—'); c.appendChild(v); ui.stats.appendChild(c); ui['os_' + k] = v; v._c = c;
    });

    var endEl = document.getElementById('end');
    if (window.renderEnding && endEl) { endEl.innerHTML = ''; window.renderEnding(cfg, endEl); }
    tab('canvas');
  }
  /* a product's status, where things are moving for it */
  function productPop(p, card) {
    if (ui.ppop) { ui.ppop.remove(); ui.ppop = null; }
    var pop = h('div', 'sx-ppop'); pop.addEventListener('click', function (e) { e.stopPropagation(); });
    var hd = h('div', 'sx-ppop-hd'); hd.appendChild(h('b', null, p.name)); hd.appendChild(h('span', null, p.cat || '')); pop.appendChild(hd);
    if (p.follow && si >= 0) {
      var s = stops[si], m = modOf(s.module);
      pop.appendChild(h('p', null, 'Stage ' + (si + 1) + ' of ' + stops.length + ' · ' + s.label + ' in ' + m.name + (dayOf(si) != null ? ' · Day ' + dayOf(si) : '')));
      pop.appendChild(h('span', 'sx-ppop-n', s.title));
      var nx = stops[si + 1]; if (nx) pop.appendChild(h('span', 'sx-ppop-x', 'Next: ' + nx.label + ' in ' + modOf(nx.module).name));
      pop.appendChild(h('span', 'sx-ppop-f', 'The story on this page follows this product.'));
    } else {
      pop.appendChild(h('p', null, p.status || ''));
      if (p.now) pop.appendChild(h('span', 'sx-ppop-n', p.now));
      if (p.module) { var mm = h('div', 'sx-ppop-m'); mm.appendChild(iconEl(p.module)); mm.appendChild(h('span', null, modOf(p.module).name + (p.owner ? ' · ' + p.owner : ''))); mm.style.setProperty('--tint', look(p.module).tint); pop.appendChild(mm); }
      if (p.next) pop.appendChild(h('span', 'sx-ppop-x', 'Next: ' + p.next));
    }
    var r = card.getBoundingClientRect(), sr = ui.stage.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(sr.width - 300, r.left - sr.left)) + 'px'; pop.style.top = (r.bottom - sr.top + 6) + 'px';
    ui.stage.appendChild(pop); ui.ppop = pop;
  }
  function followStatus(i) {
    var c = ui.follow; if (!c) return;
    var s = stops[i]; c._st.textContent = s.label + ' · ' + modOf(s.module).name + (dayOf(i) != null ? ' · Day ' + dayOf(i) : '');
    c._bar.style.transform = 'scaleX(' + ((i + 1) / stops.length).toFixed(3) + ')';
  }
  function owners(m) { return (Array.isArray(m.owners) ? m.owners : m.owner ? [m.owner] : []).slice(0, 3); }
  function modOf(id) { return mods.filter(function (m) { return m.id === id; })[0] || { id: id, name: '#' + id }; }
  function allAgents() {
    var a = {}; stops.forEach(function (s) { (function walk(l) { arr(l).forEach(function (it) { var n = agentOfItem(it); if (n) a[n] = 1; arr(it.options).forEach(function (o) { walk(o.then); }); }); })(s.thread); });
    mods.forEach(function (m) { if (m.agent) a[m.agent] = 1; });
    return Object.keys(a);
  }
  function agentOfItem(it) { return it.k === 'cos' ? str(it.agent, 'Chief of staff') : it.k === 'task' && isAgent(it.owner) ? it.owner : ''; }

  /* phones: which pane is showing */
  function tab(k, byUser) {
    ui.main.dataset.tab = k;
    each(ui.tabs.children, function (b) { var on = b.dataset.k === k; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); if (on) b.classList.remove('has-new'); });
    if (byUser) ui.userTab = Date.now();
  }
  function nudgeTab(k) {
    if (!PHONE()) return;
    if (ui.userTab && Date.now() - ui.userTab < 4000) { var b = ui.tabs.querySelector('[data-k="' + k + '"]'); if (b && ui.main.dataset.tab !== k) b.classList.add('has-new'); return; }
    tab(k);
  }

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
      var u = clipUrl(it.voice); if (u) clip(u);
      arr(it.options).forEach(function (o) { if (o.img) img(asset(o.img)); walk(o.then); });
    }); })(s.thread);
    LOADED[i] = Promise.race([Promise.all(jobs), new Promise(function (r) { setTimeout(r, 3000); })]);
    return LOADED[i];
  }

  /* ---------- infographics (used in the thread and on the canvas) ---------- */
  function bars(n, cls) {
    var w = h('span', cls);
    for (var i = 0; i < n; i++) { var b = h('i'); b.style.height = (25 + Math.round(70 * Math.abs(Math.sin(i * 2.3 + 1) * Math.cos(i * .7)))) + '%'; w.appendChild(b); }
    return w;
  }
  function svgEl(tag, attrs) { var e = document.createElementNS('http://www.w3.org/2000/svg', tag); Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); }); return e; }
  function chart(m) {
    var el = h('div', 'sx-viz sx-v-' + m.type);
    if (m.type === 'chart' || m.type === 'bars') {
      var max = Math.max.apply(null, arr(m.values).map(Number)) || 1;
      arr(m.values).forEach(function (v, i) {
        var row = h('div', 'sx-bar' + (i === (m.hi || 0) ? ' is-hi' : ''));
        row.appendChild(h('span', 'sx-bar-l', str(arr(m.labels)[i])));
        var tr = h('span', 'sx-bar-t'); var f = h('i'); f.style.transform = 'scaleX(' + (Number(v) / max).toFixed(3) + ')'; tr.appendChild(f); row.appendChild(tr);
        row.appendChild(h('span', 'sx-bar-v', String(v)));
        el.appendChild(row);
      });
    } else if (m.type === 'stat') {
      arr(m.items).forEach(function (s) { var c = h('div', 'sx-big'); c.appendChild(h('b', null, s[0])); c.appendChild(h('span', null, s[1])); el.appendChild(c); });
    } else if (m.type === 'spark') {
      var vals = arr(m.values).map(Number), mx = Math.max.apply(null, vals), mn = Math.min.apply(null, vals), W2 = 200, H2 = 44;
      var pts = vals.map(function (v, i) { return (i * W2 / (vals.length - 1)).toFixed(1) + ',' + (H2 - 4 - (v - mn) / ((mx - mn) || 1) * (H2 - 10)).toFixed(1); }).join(' ');
      var sv = svgEl('svg', { viewBox: '0 0 ' + W2 + ' ' + H2, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
      sv.appendChild(svgEl('polyline', { points: pts, fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'vector-effect': 'non-scaling-stroke' }));
      el.appendChild(sv);
      var lb = h('div', 'sx-spark-l'); lb.appendChild(h('b', null, str(m.big, String(vals[vals.length - 1])))); lb.appendChild(h('span', null, m.label || '')); el.appendChild(lb);
    } else if (m.type === 'donut') {
      var total = arr(m.parts).reduce(function (a, p) { return a + Number(p[1]); }, 0) || 1, acc = 0, stops2 = [];
      arr(m.parts).forEach(function (p) { var a0 = acc / total * 360; acc += Number(p[1]); stops2.push(p[2] + ' ' + a0.toFixed(1) + 'deg ' + (acc / total * 360).toFixed(1) + 'deg'); });
      var d = h('div', 'sx-donut'); d.style.background = 'conic-gradient(' + stops2.join(',') + ')'; var hole = h('span', null, str(m.center)); d.appendChild(hole); el.appendChild(d);
      var lg = h('ul', 'sx-legend'); arr(m.parts).forEach(function (p) { var li = h('li'); var sw = h('i'); sw.style.background = p[2]; li.appendChild(sw); li.appendChild(h('span', null, p[0])); li.appendChild(h('b', null, String(p[1]) + (m.unit || ''))); lg.appendChild(li); }); el.appendChild(lg);
    } else if (m.type === 'funnel') {
      var top0 = Number((arr(m.steps)[0] || [0, 1])[1]) || 1;
      arr(m.steps).forEach(function (s) { var r = h('div', 'sx-fun'); var b = h('i'); b.style.transform = 'scaleX(' + (Number(s[1]) / top0).toFixed(3) + ')'; r.appendChild(b); r.appendChild(h('span', null, s[0])); r.appendChild(h('b', null, fmt(Number(s[1])))); el.appendChild(r); });
    } else if (m.type === 'channels') {
      arr(m.items).forEach(function (c) { var t = h('div', 'sx-chtile'); t.appendChild(srcMark(c[0])); t.appendChild(h('b', null, String(c[1]))); if (c[2]) t.appendChild(h('span', null, c[2])); el.appendChild(t); });
    } else if (m.type === 'swatch') {
      var sw2 = h('div', 'sx-sw'); arr(m.colors).forEach(function (c) { var i = h('i'); i.style.background = c; sw2.appendChild(i); }); el.appendChild(sw2);
    } else if (m.type === 'doc' || m.type === 'link') {
      el.appendChild(h('b', null, str(m.name || m.title)));
    } else return null;
    if (m.unit && m.type !== 'donut' || m.note) el.appendChild(h('span', 'sx-media-note', str(m.note, m.unit)));
    if (m.label && m.type === 'swatch') el.appendChild(h('span', 'sx-media-note', m.label));
    return el;
  }

  /* ---------- canvas objects ---------- */
  function objEl(o) {
    var el = h('div', 'sx-ob'); el.dataset.id = o.id || '';
    if (o.slot) { el.style.gridArea = o.slot; el.dataset.slot = o.slot; } else { el.style.left = (o.x != null ? o.x : 50) + '%'; el.style.top = (o.y != null ? o.y : 55) + '%'; }
    el.style.setProperty('--w', (o.w || 50) + '%'); el.style.setProperty('--r', (o.rot || 0) + 'deg'); el.style.zIndex = o.z || 1;
    var body, card = true;
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
      var lh = h('div', 'sx-listing-hd'); lh.appendChild(srcMark(L.via || 'shopify')); el._live = h('span', 'sx-live', str(L.status, 'Live')); lh.appendChild(el._live); body.appendChild(lh);
      el.classList.add(/^live/i.test(str(L.status, 'Live')) ? 'is-live' : /^paused/i.test(str(L.status)) ? 'is-paused' : 'is-draft');
      var im = h('img'); im.alt = ''; im.src = asset(L.src || (cfg.story.product || {}).img); body.appendChild(im);
      el._line = h('b', null, str(L.title, (cfg.story.product || {}).name)); body.appendChild(el._line);
      var pr = h('div', 'sx-listing-pr'); pr.appendChild(h('span', null, str(L.price, '₹999'))); if (L.note) pr.appendChild(h('span', 'sx-listing-n', L.note)); body.appendChild(pr);
    } else if (o.counter) {
      var C = o.counter; body = h('div', 'sx-counter');
      body.appendChild(h('span', 'sx-counter-k', str(C.label)));
      el._num = h('b', null, (C.prefix || '') + '0'); el._count = C; body.appendChild(el._num);
      if (C.sub) body.appendChild(h('span', 'sx-counter-s', C.sub));
    } else if (o.stat) {
      body = h('div', 'sx-statcard'); arr(o.stat).forEach(function (s) { var c = h('div'); c.appendChild(h('b', null, s[0])); c.appendChild(h('span', null, s[1])); body.appendChild(c); });
    } else if (o.chart) {
      body = h('div', 'sx-chartcard'); if (o.chart.title) body.appendChild(h('b', 'sx-chartcard-t', o.chart.title)); var c2 = chart(o.chart); if (c2) body.appendChild(c2);
    } else if (o.route) {
      var R = o.route; body = h('div', 'sx-route');
      var sv = svgEl('svg', { viewBox: '0 0 300 150', 'aria-hidden': 'true' });
      sv.appendChild(svgEl('path', { d: 'M40 110 C 110 40, 190 140, 260 50', fill: 'none', stroke: '#d3d3cc', 'stroke-width': '3', 'stroke-dasharray': '6 6' }));
      var prog = svgEl('path', { d: 'M40 110 C 110 40, 190 140, 260 50', fill: 'none', stroke: '#2f5bd3', 'stroke-width': '3', pathLength: '1', 'stroke-dasharray': '1', 'stroke-dashoffset': '1', class: 'sx-route-p' });
      sv.appendChild(prog);
      [[40, 110], [260, 50]].forEach(function (p) { sv.appendChild(svgEl('circle', { cx: p[0], cy: p[1], r: 7, fill: '#15171c' })); });
      var truck = svgEl('g', { class: 'sx-truck' }); truck.appendChild(svgEl('rect', { x: -11, y: -7, width: 22, height: 14, rx: 3, fill: '#8e2a3b' }));
      truck.style.offsetPath = "path('M40 110 C 110 40, 190 140, 260 50')"; sv.appendChild(truck);
      body.appendChild(sv);
      var lb = h('div', 'sx-route-l'); lb.appendChild(h('span', null, R.from)); lb.appendChild(h('b', null, str(R.eta))); lb.appendChild(h('span', null, R.to)); body.appendChild(lb);
    } else if (o.stack) {
      var K = o.stack; body = h('div', 'sx-stack'); var grid = h('div', 'sx-stack-g');
      for (var i = 0; i < (K.boxes || 12); i++) { var bx = h('i'); bx.style.transitionDelay = (i * 70) + 'ms'; grid.appendChild(bx); }
      body.appendChild(grid); el._num = h('b', null, '0'); el._count = { to: K.to, label: K.label }; var lab = h('div', 'sx-stack-l'); lab.appendChild(el._num); lab.appendChild(h('span', null, K.label)); body.appendChild(lab);
    } else if (o.checklist) {
      body = h('div', 'sx-cklist'); body.appendChild(h('b', 'sx-cklist-t', o.checklist.title));
      arr(o.checklist.rows).forEach(function (r, i) { var li = h('div', 'sx-cklist-r' + (r[1] === false ? ' is-miss' : '')); li.style.transitionDelay = (i * 160) + 'ms'; li.appendChild(h('i')); li.appendChild(h('span', null, r[0])); body.appendChild(li); });
    } else if (o.list) {
      var Ls = o.list; body = h('div', 'sx-list'); if (Ls.title) body.appendChild(h('b', 'sx-list-t', Ls.title));
      arr(Ls.rows).forEach(function (r, i) {
        var li = h('div', 'sx-list-r'); li.style.transitionDelay = (i * 120) + 'ms';
        if (r.who) li.appendChild(faceEl(r.who, 'is-xs')); else if (r.via) li.appendChild(srcMark(r.via, 'is-xs is-g')); else if (r.color) { var lc = h('i', 'sx-list-c'); lc.style.background = r.color; li.appendChild(lc); }
        var lt = h('span', 'sx-list-x'); lt.appendChild(h('b', null, r.name)); if (r.note) lt.appendChild(h('span', null, r.note)); li.appendChild(lt);
        if (r.value) li.appendChild(h('span', 'sx-list-v' + (r.tone ? ' is-' + r.tone : ''), r.value));
        body.appendChild(li);
      });
    } else if (o.tracker) {
      var Tr = o.tracker; body = h('div', 'sx-tracker'); if (Tr.title) body.appendChild(h('b', 'sx-list-t', Tr.title));
      arr(Tr.steps).forEach(function (st, i) { var r = h('div', 'sx-trk' + (st.done ? ' is-done' : st.now ? ' is-now' : '')); r.style.transitionDelay = (i * 200) + 'ms'; r.appendChild(h('i')); r.appendChild(h('span', null, st.label)); r.appendChild(h('em', null, st.at || '')); body.appendChild(r); });
    } else if (o.calendar) {
      var Ca = o.calendar; body = h('div', 'sx-cal'); if (Ca.title) body.appendChild(h('b', 'sx-list-t', Ca.title));
      var cg = h('div', 'sx-cal-g'); arr(Ca.days).forEach(function (d, i) { var c = h('div', 'sx-cal-d'); c.style.transitionDelay = (i * 80) + 'ms'; c.appendChild(h('span', null, d[0])); arr(d[1]).forEach(function (x) { c.appendChild(h('em', null, x)); }); cg.appendChild(c); }); body.appendChild(cg);
    } else if (o.pins) {
      var Pn = o.pins; body = h('div', 'sx-pins'); if (Pn.title) body.appendChild(h('b', 'sx-list-t', Pn.title));
      var mp = h('div', 'sx-map'); arr(Pn.points).forEach(function (p, i) { var d = h('i'); d.style.left = p[0] + '%'; d.style.top = p[1] + '%'; d.style.setProperty('--s', p[3] || 1); d.style.transitionDelay = (i * 90) + 'ms'; d.title = p[2] || ''; mp.appendChild(d); if (p[2]) { var lb = h('span', null, p[2]); lb.style.left = p[0] + '%'; lb.style.top = p[1] + '%'; mp.appendChild(lb); } }); body.appendChild(mp);
      if (Pn.note) body.appendChild(h('span', 'sx-media-note', Pn.note));
    } else if (o.quotes) {
      body = h('div', 'sx-quotes');
      arr(o.quotes).forEach(function (q, i) {
        var c = h('div', 'sx-quote' + (q.pick ? ' is-pick' : '')); c.style.setProperty('--i', i - (o.quotes.length - 1) / 2);
        if (q.img) { var qi = h('img'); qi.alt = ''; qi.src = asset(q.img); c.appendChild(qi); } else if (q.color) { var qs = h('i', 'sx-quote-sw'); qs.style.background = q.color; c.appendChild(qs); }
        c.appendChild(h('b', null, q.name)); c.appendChild(h('span', 'sx-quote-p', q.price)); if (q.note) c.appendChild(h('span', 'sx-quote-n', q.note));
        body.appendChild(c);
      });
      card = false;
    } else {
      body = h('img', 'sx-ob-img'); body.alt = ''; body.decoding = 'async'; body.src = asset(o.src); card = false; el.classList.add('is-img');
    }
    if (card) el.classList.add('is-card');
    if (o.label) el.appendChild(h('span', 'sx-ob-label', o.label));
    el._stamp = h('span', 'sx-stamp', ''); el.appendChild(el._stamp);
    var inner = h('div', 'sx-ob-in'); inner.appendChild(body); el.appendChild(inner);
    if (o.at === 'cue') el.classList.add('is-wait');
    return el;
  }
  function countUp(el, quiet) {
    var C = el._count; if (!C || !el._num) return;
    var to = Number(C.to) || 0, pre = C.prefix || '';
    if (quiet || REDUCED) { el._num.textContent = pre + fmt(to); return; }
    var t0 = performance.now(), dur = C.ms || 1600, lastTick = 0;
    (function f(now) {
      var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el._num.textContent = pre + fmt(to * e);
      if (now - lastTick > 90 && p < 1) { lastTick = now; sfx('tick'); }
      if (p < 1) requestAnimationFrame(f);
    })(t0);
  }
  function setScene(stop, dir) {
    each(ui.scene.querySelectorAll('.sx-set'), function (old) {
      old.classList.add(dir < 0 ? 'is-out-back' : 'is-out'); setTimeout(function () { if (old.parentNode) old.parentNode.removeChild(old); }, 700);
    });
    var set = h('div', 'sx-set' + ((stop.scene || {}).layout ? ' is-grid is-' + stop.scene.layout : ''));
    arr((stop.scene || {}).objs).forEach(function (o) { var e = objEl(o); set.appendChild(e); if (o.at !== 'cue') { e.classList.add('is-on'); countUp(e, true); } });
    set.classList.add(dir < 0 ? 'is-in-back' : 'is-in');
    ui.scene.insertBefore(set, ui.handoff); ui.set = set;
    raf2(function () { set.classList.remove('is-in', 'is-in-back'); });
  }
  function land(id, quiet, note) {
    var set = ui.set; if (!set || !id) return;
    if (Array.isArray(id)) { id.forEach(function (x, n) { if (quiet) land(x, true); else setTimeout(function () { land(x); }, n * 240); }); return; }
    var e = set.querySelector('.sx-ob[data-id="' + id + '"]'); if (!e) return;
    if (note) { e._stamp.textContent = note; e.classList.add('has-stamp'); }
    /* a draft listing on the stage goes live in place */
    if (e._live && e.classList.contains('is-draft') && !e.classList.contains('is-wait')) { if (quiet) { e._live.textContent = 'Live'; e.classList.replace('is-draft', 'is-live'); return; } setTimeout(function () { e._live.textContent = 'Live'; e.classList.replace('is-draft', 'is-live'); sfx('tick'); }, 120); return; }
    if (!e.classList.contains('is-wait')) return;
    each(set.querySelectorAll('.sx-ob:not(.is-wait)'), function (o) { if (o !== e && (e.dataset.slot ? o.dataset.slot === e.dataset.slot : o.style.left === e.style.left && o.style.top === e.style.top)) o.classList.add('is-gone'); });
    e.classList.remove('is-wait');
    if (quiet) { e.classList.add('is-on'); countUp(e, true); return; }
    e.classList.add('is-land'); nudgeTab('canvas');
    setTimeout(function () { sfx('land'); e.classList.add('is-on'); countUp(e); }, 380);
  }
  function listingLine(text) { if (!ui.set) return; each(ui.set.querySelectorAll('.sx-ob'), function (e) { if (e._line && text) e._line.textContent = text; }); }

  /* an input's native look, for a moment, on the canvas */
  function sourcePop(it) {
    var v = it.via; if (!v || v === 'app' || !SRC[v] || !ui.scene) return;
    clearPop();
    var p = h('div', 'sx-pop sx-pop-' + v), s = SRC[v];
    var hd = h('div', 'sx-pop-hd'); hd.appendChild(srcMark(v)); if (it.where) hd.appendChild(h('span', null, it.where)); p.appendChild(hd);
    var who = it.k === 'cos' ? str(it.desc, s[0]) : str(it.who);
    if (v === 'email') { var em = h('div', 'sx-pop-mail'); em.appendChild(h('span', null, 'From: ' + who)); em.appendChild(h('b', null, str(it.where, str(it.desc, 'Quotes')))); em.appendChild(h('p', null, it.text)); p.appendChild(em); }
    else if (v === 'meeting') { var tr = h('div', 'sx-pop-tr'); tr.appendChild(h('span', null, str(it.at, '11:02') + '  ' + shortName(who))); tr.appendChild(h('p', null, it.text)); p.appendChild(tr); }
    else if (v === 'shopify') { var od = h('div', 'sx-pop-order'); od.appendChild(h('b', null, str(it.title, it.text))); p.appendChild(od); }
    else { var bb = h('div', 'sx-pop-bub'); bb.appendChild(faceEl(who, 'is-xs')); var t = h('div'); t.appendChild(h('b', null, shortName(who))); t.appendChild(h('p', null, it.text)); bb.appendChild(t); p.appendChild(bb); }
    ui.scene.appendChild(p); ui.pop = p;
    raf2(function () { p.classList.add('is-on'); });
  }
  function clearPop() { var p = ui.pop; if (!p) return; ui.pop = null; p.classList.remove('is-on'); p.classList.add('is-off'); setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 500); }

  /* ---------- the caption under the canvas ---------- */
  function caption(stop) {
    each(ui.cap.children, function (old) { old.classList.add('is-gone'); setTimeout(function () { if (old.parentNode) old.parentNode.removeChild(old); }, 350); });
    var c = h('div', 'sx-cap-in'), d = dayOf(stops.indexOf(stop));
    c.appendChild(h('span', 'sx-cap-mod', modOf(stop.module).name + ' · ' + stop.label + (d != null ? ' · Day ' + d : '')));
    c.appendChild(h('h2', 'sx-title', str(stop.title)));
    ui.cap.appendChild(c);
  }

  /* ---------- the thread ---------- */
  function row(it) {
    var k = it.k, r = h('div', 'sx-row sx-' + k);
    if (k === 'msg' || k === 'cos') {
      var who = k === 'cos' ? str(it.agent, 'Chief of staff') : str(it.who);
      r.appendChild(faceEl(who));
      var b = h('div', 'sx-bub' + (/^chief/i.test(who) ? ' is-chief' : ''));
      var hd = h('div', 'sx-bub-hd'); hd.appendChild(h('b', null, who));
      var meta = k === 'cos' ? str(it.desc) : [roleOf(who), it.where].filter(Boolean).join(' · ');
      if (meta) hd.appendChild(h('span', null, meta));
      if (it.via && it.via !== 'app') hd.appendChild(srcMark(it.via, 'is-xs'));
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
      b.appendChild(textEl('p', url || it.len ? 'sx-tr' : 'sx-text', it.text));
      var md = it.media ? chart(it.media) : null; if (md) b.appendChild(md);
      r.appendChild(b);
    } else if (k === 'task') {
      r.appendChild(h('span', 'sx-chk'));
      var t = h('div', 'sx-task-b');
      t.appendChild(h('span', 'sx-kind', 'Task' + (it.owner ? ' · ' + it.owner : '')));
      t.appendChild(textEl('p', null, it.text)); t.appendChild(h('span', 'sx-task-done', it.done || 'Done'));
      r.appendChild(t);
    } else if (k === 'decision') {
      var w2 = first(it.who) || 'Someone', d = h('div', 'sx-dec');
      var dh = h('div', 'sx-dec-hd'); dh.appendChild(faceEl(it.who, 'is-xs')); dh.appendChild(h('span', 'sx-kind', 'Decision for ' + w2 + ' · you decide')); d.appendChild(dh);
      d.appendChild(textEl('p', null, it.text));
      var ops = h('div', 'sx-opts'); r._opts = [];
      var bmax = Math.max.apply(null, arr(it.options).map(function (o) { return Number(o.bar) || 0; })) || 1;
      arr(it.options).forEach(function (o) {
        var b2 = h('button', 'sx-opt' + (o.ai ? ' is-ai' : '')); b2.type = 'button'; b2.disabled = true;
        if (o.img) { var oi = h('img', 'sx-opt-img'); oi.alt = ''; oi.src = asset(o.img); b2.appendChild(oi); }
        else if (o.swatch) { var os = h('i', 'sx-opt-sw'); os.style.background = o.swatch; b2.appendChild(os); }
        else if (o.face) b2.appendChild(faceEl(o.face, 'is-sm'));
        var ob = h('span', 'sx-opt-b');
        var top = h('span', 'sx-opt-top'); top.appendChild(h('b', null, String(o.label).replace(/^["“]|["”]$/g, ''))); if (o.ai) top.appendChild(h('em', 'sx-pick', 'AI pick')); ob.appendChild(top);
        var chips = h('span', 'sx-opt-chips'); if (o.cost) chips.appendChild(h('span', null, o.cost)); if (o.days != null) chips.appendChild(h('span', o.days > 0 ? 'is-late' : 'is-ok', o.days > 0 ? '+' + o.days + ' days' : o.days < 0 ? o.days + ' days' : 'on time'));
        if (chips.children.length) ob.appendChild(chips);
        if (o.bar != null) { var br = h('span', 'sx-opt-bar'); var bi = h('i'); bi.style.transform = 'scaleX(' + (Number(o.bar) / bmax).toFixed(3) + ')'; br.appendChild(bi); if (o.barLabel) br.appendChild(h('em', null, o.barLabel)); ob.appendChild(br); }
        b2.appendChild(ob); ops.appendChild(b2); r._opts.push(b2);
      });
      d.appendChild(ops);
      var ai = arr(it.options).filter(function (o) { return o.ai; })[0];
      if (ai && ai.reason) d.appendChild(h('span', 'sx-dec-why', 'AI pick: ' + ai.reason));
      r._by = h('span', 'sx-dec-by', ''); d.appendChild(r._by);
      r.appendChild(d);
    } else if (k === 'record') {
      var rc = h('div', 'sx-rec'); rc.appendChild(h('span', 'sx-kind', 'Record' + (it.area ? ' · ' + it.area : '')));
      rc.appendChild(h('b', null, it.title));
      var dl = h('dl'); arr(it.rows).forEach(function (x) { dl.appendChild(h('dt', null, x[0])); dl.appendChild(h('dd', null, x[1])); }); rc.appendChild(dl);
      r.appendChild(rc);
    } else if (k === 'typing') {
      r.appendChild(faceEl(it.agent));
      var ty = h('div', 'sx-typing'); ty.appendChild(h('span', null, str(it.agent) + (/^chief/i.test(it.agent) ? ' is writing' : ' is working'))); ty.appendChild(h('i', 'sx-dots')); r.appendChild(ty);
    }
    return r;
  }
  function scrollTo(r, instant) {
    var t = ui.thread, y = t.scrollHeight - t.clientHeight;
    if (r) y = Math.min(y, r.offsetTop - 12);
    if (instant || REDUCED) t.scrollTop = y; else t.scrollTo({ top: y, behavior: 'smooth' });
  }
  function divider(stop) { var d = h('div', 'sx-div'); var dd = dayOf(stops.indexOf(stop)); d.appendChild(h('span', null, [stop.label, dd != null ? 'Day ' + dd : ''].filter(Boolean).join(' · '))); return d; }

  /* ---------- choices, days, OS ---------- */
  function key(stop, k) { return stop.id + ':' + k; }
  function delayBefore(i) { var d = 0; for (var j = 0; j < i; j++) d += DELAY[stops[j].id] || 0; return d; }
  function dayOf(i) { var s = stops[i]; return s && s.day != null ? s.day + delayBefore(i) : null; }
  function setOS(o, flash) {
    Object.keys(o || {}).forEach(function (k) {
      OS[k] = o[k]; var v = ui['os_' + k]; if (!v) return;
      v.textContent = o[k]; v._c.classList.add('is-set');
      if (flash) { v._c.classList.remove('is-flash'); void v._c.offsetWidth; v._c.classList.add('is-flash'); }
    });
  }
  function resetOS() { OS = {}; each(ui.stats.children, function (c) { c.classList.remove('is-set', 'is-flash'); c.querySelector('b').textContent = '—'; }); }
  function itemsOf(stop) {
    var out = [];
    arr(stop.thread).forEach(function (it, k) {
      out.push({ it: it, k: k });
      if (it.k === 'decision' && CH[key(stop, k)] != null) { var o = it.options[CH[key(stop, k)]]; arr(o && o.then).forEach(function (x, n) { out.push({ it: x, k: k + '.' + n }); }); }
    });
    return out;
  }
  function aiIndex(it) { var i = 0; arr(it.options).forEach(function (o, j) { if (o.ai) i = j; }); return i; }

  /* ---------- tasks pane: now card, tasks and decisions, agents ---------- */
  function nowCard(i) {
    var s = stops[i], m = modOf(s.module), d = dayOf(i);
    ui.nowDay.textContent = 'Now' + (d != null ? ' · Day ' + d : '');
    ui.nowN.textContent = 'Stage ' + (i + 1) + ' of ' + stops.length;
    ui.nowImg.innerHTML = '';
    if (i === 0) ui.nowImg.appendChild(faceEl(owners(m)[0] || (cfg.brand || {}).founder, 'is-big'));
    else { var im = h('img'); im.alt = ''; im.src = asset((cfg.story.product || {}).img || 'hero'); ui.nowImg.appendChild(im); }
    ui.nowLabel.textContent = s.label + ' · ' + m.name; ui.nowLine.textContent = owners(m).map(shortName).join(', ') + ' with ' + str(m.agent, 'the chief of staff');
  }
  function setState(st) {
    state = st;
    var nx = stops[si + 1];
    var label = st === 'decide' ? 'Your call: pick an option' : st === 'done' ? (nx ? 'Moving to ' + modOf(nx.module).name + '…' : 'See the team') : st === 'run' ? 'Skip ahead' : 'Next';
    ui.nowBtn.textContent = label;
    ui.next.textContent = st === 'decide' ? 'AI pick' : st === 'done' && !nx ? 'See the team' : 'Next';
    ui.now.classList.toggle('is-decide', st === 'decide');
    ui.now.classList.toggle('is-ready', st === 'done');
    ui.prev.disabled = si <= 0;
    ui.stage.classList.toggle('is-decide', st === 'decide');
  }
  function setAuto(on) {
    AUTO = on; ui.play.textContent = on ? 'Pause' : 'Play demo'; ui.play.classList.toggle('is-on', on);
    if (on && state === 'decide' && ui.pick) setTimeout(function () { if (AUTO && state === 'decide' && ui.pick) ui.pick(null); }, 1600);
  }
  /* the Tasks pane: one card per task or decision, with its owner (an agent or a person) and its state:
     queued · working (an agent, with progress) · done (its result) · your call (the options, selectable here too) */
  function checklist(stop) {
    ui.check.innerHTML = '';
    arr(stop.thread).forEach(function (it, k) { if (it.k === 'task' || it.k === 'decision') ui.check.appendChild(checkLine(it, k)); });
  }
  function checkLine(it, k) {
    var dec = it.k === 'decision', own = dec ? it.who : it.owner || 'Chief of staff';
    var li = h('li', 'sx-tc is-queued' + (dec ? ' is-dec' : '') + (isAgent(own) ? ' is-agent' : '')); li.dataset.k = k;
    var hd = h('div', 'sx-tc-hd'); hd.appendChild(faceEl(own, 'is-xs'));
    hd.appendChild(h('span', 'sx-tc-who', shortName(own) + (dec ? ' decides' : '')));
    li._pill = h('span', 'sx-tc-pill', 'Queued'); hd.appendChild(li._pill); li.appendChild(hd);
    li._t = textEl('p', 'sx-tc-t', dec ? str(it.tray, it.text) : it.text); li.appendChild(li._t);
    if (!dec && isAgent(own)) { var bar = h('span', 'sx-tc-bar'); bar.appendChild(h('i')); li.appendChild(bar); }
    if (dec) {
      var ops = h('div', 'sx-tc-ops'); li._opts = [];
      arr(it.options).forEach(function (o, j) {
        var b = h('button', 'sx-tc-op' + (o.ai ? ' is-ai' : '')); b.type = 'button'; b.disabled = true;
        b.appendChild(h('span', null, String(o.label).replace(/^["“]|["”]$/g, ''))); if (o.ai) b.appendChild(h('em', null, 'AI pick'));
        b.addEventListener('click', function () { unlock(); if (ui.pick) ui.pick(j); });
        ops.appendChild(b); li._opts.push(b);
      });
      li.appendChild(ops);
    }
    li._d = h('span', 'sx-tc-d', ''); li.appendChild(li._d);
    return li;
  }
  function ck(k) { return ui.check.querySelector('.sx-tc[data-k="' + k + '"]'); }
  var PILL = { queued: 'Queued', working: 'Working', waiting: 'Your call', done: 'Done' };
  function ckState(k, st, detail, chosen) {
    var li = ck(k); if (!li) return;
    li.classList.remove('is-queued', 'is-working', 'is-waiting', 'is-done'); li.classList.add('is-' + st);
    li._pill.textContent = PILL[st] || st;
    if (detail) li._d.textContent = detail;
    if (li._opts) li._opts.forEach(function (b, j) { b.disabled = st !== 'waiting'; if (chosen != null) { b.classList.toggle('is-chosen', j === chosen); b.classList.toggle('is-not', j !== chosen); } });
    if (st === 'working' || st === 'waiting') { var y = li.offsetTop - ui.check.parentNode.offsetTop - 40; ui.check.parentNode.scrollTo({ top: Math.max(0, y), behavior: REDUCED ? 'auto' : 'smooth' }); }
  }
  /* agents now live on their task cards */
  function agentsFor() { AG = {}; }
  function agent() {}
  function waitingAll() {}
  function tilePreview(mid, it) {
    var t = tiles[mid]; if (!t || !it || it.k === 'typing') return;
    var who = it.k === 'cos' ? str(it.agent, 'Chief of staff') : it.k === 'task' ? str(it.owner, 'Chief of staff') : it.who;
    var txt = it.k === 'task' ? 'Task: ' + it.text : it.k === 'decision' ? 'Decision: ' + str(it.tray, it.text) : it.k === 'record' ? it.title : it.text;
    t._pvFace.innerHTML = ''; if (who) t._pvFace.appendChild(faceEl(who, 'is-xs'));
    t._pv.textContent = (who ? shortName(who) + ': ' : '') + txt;
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
      t._status.textContent = m.id === active ? 'Open now' : reached ? (later ? 'Back later' : 'Done') : 'Next';
      t._agent.textContent = str(m.agent) + (m.id === active ? ' · on it' : '');
      t._pvFace.innerHTML = '';
      if (last) tilePreview(m.id, last); else t._pv.textContent = m.next || m.about || '';
    });
  }
  function strip(i) {
    each(ui.strip.children, function (b, j) {
      b.classList.toggle('is-on', j === i); b.classList.toggle('is-past', j < i); b.disabled = j > maxSeen;
      var d = dayOf(j); b._sub.textContent = modOf(stops[j].module).name + (d != null ? ' · Day ' + d : '');
      b.querySelector('.sx-st-n').textContent = j < i ? '' : String(j + 1);
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
      foldRow(r);
    });
  }
  function answer(r, it, c) {
    var o = it.options[c] || {};
    r._opts.forEach(function (b, j) { b.disabled = true; b.classList.toggle('is-chosen', j === c); b.classList.toggle('is-not', j !== c); });
    var lb = String(o.label || '').replace(/^["“]|["”]$/g, '');
    r._by.textContent = first(it.who) + ' chose “' + lb + '”' + (o.ai ? '' : ', not the AI pick');
    r.classList.add('is-answered');
    return o;
  }
  function open(i, dir) {
    i = Math.max(0, Math.min(stops.length - 1, i));
    var t = ++tok; if (W) { clearTimeout(W.timer); W = null; } stopVoice(); ui.pick = null; clearPop();
    ui.handoff.classList.remove('is-on');
    si = i; maxSeen = Math.max(maxSeen, i);
    var stop = stops[i];
    preload(i).then(function () { preload(i + 1); preload(i + 2); });
    resetOS();
    for (var j = 0; j < i; j++) {
      var s = stops[j];
      itemsOf(s).forEach(function (x) {
        if (x.it.k === 'decision' && CH[key(s, x.k)] == null) { CH[key(s, x.k)] = aiIndex(x.it); var o = x.it.options[CH[key(s, x.k)]]; DELAY[s.id] = (DELAY[s.id] || 0) + (o.delay || 0); }
      });
      itemsOf(s).forEach(function (x) { setOS(x.it.os); if (x.it.k === 'decision') setOS(x.it.options[CH[key(s, x.k)]].os); });
      if (s.id === 'listing' || s.launch) setOS({ Launch: 'Day ' + dayOf(j) });
    }
    Object.keys(CH).forEach(function (k2) { if (k2.indexOf(stop.id + ':') === 0) delete CH[k2]; }); DELAY[stop.id] = 0;
    strip(i); tilesFor(i); nowCard(i); checklist(stop); agentsFor(stop); followStatus(i); setState('run'); lightSource(null);
    var m = modOf(stop.module), L = look(stop.module), switching = ui.lastMod && ui.lastMod !== stop.module;
    ui.lastMod = stop.module;
    ui.stage.style.setProperty('--mod', L.tint);
    if (switching && !REDUCED) { ui.main.classList.remove('is-switch'); void ui.main.offsetWidth; ui.main.classList.add('is-switch'); setTimeout(function () { ui.main.classList.remove('is-switch'); }, 700); }
    ui.chanIcon.innerHTML = ''; ui.chanIcon.appendChild(iconEl(stop.module));
    ui.cvHd.innerHTML = '';
    var cvt = h('div', 'sx-cv-t'); cvt.appendChild(iconEl(stop.module)); cvt.appendChild(h('b', null, m.name)); cvt.appendChild(h('span', null, L.title)); ui.cvHd.appendChild(cvt);
    var bds = h('div', 'sx-boards'); L.boards.forEach(function (b) { bds.appendChild(h('span', b === stop.board ? 'is-on' : '', b)); }); ui.cvHd.appendChild(bds);
    ui.chan.textContent = m.name; ui.purpose.textContent = m.about || '';
    ui.who.innerHTML = ''; var pp = h('span', 'sx-people'); owners(m).forEach(function (p) { pp.appendChild(faceEl(p, 'is-sm')); }); ui.who.appendChild(pp);
    ui.thread.innerHTML = '';
    for (var k = 0; k < i; k++) if (stops[k].module === stop.module) { ui.thread.appendChild(divider(stops[k])).classList.add('is-in'); renderDone(stops[k], itemsOf(stops[k])); }
    scrollTo(null, true);
    setScene(stop, dir || 1); caption(stop); sfx('stage'); tab('canvas');
    if (stop.id === 'listing' || stop.launch) setOS({ Launch: 'Day ' + dayOf(i) }, true);
    (LOADED[i] || Promise.resolve()).then(function () { return wait(1000, t); }).then(function () {
      var d = divider(stop); ui.thread.appendChild(d); raf2(function () { d.classList.add('is-in'); scrollTo(d); });
      return wait(300, t);
    }).then(function () { return runBeats(stop, t); }).then(function () {
      setState('done'); clearPop(); lightSource(null);
      Object.keys(AG).forEach(function (n) { agent(n, 'done', 'Handed over'); });
      if (si >= stops.length - 1) { if (AUTO && cfg.story.setup) return wait(2400, t).then(function () { next(); }); return; }
      /* the module's work is done: move on by itself */
      var nx = stops[si + 1];
      ui.handoff.textContent = 'Moving to ' + modOf(nx.module).name + ': ' + nx.label + '…';
      ui.handoff.classList.add('is-on');
      return wait(AUTO ? 2200 : 2600, t).then(function () { open(si + 1, 1); });
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
    function add(r) { fold(); ui.thread.appendChild(r); raf2(function () { r.classList.add('is-in'); scrollTo(r); }); }
    function after() { if (it.land) land(it.land); setOS(it.os, true); if (it.line) listingLine(it.line); if (it.land) return wait(950, t); return Promise.resolve(); }
    var read = Math.min(4600, 1300 + (words(it.text) + (it.media ? 8 : 0) + (it.rows ? 8 : 0)) * 130);
    if (it.via) lightSource(it.via);
    if (it.k === 'msg' || it.k === 'record') {
      var r = row(it); add(r); sfx('msg'); tilePreview(mid, it); sourcePop(it); nudgeTab('chat');
      var go = r._voice && SOUND ? new Promise(function (res, rej) {
        var ok = playVoice(r._voice.url, r._voice.btn, function () { if (W) W.done(); else res(); });
        if (!ok) return wait(read, t).then(res, rej);
        wait(30000, t).then(res, rej);
      }) : wait(read, t);
      return go.then(function () { return wait(300, t); }).then(function () { clearPop(); return after(); });
    }
    if (it.k === 'cos') {
      var ag = str(it.agent, 'Chief of staff'), ty = row({ k: 'typing', agent: ag }); add(ty); sfx('typing');
      agent(ag, 'working', str(it.doing, firstClause(it.text)));
      if (it.via) sourcePop(it);
      return wait(1100, t).then(function () {
        if (ty.parentNode) ty.parentNode.removeChild(ty);
        var r2 = row(it); add(r2); sfx('msg'); tilePreview(mid, it);
        agent(ag, 'done', null, firstClause(it.text), true);
        return wait(read, t);
      }).then(function () { clearPop(); return after(); });
    }
    if (it.k === 'task') {
      var r3 = row(it); add(r3); sfx('task'); tilePreview(mid, it);
      if (!ck(k)) ui.check.appendChild(checkLine(it, k));
      ckState(k, 'working', isAgent(it.owner) ? 'On it now' : 'With ' + shortName(it.owner || 'the team'));
      return wait(Math.max(1500, read * .7), t).then(function () {
        r3.classList.add('is-done'); ckState(k, 'done', it.done); sfx('done');
        if (isAgent(it.owner)) agent(it.owner, 'done', null, it.done, true);
        return wait(450, t);
      }).then(after);
    }
    if (it.k === 'decision') {
      var r4 = row(it); add(r4); sfx('ask'); tilePreview(mid, it); nudgeTab('chat');
      ckState(k, 'waiting', 'Pending on ' + shortName(it.who) + ': pick here or in the chat'); setState('decide');
      return new Promise(function (res, rej) {
        function pick(c) {
          if (t !== tok || !ui.pick) return; ui.pick = null;
          if (c == null) c = aiIndex(it);
          CH[key(stop, k)] = c;
          var o = answer(r4, it, c); sfx('decision');
          DELAY[stop.id] = (DELAY[stop.id] || 0) + (o.delay || 0);
          ckState(k, 'done', shortName(it.who) + ' chose “' + String(o.label).replace(/^["“]|["”]$/g, '') + '”', c);
          Object.keys(AG).forEach(function (n) { if (/^waiting/.test(AG[n].st.textContent)) agent(n, 'ready'); });
          if (o.land) land(o.land, false, o.note);
          if (o.line) listingLine(o.line);
          setOS(o.os, true); strip(si); nowCard(si); caption(stop);
          setState('run');
          wait(o.land ? 1200 : 700, t).then(res, rej);
        }
        ui.pick = pick;
        r4._opts.forEach(function (b, j) { b.disabled = false; b.addEventListener('click', function () { unlock(); pick(j); }); });
        if (AUTO) setTimeout(function () { if (AUTO && ui.pick === pick) pick(null); }, 2600);
      });
    }
    return Promise.resolve();
  }
  /* older items fold to one line (tap to open); the newest two stay whole */
  function fold() {
    var rows = ui.thread.querySelectorAll('.sx-row:not(.sx-typing-row)');
    for (var i = 0; i < rows.length - 1; i++) if (!rows[i].classList.contains('is-mini') && !rows[i].classList.contains('is-open')) foldRow(rows[i]);
  }
  function foldRow(r) {
    if (r.classList.contains('sx-decision') && !r.classList.contains('is-answered')) return;
    r.classList.add('is-mini');
    if (!r._foldBound) { r._foldBound = true; r.addEventListener('click', function (e) { if (!r.classList.contains('is-mini')) return; e.stopPropagation(); r.classList.remove('is-mini'); r.classList.add('is-open'); }); }
  }
  function firstClause(s) { s = String(s || '').replace(/@(?:[A-Z][a-z]+ agent|Chief of staff|[A-Z][\w]+)\s*/g, '').replace(/^\s*[a-z]/, function (c) { return c.toUpperCase(); }); var m = s.match(/^[^.:;]+/); return (m ? m[0] : s).slice(0, 80); }
  /* Next: finish the beat, take the AI pick, or go on now */
  function next() {
    if (state === 'decide' && ui.pick) return ui.pick(null);
    if (state === 'run') return skip();
    if (state === 'done') {
      if (si < stops.length - 1) return open(si + 1, 1);
      setAuto(false);
      if (cfg.story.setup && !ui.hubEl) return hub('end', function () { proposal(); });
      toTeam();
    }
  }
  function onKey(e) {
    if (ui.gate) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ui.gate._go(); } return; }
    if (ui.setup || (ui.hubEl && ui.hubEl !== 'seen' && ui.hubEl.parentNode)) return;
    if (scrollY > innerHeight * .5) return;
    var tag = ((e.target || {}).tagName || '').toLowerCase();
    if (e.key === 'ArrowRight' || (e.key === ' ' && tag !== 'button')) { e.preventDefault(); unlock(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); if (si > 0) open(si - 1, -1); }
  }


  /* ---------- setup (private workspaces): workspace → connectors → agents → building the hub → the Hub ---------- */
  function setupFlow(done) {
    var S = cfg.story.setup, ov = h('div', 'sx-setup'); ui.setup = ov; ui.stage.appendChild(ov);
    var steps = ['Workspace', 'Connectors', 'Agents', 'Hub'];
    var top = h('div', 'sx-su-top'); var dots = h('ol', 'sx-su-steps'); steps.forEach(function (x) { dots.appendChild(h('li', null, x)); }); top.appendChild(dots); ov.appendChild(top);
    var body = h('div', 'sx-su-body'); ov.appendChild(body);
    var foot = h('div', 'sx-su-foot'); var nb = h('button', 'sx-su-next'); nb.type = 'button'; foot.appendChild(nb); ov.appendChild(foot);
    var at = -1, t0 = ++tok;
    function stepTo(i) {
      at = i; each(dots.children, function (li, j) { li.className = j < i ? 'is-done' : j === i ? 'is-on' : ''; });
      body.innerHTML = ''; nb.disabled = true; nb.onclick = null;
      [workspace, connectors, agents, building][i]();
    }
    function ready(label, fn) { nb.textContent = label; nb.disabled = false; nb.onclick = function () { unlock(); fn(); }; if (AUTO) setTimeout(function () { if (!nb.disabled && nb.onclick) nb.onclick(); }, 1400); }
    function workspace() {
      var c = h('div', 'sx-su-ws');
      c.appendChild(h('span', 'sx-su-k', 'Setting up'));
      var br = h('div', 'sx-su-brand'); br.appendChild(h('span', 'sx-logo is-big', str((cfg.brand || {}).name, 'C').replace(/[^a-z]/gi, '').charAt(0).toUpperCase()));
      var bt = h('div'); bt.appendChild(h('h1', null, str((cfg.brand || {}).name) + '’s Chief of Staff')); bt.appendChild(h('p', null, [str((cfg.brand || {}).category), str((cfg.brand || {}).city)].filter(Boolean).join(' · '))); br.appendChild(bt); c.appendChild(br);
      var inv = h('div', 'sx-su-inv'); inv.appendChild(h('b', null, 'Inviting ' + arr(cfg.team).length + ' people'));
      var grid = h('div', 'sx-su-team'); arr(cfg.team).forEach(function (m, i) { var p = h('div', 'sx-su-p'); p.style.transitionDelay = (300 + i * 220) + 'ms'; p.appendChild(faceEl(m.name, 'is-big')); p.appendChild(h('b', null, m.name)); p.appendChild(h('span', null, m.role)); grid.appendChild(p); });
      inv.appendChild(grid); var sent = h('span', 'sx-su-ok', ''); inv.appendChild(sent); c.appendChild(inv); body.appendChild(c);
      raf2(function () { grid.classList.add('is-on'); });
      setTimeout(function () { sfx('done'); sent.textContent = 'Invites sent. Everyone gets their own login.'; ready('Next: connect your tools', function () { stepTo(1); }); }, 600 + arr(cfg.team).length * 220);
    }
    function connectors() {
      var c = h('div', 'sx-su-cn');
      var hd = h('div', 'sx-su-hd'); hd.appendChild(h('h2', null, 'Connect where the work already happens')); var all = h('button', 'sx-su-all', 'Connect all'); all.type = 'button'; hd.appendChild(all); c.appendChild(hd);
      var grid = h('div', 'sx-su-grid'), left = arr(S.connectors).length;
      arr(S.connectors).forEach(function (x) {
        var t = h('button', 'sx-cn'); t.type = 'button';
        var g = SRC[x[0]] || SRC.app; var gl = h('i', 'sx-cn-g', g[1]); gl.style.background = g[2]; t.appendChild(gl);
        var tx = h('span', 'sx-cn-tx'); tx.appendChild(h('b', null, x[1] || g[0])); var st = h('span', null, 'Connect'); tx.appendChild(st); t.appendChild(tx);
        var ic = h('span', 'sx-cn-ic'); t.appendChild(ic);
        t._go = function () {
          if (t.dataset.s) return; t.dataset.s = '1'; t.classList.add('is-busy'); st.textContent = 'Connecting…'; sfx('tick');
          setTimeout(function () { st.textContent = x[2]; }, 700);
          setTimeout(function () { t.classList.remove('is-busy'); t.classList.add('is-ok'); st.textContent = x[3]; sfx('done'); if (--left === 0) ready('Next: switch on the agents', function () { stepTo(2); }); }, 1500);
        };
        t.addEventListener('click', function () { unlock(); t._go(); });
        grid.appendChild(t);
      });
      all.addEventListener('click', function () { unlock(); all.disabled = true; each(grid.children, function (t, i) { setTimeout(t._go, i * 260); }); });
      c.appendChild(grid); body.appendChild(c);
      nb.textContent = 'Connect your tools to continue';
      if (AUTO) setTimeout(function () { all.click(); }, 700);
    }
    function agents() {
      var c = h('div', 'sx-su-ag'); c.appendChild(h('h2', null, 'Switching on your agents'));
      var list = h('div', 'sx-su-agl');
      arr(S.agents).forEach(function (a, i) {
        var r = h('div', 'sx-sa'); r.appendChild(faceEl(a[0], 'is-sm'));
        var tx = h('div'); tx.appendChild(h('b', null, a[0])); tx.appendChild(h('span', null, a[1])); r.appendChild(tx);
        var sw = h('span', 'sx-sw-t'); sw.appendChild(h('i')); r.appendChild(sw);
        list.appendChild(r);
        setTimeout(function () { r.classList.add('is-on'); sfx('task'); }, 350 + i * 320);
      });
      c.appendChild(list); body.appendChild(c);
      setTimeout(function () { ready('Build my hub', function () { stepTo(3); }); }, 450 + arr(S.agents).length * 320);
    }
    function building() {
      var c = h('div', 'sx-su-load'); c.appendChild(h('span', 'sx-spin'));
      c.appendChild(h('h2', null, 'Building your hub…'));
      var ul = h('ul'); arr(S.building).forEach(function (x, i) { var li = h('li', null, x); li.style.transitionDelay = (i * 600) + 'ms'; ul.appendChild(li); }); c.appendChild(ul); body.appendChild(c);
      raf2(function () { ul.classList.add('is-on'); });
      nb.textContent = 'Building…';
      setTimeout(function () { sfx('stage'); hub('start', function () { ov.classList.add('is-out'); setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); ui.setup = null; }, 500); done(); }); }, 600 * arr(S.building).length + 700);
    }
    stepTo(0);
  }
  function toTeam() {
    var e = document.getElementById('end'); if (e) e.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
    setTimeout(function () { each(document.querySelectorAll('#end .fin-team > li'), function (li, n) { setTimeout(function () { li.classList.add('is-up'); }, 200 + n * 170); }); }, 500);
  }
  /* the proposal: what we'd run, the plans, the rollout, and one call to action */
  function proposal() {
    var SC = cfg.scope || {}, PR = cfg.pricing || {}, brand = str((cfg.brand || {}).name);
    var ov = h('div', 'sx-prop'); ui.prop = ov;
    var top = h('div', 'sx-prop-top');
    var back = h('button', 'sx-hub-link', 'Back to the hub'); back.type = 'button';
    back.addEventListener('click', function () { ov.classList.add('is-out'); setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 450); });
    top.appendChild(back); top.appendChild(h('span', 'sx-su-k', 'Proposal for ' + brand)); ov.appendChild(top);
    var in1 = h('div', 'sx-prop-in'); ov.appendChild(in1);
    in1.appendChild(h('h1', null, str(SC.title, 'What it would run for ' + brand)));
    if (SC.lead) in1.appendChild(h('p', 'sx-prop-lead', SC.lead));
    /* 1. what we'll run */
    in1.appendChild(h('h2', null, 'What we\u2019ll run'));
    var g = h('div', 'sx-prop-g');
    var mb = h('section', 'sx-prop-box'); mb.appendChild(h('b', 'sx-side-h', mods.length + ' modules'));
    mods.forEach(function (m) { var r = h('div', 'sx-prop-mod'); r.style.setProperty('--tint', look(m.id).tint); r.appendChild(iconEl(m.id)); var tx = h('div'); tx.appendChild(h('b', null, m.name)); tx.appendChild(h('span', null, m.about || '')); r.appendChild(tx); var pp = h('span', 'sx-people'); owners(m).forEach(function (p) { pp.appendChild(faceEl(p, 'is-xs')); }); r.appendChild(pp); mb.appendChild(r); });
    g.appendChild(mb);
    var col = h('div', 'sx-prop-col');
    var ib = h('section', 'sx-prop-box'); ib.appendChild(h('b', 'sx-side-h', 'Inputs it picks work up from'));
    var IN = { whatsapp: 'whatsapp', email: 'email', meetings: 'meeting' };
    arr(SC.inputs).forEach(function (x) { var r = h('div', 'sx-prop-in-r'); r.appendChild(srcMark(IN[String(x.name).toLowerCase()] || 'app', 'is-g')); var tx = h('div'); tx.appendChild(h('b', null, x.name)); tx.appendChild(h('span', null, x.text)); r.appendChild(tx); ib.appendChild(r); });
    if (arr(SC.integrations).length) { var ch = h('div', 'sx-prop-chips'); SC.integrations.forEach(function (n) { ch.appendChild(h('span', null, n)); }); ib.appendChild(ch); }
    col.appendChild(ib);
    var ab = h('section', 'sx-prop-box'); ab.appendChild(h('b', 'sx-side-h', 'Agents and people'));
    var al = h('div', 'sx-hub-ag'); arr((cfg.story.setup || {}).agents).forEach(function (a) { var c = h('span'); c.appendChild(faceEl(a[0], 'is-xs')); c.appendChild(h('span', null, a[0])); al.appendChild(c); }); ab.appendChild(al);
    var tl = h('div', 'sx-hub-team'); arr(cfg.team).forEach(function (m) { var r = h('span'); r.appendChild(faceEl(m.name, 'is-sm')); var tx = h('span'); tx.appendChild(h('b', null, m.name)); tx.appendChild(h('em', null, m.role)); r.appendChild(tx); tl.appendChild(r); }); ab.appendChild(tl);
    col.appendChild(ab); g.appendChild(col); in1.appendChild(g);
    /* 2. the plans */
    in1.appendChild(h('h2', null, str(PR.title, 'Pricing')));
    var pl = h('div', 'sx-plans');
    arr(PR.plans).forEach(function (p) {
      var c = h('section', 'sx-plan' + (p.id === PR.suggested ? ' is-sug' : ''));
      var hd = h('div', 'sx-plan-hd'); hd.appendChild(h('b', null, p.name)); if (p.id === PR.suggested) hd.appendChild(h('em', null, 'Suggested')); c.appendChild(hd);
      c.appendChild(h('span', 'sx-plan-p', p.start)); c.appendChild(h('span', 'sx-plan-t', p.then || ''));
      var ul = h('ul'); arr(p.items).forEach(function (x) { ul.appendChild(h('li', null, x)); }); c.appendChild(ul);
      pl.appendChild(c);
    });
    in1.appendChild(pl);
    if (PR.note) in1.appendChild(h('p', 'sx-prop-note', PR.note));
    /* 3. rollout */
    in1.appendChild(h('h2', null, 'Rollout'));
    var ro = h('ol', 'sx-roll'); arr(SC.rollout).forEach(function (r) { var li = h('li'); li.appendChild(h('b', null, r.when)); li.appendChild(h('span', null, r.what)); ro.appendChild(li); }); in1.appendChild(ro);
    /* one call to action */
    var talk = ((cfg.end || {}).links || {}).talk || 'mailto:hello@sameep.ai';
    var href = /^mailto:/i.test(talk) ? talk.replace(/subject=[^&]*/i, 'subject=' + encodeURIComponent('Chief of Staff for ' + brand + ': let\u2019s start')) : talk;
    var band = h('section', 'sx-prop-cta');
    var bt = h('div'); bt.appendChild(h('b', null, 'Ready when you are.')); bt.appendChild(h('span', null, 'Week 1 starts with a kick-off and your tools connected.')); band.appendChild(bt);
    var a = h('a', 'sx-su-next is-cta', 'Let\u2019s start'); a.href = href; a.target = '_blank'; a.rel = 'noopener'; band.appendChild(a);
    var tmb = h('button', 'sx-hub-link', 'See the team'); tmb.type = 'button'; tmb.addEventListener('click', function () { ov.classList.add('is-out'); setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 450); if (ui.hubEl && ui.hubEl.parentNode) ui.hubEl.parentNode.removeChild(ui.hubEl); ui.hubEl = 'seen'; toTeam(); });
    band.appendChild(tmb);
    in1.appendChild(band);
    ui.stage.appendChild(ov); raf2(function () { ov.classList.add('is-on'); });
  }
  /* the Hub: modules, sources, agents, products and today's numbers. At the start, and again at the end, updated. */
  function hub(when, go) {
    var S = cfg.story.setup || {}, end = when === 'end';
    var ov = h('div', 'sx-hub' + (end ? ' is-end' : '')); if (end) ui.hubEl = ov;
    var hd = h('div', 'sx-hub-hd'); var ht = h('div'); ht.appendChild(h('span', 'sx-su-k', end ? 'Back at the hub · week one' : 'Your hub is ready')); ht.appendChild(h('h1', null, str((cfg.brand || {}).name) + ' · Chief of Staff')); hd.appendChild(ht);
    var acts = h('div', 'sx-hub-acts');
    var go1 = h('button', 'sx-su-next' + (end ? ' is-cta' : ''), end ? 'See the scope and pricing' : 'Start: the ' + str((cfg.story.product || {}).name, 'product').split(' ')[0] + ' story'); go1.type = 'button';
    if (end) { var tm = h('button', 'sx-hub-link', 'See the team'); tm.type = 'button'; tm.addEventListener('click', function () { unlock(); ov.classList.add('is-out'); setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 500); ui.hubEl = 'seen'; toTeam(); }); acts.appendChild(tm); }
    acts.appendChild(go1); hd.appendChild(acts); ov.appendChild(hd);
    var nums = h('div', 'sx-hub-nums'); arr(end ? S.numbers_end : S.numbers_start).forEach(function (n) { var c = h('div'); c.appendChild(h('b', null, n[0])); c.appendChild(h('span', null, n[1])); nums.appendChild(c); }); ov.appendChild(nums);
    var g = h('div', 'sx-hub-g');
    var mb = h('section', 'sx-hub-box'); mb.appendChild(h('b', 'sx-side-h', 'Modules'));
    var ml = h('div', 'sx-hub-mods'); mods.forEach(function (m) { var r = h('div', 'sx-hub-m'); r.style.setProperty('--tint', look(m.id).tint); r.appendChild(iconEl(m.id)); var tx = h('div'); tx.appendChild(h('b', null, m.name)); tx.appendChild(h('span', null, (end && m.done_line) || m.about || '')); r.appendChild(tx); var pp = h('span', 'sx-people'); owners(m).forEach(function (p) { pp.appendChild(faceEl(p, 'is-xs')); }); r.appendChild(pp); ml.appendChild(r); }); mb.appendChild(ml); g.appendChild(mb);
    var side = h('div', 'sx-hub-side');
    var sb = h('section', 'sx-hub-box'); sb.appendChild(h('b', 'sx-side-h', 'Connected'));
    var sl = h('div', 'sx-hub-src'); arr(S.connectors).forEach(function (x) { var m = srcMark(x[0]); m.appendChild(h('em', null, x[3].replace(/^\u2713\s*/, ''))); sl.appendChild(m); }); sb.appendChild(sl); side.appendChild(sb);
    var ab = h('section', 'sx-hub-box'); ab.appendChild(h('b', 'sx-side-h', arr(S.agents).length + ' agents on'));
    var al = h('div', 'sx-hub-ag'); arr(S.agents).forEach(function (a) { var c = h('span'); c.appendChild(faceEl(a[0], 'is-xs')); c.appendChild(h('span', null, a[0])); al.appendChild(c); }); ab.appendChild(al); side.appendChild(ab);
    if (end) { var tb = h('section', 'sx-hub-box'); tb.appendChild(h('b', 'sx-side-h', 'The team, each with a login'));
      var tl = h('div', 'sx-hub-team'); arr(cfg.team).forEach(function (m) { var r = h('span'); r.appendChild(faceEl(m.name, 'is-sm')); var tx = h('span'); tx.appendChild(h('b', null, m.name)); tx.appendChild(h('em', null, m.role)); r.appendChild(tx); tl.appendChild(r); }); tb.appendChild(tl); side.appendChild(tb); }
    var pb = h('section', 'sx-hub-box'); pb.appendChild(h('b', 'sx-side-h', 'Products'));
    arr(cfg.story.products).forEach(function (p) { var r = h('div', 'sx-hub-p'); if (p.img) { var im = h('img'); im.alt = ''; im.src = asset(p.img); r.appendChild(im); } else { var sw = h('i'); sw.style.background = p.color; r.appendChild(sw); } var tx = h('div'); tx.appendChild(h('b', null, p.name)); tx.appendChild(h('span', null, p.follow ? (end ? str(S.follow_end, 'Live') : str(S.follow_start, 'Idea in the inbox')) : p.status)); r.appendChild(tx); pb.appendChild(r); });
    side.appendChild(pb);
    g.appendChild(side); ov.appendChild(g);
    ui.stage.appendChild(ov); raf2(function () { ov.classList.add('is-on'); });
    go1.addEventListener('click', function () { unlock(); if (end) { /* the hub stays under the proposal: Back returns to it */ } else { ov.classList.add('is-out'); setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 500); } go(); });
    if (AUTO && !end) setTimeout(function () { go1.click(); }, 2600);
  }

  /* ---------- the Enter gate (deep links; otherwise the parcel tap is the gate) ---------- */
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
    arr(cfg.story.chapters).forEach(function (c) { arr(c.stops).forEach(function (st) { var s = typeof st === 'string' ? stageStop(st) : st; if (s) stops.push(s); }); });
    mods = arr(cfg.story.modules).length ? cfg.story.modules : DEFAULT_MODS.filter(function (m) { return stops.some(function (s) { return s.module === m.id; }); });
    var keep = opts && opts.keep && opts.keep.parentNode ? opts.keep : null;
    build(keep);
    addEventListener('keydown', onKey);
    preload(0); preload(1);
    var s0 = /[?&]step=(\d+)/.exec(location.search), first0 = s0 ? Math.max(0, Math.min(stops.length - 1, +s0[1] - 1)) : 0;
    maxSeen = first0;
    setAuto(AUTO);
    function start() { open(first0, 1); }
    if (opts && opts.from === 'parcel') {
      if (!MUTED) unlock();
      var note = null, slow = setTimeout(function () { if (keep) { note = h('span', 'sx-loading', 'Opening the board…'); keep.appendChild(note); } }, 1000);
      Promise.race([preload(0), new Promise(function (r) { setTimeout(r, 6000); })]).then(function () {
        clearTimeout(slow);
        if (keep) {
          keep.classList.add('is-handing');
          ui.stage.classList.remove('is-under'); ui.stage.classList.add('is-over');
          /* hide the parcel stage rather than drop it: freeing its WebGL scene mid-story caused second-long GC pauses */
          setTimeout(function () { keep.style.display = 'none'; keep.setAttribute('aria-hidden', 'true'); ui.stage.classList.remove('is-over'); if (opts.retire) opts.retire(); }, 700);
        }
        start();
      });
    }
    else if (cfg.story.setup && !s0) setupFlow(start);
    else if (AUTO && MUTED) start();
    else gate(start);
    if (!keep) { ui.stage.classList.add('is-arrive'); raf2(function () { ui.stage.classList.remove('is-arrive'); }); }
    window.__story = { open: open, next: next, stops: stops, get si() { return si; }, get state() { return state; }, choose: function (c) { if (ui.pick) ui.pick(c); } };
    return true;
  };
})();
