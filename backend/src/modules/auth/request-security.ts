import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

export const CSRF_COOKIE = "nyumbapap_csrf";
export const DEVICE_COOKIE = "nyumbapap_device";

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  return value;
}

function mac(label: string, value: string) {
  return createHmac("sha256", secret()).update(`${label}:${value}`).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function cookieValue(request: Request, name: string) {
  return request.headers.get("cookie")?.split(";").map((value) => value.trim()).find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1);
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const allowedOrigins = [new URL(request.url).origin];
    if (process.env.APP_URL) allowedOrigins.push(new URL(process.env.APP_URL).origin);
    if (process.env.FRONTEND_URL) allowedOrigins.push(new URL(process.env.FRONTEND_URL).origin);
    for (const configuredOrigin of (process.env.FRONTEND_URLS ?? "").split(",")) {
      if (configuredOrigin.trim()) allowedOrigins.push(new URL(configuredOrigin.trim()).origin);
    }
    return allowedOrigins.includes(new URL(origin).origin);
  }
  catch { return false; }
}

export function createCsrfToken() {
  const nonce = randomBytes(24).toString("base64url");
  return `${nonce}.${mac("csrf", nonce)}`;
}

function validSignedToken(token: string | undefined, label: string) {
  if (!token) return false;
  const [nonce, signature] = token.split(".");
  return Boolean(nonce && signature && safeEqual(signature, mac(label, nonce)));
}

export function verifyCsrfRequest(request: Request) {
  if (!isSameOrigin(request)) return false;
  const header = request.headers.get("x-csrf-token");
  const cookie = cookieValue(request, CSRF_COOKIE);
  return Boolean(header && cookie && safeEqual(header, cookie) && validSignedToken(cookie, "csrf"));
}

export function deviceIdentity(request: Request) {
  const current = cookieValue(request, DEVICE_COOKIE);
  const token = validSignedToken(current, "device")
    ? current!
    : (() => { const nonce = randomBytes(24).toString("base64url"); return `${nonce}.${mac("device", nonce)}`; })();
  return { token, hash: mac("device-hash", token), isNew: token !== current };
}

export function clientIpHash(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "local";
  return mac("ip", ip);
}

export function phoneRateKey(phoneHash: string) {
  return mac("phone", phoneHash);
}

export async function consumeRateLimit(action: string, keyHash: string, limit: number, windowSeconds: number) {
  const now = new Date();
  const id = createHmac("sha256", secret()).update(`rate:${action}:${keyHash}`).digest("hex");
  const result = await db.$transaction(async tx => {
    const where = { action_keyHash: { action, keyHash } };
    const current = await tx.authRateLimit.findUnique({ where });
    const expired = !current || current.windowExpiresAt <= now;
    return tx.authRateLimit.upsert({ where, create: { id, action, keyHash, count: 1, windowExpiresAt: new Date(now.getTime() + windowSeconds * 1000) }, update: expired ? { count: 1, windowExpiresAt: new Date(now.getTime() + windowSeconds * 1000) } : { count: { increment: 1 } } });
  });
  return {
    limited: result.count > limit,
    retryAfter: Math.max(1, Math.ceil((result.windowExpiresAt.getTime() - Date.now()) / 1000))
  };
}

export const authCookieOptions = (httpOnly: boolean, maxAge: number) => ({
  httpOnly,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
  priority: "high" as const
});
