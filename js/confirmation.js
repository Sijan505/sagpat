// Order confirmation and tracking: loads the order from the server with the
// private key from the link, shows its live status and a printable invoice.

const confirmRoot = document.getElementById("confirm-root");
const params = new URLSearchParams(location.search);
const orderId = params.get("id") || "";
// Older links may lack the key; look it up from orders placed on this device
const orderKey = params.get("key") || store.get(KEYS.orders, []).find((o) => o.id === orderId)?.key || "";

const STEPS = [
  ["pending", "Order received", "We've got your order."],
  ["confirmed", "Confirmed", "Our team has checked your order."],
  ["packed", "Packed", "Picked fresh and packed for you."],
  ["out_for_delivery", "Out for delivery", "The rider will call before arriving."],
  ["delivered", "Delivered", "Enjoy! Tell us if anything isn't fresh."],
];

const nepalDate = (ymd) => new Date(`${ymd}T00:00:00+05:45`);
const fmtDay = (ymd) => nepalDate(ymd).toLocaleDateString("en-GB", { timeZone: "Asia/Kathmandu", weekday: "short", day: "numeric", month: "short" });
const fmtTime = (iso) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Kathmandu", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const deliveryWindow = (o) => (o.delivery.from === o.delivery.to ? fmtDay(o.delivery.from) : `${fmtDay(o.delivery.from)} – ${fmtDay(o.delivery.to)}`);

function timeline(o) {
  const reached = Object.fromEntries(o.history.map((h) => [h.status, h.at]));
  if (o.status === "cancelled") {
    return `<li class="done"><span class="dot-ui"></span><strong>Order received</strong><small>${fmtTime(o.createdAt)}</small></li>
      <li class="current"><span class="dot-ui"></span><strong>Cancelled</strong><small>${reached.cancelled ? fmtTime(reached.cancelled) : ""} · Call us if this is a surprise.</small></li>`;
  }
  const currentIdx = o.status === "failed" ? STEPS.findIndex(([s]) => s === "out_for_delivery") : STEPS.findIndex(([s]) => s === o.status);
  return STEPS.map(([status, title, text], i) => {
    const cls = i < currentIdx || o.status === "delivered" ? "done" : i === currentIdx ? "current" : "";
    let small = reached[status] ? fmtTime(reached[status]) : text;
    if (status === "out_for_delivery" && o.status === "failed") small = "We couldn't reach you. We'll call to arrange another time.";
    if (status === "delivered" && !reached.delivered) small = `Expected ${deliveryWindow(o)}, ${escapeHtml(o.delivery.slot)}`;
    return `<li class="${cls}"><span class="dot-ui"></span><strong>${title}</strong><small>${small}</small></li>`;
  }).join("");
}

function renderOrder(o) {
  const c = o.customer;
  const t = o.totals;
  const cancelled = o.status === "cancelled";

  confirmRoot.innerHTML = `
    <div class="panel success-hero no-print">
      <div class="success-icon" style="${cancelled ? "background:#57534e" : ""}">${icon(cancelled ? "x" : "check")}</div>
      <h1>${cancelled ? "अर्डर रद्द भयो" : "तपाईंको अर्डर सफल भयो!"}</h1>
      <p class="en">${cancelled ? "This order was cancelled." : `Your order is confirmed. Thank you, ${escapeHtml(c.name.split(" ")[0])}!`}</p>

      <div class="order-meta">
        <div><small>Order ID</small><strong>${escapeHtml(o.id)}</strong></div>
        <div><small>Expected delivery</small><strong>${deliveryWindow(o)}</strong><br><small>${escapeHtml(o.delivery.slot)}</small></div>
        <div><small>Total · ${escapeHtml(o.payment.label)}</small><strong>${npr(t.total)}</strong><br><small>${escapeHtml(o.payment.status)}</small></div>
      </div>

      ${o.payment.method === "bank" && o.payment.status !== "Paid" && !cancelled ? `
        <p class="field-hint" style="margin-top: 16px;">Please transfer <strong>${npr(t.total)}</strong> and put <strong>${escapeHtml(o.id)}</strong> in the remarks. We'll dispatch once it's received.</p>` : ""}
      ${["khalti", "esewa"].includes(o.payment.method) && o.payment.status !== "Paid" && !cancelled ? `
        <p class="field-hint" style="margin-top: 16px;">We'll send a ${escapeHtml(o.payment.label)} payment link to ${escapeHtml(c.phone)} shortly.</p>` : ""}

      <div class="next-steps">
        <button type="button" class="btn btn-primary" id="print-btn">${icon("print")} Download / print invoice</button>
        <a href="#tracking" class="btn btn-outline">Track order</a>
        <a href="index.html" class="btn btn-ghost">Back to home</a>
      </div>
      <p class="muted" style="margin-top: 22px; font-size: 0.9rem;">
        Questions? Call <strong>${escapeHtml(SHOP.PHONE)}</strong> or email <strong>${escapeHtml(SHOP.EMAIL)}</strong>. We're here 7 AM – 8 PM, every day.
        Bookmark this page to check your order later.
      </p>
    </div>

    <div class="panel no-print" id="tracking" style="padding: 28px; margin-top: 24px;">
      <h2 style="font-size: 1.15rem; margin-bottom: 18px;">Order status</h2>
      <ol class="timeline">${timeline(o)}</ol>
      ${o.delivery.rider && o.status === "out_for_delivery" ? `<p class="field-hint" style="margin-top:14px">Your rider: <strong>${escapeHtml(o.delivery.rider)}</strong></p>` : ""}
    </div>

    <div class="panel invoice" id="invoice" style="margin-top: 24px;">
      <div class="invoice-head">
        <div>
          <div class="logo">${LOGO_SVG}<span class="logo-text"><strong>Sagpat</strong><small>सगपात</small></span></div>
          <p class="muted" style="font-size: 0.85rem; margin-top: 8px;">Sagpat Pvt. Ltd. · Kalimati, Kathmandu<br>PAN: [000000000] · ${escapeHtml(SHOP.PHONE)}</p>
        </div>
        <div style="text-align: right;">
          <h2>INVOICE</h2>
          <p style="font-size: 0.9rem;"><strong>${escapeHtml(o.id)}</strong><br>${fmtTime(o.createdAt)}</p>
        </div>
      </div>

      <div class="invoice-parties">
        <div>
          <h4>Bill / Ship to</h4>
          <strong>${escapeHtml(c.name)}</strong><br>
          ${escapeHtml(c.address)}<br>${escapeHtml(c.landmark)}, ${escapeHtml(c.district)}<br>
          ${escapeHtml(c.phone)}${c.email ? `<br>${escapeHtml(c.email)}` : ""}
        </div>
        <div>
          <h4>Delivery &amp; Payment</h4>
          ${o.delivery.type === "express" ? "Express" : "Standard"} delivery · ${escapeHtml(o.delivery.slot)}<br>
          Expected: ${deliveryWindow(o)}<br>
          Payment: ${escapeHtml(o.payment.label)} (${escapeHtml(o.payment.status)})
        </div>
      </div>

      <table>
        <thead><tr><th>Item</th><th class="num">Unit price</th><th class="num">Qty</th><th class="num">Amount</th></tr></thead>
        <tbody>
          ${o.items.map((i) => `
            <tr>
              <td>${escapeHtml(i.ne)} · ${escapeHtml(i.en)}</td>
              <td class="num">${npr(i.price)} / ${escapeHtml(i.unit)}</td>
              <td class="num">${i.qty}</td>
              <td class="num">${npr(i.price * i.qty)}</td>
            </tr>`).join("")}
        </tbody>
      </table>

      <div class="invoice-totals">
        <div class="summary-row"><span>Subtotal</span><span>${npr(t.subtotal)}</span></div>
        <div class="summary-row"><span>Delivery</span><span>${t.delivery === 0 ? "FREE" : npr(t.delivery)}</span></div>
        <div class="summary-row"><span>VAT</span><span>${npr(t.tax)}</span></div>
        <div class="summary-row grand"><span>Grand Total</span><span>${npr(t.total)}</span></div>
      </div>

      <p class="invoice-foot">धन्यवाद! Thank you for buying from Nepali farmers.</p>
    </div>`;

  document.title = `Order ${o.id} | Sagpat`;
  document.getElementById("print-btn").addEventListener("click", () => window.print());
}

function renderNotFound() {
  confirmRoot.innerHTML = `
    <div class="panel empty-state">
      <h2>Order not found</h2>
      <p>Check the link from your confirmation, or call us on ${escapeHtml(SHOP.PHONE)} with your order ID.</p>
      <a href="index.html" class="btn btn-primary">Back to home</a>
    </div>`;
}

async function load() {
  const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}?key=${encodeURIComponent(orderKey)}`);
  if (!res.ok) throw new Error("not found");
  return res.json();
}

let lastStatus = null;
load().then((o) => {
  lastStatus = o.status;
  renderOrder(o);
  // Check for status changes every minute while the page is open
  if (!["delivered", "cancelled"].includes(o.status)) {
    setInterval(async () => {
      if (document.hidden) return;
      const fresh = await load().catch(() => null);
      if (fresh && fresh.status !== lastStatus) {
        lastStatus = fresh.status;
        renderOrder(fresh);
        toast(`Order update: ${fresh.statusLabel}`);
      }
    }, 60000);
  }
}).catch(renderNotFound);
