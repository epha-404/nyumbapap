import { beforeEach, describe, expect, it, vi } from "vitest";
import { LISTING_CONFIRMATION_DAYS, LANDLORD_RESPONSE_HOURS, listingExpiry, LISTING_LIFETIME_DAYS, sweepListingLifecycle, transitionListingToPending } from "@/modules/listings/lifecycle";

function transaction(overrides: Record<string, unknown> = {}) {
  return {
    listing: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      ...(overrides.listing as object ?? {})
    },
    availabilityReport: { findMany: vi.fn().mockResolvedValue([]), upsert: vi.fn() },
    tenantUnlock: { findMany: vi.fn().mockResolvedValue([]) },
    notificationOutbox: { upsert: vi.fn() },
    ...overrides
  };
}

describe("listing lifecycle sweep", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-32-characters";
    process.env.APP_URL = "https://api.example.test";
  });

  it("moves listings past 21 days to pending and queues the landlord email once", async () => {
    const tx = transaction();
    tx.listing.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    tx.listing.findMany.mockResolvedValueOnce([{ id: "listing-1" }]);
    tx.listing.findUnique.mockResolvedValue({ id: "listing-1", title: "Westlands home", lifecycleStatus: "ACTIVE", unit: { property: { ownerId: "owner-1" } } });
    const db = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const now = new Date("2026-08-15T12:00:00.000Z");
    await expect(sweepListingLifecycle(db as never, now)).resolves.toEqual({ pendingByTtl: 1, pendingByReports: 0, unlisted: 0, tenantChecksQueued: 0 });
    expect(tx.listing.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ lastConfirmedAt: { lte: new Date(now.getTime() - LISTING_CONFIRMATION_DAYS * 86_400_000) } }) }));
    expect(tx.notificationOutbox.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ topic: "LANDLORD_AVAILABILITY_CONFIRMATION", recipientId: "owner-1" }) }));
  });

  it("uses two recent rented reports as the second path into pending", async () => {
    const tx = transaction();
    tx.listing.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    tx.listing.findUnique.mockResolvedValue({ id: "listing-2", title: "Kilimani flat", lifecycleStatus: "ACTIVE", unit: { property: { ownerId: "owner-2" } } });
    tx.availabilityReport.findMany.mockResolvedValue([{ listingId: "listing-2" }, { listingId: "listing-2" }]);
    const db = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    await expect(sweepListingLifecycle(db as never, new Date())).resolves.toEqual({ pendingByTtl: 0, pendingByReports: 1, unlisted: 0, tenantChecksQueued: 0 });
  });

  it("unlists pending listings after the 72-hour response window", async () => {
    const tx = transaction();
    tx.listing.updateMany.mockResolvedValueOnce({ count: 2 });
    const db = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const now = new Date("2026-08-15T12:00:00.000Z");
    await expect(sweepListingLifecycle(db as never, now)).resolves.toEqual({ pendingByTtl: 0, pendingByReports: 0, unlisted: 2, tenantChecksQueued: 0 });
    expect(tx.listing.updateMany).toHaveBeenCalledWith({ where: { lifecycleStatus: "PENDING_CONFIRMATION", pendingConfirmationSince: { lte: new Date(now.getTime() - LANDLORD_RESPONSE_HOURS * 3_600_000) } }, data: { lifecycleStatus: "UNLISTED", unlistedAt: now } });
  });

  it("queues one email availability check for an unlock once it is three days old", async () => {
    const tx = transaction();
    tx.tenantUnlock.findMany.mockResolvedValue([{ id: "unlock-1", listingId: "listing-1", tenantId: "tenant-1", listing: { title: "Riverside home" } }]);
    tx.availabilityReport.upsert.mockResolvedValue({ id: "availability-1", createdAt: new Date("2026-08-15T12:00:00.000Z") });
    const db = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const now = new Date("2026-08-15T12:00:00.000Z");
    await expect(sweepListingLifecycle(db as never, now)).resolves.toMatchObject({ tenantChecksQueued: 1 });
    expect(tx.tenantUnlock.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ grantedAt: { lte: new Date("2026-08-12T12:00:00.000Z") }, availabilityReport: null }) }));
    expect(tx.notificationOutbox.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ topic: "TENANT_AVAILABILITY_CHECK", dedupeKey: "tenant-availability-check:unlock-1" }) }));
  });

  it("does not send a second landlord email when the transition was already claimed", async () => {
    const tx = transaction();
    tx.listing.findUnique.mockResolvedValue({ id: "listing-1", title: "Home", lifecycleStatus: "ACTIVE", unit: { property: { ownerId: "owner-1" } } });
    await expect(transitionListingToPending(tx as never, "listing-1")).resolves.toBe(false);
    expect(tx.notificationOutbox.upsert).not.toHaveBeenCalled();
  });

  it("retains the verification expiry helper independently", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(listingExpiry(now).getTime() - now.getTime()).toBe(LISTING_LIFETIME_DAYS * 86_400_000);
  });
});
