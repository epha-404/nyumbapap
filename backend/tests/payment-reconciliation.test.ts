import { describe, expect, it, vi } from "vitest";
import { reconcileExpiredStkPayments } from "@/modules/payments/reconcile";

function fixture(resultCode: number) {
  const payment = { id: "payment-1", userId: "tenant-1", listingId: "listing-1", purpose: "TENANT_UNLOCK", checkoutRequestId: "checkout-1" };
  const updateMany = vi.fn().mockResolvedValue({ count: 1 });
  const upsert = vi.fn();
  const tx = { payment: { updateMany }, tenantUnlock: { upsert } };
  return {
    updateMany,
    upsert,
    provider: { queryStkStatus: vi.fn().mockResolvedValue({ resultCode, resultDescription: "reconciled" }) },
    db: {
      payment: { findMany: vi.fn().mockResolvedValue([payment]), updateMany },
      $transaction: (callback: (client: typeof tx) => unknown) => callback(tx)
    }
  };
}

describe("expired STK reconciliation", () => {
  it("creates the tenant unlock atomically when Daraja confirms payment", async () => {
    const fake = fixture(0);
    await expect(reconcileExpiredStkPayments(fake.db as never, fake.provider)).resolves.toEqual({ checked: 1, paid: 1, failed: 0, deferred: 0 });
    expect(fake.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ state: "PAID", reconciledAt: expect.any(Date) }) }));
    expect(fake.upsert).toHaveBeenCalledOnce();
  });

  it("resolves a cancelled request without granting access", async () => {
    const fake = fixture(1032);
    await expect(reconcileExpiredStkPayments(fake.db as never, fake.provider)).resolves.toEqual({ checked: 1, paid: 0, failed: 1, deferred: 0 });
    expect(fake.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ state: "CANCELLED", resultCode: 1032 }) }));
    expect(fake.upsert).not.toHaveBeenCalled();
  });
});
