// flowbar.js — makes the "say where to go" field catch text however it arrives.
// Dictation tools (Wispr Flow and friends) type, paste, or set the value through
// accessibility APIs, and the text goes to whatever has focus. Every way it can
// get lost is covered here:
//  · focus: the field takes focus whenever the podcast is live and nothing else
//    editable has it (after clicks on buttons, the scrub bar, the window), but
//    never steals from another input, an iframe, a dialog, or on touch screens
//  · typing anywhere in the app with nothing editable focused is routed in
//  · a paste anywhere (Cmd+V, or a dictation tool's simulated paste) is routed in
//  · input / change / paste / beforeinput / compositionend all re-read the value,
//    and a light poll catches values set with no event at all
// The owner gets onValue(text, how) for every change and onSubmit on Enter.
const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

export class FlowBar {
  constructor({ input, scope, isLive, onValue, onSubmit, onKey }) {
    this.input = input;
    this.scope = scope;
    this.isLive = isLive;
    this.onValue = onValue;
    this.onSubmit = onSubmit;
    this.onKey = onKey;
    this.last = input.value;
    this.fine = matchMedia('(hover: hover) and (pointer: fine)');

    const check = (how) => this.check(how);
    input.addEventListener('input', (e) => check(e.inputType || 'input'));
    input.addEventListener('change', () => check('change'));
    input.addEventListener('paste', () => setTimeout(() => check('paste'), 0));
    input.addEventListener('beforeinput', () => setTimeout(() => check('beforeinput'), 0));
    input.addEventListener('compositionend', () => check('composition'));
    input.addEventListener('keydown', (e) => {
      if (e.isComposing) return;
      if (e.key === 'Enter') { e.preventDefault(); this.check('enter'); this.onSubmit(input.value); return; }
      // an empty field passes the player's shortcuts through
      if (!input.value && [' ', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        this.onKey?.(e.key);
      }
    });

    // typing / pasting anywhere in the app lands in the field
    document.addEventListener('keydown', (e) => this.#route(e), true);
    document.addEventListener('paste', (e) => this.#paste(e), true);
    // clicks on buttons, the scrub bar or the window hand focus back
    scope.addEventListener('pointerup', (e) => {
      if (e.target.closest(EDITABLE + ', iframe, .cast, [data-keep-focus]')) return;
      setTimeout(() => this.ensureFocus(), 0);
    });
    window.addEventListener('focus', () => setTimeout(() => this.ensureFocus(), 0));

    // fallback for values set without any event (accessibility insertion)
    this.poll = setInterval(() => { if (this.input.value !== this.last) this.check('poll'); }, 250);
  }

  check(how) {
    const v = this.input.value;
    if (v === this.last) return;
    this.last = v;
    this.onValue(v, how);
  }

  set(v) { this.input.value = v; this.last = v; }

  #otherEditable(el) {
    if (!el || el === document.body || el === document.documentElement) return false;
    if (el === this.input) return false;
    return el.matches?.(EDITABLE) || el.tagName === 'IFRAME' || el.isContentEditable;
  }

  // focus the field if that can't take anything away from the visitor
  ensureFocus(force = false) {
    if (!this.isLive()) return false;
    if (!force && !this.fine.matches) return false; // touch: don't pop the keyboard
    const a = document.activeElement;
    if (a === this.input) return true;
    if (this.#otherEditable(a)) return false;
    if (document.querySelector('.win--modal:not([hidden]), .cast')) return false;
    if (a && a !== document.body && !this.scope.contains(a) && !a.closest?.('.desk, .win')) return false;
    this.input.focus({ preventScroll: true });
    return document.activeElement === this.input;
  }

  #insert(text) {
    const i = this.input;
    const cur = i.value;
    i.focus({ preventScroll: true });
    const sep = cur && !/\s$/.test(cur) && !/^\s/.test(text) && text.length > 1 ? ' ' : '';
    i.value = cur + sep + text;
    try { i.setSelectionRange(i.value.length, i.value.length); } catch { /* noop */ }
    i.dispatchEvent(new Event('input', { bubbles: true }));
    this.check('routed');
  }

  #route(e) {
    if (e.defaultPrevented || e.isComposing || !this.isLive()) return;
    const t = e.target;
    if (t === this.input || this.#otherEditable(t)) return;
    if (document.querySelector('.win--modal:not([hidden]), .cast')) return;
    if ((e.metaKey || e.ctrlKey) && (e.key === 'v' || e.key === 'V')) {
      // let the paste land in the field natively
      this.input.focus({ preventScroll: true });
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Enter' && this.input.value.trim() && !t.closest?.('button, a, [role="slider"]')) {
      e.preventDefault();
      this.onSubmit(this.input.value);
      return;
    }
    if (e.key === 'Backspace' && this.input.value) {
      e.preventDefault();
      this.input.focus({ preventScroll: true });
      this.input.value = this.input.value.slice(0, -1);
      this.check('routed');
      return;
    }
    if (e.key.length !== 1) return;
    // space with nothing typed is the play/pause shortcut (or a button press)
    if (e.key === ' ' && !this.input.value) return;
    e.preventDefault();
    e.stopPropagation();
    this.#insert(e.key);
  }

  #paste(e) {
    if (!this.isLive()) return;
    const t = e.target;
    if (t === this.input || this.#otherEditable(t)) return; // native paste
    const text = e.clipboardData?.getData('text/plain') || e.clipboardData?.getData('text') || '';
    if (!text.trim()) return;
    e.preventDefault();
    this.#insert(text.trim());
  }
}
