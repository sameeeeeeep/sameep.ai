// hub-os.test.mjs (module C): DOM-free checks of the Hub and OS page views. node test/hub-os.test.mjs
import { check, done, ctxFor, hasBanned, EMOJI } from './_lib.mjs';
import * as hub from '../pages/hub.js';
import * as os from '../pages/os.js';

const NOW = Date.UTC(2026, 10, 12, 12);
const conn = (key, name, group, extra = {}) => ({ key, name, group, what: 'Sample things', owner_tap: false, status: 'not_connected', mode: 'demo', connected_by: null, connected_at: null, last_sync: null, rows: 0, note: null, ...extra });
const HUB = {
  demo: true, now: NOW,
  connectors: [
    conn('shopify', 'Shopify', 'website', { status: 'connected', last_sync: NOW - 5 * 60e3, rows: 1840 }),
    conn('meta_ads', 'Meta Ads', 'performance'),
    conn('drive_calendar', 'Drive and Calendar', 'content', { owner_tap: true, status: 'connected' }),
    conn('crm', '<CRM & co>', 'support'),
  ],
  tables: [{ name: 'os_items', label: 'OS items', rows: 16, updated: NOW - 3600e3 }, { name: 'inventory', label: 'Stock by location', rows: 0, updated: null }],
  syncs: [{ id: 1, connector: 'shopify', status: 'ok', rows: 12, started_by: 'asha@unfiltrd.example', started_at: NOW - 5 * 60e3, finished_at: NOW, note: 'Demo sync' }],
  reads: [],
};
const h = (role, data = HUB, demo = true) => String(hub.view(data, ctxFor(role, demo)));

console.log('hub view');
const hv = h('viewer'), hm = h('member'), ha = h('admin'), ho = h('owner');
check('connectors grouped by chat', ha.indexOf('Website') < ha.indexOf('Shopify') && ha.includes('read by the Content agent') && ha.indexOf('Performance') < ha.indexOf('Meta Ads'));
check('status pills', ha.includes('is-connected') && ha.includes('is-not_connected'));
check('last sync and rows', ha.includes('Last sync 5 min ago') && ha.includes('1,840 rows') && ha.includes('Never synced'));
check('viewer: no connect, no sync', !hv.includes('data-act="connect"') && !hv.includes('data-act="sync"') && !hv.includes('data-act="disconnect"'));
check('member: no connect or disconnect, has sync', !hm.includes('data-act="connect"') && !hm.includes('data-act="disconnect"') && hm.includes('data-act="sync" data-key="shopify"'));
check('admin: connect and disconnect', ha.includes('data-act="connect" data-key="meta_ads"') && ha.includes('data-act="disconnect" data-key="shopify"'));
check('owner can connect too', ho.includes('data-act="connect"'));
check('member told who connects', hm.includes('An admin connects this.'));
const live = h('admin', { ...HUB, demo: false }, false);
check('live workspace: no demo connect button, says why', !live.includes('data-act="connect"') && live.includes('set up with Sameep'));
check('drive explains the tap rule', ha.includes('Every read waits for an admin or the owner'));
check('drive: no waiting state before asking', !ha.includes('Waiting for a tap in Content chat'));
const wait = h('member', { ...HUB, waiting: { drive_calendar: { id: 9, status: 'pending' } } });
check('drive waiting state after 202, with link to Content chat', wait.includes('Waiting for a tap in Content chat') && wait.includes('data-act="go-content"'));
const pendingRead = h('member', { ...HUB, reads: [{ card_id: 9, status: 'pending' }] });
check('pending read from the hub shows waiting too', pendingRead.includes('Waiting for a tap in Content chat'));
const ready = h('member', { ...HUB, reads: [{ card_id: 11, status: 'approved', approved_by: 'asha@unfiltrd.example' }] });
check('approved read: run once with the card id', ready.includes('data-act="read" data-key="drive_calendar" data-card="11"') && ready.includes('Read approved by asha@unfiltrd.example'));
check('viewer cannot run an approved read', !h('viewer', { ...HUB, reads: [{ card_id: 11, status: 'approved' }] }).includes('data-act="read"'));
check('hub tables listed', ha.includes('OS items') && ha.includes('No rows yet') && ha.includes('1 h ago'));
check('latest syncs listed', ha.includes('Latest syncs') && ha.includes('Done'));
check('sample tag in demo', ha.includes('sample-tag') && ha.includes('Sample data'));
check('no sample tag live', !live.includes('sample-tag'));
check('escapes names', ha.includes('&lt;CRM &amp; co&gt;') && !ha.includes('<CRM'));
check('error shown inline', h('admin', { ...HUB, errors: { meta_ads: 'Nope <b>' } }).includes('Nope &lt;b&gt;'));
check('busy disables', h('admin', { ...HUB, busy: 'meta_ads' }).includes('data-key="meta_ads" disabled'));
check('empty syncs', h('admin', { ...HUB, syncs: [] }).includes('No syncs yet.'));

console.log('os view');
const item = (id, status, can, extra = {}) => ({ id, kind: 'po', ref: `PO-000${id}`, title: `Order ${id}`, status, area: 'ops', assignee: null, vendor: 'Sample Packaging Co.', amount: 300000, due: '2026-12-01', data: { lines: [{ sku: 'A', qty: 1, unit_cost: 300000 }] }, created_by: 'rohan@unfiltrd.example', approved_by: null, checked_by: null, reason: null, ts: NOW, updated: NOW, can: { edit: false, approve: false, check: false, reject: false, ...can }, ...extra });
const ctxT = (role, tab, demo = true, me) => ({ ...ctxFor(role, demo), params: tab ? [tab] : [], me: me ? { user: { email: me } } : undefined });
const o = (data, role, tab, demo, me) => String(os.view(data, ctxT(role, tab, demo, me)));

const items = [
  item(1, 'draft', { approve: true, reject: true }),
  item(2, 'approved', { check: true, reject: true }, { approved_by: 'asha@unfiltrd.example' }),
  item(3, 'checked', {}, { approved_by: 'asha@unfiltrd.example', checked_by: 'rohan@unfiltrd.example' }),
  item(4, 'rejected', {}, { reason: 'Duplicate <order>', data: { rejected_by: 'asha@unfiltrd.example' } }),
];
const counts = { tasks: { draft: 2, approved: 0, checked: 0, rejected: 0 }, pos: { draft: 1, approved: 1, checked: 1, rejected: 1 }, invoices: {}, adjustments: {} };
const pos = o({ items, counts }, 'admin', 'pos');
check('four tabs, pos current', pos.includes('Purchase orders') && pos.includes('Vendor invoices') && pos.includes('Inventory') && /href="#\/w\/unfiltrd\/os\/pos" aria-current="page"/.test(pos));
check('tab counts waiting items', pos.includes('os-n">2<'));
check('default tab is tasks', /os\/tasks" aria-current="page"/.test(o({ items: [] }, 'admin', undefined)) && /os\/tasks" aria-current="page"/.test(o({ items: [] }, 'admin', 'bogus')));
check('status pills', pos.includes('is-draft') && pos.includes('is-approved') && pos.includes('is-checked') && pos.includes('is-rejected'));
check('approve only where can.approve', (pos.match(/data-act="approve"/g) || []).length === 1 && pos.includes('data-act="approve" data-id="1"'));
check('check only where can.check', (pos.match(/data-act="check"/g) || []).length === 1 && pos.includes('data-act="check" data-id="2"'));
check('reject only where can.reject', (pos.match(/data-act="reject"/g) || []).length === 2);
const none = o({ items: items.map((i) => ({ ...i, can: { edit: false, approve: false, check: false, reject: false } })) }, 'viewer', 'pos');
check('viewer: no action buttons, no create form', !/data-act="(approve|check|reject)"/.test(none) && !none.includes('id="os-form"') && none.includes('Viewers can read the OS'));
const mem = o({ items: [item(1, 'draft', {}), item(2, 'approved', {}, { approved_by: 'rohan@unfiltrd.example' })] }, 'member', 'pos', true, 'rohan@unfiltrd.example');
check('member sees why there is no approve', mem.includes('An admin approves this.'));
check('approver sees second-person hint', mem.includes('a second person checks it'));
check('amount in rupees', pos.includes('₹3,000'));
check('rejection reason escaped', pos.includes('Duplicate &lt;order&gt;') && pos.includes('Rejected by Asha'));
check('people trail', pos.includes('Approved by Asha') && pos.includes('Checked by Rohan'));
check('PO lines editor', pos.includes('id="os-form"') && pos.includes('name="unit_cost"') && pos.includes('data-act="add-line"') && pos.includes('id="os-total"'));
const two = o({ items: [], lines: [{ sku: 'A', qty: '2', unit_cost: '150' }, { sku: 'B', qty: '1', unit_cost: '99.5' }], open: true }, 'member', 'pos');
check('lines total and remove buttons', two.includes('₹400') && (two.match(/data-act="del-line"/g) || []).length === 2 && two.includes('<details class="card os-new" open'));
check('linesTotal in paise', os.linesTotal([{ qty: '2', unit_cost: '150' }, { qty: 1, unit_cost: '99.50' }]) === 39950);
const inv = o({ items: [item(5, 'checked', {}, { kind: 'invoice', ref: 'INV-0001', data: { po_ref: 'PO-0001' } })], po_refs: ['PO-0001'], matches: { 5: { po_ref: 'PO-0001', po_amount: 300000, diff: 10000 } } }, 'member', 'invoices');
check('invoice form: amount and po_ref', inv.includes('name="amount"') && inv.includes('name="po_ref"') && inv.includes('<option value="PO-0001">'));
check('invoice match shown', inv.includes('Over PO-0001 by ₹100'));
check('invoice row says which PO', inv.includes('against PO-0001'));
const stock = [
  { sku: 'UF-TEE-BLK', name: 'Everyday Tee, Black', location: 'Main warehouse', on_hand: 4, reorder_point: 20, unit_cost: 25000, low: true },
  { sku: 'UF-CAP-GRY', name: 'Cap, Grey', location: 'Main warehouse', on_hand: 80, reorder_point: 20, unit_cost: 12500, low: false },
];
const invt = o({ items: [], stock, locations: ['Main warehouse'] }, 'member', 'inventory');
check('inventory: low rows marked', invt.includes('<tr class="is-low">') && (invt.match(/class="is-low"/g) || []).length === 1 && invt.includes('1 low'));
check('inventory: adjustment form', invt.includes('name="delta"') && invt.includes('name="sku"') && invt.includes('<option value="UF-TEE-BLK">') && invt.includes('New stock adjustment'));
check('inventory: empty stock state', o({ items: [] }, 'member', 'inventory').includes('No stock rows yet'));
const adj = o({ items: [{ ...item(6, 'draft', { approve: true }), kind: 'adjustment', ref: 'ADJ-0001', data: { sku: 'UF-TEE-BLK', location: 'Main warehouse', delta: 24 } }] }, 'admin', 'inventory');
check('adjustment row shows signed units', adj.includes('+24') && adj.includes('UF-TEE-BLK at Main warehouse'));
const task = o({ items: [{ ...item(7, 'draft', {}), kind: 'task', ref: 'T-0001', vendor: null, amount: null }] }, 'member', 'tasks');
check('task form has area and assignee', task.includes('name="area"') && task.includes('name="assignee"') && task.includes('Waiting for approval.'));
check('reject form when rejecting', o({ items, rejecting: 1, reason: 'a"b' }, 'admin', 'pos').includes('class="os-reject" data-id="1"') && o({ items, rejecting: 1, reason: 'a"b' }, 'admin', 'pos').includes('value="a&quot;b"'));
check('sample tag in demo', pos.includes('Sample data'));
check('no sample tag live', !o({ items }, 'admin', 'pos', false).includes('sample-tag'));
check('form error escaped', o({ items: [], form_error: '<x>' }, 'member', 'tasks').includes('&lt;x&gt;'));
check('escapes titles', o({ items: [item(8, 'draft', {}, { title: '<img src=x>' })] }, 'admin', 'pos').includes('&lt;img src=x&gt;'));
check('empty list', o({ items: [] }, 'member', 'tasks').includes('Nothing here yet.'));
check('tables in tbl-wrap', pos.includes('<div class="tbl-wrap"><table class="tbl os-tbl">') && invt.includes('<div class="tbl-wrap"><table class="tbl os-stock">'));

for (const [name, s] of [['hub', ha + wait + ready], ['os', pos + inv + invt + task]]) check(`${name}: no banned names or emojis in output`, !hasBanned(s) && !EMOJI.test(s));
done();
