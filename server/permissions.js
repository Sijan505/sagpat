// Roles and what each one may do. The server checks these on every admin request;
// the admin UI only uses them to hide things the user can't do anyway.

export const ROLES = {
  super_admin: {
    label: "Super Admin",
    description: "Full system access",
    permissions: ["*"],
  },
  order_manager: {
    label: "Order Manager",
    description: "Handles customer orders, deliveries and customer contact",
    permissions: [
      "dashboard.orders",
      "orders.view",
      "orders.update",
      "orders.finance", // see totals, mark payments
      "orders.export",
      "deliveries.view",
      "deliveries.update",
      "customers.view",
      "customers.contact",
    ],
  },
  product_manager: {
    label: "Product Manager",
    description: "Handles products, categories and stock. No access to orders or money.",
    permissions: ["dashboard.products", "products.view", "products.edit", "products.delete", "categories.edit", "stock.update"],
  },
  delivery_manager: {
    label: "Delivery Manager",
    description: "Handles dispatch, riders and delivery slots",
    permissions: ["dashboard.deliveries", "deliveries.view", "deliveries.update", "slots.manage", "customers.contact"],
  },
};

// Only super admins: "*" covers these
// orders.delete, users.manage, settings.manage, reports.view, audit.view

export function can(admin, permission) {
  const perms = ROLES[admin?.role]?.permissions || [];
  return perms.includes("*") || perms.includes(permission);
}

export function permissionsFor(role) {
  return ROLES[role]?.permissions || [];
}

// ---------- Order status workflow ----------
export const STATUSES = {
  pending: "New",
  confirmed: "Confirmed",
  packed: "Packed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  failed: "Delivery failed",
  cancelled: "Cancelled",
};

export const TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["packed", "cancelled"],
  packed: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "failed"],
  failed: ["out_for_delivery", "cancelled"],
  delivered: [],
  cancelled: [],
};

// Statuses a delivery manager can see, and moves they're allowed to make
export const DELIVERY_VISIBLE = ["pending", "confirmed", "packed", "out_for_delivery", "failed"];
const DELIVERY_MOVES = {
  confirmed: ["packed"],
  packed: ["out_for_delivery"],
  out_for_delivery: ["delivered", "failed"],
  failed: ["out_for_delivery"],
};

export function allowedTransitions(admin, status) {
  const all = TRANSITIONS[status] || [];
  if (can(admin, "orders.update")) return all;
  if (can(admin, "deliveries.update")) return all.filter((s) => (DELIVERY_MOVES[status] || []).includes(s));
  return [];
}

export function canViewOrder(admin, order) {
  if (can(admin, "orders.view")) return true;
  return can(admin, "deliveries.view") && DELIVERY_VISIBLE.includes(order.status);
}
