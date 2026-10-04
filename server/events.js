// Server-Sent Events: pushes live updates to open admin dashboards.
import { can, DELIVERY_VISIBLE } from "./permissions.js";

const clients = new Set();

export function subscribe(req, res) {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  res.write("retry: 5000\n\n");

  const client = { res, admin: req.admin };
  clients.add(client);
  const ping = setInterval(() => res.write(": ping\n\n"), 25000);
  req.on("close", () => {
    clearInterval(ping);
    clients.delete(client);
  });
}

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

export function broadcast(type, data) {
  for (const { res, admin } of clients) {
    if (!visibleTo(admin, type, data)) continue;
    res.write(`event: ${type}\ndata: ${JSON.stringify(shape(admin, type, data))}\n\n`);
  }
}
