import { NextResponse } from "next/server";
import { clientIpHash, consumeRateLimit } from "@/modules/auth/request-security";

export async function enforceWriteRateLimit(request: Request, action: string, actorId: string, limit: number, windowSeconds = 60) {
  const result = await consumeRateLimit(action, `${actorId}:${clientIpHash(request)}`, limit, windowSeconds);
  if (!result.limited) return null;
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    { status: 429, headers: { "Retry-After": String(result.retryAfter) } }
  );
}
