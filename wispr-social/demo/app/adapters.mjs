// Direct publishing, designed and OFF. Every adapter here is "coming": it can show you the exact request it would
// send (preview), but publish() always refuses. There is no flag that turns it on in this version, no credential is
// read from anywhere, and nothing here opens a network connection. Today Wispr Social posts the human way: at the
// reminder, the copy is on your clipboard and the asset is revealed in Finder, and you paste.
const basename = (p) => String(p).split('/').pop();

const COMING = 'Direct publishing is coming. It is off in this version: nothing is sent.';

const base = (id, name, platforms, docs, needs) => ({ id, name, platforms, docs, needs, status: 'coming' });

export const ADAPTERS = [
  { ...base('x-api', 'X API v2', ['x'], 'https://docs.x.com/x-api/posts/creation-of-a-post', ['OAuth 2.0 user token with tweet.write, users.read, media.write']),
    preview: (p) => (p.parts.length ? p.parts : [p.copy]).map((text, i) => ({
      method: 'POST', url: 'https://api.x.com/2/tweets',
      body: { text, ...(i ? { reply: { in_reply_to_tweet_id: `<id of post ${i}>` } } : {}), ...(i === 0 && p.assets.length ? { media: { media_ids: ['<uploaded media id>'] } } : {}) } })) },
  { ...base('linkedin-api', 'LinkedIn Posts API', ['linkedin'], 'https://learn.microsoft.com/linkedin/marketing/community-management/shares/posts-api', ['OAuth token with w_member_social', 'your person URN']),
    preview: (p) => [{ method: 'POST', url: 'https://api.linkedin.com/rest/posts', headers: { 'LinkedIn-Version': 'YYYYMM' },
      body: { author: 'urn:li:person:<you>', commentary: p.copy, visibility: 'PUBLIC', lifecycleState: 'PUBLISHED',
        distribution: { feedDistribution: 'MAIN_FEED' }, ...(p.assets.length ? { content: { media: { id: 'urn:li:image:<uploaded>' } } } : {}) } },
      ...(p.firstComment ? [{ method: 'POST', url: 'https://api.linkedin.com/rest/socialActions/<post urn>/comments', body: { message: { text: p.firstComment } } }] : [])] },
  { ...base('meta-graph', 'Instagram Graph API', ['instagram'], 'https://developers.facebook.com/docs/instagram-platform/content-publishing', ['Instagram professional account', 'instagram_content_publish permission', 'assets at a public URL']),
    preview: (p) => [
      ...p.assets.map((a) => ({ method: 'POST', url: 'https://graph.instagram.com/<ig-user-id>/media', body: { [/\.(mp4|mov)$/i.test(a.path) ? 'video_url' : 'image_url']: `<public URL for ${basename(a.path)}>`, is_carousel_item: p.format === 'carousel' } })),
      { method: 'POST', url: 'https://graph.instagram.com/<ig-user-id>/media', body: { media_type: p.format === 'reel' ? 'REELS' : p.format === 'carousel' ? 'CAROUSEL' : 'IMAGE', caption: p.copy, children: p.format === 'carousel' ? ['<container ids>'] : undefined } },
      { method: 'POST', url: 'https://graph.instagram.com/<ig-user-id>/media_publish', body: { creation_id: '<container id>' } }] },
  { ...base('buffer', 'Buffer', ['x', 'linkedin', 'instagram'], 'https://buffer.com/developers', ['a Buffer account and access token']),
    preview: (p) => [{ method: 'POST', url: 'https://api.bufferapp.com/<updates endpoint>', body: { text: p.parts.length ? p.parts.join('\n\n') : p.copy, profile: `<your ${p.platform} profile>`, scheduled_at: p.date ? `${p.date}T${p.time || '09:00'}` : null } }] },
  { ...base('typefully', 'Typefully', ['x', 'linkedin'], 'https://support.typefully.com/en/articles/8718287-typefully-api', ['a Typefully API key']),
    preview: (p) => [{ method: 'POST', url: 'https://api.typefully.com/v1/drafts/', body: { content: p.parts.length ? p.parts.join('\n\n\n\n') : p.copy, threadify: false, 'schedule-date': p.date ? `${p.date}T${p.time || '09:00'}` : undefined } }] },
];

// Reddit and Hacker News have no adapter on purpose: post those by hand.
export const MANUAL_ONLY = { reddit: 'Reddit: post by hand (the reminder opens the submit page).', hn: 'Hacker News has no posting API. Post by hand (the reminder opens news.ycombinator.com/submit).' };

export const list = () => ADAPTERS.map(({ preview, ...a }) => ({ ...a, note: COMING }));
export const forPlatform = (platform) => ADAPTERS.filter((a) => a.platforms.includes(platform));
export const previewFor = (post) => forPlatform(post.platform).map((a) => ({ adapter: a.id, name: a.name, status: a.status, requests: a.preview(post) }));

export async function publish() {
  throw Object.assign(new Error(COMING), { code: 'coming' });
}

// where you post by hand, opened at the reminder
export const composeUrl = (p) => ({
  x: 'https://x.com/compose/post',
  linkedin: 'https://www.linkedin.com/feed/?shareActive=true',
  instagram: 'https://www.instagram.com/',
  reddit: 'https://www.reddit.com/r/ClaudeAI/submit',
  hn: 'https://news.ycombinator.com/submit',
}[p.platform]);
