import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { Role, roleFromStoredValue } from "./roles";

export const SESSION_COOKIE = "nyumbapap_session";
export type SessionUser = { userId: string; role: Role; displayName: string };
export const SESSION_MAX_AGE_SECONDS = 7 * 86400;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  return value;
}

export function createSessionToken(user: SessionUser) {
  const payload = Buffer.from(JSON.stringify({ ...user, sessionId: randomBytes(16).toString("base64url"), issuedAt: Date.now(), expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 })).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readSessionToken(token?: string): SessionUser | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof value.expiresAt !== "number" || value.expiresAt < Date.now() || typeof value.issuedAt !== "number" || typeof value.sessionId !== "string") return null;
    if (typeof value.userId !== "string" || typeof value.displayName !== "string") return null;
    const role = roleFromStoredValue(value.role);
    if (!role) return null;
    return { userId: value.userId, role, displayName: value.displayName };
  } catch { return null; }
}

export async function currentSession() {
  return readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}
