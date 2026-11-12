// billing.test.mjs (module D): DOM-free checks of pages/billing.js. node test/billing.test.mjs
// Role gating, the sample label, escaping, and the summary maths against the real pricing page script
// (d2c-clone/pricing/pricing.js run in a tiny stub DOM, once per preset).
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { check, done, hasBanned, EMOJI, ctxFor } from './_lib.mjs';
import { view, summaryFor, presetFor, planOf, PRESETS } from '../pages/billing.js';
import { usd } from '../js/ui.js';

const PLAN = { start_date: '2026-11-02', m1_extra: true, m2_extra: false, custom: false, custom_until: null, teams: ['founders', 'ops', 'growth'], updated_by: 'x', updated_at: 1 };
const inv = (no, month, status, extra = {}) => ({
  no, month, issue_date: '2026-11-02', due_date: '2026-11-09', status, paid_at: status === 'paid' ? Date.UTC(2026, 10, 3) : null, note: null,
  lines: [{ key: 'integration', label: 'First-time integration', amount: 1000 }], total: 1000, ...extra,
});
const data = (editable, over = {}) => ({
  plan: PLAN, lines: [], teams: {}, sample: true, editable, summary: summaryFor(PLAN),
  invoices: [inv('UNF-001', 1, 'paid'), inv('UNF-002', 2, 'upcoming')], ...over,
});
const s = (d, role, demo = true) => String(view(d, ctxFor(role, demo)));

console.log('billing page');
const owner = s(data(true), 'owner');
check('owner sees the plan toggles', ['name="m1_extra"', 'name="m2_extra"', 'name="custom"', 'name="start_date"', 'name="team"', 'name="preset"'].every((x) => owner.includes(x)));
check('owner sees all seven team chips', (owner.match(/name="team"/g) || []).length === 7);
check('owner sees Save plan, Mark paid and Unmark', owner.includes('Save plan') && owner.includes('data-paid="UNF-002"') && owner.includes('data-unpaid="UNF-001"'));
check('owner form reflects the plan', /name="m1_extra" checked/.test(owner) && !/name="m2_extra" checked/.test(owner) && /value="ops" checked/.test(owner) && !/value="agency" checked/.test(owner));
check('balanced preset picked for the sample plan', /value="balanced" checked/.test(owner));
check('custom end month disabled while custom is off', /name="custom_until" value="" disabled/.test(owner));
check('no unsaved flag when the draft matches', !owner.includes('Unsaved changes'));
check('unsaved flag when the draft differs', s({ ...data(true), draft: { ...planOf(PLAN), custom: true } }, 'owner').includes('Unsaved changes'));
check('owner summary follows the draft', s({ ...data(true), draft: { ...planOf(PLAN), custom: true } }, 'owner').includes('$1,200'));
check('owner with no plan gets the form and an empty table', (() => { const h = s(data(true, { plan: null, invoices: [] }), 'owner'); return h.includes('Save plan') && h.includes('Invoices appear once a plan is saved.'); })());

for (const role of ['admin', 'member', 'viewer']) {
  const h = s(data(false), role);
  check(`${role}: read-only note, no buttons, no form`, h.includes('Only Sameep can change the plan or mark invoices paid') && !h.includes('<button') && !h.includes('<form') && !h.includes('data-paid'));
  check(`${role}: sees the plan and invoices`, h.includes('2 Nov 2026') && h.includes('UNF-001') && h.includes('Founders, Ops and warehouse, Growth and ads'));
}
check('read-only with no plan', s(data(false, { plan: null, summary: null, invoices: [] }), 'viewer').includes('No plan yet.'));

const demo = s(data(false), 'viewer', true), live = s(data(false, { sample: false }), 'viewer', false);
check('demo: billing is real, no sample tags anywhere', !demo.includes('sample-tag') && !demo.includes('Sample'));
check('live: no sample labels', !live.includes('sample-tag'));
check('statuses shown as pills', demo.includes('is-paid') && demo.includes('is-upcoming'));
check('money as whole dollars', demo.includes('$1,000') && demo.includes('$1,100'));
const xss = s(data(true, { invoices: [inv('UNF-001', 1, 'paid', { note: '<img src=x onerror=1>' })], error: '<b>bad</b>' }), 'owner');
check('escapes notes and errors', !xss.includes('<img') && xss.includes('&lt;img') && xss.includes('&lt;b&gt;bad'));
check('row error shown', s(data(true, { rowError: 'That invoice is already marked paid.' }), 'owner').includes('already marked paid'));
check('busy row disables its button', /data-paid="UNF-002" disabled/.test(s(data(true, { rowBusy: 'UNF-002' }), 'owner')));
check('no banned names or emojis in output', !hasBanned(owner + demo) && !EMOJI.test(owner + demo));

// ---- the pricing page's own script, run once per preset, must give the same numbers ---------------------
const src = readFileSync(new URL('../../../d2c-clone/pricing/pricing.js', import.meta.url), 'utf8');
function pricingPage(query) {
  const els = {};
  const el = (id) => (els[id] ||= { id, textContent: '', href: '', addEventListener() {} });
  const teams = ['founders', 'ops', 'growth', 'content', 'finance', 'support', 'agency'].map((value) => ({ value, checked: false }));
  const radios = ['budget', 'balanced', 'hands'].map((value) => ({ value, checked: false }));
  const form = {
    elements: { m1: { checked: false }, m2: { checked: false }, custom: { checked: false }, preset: radios },
    querySelectorAll: () => teams, addEventListener() {},
  };
  const document = { getElementById: (id) => (id === 'plan' ? form : el(id)) };
  const location = { search: query, pathname: '/d2c-clone/', hash: '', origin: 'https://sameep.ai' };
  vm.runInNewContext(src, { document, location, history: { replaceState() {} }, navigator: {}, URLSearchParams, encodeURIComponent });
  return { m1: el('s-m1').textContent, m2: el('s-m2').textContent, m3: el('s-m3').textContent, hours: el('s-hours').textContent, split: el('split').textContent, preset: radios.find((r) => r.checked)?.value };
}
const cases = [
  ['budget', [], ''],
  ['balanced', ['founders', 'ops', 'growth'], 'm1=1&teams=founders,ops,growth'],
  ['hands', ['founders'], 'm1=1&m2=1&custom=1&teams=founders'],
  ['hands', ['founders', 'ops', 'growth', 'content', 'finance', 'support', 'agency'], 'm1=1&m2=1&custom=1&teams=founders,ops,growth,content,finance,support,agency'],
];
for (const [preset, teams, q] of cases) {
  const page = pricingPage(q ? '?' + q : '?teams=');
  const sum = summaryFor({ ...PRESETS[preset], teams });
  check(`preset ${preset} (${teams.length} teams): totals match pricing.js`, usd(sum.month1) === page.m1 && usd(sum.month2) === page.m2 && usd(sum.after) === page.m3, { page, sum });
  check(`preset ${preset} (${teams.length} teams): team split matches`, sum.team_split === page.split, [sum.team_split, page.split]);
  check(`preset ${preset} (${teams.length} teams): hours match`, sum.hours_text.replace('Hours with Sameep:', '') === page.hours.replace('Hours with me:', ''), [sum.hours_text, page.hours]);
  check(`preset ${preset}: same preset detected`, presetFor({ ...PRESETS[preset] }) === page.preset);
}
check('a mix that is no preset', presetFor({ m1_extra: false, m2_extra: true, custom: false }) === null);
done();
