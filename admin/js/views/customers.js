import { api, can, esc, npr, pill, fmtDate, ago, debounce, hashQuery, setHashQuery } from "../core.js";

export async function customersView(root) {
  let term = hashQuery().get("q") || "";
  const finance = can("orders.finance");

  root.innerHTML = `
    <div class="page-head"><div><h1>Customers</h1><p>Everyone who has ordered, matched by phone number.</p></div></div>
    <div class="filters"><input type="search" id="q" placeholder="Name, phone or district" value="${esc(term)}" aria-label="Search customers"></div>
    <div class="card" id="table"></div>`;

  async function load() {
    setHashQuery({ q: term });
    const rows = await api(`/customers?q=${encodeURIComponent(term)}`);
    root.querySelector("#table").innerHTML = `<div class="table-wrap"><table class="data">
      <thead><tr><th>Customer</th><th>Phone</th><th>District</th><th class="num">Orders</th>${finance ? '<th class="num">Spent</th>' : ""}<th>Last order</th></tr></thead>
      <tbody>${rows.map((c) => `
        <tr class="clickable" data-id="${c.id}">
          <td><div class="cell-main">${esc(c.name)}</div><div class="cell-sub">Since ${fmtDate(c.created_at)}</div></td>
          <td><a href="tel:${esc(c.phone)}" data-stop>${esc(c.phone)}</a></td>
          <td>${esc(c.district || "")}</td>
          <td class="num">${c.orders}</td>
          ${finance ? `<td class="num">${npr(c.spent, { decimals: false })}</td>` : ""}
          <td>${c.last_order ? ago(c.last_order) : '<span class="muted">Never</span>'}</td>
        </tr>`).join("") || `<tr><td colspan="6" class="empty">No customers found.</td></tr>`}</tbody></table></div>`;
  }

  root.querySelector("#q").addEventListener("input", debounce((e) => { term = e.target.value.trim(); load(); }, 300));
  root.querySelector("#table").addEventListener("click", (e) => {
    if (e.target.closest("[data-stop]")) return;
    const row = e.target.closest("tr[data-id]");
    if (row) location.hash = `#/customers/${row.dataset.id}`;
  });

  await load();
}

export async function customerDetailView(root, id) {
  const c = await api(`/customers/${id}`);
  const finance = can("orders.finance");
  const live = c.orders.filter((o) => o.status !== "cancelled");
  const spent = finance ? live.reduce((s, o) => s + o.total, 0) : null;

  root.innerHTML = `
    <a class="back" href="#/customers">← Customers</a>
    <div class="page-head"><div><h1>${esc(c.name)}</h1><p>Customer since ${fmtDate(c.created_at)}</p></div>
      <div class="actions"><a class="btn btn-default" href="tel:${esc(c.phone)}">Call ${esc(c.phone)}</a>
        ${c.email ? `<a class="btn btn-default" href="mailto:${esc(c.email)}">Email</a>` : ""}</div></div>
    <div class="stats">
      <div class="stat"><div class="label">Orders</div><div class="value">${c.orders.length}</div></div>
      ${finance ? `<div class="stat"><div class="label">Total spent</div><div class="value">${npr(spent, { decimals: false })}</div></div>
        <div class="stat"><div class="label">Average order</div><div class="value">${npr(live.length ? spent / live.length : 0, { decimals: false })}</div></div>` : ""}
      <div class="stat"><div class="label">Cancelled</div><div class="value">${c.orders.length - live.length}</div></div>
    </div>
    <div class="detail-grid">
      <section class="card">
        <div class="card-head"><h2>Orders</h2></div>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Order</th><th>Status</th><th class="num">Items</th>${finance ? '<th class="num">Total</th>' : ""}</tr></thead>
          <tbody>${c.orders.map((o) => `
            <tr class="clickable" data-href="#/orders/${esc(o.id)}"><td><div class="cell-main">${esc(o.id)}</div><div class="cell-sub">${ago(o.createdAt)}</div></td>
              <td>${pill(o.status)}</td><td class="num">${o.items}</td>${finance ? `<td class="num">${npr(o.total)}</td>` : ""}</tr>`).join("")
            || '<tr><td colspan="4" class="empty">No orders.</td></tr>'}</tbody></table></div>
      </section>
      <section class="card">
        <div class="card-head"><h2>Contact & address</h2></div>
        <div class="card-body"><dl class="kv">
          <dt>Phone</dt><dd><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a></dd>
          <dt>Email</dt><dd>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '<span class="muted">None</span>'}</dd>
          <dt>Address</dt><dd>${esc(c.address || "")}<br>${esc(c.landmark || "")}<br>${esc(c.district || "")}</dd>
        </dl></div>
      </section>
    </div>`;

  root.querySelectorAll("tr[data-href]").forEach((tr) => tr.addEventListener("click", () => (location.hash = tr.dataset.href)));
}
