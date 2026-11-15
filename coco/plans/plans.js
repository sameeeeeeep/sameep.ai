// plans: the four options and the enquiry form.
(function () {
  var $ = function (id) { return document.getElementById(id); };

  // API base: same origin; on localhost only, ?api= may point at a localhost worker
  var API = '/d2c-api';
  try {
    var q = new URLSearchParams(location.search).get('api');
    var localPage = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    if (localPage && q) { var u = new URL(q); if (/^(localhost|127\.0\.0\.1)$/.test(u.hostname)) API = u.origin + '/d2c-api'; }
  } catch (e) { /* keep the default */ }

  // ---------- the four options ----------
  var OPT = {
    build: { name: 'Custom build', line: '₹1,50,000 once. No product updates.' },
    product: { name: 'Subscription', line: '₹10,000 a month. Updates included.' },
    setup: { name: 'Subscription + set-up', line: '₹75,000 upfront, then ₹10,000 a month. Updates included.' },
    all: { name: 'Everything, monthly', line: '₹50,000 a month. Strategy support is billed separately.' }
  };
  var lead = $('lead');
  var fbox = function (n) { return lead.elements[n]; };
  function chosen() { var r = lead.querySelector('input[name="option"]:checked'); return r ? r.value : 'setup'; }
  function formPlan() { var o = chosen(); return { option: o, maintenance: o === 'build' && fbox('f_maint').checked }; }
  function describe(p) { var o = OPT[p.option] || OPT.setup; return o.name + ': ' + o.line + (p.maintenance ? ' Plus ₹10,000 a month for maintenance and support.' : ''); }
  function sync() { var p = formPlan(); $('f-maint-w').hidden = p.option !== 'build'; $('f-plan').textContent = describe(p); }
  lead.addEventListener('change', function (e) { if (e.target.name === 'option' || e.target.name === 'f_maint') sync(); });
  document.querySelectorAll('[data-choose]').forEach(function (b) {
    b.addEventListener('click', function () {
      var r = lead.querySelector('input[name="option"][value="' + b.getAttribute('data-choose') + '"]'); if (r) r.checked = true;
      sync(); $('enquire').scrollIntoView({ block: 'start' });
    });
  });

  var EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;
  function values() {
    var get = function (n) { return (fbox(n).value || '').trim(); };
    var checked = function (n) { return Array.prototype.filter.call(lead.querySelectorAll('input[name="' + n + '"]'), function (i) { return i.checked; }).map(function (i) { return i.value; }); };
    var radio = function (n) { var r = lead.querySelector('input[name="' + n + '"]:checked'); return r ? r.value : ''; };
    return {
      company: get('company'), name: get('name'), role: get('role'), email: get('email'), phone: get('phone'),
      stage: radio('stage'), team_size: radio('team_size'), channels: checked('channels'), tools: checked('tools'),
      tools_other: get('tools_other'), run_first: get('run_first'), plan: formPlan(), start_day: get('start_day'),
      notes: get('notes'), website: fbox('website').value
    };
  }
  function check(v) {
    var e = {};
    if (v.company.length < 2) e.company = 'Add your company or brand name.';
    if (v.name.length < 2) e.name = 'Add your name.';
    if (!EMAIL_RE.test(v.email)) e.email = 'Add a work email I can reply to.';
    if (v.phone && !/^[+()\d\s-]{7,24}$/.test(v.phone)) e.phone = 'Use digits, spaces and + only.';
    if (!v.stage) e.stage = 'Pick the closest stage.';
    if (!v.team_size) e.team_size = 'Pick a team size.';
    if (v.run_first.length < 8) e.run_first = 'Tell me one thing you want it to run first.';
    return e;
  }
  function showErrors(e) {
    lead.querySelectorAll('.err').forEach(function (el) {
      var k = el.getAttribute('data-for'); el.textContent = e[k] || '';
      var wrap = el.closest('.f'); if (wrap) wrap.classList.toggle('has-err', !!e[k]);
    });
    var first = Object.keys(e)[0];
    if (first) { var inp = lead.querySelector('[name="' + first + '"]'); if (inp) inp.focus({ preventScroll: false }); }
  }
  lead.addEventListener('input', function (ev) {
    var n = ev.target.name; var el = lead.querySelector('.err[data-for="' + n + '"]');
    if (el && el.textContent) { el.textContent = ''; var w = el.closest('.f'); if (w) w.classList.remove('has-err'); }
  });
  lead.addEventListener('change', function (ev) {
    var el = lead.querySelector('.err[data-for="' + ev.target.name + '"]'); if (el) el.textContent = '';
  });

  function mailtoFallback(v) {
    var lines = ['Company: ' + v.company, 'Name: ' + v.name, 'Role: ' + v.role, 'Email: ' + v.email, 'Phone: ' + v.phone,
      'Stage: ' + v.stage, 'Team: ' + v.team_size, 'Channels: ' + v.channels.join(', '), 'Tools: ' + v.tools.concat(v.tools_other ? [v.tools_other] : []).join(', '),
      'Run first: ' + v.run_first, 'Plan: ' + describe(v.plan), 'Start: ' + v.start_day, 'Notes: ' + v.notes];
    return 'mailto:hello@sameep.ai?subject=' + encodeURIComponent('Chief of Staff enquiry: ' + v.company) + '&body=' + encodeURIComponent(lines.join('\n'));
  }

  lead.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var v = values(), errs = check(v), fe = $('form-err');
    fe.hidden = true; fe.textContent = '';
    showErrors(errs);
    if (Object.keys(errs).length) return;
    var btn = $('send'); btn.disabled = true; btn.textContent = 'Sending…';
    fetch(API + '/leads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(v) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, data: d }; }); })
      .then(function (r) {
        if (r.status === 200 && r.data && r.data.ok) {
          lead.hidden = true; var d = $('done'); d.hidden = false; d.focus(); return;
        }
        if (r.status === 400 && r.data && r.data.fields) { showErrors(r.data.fields); throw { quiet: true }; }
        if (r.status === 429) { fe.textContent = (r.data && r.data.error) || 'Too many enquiries right now.'; fe.hidden = false; throw { quiet: true }; }
        throw new Error('api');
      })
      .catch(function (e) {
        if (e && e.quiet) return;
        fe.textContent = '';
        fe.append('The form could not reach me just now. ');
        var a = document.createElement('a'); a.href = mailtoFallback(v); a.textContent = 'Send it by email instead';
        fe.append(a); fe.append(', it is already filled in.');
        fe.hidden = false;
      })
      .then(function () { btn.disabled = false; btn.textContent = 'Send'; });
  });

  sync();
})();
