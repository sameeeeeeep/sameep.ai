// hostpick.js — the welcome window before the cold open, one step at a time:
//   1. the host (episode.json "hosts")   2. the length (episode.json "routes",
//   timed from data/durations.json)   3. "Try steering" (onboard.js, first visit
//   only)   4. a seat in the audience (cast.js).
// Sameep's answers never change; only the host's questions, reactions and jokes
// do. Returning visitors get a countdown that starts the show with their saved
// picks. "Change host" in the player opens just step 1.
import { h, safeUrl } from './util.js';
import { sound } from './audio.js';
import { castPanel } from './cast.js';
import { practice } from './onboard.js';
import { isWispr } from '../version.js';

const SUB = 'You can extend or collapse it by choosing your own branch.';
const PRACTICED = 'otcv-practiced';
const practiced = () => { try { return localStorage.getItem(PRACTICED) === '1'; } catch { return false; } };

// Resolves with { host, route, visitor } (route and visitor only when those steps were shown).
export function openWelcome(container, { hosts, current, base, persona, routes = null, route = null, durP = null, seat = false, countdown = 0 }) {
  return new Promise(async (resolve) => {
    let host = hosts.find((x) => x.id === current) || hosts.find((x) => x.recommended) || hosts[0];
    let len = routes && (routes[route] ? route : Object.keys(routes)[1] || Object.keys(routes)[0]);
    const full = !!(routes || seat);
    const first = (x) => x.name.split(' ')[0];
    const steps = full ? ['host', routes && 'length', !practiced() && 'practice', seat && 'seat'].filter(Boolean) : ['host'];
    // title first, then where you are (Step N of M · what this step is), close under it
    const head = (i, title, what) => [h('h2.cast__title#hostpick-title', title),
      h('p.hostpick__where', steps.length > 1 ? `Step ${i + 1} of ${steps.length} · ${what}` : what)];
    let timer = null;
    let at = 0;

    // pieces, built once so going back keeps the picks
    const hostGrid = h('div.cast__grid.hostpick__grid', { role: 'radiogroup', 'aria-label': 'Choose your host' });
    const hostCards = hosts.map((x) => h('button.cast__card.hostpick__card', { type: 'button', role: 'radio', dataset: { host: x.id },
      onclick: () => { host = x; sync(); sound.tick('pick'); stopCount(); panel?.setHost(first(x)); } },
    x.recommended && h('span.hostpick__rec', 'Recommended'),
    h('span.cast__portrait.hostpick__portrait', x.thumb ? h('img', { src: safeUrl(x.thumb, base), alt: '', width: 128, height: 128, loading: 'lazy' }) : null,
      x.wpm && h('span.hostpick__wpm', { title: `Speaks at about ${x.wpm} words per minute (measured from this host's clips)` }, h('b', String(x.wpm)), ' wpm')),
    h('span.cast__label', x.name),
    x.kind && h('span.hostpick__kind', x.kind),
    h('span.cast__blurb', x.blurb || ''),
    x.style && h('span.hostpick__style', h('b', 'Talks: '), x.style)));
    hostGrid.append(...hostCards);

    // length: real minutes from durations.json, honest about what each covers
    const lenBtns = [];
    const lenRow = routes ? h('div.hostpick__lens', { role: 'radiogroup', 'aria-label': 'How long' }) : null;
    for (const [id, r] of Object.entries(routes || {})) {
      const mins = h('span.hostpick__min', '…');
      const b = h('button.hostpick__len', { type: 'button', role: 'radio', dataset: { len: id },
        onclick: () => { len = id; sync(); sound.tick('pick'); stopCount(); } },
      mins, h('span.hostpick__lenk', r.label || id), (isWispr && r.v?.wispr?.blurb) || r.blurb ? h('span.hostpick__lenb', (isWispr && r.v?.wispr?.blurb) || r.blurb) : null);
      b._mins = mins;
      lenBtns.push(b);
      lenRow.append(b);
    }
    Promise.resolve(durP).then((D) => {
      for (const b of lenBtns) {
        const sec = D?.routes?.[b.dataset.len]?.sec;
        b._mins.textContent = sec ? `≈ ${Math.max(1, Math.round(sec / 60))} min` : routes[b.dataset.len].label;
      }
    });

    const panel = seat ? await castPanel({ persona, hostName: first(host) }) : null;
    panel?.nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); done(); } });

    function sync() {
      hostCards.forEach((c) => { const on = c.dataset.host === host.id; c.classList.toggle('is-picked', on); c.setAttribute('aria-checked', String(on)); });
      lenBtns.forEach((b) => { const on = b.dataset.len === len; b.classList.toggle('is-picked', on); b.setAttribute('aria-checked', String(on)); });
    }
    sync();

    const inner = h('div.cast__inner');
    const el = h('div.cast.hostpick', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'hostpick-title' }, inner);
    container.append(el);
    requestAnimationFrame(() => el.classList.add('is-open'));

    // returning visitors: count down and start with what they picked last time
    const go = h('button.btn.btn--primary.cast__go', { type: 'button' });
    let goLabel = '';
    let quick = null; // "Start now with these picks": carries the countdown when there are steps left
    const QUICK = 'Start now with these picks';
    function stopCount() { clearInterval(timer); timer = null; go.textContent = goLabel; if (quick) quick.textContent = QUICK; }
    if (full && countdown > 0 && practiced()) {
      let left = countdown;
      timer = setInterval(() => { if (quick?.isConnected) quick.textContent = `${QUICK} (${left})`; else go.textContent = `${goLabel} (${left})`; if (left-- <= 0) done(); }, 1000);
      for (const ev of ['pointerdown', 'keydown']) el.addEventListener(ev, stopCount, { once: true });
      el.addEventListener('wheel', stopCount, { once: true, passive: true });
    }

    async function show(i) {
      at = i;
      const kind = steps[i];
      const last = i === steps.length - 1;
      el.scrollTop = 0;
      inner.replaceChildren();
      if (kind === 'practice') {
        stopCount();
        const run = practice(inner, { isWispr, step: `Step ${i + 1} of ${steps.length}` });
        if (!last) { const b = inner.querySelector('.onb__go'); if (b) b.textContent = 'Next'; } // the seat comes after it
        const k = inner.querySelector('.onb .cast__kicker'), t = inner.querySelector('.onb .cast__title');
        if (k && t) { k.className = 'hostpick__where'; t.after(k); } // same order as the other steps: title, then where you are
        await run;
        try { localStorage.setItem(PRACTICED, '1'); } catch { /* storage blocked */ }
        return last ? done() : show(i + 1);
      }
      goLabel = !full ? `Continue with ${first(host)}` : last ? 'Start the show' : 'Next';
      go.textContent = goLabel;
      go.onclick = () => (last ? done() : show(i + 1));
      const back = i > 0 ? h('button.cast__skip.hostpick__back', { type: 'button', onclick: () => { stopCount(); show(i - 1 - (steps[i - 1] === 'practice' ? 1 : 0)); } }, '‹ Back') : null;
      quick = full && timer && !last ? h('button.cast__skip.hostpick__quick', { type: 'button', onclick: () => done() }, QUICK) : null;
      const page = {
        host: () => [...head(i, full ? 'Welcome to a podcast that you control' : 'Who’s hosting?', 'Choose your host'), hostGrid,
          h('p.hostpick__sub', 'Switch hosts anytime during the show: tap a face on the caption bar under the picture.')],
        length: () => [...head(i, 'How long have you got?', 'Pick a length'), lenRow, h('p.hostpick__sub', SUB)],
        seat: () => [...head(i, 'Grab a seat in the audience', 'Pick who you are in the crowd'),
          panel.area, h('div.cast__form.hostpick__name', panel.field),
          h('p.hostpick__sub', { style: { fontSize: '12px', opacity: '.8' } }, 'Sameep sees the name you type and the parts you played, nothing else.')],
      }[kind]();
      inner.append(...page, h('div.hostpick__go', go, kind === 'seat' && h('button.cast__skip', { type: 'button', onclick: () => done(true) }, 'Skip the seat, just listen'), quick, back));
      setTimeout(() => (inner.querySelector('.is-picked') || inner.querySelector('.cast__card, .hostpick__len'))?.focus({ preventScroll: true }), 200);
    }
    show(0);

    function done(skipped = false) {
      if (!el.isConnected || el.classList.contains('is-closing')) return;
      clearInterval(timer);
      const visitor = panel ? panel.value(skipped) : null;
      el.classList.remove('is-open');
      el.classList.add('is-closing');
      sound.tick('open');
      setTimeout(() => el.remove(), 380);
      resolve({ host: host.id, route: len || null, visitor });
    }
  });
}
