// crtfx.js — the CRT look after boot, and the switch for it. The 1998 iMac had a
// 15" shadow-mask tube, so by default the desktop and podcast keep the boot's
// weight: the glass shader at full strength (js/app/crt.js) plus a little RGB
// convergence fringe and phosphor glow on the text (css/crt.css). The "CRT"
// button in the menu bar (Special › CRT effect on phones) turns it off; remembered.
const KEY = 'otcv-crt';
const read = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } };
const write = (on) => { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private mode: this visit only */ } };

let on = read();
let btn = null, item = null;

function apply() {
  document.documentElement.classList.toggle('crt-full', on);
  document.documentElement.classList.toggle('crt-plain', !on);
  window.__otcvCrt?.setStrength(on ? 1 : -1);
  if (item) item.textContent = on ? 'CRT effect: on' : 'CRT effect: off';
  if (btn) { btn.setAttribute('aria-pressed', String(on)); btn.classList.toggle('is-off', !on); btn.title = on ? 'CRT effect on (click to turn off)' : 'CRT effect off (click to turn on)'; }
}

function mount() {
  const right = document.querySelector('.menubar__right');
  if (!right || right.querySelector('.menubar__crt')) return;
  btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'menubar__crt';
  btn.textContent = 'CRT';
  btn.setAttribute('aria-label', 'CRT effect');
  btn.onclick = () => { on = !on; write(on); apply(); };
  right.insertBefore(btn, right.querySelector('.menubar__sound') || null);
  // and in Special, which is reachable on phones where the bar's right side is cut off
  const special = [...document.querySelectorAll('.menu')].find((m) => /Special/.test(m.querySelector('.menu__btn')?.textContent || ''));
  const list = special?.querySelector('.menu__list');
  if (list) {
    item = document.createElement('button');
    item.type = 'button'; item.className = 'menu__item'; item.setAttribute('role', 'menuitem');
    item.onclick = () => { on = !on; write(on); apply(); special.classList.remove('is-open'); special.querySelector('.menu__btn').setAttribute('aria-expanded', 'false'); };
    const li = document.createElement('li'); li.setAttribute('role', 'none'); li.append(item);
    list.prepend(li);
  }
  apply();
}

apply();
// the menu bar and the CRT appear after boot: watch for them once, then let go
const mo = new MutationObserver(() => { if (window.__otcvCrt && !apply.crt) { apply.crt = true; apply(); } mount(); if (btn) mo.disconnect(); });
mo.observe(document.documentElement, { childList: true, subtree: true });
