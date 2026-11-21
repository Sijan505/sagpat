// Sagpat app: storefront, public API and the staff admin panel.
// server/index.js runs it locally; api/index.js runs it on Vercel.
import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initDb } from "./db.js";
import { seedIfEmpty, loadSeedCatalog } from "./seed.js";
import { cookies, loadAdmin, cleanupSessions } from "./auth.js";
import { publicRoutes } from "./routes/public.js";
import { adminRoutes } from "./routes/admin.js";
import { loadUser, cleanupUserSessions } from "./customers.js";
import { cleanupEvents } from "./events.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Database setup runs once per server start (or per cold start on Vercel).
// If it fails (e.g. the database is briefly unreachable), the next request
// tries again instead of the server staying broken.
let setupPromise = null;
function ensureReady() {
  if (!setupPromise) {
    setupPromise = (async () => {
      await initDb();
      await seedIfEmpty();
      await cleanup();
    })().catch((err) => {
      setupPromise = null;
      console.error("Database setup failed, will retry on the next request:", err);
      throw err;
    });
  }
  return setupPromise;
}
export const ready = ensureReady();
ready.catch(() => {}); // logged above; requests retry

let lastCleanup = 0;
async function cleanup() {
  lastCleanup = Date.now();
  await Promise.all([cleanupSessions(), cleanupUserSessions(), cleanupEvents()]);
}

export const app = express();
app.disable("x-powered-by");
// On Vercel, the client's IP comes from the platform's proxy headers
app.set("trust proxy", process.env.VERCEL ? true : "loopback");

app.use(async (_req, _res, next) => {
  await ensureReady();
  // Expired sessions and old live events are tidied up about once an hour
  if (Date.now() - lastCleanup > 60 * 60 * 1000) cleanup().catch(console.error);
  next();
});

app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    // Google's sign-in button needs to see which site it's on (origin only)
    "Referrer-Policy": req.path.startsWith("/admin") ? "same-origin" : "strict-origin-when-cross-origin",
  });
  next();
});
app.use(express.json({ limit: "100kb" }));
app.use(cookies, loadAdmin, loadUser);

// Catalog script + public API (must come before the static /js folder)
app.use(publicRoutes({ testimonials: loadSeedCatalog().TESTIMONIALS }));

// Admin API: never cached
app.use("/api/admin", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); }, adminRoutes());
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }));

// Only these folders are public. The project root also holds server code and
// the database, so it is never served as a whole. (On Vercel these files are
// served by the CDN from public/, see scripts/build-static.js.)
const staticOpts = { index: false, fallthrough: true };
for (const dir of ["css", "js", "images"]) app.use(`/${dir}`, express.static(path.join(ROOT, dir), staticOpts));
app.get(["/admin", "/admin/"], (_req, res) => res.sendFile(path.join(ROOT, "admin", "index.html")));
app.use("/admin", express.static(path.join(ROOT, "admin"), staticOpts));

export const PAGES = ["index", "products", "product", "cart", "checkout", "confirmation", "about", "credits", "account", "privacy"];
app.get("/", (_req, res) => res.sendFile(path.join(ROOT, "index.html")));
app.get("/:page.html", (req, res, next) => {
  const file = path.join(ROOT, `${req.params.page}.html`);
  if (PAGES.includes(req.params.page) && existsSync(file)) return res.sendFile(file);
  next();
});

app.use((_req, res) => res.status(404).sendFile(path.join(ROOT, "index.html")));

// Errors: known ones become friendly JSON, anything else is logged
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid request." });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "That file or request is too large." });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our side. Please try again." });
});

export default app;
