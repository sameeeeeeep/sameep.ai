// status.js — one source for every Wispr product's status chip. Edit status.json, never the pages.
// Any element with data-wstatus="<product>" (wrapped, video, guru, bridge, file, wish, review, pm, social)
// becomes a .w-status chip: Live / Testing / In progress. Also exposes window.WisprStatus.
(() => {
  const URL_ = '/wispr-kit/status.json';
  let p;
  const load = () => (p ||= fetch(URL_, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  const paint = (el, data) => {
    const key = el.dataset.wstatus, s = data && data.products[key], st = s && data.states[s];
    if (!st) { el.hidden = true; return; }
    el.className = `w-status w-status--${s}${el.dataset.wstatusClass ? ' ' + el.dataset.wstatusClass : ''}`;
    el.textContent = st.label; el.title = st.means; el.hidden = false;
    el.setAttribute('aria-label', `Status: ${st.label}. ${st.means}`);
  };
  const fill = async (root = document) => {
    const els = root.querySelectorAll('[data-wstatus]');
    if (!els.length) return;
    const data = await load();
    els.forEach((el) => paint(el, data));
  };
  window.WisprStatus = { load, fill, paint };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => fill());
  else fill();
})();
