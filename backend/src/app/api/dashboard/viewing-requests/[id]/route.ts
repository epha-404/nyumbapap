import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { Action, authorizeRequest, Resource } from "@/modules/auth/authorization";
import { verifyCsrfRequest } from "@/modules/auth/request-security";
import { outboxMessage } from "@/modules/notifications/outbox";
import { enforceWriteRateLimit } from "@/modules/rate-limit/write-rate-limit";

type Context = { params: Promise<{ id: string }> };
const schema = z.object({ decision: z.enum(["ACCEPT", "DECLINE"]) });

export async function PATCH(request: Request, { params }: Context) {
  if (!verifyCsrfRequest(request)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const authorization = authorizeRequest(request, [{ resource: Resource.LISTING, action: Action.UPDATE }]);
  if (!authorization.ok) return authorization.response;
  const limited = await enforceWriteRateLimit(request, "viewing-request:update", authorization.principal.userId, 20);
  if (limited) return limited;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid viewing decision" }, { status: 400 });
  const { id } = await params;
  const status = parsed.data.decision === "ACCEPT" ? "ACCEPTED" : "DECLINED";
  const result = await db.$transaction(async (tx) => {
    const viewing = await tx.viewingRequest.findUnique({ where: { id }, select: { tenantId: true, listingId: true, status: true, listing: { select: { unit: { select: { property: { select: { ownerId: true } } } } } } } });
    if (!viewing) return "missing" as const;
    if (viewing.listing.unit.property.ownerId !== authorization.principal.userId) return "forbidden" as const;
    if (viewing.status !== "PENDING") return "decided" as const;
    await tx.viewingRequest.update({ where: { id }, data: { status } });
    await tx.notificationOutbox.create({ data: outboxMessage({ recipientId: viewing.tenantId, topic: "VIEWING_REQUEST_DECIDED", dedupeKey: `viewing-request-decided:${id}`, payload: { viewingRequestId: id, listingId: viewing.listingId, status } }) });
    return "updated" as const;
  });
  if (result === "missing") return NextResponse.json({ error: "Viewing request not found" }, { status: 404 });
  if (result === "forbidden") return NextResponse.json({ error: "You do not own this viewing request's listing" }, { status: 403 });
  if (result === "decided") return NextResponse.json({ error: "Viewing request has already been decided" }, { status: 409 });
  return NextResponse.json({ viewingRequest: { id, status } });
}
