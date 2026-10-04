import { api, state, can, esc, npr, compact, pill, ago, fmtDay, debounce } from "../core.js";

export async function dashboardView(root) {
  const render = async () => {
    const d = await api("/dashboard");
    const hour = Number(new Date().toLocaleString("en-GB", { timeZone: "Asia/Kathmandu", hour: "2-digit", hour12: false }));
    const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    const blocks = [];

    // Top-line numbers
    const stats = [];
    if (d.orders) {
      stats.push(stat("Orders today", d.orders.today, "#/orders"));
      if (d.orders.revenueToday !== undefined) stats.push(stat("Sales today", npr(d.orders.revenueToday, { decimals: false }), "#/reports"));
      stats.push(stat("New, waiting to confirm", d.orders.byStatus.pending || 0, "#/orders?status=pending", (d.orders.byStatus.pending || 0) > 0));
    }
    if (d.deliveries) {
      const ds = d.deliveries.byStatus;
      stats.push(stat("Due for delivery today", ["pending", "confirmed", "packed", "out_for_delivery"].reduce((s, k) => s + (ds[k] || 0), 0), "#/deliveries"));
      stats.push(stat("Out for delivery now", ds.out_for_delivery || 0, "#/deliveries"));
      if (d.deliveries.overdue) stats.push(stat("Late (past delivery date)", d.deliveries.overdue, "#/deliveries", true));
      if (d.deliveries.failed) stats.push(stat("Failed deliveries", d.deliveries.failed, "#/deliveries", true));
    }
    if (d.products) {
      stats.push(stat("Products on sale", d.products.active, "#/products"));
      stats.push(stat("Out of stock", d.products.outOfStock, "#/products?filter=out", d.products.outOfStock > 0));
    }
    if (d.sales) {
      stats.push(stat("Sales, last 7 days", npr(d.sales.revenue, { decimals: false }), "#/reports", false, `${d.sales.orders} orders`));
      stats.push(stat("Customers", compact(d.customers), "#/customers"));
    }

    if (d.orders) {
      blocks.push(`
        <section class="card">
          <div class="card-head"><h2>Latest orders</h2><a href="#/orders">All orders</a></div>
          <div class="table-wrap"><table class="data">
            <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Delivery</th>${can("orders.finance") ? '<th class="num">Total</th>' : ""}</tr></thead>
            <tbody>${d.orders.recent.map((o) => `
              <tr class="clickable" data-href="#/orders/${esc(o.id)}">
                <td><div class="cell-main">${esc(o.id)}</div><div class="cell-sub">${ago(o.createdAt)}</div></td>
                <td>${esc(o.name)}<div class="cell-sub">${esc(o.district)}</div></td>
                <td>${pill(o.status)}</td>
                <td>${o.deliveryType === "express" ? "Express" : "Standard"}<div class="cell-sub">${fmtDay(o.deliveryDate)}</div></td>
                ${can("orders.finance") ? `<td class="num">${npr(o.total)}</td>` : ""}
              </tr>`).join("") || `<tr><td colspan="5" class="empty">No orders yet.</td></tr>`}
            </tbody></table></div>
        </section>`);
    }

    if (d.deliveries) {
      blocks.push(`
        <section class="card">
          <div class="card-head"><h2>Today's delivery slots</h2><a href="#/slots">Manage slots</a></div>
          <div class="card-body" style="display:grid; gap:12px;">
            ${d.deliveries.slots.map((s) => slotRow(s)).join("") || '<p class="muted">No active slots.</p>'}
          </div>
        </section>`);
    }

    if (d.products) {
      blocks.push(`
        <section class="card">
          <div class="card-head"><h2>Running low</h2><a href="#/products?filter=low">See all</a></div>
          <div class="table-wrap"><table class="data"><tbody>
            ${d.products.lowStock.map((p) => `
              <tr class="clickable" data-href="#/products/${p.id}">
                <td style="width:52px"><img class="thumb" src="/${esc(p.image)}" alt=""></td>
                <td><div class="cell-main">${esc(p.en)}</div><div class="cell-sub ne">${esc(p.ne)}</div></td>
                <td class="num"><span class="pill ${p.stock === 0 ? "bad" : "warn"}">${p.stock === 0 ? "Out of stock" : `${p.stock} ${esc(p.unit)} left`}</span></td>
              </tr>`).join("") || `<tr><td class="empty">Everything is well stocked.</td></tr>`}
          </tbody></table></div>
        </section>`);
      blocks.push(`
        <section class="card">
          <div class="card-head"><h2>Recent stock changes</h2></div>
          <div class="table-wrap"><table class="data"><tbody>
            ${d.products.movements.map((m) => `
              <tr><td><div class="cell-main">${esc(m.en || "Deleted product")}</div><div class="cell-sub">${esc(m.reason)}${m.admin_name ? ` · ${esc(m.admin_name)}` : ""}</div></td>
                <td class="num" style="color:${m.change < 0 ? "var(--danger)" : "var(--ok)"}">${m.change > 0 ? "+" : ""}${m.change}</td>
                <td class="num cell-sub">${ago(m.at)}</td></tr>`).join("") || `<tr><td class="empty">No stock changes yet.</td></tr>`}
          </tbody></table></div>
        </section>`);
    }

    root.innerHTML = `
      <div class="page-head">
        <div><h1>${greet}, ${esc(state.me.name.split(" ")[0])}</h1>
          <p>${esc(state.me.roleLabel)} · ${new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Kathmandu", weekday: "long", day: "numeric", month: "long" })}</p></div>
      </div>
      <div class="stats">${stats.join("")}</div>
      <div class="grid grid-2">${blocks.join("")}</div>`;

    root.querySelectorAll("tr[data-href]").forEach((tr) => tr.addEventListener("click", () => (location.hash = tr.dataset.href)));
  };

  await render();
  const refresh = debounce(render, 400);
  return { onEvent: refresh };
}

function stat(label, value, href, alert = false, delta = "") {
  return `<a class="stat ${alert ? "alert" : ""}" href="${href}">
    <div class="label">${esc(label)}</div><div class="value">${esc(value)}</div>${delta ? `<div class="delta">${esc(delta)}</div>` : ""}</a>`;
}

export function slotRow(s) {
  const pct = Math.min(100, Math.round((s.booked / s.capacity) * 100));
  const type = { standard: "Standard", express_today: "Express", express_tomorrow: "Express (next day)" }[s.type];
  return `<div>
    <div style="display:flex; justify-content:space-between; font-size:.88rem;">
      <span>${esc(s.label)} <span class="muted">· ${type}</span></span>
      <span class="muted">${s.booked} / ${s.capacity}</span></div>
    <div class="slot-bar ${s.booked >= s.capacity ? "full" : ""}" role="img" aria-label="${s.booked} of ${s.capacity} booked"><span style="width:${pct}%"></span></div>
  </div>`;
}
