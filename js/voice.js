// voice.js — say what to do, anywhere on the site. A pill in the bottom right
// (Wispr Flow's look) with a box beside it showing what was heard.
//  · desktop: hold fn (or your Flow key) and speak. Wispr Flow types or pastes into
//    the focused field, so the box keeps focus while nothing else editable has it,
//    and a paste anywhere is caught too. A click on the pill uses the browser's
//    speech recognition where there is one.
//  · phones: tap the pill, speak; the browser's SpeechRecognition hears it.
// One router for every phase: the entry screen, the hero (fold it, fly it, shred it…),
// the iMac boot, and the podcast (its own choices plus pause/play/skip/menu/change host).
// Phases register handlers with voice.setPhase(name, handlers).
import { bestMatch } from './app/fuzzy.js';
import { coach } from './coach.js';
import { isWispr } from './version.js';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const fine = matchMedia('(hover: hover) and (pointer: fine)');
const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

// what each phase understands: [key, phrases, label shown in "Try saying…"]
const COMMANDS = {
  gate: [
    ['enter', ['enter', 'go in', 'start', 'lets go', 'begin', 'sound on', 'open'], 'enter'],
    ['quiet', ['enter muted', 'muted', 'no sound', 'quietly', 'silent'], 'enter muted'],
  ],
  hero: [
    ['next', ['next', 'continue', 'go on', 'keep going', 'forward', 'down', 'scroll'], 'next'],
    ['back', ['back', 'go back', 'previous', 'up'], 'back'],
    ['envelope', ['take mine', 'open the envelope', 'envelope', 'pick it up', 'take it'], null],
    ['fold', ['fold it', 'fold', 'make the plane', 'make a plane', 'paper plane', 'origami'], 'fold it'],
    ['dart', ['dart', 'classic dart', 'classic'], 'dart / glider / stunt'],
    ['glider', ['glider', 'glide'], null],
    ['stunt', ['stunt', 'rudder', 'trim', 'loop'], null],
    ['fly', ['fly it', 'fly', 'throw it', 'launch it', 'flew'], 'fly it'],
    ['crumple', ['crumple', 'crumple it', 'scrunch', 'crush it', 'ball it up'], 'crumple'],
    ['shred', ['shred it', 'shred', 'shredder', 'rip it'], 'shred it'],
    ['strike', ['strike the match', 'strike', 'open the matchbox', 'matchbox', 'match'], 'strike the match'],
    ['burn', ['burn it', 'burn', 'light it up', 'light it', 'set it on fire', 'fire'], 'light it up'],
    ['cd', ['cd', 'burn a cd', 'onto a cd', 'disc'], null],
    ['insert', ['insert the cd', 'insert', 'put it in', 'into the imac', 'imac', 'play it'], 'insert the CD'],
    ['skip', ['skip', 'skip the intro', 'skip to the work', 'take me to the work'], 'skip'],
  ],
  boot: [
    ['enter', ['enter', 'power on', 'turn it on', 'start', 'insert the cd', 'insert', 'connect', 'dial', 'skip', 'next', 'go'], 'connect'],
  ],
  podcast: [], // the podcast's own matcher (cards, chapters, pause, play, skip, back, menu, change host)
};
const GLOBAL = [
  ['help', ['help', 'what can i say', 'commands', 'try saying', 'what do i say'], 'help'],
  ['mute', ['mute', 'sound off', 'quiet'], null],
  ['unmute', ['unmute', 'sound on', 'volume on'], null],
];
const PODCAST_HELP = ['pause', 'play', 'skip', 'back', 'menu', 'change host', 'or a card’s name'];

let phase = 'gate', H = {};
let el, btn, box, label, helpBtn, helpEl;
let rec = null, settleT = 0, lastKeyAt = 0, misses = 0;

function css() {
  if (document.getElementById('voice-css')) return;
  const s = document.createElement('style');
  s.id = 'voice-css';
  s.textContent = `
.vpill { position: fixed; right: max(16px, env(safe-area-inset-right)); bottom: max(16px, env(safe-area-inset-bottom)); z-index: 9990;
  display: flex; align-items: center; gap: 8px; pointer-events: none; font: 500 13px/1.2 'Bricolage Grotesque', system-ui, sans-serif; }
.vpill > * { pointer-events: auto; }
.vpill__box { width: min(260px, 52vw); height: 40px; padding: 0 14px; border: 0; border-radius: 20px; background: rgba(13,13,13,.86); color: #fff;
  font: inherit; font-size: 14px; outline: none; box-shadow: 0 0 0 1px rgba(255,255,255,.08), 0 8px 24px rgba(0,0,0,.35); backdrop-filter: blur(8px);
  transition: box-shadow .2s, opacity .2s, width .25s; }
.vpill__box::placeholder { color: #8c8c8c; }
.vpill__box:focus { box-shadow: 0 0 0 1px rgba(255,255,255,.22), 0 8px 24px rgba(0,0,0,.35); }
.vpill[data-state="heard"] .vpill__box { box-shadow: 0 0 0 1.5px #9be58a, 0 8px 24px rgba(0,0,0,.35); }
.vpill[data-state="miss"] .vpill__box { box-shadow: 0 0 0 1.5px #f5c518, 0 8px 24px rgba(0,0,0,.35); }
.vpill__btn { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 14px 0 12px; border: 0; border-radius: 20px; cursor: pointer;
  background: #0d0d0d; color: #fff; font: inherit; font-weight: 700; box-shadow: 0 0 0 1px rgba(255,255,255,.1), 0 8px 24px rgba(0,0,0,.4); }
.vpill__btn:hover { background: #1b1b1b; }
.vpill__wave { display: flex; align-items: center; gap: 2.5px; height: 16px; }
.vpill__wave i { width: 3px; height: 4px; border-radius: 2px; background: #fff; transition: height .12s; }
.vpill[data-state="listening"] .vpill__btn { background: #fff; color: #0d0d0d; }
.vpill[data-state="listening"] .vpill__wave i { background: #0d0d0d; animation: vwave .7s ease-in-out infinite alternate; }
.vpill[data-state="listening"] .vpill__wave i:nth-child(2) { animation-delay: -.2s; }
.vpill[data-state="listening"] .vpill__wave i:nth-child(3) { animation-delay: -.45s; }
.vpill[data-state="listening"] .vpill__wave i:nth-child(4) { animation-delay: -.1s; }
.vpill[data-state="listening"] .vpill__wave i:nth-child(5) { animation-delay: -.35s; }
.vpill__k { white-space: nowrap; }
.vpill__k kbd { padding: 1px 5px; border-radius: 5px; background: #2a2a2a; font: 700 11px/1.3 'Spline Sans Mono', monospace; }
.vpill[data-state="listening"] .vpill__k kbd { background: #e6e6e6; }
.vpill__help { width: 30px; height: 30px; border: 0; border-radius: 50%; background: rgba(13,13,13,.86); color: #cfcfcf; font: 700 13px/1 system-ui; cursor: pointer;
  box-shadow: 0 0 0 1px rgba(255,255,255,.08); }
.vhelp { position: fixed; right: 16px; bottom: 68px; z-index: 9991; width: min(300px, calc(100vw - 32px)); padding: 14px 16px; border-radius: 20px;
  background: #0d0d0d; color: #9a9a9a; font: 500 13px/1.4 'Bricolage Grotesque', system-ui, sans-serif; box-shadow: 0 10px 34px rgba(0,0,0,.45); }
.vhelp h3 { margin: 0 0 8px; color: #fff; font-size: 15px; font-weight: 800; }
.vhelp ul { margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 6px; }
.vhelp li button { border: 0; border-radius: 999px; padding: 5px 10px; background: #222; color: #fff; font: 600 12.5px/1 'Bricolage Grotesque', system-ui; cursor: pointer; }
.vhelp li button:hover { background: #333; }
.vhelp p { margin: 10px 0 0; font-size: 12px; }
@keyframes vwave { from { height: 4px; } to { height: 15px; } }
.is-gated .vpill { z-index: 100001; }
.vpill--hero { bottom: calc(max(16px, env(safe-area-inset-bottom)) + 58px); } /* above the hero's Skip pill */
html.in-app .vpill--podcast .vpill__box { display: none; }
@media (max-width: 760px) {
  .vpill__box { width: 0; padding: 0; opacity: 0; }
  .vpill[data-state="listening"] .vpill__box, .vpill[data-state="heard"] .vpill__box, .vpill[data-state="miss"] .vpill__box, .vpill__box:focus { width: min(220px, 56vw); padding: 0 14px; opacity: 1; }
  .vpill--hero { bottom: max(16px, env(safe-area-inset-bottom)); } /* phones: Skip sits bottom left, the pill takes the right */
  html.in-app .vpill { bottom: auto; top: max(34px, env(safe-area-inset-top)); }
  html.in-app .vhelp { bottom: auto; top: 80px; }
}
@media (prefers-reduced-motion: reduce) { .vpill[data-state="listening"] .vpill__wave i { animation: none; height: 10px; } }`;
  document.head.append(s);
}

const keyHint = () => (fine.matches ? (isWispr ? 'Hold <kbd>fn</kbd> · Flow' : 'Hold <kbd>fn</kbd> or click') : 'Talk');

function mount() {
  if (el) return;
  css();
  el = document.createElement('div');
  el.className = 'vpill';
  el.dataset.state = 'idle';
  el.innerHTML = `
    <input class="vpill__box" type="text" autocomplete="off" spellcheck="false" autocapitalize="off" enterkeyhint="go"
      aria-label="Say or type what to do" placeholder="Say “next”…">
    <button class="vpill__btn" type="button" aria-label="Talk: say what to do"><span class="vpill__wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><span class="vpill__k">${keyHint()}</span></button>
    <button class="vpill__help" type="button" aria-label="What can I say?" aria-expanded="false">?</button>`;
  document.body.append(el);
  box = el.querySelector('.vpill__box');
  btn = el.querySelector('.vpill__btn');
  label = el.querySelector('.vpill__k');
  helpBtn = el.querySelector('.vpill__help');

  btn.addEventListener('click', () => listen());
  helpBtn.addEventListener('click', () => help());
  // text arrives however a dictation tool sends it: typed, pasted, inserted
  let typed = false;
  box.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    if (e.key === 'Enter') { e.preventDefault(); run(box.value); return; }
    if (e.key === 'Escape') { box.value = ''; box.blur(); return; }
    if (!box.value && phase === 'hero') {
      const dir = { ArrowDown: 1, PageDown: 1, ' ': e.shiftKey ? -1 : 1, ArrowUp: -1, PageUp: -1 }[e.key];
      if (dir) { e.preventDefault(); H.step?.(dir); return; }
    }
    if (e.key.length === 1) { typed = true; lastKeyAt = performance.now(); }
  });
  box.addEventListener('input', () => {
    setState(box.value ? 'listening' : 'idle');
    clearTimeout(settleT);
    // dictated text lands in one go: act soon. Typing: wait for a pause (or Enter).
    const byHand = typed && performance.now() - lastKeyAt < 400;
    typed = false;
    if (box.value.trim()) settleT = setTimeout(() => run(box.value), byHand ? 1400 : 450);
  });
  // a paste anywhere (Flow's fallback when no field has focus)
  document.addEventListener('paste', (e) => {
    const t = e.target;
    if (phase === 'podcast' || t === box || t.closest?.(EDITABLE)) return;
    const text = e.clipboardData?.getData('text/plain') || '';
    if (!text.trim()) return;
    e.preventDefault();
    box.value = text.trim();
    run(box.value);
  }, true);
  // the fn key itself is invisible to most browsers; where it does show up, light the pill
  addEventListener('keydown', (e) => { if (e.key === 'Fn' || e.key === 'FnLock') setState('listening'); });
  addEventListener('keyup', (e) => { if ((e.key === 'Fn' || e.key === 'FnLock') && !box.value) setState('idle'); });
  // keep the box ready for Flow on desktop (never steals from another field, never on touch)
  addEventListener('pointerup', () => setTimeout(keepFocus, 0));
  addEventListener('focus', () => setTimeout(keepFocus, 0));
  document.addEventListener('click', (e) => { if (helpEl && !e.target.closest('.vhelp, .vpill__help')) closeHelp(); });
}

function keepFocus() {
  if (!el || !fine.matches || phase === 'podcast' || phase === 'gate') return;
  const a = document.activeElement;
  if (a === box) return;
  if (a && a !== document.body && a !== document.documentElement && (a.matches?.(EDITABLE) || a.tagName === 'IFRAME' || a.isContentEditable)) return;
  if (a && a.closest?.('.gate, .coach, .vhelp, [role="dialog"]')) return;
  box.focus({ preventScroll: true });
}

function setState(s) { if (el) el.dataset.state = s; }

// ---------------------------------------------------------------- hearing
function listen() {
  closeHelp();
  if (phase === 'podcast' && H.listen) { H.listen(); return; }
  if (rec) { rec.stop(); return; }
  if (!SR) {
    // no speech recognition here (Firefox, some iPhones): the keyboard's own mic or Flow types into the box
    box.focus();
    coach.show('voice-nosr', 'dock', fine.matches ? 'Hold <b>fn</b> with Wispr Flow (or any dictation) and speak, or type it.' : 'Tap the <b>mic on your keyboard</b> and speak, or type it.',
      { title: 'Speak into the box', once: false, replace: true, ms: 9000 });
    return;
  }
  const r = new SR();
  r.lang = navigator.language || 'en-US';
  r.interimResults = true;
  r.maxAlternatives = 3;
  rec = r;
  setState('listening');
  box.value = '';
  box.placeholder = 'Listening…';
  let final = '', alts = [];
  r.onresult = (e) => {
    let s = '';
    for (const res of e.results) { s += res[0].transcript; if (res.isFinal) { final = s; alts = [...res].map((a) => a.transcript); } }
    box.value = s;
  };
  r.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') miss('mic');
    else if (e.error === 'no-speech') miss('silence');
  };
  r.onend = () => {
    rec = null;
    box.placeholder = 'Say “next”…';
    if (final) run(final, alts);
    else if (el.dataset.state === 'listening') setState('idle');
  };
  try { r.start(); } catch { rec = null; setState('idle'); }
}

// ---------------------------------------------------------------- the router
function run(text, alts = []) {
  clearTimeout(settleT);
  text = String(text || '').trim();
  if (!text) return;
  // the podcast has its own matcher (cards and chapters change every node)
  if (phase === 'podcast' && H.say) { H.say(text); box.value = ''; setState('idle'); return; }
  const items = [...(COMMANDS[phase] || []), ...GLOBAL].map(([key, phrases]) => ({ key, phrases }));
  let m = null;
  for (const t of [text, ...alts]) { m = bestMatch(t, items, 0.55); if (m) break; }
  if (!m) { miss('nomatch', text); return; }
  misses = 0;
  const k = m.item.key;
  if (k === 'help') help(true);
  else if (k === 'mute') H.sound?.(false);
  else if (k === 'unmute') H.sound?.(true);
  else H.command?.(k, text);
  setState('heard');
  box.value = '✓ ' + text;
  setTimeout(() => { if (box.value === '✓ ' + text) { box.value = ''; setState('idle'); } }, 1400);
}

function miss(why, text = '') {
  setState('miss');
  misses++;
  const desk = fine.matches;
  const t = {
    mic: ['Microphone is off', desk ? 'Allow the microphone for this site, or hold <b>fn</b> with Wispr Flow.' : 'Allow the microphone in your browser settings, or type it.'],
    silence: ['Didn’t hear anything', desk ? 'Hold <b>fn</b> while speaking, release to see text.' : 'Tap the pill, then speak. It stops when you pause.'],
    nomatch: ['Didn’t catch that', `Heard “<span class="coach__heard"></span>”. Try ${tryList().slice(0, 3).map((s) => `“${s}”`).join(', ')}.`],
  }[why];
  const g = coach.show('voice-miss', 'dock', t[1], { title: t[0], once: false, replace: true, ms: 8000 });
  if (g && text) g.querySelector('.coach__heard').textContent = text.slice(0, 60);
  setTimeout(() => { if (el.dataset.state === 'miss') { box.value = ''; setState('idle'); } }, 2500);
}

function tryList() {
  if (phase === 'podcast') return PODCAST_HELP;
  return (COMMANDS[phase] || []).map((c) => c[2]).filter(Boolean);
}

// ---------------------------------------------------------------- "Try saying…"
function help(force) {
  if (helpEl && !force) { closeHelp(); return; }
  closeHelp();
  helpEl = document.createElement('div');
  helpEl.className = 'vhelp';
  helpEl.setAttribute('role', 'dialog');
  helpEl.setAttribute('aria-label', 'Try saying');
  const how = fine.matches
    ? (isWispr ? 'Hold <b style="color:#fff">fn</b> (your Wispr Flow key), speak, let go. Or click the pill.' : 'Hold <b style="color:#fff">fn</b> with Wispr Flow, or click the pill and speak. Typing works too.')
    : 'Tap the pill and speak. Typing works too.';
  helpEl.innerHTML = '<h3>Try saying…</h3><ul></ul><p></p>';
  helpEl.querySelector('p').innerHTML = how;
  const ul = helpEl.querySelector('ul');
  for (const s of tryList()) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = s;
    if (!/^or /.test(s)) b.onclick = () => { closeHelp(); run(s.split(' / ')[0]); };
    else b.disabled = true;
    li.append(b); ul.append(li);
  }
  document.body.append(helpEl);
  helpBtn.setAttribute('aria-expanded', 'true');
}
function closeHelp() { helpEl?.remove(); helpEl = null; helpBtn?.setAttribute('aria-expanded', 'false'); }

// ---------------------------------------------------------------- stuck in the hero?
// A wheel, swipe or arrow that didn't move the story (iOS rubber-banding, focus
// stuck in a frame, a blocked wheel): offer the voice instead, with a mic test.
let lastP = 0, tries = 0, watchT = 0, shown = 0;
function attempt() {
  if (phase !== 'hero' || watchT || shown >= 2 || document.documentElement.classList.contains('is-gated')) return;
  const p0 = lastP;
  watchT = setTimeout(() => {
    watchT = 0;
    if (phase !== 'hero' || lastP > 0.995) return;
    if (Math.abs(lastP - p0) > 0.002) { tries = 0; return; }
    if (++tries < 2) return;
    tries = 0; shown++;
    stuckGuide();
  }, 1300);
}
function stuckGuide() {
  const g = coach.show('hero-stuck', 'dock', `Say <b>“next”</b> to move the story on${fine.matches ? ': hold <b>fn</b> and speak' : ''}. Check your mic first:`
    + '<div class="coach__act"><button class="coach__btn" type="button">Test my mic</button><span class="coach__heard" aria-live="polite"></span></div>',
  { title: 'Stuck? Say “next”.', once: false, replace: true, ms: 16000 });
  if (!g) return;
  const out = g.querySelector('.coach__heard');
  g.querySelector('.coach__btn').onclick = () => {
    if (!SR) { box.focus(); out.textContent = 'Speak or type into the box below.'; return; }
    const r = new SR();
    r.lang = navigator.language || 'en-US';
    r.interimResults = true;
    out.textContent = 'Listening…';
    r.onresult = (e) => { out.textContent = '“' + [...e.results].map((x) => x[0].transcript).join('') + '”'; };
    r.onerror = (e) => { out.textContent = e.error === 'not-allowed' ? 'Mic blocked. Allow it for this site.' : 'Didn’t hear anything. Try again.'; };
    r.onend = () => { const t = out.textContent.replace(/[“”]/g, ''); if (t && !/Listening|blocked|Didn’t/.test(t)) run(t); };
    try { r.start(); } catch { out.textContent = 'Mic busy. Try again.'; }
  };
}
['wheel', 'touchend', 'keydown'].forEach((ev) => addEventListener(ev, (e) => {
  if (ev === 'keydown' && !['ArrowDown', 'PageDown', ' ', 'ArrowUp', 'PageUp'].includes(e.key)) return;
  if (ev === 'wheel' && Math.abs(e.deltaY) < 8) return;
  attempt();
}, { passive: true, capture: true }));

// ---------------------------------------------------------------- API
export const voice = {
  setPhase(name, handlers = {}) {
    phase = name; H = handlers;
    mount();
    el.classList.toggle('vpill--podcast', name === 'podcast');
    el.classList.toggle('vpill--hero', name === 'hero' || name === 'boot');
    label.innerHTML = keyHint();
    closeHelp();
    if (name !== 'podcast') setTimeout(keepFocus, 50);
    else if (document.activeElement === box) box.blur();
  },
  heroProgress(p) { lastP = p; },
  run,
  get phase() { return phase; },
};
