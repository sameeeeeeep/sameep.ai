// gos/index.js — the extra Growth OS modules, one file per area. Each file exports MODULES
// ([{ id, label, c, group, render }]); a file that fails to load is skipped, not fatal.
const FILES = ['ideas', 'brand', 'partners', 'events', 'wrapped'];

export async function extraModules() {
  const got = await Promise.allSettled(FILES.map((f) => import(`./${f}.js`)));
  return got.flatMap((r, i) => {
    if (r.status === 'fulfilled') return r.value.MODULES || [];
    console.warn('[growth os] module file failed:', FILES[i], r.reason);
    return [];
  });
}
