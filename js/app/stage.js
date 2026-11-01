// stage.js — the studio as a small film set. One 1672×941 canvas, drawn in
// layers exactly as img/manifest.json describes: bg → visitor → host + guest
// sprites at their boxes → desk foreground (hides every waist). A virtual
// camera crops that canvas for medium shots (manifest.studio.medium boxes);
// close-ups swap to full-frame cu-* frames; inserts use the hands-and-CD plate
// with a live HTML item card. Hard cuts only.
import { h, safeUrl, wait } from './util.js';

const loadOK = (src) => new Promise((r) => { if (!src) return r(null); const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });

let manifestP = null;
export function loadManifest(base) {
  manifestP ||= fetch(safeUrl('img/manifest.json', base), { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  return manifestP;
}
// the manifest the Studio already asked for (puppets read their frame lists from it)
export const manifestReady = () => manifestP || Promise.resolve({});

// Who looks where on a line. Speakers look at each other by default; a line
// that addresses the visitor carries "look": "front" in episode.json (the
// intro, menus, "shall I open that for you", sign-offs). The listener always
// looks across at the speaker. Close-ups are always front.
export function decideLook(seat, line) {
  return line && typeof line === 'object' && line.look === 'front' ? 'front' : 'side';
}

const box = (b) => (Array.isArray(b) && b.length === 4 ? { left: b[0], top: b[1], w: b[2], h: b[3] } : null);
const pct = (r) => ({ left: r.left * 100 + '%', top: r.top * 100 + '%', width: r.w * 100 + '%', height: r.h * 100 + '%' });

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
    this.bg = h('img.set__bg', { alt: 'A late-night podcast studio: the host and Sameep at a desk with mics, an iMac between them', draggable: 'false' });
    this.fg = h('img.set__fg', { alt: '', draggable: 'false', hidden: true });
    this.spot = h('div.stage__spot', { 'aria-hidden': 'true' });
    this.seats = { host: h('div.seat.seat--host'), guest: h('div.seat.seat--guest') };
    this.youSeat = h('div.seat-you', { hidden: true }, h('div.seat-you__img'));
    this.youBubble = h('div.you-bubble', { 'aria-hidden': 'true' });
    this.think = h('div.think', { 'aria-hidden': 'true' }, h('i'), h('i'), h('i'));
    // z-order per manifest: bg → visitor → sprites → desk
    this.set.append(this.bg, this.spot, this.youSeat, this.seats.host, this.seats.guest, this.fg, this.youBubble, this.think);
    // close-up layers (full frame), one per speaker
    this.cu = { host: h('div.cu', { hidden: true, dataset: { look: 'front' } }), guest: h('div.cu', { hidden: true, dataset: { look: 'front' } }) };
    this.insertEl = h('div.insert', { hidden: true }, h('img', { alt: 'Hands holding a CD' }));
    this.cardEl = h('div.itemcard', { 'aria-live': 'polite' });
    this.cutEl = h('div.cutaway', { hidden: true }, h('img', { alt: '' }));
    this.onAir = h('div.onair', { 'aria-hidden': 'true' }, 'ON AIR');
    this.loadBar = h('div.loadbar', { 'aria-hidden': 'true' }, h('span', 'LOADING'), h('i'));
    this.el.append(this.set, this.cu.host, this.cu.guest, this.insertEl, this.cardEl, this.cutEl, this.onAir, this.loadBar);
    this.rects = {};
    this.medium = {};
    this.hasCU = { host: false, guest: false };
  }

  async init() {
    const P = this.P;
    const M = P.isCustom ? {} : await loadManifest(P.base);
    const st = M.studio || {};
    const abs = (u) => (typeof u === 'string' ? safeUrl(u, P.base) : null);
    const fgSpec = typeof st.deskFg === 'string' ? { src: st.deskFg } : st.deskFg || null;
    const fgSrc = abs(fgSpec?.src);
    const fgOk = fgSrc && (await loadOK(fgSrc));
    // layered bg only makes sense with the desk; otherwise use the flattened wide
    const bgList = (fgOk ? [st.bg] : []).concat(P.studio || [], st.flat, st.src).map(abs).filter(Boolean);
    let bgOk = null;
    for (const s of bgList) { if ((bgOk = await loadOK(s))) { this.bg.src = s; break; } }
    if (!bgOk) this.el.classList.add('stage--nobg');
    this.layered = !!(fgOk && bgOk && this.bg.src === abs(st.bg));

    this.fgSrc = fgSrc;
    if (this.layered) {
      this.fg.src = this.hostSprite ? safeUrl('img/sprites/hosts/desk-fg.webp', P.base) : fgSrc;
      this.fg.hidden = false;
      Object.assign(this.fg.style, pct(box(fgSpec.box) || { left: 0, top: 0, w: 1, h: 1 }));
      this.el.classList.add('stage--layered');
      const seats = st.seats || {};
      const gk = seats[this.guestKey] ? this.guestKey : 'sameep';
      this.rects.host = box(seats[this.hostKey]?.box || seats.host?.box);
      this.rects.guest = box(seats[gk]?.box);
      const v = seats.visitor;
      if (v) {
        const side = v.height * (941 / 1672) * ((st.size?.[1] || 941) / 941) * (1672 / (st.size?.[0] || 1672));
        this.rects.you = { left: v.cx - side / 2, top: v.bottom - v.height, w: side, h: v.height };
      }
      for (const [k, key] of [['host', this.hostKey], ['guest', gk]]) {
        const m = st.medium?.[key];
        if (m?.box) this.medium[k] = box(m.box);
      }
      this.faces = { host: faceOf(M.sprites?.[this.hostKey]), guest: faceOf(M.sprites?.[gk]) };
    } else {
      // flattened fallback: the persona's own placement (sprites feathered)
      const ps = P.stage || {};
      const conv = (o, aspect) => {
        if (!o) return null;
        const w = (o.height / 100) * aspect / (16 / 9);
        const cx = (o.cx ?? 50) / 100;
        return { left: cx - w / 2, top: 1 - (o.bottom ?? 0) / 100 - o.height / 100, w, h: o.height / 100 };
      };
      this.rects = { host: conv(ps.host, 2 / 3), guest: conv(ps.guest, 2 / 3), you: conv(ps.you, 1) };
      this.faces = { host: faceOf(M.sprites?.[this.hostKey]), guest: faceOf(M.sprites?.[this.guestKey]) };
      this.el.classList.add('stage--feather');
    }
    for (const k of ['host', 'guest']) if (this.rects[k]) Object.assign(this.seats[k].style, pct(this.rects[k]));
    if (this.rects.you) Object.assign(this.youSeat.style, pct(this.rects.you));

    const ins = st.insert || {};
    this.insertPlate = abs(ins.plate);
    this.cardBox = box(ins.cardBox);
    if (this.insertPlate && !(await loadOK(this.insertPlate))) this.insertPlate = null;
    if (this.cardBox && this.insertPlate) Object.assign(this.cardEl.style, { left: this.cardBox.left * 100 + '%', top: this.cardBox.top * 100 + '%', bottom: 'auto' });
    this.manifest = M;
    return this;
  }

  // full-frame close-up frames for a speaker. Close-ups always look into the
  // camera, so only the cu-front-* set is loaded when it exists (cu-* otherwise).
  cuFrames(who) {
    // hostSprite: another host picked by the visitor (manifest sprites["host-<id>"])
    const key = who === 'host' ? this.hostSprite || this.hostKey : this.guestKey;
    const sp = this.manifest?.sprites?.[key];
    if (!sp?.dir || !sp.closeup) return null;
    const dir = sp.dir.replace(/\/$/, '');
    const f = (n) => safeUrl(`${dir}/${n}.webp`, this.P.base);
    const names = sp.closeup;
    const pick = names.some((n) => n.startsWith('cu-front-')) ? names.filter((n) => n.startsWith('cu-front-')) : names;
    const front = {};
    for (const n of pick) front[n.replace(/^cu-(front-)?/, '')] = f(n);
    return { ...front, set: { front } };
  }

  // another host in the host seat: the desk layer without the default host's hands on it
  setHostSprite(key) {
    this.hostSprite = key || null;
    if (this.layered) this.fg.src = key ? safeUrl('img/sprites/hosts/desk-fg.webp', this.P.base) : this.fgSrc;
  }

  // Point the seats: the speaker per the line, the listener across at them.
  look(who, line) {
    this.lookSet = true;
    this.#applyLook(who, decideLook(who, line));
  }

  #applyLook(who, look) {
    for (const k of ['host', 'guest']) this.seats[k].dataset.look = who === 'you' ? 'front' : k === who ? look : 'side';
  }

  // Hard cut. shot: wide | ms | cu | insert ; who: host | guest | you
  cut(shot, who) {
    if (this.reduced && shot !== 'insert') shot = 'wide';
    if (shot === 'cu' && !(who in this.hasCU && this.hasCU[who])) shot = 'ms';
    for (const k of ['host', 'guest']) this.cu[k].hidden = !(shot === 'cu' && k === who);
    this.insertEl.hidden = shot !== 'insert' || !this.insertPlate;
    let r = null;
    if (shot === 'ms') {
      r = this.medium[who];
      if (!r && this.rects[who]) {
        const s = this.rects[who];
        const w = Math.min(1, s.w * (who === 'you' ? 1.9 : 1.4));
        r = { left: s.left + s.w / 2 - w / 2, top: s.top + s.h * 0.45 - w / 2 / (16 / 9) , w, h: w };
      }
    }
    if (shot === 'insert' && !this.insertPlate) {
      r = { left: 0.35, top: 0.25, w: 0.4, h: 0.4 };
    }
    if (r) {
      const s = 1 / r.w;
      const x = Math.min(1 - r.w, Math.max(0, r.left));
      const y = Math.min(1 - 1 / s, Math.max(0, r.top));
      this.set.style.transform = `scale(${s}) translate(${-x * 100}%, ${-y * 100}%)`;
    } else this.set.style.transform = '';
    if (!r && shot === 'ms') shot = 'wide';
    this.shot = shot;
    if (shot !== 'insert') this.last = { shot, who };
    this.el.dataset.shot = shot;
  }

  #point(k, fx, fy) { const r = this.rects[k]; return { x: r.left + fx * r.w, y: r.top + fy * r.h }; }

  async thinking(who, ms = 520) {
    const r = this.rects[who];
    if (!r || this.reduced) return;
    const f = this.faces[who] || { fx: 0.5, fy: 0.3 };
    const p = this.#point(who, f.fx, Math.max(0.02, f.fy - 0.17));
    Object.assign(this.think.style, { left: p.x * 100 + '%', top: p.y * 100 + '%' });
    this.think.classList.add('is-on');
    await wait(ms);
    this.think.classList.remove('is-on');
  }

  sayBubble(text) {
    const r = this.rects.you;
    if (!r) return;
    Object.assign(this.youBubble.style, { left: (r.left + r.w * 0.45) * 100 + '%', top: (r.top + r.h * 0.04) * 100 + '%' });
    this.youBubble.textContent = text.length > 42 ? text.slice(0, 40) + '…' : text;
    this.youBubble.classList.add('is-on');
    clearTimeout(this._bt);
    this._bt = setTimeout(() => this.youBubble.classList.remove('is-on'), 1900);
  }

  async loading() {
    if (this.reduced) return;
    this.loadBar.classList.remove('is-on');
    void this.loadBar.offsetWidth;
    this.loadBar.classList.add('is-on');
    await wait(260);
    this.loadBar.classList.remove('is-on');
  }

  // insert shot (hands holding the disc) + a live item card
  async itemCard({ title, rows = [] }, ms = 1800) {
    if (this.insertPlate) this.insertEl.querySelector('img').src = this.insertPlate;
    this.cut('insert');
    this.cardEl.classList.toggle('itemcard--plate', !!this.insertPlate);
    this.cardEl.replaceChildren(
      h('p.itemcard__title', title.toUpperCase(), h('span', { 'aria-hidden': 'true' }, ' ▾')),
      h('dl.itemcard__rows', rows.filter((r) => r && r[1]).map(([k, v]) => h('div', h('dt', k + ':'), h('dd', v)))));
    this.cardEl.classList.add('is-on');
    await wait(this.reduced ? 700 : ms);
    this.cardEl.classList.remove('is-on');
    if (this.shot === 'insert') this.cut(this.last?.shot || 'wide', this.last?.who);
  }

  async cutaway(src, alt = '') {
    // podcast.js calls this once per line with the line text: use it to aim
    // the speaker unless look(who, line) already did for this line
    if (!this.lookSet && alt && this.who) { this.lookSet = true; this.#applyLook(this.who, decideLook(this.who, alt)); }
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
    this.lookSet = false;
    this.#applyLook(who, decideLook(who, null)); // default until the line text arrives
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
