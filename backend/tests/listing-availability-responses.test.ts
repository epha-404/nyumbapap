import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmLandlordAvailability, recordTenantAvailabilityResponse } from "@/modules/listings/availability-responses";

function responseTx(response: "NO_RESPONSE" | "ALREADY_RENTED" = "NO_RESPONSE") {
  const now = new Date("2026-08-15T12:00:00.000Z");
  return {
    now,
    availabilityReport: {
      findUnique: vi.fn().mockResolvedValue({ id: "report-1", listingId: "listing-1", response, unlock: { id: "unlock-1", tenantId: "tenant-1", grantedAt: new Date(now.getTime() - 24 * 3_600_000), payment: { amountKes: 250 } } }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      count: vi.fn().mockResolvedValue(1)
    },
    unlockRefund: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "refund-1" }) },
    listing: { updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUnique: vi.fn() },
    report: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
    notificationOutbox: { upsert: vi.fn() }
  };
}

describe("availability responses and credits", () => {
  beforeEach(() => { process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-32-characters"; });

  it("records a qualifying rented report and credits the unlock fee atomically", async () => {
    const tx = responseTx();
    const db = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    await expect(recordTenantAvailabilityResponse(db as never, { reportId: "report-1", response: "ALREADY_RENTED" }, tx.now)).resolves.toMatchObject({ duplicate: false, refund: "CREDITED" });
    expect(tx.unlockRefund.create).toHaveBeenCalledWith({ data: expect.objectContaining({ unlockId: "unlock-1", amountKes: 250 }) });
    expect(tx.listing.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "listing-1", refundCount: { lt: 3 } }, data: { refundCount: { increment: 1 } } }));
  });

  it("does not overwrite a tenant response or issue a second refund on a repeated click", async () => {
    const tx = responseTx("ALREADY_RENTED");
    const db = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    await expect(recordTenantAvailabilityResponse(db as never, { reportId: "report-1", response: "STILL_AVAILABLE" }, tx.now)).resolves.toMatchObject({ duplicate: true, response: "ALREADY_RENTED" });
    expect(tx.availabilityReport.updateMany).not.toHaveBeenCalled();
    expect(tx.unlockRefund.create).not.toHaveBeenCalled();
  });

  it("flags the listing in the existing report queue when the three-credit cap is exhausted", async () => {
    const tx = responseTx();
    tx.listing.updateMany.mockResolvedValue({ count: 0 });
    const db = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    await expect(recordTenantAvailabilityResponse(db as never, { reportId: "report-1", response: "ALREADY_RENTED" }, tx.now)).resolves.toMatchObject({ refund: "MANUAL_REVIEW" });
    expect(tx.report.create).toHaveBeenCalledWith({ data: expect.objectContaining({ reason: "AUTOMATED_REFUND_CAP_REVIEW" }) });
    expect(tx.unlockRefund.create).not.toHaveBeenCalled();
  });

  it("restores pending listings to active and treats a repeated landlord click as idempotent", async () => {
    const pendingSince = new Date("2026-08-14T12:00:00.000Z");
    const tx = responseTx();
    tx.listing.findUnique.mockResolvedValueOnce({ lifecycleStatus: "PENDING_CONFIRMATION", pendingConfirmationSince: pendingSince, lastConfirmedAt: new Date(0) });
    const db = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    await expect(confirmLandlordAvailability(db as never, { listingId: "listing-1", pendingSince: pendingSince.toISOString() }, tx.now)).resolves.toEqual({ status: "CONFIRMED", duplicate: false });
    tx.listing.findUnique.mockResolvedValueOnce({ lifecycleStatus: "ACTIVE", pendingConfirmationSince: null, lastConfirmedAt: tx.now });
    await expect(confirmLandlordAvailability(db as never, { listingId: "listing-1", pendingSince: pendingSince.toISOString() }, tx.now)).resolves.toEqual({ status: "CONFIRMED", duplicate: true });
  });
});
