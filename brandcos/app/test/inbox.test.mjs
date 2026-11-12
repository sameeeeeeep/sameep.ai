// inbox.test.mjs: the Inbox view (pages/inbox.js) and the link guard (js/ui.js). node test/inbox.test.mjs
import { check, done, ctxFor } from './_lib.mjs';
import { safeHref } from '../js/ui.js';
import { view } from '../pages/inbox.js';

console.log('inbox: source links');
for (const bad of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', ' javascript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,<b>x</b>', 'vbscript:x', '//evil.example/x', '/relative', 'https://', '', null, 42]) {
  check(`safeHref refuses ${JSON.stringify(bad)}`, safeHref(bad) === null, safeHref(bad));
}
check('safeHref keeps an https link', safeHref('https://notes.example/meet/42?x=1') === 'https://notes.example/meet/42?x=1');
check('safeHref keeps an http link', safeHref('http://notes.example/a') === 'http://notes.example/a');

const task = (link) => ({ id: 1, title: 'Confirm the carton proof', state: 'plan', found_by_agent: true, accepted: false, area: 'ops', priority: 'p2',
  due_ts: Date.now() + 86_400_000, owner_email: 'a@x.example', checker_email: 'b@x.example', names: {}, can: {},
  source_kind: 'meeting', source_quote: '- Riya to confirm the printer proof', source_title: 'Launch sync', source_link: link });
const ctx = { ...ctxFor('member'), me: { user: { email: 'a@x.example' } } };
const evil = String(view({ tasks: [task('javascript:alert(document.cookie)')], summary: {}, sources: [], decisions: [] }, ctx));
check('a javascript: source link renders no link at all', !/javascript:/i.test(evil) && !evil.includes('Open the source'), evil.slice(0, 200));
const good = String(view({ tasks: [task('https://notes.example/meet/42')], summary: {}, sources: [], decisions: [] }, ctx));
check('an https source link renders, opening safely', good.includes('href="https://notes.example/meet/42"') && good.includes('rel="noopener noreferrer"'));
done();
