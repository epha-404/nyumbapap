import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { Action, authorizeRequest, Resource } from "@/modules/auth/authorization";
import { verifyCsrfRequest } from "@/modules/auth/request-security";
import { outboxMessage } from "@/modules/notifications/outbox";
import { enforceWriteRateLimit } from "@/modules/rate-limit/write-rate-limit";

type Context = { params: Promise<{ id: string }> };
const schema = z.object({ reason: z.enum(["FRAUD", "NOT_AVAILABLE", "MISLEADING", "DUPLICATE", "SAFETY", "OTHER"]), details: z.string().trim().max(2000).optional() });

export async function POST(request: Request, { params }: Context) {
  if (!verifyCsrfRequest(request)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const authorization = authorizeRequest(request, [{ resource: Resource.CLIENT_ACTIVITY, action: Action.CREATE }]);
  if (!authorization.ok) return authorization.response;
  const limited = await enforceWriteRateLimit(request, "listing-report:create", authorization.principal.userId, 3, 600);
  if (limited) return limited;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid report" }, { status: 400 });
  const { id: listingId } = await params;
  const report = await db.$transaction(async (tx) => {
    const listing = await tx.listing.findFirst({ where: { id: listingId, status: { in: ["PUBLISHED", "PAUSED"] } }, select: { id: true } });
    if (!listing) return null;
    const existing = await tx.report.findFirst({ where: { reporterId: authorization.principal.userId, listingId, status: { in: ["OPEN", "REVIEWING"] } }, select: { id: true } });
    if (existing) throw new Error("REPORT_ALREADY_OPEN");
    const created = await tx.report.create({ data: { reporterId: authorization.principal.userId, listingId, reason: parsed.data.reason, details: parsed.data.details }, select: { id: true, status: true, createdAt: true } });
    await tx.notificationOutbox.create({ data: outboxMessage({ recipientId: authorization.principal.userId, topic: "REPORT_RECEIVED", dedupeKey: `report-received:${created.id}`, payload: { reportId: created.id, listingId } }) });
    return created;
  }).catch((error) => { if ((error instanceof Error && error.message === "REPORT_ALREADY_OPEN") || (typeof error === "object" && error !== null && "code" in error && error.code === "P2002")) return "duplicate" as const; throw error; });
  if (report === "duplicate") return NextResponse.json({ error: "You already have an open report for this listing" }, { status: 409 });
  if (!report) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  return NextResponse.json({ report }, { status: 201 });
}
