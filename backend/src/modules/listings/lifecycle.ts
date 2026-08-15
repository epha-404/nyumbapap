import type { Prisma, PrismaClient } from "@prisma/client";
import { outboxMessage } from "@/modules/notifications/outbox";
import { signLifecycleAction } from "./action-tokens";

export const LISTING_LIFETIME_DAYS = 45;
export const LISTING_CONFIRMATION_DAYS = 21;
export const LANDLORD_RESPONSE_HOURS = 72;
export const TENANT_CHECK_DELAY_DAYS = 3;
export const CORROBORATION_WINDOW_DAYS = 7;
export const CORROBORATION_THRESHOLD = 2;

const DAY = 86_400_000;
const HOUR = 3_600_000;

export function listingExpiry(from = new Date()) {
  return new Date(from.getTime() + LISTING_LIFETIME_DAYS * DAY);
}

function publicApiUrl() {
  return (process.env.APP_URL ?? "http://localhost:3001").replace(/\/$/, "");
}

function landlordConfirmationPayload(listing: { id: string; title: string }, pendingSince: Date) {
  const token = signLifecycleAction({ kind: "LANDLORD_CONFIRMATION", listingId: listing.id, pendingSince: pendingSince.toISOString(), expiresAt: pendingSince.getTime() + LANDLORD_RESPONSE_HOURS * HOUR });
  return {
    listingId: listing.id,
    listingTitle: listing.title,
    heading: "Confirm your NyumbaPap listing is still available",
    introduction: "Please confirm within 72 hours or this listing will be removed from active search.",
    actions: [{ label: "Still available", url: `${publicApiUrl()}/api/listings/confirm?token=${encodeURIComponent(token)}` }]
  } satisfies Prisma.InputJsonObject;
}

export async function transitionListingToPending(tx: Prisma.TransactionClient, listingId: string, now = new Date()) {
  const listing = await tx.listing.findUnique({
    where: { id: listingId },
    select: { id: true, title: true, lifecycleStatus: true, unit: { select: { property: { select: { ownerId: true } } } } }
  });
  if (!listing || listing.lifecycleStatus !== "ACTIVE") return false;
  const claimed = await tx.listing.updateMany({
    where: { id: listing.id, lifecycleStatus: "ACTIVE" },
    data: { lifecycleStatus: "PENDING_CONFIRMATION", pendingConfirmationSince: now, unlistedAt: null }
  });
  if (!claimed.count) return false;
  await tx.notificationOutbox.upsert({
    where: { dedupeKey: `listing-availability-confirmation:${listing.id}:${now.toISOString()}` },
    create: outboxMessage({
      recipientId: listing.unit.property.ownerId,
      topic: "LANDLORD_AVAILABILITY_CONFIRMATION",
      dedupeKey: `listing-availability-confirmation:${listing.id}:${now.toISOString()}`,
      payload: landlordConfirmationPayload(listing, now)
    }),
    update: {}
  });
  return true;
}

async function queueTenantAvailabilityChecks(tx: Prisma.TransactionClient, now: Date) {
  const unlocks = await tx.tenantUnlock.findMany({
    where: { grantedAt: { lte: new Date(now.getTime() - TENANT_CHECK_DELAY_DAYS * DAY) }, availabilityReport: null },
    select: { id: true, listingId: true, tenantId: true, listing: { select: { title: true } } },
    take: 250
  });
  for (const unlock of unlocks) {
    const report = await tx.availabilityReport.upsert({
      where: { unlockId: unlock.id },
      create: { unlockId: unlock.id, listingId: unlock.listingId, channel: "EMAIL" },
      update: {},
      select: { id: true, createdAt: true }
    });
    const expiresAt = report.createdAt.getTime() + CORROBORATION_WINDOW_DAYS * DAY;
    const actions = (["STILL_AVAILABLE", "ALREADY_RENTED"] as const).map(response => ({
      label: response === "STILL_AVAILABLE" ? "Still available" : "Already rented",
      url: `${publicApiUrl()}/api/listings/availability/respond?token=${encodeURIComponent(signLifecycleAction({ kind: "TENANT_AVAILABILITY", reportId: report.id, response, expiresAt }))}`
    }));
    await tx.notificationOutbox.upsert({
      where: { dedupeKey: `tenant-availability-check:${unlock.id}` },
      create: outboxMessage({
        recipientId: unlock.tenantId,
        topic: "TENANT_AVAILABILITY_CHECK",
        dedupeKey: `tenant-availability-check:${unlock.id}`,
        payload: { listingId: unlock.listingId, listingTitle: unlock.listing.title, heading: "Is this NyumbaPap listing still available?", introduction: "You unlocked this listing three days ago. Your answer helps keep the marketplace accurate.", actions }
      }),
      update: {}
    });
  }
  return unlocks.length;
}

export async function sweepListingLifecycle(db: PrismaClient, now = new Date()) {
  return db.$transaction(async tx => {
    const unlisted = await tx.listing.updateMany({
      where: { lifecycleStatus: "PENDING_CONFIRMATION", pendingConfirmationSince: { lte: new Date(now.getTime() - LANDLORD_RESPONSE_HOURS * HOUR) } },
      data: { lifecycleStatus: "UNLISTED", unlistedAt: now }
    });

    const ttlDue = await tx.listing.findMany({
      where: { status: "PUBLISHED", lifecycleStatus: "ACTIVE", lastConfirmedAt: { lte: new Date(now.getTime() - LISTING_CONFIRMATION_DAYS * DAY) } },
      select: { id: true }, take: 250
    });
    let pendingByTtl = 0;
    for (const listing of ttlDue) if (await transitionListingToPending(tx, listing.id, now)) pendingByTtl++;

    const recentRented = await tx.availabilityReport.findMany({
      where: { response: "ALREADY_RENTED", reportedAt: { gte: new Date(now.getTime() - CORROBORATION_WINDOW_DAYS * DAY) }, listing: { lifecycleStatus: "ACTIVE" } },
      select: { listingId: true }, take: 1000
    });
    const counts = new Map<string, number>();
    for (const report of recentRented) counts.set(report.listingId, (counts.get(report.listingId) ?? 0) + 1);
    let pendingByReports = 0;
    for (const [listingId, count] of counts) if (count >= CORROBORATION_THRESHOLD && await transitionListingToPending(tx, listingId, now)) pendingByReports++;

    const tenantChecksQueued = await queueTenantAvailabilityChecks(tx, now);
    return { pendingByTtl, pendingByReports, unlisted: unlisted.count, tenantChecksQueued };
  });
}

// Retain the established cron call-site while its behavior now runs the full lifecycle sweep.
export const expirePublishedListings = sweepListingLifecycle;
