// Password hashing (scrypt) and cookie sessions for staff.
import { scryptSync, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { one, run, now } from "./db.js";
import { can } from "./permissions.js";

const SESSION_COOKIE = "sagpat_admin";
const SESSION_HOURS = 12;

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored).split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = scryptSync(password, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

export function validatePassword(password) {
  if (typeof password !== "string" || password.length < 10) return "Password must be at least 10 characters.";
  if (password.length > 200) return "Password is too long.";
  return null;
}

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

export function createSession(res, adminId) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_HOURS * 3600 * 1000);
  run("INSERT INTO sessions (token_hash, admin_id, created_at, expires_at) VALUES (:t, :a, :c, :e)", {
    t: sha256(token), a: adminId, c: now(), e: expires.toISOString(),
  });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    expires,
    path: "/",
  });
}

export function destroySession(req, res) {
  const token = req.cookies[SESSION_COOKIE];
  if (token) run("DELETE FROM sessions WHERE token_hash = :t", { t: sha256(token) });
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function destroyAllSessions(adminId) {
  run("DELETE FROM sessions WHERE admin_id = :a", { a: adminId });
}

// Tiny cookie parser (avoids another dependency)
export function cookies(req, _res, next) {
  req.cookies = Object.fromEntries(
    (req.headers.cookie || "").split(";").map((c) => c.trim().split("=")).filter(([k]) => k)
      .map(([k, ...v]) => [k, decodeURIComponent(v.join("="))]),
  );
  next();
}

export function loadAdmin(req, _res, next) {
  const token = req.cookies[SESSION_COOKIE];
  if (token) {
    const row = one(`
      SELECT a.id, a.name, a.email, a.role, a.active, s.expires_at
      FROM sessions s JOIN admins a ON a.id = s.admin_id
      WHERE s.token_hash = :t`, { t: sha256(token) });
    if (row && row.active && row.expires_at > now()) req.admin = { id: row.id, name: row.name, email: row.email, role: row.role };
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.admin) return res.status(401).json({ error: "Please sign in." });
  next();
}

// requirePerm("a", "b") passes if the admin has ANY of the listed permissions
export const requirePerm = (...perms) => (req, res, next) => {
  if (!req.admin) return res.status(401).json({ error: "Please sign in." });
  if (!perms.some((p) => can(req.admin, p))) return res.status(403).json({ error: "You don't have permission to do that." });
  next();
};

// Simple in-memory rate limiter (per IP + key)
const hits = new Map();
export const rateLimit = ({ key, max, windowMs }) => (req, res, next) => {
  const id = `${key}:${req.ip}`;
  const nowMs = Date.now();
  const entry = hits.get(id) || { count: 0, reset: nowMs + windowMs };
  if (nowMs > entry.reset) Object.assign(entry, { count: 0, reset: nowMs + windowMs });
  entry.count++;
  hits.set(id, entry);
  if (entry.count > max) {
    res.set("Retry-After", Math.ceil((entry.reset - nowMs) / 1000));
    return res.status(429).json({ error: "Too many attempts. Please wait a few minutes and try again." });
  }
  next();
};

export function cleanupSessions() {
  run("DELETE FROM sessions WHERE expires_at < :n", { n: now() });
}
