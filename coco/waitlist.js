/* waitlist.js: the Coco waitlist on the landing (sameep.ai/coco). A small "Join the waitlist" pill, always there and out
   of the story's way, opens the form in a sheet; the story's end card carries the same form (v20.js endCard calls
   cocoWaitlist.mount). Two quick taps (what you'd hand Coco first, who you are), then an email. POST /api/waitlist,
   source 'landing' (analytics/src/waitlist.js). Joining shows your own agent: a dot person drawn from your name.
   API: window.cocoWaitlist.open(), .mount(host) */
(function () {
  'use strict';
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var ov = new URLSearchParams(location.search).get('api') || '';
  var API = (!LOCAL ? '' : /^http:\/\/(localhost|127\.0\.0\.1):\d{1,5}$/.test(ov) ? ov : 'http://localhost:8790') + '/api/waitlist';
  var PICKS = [['inbox', 'My inbox'], ['reorders', 'Reorders and stock'], ['hiring', 'Hiring'], ['launches', 'Launches'], ['content', 'Content'], ['other', 'Something else']];
  var ROLES = [['founder', 'Founder'], ['team', 'On a team'], ['agency', 'An agency']];
  var KEY = 'coco-waitlist';
  var track = function () {};
  if (/(^|\.)sameep\.ai$/.test(location.hostname)) import('/js/analytics.js').then(function (m) { track = m.track; }).catch(function () {});

  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function ls(v) { try { if (v === undefined) return localStorage.getItem(KEY); localStorage.setItem(KEY, v); } catch (e) { return null; } return null; }
  /* the story listens for taps and keys on the page: nothing typed or tapped in here reaches it */
  function fence(el) { ['click', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'keydown', 'keyup', 'wheel'].forEach(function (t) { el.addEventListener(t, function (e) { e.stopPropagation(); }, { passive: t !== 'keydown' }); }); }

  var css = '' +
    '.cw-pill{position:fixed;z-index:2147483000;right:max(12px,env(safe-area-inset-right));top:calc(max(10px,env(safe-area-inset-top)) + 52px);height:34px;padding:0 14px;border:1px solid rgba(244,241,234,.35);border-radius:999px;background:#0b0b0b;color:#f4f1ea;font:600 13px/1 Inter,-apple-system,system-ui,sans-serif;cursor:pointer;white-space:nowrap}' +
    'body:has(.v-end.is-modal) .cw-pill,body:has(.is-offer) .cw-pill,body:has(.vl) .cw-pill{display:none}' +
    '.cw-pill:hover{background:#f4f1ea;color:#0b0b0b}.cw-pill:focus-visible{outline:2px solid #f4f1ea;outline-offset:3px}' +
    '.cw-back{position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px}' +
    '.cw-sheet{position:relative;width:min(440px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:#0b0b0b;color:#f4f1ea;border-radius:18px;padding:22px 20px 20px;font:400 14px/1.5 Inter,-apple-system,system-ui,sans-serif}' +
    '.cw-x{position:absolute;top:10px;right:10px;width:36px;height:36px;border:0;border-radius:999px;background:#1c1b19;color:#f4f1ea;font-size:18px;cursor:pointer}' +
    '.cw-t{margin:0 40px 4px 0;font:600 26px/1.1 "Clash Display",Inter,sans-serif}.cw-s{margin:0 0 18px;color:#b9b3a7;font-size:14px}' +
    '.cw-q{margin:0 0 8px;font-weight:600;font-size:14px}.cw-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 16px}' +
    '.cw-chip{min-height:34px;padding:0 12px;border:1px solid #45423d;border-radius:999px;background:transparent;color:#d9d3c7;font:500 13px Inter,-apple-system,system-ui,sans-serif;cursor:pointer}' +
    '.cw-chip:hover{border-color:#8c877e}.cw-chip[aria-pressed="true"]{background:#f4f1ea;border-color:#f4f1ea;color:#0b0b0b}' +
    '.cw-row{display:flex;gap:8px}.cw-email{box-sizing:border-box;flex:1;min-width:0;height:44px;padding:0 12px;border:1px solid #45423d;border-radius:10px;background:#141312;color:#f4f1ea;font:400 16px Inter,-apple-system,system-ui,sans-serif}' +
    '.cw-email::placeholder{color:#77726a}.cw-go{box-sizing:border-box;height:44px;padding:0 16px;border:0;border-radius:10px;background:#f4f1ea;color:#0b0b0b;font:700 14px Inter,-apple-system,system-ui,sans-serif;cursor:pointer;white-space:nowrap}' +
    '.cw-go:disabled{opacity:.6}.cw-err{min-height:18px;margin:6px 0 0;color:#ff9b85;font-size:13px}' +
    '.cw-chip:focus-visible,.cw-go:focus-visible,.cw-email:focus-visible,.cw-x:focus-visible{outline:2px solid #f4f1ea;outline-offset:2px}' +
    '.cw-done{display:flex;gap:16px;align-items:center}.cw-agent{width:96px;height:96px;border-radius:50%;flex:none}' +
    '.cw-in{width:100%;margin:0 0 6px;text-align:left}.cw-in .cw-q{color:inherit}.cw-in .cw-chip{border-color:#cfc9be;color:#2b2926}.cw-in .cw-chip:hover{border-color:#8c877e}' +
    '.cw-in .cw-chip[aria-pressed="true"]{background:#0b0b0b;border-color:#0b0b0b;color:#f4f1ea}.cw-in .cw-email{background:#fff;border-color:#cfc9be;color:#0b0b0b}.cw-in .cw-email::placeholder{color:#8f8a81}' +
    '.cw-in .cw-go{background:#0b0b0b;color:#f4f1ea}.cw-in .cw-err{color:#b3261e}.cw-in .cw-s{color:#5c5850}.cw-in .cw-chip:focus-visible,.cw-in .cw-go:focus-visible,.cw-in .cw-email:focus-visible{outline-color:#0b0b0b}' +
    '.v-modal:has(.cw-in){max-height:calc(100dvh - 32px);overflow:auto;padding-top:32px}@media (max-width:520px){.v-modal:has(.cw-in) .v-mw{font-size:56px}.v-modal:has(.cw-in) .v-mt{font-size:17px;margin-bottom:6px}.v-modal:has(.cw-in){padding:24px 18px 18px}}' +
    '@media (max-width:520px){.cw-row{flex-direction:column}.cw-email{flex:none;width:100%}.cw-go{width:100%}.cw-pill{height:32px;padding:0 12px;font-size:12px}}';

  /* the form, anywhere: the sheet, or the story's end card (light: inherit the card's colours) */
  function form(where) {
    var picks = {}, role = null, wrap = h('div', 'cw-form');
    var joined = ls();
    if (joined) { wrap.appendChild(thanks(joined, true)); return wrap; }
    function chips(list, multi) {
      var row = h('div', 'cw-chips');
      list.forEach(function (p) {
        var b = h('button', 'cw-chip', p[1]); b.type = 'button'; b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', function () {
          if (multi) picks[p[0]] = !picks[p[0]]; else role = role === p[0] ? null : p[0];
          [].forEach.call(row.children, function (c, n) { c.setAttribute('aria-pressed', String(multi ? !!picks[list[n][0]] : role === list[n][0])); });
        });
        row.appendChild(b);
      });
      return row;
    }
    var f = h('form'); f.noValidate = true;
    f.appendChild(h('p', 'cw-q', 'What would you hand Coco first?')); f.appendChild(chips(PICKS, true));
    f.appendChild(h('p', 'cw-q', 'You are…')); f.appendChild(chips(ROLES, false));
    var row = h('div', 'cw-row'), em = h('input', 'cw-email'), go = h('button', 'cw-go', 'Join the waitlist'), err = h('p', 'cw-err');
    em.type = 'email'; em.autocomplete = 'email'; em.inputMode = 'email'; em.placeholder = 'you@yourbrand.com'; em.setAttribute('aria-label', 'Your email');
    go.type = 'submit'; err.setAttribute('role', 'alert');
    var trap = h('input'); trap.name = 'website'; trap.tabIndex = -1; trap.autocomplete = 'off'; trap.setAttribute('aria-hidden', 'true'); trap.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px';
    row.appendChild(em); row.appendChild(go); f.appendChild(row); f.appendChild(trap); f.appendChild(err);
    em.addEventListener('input', function () { err.textContent = ''; });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = em.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v)) { err.textContent = v ? 'That email doesn’t look right.' : 'Add your email first.'; em.focus(); return; }
      go.disabled = true; go.textContent = 'Joining…';
      var chosen = Object.keys(picks).filter(function (k) { return picks[k]; });
      fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: v, picks: chosen, role: role, source: 'landing', website: trap.value }) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || ''); return d; }); })
        .then(function (d) {
          track('coco_join', { from: where === 'end' ? 'end' : 'landing', role: role || 'none', n: chosen.length });
          var name = v.split('@')[0]; ls(name);
          wrap.replaceChildren(thanks(name, d.already));
        })
        .catch(function (x) { err.textContent = (x && x.message) || 'Couldn’t join just now. Try again in a minute.'; go.disabled = false; go.textContent = 'Join the waitlist'; });
    });
    wrap.appendChild(f);
    return wrap;
  }

  function thanks(name, already) {
    var d = h('div', 'cw-done'), cv = h('canvas', 'cw-agent'); cv.width = cv.height = 192; cv.setAttribute('aria-hidden', 'true'); drawAgent(cv, name);
    var t = h('div'); t.appendChild(h('p', 'cw-q', pretty(name) + '’s agent'));
    t.appendChild(h('p', 'cw-s', already ? 'You’re on the list. This is your agent; it’s saved.' : 'Your agent is saved. We’ll write when it’s your turn.'));
    t.lastChild.style.margin = '0'; d.setAttribute('role', 'status'); d.appendChild(cv); d.appendChild(t); return d;
  }
  function pretty(s) { var t = String(s || 'you').split(/[._\-+\d]+/).filter(Boolean)[0] || 'Your'; return t[0].toUpperCase() + t.slice(1).toLowerCase(); }

  var back = null, pill = null;
  function open() {
    if (back) return;
    back = h('div', 'cw-back'); fence(back);
    var s = h('div', 'cw-sheet'); s.setAttribute('role', 'dialog'); s.setAttribute('aria-modal', 'true'); s.setAttribute('aria-label', 'Join the Coco waitlist');
    var x = h('button', 'cw-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.addEventListener('click', close);
    s.appendChild(x); s.appendChild(h('p', 'cw-t', 'Join the waitlist')); s.appendChild(h('p', 'cw-s', 'Coco is in private use. Tell us what you’d hand it first and we’ll write when it’s your turn.'));
    s.appendChild(form('pill')); back.appendChild(s);
    back.addEventListener('click', function (e) { if (e.target === back) close(); });
    back.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    document.body.appendChild(back); if (pill) pill.hidden = true;
    track('coco_open', { from: 'landing' });
    setTimeout(function () { var c = s.querySelector('.cw-chip') || x; c.focus({ preventScroll: true }); }, 30);
  }
  function close() { if (!back) return; back.remove(); back = null; if (pill) { pill.hidden = false; pill.focus({ preventScroll: true }); } }
  function mount(host) { var b = h('div', 'cw-in'); fence(b); b.appendChild(form('end')); host.appendChild(b); return b; }

  function boot() {
    var st = h('style'); st.textContent = css; document.head.appendChild(st);
    pill = h('button', 'cw-pill', 'Join the waitlist'); pill.type = 'button'; fence(pill); pill.addEventListener('click', open);
    document.body.appendChild(pill);
  }
  window.cocoWaitlist = { open: open, mount: mount };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  /* a dot person from a name (13 x 13), the same as the desktop's (site/js/app/coco.js) */
  var N = 13;
  function dd(x, y, cx, cy, rx, ry) { ry = ry || rx; return Math.pow((x - cx) / rx, 2) + Math.pow((y - cy) / ry, 2) <= 1; }
  function sh(x, y) { return y >= 9 && dd(x, y, 6, 13.2, 5.8, 4.6); }
  function hd(x, y) { return dd(x, y, 6, 4.6, 2.8); }
  var HAIR = {
    bob: function (x, y) { return dd(x, y, 6, 5, 2.4, 2.7) && y >= 3.6 ? 'S' : dd(x, y, 6, 4.6, 4.1, 3.9) && y <= 7 ? 'H' : 0; },
    short: function (x, y) { return hd(x, y) ? (y <= 2 ? 'H' : 'S') : 0; },
    curls: function (x, y) { return dd(x, y, 6, 5, 2.2, 2.4) && y >= 3.5 ? 'S' : dd(x, y, 6, 4.2, 4.6, 4) && y <= 7 ? 'H' : 0; },
    long: function (x, y) { return hd(x, y) ? (y < 3 ? 'H' : 'S') : y >= 3 && y <= 9 && [2, 3, 9, 10].indexOf(x) >= 0 ? 'H' : 0; },
    bun: function (x, y) { return hd(x, y) ? (y <= 2 ? 'H' : 'S') : dd(x, y, 6, 0.6, 1.4) ? 'H' : 0; },
    buzz: function (x, y) { return hd(x, y) ? (y <= 1.9 ? 'H' : 'S') : 0; }
  };
  var ACC = {
    none: function () { return 0; },
    glasses: function (x, y) { return y === 5 && [4, 6, 8].indexOf(x) >= 0 ? 'A' : 0; },
    headset: function (x, y) { var r = Math.hypot(x - 6, y - 4.6); if (y <= 4 && r > 3.3 && r < 4.4) return 'A'; if ((x === 2 || x === 10) && (y === 4 || y === 5)) return 'A'; return y === 7 && (x === 8 || x === 9) ? 'A' : 0; },
    earring: function (x, y) { return (x === 3 || x === 9) && y === 7 ? 'A' : 0; }
  };
  var SK = ['#f1c9a5', '#e0ac83', '#c68a5e', '#9a6440', '#6e4528'], HC = ['#1d1a17', '#4a2e1e', '#8a4b2a', '#c9a14a', '#b84a3a', '#5e6ad2', '#d46a9a', '#e9e4d8'];
  var CL = ['#e9a03b', '#3f8f7a', '#d85a30', '#5e6ad2', '#c2b8a3', '#d4537e', '#7f77dd'], AC = ['#f4f1ea', '#e9a03b', '#9fe1cb'];
  function hash(s) { var x = 2166136261; String(s).toLowerCase().split('').forEach(function (c) { x = Math.imul(x ^ c.charCodeAt(0), 16777619); }); return x >>> 0; }
  function drawAgent(cv, name) {
    var x0 = hash(name);
    function p(a) { var v = a[x0 % a.length]; x0 = Math.imul(x0 ^ (x0 >>> 13), 2654435761) >>> 0; return v; }
    var hair = p(Object.keys(HAIR)), acc = p(['none', 'none', 'glasses', 'headset', 'earring']);
    var col = { S: p(SK), H: p(HC), C: p(CL), A: p(AC), E: '#141414' };
    var g = cv.getContext('2d'), s = cv.width, st = s / N, R = st * 0.38;
    g.fillStyle = '#161514'; g.fillRect(0, 0, s, s);
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      var r = ACC[acc](x, y) || HAIR[hair](x, y) || (sh(x, y) ? 'C' : 0);
      if (r === 'S' && y === 5 && (x === 5 || x === 7)) r = 'E';
      g.fillStyle = r ? col[r] : '#2a2826'; g.beginPath(); g.arc(x * st + st / 2, y * st + st / 2, r && r !== 'E' ? R : R * 0.55, 0, 7); g.fill();
    }
  }
})();
