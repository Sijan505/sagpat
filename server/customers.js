// Shop customer accounts: Google sign-in, cookie sessions and notifications.
// Staff accounts live in auth.js and are completely separate.
import { createHash, createPublicKey, randomBytes, verify } from "node:crypto";
import { one, all, run, now } from "./db.js";

const USER_COOKIE = "sagpat_user";
const SESSION_DAYS = 30;

export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";

export class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.status = status;
  }
}

// ---------- Google ID token verification ----------
// Google signs ID tokens (RS256) with keys published at this URL. We verify the
// signature and claims ourselves so no extra dependency is needed.
const CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";
let certs = { keys: new Map(), expires: 0 };

async function googleKey(kid) {
  if (Date.now() > certs.expires || !certs.keys.has(kid)) {
    const res = await fetch(CERTS_URL);
    if (!res.ok) throw new AuthError("Couldn't reach Google to check your sign-in. Please try again.", 503);
    const { keys } = await res.json();
    const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get("cache-control") || "")?.[1]) || 3600;
    certs = {
      keys: new Map(keys.map((k) => [k.kid, createPublicKey({ key: k, format: "jwk" })])),
      expires: Date.now() + maxAge * 1000,
    };
  }
  return certs.keys.get(kid);
}

const b64json = (s) => JSON.parse(Buffer.from(s, "base64url").toString("utf8"));

export async function verifyGoogleToken(token) {
  if (!GOOGLE_CLIENT_ID) throw new AuthError("Google sign-in isn't set up on this shop yet.", 503);
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new AuthError("Invalid sign-in. Please try again.");
  const [h, p, sig] = parts;

  let header, claims;
  try {
    header = b64json(h);
    claims = b64json(p);
  } catch {
    throw new AuthError("Invalid sign-in. Please try again.");
  }
  if (header.alg !== "RS256") throw new AuthError("Invalid sign-in. Please try again.");

  const key = await googleKey(header.kid);
  if (!key || !verify("RSA-SHA256", Buffer.from(`${h}.${p}`), key, Buffer.from(sig, "base64url"))) {
    throw new AuthError("Invalid sign-in. Please try again.");
  }
  const nowSec = Date.now() / 1000;
  if (claims.aud !== GOOGLE_CLIENT_ID) throw new AuthError("This sign-in wasn't meant for Sagpat.");
  if (!["accounts.google.com", "https://accounts.google.com"].includes(claims.iss)) throw new AuthError("Invalid sign-in. Please try again.");
  if (!(claims.exp > nowSec - 60)) throw new AuthError("Your sign-in expired. Please try again.");
  if (!claims.sub || !claims.email || claims.email_verified === false) throw new AuthError("Your Google account needs a verified email address.");
  return claims;
}

export async function upsertGoogleUser(claims) {
  const at = now();
  const name = String(claims.name || claims.email.split("@")[0]).slice(0, 100);
  const picture = typeof claims.picture === "string" && claims.picture.startsWith("https://") ? claims.picture : null;
  await run(`INSERT INTO users (google_sub, email, name, picture, created_at, last_login_at)
       VALUES (:sub, :email, :name, :picture, :at, :at)
       ON CONFLICT(google_sub) DO UPDATE SET email = excluded.email, name = excluded.name,
         picture = excluded.picture, last_login_at = excluded.last_login_at`,
  { sub: claims.sub, email: claims.email, name, picture, at });
  return await one("SELECT id, email, name, picture FROM users WHERE google_sub = :sub", { sub: claims.sub });
}

// ---------- Sessions ----------
const sha256 = (s) => createHash("sha256").update(s).digest("hex");

export async function createUserSession(res, userId) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400 * 1000);
  await run("INSERT INTO user_sessions (token_hash, user_id, created_at, expires_at) VALUES (:t, :u, :c, :e)", {
    t: sha256(token), u: userId, c: now(), e: expires.toISOString(),
  });
  res.cookie(USER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires,
    path: "/",
  });
}

export async function destroyUserSession(req, res) {
  const token = req.cookies[USER_COOKIE];
  if (token) await run("DELETE FROM user_sessions WHERE token_hash = :t", { t: sha256(token) });
  res.clearCookie(USER_COOKIE, { path: "/" });
}

export async function loadUser(req, _res, next) {
  const token = req.cookies[USER_COOKIE];
  if (token) {
    const row = await one(`
      SELECT u.id, u.email, u.name, u.picture, s.expires_at
      FROM user_sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = :t`, { t: sha256(token) });
    if (row && row.expires_at > now()) req.user = { id: row.id, email: row.email, name: row.name, picture: row.picture };
  }
  next();
}

export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Please sign in." });
  next();
}

export async function cleanupUserSessions() {
  await run("DELETE FROM user_sessions WHERE expires_at < :n", { n: now() });
}

// ---------- Notifications ----------
export async function notify(userId, { orderId = null, title, body }) {
  if (!userId) return;
  await run(`INSERT INTO notifications (user_id, order_id, title, body, created_at)
       VALUES (:u, :o, :title, :body, :at)`, { u: userId, o: orderId, title, body, at: now() });
}

export async function listNotifications(userId, limit = 30) {
  const items = (await all(`
    SELECT n.id, n.order_id, n.title, n.body, n.created_at, n.read_at, o.access_key
    FROM notifications n LEFT JOIN orders o ON o.id = n.order_id
    WHERE n.user_id = :u ORDER BY n.id DESC LIMIT :limit`, { u: userId, limit }))
    .map((n) => ({
      id: n.id, orderId: n.order_id, orderKey: n.access_key, title: n.title, body: n.body,
      createdAt: n.created_at, read: !!n.read_at,
    }));
  const unread = (await one("SELECT COUNT(*) AS n FROM notifications WHERE user_id = :u AND read_at IS NULL", { u: userId })).n;
  return { unread, items };
}

export async function markNotificationsRead(userId) {
  await run("UPDATE notifications SET read_at = :at WHERE user_id = :u AND read_at IS NULL", { at: now(), u: userId });
}
