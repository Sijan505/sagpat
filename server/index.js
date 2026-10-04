// Sagpat server: storefront, public API and the staff admin panel.
import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedIfEmpty } from "./seed.js";
import { cookies, loadAdmin, cleanupSessions } from "./auth.js";
import { publicRoutes } from "./routes/public.js";
import { adminRoutes } from "./routes/admin.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT) || 3000;

const catalog = seedIfEmpty();
cleanupSessions();
setInterval(cleanupSessions, 60 * 60 * 1000).unref();

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", "loopback");

app.use((_req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
  });
  next();
});
app.use(express.json({ limit: "100kb" }));
app.use(cookies, loadAdmin);

// Catalog script + public API (must come before the static /js folder)
app.use(publicRoutes({ testimonials: catalog.TESTIMONIALS }));

// Admin API: never cached
app.use("/api/admin", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); }, adminRoutes());
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }));

// Only these folders are public. The project root also holds server code and
// the database, so it is never served as a whole.
const staticOpts = { index: false, fallthrough: true };
for (const dir of ["css", "js", "images"]) app.use(`/${dir}`, express.static(path.join(ROOT, dir), staticOpts));
app.get(["/admin", "/admin/"], (_req, res) => res.sendFile(path.join(ROOT, "admin", "index.html")));
app.use("/admin", express.static(path.join(ROOT, "admin"), staticOpts));

const PAGES = ["index", "products", "product", "cart", "checkout", "confirmation", "about", "credits"];
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

app.listen(PORT, (error) => {
  if (error) {
    console.error(error.code === "EADDRINUSE"
      ? `\n  Port ${PORT} is already in use. Is Sagpat already running in another terminal?\n  Stop it, or start on another port: PORT=3001 npm run dev\n`
      : error);
    process.exit(1);
  }
  console.log(`\n  Sagpat is running`);
  console.log(`  Shop:   http://localhost:${PORT}/`);
  console.log(`  Admin:  http://localhost:${PORT}/admin\n`);
});
