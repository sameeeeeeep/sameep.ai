// journey.js: every product's road from idea to doorstep, as data. Pure: the Worker's records, people and plan in,
// products out; pages/products.js draws them and pages/dash.js shows the summary tile.
//
//   STAGES          the 10 stages, each with its module (#ideas, #npd ...) and its one-line goal
//   MODS            each module's look (one muted tint and a stroke icon, the same as the landing's board) and the
//                   app chat it lives in
//   build(input)    -> [product]. input = { brand, records, people, plan, presence, today, pack }
//                   pack: a private workspace's own `journey` block (GET /w/:wid/brandpack, members only); without it
//                   a public sample brand's products are derived from its records (PO-L01, QC-LL*, UF-*, T-*, ORD-*)
//
// A product: { id, name, cat, img, color, kind, stage (0-9), today, days[10], status, tone, pct,
//              lists[10]: [line], record: [{k, v, at, link}] }
// A line:    { t, by: {agent} | {person}, st: 'done' | 'working' | 'queued' | 'call', note, link, pct }
//            st 'call' is a person's decision (their call); a done call keeps who decided and what.
// A link:    { thread, kind?, ref? } -> #/w/<wid>/chat/<thread>[/records/<kind>/<ref>]

export const STAGES = [
  { key: 'idea',       label: 'Idea',        mod: 'ideas',     goal: 'Hear the ask and score it before anyone spends a rupee.' },
  { key: 'concept',    label: 'Concept',     mod: 'npd',       goal: 'Say what it is, who it is for and what it costs.' },
  { key: 'design',     label: 'Design',      mod: 'npd',       goal: 'Pick the pack people want to hold.' },
  { key: 'sourcing',   label: 'Sourcing',    mod: 'npd',       goal: 'Lock the spec and the vendor who can make it.' },
  { key: 'production', label: 'Production',  mod: 'logistics', goal: 'Make it, pass QC and get it on a truck.' },
  { key: 'warehouse',  label: 'Warehouse',   mod: 'warehouse', goal: 'Count it in, check it and kit it.' },
  { key: 'live',       label: 'Live',        mod: 'listing',   goal: 'Put it on every channel at one price.' },
  { key: 'marketing',  label: 'Marketing',   mod: 'marketing', goal: 'Tell people, and keep the cut that sells.' },
  { key: 'orders',     label: 'Orders',      mod: 'logistics', goal: 'Every order out the same day.' },
  { key: 'loop',       label: 'Loop closed', mod: 'crm',       goal: 'Hear back, restock, and start the next one.' },
];

// Icons are 16 x 16 stroke paths, the landing's set (reverse/story.js LOOK); tints are muted and work on both themes.
export const MODS = {
  ideas:     { name: 'ideas',     tint: '#9a6b1f', thread: 'all-hands',   icon: 'M8 1.5a4.5 4.5 0 0 0-2.6 8.2V12h5.2V9.7A4.5 4.5 0 0 0 8 1.5zM6 13.5h4M6.6 15h2.8' },
  npd:       { name: 'npd',       tint: '#6c4f93', thread: 'ops',         icon: 'M2.5 3.5h11v9h-11zM2.5 6.5h11M6 6.5v6' },
  logistics: { name: 'logistics', tint: '#2d6a86', thread: 'ops',         icon: 'M1.5 4.5h8v6h-8zM9.5 7h3l2 2v1.5h-5M4 12.5a1.2 1.2 0 1 0 .01 0M11.5 12.5a1.2 1.2 0 1 0 .01 0' },
  warehouse: { name: 'warehouse', tint: '#66622f', thread: 'ops',         icon: 'M1.5 6.5 8 2.5l6.5 4v7h-13zM5 13.5v-4h6v4' },
  listing:   { name: 'listing',   tint: '#2f7556', thread: 'website',     icon: 'M2.5 2.5h11v11h-11zM5 5.5h6M5 8h6M5 10.5h3.5' },
  marketing: { name: 'marketing', tint: '#9c4466', thread: 'content',     icon: 'M2.5 9.5V6.5l8-3.5v10l-8-3.5zM10.5 6v4M4.5 9.5l1 4h2l-.8-3.6' },
  crm:       { name: 'crm',       tint: '#3d58a8', thread: 'support',     icon: 'M8 8a2.8 2.8 0 1 0 0-5.6A2.8 2.8 0 0 0 8 8zM2.5 14c.8-2.8 3-4.2 5.5-4.2s4.7 1.4 5.5 4.2' },
};
// which chat a record's function lives in (the Worker's world functions -> chat groups)
const FN_THREAD = { brand: 'content', npd: 'ops', procurement: 'ops', qc: 'ops', packaging: 'ops', warehouse: 'ops', logistics: 'ops',
  channels: 'website', website: 'website', performance: 'performance', influencer: 'content', content: 'content', crm: 'support',
  support: 'support', finance: 'finance', people: 'all-hands', analytics: 'all-hands' };

export const href = (wid, l) => {
  if (!l || !l.thread) return null;
  const w = encodeURIComponent(wid);
  return l.ref ? `#/w/${w}/chat/${encodeURIComponent(l.thread)}/records/${encodeURIComponent(l.kind || 'all')}/${encodeURIComponent(l.ref)}`
    : `#/w/${w}/chat/${encodeURIComponent(l.thread)}`;
};
const recLink = (r) => (r ? { thread: FN_THREAD[r.fn] || 'all-hands', kind: r.kind, ref: r.ref } : null);
const modLink = (mod) => ({ thread: MODS[mod]?.thread || 'all-hands' });

// ---------------------------------------------------------------- the public sample brands (all made up)
// Only what the records do not carry: the idea that comes next, the vendor's name, the early numbers.
export const SAMPLE = {
  ohra: { cat: 'Lips', vendor: 'Sethi Cosmetics', format: 'Glass tube, doe-foot wand', liveFormat: 'Squeeze tube, 6 ml', poll: 412, score: '8.2 / 10',
    liveScore: '7.6 / 10', livePoll: 288, liveUnits: 5000, reach: '1.1M', orders: '3,904', rating: '4.6 from 212 reviews', color: '#b4553d', liveColor: '#8f3b2c',
    idea: { name: 'Plum lip liner', no: 24, dms: 64, score: '7.1 / 10', color: '#6b2f3a', from: 'DMs after the Brick Dust reel' } },
  ondri: { cat: 'Home', vendor: 'Kasturi Aromatics', format: 'Amber glass, fine-mist pump', liveFormat: 'Amber glass, 100 ml', poll: 366, score: '7.9 / 10',
    liveScore: '7.4 / 10', livePoll: 241, liveUnits: 4000, reach: '860K', orders: '2,711', rating: '4.5 from 168 reviews', color: '#7d8a6a', liveColor: '#5f6b4c',
    idea: { name: 'Rain-on-clay candle', no: 19, dms: 52, score: '6.8 / 10', color: '#a07a5c', from: 'replies to the monsoon mailer' } },
  siro: { cat: 'Coffee', vendor: 'Nandi Hills Roasters', format: '250 ml can, matte sleeve', liveFormat: '250 ml can', poll: 398, score: '8.0 / 10',
    liveScore: '7.7 / 10', livePoll: 305, liveUnits: 6000, reach: '1.3M', orders: '4,486', rating: '4.7 from 241 reviews', color: '#6a4a33', liveColor: '#3e2c22',
    idea: { name: 'Cascara soda', no: 31, dms: 77, score: '7.3 / 10', color: '#a3502c', from: 'café partners asking for a non-coffee can' } },
};

// ---------------------------------------------------------------- helpers
const num = (n) => Number(n || 0).toLocaleString('en-IN');
const lead = (t) => String(t || '').split(',')[0].trim();
const stRec = (r) => (!r ? 'queued' : r.status === 'checked' ? 'done' : r.status === 'approved' ? 'working' : 'call');

// a person for a role key, from the workspace's people; the first that exists wins
export function who(people, ...roles) {
  for (const r of roles) if (people?.[r] && !people[r].placeholder) return people[r].name;
  return null;
}
// what an agent is doing right now (presence), when it has done something lately
function doing(presence, agent) {
  const a = (presence?.running?.agents || []).find((x) => x.name === agent);
  return a && a.ts ? a.now : null;
}

// ---------------------------------------------------------------- the checklists
// One list per stage, owners mixed: agents (plain names) and people (faces). `s` = the product's state at that stage:
// 'past' (every line done), 'now' (lines carry their real state), 'next' (every line queued).
const A = (agent) => ({ agent });
const Pn = (person) => (person ? { person } : A('Chief of staff'));

function listsFor(p, ctx) {
  const { people, recs } = ctx;
  const founder = who(people, 'founder') || 'Founder';
  const growth = who(people, 'growth', 'content', 'influencer') || founder;
  const ops = who(people, 'ops', 'warehouse') || founder;
  const quality = who(people, 'quality', 'analyst') || founder;
  const cos = who(people, 'cos') || founder;
  const u = p.unit, n = p.range || 6;
  const r = (ref) => recs[ref] || null;
  const L = (t, by, o = {}) => ({ t, by, st: o.st || 'queued', note: o.note || null, link: o.link || null, call: !!o.call, choice: o.choice || null, pct: o.pct ?? null, raised: o.raised || null });
  const call = (t, person, choice, o = {}) => L(t, Pn(person), { ...o, call: true, choice });
  const qc = Object.values(recs).filter((x) => x.kind === 'qc');
  const passed = qc.filter((x) => x.status === 'checked').length;

  const base = [
    // idea
    [L(`Turned the ask into idea #${p.ideaNo}`, A('Chief of staff'), { link: modLink('ideas') }),
     L(`Counted ${p.dms} DMs and searches asking for it`, A('Brand agent'), { link: modLink('ideas') }),
     L(`Scored it ${p.score}`, A('Chief of staff'), { link: modLink('ideas') }),
     call('Open it as a concept in #npd', founder, 'Opened it')],
    // concept
    [L('Concept: what it is, who it is for, the price', A('Brand agent'), { link: modLink('npd') }),
     L('Scanned 9 products like it', A('NPD agent'), { link: modLink('npd') }),
     L(`Polled the waitlist on the ${u}s (${num(p.poll)} replies)`, Pn(growth), { link: modLink('npd') }),
     call('Go on the concept', founder, 'Go')],
    // design
    [L('Three pack mockups for a story poll', A('Brand agent'), { link: modLink('npd') }),
     L('Dielines for the pack and the carton', A('Packaging agent'), { link: modLink('npd') }),
     L('Ran the story poll on the mockups', Pn(growth), { link: modLink('npd') }),
     call('Pick the pack', founder, p.format)],
    // sourcing
    [L('Quotes from 7 vendors, 3 qualified', A('Procurement agent'), { link: recLink(r('PO-L01')) || modLink('npd') }),
     L('Spec sheet v1 locked', A('NPD agent'), { link: modLink('npd') }),
     L(`Tested samples of all ${n} ${u}s`, Pn(quality), { link: modLink('npd') }),
     call('Pick the vendor', founder, p.vendor, { link: recLink(r('PO-L01')) })],
  ];
  const prod = p.kind === 'launch' ? [
    L(`${r('PO-L01')?.ref || 'PO'} sent: ${num(r('PO-L01')?.qty || p.units)} units, ${n} ${u}s`, A('Procurement agent'), { st: stRec(r('PO-L01')) === 'call' ? 'working' : stRec(r('PO-L01')), link: recLink(r('PO-L01')) }),
    L('Paid the 30% advance', A('Finance agent'), { st: stRec(r('ADV-L01')) === 'call' ? 'working' : stRec(r('ADV-L01')), link: recLink(r('ADV-L01')) }),
    L(`Pre-dispatch QC: ${passed} of ${qc.length || n} ${u}s passed`, A('QC agent'), { st: qc.length && passed === qc.length ? 'done' : 'working', pct: qc.length ? passed / qc.length : 0, link: qc[0] ? { thread: FN_THREAD.qc, kind: 'qc' } : null }),
    call(r('T-PROOF')?.title || 'Approve the printer proof', cos, null, { st: stRec(r('T-PROOF')), link: recLink(r('T-PROOF')), raised: 'Packaging agent' }),
    call(r('T-LABEL') ? `${r('T-LABEL').title}: can the claim go on the pack?` : 'Label claims', quality, null, { st: stRec(r('T-LABEL')), link: recLink(r('T-LABEL')), raised: 'NPD agent' }),
    call(r('T-NAME6')?.title || `Name the last ${u}`, founder, null, { st: stRec(r('T-NAME6')), link: recLink(r('T-NAME6')), raised: 'Brand agent' }),
    call(r('PO-L02') ? `Approve ${r('PO-L02').ref}: ${r('PO-L02').title.toLowerCase()}` : 'Approve the trial-kit PO', cos, null, { st: stRec(r('PO-L02')), link: recLink(r('PO-L02')), raised: 'Procurement agent' }),
  ] : [
    L(`PO sent: ${num(p.units)} units`, A('Procurement agent'), { link: modLink('logistics') }),
    L('Paid the advance', A('Finance agent'), { link: modLink('logistics') }),
    L(`Pre-dispatch QC on all ${n} ${u}s`, A('QC agent'), { link: modLink('logistics') }),
    call('Approve the printer proof', cos, 'Approved'),
  ];
  const rest = [
    // warehouse
    [L('Book the dock slot and the GRN', A('Ops agent'), { link: modLink('warehouse') }),
     L('Count and scan the inbound', Pn(ops), { link: modLink('warehouse') }),
     L('Inbound QC, 1 in 50', A('QC agent'), { link: modLink('warehouse') }),
     L('Kitting run, 2,000 trial kits', A('Packaging agent'), { link: recLink(r('PO-L02')) || modLink('warehouse') })],
    // live
    [L('List on the site and 4 marketplaces', A('Channels agent'), { link: modLink('listing') }),
     L('Product page and price parity', A('Website agent'), { link: modLink('listing') }),
     call('Go live', founder, 'Live on 5 of 5')],
    // marketing
    [L('Shoot board and 12 posts', A('Content agent'), { link: modLink('marketing') }),
     L('Seed 60 creator boxes', A('Influencer agent'), { link: modLink('marketing') }),
     L('Three launch ad cuts', A('Performance agent'), { link: modLink('marketing') }),
     call('Pick the cut to scale', growth, 'The creator cut')],
    // orders
    [L('Same-day dispatch on every order', A('Ops agent'), { link: modLink('logistics') }),
     L('Pack and scan the first 112', Pn(ops), { link: modLink('logistics') }),
     L('Where-is-my-order replies under 10 min', A('Support agent'), { link: recLink(r('ORD-10560')) || modLink('logistics') })],
    // loop closed
    p.kind === 'live' ? [
      L('Day-7 check-ins and review asks', A('CRM agent'), { st: 'done', link: modLink('crm') }),
      L(r('ORD-10482') ? `${r('ORD-10482').title}: refunded and called` : 'Answered every review', A('Support agent'), { st: r('ORD-10482') ? stRec(r('ORD-10482')) : 'done', link: recLink(r('ORD-10482')) || modLink('crm') }),
      L(`Cover is down to ${p.cover || 'a few'} days`, A('Ops agent'), { st: 'done', link: recLink(r(p.stockRef)) || modLink('warehouse') }),
      call(r('PO-CB03') ? `Approve the restock: ${r('PO-CB03').title}` : 'Restock', ops, null, { st: r('PO-CB03') ? stRec(r('PO-CB03')) : 'working', link: recLink(r('PO-CB03')) || modLink('warehouse'), raised: 'Ops agent' }),
      call(`Open the next idea, ${p.next || 'the next one'}`, founder, null, { st: 'working', link: modLink('ideas') }),
    ] : [
      L('Day-7 check-ins and review asks', A('CRM agent'), { link: modLink('crm') }),
      L('Answer every review', A('Support agent'), { link: modLink('crm') }),
      L('Reorder at 10 days of cover', A('Ops agent'), { link: modLink('warehouse') }),
      call('Open the next idea', founder, null)],
  ];
  return [...base, prod, ...rest];
}

// past stages: every line done (a call keeps its choice); future: queued; now: as built
function settle(lists, stage) {
  return lists.map((list, i) => list.map((l) => {
    if (i < stage) return { ...l, st: 'done' };
    if (i > stage) return { ...l, st: 'queued' };
    return l;
  }));
}

// a public sample brand's products, from its own records
function sampleProducts(input) {
  const { brand, records = [], people = {}, plan, today = 18 } = input;
  const b = SAMPLE[brand] || SAMPLE.ohra;
  const recs = Object.fromEntries(records.map((r) => [r.ref, r]));
  const ctx = { people, recs };
  const po = recs['PO-L01'], inc = recs['UF-LL-ALL'], st = recs['UF-CB-01'], ds = recs['UF-CB-01-DS'];
  const rangeM = String(inc?.title || '').match(/(\d+)\s+([a-z]+?)s\b/i) || String(po?.title || '').match(/(\d+)\s+([a-z]+?)s\s*$/i);
  const range = rangeM ? Number(rangeM[1]) : 6, unit = rangeM ? rangeM[2].toLowerCase() : 'shade';
  const qc = records.filter((r) => r.kind === 'qc');
  const passed = qc.filter((r) => r.status === 'checked');
  const ms = Object.fromEntries((plan?.milestones || []).map((m) => [m.key, m.day]));
  const launchDay = plan?.launch || 42;

  // 1. the launch: in production today
  const launchName = lead(po?.title) || 'The launch';
  const L1 = { id: 'launch', kind: 'launch', name: launchName, cat: b.cat, color: b.color, img: 'variants3', stage: 4, today,
    days: [1, 3, 6, 11, 15, ms.grn || 30, ms.listings || 36, ms.campaigns || 38, launchDay, launchDay + 7],
    status: `Launch day ${launchDay}`, tone: 'acc', unit, range, poll: b.poll, score: b.score, format: b.format, vendor: b.vendor,
    units: po?.qty || 6000, ideaNo: 12, dms: 318, next: b.idea.name };
  L1.lists = settle(listsFor(L1, ctx), L1.stage);
  const qcRefs = { thread: FN_THREAD.qc, kind: 'qc' };
  L1.record = [
    { k: 'Idea score', v: b.score, at: 0, link: modLink('ideas') },
    { k: 'Poll replies', v: num(b.poll), at: 1, link: modLink('npd') },
    { k: 'Pack', v: b.format, at: 2, link: modLink('npd') },
    { k: 'Vendor', v: b.vendor, at: 3, link: recLink(po) },
    { k: 'Range', v: `${range} ${unit}s`, at: 3, link: recLink(recs['T-NAME6']) || modLink('npd') },
    { k: 'Units made', v: qc.length ? `${num(passed.reduce((a, r) => a + (r.qty || 0), 0))} passed QC` : null, at: 4, link: qcRefs },
    { k: 'In stock', v: inc && inc.qty ? num(inc.qty) : null, at: 5, link: recLink(inc) },
    { k: 'Channels live', v: null, at: 6, link: modLink('listing') },
    { k: 'Reach', v: null, at: 7, link: modLink('marketing') },
    { k: 'Orders', v: null, at: 8, link: modLink('logistics') },
    { k: 'Rating', v: null, at: 9, link: modLink('crm') },
  ];

  // 2. the one already selling: the loop is closing, a restock is moving
  const liveName = lead(st?.title) || 'Bestseller';
  const onHand = (st?.qty || 0) + (ds?.qty || 0);
  const perDay = st?.data?.per_day || 0; // cover is the main warehouse's, as the Ops agent counts it
  const L2 = { id: 'live', kind: 'live', name: liveName, cat: b.cat, color: b.liveColor, img: 'hero', stage: 9, today: 96,
    days: [1, 4, 9, 15, 28, 44, 50, 51, 52, 60], status: 'Live, restock moving', tone: 'ok', unit, range: 1, poll: b.livePoll,
    score: b.liveScore, format: b.liveFormat, vendor: b.vendor, units: b.liveUnits, ideaNo: 3, dms: 140, stockRef: 'UF-CB-01',
    cover: perDay ? Math.floor((st?.qty || 0) / perDay) : null, next: b.idea.name };
  L2.lists = settle(listsFor(L2, ctx), L2.stage);
  L2.record = [
    { k: 'Idea score', v: b.liveScore, at: 0, link: modLink('ideas') },
    { k: 'Poll replies', v: num(b.livePoll), at: 1, link: modLink('npd') },
    { k: 'Pack', v: b.liveFormat, at: 2, link: modLink('npd') },
    { k: 'Vendor', v: b.vendor, at: 3, link: recLink(recs['PO-CB03']) || modLink('npd') },
    { k: 'Range', v: 'One', at: 3, link: modLink('npd') },
    { k: 'Units made', v: num(b.liveUnits), at: 4, link: modLink('logistics') },
    { k: 'In stock', v: st ? `${num(onHand)}${L2.cover != null ? `, ${L2.cover} days` : ''}` : null, at: 5, link: recLink(st) },
    { k: 'Channels live', v: '5 of 5', at: 6, link: modLink('listing') },
    { k: 'Reach', v: b.reach, at: 7, link: modLink('marketing') },
    { k: 'Orders', v: b.orders, at: 8, link: recLink(recs['ORD-10482']) || modLink('logistics') },
    { k: 'Rating', v: b.rating, at: 9, link: modLink('crm') },
  ];

  // 3. the next idea: still being heard
  const i = b.idea;
  const L3 = { id: 'idea', kind: 'idea', name: i.name, cat: b.cat, color: i.color, img: null, stage: 0, today: 2,
    days: [1, null, null, null, null, null, null, null, null, null], status: `Idea #${i.no}, ${i.dms} asks`, tone: 'warn', unit, range,
    poll: 0, score: i.score, format: '', vendor: '', units: 0, ideaNo: i.no, dms: i.dms, from: i.from };
  const lists3 = settle(listsFor(L3, ctx), 0);
  lists3[0] = lists3[0].map((l, k) => ({ ...l, st: k < 2 ? 'done' : k === 2 ? 'working' : 'call', choice: k === 3 ? null : l.choice,
    t: k === 2 ? `Scoring it against the last ${i.no - 1} ideas` : l.t, note: k === 0 ? `From ${i.from}` : l.note }));
  L3.lists = lists3;
  L3.record = [
    { k: 'Idea score', v: null, at: 0, link: modLink('ideas'), soon: 'Scoring' },
    { k: 'Poll replies', v: null, at: 1, link: modLink('npd') },
    { k: 'Pack', v: null, at: 2, link: modLink('npd') },
    { k: 'Vendor', v: null, at: 3, link: modLink('npd') },
    { k: 'Range', v: null, at: 3, link: modLink('npd') },
    { k: 'Units made', v: null, at: 4, link: modLink('logistics') },
    { k: 'In stock', v: null, at: 5, link: modLink('warehouse') },
    { k: 'Channels live', v: null, at: 6, link: modLink('listing') },
    { k: 'Reach', v: null, at: 7, link: modLink('marketing') },
    { k: 'Orders', v: null, at: 8, link: modLink('logistics') },
    { k: 'Rating', v: null, at: 9, link: modLink('crm') },
  ];
  return [L1, L2, L3];
}

// A private workspace's own block (its brand pack): products given in full, each line's owner named. Records it
// names by ref fill their status (and the link) from the workspace's records when they exist.
function packProducts(input) {
  const { pack, records = [] } = input;
  const recs = Object.fromEntries(records.map((r) => [r.ref, r]));
  const fix = (l) => {
    if (!l) return null;
    const r = l.ref ? recs[l.ref] : null;
    if (l.ref && !r) return l.mod ? modLink(l.mod) : null;
    return r ? recLink(r) : l.thread ? { thread: l.thread } : l.mod ? modLink(l.mod) : null;
  };
  return (pack.products || []).map((p) => {
    const stage = Math.max(0, Math.min(9, Number(p.stage) || 0));
    const lists = STAGES.map((_, i) => (p.lists?.[i] || []).map((l) => ({
      t: l.t, by: l.agent ? { agent: l.agent } : { person: l.person }, raised: l.raised || null, call: !!l.call, choice: l.choice || null, note: l.note || null,
      pct: l.pct ?? null, link: fix(l.link) || modLink(STAGES[i].mod),
      st: i < stage ? 'done' : i > stage ? 'queued' : (l.st || 'working'),
    })));
    return { id: p.id, kind: p.kind || 'launch', name: p.name, cat: p.cat || '', color: p.color || '#7a6a64', img: p.img || null,
      stage, today: p.today || 1, days: p.days || Array(10).fill(null), status: p.status || '', tone: p.tone || 'acc', lists,
      record: (p.record || []).map((x) => ({ k: x.k, v: x.v ?? (x.qtyOf && recs[x.qtyOf] ? num(recs[x.qtyOf].qty) : null), at: x.at ?? 0, link: fix(x.link) || null, soon: x.soon || null })) };
  });
}

export function build(input = {}) {
  const list = input.pack && Array.isArray(input.pack.products) ? packProducts(input) : input.brand ? sampleProducts(input) : [];
  return list.map((p) => ({ ...p, pct: progress(p) }));
}

// how far along: done stages, plus the share of the current stage's lines that are done
export function progress(p) {
  const cur = p.lists?.[p.stage] || [];
  const part = cur.length ? cur.filter((l) => l.st === 'done').length / cur.length : 0;
  return Math.min(1, (p.stage + part) / STAGES.length);
}

// the Now card: the current stage, its people, the agents at work and what each is doing, and what comes next
export function now(p, presence) {
  const i = p.stage, st = STAGES[i];
  const lines = p.lists[i] || [];
  const people = [...new Set(lines.filter((l) => l.by.person).map((l) => l.by.person))];
  const open = lines.filter((l) => l.st !== 'done');
  const owned = (l) => l.by.agent || l.raised;
  const pool = (open.some(owned) ? open : lines).filter(owned);
  const names = [...new Set(pool.map(owned))];
  // agents with something to say right now (presence) first
  names.sort((a, b) => (doing(presence, b) ? 1 : 0) - (doing(presence, a) ? 1 : 0));
  const agents = names.slice(0, 3).map((a) => {
    const line = pool.find((l) => owned(l) === a);
    return { name: a, doing: doing(presence, a) || (line?.by.agent ? line.t : `Asked for a call: ${line?.t || ''}`) };
  });
  const calls = lines.filter((l) => l.st === 'call');
  const next = i < STAGES.length - 1 ? STAGES[i + 1] : null;
  return { day: p.today, n: i + 1, stage: st, people, agents, calls, next };
}

// the record panel's rows: a value only once it is real (its stage reached and a value there), else a dash
export const shown = (p, row) => (row.v != null && row.v !== '' && row.at <= p.stage ? row.v : null);
