import {
  api, can, esc, npr, fmtDay, toast, modal, confirmDialog, formData, debounce, hashQuery, setHashQuery,
  nepalToday, addDays, icon, ACTION_LABELS, STATUS_LABELS,
} from "../core.js";
import { slotRow } from "./dashboard.js";

const COLUMNS = [
  ["confirmed", "To pack"],
  ["packed", "Packed, ready to go"],
  ["out_for_delivery", "On the road"],
  ["failed", "Failed, needs follow-up"],
];

// ---------- Dispatch board ----------
export async function deliveriesView(root) {
  const today = nepalToday();
  const q = hashQuery();
  const f = { day: q.get("day") || "today", type: q.get("type") || "" };

  root.innerHTML = `
    <div class="page-head">
      <div><h1>Dispatch board</h1><p>Orders that still need to go out. Move each one along as it's packed and delivered.</p></div>
    </div>
    <div class="filters">
      <div class="seg" role="group" aria-label="Delivery day" id="day">
        ${[["today", "Today"], ["tomorrow", "Tomorrow"], ["all", "All open"]].map(([v, l]) =>
          `<button type="button" data-v="${v}" aria-pressed="${f.day === v}">${l}</button>`).join("")}
      </div>
      <select id="type" aria-label="Delivery type">
        <option value="">Express and standard</option>
        <option value="express" ${f.type === "express" ? "selected" : ""}>Express only</option>
        <option value="standard" ${f.type === "standard" ? "selected" : ""}>Standard only</option>
      </select>
      <span class="muted" id="waiting"></span>
    </div>
    <div class="board" id="board"></div>`;

  const board = root.querySelector("#board");

  async function load() {
    setHashQuery({ day: f.day === "today" ? "" : f.day, type: f.type });
    const date = f.day === "today" ? today : f.day === "tomorrow" ? addDays(today, 1) : "";
    const params = new URLSearchParams({ status: "pending,confirmed,packed,out_for_delivery,failed", sort: "delivery", limit: 300 });
    if (date) params.set("deliveryDate", date);
    if (f.type) params.set("deliveryType", f.type);
    board.style.opacity = 0.6;
    const { orders } = await api(`/orders?${params}`);
    board.style.opacity = 1;

    const waiting = orders.filter((o) => o.status === "pending").length;
    root.querySelector("#waiting").textContent = waiting ? `${waiting} new order${waiting > 1 ? "s" : ""} still waiting for the order desk to confirm.` : "";

    board.innerHTML = COLUMNS.map(([status, title]) => {
      const list = orders.filter((o) => o.status === status);
      return `<section class="column" aria-label="${title}">
        <h2>${title} <span class="muted">${list.length}</span></h2>
        ${list.map(ticket).join("") || '<p class="muted" style="font-size:.82rem; padding:4px;">Nothing here.</p>'}
      </section>`;
    }).join("");
  }

  function ticket(o) {
    const collect = o.collect !== undefined ? o.collect : o.paymentMethod === "cod" && o.paymentStatus !== "Paid" ? o.total : 0;
    const late = o.deliveryDate < today;
    return `<article class="ticket">
      <div class="top"><a class="id" href="#/orders/${esc(o.id)}">${esc(o.id)}</a>
        <span class="pill ${o.deliveryType === "express" ? "out_for_delivery" : "neutral"}">${o.deliveryType === "express" ? "Express" : "Standard"}</span></div>
      <div><strong>${esc(o.name)}</strong> · <a href="tel:${esc(o.phone)}">${esc(o.phone)}</a></div>
      <div class="addr">${esc(o.address)}, ${esc(o.district)}</div>
      <div class="meta">
        <span${late ? ' style="color:var(--danger);font-weight:600"' : ""}>${late ? "Late · " : ""}${fmtDay(o.deliveryDate)}, ${esc(o.slot)}</span>
        <span>${o.items} items</span>
        <span>${collect ? `Collect ${npr(collect)}` : "Paid"}</span>
        <span>Rider: ${o.rider ? esc(o.rider) : "none"}</span>
      </div>
      <div class="acts">
        ${o.transitions.filter((t) => t !== "cancelled").map((t) =>
          `<button type="button" class="btn ${t === "failed" ? "btn-danger" : "btn-primary"} btn-sm" data-move="${t}" data-id="${esc(o.id)}">${ACTION_LABELS[t]}</button>`).join("")}
        ${can("deliveries.update") ? `<button type="button" class="btn btn-default btn-sm" data-rider="${esc(o.id)}" data-current="${esc(o.rider || "")}">Rider</button>` : ""}
      </div>
    </article>`;
  }

  root.querySelector("#day").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    f.day = b.dataset.v;
    root.querySelectorAll("#day button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    load();
  });
  root.querySelector("#type").addEventListener("change", (e) => { f.type = e.target.value; load(); });

  board.addEventListener("click", async (e) => {
    const move = e.target.closest("[data-move]");
    if (move) {
      const status = move.dataset.move;
      let note = "";
      if (status === "failed") {
        const ok = await modal({
          title: "Delivery failed", danger: true, submitLabel: "Mark as failed",
          body: `<label for="why">What happened?</label><input id="why" name="why" required placeholder="e.g. Customer not home, phone switched off">`,
          onSubmit: async (form) => { note = form.why.value; return true; },
        });
        if (!ok) return;
      }
      move.disabled = true;
      try {
        await api(`/orders/${move.dataset.id}/status`, { method: "POST", body: { status, note } });
        toast(`${move.dataset.id}: ${STATUS_LABELS[status]}`);
        load();
      } catch (err) { toast(err.message, "error"); move.disabled = false; }
      return;
    }
    const riderBtn = e.target.closest("[data-rider]");
    if (riderBtn) {
      const ok = await modal({
        title: `Rider for ${riderBtn.dataset.rider}`,
        body: `<label for="rider">Rider name</label><input id="rider" name="rider" value="${esc(riderBtn.dataset.current)}" maxlength="60">
               <p class="field-hint">Leave empty to unassign.</p>`,
        onSubmit: (form) => api(`/orders/${riderBtn.dataset.rider}`, { method: "PATCH", body: { rider: form.rider.value } }),
      });
      if (ok) { toast("Rider updated"); load(); }
    }
  });

  await load();
  return { onEvent: debounce(load, 400) };
}

// ---------- Delivery slots ----------
const TYPES = { standard: "Standard", express_today: "Express (same day)", express_tomorrow: "Express (after cut-off, next morning)" };

export async function slotsView(root) {
  let date = nepalToday();
  const manage = can("slots.manage");

  root.innerHTML = `
    <div class="page-head">
      <div><h1>Delivery slots</h1><p>Time windows customers can pick at checkout, and how full each one is.</p></div>
      <div class="actions">${manage ? `<button type="button" class="btn btn-primary" id="add">${icon("plus")} Add slot</button>` : ""}</div>
    </div>
    <div class="filters">
      <label for="date" style="margin:0">Bookings for</label>
      <input type="date" id="date" value="${date}">
    </div>
    <div class="grid grid-3">
      <div class="card" id="table"></div>
      <div class="card"><div class="card-head"><h2>Load</h2></div><div class="card-body" id="load" style="display:grid;gap:12px"></div></div>
    </div>`;

  async function load() {
    const data = await api(`/slots?date=${date}`);
    root.querySelector("#load").innerHTML = data.slots.filter((s) => s.active).map(slotRow).join("") || '<p class="muted">No active slots.</p>';
    root.querySelector("#table").innerHTML = `<div class="table-wrap"><table class="data">
      <thead><tr><th>Slot</th><th>Type</th><th class="num">Booked</th><th class="num">Capacity</th><th>Status</th>${manage ? "<th></th>" : ""}</tr></thead>
      <tbody>${data.slots.map((s) => `
        <tr><td class="cell-main">${esc(s.label)}</td><td>${TYPES[s.type]}</td>
          <td class="num">${s.booked}</td><td class="num">${s.capacity}</td>
          <td>${s.active ? '<span class="pill ok">Open</span>' : '<span class="pill neutral">Off</span>'}</td>
          ${manage ? `<td class="num"><button type="button" class="btn btn-default btn-sm" data-edit="${s.id}">Edit</button>
            <button type="button" class="btn btn-danger btn-sm" data-del="${s.id}">Delete</button></td>` : ""}
        </tr>`).join("")}</tbody></table></div>`;
    return data;
  }

  let data = await load();
  root.querySelector("#date").addEventListener("change", async (e) => { date = e.target.value || nepalToday(); data = await load(); });

  async function edit(slot) {
    const ok = await modal({
      title: slot ? "Edit slot" : "Add slot",
      body: `<div class="form-grid">
        <div class="full"><label for="s-label">Name shown to customers</label>
          <input id="s-label" name="label" required maxlength="80" value="${esc(slot?.label || "")}" placeholder="e.g. Morning (7–10 AM)">
          ${slot ? '<p class="field-hint">Renaming also updates orders already booked in this slot.</p>' : ""}</div>
        <div><label for="s-type">Type</label><select id="s-type" name="type">${Object.entries(TYPES).map(([k, v]) =>
          `<option value="${k}" ${slot?.type === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>
        <div><label for="s-cap">Orders per day</label><input id="s-cap" name="capacity" type="number" min="1" max="1000" required value="${slot?.capacity ?? 25}"></div>
        <div><label for="s-sort">Order in list</label><input id="s-sort" name="sort" type="number" min="0" max="999" value="${slot?.sort ?? 0}"></div>
        <div style="align-self:end"><label class="check"><input type="checkbox" name="active" ${slot?.active === false ? "" : "checked"}> Open for booking</label></div>
      </div>`,
      onSubmit: (form) => {
        const v = formData(form);
        const body = { ...v, active: form.active.checked, capacity: Number(v.capacity), sort: Number(v.sort) };
        return slot ? api(`/slots/${slot.id}`, { method: "PUT", body }) : api("/slots", { method: "POST", body });
      },
    });
    if (ok) { toast("Slot saved"); data = await load(); }
  }

  root.addEventListener("click", async (e) => {
    if (e.target.closest("#add")) return edit(null);
    const ed = e.target.closest("[data-edit]");
    if (ed) return edit(data.slots.find((s) => s.id === Number(ed.dataset.edit)));
    const del = e.target.closest("[data-del]");
    if (del) {
      const slot = data.slots.find((s) => s.id === Number(del.dataset.del));
      if (!(await confirmDialog(`Delete the "${slot.label}" slot?`, { confirmLabel: "Delete slot" }))) return;
      try {
        await api(`/slots/${slot.id}`, { method: "DELETE" });
        toast("Slot deleted");
        data = await load();
      } catch (err) { toast(err.message, "error"); }
    }
  });

  return { onEvent: debounce(async () => { data = await load(); }, 400) };
}
