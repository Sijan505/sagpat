// Shared code for every page: storage, cart, wishlist, formatting, header/footer.

// Fees, VAT, contact details and delivery slots come from the server
// (SHOP_SETTINGS in /js/data.js), which staff change under Admin → Settings.
const SHOP = {
  FREE_DELIVERY_OVER: 500,
  STANDARD_FEE: 50,
  EXPRESS_FEE: 150,
  TAX_RATE: 0.13,
  EXPRESS_CUTOFF_HOUR: 14,
  PHONE: "+977 980-0000000",
  EMAIL: "support@sagpat.example",
  ACCEPTING_ORDERS: true,
  SLOTS: { standard: [], expressToday: [], expressTomorrow: [] },
  ...(typeof SHOP_SETTINGS !== "undefined" ? SHOP_SETTINGS : {}),
};

const KEYS = {
  cart: "sagpat_cart",
  wishlist: "sagpat_wishlist",
  orders: "sagpat_orders",
  reviews: "sagpat_reviews",
  customer: "sagpat_customer",
  notifSeen: "sagpat_notif_seen",
};

// ---------- localStorage (fails safely in private mode) ----------
const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable: data just won't persist */
    }
  },
};

// ---------- Icons (Lucide, ISC licence) ----------
const ICONS = {
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  print: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
};

function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
}

// Hand-drawn style logo: a leaf in a basket outline
const LOGO_SVG = `<svg class="logo-mark" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M8 18h24l-3 15a2 2 0 0 1-2 1.6H13a2 2 0 0 1-2-1.6Z"/>
  <path d="M12 23h16M13 28h14"/>
  <path d="M20 18c0-6 3-10 9-11-.5 6-3.5 10-9 11Z" fill="#E8752F" stroke="#E8752F"/>
  <path d="M20 18c-1-4-3.5-6.5-8-7 .5 4 3 6.5 8 7Z"/>
</svg>`;

// ---------- Formatting ----------
function npr(n) {
  const value = Number(n);
  return "रु " + value.toLocaleString("en-IN", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

const round2 = (n) => Math.round(n * 100) / 100;

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function stars(rating, label = "Freshness") {
  return `<span class="stars" style="--r:${rating}" role="img" aria-label="${label} ${rating} out of 5"></span>`;
}

// ---------- Cart ----------
const Cart = {
  items() {
    return store.get(KEYS.cart, []).filter((i) => getProduct(i.id));
  },
  save(items) {
    store.set(KEYS.cart, items);
    refreshBadges();
  },
  add(id, qty = 1) {
    const p = getProduct(id);
    if (!p) return;
    if (p.stock === 0) return toast(`${p.en} is out of stock`, "error");

    const items = this.items();
    let item = items.find((i) => i.id === p.id);
    if (!item) items.push((item = { id: p.id, qty: 0 }));

    const before = item.qty;
    item.qty = Math.min(p.stock, item.qty + qty);
    this.save(items);

    if (item.qty === before) toast(`Sorry, only ${p.stock} left`, "error");
    else toast(`Added ${p.en} to your cart`);
  },
  setQty(id, qty) {
    const p = getProduct(id);
    const items = this.items()
      .map((i) => (i.id === id ? { ...i, qty: Math.min(p.stock, qty) } : i))
      .filter((i) => i.qty > 0);
    this.save(items);
  },
  remove(id) {
    this.save(this.items().filter((i) => i.id !== id));
  },
  clear() {
    this.save([]);
  },
  count() {
    return this.items().reduce((sum, i) => sum + i.qty, 0);
  },
  lines() {
    return this.items().map((i) => {
      const p = getProduct(i.id);
      return { p, qty: i.qty, total: p.price * i.qty };
    });
  },
  subtotal() {
    return this.lines().reduce((sum, l) => sum + l.total, 0);
  },
};

// delivery: "standard" | "express"
function calcTotals(subtotal, delivery = "standard") {
  let fee = 0;
  if (subtotal > 0) {
    if (delivery === "express") fee = SHOP.EXPRESS_FEE;
    else fee = subtotal >= SHOP.FREE_DELIVERY_OVER ? 0 : SHOP.STANDARD_FEE;
  }
  const tax = round2(subtotal * SHOP.TAX_RATE);
  return { subtotal, delivery: fee, tax, total: round2(subtotal + fee + tax) };
}

// ---------- Wishlist ----------
const Wishlist = {
  ids() {
    return store.get(KEYS.wishlist, []);
  },
  has(id) {
    return this.ids().includes(Number(id));
  },
  toggle(id) {
    id = Number(id);
    const ids = this.ids();
    const on = !ids.includes(id);
    store.set(KEYS.wishlist, on ? [...ids, id] : ids.filter((x) => x !== id));
    refreshBadges();
    toast(on ? "Saved to your wishlist" : "Removed from your wishlist");
    return on;
  },
};

// ---------- Product rendering ----------
function productMedia(p, eager = false) {
  return `<img src="${p.image}" alt="${escapeHtml(p.en)}" ${eager ? "" : 'loading="lazy"'} decoding="async">`;
}

function wishButton(p) {
  return `<button type="button" class="wish-btn" data-wish="${p.id}" aria-pressed="${Wishlist.has(p.id)}"
    aria-label="Save ${escapeHtml(p.en)} to wishlist">${icon("heart")}</button>`;
}

function isNew(p) {
  return (Date.now() - new Date(p.added)) / 86400000 <= 10;
}

function productCard(p) {
  const out = p.stock === 0;
  const url = `product.html?id=${p.id}`;
  return `
    <article class="card${out ? " is-out" : ""}">
      <a href="${url}" class="card-media" tabindex="-1" aria-hidden="true">
        ${productMedia(p)}
        ${out ? `<span class="badge badge-muted">Sold out</span>` : isNew(p) ? `<span class="badge">New</span>` : ""}
      </a>
      ${wishButton(p)}
      <div class="card-body">
        <h3 class="card-title"><a href="${url}">${p.ne}</a></h3>
        <p class="card-en">${p.en}</p>
        <div class="card-meta">
          ${stars(p.rating)}
          <span class="${out ? "stock-out" : "stock-in"}">${out ? "Out of stock" : `${p.stock} in stock`}</span>
        </div>
        <div class="card-bottom">
          <span class="card-price">${npr(p.price)} <small>/ ${p.unit}</small></span>
          <button type="button" class="btn btn-outline btn-sm" data-add="${p.id}" ${out ? "disabled" : ""}>
            ${out ? "Sold out" : "Add to cart"}</button>
        </div>
        <div class="card-links">
          <span class="muted" style="font-size:.78rem;">${p.origin.replace(", Nepal", "")}</span>
          <a href="${url}" class="link-arrow">View details</a>
        </div>
      </div>
    </article>`;
}

// ---------- Header & footer ----------
const NAV = [
  { href: "index.html", page: "home", label: "Home" },
  { href: "products.html", page: "products", label: "Shop" },
  { href: "about.html", page: "about", label: "About" },
  { href: "about.html#contact", page: "contact", label: "Contact" },
];

function renderLayout() {
  const page = document.body.dataset.page;
  const header = document.getElementById("site-header");
  const footer = document.getElementById("site-footer");

  if (header) {
    header.insertAdjacentHTML("beforebegin", `
      <div class="topbar">
        <div class="container">
          <span>Delivering across Kathmandu Valley. Order by <strong>2 PM</strong> for same-day delivery.</span>
          <span class="hide-sm">Free delivery over ${npr(SHOP.FREE_DELIVERY_OVER)} · ${SHOP.PHONE}</span>
        </div>
      </div>`);

    header.innerHTML = `
      <div class="container header-inner">
        <a href="index.html" class="logo" aria-label="Sagpat home">
          ${LOGO_SVG}
          <span class="logo-text"><strong>Sagpat</strong><small>सगपात</small></span>
        </a>
        <button type="button" class="nav-toggle" aria-label="Menu" aria-expanded="false">${icon("menu")}</button>
        <nav class="nav" aria-label="Main">
          ${NAV.map((n) => `<a href="${n.href}" class="${n.page === page ? "active" : ""}">${n.label}</a>`).join("")}
          <span class="account-slot">
            <a href="account.html" class="icon-link ${page === "account" ? "active" : ""}">${icon("user")} Sign in</a>
          </span>
          <a href="products.html?wishlist=1" class="icon-link" aria-label="Wishlist">
            ${icon("heart")}<span class="badge-count" data-count="wishlist">0</span></a>
          <a href="cart.html" class="icon-link cart-link ${page === "cart" ? "active" : ""}">
            ${icon("bag")} Cart <span class="badge-count" data-count="cart">0</span></a>
        </nav>
      </div>`;

    const toggle = header.querySelector(".nav-toggle");
    toggle.addEventListener("click", () => {
      const open = header.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open);
    });
  }

  if (footer) {
    footer.innerHTML = `
      <div class="motif-border" aria-hidden="true"></div>
      <div class="container footer-grid">
        <div>
          <a href="index.html" class="logo logo-light">${LOGO_SVG}
            <span class="logo-text"><strong>Sagpat</strong><small style="color:#ffcfae">सगपात</small></span></a>
          <p class="footer-tagline">ताजा, स्वच्छ, सुविधाजनक</p>
          <p>किसानको बारीबाट सिधै तपाईंको भान्सामा।<br>Vegetables, fruit and dairy from Nepali farms, packed at our Kalimati store every morning.</p>
        </div>
        <div>
          <h4>Help</h4>
          <ul>
            <li><a href="about.html#delivery">Delivery info</a></li>
            <li><a href="about.html#contact">Contact us</a></li>
            <li><a href="about.html">About Sagpat</a></li>
            <li><a href="credits.html">Photo credits</a></li>
            <li><a href="privacy.html">Privacy policy</a></li>
          </ul>
        </div>
        <div>
          <h4>Visit / call</h4>
          <ul>
            <li>Kalimati, Kathmandu</li>
            <li>${SHOP.PHONE}</li>
            <li>${SHOP.EMAIL}</li>
            <li>7 AM – 8 PM, every day</li>
          </ul>
        </div>
        <div>
          <h4>We accept</h4>
          <div class="pay-list"><span>Cash</span><span>eSewa</span><span>Khalti</span><span>Fonepay</span><span>Bank transfer</span></div>
          <h4 style="margin-top:18px;">Follow</h4>
          <ul style="grid-auto-flow: column; justify-content: start; gap: 14px;">
            <li><a href="#">Facebook</a></li><li><a href="#">Instagram</a></li><li><a href="#">TikTok</a></li>
          </ul>
        </div>
      </div>
      <div class="container footer-bottom">
        <span>© 2026 (२०८३) Sagpat Pvt. Ltd.</span>
        <span>Product photos: Wikimedia Commons contributors (<a href="credits.html">credits</a>)</span>
      </div>`;
  }

  // Static pages can drop icons in with <i data-icon="truck"></i>
  document.querySelectorAll("i[data-icon]").forEach((el) => (el.outerHTML = icon(el.dataset.icon)));
  refreshBadges();
}

function refreshBadges() {
  const counts = { cart: Cart.count(), wishlist: Wishlist.ids().length };
  document.querySelectorAll("[data-count]").forEach((el) => {
    const n = counts[el.dataset.count];
    el.textContent = n;
    el.hidden = n === 0;
  });
}

// ---------- Toast ----------
function toast(message, type = "success") {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.dataset.type = type;
  el.classList.add("show");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove("show"), 2200);
}

// ---------- Global click handling (add to cart, wishlist) ----------
document.addEventListener("click", (e) => {
  const add = e.target.closest("[data-add]");
  if (add && !add.disabled) {
    Cart.add(Number(add.dataset.add), Number(add.dataset.qty) || 1);
    return;
  }
  const wish = e.target.closest("[data-wish]");
  if (wish) {
    const on = Wishlist.toggle(wish.dataset.wish);
    document.querySelectorAll(`[data-wish="${wish.dataset.wish}"]`).forEach((b) => b.setAttribute("aria-pressed", on));
    document.dispatchEvent(new CustomEvent("wishlist:change"));
  }
});

// Keep badges in sync when the cart changes in another tab
window.addEventListener("storage", (e) => {
  if (e.key === KEYS.cart || e.key === KEYS.wishlist) {
    refreshBadges();
    document.dispatchEvent(new CustomEvent("cart:external-change"));
  }
});

// ---------- Customer account + notifications ----------
// The header shows "Sign in" until /api/me answers. Signed-in customers get a
// notification bell; new notifications (order placed, status changes) also
// pop up as a toast and, if allowed, a browser notification.
const fmtWhen = (iso) => new Date(iso).toLocaleString("en-GB", {
  timeZone: "Asia/Kathmandu", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
});
const orderLink = (id, key) => `confirmation.html?id=${encodeURIComponent(id)}&key=${encodeURIComponent(key || "")}`;

const Account = {
  user: null,
  googleEnabled: false,
  ready: null, // Promise that resolves once we know who's signed in
  notifications: { unread: 0, items: [] },

  async load() {
    try {
      const res = await fetch("/api/me");
      const data = await res.json();
      this.user = data.user;
      this.googleEnabled = data.googleEnabled;
    } catch {
      this.user = null;
    }
    this.renderHeader();
    if (this.user) {
      this.refreshNotifications();
      setInterval(() => !document.hidden && this.refreshNotifications(), 45000);
      document.addEventListener("visibilitychange", () => !document.hidden && this.refreshNotifications());
    }
    return this.user;
  },

  async signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    try { window.google?.accounts?.id?.disableAutoSelect(); } catch { /* not loaded */ }
    location.href = "index.html";
  },

  renderHeader() {
    const slot = document.querySelector(".account-slot");
    if (!slot || !this.user) return;
    const u = this.user;
    const avatar = u.picture
      ? `<img class="avatar" src="${escapeHtml(u.picture)}" alt="" referrerpolicy="no-referrer">`
      : `<span class="avatar avatar-letter">${escapeHtml(u.name.charAt(0).toUpperCase())}</span>`;
    slot.innerHTML = `
      <div class="dropdown" data-dropdown="notif">
        <button type="button" class="icon-btn" aria-label="Notifications" aria-expanded="false" aria-haspopup="true">
          ${icon("bell")}<span class="badge-count notif-count" hidden>0</span></button>
        <div class="dropdown-panel notif-panel" hidden>
          <div class="dropdown-head"><strong>Notifications</strong>
            ${"Notification" in window && Notification.permission === "default"
              ? `<button type="button" class="link-btn" data-enable-push>Turn on alerts</button>` : ""}</div>
          <ul class="notif-list"><li class="notif-empty">Loading…</li></ul>
        </div>
      </div>
      <div class="dropdown" data-dropdown="user">
        <button type="button" class="icon-btn user-btn" aria-label="Account menu" aria-expanded="false" aria-haspopup="true">
          ${avatar}<span class="user-first">${escapeHtml(u.name.split(" ")[0])}</span></button>
        <div class="dropdown-panel user-panel" hidden>
          <div class="dropdown-head"><strong>${escapeHtml(u.name)}</strong><small>${escapeHtml(u.email || (u.username ? `@${u.username}` : ""))}</small></div>
          <a href="account.html">${icon("receipt")} My orders</a>
          <button type="button" data-signout>${icon("logout")} Sign out</button>
        </div>
      </div>`;

    slot.addEventListener("click", (e) => {
      if (e.target.closest("[data-signout]")) return this.signOut();
      if (e.target.closest("[data-enable-push]")) return enableBrowserNotifications();
      const btn = e.target.closest(".icon-btn");
      if (!btn) return;
      const dd = btn.closest(".dropdown");
      const panel = dd.querySelector(".dropdown-panel");
      const open = panel.hidden;
      closeDropdowns();
      panel.hidden = !open;
      btn.setAttribute("aria-expanded", open);
      if (open && dd.dataset.dropdown === "notif") this.markRead();
    });
  },

  async refreshNotifications() {
    let data;
    try {
      const res = await fetch("/api/me/notifications");
      if (!res.ok) return;
      data = await res.json();
    } catch {
      return;
    }
    this.notifications = data;
    this.renderNotifications();

    // Announce notifications this device hasn't shown yet. On a device's
    // first visit, only very recent ones (e.g. "Order placed") pop up.
    const seen = store.get(KEYS.notifSeen, 0);
    let fresh = data.items.filter((n) => !n.read && n.id > seen);
    if (!seen) fresh = fresh.filter((n) => Date.now() - new Date(n.createdAt) < 5 * 60000);
    if (data.items.length) store.set(KEYS.notifSeen, Math.max(seen, data.items[0].id));
    for (const n of fresh.slice(0, 3).reverse()) {
      toast(n.title);
      showBrowserNotification(n.title, n.body, n.orderId ? orderLink(n.orderId, n.orderKey) : "account.html");
    }
    if (fresh.length) document.dispatchEvent(new CustomEvent("notifications:new", { detail: fresh }));
  },

  renderNotifications() {
    const { unread, items } = this.notifications;
    const badge = document.querySelector(".notif-count");
    if (badge) {
      badge.textContent = unread > 9 ? "9+" : unread;
      badge.hidden = unread === 0;
    }
    const list = document.querySelector(".notif-list");
    if (!list) return;
    list.innerHTML = items.length ? items.map((n) => `
      <li class="${n.read ? "" : "unread"}">
        <a href="${n.orderId ? orderLink(n.orderId, n.orderKey) : "account.html"}">
          <strong>${escapeHtml(n.title)}</strong>
          ${n.body ? `<span>${escapeHtml(n.body)}</span>` : ""}
          <small>${fmtWhen(n.createdAt)}</small>
        </a>
      </li>`).join("") : `<li class="notif-empty">No notifications yet. We'll tell you here when your orders move along.</li>`;
  },

  async markRead() {
    if (!this.notifications.unread) return;
    await fetch("/api/me/notifications/read", { method: "POST" }).catch(() => {});
    this.notifications.unread = 0;
    const badge = document.querySelector(".notif-count");
    if (badge) badge.hidden = true;
  },
};

function closeDropdowns() {
  document.querySelectorAll(".dropdown-panel").forEach((p) => (p.hidden = true));
  document.querySelectorAll(".dropdown .icon-btn").forEach((b) => b.setAttribute("aria-expanded", "false"));
}
document.addEventListener("click", (e) => { if (!e.target.closest(".dropdown")) closeDropdowns(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDropdowns(); });

// Browser (system) notifications, only after the customer allows them
async function enableBrowserNotifications() {
  if (!("Notification" in window)) return toast("This browser doesn't support notifications", "error");
  const result = await Notification.requestPermission();
  document.querySelectorAll("[data-enable-push]").forEach((b) => b.remove());
  if (result === "granted") {
    toast("Alerts are on. We'll tell you when your order moves along.");
    showBrowserNotification("Sagpat alerts are on", "You'll get a message here when your order status changes.");
  } else {
    toast("Alerts are off. You can still see updates under the bell.");
  }
}

const NOTIF_ICON = "data:image/svg+xml," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path d="M20 18c0-6 3-10 9-11-.5 6-3.5 10-9 11Z" fill="#E8752F"/><path d="M8 18h24l-3 15H11Z" fill="#2D5016"/></svg>');

function showBrowserNotification(title, body, url) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, { body, icon: NOTIF_ICON });
    if (url) n.onclick = () => { window.focus(); location.href = url; };
  } catch {
    /* some mobile browsers only allow notifications from a service worker */
  }
}

renderLayout();
Account.ready = Account.load();
