import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  const started = Date.now();
  try { await db.$runCommandRaw({ ping: 1 }); return NextResponse.json({ status: "ok", database: "reachable", responseTimeMs: Date.now() - started }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ status: "degraded", database: "unreachable" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
