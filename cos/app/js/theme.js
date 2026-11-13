// theme.js: light and dark. The page follows prefers-color-scheme until the person picks one with the top-bar
// button; the pick is kept in localStorage (when storage is blocked the page still follows the system).
// index.html sets data-theme on <html> before first paint with the same rule (a few inline lines), so there is
// no flash; this module binds the button and follows system changes while no pick is saved.
export const KEY = 'bc-theme';

// Pure: the theme to show. saved: 'light' | 'dark' | anything else (no pick). systemLight: boolean.
// Light is the default; dark is an option the person picks (systemLight is kept for callers, no longer decides).
export function resolveTheme(saved, systemLight) { // eslint-disable-line no-unused-vars
  return saved === 'dark' ? 'dark' : 'light';
}

// Pure: what one press does. Flips the shown theme; when the new theme matches the system the pick is
// dropped (save: null) so the page goes back to following it.
export function toggleTheme(current, systemLight) { // eslint-disable-line no-unused-vars
  const theme = current === 'light' ? 'dark' : 'light';
  return { theme, save: theme === 'light' ? null : theme };
}

// Pure: the button's label and icon for the theme on screen (it offers the other one).
const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
export function buttonFor(theme) {
  return theme === 'light'
    ? { label: 'Switch to dark mode', icon: MOON }
    : { label: 'Switch to light mode', icon: SUN };
}

export const THEME_COLOR = { dark: '#0b0c0a', light: '#f4f3ef' };

if (typeof document !== 'undefined') bind();

function bind() {
  const root = document.documentElement;
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  const sysLight = () => !!(mq && mq.matches);
  const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const write = (v) => { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); } catch { /* storage blocked */ } };

  function apply(theme) {
    root.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = THEME_COLOR[theme];
    const btn = document.getElementById('theme-btn');
    if (btn) { const b = buttonFor(theme); btn.innerHTML = b.icon; btn.setAttribute('aria-label', b.label); btn.title = b.label; }
  }

  apply(resolveTheme(read(), sysLight()));
  if (mq) {
    const onSys = () => { if (resolveTheme(read(), true) === resolveTheme(read(), false)) return; apply(resolveTheme(read(), sysLight())); };
    if (mq.addEventListener) mq.addEventListener('change', onSys); else if (mq.addListener) mq.addListener(onSys);
  }
  const btn = document.getElementById('theme-btn');
  if (btn) btn.addEventListener('click', () => {
    const t = toggleTheme(root.dataset.theme === 'light' ? 'light' : 'dark', sysLight());
    write(t.save);
    apply(t.theme);
  });
}
