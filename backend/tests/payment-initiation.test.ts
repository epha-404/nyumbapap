import { describe, expect, it, vi } from "vitest";
import { initiateTenantUnlock } from "@/modules/payments/initiate-payment";

function fixture(options: { listing?: boolean; unlocked?: boolean; providerFailure?: boolean } = {}) {
  const create = vi.fn().mockResolvedValue({ id: "payment-1" });
  const update = vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "payment-1", ...data }));
  const requestStkPush = options.providerFailure
    ? vi.fn().mockRejectedValue(new Error("Daraja failed"))
    : vi.fn().mockResolvedValue({ merchantRequestId: "merchant-1", checkoutRequestId: "checkout-1" });
  return {
    create,
    update,
    requestStkPush,
    db: {
      listing: { findFirst: vi.fn().mockResolvedValue(options.listing === false ? null : { id: "listing-1", unit: { monthlyRentKes: 10_000 } }) },
      tenantUnlock: { findUnique: vi.fn().mockResolvedValue(options.unlocked ? { id: "unlock-1" } : null) },
      unlockFeeConfig: { findUnique: vi.fn().mockResolvedValue({ rate: 0.025, floorKes: 100, ceilingKes: 800 }) },
      payment: { create, update }
    }
  };
}

const input = { userId: "user-1", listingId: "listing-1", phoneE164: "+254708374149" };

describe("M-Pesa payment initiation", () => {
  it("persists provider references only after an accepted STK request", async () => {
    const fake = fixture();
    await initiateTenantUnlock(fake.db as never, { requestStkPush: fake.requestStkPush }, input);
    expect(fake.requestStkPush).toHaveBeenCalledWith(expect.objectContaining({ amountKes: 250, accountReference: "payment-1" }));
    expect(fake.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ amountKes: 250 }) }));
    expect(fake.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ state: "PROCESSING", checkoutRequestId: "checkout-1" }) }));
  });

  it("marks the pending payment failed when Daraja rejects initiation", async () => {
    const fake = fixture({ providerFailure: true });
    await expect(initiateTenantUnlock(fake.db as never, { requestStkPush: fake.requestStkPush }, input)).rejects.toThrow("Daraja failed");
    expect(fake.update).toHaveBeenCalledWith({ where: { id: "payment-1" }, data: { state: "FAILED" } });
  });

  it("does not charge for a missing or already unlocked listing", async () => {
    const missing = fixture({ listing: false });
    await expect(initiateTenantUnlock(missing.db as never, { requestStkPush: missing.requestStkPush }, input)).rejects.toThrow("LISTING_NOT_FOUND");
    expect(missing.create).not.toHaveBeenCalled();
    const unlocked = fixture({ unlocked: true });
    await expect(initiateTenantUnlock(unlocked.db as never, { requestStkPush: unlocked.requestStkPush }, input)).rejects.toThrow("ALREADY_UNLOCKED");
    expect(unlocked.create).not.toHaveBeenCalled();
  });
});
