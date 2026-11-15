/* sb-offer.js: the Coco offer, after the story. One scrolling sheet in three parts:
     Scope    how it runs: inputs -> the Chief of staff and its agents -> modules, then the people
     Pricing  three blocks (the subscription featured in the accent), the first quarter, included / not,
              your data, running costs
     Start    I'm interested: a start date (closed days off), the live timeline it gives, a prefilled email
   Everything comes from config (cfg.offer, cfg.story.modules, cfg.team, cfg.faces, cfg.brand); no names live here.
   API: window.cocoOffer(cfg, host, { onClose }) renders into host and returns { close }. */
(function () {
  'use strict';
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function str(v, d) { return (typeof v === 'string' && v.trim()) ? v.trim() : (d || ''); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function svg(d, size) {
    var s = size || 18;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  }
  function icon(d, cls, size) { var s = h('span', cls); s.innerHTML = svg(d, size); return s; }
  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* line icons, drawn here: inputs by name, modules by id */
  var IN_ICON = {
    whatsapp: '<path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/><path d="M9 9.5c.4 2.2 2.3 4.1 4.5 4.5l1.2-1.2 2 1-.6 1.6c-3.6.2-7.7-3.9-7.5-7.5L10.2 7.4l1 2z"/>',
    email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
    meetings: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10.5l5-3v9l-5-3"/>',
    instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="3.8"/><path d="M17 7h.01"/>',
    shopify: '<path d="M5 8h14l-1.2 12H6.2z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
    marketplaces: '<path d="M4 9.5L5.5 4h13L20 9.5"/><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5.5 12v8h13v-8"/>'
  };
  var MOD_ICON = {
    ideas: '<path d="M9 18h6M10 21h4"/><path d="M8.5 14.5A6 6 0 1 1 15.5 14.5c-.8.7-1.2 1.5-1.3 2.5h-4.4c-.1-1-.5-1.8-1.3-2.5z"/>',
    npd: '<path d="M10 3h4M10.5 3v6L5 19a1.4 1.4 0 0 0 1.2 2h11.6a1.4 1.4 0 0 0 1.2-2l-5.5-10V3"/><path d="M7.5 15h9"/>',
    logistics: '<path d="M3 6h11v10H3z"/><path d="M14 9.5h4l3 3.5v3h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/>',
    warehouse: '<path d="M3 20V9l9-5 9 5v11"/><path d="M7 20v-7h10v7M7 16.5h10"/>',
    listing: '<rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 8.5h8M8 12h8M8 15.5h5"/>',
    marketing: '<path d="M4 10v4h3l7 4.5v-13L7 10z"/><path d="M17.5 9.5a3.5 3.5 0 0 1 0 5"/>',
    crm: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>'
  };
  var LOCK = '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><path d="M12 14.5v2.5"/>';

  /* money: '₹90,000' -> 90000, and back with Indian grouping */
  function num(s) { var n = parseInt(String(s || '').replace(/[^\d]/g, ''), 10); return isNaN(n) ? 0 : n; }
  function inr(n) { return '₹' + Math.round(n).toLocaleString('en-IN'); }

  window.cocoOffer = function (cfg, host, opts) {
    cfg = cfg || {}; opts = opts || {};
    var O = cfg.offer; if (!O || !host) return null;
    var S = O.scope || {}, C = O.calc || {}, I = O.interested || {}, R = O.running || {};
    var brand = str((cfg.brand || {}).name), TX = str(O.tax, '+ GST');
    var mods = arr((cfg.story || {}).modules);
    var F = cfg.faces || {};

    function face(name, cls) {
      var f = h('span', 'sbo-face' + (cls ? ' ' + cls : '')); f.title = name;
      var first = String(name || '').split(/\s+/)[0], src = F[name] || F[first];
      if (/^chief of staff$/i.test(name)) { f.classList.add('is-mark'); f.textContent = 'C'; return f; }
      if (src) { var im = h('img'); im.alt = ''; im.decoding = 'async'; im.src = src; f.appendChild(im); }
      else f.textContent = String(name || '?').charAt(0);
      return f;
    }
    function taxEl(on) { return on ? h('span', 'sbo-tax', TX) : document.createTextNode(''); }

    var root = h('div', 'sbo'); root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', str(O.title, 'Scope and pricing'));
    var page = h('div', 'sbo-page'); root.appendChild(page);

    /* ---------- top: wordmark, close ---------- */
    var top = h('div', 'sbo-top');
    var wm = h('div', 'sbo-wm'); wm.appendChild(h('b', null, 'Coco')); if (brand) wm.appendChild(h('span', null, 'for ' + brand)); top.appendChild(wm);
    var x = h('button', 'sbo-x'); x.type = 'button'; x.setAttribute('aria-label', 'Back to the story'); top.appendChild(x);
    page.appendChild(top);

    /* ---------- 1. scope ---------- */
    var sc = h('section', 'sbo-sec sbo-scope');
    sc.appendChild(h('h1', 'sbo-h1', str(O.title)));
    var lead = str(O.lead);
    if (lead) sc.appendChild(h('p', 'sbo-lead', lead));

    var map = h('div', 'sbo-map');
    /* inputs */
    var cin = h('div', 'sbo-col sbo-in');
    cin.appendChild(h('h3', 'sbo-col-h', 'Picks work up from'));
    var inl = h('ul', 'sbo-rows');
    arr(S.inputs).forEach(function (n) { var li = h('li'); li.appendChild(icon(IN_ICON[String(n).toLowerCase()] || '<circle cx="12" cy="12" r="3"/>', 'sbo-ic')); li.appendChild(h('span', null, n)); inl.appendChild(li); });
    cin.appendChild(inl); map.appendChild(cin);
    map.appendChild(h('span', 'sbo-link', null));
    /* the Chief of staff and its agents */
    var lead_agent = str(S.lead_agent, 'Chief of staff');
    var cos = h('div', 'sbo-col sbo-cos');
    var ch = h('div', 'sbo-cos-hd'); ch.appendChild(h('span', 'sbo-cos-mk', 'C')); var cht = h('div'); cht.appendChild(h('b', null, lead_agent)); cht.appendChild(h('span', null, 'Leads ' + arr(S.agents).filter(function (a) { return a !== lead_agent; }).length + ' agents')); ch.appendChild(cht); cos.appendChild(ch);
    var agl = h('ul', 'sbo-agents');
    arr(S.agents).filter(function (a) { return a !== lead_agent; }).forEach(function (a) { var li = h('li'); li.appendChild(h('span', 'sbo-ag-mk', a.charAt(0))); li.appendChild(h('span', null, a.replace(/\s+agent$/i, ''))); agl.appendChild(li); });
    cos.appendChild(agl); map.appendChild(cos);
    map.appendChild(h('span', 'sbo-link', null));
    /* modules */
    var cm = h('div', 'sbo-col sbo-mods');
    cm.appendChild(h('h3', 'sbo-col-h', mods.length + ' modules'));
    var ml = h('ul', 'sbo-rows is-mods');
    mods.forEach(function (m) {
      var li = h('li'); li.appendChild(icon(MOD_ICON[m.id] || '<rect x="5" y="5" width="14" height="14" rx="2"/>', 'sbo-ic'));
      var t = h('div', 'sbo-mod-t'); t.appendChild(h('b', null, m.name)); if (m.about) t.appendChild(h('span', null, m.about)); li.appendChild(t);
      var fs = h('span', 'sbo-faces'); arr(m.owners).filter(function (o) { return !/^chief of staff$/i.test(o); }).slice(0, 3).forEach(function (o) { fs.appendChild(face(o, 'is-xs')); }); li.appendChild(fs);
      ml.appendChild(li);
    });
    cm.appendChild(ml); map.appendChild(cm);
    sc.appendChild(map);

    /* people */
    var team = arr(cfg.team);
    if (team.length) {
      var pp = h('div', 'sbo-people');
      var ph = h('div', 'sbo-people-hd'); ph.appendChild(h('h3', 'sbo-h3', 'Your team')); if (S.people_note) ph.appendChild(h('p', null, S.people_note)); pp.appendChild(ph);
      var pl = h('ul', 'sbo-team');
      team.forEach(function (m) { var li = h('li'); li.appendChild(face(m.name)); var t = h('div'); t.appendChild(h('b', null, m.name)); t.appendChild(h('span', null, m.role)); li.appendChild(t); pl.appendChild(li); });
      pp.appendChild(pl); sc.appendChild(pp);
    }
    page.appendChild(sc);

    /* ---------- 2. pricing ---------- */
    var pr = h('section', 'sbo-sec sbo-pricing');
    var prh = h('div', 'sbo-sec-hd'); prh.appendChild(h('h2', 'sbo-h2', 'Pricing')); pr.appendChild(prh);
    var prices = arr(O.prices), feat = -1;
    prices.forEach(function (p, k) { if (p.featured || (feat < 0 && /subscription/i.test(p.item))) feat = k; });
    if (feat < 0 && prices.length === 3) feat = 1;
    var pg = h('div', 'sbo-prices is-' + prices.length + (O.choose ? ' is-choose' : '')), pick = feat < 0 ? 0 : feat, cards = [];
    prices.forEach(function (p, k) {
      var c = h('div', 'sbo-price' + (k === feat ? ' is-feat' : ''));
      c.appendChild(h('b', 'sbo-price-item', p.item));
      var v = h('p', 'sbo-price-v'); v.appendChild(h('span', 'sbo-price-n', p.now)); v.appendChild(taxEl(p.tax)); c.appendChild(v);
      if (p.unit) c.appendChild(h('p', 'sbo-price-u', p.unit));
      if (p.note) c.appendChild(h('p', 'sbo-price-note', p.note));
      if (arr(p.points).length) { var pl = h('ul', 'sbo-price-pts'); p.points.forEach(function (t) { pl.appendChild(h('li', null, t)); }); c.appendChild(pl); }
      if (O.choose) { c.tabIndex = 0; c.setAttribute('role', 'button'); c.setAttribute('aria-pressed', k === pick ? 'true' : 'false'); var choose = function () { pick = k; cards.forEach(function (x, j) { x.classList.toggle('is-feat', j === k); x.setAttribute('aria-pressed', j === k ? 'true' : 'false'); }); if (typeof refresh === 'function') refresh(false); }; c.addEventListener('click', choose); c.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } }); }
      cards.push(c); pg.appendChild(c);
    });
    pr.appendChild(pg);

    /* the first quarter, worked out from the fees */
    var fSet = num(C.setup_fee), fQ = num(C.quarter_fee), fT = num(C.training_fee), tm = C.training_months || 3;
    if (fSet && fQ) {
      var q = h('div', 'sbo-q1');
      q.appendChild(h('b', 'sbo-q1-k', 'Your first quarter'));
      var sum = h('p', 'sbo-q1-sum');
      var parts = [[inr(fSet), 'setup'], [inr(fQ), 'subscription']]; if (fT) parts.push([inr(fT * tm), 'training']);
      parts.forEach(function (pt, k) { if (k) sum.appendChild(h('span', 'sbo-op', '+')); var s = h('span', 'sbo-q1-p'); s.appendChild(h('b', null, pt[0])); s.appendChild(h('em', null, pt[1])); sum.appendChild(s); });
      q.appendChild(sum);
      var tot = h('p', 'sbo-q1-tot'); tot.appendChild(h('b', null, inr(fSet + fQ + fT * tm))); tot.appendChild(h('span', 'sbo-tax', TX)); q.appendChild(tot);
      pr.appendChild(q);
    }

    /* included and not */
    if (arr(O.compare).length) {
      var cmp = h('div', 'sbo-cmp');
      O.compare.forEach(function (c, n) {
        var col = h('div', 'sbo-cmp-col' + (n ? ' is-not' : ' is-in')); col.appendChild(h('h3', 'sbo-h3', c.title));
        var ul = h('ul'); arr(c.items).forEach(function (it) { var li = h('li'); li.appendChild(h('span', n ? 'sbo-dash' : 'sbo-tick')); li.appendChild(h('span', null, it)); ul.appendChild(li); });
        col.appendChild(ul); cmp.appendChild(col);
      });
      pr.appendChild(cmp);
    }

    /* data and running costs, side by side */
    var duo = h('div', 'sbo-duo');
    if (O.data) {
      var dt = h('div', 'sbo-data'); dt.appendChild(icon(LOCK, 'sbo-lock', 28));
      dt.appendChild(h('h3', 'sbo-h3', O.data.title)); dt.appendChild(h('p', null, O.data.text)); duo.appendChild(dt);
    }
    if (arr(R.rows).length) {
      var rc = h('div', 'sbo-run');
      rc.appendChild(h('h3', 'sbo-h3', str(R.title, 'Running costs'))); if (R.note) rc.appendChild(h('p', 'sbo-run-note', R.note));
      var tb = h('table'); var tbd = h('tbody');
      R.rows.forEach(function (r) { var tr = h('tr'); tr.appendChild(h('th', null, r[0])); tr.appendChild(h('td', null, r[1])); tbd.appendChild(tr); });
      if (R.total) { var tr2 = h('tr', 'is-tot'); var th = h('th', null, R.total[0]); if (R.unit) th.appendChild(h('span', null, R.unit)); tr2.appendChild(th); tr2.appendChild(h('td', null, R.total[1])); tbd.appendChild(tr2); }
      tb.appendChild(tbd); rc.appendChild(tb); duo.appendChild(rc);
    }
    if (duo.children.length) pr.appendChild(duo);

    var cta = h('div', 'sbo-cta');
    var go = h('button', 'sbo-btn', str(I.cta, 'I’m interested')); go.type = 'button'; cta.appendChild(go);
    var back = h('button', 'sbo-link-btn', 'Back to the story'); back.type = 'button'; cta.appendChild(back);
    pr.appendChild(cta);
    page.appendChild(pr);

    /* ---------- 3. start ---------- */
    var st = h('section', 'sbo-sec sbo-start'); st.hidden = true;
    st.appendChild(h('h2', 'sbo-h2', str(I.heading, 'Let’s start')));
    if (arr(I.next).length) { var nx = h('ol', 'sbo-next'); I.next.forEach(function (t, k) { var li = h('li'); li.appendChild(h('span', 'sbo-next-n', String(k + 1))); li.appendChild(h('span', null, t)); nx.appendChild(li); }); st.appendChild(nx); }
    var grid = h('div', 'sbo-pick');
    var cal = h('div', 'sbo-cal'); var calWrap = h('div', 'sbo-cal-wrap'); calWrap.appendChild(h('h3', 'sbo-h3', 'When do you want to begin?')); calWrap.appendChild(cal);
    var closedNote = h('p', 'sbo-cal-note'); calWrap.appendChild(closedNote);
    grid.appendChild(calWrap);
    var tlWrap = h('div', 'sbo-tl-wrap'); tlWrap.appendChild(h('h3', 'sbo-h3', 'Your timeline')); var tlEl = h('ol', 'sbo-tl'); tlWrap.appendChild(tlEl);
    grid.appendChild(tlWrap); st.appendChild(grid);
    var acts = h('div', 'sbo-cta is-send');
    var send = h('a', 'sbo-btn', str(I.send, 'Send')); send.target = '_blank'; send.rel = 'noopener'; acts.appendChild(send);
    var hint = h('span', 'sbo-hint', 'Pick a start date to send'); acts.appendChild(hint);
    st.appendChild(acts);
    page.appendChild(st);
    if (O.tax_note || O.tag) page.appendChild(h('p', 'sbo-foot', [O.tag ? O.tag + '.' : '', O.tax_note || ''].join(' ').trim()));

    /* ---------- dates (the same rules as the earlier proposal page) ---------- */
    var ST = { date: null };
    var today = new Date(); today.setHours(0, 0, 0, 0);
    function iso(sx) { var p = String(sx).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
    var BO = arr(C.blackout).map(function (r) { return [iso(r[0]), iso(r[1])]; }), CLOSED = arr(C.closed_weekdays || [0]);
    function shut(d) { return CLOSED.indexOf(d.getDay()) >= 0 || BO.some(function (r) { return d >= r[0] && d <= r[1]; }); }
    function avail(d) { d = new Date(d); while (shut(d)) d.setDate(d.getDate() + 1); return d; }
    function before(d) { d = new Date(d); while (shut(d)) d.setDate(d.getDate() - 1); return d; }
    function add(d, n) { d = new Date(d); d.setDate(d.getDate() + n); return d; }
    function addM(d, n) { d = new Date(d); d.setMonth(d.getMonth() + n); return d; }
    var DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var MF = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var DF = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    function fmt(d) { return DN[d.getDay()] + ', ' + d.getDate() + ' ' + MN[d.getMonth()] + ' ' + d.getFullYear(); }
    function short(d) { return d.getDate() + ' ' + MN[d.getMonth()]; }
    /* the closed days, said once in words, from config */
    (function () {
      var bits = []; if (CLOSED.length) bits.push(CLOSED.map(function (n) { return DF[n] + 's'; }).join(' and '));
      BO.forEach(function (r) { bits.push(r[0].getDate() + ' ' + MN[r[0].getMonth()] + ' to ' + r[1].getDate() + ' ' + MN[r[1].getMonth()] + ' ' + r[1].getFullYear()); });
      closedNote.textContent = bits.length ? 'Closed: ' + bits.join(', ') + '.' : '';
    })();
    var view = new Date(today.getFullYear(), today.getMonth(), 1);
    function drawCal() {
      cal.innerHTML = '';
      var hd = h('div', 'sbo-cal-hd');
      var pv = h('button', 'sbo-cal-nav is-prev'); pv.type = 'button'; pv.setAttribute('aria-label', 'Previous month');
      var nv = h('button', 'sbo-cal-nav is-next'); nv.type = 'button'; nv.setAttribute('aria-label', 'Next month');
      pv.disabled = view <= new Date(today.getFullYear(), today.getMonth(), 1);
      pv.addEventListener('click', function () { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); drawCal(); });
      nv.addEventListener('click', function () { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); drawCal(); });
      hd.appendChild(h('b', null, MF[view.getMonth()] + ' ' + view.getFullYear())); var nb = h('span', 'sbo-cal-btns'); nb.appendChild(pv); nb.appendChild(nv); hd.appendChild(nb); cal.appendChild(hd);
      var g = h('div', 'sbo-cal-g'); ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(function (l) { g.appendChild(h('span', 'sbo-cal-w', l.charAt(0))); });
      var lead0 = (view.getDay() + 6) % 7; for (var k = 0; k < lead0; k++) g.appendChild(h('span'));
      var n = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      for (var dd = 1; dd <= n; dd++) (function (d) {
        var b = h('button', 'sbo-cal-d', String(d.getDate())); b.type = 'button';
        var off = d < today || shut(d); b.disabled = off; if (off) b.classList.add('is-off');
        if (ST.date && +d === +ST.date) { b.classList.add('is-on'); b.setAttribute('aria-pressed', 'true'); }
        b.setAttribute('aria-label', fmt(d) + (off ? ', not available' : ''));
        b.addEventListener('click', function () { ST.date = d; drawCal(); refresh(true); });
        g.appendChild(b);
      })(new Date(view.getFullYear(), view.getMonth(), dd));
      cal.appendChild(g);
    }
    var G = ' ' + TX;
    function steps() {
      if (!ST.date) return [];
      var k = ST.date, live = avail(add(k, C.setup_days || 45)), out = [];
      out.push(['Kickoff', fmt(k), 'is-key']);
      if (!fSet) { var cp = prices[pick] || {}; out.push(['First invoice: ' + str(cp.first, cp.now) + G, fmt(k)]); return out; }
      out.push(['First invoice: setup ' + str(C.setup_fee) + ' and quarter 1 ' + str(C.quarter_fee) + G, fmt(k)]);
      out.push(['Setup, ' + (C.setup_days || 45) + ' days', short(k) + ' to ' + fmt(live)]);
      out.push(['Go-live', fmt(live), 'is-key']);
      for (var m = 0; m < tm; m++) out.push(['Training and onboarding, month ' + (m + 1) + ' (' + str(C.training_fee) + G + ')', short(avail(addM(k, m))) + ' to ' + fmt(before(add(addM(k, m + 1), -1)))]);
      for (var qq = 1; qq <= 3; qq++) out.push(['Quarter ' + (qq + 1) + ' invoice (' + str(C.quarter_fee) + G + ')', fmt(avail(addM(k, qq * (C.quarter_months || 3))))]);
      return out;
    }
    function refresh(animate) {
      var S2 = steps(); tlEl.innerHTML = ''; tlEl.classList.remove('is-in'); if (animate && !REDUCED) { void tlEl.offsetWidth; tlEl.classList.add('is-in'); } tlEl.classList.toggle('is-plan', !S2.length);
      if (!S2.length) {
        /* before a date: the plan in general terms */
        arr(O.timeline).forEach(function (r) { var li = h('li'); li.appendChild(h('span', 'sbo-tl-d', r.when)); li.appendChild(h('span', 'sbo-tl-t', r.what)); tlEl.appendChild(li); });
      }
      S2.forEach(function (r, k) {
        var li = h('li', r[2] || ''); li.appendChild(h('span', 'sbo-tl-t', r[0])); li.appendChild(h('span', 'sbo-tl-d', r[1]));
        tlEl.appendChild(li);
      });
      var dateTxt = ST.date ? fmt(ST.date) : 'TBC', sub = str(I.subject).replace('{date}', dateTxt);
      var lines = ['Hi Sameep,', '', 'We’d like to go ahead with Coco for ' + brand + '.', '', 'Start: ' + dateTxt, ''];
      (O.choose ? [prices[pick] || {}] : prices).forEach(function (p) { lines.push((O.choose ? 'Option: ' : '') + p.item + ': ' + p.now + (p.tax ? ' ' + TX : '') + ', ' + str(p.unit) + (O.choose && p.note ? '. ' + p.note : '')); });
      lines.push('');
      if (S2.length) { lines.push('Timeline:'); S2.forEach(function (r) { lines.push('- ' + r[0] + ': ' + r[1]); }); lines.push(''); }
      lines.push('Thanks,');
      send.href = 'mailto:' + str(I.email, 'hello@sameep.ai') + '?subject=' + encodeURIComponent(sub) + '&body=' + encodeURIComponent(lines.join('\n'));
      send.classList.toggle('is-wait', !ST.date); send.setAttribute('aria-disabled', ST.date ? 'false' : 'true');
      hint.textContent = ST.date ? 'Opens an email to ' + str(I.email, 'hello@sameep.ai') : 'Pick a start date to send';
    }
    send.addEventListener('click', function (e) { if (!ST.date) { e.preventDefault(); cal.classList.remove('is-nudge'); void cal.offsetWidth; cal.classList.add('is-nudge'); } });
    drawCal(); refresh(false);

    /* ---------- open, close ---------- */
    go.addEventListener('click', function () {
      st.hidden = false; go.closest('.sbo-cta').classList.add('is-gone');
      requestAnimationFrame(function () { st.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' }); });
    });
    var closed = false;
    function close() {
      if (closed) return; closed = true; removeEventListener('keydown', onKey);
      root.classList.remove('is-on'); root.classList.add('is-out');
      setTimeout(function () { if (root.parentNode) root.parentNode.removeChild(root); }, REDUCED ? 0 : 420);
      if (opts.onClose) opts.onClose();
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    x.addEventListener('click', close); back.addEventListener('click', close); addEventListener('keydown', onKey);

    host.innerHTML = ''; host.appendChild(root);
    requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add('is-on'); x.focus({ preventScroll: true }); }); });
    return { close: close, el: root };
  };
})();
