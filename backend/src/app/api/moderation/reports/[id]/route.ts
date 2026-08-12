import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { Action, authorizeRequest, Resource } from "@/modules/auth/authorization";
import { clientIpHash, verifyCsrfRequest } from "@/modules/auth/request-security";
import { outboxMessage } from "@/modules/notifications/outbox";
import { enforceWriteRateLimit } from "@/modules/rate-limit/write-rate-limit";
import { ensureAuditEventsImmutable } from "@/modules/verification/audit";

type Context = { params: Promise<{ id: string }> };
const schema = z.object({ decision: z.enum(["REVIEW", "TAKEDOWN", "DISMISS"]), notes: z.string().trim().max(1000).optional() });

export async function PATCH(request: Request, { params }: Context) {
  if (!verifyCsrfRequest(request)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const authorization = authorizeRequest(request, [{ resource: Resource.LISTING, action: Action.MODERATE }]);
  if (!authorization.ok) return authorization.response;
  const limited = await enforceWriteRateLimit(request, "listing-report:moderate", authorization.principal.userId, 20);
  if (limited) return limited;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid decision" }, { status: 400 });
  const { id } = await params;
  await ensureAuditEventsImmutable();
  const result = await db.$transaction(async (tx) => {
    const report = await tx.report.findUnique({
      where: { id },
      select: { id: true, status: true, reporterId: true, listingId: true, listing: { select: { status: true, unit: { select: { property: { select: { ownerId: true } } } } } } }
    });
    if (!report) return null;
    if (report.status === "RESOLVED" || report.status === "DISMISSED") throw new Error("REPORT_CLOSED");
    const reportStatus = parsed.data.decision === "REVIEW" ? "REVIEWING" : parsed.data.decision === "TAKEDOWN" ? "RESOLVED" : "DISMISSED";
    await tx.report.update({ where: { id }, data: { status: reportStatus, reviewerId: authorization.principal.userId, resolvedAt: parsed.data.decision === "REVIEW" ? null : new Date() } });
    if (parsed.data.decision === "TAKEDOWN") await tx.listing.update({ where: { id: report.listingId }, data: { status: "PAUSED" } });
    await tx.auditEvent.create({ data: { actorId: authorization.principal.userId, action: `LISTING_REPORT_${parsed.data.decision}`, entityType: "Report", entityId: id, requestId: request.headers.get("x-request-id"), ipHash: clientIpHash(request), metadata: { listingId: report.listingId, previousListingStatus: report.listing.status, hasNotes: Boolean(parsed.data.notes) } } });
    const ownerId = report.listing.unit.property.ownerId;
    await tx.notificationOutbox.createMany({ data: [
      outboxMessage({ recipientId: report.reporterId, topic: "REPORT_DECIDED", dedupeKey: `report-decision:${id}:${reportStatus}:reporter`, payload: { reportId: id, listingId: report.listingId, status: reportStatus } }),
      outboxMessage({ recipientId: ownerId, topic: parsed.data.decision === "TAKEDOWN" ? "LISTING_TAKEN_DOWN" : "LISTING_REPORT_DECIDED", dedupeKey: `report-decision:${id}:${reportStatus}:owner`, payload: { reportId: id, listingId: report.listingId, status: reportStatus } })
    ] });
    return { id, status: reportStatus, listingStatus: parsed.data.decision === "TAKEDOWN" ? "PAUSED" : report.listing.status };
  }).catch((error) => { if (error instanceof Error && error.message === "REPORT_CLOSED") return "closed" as const; throw error; });
  if (!result) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  if (result === "closed") return NextResponse.json({ error: "Report has already been decided" }, { status: 409 });
  return NextResponse.json({ report: result });
}
