import type { PrismaClient } from "@prisma/client";
import { outboxMessage } from "@/modules/notifications/outbox";

export const LISTING_LIFETIME_DAYS = 45;

export function listingExpiry(from = new Date()) {
  return new Date(from.getTime() + LISTING_LIFETIME_DAYS * 86_400_000);
}

export async function expirePublishedListings(db: PrismaClient, now = new Date()) {
  return db.$transaction(async (tx) => {
    const expired = await tx.listing.findMany({
      where: { status: "PUBLISHED", expiresAt: { lte: now } },
      select: { id: true, unit: { select: { property: { select: { ownerId: true } } } } }
    });
    if (!expired.length) return { expired: 0 };
    await tx.listing.updateMany({ where: { id: { in: expired.map((listing) => listing.id) }, status: "PUBLISHED" }, data: { status: "EXPIRED" } });
    await tx.notificationOutbox.createMany({
      data: expired.map((listing) => outboxMessage({
        recipientId: listing.unit.property.ownerId,
        topic: "LISTING_EXPIRED",
        dedupeKey: `listing-expired:${listing.id}:${now.toISOString()}`,
        payload: { listingId: listing.id, expiredAt: now.toISOString() }
      }))
    });
    return { expired: expired.length };
  });
}
