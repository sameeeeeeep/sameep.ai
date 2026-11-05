// Wispr Social: the calendar. Voice is for dictation only (the brain dump, the copy); every action is a click or a key.
(() => {
  const DEMO = window.WisprSocialDemo || null;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const qs = new URLSearchParams(location.search);

  const S = { project: qs.get('project') || '', view: 'week', anchor: null, posts: [], queue: [], sel: null, data: null, typingAt: 0 };
  const LIMIT = { x: 280, linkedin: 3000, instagram: 2200, reddit: 40000, hn: 2000, hnTitle: 80, redditTitle: 300 };
  const SHORT = { x: 'X', linkedin: 'LI', instagram: 'IG', reddit: 'r/', hn: 'HN' };
  const STATUS_LABEL = { idea: 'Idea', draft: 'Draft', final: 'Final', scheduled: 'Scheduled', posted: 'Posted' };
  const FORMAT_LABEL = { thread: 'Thread', post: 'Post', document: 'Document', carousel: 'Carousel', reel: 'Reel', show: 'Show HN' };

  async function api(method, url, body) {
    if (DEMO) return DEMO.api(method, url, body);
    const u = new URL(url, location.origin);
    if (method === 'GET' && S.project) u.searchParams.set('project', S.project);
    const r = await fetch(u, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify({ project: S.project, ...body }) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    return j;
  }
  const thumb = (p) => (DEMO ? DEMO.thumb(p) : `/api/thumb?path=${encodeURIComponent(p)}&project=${encodeURIComponent(S.project)}`);

  // ---------- dates (all in the project's timezone) ----------
  const tz = () => S.data?.project?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const todayYmd = () => new Intl.DateTimeFormat('en-CA', { timeZone: tz(), year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(DEMO?.now ? DEMO.now() : Date.now()));
  const D = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const ymd = (dt) => dt.toISOString().slice(0, 10);
  const add = (s, n) => { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
  const monday = (s) => add(s, -((D(s).getUTCDay() + 6) % 7));
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const nice = (s) => { const d = D(s); return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };
  const rel = (s) => { const t = todayYmd(); return s === t ? 'today' : s === add(t, 1) ? 'tomorrow' : nice(s); };

  // X counts every link as 23 characters and most emoji as 2
  const URL_RE = /(https?:\/\/)?(?:[a-z0-9-]+\.)+(?:com|ai|io|net|org|dev|app|co|me|so|xyz|in|gg)(?:\/[^\s]*)?/gi;
  const xLen = (s) => { let n = 0; const rest = String(s || '').replace(URL_RE, () => { n += 23; return ''; }); for (const ch of rest) n += /\p{Extended_Pictographic}/u.test(ch) ? 2 : 1; return n; };

  // ---------- toast / saved ----------
  let toastT;
  const toast = (msg, ms = 2800) => { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), ms); };
  const saved = (s) => { $('#saved').textContent = s; };

  // ---------- load ----------
  async function load(keepDrawer = true) {
    const d = await api('GET', '/api/state');
    S.data = d; S.project = d.project.id; S.posts = d.posts; S.queue = d.queue;
    if (!S.anchor) S.anchor = todayYmd();
    renderProjects(); renderRange(); renderCal(); renderRail(); renderTop();
    if (S.sel && keepDrawer) {
      const p = S.posts.find((x) => x.id === S.sel);
      if (!p) closeDrawer();
      else if (Date.now() - S.typingAt > 1500) openDrawer(p.id, { quiet: true });
    }
  }

  function renderProjects() {
    const sel = $('#project');
    const ps = S.data.projects.length ? S.data.projects : [S.data.project];
    sel.innerHTML = ps.map((p) => `<option value="${esc(p.id)}"${p.id === S.project ? ' selected' : ''}>${esc(p.title || p.id)}</option>`).join('') + (DEMO ? '' : '<option value="__new">New project…</option>');
  }
  function renderRange() {
    const a = S.view === 'week' ? monday(S.anchor) : S.anchor.slice(0, 8) + '01';
    const h = $('#range');
    if (S.view === 'week') {
      const b = add(a, 6), da = D(a), db = D(b);
      h.innerHTML = da.getUTCMonth() === db.getUTCMonth()
        ? `${da.getUTCDate()} – ${db.getUTCDate()} <em>${MONTH[da.getUTCMonth()]}</em>`
        : `${da.getUTCDate()} ${MON[da.getUTCMonth()]} – ${db.getUTCDate()} <em>${MON[db.getUTCMonth()]}</em>`;
    } else { const d = D(a); h.innerHTML = `${MONTH[d.getUTCMonth()]} <em>${d.getUTCFullYear()}</em>`; }
    $$('.bar .w-seg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === S.view)));
  }

  const postsOn = (day) => S.posts.filter((p) => p.date === day).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
  function card(p, compact = false) {
    const body = p.platform === 'x' && p.parts.length ? p.parts[0] : p.titleLine || p.copy || p.dump;
    const imgs = p.assets.slice(0, 2).map((a) => `<img src="${esc(thumb(a.path))}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`).join('');
    const fmt = p.platform === 'x' && p.parts.length > 1 ? ` · ${p.parts.length}` : '';
    if (compact) return `<button class="post" draggable="true" data-id="${p.id}" type="button" title="${esc(p.title)}"><span class="pf pf--${p.platform}">${SHORT[p.platform]}</span><span class="post__t">${esc(p.title || 'Untitled')}</span><span class="st st--${p.status}">${STATUS_LABEL[p.status]}</span></button>`;
    return `<button class="post${S.sel === p.id ? ' sel' : ''}" draggable="true" data-id="${p.id}" type="button">
      <span class="post__top"><span class="pf pf--${p.platform}" title="${esc(S.data.platforms[p.platform].name)}">${SHORT[p.platform]}${fmt}</span><span class="st st--${p.status}">${STATUS_LABEL[p.status]}</span>${p.time ? `<span class="post__time">${p.time}</span>` : ''}</span>
      <span class="post__t">${esc(p.title || 'Untitled')}</span>
      ${body ? `<span class="post__c">${esc(body)}</span>` : ''}
      ${imgs ? `<span class="post__a">${imgs}${p.assets.length > 2 ? `<span class="more">+${p.assets.length - 2}</span>` : ''}</span>` : ''}
    </button>`;
  }

  function renderCal() {
    const cal = $('#cal'), t = todayYmd();
    if (S.view === 'week') {
      const a = monday(S.anchor);
      cal.innerHTML = `<div class="week">${[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const d = add(a, i), dt = D(d);
        return `<section class="day${d === t ? ' today' : ''}${d < t ? ' past' : ''}" data-drop="${d}" aria-label="${nice(d)}">
          <div class="day__h"><span class="day__n">${dt.getUTCDate()}</span><span class="day__w">${WD[dt.getUTCDay()]}</span></div>
          <div class="day__b">${postsOn(d).map((p) => card(p)).join('')}<button class="day__add" type="button" data-new="${d}">+ Add a post</button></div></section>`;
      }).join('')}</div>`;
    } else {
      const first = S.anchor.slice(0, 8) + '01', start = monday(first), mo = D(first).getUTCMonth();
      cal.innerHTML = `<div class="month">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((w) => `<div class="dow">${w}</div>`).join('')}${Array.from({ length: 42 }, (_, i) => {
        const d = add(start, i), dt = D(d);
        return `<section class="day${d === t ? ' today' : ''}${dt.getUTCMonth() !== mo ? ' out' : ''}" data-drop="${d}" aria-label="${nice(d)}">
          <div class="day__h"><span class="day__n">${dt.getUTCDate()}</span></div>
          <div class="day__b">${postsOn(d).map((p) => card(p, true)).join('')}</div></section>`;
      }).join('')}</div>`;
    }
  }

  function renderRail() {
    const ideas = S.posts.filter((p) => !p.date);
    $('#ideaCount').textContent = ideas.length ? `· ${ideas.length}` : '';
    $('#ideas').innerHTML = ideas.map((p) => card(p)).join('') || '<p class="empty">No loose ideas. Dump one above.</p>';
    const now = DEMO?.now ? DEMO.now() : Date.now();
    const q = S.queue.filter((x) => x.reminded !== 'missed' || x.at > now - 864e5);
    $('#queue').innerHTML = q.map((x) => `<button class="qrow${x.due ? ' due' : ''}" type="button" data-open="${x.id}"><time>${x.due ? 'due' : x.time}</time><span><span class="pf pf--${x.platform}">${SHORT[x.platform]}</span> ${esc(x.title)}<br><small class="hint">${rel(x.date)}${x.reminded && x.reminded !== 'missed' ? ' · reminded' : x.reminded === 'missed' ? ' · missed' : ''}</small></span></button>`).join('')
      || '<p class="empty">Nothing scheduled. Mark a post Scheduled to queue its reminder.</p>';
  }

  function renderTop() {
    const now = DEMO?.now ? DEMO.now() : Date.now();
    const nx = S.queue.find((x) => !x.reminded);
    const b = $('#nextup');
    if (nx) {
      const mins = Math.round((nx.at - now) / 60e3);
      const when = mins <= 0 ? 'due now' : mins < 60 ? `in ${mins} min` : mins < 60 * 20 ? `in ${Math.round(mins / 60)} h` : `${rel(nx.date)} ${nx.time}`;
      b.innerHTML = `<span class="dot"></span>Next: <b>${esc(S.data.platforms[nx.platform].name)}</b> ${when}`;
      b.classList.toggle('due', mins <= 0); b.dataset.open = nx.id; b.hidden = false;
    } else b.hidden = true;
    const ag = $('#agent'); ag.checked = !!S.data.agent?.loaded;
    ag.closest('.rem').hidden = !!DEMO && !DEMO.agent;
  }

  // ---------- drawer ----------
  let saveT, pending = {};
  function patch(fields, { now = false } = {}) {
    const p = S.posts.find((x) => x.id === S.sel); if (!p) return;
    Object.assign(p, fields); Object.assign(pending, fields); S.typingAt = Date.now(); saved('Saving…');
    clearTimeout(saveT);
    const go = async () => {
      const body = pending; pending = {};
      try { const np = await api('PATCH', `/api/posts/${p.id}`, { patch: body }); Object.assign(p, np); saved('Saved'); renderCal(); renderRail(); refreshQueue(); }
      catch (e) { saved(''); toast(`Couldn't save: ${e.message}`); }
    };
    now ? go() : (saveT = setTimeout(go, 450));
  }
  async function refreshQueue() { try { const d = await api('GET', '/api/state'); S.queue = d.queue; S.data.agent = d.agent; renderRail(); renderTop(); } catch {} }

  function openDrawer(id, { quiet = false } = {}) {
    const p = S.posts.find((x) => x.id === id); if (!p) return;
    S.sel = id; const dr = $('#drawer'); dr.hidden = false;
    $('#fTitle').value = p.title;
    $('#fPlatform').innerHTML = Object.entries(S.data.platforms).map(([k, v]) => `<option value="${k}"${k === p.platform ? ' selected' : ''}>${esc(v.name)}</option>`).join('');
    $('#fFormat').innerHTML = S.data.platforms[p.platform].formats.map((f) => `<option value="${f}"${f === p.format ? ' selected' : ''}>${FORMAT_LABEL[f] || f}</option>`).join('');
    const si = S.data.statuses.indexOf(p.status);
    $('#fStatus').innerHTML = S.data.statuses.map((s, i) => `<button type="button" role="radio" aria-checked="${s === p.status}" class="${i < si ? 'done' : ''}" data-status="${s}">${STATUS_LABEL[s]}</button>`).join('');
    $('#fDate').value = p.date || ''; $('#fTime').value = p.time || '';
    $('#fNotes').value = p.notes; $('#fDump').value = p.dump; $('#dumpBox').open = !!p.dump && p.status === 'idea';
    if (!quiet) { $('#best').hidden = true; $('#preview').hidden = true; }
    renderCopy(p); renderAssets(p);
    $('#repTo').innerHTML = ['x', 'linkedin', 'instagram'].filter((k) => k !== p.platform).map((k) => `<label><input type="checkbox" value="${k}" checked> ${S.data.platforms[k].name}</label>`).join('');
    $('#copyBtn').textContent = p.platform === 'x' && p.parts.length > 1 ? 'Copy the thread' : 'Copy the post';
    $('#revealBtn').hidden = !p.assets.length || !!DEMO;
    $('#addFile').hidden = !!DEMO;
    $$('.post').forEach((el) => el.classList.toggle('sel', el.dataset.id === id));
    if (!quiet) $('#drBody').scrollTop = 0;
  }
  function closeDrawer() { S.sel = null; $('#drawer').hidden = true; $$('.post.sel').forEach((el) => el.classList.remove('sel')); }

  function field(label, key, value, { rows = 4, limit, counter = 'len', placeholder = '', idx = null, removable = false, copyable = true } = {}) {
    return `<div class="part"><div class="part__h"><span>${esc(label)}</span>${removable ? `<button type="button" data-rm-part="${idx}">Remove</button>` : ''}${copyable ? `<button type="button" data-copy-field="${esc(key)}"${idx != null ? ` data-idx="${idx}"` : ''}>Copy</button>` : ''}${limit ? `<span class="cnt" data-cnt="${counter}" data-limit="${limit}"></span>` : ''}</div>
      <textarea rows="${rows}" data-k="${esc(key)}"${idx != null ? ` data-idx="${idx}"` : ''} placeholder="${esc(placeholder)}">${esc(value)}</textarea></div>`;
  }
  function renderCopy(p) {
    let h = '';
    if (p.platform === 'x') {
      const parts = p.parts.length ? p.parts : [p.copy || ''];
      h = parts.map((t, i) => field(parts.length > 1 ? `Post ${i + 1}` : 'Post', 'parts', t, { rows: 4, limit: LIMIT.x, counter: 'x', idx: i, removable: parts.length > 1 })).join('')
        + `<button class="w-btn w-btn--outline small" type="button" id="addPart">Add a post to the thread</button>`;
    } else if (p.platform === 'linkedin') {
      h = field('Post', 'copy', p.copy, { rows: 12, limit: LIMIT.linkedin }) + field('First comment', 'firstComment', p.firstComment, { rows: 3, placeholder: 'A link or a line for the first comment (optional)' });
    } else if (p.platform === 'instagram') {
      h = field('Caption', 'copy', p.copy, { rows: 7, limit: LIMIT.instagram });
      const label = p.format === 'reel' ? 'Shot' : 'Slide';
      if (p.format !== 'post') h += (p.parts.length ? p.parts : ['']).map((t, i) => field(`${label} ${i + 1}`, 'parts', t, { rows: 2, idx: i, removable: p.parts.length > 1, copyable: false })).join('')
        + `<button class="w-btn w-btn--outline small" type="button" id="addPart">Add a ${label.toLowerCase()}</button>`;
    } else if (p.platform === 'reddit') {
      h = field('Title', 'titleLine', p.titleLine, { rows: 2, limit: LIMIT.redditTitle }) + field('Post', 'copy', p.copy, { rows: 12 });
    } else if (p.platform === 'hn') {
      h = field('Title', 'titleLine', p.titleLine, { rows: 2, limit: LIMIT.hnTitle }) + field('Link', 'link', p.link, { rows: 1 })
        + field('First comment', 'firstComment', p.firstComment, { rows: 9 });
    }
    $('#fCopy').innerHTML = h;
    counters();
  }
  const grow = (ta) => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px'; };
  function counters() {
    $$('#fCopy textarea').forEach(grow);
    $$('#fCopy .cnt').forEach((c) => {
      const ta = c.closest('.part').querySelector('textarea'), lim = +c.dataset.limit;
      const n = c.dataset.cnt === 'x' ? xLen(ta.value) : [...ta.value].length;
      c.textContent = `${n.toLocaleString()} / ${lim.toLocaleString()}`; c.classList.toggle('over', n > lim);
    });
  }
  function renderAssets(p) {
    $('#fAssets').innerHTML = p.assets.map((a, i) => {
      const name = a.path.split('/').pop();
      return `<div class="thumb"><img src="${esc(thumb(a.path))}" alt="${esc(name)}" onerror="this.style.visibility='hidden'">${a.source === 'wispr-video' ? '<span class="tag">Wispr Video</span>' : /\.(mp4|mov|webm)$/i.test(name) ? '<span class="tag">Video</span>' : ''}
        <button class="x" type="button" data-rm-asset="${i}" aria-label="Remove ${esc(name)}">×</button><span title="${esc(a.path)}">${esc(a.note ? `${name} · ${a.note}` : name)}</span></div>`;
    }).join('') || '<p class="empty">No image or video yet.</p>';
  }

  // ---------- events ----------
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('button, [data-open]'); if (!t) return;
    if (t.matches('.post')) return openDrawer(t.dataset.id);
    if (t.dataset.open) return openDrawer(t.dataset.open);
    if (t.dataset.view) { S.view = t.dataset.view; renderRange(); renderCal(); return; }
    if (t.dataset.new) { const p = await api('POST', '/api/posts', { post: { date: t.dataset.new, status: 'idea', platform: 'linkedin', title: '' } }); S.posts.push(p); renderCal(); openDrawer(p.id); $('#fTitle').focus(); return; }
    if (t.dataset.status) {
      const p = S.posts.find((x) => x.id === S.sel);
      if (t.dataset.status === 'scheduled' && (!p.date || !p.time)) { toast('Pick a day and a time first. Best time can suggest one.'); bestTime(); return; }
      patch({ status: t.dataset.status }, { now: true }); openDrawer(S.sel, { quiet: true });
      if (t.dataset.status === 'scheduled') toast(`Queued. At ${p.time} on ${rel(p.date)} the copy goes on your clipboard.`);
      return;
    }
    if (t.dataset.rmPart != null) { const p = cur(); const parts = [...p.parts]; parts.splice(+t.dataset.rmPart, 1); patch({ parts }); renderCopy(p); return; }
    if (t.dataset.rmAsset != null) { const p = cur(); const assets = [...p.assets]; assets.splice(+t.dataset.rmAsset, 1); patch({ assets }, { now: true }); renderAssets(p); return; }
    if (t.dataset.copyField) {
      const p = cur(), v = t.dataset.idx != null ? p.parts[+t.dataset.idx] : p[t.dataset.copyField];
      return copyText(v, 'Copied');
    }
    if (t.dataset.best) { const [d, tm] = t.dataset.best.split(' '); $('#fDate').value = d; $('#fTime').value = tm; patch({ date: d, time: tm }, { now: true }); $('#best').hidden = true; toast(`Set to ${rel(d)}, ${tm}`); return; }
    if (t.dataset.vpath) { const p = cur(); patch({ assets: [...p.assets, { path: t.dataset.vpath, kind: 'video', source: 'wispr-video', project: t.dataset.vproj }] }, { now: true }); renderAssets(p); $('#vpick').close(); toast('Added from Wispr Video'); return; }
    if (t.dataset.close != null) { t.closest('dialog').close(); return; }
    switch (t.id) {
      case 'prev': case 'next': { const n = t.id === 'prev' ? -1 : 1; if (S.view === 'week') S.anchor = add(S.anchor, 7 * n); else { const d = D(S.anchor); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n); S.anchor = ymd(d); } renderRange(); renderCal(); break; }
      case 'today': S.anchor = todayYmd(); renderRange(); renderCal(); break;
      case 'close': closeDrawer(); break;
      case 'draftBtn': draftDump(); break;
      case 'ideaBtn': keepIdea(); break;
      case 'bestBtn': bestTime(); break;
      case 'addPart': { const p = cur(); const parts = p.parts.length ? [...p.parts, ''] : [p.copy || '', '']; patch({ parts, ...(p.platform === 'x' ? { format: 'thread', copy: '' } : {}) }); renderCopy(p); $$('#fCopy textarea[data-k=parts]').pop()?.focus(); break; }
      case 'addFile': { const r = await api('POST', '/api/choose-files', {}); if (r.files?.length) { const p = cur(); patch({ assets: [...p.assets, ...r.files.map((f) => ({ path: f, kind: /\.(mp4|mov|webm)$/i.test(f) ? 'video' : 'image' }))] }, { now: true }); renderAssets(p); } break; }
      case 'addVideo': videoPicker(); break;
      case 'redraft': { const p = cur(); $('#dump').value = $('#fDump').value; draftDump(p.id); break; }
      case 'repBtn': repurpose(); break;
      case 'copyBtn': { const p = cur(); copyText(p.platform === 'x' && p.parts.length > 1 ? p.parts.map((x, i) => `${i + 1}/\n${x}`).join('\n\n') : (p.titleLine ? `${p.titleLine}\n\n` : '') + (p.copy || p.parts.join('\n\n')), 'Copied. Paste it into the post box.'); break; }
      case 'revealBtn': await api('POST', `/api/posts/${S.sel}/reveal`, {}); break;
      case 'testRem': await api('POST', `/api/posts/${S.sel}/remind`, {}); toast(DEMO ? 'This is the card you get at post time.' : 'Reminder card sent to your screen. The copy is on your clipboard.'); break;
      case 'pubPreview': { const pre = $('#preview'); if (!pre.hidden) { pre.hidden = true; break; } const r = await api('POST', `/api/posts/${S.sel}/preview`, {}); pre.textContent = r.manual ? `${r.manual}\n` : `Off. Nothing is sent. When it ships, this is what would go out:\n\n${JSON.stringify(r.adapters, null, 2)}`; pre.hidden = false; break; }
      case 'delBtn': { if (!confirm('Delete this post? Its copy goes with it.')) break; await api('DELETE', `/api/posts/${S.sel}`); S.posts = S.posts.filter((x) => x.id !== S.sel); closeDrawer(); renderCal(); renderRail(); refreshQueue(); break; }
      case 'nextup': openDrawer(t.dataset.open); break;
    }
  });
  const cur = () => S.posts.find((x) => x.id === S.sel);
  async function copyText(text, msg) {
    try { await navigator.clipboard.writeText(text); toast(msg); }
    catch { if (!DEMO) { await api('POST', `/api/posts/${S.sel}/copy`, { text }); toast(msg); } else toast('Copy blocked by the browser'); }
  }

  $('#drawer').addEventListener('input', (e) => {
    const el = e.target, p = cur(); if (!p) return;
    if (el.id === 'fTitle') return patch({ title: el.value });
    if (el.id === 'fNotes') return patch({ notes: el.value });
    if (el.id === 'fDump') return patch({ dump: el.value });
    if (el.dataset.k === 'parts') { const parts = p.parts.length ? [...p.parts] : [p.copy || '']; parts[+el.dataset.idx] = el.value; patch({ parts, ...(p.platform === 'x' ? { copy: '' } : {}) }); counters(); return; }
    if (el.dataset.k) { patch({ [el.dataset.k]: el.value }); counters(); }
  });
  $('#drawer').addEventListener('change', (e) => {
    const el = e.target, p = cur(); if (!p) return;
    if (el.id === 'fPlatform') { const fm = S.data.platforms[el.value].formats[0]; patch({ platform: el.value, format: fm }, { now: true }); openDrawer(p.id, { quiet: true }); }
    if (el.id === 'fFormat') { patch({ format: el.value }, { now: true }); renderCopy(p); }
    if (el.id === 'fDate' || el.id === 'fTime') patch({ date: $('#fDate').value || null, time: $('#fTime').value || null }, { now: true });
  });
  $('#project').addEventListener('change', async (e) => {
    let v = e.target.value;
    if (v === '__new') { v = (prompt('Name the new project') || '').trim(); if (!v) { renderProjects(); return; } }
    S.project = v; S.sel = null; closeDrawer(); history.replaceState(null, '', `?project=${encodeURIComponent(v)}`); load();
  });
  $('#agent').addEventListener('change', async (e) => {
    try { const r = await api('POST', '/api/agent', { on: e.target.checked }); S.data.agent = r; toast(r.loaded ? 'Reminders run with the app closed (launchd, every minute).' : 'Reminders only while this app is open.'); }
    catch (err) { toast(err.message); e.target.checked = !e.target.checked; }
  });

  // drag and drop: day to day, or back to Ideas
  document.addEventListener('dragstart', (e) => { const c = e.target.closest?.('.post'); if (!c) return; e.dataTransfer.setData('text/plain', c.dataset.id); e.dataTransfer.effectAllowed = 'move'; c.classList.add('dragging'); });
  document.addEventListener('dragend', (e) => e.target.closest?.('.post')?.classList.remove('dragging'));
  document.addEventListener('dragover', (e) => { const z = e.target.closest('[data-drop]'); if (!z) return; e.preventDefault(); $$('.over').forEach((x) => x !== z && x.classList.remove('over')); z.classList.add('over'); });
  document.addEventListener('dragleave', (e) => { const z = e.target.closest('[data-drop]'); if (z && !z.contains(e.relatedTarget)) z.classList.remove('over'); });
  document.addEventListener('drop', async (e) => {
    const z = e.target.closest('[data-drop]'); if (!z) return; e.preventDefault(); z.classList.remove('over');
    const id = e.dataTransfer.getData('text/plain'), p = S.posts.find((x) => x.id === id); if (!p) return;
    const date = z.dataset.drop || null; if (p.date === date) return;
    const fields = { date, ...(date ? {} : { time: null, ...(p.status === 'scheduled' ? { status: 'final' } : {}) }) };
    Object.assign(p, fields); renderCal(); renderRail();
    try { const np = await api('PATCH', `/api/posts/${id}`, { patch: fields }); Object.assign(p, np); refreshQueue(); if (S.sel === id) openDrawer(id, { quiet: true }); toast(date ? `Moved to ${rel(date)}` : 'Back in Ideas'); }
    catch (err) { toast(err.message); load(); }
  });

  // keys (never voice): N, W, M, arrows, T, Esc, ⌘↵
  document.addEventListener('keydown', (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
    if (e.key === 'Escape') { if ($('#vpick').open) return; if (typing) { document.activeElement.blur(); return; } if (S.sel) closeDrawer(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { if (document.activeElement?.id === 'dump') { e.preventDefault(); draftDump(); } return; }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'n') { e.preventDefault(); $('#dump').focus(); }
    else if (k === 'w' || k === 'm') { S.view = k === 'w' ? 'week' : 'month'; renderRange(); renderCal(); }
    else if (k === 't') $('#today').click();
    else if (e.key === 'ArrowLeft') $('#prev').click();
    else if (e.key === 'ArrowRight') $('#next').click();
  });

  // ---------- the model calls ----------
  const busy = (on, text) => { $('#busy').hidden = !on; if (text) $('#busyText').textContent = text; $('#draftBtn').disabled = on; $('#repBtn').disabled = on; };
  async function draftDump(fromId) {
    const dump = $('#dump').value.trim();
    if (!dump) { toast('Say or type the idea first. Rough is fine.'); $('#dump').focus(); return; }
    const platforms = $$('.plats input:checked').map((x) => x.value);
    if (!platforms.length) { toast('Tick at least one platform.'); return; }
    busy(true, `Claude is drafting for ${platforms.length} platform${platforms.length > 1 ? 's' : ''}… usually 20–40 s`);
    try {
      const r = await api('POST', '/api/draft', { dump, platforms, date: $('#dumpDate').value || null, fromId: typeof fromId === 'string' ? fromId : undefined });
      $('#dump').value = ''; await load(false);
      const first = r.posts[0];
      if (first?.date) S.anchor = first.date;
      renderRange(); renderCal();
      if (first) openDrawer(first.id);
      toast(`${r.posts.length} drafts ready${r.ms ? ` in ${Math.round(r.ms / 1000)} s` : ''}. They're marked Draft until you finalise them.`, 4200);
    } catch (e) { toast(`Drafting failed: ${e.message}`, 6000); }
    busy(false);
  }
  async function keepIdea() {
    const dump = $('#dump').value.trim(); if (!dump) { $('#dump').focus(); return; }
    const plat = $$('.plats input:checked').map((x) => x.value)[0] || 'linkedin';
    const p = await api('POST', '/api/posts', { post: { title: dump.split(/[.\n]/)[0].slice(0, 48), dump, status: 'idea', platform: plat, date: $('#dumpDate').value || null } });
    $('#dump').value = ''; S.posts.push(p); renderCal(); renderRail(); toast('Kept as an idea');
  }
  async function repurpose() {
    const to = $$('#repTo input:checked').map((x) => x.value);
    if (!to.length) { toast('Tick a platform to rewrite it for.'); return; }
    busy(true, `Claude is rewriting it for ${to.map((k) => S.data.platforms[k].name).join(' and ')}…`);
    try { const r = await api('POST', '/api/repurpose', { id: S.sel, to }); await load(); toast(`${r.posts.length} new draft${r.posts.length > 1 ? 's' : ''} on ${S.posts.find((x) => x.id === S.sel)?.date ? rel(S.posts.find((x) => x.id === S.sel).date) : 'your Ideas list'}`, 4000); }
    catch (e) { toast(`Repurpose failed: ${e.message}`, 6000); }
    busy(false);
  }
  async function bestTime() {
    const p = cur(); const box = $('#best'); box.hidden = false; box.innerHTML = '<p class="hint">Finding times…</p>';
    const r = await api('POST', '/api/besttime', { platform: p.platform, from: p.date && p.date >= todayYmd() ? p.date : null, id: p.id });
    box.innerHTML = r.suggestions.map((s) => `<button type="button" data-best="${s.date} ${s.time}"><b>${rel(s.date)}, ${s.time}</b><span>${esc(s.audience)}</span><small>${esc(s.why)}</small></button>`).join('')
      + '<p class="hint">Rules of thumb for each platform, in your audience\'s timezones. Not your own analytics.</p>';
  }
  async function videoPicker() {
    const dlg = $('#vpick'); $('#vgrid').innerHTML = '<p class="hint">Reading Wispr Video projects…</p>'; dlg.showModal();
    const r = await api('GET', '/api/video');
    $('#vpickHint').innerHTML = `Exports from your Wispr Video projects. Need a new cut? <a href="${esc(r.editor)}" target="_blank" rel="noopener">Open Wispr Video</a>${r.editorUp ? '' : ' (start it with /video)'}.`;
    $('#vgrid').innerHTML = r.projects.flatMap((pr) => pr.exports.slice(0, 2).map((x) => `<button type="button" data-vpath="${esc(x.path)}" data-vproj="${esc(pr.id)}"><img src="${esc(thumb(x.path))}" alt="" loading="lazy"><b>${esc(pr.title)}</b><span>${esc(x.aspect || '')} · ${(x.bytes / 1e6).toFixed(0)} MB</span></button>`)).join('')
      || '<p class="empty">No exports yet. Export a cut in Wispr Video and it shows up here.</p>';
  }

  // live: the CLI, Claude Code or a reminder changed posts.json
  if (!DEMO && 'EventSource' in window) { const es = new EventSource('/api/events'); es.addEventListener('changed', () => load()); }
  setInterval(() => { renderTop(); }, 60e3);
  window.WisprSocial = { load, S, openDrawer };
  load().catch((e) => { document.body.insertAdjacentHTML('afterbegin', `<p class="toast">${esc(e.message)}</p>`); });
})();
