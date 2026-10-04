// Checkout: 4 steps (address → delivery → payment → review), then creates the order.

const PAYMENTS = {
  cod: { label: "Cash on Delivery", ne: "डेलिभरीमा नगद", status: "Pay on delivery" },
  bank: { label: "Bank Transfer", ne: "बैंक ट्रान्सफर", status: "Awaiting bank transfer" },
  khalti: { label: "Khalti", ne: "खल्ती", status: "Payment pending" },
  esewa: { label: "eSewa", ne: "इसेवा", status: "Payment pending" },
};

// Delivery slots are managed by staff in the admin panel
const SLOTS = SHOP.SLOTS;

const form = document.getElementById("checkout-form");
const panels = [...form.querySelectorAll(".step-panel")];
const stepItems = [...document.querySelectorAll(".stepper li")];
let step = 1;

// ---------- Helpers ----------
function expectedDelivery(type, now = new Date()) {
  const day = (offset) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    return d;
  };
  if (type === "express") {
    const d = now.getHours() < SHOP.EXPRESS_CUTOFF_HOUR ? day(0) : day(1);
    return { from: d, to: d };
  }
  return { from: day(2), to: day(3) };
}

function shortDate(d) {
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function expectedText(type) {
  const { from, to } = expectedDelivery(type);
  return from.toDateString() === to.toDateString() ? shortDate(from) : `${shortDate(from)} – ${shortDate(to)}`;
}

// Hook for Khalti / eSewa. Once you have merchant accounts, start the provider's
// payment flow here (redirect or SDK) using the order ID and total from the server.
async function startOnlinePayment(order) {
  return "pending";
}

const deliveryType = () => form.elements.delivery.value;
const paymentType = () => form.elements.payment.value;
const totals = () => calcTotals(Cart.subtotal(), deliveryType());

// ---------- Steps ----------
function showStep(n) {
  step = n;
  panels.forEach((p) => (p.hidden = Number(p.dataset.step) !== n));
  stepItems.forEach((li) => {
    const s = Number(li.dataset.step);
    li.classList.toggle("active", s === n);
    li.classList.toggle("done", s < n);
    li.style.cursor = s < n ? "pointer" : "";
    if (s === n) li.setAttribute("aria-current", "step");
    else li.removeAttribute("aria-current");
  });
  if (n === 4) renderReview();
  const top = document.querySelector(".stepper").getBoundingClientRect().top + scrollY - 100;
  if (scrollY > top) scrollTo({ top, behavior: "smooth" });
  panels[n - 1].querySelector("h2").focus({ preventScroll: true });
}

function validateStep(n) {
  for (const field of panels[n - 1].querySelectorAll("input, select, textarea")) {
    if (!field.checkValidity()) {
      field.reportValidity();
      field.focus();
      return false;
    }
  }
  return true;
}

function next() {
  if (validateStep(step)) showStep(Math.min(4, step + 1));
}

// ---------- Delivery step ----------
function updateDelivery() {
  const sub = Cart.subtotal();
  const std = calcTotals(sub, "standard").delivery;
  document.getElementById("standard-price").textContent = std === 0 ? "FREE" : npr(std);
  document.getElementById("express-price").textContent = npr(SHOP.EXPRESS_FEE);
  document.getElementById("standard-desc").textContent =
    `2–3 days · arrives ${expectedText("standard")}` + (std === 0 ? " · free over " + npr(SHOP.FREE_DELIVERY_OVER) : "");

  const sameDay = new Date().getHours() < SHOP.EXPRESS_CUTOFF_HOUR;
  document.getElementById("express-desc").textContent = sameDay
    ? `Same day · arrives today (${expectedText("express")})`
    : `Past today's 2 PM cutoff · arrives tomorrow morning (${expectedText("express")})`;

  const slotSelect = form.elements.slot;
  const current = slotSelect.value;
  const slots = deliveryType() === "express" ? (sameDay ? SLOTS.expressToday : SLOTS.expressTomorrow) : SLOTS.standard;
  slotSelect.innerHTML = slots.map((s) => `<option${s === current ? " selected" : ""}>${s}</option>`).join("");

  renderSummary();
}

function updatePayment() {
  const type = paymentType();
  document.getElementById("bank-details").hidden = type !== "bank";
  document.getElementById("online-note").hidden = !(type === "khalti" || type === "esewa");
}

// ---------- Summary + review ----------
function renderSummary() {
  const t = totals();
  document.getElementById("checkout-summary").innerHTML = `
    <h2>Your order</h2>
    <ul class="mini-items">
      ${Cart.lines().map(({ p, qty, total }) => `
        <li>
          <span class="thumb">${productMedia(p)}<span class="q">${qty}</span></span>
          <span class="name">${p.ne}<small>${p.en}</small></span>
          <strong>${npr(total)}</strong>
        </li>`).join("")}
    </ul>
    <div class="summary-row"><span>Subtotal</span><span>${npr(t.subtotal)}</span></div>
    <div class="summary-row"><span>Delivery (${deliveryType()})</span>
      <span class="${t.delivery === 0 ? "free" : ""}">${t.delivery === 0 ? "FREE" : npr(t.delivery)}</span></div>
    <div class="summary-row"><span>VAT (${Math.round(SHOP.TAX_RATE * 100)}%)</span><span>${npr(t.tax)}</span></div>
    <div class="grand-total"><span>Total</span><span class="amount">${npr(t.total)}</span></div>
    <p class="summary-note">We only use your details to deliver this order.</p>`;
}

function renderReview() {
  const f = form.elements;
  const t = totals();
  const pay = PAYMENTS[paymentType()];
  document.getElementById("review-content").innerHTML = `
    <div class="review-block">
      <div class="review-block-head"><h3>Items (${Cart.count()})</h3><a href="cart.html" class="edit-link">Edit cart</a></div>
      <ul class="review-items">
        ${Cart.lines().map(({ p, qty, total }) => `
          <li><span>${p.ne} · ${p.en} <span class="muted">× ${qty} ${p.unit}</span></span><strong>${npr(total)}</strong></li>`).join("")}
      </ul>
    </div>
    <div class="review-block">
      <div class="review-block-head"><h3>Deliver to</h3><button type="button" class="edit-link" data-goto="1">Edit</button></div>
      <p><strong>${escapeHtml(f.name.value)}</strong> · ${escapeHtml(f.phone.value)}${f.email.value ? ` · ${escapeHtml(f.email.value)}` : ""}<br>
      ${escapeHtml(f.address.value)}, ${escapeHtml(f.landmark.value)}, ${escapeHtml(f.district.value)}</p>
    </div>
    <div class="review-block">
      <div class="review-block-head"><h3>Delivery</h3><button type="button" class="edit-link" data-goto="2">Edit</button></div>
      <p>${deliveryType() === "express" ? "Express" : "Standard"} delivery · ${escapeHtml(f.slot.value)}<br>
      <span class="muted">Expected: ${expectedText(deliveryType())}</span>
      ${f.notes.value.trim() ? `<br><span class="muted">Note: ${escapeHtml(f.notes.value)}</span>` : ""}</p>
    </div>
    <div class="review-block">
      <div class="review-block-head"><h3>Payment</h3><button type="button" class="edit-link" data-goto="3">Edit</button></div>
      <p>${pay.label} <span class="muted">(${pay.ne})</span></p>
    </div>
    <div class="review-block">
      <div class="summary-row"><span>Subtotal</span><span>${npr(t.subtotal)}</span></div>
      <div class="summary-row"><span>Delivery</span><span>${t.delivery === 0 ? "FREE" : npr(t.delivery)}</span></div>
      <div class="summary-row"><span>VAT (${Math.round(SHOP.TAX_RATE * 100)}%)</span><span>${npr(t.tax)}</span></div>
      <div class="summary-row" style="font-size: 1.25rem; font-weight: 700; color: var(--green);">
        <span>Total amount</span><span>${npr(t.total)}</span></div>
    </div>`;
}

// ---------- Place order ----------
// The server re-checks prices, stock and slot capacity, works out the totals
// and creates the order. Nothing about the order is trusted from the browser.
async function placeOrder() {
  const f = form.elements;
  const btn = document.getElementById("confirm-btn");
  const errorEl = document.getElementById("order-error");
  errorEl.hidden = true;
  btn.disabled = true;
  btn.textContent = "Placing order…";

  const customer = {
    name: f.name.value.trim(),
    phone: f.phone.value.trim(),
    email: f.email.value.trim(),
    district: f.district.value.trim(),
    address: f.address.value.trim(),
    landmark: f.landmark.value.trim(),
  };

  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer,
        delivery: { type: deliveryType(), slot: f.slot.value, notes: f.notes.value.trim() },
        payment: paymentType(),
        items: Cart.items().map(({ id, qty }) => ({ id, qty })),
      }),
    });
    const order = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(order.error || "We couldn't place your order. Please try again.");

    if (order.payment.method === "khalti" || order.payment.method === "esewa") await startOnlinePayment(order);

    // Remember the order (and its private link) on this device
    store.set(KEYS.orders, [{ id: order.id, key: order.key, createdAt: order.createdAt }, ...store.get(KEYS.orders, [])].slice(0, 20));
    store.set(KEYS.customer, customer); // pre-fill next time
    Cart.clear();
    location.href = `confirmation.html?id=${encodeURIComponent(order.id)}&key=${encodeURIComponent(order.key)}`;
  } catch (err) {
    errorEl.textContent = err.message === "Failed to fetch" ? "No connection. Check your internet and try again." : err.message;
    errorEl.hidden = false;
    btn.disabled = false;
    btn.textContent = "Confirm order";
  }
}

// ---------- Init ----------
if (!Cart.lines().length) {
  document.getElementById("checkout-main").hidden = true;
  document.getElementById("checkout-empty").hidden = false;
} else {
  // Pre-fill details saved from a previous order
  const saved = store.get(KEYS.customer, null);
  if (saved) for (const [k, v] of Object.entries(saved)) if (form.elements[k]) form.elements[k].value = v;

  panels.forEach((p) => p.querySelector("h2").setAttribute("tabindex", "-1"));

  if (!SHOP.ACCEPTING_ORDERS) {
    const note = document.createElement("p");
    note.className = "free-progress";
    note.style.marginBottom = "16px";
    note.textContent = "We're not taking new orders right now. You can fill in your details, but checkout is paused. Please try again later.";
    document.querySelector(".stepper").before(note);
  }

  form.elements.phone.addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
  });

  form.addEventListener("click", (e) => {
    if (e.target.closest("[data-next]")) next();
    else if (e.target.closest("[data-back]")) showStep(step - 1);
    else if (e.target.closest("[data-goto]")) showStep(Number(e.target.closest("[data-goto]").dataset.goto));
  });

  document.querySelector(".stepper").addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (li && Number(li.dataset.step) < step) showStep(Number(li.dataset.step));
  });

  // Enter in a field moves to the next step; only step 4 actually submits
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (step < 4) next();
    else placeOrder();
  });

  form.querySelectorAll('input[name="delivery"]').forEach((r) => r.addEventListener("change", updateDelivery));
  form.querySelectorAll('input[name="payment"]').forEach((r) => r.addEventListener("change", updatePayment));

  updateDelivery();
  updatePayment();
  showStep(1);
  scrollTo(0, 0);
}
