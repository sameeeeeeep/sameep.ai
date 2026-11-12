// team.js (module A): the people in this workspace. Everyone listed has a login from day 1: they sign in with
// their work email and a 6-digit code. Admins and the owner add people, change roles, remove people and
// re-send invites; members and viewers see the list. Operator rows (owner) cannot be changed or removed.
// API: GET/POST /w/:wid/team, PATCH/DELETE /w/:wid/team/:email, POST /w/:wid/team/:email/invite.
import { html, raw, sampleTag, can, ago, day, ROLE_NAMES } from '../js/ui.js';

export const title = 'Team';

const ROLE_HELP = {
  admin: 'Adds and removes people, connects tools, approves money items.',
  member: 'Chats with the agents, drafts and approves everyday work.',
  viewer: 'Reads everything, changes nothing. For an accountant or an investor.',
};
const TEAM_ROLES = ['admin', 'member', 'viewer'];
const isSample = (email) => /\.example$/i.test(email || '');

const rolePill = (m) => html`<span class="tm-role is-${m.role}">${ROLE_NAMES[m.role] || m.role}</span>`;

function seen(m, now) {
  if (m.last_seen) return html`Signed in ${ago(m.last_seen, now)}`;
  if (m.invited_at) return html`Invited ${ago(m.invited_at, now)}, not signed in yet`;
  return html`Not signed in yet`;
}

function roleControl(m, admins, data, ctx) {
  if (m.role === 'owner' || !can(ctx.role, 'admin')) return rolePill(m);
  const lastAdmin = m.role === 'admin' && admins <= 1;
  return html`<label class="tm-role-pick"><span class="sr">Role for ${m.name || m.email}</span>
    <select data-act="role" data-email="${m.email}"${data.busy ? raw(' disabled') : ''}${lastAdmin ? raw(' title="The last admin stays an admin. Make someone else an admin first."') : ''}>
      ${TEAM_ROLES.map((r) => html`<option value="${r}"${r === m.role ? raw(' selected') : ''}${lastAdmin && r !== 'admin' ? raw(' disabled') : ''}>${ROLE_NAMES[r]}</option>`)}
    </select></label>`;
}

function actions(m, admins, data, ctx) {
  if (m.role === 'owner') return html`<span class="muted tm-note">Cannot be changed</span>`;
  if (!can(ctx.role, 'admin')) return '';
  if (data.confirm === m.email) {
    return html`<span class="tm-confirm" role="group" aria-label="Confirm removal">
      <span>Remove ${m.name || m.email}? Their login stops working here.</span>
      <button class="btn is-small tm-danger" type="button" data-act="remove-yes" data-email="${m.email}"${data.busy ? raw(' disabled') : ''}>Remove</button>
      <button class="btn is-small" type="button" data-act="remove-no">Cancel</button>
    </span>`;
  }
  const lastAdmin = m.role === 'admin' && admins <= 1;
  return html`<span class="tm-acts">
    <button class="btn is-small" type="button" data-act="invite" data-email="${m.email}"${data.busy ? raw(' disabled') : ''}>${m.invited_at ? 'Re-send invite' : 'Send invite'}</button>
    <button class="btn is-small" type="button" data-act="remove" data-email="${m.email}"${lastAdmin ? raw(' disabled title="The last admin cannot be removed. Make someone else an admin first."') : data.busy ? raw(' disabled') : ''}>Remove</button>
  </span>`;
}

function addForm(data, ctx) {
  if (!can(ctx.role, 'admin')) return html`<p class="tm-readonly muted">Only admins can add or change people. Ask an admin if someone is missing.</p>`;
  const f = data.form || {};
  const role = TEAM_ROLES.includes(f.role) ? f.role : 'member';
  return html`<form class="card tm-add" id="tm-add" novalidate>
    <h2 class="tm-h2">Add a person</h2>
    <p class="muted tm-add-sub">Their login works as soon as you add them: they sign in with this email and a 6-digit code.</p>
    <div class="tm-add-grid">
      <label class="field"><span>Work email</span><input name="email" type="email" autocomplete="off" required value="${f.email || ''}"></label>
      <label class="field"><span>Name</span><input name="name" autocomplete="off" required maxlength="80" value="${f.name || ''}"></label>
      <label class="field"><span>Role</span><select name="role">
        ${TEAM_ROLES.map((r) => html`<option value="${r}"${r === role ? raw(' selected') : ''}>${ROLE_NAMES[r]}</option>`)}
      </select></label>
      <label class="field"><span>Title <span class="muted">(optional)</span></span><input name="title" autocomplete="off" maxlength="80" placeholder="Ops lead" value="${f.title || ''}"></label>
    </div>
    <p class="muted tm-help">${ROLE_NAMES[role]}: ${ROLE_HELP[role]}</p>
    <label class="tm-check"><input type="checkbox" name="invite"${f.invite === false ? '' : raw(' checked')}> Email them an invite now</label>
    ${ctx.ws?.demo ? html`<p class="muted tm-help">Demo workspace: invites to sample addresses (ending in .example) are printed in the server log, never sent.</p>` : ''}
    <div class="tm-add-foot">
      <button class="btn is-primary" type="submit"${data.busy ? raw(' disabled') : ''}>${data.busy === 'add' ? 'Adding' : 'Add person'}</button>
      ${data.formError ? html`<p class="err" role="alert">${data.formError}</p>` : ''}
    </div>
  </form>`;
}

// Pure: data = { members, can_manage, error?, notice?, confirm?, busy?, form?, formError?, now? }
export function view(data, ctx) {
  const members = data.members || [];
  const now = data.now || Date.now();
  const admins = members.filter((m) => m.role === 'admin').length;
  const rows = members.map((m) => html`<tr${m.role === 'owner' ? raw(' class="is-owner"') : ''}>
    <td><div class="tm-name">${m.name || m.email}${m.operator ? html` <span class="tm-op" title="Runs the service; owner of every workspace">Operator</span>` : ''}</div>
      <div class="mono muted tm-email">${m.email}${isSample(m.email) ? html` <span class="tm-sample">sample address</span>` : ''}</div></td>
    <td>${roleControl(m, admins, data, ctx)}</td>
    <td>${m.title || html`<span class="muted">Not set</span>`}</td>
    <td class="tm-seen muted">${seen(m, now)}${m.created_at ? html`<br><span class="tm-added">Added ${day(m.created_at)}</span>` : ''}</td>
    <td class="r">${actions(m, admins, data, ctx)}</td>
  </tr>`);
  return html`<section class="pg tm">
    <div class="pg-top"><div>
      <h1 class="pg-h">Team ${sampleTag(ctx.ws)}</h1>
      <p class="pg-sub">Everyone here has their own login from day 1. No passwords: each person signs in with their work email and a 6-digit code.</p>
    </div></div>
    ${data.notice ? html`<p class="tm-notice" role="status">${data.notice}</p>` : ''}
    ${data.error ? html`<p class="err" role="alert">${data.error}</p>` : ''}
    ${members.length ? html`<div class="tbl-wrap"><table class="tbl tm-tbl">
      <thead><tr><th>Person</th><th>Role</th><th>Title</th><th>Last seen</th><th class="r"><span class="sr">Actions</span></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>` : html`<div class="card empty">Nobody is in this workspace yet.</div>`}
    ${addForm(data, ctx)}
    <dl class="tm-roles">
      ${TEAM_ROLES.map((r) => html`<div><dt>${ROLE_NAMES[r]}</dt><dd>${ROLE_HELP[r]}</dd></div>`)}
      <div><dt>Owner</dt><dd>The operator who runs the service. Edits billing and creates workspaces.</dd></div>
    </dl>
  </section>`;
}

export async function mount(root, ctx) {
  const path = `/w/${encodeURIComponent(ctx.wid)}/team`;
  const s = { members: [], can_manage: false, error: '', notice: '', confirm: null, busy: false, form: { role: 'member' }, formError: '' };
  const paint = () => { root.innerHTML = String(view(s, ctx)); };
  const load = async () => { const d = await ctx.api('GET', path); s.members = d.members; s.can_manage = d.can_manage; };
  const member = (email) => `${path}/${encodeURIComponent(email)}`;
  const nameOf = (email) => { const m = s.members.find((x) => x.email === email); return (m && (m.name || m.email)) || email; };
  const readForm = (form) => {
    const fd = new FormData(form);
    return { email: String(fd.get('email') || '').trim(), name: String(fd.get('name') || '').trim(), role: String(fd.get('role') || 'member'), title: String(fd.get('title') || '').trim(), invite: fd.get('invite') === 'on' };
  };

  async function run(kind, fn) {
    Object.assign(s, { busy: kind, error: '', notice: '', formError: '' });
    paint();
    try { await fn(); } catch (e) { if (kind === 'add') s.formError = e.message; else s.error = e.message; }
    s.busy = false;
    paint();
  }

  const onClick = (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b || !root.contains(b) || s.busy) return;
    const email = b.dataset.email;
    if (b.dataset.act === 'remove') { Object.assign(s, { confirm: email, error: '', notice: '' }); paint(); return; }
    if (b.dataset.act === 'remove-no') { s.confirm = null; paint(); return; }
    if (b.dataset.act === 'remove-yes') {
      const who = nameOf(email);
      run('remove', async () => {
        try { await ctx.api('DELETE', member(email)); s.notice = `${who} was removed.`; }
        finally { s.confirm = null; await load(); }
      });
      return;
    }
    if (b.dataset.act === 'invite') {
      run('invite', async () => {
        const r = await ctx.api('POST', member(email) + '/invite');
        await load();
        s.notice = r.printed ? `Invite for ${nameOf(email)} printed in the server log, not emailed.` : `Invite sent to ${email}.`;
      });
    }
  };

  const onChange = (e) => {
    const sel = e.target.closest('select[data-act="role"]');
    if (sel) {
      const email = sel.dataset.email, role = sel.value;
      run('role', async () => {
        try { await ctx.api('PATCH', member(email), { role }); s.notice = `${nameOf(email)} is now ${role === 'admin' ? 'an' : 'a'} ${(ROLE_NAMES[role] || role).toLowerCase()}.`; }
        finally { await load(); }
      });
      return;
    }
    // keep what was typed in the add form across repaints; the role help line follows the role picked
    const form = e.target.closest('#tm-add');
    if (form) { s.form = readForm(form); if (e.target.name === 'role') paint(); }
  };

  const onSubmit = (e) => {
    if (e.target.id !== 'tm-add') return;
    e.preventDefault();
    if (s.busy) return;
    const f = readForm(e.target);
    s.form = f;
    if (!/^\S+@\S+\.\S+$/.test(f.email)) { s.formError = 'Enter a valid email address.'; paint(); return; }
    if (!f.name) { s.formError = 'Enter their name.'; paint(); return; }
    run('add', async () => {
      const r = await ctx.api('POST', path, f);
      s.form = { role: f.role, invite: f.invite };
      await load();
      const who = r.member?.name || f.email;
      s.notice = !f.invite ? `${who} was added. Their login works now; send an invite when you are ready.`
        : r.printed ? `${who} was added. The invite was printed in the server log, not emailed.`
          : r.invited ? `${who} was added and invited.` : `${who} was added, but the invite could not be sent. Try Send invite.`;
    });
  };

  await load(); // listeners go on only once the page is really ours (root is shared with other pages)
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  root.addEventListener('submit', onSubmit);
  paint();
  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('change', onChange);
    root.removeEventListener('submit', onSubmit);
  };
}
