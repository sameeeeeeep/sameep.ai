// power.js — one site, two weights. 'low' is the lighter show for phones and
// small machines (half-resolution talking heads, no hands-on extras); 'high'
// adds the extras (drag the matchbox, fold the plane, push the CD in).
// Picked automatically, overridable with ?power=low|high or Special › Power,
// and remembered once chosen.
const KEY = 'otcv-power';
const store = {
  get() { try { return localStorage.getItem(KEY); } catch { return null; } },
  set(v) { try { localStorage.setItem(KEY, v); } catch { /* private mode: this visit only */ } },
};

function auto() {
  const mm = (q) => typeof matchMedia === 'function' && matchMedia(q).matches;
  const phone = mm('(pointer: coarse)') && Math.min(screen.width, screen.height) < 700;
  const mem = navigator.deviceMemory;
  const save = navigator.connection?.saveData;
  return phone || (mem && mem <= 4) || save || mm('(prefers-reduced-motion: reduce)') ? 'low' : 'high';
}

const q = new URLSearchParams(location.search).get('power');
if (q === 'low' || q === 'high') store.set(q);
const saved = store.get();
export const POWER = saved === 'low' || saved === 'high' ? saved : auto();
export const isLow = POWER === 'low';
document.documentElement.classList.add('power-' + POWER);

// switching reloads: the hero and the sprite sheets are picked at load
// (and the podcast picks up where it was, see resume.js)
export function setPower(v) {
  store.set(v);
  const u = new URL(location.href);
  u.searchParams.delete('power');
  location.replace(u.pathname + u.search + u.hash);
}

// Special › Power: … next to "CRT effect" (same pattern as crtfx.js)
function mount() {
  const special = [...document.querySelectorAll('.menu')].find((m) => /Special/.test(m.querySelector('.menu__btn')?.textContent || ''));
  const list = special?.querySelector('.menu__list');
  if (!list || list.querySelector('.menu__power')) return !!list;
  const item = document.createElement('button');
  item.type = 'button'; item.className = 'menu__item menu__power'; item.setAttribute('role', 'menuitem');
  item.textContent = POWER === 'low' ? 'Power: low (switch to high)' : 'Power: high (switch to low)';
  item.title = 'High adds the hands-on extras and full-resolution faces. Low is lighter, for phones.';
  item.onclick = () => setPower(POWER === 'low' ? 'high' : 'low');
  const li = document.createElement('li'); li.setAttribute('role', 'none'); li.append(item);
  list.prepend(li);
  return true;
}
const mo = new MutationObserver(() => { if (mount()) mo.disconnect(); });
mo.observe(document.documentElement, { childList: true, subtree: true });
