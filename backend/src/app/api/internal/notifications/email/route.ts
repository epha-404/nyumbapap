import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processEmailOutbox } from "@/modules/email/process-outbox";

function authorized(request: Request) {
  const secret = process.env.LIFECYCLE_JOB_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || !supplied) return false;
  return timingSafeEqual(createHash("sha256").update(secret).digest(), createHash("sha256").update(supplied).digest());
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.NES_API_KEY) return NextResponse.json({ error: "NES is not configured" }, { status: 503 });
  return NextResponse.json(await processEmailOutbox());
}
