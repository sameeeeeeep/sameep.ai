// canvas.js: Canvas, where documents, images and artifacts open full. A grid of what the work produced (product
// shots, and the records: POs, invoices, QC batches, stock, orders, tasks), and any one of them full size.
// Routes: #/w/<wid>/canvas                 the grid
//         #/w/<wid>/canvas/shot/<n>        one image, full
//         #/w/<wid>/canvas/doc/<ref>       one record as a document, full
import { html, raw, num } from '../js/ui.js';
import { live } from '../js/cos.js';
import { brandOf } from '../js/look.js';
import { href } from '../js/journey.js';
import { loadJourney } from './products.js';

export const title = 'Canvas';
const KIND = { po: 'Purchase order', invoice: 'Invoice', qc: 'QC batch', stock: 'Stock', order: 'Order', task: 'Task' };
const STATUS = { draft: 'Draft', approved: 'Approved', held: 'On hold', rejected: 'Rejected', checked: 'Checked' };
const SHOTS = [['hero', 'Product shot'], ['variants3', 'The range'], ['box_flat', 'Carton, flat'], ['carton_top', 'Shipper carton'], ['kit_flatlay', 'Trial kit'], ['trials5', 'Trials'], ['qc', 'QC sample'], ['parcel', 'Parcel'], ['hero_boxed', 'In its box']];
const FN_THREAD = { procurement: 'ops', qc: 'ops', packaging: 'ops', warehouse: 'ops', logistics: 'ops', npd: 'ops', finance: 'finance', support: 'support', crm: 'support', brand: 'content' };
const rs = (paise) => `₹${Math.round(paise || 0).toLocaleString('en-IN')}`;

// Pure: the images on the canvas. A sample brand's shots are static files; a private brand's come from its pack.
export function shotsFor(ws, products = [], pics = {}) {
  const b = brandOf(ws);
  if (b) return SHOTS.map(([k, title]) => ({ src: `./assets/products/${b}/${k}.webp`, title }));
  return products.filter((p) => pics[p.id]).map((p) => ({ src: pics[p.id], title: p.name }));
}

function doc(r, wid) {
  const rows = [['Status', STATUS[r.status] || r.status], r.qty != null && ['Quantity', num(r.qty)], r.amount != null && ['Amount', rs(r.amount)],
    r.data?.vendor && ['Vendor', r.data.vendor], r.data?.location && ['Where', r.data.location], r.maker && ['Made by', r.maker]].filter(Boolean);
  const chat = href(wid, { thread: FN_THREAD[r.fn] || 'all-hands', kind: r.kind, ref: r.ref });
  return html`<article class="cv-doc">
    <p class="cv-doc-k">${KIND[r.kind] || r.kind} <span class="mono">${r.ref}</span></p>
    <h2>${r.title}</h2>
    <dl>${rows.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>
    <a class="cv-open" href="${chat}">Open it in its module</a>
  </article>`;
}

// Pure. data = { products, records, pics }; ui = { kind, id }
export function view(data, ctx, ui = {}) {
  const ws = ctx.ws || {};
  const wid = encodeURIComponent(ctx.wid);
  const base = `#/w/${wid}/canvas`;
  const shots = shotsFor(ws, data.products, data.pics);
  const recs = (data.records || []).slice().sort((a, b) => (b.updated || b.ts || 0) - (a.updated || a.ts || 0));
  if (ui.kind === 'shot' && shots[Number(ui.id)]) {
    const s = shots[Number(ui.id)];
    return html`<section class="pg cv"><a class="cv-back" href="${base}">Canvas</a>
      <figure class="cv-full"><img src="${s.src}" alt="${s.title}"><figcaption>${s.title}</figcaption></figure></section>`;
  }
  if (ui.kind === 'doc') {
    const r = recs.find((x) => x.ref === ui.id);
    if (r) return html`<section class="pg cv"><a class="cv-back" href="${base}">Canvas</a><div class="cv-full is-doc">${doc(r, ctx.wid)}</div></section>`;
  }
  return html`<section class="pg cv">
    <header class="pj-head"><h1 class="pg-h">Canvas</h1>${ws.demo ? html`<span class="sample-tag">Sample data</span>` : ''}</header>
    ${shots.length ? html`<h2 class="cv-h">Images</h2><ul class="cv-grid is-shots">${shots.map((s, i) => html`<li><a href="${base}/shot/${i}"><img src="${s.src}" alt="" loading="lazy"><span>${s.title}</span></a></li>`)}</ul>` : ''}
    <h2 class="cv-h">Documents</h2>
    ${recs.length ? html`<ul class="cv-grid is-docs">${recs.map((r) => html`<li><a href="${base}/doc/${encodeURIComponent(r.ref)}">
        <span class="cv-k">${KIND[r.kind] || r.kind} <span class="mono">${r.ref}</span></span>
        <b>${r.title}</b>
        <span class="cv-s">${STATUS[r.status] || r.status}${r.amount != null ? raw(`, <span class="mono">${rs(r.amount)}</span>`) : ''}</span>
      </a></li>`)}</ul>` : html`<p class="tk-empty">No documents yet.</p>`}
  </section>`;
}

export async function mount(root, ctx) {
  const [kind, id] = ctx.params || [];
  let data = null;
  const load = async () => { data = await loadJourney(ctx); };
  const paint = () => { root.innerHTML = String(view(data, ctx, { kind, id })); };
  await load(); paint();
  return live(ctx, async () => { try { await load(); paint(); } catch { /* next tick */ } });
}
