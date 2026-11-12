// today-chats.test.mjs (module B): DOM-free checks of the Today and Chats views. node test/today-chats.test.mjs
import { check, done, hasBanned, EMOJI, ctxFor } from './_lib.mjs';
import { view as today, fmt } from '../pages/today.js';
import { view as chats, person } from '../pages/chats.js';

console.log('today and chats');
const s = (v) => String(v);

// ---- Today -------------------------------------------------------------------------------------
const trend = Array.from({ length: 14 }, (_, i) => ({ day: `2026-11-${String(i + 1).padStart(2, '0')}`, revenue: 1000000 + i * 50000, orders: 40 + i }));
const T = {
  day: '2026-11-14', sample: true,
  kpis: [
    { key: 'revenue', label: 'Revenue', value: 2256770, unit: 'inr', prev: 2616160, delta_pct: -13.7 },
    { key: 'orders', label: 'Orders', value: 224, unit: 'count', prev: 200, delta_pct: 12 },
    { key: 'aov', label: 'Average order', value: 100749, unit: 'inr', prev: 0, delta_pct: null },
    { key: 'ad_spend', label: 'Ad spend', value: 390140, unit: 'inr', prev: 378870, delta_pct: 3 },
    { key: 'roas', label: 'ROAS', value: 5.78, unit: 'ratio', prev: 6.91, delta_pct: -16.4 },
    { key: 'returns', label: 'Returns', value: 10, unit: 'count', prev: 9, delta_pct: 11.1 },
  ],
  channels: [
    { channel: 'website', label: 'Website', revenue: 1277560, orders: 106 },
    { channel: 'marketplace', label: 'Marketplaces', revenue: 558790, orders: 62 },
    { channel: 'quick_commerce', label: 'Quick commerce', revenue: 297320, orders: 47 },
    { channel: 'offline', label: 'Offline and events', revenue: 123100, orders: 9 },
  ],
  trend,
  needs_you: [
    { kind: 'card', id: 3, title: 'Restock <b>tee</b>', status: 'pending', area: 'ops', href: 'chats/ops', ts: 2 },
    { kind: 'po', id: 9, title: 'PO-0002 Mailer boxes', status: 'approved', area: 'ops', href: 'os/pos', ts: 1 },
  ],
  briefing: ['Revenue on 14 Nov was ₹22,568 from 224 orders.', 'Website brought the most revenue.', '2 items are waiting for a tap.'],
  connectors: { connected: 7, total: 12, stale: ['warehouse'] },
};
const t1 = s(today(T, ctxFor('admin')));
check('today shows the sample tag in demo', t1.includes('sample-tag') && t1.includes('Sample data'));
check('today shows KPI values in rupees', t1.includes('₹22,568') && t1.includes('224') && t1.includes('5.78x'));
check('today shows a delta and a missing-prev note', t1.includes('Down 13.7%') && t1.includes('No number for last week'));
check('today draws 14 trend bars', (t1.match(/<rect /g) || []).length === 14 && t1.includes('<svg'));
check('today shows the channel split', t1.includes('Marketplaces') && t1.includes('Quick commerce') && /\d+%/.test(t1));
check('today links needs-you items through ctx routes', t1.includes('href="#/w/unfiltrd/chats/ops"') && t1.includes('data-go="os/pos"'));
check('today escapes titles', t1.includes('Restock &lt;b&gt;tee&lt;/b&gt;') && !t1.includes('<b>tee</b>'));
check('today shows briefing sentences', t1.includes('Website brought the most revenue.'));
check('today shows stale connectors', t1.includes('1 not synced in a day'));
check('today: no sample tag in a live workspace', !s(today(T, ctxFor('admin', false))).includes('sample-tag'));

const E = { day: '2026-11-14', sample: true, kpis: T.kpis.map((k) => ({ ...k, value: 0, prev: 0, delta_pct: null })), channels: T.channels.map((c) => ({ ...c, revenue: 0, orders: 0 })), trend: trend.map((d) => ({ ...d, revenue: 0, orders: 0 })), needs_you: [], briefing: ['No sales numbers for 14 Nov yet.', 'Nothing is waiting for your tap.', 'No tools are connected yet.'], connectors: { connected: 0, total: 12, stale: [] } };
const t2 = s(today(E, ctxFor('viewer')));
check('today empty state: no numbers', t2.includes('No sales numbers for this day yet') && !t2.includes('<svg'));
check('today empty state: nothing needs you', t2.includes('Nothing needs you right now.'));
check('today loading view', s(today(null, ctxFor('viewer'))).includes('Loading'));
check('fmt units', fmt(12345600, 'inr') === '₹1,23,456' && fmt(3.1, 'ratio') === '3.10x' && fmt(1200, 'count') === '1,200');

// ---- Chats -------------------------------------------------------------------------------------
const card = (id, status, extra = {}) => ({
  id, group: 'ops', kind: 'restock', title: 'Restock UF-TEE-BLK', fields: [{ label: 'Quantity', value: '300 units' }], status, needs_second: 1,
  requested_by: 'Ops agent', approved_by: null, checked_by: null, edited_by: null, reason: null, ts: 1, decided_ts: null,
  can: { approve: false, check: false, edit: false, reject: false }, ...extra,
});
const groups = [
  { id: 'unfiltrd:ops', slug: 'ops', name: 'Ops', agent: 'Ops agent', connectors: [{ key: 'warehouse', name: 'Warehouse', status: 'connected' }], members: [{ kind: 'person', name: 'Rohan' }, { kind: 'vendor', name: '3PL partner' }], last: { author_kind: 'agent', author_name: 'Ops agent', body: 'Stock is low', ts: 1 }, open_cards: 2 },
  { id: 'unfiltrd:all-hands', slug: 'all-hands', name: 'All hands', agent: 'Chief of staff', connectors: [], members: [], last: null, open_cards: 0 },
];
const now = Date.now();
const messages = [
  { id: 1, author_kind: 'person', author: 'rohan@unfiltrd.example', author_name: 'Rohan', body: '<script>alert(1)</script>\nsecond line', ts: now, card: null },
  { id: 2, author_kind: 'agent', author: 'Ops agent', author_name: 'Ops agent', body: 'I drafted a restock.', ts: now, card: card(10, 'pending', { can: { approve: true, check: false, edit: true, reject: true } }) },
  { id: 3, author_kind: 'agent', author: 'Ops agent', author_name: 'Ops agent', body: 'Another one.', ts: now, card: card(11, 'awaiting_check', { approved_by: 'meera@unfiltrd.example', can: { approve: false, check: true, edit: false, reject: true } }) },
  { id: 4, author_kind: 'system', author: 'System', author_name: 'System', body: 'Approved by Meera.', ts: now, card: null },
];
const D = { groups, slug: 'ops', group: groups[0], messages };
const member = { ...ctxFor('member'), me: { user: { email: 'rohan@unfiltrd.example' } } };
const c1 = s(chats(D, member));
check('chats shows the sample tag', c1.includes('Sample data'));
check('chats lists groups with open counts', c1.includes('href="#/w/unfiltrd/chats/all-hands"') && c1.includes('class="ch-count"'));
check('chats marks the current group', /aria-current="page"[^>]*>\s*<span class="ch-group-n">Ops/.test(c1) || c1.includes('chats/ops" aria-current="page"'));
check('chats escapes message bodies', c1.includes('&lt;script&gt;alert(1)&lt;/script&gt;') && !c1.includes('<script>'));
check('pending card: Approve, Edit, Reject, no Check', c1.includes('data-act="approve" data-id="10"') && c1.includes('data-act="edit" data-id="10"') && c1.includes('data-act="reject" data-id="10"') && !c1.includes('data-act="check" data-id="10"'));
check('awaiting card: Check for a different person', c1.includes('data-act="check" data-id="11"') && !c1.includes('data-act="approve" data-id="11"'));
check('second-check note shown', c1.includes('a second person checks it'));
check('member sees the composer', c1.includes('id="ch-body"') && c1.includes('data-form="send"'));
check('group tools and people shown', c1.includes('Warehouse') && c1.includes('With Rohan, 3PL partner'));

const mine = { ...D, messages: [{ ...messages[2], card: card(12, 'awaiting_check', { approved_by: 'rohan@unfiltrd.example', can: { approve: false, check: false, edit: false, reject: true } }) }] };
const c2 = s(chats(mine, member));
check('approver sees Check disabled with the reason', c2.includes('disabled title="A second person must check this. You approved it."') && !c2.includes('data-act="check"'));

const viewer = { ...ctxFor('viewer'), me: { user: { email: 'kabir@unfiltrd.example' } } };
const ro = { ...D, messages: messages.map((m) => (m.card ? { ...m, card: { ...m.card, can: { approve: false, check: false, edit: false, reject: false } } } : m)) };
const c3 = s(chats(ro, viewer));
check('viewer: no composer', !c3.includes('id="ch-body"') && c3.includes('You have view access'));
check('viewer: no card buttons', !c3.includes('data-act='));

const editing = s(chats({ ...D, ui: { editing: 10 } }, member));
check('edit opens inline fields', editing.includes('data-form="edit" data-id="10"') && editing.includes('data-label="Quantity"') && editing.includes('value="300 units"'));
const rejecting = s(chats({ ...D, ui: { rejecting: 10 } }, member));
check('reject asks for a reason', rejecting.includes('data-form="reject" data-id="10"') && rejecting.includes('name="reason"'));
const drive = s(chats({ ...D, messages: [{ ...messages[1], card: card(13, 'pending', { kind: 'drive_read', needs_second: 0, can: { approve: false, check: false, edit: true, reject: false } }) }] }, member));
check('drive read: member sees Approve disabled with the reason', drive.includes('title="Only admins and the owner can approve Drive and Calendar reads."'));
const rej = s(chats({ ...D, messages: [{ ...messages[1], card: card(14, 'rejected', { reason: 'Not <now>' }) }] }, member));
check('rejected card shows the escaped reason and no buttons', rej.includes('Rejected: Not &lt;now&gt;') && !rej.includes('data-act='));
check('all hands explains it reads no tool', s(chats({ groups, slug: 'all-hands', group: groups[1], messages: [] }, member)).includes('never a tool directly'));
check('empty group state', s(chats({ groups, slug: 'all-hands', group: groups[1], messages: [] }, viewer)).includes('No messages in All hands yet.'));
check('error shown inline', s(chats({ groups, slug: 'nope', group: null, messages: [], ui: { error: 'No such group in this workspace.' } }, member)).includes('No such group in this workspace.'));
check('no sample tag in a live workspace', !s(chats(D, { ...ctxFor('member', false), me: member.me })).includes('sample-tag'));
check('person names from emails', person('meera@unfiltrd.example') === 'Meera' && person('Ops agent') === 'Ops agent');

for (const out of [t1, t2, c1, c2, c3]) check('no banned names or emojis in output', !hasBanned(out) && !EMOJI.test(out));
done();
