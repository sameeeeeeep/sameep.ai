// The sample "Mac" for the Wispr File demo: ~60 made-up files with drawn thumbnails (SVG, no image downloads).
// Dates are relative to today so "yesterday" and "from October" keep working whenever the page is opened.
const DAY = 86_400_000;
const now = new Date();
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');
const ago = (d, h = 11, m = 20) => { const x = new Date(+now - d * DAY); x.setHours(h, m, (d * 7) % 60, 0); return x; };
// a day in the month `k` months back (k=1: last month), so "the invoice from October" has hits in November
const monthAgo = (k, day = 6) => { const x = new Date(now.getFullYear(), now.getMonth() - k, day, 10, 15); return x; };
const shotName = (d) => `Screenshot ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} at ${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}.png`;
const monName = (d) => MON[d.getMonth()];

const F = [];
const add = (name, kind, folder, date, text, thumb) => F.push({ id: F.length + 1, name, kind, folder, date, text, thumb });
const shot = (d, text, v) => add(shotName(d), 'screenshot', 'Desktop', d, text, { t: 'shot', ...v });

// screenshots (the text is what macOS reads out of them)
shot(ago(0, 12, 9), 'admin panel orders sameep.ai analytics visitors today', { app: 'Admin', title: 'Orders', tone: 'light', rows: 6 });
shot(ago(0, 9, 41), 'admin panel mobile visitors sameep.ai', { app: 'Admin', title: 'Visitors · 375px', tone: 'light', phone: true });
shot(ago(3, 18, 2), 'admin panel visitors analytics sources referrers', { app: 'Admin', title: 'Sources', tone: 'light', chart: true });
shot(ago(1, 22, 14), 'wispr flow 134 wpm words streak insights', { app: 'Flow', title: '11.3K words', tone: 'sand', stat: '134 wpm' });
shot(ago(2, 1, 5), 'terminal error npm build failed module not found', { app: 'Terminal', title: 'npm run build', tone: 'dark', term: true });
shot(ago(4, 16, 30), 'slack thread launch plan feedback', { app: 'Slack', title: '#launch', tone: 'slack' });
shot(ago(9, 15, 12), 'figma hero frame mobile design', { app: 'Figma', title: 'Hero / mobile', tone: 'figma' });
shot(ago(12, 6, 50), 'boarding pass indigo blr del flight 6e 2134 seat 14a', { app: 'Wallet', title: 'BLR → DEL', tone: 'pass' });
shot(ago(5, 20, 3), 'upi payment successful 2400 gpay paid to', { app: 'GPay', title: '₹2,400 paid', tone: 'pay' });
shot(ago(15, 13, 8), 'tweet post launch wispr for builders replies', { app: 'X', title: 'Post', tone: 'light', rows: 3 });
shot(ago(7, 9, 0), 'calendar week meetings standup', { app: 'Calendar', title: 'This week', tone: 'cal' });
shot(ago(20, 19, 45), 'flight booking makemytrip goa return fare', { app: 'Safari', title: 'Flights to Goa', tone: 'light', rows: 4 });
shot(ago(13, 11, 2), 'google analytics traffic sessions chart', { app: 'Analytics', title: 'Sessions', tone: 'light', chart: true });
shot(ago(2, 10, 26), 'meme cat keyboard', { app: 'Photos', title: 'meme', tone: 'dark', rows: 0 });

// photos and images
add('passport-photo-2025.jpg', 'image', 'Documents', ago(300), 'passport photo 35x45 white background', { t: 'face', bg: '#eef4fb', shirt: '#2b3a55' });
add('visa-photo-35x45.jpg', 'image', 'Documents', ago(210), 'visa photo passport size 35x45', { t: 'face', bg: '#ffffff', shirt: '#4a4a48' });
add('headshot-final.jpg', 'image', 'Pictures', ago(60), 'headshot portrait linkedin', { t: 'face', bg: '#d9cfc0', shirt: '#1a1a1a', warm: true });
add('IMG_2041.jpg', 'image', 'Pictures', ago(6, 21, 40), 'diwali party friends', { t: 'photo', v: 'party' });
add('IMG_1988.HEIC', 'image', 'Pictures', ago(40), 'beach goa sunset', { t: 'photo', v: 'beach' });
add('IMG_1720.HEIC', 'image', 'Pictures', ago(90), 'mountains trek manali', { t: 'photo', v: 'hills' });
add('IMG_2003.HEIC', 'image', 'Pictures', ago(17), 'dog bruno park', { t: 'photo', v: 'dog' });
add('dinner-receipt.jpg', 'image', 'Downloads', ago(3, 23, 10), 'receipt dinner toit bill', { t: 'receipt', total: '₹3,860' });
add('whiteboard-sketch.jpg', 'image', 'Desktop', ago(8), 'whiteboard sketch funnel growth loop', { t: 'board' });
add('product-shot-nail-kit.png', 'image', 'Downloads', ago(20), 'product shot nail kit nailinit', { t: 'product' });
add('logo-draft-v3.png', 'image', 'Desktop', ago(25), 'logo draft nailinit wordmark', { t: 'logo' });
add('wedding-invite.png', 'image', 'Downloads', ago(33), 'wedding invite card', { t: 'invite' });

// invoices, bills, receipts (PDF)
const inv = (k, vendor, amount, text, gst = true) => { const d = monthAgo(k, 3 + (vendor.length % 20)); add(`Invoice_${vendor.replace(/\s+/g, '')}_${monName(d)}${d.getFullYear()}.pdf`, 'pdf', 'Downloads', d, `invoice ${gst ? 'gst tax invoice ' : ''}${vendor.toLowerCase()} ${text}`, { t: 'invoice', vendor, amount, when: `${d.getDate()} ${monName(d)} ${d.getFullYear()}`, gst }); };
inv(1, 'Figma', '₹4,248', 'professional plan seat');
inv(1, 'Shiprocket', '₹18,880', 'shipping courier');
inv(1, 'Notion', '₹1,416', 'plus plan', false);
inv(1, 'Swiggy', '₹642', 'order food', false);
inv(2, 'Figma', '₹4,248', 'professional plan seat');
inv(2, 'AWS', '$38.20', 'amazon web services', false);
inv(3, 'Shiprocket', '₹12,390', 'shipping courier');
inv(4, 'Figma', '₹4,248', 'professional plan seat');
add(`Rent receipt ${monName(monthAgo(1))}.pdf`, 'pdf', 'Documents', monthAgo(1, 2), 'rent receipt landlord', { t: 'invoice', vendor: 'Rent', amount: '₹42,000', when: monName(monthAgo(1)), gst: false, receipt: true });
add(`BESCOM bill ${monName(monthAgo(1))}.pdf`, 'pdf', 'Downloads', monthAgo(1, 12), 'electricity bill bescom', { t: 'invoice', vendor: 'BESCOM', amount: '₹2,312', when: monName(monthAgo(1)), gst: false, receipt: true });
add('Uber receipt airport.pdf', 'pdf', 'Downloads', ago(12, 8), 'uber receipt trip airport', { t: 'receipt', total: '₹1,104' });

// decks
add('Wispr growth plan.key', 'deck', 'Documents', ago(2, 17), 'wispr growth plan deck sections', { t: 'deck', title: 'Growth plan', em: 'for Wispr', theme: 'lumen' });
add('Pricing deck v4.key', 'deck', 'Documents', ago(10), 'pricing deck per seat annual plans', { t: 'deck', title: 'Pricing', em: 'v4', theme: 'ink' });
add('Q3 review.pptx', 'deck', 'Documents', ago(35), 'q3 review quarterly metrics', { t: 'deck', title: 'Q3 review', em: '', theme: 'fathom' });
add('Nailinit investor deck.pdf', 'deck', 'Downloads', ago(50), 'nailinit investor deck pitch fundraise', { t: 'deck', title: 'Nailinit', em: 'seed', theme: 'pink' });
add('Secret Slumber Party pitch.key', 'deck', 'Documents', ago(70), 'secret slumber party pitch sponsors', { t: 'deck', title: 'Secret Slumber', em: 'Party', theme: 'night' });

// documents
add('CV - Sameep Rehlan.pdf', 'pdf', 'Documents', ago(14), 'cv resume sameep rehlan experience', { t: 'doc', title: 'Sameep Rehlan', lines: 9 });
add('Offer letter.pdf', 'pdf', 'Documents', ago(120), 'offer letter employment', { t: 'doc', title: 'Offer letter', lines: 8 });
add('Rental agreement 2026.pdf', 'pdf', 'Documents', ago(200), 'rental agreement lease house', { t: 'doc', title: 'Rental agreement', lines: 10 });
add('NDA - signed.pdf', 'pdf', 'Documents', ago(45), 'nda signed non disclosure', { t: 'doc', title: 'Mutual NDA', lines: 8, sign: true });
add('Brand guidelines.pdf', 'pdf', 'Downloads', ago(30), 'brand guidelines colours type', { t: 'deck', title: 'Brand', em: 'guidelines', theme: 'sand' });
add('Health insurance policy.pdf', 'pdf', 'Documents', ago(150), 'insurance policy health cover', { t: 'doc', title: 'Policy schedule', lines: 9 });
add('Passport scan.pdf', 'pdf', 'Documents', ago(400), 'passport scan copy id', { t: 'pass' });
add('Notes - podcast ideas.docx', 'doc', 'Documents', ago(4), 'notes podcast ideas off the record guests', { t: 'doc', title: 'Podcast ideas', lines: 7, bullets: true });

// sheets
add('Budget 2026.xlsx', 'sheet', 'Documents', ago(3), 'budget 2026 expenses', { t: 'sheet' });
add('Vendor quotes.numbers', 'sheet', 'Documents', ago(11), 'vendor quotes alibaba moq price', { t: 'sheet' });
add('Launch tracker.csv', 'sheet', 'Desktop', ago(1), 'launch tracker tasks owners', { t: 'sheet' });

// video, audio
add(`Screen Recording ${ago(2).getFullYear()}-${pad(ago(2).getMonth() + 1)}-${pad(ago(2).getDate())} at 11.02.14.mov`, 'video', 'Desktop', ago(2, 11, 2), 'screen recording demo', { t: 'video', dur: '2:41', v: 'screen' });
add('product-demo-final.mp4', 'video', 'Downloads', ago(9), 'product demo final video', { t: 'video', dur: '0:58', v: 'demo' });
add('podcast-ep4-raw.wav', 'audio', 'Documents', ago(6), 'podcast episode 4 raw audio', { t: 'audio' });
add('Voice memo - pricing idea.m4a', 'audio', 'Documents', ago(1, 8), 'voice memo pricing idea', { t: 'audio' });

// folders, archives
add('Tax 2025-26', 'folder', 'Documents', ago(60), 'tax returns itr form 16', { t: 'folder' });
add('Brand assets', 'folder', 'Desktop', ago(30), 'brand assets logos fonts', { t: 'folder' });
add('wispr-for-builders.zip', 'archive', 'Downloads', ago(1, 14), 'wispr for builders pack plugin zip', { t: 'zip' });

export const FILES = F;
export const PATH = (f) => `~/${f.folder}/${f.name}`;

export function whenLabel(d) {
  const t0 = new Date(now); t0.setHours(0, 0, 0, 0);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (d >= t0) return `Today, ${hm}`;
  if (d >= +t0 - DAY) return `Yesterday, ${hm}`;
  if (d.getFullYear() === now.getFullYear()) return `${d.getDate()} ${monName(d)}`;
  return `${d.getDate()} ${monName(d)} ${d.getFullYear()}`;
}

// ---------------------------------------------------------------- thumbnails (SVG strings, 312x224 viewBox)
const FONT = "Figtree, -apple-system, Helvetica, Arial, sans-serif";
const SERIF = "'EB Garamond', Georgia, serif";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const T = (x, y, s, size, fill, w = 500, extra = '') => `<text x="${x}" y="${y}" ${/font-family=/.test(extra) ? '' : `font-family="${FONT}"`} font-size="${size}" font-weight="${w}" fill="${fill}" ${extra}>${esc(s)}</text>`;
const lines = (x, y, n, w, gap = 10, fill = '#d9d6cc', h = 4) => Array.from({ length: n }, (_, i) => `<rect x="${x}" y="${y + i * gap}" width="${w * (0.55 + ((i * 37) % 45) / 100)}" height="${h}" rx="2" fill="${fill}"/>`).join('');
const wrap = (inner, bg = '#fff', W = 312, H = 224) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${inner}</svg>`;
const page = (inner, bg = '#e8e5dc') => wrap(`<rect x="86" y="10" width="140" height="204" rx="3" fill="#fff" stroke="#d6d2c6"/>${inner}`, bg);

function tShot(v) {
  const tones = {
    light: ['#ffffff', '#f5f4f0', '#1a1a1a'], sand: ['#fcfcfb', '#f5f4f0', '#1a1a1a'], dark: ['#1e1e1e', '#2a2a2a', '#e9e8e1'],
    slack: ['#ffffff', '#3f0e40', '#1a1a1a'], figma: ['#2c2c2c', '#383838', '#e9e8e1'], pass: ['#f4f6fb', '#1d3b8b', '#1a1a1a'],
    pay: ['#ffffff', '#e8f5ee', '#1a1a1a'], cal: ['#ffffff', '#f5f4f0', '#1a1a1a'],
  };
  const [bg, side, fg] = tones[v.tone] || tones.light;
  let body = '';
  if (v.phone) {
    body = `<rect x="120" y="26" width="72" height="190" rx="10" fill="#fff" stroke="#cfcac0"/>${T(128, 46, v.title, 7, '#1a1a1a', 600)}${lines(128, 56, 3, 52, 9)}<rect x="128" y="88" width="56" height="34" rx="4" fill="#ecd8fd"/>${lines(128, 132, 6, 52, 9)}`;
    return wrap(`<rect width="312" height="18" fill="#ecebe6"/>${body}`, '#f5f4f0');
  }
  if (v.term) {
    body = `${T(14, 40, '$ npm run build', 11, '#9fe8b0', 500, `font-family="Menlo, monospace"`)}${T(14, 60, 'Error: Cannot find module', 11, '#ff7a6e', 500, `font-family="Menlo, monospace"`)}${T(14, 78, "  './wisprfolder.js'", 11, '#e9e8e1', 400, `font-family="Menlo, monospace"`)}${lines(14, 94, 6, 220, 12, '#3a3a3a', 5)}`;
    return wrap(`<rect width="312" height="18" fill="#333"/><circle cx="10" cy="9" r="3.5" fill="#ff5f57"/><circle cx="21" cy="9" r="3.5" fill="#febc2e"/><circle cx="32" cy="9" r="3.5" fill="#28c840"/>${body}`, bg);
  }
  if (v.tone === 'pass') {
    body = `<rect x="56" y="30" width="200" height="176" rx="14" fill="${side}"/>${T(72, 60, 'IndiGo', 13, '#fff', 700)}${T(72, 100, 'BLR', 30, '#fff', 600)}${T(190, 100, 'DEL', 30, '#fff', 600)}<path d="M150 90 h22" stroke="#fff" stroke-width="2"/>${T(72, 130, 'FLIGHT 6E 2134   SEAT 14A', 9, '#cfd8f5', 600)}<rect x="96" y="146" width="120" height="44" fill="#fff"/>${Array.from({ length: 30 }, (_, i) => `<rect x="${100 + i * 3.8}" y="150" width="${1 + (i % 3)}" height="36" fill="#1a1a1a"/>`).join('')}`;
    return wrap(body, '#eef0f6');
  }
  if (v.tone === 'pay') {
    body = `<circle cx="156" cy="70" r="26" fill="#1f9d55"/><path d="M144 70 l8 8 l16 -16" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>${T(156, 128, '₹2,400', 26, '#1a1a1a', 600, 'text-anchor="middle"')}${T(156, 150, 'Paid to Toit Brewpub', 11, '#4c4c49', 500, 'text-anchor="middle"')}${lines(96, 168, 3, 120, 10)}`;
    return wrap(body, bg);
  }
  if (v.tone === 'cal') {
    let g = '';
    for (let c = 0; c < 5; c++) { g += T(40 + c * 54, 38, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][c], 9, '#71716e', 600); for (let r = 0; r < 4; r++) if ((c + r) % 2 === 0) g += `<rect x="${36 + c * 54}" y="${50 + r * 40 + (c % 2) * 10}" width="48" height="${18 + ((c * r) % 3) * 8}" rx="4" fill="${['#ecd8fd', '#ffe2c4', '#d6efe6'][(c + r) % 3]}"/>`; }
    return wrap(`<rect width="312" height="18" fill="#ecebe6"/>${g}`, bg);
  }
  if (v.title === 'meme') return wrap(`<rect x="70" y="30" width="172" height="150" rx="6" fill="#bfa98a"/><circle cx="156" cy="92" r="38" fill="#8f7756"/><circle cx="142" cy="86" r="5" fill="#1a1a1a"/><circle cx="170" cy="86" r="5" fill="#1a1a1a"/><path d="M118 62 l10 -22 l12 18 M194 62 l-10 -22 l-12 18" fill="#8f7756"/><rect x="96" y="140" width="120" height="26" rx="3" fill="#2a2a2a"/>${T(156, 202, 'ME WHEN THE BUILD PASSES', 11, '#fff', 800, 'text-anchor="middle"')}`, '#111');
  // generic app window: title bar, sidebar, content
  const sideW = v.tone === 'slack' ? 54 : 64;
  body += `<rect width="312" height="18" fill="${v.tone === 'dark' || v.tone === 'figma' ? '#333' : '#ecebe6'}"/><circle cx="10" cy="9" r="3.5" fill="#ff5f57"/><circle cx="21" cy="9" r="3.5" fill="#febc2e"/><circle cx="32" cy="9" r="3.5" fill="#28c840"/>`;
  body += `<rect y="18" width="${sideW}" height="206" fill="${side}"/>${lines(10, 34, 7, sideW - 20, 14, v.tone === 'slack' ? '#7c4a7d' : (v.tone === 'figma' ? '#4a4a4a' : '#dcd8cd'), 5)}`;
  body += T(sideW + 14, 42, `${v.app} · ${v.title}`, 12, fg, 600);
  if (v.stat) body += `<rect x="${sideW + 14}" y="56" width="104" height="58" rx="8" fill="#f5f4f0" stroke="#e4e1d8"/>${T(sideW + 24, 92, v.stat, 20, '#1a1a1a', 400, `font-family="${SERIF}"`)}<rect x="${sideW + 128}" y="56" width="104" height="58" rx="8" fill="#000"/>${T(sideW + 138, 84, 'Make Flow sound', 9, '#fff', 400, `font-family="${SERIF}"`)}${T(sideW + 138, 96, 'like you', 9, '#fff', 400, `font-family="${SERIF}" font-style="italic"`)}${lines(sideW + 14, 130, 5, 200, 14)}`;
  else if (v.chart) body += `<polyline points="${Array.from({ length: 12 }, (_, i) => `${sideW + 18 + i * 19},${150 - ((i * 53) % 70) - i * 4}`).join(' ')}" fill="none" stroke="#034f46" stroke-width="3"/><rect x="${sideW + 14}" y="56" width="70" height="30" rx="6" fill="#f5f4f0"/><rect x="${sideW + 92}" y="56" width="70" height="30" rx="6" fill="#f5f4f0"/>${lines(sideW + 14, 170, 3, 200, 12)}`;
  else if (v.tone === 'figma') body += `<rect x="${sideW + 40}" y="54" width="120" height="150" rx="4" fill="#fcfcfb"/>${T(sideW + 52, 90, 'Say it.', 18, '#1a1a1a', 400, `font-family="${SERIF}"`)}${T(sideW + 52, 110, 'Your Mac does it.', 12, '#1a1a1a', 400, `font-family="${SERIF}" font-style="italic"`)}<rect x="${sideW + 52}" y="124" width="56" height="16" rx="4" fill="#f0d7ff" stroke="#1a1a1a"/><rect x="${sideW + 180}" y="54" width="46" height="150" fill="#383838"/>`;
  else if (v.tone === 'slack') body += Array.from({ length: 4 }, (_, i) => `<rect x="${sideW + 14}" y="${56 + i * 40}" width="22" height="22" rx="5" fill="${['#efac5b', '#ecd8fd', '#034f46', '#ff6c4c'][i]}"/>${lines(sideW + 44, 58 + i * 40, 2, 180, 10, '#d9d6cc')}`).join('');
  else body += Array.from({ length: v.rows || 5 }, (_, i) => `<rect x="${sideW + 14}" y="${56 + i * 26}" width="${312 - sideW - 28}" height="20" rx="4" fill="${i % 2 ? '#fff' : '#f5f4f0'}" stroke="#ebe8df"/>${lines(sideW + 22, 64 + i * 26, 1, 120, 10, '#cfcbbf')}`).join('');
  return wrap(body, bg);
}

function tFace(v) {
  const skin = v.warm ? '#c8926b' : '#b98563';
  return wrap(`<g transform="translate(106 18)"><rect width="100" height="188" fill="${v.bg}" stroke="#d9d6cc"/>
    <path d="M10 188 C12 150 30 136 50 136 C70 136 88 150 90 188 Z" fill="${v.shirt}"/>
    <rect x="42" y="112" width="16" height="26" fill="${skin}"/>
    <ellipse cx="50" cy="86" rx="25" ry="31" fill="${skin}"/>
    <path d="M24 82 C22 54 40 46 52 47 C68 47 80 58 76 84 C74 70 64 62 50 63 C36 63 28 70 24 82 Z" fill="#231a14"/>
    <circle cx="41" cy="88" r="2.4" fill="#231a14"/><circle cx="59" cy="88" r="2.4" fill="#231a14"/>
    <path d="M43 104 Q50 108 57 104" stroke="#7a4a33" stroke-width="2" fill="none" stroke-linecap="round"/></g>`, '#e8e5dc');
}

function tPhoto(v) {
  if (v.v === 'beach') return wrap('<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7b267"/><stop offset=".6" stop-color="#f4845f"/><stop offset="1" stop-color="#f25c54"/></linearGradient></defs><rect width="312" height="130" fill="url(#s)"/><circle cx="156" cy="118" r="30" fill="#ffe8a3"/><rect y="124" width="312" height="50" fill="#2f6f8f"/><rect y="168" width="312" height="56" fill="#e8c58f"/><path d="M40 168 q20 -60 6 -110 M46 60 q-30 6 -40 20 M46 60 q24 -10 40 4" stroke="#2a2a2a" stroke-width="4" fill="none"/>');
  if (v.v === 'hills') return wrap('<rect width="312" height="224" fill="#bcd4e6"/><path d="M0 170 L70 70 L120 130 L180 50 L260 140 L312 100 V224 H0Z" fill="#5b7553"/><path d="M180 50 L200 78 L188 74 L172 84 L166 70Z" fill="#fff"/><path d="M0 200 Q156 150 312 200 V224 H0Z" fill="#3f5a3a"/>');
  if (v.v === 'dog') return wrap('<rect width="312" height="224" fill="#9cc58a"/><ellipse cx="160" cy="150" rx="70" ry="44" fill="#c58b4f"/><circle cx="118" cy="104" r="34" fill="#c58b4f"/><ellipse cx="96" cy="88" rx="12" ry="24" fill="#8a5a2e"/><circle cx="110" cy="100" r="4" fill="#1a1a1a"/><circle cx="92" cy="112" r="6" fill="#1a1a1a"/><rect x="104" y="180" width="14" height="30" fill="#c58b4f"/><rect x="190" y="180" width="14" height="30" fill="#c58b4f"/>');
  // party
  let lights = ''; for (let i = 0; i < 14; i++) lights += `<circle cx="${12 + i * 22}" cy="${24 + (i % 2) * 8}" r="4" fill="${['#ffd166', '#ff9f1c', '#ffe8a3'][i % 3]}"/>`;
  let ppl = ''; for (let i = 0; i < 5; i++) ppl += `<circle cx="${50 + i * 52}" cy="${110 + (i % 2) * 8}" r="18" fill="${['#b98563', '#8d5b3e', '#c8926b', '#a8714f', '#d3a07a'][i]}"/><path d="M${26 + i * 52} 224 C${28 + i * 52} 150 ${72 + i * 52} 150 ${74 + i * 52} 224Z" fill="${['#e63946', '#ffb703', '#8338ec', '#fb5607', '#2a9d8f'][i]}"/>`;
  return wrap(`<rect width="312" height="224" fill="#2b1d3a"/>${lights}<path d="M0 26 Q156 50 312 26" stroke="#5a4a2a" fill="none"/>${ppl}`);
}

function tInvoice(v) {
  return page(`${T(98, 34, v.receipt ? 'RECEIPT' : (v.gst ? 'TAX INVOICE' : 'INVOICE'), 9, '#1a1a1a', 800)}${T(214, 34, v.vendor, 8, '#71716e', 700, 'text-anchor="end"')}
    ${T(98, 48, v.when, 6.5, '#71716e', 500)}${v.gst ? T(98, 58, 'GSTIN 29ABCDE1234F1Z5', 5.5, '#9a978e', 500) : ''}
    <rect x="98" y="68" width="116" height="10" fill="#f5f4f0"/>${lines(100, 86, 5, 70, 11, '#e2dfd6', 3)}${lines(188, 86, 5, 22, 11, '#e2dfd6', 3)}
    <path d="M98 148 H214" stroke="#d9d6cc"/>${T(98, 164, 'Total', 8, '#1a1a1a', 600)}${T(214, 164, v.amount, 11, '#1a1a1a', 700, 'text-anchor="end"')}${lines(98, 182, 3, 90, 8, '#eceae3', 3)}`);
}
function tReceipt(v) {
  return wrap(`<rect x="106" y="8" width="100" height="208" fill="#fffdf7" stroke="#e0dccf"/>${T(156, 30, 'THANK YOU', 8, '#1a1a1a', 800, 'text-anchor="middle"')}${lines(116, 42, 9, 60, 11, '#dcd8cc', 3)}<path d="M116 150 H196" stroke="#bbb" stroke-dasharray="3 2"/>${T(116, 166, 'TOTAL', 8, '#1a1a1a', 700)}${T(196, 166, v.total, 9, '#1a1a1a', 700, 'text-anchor="end"')}${lines(116, 180, 2, 70, 9, '#e6e2d6', 3)}`, '#d8d2c4');
}
function tDoc(v) {
  return page(`${T(98, 36, v.title, 9, '#1a1a1a', 700)}<path d="M98 44 H214" stroke="#1a1a1a" stroke-width=".8"/>${v.bullets ? Array.from({ length: v.lines }, (_, i) => `<circle cx="101" cy="${58 + i * 14}" r="1.8" fill="#1a1a1a"/>`).join('') + lines(108, 56, v.lines, 90, 14, '#dcd8cc', 3.5) : lines(98, 56, v.lines, 110, 14, '#dcd8cc', 3.5)}${v.sign ? '<path d="M150 192 c8 -14 14 6 22 -6 s10 8 20 -4" stroke="#1d3b8b" stroke-width="1.6" fill="none"/>' : ''}`);
}
function tPass() {
  return wrap(`<rect x="46" y="34" width="220" height="156" rx="8" fill="#f2efe6" stroke="#d2ccbd"/>${T(60, 56, 'REPUBLIC OF INDIA · PASSPORT', 8, '#1d3b8b', 800)}<rect x="60" y="68" width="62" height="78" fill="#dfe8f3"/><ellipse cx="91" cy="100" rx="16" ry="20" fill="#b98563"/><path d="M68 146 C70 124 112 124 114 146Z" fill="#2b3a55"/>${lines(134, 72, 6, 110, 12, '#cfc9b8', 4)}${T(60, 170, 'P<INDREHLAN<<SAMEEP<<<<<<<<<<<<<<<', 8, '#4c4c49', 500, 'font-family="Menlo, monospace"')}${T(60, 182, 'Z1234567<8IND9001019M3001019<<<<<<', 8, '#4c4c49', 500, 'font-family="Menlo, monospace"')}`, '#e8e5dc');
}
function tDeck(v) {
  const th = { lumen: ['#ffffeb', '#1a1a1a'], ink: ['#1a1a1a', '#ffffeb'], fathom: ['#034f46', '#ffffff'], pink: ['#f7d6e0', '#5a1a33'], night: ['#1b1a3a', '#f0d7ff'], sand: ['#f5f4f0', '#1a1a1a'] }[v.theme] || ['#fff', '#1a1a1a'];
  return wrap(`<rect x="16" y="34" width="280" height="158" rx="4" fill="${th[0]}" stroke="#d6d2c6"/>${T(156, 108, v.title, 26, th[1], 400, `font-family="${SERIF}" text-anchor="middle"`)}${v.em ? T(156, 136, v.em, 20, th[1], 400, `font-family="${SERIF}" font-style="italic" text-anchor="middle"`) : ''}${T(30, 180, '1 / 18', 8, th[1], 500, 'opacity=".6"')}`, '#e8e5dc');
}
function tSheet() {
  let g = '<rect x="20" y="20" width="272" height="184" fill="#fff" stroke="#d6d2c6"/><rect x="20" y="20" width="272" height="16" fill="#e9f3ec"/>';
  for (let r = 1; r < 12; r++) g += `<path d="M20 ${20 + r * 16} H292" stroke="#ebe8df"/>`;
  for (let c = 1; c < 6; c++) g += `<path d="M${20 + c * 45} 20 V204" stroke="#ebe8df"/>`;
  for (let r = 1; r < 11; r++) for (let c = 0; c < 6; c++) if ((r * c + r) % 4) g += `<rect x="${26 + c * 45}" y="${26 + r * 16}" width="${18 + ((r + c) % 3) * 8}" height="4" rx="1" fill="${c === 0 ? '#9a978e' : '#cfcbbf'}"/>`;
  return wrap(g, '#f2f0ea');
}
function tVideo(v) {
  const scr = v.v === 'screen' ? '<rect x="40" y="36" width="232" height="140" fill="#f5f4f0"/><rect x="40" y="36" width="50" height="140" fill="#ecebe6"/>' + lines(100, 50, 6, 150, 18) : '<rect x="40" y="36" width="232" height="140" fill="#1a1a1a"/><text x="156" y="112" text-anchor="middle" font-family="' + SERIF + '" font-size="22" fill="#ffffeb">Say it.</text>';
  return wrap(`${scr}<circle cx="156" cy="106" r="22" fill="rgba(0,0,0,.55)"/><path d="M149 95 L167 106 L149 117Z" fill="#fff"/><rect x="226" y="184" width="46" height="20" rx="4" fill="#1a1a1a"/>${T(249, 198, v.dur, 10, '#fff', 600, 'text-anchor="middle"')}`, '#2a2a2a');
}
function tAudio() {
  let b = ''; for (let i = 0; i < 46; i++) { const h = 10 + Math.abs(Math.sin(i * 0.7) * 50) + ((i * 13) % 20); b += `<rect x="${24 + i * 5.8}" y="${112 - h / 2}" width="3" height="${h}" rx="1.5" fill="#1a1a1a"/>`; }
  return wrap(b, '#f5f4f0');
}
const tFolder = () => wrap('<path d="M86 64 h52 l12 14 h76 a8 8 0 0 1 8 8 v86 a8 8 0 0 1 -8 8 H86 a8 8 0 0 1 -8 -8 V72 a8 8 0 0 1 8 -8Z" fill="#7fb4e6"/><path d="M78 92 H234 V172 a8 8 0 0 1 -8 8 H86 a8 8 0 0 1 -8 -8Z" fill="#9cc7ef"/>', '#f5f4f0');
const tZip = () => wrap('<rect x="116" y="40" width="80" height="144" rx="6" fill="#e9e8e1" stroke="#c9c5b8"/>' + Array.from({ length: 8 }, (_, i) => `<rect x="${150 + (i % 2) * 6}" y="${46 + i * 10}" width="6" height="6" fill="#71716e"/>`).join('') + '<rect x="144" y="130" width="24" height="30" rx="3" fill="#71716e"/>', '#f5f4f0');
function tBoard() {
  return wrap(`<rect x="12" y="12" width="288" height="200" rx="4" fill="#f7f7f4" stroke="#cfcac0"/>${T(30, 44, 'GROWTH LOOP', 11, '#1d3b8b', 800)}<circle cx="110" cy="120" r="44" fill="none" stroke="#1d3b8b" stroke-width="2.5"/><path d="M150 112 l10 10 l10 -12" stroke="#1d3b8b" stroke-width="2.5" fill="none"/>${T(70, 124, 'share', 11, '#c0392b', 700)}${T(190, 90, 'try → keep', 11, '#1a1a1a', 600)}${T(190, 140, 'invite ×3', 11, '#1a1a1a', 600)}`, '#bdb6a6');
}
const tProduct = () => wrap('<ellipse cx="156" cy="190" rx="90" ry="12" fill="#e3d6d0"/><rect x="104" y="56" width="104" height="130" rx="12" fill="#f7d6e0"/><rect x="118" y="80" width="76" height="24" rx="4" fill="#fff"/><text x="156" y="97" text-anchor="middle" font-family="' + FONT + '" font-weight="800" font-size="13" fill="#5a1a33">nailinit</text>' + Array.from({ length: 5 }, (_, i) => `<rect x="${120 + i * 15}" y="120" width="10" height="44" rx="5" fill="${['#e63946', '#f4a261', '#8338ec', '#2a9d8f', '#1a1a1a'][i]}"/>`).join(''), '#fbf3f0');
const tLogo = () => wrap(`<text x="156" y="124" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="44" fill="#5a1a33" letter-spacing="-2">nailinit</text>${T(156, 152, 'v3 · wordmark', 10, '#9a978e', 600, 'text-anchor="middle"')}`, '#fff');
const tInvite = () => wrap(`<rect x="76" y="14" width="160" height="196" fill="#fffaf0" stroke="#d9c79f"/>${T(156, 70, 'Aanya', 22, '#8a6a2a', 400, `font-family="${SERIF}" font-style="italic" text-anchor="middle"`)}${T(156, 92, '&', 14, '#8a6a2a', 400, `font-family="${SERIF}" text-anchor="middle"`)}${T(156, 118, 'Kabir', 22, '#8a6a2a', 400, `font-family="${SERIF}" font-style="italic" text-anchor="middle"`)}${lines(106, 144, 3, 100, 10, '#e6d6b3', 3)}`, '#efe6d2');

const DRAW = { shot: tShot, face: tFace, photo: tPhoto, invoice: tInvoice, receipt: tReceipt, doc: tDoc, pass: tPass, deck: tDeck, sheet: tSheet, video: tVideo, audio: tAudio, folder: tFolder, zip: tZip, board: tBoard, product: tProduct, logo: tLogo, invite: tInvite };
const cache = new Map();
export function thumbSVG(f) { if (!cache.has(f.id)) cache.set(f.id, (DRAW[f.thumb.t] || tDoc)(f.thumb)); return cache.get(f.id); }
export const thumbURL = (f) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(thumbSVG(f));

// the file "as an image", for the clipboard: the thumbnail drawn at 3x into a PNG
export function filePNG(f, scale = 3) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = 312 * scale; c.height = 224 * scale;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), 'image/png');
    };
    img.onerror = rej; img.src = thumbURL(f);
  });
}
