// Wispr Social, zero-setup demo: the real app UI over an in-memory store (window.WisprSocialSeed). Nothing leaves the
// tab: drafting returns a written sample (on a Mac, your own claude -p writes from your words), the reminder card is
// drawn in the page, and publishing is off exactly as in the app. The clock is fixed to 6 Nov 2026, 8:00 IST.
(() => {
  const SEED = window.WisprSocialSeed;
  const NOW = Date.UTC(2026, 10, 6, 2, 30);   // 08:00 IST
  const TZ = SEED.meta.timezone;
  const PLATFORMS = {
    x: { name: 'X', formats: ['thread', 'post'], limit: 280 }, linkedin: { name: 'LinkedIn', formats: ['post', 'document'], limit: 3000 },
    instagram: { name: 'Instagram', formats: ['carousel', 'reel', 'post'], limit: 2200 }, reddit: { name: 'Reddit', formats: ['post'], limit: 40000 },
    hn: { name: 'Hacker News', formats: ['show'], limit: 4000 },
  };
  const STATUSES = ['idea', 'draft', 'review', 'approved', 'scheduled', 'posted'];
  const CONTENT = ['platform', 'format', 'copy', 'parts', 'firstComment', 'titleLine', 'link', 'assets'];
  let n = 0; const id = () => 'd' + (++n).toString(36) + Math.random().toString(36).slice(2, 6);
  const norm = (p) => ({ id: id(), title: '', platform: 'linkedin', format: 'post', status: 'idea', date: null, time: null, copy: '', parts: [], firstComment: '', titleLine: '', link: '', assets: [], notes: '', dump: '', group: null, reminded: null, created: new Date(NOW).toISOString(), ...p });
  let posts = SEED.posts.map((p) => norm({ ...p, status: ['final', 'scheduled', 'approved'].includes(p.status) ? 'review' : p.status }));

  const tzOffset = (tz, at) => {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const o = Object.fromEntries(f.formatToParts(new Date(at)).map((x) => [x.type, x.value]));
    return Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour, +o.minute, +o.second) - at;
  };
  const instant = (p) => { const [y, mo, d] = p.date.split('-').map(Number); const [h, mi] = (p.time || '09:00').split(':').map(Number); const g = Date.UTC(y, mo - 1, d, h, mi); return g - tzOffset(TZ, g); };
  const queue = () => posts.filter((p) => p.status === 'scheduled' && p.date && p.approvedAt).map((p) => ({ id: p.id, title: p.title, platform: p.platform, date: p.date, time: p.time, at: instant(p), due: instant(p) <= NOW, reminded: p.reminded, inMin: Math.round((instant(p) - NOW) / 60e3) })).sort((a, b) => a.at - b.at);

  // best time: the same rules as lib/times.mjs
  const WD = [1, 2, 3, 4, 5], MID = [2, 3, 4], WE = [0, 6];
  const WIN = { linkedin: [[MID, 8, 10, 1], [[1, 5], 8, 10, .8], [WD, 12, 13, .7], [WD, 17, 18, .5], [WE, 9, 11, .3]], x: [[WD, 9, 11, 1], [WD, 12, 13, .8], [WD, 17, 18, .65], [WE, 10, 12, .45]],
    instagram: [[WD, 11, 13, 1], [WD, 19, 21, .9], [WE, 10, 12, .7]], reddit: [[WD, 6, 9, 1], [WE, 8, 11, .75], [WD, 12, 14, .6]], hn: [[MID, 8, 10, 1], [[1, 5], 8, 10, .85], [WE, 9, 11, .45]] };
  const WHY = { linkedin: 'LinkedIn is read most on weekday mornings, Tuesday to Thursday best', x: 'X is busiest late weekday mornings', instagram: 'Instagram peaks at lunch and in the evening', reddit: 'r/ subreddits move fastest in the US morning', hn: 'Show HN does best on a weekday, 8–10am US Eastern' };
  const local = (tz, at) => { const d = new Date(at + tzOffset(tz, at)); return { day: d.getUTCDay(), hour: d.getUTCHours() + d.getUTCMinutes() / 60, ymd: d.toISOString().slice(0, 10), hm: d.toISOString().slice(11, 16) }; };
  const ws = (pl, day, h) => { let s = .08; for (const [ds, a, b, w] of WIN[pl]) if (ds.includes(day) && h >= a && h < b) s = Math.max(s, w); return s; };
  const short = (tz) => ({ 'Asia/Kolkata': 'IST', 'America/New_York': 'ET' }[tz] || tz);
  function suggest(platform, from, exclude) {
    const aud = platform === 'hn' || platform === 'reddit' ? ['America/New_York'] : SEED.meta.audience;
    const start = instant({ date: from || local(TZ, NOW).ymd, time: '00:00' });
    const taken = posts.filter((p) => p.id !== exclude && p.date && p.status !== 'idea').map((p) => ({ at: instant(p), platform: p.platform }));
    const slots = [];
    for (let at = start; at < start + 7 * 864e5; at += 30 * 60e3) {
      if (at < NOW + 20 * 60e3) continue;
      const mine = local(TZ, at);
      let s = aud.reduce((t, a) => { const l = local(a, at); return t + ws(platform, l.day, l.hour); }, 0) / aud.length;
      if (!(mine.hour >= 7.5 && mine.hour < 23.5)) s *= .25;
      let clash = '';
      for (const t of taken) { const g = Math.abs(t.at - at) / 36e5; if (t.platform === platform && g < 4) { s *= .2; clash = 'another post on this platform within 4 hours'; } else if (g < 1) { s *= .6; clash ||= 'another post within the hour'; } }
      slots.push({ at, date: mine.ymd, time: mine.hm, s, clash });
    }
    slots.sort((a, b) => b.s - a.s || a.at - b.at);
    const pick = []; for (const sl of slots) { if (pick.length >= 3) break; if (!pick.some((p) => Math.abs(p.at - sl.at) < 3 * 36e5)) pick.push(sl); }
    return pick.map((p) => ({ date: p.date, time: p.time, audience: aud.map((a) => `${local(a, p.at).hm} ${short(a)}`).join(' · '), why: WHY[platform] + (p.clash ? `; note: ${p.clash}` : '') }));
  }

  // the reminder, drawn like the Wispr Bridge card
  function remindCard(p) {
    const steps = [];
    if (p.platform === 'x' && p.parts.length) p.parts.forEach((t, i) => steps.push({ label: `post ${i + 1} of ${p.parts.length}`, text: t }));
    else if (p.platform === 'reddit' || p.platform === 'hn') { if (p.titleLine) steps.push({ label: 'the title', text: p.titleLine }); if (p.link) steps.push({ label: 'the link', text: p.link }); if (p.copy) steps.push({ label: 'the post', text: p.copy }); }
    else steps.push({ label: p.platform === 'instagram' ? 'the caption' : 'the post', text: p.copy });
    if (p.firstComment) steps.push({ label: 'the first comment', text: p.firstComment });
    let at = 0;
    const el = document.createElement('div'); el.className = 'bcard'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Reminder');
    const name = PLATFORMS[p.platform].name;
    const draw = (sub) => {
      const opts = [`Open ${name}`]; if (at + 1 < steps.length) opts.push(`Copy ${steps[at + 1].label}`); opts.push(`Copy ${steps[at].label} again`, 'I posted it', 'Snooze 15 minutes');
      el.innerHTML = `<p class="bcard__k">Wispr Social</p><p class="bcard__t">Time to post: ${name} · ${esc(p.title)}</p><p class="bcard__s">${esc(sub)}</p>
        <ol>${opts.map((o, i) => `<li><button type="button" data-i="${i}"><span>${i + 1}</span>${esc(o)}</button></li>`).join('')}</ol>
        <div class="bcard__f"><span>Press <kbd class="w-kbd">1</kbd>–<kbd class="w-kbd">${opts.length}</kbd> to pick</span><button type="button" class="w-btn w-btn--outline" data-x>Not now</button></div>`;
      el.opts = opts;
    };
    const asset = p.assets[0];
    draw(`${cap(steps[0].label)} is on your clipboard${asset ? `. ${asset.path.split('/').pop()} is selected in Finder` : ''}.`);
    try { navigator.clipboard.writeText(steps[0].text); } catch {}
    const close = () => { el.remove(); document.removeEventListener('keydown', key); };
    const act = (i) => {
      const o = el.opts[i]; if (!o) return;
      if (o.startsWith('Open')) { draw(`On your Mac this opens ${name}'s compose box. (Not in this demo.)`); return; }
      if (o.startsWith('Copy') && !o.endsWith('again')) { at++; draw(`Copied ${steps[at].label}.`); try { navigator.clipboard.writeText(steps[at].text); } catch {} return; }
      if (o.endsWith('again')) { draw(`Copied ${steps[at].label}.`); try { navigator.clipboard.writeText(steps[at].text); } catch {} return; }
      if (o === 'I posted it') { p.status = 'posted'; close(); window.WisprSocial.load(); return; }
      close();
    };
    el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.x != null) return close(); act(+b.dataset.i); });
    const key = (e) => { if (/^[1-9]$/.test(e.key)) { e.preventDefault(); act(+e.key - 1); } if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', key);
    document.querySelectorAll('.bcard').forEach((x) => x.remove());
    document.body.appendChild(el);
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function api(method, url, body = {}) {
    const p = url.split('?')[0]; let m;
    if (method === 'GET' && p === '/api/state') return { project: { id: SEED.project, ...SEED.meta }, projects: [{ id: SEED.project, ...SEED.meta }], posts: posts.map((x) => ({ ...x })), queue: queue(), platforms: PLATFORMS, statuses: STATUSES, adapters: [], agent: { loaded: false }, now: NOW };
    if (method === 'POST' && p === '/api/posts') { const x = norm({ ...body.post }); posts.push(x); return { ...x }; }
    if ((m = p.match(/^\/api\/posts\/([\w-]+)$/))) {
      const x = posts.find((y) => y.id === m[1]);
      if (method === 'PATCH') {
        const pt = body.patch, gated = ['approved', 'scheduled'];
        if (pt.status === 'approved' && x.status !== 'scheduled') throw new Error('Only the Approve button approves a post.');
        if (gated.includes(pt.status) && !gated.includes(x.status)) throw new Error('Approve it first. Nothing is scheduled without your OK.');
        const changed = CONTENT.some((k) => k in pt && JSON.stringify(pt[k]) !== JSON.stringify(x[k]));
        Object.assign(x, pt); let sentBack = false;
        if (changed && gated.includes(x.status)) { x.status = 'review'; x.approvedAt = null; sentBack = true; }
        if (pt.date !== undefined || pt.time !== undefined) x.reminded = null;
        return { ...x, sentBack };
      }
      if (method === 'DELETE') { posts = posts.filter((y) => y.id !== m[1]); return {}; }
    }
    if (method === 'POST' && p === '/api/draft') {
      await wait(1600);
      const group = id(), t = 'Sample: your brain dump';
      const made = (body.platforms || []).map((pl) => norm({ ...SEED.sample[pl], title: t, status: 'draft', dump: body.dump, group, date: body.date || null,
        notes: 'Demo sample. On your Mac, your own Claude writes these from exactly what you said, in about 15–40 seconds.' }));
      posts.push(...made); return { posts: made, ms: 1600 };
    }
    if (method === 'POST' && p === '/api/repurpose') {
      await wait(1400);
      const src = posts.find((y) => y.id === body.id), group = src.group || src.id; src.group = group;
      const made = body.to.map((pl) => norm({ ...SEED.sample[pl], title: src.title, status: 'draft', group, date: src.date, assets: src.assets,
        notes: 'Demo sample. On your Mac, Claude rewrites the post you opened for this platform.' }));
      posts.push(...made); return { posts: made, ms: 1400 };
    }
    if ((m = p.match(/^\/api\/posts\/([\w-]+)\/approve$/))) {
      const x = posts.find((y) => y.id === m[1]);
      x.approvedAt = new Date(NOW).toISOString(); x.status = x.date && x.time ? 'scheduled' : 'approved';
      return { ...x };
    }
    if (method === 'POST' && p === '/api/besttime') return { suggestions: suggest(body.platform, body.from, body.id) };
    if ((m = p.match(/^\/api\/posts\/([\w-]+)\/(remind|preview|copy)$/))) {
      const x = posts.find((y) => y.id === m[1]);
      if (m[2] === 'remind') { remindCard(x); return { ok: true }; }
      if (m[2] === 'preview') {
        const ad = await import('./adapters.mjs');
        return { adapters: ad.previewFor(x), manual: ad.MANUAL_ONLY[x.platform] || null };
      }
      return { ok: true };
    }
    if (p === '/api/video') return { projects: SEED.video, editor: '/wispr-editor/', editorUp: true };
    if (p === '/api/choose-files') { window.WisprSocial && document.getElementById('toast') && null; return { files: [] }; }
    throw new Error('Not in the demo');
  }
  window.WisprSocialDemo = { api, thumb: (path) => SEED.thumbs[path] || '', now: () => NOW };
})();
