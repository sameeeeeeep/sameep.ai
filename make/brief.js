// The brief your Claude reads the moment this page connects (sent as the system prompt),
// and the schema it must write. The same checklist lives in skill/off-the-cv/SKILL.md.

export const BRIEF = `You are helping someone build their own "OFF THE CV": an interactive podcast portfolio.
A host asks questions; the person (speaker "guest") answers with their own cloned voice and avatar;
the visitor steers by saying or clicking choices. You are writing the episode from THEIR work.

Checklist, in order:
1. Read only what they gave you (repos, bio, links). Never invent employers, numbers, awards or quotes.
   If a fact is not in the material, leave it out.
2. Find 4 to 7 threads worth pulling: projects, decisions, lessons. Weight them: 1 or 2 deep dives,
   the rest quick asides.
3. Write it in their voice: first person, plain words, short sentences, a little rambling honesty.
   Each line is 1 to 3 sentences (under 40 words) so it sounds spoken, not read.
4. The core loop: the host asks; the guest gives a SHORT answer that deliberately does not cover
   everything and name-drops threads; choices let the visitor pull a thread; the thread's node is
   the DEEP answer; then a new host question or more threads.
5. Every choice has 3 to 6 lowercase "say" keywords the visitor might speak.
6. Attach a demo to a line when there is a real public URL (repo, live site). Never a private URL.
7. No dead ends: every node has choices or a next. The last node offers "Start over" back to the start.
   Every node must be reachable from start.
8. Privacy: no email, phone, address, keys, salaries, or anything they marked private.
9. Output ONLY one JSON object, no prose, no code fence.`;

export const SCHEMA = `{
  "persona": {
    "name": "Their name",
    "tagline": "One line, under 90 characters",
    "sprites": "sprites/guest",
    "host": { "name": "A host name you invent (not a real person)" },
    "episodeUrl": "episode.json",
    "links": [ { "label": "GitHub", "url": "https://github.com/..." } ]
  },
  "episode": {
    "speakers": {
      "host":  { "name": "same host name" },
      "guest": { "name": "Their name (AI)", "sprite": "sprites/guest" }
    },
    "start": "intro",
    "nodes": {
      "intro": {
        "chapter": "Cold open",
        "lines": [
          { "id": "intro-01", "who": "host", "text": "..." },
          { "id": "intro-02", "who": "guest", "text": "...", "messy": "optional rawer, dictated version with ums" }
        ],
        "choices": [ { "label": "Tell me about X", "say": ["x", "..."], "to": "x-deep" } ]
      },
      "x-deep": {
        "chapter": "X",
        "lines": [ { "id": "x-01", "who": "guest", "text": "...", "demo": { "type": "iframe|qr|image|video|link", "url": "https://...", "title": "..." } } ],
        "choices": [],
        "next": "outro"
      }
    }
  }
}
Line ids: lowercase, unique, "<node>-NN". "who" is "host" or "guest". 12 to 30 lines total.`;

export function buildPrompt(ctx) {
  const parts = [];
  parts.push(`Name: ${ctx.name || '(not given; use a neutral placeholder)'}`);
  if (ctx.bio) parts.push(`Bio and notes, in their words:\n${ctx.bio}`);
  if (ctx.saved) parts.push(`A context they lent from Switchboard:\n${ctx.saved}`);
  if (ctx.repos?.length) {
    parts.push('Public GitHub repos:\n' + ctx.repos.map((r) =>
      `- ${r.name}${r.description ? ': ' + r.description : ''} [${[r.language, r.stars ? r.stars + '★' : '', r.homepage].filter(Boolean).join(', ')}] ${r.url}` +
      (r.readme ? `\n  README excerpt: ${r.readme.replace(/\s+/g, ' ').slice(0, 1800)}` : '')).join('\n'));
  }
  if (ctx.links?.length) parts.push(`Links (read them if you can fetch pages):\n${ctx.links.join('\n')}`);
  return `${parts.join('\n\n')}\n\nWrite their OFF THE CV bundle as ONE JSON object in exactly this shape:\n${SCHEMA}`;
}

/** Structural check of {persona, episode}. Returns a list of problems (empty = good). */
export function validateBundle(b) {
  const errs = [];
  if (!b || typeof b !== 'object') return ['Not a JSON object.'];
  const p = b.persona, e = b.episode;
  if (!p) errs.push('Missing "persona".');
  if (!e) errs.push('Missing "episode".');
  if (!p || !e) return errs;
  if (!p.name) errs.push('persona.name is empty.');
  if (!e.nodes || typeof e.nodes !== 'object') return errs.concat('episode.nodes is missing.');
  if (!e.start || !e.nodes[e.start]) errs.push(`episode.start "${e.start}" is not a node.`);
  const ids = new Set();
  for (const [key, n] of Object.entries(e.nodes)) {
    if (!Array.isArray(n.lines) || !n.lines.length) errs.push(`Node "${key}" has no lines.`);
    for (const l of n.lines || []) {
      if (!l.id) errs.push(`A line in "${key}" has no id.`);
      else if (ids.has(l.id)) errs.push(`Duplicate line id "${l.id}".`);
      ids.add(l.id);
      if (!e.speakers?.[l.who]) errs.push(`Line "${l.id}" uses unknown speaker "${l.who}".`);
      if (!l.text) errs.push(`Line "${l.id}" has no text.`);
    }
    const choices = Array.isArray(n.choices) ? n.choices : [];
    for (const c of choices) if (!e.nodes[c.to]) errs.push(`Choice "${c.label}" in "${key}" points to missing "${c.to}".`);
    if (!choices.length && !n.next) errs.push(`Node "${key}" is a dead end (no choices, no next).`);
    if (n.next && !e.nodes[n.next]) errs.push(`Node "${key}" next points to missing "${n.next}".`);
  }
  // reachability
  if (e.nodes[e.start]) {
    const seen = new Set([e.start]); const q = [e.start];
    while (q.length) {
      const n = e.nodes[q.shift()];
      const outs = [...(n.choices || []).map((c) => c.to), n.next].filter((k) => k && e.nodes[k]);
      for (const k of outs) if (!seen.has(k)) { seen.add(k); q.push(k); }
    }
    for (const k of Object.keys(e.nodes)) if (!seen.has(k)) errs.push(`Node "${k}" can't be reached from start.`);
  }
  return errs;
}

/** Pull the first balanced JSON object out of a model reply. */
export function extractJSON(text) {
  const s = String(text || '').replace(/^```(?:json)?/m, '').replace(/```\s*$/m, '');
  const i = s.indexOf('{'), j = s.lastIndexOf('}');
  if (i < 0 || j <= i) throw new Error('No JSON object in the reply.');
  return JSON.parse(s.slice(i, j + 1));
}
