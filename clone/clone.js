// sameep.ai/clone: the four-beat example (hard cuts, looping) and the Hire my clone form.
(() => {
  // ---- the example: one step every 1.2 s; each element cuts in at its step. Reduced motion shows the end state.
  const demo = document.getElementById('demo');
  const LAST = 9, HOLD = 3;
  const set = (step) => {
    demo.querySelectorAll('[data-step]').forEach((el) => el.classList.toggle('is-off', step < +el.dataset.step));
    demo.querySelectorAll('[data-show]').forEach((el) => el.classList.toggle('is-off', step < +el.dataset.show || (!!el.dataset.hide && step >= +el.dataset.hide)));
    demo.querySelectorAll('[data-pick]').forEach((el) => el.classList.toggle('on', step >= +el.dataset.pick));
  };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) set(LAST);
  else {
    let step = 1; set(step);
    setInterval(() => { step = step >= LAST + HOLD ? 1 : step + 1; set(Math.min(step, LAST)); }, 1200);
  }

  // ---- the form. Same origin on sameep.ai; on localhost the Worker runs on :8790, or ?api=http://localhost:<port>.
  // Only a page on localhost talks to another origin, and only to a localhost one: anywhere else it's same-origin,
  // so a crafted ?api= link can't send what people type somewhere else.
  const LOCAL = /^(localhost|127\.0\.0\.1)$/;
  const override = new URLSearchParams(location.search).get('api') || '';
  const API = (!LOCAL.test(location.hostname) ? ''
    : /^http:\/\/(localhost|127\.0\.0\.1):\d{1,5}$/.test(override) ? override : 'http://localhost:8790') + '/api/clone';
  const dlg = document.getElementById('hire'), form = document.getElementById('hire-form');
  const msg = document.getElementById('hire-msg'), done = document.getElementById('hire-done');
  const send = form.querySelector('[type=submit]');
  const say = (text) => { msg.textContent = text; msg.hidden = !text; };

  document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => {
    form.hidden = false; done.hidden = true; say('');
    dlg.showModal();
    form.elements.name.focus();
  }));
  dlg.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target === dlg) dlg.close(); });

  const NEED = { name: 'your name', company: 'your company', contact: 'an email or number', plate: "what's on your plate" };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const missing = Object.keys(NEED).filter((k) => !String(data[k] || '').trim());
    Object.keys(NEED).forEach((k) => form.elements[k].setAttribute('aria-invalid', missing.includes(k)));
    if (missing.length) {
      const l = missing.map((k) => NEED[k]);
      say(`Add ${l.length > 1 ? l.slice(0, -1).join(', ') + ' and ' + l.at(-1) : l[0]}.`);
      form.elements[missing[0]].focus();
      return;
    }
    send.disabled = true; send.textContent = 'Sending…'; say('');
    try {
      // text/plain keeps it a simple request (no CORS preflight when testing across localhost ports)
      const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(data) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'That didn’t go through.');
      form.reset(); form.hidden = true; done.hidden = false;
      done.querySelector('button').focus();
    } catch (err) {
      say(err instanceof TypeError
        ? 'Couldn’t reach the server. Check your connection and try again, or email hello@sameep.ai.'
        : `${err.message} Nothing was sent.`);
    } finally {
      send.disabled = false; send.textContent = 'Send';
    }
  });
})();
