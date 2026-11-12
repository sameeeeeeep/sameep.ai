// today.js (module B): Today. A stub until module B lands; see CONTRACT.md in the worker repo for the API
// and the page contract in ../js/app.js (title, pure view(data, ctx), mount(root, ctx)).
import { html } from '../js/ui.js';

export const title = 'Today';

export function view(data, ctx) { // eslint-disable-line no-unused-vars
  return html`<section class="pg"><h1 class="pg-h">Today</h1><p class="pg-sub">Being built.</p></section>`;
}

export async function mount(root, ctx) {
  const data = await ctx.api('GET', `/w/${ctx.wid}/today`);
  root.innerHTML = String(view(data, ctx));
}
