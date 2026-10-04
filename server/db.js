// SQLite database (Node's built-in node:sqlite, no native add-ons needed).
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB_FILE = process.env.DB_FILE || path.join(ROOT, "data", "sagpat.db");
mkdirSync(path.dirname(DB_FILE), { recursive: true });

export const db = new DatabaseSync(DB_FILE);
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;");

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    last_login_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    ne TEXT NOT NULL,
    en TEXT NOT NULL,
    image TEXT,
    sort INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    cat TEXT NOT NULL REFERENCES categories(id) ON UPDATE CASCADE,
    ne TEXT NOT NULL,
    en TEXT NOT NULL,
    unit TEXT NOT NULL,
    price REAL NOT NULL,
    rating REAL NOT NULL DEFAULT 4.5,
    stock INTEGER NOT NULL DEFAULT 0,
    low_stock INTEGER NOT NULL DEFAULT 10,
    sold INTEGER NOT NULL DEFAULT 0,
    added TEXT NOT NULL,
    image TEXT,
    origin TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    nutrition TEXT NOT NULL DEFAULT '[]',
    storage TEXT NOT NULL DEFAULT '',
    reviews TEXT NOT NULL DEFAULT '[]',
    active INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS stock_movements (
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL,
    at TEXT NOT NULL,
    change INTEGER NOT NULL,
    stock_after INTEGER NOT NULL,
    reason TEXT NOT NULL,
    admin_name TEXT
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    district TEXT,
    address TEXT,
    landmark TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    access_key TEXT NOT NULL,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    status TEXT NOT NULL,
    ship_name TEXT NOT NULL,
    ship_phone TEXT NOT NULL,
    ship_email TEXT,
    ship_district TEXT NOT NULL,
    ship_address TEXT NOT NULL,
    ship_landmark TEXT NOT NULL,
    delivery_type TEXT NOT NULL,
    slot TEXT NOT NULL,
    delivery_date TEXT NOT NULL,
    expected_from TEXT NOT NULL,
    expected_to TEXT NOT NULL,
    notes TEXT,
    rider TEXT,
    payment_method TEXT NOT NULL,
    payment_status TEXT NOT NULL,
    subtotal REAL NOT NULL,
    delivery_fee REAL NOT NULL,
    tax REAL NOT NULL,
    total REAL NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
  CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);

  CREATE TABLE IF NOT EXISTS order_items (
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL,
    ne TEXT NOT NULL,
    en TEXT NOT NULL,
    unit TEXT NOT NULL,
    price REAL NOT NULL,
    qty INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);

  CREATE TABLE IF NOT EXISTS order_events (
    id INTEGER PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    at TEXT NOT NULL,
    type TEXT NOT NULL,          -- status | note | update
    status TEXT,
    note TEXT,
    admin_name TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_events_order ON order_events(order_id);

  CREATE TABLE IF NOT EXISTS delivery_slots (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL,          -- standard | express_today | express_tomorrow
    label TEXT NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 25,
    active INTEGER NOT NULL DEFAULT 1,
    sort INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY,
    at TEXT NOT NULL,
    admin_id INTEGER,
    admin_name TEXT,
    action TEXT NOT NULL,
    detail TEXT
  );
`);

export const now = () => new Date().toISOString();

// Plain objects instead of null-prototype rows, so they serialise predictably
const plain = (row) => (row ? { ...row } : row);

// node:sqlite rejects unknown keys and silently binds missing ones as NULL.
// Pass only the parameters a statement uses, and fail loudly if one is missing.
function bind(sql, params) {
  const out = {};
  for (const [, name] of sql.matchAll(/[:$@]([A-Za-z_]\w*)/g)) {
    if (params[name] === undefined) throw new Error(`Missing SQL parameter "${name}"`);
    out[name] = typeof params[name] === "boolean" ? Number(params[name]) : params[name];
  }
  return out;
}
export const one = (sql, params = {}) => plain(db.prepare(sql).get(bind(sql, params)));
export const all = (sql, params = {}) => db.prepare(sql).all(bind(sql, params)).map(plain);
export const run = (sql, params = {}) => db.prepare(sql).run(bind(sql, params));

export function transaction(fn) {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

// ---------- Settings ----------
export const DEFAULT_SETTINGS = {
  free_delivery_over: 500,
  standard_fee: 50,
  express_fee: 150,
  tax_rate: 0.13,
  express_cutoff_hour: 14,
  phone: "+977 980-0000000",
  email: "support@sagpat.example",
  accepting_orders: true,
};

export function getSettings() {
  const rows = all("SELECT key, value FROM settings");
  const stored = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]));
  return { ...DEFAULT_SETTINGS, ...stored };
}

export function saveSettings(values) {
  const stmt = db.prepare("INSERT INTO settings (key, value) VALUES (:key, :value) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
  for (const [key, value] of Object.entries(values)) stmt.run({ key, value: JSON.stringify(value) });
}

export function audit(admin, action, detail = "") {
  run("INSERT INTO audit_log (at, admin_id, admin_name, action, detail) VALUES (:at, :id, :name, :action, :detail)", {
    at: now(), id: admin?.id ?? null, name: admin?.name ?? "system", action, detail,
  });
}

export function productFromRow(r) {
  return {
    id: r.id, cat: r.cat, ne: r.ne, en: r.en, unit: r.unit, price: r.price, rating: r.rating,
    stock: r.stock, lowStock: r.low_stock, sold: r.sold, added: r.added, image: r.image,
    origin: r.origin, desc: r.description, nutrition: JSON.parse(r.nutrition), storage: r.storage,
    reviews: JSON.parse(r.reviews), active: !!r.active, updatedAt: r.updated_at,
  };
}
