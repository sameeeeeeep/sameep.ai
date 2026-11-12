// sameep.ai/d2c-clone: the system diagram. Tap a part, read what it does.
(function () {
  var D = {
    shopify: ['Shopify', 'Orders, products, customers and the storefront.', ['Sales and orders sync into the hub every 15 minutes', 'The Website group\'s agent can read it and draft product or page changes', 'Any change to the store waits for your tap'], 'Connector · Website group'],
    meta: ['Meta Ads', 'Campaigns, spend, results and Instagram.', ['Spend, results and cost per result per campaign', 'Flags a campaign whose cost per result climbs for three days', 'Budget changes are drafted, never made without a tap'], 'Connector · Performance group'],
    razorpay: ['Razorpay', 'Payments, refunds and settlements.', ['Read-only keys: it can never refund, capture or pay out', 'Failed payments and settlements show up in Finance', 'Cash position on the Today screen'], 'Connector · Finance group'],
    shipping: ['Shiprocket', 'Shipments, NDR and returns.', ['Delivery status and RTO by pin code', 'Return reasons feed into product and ops decisions', 'Alerts when RTO jumps in a region'], 'Connector · Ops group'],
    qc: ['Blinkit and Zepto', 'Quick-commerce sales and stock.', ['Sales by platform and city', 'Stock at dark stores against the run rate', 'Imports from their sheets where there is no API'], 'Connector · Ops and Growth'],
    offers: ['Cart and offers', 'Discounts, bundles and checkout.', ['Which offers are live and how they convert', 'Drafts new bundles and codes for approval', 'Shopify discounts or your checkout tool'], 'Connector · Growth group'],
    crm: ['CRM', 'Customers, repeat buyers and segments.', ['Repeat rate, cohorts and LTV', 'Segments for WhatsApp and email campaigns', 'Customer details only in the groups you allow'], 'Connector · Support and Growth'],
    whatsapp: ['WhatsApp', 'Your team\'s and your customers\' messages.', ['Read only: messages become tasks for the right agent', 'Replies come back as drafts for a person to send', 'Voice notes are transcribed and filed'], 'Connector · every group'],
    gmail: ['Gmail', 'Vendor, investor and customer email.', ['Picks up POs, invoices and requests from email', 'Drafts replies; a person sends them', 'Read only: it never sends on its own'], 'Connector · Ops and Finance'],
    drive: ['Drive and Calendar', 'Docs, sheets, briefs and meetings.', ['Content calendar and briefs for the Content group', 'Meeting notes turned into tasks', 'Every file or calendar read waits for your tap'], 'Connector · Content group'],
    warehouse: ['Warehouse', 'Stock by location and batch.', ['First in, first out stock with low-stock alerts', 'Every sale deducts stock automatically', 'Drafts a PO when an item runs low'], 'Inside the OS'],
    sheets: ['Sheets and MIS', 'The spreadsheets the business already runs on.', ['Upload your monthly MIS and it maps itself', 'Expenses and sales by channel from day one', 'A guide for any source without an API'], 'Import'],
    hub: ['Company hub', 'One store for everything your tools know.', ['Every number carries its source and when it was fetched', 'If a source fails, the last good data stays and you are told why', 'Agents and dashboards read the same numbers, so nobody argues about whose sheet is right', 'Each brand gets its own hub and its own logins'], 'Core'],
    brain: ['Intelligence', 'The model behind every agent.', ['Runs on one Claude plan, shared by every agent on your team', 'An always-on runner, so agents work while you sleep', 'Cloud and local models as backup, and a usage cap per company'], 'Core'],
    chat: ['Agentic chat', 'Group chats where the work gets done.', ['One group per area, each with its own agent and only that area\'s connector', 'A task said in the group goes to the right person\'s agent, who does the work', 'The owner approves, a second person checks, then it\'s done', 'Decisions become cards: options, a recommendation, one tap'], 'Where work happens'],
    agents: ['Agents', 'One per area of the business, plus a chief of staff.', ['Website, Performance, Ops, Content, Finance, Support', 'The chief of staff turns discussions into decision cards', 'Each agent only has the tools of its own area'], 'Who is in the chat'],
    team: ['Team members', 'Your people, by role.', ['Join with one link and land in the right groups', 'Founder and finance joins wait for your approval', 'Each person approves or checks their own work from their phone'], 'Who is in the chat'],
    vendors: ['Vendors and agencies', 'The people outside the company you work with.', ['Invite your agency into Performance or Content', 'Vendors join only the groups you add them to', 'Agents in groups with outsiders never touch private data'], 'Who is in the chat'],
    os: ['The OS (Nia)', 'The company on one screen.', ['Today: yesterday\'s sales, ad spend, low stock and everything waiting on you', 'Tasks from every group in one list', 'POs and vendor invoices, drafted by agents and approved by people', 'Warehouse and inventory, boards and custom views'], 'Where work happens']
  };
  var box = document.getElementById('detail');
  var nodes = document.querySelectorAll('#sys .node');
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function show(k, btn) {
    var d = D[k]; if (!d) return;
    Array.prototype.forEach.call(nodes, function (n) { n.classList.toggle('is-on', n === btn); n.setAttribute('aria-pressed', n === btn ? 'true' : 'false'); });
    box.innerHTML = '<div><h3>' + esc(d[0]) + '</h3><p class="d-what">' + esc(d[1]) + '</p><p class="d-tag">' + esc(d[3]) + '</p></div><ul>' +
      d[2].map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
  }
  Array.prototype.forEach.call(nodes, function (n) { n.addEventListener('click', function () { show(n.dataset.k, n); }); });
  show('hub', document.querySelector('#sys [data-k="hub"]'));
})();
