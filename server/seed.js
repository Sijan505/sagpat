// First-run setup: catalog, delivery slots, settings and one staff account per role.
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, one, run, now, transaction, saveSettings, DEFAULT_SETTINGS } from "./db.js";
import { hashPassword } from "./auth.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
export const CREDENTIALS_FILE = path.join(ROOT, "data", "staff-logins.local.txt");

export function loadSeedCatalog() {
  const src = readFileSync(path.join(HERE, "seed-data.js"), "utf8");
  return vm.runInNewContext(`${src}\n;({ CATEGORIES, PRODUCTS, TESTIMONIALS })`);
}

const STAFF = [
  { name: "Sagpat Admin", email: "admin@sagpat.example", role: "super_admin" },
  { name: "Order Desk", email: "orders@sagpat.example", role: "order_manager" },
  { name: "Inventory Team", email: "products@sagpat.example", role: "product_manager" },
  { name: "Dispatch Team", email: "delivery@sagpat.example", role: "delivery_manager" },
];

const SLOTS = [
  ["standard", "Morning (7–10 AM)", 40],
  ["standard", "Afternoon (12–3 PM)", 40],
  ["standard", "Evening (5–8 PM)", 40],
  ["express_today", "Within 4 hours", 15],
  ["express_today", "Evening today (5–8 PM)", 20],
  ["express_tomorrow", "Tomorrow morning (7–10 AM)", 25],
];

export function seedIfEmpty() {
  const catalog = loadSeedCatalog();
  let created = false;

  transaction(() => {
    if (!one("SELECT COUNT(*) AS n FROM categories").n) {
      catalog.CATEGORIES.forEach((c, i) =>
        run("INSERT INTO categories (id, ne, en, image, sort) VALUES (:id, :ne, :en, :image, :sort)", { ...c, sort: i }));
      for (const p of catalog.PRODUCTS) {
        run(`INSERT INTO products (id, cat, ne, en, unit, price, rating, stock, sold, added, image, origin, description,
               nutrition, storage, reviews, updated_at)
             VALUES (:id, :cat, :ne, :en, :unit, :price, :rating, :stock, :sold, :added, :image, :origin, :desc,
               :nutrition, :storage, :reviews, :at)`, {
          ...p, nutrition: JSON.stringify(p.nutrition), reviews: JSON.stringify(p.reviews), at: now(),
        });
      }
      created = true;
    }
    if (!one("SELECT COUNT(*) AS n FROM delivery_slots").n) {
      SLOTS.forEach(([type, label, capacity], i) =>
        run("INSERT INTO delivery_slots (type, label, capacity, sort) VALUES (:type, :label, :capacity, :sort)", { type, label, capacity, sort: i }));
    }
    if (!one("SELECT COUNT(*) AS n FROM settings").n) saveSettings(DEFAULT_SETTINGS);
  });

  // Staff accounts: random passwords, written to a local file (never committed)
  if (!one("SELECT COUNT(*) AS n FROM admins").n) {
    const lines = [
      "Sagpat staff logins (generated on first run). Sign in at /admin and change these passwords.",
      "This file is in data/, which is git-ignored. Delete it once you've saved the passwords somewhere safe.",
      "",
    ];
    for (const s of STAFF) {
      const password = process.env.SEED_ADMIN_PASSWORD || randomBytes(9).toString("base64url");
      run("INSERT INTO admins (name, email, password_hash, role, created_at) VALUES (:name, :email, :hash, :role, :at)", {
        ...s, hash: hashPassword(password), at: now(),
      });
      lines.push(`${s.role.padEnd(18)} ${s.email.padEnd(26)} ${password}`);
    }
    writeFileSync(CREDENTIALS_FILE, lines.join("\n") + "\n");
    console.log(`\n  Created staff accounts. Logins saved to: data/staff-logins.local.txt\n`);
  }

  if (created) console.log(`  Loaded ${catalog.PRODUCTS.length} products into the database.`);
  return catalog;
}

// Allow `node server/seed.js` on its own
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  seedIfEmpty();
  db.close();
}
