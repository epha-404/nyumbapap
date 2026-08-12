import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { expirePublishedListings } from "@/modules/listings/lifecycle";
import { enforceWriteRateLimit } from "@/modules/rate-limit/write-rate-limit";

function authorized(request: Request) {
  const secret = process.env.LIFECYCLE_JOB_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || !supplied) return false;
  const expected = createHash("sha256").update(secret).digest();
  const actual = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expected, actual);
}

export async function POST(request: Request) {
  if (!process.env.LIFECYCLE_JOB_SECRET) return NextResponse.json({ error: "Lifecycle job is not configured" }, { status: 503 });
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = await enforceWriteRateLimit(request, "listing:expire", "lifecycle-job", 2);
  if (limited) return limited;
  return NextResponse.json(await expirePublishedListings(db));
}
