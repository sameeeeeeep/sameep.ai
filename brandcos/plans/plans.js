// brandcos/plans: the plan builder (same pricing as d2c-clone/pricing/pricing.js) and the enquiry form.
(function () {
  var PRICE = { integration: 1000, access: 100, extraWeeks: 100, custom: 100 };
  var HOURS = { base: 6, extraWeeks: 6, custom: 6 };
  var PRESETS = { budget: { m1: false, m2: false, custom: false }, balanced: { m1: true, m2: false, custom: false }, hands: { m1: true, m2: true, custom: true } };
  var NAMES = { budget: 'Budgeted', balanced: 'Balanced', hands: 'Hands-on' };
  var $ = function (id) { return document.getElementById(id); };
  var usd = function (n) { return '$' + n.toLocaleString('en-US'); };
  var hrs = function (n) { return n === 1 ? '1 hour' : (Math.round(n * 10) / 10) + ' hours'; };

  // API base: same origin; on localhost only, ?api= may point at a localhost worker
  var API = '/d2c-api';
  try {
    var q = new URLSearchParams(location.search).get('api');
    var localPage = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    if (localPage && q) { var u = new URL(q); if (/^(localhost|127\.0\.0\.1)$/.test(u.hostname)) API = u.origin + '/d2c-api'; }
  } catch (e) { /* keep the default */ }

  // ---------- builder ----------
  var form = $('plan');
  var box = function (n) { return form.elements[n]; };
  function state() {
    return {
      m1: box('m1').checked, m2: box('m2').checked, custom: box('custom').checked,
      teams: Array.prototype.filter.call(form.querySelectorAll('input[name="team"]'), function (i) { return i.checked; }).map(function (i) { return i.value; })
    };
  }
  function priced(s) {
    return {
      m1: PRICE.integration + (s.m1 ? PRICE.extraWeeks : 0) + (s.custom ? PRICE.custom : 0),
      m2: PRICE.access + (s.m2 ? PRICE.extraWeeks : 0) + (s.custom ? PRICE.custom : 0),
      m3: PRICE.access + (s.custom ? PRICE.custom : 0),
      h1: HOURS.base + (s.m1 ? HOURS.extraWeeks : 0) + (s.custom ? HOURS.custom : 0),
      h2: (s.m2 ? HOURS.extraWeeks : 0) + (s.custom ? HOURS.custom : 0),
      h3: s.custom ? HOURS.custom : 0
    };
  }
  function presetFor(s) {
    for (var k in PRESETS) { var p = PRESETS[k]; if (p.m1 === s.m1 && p.m2 === s.m2 && p.custom === s.custom) return k; }
    return null;
  }
  function setPlan(p) { box('m1').checked = p.m1; box('m2').checked = p.m2; box('custom').checked = p.custom; }

  function render() {
    var s = state(), p = priced(s);
    $('s-m1').textContent = usd(p.m1);
    $('s-m2').textContent = usd(p.m2);
    $('s-m3').textContent = usd(p.m3);
    $('s-hours').textContent = 'Hours with me: ' + hrs(p.h1) + ' in month 1, ' + hrs(p.h2) + ' in month 2, ' +
      (p.h3 ? hrs(p.h3) + ' each month after.' : 'none after that unless you add custom hours.');
    var n = s.teams.length, early = p.h1 + p.h2;
    $('split').textContent = n
      ? n + (n === 1 ? ' team' : ' teams') + ' across ' + hrs(early) + ' in the first two months: about ' + hrs(early / n) + ' each.' + (early / n < 1 ? ' That is under an hour a team, so consider adding weeks.' : '')
      : 'No teams picked yet.';
    var pre = presetFor(s);
    Array.prototype.forEach.call(form.elements.preset, function (r) { r.checked = r.value === pre; });
    syncFormPlan();
  }

  form.addEventListener('change', function (e) {
    if (e.target.name === 'preset') setPlan(PRESETS[e.target.value]);
    render();
  });
  document.querySelectorAll('[data-choose]').forEach(function (b) {
    b.addEventListener('click', function () {
      setPlan(PRESETS[b.getAttribute('data-choose')]);
      render();
      $('build').scrollIntoView({ block: 'start' });
    });
  });

  // ---------- the form ----------
  var lead = $('lead');
  var fbox = function (n) { return lead.elements[n]; };
  var fromBuilder = true;
  function formPlan() { return { m1: fbox('f_m1').checked, m2: fbox('f_m2').checked, custom: fbox('f_custom').checked, teams: state().teams }; }
  function describe(s) {
    var p = priced(s), pre = presetFor(s);
    return (pre ? NAMES[pre] + ': ' : 'Custom: ') + usd(p.m1) + ' in month 1, ' + usd(p.m2) + ' in month 2, then ' + usd(p.m3) + ' a month.' +
      (s.teams.length ? ' Training for ' + s.teams.length + (s.teams.length === 1 ? ' team.' : ' teams.') : '');
  }
  function syncFormPlan() {
    if (fromBuilder) { var s = state(); fbox('f_m1').checked = s.m1; fbox('f_m2').checked = s.m2; fbox('f_custom').checked = s.custom; }
    $('f-plan').textContent = describe(formPlan());
  }
  ['f_m1', 'f_m2', 'f_custom'].forEach(function (n) {
    fbox(n).addEventListener('change', function () { fromBuilder = false; $('f-plan').textContent = describe(formPlan()); });
  });
  $('use-plan').addEventListener('click', function () { fromBuilder = true; syncFormPlan(); });

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
    var p = priced(v.plan);
    var lines = ['Company: ' + v.company, 'Name: ' + v.name, 'Role: ' + v.role, 'Email: ' + v.email, 'Phone: ' + v.phone,
      'Stage: ' + v.stage, 'Team: ' + v.team_size, 'Channels: ' + v.channels.join(', '), 'Tools: ' + v.tools.concat(v.tools_other ? [v.tools_other] : []).join(', '),
      'Run first: ' + v.run_first, 'Plan: ' + describe(v.plan), 'Hours: ' + p.h1 + ', ' + p.h2 + ', then ' + p.h3 + ' a month', 'Start: ' + v.start_day, 'Notes: ' + v.notes];
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

  setPlan(PRESETS.balanced);
  render();
})();
