import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export function verifyNesSignature(rawBody: string, signature: string | null, secret: string, now = Date.now()) {
  if (!signature) return false;
  const values = Object.fromEntries(signature.split(",").map(part => part.trim().split("=", 2)));
  const timestamp = values.t;
  const supplied = values.v1;
  if (!timestamp || !supplied || !/^\d+$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(supplied)) return false;
  if (Math.abs(now - Number(timestamp) * 1000) > 5 * 60_000) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied.toLowerCase()));
}

export const nesSignatureHash = (signature: string) => createHash("sha256").update(signature).digest("hex");
