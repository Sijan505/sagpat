// Optional: fill the database with ~30 days of made-up orders so the dashboard
// and reports have something to show. Run with `npm run seed:demo`.
// Every demo customer's phone starts with 980000, so they're easy to spot and delete.
import { randomBytes } from "node:crypto";
import { db, one, all, run, transaction, getSettings } from "./db.js";
import { seedIfEmpty } from "./seed.js";
import { calcTotals, PAYMENT_METHODS } from "./orders.js";

seedIfEmpty();

if (one("SELECT COUNT(*) AS n FROM customers WHERE phone LIKE '980000%'").n) {
  console.log("Demo orders are already loaded. Nothing to do.");
  process.exit(0);
}

const NAMES = [
  "Sita Shrestha", "Ramesh Thapa", "Anjali Gurung", "Bikash Tamang", "Pooja Rai", "Suman KC", "Nirmala Magar", "Hari Adhikari",
  "Gita Poudel", "Rajesh Yadav", "Sabina Karki", "Prakash Shakya", "Kiran Maharjan", "Dawa Sherpa", "Asmita Joshi", "Bishal Basnet",
  "Rina Bajracharya", "Sanjay Dahal", "Manisha Lama", "Deepak Bhandari", "Kabita Ghimire", "Nabin Pandey", "Sarita Rana", "Arjun Khadka",
];
const PLACES = [
  ["Kathmandu", "Baneshwor", "Near Shankhamul Chowk"], ["Kathmandu", "Baluwatar", "Opposite the bank"], ["Kathmandu", "Kalanki", "Behind the petrol pump"],
  ["Lalitpur", "Jhamsikhel", "Near the school"], ["Lalitpur", "Kupondole", "Next to the temple"], ["Lalitpur", "Imadol", "Blue gate house"],
  ["Bhaktapur", "Suryabinayak", "Near the bus park"], ["Bhaktapur", "Thimi", "Behind the ward office"], ["Kathmandu", "Budhanilkantha", "Near the monastery"],
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const s = getSettings();
const products = all("SELECT id, ne, en, unit, price FROM products WHERE active = 1");
const slots = Object.fromEntries(["standard", "express_today"].map((t) => [t, all("SELECT label FROM delivery_slots WHERE type = :t", { t }).map((x) => x.label)]));
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const customers = NAMES.map((name, i) => {
  const [district, area, landmark] = pick(PLACES);
  const phone = `980000${String(1000 + i).slice(-4)}`;
  const created = new Date(Date.now() - (35 - i) * 86400000).toISOString();
  const r = run(`INSERT INTO customers (name, phone, email, district, address, landmark, created_at)
                 VALUES (:name, :phone, '', :district, :area, :landmark, :created)`, { name, phone, district, area, landmark, created });
  return { id: Number(r.lastInsertRowid), name, phone, district, address: area, landmark };
});

const FLOW = ["pending", "confirmed", "packed", "out_for_delivery", "delivered"];
let count = 0;

transaction(() => {
  for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
    const perDay = 2 + Math.floor(Math.random() * 5) + (daysAgo % 7 === 1 ? 3 : 0); // Saturdays are busier
    for (let n = 0; n < perDay; n++) {
      const c = pick(customers);
      const created = new Date(Date.now() - daysAgo * 86400000 - Math.floor(Math.random() * 10) * 3600000);
      const type = Math.random() < 0.35 ? "express" : "standard";
      const lines = [...products].sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 4))
        .map((p) => ({ p, qty: 1 + Math.floor(Math.random() * 3) }));
      const totals = calcTotals(lines.reduce((sum, l) => sum + l.p.price * l.qty, 0), type, s);
      const payment = pick(["cod", "cod", "cod", "esewa", "khalti", "bank"]);
      const deliveryDate = new Date(created.getTime() + (type === "express" ? 0 : 2) * 86400000).toISOString().slice(0, 10);

      // Older orders are finished; recent ones are still moving through the steps
      let status;
      if (daysAgo >= 3) status = Math.random() < 0.06 ? "cancelled" : "delivered";
      else if (daysAgo === 2) status = pick(["delivered", "delivered", "out_for_delivery", "failed"]);
      else status = pick(FLOW.slice(0, 4));

      const id = `SGP-${created.toISOString().slice(2, 10).replace(/-/g, "")}-${Array.from(randomBytes(4), (b) => alphabet[b % 32]).join("")}`;
      const paid = status === "delivered" || (payment !== "cod" && Math.random() < 0.8);
      run(`INSERT INTO orders (id, access_key, customer_id, created_at, updated_at, status, ship_name, ship_phone, ship_email, ship_district,
             ship_address, ship_landmark, delivery_type, slot, delivery_date, expected_from, expected_to, notes, payment_method, payment_status,
             subtotal, delivery_fee, tax, total)
           VALUES (:id, :key, :cid, :at, :at, :status, :name, :phone, '', :district, :address, :landmark, :type, :slot, :dd, :dd, :dd, '',
             :pay, :pstatus, :subtotal, :fee, :tax, :total)`, {
        ...c, id, key: randomBytes(16).toString("base64url"), cid: c.id, at: created.toISOString(), status, type,
        slot: pick(slots[type === "express" ? "express_today" : "standard"]), dd: deliveryDate, pay: payment,
        pstatus: paid ? "Paid" : PAYMENT_METHODS[payment].status, subtotal: totals.subtotal, fee: totals.delivery, tax: totals.tax, total: totals.total,
      });
      for (const { p, qty } of lines) {
        run(`INSERT INTO order_items (order_id, product_id, ne, en, unit, price, qty) VALUES (:id, :pid, :ne, :en, :unit, :price, :qty)`,
          { id, pid: p.id, ne: p.ne, en: p.en, unit: p.unit, price: p.price, qty });
      }
      const steps = status === "cancelled" ? ["pending", "cancelled"]
        : status === "failed" ? [...FLOW.slice(0, 4), "failed"] : FLOW.slice(0, FLOW.indexOf(status) + 1);
      steps.forEach((st, i) => run(`INSERT INTO order_events (order_id, at, type, status, note, admin_name)
        VALUES (:id, :at, 'status', :st, :note, :by)`, {
        id, at: new Date(created.getTime() + i * 2 * 3600000).toISOString(), st,
        note: i === 0 ? "Order placed" : "", by: i === 0 ? "" : pick(["Order Desk", "Dispatch Team"]),
      }));
      count++;
    }
  }
});

console.log(`Added ${count} demo orders from ${customers.length} demo customers.`);
db.close();
