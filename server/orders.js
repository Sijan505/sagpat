// Order creation and status changes. Prices, stock and totals are always
// worked out here on the server, never trusted from the browser.
import { randomBytes } from "node:crypto";
import { db, one, all, run, now, transaction, getSettings, audit } from "./db.js";
import { STATUSES, TRANSITIONS, allowedTransitions } from "./permissions.js";
import { broadcast } from "./events.js";

export const PAYMENT_METHODS = {
  cod: { label: "Cash on Delivery", status: "Pay on delivery" },
  bank: { label: "Bank Transfer", status: "Awaiting bank transfer" },
  khalti: { label: "Khalti", status: "Payment pending" },
  esewa: { label: "eSewa", status: "Payment pending" },
};

export class OrderError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const round2 = (n) => Math.round(n * 100) / 100;

export function calcTotals(subtotal, deliveryType, s = getSettings()) {
  let fee = 0;
  if (subtotal > 0) fee = deliveryType === "express" ? s.express_fee : subtotal >= s.free_delivery_over ? 0 : s.standard_fee;
  const tax = round2(subtotal * s.tax_rate);
  return { subtotal: round2(subtotal), delivery: fee, tax, total: round2(subtotal + fee + tax) };
}

// Nepal time (UTC+5:45) so the 2 PM cutoff and dates match the shop's clock
const NPT_OFFSET_MIN = 345;
const nepalNow = (d = new Date()) => new Date(d.getTime() + NPT_OFFSET_MIN * 60000);
const ymd = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

export function deliveryWindow(type, at = new Date(), s = getSettings()) {
  const local = nepalNow(at);
  if (type === "express") {
    const sameDay = local.getUTCHours() < s.express_cutoff_hour;
    const day = sameDay ? local : addDays(local, 1);
    return { slotType: sameDay ? "express_today" : "express_tomorrow", date: ymd(day), from: ymd(day), to: ymd(day) };
  }
  return { slotType: "standard", date: ymd(addDays(local, 2)), from: ymd(addDays(local, 2)), to: ymd(addDays(local, 3)) };
}

export function slotsFor(slotType) {
  return all("SELECT id, type, label, capacity FROM delivery_slots WHERE active = 1 AND type = :t ORDER BY sort, id", { t: slotType });
}

export function slotBookings(label, date) {
  return one(`SELECT COUNT(*) AS n FROM orders WHERE slot = :label AND delivery_date = :date AND status != 'cancelled'`, { label, date }).n;
}

function makeOrderId(d = nepalNow()) {
  const date = d.toISOString().slice(2, 10).replace(/-/g, "");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (;;) {
    const rand = Array.from(randomBytes(4), (b) => alphabet[b % alphabet.length]).join("");
    const id = `SGP-${date}-${rand}`;
    if (!one("SELECT 1 AS x FROM orders WHERE id = :id", { id })) return id;
  }
}

const str = (v, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function validateCheckout(body) {
  const c = body?.customer || {};
  const customer = {
    name: str(c.name, 80),
    phone: str(c.phone, 20).replace(/\D/g, ""),
    email: str(c.email, 120),
    district: str(c.district, 80),
    address: str(c.address, 300),
    landmark: str(c.landmark, 150),
  };
  if (!customer.name) throw new OrderError("Please enter your name.");
  if (!/^9[678]\d{8}$/.test(customer.phone)) throw new OrderError("Please enter a valid 10-digit mobile number.");
  if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) throw new OrderError("That email address doesn't look right.");
  if (!customer.district || !customer.address || !customer.landmark) throw new OrderError("Please fill in your full address.");

  const deliveryType = body?.delivery?.type === "express" ? "express" : "standard";
  const slot = str(body?.delivery?.slot, 80);
  const notes = str(body?.delivery?.notes, 300);
  const payment = body?.payment;
  if (!PAYMENT_METHODS[payment]) throw new OrderError("Please choose a payment method.");

  const items = Array.isArray(body?.items) ? body.items : [];
  if (!items.length || items.length > 50) throw new OrderError("Your cart is empty.");
  const merged = new Map();
  for (const i of items) {
    const id = Number(i?.id);
    const qty = Math.floor(Number(i?.qty));
    if (!Number.isInteger(id) || !(qty > 0) || qty > 999) throw new OrderError("Your cart has an invalid item.");
    merged.set(id, (merged.get(id) || 0) + qty);
  }
  return { customer, deliveryType, slot, notes, payment, items: [...merged] };
}

export function createOrder(body) {
  const settings = getSettings();
  if (!settings.accepting_orders) throw new OrderError("Sorry, we're not taking orders right now. Please try again later.", 503);
  const input = validateCheckout(body);

  const order = transaction(() => {
    // Price and stock come from the database
    const lines = input.items.map(([id, qty]) => {
      const p = one("SELECT * FROM products WHERE id = :id AND active = 1", { id });
      if (!p) throw new OrderError("One of the items in your cart is no longer available.", 409);
      if (p.stock < qty) {
        throw new OrderError(p.stock === 0 ? `${p.en} just sold out.` : `Only ${p.stock} ${p.en} left. Please reduce the quantity.`, 409);
      }
      return { p, qty };
    });

    const window = deliveryWindow(input.deliveryType, new Date(), settings);
    const slots = slotsFor(window.slotType);
    const slot = slots.find((s) => s.label === input.slot) || slots[0];
    if (!slot) throw new OrderError("No delivery slots are open for that option right now.", 409);
    if (slotBookings(slot.label, window.date) >= slot.capacity) {
      throw new OrderError(`The "${slot.label}" slot is full. Please pick another time.`, 409);
    }

    const subtotal = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
    const totals = calcTotals(subtotal, input.deliveryType, settings);
    const at = now();
    const c = input.customer;

    // One customer record per phone number; keep their latest details
    let customer = one("SELECT id FROM customers WHERE phone = :phone", { phone: c.phone });
    if (customer) {
      run(`UPDATE customers SET name = :name, email = COALESCE(NULLIF(:email, ''), email), district = :district,
           address = :address, landmark = :landmark WHERE id = :id`, { ...c, id: customer.id });
    } else {
      const r = run(`INSERT INTO customers (name, phone, email, district, address, landmark, created_at)
                     VALUES (:name, :phone, :email, :district, :address, :landmark, :at)`, { ...c, at });
      customer = { id: Number(r.lastInsertRowid) };
    }

    const id = makeOrderId();
    run(`INSERT INTO orders (id, access_key, customer_id, created_at, updated_at, status, ship_name, ship_phone, ship_email,
           ship_district, ship_address, ship_landmark, delivery_type, slot, delivery_date, expected_from, expected_to, notes,
           payment_method, payment_status, subtotal, delivery_fee, tax, total)
         VALUES (:id, :key, :cid, :at, :at, 'pending', :name, :phone, :email, :district, :address, :landmark, :dtype, :slot,
           :ddate, :efrom, :eto, :notes, :pay, :pstatus, :subtotal, :fee, :tax, :total)`, {
      id, key: randomBytes(16).toString("base64url"), cid: customer.id, at, ...c,
      dtype: input.deliveryType, slot: slot.label, ddate: window.date, efrom: window.from, eto: window.to, notes: input.notes,
      pay: input.payment, pstatus: PAYMENT_METHODS[input.payment].status,
      subtotal: totals.subtotal, fee: totals.delivery, tax: totals.tax, total: totals.total,
    });

    const addItem = db.prepare(`INSERT INTO order_items (order_id, product_id, ne, en, unit, price, qty)
                                VALUES (:id, :pid, :ne, :en, :unit, :price, :qty)`);
    for (const { p, qty } of lines) {
      addItem.run({ id, pid: p.id, ne: p.ne, en: p.en, unit: p.unit, price: p.price, qty });
      changeStock(p.id, -qty, `Order ${id}`, null);
      run("UPDATE products SET sold = sold + :q WHERE id = :id", { q: qty, id: p.id });
    }
    run("INSERT INTO order_events (order_id, at, type, status, note) VALUES (:id, :at, 'status', 'pending', 'Order placed')", { id, at });
    return getOrder(id);
  });

  broadcast("order.created", summary(order));
  for (const item of order.items) broadcast("product.stock", { id: item.productId });
  return order;
}

export function changeStock(productId, change, reason, adminName) {
  const p = one("SELECT stock FROM products WHERE id = :id", { id: productId });
  if (!p) throw new OrderError("Product not found.", 404);
  const after = p.stock + change;
  if (after < 0) throw new OrderError("Stock can't go below zero.");
  run("UPDATE products SET stock = :s, updated_at = :at WHERE id = :id", { s: after, at: now(), id: productId });
  run(`INSERT INTO stock_movements (product_id, at, change, stock_after, reason, admin_name)
       VALUES (:id, :at, :change, :after, :reason, :admin)`, { id: productId, at: now(), change, after, reason, admin: adminName });
  return after;
}

export function getOrder(id) {
  const o = one("SELECT * FROM orders WHERE id = :id", { id });
  if (!o) return null;
  return {
    id: o.id,
    accessKey: o.access_key,
    customerId: o.customer_id,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
    status: o.status,
    statusLabel: STATUSES[o.status],
    customer: { name: o.ship_name, phone: o.ship_phone, email: o.ship_email, district: o.ship_district, address: o.ship_address, landmark: o.ship_landmark },
    delivery: { type: o.delivery_type, slot: o.slot, date: o.delivery_date, from: o.expected_from, to: o.expected_to, notes: o.notes, rider: o.rider },
    payment: { method: o.payment_method, label: PAYMENT_METHODS[o.payment_method]?.label, status: o.payment_status },
    totals: { subtotal: o.subtotal, delivery: o.delivery_fee, tax: o.tax, total: o.total },
    items: all("SELECT product_id, ne, en, unit, price, qty FROM order_items WHERE order_id = :id", { id })
      .map((i) => ({ productId: i.product_id, ne: i.ne, en: i.en, unit: i.unit, price: i.price, qty: i.qty })),
    events: all("SELECT at, type, status, note, admin_name FROM order_events WHERE order_id = :id ORDER BY id", { id })
      .map((e) => ({ at: e.at, type: e.type, status: e.status, note: e.note, by: e.admin_name })),
  };
}

export function summary(o) {
  return {
    id: o.id, status: o.status, createdAt: o.createdAt, name: o.customer.name, district: o.customer.district,
    total: o.totals.total, subtotal: o.totals.subtotal, deliveryType: o.delivery.type, slot: o.delivery.slot,
    deliveryDate: o.delivery.date, items: o.items.reduce((s, i) => s + i.qty, 0),
  };
}

export function setStatus(orderId, nextStatus, admin, note = "") {
  const order = transaction(() => {
    const o = one("SELECT status, payment_method, payment_status FROM orders WHERE id = :id", { id: orderId });
    if (!o) throw new OrderError("Order not found.", 404);
    if (!STATUSES[nextStatus]) throw new OrderError("Unknown status.");
    if (!TRANSITIONS[o.status].includes(nextStatus)) {
      throw new OrderError(`An order that is "${STATUSES[o.status]}" can't be moved to "${STATUSES[nextStatus]}".`, 409);
    }
    if (!allowedTransitions(admin, o.status).includes(nextStatus)) throw new OrderError("You don't have permission to make that change.", 403);

    const at = now();
    run("UPDATE orders SET status = :s, updated_at = :at WHERE id = :id", { s: nextStatus, at, id: orderId });

    // Cancelling puts the stock back
    if (nextStatus === "cancelled") {
      for (const i of all("SELECT product_id, qty FROM order_items WHERE order_id = :id", { id: orderId })) {
        if (one("SELECT 1 AS x FROM products WHERE id = :id", { id: i.product_id })) {
          changeStock(i.product_id, i.qty, `Order ${orderId} cancelled`, admin.name);
          run("UPDATE products SET sold = MAX(0, sold - :q) WHERE id = :id", { q: i.qty, id: i.product_id });
        }
      }
    }
    // Cash collected on delivery
    if (nextStatus === "delivered" && o.payment_method === "cod" && o.payment_status !== "Paid") {
      run("UPDATE orders SET payment_status = 'Paid' WHERE id = :id", { id: orderId });
    }

    run(`INSERT INTO order_events (order_id, at, type, status, note, admin_name)
         VALUES (:id, :at, 'status', :s, :note, :admin)`, { id: orderId, at, s: nextStatus, note: note || null, admin: admin.name });
    audit(admin, "order.status", `${orderId}: ${o.status} → ${nextStatus}`);
    return getOrder(orderId);
  });
  broadcast("order.updated", summary(order));
  return order;
}

export function addNote(orderId, admin, note) {
  if (!one("SELECT 1 AS x FROM orders WHERE id = :id", { id: orderId })) throw new OrderError("Order not found.", 404);
  run("INSERT INTO order_events (order_id, at, type, note, admin_name) VALUES (:id, :at, 'note', :note, :admin)", {
    id: orderId, at: now(), note, admin: admin.name,
  });
  const order = getOrder(orderId);
  broadcast("order.updated", summary(order));
  return order;
}
