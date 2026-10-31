// persona.js — everything person-specific comes from persona.json (+ episode.json),
// so anyone's generated bundle can run on this app via ?persona=<url>.
import { safeUrl } from './util.js';

const DEFAULT = 'persona.json';

async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(url + ' → ' + r.status);
  return r.json();
}

// prefix string ("img/sprites/host") or {closed,mid,open,blink} → absolute frame URLs
export function spriteFrames(spec, base) {
  if (!spec) return null;
  if (typeof spec === 'string') {
    const p = spec.replace(/\/$/, '');
    return Object.fromEntries(['closed', 'mid', 'open', 'blink'].map((k) => [k, safeUrl(`${p}/${k}.webp`, base)]));
  }
  if (typeof spec === 'object') {
    const o = {};
    for (const k of ['closed', 'mid', 'open', 'blink']) o[k] = safeUrl(spec[k] || spec.closed, base);
    return o;
  }
  return null;
}

export async function loadPersona({ episodeUrl } = {}) {
  const params = new URLSearchParams(location.search);
  const custom = params.get('persona');
  const siteBase = new URL('./', location.href).href;
  let base = siteBase;
  let p = {};
  let def = {};
  try { def = await getJSON(DEFAULT); } catch (e) { console.warn('[persona] default missing', e.message); }
  if (custom) {
    const url = safeUrl(custom, siteBase);
    try {
      p = await getJSON(url);
      base = url;
    } catch (e) {
      console.warn('[persona] could not load', custom, e.message);
      p = def;
    }
  } else p = def;

  const isCustom = p !== def;
  const abs = (u) => (u ? safeUrl(u, base) : null);
  const siteAbs = (u) => (u ? safeUrl(u, siteBase) : null);

  // links: array [{label,url,kind?}] or object {github, makeYourOwn}
  let links = [];
  if (Array.isArray(p.links)) links = p.links.map((l) => ({ label: l.label || l.url, url: abs(l.url), kind: l.kind || guessKind(l) })).filter((l) => l.url);
  else if (p.links && typeof p.links === 'object') {
    if (p.links.makeYourOwn) links.push({ label: p.links.makeYourOwnLabel || 'Make your own', url: abs(p.links.makeYourOwn), kind: 'make' });
    if (p.links.github) links.push({ label: p.links.github.replace(/^https?:\/\//, ''), url: abs(p.links.github), kind: 'github' });
  }
  if (!links.some((l) => l.kind === 'make')) links.unshift({ label: 'Make your own with Switchboard', url: 'https://thelastprompt.ai/switchboard', kind: 'make' });

  const studio = [].concat(p.studio || [], def.studio || []).map((s) => (p.studio && [].concat(p.studio).includes(s) ? abs(s) : siteAbs(s))).filter(Boolean);

  const persona = {
    ...def,
    ...p,
    isCustom,
    base,
    name: p.name || def.name || 'Guest',
    shortName: p.shortName || (p.name || def.name || 'Guest').split(' ')[0],
    showName: p.showName || def.showName || 'Off the CV',
    episodeTitle: p.episodeTitle || (isCustom ? 'Ep. 01' : def.episodeTitle),
    studio,
    links,
    hostFrames: spriteFrames(p.host?.sprite, base) || spriteFrames(def.host?.sprite, siteBase),
    guestFrames: spriteFrames(p.sprites || p.guest?.sprite, base) || (isCustom ? null : spriteFrames(def.sprites || def.guest?.sprite, siteBase)),
    hostName: p.host?.name || def.host?.name || 'The Host',
    guestName: p.guest?.name || (p.name ? (p.shortName || p.name.split(' ')[0]) + ' (AI)' : def.guest?.name),
    characters: (p.characters || def.characters || []).map((c) => ({ ...c, src: abs(c.src) || siteAbs(`img/characters/${c.id}.webp`), thumb: abs(c.thumb) || siteAbs(`img/characters/${c.id}-thumb.webp`) })),
    stage: { ...(def.stage || {}), ...(p.stage || {}) },
    wallpaper: cleanWall(p.wallpaper, abs) || def.wallpaper,
    work: (p.work || (isCustom ? [] : def.work) || []).map((w) => ({ ...w, url: templ(w.url, abs) })).filter((w) => w.url),
    workUrl: p.workUrl ? abs(p.workUrl) : null,
  };

  const epUrl = isCustom ? abs(p.episodeUrl || 'episode.json') : siteAbs(episodeUrl || p.episodeUrl || 'data/episode.json');
  let episode = null;
  try { episode = await getJSON(epUrl); } catch (e) { console.warn('[persona] episode', e.message); }
  persona.episodeBase = epUrl || siteBase;
  return { persona, episode };
}

function guessKind(l) {
  const u = String(l.url || '');
  const t = String(l.label || '').toLowerCase();
  if (/github\.com/.test(u)) return 'github';
  if (/make|switchboard/.test(t) || /switchboard|\/make/.test(u)) return 'make';
  return 'link';
}

// URL templates ({name}, {hour}) are checked with the placeholders filled, so a
// javascript: URL can never slip through as a "template".
function templ(u, abs) {
  if (!u || typeof u !== 'string') return null;
  if (!abs(u.replace(/\{(name|hour|visitor)\}/g, 'x'))) return null;
  return abs(u).replace(/%7B(name|hour|visitor)%7D/gi, '{$1}');
}
function cleanWall(w, abs) {
  if (!w || !w.url) return null;
  const url = templ(w.url, abs);
  return url ? { ...w, url } : null;
}
