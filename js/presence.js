// presence.js — "N in the room": a heartbeat to sameep.ai/api/here every 30s while the tab is
// visible; the Worker answers with how many visitors it has seen in the last 90s. Only the
// random visitor id analytics already uses is sent. Fire-and-forget: a failure just hides the count.
const LIVE = /(^|\.)sameep\.ai$/.test(location.hostname);
const URL_ = '/api/here';  // same origin only: local runs show no count (and never touch the live room)
const vid = () => { try { return localStorage.getItem('otcv-vid'); } catch { return null; } };

export function presence(onCount) {
  if (!LIVE) return () => {};
  let stop = false, t = 0;
  const beat = async () => {
    if (stop) return;
    if (!document.hidden) {
      try {
        const r = await fetch(URL_, { method: 'POST', body: JSON.stringify({ vid: vid(), site: LIVE ? 'live' : 'dev' }), keepalive: true });
        if (r.ok) onCount((await r.json()).n);
      } catch { /* offline: keep the last count */ }
    }
    t = setTimeout(beat, 30000);
  };
  beat();
  return () => { stop = true; clearTimeout(t); };
}
