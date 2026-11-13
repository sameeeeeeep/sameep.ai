// team.js (module A): the people in this workspace. Everyone listed has a login from day 1: they sign in with
// their work email and a 6-digit code. Admins and the owner add people, change roles, remove people and
// re-send invites; members and viewers see the list. Operator rows (owner) cannot be changed or removed.
// API: GET/POST /w/:wid/team, PATCH/DELETE /w/:wid/team/:email, POST /w/:wid/team/:email/invite.
// Change email (PATCH {email}) moves someone's login here to their real address, keeping their role, title
// and history: how the sample team becomes the client's real team on day 1. Admins can do it until the person
// has signed in; the operator any time.
import { html, raw, sampleTag, can, ago, day, ROLE_NAMES } from '../js/ui.js';

export const title = 'Team';

const ROLE_HELP = {
  admin: 'Adds and removes people, connects tools, approves money items.',
  member: 'Chats with the agents, drafts and approves everyday work.',
  viewer: 'Reads everything, changes nothing. For an accountant or an investor.',
};
const TEAM_ROLES = ['admin', 'member', 'viewer'];
const isSample = (email) => /\.example$/i.test(email || '');

// What happened to an invite, in words an admin can act on. r = {invited, printed, reason, invite_url}.
// Returns { text, url }: url is the sign-in link to share by hand when the invite email is not switched on.
export function inviteNotice(who, r, added = true) {
  const lead = added ? `${who} was added` : '';
  if (r.reason === 'sample') return { text: added ? `${lead}. This is a sample address, so no email was sent.` : `${who} has a sample address, so no email was sent.`, url: null };
  if (r.printed) return { text: `${added ? `${lead}, but the` : 'The'} invite email is not switched on yet. Share this link with ${added ? 'them' : who}:`, url: r.invite_url || null };
  if (r.invited) return { text: added ? `${lead} and invited.` : `Invite sent to ${who}.`, url: null };
  return { text: added ? `${lead}, but the invite could not be sent. Try Send invite.` : 'The invite could not be sent. Try again in a minute.', url: null };
}

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
  if (data.changing === m.email) {
    return html`<form class="tm-confirm tm-change" data-email="${m.email}" novalidate>
      <label class="field"><span>New email for ${m.name || m.email}</span><input name="newEmail" type="email" autocomplete="off" required value="${data.changeTo || ''}"></label>
      <button class="btn is-small is-primary" type="submit"${data.busy ? raw(' disabled') : ''}>Change email</button>
      <button class="btn is-small" type="button" data-act="change-no">Cancel</button>
    </form>`;
  }
  const lastAdmin = m.role === 'admin' && admins <= 1;
  // admins fix an address until the person has signed in; the operator any time
  const canChange = !m.last_seen || !!ctx.me?.user?.is_operator;
  return html`<span class="tm-acts">
    ${canChange ? html`<button class="btn is-small" type="button" data-act="change" data-email="${m.email}"${data.busy ? raw(' disabled') : ''}>Change email</button>` : ''}
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
    ${ctx.ws?.demo ? html`<p class="muted tm-help">Sample addresses (ending in .example) cannot receive email, so no invite goes to them. Use Change email to move a sample person to a real address.</p>` : ''}
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
    ${data.notice ? html`<p class="tm-notice" role="status">${data.notice}${data.shareUrl ? html` <span class="mono tm-share">${data.shareUrl}</span> <button class="btn is-small" type="button" data-act="copy" data-url="${data.shareUrl}">Copy link</button>` : ''}</p>` : ''}
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
  const s = { members: [], can_manage: false, error: '', notice: '', shareUrl: null, confirm: null, changing: null, changeTo: '', busy: false, form: { role: 'member' }, formError: '' };
  const paint = () => { root.innerHTML = String(view(s, ctx)); };
  const load = async () => { const d = await ctx.api('GET', path); s.members = d.members; s.can_manage = d.can_manage; };
  const member = (email) => `${path}/${encodeURIComponent(email)}`;
  const nameOf = (email) => { const m = s.members.find((x) => x.email === email); return (m && (m.name || m.email)) || email; };
  const readForm = (form) => {
    const fd = new FormData(form);
    return { email: String(fd.get('email') || '').trim(), name: String(fd.get('name') || '').trim(), role: String(fd.get('role') || 'member'), title: String(fd.get('title') || '').trim(), invite: fd.get('invite') === 'on' };
  };

  async function run(kind, fn) {
    Object.assign(s, { busy: kind, error: '', notice: '', shareUrl: null, formError: '' });
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
    if (b.dataset.act === 'change') { Object.assign(s, { changing: email, changeTo: '', confirm: null, error: '', notice: '', shareUrl: null }); paint(); root.querySelector('.tm-change input')?.focus(); return; }
    if (b.dataset.act === 'change-no') { s.changing = null; paint(); return; }
    if (b.dataset.act === 'copy') {
      const url = b.dataset.url;
      Promise.resolve(navigator.clipboard?.writeText(url)).then(() => ctx.toast('Link copied.'), () => ctx.toast('Copy did not work. Select the link and copy it.'));
      return;
    }
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
        const n = inviteNotice(nameOf(email), r, false);
        s.notice = n.text; s.shareUrl = n.url;
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
    if (e.target.name === 'newEmail') s.changeTo = e.target.value;
  };

  const onSubmit = (e) => {
    if (e.target.classList?.contains('tm-change')) {
      e.preventDefault();
      if (s.busy) return;
      const from = e.target.dataset.email, to = String(new FormData(e.target).get('newEmail') || '').trim();
      s.changeTo = to;
      if (!/^\S+@\S+\.\S+$/.test(to)) { s.error = 'Enter a valid email address.'; paint(); return; }
      const who = nameOf(from);
      run('change', async () => {
        await ctx.api('PATCH', member(from), { email: to });
        s.changing = null; s.changeTo = '';
        await load();
        s.notice = `${who} now signs in with ${to.toLowerCase()}. Their role and history stayed. Send them an invite when you are ready.`;
      });
      return;
    }
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
      if (!f.invite) { s.notice = `${who} was added. Their login works now; send an invite when you are ready.`; return; }
      const n = inviteNotice(who, r, true);
      s.notice = n.text; s.shareUrl = n.url;
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
