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

renderLayout();
