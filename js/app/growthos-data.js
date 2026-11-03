// growthos-data.js — the logic half of Growth OS. The plan itself (campaigns, creators, CRM seed, sources…)
// is not in public JS: it comes from GET /api/growth/data after an @wispr.ai sign-in (analytics/src/growth.js),
// and load() fills these bindings. Everything below is presentation logic only.
export let PLAN, KPIS, CALENDAR, CAMPAIGNS, EVENTS_WHY, EVENTS, TVT, COLLABS_WHY, COLLAB_RULES, COLLAB_WEIGHTS, COLLABS, CREATORS_WHY, NEXT_STEP, RIGHTS, RIGHTS_RULES, UGC_SAMPLE, CREATOR_RULES, CREATOR_SO, LINKEDIN, BRAND, CRM_WHY, CRM_TYPES, CRM_STAGES, CRM_RULES, CRM_VENUES, SOURCES, CREATORS;

export function load(content) {
  ({ PLAN, KPIS, CALENDAR, CAMPAIGNS, EVENTS_WHY, EVENTS, TVT, COLLABS_WHY, COLLAB_RULES, COLLAB_WEIGHTS, COLLABS, CREATORS_WHY, NEXT_STEP, RIGHTS, RIGHTS_RULES, UGC_SAMPLE, CREATOR_RULES, CREATOR_SO, LINKEDIN, BRAND, CRM_WHY, CRM_TYPES, CRM_STAGES, CRM_RULES, CRM_VENUES, SOURCES, CREATORS } = content);
  // the linter's rules live here; the server sends their wording
  LINKEDIN = { ...LINKEDIN, lint: (LINKEDIN?.lint || []).map((r) => ({ ...r, test: LINT[r.id] || (() => true) })) };
}

const LINT = {
  firstline: (s) => (s.split(/(?<=[.!?])\s/)[0] || '').length <= 80,
  number: (s) => /\d/.test(s),
  nohype: (s) => !/\b(thrilled|excited|humbled|delighted to announce)\b/i.test(s),
  flowtwice: (s) => (s.match(/\bflow\b/gi) || []).length <= 2,
  length: (s) => s.length <= 1300,
  ask: (s) => /\?\s*$/.test(s) || /\b(dm|reply|comment|tell me|try)\b[^.]*\.?\s*$/i.test(s),
  hashtags: (s) => (s.match(/#\w+/g) || []).length <= 3,
};

export function creatorBrief(cr, cp) {
  if (!cr || !cp) return 'Pick a creator and a campaign.';
  return [
    `Hi ${cr.name.split(' ')[0]},`,
    '',
    `We’re planning “${cp.name}” at Wispr Flow and you came up because ${lower(cr.fit)}`,
    '',
    'The problem',
    cp.insight.replace(/\s\[\d+(?:,\s*\d+)*\]/g, ''),
    '',
    'What we’d love',
    `${cr.format || 'One video in your own format'}. Your words, your style, no script.`,
    '',
    'The one thing that must be on screen',
    'Your real voice going in, and the clean text appearing in the app you actually use.',
    '',
    'What we won’t ask',
    'No reading out features. No “link in bio” three times. No pretending you’ve used it for years.',
    '',
    'Rights',
    'Organic on your page. If we’d like to run it as an ad, that’s 90 days of paid usage, agreed up front and paid separately.',
    '',
    'Measure',
    'Your own code, so we can pay a bonus per person who actually starts using it.',
    '',
    'If it’s not a fit, no worries at all.',
  ].join('\n');
}
const lower = (s) => { const t = String(s || '').replace(/\s\[\d+(?:,\s*\d+)*\]/g, '').trim(); return t ? t[0].toLowerCase() + t.slice(1) + (/[.!?]$/.test(t) ? '' : '.') : 'your audience fits.'; };


export function CRM_SEED() {
  const add = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
  const creators = CREATORS.filter((c) => c.pick).slice(0, 12).map((c, i) => ({ id: 'cr' + i, name: c.name, type: 'Creator', org: String(c.handle || '').split(/;\s*/)[0], stage: 'to contact', next: 'Watch 5 recent posts, then DM', due: add(3 + i), owner: 'India growth', notes: c.format || '' }));
  const partners = COLLABS.filter((c) => c.tier !== 'Cut').map((c, i) => ({ id: 'pa' + i, name: c.name, type: 'Partner', org: c.cat, stage: 'to contact', next: c.first, due: add(5 + i * 2), owner: c.tier === 'Now' ? 'India growth' : 'India lead', notes: c.format }));
  const venues = (CRM_VENUES || []).map((v, i) => ({ id: 'v' + i, stage: 'to contact', due: add(4 + i), notes: '', ...v }));
  return [...creators, ...partners, ...venues];
}
