// guide.js: the presenter's panel in a demo workspace. The guided path (8 beats, about 5 minutes), every live
// event the agents can be thrown, and a one-click reset. Each beat sets who is tapping, fires its event if it has
// one, opens the right surface and outlines the card to tap. The panel floats over every surface.
import { html } from './ui.js';
import { setAs } from './cos.js';

const BEAT_KEY = (wid) => `cos.beat.${wid}`;
const getBeat = (wid) => { try { return Number(localStorage.getItem(BEAT_KEY(wid))) || 0; } catch { return 0; } };
const putBeat = (wid, n) => { try { localStorage.setItem(BEAT_KEY(wid), String(n)); } catch { /* */ } };

// Pure. s = GET cos/state; ui = {open, cur}
export function guideView(s, ui) {
  if (!ui.open) return html`<button class="gd-fab" type="button" data-gd="open">Demo path${ui.cur ? html` · <span class="mono">${ui.cur}/${s.beats.length}</span>` : ''}</button>`;
  const fired = new Set(s.fired || []);
  return html`<div class="gd" role="dialog" aria-label="Demo path">
    <div class="gd-h"><b>Demo path, about 5 minutes</b><button class="gd-x" type="button" data-gd="close">Hide</button></div>
    <ol class="gd-beats">${s.beats.map((b) => html`<li class="gd-beat${b.n === ui.cur ? ' is-cur' : ''}${b.n < ui.cur ? ' is-done' : ''}">
      <span class="gd-n">${b.n}</span><b>${b.title}</b>
      <button class="btn is-small${b.n === ui.cur + 1 || (b.n === 1 && !ui.cur) ? ' is-primary' : ''}" type="button" data-gd="go" data-n="${b.n}">${b.fire && !fired.has(b.fire) ? 'Fire and go' : 'Go'}</button>
      <p>${b.say}${b.tap ? html` <b>${b.tap}</b>` : ''}</p>
    </li>`)}</ol>
    <details class="gd-ev"><summary>Every event the agents handle (${s.events.length})</summary>
      <ul>${s.events.map((e) => html`<li><span>${e.title}<small>${e.fn_name}${e.auto ? ' · auto, no tap' : ''}</small></span><button class="btn is-small" type="button" data-gd="fire" data-key="${e.key}"${fired.has(e.key) ? ' disabled' : ''}>${fired.has(e.key) ? 'Done' : 'Fire'}</button></li>`)}</ul>
    </details>
    <div class="gd-f"><span class="muted">Tapping as ${s.me?.name || ''}</span><button class="btn is-small" type="button" data-gd="reset">Reset demo</button></div>
  </div>`;
}

let el = null, cur = null;
// mount(ctx) after every route in a demo workspace; unmount() elsewhere
export async function mountGuide(ctx) {
  if (!ctx.ws.demo) return unmountGuide();
  if (!el) {
    el = document.createElement('div');
    el.id = 'cos-guide';
    document.body.appendChild(el);
    el.addEventListener('click', onClick);
    addEventListener('cos:as', () => cur && paint(cur.ctx));
  }
  cur = { ctx, open: cur?.ctx.wid === ctx.wid ? cur.open : false };
  await paint(ctx);
}
export function unmountGuide() { if (el) { el.remove(); el = null; } cur = null; }

let last = null;
async function paint(ctx) {
  try { last = await ctx.api('GET', `/w/${ctx.wid}/cos/state?as=${encodeURIComponent((await import('./cos.js')).as(ctx.wid))}`); } catch { return; }
  if (!el || !cur) return;
  el.innerHTML = String(guideView(last, { open: cur.open, cur: getBeat(ctx.wid) }));
}

async function onClick(e) {
  const b = e.target.closest('[data-gd]');
  if (!b || !cur) return;
  const ctx = cur.ctx, wid = ctx.wid;
  const act = b.dataset.gd;
  if (act === 'open' || act === 'close') { cur.open = act === 'open'; return paint(ctx); }
  b.disabled = true;
  try {
    if (act === 'go') {
      const beat = last.beats.find((x) => x.n === Number(b.dataset.n));
      if (beat.as) setAs(wid, beat.as);
      if (beat.fire && !(last.fired || []).includes(beat.fire)) await ctx.api('POST', `/w/${wid}/cos/events/${beat.fire}/fire`, { as: beat.as || 'founder' });
      try {
        if (beat.flow) sessionStorage.setItem('cos.focus', beat.flow);
        if (beat.ask) sessionStorage.setItem('cos.ask', beat.ask);
      } catch { /* */ }
      putBeat(wid, beat.n);
      cur.open = false; // fold the panel away so the room sees the surface
      const target = '#/' + ['w', wid, ...beat.path].map(encodeURIComponent).join('/');
      if (location.hash === target) dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = target;
      ctx.toast(beat.say);
    } else if (act === 'fire') {
      await ctx.api('POST', `/w/${wid}/cos/events/${b.dataset.key}/fire`, { as: 'founder' });
      ctx.toast('It happened. The agent is on it: see the Feed.');
      dispatchEvent(new HashChangeEvent('hashchange'));
    } else if (act === 'reset') {
      if (!confirm('Reset the demo? Every card goes back to the start; nothing outside this workspace changes.')) { b.disabled = false; return; }
      await ctx.api('POST', `/w/${wid}/cos/reset`, {});
      setAs(wid, 'cos');
      putBeat(wid, 0);
      const target = `#/w/${encodeURIComponent(wid)}/feed`;
      if (location.hash === target) dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = target;
      ctx.toast('Demo reset. Beat 1 is ready.');
    }
  } catch (err) { ctx.toast(err.message); }
  await paint(ctx);
}
