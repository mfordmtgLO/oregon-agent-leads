import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Simple single-user session auth for Mike Ford.
 * Credentials are fixed per project requirements; the session token is an
 * HMAC-signed value stored in an httpOnly cookie.
 */
export const APP_USERNAME = "mike.ford";
export const APP_PASSWORD = "OregonMLO2025!";
export const APP_SESSION_COOKIE = "oal_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  return process.env.JWT_SECRET || "oal-dev-secret";
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function verifyCredentials(username: string, password: string): boolean {
  const u = Buffer.from(username);
  const eu = Buffer.from(APP_USERNAME);
  const p = Buffer.from(password);
  const ep = Buffer.from(APP_PASSWORD);
  const userOk = u.length === eu.length && timingSafeEqual(u, eu);
  const passOk = p.length === ep.length && timingSafeEqual(p, ep);
  return userOk && passOk;
}

export function createSessionToken(now: number = Date.now()): string {
  const payload = `${APP_USERNAME}.${now + SESSION_TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined, now: number = Date.now()): boolean {
  if (!token) return false;
  // Username itself contains a dot ("mike.ford"), so parse from the right.
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return false;
  const signature = token.slice(lastDot + 1);
  const payload = token.slice(0, lastDot);
  const midDot = payload.lastIndexOf(".");
  if (midDot === -1) return false;
  const username = payload.slice(0, midDot);
  const expiresStr = payload.slice(midDot + 1);
  const expected = sign(payload);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return false;
  if (username !== APP_USERNAME) return false;
  const expires = Number(expiresStr);
  if (!Number.isFinite(expires) || expires < now) return false;
  return true;
}
