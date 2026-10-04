import { api, state, esc, fmtDateTime, ago, toast, modal, formData, icon } from "../core.js";

// ---------- Staff & roles ----------
export async function usersView(root) {
  let data = await api("/users");

  const render = () => {
    root.innerHTML = `
      <div class="page-head">
        <div><h1>Staff & roles</h1><p>Who can sign in, and what each person is allowed to do.</p></div>
        <div class="actions"><button type="button" class="btn btn-primary" id="add">${icon("plus")} Add staff member</button></div>
      </div>
      <div class="card" style="margin-bottom:16px"><div class="table-wrap"><table class="data">
        <thead><tr><th>Name</th><th>Role</th><th>Last sign-in</th><th>Status</th><th></th></tr></thead>
        <tbody>${data.users.map((u) => `
          <tr><td><div class="cell-main">${esc(u.name)}${u.id === state.me.id ? ' <span class="muted">(you)</span>' : ""}</div><div class="cell-sub">${esc(u.email)}</div></td>
            <td>${esc(data.roles[u.role]?.label || u.role)}</td>
            <td>${u.last_login_at ? ago(u.last_login_at) : '<span class="muted">Never</span>'}</td>
            <td>${u.active ? '<span class="pill ok">Active</span>' : '<span class="pill neutral">Disabled</span>'}</td>
            <td class="num"><button type="button" class="btn btn-default btn-sm" data-edit="${u.id}">Edit</button>
              <button type="button" class="btn btn-default btn-sm" data-pw="${u.id}">Reset password</button></td></tr>`).join("")}
        </tbody></table></div></div>

      <section class="card"><div class="card-head"><h2>What each role can do</h2></div>
        <div class="table-wrap"><table class="data">
          <thead><tr><th>Role</th><th>Can</th></tr></thead>
          <tbody>
            <tr><td class="cell-main">Super Admin</td><td>Everything, including deleting orders, staff accounts, settings, reports and the activity log.</td></tr>
            <tr><td class="cell-main">Order Manager</td><td>View all orders, change status, manage deliveries, contact customers, export orders, see order totals. <strong>Cannot</strong> delete orders.</td></tr>
            <tr><td class="cell-main">Product Manager</td><td>Add, edit and delete products and categories, update stock. <strong>Cannot</strong> see or change orders or any sales figures.</td></tr>
            <tr><td class="cell-main">Delivery Manager</td><td>See orders waiting to go out, update delivery status, assign riders, manage delivery slots, call customers. Sees cash to collect, not sales totals.</td></tr>
          </tbody></table></div></section>`;
  };

  const roleOptions = (selected) => Object.entries(data.roles).map(([k, r]) =>
    `<option value="${k}" ${k === selected ? "selected" : ""}>${esc(r.label)}: ${esc(r.description)}</option>`).join("");

  root.addEventListener("click", async (e) => {
    if (e.target.closest("#add")) {
      const ok = await modal({
        title: "Add staff member",
        body: `<div class="form-grid">
          <div><label for="u-name">Name</label><input id="u-name" name="name" required maxlength="80"></div>
          <div><label for="u-email">Email</label><input id="u-email" name="email" type="email" required maxlength="120" autocomplete="off"></div>
          <div class="full"><label for="u-role">Role</label><select id="u-role" name="role">${roleOptions("order_manager")}</select></div>
          <div class="full"><label for="u-pw">Temporary password</label><input id="u-pw" name="password" type="text" minlength="10" required autocomplete="new-password">
            <p class="field-hint">At least 10 characters. Share it privately; they can change it under "My account".</p></div>
        </div>`,
        submitLabel: "Add",
        onSubmit: (form) => api("/users", { method: "POST", body: formData(form) }),
      });
      if (ok) { toast("Staff member added"); data = await api("/users"); render(); }
      return;
    }
    const ed = e.target.closest("[data-edit]");
    if (ed) {
      const u = data.users.find((x) => x.id === Number(ed.dataset.edit));
      const self = u.id === state.me.id;
      const ok = await modal({
        title: `Edit ${u.name}`,
        body: `<div class="form-grid">
          <div class="full"><label for="e-name">Name</label><input id="e-name" name="name" required maxlength="80" value="${esc(u.name)}"></div>
          <div class="full"><label for="e-role">Role</label><select id="e-role" name="role" ${self ? "disabled" : ""}>${roleOptions(u.role)}</select>
            ${self ? '<p class="field-hint">You can\'t change your own role.</p>' : '<p class="field-hint">Changing the role signs them out everywhere.</p>'}</div>
          <div class="full"><label class="check"><input type="checkbox" name="active" ${u.active ? "checked" : ""} ${self ? "disabled" : ""}> Account active (can sign in)</label></div>
        </div>`,
        onSubmit: (form) => api(`/users/${u.id}`, { method: "PUT", body: { name: form.name.value, ...(self ? {} : { role: form.role.value, active: form.active.checked }) } }),
      });
      if (ok) { toast("Saved"); data = await api("/users"); render(); }
      return;
    }
    const pw = e.target.closest("[data-pw]");
    if (pw) {
      const u = data.users.find((x) => x.id === Number(pw.dataset.pw));
      const ok = await modal({
        title: `New password for ${u.name}`,
        body: `<label for="p-new">New password</label><input id="p-new" name="password" type="text" minlength="10" required autocomplete="new-password">
          <p class="field-hint">They'll be signed out and need this new password to sign in.</p>`,
        submitLabel: "Set password",
        onSubmit: (form) => api(`/users/${u.id}/password`, { method: "POST", body: { password: form.password.value } }),
      });
      if (ok) toast("Password changed");
    }
  });

  render();
}

// ---------- Settings ----------
export async function settingsView(root) {
  const s = await api("/settings");
  root.innerHTML = `
    <div class="page-head"><div><h1>Settings</h1><p>Changes apply to the shop immediately.</p></div></div>
    <form class="card" id="form" style="max-width:760px" novalidate>
      <div class="card-head"><h2>Shop status</h2></div>
      <div class="card-body">
        <label class="check"><input type="checkbox" name="accepting_orders" ${s.accepting_orders ? "checked" : ""}> Accepting new orders</label>
        <p class="field-hint">Untick to pause checkout, for example during a festival holiday. Customers can still browse.</p>
      </div>
      <div class="card-head" style="border-top:1px solid var(--line)"><h2>Delivery & tax</h2></div>
      <div class="card-body form-grid">
        <div><label for="standard_fee">Standard delivery fee (NPR)</label><input id="standard_fee" name="standard_fee" type="number" min="0" step="1" value="${s.standard_fee}" required></div>
        <div><label for="free_delivery_over">Free standard delivery from (NPR)</label><input id="free_delivery_over" name="free_delivery_over" type="number" min="0" step="1" value="${s.free_delivery_over}" required></div>
        <div><label for="express_fee">Express delivery fee (NPR)</label><input id="express_fee" name="express_fee" type="number" min="0" step="1" value="${s.express_fee}" required></div>
        <div><label for="express_cutoff_hour">Same-day express cut-off (hour, 24h)</label><input id="express_cutoff_hour" name="express_cutoff_hour" type="number" min="0" max="23" step="1" value="${s.express_cutoff_hour}" required>
          <p class="field-hint">14 means orders before 2 PM go out the same day.</p></div>
        <div><label for="tax_rate">VAT (%)</label><input id="tax_rate" name="tax_rate" type="number" min="0" max="50" step="0.01" value="${(s.tax_rate * 100).toFixed(2).replace(/\.00$/, "")}" required>
          <p class="field-hint">Set to 0 if your products are VAT-exempt.</p></div>
      </div>
      <div class="card-head" style="border-top:1px solid var(--line)"><h2>Contact details shown on the shop</h2></div>
      <div class="card-body form-grid">
        <div><label for="phone">Phone</label><input id="phone" name="phone" maxlength="40" value="${esc(s.phone)}"></div>
        <div><label for="email">Email</label><input id="email" name="email" type="email" maxlength="120" value="${esc(s.email)}"></div>
      </div>
      <div class="card-body" style="border-top:1px solid var(--line); display:flex; justify-content:flex-end; gap:8px">
        <span class="form-error" id="error" hidden style="margin-right:auto"></span>
        <button type="submit" class="btn btn-primary">Save settings</button>
      </div>
    </form>`;

  root.querySelector("#form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const err = root.querySelector("#error");
    err.hidden = true;
    for (const f of form.elements) if (f.willValidate && !f.checkValidity()) { f.reportValidity(); return; }
    const v = formData(form);
    try {
      await api("/settings", {
        method: "PUT",
        body: { ...v, standard_fee: +v.standard_fee, free_delivery_over: +v.free_delivery_over, express_fee: +v.express_fee,
          express_cutoff_hour: +v.express_cutoff_hour, tax_rate: +v.tax_rate / 100, accepting_orders: form.accepting_orders.checked },
      });
      toast("Settings saved");
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });
}

// ---------- Activity log ----------
export async function activityView(root) {
  const rows = await api("/audit");
  root.innerHTML = `
    <div class="page-head"><div><h1>Activity log</h1><p>The last 200 things staff did: sign-ins, status changes, price and stock edits.</p></div></div>
    <div class="card"><div class="table-wrap"><table class="data">
      <thead><tr><th>When</th><th>Who</th><th>What</th><th>Details</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td style="white-space:nowrap">${fmtDateTime(r.at)}</td><td>${esc(r.admin_name || "")}</td>
        <td><code>${esc(r.action)}</code></td><td class="cell-sub" style="max-width:480px; overflow-wrap:anywhere">${esc(r.detail || "")}</td></tr>`).join("")
        || '<tr><td colspan="4" class="empty">Nothing yet.</td></tr>'}</tbody></table></div></div>`;
}

// ---------- My account ----------
export async function accountView(root) {
  root.innerHTML = `
    <div class="page-head"><div><h1>My account</h1><p>${esc(state.me.name)} · ${esc(state.me.email)} · ${esc(state.me.roleLabel)}</p></div></div>
    <form class="card" id="form" style="max-width:480px" novalidate>
      <div class="card-head"><h2>Change password</h2></div>
      <div class="card-body" style="display:grid; gap:12px">
        <div class="form-error" id="error" hidden></div>
        <div><label for="current">Current password</label><input id="current" name="current" type="password" autocomplete="current-password" required></div>
        <div><label for="next">New password</label><input id="next" name="next" type="password" autocomplete="new-password" minlength="10" required>
          <p class="field-hint">At least 10 characters. You'll stay signed in here; other devices are signed out.</p></div>
        <div><label for="again">New password again</label><input id="again" name="again" type="password" autocomplete="new-password" required></div>
        <div><button type="submit" class="btn btn-primary">Change password</button></div>
      </div>
    </form>`;

  root.querySelector("#form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const err = root.querySelector("#error");
    err.hidden = true;
    for (const f of form.elements) if (f.willValidate && !f.checkValidity()) { f.reportValidity(); return; }
    if (form.next.value !== form.again.value) { err.textContent = "The new passwords don't match."; err.hidden = false; return; }
    try {
      await api("/me/password", { method: "POST", body: { current: form.current.value, next: form.next.value } });
      form.reset();
      toast("Password changed");
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });
}

