// company.test.mjs: the Company screen's pure views. node test/company.test.mjs
import { check, done } from './_lib.mjs';
import { view, face } from '../pages/company.js';

console.log('company');
const people = { founder: { name: 'Asha', title: 'Founder', initials: 'A', avatar: '/w/x/world/avatar/f', placeholder: false }, hire: { name: 'NPD manager (hiring)', title: 'Being hired', initials: 'NM', avatar: null, placeholder: true } };
const fn = { key: 'brand', name: 'Brand and story', agent: 'Brand agent', people: ['founder', 'hire'], connectors: [{ key: 'gmail', name: 'Gmail', what: '', status: 'connected' }],
  approvals: ['Launch line: founder'], edges: [{ key: 'conflict', title: 'Two people decide differently', what: 'x' }], counts: { plan: 1, final: 0, in_progress: 0, revision: 1, done: 2 },
  open: [{ id: 1, title: 'Shade <names>', col: 'revision', owner: 'founder', approver: 'founder', checker: 'hire', source: 'whatsapp:Brand group', note: '', edge: 'conflict', due: '2026-11-15' }] };
const data = { functions: [fn], people, product: { name: 'Lipstick', sample: true, start: '2026-10-25', today: 18, span: 45, launch: 42 }, totals: { functions: 1, open: 1, edges: 1, agent_steps: 1, taps: 1 },
  timeline: [{ day: 0, date: '2026-10-25', fn: 'brand', kind: 'agent', actor: 'Brand agent', text: 'Drafted', source: 'meeting:Sync' },
             { day: 18, date: '2026-11-12', fn: 'brand', kind: 'person', actor: 'Asha', tap: 'approve', text: 'Approved' },
             { day: 20, date: '2026-11-14', fn: 'brand', kind: 'agent', actor: 'Brand agent', text: 'Later', planned: true, edge: 'conflict' }], av: {} };
const ctx = { wid: 'demo-x', ws: { demo: true } };
const map = String(view({ ...data, tab: 'map' }, ctx));
check('map: tile, agent, connector, edge case', map.includes('Brand and story') && map.includes('Brand agent') && map.includes('Gmail') && map.includes('Two people decide differently'));
check('map: escapes card titles', map.includes('Shade &lt;names&gt;') && !map.includes('<names>'));
check('map: initials until the avatar loads', map.includes('>A<') && !map.includes('<img'));
check('face: avatar once loaded', String(face(people.founder, { '/w/x/world/avatar/f': 'blob:1' })).includes('src="blob:1"'));
check('face: open role is dashed', String(face(people.hire)).includes('is-open'));
const dim = String(view({ ...data, tab: 'map', who: 'nobody' }, ctx));
check('person filter dims functions they do not run', dim.includes('co-fn is-dim'));
const tl = String(view({ ...data, tab: 'timeline' }, ctx));
check('timeline: today marked on day 18', tl.includes('id="day-18"') && /co-day is-today[^"]*" id="day-18"/.test(tl) && tl.includes('co-now'));
check('timeline: tap shown', tl.includes('co-tap is-approve') && tl.includes('Approved'));
check('timeline: after today is planned', /co-day is-future" id="day-20"/.test(tl) && tl.includes('Planned'));
check('timeline: 46 day cells', (tl.match(/data-day="/g) || []).length === 46);
const taps = String(view({ ...data, tab: 'timeline', filter: 'tap' }, ctx));
check('timeline: taps filter', taps.includes('id="day-18"') && !taps.includes('id="day-0"'));
check('empty world', String(view({ functions: [] }, ctx)).includes('no company map yet'));
done();
