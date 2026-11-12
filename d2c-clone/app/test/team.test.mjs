// team.test.mjs (module A): DOM-free checks of the Team and sign-in views. node test/team.test.mjs
import { check, done, ctxFor, hasBanned, EMOJI } from './_lib.mjs';
import { view } from '../pages/team.js';
import { view as signin } from '../pages/signin.js';

const NOW = Date.UTC(2026, 10, 12, 10, 0, 0);
const M = (email, name, role, extra = {}) => ({ email, name, role, title: '', operator: false, added_by: 'asha@unfiltrd.example', invited_at: null, created_at: NOW - 86_400_000, last_seen: null, ...extra });
const members = [
  M('op@ops.example', 'Operator One', 'owner', { operator: true, title: 'Operator' }),
  M('asha@unfiltrd.example', 'Asha', 'admin', { title: 'Founder', last_seen: NOW - 3_600_000 }),
  M('rohan@unfiltrd.example', 'Rohan', 'member', { invited_at: NOW - 600_000 }),
  M('kabir@unfiltrd.example', '<img src=x onerror=alert(1)>', 'viewer', { title: 'Finance "books"' }),
];
const data = { members, can_manage: true, now: NOW };
const as = (role, demo = true, d = data) => String(view(d, ctxFor(role, demo)));

console.log('team');
const adminV = as('admin'), memberV = as('member'), viewerV = as('viewer'), ownerV = as('owner');
check('admin sees the add form', adminV.includes('id="tm-add"') && adminV.includes('name="invite"') && adminV.includes('name="title"'));
check('owner sees the add form', ownerV.includes('id="tm-add"'));
check('member: no add form', !memberV.includes('id="tm-add"') && memberV.includes('Only admins can add'));
check('viewer: no add form', !viewerV.includes('id="tm-add"'));
check('member and viewer: no write controls', ['data-act="role"', 'data-act="remove"', 'data-act="invite"'].every((a) => !memberV.includes(a) && !viewerV.includes(a)));
check('add form offers admin, member, viewer, never owner', /<select name="role">[\s\S]*value="admin"[\s\S]*value="member"[\s\S]*value="viewer"/.test(adminV) && !/<select name="role">[\s\S]*?value="owner"[\s\S]*?<\/select>/.test(adminV));

const ownerRow = adminV.split('<tr').find((r) => r.includes('op@ops.example'));
check('owner rows are not removable or re-rolable', ownerRow && !ownerRow.includes('data-act="remove"') && !ownerRow.includes('data-act="role"') && !ownerRow.includes('data-act="invite"'));
check('operator marker on operator rows', ownerRow.includes('tm-op') && ownerRow.includes('Operator'));
check('role pill shown for read-only rows', memberV.includes('tm-role is-viewer') && memberV.includes('tm-role is-owner'));
const ashaRow = adminV.split('<tr').find((r) => r.includes('asha@unfiltrd.example'));
check('last admin cannot be removed (disabled with a reason)', /data-act="remove"[^>]*disabled title="The last admin/.test(ashaRow));
check('last admin cannot be demoted (other roles disabled)', /value="member" disabled/.test(ashaRow) && /value="viewer" disabled/.test(ashaRow));
const rohanRow = adminV.split('<tr').find((r) => r.includes('rohan@unfiltrd.example'));
check('others are removable and re-invitable', rohanRow.includes('data-act="remove"') && !/data-act="remove"[^>]*disabled/.test(rohanRow) && rohanRow.includes('Re-send invite'));
check('never-invited people get Send invite', adminV.split('<tr').find((r) => r.includes('kabir@')).includes('>Send invite<'));
const two = as('admin', true, { ...data, members: [...members, M('meera@unfiltrd.example', 'Meera', 'admin')] });
check('with two admins, either can be removed', !/data-act="remove"[^>]*disabled/.test(two.split('<tr').find((r) => r.includes('asha@'))));

check('names are escaped', !adminV.includes('<img src=x') && adminV.includes('&lt;img src=x onerror=alert(1)&gt;'));
check('titles are escaped', adminV.includes('Finance &quot;books&quot;'));
const conf = as('admin', true, { ...data, confirm: 'rohan@unfiltrd.example' });
check('remove asks to confirm first', conf.includes('data-act="remove-yes"') && conf.includes('data-act="remove-no"') && conf.includes('Remove Rohan?'));
check('sample tag in demo', adminV.includes('sample-tag') && adminV.includes('Sample data'));
check('no sample tag in a live workspace', !as('admin', false).includes('sample-tag'));
check('demo note about printed invites only in demo', adminV.includes('printed in the server log') && !as('admin', false).includes('printed in the server log'));
check('sample addresses are marked', adminV.includes('sample address'));
check('last seen and invited states', adminV.includes('Signed in 1 h ago') && adminV.includes('Invited 10 min ago') && adminV.includes('Not signed in yet'));
check('empty state', as('admin', true, { members: [], can_manage: true, now: NOW }).includes('Nobody is in this workspace yet'));
const err = as('admin', true, { ...data, error: '<b>nope</b>', formError: 'Bad "x"', notice: 'Done & dusted' });
check('errors and notices are escaped', err.includes('&lt;b&gt;nope&lt;/b&gt;') && err.includes('Bad &quot;x&quot;') && err.includes('Done &amp; dusted'));
const busy = as('admin', true, { ...data, busy: 'add' });
check('busy disables the submit', /type="submit" disabled/.test(busy) && busy.includes('Adding'));
const kept = as('admin', true, { ...data, form: { email: 'x"y@z.example', name: 'Tara', role: 'viewer', title: '', invite: false } });
check('form keeps what was typed (escaped) and the role', kept.includes('value="x&quot;y@z.example"') && /value="viewer" selected/.test(kept) && !/name="invite" checked/.test(kept));

console.log('signin');
const inv = String(signin({ email: 'asha@unfiltrd.example', invited: true }));
check('invite landing says the login is ready', inv.includes('Your login is ready') && inv.includes('value="asha@unfiltrd.example"'));
check('plain sign-in heading', String(signin({})).includes('Sign in to your workspace'));
check('resent note on code step', String(signin({ step: 'code', email: 'a@x.co', resent: true })).includes('A new code is on its way'));
check('busy code step disables actions', /type="submit" disabled/.test(String(signin({ step: 'code', email: 'a@x.co', busy: true }))));
check('signin escapes the note', String(signin({ note: '<i>x</i>' })).includes('&lt;i&gt;x&lt;/i&gt;'));

const all = adminV + memberV + inv;
check('no banned names or emojis in the rendered pages', !hasBanned(all) && !EMOJI.test(all));
done();
