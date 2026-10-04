import { api, esc, npr, compact, fmtDay, debounce, hashQuery, setHashQuery } from "../core.js";

const PAYMENT = { cod: "Cash on delivery", bank: "Bank transfer", khalti: "Khalti", esewa: "eSewa" };

export async function reportsView(root) {
  const q = hashQuery();
  let days = [7, 30, 90].includes(Number(q.get("days"))) ? Number(q.get("days")) : 30;
  let metric = q.get("metric") === "orders" ? "orders" : "revenue";
  let data;

  root.innerHTML = `
    <div class="page-head"><div><h1>Reports</h1><p>Cancelled orders are left out of sales figures. Times are Nepal time.</p></div></div>
    <div class="range-row">
      <div class="seg" role="group" aria-label="Date range" id="range">
        ${[7, 30, 90].map((d) => `<button type="button" data-d="${d}" aria-pressed="${d === days}">Last ${d} days</button>`).join("")}
      </div>
    </div>
    <div id="body"></div>`;
  const body = root.querySelector("#body");

  async function load() {
    setHashQuery({ days: days === 30 ? "" : days, metric: metric === "revenue" ? "" : metric });
    body.style.opacity = data ? 0.55 : 1; // keep the old frame while refetching
    data = await api(`/reports?days=${days}`);
    body.style.opacity = 1;
    render();
  }

  function render() {
    const t = data.totals;
    const p = data.previous;
    body.innerHTML = `
      <div class="stats">
        ${tile("Sales", npr(t.revenue, { decimals: false }), delta(t.revenue, p.revenue))}
        ${tile("Orders", t.orders.toLocaleString("en-IN"), delta(t.orders, p.orders))}
        ${tile("Average order", npr(t.aov, { decimals: false }))}
        ${tile("Customers who ordered", t.customers, `${t.newCustomers} new`)}
        ${tile("Cancelled orders", t.cancelled)}
      </div>

      <section class="card" style="margin-bottom:16px">
        <div class="card-head">
          <h2>${metric === "revenue" ? "Sales per day (NPR)" : "Orders per day"}</h2>
          <div class="seg" role="group" aria-label="Measure" id="metric">
            <button type="button" data-m="revenue" aria-pressed="${metric === "revenue"}">Sales</button>
            <button type="button" data-m="orders" aria-pressed="${metric === "orders"}">Orders</button>
          </div>
        </div>
        <div class="card-body">
          <div class="chart" id="daily"></div>
          ${tableView(["Day", "Orders", "Sales"], data.series.map((d) => [fmtDay(d.day), d.orders, npr(d.revenue, { decimals: false })]))}
        </div>
      </section>

      <div class="grid grid-2">
        ${barsCard("Best-selling products", "by sales", data.topProducts.map((x) => ({ label: x.en, sub: x.ne, value: x.revenue, text: `${npr(x.revenue, { decimals: false })} · ${x.qty} sold` })))}
        ${barsCard("Sales by category", "", data.byCategory.map((x) => ({ label: x.label, value: x.revenue, text: npr(x.revenue, { decimals: false }) })))}
        ${barsCard("Payment methods", "by number of orders", data.byPayment.map((x) => ({ label: PAYMENT[x.method] || x.method, value: x.orders, text: `${x.orders} · ${share(x.orders, t.orders)}` })))}
        ${barsCard("Top districts", "by number of orders", data.byDistrict.map((x) => ({ label: x.district, value: x.orders, text: `${x.orders} · ${npr(x.revenue, { decimals: false })}` })))}
        ${barsCard("Delivery type", "", data.byDelivery.map((x) => ({ label: x.type === "express" ? "Express" : "Standard", value: x.orders, text: `${x.orders} · ${share(x.orders, t.orders)}` })))}
      </div>`;

    body.querySelector("#metric").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      metric = b.dataset.m;
      setHashQuery({ days: days === 30 ? "" : days, metric: metric === "revenue" ? "" : metric });
      render();
    });
    drawColumns(body.querySelector("#daily"), data.series.map((d) => ({
      key: d.day, label: fmtDay(d.day), value: d[metric], text: metric === "revenue" ? npr(d.revenue, { decimals: false }) : `${d.orders} orders`,
    })), metric === "revenue" ? (v) => compact(v) : (v) => String(v));
  }

  root.querySelector("#range").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    days = Number(b.dataset.d);
    root.querySelectorAll("#range button").forEach((x) => x.setAttribute("aria-pressed", x === b));
    load();
  });

  const onResize = debounce(() => data && render(), 200);
  window.addEventListener("resize", onResize);
  await load();
  return { destroy: () => window.removeEventListener("resize", onResize), onEvent: debounce((type) => { if (type.startsWith("order")) load(); }, 1500) };
}

// ---------- Pieces ----------
function tile(label, value, deltaHtml = "") {
  return `<div class="stat"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div>${deltaHtml ? `<div class="delta ${deltaHtml.cls || ""}">${esc(deltaHtml.text || deltaHtml)}</div>` : ""}</div>`;
}

function delta(cur, prev) {
  if (!prev) return { text: "No earlier data to compare", cls: "" };
  const pct = ((cur - prev) / prev) * 100;
  const sign = pct >= 0 ? "+" : "−";
  return { text: `${sign}${Math.abs(pct).toFixed(0)}% vs previous period`, cls: pct >= 0 ? "up" : "down" };
}

const share = (n, total) => (total ? `${Math.round((n / total) * 100)}%` : "0%");

function tableView(headers, rows) {
  return `<details class="table-view"><summary>Show as table</summary>
    <div class="table-wrap"><table class="data"><thead><tr>${headers.map((h, i) => `<th class="${i ? "num" : ""}">${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td class="${i ? "num" : ""}">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details>`;
}

// Horizontal bars: one hue, value at the tip, label in text colour
function barsCard(title, subtitle, rows) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return `<section class="card">
    <div class="card-head"><h2>${esc(title)}${subtitle ? ` <span class="muted" style="font-weight:400">${esc(subtitle)}</span>` : ""}</h2></div>
    <div class="card-body">
      ${rows.length ? `<div class="hbars">${rows.map((r) => `
        <div class="hbar" title="${esc(r.label)}: ${esc(r.text)}">
          <span class="name">${esc(r.label)}${r.sub ? ` <span class="muted ne">${esc(r.sub)}</span>` : ""}</span>
          <span class="track"><span class="fill" style="display:block; width:${(r.value / max) * 100}%"></span></span>
          <span class="num muted">${esc(r.text)}</span>
        </div>`).join("")}</div>` : '<p class="muted">No sales in this period.</p>'}
      ${rows.length ? tableView([title, "Value"], rows.map((r) => [r.label, r.text])) : ""}
    </div>
  </section>`;
}

function niceStep(raw) {
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

// Vertical columns with hover/focus tooltips. Single series, so no legend.
function drawColumns(el, points, tickFmt) {
  const W = Math.max(320, el.clientWidth || 700);
  const H = 240;
  const pad = { top: 22, right: 8, bottom: 26, left: 44 };
  const iw = W - pad.left - pad.right;
  const ih = H - pad.top - pad.bottom;
  const maxVal = Math.max(...points.map((p) => p.value), 0);
  const step = niceStep(Math.max(maxVal, 1) / 4);
  const top = Math.max(step, Math.ceil(maxVal / step) * step);
  const y = (v) => pad.top + ih - (v / top) * ih;
  const slot = iw / points.length;
  const bw = Math.min(24, Math.max(2, slot - 2)); // capped thickness, 2px air between neighbours
  const r = Math.min(4, bw / 2);
  const every = Math.ceil(points.length / Math.max(2, Math.floor(iw / 70)));
  const maxIdx = points.findIndex((p) => p.value === maxVal && maxVal > 0);

  const ticks = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);

  // Rounded data-end, square at the baseline
  const bar = (x, v) => {
    const h = Math.max(0, pad.top + ih - y(v));
    if (h === 0) return "";
    const rr = Math.min(r, h);
    const yb = pad.top + ih;
    return `M${x},${yb} V${yb - h + rr} Q${x},${yb - h} ${x + rr},${yb - h} H${x + bw - rr} Q${x + bw},${yb - h} ${x + bw},${yb - h + rr} V${yb} Z`;
  };

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Column chart, ${points.length} days">
    ${ticks.map((v) => `<line class="grid-line" x1="${pad.left}" x2="${W - pad.right}" y1="${y(v)}" y2="${y(v)}"/>
      <text class="axis-text" x="${pad.left - 6}" y="${y(v) + 4}" text-anchor="end">${esc(tickFmt(v))}</text>`).join("")}
    ${points.map((p, i) => {
      const x = pad.left + i * slot + (slot - bw) / 2;
      return `<g>
        <rect class="bar-hit" x="${pad.left + i * slot}" y="${pad.top}" width="${slot}" height="${ih}" tabindex="0"
          data-i="${i}" aria-label="${esc(p.label)}: ${esc(p.text)}"/>
        <path class="bar" d="${bar(x, p.value)}"/>
        ${i === maxIdx ? `<text class="label-text" x="${x + bw / 2}" y="${y(p.value) - 6}" text-anchor="middle">${esc(tickFmt(p.value))}</text>` : ""}
        ${i % every === 0 ? `<text class="axis-text" x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${esc(p.label.replace(/^\w+ /, ""))}</text>` : ""}
      </g>`;
    }).join("")}
  </svg><div class="chart-tip" hidden></div>`;

  const tip = el.querySelector(".chart-tip");
  const show = (target) => {
    const p = points[Number(target.dataset.i)];
    tip.replaceChildren();
    const strong = document.createElement("strong");
    strong.textContent = p.text;
    tip.append(strong, document.createTextNode(p.label));
    const box = target.getBoundingClientRect();
    const host = el.getBoundingClientRect();
    tip.style.left = `${box.left - host.left + box.width / 2}px`;
    tip.style.top = `${(y(p.value) / H) * host.height}px`;
    tip.hidden = false;
  };
  el.querySelectorAll(".bar-hit").forEach((h) => {
    h.addEventListener("pointerenter", () => show(h));
    h.addEventListener("focus", () => show(h));
    h.addEventListener("pointerleave", () => (tip.hidden = true));
    h.addEventListener("blur", () => (tip.hidden = true));
  });
}
