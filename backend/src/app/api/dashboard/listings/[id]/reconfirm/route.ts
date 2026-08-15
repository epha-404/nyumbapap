import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Action, authorizeRequest, Resource } from "@/modules/auth/authorization";
import { verifyCsrfRequest } from "@/modules/auth/request-security";
import { listingExpiry } from "@/modules/listings/lifecycle";
import { outboxMessage } from "@/modules/notifications/outbox";
import { enforceWriteRateLimit } from "@/modules/rate-limit/write-rate-limit";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  if (!verifyCsrfRequest(request)) return NextResponse.json({ error: "Invalid CSRF token" }, { status: 403 });
  const authorization = authorizeRequest(request, [{ resource: Resource.LISTING, action: Action.UPDATE }]);
  if (!authorization.ok) return authorization.response;
  const limited = await enforceWriteRateLimit(request, "listing:reconfirm", authorization.principal.userId, 5, 3600);
  if (limited) return limited;
  const { id } = await params;
  const now = new Date();
  const result = await db.$transaction(async (tx) => {
    const listing = await tx.listing.findUnique({ where: { id }, select: { status: true, verificationState: true, unit: { select: { availability: true, property: { select: { ownerId: true } } } } } });
    if (!listing) return "missing" as const;
    if (listing.unit.property.ownerId !== authorization.principal.userId) return "forbidden" as const;
    if (listing.status !== "EXPIRED" || listing.verificationState !== "APPROVED" || listing.unit.availability !== "AVAILABLE") return "invalid" as const;
    const expiresAt = listingExpiry(now);
    await tx.listing.update({ where: { id }, data: { status: "PUBLISHED", lifecycleStatus: "ACTIVE", lastConfirmedAt: now, pendingConfirmationSince: null, unlistedAt: null, publishedAt: now, expiresAt } });
    await tx.notificationOutbox.create({ data: outboxMessage({ recipientId: authorization.principal.userId, topic: "LISTING_RECONFIRMED", dedupeKey: `listing-reconfirmed:${id}:${now.toISOString()}`, payload: { listingId: id, expiresAt: expiresAt.toISOString() } }) });
    return { expiresAt };
  });
  if (result === "missing") return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  if (result === "forbidden") return NextResponse.json({ error: "You do not own this listing" }, { status: 403 });
  if (result === "invalid") return NextResponse.json({ error: "Only approved, available, expired listings can be reconfirmed" }, { status: 409 });
  return NextResponse.json({ listing: { id, status: "PUBLISHED", expiresAt: result.expiresAt } });
}
