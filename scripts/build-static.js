// Vercel build step: copies only the shop's public files into public/, which
// Vercel serves from its CDN. Server code, the database and anything else in
// the project root stay private (they run inside the api/ function instead).
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public");

const PAGES = ["index", "products", "product", "cart", "checkout", "confirmation", "about", "credits", "account"];
const DIRS = ["css", "js", "images", "admin"];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const page of PAGES) cpSync(path.join(ROOT, `${page}.html`), path.join(OUT, `${page}.html`));
for (const dir of DIRS) {
  cpSync(path.join(ROOT, dir), path.join(OUT, dir), {
    recursive: true,
    // Local photo uploads aren't deployed; on Vercel uploads go to Blob storage
    filter: (src) => !src.includes(`${path.sep}uploads`),
  });
}
if (existsSync(path.join(OUT, "js", "data.js"))) throw new Error("js/data.js must not exist: the server generates it.");
console.log(`Copied ${PAGES.length} pages and ${DIRS.join(", ")} to public/`);
