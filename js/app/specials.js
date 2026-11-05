// specials.js — "Specials": videos played inside the show. The Wispr for Builders launch, the sameep.ai launch,
// one demo per Pack 1 mod (episode.json "specials"). Each lives at video/specials/<slug>.mp4, with <slug>.jpg as
// its poster and <slug>.vtt as captions. Files land one at a time, so every special is probed first: one that
// isn't up yet reads "Coming soon" and the player never opens on a missing video.
import { h, safeUrl } from './util.js';
import { sound } from './audio.js';
import { shows } from '../version.js';
import { track } from '../analytics.js';

const DIR = 'video/specials/';
const cache = new Map();
// a media file is up when it answers ok and isn't an HTML error page; a page only has to answer ok
const head = (u, page = false) => fetch(u, { method: 'HEAD', cache: 'no-cache' }).then((r) => r.ok && (page || !/text\/html/.test(r.headers.get('content-type') || '')), () => false);
const fmt = (s) => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

export const specialsFor = (ep) => (ep.specials || []).filter(shows);
export const specialUrls = (sp, base) => ({
  video: safeUrl(DIR + sp.slug + '.mp4', base), poster: safeUrl(DIR + sp.slug + '.jpg', base), vtt: safeUrl(DIR + sp.slug + '.vtt', base),
  page: sp.url ? safeUrl(sp.url, base) : null,
});

// { ok, poster, vtt, page, sec } once the files are checked (cached for the visit)
export function specialInfo(sp, base) {
  if (!cache.has(sp.slug)) {
    const u = specialUrls(sp, base);
    // the poster and captions are only looked for once the video itself is up
    cache.set(sp.slug, head(u.video).then((ok) => Promise.all([ok, ok && head(u.poster), ok && head(u.vtt), u.page ? head(u.page, true) : false])).then(([ok, poster, vtt, page]) => {
      const info = { ok, poster: poster ? u.poster : null, vtt: vtt ? u.vtt : null, page: page ? u.page : null, video: u.video, sec: sp.sec || null };
      if (!ok || info.sec) return info;
      // the length, from the file's own metadata
      return new Promise((res) => {
        const v = document.createElement('video');
        v.preload = 'metadata'; v.muted = true;
        const done = () => { info.sec = isFinite(v.duration) ? v.duration : null; v.removeAttribute('src'); v.load(); res(info); };
        v.addEventListener('loadedmetadata', done, { once: true });
        v.addEventListener('error', () => res(info), { once: true });
        setTimeout(() => res(info), 6000);
        v.src = u.video;
      });
    }));
  }
  return cache.get(sp.slug);
}
export const specialLen = (info) => (info?.sec ? fmt(info.sec) : '');

// the full-size player over the studio: poster while it loads, captions on, play/pause, scrub, CC, skip.
// Resolves when it ends, is skipped, or fails (a failure says so for a beat, then hands back to the show).
export function playSpecial(host, sp, info, { reduced } = {}) {
  return new Promise((resolve) => {
    const vid = h('video.spx__vid', { playsInline: true, preload: 'auto', poster: info.poster || null, crossOrigin: 'anonymous', 'aria-label': sp.title });
    vid.muted = !sound.on;
    if (info.vtt) vid.append(h('track', { kind: 'captions', srclang: 'en', label: 'English', src: info.vtt, default: true }));
    vid.src = info.video;
    const load = h('div.spx__load', { role: 'status' }, h('i.spx__spin', { 'aria-hidden': 'true' }), h('span', 'Loading the video…'));
    const ico = h('span.spx__ico.is-pause', { 'aria-hidden': 'true' });
    const playBtn = h('button.spx__btn.spx__play', { type: 'button', 'aria-label': 'Pause', onclick: () => toggle() }, ico);
    const fill = h('i.spx__fill'), knob = h('i.spx__knob');
    const bar = h('div.spx__bar', { role: 'slider', tabindex: '0', 'aria-label': 'Seek', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, h('span.spx__track', fill), knob);
    const time = h('span.spx__time', '0:00');
    const cc = info.vtt ? h('button.spx__btn.spx__cc.is-on', { type: 'button', 'aria-pressed': 'true', 'aria-label': 'Captions', title: 'Captions', onclick: () => setCC(!cc.classList.contains('is-on')) }, 'CC') : null;
    const sndBtn = h('button.spx__btn.spx__snd', { type: 'button', 'aria-label': vid.muted ? 'Turn sound on' : 'Mute', title: 'Sound', onclick: () => { vid.muted = !vid.muted; paintSnd(); } });
    const skip = h('button.spx__skip', { type: 'button', onclick: () => close('skip') }, 'Back to the show', h('span', { 'aria-hidden': 'true' }, ' ›'));
    const el = h('div.spx', { role: 'dialog', 'aria-modal': 'false', 'aria-label': sp.title, tabindex: '-1' },
      h('div.spx__head', h('span.spx__k', 'Special'), h('span.spx__t', sp.title), skip),
      h('div.spx__screen', vid, load),
      h('div.spx__ctl', playBtn, bar, time, cc, sndBtn));
    let done = false, maxP = 0;
    const paintSnd = () => { sndBtn.textContent = vid.muted ? '🔇' : '🔊'; sndBtn.setAttribute('aria-label', vid.muted ? 'Turn sound on' : 'Mute'); };
    const paint = () => {
      const d = vid.duration || 0, f = d ? vid.currentTime / d : 0;
      fill.style.transform = `scaleX(${f})`; knob.style.left = f * 100 + '%';
      bar.setAttribute('aria-valuenow', String(Math.round(f * 100)));
      time.textContent = `${fmt(vid.currentTime)} / ${fmt(d)}`;
      const p = Math.floor(f * 4) * 25;
      if (p > maxP && p < 100) { maxP = p; track('video', { name: 'special-' + sp.slug, at: 'progress', p }); }
    };
    const setIcon = () => { const on = !vid.paused; ico.className = 'spx__ico ' + (on ? 'is-pause' : 'is-play'); playBtn.setAttribute('aria-label', on ? 'Pause' : 'Play'); };
    const setCC = (on) => { cc?.classList.toggle('is-on', on); cc?.setAttribute('aria-pressed', String(on)); for (const t of vid.textTracks) t.mode = on ? 'showing' : 'hidden'; };
    const toggle = () => (vid.paused ? vid.play().catch(() => {}) : vid.pause());
    const close = (why) => {
      if (done) return;
      done = true;
      vid.pause();
      track('video', { name: 'special-' + sp.slug, at: why === 'ended' ? 'ended' : 'progress', p: Math.round((vid.currentTime / (vid.duration || 1)) * 100), s: Math.round(vid.currentTime) });
      el.classList.add('is-out');
      setTimeout(() => { el.remove(); vid.removeAttribute('src'); vid.load(); }, reduced ? 0 : 220);
      window.removeEventListener('keydown', onKey, true);
      resolve(why);
    };
    const onKey = (e) => {
      if (!el.isConnected || e.target.closest?.('input, textarea')) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close('skip'); }
      else if (e.key === ' ') { e.preventDefault(); e.stopImmediatePropagation(); toggle(); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); vid.currentTime = Math.max(0, vid.currentTime + (e.key === 'ArrowRight' ? 5 : -5)); }
    };
    window.addEventListener('keydown', onKey, true);
    const seekAt = (e) => { const r = bar.getBoundingClientRect(); if (vid.duration) vid.currentTime = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * vid.duration; };
    let drag = false;
    bar.addEventListener('pointerdown', (e) => { drag = true; bar.setPointerCapture(e.pointerId); seekAt(e); });
    bar.addEventListener('pointermove', (e) => { if (drag) seekAt(e); });
    bar.addEventListener('pointerup', () => { drag = false; });
    vid.addEventListener('click', toggle);
    vid.addEventListener('waiting', () => { load.hidden = false; });
    vid.addEventListener('canplay', () => { load.hidden = true; }, { once: false });
    vid.addEventListener('playing', () => { load.hidden = true; });
    vid.addEventListener('timeupdate', paint);
    vid.addEventListener('play', setIcon); vid.addEventListener('pause', setIcon);
    vid.addEventListener('ended', () => close('ended'));
    vid.addEventListener('loadedmetadata', () => { paint(); if (info.vtt) setCC(true); });
    vid.addEventListener('error', () => {
      load.hidden = false;
      load.replaceChildren(h('span', 'This one didn’t load. Back to the show…'));
      setTimeout(() => close('error'), 1800);
    });
    paintSnd();
    host.append(el);
    el.focus({ preventScroll: true });
    track('video', { name: 'special-' + sp.slug, at: 'play' });
    vid.play().catch(() => setIcon()); // autoplay can be refused: the poster and a Play button wait
  });
}
