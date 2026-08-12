import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { Action, authorizeRequest, Resource } from "@/modules/auth/authorization";
import { verifyCsrfRequest } from "@/modules/auth/request-security";
import { outboxMessage } from "@/modules/notifications/outbox";
import { enforceWriteRateLimit } from "@/modules/rate-limit/write-rate-limit";

type Context = { params: Promise<{ id: string }> };
const schema = z.object({ requestedFor: z.string().datetime(), notes: z.string().trim().max(500).optional() });

export async function POST(request: Request, { params }: Context) {
  if (!verifyCsrfRequest(request)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const authorization = authorizeRequest(request, [{ resource: Resource.CLIENT_ACTIVITY, action: Action.CREATE }]);
  if (!authorization.ok) return authorization.response;
  const limited = await enforceWriteRateLimit(request, "viewing-request:create", authorization.principal.userId, 3);
  if (limited) return limited;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid viewing request" }, { status: 400 });
  const requestedFor = new Date(parsed.data.requestedFor);
  if (requestedFor <= new Date() || requestedFor > new Date(Date.now() + 90 * 86_400_000)) return NextResponse.json({ error: "Viewing time must be within the next 90 days" }, { status: 400 });
  const { id: listingId } = await params;
  const viewing = await db.$transaction(async (tx) => {
    const listing = await tx.listing.findFirst({ where: { id: listingId, status: "PUBLISHED" }, select: { unit: { select: { property: { select: { ownerId: true } } } } } });
    if (!listing) return null;
    const created = await tx.viewingRequest.create({ data: { tenantId: authorization.principal.userId, listingId, requestedFor, notes: parsed.data.notes }, select: { id: true, status: true, requestedFor: true } });
    await tx.notificationOutbox.create({ data: outboxMessage({ recipientId: listing.unit.property.ownerId, topic: "NEW_VIEWING_REQUEST", dedupeKey: `viewing-request:${created.id}`, payload: { viewingRequestId: created.id, listingId, requestedFor: requestedFor.toISOString() } }) });
    return created;
  });
  if (!viewing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  return NextResponse.json({ viewingRequest: viewing }, { status: 201 });
}
