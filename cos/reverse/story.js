/* story.js: the landing as three chapters, told forward, one thing at a time.
   Used when the brand config has a `story` block; scroll.js hands the config over (window.cosStory(cfg)) and steps
   aside. Without `story`, scroll.js runs its own show as before.

   config.story = {
     title, line,                                   the cover
     chapters: [{ title, line, stops: [stop | stageId, ...] }]
   }
   stop = { id, when, title, scene: { img | img2 | voice{time,len} | doc{title,rows} | night }, cards: [card] }
   card = { k: 'msg' | 'cos' | 'ask' | 'done', who, via, where, at, text, voice, len, media, options, chosen, desc }
   A stop given as a stage id is built from config.stages (its scene from stage.object, its cards from stage.flow).

   Order on every stop: the scene comes in from the left and settles, then the title, then the cards one at a time
   (who's talking, what the chief of staff did, the tap, the result). Scroll moves one stop per screen (snap).
   Sound: off until the first tap; never with ?mute. */
(function () {
  'use strict';
  var Q = new URLSearchParams(location.search);
  var MUTED = Q.has('mute'), REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var AUTOPLAY = Q.has('autoplay');
  var cfg, steps = [], cur = -1, playToken = 0, stage, ui = {};

  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function str(v, d) { return (typeof v === 'string' && v.trim()) ? v.trim() : (d || ''); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function words(t) { return String(t || '').split(/\s+/).filter(Boolean).length; }
  function wait(ms, tok) { return new Promise(function (res, rej) { setTimeout(function () { tok === playToken ? res() : rej('stale'); }, ms); }); }

  /* ---------- sound: small synthesised cues, plus the voice clips ---------- */
  var AC = null, SOUND = false, NOW = null;
  function unlock() {
    if (MUTED || AC) return;
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); SOUND = true; setSoundBtn(); } catch (e) { AC = null; }
  }
  function tone(freq, t0, dur, vol, type, to) {
    var o = AC.createOscillator(), g = AC.createGain(), now = AC.currentTime + t0;
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, now);
    if (to) o.frequency.exponentialRampToValueAtTime(to, now + dur);
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(vol, now + .012); g.gain.exponentialRampToValueAtTime(.0001, now + dur);
    o.connect(g); g.connect(AC.destination); o.start(now); o.stop(now + dur + .05);
  }
  function sfx(kind) {
    if (!SOUND || !AC || MUTED) return;
    if (AC.state === 'suspended') AC.resume();
    if (kind === 'msg') { tone(1046, 0, .12, .05); tone(1568, .07, .16, .04); }            /* a message lands */
    else if (kind === 'card') { tone(660, 0, .09, .035, 'triangle'); }                     /* the chief's card */
    else if (kind === 'tap') { tone(1800, 0, .03, .05, 'square', 900); }                   /* a tap */
    else if (kind === 'done') { tone(784, 0, .14, .04); tone(1175, .09, .22, .04); }       /* the result */
    else if (kind === 'chapter') { tone(262, 0, 1.1, .05); tone(392, .06, 1.1, .04); tone(523, .12, 1.2, .03); }
    else if (kind === 'voice') { tone(520, 0, .07, .04, 'sine', 780); }                    /* a voice note starts */
    else if (kind === 'scene') { tone(180, 0, .35, .025, 'sine', 120); }                   /* the scene settles */
  }
  function clipUrl(v) {
    if (!v) return '';
    var A = cfg.audio || {};
    return A[v] || (/\.(mp3|m4a|ogg|wav)(\?|$)|^blob:|^data:/.test(v) ? v : '');
  }
  function stopVoice() { if (NOW) { try { NOW.a.pause(); } catch (e) { /* */ } NOW.el.classList.remove('is-playing'); NOW = null; } }
  function playVoice(url, el) {
    stopVoice();
    if (!url || !SOUND || MUTED) return null;
    var a = new Audio(url); a.volume = .9;
    NOW = { a: a, el: el }; el.classList.add('is-playing'); sfx('voice');
    var bar = el.querySelector('.vn-bars');
    a.addEventListener('timeupdate', function () { if (bar && a.duration) bar.style.setProperty('--p', (a.currentTime / a.duration).toFixed(3)); });
    a.addEventListener('ended', function () { el.classList.remove('is-playing'); if (bar) bar.style.setProperty('--p', 1); if (NOW && NOW.a === a) NOW = null; });
    var p = a.play(); if (p && p.catch) p.catch(function () { el.classList.remove('is-playing'); });
    return a;
  }
  function setSoundBtn() {
    if (!ui.sound) return;
    ui.sound.textContent = SOUND ? 'Sound on' : 'Sound off';
    ui.sound.setAttribute('aria-pressed', SOUND ? 'true' : 'false');
  }

  /* ---------- assets, faces ---------- */
  function asset(key) {
    if (!key) return '';
    var A = cfg.assets || {};
    if (A[key]) return A[key];
    if (/^(blob:|data:|https?:|\.|\/)|\.(webp|png|jpe?g)(\?|$)/.test(key)) return key;
    return 'assets/' + cfg.id + '/' + key + '.webp';
  }
  var FACES = {
    ohra: ['aditi', 'naina', 'arjun', 'tanvi', 'vikram', 'kavya', 'customer', 'agency'],
    ondri: ['kavya', 'meher', 'rohan', 'tara', 'zoya', 'ira', 'customer', 'agency'],
    siro: ['nikhil', 'pooja', 'farhan', 'leela', 'varun', 'meera', 'customer', 'agency']
  };
  function isCustomer(w) { return /customer|,/i.test(w); }
  function isAgency(w) { return /studio|agency/i.test(w); }
  function personName(w) { return isCustomer(w) ? (w.replace(/^Customer,?\s*/i, '') ? 'Customer, ' + w.replace(/^Customer,?\s*/i, '') : 'Customer') : w; }
  function faceSrc(who) {
    var w = str(who), F = cfg.faces || {};
    var keys = [w, w.split(/\s+/)[0], w.toLowerCase().split(/\s+/)[0], isCustomer(w) ? 'customer' : isAgency(w) ? 'agency' : ''];
    for (var i = 0; i < keys.length; i++) if (keys[i] && typeof F[keys[i]] === 'string' && F[keys[i]]) return F[keys[i]];
    var s = isCustomer(w) ? 'customer' : isAgency(w) ? 'agency' : w.toLowerCase().split(/\s+/)[0];
    return (FACES[cfg.id] || []).indexOf(s) >= 0 ? 'faces/' + cfg.id + '-' + s + '.webp' : '';
  }
  function faceEl(who) {
    var el = h('span', 'sx-face'), src = faceSrc(who);
    if (src) { var im = h('img'); im.alt = ''; im.decoding = 'async'; im.src = src; el.appendChild(im); }
    else el.textContent = str(who, '?').replace(/^GG.*/, 'GG').charAt(0) === 'G' && /^GG/.test(str(who)) ? 'GG' : str(who, '?').charAt(0);
    return el;
  }
  function markEl() { return h('span', 'sx-face sx-mark', 'CS'); }

  /* ---------- building stops from the older stage schema (public brands) ---------- */
  function stageStop(id) {
    var st = arr(cfg.stages).filter(function (s) { return s.id === id; })[0];
    if (!st) return null;
    var fl = arr(st.flow), A = cfg.audio || {}, cards = [];
    var mi = -1;
    fl.forEach(function (b, i) { if (mi < 0 && b.who && (b.t === 'raised' || b.t === 'q')) mi = i; });
    if (mi >= 0) {
      var b = fl[mi], v = id === 'voice' ? 'voice-note' : A[id + '-' + (mi + 1)] ? id + '-' + (mi + 1) : b.t === 'q' && A[id + '-q'] ? id + '-q' : A[id + '-agency'] && isAgency(b.who) ? id + '-agency' : '';
      cards.push({ k: 'msg', who: b.who, via: b.via, where: b.where, at: b.at, text: id === 'voice' && cfg.voice ? cfg.voice.words : b.text,
        voice: v, len: (b.media && b.media.type === 'voice' && b.media.len) || (id === 'voice' && cfg.voice ? cfg.voice.length : '') });
      if (b.t === 'q' && b.answer) cards.push({ k: 'cos', text: b.answer });
    } else if (fl[0]) cards.push({ k: 'cos', text: fl[0].text, desc: fl[0].desc, media: fl[0].media });
    var c = fl.filter(function (b, i) { return i > mi && (b.t === 'assign' || b.t === 'auto'); })[0];
    if (c && cards.length < 2) cards.push({ k: 'cos', text: c.text, desc: c.desc || c.caught, media: c.media });
    var ask = fl.filter(function (b) { return b.t === 'ask'; })[0];
    if (ask) cards.push({ k: 'ask', who: ask.who, text: ask.text, options: ask.options, chosen: 0 });
    var dn = fl.filter(function (b) { return b.t === 'done'; }).pop() || fl.filter(function (b) { return b.t === 'auto'; }).pop();
    if (dn && cards.length < 4 && cards.indexOf(c) < 0) cards.push({ k: 'done', text: dn.text, desc: dn.desc });
    else if (dn && cards.length < 4) cards.push({ k: 'done', text: dn.text, desc: dn.desc });
    var obj = st.object === 'phone' ? null : st.object === 'wireframe' ? 'wireframe_ink' : st.object;
    var scene = id === 'voice' ? { voice: { time: (cfg.voice || {}).time, len: (cfg.voice || {}).length, who: (cfg.voice || {}).who } }
      : obj ? { img: obj } : { img: 'hero' };
    if (st.night) scene.night = true;
    return { id: id, when: st.when, title: st.summary, scene: scene, cards: cards.slice(0, 4) };
  }

  /* ---------- the stage ---------- */
  function build() {
    document.documentElement.classList.add('is-story');
    var app = document.getElementById('app'), track = document.getElementById('track');
    track.innerHTML = ''; track.className = 'sx-track';
    stage = h('div', 'sx-stage'); track.appendChild(stage);

    var top = h('div', 'sx-top');
    top.appendChild(h('b', 'sx-brand', str((cfg.brand || {}).name, 'Chief of Staff')));
    ui.prog = h('div', 'sx-prog'); top.appendChild(ui.prog);
    if (!MUTED) {
      ui.sound = h('button', 'sx-sound'); ui.sound.type = 'button';
      ui.sound.addEventListener('click', function (e) { e.stopPropagation(); if (!AC) { unlock(); } else { SOUND = !SOUND; if (!SOUND) stopVoice(); } setSoundBtn(); });
      top.appendChild(ui.sound); setSoundBtn();
    }
    stage.appendChild(top);

    ui.scene = h('div', 'sx-scene'); stage.appendChild(ui.scene);
    ui.side = h('div', 'sx-side');
    ui.head = h('div', 'sx-head'); ui.side.appendChild(ui.head);
    ui.cards = h('div', 'sx-cards'); ui.side.appendChild(ui.cards);
    stage.appendChild(ui.side);
    ui.full = h('div', 'sx-full'); stage.appendChild(ui.full);
    ui.next = h('button', 'sx-next', 'Next'); ui.next.type = 'button';
    ui.next.addEventListener('click', function () { go(cur + 1); });
    stage.appendChild(ui.next);

    /* one snap anchor per step */
    steps.forEach(function (s, i) { var a = h('i', 'sx-snap'); a.style.top = (i * 100) + 'svh'; track.appendChild(a); });
    track.style.height = (steps.length * 100) + 'svh';

    /* progress: three chapters, a dot per stop */
    cfg.story.chapters.forEach(function (ch, ci) {
      var seg = h('div', 'sx-seg'); seg.dataset.ch = ci;
      seg.appendChild(h('span', 'sx-seg-name', ch.title));
      var dots = h('span', 'sx-dots');
      steps.forEach(function (s, i) { if (s.ch === ci && s.type === 'stop') { var d = h('i'); d.dataset.i = i; dots.appendChild(d); } });
      seg.appendChild(dots);
      seg.addEventListener('click', function () { go(steps.findIndex(function (s) { return s.ch === ci; })); });
      ui.prog.appendChild(seg);
    });
    if (window.renderEnding) window.renderEnding(cfg, document.getElementById('end'));
  }

  function stepList() {
    var S = cfg.story;
    steps.push({ type: 'cover' });
    arr(S.chapters).forEach(function (ch, ci) {
      steps.push({ type: 'chapter', ch: ci });
      arr(ch.stops).forEach(function (st) {
        var stop = typeof st === 'string' ? stageStop(st) : st;
        if (stop) steps.push({ type: 'stop', ch: ci, stop: stop });
      });
    });
  }

  /* ---------- scenes ---------- */
  function sceneEl(sc, stop) {
    var el = h('div', 'sx-plate' + (sc.night ? ' is-night' : '') + (sc.voice ? ' is-night is-voice' : ''));
    if (sc.voice) {
      var v = sc.voice, box = h('div', 'sx-vn');
      box.appendChild(h('div', 'sx-vn-time', str(v.time)));
      var wv = h('div', 'sx-vn-wave');
      for (var i = 0; i < 48; i++) { var b = h('i'); b.style.setProperty('--h', (18 + Math.round(70 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * .45)))) + '%'); b.style.setProperty('--d', (i * 18) + 'ms'); wv.appendChild(b); }
      box.appendChild(wv);
      box.appendChild(h('div', 'sx-vn-cap', str(v.who) + (v.len ? ', voice note, ' + v.len : ', voice note')));
      el.appendChild(box);
    } else if (sc.doc) {
      var d = h('div', 'sx-doc'); d.appendChild(h('b', 'sx-doc-title', str(sc.doc.title)));
      if (sc.doc.sub) d.appendChild(h('span', 'sx-doc-sub', sc.doc.sub));
      var tb = h('dl', 'sx-doc-rows');
      arr(sc.doc.rows).forEach(function (r) { tb.appendChild(h('dt', null, r[0])); tb.appendChild(h('dd', null, r[1])); });
      d.appendChild(tb);
      el.appendChild(d);
      if (sc.img) { var di = h('img', 'sx-doc-img'); di.alt = ''; di.src = asset(sc.img); el.appendChild(di); el.classList.add('has-doc-img'); }
    } else {
      var wrap = h('div', 'sx-objs' + (sc.img2 ? ' is-pair' : ''));
      [sc.img, sc.img2].forEach(function (k, i) {
        if (!k) return;
        var im = h('img', 'sx-obj' + (i ? ' sx-obj-2' : '')); im.alt = ''; im.decoding = 'async'; im.src = asset(k);
        if (sc.fit) im.style.setProperty('--fit', sc.fit);
        wrap.appendChild(im);
      });
      el.appendChild(wrap);
      if (sc.label) el.appendChild(h('span', 'sx-label', sc.label));
    }
    return el;
  }

  /* ---------- cards ---------- */
  var VIA = { whatsapp: 'WhatsApp', email: 'Email', meeting: 'Meeting', call: 'Call', dm: 'Instagram DM', app: '' };
  function waveEl(n) {
    var w = h('span', 'vn-bars');
    for (var i = 0; i < (n || 28); i++) { var b = h('i'); b.style.setProperty('--h', (25 + Math.round(70 * Math.abs(Math.sin(i * 2.3 + 1) * Math.cos(i * .7)))) + '%'); w.appendChild(b); }
    return w;
  }
  function mediaEl(m) {
    if (!m || !m.type) return null;
    var el = h('div', 'sx-media sx-m-' + m.type);
    if (m.type === 'chart') {
      var max = Math.max.apply(null, arr(m.values).map(Number)) || 1;
      arr(m.values).forEach(function (v, i) {
        var row = h('div', 'sx-bar' + (i === (m.hi || 0) ? ' is-hi' : ''));
        row.appendChild(h('span', 'sx-bar-l', str(arr(m.labels)[i])));
        var tr = h('span', 'sx-bar-t'); var f = h('i'); f.style.setProperty('--w', (100 * Number(v) / max).toFixed(1) + '%'); tr.appendChild(f); row.appendChild(tr);
        row.appendChild(h('span', 'sx-bar-v', String(v) + (m.unit && m.unit.length <= 2 ? m.unit : '')));
        el.appendChild(row);
      });
      if (m.unit && m.unit.length > 2) el.appendChild(h('span', 'sx-media-note', m.unit));
    } else if (m.type === 'swatch') {
      var sw = h('div', 'sx-sw'); arr(m.colors).forEach(function (c) { var i = h('i'); i.style.background = c; sw.appendChild(i); });
      el.appendChild(sw); if (m.label) el.appendChild(h('span', 'sx-media-note', m.label));
    } else if (m.type === 'doc' || m.type === 'link') {
      el.appendChild(h('b', null, str(m.name || m.title))); if (m.note) el.appendChild(h('span', 'sx-media-note', m.note));
    } else if (m.type === 'photo') {
      var im = h('img'); im.alt = ''; im.src = asset(m.kit || m.src); el.appendChild(im);
    } else return null;
    return el;
  }
  function cardEl(c, stop) {
    var k = c.k || 'cos', el = h('div', 'sx-card sx-' + k);
    if (k === 'msg') {
      var hd = h('div', 'sx-card-hd'); hd.appendChild(faceEl(c.who));
      var nm = h('div', 'sx-who'); nm.appendChild(h('b', null, personName(str(c.who))));
      var meta = [Object.prototype.hasOwnProperty.call(VIA, c.via) ? VIA[c.via] : c.via, c.where, c.at].filter(Boolean).join(' · ');
      if (meta) nm.appendChild(h('span', null, meta));
      hd.appendChild(nm); el.appendChild(hd);
      var url = clipUrl(c.voice);
      if (url || c.len) {
        var vn = h('button', 'sx-vn-bubble'); vn.type = 'button'; vn.setAttribute('aria-label', 'Play ' + personName(str(c.who)) + '’s voice note');
        vn.appendChild(h('span', 'vn-play'));
        vn.appendChild(waveEl(30));
        vn.appendChild(h('span', 'vn-len', str(c.len, '0:0' + Math.min(9, 2 + Math.round(words(c.text) / 3)))));
        vn.addEventListener('click', function (e) { e.stopPropagation(); unlock(); if (NOW && NOW.el === vn) stopVoice(); else playVoice(url, vn); });
        el.appendChild(vn); el._voice = { url: url, btn: vn };
        el.appendChild(h('p', 'sx-tr', c.text));
      } else el.appendChild(h('p', 'sx-text', c.text));
    } else if (k === 'cos') {
      var hd2 = h('div', 'sx-card-hd'); hd2.appendChild(markEl());
      var nm2 = h('div', 'sx-who'); nm2.appendChild(h('b', null, 'Chief of staff'));
      if (c.desc) nm2.appendChild(h('span', null, c.desc));
      hd2.appendChild(nm2); el.appendChild(hd2);
      el.appendChild(h('p', 'sx-text', c.text));
    } else if (k === 'ask') {
      var who = str(c.who).split(/\s+/)[0] || 'Someone';
      var hd3 = h('div', 'sx-card-hd'); hd3.appendChild(markEl());
      var nm3 = h('div', 'sx-who'); nm3.appendChild(h('b', null, 'Chief of staff asks ' + who)); hd3.appendChild(nm3); el.appendChild(hd3);
      el.appendChild(h('p', 'sx-text', c.text));
      var ops = h('div', 'sx-opts');
      arr(c.options).forEach(function (o, i) { var b = h('span', 'sx-opt', typeof o === 'string' ? o : o.label); b.dataset.i = i; ops.appendChild(b); });
      el.appendChild(ops);
      el.appendChild(h('span', 'sx-tapped', who + ' tapped ' + (function () { var o = arr(c.options)[c.chosen || 0]; return '“' + (typeof o === 'string' ? o : (o && o.label) || 'yes') + '”'; })()));
    } else if (k === 'note') {
      el.appendChild(h('p', 'sx-text', c.text));
      if (c.desc) el.appendChild(h('span', 'sx-note-d', c.desc));
    } else {
      el.appendChild(h('span', 'sx-tick'));
      var tx = h('div', 'sx-done-tx'); tx.appendChild(h('p', 'sx-text', c.text)); if (c.desc) tx.appendChild(h('span', null, c.desc));
      el.appendChild(tx);
    }
    var md = mediaEl(c.media); if (md) el.appendChild(md);
    /* a folded card opens on tap (the others fold instead), so an earlier voice note can be played again */
    el.addEventListener('click', function () {
      if (!el.classList.contains('is-mini')) return;
      Array.prototype.forEach.call(ui.cards.children, function (k) { if (k !== el) k.classList.add('is-mini'); });
      el.classList.remove('is-mini');
    });
    return el;
  }
  /* keep the stack inside its column: the oldest cards fold to one line when room runs out */
  function fit() {
    var box = ui.cards, room = box.clientHeight, list = box.children, i = 0;
    for (var j = 0; j < list.length; j++) list[j].classList.remove('is-mini');
    while (box.scrollHeight > room + 1 && i < list.length - 1) { list[i].classList.add('is-mini'); i++; }
    /* give back room: unfold the newest folded card while everything still fits */
    for (var u = i - 1; u >= 0; u--) {
      list[u].classList.remove('is-mini');
      if (box.scrollHeight > room + 1) { list[u].classList.add('is-mini'); break; }
    }
  }
  function dwell(c) {
    var n = words(c.text) + (c.media ? 6 : 0);
    return Math.min(4200, 1100 + n * 150) + (c.k === 'ask' ? 1400 : 0);
  }

  /* ---------- playing a step ---------- */
  function setProgress(i) {
    var s = steps[i] || {};
    Array.prototype.forEach.call(ui.prog.children, function (seg) {
      var ci = +seg.dataset.ch; seg.classList.toggle('is-on', ci === s.ch); seg.classList.toggle('is-past', s.ch != null && ci < s.ch);
      Array.prototype.forEach.call(seg.querySelectorAll('i'), function (d) { var di = +d.dataset.i; d.classList.toggle('is-on', di === i); d.classList.toggle('is-past', di < i); });
    });
    stage.classList.toggle('is-cover', s.type === 'cover');
  }
  function clear(dir) {
    stopVoice();
    var olds = [ui.scene.firstChild, ui.full.firstChild].filter(Boolean);
    olds.forEach(function (o) { o.classList.add(dir < 0 ? 'is-out-back' : 'is-out'); setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, 420); });
    ['head', 'cards'].forEach(function (k) {
      var n = ui[k]; Array.prototype.forEach.call(n.children, function (c) { c.classList.add('is-gone'); });
      setTimeout(function (snap) { snap.forEach(function (c) { if (c.parentNode) c.parentNode.removeChild(c); }); }, 300, Array.prototype.slice.call(n.children));
    });
    stage.classList.remove('has-stop', 'is-done');
  }
  function show(i) {
    var dir = i >= cur ? 1 : -1, fast = dir < 0 || REDUCED;
    var tok = ++playToken; cur = i; setProgress(i); clear(dir);
    var s = steps[i]; if (!s) return;
    if (s.type === 'cover' || s.type === 'chapter') return showFull(s, tok);
    stage.classList.add('has-stop');
    var stop = s.stop, sc = sceneEl(stop.scene || {}, stop);
    sc.classList.add(dir < 0 ? 'is-in-back' : 'is-in');
    wait(fast ? 80 : 360, tok).then(function () {
      ui.scene.appendChild(sc);
      requestAnimationFrame(function () { requestAnimationFrame(function () { sc.classList.remove('is-in', 'is-in-back'); }); });
      return wait(fast ? 250 : 750, tok);
    }).then(function () {
      sfx('scene');
      var hd = h('div', 'sx-headin');
      if (stop.when) hd.appendChild(h('span', 'sx-when', stop.when));
      hd.appendChild(h('h2', 'sx-title', str(stop.title)));
      ui.head.appendChild(hd);
      return wait(fast ? 150 : 900, tok);
    }).then(function () {
      var cs = arr(stop.cards), k = 0;
      function next() {
        if (tok !== playToken) return;
        if (k >= cs.length) { stage.classList.add('is-done'); if (AUTOPLAY) wait(2200, tok).then(function () { go(cur + 1); }, function () {}); return; }
        var c = cs[k++], el = cardEl(c, stop);
        ui.cards.appendChild(el); fit();
        sfx(c.k === 'msg' ? 'msg' : c.k === 'done' ? 'done' : 'card');
        var d = fast ? 260 : dwell(c);
        if (c.k === 'ask' && !fast) {
          setTimeout(function () { if (tok !== playToken) return; var o = el.querySelector('.sx-opt[data-i="' + (c.chosen || 0) + '"]'); if (o) o.classList.add('is-chosen'); el.classList.add('is-answered'); sfx('tap'); }, 1500);
        } else if (c.k === 'ask') { var o2 = el.querySelector('.sx-opt[data-i="' + (c.chosen || 0) + '"]'); if (o2) o2.classList.add('is-chosen'); el.classList.add('is-answered'); }
        if (el._voice && !fast) {
          var a = playVoice(el._voice.url, el._voice.btn);
          if (a) {
            var t0 = performance.now(), done = false;
            var fin = function () { if (done) return; done = true; var spent = performance.now() - t0; setTimeout(next, Math.max(500, d - spent)); };
            a.addEventListener('ended', fin); a.addEventListener('error', fin); setTimeout(fin, 16000);
            return;
          }
        }
        setTimeout(next, d);
      }
      next();
    }).catch(function () {});
  }
  function showFull(s, tok) {
    var el;
    if (s.type === 'cover') {
      el = h('div', 'sx-cover');
      el.appendChild(h('h1', 'sx-cover-t', str(cfg.story.title)));
      if (cfg.story.line) el.appendChild(h('p', 'sx-cover-l', cfg.story.line));
      var ol = h('ol', 'sx-toc');
      cfg.story.chapters.forEach(function (ch) { ol.appendChild(h('li', null, ch.title)); });
      el.appendChild(ol);
      el.appendChild(h('span', 'sx-cue', 'Scroll'));
    } else {
      var ch = cfg.story.chapters[s.ch];
      el = h('div', 'sx-chap');
      el.appendChild(h('span', 'sx-chap-n', String(s.ch + 1)));
      el.appendChild(h('h2', 'sx-chap-t', ch.title));
      if (ch.line) el.appendChild(h('p', 'sx-chap-l', ch.line));
    }
    el.classList.add('is-in');
    wait(REDUCED ? 60 : 360, tok).then(function () {
      ui.full.appendChild(el);
      requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.remove('is-in'); }); });
      if (s.type === 'chapter') sfx('chapter');
      return wait(1400, tok);
    }).then(function () { stage.classList.add('is-done'); if (AUTOPLAY) return wait(1600, tok).then(function () { go(cur + 1); }); }).catch(function () {});
  }

  /* ---------- scroll: one step per screen ---------- */
  function VH() { return stage.offsetHeight || innerHeight; }
  function indexAt() { return Math.max(0, Math.min(steps.length - 1, Math.round(scrollY / VH()))); }
  var T = 0;
  function onScroll() {
    var trackEnd = (steps.length - 1) * VH();
    stage.classList.toggle('is-past-end', scrollY > trackEnd + 40);
    document.documentElement.classList.toggle('is-story-past', scrollY > trackEnd + 40);
    clearTimeout(T); T = setTimeout(function () { var i = indexAt(); if (scrollY <= trackEnd + VH() * .5 && i !== cur) show(i); }, 140);
  }
  function go(i) {
    if (i >= steps.length) { var end = document.getElementById('end'); if (end) end.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' }); return; }
    i = Math.max(0, i);
    scrollTo({ top: i * VH(), behavior: REDUCED ? 'auto' : 'smooth' });
  }
  function onKey(e) {
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    if (scrollY > (steps.length - 1) * VH() + 40) return;
    if (/^(ArrowDown|PageDown|ArrowRight)$/.test(e.key) || (e.key === ' ' && !e.shiftKey)) { e.preventDefault(); go(cur + 1); }
    else if (/^(ArrowUp|PageUp|ArrowLeft)$/.test(e.key) || (e.key === ' ' && e.shiftKey)) { e.preventDefault(); go(cur - 1); }
  }

  window.cosStory = function (raw) {
    cfg = raw || {};
    if (!cfg.story || !arr(cfg.story.chapters).length) return false;
    document.title = str((cfg.page || {}).title, 'Chief of Staff: ' + str((cfg.brand || {}).name));
    stepList(); build();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', function () { fit(); });
    addEventListener('keydown', onKey);
    ['pointerdown', 'keydown', 'touchend'].forEach(function (ev) { addEventListener(ev, function f() { unlock(); removeEventListener(ev, f); }, { passive: true }); });
    var s0 = /[?&]step=(\d+)/.exec(location.search);
    if (s0) { scrollTo(0, +s0[1] * VH()); show(+s0[1]); } else show(indexAt());
    window.__story = { go: go, show: show, steps: steps, get cur() { return cur; } };
    return true;
  };
})();
