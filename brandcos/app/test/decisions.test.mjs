// decisions.test.mjs: the decision card view in Work (pages/chats.js). node test/decisions.test.mjs
import { check, done, hasBanned } from './_lib.mjs';
import { decisionView, view } from '../pages/chats.js';

console.log('decisions view');
const ctx = { wid: 'w1', role: 'member', ws: { demo: true }, me: { user: { email: 'me@x.example' } } };
const base = {
  id: 7, group: 'content', group_name: 'Content', kind: 'decision', project: 'Launch', title: 'Which <shade>?', context: 'Pick one.',
  rule: 'majority', status: 'open', version: 2, ts: 1, posted_by: 'Content agent', posted_kind: 'agent', results: [], comments: [],
  options: [
    { id: 1, label: 'Rosewood', detail: 'On camera', recommended: true, author_kind: 'agent', count: 2, won: false, voters: [{ name: 'A' }, { name: 'B' }] },
    { id: 2, label: 'Chai', detail: '', recommended: false, author_kind: 'person', author_name: 'Riya', count: 0, won: false, voters: [] },
  ],
  tally: { voters: 4, voted: 2, need: 1, tied: false }, my_vote: null, my_pre: { option_id: 1, reason: 'Poll favours it.' },
  waiting_on: '2 of 4 voted.', needs_you: true, can: { vote: true, suggest: true, comment: true, decide: false, check: false, send_back: false },
};
const v = String(decisionView(base, ctx, {}));
check('question is escaped', v.includes('Which &lt;shade&gt;?'));
check('each option is one tap to vote', (v.match(/data-dc="vote"/g) || []).length === 2);
check('one option marked recommended', (v.match(/>Recommended</g) || []).length === 1);
check('something else box', v.includes('Something else'));
check('agent lean shown, and said not to count', v.includes('Your agent leans') && v.includes('does not count'));
check('suggestion credited', v.includes('Suggested by Riya'));
check('needs you badge', v.includes('Needs you'));
const ro = String(decisionView({ ...base, can: { vote: false, suggest: false, comment: false } }, { ...ctx, role: 'viewer' }, {}));
check('viewer gets no buttons', !ro.includes('data-dc="vote"') && !ro.includes('Something else') && !ro.includes('data-form="dc-comment"'));
const owner = String(decisionView({ ...base, rule: 'owner', can: { ...base.can, decide: true } }, ctx, {}));
check('owner gets go-with buttons', owner.includes('You decide this one.') && (owner.match(/data-dc="decide"/g) || []).length === 2);
const done1 = String(decisionView({ ...base, status: 'resolved', decided: { option_id: 1, how: 'majority', note: '3 of 4 votes', name: 'Meera', ts: Date.now() }, results: [{ id: 9 }], can: { comment: true } }, ctx, {}));
check('resolved says what and who', done1.includes('Rosewood.') && done1.includes('3 of 4 votes') && done1.includes('Meera'));
const res = String(decisionView({ ...base, kind: 'result', status: 'to_check', title: 'Draft ready', context: 'Cut v3.', revision: 1, checker: { email: 'me@x.example' }, can: { check: true, send_back: true } }, ctx, {}));
check('result has Check and Send back', res.includes('data-dc="check"') && res.includes('data-dc="back"') && res.includes('nothing was sent'));
const page = String(view({ groups: [{ slug: 'content', name: 'Content', agent: 'Content agent' }], slug: 'content', messages: [{ id: 1, ts: 2, author_kind: 'agent', author: 'Content agent', body: 'hello' }], board: { tasks: [] }, decisions: [base], decisionsByGroup: { content: 1 } }, ctx));
check('card sits in the thread', page.includes('data-dc-card="7"') && page.includes('hello'));
check('thread list counts the card', page.includes('need') && page.includes('card needs your tap'));
check('no banned words or emojis', !hasBanned(v + owner + res + page));
done();
