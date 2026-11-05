// onboard.js — "Try steering": a practice fork in the welcome window, the way Wispr
// Flow's own onboarding has you press the keys and watch your words land before
// you start for real. Two tries, each skippable:
//   1. tap: two sample cards; press one and it lights up (that's a fork)
//   2. say: hold the Flow key (or tap the mic, or type) and say one; a level meter
//      shows the mic hearing you, the words appear, the matching card lights up
//   await practice(hostEl, { isWispr, step: 'Step 3 of 4' })  → resolves on Continue / Skip
import { bestMatch } from './fuzzy.js';
import { isNarrow } from './util.js';

const CARDS = [
  { key: 'ppt', label: 'Tell me about ppt.live', phrases: ['ppt live', 'ppt', 'p p t', 'tell me about ppt live', 'presentation', 'live show'] },
  { key: 'fun', label: 'Something fun', phrases: ['something fun', 'fun', 'fun stuff', 'play'] },
];

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

export function practice(host, { isWispr = false, step = '' } = {}) {
  return new Promise((resolve) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const root = el('div', 'onb');
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'Try steering');
    const kicker = el('p', 'cast__kicker', step ? `${step} · Try steering` : 'Try steering');
    const title = el('h2', 'cast__title', 'You’re in control. Try it.');
    const lede = el('p', 'cast__lede', 'Every few minutes the show stops at a fork and asks where to go next.');

    // 1. tap
    const s1 = el('div', 'onb__step is-now');
    const s1h = el('p', 'onb__ask'); s1h.innerHTML = '<b>1</b> Press one of the options below.';
    const grid = el('div', 'onb__cards');
    const cards = CARDS.map((c) => {
      const b = el('button', 'onb__card', c.label); b.type = 'button';
      b.onclick = () => tapped(c, b);
      grid.append(b); return b;
    });
    const s1ok = el('p', 'onb__ok'); s1ok.hidden = true;
    s1.append(s1h, grid, s1ok);

    // 2. say
    const s2 = el('div', 'onb__step is-later');
    const s2h = el('p', 'onb__ask');
    // a phone has no Flow key (or fn): there it's the mic, or typing
    const flowKey = isWispr && !isNarrow();
    // say the card they didn't tap, so a match visibly moves the light
    const ask = (label) => {
      const q = `“<i>${escapeHTML(label.toLowerCase())}</i>”`;
      s2h.innerHTML = flowKey
        ? `<b>2</b> Now say it. Hold your <kbd>Flow</kbd> key and say ${q}.`
        : SR ? `<b>2</b> Now say it. Tap the mic and say ${q}, or just type it.` : `<b>2</b> Now type it: ${q}.`;
    };
    ask(CARDS[1].label);
    const form = el('form', 'onb__say');
    const lead = el('span', 'onb__lead');
    if (isWispr) { const im = el('img'); im.src = 'img/ui/wispr.svg'; im.alt = ''; im.width = 20; im.height = 20; lead.append(im); } else lead.textContent = '›';
    const input = el('input', 'onb__in');
    Object.assign(input, { type: 'text', placeholder: flowKey ? 'Hold your Flow key and speak…' : 'Say or type where to go…', autocomplete: 'off', spellcheck: false });
    input.setAttribute('aria-label', 'Say or type where to go');
    const meter = el('span', 'onb__meter'); meter.setAttribute('aria-hidden', 'true');
    const bars = Array.from({ length: 5 }, () => meter.appendChild(el('i')));
    const mic = SR ? el('button', 'onb__mic') : null;
    if (mic) { mic.type = 'button'; mic.setAttribute('aria-label', 'Speak'); mic.innerHTML = '<span class="ico ico--mic"></span>'; mic.onclick = listen; }
    form.append(lead, input, meter);
    if (mic) form.append(mic);
    form.onsubmit = (e) => { e.preventDefault(); heard(input.value); };
    const s2ok = el('p', 'onb__ok'); s2ok.hidden = true; s2ok.setAttribute('aria-live', 'polite');
    s2.append(s2h, form, s2ok);

    // footer
    const foot = el('div', 'onb__foot');
    const skip = el('button', 'cast__skip', 'Skip the practice'); skip.type = 'button';
    const go = el('button', 'btn btn--primary onb__go', 'Start the show'); go.type = 'button';  // live from the start: the practice is optional
    skip.onclick = () => done(); go.onclick = () => done();
    foot.append(skip, go);

    root.append(kicker, title, lede, s1, s2, foot);
    host.append(root);
    requestAnimationFrame(() => root.classList.add('is-open'));
    setTimeout(() => cards[0].focus({ preventScroll: true }), 250);

    let saidOk = false, stopListen = null, last = '';
    function light(i) { cards.forEach((b, j) => b.classList.toggle('is-lit', j === i)); }
    function tapped(c, b) {
      light(cards.indexOf(b));
      s1ok.hidden = false;
      s1ok.innerHTML = '✓ That’s it. At a real fork that plays the next part. Do nothing and the <b>recommended</b> one plays after a short countdown.';
      if (!saidOk) ask(CARDS[1 - CARDS.indexOf(c)].label);
      if (s2.classList.contains('is-later')) {
        s1.classList.replace('is-now', 'is-done'); s2.classList.replace('is-later', 'is-now');
        setTimeout(() => (flowKey || !SR ? input : mic || input).focus({ preventScroll: true }), 200);
      }
    }
    function heard(text) {
      const t = (text || '').trim(); if (!t || saidOk) return;
      const m = bestMatch(t, CARDS, 0.4);
      if (!m) { s2ok.hidden = false; s2ok.className = 'onb__ok is-miss'; s2ok.textContent = `Heard “${t}”. Try one of the two cards’ words.`; return; }
      saidOk = true;
      light(CARDS.indexOf(m.item));
      s2ok.hidden = false; s2ok.className = 'onb__ok';
      s2ok.innerHTML = `✓ Heard “${escapeHTML(t)}” → <b>${escapeHTML(m.item.label)}</b>. You’re steering. Say anything close: it matches what you mean, not exact words.`;
      s2.classList.replace('is-now', 'is-done');
      go.focus({ preventScroll: true });
      root.classList.add('is-win');
      skip.hidden = true;  // both tries done: Start the show is the only way on
    }
    // dictation tools set the value in all sorts of ways: read it on every event, and poll
    const read = () => { if (input.value !== last) { last = input.value; meterFrom(input.value.length ? 0.6 : 0); clearTimeout(read.t); read.t = setTimeout(() => heard(input.value), 700); } };
    ['input', 'change', 'paste', 'compositionend'].forEach((ev) => input.addEventListener(ev, () => setTimeout(read, 0)));
    const poll = setInterval(read, 400);

    function meterFrom(level) { bars.forEach((b, i) => b.style.transform = `scaleY(${Math.max(0.15, Math.min(1, level * (1.4 - Math.abs(i - 2) * 0.25) + Math.random() * 0.15))})`); }
    async function listen() {
      if (stopListen) { stopListen(); return; }
      const rec = new SR(); rec.lang = 'en-US'; rec.interimResults = true; rec.maxAlternatives = 1;
      let stream = null, raf = 0, ctx = null;
      try { // the level meter, like Wispr's mic test: proof the mic hears you
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        ctx = new AudioContext(); const an = ctx.createAnalyser(); an.fftSize = 256; ctx.createMediaStreamSource(stream).connect(an);
        const buf = new Uint8Array(an.fftSize);
        const tick = () => { an.getByteTimeDomainData(buf); let s = 0; for (const v of buf) s += ((v - 128) / 128) ** 2; meterFrom(Math.sqrt(s / buf.length) * 6); raf = requestAnimationFrame(tick); };
        tick();
      } catch { /* no meter, recognition can still work */ }
      mic.classList.add('is-on'); form.classList.add('is-listening');
      rec.onresult = (e) => { const t = [...e.results].map((r) => r[0].transcript).join(' '); input.value = t; last = t; if (e.results[e.results.length - 1].isFinal) heard(t); };
      stopListen = () => { try { rec.stop(); } catch { /* already stopped */ } cancelAnimationFrame(raf); stream?.getTracks().forEach((tr) => tr.stop()); ctx?.close(); meterFrom(0); mic.classList.remove('is-on'); form.classList.remove('is-listening'); stopListen = null; };
      rec.onend = () => stopListen?.(); rec.onerror = () => stopListen?.();
      rec.start();
    }
    function done() {
      clearInterval(poll); stopListen?.();
      root.classList.add('is-closing');
      setTimeout(() => root.remove(), 300);
      resolve({ tapped: !s1ok.hidden, said: saidOk });
    }
  });
}

function escapeHTML(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
