// cast.js — "join the audience": the visitor picks an audience avatar (or uses
// their own photo, processed in this tab only) and a name the host can use.
// The avatar shows in the option cards; the visitor is never put on the set.
import { h, store } from './util.js';
import { sound } from './audio.js';

const KEY = 'offthecv.visitor';

export function savedVisitor() {
  try { return JSON.parse(store.get(KEY) || 'null'); } catch { return null; }
}

const loadImg = (src) => new Promise((r) => { if (!src) return r(null); const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });

// Photo → pixelated, posterised tri-tone so it sits next to the illustrated cast.
// Runs entirely in this tab: nothing is uploaded or stored.
export async function stylisePhoto(file) {
  const url = URL.createObjectURL(file);
  const img = await loadImg(url);
  URL.revokeObjectURL(url);
  if (!img) return null;
  const S = 96;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d', { willReadFrequently: true });
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2, sy = Math.max(0, (img.naturalHeight - side) / 2 - side * 0.06);
  g.drawImage(img, sx, sy, side, side, 0, 0, S, S);
  const d = g.getImageData(0, 0, S, S);
  const ramp = [[11, 37, 48], [10, 143, 168], [255, 169, 70], [243, 238, 226]];
  // contrast-stretch luminance first so dim selfies still read
  let lo = 255, hi = 0;
  const L = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) { const l = 0.299 * d.data[i * 4] + 0.587 * d.data[i * 4 + 1] + 0.114 * d.data[i * 4 + 2]; L[i] = l; lo = Math.min(lo, l); hi = Math.max(hi, l); }
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let i = 0; i < S * S; i++) {
    const x = i % S, y = (i / S) | 0;
    let t = (L[i] - lo) / Math.max(1, hi - lo);
    t = Math.min(1, Math.max(0, t + (bayer[(y % 4) * 4 + (x % 4)] / 16 - 0.5) * 0.18));
    const k = Math.min(3, Math.floor(t * 4));
    const [r, gg, b] = ramp[k];
    d.data[i * 4] = r; d.data[i * 4 + 1] = gg; d.data[i * 4 + 2] = b; d.data[i * 4 + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  const out = document.createElement('canvas');
  out.width = out.height = 384;
  const og = out.getContext('2d');
  og.imageSmoothingEnabled = false;
  og.drawImage(c, 0, 0, 384, 384);
  return out.toDataURL('image/png');
}

// Shows the picker inside `host` (the podcast window body). Resolves with the
// visitor { name, character: {id,label,src}|null, photo: dataURL|null }.
export function openCast(host, { persona, hostName }) {
  return new Promise(async (resolve) => {
    const prev = savedVisitor() || {};
    let pick = prev.character ? persona.characters.find((c) => c.id === prev.character) : null;
    let photo = null;

    const nameIn = h('input.cast__name', { type: 'text', id: 'cast-name', maxlength: '24', autocomplete: 'given-name', placeholder: 'Your first name', value: prev.name || '', enterkeyhint: 'done' });
    const go = h('button.btn.btn--primary.cast__go', { type: 'submit' }, 'Join the audience');
    const grid = h('div.cast__grid', { role: 'radiogroup', 'aria-label': 'Choose your audience avatar' });
    const fileIn = h('input', { type: 'file', accept: 'image/*', hidden: true });
    const photoCard = h('button.cast__card.cast__card--photo', { type: 'button', role: 'radio', 'aria-checked': 'false' },
      h('span.cast__portrait', h('span.cast__plus', { 'aria-hidden': 'true' }, '+')),
      h('span.cast__label', 'Use my own photo'),
      h('span.cast__blurb', 'Stays in this tab. Never uploaded.'));

    const select = (card, c) => {
      grid.querySelectorAll('.cast__card').forEach((n) => { n.classList.remove('is-picked'); n.setAttribute('aria-checked', 'false'); });
      card.classList.add('is-picked');
      card.setAttribute('aria-checked', 'true');
      pick = c;
      sound.tick('pick');
    };

    const cards = await Promise.all(persona.characters.map(async (c) => {
      const im = (await loadImg(c.thumb)) || (await loadImg(c.src));
      if (!im) return null;
      const card = h('button.cast__card', { type: 'button', role: 'radio', 'aria-checked': 'false', onclick: () => { photo = null; select(card, { ...c, src: c.src || im.src }); } },
        h('span.cast__portrait', h('img', { src: im.src, alt: '', width: 128, height: 128 })),
        h('span.cast__label', c.label),
        c.blurb && h('span.cast__blurb', c.blurb));
      if (pick && pick.id === c.id) { card.classList.add('is-picked'); card.setAttribute('aria-checked', 'true'); }
      return card;
    }));
    cards.filter(Boolean).forEach((c) => grid.append(c));
    grid.append(photoCard, fileIn);
    photoCard.addEventListener('click', () => fileIn.click());
    fileIn.addEventListener('change', async () => {
      const f = fileIn.files?.[0];
      if (!f) return;
      photoCard.classList.add('is-busy');
      photo = await stylisePhoto(f);
      photoCard.classList.remove('is-busy');
      if (!photo) return;
      photoCard.querySelector('.cast__portrait').replaceChildren(h('img', { src: photo, alt: 'Your photo, pixelated', width: 128, height: 128 }));
      select(photoCard, { id: 'photo', label: 'You', src: photo });
    });

    const form = h('form.cast__form', { onsubmit: (e) => { e.preventDefault(); done(); } },
      h('label.cast__field', { for: 'cast-name' }, h('span', `What should ${hostName || 'the host'} call you?`), nameIn),
      go);
    const skip = h('button.cast__skip', { type: 'button', onclick: () => done(true) }, 'Just listen');

    const el = h('div.cast', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'cast-title' },
      h('div.cast__inner',
        h('p.cast__kicker', 'Live studio audience'),
        h('h2.cast__title#cast-title', 'Grab a seat in the audience.'),
        h('p.cast__lede', 'Pick who you are in the crowd. You steer the show from your seat: tap a card, or just say where to go next.'),
        grid,
        form,
        skip));
    host.append(el);
    requestAnimationFrame(() => el.classList.add('is-open'));
    setTimeout(() => (grid.querySelector('.is-picked') || grid.querySelector('.cast__card'))?.focus({ preventScroll: true }), 300);

    function done(skipped = false) {
      const name = nameIn.value.trim().slice(0, 24);
      const v = { name: skipped ? (prev.name || '') : name, character: skipped ? null : pick, photo: skipped ? null : photo };
      if (!v.character && !skipped) v.character = persona.characters[0] ? { ...persona.characters[0] } : null;
      store.set(KEY, JSON.stringify({ name: v.name, character: v.character && v.character.id !== 'photo' ? v.character.id : null }));
      el.classList.remove('is-open');
      el.classList.add('is-closing');
      sound.tick('open');
      setTimeout(() => el.remove(), 380);
      resolve(v);
    }
  });
}
