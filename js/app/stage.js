// stage.js — the studio as a small film set: layered compositing
// (bg → seated sprites → foreground desk → visitor stool), a virtual camera
// with shot grammar (wide / medium / close-up / insert, hard cuts), "…"
// thinking bubbles, game-UI item cards and a one-beat LOADING bar.
import { h, safeUrl, wait } from './util.js';

const STAGE_ASPECT = 16 / 9;
const loadOK = (src) => new Promise((r) => { if (!src) return r(null); const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });

let manifestP = null;
export function loadManifest(base) {
  manifestP ||= fetch(safeUrl('img/manifest.json', base), { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  return manifestP;
}

export class Studio {
  constructor({ persona, speakers, hostKey, guestKey, reduced }) {
    this.P = persona;
    this.speakers = speakers;
    this.hostKey = hostKey;
    this.guestKey = guestKey;
    this.reduced = reduced;
    this.shot = 'wide';
    this.el = h('div.stage', { dataset: { shot: 'wide' } });
    this.set = h('div.set');
    this.bg = h('img.set__bg', { alt: 'A late-night podcast studio: two chairs, two mics, an iMac on the table', draggable: 'false' });
    this.fg = h('img.set__fg', { alt: '', draggable: 'false', hidden: true });
    this.spot = h('div.stage__spot', { 'aria-hidden': 'true' });
    this.seats = { host: h('div.seat.seat--host'), guest: h('div.seat.seat--guest') };
    this.youSeat = h('div.seat-you', { hidden: true }, h('div.seat-you__img'));
    this.youBubble = h('div.you-bubble', { 'aria-hidden': 'true' });
    this.think = h('div.think', { 'aria-hidden': 'true' }, h('i'), h('i'), h('i'));
    this.set.append(this.bg, this.spot, this.seats.host, this.seats.guest, this.fg, this.youSeat, this.youBubble, this.think);
    this.onAir = h('div.onair', { 'aria-hidden': 'true' }, 'ON AIR');
    this.cardEl = h('div.itemcard', { 'aria-live': 'polite' });
    this.loadBar = h('div.loadbar', { 'aria-hidden': 'true' }, h('span', 'LOADING'), h('i'));
    this.cutEl = h('div.cutaway', { hidden: true }, h('img', { alt: '' }));
    this.el.append(this.set, this.cutEl, this.onAir, this.cardEl, this.loadBar);
    this.rects = {};
  }

  async init() {
    const P = this.P;
    const M = P.isCustom ? {} : await loadManifest(P.base);
    const st = M.studio || {};
    const L = st.layers || {};
    const bgSrc = [L.bg, st.bg, ...(P.studio || []), st.src].map((u) => u && safeUrl(u, P.base)).filter(Boolean);
    let bgOk = null;
    for (const s of bgSrc) { if ((bgOk = await loadOK(s))) { this.bg.src = s; break; } }
    if (!bgOk) this.el.classList.add('stage--nobg');
    const fgSrc = [L.fg, L.deskFg, st.fg, st.deskFg, P.studioFg].map((u) => u && safeUrl(u, P.base)).find(Boolean);
    const fgOk = fgSrc && (await loadOK(fgSrc));
    if (fgOk) { this.fg.src = fgSrc; this.fg.hidden = false; this.el.classList.add('stage--layered'); }

    // seat anchors: manifest when the layered set exists, else the persona's tuned placement
    const ms = st.seats || {};
    const ps = P.stage || {};
    const fromPersona = (o, aspect) => o && ({ cx: (o.cx ?? ((o.left ?? 0) + (o.height * aspect * 9 / 16) / 2)) / 100, bottom: 1 - (o.bottom ?? 0) / 100, height: o.height / 100, aspect });
    const spriteAspect = (key) => { const s = M.sprites?.[key]?.size; return s ? s[0] / s[1] : 2 / 3; };
    const pick = (mKey, pKey, aspect) => (fgOk && ms[mKey] ? { ...ms[mKey], aspect } : fromPersona(ps[pKey], aspect) || (ms[mKey] && { ...ms[mKey], aspect }));
    this.anchor = {
      host: pick('host', 'host', spriteAspect(this.hostKey)) || { cx: 0.18, bottom: 0.85, height: 0.64, aspect: 2 / 3 },
      guest: pick(this.guestKey === 'sameep' ? 'sameep' : 'guest', 'guest', spriteAspect(this.guestKey)) || pick('sameep', 'guest', spriteAspect('sameep')) || { cx: 0.82, bottom: 0.85, height: 0.6, aspect: 2 / 3 },
      you: pick('visitor', 'you', 1) || { cx: 0.5, bottom: 1, height: 0.36, aspect: 1 },
    };
    this.faces = {
      host: faceOf(M.sprites?.[this.hostKey]),
      guest: faceOf(M.sprites?.[this.guestKey]),
      you: { fx: 0.5, fy: 0.3 },
    };
    this.insertAt = st.insert || st.imac || { cx: 0.6, cy: 0.5 };
    for (const k of ['host', 'guest', 'you']) this.#place(k);
    if (!fgOk) this.el.classList.add('stage--feather'); // hide hard waist cuts until the desk layer lands
  }

  #place(k) {
    const a = this.anchor[k];
    const w = a.height * a.aspect / STAGE_ASPECT;
    const r = { left: a.cx - w / 2, top: a.bottom - a.height, w, h: a.height };
    this.rects[k] = r;
    const el = k === 'you' ? this.youSeat : this.seats[k];
    Object.assign(el.style, { left: r.left * 100 + '%', top: r.top * 100 + '%', width: r.w * 100 + '%', height: r.h * 100 + '%' });
  }

  #point(k, fx, fy) { const r = this.rects[k]; return { x: r.left + fx * r.w, y: r.top + fy * r.h }; }

  // Hard cut to a framing. who: host | guest | you
  cut(shot, who) {
    if (this.reduced) shot = 'wide';
    let s = 1, c = { x: 0.5, y: 0.5 };
    if (shot === 'ms' && this.rects[who]) { s = who === 'you' ? 1.7 : 1.85; const r = this.rects[who]; c = { x: r.left + r.w / 2, y: r.top + r.h * 0.42 }; }
    else if (shot === 'cu' && this.rects[who]) { s = who === 'you' ? 2.4 : 3.1; const f = this.faces[who] || { fx: 0.5, fy: 0.3 }; c = this.#point(who, f.fx, f.fy + 0.04); }
    else if (shot === 'insert') { s = 2.6; c = { x: this.insertAt.cx, y: this.insertAt.cy }; }
    else shot = 'wide';
    // keep the frame inside the set
    const half = 0.5 / s;
    c.x = Math.min(1 - half, Math.max(half, c.x));
    c.y = Math.min(1 - half, Math.max(half, c.y));
    this.set.style.transform = s === 1 ? '' : `scale(${s}) translate(${-(c.x - half) * 100}%, ${-(c.y - half) * 100}%)`;
    this.shot = shot;
    if (shot !== 'insert') this.last = { shot, who };
    this.el.dataset.shot = shot;
  }

  async thinking(who, ms = 520) {
    const r = this.rects[who];
    if (!r || this.reduced) return;
    const f = this.faces[who] || { fx: 0.5, fy: 0.3 };
    const p = this.#point(who, f.fx, Math.max(0, f.fy - 0.2));
    Object.assign(this.think.style, { left: p.x * 100 + '%', top: p.y * 100 + '%' });
    this.think.classList.add('is-on');
    await wait(ms);
    this.think.classList.remove('is-on');
  }

  sayBubble(text) {
    const r = this.rects.you;
    if (!r) return;
    Object.assign(this.youBubble.style, { left: (r.left + r.w / 2) * 100 + '%', top: (r.top + r.h * 0.05) * 100 + '%' });
    this.youBubble.textContent = text.length > 42 ? text.slice(0, 40) + '…' : text;
    this.youBubble.classList.add('is-on');
    clearTimeout(this._bt);
    this._bt = setTimeout(() => this.youBubble.classList.remove('is-on'), 1900);
  }

  // one beat of game-UI "LOADING" between segments
  async loading() {
    if (this.reduced) return;
    this.loadBar.classList.remove('is-on');
    void this.loadBar.offsetWidth;
    this.loadBar.classList.add('is-on');
    await wait(260);
    this.loadBar.classList.remove('is-on');
  }

  // insert shot + item card ("SWITCHBOARD ▾ type: Mac app · status: live")
  async itemCard({ title, rows = [] }, ms = 1700) {
    this.cut('insert');
    this.cardEl.replaceChildren(
      h('p.itemcard__title', title.toUpperCase(), h('span', { 'aria-hidden': 'true' }, ' ▾')),
      h('dl.itemcard__rows', rows.filter((r) => r && r[1]).map(([k, v]) => h('div', h('dt', k + ':'), h('dd', v)))));
    this.cardEl.classList.add('is-on');
    await wait(this.reduced ? 600 : ms);
    this.cardEl.classList.remove('is-on');
    if (this.shot === 'insert') this.cut(this.last?.shot || 'wide', this.last?.who);
  }

  // illustrated vignette for a line (hard cut in, hard cut back); 404 → skip silently
  async cutaway(src, alt = '') {
    const tok = (this.cutTok = (this.cutTok || 0) + 1);
    if (!src) { this.cutEl.hidden = true; return; }
    const ok = await loadOK(src);
    if (!ok || tok !== this.cutTok) return;
    const img = this.cutEl.querySelector('img');
    img.src = src; img.alt = alt;
    this.cutEl.hidden = false;
  }

  setSpeaker(who) {
    this.who = who;
    this.el.dataset.speaker = who;
    const r = this.rects[who];
    if (r) this.spot.style.setProperty('--sx', (r.left + r.w / 2) * 100 + '%');
  }
}

function faceOf(sp) {
  if (!sp?.eyes) return { fx: 0.5, fy: 0.32 };
  const [ex, ey, ew] = sp.eyes;
  const m = sp.mouth || [ex, ey + 0.1, ew, 0.08];
  return { fx: ex + ew / 2, fy: (ey + m[1] + m[3]) / 2 };
}
