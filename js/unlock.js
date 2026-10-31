// unlock.js — iOS only lets audio start inside a tap. So the first tap creates the one
// AudioContext the hero and the app share, and primes a few <audio> elements the podcast
// takes later (an element that played once in a tap stays allowed to play).
const SILENT = 'data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';
let ctx = null;
const pool = [];

export function sharedCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) { try { ctx = new AC(); } catch { /* no audio */ } }
  return ctx;
}

// call from inside a user gesture
export function unlockAudio() {
  sharedCtx()?.resume?.().catch?.(() => {});
  while (pool.length < 4) {
    const a = new Audio();
    a.src = SILENT;
    a.play()?.then(() => a.pause()).catch(() => {});
    pool.push(a);
  }
}

export function takeAudio() {
  const a = pool.shift() || new Audio();
  a.removeAttribute('src');
  return a;
}

const first = () => { unlockAudio(); ['pointerdown', 'touchend', 'keydown'].forEach((e) => removeEventListener(e, first, true)); };
['pointerdown', 'touchend', 'keydown'].forEach((e) => addEventListener(e, first, { capture: true, passive: true }));
