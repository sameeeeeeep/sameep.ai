// /make — build your own OFF THE CV through your own Switchboard.
//
// Only real Switchboard surface is used (BYOP 1.0, window.claude.request):
//   claude_health, claude_capabilities, claude_connect, claude_permissions,
//   claude_complete, claude_speak, claude_context {op:"pick"}, claude_storage {op:"set"}.
// Voice CLONING is not a window.claude method. Like Switchboard's own Clone wrapp, the clone
// step talks to the local voice engine directly (http://127.0.0.1:7897 /voices, /save, /speak).
// Image generation is not lent to pages at all, so the avatar is made in-browser (duotone),
// and the illustrated version is handed to the Claude Code skill.

import { BRIEF, buildPrompt, validateBundle, extractJSON } from './brief.js';

const $ = (s, r = document) => r.querySelector(s);
const ENGINE = 'http://127.0.0.1:7897';
const FRAMES = ['closed', 'mid', 'open', 'blink'];
const FW = 512, FH = 640;              // exported frame size (4:5)

const S = {
  provider: null, caps: null, grant: null, connected: false, model: undefined,
  repos: [], savedContext: '',
  bundle: null,
  photo: null, marks: null, frames: {}, frameUrls: {},
  engine: false, engineVoices: [], guestVoice: '', sample: null,
  clips: {}, clipUrls: {},
};

// ------------------------------------------------------------------ utils
function log(id, msg, cls) {
  const el = $(id); if (!el) return;
  const line = document.createElement('div');
  if (cls) line.className = cls;
  line.textContent = msg;
  el.append(line); el.scrollTop = el.scrollHeight;
}
function clearLog(id) { const el = $(id); if (el) el.textContent = ''; }
function errMsg(e) {
  if (!e) return 'Unknown error';
  const map = { 4001: 'You declined in Switchboard.', 4100: 'Not connected yet. Press Connect first.',
    4110: 'That model or tool is outside what you granted.', 4111: 'All capable models are switched off in Switchboard Settings.',
    4120: 'You said no to that action.', 4290: 'Your Switchboard budget for this site is spent. Try later.',
    4900: 'Switchboard isn\'t reachable. Is the Mac app running?', 4200: 'Your Switchboard doesn\'t support that yet.' };
  return map[e.code] || e.message || String(e);
}
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function timeout(p, ms, label = 'timed out') {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(label)), ms))]);
}
function blobToDataURL(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
}
async function dataURLToBlob(u) { return (await fetch(u)).blob(); }
function setDisabled(sel, v) { const el = $(sel); if (el) el.disabled = v; }

document.addEventListener('click', async (ev) => {
  const b = ev.target.closest('[data-copy]'); if (!b) return;
  const src = $(b.dataset.copy); if (!src) return;
  try { await navigator.clipboard.writeText(src.textContent); b.textContent = 'Copied'; setTimeout(() => (b.textContent = 'Copy'), 1500); } catch { /* clipboard blocked */ }
});

// ------------------------------------------------------------------ Switchboard detection
function getProvider() {
  const p = window.claude;
  return p && p.isRelay && typeof p.request === 'function' ? p : null;
}
function waitForProvider(ms = 3000) {
  const now = getProvider(); if (now) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => { clearTimeout(t); removeEventListener('claude#initialized', done); resolve(getProvider()); };
    const t = setTimeout(done, ms);
    addEventListener('claude#initialized', done);
  });
}
const rq = (method, params) => S.provider.request(params === undefined ? { method } : { method, params });

function setStatus(state, text) {
  const s = $('#status'); s.dataset.state = state; $('#status-text').textContent = text;
}

const STAGE_TEXT = {
  'no-app': 'Switchboard extension found, but the Mac app has never answered here. Open the Switchboard app.',
  'app-asleep': 'Switchboard found, but the app is asleep. Open Switchboard on your Mac.',
  'unpaired': 'Switchboard found, but this browser isn\'t paired. Pair it in the Switchboard side panel.',
  'signed-out': 'Switchboard found, but Claude Code isn\'t signed in on this Mac.',
  'disconnected': 'Switchboard found. Connect to use your Claude.',
  'unmet': 'Connected, but a connector this page asked for is missing.',
  'ready': 'Connected to your Switchboard',
};

async function detect() {
  setStatus('detecting', 'Looking for Switchboard…');
  S.provider = await waitForProvider(3000);
  if (!S.provider) {
    setStatus('absent', 'No Switchboard in this browser');
    $('#absent').hidden = false; $('#s0').hidden = true;
    applyMode();
    return;
  }
  $('#absent').hidden = true; $('#s0').hidden = false;
  let health = null;
  try { health = await timeout(rq('claude_health'), 1500); } catch { health = null; }
  try { S.caps = await timeout(rq('claude_capabilities'), 4000); } catch { S.caps = null; }
  const stage = health?.stage || (health?.connected ? 'ready' : 'disconnected');
  if (health?.connected || stage === 'ready') {
    try { S.grant = await rq('claude_permissions'); } catch { S.grant = null; }
    if (S.grant) return onConnected();
  }
  setStatus('detected', STAGE_TEXT[stage] || STAGE_TEXT.disconnected);
  $('#s0-title').textContent = STAGE_TEXT[stage] || 'Switchboard found';
  applyMode();
}

async function connect() {
  clearLog('#s0-log');
  setDisabled('#connect', true);
  try {
    if (!S.caps) S.caps = await timeout(rq('claude_capabilities'), 4000).catch(() => null);
    const models = S.caps?.defaultModel ? [S.caps.defaultModel] : (S.caps?.models || []).slice(0, 4);
    const scope = {
      reason: 'OFF THE CV maker: read the repos and links you give it, write your podcast episode, and speak the lines in your local voice. Nothing is sent to sameep.ai.',
      requirements: [{ class: 'cloud-coding' }],
      tools: ['WebFetch', 'WebSearch'],
      budgets: { maxCallsPerMin: 10 },
    };
    if (models.length) scope.models = models;
    log('#s0-log', '> claude_connect: approve it in Switchboard…');
    S.grant = await rq('claude_connect', scope);
    await onConnected();
  } catch (e) {
    log('#s0-log', errMsg(e), 'err');
    setStatus('detected', 'Not connected: ' + errMsg(e));
  } finally { setDisabled('#connect', false); }
}

async function onConnected() {
  S.connected = true;
  const g = S.grant || {};
  S.model = g.modelOverride || (S.caps?.defaultModel && g.models?.includes(S.caps.defaultModel) ? S.caps.defaultModel : g.models?.[0]) || undefined;
  const who = S.caps?.user?.name;
  setStatus('connected', 'Connected to your Switchboard' + (who ? ` · Hi ${who}` : ''));
  $('#s0-title').textContent = 'Connected to your Switchboard';
  $('#connect').hidden = true;
  const tools = (g.tools || []).map((t) => t.name).join(', ') || 'none';
  $('#who').textContent = `Model: ${S.model || 'your default'} · Read tools: ${tools}` + (S.caps?.local?.tts ? ' · Local voice: yes' : '');
  if (!$('#name').value && who) $('#name').value = who;
  applyMode();
  probeVoice(true, false);   // list Switchboard's voices; don't touch the local network until asked
}

function applyMode() {
  const c = S.connected;
  $('#write').disabled = !c;
  $('#write-note').textContent = c
    ? 'Runs on your Claude through Switchboard. With your links, it may read them with WebFetch (a read; no prompt).'
    : 'Without Switchboard: copy the prompt into any Claude, then paste its JSON reply below.';
  $('#ctx-sb').hidden = !c;
  $('#save-sb').hidden = !c;
  refreshRenderButton();
  fillHostVoices();
}

// ------------------------------------------------------------------ step 1: context
async function loadRepos() {
  const user = $('#gh').value.trim().replace(/^@/, '');
  const box = $('#repos'); box.textContent = '';
  if (!/^[a-z0-9-]{1,39}$/i.test(user)) { box.textContent = 'That doesn\'t look like a GitHub username.'; return; }
  box.textContent = 'Loading public repos…';
  try {
    const r = await fetch(`https://api.github.com/users/${encodeURIComponent(user)}/repos?per_page=100&sort=pushed`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!r.ok) throw new Error(r.status === 404 ? 'No such user.' : r.status === 403 ? 'GitHub rate limit hit. Try again in an hour, or paste a bio.' : `GitHub said ${r.status}.`);
    const list = (await r.json()).filter((x) => !x.fork && !x.private && !x.archived)
      .sort((a, b) => (b.stargazers_count - a.stargazers_count) || (new Date(b.pushed_at) - new Date(a.pushed_at)))
      .slice(0, 16);
    S.repos = list.map((x, i) => ({ owner: user, name: x.name, description: x.description || '', language: x.language || '', stars: x.stargazers_count,
      homepage: x.homepage || '', url: x.html_url, picked: i < 8 }));
    box.textContent = '';
    if (!S.repos.length) { box.textContent = 'No public, non-fork repos found.'; return; }
    for (const repo of S.repos) {
      const l = document.createElement('label');
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = repo.picked;
      cb.addEventListener('change', () => { repo.picked = cb.checked; });
      l.append(cb, document.createTextNode(repo.name));
      box.append(l);
    }
  } catch (e) { box.textContent = e.message; }
}

async function readmeFor(repo) {
  try {
    const r = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}/readme`, { headers: { Accept: 'application/vnd.github.raw' } });
    return r.ok ? (await r.text()).slice(0, 4000) : '';
  } catch { return ''; }
}

async function gatherContext(withReadmes) {
  const repos = S.repos.filter((r) => r.picked);
  if (withReadmes) await Promise.all(repos.map(async (r) => { if (r.readme === undefined) r.readme = await readmeFor(r); }));
  return {
    name: $('#name').value.trim(),
    bio: $('#bio').value.trim().slice(0, 20000),
    links: $('#links').value.split('\n').map((s) => s.trim()).filter((s) => /^https?:\/\//.test(s)).slice(0, 12),
    repos, saved: S.savedContext,
  };
}

async function pickContext() {
  try {
    const c = await rq('claude_context', { op: 'pick' });
    const ctx = c?.context;
    if (!ctx) { $('#ctx-note').textContent = 'Nothing picked.'; return; }
    const data = typeof ctx.data === 'string' ? ctx.data : JSON.stringify(ctx.data, null, 1);
    S.savedContext = `${ctx.name}${ctx.kind ? ' (' + ctx.kind + ')' : ''}:\n${data}`.slice(0, 20000);
    $('#ctx-note').textContent = `Using "${ctx.name}".`;
  } catch (e) { $('#ctx-note').textContent = errMsg(e); }
}

// ------------------------------------------------------------------ step 2: write
async function writeWithClaude() {
  clearLog('#s2-log');
  const ctx = await gatherContext(true);
  if (!ctx.bio && !ctx.repos.length && !ctx.links.length && !ctx.saved) { log('#s2-log', 'Give it something first: repos, a bio or links.', 'err'); return; }
  setDisabled('#write', true);
  const t0 = Date.now();
  const tick = setInterval(() => { $('#write').textContent = `Writing… ${Math.round((Date.now() - t0) / 1000)}s`; }, 1000);
  try {
    const canRead = (S.grant?.tools || []).some((t) => t.name === 'WebFetch');
    log('#s2-log', `> claude_complete (${S.model || 'default model'}${ctx.links.length && canRead ? ', may read your links' : ''})`);
    const params = { system: BRIEF, prompt: buildPrompt(ctx), maxTokens: 12000, agentic: !!(ctx.links.length && canRead) };
    if (S.model) params.model = S.model;
    const res = await rq('claude_complete', params);
    const bundle = extractJSON(res.text);
    setBundle(bundle);
    log('#s2-log', `Done in ${Math.round((Date.now() - t0) / 1000)}s.`, 'ok');
  } catch (e) {
    log('#s2-log', 'Couldn\'t write it: ' + errMsg(e), 'err');
  } finally { clearInterval(tick); $('#write').textContent = 'Write it with my Claude'; setDisabled('#write', !S.connected); }
}

async function copyPrompt() {
  const ctx = await gatherContext(true);
  const text = `${BRIEF}\n\n---\n\n${buildPrompt(ctx)}`;
  try { await navigator.clipboard.writeText(text); $('#copy-prompt').textContent = 'Prompt copied'; }
  catch { $('#json').value = text; $('#copy-prompt').textContent = 'Clipboard blocked: prompt is in the box'; }
  setTimeout(() => ($('#copy-prompt').textContent = 'Copy the prompt instead'), 2500);
}

async function loadSample() {
  const [p, e] = await Promise.all([fetch('sample/persona.json').then((r) => r.json()), fetch('sample/episode.json').then((r) => r.json())]);
  setBundle({ persona: p, episode: e });
}

function setBundle(b) {
  S.bundle = b;
  $('#json').value = JSON.stringify(b, null, 2);
  showValidation();
}

function readBundle() {
  try { S.bundle = extractJSON($('#json').value); return S.bundle; } catch { S.bundle = null; return null; }
}

function showValidation() {
  const b = readBundle();
  const out = $('#valid');
  if (!b) { out.className = 'err'; out.textContent = 'That isn\'t valid JSON yet.'; refreshRenderButton(); return false; }
  const errs = validateBundle(b);
  const lines = Object.values(b.episode?.nodes || {}).reduce((n, x) => n + (x.lines?.length || 0), 0);
  out.className = errs.length ? 'err' : 'ok';
  out.textContent = errs.length ? errs.slice(0, 4).join(' ') + (errs.length > 4 ? ` (+${errs.length - 4} more)` : '')
    : `Looks good: ${Object.keys(b.episode.nodes).length} nodes, ${lines} lines, no dead ends.`;
  refreshRenderButton();
  return !errs.length;
}

// ------------------------------------------------------------------ step 3: avatar
const TONES = { bondi: '#0a8fa8', tangerine: '#ff8a1f', strawberry: '#ff4f7b', grape: '#7b4fd6', lime: '#9bd13a' };
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function choosePhoto() { $('#photo').click(); }
function onFiles(files) {
  const f = [...(files || [])].find((x) => x.type.startsWith('image/'));
  if (!f) return;
  const url = URL.createObjectURL(f);
  const img = new Image();
  img.onload = () => {
    S.photo = img;
    S.marks = { mouth: { x: .5, y: .74 }, eyeL: { x: .4, y: .47 }, eyeR: { x: .6, y: .47 } };
    $('#avatar-work').hidden = false;
    drawSource(); placeMarks();
  };
  img.src = url;
}

function coverDraw(ctx, img, w, h) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}
function drawSource() {
  const c = $('#src-canvas'); const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height); coverDraw(ctx, S.photo, c.width, c.height);
}
function placeMarks() {
  const stage = $('#stage');
  stage.querySelectorAll('.mark').forEach((m) => m.remove());
  for (const [k, p] of Object.entries(S.marks)) {
    const m = document.createElement('div');
    m.className = 'mark ' + (k === 'mouth' ? 'mouth' : 'eye');
    m.setAttribute('aria-label', k === 'mouth' ? 'Mouth marker' : 'Eye marker');
    m.style.left = p.x * 100 + '%'; m.style.top = p.y * 100 + '%';
    m.addEventListener('pointerdown', (ev) => {
      ev.preventDefault(); m.setPointerCapture(ev.pointerId);
      const move = (e) => {
        const r = $('#src-canvas').getBoundingClientRect();
        p.x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        p.y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
        m.style.left = p.x * 100 + '%'; m.style.top = p.y * 100 + '%';
      };
      const up = () => { m.removeEventListener('pointermove', move); m.removeEventListener('pointerup', up); };
      m.addEventListener('pointermove', move); m.addEventListener('pointerup', up);
    });
    stage.append(m);
  }
}

function baseFrame(tone) {
  const c = document.createElement('canvas'); c.width = FW; c.height = FH;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  coverDraw(ctx, S.photo, FW, FH);
  if (tone !== 'none') {
    const d = ctx.getImageData(0, 0, FW, FH), px = d.data;
    const dark = hex('#0f0d0b'), mid = hex(TONES[tone] || TONES.bondi), light = hex('#f3eee2');
    for (let i = 0; i < px.length; i += 4) {
      let l = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
      l = Math.min(1, Math.max(0, (l - 0.08) * 1.25));          // a little contrast
      const [a, b, t] = l < 0.5 ? [dark, mid, l * 2] : [mid, light, (l - 0.5) * 2];
      px[i] = a[0] + (b[0] - a[0]) * t; px[i + 1] = a[1] + (b[1] - a[1]) * t; px[i + 2] = a[2] + (b[2] - a[2]) * t;
    }
    ctx.putImageData(d, 0, 0);
  }
  return c;
}
function sample(ctx, x, y) {
  const d = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data; return `rgb(${d[0]},${d[1]},${d[2]})`;
}
function makeFrames() {
  const tone = $('#tone').value;
  const m = S.marks, eyeDist = Math.hypot((m.eyeR.x - m.eyeL.x) * FW, (m.eyeR.y - m.eyeL.y) * FH) || FW * .2;
  const mw = eyeDist * 0.42, mx = m.mouth.x * FW, my = m.mouth.y * FH;
  const darkMouth = tone === 'none' ? '#3a1414' : '#0f0d0b';
  for (const f of FRAMES) {
    const c = baseFrame(tone), ctx = c.getContext('2d');
    if (f === 'mid' || f === 'open') {
      const h = f === 'mid' ? mw * 0.32 : mw * 0.62;
      ctx.save();
      ctx.fillStyle = darkMouth;
      ctx.beginPath(); ctx.ellipse(mx, my + h * 0.25, mw * (f === 'mid' ? .8 : .9), h, 0, 0, Math.PI * 2); ctx.fill();
      if (f === 'open') { ctx.fillStyle = 'rgba(243,238,226,.85)'; ctx.fillRect(mx - mw * .55, my - h * .62, mw * 1.1, h * .28); }
      ctx.restore();
    }
    if (f === 'blink') {
      for (const e of [m.eyeL, m.eyeR]) {
        const ex = e.x * FW, ey = e.y * FH, r = eyeDist * 0.22;
        ctx.fillStyle = sample(ctx, ex, Math.max(0, ey - r * 1.4));
        ctx.beginPath(); ctx.ellipse(ex, ey, r, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#0f0d0b'; ctx.lineWidth = Math.max(2, r * 0.14); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(ex - r * .85, ey + r * .1); ctx.quadraticCurveTo(ex, ey + r * .45, ex + r * .85, ey + r * .1); ctx.stroke();
      }
    }
    S.frames[f] = c;
  }
  Promise.all(FRAMES.map((f) => new Promise((res) => S.frames[f].toBlob((b) => res([f, b]), 'image/webp', 0.86)))).then((pairs) => {
    const box = $('#frames'); box.textContent = '';
    for (const [f, blob] of pairs) {
      if (S.frameUrls[f]) URL.revokeObjectURL(S.frameUrls[f]);
      S.frames[f + 'Blob'] = blob; S.frameUrls[f] = URL.createObjectURL(blob);
      const fig = document.createElement('figure');
      const im = document.createElement('img'); im.src = S.frameUrls[f]; im.alt = `${f} frame`;
      const cap = document.createElement('figcaption'); cap.textContent = f;
      fig.append(im, cap); box.append(fig);
    }
    startTalkTest();
  });
}
let talkTimer = 0;
function startTalkTest() {
  $('#talk').hidden = false; clearInterval(talkTimer);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { $('#talk-img').src = S.frameUrls.open; return; }
  let t = 0;
  talkTimer = setInterval(() => {
    t++;
    const f = t % 37 === 0 ? 'blink' : ['closed', 'mid', 'open', 'mid'][Math.floor(Math.random() * 4)];
    $('#talk-img').src = S.frameUrls[f];
  }, 110);
}

// ------------------------------------------------------------------ step 4: voice
async function probeVoice(quiet, reachEngine = true) {
  const st = $('#voice-status');
  if (!quiet) st.textContent = 'Looking…';
  try {
    if (!reachEngine) throw new Error('skip');
    const r = await fetch(`${ENGINE}/voices`, { signal: AbortSignal.timeout(2500) });
    const d = await r.json();
    S.engine = true; S.engineVoices = (d.voices || []).filter((v) => !/moira/i.test(v));
    st.textContent = `Voice engine found: ${S.engineVoices.length} voice${S.engineVoices.length === 1 ? '' : 's'}.`;
  } catch {
    S.engine = false;
    const local = S.caps?.local;
    if (!reachEngine) { st.textContent = local?.tts ? 'Switchboard can speak locally. Press the button to look for your cloning engine.' : ''; }
    else st.textContent = local?.tts
      ? 'Couldn\'t reach the voice engine from this page. Switchboard can still speak through claude_speak; to clone, download the sample and use the skill.'
      : 'No voice engine reachable from this page. Record a sample and download it; the skill clones it on your Mac.';
  }
  const pick = $('#voice-select'); pick.textContent = '';
  const names = [...new Set([...(S.engineVoices || []), ...((S.caps?.local?.voices) || [])])].filter((v) => !/moira/i.test(v));
  $('#voice-pick').hidden = !names.length;
  pick.append(new Option('(record a new one below)', ''));
  for (const v of names) pick.append(new Option(v, v));
  if (S.guestVoice) pick.value = S.guestVoice;
  fillHostVoices();
  refreshRenderButton();
  setDisabled('#clone', !(S.engine && S.sample));
}

function fillHostVoices() {
  const sel = $('#host-voice'); const keep = sel.value;
  sel.textContent = '';
  const presets = (S.engineVoices || []).filter((v) => ['alba', 'kk', 'zoo-guy'].includes(v));
  const local = (S.caps?.local?.voices || []).filter((v) => !/moira/i.test(v) && v !== S.guestVoice);
  const opts = [...new Set([...presets, ...local, 'Samantha', 'Daniel', 'Karen'])].filter((v) => v !== S.guestVoice);
  for (const v of opts) sel.append(new Option(v, v));
  sel.value = keep && opts.includes(keep) ? keep : (presets.includes('alba') ? 'alba' : 'Samantha');
}

let rec = null;
async function toggleRecord() {
  if (rec) { rec.stop(); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true } }); }
  catch { log('#s4-log', 'Microphone permission was denied.', 'err'); return; }
  const chunks = []; const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => window.MediaRecorder?.isTypeSupported?.(m)) || '';
  const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const an = ac.createAnalyser(); an.fftSize = 512; ac.createMediaStreamSource(stream).connect(an);
  const buf = new Uint8Array(an.fftSize); const t0 = Date.now(); let raf = 0;
  const draw = () => {
    an.getByteTimeDomainData(buf); let peak = 0; for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
    $('#rec-level').style.width = Math.min(100, peak / 1.1) + '%';
    const s = Math.floor((Date.now() - t0) / 1000); $('#rec-t').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    if (s >= 60) mr.stop(); else raf = requestAnimationFrame(draw);
  };
  mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  mr.onstop = () => {
    cancelAnimationFrame(raf); stream.getTracks().forEach((t) => t.stop()); ac.close(); rec = null;
    $('#rec').textContent = 'Record again'; $('#rec-level').style.width = '0';
    const secs = (Date.now() - t0) / 1000;
    if (secs < 6) { log('#s4-log', 'That was under 6 seconds. Aim for about a minute.', 'err'); return; }
    S.sample = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
    const a = $('#rec-play'); a.src = URL.createObjectURL(S.sample); a.hidden = false;
    setDisabled('#rec-dl', false); setDisabled('#clone', !S.engine);
    log('#s4-log', `Recorded ${Math.round(secs)}s.` + (S.engine ? ' Name it and clone it.' : ' Download it for the skill, or start Switchboard\'s voice engine and press "Look for my voice engine".'));
  };
  mr.start(250); rec = mr; $('#rec').textContent = 'Stop'; draw();
}

function downloadSample() {
  if (!S.sample) return;
  const ext = S.sample.type.includes('mp4') ? 'm4a' : 'webm';
  const a = document.createElement('a'); a.href = URL.createObjectURL(S.sample);
  a.download = `voice-sample.${ext}`; a.click();
}

async function cloneSample() {
  const name = slug($('#voice-name').value || $('#name').value || 'me');
  if (!S.sample) return;
  setDisabled('#clone', true);
  log('#s4-log', `> POST ${ENGINE}/save (your voice engine; stays on your Mac)…`);
  try {
    const audio_b64 = await blobToDataURL(S.sample);
    const r = await fetch(`${ENGINE}/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, audio_b64, start: 2, duration: 18 }), signal: AbortSignal.timeout(60000) });   // Pocket clones best from 6-20 s
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) throw new Error(d.error || `engine said ${r.status}`);
    S.guestVoice = d.voice;
    log('#s4-log', `Cloned "${d.voice}" from ${d.seconds}s of audio.`, 'ok');
    await probeVoice(true, true);
    $('#voice-select').value = d.voice;
  } catch (e) {
    log('#s4-log', 'Clone failed: ' + (e.message || e) + '. Download the sample and run the skill instead.', 'err');
  } finally { setDisabled('#clone', !S.engine); }
}

function refreshRenderButton() {
  const canSpeak = S.connected || S.engine;
  setDisabled('#render', !(canSpeak && S.bundle && ($('#voice-select').value || S.guestVoice)));
}

async function speakLine(text, voice, isGuest) {
  // Guest lines in a CLONED voice go straight to the engine when reachable (claude_speak can fall back to
  // macOS `say` if the engine is cold, which would silently be the wrong voice). Otherwise claude_speak.
  if (S.engine && (isGuest || S.engineVoices.includes(voice))) {
    const body = { text, voice };
    if (isGuest) { body.steps = 6; body.temp = 0.45; }
    const r = await fetch(`${ENGINE}/speak`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `engine said ${r.status}`);
    return { blob: await r.blob(), backend: 'voice engine' };
  }
  if (!S.connected) throw new Error('Connect Switchboard or start its voice engine to render.');
  const res = await rq('claude_speak', { text, voice });
  if (!res?.audio) throw new Error('No local voice available.');
  return { blob: await dataURLToBlob(res.audio), backend: res.backend };
}

async function renderClips() {
  const b = readBundle(); if (!b) return;
  S.guestVoice = $('#voice-select').value || S.guestVoice;
  const hostVoice = $('#host-voice').value;
  clearLog('#s4-log'); $('#clips').textContent = '';
  setDisabled('#render', true);
  const lines = Object.values(b.episode.nodes).flatMap((n) => n.lines || []);
  let ok = 0;
  for (const [i, l] of lines.entries()) {
    const isGuest = l.who !== 'host';
    try {
      const { blob, backend } = await speakLine(l.text, isGuest ? S.guestVoice : hostVoice, isGuest);
      if (isGuest && backend === 'macos-say' && !/^[A-Z]/.test(S.guestVoice)) log('#s4-log', `${l.id}: came back in the Mac's default voice (engine cold?). Re-render later.`, 'err');
      if (S.clipUrls[l.id]) URL.revokeObjectURL(S.clipUrls[l.id]);
      S.clips[l.id] = blob; S.clipUrls[l.id] = URL.createObjectURL(blob);
      l.audio = `audio/clips/${l.id}.wav`;
      const row = document.createElement('div');
      const id = document.createElement('b'); id.textContent = l.id;
      const tx = document.createElement('span'); tx.textContent = l.text.slice(0, 80);
      const au = document.createElement('audio'); au.controls = true; au.preload = 'none'; au.src = S.clipUrls[l.id];
      row.append(id, tx, au); $('#clips').append(row); ok++;
      $('#render').textContent = `Rendering ${i + 1}/${lines.length}…`;
    } catch (e) {
      log('#s4-log', `${l.id}: ${errMsg(e)}`, 'err');
      if (e.code === 4001 || e.code === 4120 || e.code === 4290) break;
    }
    await sleep(0);
  }
  setBundle(b);
  log('#s4-log', `${ok}/${lines.length} clips rendered.`, ok === lines.length ? 'ok' : 'err');
  $('#render').textContent = 'Render all clips';
  refreshRenderButton();
}

// ------------------------------------------------------------------ step 5: preview
let previewUrls = [];
function preview() {
  const b = readBundle();
  if (!b) { $('#preview-note').textContent = 'Write or paste the episode first (step 2).'; return; }
  previewUrls.forEach((u) => URL.revokeObjectURL(u)); previewUrls = [];
  const ep = structuredClone(b.episode), persona = structuredClone(b.persona);
  const site = new URL('../', location.href);
  let sprites = null;
  if (S.frameUrls.closed) sprites = { closed: S.frameUrls.closed, mid: S.frameUrls.mid, open: S.frameUrls.open, blink: S.frameUrls.blink };
  for (const n of Object.values(ep.nodes)) for (const l of n.lines || []) {
    if (S.clipUrls[l.id]) l.audio = S.clipUrls[l.id]; else delete l.audio;
  }
  for (const [k, sp] of Object.entries(ep.speakers || {})) {
    if (k === 'host') delete sp.sprite;                     // site default host
    else if (sprites) sp.sprite = sprites;
    else sp.sprite = new URL('make/sample/sprites/guest', site).href;   // placeholder face until you make yours
  }
  const epUrl = URL.createObjectURL(new Blob([JSON.stringify(ep)], { type: 'application/json' }));
  persona.episodeUrl = epUrl;
  persona.sprites = sprites || new URL('make/sample/sprites/guest', site).href;
  if (persona.host) delete persona.host.sprite;
  const pUrl = URL.createObjectURL(new Blob([JSON.stringify(persona)], { type: 'application/json' }));
  previewUrls.push(epUrl, pUrl);
  const href = new URL(`?persona=${encodeURIComponent(pUrl)}&skip`, site).href;
  window.open(href, '_blank');
  $('#preview-note').textContent = (sprites ? '' : 'No frames yet, so it uses the sample face. ') + (Object.keys(S.clips).length ? '' : 'No clips yet, so it plays as text. ') + 'Opened in a new tab.';
}

// ------------------------------------------------------------------ step 6: export
const README_TXT = (name) => `OFF THE CV bundle for ${name}
Made at https://sameep.ai/make/

persona.json       who you are, links, where your sprites and episode live
episode.json       the dialogue graph (host, guest, choices, demos)
sprites/guest/     closed / mid / open / blink frames
audio/clips/       one clip per line (wav; convert to mp3 with: for f in audio/clips/*.wav; do ffmpeg -i "$f" -ac 1 -b:a 80k "\${f%.wav}.mp3"; done
                   then replace .wav with .mp3 in episode.json)

Publish:
1. Fork https://github.com/sameeeeeeep/sameep.ai (MIT).
2. Put this folder at me/ in the repo root.
3. Settings > Pages > Deploy from branch: main, / (root).
4. Share https://<you>.github.io/sameep.ai/?persona=me/persona.json
   (or host this folder anywhere with CORS and use https://sameep.ai/?persona=<url-to-persona.json>)
`;

async function downloadZip() {
  clearLog('#s6-log');
  const b = readBundle();
  if (!b) { log('#s6-log', 'Write or paste the episode first.', 'err'); return; }
  if (!window.JSZip) { log('#s6-log', 'Zip library didn\'t load. Reload the page.', 'err'); return; }
  const errs = validateBundle(b);
  if (errs.length) log('#s6-log', 'Heads up: ' + errs[0], 'err');
  const zip = new window.JSZip();
  const persona = { ...b.persona, sprites: 'sprites/guest', episodeUrl: 'episode.json' };
  if (persona.host) delete persona.host.sprite;
  const ep = structuredClone(b.episode);
  for (const [k, sp] of Object.entries(ep.speakers || {})) { if (k === 'host') delete sp.sprite; else sp.sprite = 'sprites/guest'; }
  for (const n of Object.values(ep.nodes)) for (const l of n.lines || []) { if (S.clips[l.id]) l.audio = `audio/clips/${l.id}.wav`; else delete l.audio; }
  zip.file('persona.json', JSON.stringify(persona, null, 2));
  zip.file('episode.json', JSON.stringify(ep, null, 2));
  zip.file('README.txt', README_TXT(persona.name || 'you'));
  let frames = 0;
  for (const f of FRAMES) if (S.frames[f + 'Blob']) { zip.file(`sprites/guest/${f}.webp`, S.frames[f + 'Blob']); frames++; }
  for (const [id, blob] of Object.entries(S.clips)) zip.file(`audio/clips/${id}.wav`, blob);
  if (S.sample) zip.file(`voice-sample.${S.sample.type.includes('mp4') ? 'm4a' : 'webm'}`, S.sample);
  const blob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `offthecv-${slug(persona.name) || 'bundle'}.zip`; a.click();
  log('#s6-log', `Zipped: ${frames}/4 frames, ${Object.keys(S.clips).length} clips${S.sample ? ', your voice sample' : ''}.`, 'ok');
}

async function saveToSwitchboard() {
  const b = readBundle(); if (!b) return;
  try {
    await rq('claude_storage', { op: 'set', key: 'offthecv-draft', value: JSON.stringify(b) });
    log('#s6-log', 'Saved as "offthecv-draft" in this site\'s Switchboard storage. Your Claude Code skill can pick it up.', 'ok');
  } catch (e) { log('#s6-log', errMsg(e), 'err'); }
}

// ------------------------------------------------------------------ wire up
function wire() {
  $('#brief').textContent = BRIEF;
  $('#connect').addEventListener('click', connect);
  $('#recheck').addEventListener('click', detect);
  $('#gh-load').addEventListener('click', loadRepos);
  $('#gh').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadRepos(); });
  $('#ctx-pick').addEventListener('click', pickContext);
  $('#write').addEventListener('click', writeWithClaude);
  $('#copy-prompt').addEventListener('click', copyPrompt);
  $('#load-sample').addEventListener('click', loadSample);
  $('#validate').addEventListener('click', showValidation);
  $('#json').addEventListener('change', showValidation);
  const drop = $('#drop');
  drop.addEventListener('click', choosePhoto);
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choosePhoto(); } });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); onFiles(e.dataTransfer.files); });
  $('#photo').addEventListener('change', (e) => onFiles(e.target.files));
  $('#make-frames').addEventListener('click', makeFrames);
  $('#probe-voice').addEventListener('click', () => probeVoice(false, true));
  $('#voice-select').addEventListener('change', (e) => { S.guestVoice = e.target.value; fillHostVoices(); refreshRenderButton(); });
  $('#rec').addEventListener('click', toggleRecord);
  $('#rec-dl').addEventListener('click', downloadSample);
  $('#clone').addEventListener('click', cloneSample);
  $('#render').addEventListener('click', renderClips);
  $('#preview').addEventListener('click', preview);
  $('#zip').addEventListener('click', downloadZip);
  $('#save-sb').addEventListener('click', saveToSwitchboard);
  if (!window.MediaRecorder) { setDisabled('#rec', true); $('#rec').textContent = 'Recording not supported here'; }
}

wire();
detect();
