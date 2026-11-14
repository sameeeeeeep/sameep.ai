/* sb-app.js: the Coco app at true scale for the storyboard's product beats (5 to 13).
   Full viewport: top bar, modules, the module's thread, tasks, canvas. Driven beat by beat from config:
     beat.stop / from / to   the story stop and the thread items this beat plays (earlier ones are already there)
     beat.pop                'item' | 'tray' | 'decision': one highlight, lifted large and centred over the dimmed board
     beat.autopick           ms: a decision in the thread resolves inline (no highlight)
     beat.open / into        an image key (storyboard.images) that opens big first and settles into item `into`
   Visuals (photos, documents, listings) open big over the work area, then settle into the thread as an attachment.
   Numbers are said by the Chief of staff in the dock (sb.js), so the canvas only carries real artefacts.
   No names in this file: everything comes from the config. */

const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const str = (v, d) => (v == null || v === '' ? (d == null ? '' : d) : String(v));
const arr = (v) => (Array.isArray(v) ? v : []);
const first = (w) => str(w).split(/\s+/)[0];
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const EZ = 'cubic-bezier(.2,.8,.2,1)';

const ICON = {
  ideas: 'M8 1.5a4.5 4.5 0 0 0-2.6 8.2V12h5.2V9.7A4.5 4.5 0 0 0 8 1.5zM6 13.5h4M6.6 15h2.8',
  npd: 'M2.5 3.5h11v9h-11zM2.5 6.5h11M6 6.5v6',
  logistics: 'M1.5 4.5h8v6h-8zM9.5 7h3l2 2v1.5h-5M4 12.5a1.2 1.2 0 1 0 .01 0M11.5 12.5a1.2 1.2 0 1 0 .01 0',
  warehouse: 'M1.5 6.5 8 2.5l6.5 4v7h-13zM5 13.5v-4h6v4',
  listing: 'M2.5 2.5h11v11h-11zM5 5.5h6M5 8h6M5 10.5h3.5',
  marketing: 'M2.5 9.5V6.5l8-3.5v10l-8-3.5zM10.5 6v4M4.5 9.5l1 4h2l-.8-3.6',
  crm: 'M8 8a2.8 2.8 0 1 0 0-5.6A2.8 2.8 0 0 0 8 8zM2.5 14c.8-2.8 3-4.2 5.5-4.2s4.7 1.4 5.5 4.2',
  doc: 'M4 1.5h5.5L12.5 4.5v10h-8.5zM9.5 1.5v3h3M6 8h5M6 10.5h5',
  sheet: 'M2.5 2.5h11v11h-11zM2.5 6h11M2.5 9.5h11M6.5 2.5v11',
  mail: 'M1.5 3.5h13v9h-13zM1.5 4l6.5 5 6.5-5',
  chat: 'M2.5 3h11v7.5h-6.5L4 13v-2.5H2.5z',
  file: 'M4 1.5h5.5L12.5 4.5v10h-8.5zM9.5 1.5v3h3'
};
const svg = (d, s) => '<svg width="' + (s || 16) + '" height="' + (s || 16) + '" viewBox="0 0 16 16" aria-hidden="true"><path d="' + d + '" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const icon = (k, cls, s) => { const e = h('span', 'ca-ic' + (cls ? ' ' + cls : '')); e.innerHTML = svg(ICON[k] || ICON.doc, s); return e; };
const VIA = { whatsapp: 'WhatsApp', email: 'Email', dm: 'Instagram', meeting: 'Meeting', shopify: 'Shopify', ads: 'Meta Ads', app: 'Coco' };
const FACES = {
  ohra: ['aditi', 'naina', 'arjun', 'tanvi', 'vikram', 'kavya', 'customer', 'agency'],
  ondri: ['kavya', 'meher', 'rohan', 'tara', 'zoya', 'ira', 'customer', 'agency'],
  siro: ['nikhil', 'pooja', 'farhan', 'leela', 'varun', 'meera', 'customer', 'agency']
};

export function createApp(cfg, host, env) {
  env = env || {};
  const S = cfg.story || {}, SB = cfg.storyboard || {};
  const stops = [];
  arr(S.chapters).forEach((c) => arr(c.stops).forEach((st) => { if (st && typeof st === 'object') stops.push(st); }));
  const mods = arr(S.modules);
  const byStop = (id) => stops.filter((s) => s.id === id)[0];
  const modOf = (id) => mods.filter((m) => m.id === id)[0] || { id, name: '#' + id };

  /* ---------- assets and people ---------- */
  function asset(key) {
    if (!key) return '';
    const A = cfg.assets || {};
    if (A[key]) return A[key];
    if (/^(blob:|data:|https?:|\.|\/|p\/|sb\/)|\.(webp|png|jpe?g)(\?|$)/.test(key)) return key;
    return 'assets/' + cfg.id + '/' + key + '.webp';
  }
  const isAgent = (w) => /agent$|^chief of staff$/i.test(str(w));
  const isCos = (w) => /^chief of staff$/i.test(str(w));
  function faceSrc(who) {
    const w = str(who), F = cfg.faces || {};
    const keys = [w, first(w), first(w).toLowerCase()];
    for (const k of keys) if (k && typeof F[k] === 'string' && F[k]) return F[k];
    const s = /customer|,/i.test(w) ? 'customer' : /studio|agency/i.test(w) ? 'agency' : first(w).toLowerCase();
    return (FACES[cfg.id] || []).indexOf(s) >= 0 ? 'faces/' + cfg.id + '-' + s + '.webp' : '';
  }
  function face(who, cls) {
    const w = str(who, '?'), el = h('span', 'ca-face' + (cls ? ' ' + cls : ''));
    el.title = w;
    if (isAgent(w)) { el.classList.add('is-agent'); if (isCos(w)) el.classList.add('is-cos'); el.textContent = isCos(w) ? 'C' : w.charAt(0).toUpperCase(); return el; }
    const src = faceSrc(w);
    if (src) { const im = h('img'); im.alt = ''; im.decoding = 'async'; im.src = src; el.appendChild(im); } else el.textContent = w.charAt(0).toUpperCase();
    return el;
  }
  function owners(m) { return (Array.isArray(m.owners) ? m.owners : m.owner ? [m.owner] : []).filter((x) => !isAgent(x)).slice(0, 3); }
  function faces(list, cls) { const s = h('span', 'ca-faces' + (cls ? ' ' + cls : '')); list.forEach((p) => s.appendChild(face(p, 'is-xs'))); return s; }
  /* text with @mentions in ink weight (no colour highlights) */
  function rich(tag, cls, text) {
    const e = h(tag, cls); const t = str(text); const re = /@(Chief of staff|[A-Z][a-z]+ agent|[A-Z][\w]+)/g; let last = 0, m;
    while ((m = re.exec(t))) { if (m.index > last) e.appendChild(document.createTextNode(t.slice(last, m.index))); e.appendChild(h('b', 'ca-at', m[0])); last = m.index + m[0].length; }
    if (last < t.length) e.appendChild(document.createTextNode(t.slice(last)));
    return e;
  }
  const check = (cls) => h('span', 'ca-ck' + (cls ? ' ' + cls : ''));

  /* ---------- the frame ---------- */
  const ui = {};
  const root = h('div', 'ca'); ui.root = root;
  /* top bar */
  const top = h('div', 'ca-top');
  const wm = h('span', 'ca-wm', 'Coco'); top.appendChild(wm);
  const ws = h('span', 'ca-ws'); ws.appendChild(h('b', null, str((cfg.brand || {}).name, 'Brand'))); top.appendChild(ws);
  const prod = (arr(S.products).filter((p) => p.follow)[0]) || { name: str((S.product || {}).name) };
  const pr = h('span', 'ca-prod');
  if (prod.img) { const im = h('img'); im.alt = ''; im.src = asset(prod.img); pr.appendChild(im); }
  pr.appendChild(h('b', null, str(prod.name))); top.appendChild(pr);
  ui.stageTxt = h('span', 'ca-stage-t'); ui.steps = h('span', 'ca-steps');
  stops.forEach(() => ui.steps.appendChild(h('i')));
  const stg = h('span', 'ca-stage'); stg.appendChild(ui.steps); stg.appendChild(ui.stageTxt); top.appendChild(stg);
  const tm = h('span', 'ca-team'); tm.appendChild(faces(arr(cfg.team).map((m) => m.name).slice(0, 6), 'is-team'));
  const nAgents = arr((S.setup || {}).agents).length || 10;
  tm.appendChild(h('span', null, arr(cfg.team).length + ' people · ' + nAgents + ' agents')); top.appendChild(tm);
  root.appendChild(top);
  /* the four columns */
  const body = h('div', 'ca-body'); root.appendChild(body);
  const side = h('aside', 'ca-side'); body.appendChild(side);
  side.appendChild(h('p', 'ca-h', 'Modules'));
  ui.mods = {};
  mods.forEach((m) => {
    const r = h('div', 'ca-mod'); r.appendChild(icon(m.id));
    const tx = h('div', 'ca-mod-x'); tx.appendChild(h('b', null, m.name)); const ln = h('span', null, str(m.about)); tx.appendChild(ln); r.appendChild(tx);
    r.appendChild(faces(owners(m)));
    side.appendChild(r); ui.mods[m.id] = { el: r, line: ln };
  });
  if (arr(S.products).length) {
    side.appendChild(h('p', 'ca-h is-gap', 'Products'));
    arr(S.products).forEach((p) => {
      const r = h('div', 'ca-pr'); const th = h('span', 'ca-pr-th');
      if (p.img) { const im = h('img'); im.alt = ''; im.src = asset(p.img); th.appendChild(im); } else th.style.background = str(p.color, '#ddd');
      r.appendChild(th); const tx = h('div'); tx.appendChild(h('b', null, p.name)); tx.appendChild(h('span', null, p.follow ? 'In the works' : str(p.status))); r.appendChild(tx);
      side.appendChild(r); if (p.follow) ui.follow = tx.lastChild;
    });
  }
  /* thread */
  const thr = h('section', 'ca-thr'); body.appendChild(thr);
  const th = h('div', 'ca-col-hd'); ui.thrIcon = h('span', 'ca-ic'); th.appendChild(ui.thrIcon);
  const tht = h('div', 'ca-col-t'); ui.thrName = h('b'); ui.thrAbout = h('span'); tht.appendChild(ui.thrName); tht.appendChild(ui.thrAbout); th.appendChild(tht);
  ui.thrFaces = h('span', 'ca-col-r'); th.appendChild(ui.thrFaces); thr.appendChild(th);
  ui.thread = h('div', 'ca-thread'); thr.appendChild(ui.thread);
  const comp = h('div', 'ca-comp'); ui.compT = h('span'); comp.appendChild(ui.compT); thr.appendChild(comp);
  /* tasks */
  const tk = h('section', 'ca-tasks'); body.appendChild(tk);
  const tkh = h('div', 'ca-col-hd'); const tkt = h('div', 'ca-col-t'); tkt.appendChild(h('b', null, 'Tasks')); ui.tkCount = h('span'); tkt.appendChild(ui.tkCount); tkh.appendChild(tkt); tk.appendChild(tkh);
  ui.tasks = h('div', 'ca-tlist'); tk.appendChild(ui.tasks);
  /* canvas */
  const cv = h('section', 'ca-canvas'); body.appendChild(cv);
  const cvh = h('div', 'ca-col-hd'); const cvt = h('div', 'ca-col-t'); ui.cvName = h('b'); ui.cvSub = h('span'); cvt.appendChild(ui.cvName); cvt.appendChild(ui.cvSub); cvh.appendChild(cvt); cv.appendChild(cvh);
  ui.cv = h('div', 'ca-cv'); cv.appendChild(ui.cv);
  /* layers: the dim and the lift */
  ui.dim = h('div', 'ca-dim'); root.appendChild(ui.dim);
  ui.lift = h('div', 'ca-lift'); root.appendChild(ui.lift);
  host.appendChild(root);
  ui.work = () => { const a = tk.getBoundingClientRect(), b = cv.getBoundingClientRect(), r = root.getBoundingClientRect();
    if (a.width > 0 && b.width > 0) return { left: a.left - r.left, top: a.top - r.top, width: b.right - a.left, height: b.bottom - a.top };
    if (b.width > 0) return { left: b.left - r.left, top: b.top - r.top, width: b.width, height: b.height };
    return { left: 0, top: top.offsetHeight, width: r.width, height: r.height - top.offsetHeight - (r.width < 760 ? 230 : 0) }; };

  /* ---------- state ---------- */
  let cur = { mod: null, stop: null, k: -1 }, T = [], token = 0, beat = null;
  const later = (ms, fn) => { const t = token; T.push(setTimeout(() => { if (t === token) fn(); }, REDUCED ? Math.min(ms, 60) : ms)); };
  function clearT() { T.forEach(clearTimeout); T = []; token++; }

  /* ---------- objects: the real artefacts ---------- */
  function objOf(stop, id) { const L = arr(((stop || {}).scene || {}).objs); return L.filter((o) => o.id === id)[0] || null; }
  const OK = (o) => !!o && !!(o.media || (o.doc && (o.doc.kind || o.doc.rows)) || o.listing || o.list || o.calendar || o.quotes || o.swipes || o.swatch || (o.src && !o.chart && !o.counter && !o.stat));
  function landObj(stop, it) {
    const L = Array.isArray(it.land) ? it.land : it.land ? [it.land] : [];
    for (const id of L) { const o = objOf(stop, id); if (OK(o)) return o.listing ? { id: '__listings', listings: arr(stop.scene.objs).filter((x) => x.listing) } : o; }
    return null;
  }
  function titleOf(o) {
    if (o.listings) return 'Live on ' + o.listings.length + ' channels';
    if (o.media) return str(o.media.caption, 'Photo');
    const d = o.doc || {};
    if (d.kind === 'email') return str(d.subject, 'Email');
    if (d.kind) return str(d.title || d.group, d.channel || 'Document');
    if (o.list) return str(o.list.title, 'List'); if (o.calendar) return str(o.calendar.title, 'Calendar');
    if (o.quotes) return 'Quotes'; if (o.swipes) return str(o.title, 'Swatches'); if (o.swatch) return str(o.swatch.name);
    return str(d.title, 'Photo');
  }
  function subOf(o) {
    const d = o.doc || {};
    if (d.kind === 'email') return 'Email from ' + str(d.from);
    if (d.kind === 'dms') return str(d.channel, 'Instagram') + ' DMs · ' + arr(d.msgs).length + ' messages';
    if (d.kind === 'whatsapp') return 'WhatsApp · ' + arr(d.msgs).length + ' messages';
    if (d.kind === 'orders') return 'Orders · ' + arr(d.rows).length + ' rows';
    if (d.kind === 'sheet') return 'Sheet · ' + arr(d.rows).length + ' rows';
    if (d.kind === 'po') return 'Purchase order';
    if (o.doc) return str(d.sub, 'Document');
    return '';
  }
  function img(src, cls) { const i = h('img', cls); i.alt = ''; i.decoding = 'async'; i.src = src; return i; }
  function table(rows, cls, mono) {
    const t = h('table', cls);
    rows.forEach((r, n) => { const tr = h('tr'); arr(r).forEach((c, j) => { const td = h(n === 0 && cls === 'is-grid' ? 'th' : (j === 0 && cls === 'is-kv' ? 'th' : 'td'), mono && mono(j, c) ? 'is-n' : '', c); tr.appendChild(td); }); t.appendChild(tr); });
    return t;
  }
  const MONO = (j, c) => /^[₹$]?[\d,.:]+(\s?(am|pm))?$|^[A-Z]{2}-\d+/.test(str(c).trim());
  /* the artefact at full size (canvas at rest, and the big open) */
  function art(o) {
    const e = h('div', 'ca-art');
    if (o.listings) {
      e.classList.add('is-listings'); const g = h('div', 'ca-lst');
      o.listings.forEach((x) => { const L = x.listing, c = h('div', 'ca-lst-c'); c.appendChild(h('b', null, str(L.channel, x.label))); c.appendChild(img(asset(L.src || (S.products || [{}])[0].img)));
        c.appendChild(h('span', null, str(L.title, prod.name))); const p = h('span', 'ca-lst-p'); p.appendChild(h('em', 'is-n', str(L.price, '₹999'))); p.appendChild(h('i', null, str(L.status, 'Live'))); c.appendChild(p); g.appendChild(c); });
      e.appendChild(g); return e;
    }
    if (o.media || (o.src && !o.doc)) {
      e.classList.add('is-photo'); const f = h('figure'); f.appendChild(img(asset(o.media ? o.media.src : o.src)));
      if (o.media && o.media.caption) f.appendChild(h('figcaption', null, o.media.caption)); e.appendChild(f); return e;
    }
    if (o.swipes) {
      e.classList.add('is-sheet'); e.appendChild(h('b', 'ca-art-t', str(o.title, 'Swatches')));
      const r = h('div', 'ca-sw'); arr(o.swipes).forEach((s) => { const c = h('div'); const k = h('span', 'ca-sw-k'); const st = h('i'); st.style.background = s.color; k.appendChild(st); c.appendChild(k); c.appendChild(h('span', null, s.name)); r.appendChild(c); });
      e.appendChild(r); return e;
    }
    if (o.swatch) { e.classList.add('is-sheet'); const r = h('div', 'ca-swatch'); const i = h('i'); i.style.background = o.swatch.color; r.appendChild(i); const t = h('div'); t.appendChild(h('b', null, o.swatch.name)); if (o.swatch.sub) t.appendChild(h('span', null, o.swatch.sub)); r.appendChild(t); e.appendChild(r); return e; }
    if (o.quotes) {
      e.classList.add('is-sheet'); e.appendChild(h('b', 'ca-art-t', 'Quotes')); const g = h('div', 'ca-q');
      arr(o.quotes).forEach((q) => { const c = h('div', 'ca-q-c' + (q.pick ? ' is-pick' : '')); if (q.img) c.appendChild(img(asset(q.img))); else { const s = h('i'); s.style.background = q.color || '#ddd'; c.appendChild(s); }
        c.appendChild(h('b', null, q.name)); c.appendChild(h('span', 'is-n', q.price)); if (q.note) c.appendChild(h('span', null, q.note)); g.appendChild(c); });
      e.appendChild(g); return e;
    }
    if (o.list) {
      e.classList.add('is-sheet'); if (o.list.title) e.appendChild(h('b', 'ca-art-t', o.list.title));
      arr(o.list.rows).forEach((r) => { const li = h('div', 'ca-li'); if (r.who) li.appendChild(face(r.who, 'is-xs')); else if (r.color) { const c = h('i', 'ca-li-c'); c.style.background = r.color; li.appendChild(c); } else li.appendChild(icon(r.via === 'dm' ? 'chat' : 'doc'));
        const t = h('div'); t.appendChild(h('b', null, r.name)); if (r.note) t.appendChild(h('span', null, r.note)); li.appendChild(t); if (r.value) li.appendChild(h('em', null, r.value)); e.appendChild(li); });
      return e;
    }
    if (o.calendar) {
      e.classList.add('is-sheet'); e.appendChild(h('b', 'ca-art-t', str(o.calendar.title, 'Calendar'))); const g = h('div', 'ca-cal');
      arr(o.calendar.days).forEach((d) => { const c = h('div'); c.appendChild(h('span', null, d[0])); arr(d[1]).forEach((x) => c.appendChild(h('em', null, x))); g.appendChild(c); });
      e.appendChild(g); return e;
    }
    const d = o.doc || {};
    e.classList.add('is-doc');
    if (d.kind === 'email') {
      const hd = h('div', 'ca-doc-hd'); hd.appendChild(icon('mail')); hd.appendChild(h('b', null, str(d.subject))); e.appendChild(hd);
      const meta = h('dl', 'ca-doc-m'); [['From', d.from], ['To', d.to], ['Date', d.date]].forEach((r) => { if (r[1]) { meta.appendChild(h('dt', null, r[0])); meta.appendChild(h('dd', null, r[1])); } }); e.appendChild(meta);
      const bd = h('div', 'ca-doc-bd'); arr(d.body).forEach((p) => bd.appendChild(h('p', null, p))); e.appendChild(bd);
      if (arr(d.attach).length) { const at = h('div', 'ca-doc-att'); d.attach.forEach((f) => { const a = h('span'); a.appendChild(icon('file')); a.appendChild(document.createTextNode(f)); at.appendChild(a); }); e.appendChild(at); }
      return e;
    }
    if (d.kind === 'dms' || d.kind === 'whatsapp') {
      const hd = h('div', 'ca-doc-hd'); hd.appendChild(icon('chat')); const ht = h('div', 'ca-doc-ht'); ht.appendChild(h('b', null, str(d.group || d.title, d.channel))); ht.appendChild(h('span', null, d.kind === 'dms' ? str(d.channel, 'Instagram') + ' DMs' : 'WhatsApp group')); hd.appendChild(ht); e.appendChild(hd);
      const ms = h('div', 'ca-doc-ms'); arr(d.msgs).forEach((m) => { const r = h('div'); const tp = h('p', 'ca-doc-who'); tp.appendChild(h('b', null, m.who)); tp.appendChild(h('span', 'is-n', str(m.time))); r.appendChild(tp); r.appendChild(h('p', null, m.text)); ms.appendChild(r); }); e.appendChild(ms);
      return e;
    }
    if (d.kind === 'orders') {
      const hd = h('div', 'ca-doc-hd'); hd.appendChild(icon('sheet')); hd.appendChild(h('b', null, str(d.title))); e.appendChild(hd);
      e.appendChild(table([arr(d.cols)].concat(arr(d.rows)), 'is-grid', MONO)); return e;
    }
    if (d.kind === 'po') {
      const hd = h('div', 'ca-doc-hd'); hd.appendChild(icon('doc')); hd.appendChild(h('b', null, 'Purchase order ' + str(d.number))); e.appendChild(hd);
      e.appendChild(table([['Item', 'Qty', 'Rate', 'Amount']].concat(arr(d.lines), arr(d.totals).map((r) => [r[0], '', '', r[1]])), 'is-grid', (j) => j > 0)); return e;
    }
    const hd = h('div', 'ca-doc-hd'); hd.appendChild(icon(d.kind === 'sheet' ? 'sheet' : 'doc')); const ht = h('div', 'ca-doc-ht'); ht.appendChild(h('b', null, str(d.title))); if (d.sub) ht.appendChild(h('span', null, d.sub)); hd.appendChild(ht); e.appendChild(hd);
    e.appendChild(table(arr(d.rows), 'is-kv')); return e;
  }
  /* the attachment it settles into, in the thread */
  function att(o) {
    if (o.media || (o.src && !o.doc) || o.img) { const a = h('div', 'ca-att is-photo'); a.appendChild(img(o.img || asset(o.media ? o.media.src : o.src))); return a; }
    if (o.listings) { const a = h('div', 'ca-att is-set'); const r = h('span'); o.listings.forEach((x) => r.appendChild(img(asset(x.listing.src || (S.products || [{}])[0].img)))); a.appendChild(r); a.appendChild(h('b', null, titleOf(o))); return a; }
    const a = h('div', 'ca-att is-file'); const d = o.doc || {};
    a.appendChild(icon(d.kind === 'email' ? 'mail' : d.kind === 'dms' || d.kind === 'whatsapp' ? 'chat' : d.kind === 'orders' || d.kind === 'sheet' ? 'sheet' : 'doc', null, 18));
    const t = h('div'); t.appendChild(h('b', null, titleOf(o))); const s = subOf(o); if (s) t.appendChild(h('span', null, s)); a.appendChild(t); return a;
  }
  function canvasShow(o, stop) {
    ui.cv.innerHTML = ''; if (!o) { ui.cv.appendChild(h('p', 'ca-cv-empty', 'Nothing on the board yet')); return; }
    const a = art(o); a.classList.add('is-rest'); ui.cv.appendChild(a); ui.cvObj = o;
    if (stop) { ui.cvName.textContent = str(stop.board, 'Board'); ui.cvSub.textContent = modOf(stop.module).name + ' · ' + str(stop.label); }
  }

  /* ---------- thread rows ---------- */
  function rowFor(it, stop) {
    const k = it.k;
    if (k === 'task') return sysRow(it, stop);
    if (k === 'decision') return decRow(it, stop);
    const who = k === 'cos' ? str(it.agent, 'Chief of staff') : str(it.who);
    const r = h('div', 'ca-msg' + (isAgent(who) ? ' is-agent' : '')); r.appendChild(face(who));
    const c = h('div', 'ca-msg-c'); const hd = h('p', 'ca-msg-hd'); hd.appendChild(h('b', null, who));
    const meta = (it.where && it.where !== 'Voice note' ? it.where : '') || str(it.desc) || (it.via && VIA[it.via]) || '';
    if (meta) hd.appendChild(h('span', null, meta)); c.appendChild(hd);
    if (it.voice && k === 'msg') { const v = h('div', 'ca-voice'); v.appendChild(h('span', 'ca-play')); const w = h('span', 'ca-wave'); for (let n = 0; n < 34; n++) { const b = h('i'); b.style.height = Math.round(22 + 70 * Math.abs(Math.sin(n * 1.7) * Math.cos(n * 0.45))) + '%'; w.appendChild(b); } v.appendChild(w); v.appendChild(h('span', 'is-n', str(it.len, '0:20'))); c.appendChild(v); }
    c.appendChild(rich('p', 'ca-msg-t', it.text));
    if (it.media && it.media.type === 'swatch') { const sw = h('div', 'ca-swrow'); arr(it.media.colors).forEach((col) => { const i = h('i'); i.style.background = col; sw.appendChild(i); }); if (it.media.label) sw.appendChild(h('span', null, it.media.label)); c.appendChild(sw); }
    r.appendChild(c); r._c = c; return r;
  }
  function sysRow(it) {
    const r = h('div', 'ca-sys'); const ic = h('span', 'ca-sys-ic'); ic.appendChild(check('is-done')); r.appendChild(ic);
    const c = h('div', 'ca-msg-c'); const p = h('p', 'ca-msg-hd'); p.appendChild(h('b', null, str(it.owner))); p.appendChild(h('span', null, 'Task done')); c.appendChild(p);
    c.appendChild(h('p', 'ca-sys-task', str(it.text)));
    if (it.done) c.appendChild(h('p', 'ca-msg-t', it.done)); r.appendChild(c); r._c = c; return r;
  }
  function optPic(o) {
    if (o.img) return img(asset(o.img), 'ca-opt-im');
    if (o.swatch) { const s = h('span', 'ca-opt-chip'); s.style.background = o.swatch; return s; }
    if (o.line) return h('span', 'ca-opt-line', '“' + o.line + '”');
    return null;
  }
  function decRow(it) {
    const r = h('div', 'ca-dec'); r._it = it;
    const hd = h('div', 'ca-dec-hd'); hd.appendChild(face(it.who, 'is-xs')); hd.appendChild(h('span', null, 'For ' + first(it.who))); r.appendChild(hd);
    r.appendChild(h('p', 'ca-dec-q', it.text));
    const g = h('div', 'ca-opts'); const opts = arr(it.options);
    const pics = opts.some((o) => o.img || o.line); if (!pics) g.classList.add('is-text');
    opts.forEach((o) => {
      const b = h('button', 'ca-opt' + (o.ai ? ' is-ai' : '')); b.type = 'button'; b.dataset.label = o.label;
      const p = optPic(o);
      if (p && !o.swatch) b.appendChild(p); else if (pics) b.appendChild(h('span', 'ca-opt-sw is-none'));
      if (!o.line) { const nm = h('b', 'ca-opt-n'); if (p && o.swatch) nm.appendChild(p); nm.appendChild(document.createTextNode(o.label)); b.appendChild(nm); }
      const sub = [o.cost, o.days ? '+' + o.days + ' days' : o.days === 0 ? 'on time' : '', o.barLabel].filter(Boolean).join(' · ');
      if (sub) b.appendChild(h('span', 'ca-opt-s', sub));
      if (o.ai) b.appendChild(h('span', 'ca-opt-ai', 'AI pick'));
      b.addEventListener('click', (e) => { e.stopPropagation(); if (r.classList.contains('is-done')) return; choose(r, o.label, true); });
      g.appendChild(b);
    });
    r.appendChild(g);
    const ai = opts.filter((o) => o.ai)[0]; if (ai && ai.reason) r.appendChild(h('p', 'ca-dec-why', 'AI pick: ' + ai.reason));
    const res = h('p', 'ca-dec-res'); res.appendChild(check('is-done')); r._res = h('span'); res.appendChild(r._res); r.appendChild(res);
    return r;
  }
  function resolveDec(r, label) {
    if (!r || r.classList.contains('is-done')) return;
    const it = r._it; const ai = arr(it.options).filter((o) => o.ai)[0];
    label = label || (ai && ai.label) || (arr(it.options)[0] || {}).label;
    r.querySelectorAll('.ca-opt').forEach((b) => b.classList.toggle('is-pick', b.dataset.label === label));
    r._res.textContent = first(it.who) + ' chose ' + label.replace(/^"|"$/g, '');
    r.classList.add('is-done'); r._chosen = label;
    if (env.sfx) env.sfx('stamp');
  }
  function choose(r, label, byUser) {
    resolveDec(r, label);
    if (byUser && env.onPick) env.onPick(r._chosen);
    if (byUser && ui.wake) ui.wake();
  }

  /* ---------- tasks ---------- */
  function taskRow(it) {
    const r = h('div', 'ca-task'); r.appendChild(check());
    const c = h('div'); c.appendChild(h('b', null, it.text));
    const own = h('span', 'ca-task-o'); own.appendChild(face(it.owner, 'is-xs')); own.appendChild(document.createTextNode(str(it.owner))); c.appendChild(own);
    r._done = h('p', 'ca-task-d', str(it.done)); c.appendChild(r._done); r.appendChild(c); return r;
  }
  function setTask(r, st) { if (!r) return; r.classList.toggle('is-work', st === 'work'); r.classList.toggle('is-done', st === 'done'); countTasks(); }
  function countTasks() { const all = ui.tasks.querySelectorAll('.ca-task').length, d = ui.tasks.querySelectorAll('.ca-task.is-done').length; ui.tkCount.textContent = all ? d + ' of ' + all + ' done' : ''; ui.tkCount.className = 'is-n'; }

  /* ---------- switching module and stop ---------- */
  function setStage(stop) {
    const n = stops.indexOf(stop);
    Array.prototype.forEach.call(ui.steps.children, (b, j) => { b.className = j < n ? 'is-done' : j === n ? 'is-now' : ''; });
    ui.stageTxt.textContent = str(stop.label) + (stop.day != null ? ' · Day ' + stop.day : '');
  }
  function openModule(id) {
    const m = modOf(id);
    Object.keys(ui.mods).forEach((k) => ui.mods[k].el.classList.toggle('is-on', k === id));
    ui.thrIcon.innerHTML = svg(ICON[id] || ICON.doc, 18); ui.thrName.textContent = m.name; ui.thrAbout.textContent = str(m.about);
    ui.thrFaces.innerHTML = ''; ui.thrFaces.appendChild(faces(owners(m)));
    ui.compT.textContent = 'Message ' + m.name;
    ui.thread.innerHTML = ''; ui.tasks.innerHTML = ''; ui.trows = {};
  }
  function divider(stop) { const d = h('div', 'ca-div'); d.appendChild(h('span', null, str(stop.label) + (stop.day != null ? ' · Day ' + stop.day : ''))); return d; }
  function enterStop(stop) {
    if (cur.mod !== stop.module) { openModule(stop.module); cur.mod = stop.module; }
    if (cur.stop !== stop) {
      ui.thread.appendChild(divider(stop)); ui.tasks.innerHTML = ''; ui.trows = {};
      arr(stop.thread).forEach((it, j) => { if (it.k === 'task') { const r = taskRow(it); ui.tasks.appendChild(r); ui.trows[j] = r; } });
      countTasks(); cur.stop = stop; cur.k = -1; setStage(stop);
      const hero = arr(stop.scene && stop.scene.objs).filter((o) => o.slot === 'hero' && OK(o))[0] || arr(stop.scene && stop.scene.objs).filter(OK)[0];
      canvasShow(hero || (prod.img ? { media: { src: prod.img, caption: str(prod.name) } } : null), stop);
    }
  }
  /* add item k of the stop; quick = no motion (history) */
  function addItem(stop, k, quick) {
    const it = arr(stop.thread)[k]; if (!it) return null;
    if (it.k === 'task') { const tr = ui.trows[k]; if (quick) setTask(tr, 'done'); }
    if (it.k === 'task' && !quick) return null;   /* played tasks go working → done in the tasks column first */
    const r = rowFor(it, stop); r.dataset.k = k;
    if (it.k === 'decision' && quick) resolveDec(r, null);
    if (quick) { const o = landObj(stop, it); if (o) { r._c.appendChild(att(o)); ui.lastObj = o; } }
    ui.thread.appendChild(r); if (!quick) r.classList.add('is-new');
    cur.k = Math.max(cur.k, k); return r;
  }
  function scrollEnd(smooth) { const t = ui.thread; try { t.scrollTo({ top: t.scrollHeight, behavior: smooth && !REDUCED ? 'smooth' : 'auto' }); } catch (e) { t.scrollTop = t.scrollHeight; } }
  function typing(who) { const r = h('div', 'ca-msg is-typing'); r.appendChild(face(who)); const d = h('span', 'ca-dots'); d.appendChild(h('i')); d.appendChild(h('i')); d.appendChild(h('i')); r.appendChild(d); ui.thread.appendChild(r); scrollEnd(true); return r; }

  /* ---------- the big open: a visual opens over the work area, then settles into the thread ---------- */
  function rel(el) { const a = el.getBoundingClientRect(), r = root.getBoundingClientRect(); return { left: a.left - r.left, top: a.top - r.top, width: a.width, height: a.height }; }
  function openBig(o, intoEl, then) {
    const W = ui.work(), big = h('div', 'ca-big'); big.appendChild(art(o)); ui.lift.appendChild(big);
    const photo = !!(o.img || o.media || (o.src && !o.doc));
    const maxW = Math.min(W.width * 0.86, photo ? 720 : o.listings ? 820 : 640), maxH = W.height * 0.86;
    big.style.width = maxW + 'px'; big.style.maxHeight = maxH + 'px';
    if (o.img) { big.innerHTML = ''; const a = h('div', 'ca-art is-photo'); const f = h('figure'); f.appendChild(img(o.img)); if (o.caption) f.appendChild(h('figcaption', null, o.caption)); a.appendChild(f); big.appendChild(a); }
    if (photo) { const im = big.querySelector('img'); if (im) im.style.height = Math.round(Math.min(maxW * 0.78, maxH - 84)) + 'px'; }
    const bw = maxW, bh = Math.min(big.offsetHeight || maxH, maxH);
    const x = W.left + (W.width - bw) / 2, y = W.top + (W.height - bh) / 2;
    big.style.left = x + 'px'; big.style.top = y + 'px';
    big.animate([{ clipPath: 'inset(46% 46% 46% 46% round 14px)', transform: 'scale(.9)' }, { clipPath: 'inset(0 0 0 0 round 14px)', transform: 'none' }], { duration: REDUCED ? 1 : 560, easing: EZ, fill: 'both' });
    if (env.sfx) env.sfx('pop');
    later(1350, () => {
      /* settle: the canvas keeps it at rest, the thread gets the attachment */
      canvasShow(o.img ? null : o, cur.stop); if (o.img) canvasShow(ui.cvObj, cur.stop);
      const a = att(o); a.classList.add('is-in'); if (intoEl) { (intoEl._c || intoEl).appendChild(a); scrollEnd(false); }
      const t = intoEl ? rel(a) : rel(ui.cv);
      const s = Math.max(0.08, t.width / bw);
      const anim = big.animate([{ transform: 'none' }, { transform: 'translate(' + (t.left - x) + 'px,' + (t.top - y) + 'px) scale(' + s + ')' }], { duration: REDUCED ? 1 : 700, easing: EZ, fill: 'forwards' });
      big.style.transformOrigin = '0 0';
      anim.onfinish = () => { big.remove(); a.classList.remove('is-in'); if (then) then(); };
    });
  }

  /* ---------- the highlight: lift the real element, dim the board, centre it big; settle it back ---------- */
  function lift(el) {
    unlift(true); if (!el) return;
    const W = { left: 0, top: 0, width: root.clientWidth, height: root.clientHeight };
    let r0 = rel(el); const hidden = r0.width < 2;
    const ph = h('div', 'ca-ph'); ph.style.height = (hidden ? 0 : r0.height) + 'px'; el.parentNode.insertBefore(ph, el);
    const natW = hidden ? Math.min(460, W.width - 32) : r0.width;
    if (hidden) r0 = { left: (W.width - natW) / 2, top: W.height / 2 - 100, width: natW, height: 200 };
    const box = h('div', 'ca-lifted'); box.style.left = r0.left + 'px'; box.style.top = r0.top + 'px'; box.style.width = natW + 'px';
    box.appendChild(el); ui.lift.appendChild(box);
    const bh = box.offsetHeight, PH = innerWidth < 760;
    const s = Math.max(1, Math.min(PH ? 1.04 : 1.55, (W.width * (PH ? 0.92 : 0.6)) / natW, (W.height * 0.72) / bh));
    const tx = (W.width - natW * s) / 2 - r0.left, ty = (W.height - bh * s) / 2 - r0.top + (PH ? -40 : 0);
    box.style.transformOrigin = '0 0';
    ui.dim.classList.add('is-on'); root.classList.add('is-lift');
    box.animate([{ transform: 'none' }, { transform: 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')' }], { duration: REDUCED ? 1 : 700, easing: EZ, fill: 'forwards' });
    ui.lifted = { el, ph, box, hidden };
    if (env.sfx) env.sfx('pop');
  }
  function unlift(instant) {
    const L = ui.lifted; if (!L) return; ui.lifted = null;
    ui.dim.classList.remove('is-on'); root.classList.remove('is-lift');
    const done = () => { if (L.ph.parentNode) { L.ph.parentNode.insertBefore(L.el, L.ph); L.ph.remove(); } L.box.remove(); scrollEnd(false); };
    if (instant || REDUCED || L.hidden || !L.ph.isConnected) { done(); return; }
    L.ph.style.height = L.el.offsetHeight + 'px';
    const t = rel(L.ph), b = L.box.style;
    const a = L.box.animate([{ transform: getComputedStyle(L.box).transform }, { transform: 'translate(' + (t.left - parseFloat(b.left)) + 'px,' + (t.top - parseFloat(b.top)) + 'px) scale(1)' }], { duration: 650, easing: EZ, fill: 'forwards' });
    a.onfinish = done;
  }

  /* ---------- play a beat: one sequential timeline, so every beat gets the time its content needs ---------- */
  const TM = { start: 420, open: 2100, typing: 420, line: 1050, visual: 2300, task: 950, taskEnd: 550, decIn: 500, decide: 3400, chose: 1150, back: 650, autopick: 1500, pop: 2100, popBack: 700 };
  function plan(b) {
    const stop = byStop(b.stop); if (!stop) return [];
    const from = b.from || 0, to = b.to == null ? arr(stop.thread).length - 1 : b.to, steps = [];
    for (let k = from; k <= to; k++) { const it = arr(stop.thread)[k]; if (it) steps.push({ k, it, o: it.k === 'decision' ? null : landObj(stop, it) }); }
    return steps;
  }
  function estimate(b) {
    let t = TM.start + (b.open ? TM.open : 0) + (b.pop === 'tray' ? 700 : 0);
    plan(b).forEach((s) => {
      if (s.it.k === 'task') t += TM.task + (s.o && b.pop !== 'tray' ? TM.visual : TM.taskEnd);
      else if (s.it.k === 'decision') t += TM.decIn + (b.pop === 'decision' ? TM.decide + TM.chose + TM.back : b.autopick ? TM.autopick + TM.chose : TM.line);
      else t += TM.typing + (s.o ? TM.visual : TM.line);
    });
    if (b.pop === 'item') t += TM.pop + TM.popBack;
    if (b.pop === 'tray') t += 800 + TM.popBack;
    return t;
  }
  async function play(b) {
    clearT(); unlift(true); ui.lift.innerHTML = ''; beat = b;
    const stop = byStop(b.stop); if (!stop) return;
    const my = token, wait = (ms) => new Promise((r) => later(ms, r)), live = () => my === token;
    const from = b.from || 0;
    if (cur.stop === stop && cur.k >= from) { cur.stop = null; cur.mod = null; }   /* a seek back: rebuild the stop from its history */
    enterStop(stop);
    for (let k = cur.k + 1; k < from; k++) addItem(stop, k, true);
    if (ui.lastObj && cur.stop === stop) { canvasShow(ui.lastObj, stop); ui.lastObj = null; }
    scrollEnd(false);
    await wait(TM.start); if (!live()) return;
    /* an opening visual (the sketch she just sent): big first, then into her message */
    if (b.open && env.img(b.open)) {
      openBig({ img: env.img(b.open), caption: str(b.open_caption) }, ui.thread.querySelector('[data-k="' + (b.into || 0) + '"]'));
      await wait(TM.open); if (!live()) return;
    }
    if (b.pop === 'tray') { lift(ui.tasks); await wait(700); if (!live()) return; }
    let lastRow = null;
    for (const s of plan(b)) {
      const { k, it, o } = s;
      if (it.k === 'task') {
        const tr = ui.trows[k]; setTask(tr, 'work');
        await wait(TM.task); if (!live()) return;
        setTask(tr, 'done');
        const r = addItem(stop, k, true); if (r) { r.classList.add('is-new'); const at = r.querySelector('.ca-att'); if (at) at.remove(); }
        scrollEnd(true); lastRow = r || lastRow;
        if (o && r && b.pop !== 'tray') { openBig(o, r); await wait(TM.visual); } else { if (o && r) r._c.appendChild(att(o)); await wait(TM.taskEnd); }
        if (!live()) return; continue;
      }
      if (it.k === 'decision') {
        const r = addItem(stop, k, false); scrollEnd(true); lastRow = r;
        await wait(TM.decIn); if (!live()) return;
        if (b.pop === 'decision') {
          lift(r); await new Promise((res) => { ui.wake = res; later(TM.decide, res); }); ui.wake = null; if (!live()) return;
          if (!r.classList.contains('is-done')) choose(r, null, false);
          await wait(TM.chose); if (!live()) return;
          unlift(); await wait(TM.back);
        } else if (b.autopick) {
          await wait(TM.autopick); if (!live()) return; choose(r, null, false); await wait(TM.chose);
        } else await wait(TM.line);
        if (!live()) return; continue;
      }
      const who = it.k === 'cos' ? str(it.agent, 'Chief of staff') : str(it.who);
      const ty = typing(who); await wait(TM.typing); ty.remove(); if (!live()) return;
      const r = addItem(stop, k, false); scrollEnd(true); lastRow = r;
      if (o) { openBig(o, r); await wait(TM.visual); } else await wait(TM.line);
      if (!live()) return;
    }
    if (b.pop === 'item' && lastRow) { lift(lastRow); await wait(TM.pop); if (!live()) return; unlift(); await wait(TM.popBack); }
    if (b.pop === 'tray') { await wait(800); if (!live()) return; unlift(); await wait(TM.popBack); }
  }
  /* every picture the product beats will put on screen, for the loader (sb.js): the frame (products, team, module owners),
     then for each board beat its opening visual, the faces and option pictures of the thread items it plays (history
     included), the artefacts they land, and the stop's canvas */
  function assets() {
    const out = new Set(), add = (u) => { if (u) out.add(u); }, who = (w) => { if (w && !isAgent(w)) add(faceSrc(w)); };
    const p0 = () => (S.products || [{}])[0].img;
    const pic = (o) => {
      if (!o) return;
      if (o.listings) o.listings.forEach((x) => add(asset((x.listing || {}).src || p0())));
      if (o.media || (o.src && !o.doc)) add(asset(o.media ? o.media.src : o.src));
      arr(o.quotes).forEach((q) => { if (q.img) add(asset(q.img)); });
      if (o.list) arr(o.list.rows).forEach((r) => who(r.who));
    };
    if (prod.img) add(asset(prod.img));
    arr(S.products).forEach((p) => { if (p.img) add(asset(p.img)); });
    arr(cfg.team).slice(0, 6).forEach((m) => who(m.name));
    mods.forEach((m) => owners(m).forEach(who));
    arr(SB.beats).forEach((b) => {
      if (b.kind !== 'board') return;
      if (b.open && env.img) add(env.img(b.open));
      const stop = byStop(b.stop); if (!stop) return;
      const th = arr(stop.thread), to = b.to == null ? th.length - 1 : b.to;
      th.slice(0, to + 1).forEach((it) => {
        who(it.k === 'cos' ? str(it.agent, 'Chief of staff') : it.who); who(it.owner);
        arr(it.options).forEach((o) => { if (o.img) add(asset(o.img)); });
        pic(landObj(stop, it));
      });
      const objs = arr(stop.scene && stop.scene.objs);
      pic(objs.filter((o) => o.slot === 'hero' && OK(o))[0] || objs.filter(OK)[0]);
      owners(modOf(stop.module)).forEach(who);
    });
    return Array.from(out);
  }
  function stop() { clearT(); unlift(true); ui.lift.innerHTML = ''; }
  function pick(label) { const r = ui.thread.querySelector('.ca-dec:not(.is-done)'); if (r) choose(r, label, !!label); }
  function reset() { stop(); cur = { mod: null, stop: null, k: -1 }; }
  return { el: root, play, estimate, stop, pick, reset, assets, get lifted() { return !!ui.lifted; } };
}
