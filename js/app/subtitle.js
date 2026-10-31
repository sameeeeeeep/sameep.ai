// subtitle.js — plain, clean subtitles: the line's text, nothing more.
// (The old messy → clean dictation effect is gone; `messy` stays in the JSON, unused.)
import { h } from './util.js';

export function renderSubtitle(el, { text }) {
  el.textContent = '';
  el.classList.remove('is-messy', 'is-cleaning');
  el.append(h('span.sub__clean', text || ''));
  el.classList.add('is-clean');
  return { cancel() {} };
}
