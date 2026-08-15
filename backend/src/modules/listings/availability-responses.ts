import type { Prisma, PrismaClient } from "@prisma/client";
import { CORROBORATION_THRESHOLD, CORROBORATION_WINDOW_DAYS, transitionListingToPending } from "./lifecycle";

const DAY = 86_400_000;
const REFUND_WINDOW_MS = 48 * 3_600_000;
export const MAX_LISTING_REFUNDS = 3;

async function creditQualifyingUnlock(tx: Prisma.TransactionClient, report: {
  id: string;
  listingId: string;
  unlock: { id: string; tenantId: string; grantedAt: Date; payment: { amountKes: number } };
}, now: Date) {
  if (now.getTime() - report.unlock.grantedAt.getTime() > REFUND_WINDOW_MS) return "OUTSIDE_WINDOW" as const;
  const existing = await tx.unlockRefund.findUnique({ where: { unlockId: report.unlock.id }, select: { id: true } });
  if (existing) return "ALREADY_CREDITED" as const;
  const reserved = await tx.listing.updateMany({ where: { id: report.listingId, refundCount: { lt: MAX_LISTING_REFUNDS } }, data: { refundCount: { increment: 1 } } });
  if (reserved.count) {
    await tx.unlockRefund.create({ data: {
      unlockId: report.unlock.id,
      listingId: report.listingId,
      tenantId: report.unlock.tenantId,
      amountKes: report.unlock.payment.amountKes,
      reason: "Listing reported already rented within 48 hours of unlock"
    } });
    return "CREDITED" as const;
  }
  const existingReview = await tx.report.findFirst({ where: { listingId: report.listingId, reason: "AUTOMATED_REFUND_CAP_REVIEW", status: { in: ["OPEN", "REVIEWING"] } }, select: { id: true } });
  if (!existingReview) await tx.report.create({ data: {
    reporterId: report.unlock.tenantId,
    listingId: report.listingId,
    reason: "AUTOMATED_REFUND_CAP_REVIEW",
    details: `Refund cap reached; availability report ${report.id} requires manual review.`
  } });
  return "MANUAL_REVIEW" as const;
}

export async function recordTenantAvailabilityResponse(
  db: PrismaClient,
  input: { reportId: string; response: "STILL_AVAILABLE" | "ALREADY_RENTED" },
  now = new Date()
) {
  return db.$transaction(async tx => {
    const report = await tx.availabilityReport.findUnique({
      where: { id: input.reportId },
      select: { id: true, listingId: true, response: true, unlock: { select: { id: true, tenantId: true, grantedAt: true, payment: { select: { amountKes: true } } } } }
    });
    if (!report) return { status: "NOT_FOUND" as const };
    if (report.response !== "NO_RESPONSE") return { status: "RECORDED" as const, response: report.response, duplicate: true };
    const claimed = await tx.availabilityReport.updateMany({
      where: { id: report.id, response: "NO_RESPONSE" },
      data: { response: input.response, reportedAt: now, channel: "EMAIL" }
    });
    if (!claimed.count) return { status: "RECORDED" as const, response: input.response, duplicate: true };

    const refund = input.response === "ALREADY_RENTED" ? await creditQualifyingUnlock(tx, report, now) : "NOT_APPLICABLE" as const;
    if (input.response === "ALREADY_RENTED") {
      const corroborating = await tx.availabilityReport.count({
        where: { listingId: report.listingId, response: "ALREADY_RENTED", reportedAt: { gte: new Date(now.getTime() - CORROBORATION_WINDOW_DAYS * DAY) } }
      });
      if (corroborating >= CORROBORATION_THRESHOLD) await transitionListingToPending(tx, report.listingId, now);
    }
    return { status: "RECORDED" as const, response: input.response, duplicate: false, refund };
  });
}

export async function confirmLandlordAvailability(db: PrismaClient, input: { listingId: string; pendingSince: string }, now = new Date()) {
  return db.$transaction(async tx => {
    const pendingSince = new Date(input.pendingSince);
    if (Number.isNaN(pendingSince.getTime())) return { status: "INVALID" as const };
    const listing = await tx.listing.findUnique({ where: { id: input.listingId }, select: { lifecycleStatus: true, pendingConfirmationSince: true, lastConfirmedAt: true } });
    if (!listing) return { status: "NOT_FOUND" as const };
    if (listing.lifecycleStatus === "ACTIVE" && listing.lastConfirmedAt >= pendingSince) return { status: "CONFIRMED" as const, duplicate: true };
    if (listing.lifecycleStatus !== "PENDING_CONFIRMATION" || listing.pendingConfirmationSince?.getTime() !== pendingSince.getTime()) return { status: "INVALID" as const };
    const updated = await tx.listing.updateMany({
      where: { id: input.listingId, lifecycleStatus: "PENDING_CONFIRMATION", pendingConfirmationSince: pendingSince },
      data: { lifecycleStatus: "ACTIVE", lastConfirmedAt: now, pendingConfirmationSince: null, unlistedAt: null }
    });
    return updated.count ? { status: "CONFIRMED" as const, duplicate: false } : { status: "INVALID" as const };
  });
}
