// Product detail page: zoomable photo, buy box, info tabs, reviews, related items.

const root = document.getElementById("product-root");
const product = getProduct(new URLSearchParams(location.search).get("id"));

function allReviews() {
  return [...(store.get(KEYS.reviews, {})[product.id] || []), ...product.reviews];
}

function renderNotFound() {
  root.innerHTML = `
    <div class="panel empty-state">
      <span class="ne">उत्पादन भेटिएन</span>
      <h2>We couldn't find that product</h2>
      <p>It may have been removed or the link is wrong.</p>
      <a href="products.html" class="btn btn-primary">Browse the shop</a>
    </div>`;
}

function renderProduct() {
  const p = product;
  const cat = getCategory(p.cat);
  const out = p.stock === 0;
  const inCart = Cart.items().find((i) => i.id === p.id)?.qty || 0;
  document.title = `${p.en} (${p.ne}) | Sagpat`;

  root.innerHTML = `
    <div class="breadcrumb" style="margin-bottom: 18px;">
      <a href="index.html">Home</a> / <a href="products.html">Shop</a> /
      <a href="products.html?cat=${cat.id}">${cat.en}</a> / ${p.en}
    </div>

    <div class="detail">
      <div class="zoom" id="zoom" tabindex="0" role="button" aria-label="Zoom photo">
        <span class="fresh-badge">${icon("leaf")} Freshness guaranteed</span>
        <div class="zoom-inner">${productMedia(p, true)}</div>
        <span class="zoom-hint">Hover or tap to zoom</span>
      </div>

      <div class="detail-info">
        <span class="cat-label"><a href="products.html?cat=${cat.id}">${cat.en}</a> · <span class="ne">${cat.ne}</span></span>
        <h1>${p.ne}</h1>
        <p class="en-name">${p.en}</p>

        <div class="rating-row">
          <span>${stars(p.rating)} ${p.rating} freshness</span>
          <a href="#reviews" id="review-link"></a>
        </div>

        <div class="detail-price">${npr(p.price)} <small>per ${p.unit}</small></div>

        <ul class="facts">
          <li><strong>Availability</strong>
            <span class="${out ? "stock-out" : "stock-in"}">${out ? "Out of stock right now" : `${p.stock} in stock`}</span></li>
          <li><strong>Grown in</strong><span>${p.origin}</span></li>
          <li><strong>Delivery</strong><span>Today if ordered by 2 PM (express), or in 2–3 days</span></li>
        </ul>

        <p>${p.desc}</p>

        <div class="buy-row">
          <div class="qty qty-lg" aria-label="Quantity">
            <button type="button" id="qty-dec" aria-label="Decrease quantity">−</button>
            <output id="qty-val">1</output>
            <button type="button" id="qty-inc" aria-label="Increase quantity">+</button>
          </div>
          <button type="button" class="btn btn-primary btn-lg" id="add-btn" data-add="${p.id}" data-qty="1" ${out ? "disabled" : ""}>
            ${out ? "Sold out" : "Add to cart"}</button>
          <button type="button" class="btn btn-outline btn-lg" id="wish-btn" data-wish="${p.id}" aria-pressed="${Wishlist.has(p.id)}"></button>
        </div>
        ${inCart ? `<p class="field-hint" style="margin-top:10px;">You already have ${inCart} in your cart.</p>` : ""}
      </div>
    </div>

    <div class="tabs">
      <div class="tab-list" role="tablist">
        <button role="tab" aria-controls="tab-nutrition" id="t-nutrition">Nutrition</button>
        <button role="tab" aria-controls="tab-storage" id="t-storage">Storage tips</button>
        <button role="tab" aria-controls="tab-delivery" id="t-delivery">Delivery</button>
      </div>
      <div class="tab-panel" role="tabpanel" id="tab-nutrition" aria-labelledby="t-nutrition">
        <table class="nutri-table">
          <caption>Approximate values per 100 g</caption>
          ${p.nutrition.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join("")}
        </table>
      </div>
      <div class="tab-panel" role="tabpanel" id="tab-storage" aria-labelledby="t-storage" hidden>
        <p>${p.storage}</p>
      </div>
      <div class="tab-panel" role="tabpanel" id="tab-delivery" aria-labelledby="t-delivery" hidden>
        <p><strong>Express, ${npr(SHOP.EXPRESS_FEE)}:</strong> order by 2 PM and we deliver the same evening inside Kathmandu Valley.</p>
        <p><strong>Standard, ${npr(SHOP.STANDARD_FEE)}:</strong> 2–3 days. Free on orders of ${npr(SHOP.FREE_DELIVERY_OVER)} or more.</p>
        <p class="muted">Not fresh when it arrives? Hand it back to the rider, or call us within 24 hours, and we'll replace it.</p>
      </div>
    </div>

    <section class="reviews" id="reviews" aria-label="Customer reviews"></section>

    <section class="section" style="padding-bottom: 0;">
      <div class="section-head">
        <h2><span class="ne-sub">यो पनि हेर्नुहोस्</span>You might also like</h2>
        <a href="products.html?cat=${cat.id}">More ${cat.en.toLowerCase()}</a>
      </div>
      <div class="product-grid" id="related"></div>
    </section>`;

  initBuyBox();
  initZoom();
  initTabs();
  renderReviews();
  renderRelated();
}

function initBuyBox() {
  const p = product;
  let qty = 1;
  const val = document.getElementById("qty-val");
  const dec = document.getElementById("qty-dec");
  const inc = document.getElementById("qty-inc");
  const add = document.getElementById("add-btn");
  const wish = document.getElementById("wish-btn");

  const update = () => {
    val.textContent = qty;
    add.dataset.qty = qty;
    dec.disabled = qty <= 1;
    inc.disabled = qty >= p.stock;
  };
  dec.onclick = () => { qty = Math.max(1, qty - 1); update(); };
  inc.onclick = () => { qty = Math.min(p.stock, qty + 1); update(); };
  if (p.stock === 0) dec.disabled = inc.disabled = true;
  else update();

  const syncWish = () => {
    wish.innerHTML = `${icon("heart")} ${Wishlist.has(p.id) ? "Saved" : "Add to wishlist"}`;
    wish.querySelector(".icon").style.fill = Wishlist.has(p.id) ? "currentColor" : "none";
  };
  syncWish();
  document.addEventListener("wishlist:change", syncWish);
}

function initZoom() {
  const zoom = document.getElementById("zoom");
  const inner = zoom.querySelector(".zoom-inner");

  const setOrigin = (x, y) => {
    const r = zoom.getBoundingClientRect();
    inner.style.transformOrigin = `${((x - r.left) / r.width) * 100}% ${((y - r.top) / r.height) * 100}%`;
  };

  zoom.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") zoom.classList.add("zoomed"); });
  zoom.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") zoom.classList.remove("zoomed"); });
  zoom.addEventListener("pointermove", (e) => setOrigin(e.clientX, e.clientY));
  zoom.addEventListener("click", (e) => {
    if (e.pointerType === "mouse") return;
    setOrigin(e.clientX, e.clientY);
    zoom.classList.toggle("zoomed");
  });
  zoom.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      inner.style.transformOrigin = "50% 50%";
      zoom.classList.toggle("zoomed");
    }
  });
}

function initTabs() {
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const select = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
    });
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => select(t));
    t.addEventListener("keydown", (e) => {
      const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!dir) return;
      const next = tabs[(i + dir + tabs.length) % tabs.length];
      select(next);
      next.focus();
    });
  });
  select(tabs[0]);
}

function renderReviews() {
  const list = allReviews();
  const avg = list.length ? (list.reduce((s, r) => s + r.rating, 0) / list.length).toFixed(1) : null;
  const countText = `${list.length} review${list.length === 1 ? "" : "s"}`;

  document.getElementById("review-link").textContent = avg ? `${countText} (${avg} avg)` : "No reviews yet";

  document.getElementById("reviews").innerHTML = `
    <div>
      <h2>Customer reviews</h2>
      ${avg ? `
        <div class="review-score"><span class="big">${avg}</span>${stars(Number(avg), "Average rating")}</div>
        <p class="muted" style="font-size:.88rem;">from ${countText}</p>` : `<p class="muted">Nobody has reviewed this yet.</p>`}

      <form class="review-form" id="review-form">
        <h3>Write a review</h3>
        <div class="form-grid">
          <div>
            <label for="r-name">Name</label>
            <input id="r-name" name="name" required maxlength="40">
          </div>
          <div>
            <label id="r-rating-label">Rating</label>
            <div class="star-input" role="radiogroup" aria-labelledby="r-rating-label">
              ${[5, 4, 3, 2, 1].map((n) => `
                <input type="radio" id="star-${n}" name="rating" value="${n}" ${n === 5 ? "checked" : ""}>
                <label for="star-${n}" title="${n} star${n > 1 ? "s" : ""}">★</label>`).join("")}
            </div>
          </div>
          <div>
            <label for="r-comment">Your review</label>
            <textarea id="r-comment" name="comment" rows="3" required maxlength="400"></textarea>
          </div>
          <button type="submit" class="btn btn-green">Post review</button>
        </div>
      </form>
    </div>

    <div>
      ${list.map((r) => `
        <article class="review">
          <div class="review-head"><strong>${escapeHtml(r.name)}</strong> ${stars(r.rating, "Rating")}</div>
          <p>${escapeHtml(r.comment)}</p>
        </article>`).join("") || `<p class="muted">Bought this before? Your review helps other shoppers.</p>`}
    </div>`;

  document.getElementById("review-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target.elements;
    const all = store.get(KEYS.reviews, {});
    all[product.id] = [
      { name: f.name.value.trim(), rating: Number(f.rating.value), comment: f.comment.value.trim() },
      ...(all[product.id] || []),
    ];
    store.set(KEYS.reviews, all);
    renderReviews();
    toast("Thanks for your review!");
  });
}

function renderRelated() {
  const same = PRODUCTS.filter((x) => x.cat === product.cat && x.id !== product.id && x.stock > 0);
  const others = PRODUCTS.filter((x) => x.cat !== product.cat && x.stock > 0).sort((a, b) => b.sold - a.sold);
  document.getElementById("related").innerHTML = [...same, ...others].slice(0, 3).map(productCard).join("");
}

if (product) renderProduct();
else renderNotFound();
