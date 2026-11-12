// sameep.ai/d2c-clone/pricing: the plan builder. All prices in USD.
(function () {
  var PRICE = { integration: 1000, access: 100, extraWeeks: 100, custom: 100 };
  var HOURS = { base: 6, extraWeeks: 6, custom: 6 }; // 2 weeks x 3 hours; 6 hours a month
  var PRESETS = {
    budget: { m1: false, m2: false, custom: false },
    balanced: { m1: true, m2: false, custom: false },
    hands: { m1: true, m2: true, custom: true }
  };
  var TEAM_NAMES = {
    founders: 'Founders', ops: 'Ops and warehouse', growth: 'Growth and ads', content: 'Content and social',
    finance: 'Finance', support: 'Customer support', agency: 'Your agency'
  };

  var form = document.getElementById('plan');
  var $ = function (id) { return document.getElementById(id); };
  var box = function (n) { return form.elements[n]; };
  var usd = function (n) { return '$' + n.toLocaleString('en-US'); };
  var hrs = function (n) { return n === 1 ? '1 hour' : (Math.round(n * 10) / 10) + ' hours'; };

  function state() {
    return {
      m1: box('m1').checked, m2: box('m2').checked, custom: box('custom').checked,
      teams: Array.prototype.filter.call(form.querySelectorAll('input[name="team"]'), function (i) { return i.checked; }).map(function (i) { return i.value; })
    };
  }

  function presetFor(s) {
    for (var k in PRESETS) { var p = PRESETS[k]; if (p.m1 === s.m1 && p.m2 === s.m2 && p.custom === s.custom) return k; }
    return null;
  }

  function render() {
    var s = state();
    var m1 = PRICE.integration + (s.m1 ? PRICE.extraWeeks : 0) + (s.custom ? PRICE.custom : 0);
    var m2 = PRICE.access + (s.m2 ? PRICE.extraWeeks : 0) + (s.custom ? PRICE.custom : 0);
    var m3 = PRICE.access + (s.custom ? PRICE.custom : 0);
    var h1 = HOURS.base + (s.m1 ? HOURS.extraWeeks : 0) + (s.custom ? HOURS.custom : 0);
    var h2 = (s.m2 ? HOURS.extraWeeks : 0) + (s.custom ? HOURS.custom : 0);
    var h3 = s.custom ? HOURS.custom : 0;

    $('s-m1').textContent = usd(m1);
    $('s-m2').textContent = usd(m2);
    $('s-m3').textContent = usd(m3);
    $('s-hours').textContent = 'Hours with me: ' + hrs(h1) + ' in month 1, ' + hrs(h2) + ' in month 2, ' +
      (h3 ? hrs(h3) + ' each month after.' : 'none after that unless you add custom hours.');

    var n = s.teams.length, early = h1 + h2;
    $('split').textContent = n
      ? n + (n === 1 ? ' team' : ' teams') + ' across ' + hrs(early) + ' in the first two months: about ' + hrs(early / n) + ' each.' +
        (early / n < 1 ? ' That is under an hour a team, so consider adding weeks.' : '')
      : 'No teams picked yet.';

    var p = presetFor(s);
    Array.prototype.forEach.call(form.elements.preset, function (r) { r.checked = r.value === p; });

    var names = s.teams.map(function (t) { return TEAM_NAMES[t]; });
    var lines = [
      'Hi Sameep, here is the plan I picked:', '',
      'First-time integration (includes month 1 and 2 weeks of help): $1,000',
      'Access and updates from month 2: $100 a month',
      'Two more weeks in month 1: ' + (s.m1 ? 'yes' : 'no'),
      'Two weeks in month 2: ' + (s.m2 ? 'yes' : 'no'),
      'Custom development and training, 6 hours a month: ' + (s.custom ? 'yes' : 'no'),
      'Teams to train: ' + (names.length ? names.join(', ') : 'not sure yet'), '',
      'Month 1: ' + usd(m1) + '. Month 2: ' + usd(m2) + '. Each month after: ' + usd(m3) + '.', '',
      'Link: ' + link(s), '', 'Company:', 'Best time to talk:'
    ];
    $('send').href = 'mailto:hello@sameep.ai?subject=' + encodeURIComponent('D2C clone plan') + '&body=' + encodeURIComponent(lines.join('\n'));
    try { history.replaceState(null, '', query(s)); } catch (e) {}
  }

  function query(s) {
    var q = [];
    if (s.m1) q.push('m1=1');
    if (s.m2) q.push('m2=1');
    if (s.custom) q.push('custom=1');
    if (s.teams.length) q.push('teams=' + s.teams.join(','));
    return location.pathname + (q.length ? '?' + q.join('&') : '');
  }
  function link(s) { return location.origin + query(s); }

  // Start from the link if it carries a plan, else Balanced.
  var qs = new URLSearchParams(location.search);
  if (qs.has('m1') || qs.has('m2') || qs.has('custom') || qs.has('teams')) {
    box('m1').checked = qs.get('m1') === '1';
    box('m2').checked = qs.get('m2') === '1';
    box('custom').checked = qs.get('custom') === '1';
    var picked = (qs.get('teams') || '').split(',');
    Array.prototype.forEach.call(form.querySelectorAll('input[name="team"]'), function (i) { i.checked = picked.indexOf(i.value) >= 0; });
  } else {
    var b = PRESETS.balanced; box('m1').checked = b.m1; box('m2').checked = b.m2; box('custom').checked = b.custom;
  }

  form.addEventListener('change', function (e) {
    if (e.target.name === 'preset') {
      var p = PRESETS[e.target.value];
      box('m1').checked = p.m1; box('m2').checked = p.m2; box('custom').checked = p.custom;
    }
    render();
  });
  form.addEventListener('submit', function (e) { e.preventDefault(); });

  $('copy').addEventListener('click', function () {
    var url = link(state());
    var done = function () { $('copied').textContent = 'Link copied.'; };
    var fail = function () { $('copied').textContent = 'Copy this link: ' + url; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, fail); else fail();
  });

  render();
})();
