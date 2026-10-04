// Admin app: navigation, routing and live updates.
import { state, api, can, canAny, icon, esc, toast, npr } from "./core.js";
import { dashboardView } from "./views/dashboard.js";
import { ordersView, orderDetailView } from "./views/orders.js";
import { deliveriesView, slotsView } from "./views/deliveries.js";
import { productsView, productEditView, categoriesView } from "./views/products.js";
import { customersView, customerDetailView } from "./views/customers.js";
import { reportsView } from "./views/reports.js";
import { usersView, settingsView, activityView, accountView } from "./views/admin.js";

const NAV = [
  { group: null, items: [{ href: "#/", label: "Dashboard", icon: "home", show: () => true }] },
  { group: "Sales", items: [
    { href: "#/orders", label: "Orders", icon: "orders", show: () => can("orders.view"), count: "pending" },
    { href: "#/customers", label: "Customers", icon: "users", show: () => can("customers.view") },
  ] },
  { group: "Delivery", items: [
    { href: "#/deliveries", label: "Dispatch board", icon: "truck", show: () => can("deliveries.view"), count: "dispatch" },
    { href: "#/slots", label: "Delivery slots", icon: "clock", show: () => canAny("deliveries.view", "slots.manage") },
  ] },
  { group: "Catalog", items: [
    { href: "#/products", label: "Products & stock", icon: "box", show: () => can("products.view"), count: "lowstock" },
    { href: "#/categories", label: "Categories", icon: "tag", show: () => can("products.view") },
  ] },
  { group: "Business", items: [
    { href: "#/reports", label: "Reports", icon: "chart", show: () => can("reports.view") },
  ] },
  { group: "Admin", items: [
    { href: "#/users", label: "Staff & roles", icon: "shield", show: () => can("users.manage") },
    { href: "#/settings", label: "Settings", icon: "settings", show: () => can("settings.manage") },
    { href: "#/activity", label: "Activity log", icon: "list", show: () => can("audit.view") },
  ] },
];

const ROUTES = [
  [/^\/$/, dashboardView],
  [/^\/orders$/, ordersView, () => can("orders.view")],
  [/^\/orders\/([\w-]+)$/, orderDetailView, () => canAny("orders.view", "deliveries.view")],
  [/^\/deliveries$/, deliveriesView, () => can("deliveries.view")],
  [/^\/slots$/, slotsView, () => canAny("deliveries.view", "slots.manage")],
  [/^\/products$/, productsView, () => can("products.view")],
  [/^\/products\/(new|\d+)$/, productEditView, () => can("products.view")],
  [/^\/categories$/, categoriesView, () => can("products.view")],
  [/^\/customers$/, customersView, () => can("customers.view")],
  [/^\/customers\/(\d+)$/, customerDetailView, () => can("customers.view")],
  [/^\/reports$/, reportsView, () => can("reports.view")],
  [/^\/users$/, usersView, () => can("users.manage")],
  [/^\/settings$/, settingsView, () => can("settings.manage")],
  [/^\/activity$/, activityView, () => can("audit.view")],
  [/^\/account$/, accountView],
];

let viewEl = document.getElementById("view");
const currentPath = () => location.hash.slice(1).split("?")[0] || "/";
let current = null;

function renderNav() {
  const path = currentPath();
  document.getElementById("side-nav").innerHTML = NAV.map((g) => {
    const items = g.items.filter((i) => i.show());
    if (!items.length) return "";
    return `${g.group ? `<div class="group">${g.group}</div>` : ""}${items.map((i) => {
      const target = i.href.slice(1);
      const active = target === "/" ? path === "/" : path === target || path.startsWith(target + "/");
      return `<a href="${i.href}" class="${active ? "active" : ""}">${icon(i.icon)} ${i.label}
        ${i.count ? `<span class="count" data-count="${i.count}" hidden></span>` : ""}</a>`;
    }).join("")}`;
  }).join("");
  refreshCounts();
}

async function refreshCounts() {
  const set = (key, n) => document.querySelectorAll(`[data-count="${key}"]`).forEach((el) => {
    el.textContent = n;
    el.hidden = !n;
  });
  try {
    if (can("orders.view")) set("pending", (await api("/orders?status=pending&limit=1")).total);
    if (can("deliveries.view")) set("dispatch", (await api("/orders?status=confirmed,packed&limit=1")).total);
    if (can("products.view")) {
      const products = await api("/products");
      set("lowstock", products.filter((p) => p.active && p.stock <= p.lowStock).length);
    }
  } catch { /* counts are a nice-to-have */ }
}

async function route() {
  const path = currentPath();
  current?.destroy?.();
  current = null;
  renderNav();
  document.body.classList.remove("nav-open");

  // Fresh element per page so listeners from the previous page are dropped
  const fresh = viewEl.cloneNode(false);
  viewEl.replaceWith(fresh);
  viewEl = fresh;

  const match = ROUTES.map(([re, view, allowed]) => ({ m: path.match(re), view, allowed })).find((r) => r.m);
  if (!match) {
    viewEl.innerHTML = `<div class="empty">Page not found. <a href="#/">Go to the dashboard</a></div>`;
    return;
  }
  if (match.allowed && !match.allowed()) {
    viewEl.innerHTML = `<div class="card empty">Your role (${esc(state.me.roleLabel)}) doesn't have access to this page.</div>`;
    return;
  }
  viewEl.innerHTML = `<div class="empty">Loading…</div>`;
  try {
    current = (await match.view(viewEl, ...match.m.slice(1))) || null;
  } catch (err) {
    if (err.message !== "Signed out") viewEl.innerHTML = `<div class="card empty">Couldn't load this page: ${esc(err.message)}</div>`;
  }
  viewEl.focus({ preventScroll: true });
}

// ---------- Live updates (Server-Sent Events) ----------
function connectEvents() {
  const liveEl = document.getElementById("live");
  const source = new EventSource("/api/admin/events");
  source.onopen = () => { liveEl.classList.add("on"); liveEl.textContent = "Live updates on"; };
  source.onerror = () => { liveEl.classList.remove("on"); liveEl.textContent = "Reconnecting…"; };

  const handle = (type) => (e) => {
    const data = JSON.parse(e.data);
    if (type === "order.created") {
      const money = data.total !== undefined ? ` · ${npr(data.total)}` : "";
      toast(`New order <a href="#/orders/${esc(data.id)}">${esc(data.id)}</a> from ${esc(data.name)}${money}`, "new", { html: true, ms: 8000 });
    }
    refreshCounts();
    current?.onEvent?.(type, data);
  };
  for (const type of ["order.created", "order.updated", "order.deleted", "product.updated", "product.stock", "category.updated", "slot.updated"]) {
    source.addEventListener(type, handle(type));
  }
}

async function start() {
  try {
    state.me = await api("/me");
  } catch {
    return;
  }
  document.getElementById("side-user").innerHTML = `
    <strong>${esc(state.me.name)}</strong>
    <span class="role">${esc(state.me.roleLabel)}</span>
    <div class="links">
      <a href="#/account">My account</a>
      <a href="/" target="_blank" rel="noopener">View shop</a>
      <button type="button" id="logout">Sign out</button>
    </div>
    <div class="live" id="live">Connecting…</div>`;
  document.getElementById("logout").addEventListener("click", async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    location.replace("/admin/");
  });
  document.getElementById("menu-btn").addEventListener("click", () => document.body.classList.toggle("nav-open"));
  document.getElementById("sidebar").addEventListener("click", (e) => {
    if (e.target.closest("a")) document.body.classList.remove("nav-open");
  });

  window.addEventListener("hashchange", route);
  route();
  connectEvents();
}

start();
