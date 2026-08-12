import { describe, expect, it, vi } from "vitest";
import { expirePublishedListings, listingExpiry, LISTING_LIFETIME_DAYS } from "@/modules/listings/lifecycle";

describe("listing expiry", () => {
  it("expires due listings and queues owner notifications in one transaction", async () => {
    const tx = {
      listing: {
        findMany: vi.fn().mockResolvedValue([{ id: "listing-1", unit: { property: { ownerId: "owner-1" } } }]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      notificationOutbox: { createMany: vi.fn() }
    };
    const db = { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) };
    const now = new Date("2026-08-12T00:00:00.000Z");
    await expect(expirePublishedListings(db as never, now)).resolves.toEqual({ expired: 1 });
    expect(tx.listing.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "EXPIRED" } }));
    expect(tx.notificationOutbox.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ recipientId: "owner-1", topic: "LISTING_EXPIRED" })] });
  });

  it("uses the configured lifecycle duration", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(listingExpiry(now).getTime() - now.getTime()).toBe(LISTING_LIFETIME_DAYS * 86_400_000);
  });
});
