import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { Action, authorizeRequest, Resource } from "@/modules/auth/authorization";
import { verifyCsrfRequest } from "@/modules/auth/request-security";
import { outboxMessage } from "@/modules/notifications/outbox";
import { enforceWriteRateLimit } from "@/modules/rate-limit/write-rate-limit";

type Context = { params: Promise<{ id: string }> };
const schema = z.object({ state: z.enum(["RESPONDED", "CLOSED", "SPAM"]) });

export async function PATCH(request: Request, { params }: Context) {
  if (!verifyCsrfRequest(request)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const authorization = authorizeRequest(request, [{ resource: Resource.LISTING, action: Action.UPDATE }]);
  if (!authorization.ok) return authorization.response;
  const limited = await enforceWriteRateLimit(request, "enquiry:update", authorization.principal.userId, 20);
  if (limited) return limited;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid enquiry state" }, { status: 400 });
  const { id } = await params;
  const result = await db.$transaction(async (tx) => {
    const enquiry = await tx.enquiry.findUnique({ where: { id }, select: { tenantId: true, listingId: true, state: true, listing: { select: { unit: { select: { property: { select: { ownerId: true } } } } } } } });
    if (!enquiry) return "missing" as const;
    if (enquiry.listing.unit.property.ownerId !== authorization.principal.userId) return "forbidden" as const;
    if (enquiry.state === "CLOSED" || enquiry.state === "SPAM") return "closed" as const;
    await tx.enquiry.update({ where: { id }, data: { state: parsed.data.state } });
    await tx.notificationOutbox.create({ data: outboxMessage({ recipientId: enquiry.tenantId, topic: "ENQUIRY_UPDATED", dedupeKey: `enquiry-updated:${id}:${parsed.data.state}`, payload: { enquiryId: id, listingId: enquiry.listingId, state: parsed.data.state } }) });
    return "updated" as const;
  });
  if (result === "missing") return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
  if (result === "forbidden") return NextResponse.json({ error: "You do not own this enquiry's listing" }, { status: 403 });
  if (result === "closed") return NextResponse.json({ error: "Enquiry is already closed" }, { status: 409 });
  return NextResponse.json({ enquiry: { id, state: parsed.data.state } });
}
