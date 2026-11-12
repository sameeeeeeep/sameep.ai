// signin.js (module A): email -> 6-digit code (or the emailed link) -> session. Works end to end in the
// skeleton; module A owns it from here. mount(root, { api, token, expired, email, toast, onSignedIn }).
import { html } from '../js/ui.js';

export const title = 'Sign in';

// Pure views (Node-testable). step: 'email' | 'code'
export function view({ step = 'email', email = '', error = '', note = '', busy = false } = {}) {
  const head = html`<a class="si-brand" href="../">D2C Clone</a>`;
  if (step === 'code') {
    return html`<div class="si">${head}
      <h1>Check your email</h1>
      <p class="si-note">If <b>${email}</b> has a workspace, a 6-digit code is on its way. You can also tap the link in that email.</p>
      <form id="si-form" class="si-form" novalidate>
        <label class="field"><span>6-digit code</span><input id="si-code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="7" required autofocus></label>
        <button class="btn is-primary" type="submit"${busy ? ' disabled' : ''}>${busy ? 'Signing in' : 'Sign in'}</button>
        ${error ? html`<p class="err" role="alert">${error}</p>` : ''}
      </form>
      <p class="si-alt"><button class="linkish" type="button" id="si-back">Use a different email</button> <span class="muted">·</span> <button class="linkish" type="button" id="si-resend">Send a new code</button></p>
    </div>`;
  }
  return html`<div class="si">${head}
    <h1>Sign in to your workspace</h1>
    <p class="si-note">Use the work email your team added. We’ll email you a 6-digit code. There is no password.</p>
    ${note ? html`<p class="si-flag">${note}</p>` : ''}
    <form id="si-form" class="si-form" novalidate>
      <label class="field"><span>Work email</span><input id="si-email" name="email" type="email" autocomplete="email" value="${email}" required autofocus></label>
      <button class="btn is-primary" type="submit"${busy ? ' disabled' : ''}>${busy ? 'Sending' : 'Email me a code'}</button>
      ${error ? html`<p class="err" role="alert">${error}</p>` : ''}
    </form>
  </div>`;
}

export function mount(root, { api, token, expired, email = '', onSignedIn }) {
  const s = { step: 'email', email, error: '', note: expired ? 'That sign-in link has expired or was already used. Ask for a new code.' : '', busy: false };
  const paint = () => {
    root.innerHTML = String(view(s));
    root.querySelector('#si-form').onsubmit = (e) => { e.preventDefault(); s.step === 'email' ? send() : verify(); };
    root.querySelector('#si-back')?.addEventListener('click', () => Object.assign(s, { step: 'email', error: '' }) && paint());
    root.querySelector('#si-resend')?.addEventListener('click', () => send(true));
    root.querySelector(s.step === 'email' ? '#si-email' : '#si-code')?.focus();
  };
  async function send(again = false) {
    if (!again) s.email = root.querySelector('#si-email').value.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(s.email)) { s.error = 'Enter your work email.'; return paint(); }
    Object.assign(s, { busy: true, error: '', note: '' }); paint();
    try { await api('POST', '/auth/login', { email: s.email }); Object.assign(s, { step: 'code', busy: false }); }
    catch (e) { Object.assign(s, { busy: false, error: e.message }); }
    paint();
  }
  async function verify() {
    const code = root.querySelector('#si-code').value.replace(/\D/g, '');
    if (code.length !== 6) { s.error = 'Enter the 6-digit code.'; return paint(); }
    Object.assign(s, { busy: true, error: '' }); paint();
    try { const r = await api('POST', '/auth/verify', { email: s.email, code }); token.set(r.token); onSignedIn(); }
    catch (e) { Object.assign(s, { busy: false, error: e.message }); paint(); }
  }
  paint();
}
