// Cart page: line items, quantity controls, totals.

const cartRoot = document.getElementById("cart-root");

function renderCart() {
  const lines = Cart.lines();

  if (!lines.length) {
    cartRoot.innerHTML = `
      <div class="panel empty-state">
        <span class="ne">तपाईंको टोकरी खाली छ</span>
        <h2>Your cart is empty</h2>
        <p>Nothing here yet. Today’s saag and fruit are in the shop.</p>
        <a href="products.html" class="btn btn-primary btn-lg">Shopping गर्नुहोस्</a>
      </div>`;
    return;
  }

  const t = calcTotals(Cart.subtotal(), "standard");
  const remaining = SHOP.FREE_DELIVERY_OVER - t.subtotal;
  const progress = Math.min(100, (t.subtotal / SHOP.FREE_DELIVERY_OVER) * 100);

  cartRoot.innerHTML = `
    <div class="cart-layout">
      <div class="panel">
        <table class="cart-table">
          <thead>
            <tr><th>Product</th><th class="num">Unit price</th><th>Quantity</th><th class="num">Total</th><th><span class="sr-only">Remove</span></th></tr>
          </thead>
          <tbody>
            ${lines.map(({ p, qty, total }) => `
              <tr>
                <td class="c-product">
                  <div class="cart-product">
                    <a href="product.html?id=${p.id}" class="thumb">${productMedia(p)}</a>
                    <div>
                      <a href="product.html?id=${p.id}"><strong>${p.ne}</strong></a>
                      <small>${p.en} · ${npr(p.price)} / ${p.unit}</small>
                    </div>
                  </div>
                </td>
                <td class="num c-price">${npr(p.price)}</td>
                <td class="c-qty">
                  <div class="qty">
                    <button type="button" data-dec="${p.id}" aria-label="Decrease ${p.en}">−</button>
                    <span aria-live="polite">${qty}</span>
                    <button type="button" data-inc="${p.id}" aria-label="Increase ${p.en}" ${qty >= p.stock ? "disabled" : ""}>+</button>
                  </div>
                </td>
                <td class="num c-total"><span class="line-total">${npr(total)}</span></td>
                <td class="c-remove"><button type="button" class="remove-btn" data-remove="${p.id}" aria-label="Remove ${p.en}" title="Remove">${icon("x")}</button></td>
              </tr>`).join("")}
          </tbody>
        </table>
        <div class="cart-actions">
          <a href="products.html" class="btn btn-outline btn-sm">← Continue shopping</a>
          <button type="button" class="btn-danger-text" id="empty-cart">Empty cart</button>
        </div>
      </div>

      <aside class="panel summary" aria-label="Order summary">
        <h2>Order summary</h2>
        <div class="free-progress">
          ${remaining > 0
            ? `Add <strong>${npr(remaining)}</strong> more for free standard delivery`
            : `Your order gets <strong>free standard delivery</strong>.`}
          <div class="bar"><span style="width:${progress}%"></span></div>
        </div>
        <div class="summary-row"><span>Subtotal (${Cart.count()} items)</span><span>${npr(t.subtotal)}</span></div>
        <div class="summary-row"><span>Delivery (standard)</span>
          <span class="${t.delivery === 0 ? "free" : ""}">${t.delivery === 0 ? "FREE" : npr(t.delivery)}</span></div>
        <div class="summary-row"><span>VAT (${Math.round(SHOP.TAX_RATE * 100)}%)</span><span>${npr(t.tax)}</span></div>
        <div class="grand-total"><span>Total</span><span class="amount">${npr(t.total)}</span></div>
        <a href="checkout.html" class="btn btn-primary btn-lg btn-block">Proceed to checkout</a>
        <p class="summary-note">Express same-day delivery (${npr(SHOP.EXPRESS_FEE)}) is available at checkout.</p>
      </aside>
    </div>`;
}

cartRoot.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const { inc, dec, remove } = btn.dataset;
  const qtyOf = (id) => Cart.items().find((i) => i.id === Number(id))?.qty || 0;

  if (inc) Cart.setQty(Number(inc), qtyOf(inc) + 1);
  else if (dec) Cart.setQty(Number(dec), qtyOf(dec) - 1);
  else if (remove) {
    const p = getProduct(remove);
    Cart.remove(p.id);
    toast(`${p.en} removed`);
  } else if (btn.id === "empty-cart") {
    // Ask for a second click instead of a blocking confirm() dialog
    if (btn.dataset.armed) {
      Cart.clear();
      toast("Cart emptied");
    } else {
      btn.dataset.armed = "1";
      btn.textContent = "Click again to empty cart";
      setTimeout(() => {
        if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = "Empty cart"; }
      }, 3000);
      return;
    }
  } else return;

  renderCart();
});

document.addEventListener("cart:external-change", renderCart);
renderCart();
