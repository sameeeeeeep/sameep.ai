// Bridge's router, in the browser. The real one asks Haiku to classify into a fixed set of intents
// (file.find, wish.run, convert, review.note, guide, ask). Here a keyword router mirrors it, so nothing leaves the page.
// PM's own keyword router (lib/pm.mjs) is folded in: on the Mac it gets those phrases first.
export function classify(raw) {
  const t = ' ' + String(raw || '').toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ').trim() + ' ';
  const say = (intent, mod, args = {}) => ({ intent, mod, args });
  if (/\breview mode\b|\b(start|turn on) review\b|^ review (this|the) page\b|\breview this page\b/.test(t)) return say('review.note', 'review', { mode: /\boff\b/.test(t) ? 'off' : 'on' });
  if (/\b(export|send) (it |them |the notes |my notes )?(for|to) claude\b/.test(t)) return say('review.note', 'review', { export: true });
  if (/\binto tasks\b|\bpark\b|\bremind me to\b|\bwhat'?s next\b|\bwhat is next\b|\bwaiting on me\b|\bwhat'?s waiting\b|\bmark .+ (done|doing)\b|\bstart a thread\b|\bmy board\b|\bthe board\b|\bbacklog\b|\b(add|new) (a )?(task|card|todo|to-do)\b|\btasks?\b.*\b(for|on|to) (the )?(portfolio|nailinit|nail in it|wispr pack|pack 1)\b/.test(t)) return say('pm', 'pm');
  if (/\b(how do i|how to|walk me through|show me where|where do i click|guide me)\b/.test(t)) return say('guide', 'guru', { task: raw });
  if (/\b(cut the silences?|captions?|teleprompter|export (9:16|4:5|16:9)|edit (this|the|my) video)\b/.test(t)) return say('video', 'video');
  if (/\b(find|where'?s|where is|get me|pull up|look for|search for)\b/.test(t) && !/\b(make|convert|turn)\b/.test(t)) return say('file.find', 'file', { query: raw });
  if (/\b(timer|pomodoro|countdown)\b|\b\d+ ?(min|mins|minutes|minute)\b(?!.*\b(video|audio)\b)/.test(t)) return say('ask', 'wish', { app: 'timer' });
  if (/\bsplit\b|\b\d[\d,.]* ?(rupees|rs|inr|dollars|bucks|euros|pounds)?\b.*\b(ways|between|among)\b|\btip\b/.test(t) && !/\binto tasks\b/.test(t)) return say('ask', 'wish', { app: 'split' });
  if (/\bqr\b|\bqr code\b/.test(t)) return say('ask', 'wish', { app: 'qr' });
  if (/\b(webp|png|jpe?g|pdf|gif|mp3|word doc|as text)\b.*\b(this|it|these|that|them)\b|\b(this|it|these|that|them)\b.*\b(a |an |into |to |as )(webp|png|jpe?g|pdf|gif|mp3)\b|\b(make|convert|turn|export|save|compress|shrink|resize|scale)\b.*\b(webp|png|jpe?g|pdf|smaller|whatsapp|half|\d+ ?px|size|this|it)\b|\b(smaller|whatsapp|half size|compress)\b/.test(t)) return say('convert', 'wish');
  if (/\b(make|build|create|give me|i need|i want) (me )?(a|an)\b/.test(t)) return say('wish.run', 'wish', { wish: raw });
  if (/\b(find|where'?s|where is|get me|pull up|show me|grab|look for|search)\b|\b(my|the|last|latest)\b.*\b(photo|screenshot|invoice|deck|pdf|file|receipt|bill|cv|resume|passport|recording|memo)s?\b|\b(screenshot|invoice|passport|deck|receipt)s?\b/.test(t)) return say('file.find', 'file', { query: raw });
  return say('ask', null, { question: raw });
}
