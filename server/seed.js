// First-run setup: catalog, delivery slots, settings and one staff account per role.
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, initDb, DATA_DIR, one, run, now, transaction, saveSettings, DEFAULT_SETTINGS } from "./db.js";
import { hashPassword } from "./auth.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
export const CREDENTIALS_FILE = path.join(DATA_DIR, "staff-logins.local.txt");

export function loadSeedCatalog() {
  const src = readFileSync(path.join(HERE, "seed-data.js"), "utf8");
  return vm.runInNewContext(`${src}\n;({ CATEGORIES, PRODUCTS, TESTIMONIALS })`);
}

// Fixed Super Admin login, so the same sign-in works on every computer that runs this project.
// Anyone with these files can read it: change it under My account if the site goes online.
const OWNER = { name: "Sagpat Admin", email: "admin@sagpat.com", password: "9864012185", role: "super_admin" };

const STAFF = [
  OWNER,
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

// On a hosted site, set SEED_ADMIN_PASSWORD so the Super Admin password isn't
// the one written in this file.
const ownerPassword = () => process.env.SEED_ADMIN_PASSWORD || OWNER.password;

export async function seedIfEmpty() {
  const catalog = loadSeedCatalog();
  let created = false;

  // Everything happens in one transaction, so two servers starting at once
  // (e.g. on Vercel) can't both load the catalog or create staff accounts.
  await transaction(async () => {
    if (!(await one("SELECT COUNT(*) AS n FROM categories")).n) {
      for (const [i, c] of catalog.CATEGORIES.entries()) {
        await run("INSERT INTO categories (id, ne, en, image, sort) VALUES (:id, :ne, :en, :image, :sort)", { ...c, sort: i });
      }
      for (const p of catalog.PRODUCTS) {
        await run(`INSERT INTO products (id, cat, ne, en, unit, price, rating, stock, sold, added, image, origin, description,
               nutrition, storage, reviews, updated_at)
             VALUES (:id, :cat, :ne, :en, :unit, :price, :rating, :stock, :sold, :added, :image, :origin, :desc,
               :nutrition, :storage, :reviews, :at)`, {
          ...p, nutrition: JSON.stringify(p.nutrition), reviews: JSON.stringify(p.reviews), at: now(),
        });
      }
      created = true;
    }
    if (!(await one("SELECT COUNT(*) AS n FROM delivery_slots")).n) {
      for (const [i, [type, label, capacity]] of SLOTS.entries()) {
        await run("INSERT INTO delivery_slots (type, label, capacity, sort) VALUES (:type, :label, :capacity, :sort)", { type, label, capacity, sort: i });
      }
    }
    if (!(await one("SELECT COUNT(*) AS n FROM settings")).n) await saveSettings(DEFAULT_SETTINGS);
    if (!(await one("SELECT COUNT(*) AS n FROM admins")).n) await createStaff();
    await ensureOwner();
  });

  if (created) console.log(`  Loaded ${catalog.PRODUCTS.length} products into the database.`);
  return catalog;
}

// Staff accounts: random passwords, written to a local file (never committed).
// Hosted servers can't write files; there the Super Admin sets the other staff
// passwords under Staff accounts.
async function createStaff() {
  const lines = [
    "Sagpat staff logins (generated on first run). Sign in at /admin and change these passwords.",
    "This file is in data/, which is git-ignored. Delete it once you've saved the passwords somewhere safe.",
    "",
  ];
  for (const s of STAFF) {
    const password = s === OWNER ? ownerPassword() : randomBytes(9).toString("base64url");
    await run("INSERT INTO admins (name, email, password_hash, role, created_at) VALUES (:name, :email, :hash, :role, :at)", {
      name: s.name, email: s.email, role: s.role, hash: hashPassword(password), at: now(),
    });
    lines.push(`${s.role.padEnd(18)} ${s.email.padEnd(26)} ${password}`);
  }
  try {
    writeFileSync(CREDENTIALS_FILE, lines.join("\n") + "\n");
    console.log("\n  Created staff accounts. Logins saved to: data/staff-logins.local.txt\n");
  } catch {
    console.log(`\n  Created staff accounts. Sign in as ${OWNER.email} and set the other staff passwords under Staff accounts.\n`);
  }
}

// Databases created before the fixed login existed: turn the old Super Admin into it (once).
async function ensureOwner() {
  if (await one("SELECT id FROM admins WHERE email = :email", { email: OWNER.email })) return;
  const old = await one("SELECT id FROM admins WHERE email = :old", { old: "admin@sagpat.example" });
  const params = { email: OWNER.email, hash: hashPassword(ownerPassword()), role: OWNER.role };
  if (old) {
    await run("UPDATE admins SET email = :email, password_hash = :hash, role = :role, active = 1 WHERE id = :id", { ...params, id: old.id });
  } else {
    await run("INSERT INTO admins (name, email, password_hash, role, created_at) VALUES (:name, :email, :hash, :role, :at)",
      { ...params, name: OWNER.name, at: now() });
  }
  console.log(`\n  Super Admin login: ${OWNER.email}\n`);
}

// Allow `node server/seed.js` on its own
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await initDb();
  await seedIfEmpty();
  db.close();
}

