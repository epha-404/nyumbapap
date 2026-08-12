import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { DarajaProvider } from "@/modules/payments/mpesa";
import { reconcileExpiredStkPayments } from "@/modules/payments/reconcile";

function authorized(request: Request) {
  const secret = process.env.LIFECYCLE_JOB_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || !supplied) return false;
  return timingSafeEqual(createHash("sha256").update(secret).digest(), createHash("sha256").update(supplied).digest());
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await reconcileExpiredStkPayments(db, new DarajaProvider()));
}
