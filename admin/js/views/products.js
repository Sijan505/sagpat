import {
  api, can, esc, npr, fmtDateTime, toast, modal, confirmDialog, formData, debounce, hashQuery, setHashQuery, icon, ago,
} from "../core.js";

// ---------- Product list ----------
export async function productsView(root) {
  const q = hashQuery();
  const f = { q: q.get("q") || "", cat: q.get("cat") || "", filter: q.get("filter") || "" };
  const [products0, categories] = await Promise.all([api("/products"), api("/categories")]);
  let products = products0;
  const catName = (id) => categories.find((c) => c.id === id)?.en || id;

  root.innerHTML = `
    <div class="page-head">
      <div><h1>Products & stock</h1><p>Prices and stock changes show on the shop straight away.</p></div>
      <div class="actions">${can("products.edit") ? `<a class="btn btn-primary" href="#/products/new">${icon("plus")} Add product</a>` : ""}</div>
    </div>
    <div class="filters">
      <input type="search" id="q" placeholder="Search products" value="${esc(f.q)}" aria-label="Search products">
      <select id="cat" aria-label="Category"><option value="">All categories</option>
        ${categories.map((c) => `<option value="${esc(c.id)}" ${f.cat === c.id ? "selected" : ""}>${esc(c.en)}</option>`).join("")}</select>
      <select id="filter" aria-label="Stock filter">
        <option value="">All products</option>
        <option value="low" ${f.filter === "low" ? "selected" : ""}>Running low</option>
        <option value="out" ${f.filter === "out" ? "selected" : ""}>Out of stock</option>
        <option value="hidden" ${f.filter === "hidden" ? "selected" : ""}>Hidden from shop</option>
      </select>
      <span class="muted" id="count"></span>
    </div>
    <div class="card" id="table"></div>`;

  function render() {
    setHashQuery(f);
    const term = f.q.toLowerCase();
    const list = products.filter((p) =>
      (!term || `${p.en} ${p.ne} ${p.origin}`.toLowerCase().includes(term)) &&
      (!f.cat || p.cat === f.cat) &&
      (f.filter !== "low" || (p.active && p.stock <= p.lowStock)) &&
      (f.filter !== "out" || (p.active && p.stock === 0)) &&
      (f.filter !== "hidden" || !p.active));
    root.querySelector("#count").textContent = `${list.length} of ${products.length}`;
    root.querySelector("#table").innerHTML = `<div class="table-wrap"><table class="data">
      <thead><tr><th></th><th>Product</th><th>Category</th><th class="num">Price</th><th class="num">Stock</th><th class="num">Sold</th><th>Shop</th><th></th></tr></thead>
      <tbody>${list.map((p) => `
        <tr class="clickable" data-id="${p.id}">
          <td style="width:52px">${p.image ? `<img class="thumb" src="/${esc(p.image)}" alt="" loading="lazy">` : '<div class="thumb"></div>'}</td>
          <td><div class="cell-main">${esc(p.en)}</div><div class="cell-sub ne">${esc(p.ne)}</div></td>
          <td>${esc(catName(p.cat))}</td>
          <td class="num">${npr(p.price)}<div class="cell-sub">per ${esc(p.unit)}</div></td>
          <td class="num">${stockPill(p)}</td>
          <td class="num">${p.sold}</td>
          <td>${p.active ? '<span class="pill ok">Visible</span>' : '<span class="pill neutral">Hidden</span>'}</td>
          <td class="num">${can("stock.update") ? `<button type="button" class="btn btn-default btn-sm" data-stock="${p.id}">Adjust stock</button>` : ""}</td>
        </tr>`).join("") || `<tr><td colspan="8" class="empty">No products match.</td></tr>`}</tbody></table></div>`;
  }

  root.querySelector("#q").addEventListener("input", debounce((e) => { f.q = e.target.value.trim(); render(); }, 200));
  root.querySelector("#cat").addEventListener("change", (e) => { f.cat = e.target.value; render(); });
  root.querySelector("#filter").addEventListener("change", (e) => { f.filter = e.target.value; render(); });
  root.querySelector("#table").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-stock]");
    if (btn) {
      e.stopPropagation();
      const p = products.find((x) => x.id === Number(btn.dataset.stock));
      if (await adjustStock(p)) { products = await api("/products"); render(); }
      return;
    }
    const row = e.target.closest("tr[data-id]");
    if (row) location.hash = `#/products/${row.dataset.id}`;
  });

  render();
  return { onEvent: debounce(async (type) => { if (type.startsWith("product") || type === "order.created") { products = await api("/products"); render(); } }, 400) };
}

function stockPill(p) {
  if (p.stock === 0) return '<span class="pill bad">Out of stock</span>';
  if (p.stock <= p.lowStock) return `<span class="pill warn">${p.stock} ${esc(p.unit)}</span>`;
  return `${p.stock} <span class="cell-sub">${esc(p.unit)}</span>`;
}

export async function adjustStock(p) {
  return modal({
    title: `Stock: ${p.en}`,
    body: `<p style="margin-bottom:12px">Now in stock: <strong>${p.stock} ${esc(p.unit)}</strong></p>
      <div class="form-grid">
        <div><label for="mode">Change</label>
          <select id="mode" name="mode"><option value="add">Add stock</option><option value="remove">Remove stock</option><option value="set">Set exact count</option></select></div>
        <div><label for="amount">Amount (${esc(p.unit)})</label><input id="amount" name="amount" type="number" min="0" max="100000" step="1" required></div>
        <div class="full"><label for="reason">Reason</label>
          <select id="reason" name="reason">
            <option>New delivery from farm</option><option>Spoiled or damaged</option><option>Stock count correction</option>
            <option>Returned by customer</option><option>Other</option></select></div>
      </div>`,
    onSubmit: (form) => {
      const amount = Math.floor(Number(form.amount.value));
      const mode = form.mode.value;
      const body = mode === "set" ? { set: amount } : { change: mode === "remove" ? -amount : amount };
      body.reason = form.reason.value;
      return api(`/products/${p.id}/stock`, { method: "POST", body }).then((r) => { toast(`${p.en}: ${r.stock} ${p.unit} in stock`); return r; });
    },
  });
}

// ---------- Add / edit product ----------
export async function productEditView(root, id) {
  const isNew = id === "new";
  const [categories, p] = await Promise.all([api("/categories"), isNew ? null : api(`/products/${id}`)]);
  const editable = can("products.edit");
  const v = p || { cat: categories[0]?.id, ne: "", en: "", unit: "kg", price: "", rating: 4.5, lowStock: 10, origin: "", desc: "", storage: "", nutrition: [], active: true, image: "" };
  const dis = editable ? "" : "disabled";

  root.innerHTML = `
    <a class="back" href="#/products">← Products</a>
    <div class="page-head">
      <div><h1>${isNew ? "Add product" : esc(v.en)}</h1>${isNew ? "" : `<p>Last changed ${v.updatedAt ? ago(v.updatedAt) : "never"} · <a href="/product.html?id=${v.id}" target="_blank" rel="noopener">View on shop</a></p>`}</div>
      <div class="actions">
        ${!isNew && can("products.delete") ? '<button type="button" class="btn btn-danger" id="delete">Delete</button>' : ""}
      </div>
    </div>
    <div class="detail-grid">
      <form class="card" id="form" novalidate>
        <div class="card-body">
          <div class="form-error" id="error" hidden></div>
          <div class="form-grid">
            <div><label for="en">Name (English)</label><input id="en" name="en" required maxlength="80" value="${esc(v.en)}" ${dis}></div>
            <div><label for="ne">Name (Nepali)</label><input id="ne" name="ne" class="ne" required maxlength="80" value="${esc(v.ne)}" ${dis}></div>
            <div><label for="cat">Category</label><select id="cat" name="cat" ${dis}>${categories.map((c) =>
              `<option value="${esc(c.id)}" ${c.id === v.cat ? "selected" : ""}>${esc(c.en)}</option>`).join("")}</select></div>
            <div><label for="origin">Grown in</label><input id="origin" name="origin" maxlength="120" value="${esc(v.origin)}" placeholder="e.g. Kavre District, Nepal" ${dis}></div>
            <div><label for="price">Price (NPR)</label><input id="price" name="price" type="number" min="1" step="0.01" required value="${esc(v.price)}" ${dis}></div>
            <div><label for="unit">Sold per</label><input id="unit" name="unit" required maxlength="30" value="${esc(v.unit)}" placeholder="kg, bunch, litre, 500 g" ${dis}></div>
            ${isNew ? `<div><label for="stock">Opening stock</label><input id="stock" name="stock" type="number" min="0" step="1" value="0"></div>` : ""}
            <div><label for="lowStock">Warn when stock falls to</label><input id="lowStock" name="lowStock" type="number" min="0" step="1" value="${esc(v.lowStock)}" ${dis}></div>
            <div><label for="rating">Freshness rating (0–5)</label><input id="rating" name="rating" type="number" min="0" max="5" step="0.1" value="${esc(v.rating)}" ${dis}></div>
            <div class="full"><label for="desc">Description</label><textarea id="desc" name="desc" rows="3" maxlength="1000" ${dis}>${esc(v.desc)}</textarea></div>
            <div class="full"><label for="storage">Storage tips</label><textarea id="storage" name="storage" rows="2" maxlength="500" ${dis}>${esc(v.storage)}</textarea></div>
            <div class="full">
              <label>Nutrition (per 100 g)</label>
              <div id="nutrition" style="display:grid; gap:6px;"></div>
              ${editable ? '<button type="button" class="btn-link" id="add-nutri" style="margin-top:6px">+ Add row</button>' : ""}
            </div>
            <div class="full"><label class="check"><input type="checkbox" name="active" ${v.active ? "checked" : ""} ${dis}> Show this product on the shop</label></div>
          </div>
        </div>
        ${editable ? `<div class="card-body" style="border-top:1px solid var(--line); display:flex; gap:8px; justify-content:flex-end;">
          <a class="btn btn-default" href="#/products">Cancel</a>
          <button type="submit" class="btn btn-primary">${isNew ? "Add product" : "Save changes"}</button></div>` : ""}
      </form>

      <div class="grid">
        <section class="card">
          <div class="card-head"><h2>Photo</h2></div>
          <div class="card-body">
            <img id="photo" src="${v.image ? "/" + esc(v.image) : ""}" alt="" style="width:100%; aspect-ratio:4/3; object-fit:cover; border-radius:6px; background:#eee; ${v.image ? "" : "display:none"}">
            ${editable ? `
              <label for="image" style="margin-top:10px">Image path</label>
              <input id="image" name="image" form="form" value="${esc(v.image || "")}" placeholder="images/your-photo.jpg">
              ${isNew ? '<p class="field-hint">You can upload a photo after saving.</p>' : `
                <label for="upload" style="margin-top:10px">Or upload a photo</label>
                <input id="upload" type="file" accept="image/jpeg,image/png,image/webp">
                <p class="field-hint">JPG, PNG or WebP, up to 3 MB.</p>`}` : ""}
          </div>
        </section>
        ${isNew ? "" : `
        <section class="card">
          <div class="card-head"><h2>Stock: ${v.stock} ${esc(v.unit)}</h2>${can("stock.update") ? '<button type="button" class="btn btn-default btn-sm" id="adjust">Adjust</button>' : ""}</div>
          <div class="table-wrap"><table class="data"><tbody>
            ${v.movements.map((m) => `<tr><td><div>${esc(m.reason)}</div><div class="cell-sub">${fmtDateTime(m.at)}${m.admin_name ? ` · ${esc(m.admin_name)}` : ""}</div></td>
              <td class="num" style="color:${m.change < 0 ? "var(--danger)" : "var(--ok)"}">${m.change > 0 ? "+" : ""}${m.change}</td>
              <td class="num cell-sub">→ ${m.stock_after}</td></tr>`).join("") || '<tr><td class="empty">No stock changes yet.</td></tr>'}
          </tbody></table></div>
        </section>`}
      </div>
    </div>`;

  const nutriEl = root.querySelector("#nutrition");
  const addRow = ([k, val] = ["", ""]) => {
    const row = document.createElement("div");
    row.style.cssText = "display:grid; grid-template-columns:1fr 1fr auto; gap:6px;";
    row.innerHTML = `<input placeholder="e.g. Protein" value="${esc(k)}" data-n="k" aria-label="Nutrient" ${dis}>
      <input placeholder="e.g. 2.9 g" value="${esc(val)}" data-n="v" aria-label="Amount" ${dis}>
      ${editable ? `<button type="button" class="icon-btn" aria-label="Remove row">${icon("x")}</button>` : ""}`;
    row.querySelector("button")?.addEventListener("click", () => row.remove());
    nutriEl.appendChild(row);
  };
  (v.nutrition.length ? v.nutrition : editable ? [["Energy", ""], ["Protein", ""]] : []).forEach(addRow);
  root.querySelector("#add-nutri")?.addEventListener("click", () => addRow());

  root.querySelector("#image")?.addEventListener("change", (e) => {
    const img = root.querySelector("#photo");
    img.src = "/" + e.target.value;
    img.style.display = e.target.value ? "" : "none";
  });

  root.querySelector("#upload")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast("That photo is over 3 MB.", "error"); return; }
    try {
      const { image } = await api(`/products/${v.id}/image`, { method: "POST", raw: file });
      root.querySelector("#image").value = image;
      const img = root.querySelector("#photo");
      img.src = "/" + image;
      img.style.display = "";
      toast("Photo uploaded");
    } catch (err) { toast(err.message, "error"); }
    e.target.value = "";
  });

  root.querySelector("#form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const errEl = root.querySelector("#error");
    errEl.hidden = true;
    for (const field of form.elements) if (field.willValidate && !field.checkValidity()) { field.reportValidity(); return; }
    const data = formData(form);
    const body = {
      ...data,
      price: Number(data.price), rating: Number(data.rating), lowStock: Number(data.lowStock),
      stock: data.stock !== undefined ? Number(data.stock) : undefined,
      active: form.active.checked,
      image: root.querySelector("#image")?.value.trim() || v.image || "",
      nutrition: [...nutriEl.children].map((r) => [r.querySelector('[data-n="k"]').value.trim(), r.querySelector('[data-n="v"]').value.trim()]).filter(([k, val]) => k && val),
    };
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      if (isNew) {
        const { id: newId } = await api("/products", { method: "POST", body });
        toast("Product added");
        location.hash = `#/products/${newId}`;
      } else {
        await api(`/products/${v.id}`, { method: "PUT", body });
        toast("Saved");
      }
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
      errEl.scrollIntoView({ block: "center" });
    } finally {
      submit.disabled = false;
    }
  });

  root.querySelector("#delete")?.addEventListener("click", async () => {
    const ok = await confirmDialog(`Delete "${v.en}"? Past orders keep their own copy of the name and price. If you only want to stop selling it, untick "Show this product on the shop" instead.`,
      { title: "Delete product", confirmLabel: "Delete product" });
    if (!ok) return;
    try {
      await api(`/products/${v.id}`, { method: "DELETE" });
      toast("Product deleted");
      location.hash = "#/products";
    } catch (err) { toast(err.message, "error"); }
  });

  root.querySelector("#adjust")?.addEventListener("click", async () => {
    if (await adjustStock(v)) productEditView(root, id);
  });
}

// ---------- Categories ----------
export async function categoriesView(root) {
  const editable = can("categories.edit");
  let cats = await api("/categories");

  const render = () => {
    root.innerHTML = `
      <div class="page-head">
        <div><h1>Categories</h1><p>The groups shown on the shop's home page and in the shop filters.</p></div>
        <div class="actions">${editable ? `<button type="button" class="btn btn-primary" id="add">${icon("plus")} Add category</button>` : ""}</div>
      </div>
      <div class="card"><div class="table-wrap"><table class="data">
        <thead><tr><th></th><th>Name</th><th>ID</th><th class="num">Products</th><th class="num">Order</th>${editable ? "<th></th>" : ""}</tr></thead>
        <tbody>${cats.map((c) => `
          <tr><td style="width:52px">${c.image ? `<img class="thumb" src="/${esc(c.image)}" alt="">` : ""}</td>
            <td><div class="cell-main">${esc(c.en)}</div><div class="cell-sub ne">${esc(c.ne)}</div></td>
            <td><code>${esc(c.id)}</code></td><td class="num"><a href="#/products?cat=${esc(c.id)}">${c.products}</a></td><td class="num">${c.sort}</td>
            ${editable ? `<td class="num"><button type="button" class="btn btn-default btn-sm" data-edit="${esc(c.id)}">Edit</button>
              <button type="button" class="btn btn-danger btn-sm" data-del="${esc(c.id)}">Delete</button></td>` : ""}
          </tr>`).join("")}</tbody></table></div></div>`;
  };

  async function edit(c) {
    const ok = await modal({
      title: c ? `Edit ${c.en}` : "Add category",
      body: `<div class="form-grid">
        <div><label for="c-en">Name (English)</label><input id="c-en" name="en" required maxlength="60" value="${esc(c?.en || "")}"></div>
        <div><label for="c-ne">Name (Nepali)</label><input id="c-ne" name="ne" required maxlength="40" value="${esc(c?.ne || "")}" class="ne"></div>
        ${c ? "" : `<div><label for="c-id">Short ID</label><input id="c-id" name="id" required maxlength="30" pattern="[a-z0-9\\-]+" placeholder="e.g. grains"><p class="field-hint">Lowercase letters, numbers and dashes. Can't be changed later.</p></div>`}
        <div><label for="c-sort">Order in list</label><input id="c-sort" name="sort" type="number" min="0" max="999" value="${c?.sort ?? cats.length}"></div>
        <div class="full"><label for="c-image">Photo path</label><input id="c-image" name="image" value="${esc(c?.image || "")}" placeholder="images/your-photo.jpg"></div>
      </div>`,
      onSubmit: (form) => {
        const body = { ...formData(form), sort: Number(form.sort.value) };
        return c ? api(`/categories/${c.id}`, { method: "PUT", body }) : api("/categories", { method: "POST", body });
      },
    });
    if (ok) { toast("Category saved"); cats = await api("/categories"); render(); }
  }

  root.addEventListener("click", async (e) => {
    if (e.target.closest("#add")) return edit(null);
    const ed = e.target.closest("[data-edit]");
    if (ed) return edit(cats.find((c) => c.id === ed.dataset.edit));
    const del = e.target.closest("[data-del]");
    if (del) {
      const c = cats.find((x) => x.id === del.dataset.del);
      if (!(await confirmDialog(`Delete the "${c.en}" category?`, { confirmLabel: "Delete" }))) return;
      try {
        await api(`/categories/${c.id}`, { method: "DELETE" });
        cats = await api("/categories");
        render();
        toast("Category deleted");
      } catch (err) { toast(err.message, "error"); }
    }
  });

  render();
  return { onEvent: debounce(async (type) => { if (type.startsWith("category") || type.startsWith("product")) { cats = await api("/categories"); render(); } }, 400) };
}
