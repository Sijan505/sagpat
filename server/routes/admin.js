// Staff API. Every route checks permissions on the server.
import express, { Router } from "express";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { one, all, run, now, transaction, getSettings, saveSettings, audit, productFromRow, DEFAULT_SETTINGS } from "../db.js";
import {
  verifyPassword, hashPassword, validatePassword, createSession, destroySession, destroyAllSessions,
  requireAuth, requirePerm, rateLimit,
} from "../auth.js";
import { ROLES, STATUSES, can, permissionsFor, allowedTransitions, canViewOrder, DELIVERY_VISIBLE } from "../permissions.js";
import { subscribe, broadcast } from "../events.js";
import { getOrder, setStatus, addNote, changeStock, summary, slotBookings, OrderError, PAYMENT_METHODS } from "../orders.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const fail = (message, status = 400) => { throw new OrderError(message, status); };
const str = (v, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v, { min = -Infinity, max = Infinity } = {}) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};
// Nepal calendar day → UTC ISO range
const dayStart = (ymd) => new Date(`${ymd}T00:00:00+05:45`).toISOString();
const dayEnd = (ymd) => new Date(new Date(`${ymd}T00:00:00+05:45`).getTime() + 86400000).toISOString();
const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
const nepalToday = () => new Date(Date.now() + 345 * 60000).toISOString().slice(0, 10);
const NPT = "'+5 hours', '+45 minutes'";

export function adminRoutes() {
  const r = Router();

  // ---------- Auth ----------
  r.post("/login", rateLimit({ key: "login", max: 10, windowMs: 15 * 60 * 1000 }), (req, res) => {
    const email = str(req.body?.email, 120);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const admin = one("SELECT * FROM admins WHERE email = :email", { email });
    // Same message whether the email or the password was wrong
    if (!admin || !admin.active || !verifyPassword(password, admin.password_hash)) {
      return res.status(401).json({ error: "Email or password is incorrect." });
    }
    createSession(res, admin.id);
    run("UPDATE admins SET last_login_at = :at WHERE id = :id", { at: now(), id: admin.id });
    audit(admin, "auth.login");
    res.json({ ok: true });
  });

  r.post("/logout", (req, res) => {
    destroySession(req, res);
    res.json({ ok: true });
  });

  r.get("/me", requireAuth, (req, res) => {
    res.json({ ...req.admin, roleLabel: ROLES[req.admin.role].label, permissions: permissionsFor(req.admin.role), statuses: STATUSES });
  });

  r.post("/me/password", requireAuth, (req, res) => {
    const row = one("SELECT password_hash FROM admins WHERE id = :id", { id: req.admin.id });
    if (!verifyPassword(String(req.body?.current || ""), row.password_hash)) fail("Your current password is incorrect.");
    const problem = validatePassword(req.body?.next);
    if (problem) fail(problem);
    run("UPDATE admins SET password_hash = :h WHERE id = :id", { h: hashPassword(req.body.next), id: req.admin.id });
    destroyAllSessions(req.admin.id);
    createSession(res, req.admin.id);
    audit(req.admin, "auth.password_changed");
    res.json({ ok: true });
  });

  r.get("/events", requireAuth, subscribe);

  // ---------- Dashboard (contents depend on role) ----------
  r.get("/dashboard", requireAuth, (req, res) => {
    const a = req.admin;
    const today = nepalToday();
    const out = {};

    if (can(a, "orders.view")) {
      const t = one(`SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS revenue FROM orders
                     WHERE created_at >= :from AND created_at < :to AND status != 'cancelled'`, { from: dayStart(today), to: dayEnd(today) });
      out.orders = {
        today: t.n,
        revenueToday: can(a, "orders.finance") ? t.revenue : undefined,
        byStatus: Object.fromEntries(all("SELECT status, COUNT(*) AS n FROM orders GROUP BY status").map((x) => [x.status, x.n])),
        recent: listOrders(a, { limit: 8 }).orders,
      };
    }
    if (can(a, "deliveries.view")) {
      out.deliveries = {
        date: today,
        byStatus: Object.fromEntries(all(`SELECT status, COUNT(*) AS n FROM orders WHERE delivery_date = :d GROUP BY status`, { d: today })
          .map((x) => [x.status, x.n])),
        failed: all("SELECT COUNT(*) AS n FROM orders WHERE status = 'failed'")[0].n,
        overdue: one(`SELECT COUNT(*) AS n FROM orders WHERE delivery_date < :d AND status IN ('pending','confirmed','packed','out_for_delivery')`, { d: today }).n,
        slots: slotLoad(today),
      };
    }
    if (can(a, "products.view")) {
      out.products = {
        total: one("SELECT COUNT(*) AS n FROM products").n,
        active: one("SELECT COUNT(*) AS n FROM products WHERE active = 1").n,
        outOfStock: one("SELECT COUNT(*) AS n FROM products WHERE active = 1 AND stock = 0").n,
        lowStock: all("SELECT id, ne, en, stock, low_stock, unit, image FROM products WHERE active = 1 AND stock <= low_stock ORDER BY stock, en LIMIT 10"),
        movements: all(`SELECT m.at, m.change, m.stock_after, m.reason, m.admin_name, p.en, p.unit FROM stock_movements m
                        LEFT JOIN products p ON p.id = m.product_id ORDER BY m.id DESC LIMIT 8`),
      };
    }
    if (can(a, "reports.view")) {
      out.sales = one(`SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue FROM orders
                       WHERE created_at >= :from AND status != 'cancelled'`, { from: dayStart(addDays(today, -6)) });
      out.customers = one("SELECT COUNT(*) AS n FROM customers").n;
    }
    res.json(out);
  });

  // ---------- Orders ----------
  r.get("/orders", requirePerm("orders.view", "deliveries.view"), (req, res) => {
    res.json(listOrders(req.admin, req.query));
  });

  r.get("/orders.csv", requirePerm("orders.export"), (req, res) => {
    const { orders } = listOrders(req.admin, { ...req.query, limit: 5000, page: 1 });
    const cols = ["id", "createdAt", "status", "name", "phone", "district", "deliveryType", "slot", "deliveryDate",
      "paymentMethod", "paymentStatus", "items", "subtotal", "deliveryFee", "tax", "total"];
    const cell = (v) => {
      let s = v == null ? "" : String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop spreadsheet formula injection
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cols.join(","), ...orders.map((o) => cols.map((c) => cell(o[c])).join(","))].join("\r\n");
    audit(req.admin, "orders.export", `${orders.length} orders`);
    res.type("text/csv").attachment(`sagpat-orders-${nepalToday()}.csv`).send("﻿" + csv);
  });

  r.get("/orders/:id", requirePerm("orders.view", "deliveries.view"), (req, res) => {
    const order = getOrder(String(req.params.id));
    if (!order || !canViewOrder(req.admin, order)) fail("Order not found.", 404);
    res.json(shapeOrder(req.admin, order));
  });

  r.post("/orders/:id/status", requirePerm("orders.update", "deliveries.update"), (req, res) => {
    const order = getOrder(String(req.params.id));
    if (!order || !canViewOrder(req.admin, order)) fail("Order not found.", 404);
    const updated = setStatus(order.id, str(req.body?.status, 30), req.admin, str(req.body?.note, 300));
    res.json(shapeOrder(req.admin, updated));
  });

  r.post("/orders/:id/notes", requirePerm("orders.update", "deliveries.update"), (req, res) => {
    const order = getOrder(String(req.params.id));
    if (!order || !canViewOrder(req.admin, order)) fail("Order not found.", 404);
    const note = str(req.body?.note, 500);
    if (!note) fail("Write a note first.");
    res.json(shapeOrder(req.admin, addNote(order.id, req.admin, note)));
  });

  // Rider and slot (deliveries), payment status (finance)
  r.patch("/orders/:id", requirePerm("orders.update", "deliveries.update"), (req, res) => {
    const order = getOrder(String(req.params.id));
    if (!order || !canViewOrder(req.admin, order)) fail("Order not found.", 404);
    const changes = [];
    const b = req.body || {};

    if (b.rider !== undefined) {
      if (!can(req.admin, "deliveries.update")) fail("You can't assign riders.", 403);
      run("UPDATE orders SET rider = :r WHERE id = :id", { r: str(b.rider, 60) || null, id: order.id });
      changes.push(`Rider: ${str(b.rider, 60) || "none"}`);
    }
    if (b.slot !== undefined || b.deliveryDate !== undefined) {
      if (!can(req.admin, "deliveries.update")) fail("You can't change delivery slots.", 403);
      const slot = str(b.slot ?? order.delivery.slot, 80);
      const date = str(b.deliveryDate ?? order.delivery.date, 10);
      if (!isYmd(date)) fail("Pick a valid delivery date.");
      const s = one("SELECT capacity FROM delivery_slots WHERE label = :l AND active = 1", { l: slot });
      if (!s) fail("That slot doesn't exist.");
      if ((slot !== order.delivery.slot || date !== order.delivery.date) && slotBookings(slot, date) >= s.capacity) fail("That slot is already full.");
      run("UPDATE orders SET slot = :s, delivery_date = :d, expected_from = :d, expected_to = :d WHERE id = :id", { s: slot, d: date, id: order.id });
      changes.push(`Delivery moved to ${date}, ${slot}`);
    }
    if (b.paymentStatus !== undefined) {
      if (!can(req.admin, "orders.finance")) fail("You can't change payment status.", 403);
      const ps = str(b.paymentStatus, 40);
      if (!["Paid", "Refunded", ...Object.values(PAYMENT_METHODS).map((p) => p.status)].includes(ps)) fail("Unknown payment status.");
      run("UPDATE orders SET payment_status = :p WHERE id = :id", { p: ps, id: order.id });
      changes.push(`Payment: ${ps}`);
    }
    if (!changes.length) fail("Nothing to update.");
    run("UPDATE orders SET updated_at = :at WHERE id = :id", { at: now(), id: order.id });
    const note = changes.join(" · ");
    run("INSERT INTO order_events (order_id, at, type, note, admin_name) VALUES (:id, :at, 'update', :note, :by)", {
      id: order.id, at: now(), note, by: req.admin.name,
    });
    audit(req.admin, "order.update", `${order.id}: ${note}`);
    const updated = getOrder(order.id);
    broadcast("order.updated", summary(updated));
    res.json(shapeOrder(req.admin, updated));
  });

  r.delete("/orders/:id", requirePerm("orders.delete"), (req, res) => {
    const order = getOrder(String(req.params.id));
    if (!order) fail("Order not found.", 404);
    transaction(() => {
      // Undo the order's effect on products: stock comes back unless it was
      // delivered, and the sold count drops (cancelling already did both)
      if (order.status !== "cancelled") {
        for (const i of order.items) {
          if (!one("SELECT 1 AS x FROM products WHERE id = :id", { id: i.productId })) continue;
          if (order.status !== "delivered") changeStock(i.productId, i.qty, `Order ${order.id} deleted`, req.admin.name);
          run("UPDATE products SET sold = MAX(0, sold - :q) WHERE id = :id", { q: i.qty, id: i.productId });
        }
      }
      run("DELETE FROM orders WHERE id = :id", { id: order.id });
      audit(req.admin, "order.delete", `${order.id} (${order.customer.name}, ${order.totals.total})`);
    });
    broadcast("order.deleted", { id: order.id, status: order.status });
    res.json({ ok: true });
  });

  // ---------- Delivery slots ----------
  r.get("/slots", requirePerm("deliveries.view", "slots.manage"), (req, res) => {
    const date = isYmd(req.query.date) ? req.query.date : nepalToday();
    res.json({ date, slots: slotLoad(date, true) });
  });

  r.post("/slots", requirePerm("slots.manage"), (req, res) => {
    const s = slotInput(req.body);
    const { lastInsertRowid } = run("INSERT INTO delivery_slots (type, label, capacity, active, sort) VALUES (:type, :label, :capacity, :active, :sort)", s);
    audit(req.admin, "slot.create", s.label);
    broadcast("slot.updated", {});
    res.status(201).json({ id: Number(lastInsertRowid) });
  });

  r.put("/slots/:id", requirePerm("slots.manage"), (req, res) => {
    const id = int(req.params.id);
    const old = one("SELECT * FROM delivery_slots WHERE id = :id", { id });
    if (!old) fail("Slot not found.", 404);
    const s = slotInput(req.body);
    transaction(() => {
      run("UPDATE delivery_slots SET type = :type, label = :label, capacity = :capacity, active = :active, sort = :sort WHERE id = :id", { ...s, id });
      // Keep existing orders pointing at the renamed slot
      if (old.label !== s.label) run("UPDATE orders SET slot = :n WHERE slot = :o", { n: s.label, o: old.label });
    });
    audit(req.admin, "slot.update", s.label);
    broadcast("slot.updated", {});
    res.json({ ok: true });
  });

  r.delete("/slots/:id", requirePerm("slots.manage"), (req, res) => {
    const id = int(req.params.id);
    const slot = one("SELECT label FROM delivery_slots WHERE id = :id", { id });
    if (!slot) fail("Slot not found.", 404);
    const open = one(`SELECT COUNT(*) AS n FROM orders WHERE slot = :l AND status NOT IN ('delivered','cancelled')`, { l: slot.label }).n;
    if (open) fail(`${open} open order(s) use this slot. Turn it off instead, or move those orders first.`, 409);
    run("DELETE FROM delivery_slots WHERE id = :id", { id });
    audit(req.admin, "slot.delete", slot.label);
    broadcast("slot.updated", {});
    res.json({ ok: true });
  });

  // ---------- Products & stock ----------
  r.get("/products", requirePerm("products.view"), (_req, res) => {
    res.json(all("SELECT * FROM products ORDER BY cat, en").map(productFromRow));
  });

  r.get("/products/:id", requirePerm("products.view"), (req, res) => {
    const row = one("SELECT * FROM products WHERE id = :id", { id: int(req.params.id) ?? -1 });
    if (!row) fail("Product not found.", 404);
    const movements = all("SELECT at, change, stock_after, reason, admin_name FROM stock_movements WHERE product_id = :id ORDER BY id DESC LIMIT 30", { id: row.id });
    res.json({ ...productFromRow(row), movements });
  });

  r.post("/products", requirePerm("products.edit"), (req, res) => {
    const p = productInput(req.body);
    const id = transaction(() => {
      const { lastInsertRowid } = run(`INSERT INTO products (cat, ne, en, unit, price, rating, stock, low_stock, added, image, origin,
          description, nutrition, storage, active, updated_at)
        VALUES (:cat, :ne, :en, :unit, :price, :rating, 0, :lowStock, :added, :image, :origin, :desc, :nutrition, :storage, :active, :at)`,
      { ...p, added: nepalToday(), at: now() });
      const newId = Number(lastInsertRowid);
      if (p.stock > 0) changeStock(newId, p.stock, "Opening stock", req.admin.name);
      return newId;
    });
    audit(req.admin, "product.create", `${id}: ${p.en}`);
    broadcast("product.updated", { id });
    res.status(201).json({ id });
  });

  r.put("/products/:id", requirePerm("products.edit"), (req, res) => {
    const id = int(req.params.id);
    if (!one("SELECT 1 AS x FROM products WHERE id = :id", { id: id ?? -1 })) fail("Product not found.", 404);
    const p = productInput(req.body);
    run(`UPDATE products SET cat = :cat, ne = :ne, en = :en, unit = :unit, price = :price, rating = :rating, low_stock = :lowStock,
           image = :image, origin = :origin, description = :desc, nutrition = :nutrition, storage = :storage, active = :active, updated_at = :at
         WHERE id = :id`, { ...p, id, at: now() });
    audit(req.admin, "product.update", `${id}: ${p.en} @ ${p.price}`);
    broadcast("product.updated", { id });
    res.json({ ok: true });
  });

  r.delete("/products/:id", requirePerm("products.delete"), (req, res) => {
    const id = int(req.params.id);
    const p = one("SELECT en FROM products WHERE id = :id", { id: id ?? -1 });
    if (!p) fail("Product not found.", 404);
    // Past orders keep their own copy of the name and price, so deleting is safe
    run("DELETE FROM products WHERE id = :id", { id });
    audit(req.admin, "product.delete", `${id}: ${p.en}`);
    broadcast("product.updated", { id, deleted: true });
    res.json({ ok: true });
  });

  r.post("/products/:id/stock", requirePerm("stock.update"), (req, res) => {
    const id = int(req.params.id);
    const p = one("SELECT stock, en FROM products WHERE id = :id", { id: id ?? -1 });
    if (!p) fail("Product not found.", 404);
    const reason = str(req.body?.reason, 120) || "Manual adjustment";
    let change = int(req.body?.change, { min: -100000, max: 100000 });
    const set = req.body?.set !== undefined ? int(req.body.set, { min: 0, max: 100000 }) : null;
    if (set !== null) change = set - p.stock;
    if (change === null || (change === 0 && set === null)) fail("Enter how much stock to add or remove.");
    const stock = change === 0 ? p.stock : changeStock(id, change, reason, req.admin.name);
    audit(req.admin, "stock.update", `${p.en}: ${change > 0 ? "+" : ""}${change} (${reason})`);
    broadcast("product.stock", { id, stock });
    res.json({ stock });
  });

  // Upload a product photo (raw image body, max 3 MB)
  r.post("/products/:id/image", requirePerm("products.edit"), express.raw({ type: "image/*", limit: "3mb" }), (req, res) => {
    const id = int(req.params.id);
    if (!one("SELECT 1 AS x FROM products WHERE id = :id", { id: id ?? -1 })) fail("Product not found.", 404);
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || !buf.length) fail("Choose an image file.");
    const ext = buf[0] === 0xff && buf[1] === 0xd8 ? "jpg"
      : buf.subarray(0, 4).toString("hex") === "89504e47" ? "png"
        : buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP" ? "webp" : null;
    if (!ext) fail("Please upload a JPG, PNG or WebP image.");
    const dir = path.join(ROOT, "images", "uploads");
    mkdirSync(dir, { recursive: true });
    const file = `product-${id}-${Date.now()}.${ext}`;
    writeFileSync(path.join(dir, file), buf);
    const image = `images/uploads/${file}`;
    run("UPDATE products SET image = :image, updated_at = :at WHERE id = :id", { image, at: now(), id });
    audit(req.admin, "product.image", `${id}: ${image}`);
    broadcast("product.updated", { id });
    res.json({ image });
  });

  // ---------- Categories ----------
  r.get("/categories", requirePerm("products.view", "orders.view"), (_req, res) => {
    res.json(all(`SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.cat = c.id) AS products FROM categories c ORDER BY sort, en`));
  });

  r.post("/categories", requirePerm("categories.edit"), (req, res) => {
    const c = categoryInput(req.body);
    const id = str(req.body?.id, 30).toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!id) fail("Give the category a short ID, like \"veg\".");
    if (one("SELECT 1 AS x FROM categories WHERE id = :id", { id })) fail("That ID is already used.");
    run("INSERT INTO categories (id, ne, en, image, sort) VALUES (:id, :ne, :en, :image, :sort)", { ...c, id });
    audit(req.admin, "category.create", c.en);
    broadcast("category.updated", { id });
    res.status(201).json({ id });
  });

  r.put("/categories/:id", requirePerm("categories.edit"), (req, res) => {
    const id = String(req.params.id);
    if (!one("SELECT 1 AS x FROM categories WHERE id = :id", { id })) fail("Category not found.", 404);
    const c = categoryInput(req.body);
    run("UPDATE categories SET ne = :ne, en = :en, image = :image, sort = :sort WHERE id = :id", { ...c, id });
    audit(req.admin, "category.update", c.en);
    broadcast("category.updated", { id });
    res.json({ ok: true });
  });

  r.delete("/categories/:id", requirePerm("categories.edit"), (req, res) => {
    const id = String(req.params.id);
    const n = one("SELECT COUNT(*) AS n FROM products WHERE cat = :id", { id }).n;
    if (n) fail(`Move or delete its ${n} product(s) first.`, 409);
    run("DELETE FROM categories WHERE id = :id", { id });
    audit(req.admin, "category.delete", id);
    broadcast("category.updated", { id });
    res.json({ ok: true });
  });

  // ---------- Customers ----------
  r.get("/customers", requirePerm("customers.view"), (req, res) => {
    const q = `%${str(req.query.q, 60)}%`;
    const finance = can(req.admin, "orders.finance");
    const rows = all(`
      SELECT c.*, COUNT(o.id) AS orders, COALESCE(SUM(CASE WHEN o.status != 'cancelled' THEN o.total END), 0) AS spent,
             MAX(o.created_at) AS last_order
      FROM customers c LEFT JOIN orders o ON o.customer_id = c.id
      WHERE c.name LIKE :q OR c.phone LIKE :q OR c.district LIKE :q
      GROUP BY c.id ORDER BY last_order DESC NULLS LAST LIMIT 200`, { q });
    res.json(rows.map(({ spent, ...c }) => (finance ? { ...c, spent } : c)));
  });

  r.get("/customers/:id", requirePerm("customers.view"), (req, res) => {
    const c = one("SELECT * FROM customers WHERE id = :id", { id: int(req.params.id) ?? -1 });
    if (!c) fail("Customer not found.", 404);
    const { orders } = listOrders(req.admin, { customer: c.id, limit: 100 });
    res.json({ ...c, orders });
  });

  // ---------- Staff accounts ----------
  r.get("/users", requirePerm("users.manage"), (_req, res) => {
    res.json({
      roles: Object.fromEntries(Object.entries(ROLES).map(([k, v]) => [k, { label: v.label, description: v.description }])),
      users: all("SELECT id, name, email, role, active, last_login_at, created_at FROM admins ORDER BY active DESC, name"),
    });
  });

  r.post("/users", requirePerm("users.manage"), (req, res) => {
    const name = str(req.body?.name, 80);
    const email = str(req.body?.email, 120).toLowerCase();
    const role = str(req.body?.role, 30);
    if (!name) fail("Enter a name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("Enter a valid email.");
    if (!ROLES[role]) fail("Choose a role.");
    const problem = validatePassword(req.body?.password);
    if (problem) fail(problem);
    if (one("SELECT 1 AS x FROM admins WHERE email = :email", { email })) fail("Someone already uses that email.");
    const { lastInsertRowid } = run("INSERT INTO admins (name, email, password_hash, role, created_at) VALUES (:name, :email, :h, :role, :at)", {
      name, email, h: hashPassword(req.body.password), role, at: now(),
    });
    audit(req.admin, "user.create", `${email} as ${role}`);
    res.status(201).json({ id: Number(lastInsertRowid) });
  });

  r.put("/users/:id", requirePerm("users.manage"), (req, res) => {
    const id = int(req.params.id);
    const u = one("SELECT * FROM admins WHERE id = :id", { id: id ?? -1 });
    if (!u) fail("User not found.", 404);
    const name = str(req.body?.name, 80) || u.name;
    const role = req.body?.role !== undefined ? str(req.body.role, 30) : u.role;
    const active = req.body?.active !== undefined ? !!req.body.active : !!u.active;
    if (!ROLES[role]) fail("Choose a role.");
    if (id === req.admin.id && (role !== u.role || !active)) fail("You can't change your own role or switch off your own account.");
    const supers = one("SELECT COUNT(*) AS n FROM admins WHERE role = 'super_admin' AND active = 1 AND id != :id", { id }).n;
    if (u.role === "super_admin" && (role !== "super_admin" || !active) && supers === 0) fail("There must always be at least one active Super Admin.");
    transaction(() => {
      run("UPDATE admins SET name = :name, role = :role, active = :active WHERE id = :id", { name, role, active, id });
      if (!active || role !== u.role) destroyAllSessions(id);
    });
    audit(req.admin, "user.update", `${u.email}: ${role}${active ? "" : " (disabled)"}`);
    res.json({ ok: true });
  });

  r.post("/users/:id/password", requirePerm("users.manage"), (req, res) => {
    const id = int(req.params.id);
    const u = one("SELECT email FROM admins WHERE id = :id", { id: id ?? -1 });
    if (!u) fail("User not found.", 404);
    const problem = validatePassword(req.body?.password);
    if (problem) fail(problem);
    run("UPDATE admins SET password_hash = :h WHERE id = :id", { h: hashPassword(req.body.password), id });
    destroyAllSessions(id);
    audit(req.admin, "user.password_reset", u.email);
    res.json({ ok: true });
  });

  // ---------- Settings ----------
  r.get("/settings", requirePerm("settings.manage"), (_req, res) => res.json(getSettings()));

  r.put("/settings", requirePerm("settings.manage"), (req, res) => {
    const b = req.body || {};
    const num = (k, min, max) => {
      const v = Number(b[k]);
      if (!Number.isFinite(v) || v < min || v > max) fail(`"${k.replace(/_/g, " ")}" must be between ${min} and ${max}.`);
      return v;
    };
    const next = {
      free_delivery_over: num("free_delivery_over", 0, 100000),
      standard_fee: num("standard_fee", 0, 10000),
      express_fee: num("express_fee", 0, 10000),
      tax_rate: num("tax_rate", 0, 0.5),
      express_cutoff_hour: Math.round(num("express_cutoff_hour", 0, 23)),
      phone: str(b.phone, 40) || DEFAULT_SETTINGS.phone,
      email: str(b.email, 120) || DEFAULT_SETTINGS.email,
      accepting_orders: !!b.accepting_orders,
    };
    saveSettings(next);
    audit(req.admin, "settings.update", JSON.stringify(next));
    res.json(next);
  });

  r.get("/audit", requirePerm("audit.view"), (_req, res) => {
    res.json(all("SELECT at, admin_name, action, detail FROM audit_log ORDER BY id DESC LIMIT 200"));
  });

  // ---------- Reports ----------
  r.get("/reports", requirePerm("reports.view"), (req, res) => {
    const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    const to = nepalToday();
    const from = addDays(to, -(days - 1));
    const range = { from: dayStart(from), to: dayEnd(to) };
    const valid = "created_at >= :from AND created_at < :to AND status != 'cancelled'";

    const byDay = Object.fromEntries(all(`
      SELECT date(created_at, ${NPT}) AS day, COUNT(*) AS orders, SUM(total) AS revenue
      FROM orders WHERE ${valid} GROUP BY day`, range).map((d) => [d.day, d]));
    const series = Array.from({ length: days }, (_, i) => {
      const day = addDays(from, i);
      return { day, orders: byDay[day]?.orders || 0, revenue: Math.round(byDay[day]?.revenue || 0) };
    });

    const totals = one(`SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue, COUNT(DISTINCT customer_id) AS customers
                        FROM orders WHERE ${valid}`, range);
    const prevRange = { from: dayStart(addDays(from, -days)), to: dayStart(from) };
    const prev = one(`SELECT COUNT(*) AS orders, COALESCE(SUM(total), 0) AS revenue FROM orders WHERE ${valid}`, prevRange);
    const newCustomers = one("SELECT COUNT(*) AS n FROM customers WHERE created_at >= :from AND created_at < :to", range).n;
    const cancelled = one("SELECT COUNT(*) AS n FROM orders WHERE created_at >= :from AND created_at < :to AND status = 'cancelled'", range).n;

    res.json({
      days, from, to,
      totals: { ...totals, aov: totals.orders ? totals.revenue / totals.orders : 0, newCustomers, cancelled },
      previous: prev,
      series,
      topProducts: all(`
        SELECT i.en, i.ne, SUM(i.qty) AS qty, SUM(i.qty * i.price) AS revenue FROM order_items i
        JOIN orders o ON o.id = i.order_id WHERE o.${valid.replace(/ AND /g, " AND o.")}
        GROUP BY i.product_id ORDER BY revenue DESC LIMIT 8`, range),
      byCategory: all(`
        SELECT COALESCE(c.en, 'Removed products') AS label, SUM(i.qty * i.price) AS revenue FROM order_items i
        JOIN orders o ON o.id = i.order_id LEFT JOIN products p ON p.id = i.product_id LEFT JOIN categories c ON c.id = p.cat
        WHERE o.${valid.replace(/ AND /g, " AND o.")} GROUP BY label ORDER BY revenue DESC`, range),
      byPayment: all(`SELECT payment_method AS method, COUNT(*) AS orders, SUM(total) AS revenue FROM orders WHERE ${valid}
                      GROUP BY payment_method ORDER BY revenue DESC`, range)
        .map((p) => ({ ...p, label: PAYMENT_METHODS[p.method]?.label || p.method })),
      byDelivery: all(`SELECT delivery_type AS type, COUNT(*) AS orders FROM orders WHERE ${valid} GROUP BY delivery_type`, range),
      byDistrict: all(`SELECT ship_district AS district, COUNT(*) AS orders, SUM(total) AS revenue FROM orders WHERE ${valid}
                       GROUP BY ship_district ORDER BY orders DESC LIMIT 8`, range),
      byStatus: all("SELECT status, COUNT(*) AS n FROM orders WHERE created_at >= :from AND created_at < :to GROUP BY status", range),
    });
  });

  return r;
}

// ---------- Helpers ----------
function addDays(ymd, n) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function listOrders(admin, q = {}) {
  const where = [];
  const params = {};
  const finance = can(admin, "orders.finance");

  let statuses = String(q.status || "").split(",").filter((s) => STATUSES[s]);
  if (!can(admin, "orders.view")) {
    // Delivery staff only see orders that still need to go out
    statuses = statuses.length ? statuses.filter((s) => DELIVERY_VISIBLE.includes(s)) : DELIVERY_VISIBLE;
    if (!statuses.length) return { orders: [], total: 0, page: 1, pages: 1 };
  }
  if (statuses.length) {
    where.push(`o.status IN (${statuses.map((_, i) => `:s${i}`).join(",")})`);
    statuses.forEach((s, i) => (params[`s${i}`] = s));
  }
  if (q.q) {
    where.push("(o.id LIKE :q OR o.ship_name LIKE :q OR o.ship_phone LIKE :q OR o.ship_district LIKE :q)");
    params.q = `%${String(q.q).trim().slice(0, 60)}%`;
  }
  if (isYmd(q.from)) { where.push("o.created_at >= :from"); params.from = dayStart(q.from); }
  if (isYmd(q.to)) { where.push("o.created_at < :to"); params.to = dayEnd(q.to); }
  if (isYmd(q.deliveryDate)) { where.push("o.delivery_date = :dd"); params.dd = q.deliveryDate; }
  if (q.deliveryType === "express" || q.deliveryType === "standard") { where.push("o.delivery_type = :dt"); params.dt = q.deliveryType; }
  if (q.customer) { where.push("o.customer_id = :cid"); params.cid = Number(q.customer) || -1; }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limit = Math.min(Number(q.limit) || 25, 5000);
  const page = Math.max(1, Number(q.page) || 1);
  const total = one(`SELECT COUNT(*) AS n FROM orders o ${whereSql}`, params).n;
  const order = q.sort === "delivery" ? "o.delivery_date, o.slot, o.created_at" : "o.created_at DESC";

  const rows = all(`
    SELECT o.*, (SELECT SUM(qty) FROM order_items i WHERE i.order_id = o.id) AS item_count
    FROM orders o ${whereSql} ORDER BY ${order} LIMIT ${limit} OFFSET ${(page - 1) * limit}`, params);

  return {
    total, page, pages: Math.max(1, Math.ceil(total / limit)),
    orders: rows.map((o) => ({
      id: o.id, createdAt: o.created_at, status: o.status, name: o.ship_name, phone: o.ship_phone, district: o.ship_district,
      address: `${o.ship_address}, ${o.ship_landmark}`, deliveryType: o.delivery_type, slot: o.slot, deliveryDate: o.delivery_date,
      rider: o.rider, items: o.item_count, paymentMethod: o.payment_method, paymentStatus: o.payment_status,
      ...(finance
        ? { subtotal: o.subtotal, deliveryFee: o.delivery_fee, tax: o.tax, total: o.total }
        : { collect: o.payment_method === "cod" && o.payment_status !== "Paid" ? o.total : 0 }),
      transitions: allowedTransitions(admin, o.status),
    })),
  };
}

function shapeOrder(admin, o) {
  const out = { ...o, transitions: allowedTransitions(admin, o.status) };
  delete out.accessKey;
  if (!can(admin, "orders.finance")) {
    out.collect = o.payment.method === "cod" && o.payment.status !== "Paid" ? o.totals.total : 0;
    delete out.totals;
    out.items = o.items.map(({ price, ...i }) => i);
  }
  return out;
}

function slotLoad(date, includeInactive = false) {
  return all(`SELECT * FROM delivery_slots ${includeInactive ? "" : "WHERE active = 1"} ORDER BY sort, id`).map((s) => ({
    ...s, active: !!s.active, booked: slotBookings(s.label, date),
  }));
}

function slotInput(b = {}) {
  const type = str(b.type, 30);
  if (!["standard", "express_today", "express_tomorrow"].includes(type)) fail("Choose a slot type.");
  const label = str(b.label, 80);
  if (!label) fail("Give the slot a name, like \"Morning (7–10 AM)\".");
  const capacity = int(b.capacity, { min: 1, max: 1000 });
  if (capacity === null) fail("Capacity must be a whole number between 1 and 1000.");
  return { type, label, capacity, active: b.active === undefined ? true : !!b.active, sort: int(b.sort, { min: 0, max: 999 }) ?? 0 };
}

function productInput(b = {}) {
  const cat = str(b.cat, 30);
  if (!one("SELECT 1 AS x FROM categories WHERE id = :cat", { cat })) fail("Choose a category.");
  const ne = str(b.ne, 80);
  const en = str(b.en, 80);
  if (!ne || !en) fail("Enter the product name in Nepali and English.");
  const unit = str(b.unit, 30);
  if (!unit) fail("Enter a unit, like kg, bunch or litre.");
  const price = Number(b.price);
  if (!(price > 0 && price <= 100000)) fail("Enter a price above 0.");
  const rating = b.rating === undefined || b.rating === "" ? 4.5 : Number(b.rating);
  if (!(rating >= 0 && rating <= 5)) fail("Freshness rating must be between 0 and 5.");
  const image = str(b.image, 200);
  if (image && !/^images\/[\w\-/.]+\.(jpe?g|png|webp)$/i.test(image)) fail("Image must be a file in the images/ folder.");
  const nutrition = Array.isArray(b.nutrition)
    ? b.nutrition.filter((r) => Array.isArray(r) && str(r[0], 40)).slice(0, 12).map(([k, v]) => [str(k, 40), str(v, 40)])
    : [];
  return {
    cat, ne, en, unit, price: Math.round(price * 100) / 100, rating: Math.round(rating * 10) / 10,
    stock: int(b.stock, { min: 0, max: 100000 }) ?? 0,
    lowStock: int(b.lowStock, { min: 0, max: 100000 }) ?? 10,
    image: image || null, origin: str(b.origin, 120), desc: str(b.desc, 1000), storage: str(b.storage, 500),
    nutrition: JSON.stringify(nutrition), active: b.active === undefined ? true : !!b.active,
  };
}

function categoryInput(b = {}) {
  const ne = str(b.ne, 40);
  const en = str(b.en, 60);
  if (!ne || !en) fail("Enter the category name in Nepali and English.");
  const image = str(b.image, 200);
  if (image && !/^images\/[\w\-/.]+\.(jpe?g|png|webp)$/i.test(image)) fail("Image must be a file in the images/ folder.");
  return { ne, en, image: image || null, sort: int(b.sort, { min: 0, max: 999 }) ?? 0 };
}
