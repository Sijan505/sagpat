import {
  api, can, esc, npr, pill, paymentPill, fmtDateTime, fmtDay, ago, toast, modal, confirmDialog, formData,
  debounce, hashQuery, setHashQuery, icon, ACTION_LABELS, STATUS_LABELS,
} from "../core.js";

const TABS = [["", "All"], ["pending", "New"], ["confirmed", "Confirmed"], ["packed", "Packed"], ["out_for_delivery", "Out for delivery"],
  ["delivered", "Delivered"], ["failed", "Failed"], ["cancelled", "Cancelled"]];

// ---------- Order list ----------
export async function ordersView(root) {
  const q = hashQuery();
  const f = { status: q.get("status") || "", q: q.get("q") || "", from: q.get("from") || "", to: q.get("to") || "", deliveryType: q.get("deliveryType") || "", page: Number(q.get("page")) || 1 };
  const finance = can("orders.finance");

  root.innerHTML = `
    <div class="page-head">
      <div><h1>Orders</h1><p>Every order placed on the shop. New orders appear here automatically.</p></div>
      <div class="actions">${can("orders.export") ? `<a class="btn btn-default" id="export" href="#">${icon("download")} Export CSV</a>` : ""}</div>
    </div>
    <div class="tabs" id="tabs">${TABS.map(([v, l]) => `<button type="button" data-status="${v}" aria-pressed="${f.status === v}">${l}</button>`).join("")}</div>
    <div class="filters">
      <input type="search" id="q" placeholder="Order ID, name, phone or district" value="${esc(f.q)}" aria-label="Search orders">
      <label class="sr-only" for="from">From</label><input type="date" id="from" value="${esc(f.from)}" title="Placed from">
      <label class="sr-only" for="to">To</label><input type="date" id="to" value="${esc(f.to)}" title="Placed to">
      <select id="deliveryType" aria-label="Delivery type">
        <option value="">All delivery types</option>
        <option value="express" ${f.deliveryType === "express" ? "selected" : ""}>Express</option>
        <option value="standard" ${f.deliveryType === "standard" ? "selected" : ""}>Standard</option>
      </select>
      <button type="button" class="btn-link" id="clear">Clear</button>
    </div>
    <div class="card" id="list"><div class="empty">Loading…</div></div>`;

  const list = root.querySelector("#list");

  async function load() {
    setHashQuery({ ...f, page: f.page > 1 ? f.page : "" });
    const params = new URLSearchParams(Object.entries({ ...f, limit: 25 }).filter(([, v]) => v !== ""));
    if (can("orders.export")) root.querySelector("#export").href = `/api/admin/orders.csv?${params}`;
    list.style.opacity = 0.6;
    const data = await api(`/orders?${params}`);
    list.style.opacity = 1;

    list.innerHTML = `
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Order</th><th>Customer</th><th class="num">Items</th><th>Delivery</th><th>Payment</th>
          ${finance ? '<th class="num">Total</th>' : ""}<th>Status</th><th></th></tr></thead>
        <tbody>${data.orders.map((o) => `
          <tr class="clickable" data-id="${esc(o.id)}">
            <td><div class="cell-main">${esc(o.id)}</div><div class="cell-sub">${ago(o.createdAt)}</div></td>
            <td>${esc(o.name)}<div class="cell-sub">${esc(o.phone)} · ${esc(o.district)}</div></td>
            <td class="num">${o.items}</td>
            <td>${o.deliveryType === "express" ? "Express" : "Standard"}<div class="cell-sub">${fmtDay(o.deliveryDate)} · ${esc(o.slot)}</div></td>
            <td>${esc(labelPayment(o.paymentMethod))}<div>${paymentPill(o.paymentStatus)}</div></td>
            ${finance ? `<td class="num">${npr(o.total)}</td>` : ""}
            <td>${pill(o.status)}</td>
            <td class="num">${o.transitions.filter((t) => t !== "cancelled" && t !== "failed").slice(0, 1).map((t) =>
              `<button type="button" class="btn btn-default btn-sm" data-quick="${t}" data-id="${esc(o.id)}">${ACTION_LABELS[t]}</button>`).join("")}</td>
          </tr>`).join("") || `<tr><td colspan="8" class="empty">No orders match these filters.</td></tr>`}
        </tbody></table></div>
      <div class="pager">
        <span>${data.total} order${data.total === 1 ? "" : "s"}</span>
        <span>
          <button type="button" class="btn btn-default btn-sm" data-page="${data.page - 1}" ${data.page <= 1 ? "disabled" : ""}>Previous</button>
          Page ${data.page} of ${data.pages}
          <button type="button" class="btn btn-default btn-sm" data-page="${data.page + 1}" ${data.page >= data.pages ? "disabled" : ""}>Next</button>
        </span>
      </div>`;
  }

  root.querySelector("#tabs").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    f.status = b.dataset.status;
    f.page = 1;
    root.querySelectorAll("#tabs button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    load();
  });
  const onFilter = () => {
    Object.assign(f, { q: root.querySelector("#q").value.trim(), from: root.querySelector("#from").value, to: root.querySelector("#to").value, deliveryType: root.querySelector("#deliveryType").value, page: 1 });
    load();
  };
  root.querySelector("#q").addEventListener("input", debounce(onFilter, 300));
  ["#from", "#to", "#deliveryType"].forEach((s) => root.querySelector(s).addEventListener("change", onFilter));
  root.querySelector("#clear").addEventListener("click", () => {
    ["#q", "#from", "#to", "#deliveryType"].forEach((s) => (root.querySelector(s).value = ""));
    onFilter();
  });

  list.addEventListener("click", async (e) => {
    const quick = e.target.closest("[data-quick]");
    if (quick) {
      e.stopPropagation();
      quick.disabled = true;
      try {
        await api(`/orders/${quick.dataset.id}/status`, { method: "POST", body: { status: quick.dataset.quick } });
        toast(`${quick.dataset.id}: ${STATUS_LABELS[quick.dataset.quick]}`);
        load();
      } catch (err) {
        toast(err.message, "error");
        quick.disabled = false;
      }
      return;
    }
    const pageBtn = e.target.closest("[data-page]");
    if (pageBtn) { f.page = Number(pageBtn.dataset.page); load(); return; }
    const row = e.target.closest("tr[data-id]");
    if (row) location.hash = `#/orders/${row.dataset.id}`;
  });

  await load();
  return { onEvent: debounce(load, 400) };
}

const labelPayment = (m) => ({ cod: "Cash on delivery", bank: "Bank transfer", khalti: "Khalti", esewa: "eSewa" })[m] || m;

// ---------- Order detail ----------
export async function orderDetailView(root, id) {
  let order;

  async function load() {
    order = await api(`/orders/${encodeURIComponent(id)}`);
    render();
  }

  function render() {
    const o = order;
    const finance = !!o.totals;
    const editDelivery = can("deliveries.update");
    root.innerHTML = `
      <a class="back" href="${can("orders.view") ? "#/orders" : "#/deliveries"}">← ${can("orders.view") ? "All orders" : "Dispatch board"}</a>
      <div class="page-head">
        <div><h1>${esc(o.id)} ${pill(o.status)}</h1><p>Placed ${fmtDateTime(o.createdAt)} · last change ${ago(o.updatedAt)}</p></div>
        <div class="actions action-bar">
          ${o.transitions.map((t) => `<button type="button" class="btn ${t === "cancelled" || t === "failed" ? "btn-danger" : "btn-primary"}" data-status="${t}">${ACTION_LABELS[t]}</button>`).join("")}
          ${can("orders.delete") ? `<button type="button" class="btn btn-danger" id="delete">Delete</button>` : ""}
        </div>
      </div>

      <div class="detail-grid">
        <div class="grid">
          <section class="card">
            <div class="card-head"><h2>Items</h2><span class="muted">${o.items.reduce((s, i) => s + i.qty, 0)} items</span></div>
            <div class="table-wrap"><table class="data">
              <thead><tr><th>Product</th><th class="num">Qty</th>${finance ? '<th class="num">Price</th><th class="num">Amount</th>' : ""}</tr></thead>
              <tbody>${o.items.map((i) => `
                <tr><td><div class="cell-main">${esc(i.en)}</div><div class="cell-sub ne">${esc(i.ne)}</div></td>
                  <td class="num">${i.qty} ${esc(i.unit)}</td>
                  ${finance ? `<td class="num">${npr(i.price)}</td><td class="num">${npr(i.price * i.qty)}</td>` : ""}</tr>`).join("")}
              </tbody></table></div>
            <div class="card-body">
              ${finance ? `<div class="totals">
                <div><span>Subtotal</span><span>${npr(o.totals.subtotal)}</span></div>
                <div><span>Delivery</span><span>${o.totals.delivery ? npr(o.totals.delivery) : "Free"}</span></div>
                <div><span>VAT</span><span>${npr(o.totals.tax)}</span></div>
                <div class="grand"><span>Total</span><span>${npr(o.totals.total)}</span></div></div>`
                : o.collect ? `<div class="collect">Collect ${npr(o.collect)} in cash on delivery.</div>`
                  : `<p class="muted">Already paid. Nothing to collect.</p>`}
            </div>
          </section>

          <section class="card">
            <div class="card-head"><h2>History & notes</h2></div>
            <div class="card-body">
              <ol class="timeline">${o.events.slice().reverse().map((e) => `
                <li class="${e.type}">
                  ${e.type === "status" ? `<strong>${esc(STATUS_LABELS[e.status] || e.status)}</strong>` : e.type === "note" ? "<strong>Note</strong>" : "<strong>Updated</strong>"}
                  ${e.note ? ` · ${esc(e.note)}` : ""}
                  <small>${fmtDateTime(e.at)}${e.by ? ` · ${esc(e.by)}` : ""}</small>
                </li>`).join("")}</ol>
              ${can("orders.update") || can("deliveries.update") ? `
                <form id="note-form" style="display:flex; gap:8px; margin-top:8px;">
                  <input name="note" placeholder="Add an internal note (customers don't see these)" maxlength="500" required aria-label="Note">
                  <button class="btn btn-default" type="submit">Add</button>
                </form>` : ""}
            </div>
          </section>
        </div>

        <div class="grid">
          <section class="card">
            <div class="card-head"><h2>Customer</h2>${can("customers.view") ? `<a href="#/customers/${o.customerId}">History</a>` : ""}</div>
            <div class="card-body">
              <dl class="kv">
                <dt>Name</dt><dd>${esc(o.customer.name)}</dd>
                <dt>Phone</dt><dd><a href="tel:${esc(o.customer.phone)}">${esc(o.customer.phone)}</a></dd>
                ${o.customer.email ? `<dt>Email</dt><dd><a href="mailto:${esc(o.customer.email)}">${esc(o.customer.email)}</a></dd>` : ""}
                <dt>Address</dt><dd>${esc(o.customer.address)}<br>${esc(o.customer.landmark)}<br>${esc(o.customer.district)}</dd>
              </dl>
            </div>
          </section>

          <section class="card">
            <div class="card-head"><h2>Delivery</h2>${editDelivery ? `<button type="button" class="btn-link" id="edit-delivery">Change</button>` : ""}</div>
            <div class="card-body">
              <dl class="kv">
                <dt>Type</dt><dd>${o.delivery.type === "express" ? "Express" : "Standard"}</dd>
                <dt>Date</dt><dd>${fmtDay(o.delivery.date)}</dd>
                <dt>Slot</dt><dd>${esc(o.delivery.slot)}</dd>
                <dt>Rider</dt><dd>${o.delivery.rider ? esc(o.delivery.rider) : '<span class="muted">Not assigned</span>'}</dd>
                ${o.delivery.notes ? `<dt>Customer note</dt><dd>${esc(o.delivery.notes)}</dd>` : ""}
              </dl>
            </div>
          </section>

          <section class="card">
            <div class="card-head"><h2>Payment</h2>${can("orders.finance") ? `<button type="button" class="btn-link" id="edit-payment">Change</button>` : ""}</div>
            <div class="card-body"><dl class="kv">
              <dt>Method</dt><dd>${esc(o.payment.label)}</dd>
              <dt>Status</dt><dd>${paymentPill(o.payment.status)}</dd>
            </dl></div>
          </section>
        </div>
      </div>`;
  }

  root.addEventListener("click", async (e) => {
    const statusBtn = e.target.closest("[data-status]");
    if (statusBtn) return changeStatus(statusBtn.dataset.status);
    if (e.target.closest("#delete")) return deleteOrder();
    if (e.target.closest("#edit-delivery")) return editDelivery();
    if (e.target.closest("#edit-payment")) return editPayment();
  });
  root.addEventListener("submit", async (e) => {
    if (e.target.id !== "note-form") return;
    e.preventDefault();
    try {
      order = await api(`/orders/${encodeURIComponent(id)}/notes`, { method: "POST", body: { note: e.target.note.value } });
      render();
    } catch (err) { toast(err.message, "error"); }
  });

  async function changeStatus(status) {
    const needsReason = status === "cancelled" || status === "failed";
    const done = await modal({
      title: ACTION_LABELS[status],
      danger: needsReason,
      submitLabel: ACTION_LABELS[status],
      body: `<p style="margin-bottom:12px">Move <strong>${esc(order.id)}</strong> from “${esc(STATUS_LABELS[order.status])}” to “${esc(STATUS_LABELS[status])}”?
          ${status === "cancelled" ? "Stock for these items will be put back." : ""}</p>
        <label for="note">${needsReason ? "Reason" : "Note (optional)"}</label>
        <input id="note" name="note" maxlength="300" ${needsReason ? "required" : ""}
          placeholder="${status === "failed" ? "e.g. Customer not home, phone off" : status === "cancelled" ? "e.g. Customer asked to cancel" : ""}">`,
      onSubmit: async (form) => {
        order = await api(`/orders/${encodeURIComponent(id)}/status`, { method: "POST", body: { status, note: form.note.value } });
        return true;
      },
    });
    if (done) { toast(`${order.id}: ${STATUS_LABELS[status]}`); render(); }
  }

  async function deleteOrder() {
    const ok = await confirmDialog(`Permanently delete ${order.id}? This can't be undone. Cancelling is usually better, because it keeps a record.`,
      { title: "Delete order", confirmLabel: "Delete order" });
    if (!ok) return;
    try {
      await api(`/orders/${encodeURIComponent(id)}`, { method: "DELETE" });
      toast(`${order.id} deleted`);
      location.hash = "#/orders";
    } catch (err) { toast(err.message, "error"); }
  }

  async function editDelivery() {
    const { slots } = await api(`/slots?date=${order.delivery.date}`);
    const done = await modal({
      title: "Change delivery",
      body: `<div class="form-grid">
        <div><label for="d-date">Date</label><input type="date" id="d-date" name="deliveryDate" value="${esc(order.delivery.date)}" required></div>
        <div><label for="d-slot">Slot</label><select id="d-slot" name="slot">${slots.filter((s) => s.active).map((s) =>
          `<option ${s.label === order.delivery.slot ? "selected" : ""}>${esc(s.label)}</option>`).join("")}</select></div>
        <div class="full"><label for="d-rider">Rider</label><input id="d-rider" name="rider" value="${esc(order.delivery.rider || "")}" placeholder="Rider name" maxlength="60"></div>
      </div>`,
      onSubmit: async (form) => {
        const v = formData(form);
        if (v.deliveryDate === order.delivery.date && v.slot === order.delivery.slot) { delete v.deliveryDate; delete v.slot; }
        if ((v.rider || "") === (order.delivery.rider || "")) delete v.rider;
        if (!Object.keys(v).length) return true;
        order = await api(`/orders/${encodeURIComponent(id)}`, { method: "PATCH", body: v });
        return true;
      },
    });
    if (done) { toast("Delivery updated"); render(); }
  }

  async function editPayment() {
    const options = ["Pay on delivery", "Awaiting bank transfer", "Payment pending", "Paid", "Refunded"];
    const done = await modal({
      title: "Payment status",
      body: `<label for="p-status">Status</label><select id="p-status" name="paymentStatus">${options.map((s) =>
        `<option ${s === order.payment.status ? "selected" : ""}>${s}</option>`).join("")}</select>`,
      onSubmit: async (form) => {
        order = await api(`/orders/${encodeURIComponent(id)}`, { method: "PATCH", body: { paymentStatus: form.paymentStatus.value } });
        return true;
      },
    });
    if (done) { toast("Payment updated"); render(); }
  }

  await load();
  return {
    onEvent: (type, data) => {
      if (data.id !== id) return;
      if (type === "order.deleted") { toast(`${id} was deleted`); location.hash = "#/orders"; return; }
      load().catch(() => {});
    },
  };
}
