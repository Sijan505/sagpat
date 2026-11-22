// My orders: Google sign-in for guests, order history for signed-in customers.
// Guests still see orders placed on this device (the browser keeps their links).

const accountRoot = document.getElementById("account-root");
const accountParams = new URLSearchParams(location.search);
// Only send people back to one of our own pages after signing in
const nextPage = /^[a-z]+\.html(\?[\w=&%.-]*)?$/.test(accountParams.get("next") || "") ? accountParams.get("next") : null;

const STATUS_GROUPS = {
  all: { label: "All", match: () => true },
  active: { label: "In progress", match: (s) => !["delivered", "cancelled"].includes(s) },
  delivered: { label: "Delivered", match: (s) => s === "delivered" },
  cancelled: { label: "Cancelled", match: (s) => s === "cancelled" },
};
let historyFilter = "all";
let historyOrders = [];

const dayOf = (ymd) => new Date(`${ymd}T00:00:00+05:45`).toLocaleDateString("en-GB", { timeZone: "Asia/Kathmandu", weekday: "short", day: "numeric", month: "short" });
const placedOn = (iso) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Kathmandu", day: "numeric", month: "short", year: "numeric" });
const statusLabel = (s, label) => (s === "pending" ? "Order received" : label);

// ---------- Rendering ----------
function orderCard(o) {
  const names = o.items.map((i) => `${i.en} × ${i.qty}`);
  const shown = names.slice(0, 3).join(", ") + (names.length > 3 ? ` and ${names.length - 3} more` : "");
  const done = ["delivered", "cancelled"].includes(o.status);
  const expected = o.delivery.from === o.delivery.to ? dayOf(o.delivery.from) : `${dayOf(o.delivery.from)} – ${dayOf(o.delivery.to)}`;
  return `
    <article class="panel order-card">
      <div class="order-card-head">
        <div>
          <strong class="order-id">${escapeHtml(o.id)}</strong>
          <small class="muted">Placed ${placedOn(o.createdAt)}</small>
        </div>
        <span class="status-pill" data-status="${escapeHtml(o.status)}">${escapeHtml(statusLabel(o.status, o.statusLabel))}</span>
      </div>
      <p class="order-card-items">${escapeHtml(shown)}</p>
      <div class="order-card-foot">
        <div>
          <strong>${npr(o.total)}</strong>
          <small class="muted">${done ? "" : `Expected ${expected} · ${escapeHtml(o.delivery.slot)}`}</small>
        </div>
        <div class="order-card-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-reorder="${escapeHtml(o.id)}">Buy again</button>
          <a href="${orderLink(o.id, o.key)}" class="btn btn-outline btn-sm">${done ? "View details" : "Track order"}</a>
        </div>
      </div>
    </article>`;
}

function historyList() {
  const list = historyOrders.filter((o) => STATUS_GROUPS[historyFilter].match(o.status));
  if (!historyOrders.length) {
    return `<div class="panel empty-state">
      <span class="ne">अहिलेसम्म कुनै अर्डर छैन</span>
      <h2>No orders yet</h2>
      <p>When you place an order while signed in, it shows up here.</p>
      <a href="products.html" class="btn btn-primary">Start shopping</a>
    </div>`;
  }
  return `
    <div class="filter-tabs" role="tablist" aria-label="Filter orders">
      ${Object.entries(STATUS_GROUPS).map(([k, g]) => {
        const n = historyOrders.filter((o) => g.match(o.status)).length;
        return `<button type="button" role="tab" aria-selected="${k === historyFilter}" data-filter="${k}">${g.label} <span>${n}</span></button>`;
      }).join("")}
    </div>
    <div class="order-list">
      ${list.length ? list.map(orderCard).join("") : `<p class="muted" style="padding: 24px 0;">No orders here.</p>`}
    </div>`;
}

function renderSignedIn(user) {
  const avatar = user.picture
    ? `<img class="avatar avatar-lg" src="${escapeHtml(user.picture)}" alt="" referrerpolicy="no-referrer">`
    : `<span class="avatar avatar-lg avatar-letter">${escapeHtml(user.name.charAt(0).toUpperCase())}</span>`;
  const canAlert = "Notification" in window && Notification.permission === "default";
  accountRoot.innerHTML = `
    <div class="panel profile-card">
      ${avatar}
      <div class="profile-text">
        <strong>${escapeHtml(user.name)}</strong>
        <small class="muted">${escapeHtml(user.email)} · signed in with Google</small>
      </div>
      <div class="profile-actions">
        ${canAlert ? `<button type="button" class="btn btn-outline btn-sm" data-enable-push>${icon("bell")} Turn on order alerts</button>` : ""}
        <button type="button" class="btn btn-ghost btn-sm" data-signout>${icon("logout")} Sign out</button>
      </div>
    </div>
    <h2 class="section-sub">Order history</h2>
    <div id="history"><p class="muted">Loading…</p></div>`;
}

function renderSignInCard() {
  return `
    <div class="panel signin-card">
      <div class="signin-text">
        <span class="ne">साइन इन गर्नुहोस्</span>
        <h2>Sign in to order and see your orders</h2>
        <ul class="signin-perks">
          <li>${icon("bag")} Sign in once to place orders</li>
          <li>${icon("receipt")} Order history on any phone or computer</li>
          <li>${icon("bell")} Notifications when your order is confirmed, packed and on its way</li>
          <li>${icon("check")} Faster checkout with your details filled in</li>
        </ul>
      </div>
      <div class="signin-action">
        ${SHOP.GOOGLE_CLIENT_ID
          ? `<a href="/api/auth/google/start" class="google-btn" id="google-btn">
               <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
               <span>Continue with Google</span>
             </a><p class="field-hint" id="signin-error" hidden></p>
             <p class="field-hint">We only use your name and email to keep your orders together.</p>`
          : `<p class="field-hint">Google sign-in isn't set up on this shop yet. Ask the shop owner to set <code>GOOGLE_CLIENT_ID</code> (see README).</p>`}
      </div>
    </div>`;
}

// Orders this browser remembers from checkout (guests)
async function deviceOrders() {
  const saved = store.get(KEYS.orders, []);
  const results = await Promise.all(saved.map((o) =>
    fetch(`/api/orders/${encodeURIComponent(o.id)}?key=${encodeURIComponent(o.key)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)));
  return results.filter(Boolean).map((o) => ({
    id: o.id, key: o.key, createdAt: o.createdAt, status: o.status, statusLabel: o.statusLabel, total: o.totals.total,
    delivery: o.delivery, items: o.items,
  }));
}

async function renderSignedOut() {
  accountRoot.innerHTML = `${renderSignInCard()}<h2 class="section-sub">Orders on this device</h2><div id="history"><p class="muted">Loading…</p></div>`;
  if (SHOP.GOOGLE_CLIENT_ID) loadGoogleButton();
  historyOrders = await deviceOrders();
  document.getElementById("history").innerHTML = historyOrders.length ? historyList()
    : `<p class="muted">No orders placed on this device yet. <a href="products.html" class="link-arrow">Start shopping</a></p>`;
}

// ---------- Google sign-in ----------
// The button is a plain link to /api/auth/google/start, which opens Google's
// sign-in page; Google sends the customer back through
// /api/auth/google/callback. No Google script or iframe loads on this page, so
// the button shows on every phone, network and in-app browser. The page to
// return to is remembered on this device in the meantime.
const NEXT_KEY = "sagpat_signin_next";

function loadGoogleButton() {
  document.getElementById("google-btn")?.addEventListener("click", () => {
    if (nextPage) store.set(NEXT_KEY, nextPage);
  });
}

function showSigninError(msg) {
  const el = document.getElementById("signin-error");
  if (!el) return toast(msg, "error");
  el.textContent = msg;
  el.hidden = false;
  el.style.color = "var(--danger)";
}

// Back from Google: move orders placed on this device into the account, then
// continue to the page the customer was on (e.g. checkout)
async function finishSignIn() {
  const saved = store.get(KEYS.orders, []);
  if (saved.length) {
    await fetch("/api/me/orders/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orders: saved.map(({ id, key }) => ({ id, key })) }),
    }).catch(() => {});
  }
  const next = store.get(NEXT_KEY, null);
  store.set(NEXT_KEY, null);
  if (next && /^[a-z]+\.html(\?[\w=&%.-]*)?$/.test(next)) {
    location.replace(next);
    return true;
  }
  history.replaceState(null, "", "account.html");
  return false;
}

// ---------- Events ----------
accountRoot.addEventListener("click", (e) => {
  if (e.target.closest("[data-signout]")) return Account.signOut();
  if (e.target.closest("[data-enable-push]")) {
    e.target.closest("[data-enable-push]").remove();
    return enableBrowserNotifications();
  }
  const tab = e.target.closest("[data-filter]");
  if (tab) {
    historyFilter = tab.dataset.filter;
    document.getElementById("history").innerHTML = historyList();
    return;
  }
  const re = e.target.closest("[data-reorder]");
  if (re) {
    const order = historyOrders.find((o) => o.id === re.dataset.reorder);
    let added = 0;
    const items = Cart.items();
    for (const i of order.items) {
      const p = getProduct(i.productId);
      if (!p || p.stock === 0) continue;
      let line = items.find((x) => x.id === p.id);
      if (!line) items.push((line = { id: p.id, qty: 0 }));
      line.qty = Math.min(p.stock, line.qty + i.qty);
      added++;
    }
    Cart.save(items);
    if (!added) return toast("Those items aren't available right now", "error");
    toast(added === order.items.length ? "Added to your cart" : `Added ${added} of ${order.items.length} items (others are sold out)`);
  }
});

// Refresh the list when a status-change notification arrives
document.addEventListener("notifications:new", () => Account.user && loadHistory());

async function loadHistory() {
  const res = await fetch("/api/me/orders");
  if (!res.ok) return;
  historyOrders = (await res.json()).orders;
  const el = document.getElementById("history");
  if (el) el.innerHTML = historyList();
}

Account.ready.then(async (user) => {
  if (!user) {
    await renderSignedOut();
    if (accountParams.get("signin_error")) showSigninError(accountParams.get("signin_error"));
    return;
  }
  if (accountParams.get("signed_in") && (await finishSignIn())) return;
  if (nextPage) return (location.href = nextPage);
  renderSignedIn(user);
  await loadHistory();
});
