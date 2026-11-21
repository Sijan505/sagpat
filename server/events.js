// Live updates for the admin panel. Changes are written to a small table and
// the panel polls for new ones every few seconds. (A long-lived Server-Sent
// Events connection doesn't work on serverless hosts like Vercel, where each
// request may run on a different instance.)
import { all, one, run, now } from "./db.js";
import { can, DELIVERY_VISIBLE } from "./permissions.js";

const KEEP_HOURS = 24;

// Each event is only sent to staff who are allowed to see it
function visibleTo(admin, type, data) {
  if (type.startsWith("order.")) {
    if (can(admin, "orders.view")) return true;
    return can(admin, "deliveries.view") && DELIVERY_VISIBLE.includes(data.status);
  }
  if (type.startsWith("product.") || type.startsWith("category.")) return can(admin, "products.view") || can(admin, "orders.view");
  if (type.startsWith("slot.")) return can(admin, "deliveries.view");
  return can(admin, "*");
}

// Strip money from order events for people who can't see finances
function shape(admin, type, data) {
  if (type.startsWith("order.") && !can(admin, "orders.finance")) {
    const { total, subtotal, ...rest } = data;
    return rest;
  }
  return data;
}

export async function broadcast(type, data) {
  await run("INSERT INTO live_events (at, type, data) VALUES (:at, :type, :data)", { at: now(), type, data: JSON.stringify(data) });
}

// Without `after`, returns only the latest id so the panel starts from "now"
export async function eventsSince(admin, after) {
  const last = (await one("SELECT COALESCE(MAX(id), 0) AS id FROM live_events")).id;
  const from = Number(after);
  if (!Number.isInteger(from) || from < 0 || from > last) return { last, events: [] };
  const rows = await all("SELECT id, type, data FROM live_events WHERE id > :from ORDER BY id LIMIT 200", { from });
  const events = rows
    .map((r) => ({ id: r.id, type: r.type, data: JSON.parse(r.data) }))
    .filter((e) => visibleTo(admin, e.type, e.data))
    .map((e) => ({ ...e, data: shape(admin, e.type, e.data) }));
  return { last: rows.length ? rows[rows.length - 1].id : from, events };
}

export async function cleanupEvents() {
  await run("DELETE FROM live_events WHERE at < :cutoff", { cutoff: new Date(Date.now() - KEEP_HOURS * 3600 * 1000).toISOString() });
}
