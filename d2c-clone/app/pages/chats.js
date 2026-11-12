// chats.js (module B): Chats. A stub until module B lands; see CONTRACT.md in the worker repo for the API
// and the page contract in ../js/app.js (title, pure view(data, ctx), mount(root, ctx)).
import { html } from '../js/ui.js';

export const title = 'Chats';

export function view(data, ctx) { // eslint-disable-line no-unused-vars
  return html`<section class="pg"><h1 class="pg-h">Chats</h1><p class="pg-sub">Being built.</p></section>`;
}

export async function mount(root, ctx) {
  const data = await ctx.api('GET', `/w/${ctx.wid}/chats`);
  root.innerHTML = String(view(data, ctx));
}
