// Shared helpers for the admin app.

export const state = { me: null };

export function can(permission) {
  const perms = state.me?.permissions || [];
  return perms.includes("*") || perms.includes(permission);
}
export const canAny = (...perms) => perms.some(can);

// ---------- API ----------
export async function api(path, { method = "GET", body, raw } = {}) {
  const opts = { method, headers: {} };
  if (raw) {
    opts.body = raw;
    opts.headers["Content-Type"] = raw.type || "application/octet-stream";
  } else if (body !== undefined) {
    opts.body = JSON.stringify(body);
    opts.headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`/api/admin${path}`, opts);
  if (res.status === 401) {
    location.replace(`/admin/?next=${encodeURIComponent(location.hash)}`);
    throw new Error("Signed out");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ---------- Formatting ----------
export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function npr(n, { decimals = true } = {}) {
  const v = Number(n) || 0;
  const paisa = decimals && !Number.isInteger(Math.round(v * 100) / 100);
  return "रु " + v.toLocaleString("en-IN", { minimumFractionDigits: paisa ? 2 : 0, maximumFractionDigits: decimals ? 2 : 0 });
}

export function compact(n) {
  const v = Number(n) || 0;
  if (v >= 1e7) return (v / 1e7).toFixed(1).replace(/\.0$/, "") + " Cr";
  if (v >= 1e5) return (v / 1e5).toFixed(1).replace(/\.0$/, "") + " L";
  if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(Math.round(v));
}

const TZ = "Asia/Kathmandu";
export const fmtDate = (d) => new Date(d.length === 10 ? `${d}T00:00:00+05:45` : d)
  .toLocaleDateString("en-GB", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });
export const fmtDay = (d) => new Date(`${d}T00:00:00+05:45`).toLocaleDateString("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
export const fmtDateTime = (d) => new Date(d).toLocaleString("en-GB", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function ago(d) {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return fmtDateTime(d);
}

export const nepalToday = () => new Date(Date.now() + 345 * 60000).toISOString().slice(0, 10);
export function addDays(ymd, n) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const STATUS_LABELS = {
  pending: "New", confirmed: "Confirmed", packed: "Packed", out_for_delivery: "Out for delivery",
  delivered: "Delivered", failed: "Delivery failed", cancelled: "Cancelled",
};
export const pill = (status) => `<span class="pill ${esc(status)}">${esc(STATUS_LABELS[status] || status)}</span>`;

export function paymentPill(status) {
  const cls = status === "Paid" ? "ok" : status === "Refunded" ? "neutral" : "warn";
  return `<span class="pill ${cls}">${esc(status)}</span>`;
}

// Button labels for each status change
export const ACTION_LABELS = {
  confirmed: "Confirm order", packed: "Mark packed", out_for_delivery: "Send out for delivery",
  delivered: "Mark delivered", failed: "Delivery failed", cancelled: "Cancel order",
};

// ---------- Icons (Lucide, ISC) ----------
const ICONS = {
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  orders: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  tag: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  store: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M2 7h20v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2Z"/>',
};
export const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;

// ---------- Toasts ----------
export function toast(message, type = "", { html = false, ms = 3500 } = {}) {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  if (html) el.innerHTML = message;
  else el.textContent = message;
  document.getElementById("toasts").appendChild(el);
  setTimeout(() => el.remove(), ms);
}

// ---------- Modal dialog ----------
// onSubmit receives the form; throw an Error to show it inside the dialog.
export function modal({ title, body, submitLabel = "Save", danger = false, onSubmit, wide = false }) {
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    if (wide) dlg.style.width = "min(760px, calc(100% - 32px))";
    dlg.innerHTML = `
      <form method="dialog" novalidate>
        <div class="modal-head"><h2>${esc(title)}</h2>
          <button type="button" class="icon-btn" data-close aria-label="Close">${icon("x")}</button></div>
        <div class="modal-body"><div class="form-error" data-error role="alert" hidden style="margin-bottom:12px"></div>${body}</div>
        <div class="modal-foot">
          <button type="button" class="btn btn-default" data-close>Cancel</button>
          <button type="submit" class="btn ${danger ? "btn-danger" : "btn-primary"}">${esc(submitLabel)}</button>
        </div>
      </form>`;
    document.body.appendChild(dlg);
    const form = dlg.querySelector("form");
    const errorEl = dlg.querySelector("[data-error]");
    const submit = form.querySelector('[type="submit"]');
    let result;

    dlg.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => dlg.close()));
    dlg.addEventListener("close", () => { dlg.remove(); resolve(result); });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorEl.hidden = true;
      for (const field of form.elements) {
        if (field.willValidate && !field.checkValidity()) { field.reportValidity(); return; }
      }
      submit.disabled = true;
      try {
        result = onSubmit ? await onSubmit(form) : true;
        dlg.close();
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      } finally {
        submit.disabled = false;
      }
    });
    dlg.showModal();
    form.querySelector("input:not([type=hidden]), select, textarea")?.focus();
  });
}

export const confirmDialog = (message, { title = "Are you sure?", confirmLabel = "Confirm", danger = true } = {}) =>
  modal({ title, body: `<p>${esc(message)}</p>`, submitLabel: confirmLabel, danger });

export function formData(form) {
  return Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));
}

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// Filters live in the hash (e.g. #/orders?status=pending) so links and reloads keep them
export const hashQuery = () => new URLSearchParams(location.hash.split("?")[1] || "");
export function setHashQuery(params) {
  const base = location.hash.split("?")[0];
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null)).toString();
  history.replaceState(null, "", qs ? `${base}?${qs}` : base);
}
