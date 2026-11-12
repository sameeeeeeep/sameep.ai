// signin.js (module A): email -> 6-digit code (or the emailed link) -> session, the same flow as the
// Wispr Growth OS sign-in. mount(root, { api, token, expired, link, email, toast, onSignedIn }).
// link: the token from an emailed link (#l=). It is only used when the person taps "Open my workspace", so a
// mail scanner that opens the link burns nothing.
// An invite links here with ?email=<address>, so the address arrives filled in.
import { html } from '../js/ui.js';

export const title = 'Sign in';

// Pure views (Node-testable). step: 'email' | 'code' | 'link'. invited: the address came from an invite link.
// resent: a fresh code was just sent from the code step.
export function view({ step = 'email', email = '', error = '', note = '', busy = false, invited = false, resent = false } = {}) {
  const head = html`<a class="si-brand" href="../">D2C Clone</a>`;
  const foot = html`<p class="si-foot muted">No passwords. Codes work once, for 15 minutes, and only a scrambled copy (a hash) is ever stored.</p>`;
  if (step === 'link') {
    return html`<div class="si">${head}
      <p class="si-kicker">Sign-in link</p>
      <h1>Open your workspace</h1>
      <p class="si-note">Tap the button to sign in on this device. The link works once.</p>
      <form id="si-form" class="si-form" novalidate>
        <button class="btn is-primary" type="submit"${busy ? ' disabled' : ''} autofocus>${busy ? 'Signing in' : 'Open my workspace'}</button>
        ${error ? html`<p class="err" role="alert">${error}</p>` : ''}
      </form>
      <p class="si-alt"><button class="linkish" type="button" id="si-back"${busy ? ' disabled' : ''}>Sign in with a code instead</button></p>
      ${foot}
    </div>`;
  }
  if (step === 'code') {
    return html`<div class="si">${head}
      <p class="si-kicker">Step 2 of 2</p>
      <h1>Check your email</h1>
      <p class="si-note">If <b>${email}</b> has a workspace, a 6-digit code is on its way. You can also tap the link in that email.</p>
      ${resent ? html`<p class="si-flag" role="status">A new code is on its way. Use the newest one.</p>` : ''}
      <form id="si-form" class="si-form" novalidate>
        <label class="field"><span>6-digit code</span><input id="si-code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="7" required autofocus></label>
        <button class="btn is-primary" type="submit"${busy ? ' disabled' : ''}>${busy ? 'Signing in' : 'Sign in'}</button>
        ${error ? html`<p class="err" role="alert">${error}</p>` : ''}
      </form>
      <p class="si-alt"><button class="linkish" type="button" id="si-back"${busy ? ' disabled' : ''}>Use a different email</button> <span class="muted">·</span> <button class="linkish" type="button" id="si-resend"${busy ? ' disabled' : ''}>Send a new code</button></p>
      ${foot}
    </div>`;
  }
  return html`<div class="si">${head}
    <p class="si-kicker">${invited ? 'You are invited' : 'Workspace sign-in'}</p>
    <h1>${invited ? 'Your login is ready' : 'Sign in to your workspace'}</h1>
    <p class="si-note">${invited
      ? 'Your team added this email. Confirm it and we will email you a 6-digit code.'
      : 'Use the work email your team added. We will email you a 6-digit code.'}</p>
    ${note ? html`<p class="si-flag">${note}</p>` : ''}
    <form id="si-form" class="si-form" novalidate>
      <label class="field"><span>Work email</span><input id="si-email" name="email" type="email" autocomplete="email" value="${email}" required autofocus></label>
      <button class="btn is-primary" type="submit"${busy ? ' disabled' : ''}>${busy ? 'Sending' : 'Email me a code'}</button>
      ${error ? html`<p class="err" role="alert">${error}</p>` : ''}
    </form>
    ${foot}
  </div>`;
}

export function mount(root, { api, token, expired, link = null, email = '', onSignedIn }) {
  const s = {
    step: link ? 'link' : 'email', email, error: '', busy: false, resent: false, invited: !!email && !expired && !link,
    note: expired ? 'That sign-in link has expired or was already used. Ask for a new code.' : '',
  };
  const paint = () => {
    root.innerHTML = String(view(s));
    root.querySelector('#si-form').onsubmit = (e) => { e.preventDefault(); if (!s.busy) (s.step === 'email' ? send() : s.step === 'link' ? useLink() : verify()); };
    root.querySelector('#si-back')?.addEventListener('click', () => { Object.assign(s, { step: 'email', error: '', resent: false }); paint(); });
    root.querySelector('#si-resend')?.addEventListener('click', () => send(true));
    const code = root.querySelector('#si-code');
    // a pasted or autofilled 6-digit code signs in straight away
    code?.addEventListener('input', () => { if (code.value.replace(/\D/g, '').length === 6 && !s.busy) verify(); });
    const input = root.querySelector(s.step === 'email' ? '#si-email' : '#si-code');
    if (input && !s.busy) input.focus();
  };
  async function send(again = false) {
    if (!again) s.email = root.querySelector('#si-email').value.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(s.email)) { s.error = 'Enter your work email.'; return paint(); }
    Object.assign(s, { busy: true, error: '', note: '' }); paint();
    try { await api('POST', '/auth/login', { email: s.email }); Object.assign(s, { step: 'code', busy: false, resent: again }); }
    catch (e) { Object.assign(s, { busy: false, error: e.message }); }
    paint();
  }
  async function useLink() {
    Object.assign(s, { busy: true, error: '' }); paint();
    try { const r = await api('POST', '/auth/link', { t: link }); token.set(r.token); onSignedIn(); }
    catch (e) { Object.assign(s, { step: 'email', busy: false, error: '', note: e.message }); paint(); }
  }
  async function verify() {
    const code = root.querySelector('#si-code').value.replace(/\D/g, '');
    if (code.length !== 6) { s.error = 'Enter the 6-digit code.'; return paint(); }
    Object.assign(s, { busy: true, error: '', resent: false }); paint();
    try { const r = await api('POST', '/auth/verify', { email: s.email, code }); token.set(r.token); onSignedIn(); }
    catch (e) { Object.assign(s, { busy: false, error: e.message }); paint(); }
  }
  paint();
}
