import { createHmac, timingSafeEqual } from "node:crypto";

export type LifecycleActionToken =
  | { kind: "TENANT_AVAILABILITY"; reportId: string; response: "STILL_AVAILABLE" | "ALREADY_RENTED"; expiresAt: number }
  | { kind: "LANDLORD_CONFIRMATION"; listingId: string; pendingSince: string; expiresAt: number };

function secret() {
  const value = process.env.LIFECYCLE_ACTION_SECRET ?? process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("LIFECYCLE_ACTION_SECRET is not configured");
  return value;
}

export function signLifecycleAction(input: LifecycleActionToken) {
  const payload = Buffer.from(JSON.stringify(input)).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyLifecycleAction(token: string, now = Date.now()): LifecycleActionToken | null {
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(suppliedSignature, "base64url"); } catch { return null; }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as LifecycleActionToken;
    if (!parsed || typeof parsed.expiresAt !== "number" || parsed.expiresAt <= now) return null;
    if (parsed.kind === "TENANT_AVAILABILITY") {
      return typeof parsed.reportId === "string" && ["STILL_AVAILABLE", "ALREADY_RENTED"].includes(parsed.response) ? parsed : null;
    }
    if (parsed.kind === "LANDLORD_CONFIRMATION") {
      return typeof parsed.listingId === "string" && typeof parsed.pendingSince === "string" ? parsed : null;
    }
    return null;
  } catch { return null; }
}
