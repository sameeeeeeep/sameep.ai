// Wispr Wish, in the browser. Conversions really run here (canvas encodes, a tiny PDF writer), on the
// selected sample or a file you choose; nothing is uploaded. Mini apps are the real mod's built-in apps
// (apps/timer.html, split.html, qr.html), opened in a small window.
import { present, notify } from './card.js';

const fmt = (b) => (b >= 1e6 ? (b / 1e6).toFixed(2) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB');
const NUMW = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, 'forty-five': 45, fifty: 50, sixty: 60 };
const num = (s) => (s == null ? NaN : Number(String(s).replace(/,/g, '')) || NUMW[String(s).toLowerCase()] || NaN);

// ---------------------------------------------------------------- mini apps
let BASE = null, QRLIB = null;
async function appHTML(name, params) {
  BASE ??= await fetch(new URL('../apps/_base.css', import.meta.url)).then((r) => r.text());
  let h = await fetch(new URL(`../apps/${name}.html`, import.meta.url)).then((r) => r.text());
  if (name === 'qr') { QRLIB ??= await fetch(new URL('../vendor/qrcode-generator.js', import.meta.url)).then((r) => r.text()); h = h.replace('/*QRLIB*/', () => QRLIB); }
  // the in-page window is light like the rest of the demo; the apps' own fonts come from the parent's Google Fonts link
  return h.replace('/*BASE*/', () => BASE.replace(/@media \(prefers-color-scheme:dark\)\{[^}]*\{[^}]*\}\}/, '') + 'body{background:#f5f4f0}')
    .replace(/\/\*PARAMS\*\/\{[^}]*\}/, () => JSON.stringify(params))
    .replace('try{Notification.requestPermission()}catch(e){}', '').replace(/try\{new Notification\([^)]*\)\}catch\(e\)\{\}/, '')
    .replace('<head>', '<head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap">');
}

export function timerParams(t) {
  if (/\bpomodoro\b/.test(t)) return { minutes: 25, label: 'Pomodoro' };
  let m = t.match(/\b(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty|forty|forty-five|fifty|sixty|half an?)\s*(h|hr|hrs|hours?|m|min|mins|minutes?|s|sec|secs|seconds?)\b/);
  if (!m) return null;
  let n = /^half/.test(m[1]) ? 0.5 : num(m[1]);
  const u = m[2][0];
  const s = Math.round(n * (u === 'h' ? 3600 : u === 's' ? 1 : 60));
  const what = t.match(/\bfor (?:my |the )?([a-z]+)(?: \d|$|\s)/);
  const label = what && !/^(a|an|\d|one|two|three|four|five|ten|twenty|thirty)$/.test(what[1]) && !/min|hour|sec/.test(what[1]) ? what[1][0].toUpperCase() + what[1].slice(1) : '';
  return s > 0 ? { minutes: s / 60, label } : null;
}
export function splitParams(t) {
  const cur = /₹|rupee|\brs\b|\binr\b/.test(t) ? '₹' : /\$|dollar|bucks/.test(t) ? '$' : /€|euro/.test(t) ? '€' : /£|pound/.test(t) ? '£' : '';
  const am = t.match(/(?:₹|\$|€|£|rs\.?\s?)?\s?(\d[\d,]*(?:\.\d+)?)\s?(k\b)?(?!\s*(?:%|ways|people|persons|of us|friends))/);
  let amount = am ? num(am[1]) * (am[2] ? 1000 : 1) : 0;
  const pp = t.match(/\b(\d+|two|three|four|five|six|seven|eight|nine|ten)\s*(ways|people|persons|of us|friends)\b/) || t.match(/\b(?:between|among|with|by)\s+(\d+|two|three|four|five|six|seven|eight|nine|ten)\b/);
  const tip = t.match(/(\d+)\s*%/);
  return { amount, people: pp ? num(pp[1]) : 2, tip: tip ? Number(tip[1]) : 0, currency: cur };
}
export function qrParams(t, raw) {
  const m = raw.match(/\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)/i);
  return { text: m ? (/^https?:/i.test(m[1]) ? m[1] : 'https://' + m[1].replace(/[.,]$/, '')) : location.origin + '/wispr-builders/' };
}

async function openApp(name, params, ui, title) {
  const html = await appHTML(name, params);
  ui.miniWindow({ title, html, h: { timer: 300, split: 430, qr: 520 }[name] });
}

export async function runApp(app, raw, ui) {
  const t = ' ' + raw.toLowerCase().replace(/[’]/g, "'") + ' ';
  ui.route({ intent: 'ask', args: { question: raw }, mod: 'Wispr Wish', note: `built-in app: ${app}` });
  if (app === 'timer') {
    let p = timerParams(t);
    if (!p) {
      const r = await present({ mod: 'Wispr Wish', title: 'How long?', subtitle: 'Click one, or type a time like “7 minutes”', options: [{ label: '5 minutes' }, { label: '10 minutes' }, { label: '25 minutes', detail: 'Pomodoro' }, { label: '45 minutes' }], recommended: 3 });
      ui.result(r);
      if (r.cancelled) return;
      p = r.pick ? timerParams(' ' + r.label.toLowerCase() + ' ') : timerParams(' ' + String(r.text).toLowerCase() + ' ');
      if (!p) return notify('That didn’t sound like a time. Try “a timer for 7 minutes”.', { title: 'Wispr Wish' });
    }
    const mm = Math.round(p.minutes);
    return openApp('timer', p, ui, p.label ? `${p.label} · ${mm} min` : `Timer · ${p.minutes < 1 ? Math.round(p.minutes * 60) + ' s' : mm + ' min'}`);
  }
  if (app === 'split') {
    const p = splitParams(t);
    return openApp('split', p, ui, 'Split the bill');
  }
  if (app === 'qr') return openApp('qr', qrParams(t, raw), ui, 'QR code');
}

// anything else ("a dice roller"): the real mod has Claude write a one-file app. The demo says so and offers its three.
export async function runWishOther(raw, ui) {
  ui.route({ intent: 'wish.run', args: { wish: raw }, mod: 'Wispr Wish' });
  const r = await present({
    mod: 'Wispr Wish', title: 'On your Mac, Claude would build this one',
    subtitle: 'The real Wish has Claude write a small app for it and keeps it for next time. In the browser, try a built-in one:',
    options: [{ label: 'A 25 min timer' }, { label: 'Split ₹2,400 four ways' }, { label: 'A QR for sameep.ai' }],
  });
  ui.result(r);
  if (r.pick) return runApp(['timer', 'split', 'qr'][r.pick - 1], r.label, ui);
}

// ---------------------------------------------------------------- conversions
async function decode(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.decoding = 'async'; img.src = url; await img.decode();
    return img;
  } finally { setTimeout(() => URL.revokeObjectURL(url), 2000); }
}
const toBlob = (c, type, q) => new Promise((res) => c.toBlob(res, type, q));
function draw(img, w, h, bg) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); if (bg) { x.fillStyle = bg; x.fillRect(0, 0, w, h); }
  x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, w, h); return c;
}
// one JPEG page in a PDF: the smallest valid PDF a JPEG can go into (DCTDecode, no re-encode of the page)
async function jpegToPDF(jpegBlob, w, h) {
  const jpg = new Uint8Array(await jpegBlob.arrayBuffer());
  const W = Math.round(w * 0.75), H = Math.round(h * 0.75); // px at 96 dpi to points
  const enc = new TextEncoder(); const parts = []; const offs = []; let len = 0;
  const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n, body) => { offs[n] = len; push(`${n} 0 obj\n`); body(); push('\nendobj\n'); };
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
  obj(3, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
  obj(4, () => { push(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`); push(jpg); push('\nendstream'); });
  const cs = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
  obj(5, () => push(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`));
  const xref = len;
  push(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map((n) => String(offs[n]).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts, { type: 'application/pdf' });
}

export function convertPlan(raw) {
  const t = ' ' + raw.toLowerCase() + ' ';
  if (/\b(video|mp4|mov|movie|clip|gif|audio|mp3|transcribe|subtitles?)\b/.test(t)) return { op: 'mac', why: /transcri|subtitle/.test(t) ? 'transcripts run whisper on your Mac' : 'video and audio go through ffmpeg on your Mac' };
  if (/\b(word doc|docx|as text|\.txt)\b/.test(t)) return { op: 'mac', why: 'documents go through textutil on your Mac' };
  if (/\bdelete\b/.test(t)) return { op: 'delete' };
  const px = t.match(/\b(\d{2,5})\s?(px|pixels?)\b/);
  if (/\bwebp\b/.test(t)) return { op: 'webp', px: px && +px[1] };
  if (/\bpdf\b/.test(t)) return { op: 'pdf' };
  if (/\bpng\b/.test(t)) return { op: 'png', px: px && +px[1] };
  if (/\bjpe?g\b/.test(t)) return { op: 'jpeg', px: px && +px[1] };
  if (/\bhalf\b/.test(t)) return { op: 'resize', scale: 0.5 };
  if (px) return { op: 'resize', px: +px[1] };
  if (/\b(whatsapp|smaller|compress|shrink|lighter|email|under)\b/.test(t)) return { op: 'small' };
  return { op: 'unknown' };
}

export async function runConvert(raw, ui) {
  const p = convertPlan(raw);
  const sel = ui.selection();
  ui.route({ intent: 'convert', args: { input: sel ? sel.name : null, to: p.op, ...(p.px ? { options: { width: p.px } } : {}) }, mod: 'Wispr Wish' });
  if (p.op === 'mac') return notify(`That one needs your Mac: ${p.why}. In the browser, try “make this a WebP” or “make it smaller for WhatsApp”.`, { title: 'Wispr Wish', ttl: 6 });
  if (p.op === 'delete') {
    const r = await present({ mod: 'Wispr Wish', title: 'Delete the original?', subtitle: 'On your Mac it goes to the Trash, so you can undo it. Nothing is deleted in this demo.', options: [{ label: 'Keep it' }, { label: 'Move it to the Trash' }] });
    ui.result(r); return;
  }
  if (p.op === 'unknown') return notify('Try “make this a WebP”, “make it smaller for WhatsApp”, “half size”, or “make this a PDF”.', { title: 'Wispr Wish', ttl: 5 });
  if (!sel) return notify('Pick an image first: one of the samples, or choose your own.', { title: 'Wispr Wish' });

  ui.busy(true);
  try {
    const img = await decode(sel.blob);
    const W = img.naturalWidth, H = img.naturalHeight;
    let w = W, h = H;
    const fit = (max) => { const k = Math.min(1, max / Math.max(W, H)); w = Math.round(W * k); h = Math.round(H * k); };
    if (p.px) { const k = Math.min(1, p.px / W); w = Math.round(W * k); h = Math.round(H * k); }
    if (p.scale) { w = Math.round(W * p.scale); h = Math.round(H * p.scale); }
    if (p.op === 'small') fit(1600);
    const base = sel.name.replace(/\.[^.]+$/, '');
    let blob, name, note = '';
    const srcType = sel.blob.type;
    if (p.op === 'webp') {
      blob = await toBlob(draw(img, w, h), 'image/webp', 0.82);
      if (!blob || blob.type !== 'image/webp') { blob = await toBlob(draw(img, w, h, '#fff'), 'image/jpeg', 0.82); note = 'This browser can’t write WebP, so this is a JPEG. On your Mac, Wish uses cwebp.'; name = base + '.jpg'; }
      else name = base + '.webp';
    } else if (p.op === 'png') { blob = await toBlob(draw(img, w, h), 'image/png'); name = base + (w !== W ? `-${w}px` : '') + '.png'; }
    else if (p.op === 'jpeg') { blob = await toBlob(draw(img, w, h, '#fff'), 'image/jpeg', 0.86); name = base + '.jpg'; }
    else if (p.op === 'pdf') { const j = await toBlob(draw(img, W, H, '#fff'), 'image/jpeg', 0.9); blob = await jpegToPDF(j, W, H); name = base + '.pdf'; }
    else if (p.op === 'small') {
      // WhatsApp-ready: 1600 px on the long side, JPEG, and never bigger than the original
      let q = 0.78; blob = await toBlob(draw(img, w, h, '#fff'), 'image/jpeg', q);
      while (blob.size > 500_000 && q > 0.45) { q -= 0.1; blob = await toBlob(draw(img, w, h, '#fff'), 'image/jpeg', q); }
      name = base + '-whatsapp.jpg';
      if (blob.size >= sel.blob.size) { blob = sel.blob; name = sel.name; note = 'It was already small enough, so Wish kept the original.'; }
    } else if (p.op === 'resize') {
      const type = /png/.test(srcType) ? 'image/png' : /webp/.test(srcType) ? 'image/webp' : 'image/jpeg';
      blob = await toBlob(draw(img, w, h, type === 'image/jpeg' ? '#fff' : null), type, 0.86);
      name = `${base}-${w}px.${type.split('/')[1].replace('jpeg', 'jpg')}`;
    }
    ui.converted({ from: sel, blob, name, w: p.op === 'pdf' ? W : w, h: p.op === 'pdf' ? H : h, W, H, note });
    notify(`Saved ${name} next to the original. ${fmt(sel.blob.size)} → ${fmt(blob.size)}.`, { title: 'Wispr Wish', ttl: 4 });
  } catch (e) {
    notify('That file can’t be read as an image in this browser. Try one of the samples.', { title: 'Wispr Wish' });
  } finally { ui.busy(false); }
}
export { fmt };
