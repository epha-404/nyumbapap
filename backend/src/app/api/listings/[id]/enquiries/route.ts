import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { Action, authorizeRequest, Resource } from "@/modules/auth/authorization";
import { verifyCsrfRequest } from "@/modules/auth/request-security";
import { outboxMessage } from "@/modules/notifications/outbox";
import { enforceWriteRateLimit } from "@/modules/rate-limit/write-rate-limit";

type Context = { params: Promise<{ id: string }> };
const schema = z.object({ message: z.string().trim().min(10).max(1000) });

export async function POST(request: Request, { params }: Context) {
  if (!verifyCsrfRequest(request)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const authorization = authorizeRequest(request, [{ resource: Resource.CLIENT_ACTIVITY, action: Action.CREATE }]);
  if (!authorization.ok) return authorization.response;
  const limited = await enforceWriteRateLimit(request, "enquiry:create", authorization.principal.userId, 5);
  if (limited) return limited;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid enquiry" }, { status: 400 });
  const { id: listingId } = await params;
  const enquiry = await db.$transaction(async (tx) => {
    const listing = await tx.listing.findFirst({ where: { id: listingId, status: "PUBLISHED" }, select: { unit: { select: { property: { select: { ownerId: true } } } } } });
    if (!listing) return null;
    const created = await tx.enquiry.create({ data: { tenantId: authorization.principal.userId, listingId, message: parsed.data.message }, select: { id: true, state: true, createdAt: true } });
    await tx.notificationOutbox.create({ data: outboxMessage({ recipientId: listing.unit.property.ownerId, topic: "NEW_ENQUIRY", dedupeKey: `enquiry:${created.id}`, payload: { enquiryId: created.id, listingId } }) });
    return created;
  });
  if (!enquiry) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  return NextResponse.json({ enquiry }, { status: 201 });
}
